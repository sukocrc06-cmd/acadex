-- Kapalı beta: kayıt dondurma + yalnızca izinli hesaplar (24.10.2026)
-- 1) profiles.access_allowed  2) access_invites  3) registration_freeze ayarı
-- 4) auth.users'a yeni kayıt kapısı  5) yönetici RPC'leri

alter table public.profiles add column if not exists access_allowed boolean not null default false;
update public.profiles set access_allowed = true where access_allowed = false;  -- mevcut hesaplar izinli başlar

create table if not exists public.access_invites (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
alter table public.access_invites enable row level security;  -- politika yok: yalnızca security definer fonksiyonlar erişir

insert into public.site_settings (key, value, updated_at)
values ('registration_freeze', '{"enabled": true, "message": "Acadex şu an geliştirme aşamasında. Yeni kayıtlar kısa bir süreliğine kapalı; yalnızca davet edilen hesaplar girebilir."}'::jsonb, now())
on conflict (key) do nothing;

create or replace function public.registration_frozen()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select (value->>'enabled')::boolean from site_settings where key = 'registration_freeze'), false);
$$;

-- yeni auth kullanıcısı (e-posta ya da Google): donukken yalnızca davetli e-postalar
create or replace function public.gate_new_auth_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if public.registration_frozen()
     and not exists (select 1 from access_invites where email = lower(coalesce(new.email, ''))) then
    raise exception 'ACADEX_KAYIT_KAPALI' using errcode = '42501',
      hint = 'Acadex şu an geliştirme aşamasında; yeni kayıtlar kapalı.';
  end if;
  return new;
end $$;
drop trigger if exists gate_new_auth_user on auth.users;
create trigger gate_new_auth_user before insert on auth.users
  for each row execute function public.gate_new_auth_user();

-- yeni profilin erişimi: davetliyse ya da donuk değilse izinli (protect_profile_flags'ten sonra çalışsın diye zz_)
create or replace function public.profiles_access_default()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  new.access_allowed := (not public.registration_frozen())
    or exists (select 1 from access_invites where email = lower(coalesce(new.email, '')));
  return new;
end $$;
drop trigger if exists zz_profiles_access_default on public.profiles;
create trigger zz_profiles_access_default before insert on public.profiles
  for each row execute function public.profiles_access_default();

-- kullanıcı kendi erişimini açamasın
create or replace function public.protect_profile_flags()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if coalesce(auth.role(), '') <> 'authenticated' or public.current_is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_admin := false; new.is_teacher := false; new.is_suspended := false; new.campuso_user_id := null;
    return new;
  end if;
  if new.id is distinct from old.id
     or new.is_admin is distinct from old.is_admin
     or new.is_teacher is distinct from old.is_teacher
     or new.is_suspended is distinct from old.is_suspended
     or new.access_allowed is distinct from old.access_allowed
     or new.campuso_user_id is distinct from old.campuso_user_id then
    raise exception 'Bu alanlar yalnızca yönetici tarafından değiştirilebilir' using errcode = '42501';
  end if;
  return new;
end;
$function$;

-- ===== yönetici RPC'leri =====
create or replace function public.admin_set_access(p_id uuid, p_value boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare nm text;
begin
  perform public.admin_guard();
  if not p_value and p_id = auth.uid() then raise exception 'Kendi erişimini kapatamazsın'; end if;
  if not p_value and exists (select 1 from profiles where id = p_id and is_admin) then raise exception 'Yönetici hesabının erişimi kapatılamaz'; end if;
  update profiles set access_allowed = p_value where id = p_id returning full_name into nm;
  if not found then raise exception 'Kullanıcı bulunamadı'; end if;
  perform public.admin_log(case when p_value then 'access_grant' else 'access_revoke' end, p_id, nm, '{}'::jsonb);
end $$;

create or replace function public.admin_invites()
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare r json;
begin
  perform public.admin_guard();
  select coalesce(json_agg(json_build_object('email', i.email, 'note', i.note, 'created_at', i.created_at,
    'joined', exists (select 1 from profiles p where lower(p.email) = i.email)) order by i.created_at desc), '[]'::json)
  into r from access_invites i;
  return r;
end $$;

create or replace function public.admin_invite_add(p_email text, p_note text default '')
returns void language plpgsql security definer set search_path to 'public' as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  perform public.admin_guard();
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Geçerli bir e-posta yaz'; end if;
  insert into access_invites (email, note, created_by) values (e, left(coalesce(p_note, ''), 120), auth.uid())
  on conflict (email) do update set note = excluded.note;
  update profiles set access_allowed = true where lower(email) = e;  -- hesabı zaten varsa hemen aç
  perform public.admin_log('invite_add', null, e, json_build_object('note', p_note)::jsonb);
end $$;

create or replace function public.admin_invite_remove(p_email text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  perform public.admin_guard();
  delete from access_invites where email = e;
  perform public.admin_log('invite_remove', null, e, '{}'::jsonb);
end $$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb)
 returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public.admin_guard();
  if p_key not in ('maintenance_mode', 'site_banner', 'registration_domains', 'features', 'registration_freeze') then raise exception 'Bilinmeyen ayar: %', p_key; end if;
  insert into site_settings (key, value, updated_at, updated_by) values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform public.admin_log('setting_change', null, p_key, json_build_object('value', p_value)::jsonb);
end $function$;

-- kullanıcı listesi ve detay: access_allowed eklendi, 'noaccess' filtresi
create or replace function public.admin_users(p_q text default ''::text, p_dept text default ''::text, p_provider text default ''::text, p_status text default ''::text, p_limit integer default 50, p_offset integer default 0)
 returns json language plpgsql stable security definer set search_path to 'public' as $function$
declare r json;
begin
  perform public.admin_guard();
  with base as (
    select p.id, p.full_name, p.email, p.department, p.student_number, p.created_at, p.last_active_date, p.current_streak,
      p.is_suspended, p.is_admin, p.avatar_url, p.access_allowed,
      coalesce(u.raw_app_meta_data->>'provider', 'email') provider, u.last_sign_in_at,
      (select count(*) from documents d where d.user_id = p.id) docs,
      (select count(*) from study_cards c where c.user_id = p.id) cards,
      coalesce((select plan from user_plans up where up.user_id = p.id), 'lite') plan
    from profiles p left join auth.users u on u.id = p.id
    where (p_q = '' or p.full_name ilike '%' || p_q || '%' or p.email ilike '%' || p_q || '%' or p.student_number ilike '%' || p_q || '%')
      and (p_dept = '' or p.department = p_dept or (p_dept = '-' and p.department = ''))
      and (p_provider = '' or coalesce(u.raw_app_meta_data->>'provider', 'email') = p_provider)
      and (p_status = '' or (p_status = 'suspended' and p.is_suspended) or (p_status = 'admin' and p.is_admin)
           or (p_status = 'noaccess' and not p.access_allowed and not p.is_admin)
           or (p_status = 'incomplete' and (p.department = '' or p.student_number like 'oauth-%')) or (p_status = 'active' and not p.is_suspended))
  )
  select json_build_object('total', (select count(*) from base),
    'rows', coalesce((select json_agg(b order by b.created_at desc) from (select * from base order by created_at desc limit least(p_limit, 200) offset p_offset) b), '[]'::json))
  into r;
  return r;
end $function$;

create or replace function public.admin_user_detail(p_id uuid)
 returns json language plpgsql stable security definer set search_path to 'public' as $function$
declare r json;
begin
  perform public.admin_guard();
  select json_build_object(
    'profile', (select row_to_json(p) from (select id, full_name, email, department, student_number, created_at, last_active_date, current_streak, is_suspended, is_admin, access_allowed, avatar_url, bio, github_url, linkedin_url, website_url from profiles where id = p_id) p),
    'auth', (select json_build_object('provider', coalesce(raw_app_meta_data->>'provider', 'email'), 'last_sign_in_at', last_sign_in_at, 'confirmed', email_confirmed_at is not null) from auth.users where id = p_id),
    'plan', (select row_to_json(x) from (select plan, valid_until from user_plans where user_id = p_id) x),
    'usage', (select json_agg(row_to_json(x) order by x.period desc) from (select period, pages_used, docs_used, cache_hits from summary_usage where user_id = p_id order by period desc limit 6) x),
    'docs', (select json_agg(row_to_json(x)) from (select id, file_name, status, uploaded_at, file_size from documents where user_id = p_id order by uploaded_at desc limit 8) x),
    'counts', json_build_object('docs', (select count(*) from documents where user_id = p_id), 'cards', (select count(*) from study_cards where user_id = p_id),
      'shared', (select count(*) from study_cards where user_id = p_id and is_shared), 'projects', (select count(*) from sandbox_projects where user_id = p_id),
      'reports_against', (select count(*) from sandbox_reports r join sandbox_projects s on s.id = r.project_id where s.user_id = p_id) + (select count(*) from study_card_reports r join study_cards c on c.id = r.card_id where c.user_id = p_id)),
    'log', (select json_agg(row_to_json(x)) from (select action, actor_name, details, created_at from admin_audit_log where target_user_id = p_id order by created_at desc limit 10) x)
  ) into r;
  return r;
end $function$;

revoke all on function public.admin_set_access(uuid, boolean), public.admin_invites(), public.admin_invite_add(text, text), public.admin_invite_remove(text) from public, anon;
grant execute on function public.admin_set_access(uuid, boolean), public.admin_invites(), public.admin_invite_add(text, text), public.admin_invite_remove(text) to authenticated;
revoke all on function public.gate_new_auth_user(), public.profiles_access_default() from public, anon, authenticated;
