-- Supabase benzeri iskelet (yalnızca test): auth.uid() = request.jwt.claim.sub; anon/authenticated rolleri; varsayılan tablo yetkileri
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; create role authenticated nologin; end if; end $$;
alter default privileges in schema public grant all on tables to anon, authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;

create table public.profiles (id uuid primary key, full_name text, email text, department text default '', student_number text,
  is_admin boolean not null default false, is_teacher boolean not null default false, is_suspended boolean not null default false,
  access_allowed boolean not null default true);
create table public.study_cards (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.exams (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.documents (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.teacher_materials (id uuid primary key default gen_random_uuid(), teacher_id uuid, department text);
create table public.admin_audit_log (actor_id uuid, actor_name text, action text, target_user_id uuid, target_label text, details jsonb);
alter table public.profiles enable row level security;
create policy p_self on public.profiles for select to authenticated using (true);
alter table public.study_cards enable row level security;
create policy "study_cards_teacher_select_dept" on public.study_cards for select to authenticated using (true);
alter table public.exams enable row level security;
create policy "exams_teacher_select_dept" on public.exams for select to authenticated using (true);
create policy "exams_teacher_update_dept" on public.exams for update to authenticated using (true);
alter table public.documents enable row level security;
create policy "documents_teacher_select_dept" on public.documents for select to authenticated using (true);
alter table public.teacher_materials enable row level security;
create policy "teacher_materials_teacher_manage_own" on public.teacher_materials for all to authenticated using (true);
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
 ('00000000-0000-0000-0000-00000000000b', 'Hoca Bir', 'T1', 'Banking and Finance', false),
 ('00000000-0000-0000-0000-00000000000c', 'Öğrenci Ce', '2023001', 'Banking and Finance', false),
 ('00000000-0000-0000-0000-00000000000d', 'Öğrenci De', 'oauth-xyz', 'Business Administration', false),
 ('00000000-0000-0000-0000-00000000000e', 'Hoca İki', 'T2', '', false);
