-- ==========================================================================
-- Acadex: yeni Geliştirici sandbox + Sandbox etkileşim paneli tasarımı.
--
-- Bu dosya Supabase SQL Editor'da bir kez çalıştırılmalı. Yalnızca EKLER
-- (yeni tablolar, yeni sütunlar); mevcut hiçbir veriyi silmez, tekrar
-- çalıştırmak güvenlidir.
--
-- Çalıştırılmazsa da sayfalar çalışır: projeler o tarayıcıda saklanır,
-- tepkiler tek tür beğeni olarak, yorumlar etiketsiz ve yanıtsız kaydedilir,
-- takip ve bildirimler tarayıcıda tutulur.
--
--   sandbox_workspaces      — öğrencinin kod projeleri (dosyalar + duraklar)
--   sandbox_projects        — + kind, tech, course, snapshot, workspace_id,
--                               versions_count (panele gönderilen projenin
--                               çalışan önizlemesi ve etiketleri)
--   sandbox_project_likes   — + reaction (temiz / ilham / merge / sorun)
--   sandbox_project_comments— + label, parent_id (inceleme türü ve yanıtlar)
--   sandbox_follows         — kim kimi takip ediyor
--   sandbox_reports         — panel gönderisi bildirimleri (admin görür)
-- ==========================================================================

create table if not exists public.sandbox_workspaces (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Adsız proje',
  status text not null default 'taslak',
  course text,
  due date,
  files jsonb not null default '{}'::jsonb,
  versions jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sandbox_workspaces_user_idx on public.sandbox_workspaces(user_id, updated_at desc);
alter table public.sandbox_workspaces enable row level security;
drop policy if exists "sandbox_workspaces_own" on public.sandbox_workspaces;
create policy "sandbox_workspaces_own" on public.sandbox_workspaces
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.sandbox_projects add column if not exists kind text;
alter table public.sandbox_projects add column if not exists tech text[] not null default '{}';
alter table public.sandbox_projects add column if not exists course text;
alter table public.sandbox_projects add column if not exists snapshot text;
alter table public.sandbox_projects add column if not exists workspace_id text;
alter table public.sandbox_projects add column if not exists versions_count integer not null default 0;

alter table public.sandbox_project_likes add column if not exists reaction text not null default 'ilham';

alter table public.sandbox_project_comments add column if not exists label text not null default 'genel';
alter table public.sandbox_project_comments add column if not exists parent_id uuid references public.sandbox_project_comments(id) on delete cascade;

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

create table if not exists public.sandbox_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.sandbox_projects(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (project_id, reporter_id)
);
alter table public.sandbox_reports enable row level security;
drop policy if exists "sandbox_reports_insert_own" on public.sandbox_reports;
create policy "sandbox_reports_insert_own" on public.sandbox_reports for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "sandbox_reports_select_own_or_admin" on public.sandbox_reports;
create policy "sandbox_reports_select_own_or_admin" on public.sandbox_reports for select to authenticated using (
  auth.uid() = reporter_id or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
