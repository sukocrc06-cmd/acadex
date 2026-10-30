-- ============================================================================
-- ACADEX — HATA DEFTERİ TELEFON HATIRLATMASI (30.10.2026)
-- Hata defterinde zamanı gelen yanlışlar şimdiye kadar yalnızca bildirim
-- çanında görünüyordu (js/dashboard.js gatherNotificationItems 1c). Artık
-- push_daily() bunları da telefona gönderir.
--
-- Takvim js/exam-engine.js mistakeStates / mistakeReminder ile AYNI kural:
--   * yanlış: ikinci şans olmayan tamamlanmış sınavda puanı 50 altı (ya da yok)
--   * deneme: ikinci şans sınavında (scoring.retry[i]) i+1 numaralı sorunun puanı;
--     80 ve üstü doğru
--   * art arda iki doğru → kazanıldı (hatırlatılmaz)
--   * zamanı: hiç denenmediyse sınavdan 1 gün sonra; son deneme doğruysa 3,
--     yanlışsa 1 gün sonra
-- tests/push-hata-defteri.js iki uygulamayı aynı sınavlarla karşılaştırır.
--
-- Israr yok: günde en fazla bir hatırlatma kuralı korunur. Seri notu
-- gönderildiyse bu gün hata defteri notu gitmez; yalnızca son 24 saatte
-- zamanı gelen yeni bir yanlış varsa gönderilir (aynı yanlışlar her gün
-- çalmaz). Tercih: "study" (çalışma hatırlatmaları) kapalıysa gitmez.
-- Bu dosya 20261029_web_push.sql'den SONRA, SQL Editor'de bir kez
-- çalıştırılır; tekrar çalıştırmak güvenlidir.
-- ============================================================================

create or replace function public.exam_mistakes_due(p_uid uuid, p_now timestamptz default now())
returns table (due int, fresh int)
language sql stable security definer set search_path = public as $$
  with mine as (
    select e.id, e.completed_at, e.scoring, e.question_results
    from public.exams e
    where e.user_id = p_uid and e.completed_at is not null and jsonb_typeof(e.question_results) = 'array'
  ),
  mistakes as (
    select m.id::text as eid, (r ->> 'question_id')::int as qid, m.completed_at as at
    from mine m, jsonb_array_elements(m.question_results) r
    where jsonb_typeof(m.scoring -> 'retry') is distinct from 'array'
      and (r ->> 'question_id') ~ '^\d+$'
      and coalesce(case when jsonb_typeof(r -> 'score') = 'number' then (r ->> 'score')::numeric end, 0) < 50
  ),
  attempts as (
    select s.v ->> 'exam_id' as eid, (s.v ->> 'question_id')::int as qid, x.completed_at as at, (rr ->> 'score')::numeric >= 80 as ok
    from mine x
    cross join lateral jsonb_array_elements(x.scoring -> 'retry') with ordinality s(v, ord)
    join lateral jsonb_array_elements(x.question_results) rr on (rr ->> 'question_id') ~ '^\d+$' and (rr ->> 'question_id')::int = s.ord
    where jsonb_typeof(x.scoring -> 'retry') = 'array'
      and (s.v ->> 'question_id') ~ '^\d+$'
      and jsonb_typeof(rr -> 'score') = 'number'
  ),
  states as (
    select mk.eid, mk.qid, mk.at,
      a.last_at, a.last_ok,
      coalesce((select count(*) from attempts t
                 where t.eid = mk.eid and t.qid = mk.qid
                   and t.at > coalesce((select max(t2.at) from attempts t2 where t2.eid = mk.eid and t2.qid = mk.qid and not t2.ok), '-infinity'::timestamptz)), 0) as streak
    from mistakes mk
    left join lateral (
      select max(t.at) as last_at, (array_agg(t.ok order by t.at desc))[1] as last_ok
      from attempts t where t.eid = mk.eid and t.qid = mk.qid
    ) a on true
  ),
  ripe as (
    select case when last_at is null then at + interval '1 day'
                when last_ok then last_at + interval '3 days'
                else last_at + interval '1 day' end as ripe_at
    from states
    where streak < 2
  )
  select count(*) filter (where ripe_at <= p_now)::int,
         count(*) filter (where ripe_at <= p_now and ripe_at > p_now - interval '1 day')::int
  from ripe
$$;

-- hata defteri hatırlatması "study" tercihine bağlı (yarınki sınav gibi)
create or replace function public.push_pref_ok(p_uid uuid, p_kind text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_kind in ('test', 'support') then true
    else coalesce((select coalesce(notification_prefs, '{}'::jsonb) ->> (case p_kind
           when 'like' then 'likes' when 'comment' then 'comments'
           when 'exam' then 'study' when 'mistakes' then 'study' else p_kind end)
         from public.profiles where id = p_uid), 'true') <> 'false'
  end
$$;

-- ---------- günlük hatırlatmalar (pg_cron, 15 dakikada bir) ----------
-- 20261029_web_push.sql'deki sürümün aynısı; yalnızca hata defteri dalı eklendi
-- (seri notundan sonra, kart notundan önce).
create or replace function public.push_daily() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record; ex record;
  loc timestamp := now() at time zone 'Europe/Istanbul';
  today date := (now() at time zone 'Europe/Istanbul')::date;
  hr int := extract(hour from (now() at time zone 'Europe/Istanbul'));
  due int; k int; total int := 0; ttl text; msg text; h int;
  mis_due int; mis_fresh int;
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
    -- 30.10.2026: hata defterinde son 24 saatte zamanı gelen yanlış varsa
    if k = 0 then
      begin
        select d.due, d.fresh into mis_due, mis_fresh from public.exam_mistakes_due(r.id, now()) d;
      exception when others then mis_due := 0; mis_fresh := 0;  -- hatırlatma hatası günlük notları bozmaz
      end;
      if coalesce(mis_fresh, 0) > 0 then
        k := public.push_enqueue_user(r.id, 'mistakes', 'Hata defterinde ' || mis_due || ' yanlış tekrar zamanında',
          'İkinci şans: benzer yeni sorularla dene; art arda iki doğru o yanlışı defterden çıkarır.',
          '/dashboard.html?tab=exams#hata-defteri', 'day:' || today, 'daily');
      end if;
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

-- ---------- yetkiler ----------
revoke all on function public.exam_mistakes_due(uuid, timestamptz), public.push_pref_ok(uuid, text), public.push_daily()
  from public, anon, authenticated;
