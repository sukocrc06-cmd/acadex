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

/** Repair truncated / messy model JSON so partial decks still parse */
function repairJsonText(raw: string): string {
  let s = stripCodeFence(raw)
  // extract first {...} block if surrounding junk
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  // trailing commas
  s = s.replace(/,\s*([}\]])/g, '$1')
  // if truncated mid-slides array, close open structures
  if (!s.trim().endsWith('}')) {
    // close open strings roughly
    const q = (s.match(/"/g) || []).length
    if (q % 2 === 1) s += '"'
    // close brackets
    const opens = (s.match(/\[/g) || []).length
    const closes = (s.match(/\]/g) || []).length
    for (let i = 0; i < opens - closes; i++) s += ']'
    const o2 = (s.match(/\{/g) || []).length
    const c2 = (s.match(/\}/g) || []).length
    for (let i = 0; i < o2 - c2; i++) s += '}'
  }
  return s
}

function parseModelJson(raw: string): Record<string, unknown> {
  const attempts = [stripCodeFence(raw), repairJsonText(raw)]
  let lastErr: unknown = null
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
      return parsed as Record<string, unknown>
    } catch (e) {
      lastErr = e
    }
  }
  // Last resort: pull slides array fragment
  try {
    const repaired = repairJsonText(raw)
    const slidesMatch = repaired.match(/"slides"\s*:\s*\[([\s\S]*)/)
    if (slidesMatch) {
      let arr = '[' + slidesMatch[1]
      // cut after last complete }
      const lastObj = arr.lastIndexOf('}')
      if (lastObj > 0) arr = arr.slice(0, lastObj + 1) + ']'
      const opens = (arr.match(/\[/g) || []).length
      const closes = (arr.match(/\]/g) || []).length
      for (let i = 0; i < opens - closes; i++) arr += ']'
      const slides = JSON.parse(arr)
      if (Array.isArray(slides) && slides.length) return { title: 'Akademik Sunum', slides }
    }
  } catch (e) {
    lastErr = e
  }
  console.error('parseModelJson failed:', lastErr)
  throw new Error('INVALID_AI_JSON')
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
  // Accept if we got at least the requested count, or >= 80% and at least 4 (token-truncation edge)
  // Accept any deck with at least 4 slides; shortfall is fixed by topUpSlides
  if (rawSlides.length < 4) throw new Error('INCOMPLETE_PRESENTATION')
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
async function callGroq(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxCompletionTokens = 2400,
  timeoutMs = 55000,
  model = 'openai/gpt-oss-120b',
) {
  // Free/on_demand TPM is tight (~8k). Never request huge completion budgets.
  const safeMaxTokens = Math.min(Math.max(400, maxCompletionTokens), 2800)
  let lastError = ''
  let promptForAttempt = userPrompt
  let modelForAttempt = model

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelForAttempt,
          temperature: 0.22,
          max_completion_tokens: safeMaxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptForAttempt },
          ],
        }),
      })
      clearTimeout(timeoutId)
      const payload = await response.json()
      if (response.ok && payload?.choices?.[0]?.message?.content) {
        return payload.choices[0].message.content as string
      }
      lastError = cleanText(payload?.error?.message, 600)

      // Rate limit: honor "try again in Xs" and optionally switch to smaller model
      if (response.status === 429 && attempt < 3) {
        const waitMatch = lastError.match(/try again in\s*([\d.]+)\s*s/i)
        const waitMs = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 800 : 8000 * (attempt + 1)
        console.warn(`Groq 429 — waiting ${waitMs}ms (attempt ${attempt + 1})`)
        await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 25000)))
        // Stay on gpt-oss-120b (20b fails json_object mode). Only shrink prompt.
        promptForAttempt = shrinkPromptForRetry(promptForAttempt)
        continue
      }
      // json_validate_failed → shrink and retry same model (do not switch to 20b)
      if (/json_validate_failed|Failed to validate JSON|invalid_request/i.test(lastError) && attempt < 3) {
        promptForAttempt = shrinkPromptForRetry(promptForAttempt)
        await new Promise(resolve => setTimeout(resolve, 1500))
        continue
      }

      if (/too large|context|token|request size|maximum context/i.test(lastError) && attempt < 3) {
        promptForAttempt = shrinkPromptForRetry(promptForAttempt)
        continue
      }
      if (response.status < 500) break
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error instanceof Error ? error.message : 'AI request failed'
    }
    await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)))
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
  const minAccept = Math.max(4, Math.ceil(requestedCount * 0.8))
  if (rawSlides.length < minAccept) throw new Error('INCOMPLETE_PLAN')
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


/** If AI returned fewer slides than requested, top-up missing ones with a focused call */
async function topUpSlides(
  apiKey: string,
  existing: ReturnType<typeof normalizePresentation>,
  requestedCount: number,
  languageLabel: string,
  groundingRule: string,
  sourceHeader: string,
  academicContext: string,
): Promise<ReturnType<typeof normalizePresentation>> {
  if (existing.slides.length >= requestedCount) return existing
  const missing = requestedCount - existing.slides.length
  const titlesSoFar = existing.slides.map((s, i) => `${i + 1}. ${s.title}`).join('\n')
  const system = `You are Acadia. Generate exactly ${missing} ADDITIONAL academic slides in ${languageLabel} to complete a ${requestedCount}-slide deck.
${groundingRule}
Existing slides (do NOT repeat these topics):
${titlesSoFar}
Return JSON only: {"slides":[{...same slide schema as full presentation, with title,text,speaker_notes,layout_type,design_variant,optional visuals...}]}
Last of the new slides should be a strong summary/conclusion if the deck does not already end with one.
No instruction leakage in text/notes.`
  const user = `${sourceHeader}\n\nSOURCE MATERIAL:\n${academicContext}\n\nGenerate ${missing} new slides continuing the narrative after the existing ones.`
  try {
    const raw = await callGroq(apiKey, system, user, Math.min(1800, 250 * missing + 500), 45000, 'openai/gpt-oss-120b')
    const parsed = parseModelJson(raw)
    const extraRaw = Array.isArray(parsed.slides) ? parsed.slides : []
    const extra = extraRaw.slice(0, missing).map((item, idx) => normalizeSlide(item, existing.slides.length + idx))
    const merged = {
      title: existing.title,
      slides: [...existing.slides, ...extra].slice(0, requestedCount),
    }
    // Ensure last is summary-ish if we filled to full count
    if (merged.slides.length === requestedCount) {
      const last = merged.slides[merged.slides.length - 1]
      const c = last.content as Record<string, unknown>
      if (c && !c.design_variant) c.design_variant = 'summary'
    }
    return merged
  } catch (e) {
    console.error('topUpSlides failed:', e)
    return existing
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
    const slideCount = clampInteger(body?.slideCount, 5, 15, 8)
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

    const academicContext = sourceType === 'topic'
      ? cleanText(sourceContext, 3500)
      : buildAcademicContext(sourceContext, 4500)
    const groundingRule = sourceType === 'topic'
      ? 'Use reliable general academic knowledge. Do not invent citations, named studies, people, or precise statistics.'
      : 'Use source facts for factual claims. You may add simple pedagogical examples only when clearly presented as an illustrative example, never as a sourced fact.'

    const sourceHeader = `SOURCE TYPE: ${sourceType}\nSOURCE TITLE: ${sourceTitle}\nCOURSE / TAG: ${courseTag || 'Not specified'}\nUSER TOPIC: ${topic || 'No extra topic supplied'}`

    // ═══════════════════════════════════════════════════════════
    // Director V8 — try plan→content; fall back to single-shot on failure
    // ═══════════════════════════════════════════════════════════
    // Token budget for free-tier TPM (~8k/min). One primary call only.
    const completionBudget = Math.min(2800, 350 + slideCount * 200)

    const systemPrompt = `You are Acadia, Presentation Director V8 + visual composer. Produce EXACTLY ${slideCount} academic slides in ${languageLabel}. The slides array MUST contain ${slideCount} items — not fewer.
${groundingRule}

NARRATIVE ARC (do not follow PDF page order):
problem/context → core concepts → analysis → comparison → example/application → risks → practical steps → conclusion → decision.

FORBIDDEN SLIDES: instructor names, bios, emails, office hours, grading %, attendance, course schedules.

NO INSTRUCTION LEAKAGE: never write meta text like "use a matrix", "create a chart", "matriks kullanın", "grafik oluştur", "add discussion question" into title, text, or speaker_notes.

EACH SLIDE MUST INCLUDE:
- title, purpose (why this slide), message (one-line takeaway), visual_purpose
- text: 3-5 real teaching bullets on non-hero slides (visuals never replace explanation)
- speaker_notes: 40-70 words — opening → key point → transition
- layout_type + design_variant

visual_purpose values: hero | section | comparison | process | timeline | matrix | chart | table | cards | diagram | big-number | summary
- Slide 1 = hero, last = summary
- chart/metric ONLY with real numbers (never "Değer 1/2/3")
- Prefer cards/process/diagram/table when qualitative
- Do not use the same design_variant more than 3 times; no more than 2 plain section slides in a row

STRUCTURED OBJECTS when useful:
cards:[{title,body}] steps:[{label,title,body}] metric:{value,label,context}
chart:{type,title,series_label,labels,data} table:{title,headers,rows}
diagram:{type:flow|cycle|hierarchy|matrix|funnel,title,nodes:[{label,body}]}

layout_type: title-content | two-column | chart | table
design_variant: hero|section|cards|process|timeline|big-number|comparison|data|summary

Return JSON only:
{"title":"...","slides":[{"title":"...","purpose":"...","message":"...","visual_purpose":"...","text":"• ...\\n• ...","secondary_text":"...","speaker_notes":"...","layout_type":"...","design_variant":"...","cards":[],"steps":[],"metric":null,"chart":null,"table":null,"diagram":null}]}
Omit null/empty structured fields. EXACTLY ${slideCount} slides.`

    const userPrompt = `${sourceHeader}\n\nSOURCE MATERIAL:\n${academicContext}`

    let presentation: ReturnType<typeof normalizePresentation>
    let director: Record<string, unknown> = { version: 'v8', mode: 'single_shot_director' }

    try {
      const raw = await callGroq(groqApiKey, systemPrompt, userPrompt, completionBudget, 55000)
      presentation = normalizePresentation(parseModelJson(raw), slideCount)
    } catch (firstError) {
      console.error('Primary generation failed, retrying compact on 120b:', firstError)
      await new Promise(r => setTimeout(r, 5000)) // TPM cooldown
      const compactContext = typeof academicContext === 'string'
        ? academicContext.slice(0, 2500)
        : buildAcademicContext(String(academicContext || ''), 2500)
      const compactPrompt = `You are Acadia. Return JSON with title and EXACTLY ${slideCount} slides in ${languageLabel}.
Each slide: title, text (3-5 bullets), speaker_notes, layout_type (title-content|two-column|chart|table), design_variant (hero|section|cards|process|summary|comparison).
Slide 1 hero, last summary. No meta-instructions in text. ${groundingRule}
JSON: {"title":"...","slides":[{"title":"...","text":"...","speaker_notes":"...","layout_type":"title-content","design_variant":"section"}]}`
      const raw = await callGroq(
        groqApiKey,
        compactPrompt,
        `${sourceHeader}\n\nSOURCE MATERIAL:\n${compactContext}`,
        Math.min(2400, completionBudget),
        55000,
        'openai/gpt-oss-120b',
      )
      presentation = normalizePresentation(parseModelJson(raw), slideCount)
      director = { version: 'v8', mode: 'compact_120b_fallback' }
    }

    // Top-up only if short — small budget, after a brief pause (TPM recovery)
    if (presentation.slides.length < slideCount) {
      console.warn(`Short deck: ${presentation.slides.length}/${slideCount} — top-up`)
      await new Promise(r => setTimeout(r, 3000))
      presentation = await topUpSlides(
        groqApiKey, presentation, slideCount, languageLabel, groundingRule, sourceHeader,
        buildAcademicContext(academicContext, 2500),
      )
    }

    return respond({
      presentation,
      director: {
        ...director,
        requested_slide_count: slideCount,
        delivered_slide_count: presentation.slides.length,
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