-- ==========================================================================
-- Acadex Test Paneli (acadex.com.tr/panel) — 24.10.2026
-- Şevval, Asude ve Cemre'nin ortak hata / tasarım / öneri panosu.
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak zarar vermez
-- (if not exists / or replace / drop-then-create).
--
--   tp_members  : panele girebilen e-postalar (owner = sen, tester = test ekibi)
--   tp_items    : kayıtlar (hata / tasarim / oneri) + durum akışı
--   tp_history  : kim, ne zaman, hangi durumu değiştirdi
--   test-panel  : ekran görüntüleri (gizli depo; yalnızca ekip görür)
--
-- Uygulamanın mevcut tablolarına dokunmaz. Giriş Acadex hesabıyla yapılır;
-- test ekibinin Acadex hesabı yoksa önce yönetim panelinden davet et
-- (kapalı beta: access_invites).
-- ==========================================================================

-- ---------- ekip ----------
create table if not exists public.tp_members (
  email      text primary key check (email = lower(email) and position('@' in email) > 1),
  name       text not null check (char_length(name) between 1 and 40),
  role       text not null default 'tester' check (role in ('owner', 'tester')),
  color      text not null default '#E06AA0' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);
alter table public.tp_members enable row level security;

create or replace function public.tp_my_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.tp_is_member()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from tp_members where email = public.tp_my_email());
$$;

create or replace function public.tp_is_owner()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from tp_members where email = public.tp_my_email() and role = 'owner');
$$;

-- panelin sahibi (sen). Test ekibini panelin "Ekip" penceresinden eklersin.
insert into public.tp_members (email, name, role, color)
values ('suko.crc06@gmail.com', 'Şükrü', 'owner', '#1A2A5C')
on conflict (email) do update set role = 'owner';

drop policy if exists tp_members_select on public.tp_members;
create policy tp_members_select on public.tp_members for select to authenticated using (public.tp_is_member());
drop policy if exists tp_members_owner_write on public.tp_members;
create policy tp_members_owner_write on public.tp_members for all to authenticated
  using (public.tp_is_owner()) with check (public.tp_is_owner());

-- sahip kendini silemesin / sahipliğini düşüremesin (panel kilitlenmesin)
create or replace function public.tp_members_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then
    if old.email = public.tp_my_email() then raise exception 'Kendini ekipten çıkaramazsın' using errcode = '42501'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.email = public.tp_my_email() and new.role <> 'owner' and old.role = 'owner' then
    raise exception 'Kendi sahipliğini kaldıramazsın' using errcode = '42501';
  end if;
  new.email := lower(trim(new.email));
  return new;
end $$;
drop trigger if exists tp_members_guard on public.tp_members;
create trigger tp_members_guard before insert or update or delete on public.tp_members
  for each row execute function public.tp_members_guard();

-- ---------- kayıtlar ----------
create table if not exists public.tp_items (
  id           uuid primary key default gen_random_uuid(),
  no           bigint generated always as identity,
  kind         text not null check (kind in ('hata', 'tasarim', 'oneri')),
  status       text not null default 'yeni' check (status in ('yeni', 'inceleniyor', 'duzeltildi', 'dogrulandi')),
  title        text not null check (char_length(title) between 3 and 160),
  page         text not null default '',
  device       text not null default '',
  detail       jsonb not null default '{}'::jsonb,   -- adimlar[], beklenen, olan, aciklama, olmali, neden, ortam
  shots        text[] not null default '{}',          -- test-panel deposundaki yollar
  author_email text not null default public.tp_my_email(),
  author_id    uuid default auth.uid(),
  status_by    text,
  status_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists tp_items_created_idx on public.tp_items (created_at desc);
alter table public.tp_items enable row level security;

create table if not exists public.tp_history (
  id          bigint generated always as identity primary key,
  item_id     uuid not null references public.tp_items(id) on delete cascade,
  actor_email text not null,
  action      text not null,              -- olusturdu | durum | duzenledi
  from_status text,
  to_status   text,
  at          timestamptz not null default now()
);
create index if not exists tp_history_item_idx on public.tp_history (item_id, at);
alter table public.tp_history enable row level security;

-- yazar alanları sunucuda doldurulur; içeriği yalnız yazan ya da sahip değiştirir,
-- durumu ekipten herkes ilerletebilir (geçmişe yazılır)
create or replace function public.tp_items_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare me text := public.tp_my_email();
begin
  if tg_op = 'INSERT' then
    new.author_email := me; new.author_id := auth.uid();
    new.status := 'yeni'; new.status_by := null; new.status_at := null;
    new.created_at := now(); new.updated_at := now();
    return new;
  end if;
  new.author_email := old.author_email; new.author_id := old.author_id; new.created_at := old.created_at;
  if old.author_email <> me and not public.tp_is_owner()
     and (new.kind, new.title, new.page, new.device, new.detail, new.shots)
         is distinct from (old.kind, old.title, old.page, old.device, old.detail, old.shots) then
    raise exception 'Bu kaydı yalnızca yazan kişi düzenleyebilir' using errcode = '42501';
  end if;
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.status_by := me; new.status_at := now();
    insert into tp_history (item_id, actor_email, action, from_status, to_status) values (new.id, me, 'durum', old.status, new.status);
  elsif (new.kind, new.title, new.page, new.device, new.detail, new.shots)
        is distinct from (old.kind, old.title, old.page, old.device, old.detail, old.shots) then
    insert into tp_history (item_id, actor_email, action) values (new.id, me, 'duzenledi');
  end if;
  return new;
end $$;
drop trigger if exists tp_items_guard on public.tp_items;
create trigger tp_items_guard before insert or update on public.tp_items
  for each row execute function public.tp_items_guard();

create or replace function public.tp_items_created()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into tp_history (item_id, actor_email, action, to_status) values (new.id, new.author_email, 'olusturdu', new.status);
  return null;
end $$;
drop trigger if exists tp_items_created on public.tp_items;
create trigger tp_items_created after insert on public.tp_items
  for each row execute function public.tp_items_created();

drop policy if exists tp_items_select on public.tp_items;
create policy tp_items_select on public.tp_items for select to authenticated using (public.tp_is_member());
drop policy if exists tp_items_insert on public.tp_items;
create policy tp_items_insert on public.tp_items for insert to authenticated with check (public.tp_is_member());
drop policy if exists tp_items_update on public.tp_items;
create policy tp_items_update on public.tp_items for update to authenticated using (public.tp_is_member()) with check (public.tp_is_member());
drop policy if exists tp_items_delete on public.tp_items;
create policy tp_items_delete on public.tp_items for delete to authenticated
  using (public.tp_is_member() and (author_email = public.tp_my_email() or public.tp_is_owner()));

drop policy if exists tp_history_select on public.tp_history;
create policy tp_history_select on public.tp_history for select to authenticated using (public.tp_is_member());
-- tp_history'ye yalnızca tetikleyiciler yazar (insert politikası yok)

-- ---------- canlı güncelleme (üç kişi aynı anda) ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tp_items') then
    alter publication supabase_realtime add table public.tp_items;
  end if;
end $$;

-- ---------- ekran görüntüleri ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('test-panel', 'test-panel', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists tp_shots_select on storage.objects;
create policy tp_shots_select on storage.objects for select to authenticated
  using (bucket_id = 'test-panel' and public.tp_is_member());
drop policy if exists tp_shots_insert on storage.objects;
create policy tp_shots_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'test-panel' and public.tp_is_member() and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists tp_shots_delete on storage.objects;
create policy tp_shots_delete on storage.objects for delete to authenticated
  using (bucket_id = 'test-panel' and ((storage.foldername(name))[1] = auth.uid()::text or public.tp_is_owner()));
