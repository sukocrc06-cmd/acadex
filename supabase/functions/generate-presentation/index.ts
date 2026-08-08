import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { extractText, getDocumentProxy } from "npm:unpdf"
import mammoth from "npm:mammoth@1.6.0"
import JSZip from "npm:jszip@3.10.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const allowedLayouts = new Set(['title-content', 'two-column', 'image-left', 'image-right', 'chart', 'table'])
const allowedSourceTypes = new Set(['topic', 'study_card', 'document'])

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength)
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function stripCodeFence(value: string): string {
  const withoutReasoning = value.replace(/^\s*<think>[\s\S]*?<\/think>\s*/i, '')
  if (/^\s*<think>/i.test(withoutReasoning)) throw new Error('INVALID_AI_JSON')
  return withoutReasoning.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

function parseModelJson(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(stripCodeFence(raw))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('INVALID_AI_JSON')
  return parsed as Record<string, unknown>
}

function normalizeSlide(value: unknown, index: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_SLIDE')
  const slide = value as Record<string, unknown>
  const rawLayout = cleanText(slide.layout_type ?? slide.layout, 30)
  const layout = allowedLayouts.has(rawLayout) ? rawLayout : 'title-content'
  const title = cleanText(slide.title, 160) || `Slayt ${index + 1}`
  const text = cleanText(slide.text ?? slide.content, 3500)
  const secondaryText = cleanText(slide.secondary_text ?? slide.secondaryText, 2200)
  const speakerNotes = cleanText(slide.speaker_notes ?? slide.speakerNotes, 4000)

  return {
    title,
    content: { text, secondary_text: secondaryText },
    speaker_notes: speakerNotes,
    layout_type: layout,
    image_url: null,
    image_position: layout === 'image-left' ? 'left' : 'right',
  }
}

function normalizePresentation(value: Record<string, unknown>, requestedCount: number) {
  const container = value.presentation && typeof value.presentation === 'object' && !Array.isArray(value.presentation)
    ? value.presentation as Record<string, unknown>
    : value
  const rawSlides = Array.isArray(container.slides) ? container.slides : []
  if (rawSlides.length < 1 || rawSlides.length > 15) throw new Error('INVALID_SLIDE_COUNT')
  const slides = rawSlides.slice(0, requestedCount).map(normalizeSlide)
  if (slides.length < Math.min(4, requestedCount)) throw new Error('INCOMPLETE_PRESENTATION')
  return {
    title: cleanText(container.title, 160) || slides[0].title,
    slides,
  }
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function parsePptxSlideXml(slideXml: string): string {
  let text = ''
  for (const match of slideXml.matchAll(/<a:t>(.*?)<\/a:t>/g)) {
    text += `${decodeXmlEntities(match[1])} `
  }
  return text.trim()
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractDocumentText(userClient: any, document: any): Promise<string> {
  // Download with the caller's JWT so the existing Storage RLS policy remains
  // the only authority boundary. This function never uses a service-role key.
  const { data: fileBlob, error } = await userClient.storage.from('documents').download(document.storage_path)
  if (error || !fileBlob) throw new Error('DOCUMENT_DOWNLOAD_FAILED')

  const fileBytes = new Uint8Array(await fileBlob.arrayBuffer())
  const mimeType = cleanText(document.mime_type, 160).toLowerCase()

  if (mimeType === 'application/pdf') {
    const pdf = await getDocumentProxy(fileBytes)
    const { text } = await extractText(pdf, { mergePages: true })
    return cleanText(text, 50000)
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const result = await mammoth.convertToHtml({ buffer: fileBytes })
      return cleanText(htmlToPlainText(result.value || ''), 50000)
    } catch (_error) {
      const result = await mammoth.extractRawText({ buffer: fileBytes })
      return cleanText(result.value, 50000)
    }
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    const zip = await new JSZip().loadAsync(fileBytes)
    const slideFiles = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0))
    const parts: string[] = []
    for (const path of slideFiles) {
      const slideText = parsePptxSlideXml(await zip.files[path].async('text'))
      if (slideText) parts.push(slideText)
    }
    return cleanText(parts.join('\n\n'), 50000)
  }

  return cleanText(new TextDecoder('utf-8').decode(fileBytes), 50000)
}

function buildStudyCardContext(card: any): string {
  const parts: string[] = []
  if (card.summary) parts.push(`SUMMARY:\n${cleanText(card.summary, 7000)}`)
  if (Array.isArray(card.sections)) parts.push(`SECTIONS:\n${JSON.stringify(card.sections).slice(0, 5000)}`)
  if (Array.isArray(card.key_points)) parts.push(`KEY POINTS:\n${JSON.stringify(card.key_points).slice(0, 4000)}`)
  if (Array.isArray(card.key_terms)) parts.push(`KEY TERMS:\n${JSON.stringify(card.key_terms).slice(0, 4000)}`)
  if (Array.isArray(card.tables)) parts.push(`TABLES:\n${JSON.stringify(card.tables).slice(0, 3000)}`)
  if (Array.isArray(card.charts)) parts.push(`CHARTS:\n${JSON.stringify(card.charts).slice(0, 3000)}`)
  if (Array.isArray(card.formulas)) parts.push(`FORMULAS:\n${JSON.stringify(card.formulas).slice(0, 2500)}`)
  return parts.join('\n\n').slice(0, 24000)
}

async function callGroq(apiKey: string, systemPrompt: string, userPrompt: string) {
  let lastError = ''
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 40000)
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          temperature: 0.35,
          max_completion_tokens: 6000,
          reasoning_effort: 'low',
          include_reasoning: false,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })
      clearTimeout(timeoutId)
      const payload = await response.json()
      if (response.ok && payload?.choices?.[0]?.message?.content) return payload.choices[0].message.content as string
      lastError = cleanText(payload?.error?.message, 400)
      if (response.status !== 429 && response.status < 500) break
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error instanceof Error ? error.message : 'AI request failed'
    }
    await new Promise(resolve => setTimeout(resolve, 900 * (attempt + 1)))
  }
  console.error('generate-presentation Groq failure:', lastError)
  throw new Error('AI_SERVICE_UNAVAILABLE')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return respond({ error: 'Missing Authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const groqApiKey = Deno.env.get('GROQ_API_KEY') ?? ''
    if (!supabaseUrl || !supabaseAnonKey || !groqApiKey) {
      return respond({ error: 'AI service is not configured' }, 500)
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return respond({ error: 'Unauthorized user token' }, 401)

    const body = await req.json()
    const action = body?.action === 'improve_slide' ? 'improve_slide' : 'generate'
    const language = body?.language === 'en' ? 'en' : 'tr'
    const languageLabel = language === 'tr' ? 'Turkish' : 'English'

    if (action === 'improve_slide') {
      const presentationId = cleanText(body?.presentationId, 80)
      const instruction = cleanText(body?.instruction, 500)
      if (!presentationId || !instruction || !body?.slide) return respond({ error: 'Missing slide improvement parameters' }, 400)

      const { data: ownedPresentation } = await userClient
        .from('presentations')
        .select('id')
        .eq('id', presentationId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!ownedPresentation) return respond({ error: 'Presentation not found or access denied' }, 404)

      const inputSlide = normalizeSlide(body.slide, 0)
      const systemPrompt = `You are Acadia, an academic slide editor. Improve exactly one slide according to the student's instruction. Preserve factual meaning; never invent citations, statistics, authors, or research results. Reply only with a JSON object containing a "slide" object. The slide object must contain title, text, secondary_text, speaker_notes, and layout_type. Allowed layout_type values: title-content, two-column, image-left, image-right, chart, table. Write all output in ${languageLabel}. Keep slide text concise and put extra explanation in speaker_notes.`
      const raw = await callGroq(groqApiKey, systemPrompt, `INSTRUCTION:\n${instruction}\n\nCURRENT SLIDE:\n${JSON.stringify(inputSlide)}`)
      const parsed = parseModelJson(raw)
      const rawSlide = parsed.slide && typeof parsed.slide === 'object' ? parsed.slide : parsed
      return respond({ slide: normalizeSlide(rawSlide, 0) })
    }

    const sourceType = allowedSourceTypes.has(body?.sourceType) ? body.sourceType : 'topic'
    const sourceId = cleanText(body?.sourceId, 80)
    const topic = cleanText(body?.topic, 600)
    const courseTag = cleanText(body?.courseTag, 80)
    const slideCount = clampInteger(body?.slideCount, 4, 15, 8)
    if (sourceType === 'topic' && topic.length < 3) return respond({ error: 'A presentation topic is required' }, 400)
    if (sourceType !== 'topic' && !sourceId) return respond({ error: 'A source is required' }, 400)

    let sourceTitle = topic
    let sourceContext = topic
    if (sourceType === 'study_card') {
      const { data: card, error } = await userClient
        .from('study_cards')
        .select('summary, sections, key_points, key_terms, tables, charts, formulas, documents(file_name)')
        .eq('id', sourceId)
        .eq('user_id', user.id)
        .single()
      if (error || !card) return respond({ error: 'Study card not found or access denied' }, 404)
      sourceTitle = cleanText(card.documents?.file_name, 180) || 'Study Card'
      sourceContext = buildStudyCardContext(card)
      if (sourceContext.length < 20) return respond({ error: 'The selected study card does not contain enough material' }, 400)
    } else if (sourceType === 'document') {
      const { data: document, error } = await userClient
        .from('documents')
        .select('id, file_name, storage_path, mime_type')
        .eq('id', sourceId)
        .eq('user_id', user.id)
        .single()
      if (error || !document) return respond({ error: 'Document not found or access denied' }, 404)
      sourceTitle = cleanText(document.file_name, 180) || 'Document'
      sourceContext = await extractDocumentText(userClient, document)
      if (sourceContext.length < 20) return respond({ error: 'No readable text could be extracted from this document' }, 400)
    }

    const groundingRule = sourceType === 'topic'
      ? 'Use reliable general academic knowledge. Do not invent references, quotations, precise statistics, or named research findings.'
      : 'Use only facts supported by SOURCE MATERIAL. If the material does not support a detail, omit it.'
    const systemPrompt = `You are Acadia, the academic presentation generator inside Acadex. Create exactly ${slideCount} coherent slides in ${languageLabel}. ${groundingRule}\n\nReturn only one JSON object with this exact shape: {"title":"...","slides":[{"title":"...","text":"short bullet lines","secondary_text":"","speaker_notes":"presenter explanation","layout_type":"title-content"}]}.\n\nRules:\n- Exactly ${slideCount} slides, including opening and conclusion slides.\n- Each slide needs a specific title and concise presentation-ready content.\n- Use newline-separated bullets without Markdown tables or code fences.\n- Put detail, transitions, and caveats in speaker_notes.\n- Use two-column only when a real comparison helps; otherwise title-content.\n- Do not request or fabricate images.\n- Allowed layouts: title-content, two-column, image-left, image-right, chart, table.\n- Output valid JSON only.`
    const userPrompt = `SOURCE TYPE: ${sourceType}\nSOURCE TITLE: ${sourceTitle}\nCOURSE / TAG: ${courseTag || 'Not specified'}\n\nSOURCE MATERIAL:\n${sourceContext.slice(0, 50000)}`
    const raw = await callGroq(groqApiKey, systemPrompt, userPrompt)
    return respond({ presentation: normalizePresentation(parseModelJson(raw), slideCount) })
  } catch (error) {
    console.error('generate-presentation exception:', error)
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('INVALID_') || message === 'INCOMPLETE_PRESENTATION') {
      return respond({ error: 'AI returned an invalid presentation structure. Please try again.' }, 502)
    }
    if (message === 'AI_SERVICE_UNAVAILABLE') return respond({ error: 'AI service is busy. Please try again shortly.' }, 503)
    if (message === 'DOCUMENT_DOWNLOAD_FAILED') return respond({ error: 'The source document could not be downloaded.' }, 500)
    return respond({ error: 'Presentation generation failed' }, 500)
  }
})