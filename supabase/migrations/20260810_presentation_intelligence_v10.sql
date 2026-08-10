-- ==========================================================================
-- Acadex Presentation Intelligence V10
-- Adds source/citation lineage, version history, generation telemetry and rehearsal data.
-- Safe to run after 20260807_add_academic_presentations.sql.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 0. Extend current presentation records without breaking V7/V8/V9 clients
-- --------------------------------------------------------------------------
alter table if exists public.presentations
  add column if not exists schema_version int not null default 10,
  add column if not exists presentation_mode text not null default 'academic',
  add column if not exists target_duration_seconds int,
  add column if not exists quality_score numeric(5,2),
  add column if not exists quality_report jsonb not null default '{}'::jsonb;

alter table if exists public.presentation_slides
  add column if not exists revision int not null default 0,
  add column if not exists source_refs jsonb not null default '[]'::jsonb,
  add column if not exists quality jsonb not null default '{}'::jsonb;

-- --------------------------------------------------------------------------
-- 1. Sources attached to a presentation
-- --------------------------------------------------------------------------
create table if not exists public.presentation_sources (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  source_type text not null check (source_type in ('topic','study_card','document','url','manual')),
  source_id uuid,
  title text not null default 'Kaynak',
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists presentation_sources_presentation_idx
  on public.presentation_sources (presentation_id, created_at desc);

alter table public.presentation_sources enable row level security;

-- --------------------------------------------------------------------------
-- 2. Claim-level citations for slides
-- --------------------------------------------------------------------------
create table if not exists public.presentation_slide_citations (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references public.presentation_slides(id) on delete cascade,
  source_id uuid not null references public.presentation_sources(id) on delete cascade,
  claim text not null default '',
  locator jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now()
);

create index if not exists presentation_slide_citations_slide_idx
  on public.presentation_slide_citations (slide_id);
create index if not exists presentation_slide_citations_source_idx
  on public.presentation_slide_citations (source_id);

alter table public.presentation_slide_citations enable row level security;

-- --------------------------------------------------------------------------
-- 3. Immutable-ish snapshots for restore / Acadia checkpoints
-- --------------------------------------------------------------------------
create table if not exists public.presentation_versions (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  version_no int not null check (version_no > 0),
  reason text not null default 'manual_snapshot',
  created_by_type text not null default 'user' check (created_by_type in ('user','acadia','system')),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (presentation_id, version_no)
);

create index if not exists presentation_versions_presentation_idx
  on public.presentation_versions (presentation_id, version_no desc);

alter table public.presentation_versions enable row level security;

-- --------------------------------------------------------------------------
-- 4. Generation pipeline telemetry
-- --------------------------------------------------------------------------
create table if not exists public.presentation_generation_runs (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid references public.presentations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null default 'generate',
  model text,
  status text not null default 'started' check (status in ('started','completed','failed','cancelled')),
  prompt_tokens int,
  completion_tokens int,
  latency_ms int,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists presentation_generation_runs_user_idx
  on public.presentation_generation_runs (user_id, created_at desc);
create index if not exists presentation_generation_runs_presentation_idx
  on public.presentation_generation_runs (presentation_id, created_at desc);

alter table public.presentation_generation_runs enable row level security;

-- --------------------------------------------------------------------------
-- 5. Rehearsal / presentation practice sessions
-- --------------------------------------------------------------------------
create table if not exists public.presentation_rehearsals (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_duration_seconds int,
  actual_duration_seconds int,
  slide_timings jsonb not null default '[]'::jsonb,
  feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists presentation_rehearsals_user_idx
  on public.presentation_rehearsals (user_id, created_at desc);
create index if not exists presentation_rehearsals_presentation_idx
  on public.presentation_rehearsals (presentation_id, created_at desc);

alter table public.presentation_rehearsals enable row level security;

-- --------------------------------------------------------------------------
-- 6. updated_at trigger for presentation_sources
-- --------------------------------------------------------------------------
drop trigger if exists presentation_sources_set_updated_at on public.presentation_sources;
create trigger presentation_sources_set_updated_at
  before update on public.presentation_sources
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- 7. Owner-only RLS policies
-- --------------------------------------------------------------------------

drop policy if exists "presentation_sources_owner_all" on public.presentation_sources;
create policy "presentation_sources_owner_all"
  on public.presentation_sources for all
  to authenticated
  using (
    exists (
      select 1 from public.presentations p
      where p.id = presentation_sources.presentation_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.presentations p
      where p.id = presentation_sources.presentation_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "presentation_citations_owner_all" on public.presentation_slide_citations;
create policy "presentation_citations_owner_all"
  on public.presentation_slide_citations for all
  to authenticated
  using (
    exists (
      select 1
      from public.presentation_slides s
      join public.presentations p on p.id = s.presentation_id
      where s.id = presentation_slide_citations.slide_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.presentation_slides s
      join public.presentations p on p.id = s.presentation_id
      join public.presentation_sources ps on ps.presentation_id = p.id
      where s.id = presentation_slide_citations.slide_id
        and ps.id = presentation_slide_citations.source_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "presentation_versions_owner_all" on public.presentation_versions;
create policy "presentation_versions_owner_all"
  on public.presentation_versions for all
  to authenticated
  using (
    exists (
      select 1 from public.presentations p
      where p.id = presentation_versions.presentation_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.presentations p
      where p.id = presentation_versions.presentation_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "presentation_generation_runs_select_own" on public.presentation_generation_runs;
create policy "presentation_generation_runs_select_own"
  on public.presentation_generation_runs for select
  to authenticated
  using (presentation_generation_runs.user_id = auth.uid());

drop policy if exists "presentation_generation_runs_insert_own" on public.presentation_generation_runs;
create policy "presentation_generation_runs_insert_own"
  on public.presentation_generation_runs for insert
  to authenticated
  with check (
    presentation_generation_runs.user_id = auth.uid()
    and (
      presentation_generation_runs.presentation_id is null
      or exists (
        select 1 from public.presentations p
        where p.id = presentation_generation_runs.presentation_id
          and p.user_id = auth.uid()
      )
    )
  );

drop policy if exists "presentation_generation_runs_update_own" on public.presentation_generation_runs;
create policy "presentation_generation_runs_update_own"
  on public.presentation_generation_runs for update
  to authenticated
  using (presentation_generation_runs.user_id = auth.uid())
  with check (presentation_generation_runs.user_id = auth.uid());

drop policy if exists "presentation_rehearsals_owner_all" on public.presentation_rehearsals;
create policy "presentation_rehearsals_owner_all"
  on public.presentation_rehearsals for all
  to authenticated
  using (
    presentation_rehearsals.user_id = auth.uid()
    and exists (
      select 1 from public.presentations p
      where p.id = presentation_rehearsals.presentation_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    presentation_rehearsals.user_id = auth.uid()
    and exists (
      select 1 from public.presentations p
      where p.id = presentation_rehearsals.presentation_id
        and p.user_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- 8. Optional helper view: citation coverage per presentation
-- --------------------------------------------------------------------------
create or replace view public.presentation_citation_coverage
with (security_invoker = true)
as
select
  p.id as presentation_id,
  count(distinct s.id) as slide_count,
  count(distinct case when c.id is not null then s.id end) as cited_slide_count,
  case
    when count(distinct s.id) = 0 then 0
    else round(
      count(distinct case when c.id is not null then s.id end)::numeric
      / count(distinct s.id)::numeric * 100,
      2
    )
  end as coverage_percent
from public.presentations p
left join public.presentation_slides s on s.presentation_id = p.id
left join public.presentation_slide_citations c on c.slide_id = s.id
group by p.id;

-- ==========================================================================
-- V10 application layer can now:
-- - attach sources and claim/page citations
-- - create restorable versions
-- - record generation stages and latency
-- - save rehearsal timing/feedback
-- ==========================================================================
