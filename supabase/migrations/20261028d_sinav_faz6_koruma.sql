-- ==========================================================================
-- Acadex: Sınav Platformu — Faz 6.3c: sınav satırı koruması genişletildi
-- 28.10.2026 · Tekrar çalıştırmak zarar vermez.
--
-- "Users can update own exams" politikası öğrenciye kendi exams satırını
-- güncelleme izni veriyor; exams_guard_grading_fields tetikleyicisi yalnızca
-- puanlama alanlarını kilitliyordu. Kilitli olmayanlarla öğrenci:
--   - assignment_id'yi boşaltıp ödevin deneme hakkını sıfırlayabilir,
--   - is_simulation / time_limit_seconds ile süre sınırını ve ipucu yasağını
--     kaldırabilirdi (yalnızca ödevde değil, her "gerçek sınav provası"nda),
--   - teacher_note yazabilirdi.
-- Artık bunlar da yalnızca sunucu tarafından yazılır; öğrenci INSERT'inde
-- ödev alanları boş olmalı. Kalan kural 20261022b ile BİREBİR aynı.
-- ==========================================================================

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
       or new.scoring is not null
       or new.assignment_id is not null or new.attempt_no is not null
       or new.teacher_note is not null then
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
     -- Faz 6.3c
     or new.user_id is distinct from old.user_id
     or new.assignment_id is distinct from old.assignment_id
     or new.attempt_no is distinct from old.attempt_no
     or new.is_simulation is distinct from old.is_simulation
     or new.time_limit_seconds is distinct from old.time_limit_seconds
     or new.teacher_note is distinct from old.teacher_note
     or new.teacher_reviewed is distinct from old.teacher_reviewed
     or new.teacher_reviewed_by is distinct from old.teacher_reviewed_by
     or new.teacher_reviewed_at is distinct from old.teacher_reviewed_at then
    raise exception 'Sinav puanlama alanlari yalnizca sunucu tarafindan degistirilebilir.' using errcode = '42501';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'exams_guard_grading_fields' and tgrelid = 'public.exams'::regclass) then
    create trigger exams_guard_grading_fields before insert or update on public.exams
      for each row execute function public.exams_guard_grading_fields();
  end if;
end $$;
