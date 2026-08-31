-- ==========================================================================
-- Acadex: cover photo for Sandbox Etkileşim Paneli project posts.
--
-- The "Yeni Proje Paylaş" composer (dashboard.html #share-project-modal)
-- already collects title/description/GitHub/live-demo/tags but has no way
-- to attach an image — this adds the column the upload flow in
-- js/dashboard.js (uploadSandboxProjectImage / the share-project-form
-- submit handler) writes to.
--
-- No new storage bucket or policy is needed: the upload reuses the existing
-- public 'avatars' bucket (supabase/migrations/20260830d_avatars_storage_bucket.sql),
-- whose RLS is already scoped to <user_id>/... (any object name under a
-- student's own folder), just under a project-<timestamp>.<ext> file name
-- instead of avatar.<ext>/banner.<ext>.
--
-- Safe to re-run — `add column if not exists`.
-- ==========================================================================

alter table public.sandbox_projects add column if not exists image_url text;
