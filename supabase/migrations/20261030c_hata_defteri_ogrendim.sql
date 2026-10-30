-- ============================================================================
-- ACADEX — HATA DEFTERİ "ÖĞRENDİM" LİSTESİ (30.10.2026)
-- Hata defterinde ✓ (öğrendim) ile silinen yanlışlar yalnızca tarayıcıda
-- (localStorage) tutuluyordu; bildirim çanı ve telefon hatırlatması
-- (20261030_push_hata_defteri.sql) bu yanlışları da sayabiliyordu.
-- Artık sunucuda: öğrenci yalnızca kendi satırlarını görür, ekler, siler;
-- yalnızca kendi sınavının sorusunu işaretleyebilir.
-- exam_mistakes_due "öğrendim" denenleri saymaz (20261030_push_hata_defteri.sql
-- sürümünün aynısı + bir koşul).
-- Bu dosya 20261030_push_hata_defteri.sql'den SONRA, SQL Editor'de bir kez
-- çalıştırılır; tekrar çalıştırmak güvenlidir.
-- ============================================================================

create table if not exists public.exam_mistakes_done (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_id int not null check (question_id > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, exam_id, question_id)
);

alter table public.exam_mistakes_done enable row level security;
drop policy if exists exam_mistakes_done_select on public.exam_mistakes_done;
drop policy if exists exam_mistakes_done_insert on public.exam_mistakes_done;
drop policy if exists exam_mistakes_done_delete on public.exam_mistakes_done;
create policy exam_mistakes_done_select on public.exam_mistakes_done for select to authenticated using (user_id = auth.uid());
create policy exam_mistakes_done_insert on public.exam_mistakes_done for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.exams e where e.id = exam_id and e.user_id = auth.uid()));
create policy exam_mistakes_done_delete on public.exam_mistakes_done for delete to authenticated using (user_id = auth.uid());
revoke all on public.exam_mistakes_done from anon;
grant select, insert, delete on public.exam_mistakes_done to authenticated;

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
      and not exists (select 1 from public.exam_mistakes_done d
                      where d.user_id = p_uid and d.exam_id = m.id and d.question_id = (r ->> 'question_id')::int)
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

revoke all on function public.exam_mistakes_due(uuid, timestamptz) from public, anon, authenticated;
