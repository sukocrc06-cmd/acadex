-- ==========================================================================
-- Acadex: öğretmen / sınıf / ödev sisteminin tamamen kaldırılması
-- 29.10.2026 · Supabase SQL Editor'de TEK SEFERDE çalıştır (tek işlem; bir
-- adım düşerse hiçbir şey değişmez). Tekrar çalıştırmak zarar vermez.
--
-- Platformda insan öğretmen yok: "hocaya sor" yalnızca Acadex'in kendi
-- sistemidir. Bu dosya öğretmen yetkisini, sınıfları, ödevleri, gizli ödev
-- sonuçlarını, öğretmen materyallerini, öğretmen notu/inceleme alanlarını,
-- Campuso bağlantısını ve "öğretmene ilet" itiraz durumunu siler.
--
-- Önce kod: bu SQL'den ÖNCE generate-exam / grade-exam / exam-appeal'in
-- ödevsiz sürümü yayında olmalı (GitHub Actions, main'e birleşince).
--
-- Kalanlar: sınav satırı koruması (20261028d, burada sütunsuz hali yeniden
-- kurulur), profil bayrak koruması, hesap silme, duyuru kaydetme — hepsi
-- silinen sütunlara dokunmayacak biçimde yeniden tanımlanır.
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. Kalan fonksiyonlar: silinecek sütunlara başvurmayan sürümler
-- --------------------------------------------------------------------------
create or replace function public.exams_guard_grading_fields()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  -- service_role (edge function'lar) ve SQL Editor (jwt yok) serbest.
  if jwt_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.grade is not null or new.completed_at is not null or new.question_results is not null
       or new.scoring is not null then
      raise exception 'Sinav sonuclari yalnizca sunucu tarafindan yazilabilir.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.grade is distinct from old.grade
     or new.answers is distinct from old.answers
     or new.question_results is distinct from old.question_results
     or new.completed_at is distinct from old.completed_at
     or new.questions is distinct from old.questions
     or new.started_at is distinct from old.started_at
     or new.hints_used is distinct from old.hints_used
     or new.scoring is distinct from old.scoring
     or new.user_id is distinct from old.user_id
     or new.is_simulation is distinct from old.is_simulation
     or new.time_limit_seconds is distinct from old.time_limit_seconds then
    raise exception 'Sinav puanlama alanlari yalnizca sunucu tarafindan degistirilebilir.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.protect_profile_flags()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' or public.current_is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_admin := false; new.is_suspended := false;
    return new;
  end if;
  if new.id is distinct from old.id
     or new.is_admin is distinct from old.is_admin
     or new.is_suspended is distinct from old.is_suspended
     or new.access_allowed is distinct from old.access_allowed then
    raise exception 'Bu alanlar yalnızca yönetici tarafından değiştirilebilir' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.admin_delete_user(p_id uuid, p_confirm_email text)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'storage'
as $$
declare em text; nm text; t record; n_docs int; n_cards int;
begin
  perform public.admin_guard();
  if p_id = auth.uid() then raise exception 'Kendi hesabını panelden silemezsin'; end if;
  select email, full_name into em, nm from public.profiles where id = p_id;
  if em is null then select email into em from auth.users where id = p_id; end if;
  if em is null then raise exception 'Kullanıcı bulunamadı'; end if;
  if exists (select 1 from public.profiles where id = p_id and is_admin) then raise exception 'Yönetici hesapları silinemez'; end if;
  if lower(trim(coalesce(p_confirm_email, ''))) <> lower(em) then raise exception 'Onay için yazılan e-posta hesabınkiyle aynı değil'; end if;
  select count(*) into n_docs from public.documents where user_id = p_id;
  select count(*) into n_cards from public.study_cards where user_id = p_id;
  perform public.admin_log('user_delete', p_id, coalesce(nm, em), json_build_object('email', em, 'docs', n_docs, 'cards', n_cards)::jsonb);
  update public.site_settings set updated_by = null where updated_by = p_id;
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'user_id' and tb.table_type = 'BASE TABLE'
  loop
    begin
      execute format('delete from public.%I where user_id = $1', t.table_name) using p_id;
    exception when others then null;
    end;
  end loop;
  begin
    delete from storage.objects where owner = p_id;
  exception when others then null;
  end;
  delete from public.profiles where id = p_id;
  delete from auth.users where id = p_id;
end $$;

create or replace function public.admin_announce_save(p_id uuid, p_title text, p_body text, p_dept text, p_active boolean, p_starts timestamptz, p_ends timestamptz)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare nid uuid;
begin
  perform public.admin_guard();
  if coalesce(trim(p_title), '') = '' then raise exception 'Başlık boş olamaz'; end if;
  if p_id is null then
    insert into announcements (title, body, audience_department, created_by, active, starts_at, ends_at)
    values (p_title, p_body, nullif(p_dept, ''), auth.uid(), p_active, p_starts, p_ends) returning id into nid;
  else
    update announcements set title = p_title, body = p_body, audience_department = nullif(p_dept, ''), active = p_active, starts_at = p_starts, ends_at = p_ends where id = p_id returning id into nid;
  end if;
  perform public.admin_log(case when p_id is null then 'announcement_create' else 'announcement_update' end, null, p_title, json_build_object('id', nid, 'active', p_active, 'department', p_dept)::jsonb);
  return nid;
end $$;

-- --------------------------------------------------------------------------
-- 2. Ödevden açılmış sınav kayıtları (ve onlara bağlı satırlar)
-- --------------------------------------------------------------------------
do $$
declare ids uuid[];
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'exams' and column_name = 'assignment_id') then
    execute 'select coalesce(array_agg(id), ''{}'') from public.exams where assignment_id is not null' into ids;
    if cardinality(ids) > 0 then
      if to_regclass('public.exam_answer_keys') is not null then delete from public.exam_answer_keys where exam_id = any(ids); end if;
      if to_regclass('public.question_attempts') is not null then delete from public.question_attempts where exam_id = any(ids); end if;
      if to_regclass('public.exam_drafts') is not null then delete from public.exam_drafts where exam_id = any(ids); end if;
      if to_regclass('public.exam_question_feedback') is not null then delete from public.exam_question_feedback where exam_id = any(ids); end if;
      if to_regclass('public.exam_hidden_results') is not null then delete from public.exam_hidden_results where exam_id = any(ids); end if;
      delete from public.exams where id = any(ids);
    end if;
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 3. Kalan tablolardaki öğretmen politikaları
-- --------------------------------------------------------------------------
drop policy if exists "announcements_teacher_manage_own_dept" on public.announcements;
drop policy if exists "profiles_teacher_select_dept_students" on public.profiles;
drop policy if exists "exams_teacher_select_dept" on public.exams;
drop policy if exists "exams_teacher_update_dept" on public.exams;
drop policy if exists "documents_teacher_select_dept" on public.documents;
drop policy if exists "study_cards_teacher_select_dept" on public.study_cards;

-- --------------------------------------------------------------------------
-- 4. Sınıf / ödev / materyal tabloları (politikaları ve indeksleriyle)
-- --------------------------------------------------------------------------
drop table if exists public.exam_hidden_results cascade;
drop table if exists public.assignment_gen_log cascade;
drop table if exists public.assignments cascade;
drop table if exists public.class_join_fails cascade;
drop table if exists public.class_members cascade;
drop table if exists public.classes cascade;
drop table if exists public.teacher_materials cascade;

-- --------------------------------------------------------------------------
-- 5. Fonksiyonlar
-- --------------------------------------------------------------------------
drop function if exists public.admin_set_teacher(uuid, boolean);
drop function if exists public.admin_teacher_status(uuid);
drop function if exists public.assignment_begin(uuid, uuid);
drop function if exists public.assignment_check_answers(jsonb);
drop function if exists public.assignment_check_questions(jsonb);
drop function if exists public.assignment_clean_settings(jsonb);
drop function if exists public.assignment_close(uuid);
drop function if exists public.assignment_create(uuid, text);
drop function if exists public.assignment_delete(uuid);
drop function if exists public.assignment_gen_take();
drop function if exists public.assignment_publish(uuid);
drop function if exists public.assignment_results(uuid);
drop function if exists public.assignment_save(uuid, text, text, jsonb, jsonb, jsonb, timestamptz, timestamptz);
drop function if exists public.assignment_set_dates(uuid, timestamptz, timestamptz);
drop function if exists public.class_create(text, text);
drop function if exists public.class_gen_code();
drop function if exists public.class_join(text);
drop function if exists public.class_leave(uuid);
drop function if exists public.class_mastery_data(uuid);
drop function if exists public.class_new_code(uuid);
drop function if exists public.class_remove_member(uuid, uuid);
drop function if exists public.class_roster(uuid);
drop function if exists public.class_set_share(uuid, boolean);
drop function if exists public.class_update(uuid, text, text, boolean, boolean);
drop function if exists public.current_is_active_teacher();
drop function if exists public.current_is_teacher();
drop function if exists public.exam_hidden_revealed(uuid);
drop function if exists public.exam_teacher_ok(uuid);
drop function if exists public.get_teacher_report();
drop function if exists public.is_class_member(uuid);
drop function if exists public.is_class_teacher(uuid);
drop function if exists public.my_assignments();
drop function if exists public.my_classes();

-- --------------------------------------------------------------------------
-- 6. Sütunlar
-- --------------------------------------------------------------------------
alter table public.exams
  drop column if exists assignment_id,
  drop column if exists attempt_no,
  drop column if exists teacher_note,
  drop column if exists teacher_reviewed,
  drop column if exists teacher_reviewed_by,
  drop column if exists teacher_reviewed_at;

alter table public.profiles
  drop column if exists is_teacher,
  drop column if exists campuso_user_id,
  drop column if exists teacher_request_pending,
  drop column if exists teacher_title;

-- Duyuruları yalnızca yönetim yazar; öğretmenin yazdığı duyuru silinir.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'announcements' and column_name = 'created_by_role') then
    delete from public.announcements where created_by_role <> 'admin';
    alter table public.announcements drop column created_by_role;
  end if;
end $$;

-- İtiraz artık öğretmene iletilmez: durumlar open / accepted / rejected.
update public.exam_question_feedback set status = 'rejected' where status in ('escalated', 'resolved');
update public.exam_question_feedback set details = details - 'escalated_at' - 'escalation_note' - 'teacher'
  where details ?| array['escalated_at', 'escalation_note', 'teacher'];
alter table public.exam_question_feedback drop constraint if exists exam_question_feedback_status_check;
alter table public.exam_question_feedback add constraint exam_question_feedback_status_check
  check (status in ('open', 'accepted', 'rejected'));

-- --------------------------------------------------------------------------
-- 7. Denetim: iz kaldıysa işlem geri alınır
-- --------------------------------------------------------------------------
do $$
declare left_over text;
begin
  select string_agg(x, ', ') into left_over from (
    select 'fonksiyon ' || p.proname as x from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.prosrc ~* '(is_teacher|campuso_user_id|teacher_note|teacher_reviewed|assignment_id|class_members|exam_hidden_results|teacher_materials|created_by_role)'
    union all
    select 'tablo ' || c.relname from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname in ('classes', 'class_members', 'class_join_fails', 'assignments', 'assignment_gen_log', 'exam_hidden_results', 'teacher_materials')
    union all
    select 'sütun ' || table_name || '.' || column_name from information_schema.columns
      where table_schema = 'public' and column_name ~* '(teacher|campuso|assignment_id|attempt_no|created_by_role)'
    union all
    select 'politika ' || tablename || '.' || policyname from pg_policies
      where schemaname = 'public' and (policyname ~* 'teacher' or coalesce(qual, '') ~* 'teacher' or coalesce(with_check, '') ~* 'teacher')
  ) t;
  if left_over is not null then raise exception 'Öğretmen sisteminden iz kaldı: %', left_over; end if;
end $$;

commit;
