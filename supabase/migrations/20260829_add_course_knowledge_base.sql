-- ==========================================================================
-- Acadex: Admin-only "Kitap Tarama" (full-book knowledge ingestion) system.
--
-- This migration is NOT applied automatically -- run it yourself via:
--   1. Supabase Studio -> SQL Editor -> paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- What this is for: lets the ADMIN (and only the admin -- not teachers, not
-- students) upload a full textbook/lecture-notes PDF of any page count for a
-- catalog course. Because a whole book is far beyond both a single Groq
-- prompt's size and a single Supabase Edge Function's ~150s time limit, the
-- book is split into page-range chunks that are PERSISTED here and processed
-- a few at a time across repeated calls (the admin UI polls in a loop with a
-- progress bar, and can safely resume later since all state lives in these
-- tables, not in memory). Once every chunk for a course is processed, the
-- results are merged into course_knowledge_index -- a single, per-course
-- summary of topics/key terms/key points/formulas that generate-exam (and
-- future summary-generation features) can draw on as the most trustworthy
-- signal available for that course, above pooled shared study cards and
-- above student-reported course_resources.
--
-- Copyright note: the raw extracted book text lives ONLY in
-- course_knowledge_chunks, which is never exposed to students (admin-only
-- RLS below, no student-facing query anywhere reads it). Only the fully
-- DERIVED, synthesized knowledge in course_knowledge_index (topic labels,
-- key terms, key points, formulas -- not verbatim book text) is readable by
-- students, the same way courses/departments are public reference data.
--
-- What it adds:
--   1. course_knowledge_documents -- one row per uploaded PDF.
--   2. course_knowledge_chunks -- one row per page-range chunk of a document,
--      holding its raw extracted text (until processed) and, once
--      processed, the AI-extracted topic/terms/points/formulas for just
--      that chunk.
--   3. course_knowledge_index -- one row per course: the merged, synthesized
--      knowledge base built from all of that course's processed chunks
--      across all its uploaded documents.
--   4. course-knowledge-pdfs storage bucket -- private, admin-only.
-- ==========================================================================

create table if not exists public.course_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  course_code text not null references public.courses(course_code) on delete cascade,
  file_name text not null,
  storage_path text not null,
  total_pages int,
  total_chunks int not null default 0,
  processed_chunks int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'extracting', 'processing', 'completed', 'failed')),
  error_message text,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists course_knowledge_documents_course_code_idx on public.course_knowledge_documents (course_code);

create table if not exists public.course_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.course_knowledge_documents(id) on delete cascade,
  course_code text not null references public.courses(course_code) on delete cascade,
  chunk_index int not null,
  page_start int,
  page_end int,
  raw_text text,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  topic_label text,
  extracted_summary text,
  extracted_key_terms jsonb,
  extracted_key_points jsonb,
  extracted_formulas jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists course_knowledge_chunks_document_id_idx on public.course_knowledge_chunks (document_id);
create index if not exists course_knowledge_chunks_course_code_idx on public.course_knowledge_chunks (course_code);
create index if not exists course_knowledge_chunks_status_idx on public.course_knowledge_chunks (status);

create table if not exists public.course_knowledge_index (
  course_code text primary key references public.courses(course_code) on delete cascade,
  topics_outline jsonb,
  key_terms jsonb,
  key_points jsonb,
  formulas jsonb,
  synthesized_summary text,
  source_document_ids uuid[],
  chunk_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.course_knowledge_documents enable row level security;
alter table public.course_knowledge_chunks enable row level security;
alter table public.course_knowledge_index enable row level security;

-- Documents & chunks (including raw extracted book text) are ADMIN-ONLY,
-- full stop -- no select policy for plain authenticated users at all, so
-- there is no path, even in theory, for a student to read raw book text
-- through the API.
drop policy if exists "course_knowledge_documents_admin_all" on public.course_knowledge_documents;
create policy "course_knowledge_documents_admin_all"
  on public.course_knowledge_documents for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "course_knowledge_chunks_admin_all" on public.course_knowledge_chunks;
create policy "course_knowledge_chunks_admin_all"
  on public.course_knowledge_chunks for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- course_knowledge_index holds only DERIVED knowledge (no raw text) -- same
-- "public reference data" treatment as courses/departments: any
-- authenticated student can read it (generate-exam uses the student's own
-- session to query it), only the admin (via the edge functions below,
-- using the service-role key) can write it.
drop policy if exists "course_knowledge_index_select_authenticated" on public.course_knowledge_index;
create policy "course_knowledge_index_select_authenticated"
  on public.course_knowledge_index for select
  to authenticated
  using (true);

drop policy if exists "course_knowledge_index_admin_write" on public.course_knowledge_index;
create policy "course_knowledge_index_admin_write"
  on public.course_knowledge_index for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- --------------------------------------------------------------------------
-- Lets generate-exam (and future summary-generation features) mark an exam
-- as grounded in the admin's officially-scanned course knowledge base
-- specifically -- a stronger trust signal than the existing is_grounded
-- (which only means "some pooled student-shared study card existed").
-- --------------------------------------------------------------------------
alter table public.exams add column if not exists is_admin_knowledge_grounded boolean not null default false;

-- --------------------------------------------------------------------------
-- Storage bucket for the uploaded PDFs themselves (private, admin-only).
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('course-knowledge-pdfs', 'course-knowledge-pdfs', false)
on conflict (id) do update set public = false;

drop policy if exists "Admin manage course knowledge pdfs" on storage.objects;
create policy "Admin manage course knowledge pdfs"
  on storage.objects
  for all
  using (
    bucket_id = 'course-knowledge-pdfs'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  )
  with check (
    bucket_id = 'course-knowledge-pdfs'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );
