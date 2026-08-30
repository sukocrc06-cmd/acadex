-- ==========================================================================
-- Acadex: profile page enrichment (Ayarlar).
--
-- Adds the fields for the four improvements şükrü picked for the profile
-- editing screen, alongside the real-photo-upload avatar work shipped in
-- 20260830d_avatars_storage_bucket.sql:
--   1. bio            — short "Hakkımda" text, shown next to a student's
--                       name on their Sandbox Etkileşim Paneli project posts
--                       (renderAuthorSocialLinksHtml / renderSandboxPostHtml
--                       in js/dashboard.js).
--   2. github_url / linkedin_url / website_url — social/portfolio links,
--                       shown as small icon links in that same spot.
--   3. banner_url     — cover photo for the Ayarlar page, uploaded to the
--                       SAME 'avatars' bucket as the profile photo (already
--                       scoped to <user_id>/ by that migration's RLS, so no
--                       new bucket/policy is needed for a second filename
--                       under that folder).
--   4. notification_prefs — jsonb toggle set for the new live toast+sound
--                       notifications (pollForLiveNotifications /
--                       showSocialNotificationToast in js/dashboard.js):
--                       a master sound on/off plus one flag per category
--                       (comments/likes/announcements/materials). Missing
--                       keys default to "on" client-side, so this column
--                       only needs to exist — no default value is required
--                       for existing behavior to stay unchanged.
--
-- All plain "add column if not exists" — safe to re-run, no data loss,
-- no RLS changes needed (the existing profiles update policy already lets a
-- student update their own row, which is all every field above needs).
-- ==========================================================================

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists github_url text;
alter table public.profiles add column if not exists linkedin_url text;
alter table public.profiles add column if not exists website_url text;
alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists notification_prefs jsonb;
