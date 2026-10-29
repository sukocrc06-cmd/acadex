-- Sınav kaydı koruması davranış testi: tests/sinav-kaydi-koruma.js koşturur (ACADEX_PG verilirse).
-- Sıra: _supabase-stub.sql → 20261028d_sinav_kaydi_koruma.sql → 20261029d_ogretmen_sistemi_kaldir.sql → bu dosya
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
  add column if not exists is_simulation boolean, add column if not exists time_limit_seconds int;
drop policy if exists "Users can update own exams" on public.exams;
create policy "Users can update own exams" on public.exams for update to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can view own exams" on public.exams;
create policy "Users can view own exams" on public.exams for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own exams" on public.exams;
create policy "Users can insert own exams" on public.exams for insert to authenticated with check (auth.uid() = user_id);
insert into exams (id, user_id, is_simulation, time_limit_seconds) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', true, 1800);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
set request.jwt.claims = '{"role":"authenticated"}';
select t_err($q$ update exams set user_id = '00000000-0000-0000-0000-00000000000d' where id = '20000000-0000-0000-0000-000000000001' $q$, 'yalnizca sunucu');
select t_err($q$ update exams set is_simulation = false where id = '20000000-0000-0000-0000-000000000001' $q$, 'yalnizca sunucu');
select t_err($q$ update exams set time_limit_seconds = 99999 where id = '20000000-0000-0000-0000-000000000001' $q$, 'yalnizca sunucu');
select t_err($q$ insert into exams (user_id, grade) values (auth.uid(), 100) $q$, 'yalnizca sunucu');
-- eski davranış: puanlama alanları zaten kilitli, serbest alanlarla güncelleme çalışır
select t_err($q$ update exams set grade = 100 where id = '20000000-0000-0000-0000-000000000001' $q$, 'yalnizca sunucu');
update exams set course_code = 'X' where id = '20000000-0000-0000-0000-000000000001';
create temp table t_n as select count(*) n from exams where course_code = 'X';
reset role;
reset request.jwt.claims;
-- sunucu (jwt yok) serbest
update exams set time_limit_seconds = 600 where id = '20000000-0000-0000-0000-000000000001';
do $$ begin if (select n from t_n) <> 1 then raise exception 'BAŞARISIZ: serbest alan güncellenemedi'; end if; if (select time_limit_seconds from exams where id = '20000000-0000-0000-0000-000000000001') <> 600 then raise exception 'BAŞARISIZ: sunucu güncellemesi'; end if; end $$;
-- öğretmen sistemi kaldırıldıktan sonra yeniden tanımlanan yönetim fonksiyonları çalışır
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
create temp table t_ann as select public.admin_announce_save(null, 'Duyuru', 'metin', '', true, null, null) as id;
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'de@x.tr');
update profiles set email = 'de@x.tr' where id = '00000000-0000-0000-0000-00000000000d';
set role authenticated;
select public.admin_delete_user('00000000-0000-0000-0000-00000000000d', 'DE@x.tr');
reset role;
do $$ begin
  if (select count(*) from announcements where title = 'Duyuru') <> 1 then raise exception 'BAŞARISIZ: duyuru kaydedilemedi'; end if;
  if exists (select 1 from profiles where id = '00000000-0000-0000-0000-00000000000d') or exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000d') then raise exception 'BAŞARISIZ: hesap silinemedi'; end if;
  if (select count(*) from admin_audit_log where action in ('announcement_create', 'user_delete')) <> 2 then raise exception 'BAŞARISIZ: denetim kaydı'; end if;
end $$;
-- itiraz durumu artık öğretmene iletilemez
select t_err($q$ insert into exam_question_feedback (exam_id, question_id, user_id, kind, status) values (null, 1, null, 'appeal', 'escalated') $q$, 'status_check');
select 'HEPSI GECTI' as sonuc;
