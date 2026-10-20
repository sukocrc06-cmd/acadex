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
2. 'test': All questions must be multiple-choice. Each question must have exactly 4 options. The correct_answer field must be exactly equal to one of the options.
3. 'calculation': All questions must be numerical calculation problems. For 'calculation' questions:
   - "type": "calculation"
   - "question": a clear scenario with specific numerical inputs.
   - "correct_answer": numeric value (as a JSON number, e.g. 1432.50 or 42).
   - "tolerance_percent": number indicating acceptable margin of error (e.g. 2 for 2%).
   - "units": short unit string (e.g. "$", "%", "units", "kg", etc., or "" if unitless).
   - "solution_steps": array of strings demonstrating step 1, step 2, step 3 of the step-by-step mathematical solution.
   - "options": null.
4. 'mixed': A combination of question types (the user message's MIXED TYPE RULE line below states the exact type spread for this course).
   - For 'open_ended': options = null.
   - For 'multiple_choice': exactly 4 options, correct_answer matches one option.
   - For 'true_false': options = ['True', 'False'] (if en) or ['Doğru', 'Yanlış'] (if tr).
   - For 'fill_blank': use '______' in question text. options = null. The blank must be a single word or short term. Also give "accepted_answers": other spellings or exact synonyms that are equally correct (e.g. an abbreviation and its full form), or [] if none.
   - For 'calculation': use the calculation question format above.
The user message states exactly which exam type and how many questions to generate.

RESPONSE FORMAT:
You must output ONLY a valid JSON object of the form {"questions": [ ... ]}, with no markdown code fences (do NOT use \`\`\`json or similar), no introductory or concluding text, and no conversational commentary.
The "questions" array's length must exactly equal the question count requested in the user message. Each object in it must match this JSON schema:
{
  "id": number (1-based index),
  "type": "multiple_choice" | "open_ended" | "true_false" | "fill_blank" | "calculation",
  "question": "string",
  "options": ["string"] | null,
  "correct_answer": "string" | number,
  "accepted_answers": ["string"] | null,
  "tolerance_percent": number | null,
  "units": "string" | null,
  "solution_steps": ["string"] | null,
  "hint": "string (short helpful clue that does NOT reveal the answer)",
  "concept": "string"
}
For 'multiple_choice', the 4 options must be distinct and exactly one must be correct.
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
const KEY_FIELDS = ['correct_answer', 'accepted_answers', 'solution_steps', 'tolerance_percent', 'hint']

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

/** Sınav türüne göre kabul edilen soru tipleri. */
function allowedTypesFor(examType: string, isQuant: boolean): string[] {
  if (examType === 'classic') return ['open_ended']
  if (examType === 'test') return ['multiple_choice']
  if (examType === 'calculation') return ['calculation']
  const mixed = ['open_ended', 'multiple_choice', 'true_false', 'fill_blank']
  return isQuant ? [...mixed, 'calculation'] : mixed
}

/** Tek bir soruyu denetler ve temizlenmiş halini döner. Geçmezse
 *  { ok: false, reason } — soru atılır. */
function validateQuestion(raw: unknown, allowedTypes: string[], language: string): { ok: boolean; question?: Record<string, unknown>; reason?: string } {
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
    if (options.length !== 4) return { ok: false, reason: 'mc_option_count' }
    if (new Set(options.map(normalizeAnswerText)).size !== options.length) return { ok: false, reason: 'mc_duplicate_options' }
    const correctNorm = normalizeAnswerText(q.correct_answer)
    let match = options.filter(o => normalizeAnswerText(o) === correctNorm)
    // Model bazen "B" ya da "B) ..." biçiminde harf döndürüyor.
    if (match.length === 0) {
      const letter = String(q.correct_answer ?? '').trim().match(/^([A-Da-d])(?:[).:\s]|$)/)
      if (letter) match = [options['abcd'.indexOf(letter[1].toLowerCase())]]
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
    const answer = String(q.correct_answer ?? '').trim()
    if (!answer) return { ok: false, reason: 'fill_blank_no_answer' }
    q.correct_answer = answer
    q.accepted_answers = Array.isArray(q.accepted_answers)
      ? q.accepted_answers.map(a => String(a ?? '').trim()).filter(Boolean).slice(0, 8)
      : []
    q.options = null
  } else if (type === 'calculation') {
    const n = parseLooseNumber(q.correct_answer)
    if (!Number.isFinite(n)) return { ok: false, reason: 'calc_answer_not_number' }
    q.correct_answer = n
    const tol = parseLooseNumber(q.tolerance_percent)
    q.tolerance_percent = Number.isFinite(tol) ? Math.min(10, Math.max(0.1, tol)) : 2
    q.units = typeof q.units === 'string' ? q.units.trim().slice(0, 12) : ''
    q.solution_steps = Array.isArray(q.solution_steps) ? q.solution_steps.map(s => String(s ?? '')).filter(Boolean) : []
    q.options = null
  } else if (type === 'open_ended') {
    const ref = String(q.correct_answer ?? '').trim()
    if (!ref) return { ok: false, reason: 'open_no_reference' }
    q.correct_answer = ref
    q.options = null
  }
  return { ok: true, question: q }
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
    if (KEY_FIELDS.includes(k)) key[k] = v
    else pub[k] = v
  }
  return { pub, key }
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

    const { studyCardId, sourceType, courseCode, courseDepartment, examType, questionCount, language, difficulty, isSimulation, focusConcept } = await req.json()

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
    const buildUserPrompt = (count: number, avoid: string[]) => `Generate exactly ${count} questions of type '${examType}' in the language '${language}' (en = English, tr = Turkish), at difficulty level '${resolvedDifficulty}'.${resolvedFocusConcept ? `\n\nIMPORTANT FOCUS RULE:\n- The student specifically wants to practice ONE topic: "${resolvedFocusConcept}". EVERY question must test this exact topic, approached from different angles (definition, application, comparison, scenario) — do not drift to unrelated concepts. Set the "concept" field on every question to "${resolvedFocusConcept}" (or a very close variant in the requested language).` : ''}${avoid.length > 0 ? `\n\nDo NOT repeat these questions that were already generated:\n${avoid.map(t => `- ${t.slice(0, 160)}`).join('\n')}` : ''}

Additional variation seed: ${Date.now()}`

    // Tek bir üretim çağrısı. Başarısızsa { error } döner, istisna fırlatmaz.
    const requestQuestions = async (count: number, avoid: string[]): Promise<{ items?: unknown[]; error?: string }> => {
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
        console.error("Groq generation failed: ", groqData)
        return { error: groqData?.error?.message || groqData?.error?.code || `HTTP ${groqResponse.status}` }
      }
      const rawContent = groqData.choices?.[0]?.message?.content ?? ""
      const items = parseQuestionArray(rawContent)
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

    const absorb = (items: unknown[]) => {
      for (const raw of items) {
        if (accepted.length >= requestedCount) break
        const result = validateQuestion(raw, allowedTypes, language)
        if (!result.ok || !result.question) {
          rejectReasons.push(result.reason || 'unknown')
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
      started_at: new Date().toISOString()
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
