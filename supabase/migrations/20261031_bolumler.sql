-- ==========================================================================
-- ACADEX · Tüm fakülteler için bölüm listesi (31.10.2026)
--
-- Neden: profiles.department yalnızca 4 İİBF bölümüne izin veriyordu; tıp,
-- sağlık ve mühendislik öğrencileri kayıt olamıyordu (handle_new_user bölümü
-- boşaltıyor, Ayarlar'dan seçince CHECK kısıtı reddediyordu).
--
-- Liste js/acadex-bolumler.js ile AYNI olmalı (tests/bolumler.js denetler).
-- Supabase SQL Editor'da bir kez çalıştır. Var olan kayıtlar değişmez.
-- ==========================================================================

create or replace function public.acadex_departments()
returns text[]
language sql
immutable
as $$
  select array[
    -- İktisadi ve İdari Bilimler
    'Management Information Systems', 'Business Administration', 'International Trade and Business', 'Banking and Finance',
    'Economics', 'Public Finance', 'Accounting and Financial Management', 'Political Science and Public Administration', 'Health Management',
    -- Tıp ve Sağlık Bilimleri
    'Medicine', 'Dentistry', 'Pharmacy', 'Nursing', 'Midwifery', 'Nutrition and Dietetics',
    'Physiotherapy and Rehabilitation', 'Audiology', 'Speech and Language Therapy',
    -- Mühendislik
    'Computer Engineering', 'Software Engineering', 'Industrial Engineering',
    'Electrical and Electronics Engineering', 'Mechanical Engineering', 'Civil Engineering',
    -- Diğer
    'Other'
  ]::text[]
$$;

alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles add constraint profiles_department_check
  check (department = '' or department = any (public.acadex_departments()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare dep text := coalesce(new.raw_user_meta_data->>'department', '');
begin
  if not (dep = any (public.acadex_departments())) then dep := ''; end if;
  insert into public.profiles (id, student_number, email, department, full_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'student_number'), ''), 'oauth-' || new.id::text),
    coalesce(new.email, ''),
    dep,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), '')),
    coalesce(nullif(new.raw_user_meta_data->>'avatar_url', ''), nullif(new.raw_user_meta_data->>'picture', ''))
  );
  return new;
end;
$function$;
