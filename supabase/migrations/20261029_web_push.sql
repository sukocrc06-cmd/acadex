-- ============================================================================
-- ACADEX TELEFON BİLDİRİMLERİ — WEB PUSH (29.10.2026)
-- Ücretsiz, kendi sistemimiz: tarayıcının push servisi (Google/Mozilla/Apple/
-- Microsoft) + bu tablolar + "send-push" edge function'ı.
--
-- Akış:
--   1. Kullanıcı Ayarlar → Bildirimler'de "Bu cihaza bildirim aç"a basar; tarayıcı
--      bir abonelik (endpoint + anahtarlar) verir → push_subscribe().
--      Landing'deki destek ziyaretçisi giriş yapmaz; görüşme anahtarıyla
--      support_push_subscribe() çağırır.
--   2. Olay olunca (beğeni, yorum, destek cevabı) tetikleyici push_outbox'a satır
--      yazar ve gönderici fonksiyonu pg_net ile dürter (push_kick).
--      Günlük hatırlatmalar (seri, tekrar kartları, yarınki sınav) pg_cron'la
--      her 15 dakikada push_daily() tarafından, kullanıcının seçtiği saatte kuyruğa
--      eklenir. push_flush() her dakika bekleyen iş varsa fonksiyonu dürter.
--   3. send-push kuyruğu push_claim() ile alır, web-push ile gönderir, sonucu
--      push_done() ile yazar. Silinmiş abonelikler (404/410) temizlenir.
--
-- Güvenlik:
--   * Tablolarda RLS açık, HİÇ politika yok; anon/authenticated doğrudan erişemez.
--   * Endpoint yalnız bilinen push servislerine izin verir (SSRF koruması).
--   * push_claim / push_done yalnız service_role (edge function) çalıştırabilir.
--   * pg_net çağrısındaki gizli anahtar Vault'ta ("push_secret"); kodda yok.
--   * Tetikleyiciler hata verse bile beğeni/yorum/mesaj kaydı ASLA bozulmaz.
-- Tercihler profiles.notification_prefs içinde: likes, comments, study, review
-- (false = kapalı, yok = açık) ve study_hour (0–23, varsayılan 20, İstanbul saati).
-- Bu dosya SQL Editor'de bir kez çalıştırılır; tekrar çalıştırmak güvenlidir.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  support_thread_id uuid references public.support_threads(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 60 and 120),
  auth text not null check (char_length(auth) between 12 and 48),
  ua text check (ua is null or char_length(ua) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fails int not null default 0,
  check (user_id is not null or support_thread_id is not null)
);
create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);
create index if not exists push_subs_thread_idx on public.push_subscriptions (support_thread_id);

create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  sub_id uuid not null references public.push_subscriptions(id) on delete cascade,
  kind text not null,
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 300),
  url text not null default '/dashboard.html',
  tag text,
  dedupe text,
  n int not null default 1,
  created_at timestamptz not null default now(),
  send_after timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  tries int not null default 0,
  error text
);
create unique index if not exists push_outbox_dedupe_idx on public.push_outbox (sub_id, dedupe);
create index if not exists push_outbox_pending_idx on public.push_outbox (send_after) where sent_at is null;

alter table public.push_subscriptions enable row level security;
alter table public.push_outbox enable row level security;
revoke all on public.push_subscriptions, public.push_outbox from anon, authenticated;

-- ---------- yardımcılar ----------
-- yalnız bilinen push servisleri (başka adrese istek atılamaz)
create or replace function public.push_endpoint_ok(p text) returns boolean
language sql immutable as $$
  select p is not null and char_length(p) <= 1000 and p ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/[A-Za-z0-9_\-./:%~=+]+$'
$$;

create or replace function public.push_key_ok(p text, lo int, hi int) returns boolean
language sql immutable as $$
  select p is not null and char_length(p) between lo and hi and p ~ '^[A-Za-z0-9_\-+/=]+$'
$$;

-- kullanıcı bu türü kapattı mı? (yok = açık)
create or replace function public.push_pref_ok(p_uid uuid, p_kind text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_kind in ('test', 'support') then true
    else coalesce((select coalesce(notification_prefs, '{}'::jsonb) ->> (case p_kind
           when 'like' then 'likes' when 'comment' then 'comments'
           when 'exam' then 'study' else p_kind end)
         from public.profiles where id = p_uid), 'true') <> 'false'
  end
$$;

-- gönderici fonksiyonu dürt (pg_net, eşzamansız). Gizli anahtar yoksa sessizce geçer.
create or replace function public.push_kick() returns void
language plpgsql security definer set search_path = public as $$
declare s text; u text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'push_secret' limit 1;
  if s is null then return; end if;
  select decrypted_secret into u from vault.decrypted_secrets where name = 'push_url' limit 1;
  perform net.http_post(
    url := coalesce(u, 'https://yrcdvcsowblzmkpbmkut.supabase.co/functions/v1/send-push'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000);
exception when others then
  raise warning 'push_kick: %', sqlerrm;
end $$;

-- bekleyen ve zamanı gelmiş iş varsa dürt (pg_cron her dakika)
create or replace function public.push_flush() returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.push_outbox where sent_at is null and send_after <= now() and tries < 5) then
    perform public.push_kick();
  end if;
end $$;

-- bir kullanıcının tüm cihazlarına kuyruk satırı (tercih kapalıysa 0)
create or replace function public.push_enqueue_user(p_uid uuid, p_kind text, p_title text, p_body text,
  p_url text default '/dashboard.html', p_dedupe text default null, p_tag text default null)
returns int language plpgsql security definer set search_path = public as $$
declare k int := 0;
begin
  if p_uid is null or not public.push_pref_ok(p_uid, p_kind) then return 0; end if;
  insert into public.push_outbox (sub_id, kind, title, body, url, dedupe, tag)
  select s.id, p_kind, left(p_title, 120), left(p_body, 300), coalesce(p_url, '/dashboard.html'), p_dedupe, coalesce(p_tag, p_kind)
  from public.push_subscriptions s where s.user_id = p_uid
  on conflict (sub_id, dedupe) do update
    set title = excluded.title, body = excluded.body, n = public.push_outbox.n + 1
    where public.push_outbox.sent_at is null;
  get diagnostics k = row_count;
  return k;
end $$;

-- kuyruğa her eklemede gönderici dürtülür (ifade başına bir kez)
create or replace function public.push_outbox_kick_tg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.push_kick();
  return null;
end $$;
drop trigger if exists push_outbox_kick on public.push_outbox;
create trigger push_outbox_kick after insert on public.push_outbox
  for each statement execute function public.push_outbox_kick_tg();

-- ---------- kullanıcı (giriş yapmış) ----------
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'PUSH_GIRIS'; end if;
  if not public.push_endpoint_ok(p_endpoint) then raise exception 'PUSH_ADRES'; end if;
  if not public.push_key_ok(p_p256dh, 60, 120) or not public.push_key_ok(p_auth, 12, 48) then raise exception 'PUSH_ANAHTAR'; end if;
  -- kişi başı en çok 10 cihaz: fazlası en eskiden silinir
  delete from public.push_subscriptions where id in (
    select id from public.push_subscriptions where user_id = uid and endpoint <> p_endpoint
    order by updated_at desc offset 9);
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, ua)
  values (uid, p_endpoint, p_p256dh, p_auth, left(p_ua, 200))
  on conflict (endpoint) do update set user_id = uid, p256dh = excluded.p256dh, auth = excluded.auth,
    ua = excluded.ua, fails = 0, updated_at = now();
  return json_build_object('ok', true);
end $$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'PUSH_GIRIS'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid() and support_thread_id is null;
  update public.push_subscriptions set user_id = null where endpoint = p_endpoint and user_id = auth.uid();
end $$;

create or replace function public.push_has(p_endpoint text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid())
$$;

-- "Deneme bildirimi gönder": dakikada en fazla bir
create or replace function public.push_test()
returns int language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'PUSH_GIRIS'; end if;
  return public.push_enqueue_user(auth.uid(), 'test', 'Acadex bildirimleri açık',
    'Böyle görüneceğim. Beğeni, yorum ve hatırlatmalar buraya gelecek.', '/dashboard.html#settings',
    'test:' || to_char(now(), 'YYYYMMDDHH24MI'), 'test');
end $$;

-- ---------- destek ziyaretçisi (giriş yok, görüşme anahtarıyla) ----------
create or replace function public.support_push_subscribe(p_token text, p_endpoint text, p_p256dh text, p_auth text)
returns json language plpgsql security definer set search_path = public as $$
declare t public.support_threads;
begin
  t := public.support_thread_of(p_token);
  if t.id is null then raise exception 'DESTEK_YOK'; end if;
  if not public.push_endpoint_ok(p_endpoint) then raise exception 'PUSH_ADRES'; end if;
  if not public.push_key_ok(p_p256dh, 60, 120) or not public.push_key_ok(p_auth, 12, 48) then raise exception 'PUSH_ANAHTAR'; end if;
  if (select count(*) from public.push_subscriptions where support_thread_id = t.id and endpoint <> p_endpoint) >= 3 then raise exception 'PUSH_COK'; end if;
  insert into public.push_subscriptions (support_thread_id, endpoint, p256dh, auth)
  values (t.id, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set support_thread_id = t.id, p256dh = excluded.p256dh, auth = excluded.auth, fails = 0, updated_at = now();
  return json_build_object('ok', true);
end $$;

create or replace function public.support_push_unsubscribe(p_token text, p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
declare t public.support_threads;
begin
  t := public.support_thread_of(p_token);
  if t.id is null then return; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and support_thread_id = t.id and user_id is null;
  update public.push_subscriptions set support_thread_id = null where endpoint = p_endpoint and support_thread_id = t.id;
end $$;

-- ---------- olay tetikleyicileri ----------
-- projen beğenildi (aynı proje için saatte tek bildirim; sayı güncellenir)
create or replace function public.push_on_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare pr record; who text; n int;
begin
  select id, user_id, title into pr from public.sandbox_projects where id = new.project_id;
  if pr.user_id is null or pr.user_id = new.user_id then return null; end if;
  select split_part(coalesce(nullif(btrim(full_name), ''), 'Biri'), ' ', 1) into who from public.profiles where id = new.user_id;
  select count(*) into n from public.sandbox_project_likes where project_id = new.project_id and created_at >= date_trunc('hour', now());
  perform public.push_enqueue_user(pr.user_id, 'like', 'Projen beğenildi',
    case when n > 1 then coalesce(who, 'Biri') || ' ve ' || (n - 1) || ' kişi daha “' || left(coalesce(pr.title, 'projeni'), 60) || '” projeni beğendi.'
         else coalesce(who, 'Biri') || ' “' || left(coalesce(pr.title, 'projeni'), 60) || '” projeni beğendi.' end,
    '/dashboard.html#sandbox', 'like:' || pr.id || ':' || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24'), 'like:' || pr.id);
  return null;
exception when others then
  raise warning 'push_on_like: %', sqlerrm; return null;
end $$;
drop trigger if exists push_like on public.sandbox_project_likes;
create trigger push_like after insert on public.sandbox_project_likes
  for each row execute function public.push_on_like();

-- projene yorum / yorumuna cevap
create or replace function public.push_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare pr record; who text; par uuid; snip text := left(regexp_replace(coalesce(new.content, ''), '\s+', ' ', 'g'), 90);
begin
  select id, user_id, title into pr from public.sandbox_projects where id = new.project_id;
  select split_part(coalesce(nullif(btrim(full_name), ''), 'Biri'), ' ', 1) into who from public.profiles where id = new.user_id;
  who := coalesce(who, 'Biri');
  if pr.user_id is not null and pr.user_id <> new.user_id then
    perform public.push_enqueue_user(pr.user_id, 'comment', '“' || left(coalesce(pr.title, 'Projen'), 50) || '” projene yorum',
      who || ': ' || snip, '/dashboard.html#sandbox', 'comment:' || new.id, 'comment:' || pr.id);
  end if;
  if new.parent_id is not null then
    select user_id into par from public.sandbox_project_comments where id = new.parent_id;
    if par is not null and par <> new.user_id and par is distinct from pr.user_id then
      perform public.push_enqueue_user(par, 'comment', who || ' yorumuna cevap verdi', snip,
        '/dashboard.html#sandbox', 'reply:' || new.id, 'comment:' || pr.id);
    end if;
  end if;
  return null;
exception when others then
  raise warning 'push_on_comment: %', sqlerrm; return null;
end $$;
drop trigger if exists push_comment on public.sandbox_project_comments;
create trigger push_comment after insert on public.sandbox_project_comments
  for each row execute function public.push_on_comment();

-- destek ekibi cevap verdi: 20 sn bekler; ziyaretçi o arada okuduysa gönderilmez
create or replace function public.push_on_support() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sender <> 'admin' then return null; end if;
  insert into public.push_outbox (sub_id, kind, title, body, url, dedupe, tag, send_after)
  select s.id, 'support', 'Acadex destek ekibi yazdı', left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
         '/#destek', 'sup:' || new.id, 'support', now() + interval '20 seconds'
  from public.push_subscriptions s where s.support_thread_id = new.thread_id
  on conflict (sub_id, dedupe) do nothing;
  return null;
exception when others then
  raise warning 'push_on_support: %', sqlerrm; return null;
end $$;
drop trigger if exists push_support on public.support_messages;
create trigger push_support after insert on public.support_messages
  for each row execute function public.push_on_support();

-- ---------- günlük hatırlatmalar (pg_cron, 15 dakikada bir) ----------
-- Kullanıcının saatinde (study_hour, varsayılan 20, İstanbul) günde EN FAZLA BİR
-- hatırlatma: bugün uğramadıysa seri/çalışma notu (+ bekleyen kart sayısı),
-- uğradıysa ve 5+ kart bekliyorsa tekrar notu. Yarın sınavı varsa ayrıca bir not.
-- Son 14 gündür hiç gelmeyen hesaba seri hatırlatması gitmez (ısrar yok).
create or replace function public.push_daily() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record; ex record;
  loc timestamp := now() at time zone 'Europe/Istanbul';
  today date := (now() at time zone 'Europe/Istanbul')::date;
  hr int := extract(hour from (now() at time zone 'Europe/Istanbul'));
  due int; k int; total int := 0; ttl text; msg text; h int;
begin
  for r in
    select p.id, p.current_streak, p.last_active_date, coalesce(p.notification_prefs, '{}'::jsonb) pr
    from public.profiles p
    where exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
  loop
    h := case when (r.pr ->> 'study_hour') ~ '^\d{1,2}$' then (r.pr ->> 'study_hour')::int else 20 end;
    if h <> hr then continue; end if;

    for ex in select id, title from public.study_events
              where user_id = r.id and event_type = 'exam' and not coalesce(is_done, false) and event_date = today + 1 loop
      total := total + public.push_enqueue_user(r.id, 'exam', 'Yarın sınavın var',
        left(coalesce(ex.title, 'Sınav'), 80) || ': son bir tekrar için kartların hazır.',
        '/dashboard.html#planner', 'exam:' || ex.id, 'exam');
    end loop;

    select count(*) into due from public.card_item_confidence where user_id = r.id and next_review_at <= now();
    k := 0;
    if (r.last_active_date is null or r.last_active_date < today) and r.last_active_date >= today - 14 then
      if coalesce(r.current_streak, 0) > 0 and r.last_active_date = today - 1 then
        ttl := r.current_streak || ' günlük serin bu gece biter';
        msg := 'Acadex’e kısa bir uğra, seri devam etsin.';
      else
        ttl := 'Bugün 10 dakika yeter';
        msg := 'Kısa bir tekrar bile fark eder; Acadia seni bekliyor.';
      end if;
      if due > 0 then msg := msg || ' ' || due || ' kart tekrarını bekliyor.'; end if;
      k := public.push_enqueue_user(r.id, 'study', ttl, msg, '/dashboard.html', 'day:' || today, 'daily');
    end if;
    if k = 0 and due >= (case when r.last_active_date = today then 5 else 1 end) then
      k := public.push_enqueue_user(r.id, 'review', due || ' kart seni bekliyor',
        'Tekrar zamanı geldi; birkaç dakikada kartoteksi boşaltabilirsin.', '/dashboard.html#cards', 'day:' || today, 'daily');
    end if;
    total := total + k;
  end loop;
  delete from public.push_outbox where created_at < now() - interval '14 days';
  return total;
end $$;

-- ---------- gönderici (yalnız service_role) ----------
create or replace function public.push_claim(p_limit int default 100)
returns table (id bigint, kind text, title text, body text, url text, tag text, n int, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = public as $$
begin
  -- 1 günden eski gönderilmemişler artık anlamsız
  update public.push_outbox o set sent_at = now(), error = 'eskidi'
   where o.sent_at is null and o.created_at < now() - interval '1 day';
  -- destek cevabını ziyaretçi zaten okuduysa gönderme
  update public.push_outbox o set sent_at = now(), error = 'goruldu'
    from public.push_subscriptions s, public.support_threads t
   where o.kind = 'support' and o.sent_at is null and s.id = o.sub_id
     and t.id = s.support_thread_id and t.visitor_unread = 0 and o.send_after <= now();
  return query
  with c as (
    select o.id from public.push_outbox o
     where o.sent_at is null and o.tries < 5 and o.send_after <= now()
       and (o.claimed_at is null or o.claimed_at < now() - interval '2 minutes')
     order by o.id limit greatest(1, least(coalesce(p_limit, 100), 500))
     for update skip locked
  ), u as (
    update public.push_outbox o set claimed_at = now(), tries = o.tries + 1
      from c where o.id = c.id
    returning o.id, o.kind, o.title, o.body, o.url, o.tag, o.n, o.sub_id
  )
  select u.id, u.kind, u.title, u.body, u.url, u.tag, u.n, s.endpoint, s.p256dh, s.auth
    from u join public.push_subscriptions s on s.id = u.sub_id;
end $$;

-- p_res: [{"id":1,"ok":true} | {"id":2,"gone":true} | {"id":3,"err":"..."}]
create or replace function public.push_done(p_res jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare e jsonb; sid uuid; ok int := 0; gone int := 0; bad int := 0;
begin
  for e in select * from jsonb_array_elements(coalesce(p_res, '[]'::jsonb)) loop
    select sub_id into sid from public.push_outbox where id = (e ->> 'id')::bigint;
    if sid is null then continue; end if;
    if (e ->> 'ok')::boolean is true then
      update public.push_outbox set sent_at = now(), error = null where id = (e ->> 'id')::bigint;
      update public.push_subscriptions set last_ok_at = now(), fails = 0 where id = sid;
      ok := ok + 1;
    elsif (e ->> 'gone')::boolean is true then
      delete from public.push_subscriptions where id = sid;  -- kuyruk satırları da silinir
      gone := gone + 1;
    else
      update public.push_outbox set error = left(coalesce(e ->> 'err', 'hata'), 300), claimed_at = null where id = (e ->> 'id')::bigint;
      update public.push_subscriptions set fails = fails + 1 where id = sid;
      delete from public.push_subscriptions where id = sid and fails >= 8;
      bad := bad + 1;
    end if;
  end loop;
  return json_build_object('ok', ok, 'gone', gone, 'err', bad);
end $$;

-- ---------- yetkiler ----------
revoke all on function public.push_endpoint_ok(text), public.push_key_ok(text, int, int), public.push_pref_ok(uuid, text),
  public.push_kick(), public.push_flush(), public.push_enqueue_user(uuid, text, text, text, text, text, text),
  public.push_daily(), public.push_claim(int), public.push_done(jsonb),
  public.push_subscribe(text, text, text, text), public.push_unsubscribe(text), public.push_has(text), public.push_test(),
  public.support_push_subscribe(text, text, text, text), public.support_push_unsubscribe(text, text)
  from public, anon, authenticated;
grant execute on function public.push_subscribe(text, text, text, text), public.push_unsubscribe(text),
  public.push_has(text), public.push_test() to authenticated;
grant execute on function public.support_push_subscribe(text, text, text, text), public.support_push_unsubscribe(text, text) to anon, authenticated;
grant execute on function public.push_claim(int), public.push_done(jsonb) to service_role;

-- ---------- zamanlayıcı ----------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('push-flush', '* * * * *', 'select public.push_flush()');
    perform cron.schedule('push-daily', '*/15 * * * *', 'select public.push_daily()');
  end if;
end $$;

-- ============================================================================
-- KURULUMDAN SONRA BİR KEZ (kendi değerinle, sohbete yapıştırmadan):
--   select vault.create_secret('<PUSH_SECRET değerin>', 'push_secret');
-- Değeri tools/push-anahtar.html üretir; aynı değer edge function'ın
-- PUSH_SECRET gizli değişkenine de girilir.
-- ============================================================================
