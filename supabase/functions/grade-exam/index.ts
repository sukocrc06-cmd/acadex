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

/** Cevaptaki sayı: "f'(2) = 76", "MR(8) = 18 TL" gibi yazımda son "=" ya da
 *  "≈" işaretinin sağındaki sayı (canlı test 27.10.2026: parseLooseNumber
 *  bunları 276 ve 818 okuyordu). Eşittir yoksa parseLooseNumber ile aynı. */
function answerNumber(value: unknown): number {
  if (typeof value === 'number') return parseLooseNumber(value)
  const s = String(value ?? '')
  const i = Math.max(s.lastIndexOf('='), s.lastIndexOf('≈'))
  const tail = i >= 0 ? s.slice(i + 1) : ''
  return /\d/.test(tail) ? parseLooseNumber(tail) : parseLooseNumber(s)
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

/* ==========================================================================
   FAZ 6.3 — ÖDEV: GEÇ TESLİM KESİNTİSİ VE GİZLİ CEVAPLAR (28.10.2026)
   Ödev sınavında (exams.assignment_id) öğretmenin kuralları:
   - geç teslim: son teslimden sonra her başlamış gün için %pct kesinti
     (teslim penceresi zaten süre olarak kurulur; pencere dışı gönderim
     simülasyon süre denetimine takılır)
   - cevaplar "son teslimden sonra" ya da "hiç" gösterilecekse exams satırına
     yalnızca puan ve doğru/yanlış yazılır; tam sonuç exam_hidden_results'ta,
     öğrenci reveal_at geçince okur. question_attempts'in anahtarı da boş.
   ========================================================================== */
const LATE_GRACE_MS = 120_000
const HIDDEN_KEEP = ['question_id', 'type', 'question', 'options', 'concept', 'student_answer', 'score', 'is_correct', 'chart', 'flagged', 'hint_used', 'units']

/** Teslim anına göre geç gün ve kesinti yüzdesi. nowMs testte sabitlenebilsin. */
function assignmentLatePenalty(asg: Record<string, unknown> | null, nowMs: number): { days: number; pct: number } {
  if (!asg || !asg.due_at) return { days: 0, pct: 0 }
  const due = Date.parse(String(asg.due_at))
  if (!Number.isFinite(due) || nowMs <= due + LATE_GRACE_MS) return { days: 0, pct: 0 }
  const late = asg.late && typeof asg.late === 'object' ? asg.late as Record<string, unknown> : null
  const days = Math.ceil((nowMs - due) / 86_400_000)
  if (!late) return { days, pct: 0 }
  return { days, pct: Math.min(100, Math.max(0, Number(late.pct) || 0) * days) }
}

/** Cevaplar gizliyken öğrencinin göreceği sonuç: puan ve doğru/yanlış, anahtar yok. */
function redactAssignmentResult(r: Record<string, unknown>, isTr: boolean): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const k of HIDDEN_KEEP) if (k in r) o[k] = r[k]
  const blank = !String(r.student_answer ?? '').trim()
  const sc = typeof r.score === 'number' ? r.score : null
  o.feedback = blank ? (isTr ? 'Boş bırakıldı.' : 'Left blank.')
    : sc == null ? (isTr ? 'Puanlanamadı.' : 'Not graded.')
    : sc >= 80 ? (isTr ? 'Doğru.' : 'Correct.') : sc >= 50 ? (isTr ? 'Kısmen doğru.' : 'Partially correct.') : (isTr ? 'Yanlış.' : 'Incorrect.')
  o.answers_hidden = true
  return o
}

/** Gizli sonuç ne zaman açılır: teslim edince (gizli değil) / pencere bitince / hiç (null). */
function assignmentReveal(asg: Record<string, unknown> | null): { hidden: boolean; revealAt: string | null } {
  const mode = asg ? String(asg.show_answers || 'after_due') : 'after_submit'
  if (!asg || mode === 'after_submit') return { hidden: false, revealAt: null }
  if (mode === 'never') return { hidden: true, revealAt: null }
  return { hidden: true, revealAt: String(asg.window_end || asg.due_at || '') || null }
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

/** FAZ 3c: sınavın sayı hassasiyeti (exams.scoring.decimal_places): 2, 3
 *  ya da 4; yoksa null (standart yüzde pay). */
function decimalPlacesOf(scoring: unknown): number | null {
  const n = scoring && typeof scoring === 'object' ? Number((scoring as Record<string, unknown>).decimal_places) : NaN
  return [2, 3, 4].includes(n) ? n : null
}

/** FAZ 3c: hassas hesap notu. Virgülden sonra d basamak doğru olmalı:
 *  doğru cevaptan en çok yarım son basamak sapma tam puan (3 basamakta
 *  ±0,0005), bir basamak eksik doğruluk yarım puan. Birim yüzdeyse "0,12"
 *  ile "12" karışıklığı da kabul edilir. */
function gradeCalculationPrecise(studentAns: unknown, correctAns: unknown, decimals: number, units: unknown): { score: number; studentNum: number; correctNum: number; percentScaled: boolean } {
  const studentNum = answerNumber(studentAns)
  const exact = answerNumber(correctAns)
  const correctNum = Number.isFinite(exact) ? Number(exact.toFixed(decimals)) : exact
  if (!Number.isFinite(studentNum) || !Number.isFinite(exact)) return { score: 0, studentNum, correctNum, percentScaled: false }
  const eps = 1e-9 * Math.max(1, Math.abs(exact))
  const scoreFor = (v: number) => {
    const diff = Math.abs(v - exact)
    if (diff <= 0.5 * Math.pow(10, -decimals) + eps) return 100
    if (diff <= 0.5 * Math.pow(10, -(decimals - 1)) + eps) return 50
    return 0
  }
  let score = scoreFor(studentNum)
  let percentScaled = false
  if (score < 100 && /%|yüzde|percent/i.test(String(units ?? ''))) {
    for (const c of [studentNum * 100, studentNum / 100]) {
      const alt = scoreFor(c)
      if (alt > score) { score = alt; percentScaled = true }
    }
  }
  return { score, studentNum, correctNum, percentScaled }
}

/** Hesaplama: tolerans içinde tam puan, iki katı içinde yarım puan. Birim
 *  yüzdeyse "0,12" ile "12" karışıklığı da kabul edilir. */
function gradeCalculation(studentAns: unknown, correctAns: unknown, tolerancePercent: unknown, units: unknown): { score: number; studentNum: number; correctNum: number; tolPercent: number; percentScaled: boolean } {
  const studentNum = answerNumber(studentAns)
  const correctNum = answerNumber(correctAns)
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

// ==========================================================================
// FAZ 3a — KODLA DOĞRULANAN HESAP: güvenli ifade hesaplayıcı (22.10.2026)
//
// Model hesap sorusu için değişkenleri ve formülü yazar, cevabı burada kod
// hesaplar. eval YOK: yalnızca sayılar, değişken adları, + - * / ^ (ya da
// **), parantez ve aşağıdaki fonksiyonlar. Herhangi bir hata NaN döner.
// generate-exam ve grade-exam'de BİREBİR aynı (tests/exam-calc.js denetler);
// tarayıcı kopyası js/exam-engine.js'te, aynı test vektörleriyle denetlenir.
// ==========================================================================
const EXPR_MAX_LENGTH = 400
const EXPR_MAX_DEPTH = 40
const EXPR_CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E }
const EXPR_FUNCS: Record<string, { min: number; max: number; fn: (...a: number[]) => number }> = {
  sqrt: { min: 1, max: 1, fn: Math.sqrt },
  abs: { min: 1, max: 1, fn: Math.abs },
  ln: { min: 1, max: 1, fn: Math.log },
  log: { min: 1, max: 1, fn: Math.log10 },
  log10: { min: 1, max: 1, fn: Math.log10 },
  exp: { min: 1, max: 1, fn: Math.exp },
  floor: { min: 1, max: 1, fn: Math.floor },
  ceil: { min: 1, max: 1, fn: Math.ceil },
  min: { min: 1, max: 12, fn: Math.min },
  max: { min: 1, max: 12, fn: Math.max },
  pow: { min: 2, max: 2, fn: Math.pow },
  round: { min: 1, max: 2, fn: (x: number, d = 0) => { const f = Math.pow(10, Math.round(d)); return Math.round(x * f) / f } },
  // Finans (Excel adları, işaretsiz: tutarlar pozitif döner). rate dönem faizi
  // (0.005 gibi), nper dönem sayısı. npv Excel gibi ilk akışı 1. dönem sayar.
  pmt: { min: 3, max: 3, fn: (r: number, n: number, p: number) => Math.abs(r === 0 ? p / n : p * r / (1 - Math.pow(1 + r, -n))) },
  pv: { min: 3, max: 3, fn: (r: number, n: number, a: number) => Math.abs(r === 0 ? a * n : a * (1 - Math.pow(1 + r, -n)) / r) },
  fv: { min: 3, max: 4, fn: (r: number, n: number, a: number, p = 0) => r === 0 ? Math.abs(a) * n + Math.abs(p) : Math.abs(a) * (Math.pow(1 + r, n) - 1) / r + Math.abs(p) * Math.pow(1 + r, n) },
  npv: { min: 2, max: 13, fn: (r: number, ...cf: number[]) => cf.reduce((s, c, i) => s + c / Math.pow(1 + r, i + 1), 0) },
  // Faz 3b: cebirsel ifadeler için trigonometri (radyan).
  sin: { min: 1, max: 1, fn: Math.sin },
  cos: { min: 1, max: 1, fn: Math.cos },
  tan: { min: 1, max: 1, fn: Math.tan },
  asin: { min: 1, max: 1, fn: Math.asin },
  acos: { min: 1, max: 1, fn: Math.acos },
  atan: { min: 1, max: 1, fn: Math.atan }
}

/** Formülü değişkenlerle hesaplar. Geçersiz ifade, bilinmeyen ad, sonsuz
 *  ya da tanımsız sonuç → NaN. */
function evaluateExpression(src: unknown, vars: Record<string, number>): number {
  const text = String(src ?? '')
  if (!text.trim() || text.length > EXPR_MAX_LENGTH) return NaN
  const tokens: Array<{ t: string; v: string }> = []
  const re = /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|[-+*/^(),]))/y
  let pos = 0
  while (pos < text.length) {
    if (/^\s*$/.test(text.slice(pos))) break
    re.lastIndex = pos
    const m = re.exec(text)
    if (!m) return NaN
    if (m[1] !== undefined) tokens.push({ t: 'num', v: m[1] })
    else if (m[2] !== undefined) tokens.push({ t: 'id', v: m[2] })
    else tokens.push({ t: 'op', v: m[3] === '**' ? '^' : m[3] })
    pos = re.lastIndex
  }
  let i = 0
  const peek = () => tokens[i]
  const isOp = (v: string) => !!tokens[i] && tokens[i].t === 'op' && tokens[i].v === v
  const fail = (): never => { throw new Error('expr') }
  const expr = (d: number): number => {
    if (d > EXPR_MAX_DEPTH) fail()
    let v = term(d + 1)
    while (isOp('+') || isOp('-')) { const op = tokens[i++].v; const r = term(d + 1); v = op === '+' ? v + r : v - r }
    return v
  }
  const term = (d: number): number => {
    let v = unary(d + 1)
    while (isOp('*') || isOp('/')) { const op = tokens[i++].v; const r = unary(d + 1); v = op === '*' ? v * r : v / r }
    return v
  }
  const unary = (d: number): number => {
    if (d > EXPR_MAX_DEPTH) fail()
    if (isOp('-')) { i++; return -unary(d + 1) }
    if (isOp('+')) { i++; return unary(d + 1) }
    return power(d + 1)
  }
  const power = (d: number): number => {
    const base = primary(d + 1)
    if (isOp('^')) { i++; return Math.pow(base, unary(d + 1)) }
    return base
  }
  const primary = (d: number): number => {
    if (d > EXPR_MAX_DEPTH) fail()
    const tk = peek()
    if (!tk) return fail()
    if (tk.t === 'num') { i++; return Number(tk.v) }
    if (tk.t === 'op' && tk.v === '(') { i++; const v = expr(d + 1); if (!isOp(')')) fail(); i++; return v }
    if (tk.t === 'id') {
      i++
      if (isOp('(')) {
        const fname = tk.v.toLowerCase()
        const f = Object.prototype.hasOwnProperty.call(EXPR_FUNCS, fname) ? EXPR_FUNCS[fname] : null
        if (!f) fail()
        i++
        const args: number[] = []
        if (!isOp(')')) {
          args.push(expr(d + 1))
          while (isOp(',')) { i++; args.push(expr(d + 1)) }
        }
        if (!isOp(')')) fail()
        i++
        if (args.length < f.min || args.length > f.max) fail()
        return f.fn(...args)
      }
      if (Object.prototype.hasOwnProperty.call(vars, tk.v)) return Number(vars[tk.v])
      if (Object.prototype.hasOwnProperty.call(EXPR_CONSTS, tk.v)) return EXPR_CONSTS[tk.v]
      return fail()
    }
    return fail()
  }
  try {
    const v = expr(0)
    if (i !== tokens.length) return NaN
    return Number.isFinite(v) ? v : NaN
  } catch (_e) {
    return NaN
  }
}

/** Modelin verdiği değişkenler: ad → sonlu sayı. Geçersiz ad ya da değer
 *  atılır; sabit adları (pi, e) değişken olamaz. Fonksiyon adı değişken
 *  olabilir (PV gibi): ayrıştırıcı "ad(" ile "ad"ı ayırır. En fazla 10. */
function sanitizeVariables(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(k)) continue
    if (Object.prototype.hasOwnProperty.call(EXPR_CONSTS, k)) continue
    const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
    if (!Number.isFinite(n)) continue
    out[k] = n
    if (Object.keys(out).length >= 10) break
  }
  return out
}

// ==========================================================================
// FAZ 3b — CEBİRSEL İFADE: öğrenci yazımı, denklik, biçim (23.10.2026)
//
// Öğrencinin yazdığı ifade ("2x(x+1)", "sinx", "√x", "x²", "0,5x") önce
// açık bir ifadeye çevrilir ("2*x*(x+1)"), sonra evaluateExpression ile
// sabit örnek noktalarda referansla karşılaştırılır (LLM yok, rastgelelik
// yok: aynı cevap her zaman aynı notu alır). generate-exam ve grade-exam'de
// BİREBİR aynı (tests/exam-expression.js denetler); tarayıcı kopyası
// js/exam-engine.js'te, aynı test vektörleriyle denetlenir.
// ==========================================================================
const MATH_INPUT_MAX = 200
const EXPR_SAMPLE_VALUES = [0.37, 1.13, 2.71, 0.83, 1.9, 3.3, 0.61, 2.17, 1.47, 0.29]
const EXPR_MIN_VALID_POINTS = 5
const EXPR_FORMS = ['any', 'factored', 'expanded', 'simplified']

/** Öğrenci yazımını hesaplayıcının anladığı açık ifadeye çevirir: örtük
 *  çarpma, "sinx" → sin(x), √ π ² ³, ondalık virgül. Okunamazsa ''. */
function normalizeMathInput(src: unknown, varNames: string[]): string {
  let s = String(src ?? '').trim()
  if (!s || s.length > MATH_INPUT_MAX) return ''
  s = s.replace(/[·×∙⋅]/g, '*').replace(/÷/g, '/').replace(/[−–—]/g, '-')
    .replace(/π/g, ' pi ').replace(/√/g, ' sqrt ').replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/[[{]/g, '(').replace(/[\]}]/g, ')').replace(/(\d),(\d)/g, '$1.$2')
  const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k)
  const vars = (Array.isArray(varNames) ? varNames : []).filter(v => typeof v === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v))
  const words = [...vars, ...Object.keys(EXPR_FUNCS), ...Object.keys(EXPR_CONSTS)].sort((a, b) => b.length - a.length)
  type Tok = { k: string; v: string }
  const raw: Tok[] = []
  const re = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|[-+*/^(),]))/y
  let pos = 0
  while (pos < s.length) {
    if (/^\s*$/.test(s.slice(pos))) break
    re.lastIndex = pos
    const m = re.exec(s)
    if (!m) return ''
    pos = re.lastIndex
    if (m[1] !== undefined) { raw.push({ k: 'num', v: m[1] }); continue }
    if (m[3] !== undefined) {
      const o = m[3] === '**' ? '^' : m[3]
      raw.push({ k: o === '(' ? 'lp' : o === ')' ? 'rp' : o === ',' ? 'comma' : 'op', v: o })
      continue
    }
    // Ad: değişken, fonksiyon ya da sabit; bitişik yazılmışsa ("xsinx",
    // "2pix") en uzun eşleşmeyle parçalanır. Parçalanamayan ad okunamaz.
    let id = m[2]
    while (id) {
      const low = id.toLowerCase()
      const w = words.find(x => (has(EXPR_FUNCS, x) && !vars.includes(x)) ? low.startsWith(x) : id.startsWith(x))
      if (!w) return ''
      raw.push(has(EXPR_FUNCS, w) && !vars.includes(w) ? { k: 'fn', v: w } : { k: 'var', v: w })
      id = id.slice(w.length)
    }
  }
  const out: Tok[] = []
  const push = (t: Tok) => {
    const p = out[out.length - 1]
    const endsAtom = !!p && (p.k === 'num' || p.k === 'var' || p.k === 'rp')
    const startsAtom = t.k === 'var' || t.k === 'fn' || t.k === 'lp' || (t.k === 'num' && !!p && p.k !== 'num')
    if (endsAtom && startsAtom) out.push({ k: 'op', v: '*' })
    out.push(t)
  }
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i]
    const nx = raw[i + 1]
    // Üslü fonksiyon: "sin²x", "cos^2(x)" → sin(x)^2.
    if (t.k === 'fn' && nx && nx.k === 'op' && nx.v === '^' && raw[i + 2] && raw[i + 2].k === 'num' && raw[i + 3]) {
      const ex = raw[i + 2]
      let j = i + 3
      let arg: Tok[]
      if (raw[j].k === 'lp') {
        let depth = 0
        let e = j
        for (; e < raw.length; e++) {
          if (raw[e].k === 'lp') depth++
          else if (raw[e].k === 'rp' && --depth === 0) break
        }
        if (e >= raw.length) return ''
        arg = raw.slice(j + 1, e)
        j = e
      } else if (raw[j].k === 'num' || raw[j].k === 'var') {
        arg = [raw[j]]
      } else return ''
      push(t); push({ k: 'lp', v: '(' })
      for (const a of arg) push(a)
      push({ k: 'rp', v: ')' }); push(nx); push(ex)
      i = j
      continue
    }
    // Parantezsiz fonksiyon: "sin x", "ln2" → sin(x), ln(2) (yalnızca tek terim).
    if (t.k === 'fn' && nx && nx.k !== 'lp') {
      if (nx.k !== 'num' && nx.k !== 'var') return ''
      push(t); push({ k: 'lp', v: '(' }); push(nx); push({ k: 'rp', v: ')' })
      i++
      continue
    }
    push(t)
  }
  return out.map((t, i) => (i > 0 && t.k === 'num' && out[i - 1].k === 'num' ? ' ' : '') + t.v).join('')
}

/** Değişkenlere sabit örnek değerler (pozitif; ln, √ gibi tanım kümeleri için). */
function exprSamplePoints(varNames: string[]): Array<Record<string, number>> {
  const pts: Array<Record<string, number>> = []
  for (let k = 0; k < EXPR_SAMPLE_VALUES.length; k++) {
    const p: Record<string, number> = {}
    varNames.forEach((v, j) => { p[v] = EXPR_SAMPLE_VALUES[(k + 3 * j) % EXPR_SAMPLE_VALUES.length] + 0.05 * j })
    pts.push(p)
  }
  return pts
}

/** İki açık ifade örnek noktalarda aynı mı. upToConstant: belirsiz integral
 *  gibi, aralarındaki fark sabitse denk. Referans yeterince noktada
 *  hesaplanamıyorsa 'invalid'. */
function expressionsEquivalent(student: string, reference: string, varNames: string[], upToConstant = false): 'equal' | 'different' | 'invalid' {
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))
  let valid = 0
  let offset = NaN
  for (const p of exprSamplePoints(varNames)) {
    const r = evaluateExpression(reference, p)
    if (!Number.isFinite(r)) continue
    const a = evaluateExpression(student, p)
    if (!Number.isFinite(a)) return 'different'
    valid++
    if (upToConstant && Number.isNaN(offset)) offset = a - r
    if (!close(upToConstant ? a - offset : a, r)) return 'different'
  }
  return valid >= EXPR_MIN_VALID_POINTS ? 'equal' : 'invalid'
}

/** Açık ifadenin en dış düzeyinde (parantez dışında) toplama ya da
 *  çıkarma var mı (baştaki eksi işareti sayılmaz). */
function hasTopLevelSum(s: string): boolean {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (depth === 0 && (c === '+' || c === '-') && i > 0 && !/[(*/^,+\-]/.test(s[i - 1])) return true
  }
  return false
}

/** Açılmış biçim: toplam içeren bir parantez çarpılmıyor ya da üssü
 *  alınmıyor ("1/(x+1)" ve fonksiyon argümanları serbest). */
function isExpandedForm(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '(' || (i > 0 && /[A-Za-z0-9_]/.test(s[i - 1]))) continue
    let depth = 0
    let j = i
    for (; j < s.length; j++) {
      if (s[j] === '(') depth++
      else if (s[j] === ')' && --depth === 0) break
    }
    if (hasTopLevelSum(s.slice(i + 1, j)) && (s[i - 1] === '*' || s[j + 1] === '*' || s[j + 1] === '^')) return false
  }
  return true
}

function exprTokenCount(s: string): number {
  return (s.match(/\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|\S/g) || []).length
}

/** Denk bir cevap istenen biçimde mi. given: soruda verilen ifade; aynen
 *  geri yazmak cevap sayılmaz (ör. "x^2-1 i çarpanlarına ayır"). */
function checkExpressionForm(student: string, form: string, reference: string, given: string): boolean {
  if (given && student === given) return false
  if (form === 'factored') return !hasTopLevelSum(student)
  if (form === 'expanded') return isExpandedForm(student)
  if (form === 'simplified') return exprTokenCount(student) <= exprTokenCount(reference) + 2
  return true
}

/** FAZ 3b: ifade cevabını kodla puanlar (yalnızca grade-exam). Denk ve
 *  istenen biçimde 100; denk ama biçim yanlış 50; verilen ifadeyi aynen
 *  yazmak, denk olmayan ya da okunamayan cevap 0. Referans hesaplanamıyorsa
 *  puan null (soru nota katılmaz). */
function gradeExpression(studentRaw: unknown, q: Record<string, unknown>): { score: number | null; verdict: string; normalized: string; reference: string } {
  const vars = Array.isArray(q.expr_vars) ? (q.expr_vars as unknown[]).map(v => String(v ?? '')) : []
  const reference = normalizeMathInput(q.correct_answer, vars)
  let raw = String(studentRaw ?? '').trim()
  if (!raw) return { score: 0, verdict: 'blank', normalized: '', reference }
  const upToConstant = q.up_to_constant === true
  if (upToConstant && !vars.includes('C') && !vars.includes('c')) raw = raw.replace(/\s*\+\s*[cC]\s*$/, '')
  const student = normalizeMathInput(raw, vars)
  if (!student) return { score: 0, verdict: 'unreadable', normalized: '', reference }
  const eq = expressionsEquivalent(student, reference, vars, upToConstant)
  if (eq === 'invalid') return { score: null, verdict: 'invalid', normalized: student, reference }
  const given = q.given ? normalizeMathInput(q.given, vars) : ''
  if (given && student === given) return { score: 0, verdict: 'copied', normalized: student, reference }
  if (eq === 'different') return { score: 0, verdict: 'wrong', normalized: student, reference }
  const form = EXPR_FORMS.includes(String(q.form)) ? String(q.form) : 'any'
  if (!checkExpressionForm(student, form, reference, given)) return { score: 50, verdict: 'wrong_form', normalized: student, reference }
  return { score: 100, verdict: 'correct', normalized: student, reference }
}

/** FAZ 4a: açık uçlu grafik sorusunda puanlayıcı model grafiği göremez;
 *  verileri metin olarak soruya eklenir. */
function chartAsText(chart: unknown): string {
  if (!chart || typeof chart !== 'object') return ''
  const c = chart as { title?: unknown; labels?: unknown; series?: unknown; unit?: unknown }
  const labels = Array.isArray(c.labels) ? c.labels.map(String) : []
  const series = Array.isArray(c.series) ? c.series as Array<{ name?: unknown; data?: unknown }> : []
  if (!labels.length || !series.length) return ''
  const lines = series.map(sr => `${String(sr.name || 'değerler')}: ` + labels.map((l, i) => `${l}=${Array.isArray(sr.data) ? sr.data[i] : ''}`).join(', '))
  return `\n[Öğrencinin gördüğü grafik "${String(c.title || '')}"${c.unit ? ` (${String(c.unit)})` : ''}: ${lines.join('; ')}]`
}

/** FAZ 3a: öğrencinin yanlış sayısı, sorunun tipik hata formüllerinden
 *  birine uyuyorsa o hatanın mesajı. */
function matchCommonError(studentAns: unknown, q: Record<string, unknown>): string | null {
  const student = answerNumber(studentAns)
  if (!Number.isFinite(student) || !Array.isArray(q.common_errors)) return null
  const vars = sanitizeVariables(q.variables)
  const tolRaw = Number(q.tolerance_percent)
  const tol = Number.isFinite(tolRaw) && tolRaw > 0 ? tolRaw : 2
  for (const ce of q.common_errors as unknown[]) {
    if (!ce || typeof ce !== 'object') continue
    const rec = ce as Record<string, unknown>
    const v = evaluateExpression(rec.formula, vars)
    if (!Number.isFinite(v)) continue
    const margin = v !== 0 ? Math.abs(v) * tol / 100 : tol / 100
    if (Math.abs(student - v) <= margin && typeof rec.message === 'string' && rec.message.trim()) return rec.message.trim()
  }
  return null
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
const GROQ_RETRY_MAX_WAIT_MS = 45_000

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

// ==========================================================================
// FAZ 4b — ÇİZİM PUANLAMASI (24.10.2026)
//
// LLM yok: öğrencinin çizdiği nesneler cevap öğeleriyle geometrik olarak
// karşılaştırılır. Kurallar:
//   - Doğru: öğrencinin iki noktası da doğrunun üstündeyse doğru (hangi iki
//     nokta olduğu önemsiz). Eğim doğru ama kaymışsa ya da bir noktası doğru
//     ama eğimi farklıysa yarım.
//   - Nokta: yarım ızgara adımı içinde. Yalnızca x ya da yalnızca y doğruysa yarım.
//   - Kaydırma (yalnızca yön sorulmuşsa): verilene paralel ve doğru yönde.
//   - Parabol / çember: tepe ya da merkez + biçim / yarıçap; biri doğruysa yarım.
//   - Alan ve bölge: örnek noktalarla örtüşme (alan ≥ %90, bölge ≥ %97 tam).
//   - Etiket istenmişse ve yanlışsa öğenin yarısı; kesikli/düz yanlışsa ¾.
//   - Fazladan çizim: puan öğe sayısı + fazlalar üzerinden hesaplanır.
//   - Aynı nesneyi iki kez çizmek ceza değildir (tekrar yok sayılır).
// Sonuç her öğe için ad, kredi ve not taşır; sonuç kâğıdı bunları gösterir.
// ==========================================================================
const GRAPH_STUDENT_MAX_OBJECTS = 20
const GRAPH_STUDENT_KINDS = ['point', 'line', 'segment', 'ray', 'parabola', 'circle', 'polygon', 'fill']
type GraphPt = number[]
type GraphAx = { min: number; max: number; step: number; snap: number; label?: string; var?: string }
type GraphIq = { a: number; b: number; c: number; op: string }
type GraphEl = { kind: string; points: GraphPt[]; label?: string; style?: string; ineq?: GraphIq[]; shift?: { of: number; dir: string } }
type GraphStu = { kind: string; points: GraphPt[]; label: string; dashed: boolean }
type GraphElResult = { name: string; credit: number; note: string }

/** Öğrencinin cevabı: {"v":1,"o":[{"k":"line","p":[[x,y],[x,y]],"l":"D2","d":0}],"none":false}. */
function graphParseStudent(raw: unknown): { objs: GraphStu[]; none: boolean } {
  let d: Record<string, unknown> | null = null
  try { d = typeof raw === 'string' ? (raw.trim() ? JSON.parse(raw) : null) : (raw as Record<string, unknown>) } catch (_e) { d = null }
  const objs: GraphStu[] = []
  const list = d && Array.isArray(d.o) ? (d.o as unknown[]) : []
  for (const item of list.slice(0, GRAPH_STUDENT_MAX_OBJECTS)) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const kind = String(o.k ?? '')
    if (!GRAPH_STUDENT_KINDS.includes(kind)) continue
    const pts = (Array.isArray(o.p) ? o.p : []).slice(0, 12).map(p => Array.isArray(p) && p.length === 2 ? [Number(p[0]), Number(p[1])] : null)
    if (pts.some(p => !p || !p.every(Number.isFinite))) continue
    if (kind === 'polygon' ? pts.length < 3 : pts.length !== (kind === 'point' || kind === 'fill' ? 1 : 2)) continue
    objs.push({ kind, points: pts as GraphPt[], label: String(o.l ?? '').slice(0, 12), dashed: o.d === 1 || o.d === true })
  }
  return { objs, none: !!(d && d.none === true) }
}

function graphLabelKey(s: unknown): string {
  return String(s ?? '').toLocaleLowerCase('tr-TR').replace(/[₀-₉]/g, c => String(c.charCodeAt(0) - 0x2080)).replace(/[\s_\-.*]/g, '')
}

const GRAPH_EL_NAMES: Record<string, [string, string]> = {
  point: ['Nokta', 'Point'], line: ['Doğru', 'Line'], segment: ['Doğru parçası', 'Segment'], ray: ['Işın', 'Ray'],
  parabola: ['Parabol', 'Parabola'], circle: ['Çember', 'Circle'], polygon: ['Alan', 'Area'], fill: ['Boyalı bölge', 'Shaded region']
}

function graphFmt(v: number, tr: boolean): string {
  return Number(Math.round(v * 1e6) / 1e6).toLocaleString(tr ? 'tr-TR' : 'en-US', { maximumFractionDigits: 3 })
}
function graphFmtPt(p: GraphPt, tr: boolean): string {
  return `(${graphFmt(p[0], tr)}${tr ? '; ' : ', '}${graphFmt(p[1], tr)})`
}

/** Ölçekli uzay: her eksen kendi adımına bölünür (1 birim = 1 ızgara adımı). */
function graphScaled(p: GraphPt, x: GraphAx, y: GraphAx): GraphPt {
  return [p[0] / x.step, p[1] / y.step]
}

function graphDistToLine(p: GraphPt, a: GraphPt, b: GraphPt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy)
  if (len < 1e-12) return Math.hypot(p[0] - a[0], p[1] - a[1])
  return Math.abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / len
}

/** İki doğrultu arasındaki açı (derece, 0–90). */
function graphAngle(a: GraphPt, b: GraphPt, c: GraphPt, d: GraphPt): number {
  const u = [b[0] - a[0], b[1] - a[1]], v = [d[0] - c[0], d[1] - c[1]]
  const lu = Math.hypot(u[0], u[1]), lv = Math.hypot(v[0], v[1])
  if (lu < 1e-12 || lv < 1e-12) return 90
  const cos = Math.min(1, Math.abs(u[0] * v[0] + u[1] * v[1]) / (lu * lv))
  return Math.acos(cos) * 180 / Math.PI
}

/** Yön: yeni doğru eskisinin sağında / solunda / üstünde / altında mı
 *  (kutunun ortasından). generate-exam graphShiftDir ile aynı kural. */
function graphShiftOf(base: GraphPt[], moved: GraphPt[], x: GraphAx, y: GraphAx): string | null {
  const lineOf = (p: GraphPt, q: GraphPt) => { const a = q[1] - p[1], b = p[0] - q[0]; return { a, b, c: a * p[0] + b * p[1] } }
  const b = lineOf(base[0], base[1]), m = lineOf(moved[0], moved[1])
  const midY = (y.min + y.max) / 2, midX = (x.min + x.max) / 2
  if (Math.abs(b.a) > 1e-12 && Math.abs(m.a) > 1e-12) {
    const dx = (m.c - m.b * midY) / m.a - (b.c - b.b * midY) / b.a
    if (Math.abs(dx) > x.snap * 0.25) return dx > 0 ? 'right' : 'left'
  }
  if (Math.abs(b.b) > 1e-12 && Math.abs(m.b) > 1e-12) {
    const dy = (m.c - m.a * midX) / m.b - (b.c - b.a * midX) / b.b
    if (Math.abs(dy) > y.snap * 0.25) return dy > 0 ? 'up' : 'down'
  }
  return null
}

function graphInPolygon(p: GraphPt, poly: GraphPt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

function graphIqHolds(ineq: GraphIq[], px: number, py: number): boolean {
  return ineq.every(q => {
    const v = q.a * px + q.b * py
    return q.op === '<' ? v < q.c : q.op === '<=' ? v <= q.c + 1e-9 : q.op === '>' ? v > q.c : v >= q.c - 1e-9
  })
}

/** Öğrencinin boyadığı hücre: boyama noktasıyla, çizdiği her doğrunun aynı
 *  tarafında kalan noktalar (doğru, parça ve ışın tam doğru sayılır). */
function graphInStudentFill(px: number, py: number, seed: GraphPt, lines: GraphPt[][]): boolean {
  for (const l of lines) {
    const a = l[1][1] - l[0][1], b = l[0][0] - l[1][0], c = a * l[0][0] + b * l[0][1]
    const s1 = a * seed[0] + b * seed[1] - c, s2 = a * px + b * py - c
    if (Math.abs(s1) < 1e-12) continue
    if (Math.sign(s1) !== Math.sign(s2)) return false
  }
  return true
}

/** Bir cevap öğesinin bir öğrenci nesnesine göre kredisi (0, 0.5, 1) ve notu. */
function graphCredit(e: GraphEl, s: GraphStu, spec: { x: GraphAx; y: GraphAx; given: GraphEl[] }, stu: GraphStu[], tr: boolean): { credit: number; note: string } {
  const { x, y } = spec
  const tn = 0.5 * Math.min(x.snap / x.step, y.snap / y.step) + 1e-9
  const S = (p: GraphPt) => graphScaled(p, x, y)
  const near = (p: GraphPt, q: GraphPt) => Math.abs(p[0] - q[0]) <= x.snap / 2 + 1e-9 && Math.abs(p[1] - q[1]) <= y.snap / 2 + 1e-9
  const lineLike = ['line', 'segment', 'ray']
  let credit = 0, note = ''
  if (e.kind === 'point') {
    if (s.kind !== 'point') return { credit: 0, note: '' }
    const p = s.points[0], q = e.points[0]
    if (near(p, q)) { credit = 1; note = tr ? `doğru yerde ${graphFmtPt(q, tr)}` : `correct position ${graphFmtPt(q, tr)}` }
    else if (Math.abs(p[0] - q[0]) <= x.snap / 2 + 1e-9 || Math.abs(p[1] - q[1]) <= y.snap / 2 + 1e-9) {
      credit = 0.5
      note = tr ? `koordinatlardan biri doğru; ${graphFmtPt(q, tr)} olmalıydı, sen ${graphFmtPt(p, tr)} koydun` : `one coordinate is right; it should be ${graphFmtPt(q, tr)}, you placed ${graphFmtPt(p, tr)}`
    } else note = tr ? `${graphFmtPt(q, tr)} olmalıydı, sen ${graphFmtPt(p, tr)} koydun` : `should be ${graphFmtPt(q, tr)}, you placed ${graphFmtPt(p, tr)}`
  } else if (lineLike.includes(e.kind) && e.points.length === 2) {
    if (!lineLike.includes(s.kind)) return { credit: 0, note: '' }
    const a = S(e.points[0]), b = S(e.points[1]), p = S(s.points[0]), q = S(s.points[1])
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.9) return { credit: 0, note: '' }
    if (e.kind === 'line') {
      const on1 = graphDistToLine(p, a, b) <= tn, on2 = graphDistToLine(q, a, b) <= tn
      if (on1 && on2) { credit = 1; note = tr ? 'doğru yerde' : 'correct' }
      else if (graphAngle(a, b, p, q) < 2) { credit = 0.5; note = tr ? 'eğim doğru ama doğru kaymış (kesişim noktaları tutmuyor)' : 'right slope, but the line is shifted' }
      else if (graphDistToLine(a, p, q) <= tn || graphDistToLine(b, p, q) <= tn) { credit = 0.5; note = tr ? `${graphFmtPt(graphDistToLine(a, p, q) <= tn ? e.points[0] : e.points[1], tr)} noktasından doğru geçiyor ama eğimi farklı` : 'passes through a correct point but the slope differs' }
      else note = tr ? 'eğimi de konumu da farklı' : 'slope and position both differ'
    } else if (e.kind === 'segment') {
      const m1 = near(s.points[0], e.points[0]) && near(s.points[1], e.points[1]), m2 = near(s.points[0], e.points[1]) && near(s.points[1], e.points[0])
      if (m1 || m2) { credit = 1; note = tr ? 'uçlar doğru' : 'endpoints correct' }
      else if (e.points.some(ep => s.points.some(sp => near(sp, ep)))) { credit = 0.5; note = tr ? `uçlardan biri doğru; uçlar ${graphFmtPt(e.points[0], tr)} ve ${graphFmtPt(e.points[1], tr)} olmalıydı` : 'one endpoint is right' }
      else note = tr ? `uçlar ${graphFmtPt(e.points[0], tr)} ve ${graphFmtPt(e.points[1], tr)} olmalıydı` : `endpoints should be ${graphFmtPt(e.points[0], tr)} and ${graphFmtPt(e.points[1], tr)}`
    } else {
      // Işın: başlangıç ve yön.
      const startOk = near(s.points[0], e.points[0])
      const dirOk = graphDistToLine(q, a, b) <= tn && ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) > 0
      if (startOk && dirOk) { credit = 1; note = tr ? 'başlangıç ve yön doğru' : 'start and direction correct' }
      else if (startOk) { credit = 0.5; note = tr ? 'başlangıç doğru, yön farklı' : 'start right, direction differs' }
      else note = tr ? `ışın ${graphFmtPt(e.points[0], tr)} noktasından başlamalıydı` : `the ray should start at ${graphFmtPt(e.points[0], tr)}`
    }
  } else if (e.kind === 'line' && e.shift) {
    // Yalnızca yönü sorulan kaydırma: verilene paralel ve doğru yönde.
    const base = spec.given[e.shift.of]
    if (!base || !lineLike.includes(s.kind)) return { credit: 0, note: '' }
    const p = S(s.points[0]), q = S(s.points[1])
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.9) return { credit: 0, note: '' }
    const parallel = graphAngle(S(base.points[0]), S(base.points[1]), p, q) < 2
    const dir = graphShiftOf(base.points, s.points, x, y)
    const D: Record<string, [string, string]> = { right: ['sağa', 'right'], left: ['sola', 'left'], up: ['yukarı', 'up'], down: ['aşağı', 'down'] }
    const want = (D[e.shift.dir] || ['', ''])[tr ? 0 : 1]
    if (parallel && dir === e.shift.dir) { credit = 1; note = tr ? `doğru yönde (${want}) paralel kaydırma` : `parallel shift to the ${want}` }
    else if (dir === e.shift.dir) { credit = 0.5; note = tr ? `yön doğru (${want}) ama eğim değişmiş; kaydırmada doğru paralel kalır` : `right direction, but the slope changed` }
    else if (parallel && !dir) note = tr ? 'doğru yerinden oynamamış' : 'the line has not moved'
    else note = tr ? `doğru ${want} kaymalıydı` : `the line should shift ${want}`
  } else if (e.kind === 'parabola' || e.kind === 'circle') {
    if (s.kind !== e.kind) return { credit: 0, note: '' }
    const c0 = near(s.points[0], e.points[0])
    let c1: boolean
    if (e.kind === 'parabola') {
      const ae = (e.points[1][1] - e.points[0][1]) / Math.pow(e.points[1][0] - e.points[0][0], 2)
      const dxs = s.points[1][0] - s.points[0][0]
      const as = Math.abs(dxs) < 1e-12 ? NaN : (s.points[1][1] - s.points[0][1]) / (dxs * dxs)
      c1 = Number.isFinite(as) && Math.abs(as - ae) <= Math.max(0.05 * Math.abs(ae), 1e-9)
    } else {
      const re = Math.hypot(e.points[1][0] - e.points[0][0], e.points[1][1] - e.points[0][1])
      const rs = Math.hypot(s.points[1][0] - s.points[0][0], s.points[1][1] - s.points[0][1])
      c1 = Math.abs(rs - re) <= Math.max(x.snap, y.snap) / 2 + 1e-9
    }
    const what = e.kind === 'parabola' ? (tr ? ['tepe noktası', 'açıklığı (a)'] : ['vertex', 'width (a)']) : (tr ? ['merkez', 'yarıçap'] : ['centre', 'radius'])
    if (c0 && c1) { credit = 1; note = tr ? 'doğru' : 'correct' }
    else if (c0 || c1) { credit = 0.5; note = tr ? `${c0 ? what[0] : what[1]} doğru, ${c0 ? what[1] : what[0]} farklı` : `${c0 ? what[0] : what[1]} right, ${c0 ? what[1] : what[0]} differs` }
    else note = tr ? `${what[0]} ${graphFmtPt(e.points[0], tr)} olmalıydı` : `${what[0]} should be ${graphFmtPt(e.points[0], tr)}`
  } else if (e.kind === 'polygon') {
    if (s.kind !== 'polygon') return { credit: 0, note: '' }
    let inter = 0, uni = 0
    for (let i = 0; i < 60; i++) for (let j = 0; j < 60; j++) {
      const px = x.min + (x.max - x.min) * (i + 0.5) / 60, py = y.min + (y.max - y.min) * (j + 0.5) / 60
      const ie = graphInPolygon([px, py], e.points), is = graphInPolygon([px, py], s.points)
      if (ie && is) inter++
      if (ie || is) uni++
    }
    const iou = uni ? inter / uni : 0
    if (iou >= 0.9) { credit = 1; note = tr ? 'alan doğru' : 'area correct' }
    else if (iou >= 0.6) { credit = 0.5; note = tr ? `alan büyük ölçüde örtüşüyor (%${Math.round(iou * 100)}); köşeler ${e.points.map(p => graphFmtPt(p, tr)).join(', ')} olmalıydı` : `area mostly overlaps (${Math.round(iou * 100)}%)` }
    else note = tr ? `köşeler ${e.points.map(p => graphFmtPt(p, tr)).join(', ')} olmalıydı` : `vertices should be ${e.points.map(p => graphFmtPt(p, tr)).join(', ')}`
  } else if (e.kind === 'fill' && e.ineq) {
    if (s.kind !== 'fill') return { credit: 0, note: '' }
    const lines = stu.filter(o => lineLike.includes(o.kind)).map(o => o.points)
    let agree = 0, total = 0
    for (let i = 0; i < 48; i++) for (let j = 0; j < 48; j++) {
      const px = x.min + (x.max - x.min) * (i + 0.5) / 48, py = y.min + (y.max - y.min) * (j + 0.5) / 48
      // Sınıra çok yakın örnekler sayılmaz (çizim payı).
      if (e.ineq.some(q => Math.abs(q.a * px + q.b * py - q.c) / Math.hypot(q.a * x.step, q.b * y.step) < 0.25)) continue
      total++
      if (graphIqHolds(e.ineq, px, py) === graphInStudentFill(px, py, s.points[0], lines)) agree++
    }
    const r = total ? agree / total : 0
    if (r >= 0.97) { credit = 1; note = tr ? 'doğru bölge boyandı' : 'correct region shaded' }
    else if (r >= 0.85) { credit = 0.5; note = tr ? 'bölge büyük ölçüde doğru ama sınırlardan biri farklı' : 'region mostly right, one boundary differs' }
    else note = tr ? 'yanlış bölge boyandı' : 'wrong region shaded'
  }
  if (credit > 0 && e.label && graphLabelKey(s.label) !== graphLabelKey(e.label)) {
    credit *= 0.5
    note += tr ? `; etiketi ${e.label} olmalıydı${s.label ? ` (sen ${s.label} yazdın)` : ' (etiket yok)'}` : `; its label should be ${e.label}`
  }
  if (credit > 0 && e.style && lineLike.includes(s.kind) && (e.style === 'dashed') !== s.dashed) {
    credit *= 0.75
    note += tr ? (e.style === 'dashed' ? '; sınır kesikli çizilmeliydi (eşitlik dahil değil)' : '; sınır düz çizilmeliydi (eşitlik dahil)') : (e.style === 'dashed' ? '; the boundary should be dashed' : '; the boundary should be solid')
  }
  return { credit, note }
}

/** Çizim sorusunu puanlar. score null: soru puanlanamadı (anahtar bozuk). */
function gradeGraph(studentRaw: unknown, q: Record<string, unknown>, tr: boolean): { score: number | null; elements: GraphElResult[]; extra: number; student: GraphStu[]; none: boolean } {
  const spec = (q.graph && typeof q.graph === 'object' ? q.graph : null) as { x: GraphAx; y: GraphAx; given: GraphEl[] } | null
  const key = (q.graph_answer && typeof q.graph_answer === 'object' ? q.graph_answer : null) as { none?: boolean; elements?: GraphEl[] } | null
  const { objs: rawObjs, none } = graphParseStudent(studentRaw)
  if (!spec || !spec.x || !spec.y || !key) return { score: null, elements: [], extra: 0, student: rawObjs, none }
  spec.given = Array.isArray(spec.given) ? spec.given : []
  // Aynı nesneyi iki kez çizmek ceza değil.
  const objs: GraphStu[] = []
  for (const o of rawObjs) {
    const dup = objs.some(p => p.kind === o.kind && p.points.length === o.points.length && p.points.every((pt, i) => Math.abs(pt[0] - o.points[i][0]) < 1e-9 && Math.abs(pt[1] - o.points[i][1]) < 1e-9))
    if (!dup) objs.push(o)
  }
  if (key.none === true) {
    const ok = none && !objs.length
    return { score: ok ? 100 : 0, elements: [{ name: tr ? 'Çözüm yok' : 'No solution', credit: ok ? 1 : 0, note: ok ? (tr ? 'doğru: çizilecek bir şey yok' : 'correct: nothing to draw') : (tr ? 'bu sorunun çizilecek bir cevabı yoktu (çözüm yok)' : 'this question had no solution to draw') }], extra: 0, student: objs, none }
  }
  const els = Array.isArray(key.elements) ? key.elements : []
  if (!els.length) return { score: null, elements: [], extra: 0, student: objs, none }
  const used = new Set<number>()
  const results: GraphElResult[] = els.map(e => ({ name: (GRAPH_EL_NAMES[e.kind] || [e.kind, e.kind])[tr ? 0 : 1] + (e.label ? ` ${e.label}` : ''), credit: 0, note: tr ? 'çizilmemiş' : 'not drawn' }))
  // 1. tur: kredi alan en iyi eşleşmeler. 2. tur: eşleşmeyen öğeye aynı
  // türden kalan bir deneme bağlanır (yanlış deneme "fazladan" sayılmaz,
  // notu da "çizilmemiş" değil neyin yanlış olduğu olur).
  els.forEach((e, k) => {
    let best = -1, bestC = { credit: 0, note: '' }
    objs.forEach((s, i) => {
      if (used.has(i)) return
      const c = graphCredit(e, s, spec, objs, tr)
      if (c.credit > bestC.credit) { best = i; bestC = c }
    })
    if (best >= 0) { used.add(best); results[k].credit = bestC.credit; results[k].note = bestC.note }
  })
  els.forEach((e, k) => {
    if (results[k].credit > 0) return
    for (let i = 0; i < objs.length; i++) {
      if (used.has(i)) continue
      const c = graphCredit(e, objs[i], spec, objs, tr)
      if (c.note) { used.add(i); results[k].note = c.note; break }
    }
  })
  // Verilen bir doğruyu yeniden çizmek fazladan sayılmaz (soru "talep ve
  // arzı çiziniz" deyip onları verilen olarak gösterebiliyor).
  const tnG = 0.5 * Math.min(spec.x.snap / spec.x.step, spec.y.snap / spec.y.step) + 1e-9
  const onGiven = (o: GraphStu) => ['line', 'segment', 'ray'].includes(o.kind) && spec.given.some(g => ['line', 'segment', 'ray'].includes(g.kind) && g.points.length === 2 &&
    o.points.every(p => graphDistToLine(graphScaled(p, spec.x, spec.y), graphScaled(g.points[0], spec.x, spec.y), graphScaled(g.points[1], spec.x, spec.y)) <= tnG))
  const extra = none ? 0 : objs.filter((o, i) => !used.has(i) && !onGiven(o)).length
  const sum = results.reduce((a, r) => a + r.credit, 0)
  const score = Math.round(100 * sum / (els.length + extra))
  return { score, elements: results, extra, student: objs, none }
}

/** Sonuç kâğıdına giden öğretici alanlar (anahtardan; sınav tamamlandığı
 *  için artık gösterilebilir). */
function teachingFields(q: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (typeof q.explanation === 'string' && q.explanation) out.explanation = q.explanation
  if (q.option_rationales && typeof q.option_rationales === 'object') out.option_rationales = q.option_rationales
  if (q.source && typeof q.source === 'object') out.source = q.source
  // FAZ 3a: kodla doğrulanmış hesap sorusu — sonuç kâğıdında "farklı
  // sayılarla tekrar dene" bu veriden tarayıcıda yeni soru üretir.
  if (q.type === 'calculation' && q.verified === true) {
    out.verified = true
    if (typeof q.template === 'string' && q.template && typeof q.formula === 'string' && q.variables && typeof q.variables === 'object') {
      out.practice = { template: q.template, variables: q.variables, formula: q.formula, tolerance_percent: q.tolerance_percent ?? 2, units: q.units ?? '' }
    }
    // FAZ 3c: doğrusal denklem ve NBD/faiz — sonuç kâğıdında "adım adım
    // çöz" bu veriyle tarayıcıda satır satır kontrol eder.
    const kind = String(q.step_kind ?? '')
    if (['linear', 'npv', 'interest'].includes(kind) && typeof q.formula === 'string' && q.variables && typeof q.variables === 'object' &&
        (kind !== 'linear' || (typeof q.equation === 'string' && typeof q.unknown === 'string'))) {
      out.steps = {
        kind,
        formula: q.formula,
        variables: q.variables,
        equation: kind === 'linear' ? q.equation : null,
        unknown: kind === 'linear' ? q.unknown : null,
        tolerance_percent: q.tolerance_percent ?? 2,
        units: q.units ?? '',
        common_errors: Array.isArray(q.common_errors) ? q.common_errors : []
      }
    }
  }
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

/** FAZ 5.3: sonuçlara öğrencinin "işaretle" (emin değilim) ve ipucu
 *  bilgisini yazar (yalnızca true olanlar; eski sonuçlar değişmez). */
function markConfidence(results: Array<Record<string, unknown>>, flags: unknown, hintsUsed: unknown): void {
  const flagSet = new Set((Array.isArray(flags) ? flags : []).map(String))
  const hintSet = new Set((Array.isArray(hintsUsed) ? hintsUsed : []).map(String))
  for (const r of results) {
    const id = String(r.question_id ?? r.id ?? '')
    if (flagSet.has(id)) r.flagged = true
    if (hintSet.has(id)) r.hint_used = true
  }
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
    const decimalPlaces = decimalPlacesOf(exam.scoring)
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
        // FAZ 4a: grafikli soru — sonuç kâğıdı grafiği yeniden çizer.
        ...(q.chart && typeof q.chart === 'object' ? { chart: q.chart } : {}),
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
      } else if (q.type === 'calculation' && decimalPlaces) {
        // FAZ 3c: sayı hassasiyeti seçili sınav.
        const d = decimalPlaces
        const g = gradeCalculationPrecise(studentAns, q.correct_answer, d, q.units)
        const unitSuffix = q.units ? ` ${q.units}` : ''
        const shown = Number.isFinite(g.correctNum) ? g.correctNum.toFixed(d) : String(q.correct_answer ?? '')
        let feedback = g.score === 100
          ? (isTr ? `Tebrikler! Virgülden sonra ${d} basamağa kadar doğru (${studentAns}${unitSuffix}).` : `Correct to ${d} decimal places (${studentAns}${unitSuffix}).`)
          : g.score === 50
            ? (isTr ? `Kısmi doğru: ${d - 1} basamağa kadar doğru ama virgülden sonraki ${d}. basamak tutmuyor. Doğru cevap: ${shown}${unitSuffix}.` : `Partly right: correct to ${d - 1} decimal places but not the ${d}th. Correct answer: ${shown}${unitSuffix}.`)
            : (isTr ? `Yanlış cevap (${studentAns || '-'}${unitSuffix}). Doğru cevap: ${shown}${unitSuffix} (virgülden sonra ${d} basamak).` : `Incorrect (${studentAns || '-'}${unitSuffix}). Correct answer: ${shown}${unitSuffix} (${d} decimal places).`)
        if (g.percentScaled && g.score === 100) feedback += isTr ? ' Not: cevap yüzde biçimine çevrilerek kabul edildi.' : ' Note: accepted after converting to percent form.'
        const mistake = g.score < 100 ? matchCommonError(studentAns, q) : null
        if (mistake) feedback += isTr ? ` Olası hata: ${mistake}` : ` Likely mistake: ${mistake}`
        const tb = base as Record<string, unknown>
        results.push({
          ...base,
          ...(tb.practice ? { practice: { ...(tb.practice as Record<string, unknown>), decimal_places: d } } : {}),
          ...(tb.steps ? { steps: { ...(tb.steps as Record<string, unknown>), decimal_places: d } } : {}),
          options: null,
          correct_answer: g.correctNum,
          units: q.units || null,
          tolerance_percent: null,
          decimal_places: d,
          solution_steps: q.solution_steps || [],
          matched_error: mistake,
          is_correct: g.score === 100,
          score: g.score,
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
        // FAZ 3a: yanlış cevap bilinen bir hataya uyuyorsa söyle.
        const mistake = g.score < 100 ? matchCommonError(studentAns, q) : null
        if (mistake) feedback += isTr ? ` Olası hata: ${mistake}` : ` Likely mistake: ${mistake}`
        results.push({
          ...base,
          options: null,
          correct_answer: g.correctNum,
          units: q.units || null,
          tolerance_percent: g.tolPercent,
          solution_steps: q.solution_steps || [],
          matched_error: mistake,
          is_correct: g.score === 100,
          score: g.score,
          feedback
        })
      } else if (q.type === 'expression') {
        // FAZ 3b: denklik ve biçim kodla; LLM yok.
        const g = gradeExpression(studentAns, q)
        const ref = g.reference || String(q.correct_answer ?? '')
        const FORM_TR: Record<string, string> = { factored: 'çarpanlarına ayrılmış', expanded: 'parantezleri açılmış', simplified: 'en sade' }
        const FORM_EN: Record<string, string> = { factored: 'factored', expanded: 'expanded', simplified: 'simplest' }
        const fb: Record<string, [string, string]> = {
          correct: ['Doğru! İfaden doğru cevaba denk.', 'Correct! Your expression is equivalent to the answer.'],
          wrong_form: [`Denk ama istenen biçimde değil (${FORM_TR[String(q.form)] || 'istenen'} biçim). Doğru cevap: ${ref}`, `Equivalent, but not in the required ${FORM_EN[String(q.form)] || 'requested'} form. Correct answer: ${ref}`],
          copied: [`Verilen ifadeyi aynen yazdın; istenen dönüşümü yapmadın. Doğru cevap: ${ref}`, `You copied the given expression without transforming it. Correct answer: ${ref}`],
          wrong: [`Yanlış: ifaden doğru cevaba denk değil. Doğru cevap: ${ref}`, `Incorrect: your expression is not equivalent to the answer. Correct answer: ${ref}`],
          unreadable: [`Cevabın okunamadı. Doğru cevap: ${ref}`, `Your answer could not be read. Correct answer: ${ref}`],
          blank: [`Boş bırakıldı. Doğru cevap: ${ref}`, `Left blank. Correct answer: ${ref}`],
          invalid: ['Bu soru otomatik puanlanamadı ve nota katılmadı.', 'This question could not be graded automatically and is not counted.']
        }
        results.push({
          ...base,
          options: null,
          correct_answer: ref,
          expr_vars: Array.isArray(q.expr_vars) ? q.expr_vars : [],
          form: q.form || 'any',
          up_to_constant: q.up_to_constant === true,
          solution_steps: q.solution_steps || [],
          expr_verdict: g.verdict,
          is_correct: g.score === 100,
          score: g.score,
          feedback: (fb[g.verdict] || fb.wrong)[isTr ? 0 : 1]
        })
      } else if (q.type === 'graph') {
        // FAZ 4b: çizim kodla puanlanır; LLM yok.
        const g = gradeGraph(studentAns, q, isTr)
        const okN = g.elements.filter(e => e.credit === 1).length
        let feedback: string
        if (g.score === null) feedback = isTr ? 'Bu soru otomatik puanlanamadı ve nota katılmadı.' : 'This question could not be graded automatically and is not counted.'
        else if (!studentAns) feedback = isTr ? `Boş bırakıldı. Doğrusu: ${q.correct_answer}` : `Left blank. Correct answer: ${q.correct_answer}`
        else if (g.score === 100) feedback = isTr ? 'Tebrikler, çizimin doğru.' : 'Correct! Your drawing is right.'
        else feedback = (isTr ? `${g.elements.length} öğeden ${okN} tanesi tam doğru.` : `${okN} of ${g.elements.length} elements fully correct.`) +
          (g.extra ? (isTr ? ` Fazladan ${g.extra} çizim puanı düşürdü.` : ` ${g.extra} extra drawing(s) lowered the score.`) : '')
        results.push({
          ...base,
          options: null,
          correct_answer: q.correct_answer ?? '',
          graph: q.graph,
          graph_answer: q.graph_answer,
          graph_student: g.student,
          graph_none: g.none,
          graph_elements: g.elements,
          graph_extra: g.extra,
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
            question: String(q.question ?? '') + chartAsText(q.chart),
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

    // FAZ 5.3: "işaretle" (emin değilim) ve ipucu bilgisi sonuçta da dursun;
    // konu ustalığı şansla ya da ipucuyla gelen doğruyu zayıf kanıt sayar.
    markConfidence(results, flags, exam.hints_used)

    // FAZ 6.3: ödev — geç teslim kesintisi, gizli cevaplar
    const asg = exam.assignment_id && exam.scoring && typeof exam.scoring === 'object' && (exam.scoring as Record<string, unknown>).assignment && typeof (exam.scoring as Record<string, unknown>).assignment === 'object'
      ? (exam.scoring as Record<string, unknown>).assignment as Record<string, unknown> : null
    const late = assignmentLatePenalty(asg, Date.now())
    const gradeToStore = late.pct > 0 ? Math.round(finalGrade * (100 - late.pct)) / 100 : finalGrade
    const reveal = assignmentReveal(asg)
    const storedResults = reveal.hidden ? results.map(r => redactAssignmentResult(r, isTr)) : results
    const examPatch: Record<string, unknown> = {
      answers: answers,
      question_results: storedResults,
      grade: gradeToStore,
      completed_at: new Date().toISOString()
    }
    if (asg) examPatch.scoring = { ...(exam.scoring as Record<string, unknown>), assignment: { ...asg, late_days: late.days, late_applied: late.pct > 0 ? { days: late.days, pct: late.pct, raw_grade: finalGrade } : null, answers_hidden: reveal.hidden, reveal_at: reveal.revealAt } }

    // Koşullu tamamlama: completed_at hâlâ boşsa yaz. Aynı anda gelen ikinci
    // gönderim burada satır bulamaz ve 409 alır.
    const { data: updatedExam, error: updateError } = await serviceClient
      .from('exams')
      .update(examPatch)
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
      // FAZ 6.3: cevaplar gizliyken öğrencinin okuyabildiği tabloda anahtar olmasın
      if (reveal.hidden) rows.forEach(r => { r.answer_key = null })
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

    // FAZ 6.3: tam sonuç ayrı tabloda; öğrenci reveal_at geçince okur
    if (reveal.hidden) {
      const { error: hidErr } = await serviceClient.from('exam_hidden_results')
        .upsert({ exam_id: exam.id, user_id: exam.user_id, results, reveal_at: reveal.revealAt }, { onConflict: 'exam_id' })
      if (hidErr) console.warn('grade-exam: exam_hidden_results yazilamadi (20261028b calistirildi mi?):', hidErr.message)
    }
    if (asg) console.log(`grade-exam: odev ${exam.assignment_id} not ${finalGrade}${late.pct ? ` → ${gradeToStore} (gec ${late.days} gun, %${late.pct})` : ''}${reveal.hidden ? `, cevaplar gizli (${reveal.revealAt || 'hic'})` : ''}`)

    return json(updatedExam, 200)

  } catch (err) {
    console.error("grade-exam exception: ", err)
    return json({ error: 'Internal server error occurred' }, 500)
  }
})
