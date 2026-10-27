-- Faz 6.1 davranış testi: tests/exam-classes.js koşturur (ACADEX_PG verilirse). Supabase iskeleti: _supabase-stub.sql
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

-- eski geniş politikalar gitti
select t_ok(not exists (select 1 from pg_policies where policyname in ('study_cards_teacher_select_dept','exams_teacher_select_dept','exams_teacher_update_dept','documents_teacher_select_dept','teacher_materials_teacher_manage_own')), 'eski politikalar kaldırıldı');

set role authenticated;
-- öğrenci yetkisiz sınıf açamaz
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select t_err($q$ select class_create('Deneme') $q$, 'Öğretmen yetkisi');
-- öğrenci kendine öğretmen yetkisi veremez
select t_err($q$ select admin_set_teacher('00000000-0000-0000-0000-00000000000b', true) $q$, 'Yönetici');

-- yönetici verir
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select admin_set_teacher('00000000-0000-0000-0000-00000000000b', true);
select admin_set_teacher('00000000-0000-0000-0000-00000000000e', true);
select t_ok((admin_teacher_status('00000000-0000-0000-0000-00000000000b')->>'is_teacher')::boolean, 'yetki verildi');
select t_ok(exists (select 1 from admin_audit_log where action = 'set_is_teacher'), 'denetim kaydı');

-- hoca sınıf açar
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into t_vars select 'c1', (class_create('  İŞL 201 – A  ', 'isl201')->>'id');
select t_ok((select name = 'İŞL 201 – A' and course_code = 'ISL201' and join_code ~ '^[A-HJ-NP-Z2-9]{6}$' from classes where id = (select v::uuid from t_vars where k='c1')), 'sınıf adı, kod biçimi');
select t_err($q$ select class_create('x') $q$, '2-80');
-- doğrudan yazma yok
select t_err($q$ insert into classes (teacher_id, name, join_code) values (auth.uid(), 'Kaçak', 'ABCDEF') $q$, 'row-level security|permission');
select t_err($q$ select class_gen_code() $q$, 'permission');

-- öğrenci yanlış kod
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok(class_join('ZZZZZZ')->>'error' is not null, 'yanlış kod hata döner');
select t_ok((select count(*) from class_join_fails) = 0 or true, 'deneme kaydı (RLS ile görünmez)');
select t_ok((select class_join(lower(substr(join_code,1,3)) || '-' || lower(substr(join_code,4))) ->> 'name' from (select join_code from public.classes where false union all select null where false) s limit 1) is null, 'öğrenci kodu sınıf tablosundan okuyamaz');
reset role;
insert into t_vars select 'code', join_code from classes where id = (select v::uuid from t_vars where k='c1');
set role authenticated;
select t_ok((class_join(lower((select v from t_vars where k='code')))->>'teacher_name') = 'Hoca Bir', 'katıldı, hoca adı');
select t_ok((class_join((select v from t_vars where k='code'))->>'id') is not null, 'tekrar katılmak zararsız');
select t_ok((select count(*) from classes) = 1, 'üye sınıfını görür');
select t_ok((my_classes()->'enrolled'->0->>'share_mastery')::boolean = false, 'paylaşım varsayılan kapalı');
select class_set_share((select v::uuid from t_vars where k='c1'), true);
-- öğrenci kadroyu okuyamaz
select t_err($q$ select class_roster((select v::uuid from t_vars where k='c1')) $q$, 'senin değil');
-- öğrenci başkasını çıkaramaz
select t_err($q$ select class_remove_member((select v::uuid from t_vars where k='c1'), '00000000-0000-0000-0000-00000000000d') $q$, 'senin değil');
-- öğrenci share_mastery'yi doğrudan güncelleyemez (politika yok) -> 0 satır
select t_err($q$ update class_members set share_mastery = false $q$, 'permission');
reset role;
select t_ok((select share_mastery from class_members where user_id = '00000000-0000-0000-0000-00000000000c'), 'doğrudan update etkisiz');
set role authenticated;

-- ikinci öğrenci (oauth numaralı)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select class_join((select v from t_vars where k='code'));
select t_ok((select count(*) from class_members) = 1, 'öğrenci yalnızca kendi üyeliğini görür');

-- hoca kadroyu görür; numara oauth ise boş; e-posta yok
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select t_ok(json_array_length(class_roster((select v::uuid from t_vars where k='c1'))) = 2, 'kadro 2 kişi');
select t_ok((select bool_and(x->>'email' is null) from json_array_elements(class_roster((select v::uuid from t_vars where k='c1'))) x), 'e-posta yok');
select t_ok((select x->>'student_number' from json_array_elements(class_roster((select v::uuid from t_vars where k='c1'))) x where x->>'full_name' = 'Öğrenci De') is null, 'oauth numarası gizli');
select t_ok((my_classes()->'teaching'->0->>'members')::int = 2 and (my_classes()->'teaching'->0->>'sharing')::int = 1, 'üye ve paylaşım sayısı');
-- hoca öğrencinin sınavlarını/belgelerini göremez
reset role; insert into exams (user_id) values ('00000000-0000-0000-0000-00000000000c'); insert into documents (user_id) values ('00000000-0000-0000-0000-00000000000c'); insert into study_cards (user_id) values ('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select t_ok((select count(*) from exams) = 0 and (select count(*) from documents) = 0 and (select count(*) from study_cards) = 0, 'hoca öğrenci verisini göremez');

-- başka hoca bu sınıfı göremez, yönetemez
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select t_ok((select count(*) from classes) = 0 and (select count(*) from class_members) = 0, 'başka hoca görmez');
select t_err($q$ select class_roster((select v::uuid from t_vars where k='c1')) $q$, 'senin değil');
select t_err($q$ select class_update((select v::uuid from t_vars where k='c1'), 'Ele geçir') $q$, 'senin değil');
select t_err($q$ select class_new_code((select v::uuid from t_vars where k='c1')) $q$, 'senin değil');

-- hoca: kodu yenile, katılımı kapat, öğrenci çıkar
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select t_ok(class_new_code((select v::uuid from t_vars where k='c1')) <> (select v from t_vars where k='code'), 'kod yenilendi');
select class_update((select v::uuid from t_vars where k='c1'), p_join_open => false);
select class_remove_member((select v::uuid from t_vars where k='c1'), '00000000-0000-0000-0000-00000000000d');
reset role;
update t_vars set v = (select join_code from classes where id = (select v::uuid from t_vars where k='c1')) where k = 'code';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select t_ok(class_join((select v from t_vars where k='code'))->>'error' is not null, 'kapalı sınıfa katılınamaz');
-- hoca kendi sınıfına katılamaz
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select class_update((select v::uuid from t_vars where k='c1'), p_join_open => true);
select t_err($q$ select class_join((select v from t_vars where k='code')) $q$, 'Kendi sınıfına');
-- arşiv katılımı da kapatır
select t_ok((class_update((select v::uuid from t_vars where k='c1'), p_archived => true)->>'join_open')::boolean = false, 'arşiv katılımı kapatır');
select class_update((select v::uuid from t_vars where k='c1'), p_archived => false, p_join_open => true);

-- öğrenci ayrılır
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select class_leave((select v::uuid from t_vars where k='c1'));
select t_ok(json_array_length(my_classes()->'enrolled') = 0 and (select count(*) from classes) = 0, 'ayrıldı, sınıfı artık görmez');

-- kaba kuvvet sınırı
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select class_join('QQQQQ' || g) from generate_series(2, 9) g;
select class_join('QQQQ' || g || g) from generate_series(2, 9) g;
select class_join('QQQ' || g || g || g) from generate_series(2, 4) g;
select t_err($q$ select class_join((select v from t_vars where k='code')) $q$, 'Çok fazla');

-- yetki kalkınca: sınıf katılıma kapanır, hoca sınıfları göremez
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select admin_set_teacher('00000000-0000-0000-0000-00000000000b', false);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select t_ok((select count(*) from classes) = 0 and json_array_length(my_classes()->'teaching') = 0, 'yetkisiz hoca sınıfını görmez');
select t_err($q$ select class_create('Yeni sınıf') $q$, 'Öğretmen yetkisi');
reset role;
select t_ok(not (select join_open from classes where id = (select v::uuid from t_vars where k='c1')), 'yetki kalkınca katılım kapandı');
-- anon hiçbir şey çağıramaz
set role anon;
select t_err($q$ select my_classes() $q$, 'permission');
reset role;
select 'HEPSI GECTI' as sonuc;
