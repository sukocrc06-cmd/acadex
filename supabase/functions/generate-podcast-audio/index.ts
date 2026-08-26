import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ==========================================================================
// Sesli Özet (AI Podcast) — real neural voice audio.
//
// generate-podcast-script only WRITES the two-host dialogue text. This
// function turns that text into actual MP3 audio using Azure's free-tier
// neural TTS voices (genuinely distinct, genuinely fluent male/female
// voices — tr-TR-EmelNeural / tr-TR-AhmetNeural for Turkish,
// en-US-JennyNeural / en-US-GuyNeural for English), uploads one MP3 per
// line to Supabase Storage, and caches the resulting URLs on
// study_cards.podcast_script.audio so this only ever runs ONCE per card —
// exactly like the script text itself.
//
// If Azure isn't configured yet, or a call fails, this returns a non-success
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

// Azure Speech neural voice pair per language. Host "A" (the backend's
// female-coded host — "Ela"/"Alex") always gets the female voice; host "B"
// ("Kaan"/"Sam") always gets the male voice.
const VOICE_MAP: Record<string, { female: string; male: string; lang: string }> = {
  tr: { female: 'tr-TR-EmelNeural', male: 'tr-TR-AhmetNeural', lang: 'tr-TR' },
  en: { female: 'en-US-JennyNeural', male: 'en-US-GuyNeural', lang: 'en-US' },
}

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

function escapeXml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function synthesizeAzureTts(text: string, voiceName: string, langTag: string, region: string, apiKey: string): Promise<Uint8Array> {
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${langTag}"><voice name="${voiceName}">${escapeXml(text)}</voice></speak>`
  const response = await fetchWithRetry(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'AcadexSesliOzet'
    },
    body: ssml
  })
  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Azure TTS failed (${response.status}): ${errText.slice(0, 300)}`)
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
      .select('id, podcast_script, summary_language')
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

    const azureKey = Deno.env.get('AZURE_SPEECH_KEY')
    const azureRegion = Deno.env.get('AZURE_SPEECH_REGION')
    if (!azureKey || !azureRegion) {
      console.warn('AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not configured — skipping real audio generation')
      return new Response(JSON.stringify({ error: 'Neural voice audio is not configured yet' }), {
        status: 501,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const langKey = card.summary_language === 'tr' ? 'tr' : 'en'
    const voices = VOICE_MAP[langKey]

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
    const CONCURRENCY = 4

    for (let start = 0; start < lines.length; start += CONCURRENCY) {
      const batch = lines.slice(start, start + CONCURRENCY)
      const batchResults = await Promise.all(batch.map(async (line, bi) => {
        const idx = start + bi
        const voiceName = line.speaker === 'B' ? voices.male : voices.female
        try {
          const audioBytes = await synthesizeAzureTts(line.text, voiceName, voices.lang, azureRegion, azureKey)
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
          console.error(`Azure TTS failed for line ${idx}:`, err)
          return null
        }
      }))
      batchResults.forEach((url, bi) => { urls[start + bi] = url })
    }

    const successCount = urls.filter(Boolean).length
    if (successCount < lines.length) {
      // Partial failure — don't cache a broken/mixed set. The frontend just
      // falls back to the browser voice for this session; a later retry
      // (next time the card is opened) will attempt the full set again.
      console.error(`Podcast audio generation incomplete: ${successCount}/${lines.length} lines succeeded`)
      return new Response(JSON.stringify({ error: `Audio generation incomplete (${successCount}/${lines.length} lines)` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const audio = {
      provider: 'azure',
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
