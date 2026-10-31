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
  "type": "multiple_choice" | "open_ended" | "true_false" | "fill_blank" | "calculation" | "expression" | "graph",
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
  "chart_ref": number | null,
  "graph": {"x": {"min": number, "max": number, "step": number, "label": "string", "var": "string"}, "y": {...same}, "given": [element]} | null,
  "graph_answer": [element] | "none" | null,
  "hint": "string (short helpful clue that does NOT reveal the answer)",
  "concept": "string",
  "explanation": "string",
  "option_rationales": [{"option": "string", "why": "string"}] | null,
  "rubric": [{"criterion": "string", "points": number}] | null,
  "source_terms": ["string"]
}
For 'multiple_choice', the options must be distinct and exactly one must be correct; with 5 options every distractor must still be plausible.

CHART QUESTIONS (only when the SOURCE MATERIAL has a CHARTS section):
- The student sees every chart in CHARTS drawn as a graph with its values labelled. Make about one in four questions (at least one) chart-reading questions: set "chart_ref" to the chart's number, and write the question so it must be answered by reading that chart (trend, highest/lowest, difference, change, ratio or share). Refer to it as "the chart" / "grafik".
- Do NOT restate the chart's numbers in the question text. For a 'calculation' chart question, "variables" take the values from the chart.
- Use only charts that are listed; never invent data. "chart_ref" is null for every other question.

GRAPH DRAWING QUESTIONS (type 'graph'; only when the user message says GRAPH QUESTIONS: allowed or required (when required, write at least the stated number), only in 'mixed' or 'calculation' exams, and only when the SOURCE MATERIAL teaches something drawn on coordinate axes: linear functions, slope and intercepts, systems of equations, linear inequalities, parabolas, supply and demand, equilibrium and curve shifts, budget lines, cost or revenue lines, consumer/producer surplus, price ceilings and floors):
- Make about one in five questions 'graph' (at least one when the source qualifies). The student draws the answer on a grid (points, lines, segments, rays, parabolas, circles, areas, shaded regions, shifting a given line, labels) or types equations and coordinates.
- "graph": the grid and what is already drawn. "x" and "y": "min", "max", "step" (at most 20 steps per axis), "label" in the exam language (e.g. "Miktar (Q)", "Fiyat (P)") and "var" (the axis letter, e.g. "Q", "P"; default x and y). "given": objects already on the grid, e.g. the original demand line before a shift, in the element format below. The student sees them, so NEVER put in "given" a line or point the question asks the student to draw.
- "graph_answer": the elements the student must draw, ALWAYS written with x (horizontal) and y (vertical), even when the axes are called Q and P:
  {"kind": "point", "at": [x, y] | {"intersect": ["g0", "a1"]} | {"on": "a0", "x": 0}, "label": "E"}
  {"kind": "line", "equation": "y = -2*x + 10"} (also for horizontal "y = 4" and vertical "x = 3" lines); {"kind": "segment" | "ray", "points": [[x1, y1], [x2, y2]]} (a ray starts at the first point)
  {"kind": "line", "shift_of": "g0", "direction": "right" | "left" | "up" | "down"} when only the direction of a shift is determined; add "equation" when the new line is exactly determined
  {"kind": "parabola", "vertex": [h, k], "through": [x, y]}, {"kind": "circle", "center": [a, b], "through": [x, y]}
  {"kind": "polygon", "points": [vertex, vertex, ...]} for an area such as consumer surplus (vertices may use the intersect / on forms)
  {"kind": "fill", "inequalities": ["y <= -2*x + 10", "x >= 0"]} for a shaded region; also list its boundary lines, with "style": "dashed" for strict inequalities
  Any element may have "label" (e.g. "D2", "S", "E") the student must attach. "g0", "g1" are "given" objects by index; "a0", "a1" earlier graph_answer elements. Use "none" when nothing can be drawn (e.g. no solution).
- Code recomputes every coordinate (intersections, points on lines) and discards the question if the answer does not fall on grid intersections, so choose numbers that give whole-step answers. ALWAYS write an equilibrium or intersection point as {"intersect": [...]}, never as typed coordinates, and pick the equations (and shift sizes) so that the intersection lands exactly on the grid, e.g. demand P = 15 - 2Q with supply P = 3 + Q meet at (4; 7). "correct_answer": a short text such as "E(4; 6)"; "options": null. Ask only for what is drawn.

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
const KEY_FIELDS = ['correct_answer', 'accepted_answers', 'solution_steps', 'tolerance_percent', 'hint', 'explanation', 'option_rationales', 'rubric', 'source', 'variables', 'formula', 'template', 'common_errors', 'verified', 'step_kind', 'equation', 'unknown', 'graph_answer']
// Yalnızca sunucuda kullanılan alanlar: ne tarayıcıya ne anahtara yazılır.
const INTERNAL_FIELDS = ['source_terms', 'chart_ref']
const EXPLANATION_MAX_CHARS = 600
const RATIONALE_MAX_CHARS = 300
const RUBRIC_MIN_ITEMS = 2
const RUBRIC_MAX_ITEMS = 6

/** JSON dizelerindeki geçersiz kaçışları ("\l", "\s", "\c"…) çift ters
 *  eğik çizgiye çevirir; LaTeX komutu metinde kalır. */
function fixJsonEscapes(text: string): string {
  return String(text ?? '').replace(/\\(\\|["\/bfnrt]|u[0-9a-fA-F]{4})|\\/g, (m, ok) => ok ? m : '\\\\')
}

/** Modelin bozduğu LaTeX'i onarır (canlı test 26.10.2026: "$2x + y le 8$").
 *  - JSON kaçışına dönüşmüş komutlar: \f+"rac" (\frac), \t+"imes", \b+"eta"…
 *  - $…$ içinde ters eğik çizgisini kaybetmiş le/ge/leq/geq/neq/cdot/times/infty. */
function repairLatex(text: string): string {
  let t = String(text ?? '')
  t = t.replace(/\u000c(?=rac|box)/g, '\\f')
    .replace(/\t(?=imes|ext|heta|au\b|an\b|riangle|ilde)/g, '\\t')
    .replace(/\u0008(?=eta|ar\b|egin|ig|inom|oxed)/g, '\\b')
    .replace(/\r(?=ho\b|ight|angle|ceil|floor)/g, '\\r')
  return t.replace(/\$([^$\n]{1,300})\$/g, (_m, inner: string) => '$' + inner.replace(/(^|[^\\A-Za-z])(leq|geq|neq|le|ge|cdot|times|infty)(?![A-Za-z])/g, (_x, pre, cmd) => `${pre}\\${cmd}`) + '$')
}

/** Model yanıtını soru dizisine çevirir: {"questions":[...]}, düz dizi veya
 *  tek anahtarlı başka bir nesne kabul edilir. Ayrıştırılamazsa null. */
function parseQuestionArray(raw: string): unknown[] | null {
  const cleaned = String(raw || '').replace(/```json\s*|```/g, '').trim()
  if (!cleaned) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (_e) {
    // LaTeX'te "\le", "\sqrt" gibi geçersiz JSON kaçışları: ters eğik çizgi korunur.
    try { parsed = JSON.parse(fixJsonEscapes(cleaned)) } catch (_e2) { return null }
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
  // Canlı bulgu (30.10.2026): model formülü şablon yazımıyla verdi
  // ("({a}-{c})/({b}+{d})"); formül okunamayınca soru doğrulanmadan alınıyordu.
  f = f.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_m, k) => k)
  return f.replace(/[×·∙]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').trim()
}

/** Metindeki bir sayıdan doğrudan türeyen değerler: %6 → 0.06, 5 yıl → 60
 *  ay, 60 ay → 5 yıl, "2x - 7" → -7 (Faz 3c). Türeyen değişken gizli
 *  girdi sayılmaz ama şablonla yeniden üretilemez (şablon kapatılır). */
const DERIVED_FACTORS = [100, 0.01, 12, 1 / 12, -1]
// Değişken = metindeki sayı × k ise şablonda metindeki sayı değişken OP ile
// gösterilir: %4 → 0,04 için {rate*100}. exam-engine renderTemplate okur.
const TEMPLATE_DISPLAY_OPS = new Map<number, string>([[100, '/100'], [0.01, '*100'], [12, '/12'], [1 / 12, '*12'], [-1, '*-1']])

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

/** Faz 3c: metinde yazmasa da gizli girdi sayılmayan standart sabitler. */
const STANDARD_CONSTANTS = [12, 100, 360, 365, 52]

/** İfadede bu ad (değişken olarak) geçiyor mu. */
function referencesName(src: string, name: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9_])${name}(?![A-Za-z0-9_])`).test(src)
}

/** Değişken adını sayıyla değiştirir (fonksiyon çağrısı "ad(" dokunulmaz). */
function inlineName(src: string, name: string, value: number): string {
  return src.replace(new RegExp(`(^|[^A-Za-z0-9_])${name}(?![A-Za-z0-9_(])`, 'g'), (_m, pre) => `${pre}(${value})`)
}

/** Hesap sorusunu kodla doğrular ve düzeltir: correct_answer formülden,
 *  şablon ve tipik hatalar temizlenmiş. Başarısızsa nedeni. */
/** Soru metninde şablon yer tutucusu ({a}, {rate*100}). LaTeX süslü
 *  parantezi (\frac{a}{b}, x^{n}, \text{P}) sayılmaz. */
const CALC_PH = /(?<![\\\p{L}\p{N}}^_])\{([A-Za-z_][A-Za-z0-9_]*)(?:([*/])(-?\d+(?:\.\d+)?))?\}/gu
function fillCalcPlaceholders(text: string, vars: Record<string, number>, lang: string): string {
  return text.replace(CALC_PH, (m, k, op, num) => {
    if (!Object.prototype.hasOwnProperty.call(vars, k)) return m
    const n = Number(num)
    const shown = op && Number.isFinite(n) && n !== 0 ? (op === '*' ? vars[k] * n : vars[k] / n) : vars[k]
    return formatNumber(tidy(shown), lang)
  })
}

/** Canlı log (30.10.2026, ITB101): "Qs − Qd" sorusunda formül ve modelin
 *  son çözüm adımı −40 diyor, "correct_answer" alanı 30; doğru soru atıldı ve
 *  sınav eksik kaldı. Son adımdaki sayılardan biri formülün değeriyse ve
 *  modelin cevabı orada geçmiyorsa yanlış olan yalnızca cevap alanıdır. */
function stepsConfirmValue(steps: unknown, value: number, modelAnswer: number): boolean {
  const list = Array.isArray(steps) ? steps.map(s => String(s ?? '')).filter(s => s.trim()) : []
  if (!list.length || !Number.isFinite(value)) return false
  const nums = (list[list.length - 1].replace(/[−–]/g, '-').match(/-?\d+(?:[.,]\d+)*/g) || []).map(t => parseLooseNumber(t)).filter(x => Number.isFinite(x))
  const near = (x: number, y: number) => Math.abs(x - y) <= Math.max(1e-9, Math.abs(y) * 0.005)
  return nums.some(x => near(x, value)) && !nums.some(x => near(x, modelAnswer))
}

function verifyCalculation(q: Record<string, unknown>): { ok: boolean; reason?: string } {
  const vars = sanitizeVariables(q.variables)
  let formula = normalizeFormula(q.formula)
  if (Object.keys(vars).length === 0 || !formula) return { ok: false, reason: 'calc_no_formula' }
  const value = evaluateExpression(formula, vars)
  if (!Number.isFinite(value)) return { ok: false, reason: 'calc_formula_invalid' }
  // Faz 3c: formülde (ya da doğrusal denklemde) geçmeyen değişken atılır;
  // model bazen kullanmadığı hücreleri de yazıyor (A1, A2…).
  const equationSrc = String(q.equation ?? '')
  for (const n of Object.keys(vars)) {
    if (!referencesName(formula, n) && !referencesName(equationSrc, n)) delete vars[n]
  }
  // Her değişken soru metninde yazılı olmalı ya da yazılı bir sayıdan
  // doğrudan türemeli (gizli girdi yok).
  const text = String(q.question ?? '')
  // Faz 4a: grafikli soruda grafiğin sayıları ve etiketleri de "yazılı" sayılır.
  const chartText = q.chart && typeof q.chart === 'object' ? ((q.chart as ChartSpec).labels || []).join(' ') : ''
  const readings = [...`${text} ${chartText}`.matchAll(/\d[\d.,]*/g)].flatMap(m => numberReadings(m[0].replace(/[.,]+$/, ''))).concat(chartNumbers(q.chart))
  const literal = (n: string) => readings.some(r => sameNumber(r, vars[n]))
  const derived = (n: string) => readings.some(r => DERIVED_FACTORS.some(k => sameNumber(r * k, vars[n])))
  // Faz 3c: metinde yazmayan standart sabit (12 ay, 100, 360/365 gün, 52
  // hafta) gizli girdi değildir: formüle sayı olarak gömülür, değişken
  // olmaktan çıkar (böylece "farklı sayılarla" şablonu da korunur).
  const inlined: Record<string, number> = {}
  for (const n of Object.keys(vars)) {
    if (!literal(n) && STANDARD_CONSTANTS.includes(vars[n]) && !referencesName(equationSrc, n)) {
      inlined[n] = vars[n]
      formula = inlineName(formula, n, vars[n])
      delete vars[n]
    }
  }
  const names = Object.keys(vars)
  if (names.some(n => !literal(n) && !derived(n))) return { ok: false, reason: 'calc_var_not_in_text' }
  const allLiteral = names.every(literal)
  const tol = Number(q.tolerance_percent) || 2
  const modelAnswer = answerNumber(q.correct_answer)
  if (Number.isFinite(modelAnswer) && !withinTolerance(modelAnswer, value, Math.max(tol, 1))) {
    if (!stepsConfirmValue(q.solution_steps, value, modelAnswer)) return { ok: false, reason: 'calc_mismatch' }
    console.warn(`generate-exam: calc_mismatch kurtarildi: cevap ${modelAnswer} -> ${value} (formul ve son cozum adimi ayni)`)
  }
  q.correct_answer = Math.round(value * 1e4) / 1e4
  q.variables = vars
  q.formula = formula
  // Türetilmiş değer (metinde %4, değişken 0,04): şablonda gösterim çarpanıyla
  // yazılır ({rate*100}); "farklı sayılarla" alıştırması artık kapanmaz.
  const displayOp = (n: string): string => {
    if (literal(n)) return ''
    for (const r of readings) for (const k of DERIVED_FACTORS) if (sameNumber(r * k, vars[n])) return TEMPLATE_DISPLAY_OPS.get(k) ?? ''
    return ''
  }
  q.template = !q.chart && typeof q.template === 'string' && templateMatches(q.template, text, names)
    ? (allLiteral ? q.template : (names.every(n => literal(n) || displayOp(n)) ? (q.template as string).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, n) => names.includes(n) ? `{${n}${displayOp(n)}}` : m) : null))
    : null
  const errs: Array<{ formula: string; message: string }> = []
  for (const ce of Array.isArray(q.common_errors) ? q.common_errors : []) {
    if (!ce || typeof ce !== 'object') continue
    const rec = ce as Record<string, unknown>
    let f = normalizeFormula(rec.formula)
    for (const [n, v] of Object.entries(inlined)) f = inlineName(f, n, v)
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
/** FAZ 3c: sayı hassasiyeti. Bazı derslerde virgülden sonraki basamaklar
 *  cevabın doğruluğu için şart: hesap cevabı yüzde payla değil, doğru
 *  cevaptan en çok yarım son basamak sapmayla kabul edilir (3 basamakta
 *  ±0,0005). null = standart (yüzde pay). exams.scoring.decimal_places. */
const ALLOWED_DECIMAL_PLACES = [2, 3, 4]
function normalizeDecimalPlaces(value: unknown): number | null {
  const n = Number(value)
  return ALLOWED_DECIMAL_PLACES.includes(n) ? n : null
}

function normalizeScoring(optionCount: unknown, negativeMarking: unknown): { option_count: number; negative_marking: boolean; wrong_per_correct: number } {
  const oc = ALLOWED_OPTION_COUNTS.includes(Number(optionCount)) ? Number(optionCount) : 4
  const defaultRatio = oc === 5 ? 4 : 3
  let enabled = false, ratio = defaultRatio
  if (negativeMarking === true) enabled = true
  else if (ALLOWED_WRONG_PER_CORRECT.includes(Number(negativeMarking))) { enabled = true; ratio = Number(negativeMarking) }
  return { option_count: oc, negative_marking: enabled, wrong_per_correct: ratio }
}

/** Sınav türüne göre kabul edilen soru tipleri. FAZ 4b: çizim sorusu
 *  karışık ve hesaplama sınavında; öğrenci "grafik sorusu olmasın" dediyse yok. */
function allowedTypesFor(examType: string, isQuant: boolean, graphs = false): string[] {
  if (examType === 'classic') return ['open_ended']
  if (examType === 'test') return ['multiple_choice']
  if (examType === 'calculation') return graphs ? ['calculation', 'expression', 'graph'] : ['calculation', 'expression']
  const mixed = ['open_ended', 'multiple_choice', 'true_false', 'fill_blank']
  const out = isQuant ? [...mixed, 'calculation'] : mixed
  return graphs ? [...out, 'graph'] : out
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

// ==========================================================================
// FAZ 4a — GRAFİK OKUMA (23.10.2026)
//
// Grafikler yalnızca kaynaktan gelir: kartın doğrulanmış "charts" verisi
// (summarize-document sanitizeCharts) ve sayısal sütunlu "tables". Model
// sayı kopyalamaz; soruya "chart_ref" (grafik numarası) yazar, grafiği
// sunucu ekler. Böylece grafikteki her sayı belgede yazan sayıdır.
// ==========================================================================
const CHART_MAX_SOURCES = 6
const CHART_MAX_POINTS = 24
const CHART_MAX_SERIES = 3
/** Grafik metni: sayı ya da kısa etiket de kabul ("Q1", 2021); boşluklar
 *  sadeleşir, uzunsa kırpılır. */
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

/** Tablo hücresi → sayı. "900.000" gibi tek noktalı ve noktadan sonra
 *  tam üç rakamlı yazım (0 ile başlamıyorsa) binlik ayraç sayılır — Türkçe
 *  belgelerde olağan olan bu; "0.125" ondalık kalır. */
function tableNumber(v: unknown): number {
  const raw = String(v ?? '').replace(/[%₺$€£]|TL/gi, '').replace(/\s+/g, '').trim()
  if (/^[-+]?[1-9]\d{0,2}\.\d{3}$/.test(raw)) return Number(raw.replace('.', ''))
  return parseLooseNumber(raw)
}

/** Tablo → grafik(ler): etiket sütunu ilk sayısal olmayan sütun (hepsi
 *  sayıysa — yıl gibi — ilk sütun); tüm hücreleri sayı olan sütunlar seri.
 *  Ölçeği 10 kattan fazla farklı sütunlar (TL ile %) ayrı grafiğe ayrılır;
 *  her grafikte en çok 3 seri. Etiketler yıl/çeyrekse çizgi, değilse sütun. */
function tableToCharts(table: unknown): ChartSpec[] {
  if (!table || typeof table !== 'object') return []
  const t = table as Record<string, unknown>
  const headers = (Array.isArray(t.headers) ? t.headers : []).map(h => chartLabel(h, 40))
  const rows = (Array.isArray(t.rows) ? t.rows : []).filter(Array.isArray) as unknown[][]
  if (rows.length < 2 || rows.length > CHART_MAX_POINTS || headers.length < 2) return []
  const num = (v: unknown) => tableNumber(v)
  const numericCols = headers.map((_, j) => j).filter(j => rows.every(row => String(row[j] ?? '').trim() !== '' && Number.isFinite(num(row[j]))))
  // Etiket: ilk sayısal olmayan sütun; hepsi sayıysa (yıl gibi) ilk sütun.
  const firstText = headers.findIndex((_, j) => !numericCols.includes(j))
  const labelCol = firstText >= 0 ? firstText : 0
  const cols = numericCols.filter(j => j !== labelCol)
  if (!cols.length) return []
  const labels = rows.map(row => chartLabel(row[labelCol], 30))
  const timeLike = labels.every(l => /^(1[89]|20)\d{2}\b|^Q[1-4]\b|^[1-4]\.\s*çeyrek/i.test(l))
  const peak = (j: number) => Math.max(...rows.map(row => Math.abs(num(row[j])))) || 1
  const groups: number[][] = []
  for (const j of cols) {
    const g = groups.find(gr => gr.length < CHART_MAX_SERIES && Math.max(peak(gr[0]), peak(j)) / Math.min(peak(gr[0]), peak(j)) <= 10)
    if (g) g.push(j); else groups.push([j])
  }
  const out: ChartSpec[] = []
  for (const g of groups) {
    const percent = g.every(j => rows.every(row => /%/.test(String(row[j] ?? ''))))
    const title = chartLabel(t.title, 80)
    const spec = normalizeChartSpec({
      title: groups.length > 1 || !title ? `${title ? title + ' — ' : ''}${g.map(j => headers[j]).join(', ')}`.slice(0, 80) : title,
      type: timeLike ? 'line' : 'bar',
      labels,
      series: g.map(j => ({ name: headers[j], data: rows.map(row => num(row[j])) })),
      unit: percent ? '%' : ''
    })
    if (spec) out.push(spec)
  }
  return out
}

/** Kartın (ya da ortak kartların) grafik ve tablolarından en çok 6 grafik. */
function buildChartSources(charts: unknown, tables: unknown): ChartSpec[] {
  const out: ChartSpec[] = []
  for (const c of Array.isArray(charts) ? charts : []) { const n = normalizeChartSpec(c); if (n) out.push(n) }
  for (const t of Array.isArray(tables) ? tables : []) out.push(...tableToCharts(t))
  return out.slice(0, CHART_MAX_SOURCES)
}

/** Modele grafiklerin metin tarifi (numaralı). */
function describeCharts(charts: ChartSpec[]): string {
  return charts.map((c, i) => `[${i + 1}] "${c.title}" (${c.type})${c.unit ? ` unit ${c.unit}` : ''}\n` +
    c.series.map(sr => `  ${sr.name || 'values'}: ` + c.labels.map((l, k) => `${l}=${sr.data[k]}`).join(', ')).join('\n')).join('\n')
}

/** Ham soruya chart_ref'e göre grafiği ekler (kopya); geçersizse grafik
 *  yok. Model yazdıysa kendi "chart" alanı her zaman atılır. */
function attachChart(raw: unknown, sources: ChartSpec[]): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const q = { ...(raw as Record<string, unknown>) }
  const ref = Number(q.chart_ref)
  delete q.chart
  delete q.chart_ref
  if (Number.isInteger(ref) && ref >= 1 && ref <= sources.length) q.chart = sources[ref - 1]
  return q
}

/** Grafikteki sayılar: hesap doğrulamasında "metinde yazan" sayılırlar. */
function chartNumbers(chart: unknown): number[] {
  const c = chart && typeof chart === 'object' ? chart as ChartSpec : null
  if (!c || !Array.isArray(c.series)) return []
  return c.series.flatMap(sr => Array.isArray(sr.data) ? sr.data.filter(Number.isFinite) : [])
}

// ==========================================================================
// FAZ 4c — DOSYADAKİ GRAFİK SORULARINA GÖRE SINAV: yorum motoru (23.10.2026)
//
// Yüklenen dosyadaki her grafik için tarama (extract-chart-items) grafiğin
// YAPISINI (tür, kategoriler, seriler, birim, ölçek) ve örnek sorunun
// BİÇİMİNİ ("hangisi söylenebilir", öncüllü, D/Y, değer, yorum, boşluk) ile
// sorduğu becerileri saklar. Burada:
//   1. chartVariant: aynı yapıda, yeni değerli benzer grafik (yapay zekâ yok)
//   2. iddialar (claims): yorum ifadelerini KOD üretir ve yeni veriye göre
//      doğruluğunu KOD belirler — cevap anahtarı her zaman doğru
//   3. buildChartQuestion: örnekle aynı biçimde yeni soru
// Türkçe ekler (2021'den, Ege'ye, %15'ten) ünlü uyumuyla yazılır.
// ==========================================================================
type ChartExample = { stem: string; format: string; skills: string[]; options_count?: number }
type ChartClaim = { kind: string; s: number; s2?: number; a?: number; b?: number; v?: number; n?: number }

const CHART_FORMATS = ['which_true', 'which_false', 'premises', 'true_false', 'value', 'open', 'fill']
const CHART_SKILLS = ['trend', 'extreme', 'compare', 'change', 'share', 'average', 'rank', 'gap']

/** Tohumlu rastgele sayı (aynı sınav kimliği → aynı soru, test edilebilir). */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  let a = h >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --------------------------------------------------------------------------
// Türkçe ekler
// --------------------------------------------------------------------------
const TR_DIGIT_WORD = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz']
const TR_TEN_WORD = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan']
const TR_LETTER_NAME: Record<string, string> = { a: 'a', b: 'be', c: 'ce', ç: 'çe', d: 'de', e: 'e', f: 'fe', g: 'ge', ğ: 'yumuşak ge', h: 'he', ı: 'ı', i: 'i', j: 'je', k: 'ke', l: 'le', m: 'me', n: 'ne', o: 'o', ö: 'ö', p: 'pe', r: 're', s: 'se', ş: 'şe', t: 'te', u: 'u', ü: 'ü', v: 've', y: 'ye', z: 'ze', q: 'kü', w: 've', x: 'iks' }

/** Bir sayının (ya da sayıyla biten etiketin) okunuşundaki son kelime. */
function trSpokenTail(word: string): string {
  const w = String(word).trim()
  const num = w.match(/(\d[\d.,]*)\s*%?$/)
  if (num) {
    const raw = num[1].replace(/[.,]+$/, '')
    const dec = raw.match(/[.,](\d+)$/)
    if (dec && !/^\d{1,3}([.,]\d{3})+$/.test(raw)) return trSpokenTail(dec[1].replace(/0+$/, '') || '0')
    const digits = raw.replace(/[.,]/g, '')
    const n = Number(digits)
    if (!Number.isFinite(n)) return w
    if (n === 0) return 'sıfır'
    if (n % 1e9 === 0) return 'milyar'
    if (n % 1e6 === 0) return 'milyon'
    if (n % 1000 === 0) return 'bin'
    const r = n % 1000
    if (r % 100 === 0) return 'yüz'
    if (r % 10 === 0) return TR_TEN_WORD[(r % 100) / 10]
    return TR_DIGIT_WORD[r % 10]
  }
  const last = w.split(/\s+/).pop() || w
  // Kısaltma (ABD, TÜİK): son harfin adı okunur.
  if (/^[A-ZÇĞİÖŞÜ]{2,5}$/.test(last)) return TR_LETTER_NAME[last.slice(-1).toLocaleLowerCase('tr-TR')] || last
  return last.toLocaleLowerCase('tr-TR')
}

/** Kesme işaretiyle durum eki: abl (-dan/-den/-tan/-ten), loc (-da/-de/
 *  -ta/-te), dat (-a/-e/-ya/-ye). Grafik etiketleri özel ad gibi yazılır. */
function trSuffix(word: string, kase: 'abl' | 'loc' | 'dat', proper = true): string {
  // Küçük harfle başlayan son kelime cins isimdir ("2. çeyrek"): kesme yok,
  // ünlüyle başlayan ekte k → ğ ("2. çeyreğe"). Canlı test, 24.10.2026.
  const common = !proper || /(^|\s)[a-zçğıöşü][^\s]*$/.test(String(word).trim())
  if (common && kase === 'dat' && /[aıoueiöü]k$/.test(word) && (String(word).split(/\s+/).pop()!.match(/[aıoueiöü]/g) || []).length >= 2) word = word.slice(0, -1) + 'ğ'
  proper = !common
  const tail = trSpokenTail(word)
  const vowels = tail.match(/[aıoueiöü]/g) || ['e']
  const back = /[aıou]/.test(vowels[vowels.length - 1])
  const endsVowel = /[aıoueiöü]$/.test(tail)
  const hard = /[çfhkpsşt]$/.test(tail)
  let suf: string
  if (kase === 'dat') suf = (endsVowel ? 'y' : '') + (back ? 'a' : 'e')
  else suf = (hard ? 't' : 'd') + (back ? 'a' : 'e') + (kase === 'abl' ? 'n' : '')
  return proper ? `${word}'${suf}` : `${word}${suf}`
}

// --------------------------------------------------------------------------
// Benzer grafik
// --------------------------------------------------------------------------
function decimalsIn(n: number): number {
  const s = String(n)
  if (/e/i.test(s)) return 2
  const i = s.indexOf('.')
  return i < 0 ? 0 : Math.min(2, s.length - i - 1)
}

/** Aynı yapıda yeni değerler: her değer %78–%122 arası değişir (grafik
 *  özgününe benzer kalır); özgün
 *  değerlerin basamak sayısı ve "yuvarlaklığı" korunur; işaret korunur;
 *  bir serideki değerler birbirinden farklı (en yüksek/en düşük belirsiz
 *  kalmasın). Pasta ya da toplamı 100 olan yüzde serisi yine 100'e tamamlanır. */
function chartVariant(chart: ChartSpec, rand: () => number): ChartSpec | null {
  if (!chart || !Array.isArray(chart.series) || !chart.series.length) return null
  const sig = (v: number) => Math.max(2, String(Math.abs(v)).replace(/e.*$/i, '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '').length)
  for (let attempt = 0; attempt < 30; attempt++) {
    const series = chart.series.map(sr => {
      const d = Math.max(0, ...sr.data.map(decimalsIn))
      const f = Math.pow(10, d)
      return { name: sr.name, data: sr.data.map(v => {
        if (v === 0) return Math.round((rand() * 0.3) * f * (Math.max(...sr.data.map(Math.abs)) || 1)) / f
        let nv = Number((v * (0.78 + rand() * 0.44)).toPrecision(Math.min(sig(v), 3)))
        nv = Math.round(nv * f) / f
        return nv === 0 ? Math.sign(v) / f : nv
      }) }
    })
    const sums100 = chart.series.length === 1 && Math.abs(chart.series[0].data.reduce((a, b) => a + b, 0) - 100) <= 2 && chart.series[0].data.every(v => v >= 0)
    if (chart.type === 'pie' || sums100) {
      const sr = series[0], tot = sr.data.reduce((a, b) => a + Math.max(0, b), 0) || 1
      const d = Math.max(0, ...chart.series[0].data.map(decimalsIn)), f = Math.pow(10, d)
      if (sums100) {
        sr.data = sr.data.map(v => Math.round(Math.max(0, v) / tot * 100 * f) / f)
        const diff = Math.round((100 - sr.data.reduce((a, b) => a + b, 0)) * f) / f
        const k = sr.data.indexOf(Math.max(...sr.data)); sr.data[k] = Math.round((sr.data[k] + diff) * f) / f
      }
    }
    if (chart.unit === '%' && !sums100) series.forEach(sr => { sr.data = sr.data.map(v => Math.min(100, v)) })
    const distinct = series.every(sr => new Set(sr.data).size === sr.data.length && sr.data.every(Number.isFinite))
    const changed = series.some((sr, k) => sr.data.some((v, i) => v !== chart.series[k].data[i]))
    // Çok serili grafikte seriler aynı noktada aynı sırada kalır (satış
    // maliyetin üstündeyse yeni grafikte de): yeni kesişme uydurulmaz. Son
    // denemelerde bu şart gevşer, soru düşmesin.
    const orderKept = attempt >= 24 || series.every((sr, k) => series.every((sr2, k2) => k2 <= k || sr.data.every((v, i) => Math.sign(v - sr2.data[i]) === Math.sign(chart.series[k].data[i] - chart.series[k2].data[i]))))
    if (distinct && changed && orderKept) return { ...chart, series }
  }
  return null
}

// --------------------------------------------------------------------------
// İddialar
// --------------------------------------------------------------------------
const pctChange = (from: number, to: number) => from === 0 ? NaN : (to - from) / Math.abs(from) * 100

function claimTruth(c: ChartClaim, chart: ChartSpec): boolean | null {
  const sr = chart.series[c.s]
  if (!sr) return null
  const d = sr.data
  const at = (i: number | undefined) => (i == null ? NaN : d[i])
  switch (c.kind) {
    case 'rise': return at(c.b) > at(c.a)
    case 'fall': return at(c.b) < at(c.a)
    case 'steady_rise': { for (let i = c.a!; i < c.b!; i++) if (!(d[i + 1] > d[i])) return false; return true }
    case 'steady_fall': { for (let i = c.a!; i < c.b!; i++) if (!(d[i + 1] < d[i])) return false; return true }
    case 'max': return d.every((v, i) => i === c.a || v < d[c.a!])
    case 'min': return d.every((v, i) => i === c.a || v > d[c.a!])
    case 'greater': return at(c.a) > at(c.b)
    case 'inc_gt': { const p = pctChange(at(c.a), at(c.b)); return p > c.v! }
    case 'inc_lt': { const p = pctChange(at(c.a), at(c.b)); return p > 0 && p < c.v! }
    case 'dec_gt': { const p = pctChange(at(c.a), at(c.b)); return -p > c.v! }
    case 'share_gt': { const t = d.reduce((x, y) => x + y, 0); return t > 0 && at(c.a) / t * 100 > c.v! }
    case 'share_lt': { const t = d.reduce((x, y) => x + y, 0); return t > 0 && at(c.a) / t * 100 < c.v! }
    case 'avg_gt': return d.reduce((x, y) => x + y, 0) / d.length > c.v!
    case 'avg_lt': return d.reduce((x, y) => x + y, 0) / d.length < c.v!
    case 'rank': { const sorted = [...d].sort((x, y) => y - x); return sorted[c.n! - 1] === at(c.a) && sorted.filter(x => x === at(c.a)).length === 1 }
    case 'above': { const o = chart.series[c.s2!]; return !!o && at(c.a) > o.data[c.a!] }
    case 'gap_widen': { const o = chart.series[c.s2!]; return !!o && Math.abs(d[c.b!] - o.data[c.b!]) > Math.abs(d[c.a!] - o.data[c.a!]) }
    default: return null
  }
}

/** Adsız tek serinin cümledeki adı grafik başlığından: "Yıllara göre
 *  ihracat" → "ihracat", "2024 yılı çeyreklik satış adedi" → "satış adedi",
 *  "Bölgelere göre pazar payı (%)" → "pazar payı". Çıkmazsa boş. Grafikte
 *  gösterge yokken model seri adı vermiyor (canlı test, 24.10.2026). */
function titleSubject(title: string, lang: string): string {
  let t = String(title || '').replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (lang === 'en') t = t.replace(/\s+(by|per|across|over)\s+.*$/i, '').replace(/^(annual|monthly|quarterly|yearly)\s+/i, '')
  else {
    const g = t.toLocaleLowerCase('tr-TR').lastIndexOf('göre ')
    if (g >= 0) t = t.slice(g + 5)
    t = t.replace(/^\d{4}(\s*[-–]\s*\d{4})?\s+(yılı(nda)?|yıllarında|döneminde|dönemi)\s+/i, '')
      .replace(/^bir\s+\S+(nın|nin|nun|nün|ın|in|un|ün)\s+/i, '')
      .replace(/^(yıllık|aylık|çeyreklik|haftalık|günlük|dönemlik)\s+/i, '')
  }
  t = t.trim()
  if (!t || t.length > 32 || t.split(/\s+/).length > 4 || /\d/.test(t) || /\s(ve|and)\s/i.test(t)) return ''
  return t
}

/** Seri adı (cümle içinde): adsız seride başlıktan, o da yoksa "değer".
 *  Türkçede cins isim olduğu için ilk harf küçülür (kısaltma — GSYH — korunur). */
function seriesWord(chart: ChartSpec, s: number, lang: string): string {
  // "İhracat (milyar $)" → "ihracat": birim grafikte yazılı, cümlede ağır.
  const n = (chart.series[s] && String(chart.series[s].name || '').replace(/\s*\([^)]*\)\s*$/, '').trim()) || (chart.series.length === 1 ? titleSubject(chart.title, lang) : '')
  if (!n) return lang === 'en' ? 'the value' : 'değer'
  if (lang === 'en' || /^[A-ZÇĞİÖŞÜ0-9]{2}/.test(n)) return n
  return n.charAt(0).toLocaleLowerCase('tr-TR') + n.slice(1)
}

function fmtPct(v: number, lang: string): string {
  if (v < 0 && lang !== 'en') return '-' + fmtPct(-v, lang)
  const t = Number(v).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 1 })
  return lang === 'en' ? `${t}%` : `%${t}`
}

function fmtNum(v: number, chart: ChartSpec, lang: string): string {
  const t = Number(v).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 2 })
  return chart.unit === '%' ? (lang === 'en' ? `${t}%` : `%${t}`) : t
}

/** İddianın metni (Türkçe ekli). */
function claimText(c: ChartClaim, chart: ChartSpec, lang: string): string {
  const L = chart.labels, S = seriesWord(chart, c.s, lang), S2 = c.s2 != null ? seriesWord(chart, c.s2, lang) : ''
  const A = c.a != null ? L[c.a] : '', B = c.b != null ? L[c.b] : ''
  if (lang === 'en') {
    switch (c.kind) {
      case 'rise': return `From ${A} to ${B}, ${S} increased.`
      case 'fall': return `From ${A} to ${B}, ${S} decreased.`
      case 'steady_rise': return `${S} rose continuously from ${A} to ${B}.`
      case 'steady_fall': return `${S} fell continuously from ${A} to ${B}.`
      case 'max': return `${S} is highest in ${A}.`
      case 'min': return `${S} is lowest in ${A}.`
      case 'greater': return `${S} in ${A} is higher than in ${B}.`
      case 'inc_gt': return `From ${A} to ${B}, ${S} increased by more than ${fmtPct(c.v!, lang)}.`
      case 'inc_lt': return `From ${A} to ${B}, ${S} increased, but by less than ${fmtPct(c.v!, lang)}.`
      case 'dec_gt': return `From ${A} to ${B}, ${S} decreased by more than ${fmtPct(c.v!, lang)}.`
      case 'share_gt': return `${A} accounts for more than ${fmtPct(c.v!, lang)} of the total.`
      case 'share_lt': return `${A} accounts for less than ${fmtPct(c.v!, lang)} of the total.`
      case 'avg_gt': return `The average ${S} is above ${fmtNum(c.v!, chart, lang)}.`
      case 'avg_lt': return `The average ${S} is below ${fmtNum(c.v!, chart, lang)}.`
      case 'rank': return `${A} has the ${c.n === 2 ? 'second' : c.n === 3 ? 'third' : c.n + 'th'} highest ${S}.`
      case 'above': return `In ${A}, ${S} is higher than ${S2}.`
      case 'gap_widen': return `The gap between ${S} and ${S2} widened from ${A} to ${B}.`
    }
    return ''
  }
  const Sc = S.charAt(0).toLocaleUpperCase('tr-TR') + S.slice(1)
  switch (c.kind) {
    case 'rise': return `${trSuffix(A, 'abl')} ${trSuffix(B, 'dat')} ${S} artmıştır.`
    case 'fall': return `${trSuffix(A, 'abl')} ${trSuffix(B, 'dat')} ${S} azalmıştır.`
    case 'steady_rise': return `${A}–${B} döneminde ${S} sürekli artmıştır.`
    case 'steady_fall': return `${A}–${B} döneminde ${S} sürekli azalmıştır.`
    case 'max': return `En yüksek ${S} ${trSuffix(A, 'loc')}dır.`.replace(/(d|t)(a|e)dır\.$/, (_m, t, v) => `${t}${v}${v === 'a' ? 'dır' : 'dir'}.`)
    case 'min': return `En düşük ${S} ${trSuffix(A, 'loc')}dır.`.replace(/(d|t)(a|e)dır\.$/, (_m, t, v) => `${t}${v}${v === 'a' ? 'dır' : 'dir'}.`)
    case 'greater': return `${Sc} bakımından ${A}, ${trSuffix(B, 'abl')} yüksektir.`
    case 'inc_gt': return `${trSuffix(A, 'abl')} ${trSuffix(B, 'dat')} ${S} ${trSuffix(fmtPct(c.v!, lang), 'abl')} fazla artmıştır.`
    case 'inc_lt': return `${trSuffix(A, 'abl')} ${trSuffix(B, 'dat')} ${S} artmış, ancak artış ${trSuffix(fmtPct(c.v!, lang), 'abl')} azdır.`
    case 'dec_gt': return `${trSuffix(A, 'abl')} ${trSuffix(B, 'dat')} ${S} ${trSuffix(fmtPct(c.v!, lang), 'abl')} fazla azalmıştır.`
    case 'share_gt': return `${A}, toplamın ${trSuffix(fmtPct(c.v!, lang), 'abl')} fazlasını oluşturur.`
    case 'share_lt': return `${A}, toplamın ${trSuffix(fmtPct(c.v!, lang), 'abl')} azını oluşturur.`
    case 'avg_gt': return `${Sc} ortalaması ${trSuffix(fmtNum(c.v!, chart, lang), 'abl')} yüksektir.`
    case 'avg_lt': return `${Sc} ortalaması ${trSuffix(fmtNum(c.v!, chart, lang), 'abl')} düşüktür.`
    case 'rank': return `${Sc} bakımından ${A}, en yüksek ${c.n}. sıradadır.`
    case 'above': return `${trSuffix(A, 'loc')} ${S}, ${trSuffix(S2, 'abl', /^[A-ZÇĞİÖŞÜ0-9]{2}/.test(S2))} yüksektir.`
    case 'gap_widen': return `${A}–${B} döneminde ${S} ile ${S2} arasındaki fark açılmıştır.`
  }
  return ''
}

/** İddianın kanıtı (gerekçe metni): ilgili değerler. */
function claimEvidence(c: ChartClaim, chart: ChartSpec, lang: string): string {
  const L = chart.labels, d = chart.series[c.s].data, tr = lang !== 'en'
  const val = (i: number) => `${L[i]}: ${fmtNum(d[i], chart, lang)}`
  switch (c.kind) {
    case 'rise': case 'fall': case 'greater': return `${val(c.a!)}, ${val(c.b!)}`
    case 'steady_rise': case 'steady_fall': { const out: string[] = []; for (let i = c.a!; i <= c.b!; i++) out.push(val(i)); return out.join(', ') }
    case 'max': case 'min': case 'rank': return [...d.keys()].map(val).join(', ')
    case 'inc_gt': case 'inc_lt': case 'dec_gt': { const p = pctChange(d[c.a!], d[c.b!]); return `${val(c.a!)}, ${val(c.b!)}; ${tr ? 'değişim' : 'change'} ${fmtPct(Math.round(p * 10) / 10, lang)}` }
    case 'share_gt': case 'share_lt': { const t = d.reduce((x, y) => x + y, 0); return `${val(c.a!)}; ${tr ? 'pay' : 'share'} ${fmtPct(Math.round(d[c.a!] / t * 1000) / 10, lang)}` }
    case 'avg_gt': case 'avg_lt': return `${tr ? 'ortalama' : 'average'} ${fmtNum(Math.round(d.reduce((x, y) => x + y, 0) / d.length * 100) / 100, chart, lang)}`
    case 'above': case 'gap_widen': {
      const o = chart.series[c.s2!].data, idx = c.kind === 'above' ? [c.a!] : [c.a!, c.b!]
      return idx.map(i => `${L[i]}: ${fmtNum(d[i], chart, lang)} / ${fmtNum(o[i], chart, lang)}`).join('; ')
    }
  }
  return ''
}

/** Yüzde eşikleri: gerçek değerden en az 3 puan uzak, yuvarlak (5'in katı). */
function thresholdsAround(actual: number): { below: number | null; above: number } {
  const below = Math.floor((actual - 3) / 5) * 5
  return { below: below > 0 ? below : null, above: Math.ceil((actual + 3) / 5) * 5 }
}

/** Zaman ekseni mi: çizgi grafik ya da etiketler yıl / çeyrek / ay. Değişim
 *  ("artmıştır", "%15'ten fazla azalmıştır") yalnızca zamanda anlamlı. */
const TR_MONTHS = /^(oca|şub|mar|nis|may|haz|tem|ağu|eyl|eki|kas|ara|jan|feb|apr|jun|jul|aug|sep|oct|nov|dec)/i
function isTimeAxis(chart: ChartSpec): boolean {
  if (chart.type === 'pie') return false
  if (chart.type === 'line') return true
  return chart.labels.every(l => /^(1[89]|20)\d{2}\b|^Q[1-4]\b|^[1-4]\.\s*çeyrek|^[1-4]Ç\b/i.test(l) || TR_MONTHS.test(l))
}

/** Grafikten, istenen becerilerle iddia adayları (doğru ve yanlış). */
function claimCandidates(chart: ChartSpec, skills: string[], rand: () => number): ChartClaim[] {
  const out: ChartClaim[] = []
  const n = chart.labels.length, S = chart.series.length
  const want = (k: string) => !skills.length || skills.includes(k)
  const timeLike = isTimeAxis(chart)
  for (let s = 0; s < S; s++) {
    const d = chart.series[s].data
    if (want('extreme')) for (let a = 0; a < n; a++) { out.push({ kind: 'max', s, a }); out.push({ kind: 'min', s, a }) }
    if (want('compare') || want('trend') || want('change')) {
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
        if (timeLike) { out.push({ kind: 'rise', s, a, b }); out.push({ kind: 'fall', s, a, b }) }
        else { out.push({ kind: 'greater', s, a, b }); out.push({ kind: 'greater', s, a: b, b: a }) }
      }
    }
    if (want('trend') && timeLike) for (let a = 0; a + 2 < n; a++) for (let b = a + 2; b < n; b++) { out.push({ kind: 'steady_rise', s, a, b }); out.push({ kind: 'steady_fall', s, a, b }) }
    if (want('change') && timeLike) {
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
        const p = pctChange(d[a], d[b])
        if (!Number.isFinite(p)) continue
        const th = thresholdsAround(Math.abs(p))
        if (p > 0) { if (th.below) out.push({ kind: 'inc_gt', s, a, b, v: th.below }); out.push({ kind: 'inc_gt', s, a, b, v: th.above }); out.push({ kind: 'inc_lt', s, a, b, v: th.above }) }
        else { if (th.below) out.push({ kind: 'dec_gt', s, a, b, v: th.below }); out.push({ kind: 'dec_gt', s, a, b, v: th.above }); out.push({ kind: 'inc_gt', s, a, b, v: 5 }) }
      }
    }
    // Pay iddiası yalnızca bütünün parçaları olan grafikte (pasta ya da
    // kategori sütunu); yıllar gibi zaman serisinde "toplamın %20'si" anlamsız.
    // Değerleri zaten yüzde olan sütunlarda (pazar payı) "toplamın %25'i" yanıltıcı.
    if (want('share') && (chart.type === 'pie' || (S === 1 && !timeLike && chart.unit !== '%')) && d.every(v => v >= 0)) {
      const t = d.reduce((x, y) => x + y, 0)
      for (let a = 0; a < n; a++) { const sh = d[a] / t * 100; const th = thresholdsAround(sh); if (th.below) out.push({ kind: 'share_gt', s, a, v: th.below }); out.push({ kind: 'share_gt', s, a, v: th.above }); out.push({ kind: 'share_lt', s, a, v: th.above }) }
    }
    if (want('average')) {
      const avg = d.reduce((x, y) => x + y, 0) / n, mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.abs(avg) || 1)) - 1))
      const lo = Math.floor(avg * 0.9 / mag) * mag, hi = Math.ceil(avg * 1.1 / mag) * mag
      out.push({ kind: 'avg_gt', s, v: lo }, { kind: 'avg_gt', s, v: hi }, { kind: 'avg_lt', s, v: hi }, { kind: 'avg_lt', s, v: lo })
    }
    if (want('rank')) for (let a = 0; a < n; a++) for (const r of [2, 3]) if (r <= n) out.push({ kind: 'rank', s, a, n: r })
  }
  if (S > 1 && (want('gap') || want('compare'))) {
    for (let s = 0; s < S; s++) for (let s2 = 0; s2 < S; s2++) if (s !== s2) {
      for (let a = 0; a < n; a++) out.push({ kind: 'above', s, s2, a })
      if (s < s2) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) out.push({ kind: 'gap_widen', s, s2, a, b })
    }
  }
  // Karıştır (tohumlu)
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}

/** Doğruluk değeri belli k iddia. Aynı sette her konudan (seri + kategori
 *  ikilisi) en çok bir iddia: "%25'ten fazla" ile "%25'ten az" yan yana
 *  gelip cevabı ele vermesin. */
function claimSubject(c: ChartClaim): string {
  // Aynı iki dönem arasındaki değişim iddiaları tek konu: "artmıştır" ile
  // "artmış, ancak %15'ten az" aynı sette birbirini ele verir.
  const fam = ['rise', 'fall', 'inc_gt', 'inc_lt', 'dec_gt'].includes(c.kind) ? 'chg' : c.kind.slice(0, 3)
  return ['max', 'min', 'rank'].includes(c.kind) ? `x|${c.s}` : `${c.s}|${c.s2 ?? ''}|${Math.min(c.a ?? -1, c.b ?? -1)}|${Math.max(c.a ?? -1, c.b ?? -1)}|${fam}`
}

function pickClaims(cands: ChartClaim[], chart: ChartSpec, lang: string, truth: boolean, k: number, avoid: Set<string>): ChartClaim[] {
  const out: ChartClaim[] = []
  for (const c of cands) {
    if (out.length >= k) break
    if (claimTruth(c, chart) !== truth) continue
    const t = claimText(c, chart, lang), subj = 'subj:' + claimSubject(c)
    if (!t || avoid.has(t) || avoid.has(subj)) continue
    avoid.add(t); avoid.add(subj)
    out.push(c)
  }
  return out
}

const ROMAN = ['I', 'II', 'III']
const PREMISE_COMBOS: number[][] = [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]]
function comboLabel(combo: number[], lang: string): string {
  const r = combo.map(i => ROMAN[i])
  if (lang === 'en') return r.length === 1 ? `${r[0]} only` : r.length === 2 ? `${r[0]} and ${r[1]}` : 'I, II and III'
  return r.length === 1 ? `Yalnız ${r[0]}` : r.length === 2 ? `${r[0]} ve ${r[1]}` : 'I, II ve III'
}

/** Şıklı değer sorusu: doğru değer + tipik hatalardan çeldiriciler (yanlış
 *  taban, yalnızca fark; payda toplam yerine geri kalan; ortalamada
 *  n−1), gerekirse ±%25–%100 sapmalar. Hepsi aynı yuvarlamayla, birbirinden
 *  en az %8 uzak; küçükten büyüğe. Kurulamazsa null (hesap sorusu kalır). */
function valueOptions(value: number, formula: string, used: Record<string, number>, units: string, chart: ChartSpec, lang: string, k: number, rand: () => number = Math.random): { options: string[]; correct: string } | null {
  const v = (key: string) => used[key]
  const vals = Object.values(used)
  const alts: number[] = []
  let m = formula.match(/^\((d\d+) - (d\d+)\) \/ (d\d+) \* 100$/)
  if (m) { const x = v(m[1]), y = v(m[2]), z = v(m[3]), other = z === y ? x : y; alts.push((x - y) / other * 100, x - y) }
  m = formula.match(/^(d\d+) \/ \((.+)\) \* 100$/)
  if (m) { const a = v(m[1]), tot = vals.reduce((p, q) => p + q, 0); alts.push(a / (tot - a) * 100, a / Math.max(...vals) * 100) }
  m = formula.match(/^\((.+)\) \/ (\d+)$/)
  if (m) { const tot = vals.reduce((p, q) => p + q, 0), n = Number(m[2]), srt = [...vals].sort((p, q) => p - q); alts.push(tot / (n - 1), n % 2 ? srt[(n - 1) / 2] : (srt[n / 2 - 1] + srt[n / 2]) / 2) }
  m = formula.match(/^(d\d+) - (d\d+)$/)
  if (m) alts.push(v(m[1]) + v(m[2]))
  const pct = units === '%'
  const dec = pct ? (Math.abs(value) >= 20 ? 0 : 1) : Math.max(0, ...chart.series.flatMap(sr => sr.data.map(decimalsIn)))
  const f = Math.pow(10, dec)
  const round = (x: number) => Math.round(x * f) / f
  const fmt = (x: number) => { const t = x.toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); return pct ? (lang === 'en' ? `${t}%` : `%${t}`) : t }
  const correct = round(value)
  const gap = Math.max(Math.abs(correct) * 0.08, 1 / f)
  // Doğru şıkkın yeri rastgele: altında `below`, üstünde k−1−below çeldirici.
  // (Simetrik sapmalarla sıralanınca doğru şık hep ortada kalıyordu.)
  const below = Math.floor(rand() * k)
  const lowOk = correct > 0 ? (r: number) => r > 0 : () => true
  const pool = [...alts, ...[0.8, 0.65, 0.5, 0.35, 0.2].map(m => value * m), ...[1.2, 1.4, 1.6, 1.85, 2.1].map(m => value * m)]
  const chosen = [correct]
  let lo = 0, hi = 0
  for (const a of pool) {
    const r = round(a)
    if (!Number.isFinite(r) || !lowOk(r) || chosen.some(c => Math.abs(c - r) < gap)) continue
    const isLow = Math.abs(r) < Math.abs(correct)
    if (isLow ? lo >= below : hi >= k - 1 - below) continue
    chosen.push(r); if (isLow) lo++; else hi++
  }
  if (chosen.length < k) return null
  const labels = chosen.sort((p, q) => p - q).map(fmt)
  if (new Set(labels).size !== labels.length) return null
  return { options: labels, correct: fmt(correct) }
}

/** Örnekle aynı biçimde, benzer grafikte yeni soru. Kurulamazsa null. */
function buildChartQuestion(item: ChartExample, chart: ChartSpec, lang: string, rand: () => number, optionCount = 4): Record<string, unknown> | null {
  const format = CHART_FORMATS.includes(item.format) ? item.format : 'which_true'
  const skills = (item.skills || []).filter(s => CHART_SKILLS.includes(s))
  // Önce örneğin becerileri; ifade yetmezse öteki beceriler de eklenir.
  const cands = [...claimCandidates(chart, skills, rand), ...(skills.length ? claimCandidates(chart, [], rand) : [])]
  const tr = lang !== 'en'
  const genericStem = (f: string) => tr
    ? ({ which_true: 'Grafiğe göre aşağıdakilerden hangisi söylenebilir?', which_false: 'Grafiğe göre aşağıdakilerden hangisi söylenemez?', premises: 'Grafiğe göre aşağıdaki ifadelerden hangileri doğrudur?', true_false: 'Grafiğe göre aşağıdaki ifade doğru mudur?' } as Record<string, string>)[f]
    : ({ which_true: 'According to the chart, which of the following is true?', which_false: 'According to the chart, which of the following is NOT true?', premises: 'According to the chart, which of the statements are true?', true_false: 'According to the chart, is the following statement true?' } as Record<string, string>)[f]
  // Örneğin kökü sayı içermiyorsa ve biçimi aynıysa aynen kullanılır.
  const stem = (f: string) => {
    const ex = String(item.stem || '').trim()
    return ex && ex.length <= 200 && !/\d/.test(ex) && item.format === f ? ex : genericStem(f)
  }
  const base = { chart, concept: chart.title }
  const rationales = (opts: Array<{ text: string; c: ChartClaim }>) => {
    const out: Record<string, string> = {}
    for (const o of opts) out[o.text] = `${claimTruth(o.c, chart) ? (tr ? 'Doğru' : 'True') : (tr ? 'Yanlış' : 'False')}: ${claimEvidence(o.c, chart, lang)}.`
    return out
  }
  if (format === 'which_true' || format === 'which_false') {
    const k = Math.max(4, Math.min(5, item.options_count || optionCount))
    const truth = format === 'which_true'
    const avoid = new Set<string>()
    const odd = pickClaims(cands, chart, lang, truth, 1, avoid)
    const rest = pickClaims(cands, chart, lang, !truth, k - 1, avoid)
    if (odd.length !== 1 || rest.length !== k - 1) return null
    const opts = [...odd, ...rest].map(c => ({ text: claimText(c, chart, lang), c }))
    return { ...base, type: 'multiple_choice', question: stem(format), options: opts.map(o => o.text), correct_answer: opts[0].text,
      option_rationales: rationales(opts), explanation: `${opts[0].text} ${tr ? '— grafikte' : '— the chart shows'} ${claimEvidence(odd[0], chart, lang)}.` }
  }
  if (format === 'premises') {
    const k = Math.max(4, Math.min(5, item.options_count || optionCount))
    for (let attempt = 0; attempt < 12; attempt++) {
      const nTrue = 1 + Math.floor(rand() * 3)
      const avoid = new Set<string>()
      const t = pickClaims(cands.slice(attempt), chart, lang, true, nTrue, avoid)
      const f = pickClaims(cands.slice(attempt), chart, lang, false, 3 - nTrue, avoid)
      if (t.length !== nTrue || f.length !== 3 - nTrue) continue
      const prem = [...t, ...f]
      for (let i = prem.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [prem[i], prem[j]] = [prem[j], prem[i]] }
      const correct = prem.map((c, i) => claimTruth(c, chart) ? i : -1).filter(i => i >= 0)
      const correctLabel = comboLabel(correct, lang)
      const others = PREMISE_COMBOS.filter(cb => comboLabel(cb, lang) !== correctLabel)
      for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [others[i], others[j]] = [others[j], others[i]] }
      const rank = (cb: number[]) => PREMISE_COMBOS.findIndex(p => p.join() === cb.join())
      const opts = [correct, ...others.slice(0, k - 1)].sort((x, y) => rank(x) - rank(y)).map(cb => comboLabel(cb, lang))
      const lines = prem.map((c, i) => `${ROMAN[i]}. ${claimText(c, chart, lang)}`)
      const why = prem.map((c, i) => `${ROMAN[i]} ${claimTruth(c, chart) ? (tr ? 'doğru' : 'true') : (tr ? 'yanlış' : 'false')} (${claimEvidence(c, chart, lang)})`).join('; ')
      return { ...base, type: 'multiple_choice', question: `${stem('premises')}\n\n${lines.join('\n')}`, premises: lines, keep_order: true, options: opts, correct_answer: correctLabel, explanation: `${why}.` }
    }
    return null
  }
  if (format === 'true_false') {
    const truth = rand() < 0.5
    const c = pickClaims(cands, chart, lang, truth, 1, new Set())[0] || pickClaims(cands, chart, lang, !truth, 1, new Set())[0]
    if (!c) return null
    const t = claimTruth(c, chart)
    const pair = tr ? ['Doğru', 'Yanlış'] : ['True', 'False']
    return { ...base, type: 'true_false', question: `${stem('true_false')}\n\n“${claimText(c, chart, lang)}”`, options: pair, correct_answer: t ? pair[0] : pair[1], explanation: `${claimEvidence(c, chart, lang)}.` }
  }
  if (format === 'fill') {
    const s = Math.floor(rand() * chart.series.length), d = chart.series[s].data
    const hi = rand() < 0.5, idx = d.indexOf(hi ? Math.max(...d) : Math.min(...d))
    const S = seriesWord(chart, s, lang)
    return { ...base, type: 'fill_blank', question: tr ? `Grafiğe göre en ${hi ? 'yüksek' : 'düşük'} ${S} ______ görülmektedir.` : `According to the chart, the ${hi ? 'highest' : 'lowest'} ${S} is in ______.`,
      correct_answer: chart.labels[idx], accepted_answers: [], explanation: chart.labels.map((l, i) => `${l}: ${fmtNum(d[i], chart, lang)}`).join(', ') + '.' }
  }
  if (format === 'value') {
    const s = Math.floor(rand() * chart.series.length), d = chart.series[s].data, n = d.length
    const vars: Record<string, number> = {}
    d.forEach((v, i) => { vars[`d${i + 1}`] = v })
    const S = seriesWord(chart, s, lang)
    let pick = skills.find(k => ['change', 'share', 'average', 'compare'].includes(k)) || (chart.type === 'pie' ? 'share' : isTimeAxis(chart) ? 'change' : 'compare')
    if (pick === 'change' && !isTimeAxis(chart)) pick = 'compare'
    let question: string, formula: string, units = ''
    if (pick === 'share' && d.every(v => v >= 0)) {
      const a = Math.floor(rand() * n)
      formula = `d${a + 1} / (${d.map((_, i) => `d${i + 1}`).join(' + ')}) * 100`; units = '%'
      question = tr ? `Grafiğe göre ${chart.labels[a]} toplamın yüzde kaçını oluşturur?` : `According to the chart, what percentage of the total is ${chart.labels[a]}?`
    } else if (pick === 'average') {
      formula = `(${d.map((_, i) => `d${i + 1}`).join(' + ')}) / ${n}`; units = chart.unit
      question = tr ? `Grafiğe göre ${S} ortalaması kaçtır?` : `According to the chart, what is the average ${S}?`
    } else if (pick === 'compare') {
      const a = Math.floor(rand() * n); let b = Math.floor(rand() * (n - 1)); if (b >= a) b++
      formula = `d${a + 1} - d${b + 1}`; units = chart.unit
      question = tr ? `Grafiğe göre ${chart.labels[a]} ile ${chart.labels[b]} arasındaki ${S} farkı (${chart.labels[a]} − ${chart.labels[b]}) kaçtır?` : `According to the chart, what is ${S} in ${chart.labels[a]} minus ${S} in ${chart.labels[b]}?`
    } else {
      const a = Math.floor(rand() * (n - 1)), b = a + 1 + Math.floor(rand() * (n - 1 - a))
      // Artış mı azalış mı, soru söyler; cevap her zaman pozitif yüzde.
      const up = d[b] >= d[a]
      formula = up ? `(d${b + 1} - d${a + 1}) / d${a + 1} * 100` : `(d${a + 1} - d${b + 1}) / d${a + 1} * 100`; units = '%'
      question = tr ? `Grafiğe göre ${trSuffix(chart.labels[a], 'abl')} ${trSuffix(chart.labels[b], 'dat')} ${S} yüzde kaç ${up ? 'artmıştır' : 'azalmıştır'}?` : `According to the chart, by what percentage did ${S} ${up ? 'increase' : 'decrease'} from ${chart.labels[a]} to ${chart.labels[b]}?`
    }
    const used: Record<string, number> = {}
    for (const k of Object.keys(vars)) if (new RegExp(`\\b${k}\\b`).test(formula)) used[k] = vars[k]
    const value = evaluateExpression(formula, used)
    if (!Number.isFinite(value)) return null
    const steps = [`${tr ? 'Grafikten' : 'From the chart'}: ${Object.keys(used).map(k => `${chart.labels[Number(k.slice(1)) - 1]} = ${fmtNum(used[k], chart, lang)}`).join(', ')}`, `${formula.replace(/d(\d+)/g, (_m, i) => chart.labels[Number(i) - 1])}`]
    // Örnek şıklıysa (A–E) soru da şıklı: tipik hatalardan çeldiriciler,
    // şıklar küçükten büyüğe. Soru tipi örnekle aynı kalsın (canlı test).
    if ((item.options_count || 0) >= 2) {
      const mc = valueOptions(value, formula, used, units, chart, lang, Math.max(4, Math.min(5, item.options_count || optionCount)), rand)
      if (mc) return { ...base, type: 'multiple_choice', question, options: mc.options, correct_answer: mc.correct, keep_order: true,
        explanation: `${steps.join('; ')} = ${mc.correct}.` }
    }
    return { ...base, type: 'calculation', question, variables: used, formula, verified: true, correct_answer: Math.round(value * 1e4) / 1e4, tolerance_percent: 1, units,
      solution_steps: steps }
  }
  // open: yorum sorusu; rubrik doğru iddialardan.
  const avoid = new Set<string>()
  const t = pickClaims(cands, chart, lang, true, 4, avoid)
  if (t.length < 2) return null
  const pts = t.length === 4 ? [25, 25, 25, 25] : t.length === 3 ? [34, 33, 33] : [50, 50]
  const ex = String(item.stem || '').trim()
  const q = ex && ex.length <= 240 && !/\d{2,}/.test(ex) ? ex : (tr ? 'Grafiği yorumlayınız: değişimi, en yüksek ve en düşük değerleri ve dikkat çeken farkları açıklayınız.' : 'Interpret the chart: describe the change, the highest and lowest values and notable differences.')
  return { ...base, type: 'open_ended', question: q, correct_answer: t.map(c => claimText(c, chart, lang)).join(' '),
    rubric: t.map((c, i) => ({ criterion: (tr ? 'Şunu belirtir: ' : 'States that: ') + claimText(c, chart, lang), points: pts[i] })), explanation: t.map(c => claimText(c, chart, lang)).join(' ') }
}

/** Taranmış örneklerden sınav soruları (yapay zekâ yok): her öğe için
 *  benzer grafik + örnekle aynı biçimde soru; öğeler sırayla dönülür, her
 *  turda yeni değerler. Kaynak sayfa taramadaki sayfadır. */
function buildChartExamQuestions(items: Array<Record<string, unknown>>, count: number, lang: string, optionCount: number, seed: string): Record<string, unknown>[] {
  const rand = seededRandom(seed)
  const pool = (Array.isArray(items) ? items : []).map(it => {
    const raw = (it && typeof it.chart === 'object' ? it.chart : null) as Record<string, unknown> | null
    const chart = normalizeChartSpec(raw)
    const e = (it && typeof it.example === 'object' && it.example ? it.example : {}) as Record<string, unknown>
    const ex: ChartExample = {
      stem: typeof e.stem === 'string' ? e.stem : '',
      format: CHART_FORMATS.includes(String(e.format)) ? String(e.format) : 'which_true',
      skills: Array.isArray(e.skills) ? (e.skills as unknown[]).map(String).filter(k => CHART_SKILLS.includes(k)) : [],
      options_count: [4, 5].includes(Number(e.options_count)) ? Number(e.options_count) : undefined
    }
    const axes = { x_title: raw ? chartLabel(raw.x_title, 60) : '', y_title: raw ? chartLabel(raw.y_title, 60) : '' }
    return chart ? { page: Number(it.page) || null, chart, ex, axes } : null
  }).filter(Boolean) as Array<{ page: number | null; chart: ChartSpec; ex: ChartExample; axes: { x_title: string; y_title: string } }>
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
  const out: Record<string, unknown>[] = []
  const seen = new Set<string>()
  for (let i = 0; pool.length && out.length < count && i < count * 4; i++) {
    const it = pool[i % pool.length]
    const variant = chartVariant(it.chart, rand)
    if (!variant) continue
    const chart = { ...variant, ...(it.axes.x_title ? { x_title: it.axes.x_title } : {}), ...(it.axes.y_title ? { y_title: it.axes.y_title } : {}) }
    const q = buildChartQuestion(it.ex, chart, lang, rand, optionCount) || buildChartQuestion({ ...it.ex, format: 'which_true' }, chart, lang, rand, optionCount)
    if (!q) continue
    const key = String(q.question) + '|' + JSON.stringify(q.options || q.correct_answer)
    if (seen.has(key)) continue
    seen.add(key)
    if (it.page) q.source = { page: it.page, page_end: null, quote: null, unit: 'page' }
    out.push(q)
  }
  return out
}

// ==========================================================================
// FAZ 4b — GRAFİK ÇİZME (24.10.2026)
//
// Öğrenci cevabı ızgarada çizer (nokta, doğru, parça, ışın, parabol, çember,
// alan, bölge boyama, verilen doğruyu kaydırma) ya da değer yazarak girer.
// Model yalnızca ızgarayı ve cevabın TANIMINI verir: "y = -2*x + 10",
// kesişim {"intersect": ["g0", "a1"]}, doğru üstünde nokta {"on": "a0",
// "x": 0}. Koordinatları burada kod hesaplar; cevap ızgaraya oturmuyorsa
// soru atılır (graph_* nedenleri). Puanlama grade-exam'de, kodla.
// Model cevap tanımında her zaman x ve y kullanır (eksenler Q ve P olsa da).
// ==========================================================================
const GRAPH_KINDS = ['point', 'line', 'segment', 'ray', 'parabola', 'circle', 'polygon', 'fill']
const GRAPH_TOOL_ORDER = ['point', 'line', 'segment', 'ray', 'parabola', 'circle', 'polygon', 'fill', 'shift']
const GRAPH_MAX_STEPS = 24
const GRAPH_MAX_ELEMENTS = 6
const GRAPH_MAX_GIVEN = 4
const GRAPH_SHIFT_DIRS = ['right', 'left', 'up', 'down']
type GraphAxis = { min: number; max: number; step: number; snap: number; label: string; var: string }
type GraphIneq = { a: number; b: number; c: number; op: string }
type GraphObj = { kind: string; points: number[][]; label?: string; style?: string; ineq?: GraphIneq[]; shift?: { of: number; dir: string } }
type GraphSpec = { x: GraphAxis; y: GraphAxis; tools: string[]; given: GraphObj[]; labels: string[] }

function graphRound(v: number): number {
  return Math.round(v * 1e9) / 1e9
}

/** Eksen: min < max, adım > 0, en çok GRAPH_MAX_STEPS adım ve tam bölünür.
 *  Eksen harfi (Q, P) verilmezse etiketteki parantezden ("Miktar (Q)"). */
function normalizeGraphAxis(raw: unknown, defVar: string): GraphAxis | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const min = parseLooseNumber(r.min), max = parseLooseNumber(r.max), step = parseLooseNumber(r.step)
  if (![min, max, step].every(Number.isFinite) || max <= min || step <= 0) return null
  const n = (max - min) / step
  if (n < 2 || n > GRAPH_MAX_STEPS + 1e-9 || Math.abs(n - Math.round(n)) > 1e-6) return null
  const label = chartLabel(r.label, 40)
  const v = String(r.var ?? '').trim()
  const fromLabel = /^[A-Za-z]$/.test(label) ? label : (label.match(/\(([A-Za-z])\)\s*$/) || [])[1]
  return { min, max, step, snap: step, label, var: /^[A-Za-z]$/.test(v) ? v : fromLabel || defVar }
}

/** "y = -2*x + 10", "x = 4", "2x + 3y = 12" → a·x + b·y = c. Doğrusal
 *  değilse ya da okunamazsa null. */
function graphLinear(eq: unknown): { a: number; b: number; c: number } | null {
  const parts = String(eq ?? '').split('=')
  if (parts.length !== 2) return null
  const L = normalizeMathInput(parts[0], ['x', 'y']), R = normalizeMathInput(parts[1], ['x', 'y'])
  if (!L || !R) return null
  const g = (x: number, y: number) => evaluateExpression(L, { x, y }) - evaluateExpression(R, { x, y })
  const g0 = g(0, 0), a = g(1, 0) - g0, b = g(0, 1) - g0
  if (![g0, a, b].every(Number.isFinite) || (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12)) return null
  for (const [x, y] of [[2.7, -1.3], [-3.1, 4.6], [5.5, 2.2]]) {
    const d = g(x, y) - (a * x + b * y + g0)
    if (!Number.isFinite(d) || Math.abs(d) > 1e-6 * (1 + Math.abs(a * x) + Math.abs(b * y) + Math.abs(g0))) return null
  }
  return { a, b, c: -g0 }
}

/** "y <= -2*x + 10" → a·x + b·y (op) c; op: <, <=, >, >=. */
function graphInequality(s: unknown): GraphIneq | null {
  const m = String(s ?? '').replace(/≤/g, '<=').replace(/≥/g, '>=').match(/^(.*?)(<=|>=|<|>)(.*)$/)
  if (!m || /[<>=]/.test(m[3])) return null
  const lin = graphLinear(`${m[1]} - (${m[3]}) = 0`)
  return lin ? { a: lin.a, b: lin.b, c: lin.c, op: m[2] } : null
}

function graphInBox(p: number[], x: GraphAxis, y: GraphAxis): boolean {
  const ex = (x.max - x.min) * 1e-9, ey = (y.max - y.min) * 1e-9
  return p[0] >= x.min - ex && p[0] <= x.max + ex && p[1] >= y.min - ey && p[1] <= y.max + ey
}

function graphOnGrid(v: number, axis: GraphAxis, snap: number): boolean {
  const k = (v - axis.min) / snap
  return Math.abs(k - Math.round(k)) < 1e-6
}

/** İki noktadan doğru: a·x + b·y = c. */
function graphLineOf(p: number[], q: number[]): { a: number; b: number; c: number } {
  const a = q[1] - p[1], b = p[0] - q[0]
  return { a, b, c: a * p[0] + b * p[1] }
}

/** Doğrunun kutu içindeki iki uç noktası (kutuyu kesmiyorsa null). */
function graphClipLine(l: { a: number; b: number; c: number }, x: GraphAxis, y: GraphAxis): number[][] | null {
  const pts: number[][] = []
  const add = (px: number, py: number) => {
    const p = [graphRound(px), graphRound(py)]
    if (graphInBox(p, x, y) && !pts.some(o => Math.abs(o[0] - p[0]) < 1e-9 && Math.abs(o[1] - p[1]) < 1e-9)) pts.push(p)
  }
  if (Math.abs(l.b) > 1e-12) { add(x.min, (l.c - l.a * x.min) / l.b); add(x.max, (l.c - l.a * x.max) / l.b) }
  if (Math.abs(l.a) > 1e-12) { add((l.c - l.b * y.min) / l.a, y.min); add((l.c - l.b * y.max) / l.a, y.max) }
  if (pts.length < 2) return null
  let best = [pts[0], pts[1]], d = -1
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const dd = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])
    if (dd > d) { d = dd; best = [pts[i], pts[j]] }
  }
  return best
}

/** Doğrunun üstündeki ızgara kesişimleri (kutu içinde). */
function graphGridPointsOnLine(l: { a: number; b: number; c: number }, x: GraphAxis, y: GraphAxis, snapX: number, snapY: number): number {
  let n = 0
  const nx = Math.round((x.max - x.min) / snapX)
  for (let i = 0; i <= nx; i++) {
    const gx = x.min + i * snapX
    if (Math.abs(l.b) < 1e-12) { if (Math.abs(l.a * gx - l.c) < 1e-9 * (1 + Math.abs(l.c))) n += Math.round((y.max - y.min) / snapY) + 1; continue }
    const gy = (l.c - l.a * gx) / l.b
    if (graphInBox([gx, gy], x, y) && graphOnGrid(gy, y, snapY)) n++
  }
  return n
}

type GraphCtx = { given: GraphObj[]; answer: GraphObj[]; xv?: string; yv?: string }

/** Eksen harfleriyle yazılmış denklemi x/y'ye çevirir ("P = 12 - 2Q" →
 *  "y = 12 - 2x"). Model verilen nesneleri de eksen harfleriyle yazabiliyor
 *  (canlı test 25.10.2026: graph_given_invalid). */
function graphMapAxisVars(eq: unknown, ctx: GraphCtx): string {
  let s = String(eq ?? '')
  const swap = (from: string | undefined, to: string) => {
    if (from && /^[A-Za-z]$/.test(from) && from.toLowerCase() !== to) s = s.replace(new RegExp(`(^|[^A-Za-z])${from}(?![A-Za-z])`, 'g'), `$1${to}`)
  }
  if (ctx.xv && ctx.yv && ctx.xv.toLowerCase() !== 'y' && ctx.yv.toLowerCase() !== 'x') { swap(ctx.xv, 'x'); swap(ctx.yv, 'y') }
  return s
}

/** "g0" / "a1": verilen ya da önceki cevap öğesi (doğru türü). */
function graphRef(ref: unknown, ctx: GraphCtx): GraphObj | null {
  const m = String(ref ?? '').trim().match(/^([ga])(\d)$/)
  if (!m) return null
  const o = (m[1] === 'g' ? ctx.given : ctx.answer)[Number(m[2])]
  return o && ['line', 'segment', 'ray'].includes(o.kind) && o.points.length === 2 ? o : null
}

/** Nokta tanımı: [x, y], {x, y}, {intersect: [r1, r2]}, {on: r, x} / {on: r, y}. */
function graphResolvePoint(raw: unknown, ctx: GraphCtx): number[] | null {
  if (Array.isArray(raw) && raw.length === 2) {
    const p = raw.map(parseLooseNumber)
    return p.every(Number.isFinite) ? p : null
  }
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (Array.isArray(r.intersect) && r.intersect.length === 2) {
    const A = graphRef(r.intersect[0], ctx), B = graphRef(r.intersect[1], ctx)
    if (!A || !B) return null
    const l1 = graphLineOf(A.points[0], A.points[1]), l2 = graphLineOf(B.points[0], B.points[1])
    const det = l1.a * l2.b - l2.a * l1.b
    if (Math.abs(det) < 1e-12) return null
    return [graphRound((l1.c * l2.b - l2.c * l1.b) / det), graphRound((l1.a * l2.c - l2.a * l1.c) / det)]
  }
  if (r.on != null) {
    const A = graphRef(r.on, ctx)
    if (!A) return null
    const l = graphLineOf(A.points[0], A.points[1])
    const xv = parseLooseNumber(r.x), yv = parseLooseNumber(r.y)
    if (Number.isFinite(xv) && Math.abs(l.b) > 1e-12) return [graphRound(xv), graphRound((l.c - l.a * xv) / l.b)]
    if (Number.isFinite(yv) && Math.abs(l.a) > 1e-12) return [graphRound((l.c - l.b * yv) / l.a), graphRound(yv)]
    return null
  }
  const p = [parseLooseNumber(r.x), parseLooseNumber(r.y)]
  return p.every(Number.isFinite) ? p : null
}

const GRAPH_KIND_ALIASES: Record<string, string> = { area: 'polygon', shade: 'fill', region: 'fill', hline: 'line', vline: 'line', curve: 'line' }

/** Bir nesneyi (verilen ya da cevap öğesi) doğrular ve koordinatlarını
 *  hesaplar. Geçmezse { reason }. */
function normalizeGraphObject(raw: unknown, x: GraphAxis, y: GraphAxis, ctx: GraphCtx): { obj?: GraphObj; reason?: string } {
  if (!raw || typeof raw !== 'object') return { reason: 'graph_element_invalid' }
  const r = raw as Record<string, unknown>
  let kind = String(r.kind ?? '').trim().toLowerCase()
  kind = GRAPH_KIND_ALIASES[kind] || kind
  if (!GRAPH_KINDS.includes(kind)) return { reason: 'graph_kind_unknown' }
  const obj: GraphObj = { kind, points: [] }
  const label = chartLabel(r.label, 8)
  if (label) obj.label = label
  const style = String(r.style ?? '').toLowerCase()
  if (style === 'dashed' || style === 'solid') obj.style = style
  const pts = (v: unknown) => (Array.isArray(v) ? v : []).map(p => graphResolvePoint(p, ctx))
  if (kind === 'point') {
    const p = graphResolvePoint(r.at ?? r.point ?? (Array.isArray(r.points) ? r.points[0] : null) ?? (r.x != null ? { x: r.x, y: r.y } : null), ctx)
    if (!p) return { reason: 'graph_point_invalid' }
    obj.points = [p]
  } else if (kind === 'line' || kind === 'segment' || kind === 'ray') {
    let p = pts(r.points)
    if (p.length >= 2 && p[0] && p[1]) p = [p[0], p[1]]
    else if (r.equation != null) {
      const lin = graphLinear(graphMapAxisVars(r.equation, ctx))
      const clip = lin ? graphClipLine(lin, x, y) : null
      if (!clip) return { reason: 'graph_line_invalid' }
      if (kind !== 'line') obj.kind = kind = 'line'
      p = clip
    } else if (r.shift_of == null) return { reason: 'graph_line_invalid' }
    else p = []
    if (p.length === 2 && Math.hypot(p[0]![0] - p[1]![0], p[0]![1] - p[1]![1]) < 1e-9) return { reason: 'graph_line_invalid' }
    obj.points = p as number[][]
    if (r.shift_of != null) {
      const m = String(r.shift_of).trim().match(/^g(\d)$/)
      const dir = String(r.direction ?? '').trim().toLowerCase()
      const base = m ? ctx.given[Number(m[1])] : null
      if (!base || !['line', 'segment', 'ray'].includes(base.kind) || !GRAPH_SHIFT_DIRS.includes(dir)) return { reason: 'graph_shift_invalid' }
      obj.kind = 'line'
      obj.shift = { of: Number(m![1]), dir }
      if (obj.points.length === 2) {
        // Kesin yeni doğru verilmişse: verilene paralel ve söylenen yönde olmalı.
        const b = graphLineOf(base.points[0], base.points[1]), n = graphLineOf(obj.points[0], obj.points[1])
        if (Math.abs(b.a * n.b - n.a * b.b) > 1e-9 * (1 + Math.abs(b.a * n.b))) return { reason: 'graph_shift_not_parallel' }
        if (graphShiftDir(base.points, obj.points, x, y) !== dir) return { reason: 'graph_shift_wrong_dir' }
      }
    }
  } else if (kind === 'parabola' || kind === 'circle') {
    const a = graphResolvePoint(kind === 'parabola' ? r.vertex : r.center, ctx), t = graphResolvePoint(r.through, ctx)
    if (!a || !t) return { reason: `graph_${kind}_invalid` }
    if (kind === 'parabola' && Math.abs(t[0] - a[0]) < 1e-9) return { reason: 'graph_parabola_invalid' }
    if (kind === 'circle' && Math.hypot(t[0] - a[0], t[1] - a[1]) < 1e-9) return { reason: 'graph_circle_invalid' }
    obj.points = [a, t]
  } else if (kind === 'polygon') {
    const p = pts(r.points ?? r.vertices)
    if (p.length < 3 || p.length > 8 || p.some(v => !v)) return { reason: 'graph_polygon_invalid' }
    let area = 0
    for (let i = 0; i < p.length; i++) { const u = p[i]!, v = p[(i + 1) % p.length]!; area += u[0] * v[1] - v[0] * u[1] }
    if (Math.abs(area) < 1e-9) return { reason: 'graph_polygon_invalid' }
    obj.points = p as number[][]
  } else if (kind === 'fill') {
    const ineq = (Array.isArray(r.inequalities) ? r.inequalities : []).slice(0, 6).map(v => graphInequality(graphMapAxisVars(v, ctx)))
    if (!ineq.length || ineq.some(v => !v)) return { reason: 'graph_fill_invalid' }
    obj.ineq = ineq as GraphIneq[]
    // Bölge kutu içinde boş olmamalı, kutunun tamamı da olmamalı.
    let inside = 0, total = 0
    for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
      const px = x.min + (x.max - x.min) * (i + 0.5) / 41, py = y.min + (y.max - y.min) * (j + 0.5) / 41
      total++
      if (graphIneqHolds(obj.ineq, px, py)) inside++
    }
    if (!inside || inside === total) return { reason: 'graph_fill_invalid' }
  }
  return { obj }
}

function graphIneqHolds(ineq: GraphIneq[], px: number, py: number): boolean {
  return ineq.every(q => {
    const v = q.a * px + q.b * py
    return q.op === '<' ? v < q.c : q.op === '<=' ? v <= q.c + 1e-9 : q.op === '>' ? v > q.c : v >= q.c - 1e-9
  })
}

/** Kaydırma yönü: yeni doğru, verilenin sağında/solunda (ya da üstünde/
 *  altında) mı. Kutunun ortasından ölçülür. */
function graphShiftDir(base: number[][], moved: number[][], x: GraphAxis, y: GraphAxis): string | null {
  const b = graphLineOf(base[0], base[1]), m = graphLineOf(moved[0], moved[1])
  const midY = (y.min + y.max) / 2, midX = (x.min + x.max) / 2
  if (Math.abs(b.a) > 1e-12 && Math.abs(m.a) > 1e-12) {
    const dx = (m.c - m.b * midY) / m.a - (b.c - b.b * midY) / b.a
    if (Math.abs(dx) > 1e-9) return dx > 0 ? 'right' : 'left'
  }
  if (Math.abs(b.b) > 1e-12 && Math.abs(m.b) > 1e-12) {
    const dy = (m.c - m.a * midX) / m.b - (b.c - b.a * midX) / b.b
    if (Math.abs(dy) > 1e-9) return dy > 0 ? 'up' : 'down'
  }
  return null
}

/** Cevap öğesinin ızgaraya oturduğu en kaba yapışma adımı (1 = adım,
 *  0.5 = yarım adım); oturmuyorsa 0. Öğrenci ızgaraya yapışarak da tam
 *  puan alabilmeli. */
function graphElementSnap(o: GraphObj, x: GraphAxis, y: GraphAxis): number {
  for (const f of [1, 0.5]) {
    const sx = x.step * f, sy = y.step * f
    const onGrid = (p: number[]) => graphInBox(p, x, y) && graphOnGrid(p[0], x, sx) && graphOnGrid(p[1], y, sy)
    let ok: boolean
    if (o.kind === 'fill') ok = true
    else if (o.kind === 'line' && !o.points.length) ok = true // yalnızca yönü sorulan kaydırma
    else if (o.kind === 'line') ok = graphGridPointsOnLine(graphLineOf(o.points[0], o.points[1]), x, y, sx, sy) >= 2
    else ok = o.points.every(onGrid)
    if (ok) return f
  }
  return 0
}

function graphNum(v: number, lang: string): string {
  return Number(graphRound(v)).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 3 })
}

/** Doğrunun denklemi (eksen harfleriyle): "P = −2Q + 10", "Q = 4". */
function graphLineText(p: number[][], x: GraphAxis, y: GraphAxis, lang: string): string {
  const l = graphLineOf(p[0], p[1])
  if (Math.abs(l.b) < 1e-12) return `${x.var} = ${graphNum(l.c / l.a, lang)}`
  const m = -l.a / l.b, k = l.c / l.b
  const mt = Math.abs(m) < 1e-12 ? '' : `${m < 0 ? '−' : ''}${Math.abs(Math.abs(m) - 1) < 1e-12 ? '' : graphNum(Math.abs(m), lang)}${x.var}`
  const kt = Math.abs(k) < 1e-12 ? (mt ? '' : '0') : mt ? ` ${k < 0 ? '−' : '+'} ${graphNum(Math.abs(k), lang)}` : `${k < 0 ? '−' : ''}${graphNum(Math.abs(k), lang)}`
  return `${y.var} = ${mt}${kt}`
}

function graphPointText(p: number[], lang: string): string {
  return `(${graphNum(p[0], lang)}${lang === 'en' ? ', ' : '; '}${graphNum(p[1], lang)})`
}

const GRAPH_KIND_NAMES: Record<string, [string, string]> = {
  point: ['Nokta', 'Point'], line: ['Doğru', 'Line'], segment: ['Doğru parçası', 'Segment'], ray: ['Işın', 'Ray'],
  parabola: ['Parabol', 'Parabola'], circle: ['Çember', 'Circle'], polygon: ['Alan', 'Area'], fill: ['Boyalı bölge', 'Shaded region']
}

/** Cevabın okunur metni (sonuç kâğıdında "doğrusu"). */
function graphAnswerText(els: GraphObj[], none: boolean, x: GraphAxis, y: GraphAxis, lang: string): string {
  const tr = lang !== 'en'
  if (none) return tr ? 'Çizilecek bir şey yok (çözüm yok)' : 'Nothing to draw (no solution)'
  return els.map(o => {
    const name = (GRAPH_KIND_NAMES[o.kind] || [o.kind, o.kind])[tr ? 0 : 1] + (o.label ? ` ${o.label}` : '')
    if (o.kind === 'point') return `${name} ${graphPointText(o.points[0], lang)}`
    if (o.kind === 'line' && o.points.length === 2) return `${name}: ${graphLineText(o.points, x, y, lang)}`
    if (o.kind === 'line' && o.shift) {
      const d: Record<string, [string, string]> = { right: ['sağa', 'right'], left: ['sola', 'left'], up: ['yukarı', 'up'], down: ['aşağı', 'down'] }
      return tr ? `${name}: verilen doğru ${d[o.shift.dir][0]} kayar` : `${name}: the given line shifts ${d[o.shift.dir][1]}`
    }
    if (o.kind === 'fill') return name
    if (o.kind === 'parabola') return tr ? `${name}: tepe ${graphPointText(o.points[0], lang)}, geçtiği nokta ${graphPointText(o.points[1], lang)}` : `${name}: vertex ${graphPointText(o.points[0], lang)}, through ${graphPointText(o.points[1], lang)}`
    if (o.kind === 'circle') return tr ? `${name}: merkez ${graphPointText(o.points[0], lang)}, r = ${graphNum(Math.hypot(o.points[1][0] - o.points[0][0], o.points[1][1] - o.points[0][1]), lang)}` : `${name}: centre ${graphPointText(o.points[0], lang)}, r = ${graphNum(Math.hypot(o.points[1][0] - o.points[0][0], o.points[1][1] - o.points[0][1]), lang)}`
    return `${name}: ${o.points.map(p => graphPointText(p, lang)).join(' – ')}`
  }).join(' · ')
}

/** FAZ 4b.2: taranmış grafik örneğini sınav türüne uyarlar (öğrenci
 *  "dosyadaki grafik sorularına göre" demese de benzerleri sınava karışır).
 *  test: yalnızca çoktan seçmeli biçimler (değer sorusu şıklı); klasik:
 *  yorum; hesaplama: değer (hesap sorusu); karışık: örneğin biçimi, sayısal
 *  olmayan kaynakta değer sorusu şıklı. Çizim örneği (format 'draw') null. */
function chartItemForExam(item: Record<string, unknown>, examType: string, isQuant: boolean, optionCount: number): Record<string, unknown> | null {
  const e = (item && typeof item.example === 'object' && item.example ? item.example : {}) as Record<string, unknown>
  const f = String(e.format ?? '')
  if (f === 'draw' || !item.chart || typeof item.chart !== 'object' || !Object.keys(item.chart as Record<string, unknown>).length) return null
  const ex: Record<string, unknown> = { ...e }
  const mcValue = () => { if (![4, 5].includes(Number(ex.options_count))) ex.options_count = optionCount }
  if (examType === 'classic') ex.format = 'open'
  else if (examType === 'calculation') { ex.format = 'value'; ex.options_count = null }
  else if (examType === 'test') { if (f === 'value') mcValue(); else if (!['which_true', 'which_false', 'premises'].includes(f)) ex.format = 'which_true' }
  else if (f === 'value' && !isQuant) mcValue()
  return { ...item, example: ex }
}

/** Kodla kurulan soruları sınava eşit aralıklarla yerleştirir. */
function spreadInsert<T>(base: T[], extra: T[]): T[] {
  if (!extra.length) return base
  const out = [...base], n = base.length + extra.length
  extra.forEach((q, i) => out.splice(Math.min(out.length, Math.max(0, Math.round((i + 1) * n / (extra.length + 1)) - 1)), 0, q))
  return out
}

/** FAZ 4b (canlı test 25.10.2026): kaynak koordinat düzleminde çizilen bir
 *  konu öğretiyor mu. Model "karışık sınavda beş tipe eşit dağıt" kuralına
 *  uyup arz-talep notunda bile çizim sorusu yazmadı; kaynak uygunsa çizim
 *  sorusu zorunlu tutulur. En az iki güçlü kavram + bir denklem izi. */
const GRAPH_SOURCE_CUES = ['talep', 'arz', 'denge', 'eğim', 'doğrusal', 'eşitsizli', 'parabol', 'koordinat', 'kesişim', 'bütçe doğrusu', 'tüketici artığı', 'üretici artığı', 'tavan fiyat', 'taban fiyat', 'demand', 'supply', 'equilibrium', 'slope', 'intercept', 'linear function', 'inequalit', 'parabola', 'coordinate', 'budget line', 'surplus', 'price ceiling', 'price floor']
/** FAZ 3b (canlı test 26.10.2026): kaynak sembolik cebir ya da türev
 *  öğretiyor mu. Prompt "yaklaşık yarısı ifade sorusu" dese de model türev
 *  belgesinden yalnızca hesap sorusu yazdı; uygunsa istekte zorunlu denir. */
const ALGEBRA_SOURCE_CUES = ['türev', 'sadeleştir', 'çarpanlara ayır', 'parantez aç', 'integral', 'zincir kuralı', 'çarpım kuralı', 'bölüm kuralı', 'kuvvet kuralı', 'rasyonel ifade', 'iki kare farkı', 'tam kare', 'derivative', 'simplif', 'factoris', 'factoriz', 'expand', 'chain rule', 'product rule', 'quotient rule', 'power rule', 'antiderivative']
function sourceTeachesAlgebra(text: unknown): boolean {
  const t = String(text ?? '').toLocaleLowerCase('tr-TR')
  return ALGEBRA_SOURCE_CUES.filter(c => t.includes(c)).length >= 2
}

function sourceTeachesGraphs(text: unknown): boolean {
  const t = String(text ?? '').toLocaleLowerCase('tr-TR')
  const hits = GRAPH_SOURCE_CUES.filter(c => t.includes(c)).length
  const equation = /(^|[^a-zçğıöşü])[a-zçğıöşü]\s*=\s*[-−(]?\s*\d/u.test(t) || /[a-zçğıöşü]\s*[<>≤≥]=?\s*-?\d/u.test(t)
  return hits >= 2 && equation
}

/** FAZ 4b: çizim sorusunu doğrular; ızgarayı, verilenleri ve cevabı kodla
 *  hesaplanmış koordinatlarla yazar. Araçlar cevaptan türetilir. */
/** Sorunun çizim istenen cümlelerindeki etiketler: "Talep (D) ve arz (S)
 *  doğrularını çizin" → D, S. "verilmiştir" cümlesindekiler alınmaz. */
function graphDrawLabels(text: string): Set<string> {
  const out = new Set<string>()
  for (const sentence of String(text ?? '').split(/(?<=[.!?;])\s+/)) {
    if (!/çiz|draw|sketch|plot|graph the/i.test(sentence) || /veril|given/i.test(sentence)) continue
    for (const m of sentence.matchAll(/\(\s*([A-Za-z]{1,2}\d?['’]?)\s*\)/g)) out.add(m[1].toUpperCase())
  }
  return out
}

/** İki doğru (parça / ışın) aynı doğru üstünde mi. */
function graphSameLine(a: GraphObj, b: GraphObj): boolean {
  const c = graphLineOf(a.points[0], a.points[1])
  const tol = 1e-6 * (1 + Math.abs(c.c) + Math.abs(c.a) + Math.abs(c.b))
  return b.points.every(p => Math.abs(c.a * p[0] + c.b * p[1] - c.c) <= tol)
}

/** FAZ 4b.2: dosyadaki çizim sorularının denklemleri ("P = 10 − Q",
 *  "2x + y ≤ 6"). Model "yeni sayılarla" dense de aynılarını kopyaladı
 *  (canlı test 25.10.2026); aynı denklemi taşıyan çizim sorusu atılır. */
const GRAPH_EQ_TERM = String.raw`(?:\d+(?:[.,]\d+)?[a-zA-Z]?\b|\b[a-zA-Z]\b)`
const GRAPH_EQ_RE = new RegExp(String.raw`${GRAPH_EQ_TERM}(?:\s*[-−+*/]\s*${GRAPH_EQ_TERM})*\s*(?:<=|>=|[=≤≥<>])\s*${GRAPH_EQ_TERM}(?:\s*[-−+*/]\s*${GRAPH_EQ_TERM})*`, 'g')
function graphEquationsIn(text: string): string[] {
  const t = String(text ?? '').replace(/\$/g, '').replace(/\\[,;!]/g, '').replace(/\\(?:le|leq)\b/g, '≤').replace(/\\(?:ge|geq)\b/g, '≥')
  return [...new Set((t.match(GRAPH_EQ_RE) || []).map(e => e.replace(/\s+/g, '').replace(/−/g, '-').replace(/\*/g, '').replace(/,/g, '.').replace(/<=/g, '≤').replace(/>=/g, '≥').toLowerCase()).filter(e => e.length >= 5 && /\d/.test(e)))]
}

/** Çizim sorusu dosyadakinin kopyası mı: denklemlerinin HEPSİ dosyada geçiyor.
 *  Canlı test (26.10.2026): yeni talep doğrusuyla "P = 2 + Q" arzını birlikte
 *  kullanan soru da atılmıştı; tek ortak denklem kopya sayılmaz. */
function graphCopiesFile(text: string, fileEqs: Set<string>): boolean {
  if (!fileEqs.size) return false
  const eqs = graphEquationsIn(text)
  return eqs.length > 0 && eqs.every(e => fileEqs.has(e))
}

function verifyGraph(q: Record<string, unknown>, lang: string): { ok: boolean; reason?: string } {
  const g = (q.graph && typeof q.graph === 'object' ? q.graph : {}) as Record<string, unknown>
  const x = normalizeGraphAxis(g.x ?? { min: g.x_min, max: g.x_max, step: g.x_step, label: g.x_label }, 'x')
  const y = normalizeGraphAxis(g.y ?? { min: g.y_min, max: g.y_max, step: g.y_step, label: g.y_label }, 'y')
  if (!x || !y) return { ok: false, reason: 'graph_axes_invalid' }
  const ctx: GraphCtx = { given: [], answer: [], xv: x.var, yv: y.var }
  for (const raw of (Array.isArray(g.given) ? g.given : []).slice(0, GRAPH_MAX_GIVEN)) {
    const r = normalizeGraphObject(raw, x, y, ctx)
    if (!r.obj || r.obj.kind === 'fill' || r.obj.shift || !r.obj.points.length) return { ok: false, reason: `graph_given_invalid${r.reason ? ':' + r.reason : ''}` }
    ctx.given.push(r.obj)
  }
  const rawAns = q.graph_answer
  const none = rawAns === 'none' || (!!rawAns && typeof rawAns === 'object' && !Array.isArray(rawAns) && (rawAns as Record<string, unknown>).none === true)
  if (!none) {
    const list = Array.isArray(rawAns) ? rawAns : (rawAns && typeof rawAns === 'object' && Array.isArray((rawAns as Record<string, unknown>).elements) ? (rawAns as Record<string, unknown>).elements as unknown[] : [])
    if (!list.length || list.length > GRAPH_MAX_ELEMENTS) return { ok: false, reason: 'graph_no_answer' }
    for (const raw of list) {
      const r = normalizeGraphObject(raw, x, y, ctx)
      if (!r.obj) return { ok: false, reason: r.reason }
      ctx.answer.push(r.obj)
    }
  }
  // FAZ 4b.2 (canlı test 25.10.2026): model öğrencinin çizeceği doğruları
  // "given"a da koydu; doğrular ekranda hazır çizili geldi (cevap sızdı).
  // Cevaptaki bir doğruyla çakışan verilen nesne kaldırılır (kaydırma
  // sorusunun baz doğrusu hariç); kaydırma referansları yeniden sıralanır.
  // İkinci canlı test (26.10.2026): model D ve S'yi yalnızca "given"a koydu,
  // cevapta yalnızca E vardı; soru ise "D ve S doğrularını çizin" diyordu.
  // Çizim cümlesinde etiketi geçen verilen doğru cevaba taşınır.
  if (!none && ctx.given.length) {
    const ansLines = ctx.answer.filter(o => !o.shift && ['line', 'segment', 'ray'].includes(o.kind) && o.points.length === 2)
    const shiftBase = new Set(ctx.answer.filter(o => o.shift).map(o => o.shift!.of))
    const drawLabels = graphDrawLabels(String(q.question ?? ''))
    const isLine = (gv: GraphObj) => ['line', 'segment', 'ray'].includes(gv.kind) && gv.points.length === 2
    const asked = (gv: GraphObj) => !!gv.label && drawLabels.has(gv.label.toUpperCase())
    const leaks = (gv: GraphObj, i: number) => !shiftBase.has(i) && isLine(gv) && (ansLines.some(a => graphSameLine(a, gv)) || asked(gv))
    const map = new Map<number, number>()
    const kept: GraphObj[] = []
    const moved: GraphObj[] = []
    ctx.given.forEach((gv, i) => {
      if (!leaks(gv, i)) { map.set(i, kept.length); kept.push(gv) }
      else if (!ansLines.some(a => graphSameLine(a, gv))) moved.push(gv)
    })
    if (ctx.answer.length + moved.length > GRAPH_MAX_ELEMENTS) return { ok: false, reason: 'graph_given_is_answer' }
    ctx.answer.unshift(...moved)
    if (kept.length < ctx.given.length) {
      for (const o of ctx.answer) if (o.shift) o.shift = { ...o.shift, of: map.get(o.shift.of)! }
      ctx.given = kept
    }
  }
  // Denge / kesişim noktası çizilen doğruların gerçek kesişimi olmalı. Canlı
  // test (25.10.2026): model yeni dengeyi "(4; 4)" diye elle yazdı; doğrular
  // (3,67; 6,67)'de kesişiyordu ve doğru cevap yanlış sayıldı.
  const asksIntersection = /denge|kesiş|equilibri|intersect/i.test(String(q.question ?? ''))
  const lines = [...ctx.answer, ...ctx.given].filter(o => ['line', 'segment', 'ray'].includes(o.kind) && o.points.length === 2)
  for (const o of ctx.answer) {
    if (o.kind !== 'point') continue
    const p = o.points[0]
    const onLines = lines.filter(l => { const c = graphLineOf(l.points[0], l.points[1]); return Math.abs(c.a * p[0] + c.b * p[1] - c.c) <= 1e-6 * (1 + Math.abs(c.c) + Math.abs(c.a) + Math.abs(c.b)) }).length
    const isEq = asksIntersection || /^E\b|^E['’*]|^E\d/.test(o.label || '')
    if (isEq && lines.length >= 2 && onLines < 2) return { ok: false, reason: 'graph_point_not_intersection' }
  }
  let snap = 1
  for (const o of ctx.answer) {
    const f = graphElementSnap(o, x, y)
    if (!f) return { ok: false, reason: 'graph_off_grid' }
    snap = Math.min(snap, f)
  }
  x.snap = x.step * snap
  y.snap = y.step * snap
  const kinds = new Set(ctx.answer.map(o => o.shift ? 'shift' : o.kind))
  if (kinds.has('fill')) kinds.add('line')
  const tools = GRAPH_TOOL_ORDER.filter(t => t === 'point' || t === 'line' || kinds.has(t))
  const labels = [...new Set([...ctx.answer, ...ctx.given].map(o => o.label || '').filter(Boolean))].sort()
  const spec: GraphSpec = { x, y, tools, given: ctx.given, labels }
  q.graph = spec
  q.graph_answer = { none, elements: ctx.answer }
  q.correct_answer = graphAnswerText(ctx.answer, none, x, y, lang)
  q.options = null
  q.solution_steps = Array.isArray(q.solution_steps) ? q.solution_steps.map(s => String(s ?? '')).filter(Boolean) : []
  for (const k of ['tolerance_percent', 'units', 'variables', 'formula', 'template', 'common_errors', 'verified', 'step_kind', 'equation', 'unknown', 'expr_vars', 'form', 'given', 'up_to_constant', 'chart_ref', 'chart']) delete q[k]
  return { ok: true }
}

/* ---------- FAZ 5.2: akıllı deneme ----------
   Konu ustalığı js/exam-engine.js conceptMastery ile AYNI modeldir
   (tests/exam-adaptive.js iki uygulamayı aynı girdilerle karşılaştırır).
   Birini değiştirirsen ötekini de değiştir. */
const MASTERY_LEVELS = ['zayıf', 'tanıdık', 'yetkin', 'usta']
const MASTERY_MIN = [0, 0.4, 0.7, 0.9]
const MASTERY_PARAMS = { prior: 0.3, slip: 0.1, learn: 0.1, max: 0.98, dueRetention: 0.8 }
const MASTERY_DAY_MS = 86400000

type ConceptMastery = {
  key: string; name: string; mastery: number; p: number; level: number; levelName: string; retention: number; stability: number
  due: boolean; n: number; exams: number; okDays: number; lastAt: number; daysAgo: number; recentAvg: number; recentExams: number; fewData: boolean
  history: Array<{ at: number; avg: number; n: number; exam: unknown }>
}

function conceptKey(name: unknown): string {
  return String(name == null ? '' : name).normalize('NFC').replace(/\s*\([^()]{1,12}\)\s*$/, '')
    .toLocaleLowerCase('tr-TR').replace(/[.,;:!?'"“”‘’]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function guessRate(type: unknown, optionCount?: unknown): number {
  if (type === 'multiple_choice') return 1 / (Number(optionCount) === 5 ? 5 : 4)
  if (type === 'true_false') return 0.5
  if (type === 'fill_blank' || type === 'open_ended') return 0.1
  return 0.05
}

function masteryLevelOf(p: number, okDays: number, n: number): number {
  let lv = 0
  for (let i = MASTERY_MIN.length - 1; i >= 0; i--) if (p >= MASTERY_MIN[i]) { lv = i; break }
  if (lv === 3 && (okDays < 2 || n < 5)) lv = 2
  if (lv >= 2 && n < 3) lv = 1
  return lv
}

function retentionOf(days: number, stability: number): number {
  if (!(stability > 0) || !(days > 0)) return 1
  return Math.pow(1 + (19 / 81) * days / stability, -0.5)
}

function conceptMastery(exams: unknown, opts?: { now?: number }): ConceptMastery[] {
  const now = opts && Number.isFinite(opts.now) ? Number(opts.now) : Date.now()
  const P = MASTERY_PARAMS
  type St = { key: string; name: string; p: number; stability: number; lastAt: number; okDays: string[]; n: number; history: Array<{ at: number; avg: number; n: number; exam: unknown }> }
  const map: Record<string, St> = {}
  const list = (Array.isArray(exams) ? exams : []).filter((e: Record<string, unknown>) => e && e.completed_at && Array.isArray(e.question_results))
    .slice().sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(String(a.completed_at)).getTime() - new Date(String(b.completed_at)).getTime()) as Array<Record<string, unknown>>
  list.forEach(exam => {
    const at = new Date(String(exam.completed_at)).getTime()
    if (!Number.isFinite(at)) return
    const optionCount = exam.scoring && (exam.scoring as Record<string, unknown>).option_count
    const groups: Record<string, { name: string; obs: Array<{ c: number; g: number }> }> = {}
    ;(exam.question_results as Array<Record<string, unknown>>).forEach(r => {
      if (!r || !r.concept) return
      const k = conceptKey(r.concept)
      if (!k) return
      const score = Math.max(0, Math.min(100, Number(r.score) || 0))
      const conf = score >= 50 ? (r.flagged ? 0.6 : 1) * (r.hint_used || r.help_used ? 0.5 : 1) : 1
      const c = (score >= 50 ? score / 100 : score / 200) * conf
      ;(groups[k] = groups[k] || { name: String(r.concept).trim(), obs: [] }).obs.push({ c: c, g: guessRate(r.type, optionCount) })
    })
    Object.keys(groups).forEach(k => {
      const grp = groups[k]
      const s = map[k] = map[k] || { key: k, name: grp.name, p: P.prior, stability: 0, lastAt: 0, okDays: [], n: 0, history: [] }
      const prevLevel = s.n ? masteryLevelOf(s.p, s.okDays.length, s.n) : -1
      const before = s.n ? retentionOf((at - s.lastAt) / MASTERY_DAY_MS, s.stability) : 1
      let p = s.p
      grp.obs.forEach(o => {
        const right = p * (1 - P.slip) / (p * (1 - P.slip) + (1 - p) * o.g)
        const wrong = p * P.slip / (p * P.slip + (1 - p) * (1 - o.g))
        p = o.c * right + (1 - o.c) * wrong
      })
      p = Math.min(P.max, p + (1 - p) * P.learn)
      const avg = grp.obs.reduce((t, o) => t + o.c, 0) / grp.obs.length
      const day = new Date(at).toISOString().slice(0, 10)
      if (avg >= 0.8 && s.okDays.indexOf(day) < 0) s.okDays.push(day)
      if (prevLevel > 0 && masteryLevelOf(p, s.okDays.length, s.n + grp.obs.length) < prevLevel - 1) p = MASTERY_MIN[prevLevel - 1]
      const gapDays = s.n ? (at - s.lastAt) / MASTERY_DAY_MS : 0
      if (!s.stability) s.stability = avg >= 0.8 ? 3 : avg >= 0.5 ? 1.5 : 1
      else if (avg >= 0.8) s.stability = Math.min(365, s.stability * (gapDays >= 0.5 ? 1.8 + 2 * (1 - before) : 1.15))
      else if (avg < 0.5) s.stability = Math.max(1, s.stability * 0.4)
      else s.stability = s.stability * 1.1
      s.p = p
      s.name = grp.name
      s.lastAt = at
      s.n += grp.obs.length
      s.history.push({ at: at, avg: Math.round(avg * 100), n: grp.obs.length, exam: exam.id == null ? null : exam.id })
    })
  })
  return Object.keys(map).map(k => {
    const s = map[k]
    const days = Math.max(0, (now - s.lastAt) / MASTERY_DAY_MS)
    const retention = retentionOf(days, s.stability)
    const level = masteryLevelOf(s.p, s.okDays.length, s.n)
    const recent = s.history.slice(-3)
    return {
      key: s.key, name: s.name, mastery: Math.round(s.p * 100), p: s.p, level: level, levelName: MASTERY_LEVELS[level],
      retention: Math.round(retention * 100), stability: Math.round(s.stability * 10) / 10,
      due: level >= 2 && retention < P.dueRetention, n: s.n, exams: s.history.length, okDays: s.okDays.length,
      lastAt: s.lastAt, daysAgo: Math.floor(days), recentAvg: Math.round(recent.reduce((t, h) => t + h.avg, 0) / recent.length),
      recentExams: recent.length, fewData: s.n < 3, history: s.history
    }
  }).sort((a, b) => (Number(b.due) - Number(a.due)) || (a.p * (0.5 + a.retention / 200)) - (b.p * (0.5 + b.retention / 200)) || a.name.localeCompare(b.name, 'tr'))
}

type AdaptiveSlot = { concept: string; key: string; reason: 'weak' | 'review' | 'new' | 'stretch'; difficulty: 'easy' | 'medium' | 'hard'; level: number | null }

/** Akıllı deneme planı: soru başına bir konu, neden ve zorluk.
 *  Karışım (araştırma: ALEKS öğrenme yolu, Khan "mastery challenge", FSRS):
 *  - tekrar zamanı gelenler (hafızası düşen yetkin/usta) en çok üçte bir
 *  - yeni konular (kaynağın henüz sorulmamış terimleri) en çok beşte bir;
 *    sınava 7 gün ya da daha az kaldıysa yeni konu yok
 *  - 5 ve üstü soruda bir pekiştirme sorusu (yetkin konudan, zor; karışık tekrar)
 *  - kalanı zayıf/tanıdık konular, en zayıflar iki soru alabilir
 *  Zorluk: zayıf → kolay, tanıdık → orta, yetkin/usta → zor; tekrar: hafıza
 *  %60 altındaysa orta, değilse zor; yeni konu orta. */
function buildAdaptivePlan(mastery: ConceptMastery[], sourceTerms: string[], count: number, opts?: { daysToExam?: number | null }): AdaptiveSlot[] {
  const n = Math.max(0, Math.floor(count))
  if (!n) return []
  const days = opts && opts.daysToExam != null && Number.isFinite(Number(opts.daysToExam)) ? Number(opts.daysToExam) : null
  const examSoon = days != null && days >= 0 && days <= 7
  const known = new Set(mastery.map(c => c.key))
  const newTerms: string[] = []
  for (const t of sourceTerms) {
    const k = conceptKey(t)
    if (k && !known.has(k) && !newTerms.some(x => conceptKey(x) === k)) newTerms.push(String(t).trim())
  }
  const due = mastery.filter(c => c.due).sort((a, b) => a.retention - b.retention)
  const weak = mastery.filter(c => !c.due && c.level <= 1).sort((a, b) => a.p - b.p)
  const strong = mastery.filter(c => !c.due && c.level >= 2).sort((a, b) => a.retention - b.retention || a.p - b.p)
  const diffOf = (c: ConceptMastery): AdaptiveSlot['difficulty'] => c.level === 0 ? 'easy' : c.level === 1 ? 'medium' : 'hard'
  const slot = (c: ConceptMastery, reason: AdaptiveSlot['reason']): AdaptiveSlot => ({
    concept: c.name, key: c.key, reason,
    difficulty: reason === 'review' ? (c.retention < 60 ? 'medium' : 'hard') : diffOf(c), level: c.level
  })
  const plan: AdaptiveSlot[] = []
  let nReview = Math.min(due.length, Math.ceil(n / 3))
  let nNew = examSoon ? 0 : Math.min(newTerms.length, Math.round(n / 5))
  let nStretch = n >= 5 && strong.length ? 1 : 0
  if (!weak.length) { nReview = Math.min(due.length, n - nStretch); nNew = examSoon ? 0 : Math.min(newTerms.length, n - nReview - nStretch) }
  due.slice(0, nReview).forEach(c => plan.push(slot(c, 'review')))
  newTerms.slice(0, nNew).forEach(t => plan.push({ concept: t, key: conceptKey(t), reason: 'new', difficulty: 'medium', level: null }))
  strong.slice(0, nStretch).forEach(c => plan.push(slot(c, 'stretch')))
  // Zayıflar: önce birer, sonra en zayıflara ikinci soru (en çok ikişer).
  for (let round = 0; round < 2 && plan.length < n; round++) {
    for (const c of weak) { if (plan.length >= n) break; if (round === 1 && plan.filter(x => x.key === c.key).length >= 2) continue; plan.push(slot(c, 'weak')) }
  }
  // Hâlâ boşluk varsa: kalan tekrarlar, yeni konular, güçlüler (yine konu başına en çok iki soru).
  const fill: AdaptiveSlot[] = [...due.slice(nReview).map(c => slot(c, 'review')), ...(examSoon ? [] : newTerms.slice(nNew).map(t => ({ concept: t, key: conceptKey(t), reason: 'new' as const, difficulty: 'medium' as const, level: null }))), ...strong.slice(nStretch).map(c => slot(c, 'stretch'))]
  for (const f of fill) { if (plan.length >= n) break; plan.push(f) }
  // Konu az: her konuya ikinci soru (en çok iki). Yine eksikse plan kısa
  // kalır; kalan sorular planı olmadan normal üretilir.
  for (const c of [...new Map(plan.map(x => [x.key, x])).values()]) {
    if (plan.length >= n) break
    if (plan.filter(x => x.key === c.key).length < 2) plan.push({ ...c })
  }
  // Sıra: kolaydan zora, aynı konular yan yana gelmesin.
  const rank = { easy: 0, medium: 1, hard: 2 }
  plan.sort((a, b) => rank[a.difficulty] - rank[b.difficulty])
  for (let i = 1; i < plan.length; i++) {
    if (plan[i].key !== plan[i - 1].key) continue
    const j = plan.findIndex((x, k) => k > i && x.key !== plan[i].key)
    if (j > 0) { const t = plan[i]; plan[i] = plan[j]; plan[j] = t }
  }
  return plan.slice(0, n)
}

/** Kaynağın terimleri: key_terms ["Esneklik", {term:"GSYH"}…] → ad listesi. */
function termNames(list: unknown): string[] {
  return (Array.isArray(list) ? list : []).map(t => typeof t === 'string' ? t : (t && typeof t === 'object' ? String((t as Record<string, unknown>).term ?? '') : '')).map(t => t.trim()).filter(t => t && t.length <= 120)
}

/** Planın istek metni: soru sırası, konu adı birebir, zorluk ve neden. */
function adaptivePlanText(plan: AdaptiveSlot[]): string {
  const why = { weak: 'weak topic for this student', review: 'mastered earlier, now fading — review', new: 'not tested yet', stretch: 'strong topic — harder application' }
  return `ADAPTIVE PLAN (personalized exam; write exactly one question per line below, in this order; set "concept" to the quoted name verbatim; match the stated difficulty for that question instead of the overall level):\n${plan.map((s, i) => `${i + 1}. "${s.concept}" — ${s.difficulty} (${why[s.reason]})`).join('\n')}`
}

/** Hesap sorusunun formül anahtarı: boşluksuz formül + değişken adları.
 *  Aynı formülü farklı sayılarla soran iki soru aynı anahtarı alır. */
function calcFormulaKey(q: Record<string, unknown>): string | null {
  if (q.type !== 'calculation' || typeof q.formula !== 'string' || !q.formula.trim()) return null
  const vars = q.variables && typeof q.variables === 'object' ? Object.keys(q.variables as Record<string, unknown>).sort().join(',') : ''
  return `${q.formula.replace(/\s+/g, '')}|${vars}`
}

/** Doğrulanamayan hesap sorusunda cevap, çözümün son adımındaki
 *  sayılardan biri olmalı (adım yoksa ya da son adımda sayı yoksa kabul). */
function unverifiedAnswerConsistent(steps: unknown, answer: number): boolean {
  const list = Array.isArray(steps) ? steps.map(s => String(s ?? '')).filter(s => s.trim()) : []
  if (!list.length) return true
  const nums = (list[list.length - 1].match(/-?\d+(?:[.,]\d+)*/g) || []).map(t => parseLooseNumber(t)).filter(x => Number.isFinite(x))
  if (!nums.length) return true
  return nums.some(x => Math.abs(x - answer) <= Math.max(1e-9, Math.abs(answer) * 0.005))
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
  for (const k of ['question', 'hint', 'explanation', 'correct_answer']) if (typeof q[k] === 'string') q[k] = repairLatex(q[k] as string)
  for (const k of ['options', 'accepted_answers', 'solution_steps', 'premises', 'option_rationales']) if (Array.isArray(q[k])) q[k] = (q[k] as unknown[]).map(v => typeof v === 'string' ? repairLatex(v) : v)
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
    // Canlı bulgu (30.10.2026, ITB101 ders kaynağı): model soru metnine
    // şablonu yazdı ("Qd = {a} - {b}*P"), öğrenci yer tutucuları gördü.
    // Değişkenlerle doldurulur; dolmayan yer tutucu varsa soru atılır.
    const phs = [...String(q.question).matchAll(CALC_PH)].map(m => m[1])
    if (phs.length) {
      const vars = sanitizeVariables(q.variables)
      if (phs.some(n => !Object.prototype.hasOwnProperty.call(vars, n))) return { ok: false, reason: 'calc_placeholder' }
      if (typeof q.template !== 'string' || !q.template.trim()) q.template = q.question
      q.question = fillCalcPlaceholders(String(q.question), vars, language)
    }
    // FAZ 3a: cevabı kod hesaplar; formül yoksa, hesaplanamıyorsa ya da
    // modelin cevabıyla çelişiyorsa soru atılır.
    const check = verifyCalculation(q)
    if (!check.ok) {
      const n = answerNumber(q.correct_answer)
      if (!allowUnverifiedCalc || check.reason === 'calc_mismatch' || !Number.isFinite(n)) return { ok: false, reason: check.reason }
      // Canlı test (28.10.2026): "denge fiyatı ve miktarı" soran soruda
      // cevap 4, kendi çözüm adımları ise Q*=3, P*=5 diyordu. Doğrulanamayan
      // soruda cevap, son çözüm adımındaki sayılardan biri değilse soru atılır.
      if (!unverifiedAnswerConsistent(q.solution_steps, n)) return { ok: false, reason: 'calc_unverified_inconsistent' }
      q.correct_answer = n
      for (const k of ['variables', 'formula', 'template', 'common_errors', 'verified']) delete q[k]
    }
  } else if (type === 'expression') {
    // FAZ 3b: referans ifade kodla açılır ve örnek noktalarda hesaplanabilir
    // olmalı; istenen biçime kendisi uymalı.
    const check = verifyExpression(q)
    if (!check.ok) return { ok: false, reason: check.reason }
  } else if (type === 'graph') {
    // FAZ 4b: ızgara ve cevap kodla hesaplanır; ızgaraya oturmayan atılır.
    const check = verifyGraph(q, language)
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

const GROQ_RETRY_MAX_WAIT_MS = 45_000
// Canlı test (30.10.2026, ITB101): tamamlama isteği dakikalık token sınırına
// takıldı ("Used 7997, Requested 6429"), beklenecek süre 45 sn'yi aştı ve
// 4 soruluk sınav 1 soruyla geldi. Groq sınırı model başınadır: büyük model
// doluysa ve kısa beklemeyle açılmayacaksa küçük modele geçilir (çıktısı
// yine aynı doğrulamadan geçer).
const GROQ_PRIMARY_MODEL = 'openai/gpt-oss-120b'
const GROQ_FALLBACK_MODEL = 'openai/gpt-oss-20b'
const GROQ_SHORT_WAIT_MS = 10_000
/** Groq hatasında ne yapılacak: beklemek, yedek modele geçmek ya da vazgeçmek. */
function groqFailurePlan(status: number, waitMs: number | null, model: string, attempt: number): 'wait' | 'fallback' | 'fail' {
  if (status === 429 && model === GROQ_PRIMARY_MODEL && (waitMs === null || waitMs > GROQ_SHORT_WAIT_MS || attempt >= GEN_MAX_RETRIES)) return 'fallback'
  if (waitMs !== null && attempt < GEN_MAX_RETRIES) return 'wait'
  return 'fail'
}
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
// FAZ 4b: çizim sorusu ızgara ve cevap tanımı da yazıyor (yaklaşık beşte bir soru).
const GEN_TOKENS_GRAPH_EXTRA = 60
// Groq dakikalık token sınırı (istem + ayrılan çıktı birlikte sayılır) ve
// kısma sonrası en az bırakılacak çıktı bütçesi.
const GROQ_TPM_LIMIT = 8000
const GEN_TOKENS_FLOOR = 1000
// Üçüncü üretim isteği yalnızca istek bu süreden önceyse (Groq beklemesi en
// çok 45 sn; Supabase işlev sınırı 150 sn).
const THIRD_CALL_DEADLINE_MS = 60000

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
        const chunk = text.slice(objStart, i + 1)
        try { out.push(JSON.parse(chunk)) } catch (_e) {
          try { out.push(JSON.parse(fixJsonEscapes(chunk))) } catch (_e2) { /* bozuk nesne: atla */ }
        }
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
/* BUYUK "I" KELIMEYI IKIYE BOLUYORDU (24.10.2026).
 *
 * JavaScript'te 'İ'.toLowerCase() iki kod birimi uretiyor: 'i' + U+0307
 * (birlesen ustteki nokta). U+0307 bir birlesme isareti oldugu icin
 * \p{L} ve \p{N} kumelerine girmiyor, dolayisiyla asagidaki noktalama
 * temizligi onu BOSLUGA cevirip kelimeyi ikiye boluyordu. Olculdu:
 *
 *   gateNormalize('İşsizlik Oranı') -> "i şsizlik oranı"
 *   anchorTerms('İstatistik')       -> ["statistik"]   (bastaki 'i' 4
 *                                      harf esigine takilip dusuyor)
 *   anchorTerms('istatistik')       -> ["istatistik"]
 *
 * Sonuc: model terimi baslik bicimiyle (İ ile), kaynak cumle icinde kucuk
 * harfle yazdiginda — ya da tersi — grounding kapisi terimi "uydurma"
 * sayip siliyor, atif eslemesi de sayfa capasini kaybediyordu. Turkce bir
 * urunde bu, kaynakta BIREBIR gecen icerigi silmek demek.
 *
 * Duzeltme once NFC ile birlestirip sonra kalan birlesen noktayi atiyor,
 * yani 'İ' -> 'i'. Eslesme orani yalnizca YUKARI gidebilir: hicbir yeni
 * eslesme uydurma bir terimi geciremez, cunku iki taraf da ayni
 * fonksiyondan geciyor. Bu yuzden esiklerin kalibrasyonu degismiyor. */
function trNormalize(s: string): string {
  return String(s == null ? '' : s).normalize('NFC').toLowerCase().replace(/̇/g, '')
}

/* ONDALIK SAYI KORLUGU (25.10.2026).
 *
 * Noktalama temizligi "9.3"u "9" ve "3"e boluyordu, ikisi de 4 harf
 * esigine takilip dusuyordu: "%9.3", "0.21", "1,96" gibi degerler hicbir
 * karsilastirmaya girmiyordu. Bir ekonometri destesinde iddiayi sayfasina
 * baglayan en ayirt edici sey cogu zaman tam olarak bu sayi; kosu 37'de
 * atifsiz kalan madde sayisi 8-16 idi.
 *
 * Artik ondalik sayi TEK terim ("9,3" -> "9.3"; Turkce virgul de ayni
 * terime iner). Kisa tamsayilar hala disarida: "3", "20" sayfa ve madde
 * numarasi gurultusu. 4+ haneli tamsayilar (1982) zaten geciyordu.
 *
 * Kesinlik yonu: belgede bulunan bir ondalik dogru sayfaya agirlik ekler
 * (idf'i yuksek, ayirt edici); belgede HIC bulunmayan bir ondalik
 * (modelin hesapladigi bir deger) iddianin toplam agirligini buyutup
 * skoru DUSURUR — yani yeni bir yanlis atif uretemez, ancak atifi daha
 * temkinli yapar ("yanlis atif, eksik atiftan kotudur"). */
/* UC HARFLI MATEMATIK ADLARI ELENIYORDU (30.10.2026 olcumu).
 *
 * "Week 8 Derivative" kartinda bes madde atifsiz kaldi. Ikisinin sebebi
 * esik DEGIL, terim cikarimiydi:
 *   "The derivative of sin x is cos x."     -> cikan terim: derivative
 *   "The derivative of tan x is sec^2 x."   -> cikan terim: derivative, sec²
 * Yani cumlenin en bilgilendirici sozcukleri (sin, cos, tan) kayboluyor ve
 * geriye tek terim kaliyor; ANCHOR_MIN_TERMS (3) kapisi maddeyi dusuruyor.
 * Sebep asagidaki uzunluk suzgeci: trigonometrik ve logaritmik fonksiyon
 * adlari TAM UC HARF.
 *
 * Esigi dusurmek cozum degildi, olculdu: "When f'(x) > 0, the function f is
 * increasing." maddesinde terimler (function, increasing) hicbir sayfada
 * BIRLIKTE gecmiyor, yani eslesen terim sayisi her halde 1 — taban 2'ye
 * inse de baglanmaz. O madde kaynakta tamamen NOTASYONLA yazili
 * ("f'(x) > 0 → f is increasing") ve sozcuk duzeyinde eslesmenin
 * ulasamayacagi yerde; bilerek atifsiz kaliyor.
 *
 * Kisa ad listesi BELGEYE OZGU DEGIL: evrensel matematik gosterimi. Hicbiri
 * ANCHOR_STOPWORDS'te degil (kontrol edildi). "sec"/"min"/"var" gunluk
 * dilde baska anlam tasiyor ama bu listenin acildigi yer ders metni; iki
 * teknik anlam arasindaki karisma kabul, bilgiyi tamamen atmak degil.
 *
 * UST SIMGE SOYULUYOR: "sec²" tek jeton olarak geliyordu ve kaynaktaki
 * "sec" ile eslesmiyordu. Sondaki ust simge rakamlari atilinca hem listeye
 * giriyor hem kaynagi buluyor. */
const ANCHOR_KISA_MATEMATIK = new Set([
  // trigonometri
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  // logaritma / us
  'log', 'exp',
  // limit ve ucdegerler
  'lim', 'max', 'min',
  // dogrusal cebir ve istatistik
  'det', 'dim', 'var', 'cov'
])

/** Sondaki ust simge rakamlari: "sec²" -> "sec", "x³" -> "x". */
const ANCHOR_UST_SIMGE = /[\u00b2\u00b3\u00b9\u2070\u2074-\u2079]+$/

function anchorTerms(s: string): string[] {
  const parcalar = trNormalize(s).match(/\d+(?:[.,]\d+)+|[\p{L}\p{N}]+/gu) || []
  return parcalar
    .map(w => /^\d+(?:[.,]\d+)+$/.test(w) ? w.replace(/,/g, '.') : w.replace(ANCHOR_UST_SIMGE, ''))
    .filter(w =>
      (w.length >= 4 || /^\d+\.\d+/.test(w) || ANCHOR_KISA_MATEMATIK.has(w)) &&
      !ANCHOR_STOPWORDS.has(w))
}

type PageSegment = { page: number; terms: Set<string>; head: string; body: string; termsTekil?: Set<string> }

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

/* ALINTI OCR COPUYLE BIRLIKTE GELIYORDU (30.10.2026 olcumu).
 *
 * "Week 8 Derivative" kartinin kaynakcasinda 12 referansin 9'u bu haldeydi:
 *   [4] （ょり＝なな、 -62-3-32-1/2 Key idea Power rule: the exponent moves
 *       down, then decreases by one.
 *   [5] + 1) = 9x2 - 10x + 3 g' (x) = 3x2 sin x + ... ANSWER Key idea A
 *       product-rule derivative has two terms before simplification.
 * Ogrenci atifa bakinca kaynagin ne dedigini degil OCR'in artigini goruyor.
 *
 * SEBEP: kaynak metinde cop ile temiz cumle AYRI SATIRLARDA.
 *   （ょり＝なな、
 *   -62-3-32-1/2
 *   Key idea
 *   Power rule: the exponent moves down, then
 *   decreases by one.
 * Ama splitSentences ilk isi olarak \s+ -> bosluk yapiyor, yani satir
 * sonlarini SILIYOR ve noktalama tasimayan OCR satirlari tek bir "cumle"
 * halinde birlesiyor. Yani kusur alinti secmede degil, aday uretmede.
 *
 * COZUM: satirlari once METNE GORE birlestir, sonra cumlelere bol. Bir satir
 * sonu SARMA sayilir (birlestirilir) ancak onceki satir cumle noktalamasiyla
 * bitmiyorsa VE sonraki satir kucuk harfle basliyorsa (ya da onceki satir
 * tire ile bolunmusse). Aksi halde sinirdir.
 *
 * OLCUM: 9 bozuk referansin 9'u temiz kaynak cumlesine dondu ve sarmalanmis
 * cumleler dogru birlesti ("...the exponent moves down, then" + "decreases
 * by one." ; "Critical candidates occur where f'(x)=0 or f'(x)" + "is
 * undefined, as long as the original function is" + "defined there.").
 *
 * BILINEN SINIR, BILEREK KABUL: devami BUYUK harfle baslayan bir sarma
 * yanlis bolunur. Iki gercek belgede olculdu — ders kitabindaki
 * "...included in the U.S. ________ and in the" / "Japanese ________." ve
 * slayttaki "...with Respect to The Nature of The" / "Transaction". Ikisi de
 * BASLIK/bosluk-doldurma satiri, yani zaten zayif alinti adaylari:
 * bestQuoteForClaim en az 2 eslesen terim ve 0,3 skor istiyor, eksik parca
 * tam cumleye kaybeder.
 *
 * DENENEN ALTERNATIF REDDEDILDI: "onceki satir uzun ve harf agirlikliysa
 * sarmadir" kurali olculdu; basligi duzeltiyor ama iki AYRI basligi
 * ("...known as TRADE RECEIVABLES" + "Receivables and Types of Receivables")
 * birlestiriyor ve bosluk-doldurma satirini alt cizgiler harf oranini
 * dusurdugu icin yine kaciriyor. Bir hata sinifini baskasiyla takas ediyor,
 * net kazanc yok. */
function alintiBloklari(body: string): string[] {
  const satirlar = String(body || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  const out: string[] = []
  for (const satir of satirlar) {
    if (out.length === 0) { out.push(satir); continue }
    const onceki = out[out.length - 1]
    const noktalamaylaBitti = /[.!?\u2026:]$/.test(onceki)
    const tireyleBolundu = /[-\u2010-\u2015]$/.test(onceki)
    const kucukBasliyor = /^[a-z\u00e0-\u00f6\u00f8-\u00ff\u011f\u015f\u0131\u00f6\u00e7\u00fc]/.test(satir)
    if (tireyleBolundu) {
      out[out.length - 1] = onceki.replace(/[-\u2010-\u2015]$/, '') + satir
    } else if (!noktalamaylaBitti && kucukBasliyor) {
      out[out.length - 1] = onceki + ' ' + satir
    } else {
      out.push(satir)
    }
  }
  return out
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
function bestQuoteForClaim(claim: string, body: string, idf: Map<string, number>, tekil = false): string | null {
  const claimTerms = [...new Set(anchorTerms(claim))]
  if (!claimTerms.length) return null
  const fallbackIdf = Math.log(2)
  /* AGIRLIK ESLESEN BICIMDEN OKUNUR. idf tablosu sayfa terimlerinden
     kurulu, yani TEKIL bicimi tasiyor; "products" ile eslesen sey
     "product". Agirligi cogul bicimle aramak `?? 0` dondurup eslesmeyi
     skora HIC yansitmiyordu (olculdu: eslesen terim sayisi artti, skor
     ayni kaldi, madde yine atifsiz). */
  const agirlik = (t: string) => idf.get(t) ?? (tekil ? idf.get(ingTekil(t)) : undefined) ?? fallbackIdf
  const totalWeight = claimTerms.reduce((a, t) => a + agirlik(t), 0)
  if (totalWeight <= 0) return null

  let best: { text: string; score: number; siralama: number } | null = null
  /* Adaylar SATIR YAPISINA saygi gostererek uretiliyor — bkz.
     alintiBloklari yanindaki olcum notu. Dogrudan splitSentences(body)
     cagrilirsa OCR'in cop satirlari temiz cumleye yapisik geliyor. */
  const adaylar = alintiBloklari(body).flatMap((blok) => splitSentences(blok))
  for (const raw of adaylar) {
    if (raw.length < QUOTE_MIN_CHARS) continue
    const hamTerms = new Set(anchorTerms(raw))
    if (!hamTerms.size) continue
    // Cogul eki — bkz. ingTekil. Yalnizca Ingilizce kartta aciliyor.
    const sentTerms = tekil ? tekilKume(hamTerms) : hamTerms
    let w = 0, matched = 0
    for (const t of claimTerms) {
      if (sentTerms.has(t) || (tekil && sentTerms.has(ingTekil(t)))) { w += agirlik(t); matched++ }
    }
    if (matched < 2) continue
    // Normalising by the claim's own weight (not the sentence's) keeps a long
    // rambling sentence from winning just by containing more words.
    const score = w / totalWeight
    /* IDDIAYI TASIYAN CUMLE SIRALAMADA GERIDEYDI (31.10.2026 olcumu).
     *
     * "IPPT Dummy" kartinin [14] atfi:
     *   madde  : "...neither regional dummy variable is statistically
     *             different from South America at the 10% level."
     *   alinti : "The Europe dummy variable coefficient is interpreted as
     *             'on average energy consumption per capita is 9.3% lower
     *             in Europe than South America.'"
     * Sayfa DOGRUYDU (s. 42) ve o sayfada iddiayi birebir tasiyan cumle de
     * vardi: "Neither of these are statistically significant at the 10%
     * level." Ama siralama yalnizca KAPSAMAYA (iddianin kelime
     * dagarciginin ne kadarini aciklıyor) bakiyordu ve dogru cumle KISA
     * oldugu icin kapsamada one cikmiyordu. Olculen uc aday:
     *   kapsama  kesinlik  dice
     *   0,229    0,323     0,268   "...9.3% lower in Europe..."
     *   0,229    0,380     0,286   "...41.5% higher in North America..."
     *   0,260    0,872     0,400   "Neither of these are statistically..."
     * Kesinlik (cumlenin KENDI iceriginin ne kadari iddiaya ait) ikisini
     * acik ara ayiriyor: 0,872'ye 0,32. Iddianin ad obeklerini yankilayan
     * uzun cumle yuksek kapsama aliyor, iddianin HUKMUNU soyleyen kisa
     * cumle ise yuksek kesinlik.
     *
     * KESINLIK TEK BASINA KULLANILMIYOR: olculen "America as the omitted
     * group" parcasi kesinlik 1,000 aliyor ama kapsamasi 0,114 — kotu bir
     * alinti. Dice ikisini dengeleyip dogru cumleyi birinci yapiyor
     * (0,400'e 0,286).
     *
     * KAPI DEGISMEDI, yalnizca SIRALAMA: asagidaki esik hala KAPSAMAYA
     * bakiyor (best.score < 0.3). Yani hangi iddianin alinti alacagi
     * aynen eskisi gibi; degisen, ayni sayfadaki adaylar arasindan
     * hangisinin gosterildigi. Boylece kotu bir alintiyi iyisiyle
     * degistiriyor, yeni alinti URETMIYOR. */
    const kendiAgirligi = [...hamTerms].reduce((a, t) => a + agirlik(t), 0)
    const kesinlik = kendiAgirligi > 0 ? w / kendiAgirligi : 0
    const siralama = (score + kesinlik) > 0 ? (2 * score * kesinlik) / (score + kesinlik) : 0
    if (!best || siralama > best.siralama) best = { text: raw, score, siralama }
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
/* COGUL EKI ATIFI OLDURUYORDU (30.10.2026 olcumu).
 *
 * "Week 8 Derivative" kartinda iki madde atifsiz kaldi
 * ("Citation anchoring: ... unanchored=2"). Bunlardan birinin kaynaktaki
 * karsiligi NEREDEYSE BIREBIR:
 *   madde  : "Decision mapping classifies expressions into sums, products,
 *             quotients, or composites before differentiation."
 *   sayfa 23: "Classify the expression first: sum, product, quotient, or
 *             composite form."
 * Ama olculen eslesme 10 terimden 1: yalnizca "decision". Geri kalan ALTI
 * kavram Ingilizce cekim ekinde kayboluyor — classifies/classify,
 * expressions/expression, sums/sum, products/product, quotients/quotient,
 * composites/composite.
 *
 * NEDEN nearDupStem KULLANILMIYOR: o 5 karakterlik sabit onek kesiyor ve
 * yalnizca KOPYA TESPITI icin guvenli (bkz. NEAR_DUP_STEM_LEN notu). Atifta
 * yanlis eslesme ogrenciyi YANLIS SAYFAYA gonderir, bu yuzden burada tek
 * tek sayilan ve geri cevrilebilir bir cogul kurali var, onek kesme yok.
 *
 * YALNIZCA INGILIZCE, BILEREK. Turkce cogul -lar/-ler'dir; Ingilizce -s
 * kurali Turkceye uygulandiginda olculen zarar gercek: "kurs" -> "kur",
 * "ders" -> "der", "ters" -> "ter". "kur" BASKA bir Turkce sozcuk (dovizin
 * kuru), yani ayni belgede ikisi varsa atif yanlis sayfayi gosterir. Bu
 * yuzden kapi dile bagli: lang === 'en' disinda eslesme BUGUNKUYLE BIREBIR
 * ayni kaliyor.
 *
 * Tuzaklar elenmis: ss/us/is/os ile bitenlere dokunulmuyor (class, focus,
 * analysis, chaos), ingilizce harf disi karakter tasiyan sozcuge
 * dokunulmuyor, 4 karakterden kisa sozcuge dokunulmuyor. */
function ingTekil(term: string): string {
  const t = String(term || '')
  if (t.length < 4) return t
  if (/[^a-z]/.test(t)) return t
  if (/(ss|us|is|os)$/.test(t)) return t
  if (/ies$/.test(t) && t.length > 4) return t.slice(0, -3) + 'y'
  if (/(ch|sh|s|x|z)es$/.test(t)) return t.slice(0, -2)
  if (/s$/.test(t)) return t.slice(0, -1)
  return t
}

/** Kumenin tekil karsiligi. Ozgun bicim de kalir: eslesme kaybedilmez. */
function tekilKume(terms: Set<string>): Set<string> {
  const out = new Set<string>()
  for (const t of terms) { out.add(t); out.add(ingTekil(t)) }
  return out
}

const ANCHOR_MIN_SCORE = 0.42   // share of the claim's weighted vocabulary found on the page
const ANCHOR_MIN_TERMS = 3      // distinct matched content terms

/**
 * Best page for a single claim, or null when no page matches it well enough.
 * Score = matched idf weight / total idf weight of the claim's own terms.
 */
function anchorClaimToPage(
  claim: string,
  pageIndex: PageSegment[],
  idf: Map<string, number>,
  tekil = false
): { page: number; score: number; matched: number; head: string; quote: string | null } | null {
  if (!pageIndex.length) return null
  const terms = [...new Set(anchorTerms(claim))]
  if (terms.length === 0) return null
  // Agirlik ESLESEN bicimden okunur — bkz. bestQuoteForClaim icindeki not.
  const agirlik = (t: string) =>
    idf.get(t) ?? (tekil ? idf.get(ingTekil(t)) : undefined) ?? Math.log(pageIndex.length + 1)
  const totalWeight = terms.reduce((a, t) => a + agirlik(t), 0)
  if (totalWeight <= 0) return null

  let best: { seg: PageSegment; score: number; matched: number } | null = null
  for (const seg of pageIndex) {
    /* Cogul eki — bkz. ingTekil. Tekil kume sayfa basina BIR KEZ uretilip
       segmentte saklaniyor: her madde icin yeniden kurmak 24 sayfa x 14
       madde demekti. */
    let kume = seg.terms
    if (tekil) {
      if (!seg.termsTekil) seg.termsTekil = tekilKume(seg.terms)
      kume = seg.termsTekil
    }
    let w = 0, matched = 0
    for (const t of terms) {
      if (kume.has(t) || (tekil && kume.has(ingTekil(t)))) { w += agirlik(t); matched++ }
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
    quote: bestQuoteForClaim(claim, best.seg.body, idf, tekil)
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

// ==========================================================================
// FAZ 7 — SINAVDA ADIM ADIM YARDIM (29.10.2026)
//
// Alıştırma sınavında (simülasyon değil) öğrenci bir soruda "adım adım çöz"
// der; soru 2–4 küçük adıma bölünür, her adımın cevabı SUNUCUDA denetlenir
// (adım cevapları tarayıcıya gitmez; exam_answer_keys.keys[id].help_plan).
//   - Kodla doğrulanmış hesap sorusu ('calc'): model yalnızca ara büyüklüğün
//     İFADESİNİ yazar (değişken adlarıyla); değeri evaluateExpression hesaplar.
//     Son adım her zaman sorunun kendi cevabı (formülden). Yanlış adımda ipucu
//     ifadenin kendisi.
//   - Öteki sorular ('guide'): model 2–3 yönlendirici çoktan seçmeli soru
//     yazar; son cevabı ele veren adım atılır.
//   - Yanlışta bir deneme daha; ikinci yanlışta adımın cevabı gösterilir.
// Puan (kullanıcı kararı, MyLab "Help Me Solve This" gibi):
//   - Şablonlu hesap sorusu ('variant'): yardım bitince soru YENİ SAYILARLA
//     gelir; yeni hali çözülürse tam puan. Yeni sayılar yardım başlarken
//     hesaplanır, yardım kapanınca soruya yazılır.
//   - Ötekiler ('cap'): soru aynı kalır, en çok HELP_CAP puan.
//   - Yardım açılıp yeni sayılar yazılmadan teslim edilirse de tavan uygulanır.
// İz: exams.questions[i].help = { mode, status } (yalnızca sunucu yazar;
// questions alanı exams_guard_grading_fields ile kilitli). Migration yok.
//
// makeVariant ve yardımcıları js/exam-engine.js'ten BİREBİR kopya;
// tests/exam-help.js iki kopyayı aynı rastgele sayılarla karşılaştırır.
// ==========================================================================

const TEMPLATE_PH = /\{([A-Za-z_][A-Za-z0-9_]*)(?:([*/])(-?\d+(?:\.\d+)?))?\}/g

function formatNumber(n: number, lang: string): string {
  return Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 6 })
}

/** Ad → gösterim çarpanı (görünen = değişken × çarpan). */
function templateMultipliers(template: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of String(template || '').matchAll(TEMPLATE_PH)) {
    const n = Number(m[3])
    if (m[2] && Number.isFinite(n) && n !== 0) out[m[1]] = m[2] === '*' ? n : 1 / n
  }
  return out
}

function tidy(n: number): number { return Number(Number(n).toPrecision(12)) }

/** Şablondaki yer tutucuları sayılarla doldurur. */
function renderTemplate(template: unknown, vars: Record<string, number>, lang: string): string {
  return String(template || '').replace(TEMPLATE_PH, (m, k, op, num) => {
    if (!Object.prototype.hasOwnProperty.call(vars, k)) return m
    const n = Number(num)
    const shown = op && Number.isFinite(n) && n !== 0 ? (op === '*' ? vars[k] * n : vars[k] / n) : vars[k]
    return formatNumber(tidy(shown), lang)
  })
}

function decimalsOf(n: number): number {
  const str = String(n)
  if (/e/i.test(str)) return 6
  const i = str.indexOf('.')
  return i < 0 ? 0 : Math.min(6, str.length - i - 1)
}

function significantDigits(n: number): number {
  const digits = String(Math.abs(n)).replace(/e.*$/i, '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '')
  return Math.max(1, digits.length)
}

/** Aynı formülle yeni sayılar: her değişken %60–%140 arasında, ondalık
 *  basamağı ve işareti korunarak değişir; cevap formülden hesaplanır.
 *  Üretilemezse null. rand testte sabitlenebilsin diye parametre. */
function makeVariant(practice: Record<string, unknown>, lang: string, rand?: () => number): { text: string; variables: Record<string, number>; answer: number } | null {
  const rnd = typeof rand === 'function' ? rand : Math.random
  if (!practice || typeof practice.template !== 'string' || !practice.formula) return null
  const base = sanitizeVariables(practice.variables)
  const names = Object.keys(base)
  if (!names.length) return null
  const mult = templateMultipliers(practice.template)
  for (let attempt = 0; attempt < 20; attempt++) {
    const vars: Record<string, number> = {}
    names.forEach(k => {
      const mk = mult[k] || 1
      const v = mk === 1 ? base[k] : tidy(base[k] * mk), d = decimalsOf(v), f = Math.pow(10, d)
      let nv = v === 0 ? 0 : Number((v * (0.6 + rnd() * 0.8)).toPrecision(Math.max(2, significantDigits(v))))
      nv = Math.round(nv * f) / f
      if (v !== 0 && nv === 0) nv = d > 0 ? Math.sign(v) / f : Math.sign(v)
      vars[k] = mk === 1 ? nv : tidy(nv / mk)
    })
    if (names.every(k => vars[k] === base[k])) continue
    const answer = evaluateExpression(practice.formula, vars)
    if (!Number.isFinite(answer)) continue
    return { text: renderTemplate(practice.template, vars, lang), variables: vars, answer: Math.round(answer * 1e4) / 1e4 }
  }
  return null
}

// ---- (kopya bloğun sonu) ----

const HELP_CAP = 50
const HELP_TRIES = 2
const HELP_MAX_STEPS = 4
const HELP_PROMPT_MAX = 220
const HELP_EXPLAIN_MAX = 240

type HelpStep = { kind: 'number' | 'choice'; prompt: string; answer: number; options?: string[]; unit?: string; hint?: string; explain?: string }
type HelpPlan = { kind: 'calc' | 'guide'; mode: 'variant' | 'cap'; steps: HelpStep[]; cur: number; tries: number; log: Array<{ n: number; ok: boolean; revealed?: boolean }>; variant?: { text: string; variables: Record<string, number>; answer: number } | null; closed?: boolean }

/** Kodla doğrulanmış hesap sorusu mu (formül + değişken + doğrulanmış cevap). */
function helpIsCalc(q: Record<string, unknown>): boolean {
  if (q.type !== 'calculation' || q.chart) return false
  const vars = sanitizeVariables(q.variables)
  if (!Object.keys(vars).length || typeof q.formula !== 'string' || !q.formula.trim()) return false
  const v = evaluateExpression(q.formula, vars)
  const ans = answerNumber(q.correct_answer)
  return Number.isFinite(v) && Number.isFinite(ans) && withinTolerance(v, ans, 0.5)
}

/** İfadedeki değişken adlarını değerleriyle yazar ("r / 12" → "(5) / 12"). */
function helpInlineExpr(expr: string, vars: Record<string, number>, lang: string): string {
  let s = expr
  for (const k of Object.keys(vars).sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp(`(^|[^A-Za-z0-9_])${k}(?![A-Za-z0-9_(])`, 'g'), (_m, pre) => `${pre}${formatNumber(tidy(vars[k]), lang)}`)
  }
  return s.replace(/\*/g, '×')
}

function helpRound(n: number): number { return Math.round(n * 1e6) / 1e6 }

/** Canlı test (30.10.2026): model adım metnine "annual_rate/100/12" gibi ham
 *  değişken adı yazdı. Uzun (3+ harf ya da alt çizgili) adlar sorudaki
 *  değeriyle değiştirilir; "r", "n" gibi kısa etiketler kalır. */
function helpHumanize(text: string, vars: Record<string, number>, lang: string): string {
  let s = text
  for (const k of Object.keys(vars).sort((a, b) => b.length - a.length)) {
    if (k.length < 3 && !k.includes('_')) continue
    // alt çizgisiz ad Türkçe bir kelime de olabilir ("kar"): yalnızca bir işlem işaretinin yanındaysa
    const op = /[=+\-*/^()×÷]/
    s = s.replace(new RegExp(`(^|[^A-Za-z0-9_])${k}(?![A-Za-z0-9_])`, 'g'), (m, pre, at, all) => {
      const before = all.slice(0, at + pre.length).trimEnd().slice(-1), after = all.slice(at + m.length).trimStart().charAt(0)
      return k.includes('_') || op.test(before) || op.test(after) ? `${pre}${formatNumber(tidy(vars[k]), lang)}` : m
    })
  }
  return s.replace(/\*/g, '×')
}

function helpText(v: unknown, max: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Modelin hesap adımları → kodla hesaplanmış adımlar. Son adım her zaman
 *  sorunun cevabı. En az 2 adım çıkmazsa null (öğretici yol denenir). */
function normalizeCalcSteps(raw: unknown, q: Record<string, unknown>, lang: string): HelpStep[] | null {
  const vars = sanitizeVariables(q.variables)
  const answer = answerNumber(q.correct_answer)
  if (!Number.isFinite(answer)) return null
  const list = Array.isArray(raw) ? raw : []
  const steps: HelpStep[] = []
  const seen: number[] = []
  const unitOf = (u: unknown) => helpText(u, 16)
  for (const it of list) {
    if (steps.length >= HELP_MAX_STEPS - 1) break
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const expr = String(o.expr ?? '').trim()
    const prompt = helpHumanize(helpText(o.prompt, HELP_PROMPT_MAX), vars, lang)
    if (!expr || !prompt || expr.length > EXPR_MAX_LENGTH) continue
    const v = evaluateExpression(expr, vars)
    if (!Number.isFinite(v)) continue
    // girdiyi aynen soran (tek değişken ya da sabit) ve tekrar eden adım atılır
    if (Object.keys(vars).some(k => sameNumber(vars[k], v)) || /^[\d.\s]+$/.test(expr)) continue
    if (seen.some(x => sameNumber(x, v)) || withinTolerance(v, answer, 0.1)) continue
    seen.push(v)
    steps.push({ kind: 'number', prompt, answer: helpRound(v), unit: unitOf(o.unit), hint: helpInlineExpr(expr, vars, lang), explain: `${helpInlineExpr(expr, vars, lang)} = ${formatNumber(helpRound(v), lang)}` })
  }
  if (!steps.length) return null
  const formula = String(q.formula)
  steps.push({
    kind: 'number',
    prompt: lang === 'en' ? 'Last step: now compute the answer to the question.' : 'Son adım: şimdi sorunun cevabını hesapla.',
    answer: helpRound(answer),
    unit: unitOf(q.units),
    hint: helpInlineExpr(formula, vars, lang),
    explain: `${helpInlineExpr(formula, vars, lang)} = ${formatNumber(helpRound(answer), lang)}`
  })
  return steps
}

/** Cevabı ele veren metin mi (yönlendirici adımlarda yasak). */
function helpLeaksAnswer(text: string, q: Record<string, unknown>): boolean {
  const t = normalizeAnswerText(text)
  if (!t) return false
  const answers = [q.correct_answer, ...(Array.isArray(q.accepted_answers) ? q.accepted_answers : [])]
    .map(a => normalizeAnswerText(a)).filter(a => a.length >= 2)
  if (q.type === 'true_false' || q.type === 'open_ended') return false
  if (q.type === 'calculation') {
    const n = answerNumber(q.correct_answer)
    if (Number.isFinite(n)) return (String(text).match(/-?\d+(?:[.,]\d+)*/g) || []).some(tok => numberReadings(tok).some(x => withinTolerance(x, n, 0.5)))
  }
  return answers.some(a => t === a || (a.length >= 4 && t.includes(a)))
}

/** Modelin yönlendirici soruları → 2–3 doğrulanmış çoktan seçmeli adım. */
function normalizeGuideSteps(raw: unknown, q: Record<string, unknown>, rand: () => number = Math.random): HelpStep[] | null {
  const list = Array.isArray(raw) ? raw : []
  const steps: HelpStep[] = []
  for (const it of list) {
    if (steps.length >= 3) break
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const prompt = helpText(o.prompt, HELP_PROMPT_MAX)
    const opts = (Array.isArray(o.options) ? o.options : []).map(x => helpText(x, 120)).filter(Boolean)
    const ai = Number(o.answer_index)
    if (!prompt || opts.length < 2 || opts.length > 4 || !Number.isInteger(ai) || ai < 0 || ai >= opts.length) continue
    if (new Set(opts.map(x => normalizeAnswerText(x))).size !== opts.length) continue
    if (helpLeaksAnswer(prompt, q) || opts.some(x => helpLeaksAnswer(x, q))) continue
    const correct = opts[ai]
    const shuffled = shuffleInPlace([...opts], rand)
    steps.push({ kind: 'choice', prompt, options: shuffled, answer: shuffled.indexOf(correct), hint: helpText(o.hint, HELP_EXPLAIN_MAX) || undefined, explain: helpText(o.explain, HELP_EXPLAIN_MAX) || undefined })
  }
  return steps.length >= 2 ? steps : null
}

/** Adım cevabı doğru mu. Sayıda %1 pay (1'den büyük sayıda en az 0,005); "%5" ile "0,05" gibi
 *  okunuşların hepsi denenir. Seçmede şık sırası. */
function checkHelpStep(step: HelpStep, input: unknown): boolean {
  if (step.kind === 'choice') return Number(input) === step.answer
  const raw = String(input ?? '').trim()
  if (!raw || !/\d/.test(raw)) return false
  const cands = [answerNumber(raw), ...numberReadings(raw.replace(/^.*[=≈]/, '').replace(/[^\d.,\-+eE]/g, ''))]
  if (/%/.test(raw)) cands.push(...cands.map(x => x / 100))
  return cands.some(x => Number.isFinite(x) && (withinTolerance(x, step.answer, 1) || (Math.abs(step.answer) >= 1 && Math.abs(x - step.answer) <= 0.005)))
}

/** Tarayıcıya giden adım: cevap ve ipucu yok. */
function publicHelpStep(plan: HelpPlan): Record<string, unknown> | null {
  const s = plan.steps[plan.cur]
  if (!s) return null
  return { n: plan.cur, total: plan.steps.length, kind: s.kind, prompt: s.prompt, ...(s.options ? { options: s.options } : {}), ...(s.unit ? { unit: s.unit } : {}), tries_left: HELP_TRIES - plan.tries }
}

function helpShownAnswer(s: HelpStep, lang: string): string {
  return s.kind === 'choice' ? String((s.options || [])[s.answer] ?? '') : formatNumber(s.answer, lang) + (s.unit ? ' ' + s.unit : '')
}

/** Adım cevabını işler; planı (kopya olarak) ve yanıtı döndürür. */
function advanceHelp(planIn: HelpPlan, n: number, input: unknown, lang: string): { plan: HelpPlan; reply: Record<string, unknown> } {
  const plan: HelpPlan = { ...planIn, log: [...(planIn.log || [])] }
  const s = plan.steps[plan.cur]
  if (!s || n !== plan.cur) return { plan, reply: { error: 'step_mismatch', step: publicHelpStep(plan) } }
  const ok = checkHelpStep(s, input)
  if (!ok && plan.tries + 1 < HELP_TRIES) {
    plan.tries += 1
    return { plan, reply: { correct: false, hint: s.hint || (lang === 'en' ? 'Not quite; try once more.' : 'Olmadı; bir kez daha dene.'), step: publicHelpStep(plan) } }
  }
  plan.log.push({ n: plan.cur, ok, ...(ok ? {} : { revealed: true }) })
  plan.cur += 1
  plan.tries = 0
  const next = publicHelpStep(plan)
  return { plan, reply: { correct: ok, revealed: !ok, answer: helpShownAnswer(s, lang), explain: s.explain || '', step: next, done: !next } }
}

/** Yardım bitince öğrenciye özel yeni sayılar: soru metni ve anahtar. Eski
 *  sayılara bağlı alanlar (çözüm adımları, açıklama, tipik hatalar, ipucu,
 *  denklem) atılır; şablon ve formül kalır ("farklı sayılarla" sürer). */
function applyHelpVariant(key: Record<string, unknown>, v: { text: string; variables: Record<string, number>; answer: number }): Record<string, unknown> {
  const out: Record<string, unknown> = { ...key, variables: v.variables, correct_answer: v.answer, varied: true }
  for (const k of ['solution_steps', 'explanation', 'common_errors', 'hint', 'equation', 'step_kind', 'unknown']) delete out[k]
  return out
}

const HELP_SYS_CALC = `
You design step-by-step help for ONE calculation exam question. The user message gives the question, its variables (name = value), the verified formula and the target language.
Break the solution into 1-3 intermediate quantities the student computes BEFORE the final answer (the final answer step is added automatically; do NOT include it).
Return ONLY JSON: {"steps":[{"prompt":"...","expr":"...","unit":"..."}]}
- expr: an arithmetic expression using ONLY the given variable names, numbers, + - * / ^ ( ) and the functions used in the formula. It must evaluate to that intermediate quantity.
- prompt: in the target language, at most 140 characters, names the quantity in words and how it is found using the question's own numbers, e.g. "Aylık faiz oranı (yıllık %8 ÷ 12) kaç?". Never write variable names like annual_rate, and never write the step's numeric result.
- unit: short unit or "".
- Order steps as a student would solve it. Never repeat a given value as a step.
`.trim()

const HELP_SYS_GUIDE = `
You design step-by-step help for ONE exam question. The user message gives the question, its type, the options if any, the correct answer and the target language.
Write 2-3 short multiple-choice guiding questions that walk the student from the key idea to applying it, so they can then answer the original question themselves.
Return ONLY JSON: {"steps":[{"prompt":"...","options":["...","...","..."],"answer_index":0,"hint":"...","explain":"..."}]}
- Everything in the target language. prompt at most 160 characters; 3 options, each at most 80 characters; exactly one correct.
- NEVER state, quote or paraphrase the correct answer of the original question, and no option may be that answer.
- hint: one sentence that nudges without giving the step's answer. explain: one sentence on why the right option is right.
`.trim()

function helpUserPrompt(q: Record<string, unknown>, kind: 'calc' | 'guide', lang: string): string {
  const lines = [`TARGET LANGUAGE: ${lang} (en = English, tr = Turkish)`, `QUESTION TYPE: ${q.type}`, `QUESTION: ${String(q.question ?? '').slice(0, 1500)}`]
  if (kind === 'calc') {
    const vars = sanitizeVariables(q.variables)
    lines.push(`VARIABLES: ${Object.entries(vars).map(([k, v]) => `${k} = ${v}`).join(', ')}`, `FORMULA: ${q.formula}`)
    if (Array.isArray(q.solution_steps) && q.solution_steps.length) lines.push(`MODEL SOLUTION (for reference): ${q.solution_steps.map(s => String(s)).join(' | ').slice(0, 800)}`)
  } else {
    if (Array.isArray(q.options) && q.options.length) lines.push(`OPTIONS: ${JSON.stringify(q.options)}`)
    lines.push(`CORRECT ANSWER (never reveal): ${String(q.correct_answer ?? '').slice(0, 600)}`)
    if (q.explanation) lines.push(`WHY: ${String(q.explanation).slice(0, 600)}`)
  }
  return lines.join('\n')
}

/** Yardım planı için tek model çağrısı (büyük model, kotası dolarsa küçüğü). */
async function requestHelpSteps(system: string, user: string): Promise<unknown[] | null> {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) return null
  for (const model of [GROQ_PRIMARY_MODEL, GROQ_FALLBACK_MODEL]) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0.4, reasoning_effort: 'low', max_completion_tokens: 1400, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { console.warn(`generate-exam yardim: ${model} ${res.status} ${String(data?.error?.message || '').slice(0, 160)}`); continue }
      const parsed = JSON.parse(fixJsonEscapes(String(data.choices?.[0]?.message?.content ?? '{}')))
      if (parsed && Array.isArray(parsed.steps)) return parsed.steps
    } catch (e) {
      console.warn(`generate-exam yardim: ${model} yanit okunamadi`, e)
    }
  }
  return null
}

/** POST { help: { examId, questionId, action: 'info'|'start'|'check'|'finish', step?, answer? } } */
async function handleExamHelp(req: Request, help: Record<string, unknown>): Promise<Response> {
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return out({ error: 'Missing Authorization header' }, 401)
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return out({ error: 'Unauthorized user token' }, 401)
  const action = String(help.action || '')
  if (!['info', 'start', 'check', 'finish'].includes(action)) return out({ error: 'bad_action' }, 400)

  const { data: exam } = await userClient.from('exams').select('*').eq('id', String(help.examId || '')).maybeSingle()
  if (!exam || exam.user_id !== user.id) return out({ error: 'Exam not found or access denied' }, 404)
  const lang = exam.language === 'en' ? 'en' : 'tr'
  const T = (tr: string, en: string) => lang === 'en' ? en : tr
  if (exam.is_simulation) return out({ error: T('Gerçek sınav provasında adım adım yardım yok.', 'Step-by-step help is off in real exam mode.') }, 403)
  if (exam.completed_at) return out({ error: T('Bu sınav zaten teslim edildi.', 'This exam is already submitted.') }, 409)
  const questions = (Array.isArray(exam.questions) ? exam.questions : []) as Record<string, unknown>[]
  const qi = questions.findIndex(x => String(x.id) === String(help.questionId))
  if (qi < 0) return out({ error: 'Question not found inside this exam' }, 404)
  const pubQ = questions[qi]

  const serviceClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: keyRow } = await serviceClient.from('exam_answer_keys').select('keys').eq('exam_id', exam.id).maybeSingle()
  const keys = (keyRow && keyRow.keys && typeof keyRow.keys === 'object' ? keyRow.keys : {}) as Record<string, Record<string, unknown>>
  const key = keys[String(pubQ.id)] || {}
  const q = { ...pubQ, ...key }
  const pubHelp = (pubQ.help && typeof pubQ.help === 'object' ? pubQ.help : null) as Record<string, unknown> | null
  let plan = (key.help_plan && typeof key.help_plan === 'object' ? key.help_plan : null) as HelpPlan | null

  const calc = helpIsCalc(q)
  const variantOk = calc && typeof q.template === 'string' && !!makeVariant(q, lang)
  const saveKey = async (k: Record<string, unknown>) => {
    const { error } = await serviceClient.from('exam_answer_keys').update({ keys: { ...keys, [String(pubQ.id)]: k } }).eq('exam_id', exam.id)
    if (error) throw error
  }
  const saveQuestion = async (patch: Record<string, unknown>) => {
    const next = questions.map((x, i) => i === qi ? { ...x, ...patch } : x)
    const { error } = await serviceClient.from('exams').update({ questions: next }).eq('id', exam.id).is('completed_at', null)
    if (error) throw error
    return next[qi]
  }

  if (action === 'info') {
    return out({ mode: plan ? plan.mode : (variantOk ? 'variant' : 'cap'), status: pubHelp ? pubHelp.status : null, cap: HELP_CAP })
  }
  if (pubHelp && pubHelp.status === 'done') return out({ error: T('Bu soruda yardımı zaten kullandın.', 'You already used help on this question.'), code: 'help_done' }, 409)

  if (action === 'start') {
    if (plan && !plan.closed) return out({ mode: plan.mode, cap: HELP_CAP, step: publicHelpStep(plan), done: plan.cur >= plan.steps.length, resumed: true })
    let kind: 'calc' | 'guide' = calc ? 'calc' : 'guide'
    let steps: HelpStep[] | null = null
    if (calc) steps = normalizeCalcSteps(await requestHelpSteps(HELP_SYS_CALC, helpUserPrompt(q, 'calc', lang)), q, lang)
    if (!steps) { kind = 'guide'; steps = normalizeGuideSteps(await requestHelpSteps(HELP_SYS_GUIDE, helpUserPrompt(q, 'guide', lang)), q) }
    if (!steps) return out({ error: T('Bu soru için adım adım yardım şu an hazırlanamadı; ipucu alabilirsin.', 'Step-by-step help could not be prepared for this question right now; you can take a hint.') }, 502)
    const variant = variantOk ? makeVariant(q, lang) : null
    plan = { kind, mode: variant ? 'variant' : 'cap', steps, cur: 0, tries: 0, log: [], variant }
    try {
      await saveKey({ ...key, help_plan: plan })
      await saveQuestion({ help: { mode: plan.mode, status: 'started' } })
    } catch (e) {
      console.error('generate-exam yardim: kaydedilemedi', e)
      return out({ error: T('Yardım kaydedilemedi; tekrar dene.', 'Help could not be saved; try again.') }, 500)
    }
    console.log(`generate-exam yardim: soru ${pubQ.id} ${kind}/${plan.mode}, ${steps.length} adim`)
    return out({ mode: plan.mode, cap: HELP_CAP, step: publicHelpStep(plan), done: false })
  }

  if (!plan || plan.closed) return out({ error: T('Bu soruda açık bir yardım yok.', 'There is no open help on this question.') }, 409)

  if (action === 'check') {
    const r = advanceHelp(plan, Number(help.step), help.answer, lang)
    if (r.reply.error) return out(r.reply, 409)
    try { await saveKey({ ...key, help_plan: r.plan }) } catch (_e) { return out({ error: T('Cevap kaydedilemedi; tekrar dene.', 'Could not save; try again.') }, 500) }
    return out(r.reply)
  }

  // finish: yardım kapanır; şablonlu hesap sorusu yeni sayılarla döner
  try {
    if (plan.mode === 'variant' && plan.variant) {
      await saveKey({ ...applyHelpVariant(key, plan.variant), help_plan: { ...plan, closed: true } })
      const nq = await saveQuestion({ question: plan.variant.text, help: { mode: 'variant', status: 'done' } })
      return out({ mode: 'variant', question: nq.question })
    }
    await saveKey({ ...key, help_plan: { ...plan, closed: true } })
    await saveQuestion({ help: { mode: 'cap', status: 'done' } })
    return out({ mode: 'cap', cap: HELP_CAP })
  } catch (e) {
    console.error('generate-exam yardim: kapatilamadi', e)
    return out({ error: T('Yardım kapatılamadı; tekrar dene.', 'Could not close help; try again.') }, 500)
  }
}

// ==========================================================================
// FAZ 8 — HATA DEFTERİ: İKİNCİ ŞANS (30.10.2026)
//
// Öğrencinin yanlışları (puanı 50 altı) aralıklı tekrarla geri gelir; ama
// AYNI soru değil, benzeri: aynı tip, aynı konu ve beceri, farklı ayrıntı.
//   - Şablonlu hesap sorusu: yeni sayılar (makeVariant), model çağrısı yok.
//   - Ötekiler: tek model çağrısı (sınav şeması aynı), validateQuestion'dan
//     geçer; kaynakla birebir aynı soru atılır, eksik kalan bir kez yeniden
//     istenir.
// Sonuç normal bir sınav kaydı (alıştırma, süresiz): scoring.retry[i] i+1
// numaralı sorunun hangi yanlıştan geldiğini tutar. Tekrar takvimi ve
// "kazanıldı" (iki ardışık doğru) tarayıcıda bu kayıtlardan hesaplanır
// (exam-engine → mistakeStates). Migration yok.
//
// Faz 11 (30.10.2026): grafik ve çizim soruları da (MyLab benzer soruyu
// grafik dahil her algoritmik soruda veriyor).
//   - Grafik okuma: model yok; grafiğin sayıları değişir (chartVariant) ve
//     aynı biçimde yeni soru kodla kurulur (buildChartQuestion).
//   - Çizim ve ifade: model yazar, kod doğrular (verifyGraph,
//     verifyExpression); kaynağın denklemleri ya da cevabı aynıysa kopya.
// ==========================================================================

const RETRY_MAX_ITEMS = 10
const RETRY_TYPES = ['multiple_choice', 'true_false', 'fill_blank', 'open_ended', 'calculation', 'graph', 'expression']

/** Kaynak grafik sorusunun biçimi (buildChartQuestion): soru kodla
 *  kurulduysa kökünden ve şıklarından, modelin yazdığı grafik sorusunda
 *  tipten çıkarılır. */
function retryChartFormat(r: Record<string, unknown>): ChartExample {
  const stem = String(r.question ?? '').split(/\n\s*\n/)[0].trim()
  const opts = Array.isArray(r.options) ? (r.options as unknown[]).map(String) : []
  const ex: ChartExample = { stem, format: 'which_true', skills: [] }
  if (r.type === 'true_false') ex.format = 'true_false'
  else if (r.type === 'fill_blank') ex.format = 'fill'
  else if (r.type === 'open_ended') ex.format = 'open'
  else if (r.type === 'calculation') ex.format = 'value'
  else if (Array.isArray(r.premises) || /\n\s*I\.\s/.test(String(r.question ?? ''))) ex.format = 'premises'
  else if (/söylenemez|yanlıştır|NOT true|cannot be said/i.test(stem)) ex.format = 'which_false'
  else if (opts.length >= 2 && opts.every(o => Number.isFinite(parseLooseNumber(o.replace(/[%₺$€£]|TL/gi, ''))))) ex.format = 'value'
  if (r.type === 'multiple_choice' && [4, 5].includes(opts.length)) ex.options_count = opts.length
  return ex
}

/** Grafik sorusundan sayıları değişmiş grafikle, aynı biçimde yeni soru. */
function retryChartVariant(src: RetrySource, lang: string, optionCount: number, rand: () => number = Math.random): Record<string, unknown> | null {
  const raw = (src.result.chart && typeof src.result.chart === 'object' ? src.result.chart : null) as Record<string, unknown> | null
  const chart = normalizeChartSpec(raw)
  if (!raw || !chart) return null
  const ex = retryChartFormat(src.result)
  for (let attempt = 0; attempt < 3; attempt++) {
    const v = chartVariant(chart, rand)
    if (!v) return null
    const c = { ...v, ...(chartLabel(raw.x_title, 60) ? { x_title: chartLabel(raw.x_title, 60) } : {}), ...(chartLabel(raw.y_title, 60) ? { y_title: chartLabel(raw.y_title, 60) } : {}) }
    const q = buildChartQuestion(ex, c, lang, rand, optionCount) || (src.result.type === 'multiple_choice' ? buildChartQuestion({ ...ex, format: 'which_true' }, c, lang, rand, optionCount) : null)
    if (!q || q.type !== src.result.type) continue
    if (src.result.concept) q.concept = src.result.concept
    if (src.key.source) q.source = src.key.source
    return q
  }
  return null
}

type RetrySource = { examId: string; questionId: number; exam: Record<string, unknown>; result: Record<string, unknown>; key: Record<string, unknown> }

/** Şablonlu, formülü tutan hesap sorusundan yeni sayılarla soru. Sayılara
 *  bağlı alanlar (çözüm adımları, açıklama, ipucu) atılır. */
function retryCalcVariant(src: RetrySource, lang: string, rand?: () => number): Record<string, unknown> | null {
  const q = { ...src.result, ...src.key }
  if (q.type !== 'calculation' || q.chart || typeof q.template !== 'string' || typeof q.formula !== 'string') return null
  const v = makeVariant(q, lang, rand)
  if (!v) return null
  return {
    type: 'calculation', question: v.text, variables: v.variables, formula: q.formula, template: q.template, correct_answer: v.answer,
    tolerance_percent: q.tolerance_percent ?? 2, units: q.units ?? '', concept: q.concept ?? null, common_errors: q.common_errors ?? null,
    step_kind: q.step_kind ?? null, equation: q.equation ?? null, unknown: q.unknown ?? null, verified: true, options: null, hint: null
  }
}

function retryUserPrompt(items: RetrySource[], lang: string, optionCount: number): string {
  const lines = items.map((s, i) => {
    const r = s.result
    const parts = [`${i + 1}. TYPE: ${r.type}`, `CONCEPT: ${String(r.concept ?? '').slice(0, 120)}`, `QUESTION: ${String(r.question ?? '').slice(0, 900)}`]
    if (Array.isArray(r.options) && r.options.length) parts.push(`OPTIONS: ${JSON.stringify(r.options)}`)
    if (r.correct_answer != null && r.type !== 'open_ended') parts.push(`CORRECT ANSWER: ${String(r.correct_answer).slice(0, 300)}`)
    if (r.type === 'graph' && r.graph && typeof r.graph === 'object') parts.push(`GRID: ${JSON.stringify(r.graph).slice(0, 600)}`)
    return parts.join('\n   ')
  })
  const has = (t: string) => items.some(s => s.result.type === t)
  return [
    `EXAM TYPE: mixed`,
    `LANGUAGE: ${lang}`,
    `DIFFICULTY: medium`,
    `QUESTION COUNT: ${items.length}`,
    `OPTION COUNT: every 'multiple_choice' question has exactly ${optionCount} options.`,
    has('graph') ? `GRAPH QUESTIONS: allowed only to replace a SOURCE QUESTION of type 'graph' (that source question is the source material): same kind of drawing on the same topic, with DIFFERENT equations and numbers; a question that reuses the source equations is discarded. Choose numbers so every answer point falls on grid intersections.` : `GRAPH QUESTIONS: not allowed.`,
    ...(has('expression') ? [`EXPRESSION QUESTIONS: allowed only to replace a SOURCE QUESTION of type 'expression': same operation (e.g. derivative, simplification) on a DIFFERENT expression, so the answer differs.`] : []),
    `SECOND CHANCE: the student got each SOURCE QUESTION below wrong. For each one, in the same order, write exactly ONE new question of the SAME type that tests the SAME concept and skill with different specifics (a different example, case, numbers or angle), so it is not the source reworded: do not reuse the source sentence; ask about a different aspect, case or example. For 'fill_blank' and 'true_false' the answer should differ from the source answer where possible. Keep "concept" equal to the source concept. Write the full schema (hint, explanation, option_rationales or rubric, variables/formula/template for calculation). "source_terms" may be [].`,
    `SOURCE QUESTIONS:`,
    ...lines
  ].join('\n')
}

/** Kaba kök benzerliği: 3+ harfli kelimelerin ilk 5 harfiyle Jaccard. */
function retrySimilarity(a: unknown, b: unknown): number {
  const stems = (t: unknown) => new Set(normalizeAnswerText(t).split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 3).map(w => w.slice(0, 5)))
  const A = stems(a), B = stems(b)
  if (!A.size || !B.size) return 0
  let common = 0
  A.forEach(w => { if (B.has(w)) common++ })
  return common / (A.size + B.size - common)
}

/** Modelin sorusu, kaynağıyla aynı tipte geçerli ve kaynağın kılık
 *  değiştirmiş hali değilse. Canlı test (30.10.2026): boşluk sorusu
 *  kaynağın yeniden yazılmışı geldi ("Kısa vadeli borçların toplamı…
 *  dönen varlıkları içinde ___" → "Şirketin kısa vadeli borçları, dönen
 *  varlıkların içinde ___"), cevap da aynıydı. */
function acceptRetryQuestion(raw: unknown, src: RetrySource, lang: string, optionCount: number): Record<string, unknown> | null {
  const v = validateQuestion(raw, [String(src.result.type)], lang, optionCount, true)
  if (!v.ok || !v.question) { console.warn(`generate-exam ikinci sans: soru atildi (${src.result.type}): ${v.reason}`); return null }
  const q = v.question
  // Çizim ve ifade sorusunda kök hep benzer ("… doğrusunu çiziniz",
  // "… türevini bulunuz"); kopya, aynı denklemler ya da aynı cevaptır.
  if (q.type === 'graph' || q.type === 'expression') {
    const srcText = `${src.result.question ?? ''}`
    const copy = q.type === 'graph'
      ? graphCopiesFile(String(q.question), new Set(graphEquationsIn(srcText))) || (src.key.graph_answer != null && JSON.stringify(q.graph_answer) === JSON.stringify(src.key.graph_answer))
      : normalizeAnswerText(q.correct_answer) === normalizeAnswerText(src.key.correct_answer ?? src.result.correct_answer) || normalizeAnswerText(q.question) === normalizeAnswerText(srcText)
    if (copy) { console.warn(`generate-exam ikinci sans: ${q.type} sorusu kaynagin kopyasi`); return null }
    if (!q.concept && src.result.concept) q.concept = src.result.concept
    delete q.chart_ref
    return q
  }
  const sim = retrySimilarity(q.question, src.result.question)
  const sameAnswer = q.type !== 'open_ended' && q.type !== 'calculation' && normalizeAnswerText(q.correct_answer) === normalizeAnswerText(src.result.correct_answer)
  if (sim >= 0.5 || (sameAnswer && sim >= 0.35)) { console.warn(`generate-exam ikinci sans: soru kaynaga cok benziyor (${sim.toFixed(2)}${sameAnswer ? ', ayni cevap' : ''})`); return null }
  if (!q.concept && src.result.concept) q.concept = src.result.concept
  delete q.chart_ref
  return q
}

async function requestRetryQuestions(items: RetrySource[], lang: string, optionCount: number): Promise<unknown[]> {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key || !items.length) return []
  // Büyük modelin dakika kotası doluysa küçük model (sınav üretimiyle aynı kural).
  for (const model of [GROQ_PRIMARY_MODEL, GROQ_FALLBACK_MODEL]) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0.8, reasoning_effort: 'low',
        max_completion_tokens: Math.min(GEN_TOKENS_MAX, GEN_TOKENS_BASE + (GEN_TOKENS_PER_QUESTION + GEN_TOKENS_CALC_EXTRA) * items.length + GEN_TOKENS_GRAPH_EXTRA * 5 * items.filter(s => s.result.type === 'graph').length),
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: STATIC_EXAM_INSTRUCTIONS }, { role: 'user', content: retryUserPrompt(items, lang, optionCount) }]
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (data?.error?.code === 'json_validate_failed') return salvageQuestionObjects(String(data.error.failed_generation ?? ''))
      console.warn(`generate-exam ikinci sans: Groq ${model} ${res.status} ${String(data?.error?.message || '').slice(0, 200)}`)
      if (res.status === 429) continue
      return []
    }
    return parseQuestionArray(String(data.choices?.[0]?.message?.content ?? '')) || []
  }
  return []
}

/** POST { retry: { items: [{ examId, questionId }] } } → yeni alıştırma sınavı. */
async function handleExamRetry(req: Request, retry: Record<string, unknown>): Promise<Response> {
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return out({ error: 'Missing Authorization header' }, 401)
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return out({ error: 'Unauthorized user token' }, 401)
  const serviceClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  const wanted = (Array.isArray(retry.items) ? retry.items : []).slice(0, RETRY_MAX_ITEMS)
    .map(x => (x && typeof x === 'object' ? x as Record<string, unknown> : {}))
    .map(x => ({ examId: String(x.examId ?? ''), questionId: Number(x.questionId) }))
    .filter(x => x.examId && Number.isInteger(x.questionId) && x.questionId > 0)
  if (!wanted.length) return out({ error: 'Hata defterinden soru seçilmedi.' }, 400)

  const examIds = [...new Set(wanted.map(x => x.examId))]
  const { data: exams } = await userClient.from('exams').select('*').in('id', examIds)
  const byId = new Map(((exams || []) as Record<string, unknown>[]).filter(e => e.user_id === user.id && e.completed_at).map(e => [String(e.id), e]))
  if (!byId.size) return out({ error: 'Kaynak sınav bulunamadı.' }, 404)
  const first = byId.get(wanted.find(w => byId.has(w.examId))!.examId)!
  const lang = first.language === 'en' ? 'en' : 'tr'
  const T = (tr: string, en: string) => lang === 'en' ? en : tr

  // aynı sınır: ikinci şans da bir sınav kaydı
  try {
    const now = Date.now()
    const countSince = async (ms: number) => {
      const { count, error } = await serviceClient.from('exams').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date(now - ms).toISOString())
      if (error) throw error
      return count ?? 0
    }
    const [lastHour, lastDay] = await Promise.all([countSince(3600_000), countSince(86400_000)])
    if (lastHour >= EXAM_RATE_LIMIT_PER_HOUR) return out({ error: T(`Son bir saatte ${EXAM_RATE_LIMIT_PER_HOUR} sınav oluşturdun. Biraz sonra tekrar dene.`, `You created ${EXAM_RATE_LIMIT_PER_HOUR} exams in the last hour. Please try again later.`) }, 429)
    if (lastDay >= EXAM_RATE_LIMIT_PER_DAY) return out({ error: T(`Bugünkü ${EXAM_RATE_LIMIT_PER_DAY} sınav hakkını kullandın. Yarın tekrar dene.`, `You have used today's ${EXAM_RATE_LIMIT_PER_DAY} exams. Please try again tomorrow.`) }, 429)
  } catch (e) {
    console.warn('generate-exam ikinci sans: sinir sayimi yapilamadi', e)
  }

  const { data: keyRows } = await serviceClient.from('exam_answer_keys').select('exam_id, keys').in('exam_id', [...byId.keys()])
  const keysOf = new Map(((keyRows || []) as Record<string, unknown>[]).map(r => [String(r.exam_id), (r.keys || {}) as Record<string, Record<string, unknown>>]))
  const sources: RetrySource[] = []
  for (const w of wanted) {
    const e = byId.get(w.examId)
    if (!e) continue
    const result = ((e.question_results || []) as Record<string, unknown>[]).find(r => Number(r.question_id) === w.questionId)
    if (!result || !RETRY_TYPES.includes(String(result.type))) continue
    sources.push({ examId: w.examId, questionId: w.questionId, exam: e, result, key: (keysOf.get(w.examId) || {})[String(w.questionId)] || {} })
  }
  if (!sources.length) return out({ error: T('Bu yanlışlar için ikinci şans sorusu kurulamıyor.', 'No second-chance questions can be built for these mistakes.') }, 400)

  const optionCount = [4, 5].includes(Number((first.scoring as Record<string, unknown> | null)?.option_count)) ? Number((first.scoring as Record<string, unknown>).option_count) : 4
  // Grafik okuma sorusu modele gitmez: grafik kodla kurulamazsa soru düşer
  // (model grafiğin sayılarını uyduramaz).
  const isChart = (s: RetrySource) => !!s.result.chart && s.result.type !== 'graph'
  const built: Array<Record<string, unknown> | null> = sources.map(s => isChart(s) ? retryChartVariant(s, lang, optionCount) : retryCalcVariant(s, lang))
  const chartLost = sources.filter((s, i) => isChart(s) && !built[i]).length
  if (chartLost) console.warn(`generate-exam ikinci sans: ${chartLost} grafik sorusu kurulamadi`)
  let need = sources.map((s, i) => ({ s, i })).filter(x => !built[x.i] && !isChart(x.s))
  for (let attempt = 0; attempt < 2 && need.length; attempt++) {
    const items = await requestRetryQuestions(need.map(x => x.s), lang, optionCount)
    need.forEach((x, j) => { const q = acceptRetryQuestion(items[j], x.s, lang, optionCount); if (q) built[x.i] = q })
    need = need.filter(x => !built[x.i])
  }
  const pairs = sources.map((s, i) => ({ s, q: built[i] })).filter(p => p.q) as Array<{ s: RetrySource; q: Record<string, unknown> }>
  if (!pairs.length) return out({ error: T('İkinci şans soruları şu an hazırlanamadı; birazdan tekrar dene.', 'Second-chance questions could not be prepared right now; try again shortly.') }, 502)
  if (need.length) console.warn(`generate-exam ikinci sans: ${need.length}/${sources.length} soru kurulamadi`)

  const publicQuestions: Record<string, unknown>[] = []
  const answerKeys: Record<string, Record<string, unknown>> = {}
  pairs.forEach((p, i) => {
    const q: Record<string, unknown> = { ...p.q, id: i + 1, difficulty: 'medium' }
    delete q.source_terms
    if (q.type === 'multiple_choice' && Array.isArray(q.options) && q.keep_order !== true) q.options = shuffleInPlace([...(q.options as string[])])
    const { pub, key } = splitPublicAndKey(q)
    publicQuestions.push(pub)
    answerKeys[String(q.id)] = key
  })
  const payload: Record<string, unknown> = {
    user_id: user.id, exam_type: 'mixed', language: lang, question_count: publicQuestions.length, questions: publicQuestions,
    answers: null, question_results: null, grade: null, completed_at: null, is_simulation: false, time_limit_seconds: null,
    started_at: new Date().toISOString(), source_type: first.source_type || 'study_card',
    study_card_id: first.study_card_id ?? null, course_code: first.course_code ?? null, course_department: first.course_department ?? null,
    is_grounded: first.is_grounded ?? null, is_admin_knowledge_grounded: first.is_admin_knowledge_grounded ?? null,
    scoring: { ...normalizeScoring(optionCount, false), retry: pairs.map(p => ({ exam_id: p.s.examId, question_id: p.s.questionId, concept: p.s.result.concept ?? null })) }
  }
  for (const k of Object.keys(payload)) if (payload[k] === null && ['course_code', 'course_department', 'is_grounded', 'is_admin_knowledge_grounded'].includes(k)) delete payload[k]
  const { data: newExam, error } = await serviceClient.from('exams').insert(payload).select().single()
  if (error || !newExam) {
    console.error('generate-exam ikinci sans: kayit', error)
    return out({ error: T('İkinci şans sınavı kaydedilemedi.', 'The second-chance exam could not be saved.') }, 500)
  }
  const { error: keyError } = await serviceClient.from('exam_answer_keys').insert({ exam_id: newExam.id, user_id: user.id, keys: answerKeys })
  if (keyError) {
    console.error('generate-exam ikinci sans: anahtar', keyError)
    await serviceClient.from('exams').delete().eq('id', newExam.id)
    return out({ error: T('İkinci şans sınavı kaydedilemedi.', 'The second-chance exam could not be saved.') }, 500)
  }
  console.log(`generate-exam ikinci sans: ${pairs.length}/${sources.length} soru`)
  return out(newExam)
}

serve(async (req) => {
  const requestStartedAt = Date.now()
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

    const reqBody = await req.json()
    // FAZ 7: adım adım yardım ayrı yol (sınav üretimi ve sınırları devreye girmez)
    if (reqBody && typeof reqBody === 'object' && reqBody.help && typeof reqBody.help === 'object') return await handleExamHelp(req, reqBody.help)
    // FAZ 8: hata defterinden ikinci şans sınavı
    if (reqBody && typeof reqBody === 'object' && reqBody.retry && typeof reqBody.retry === 'object') return await handleExamRetry(req, reqBody.retry)
    const { studyCardId, sourceType, courseCode, courseDepartment, examType, questionCount, language, difficulty, isSimulation, focusConcept, optionCount, negativeMarking, decimalPlaces: decimalPlacesRaw, chartExamples, noGraphs, adaptive } = reqBody
    const scoring = normalizeScoring(optionCount, negativeMarking)
    // Yalnızca hesap sorusu olabilen türlerde (test ve klasikte anlamsız).
    const decimalPlaces = examType === 'calculation' || examType === 'mixed' ? normalizeDecimalPlaces(decimalPlacesRaw) : null

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
    // FAZ 4a: kaynaktaki grafik ve tablolardan çizilebilir grafikler.
    let chartSources: ChartSpec[] = []
    let isGrounded = true
    let isAdminKnowledgeGrounded = false
    let canonicalCourseCode: string | null = null
    let canonicalCourseName: string | null = null
    let courseDeptName: string | null = null
    let sourceDocumentId: string | null = null
    let conceptRuleText = '- For every question, set a "concept" field to the single key term (from the KEY TERMS list provided) that the question is primarily testing.'
    // FAZ 5.2: akıllı deneme için kaynağın terimleri ve masa (ders etiketi).
    let sourceTerms: string[] = []
    let deskTag: string | null = null

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
      sourceTerms = termNames(card.key_terms)
      deskTag = typeof card.course_tag === 'string' && card.course_tag.trim() ? card.course_tag.trim().toUpperCase() : null
      sourceDocumentId = typeof card.document_id === 'string' ? card.document_id : null
      chartSources = buildChartSources(card.charts, card.tables)
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
          .select('summary, key_terms, key_points, formulas, is_quantitative, charts, tables')
          .eq('is_shared', true)
          .eq('department', courseDeptName)
          .ilike('course_tag', canonicalCourseCode)
          .order('created_at', { ascending: false })
          .limit(MAX_POOLED_CARDS)
        if (poolErr) console.warn('Failed to pool shared study cards for course exam:', poolErr)
        sharedCards = pooled || []
      }

      isGrounded = sharedCards.length > 0
      sourceTerms = sharedCards.flatMap(c => termNames(c.key_terms))
      deskTag = canonicalCourseCode ? String(canonicalCourseCode).trim().toUpperCase() : null
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
        chartSources = sharedCards.flatMap(c => buildChartSources(c.charts, c.tables)).slice(0, CHART_MAX_SOURCES)
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
    // FAZ 4b: öğrenci "grafik sorusu olmasın" dediyse grafik okuma da çizim de yok.
    const graphsOff = noGraphs === true
    if (graphsOff) chartSources = []
    const graphsAllowed = !graphsOff && (examType === 'mixed' || examType === 'calculation')
    // FAZ 4b.2: belgede taranmış grafik / çizim soruları varsa (öğrenci
    // ayrıca istemese de) benzerleri sınava karışır: grafik örneklerinden
    // yaklaşık dörtte bir soru kodla kurulur, çizim örnekleri modele örnek
    // olarak verilir. "Grafik sorusu olmasın" ise hiçbiri.
    let fileChartQuestions: Record<string, unknown>[] = []
    let fileDrawExamples: string[] = []
    if (!graphsOff && chartExamples !== true && resolvedSourceType === 'study_card' && sourceDocumentId) {
      const { data: fileItems, error: fileItemsErr } = await userClient.from('document_chart_items').select('page, chart, example').eq('document_id', sourceDocumentId).order('page')
      if (!fileItemsErr && Array.isArray(fileItems) && fileItems.length) {
        const rows = fileItems as Array<Record<string, unknown>>
        if (graphsAllowed) fileDrawExamples = rows.filter(it => (it.example as Record<string, unknown>)?.format === 'draw').map(it => String((it.example as Record<string, unknown>).stem || '')).filter(Boolean).slice(0, 4)
        const charts = rows.map(it => chartItemForExam(it, examType, isQuant, scoring.option_count)).filter(Boolean) as Array<Record<string, unknown>>
        const k = !charts.length ? 0 : Math.min(charts.length * 2, requestedCount >= 3 ? Math.max(1, Math.round(requestedCount / 4)) : requestedCount === 2 ? 1 : 0)
        if (k) {
          const allowedHere = allowedTypesFor(examType, isQuant, graphsAllowed)
          fileChartQuestions = buildChartExamQuestions(charts, k, language, scoring.option_count, `${user.id}:${Date.now()}:${Math.random()}`).filter(q => allowedHere.includes(String(q.type)))
        }
        console.log(`generate-exam: belgede ${charts.length} grafik, ${fileDrawExamples.length} cizim ornegi; ${fileChartQuestions.length} grafik sorusu kodla karisti`)
      }
    }
    const fileDrawEquations = new Set(fileDrawExamples.flatMap(graphEquationsIn))
    const graphSource = graphsAllowed && (fileDrawExamples.length > 0 || sourceTeachesGraphs(context))

    // FAZ 5.2: akıllı deneme. Öğrencinin bu masadaki (aynı ders etiketi ya
    // da aynı kart) geçmiş sınavlarından konu ustalığı hesaplanır; sorular
    // plana göre konu konu ve zorluk zorluk istenir. Plan boşsa (hiç konu
    // ve terim yok) sınav normal kurulur.
    let adaptivePlan: AdaptiveSlot[] | null = null
    const adaptiveReq = adaptive === true ? {} : (adaptive && typeof adaptive === 'object' ? adaptive as Record<string, unknown> : null)
    const adaptiveDays = adaptiveReq && adaptiveReq.daysToExam != null && Number.isFinite(Number(adaptiveReq.daysToExam)) ? Math.round(Number(adaptiveReq.daysToExam)) : null
    if (adaptiveReq && chartExamples !== true) {
      const { data: past, error: pastErr } = await userClient.from('exams')
        .select('id, completed_at, question_results, scoring, study_card_id, source_type, course_code, study_cards(course_tag)')
        .eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(300)
      if (pastErr) console.warn('generate-exam: akilli deneme gecmis sinavlar okunamadi:', pastErr.message)
      const tagOf = (e: Record<string, unknown>): string | null => {
        if (e.source_type === 'course' && e.course_code) return String(e.course_code).trim().toUpperCase()
        const t = e.study_cards && (e.study_cards as Record<string, unknown>).course_tag
        return typeof t === 'string' && t.trim() ? t.trim().toUpperCase() : null
      }
      const desk = ((past || []) as Array<Record<string, unknown>>).filter(e => deskTag ? tagOf(e) === deskTag : (e.study_card_id === studyCardId && !tagOf(e)))
      const mastery = conceptMastery(desk)
      const plan = buildAdaptivePlan(mastery, sourceTerms, requestedCount, { daysToExam: adaptiveDays })
      adaptivePlan = plan.length ? plan : null
      console.log(`generate-exam: akilli deneme: ${desk.length} gecmis sinav, ${mastery.length} konu, ${sourceTerms.length} terim, sinava ${adaptiveDays ?? '-'} gun; plan ${plan.length}/${requestedCount} (${plan.map(x => x.reason).join(',')})`)
    }
    const exprSource = examType === 'calculation' && sourceTeachesAlgebra(context)
    if (chartSources.length > 0) context += `\n\nCHARTS (numbered; the student sees each drawn as a graph with labelled values):\n${describeCharts(chartSources)}`

    // FAZ 4c: "dosyadaki grafik sorularına göre". Taranmış grafiklerden
    // benzer grafik + aynı biçimde soru; tamamen kodla, yapay zekâ çağrısı yok.
    let chartExampleQuestions: Record<string, unknown>[] | null = null
    if (chartExamples === true) {
      if (resolvedSourceType !== 'study_card' || !sourceDocumentId) {
        return new Response(JSON.stringify({ error: 'Grafik soruları yalnızca yüklenen bir belgeden kurulabilir.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: allChartItems, error: chartItemsErr } = await userClient.from('document_chart_items').select('page, chart, example').eq('document_id', sourceDocumentId).order('page')
      if (chartItemsErr) console.warn('generate-exam: document_chart_items okunamadi (migration?):', chartItemsErr.message)
      // FAZ 4b.2: çizim örnekleri (grafiksiz) bu kipte kullanılmaz.
      const chartItems = (allChartItems || []).filter(it => ((it as Record<string, unknown>).example as Record<string, unknown> | null)?.format !== 'draw')
      if (!chartItems.length) {
        return new Response(JSON.stringify({ error: 'Bu belgede taranmış grafik sorusu yok. Önce grafik taramasını tamamlayın.', code: 'no_chart_items' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      chartExampleQuestions = buildChartExamQuestions(chartItems as Array<Record<string, unknown>>, requestedCount, language, scoring.option_count, `${user.id}:${Date.now()}:${Math.random()}`)
      console.log(`generate-exam: ${chartItems.length} taranmis grafikten ${chartExampleQuestions.length} soru (kodla)`)
      if (!chartExampleQuestions.length) {
        return new Response(JSON.stringify({ error: 'Taranmış grafiklerden soru kurulamadı.' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

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
    const buildUserPrompt = (count: number, avoid: string[], needGraph = false) => `Generate exactly ${count} questions of type '${examType}' in the language '${language}' (en = English, tr = Turkish), at difficulty level '${resolvedDifficulty}'.
OPTION COUNT: every 'multiple_choice' question has exactly ${scoring.option_count} options.
GRAPH QUESTIONS: ${!graphsAllowed ? 'not allowed (never use type graph)' : graphSource && (count >= 3 || needGraph) ? `required: this source teaches material drawn on coordinate axes, so at least ${needGraph ? 1 : Math.max(1, Math.round(count / 5))} of the ${count} questions MUST be type 'graph' (they count as part of the type spread above)` : 'allowed'}.${exprSource ? `\nEXPRESSION QUESTIONS: ${exprNeeded(count) ? `required: this source teaches symbolic algebra or calculus, so at least ${exprNeeded(count)} of the ${count} questions MUST be type 'expression' (the student types a formula, e.g. a derivative or a simplified expression)` : 'allowed'}.` : ''}${fileDrawExamples.length ? `\nDRAWING QUESTIONS FROM THE STUDENT'S FILE (write the 'graph' questions in this style and on these topics, but with DIFFERENT equations and numbers; a question that only reuses these equations is discarded):\n${fileDrawExamples.map(t => `- ${t.slice(0, 300)}`).join('\n')}` : ''}${decimalPlaces ? `\nNUMERIC PRECISION: 'calculation' answers are graded to exactly ${decimalPlaces} decimal places. In every 'calculation' question text ask for the result to ${decimalPlaces} decimal places, and let "formula" compute the exact value (no rounding inside the formula).` : ''}${adaptivePlan && remainingPlan(count).length ? `\n\n${adaptivePlanText(remainingPlan(count))}` : ''}${resolvedFocusConcept && !adaptivePlan ? `\n\nIMPORTANT FOCUS RULE:\n- The student specifically wants to practice ONE topic: "${resolvedFocusConcept}". EVERY question must test this exact topic, approached from different angles (definition, application, comparison, scenario) — do not drift to unrelated concepts. Set the "concept" field on every question to "${resolvedFocusConcept}" (or a very close variant in the requested language).` : ''}${avoid.length > 0 ? `\n\nDo NOT repeat these questions that were already generated:\n${avoid.map(t => `- ${t.slice(0, 160)}`).join('\n')}` : ''}

Additional variation seed: ${Date.now()}`
    // FAZ 5.2: planın henüz karşılanmamış satırları (kabul edilen soruların
    // konuları düşülür); takip isteklerinde yalnızca bunlar istenir.
    const remainingPlan = (count: number): AdaptiveSlot[] => {
      if (!adaptivePlan) return []
      const left = [...adaptivePlan]
      for (const q of accepted) { const i = left.findIndex(x => x.key === conceptKey(q.concept)); if (i >= 0) left.splice(i, 1) }
      return left.slice(0, count)
    }
    // FAZ 3b: kaç ifade sorusu zorunlu (ilk istekte yaklaşık üçte bir; sonra
    // hâlâ yoksa 1). accepted ve firstCallDone aşağıda tanımlı; çağrı anında okunur.
    const exprNeeded = (count: number): number => {
      if (!exprSource || accepted.some(q => q.type === 'expression')) return 0
      return firstCallDone ? 1 : (count >= 2 ? Math.max(1, Math.round(count / 3)) : 0)
    }
    const buildExprPrompt = (avoid: string[]) => `Generate exactly 1 question of type 'expression' (a symbolic EXPRESSION question as described in the instructions) in the language '${language}' (en = English, tr = Turkish), at difficulty level '${resolvedDifficulty}', based on the SOURCE MATERIAL.${avoid.length > 0 ? `\n\nDo NOT repeat these questions that were already generated:\n${avoid.map(t => `- ${t.slice(0, 160)}`).join('\n')}` : ''}

Additional variation seed: ${Date.now()}`
    // FAZ 4b: kaynak uygun ama model çizim sorusu yazmadıysa tek bir çizim sorusu.
    const buildGraphPrompt = (avoid: string[]) => `Generate exactly 1 question of type 'graph' (a GRAPH DRAWING QUESTION as described in the instructions) in the language '${language}' (en = English, tr = Turkish), at difficulty level '${resolvedDifficulty}', based on the SOURCE MATERIAL.
GRAPH QUESTIONS: required. Choose numbers so every answer point falls on grid intersections.${fileDrawExamples.length ? `\nDRAWING QUESTIONS FROM THE STUDENT'S FILE (same style, but DIFFERENT equations and numbers; a question that only reuses these equations is discarded):\n${fileDrawExamples.map(t => `- ${t.slice(0, 300)}`).join('\n')}` : ''}${avoid.length > 0 ? `\n\nDo NOT repeat these questions that were already generated:\n${avoid.map(t => `- ${t.slice(0, 160)}`).join('\n')}` : ''}

Additional variation seed: ${Date.now()}`

    let lastPromptTokens = 0, firstUserChars = 0
    // Tek bir üretim çağrısı. Başarısızsa { error } döner, istisna fırlatmaz.
    const requestQuestions = async (count: number, avoid: string[], attempt = 0, forceGraph = false, needGraph = false, forceExpr = false, model = GROQ_PRIMARY_MODEL): Promise<{ items?: unknown[]; error?: string }> => {
      const userContent = forceGraph ? buildGraphPrompt(avoid) : forceExpr ? buildExprPrompt(avoid) : buildUserPrompt(count, avoid, needGraph)
      // Groq TPM sınırı istemi VE ayrılan çıktı bütçesini birlikte sayar
      // (canlı test 25.10.2026: "Request too large … Requested 8262"). İlk
      // çağrının gerçek istem tokenı biliniyorsa ona göre, yoksa tahminle kısılır.
      const promptEst = lastPromptTokens > 0 ? lastPromptTokens + Math.ceil(Math.max(0, userContent.length - firstUserChars) / 3) + 50 : Math.ceil((sysPrompt.length + userContent.length) / 3.4)
      const wanted = Math.min(GEN_TOKENS_MAX, completionBudgetFor(count) + (examType === 'calculation' ? GEN_TOKENS_CALC_EXTRA * count : 0) + (graphsAllowed ? GEN_TOKENS_GRAPH_EXTRA * count : 0))
      // İlk çağrı eskisi gibi (canlıda istem önbelleğiyle sorunsuz); kısma
      // yalnızca tamamlama ve çizim isteklerinde.
      const budget = forceGraph || forceExpr || count < requestedCount ? Math.max(GEN_TOKENS_FLOOR, Math.min(wanted, GROQ_TPM_LIMIT - promptEst - 100)) : wanted
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
          model,
          temperature: 0.9,
          // 22.10.2026 (canlı test): gpt-oss akıl yürütme modeli; görünmeyen
          // düşünme tokenları çıktı bütçesini yiyince yanıt boş ya da tek
          // soruda kesik geliyordu. Düşünme payı kısıldı, bütçe soru
          // sayısına göre açıkça veriliyor (hesap 8.000 TPM ile sınırlı).
          reasoning_effort: "low",
          max_completion_tokens: budget,
          // JSON modu üst düzeyde NESNE döndürür; prompt bu yüzden artık
          // {"questions":[...]} istiyor. Eskiden dizi istenip json_object
          // modu kullanılıyordu — ara sıra görülen "invalid formatting"
          // hatalarının olası kaynağı buydu.
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userContent }
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
          if (attempt < GEN_MAX_RETRIES) return requestQuestions(count, avoid, attempt + 1, forceGraph, needGraph, forceExpr, model)
        }
        // FAZ 2 (canlı test): eksik sorular için yapılan ikinci istek
        // dakikalık token sınırına (TPM) takılıyordu. Groq'un söylediği süre
        // kısaysa bekleyip yeniden dene (kayan dakika penceresi yüzünden bir
        // bekleme her zaman yetmiyor; en fazla GEN_MAX_RETRIES kez).
        const waitMs = groqRetryDelayMs(groqResponse.status, groqResponse.headers.get('retry-after'), groqData?.error?.message)
        const plan = groqFailurePlan(groqResponse.status, waitMs, model, attempt)
        if (plan === 'fallback') {
          console.warn(`generate-exam: Groq hiz siniri (${model}${waitMs ? `, ${Math.round(waitMs / 1000)} sn` : ''}); yedek model ${GROQ_FALLBACK_MODEL}`)
          return requestQuestions(count, avoid, 0, forceGraph, needGraph, forceExpr, GROQ_FALLBACK_MODEL)
        }
        if (plan === 'wait' && waitMs !== null) {
          console.warn(`generate-exam: Groq hiz siniri, ${Math.round(waitMs / 1000)} sn beklenip yeniden deneniyor`)
          await new Promise(r => setTimeout(r, waitMs))
          return requestQuestions(count, avoid, attempt + 1, forceGraph, needGraph, forceExpr, model)
        }
        console.error("Groq generation failed: ", groqData)
        return { error: groqData?.error?.message || groqData?.error?.code || `HTTP ${groqResponse.status}` }
      }
      const choice = groqData.choices?.[0]
      const rawContent = choice?.message?.content ?? ""
      const usage = groqData.usage || {}
      if (!lastPromptTokens && Number(usage.prompt_tokens) > 0) { lastPromptTokens = Number(usage.prompt_tokens); firstUserChars = userContent.length }
      console.log(`generate-exam: groq${model === GROQ_PRIMARY_MODEL ? '' : ' (yedek model)'} finish=${choice?.finish_reason} istenen=${count} prompt=${usage.prompt_tokens} cikti=${usage.completion_tokens} butce=${budget}`)
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

    const allowedTypes = allowedTypesFor(examType, isQuant, graphsAllowed)
    let accepted: Record<string, unknown>[] = []
    let firstCallDone = false
    const seenTexts = new Set<string>()
    const rejectReasons: string[] = []

    const rejectedRaw: unknown[] = []
    const seenFormulas = new Set<string>()
    // Dosyadaki çizim sorusunun kopyası: son çare olarak (eksik kalırsa) alınır.
    const copiedGraphs: Record<string, unknown>[] = []
    const absorb = (items: unknown[], allowUnverifiedCalc = false) => {
      for (const raw of items) {
        if (accepted.length >= requestedCount) break
        const result = validateQuestion(attachChart(raw, chartSources), allowedTypes, language, scoring.option_count, allowUnverifiedCalc)
        if (!result.ok || !result.question) {
          const reason = result.reason || 'unknown'
          rejectReasons.push(reason)
          if (reason.startsWith('graph_')) {
            const r = (raw || {}) as Record<string, unknown>
            console.warn(`generate-exam: ${reason} graph=${JSON.stringify(r.graph ?? null).slice(0, 400)} answer=${JSON.stringify(r.graph_answer ?? null).slice(0, 400)}`)
          }
          if (reason.startsWith('calc_')) {
            const r = (raw || {}) as Record<string, unknown>
            console.warn(`generate-exam: ${reason} formula=${JSON.stringify(r.formula ?? null).slice(0, 160)} vars=${JSON.stringify(r.variables ?? null).slice(0, 160)} cevap=${JSON.stringify(r.correct_answer ?? null).slice(0, 120)}`)
            if (!allowUnverifiedCalc) rejectedRaw.push(raw)
          }
          continue
        }
        if (result.question.type === 'graph' && graphCopiesFile(String(result.question.question), fileDrawEquations)) {
          rejectReasons.push('graph_copied_from_file')
          if (!allowUnverifiedCalc) copiedGraphs.push(result.question)
          console.warn(`generate-exam: graph_copied_from_file: ${String(result.question.question).slice(0, 160)}`)
          continue
        }
        const textKey = normalizeAnswerText(result.question.question)
        if (seenTexts.has(textKey)) {
          rejectReasons.push('duplicate_question')
          continue
        }
        // Canlı test (26.10.2026): "R(q) = 50q − 2q² için q = 5'te MR" ve
        // "q = 8'de MR" ayrı sorular olarak geldi. Aynı formülü yalnızca
        // farklı sayılarla soran hesap sorusu tekrar sayılır.
        const formulaKey = calcFormulaKey(result.question)
        if (formulaKey && seenFormulas.has(formulaKey)) {
          rejectReasons.push('duplicate_formula')
          continue
        }
        if (formulaKey) seenFormulas.add(formulaKey)
        seenTexts.add(textKey)
        accepted.push(result.question)
      }
    }

    if (chartExampleQuestions) accepted.push(...chartExampleQuestions)
    // FAZ 4b.2: dosyadan kodla kurulan grafik soruları; model kalanını yazar.
    accepted.push(...fileChartQuestions)
    const first = chartExampleQuestions ? { items: [] as unknown[] } as { items?: unknown[]; error?: string } : await requestQuestions(requestedCount - accepted.length, accepted.map(q => String(q.question)))
    if (first.error && !first.items) {
      const detail = first.error === 'invalid_format' ? 'AI returned invalid question formatting. Please try again.' : `AI generation service failed: ${first.error}`
      return new Response(JSON.stringify({ error: detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    absorb(first.items || [])
    firstCallDone = true

    // Eksik kalan soru varsa bir kez daha, yalnızca eksik sayı kadar iste.
    let shortfallCalled = false
    if (accepted.length < requestedCount && !chartExampleQuestions) {
      const shortfall = requestedCount - accepted.length
      console.warn(`generate-exam: ${rejectReasons.length} soru dogrulamadan gecmedi (${rejectReasons.join(', ')}); ${shortfall} soru icin yeniden uretim isteniyor`)
      // FAZ 4b: çizim sorusu hâlâ yoksa aynı istekte en az biri çizim istenir
      // (ayrı bir istek aynı dakikada TPM sınırına takılıyor).
      const needGraph = graphSource && requestedCount >= 3 && !accepted.some(q => q.type === 'graph')
      shortfallCalled = true
      const second = await requestQuestions(shortfall, accepted.map(q => String(q.question)), 0, false, needGraph)
      if (second.items) absorb(second.items)
      else console.warn('generate-exam: ikinci uretim basarisiz:', second.error)
    }

    // FAZ 4b (canlı test 25.10.2026): kaynak koordinat düzleminde çizilen bir
    // konu öğretiyor, çizim sorusu zorunlu dendiği hâlde hiç gelmediyse bir kez
    // yalnızca çizim sorusu istenir; gelen soru en kalabalık tipin son
    // sorusunun yerine geçer (eksik varsa eklenir).
    if (graphSource && requestedCount >= 3 && !chartExampleQuestions && !shortfallCalled && !accepted.some(q => q.type === 'graph')) {
      const g = await requestQuestions(1, accepted.map(q => String(q.question)), 0, true)
      let note = g.error || 'soru yok'
      for (const raw of g.items || []) {
        const r = validateQuestion(attachChart(raw, chartSources), ['graph'], language, scoring.option_count, false)
        if (!r.ok || !r.question) { note = r.reason || 'unknown'; rejectReasons.push(note); continue }
        if (accepted.length < requestedCount) accepted.push(r.question)
        else {
          const counts: Record<string, number> = {}
          accepted.forEach(q => { counts[String(q.type)] = (counts[String(q.type)] || 0) + 1 })
          let idx = -1
          accepted.forEach((q, i) => { if (q.chart) return; if (idx < 0 || counts[String(q.type)] > counts[String(accepted[idx].type)] || (counts[String(q.type)] === counts[String(accepted[idx].type)] && i > idx)) idx = i })
          if (idx >= 0) accepted[idx] = r.question
        }
        note = 'eklendi'
        break
      }
      console.log(`generate-exam: kaynak cizime uygun, cizim sorusu ayrica istendi: ${note}`)
    }

    // FAZ 3b (canlı test 26.10.2026): kaynak cebir/türev öğretiyor, ifade
    // sorusu zorunlu dendiği hâlde hiç gelmediyse bir kez yalnızca ifade
    // sorusu istenir; gelen soru son hesap sorusunun yerine geçer.
    if (exprSource && requestedCount >= 3 && !shortfallCalled && !accepted.some(q => q.type === 'expression') && Date.now() - requestStartedAt < THIRD_CALL_DEADLINE_MS) {
      const ex = await requestQuestions(1, accepted.map(q => String(q.question)), 0, false, false, true)
      let note = ex.error || 'soru yok'
      for (const raw of ex.items || []) {
        const r = validateQuestion(raw, ['expression'], language, scoring.option_count, false)
        if (!r.ok || !r.question) { note = r.reason || 'unknown'; rejectReasons.push(note); continue }
        if (accepted.length < requestedCount) accepted.push(r.question)
        else {
          let idx = -1
          accepted.forEach((q, i) => { if (q.type === 'calculation' && !q.chart) idx = i })
          if (idx < 0) { note = 'yer yok'; break }
          accepted[idx] = r.question
        }
        note = 'eklendi'
        break
      }
      console.log(`generate-exam: kaynak cebir/turev ogretiyor, ifade sorusu ayrica istendi: ${note}`)
    }

    // FAZ 3a son çare: hâlâ eksikse, formülü doğrulanamayan ama cevabı sayı
    // olan hesap soruları eskisi gibi (doğrulanmamış) alınır. Çelişenler değil.
    // Sayı hassasiyeti seçiliyse alınmaz: modelin yuvarladığı cevapla
    // virgülden sonraki basamaklar notlanamaz.
    if (accepted.length < requestedCount && rejectedRaw.length && !decimalPlaces) {
      const before = accepted.length
      absorb(rejectedRaw.splice(0), true)
      if (accepted.length > before) console.warn(`generate-exam: ${accepted.length - before} hesap sorusu dogrulanmadan alindi`)
    }

    // Canlı test (26.10.2026): 8 soru istendi, 7 geldi (ikinci üretimdeki tek
    // soru da atıldı). Süre elveriyorsa eksik için bir kez daha istenir;
    // hâlâ eksikse dosyadaki çizim sorusunun kopyası alınır.
    if (accepted.length < requestedCount && !chartExampleQuestions && shortfallCalled && Date.now() - requestStartedAt < THIRD_CALL_DEADLINE_MS) {
      const shortfall = requestedCount - accepted.length
      console.warn(`generate-exam: hala ${shortfall} soru eksik; son kez isteniyor`)
      const third = await requestQuestions(shortfall, accepted.map(q => String(q.question)))
      if (third.items) absorb(third.items)
    }
    if (accepted.length < requestedCount && copiedGraphs.length) {
      for (const q of copiedGraphs.splice(0)) {
        if (accepted.length >= requestedCount) break
        const key = normalizeAnswerText(q.question)
        if (seenTexts.has(key)) continue
        seenTexts.add(key)
        accepted.push(q)
        console.warn('generate-exam: eksik kaldi, dosyadaki cizim sorusuna benzeyen soru alindi')
      }
    }

    if (accepted.length === 0) {
      console.error('generate-exam: gecerli soru kalmadi. Nedenler:', rejectReasons.join(', '))
      return new Response(JSON.stringify({ error: 'AI failed to generate a list of questions.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (chartSources.length > 0) console.log(`generate-exam: ${chartSources.length} grafik kaynagi, ${accepted.filter(q => q.chart).length} grafikli soru`)

    // Sıra numaralarını yeniden ver, zorluğu sunucuda damgala (modelin geri
    // yansıtmasına güvenme), çoktan seçmeli şıkları karıştır.
    // FAZ 4b.2: dosyadan kurulan grafik soruları başa yığılmasın.
    if (fileChartQuestions.length) {
      const fileSet = new Set(fileChartQuestions)
      const kept = accepted.filter(q => fileSet.has(q))
      accepted = spreadInsert(accepted.filter(q => !fileSet.has(q)), kept)
      console.log(`generate-exam: ${kept.length}/${accepted.length} soru dosyadaki grafiklerden`)
    }
    // FAZ 5.2: akıllı denemede zorluk soru başına plandan.
    const planQueue = adaptivePlan ? [...adaptivePlan] : []
    if (adaptivePlan) console.log(`generate-exam: akilli deneme plana uyan ${accepted.filter(q => adaptivePlan!.some(x => x.key === conceptKey(q.concept))).length}/${accepted.length} soru`)
    const finalQuestions = accepted.map((q, i) => {
      const out: Record<string, unknown> = { ...q, id: i + 1, difficulty: resolvedDifficulty }
      if (planQueue.length) {
        const j = planQueue.findIndex(x => x.key === conceptKey(q.concept))
        if (j >= 0) { out.difficulty = planQueue[j].difficulty; planQueue.splice(j, 1) }
      }
      if (out.type === 'multiple_choice' && Array.isArray(out.options) && out.keep_order !== true) {
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
            if (q.source) { anchored++; continue }
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
      scoring: {
        ...scoring,
        ...(decimalPlaces ? { decimal_places: decimalPlaces } : {}),
        ...(adaptivePlan ? { adaptive: { plan: adaptivePlan.map(x => ({ concept: x.concept, reason: x.reason, difficulty: x.difficulty, level: x.level })), days_to_exam: adaptiveDays } } : {})
      }
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
