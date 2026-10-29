-- Supabase benzeri iskelet (yalnızca test): auth.uid() = request.jwt.claim.sub; anon/authenticated rolleri; varsayılan tablo yetkileri
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; create role authenticated nologin; end if; end $$;
do $$ begin if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$;
alter default privileges in schema public grant all on tables to anon, authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users (id uuid primary key, email text);
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to service_role;

create table public.profiles (id uuid primary key, full_name text, email text, department text default '', student_number text,
  is_admin boolean not null default false, is_suspended boolean not null default false,
  access_allowed boolean not null default true);
create table public.study_cards (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.exams (id uuid primary key default gen_random_uuid(), user_id uuid, grade numeric, completed_at timestamptz, created_at timestamptz default now());
create table public.documents (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.admin_audit_log (actor_id uuid, actor_name text, action text, target_user_id uuid, target_label text, details jsonb);
create table public.site_settings (key text primary key, value jsonb, updated_by uuid);
create table public.announcements (id uuid primary key default gen_random_uuid(), title text not null, body text, audience_department text, created_by uuid,
  active boolean not null default true, created_at timestamptz default now(), starts_at timestamptz, ends_at timestamptz, archived boolean not null default false);
create table public.exam_question_feedback (id uuid primary key default gen_random_uuid(), exam_id uuid, question_id int, user_id uuid, kind text, category text,
  reason text, status text not null default 'open', old_score numeric, new_score numeric, details jsonb, created_at timestamptz default now(), resolved_at timestamptz);
alter table public.profiles enable row level security;
create policy p_self on public.profiles for select to authenticated using (true);
alter table public.study_cards enable row level security;
create policy p_own on public.study_cards for select to authenticated using (user_id = auth.uid());
alter table public.exams enable row level security;
alter table public.documents enable row level security;
create policy p_own on public.documents for select to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on all tables in schema public to authenticated;

create function public.current_is_admin() returns boolean language sql stable security definer set search_path to 'public' as
  $$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;
create function public.admin_ok() returns boolean language sql stable security definer set search_path to 'public' as $$ select public.current_is_admin() $$;
create function public.admin_guard() returns void language plpgsql stable security definer set search_path to 'public' as
  $$ begin if not public.admin_ok() then raise exception 'Yönetici yetkisi gerekli' using errcode = '42501'; end if; end $$;
create function public.admin_log(p_action text, p_target uuid, p_label text, p_details jsonb default '{}') returns void language plpgsql security definer set search_path to 'public' as
  $$ begin insert into admin_audit_log values (auth.uid(), null, p_action, p_target, p_label, p_details); end $$;

insert into public.profiles (id, full_name, student_number, department, is_admin) values
 ('00000000-0000-0000-0000-00000000000a', 'Yönetici', 'A1', 'Banking and Finance', true),
 ('00000000-0000-0000-0000-00000000000c', 'Öğrenci Ce', '2023001', 'Banking and Finance', false),
 ('00000000-0000-0000-0000-00000000000d', 'Öğrenci De', 'oauth-xyz', 'Business Administration', false);
