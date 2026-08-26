import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ==========================================================================
// Sesli Özet (AI Podcast) — turns an existing study card into a short,
// natural two-host dialogue script. The script is read aloud client-side
// with the free browser Web Speech API (no TTS API cost) — this function's
// only job is to WRITE the conversation, grounded strictly in the study
// card's own content (never inventing facts not already in the summary).
//
// Output is cached on study_cards.podcast_script so a card's audio overview
// is generated once, not regenerated on every listen.
// ==========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2, timeoutMs = 25000): Promise<Response> {
  let lastRateLimitedResponse: Response | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeoutId)
      if (response.ok) return response
      if (response.status === 429) {
        lastRateLimitedResponse = response
        let bodyPreview = ""
        try { bodyPreview = await response.clone().text() } catch (_e) { /* ignore */ }
        console.warn(`fetchWithRetry: 429 rate-limited (attempt ${attempt + 1}/${maxRetries + 1}): ${bodyPreview}`)
        const retryAfterMatch = bodyPreview.match(/try again in ([\d.]+)s/i)
        const waitMs = retryAfterMatch
          ? Math.min(Math.ceil(parseFloat(retryAfterMatch[1]) * 1000) + 500, 30000)
          : 2500
        await new Promise(r => setTimeout(r, waitMs))
      } else if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 800))
      } else {
        return response
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (attempt === maxRetries) throw err
      await new Promise(r => setTimeout(r, 800))
    }
  }
  if (lastRateLimitedResponse) return lastRateLimitedResponse
  throw new Error("Max retries exceeded")
}

function stripThinkBlock(raw: string): string | null {
  const match = raw.match(/<think>[\s\S]*?<\/think>/i)
  if (match) return raw.slice((match.index ?? 0) + match[0].length).trim()
  if (/^\s*<think>/i.test(raw)) return null
  return raw
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

    const { studyCardId } = await req.json()
    if (!studyCardId) {
      return new Response(JSON.stringify({ error: 'studyCardId is required' }), {
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

    // 1. Verify ownership / access and pull the content to ground the script in
    const { data: card, error: cardError } = await userClient
      .from('study_cards')
      .select('id, summary, summary_executive, outline, sections, key_points, key_terms, summary_language, podcast_script')
      .eq('id', studyCardId)
      .single()

    if (cardError || !card) {
      console.error('Study card not found or access denied:', cardError)
      return new Response(JSON.stringify({ error: 'Study card not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Already generated — return the cached script instead of spending another
    // Groq call. The frontend can pass a `force` flag later if a "regenerate"
    // action is ever added; not exposed today to keep this a one-time cost.
    const existing = card.podcast_script
    if (existing && Array.isArray(existing.script) && existing.script.length > 0) {
      return new Response(JSON.stringify({ success: true, podcast: existing, cached: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      console.error('Missing GROQ_API_KEY env secret')
      return new Response(JSON.stringify({ error: 'AI service key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const lang = card.summary_language || 'en'
    const langLabel = lang === 'tr' ? 'Turkish / Türkçe' : 'English'
    const hostNames = lang === 'tr' ? ['Ela', 'Kaan'] : ['Alex', 'Sam']

    const sections = Array.isArray(card.sections) ? card.sections : []
    const keyPoints = Array.isArray(card.key_points) ? card.key_points : []
    const keyTerms = Array.isArray(card.key_terms) ? card.key_terms : []
    const outlineTitle = card.outline?.document_title_guess || ''

    const groundingBlock = [
      outlineTitle ? `Document subject: ${outlineTitle}` : '',
      card.summary_executive ? `Executive overview: ${card.summary_executive}` : '',
      card.summary ? `Full summary:\n${String(card.summary).slice(0, 4000)}` : '',
      sections.length
        ? `Section-by-section breakdown:\n${sections.slice(0, 8).map((s: any, i: number) => `${i + 1}. ${s.heading}: ${String(s.summary || '').slice(0, 400)}`).join('\n')}`
        : '',
      keyPoints.length ? `Key points: ${keyPoints.slice(0, 12).join(' | ')}` : '',
      keyTerms.length ? `Key terms: ${keyTerms.slice(0, 10).map((t: any) => `${t.term} = ${t.definition}`).join(' | ')}` : ''
    ].filter(Boolean).join('\n\n')

    if (!groundingBlock.trim()) {
      return new Response(JSON.stringify({ error: 'This card has no summarized content yet to build a podcast from' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const systemPrompt = `You write short, natural two-host podcast scripts that turn a student's study material into an engaging spoken conversation — the same idea as an AI "audio overview" feature. The two hosts are named "${hostNames[0]}" (speaker "A") and "${hostNames[1]}" (speaker "B").

Respond with ONLY valid JSON: { "title": string, "script": [ { "speaker": "A" | "B", "text": string } ] }. No markdown fences, no commentary.

RULES:
- 14 to 22 lines total (a real back-and-forth, not two monologues). Each line is 1-3 sentences, written to be spoken aloud (short sentences, no bullet symbols, no markdown, no citation markers like [1]).
- Ground EVERYTHING in the provided material below. Never invent facts, numbers, or examples that aren't in the source content. If the material is thin, keep the script shorter rather than padding with filler.
- Sound like two genuinely interested people explaining this to a friend before an exam: A opens with a hook about what the document covers, B asks a natural follow-up or reacts, and they alternate covering the executive overview, the main sections/topics, and the 2-4 most important key points or terms — in that rough order.
- End with a short, upbeat wrap-up line from either host (e.g. what to remember most).
- Do NOT use stage directions, sound effects, or host name labels inside "text" — "text" is exactly what that host says, nothing else.
- Write entirely in ${langLabel}.`

    const userPrompt = `Study material to turn into a podcast script:\n\n${groundingBlock}`

    let groqResponse
    try {
      groqResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          // llama-3.3-70b-versatile was retired by Groq on 2026-08-16 (calls
          // now fail with a decommissioned-model error, surfaced to the
          // frontend as a 502) — openai/gpt-oss-120b is Groq's recommended
          // replacement, already adopted by summarize-document.
          model: "openai/gpt-oss-120b",
          temperature: 0.6,
          reasoning_effort: "low",
          include_reasoning: false,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      })
    } catch (fetchErr) {
      console.error("Groq API generate-podcast-script fetch exception:", fetchErr)
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const groqData = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error("Groq API generate-podcast-script failed:", JSON.stringify(groqData))
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const rawContent = groqData.choices?.[0]?.message?.content ?? ""
    const stripped = stripThinkBlock(rawContent)
    if (!stripped) {
      console.error('Empty/unterminated-think response from Groq generate-podcast-script')
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const cleaned = stripped.replace(/```json\s*|```/g, "").trim()
    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseError) {
      console.error("Failed to parse podcast script JSON:", rawContent, parseError)
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON formatting' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const scriptArr = Array.isArray(parsed.script)
      ? parsed.script
          .map((line: any) => ({
            speaker: line?.speaker === 'B' ? 'B' : 'A',
            text: String(line?.text || '').trim()
          }))
          .filter((line: any) => line.text.length > 0)
          .slice(0, 30)
      : []

    if (scriptArr.length === 0) {
      return new Response(JSON.stringify({ error: 'AI did not return a usable script — please try again' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const podcast = {
      title: String(parsed.title || outlineTitle || 'Sesli Özet').slice(0, 140),
      hostNames,
      script: scriptArr
    }

    // 2. Persist via service role (RLS-safe: ownership was already verified above)
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { error: updateError } = await serviceClient
      .from('study_cards')
      .update({ podcast_script: podcast })
      .eq('id', studyCardId)

    if (updateError) {
      console.error('Failed to save podcast script:', updateError)
      // Non-fatal for the user — they still get the script back and can listen
      // now, it just won't be cached for next time.
    }

    return new Response(JSON.stringify({ success: true, podcast, cached: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Unexpected exception in generate-podcast-script:', err)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
