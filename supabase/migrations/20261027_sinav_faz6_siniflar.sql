-- ==========================================================================
-- Acadex: Sınav Platformu — Faz 6.1: öğretmen yetkisi, sınıflar, katılım kodu
-- 27.10.2026 · Supabase → SQL Editor'de bir kez çalıştır; tekrar çalıştırmak
-- zarar vermez (if not exists / or replace / drop-then-create).
--
-- Hoca paneli 19.10.2026'da kaldırılmıştı (20261019_yonetim_paneli.sql).
-- Bu dosya öğretmeni DAR yetkiyle geri getirir:
--   * Öğretmen yalnızca kendi sınıflarını ve o sınıflardaki öğrencilerin
--     adını, numarasını, bölümünü görür. Belgeler, kartlar, sınavlar YOK
--     (ödev sonuçları 6.3-6.4'te, ustalık yalnızca öğrenci izin verirse).
--   * 2026-07 göçlerinden kalan geniş öğretmen politikaları kaldırılır:
--     canlıda hâlâ duruyorlardı (her öğretmen tüm öğrencilerin kartlarını,
--     aynı bölümün sınavlarını ve belgelerini okuyabiliyordu). Öğretmen
--     sayısı 0 olduğu için zararsızdı; yetki yeniden verilmeden kapanmalı.
--
-- Tablolar (yazma yalnızca aşağıdaki fonksiyonlarla; RLS yalnızca okuma):
--   classes        öğretmenin sınıfı + katılım kodu
--   class_members  sınıf üyeliği + share_mastery (öğrenci onayı, varsayılan kapalı)
--   class_join_fails  yanlış kod denemeleri (saatte 20 sınırı)
--
-- Fonksiyonlar (SECURITY DEFINER, search_path=public):
--   öğretmen: class_create, class_update, class_new_code, class_roster,
--             class_remove_member
--   öğrenci : class_join, class_leave, class_set_share
--   ikisi   : my_classes
--   yönetici: admin_set_teacher, admin_teacher_status
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 0. Eski geniş öğretmen politikaları
-- --------------------------------------------------------------------------
drop policy if exists "study_cards_teacher_select_dept" on public.study_cards;
drop policy if exists "exams_teacher_select_dept" on public.exams;
drop policy if exists "exams_teacher_update_dept" on public.exams;
drop policy if exists "documents_teacher_select_dept" on public.documents;
drop policy if exists "teacher_materials_teacher_manage_own" on public.teacher_materials;

-- etkin öğretmen: yetkili, askıda değil, erişimi açık
create or replace function public.current_is_active_teacher()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select is_teacher and not is_suspended and coalesce(access_allowed, true)
                   from public.profiles where id = auth.uid()), false);
$$;

-- --------------------------------------------------------------------------
-- 1. Tablolar
-- --------------------------------------------------------------------------
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 80),
  course_code text check (course_code is null or char_length(course_code) <= 20),
  join_code   text not null unique check (join_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  join_open   boolean not null default true,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists classes_teacher_idx on public.classes (teacher_id);

create table if not exists public.class_members (
  class_id      uuid not null references public.classes(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  joined_at     timestamptz not null default now(),
  share_mastery boolean not null default false,
  primary key (class_id, user_id)
);
create index if not exists class_members_user_idx on public.class_members (user_id);

create table if not exists public.class_join_fails (
  user_id uuid not null references public.profiles(id) on delete cascade,
  at      timestamptz not null default now()
);
create index if not exists class_join_fails_idx on public.class_join_fails (user_id, at);

alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_join_fails enable row level security;  -- politika yok: yalnızca fonksiyonlar
-- tablo yetkisi: okuma (RLS süzer); yazma hiçbir rolde yok, yalnızca fonksiyonlar
revoke all on public.classes, public.class_members, public.class_join_fails from anon, authenticated;
grant select on public.classes, public.class_members to authenticated;

-- yardımcı: kullanıcı bu sınıfın üyesi mi (politikalarda özyinelemeyi önler)
create or replace function public.is_class_member(p_class uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.class_members where class_id = p_class and user_id = auth.uid());
$$;
create or replace function public.is_class_teacher(p_class uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.current_is_active_teacher()
     and exists (select 1 from public.classes where id = p_class and teacher_id = auth.uid());
$$;

drop policy if exists "classes_select" on public.classes;
create policy "classes_select" on public.classes for select to authenticated
  using ((teacher_id = auth.uid() and public.current_is_active_teacher()) or public.is_class_member(id) or public.current_is_admin());

drop policy if exists "class_members_select" on public.class_members;
create policy "class_members_select" on public.class_members for select to authenticated
  using (user_id = auth.uid() or public.is_class_teacher(class_id) or public.current_is_admin());

-- --------------------------------------------------------------------------
-- 2. Katılım kodu: 6 karakter, karışan harfler yok (I, O, 0, 1)
-- --------------------------------------------------------------------------
create or replace function public.class_gen_code()
returns text language plpgsql volatile security definer set search_path to 'public' as $$
declare
  alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 karakter: bayt % 32 eşit dağılır
  b bytea; c text; i int; tries int := 0;
begin
  loop
    b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');  -- uuid v4: ilk 6 bayt rastgele
    c := '';
    for i in 0..5 loop c := c || substr(alpha, (get_byte(b, i) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from classes where join_code = c);
    tries := tries + 1;
    if tries > 20 then raise exception 'Kod üretilemedi; tekrar dene'; end if;
  end loop;
  return c;
end $$;

-- --------------------------------------------------------------------------
-- 3. Öğretmen fonksiyonları
-- --------------------------------------------------------------------------
create or replace function public.class_create(p_name text, p_course_code text default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare nm text := btrim(coalesce(p_name, '')); cc text := nullif(upper(btrim(coalesce(p_course_code, ''))), ''); r classes;
begin
  if not public.current_is_active_teacher() then raise exception 'Öğretmen yetkisi gerekli' using errcode = '42501'; end if;
  if char_length(nm) < 2 or char_length(nm) > 80 then raise exception 'Sınıf adı 2-80 karakter olmalı'; end if;
  if cc is not null and char_length(cc) > 20 then raise exception 'Ders kodu çok uzun'; end if;
  if (select count(*) from classes where teacher_id = auth.uid() and not archived) >= 30 then
    raise exception 'En çok 30 açık sınıf olabilir; eskileri arşivle';
  end if;
  insert into classes (teacher_id, name, course_code, join_code)
  values (auth.uid(), nm, cc, public.class_gen_code()) returning * into r;
  return row_to_json(r);
end $$;

create or replace function public.class_update(p_class uuid, p_name text default null, p_course_code text default null,
                                               p_join_open boolean default null, p_archived boolean default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare r classes; nm text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if not public.is_class_teacher(p_class) then raise exception 'Bu sınıf senin değil' using errcode = '42501'; end if;
  if nm is not null and (char_length(nm) < 2 or char_length(nm) > 80) then raise exception 'Sınıf adı 2-80 karakter olmalı'; end if;
  if p_archived = false and (select count(*) from classes where teacher_id = auth.uid() and not archived) >= 30 then
    raise exception 'En çok 30 açık sınıf olabilir';
  end if;
  update classes set
    name        = coalesce(nm, name),
    course_code = case when p_course_code is null then course_code else nullif(upper(btrim(p_course_code)), '') end,
    join_open   = case when p_archived then false else coalesce(p_join_open, join_open) end,
    archived    = coalesce(p_archived, archived)
  where id = p_class returning * into r;
  return row_to_json(r);
end $$;

create or replace function public.class_new_code(p_class uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare c text;
begin
  if not public.is_class_teacher(p_class) then raise exception 'Bu sınıf senin değil' using errcode = '42501'; end if;
  c := public.class_gen_code();
  update classes set join_code = c where id = p_class;
  return c;
end $$;

-- sınıf listesi: yalnızca ad, numara, bölüm (e-posta yok)
create or replace function public.class_roster(p_class uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'Bu sınıf senin değil' using errcode = '42501'; end if;
  return coalesce((select json_agg(json_build_object(
      'user_id', m.user_id,
      'full_name', coalesce(nullif(p.full_name, ''), 'İsimsiz öğrenci'),
      'student_number', case when p.student_number like 'oauth-%' then null else p.student_number end,
      'department', p.department,
      'joined_at', m.joined_at,
      'share_mastery', m.share_mastery) order by p.full_name)
    from class_members m join profiles p on p.id = m.user_id where m.class_id = p_class), '[]'::json);
end $$;

create or replace function public.class_remove_member(p_class uuid, p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_class_teacher(p_class) then raise exception 'Bu sınıf senin değil' using errcode = '42501'; end if;
  delete from class_members where class_id = p_class and user_id = p_user;
end $$;

-- --------------------------------------------------------------------------
-- 4. Öğrenci fonksiyonları
-- --------------------------------------------------------------------------
create or replace function public.class_join(p_code text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  k classes; me profiles; tname text;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.is_suspended or not coalesce(me.access_allowed, true) then
    raise exception 'Hesabın sınıfa katılamıyor' using errcode = '42501';
  end if;
  if (select count(*) from class_join_fails where user_id = auth.uid() and at > now() - interval '1 hour') >= 20 then
    raise exception 'Çok fazla yanlış kod denendi; bir saat sonra tekrar dene';
  end if;
  select * into k from classes where join_code = c;
  if k.id is null or k.archived or not k.join_open
     or not exists (select 1 from profiles t where t.id = k.teacher_id and t.is_teacher and not t.is_suspended) then
    -- hata fırlatılırsa deneme kaydı da geri alınır; bu yüzden hata döndürülür
    insert into class_join_fails (user_id) values (auth.uid());
    delete from class_join_fails where at < now() - interval '1 day';
    return json_build_object('error', 'Kod bulunamadı ya da sınıf yeni öğrenci almıyor');
  end if;
  if k.teacher_id = auth.uid() then raise exception 'Kendi sınıfına öğrenci olarak katılamazsın'; end if;
  if (select count(*) from class_members where class_id = k.id) >= 500 then raise exception 'Sınıf dolu'; end if;
  insert into class_members (class_id, user_id) values (k.id, auth.uid()) on conflict do nothing;
  select coalesce(nullif(full_name, ''), 'Öğretmen') into tname from profiles where id = k.teacher_id;
  return json_build_object('id', k.id, 'name', k.name, 'course_code', k.course_code, 'teacher_name', tname);
end $$;

create or replace function public.class_leave(p_class uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  delete from class_members where class_id = p_class and user_id = auth.uid();
end $$;

create or replace function public.class_set_share(p_class uuid, p_value boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update class_members set share_mastery = coalesce(p_value, false) where class_id = p_class and user_id = auth.uid();
  if not found then raise exception 'Bu sınıfın üyesi değilsin'; end if;
end $$;

-- öğretmen olarak verdiklerim + öğrenci olarak katıldıklarım
create or replace function public.my_classes()
returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  return json_build_object(
    'is_teacher', public.current_is_active_teacher(),
    'teaching', case when public.current_is_active_teacher() then coalesce((select json_agg(json_build_object(
        'id', k.id, 'name', k.name, 'course_code', k.course_code, 'join_code', k.join_code,
        'join_open', k.join_open, 'archived', k.archived, 'created_at', k.created_at,
        'members', (select count(*) from class_members m where m.class_id = k.id),
        'sharing', (select count(*) from class_members m where m.class_id = k.id and m.share_mastery))
        order by k.archived, k.created_at desc)
      from classes k where k.teacher_id = auth.uid()), '[]'::json) else '[]'::json end,
    'enrolled', coalesce((select json_agg(json_build_object(
        'id', k.id, 'name', k.name, 'course_code', k.course_code, 'archived', k.archived,
        'teacher_name', coalesce(nullif(t.full_name, ''), 'Öğretmen'),
        'joined_at', m.joined_at, 'share_mastery', m.share_mastery)
        order by k.archived, m.joined_at desc)
      from class_members m join classes k on k.id = m.class_id join profiles t on t.id = k.teacher_id
      where m.user_id = auth.uid()), '[]'::json));
end $$;

-- --------------------------------------------------------------------------
-- 5. Yönetici: öğretmen yetkisi
-- --------------------------------------------------------------------------
create or replace function public.admin_set_teacher(p_id uuid, p_value boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare nm text;
begin
  perform public.admin_guard();
  update profiles set is_teacher = p_value where id = p_id returning full_name into nm;
  if not found then raise exception 'Kullanıcı bulunamadı'; end if;
  -- yetki kalkınca sınıflar yeni öğrenci almaz (veriler durur; yetki geri gelince açılabilir)
  if not p_value then update classes set join_open = false where teacher_id = p_id; end if;
  perform public.admin_log('set_is_teacher', p_id, nm, json_build_object('value', p_value)::jsonb);
end $$;

create or replace function public.admin_teacher_status(p_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.admin_guard();
  return json_build_object(
    'is_teacher', (select is_teacher from profiles where id = p_id),
    'classes', (select count(*) from classes where teacher_id = p_id and not archived),
    'students', (select count(distinct m.user_id) from class_members m join classes k on k.id = m.class_id where k.teacher_id = p_id),
    'enrolled', (select count(*) from class_members where user_id = p_id));
end $$;

-- --------------------------------------------------------------------------
-- 6. Yetkiler: fonksiyonlar yalnızca giriş yapmış kullanıcıya
-- --------------------------------------------------------------------------
revoke all on function public.class_gen_code() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'class_create(text,text)', 'class_update(uuid,text,text,boolean,boolean)', 'class_new_code(uuid)',
    'class_roster(uuid)', 'class_remove_member(uuid,uuid)', 'class_join(text)', 'class_leave(uuid)',
    'class_set_share(uuid,boolean)', 'my_classes()', 'admin_set_teacher(uuid,boolean)',
    'admin_teacher_status(uuid)', 'is_class_member(uuid)', 'is_class_teacher(uuid)', 'current_is_active_teacher()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
