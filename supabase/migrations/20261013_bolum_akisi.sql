-- ==========================================================================
-- Acadex: yeni Bölüm akışı (koridor panosu) tasarımı.
--
-- Bu dosya Supabase SQL Editor'da bir kez çalıştırılmalı. Yalnızca EKLER
-- (yeni tablolar, yeni sütun); mevcut hiçbir veriyi silmez, tekrar
-- çalıştırmak güvenlidir.
--
-- Çalıştırılmazsa da pano çalışır: paylaşımlar ve raptiyeler (study_card_votes)
-- zaten var olan tablolardan gelir; kenar notları, takip ve bildirimler o
-- tarayıcıda tutulur, kâğıt ayarları (başlık, satırlar, renk) yalnızca
-- paylaşan kişinin tarayıcısında görünür.
--
--   study_cards.share_meta  — panoya asarken seçilen başlık, satırlar, kâğıt,
--                              raptiye rengi ve kısa not
--   study_card_notes        — paylaşılan özete ya da bir satırına düşülen notlar
--   study_card_reports      — paylaşım bildirimleri (yalnızca yöneticiler görür)
--   sandbox_follows         — kim kimi takip ediyor (Sandbox ile ortak; önceki
--                              dosya çalıştırıldıysa zaten vardır)
--
-- Acadex sunum için yeni tablo gerekmez: mevcut presentations ve
-- presentation_slides tabloları kullanılır (theme = 'ink').
-- ==========================================================================

alter table public.study_cards add column if not exists share_meta jsonb;

create table if not exists public.study_card_notes (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.study_cards(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 400),
  line_index integer check (line_index is null or line_index between 0 and 20),
  created_at timestamptz not null default now()
);
create index if not exists study_card_notes_card_idx on public.study_card_notes(card_id, created_at);
alter table public.study_card_notes enable row level security;

drop policy if exists "study_card_notes_select" on public.study_card_notes;
create policy "study_card_notes_select" on public.study_card_notes for select to authenticated using (
  exists (select 1 from public.study_cards c where c.id = card_id and (c.is_shared = true or c.user_id = auth.uid()))
);
drop policy if exists "study_card_notes_insert_own" on public.study_card_notes;
create policy "study_card_notes_insert_own" on public.study_card_notes for insert to authenticated with check (
  auth.uid() = user_id
  and exists (select 1 from public.study_cards c where c.id = card_id and (c.is_shared = true or c.user_id = auth.uid()))
);
drop policy if exists "study_card_notes_delete_own_or_owner" on public.study_card_notes;
create policy "study_card_notes_delete_own_or_owner" on public.study_card_notes for delete to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from public.study_cards c where c.id = card_id and c.user_id = auth.uid())
);

create table if not exists public.study_card_reports (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.study_cards(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text not null check (reason in ('yanlis', 'izinsiz', 'dil', 'spam')),
  created_at timestamptz not null default now(),
  unique (card_id, reporter_id)
);
alter table public.study_card_reports enable row level security;
drop policy if exists "study_card_reports_insert_own" on public.study_card_reports;
create policy "study_card_reports_insert_own" on public.study_card_reports for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "study_card_reports_delete_own" on public.study_card_reports;
create policy "study_card_reports_delete_own" on public.study_card_reports for delete to authenticated using (auth.uid() = reporter_id);
drop policy if exists "study_card_reports_select_own_or_admin" on public.study_card_reports;
create policy "study_card_reports_select_own_or_admin" on public.study_card_reports for select to authenticated using (
  auth.uid() = reporter_id or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

create table if not exists public.sandbox_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id)
);
alter table public.sandbox_follows enable row level security;
drop policy if exists "sandbox_follows_select" on public.sandbox_follows;
create policy "sandbox_follows_select" on public.sandbox_follows for select to authenticated using (true);
drop policy if exists "sandbox_follows_insert_own" on public.sandbox_follows;
create policy "sandbox_follows_insert_own" on public.sandbox_follows for insert to authenticated with check (auth.uid() = follower_id);
drop policy if exists "sandbox_follows_delete_own" on public.sandbox_follows;
create policy "sandbox_follows_delete_own" on public.sandbox_follows for delete to authenticated using (auth.uid() = follower_id);
