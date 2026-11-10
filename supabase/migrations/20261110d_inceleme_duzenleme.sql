-- ==========================================================================
-- ACADEX — PANEL İNCELEMESİ DÜZENLENEBİLİR (sandbox_project_comments)
--
-- NEDEN VAR (10.11.2026): panelin canlı denetiminde Berkay'ın bulduğu boşluk —
-- kendi incelemende "sil" var ama "düzenle" yok. Tabloda update politikası
-- hiç yoktu; istemciye düzenleme eklemenin sunucu ayağı bu.
--
-- updated_at NULL = hiç düzenlenmedi. 0/now() ile doldurulmaz; süre
-- raporundaki ders aynı (bkz. 20261110_kavram_okuma_kaydi.sql madde 4):
-- "null = olmadı" ile "değer = oldu" ayrı kalmalı. Ekran " · düzenlendi"
-- ibaresini bu alandan türetir.
--
-- KOLON DÜZEYİNDE GRANT: yalnız content ve updated_at güncellenebilir.
-- Böylece inceleme sahibi bile project_id / user_id / parent_id / label
-- değiştiremez — inceleme başka gönderiye taşınamaz, yanıt zinciri
-- bozulamaz (concept_study_opens'taki visible_seconds kalıbının aynısı).
--
-- Teste bağlı: tests/sandbox-etkilesim.js
-- ==========================================================================

alter table public.sandbox_project_comments
  add column if not exists updated_at timestamptz;

drop policy if exists sandbox_project_comments_update_own
  on public.sandbox_project_comments;
create policy sandbox_project_comments_update_own
  on public.sandbox_project_comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke update on public.sandbox_project_comments from authenticated;
grant update (content, updated_at)
  on public.sandbox_project_comments to authenticated;
