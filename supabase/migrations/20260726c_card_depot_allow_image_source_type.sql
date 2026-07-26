-- ==========================================================================
-- Acadex: Allow source_type = 'image' in card_depot
--
-- Context: "Kaynakla Sohbet" lets a student send a photo/diagram image to the
-- "Çalışma Defteri" staging depot (card_depot) via the same 📥 Deftere Gönder
-- mechanism already used for tables/charts. The existing check constraint
-- "card_depot_source_type_check" only allowed:
--   'key_term', 'key_point', 'quiz_question', 'table', 'chart'
-- so an insert with source_type='image' was rejected with:
--   "new row for relation \"card_depot\" violates check constraint
--    \"card_depot_source_type_check\""
--
-- Fix: drop and recreate the constraint with the exact same original values
-- plus 'image'. Nothing else changes — every value that was previously
-- allowed remains allowed, so existing rows are unaffected.
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
    'image'::text
  ]));
