-- ==========================================================================
-- Acadex Test Paneli · 2. adım (24.10.2026)
--   1) yorumlar (tp_comments) ve "bende de oluyor" (tp_votes)
--   2) uygulama içi "Bildir" düğmesi için kaynak alanı (tp_items.source)
--   3) yönetim panelindeki "Test" sekmesi için özet (admin_test_overview)
--
-- test-paneli.sql'den SONRA, Supabase → SQL Editor'de bir kez çalıştır.
-- Tekrar çalıştırmak zarar vermez.
-- ==========================================================================

-- ---------- kaynak: panel mi, uygulama içi "Bildir" mi ----------
alter table public.tp_items add column if not exists source text not null default 'panel';
alter table public.tp_items drop constraint if exists tp_items_source_check;
alter table public.tp_items add constraint tp_items_source_check check (source in ('panel', 'uygulama'));

-- ---------- yorumlar ----------
create table if not exists public.tp_comments (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.tp_items(id) on delete cascade,
  author_email text not null default public.tp_my_email(),
  body         text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at   timestamptz not null default now()
);
create index if not exists tp_comments_item_idx on public.tp_comments (item_id, created_at);
alter table public.tp_comments enable row level security;

create or replace function public.tp_comments_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  new.author_email := public.tp_my_email();
  new.created_at := now();
  new.body := btrim(new.body);
  return new;
end $$;
drop trigger if exists tp_comments_guard on public.tp_comments;
create trigger tp_comments_guard before insert on public.tp_comments
  for each row execute function public.tp_comments_guard();

drop policy if exists tp_comments_select on public.tp_comments;
create policy tp_comments_select on public.tp_comments for select to authenticated using (public.tp_is_member());
drop policy if exists tp_comments_insert on public.tp_comments;
create policy tp_comments_insert on public.tp_comments for insert to authenticated with check (public.tp_is_member());
drop policy if exists tp_comments_delete on public.tp_comments;
create policy tp_comments_delete on public.tp_comments for delete to authenticated
  using (public.tp_is_member() and (author_email = public.tp_my_email() or public.tp_is_owner()));
-- yorumlar düzenlenmez (update politikası yok): silip yeniden yazılır

-- ---------- bende de oluyor ----------
create table if not exists public.tp_votes (
  item_id    uuid not null references public.tp_items(id) on delete cascade,
  email      text not null default public.tp_my_email(),
  created_at timestamptz not null default now(),
  primary key (item_id, email)
);
alter table public.tp_votes enable row level security;

drop policy if exists tp_votes_select on public.tp_votes;
create policy tp_votes_select on public.tp_votes for select to authenticated using (public.tp_is_member());
drop policy if exists tp_votes_insert on public.tp_votes;
create policy tp_votes_insert on public.tp_votes for insert to authenticated
  with check (public.tp_is_member() and email = public.tp_my_email());
drop policy if exists tp_votes_delete on public.tp_votes;
create policy tp_votes_delete on public.tp_votes for delete to authenticated using (email = public.tp_my_email());

-- ---------- canlı güncelleme ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['tp_comments', 'tp_votes'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
-- silinen oy/yorumun hangi kayda ait olduğu canlı olayda görünsün
alter table public.tp_votes replica identity full;
alter table public.tp_comments replica identity full;

-- ---------- yönetim paneli: Test sekmesi özeti ----------
-- admin_guard(): yönetici + iki adımlı doğrulama (bkz. 20261019_yonetim_paneli.sql)
create or replace function public.admin_test_overview()
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare r json;
begin
  perform public.admin_guard();
  select json_build_object(
    'total',        (select count(*) from tp_items),
    'open',         (select count(*) from tp_items where status <> 'dogrulandi'),
    'open_hata',    (select count(*) from tp_items where kind = 'hata' and status <> 'dogrulandi'),
    'open_tasarim', (select count(*) from tp_items where kind = 'tasarim' and status <> 'dogrulandi'),
    'open_oneri',   (select count(*) from tp_items where kind = 'oneri' and status <> 'dogrulandi'),
    'week_new',     (select count(*) from tp_items where created_at > now() - interval '7 days'),
    'week_done',    (select count(*) from tp_items where status = 'dogrulandi' and status_at > now() - interval '7 days'),
    'from_app',     (select count(*) from tp_items where source = 'uygulama'),
    'by_status',    (select coalesce(json_object_agg(status, n), '{}'::json) from (select status, count(*) n from tp_items group by status) s),
    'by_page',      (select coalesce(json_agg(x order by x.n desc, x.page), '[]'::json) from (
                       select coalesce(nullif(page, ''), 'belirtilmedi') page, count(*) n,
                              count(*) filter (where kind = 'hata') hata from tp_items where status <> 'dogrulandi' group by 1) x),
    'oldest',       (select coalesce(json_agg(x), '[]'::json) from (
                       select i.no, i.kind, i.status, i.title, i.page, i.created_at, coalesce(m.name, i.author_email) author
                       from tp_items i left join tp_members m on m.email = i.author_email
                       where i.status <> 'dogrulandi' order by i.created_at asc limit 6) x),
    'recent',       (select coalesce(json_agg(x), '[]'::json) from (
                       select i.no, i.kind, i.status, i.title, i.page, i.created_at, i.source, coalesce(m.name, i.author_email) author,
                              (select count(*) from tp_votes v where v.item_id = i.id) votes,
                              (select count(*) from tp_comments c where c.item_id = i.id) comments
                       from tp_items i left join tp_members m on m.email = i.author_email
                       order by i.created_at desc limit 8) x),
    'people',       (select coalesce(json_agg(x order by x.role desc, x.name), '[]'::json) from (
                       select m.name, m.email, m.color, m.role,
                              (select count(*) from tp_items i where i.author_email = m.email) opened,
                              (select count(*) from tp_items i where i.author_email = m.email and i.status <> 'dogrulandi') open,
                              (select count(*) from tp_comments c where c.author_email = m.email) comments,
                              (select max(i.created_at) from tp_items i where i.author_email = m.email) last_at
                       from tp_members m) x)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_test_overview() from public, anon;
grant execute on function public.admin_test_overview() to authenticated;
