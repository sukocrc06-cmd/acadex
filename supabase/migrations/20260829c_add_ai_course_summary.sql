-- ==========================================================================
-- Acadex: admin-triggered "Resmi Özet Oluştur" (official AI-written course
-- summary), built directly into the existing Kitap Tarama flow.
--
-- Design history: an earlier draft of this migration created a brand-new
-- table (course_official_summaries) for a separate student-facing "Ders
-- Özetleri" browsing panel. That plan was superseded by a simpler product
-- decision: instead of a new panel, the admin generates the summary with a
-- button right inside Kitap Tarama (next to the course they just scanned),
-- and students see it inline in Sınav Platformu's existing course-selection
-- screen (the same place that already shows "✅ Bu ders için resmi kaynak
-- taranmış"). Because course_knowledge_index (see
-- 20260829_add_course_knowledge_base.sql) already holds one row per
-- scanned course with topics_outline/key_terms/key_points/formulas AND a
-- synthesized_summary column, a whole new table would just duplicate that —
-- this migration adds two columns to the EXISTING table instead.
--
-- Why two new columns rather than reusing synthesized_summary: that column
-- is already written automatically, on every scan/resync, by
-- admin-process-course-knowledge's resyncCourseIndex() — but only as a
-- flat, deterministic concatenation of topic labels (no Groq call, just
-- string-joining), used internally as a cheap fallback. The admin's "Resmi
-- Özet Oluştur" button instead makes ONE real Groq call to write an
-- actual, well-organized prose summary meant for students to read directly.
-- Keeping it in separate columns means:
--   - the automatic deterministic resync (on every chunk processed) never
--     silently overwrites an admin-authored AI summary, and
--   - ai_summary_generated_at doubles as the "has an official summary been
--     generated for this course yet?" flag the UI needs (admin.js's Kitap
--     Tarama table, and dashboard.js's Sınav Platformu course-selection
--     hint), without a second round-trip to check some other table.
-- ==========================================================================

alter table public.course_knowledge_index
  add column if not exists ai_summary text,
  add column if not exists ai_summary_generated_at timestamptz;

-- No RLS changes needed: course_knowledge_index already has a
-- "select to authenticated using (true)" policy (same "public reference
-- data" tier as courses/departments) and an admin-only write policy from
-- 20260829_add_course_knowledge_base.sql, both of which already cover
-- these two new columns.
