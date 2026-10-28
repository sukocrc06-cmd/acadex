-- ============================================================================
-- ACADEX CANLI DESTEK (28.10.2026)
-- Landing'deki "Acadex destek hattı" (js/acadex-destek.js) ve yönetim panelindeki
-- "Canlı destek" sekmesi (js/admin-app.js) için.
--
-- Güvenlik modeli:
--   * Ziyaretçi giriş yapmaz. Tarayıcısı 48 karakterlik rastgele bir anahtar üretir;
--     veritabanında yalnızca SHA-256 özeti tutulur. Ziyaretçi yalnız kendi
--     görüşmesini, bu anahtarla çağrılan RPC'ler üzerinden görür.
--   * Tablolarda RLS açık ve HİÇ politika yok: anon / authenticated doğrudan okuyamaz,
--     yazamaz. Erişim yalnız aşağıdaki SECURITY DEFINER fonksiyonlarla.
--   * Yönetici fonksiyonları mevcut public.admin_guard() ile korunur.
--   * Kötüye kullanım sınırları: mesaj 1–2000 karakter; görüşme başına dakikada en
--     fazla 6 mesaj; aynı IP'den saatte en fazla 6 yeni görüşme (IP'nin yalnız özeti).
-- Bu dosya Supabase SQL Editor'de bir kez çalıştırılır; tekrar çalıştırmak güvenlidir.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  ip_hash text,
  name text check (name is null or char_length(name) <= 80),
  email text check (email is null or char_length(email) <= 160),
  topic text check (topic is null or char_length(topic) <= 60),
  page text check (page is null or char_length(page) <= 300),
  status text not null default 'open' check (status in ('open', 'closed')),
  admin_unread int not null default 0,
  visitor_unread int not null default 0,
  created_at timestamptz not null default now(),
  last_msg_at timestamptz not null default now(),
  last_visitor_seen timestamptz
);
create index if not exists support_threads_last_idx on public.support_threads (last_msg_at desc);
create index if not exists support_threads_ip_idx on public.support_threads (ip_hash, created_at desc);

create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender text not null check (sender in ('visitor', 'bot', 'admin', 'system')),
  body text not null check (char_length(body) between 1 and 2000),
  admin_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_thread_idx on public.support_messages (thread_id, id);

-- yöneticinin "çevrimiçiyim" anahtarı + panel açıkken her dakika nabız
create table if not exists public.support_presence (
  admin_id uuid primary key,
  online boolean not null default false,
  seen_at timestamptz not null default now()
);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_presence enable row level security;
revoke all on public.support_threads, public.support_messages, public.support_presence from anon, authenticated;

-- ---------- yardımcılar ----------
create or replace function public.support_hash(p text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(p, ''), 'sha256'), 'hex')
$$;

create or replace function public.support_thread_of(p_token text) returns public.support_threads
language plpgsql stable security definer set search_path = public as $$
declare t public.support_threads;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 128 then raise exception 'DESTEK_ANAHTAR'; end if;
  select * into t from public.support_threads where token_hash = public.support_hash(p_token);
  return t;
end $$;

-- ---------- ziyaretçi ----------
-- ekip çevrimiçi mi? (son 3 dakikada nabız atan ve anahtarı açık bir yönetici)
create or replace function public.support_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('online', exists (select 1 from public.support_presence where online and seen_at > now() - interval '3 minutes'))
$$;

create or replace function public.support_open(p_token text, p_name text default null, p_email text default null, p_topic text default null, p_page text default null)
returns json language plpgsql security definer set search_path = public as $$
declare t public.support_threads; ip text; n int;
begin
  t := public.support_thread_of(p_token);
  if t.id is not null then
    update public.support_threads set
      name = coalesce(nullif(btrim(left(p_name, 80)), ''), name),
      email = coalesce(nullif(btrim(left(p_email, 160)), ''), email),
      status = 'open'
    where id = t.id returning * into t;
    return json_build_object('id', t.id, 'status', t.status);
  end if;
  ip := public.support_hash(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1));
  select count(*) into n from public.support_threads where ip_hash = ip and created_at > now() - interval '1 hour';
  if n >= 6 then raise exception 'DESTEK_SINIR'; end if;
  if p_email is not null and btrim(p_email) <> '' and btrim(p_email) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'DESTEK_EPOSTA'; end if;
  insert into public.support_threads (token_hash, ip_hash, name, email, topic, page)
  values (public.support_hash(p_token), ip, nullif(btrim(left(p_name, 80)), ''), nullif(btrim(left(p_email, 160)), ''), nullif(left(p_topic, 60), ''), nullif(left(p_page, 300), ''))
  returning * into t;
  return json_build_object('id', t.id, 'status', t.status);
end $$;

create or replace function public.support_send(p_token text, p_body text, p_bot boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare t public.support_threads; n int; m public.support_messages; b text := btrim(coalesce(p_body, ''));
begin
  t := public.support_thread_of(p_token);
  if t.id is null then raise exception 'DESTEK_YOK'; end if;
  if char_length(b) < 1 or char_length(b) > 2000 then raise exception 'DESTEK_UZUNLUK'; end if;
  select count(*) into n from public.support_messages where thread_id = t.id and sender in ('visitor', 'bot') and created_at > now() - interval '1 minute';
  if n >= 6 then raise exception 'DESTEK_HIZ'; end if;
  insert into public.support_messages (thread_id, sender, body) values (t.id, case when p_bot then 'bot' else 'visitor' end, b) returning * into m;
  update public.support_threads set last_msg_at = now(), status = 'open',
    admin_unread = admin_unread + case when p_bot then 0 else 1 end where id = t.id;
  return json_build_object('id', m.id, 'created_at', m.created_at);
end $$;

-- yeni mesajları getir (p_after: son görülen mesaj id'si); ziyaretçinin okunmamışını sıfırlar
create or replace function public.support_fetch(p_token text, p_after bigint default 0)
returns json language plpgsql security definer set search_path = public as $$
declare t public.support_threads; r json;
begin
  t := public.support_thread_of(p_token);
  if t.id is null then return json_build_object('exists', false); end if;
  update public.support_threads set visitor_unread = 0, last_visitor_seen = now() where id = t.id;
  select coalesce(json_agg(json_build_object('id', id, 's', sender, 'b', body, 't', created_at) order by id), '[]'::json) into r
  from (select * from public.support_messages where thread_id = t.id and id > coalesce(p_after, 0) order by id limit 200) x;
  return json_build_object('exists', true, 'status', t.status, 'messages', r,
    'online', exists (select 1 from public.support_presence where online and seen_at > now() - interval '3 minutes'));
end $$;

-- widget kapalıyken okunmamış var mı? (yeni mesaj noktası için, mesaj içeriği dönmez)
create or replace function public.support_peek(p_token text) returns json
language plpgsql stable security definer set search_path = public as $$
declare t public.support_threads;
begin
  t := public.support_thread_of(p_token);
  return json_build_object('exists', t.id is not null, 'unread', coalesce(t.visitor_unread, 0));
end $$;

create or replace function public.support_close(p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare t public.support_threads;
begin
  t := public.support_thread_of(p_token);
  if t.id is null then return; end if;
  update public.support_threads set status = 'closed' where id = t.id;
  insert into public.support_messages (thread_id, sender, body) values (t.id, 'system', 'Ziyaretçi görüşmeyi kapattı.');
end $$;

-- ---------- yönetici ----------
create or replace function public.admin_support_threads(p_status text default 'open', p_limit int default 100)
returns json language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  perform public.admin_guard();
  select coalesce(json_agg(x order by x.last_msg_at desc), '[]'::json) into r from (
    select t.id, t.name, t.email, t.topic, t.page, t.status, t.admin_unread, t.created_at, t.last_msg_at, t.last_visitor_seen,
      (select json_build_object('s', m.sender, 'b', left(m.body, 140)) from public.support_messages m where m.thread_id = t.id order by m.id desc limit 1) last
    from public.support_threads t
    where p_status is null or p_status = 'all' or t.status = p_status
    order by t.last_msg_at desc limit least(coalesce(p_limit, 100), 300)
  ) x;
  return r;
end $$;

create or replace function public.admin_support_thread(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare t public.support_threads; r json;
begin
  perform public.admin_guard();
  update public.support_threads set admin_unread = 0 where id = p_id returning * into t;
  if t.id is null then raise exception 'DESTEK_YOK'; end if;
  select coalesce(json_agg(json_build_object('id', id, 's', sender, 'b', body, 't', created_at) order by id), '[]'::json) into r
  from (select * from public.support_messages where thread_id = p_id order by id desc limit 500) x;
  return json_build_object('thread', json_build_object('id', t.id, 'name', t.name, 'email', t.email, 'topic', t.topic, 'page', t.page, 'status', t.status, 'created_at', t.created_at, 'last_visitor_seen', t.last_visitor_seen), 'messages', r);
end $$;

create or replace function public.admin_support_reply(p_id uuid, p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare m public.support_messages; b text := btrim(coalesce(p_body, ''));
begin
  perform public.admin_guard();
  if char_length(b) < 1 or char_length(b) > 2000 then raise exception 'DESTEK_UZUNLUK'; end if;
  insert into public.support_messages (thread_id, sender, body, admin_id) values (p_id, 'admin', b, auth.uid()) returning * into m;
  update public.support_threads set last_msg_at = now(), status = 'open', visitor_unread = visitor_unread + 1 where id = p_id;
  return json_build_object('id', m.id, 'created_at', m.created_at);
end $$;

create or replace function public.admin_support_set_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  if p_status not in ('open', 'closed') then raise exception 'DESTEK_DURUM'; end if;
  update public.support_threads set status = p_status where id = p_id;
  if p_status = 'closed' then insert into public.support_messages (thread_id, sender, body, admin_id) values (p_id, 'system', 'Görüşme ekip tarafından kapatıldı.', auth.uid()); end if;
end $$;

-- "çevrimiçiyim" anahtarı + nabız; okunmamış özetini de döner (rozet ve bildirim için)
create or replace function public.admin_support_presence(p_online boolean default null)
returns json language plpgsql security definer set search_path = public as $$
declare me_on boolean;
begin
  perform public.admin_guard();
  insert into public.support_presence (admin_id, online, seen_at) values (auth.uid(), coalesce(p_online, false), now())
  on conflict (admin_id) do update set online = coalesce(p_online, public.support_presence.online), seen_at = now()
  returning online into me_on;
  return json_build_object('online', me_on,
    'unread', (select coalesce(sum(admin_unread), 0) from public.support_threads where status = 'open'),
    'open', (select count(*) from public.support_threads where status = 'open'),
    'latest', (select max(last_msg_at) from public.support_threads where admin_unread > 0));
end $$;

revoke all on function public.support_hash(text), public.support_thread_of(text) from public, anon, authenticated;
grant execute on function public.support_status(), public.support_open(text, text, text, text, text), public.support_send(text, text, boolean),
  public.support_fetch(text, bigint), public.support_peek(text), public.support_close(text) to anon, authenticated;
grant execute on function public.admin_support_threads(text, int), public.admin_support_thread(uuid), public.admin_support_reply(uuid, text),
  public.admin_support_set_status(uuid, text), public.admin_support_presence(boolean) to authenticated;
