-- ==========================================================================
-- Acadex: Academic Presentations (Akademik Sunum)
--
-- This migration is NOT applied automatically — run it yourself via:
--   1. Supabase Studio → SQL Editor → paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- What it adds:
--   1. presentations          — one row per student presentation
--   2. presentation_slides    — ordered slides belonging to a presentation
--   3. Storage bucket "presentation-images" for uploaded slide images
--   4. RLS so a student can only read/write their own presentations & slides
--
-- Design notes:
--   - content on slides is jsonb so we can store bullets, paragraphs,
--     table data, chart configs, etc. without schema changes later.
--   - layout_type controls the visual template of the slide
--     (title-content | two-column | image-left | image-right | quote |
--      chart | table | full-image | title-only).
--   - source_type + source_id let us track whether the presentation was
--     generated from a Study Card, a document, a free topic, or started blank.
--   - Images live in the presentation-images bucket under
--     {user_id}/{presentation_id}/{filename}. RLS on storage objects
--     restricts access to the owner.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. presentations
-- --------------------------------------------------------------------------
create table if not exists public.presentations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null default 'Adsız Sunum',
  course_tag    text,                          -- free-text, matches study_cards.course_tag style
  language      text not null default 'tr' check (language in ('tr', 'en')),
  theme         text not null default 'academic',
  source_type   text not null default 'blank'
                  check (source_type in ('blank', 'topic', 'study_card', 'document')),
  source_id     uuid,                          -- study_cards.id or documents.id when applicable
  status        text not null default 'draft'
                  check (status in ('draft', 'completed')),
  slide_count   int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists presentations_user_id_idx
  on public.presentations (user_id);

create index if not exists presentations_user_updated_idx
  on public.presentations (user_id, updated_at desc);

alter table public.presentations enable row level security;

-- Owner can do everything on their own rows
drop policy if exists "presentations_select_own" on public.presentations;
create policy "presentations_select_own"
  on public.presentations for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "presentations_insert_own" on public.presentations;
create policy "presentations_insert_own"
  on public.presentations for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "presentations_update_own" on public.presentations;
create policy "presentations_update_own"
  on public.presentations for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "presentations_delete_own" on public.presentations;
create policy "presentations_delete_own"
  on public.presentations for delete
  to authenticated
  using (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 2. presentation_slides
-- --------------------------------------------------------------------------
create table if not exists public.presentation_slides (
  id               uuid primary key default gen_random_uuid(),
  presentation_id  uuid not null references public.presentations(id) on delete cascade,
  order_index      int  not null default 0,
  title            text not null default '',
  content          jsonb not null default '{}'::jsonb,
  -- content shape examples:
  --   { "bullets": ["..."], "paragraph": "..." }
  --   { "table": { "headers": [...], "rows": [[...]] } }
  --   { "chart": { "type": "bar|pie|line", "labels": [...], "datasets": [...] } }
  speaker_notes    text not null default '',
  layout_type      text not null default 'title-content'
                     check (layout_type in (
                       'title-only',
                       'title-content',
                       'two-column',
                       'image-left',
                       'image-right',
                       'quote',
                       'chart',
                       'table',
                       'full-image'
                     )),
  image_url        text,                       -- public or signed URL from storage
  image_position   text default 'right'
                     check (image_position is null or image_position in ('left', 'right', 'background', 'full')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists presentation_slides_presentation_id_idx
  on public.presentation_slides (presentation_id);

create index if not exists presentation_slides_order_idx
  on public.presentation_slides (presentation_id, order_index);

alter table public.presentation_slides enable row level security;

-- Students can only touch slides that belong to a presentation they own.
-- We enforce this via a subquery against presentations.user_id.
drop policy if exists "presentation_slides_select_own" on public.presentation_slides;
create policy "presentation_slides_select_own"
  on public.presentation_slides for select
  to authenticated
  using (
    exists (
      select 1 from public.presentations p
      where p.id = presentation_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "presentation_slides_insert_own" on public.presentation_slides;
create policy "presentation_slides_insert_own"
  on public.presentation_slides for insert
  to authenticated
  with check (
    exists (
      select 1 from public.presentations p
      where p.id = presentation_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "presentation_slides_update_own" on public.presentation_slides;
create policy "presentation_slides_update_own"
  on public.presentation_slides for update
  to authenticated
  using (
    exists (
      select 1 from public.presentations p
      where p.id = presentation_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.presentations p
      where p.id = presentation_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "presentation_slides_delete_own" on public.presentation_slides;
create policy "presentation_slides_delete_own"
  on public.presentation_slides for delete
  to authenticated
  using (
    exists (
      select 1 from public.presentations p
      where p.id = presentation_id and p.user_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- 3. updated_at trigger helper (re-use if already exists, otherwise create)
-- --------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists presentations_set_updated_at on public.presentations;
create trigger presentations_set_updated_at
  before update on public.presentations
  for each row execute function public.set_updated_at();

drop trigger if exists presentation_slides_set_updated_at on public.presentation_slides;
create trigger presentation_slides_set_updated_at
  before update on public.presentation_slides
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- 4. Storage bucket for slide images
-- --------------------------------------------------------------------------
-- Create the bucket (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'presentation-images',
  'presentation-images',
  false,                          -- private; we will use signed URLs or owner policies
  5242880,                        -- 5 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Storage policies: path must start with the user's own uid
-- Expected path format: {user_id}/{presentation_id}/{filename}

drop policy if exists "presentation_images_select_own" on storage.objects;
create policy "presentation_images_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'presentation-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "presentation_images_insert_own" on storage.objects;
create policy "presentation_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'presentation-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "presentation_images_update_own" on storage.objects;
create policy "presentation_images_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'presentation-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "presentation_images_delete_own" on storage.objects;
create policy "presentation_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'presentation-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==========================================================================
-- After running this migration:
--   1. No Edge Function deploy is required yet (AI generation comes in step 7).
--   2. Frontend work can begin immediately against these tables.
-- ==========================================================================
