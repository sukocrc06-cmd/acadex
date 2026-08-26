-- Sesli Özet (AI Podcast) — real neural voice audio storage.
--
-- generate-podcast-audio uploads one MP3 per script line here (path:
-- {studyCardId}/{lineIndex}.mp3), then caches their public URLs on
-- study_cards.podcast_script.audio.urls. The edge function also tries to
-- create this bucket itself at runtime (createBucket is a no-op if it
-- already exists), so this migration is a belt-and-suspenders step —
-- it guarantees the bucket and its public-read policy exist even before
-- the function has run once, and gives you a single place to see how
-- access is configured.
--
-- The bucket is public-read: podcast audio is a spoken rendition of a
-- student's own already-summarized study material (not new sensitive
-- data), and paths are keyed by an unguessable study_cards.id (uuid), so
-- this is the same "public storage for generated non-sensitive assets"
-- pattern used by many apps rather than a real access-control boundary.
-- If you'd rather keep it fully private, drop the policy below and have
-- the frontend request short-lived signed URLs instead.

insert into storage.buckets (id, name, public)
values ('podcast-audio', 'podcast-audio', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read access for podcast audio" on storage.objects;
create policy "Public read access for podcast audio"
  on storage.objects
  for select
  using (bucket_id = 'podcast-audio');
