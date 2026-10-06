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

    const { examId, questionIndex } = await req.json()
    if (!examId || questionIndex === undefined) {
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

    // Verify exam ownership and load questions
    const { data: exam, error: examError } = await userClient
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single()

    if (examError || !exam) {
      console.error("Exam ownership check failed: ", examError)
      return new Response(JSON.stringify({ error: 'Exam not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (exam.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Access denied: You do not own this exam' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const questions = exam.questions || []
    
    // Find the requested question by matching id or index
    const q = questions.find((item: any) => item.id == questionIndex)
    if (!q) {
      return new Response(JSON.stringify({ error: 'Question not found inside this exam' }), {
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

    const language = exam.language || 'en'

    // Fully static (no interpolation) so it's byte-identical on every
    // get-exam-hint call app-wide, letting Groq cache it regardless of
    // which question/language a given call is about.
    const sysPrompt = `
You are an academic study assistant. The user message will state the question's type, its text, and the target language.
Your task is to write a single, short, helpful hint (1-2 sentences), in the target language, that guides the student toward the correct answer without revealing it.
Do NOT mention the correct answer, and do NOT give away the direct solution.
    `.trim()

    const userPrompt = `
QUESTION TYPE: ${q.type}
TARGET LANGUAGE: ${language} (en = English, tr = Turkish) — write the hint in this language.
QUESTION: ${q.question}
${q.options ? `OPTIONS: ${JSON.stringify(q.options)}` : ''}
    `.trim()

    // MODEL CHOICE — REBUILT 06.10.2026, THE OLD ONE NO LONGER EXISTS.
    //
    // This call was pinned to llama-3.1-8b-instant, which Groq SHUT DOWN on
    // 2026-08-16 (console.groq.com/docs/deprecations), the same day as
    // llama-3.3-70b-versatile. The rest of the repo was migrated off the 70b
    // model at the time; this function was missed, so every hint request has
    // been failing for roughly seven weeks and the student only ever saw
    // "AI hint service failed".
    //
    // The old comment's reasoning was sound and still applies: a one-sentence
    // hint is a tiny, high-frequency call, and spending gpt-oss-120b's 1,000
    // requests/day on it — the same pool exam generation and grading draw
    // from — is the wrong trade. Groq meters per MODEL, so the fix keeps the
    // isolation by picking a different model, not a bigger one.
    //
    // Groq's own recommended replacement for 3.1-8b-instant is
    // openai/gpt-oss-20b. qwen/qwen3.8-27b backs it up so one model's
    // exhausted day does not take hints down with it.
    const hintLanes = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b']
    let hintText = ""
    let lastHintError = ""

    for (let i = 0; i < hintLanes.length; i++) {
      const lane = hintLanes[i]
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: lane,
          temperature: 0.5,
          // Per model, never written out: gpt-oss rejects
          // reasoning_effort:"none" with a 400 while qwen needs exactly
          // that. summarize-document learned this the hard way when its
          // review call started picking lanes at runtime and 400'd on every
          // gpt-oss one.
          ...(lane.includes('qwen')
            ? { reasoning_effort: "none" }
            : { reasoning_effort: "low" }),
          // WITHOUT THIS, GROQ RESERVES A LARGE DEFAULT COMPLETION BUDGET
          // against the account's 8,000 tokens-per-minute limit, and a
          // request that is otherwise tiny can be rejected outright for
          // being "too large". A hint is one or two sentences; 400 leaves
          // room for that plus the handful of reasoning tokens effort=low
          // produces (12-25 observed), since reasoning is counted against
          // this same ceiling.
          max_completion_tokens: 400,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      })

      if (!groqResponse.ok) {
        lastHintError = await groqResponse.clone().text().catch(() => '')
        const daily = /tokens per day|TPD|requests per day|RPD/i.test(lastHintError)
        console.warn(
          `get-exam-hint: ${lane} ${groqResponse.status} verdi` +
          `${daily ? ' (GUNLUK kota bitti)' : ''}` +
          `${i < hintLanes.length - 1 ? ' — sonraki seride geciliyor' : ''}`
        )
        continue
      }

      const groqData = await groqResponse.json()
      const content = String(groqData.choices?.[0]?.message?.content ?? "").trim()

      // A 200 WITH NO CONTENT IS THIS LANE FAILING, NOT THE REQUEST.
      // chat-with-document hit exactly this on 06.10.2026: gpt-oss-120b
      // answered 200 with finish_reason=stop, 147-319 completion tokens
      // produced, and an empty `content` — four times, on two different
      // questions. This call sends free prose with no response_format, the
      // same shape that failed there, so an empty answer has to fall
      // through to the next lane instead of being returned as the hint.
      if (!content) {
        const u = groqData.usage || {}
        console.warn(
          `get-exam-hint: ${lane} BOS icerik dondu ` +
          `(finish_reason=${groqData.choices?.[0]?.finish_reason ?? '?'}, ` +
          `completion=${u.completion_tokens ?? '?'}, ` +
          `reasoning=${u.completion_tokens_details?.reasoning_tokens ?? '?'})` +
          `${i < hintLanes.length - 1 ? ' — sonraki seride geciliyor' : ''}`
        )
        lastHintError = 'empty_content'
        continue
      }

      hintText = content
      if (i > 0) console.warn(`get-exam-hint: ${lane} seridine dusuldu (onceki serit kullanilamadi)`)
      break
    }

    if (!hintText) {
      console.error("get-exam-hint: tum seritler basarisiz — ", lastHintError.slice(0, 400))
      return new Response(JSON.stringify({ error: 'AI hint service failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ hint: hintText.trim() }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error("get-exam-hint exception: ", err)
    return new Response(JSON.stringify({ error: 'Internal server error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
