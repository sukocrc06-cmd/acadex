-- ==========================================================================
-- Acadex: expand the student achievement/rozet system with 7 new milestone
-- badges, on top of the existing 9 "first X" badges.
--
-- The achievement system has two halves that both need an entry for a
-- badge to work end-to-end:
--   1. public.achievements — one row per badge (id, icon, title,
--      description), read by js/dashboard.js's renderStreakAndAchievements()
--      to render the full "Başarılarım" grid (locked + earned). THIS
--      migration adds rows here.
--   2. ACHIEVEMENTS_LOOKUP in js/achievements.js — the client-side copy
--      used only for the pop-up toast at the moment a badge is earned.
--      Already updated in this same change.
--
-- New badges (all volume/streak milestones layered onto existing
-- checkAndAward* functions in js/dashboard.js — no new tracking tables
-- needed, they reuse counts already being queried):
--   streak_100  — 100-day streak (existing streak_7 / streak_30 ladder)
--   summary_10  — 10th AI study card created
--   summary_50  — 50th AI study card created
--   exam_10     — 10th completed practice exam
--   perfect_5   — 5th 100/100 exam score
--   share_5     — 5th study card shared with department
--   notebook_10 — 10th notebook page saved
--
-- `on conflict (id) do nothing` makes this safe to re-run and safe even if
-- a row with the same id was already added by hand in Studio.
-- ==========================================================================

insert into public.achievements (id, icon, title, description) values
  ('streak_100',  '🏅', 'Demir İrade',            '100 gün boyunca kesintisiz aktif oldun.'),
  ('summary_10',  '📚', 'Not Koleksiyoncusu',      '10 bilgi kartı oluşturdun.'),
  ('summary_50',  '🏛️', 'Bilgi Kütüphanesi',       '50 bilgi kartı oluşturdun.'),
  ('exam_10',     '🏃', 'Sınav Maratoncusu',       '10 pratik sınav tamamladın.'),
  ('perfect_5',   '👑', 'Kusursuzluk Ustası',      '5 kez 100/100 aldın.'),
  ('share_5',     '🎁', 'Cömert Paylaşımcı',       'Bölümünle 5 bilgi kartı paylaştın.'),
  ('notebook_10', '🗂️', 'Defter Ustası',           '10 defter sayfası kaydettin.')
on conflict (id) do nothing;
