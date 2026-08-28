import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ==========================================================================
// Acadex — admin-only "Kitap Tarama" processing step (step 2 of 2).
//
// Processes a FEW pending chunks (persisted by admin-ingest-course-pdf) per
// call, so a book of any size can be fully "learned" without ever needing a
// single request to run longer than Supabase Edge Functions' ~150s limit.
// The admin UI calls this repeatedly in a loop (with a progress bar) until
// it reports done:true. Because every chunk's status lives in the database,
// this is always safe to resume later if the admin closes the tab partway
// through a large book.
//
// Two modes:
//   1. { documentId } — process the next batch of pending chunks for that
//      document. When the document's last chunk finishes, the course-wide
//      knowledge index is automatically resynced from ALL of that course's
//      processed chunks (across every document uploaded for it so far).
//   2. { courseCode, resyncOnly: true } — skip chunk processing entirely and
//      just rebuild course_knowledge_index from whatever chunks are already
//      processed (e.g. after deleting a document, or to pick up chunks that
//      finished processing under a document that never got marked
//      'completed' for some reason).
//
// Admin-only, same pattern as admin-ingest-course-pdf.
// ==========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// How many chunks to run through Groq per invocation. Deliberately just
// ONE. gpt-oss-120b's free-tier Groq quota is only 30 requests/minute AND
// just 8,000 tokens/minute, shared across the WHOLE app (every student's
// exam generation, grading, etc. draws from the same pool). One chunk-
// extraction call here already uses ~2,500-3,000 tokens (input + output)
// — enough that even 2-3 of them back-to-back can blow the per-minute
// token budget, which is exactly what caused a real 169-chunk book scan to
// have most chunks silently rate-limited and marked 'failed' after only
// the first handful succeeded. Pacing is handled on the CLIENT side (see
// akRunProcessingLoop in js/admin.js), which waits between calls to this
// function rather than sleeping inside it — sleeping in here would eat
// into the ~150s Edge Function time budget for no benefit, since a rate-
// limit retry (below) can already take up to ~45s on its own.
const CHUNK_BATCH_SIZE = 1
const MODEL = "openai/gpt-oss-120b" // llama-3.3-70b-versatile was retired by Groq on 2026-08-16 — see other functions in this repo for the same fix.

// How many times to retry ONE chunk after a Groq rate-limit (429) response
// before giving up and marking it 'failed'. A 429 here is expected, not
// exceptional — it means we're sharing a very tight free-tier quota with
// the rest of the app — so it deserves a wait-and-retry, not an immediate
// failure. Kept low (worst case ~45s of waiting) so a single chunk retrying
// can never itself approach the Edge Function's ~150s time limit.
const MAX_RATE_LIMIT_RETRIES = 2

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function extractChunkKnowledge(groqApiKey: string, rawText: string): Promise<{
  topic_label: string
  summary: string
  key_terms: string[]
  key_points: string[]
  formulas: string[]
}> {
  const systemPrompt = `You are an academic content extraction assistant. You will be given raw extracted text from a few consecutive pages of a university textbook or lecture notes document. Extract structured study information from it.

Output ONLY a valid JSON object (no markdown fences, no commentary) with this exact shape:
{
  "topic_label": "a short 2-6 word label for what this excerpt mainly covers, in the same language as the text",
  "summary": "a 1-3 sentence summary of this excerpt, in the same language as the text",
  "key_terms": ["up to 8 important terms/concepts defined or used in this excerpt"],
  "key_points": ["up to 6 concise factual points/claims from this excerpt"],
  "formulas": ["any explicit mathematical/financial formulas or equations present in this excerpt, written as plain text, e.g. 'NPV = sum(CFt / (1+r)^t) - InitialInvestment' — empty array if none"]
}

If the excerpt is mostly boilerplate (cover page, table of contents, index, references list) with little real teaching content, still return the shape above with your best-effort, possibly sparse, values — never omit a field.`

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        // Kept deliberately modest (not just for cost, but because this
        // whole call's token footprint has to fit inside the free tier's
        // very tight 8,000-tokens/minute ceiling alongside real student
        // traffic on the same account).
        max_completion_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: rawText.slice(0, 8000) }
        ]
      })
    })

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      // Honor Groq's Retry-After header when present; otherwise back off
      // with an increasing wait. This is the normal, expected path when
      // several chunks/students share the same tight free-tier quota — not
      // an error condition worth giving up on immediately.
      const retryAfterHeader = response.headers.get('retry-after')
      const retryAfterSeconds = retryAfterHeader ? parseFloat(retryAfterHeader) : NaN
      const waitMs = !isNaN(retryAfterSeconds) ? retryAfterSeconds * 1000 : 15000 * (attempt + 1)
      console.warn(`Groq rate-limited (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES + 1}), waiting ${Math.round(waitMs / 1000)}s before retry.`)
      await sleep(waitMs)
      continue
    }

    const data = await response.json()
    if (!response.ok) {
      const detail = data?.error?.message || data?.error?.code || `HTTP ${response.status}`
      throw new Error(`Groq API error: ${detail}`)
    }

    const raw = data.choices?.[0]?.message?.content ?? ""
    if (!raw) throw new Error("Empty Groq response content")
    const cleaned = raw.replace(/```json\s*|```/g, "").trim()
    const parsed = JSON.parse(cleaned)

    return {
      topic_label: typeof parsed.topic_label === 'string' ? parsed.topic_label.slice(0, 200) : 'Konu',
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 800) : '',
      key_terms: Array.isArray(parsed.key_terms) ? parsed.key_terms.slice(0, 8).map((t: unknown) => String(t)) : [],
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points.slice(0, 6).map((t: unknown) => String(t)) : [],
      formulas: Array.isArray(parsed.formulas) ? parsed.formulas.slice(0, 5).map((t: unknown) => String(t)) : []
    }
  }

  throw new Error("Groq API rate limit exceeded after retries")
}

// Rebuilds course_knowledge_index for one course from ALL of its currently
// 'processed' chunks (across every document uploaded for that course, not
// just one). Deterministic (no extra Groq call) — deduplicates terms and
// orders topics by chunk position across documents/pages.
async function resyncCourseIndex(serviceClient: ReturnType<typeof createClient>, courseCode: string) {
  const { data: chunks, error: chunksErr } = await serviceClient
    .from('course_knowledge_chunks')
    // NOTE: these columns are named extracted_key_terms / extracted_key_points
    // / extracted_formulas on course_knowledge_chunks (see
    // 20260829_add_course_knowledge_base.sql) — an earlier version of this
    // query used the un-prefixed names, which don't exist on this table, and
    // crashed every resync (including the automatic one that runs right
    // after a document finishes processing) with "column ... does not exist".
    .select('document_id, chunk_index, page_start, page_end, topic_label, extracted_key_terms, extracted_key_points, extracted_formulas')
    .eq('course_code', courseCode)
    .eq('status', 'processed')
    .order('document_id', { ascending: true })
    .order('chunk_index', { ascending: true })

  if (chunksErr) {
    console.error('Failed to load processed chunks for resync:', chunksErr)
    return { error: chunksErr.message }
  }

  const processedChunks = chunks || []
  if (processedChunks.length === 0) {
    // Nothing processed (yet, or anymore after a deletion) — clear the index
    // rather than leaving stale data behind.
    await serviceClient.from('course_knowledge_index').delete().eq('course_code', courseCode)
    return { chunkCount: 0 }
  }

  const topicsOutline = processedChunks.map((c: Record<string, unknown>) => ({
    page_start: c.page_start,
    page_end: c.page_end,
    topic: c.topic_label
  }))

  const termSet = new Map<string, string>() // lowercase -> original casing (first seen)
  const allPoints: string[] = []
  const formulaSet = new Map<string, string>()

  processedChunks.forEach((c: Record<string, unknown>) => {
    ;((c.extracted_key_terms as string[]) || []).forEach(t => {
      const key = t.trim().toLowerCase()
      if (key && !termSet.has(key)) termSet.set(key, t.trim())
    })
    ;((c.extracted_key_points as string[]) || []).forEach(p => {
      if (p && p.trim()) allPoints.push(p.trim())
    })
    ;((c.extracted_formulas as string[]) || []).forEach(f => {
      const key = f.trim().toLowerCase()
      if (key && !formulaSet.has(key)) formulaSet.set(key, f.trim())
    })
  })

  const documentIds = [...new Set(processedChunks.map((c: Record<string, unknown>) => c.document_id as string))]

  const { error: upsertErr } = await serviceClient
    .from('course_knowledge_index')
    .upsert({
      course_code: courseCode,
      topics_outline: topicsOutline,
      key_terms: [...termSet.values()],
      key_points: allPoints,
      formulas: [...formulaSet.values()],
      synthesized_summary: `Bu ders için taranan kaynaklar şu konuları kapsıyor: ${topicsOutline.map((t: Record<string, unknown>) => t.topic).filter(Boolean).slice(0, 40).join(', ')}.`,
      source_document_ids: documentIds,
      chunk_count: processedChunks.length,
      updated_at: new Date().toISOString()
    }, { onConflict: 'course_code' })

  if (upsertErr) {
    console.error('Failed to upsert course_knowledge_index:', upsertErr)
    return { error: upsertErr.message }
  }

  return { chunkCount: processedChunks.length }
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

    const { documentId, courseCode, resyncOnly, retryFailed } = await req.json()

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

    if (resyncOnly) {
      if (!courseCode) {
        return new Response(JSON.stringify({ error: 'Missing required parameter: courseCode' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const result = await resyncCourseIndex(serviceClient, courseCode)
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ resynced: true, chunkCount: result.chunkCount }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: documentId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: docRow, error: docErr } = await serviceClient
      .from('course_knowledge_documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docErr || !docRow) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Requeues any chunks that got permanently marked 'failed' (e.g. from
    // exhausting MAX_RATE_LIMIT_RETRIES during a burst of Groq rate-limit
    // hits) back to 'pending' and reopens the document for processing.
    // Intentionally checked BEFORE the completed/failed short-circuit below,
    // since a document that already reached 'completed' with some failed
    // chunks is exactly the case this is for.
    if (retryFailed) {
      const { error: resetErr } = await serviceClient
        .from('course_knowledge_chunks')
        .update({ status: 'pending' })
        .eq('document_id', documentId)
        .eq('status', 'failed')
      if (resetErr) {
        console.error('Failed to reset failed chunks:', resetErr)
        return new Response(JSON.stringify({ error: 'Başarısız parçalar sıfırlanamadı' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const { count: processedCount } = await serviceClient
        .from('course_knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', documentId)
        .eq('status', 'processed')
      await serviceClient
        .from('course_knowledge_documents')
        .update({ status: 'processing', processed_chunks: processedCount || 0, completed_at: null })
        .eq('id', documentId)
      return new Response(JSON.stringify({
        processedInBatch: 0,
        processedTotal: processedCount || 0,
        totalChunks: docRow.total_chunks,
        documentStatus: 'processing',
        done: false
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (docRow.status === 'completed' || docRow.status === 'failed') {
      return new Response(JSON.stringify({
        processedInBatch: 0,
        processedTotal: docRow.processed_chunks,
        totalChunks: docRow.total_chunks,
        documentStatus: docRow.status,
        done: true
      }), {
        status: 200,
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

    const { data: pendingChunks, error: pendingErr } = await serviceClient
      .from('course_knowledge_chunks')
      .select('id, raw_text')
      .eq('document_id', documentId)
      .eq('status', 'pending')
      .order('chunk_index', { ascending: true })
      .limit(CHUNK_BATCH_SIZE)

    if (pendingErr) {
      console.error('Failed to load pending chunks:', pendingErr)
      return new Response(JSON.stringify({ error: 'Failed to load pending chunks' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let processedInBatch = 0
    const chunksToProcess = pendingChunks || []

    for (let i = 0; i < chunksToProcess.length; i++) {
      const chunk = chunksToProcess[i]
      try {
        const extracted = await extractChunkKnowledge(groqApiKey, chunk.raw_text || '')
        await serviceClient
          .from('course_knowledge_chunks')
          .update({
            status: 'processed',
            topic_label: extracted.topic_label,
            extracted_summary: extracted.summary,
            extracted_key_terms: extracted.key_terms,
            extracted_key_points: extracted.key_points,
            extracted_formulas: extracted.formulas,
            processed_at: new Date().toISOString()
          })
          .eq('id', chunk.id)
        processedInBatch++
      } catch (chunkErr) {
        console.error(`Failed to process chunk ${chunk.id}:`, chunkErr)
        await serviceClient
          .from('course_knowledge_chunks')
          .update({ status: 'failed' })
          .eq('id', chunk.id)
      }
    }

    const newProcessedTotal = (docRow.processed_chunks || 0) + processedInBatch

    // A document is "done" (no more work left) once no 'pending' chunks
    // remain — NOT just when processed_chunks reaches total_chunks, since a
    // chunk that failed to process (bad Groq response, malformed JSON, etc)
    // is marked 'failed' rather than 'pending' and would otherwise leave
    // the document stuck in 'processing' forever with the admin UI polling
    // in an infinite loop.
    const { count: remainingPendingCount, error: remainingErr } = await serviceClient
      .from('course_knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId)
      .eq('status', 'pending')

    if (remainingErr) console.warn('Failed to count remaining pending chunks:', remainingErr)
    const isDocumentDone = (remainingPendingCount || 0) === 0

    await serviceClient
      .from('course_knowledge_documents')
      .update({
        processed_chunks: newProcessedTotal,
        status: isDocumentDone ? 'completed' : 'processing',
        completed_at: isDocumentDone ? new Date().toISOString() : null
      })
      .eq('id', documentId)

    if (isDocumentDone) {
      await resyncCourseIndex(serviceClient, docRow.course_code)
    }

    return new Response(JSON.stringify({
      processedInBatch,
      processedTotal: newProcessedTotal,
      totalChunks: docRow.total_chunks,
      documentStatus: isDocumentDone ? 'completed' : 'processing',
      done: isDocumentDone
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('admin-process-course-knowledge exception:', err)
    return new Response(JSON.stringify({ error: 'Internal server error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
