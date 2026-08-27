// ==========================================================================
// Acadex — "Acadex Sunum" Deep Research presentation generation
//
// acadex-sunum.html's fast/default "ACADEX SUNUMU OLUŞTUR" button builds a
// deck locally in the browser from a template engine (buildAcadiaSlideDeck)
// — instant, but the content is generic structural filler with the topic
// name substituted in, not real researched facts. This function powers the
// "Derinlemesine Araştır" (Deep Research) option: it asks Groq to actually
// research the given topic and write real, specific, factual slide content
// (titles, bullet points, speaker notes) — same Giriş → Problem → Analiz →
// Çözüm → Sonuç stage structure the local template engine already uses, so
// the two generation modes stay visually/structurally interchangeable in
// the renderer.
//
// Stateless: unlike generate-exam, nothing is written to Supabase here —
// the presentation itself only ever lives in acadex-sunum.html's own
// localStorage-based slide state. This function just returns JSON.
//
// Deploy: `supabase functions deploy generate-presentation`, using the
// same GROQ_API_KEY secret already used by generate-exam / grade-exam /
// acadia-assistant.
// ==========================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const STAGE_LABELS: Record<string, string> = {
  giris: 'Giriş / Kavramsal Çerçeve',
  problem: 'Problem / Zorluk / Bağlam',
  analiz: 'Analiz / Bulgular / Gelişmeler',
  cozum: 'Çözüm / Sonuçlar / Etki',
  sonuc: 'Sonuç / Kapanış'
}

const TONE_HINTS: Record<string, string> = {
  academic: 'Akademik bir dille yazın; kavramları net tanımlayın, tarihsel/bilimsel doğruluğa özen gösterin.',
  corporate: 'Kurumsal ve karar odaklı bir dille yazın; net, aksiyona dönük ifadeler kullanın.',
  creative: 'Daha canlı, hikâye anlatan bir dil kullanın; dinleyiciyi ilgiyle bağlayın — ama gerçek bilgiden sapmayın.',
  summary: 'Kısa, net, madde işaretine uygun cümleler kurun; gereksiz süslemeden kaçının.'
}

function isTokenSizeError(status: number, body: any): boolean {
  return (status === 400 || status === 429 || status === 413) &&
    (body?.error?.code === 'rate_limit_exceeded' || /token/i.test(String(body?.error?.message || '')))
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

    const { topic, tone, slideCount, language } = await req.json()
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return new Response(JSON.stringify({ error: 'Missing "topic" parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const safeTopic = topic.trim().slice(0, 200)
    const allowedTones = ['academic', 'corporate', 'creative', 'summary']
    const resolvedTone = allowedTones.includes(tone) ? tone : 'academic'
    const requestedSlides = Math.max(5, Math.min(10, parseInt(slideCount) || 7))
    const lang = (language === 'en') ? 'en' : 'tr'

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

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
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

    const buildSystemPrompt = (slideN: number, bulletsPerSlide: string) => `
You are a research assistant building a REAL, factually-grounded slide deck for a Business Faculty student at Acadex, on the topic: "${safeTopic}".

This is NOT a generic template — every slide's title, bullets, and speaker notes must contain genuine, specific, accurate information about "${safeTopic}" itself (real dates, names, figures, causes, mechanisms, examples — whatever is factually true and relevant to this exact topic). Do not write generic placeholder sentences that merely restate the topic name. If you are not confident about a specific fact (an exact number, date, or quote), phrase it in general but still substantive terms rather than inventing a precise-sounding but false detail.

The deck must have exactly ${slideN} slides, following this narrative arc (adapt each stage's MEANING to fit the topic — for a historical topic "problem" might mean the situation/conflict, for a business topic it might mean a market problem, etc., but always keep it concrete to "${safeTopic}"):
1. Giriş (giris) — introduce the topic and why it matters.
2+. Problem (problem) — the core situation, conflict, question, or challenge.
Analiz (analiz) — the real details: key facts, actors, mechanisms, data, developments.
Çözüm (cozum) — the resolution, outcome, impact, or key takeaway insights.
Son slide: Sonuç (sonuc) — a closing summary and, if relevant, why it still matters today.
Distribute the ${slideN} slides across these stages sensibly (more slides in "analiz" for topics with a lot of substance, e.g. give analiz 2-4 slides when ${slideN} is large).

Tone: ${TONE_HINTS[resolvedTone]}
Language: write ALL slide content in ${lang === 'tr' ? 'Turkish' : 'English'}.

Each slide needs:
- "stage": one of "giris", "problem", "analiz", "cozum", "sonuc" (matching the arc above).
- "title": a specific, informative slide title (NOT just the topic name repeated) — under 60 characters.
- "bullets": ${bulletsPerSlide} substantive bullet points (each roughly 90-160 characters — full, information-dense sentences, not fragments), containing real, specific content — not generic filler. Favor depth: include concrete facts, figures, causes/effects, comparisons, or examples in each bullet rather than a single vague claim.
- "notes": 4-6 sentences of speaker notes — a genuinely rich paragraph of talking points/context a presenter would say aloud for this slide, grounded in real, specific information about the topic (not generic presenting advice).

This deck should read as a DETAILED, content-rich presentation — the student is relying on it to actually learn the topic, not just see slide headers. Err on the side of more real information per slide rather than less.

RESPONSE FORMAT — output ONLY a valid JSON object, no markdown code fences, no commentary, matching exactly:
{
  "slides": [
    { "stage": "giris", "title": "string", "bullets": ["string", "..."], "notes": "string" }
  ]
}
The "slides" array must contain exactly ${slideN} objects.
`.trim()

    const callGroq = async (slideN: number, bulletsPerSlide: string) => {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          // llama-3.3-70b-versatile was retired by Groq on 2026-08-16 — every
          // call here was failing with a decommissioned-model error (surfaced
          // to the user as "AI generation service failed"), which is why
          // "Derinlemesine Araştır" looked broken/nonexistent. openai/gpt-oss-120b
          // is Groq's recommended replacement, already adopted by
          // summarize-document and generate-section-visual for the same reason.
          model: "openai/gpt-oss-120b",
          temperature: 0.7,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: buildSystemPrompt(slideN, bulletsPerSlide) },
            { role: "user", content: `Konu: ${safeTopic}\nSlayt sayısı: ${slideN}\nVaryasyon tohumu: ${Date.now()}` }
          ]
        })
      })
      const data = await resp.json()
      return { resp, data }
    }

    let { resp: groqResponse, data: groqData } = await callGroq(requestedSlides, '4-6')
    let effectiveSlideCount = requestedSlides

    if (!groqResponse.ok && isTokenSizeError(groqResponse.status, groqData)) {
      console.warn('generate-presentation: token-size error on first attempt, retrying with fewer/shorter slides.')
      effectiveSlideCount = Math.min(requestedSlides, 5)
      ;({ resp: groqResponse, data: groqData } = await callGroq(effectiveSlideCount, '3-4'))
    }

    if (!groqResponse.ok) {
      console.error("generate-presentation Groq call failed: ", groqData)
      // Surface the real Groq failure reason (decommissioned model, invalid
      // key, rate limit, provider outage, etc.) instead of a single generic
      // string — the generic message made every distinct failure mode look
      // identical to the user and to us when diagnosing from a screenshot.
      const groqDetail = groqData?.error?.message || groqData?.error?.code || `HTTP ${groqResponse.status}`
      return new Response(JSON.stringify({ error: `AI generation service failed: ${groqDetail}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const rawContent = groqData.choices?.[0]?.message?.content ?? ""
    const cleaned = rawContent.replace(/```json\s*|```/g, "").trim()

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch (e) {
      console.error("Failed to parse Groq response as JSON. Content: ", rawContent, e)
      return new Response(JSON.stringify({ error: 'AI returned invalid formatting. Please try again.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const slidesArray = Array.isArray(parsed?.slides) ? parsed.slides : (Array.isArray(parsed) ? parsed : null)
    if (!slidesArray || slidesArray.length === 0) {
      console.error("AI response has no valid slides array: ", parsed)
      return new Response(JSON.stringify({ error: 'AI failed to generate slide content.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const allowedStages = ['giris', 'problem', 'analiz', 'cozum', 'sonuc']
    const cleanSlides = slidesArray.slice(0, 10).map((s: any, idx: number) => ({
      stage: allowedStages.includes(s?.stage) ? s.stage : (idx === 0 ? 'giris' : (idx === slidesArray.length - 1 ? 'sonuc' : 'analiz')),
      title: (typeof s?.title === 'string' && s.title.trim()) ? s.title.trim().slice(0, 90) : safeTopic,
      bullets: Array.isArray(s?.bullets) ? s.bullets.filter((b: any) => typeof b === 'string' && b.trim()).map((b: string) => b.trim().slice(0, 220)).slice(0, 7) : [],
      notes: (typeof s?.notes === 'string') ? s.notes.trim().slice(0, 900) : ''
    }))

    return new Response(JSON.stringify({ slides: cleanSlides, slideCount: cleanSlides.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error("generate-presentation exception: ", err)
    return new Response(JSON.stringify({ error: 'Internal server error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
