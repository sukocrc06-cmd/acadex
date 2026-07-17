-- ==========================================================================
-- Acadex: Department Feed quality voting ("faydalı buldum" / helpful votes)
--
-- This migration is NOT applied automatically — Claude/the dev assistant
-- cannot run SQL against your live Supabase project directly. Run this file
-- yourself via one of:
--   1. Supabase Studio → SQL Editor → paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- What it adds:
--   - study_card_votes: one row per (card, voter), used to compute a
--     helpful-vote count per shared study card and to know whether the
--     current student has already voted (so the UI can toggle un-vote).
--   - RLS policies so any authenticated student can see vote counts, but can
--     only insert/delete their OWN vote row.
-- ==========================================================================

create table if not exists public.study_card_votes (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.study_cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (card_id, user_id)
);

create index if not exists study_card_votes_card_id_idx on public.study_card_votes (card_id);

alter table public.study_card_votes enable row level security;

-- Any authenticated student can read vote rows (needed to compute counts
-- and to check "have I voted" client-side). No sensitive data is exposed —
-- just which user voted for which shared card.
drop policy if exists "study_card_votes_select_authenticated" on public.study_card_votes;
create policy "study_card_votes_select_authenticated"
  on public.study_card_votes for select
  to authenticated
  using (true);

-- Students can only cast a vote as themselves.
drop policy if exists "study_card_votes_insert_own" on public.study_card_votes;
create policy "study_card_votes_insert_own"
  on public.study_card_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Students can only remove their own vote (un-vote / toggle off).
drop policy if exists "study_card_votes_delete_own" on public.study_card_votes;
create policy "study_card_votes_delete_own"
  on public.study_card_votes for delete
  to authenticated
  using (auth.uid() = user_id);
