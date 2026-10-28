-- Faz 6.3c davranış testi: tests/exam-assignment-student.js koşturur (ACADEX_PG verilirse).
\set ON_ERROR_STOP 1
create or replace function public.t_err(q text, pat text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm !~* pat then raise exception 'beklenen hata "%" ama gelen "%"', pat, sqlerrm; end if; return; end;
  raise exception 'hata bekleniyordu (%): %', pat, q;
end $$;
grant execute on function public.t_err(text, text) to authenticated;
alter table public.exams add column if not exists course_code text, add column if not exists answers jsonb, add column if not exists question_results jsonb, add column if not exists questions jsonb,
  add column if not exists started_at timestamptz, add column if not exists hints_used jsonb, add column if not exists scoring jsonb,
  add column if not exists is_simulation boolean, add column if not exists time_limit_seconds int, add column if not exists teacher_note text,
  add column if not exists teacher_reviewed boolean, add column if not exists teacher_reviewed_by uuid, add column if not exists teacher_reviewed_at timestamptz;
drop policy if exists "Users can update own exams" on public.exams;
create policy "Users can update own exams" on public.exams for update to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can view own exams" on public.exams;
create policy "Users can view own exams" on public.exams for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own exams" on public.exams;
create policy "Users can insert own exams" on public.exams for insert to authenticated with check (auth.uid() = user_id);
insert into exams (id, user_id, assignment_id, attempt_no, is_simulation, time_limit_seconds) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', null, 1, true, 1800);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
set request.jwt.claims = '{"role":"authenticated"}';
select t_err($q$ update exams set attempt_no = null where id = '20000000-0000-0000-0000-000000000001' $q$, 'yalnizca sunucu');
select t_err($q$ update exams set is_simulation = false where id = '20000000-0000-0000-0000-000000000001' $q$, 'yalnizca sunucu');
select t_err($q$ update exams set time_limit_seconds = 99999 where id = '20000000-0000-0000-0000-000000000001' $q$, 'yalnizca sunucu');
select t_err($q$ update exams set teacher_note = 'aferin' where id = '20000000-0000-0000-0000-000000000001' $q$, 'yalnizca sunucu');
select t_err($q$ insert into exams (user_id, attempt_no) values (auth.uid(), 1) $q$, 'yalnizca sunucu');
-- eski davranış: puanlama alanları zaten kilitli, serbest alanlarla güncelleme çalışır
select t_err($q$ update exams set grade = 100 where id = '20000000-0000-0000-0000-000000000001' $q$, 'yalnizca sunucu');
update exams set course_code = 'X' where id = '20000000-0000-0000-0000-000000000001';
create temp table t_n as select count(*) n from exams where course_code = 'X';
reset role;
reset request.jwt.claims;
-- sunucu (jwt yok) serbest
update exams set time_limit_seconds = 600 where id = '20000000-0000-0000-0000-000000000001';
do $$ begin if (select n from t_n) <> 1 then raise exception 'BAŞARISIZ: serbest alan güncellenemedi'; end if; if (select time_limit_seconds from exams where id = '20000000-0000-0000-0000-000000000001') <> 600 then raise exception 'BAŞARISIZ: sunucu güncellemesi'; end if; end $$;
select 'HEPSI GECTI' as sonuc;
