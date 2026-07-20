import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 429) {
        // Rate limited — wait longer before retrying
        await new Promise(r => setTimeout(r, 2500));
      } else if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 800));
      } else {
        return response;
      }
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  throw new Error("Max retries exceeded");
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

    const { studyCardId, section } = await req.json()
    if (!studyCardId || !section) {
      return new Response(JSON.stringify({ error: 'studyCardId and section are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const allowedSections = ['summary', 'key_terms', 'key_points', 'quiz_questions']
    if (!allowedSections.includes(section)) {
      return new Response(JSON.stringify({ error: 'Invalid section' }), {
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

    // 1. Verify card ownership
    const { data: card, error: cardError } = await userClient
      .from('study_cards')
      .select('*')
      .eq('id', studyCardId)
      .single()

    if (cardError || !card) {
      console.error('Study card not found or access denied:', cardError)
      return new Response(JSON.stringify({ error: 'Study card not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      console.error('Missing GROQ_API_KEY env secret')
      return new Response(JSON.stringify({ error: 'AI summarization key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const style = card.summary_style || 'standard'
    const len = card.summary_length || 'medium'
    const lang = card.summary_language || 'en'
    const langLabel = lang === 'tr' ? 'Turkish / Türkçe' : 'English'

    // Define style instruction
    let styleInstruction = "Write the summary as 4-8 well-formed sentences in flowing prose."
    if (style === 'bullet') {
      styleInstruction = "Write the summary as a series of SHORT bullet points, each starting with '- ' at the beginning of its own line (use '\\n' between each bullet). Do NOT write flowing paragraph sentences — every line must be a distinct, concise bullet fragment, not a full narrative paragraph. Aim for 6-10 bullets."
    } else if (style === 'outline') {
      styleInstruction = "Write the summary as a hierarchical outline. Use '## ' prefixed lines for major section headings (identify 2-4 natural sections in the material), and '- ' prefixed indented lines beneath each heading for sub-points. Use '\\n' between every line. This must visually read as a structured outline, NOT as flowing paragraph prose."
    } else if (style === 'simplified') {
      styleInstruction = "Write the summary in very short sentences (aim for under 15 words per sentence) using simple, everyday vocabulary. Avoid compound/complex sentence structures. Explain any necessary technical term immediately in parentheses using plain language."
    } else if (style === 'exam_focused') {
      styleInstruction = "Write the summary as terse, fact-dense statements — prefer sentence fragments and direct statements over flowing narrative connectors like 'furthermore' or 'in addition.' Each sentence should pack in a specific fact, definition, or relationship. Keep it noticeably more compact and dense than a standard-style summary, with less narrative connective tissue between ideas."
    }

    // Define length instruction
    let lengthInstruction = "Write a balanced summary in 4-8 sentences. Include 5-10 key terms, 5-10 key points, and 4-6 quiz questions."
    if (len === 'short') {
      lengthInstruction = "Write a concise summary in 2-3 sentences. Include only the 3-5 most essential key terms, 3-5 key points, and 3 quiz questions."
    } else if (len === 'detailed') {
      lengthInstruction = "Write a thorough, in-depth summary (8-14 sentences). Include 10-15 key terms, 10-15 key points, and 6-8 quiz questions covering the material comprehensively."
    }

    // Generate prompt instructions based on the requested section
    let sectionPrompt = ""
    let jsonShape = ""
    if (section === 'summary') {
      sectionPrompt = `Generate a fresh, improved version of the summary. Style: ${styleInstruction}`
      jsonShape = `{ "summary": string }`
    } else if (section === 'key_terms') {
      sectionPrompt = `Generate a fresh, improved set of key terms (definitions). Length: ${lengthInstruction}`
      jsonShape = `{ "key_terms": [ { "term": string, "definition": string } ] }`
    } else if (section === 'key_points') {
      sectionPrompt = `Generate a fresh, improved set of key points. Length: ${lengthInstruction}`
      jsonShape = `{ "key_points": [ string ] }`
    } else if (section === 'quiz_questions') {
      sectionPrompt = `Generate a fresh, improved set of self-test quiz questions with answers. Length: ${lengthInstruction}`
      jsonShape = `{ "quiz_questions": [ { "question": string, "answer": string } ] }`
    }

    const systemPrompt = `You are an academic study assistant. You will be given the existing summary and metadata of a study card. Your task is to regenerate ONLY the "${section}" section of the study card.
Respond with ONLY a valid JSON object matching this exact shape: ${jsonShape}. No markdown code fences, no commentary before or after.

INSTRUCTION FOR REGENERATING:
${sectionPrompt}

ACCURACY INSTRUCTION:
Do not invent facts or add info not supported by the context.

LANGUAGE INSTRUCTION:
Respond strictly in language: "${langLabel}". Translate all output fields into that language.`

    const userPrompt = `Existing study card context:
- Summary: "${card.summary || ''}"
- Style settings: ${style}
- Length settings: ${len}
- Language: ${langLabel}`

    let groqResponse
    try {
      groqResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ]
        })
      })
    } catch (fetchErr) {
      console.error("Groq API regenerate-section fetch exception: ", fetchErr)
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const groqData = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error("Groq API regenerate-section failed: ", JSON.stringify(groqData))
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const rawContent = groqData.choices?.[0]?.message?.content ?? ""
    if (!rawContent) {
      console.error('Empty response content from Groq regenerate-section')
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const cleaned = rawContent.replace(/```json\s*|```/g, "").trim()
    let parsedContent
    try {
      parsedContent = JSON.parse(cleaned)
    } catch (parseError) {
      console.error("Failed to parse regenerated section JSON: ", rawContent, parseError)
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON formatting' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const contentValue = parsedContent[section]
    if (contentValue === undefined) {
      console.error(`Regenerated section is missing the key "${section}":`, parsedContent)
      return new Response(JSON.stringify({ error: 'AI response was missing the requested section' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Perform update via service client
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { error: updateError } = await serviceClient
      .from('study_cards')
      .update({ [section]: contentValue })
      .eq('id', studyCardId)

    if (updateError) {
      console.error('Failed to update study card section:', updateError)
      return new Response(JSON.stringify({ error: 'Failed to save updated section' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, content: contentValue }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Unexpected exception in regenerate-section:', err)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
