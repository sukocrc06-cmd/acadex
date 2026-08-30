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
   - For 'fill_blank': use '______' in question text. options = null.
   - For 'calculation': use the calculation question format above.
The user message states exactly which exam type and how many questions to generate.

RESPONSE FORMAT:
You must output ONLY a valid JSON array of questions, with no markdown code fences (do NOT use \`\`\`json or similar), no introductory or concluding text, and no conversational commentary.
The array's length must exactly equal the question count requested in the user message. Each object must match this JSON schema:
[
  {
    "id": number (1-based index),
    "type": "multiple_choice" | "open_ended" | "true_false" | "fill_blank" | "calculation",
    "question": "string",
    "options": ["string"] | null,
    "correct_answer": "string" | number,
    "tolerance_percent": number | null,
    "units": "string" | null,
    "solution_steps": ["string"] | null,
    "hint": "string (short helpful clue)",
    "concept": "string"
  }
]
`.trim()

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
      timeLimitSeconds = Math.max(300, Math.round(questionCount * perQ))
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
    const userPrompt = `Generate exactly ${questionCount} questions of type '${examType}' in the language '${language}' (en = English, tr = Turkish), at difficulty level '${resolvedDifficulty}'.${resolvedFocusConcept ? `\n\nIMPORTANT FOCUS RULE:\n- The student specifically wants to practice ONE topic: "${resolvedFocusConcept}". EVERY question must test this exact topic, approached from different angles (definition, application, comparison, scenario) — do not drift to unrelated concepts. Set the "concept" field on every question to "${resolvedFocusConcept}" (or a very close variant in the requested language).` : ''}

Additional variation seed: ${Date.now()}`

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
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    })

    const groqData = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error("Groq generation failed: ", groqData)
      const groqDetail = groqData?.error?.message || groqData?.error?.code || `HTTP ${groqResponse.status}`
      return new Response(JSON.stringify({ error: `AI generation service failed: ${groqDetail}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const rawContent = groqData.choices?.[0]?.message?.content ?? ""
    const cleaned = rawContent.replace(/```json\s*|```/g, "").trim()

    let questionsArray
    try {
      questionsArray = JSON.parse(cleaned)
    } catch (e) {
      console.error("Failed to parse Groq response as JSON. Content: ", rawContent, e)
      return new Response(JSON.stringify({ error: 'AI returned invalid question formatting. Please try again.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
      console.error("AI response is not a valid non-empty array: ", questionsArray)
      return new Response(JSON.stringify({ error: 'AI failed to generate a list of questions.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Stamp the requested difficulty onto every question server-side (rather than
    // trusting the model to echo it back correctly). Stored inside the questions
    // JSONB array so it works without any 'exams' table schema changes.
    questionsArray = questionsArray.map((q: Record<string, unknown>) => ({
      ...q,
      difficulty: resolvedDifficulty
    }))

    // Service role client to insert exam record
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const examInsertPayload: Record<string, unknown> = {
      user_id: user.id,
      exam_type: examType,
      language: language,
      question_count: questionCount,
      questions: questionsArray,
      answers: null,
      question_results: null,
      grade: null,
      completed_at: null,
      source_type: resolvedSourceType,
      is_simulation: resolvedIsSimulation,
      time_limit_seconds: timeLimitSeconds
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

    const { data: newExam, error: insertError } = await serviceClient
      .from('exams')
      .insert(examInsertPayload)
      .select()
      .single()

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
