-- ==========================================================================
-- Acadex: allow exams to be generated directly from a Ders Ağacı course,
-- not only from an existing personal study card.
--
-- This migration is NOT applied automatically -- run it yourself via:
--   1. Supabase Studio -> SQL Editor -> paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- Adds to public.exams:
--   - source_type text ('study_card' | 'course'), default 'study_card' so
--     every existing row stays valid with no backfill needed.
--   - study_card_id becomes nullable — a course-sourced exam has no single
--     owning study card.
--   - course_code / course_department — set only for source_type='course'.
--     course_department stores the free-text department NAME (matching
--     study_cards.department / profiles.department), not departments.code,
--     so it can be joined the same way study_cards.department already is.
--   - is_grounded boolean — true when the exam was built from real,
--     student-shared study cards for that course; false when generate-exam
--     had to fall back to the AI's own general knowledge because no shared
--     cards existed yet for that course. Always true for source_type=
--     'study_card' (a personal card is always real content). Surfaced in
--     the UI so students know how much to trust an ungrounded course exam.
--
-- No RLS policy changes needed: the existing exams RLS (student owns via
-- user_id, teacher/admin oversight via 20260719_admin_teacher_portals.sql)
-- keys off user_id, never study_card_id, so it already covers these rows.
-- ==========================================================================

alter table public.exams alter column study_card_id drop not null;

alter table public.exams add column if not exists source_type text not null default 'study_card';
alter table public.exams add column if not exists course_code text;
alter table public.exams add column if not exists course_department text;
alter table public.exams add column if not exists is_grounded boolean;

-- Backfill: every pre-existing row is a personal-study-card exam built from
-- real content.
update public.exams set is_grounded = true where is_grounded is null;

alter table public.exams drop constraint if exists exams_source_type_check;
alter table public.exams add constraint exams_source_type_check
  check (source_type in ('study_card', 'course'));

alter table public.exams drop constraint if exists exams_source_consistency_check;
alter table public.exams add constraint exams_source_consistency_check
  check (
    (source_type = 'study_card' and study_card_id is not null)
    or (source_type = 'course' and course_code is not null)
  );

create index if not exists exams_course_code_idx on public.exams (course_code);
