-- ==========================================================================
-- Acadex: crowdsourced "Ders Kaynakları" (course resources) for Ders Ağacı.
--
-- This migration is NOT applied automatically -- run it yourself via:
--   1. Supabase Studio -> SQL Editor -> paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- What this is for: students asked for Acadex to "know" which textbook a
-- course's real professor uses, so generated exams/summaries can be grounded
-- in the ACTUAL course material instead of the AI's generic guess. That fact
-- (which professor uses which book, this semester, at this university) is
-- not something any AI can know or look up -- it only exists in students'
-- and professors' heads. So instead of ever having the AI invent a textbook
-- name (which would be actively harmful if wrong -- a student could study
-- from the wrong book with false confidence), this lets students report it
-- themselves, exactly like study_cards.is_shared already crowdsources notes.
--
-- What it adds:
--   1. course_resources -- one row per student-submitted resource for a
--      catalog course: a textbook title/author, and/or a free-text note
--      about which topics/chapters the course actually covers. At least one
--      of book_title or topics_note must be filled in.
--   2. course_resource_votes -- one row per (resource, voter), mirroring
--      study_card_votes (20260717_add_study_card_votes.sql), so the most
--      trusted/confirmed entries surface first and low-quality or wrong
--      entries can be told apart from confirmed ones by vote count.
--
-- Both tables are readable by any authenticated student (this is shared,
-- department-wide reference info, not private data). Any authenticated
-- student can submit a resource (as themselves) or vote; a student can only
-- delete their OWN resource submission or vote; admins can delete ANY
-- resource (moderation, e.g. removing a wrong or spammy entry).
-- ==========================================================================

create table if not exists public.course_resources (
  id uuid primary key default gen_random_uuid(),
  course_code text not null references public.courses(course_code) on delete cascade,
  book_title text,
  book_author text,
  topics_note text,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint course_resources_has_content check (
    (book_title is not null and length(trim(book_title)) > 0)
    or (topics_note is not null and length(trim(topics_note)) > 0)
  )
);

create index if not exists course_resources_course_code_idx on public.course_resources (course_code);

create table if not exists public.course_resource_votes (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.course_resources(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (resource_id, user_id)
);

create index if not exists course_resource_votes_resource_id_idx on public.course_resource_votes (resource_id);

alter table public.course_resources enable row level security;
alter table public.course_resource_votes enable row level security;

drop policy if exists "course_resources_select_authenticated" on public.course_resources;
create policy "course_resources_select_authenticated"
  on public.course_resources for select
  to authenticated
  using (true);

drop policy if exists "course_resources_insert_own" on public.course_resources;
create policy "course_resources_insert_own"
  on public.course_resources for insert
  to authenticated
  with check (auth.uid() = submitted_by);

-- Students can remove their own submission (e.g. they made a typo and want
-- to resubmit); admins can remove ANY submission for moderation.
drop policy if exists "course_resources_delete_own_or_admin" on public.course_resources;
create policy "course_resources_delete_own_or_admin"
  on public.course_resources for delete
  to authenticated
  using (
    auth.uid() = submitted_by
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists "course_resource_votes_select_authenticated" on public.course_resource_votes;
create policy "course_resource_votes_select_authenticated"
  on public.course_resource_votes for select
  to authenticated
  using (true);

drop policy if exists "course_resource_votes_insert_own" on public.course_resource_votes;
create policy "course_resource_votes_insert_own"
  on public.course_resource_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "course_resource_votes_delete_own" on public.course_resource_votes;
create policy "course_resource_votes_delete_own"
  on public.course_resource_votes for delete
  to authenticated
  using (auth.uid() = user_id);
