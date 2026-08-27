import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const { studyCardId, examType, questionCount, language, difficulty } = await req.json()
    if (!studyCardId || !examType || !questionCount || !language) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Difficulty is optional for backward compatibility with older clients; default to 'medium'.
    const allowedDifficulties = ['easy', 'medium', 'hard']
    const resolvedDifficulty = allowedDifficulties.includes(difficulty) ? difficulty : 'medium'

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

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: 'Groq API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Format study card context
    const isQuant = !!card.is_quantitative
    const context = `
SUMMARY:
${card.summary || ''}

KEY TERMS:
${JSON.stringify(card.key_terms || [])}

KEY POINTS:
${JSON.stringify(card.key_points || [])}

${card.formulas && card.formulas.length > 0 ? `FORMULAS:\n${JSON.stringify(card.formulas)}` : ''}
${card.worked_examples && card.worked_examples.length > 0 ? `WORKED EXAMPLES:\n${JSON.stringify(card.worked_examples)}` : ''}
    `.trim()

    const sysPrompt = `
You are an academic study assistant. You will be given the summary, key terms, key points, and optional formulas/examples of a study card.
Your task is to generate exactly ${questionCount} questions of type '${examType}' in the language '${language}' (en = English, tr = Turkish), at difficulty level '${resolvedDifficulty}'.

IMPORTANT VARIATION RULES:
- Generate a fresh, varied set of questions. Vary which facts, terms, and angles you focus on, and vary question phrasing — do not default to only the most obvious or first-mentioned details every time.

IMPORTANT DIFFICULTY RULES (Bloom's taxonomy):
- 'easy': Test basic recall and definitions — "what is X", matching a term to its definition, or simple direct formula plugging.
- 'medium': Test comprehension and application — explaining relationships between concepts, applying a term or multi-step formula to a short scenario.
- 'hard': Test analysis and judgment — comparing/contrasting concepts, complex calculation scenarios, or evaluating a business case.

IMPORTANT LANGUAGE RULES:
- Write ALL questions, options, hints, and solution steps strictly in the requested language '${language}' (English if 'en', Turkish if 'tr').

IMPORTANT CONCEPT TAGGING RULE:
- For every question, set a "concept" field to the single key term (from the KEY TERMS list provided) that the question is primarily testing.

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
4. 'mixed': A combination of question types.
   - ${isQuant ? "Since this card IS quantitative, distribute question types as evenly as possible across FIVE types: 'open_ended', 'multiple_choice', 'true_false', 'fill_blank', and 'calculation'." : "Since this card is NOT quantitative, distribute question types as evenly as possible across FOUR types: 'open_ended', 'multiple_choice', 'true_false', and 'fill_blank'."}
   - For 'open_ended': options = null.
   - For 'multiple_choice': exactly 4 options, correct_answer matches one option.
   - For 'true_false': options = ['True', 'False'] (if en) or ['Doğru', 'Yanlış'] (if tr).
   - For 'fill_blank': use '______' in question text. options = null.
   - For 'calculation': use the calculation question format above.

RESPONSE FORMAT:
You must output ONLY a valid JSON array of questions, with no markdown code fences (do NOT use \`\`\`json or similar), no introductory or concluding text, and no conversational commentary.
The array must contain exactly ${questionCount} objects matching this JSON schema:
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
          { role: "user", content: `${context}\n\nAdditional variation seed: ${Date.now()}` }
        ]
      })
    })

    const groqData = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error("Groq generation failed: ", groqData)
      return new Response(JSON.stringify({ error: 'AI generation service failed' }), {
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

    const { data: newExam, error: insertError } = await serviceClient
      .from('exams')
      .insert({
        study_card_id: studyCardId,
        user_id: user.id,
        exam_type: examType,
        language: language,
        question_count: questionCount,
        questions: questionsArray,
        answers: null,
        question_results: null,
        grade: null,
        completed_at: null
      })
      .select()
      .single()

    if (insertError || !newExam) {
      console.error("Failed to insert exam record: ", insertError)
      return new Response(JSON.stringify({ error: 'Failed to save generated exam' }), {
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
