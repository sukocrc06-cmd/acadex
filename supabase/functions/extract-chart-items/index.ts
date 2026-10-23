import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ==========================================================================
// FAZ 4c — DOSYADAKİ GRAFİK SORULARINI TARAMA (23.10.2026)
//
// Öğrencinin yüklediği belgede (ders notu ya da çıkmış sınav) grafikleri ve
// her grafiğin yanındaki örnek soruyu bulur. Sınav kurulurken BİR KEZ
// çalışır; sonuç document_chart_items'ta saklanır, aynı belgeyle ikinci
// sınavda tarama yapılmaz.
//
//   action = 'status'  taramanın durumu ve bulunan grafikler
//   action = 'step'    taramayı bir adım ilerletir:
//                        ilk çağrı: aday sayfaları seçer (sayfa metnindeki
//                        "grafik/şekil" ve soru izleri), PDF.co ile görüntüye
//                        çevirir;
//                        sonraki her çağrı: SIRADAKİ TEK sayfayı görsel
//                        modelle okur. Groq'un dakikalık sınırı (qwen ayrı
//                        kota, ~2 sayfa/dk) yüzünden istemci adım adım
//                        ilerletir ve ilerlemeyi gösterir; 429'da beklenecek
//                        süre döner.
//
// Görsel model grafiğin YAPISINI (tür, kategoriler, seriler, birim, eksen
// başlıkları) ve örnek sorunun BİÇİMİNİ okur. Sayısal değerler yalnızca
// ölçek için kullanılır: sınavda grafik bu yapıyla, FARKLI değerlerle
// yeniden çizilir (generate-exam chartVariant) — piksel okumasındaki hata
// cevap anahtarına taşınmaz.
//
// Aşağıdaki parseLooseNumber … normalizeChartSpec bloğu generate-exam'den
// BİREBİR kopya (tests/exam-chart-scan.js denetler).
// ==========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SCAN_MAX_PAGES = 8
const VISION_MAX_TOKENS = 2500
const GROQ_WAIT_CAP_MS = 60_000

// ---- (generate-exam'den kopya blok) ----
/** Sayıyı esnek okur: 1432.5, "1.432,50", "1,432.50", "%12", "₺1.000",
 *  "-3,5". Yalnızca virgül varsa ondalık ayırıcı sayılır (Türkçe yazım).
 *  Okunamazsa NaN. */
function parseLooseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  let s = String(value ?? '').trim().replace(/\s+/g, '')
  s = s.replace(/[^0-9.,\-+eE]/g, '')
  if (!s || !/\d/.test(s)) return NaN
  const hasComma = s.includes(','), hasDot = s.includes('.')
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (hasComma) {
    s = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (hasDot && (s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

const CHART_MAX_SOURCES = 6

const CHART_MAX_POINTS = 24

const CHART_MAX_SERIES = 3

function chartLabel(value: unknown, max: number): string {
  if (value == null || (typeof value !== 'string' && typeof value !== 'number')) return ''
  const t = String(value).replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

type ChartSpec = { title: string; type: 'bar' | 'line' | 'pie'; labels: string[]; series: Array<{ name: string; data: number[] }>; unit: string }

/** Grafik verisini doğrular ve kırpar; geçersizse null. Kabul: kart
 *  charts biçimi ({labels, data}) ya da çok serili ({labels, series}). */
function normalizeChartSpec(raw: unknown): ChartSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const labels = (Array.isArray(r.labels) ? r.labels : []).map(l => chartLabel(l, 30)).slice(0, CHART_MAX_POINTS)
  if (labels.length < 2 || labels.some(l => !l)) return null
  const rawSeries = Array.isArray(r.series) ? r.series : (Array.isArray(r.data) ? [{ name: '', data: r.data }] : [])
  const series: Array<{ name: string; data: number[] }> = []
  for (const sr of rawSeries.slice(0, CHART_MAX_SERIES)) {
    if (!sr || typeof sr !== 'object') continue
    const d = (Array.isArray((sr as Record<string, unknown>).data) ? (sr as Record<string, unknown>).data as unknown[] : []).slice(0, labels.length).map(v => typeof v === 'number' ? v : parseLooseNumber(v))
    if (d.length !== labels.length || d.some(v => !Number.isFinite(v))) continue
    series.push({ name: chartLabel((sr as Record<string, unknown>).name, 40), data: d })
  }
  if (!series.length) return null
  let type = ['bar', 'line', 'pie'].includes(String(r.type)) ? String(r.type) as ChartSpec['type'] : 'bar'
  if (type === 'pie' && (series.length > 1 || series[0].data.some(v => v < 0))) type = 'bar'
  return { title: chartLabel(r.title, 80) || 'Grafik', type, labels, series, unit: chartLabel(r.unit, 12) }
}
// ---- (kopya bloğun sonu) ----

const CHART_FORMATS = ['which_true', 'which_false', 'premises', 'true_false', 'value', 'open', 'fill']
const CHART_SKILLS = ['trend', 'extreme', 'compare', 'change', 'share', 'average', 'rank', 'gap']

type ChunkRow = { page_start: number | null; page_end: number | null; text: string }

/** document_chunks satırlarından sayfa → metin. */
function pageTexts(rows: ChunkRow[]): Map<number, string> {
  const out = new Map<number, string>()
  for (const r of rows || []) {
    const p = Number(r && r.page_start)
    if (!Number.isInteger(p) || p <= 0) continue
    out.set(p, (out.get(p) || '') + '\n' + String(r.text || ''))
  }
  return out
}

const CHART_CUE = /(grafi[kğ]|şekil|şekl|chart|graph|figure|diyagram|histogram|pasta dilim|sütun|eğri|eksen|axis)/giu
const QUESTION_CUE = /(hangisi|hangileri|söylenebilir|söylenemez|ulaşılabilir|ulaşılamaz|doğrudur|yanlıştır|yorumlayınız|açıklayınız|which of|\b[A-E]\)|\bI{1,3}\.\s|\?)/giu

/** Taranacak sayfalar (1'den başlayan, artan sırada): grafik ve soru izi
 *  taşıyan sayfalar önce; hiç iz yoksa neredeyse boş sayfalar (grafik
 *  görüntü olarak gömülü, metin çıkmıyor); o da yoksa ilk üç sayfa. */
function selectCandidatePages(texts: Map<number, string>, pageCount: number, max = SCAN_MAX_PAGES): number[] {
  const scored: Array<{ page: number; score: number }> = []
  for (let p = 1; p <= pageCount; p++) {
    const t = texts.get(p) || ''
    const charts = (t.match(CHART_CUE) || []).length
    const qs = Math.min(6, (t.match(QUESTION_CUE) || []).length)
    const blank = t.trim().length < 150 ? 1 : 0
    const score = charts * 3 + qs + (charts || qs ? blank : 0)
    if (score >= 3) scored.push({ page: p, score })
  }
  let pages = scored.sort((a, b) => b.score - a.score || a.page - b.page).slice(0, max).map(s => s.page)
  if (!pages.length) {
    for (let p = 1; p <= pageCount && pages.length < Math.min(4, max); p++) if ((texts.get(p) || '').trim().length < 150) pages.push(p)
  }
  if (!pages.length) pages = Array.from({ length: Math.min(3, pageCount, max) }, (_, i) => i + 1)
  return pages.sort((a, b) => a - b)
}

/** Örnek sorunun biçimi: modelin söylediği geçerliyse o, değilse metinden. */
function inferFormat(format: unknown, stem: string, options: string[], premises: string[]): string {
  const f = String(format ?? '')
  if (CHART_FORMATS.includes(f)) return f
  const s = stem.toLocaleLowerCase('tr-TR')
  if (premises.length >= 2 || /\bI\.\s.*\bII\.\s/s.test(stem) || /hangileri/.test(s)) return 'premises'
  if (/söylenemez|ulaşılamaz|yanlıştır|not true|cannot/.test(s)) return 'which_false'
  if (/doğru mudur|doğru mu|true or false|d\/y/.test(s)) return 'true_false'
  if (/_{3,}/.test(stem)) return 'fill'
  if (/yorumlayınız|açıklayınız|değerlendiriniz|interpret|explain|discuss/.test(s)) return 'open'
  if (/kaçtır|kaç |yüzde kaç|ne kadar|how many|what percent|how much/.test(s) && !options.length) return 'value'
  return 'which_true'
}

/** Görsel modelin çıktısındaki bir öğeyi doğrular: geçerli grafik ve
 *  örnek biçimi. Desteklenmeyen grafik (dağılım, harita…) atılır. */
function normalizeScanItem(raw: unknown): { chart: Record<string, unknown>; example: Record<string, unknown> } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const c = (r.chart && typeof r.chart === 'object' ? r.chart : null) as Record<string, unknown> | null
  if (!c) return null
  const t = String(c.type ?? '').toLowerCase()
  const type = /pie|pasta|doughnut|halka/.test(t) ? 'pie' : /line|çizgi|area|alan/.test(t) ? 'line' : /bar|sütun|column|histogram|çubuk/.test(t) ? 'bar' : null
  if (!type) return null
  const series = (Array.isArray(c.series) ? c.series : []).map(sr => {
    const o = (sr && typeof sr === 'object' ? sr : {}) as Record<string, unknown>
    return { name: o.name, data: Array.isArray(o.values) ? o.values : o.data }
  })
  const spec = normalizeChartSpec({ title: c.title, type, labels: c.categories ?? c.labels, series, unit: c.unit })
  if (!spec) return null
  const chart: Record<string, unknown> = { ...spec, x_title: chartLabel(c.x_title, 60), y_title: chartLabel(c.y_title, 60), values_printed: c.values_printed === true }
  const e = (r.example && typeof r.example === 'object' ? r.example : {}) as Record<string, unknown>
  const stem = chartLabel(e.stem, 400)
  const options = (Array.isArray(e.options) ? e.options : []).map(o => chartLabel(o, 200)).filter(Boolean).slice(0, 6)
  const premises = (Array.isArray(e.premises) ? e.premises : []).map(o => chartLabel(o, 200)).filter(Boolean).slice(0, 5)
  const skills = [...new Set((Array.isArray(e.skills) ? e.skills : []).map(String).filter(s => CHART_SKILLS.includes(s)))]
  const format = inferFormat(e.format, stem, options, premises)
  const example: Record<string, unknown> = { stem, format, skills, options_count: [4, 5].includes(options.length) ? options.length : null, has_question: !!stem }
  return { chart, example }
}

const VISION_INSTRUCTIONS = `You read ONE page image of a student's uploaded document (lecture notes or a past exam) and extract every chart on it together with the exam question that uses it.
Return ONLY a JSON object {"items": [...]}, no markdown. One item per chart (bar, column, horizontal bar, stacked bar, line, area, pie, doughnut). Ignore photos, logos, tables without a chart, maps and scatter plots.
Item shape:
{"chart": {"type": "bar" | "line" | "pie", "title": "the chart's title exactly as printed, or a short description", "x_title": "", "y_title": "", "unit": "%" | "TL" | "$" | "" ...,
  "categories": ["x-axis / slice labels exactly as printed, left to right"],
  "series": [{"name": "legend name or empty", "values": [one number per category]}],
  "values_printed": true if the numbers are written on the chart or in a table on the page, false if you read them off the axis},
 "example": {"stem": "the question text that uses this chart, WITHOUT its options", "format": "which_true" | "which_false" | "premises" | "true_false" | "value" | "open" | "fill",
  "options": ["option texts"], "premises": ["I, II, III statement texts"], "skills": ["trend" | "extreme" | "compare" | "change" | "share" | "average" | "rank" | "gap"]} or null when no question uses the chart}
Formats: which_true = asks which statement is true / can be concluded; which_false = which is NOT true / cannot be concluded; premises = lists I, II, III statements and asks which are true; true_false = one statement, true or false; value = asks for a number; open = asks to interpret or explain in writing; fill = fill in the blank.
Skills: trend (rise/fall over time), extreme (highest/lowest), compare (one category vs another), change (amount or percent change), share (part of the whole), average, rank (order), gap (difference between two series).
At most 3 series and 24 categories per chart. Use a dot as the decimal separator in JSON numbers. Never invent a chart that is not on the page; if there is none return {"items": []}.`

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE)))
  return btoa(chunks.join(''))
}

async function uploadFileToPdfCo(fileBytes: Uint8Array, apiKey: string, filename: string): Promise<string | null> {
  try {
    const presignRes = await fetch(`https://api.pdf.co/v1/file/upload/get-presigned-url?name=${encodeURIComponent(filename)}`, { headers: { 'x-api-key': apiKey } })
    if (!presignRes.ok) return null
    const presignData = await presignRes.json()
    if (presignData.error || !presignData.presignedUrl || !presignData.url) return null
    const putRes = await fetch(presignData.presignedUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: fileBytes as unknown as BodyInit })
    return putRes.ok ? presignData.url as string : null
  } catch (_e) {
    return null
  }
}

/** Seçilen sayfaları (1'den başlayan) PNG'ye çevirir; sayfa sırasıyla URL'ler. */
async function convertPagesToPng(fileBytes: Uint8Array, pages: number[]): Promise<string[] | null> {
  const key = Deno.env.get('PDFCO_API_KEY')
  if (!key) { console.warn('extract-chart-items: PDFCO_API_KEY yok'); return null }
  const url = await uploadFileToPdfCo(fileBytes, key, 'document.pdf')
  if (!url) return null
  const res = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
    method: 'POST',
    headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, pages: pages.map(p => p - 1).join(',') })
  })
  if (!res.ok) { console.warn('extract-chart-items: PDF.co', res.status); return null }
  const data = await res.json()
  const raw = data.urls || data.url
  const urls: string[] = Array.isArray(raw) ? raw : raw ? [raw] : []
  return urls.length === pages.length ? urls : null
}

function groqWaitMs(status: number, retryAfter: string | null, message: unknown): number | null {
  if (status !== 429) return null
  let ms = Number(retryAfter) * 1000
  if (!Number.isFinite(ms) || ms <= 0) {
    // "37.65s", "1m2.5s", "2m", "750ms"
    const m = String(message ?? '').match(/try again in\s+(?:(\d+)m(?!s))?\s*(?:([\d.]+)s|(\d+)ms)?/i)
    if (m && (m[1] || m[2] || m[3])) ms = (Number(m[1] || 0) * 60 + Number(m[2] || 0)) * 1000 + Number(m[3] || 0)
  }
  return Number.isFinite(ms) && ms > 0 ? Math.min(GROQ_WAIT_CAP_MS, Math.ceil(ms) + 500) : 20_000
}

/** Tek sayfa görüntüsünü görsel modelle okur. */
async function readPage(b64: string, mime: string, page: number, pageText: string): Promise<{ items: unknown[] } | { waitMs: number } | { error: string }> {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) return { error: 'groq_key_missing' }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Görsel model (summarize-document ile aynı; ayrı TPM kotası).
      model: 'qwen/qwen3.8-27b',
      temperature: 0.1,
      reasoning_effort: 'none',
      max_completion_tokens: VISION_MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: VISION_INSTRUCTIONS },
        { role: 'user', content: [
          { type: 'text', text: `Page ${page}. Text extracted from this page (may be incomplete; trust the image):\n${pageText.slice(0, 2500)}` },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }
        ] }
      ]
    })
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const wait = groqWaitMs(res.status, res.headers.get('retry-after'), data?.error?.message)
    if (wait) return { waitMs: wait }
    return { error: `groq_${res.status}` }
  }
  try {
    const parsed = JSON.parse(String(data?.choices?.[0]?.message?.content || '').replace(/```json\s*|```/g, '').trim())
    return { items: Array.isArray(parsed?.items) ? parsed.items : [] }
  } catch (_e) {
    return { items: [] }
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Oturum gerekli.' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Oturum gerekli.' }, 401)

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'status')
    let documentId = typeof body.documentId === 'string' ? body.documentId : ''
    if (!documentId && typeof body.studyCardId === 'string') {
      const { data: card } = await userClient.from('study_cards').select('document_id').eq('id', body.studyCardId).maybeSingle()
      documentId = card && typeof card.document_id === 'string' ? card.document_id : ''
    }
    if (!documentId) return json({ error: 'Belge bulunamadı.' }, 400)
    // Sahiplik: belge kullanıcının (RLS).
    const { data: doc } = await userClient.from('documents').select('id, user_id, storage_path, mime_type').eq('id', documentId).maybeSingle()
    if (!doc || doc.user_id !== user.id) return json({ error: 'Belge bulunamadı ya da erişim yok.' }, 404)

    const loadState = async () => {
      const { data: scan } = await serviceClient.from('document_chart_scans').select('*').eq('document_id', documentId).maybeSingle()
      const { data: items } = await serviceClient.from('document_chart_items').select('id, page, chart, example').eq('document_id', documentId).order('page')
      return { scan, items: items || [] }
    }
    const summary = (scan: Record<string, unknown> | null, items: unknown[]) => ({
      status: scan ? scan.status : 'none',
      pages: scan ? scan.pages : [],
      done_pages: scan ? scan.next_index : 0,
      found: items.length,
      items: (items as Array<Record<string, unknown>>).map(it => ({ page: it.page, title: (it.chart as Record<string, unknown>).title, type: (it.chart as Record<string, unknown>).type, format: (it.example as Record<string, unknown>).format }))
    })

    let { scan, items } = await loadState()
    if (action === 'status') return json(summary(scan, items))
    if (action !== 'step') return json({ error: 'Geçersiz işlem.' }, 400)
    if (scan && scan.status === 'done') return json(summary(scan, items))

    // İlk adım (ya da başarısız taramayı yeniden başlatma): sayfaları seç, görüntüye çevir.
    if (!scan || scan.status === 'failed') {
      const mime = String(doc.mime_type || '').toLowerCase()
      const { data: fileBlob, error: dlErr } = await serviceClient.storage.from('documents').download(doc.storage_path)
      if (dlErr || !fileBlob) return json({ error: 'Belge indirilemedi.' }, 500)
      const bytes = new Uint8Array(await fileBlob.arrayBuffer())
      let pages: number[] = [1]
      let imageUrls: string[] = []
      if (mime === 'application/pdf') {
        const rows: ChunkRow[] = []
        for (let from = 0; from < 3000; from += 1000) {
          const { data } = await serviceClient.from('document_chunks').select('page_start, page_end, text').eq('document_id', documentId).order('chunk_index').range(from, from + 999)
          rows.push(...((data || []) as ChunkRow[]))
          if (!data || data.length < 1000) break
        }
        const texts = pageTexts(rows)
        const pageCount = Math.max(1, ...rows.map(r => Number(r.page_end || r.page_start || 1)))
        pages = selectCandidatePages(texts, pageCount)
        const urls = await convertPagesToPng(bytes, pages)
        if (!urls) {
          await serviceClient.from('document_chart_scans').upsert({ document_id: documentId, user_id: user.id, status: 'failed', pages, error: 'page_conversion_failed', updated_at: new Date().toISOString() })
          return json({ error: 'Sayfalar görüntüye çevrilemedi.' }, 502)
        }
        imageUrls = urls
      } else if (!mime.startsWith('image/')) {
        return json({ error: 'Grafik taraması yalnızca PDF ve görüntü dosyalarında yapılabilir.' }, 400)
      }
      await serviceClient.from('document_chart_items').delete().eq('document_id', documentId)
      const { data: created } = await serviceClient.from('document_chart_scans').upsert({ document_id: documentId, user_id: user.id, status: 'running', pages, image_urls: imageUrls, next_index: 0, found: 0, error: null, updated_at: new Date().toISOString() }).select('*').maybeSingle()
      return json(summary(created, []))
    }

    // Sonraki adım: sıradaki TEK sayfa.
    const pages = (scan.pages || []) as number[]
    const idx = Number(scan.next_index) || 0
    if (idx >= pages.length) {
      await serviceClient.from('document_chart_scans').update({ status: 'done', updated_at: new Date().toISOString() }).eq('document_id', documentId)
      ;({ scan, items } = await loadState())
      return json(summary(scan, items))
    }
    const page = pages[idx]
    let b64 = '', mime = 'image/png'
    const urls = (scan.image_urls || []) as string[]
    if (urls[idx]) {
      const imgRes = await fetch(urls[idx])
      if (imgRes.ok) b64 = bytesToBase64(new Uint8Array(await imgRes.arrayBuffer()))
    } else {
      const { data: fileBlob } = await serviceClient.storage.from('documents').download(doc.storage_path)
      if (fileBlob) { b64 = bytesToBase64(new Uint8Array(await fileBlob.arrayBuffer())); mime = String(doc.mime_type || 'image/png') }
    }
    if (!b64) {
      // Geçici görüntü adresinin süresi dolmuş olabilir: tarama baştan.
      await serviceClient.from('document_chart_scans').update({ status: 'failed', error: 'page_image_expired', updated_at: new Date().toISOString() }).eq('document_id', documentId)
      return json({ ...summary({ ...scan, status: 'failed' }, items), restart: true })
    }
    const { data: chunkRows } = await serviceClient.from('document_chunks').select('text').eq('document_id', documentId).eq('page_start', page).limit(5)
    const pageText = (chunkRows || []).map((r: Record<string, unknown>) => String(r.text || '')).join('\n')
    const read = await readPage(b64, mime, page, pageText)
    if ('waitMs' in read) return json({ ...summary(scan, items), wait_ms: read.waitMs })
    if ('error' in read) console.warn('extract-chart-items:', read.error)
    const found = ('items' in read ? read.items : []).map(normalizeScanItem).filter(Boolean) as Array<{ chart: Record<string, unknown>; example: Record<string, unknown> }>
    if (found.length) {
      await serviceClient.from('document_chart_items').insert(found.slice(0, 6).map(f => ({ document_id: documentId, user_id: user.id, page, chart: f.chart, example: f.example })))
    }
    const next = idx + 1
    await serviceClient.from('document_chart_scans').update({ next_index: next, found: (Number(scan.found) || 0) + found.length, status: next >= pages.length ? 'done' : 'running', updated_at: new Date().toISOString() }).eq('document_id', documentId)
    console.log(`extract-chart-items: sayfa ${page} (${next}/${pages.length}) → ${found.length} grafik`)
    ;({ scan, items } = await loadState())
    return json(summary(scan, items))
  } catch (err) {
    console.error('extract-chart-items error:', err)
    return json({ error: 'Beklenmeyen hata.' }, 500)
  }
})
