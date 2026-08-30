-- ==========================================================================
-- Acadex: PERMANENTLY REMOVE the "Kitap Tarama" admin book-scanning system.
--
-- ⚠️ DESTRUCTIVE MIGRATION — READ BEFORE RUNNING ⚠️
-- This drops course_knowledge_documents, course_knowledge_chunks, and
-- course_knowledge_index. Any book/PDF already scanned (including the
-- Global Business textbook processed earlier this project) — its extracted
-- text, its derived topics/terms/points/formulas, and any AI-generated
-- official summaries (ai_summary) — is permanently lost the moment this
-- runs. There is no undo short of restoring a database backup from before
-- this ran.
--
-- IMPORTANT — storage bucket is NOT deleted by this SQL:
-- Supabase blocks raw `delete from storage.objects` / `storage.buckets`
-- with error 42501 ("Direct deletion from storage tables is not allowed.
-- Use the Storage API instead.") — a protection trigger, not a permissions
-- issue. Also note: in the SQL Editor all statements in one query run in a
-- single transaction, so if that delete fails, EVERYTHING in the same run
-- (including the policy/table drops below) rolls back together — nothing
-- partial gets applied. That's why this file no longer includes those two
-- delete lines. To actually remove the uploaded PDFs and the bucket, do it
-- through the Storage API surface instead:
--   Dashboard → Storage → select the "course-knowledge-pdfs" bucket →
--   select all files → Delete → then delete the (now-empty) bucket itself
--   via the bucket's "..." menu → Delete bucket.
-- This can be done before, after, or independently of running the SQL
-- below — the two are unrelated once the storage.objects DELETE lines are
-- removed from the SQL.
--
-- Why: repeated production issues with real large textbooks (Edge Function
-- crashes on a 673-page PDF, Groq free-tier rate-limit exhaustion causing
-- silent partial failures, transient 5xx errors mid-scan) made the feature
-- more trouble than it was worth; the product decision was to remove it
-- entirely rather than keep patching it.
--
-- Paired code changes (already applied, same session):
--   - supabase/functions/admin-ingest-course-pdf,
--     admin-process-course-knowledge, admin-generate-course-summary — these
--     three Edge Functions are now dead code. DELETE THEIR FOLDERS and run,
--     for each:
--       supabase functions delete admin-ingest-course-pdf
--       supabase functions delete admin-process-course-knowledge
--       supabase functions delete admin-generate-course-summary
--   - admin.html / js/admin.js — the "Kitap Tarama" sidebar tab and its
--     entire panel (upload form, progress bar, documents table, "Resmi
--     Özet" modal) were deleted.
--   - supabase/functions/generate-exam/index.ts — the admin-knowledge
--     grounding tier (the part that queried course_knowledge_index and
--     treated it as the highest-trust source) was removed; exam grounding
--     now falls back to pooled shared study_cards, same as before this
--     feature ever existed.
--   - js/dashboard.js — the course-selection hint's "✅ resmi kaynak
--     taranmış" check and the official-summary toggle UI in Sınav
--     Platformu were removed for the same reason.
--
-- NOT touched: public.exams.is_admin_knowledge_grounded (added by
-- 20260829_add_course_knowledge_base.sql) is left in place — it's just a
-- historical flag on past exam rows and carries no foreign key to the
-- tables being dropped here, so there's nothing to break by keeping it.
-- course_resources ("Ders Kaynakları", students self-reporting a course's
-- real textbook) is a completely separate, unrelated feature and is NOT
-- affected by this migration.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Drop the storage RLS policy that referenced this bucket. (Dropping a
--    policy is plain DDL on pg_policy, not a data delete on storage.objects
--    / storage.buckets, so it is NOT affected by the protection trigger
--    described above and runs fine here.)
-- --------------------------------------------------------------------------
drop policy if exists "Admin manage course knowledge pdfs" on storage.objects;

-- --------------------------------------------------------------------------
-- 2. Drop the RLS policies, then the tables themselves (cascade to be safe
--    about the foreign keys between them: chunks -> documents, both ->
--    courses). Order: chunks, then documents, then index (index has no FK
--    to the other two, just to courses).
-- --------------------------------------------------------------------------
drop policy if exists "course_knowledge_chunks_admin_all" on public.course_knowledge_chunks;
drop policy if exists "course_knowledge_documents_admin_all" on public.course_knowledge_documents;
drop policy if exists "course_knowledge_index_select_authenticated" on public.course_knowledge_index;
drop policy if exists "course_knowledge_index_admin_write" on public.course_knowledge_index;

drop table if exists public.course_knowledge_chunks cascade;
drop table if exists public.course_knowledge_documents cascade;
drop table if exists public.course_knowledge_index cascade;
