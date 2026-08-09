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
const allowedChartTypes = new Set(['bar', 'line', 'pie'])
const allowedDesignVariants = new Set(['hero', 'section', 'cards', 'process', 'timeline', 'big-number', 'comparison', 'data', 'summary'])
const allowedDiagramTypes = new Set(['flow', 'cycle', 'hierarchy', 'matrix', 'funnel'])
const allowedVisualPurposes = new Set(['hero', 'comparison', 'process', 'timeline', 'matrix', 'chart', 'table', 'cards', 'diagram', 'summary', 'section', 'big-number'])

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

function normalizeTable(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const table = value as Record<string, unknown>
  const headers = Array.isArray(table.headers) ? table.headers.slice(0, 6).map(item => cleanText(item, 90)).filter(Boolean) : []
  if (headers.length < 2) return null
  const rows = Array.isArray(table.rows)
    ? table.rows.slice(0, 8).map(row => Array.isArray(row) ? headers.map((_, index) => cleanText(row[index], 180)) : []).filter(row => row.length === headers.length)
    : []
  if (!rows.length) return null
  return { title: cleanText(table.title, 120), headers, rows }
}

function normalizeChart(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const chart = value as Record<string, unknown>
  const typeRaw = cleanText(chart.type, 20)
  const type = allowedChartTypes.has(typeRaw) ? typeRaw : 'bar'
  const labels = Array.isArray(chart.labels) ? chart.labels.slice(0, 10).map(item => cleanText(item, 80)).filter(Boolean) : []
  const data = Array.isArray(chart.data) ? chart.data.slice(0, labels.length).map(item => Number(item)) : []
  if (labels.length < 2 || data.length !== labels.length || data.some(item => !Number.isFinite(item))) return null
  const generic = labels.every((label, index) => new RegExp(`^(?:değer|deger|value|kategori|category)\\s*${index + 1}$`, 'i').test(label) || label === String(index + 1))
  if (generic) return null
  const seriesLabel = cleanText(chart.series_label, 60) || 'Değer'
  return { type, title: cleanText(chart.title, 120), series_label: seriesLabel, labels, data, datasets: [{ label: seriesLabel, data }], source_verified: true }
}

function normalizeCards(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 6).map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const row = item as Record<string, unknown>
    const title = cleanText(row.title, 90)
    const body = cleanText(row.body ?? row.text, 300)
    return title && body ? { title, body } : null
  }).filter(Boolean)
}

function normalizeSteps(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 7).map((item, index) => {
    if (typeof item === 'string') return { label: `${index + 1}`, title: cleanText(item, 100), body: '' }
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const row = item as Record<string, unknown>
    const title = cleanText(row.title, 110)
    if (!title) return null
    return { label: cleanText(row.label, 30) || `${index + 1}`, title, body: cleanText(row.body ?? row.text, 260) }
  }).filter(Boolean)
}

function normalizeMetric(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const metric = value as Record<string, unknown>
  const number = cleanText(metric.value ?? metric.number, 40)
  const label = cleanText(metric.label, 120)
  if (!number || !label) return null
  return { value: number, label, context: cleanText(metric.context, 260) }
}

function normalizeDiagram(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const diagram = value as Record<string, unknown>
  const rawType = cleanText(diagram.type, 20)
  const type = allowedDiagramTypes.has(rawType) ? rawType : 'flow'
  const nodes = Array.isArray(diagram.nodes)
    ? diagram.nodes.slice(0, 7).map(item => {
      if (typeof item === 'string') return { label: cleanText(item, 100), body: '' }
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const row = item as Record<string, unknown>
      const label = cleanText(row.label ?? row.title, 100)
      if (!label) return null
      return { label, body: cleanText(row.body ?? row.text, 240) }
    }).filter(Boolean)
    : []
  if (nodes.length < 2) return null
  return { type, title: cleanText(diagram.title, 120), nodes }
}

function normalizeSlide(value: unknown, index: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_SLIDE')
  const slide = value as Record<string, unknown>
  const rawLayout = cleanText(slide.layout_type ?? slide.layout, 30)
  let layout = allowedLayouts.has(rawLayout) ? rawLayout : 'title-content'
  const sourceContent = slide.content && typeof slide.content === 'object' && !Array.isArray(slide.content) ? slide.content as Record<string, unknown> : {}
  const table = normalizeTable(slide.table ?? sourceContent.table)
  const chart = normalizeChart(slide.chart ?? sourceContent.chart)
  const cards = normalizeCards(slide.cards ?? sourceContent.cards)
  const steps = normalizeSteps(slide.steps ?? sourceContent.steps)
  const metric = normalizeMetric(slide.metric ?? sourceContent.metric)
  const diagram = normalizeDiagram(slide.diagram ?? sourceContent.diagram)
  const rawVariant = cleanText(slide.design_variant ?? sourceContent.design_variant, 30)
  const designVariant = allowedDesignVariants.has(rawVariant) ? rawVariant : (index === 0 ? 'hero' : 'section')

  if (layout === 'table' && !table) layout = 'title-content'
  if (layout === 'chart' && !chart) layout = 'title-content'

  const content: Record<string, unknown> = {
    text: cleanText(slide.text ?? sourceContent.text ?? slide.content, 4200),
    secondary_text: cleanText(slide.secondary_text ?? slide.secondaryText ?? sourceContent.secondary_text, 2600),
    design_variant: designVariant,
  }
  if (table) content.table = table
  if (chart) content.chart = chart
  if (cards.length) content.cards = cards
  if (steps.length) content.steps = steps
  if (metric) content.metric = metric
  if (diagram) content.diagram = diagram

  // Director metadata (optional, stored in content for editor/export)
  const purpose = cleanText(slide.purpose ?? sourceContent.purpose, 240)
  const message = cleanText(slide.message ?? sourceContent.message, 280)
  const visualPurposeRaw = cleanText(slide.visual_purpose ?? slide.visualPurpose ?? sourceContent.visual_purpose, 30)
  if (purpose) content.purpose = purpose
  if (message) content.message = message
  if (allowedVisualPurposes.has(visualPurposeRaw)) content.visual_purpose = visualPurposeRaw

  // Early leakage strip on visible fields
  content.text = stripInstructionLeakage(String(content.text || ''))
  content.secondary_text = stripInstructionLeakage(String(content.secondary_text || ''))

  const built = {
    title: cleanText(slide.title, 160) || `Slayt ${index + 1}`,
    content,
    speaker_notes: stripInstructionLeakage(cleanText(slide.speaker_notes ?? slide.speakerNotes, 5200)),
    layout_type: layout,
    image_url: null,
    image_position: layout === 'image-left' ? 'left' : 'right',
  }
  return applyQualityGate(built)
}
function normalizePresentation(value: Record<string, unknown>, requestedCount: number) {
  const container = value.presentation && typeof value.presentation === 'object' && !Array.isArray(value.presentation) ? value.presentation as Record<string, unknown> : value
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
  return lines.filter(line => !ADMIN_NOISE_PATTERNS.some(pattern => pattern.test(line))).join('\n')
}
function scoreAcademicLine(line: string): number {
  let score = 0
  const text = line.toLowerCase()
  if (/(definition|tanım|concept|kavram|model|framework|theory|teori|process|süreç|strategy|strateji|segmentation|targeting|positioning|consumer|customer|market|pazarlama|value|değer|behavior|davranış|risk|investment|yatırım|diet|diyet|nutrition|beslenme)/i.test(text)) score += 4
  if (/(because|therefore|neden|sonuç|relationship|ilişki|compare|karşılaştır|example|örnek|case|vaka|advantage|dezavantaj|benefit|fayda)/i.test(text)) score += 2
  if (/\d/.test(line) && !/%\s*\d+\s*(?:exam|sınav)/i.test(line)) score += 1
  if (line.length >= 45 && line.length <= 240) score += 1
  if (ADMIN_NOISE_PATTERNS.some(pattern => pattern.test(line))) score -= 20
  return score
}
function buildAcademicContext(value: string, maxLength = 7000): string {
  const filtered = filterAdministrativeNoise(value)
  const lines = filtered.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const ranked = lines.map((line, index) => ({ line, index, score: scoreAcademicLine(line) }))
    .sort((a,b) => b.score - a.score || a.index - b.index).slice(0, 100).sort((a,b) => a.index - b.index).map(item => item.line)
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
async function callGroq(apiKey: string, systemPrompt: string, userPrompt: string, maxCompletionTokens = 3600) {
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
          model: 'openai/gpt-oss-120b', temperature: 0.22, max_completion_tokens: maxCompletionTokens,
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


// Instruction leakage: AI meta-instructions must never appear in student-facing text
const LEAKAGE_PATTERNS: RegExp[] = [
  /(?:matriks|matrix)\s*(?:diyagramı|diyagram|diagram)?\s*(?:kullan(?:ın|in)|oluştur(?:un)?|ekle(?:yin)?)/i,
  /(?:grafik|chart|tablo|table)\s*(?:oluştur(?:un)?|ekle(?:yin)?|kullan(?:ın|in))/i,
  /(?:trendleri|trends?)\s*(?:açıkla(?:yın)?|explain)/i,
  /(?:tartışma\s*sorusu|discussion\s*question)\s*(?:ekle(?:yin)?|add)/i,
  /(?:öğrencilere\s*(?:sorun|soru)|ask\s*(?:the\s*)?students?)/i,
  /(?:slayta?\s*(?:ekle|yaz|koy)|add\s*(?:to\s*)?(?:the\s*)?slide)/i,
  /(?:görsel\s*(?:görev|amaç)|visual\s*purpose)\s*[:=]/i,
  /(?:design[_\s-]?variant|layout[_\s-]?type)\s*[:=]/i,
  /(?:use\s+(?:a\s+)?(?:matrix|chart|table|diagram|timeline|funnel))/i,
  /(?:create\s+(?:a\s+)?(?:chart|table|diagram|matrix))/i,
  /(?:include\s+(?:a\s+)?(?:chart|table|diagram|bullet))/i,
  /(?:do\s+not\s+(?:invent|fabricate)|asla\s+uydurma)/i,
  /(?:return\s+valid\s+json|json\s+only)/i,
  /(?:speaker[_\s-]?notes?\s*[:=]|konuşma\s*notları\s*[:=])/i,
  /^\s*(?:note|not|instruction|talimat|prompt)\s*:\s*/i,
]

function stripInstructionLeakage(value: string): string {
  if (!value) return ''
  const lines = value.split(/\r?\n/)
  const kept = lines.filter(line => {
    const t = line.trim()
    if (!t) return true
    return !LEAKAGE_PATTERNS.some(p => p.test(t))
  })
  // Also strip inline leakage phrases inside kept lines
  return kept
    .map(line => line
      .replace(/\((?:use|kullan)\s+(?:a\s+)?(?:matrix|chart|table|diagram)[^)]*\)/gi, '')
      .replace(/\b(?:use|kullan)\s+(?:a\s+)?(?:matrix|chart|table|diagram)\b[^.!?\n]*/gi, '')
      .trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function isGenericChartLabels(labels: string[]): boolean {
  if (!labels.length) return true
  return labels.every((label, index) => {
    const n = index + 1
    return new RegExp(`^(?:değer|deger|value|kategori|category|item|öğe|oge)\\s*${n}$`, 'i').test(label)
      || label === String(n)
      || /^[A-Z]$/.test(label)
  })
}

/** Quality Gate (minimal): leakage strip + generic chart kill + layout repair */
function applyQualityGate(slide: ReturnType<typeof normalizeSlide>): ReturnType<typeof normalizeSlide> {
  const content = { ...(slide.content as Record<string, unknown>) }
  content.text = stripInstructionLeakage(String(content.text || ''))
  content.secondary_text = stripInstructionLeakage(String(content.secondary_text || ''))

  // Kill generic / fake charts
  const chart = content.chart as { labels?: string[] } | undefined
  if (chart && Array.isArray(chart.labels) && isGenericChartLabels(chart.labels.map(String))) {
    delete content.chart
    if (slide.layout_type === 'chart') slide.layout_type = 'title-content'
  }

  // If layout claims chart/table but data missing, fall back
  if (slide.layout_type === 'chart' && !content.chart) slide.layout_type = 'title-content'
  if (slide.layout_type === 'table' && !content.table) slide.layout_type = 'title-content'

  // Empty text after leakage strip → keep a minimal safe placeholder only if visual exists
  if (!String(content.text || '').trim() && (content.table || content.chart || content.cards || content.steps || content.diagram || content.metric)) {
    content.text = ''
  }

  slide.content = content
  slide.speaker_notes = stripInstructionLeakage(slide.speaker_notes)
  return slide
}

function normalizePlan(value: Record<string, unknown>, requestedCount: number) {
  const container = value.plan && typeof value.plan === 'object' && !Array.isArray(value.plan)
    ? value.plan as Record<string, unknown>
    : value
  const rawSlides = Array.isArray(container.slides) ? container.slides : []
  if (rawSlides.length < Math.min(4, requestedCount)) throw new Error('INCOMPLETE_PLAN')
  const slides = rawSlides.slice(0, requestedCount).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('INVALID_PLAN_SLIDE')
    const row = item as Record<string, unknown>
    const visualRaw = cleanText(row.visual_purpose ?? row.visualPurpose, 30)
    const visual_purpose = allowedVisualPurposes.has(visualRaw) ? visualRaw : (index === 0 ? 'hero' : index === requestedCount - 1 ? 'summary' : 'section')
    return {
      title: cleanText(row.title, 160) || `Slayt ${index + 1}`,
      purpose: cleanText(row.purpose, 240) || 'Explain a core academic idea',
      message: cleanText(row.message, 280) || cleanText(row.title, 160),
      visual_purpose,
    }
  })
  // Enforce rhythm: first hero, last summary
  if (slides.length) {
    slides[0].visual_purpose = 'hero'
    slides[slides.length - 1].visual_purpose = 'summary'
  }
  return {
    purpose: cleanText(container.purpose, 400) || 'Teach the core academic concepts clearly',
    audience: cleanText(container.audience, 200) || 'University students',
    main_message: cleanText(container.main_message ?? container.mainMessage, 400) || slides[0]?.message || '',
    narrative_arc: cleanText(container.narrative_arc ?? container.narrativeArc, 500),
    slides,
  }
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
      const systemPrompt = `You are Acadia, an academic slide editor and information designer. Improve exactly one slide according to the student's instruction. Preserve factual meaning and valid structured visual data unless explicitly changed. Visible text must remain present even when a visual is used. Never invent citations, statistics, authors, people, or research results. Return JSON only with a slide object containing title, text, secondary_text, speaker_notes, layout_type, design_variant, and optional chart/table/cards/steps/metric/diagram. Write in ${languageLabel}.`
      const raw = await callGroq(groqApiKey, systemPrompt, `INSTRUCTION:\n${instruction}\n\nCURRENT SLIDE:\n${JSON.stringify(inputSlide)}`, 1800)
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

    const academicContext = sourceType === 'topic' ? sourceContext : buildAcademicContext(sourceContext, 7200)
    const groundingRule = sourceType === 'topic'
      ? 'Use reliable general academic knowledge. Do not invent citations, named studies, people, or precise statistics.'
      : 'Use source facts for factual claims. You may add simple pedagogical examples only when clearly presented as an illustrative example, never as a sourced fact.'

    const sourceHeader = `SOURCE TYPE: ${sourceType}\nSOURCE TITLE: ${sourceTitle}\nCOURSE / TAG: ${courseTag || 'Not specified'}\nUSER TOPIC: ${topic || 'No extra topic supplied'}`

    // ═══════════════════════════════════════════════════════════
    // STAGE A — Presentation Director V8: story + slide plan only
    // ═══════════════════════════════════════════════════════════
    const planSystemPrompt = `You are Acadia Presentation Director V8. You do NOT write slide body content yet.
Your only job: design a coherent academic presentation PLAN in ${languageLabel}.

${groundingRule}

RULES
- Do NOT follow PDF page order mechanically. Build a teaching narrative.
- Recommended arc: problem/context → core concepts → analysis → comparison → example/application → conclusion → decision/recommendation.
- Never plan slides about instructor names, biographies, emails, office hours, grading %, exams, attendance, or course schedules unless USER TOPIC explicitly asks.
- Exactly ${slideCount} slides.
- Slide 1 visual_purpose MUST be "hero". Final slide MUST be "summary".
- Each slide needs: title, purpose (why this slide exists), message (one-sentence takeaway), visual_purpose.
- visual_purpose must be one of: hero, section, comparison, process, timeline, matrix, chart, table, cards, diagram, big-number, summary.
- Assign visual_purpose from content structure, not from title keywords.
- Prefer diagram/process/cards/matrix over chart when numbers are absent.
- chart only when exact numeric evidence exists in the source.
- Avoid assigning the same visual_purpose to more than 3 slides.
- Do not place more than two plain "section" slides consecutively.

RETURN VALID JSON ONLY:
{
  "purpose":"overall learning goal",
  "audience":"who this is for",
  "main_message":"single thesis of the deck",
  "narrative_arc":"one-line story spine",
  "slides":[
    {"title":"...","purpose":"...","message":"...","visual_purpose":"hero|section|comparison|process|timeline|matrix|chart|table|cards|diagram|big-number|summary"}
  ]
}`

    const planUserPrompt = `${sourceHeader}\n\nSOURCE MATERIAL:\n${academicContext}`
    const planRaw = await callGroq(groqApiKey, planSystemPrompt, planUserPrompt, 1800)
    const plan = normalizePlan(parseModelJson(planRaw), slideCount)

    // ═══════════════════════════════════════════════════════════
    // STAGE B — Content production from the locked plan
    // ═══════════════════════════════════════════════════════════
    const contentSystemPrompt = `You are Acadia, academic content writer and visual composer. Write the FULL slide content for an already-approved presentation plan in ${languageLabel}.
${groundingRule}

CRITICAL — NO INSTRUCTION LEAKAGE
- Never write meta-instructions into title, text, secondary_text, or speaker_notes.
- Forbidden in visible fields: "use a matrix", "create a chart", "add discussion question", "matriks kullanın", "grafik oluştur", "trendleri açıklayın", design_variant labels, layout orders.
- Output ONLY student-facing academic content.

VISIBLE CONTENT
- A visual NEVER replaces the explanation.
- Every non-hero slide needs meaningful "text": normally 3-5 concise teaching bullets.
- If chart/table/diagram/cards/process is used, keep explanatory text too.
- Prefer 45-90 visible words on concept-heavy slides.
- Do not repeat the same fact as both bullets AND an identical table/card row.

SPEAKER NOTES (Speaker Coach mini)
- 70-130 words per slide.
- Structure: opening line → main explanation → one example or caution → transition to next idea.
- Do not copy visible bullets verbatim.

VISUAL OBJECTS (only when plan.visual_purpose requires them)
- cards → cards:[{title,body}] (3-5)
- process / timeline → steps:[{label,title,body}]
- comparison → two-column text/secondary_text and/or table
- chart → ONLY exact source numbers; labels must be real categories (never "Değer 1")
- table → multi-attribute comparison matrix
- diagram → {type: flow|cycle|hierarchy|matrix|funnel, nodes:[{label,body}]}
- big-number → metric:{value,label,context}
- hero / summary / section → usually text only

LAYOUT RULES
- hero, section, cards, process, timeline, big-number, summary, diagram → layout_type title-content
- comparison → two-column (or table if multi-attribute)
- chart visual_purpose with real data → layout_type chart
- matrix/table visual_purpose → layout_type table
- design_variant should mirror visual_purpose (hero|section|cards|process|timeline|big-number|comparison|data|summary)

Return JSON:
{
  "title":"deck title",
  "slides":[{
    "title":"...",
    "purpose":"from plan",
    "message":"from plan",
    "visual_purpose":"from plan",
    "text":"• ...\\n• ...",
    "secondary_text":"...",
    "speaker_notes":"...",
    "layout_type":"title-content|two-column|chart|table",
    "design_variant":"hero|section|cards|process|timeline|big-number|comparison|data|summary",
    "cards":[{"title":"...","body":"..."}],
    "steps":[{"label":"...","title":"...","body":"..."}],
    "metric":{"value":"...","label":"...","context":"..."},
    "chart":{"type":"bar|line|pie","title":"...","series_label":"...","labels":["..."],"data":[1,2]},
    "table":{"title":"...","headers":["...","..."],"rows":[["...","..."]]},
    "diagram":{"type":"flow|cycle|hierarchy|matrix|funnel","title":"...","nodes":[{"label":"...","body":"..."}]}
  }]
}
Omit unused structured objects. Exactly ${plan.slides.length} slides in the same order as the plan.`

    const contentUserPrompt = `${sourceHeader}

APPROVED PLAN (follow titles, purpose, message, visual_purpose exactly; do not reorder):
${JSON.stringify(plan, null, 2)}

SOURCE MATERIAL:
${academicContext}`

    const contentRaw = await callGroq(groqApiKey, contentSystemPrompt, contentUserPrompt, 4200)
    const presentation = normalizePresentation(parseModelJson(contentRaw), slideCount)

    // Final quality pass already runs inside normalizeSlide → applyQualityGate
    return respond({
      presentation,
      director: {
        version: 'v8',
        purpose: plan.purpose,
        audience: plan.audience,
        main_message: plan.main_message,
        narrative_arc: plan.narrative_arc,
        plan_slides: plan.slides,
      },
    })
  } catch (error) {
    console.error('generate-presentation exception:', error)
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('INVALID_') || message === 'INCOMPLETE_PRESENTATION' || message === 'INCOMPLETE_PLAN') return respond({ error: 'AI returned an invalid presentation structure. Please try again.' }, 502)
    if (message === 'AI_SERVICE_UNAVAILABLE') return respond({ error: 'AI service is busy. Please try again shortly.' }, 503)
    if (message === 'DOCUMENT_DOWNLOAD_FAILED') return respond({ error: 'The source document could not be downloaded.' }, 500)
    return respond({ error: 'Presentation generation failed' }, 500)
  }
})