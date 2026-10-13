-- ==========================================================================
-- Acadex Study Lab (çalışma yöntemleri laboratuvarı)
--
-- Supabase SQL Editor'da bir kez çalıştır. Yalnızca yeni tablo ekler; mevcut
-- veriye dokunmaz, tekrar çalıştırmak güvenlidir.
--
-- Çalıştırılmazsa da Study Lab çalışır: deney defteri, zihin haritaları,
-- Cornell sayfaları ve Feynman sürümleri o tarayıcıda tutulur.
-- (Aralıklı tekrar / Active Recall / Interleaving cevapları zaten mevcut
-- card_item_confidence tablosuna, Bilgi kartları ile aynı şekilde yazılır.)
--
--   study_lab_sessions — hangi yöntemle kaç dakika çalışıldı (deney defteri)
--   study_lab_items    — zihin haritası, Cornell sayfası, Feynman sürümleri
-- ==========================================================================

create table if not exists public.study_lab_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  method text not null check (method in ('pomodoro', 'tekrar', 'recall', 'feynman', 'karma', 'harita', 'cornell', 'loci', 'blurt', 'sq3r', 'neden')),
  minutes integer not null check (minutes between 1 and 240),
  card_id uuid references public.study_cards(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists study_lab_sessions_user_idx on public.study_lab_sessions(user_id, created_at desc);
alter table public.study_lab_sessions enable row level security;
drop policy if exists "study_lab_sessions_own" on public.study_lab_sessions;
create policy "study_lab_sessions_own" on public.study_lab_sessions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.study_lab_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('harita', 'cornell', 'feynman', 'loci', 'blurt', 'sq3r', 'neden')),
  ref text not null,
  title text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
alter table public.study_lab_items enable row level security;
drop policy if exists "study_lab_items_own" on public.study_lab_items;
create policy "study_lab_items_own" on public.study_lab_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
