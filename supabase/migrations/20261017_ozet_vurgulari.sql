-- ==========================================================================
-- Özet kartı: fosforlu kalem vurguları ve kenar notları
--
-- Supabase SQL Editor'da bir kez çalıştır. Yalnızca yeni tablo ekler; mevcut
-- veriye dokunmaz, tekrar çalıştırmak güvenlidir.
--
-- Çalıştırılmazsa da vurgular çalışır, ama yalnızca o tarayıcıda saklanır.
-- Her kullanıcı yalnızca kendi vurgularını görür (başkasının paylaştığı bir
-- karta yaptığın vurgular da sadece sende kalır).
-- ==========================================================================

create table if not exists public.study_card_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid not null references public.study_cards(id) on delete cascade,
  data jsonb not null default '{"items": []}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, card_id)
);
alter table public.study_card_highlights enable row level security;
drop policy if exists "study_card_highlights_own" on public.study_card_highlights;
create policy "study_card_highlights_own" on public.study_card_highlights
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
