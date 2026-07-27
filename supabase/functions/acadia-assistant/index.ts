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
// This is the endpoint the frontend actually calls (see
// sendAcadiaMessage() in js/dashboard.js, which posts to
// `${SUPABASE_URL}/functions/v1/acadia-assistant`). The older, simpler
// `acadia-chat` function is no longer wired to the UI and can be removed
// once this one is deployed and verified.
//
// Optional per-request `studyCardId`: when the student picks a summary in
// the Acadia panel's context picker, its full content (summary, key terms,
// key points, quiz questions, tables, charts, formulas, footnotes, section
// outline) is loaded here (RLS + explicit user_id check, so a student can
// only ever select their own cards) and folded into the system prompt, so
// Acadia can answer questions grounded in that exact document rather than
// just the account-activity snapshot.
//
// Write-actions: when the student explicitly asks Acadia to transfer
// content (e.g. quiz questions) onto their notebook board, the model is
// instructed to append a fenced ```acadia-action``` JSON block to its
// reply. The frontend (processAcadiaActionBlock in dashboard.js) parses
// that block, strips it from the displayed message, and executes the
// action client-side (e.g. calling addStickyNoteToNotebook() for each
// item) — this function never touches the notebook data itself.
//
// Deploy: `supabase functions deploy acadia-assistant`, using the same
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

    const { message, history, language, studyCardId } = await req.json()
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

    // ------------------------------------------------------------------
    // Optional selected study card: the student picked a specific summary
    // in the Acadia panel's context picker. Re-fetch it here (rather than
    // trust whatever the client claims) scoped to the caller's own JWT —
    // RLS plus an explicit user_id check means this can never leak
    // another student's card, mirroring the pattern used by
    // chat-with-document.
    // ------------------------------------------------------------------
    let studyCardBlock = ''
    let studyCardFileName = ''
    if (studyCardId && typeof studyCardId === 'string') {
      try {
        const { data: card } = await userClient
          .from('study_cards')
          .select('summary, key_terms, key_points, quiz_questions, tables, charts, formulas, worked_examples, footnotes, sections, document_type, documents(file_name)')
          .eq('id', studyCardId)
          .eq('user_id', user.id)
          .single()

        if (card) {
          studyCardFileName = (card.documents && card.documents.file_name) ? card.documents.file_name : 'Untitled document'
          const cap = (s: unknown, n: number) => (typeof s === 'string' ? s.slice(0, n) : '')
          const listCap = (arr: unknown, n: number) => Array.isArray(arr) ? arr.slice(0, n) : []

          const lines: string[] = []
          lines.push(`Document: ${studyCardFileName} (${card.document_type || 'Other'})`)
          if (card.summary) lines.push(`Summary:\n${cap(card.summary, 3500)}`)

          const sections = listCap(card.sections, 6)
          if (sections.length > 0) {
            lines.push(`Section outline:\n${sections.map((s: any) => `- ${s.heading}: ${cap(s.summary, 200)}`).join('\n')}`)
          }
          const keyPoints = listCap(card.key_points, 20)
          if (keyPoints.length > 0) lines.push(`Key points:\n${keyPoints.map((p: any) => `- ${cap(typeof p === 'string' ? p : p?.point || '', 200)}`).join('\n')}`)
          const keyTerms = listCap(card.key_terms, 20)
          if (keyTerms.length > 0) lines.push(`Key terms:\n${keyTerms.map((t: any) => `- ${cap(t?.term || '', 80)}: ${cap(t?.definition || '', 160)}`).join('\n')}`)
          const quiz = listCap(card.quiz_questions, 15)
          if (quiz.length > 0) lines.push(`Quiz questions:\n${quiz.map((q: any, i: number) => `${i + 1}. ${cap(q?.question || '', 200)} (Answer: ${cap(q?.correct_answer || q?.answer || '', 120)})`).join('\n')}`)
          const tables = listCap(card.tables, 8)
          if (tables.length > 0) lines.push(`Tables: ${tables.length} table(s) present in this summary (titles: ${tables.map((t: any) => cap(t?.title || 'Untitled', 60)).join(', ')})`)
          const charts = listCap(card.charts, 8)
          if (charts.length > 0) lines.push(`Charts/diagrams: ${charts.length} present (titles: ${charts.map((c: any) => cap(c?.title || 'Untitled', 60)).join(', ')})`)
          const formulas = listCap(card.formulas, 10)
          if (formulas.length > 0) lines.push(`Formulas: ${formulas.map((f: any) => cap(typeof f === 'string' ? f : f?.formula || '', 100)).join(' | ')}`)

          studyCardBlock = lines.join('\n\n').slice(0, 8000)
        }
      } catch (_e) { /* non-fatal — just answer without card context */ }
    }

    const lang = (language === 'tr') ? 'tr' : 'en'

    const systemPrompt = `
You are "Acadia", the friendly in-app study advisor for Acadex, an AI study portal for Business Faculty students (Management Information Systems, Business Administration, International Trade and Business, and Banking and Finance).

Your job is to give short, specific, encouraging study advice grounded in the student's OWN activity snapshot below (and the selected study card, when one is provided). Do not invent facts not present in the snapshot, the study card, or the conversation — if you don't know something, say so and suggest how the student could find out inside the app (e.g. "check your Study Planner" or "try a practice exam on that topic").

STUDENT ACTIVITY SNAPSHOT (fresh for this conversation only):
${contextBlock}
${studyCardBlock ? `\nSELECTED STUDY CARD — the student picked this summary as context, so you can see everything in it (summary, key terms, key points, quiz questions, tables/charts/formulas present, and the section outline) and answer questions about it directly, as if you had read the document yourself:\n${studyCardBlock}` : '\n(No study card is currently selected. If the student asks about a specific summary or document, tell them they can pick one using the 📎 context picker at the top of this chat panel.)'}

RULES:
- Reply in ${lang === 'tr' ? 'Turkish' : 'English'}, regardless of what language this system prompt is written in.
- Keep replies conversational and concise: 2-5 sentences, unless the student explicitly asks for a longer breakdown, a study plan, or to see quiz questions.
- When relevant, reference the student's actual weak concepts, upcoming deadlines, or streak from the snapshot — make the advice feel personal, not generic.
- You are a study aid, not an instructor or an official grading authority. Never claim a grade or exam result from Acadex is an official course grade.
- If the student asks something entirely unrelated to their studies or the Acadex platform, answer briefly and gently steer back to how you can help them study.
- Never ask the student for passwords, payment details, or information already available in the snapshot.

NOTEBOOK WRITE-ACTION (transferring content to the student's board):
- The student's workspace has a "Çalışma Defteri" (notebook/whiteboard) board where content can live as draggable sticky notes.
- If — and ONLY if — the student explicitly asks you to transfer, add, send, or push specific content (e.g. "these quiz questions", "the key terms", "bunları deftere ekle") onto the notebook/board as sticky notes, do two things: (1) reply normally, briefly confirming what you're adding, and (2) append, as the very last thing in your reply, a fenced code block with the language tag "acadia-action" containing ONLY valid JSON of the shape {"action":"add_sticky_notes","items":[{"title":"short label","text":"the note content"}]}. Each item's "text" should be under ~400 characters — split long content into multiple items rather than one giant note.
- Only pull items from the SELECTED STUDY CARD content above (or from earlier in this conversation) — never invent content that isn't grounded in what you can actually see.
- Do NOT include the acadia-action block for ordinary questions or explanations — only when the student clearly asked for something to be added to their board.
- Never mention the acadia-action block itself in your conversational reply — it is a hidden instruction the app reads, not something to describe to the student.
`.trim()

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: 'Groq API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // A selected study card can push the system prompt fairly large. Rather
    // than let a Groq TPM (tokens-per-minute) rejection surface as a bare
    // failure, fall back once to a trimmed prompt — same reliability
    // pattern used in summarize-document / merge-summarize.
    const isTokenSizeError = (status: number, body: any) =>
      (status === 400 || status === 429 || status === 413) &&
      (body?.error?.code === 'rate_limit_exceeded' || /token/i.test(String(body?.error?.message || '')))

    const buildMessages = (sysPrompt: string, historyLimit: number) => [
      { role: 'system', content: sysPrompt },
      ...safeHistory
        .filter((m: Record<string, unknown>) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-historyLimit)
        .map((m: Record<string, unknown>) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
      { role: 'user', content: message.slice(0, 2000) }
    ]

    const callGroq = async (sysPrompt: string, historyLimit: number) => {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.6,
          messages: buildMessages(sysPrompt, historyLimit)
        })
      })
      const data = await resp.json()
      return { resp, data }
    }

    let { resp: groqResponse, data: groqData } = await callGroq(systemPrompt, 6)

    if (!groqResponse.ok && isTokenSizeError(groqResponse.status, groqData) && studyCardBlock) {
      // Retry once with a much smaller card context (summary + key points
      // only, no quiz/tables/charts/formulas) and less history.
      console.warn('Acadia Groq call hit a token-size error with full context, retrying with a trimmed study card context.')
      const trimmedCardBlock = studyCardBlock.slice(0, 1500)
      const trimmedSystemPrompt = systemPrompt.replace(studyCardBlock, trimmedCardBlock)
      ;({ resp: groqResponse, data: groqData } = await callGroq(trimmedSystemPrompt, 2))
    }

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
