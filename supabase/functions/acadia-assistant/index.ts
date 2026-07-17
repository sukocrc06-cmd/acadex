// ==========================================================================
// Acadex — "Acadia" AI Study Assistant
//
// A context-aware chat assistant that can see a short, freshly-generated
// snapshot of the CALLING student's own activity (recent exam performance,
// weak concepts, upcoming planner deadlines, streak) and gives conversational
// study advice grounded in it. It never sees other students' data — every
// query below runs through the caller's own JWT (userClient), so Row Level
// Security scopes everything to that one account, the same pattern used by
// every other Acadex edge function.
//
// New deploy step required (this function does not exist yet in the
// project): `supabase functions deploy acadia-assistant`, plus the same
// GROQ_API_KEY secret already used by generate-exam / grade-exam.
// ==========================================================================
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

    const { message, history, language } = await req.json()
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing "message" parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Cap incoming history so the request stays small and cheap.
    const safeHistory = Array.isArray(history) ? history.slice(-6) : []

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // Scoped to the calling user via their own JWT — RLS applies, so this
    // function can only ever see the caller's own rows.
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

    // ------------------------------------------------------------------
    // Assemble a compact, fresh context snapshot. Best-effort: if any one
    // query fails, we still answer with whatever context we did get.
    // ------------------------------------------------------------------
    const contextLines: string[] = []

    try {
      const { data: profile } = await userClient
        .from('profiles')
        .select('full_name, department, current_streak')
        .eq('id', user.id)
        .single()
      if (profile) {
        contextLines.push(`Student name: ${profile.full_name || 'Unknown'}`)
        contextLines.push(`Department: ${profile.department || 'Unknown'}`)
        contextLines.push(`Current study streak: ${profile.current_streak || 0} day(s)`)
      }
    } catch (_e) { /* non-fatal */ }

    try {
      const { data: exams } = await userClient
        .from('exams')
        .select('grade, question_results, completed_at, exam_type')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(10)

      if (exams && exams.length > 0) {
        const avg = Math.round(exams.reduce((s, e) => s + (e.grade || 0), 0) / exams.length)
        contextLines.push(`Completed exams: ${exams.length}, recent average grade: ${avg}/100`)

        // Aggregate weakest concepts across these recent exams.
        const conceptStats: Record<string, { total: number; count: number }> = {}
        exams.forEach(exam => {
          (exam.question_results || []).forEach((res: Record<string, unknown>) => {
            const concept = String(res.concept || '').trim()
            if (!concept) return
            if (!conceptStats[concept]) conceptStats[concept] = { total: 0, count: 0 }
            conceptStats[concept].total += Number(res.score) || 0
            conceptStats[concept].count += 1
          })
        })
        const weakest = Object.keys(conceptStats)
          .map(c => ({ concept: c, avg: Math.round(conceptStats[c].total / conceptStats[c].count) }))
          .sort((a, b) => a.avg - b.avg)
          .slice(0, 3)
        if (weakest.length > 0) {
          contextLines.push(`Weakest concepts recently: ${weakest.map(w => `${w.concept} (${w.avg}/100)`).join(', ')}`)
        }
      } else {
        contextLines.push('Completed exams: 0 (student has not taken a practice exam yet)')
      }
    } catch (_e) { /* non-fatal */ }

    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const { data: events } = await userClient
        .from('study_events')
        .select('title, event_date, event_type')
        .eq('user_id', user.id)
        .eq('is_done', false)
        .gte('event_date', todayStr)
        .order('event_date', { ascending: true })
        .limit(5)
      if (events && events.length > 0) {
        contextLines.push(`Upcoming planner items: ${events.map(e => `${e.title} (${e.event_type}, due ${e.event_date})`).join('; ')}`)
      } else {
        contextLines.push('Upcoming planner items: none scheduled')
      }
    } catch (_e) { /* non-fatal */ }

    try {
      const { count: docsCount } = await userClient
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      const { count: cardsCount } = await userClient
        .from('study_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      contextLines.push(`Uploaded documents: ${docsCount || 0}, AI study cards created: ${cardsCount || 0}`)
    } catch (_e) { /* non-fatal */ }

    const contextBlock = contextLines.length > 0
      ? contextLines.join('\n')
      : 'No account activity data is available for this student yet.'

    const lang = (language === 'tr') ? 'tr' : 'en'

    const systemPrompt = `
You are "Acadia", the friendly in-app study advisor for Acadex, an AI study portal for Business Faculty students (Management Information Systems, Business Administration, International Trade and Business, and Banking and Finance).

Your job is to give short, specific, encouraging study advice grounded in the student's OWN activity snapshot below. Do not invent facts not present in the snapshot or the conversation — if you don't know something, say so and suggest how the student could find out inside the app (e.g. "check your Study Planner" or "try a practice exam on that topic").

STUDENT ACTIVITY SNAPSHOT (fresh for this conversation only):
${contextBlock}

RULES:
- Reply in ${lang === 'tr' ? 'Turkish' : 'English'}, regardless of what language this system prompt is written in.
- Keep replies conversational and concise: 2-5 sentences, unless the student explicitly asks for a longer breakdown or a study plan.
- When relevant, reference the student's actual weak concepts, upcoming deadlines, or streak from the snapshot — make the advice feel personal, not generic.
- You are a study aid, not an instructor or an official grading authority. Never claim a grade or exam result from Acadex is an official course grade.
- If the student asks something entirely unrelated to their studies or the Acadex platform, answer briefly and gently steer back to how you can help them study.
- Never ask the student for passwords, payment details, or information already available in the snapshot.
`.trim()

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: 'Groq API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...safeHistory
        .filter((m: Record<string, unknown>) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m: Record<string, unknown>) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
      { role: 'user', content: message.slice(0, 2000) }
    ]

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.6,
        messages
      })
    })

    const groqData = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error("Acadia Groq call failed: ", groqData)
      return new Response(JSON.stringify({ error: 'Acadia is temporarily unavailable. Please try again in a moment.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const reply = groqData.choices?.[0]?.message?.content?.trim()
      || (lang === 'tr' ? 'Şu anda bir yanıt oluşturamadım, lütfen tekrar dener misin?' : "I couldn't come up with a reply just now — could you try again?")

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error("acadia-assistant exception: ", err)
    return new Response(JSON.stringify({ error: 'Internal server error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
