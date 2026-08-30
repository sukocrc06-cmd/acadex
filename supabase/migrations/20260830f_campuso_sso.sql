-- ==========================================================================
-- Acadex: Campuso SSO for hoca (teacher) accounts.
--
-- Academic self-registration (register-academic.html + the admin approval
-- queue in admin.html/admin.js) is removed as of this change. Hoca accounts
-- now arrive exclusively through Campuso: a teacher who is already
-- "academician" on Campuso clicks a button on their Campuso dashboard,
-- Campuso's server calls the new supabase/functions/campuso-sso Edge
-- Function (authenticated with a shared secret, never exposed to a
-- browser), and that function finds-or-creates the matching Acadex
-- profiles row with is_teacher = true and signs them straight into
-- teacher.html via a Supabase magic link (see sso-callback.html).
--
-- This migration adds the one column that flow needs: a stable link back
-- to the Campuso account that isn't affected by an email address changing
-- on either side. Email is still used as the first-time lookup key (a
-- brand-new Campuso teacher won't have this set yet), but once linked,
-- campuso_user_id is what's actually used to find the same person again on
-- every future visit.
--
-- Plain "add column if not exists" — safe to re-run, no data loss, no RLS
-- changes needed (this column is only ever written by the service-role
-- Edge Function, never directly by a client).
-- ==========================================================================

alter table public.profiles add column if not exists campuso_user_id text;

-- Partial unique index: only enforced once a row actually has a Campuso
-- link, so it never conflicts with the many existing profiles that don't.
create unique index if not exists profiles_campuso_user_id_idx
  on public.profiles (campuso_user_id)
  where campuso_user_id is not null;
