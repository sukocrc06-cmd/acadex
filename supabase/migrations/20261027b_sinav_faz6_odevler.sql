-- ==========================================================================
-- Acadex: Sınav Platformu — Faz 6.2: ödev hazırlama (taslak, düzenleme, yayın)
-- 27.10.2026 · 20261027_sinav_faz6_siniflar.sql'den SONRA çalıştır.
-- Tekrar çalıştırmak zarar vermez.
--
-- Akış:
--   1. Öğretmen sınıf kartında "ödev hazırla" der → assignment_create (taslak).
--   2. Sınav kurulum penceresi taslak kipinde açılır; generate-exam
--      { assignmentDraft: true } soruları CEVAPLARIYLA öğretmene döndürür
--      (sınav kaydı açılmaz; assignment_gen_take saatte 20 taslak sınırı).
--   3. Öğretmen soruları düzenler, siler, yeniden ürettirir, kendi sorusunu
--      ekler; ayarları seçer → assignment_save.
--   4. assignment_publish: sorular kilitlenir. Sonra yalnızca tarihler
--      değişir (assignment_set_dates) ya da ödev kapanır (assignment_close).
--
-- Öğrenci bu tabloyu HİÇ okuyamaz (sorular cevap anahtarını taşır). Öğrenci
-- tarafı Faz 6.3'te: generate-exam ödevden öğrenciye özel sınav kaydı ve ayrı
-- cevap anahtarı (exam_answer_keys) açar.
-- ==========================================================================

create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  teacher_id   uuid not null references public.profiles(id) on delete cascade,
  title        text not null check (char_length(title) between 2 and 120),
  instructions text not null default '' check (char_length(instructions) <= 1000),
  status       text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  source       jsonb not null default '{}'::jsonb,
  settings     jsonb not null default '{}'::jsonb,
  questions    jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  opens_at     timestamptz,
  due_at       timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists assignments_class_idx on public.assignments (class_id, status);

create table if not exists public.assignment_gen_log (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  at         timestamptz not null default now()
);
create index if not exists assignment_gen_log_idx on public.assignment_gen_log (teacher_id, at);

alter table public.assignments enable row level security;
alter table public.assignment_gen_log enable row level security;
revoke all on public.assignments, public.assignment_gen_log from anon, authenticated;
grant select on public.assignments to authenticated;

drop policy if exists "assignments_teacher_select" on public.assignments;
create policy "assignments_teacher_select" on public.assignments for select to authenticated
  using (public.is_class_teacher(class_id) or public.current_is_admin());

-- --------------------------------------------------------------------------
-- Ayarlar: bilinmeyen anahtarlar atılır, değerler sınırlara çekilir
-- --------------------------------------------------------------------------
create or replace function public.assignment_clean_settings(p jsonb)
returns jsonb language plpgsql immutable set search_path to 'public' as $$
declare s jsonb := coalesce(p, '{}'::jsonb); sc jsonb := coalesce(s->'scoring', '{}'::jsonb);
  tl int; at int; lp int; ld int;
begin
  tl := case when jsonb_typeof(s->'time_limit_minutes') = 'number' then (s->>'time_limit_minutes')::numeric::int end;
  at := coalesce(case when jsonb_typeof(s->'attempts') = 'number' then (s->>'attempts')::numeric::int end, 1);
  lp := coalesce(case when jsonb_typeof(s->'late_penalty_pct') = 'number' then (s->>'late_penalty_pct')::numeric::int end, 10);
  ld := coalesce(case when jsonb_typeof(s->'late_days') = 'number' then (s->>'late_days')::numeric::int end, 3);
  return jsonb_build_object(
    'exam_type', case when s->>'exam_type' in ('classic', 'test', 'mixed', 'calculation') then s->>'exam_type' else 'mixed' end,
    'language', case when s->>'language' in ('tr', 'en') then s->>'language' else 'tr' end,
    'difficulty', case when s->>'difficulty' in ('easy', 'medium', 'hard') then s->>'difficulty' else 'medium' end,
    'time_limit_minutes', case when tl is null or tl <= 0 then null else least(greatest(tl, 5), 300) end,
    'attempts', least(greatest(at, 1), 3),
    'late', case when s->>'late' = 'penalty' then 'penalty' else 'none' end,
    'late_penalty_pct', least(greatest(lp, 1), 50),
    'late_days', least(greatest(ld, 1), 7),
    'show_answers', case when s->>'show_answers' in ('after_submit', 'after_due', 'never') then s->>'show_answers' else 'after_due' end,
    'vary_numbers', coalesce((s->>'vary_numbers')::boolean, false),
    'shuffle', coalesce((s->>'shuffle')::boolean, true),
    'scoring', jsonb_build_object(
      'option_count', case when sc->>'option_count' = '5' then 5 else 4 end,
      'negative_marking', case when coalesce((sc->>'negative_marking')::text, 'false') in ('true', '3', '4') then true else false end,
      'wrong_per_correct', case when sc->>'wrong_per_correct' = '4' then 4 else 3 end)
      || case when sc->>'decimal_places' in ('2', '3', '4') then jsonb_build_object('decimal_places', (sc->>'decimal_places')::int) else '{}'::jsonb end);
end $$;

-- Soru listesi (taslak): dizi, en çok 40 soru, bilinen türler, metin en çok 4000 karakter.
-- Boş metin taslakta serbest (öğretmen boş soru ekleyip sonra doldurur); yayında denetlenir.
create or replace function public.assignment_check_questions(q jsonb)
returns text language plpgsql immutable set search_path to 'public' as $$
declare e jsonb; i int := 0;
begin
  if jsonb_typeof(q) <> 'array' then return 'Sorular okunamadı'; end if;
  if jsonb_array_length(q) > 40 then return 'Bir ödevde en çok 40 soru olabilir'; end if;
  if octet_length(q::text) > 900000 then return 'Ödev çok büyük; soru sayısını azalt'; end if;
  for e in select value from jsonb_array_elements(q) loop
    i := i + 1;
    if jsonb_typeof(e) <> 'object' then return i || '. soru okunamadı'; end if;
    if coalesce(e->>'type', '') not in ('multiple_choice', 'true_false', 'fill_blank', 'open_ended', 'calculation', 'expression', 'graph') then
      return i || '. sorunun türü tanınmadı';
    end if;
    if jsonb_typeof(e->'question') not in ('string', 'null') or char_length(coalesce(e->>'question', '')) > 4000 then
      return i || '. sorunun metni en çok 4000 karakter olmalı';
    end if;
  end loop;
  return null;
end $$;

-- Yayın öncesi: her sorunun cevabı tanımlı
create or replace function public.assignment_check_answers(q jsonb)
returns text language plpgsql immutable set search_path to 'public' as $$
declare e jsonb; i int := 0; t text; ca text;
begin
  if jsonb_array_length(q) = 0 then return 'En az bir soru gerekli'; end if;
  for e in select value from jsonb_array_elements(q) loop
    i := i + 1; t := e->>'type'; ca := btrim(coalesce(e->>'correct_answer', ''));
    if char_length(btrim(coalesce(e->>'question', ''))) < 3 then return i || '. sorunun metni boş'; end if;
    if t = 'multiple_choice' then
      if jsonb_typeof(e->'options') <> 'array' or jsonb_array_length(e->'options') not between 2 and 6 then return i || '. soruda 2-6 şık olmalı'; end if;
      if exists (select 1 from jsonb_array_elements_text(e->'options') o where btrim(o) = '') then return i || '. soruda boş şık var'; end if;
      if (select count(distinct lower(btrim(o))) from jsonb_array_elements_text(e->'options') o) < jsonb_array_length(e->'options') then return i || '. soruda aynı şık iki kez var'; end if;
      if not exists (select 1 from jsonb_array_elements_text(e->'options') o where btrim(o) = ca) then return i || '. soruda doğru şık seçilmedi'; end if;
    elsif t = 'graph' then
      if e->'graph_answer' is null and ca = '' then return i || '. çizim sorusunun cevabı yok'; end if;
    elsif t <> 'open_ended' and ca = '' then
      return i || '. sorunun doğru cevabı boş';
    end if;
  end loop;
  return null;
end $$;

-- --------------------------------------------------------------------------
-- Öğretmen fonksiyonları
-- --------------------------------------------------------------------------
create or replace function public.assignment_gen_take()
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.current_is_active_teacher() then return false; end if;
  if (select count(*) from assignment_gen_log where teacher_id = auth.uid() and at > now() - interval '1 hour') >= 20 then return false; end if;
  insert into assignment_gen_log (teacher_id) values (auth.uid());
  delete from assignment_gen_log where at < now() - interval '2 days';
  return true;
end $$;

create or replace function public.assignment_create(p_class uuid, p_title text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare r assignments; t text := btrim(coalesce(p_title, ''));
begin
  if not public.is_class_teacher(p_class) then raise exception 'Bu sınıf senin değil' using errcode = '42501'; end if;
  if (select archived from classes where id = p_class) then raise exception 'Arşivdeki sınıfa ödev verilemez'; end if;
  if char_length(t) < 2 or char_length(t) > 120 then raise exception 'Ödev adı 2-120 karakter olmalı'; end if;
  if (select count(*) from assignments where class_id = p_class and status = 'draft') >= 20 then raise exception 'Bu sınıfta en çok 20 taslak olabilir'; end if;
  insert into assignments (class_id, teacher_id, title) values (p_class, auth.uid(), t) returning * into r;
  return json_build_object('id', r.id, 'title', r.title, 'status', r.status);
end $$;

create or replace function public.assignment_save(p_id uuid, p_title text, p_instructions text, p_source jsonb,
                                                  p_settings jsonb, p_questions jsonb, p_opens_at timestamptz, p_due_at timestamptz)
returns json language plpgsql security definer set search_path to 'public' as $$
declare a assignments; msg text; t text := btrim(coalesce(p_title, ''));
begin
  select * into a from assignments where id = p_id;
  if a.id is null or not public.is_class_teacher(a.class_id) then raise exception 'Bu ödev senin değil' using errcode = '42501'; end if;
  if a.status <> 'draft' then raise exception 'Yayınlanan ödevin soruları değiştirilemez; yalnızca tarihleri değişir'; end if;
  if char_length(t) < 2 or char_length(t) > 120 then raise exception 'Ödev adı 2-120 karakter olmalı'; end if;
  if char_length(coalesce(p_instructions, '')) > 1000 then raise exception 'Açıklama en çok 1000 karakter'; end if;
  msg := public.assignment_check_questions(coalesce(p_questions, '[]'::jsonb));
  if msg is not null then raise exception '%', msg; end if;
  if p_opens_at is not null and p_due_at is not null and p_opens_at >= p_due_at then raise exception 'Açılış son teslimden önce olmalı'; end if;
  update assignments set
    title = t, instructions = coalesce(p_instructions, ''),
    source = case when jsonb_typeof(p_source) = 'object' then p_source else source end,
    settings = public.assignment_clean_settings(p_settings),
    questions = coalesce(p_questions, '[]'::jsonb),
    opens_at = p_opens_at, due_at = p_due_at, updated_at = now()
  where id = p_id returning * into a;
  return json_build_object('id', a.id, 'status', a.status, 'updated_at', a.updated_at, 'settings', a.settings);
end $$;

create or replace function public.assignment_publish(p_id uuid)
returns json language plpgsql security definer set search_path to 'public' as $$
declare a assignments; msg text;
begin
  select * into a from assignments where id = p_id;
  if a.id is null or not public.is_class_teacher(a.class_id) then raise exception 'Bu ödev senin değil' using errcode = '42501'; end if;
  if a.status <> 'draft' then raise exception 'Ödev zaten yayında'; end if;
  if (select archived from classes where id = a.class_id) then raise exception 'Arşivdeki sınıfa ödev verilemez'; end if;
  msg := coalesce(public.assignment_check_questions(a.questions), public.assignment_check_answers(a.questions));
  if msg is not null then raise exception '%', msg; end if;
  if a.due_at is null or a.due_at < now() + interval '10 minutes' then raise exception 'Son teslim en az 10 dakika sonrası olmalı'; end if;
  if a.opens_at is not null and a.opens_at >= a.due_at then raise exception 'Açılış son teslimden önce olmalı'; end if;
  update assignments set status = 'published', published_at = now(), opens_at = coalesce(opens_at, now()),
    settings = public.assignment_clean_settings(settings), updated_at = now()
  where id = p_id returning * into a;
  return json_build_object('id', a.id, 'status', a.status, 'opens_at', a.opens_at, 'due_at', a.due_at);
end $$;

create or replace function public.assignment_set_dates(p_id uuid, p_opens_at timestamptz, p_due_at timestamptz)
returns json language plpgsql security definer set search_path to 'public' as $$
declare a assignments;
begin
  select * into a from assignments where id = p_id;
  if a.id is null or not public.is_class_teacher(a.class_id) then raise exception 'Bu ödev senin değil' using errcode = '42501'; end if;
  if p_due_at is null then raise exception 'Son teslim gerekli'; end if;
  if p_opens_at is not null and p_opens_at >= p_due_at then raise exception 'Açılış son teslimden önce olmalı'; end if;
  -- yayındaki ödevin açılışı geriye alınamaz (öğrenci zaten görmüş olabilir)
  update assignments set opens_at = case when status = 'draft' then p_opens_at else least(coalesce(p_opens_at, opens_at), opens_at) end,
    due_at = p_due_at, status = case when status = 'closed' and p_due_at > now() then 'published' else status end, updated_at = now()
  where id = p_id returning * into a;
  return json_build_object('id', a.id, 'status', a.status, 'opens_at', a.opens_at, 'due_at', a.due_at);
end $$;

create or replace function public.assignment_close(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare a assignments;
begin
  select * into a from assignments where id = p_id;
  if a.id is null or not public.is_class_teacher(a.class_id) then raise exception 'Bu ödev senin değil' using errcode = '42501'; end if;
  if a.status <> 'published' then raise exception 'Yalnızca yayındaki ödev kapatılabilir'; end if;
  update assignments set status = 'closed', updated_at = now() where id = p_id;
end $$;

create or replace function public.assignment_delete(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare a assignments;
begin
  select * into a from assignments where id = p_id;
  if a.id is null or not public.is_class_teacher(a.class_id) then raise exception 'Bu ödev senin değil' using errcode = '42501'; end if;
  if a.status <> 'draft' then raise exception 'Yalnızca taslak silinebilir; yayındaki ödevi kapat'; end if;
  delete from assignments where id = p_id;
end $$;

-- --------------------------------------------------------------------------
-- Yetkiler
-- --------------------------------------------------------------------------
revoke all on function public.assignment_clean_settings(jsonb) from public, anon, authenticated;
revoke all on function public.assignment_check_questions(jsonb) from public, anon, authenticated;
revoke all on function public.assignment_check_answers(jsonb) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'assignment_gen_take()', 'assignment_create(uuid,text)',
    'assignment_save(uuid,text,text,jsonb,jsonb,jsonb,timestamptz,timestamptz)',
    'assignment_publish(uuid)', 'assignment_set_dates(uuid,timestamptz,timestamptz)',
    'assignment_close(uuid)', 'assignment_delete(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
