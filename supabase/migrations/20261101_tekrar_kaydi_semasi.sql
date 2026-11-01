-- ==========================================================================
-- ACADEX — TEKRAR KAYDI ŞEMASI ONARIMI (public.card_item_confidence)
--
-- NEDEN VAR (01.11.2026): tablo Supabase panelinden elle oluşturulmuş, hiçbir
-- migration'da tanımlı değil; istemci kodu ondan sonra ayrışmış. Üç çağrı yeri
-- de (js/dashboard.js:11056, js/acadex-ink.js:2077 ve :8426) aynı 12 kolonu
-- gönderiyor:
--   user_id, study_card_id, item_key, card_type, rating, last_rating,
--   ease_factor, interval_days, repetitions, lapses, next_review_at, updated_at
-- Canlı tabloda ölçülen durum (01.11.2026):
--   - item_key / rating / updated_at kolonları YOK,
--   - item_type, item_index, confidence NOT NULL ama istemci hiç göndermiyor,
--   - item_type CHECK yalnız key_term/key_point/quiz_question kabul ediyor,
--     istemcinin card_type değerleri ise terms/quiz/cloze/point,
--   - upsert'in onConflict'i UNIQUE (user_id, study_card_id, item_key) istiyor,
--     tablodaki kısıt ise (user_id, study_card_id, item_type, item_index).
-- Sonuç: her SM-2 yazması PostgREST'te düşüyor, tablo iki aydır 0 satır.
-- Okuma tarafı hatayı yutuyor (js/dashboard.js:10687 `if (!error)`) ve ilerleme
-- localStorage'dan okunduğu için özellik ekranda çalışıyor görünüyor; login.html
-- :609 "tekrar zamanı gelmiş" sayısı da hep 0 kalıyor.
--
-- YÖN: şemayı koda uyduruyoruz, tersi değil. Tabloda korunacak 0 satır var,
-- kod ise 4 dosyada kendi içinde tutarlı (item_key 16 yerde). Tersi 16 çağrı
-- yerini iki devasa dosyada değiştirmek olurdu (CLAUDE.md §6).
--
-- Eski UNIQUE (user_id, study_card_id, item_type, item_index) KALDIRILMADI:
-- item_type/item_index artık NULL kaldığı için (varsayılan NULLS DISTINCT)
-- çakışma üretmez, dokunmamak daha dar bir düzeltme.
-- Teste bağlı: tests/tekrar-kaydi-semasi.js
-- ==========================================================================

alter table public.card_item_confidence
  add column if not exists item_key   text,
  add column if not exists rating     text,
  add column if not exists updated_at timestamptz not null default now();

-- istemcinin hiç göndermediği kolonlar artık satır yazmayı engellemesin
alter table public.card_item_confidence alter column item_type  drop not null;
alter table public.card_item_confidence alter column item_index drop not null;
alter table public.card_item_confidence alter column confidence drop not null;
alter table public.card_item_confidence alter column confidence set default 'new';

-- rating, computeSm2 (js/dashboard.js:10962) ile aynı kümeyi taşır;
-- mevcut confidence CHECK'iyle birebir aynı alan adı
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'card_item_confidence_rating_check'
  ) then
    alter table public.card_item_confidence
      add constraint card_item_confidence_rating_check
      check (rating is null or rating in ('new', 'again', 'hard', 'good', 'easy'));
  end if;
end $$;

-- upsert'in onConflict: 'user_id,study_card_id,item_key' çıkarımı bu indekse bakar
create unique index if not exists card_item_confidence_user_card_itemkey_key
  on public.card_item_confidence (user_id, study_card_id, item_key);
