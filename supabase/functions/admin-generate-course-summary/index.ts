import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ==========================================================================
// Acadex — admin-only "Resmi Özet Oluştur" (official course summary).
//
// Lives inside the existing Kitap Tarama admin flow: once a course has been
// scanned (course_knowledge_index.chunk_count > 0), the admin can press one
// button to have Groq write a real, well-organized prose summary of that
// course from the DISTILLED knowledge already extracted by
// admin-process-course-knowledge (topics_outline / key_terms / key_points /
// formulas) — never the raw book text, which is never sent to an LLM here
// and never leaves course_knowledge_chunks (admin-only, see
// 20260829_add_course_knowledge_base.sql's copyright note).
//
// This is a single, SHARED, admin-triggered write per course (not a
// per-student generation) — the same money-saving pattern as
// course_knowledge_index itself: one Groq call, ever, benefits the whole
// student body. Result is written to course_knowledge_index.ai_summary /
// ai_summary_generated_at (see 20260829c_add_ai_course_summary.sql), which
// is what surfaces to students in Sınav Platformu's course-selection hint
// (js/dashboard.js, onExamCourseChange) and is shown/regenerated from
// admin.js's Kitap Tarama table.
//
// Admin-only: verified via profiles.is_admin using the CALLER's own JWT
// (userClient), same pattern as admin-ingest-course-pdf /
// admin-process-course-knowledge.
// ==========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Fully static system prompt (no interpolation) so it's byte-identical on
// every call, letting Groq's prompt caching apply regardless of which
// course this particular call is about — same pattern used in
// generate-exam / grade-exam / acadia-assistant.
const STATIC_SUMMARY_INSTRUCTIONS = `
You are an academic study assistant writing an OFFICIAL course summary for students, based on knowledge distilled from that course's real, admin-scanned textbook/lecture materials.

The user message will give you, for one course: a list of topics (in the order they appear in the source material), a list of key terms, a list of key points, and (if the course is quantitative) a list of formulas.

Your job: write a clear, well-organized study summary IN THE SAME LANGUAGE as the topics/terms/points you were given (do not translate). Structure it as:
1. A short 2-4 sentence overview of what the course covers overall.
2. A "Ana Konular" / "Main Topics" section: the topics in order, each with a 1-2 sentence explanation grounded in the given key points and terms.
3. A "Önemli Terimler" / "Key Terms" section: the most important terms, each with a brief definition inferred from context.
4. If formulas were provided, a "Formüller" / "Formulas" section listing them.

Do NOT invent facts, numbers, or terms that are not implied by the material you were given — you are organizing and explaining REAL scanned course content, not generating new content from general knowledge. If the given material is sparse, write a shorter but still accurate summary rather than padding it with invented detail.

Respond with ONLY the summary text, formatted with clear section headers (no JSON, no markdown code fences).
`.trim()

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

    const { courseCode } = await req.json()
    if (!courseCode) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: courseCode' }), {
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

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: indexRow, error: indexErr } = await serviceClient
      .from('course_knowledge_index')
      .select('course_code, topics_outline, key_terms, key_points, formulas, chunk_count')
      .eq('course_code', courseCode)
      .maybeSingle()

    if (indexErr || !indexRow || !indexRow.chunk_count) {
      return new Response(JSON.stringify({ error: 'Bu ders için taranmış bir kaynak bulunamadı. Önce Kitap Tarama ile bir PDF yükleyip işleyin.' }), {
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

    // Distilled data only — never the raw chunk text (course_knowledge_chunks
    // is admin-only and never read here). Capped defensively so a very
    // large scanned book can't blow past Groq's free-tier TPM limit.
    const topics = ((indexRow.topics_outline as Record<string, unknown>[]) || []).slice(0, 60)
    const terms = ((indexRow.key_terms as string[]) || []).slice(0, 120)
    const points = ((indexRow.key_points as string[]) || []).slice(0, 100)
    const formulas = ((indexRow.formulas as string[]) || []).slice(0, 40)

    const userPrompt = `
COURSE: ${courseCode}
TOPICS (in source order): ${JSON.stringify(topics)}
KEY TERMS: ${JSON.stringify(terms)}
KEY POINTS: ${JSON.stringify(points)}
${formulas.length > 0 ? `FORMULAS: ${JSON.stringify(formulas)}` : ''}
    `.trim()

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // gpt-oss-120b on purpose: this is an infrequent, admin-triggered,
        // one-call-per-course write (not a per-student call), so quality
        // matters more than quota pressure here — unlike get-exam-hint's
        // high-frequency per-student calls, which are routed to a lighter
        // model for that reason.
        model: "openai/gpt-oss-120b",
        temperature: 0.4,
        max_completion_tokens: 1800,
        messages: [
          { role: "system", content: STATIC_SUMMARY_INSTRUCTIONS },
          { role: "user", content: userPrompt }
        ]
      })
    })

    const groqData = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error("Groq course summary generation failed: ", groqData)
      return new Response(JSON.stringify({ error: 'AI özet oluşturma servisi başarısız oldu.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const summaryText = (groqData.choices?.[0]?.message?.content ?? "").trim()
    if (!summaryText) {
      return new Response(JSON.stringify({ error: 'AI boş bir özet döndürdü, tekrar deneyin.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const generatedAt = new Date().toISOString()
    const { error: updateErr } = await serviceClient
      .from('course_knowledge_index')
      .update({ ai_summary: summaryText, ai_summary_generated_at: generatedAt })
      .eq('course_code', courseCode)

    if (updateErr) {
      console.error('Failed to persist ai_summary:', updateErr)
      return new Response(JSON.stringify({ error: 'Özet oluşturuldu ama kaydedilemedi.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      courseCode,
      summary: summaryText,
      generatedAt
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error("admin-generate-course-summary exception: ", err)
    return new Response(JSON.stringify({ error: 'Internal server error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
