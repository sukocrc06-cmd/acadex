-- ==========================================================================
-- Acadex: real profile-photo uploads (Ayarlar → Avatar card).
--
-- Until now "Avatar" only meant the procedural DiceBear builder
-- (openAvatarBuilder/saveAvatar in js/dashboard.js) — profiles.avatar_url
-- already just holds a plain image URL, and renderUserAvatarHtml() already
-- renders it as <img src="...">, so a REAL uploaded photo needs no schema
-- change at all. What's missing is a storage bucket to upload it to.
--
-- This creates a public 'avatars' bucket (same pattern as the existing
-- 'documents' bucket, just world-readable since avatars are meant to be
-- seen by classmates/hocas everywhere in the app) and scopes writes to a
-- student's own folder: <user_id>/avatar.<ext>. Safe to re-run — bucket
-- insert is ON CONFLICT DO NOTHING and every policy is DROP-then-CREATE.
-- ==========================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone signed in can view any avatar (they're shown next to comments,
-- likes, shared cards, the sandbox feed, etc. across every account).
drop policy if exists "avatars_select_authenticated" on storage.objects;
create policy "avatars_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

-- A student may only write inside their own <user_id>/ folder — enforced by
-- checking the first path segment of the object name against auth.uid().
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
