-- ==========================================================================
-- Acadex: Let card_depot.content hold images (base64 data URLs), not just
-- short table/chart JSON or key-term/point text
--
-- Context: "Kaynakla Sohbet" now lets a student send a photo/diagram image
-- to the "Çalışma Defteri" staging depot (card_depot, source_type='image')
-- via the same 📥 Deftere Gönder mechanism already used for tables/charts/
-- text. Those earlier payloads were always small (a few KB of JSON or a
-- short excerpt), so `content` may have been defined with a bounded type
-- (e.g. varchar(n)) that never caused problems until now — a downscaled
-- photo's base64 data URL can run several hundred KB, which overflows a
-- capped varchar and gets rejected by Postgres with a 400 from PostgREST
-- (confirmed via browser console: "Failed to load resource: ... 400 ...
-- /rest/v1/card_depot").
--
-- Fix: widen `content` to `text` (unbounded). If it's already `text`, this
-- is a harmless no-op-ish cast — safe to run either way.
-- ==========================================================================

alter table public.card_depot
  alter column content type text using content::text;
