-- ==========================================================================
-- Acadex Study Lab: dört yeni yöntem (hafıza sarayı, blurting, SQ3R,
-- neden zinciri) için izinli değerleri genişletir.
--
-- 20261014_study_lab.sql dosyasını DAHA ÖNCE çalıştırdıysan bunu da bir kez
-- çalıştır. Henüz hiç çalıştırmadıysan önce 20261014'ü, sonra bunu çalıştır
-- (zararı yok). Veri silmez; tekrar çalıştırmak güvenlidir.
-- ==========================================================================

alter table public.study_lab_sessions drop constraint if exists study_lab_sessions_method_check;
alter table public.study_lab_sessions add constraint study_lab_sessions_method_check
  check (method in ('pomodoro', 'tekrar', 'recall', 'feynman', 'karma', 'harita', 'cornell', 'loci', 'blurt', 'sq3r', 'neden'));

alter table public.study_lab_items drop constraint if exists study_lab_items_kind_check;
alter table public.study_lab_items add constraint study_lab_items_kind_check
  check (kind in ('harita', 'cornell', 'feynman', 'loci', 'blurt', 'sq3r', 'neden'));
