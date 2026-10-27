-- Faz 6.2 davranış testi: tests/exam-assignments.js koşturur (ACADEX_PG verilirse).
-- Sıra: _supabase-stub.sql → 20261027_sinav_faz6_siniflar.sql → 20261027b_sinav_faz6_odevler.sql → bu dosya
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

-- hazırlık: B ve E öğretmen; B'nin sınıfına C katılır
update profiles set is_teacher = true where id in ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000e');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into t_vars select 'c1', class_create('FIN201 – A')->>'id';
reset role;
insert into t_vars select 'code', join_code from classes where id = (select v::uuid from t_vars where k = 'c1');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select class_join((select v from t_vars where k = 'code'));

-- öğrenci: taslak üretme hakkı yok, ödev açamaz
select t_ok(assignment_gen_take() = false, 'öğrenciye taslak yok');
select t_err($q$ select assignment_create((select v::uuid from t_vars where k='c1'), 'Ödev 1') $q$, 'senin değil');

-- öğretmen: taslak hakkı, saatte 20
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select t_ok(assignment_gen_take(), 'öğretmene taslak');
select assignment_gen_take() from generate_series(1, 19);
select t_ok(assignment_gen_take() = false, '21. taslak reddedilir');

-- ödev aç
insert into t_vars select 'a1', assignment_create((select v::uuid from t_vars where k='c1'), '  1. hafta: arz-talep  ')->>'id';
select t_ok((select title = '1. hafta: arz-talep' and status = 'draft' from assignments where id = (select v::uuid from t_vars where k='a1')), 'taslak açıldı');
select t_err($q$ select assignment_create((select v::uuid from t_vars where k='c1'), 'x') $q$, '2-120');

-- kaydet: soru doğrulama
select t_err($q$ select assignment_save((select v::uuid from t_vars where k='a1'), 'Ödev', '', '{}', '{}', '[{"type":"essay","question":"Nedir?"}]', null, null) $q$, 'türü tanınmadı');
select t_err($q$ select assignment_save((select v::uuid from t_vars where k='a1'), 'Ödev', '', '{}', '{}', jsonb_build_array(jsonb_build_object('type','open_ended','question',repeat('a', 4001))), null, null) $q$, 'en çok 4000');
-- boş metin taslakta serbest, yayında değil
select assignment_save((select v::uuid from t_vars where k='a1'), 'Ödev', '', '{}', '{}', '[{"type":"open_ended","question":"  "}]', null, now() + interval '2 days');
select t_err($q$ select assignment_publish((select v::uuid from t_vars where k='a1')) $q$, 'metni boş');
select t_err($q$ select assignment_save((select v::uuid from t_vars where k='a1'), 'Ödev', '', '{}', '{}', '"x"', null, null) $q$, 'okunamadı');
select t_err($q$ select assignment_save((select v::uuid from t_vars where k='a1'), 'Ödev', '', '{}', '{}', '[]', now() + interval '2 days', now() + interval '1 day') $q$, 'Açılış');
select t_err($q$ select assignment_save((select v::uuid from t_vars where k='a1'), 'Ödev', '', '{}', '{}', (select jsonb_agg(jsonb_build_object('type','open_ended','question','Soru ' || g)) from generate_series(1, 41) g), null, null) $q$, '40 soru');

-- kaydet: ayarlar temizlenir
select assignment_save((select v::uuid from t_vars where k='a1'), '1. hafta: arz-talep', 'Kitap açık değil.',
  '{"type":"study_card","study_card_id":"x"}',
  '{"time_limit_minutes": 2, "attempts": 9, "late": "penalty", "late_penalty_pct": 80, "show_answers": "hack", "vary_numbers": true, "evil": 1, "scoring": {"option_count": 5, "negative_marking": true, "wrong_per_correct": 4, "decimal_places": 7}}',
  '[{"type":"multiple_choice","question":"Talep artarsa fiyat?","options":["Artar","Azalır","Değişmez","Sıfır"],"correct_answer":"Artmaz"},
    {"type":"true_false","question":"Arz eğrisi pozitif eğimlidir.","options":["Doğru","Yanlış"],"correct_answer":"Doğru"},
    {"type":"open_ended","question":"Fırsat maliyetini açıkla."}]', null, null);
reset role;
select t_ok((select settings->'time_limit_minutes' = '5' and settings->'attempts' = '3' and settings->>'late' = 'penalty'
  and settings->'late_penalty_pct' = '50' and settings->>'show_answers' = 'after_due' and settings->'vary_numbers' = 'true'
  and not settings ? 'evil' and settings->'scoring'->'option_count' = '5' and settings->'scoring'->'negative_marking' = 'true'
  and settings->'scoring'->'wrong_per_correct' = '4' and not (settings->'scoring') ? 'decimal_places'
  from assignments where id = (select v::uuid from t_vars where k='a1')), 'ayarlar sınırlara çekildi');
set role authenticated;

-- öğrenci ödev tablosunu okuyamaz (cevap anahtarı)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_ok((select count(*) from assignments) = 0, 'öğrenci ödev satırı görmez');
select t_err($q$ select assignment_publish((select v::uuid from t_vars where k='a1')) $q$, 'senin değil');
select t_err($q$ select assignment_save((select v::uuid from t_vars where k='a1'), 'X ödev', '', '{}', '{}', '[]', null, null) $q$, 'senin değil');
-- doğrudan yazma yok
select t_err($q$ update assignments set status = 'published' $q$, 'permission');
-- başka öğretmen görmez, yönetemez
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select t_ok((select count(*) from assignments) = 0, 'başka öğretmen görmez');
select t_err($q$ select assignment_delete((select v::uuid from t_vars where k='a1')) $q$, 'senin değil');

-- yayın denetimleri
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select t_ok((select count(*) from assignments) = 1, 'öğretmen kendi ödevini görür');
select t_err($q$ select assignment_publish((select v::uuid from t_vars where k='a1')) $q$, 'doğru şık seçilmedi');
select assignment_save((select v::uuid from t_vars where k='a1'), '1. hafta: arz-talep', '', '{}', '{"attempts":2}',
  '[{"type":"multiple_choice","question":"Talep artarsa fiyat?","options":["Artar","Azalır","Değişmez","Sıfır"],"correct_answer":"Artar"},
    {"type":"fill_blank","question":"Esneklik ___ değişimdir.","correct_answer":""}]', null, null);
select t_err($q$ select assignment_publish((select v::uuid from t_vars where k='a1')) $q$, 'doğru cevabı boş');
select assignment_save((select v::uuid from t_vars where k='a1'), '1. hafta: arz-talep', '', '{}', '{"attempts":2}',
  '[{"type":"multiple_choice","question":"Talep artarsa fiyat?","options":["Artar","Artar ","Değişmez"],"correct_answer":"Artar"}]', null, null);
select t_err($q$ select assignment_publish((select v::uuid from t_vars where k='a1')) $q$, 'aynı şık');
select assignment_save((select v::uuid from t_vars where k='a1'), '1. hafta: arz-talep', '', '{}', '{"attempts":2}',
  '[{"type":"multiple_choice","question":"Talep artarsa fiyat?","options":["Artar","Azalır","Değişmez","Sıfır"],"correct_answer":"Artar"},
    {"type":"graph","question":"Arz eğrisini çiz.","graph_answer":{"objects":[]}},
    {"type":"open_ended","question":"Fırsat maliyetini açıkla."}]', null, null);
select t_err($q$ select assignment_publish((select v::uuid from t_vars where k='a1')) $q$, 'Son teslim');
select assignment_save((select v::uuid from t_vars where k='a1'), '1. hafta: arz-talep', '', '{}', '{"attempts":2}',
  (select questions from assignments where id = (select v::uuid from t_vars where k='a1')), null, now() + interval '3 days');
select t_ok((assignment_publish((select v::uuid from t_vars where k='a1'))->>'status') = 'published', 'yayınlandı');
select t_ok((select opens_at is not null and published_at is not null from assignments where id = (select v::uuid from t_vars where k='a1')), 'açılış şimdi');
select t_err($q$ select assignment_publish((select v::uuid from t_vars where k='a1')) $q$, 'zaten yayında');
select t_err($q$ select assignment_save((select v::uuid from t_vars where k='a1'), 'Değişti', '', '{}', '{}', '[]', null, now() + interval '3 days') $q$, 'değiştirilemez');
select t_err($q$ select assignment_delete((select v::uuid from t_vars where k='a1')) $q$, 'Yalnızca taslak');

-- tarih uzat, kapat, yeniden aç
select t_ok((assignment_set_dates((select v::uuid from t_vars where k='a1'), now() + interval '5 days', now() + interval '6 days')->>'opens_at')::timestamptz < now() + interval '1 minute', 'yayındaki açılış ileri alınamaz');
select t_err($q$ select assignment_set_dates((select v::uuid from t_vars where k='a1'), null, null) $q$, 'Son teslim gerekli');
select assignment_close((select v::uuid from t_vars where k='a1'));
select t_ok((select status = 'closed' from assignments where id = (select v::uuid from t_vars where k='a1')), 'kapandı');
select t_err($q$ select assignment_close((select v::uuid from t_vars where k='a1')) $q$, 'Yalnızca yayındaki');
select t_ok((assignment_set_dates((select v::uuid from t_vars where k='a1'), null, now() + interval '2 days')->>'status') = 'published', 'süre uzayınca yeniden yayında');

-- taslak silinir
insert into t_vars select 'a2', assignment_create((select v::uuid from t_vars where k='c1'), 'Silinecek taslak')->>'id';
select assignment_delete((select v::uuid from t_vars where k='a2'));
select t_ok((select count(*) from assignments) = 1, 'taslak silindi');

-- arşivdeki sınıfa ödev yok
select class_update((select v::uuid from t_vars where k='c1'), p_archived => true);
select t_err($q$ select assignment_create((select v::uuid from t_vars where k='c1'), 'Arşive ödev') $q$, 'Arşivdeki');

-- yetki kalkınca öğretmen ödevini göremez
reset role;
update profiles set is_teacher = false where id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select t_ok((select count(*) from assignments) = 0 and assignment_gen_take() = false, 'yetkisiz öğretmen göremez');
set role anon;
select t_err($q$ select assignment_gen_take() $q$, 'permission');
reset role;
select 'HEPSI GECTI' as sonuc;
