import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ==========================================================================
// generate-study-image
//
// Paid, explicitly-triggered image generation for "Kaynakla Sohbet" (and
// wherever else the frontend wants a real AI-drawn illustration instead of
// the free Mermaid.js diagram reconstruction). Unlike everything else in
// this app so far (Groq, which is what chat-with-document/summarize-document
// use), there is no free tier here — every call costs real money against an
// OpenAI account, so this function is NEVER called automatically. The
// frontend only calls it when a student explicitly clicks a "Gerçek Görsel
// Oluştur (ücretli)" button.
//
// SETUP REQUIRED BEFORE THIS WORKS:
//   1. Create/have an OpenAI account with image-generation (gpt-image-1)
//      access and billing enabled.
//   2. Set the secret on Supabase:
//        supabase secrets set OPENAI_API_KEY=sk-...
//   3. Deploy this function:
//        supabase functions deploy generate-study-image
// Until step 2 is done, this function returns a clear 500 error explaining
// that the key isn't configured yet — it will not silently no-op.
// ==========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // We only need to confirm the caller is a real logged-in Acadex user —
    // this is a shared paid API key, so anonymous/unauthenticated calls must
    // be rejected outright regardless of which study card (if any) it's for.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { prompt } = await req.json()
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return new Response(JSON.stringify({ error: 'A "prompt" describing the image is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const trimmedPrompt = prompt.trim().slice(0, 800)

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(JSON.stringify({
        error: 'Image generation isn\'t set up yet — an admin needs to add an OPENAI_API_KEY secret (supabase secrets set OPENAI_API_KEY=...) and redeploy this function.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Nudge toward a clean, legible study-diagram style by default rather
    // than an arbitrary photorealistic image, since this is meant to
    // illustrate academic concepts/diagrams — but the student's own wording
    // still drives the actual content.
    const finalPrompt = `Create a clean, clearly labeled educational diagram or infographic for a university study guide. ${trimmedPrompt}. Style: simple flat design, high contrast, minimal decoration, text labels legible — not photorealistic, not cluttered.`

    let openaiResponse: Response
    try {
      openaiResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: finalPrompt,
          size: "1024x1024",
          quality: "low", // keep per-image cost down — this is a study aid, not print artwork
          n: 1
        })
      })
    } catch (fetchErr) {
      console.error("generate-study-image: OpenAI fetch exception:", fetchErr)
      return new Response(JSON.stringify({ error: 'Image generation service is unreachable right now — please try again in a moment.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const openaiData = await openaiResponse.json()
    if (!openaiResponse.ok) {
      console.error("generate-study-image: OpenAI API error:", JSON.stringify(openaiData))
      const providerMsg = openaiData?.error?.message
      return new Response(JSON.stringify({
        error: providerMsg
          ? `Image generation failed: ${providerMsg}`
          : 'Image generation failed — please try again in a moment.'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const item = openaiData?.data?.[0]
    let base64Image: string | null = item?.b64_json ?? null

    // Some OpenAI image models/response modes return a hosted URL instead of
    // inline base64 — fetch it once and inline it so the frontend always
    // gets a plain data URL, same contract regardless of provider quirks.
    if (!base64Image && item?.url) {
      try {
        const imgResp = await fetch(item.url)
        const imgBuffer = await imgResp.arrayBuffer()
        base64Image = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)))
      } catch (dlErr) {
        console.error("generate-study-image: failed to inline image URL:", dlErr)
      }
    }

    if (!base64Image) {
      console.error("generate-study-image: no image data in OpenAI response:", JSON.stringify(openaiData))
      return new Response(JSON.stringify({ error: 'Image generation returned no image data.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      image: `data:image/png;base64,${base64Image}`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Unexpected generate-study-image exception:', err)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
