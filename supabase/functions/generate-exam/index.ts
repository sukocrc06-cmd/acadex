import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ---- Static instructions, defined once at module scope so the exact same
// string is reused across every invocation of this function (Deno edge
// function isolates keep module-level values across warm invocations).
// This is deliberately the single biggest, most repeated block of tokens
// we send to Groq, and it MUST stay free of any per-request interpolation
// (question count, exam type, language, difficulty, course name, etc.) --
// those all belong in the short per-request tail below instead. Groq's
// prompt caching (see console.groq.com/docs/prompt-caching) recognizes an
// exact-matching prefix across requests to the GPT-OSS models we use and
// stops counting those tokens against our (very tight) free-tier rate
// limit, so keeping this constant byte-identical call after call is what
// actually earns us that saving.
const STATIC_EXAM_INSTRUCTIONS = `
IMPORTANT VARIATION RULES:
- Generate a fresh, varied set of questions. Vary which facts, terms, and angles you focus on, and vary question phrasing — do not default to only the most obvious or first-mentioned details every time.

IMPORTANT DIFFICULTY RULES (Bloom's taxonomy):
- 'easy': Test basic recall and definitions — "what is X", matching a term to its definition, or simple direct formula plugging.
- 'medium': Test comprehension and application — explaining relationships between concepts, applying a term or multi-step formula to a short scenario.
- 'hard': Test analysis and judgment — comparing/contrasting concepts, complex calculation scenarios, or evaluating a business case.
The user message specifies which difficulty level to use for this exam.

IMPORTANT LANGUAGE RULES:
- The user message specifies a two-letter language code: 'en' for English or 'tr' for Turkish. Write ALL questions, options, hints, and solution steps strictly in that language.

EXAM TYPE RULES:
1. 'classic': All questions must be open-ended (free-text essay questions). The options field should be null.
2. 'test': All questions must be multiple-choice. Each question must have exactly the number of options stated in the user message's OPTION COUNT line (4 or 5). The correct_answer field must be exactly equal to one of the options.
3. 'calculation': All questions must be numerical calculation problems (or symbolic 'expression' questions, see below). For 'calculation' questions:
   - "type": "calculation"
   - "question": a clear scenario with specific numerical inputs.
   - "correct_answer": numeric value (as a JSON number, e.g. 1432.50 or 42).
   - "tolerance_percent": number indicating acceptable margin of error (e.g. 2 for 2%).
   - "units": short unit string (e.g. "$", "%", "units", "kg", etc., or "" if unitless).
   - "solution_steps": array of strings demonstrating step 1, step 2, step 3 of the step-by-step mathematical solution.
   - "options": null.
   - "variables": object mapping a short name to EVERY numeric input of the problem, with the value written exactly as it appears in the question text (5 for "%5", not 0.05; 1000000 for "1.000.000"). Only quantities that could change in a similar problem (amounts, rates, counts, periods); never years, dates or fixed constants such as 12 months, 100 for percent or 360 days — write those directly in the formula.
   - "formula": ONE arithmetic expression over those names that computes correct_answer, e.g. "P * (r/100/12) / (1 - (1 + r/100/12)^(-n))". Allowed: numbers, the variable names, + - * / ^ ( ), sqrt, abs, ln, log10, exp, floor, ceil, min, max, round, pow, pi, e, and the finance functions pmt(rate, nper, pv), pv(rate, nper, pmt), fv(rate, nper, pmt, pv), npv(rate, cf1, cf2, ...) where rate is the per-period rate as a fraction (e.g. r/100/12) and amounts are positive. No other functions (no IRR, no Excel cell references), no implicit multiplication (write 2*x), no "=" sign, no dates. Only write calculation problems whose answer this one formula computes exactly; the answer is recomputed by code and the question is discarded if they disagree.
   - "template": the question text with each input number replaced by {name}, everything else identical.
   - "common_errors": 1 to 3 typical mistakes as [{"formula": "...", "message": "..."}] using the same names (e.g. the annual rate not divided by 12); "message" is one short sentence in the exam language naming the mistake.
   - "step_kind": "linear" if the question asks to solve a linear equation in one unknown; "npv" for net present value or discounting a series of cash flows; "interest" for simple or compound interest, future or present value, or loan payments; otherwise null. Students practise these step by step after the exam.
   - "equation" and "unknown" (only when step_kind is "linear", otherwise null): the equation written with the variable names and the unknown, e.g. "a*x + b = c*x - d", and the unknown's single-letter name, e.g. "x". The unknown is NOT in "variables"; "formula" gives its solution, e.g. "(-d - b) / (a - c)".
   A 'calculation' exam may also contain 'expression' questions, but ONLY when the SOURCE MATERIAL itself teaches symbolic algebra or calculus (simplifying, factoring, expanding, derivatives, integrals, solving for a variable symbolically); then make about half of the questions 'expression'. Never use 'expression' for finance, statistics, spreadsheet functions or any question whose answer is a number. For 'expression' questions:
   - "type": "expression": the answer is an algebraic expression, not a number.
   - "question": write every formula in LaTeX between single dollar signs, e.g. "$x^2 - 1$ ifadesini çarpanlarına ayırınız." or "$f(x) = x^2 \\sin x$ fonksiyonunun türevini bulunuz." (same in "solution_steps").
   - "correct_answer": the expression in plain ASCII using only the variable names, numbers, + - * / ^ ( ), sqrt, abs, ln, log, exp, sin, cos, tan, pi, e, with explicit multiplication (write 2*x, not 2x). It is checked by code against the student's answer at sample points, so it must be exactly right.
   - "expr_vars": the 1 to 3 variable names used, e.g. ["x"]. Single letters preferred; never e or pi.
   - "form": "factored" (factor it), "expanded" (expand / multiply out), "simplified" (simplify) or "any" (e.g. derivatives).
   - "given": the expression the question asks to rewrite (for factor / expand / simplify), in the same ASCII syntax; otherwise null.
   - "up_to_constant": true only for indefinite integrals (any + C is accepted), otherwise false.
   - "solution_steps": the step-by-step solution. "options", "tolerance_percent", "units", "variables", "formula", "template", "common_errors": null.
4. 'mixed': A combination of question types (the user message's MIXED TYPE RULE line below states the exact type spread for this course).
   - For 'open_ended': options = null.
   - For 'multiple_choice': exactly the OPTION COUNT number of options, correct_answer matches one option.
   - For 'true_false': options = ['True', 'False'] (if en) or ['Doğru', 'Yanlış'] (if tr).
   - For 'fill_blank': use '______' in question text. options = null. The blank must be a single word or short term. Also give "accepted_answers": other spellings or exact synonyms that are equally correct (e.g. an abbreviation and its full form), or [] if none.
   - For 'calculation': use the calculation question format above.
The user message states exactly which exam type and how many questions to generate.

RESPONSE FORMAT:
You must output ONLY a valid JSON object of the form {"questions": [ ... ]}, with no markdown code fences (do NOT use \`\`\`json or similar), no introductory or concluding text, and no conversational commentary.
The "questions" array's length must exactly equal the question count requested in the user message. Each object in it must match this JSON schema:
{
  "id": number (1-based index),
  "type": "multiple_choice" | "open_ended" | "true_false" | "fill_blank" | "calculation" | "expression",
  "question": "string",
  "options": ["string"] | null,
  "correct_answer": "string" | number,
  "accepted_answers": ["string"] | null,
  "tolerance_percent": number | null,
  "units": "string" | null,
  "solution_steps": ["string"] | null,
  "variables": {"name": number} | null,
  "formula": "string" | null,
  "template": "string" | null,
  "common_errors": [{"formula": "string", "message": "string"}] | null,
  "step_kind": "linear" | "npv" | "interest" | null,
  "equation": "string" | null,
  "unknown": "string" | null,
  "expr_vars": ["string"] | null,
  "form": "any" | "factored" | "expanded" | "simplified" | null,
  "given": "string" | null,
  "up_to_constant": boolean | null,
  "hint": "string (short helpful clue that does NOT reveal the answer)",
  "concept": "string",
  "explanation": "string",
  "option_rationales": [{"option": "string", "why": "string"}] | null,
  "rubric": [{"criterion": "string", "points": number}] | null,
  "source_terms": ["string"]
}
For 'multiple_choice', the options must be distinct and exactly one must be correct; with 5 options every distractor must still be plausible.

FEEDBACK FIELDS (the student reads these only AFTER submitting the exam):
- "explanation" (every question): 1-2 sentences saying WHY the correct answer is correct. Reuse the source material's own key terms and wording so the claim can be traced back to the source.
- "option_rationales" ('multiple_choice' only, otherwise null): one entry per option, "option" copied exactly from "options", "why" one short sentence — for a wrong option the specific misconception behind it, for the correct option why it is right.
- "rubric" ('open_ended' only, otherwise null): 3 to 5 criteria a full-marks answer must satisfy, each a specific, observable element (a key idea, a correct definition, a required link between concepts, an example). "points" must add up to exactly 100. Write criteria in the exam language.
- "source_terms" (every question): 3 to 6 distinctive terms or short phrases copied VERBATIM from the SOURCE MATERIAL that this question is built on (names of concepts, functions, formulas, models, people). Keep them in the source material's own language and spelling even when the exam is written in another language. They are used to locate the question in the original document and are never shown to the student.
`.trim()

// ==========================================================================
// FAZ 0 — SINAV BÜTÜNLÜĞÜ (14.10.2026)
//
// Aşağıdaki saf fonksiyonlar tests/exam-integrity.js tarafından kaynaktan
// çıkarılarak test ediliyor; yeniden adlandırılırlarsa test açık hata verir.
//
//  - Model çıktısı artık soru soru doğrulanıyor (şık anahtarda mı, şıklar
//    tekrar ediyor mu, sayı gerçekten sayı mı...). Geçmeyen soru atılıyor,
//    eksik kalan sayı için bir kez daha üretim isteniyor.
//  - Çoktan seçmeli şıklar sunucuda karıştırılıyor: modeller doğru cevabı
//    belli bir harfe yığma eğiliminde.
//  - Cevap anahtarı (correct_answer, accepted_answers, solution_steps,
//    tolerance_percent, hint) soru metninden ayrılıp exam_answer_keys
//    tablosuna yazılıyor; tarayıcıya yalnızca soru gidiyor.
// ==========================================================================

const MAX_QUESTION_COUNT = 20
// Kullanıcı başına sınav üretim limiti. Groq kotası tüm kullanıcılarla
// paylaşılıyor (README: hesapta 8.000 TPM gözlendi); tek bir kullanıcının
// döngüye girip kotayı bitirmesini engeller. Gerektiğinde buradan ayarla.
const EXAM_RATE_LIMIT_PER_HOUR = 12
const EXAM_RATE_LIMIT_PER_DAY = 40
const ALLOWED_EXAM_TYPES = ['classic', 'test', 'mixed', 'calculation']
const ALLOWED_LANGUAGES = ['tr', 'en']
const TRUE_FALSE_OPTIONS: Record<string, [string, string]> = { tr: ['Doğru', 'Yanlış'], en: ['True', 'False'] }
// FAZ 2: açıklama, şık gerekçeleri, rubrik ve kaynak sayfası da anahtarda
// durur; öğrenci bunları ancak sınav puanlandıktan sonra görür.
// FAZ 3a: hesap sorusunun değişkenleri, formülü, şablonu ve tipik hataları
// da anahtarda; tarayıcıya ancak puanlamadan sonra gider.
const KEY_FIELDS = ['correct_answer', 'accepted_answers', 'solution_steps', 'tolerance_percent', 'hint', 'explanation', 'option_rationales', 'rubric', 'source', 'variables', 'formula', 'template', 'common_errors', 'verified', 'step_kind', 'equation', 'unknown']
// Yalnızca sunucuda kullanılan alanlar: ne tarayıcıya ne anahtara yazılır.
const INTERNAL_FIELDS = ['source_terms']
const EXPLANATION_MAX_CHARS = 600
const RATIONALE_MAX_CHARS = 300
const RUBRIC_MIN_ITEMS = 2
const RUBRIC_MAX_ITEMS = 6

/** Model yanıtını soru dizisine çevirir: {"questions":[...]}, düz dizi veya
 *  tek anahtarlı başka bir nesne kabul edilir. Ayrıştırılamazsa null. */
function parseQuestionArray(raw: string): unknown[] | null {
  const cleaned = String(raw || '').replace(/```json\s*|```/g, '').trim()
  if (!cleaned) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (_e) {
    return null
  }
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    if (Array.isArray(obj.questions)) return obj.questions as unknown[]
    const firstArray = Object.values(obj).find(v => Array.isArray(v))
    if (firstArray) return firstArray as unknown[]
  }
  return null
}

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

// 22.10.2026 (canlı test): model ara sıra doğru cevabı düz metin "null"
// olarak yazıyor (boşluk doldurma ve klasikte). Böyle bir değer cevap sayılmaz.
const PLACEHOLDER_ANSWERS = ['null', 'none', 'undefined', 'n/a', 'nan']

function isPlaceholderAnswer(value: unknown): boolean {
  if (typeof value === 'number') return false
  return PLACEHOLDER_ANSWERS.includes(normalizeAnswerText(value))
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

/** Metindeki bir sayı belirtecinin olası okunuşları: "1.000" Türkçede bin,
 *  İngilizcede bir; ikisi de aday sayılır. */
function numberReadings(raw: string): number[] {
  const out: number[] = []
  const add = (n: number) => { if (Number.isFinite(n) && !out.some(x => sameNumber(x, n))) out.push(n) }
  add(parseLooseNumber(raw))
  add(Number(raw.replace(/\./g, '').replace(',', '.')))
  add(Number(raw.replace(/,/g, '')))
  return out
}

function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
}

function withinTolerance(value: number, target: number, tolPercent: number): boolean {
  const margin = target !== 0 ? Math.abs(target) * tolPercent / 100 : tolPercent / 100
  return Math.abs(value - target) <= margin
}

/** Şablon soruyla tutarlı mı: yer tutucular tam olarak değişkenler, ve
 *  sayılar çıkarıldığında iki metnin harfleri aynı. */
function templateMatches(template: string, question: string, names: string[]): boolean {
  const ph = [...template.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map(m => m[1])
  if (ph.length === 0) return false
  const set = new Set(ph)
  if (names.some(n => !set.has(n)) || ph.some(p => !names.includes(p))) return false
  const letters = (x: string) => x.toLocaleLowerCase('tr-TR').replace(/[^\p{L}]+/gu, '')
  return letters(template.replace(/\{[^}]*\}/g, ' ')) === letters(question.replace(/\d[\d.,]*/g, ' '))
}

/** Modelin formül yazımındaki zararsız farkları giderir: baştaki "=" ya da
 *  "PMT =", ×·÷−– işaretleri, ² ³. Yalnızca generate-exam'de; saklanan
 *  formül zaten temizdir. */
function normalizeFormula(raw: unknown): string {
  let f = typeof raw === 'string' ? raw.trim() : ''
  f = f.replace(/^\s*=/, '')
  const eq = f.indexOf('=')
  if (eq > 0 && f.indexOf('=', eq + 1) === -1 && /^\s*[A-Za-z_][A-Za-z0-9_ ]*$/.test(f.slice(0, eq))) f = f.slice(eq + 1)
  return f.replace(/[×·∙]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').trim()
}

/** Metindeki bir sayıdan doğrudan türeyen değerler: %6 → 0.06, 5 yıl → 60
 *  ay, 60 ay → 5 yıl, "2x - 7" → -7 (Faz 3c). Türeyen değişken gizli
 *  girdi sayılmaz ama şablonla yeniden üretilemez (şablon kapatılır). */
const DERIVED_FACTORS = [100, 0.01, 12, 1 / 12, -1]

/** FAZ 3c: adım adım kontrol edilebilen hesap türleri. */
const STEP_KINDS = ['linear', 'npv', 'interest']

/** Doğrusal denklemi kodla doğrular: tek "=", bilinmeyen tek harf ve
 *  değişkenlerden ayrı, her iki taraf hesaplanabilir, bilinmeyene göre
 *  doğrusal, tek çözümlü ve çözüm formülün sonucuna eşit. */
function verifyLinearEquation(equation: unknown, unknown: unknown, vars: Record<string, number>, value: number): { equation: string; unknown: string } | null {
  const u = String(unknown ?? '').trim()
  if (!/^[A-Za-z]$/.test(u) || Object.prototype.hasOwnProperty.call(vars, u) || Object.prototype.hasOwnProperty.call(EXPR_CONSTS, u)) return null
  const parts = String(equation ?? '').split('=')
  if (parts.length !== 2) return null
  const names = [...Object.keys(vars), u]
  const left = normalizeMathInput(parts[0], names)
  const right = normalizeMathInput(parts[1], names)
  if (!left || !right) return null
  const f = (x: number) => evaluateExpression(left, { ...vars, [u]: x }) - evaluateExpression(right, { ...vars, [u]: x })
  const f0 = f(0), f1 = f(1), f2 = f(2)
  if (![f0, f1, f2].every(Number.isFinite)) return null
  const a = f1 - f0
  if (Math.abs(a) < 1e-12 || Math.abs((f2 - f1) - a) > 1e-9 * Math.max(1, Math.abs(a))) return null
  const sol = -f0 / a
  if (Math.abs(sol - value) > 1e-6 * Math.max(1, Math.abs(value))) return null
  return { equation: `${left}=${right}`, unknown: u }
}

/** Hesap sorusunu kodla doğrular ve düzeltir: correct_answer formülden,
 *  şablon ve tipik hatalar temizlenmiş. Başarısızsa nedeni. */
function verifyCalculation(q: Record<string, unknown>): { ok: boolean; reason?: string } {
  const vars = sanitizeVariables(q.variables)
  const names = Object.keys(vars)
  const formula = normalizeFormula(q.formula)
  if (names.length === 0 || !formula) return { ok: false, reason: 'calc_no_formula' }
  const value = evaluateExpression(formula, vars)
  if (!Number.isFinite(value)) return { ok: false, reason: 'calc_formula_invalid' }
  // Her değişken soru metninde yazılı olmalı ya da yazılı bir sayıdan
  // doğrudan türemeli (gizli girdi yok).
  const text = String(q.question ?? '')
  const readings = [...text.matchAll(/\d[\d.,]*/g)].flatMap(m => numberReadings(m[0].replace(/[.,]+$/, '')))
  const literal = (n: string) => readings.some(r => sameNumber(r, vars[n]))
  const derived = (n: string) => readings.some(r => DERIVED_FACTORS.some(k => sameNumber(r * k, vars[n])))
  if (names.some(n => !literal(n) && !derived(n))) return { ok: false, reason: 'calc_var_not_in_text' }
  const allLiteral = names.every(literal)
  const tol = Number(q.tolerance_percent) || 2
  const modelAnswer = parseLooseNumber(q.correct_answer)
  if (Number.isFinite(modelAnswer) && !withinTolerance(modelAnswer, value, Math.max(tol, 1))) return { ok: false, reason: 'calc_mismatch' }
  q.correct_answer = Math.round(value * 1e4) / 1e4
  q.variables = vars
  q.formula = formula
  q.template = allLiteral && typeof q.template === 'string' && templateMatches(q.template, text, names) ? q.template : null
  const errs: Array<{ formula: string; message: string }> = []
  for (const ce of Array.isArray(q.common_errors) ? q.common_errors : []) {
    if (!ce || typeof ce !== 'object') continue
    const rec = ce as Record<string, unknown>
    const f = normalizeFormula(rec.formula)
    const msg = cleanText(rec.message, 200)
    const v = evaluateExpression(f, vars)
    if (!f || !msg || !Number.isFinite(v) || withinTolerance(v, value, tol)) continue
    errs.push({ formula: f, message: msg })
    if (errs.length >= 3) break
  }
  q.common_errors = errs.length ? errs : null
  // FAZ 3c: adım adım kontrol türü. Doğrusal denklem kodla çözülür ve
  // formülün sonucuyla aynı olmalı; değilse yalnızca adım türü düşer.
  const kind = STEP_KINDS.includes(String(q.step_kind)) ? String(q.step_kind) : null
  const eq = kind === 'linear' ? verifyLinearEquation(q.equation, q.unknown, vars, value) : null
  q.step_kind = kind === 'linear' && !eq ? null : kind
  q.equation = eq ? eq.equation : null
  q.unknown = eq ? eq.unknown : null
  q.verified = true
  return { ok: true }
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

/** FAZ 3b: ifade sorusunu doğrular ve temizler (yalnızca generate-exam):
 *  değişkenler geçerli, referans açılabiliyor ve örnek noktalarda
 *  hesaplanabiliyor, istenen biçime kendisi uyuyor, verilen ifadenin aynısı
 *  değil. Cevap açık biçimde saklanır ("2*x*(x+1)"). */
function verifyExpression(q: Record<string, unknown>): { ok: boolean; reason?: string } {
  const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k)
  const vars = [...new Set((Array.isArray(q.expr_vars) ? q.expr_vars : []).map(v => String(v ?? '').trim()))]
    .filter(v => /^[A-Za-z][A-Za-z0-9_]{0,7}$/.test(v) && !has(EXPR_FUNCS, v.toLowerCase()) && !has(EXPR_CONSTS, v))
    .slice(0, 3)
  if (!vars.length) return { ok: false, reason: 'expr_no_vars' }
  const ref = normalizeMathInput(q.correct_answer, vars)
  if (!ref || expressionsEquivalent(ref, ref, vars) !== 'equal') return { ok: false, reason: 'expr_answer_invalid' }
  const form = EXPR_FORMS.includes(String(q.form)) ? String(q.form) : 'any'
  const given = q.given == null ? '' : normalizeMathInput(q.given, vars)
  if (!checkExpressionForm(ref, form, ref, given)) return { ok: false, reason: 'expr_form_mismatch' }
  q.correct_answer = ref
  q.expr_vars = vars
  q.form = form
  q.given = given || null
  q.up_to_constant = q.up_to_constant === true
  q.solution_steps = Array.isArray(q.solution_steps) ? q.solution_steps.map(s => String(s ?? '')).filter(Boolean) : []
  q.options = null
  for (const k of ['tolerance_percent', 'units', 'variables', 'formula', 'template', 'common_errors', 'verified']) delete q[k]
  return { ok: true }
}

// ==========================================================================
// FAZ 2c — ŞIK SAYISI VE "YANLIŞ DOĞRUYU GÖTÜRÜR" (22.10.2026)
//
// Öğrenci sınavı kurarken seçer: çoktan seçmeli sorular 4 ya da 5 şıklı,
// ve isterse yanlışlar doğruyu götürür (3 ya da 4 yanlış 1 doğru). Ayar
// exams.scoring'e yazılır (20261022b_exam_scoring.sql); tarayıcı sonradan
// değiştiremez. Ceza yalnızca çoktan seçmeli sorularda; puanı grade-exam
// hesaplar (computeExamGrade).
// ==========================================================================
const ALLOWED_OPTION_COUNTS = [4, 5]
const ALLOWED_WRONG_PER_CORRECT = [3, 4]

/** İstekteki ayarı doğrular. negativeMarking: 0/false = kapalı, 3 ya da 4 =
 *  kaç yanlış bir doğruyu götürür, true = şık sayısına göre varsayılan
 *  (4 şık → 3, 5 şık → 4). */
function normalizeScoring(optionCount: unknown, negativeMarking: unknown): { option_count: number; negative_marking: boolean; wrong_per_correct: number } {
  const oc = ALLOWED_OPTION_COUNTS.includes(Number(optionCount)) ? Number(optionCount) : 4
  const defaultRatio = oc === 5 ? 4 : 3
  let enabled = false, ratio = defaultRatio
  if (negativeMarking === true) enabled = true
  else if (ALLOWED_WRONG_PER_CORRECT.includes(Number(negativeMarking))) { enabled = true; ratio = Number(negativeMarking) }
  return { option_count: oc, negative_marking: enabled, wrong_per_correct: ratio }
}

/** Sınav türüne göre kabul edilen soru tipleri. */
function allowedTypesFor(examType: string, isQuant: boolean): string[] {
  if (examType === 'classic') return ['open_ended']
  if (examType === 'test') return ['multiple_choice']
  if (examType === 'calculation') return ['calculation', 'expression']
  const mixed = ['open_ended', 'multiple_choice', 'true_false', 'fill_blank']
  return isQuant ? [...mixed, 'calculation'] : mixed
}

/** FAZ 3c: aynı cevabı gösteren şıklar. Canlıda "5.368,00 / 5.368 /
 *  5.368,5" ve "0.08" / "8%" gibi şıklar görüldü; birebir eşitlik
 *  denetimi bunları kaçırıyordu.
 *  - Sayısal şıklar (yalnızca sayı ve kısa birim): okunuşlarından biri
 *    eşitse ya da (ikisi de tam sayı değilse) %0,5 içindeyse aynı sayılır.
 *  - Öteki şıklar: sayılar ortak biçime ("5368", "0.08"), yüzde kesre
 *    çevrilip boşluk ve noktalama atıldıktan sonra aynıysa aynı sayılır. */
const OPTION_NEAR_PERCENT = 0.5
const NUMERIC_OPTION = /^[^\d\p{L}]{0,3}\p{L}{0,3}\s*[-+−]?\d[\d.,]*\s*[%‰]?\s*[\p{L}$€₺£]{0,6}\.?$/u

function optionCanonical(option: string): string {
  return normalizeAnswerText(option)
    .replace(/%\s*(\d[\d.,]*)|(\d[\d.,]*)\s*%/g, (_m, a, b) => {
      const n = parseLooseNumber(a ?? b)
      return Number.isFinite(n) ? ` ${String(Math.round(n / 100 * 1e9) / 1e9)} ` : _m
    })
    .replace(/\d[\d.,]*\d|\d/g, m => {
      const n = parseLooseNumber(m)
      return Number.isFinite(n) ? String(Math.round(n * 1e9) / 1e9) : m
    })
    .replace(/[^\p{L}\d.\-]+/gu, '')
}

function hasAmbiguousOptions(options: string[]): boolean {
  if (new Set(options.map(optionCanonical)).size !== options.length) return true
  // Yalnızca sayının dışındaki kısmı ("TL", "%") aynı olan şıklar
  // karşılaştırılır: "a1" ile "b1" ayrı, "5.368 TL" ile "5.368,5 TL" değil.
  const numeric = options
    .map(o => o.trim())
    .filter(o => NUMERIC_OPTION.test(o))
    .map(o => ({
      frame: normalizeAnswerText(o.replace(/\d[\d.,]*/, '#')),
      readings: numberReadings((o.match(/\d[\d.,]*/) || [''])[0].replace(/[.,]+$/, ''))
    }))
  for (let i = 0; i < numeric.length; i++) {
    for (let j = i + 1; j < numeric.length; j++) {
      if (numeric[i].frame !== numeric[j].frame) continue
      // Tam sayılar en az 1 farklıysa ayrıdır (1990 / 1991); kesirli ya da
      // eşit olanlarda %0,5 yakınlık aynı cevap sayılır (5.368 / 5.368,5).
      const near = (a: number, b: number) => a === b || (!(Number.isInteger(a) && Number.isInteger(b)) && Math.abs(a - b) <= OPTION_NEAR_PERCENT / 100 * Math.max(Math.abs(a), Math.abs(b)))
      if (numeric[i].readings.some(a => numeric[j].readings.some(b => near(a, b)))) return true
    }
  }
  return false
}

/** Tek bir soruyu denetler ve temizlenmiş halini döner. Geçmezse
 *  { ok: false, reason } — soru atılır. allowUnverifiedCalc: son çare;
 *  formülü doğrulanamayan ama cevabı sayı olan hesap sorusu Faz 3a öncesi
 *  gibi kabul edilir (çelişen soru yine atılır). */
function validateQuestion(raw: unknown, allowedTypes: string[], language: string, optionCount = 4, allowUnverifiedCalc = false): { ok: boolean; question?: Record<string, unknown>; reason?: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not_object' }
  const q = { ...(raw as Record<string, unknown>) }
  const type = String(q.type || '')
  if (!allowedTypes.includes(type)) return { ok: false, reason: `type_not_allowed:${type}` }
  const text = typeof q.question === 'string' ? q.question.trim() : ''
  if (text.length < 5) return { ok: false, reason: 'empty_question' }
  q.question = text
  q.concept = typeof q.concept === 'string' ? q.concept.trim().slice(0, 120) : null
  q.hint = typeof q.hint === 'string' ? q.hint.trim() : null

  if (type === 'multiple_choice') {
    const options = Array.isArray(q.options) ? q.options.map(o => String(o ?? '').trim()).filter(Boolean) : []
    if (options.length !== optionCount) return { ok: false, reason: 'mc_option_count' }
    if (new Set(options.map(normalizeAnswerText)).size !== options.length) return { ok: false, reason: 'mc_duplicate_options' }
    if (hasAmbiguousOptions(options)) return { ok: false, reason: 'mc_ambiguous_options' }
    const correctNorm = normalizeAnswerText(q.correct_answer)
    let match = options.filter(o => normalizeAnswerText(o) === correctNorm)
    // Model bazen "B" ya da "B) ..." biçiminde harf döndürüyor.
    if (match.length === 0) {
      const letter = String(q.correct_answer ?? '').trim().match(/^([A-Ea-e])(?:[).:\s]|$)/)
      if (letter) match = [options['abcde'.indexOf(letter[1].toLowerCase())]].filter(Boolean)
    }
    if (match.length !== 1) return { ok: false, reason: 'mc_answer_not_in_options' }
    q.options = options
    q.correct_answer = match[0]
  } else if (type === 'true_false') {
    const pair = TRUE_FALSE_OPTIONS[language] || TRUE_FALSE_OPTIONS.en
    const c = normalizeAnswerText(q.correct_answer)
    const isTrue = ['doğru', 'dogru', 'd', 'true', 't', 'evet', 'yes'].includes(c)
    const isFalse = ['yanlış', 'yanlis', 'y', 'false', 'f', 'hayır', 'hayir', 'no'].includes(c)
    if (isTrue === isFalse) return { ok: false, reason: 'tf_answer_unclear' }
    q.options = [...pair]
    q.correct_answer = isTrue ? pair[0] : pair[1]
  } else if (type === 'fill_blank') {
    let answer = String(q.correct_answer ?? '').trim()
    const accepted = Array.isArray(q.accepted_answers)
      ? q.accepted_answers.map(a => String(a ?? '').trim()).filter(a => a && !isPlaceholderAnswer(a))
      : []
    // Cevap "null" ama alternatifler dolu: ilk alternatif cevap olur.
    if (!answer || isPlaceholderAnswer(answer)) answer = accepted.shift() || ''
    if (!answer) return { ok: false, reason: 'fill_blank_no_answer' }
    q.correct_answer = answer
    q.accepted_answers = accepted.slice(0, 8)
    q.options = null
  } else if (type === 'calculation') {
    const tol = parseLooseNumber(q.tolerance_percent)
    q.tolerance_percent = Number.isFinite(tol) ? Math.min(10, Math.max(0.1, tol)) : 2
    q.units = typeof q.units === 'string' ? q.units.trim().slice(0, 12) : ''
    q.solution_steps = Array.isArray(q.solution_steps) ? q.solution_steps.map(s => String(s ?? '')).filter(Boolean) : []
    q.options = null
    // FAZ 3a: cevabı kod hesaplar; formül yoksa, hesaplanamıyorsa ya da
    // modelin cevabıyla çelişiyorsa soru atılır.
    const check = verifyCalculation(q)
    if (!check.ok) {
      const n = parseLooseNumber(q.correct_answer)
      if (!allowUnverifiedCalc || check.reason === 'calc_mismatch' || !Number.isFinite(n)) return { ok: false, reason: check.reason }
      q.correct_answer = n
      for (const k of ['variables', 'formula', 'template', 'common_errors', 'verified']) delete q[k]
    }
  } else if (type === 'expression') {
    // FAZ 3b: referans ifade kodla açılır ve örnek noktalarda hesaplanabilir
    // olmalı; istenen biçime kendisi uymalı.
    const check = verifyExpression(q)
    if (!check.ok) return { ok: false, reason: check.reason }
  } else if (type === 'open_ended') {
    let ref = String(q.correct_answer ?? '').trim()
    // Örnek cevap "null": açıklama, o da yoksa rubrik maddeleri yerine geçer
    // (soruyu atıp yeniden üretmek TPM sınırında pahalı).
    if (!ref || isPlaceholderAnswer(ref)) {
      const rubric = normalizeRubric(q.rubric)
      ref = cleanText(q.explanation, EXPLANATION_MAX_CHARS) || (rubric ? rubric.map(r => r.criterion).join('; ') : '')
    }
    if (!ref) return { ok: false, reason: 'open_no_reference' }
    q.correct_answer = ref
    q.options = null
  }
  // FAZ 2: geri bildirim alanları isteğe bağlı — eksik ya da bozuksa soru
  // atılmaz, yalnızca o alan boş kalır.
  q.explanation = cleanText(q.explanation, EXPLANATION_MAX_CHARS)
  q.option_rationales = type === 'multiple_choice' ? normalizeOptionRationales(q.option_rationales, q.options as string[]) : null
  q.rubric = type === 'open_ended' ? normalizeRubric(q.rubric) : null
  q.source_terms = Array.isArray(q.source_terms)
    ? q.source_terms.map(t => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)).filter(t => t.length >= 2).slice(0, 8)
    : []
  return { ok: true, question: q }
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const t = value.replace(/\s+/g, ' ').trim()
  if (t.length < 3) return null
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, '') + '…' : t
}

/** Şık gerekçelerini şık METNİNE bağlar ({ "şık metni": "neden" }). Şıklar
 *  sonradan karıştırıldığı için sıra ya da harf değil metin anahtar olur.
 *  Model harf ("B") ya da "B) ..." döndürürse karıştırmadan ÖNCEKİ sıraya
 *  göre eşlenir — bu fonksiyon karıştırmadan önce çağrılıyor. */
function normalizeOptionRationales(raw: unknown, options: string[]): Record<string, string> | null {
  if (!Array.isArray(options) || options.length === 0) return null
  const out: Record<string, string> = {}
  const byNorm = new Map(options.map(o => [normalizeAnswerText(o), o]))
  const entries: Array<[unknown, unknown]> = Array.isArray(raw)
    ? raw.map(e => (e && typeof e === 'object') ? [(e as Record<string, unknown>).option, (e as Record<string, unknown>).why] as [unknown, unknown] : [null, null])
    : (raw && typeof raw === 'object') ? Object.entries(raw as Record<string, unknown>) : []
  for (const [optRaw, whyRaw] of entries) {
    const why = cleanText(whyRaw, RATIONALE_MAX_CHARS)
    if (!why) continue
    let opt = byNorm.get(normalizeAnswerText(optRaw))
    if (!opt) {
      const letter = String(optRaw ?? '').trim().match(/^([A-Ea-e])(?:[).:\s]|$)/)
      if (letter) opt = options['abcde'.indexOf(letter[1].toLowerCase())]
    }
    if (opt && !out[opt]) out[opt] = why
  }
  return Object.keys(out).length ? out : null
}

/** Rubrik: 2–6 madde, puanlar tam sayı ve toplamı tam 100 olacak şekilde
 *  ölçeklenir. Geçerli madde 2'den azsa null — puanlayıcı o soruda eskisi
 *  gibi bütüncül puan verir. */
function normalizeRubric(raw: unknown): Array<{ criterion: string; points: number }> | null {
  if (!Array.isArray(raw)) return null
  const items: Array<{ criterion: string; points: number }> = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const rec = r as Record<string, unknown>
    const criterion = cleanText(rec.criterion ?? rec.text ?? rec.item, 240)
    const points = parseLooseNumber(rec.points ?? rec.weight)
    if (!criterion || !Number.isFinite(points) || points <= 0) continue
    items.push({ criterion, points })
    if (items.length >= RUBRIC_MAX_ITEMS) break
  }
  if (items.length < RUBRIC_MIN_ITEMS) return null
  const total = items.reduce((a, i) => a + i.points, 0)
  const scaled = items.map(i => ({ criterion: i.criterion, points: Math.max(1, Math.round(i.points * 100 / total)) }))
  const diff = 100 - scaled.reduce((a, i) => a + i.points, 0)
  if (diff !== 0) {
    let k = 0
    scaled.forEach((it, idx) => { if (it.points > scaled[k].points) k = idx })
    scaled[k].points += diff
  }
  return scaled
}

const GROQ_RETRY_MAX_WAIT_MS = 30_000
// Üretimde Groq hatası sonrası en fazla bu kadar yeniden deneme.
const GEN_MAX_RETRIES = 2
// Çıktı bütçesi: sabit pay (düşünme + sarmalayıcı) + soru başına pay.
// 8 soru ≈ 4.560 token. Canlı ölçüm (22.10.2026, 8 soru): istem 4.000,
// gerçek çıktı 2.046 token, finish=stop.
const GEN_TOKENS_BASE = 1200
const GEN_TOKENS_PER_QUESTION = 420
const GEN_TOKENS_MAX = 7000
// FAZ 3a: hesap sorusu formül, şablon ve tipik hata da yazıyor.
const GEN_TOKENS_CALC_EXTRA = 150

function completionBudgetFor(count: number): number {
  const n = Math.max(1, Math.floor(Number(count) || 1))
  return Math.min(GEN_TOKENS_MAX, GEN_TOKENS_BASE + GEN_TOKENS_PER_QUESTION * n)
}

/** Kesik ya da bozuk bir JSON çıktısından TAMAMLANMIŞ soru nesnelerini
 *  çıkarır: "questions" dizisinin (yoksa ilk dizinin) içindeki üst düzey
 *  {...} blokları tek tek ayrıştırılır, yarım kalan son nesne atılır.
 *  Dize içindeki parantezler ve kaçış karakterleri hesaba katılır. */
function salvageQuestionObjects(raw: string): unknown[] {
  const text = String(raw || '')
  const key = text.indexOf('"questions"')
  const start = text.indexOf('[', key >= 0 ? key : 0)
  if (start < 0) return []
  const out: unknown[] = []
  let depth = 0, inStr = false, esc = false, objStart = -1
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') { inStr = true; continue }
    if (c === '{') { if (depth === 0) objStart = i; depth++ }
    else if (c === '}') {
      depth--
      if (depth === 0 && objStart >= 0) {
        try { out.push(JSON.parse(text.slice(objStart, i + 1))) } catch (_e) { /* bozuk nesne: atla */ }
        objStart = -1
      }
      if (depth < 0) break
    } else if (c === ']' && depth === 0) break
  }
  return out
}

/** Groq 429 yanıtından beklenecek süre (ms). Önce retry-after başlığı, yoksa
 *  mesajdaki "Please try again in 1m2.5s" / "in 750ms". Süre okunamazsa ya
 *  da GROQ_RETRY_MAX_WAIT_MS'ten uzunsa null — o zaman beklemeye değmez. */
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

/** Fisher–Yates; rand testte sabitlenebilsin diye parametre. */
function shuffleInPlace<T>(items: T[], rand: () => number = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
  return items
}

/** Soruyu tarayıcıya gidecek kısım ile cevap anahtarına ayırır. */
function splitPublicAndKey(q: Record<string, unknown>): { pub: Record<string, unknown>; key: Record<string, unknown> } {
  const pub: Record<string, unknown> = {}
  const key: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(q)) {
    if (INTERNAL_FIELDS.includes(k)) continue
    if (KEY_FIELDS.includes(k)) key[k] = v
    else pub[k] = v
  }
  return { pub, key }
}

// ==========================================================================
// FAZ 2 — SORUYU KAYNAK SAYFAYA BAĞLAMA (21.10.2026)
//
// Öğrenci sonuç kâğıdında "bu soru belgenin 7. sayfasından" ve o sayfadaki
// cümleyi görür. Sayfa, özet kartlarındaki atıflarla AYNI deterministik
// motorla bulunur: summarize-document'ın kaydettiği document_chunks
// satırlarından sayfa dizini kurulur, sorunun açıklaması ve doğru cevabı
// sayfalarla terim örtüşmesiyle eşlenir. Ek yapay zekâ çağrısı yok.
// Eşik tutturulamazsa soru sayfasız kalır — yanlış sayfa göstermek hiç
// göstermemekten kötü.
//
// Aşağıdaki ANCHOR_STOPWORDS … anchorClaimToPage bloğu
// supabase/functions/summarize-document/index.ts'ten BİREBİR kopya (edge
// function'lar dashboard'dan tek dosya olarak deploy ediliyor, ortak modül
// yok). tests/exam-feedback.js iki kopyanın aynı kaldığını denetler; birini
// değiştirirsen ötekini de değiştir.
// ==========================================================================

// Terms this common carry no signal about WHICH page a claim came from.
const ANCHOR_STOPWORDS = new Set([
  // Turkish
  'ancak', 'ayrıca', 'bunun', 'burada', 'çünkü', 'daha', 'değil', 'diğer', 'fakat',
  'gibi', 'göre', 'için', 'ile', 'olan', 'olarak', 'olduğu', 'olur', 'sonra', 'şekilde',
  'bütün', 'böyle', 'kadar', 'sadece', 'tüm', 'üzerinde', 'vardır', 'veya', 'yani',
  'bazı', 'birlikte', 'eğer', 'hem', 'ise', 'yine', 'çok', 'önemli', 'bölüm', 'konu',
  // English
  'about', 'after', 'also', 'because', 'been', 'between', 'both', 'does', 'each',
  'from', 'have', 'however', 'into', 'more', 'most', 'other', 'should', 'such',
  'than', 'that', 'their', 'then', 'there', 'these', 'this', 'those', 'through',
  'under', 'when', 'where', 'which', 'while', 'will', 'with', 'would', 'they',
  'important', 'section', 'chapter', 'example', 'following'
])

/** Content-bearing terms of a string: >=4 chars, not a stopword, diacritics kept. */
function anchorTerms(s: string): string[] {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !ANCHOR_STOPWORDS.has(w))
}

type PageSegment = { page: number; terms: Set<string>; head: string; body: string }

// Abbreviations whose trailing dot must NOT end a sentence. Without this a
// Turkish academic page splits at "s. 42", "vb.", "Prof. Dr." and the quote

const SENTENCE_ABBREV = new Set([
  's', 'ss', 'vb', 'vs', 'bkz', 'örn', 'orn', 'age', 'agm', 'yy', 'bkz',
  'dr', 'doç', 'doc', 'prof', 'yrd', 'arş', 'ars', 'gör', 'gor', 'no', 'nr',
  'yay', 'çev', 'cev', 'ed', 'vol', 'pp', 'fig', 'eq', 'etc', 'al'
])

/**
 * Split prose into sentences, conservatively. Over-merging two sentences is
 * harmless here (the quote is simply a little longer); splitting mid-sentence
 * is not, because the fragment is shown to the student as the source text.
 */
function splitSentences(text: string): string[] {
  const rough = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…])\s+/)
  const out: string[] = []
  for (const piece of rough) {
    const prevNeedsMerge = out.length > 0 && (() => {
      const prev = out[out.length - 1]
      const lastWord = (prev.match(/([\p{L}\p{N}]+)\.$/u) || [])[1]
      if (!lastWord) return false
      // "...vb." / "...s." / a bare initial like "A." / a list number "3."
      return SENTENCE_ABBREV.has(lastWord.toLowerCase())
        || lastWord.length <= 2
        || /^\d+$/.test(lastWord)
    })()
    if (prevNeedsMerge) out[out.length - 1] += ' ' + piece
    else out.push(piece)
  }
  return out.map(s => s.trim()).filter(s => s.length > 0)
}

// A quote shorter than this carries no context; longer than this is a wall of
// text in a tooltip.
const QUOTE_MIN_CHARS = 25
const QUOTE_MAX_CHARS = 220

/**
 * The sentence on this page that best supports the claim, returned VERBATIM
 * so it can be checked against the source. This is what turns "page 7" into
 * "page 7 says this", which is the whole difference between a citation a
 * student trusts and one they learn to ignore.
 *
 * Returns null when no sentence matches well enough; the caller then falls
 * back to the page's heading line.
 */
function bestQuoteForClaim(claim: string, body: string, idf: Map<string, number>): string | null {
  const claimTerms = [...new Set(anchorTerms(claim))]
  if (!claimTerms.length) return null
  const fallbackIdf = Math.log(2)
  const totalWeight = claimTerms.reduce((a, t) => a + (idf.get(t) ?? fallbackIdf), 0)
  if (totalWeight <= 0) return null

  let best: { text: string; score: number } | null = null
  for (const raw of splitSentences(body)) {
    if (raw.length < QUOTE_MIN_CHARS) continue
    const sentTerms = new Set(anchorTerms(raw))
    if (!sentTerms.size) continue
    let w = 0, matched = 0
    for (const t of claimTerms) {
      if (sentTerms.has(t)) { w += (idf.get(t) ?? fallbackIdf); matched++ }
    }
    if (matched < 2) continue
    // Normalising by the claim's own weight (not the sentence's) keeps a long
    // rambling sentence from winning just by containing more words.
    const score = w / totalWeight
    if (!best || score > best.score) best = { text: raw, score }
  }
  if (!best || best.score < 0.3) return null
  return best.text.length > QUOTE_MAX_CHARS
    ? best.text.slice(0, QUOTE_MAX_CHARS).replace(/\s+\S*$/, '') + '…'
    : best.text
}


/** Inverse page frequency: a term on every page discriminates nothing. */
function buildAnchorIdf(pageIndex: PageSegment[]): Map<string, number> {
  const df = new Map<string, number>()
  for (const seg of pageIndex) {
    for (const t of seg.terms) df.set(t, (df.get(t) || 0) + 1)
  }
  const N = Math.max(1, pageIndex.length)
  const idf = new Map<string, number>()
  for (const [t, d] of df) idf.set(t, Math.log((N + 1) / (d + 0.5)))
  return idf
}

// Precision-first thresholds: a missing citation is a small loss, a wrong one
// costs the student's trust in every other citation on the card.
const ANCHOR_MIN_SCORE = 0.42   // share of the claim's weighted vocabulary found on the page
const ANCHOR_MIN_TERMS = 3      // distinct matched content terms

/**
 * Best page for a single claim, or null when no page matches it well enough.
 * Score = matched idf weight / total idf weight of the claim's own terms.
 */
function anchorClaimToPage(
  claim: string,
  pageIndex: PageSegment[],
  idf: Map<string, number>
): { page: number; score: number; matched: number; head: string; quote: string | null } | null {
  if (!pageIndex.length) return null
  const terms = [...new Set(anchorTerms(claim))]
  if (terms.length === 0) return null
  const totalWeight = terms.reduce((a, t) => a + (idf.get(t) ?? Math.log(pageIndex.length + 1)), 0)
  if (totalWeight <= 0) return null

  let best: { seg: PageSegment; score: number; matched: number } | null = null
  for (const seg of pageIndex) {
    let w = 0, matched = 0
    for (const t of terms) {
      if (seg.terms.has(t)) { w += (idf.get(t) ?? 0); matched++ }
    }
    if (matched === 0) continue
    const score = w / totalWeight
    // Strictly-greater keeps the EARLIEST page on a tie, which is where a
    // topic is normally introduced.
    if (!best || score > best.score) best = { seg, score, matched }
  }
  if (!best) return null
  if (best.matched < ANCHOR_MIN_TERMS || best.score < ANCHOR_MIN_SCORE) return null
  return {
    page: best.seg.page,
    score: best.score,
    matched: best.matched,
    head: best.seg.head,
    // Verbatim sentence from that page, so the student sees what the source
    // actually says rather than just a page number.
    quote: bestQuoteForClaim(claim, best.seg.body, idf)
  }
}

// ---- (kopya bloğun sonu) ----

// summarize-document'taki kayıt parça boyu (kopya; testte denetleniyor).
const CHUNK_STORE_SIZE = 1200

type ChunkRow = { page_start: number | null; page_end: number | null; text: string }

/** Aynı sayfanın kayıt parçalarını yeniden birleştirir. Çok uzun bir
 *  paragraf kayıtta tam CHUNK_STORE_SIZE karakterde, çoğu zaman kelimenin
 *  ortasından kesiliyor; o parçanın arkasına boşluk koymak alıntıda
 *  "azal ır" gibi kırık kelime üretir. Tam boyda biten parça kesik sayılır
 *  ve sonrakiyle boşluksuz birleşir; öteki parçalar paragraf arasıyla. */
function joinChunkParts(parts: string[]): string {
  let out = ''
  let prev: string | null = null
  for (const part of parts) {
    if (prev === null) out = part
    else out += (prev.length === CHUNK_STORE_SIZE ? '' : '\n\n') + part
    prev = part
  }
  return out
}
type SourceAnchor = { page: number; page_end: number | null; quote: string | null; unit: 'page' | 'slide' }

/** document_chunks satırlarından (chunk_index sırasıyla) sayfa dizini.
 *  Kısa sayfalar kayıtta tek parçada birleşmiş olabilir (page_start <
 *  page_end); o parça başlangıç sayfasıyla dizine girer, bitişi ayrıca
 *  tutulur ki "s. 3–5" diye gösterilebilsin. Sayfasız belgede (DOCX, düz
 *  metin) boş dizin döner ve sorular sayfasız kalır. */
function buildPageIndexFromChunks(rows: ChunkRow[]): { index: PageSegment[]; pageEnd: Map<number, number> } {
  const groups = new Map<number, { end: number; parts: string[] }>()
  for (const r of rows || []) {
    const start = Number(r && r.page_start)
    if (!Number.isInteger(start) || start <= 0) continue
    const endRaw = Number(r.page_end)
    const end = Number.isInteger(endRaw) && endRaw >= start ? endRaw : start
    const g = groups.get(start)
    if (g) { g.end = Math.max(g.end, end); g.parts.push(String(r.text || '')) }
    else groups.set(start, { end, parts: [String(r.text || '')] })
  }
  const index: PageSegment[] = []
  const pageEnd = new Map<number, number>()
  for (const [page, g] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    const body = joinChunkParts(g.parts).trim()
    if (!body) continue
    index.push({
      page,
      terms: new Set(anchorTerms(body)),
      head: (body.split('\n').map(l => l.trim()).find(l => l.length > 3) || '').slice(0, 70),
      body
    })
    if (g.end > page) pageEnd.set(page, g.end)
  }
  return { index, pageEnd }
}

/** Bir sorunun kaynağı: birkaç aday iddia (açıklama + doğru cevap, soru +
 *  doğru cevap, açık uçluda örnek cevap, modelin kaynaktan birebir aldığı
 *  terimler) denenir, en yüksek puanlı eşleşme alınır. Hiçbiri eşiği
 *  geçmezse null.
 *
 *  source_terms neden var (21.10.2026, canlı test): belge İngilizce, sınav
 *  Türkçe olunca soru metniyle sayfa arasında ortak kelime kalmıyor ve
 *  hiçbir soru bağlanamıyordu (0/6). Model kaynaktaki terimleri kaynağın
 *  kendi dilinde kopyalıyor; eşleşme o terimlerle de deneniyor. */
function anchorQuestionToSource(q: Record<string, unknown>, index: PageSegment[], idf: Map<string, number>, pageEnd: Map<number, number>, unit: 'page' | 'slide' = 'page'): SourceAnchor | null {
  if (!index.length) return null
  const answer = typeof q.correct_answer === 'string' ? q.correct_answer : ''
  const terms = Array.isArray(q.source_terms) ? (q.source_terms as unknown[]).map(t => String(t ?? '')).join(' ') : ''
  const claims = [
    [q.explanation, answer].filter(Boolean).join(' '),
    [q.question, answer].filter(Boolean).join(' '),
    q.type === 'open_ended' ? answer : '',
    terms
  ].map(c => String(c || '').trim()).filter(c => c.length > 0)
  let best: ReturnType<typeof anchorClaimToPage> = null
  for (const claim of claims) {
    const hit = anchorClaimToPage(claim, index, idf)
    if (hit && (!best || hit.score > best.score)) best = hit
  }
  const termList = Array.isArray(q.source_terms) ? (q.source_terms as unknown[]).map(t => String(t ?? '').trim()).filter(Boolean) : []
  if (!best) {
    // Atıf motoru 4 harften kısa kelimeleri saymıyor; "IF", "AND", "LEN"
    // gibi fonksiyon adlarıyla kurulan sorular hiç bağlanamıyordu.
    const byTerms = anchorByExactTerms(termList, index)
    return byTerms ? { page: byTerms.page, page_end: pageEnd.get(byTerms.page) ?? null, quote: byTerms.quote, unit } : null
  }
  // Sayfa doğru olsa da alıntı başka bir konudan olabiliyor (canlı testte
  // CHOOSE sorusuna OFFSET cümlesi). Terimlerden hiçbirini içermeyen alıntı
  // gösterilmez; sayfa kalır.
  let quote = best.quote
  if (quote && termList.length && !termList.some(t => termRegex(t).test(quote as string))) quote = null
  return { page: best.page, page_end: pageEnd.get(best.page) ?? null, quote, unit }
}

/** Terimi kelime sınırlarıyla arayan düzenli ifade. Kısa terimler (≤4
 *  harf, ör. "IF", "AND") büyük/küçük harfe duyarlı: İngilizce "and"
 *  her sayfada geçer, fonksiyon adı "AND" geçmez. */
function termRegex(term: string): RegExp {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, term.length <= 4 ? 'u' : 'iu')
}

/** Yedek eşleştirme: modelin kaynaktan kopyaladığı terimlerden en çoğunun
 *  birebir geçtiği sayfa. En az 2 farklı terim ve tek bir kazanan şart
 *  (beraberlikte sayfa verilmez). Alıntı: en çok terim içeren cümle. */
function anchorByExactTerms(terms: string[], index: PageSegment[]): { page: number; quote: string | null } | null {
  const uniq = [...new Set(terms.filter(t => t.length >= 2))].slice(0, 8)
  if (uniq.length < 2 || !index.length) return null
  const res = uniq.map(termRegex)
  const scored = index.map(seg => ({ seg, hits: res.filter(r => r.test(seg.body)).length }))
    .sort((a, b) => b.hits - a.hits)
  const top = scored[0]
  if (!top || top.hits < 2 || (scored[1] && scored[1].hits === top.hits)) return null
  let quote: string | null = null, quoteHits = 0
  for (const sentence of splitSentences(top.seg.body)) {
    if (sentence.length < QUOTE_MIN_CHARS) continue
    const h = res.filter(r => r.test(sentence)).length
    if (h > quoteHits) { quoteHits = h; quote = sentence }
  }
  if (quote && quote.length > QUOTE_MAX_CHARS) quote = quote.slice(0, QUOTE_MAX_CHARS).replace(/\s+\S*$/, '') + '…'
  return { page: top.seg.page, quote }
}

/** Sunum dosyasında "slayt", ötekilerde "sayfa" (summarize-document da
 *  PPTX'e SLAYT işaretçisi koyuyor). */
function sourceUnitFor(fileName: unknown): 'page' | 'slide' {
  return /\.(pptx?|ppsx?|odp|key)$/i.test(String(fileName || '')) ? 'slide' : 'page'
}

/** Belgenin chunk'larını okur (en fazla 3.000 satır, 1.000'lik sayfalarla). */
async function loadDocumentChunks(client: ReturnType<typeof createClient>, documentId: string): Promise<ChunkRow[]> {
  const out: ChunkRow[] = []
  for (let from = 0; from < 3000; from += 1000) {
    const { data, error } = await client
      .from('document_chunks')
      .select('page_start, page_end, text')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })
      .range(from, from + 999)
    if (error) { console.warn('generate-exam: document_chunks okunamadi:', error.message); break }
    out.push(...((data || []) as ChunkRow[]))
    if (!data || data.length < 1000) break
  }
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { studyCardId, sourceType, courseCode, courseDepartment, examType, questionCount, language, difficulty, isSimulation, focusConcept, optionCount, negativeMarking } = await req.json()
    const scoring = normalizeScoring(optionCount, negativeMarking)

    // 'study_card' (default, backward-compatible) generates from one of the
    // student's own study cards, as before. 'course' generates directly from
    // a Ders Ağacı catalog course — see the branch below for how its context
    // is built (pooled shared study cards for that course if any exist, else
    // a general-knowledge fallback).
    const resolvedSourceType = sourceType === 'course' ? 'course' : 'study_card'
    if (resolvedSourceType === 'study_card' && !studyCardId) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: studyCardId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (resolvedSourceType === 'course' && !courseCode) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: courseCode' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (!examType || !questionCount || !language) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    // Arayüz 1–20 sınırını koyuyor ama sunucu da koymalı: aksi halde tek bir
    // istek 500 soruluk bir üretimle Groq kotasını tüketebilir.
    if (!ALLOWED_EXAM_TYPES.includes(examType) || !ALLOWED_LANGUAGES.includes(language)) {
      return new Response(JSON.stringify({ error: 'Geçersiz sınav türü veya dil.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const requestedCount = Math.min(MAX_QUESTION_COUNT, Math.max(1, Math.floor(Number(questionCount) || 0)))

    // Difficulty is optional for backward compatibility with older clients; default to 'medium'.
    const allowedDifficulties = ['easy', 'medium', 'hard']
    const resolvedDifficulty = allowedDifficulties.includes(difficulty) ? difficulty : 'medium'

    // "Gerçek Sınav Simülasyonu" — a timed, single-attempt mode meant to
    // mimic real vize/final/büt conditions. The time budget is computed
    // server-side (not trusted from the client) from question type/count,
    // roughly matching how long each question type realistically takes.
    const resolvedIsSimulation = !!isSimulation
    let timeLimitSeconds: number | null = null
    if (resolvedIsSimulation) {
      const secondsPerQuestion: Record<string, number> = {
        classic: 150,      // open-ended essay answers take longest to write
        test: 75,          // multiple-choice, quick to answer
        mixed: 100,        // blend of true/false, fill-blank, open-ended
        calculation: 180   // working through a calculation takes longest
      }
      const perQ = secondsPerQuestion[examType] || 100
      timeLimitSeconds = Math.max(300, Math.round(requestedCount * perQ))
    }

    // Optional: focus every question on one specific concept (used by the
    // "Zayıf Konularınız" panel's "Bu konudan pratik yap" action) instead of
    // spreading across the whole source's content.
    const resolvedFocusConcept = (typeof focusConcept === 'string' && focusConcept.trim())
      ? focusConcept.trim().slice(0, 120)
      : null

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Fetch user details from auth token
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Service role client: rate limit sayımı, sınav kaydı ve cevap anahtarı.
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Kullanıcı başına üretim limiti. Sayım başarısız olursa (ör. created_at
    // kolonu yoksa) üretimi engelleme — en iyi gayret.
    try {
      const now = Date.now()
      const countSince = async (ms: number) => {
        const { count, error } = await serviceClient
          .from('exams')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', new Date(now - ms).toISOString())
        if (error) throw error
        return count ?? 0
      }
      const [lastHour, lastDay] = await Promise.all([countSince(3600_000), countSince(86400_000)])
      if (lastHour >= EXAM_RATE_LIMIT_PER_HOUR || lastDay >= EXAM_RATE_LIMIT_PER_DAY) {
        const tr = language === 'tr'
        const msg = lastHour >= EXAM_RATE_LIMIT_PER_HOUR
          ? (tr ? `Son bir saatte ${EXAM_RATE_LIMIT_PER_HOUR} sınav oluşturdun. Biraz sonra tekrar dene.` : `You created ${EXAM_RATE_LIMIT_PER_HOUR} exams in the last hour. Please try again later.`)
          : (tr ? `Bugünkü ${EXAM_RATE_LIMIT_PER_DAY} sınav hakkını kullandın. Yarın tekrar dene.` : `You have used today's ${EXAM_RATE_LIMIT_PER_DAY} exams. Please try again tomorrow.`)
        return new Response(JSON.stringify({ error: msg }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } catch (rateErr) {
      console.warn('generate-exam: rate limit sayimi yapilamadi, limit atlandi:', rateErr)
    }

    let isQuant = false
    let context = ''
    let isGrounded = true
    let isAdminKnowledgeGrounded = false
    let canonicalCourseCode: string | null = null
    let canonicalCourseName: string | null = null
    let courseDeptName: string | null = null
    let sourceDocumentId: string | null = null
    let conceptRuleText = '- For every question, set a "concept" field to the single key term (from the KEY TERMS list provided) that the question is primarily testing.'

    // Evenly samples up to maxCount items across an array, so a very large
    // scanned book (hundreds of key points) still yields a representative
    // spread across the whole book rather than just its first few chapters.
    const sampleEvenly = <T,>(items: T[], maxCount: number): T[] => {
      if (items.length <= maxCount) return items
      const step = items.length / maxCount
      const sampled: T[] = []
      for (let i = 0; i < maxCount; i++) sampled.push(items[Math.floor(i * step)])
      return sampled
    }

    if (resolvedSourceType === 'study_card') {
      // Verify study card ownership and load context
      const { data: card, error: cardError } = await userClient
        .from('study_cards')
        .select('*')
        .eq('id', studyCardId)
        .single()

      if (cardError || !card) {
        console.error("Card ownership check failed: ", cardError)
        return new Response(JSON.stringify({ error: 'Study card not found or access denied' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      isQuant = !!card.is_quantitative
      sourceDocumentId = typeof card.document_id === 'string' ? card.document_id : null
      context = `
SUMMARY:
${card.summary || ''}

KEY TERMS:
${JSON.stringify(card.key_terms || [])}

KEY POINTS:
${JSON.stringify(card.key_points || [])}

${card.formulas && card.formulas.length > 0 ? `FORMULAS:\n${JSON.stringify(card.formulas)}` : ''}
${card.worked_examples && card.worked_examples.length > 0 ? `WORKED EXAMPLES:\n${JSON.stringify(card.worked_examples)}` : ''}
      `.trim()
    } else {
      // 'course' — generate directly from a Ders Ağacı catalog course rather
      // than a single personal study card. Look up the canonical course row
      // ourselves (defense-in-depth: don't trust arbitrary client-supplied
      // course/department strings for the pooling query below).
      const { data: courseRow, error: courseErr } = await userClient
        .from('courses')
        .select('course_code, course_name, department_code, is_quantitative, departments(name, name_tr)')
        .eq('course_code', courseCode)
        .maybeSingle()

      if (courseErr || !courseRow) {
        console.error("Course lookup failed: ", courseErr)
        return new Response(JSON.stringify({ error: 'Course not found in catalog' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      canonicalCourseCode = courseRow.course_code
      canonicalCourseName = courseRow.course_name
      const deptInfo = (courseRow as Record<string, unknown>).departments as Record<string, unknown> | null
      courseDeptName = (deptInfo && typeof deptInfo.name === 'string') ? deptInfo.name : (courseDepartment || null)

      // Pool up to 6 of the most recent shared study cards tagged to this
      // course — real, student-contributed content beats a from-scratch AI
      // guess whenever it's available. course_tag is free text (see
      // study_cards.course_tag), so match case-insensitively.
      const MAX_POOLED_CARDS = 6
      let sharedCards: Record<string, unknown>[] = []
      if (courseDeptName) {
        const { data: pooled, error: poolErr } = await userClient
          .from('study_cards')
          .select('summary, key_terms, key_points, formulas, is_quantitative')
          .eq('is_shared', true)
          .eq('department', courseDeptName)
          .ilike('course_tag', canonicalCourseCode)
          .order('created_at', { ascending: false })
          .limit(MAX_POOLED_CARDS)
        if (poolErr) console.warn('Failed to pool shared study cards for course exam:', poolErr)
        sharedCards = pooled || []
      }

      isGrounded = sharedCards.length > 0
      // A course counts as quantitative either because the official course
      // catalog says so (courses.is_quantitative, curated per course — e.g.
      // Financial Management is calculation-heavy regardless of whether any
      // student has shared notes for it yet) or because the pooled shared
      // material itself turns out to be quantitative.
      isQuant = !!(courseRow as Record<string, unknown>).is_quantitative || (isGrounded && sharedCards.some(c => !!c.is_quantitative))

      // The admin "Kitap Tarama" knowledge base (course_knowledge_index) that
      // used to be queried here as the highest-trust source was removed —
      // see supabase/migrations/20260830_remove_course_knowledge_base.sql.
      // knowledgeContext stays declared (always empty) and
      // isAdminKnowledgeGrounded stays declared (always false, see above)
      // purely so the trust-tier logic and prompt-building below — which
      // still reference both — don't need to change; the net effect is that
      // this tier can now never trigger and exams fall through to the
      // pooled-shared-study-cards tier or the generic-AI-knowledge tier.
      const knowledgeContext = ''

      // "Ders Kaynakları" — students self-report which real textbook a
      // course's professor uses and/or which topics it actually covers (see
      // supabase/migrations/20260828e_add_course_resources.sql). This is the
      // ONLY source of that fact; it is never guessed by the AI. When
      // present, it's woven into the prompt as real, if unverified, signal —
      // clearly labeled as student-reported rather than confirmed fact.
      let resourceContext = ''
      const { data: resources, error: resourceErr } = await userClient
        .from('course_resources')
        .select('book_title, book_author, topics_note')
        .eq('course_code', canonicalCourseCode)
        .order('created_at', { ascending: false })
        .limit(8)
      if (resourceErr) console.warn('Failed to load course resources for course exam:', resourceErr)
      if (resources && resources.length > 0) {
        const textbooks = resources.filter(r => r.book_title).map(r => `${r.book_title}${r.book_author ? ` — ${r.book_author}` : ''}`)
        const notes = resources.filter(r => r.topics_note).map(r => r.topics_note)
        resourceContext = `\n\nSTUDENT-REPORTED COURSE RESOURCES for "${canonicalCourseName}" (unverified, but reported by real students taking this course — treat as a strong hint about real course content, not pooled study notes):`
        if (textbooks.length > 0) resourceContext += `\nReported textbook(s): ${[...new Set(textbooks)].join('; ')}`
        if (notes.length > 0) resourceContext += `\nReported topic/coverage notes: ${[...new Set(notes)].join(' | ').slice(0, 1000)}`
      }

      if (sharedCards.length > 0) {
        const merged = sharedCards.map((c, idx) => `
--- Shared Study Card ${idx + 1} ---
SUMMARY: ${String(c.summary || '').slice(0, 1200)}
KEY TERMS: ${JSON.stringify((c.key_terms as unknown[] || []).slice(0, 12))}
KEY POINTS: ${JSON.stringify((c.key_points as unknown[] || []).slice(0, 10))}
${c.formulas && (c.formulas as unknown[]).length > 0 ? `FORMULAS: ${JSON.stringify(c.formulas).slice(0, 800)}` : ''}
        `.trim()).join('\n\n')

        context = `${knowledgeContext ? knowledgeContext + '\n\n' : ''}The following is POOLED, STUDENT-SHARED study material for the course "${canonicalCourseName}" (${canonicalCourseCode}), combined from ${sharedCards.length} shared study card(s) contributed by students taking this course:\n\n${merged}${resourceContext}`
        conceptRuleText = '- For every question, set a "concept" field to the single key term (from the pooled KEY TERMS lists / official knowledge base terms provided) that the question is primarily testing.'
      } else if (isAdminKnowledgeGrounded) {
        context = `${knowledgeContext}${resourceContext}`
        conceptRuleText = '- For every question, set a "concept" field to the single key term (from the KEY TERMS list in the official scanned course knowledge base) that the question is primarily testing.'
      } else {
        context = `No student-shared study material exists yet for the course "${canonicalCourseName}" (${canonicalCourseCode})${courseDeptName ? ` in the "${courseDeptName}" department` : ''}. Draw on your own general academic knowledge of a standard undergraduate business-faculty course with this name/code. If you are not fully confident about a very specific fact, figure, or example, phrase it in general but still accurate terms rather than inventing a false-sounding precise detail.${resourceContext}${resourceContext ? '\n\nPrioritize the student-reported resources above over your own generic guess wherever they give useful signal (e.g. if a specific textbook is named, lean on your own knowledge of THAT book\'s typical content/structure rather than a generic textbook on the subject).' : ''}`
        conceptRuleText = '- For every question, set a "concept" field to a short (1-4 word) topic label, in the requested language, that the question is primarily testing.'
      }
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: 'Groq API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Source description and the mixed-type spread are both stable per
    // course/branch (same for every student hitting this exact course +
    // knowledge-branch combination), not per individual request, so they
    // belong in the system message alongside the source material below --
    // NOT in the short per-request user message -- to keep the system
    // message identical across students and eligible for Groq's prompt
    // caching.
    const sourceDescription = resolvedSourceType === 'study_card'
      ? 'You will be given the summary, key terms, key points, and optional formulas/examples of a study card.'
      : (isAdminKnowledgeGrounded
          ? 'You will be given topics, key terms, key points, and optional formulas extracted directly from the real, official course textbook/material for one course (and possibly also pooled student-shared study cards) — this is authoritative, verified content, not a guess.'
          : (isGrounded
              ? 'You will be given pooled summaries, key terms, key points, and optional formulas from multiple students\' shared study cards for one course.'
              : 'You will be given a course name/code with no student-shared material yet — use your own general academic knowledge of the subject, as instructed below.'))

    const mixedTypeRuleNote = isQuant
      ? "MIXED TYPE RULE: This source IS quantitative — for 'mixed' exams, distribute question types as evenly as possible across FIVE types: 'open_ended', 'multiple_choice', 'true_false', 'fill_blank', and 'calculation'."
      : "MIXED TYPE RULE: This source is NOT quantitative — for 'mixed' exams, distribute question types as evenly as possible across FOUR types: 'open_ended', 'multiple_choice', 'true_false', and 'fill_blank'."

    // System message: everything in it is either fully static
    // (STATIC_EXAM_INSTRUCTIONS) or stable per course/branch, and it is
    // built BEFORE any per-student choice is added — so two different
    // students requesting an exam for the same course (same branch, same
    // quant flag) send the exact same system message, letting Groq cache
    // it instead of re-billing/re-counting it against our rate limit.
    const sysPrompt = `
You are an academic study assistant. ${sourceDescription}

${mixedTypeRuleNote}

IMPORTANT CONCEPT TAGGING RULE:
${conceptRuleText}

${STATIC_EXAM_INSTRUCTIONS}

SOURCE MATERIAL:
${context}
    `.trim()

    // User message: ONLY the small bits that genuinely vary per request
    // (this student's own choice of exam type/count/language/difficulty,
    // their optional focus concept, and a variation seed). Keeping this
    // short and putting everything reusable above in the system message
    // is what makes the system message worth caching in the first place.
    const buildUserPrompt = (count: number, avoid: string[]) => `Generate exactly ${count} questions of type '${examType}' in the language '${language}' (en = English, tr = Turkish), at difficulty level '${resolvedDifficulty}'.
OPTION COUNT: every 'multiple_choice' question has exactly ${scoring.option_count} options.${resolvedFocusConcept ? `\n\nIMPORTANT FOCUS RULE:\n- The student specifically wants to practice ONE topic: "${resolvedFocusConcept}". EVERY question must test this exact topic, approached from different angles (definition, application, comparison, scenario) — do not drift to unrelated concepts. Set the "concept" field on every question to "${resolvedFocusConcept}" (or a very close variant in the requested language).` : ''}${avoid.length > 0 ? `\n\nDo NOT repeat these questions that were already generated:\n${avoid.map(t => `- ${t.slice(0, 160)}`).join('\n')}` : ''}

Additional variation seed: ${Date.now()}`

    // Tek bir üretim çağrısı. Başarısızsa { error } döner, istisna fırlatmaz.
    const requestQuestions = async (count: number, avoid: string[], attempt = 0): Promise<{ items?: unknown[]; error?: string }> => {
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          // llama-3.3-70b-versatile was retired by Groq on 2026-08-16 — every
          // exam generation was failing with a decommissioned-model error,
          // which is why "Sınav Platformu" looked broken/nonexistent.
          model: "openai/gpt-oss-120b",
          temperature: 0.9,
          // 22.10.2026 (canlı test): gpt-oss akıl yürütme modeli; görünmeyen
          // düşünme tokenları çıktı bütçesini yiyince yanıt boş ya da tek
          // soruda kesik geliyordu. Düşünme payı kısıldı, bütçe soru
          // sayısına göre açıkça veriliyor (hesap 8.000 TPM ile sınırlı).
          reasoning_effort: "low",
          max_completion_tokens: Math.min(GEN_TOKENS_MAX, completionBudgetFor(count) + (examType === 'calculation' ? GEN_TOKENS_CALC_EXTRA * count : 0)),
          // JSON modu üst düzeyde NESNE döndürür; prompt bu yüzden artık
          // {"questions":[...]} istiyor. Eskiden dizi istenip json_object
          // modu kullanılıyordu — ara sıra görülen "invalid formatting"
          // hatalarının olası kaynağı buydu.
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: buildUserPrompt(count, avoid) }
          ]
        })
      })

      const groqData = await groqResponse.json().catch(() => ({}))
      if (!groqResponse.ok) {
        // JSON modu doğrulaması düştüyse (ör. yanıt bütçede kesildi) Groq ham
        // çıktıyı failed_generation'da verir: içindeki tam soruları kurtar;
        // hiçbiri yoksa bir kez daha dene.
        if (groqData?.error?.code === 'json_validate_failed') {
          const salvaged = salvageQuestionObjects(String(groqData.error.failed_generation ?? ''))
          console.warn(`generate-exam: Groq JSON dogrulamasi dustu; ${salvaged.length} soru kurtarildi`)
          if (salvaged.length > 0) return { items: salvaged }
          if (attempt < GEN_MAX_RETRIES) return requestQuestions(count, avoid, attempt + 1)
        }
        // FAZ 2 (canlı test): eksik sorular için yapılan ikinci istek
        // dakikalık token sınırına (TPM) takılıyordu. Groq'un söylediği süre
        // kısaysa bekleyip yeniden dene (kayan dakika penceresi yüzünden bir
        // bekleme her zaman yetmiyor; en fazla GEN_MAX_RETRIES kez).
        const waitMs = attempt < GEN_MAX_RETRIES ? groqRetryDelayMs(groqResponse.status, groqResponse.headers.get('retry-after'), groqData?.error?.message) : null
        if (waitMs !== null) {
          console.warn(`generate-exam: Groq hiz siniri, ${Math.round(waitMs / 1000)} sn beklenip yeniden deneniyor`)
          await new Promise(r => setTimeout(r, waitMs))
          return requestQuestions(count, avoid, attempt + 1)
        }
        console.error("Groq generation failed: ", groqData)
        return { error: groqData?.error?.message || groqData?.error?.code || `HTTP ${groqResponse.status}` }
      }
      const choice = groqData.choices?.[0]
      const rawContent = choice?.message?.content ?? ""
      const usage = groqData.usage || {}
      console.log(`generate-exam: groq finish=${choice?.finish_reason} istenen=${count} prompt=${usage.prompt_tokens} cikti=${usage.completion_tokens} butce=${completionBudgetFor(count)}`)
      let items = parseQuestionArray(rawContent)
      // Bütçede kesilen yanıt: tamamlanmış soru nesnelerini kurtar.
      if (!items && rawContent) {
        const salvaged = salvageQuestionObjects(String(rawContent))
        if (salvaged.length > 0) {
          console.warn(`generate-exam: yanit kesik (finish=${choice?.finish_reason}); ${salvaged.length} soru kurtarildi`)
          items = salvaged
        }
      }
      if (!items) {
        console.error("Failed to parse Groq response as a question list. Content: ", String(rawContent).slice(0, 2000))
        return { error: 'invalid_format' }
      }
      return { items }
    }

    const allowedTypes = allowedTypesFor(examType, isQuant)
    const accepted: Record<string, unknown>[] = []
    const seenTexts = new Set<string>()
    const rejectReasons: string[] = []

    const rejectedRaw: unknown[] = []
    const absorb = (items: unknown[], allowUnverifiedCalc = false) => {
      for (const raw of items) {
        if (accepted.length >= requestedCount) break
        const result = validateQuestion(raw, allowedTypes, language, scoring.option_count, allowUnverifiedCalc)
        if (!result.ok || !result.question) {
          const reason = result.reason || 'unknown'
          rejectReasons.push(reason)
          if (reason.startsWith('calc_')) {
            const r = (raw || {}) as Record<string, unknown>
            console.warn(`generate-exam: ${reason} formula=${JSON.stringify(r.formula ?? null).slice(0, 160)} vars=${JSON.stringify(r.variables ?? null).slice(0, 160)}`)
            if (!allowUnverifiedCalc) rejectedRaw.push(raw)
          }
          continue
        }
        const textKey = normalizeAnswerText(result.question.question)
        if (seenTexts.has(textKey)) {
          rejectReasons.push('duplicate_question')
          continue
        }
        seenTexts.add(textKey)
        accepted.push(result.question)
      }
    }

    const first = await requestQuestions(requestedCount, [])
    if (first.error && !first.items) {
      const detail = first.error === 'invalid_format' ? 'AI returned invalid question formatting. Please try again.' : `AI generation service failed: ${first.error}`
      return new Response(JSON.stringify({ error: detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    absorb(first.items || [])

    // Eksik kalan soru varsa bir kez daha, yalnızca eksik sayı kadar iste.
    if (accepted.length < requestedCount) {
      const shortfall = requestedCount - accepted.length
      console.warn(`generate-exam: ${rejectReasons.length} soru dogrulamadan gecmedi (${rejectReasons.join(', ')}); ${shortfall} soru icin yeniden uretim isteniyor`)
      const second = await requestQuestions(shortfall, accepted.map(q => String(q.question)))
      if (second.items) absorb(second.items)
      else console.warn('generate-exam: ikinci uretim basarisiz:', second.error)
    }

    // FAZ 3a son çare: hâlâ eksikse, formülü doğrulanamayan ama cevabı sayı
    // olan hesap soruları eskisi gibi (doğrulanmamış) alınır. Çelişenler değil.
    if (accepted.length < requestedCount && rejectedRaw.length) {
      const before = accepted.length
      absorb(rejectedRaw.splice(0), true)
      if (accepted.length > before) console.warn(`generate-exam: ${accepted.length - before} hesap sorusu dogrulanmadan alindi`)
    }

    if (accepted.length === 0) {
      console.error('generate-exam: gecerli soru kalmadi. Nedenler:', rejectReasons.join(', '))
      return new Response(JSON.stringify({ error: 'AI failed to generate a list of questions.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Sıra numaralarını yeniden ver, zorluğu sunucuda damgala (modelin geri
    // yansıtmasına güvenme), çoktan seçmeli şıkları karıştır.
    const finalQuestions = accepted.map((q, i) => {
      const out: Record<string, unknown> = { ...q, id: i + 1, difficulty: resolvedDifficulty }
      if (out.type === 'multiple_choice' && Array.isArray(out.options)) {
        out.options = shuffleInPlace([...(out.options as string[])])
      }
      return out
    })

    // FAZ 2: kaynak sayfa. Belge sayfalıysa her soru bir sayfaya bağlanmaya
    // çalışılır; başarısızlık sınav üretimini asla durdurmaz.
    if (sourceDocumentId) {
      try {
        const chunks = await loadDocumentChunks(serviceClient, sourceDocumentId)
        const { index, pageEnd } = buildPageIndexFromChunks(chunks)
        if (index.length) {
          const idf = buildAnchorIdf(index)
          const { data: docRow } = await serviceClient.from('documents').select('file_name').eq('id', sourceDocumentId).maybeSingle()
          const unit = sourceUnitFor(docRow && (docRow as Record<string, unknown>).file_name)
          let anchored = 0
          for (const q of finalQuestions) {
            const src = anchorQuestionToSource(q, index, idf, pageEnd, unit)
            if (src) { q.source = src; anchored++ }
          }
          console.log(`generate-exam: ${anchored}/${finalQuestions.length} soru kaynak sayfaya baglandi (${index.length} sayfa)`)
        }
      } catch (e) {
        console.warn('generate-exam: kaynak sayfa baglama atlandi:', e)
      }
    }

    // source_terms yalnızca eşleştirme için; ne tarayıcıya ne anahtara gider.
    for (const q of finalQuestions) delete q.source_terms

    const publicQuestions: Record<string, unknown>[] = []
    const answerKeys: Record<string, Record<string, unknown>> = {}
    for (const q of finalQuestions) {
      const { pub, key } = splitPublicAndKey(q)
      publicQuestions.push(pub)
      answerKeys[String(q.id)] = key
    }

    const examInsertPayload: Record<string, unknown> = {
      user_id: user.id,
      exam_type: examType,
      language: language,
      question_count: finalQuestions.length,
      questions: publicQuestions,
      answers: null,
      question_results: null,
      grade: null,
      completed_at: null,
      source_type: resolvedSourceType,
      is_simulation: resolvedIsSimulation,
      time_limit_seconds: timeLimitSeconds,
      started_at: new Date().toISOString(),
      scoring
    }
    if (resolvedSourceType === 'course') {
      examInsertPayload.study_card_id = null
      examInsertPayload.course_code = canonicalCourseCode
      examInsertPayload.course_department = courseDeptName
      examInsertPayload.is_grounded = isGrounded
      examInsertPayload.is_admin_knowledge_grounded = isAdminKnowledgeGrounded
    } else {
      examInsertPayload.study_card_id = studyCardId
      examInsertPayload.is_grounded = true
    }

    let { data: newExam, error: insertError } = await serviceClient
      .from('exams')
      .insert(examInsertPayload)
      .select()
      .single()

    // 20261014_exam_integrity.sql henüz çalıştırılmadıysa started_at kolonu
    // yoktur: onsuz bir kez daha dene ki sınav üretimi durmasın.
    if (insertError && /started_at/.test(`${insertError.message || ''} ${insertError.details || ''}`)) {
      console.warn('generate-exam: started_at kolonu yok — 20261014_exam_integrity.sql migration i calistirilmamis. Sure kontrolu sunucuda yapilamayacak.')
      delete examInsertPayload.started_at
      const retry = await serviceClient.from('exams').insert(examInsertPayload).select().single()
      newExam = retry.data
      insertError = retry.error
    }

    // 20261022b_exam_scoring.sql henüz çalıştırılmadıysa scoring kolonu
    // yoktur: onsuz dene (ceza uygulanmaz, sınav yine üretilir).
    if (insertError && /scoring/.test(`${insertError.message || ''} ${insertError.details || ''}`)) {
      console.warn('generate-exam: scoring kolonu yok — 20261022b_exam_scoring.sql calistirilmamis. Yanlis dogruyu goturme uygulanmayacak.')
      delete examInsertPayload.scoring
      const retry = await serviceClient.from('exams').insert(examInsertPayload).select().single()
      newExam = retry.data
      insertError = retry.error
    }

    if (insertError || !newExam) {
      console.error("Failed to insert exam record: ", insertError)
      // Surface the real Postgres error (e.g. "column ... does not exist"
      // when a migration hasn't been run yet) instead of a generic message
      // that hides what actually went wrong.
      const insertDetail = insertError?.message || insertError?.details || insertError?.hint || insertError?.code || 'unknown error'
      return new Response(JSON.stringify({ error: `Failed to save generated exam: ${insertDetail}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Cevap anahtarını ayrı tabloya yaz. Tablo yoksa (migration
    // çalıştırılmamış) sınavı ESKİ düzene, yani anahtar soruların içinde
    // olacak şekilde güncelle: puanlama çalışmaya devam etsin, yalnızca
    // anahtar gizlenemesin.
    const { error: keyError } = await serviceClient
      .from('exam_answer_keys')
      .insert({ exam_id: newExam.id, user_id: user.id, keys: answerKeys })

    if (keyError) {
      console.error('generate-exam: exam_answer_keys yazilamadi — cevap anahtari GIZLENEMIYOR. 20261014_exam_integrity.sql calistirildi mi?', keyError)
      const { data: legacyExam, error: legacyErr } = await serviceClient
        .from('exams')
        .update({ questions: finalQuestions })
        .eq('id', newExam.id)
        .select()
        .single()
      if (legacyErr || !legacyExam) {
        console.error('generate-exam: eski duzene donus de basarisiz:', legacyErr)
        return new Response(JSON.stringify({ error: 'Failed to save generated exam answer key.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      // Eski düzende bile tarayıcıya giden yanıtta anahtar olmasın.
      return new Response(JSON.stringify({ ...legacyExam, questions: publicQuestions }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify(newExam), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error("generate-exam exception: ", err)
    return new Response(JSON.stringify({ error: 'Internal server error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
