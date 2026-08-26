import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ==========================================================================
// On-demand section visual generator — the "🎨 Görsel Oluştur" button inside
// a study card's deep-section reading view. A student picks one of three
// FREE, text-based visual types for a single section they're reading:
//   - diagram : a small Mermaid diagram (flow/relationship of the section)
//   - table   : a markdown-reconstructed comparison/structure table
//   - chart   : a bar/pie/line chart built from numbers already in the text
//
// This deliberately reuses the existing free Groq text pipeline (the same
// one summarize-document already uses for diagrams/tables/charts) instead of
// a billed image-generation API — the project has a standing precedent of
// removing "generate a real image" buttons to avoid unlimited per-click
// billing (see generate-study-image / generateRealImageForChat, both
// intentionally left unused). This keeps the new button at the same $0
// marginal cost as the rest of the summarization feature.
//
// Each call appends exactly ONE new artifact to the card's existing
// diagrams/tables/charts array (never overwrites what's already there), so a
// student can generate a visual per section without losing earlier ones.
// ==========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_TYPES = ['diagram', 'table', 'chart']

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

    const body = await req.json()
    const { studyCardId, sectionHeading, sectionSummary, visualType } = body
    const sectionKeyPoints = Array.isArray(body.sectionKeyPoints) ? body.sectionKeyPoints : []

    if (!studyCardId) {
      return new Response(JSON.stringify({ error: 'studyCardId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (!sectionHeading || !String(sectionHeading).trim()) {
      return new Response(JSON.stringify({ error: 'sectionHeading is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (!ALLOWED_TYPES.includes(visualType)) {
      return new Response(JSON.stringify({ error: `visualType must be one of: ${ALLOWED_TYPES.join(', ')}` }), {
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

    // 1. Verify ownership / access, and load the arrays we'll append into
    const { data: card, error: cardError } = await userClient
      .from('study_cards')
      .select('id, summary_language, diagrams, tables, charts')
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
      return new Response(JSON.stringify({ error: 'AI service key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const lang = card.summary_language || 'en'
    const langLabel = lang === 'tr' ? 'Turkish / Türkçe' : 'English'

    const groundingBlock = [
      `Section heading: ${String(sectionHeading).slice(0, 200)}`,
      sectionSummary ? `Section content:\n${String(sectionSummary).slice(0, 5000)}` : '',
      sectionKeyPoints.length ? `Key points from this section: ${sectionKeyPoints.slice(0, 15).join(' | ')}` : ''
    ].filter(Boolean).join('\n\n')

    if (!sectionSummary || !String(sectionSummary).trim()) {
      return new Response(JSON.stringify({ error: 'This section has no content yet to visualize' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Build a schema + instructions scoped to exactly ONE artifact of the
    // requested type, matching the shapes summarize-document already emits
    // (so the existing frontend renderers work unmodified).
    let schemaDescription = ''
    let typeInstructions = ''

    if (visualType === 'diagram') {
      schemaDescription = `{ "title": string, "mermaid": string, "description": string }`
      typeInstructions = `Produce ONE small Mermaid diagram (flowchart, "graph TD" or "graph LR") that visualizes the structure, process, or relationships described in this section — e.g. steps in a process, cause-and-effect, a hierarchy, or how the mentioned concepts connect. Keep it to 4-10 nodes. The "mermaid" field must be valid Mermaid syntax only (no markdown fences). "description" is one short sentence (in ${langLabel}) explaining what the diagram shows.`
    } else if (visualType === 'table') {
      schemaDescription = `{ "title": string, "headers": string[], "rows": string[][] }`
      typeInstructions = `Produce ONE table that reconstructs or organizes information from this section — e.g. a comparison, a list of items with their properties, definitions, or a step-by-step breakdown. 2-6 columns, up to 10 rows. Every cell must come from the section content — do not invent data.`
    } else {
      schemaDescription = `{ "title": string, "type": "bar" | "pie" | "line", "labels": string[], "data": number[] }`
      typeInstructions = `Produce ONE chart ONLY if this section contains real numeric data (statistics, percentages, quantities, trends). Choose "bar" for comparisons, "pie" for proportions/shares, "line" for a trend over time/sequence. "labels" and "data" must be the same length and both must reflect numbers actually present in the section — never invented or estimated. If the section truly has no usable numeric data, still return the best-fit small chart using the clearest countable facts available (e.g. counts of listed items), but never fabricate precise figures.`
    }

    const systemPrompt = `You are a study-material visualization assistant. A student is reading one section of their document summary and wants ONE ${visualType} generated from just that section, to help them understand or memorize it visually.

Respond with ONLY valid JSON matching this exact shape: ${schemaDescription}. No markdown fences, no commentary, no extra fields.

RULES:
- Base the ${visualType} strictly on the section content given below. Never invent facts, numbers, or relationships that aren't there or reasonably implied by it.
- "title" should be short and specific to this section (in ${langLabel}), not generic.
- ${typeInstructions}
- This is exam-prep material — focus on what would help a student remember or understand the section faster, not decoration.`

    const userPrompt = `Section to visualize:\n\n${groundingBlock}`

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
          temperature: 0.4,
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
      console.error("Groq API generate-section-visual fetch exception:", fetchErr)
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const groqData = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error("Groq API generate-section-visual failed:", JSON.stringify(groqData))
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const rawContent = groqData.choices?.[0]?.message?.content ?? ""
    const stripped = stripThinkBlock(rawContent)
    if (!stripped) {
      console.error('Empty/unterminated-think response from Groq generate-section-visual')
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
      console.error("Failed to parse section visual JSON:", rawContent, parseError)
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON formatting' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Validate + shape the single artifact, matching existing schemas exactly
    let artifact: any = null
    let targetColumn: 'diagrams' | 'tables' | 'charts'

    if (visualType === 'diagram') {
      targetColumn = 'diagrams'
      const mermaid = String(parsed.mermaid || '').trim()
      if (!mermaid) {
        return new Response(JSON.stringify({ error: 'AI did not return a usable diagram — please try again' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      artifact = {
        title: String(parsed.title || sectionHeading).slice(0, 140),
        mermaid,
        description: String(parsed.description || '').slice(0, 300)
      }
    } else if (visualType === 'table') {
      targetColumn = 'tables'
      const headers = Array.isArray(parsed.headers) ? parsed.headers.map((h: any) => String(h).slice(0, 80)).slice(0, 8) : []
      const rows = Array.isArray(parsed.rows)
        ? parsed.rows
            .filter((r: any) => Array.isArray(r))
            .map((r: any[]) => r.map((c: any) => String(c ?? '').slice(0, 200)).slice(0, headers.length || 8))
            .slice(0, 12)
        : []
      if (headers.length === 0 || rows.length === 0) {
        return new Response(JSON.stringify({ error: 'AI did not return a usable table — please try again' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      artifact = {
        title: String(parsed.title || sectionHeading).slice(0, 140),
        headers,
        rows
      }
    } else {
      targetColumn = 'charts'
      const chartType = ['bar', 'pie', 'line'].includes(parsed.type) ? parsed.type : 'bar'
      const labels = Array.isArray(parsed.labels) ? parsed.labels.map((l: any) => String(l).slice(0, 60)).slice(0, 12) : []
      const data = Array.isArray(parsed.data)
        ? parsed.data.map((d: any) => (typeof d === 'number' && isFinite(d) ? d : parseFloat(d))).filter((d: number) => isFinite(d)).slice(0, 12)
        : []
      if (labels.length === 0 || data.length === 0 || labels.length !== data.length) {
        return new Response(JSON.stringify({ error: 'This section did not have enough clear numeric data for a chart — try a diagram or table instead' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      artifact = {
        title: String(parsed.title || sectionHeading).slice(0, 140),
        type: chartType,
        labels,
        data
      }
    }

    // 4. Append (never overwrite) into the corresponding array via service role
    const existingArr = Array.isArray((card as any)[targetColumn]) ? (card as any)[targetColumn] : []
    const updatedArr = [...existingArr, artifact]

    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { error: updateError } = await serviceClient
      .from('study_cards')
      .update({ [targetColumn]: updatedArr })
      .eq('id', studyCardId)

    if (updateError) {
      console.error(`Failed to append ${visualType} to study card:`, updateError)
      return new Response(JSON.stringify({ error: 'Generated successfully but failed to save — please try again' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, visualType, targetColumn, artifact, index: updatedArr.length - 1 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Unexpected exception in generate-section-visual:', err)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
