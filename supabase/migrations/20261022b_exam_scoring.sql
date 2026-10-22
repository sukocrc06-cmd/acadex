-- ==========================================================================
-- Acadex: Sınav Platformu — Faz 2c: şık sayısı ve "yanlış doğruyu götürür"
--
-- This migration is NOT applied automatically -- run it yourself via:
--   1. Supabase Studio -> SQL Editor -> paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- 20261014_exam_integrity.sql'den SONRA çalıştırılmalı. İki kez çalıştırmak
-- güvenli.
--
-- Ne yapıyor:
--   1. public.exams.scoring (jsonb, boş olabilir) — sınav kurulurken seçilen
--      puanlama ayarı. generate-exam (service role) yazar:
--        { "option_count": 4 | 5,
--          "negative_marking": true | false,
--          "wrong_per_correct": 3 | 4 }   -- kaç yanlış bir doğruyu götürür
--      Boş (null) = eski davranış: 4 şık, ceza yok.
--   2. exams_guard_grading_fields tetikleyicisine scoring eklenir: öğrenci
--      sınav sırasında cezayı tarayıcıdan kapatamasın. Fonksiyonun geri
--      kalanı 20261014_exam_integrity.sql'deki ile BİREBİR aynı.
-- ==========================================================================

alter table public.exams add column if not exists scoring jsonb;

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
     or new.scoring is distinct from old.scoring then
    raise exception 'Sinav puanlama alanlari yalnizca sunucu tarafindan degistirilebilir.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Tetikleyici 20261014'te kuruldu; fonksiyon yerinde değiştiği için yeniden
-- bağlamaya gerek yok. Yine de yoksa (eski kurulum) kur.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'exams_guard_grading_fields' and tgrelid = 'public.exams'::regclass
  ) then
    create trigger exams_guard_grading_fields
      before insert or update on public.exams
      for each row execute function public.exams_guard_grading_fields();
  end if;
end
$$;
