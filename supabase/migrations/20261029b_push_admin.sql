-- ============================================================================
-- ACADEX TELEFON BİLDİRİMLERİ — YÖNETİM PANELİ (29.10.2026)
-- Admin panelindeki "Bildirimler" sekmesi için iki SALT OKUNUR fonksiyon:
--   admin_push_stats()  canlı durum: aboneler, son 24 saat, türler, saatlik seri,
--                       sistem sağlığı (zamanlayıcılar, son gönderim, kasa kaydı)
--   admin_push_feed()   son bildirimler: kime, tür, başlık, sonuç (süzülebilir)
-- Güvenlik:
--   * İkisi de admin_guard() ile korunur; yalnız yöneticiler çağırabilir.
--   * Cihaz adresi (endpoint) ve şifreleme anahtarları (p256dh/auth) ASLA dönmez;
--     yalnız servis adı (Apple / Google / Mozilla / Windows).
--   * Kasadaki gizli değer okunmaz; yalnız kaydın VAR olup olmadığına bakılır.
--   * Hiçbir şey yazılmaz/değiştirilmez.
-- Bağımlılık: 20261029_web_push.sql. Bu dosya SQL Editor'de bir kez çalıştırılır;
-- tekrar çalıştırmak güvenlidir.
-- ============================================================================

-- push servisinin adı (adresin kendisi gösterilmez)
create or replace function public.push_platform(p_endpoint text) returns text
language sql immutable as $$
  select case
    when p_endpoint ~ '^https://([a-z0-9-]+\.)?push\.apple\.com/' then 'apple'
    when p_endpoint ~ '^https://(fcm|android)\.googleapis\.com/' then 'google'
    when p_endpoint ~ '^https://updates\.push\.services\.mozilla\.com/' then 'mozilla'
    when p_endpoint ~ '\.notify\.windows\.com/' then 'windows'
    else 'diger' end
$$;

-- kuyruk satırının sonucu
create or replace function public.push_state(p_sent timestamptz, p_error text, p_tries int) returns text
language sql immutable as $$
  select case
    when p_sent is not null and p_error is null then 'gitti'
    when p_sent is not null then 'atlandi'          -- eskidi / goruldu
    when p_error is not null and p_tries >= 5 then 'vazgecildi'
    when p_error is not null then 'hata'            -- yeniden denenecek
    else 'bekliyor' end
$$;

create or replace function public.admin_push_stats()
returns json language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  perform public.admin_guard();
  select json_build_object(
    'now', now(),
    'subs', (select json_build_object(
        'total', count(*),
        'users', count(distinct user_id),
        'visitors', count(*) filter (where user_id is null and support_thread_id is not null),
        'new_7d', count(*) filter (where created_at > now() - interval '7 days'),
        'failing', count(*) filter (where fails > 0),
        'by_platform', coalesce((select json_object_agg(p, n) from (
            select public.push_platform(endpoint) p, count(*) n from public.push_subscriptions group by 1) x), '{}'::json))
      from public.push_subscriptions),
    'last24', (select json_build_object(
        'total', count(*),
        'gitti', count(*) filter (where public.push_state(sent_at, error, tries) = 'gitti'),
        'atlandi', count(*) filter (where public.push_state(sent_at, error, tries) = 'atlandi'),
        'hata', count(*) filter (where public.push_state(sent_at, error, tries) in ('hata', 'vazgecildi')),
        'bekliyor', count(*) filter (where public.push_state(sent_at, error, tries) = 'bekliyor'),
        'avg_sec', round(avg(extract(epoch from sent_at - send_after)) filter (where sent_at is not null and error is null)::numeric, 1),
        'by_kind', coalesce((select json_object_agg(kind, n) from (
            select kind, count(*) n from public.push_outbox where created_at > now() - interval '24 hours' group by kind) k), '{}'::json))
      from public.push_outbox where created_at > now() - interval '24 hours'),
    'series', (select coalesce(json_agg(json_build_object('h', h, 'ok', ok, 'err', err) order by h), '[]'::json) from (
        select g.h,
          (select count(*) from public.push_outbox o where o.sent_at >= g.h and o.sent_at < g.h + interval '1 hour' and o.error is null) ok,
          (select count(*) from public.push_outbox o where o.created_at >= g.h and o.created_at < g.h + interval '1 hour' and o.error is not null and o.error not in ('eskidi', 'goruldu')) err
        from generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') g(h)) s),
    'prefs_off', (select json_build_object(
        'likes', count(*) filter (where p.notification_prefs ->> 'likes' = 'false'),
        'comments', count(*) filter (where p.notification_prefs ->> 'comments' = 'false'),
        'study', count(*) filter (where p.notification_prefs ->> 'study' = 'false'),
        'review', count(*) filter (where p.notification_prefs ->> 'review' = 'false'))
      from public.profiles p where exists (select 1 from public.push_subscriptions s where s.user_id = p.id)),
    'health', json_build_object(
        'secret', exists (select 1 from vault.secrets where name = 'push_secret'),
        'last_ok', (select max(sent_at) from public.push_outbox where sent_at is not null and error is null),
        'oldest_pending', (select min(send_after) from public.push_outbox where sent_at is null and tries < 5),
        'last_error', (select json_build_object('t', created_at, 'e', left(error, 160)) from public.push_outbox
                        where error is not null and error not in ('eskidi', 'goruldu') order by id desc limit 1),
        'cron', (select coalesce(json_agg(json_build_object('job', j.jobname, 'active', j.active, 'last', d.end_time, 'status', d.status) order by j.jobname), '[]'::json)
                   from cron.job j left join lateral (
                     select end_time, status from cron.job_run_details r where r.jobid = j.jobid order by runid desc limit 1) d on true
                  where j.jobname in ('push-flush', 'push-daily')))
  ) into r;
  return r;
end $$;

-- p_state: null/'all' | gitti | bekliyor | hata (hata + vazgecildi) | atlandi
-- p_kind:  null/'all' | like | comment | support | study | review | exam | test
-- p_q:     kişi adı / başlık / metin içinde arama
create or replace function public.admin_push_feed(p_state text default null, p_kind text default null,
  p_q text default null, p_limit int default 100)
returns json language plpgsql stable security definer set search_path = public as $$
declare r json; q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform public.admin_guard();
  select coalesce(json_agg(x order by x.id desc), '[]'::json) into r from (
    select o.id, o.kind, o.title, o.body, o.n, o.tries, o.created_at, o.send_after, o.sent_at,
      case when o.error in ('eskidi', 'goruldu') then o.error else left(o.error, 200) end as error,
      public.push_state(o.sent_at, o.error, o.tries) as state,
      public.push_platform(s.endpoint) as platform,
      s.user_id,
      coalesce(nullif(btrim(p.full_name), ''), p.email, case when s.user_id is null then null else 'adsız kullanıcı' end) as user_name,
      case when s.user_id is null and s.support_thread_id is not null then coalesce(nullif(btrim(t.name), ''), 'ziyaretçi') end as visitor
    from public.push_outbox o
    join public.push_subscriptions s on s.id = o.sub_id
    left join public.profiles p on p.id = s.user_id
    left join public.support_threads t on t.id = s.support_thread_id
    where (p_kind is null or p_kind in ('', 'all') or o.kind = p_kind)
      and (p_state is null or p_state in ('', 'all')
           or public.push_state(o.sent_at, o.error, o.tries) = p_state
           or (p_state = 'hata' and public.push_state(o.sent_at, o.error, o.tries) = 'vazgecildi'))
      and (q is null or o.title ilike '%' || q || '%' or o.body ilike '%' || q || '%'
           or p.full_name ilike '%' || q || '%' or p.email ilike '%' || q || '%' or t.name ilike '%' || q || '%')
    order by o.id desc
    limit least(greatest(coalesce(p_limit, 100), 1), 300)
  ) x;
  return r;
end $$;

-- Supabase yeni fonksiyonlara authenticated için de doğrudan EXECUTE verir;
-- "from public" bunu kaldırmaz, yardımcılarda authenticated ayrıca geri alınır.
revoke all on function public.push_platform(text), public.push_state(timestamptz, text, int),
  public.admin_push_stats(), public.admin_push_feed(text, text, text, int) from public, anon;
revoke all on function public.push_platform(text), public.push_state(timestamptz, text, int) from authenticated;
grant execute on function public.admin_push_stats(), public.admin_push_feed(text, text, text, int) to authenticated;
