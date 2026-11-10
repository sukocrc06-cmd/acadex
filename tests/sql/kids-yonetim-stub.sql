-- Acadex Kids yönetim testi için Supabase iskeleti (yalnız test). tests/admin-kids.js kullanır.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
create schema if not exists auth; create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table public.admin_audit_log (actor_id uuid, actor_name text, action text, target_user_id uuid, target_label text, details jsonb, created_at timestamptz default now());
create or replace function public.admin_guard() returns void language plpgsql as $$ begin if current_setting('test.admin', true) is distinct from '1' then raise exception 'Yönetici yetkisi gerekli' using errcode = '42501'; end if; end $$;
create or replace function public.admin_log(p_action text, p_target uuid, p_label text, p_details jsonb default '{}') returns void language plpgsql security definer set search_path to 'public' as
  $$ begin insert into admin_audit_log (actor_id, action, target_user_id, target_label, details) values (auth.uid(), p_action, p_target, p_label, p_details); end $$;
grant usage on schema public, auth to anon, authenticated;
-- Supabase gibi: yeni tablo ve fonksiyonlar varsayılan olarak anon ve authenticated rollerine açık
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
