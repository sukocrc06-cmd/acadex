-- ==========================================================================
-- Acadex: fix public.exams' exam_type CHECK constraint to allow
-- 'calculation' as a valid value.
--
-- This migration is NOT applied automatically -- run it yourself via:
--   1. Supabase Studio -> SQL Editor -> paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- Bug this fixes: generating any 'calculation' exam type (the "Hesaplama
-- Sınavı" option in the Sınav Platformu) failed to save with:
--   "new row for relation \"exams\" violates check constraint
--    \"exams_exam_type_check\""
--
-- The exams table predates the migrations tracked in this repo (it was
-- created directly in Supabase), and its exam_type CHECK constraint was
-- apparently never updated to include 'calculation' even though the app's
-- generate-exam function and Sınav Platformu UI have long supported it as
-- an exam type (alongside 'classic', 'test', and 'mixed'). This recreates
-- the constraint with all four values allowed.
-- ==========================================================================

alter table public.exams drop constraint if exists exams_exam_type_check;
alter table public.exams add constraint exams_exam_type_check
  check (exam_type in ('classic', 'test', 'mixed', 'calculation'));
