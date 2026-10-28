-- ==========================================================================
-- Acadex: Sınav Platformu — Faz 6.3: öğrenci tarafı (ödev listesi, başlatma,
-- geç teslim, gizli cevaplar)
-- 28.10.2026 · 20261027b_sinav_faz6_odevler.sql'den SONRA çalıştır.
-- Tekrar çalıştırmak zarar vermez.
--
--   exams.assignment_id / attempt_no  ödevden açılan sınav kaydı; aynı ödevde
--                                     aynı anda tek yarım deneme (benzersiz indeks)
--   exam_hidden_results               cevaplar gizliyken tam sonuç burada; öğrenci
--                                     yalnızca reveal_at geçince okur (null = hiç)
--   assignment_begin(p_id, p_user)    YALNIZCA service_role (generate-exam): kurallar
--                                     (üyelik, açılış, son teslim/geç pencere, deneme
--                                     hakkı, yarım deneme) burada; soruları anahtarıyla
--                                     döndürür, öğrenciye asla gitmez
--   my_assignments()                  öğrencinin ödev listesi (soru ve cevap YOK)
-- ==========================================================================

alter table public.exams add column if not exists assignment_id uuid references public.assignments(id) on delete set null;
alter table public.exams add column if not exists attempt_no int;
create index if not exists exams_assignment_idx on public.exams (assignment_id, user_id) where assignment_id is not null;
create unique index if not exists exams_assignment_open_uidx on public.exams (assignment_id, user_id)
  where assignment_id is not null and completed_at is null;

create table if not exists public.exam_hidden_results (
  exam_id    uuid primary key references public.exams(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  results    jsonb not null,
  reveal_at  timestamptz,
  created_at timestamptz not null default now()
);
alter table public.exam_hidden_results enable row level security;
revoke all on public.exam_hidden_results from anon, authenticated;
grant select on public.exam_hidden_results to authenticated;
drop policy if exists "exam_hidden_results_revealed" on public.exam_hidden_results;
create policy "exam_hidden_results_revealed" on public.exam_hidden_results for select to authenticated
  using (user_id = auth.uid() and reveal_at is not null and reveal_at <= now());

-- teslim penceresinin sonu: son teslim + (kesintili geç teslimde) gün sayısı
create or replace function public.assignment_window_end(a public.assignments)
returns timestamptz language sql immutable set search_path to 'public' as $$
  select a.due_at + case when a.settings->>'late' = 'penalty'
    then make_interval(days => coalesce((a.settings->>'late_days')::int, 0)) else interval '0' end;
$$;

-- --------------------------------------------------------------------------
-- Başlatma (yalnızca generate-exam, service_role)
-- --------------------------------------------------------------------------
create or replace function public.assignment_begin(p_id uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a assignments; k classes; me profiles; wend timestamptz; used int; open_id uuid; late_days int := 0;
begin
  select * into a from assignments where id = p_id;
  if a.id is null or a.status = 'draft' then raise exception 'Ödev bulunamadı'; end if;
  select * into k from classes where id = a.class_id;
  if not exists (select 1 from class_members where class_id = a.class_id and user_id = p_user) then raise exception 'Bu ödev senin sınıfına ait değil'; end if;
  select * into me from profiles where id = p_user;
  if me.id is null or me.is_suspended or not coalesce(me.access_allowed, true) then raise exception 'Hesabın bu ödeve başlayamıyor'; end if;
  if k.archived then raise exception 'Sınıf arşivlendi; ödev kapandı'; end if;
  -- yarım deneme varsa ona dönülür (pencere kapanmış olsa da: süre sunucuda zaten işliyor)
  select id into open_id from exams where assignment_id = p_id and user_id = p_user and completed_at is null limit 1;
  if open_id is not null then return jsonb_build_object('resume_exam_id', open_id); end if;
  if a.status = 'closed' then raise exception 'Öğretmen bu ödevi kapattı'; end if;
  if a.opens_at is not null and a.opens_at > now() then raise exception 'Ödev % tarihinde açılacak', to_char(a.opens_at at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI'); end if;
  wend := public.assignment_window_end(a);
  if now() >= wend then raise exception 'Teslim süresi doldu'; end if;
  select count(*) into used from exams where assignment_id = p_id and user_id = p_user and completed_at is not null;
  if used >= coalesce((a.settings->>'attempts')::int, 1) then raise exception 'Deneme hakkın bitti'; end if;
  if now() > a.due_at then late_days := ceil(extract(epoch from now() - a.due_at) / 86400)::int; end if;
  return jsonb_build_object(
    'assignment_id', a.id, 'title', a.title, 'instructions', a.instructions, 'class_id', a.class_id,
    'class_name', k.name, 'course_code', k.course_code, 'questions', a.questions, 'settings', a.settings,
    'source', a.source, 'due_at', a.due_at, 'window_end', wend, 'attempt_no', used + 1, 'late_days', late_days);
end $$;

-- --------------------------------------------------------------------------
-- Öğrencinin ödev listesi (soru ve cevap anahtarı içermez)
-- --------------------------------------------------------------------------
create or replace function public.my_assignments()
returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  return coalesce((select json_agg(x order by x.sort_key, x.due_at) from (
    select a.id, a.title, a.instructions, a.class_id, k.name as class_name, k.course_code,
      coalesce(nullif(t.full_name, ''), 'Öğretmen') as teacher_name,
      a.opens_at, a.due_at, public.assignment_window_end(a) as window_end, a.status,
      jsonb_array_length(a.questions) as question_count,
      (a.settings->>'time_limit_minutes')::int as time_limit_minutes,
      coalesce((a.settings->>'attempts')::int, 1) as attempts,
      a.settings->>'late' as late, (a.settings->>'late_penalty_pct')::int as late_penalty_pct, (a.settings->>'late_days')::int as late_days,
      a.settings->>'show_answers' as show_answers,
      st.used, st.best_grade, st.last_exam_id, st.open_exam_id,
      case
        when st.open_exam_id is not null then 'in_progress'
        when a.opens_at is not null and a.opens_at > now() then 'upcoming'
        when st.used >= coalesce((a.settings->>'attempts')::int, 1) then 'done'
        when a.status = 'closed' or now() >= public.assignment_window_end(a) then 'closed'
        when now() > a.due_at then 'late'
        else 'open' end as state,
      case when st.open_exam_id is not null then 0 when a.opens_at > now() then 3
        when st.used >= coalesce((a.settings->>'attempts')::int, 1) or a.status = 'closed' or now() >= public.assignment_window_end(a) then 4
        else 1 end as sort_key
    from class_members m
    join classes k on k.id = m.class_id and not k.archived
    join assignments a on a.class_id = k.id and a.status in ('published', 'closed')
    join profiles t on t.id = k.teacher_id
    cross join lateral (
      select count(*) filter (where e.completed_at is not null)::int as used,
        max(e.grade) filter (where e.completed_at is not null) as best_grade,
        (array_agg(e.id order by e.completed_at desc) filter (where e.completed_at is not null))[1] as last_exam_id,
        (array_agg(e.id) filter (where e.completed_at is null))[1] as open_exam_id
      from exams e where e.assignment_id = a.id and e.user_id = auth.uid()) st
    where m.user_id = auth.uid()) x), '[]'::json);
end $$;

revoke all on function public.assignment_begin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assignment_begin(uuid, uuid) to service_role;
revoke all on function public.assignment_window_end(public.assignments) from public, anon;
grant execute on function public.assignment_window_end(public.assignments) to authenticated;
revoke all on function public.my_assignments() from public, anon;
grant execute on function public.my_assignments() to authenticated;
