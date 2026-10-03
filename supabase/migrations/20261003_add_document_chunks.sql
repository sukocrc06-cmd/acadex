-- ==========================================================================
-- Acadex: document_chunks — extracted document text, persisted once.
--
-- This migration is NOT applied automatically — run this file yourself via
-- one of:
--   1. Supabase Studio → SQL Editor → paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- WHY THIS EXISTS
--
-- Until now, the text extracted from a student's uploaded document was never
-- stored anywhere. Two consequences, both measurable:
--
--   1. chat-with-document re-downloaded the file from storage and re-parsed
--      it (unpdf / mammoth / jszip) on EVERY SINGLE chat message, then
--      truncated the result at 100,000 characters. A student asking five
--      questions about one 60-page PDF paid for five full downloads and five
--      full PDF parses. That is pure repeated work: the bytes never change.
--
--   2. Nothing downstream could ever address a specific passage, because
--      there was no stable, addressable unit of the document to point at.
--      Verifiable citations, retrieval ("find the passages about X" instead
--      of stuffing the whole document into the prompt), and resumable
--      processing of documents too large for one Edge invocation all need
--      exactly this table before they can be built at all.
--
-- WHAT IT ADDS
--
--   document_chunks — one row per ordered slice of one document's extracted
--   text. Chunks are paragraph-aware and never span a page boundary, so
--   page_start/page_end identify where a passage actually came from.
--
-- WHY PAGE NUMBERS ARE COLUMNS AND NOT INLINE MARKERS
--
--   summarize-document inserts "--- SAYFA N ---" / "--- SLAYT N ---" marker
--   lines into the text it extracts; chat-with-document extracts the same
--   file with mergePages and inserts no markers at all. Storing the marker
--   lines inside `text` would push that inconsistency onto every future
--   consumer and would leak marker syntax into prompts that know nothing
--   about it. The page range is real data, so it gets real columns, and
--   `text` stays clean prose that any consumer can use as-is.
--
-- SIZE NOTE
--
--   Chunks are ~1,200 characters — sized for semantic retrieval, NOT for the
--   7,000-character LLM extraction windows in summarize-document. Those two
--   are independent concerns: window size is set by the model's token
--   budget, chunk size by how precisely we want to address a passage. A
--   60-page PDF lands at roughly 100-150 rows here.
-- ==========================================================================

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index int not null,
  -- Page (or slide) range this chunk came from. NULL for formats with no
  -- reliable page concept (DOCX, plain text) — never invent a number.
  page_start int,
  page_end int,
  text text not null,
  char_count int not null,
  created_at timestamptz not null default now(),
  -- Re-processing a document replaces its chunks; this keeps a retry from
  -- silently doubling them up.
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id);

-- Ordered reads ("give me this document's text back in order") are the
-- single hottest query against this table.
create index if not exists document_chunks_document_id_chunk_index_idx
  on public.document_chunks (document_id, chunk_index);

alter table public.document_chunks enable row level security;

-- A student may read the chunks of their OWN documents only. This is their
-- own uploaded material, so unlike the admin-only course_knowledge_chunks
-- table there is no copyright reason to hide it from them — but it is still
-- private to them, hence the ownership check through the parent document.
drop policy if exists "document_chunks_select_own" on public.document_chunks;
create policy "document_chunks_select_own"
  on public.document_chunks for select
  to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id
        and d.user_id = auth.uid()
    )
  );

-- Writes come only from the edge functions, which use the service role and
-- bypass RLS. No insert/update/delete policy is granted to `authenticated`
-- on purpose: a student must not be able to rewrite the stored text of a
-- document, since that text is what citations and (later) retrieval are
-- checked against. Letting the client edit it would make every citation
-- unverifiable.
