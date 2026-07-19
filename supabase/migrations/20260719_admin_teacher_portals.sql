-- ==========================================================================
-- Acadex: Dedicated Admin Panel + Academic (Hoca) Panel
--
-- This migration is NOT applied automatically — Claude/the dev assistant
-- cannot run SQL against your live Supabase project directly. Run this file
-- yourself via one of:
--   1. Supabase Studio → SQL Editor → paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- Context: the project already has a `profiles.is_admin` boolean flag (used
-- to show the hidden "Yönetici Gelen Kutusu" / "Pilot Impact Report" tabs
-- inside dashboard.html) and a `get_admin_report()` RPC. This migration
-- follows that same boolean-flag convention (rather than introducing a
-- separate `role` enum) and adds:
--
--   1. profiles.is_teacher      — marks an account as faculty/hoca.
--   2. profiles.is_suspended    — soft "disabled" flag admins can toggle
--                                  instantly from the UI (in addition to the
--                                  hard auth-level ban done via the
--                                  admin-manage-user Edge Function).
--   3. Helper SECURITY DEFINER functions current_is_admin()/current_is_teacher()
--      so RLS policies can check the caller's own flags without recursive
--      RLS lookups on `profiles`.
--   4. RLS policies granting admins full read/update on profiles, and
--      teachers read-only visibility into the students of their own
--      department (profiles, documents, study_cards, exams).
--   5. Two new tables: announcements (duyurular) and teacher_materials
--      (paylaşılan ders materyalleri link listesi), both department-scoped.
--   6. site_settings — small admin-editable key/value store used for the
--      maintenance banner / site-wide announcement banner.
--   7. Lightweight review columns on `exams` (teacher_note, teacher_reviewed)
--      so a hoca can leave feedback on an AI-graded exam without touching
--      the AI-generated grade itself.
--   8. A one-time bootstrap: promotes the account with your own coordinator
--      email (already used elsewhere in the codebase, e.g. js/main.js) to
--      admin, so you have access to /admin.html immediately after running
--      this file. Safe no-op if that profile doesn't exist yet.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. New profile flags
-- --------------------------------------------------------------------------
alter table public.profiles add column if not exists is_teacher boolean not null default false;
alter table public.profiles add column if not exists is_suspended boolean not null default false;

create index if not exists profiles_is_teacher_idx on public.profiles (is_teacher);
create index if not exists profiles_department_idx on public.profiles (department);

-- --------------------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER — bypass RLS internally so they can
--    be safely referenced *inside* RLS policies without infinite recursion)
-- --------------------------------------------------------------------------
create or replace function public.current_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_is_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_teacher from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_department()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select department from public.profiles where id = auth.uid();
$$;

-- --------------------------------------------------------------------------
-- 3. profiles RLS — admin full access, teacher read-only into own dept
-- --------------------------------------------------------------------------
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all"
  on public.profiles for select
  to authenticated
  using (public.current_is_admin());

drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all"
  on public.profiles for update
  to authenticated
  using (public.current_is_admin())
  with check (public.current_is_admin());

drop policy if exists "profiles_teacher_select_dept_students" on public.profiles;
create policy "profiles_teacher_select_dept_students"
  on public.profiles for select
  to authenticated
  using (
    public.current_is_teacher()
    and is_admin = false
    and is_teacher = false
    and department = public.current_department()
  );

-- --------------------------------------------------------------------------
-- 4. exams — teacher oversight (read-only + a note/reviewed flag) for their
--    department's students. Admins get full read for analytics/moderation.
-- --------------------------------------------------------------------------
alter table public.exams add column if not exists teacher_note text;
alter table public.exams add column if not exists teacher_reviewed boolean not null default false;
alter table public.exams add column if not exists teacher_reviewed_by uuid references public.profiles(id);
alter table public.exams add column if not exists teacher_reviewed_at timestamptz;

drop policy if exists "exams_admin_select_all" on public.exams;
create policy "exams_admin_select_all"
  on public.exams for select
  to authenticated
  using (public.current_is_admin());

drop policy if exists "exams_teacher_select_dept" on public.exams;
create policy "exams_teacher_select_dept"
  on public.exams for select
  to authenticated
  using (
    public.current_is_teacher()
    and exists (
      select 1 from public.profiles p
      where p.id = exams.user_id
        and p.department = public.current_department()
        and p.is_admin = false
        and p.is_teacher = false
    )
  );

-- NOTE: Postgres RLS is row-level, not column-level. This UPDATE policy lets
-- a teacher update a row for their own department's student; the admin.html
-- / teacher.html front-end is responsible for only ever sending
-- {teacher_note, teacher_reviewed, teacher_reviewed_by, teacher_reviewed_at}
-- in that update call so the AI-generated grade/answers are never touched
-- from the teacher UI.
drop policy if exists "exams_teacher_update_dept" on public.exams;
create policy "exams_teacher_update_dept"
  on public.exams for update
  to authenticated
  using (
    public.current_is_teacher()
    and exists (
      select 1 from public.profiles p
      where p.id = exams.user_id
        and p.department = public.current_department()
        and p.is_admin = false
        and p.is_teacher = false
    )
  )
  with check (
    public.current_is_teacher()
    and exists (
      select 1 from public.profiles p
      where p.id = exams.user_id
        and p.department = public.current_department()
        and p.is_admin = false
        and p.is_teacher = false
    )
  );

-- --------------------------------------------------------------------------
-- 5. documents — teachers need file_name for the exams/cards they review
-- --------------------------------------------------------------------------
drop policy if exists "documents_admin_select_all" on public.documents;
create policy "documents_admin_select_all"
  on public.documents for select
  to authenticated
  using (public.current_is_admin());

drop policy if exists "documents_teacher_select_dept" on public.documents;
create policy "documents_teacher_select_dept"
  on public.documents for select
  to authenticated
  using (
    public.current_is_teacher()
    and exists (
      select 1 from public.profiles p
      where p.id = documents.user_id
        and p.department = public.current_department()
        and p.is_admin = false
        and p.is_teacher = false
    )
  );

-- --------------------------------------------------------------------------
-- 6. study_cards — admin moderation (view + remove inappropriate shared
--    cards from the department feed). Teachers already implicitly see
--    shared cards for their own department through the existing student
--    feed query/policy, so no extra teacher policy is added here.
-- --------------------------------------------------------------------------
drop policy if exists "study_cards_admin_select_all" on public.study_cards;
create policy "study_cards_admin_select_all"
  on public.study_cards for select
  to authenticated
  using (public.current_is_admin());

drop policy if exists "study_cards_admin_delete_all" on public.study_cards;
create policy "study_cards_admin_delete_all"
  on public.study_cards for delete
  to authenticated
  using (public.current_is_admin());

-- --------------------------------------------------------------------------
-- 7. announcements (duyurular) — created by admin (any/all depts) or a
--    teacher (their own department only), visible to students of the
--    matching department (or everyone, when audience_department is null).
-- --------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience_department text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_role text not null default 'admin' check (created_by_role in ('admin', 'teacher')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists announcements_audience_idx on public.announcements (audience_department);

alter table public.announcements enable row level security;

drop policy if exists "announcements_select_relevant" on public.announcements;
create policy "announcements_select_relevant"
  on public.announcements for select
  to authenticated
  using (
    active = true
    and (audience_department is null or audience_department = public.current_department())
  );

drop policy if exists "announcements_admin_all" on public.announcements;
create policy "announcements_admin_all"
  on public.announcements for all
  to authenticated
  using (public.current_is_admin())
  with check (public.current_is_admin());

drop policy if exists "announcements_teacher_manage_own_dept" on public.announcements;
create policy "announcements_teacher_manage_own_dept"
  on public.announcements for all
  to authenticated
  using (
    public.current_is_teacher()
    and created_by = auth.uid()
    and audience_department = public.current_department()
  )
  with check (
    public.current_is_teacher()
    and created_by = auth.uid()
    and audience_department = public.current_department()
  );

-- --------------------------------------------------------------------------
-- 8. teacher_materials — lightweight shared-resource list (title + link)
--    a hoca posts for the students of their own department. Kept link-based
--    (no new storage bucket) to ship v1 quickly; can grow into a real file
--    upload later using the existing 'documents' storage bucket pattern.
-- --------------------------------------------------------------------------
create table if not exists public.teacher_materials (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  department text not null,
  title text not null,
  description text,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_materials_department_idx on public.teacher_materials (department);

alter table public.teacher_materials enable row level security;

drop policy if exists "teacher_materials_select_dept" on public.teacher_materials;
create policy "teacher_materials_select_dept"
  on public.teacher_materials for select
  to authenticated
  using (
    department = public.current_department()
    or public.current_is_admin()
  );

drop policy if exists "teacher_materials_teacher_manage_own" on public.teacher_materials;
create policy "teacher_materials_teacher_manage_own"
  on public.teacher_materials for all
  to authenticated
  using (
    public.current_is_teacher()
    and teacher_id = auth.uid()
    and department = public.current_department()
  )
  with check (
    public.current_is_teacher()
    and teacher_id = auth.uid()
    and department = public.current_department()
  );

drop policy if exists "teacher_materials_admin_all" on public.teacher_materials;
create policy "teacher_materials_admin_all"
  on public.teacher_materials for all
  to authenticated
  using (public.current_is_admin())
  with check (public.current_is_admin());

-- --------------------------------------------------------------------------
-- 9. site_settings — small admin-editable config store (maintenance mode,
--    site-wide banner). Publicly readable (anon + authenticated) so the
--    banner can render on the public landing/login pages too; writable by
--    admins only.
-- --------------------------------------------------------------------------
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.site_settings enable row level security;

drop policy if exists "site_settings_select_public" on public.site_settings;
create policy "site_settings_select_public"
  on public.site_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write"
  on public.site_settings for all
  to authenticated
  using (public.current_is_admin())
  with check (public.current_is_admin());

insert into public.site_settings (key, value) values
  ('maintenance_mode', '{"enabled": false, "message": ""}'::jsonb),
  ('site_banner', '{"enabled": false, "message": ""}'::jsonb),
  ('registration_domains', '{"domains": []}'::jsonb)
on conflict (key) do nothing;

-- --------------------------------------------------------------------------
-- 10. Bootstrap: make the known coordinator account an admin so you can log
--     into /admin.html immediately. Safe no-op if the profile isn't found.
--     (Edit the email below first if this isn't the account you want.)
-- --------------------------------------------------------------------------
update public.profiles
set is_admin = true
where email = 'suko.crc06@gmail.com';

-- ==========================================================================
-- After running this file:
--   • You (suko.crc06@gmail.com) are now an admin — open admin.html and log
--     in with your existing Acadex account.
--   • To make someone a hoca (teacher), use the Kullanıcılar tab in
--     admin.html and flip their "Hoca" toggle — no SQL needed after this.
--   • Deploy the new Edge Function: from the project root run
--       supabase functions deploy admin-manage-user
--     (needs SUPABASE_SERVICE_ROLE_KEY set as a project secret, same as the
--     existing delete-account function already relies on).
-- ==========================================================================
