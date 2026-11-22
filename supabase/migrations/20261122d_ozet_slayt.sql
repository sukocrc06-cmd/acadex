-- ==========================================================================
-- Acadex · Akıllı Çalışma Slaytları (22.11.2026)
-- study_cards.slayt : ozet-slayt fonksiyonunun ürettiği slayt verisi
--                     { surum, uretildi, model, deste }. İkinci açılışta model çağrılmaz.
-- ozet_slayt_kullanim: günlük sınır sayacı (uret 12/gün, pdf 40/gün). Yalnız sunucu
--                     (service role) okur ve yazar; istemciye hiçbir izin yok.
-- Tekrar çalıştırmak zarar vermez.
-- ==========================================================================

alter table public.study_cards add column if not exists slayt jsonb;

create table if not exists public.ozet_slayt_kullanim (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tur text not null check (tur in ('uret', 'pdf')),
  created_at timestamptz not null default now()
);
create index if not exists ozet_slayt_kullanim_kisi on public.ozet_slayt_kullanim (user_id, tur, created_at desc);
alter table public.ozet_slayt_kullanim enable row level security;
-- politika YOK: anon / authenticated erişemez, service role RLS'i atlar.

-- kontrol
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'study_cards' and column_name = 'slayt') as slayt_kolonu,
       (select count(*) from public.ozet_slayt_kullanim) as kullanim_satiri;
