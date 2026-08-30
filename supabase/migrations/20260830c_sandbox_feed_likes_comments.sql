-- ==========================================================================
-- Acadex: Developer Sandbox "Proje Galerisi" → social feed.
--
-- The gallery was already fully public by construction — every row in
-- sandbox_projects is visible to every signed-in student, with no
-- is_shared/visibility toggle to add. What was missing was the social layer
-- on top of that public feed: likes, comments, tags for browsing, a
-- "Popüler" sort, and the ability to edit a post after sharing it.
--
-- sandbox_projects itself was created directly in Supabase Studio, before
-- this repo tracked migrations — it is NOT defined anywhere else in this
-- folder. This migration only ADDS to it (new columns, two new child
-- tables); nothing here is destructive and it's safe to re-run.
--
-- New columns on sandbox_projects:
--   tags         text[]      — free-form tags (e.g. "web", "mobil"), shown
--                               as clickable filter chips in the feed
--   likes_count  integer     — denormalized counter kept in sync by the
--                               trigger below, so the feed can `order by
--                               likes_count desc` directly with no
--                               per-render aggregate query
--   updated_at   timestamptz — set whenever a student edits their own post;
--                               the feed shows "düzenlendi" when this is
--                               meaningfully later than created_at
--
-- New tables:
--   sandbox_project_likes    — one row per (project, student) like,
--                               modeled directly on study_card_votes
--                               (supabase/migrations/20260717_add_study_card_votes.sql)
--   sandbox_project_comments — one row per comment
--
-- New achievement:
--   project_popular ("Popüler Proje") — awarded to a project's OWNER (not
--   whoever did the liking) the moment one of their projects reaches 5
--   likes. This has to happen inside the trigger below (SECURITY DEFINER,
--   so it bypasses RLS) rather than from client JS, because the person
--   whose like pushes the count to 5 is essentially never the same person
--   who should receive the badge — a client-side insert for "some other
--   user_id" would be (correctly) rejected by user_achievements' own RLS.
-- ==========================================================================

alter table public.sandbox_projects add column if not exists tags text[] not null default '{}';
alter table public.sandbox_projects add column if not exists likes_count integer not null default 0;
alter table public.sandbox_projects add column if not exists updated_at timestamptz not null default now();

create table if not exists public.sandbox_project_likes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.sandbox_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table if not exists public.sandbox_project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.sandbox_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.sandbox_project_likes enable row level security;
alter table public.sandbox_project_comments enable row level security;

drop policy if exists "sandbox_project_likes_select_authenticated" on public.sandbox_project_likes;
create policy "sandbox_project_likes_select_authenticated" on public.sandbox_project_likes
  for select to authenticated using (true);

drop policy if exists "sandbox_project_likes_insert_own" on public.sandbox_project_likes;
create policy "sandbox_project_likes_insert_own" on public.sandbox_project_likes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "sandbox_project_likes_delete_own" on public.sandbox_project_likes;
create policy "sandbox_project_likes_delete_own" on public.sandbox_project_likes
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "sandbox_project_comments_select_authenticated" on public.sandbox_project_comments;
create policy "sandbox_project_comments_select_authenticated" on public.sandbox_project_comments
  for select to authenticated using (true);

drop policy if exists "sandbox_project_comments_insert_own" on public.sandbox_project_comments;
create policy "sandbox_project_comments_insert_own" on public.sandbox_project_comments
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "sandbox_project_comments_delete_own_or_admin" on public.sandbox_project_comments;
create policy "sandbox_project_comments_delete_own_or_admin" on public.sandbox_project_comments
  for delete to authenticated using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Keeps sandbox_projects.likes_count in sync, and awards "project_popular"
-- to the project's owner the instant a like pushes the count to exactly 5.
-- security definer so it can write both sandbox_projects and
-- user_achievements regardless of which student's like triggered it.
create or replace function public.bump_sandbox_project_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_count integer;
  v_owner_id uuid;
begin
  if TG_OP = 'INSERT' then
    update public.sandbox_projects
      set likes_count = likes_count + 1
      where id = new.project_id
      returning likes_count, user_id into v_new_count, v_owner_id;

    if v_new_count = 5 then
      insert into public.user_achievements (user_id, achievement_id)
      values (v_owner_id, 'project_popular')
      on conflict do nothing;
    end if;

    return new;
  elsif TG_OP = 'DELETE' then
    update public.sandbox_projects set likes_count = greatest(0, likes_count - 1) where id = old.project_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sandbox_project_likes_count on public.sandbox_project_likes;
create trigger trg_sandbox_project_likes_count
  after insert or delete on public.sandbox_project_likes
  for each row execute function public.bump_sandbox_project_likes_count();

insert into public.achievements (id, icon, title, description) values
  ('project_popular', '🌟', 'Popüler Proje', 'Sandbox''taki bir projen 5 beğeni aldı.')
on conflict (id) do nothing;
