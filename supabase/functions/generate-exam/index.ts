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

    const { studyCardId, examType, questionCount, language } = await req.json()
    if (!studyCardId || !examType || !questionCount || !language) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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
    const context = `
SUMMARY:
${card.summary || ''}

KEY TERMS:
${JSON.stringify(card.key_terms || [])}

KEY POINTS:
${JSON.stringify(card.key_points || [])}
    `.trim()

    const sysPrompt = `
You are an academic study assistant. You will be given the summary, key terms, and key points of a study card.
Your task is to generate exactly ${questionCount} questions of type '${examType}' in the language '${language}' (en = English, tr = Turkish).

IMPORTANT VARIATION RULES:
- Generate a fresh, varied set of questions. Vary which facts, terms, and angles you focus on, and vary question phrasing — do not default to only the most obvious or first-mentioned details every time.

IMPORTANT LANGUAGE RULES:
- Write ALL questions, options, correct answers, and hints strictly in the requested language '${language}' (English if 'en', Turkish if 'tr'), regardless of the language of the source text.
- Do not mix languages.

EXAM TYPE RULES:
1. 'classic': All questions must be open-ended (free-text essay questions). The options field should be null.
2. 'test': All questions must be multiple-choice. Each question must have exactly 4 options. The correct_answer field must be exactly equal to one of the options.
3. 'mixed': A combination of all four question types: 'open_ended' (classic), 'multiple_choice' (test), 'true_false', and 'fill_blank'.
   - You MUST distribute the question types as evenly as possible across the requested ${questionCount} questions. For example, if ${questionCount} is 20, generate exactly 5 of each type.
   - For 'open_ended' type: options should be null.
   - For 'multiple_choice' type: exactly 4 options, correct_answer must match one of the options.
   - For 'true_false' type: options must be exactly ['True', 'False'] (if en) or ['Doğru', 'Yanlış'] (if tr).
   - For 'fill_blank' type: use '______' (underscores) in the question text to represent the blank. The options field should be null.

RESPONSE FORMAT:
You must output ONLY a valid JSON array of questions, with no markdown code fences (do NOT use \`\`\`json or similar), no introductory or concluding text, and no conversational commentary.
The array must contain exactly ${questionCount} objects matching this JSON schema:
[
  {
    "id": number (1-based index),
    "type": "multiple_choice" | "open_ended" | "true_false" | "fill_blank",
    "question": "string",
    "options": ["string"] | null,
    "correct_answer": "string",
    "hint": "string (a short helpful clue or context indicator to help the student answer)"
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
        model: "llama-3.3-70b-versatile",
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
