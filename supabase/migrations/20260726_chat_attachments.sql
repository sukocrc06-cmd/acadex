-- ==========================================================================
-- Acadex: Persist images (from Kaynakla Sohbet) onto their study card
--
-- Context: "Kaynakla Sohbet" (chat-with-document) can now analyze an
-- attached photo/screenshot and can also generate a free Mermaid.js diagram
-- reconstructing a chart/diagram the student asked about. Students should be
-- able to keep any of these images (the photo they attached, an AI-drawn
-- diagram, or a paid AI-generated illustration) as part of the study card
-- itself, not just in the ephemeral chat window.
--
-- Design choice: store images as base64 data URLs directly inside a jsonb
-- array column on study_cards, rather than a Storage bucket + signed URLs.
-- Images going through this path are already downscaled/compressed on the
-- client (~100-400KB), and this keeps the feature simple — no new bucket,
-- no new RLS policies to get right, no signed-URL round trip. A cap is
-- enforced client-side (max ~12 images per card, oldest dropped first) to
-- keep row size sane.
--
-- No RLS changes needed: study_cards already has owner-select/update and
-- teacher-open-access-select policies from earlier migrations, and this is
-- just a new column on that same table — existing policies apply to it
-- automatically since Postgres RLS is row-level, not column-level.
-- ==========================================================================

alter table public.study_cards
  add column if not exists chat_attachments jsonb not null default '[]'::jsonb;

comment on column public.study_cards.chat_attachments is
  'Array of { id, dataUrl, caption, source, createdAt } images saved from Kaynakla Sohbet (chat-with-document) — student-attached photos, free Mermaid-rendered diagrams, or paid AI-generated illustrations. Capped client-side to ~12 entries per card.';

-- ==========================================================================
-- After running this, no Edge Function redeploy is needed for this file
-- alone — but chat-with-document DOES need redeploying separately for the
-- new Mermaid-diagram-generation prompt changes:
--   supabase functions deploy chat-with-document
-- and the new generate-study-image function needs its first deploy:
--   supabase functions deploy generate-study-image
-- (that one also requires an OPENAI_API_KEY secret — see the function's
-- own header comment for the exact command).
-- ==========================================================================
