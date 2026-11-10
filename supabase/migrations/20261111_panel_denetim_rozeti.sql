-- ==========================================================================
-- ACADEX — TESLİM DENETİMİ ROZETİ PANELE TAŞINIR (sandbox_projects.denetim)
--
-- NEDEN VAR (11.11.2026, sandbox geliştirme — köprü adımı): geliştirici
-- sandbox'taki teslim denetimi raporu sandbox_workspaces.meta.denetim'de
-- duruyor ama o tablo RLS ile HERKESE KENDİ SATIRI: panel okuyucuları
-- başkasının denetimini göremez. Rozet bu yüzden yayın anında gönderi
-- satırına kopyalanır.
--
-- BİLİNÇLİ SINIRLAR:
--  1) YALNIZ { "ok": true, "at": <ms> } saklanır. Tam rapor maddeleri hata
--     metni taşıyabilir; kamuya çıkmaz. Check kısıtı olumsuz/başka biçimli
--     değeri de reddeder — panelde kimse "eksikli" diye damgalanamaz,
--     rozet yalnızca olumludur.
--  2) Bu bir SOSYAL ROZET, not değildir. İstemci yazar; API ile uydurmak
--     mümkündür ve kabul edilmiş bir sınırdır (tepki/inceleme ile aynı
--     güven düzeyi). Ölçme işi exam-engine'in alanıdır, buraya taşınmaz.
--
-- İstemci: js/acadex-ink.js -> savePost (feat.dn kademeli yedeği: kolon
-- henüz yokken YALNIZ denetim düşer, kind/tech kaybolmaz), toPost, postHTML.
-- Teste bağlı: tests/sandbox-etkilesim.js
-- ==========================================================================

alter table public.sandbox_projects
  add column if not exists denetim jsonb;

alter table public.sandbox_projects
  drop constraint if exists sandbox_projects_denetim_check;
alter table public.sandbox_projects
  add constraint sandbox_projects_denetim_check
  check (denetim is null or (denetim->>'ok') = 'true');
