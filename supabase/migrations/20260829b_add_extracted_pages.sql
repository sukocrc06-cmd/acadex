-- ==========================================================================
-- Acadex: fix for real book uploads failing with "Failed to fetch" in
-- Kitap Tarama.
--
-- Root cause: admin-ingest-course-pdf used to extract text from EVERY page
-- of the uploaded PDF concurrently in a single call (unpdf's extractText
-- helper runs Promise.all across all pages at once). For a real ~670-page
-- textbook this blew past the Edge Function's memory/time budget and
-- crashed the function mid-request -- the browser only ever saw a bare
-- network error ("Failed to fetch"), never a real error message.
--
-- Fix (paired with the admin-ingest-course-pdf code change): extraction is
-- now resumable and batched, a fixed number of pages at a time, the same
-- way admin-process-course-knowledge already batches its AI processing
-- step. This column is where that progress is persisted between calls.
-- ==========================================================================

alter table public.course_knowledge_documents
  add column if not exists extracted_pages int not null default 0;
