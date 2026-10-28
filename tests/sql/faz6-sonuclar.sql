-- Faz 6.4 davranış testi: tests/exam-assignment-results.js koşturur (ACADEX_PG verilirse).
-- Sıra: stub → 20261027_… → 20261027b_… → 20261028b_… → 20261028c_… → 20261028e_… → bu dosya
\set ON_ERROR_STOP 1
create or replace function public.t_err(q text, pat text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm !~* pat then raise exception 'beklenen hata "%" ama gelen "%"', pat, sqlerrm; end if; return; end;
  raise exception 'hata bekleniyordu (%): %', pat, q;
end $$;
grant execute on function public.t_err(text, text) to authenticated;
create or replace function public.t_ok(c boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(c, false) then raise exception 'BAŞARISIZ: %', msg; end if; end $$;
grant execute on function public.t_ok(boolean, text) to authenticated;
create table public.t_vars (k text primary key, v text); grant all on public.t_vars to authenticated;
alter table public.exams add column if not exists course_code text, add column if not exists answers jsonb, add column if not exists question_results jsonb,
  add column if not exists questions jsonb, add column if not exists started_at timestamptz default now(), add column if not exists scoring jsonb, add column if not exists teacher_note text;
create table if not exists public.exam_question_feedback (id uuid primary key default gen_random_uuid(), exam_id uuid, question_id int, user_id uuid, kind text, category text,
  status text, reason text, old_score numeric, new_score numeric, details jsonb, created_at timestamptz default now());

update profiles set is_teacher = true where id in ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000e');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into t_vars select 'c1', class_create('FIN201 – A', 'FIN201')->>'id';
reset role;
insert into t_vars select 'code', join_code from classes where id = (select v::uuid from t_vars where k = 'c1');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select class_join((select v from t_vars where k = 'code'));
select class_set_share((select v::uuid from t_vars where k = 'c1'), true);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select class_join((select v from t_vars where k = 'code'));
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into t_vars select 'a1', assignment_create((select v::uuid from t_vars where k='c1'), 'Ödev 1')->>'id';
select assignment_save((select v::uuid from t_vars where k='a1'), 'Ödev 1', '', '{}', '{"show_answers":"never"}',
  '[{"type":"multiple_choice","question":"Soru?","options":["A1","B1"],"correct_answer":"A1"}]', null, now() + interval '2 days');
select assignment_publish((select v::uuid from t_vars where k='a1'));
reset role;
-- C'nin iki sınavı: ödev (gizli sonuçlu) ve aynı dersten kendi denemesi; ayrıca başka ders
insert into exams (id, user_id, assignment_id, attempt_no, completed_at, grade, course_code, question_results, questions, scoring) values
 ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', (select v::uuid from t_vars where k='a1'), 1, now(), 0, 'FIN201',
  '[{"question_id":1,"score":0,"concept":"Faiz","answers_hidden":true}]', '[{"id":1,"src":0,"question":"Soru?"}]', '{"option_count":4,"assignment":{"title":"Ödev 1"}}'),
 ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', null, null, now(), 80, 'fin201', '[{"question_id":1,"score":100,"concept":"Anüite","question":"GİZLİ METİN"}]', null, '{}'),
 ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000c', null, null, now(), 90, 'IKT101', '[{"question_id":1,"score":100,"concept":"Esneklik"}]', null, '{}'),
 ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000d', null, null, now(), 50, 'FIN201', '[{"question_id":1,"score":50,"concept":"Faiz"}]', null, '{}');
insert into exam_hidden_results values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', '[{"question_id":1,"score":0,"concept":"Faiz","correct_answer":"A1"}]', null);
insert into exam_question_feedback (exam_id, question_id, user_id, kind, status, reason) values ('30000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-00000000000c', 'appeal', 'escalated', 'neden yanlış');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select t_ok(exam_teacher_ok('30000000-0000-0000-0000-000000000001'), 'öğretmen ödev sınavına erişir');
select t_ok(not exam_teacher_ok('30000000-0000-0000-0000-000000000002'), 'ödev dışı sınava erişmez');
select t_ok(json_array_length(assignment_results((select v::uuid from t_vars where k='a1'))->'members') = 2, 'üyeler');
select t_ok(json_array_length(assignment_results((select v::uuid from t_vars where k='a1'))->'exams') = 1, 'yalnızca bu ödevin sınavları');
select t_ok((assignment_results((select v::uuid from t_vars where k='a1'))->'exams'->0->'results'->0->>'correct_answer') = 'A1', 'gizli cevaplıda tam sonuç öğretmene');
select t_ok((assignment_results((select v::uuid from t_vars where k='a1'))->'feedback'->0->>'status') = 'escalated', 'itirazlar');
select t_ok(assignment_results((select v::uuid from t_vars where k='a1'))::text !~ 'GİZLİ METİN', 'ödev dışı sınav sızmıyor');
-- ustalık: yalnızca paylaşan öğrenci, yalnızca o ders, metin yok
select t_ok(json_array_length(class_mastery_data((select v::uuid from t_vars where k='c1'))) = 1, 'yalnızca paylaşan öğrenci');
select t_ok(json_array_length(class_mastery_data((select v::uuid from t_vars where k='c1'))->0->'exams') = 2, 'ödev + aynı ders (büyük/küçük harf); başka ders yok');
select t_ok(class_mastery_data((select v::uuid from t_vars where k='c1'))::text !~ 'GİZLİ METİN' and class_mastery_data((select v::uuid from t_vars where k='c1'))::text !~ 'Esneklik', 'soru metni ve başka ders yok');
-- başka öğretmen ve öğrenci erişemez
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select t_err($q$ select assignment_results((select v::uuid from t_vars where k='a1')) $q$, 'senin değil');
select t_err($q$ select class_mastery_data((select v::uuid from t_vars where k='c1')) $q$, 'senin değil');
select t_ok(not exam_teacher_ok('30000000-0000-0000-0000-000000000001'), 'başka öğretmen');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_err($q$ select assignment_results((select v::uuid from t_vars where k='a1')) $q$, 'senin değil');
select t_ok(not exam_teacher_ok('30000000-0000-0000-0000-000000000001'), 'öğrenci öğretmen değil');
-- paylaşım kapanınca ustalık görünmez
select class_set_share((select v::uuid from t_vars where k = 'c1'), false);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select t_ok(json_array_length(class_mastery_data((select v::uuid from t_vars where k='c1'))) = 0, 'onay geri alınınca görünmez');
set role anon;
select t_err($q$ select exam_teacher_ok('30000000-0000-0000-0000-000000000001') $q$, 'permission');
reset role;
select 'HEPSI GECTI' as sonuc;
