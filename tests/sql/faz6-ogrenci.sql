-- Faz 6.3 davranış testi: tests/exam-assignment-student.js koşturur (ACADEX_PG verilirse).
-- Sıra: _supabase-stub.sql → 20261027_… → 20261027b_… → 20261028b_… → 20261028c_… → bu dosya
\set ON_ERROR_STOP 1
create or replace function public.t_err(q text, pat text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm !~* pat then raise exception 'beklenen hata "%" ama gelen "%"', pat, sqlerrm; end if; return; end;
  raise exception 'hata bekleniyordu (%): %', pat, q;
end $$;
grant execute on function public.t_err(text, text) to authenticated, service_role;
create or replace function public.t_ok(c boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(c, false) then raise exception 'BAŞARISIZ: %', msg; end if; end $$;
grant execute on function public.t_ok(boolean, text) to authenticated, service_role;
create table public.t_vars (k text primary key, v text); grant all on public.t_vars to authenticated, service_role;
grant all on all tables in schema public to service_role;

-- hazırlık: B öğretmen, C ve D öğrenci; C sınıfta, D değil
update profiles set is_teacher = true where id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into t_vars select 'c1', class_create('FIN201 – A', 'FIN201')->>'id';
reset role;
insert into t_vars select 'code', join_code from classes where id = (select v::uuid from t_vars where k = 'c1');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select class_join((select v from t_vars where k = 'code'));
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into t_vars select 'a1', assignment_create((select v::uuid from t_vars where k='c1'), 'Ödev 1')->>'id';
select assignment_save((select v::uuid from t_vars where k='a1'), 'Ödev 1', 'Not', '{}', '{"attempts":2,"late":"penalty","late_penalty_pct":10,"late_days":2,"show_answers":"after_due"}',
  '[{"type":"multiple_choice","question":"Soru?","options":["A1","B1"],"correct_answer":"A1"}]', null, now() + interval '2 days');
-- taslak öğrenciye görünmez
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok(json_array_length(my_assignments()) = 0, 'taslak listede yok');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select assignment_publish((select v::uuid from t_vars where k='a1'));

-- öğrenci listesi: soru ve cevap yok
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok(json_array_length(my_assignments()) = 1, 'yayındaki ödev listede');
select t_ok((my_assignments()->0->>'state') = 'open' and (my_assignments()->0->>'question_count')::int = 1 and (my_assignments()->0->>'attempts')::int = 2
  and (my_assignments()->0->>'teacher_name') = 'Hoca Bir' and (my_assignments()->0->>'window_end')::timestamptz > now() + interval '3 days', 'liste alanları');
select t_ok(my_assignments()::text !~ 'A1' and my_assignments()::text !~ 'correct_answer', 'soru/cevap sızmıyor');
-- öğrenci başlatma fonksiyonunu çağıramaz (cevap anahtarı döndürür)
select t_err($q$ select assignment_begin((select v::uuid from t_vars where k='a1'), auth.uid()) $q$, 'permission');
-- sınıf dışı öğrenci listede görmez
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select t_ok(json_array_length(my_assignments()) = 0, 'sınıf dışı görmez');
reset role;

-- service_role: başlatma kuralları
set role service_role;
select t_err($q$ select assignment_begin((select v::uuid from t_vars where k='a1'), '00000000-0000-0000-0000-00000000000d') $q$, 'sınıfına ait değil');
select t_ok((assignment_begin((select v::uuid from t_vars where k='a1'), '00000000-0000-0000-0000-00000000000c')->>'attempt_no')::int = 1, 'ilk deneme');
select t_ok((assignment_begin((select v::uuid from t_vars where k='a1'), '00000000-0000-0000-0000-00000000000c')->'questions'->0->>'correct_answer') = 'A1', 'anahtar yalnızca sunucuya');
reset role;
-- yarım deneme: devam
insert into exams (user_id, assignment_id, attempt_no) values ('00000000-0000-0000-0000-00000000000c', (select v::uuid from t_vars where k='a1'), 1);
select t_err($q$ insert into exams (user_id, assignment_id, attempt_no) values ('00000000-0000-0000-0000-00000000000c', (select v::uuid from t_vars where k='a1'), 2) $q$, 'duplicate|unique');
set role service_role;
select t_ok(assignment_begin((select v::uuid from t_vars where k='a1'), '00000000-0000-0000-0000-00000000000c') ? 'resume_exam_id', 'yarım denemeye dönülür');
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok((my_assignments()->0->>'state') = 'in_progress' and my_assignments()->0->>'open_exam_id' is not null, 'listede devam et');
reset role;
-- iki deneme tamamlanınca hak biter
update exams set completed_at = now(), grade = 60 where assignment_id = (select v::uuid from t_vars where k='a1');
insert into exams (user_id, assignment_id, attempt_no, completed_at, grade) values ('00000000-0000-0000-0000-00000000000c', (select v::uuid from t_vars where k='a1'), 2, now(), 85);
set role service_role;
select t_err($q$ select assignment_begin((select v::uuid from t_vars where k='a1'), '00000000-0000-0000-0000-00000000000c') $q$, 'Deneme hakkın bitti');
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok((my_assignments()->0->>'state') = 'done' and (my_assignments()->0->>'used')::int = 2 and (my_assignments()->0->>'best_grade')::numeric = 85, 'tamamlandı, en yüksek not');
reset role;

-- geç teslim penceresi: son teslim geçti, kesinti penceresi içinde
delete from exams;
update assignments set due_at = now() - interval '30 hours' where id = (select v::uuid from t_vars where k='a1');
set role service_role;
select t_ok((assignment_begin((select v::uuid from t_vars where k='a1'), '00000000-0000-0000-0000-00000000000c')->>'late_days')::int = 2, 'geç gün sayısı (30 saat → 2 gün)');
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok((my_assignments()->0->>'state') = 'late', 'geç teslim durumu');
reset role;
-- pencere de geçti
update assignments set due_at = now() - interval '3 days' where id = (select v::uuid from t_vars where k='a1');
set role service_role;
select t_err($q$ select assignment_begin((select v::uuid from t_vars where k='a1'), '00000000-0000-0000-0000-00000000000c') $q$, 'Teslim süresi doldu');
reset role;
-- geç teslim yoksa son teslimde kapanır
update assignments set due_at = now() - interval '1 minute', settings = settings || '{"late":"none"}' where id = (select v::uuid from t_vars where k='a1');
set role service_role;
select t_err($q$ select assignment_begin((select v::uuid from t_vars where k='a1'), '00000000-0000-0000-0000-00000000000c') $q$, 'Teslim süresi doldu');
reset role;
-- açılış gelecekte
update assignments set due_at = now() + interval '5 days', opens_at = now() + interval '1 day' where id = (select v::uuid from t_vars where k='a1');
set role service_role;
select t_err($q$ select assignment_begin((select v::uuid from t_vars where k='a1'), '00000000-0000-0000-0000-00000000000c') $q$, 'açılacak');
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok((my_assignments()->0->>'state') = 'upcoming', 'yakında');
reset role;
-- kapalı ödev
update assignments set opens_at = now() - interval '1 hour', status = 'closed' where id = (select v::uuid from t_vars where k='a1');
set role service_role;
select t_err($q$ select assignment_begin((select v::uuid from t_vars where k='a1'), '00000000-0000-0000-0000-00000000000c') $q$, 'kapattı');
reset role;

-- gizli sonuç: ödevin GÜNCEL durumuna göre, yalnızca kendi (20261028c)
update assignments set status = 'published', opens_at = now() - interval '2 days', due_at = now() + interval '1 day', settings = settings || '{"late":"none","show_answers":"after_due"}' where id = (select v::uuid from t_vars where k='a1');
insert into exams (id, user_id, assignment_id, completed_at, grade) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', (select v::uuid from t_vars where k='a1'), now(), 50);
insert into exams (id, user_id, assignment_id, completed_at, grade) values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', null, now(), 50);
-- reveal_at geçmiş olsa da ödev hâlâ açıkken görünmez (son teslim uzatılmış olabilir)
insert into exam_hidden_results values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', '[{"correct_answer":"A1"}]', now() - interval '1 hour');
-- ödevi silinmiş sınav: eski reveal_at geçerli
insert into exam_hidden_results values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', '[{"correct_answer":"B1"}]', now() - interval '1 minute');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok((select count(*) from exam_hidden_results) = 1 and (select results->0->>'correct_answer' from exam_hidden_results) = 'B1', 'açık ödevin cevabı görünmez; ödevsiz eski kayıt görünür');
select t_err($q$ insert into exam_hidden_results values ('10000000-0000-0000-0000-000000000002', auth.uid(), '[]', now()) $q$, 'permission');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select t_ok((select count(*) from exam_hidden_results) = 0, 'başkasının sonucu görünmez');
reset role;
-- son teslim geçince açılır
update assignments set due_at = now() - interval '1 minute' where id = (select v::uuid from t_vars where k='a1');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok((select count(*) from exam_hidden_results) = 2, 'son teslim geçince açılır');
reset role;
-- son teslim uzatılınca yeniden kapanır
update assignments set due_at = now() + interval '1 day' where id = (select v::uuid from t_vars where k='a1');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok((select count(*) from exam_hidden_results) = 1, 'son teslim uzayınca yeniden gizli');
reset role;
-- öğretmen erken kapatırsa açılır
update assignments set status = 'closed' where id = (select v::uuid from t_vars where k='a1');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok((select count(*) from exam_hidden_results) = 2, 'kapanınca açılır');
reset role;
-- "hiç": kapansa da görünmez
update assignments set settings = settings || '{"show_answers":"never"}' where id = (select v::uuid from t_vars where k='a1');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok((select count(*) from exam_hidden_results) = 1, 'hiç gösterilmeyecek cevap görünmez');
set role anon;
select t_err($q$ select my_assignments() $q$, 'permission');
reset role;
select 'HEPSI GECTI' as sonuc;
