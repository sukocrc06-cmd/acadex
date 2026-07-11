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
    
    const sysPrompt = `
You are an academic study assistant. You will be given a question of type '${q.type}'.
Your task is to write a single, short, helpful hint (1-2 sentences) in the language '${language}' (en = English, tr = Turkish) that guides the student toward the correct answer without revealing it.
Do NOT mention the correct answer, and do NOT give away the direct solution.
Write the hint response in the requested language '${language}' (English if 'en', Turkish if 'tr').
    `.trim()

    const userPrompt = `
QUESTION: ${q.question}
${q.options ? `OPTIONS: ${JSON.stringify(q.options)}` : ''}
    `.trim()

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    })

    const groqData = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error("Groq hint generation failed: ", groqData)
      return new Response(JSON.stringify({ error: 'AI hint service failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const hintText = groqData.choices?.[0]?.message?.content ?? ""

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
