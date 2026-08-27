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
const allowedSourceTypes = new Set(['topic', 'study_card', 'document'])
const allowedModes = new Set(['academic', 'thesis_defense', 'research', 'lecture', 'business'])
const allowedLayouts = new Set(['title-content', 'two-column', 'image-left', 'image-right', 'chart', 'table'])
const allowedVariants = new Set(['hero', 'section', 'cards', 'process', 'timeline', 'big-number', 'comparison', 'data', 'summary'])
const allowedVisuals = new Set(['hero', 'section', 'cards', 'process', 'timeline', 'comparison', 'table', 'chart', 'diagram', 'big-number', 'summary'])
const allowedChartTypes = new Set(['bar', 'line', 'pie'])
const allowedDiagramTypes = new Set(['flow', 'cycle', 'hierarchy', 'matrix', 'funnel'])

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}
function cleanText(value: unknown, maxLength = 10000): string {
  if (value == null) return ''
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r/g, '')
    .trim()
    .slice(0, maxLength)
}
function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
}
function stripFence(value: string) {
  return value.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}
function repairJson(raw: string): string {
  let text = stripFence(raw)
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first >= 0 && last > first) text = text.slice(first, last + 1)
  text = text.replace(/,\s*([}\]])/g, '$1')
  if (!text.endsWith('}')) {
    if ((text.match(/"/g) || []).length % 2 === 1) text += '"'
    for (let i = (text.match(/\[/g) || []).length - (text.match(/\]/g) || []).length; i > 0; i--) text += ']'
    for (let i = (text.match(/\{/g) || []).length - (text.match(/\}/g) || []).length; i > 0; i--) text += '}'
  }
  return text
}
function parseJson(raw: string): Record<string, unknown> {
  for (const candidate of [stripFence(raw), repairJson(raw)]) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch (_) {}
  }
  throw new Error('INVALID_AI_JSON')
}
function jsonText(value: unknown, maxLength = 5000) {
  try { return cleanText(JSON.stringify(value), maxLength) } catch (_) { return '' }
}
function decodeXmlEntities(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}
function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
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
  const { data: fileBlob, error } = await userClient.storage.from('documents').download(document.storage_path)
  if (error || !fileBlob) throw new Error('DOCUMENT_DOWNLOAD_FAILED')
  const bytes = new Uint8Array(await fileBlob.arrayBuffer())
  const mime = cleanText(document.mime_type, 180).toLowerCase()
  if (mime === 'application/pdf') {
    const pdf = await getDocumentProxy(bytes)
    const { text } = await extractText(pdf, { mergePages: true })
    return cleanText(text, 70000)
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const result = await mammoth.convertToHtml({ buffer: bytes })
      return cleanText(htmlToPlainText(result.value || ''), 70000)
    } catch (_) {
      const result = await mammoth.extractRawText({ buffer: bytes })
      return cleanText(result.value || '', 70000)
    }
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    const zip = await JSZip.loadAsync(bytes)
    const names = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1] || 0) - Number(b.match(/slide(\d+)/i)?.[1] || 0))
    const parts: string[] = []
    for (const name of names.slice(0, 160)) {
      const xml = await zip.files[name].async('string')
      const text = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map(match => decodeXmlEntities(match[1])).join(' ')
      if (text.trim()) parts.push(text.trim())
    }
    return cleanText(parts.join('\n\n'), 70000)
  }
  try { return cleanText(new TextDecoder().decode(bytes), 70000) } catch (_) { return '' }
}

function buildStudyCardContext(card: Record<string, unknown>): string {
  const fields = ['summary', 'sections', 'key_points', 'key_terms', 'tables', 'charts', 'formulas', 'quiz_questions', 'visual_analysis']
  const parts: string[] = []
  for (const field of fields) {
    const value = card[field]
    if (value == null || value === '') continue
    const rendered = typeof value === 'string' ? cleanText(value, 14000) : jsonText(value, 14000)
    if (rendered) parts.push(`${field.toUpperCase()}:\n${rendered}`)
  }
  return cleanText(parts.join('\n\n'), 70000)
}

type SourceChunk = { id: string; text: string; locator: Record<string, unknown>; score?: number }
type SourceBundle = { sourceType: string; sourceId: string | null; title: string; context: string; chunks: SourceChunk[] }

function tokenize(value: string): string[] {
  const stop = new Set(['ve','veya','ile','bir','bu','şu','için','olan','olarak','the','and','for','with','that','this','from','into','are','is','to','of','in','on'])
  return value.toLocaleLowerCase('tr-TR').match(/[a-zçğıöşü0-9]{3,}/gi)?.filter(x => !stop.has(x)) || []
}
function chunkSource(context: string): SourceChunk[] {
  const paragraphs = context.split(/\n{2,}/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const chunks: SourceChunk[] = []
  let buffer = ''
  const flush = () => {
    if (!buffer.trim()) return
    chunks.push({ id: `C${String(chunks.length + 1).padStart(2, '0')}`, text: buffer.trim().slice(0, 900), locator: { chunk: chunks.length + 1 } })
    buffer = ''
  }
  for (const p of paragraphs) {
    if ((buffer + ' ' + p).length > 850) flush()
    if (p.length > 850) {
      for (let i = 0; i < p.length; i += 820) {
        buffer = p.slice(i, i + 820)
        flush()
      }
    } else {
      buffer += `${buffer ? ' ' : ''}${p}`
    }
  }
  flush()
  if (!chunks.length && context.trim()) chunks.push({ id: 'C01', text: context.slice(0, 850), locator: { chunk: 1 } })
  return chunks.slice(0, 80)
}
function selectEvidenceChunks(chunks: SourceChunk[], query: string, max = 9): SourceChunk[] {
  if (chunks.length <= max) return chunks
  const terms = Array.from(new Set(tokenize(query))).slice(0, 24)
  const scored = chunks.map((chunk, index) => {
    const low = chunk.text.toLocaleLowerCase('tr-TR')
    let score = 0
    for (const term of terms) score += (low.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length * 3
    if (/\d/.test(chunk.text)) score += 1
    if (/:|—|\bsonuç\b|\bconclusion\b|\bmodel\b|\bframework\b/i.test(chunk.text)) score += 1
    if (index < 2 || index === chunks.length - 1) score += 2
    return { ...chunk, score }
  })
  const picked = new Map<string, SourceChunk>()
  ;[0, 1, Math.floor(chunks.length / 2), chunks.length - 1].forEach(index => {
    if (chunks[index]) picked.set(chunks[index].id, chunks[index])
  })
  for (const chunk of scored.sort((a, b) => (b.score || 0) - (a.score || 0))) {
    if (picked.size >= max) break
    picked.set(chunk.id, chunk)
  }
  return [...picked.values()].slice(0, max)
}
function renderEvidencePacket(chunks: SourceChunk[]): string {
  return chunks.map(chunk => `[${chunk.id}] ${chunk.text}`).join('\n\n')
}

async function loadSource(userClient: any, userId: string, body: any): Promise<SourceBundle> {
  const sourceType = allowedSourceTypes.has(body?.sourceType) ? body.sourceType : 'topic'
  const sourceId = cleanText(body?.sourceId, 80) || null
  const topic = cleanText(body?.topic, 700)
  if (sourceType === 'topic') {
    if (topic.length < 3) throw new Error('TOPIC_REQUIRED')
    const context = cleanText(body?.sourceText || topic, 70000)
    const chunks = chunkSource(context)
    return { sourceType, sourceId: null, title: topic, context, chunks }
  }
  if (!sourceId) throw new Error('SOURCE_REQUIRED')
  if (sourceType === 'study_card') {
    const { data: card, error } = await userClient.from('study_cards').select('*').eq('id', sourceId).eq('user_id', userId).single()
    if (error || !card) throw new Error('SOURCE_NOT_FOUND')
    let title = cleanText(card.title || card.course_tag || 'Study Card', 180)
    if (card.document_id) {
      const { data: doc } = await userClient.from('documents').select('file_name').eq('id', card.document_id).eq('user_id', userId).maybeSingle()
      if (doc?.file_name) title = cleanText(doc.file_name, 180)
    }
    const context = buildStudyCardContext(card)
    return { sourceType, sourceId, title, context, chunks: chunkSource(context) }
  }
  const { data: document, error } = await userClient
    .from('documents')
    .select('id, file_name, storage_path, mime_type')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .single()
  if (error || !document) throw new Error('SOURCE_NOT_FOUND')
  const context = await extractDocumentText(userClient, document)
  if (context.length < 20) throw new Error('EMPTY_SOURCE')
  return { sourceType, sourceId, title: cleanText(document.file_name, 180) || 'Document', context, chunks: chunkSource(context) }
}

async function callGroq(apiKey: string, system: string, user: string, maxTokens: number, temperature = 0.18) {
  const model = Deno.env.get('GROQ_PRESENTATION_MODEL') || 'openai/gpt-oss-120b'
  let prompt = user
  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 55000)
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature,
          max_completion_tokens: Math.min(2800, Math.max(450, maxTokens)),
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        }),
      })
      clearTimeout(timer)
      const payload = await response.json()
      if (response.ok && payload?.choices?.[0]?.message?.content) return payload.choices[0].message.content as string
      lastError = cleanText(payload?.error?.message, 700)
      if (response.status === 429 && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 6500 * (attempt + 1)))
        prompt = prompt.length > 6500 ? `${prompt.slice(0, 5200)}\n\n[context shortened for retry]` : prompt
        continue
      }
      if (/context|token|too large|json_validate/i.test(lastError) && attempt < 2) {
        prompt = `${prompt.slice(0, Math.max(4200, Math.floor(prompt.length * 0.72)))}\n\n[context shortened for retry]`
        continue
      }
      throw new Error('AI_SERVICE_UNAVAILABLE')
    } catch (error) {
      clearTimeout(timer)
      lastError = error instanceof Error ? error.message : 'AI request failed'
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)))
    }
  }
  console.error('Acadia Director Groq failure:', lastError)
  throw new Error('AI_SERVICE_UNAVAILABLE')
}

function normalizePlan(value: Record<string, unknown>, slideCount: number, mode: string, targetMinutes: number) {
  const root = value.plan && typeof value.plan === 'object' && !Array.isArray(value.plan) ? value.plan as Record<string, unknown> : value
  const briefRaw = root.brief && typeof root.brief === 'object' && !Array.isArray(root.brief) ? root.brief as Record<string, unknown> : {}
  const outlineRaw = Array.isArray(root.outline) ? root.outline : []
  if (outlineRaw.length < Math.max(4, Math.ceil(slideCount * 0.75))) throw new Error('INCOMPLETE_PLAN')
  const outline = outlineRaw.slice(0, slideCount).map((item, index) => {
    const row = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
    const visual = cleanText(row.visual_strategy ?? row.visual_purpose, 30)
    return {
      index: index + 1,
      title: cleanText(row.title, 150) || `Slayt ${index + 1}`,
      purpose: cleanText(row.purpose, 260),
      message: cleanText(row.message, 320),
      visual_strategy: allowedVisuals.has(visual) ? visual : (index === 0 ? 'hero' : index === slideCount - 1 ? 'summary' : 'section'),
      evidence_ids: Array.isArray(row.evidence_ids) ? row.evidence_ids.map(x => cleanText(x, 12)).filter(Boolean).slice(0, 6) : [],
    }
  })
  if (outline.length) {
    outline[0].visual_strategy = 'hero'
    outline[outline.length - 1].visual_strategy = 'summary'
  }
  const evidenceRaw = Array.isArray(root.evidence_map) ? root.evidence_map : []
  const evidence_map = evidenceRaw.slice(0, 28).map(item => {
    const row = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
    return {
      claim: cleanText(row.claim, 360),
      evidence_ids: Array.isArray(row.evidence_ids) ? row.evidence_ids.map(x => cleanText(x, 12)).filter(Boolean).slice(0, 6) : [],
      confidence: Math.max(0, Math.min(1, Number(row.confidence ?? 0.75) || 0.75)),
    }
  }).filter(x => x.claim)
  return {
    version: 11,
    brief: {
      purpose: cleanText(briefRaw.purpose, 420) || 'Deliver a clear evidence-aware academic presentation',
      audience: cleanText(briefRaw.audience, 220) || 'University audience',
      main_message: cleanText(briefRaw.main_message ?? briefRaw.mainMessage, 420) || outline[0]?.message || '',
      tone: cleanText(briefRaw.tone, 120) || 'academic, clear, confident',
      mode,
      target_minutes: targetMinutes,
    },
    narrative_arc: cleanText(root.narrative_arc ?? root.narrativeArc, 700),
    outline,
    evidence_map,
    risks: Array.isArray(root.risks) ? root.risks.map(x => cleanText(x, 220)).filter(Boolean).slice(0, 8) : [],
  }
}

function normalizeTable(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const headers = Array.isArray(row.headers) ? row.headers.slice(0, 6).map(x => cleanText(x, 90)).filter(Boolean) : []
  const rows = Array.isArray(row.rows) ? row.rows.slice(0, 8).map(r => Array.isArray(r) ? headers.map((_, i) => cleanText(r[i], 180)) : []).filter(r => r.length === headers.length) : []
  return headers.length >= 2 && rows.length ? { title: cleanText(row.title, 120), headers, rows } : null
}
function normalizeChart(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const labels = Array.isArray(row.labels) ? row.labels.slice(0, 10).map(x => cleanText(x, 80)).filter(Boolean) : []
  const data = Array.isArray(row.data) ? row.data.slice(0, labels.length).map(Number) : []
  if (labels.length < 2 || data.length !== labels.length || data.some(x => !Number.isFinite(x))) return null
  const typeRaw = cleanText(row.type, 20)
  const type = allowedChartTypes.has(typeRaw) ? typeRaw : 'bar'
  const series = cleanText(row.series_label, 60) || 'Değer'
  return { type, title: cleanText(row.title, 120), series_label: series, labels, data, datasets: [{ label: series, data }], source_verified: true }
}
function normalizeCards(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 6).map(item => {
    const row = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
    const title = cleanText(row.title, 90)
    const body = cleanText(row.body ?? row.text, 280)
    return title ? { title, body } : null
  }).filter(Boolean)
}
function normalizeSteps(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 7).map((item, index) => {
    const row = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
    const title = cleanText(row.title ?? item, 110)
    return title ? { label: cleanText(row.label, 20) || String(index + 1), title, body: cleanText(row.body ?? row.text, 240) } : null
  }).filter(Boolean)
}
function normalizeDiagram(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const typeRaw = cleanText(row.type, 20)
  const type = allowedDiagramTypes.has(typeRaw) ? typeRaw : 'flow'
  const nodes = Array.isArray(row.nodes) ? row.nodes.slice(0, 7).map(item => {
    if (typeof item === 'string') return { label: cleanText(item, 100), body: '' }
    const n = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
    const label = cleanText(n.label ?? n.title, 100)
    return label ? { label, body: cleanText(n.body ?? n.text, 220) } : null
  }).filter(Boolean) : []
  return nodes.length >= 2 ? { type, title: cleanText(row.title, 120), nodes } : null
}
function normalizeSlide(value: unknown, index: number, sourceType: string) {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const sourceContent = row.content && typeof row.content === 'object' && !Array.isArray(row.content) ? row.content as Record<string, unknown> : {}
  const visualRaw = cleanText(row.visual_purpose ?? sourceContent.visual_purpose, 30)
  const variantRaw = cleanText(row.design_variant ?? sourceContent.design_variant, 30)
  const table = normalizeTable(row.table ?? sourceContent.table)
  const chart = normalizeChart(row.chart ?? sourceContent.chart)
  const cards = normalizeCards(row.cards ?? sourceContent.cards)
  const steps = normalizeSteps(row.steps ?? sourceContent.steps)
  const diagram = normalizeDiagram(row.diagram ?? sourceContent.diagram)
  const layoutRaw = cleanText(row.layout_type ?? row.layout, 30)
  let layout = allowedLayouts.has(layoutRaw) ? layoutRaw : 'title-content'
  if (layout === 'table' && !table) layout = 'title-content'
  if (layout === 'chart' && !chart) layout = 'title-content'

  const rawSourceRefs = row.source_refs ?? sourceContent.source_refs
  const sourceRefs = Array.isArray(rawSourceRefs)
    ? rawSourceRefs.slice(0, 8).map((ref: any) => ({
      chunk_id: cleanText(ref?.chunk_id ?? ref?.id, 12),
      confidence: Math.max(0, Math.min(1, Number(ref?.confidence ?? 0.8) || 0.8)),
    })).filter((ref: any) => ref.chunk_id)
    : []
  const rawClaims = row.claims ?? sourceContent.claims
  const claims = Array.isArray(rawClaims)
    ? rawClaims.slice(0, 8).map((claim: any) => ({
      text: cleanText(claim?.text ?? claim?.claim, 360),
      evidence_ids: Array.isArray(claim?.evidence_ids) ? claim.evidence_ids.map((x: unknown) => cleanText(x, 12)).filter(Boolean).slice(0, 6) : [],
      confidence: Math.max(0, Math.min(1, Number(claim?.confidence ?? 0.8) || 0.8)),
    })).filter((claim: any) => claim.text)
    : []

  const content: Record<string, unknown> = {
    text: cleanText(row.text ?? sourceContent.text, 3600),
    secondary_text: cleanText(row.secondary_text ?? sourceContent.secondary_text, 2200),
    design_variant: allowedVariants.has(variantRaw) ? variantRaw : (index === 0 ? 'hero' : 'section'),
    visual_purpose: allowedVisuals.has(visualRaw) ? visualRaw : (index === 0 ? 'hero' : 'section'),
    source_refs: sourceRefs,
    claims,
  }
  if (table) content.table = table
  if (chart) content.chart = chart
  if (cards.length) content.cards = cards
  if (steps.length) content.steps = steps
  if (diagram) content.diagram = diagram
  if (row.metric && typeof row.metric === 'object') content.metric = row.metric
  if (sourceType !== 'topic' && !sourceRefs.length && claims.length) {
    content.source_refs = Array.from(new Set(claims.flatMap((c: any) => c.evidence_ids))).slice(0, 8).map(chunk_id => ({ chunk_id, confidence: 0.75 }))
  }
  return {
    title: cleanText(row.title, 160) || `Slayt ${index + 1}`,
    content,
    speaker_notes: cleanText(row.speaker_notes ?? row.speakerNotes, 2400),
    layout_type: layout,
    image_url: null,
    image_position: layout === 'image-left' ? 'left' : 'right',
  }
}
function normalizeDeck(value: Record<string, unknown>, slideCount: number, sourceType: string) {
  const root = value.presentation && typeof value.presentation === 'object' && !Array.isArray(value.presentation) ? value.presentation as Record<string, unknown> : value
  const rawSlides = Array.isArray(root.slides) ? root.slides : []
  if (rawSlides.length < Math.max(4, Math.ceil(slideCount * 0.75))) throw new Error('INCOMPLETE_PRESENTATION')
  const slides = rawSlides.slice(0, slideCount).map((slide, index) => normalizeSlide(slide, index, sourceType))
  if (slides[0]) {
    ;(slides[0].content as Record<string, unknown>).design_variant = 'hero'
    ;(slides[0].content as Record<string, unknown>).visual_purpose = 'hero'
  }
  if (slides[slides.length - 1]) {
    ;(slides[slides.length - 1].content as Record<string, unknown>).design_variant = 'summary'
    ;(slides[slides.length - 1].content as Record<string, unknown>).visual_purpose = 'summary'
  }
  return { title: cleanText(root.title, 160) || slides[0]?.title || 'Akademik Sunum', slides }
}

function words(value: string) { return cleanText(value).split(/\s+/).filter(Boolean).length }
function qualityDeck(deck: { title: string; slides: any[] }, requestedCount: number, sourceType: string) {
  let score = 100
  const issues: string[] = []
  const titles = deck.slides.map(slide => cleanText(slide.title, 160).toLocaleLowerCase('tr-TR'))
  if (deck.slides.length !== requestedCount) { score -= Math.min(18, Math.abs(requestedCount - deck.slides.length) * 4); issues.push('slide_count_mismatch') }
  if (new Set(titles).size < titles.length) { score -= 12; issues.push('duplicate_titles') }
  const weakNotes = deck.slides.filter(slide => words(slide.speaker_notes || '') < 22).length
  if (weakNotes) { score -= Math.min(16, weakNotes * 3); issues.push('weak_speaker_notes') }
  const dense = deck.slides.filter(slide => words(String(slide.content?.text || '')) > 95).length
  if (dense) { score -= Math.min(14, dense * 3); issues.push('dense_slides') }
  const variants = deck.slides.map(slide => String(slide.content?.design_variant || 'section'))
  for (let i = 2; i < variants.length; i++) {
    if (variants[i] === variants[i - 1] && variants[i] === variants[i - 2] && !['hero','summary'].includes(variants[i])) {
      score -= 8; issues.push('visual_repetition'); break
    }
  }
  if (sourceType !== 'topic') {
    const grounded = deck.slides.filter((slide, index) => index === 0 || Array.isArray(slide.content?.source_refs) && slide.content.source_refs.length).length
    const ratio = grounded / Math.max(1, deck.slides.length)
    if (ratio < 0.75) { score -= Math.round((0.75 - ratio) * 30); issues.push('weak_grounding') }
  }
  return { score: Math.max(0, Math.min(100, Math.round(score))), issues: Array.from(new Set(issues)), pass: score >= 72 }
}

function modeInstruction(mode: string) {
  const map: Record<string, string> = {
    thesis_defense: 'THESIS DEFENSE: problem → research question → literature/context → methodology → evidence/findings → discussion → limitations → conclusion/recommendations. Anticipate jury scrutiny.',
    research: 'RESEARCH PRESENTATION: question → concepts → method/evidence → analysis → findings → limitations → implications.',
    lecture: 'LECTURE: activate prior knowledge → define concepts → explain mechanisms → worked example/application → misconceptions/risks → recap.',
    business: 'BUSINESS ACADEMIC: context/problem → evidence → options/comparison → implications → recommendation → next steps. Keep claims academically cautious.',
    academic: 'ACADEMIC: context/problem → core concepts → analysis → comparison/example → risks/limitations → conclusion/recommendations.',
  }
  return map[mode] || map.academic
}

async function createPlan(apiKey: string, source: SourceBundle, body: any) {
  const slideCount = clampInt(body?.slideCount, 5, 15, 8)
  const targetMinutes = clampInt(body?.targetMinutes ?? body?.target_minutes, 3, 30, 10)
  const mode = allowedModes.has(body?.mode) ? body.mode : 'academic'
  const language = body?.language === 'en' ? 'English' : 'Turkish'
  const detail = ['summary','bullets','detailed'].includes(body?.detailLevel) ? body.detailLevel : 'bullets'
  const evidenceChunks = selectEvidenceChunks(source.chunks, `${source.title} ${cleanText(body?.topic, 400)} ${cleanText(body?.courseTag, 100)}`, 9)
  const packet = renderEvidencePacket(evidenceChunks)
  const groundedRule = source.sourceType === 'topic'
    ? 'You may use stable general academic knowledge, but never invent papers, authors, quotations, URLs, or precise statistics. evidence_ids may be empty for general-knowledge claims.'
    : 'Every factual claim that depends on the source must map to one or more provided chunk IDs. Do not use facts absent from the evidence packet. Never fabricate citations.'
  const system = `You are Acadia Director V11, a senior academic presentation strategist. Create the planning pass before any slide writing.\n${modeInstruction(mode)}\n${groundedRule}\nReturn JSON only. The outline MUST contain exactly ${slideCount} slides. Write in ${language}.\nSchema: {"brief":{"purpose":"","audience":"","main_message":"","tone":""},"narrative_arc":"","outline":[{"index":1,"title":"","purpose":"","message":"","visual_strategy":"hero|section|cards|process|timeline|comparison|table|chart|diagram|big-number|summary","evidence_ids":["C01"]}],"evidence_map":[{"claim":"","evidence_ids":["C01"],"confidence":0.0}],"risks":[""]}.\nOpening must be hero and final slide summary. Avoid instructor/admin details. Detail preference=${detail}. Target duration=${targetMinutes} minutes.`
  const user = `SOURCE TITLE: ${source.title}\nSOURCE TYPE: ${source.sourceType}\n\nEVIDENCE PACKET:\n${packet}\n\nCreate a rigorous presentation brief, narrative arc, evidence map, and exact ${slideCount}-slide outline.`
  const raw = await callGroq(apiKey, system, user, 1450)
  return { plan: normalizePlan(parseJson(raw), slideCount, mode, targetMinutes), evidenceChunks }
}

async function composeDeck(apiKey: string, source: SourceBundle, body: any, plan: any, evidenceChunks?: SourceChunk[]) {
  const slideCount = clampInt(body?.slideCount ?? plan?.outline?.length, 5, 15, 8)
  const language = body?.language === 'en' ? 'English' : 'Turkish'
  const detail = ['summary','bullets','detailed'].includes(body?.detailLevel) ? body.detailLevel : 'detailed'
  const selected = evidenceChunks?.length ? evidenceChunks : selectEvidenceChunks(source.chunks, `${source.title} ${plan?.brief?.main_message || ''}`, 9)
  const packet = renderEvidencePacket(selected)
  const density = detail === 'summary'
    ? 'Visible text: max 3 short bullets or 2 concise sentences. Speaker notes: 35-55 words.'
    : detail === 'detailed'
      ? 'Visible text: 4-6 substantive, information-dense bullets (or compact structured content). Each bullet should be a full, specific sentence — not a sentence fragment. Speaker notes: 70-110 words, written as a rich paragraph a presenter would actually say aloud.'
      : 'Visible text: 3-5 concise teaching bullets. Speaker notes: 45-70 words.'
  const groundedRule = source.sourceType === 'topic'
    ? 'General stable academic knowledge is allowed. Never invent named studies, authors, quotations, URLs, or precise statistics.'
    : 'Use only facts supported by the evidence packet. For source-derived claims, include source_refs and claims with the exact evidence chunk IDs. Do not fabricate evidence.'
  const depthRule = source.sourceType === 'topic'
    ? 'CONTENT DEPTH: every bullet/text item must carry one concrete, specific detail — a named example, a mechanism, a cause/effect, a comparison, or a well-known illustrative figure (not a fabricated precise statistic). Never write a generic definitional restatement of the slide title (e.g. reject "X is when computers do Y"-style filler) — a reader who already knows the topic exists should still learn something specific from every bullet.'
    : 'CONTENT DEPTH: every bullet/text item must surface a specific, concrete detail drawn from the evidence packet — a named fact, figure, mechanism, or comparison — never a generic restatement of the slide title. Prefer the most information-dense sentence the evidence supports over a vague summary sentence.'
  const completenessRule = 'STRUCTURED CONTENT COMPLETENESS: when you choose cards, steps, or comparison, every card/step must have BOTH a non-empty title AND a non-empty body of at least 12 words — never emit a card or step with only a title. A "comparison" slide must have exactly two cards, each fully populated on both sides; if you cannot write substantive content for both sides, use design_variant "cards", "table", or "section" instead of "comparison". Never leave a visual element half-empty.'
  const system = `You are Acadia Director V11 operating as Academic Writer + Visual Planner. Follow the approved plan exactly and produce a professional editable deck in ${language}.\n${groundedRule}\n${depthRule}\n${completenessRule}\n${density}\nReturn JSON only: {"title":"","slides":[{"title":"","text":"","secondary_text":"","speaker_notes":"","layout_type":"title-content|two-column|image-left|image-right|chart|table","design_variant":"hero|section|cards|process|timeline|big-number|comparison|data|summary","visual_purpose":"hero|section|cards|process|timeline|comparison|table|chart|diagram|big-number|summary","source_refs":[{"chunk_id":"C01","confidence":0.9}],"claims":[{"text":"","evidence_ids":["C01"],"confidence":0.9}],"table":null,"chart":null,"cards":null,"steps":null,"diagram":null}]}.\nRules: exactly ${slideCount} slides; no instruction leakage; no fake charts. Create a chart ONLY when the evidence packet contains explicit numeric values. Prefer comparison/table/process/diagram/cards when data is qualitative. Preserve one clear message per slide. The title slide and final summary should be visually distinct.`
  const user = `APPROVED DIRECTOR PLAN:\n${cleanText(JSON.stringify(plan), 9000)}\n\nEVIDENCE PACKET:\n${packet}\n\nWrite the complete deck now.`
  const raw = await callGroq(apiKey, system, user, 2650)
  let deck = normalizeDeck(parseJson(raw), slideCount, source.sourceType)
  let quality = qualityDeck(deck, slideCount, source.sourceType)

  if (!quality.pass) {
    const repairSystem = `You are Acadia Academic Critic V11. Repair a draft presentation without changing its evidence basis. Return JSON only in the same presentation schema. Fix only these quality issues: ${quality.issues.join(', ') || 'general quality'}. Keep exactly ${slideCount} slides. Do not invent citations, numbers, authors or research. Write in ${language}.`
    const repairUser = `PLAN:\n${cleanText(JSON.stringify(plan), 4200)}\n\nDRAFT:\n${cleanText(JSON.stringify(deck), 8500)}\n\nRepair the deck. Keep source_refs/claims grounded in existing chunk IDs.`
    try {
      const repairedRaw = await callGroq(apiKey, repairSystem, repairUser, 1900, 0.12)
      const repaired = normalizeDeck(parseJson(repairedRaw), slideCount, source.sourceType)
      const repairedQuality = qualityDeck(repaired, slideCount, source.sourceType)
      if (repairedQuality.score >= quality.score) {
        deck = repaired
        quality = repairedQuality
      }
    } catch (error) {
      console.warn('V11 critic repair skipped:', error)
    }
  }
  return { deck, quality, evidenceChunks: selected }
}

async function logRun(client: any, userId: string, payload: Record<string, unknown>) {
  try {
    const { data, error } = await client.from('presentation_generation_runs').insert({
      user_id: userId,
      presentation_id: payload.presentation_id || null,
      stage: payload.stage || 'v11',
      model: Deno.env.get('GROQ_PRESENTATION_MODEL') || 'openai/gpt-oss-120b',
      status: payload.status || 'completed',
      latency_ms: payload.latency_ms || null,
      error_code: payload.error_code || null,
      metadata: payload.metadata || {},
      completed_at: payload.status === 'started' ? null : new Date().toISOString(),
    }).select('id').maybeSingle()
    if (error) return null
    return data?.id || null
  } catch (_) { return null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
  const started = Date.now()
  let userClient: any = null
  let userId = ''
  let action = 'generate'
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return respond({ error: 'Missing Authorization header' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const groqApiKey = Deno.env.get('GROQ_API_KEY') || ''
    if (!supabaseUrl || !anonKey || !groqApiKey) return respond({ error: 'AI service is not configured' }, 500)
    userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return respond({ error: 'Unauthorized user token' }, 401)
    userId = user.id

    const body = await req.json()
    action = ['plan','compose','generate','critique','health'].includes(body?.action) ? body.action : 'generate'
    if (action === 'health') return respond({ ok: true, version: 11, service: 'acadia-presentation-director' })

    if (action === 'critique') {
      const rawDeck = body?.presentation && typeof body.presentation === 'object' ? body.presentation : { title: 'Deck', slides: body?.slides || [] }
      const sourceType = allowedSourceTypes.has(body?.sourceType) ? body.sourceType : 'topic'
      const count = clampInt(body?.slideCount ?? rawDeck?.slides?.length, 1, 30, rawDeck?.slides?.length || 1)
      const deck = normalizeDeck(rawDeck, count, sourceType)
      return respond({ version: 11, quality: qualityDeck(deck, count, sourceType) })
    }

    const source = await loadSource(userClient, userId, body)
    if (source.context.length < 3) return respond({ error: 'No readable source content found' }, 400)

    if (action === 'plan') {
      const result = await createPlan(groqApiKey, source, body)
      const runId = await logRun(userClient, userId, {
        presentation_id: cleanText(body?.presentationId, 80) || null,
        stage: 'v11_plan', status: 'completed', latency_ms: Date.now() - started,
        metadata: { source_type: source.sourceType, source_id: source.sourceId, outline_count: result.plan.outline.length, mode: result.plan.brief.mode },
      })
      return respond({ version: 11, run_id: runId, source: { type: source.sourceType, id: source.sourceId, title: source.title }, plan: result.plan, evidence_chunks: result.evidenceChunks })
    }

    if (action === 'compose') {
      const planInput = body?.plan && typeof body.plan === 'object' ? body.plan : null
      if (!planInput) return respond({ error: 'Director plan is required' }, 400)
      const slideCount = clampInt(body?.slideCount ?? planInput?.outline?.length, 5, 15, 8)
      const planMode = allowedModes.has(body?.mode) ? body.mode : (planInput?.brief?.mode || 'academic')
      const plan = normalizePlan(planInput, slideCount, String(planMode), clampInt(body?.targetMinutes ?? planInput?.brief?.target_minutes, 3, 30, 10))
      const evidenceChunks = Array.isArray(body?.evidence_chunks)
        ? body.evidence_chunks.slice(0, 12).map((x: any) => ({ id: cleanText(x?.id, 12), text: cleanText(x?.text, 900), locator: x?.locator && typeof x.locator === 'object' ? x.locator : {} })).filter((x: any) => x.id && x.text)
        : undefined
      const result = await composeDeck(groqApiKey, source, body, plan, evidenceChunks)
      const runId = await logRun(userClient, userId, {
        presentation_id: cleanText(body?.presentationId, 80) || null,
        stage: 'v11_compose', status: 'completed', latency_ms: Date.now() - started,
        metadata: { source_type: source.sourceType, source_id: source.sourceId, quality: result.quality, mode: plan.brief.mode },
      })
      return respond({ version: 11, run_id: runId, source: { type: source.sourceType, id: source.sourceId, title: source.title }, plan, presentation: result.deck, quality: result.quality, evidence_chunks: result.evidenceChunks })
    }

    const planning = await createPlan(groqApiKey, source, body)
    const composed = await composeDeck(groqApiKey, source, body, planning.plan, planning.evidenceChunks)
    const runId = await logRun(userClient, userId, {
      presentation_id: cleanText(body?.presentationId, 80) || null,
      stage: 'v11_full', status: 'completed', latency_ms: Date.now() - started,
      metadata: { source_type: source.sourceType, source_id: source.sourceId, quality: composed.quality, mode: planning.plan.brief.mode },
    })
    return respond({ version: 11, run_id: runId, source: { type: source.sourceType, id: source.sourceId, title: source.title }, plan: planning.plan, presentation: composed.deck, quality: composed.quality, evidence_chunks: composed.evidenceChunks })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN'
    console.error('acadia-presentation-director exception:', error)
    if (userClient && userId) {
      await logRun(userClient, userId, { stage: `v11_${action}`, status: 'failed', latency_ms: Date.now() - started, error_code: code, metadata: {} })
    }
    if (['TOPIC_REQUIRED','SOURCE_REQUIRED'].includes(code)) return respond({ error: 'A presentation topic or source is required.' }, 400)
    if (code === 'SOURCE_NOT_FOUND') return respond({ error: 'Source not found or access denied.' }, 404)
    if (code === 'EMPTY_SOURCE') return respond({ error: 'No readable source content found.' }, 400)
    if (code === 'DOCUMENT_DOWNLOAD_FAILED') return respond({ error: 'The source document could not be downloaded.' }, 500)
    if (['INVALID_AI_JSON','INCOMPLETE_PLAN','INCOMPLETE_PRESENTATION'].includes(code)) return respond({ error: 'Acadia returned an incomplete structure. Please try again.' }, 502)
    if (code === 'AI_SERVICE_UNAVAILABLE') return respond({ error: 'Acadia Director is busy. Please try again shortly.' }, 503)
    return respond({ error: 'Acadia Presentation Director failed.' }, 500)
  }
})
