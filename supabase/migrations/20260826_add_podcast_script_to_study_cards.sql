-- Migration: Add podcast_script column to study_cards for the "Sesli Özet"
-- (AI Podcast) feature — a short two-host dialogue script generated once from
-- a study card's existing summary/sections/key points, then cached so it is
-- not regenerated on every listen.
--
-- The script is read aloud entirely client-side with the free browser Web
-- Speech API (window.speechSynthesis) — no TTS API cost. This column only
-- stores the generated dialogue text, never audio.
--
-- After applying this migration, deploy generate-podcast-script so the field
-- gets populated on demand from the study card modal.

alter table public.study_cards
  add column if not exists podcast_script jsonb not null default '{"title":"","hostNames":[],"script":[]}'::jsonb;

comment on column public.study_cards.podcast_script is
  'Cached AI-generated two-host podcast script: { title, hostNames: [string, string], script: [{ speaker: "A"|"B", text }] }. Generated once by generate-podcast-script (grounded strictly in the card''s own summary/sections/key points) and played back client-side via the browser Web Speech API. Empty script array means no podcast has been generated yet for this card.';
