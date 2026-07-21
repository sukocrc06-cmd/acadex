-- ==========================================================================
-- ACADEX MIGRATION: Teacher (Academic) Self-Registration + Admin Approval
-- ==========================================================================
-- Run this in the Supabase SQL Editor. It only ADDS columns to the existing
-- public.profiles table — it does not touch any existing column, row, or
-- policy, so it is safe to run regardless of what has already been applied.
--
-- IMPORTANT: this migration assumes profiles.is_teacher and the admin RLS
-- policies from 20260719_admin_teacher_portals.sql already exist on this
-- database (that migration must be run first, if it hasn't been already).
-- Without it, is_teacher does not exist yet and the academic approval flow
-- in admin.js / register-academic.html will fail.
--
-- What this adds:
--   1. profiles.teacher_request_pending — set to true when someone signs up
--      through register-academic.html. It does NOT grant any access by
--      itself; it only flags the account for an admin to review in the
--      "Kullanıcılar & Roller" tab. Approving sets is_teacher = true and
--      clears this flag; rejecting just clears the flag.
--   2. profiles.teacher_title — optional free-text title/role the applicant
--      entered at signup (e.g. "Dr. Öğr. Üyesi", "Araş. Gör."), shown to the
--      admin reviewing the request. Never used for access control.
-- ==========================================================================

alter table public.profiles
  add column if not exists teacher_request_pending boolean default false;

alter table public.profiles
  add column if not exists teacher_title text;

-- Helpful for the admin panel's pending-applications query, though row
-- counts here are expected to stay small.
create index if not exists idx_profiles_teacher_request_pending
  on public.profiles (teacher_request_pending)
  where teacher_request_pending = true;
