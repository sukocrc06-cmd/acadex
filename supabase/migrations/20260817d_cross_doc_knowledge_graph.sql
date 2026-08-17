-- Madde 4: Cross-document knowledge graph
--
-- No new required columns — concept_graph already exists on study_cards (Madde 2).
-- This migration only adds an optional materialized index table for faster
-- cross-document concept lookup. The frontend works even if this table is empty
-- (it builds the graph client-side from study_cards.concept_graph + key_terms).
--
-- Optional: run a nightly job or "Refresh graph" button to populate user_concept_index.

create table if not exists public.user_concept_index (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_label text not null,
  concept_key text not null, -- normalized lowercase label for matching
  study_card_id uuid not null references public.study_cards(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  course_tag text,
  source text not null default 'concept_graph', -- concept_graph | key_term
  created_at timestamptz not null default now(),
  unique (user_id, concept_key, study_card_id)
);

create index if not exists idx_user_concept_index_user_key
  on public.user_concept_index (user_id, concept_key);

create index if not exists idx_user_concept_index_card
  on public.user_concept_index (study_card_id);

alter table public.user_concept_index enable row level security;

drop policy if exists "Users manage own concept index" on public.user_concept_index;
create policy "Users manage own concept index"
  on public.user_concept_index
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_concept_index is
  'Optional inverted index of concepts across a user''s study cards. Used by the cross-document knowledge graph UI. Frontend can rebuild this on demand.';
