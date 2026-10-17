-- ==========================================================================
-- Acadex: Allow source_type = 'transcript' in card_depot
--
-- Context: the "Sesli Özet" (AI podcast) player is built from a two-host
-- dialogue that generate-podcast-script already produces AS TEXT and caches
-- on study_cards.podcast_script ({ hostNames, script: [{speaker, text}] }).
-- Nothing is transcribed at playback time — the text exists before the audio
-- does. "📝 Deftere aktar" sends that dialogue to the staging depot so it can
-- be dropped onto a notebook page as a speaker-formatted transcript card.
--
-- A transcript is not a key_point: it is a structured, multi-speaker,
-- multi-line document. Storing it under an existing type would lose the
-- speaker split (the sticky-note save path flattens text to a single line)
-- and would make it impossible to tell transcripts apart in the depot list.
--
-- The existing check constraint "card_depot_source_type_check" allowed:
--   'key_term', 'key_point', 'quiz_question', 'table', 'chart', 'image'
-- so an insert with source_type='transcript' was rejected with:
--   "new row for relation \"card_depot\" violates check constraint
--    \"card_depot_source_type_check\""
--
-- Fix: drop and recreate the constraint with the exact same values plus
-- 'transcript'. Every value that was previously allowed remains allowed, so
-- existing rows are unaffected.
--
-- card_depot.content is already unbounded text (see
-- 20260726b_card_depot_content_unbounded.sql), which matters here: a
-- transcript payload is JSON and runs to a few KB.
-- ==========================================================================

alter table public.card_depot
  drop constraint if exists card_depot_source_type_check;

alter table public.card_depot
  add constraint card_depot_source_type_check
  check (source_type = ANY (ARRAY[
    'key_term'::text,
    'key_point'::text,
    'quiz_question'::text,
    'table'::text,
    'chart'::text,
    'image'::text,
    'transcript'::text
  ]));
