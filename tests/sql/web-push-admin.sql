-- Bildirim yönetim paneli davranış testi (tests/web-push.js çalıştırır).
-- Sıra: web-push-stub.sql, 20261028_canli_destek.sql, 20261029_web_push.sql,
-- web-push.sql (veri bırakır), BU dosya. Sonunda "ADMIN PANEL GECTI".
\set ON_ERROR_STOP 1
-- Supabase'de hazır olan parçaların iskeleti (yalnız test)
alter table public.profiles add column if not exists email text;
create schema if not exists vault;
create table if not exists vault.secrets (id serial primary key, name text);
create or replace view vault.decrypted_secrets as select name, null::text as decrypted_secret from vault.secrets;
create schema if not exists cron;
create table if not exists cron.job (jobid serial primary key, jobname text, active boolean default true);
create table if not exists cron.job_run_details (runid serial primary key, jobid int, end_time timestamptz, status text);
-- Supabase yeni fonksiyonlara authenticated için açık EXECUTE verir; aynısını yap
alter default privileges in schema public grant execute on functions to authenticated;
\ir ../../supabase/migrations/20261029b_push_admin.sql
\ir ../../supabase/migrations/20261029b_push_admin.sql

reset role; reset test.admin; reset test.uid;
update profiles set email = 'ayse@ornek.edu.tr' where full_name = 'Ayşe Kaya';
insert into cron.job (jobname) values ('push-flush'), ('push-daily'), ('baska-is');
insert into cron.job_run_details (jobid, end_time, status) values (1, now() - interval '30 seconds', 'succeeded'), (2, now() - interval '5 minutes', 'failed');

-- beş durumun her biri için birer satır (A'nın cihazı + ziyaretçinin cihazı)
delete from push_outbox;
insert into push_outbox (sub_id, kind, title, body, sent_at, send_after, error, tries) select s.id, x.k, x.t, 'metin', x.sent, now() - interval '10 seconds', x.err, x.tr
  from (select id from push_subscriptions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' limit 1) s,
  (values ('like', 'Projen beğenildi', now(), null::text, 1), ('comment', 'Yorum geldi', null::timestamptz, null, 0),
          ('study', 'Serin biter', null, '500 sunucu', 2), ('review', 'Kartlar', null, '403 yasak', 5),
          ('test', 'Deneme', now(), 'eskidi', 1)) x(k, t, sent, err, tr);
insert into push_outbox (sub_id, kind, title, body, sent_at, send_after)
  select id, 'support', 'Acadex destek ekibi yazdı', 'Merhaba', now(), now() from push_subscriptions where support_thread_id is not null limit 1;

-- 1) yönetici olmayan çağıramaz
set test.uid = 'bbbbbbbb-0000-0000-0000-000000000002'; set role authenticated;
do $$ begin perform public.admin_push_stats(); raise exception 'STATS_ACIK'; exception when raise_exception then if sqlerrm <> 'ADMIN' then raise; end if; end $$;
do $$ begin perform public.admin_push_feed(); raise exception 'FEED_ACIK'; exception when raise_exception then if sqlerrm <> 'ADMIN' then raise; end if; end $$;
do $$ begin perform public.push_state(now(), null, 1); raise exception 'YARDIMCI_ACIK'; exception when insufficient_privilege then null; end $$;
reset role; set role anon;
do $$ begin perform public.admin_push_stats(); raise exception 'ANON_STATS'; exception when insufficient_privilege then null; end $$;
reset role;

-- 2) yönetici: durum
select set_config('test.subs', (select count(*) from push_subscriptions)::text, false);
set test.admin = '1'; set role authenticated;
do $$ declare s json := public.admin_push_stats(); begin
  if (s -> 'subs' ->> 'total')::int <> current_setting('test.subs')::int then raise exception 'ABONE_SAYI %', s -> 'subs'; end if;
  if (s -> 'subs' ->> 'visitors')::int <> 1 then raise exception 'ZIYARETCI_SAYI'; end if;
  if (s -> 'subs' -> 'by_platform' ->> 'google') is null then raise exception 'PLATFORM %', s -> 'subs' -> 'by_platform'; end if;
  if (s -> 'last24' ->> 'total')::int <> 6 then raise exception 'SON24 %', s -> 'last24'; end if;
  if (s -> 'last24' ->> 'gitti')::int <> 2 or (s -> 'last24' ->> 'bekliyor')::int <> 1 or (s -> 'last24' ->> 'hata')::int <> 2 or (s -> 'last24' ->> 'atlandi')::int <> 1 then raise exception 'DURUMLAR %', s -> 'last24'; end if;
  if (s -> 'last24' -> 'by_kind' ->> 'like')::int <> 1 then raise exception 'TURLER'; end if;
  if json_array_length(s -> 'series') <> 24 then raise exception 'SERI'; end if;
  if (s -> 'health' ->> 'secret')::boolean then raise exception 'KASA_YOKKEN_VAR'; end if;
  if json_array_length(s -> 'health' -> 'cron') <> 2 then raise exception 'CRON %', s -> 'health' -> 'cron'; end if;
  if s -> 'health' -> 'last_error' ->> 'e' <> '403 yasak' then raise exception 'SON_HATA %', s -> 'health' -> 'last_error'; end if;
  if s::text ~* 'endpoint|p256dh|fcm\.googleapis|web\.push\.apple' then raise exception 'ADRES_SIZDI'; end if;
end $$;
reset role; insert into vault.secrets (name) values ('push_secret'); set role authenticated;
do $$ begin if not (public.admin_push_stats() -> 'health' ->> 'secret')::boolean then raise exception 'KASA_GORULMEDI'; end if; end $$;

-- 3) yönetici: akış ve süzgeçler
do $$ declare f json; begin
  f := public.admin_push_feed();
  if json_array_length(f) <> 6 then raise exception 'AKIS_SAYI %', json_array_length(f); end if;
  if f::text ~* 'endpoint|p256dh|"auth"|fcm\.googleapis|web\.push\.apple|mozilla\.com/wpush' then raise exception 'AKISTA_ADRES'; end if;
  if (select count(*) from json_array_elements(public.admin_push_feed('hata')) e) <> 2 then raise exception 'SUZ_HATA'; end if;
  if (select count(*) from json_array_elements(public.admin_push_feed('hata')) e where e ->> 'state' = 'vazgecildi') <> 1 then raise exception 'VAZGECILDI'; end if;
  if (select count(*) from json_array_elements(public.admin_push_feed('gitti', 'like')) e) <> 1 then raise exception 'SUZ_TUR'; end if;
  if (select count(*) from json_array_elements(public.admin_push_feed(null, null, 'ayşe')) e) <> 5 then raise exception 'ARA_AD'; end if;
  if (select count(*) from json_array_elements(public.admin_push_feed(null, null, 'ornek.edu')) e) <> 5 then raise exception 'ARA_EPOSTA'; end if;
  if (select e ->> 'visitor' from json_array_elements(f) e where e ->> 'kind' = 'support') <> 'Zeynep' then raise exception 'ZIYARETCI_ADI'; end if;
  if (select e ->> 'user_name' from json_array_elements(f) e where e ->> 'kind' = 'like') <> 'Ayşe Kaya' then raise exception 'KULLANICI_ADI'; end if;
  if (select count(*) from json_array_elements(public.admin_push_feed(null, null, null, 2)) e) <> 2 then raise exception 'LIMIT'; end if;
  if (select count(*) from json_array_elements(public.admin_push_feed(null, null, null, 99999)) e) <> 6 then raise exception 'LIMIT_UST'; end if;
end $$;
-- 4) salt okunur: çağrılar hiçbir satırı değiştirmedi
reset role;
do $$ begin if (select count(*) from push_outbox) <> 6 or (select count(*) from push_outbox where sent_at is null) <> 3 then raise exception 'DEGISTI'; end if; end $$;
select 'ADMIN PANEL GECTI' as sonuc;
