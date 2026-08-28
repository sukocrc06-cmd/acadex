import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getDocumentProxy } from "npm:unpdf"

// ==========================================================================
// Acadex — admin-only "Kitap Tarama" ingestion step (step 1 of 2).
//
// Takes an already-uploaded PDF (in the private 'course-knowledge-pdfs'
// storage bucket) and turns it into persisted, page-range chunks ready for
// AI processing. Pure local text extraction (no Groq calls here) — the
// actual (slow, LLM-per-chunk) processing happens in a separate function,
// admin-process-course-knowledge, called repeatedly afterward.
//
// RESUMABLE / BATCHED BY DESIGN. An earlier version of this function called
// unpdf's high-level extractText(pdf, { mergePages: false }) helper, which
// internally does `Promise.all(pdf.numPages pages, page => getTextContent())`
// — i.e. it kicks off text extraction for EVERY page of the book
// concurrently in one go. For a real ~670-page textbook that blew past the
// Edge Function's memory/time budget and crashed the isolate mid-request,
// which the browser only ever saw as a bare "Failed to fetch" (a connection
// reset, not a JSON error) — this is why real book uploads were failing
// silently. The fix: extract pages ourselves, SEQUENTIALLY, in small fixed
// batches per call, with progress persisted on the document row
// (extracted_pages) so a large book is scanned across many small, cheap
// calls instead of one huge one. The admin UI (js/admin.js, akUploadAndScan
// / akRunExtractionLoop) calls this repeatedly with { documentId } until it
// reports done: true, exactly mirroring the pattern already used for the
// AI-processing step in admin-process-course-knowledge.
//
// Admin-only: verified via profiles.is_admin using the CALLER's own JWT
// (userClient) before any privileged work happens on the service-role
// client. See supabase/migrations/20260829_add_course_knowledge_base.sql
// and 20260829b_add_extracted_pages.sql (adds the extracted_pages column
// this resumable design relies on).
// ==========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// How many extracted PDF pages go into one persisted chunk (unchanged from
// the original design). Smaller chunks mean more (cheaper, faster)
// individual Groq calls during processing but more rows/round-trips;
// larger chunks mean fewer, heavier calls. 4 pages is a reasonable middle
// ground for typical textbook page density.
const PAGES_PER_CHUNK = 4

// How many pages this function extracts text from, SEQUENTIALLY, per call.
// Must be a multiple of PAGES_PER_CHUNK so chunk boundaries never split
// across two separate calls (extracted_pages always lands on a chunk
// boundary). 60 pages of sequential (not parallel) text extraction is
// comfortably fast and light on memory even for a scanned/image-heavy
// textbook, unlike extracting all ~670 pages of a real book at once.
const PAGES_PER_EXTRACT_BATCH = 60

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

    const { courseCode, storagePath, fileName, documentId } = await req.json()

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

    // ------------------------------------------------------------------
    // Resolve which document row we're working on: either create it (first
    // call for a brand-new upload) or load the existing one (a resumed /
    // continuation call, identified only by documentId).
    // ------------------------------------------------------------------
    let docRow: Record<string, unknown> | null = null

    if (documentId) {
      const { data, error } = await serviceClient
        .from('course_knowledge_documents')
        .select('*')
        .eq('id', documentId)
        .maybeSingle()
      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Document not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      docRow = data
    } else {
      if (!courseCode || !storagePath || !fileName) {
        return new Response(JSON.stringify({ error: 'Missing required parameters: courseCode, storagePath, fileName' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Verify the course exists in the catalog (defense-in-depth, same as
      // generate-exam's course lookup).
      const { data: courseRow, error: courseErr } = await serviceClient
        .from('courses')
        .select('course_code')
        .eq('course_code', courseCode)
        .maybeSingle()
      if (courseErr || !courseRow) {
        return new Response(JSON.stringify({ error: 'Course not found in catalog' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data: newDoc, error: docInsertErr } = await serviceClient
        .from('course_knowledge_documents')
        .insert({
          course_code: courseCode,
          file_name: fileName,
          storage_path: storagePath,
          status: 'extracting',
          extracted_pages: 0,
          uploaded_by: user.id
        })
        .select()
        .single()

      if (docInsertErr || !newDoc) {
        console.error('Failed to create course_knowledge_documents row:', docInsertErr)
        return new Response(JSON.stringify({ error: 'Failed to create document record' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      docRow = newDoc
    }

    const doc = docRow as {
      id: string; course_code: string; storage_path: string; file_name: string
      total_pages: number | null; extracted_pages: number; total_chunks: number
    }

    const markFailed = async (message: string) => {
      await serviceClient
        .from('course_knowledge_documents')
        .update({ status: 'failed', error_message: message.slice(0, 500) })
        .eq('id', doc.id)
    }

    let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null
    try {
      const { data: fileBlob, error: downloadError } = await serviceClient.storage
        .from('course-knowledge-pdfs')
        .download(doc.storage_path)

      if (downloadError || !fileBlob) {
        console.error('Failed to download PDF from storage:', downloadError)
        await markFailed('PDF depodan indirilemedi.')
        return new Response(JSON.stringify({ error: 'Failed to download uploaded PDF' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const arrayBuffer = await fileBlob.arrayBuffer()
      const fileBytes = new Uint8Array(arrayBuffer)

      pdf = await getDocumentProxy(fileBytes)
      const totalPages = pdf.numPages

      if (!totalPages || totalPages === 0) {
        await markFailed('PDF sayfa sayısı okunamadı (dosya bozuk olabilir).')
        return new Response(JSON.stringify({ error: 'Could not read PDF page count' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const startPage = doc.extracted_pages + 1
      const endPage = Math.min(startPage + PAGES_PER_EXTRACT_BATCH - 1, totalPages)

      // Extract this batch's pages ONE AT A TIME (never Promise.all across
      // the whole book — that concurrent-everything approach is what
      // crashed the isolate on real, large textbooks). This keeps memory
      // and CPU bounded to a small, predictable window regardless of how
      // big the source book is.
      const pagesText: string[] = []
      if (startPage <= endPage) {
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
          const page = await pdf.getPage(pageNum)
          const content = await page.getTextContent()
          const pageText = content.items
            .filter((item: Record<string, unknown>) => item.str != null)
            .map((item: Record<string, unknown>) => `${item.str}${item.hasEOL ? '\n' : ''}`)
            .join('')
          pagesText.push(pageText)
        }
      }

      // Group this batch's freshly extracted pages into chunks, indexed
      // using the ABSOLUTE page position so chunk_index stays globally
      // unique and contiguous across separate calls/batches.
      const chunkIndexBase = Math.floor((startPage - 1) / PAGES_PER_CHUNK)
      const chunks: { chunk_index: number; page_start: number; page_end: number; raw_text: string }[] = []
      for (let i = 0; i < pagesText.length; i += PAGES_PER_CHUNK) {
        const slice = pagesText.slice(i, i + PAGES_PER_CHUNK)
        const pageStart = startPage + i
        const pageEnd = Math.min(pageStart + PAGES_PER_CHUNK - 1, endPage)
        const rawText = slice
          .map((pageText, idx) => `--- SAYFA ${pageStart + idx} ---\n${(pageText || '').trim()}`)
          .join('\n\n')
        chunks.push({
          chunk_index: chunkIndexBase + Math.floor(i / PAGES_PER_CHUNK),
          page_start: pageStart,
          page_end: pageEnd,
          raw_text: rawText
        })
      }

      // Drop chunks that turned out to have no real text (e.g. a blank or
      // pure-image page) — nothing for the AI step to process. A chunk
      // being empty does NOT fail the whole document; we only decide the
      // whole book had no usable text once every page has been seen (below).
      const nonEmptyChunks = chunks.filter(c => c.raw_text.replace(/--- SAYFA \d+ ---/g, '').trim().length > 20)

      if (nonEmptyChunks.length > 0) {
        const chunkRows = nonEmptyChunks.map(c => ({
          document_id: doc.id,
          course_code: doc.course_code,
          chunk_index: c.chunk_index,
          page_start: c.page_start,
          page_end: c.page_end,
          raw_text: c.raw_text,
          status: 'pending'
        }))

        // Insert in batches to stay well under any single-request payload
        // limits (mostly relevant if PAGES_PER_EXTRACT_BATCH is turned up).
        const INSERT_BATCH_SIZE = 50
        for (let i = 0; i < chunkRows.length; i += INSERT_BATCH_SIZE) {
          const batch = chunkRows.slice(i, i + INSERT_BATCH_SIZE)
          const { error: chunkInsertErr } = await serviceClient
            .from('course_knowledge_chunks')
            .insert(batch)
          if (chunkInsertErr) {
            console.error('Failed to insert chunk batch:', chunkInsertErr)
            await markFailed('Parçalar veritabanına kaydedilemedi.')
            return new Response(JSON.stringify({ error: 'Failed to persist document chunks' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
        }
      }

      const newExtractedPages = endPage
      const newTotalChunks = (doc.total_chunks || 0) + nonEmptyChunks.length
      const isDone = newExtractedPages >= totalPages

      const updatePayload: Record<string, unknown> = {
        total_pages: totalPages,
        extracted_pages: newExtractedPages,
        total_chunks: newTotalChunks
      }
      if (isDone) {
        // Only now, having seen every single page, can we tell whether the
        // whole book genuinely had no usable text (e.g. a pure scanned-image
        // PDF with no text layer) — as opposed to just this batch's pages
        // being blank/images, which is normal and not a failure.
        if (newTotalChunks === 0) {
          await markFailed('PDF içinde işlenebilir metin bulunamadı (taranmış görsel sayfalar olabilir).')
          return new Response(JSON.stringify({ error: 'No usable text found anywhere in this PDF' }), {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        updatePayload.status = 'processing'
      }

      const { error: updateErr } = await serviceClient
        .from('course_knowledge_documents')
        .update(updatePayload)
        .eq('id', doc.id)
      if (updateErr) console.error('Failed to update document row after extraction batch:', updateErr)

      return new Response(JSON.stringify({
        documentId: doc.id,
        totalPages,
        extractedPages: newExtractedPages,
        totalChunks: newTotalChunks,
        done: isDone
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (extractErr) {
      console.error('PDF extraction exception:', extractErr)
      await markFailed(extractErr instanceof Error ? extractErr.message : 'Bilinmeyen bir hata oluştu.')
      return new Response(JSON.stringify({ error: 'Failed to extract text from PDF' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } finally {
      // Release the PDF.js document/worker resources for this batch — we
      // reopen the document fresh on every call anyway (Edge Functions are
      // stateless between invocations), so nothing should be kept alive
      // past this request.
      try { await pdf?.loadingTask?.destroy() } catch (_e) { /* best-effort cleanup */ }
    }
  } catch (err) {
    console.error('admin-ingest-course-pdf exception:', err)
    return new Response(JSON.stringify({ error: 'Internal server error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
