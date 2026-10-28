-- Web Push davranış senaryosu (tests/web-push.js çalıştırır). Sırayla: web-push-stub.sql,
-- 20261028_canli_destek.sql, 20261029_web_push.sql, bu dosya. Sonunda "TUM SENARYOLAR GECTI".
\set ON_ERROR_STOP 1
-- kullanıcılar: A (proje sahibi), B, C
insert into auth.users values ('aaaaaaaa-0000-0000-0000-000000000001'),('bbbbbbbb-0000-0000-0000-000000000002'),('cccccccc-0000-0000-0000-000000000003');
insert into profiles (id, full_name, current_streak, last_active_date) values
 ('aaaaaaaa-0000-0000-0000-000000000001','Ayşe Kaya',5,(now() at time zone 'Europe/Istanbul')::date - 1),
 ('bbbbbbbb-0000-0000-0000-000000000002','Berk Can',0,null),
 ('cccccccc-0000-0000-0000-000000000003','Ceren',2,(now() at time zone 'Europe/Istanbul')::date);
insert into sandbox_projects (id,user_id,title) values ('dddddddd-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Kalp Atlası');

-- 1) güvenlik: anonim abone olamaz, kötü adres reddedilir
set role anon;
do $$ begin perform public.push_subscribe('https://fcm.googleapis.com/fcm/send/x','k','a'); raise exception 'ANON_GECTI'; exception when insufficient_privilege then null; end $$;
reset role;
set test.uid = 'aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated;
do $$ begin perform public.push_subscribe('https://evil.example.com/x', repeat('B',87), repeat('a',22)); raise exception 'KOTU_ADRES_GECTI'; exception when raise_exception then if sqlerrm <> 'PUSH_ADRES' then raise; end if; end $$;
do $$ begin perform public.push_subscribe('http://fcm.googleapis.com/fcm/send/x', repeat('B',87), repeat('a',22)); raise exception 'HTTP_GECTI'; exception when raise_exception then if sqlerrm <> 'PUSH_ADRES' then raise; end if; end $$;
do $$ begin perform public.push_subscribe('https://fcm.googleapis.com.evil.com/x', repeat('B',87), repeat('a',22)); raise exception 'ALT_ALAN_GECTI'; exception when raise_exception then if sqlerrm <> 'PUSH_ADRES' then raise; end if; end $$;
-- tablolara doğrudan erişim yok
do $$ begin perform 1 from public.push_subscriptions; raise exception 'TABLO_OKUNDU'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.push_claim(10); raise exception 'CLAIM_GECTI'; exception when insufficient_privilege then null; end $$;
-- A iki cihaz
select public.push_subscribe('https://fcm.googleapis.com/fcm/send/A1', repeat('B',87), repeat('a',22), 'Android');
select public.push_subscribe('https://web.push.apple.com/QA2', repeat('C',87), repeat('b',22), 'iPhone');
select public.push_has('https://web.push.apple.com/QA2') as a_has;
reset role;
set test.uid = 'bbbbbbbb-0000-0000-0000-000000000002'; set role authenticated;
select public.push_subscribe('https://updates.push.services.mozilla.com/wpush/v2/B1', repeat('D',87), repeat('c',22));
reset role;

-- 2) beğeniler: B ve C beğenir → A'nın her cihazına tek satır, n=2, gövde güncel
insert into sandbox_project_likes (project_id,user_id) values ('dddddddd-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002');
insert into sandbox_project_likes (project_id,user_id) values ('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003');
-- kendi beğenisi bildirim üretmez
insert into sandbox_project_likes (project_id,user_id) values ('dddddddd-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001');
select kind, n, body from push_outbox order by id;
do $$ begin if (select count(*) from push_outbox where kind='like') <> 2 then raise exception 'LIKE_SATIR %', (select count(*) from push_outbox); end if;
 if exists (select 1 from push_outbox where kind='like' and (n<>2 or body not like 'Ceren ve 1 kişi daha%')) then raise exception 'LIKE_GRUPLAMA'; end if; end $$;

-- 3) yorum + cevap; B yorumunu B'ye cevap olarak C yazar
insert into sandbox_project_comments (id,project_id,user_id,content) values ('eeeeeeee-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Harika   olmuş,
elinize sağlık');
insert into sandbox_project_comments (project_id,user_id,content,parent_id) values ('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','Katılıyorum','eeeeeeee-0000-0000-0000-000000000001');
select s.ua, o.kind, o.title, o.body from push_outbox o join push_subscriptions s on s.id=o.sub_id where kind='comment' order by o.id;
do $$ begin
 if (select count(*) from push_outbox o join push_subscriptions s on s.id=o.sub_id where kind='comment' and s.user_id='aaaaaaaa-0000-0000-0000-000000000001') <> 4 then raise exception 'YORUM_SAHIBE'; end if;
 if (select count(*) from push_outbox o join push_subscriptions s on s.id=o.sub_id where kind='comment' and s.user_id='bbbbbbbb-0000-0000-0000-000000000002' and title='Ceren yorumuna cevap verdi') <> 1 then raise exception 'CEVAP'; end if;
 if exists (select 1 from push_outbox where body like '%' || chr(10) || '%') then raise exception 'SATIR_SONU'; end if; end $$;

-- 4) tercih: A beğenileri kapatır → yeni beğeni bildirimi yok
update profiles set notification_prefs = '{"likes":false}' where id='aaaaaaaa-0000-0000-0000-000000000001';
delete from sandbox_project_likes where user_id='bbbbbbbb-0000-0000-0000-000000000002';
delete from push_outbox where kind='like';
insert into sandbox_project_likes (project_id,user_id) values ('dddddddd-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin if exists (select 1 from push_outbox where kind='like') then raise exception 'TERCIH_YOK_SAYILDI'; end if; end $$;
update profiles set notification_prefs = null where id='aaaaaaaa-0000-0000-0000-000000000001';

-- 5) tetikleyici hatası beğeniyi bozmaz (sandbox_projects'i geçici bozarak)
alter table push_outbox add constraint tmp_fail check (kind <> 'like');
insert into sandbox_project_likes (project_id,user_id) values ('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003') on conflict do nothing;
delete from sandbox_project_likes where user_id='cccccccc-0000-0000-0000-000000000003';
insert into sandbox_project_likes (project_id,user_id) values ('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003');
do $$ begin if not exists (select 1 from sandbox_project_likes where user_id='cccccccc-0000-0000-0000-000000000003') then raise exception 'BEGENI_BOZULDU'; end if; end $$;
alter table push_outbox drop constraint tmp_fail;

-- 6) günlük: saati şimdiki saate ayarla; A dün geldi seri 5, 3 kart bekliyor, yarın sınav
delete from push_outbox;
update profiles set notification_prefs = jsonb_build_object('study_hour', extract(hour from now() at time zone 'Europe/Istanbul')::int) where id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002');
insert into card_item_confidence (user_id,next_review_at) select 'aaaaaaaa-0000-0000-0000-000000000001', now()-interval '1 hour' from generate_series(1,3);
insert into study_events (user_id,title,event_date,event_type) values ('aaaaaaaa-0000-0000-0000-000000000001','Anatomi vizesi',(now() at time zone 'Europe/Istanbul')::date+1,'exam');
select public.push_daily() as gunluk;
select public.push_daily() as gunluk_tekrar;  -- aynı gün ikinci kez: yeni satır yok
select o.kind, o.title, o.body, s.ua from push_outbox o join push_subscriptions s on s.id=o.sub_id order by o.id;
do $$ begin
 if (select count(*) from push_outbox where kind='study' and title='5 günlük serin bu gece biter' and body like '%3 kart tekrarını bekliyor.') <> 2 then raise exception 'SERI'; end if;
 if (select count(*) from push_outbox where kind='exam') <> 2 then raise exception 'SINAV'; end if;
 -- B hiç gelmemiş (last_active null) → seri notu yok, kartı da yok → hiçbir şey
 if exists (select 1 from push_outbox o join push_subscriptions s on s.id=o.sub_id where s.user_id='bbbbbbbb-0000-0000-0000-000000000002') then raise exception 'ISRAR'; end if;
 if (select max(n) from push_outbox) <> 1 then null; end if; end $$;
-- study kapalı + kart var → review notu gelir
delete from push_outbox; update profiles set notification_prefs = notification_prefs || '{"study":false}' where id='aaaaaaaa-0000-0000-0000-000000000001';
select public.push_daily();
do $$ begin if (select count(*) from push_outbox where kind='review' and title='3 kart seni bekliyor') <> 2 then raise exception 'REVIEW %', (select string_agg(kind||':'||title, ' | ') from push_outbox); end if;
 if exists (select 1 from push_outbox where kind='exam') then raise exception 'SINAV_STUDY_KAPALI'; end if; end $$;

-- 7) gönderici: claim + done; gone aboneliği siler; hata tekrar denenir
delete from push_outbox;
set test.uid = 'aaaaaaaa-0000-0000-0000-000000000001'; set role authenticated; select public.push_test(); select public.push_test() as ayni_dakika; reset role;
set role service_role;
select id, kind, endpoint from public.push_claim(50) order by id;
reset role;
do $$ declare a bigint; b bigint; begin
  select min(id), max(id) into a, b from push_outbox;
  if (select count(*) from push_outbox where claimed_at is not null) <> 2 then raise exception 'CLAIM_SAYI'; end if;
  perform public.push_done(jsonb_build_array(jsonb_build_object('id',a,'ok',true), jsonb_build_object('id',b,'gone',true)));
  if not exists (select 1 from push_outbox where id=a and sent_at is not null) then raise exception 'OK_YAZILMADI'; end if;
  if exists (select 1 from push_subscriptions where endpoint='https://web.push.apple.com/QA2') and exists (select 1 from push_outbox where id=b) then raise exception 'GONE_SILINMEDI'; end if;
end $$;
select count(*) as a_kalan_cihaz from push_subscriptions where user_id='aaaaaaaa-0000-0000-0000-000000000001';

-- 8) destek: ziyaretçi görüşme açar, abone olur; admin cevaplar → 20 sn sonra; okunduysa gönderilmez
reset test.uid;
set role anon;
select public.support_open(repeat('t',48), 'Zeynep', null, 'genel', '/') is not null as acildi;
select public.support_push_subscribe(repeat('t',48), 'https://fcm.googleapis.com/fcm/send/V1', repeat('E',87), repeat('d',22));
do $$ begin perform public.support_push_subscribe(repeat('x',48), 'https://fcm.googleapis.com/fcm/send/V2', repeat('E',87), repeat('d',22)); raise exception 'YABANCI_ANAHTAR'; exception when raise_exception then if sqlerrm not in ('DESTEK_YOK') then raise; end if; end $$;
reset role;
set test.admin = '1'; set test.uid = 'cccccccc-0000-0000-0000-000000000003';
delete from push_outbox;
select public.admin_support_reply((select id from support_threads limit 1), 'Merhaba Zeynep, hemen bakıyorum.');
do $$ begin if (select count(*) from push_outbox where kind='support' and send_after > now()) <> 1 then raise exception 'DESTEK_KUYRUK'; end if; end $$;
update push_outbox set send_after = now() - interval '1 second';
set role service_role; select count(*) as destek_claim from public.push_claim(10); reset role;
-- okunmuş senaryo
update push_outbox set sent_at=null, claimed_at=null, tries=0, error=null;
update support_threads set visitor_unread = 0;
set role service_role; select count(*) as okunduysa_claim from public.push_claim(10); reset role;
select error from push_outbox where kind='support';
do $$ begin if (select error from push_outbox where kind='support') <> 'goruldu' then raise exception 'GORULDU'; end if; end $$;
select 'TUM SENARYOLAR GECTI' as sonuc;
