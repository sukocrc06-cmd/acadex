import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { extractText, getDocumentProxy } from "npm:unpdf"

// ==========================================================================
// Acadex — admin-only "Kitap Tarama" ingestion step (step 1 of 2).
//
// Takes an already-uploaded PDF (in the private 'course-knowledge-pdfs'
// storage bucket) and turns it into persisted, page-range chunks ready for
// AI processing. Deliberately does NOT call Groq here — this step is pure
// local text extraction (unpdf), which is fast even for a large book, so it
// comfortably fits in one Edge Function call regardless of page count. The
// actual (slow, LLM-per-chunk) processing happens in a separate function,
// admin-process-course-knowledge, called repeatedly afterward.
//
// Admin-only: verified via profiles.is_admin using the CALLER's own JWT
// (userClient) before any privileged work happens on the service-role
// client. See supabase/migrations/20260829_add_course_knowledge_base.sql.
// ==========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// How many extracted PDF pages go into one persisted chunk. Smaller chunks
// mean more (cheaper, faster) individual Groq calls during processing but
// more rows/round-trips; larger chunks mean fewer, heavier calls. 4 pages is
// a reasonable middle ground for typical textbook page density.
const PAGES_PER_CHUNK = 4

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

    const { courseCode, storagePath, fileName } = await req.json()
    if (!courseCode || !storagePath || !fileName) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: courseCode, storagePath, fileName' }), {
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

    // Create the document row up front (status 'extracting') so the admin
    // UI has something to show/poll even if extraction itself is slow for a
    // very large file.
    const { data: docRow, error: docInsertErr } = await serviceClient
      .from('course_knowledge_documents')
      .insert({
        course_code: courseCode,
        file_name: fileName,
        storage_path: storagePath,
        status: 'extracting',
        uploaded_by: user.id
      })
      .select()
      .single()

    if (docInsertErr || !docRow) {
      console.error('Failed to create course_knowledge_documents row:', docInsertErr)
      return new Response(JSON.stringify({ error: 'Failed to create document record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const markFailed = async (message: string) => {
      await serviceClient
        .from('course_knowledge_documents')
        .update({ status: 'failed', error_message: message.slice(0, 500) })
        .eq('id', docRow.id)
    }

    try {
      const { data: fileBlob, error: downloadError } = await serviceClient.storage
        .from('course-knowledge-pdfs')
        .download(storagePath)

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

      const pdf = await getDocumentProxy(fileBytes)
      const { text: pdfPages } = await extractText(pdf, { mergePages: false })

      if (!pdfPages || pdfPages.length === 0) {
        await markFailed('PDF içinden metin çıkarılamadı (taranmış görsel sayfalar olabilir).')
        return new Response(JSON.stringify({ error: 'No extractable text found in PDF' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const totalPages = pdfPages.length
      const chunks: { chunk_index: number; page_start: number; page_end: number; raw_text: string }[] = []
      for (let i = 0; i < totalPages; i += PAGES_PER_CHUNK) {
        const pageSlice = pdfPages.slice(i, i + PAGES_PER_CHUNK)
        const pageStart = i + 1
        const pageEnd = Math.min(i + PAGES_PER_CHUNK, totalPages)
        const rawText = pageSlice
          .map((pageText, idx) => `--- SAYFA ${pageStart + idx} ---\n${(pageText || '').trim()}`)
          .join('\n\n')
        chunks.push({
          chunk_index: chunks.length,
          page_start: pageStart,
          page_end: pageEnd,
          raw_text: rawText
        })
      }

      // Drop chunks that turned out to have no real text (e.g. a blank or
      // pure-image page) — nothing for the AI step to process.
      const nonEmptyChunks = chunks.filter(c => c.raw_text.replace(/--- SAYFA \d+ ---/g, '').trim().length > 20)

      if (nonEmptyChunks.length === 0) {
        await markFailed('PDF içinde işlenebilir metin bulunamadı.')
        return new Response(JSON.stringify({ error: 'No usable text chunks extracted from PDF' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const chunkRows = nonEmptyChunks.map(c => ({
        document_id: docRow.id,
        course_code: courseCode,
        chunk_index: c.chunk_index,
        page_start: c.page_start,
        page_end: c.page_end,
        raw_text: c.raw_text,
        status: 'pending'
      }))

      // Insert in batches to stay well under any single-request payload
      // limits for very large books (a 600-page book is ~150 chunks).
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

      const { error: updateErr } = await serviceClient
        .from('course_knowledge_documents')
        .update({
          total_pages: totalPages,
          total_chunks: chunkRows.length,
          status: 'processing'
        })
        .eq('id', docRow.id)

      if (updateErr) console.error('Failed to update document row after chunking:', updateErr)

      return new Response(JSON.stringify({
        documentId: docRow.id,
        totalPages,
        totalChunks: chunkRows.length
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
    }
  } catch (err) {
    console.error('admin-ingest-course-pdf exception:', err)
    return new Response(JSON.stringify({ error: 'Internal server error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
