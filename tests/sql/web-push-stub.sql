-- Web Push testi için Supabase iskeleti (yalnız test). tests/web-push.js kullanır.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists auth; create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create or replace function public.admin_guard() returns void language plpgsql as $$ begin if current_setting('test.admin', true) is distinct from '1' then raise exception 'ADMIN'; end if; end $$;
create table public.profiles (id uuid primary key references auth.users(id), full_name text, current_streak int default 0, last_active_date date, notification_prefs jsonb);
create table public.sandbox_projects (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), title text);
create table public.sandbox_project_likes (id uuid primary key default gen_random_uuid(), project_id uuid references public.sandbox_projects(id), user_id uuid references auth.users(id), created_at timestamptz default now(), reaction text, unique(project_id,user_id));
create table public.sandbox_project_comments (id uuid primary key default gen_random_uuid(), project_id uuid references public.sandbox_projects(id), user_id uuid references auth.users(id), content text, created_at timestamptz default now(), label text, parent_id uuid);
create table public.card_item_confidence (id uuid primary key default gen_random_uuid(), user_id uuid, next_review_at timestamptz);
create table public.study_events (id uuid primary key default gen_random_uuid(), user_id uuid, title text, event_date date, event_type text, is_done boolean default false);
grant usage on schema public, auth to anon, authenticated, service_role;
