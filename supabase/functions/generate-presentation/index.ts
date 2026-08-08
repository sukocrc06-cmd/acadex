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

const ADMIN_NOISE_PATTERNS = [
  /(?:öğretim\s*(?:üyesi|görevlisi)|ders\s*(?:sorumlusu|hocası)|prof\.?|doç\.?|dr\.?\s+[A-ZÇĞİÖŞÜ]|instructor|lecturer|professor|teaching assistant|assistant:)/i,
  /(?:e-?posta|email|@\w+|office\s*hours?|ofis\s*saati|room\s*\d+|oda\s*\d+)/i,
  /(?:ara\s*sınav|vize|final\s*sınav|midterm|final\s*exam|quiz|sınav\s*(?:oran|yüzde|ağırlık)|grading|grade\s*breakdown|%\s*\d+)/i,
  /(?:yoklama|devam\s*zorunlulu|katılım\s*bonus|attendance|participation\s*bonus|absence)/i,
  /(?:ders\s*programı|haftalık\s*program|course\s*schedule|weekly\s*schedule|class\s*hours?)/i,
  /(?:özgeçmiş|biyografi|biography|education:|eğitim:|mezun|university of|üniversitesi\s*[-–]\s*(?:lisans|yüksek lisans|ph\.?d|mba))/i,
  /(?:iletişim|contact|telefon|phone|linkedin)/i,
  /(?:kaynakça|zorunlu\s*kitap|required\s*textbook|recommended\s*reading)/i,
]

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
  return {
    title: cleanText(slide.title, 160) || `Slayt ${index + 1}`,
    content: {
      text: cleanText(slide.text ?? slide.content, 3500),
      secondary_text: cleanText(slide.secondary_text ?? slide.secondaryText, 2200),
    },
    speaker_notes: cleanText(slide.speaker_notes ?? slide.speakerNotes, 4000),
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
  if (rawSlides.length < Math.min(4, requestedCount)) throw new Error('INCOMPLETE_PRESENTATION')
  const slides = rawSlides.slice(0, requestedCount).map(normalizeSlide)
  return { title: cleanText(container.title, 160) || slides[0].title, slides }
}
function decodeXmlEntities(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}
function parsePptxSlideXml(slideXml: string): string {
  let text = ''
  for (const match of slideXml.matchAll(/<a:t>(.*?)<\/a:t>/g)) text += `${decodeXmlEntities(match[1])} `
  return text.trim()
}
function htmlToPlainText(html: string): string {
  return html.replace(/<\/(p|div|h[1-6])>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim()
}
async function extractDocumentText(userClient: any, document: any): Promise<string> {
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
    const slideFiles = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a,b) => Number(a.match(/\d+/)?.[0]||0)-Number(b.match(/\d+/)?.[0]||0))
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
  return parts.join('\n\n').slice(0, 18000)
}
function filterAdministrativeNoise(value: string): string {
  const lines = cleanText(value, 50000).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const kept = lines.filter(line => !ADMIN_NOISE_PATTERNS.some(pattern => pattern.test(line)))
  return kept.join('\n')
}
function scoreAcademicLine(line: string): number {
  let score = 0
  const text = line.toLowerCase()
  if (/(definition|tanım|concept|kavram|model|framework|theory|teori|process|süreç|strategy|strateji|segmentation|targeting|positioning|consumer|customer|market|pazarlama|value|değer|behavior|davranış)/i.test(text)) score += 4
  if (/(because|therefore|neden|sonuç|relationship|ilişki|compare|karşılaştır|example|örnek|case|vaka)/i.test(text)) score += 2
  if (line.length >= 45 && line.length <= 220) score += 1
  if (ADMIN_NOISE_PATTERNS.some(pattern => pattern.test(line))) score -= 20
  return score
}
function buildAcademicContext(value: string, maxLength = 6500): string {
  const filtered = filterAdministrativeNoise(value)
  const lines = filtered.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const ranked = lines.map((line, index) => ({ line, index, score: scoreAcademicLine(line) }))
    .sort((a,b) => b.score - a.score || a.index - b.index)
    .slice(0, 90)
    .sort((a,b) => a.index - b.index)
    .map(item => item.line)
  let result = ranked.join('\n')
  if (result.length < 1200) result = filtered
  if (result.length <= maxLength) return result
  const first = result.slice(0, Math.floor(maxLength * 0.35))
  const middleStart = Math.floor((result.length - Math.floor(maxLength * 0.3)) / 2)
  const middle = result.slice(middleStart, middleStart + Math.floor(maxLength * 0.3))
  const last = result.slice(result.length - Math.floor(maxLength * 0.35))
  return `${first}\n\n--- CORE MATERIAL CONTINUES ---\n\n${middle}\n\n--- CORE MATERIAL CONTINUES ---\n\n${last}`
}
function shrinkPromptForRetry(userPrompt: string): string {
  if (userPrompt.length <= 5000) return userPrompt
  const marker = 'SOURCE MATERIAL:\n'
  const idx = userPrompt.indexOf(marker)
  if (idx < 0) return userPrompt.slice(0, 5000)
  return userPrompt.slice(0, idx + marker.length) + buildAcademicContext(userPrompt.slice(idx + marker.length), 3200)
}
async function callGroq(apiKey: string, systemPrompt: string, userPrompt: string, maxCompletionTokens = 2600) {
  let lastError = ''
  let promptForAttempt = userPrompt
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b', temperature: 0.28, max_completion_tokens: maxCompletionTokens,
          reasoning_effort: 'low', include_reasoning: false, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: promptForAttempt }],
        }),
      })
      clearTimeout(timeoutId)
      const payload = await response.json()
      if (response.ok && payload?.choices?.[0]?.message?.content) return payload.choices[0].message.content as string
      lastError = cleanText(payload?.error?.message, 500)
      if (/too large|context|token|request size/i.test(lastError) && attempt < 2) {
        promptForAttempt = shrinkPromptForRetry(promptForAttempt)
        continue
      }
      if (response.status === 429 && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1800 * (attempt + 1)))
        continue
      }
      if (response.status < 500) break
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
    if (!supabaseUrl || !supabaseAnonKey || !groqApiKey) return respond({ error: 'AI service is not configured' }, 500)

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
      const { data: ownedPresentation } = await userClient.from('presentations').select('id').eq('id', presentationId).eq('user_id', user.id).maybeSingle()
      if (!ownedPresentation) return respond({ error: 'Presentation not found or access denied' }, 404)
      const inputSlide = normalizeSlide(body.slide, 0)
      const systemPrompt = `You are Acadia, an academic slide editor. Improve exactly one slide according to the student's instruction. Preserve factual meaning. Never invent citations, statistics, authors, or research results. Return JSON only with a slide object containing title, text, secondary_text, speaker_notes, layout_type. Write in ${languageLabel}.`
      const raw = await callGroq(groqApiKey, systemPrompt, `INSTRUCTION:\n${instruction}\n\nCURRENT SLIDE:\n${JSON.stringify(inputSlide)}`, 1200)
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
      const { data: card, error } = await userClient.from('study_cards').select('summary, sections, key_points, key_terms, documents(file_name)').eq('id', sourceId).eq('user_id', user.id).single()
      if (error || !card) return respond({ error: 'Study card not found or access denied' }, 404)
      sourceTitle = cleanText(card.documents?.file_name, 180) || 'Study Card'
      sourceContext = buildStudyCardContext(card)
    } else if (sourceType === 'document') {
      const { data: document, error } = await userClient.from('documents').select('id, file_name, storage_path, mime_type').eq('id', sourceId).eq('user_id', user.id).single()
      if (error || !document) return respond({ error: 'Document not found or access denied' }, 404)
      sourceTitle = cleanText(document.file_name, 180) || 'Document'
      sourceContext = await extractDocumentText(userClient, document)
    }
    if (sourceContext.length < 20) return respond({ error: 'No readable source content found' }, 400)

    const academicContext = sourceType === 'topic' ? sourceContext : buildAcademicContext(sourceContext, 6500)
    const groundingRule = sourceType === 'topic'
      ? 'Use reliable general academic knowledge and do not invent citations or precise statistics.'
      : 'Use only facts supported by SOURCE MATERIAL. Omit unsupported details.'

    const systemPrompt = `You are Acadia, a senior academic presentation director and visual storyteller. Create exactly ${slideCount} polished slides in ${languageLabel}. ${groundingRule}

Before writing, silently identify the learning goal, rank the most important concepts, and build a coherent narrative. Do NOT output that hidden planning.

STRICT CONTENT FILTER:
- Never create slides about instructor/professor names, biographies, degrees, assistants, emails, office hours, grading percentages, exams, attendance, course schedules, or administrative rules unless the USER TOPIC explicitly asks for them.
- Prioritize concepts, definitions that unlock understanding, frameworks, theories, processes, cause-effect relationships, comparisons, examples, cases, and meaningful quantitative evidence.
- Do not follow PDF page order mechanically.
- Ignore administrative percentages even if visually prominent in the source.

DESIGN RULES:
- Every slide must have a clear takeaway.
- Use 3-5 concise bullets maximum when bullets are appropriate.
- Use two-column for real comparisons; table for categorical comparisons; chart only when real numeric data exists in the source.
- Vary layouts; no more than 3 title-content slides.
- Opening slide frames the academic topic; final slide synthesizes key insights.
- Put deeper explanation in speaker_notes.
- Never fabricate numbers, citations, people, examples, or sources.

Return valid JSON only in this exact shape:
{"title":"...","slides":[{"title":"...","text":"...","secondary_text":"...","speaker_notes":"...","layout_type":"title-content|two-column|chart|table"}]}`

    const userPrompt = `SOURCE TYPE: ${sourceType}\nSOURCE TITLE: ${sourceTitle}\nCOURSE / TAG: ${courseTag || 'Not specified'}\nUSER TOPIC: ${topic || 'No extra topic supplied'}\n\nSOURCE MATERIAL:\n${academicContext}`
    const raw = await callGroq(groqApiKey, systemPrompt, userPrompt, 2600)
    return respond({ presentation: normalizePresentation(parseModelJson(raw), slideCount) })
  } catch (error) {
    console.error('generate-presentation exception:', error)
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('INVALID_') || message === 'INCOMPLETE_PRESENTATION') return respond({ error: 'AI returned an invalid presentation structure. Please try again.' }, 502)
    if (message === 'AI_SERVICE_UNAVAILABLE') return respond({ error: 'AI service is busy. Please try again shortly.' }, 503)
    if (message === 'DOCUMENT_DOWNLOAD_FAILED') return respond({ error: 'The source document could not be downloaded.' }, 500)
    return respond({ error: 'Presentation generation failed' }, 500)
  }
})