-- ==========================================================================
-- Acadex: "Gerçek Sınav Simülasyonu" mode for the Sınav Platformu.
--
-- This migration is NOT applied automatically -- run it yourself via:
--   1. Supabase Studio -> SQL Editor -> paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- Adds to public.exams:
--   - is_simulation boolean, default false — a timed, single-attempt exam
--     meant to mimic real vize/final/büt conditions (hints disabled,
--     auto-submits when time runs out), as opposed to an untimed practice
--     attempt.
--   - time_limit_seconds integer, nullable — the time budget generate-exam
--     computed for a simulation attempt (based on question count/type);
--     null for ordinary (non-simulation) attempts.
--
-- No RLS changes needed — same reasoning as 20260828_add_course_exams.sql.
-- ==========================================================================

alter table public.exams add column if not exists is_simulation boolean not null default false;
alter table public.exams add column if not exists time_limit_seconds integer;
