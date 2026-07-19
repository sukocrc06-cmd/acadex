-- ==========================================================================
-- Acadex: Admin/Hoca panel round 2 — scheduling, audit log, student detail
-- view support.
--
-- Run this AFTER 20260719_admin_teacher_portals.sql. Same deal as always:
-- Claude cannot run this against your live project — paste it into
-- Supabase Studio → SQL Editor, or `supabase db push`.
--
-- What it adds:
--   1. announcements.starts_at / ends_at — lets a hoca schedule a duyuru
--      window; the select policy is updated so students only see
--      currently-active-by-date announcements.
--   2. study_cards_teacher_select_dept — lets a teacher see the full
--      study-card history (not just shared ones) of their own department's
--      students, needed for the new "Öğrenci Detay Görünümü" in
--      teacher.html.
--   3. admin_audit_log — records role changes, suspends, unsuspends and
--      deletes performed from admin.html, so there's a trail of who did
--      what to whom. Admin-manage-user (the Edge Function) writes rows
--      here directly with the service role; admin.html writes rows for
--      the actions it performs itself via RLS (role/flag toggles).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Announcement scheduling window
-- --------------------------------------------------------------------------
alter table public.announcements add column if not exists starts_at timestamptz;
alter table public.announcements add column if not exists ends_at timestamptz;

drop policy if exists "announcements_select_relevant" on public.announcements;
create policy "announcements_select_relevant"
  on public.announcements for select
  to authenticated
  using (
    active = true
    and (audience_department is null or audience_department = public.current_department())
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

-- --------------------------------------------------------------------------
-- 2. study_cards — teacher visibility into their own department's students
--    for the student detail view (full history, not just shared cards).
-- --------------------------------------------------------------------------
drop policy if exists "study_cards_teacher_select_dept" on public.study_cards;
create policy "study_cards_teacher_select_dept"
  on public.study_cards for select
  to authenticated
  using (
    public.current_is_teacher()
    and exists (
      select 1 from public.profiles p
      where p.id = study_cards.user_id
        and p.department = public.current_department()
        and p.is_admin = false
        and p.is_teacher = false
    )
  );

-- --------------------------------------------------------------------------
-- 3. admin_audit_log
-- --------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  action text not null, -- e.g. 'set_is_admin', 'set_is_teacher', 'suspend', 'unsuspend', 'delete'
  target_user_id uuid,
  target_label text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_log_admin_select" on public.admin_audit_log;
create policy "admin_audit_log_admin_select"
  on public.admin_audit_log for select
  to authenticated
  using (public.current_is_admin());

drop policy if exists "admin_audit_log_admin_insert" on public.admin_audit_log;
create policy "admin_audit_log_admin_insert"
  on public.admin_audit_log for insert
  to authenticated
  with check (public.current_is_admin() and actor_id = auth.uid());

-- ==========================================================================
-- After running this file, also redeploy the updated Edge Functions:
--   supabase functions deploy admin-manage-user
--   supabase functions deploy notify-role-change
-- (notify-role-change needs the same RESEND_API_KEY secret that
--  send-contact-notification already uses.)
-- ==========================================================================
