-- ==========================================================================
-- Acadex: Hierarchical/structural summaries (NotebookLM-style topic outline)
--
-- Context: summarize-document and merge-summarize can now optionally break
-- a document down into 2-6 major topic-based SECTIONS (each with its own
-- short heading + 2-4 sentence blurb), letting a student jump straight to
-- the topic they need instead of reading one long undifferentiated summary.
-- Short or single-topic documents legitimately get an empty array — this is
-- never forced.
--
-- Design choice: same pattern as chat_attachments (see
-- 20260726_chat_attachments.sql) — a plain jsonb array column on
-- study_cards, additive and backward-compatible. Existing rows default to
-- '[]' and every existing consumer of study_cards that doesn't know about
-- this column is completely unaffected.
--
-- No RLS changes needed: study_cards already has owner-select/update and
-- teacher-open-access-select policies from earlier migrations, and this is
-- just a new column on that same table — existing policies apply to it
-- automatically since Postgres RLS is row-level, not column-level.
-- ==========================================================================

alter table public.study_cards
  add column if not exists sections jsonb not null default '[]'::jsonb;

comment on column public.study_cards.sections is
  'Array of { heading, summary } objects — a structural/topic-level breakdown of the document into 2-6 major sections, each with its own short summary blurb. Lets students navigate a long summary by topic instead of reading one long undifferentiated block. Empty array is correct and expected for short/single-topic documents — never forced.';

-- ==========================================================================
-- After running this, redeploy both edge functions for the new "sections"
-- field to actually start populating on newly-generated study cards:
--   supabase functions deploy summarize-document
--   supabase functions deploy merge-summarize
-- Existing study cards are unaffected (sections defaults to '[]', which the
-- frontend already treats as "no outline to show" and falls back cleanly to
-- the plain summary view).
-- ==========================================================================
