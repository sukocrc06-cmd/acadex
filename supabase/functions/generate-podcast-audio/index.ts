import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ==========================================================================
// Sesli Özet (AI Podcast) — real neural voice audio.
//
// generate-podcast-script only WRITES the two-host dialogue text. This
// function turns that text into actual MP3 audio using ElevenLabs' free-tier
// multilingual TTS (genuinely warm, fluent voices, Turkish included), uploads
// one MP3 per line to Supabase Storage, and caches the resulting URLs on
// study_cards.podcast_script.audio so this only ever runs ONCE per card —
// exactly like the script text itself.
//
// Voices are NOT hardcoded by ID: ElevenLabs is retiring its old "Default
// voices" (expiring end of 2026), so any ID baked in today could silently
// break. Instead, every run asks ElevenLabs' own voice library for "a
// premade female voice" and "a premade male voice" via the gender label the
// API exposes — future-proof against their catalog changing underneath us.
//
// If ElevenLabs isn't configured yet, the free monthly quota (10,000
// characters) is exhausted, or a call fails, this returns a non-success
// response and the frontend silently falls back to the free (but browser-
// dependent) Web Speech API — nothing here is required for the podcast
// feature to keep working.
// ==========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const STORAGE_BUCKET = 'podcast-audio'
const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2'

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) return response
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 2500))
      } else if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 800))
      } else {
        return response
      }
    } catch (err) {
      if (attempt >= maxRetries) throw err
      await new Promise(r => setTimeout(r, 800))
    }
  }
  throw new Error('Max retries reached')
}

// Looks up one premade voice of the given gender directly from ElevenLabs'
// own voice library (v2/voices, filterable by the `labels.gender` field it
// returns) instead of hardcoding a voice_id — their "Default voices" are
// being retired (expiring 2026-12-31), so anything we hardcode today could
// vanish later. This costs zero TTS credits either way.
async function findPremadeVoiceId(gender: 'female' | 'male', apiKey: string): Promise<string | null> {
  const url = `https://api.elevenlabs.io/v2/voices?category=premade&gender=${gender}&page_size=1`
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: { 'xi-api-key': apiKey }
  })
  if (!response.ok) {
    console.error(`ElevenLabs voice lookup failed for gender=${gender}:`, await response.text().catch(() => ''))
    return null
  }
  const data = await response.json()
  const voice = Array.isArray(data?.voices) ? data.voices[0] : null
  return voice?.voice_id || null
}

async function synthesizeElevenLabsTts(text: string, voiceId: string, apiKey: string): Promise<Uint8Array> {
  const response = await fetchWithRetry(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL_ID,
      language_code: 'tr'
    })
  })
  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${errText.slice(0, 300)}`)
  }
  return new Uint8Array(await response.arrayBuffer())
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

    // 1. Verify ownership and pull the already-generated script
    const { data: card, error: cardError } = await userClient
      .from('study_cards')
      .select('id, podcast_script')
      .eq('id', studyCardId)
      .single()

    if (cardError || !card) {
      console.error('Study card not found or access denied:', cardError)
      return new Response(JSON.stringify({ error: 'Study card not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const podcast = card.podcast_script
    if (!podcast || !Array.isArray(podcast.script) || podcast.script.length === 0) {
      return new Response(JSON.stringify({ error: 'Generate the podcast script first' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Already generated for the current script — return the cached URLs.
    if (podcast.audio && Array.isArray(podcast.audio.urls) && podcast.audio.urls.length === podcast.script.length) {
      return new Response(JSON.stringify({ success: true, audio: podcast.audio, cached: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!elevenLabsKey) {
      console.warn('ELEVENLABS_API_KEY not configured — skipping real audio generation')
      return new Response(JSON.stringify({ error: 'Neural voice audio is not configured yet' }), {
        status: 501,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Host A ("Ela"/"Alex") is always the backend's female-coded host, host B
    // ("Kaan"/"Sam") is always male-coded (see generate-podcast-script) —
    // resolve one real premade voice of each gender from ElevenLabs' own
    // library rather than a hardcoded ID.
    const [femaleVoiceId, maleVoiceId] = await Promise.all([
      findPremadeVoiceId('female', elevenLabsKey),
      findPremadeVoiceId('male', elevenLabsKey)
    ])

    if (!femaleVoiceId || !maleVoiceId) {
      console.error('Could not resolve a premade male+female ElevenLabs voice pair')
      return new Response(JSON.stringify({ error: 'Could not find suitable voices in your ElevenLabs account' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Make sure the bucket exists (no-op if it already does) so a fresh
    // project doesn't need a manual dashboard step beyond the SQL migration.
    try {
      await serviceClient.storage.createBucket(STORAGE_BUCKET, { public: true })
    } catch (_e) {
      // Already exists — fine.
    }

    const lines = podcast.script as Array<{ speaker: string; text: string }>
    const urls: (string | null)[] = new Array(lines.length).fill(null)
    // Kept low: ElevenLabs' free tier caps concurrent generations, and
    // batching too aggressively just trades a 429 (auto-retried anyway) for
    // no real speed benefit here.
    const CONCURRENCY = 2

    for (let start = 0; start < lines.length; start += CONCURRENCY) {
      const batch = lines.slice(start, start + CONCURRENCY)
      const batchResults = await Promise.all(batch.map(async (line, bi) => {
        const idx = start + bi
        const voiceId = line.speaker === 'B' ? maleVoiceId : femaleVoiceId
        try {
          const audioBytes = await synthesizeElevenLabsTts(line.text, voiceId, elevenLabsKey)
          const path = `${studyCardId}/${idx}.mp3`
          const { error: uploadError } = await serviceClient.storage
            .from(STORAGE_BUCKET)
            .upload(path, audioBytes, { contentType: 'audio/mpeg', upsert: true })
          if (uploadError) {
            console.error(`Upload failed for line ${idx}:`, uploadError)
            return null
          }
          const { data: pub } = serviceClient.storage.from(STORAGE_BUCKET).getPublicUrl(path)
          return pub?.publicUrl || null
        } catch (err) {
          console.error(`ElevenLabs TTS failed for line ${idx}:`, err)
          return null
        }
      }))
      batchResults.forEach((url, bi) => { urls[start + bi] = url })
    }

    const successCount = urls.filter(Boolean).length
    if (successCount < lines.length) {
      // Partial failure (often: free monthly quota ran out mid-script) —
      // don't cache a broken/mixed set. The frontend just falls back to the
      // browser voice for this session; a later retry (next card open, next
      // month's quota reset) will attempt the full set again.
      console.error(`Podcast audio generation incomplete: ${successCount}/${lines.length} lines succeeded`)
      return new Response(JSON.stringify({ error: `Audio generation incomplete (${successCount}/${lines.length} lines)` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const audio = {
      provider: 'elevenlabs',
      urls: urls as string[],
      generatedAt: new Date().toISOString()
    }

    const updatedPodcast = { ...podcast, audio }
    const { error: updateError } = await serviceClient
      .from('study_cards')
      .update({ podcast_script: updatedPodcast })
      .eq('id', studyCardId)

    if (updateError) {
      console.error('Failed to cache podcast audio URLs:', updateError)
      // Non-fatal — the student still gets the audio back for this listen.
    }

    return new Response(JSON.stringify({ success: true, audio, cached: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Unexpected exception in generate-podcast-audio:', err)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
