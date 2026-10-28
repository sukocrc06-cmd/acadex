-- ==========================================================================
-- Acadex: Sınav Platformu — Faz 6.4: öğretmenin sonuç ve analiz ekranı
-- 28.10.2026 · 20261028d_sinav_faz6_koruma.sql'den SONRA çalıştır. Tekrar
-- çalıştırmak zarar vermez.
--
--   exam_teacher_ok(p_exam)      sınav, çağıranın (etkin öğretmen) sınıfındaki bir ödevden mi
--                                (exam-appeal'in öğretmen işlemleri bunu sorar: puan düzeltme,
--                                öğrenciye not; yazma orada service_role ile)
--   assignment_results(p_id)     ödevin tam sonuçları: üyeler, denemeler (gizli cevaplıysa tam
--                                sonuç exam_hidden_results'tan), itiraz ve bildirimler
--   class_mastery_data(p_class)  YALNIZCA ustalığını paylaşan öğrencilerin o dersteki sınavları
--                                (sınıfın ders kodu ya da sınıfın ödevleri); yalnızca konu, puan,
--                                tür, işaret/ipucu — soru ve cevap metni yok
-- Öğretmen öğrencinin başka hiçbir verisini (belge, kart, başka ders) göremez.
-- ==========================================================================

create or replace function public.exam_teacher_ok(p_exam uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.current_is_active_teacher() and exists (
    select 1 from exams e join assignments a on a.id = e.assignment_id join classes k on k.id = a.class_id
    where e.id = p_exam and k.teacher_id = auth.uid());
$$;

create or replace function public.assignment_results(p_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare a assignments;
begin
  select * into a from assignments where id = p_id;
  if a.id is null or not public.is_class_teacher(a.class_id) then raise exception 'Bu ödev senin değil' using errcode = '42501'; end if;
  return json_build_object(
    'assignment', json_build_object('id', a.id, 'class_id', a.class_id, 'title', a.title, 'status', a.status, 'opens_at', a.opens_at,
      'due_at', a.due_at, 'window_end', public.assignment_window_end(a), 'settings', a.settings, 'questions', a.questions),
    'members', coalesce((select json_agg(json_build_object(
        'user_id', m.user_id, 'full_name', coalesce(nullif(p.full_name, ''), 'İsimsiz öğrenci'),
        'student_number', case when p.student_number like 'oauth-%' then null else p.student_number end,
        'joined_at', m.joined_at, 'share_mastery', m.share_mastery) order by p.full_name)
      from class_members m join profiles p on p.id = m.user_id where m.class_id = a.class_id), '[]'::json),
    'exams', coalesce((select json_agg(json_build_object(
        'id', e.id, 'user_id', e.user_id, 'attempt_no', e.attempt_no, 'started_at', e.started_at, 'completed_at', e.completed_at,
        'grade', e.grade, 'answers', e.answers, 'questions', e.questions,
        'results', coalesce(h.results, e.question_results),
        'assignment', e.scoring->'assignment', 'scoring', e.scoring - 'assignment' - 'adaptive', 'teacher_note', e.teacher_note) order by e.started_at)
      from exams e left join exam_hidden_results h on h.exam_id = e.id where e.assignment_id = a.id), '[]'::json),
    'feedback', coalesce((select json_agg(json_build_object(
        'id', f.id, 'exam_id', f.exam_id, 'question_id', f.question_id, 'user_id', f.user_id, 'kind', f.kind, 'category', f.category,
        'status', f.status, 'reason', f.reason, 'old_score', f.old_score, 'new_score', f.new_score, 'details', f.details, 'created_at', f.created_at) order by f.created_at desc)
      from exam_question_feedback f join exams e on e.id = f.exam_id where e.assignment_id = a.id), '[]'::json));
end $$;

create or replace function public.class_mastery_data(p_class uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare k classes;
begin
  select * into k from classes where id = p_class;
  if k.id is null or not public.is_class_teacher(p_class) then raise exception 'Bu sınıf senin değil' using errcode = '42501'; end if;
  return coalesce((select json_agg(json_build_object('user_id', m.user_id, 'full_name', coalesce(nullif(p.full_name, ''), 'İsimsiz öğrenci'), 'exams', coalesce((
      select json_agg(json_build_object('completed_at', x.completed_at, 'scoring', json_build_object('option_count', x.scoring->'option_count'),
        'question_results', (select coalesce(json_agg(json_build_object('concept', r->>'concept', 'score', r->'score', 'type', r->>'type',
            'flagged', r->'flagged', 'hint_used', r->'hint_used')), '[]'::json) from jsonb_array_elements(coalesce(x.question_results, '[]'::jsonb)) r)))
      from (select e.* from exams e
            where e.user_id = m.user_id and e.completed_at is not null
              and (e.assignment_id in (select id from assignments where class_id = p_class)
                   or (k.course_code is not null and upper(e.course_code) = upper(k.course_code)))
            order by e.completed_at desc limit 200) x), '[]'::json)) order by p.full_name)
    from class_members m join profiles p on p.id = m.user_id
    where m.class_id = p_class and m.share_mastery), '[]'::json);
end $$;

do $$
declare f text;
begin
  foreach f in array array['exam_teacher_ok(uuid)', 'assignment_results(uuid)', 'class_mastery_data(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
