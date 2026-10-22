import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Defined once at module scope, with NO per-request interpolation (no
// language, no question count) so it is byte-identical on every single
// grade-exam call across the whole app -- the widest possible target for
// Groq's prompt caching (console.groq.com/docs/prompt-caching), since it
// doesn't even need two calls from the same course to line up, just two
// calls to this function at all. The per-request specifics (language,
// how many questions) move into the user message below.
const STATIC_GRADING_INSTRUCTIONS = `
You are an academic grader. You will be given a list of open-ended questions, their correct/sample reference answers, and the student's submitted answers. Some questions also carry a "rubric": a numbered list of criteria a full-marks answer must satisfy.

HOW TO GRADE:
- If a question has a rubric, judge EACH criterion separately and independently, in order, as one of:
  "met" (the answer clearly and correctly covers it), "partial" (touches it but incompletely or with an error), "missing" (absent or wrong).
  Judge only what the student actually wrote; do not reward length, confidence or repetition. A criterion is not "met" because the reference answer mentions it — the student's answer must.
  Give each criterion a short "note" (max 15 words) quoting or pointing to the part of the student's answer that decided it.
  Also give "score": your overall 0-100 estimate (used only if the criteria cannot be read).
- If a question has no rubric, grade it out of 100 on accuracy, depth and relevance against the reference answer.

RESPONSE FORMAT:
You must respond with ONLY a valid JSON object of the form {"grades": [ ... ]}, with no markdown code fences (do NOT use \`\`\`json or similar), no introductory or concluding text, and no conversational commentary.
The "grades" array must contain exactly one object per question given to you in the user message, each matching this JSON schema:
{
  "question_id": number,
  "criteria": [{"index": number (1-based, as given), "verdict": "met" | "partial" | "missing", "note": "string"}] | null (null when the question has no rubric),
  "score": number (0 to 100),
  "feedback": "string (1-2 sentences for the student: what was good and the single most important thing missing)"
}
`.trim()

// ==========================================================================
// FAZ 0 — SINAV BÜTÜNLÜĞÜ (14.10.2026)
//
//  - Cevap anahtarı artık exam_answer_keys tablosunda (bkz.
//    20261014_exam_integrity.sql). Anahtar satırı olmayan ESKİ sınavlar
//    cevapları exams.questions içinde taşıdığı için eskisi gibi puanlanır.
//  - Tamamlanmış sınav ikinci kez puanlanmaz (409). Tamamlama koşullu
//    güncelleme ile yapılır: aynı anda gelen iki gönderimden yalnızca biri
//    kazanır.
//  - Simülasyonda süre sunucuda kontrol edilir: started_at + süre + 2 dk
//    pay geçtiyse gönderim reddedilir. Tarayıcı süre bitince zaten
//    otomatik gönderdiği için dürüst bir öğrenci bu paya takılmaz.
//  - Metin karşılaştırması Türkçe harf duyarlı (normalizeAnswerText);
//    boşluk doldurmada kabul edilen alternatifler ve Türkçe karakter
//    yazmadan girilen cevaplar ("kirilma") da kabul edilir.
//  - Yapay zekânın puanlamadığı (atladığı) açık uçlu soru artık sessizce 0
//    sayılmıyor: bir kez daha istenir, yine gelmezse "puanlanamadı" olarak
//    işaretlenip ortalamadan çıkarılır.
//
// Aşağıdaki saf fonksiyonlar tests/exam-integrity.js tarafından kaynaktan
// çıkarılarak test ediliyor.
// ==========================================================================

const SIMULATION_GRACE_MS = 120_000

/** Cevap karşılaştırması için metin normalizasyonu: Unicode NFC, Türkçe
 *  küçük harf (I→ı, İ→i), baştaki/sondaki noktalama ve fazla boşluklar
 *  atılır. "KIRILMA".toLowerCase() "kirilma" verirdi; bu "kırılma" verir. */
function normalizeAnswerText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'“”‘’.,;:!?()\[\]]+|[\s"'“”‘’.,;:!?()\[\]]+$/g, '')
    .trim()
}

/** Türkçe karakterleri ASCII karşılığına indirir: Türkçe klavyesi olmayan
 *  öğrencinin "kirilma" yazması "kırılma" ile eşleşsin. Önce
 *  normalizeAnswerText uygulanır. */
function foldTurkish(value: unknown): string {
  return normalizeAnswerText(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
}

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

/** Gönderimin kabul edilip edilemeyeceği. nowMs testte sabitlenebilsin
 *  diye parametre. */
function checkSubmissionWindow(exam: Record<string, unknown>, nowMs: number): { ok: boolean; reason?: string } {
  if (exam.completed_at) return { ok: false, reason: 'already_completed' }
  const limit = Number(exam.time_limit_seconds)
  const started = exam.started_at ? Date.parse(String(exam.started_at)) : NaN
  if (exam.is_simulation && Number.isFinite(limit) && limit > 0 && Number.isFinite(started)) {
    if (nowMs > started + limit * 1000 + SIMULATION_GRACE_MS) return { ok: false, reason: 'time_expired' }
  }
  return { ok: true }
}

/** Soruyu cevap anahtarıyla birleştirir. Anahtar yoksa (eski sınav) soru
 *  olduğu gibi kullanılır. */
function mergeQuestionWithKey(q: Record<string, unknown>, keys: Record<string, Record<string, unknown>> | null): Record<string, unknown> {
  const key = keys ? keys[String(q.id)] : null
  return key ? { ...q, ...key } : q
}

/** Çoktan seçmeli / doğru-yanlış. */
function gradeChoice(studentAns: string, correctAns: string): boolean {
  const s = normalizeAnswerText(studentAns)
  return s !== '' && s === normalizeAnswerText(correctAns)
}

/** Boşluk doldurma: birebir (normalize), kabul edilen alternatifler, sonra
 *  Türkçe karakter katlaması. Dönen 'match' geri bildirimde kullanılır. */
function gradeFillBlank(studentAns: string, correctAns: string, accepted: unknown): { correct: boolean; match: 'exact' | 'alternative' | 'folded' | null } {
  const s = normalizeAnswerText(studentAns)
  if (!s) return { correct: false, match: null }
  const alts = Array.isArray(accepted) ? accepted.map(a => String(a ?? '')) : []
  if (s === normalizeAnswerText(correctAns)) return { correct: true, match: 'exact' }
  if (alts.some(a => s === normalizeAnswerText(a))) return { correct: true, match: 'alternative' }
  const f = foldTurkish(studentAns)
  if ([correctAns, ...alts].some(a => f === foldTurkish(a))) return { correct: true, match: 'folded' }
  return { correct: false, match: null }
}

/** Hesaplama: tolerans içinde tam puan, iki katı içinde yarım puan. Birim
 *  yüzdeyse "0,12" ile "12" karışıklığı da kabul edilir. */
function gradeCalculation(studentAns: unknown, correctAns: unknown, tolerancePercent: unknown, units: unknown): { score: number; studentNum: number; correctNum: number; tolPercent: number; percentScaled: boolean } {
  const studentNum = parseLooseNumber(studentAns)
  const correctNum = parseLooseNumber(correctAns)
  const tolRaw = Number(tolerancePercent)
  const tolPercent = Number.isFinite(tolRaw) && tolRaw > 0 ? tolRaw : 2
  if (!Number.isFinite(studentNum) || !Number.isFinite(correctNum)) {
    return { score: 0, studentNum, correctNum, tolPercent, percentScaled: false }
  }
  const tolRatio = tolPercent / 100
  const margin = correctNum !== 0 ? Math.abs(correctNum) * tolRatio : tolRatio
  const scoreFor = (value: number) => {
    const diff = Math.abs(value - correctNum)
    if (diff <= margin) return 100
    if (diff <= margin * 2) return 50
    return 0
  }
  let score = scoreFor(studentNum)
  let percentScaled = false
  if (score < 100 && /%|yüzde|percent/i.test(String(units ?? ''))) {
    const candidates = [studentNum * 100, studentNum / 100]
    for (const c of candidates) {
      const alt = scoreFor(c)
      if (alt > score) { score = alt; percentScaled = true }
    }
  }
  return { score, studentNum, correctNum, tolPercent, percentScaled }
}

/** Puanlayıcı yanıtını ayrıştırır: {"grades":[...]} veya düz dizi. */
type CriterionVerdict = { index: number; verdict: 'met' | 'partial' | 'missing'; note: string }
type ParsedGrade = { question_id: number; score: number; feedback: string; criteria: CriterionVerdict[] | null }

function parseGradesResponse(raw: string): ParsedGrade[] | null {
  const cleaned = String(raw || '').replace(/```json\s*|```/g, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (_e) {
    return null
  }
  let list: unknown = parsed
  if (!Array.isArray(list) && list && typeof list === 'object') {
    const obj = list as Record<string, unknown>
    list = Array.isArray(obj.grades) ? obj.grades : Object.values(obj).find(v => Array.isArray(v))
  }
  if (!Array.isArray(list)) return null
  const out: ParsedGrade[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const g = item as Record<string, unknown>
    const id = Number(g.question_id)
    const score = Number(g.score)
    const criteria = parseCriteria(g.criteria)
    if (!Number.isFinite(id) || (!Number.isFinite(score) && !criteria)) continue
    out.push({
      question_id: id,
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : NaN,
      feedback: String(g.feedback ?? ''),
      criteria
    })
  }
  return out
}

/** Modelin madde kararları. Tanınmayan karar atlanır. */
function parseCriteria(raw: unknown): CriterionVerdict[] | null {
  if (!Array.isArray(raw)) return null
  const out: CriterionVerdict[] = []
  raw.forEach((c, i) => {
    if (!c || typeof c !== 'object') return
    const rec = c as Record<string, unknown>
    const v = String(rec.verdict ?? '').trim().toLowerCase()
    const verdict = v === 'met' || v === 'partial' || v === 'missing' ? v : null
    if (!verdict) return
    const idx = Number(rec.index)
    out.push({ index: Number.isInteger(idx) && idx > 0 ? idx : i + 1, verdict, note: String(rec.note ?? '').trim().slice(0, 200) })
  })
  return out.length ? out : null
}

// ==========================================================================
// FAZ 2 — RUBRİKLE PUANLAMA (21.10.2026)
//
// Klasik soruda puanı artık model "uydurmuyor": soru üretilirken yazılan
// 3–5 maddelik rubriğin her maddesi için model yalnızca karar veriyor
// (karşılandı / kısmen / eksik), puan burada koddan hesaplanıyor. Ayrık
// kararlar + temperature 0 aynı cevabın iki puanlaması arasındaki farkı
// küçük tutuyor (yol haritası kontrolü: fark 10 puanı geçmemeli).
// Rubriği olmayan (eski) soru eskisi gibi bütüncül puanlanır.
// ==========================================================================
const GROQ_RETRY_MAX_WAIT_MS = 30_000

/** Groq 429 yanıtından beklenecek süre (ms); generate-exam'deki ile birebir
 *  aynı (tests/exam-feedback.js denetler). */
function groqRetryDelayMs(status: number, retryAfter: string | null, message: unknown): number | null {
  if (status !== 429) return null
  let ms = NaN
  const header = Number(retryAfter)
  if (retryAfter && Number.isFinite(header)) ms = header * 1000
  if (!Number.isFinite(ms)) {
    const m = String(message ?? '').match(/try again in\s+(?:(\d+)m)?\s*(?:([\d.]+)s|(\d+)ms)/i)
    if (m) ms = (Number(m[1] || 0) * 60 + Number(m[2] || 0)) * 1000 + Number(m[3] || 0)
  }
  if (!Number.isFinite(ms) || ms <= 0 || ms > GROQ_RETRY_MAX_WAIT_MS) return null
  return Math.ceil(ms) + 500
}

// 22.10.2026 (canlı test): model ara sıra doğru cevabı düz metin "null"
// olarak yazıyor (boşluk doldurma ve klasikte). Böyle bir değer cevap sayılmaz.
const PLACEHOLDER_ANSWERS = ['null', 'none', 'undefined', 'n/a', 'nan']

function isPlaceholderAnswer(value: unknown): boolean {
  if (typeof value === 'number') return false
  return PLACEHOLDER_ANSWERS.includes(normalizeAnswerText(value))
}

/** Puanlamada kullanılacak doğru cevap. Faz 2a'nın ilk sürümüyle üretilip
 *  anahtarı "null" kalmış sınavlar için: boşlukta ilk alternatif, klasikte
 *  açıklama. */
function effectiveCorrectAnswer(q: Record<string, unknown>): string {
  const raw = typeof q.correct_answer === 'number' ? String(q.correct_answer) : String(q.correct_answer ?? '').trim()
  if (!isPlaceholderAnswer(raw)) return raw
  if (q.type === 'fill_blank' && Array.isArray(q.accepted_answers)) {
    const alt = (q.accepted_answers as unknown[]).map(a => String(a ?? '').trim()).find(a => a && !isPlaceholderAnswer(a))
    if (alt) return alt
  }
  if (q.type === 'open_ended' && typeof q.explanation === 'string' && q.explanation.trim()) return q.explanation.trim()
  return ''
}

const VERDICT_SHARE: Record<string, number> = { met: 1, partial: 0.5, missing: 0 }

type RubricItem = { criterion: string; points: number }
type RubricResult = { criterion: string; points: number; verdict: 'met' | 'partial' | 'missing'; earned: number; note: string }

/** Rubrik + madde kararları → puan ve madde madde döküm. Her madde için
 *  karar yoksa null (çağıran bütüncül puana döner). */
function scoreFromRubric(rubric: RubricItem[], criteria: CriterionVerdict[] | null): { score: number; items: RubricResult[] } | null {
  if (!Array.isArray(rubric) || rubric.length === 0 || !criteria) return null
  const byIndex = new Map<number, CriterionVerdict>()
  for (const c of criteria) if (!byIndex.has(c.index)) byIndex.set(c.index, c)
  const items: RubricResult[] = []
  for (let i = 0; i < rubric.length; i++) {
    const c = byIndex.get(i + 1)
    if (!c) return null
    const points = Number(rubric[i].points) || 0
    const earned = Math.round(points * VERDICT_SHARE[c.verdict] * 10) / 10
    items.push({ criterion: rubric[i].criterion, points, verdict: c.verdict, earned, note: c.note })
  }
  const total = rubric.reduce((a, r) => a + (Number(r.points) || 0), 0) || 100
  const earnedSum = items.reduce((a, it) => a + it.earned, 0)
  return { score: Math.max(0, Math.min(100, Math.round(earnedSum * 100 / total))), items }
}

/** Sonuç kâğıdına giden öğretici alanlar (anahtardan; sınav tamamlandığı
 *  için artık gösterilebilir). */
function teachingFields(q: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (typeof q.explanation === 'string' && q.explanation) out.explanation = q.explanation
  if (q.option_rationales && typeof q.option_rationales === 'object') out.option_rationales = q.option_rationales
  if (q.source && typeof q.source === 'object') out.source = q.source
  return out
}

/** FAZ 1: soru bazında deneme satırları (question_attempts). Soru metni,
 *  öğrencinin cevabı, puan, ipucu ve işaret bilgisi. Cevap anahtarı da
 *  saklanır: sınav tamamlandığı için öğrenci bunu sonuç ekranında zaten
 *  gördü; hata defteri soruyu yeniden sorabilmek için buna ihtiyaç duyar. */
function buildAttemptRows(
  exam: Record<string, unknown>,
  questions: Record<string, unknown>[],
  results: Array<Record<string, unknown>>,
  flags: unknown,
  hintsUsed: unknown
): Record<string, unknown>[] {
  const flagSet = new Set((Array.isArray(flags) ? flags : []).map(String))
  const hintSet = new Set((Array.isArray(hintsUsed) ? hintsUsed : []).map(String))
  const byId = new Map(questions.map(q => [String(q.id), q]))
  return results.map(r => {
    const q = byId.get(String(r.question_id)) || {}
    return {
      user_id: exam.user_id,
      exam_id: exam.id,
      question_id: Number(r.question_id),
      question_type: String(r.type || q.type || 'unknown'),
      concept: (r.concept as string) || null,
      course_code: (exam.course_code as string) || null,
      study_card_id: exam.study_card_id != null ? String(exam.study_card_id) : null,
      language: (exam.language as string) || null,
      difficulty: (q.difficulty as string) || null,
      question: { question: q.question ?? r.question ?? '', options: q.options ?? null, units: q.units ?? null },
      answer_key: {
        correct_answer: q.correct_answer ?? r.correct_answer ?? null,
        accepted_answers: q.accepted_answers ?? null,
        solution_steps: q.solution_steps ?? null,
        tolerance_percent: q.tolerance_percent ?? null
      },
      student_answer: r.student_answer != null ? String(r.student_answer) : null,
      score: typeof r.score === 'number' ? r.score : null,
      is_correct: typeof r.is_correct === 'boolean' ? r.is_correct : null,
      hint_used: hintSet.has(String(r.question_id)),
      flagged: flagSet.has(String(r.question_id))
    }
  })
}

/** Nihai not: puanlanamayan (score === null) sorular ortalamaya girmez. */
function computeFinalGrade(results: Array<{ score: number | null }>): number | null {
  const scored = results.filter(r => typeof r.score === 'number') as Array<{ score: number }>
  if (scored.length === 0) return null
  return Math.round(scored.reduce((sum, r) => sum + r.score, 0) / scored.length)
}

// FAZ 2c: "yanlış doğruyu götürür". Ceza yalnızca çoktan seçmeli sorularda:
// net = doğru − yanlış / k (k: kaç yanlış bir doğruyu götürür), boş
// götürmez. Çoktan seçmeli kısmın katkısı max(0, net) × 100 — net eksiye
// düşse de öteki soru tiplerinin puanını silmez. Ayar yoksa ya da kapalıysa
// not computeFinalGrade ile birebir aynı.
type NetSummary = { enabled: boolean; wrong_per_correct: number; mc_total: number; correct: number; wrong: number; blank: number; net: number }

function computeNetSummary(results: Array<Record<string, unknown>>, scoring: unknown): NetSummary | null {
  const s = scoring && typeof scoring === 'object' ? scoring as Record<string, unknown> : null
  if (!s || s.negative_marking !== true) return null
  const k = [3, 4].includes(Number(s.wrong_per_correct)) ? Number(s.wrong_per_correct) : 4
  let correct = 0, wrong = 0, blank = 0, total = 0
  for (const r of results || []) {
    if (!r || r.type !== 'multiple_choice') continue
    total++
    if (!String(r.student_answer ?? '').trim()) blank++
    else if (r.is_correct === true || r.score === 100) correct++
    else wrong++
  }
  const net = Math.round((correct - wrong / k) * 100) / 100
  return { enabled: true, wrong_per_correct: k, mc_total: total, correct, wrong, blank, net }
}

function computeExamGrade(results: Array<Record<string, unknown>>, scoring: unknown): number | null {
  const base = computeFinalGrade(results as Array<{ score: number | null }>)
  const summary = computeNetSummary(results, scoring)
  if (base === null || !summary || summary.mc_total === 0) return base
  const scored = results.filter(r => typeof r.score === 'number')
  const otherSum = scored.filter(r => r.type !== 'multiple_choice').reduce((a, r) => a + (r.score as number), 0)
  return Math.round((otherSum + Math.max(0, summary.net) * 100) / scored.length)
}

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const { examId, answers, flags } = await req.json()
    if (!examId || !answers || typeof answers !== 'object') return json({ error: 'Missing required parameters' }, 400)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'Unauthorized user token' }, 401)

    // Sahiplik kontrolü kullanıcının kendi yetkisiyle (RLS) yapılır.
    const { data: exam, error: examError } = await userClient
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single()

    if (examError || !exam) {
      console.error("Exam ownership check failed: ", examError)
      return json({ error: 'Exam not found or access denied' }, 404)
    }
    if (exam.user_id !== user.id) return json({ error: 'Access denied: You do not own this exam' }, 403)

    const language = exam.language || 'en'
    const isTr = language === 'tr'

    const windowCheck = checkSubmissionWindow(exam, Date.now())
    if (!windowCheck.ok) {
      if (windowCheck.reason === 'already_completed') {
        return json({ error: isTr ? 'Bu sınav zaten tamamlanmış ve puanlanmış.' : 'This exam has already been submitted and graded.' }, 409)
      }
      return json({ error: isTr ? 'Sınav süresi doldu; bu deneme artık gönderilemez.' : 'The time limit for this exam has passed; it can no longer be submitted.' }, 403)
    }

    // Cevap anahtarı: önce ayrı tablo, yoksa eski düzen (sorunun içinde).
    let keys: Record<string, Record<string, unknown>> | null = null
    const { data: keyRow, error: keyError } = await serviceClient
      .from('exam_answer_keys')
      .select('keys')
      .eq('exam_id', exam.id)
      .maybeSingle()
    if (keyError) console.warn('grade-exam: exam_answer_keys okunamadi (migration calistirildi mi?):', keyError.message)
    if (keyRow && keyRow.keys && typeof keyRow.keys === 'object') keys = keyRow.keys as Record<string, Record<string, unknown>>

    const questions = ((exam.questions || []) as Record<string, unknown>[]).map(q => mergeQuestionWithKey(q, keys))

    type Result = Record<string, unknown> & { question_id: number; score: number | null }
    const results: Result[] = []
    const classicToGrade: Array<{ id: number; question: string; correct_answer: string; student_answer: string; concept: string | null; rubric: RubricItem[] | null; teach: Record<string, unknown> }> = []

    for (const q of questions) {
      const qid = Number(q.id)
      const studentAns = String((answers as Record<string, unknown>)[String(q.id)] ?? '').trim()
      const correctAns = effectiveCorrectAnswer(q)
      const base = {
        question_id: qid,
        type: q.type,
        question: q.question,
        options: q.options ?? null,
        concept: q.concept || null,
        student_answer: studentAns,
        ...teachingFields(q),
      }

      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        const isCorrect = gradeChoice(studentAns, correctAns)
        results.push({
          ...base,
          correct_answer: correctAns,
          is_correct: isCorrect,
          score: isCorrect ? 100 : 0,
          feedback: isCorrect
            ? (isTr ? "Tebrikler, doğru cevap!" : "Correct! Good job!")
            : (studentAns
                ? (isTr ? `Yanlış cevap. Doğru cevap: ${correctAns}` : `Incorrect. The correct answer is: ${correctAns}`)
                : (isTr ? `Boş bırakıldı. Doğru cevap: ${correctAns}` : `Left blank. The correct answer is: ${correctAns}`))
        })
      } else if (q.type === 'fill_blank') {
        const { correct, match } = gradeFillBlank(studentAns, correctAns, q.accepted_answers)
        let feedback: string
        if (correct && match === 'folded') {
          feedback = isTr ? `Doğru! (Yazımı: ${correctAns})` : `Correct! (Spelled: ${correctAns})`
        } else if (correct) {
          feedback = isTr ? "Tebrikler, boşluğu doğru tamamladınız!" : "Correct! Good job!"
        } else {
          feedback = isTr ? `Yanlış cevap. Doğru cevap: ${correctAns}` : `Incorrect. The correct answer is: ${correctAns}`
        }
        results.push({
          ...base,
          options: null,
          correct_answer: correctAns,
          is_correct: correct,
          score: correct ? 100 : 0,
          feedback
        })
      } else if (q.type === 'calculation') {
        const g = gradeCalculation(studentAns, q.correct_answer, q.tolerance_percent, q.units)
        const unitSuffix = q.units ? ` ${q.units}` : ''
        let feedback = ''
        if (g.score === 100) {
          feedback = isTr
            ? `Tebrikler! Hesaplamanız doğru (${studentAns}${unitSuffix}).`
            : `Correct! Excellent calculation (${studentAns}${unitSuffix}).`
          if (g.percentScaled) {
            feedback += isTr
              ? ` Not: cevap yüzde biçimine çevrilerek kabul edildi (${g.correctNum}${unitSuffix}).`
              : ` Note: accepted after converting to percent form (${g.correctNum}${unitSuffix}).`
          }
        } else if (g.score === 50) {
          feedback = isTr
            ? `Kısmi Doğru! Cevabınız (${studentAns}${unitSuffix}) doğru cevaba (${g.correctNum}${unitSuffix}) yakın ama ±%${g.tolPercent} toleransın dışında.`
            : `Close! Your answer (${studentAns}${unitSuffix}) is near the correct value (${g.correctNum}${unitSuffix}) but outside the ±${g.tolPercent}% tolerance.`
        } else {
          feedback = isTr
            ? `Yanlış cevap (${studentAns || '-'}${unitSuffix}). Doğru cevap: ${g.correctNum}${unitSuffix} (±%${g.tolPercent} tolerans).`
            : `Incorrect calculation (${studentAns || '-'}${unitSuffix}). Correct answer: ${g.correctNum}${unitSuffix} (±${g.tolPercent}% margin).`
        }
        results.push({
          ...base,
          options: null,
          correct_answer: g.correctNum,
          units: q.units || null,
          tolerance_percent: g.tolPercent,
          solution_steps: q.solution_steps || [],
          is_correct: g.score === 100,
          score: g.score,
          feedback
        })
      } else if (q.type === 'open_ended') {
        if (!studentAns) {
          results.push({
            ...base,
            options: null,
            student_answer: "",
            correct_answer: correctAns,
            is_correct: false,
            score: 0,
            rubric_results: Array.isArray(q.rubric) ? (q.rubric as RubricItem[]).map(r => ({ criterion: r.criterion, points: r.points, verdict: 'missing', earned: 0, note: '' })) : null,
            feedback: isTr ? "Bu soruya herhangi bir cevap verilmedi." : "No answer was provided for this question."
          })
        } else {
          classicToGrade.push({
            id: qid,
            question: String(q.question ?? ''),
            correct_answer: correctAns,
            student_answer: studentAns,
            concept: (q.concept as string) || null,
            rubric: Array.isArray(q.rubric) && q.rubric.length ? (q.rubric as RubricItem[]) : null,
            teach: teachingFields(q)
          })
        }
      }
    }

    // Açık uçlu soruları toplu puanla; atlanan varsa yalnızca onları bir
    // kez daha iste.
    if (classicToGrade.length > 0) {
      const groqApiKey = Deno.env.get('GROQ_API_KEY')
      if (!groqApiKey) return json({ error: 'Groq API key not configured' }, 500)

      const gradeBatch = async (batch: typeof classicToGrade, attempt = 0): Promise<ParsedGrade[] | null> => {
        // Only the truly per-request bits (language, how many questions, and
        // the student's own unique answers) go in the user message -- the
        // system message above stays fully static so it caches across every
        // grading call app-wide, not just repeats from the same student.
        const gradingUserPrompt = `Write the grading feedback strictly in the requested language: '${language}' (en = English, tr = Turkish).
Grade exactly these ${batch.length} question(s):
${JSON.stringify(batch.map(c => ({
  question_id: c.id,
  question: c.question,
  reference_answer: c.correct_answer,
  rubric: c.rubric ? c.rubric.map((r, i) => ({ index: i + 1, criterion: r.criterion, points: r.points })) : null,
  student_answer: c.student_answer
})))}`
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            // llama-3.3-70b-versatile was retired by Groq on 2026-08-16 — every
            // grading call was failing with a decommissioned-model error, so
            // submitted exams could never actually be graded.
            model: "openai/gpt-oss-120b",
            // FAZ 2: 0 — aynı cevap iki kez gönderilse aynı kararlar çıksın.
            temperature: 0,
            // Bütçe verilmezse Groq büyük bir varsayılan çıktı payını 8.000
            // TPM'den peşin ayırıyor (bkz. get-exam-hint). Düşünme payı
            // varsayılanda bırakıldı: madde kararlarının kalitesi önemli.
            max_completion_tokens: Math.min(6000, 1500 + 350 * batch.length),
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: STATIC_GRADING_INSTRUCTIONS },
              { role: "user", content: gradingUserPrompt }
            ]
          })
        })
        const groqData = await groqResponse.json().catch(() => ({}))
        if (!groqResponse.ok) {
          const waitMs = attempt === 0 ? groqRetryDelayMs(groqResponse.status, groqResponse.headers.get('retry-after'), groqData?.error?.message) : null
          if (waitMs !== null) {
            console.warn(`grade-exam: Groq hiz siniri, ${Math.round(waitMs / 1000)} sn beklenip yeniden deneniyor`)
            await new Promise(r => setTimeout(r, waitMs))
            return gradeBatch(batch, attempt + 1)
          }
          console.error("Groq AI grading failed: ", groqData)
          return null
        }
        const parsed = parseGradesResponse(groqData.choices?.[0]?.message?.content ?? "")
        if (!parsed) console.error("Failed to parse Groq grading response: ", String(groqData.choices?.[0]?.message?.content ?? '').slice(0, 2000))
        return parsed
      }

      const graded = new Map<number, { score: number; feedback: string; rubric_results: RubricResult[] | null }>()
      const absorb = (list: ParsedGrade[] | null) => {
        for (const g of list || []) {
          const c = classicToGrade.find(x => x.id === g.question_id)
          if (!c || graded.has(g.question_id)) continue
          const fromRubric = c.rubric ? scoreFromRubric(c.rubric, g.criteria) : null
          if (fromRubric) {
            graded.set(g.question_id, { score: fromRubric.score, feedback: g.feedback, rubric_results: fromRubric.items })
          } else if (Number.isFinite(g.score)) {
            if (c.rubric) console.warn(`grade-exam: soru ${g.question_id} icin rubrik kararlari eksik, butuncul puan kullanildi`)
            graded.set(g.question_id, { score: g.score, feedback: g.feedback, rubric_results: null })
          }
        }
      }

      absorb(await gradeBatch(classicToGrade))
      const missing = classicToGrade.filter(c => !graded.has(c.id))
      if (missing.length > 0) {
        console.warn(`grade-exam: ${missing.length} acik uclu soru puanlanmadi, yeniden isteniyor: ${missing.map(m => m.id).join(',')}`)
        absorb(await gradeBatch(missing))
      }

      for (const c of classicToGrade) {
        const g = graded.get(c.id)
        results.push({
          question_id: c.id,
          type: 'open_ended',
          question: c.question,
          options: null,
          concept: c.concept,
          student_answer: c.student_answer,
          correct_answer: c.correct_answer,
          ...c.teach,
          rubric_results: g ? g.rubric_results : null,
          is_correct: g ? g.score >= 50 : null,
          score: g ? g.score : null,
          grading_failed: !g,
          feedback: g
            ? g.feedback
            : (isTr ? 'Bu soru şu anda puanlanamadı; notunuza dahil edilmedi.' : 'This question could not be graded right now and was excluded from your grade.')
        })
      }
    }

    results.sort((a, b) => a.question_id - b.question_id)

    const finalGrade = computeExamGrade(results, exam.scoring)
    if (finalGrade === null) {
      // Hiçbir soru puanlanamadı (ör. yalnızca açık uçlu sorular vardı ve
      // puanlama servisi yanıt vermedi). Sınavı tamamlanmış sayma ki
      // öğrenci tekrar gönderebilsin.
      return json({ error: isTr ? 'Puanlama servisi şu anda yanıt vermiyor. Cevaplarınız kaybolmadı, lütfen tekrar gönderin.' : 'The grading service is not responding. Your answers are kept; please submit again.' }, 502)
    }

    // Koşullu tamamlama: completed_at hâlâ boşsa yaz. Aynı anda gelen ikinci
    // gönderim burada satır bulamaz ve 409 alır.
    const { data: updatedExam, error: updateError } = await serviceClient
      .from('exams')
      .update({
        answers: answers,
        question_results: results,
        grade: finalGrade,
        completed_at: new Date().toISOString()
      })
      .eq('id', examId)
      .is('completed_at', null)
      .select()
      .maybeSingle()

    if (updateError) {
      console.error("Failed to update graded exam record: ", updateError)
      return json({ error: 'Failed to save exam results' }, 500)
    }
    if (!updatedExam) {
      return json({ error: isTr ? 'Bu sınav zaten tamamlanmış ve puanlanmış.' : 'This exam has already been submitted and graded.' }, 409)
    }

    // FAZ 1: soru bazında kayıt + taslağı sil. İkisi de en iyi gayret:
    // başarısız olursa not yine kaydedilmiş durumda, öğrenci etkilenmez.
    try {
      const rows = buildAttemptRows(exam, questions, results, flags, exam.hints_used)
      if (rows.length > 0) {
        const { error: attemptsError } = await serviceClient
          .from('question_attempts')
          .upsert(rows, { onConflict: 'exam_id,question_id' })
        if (attemptsError) console.warn('grade-exam: question_attempts yazilamadi (20261014b_exam_engine.sql calistirildi mi?):', attemptsError.message)
      }
    } catch (e) {
      console.warn('grade-exam: question_attempts kaydi basarisiz:', e)
    }
    try {
      const { error: draftError } = await serviceClient.from('exam_drafts').delete().eq('exam_id', exam.id)
      if (draftError) console.warn('grade-exam: exam_drafts silinemedi:', draftError.message)
    } catch (_e) { /* tablo yoksa önemli değil */ }

    return json(updatedExam, 200)

  } catch (err) {
    console.error("grade-exam exception: ", err)
    return json({ error: 'Internal server error occurred' }, 500)
  }
})
