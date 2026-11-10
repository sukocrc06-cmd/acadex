-- ==========================================================================
-- ACADEX — ZAYIF KAVRAMDA "NOTUNU AÇ" KAYDI (public.concept_study_opens)
--
-- NEDEN VAR (10.11.2026): ustalık haritasındaki zayıf konulara "notunu aç"
-- düğmesi ekleniyor (js/acadex-ink.js -> paintMastery, kaynak
-- concept_study_sources). Bu tablo o açılışı kaydeder.
--
-- NEDEN ŞART: açılış kaydedilmezse "kart öğretmiyor" ile "öğrenci hiç
-- bakmadı" ayrılamaz. Ölçmek istediğimiz zincir üç terimli —
--   zayıf kavram → öğrenci o kartı açtı → sonraki denemede o kavramdaki puan
-- ve ortadaki terim bugün hiçbir yerde yok. study_lab_sessions'a bakıldı,
-- işe yaramıyor: 12 kayıt, yalnız 'pomodoro' ve 'feynman', 11'inin 3'ü karta
-- bağlı — o bir çalışma ARACI günlüğü, kart açılışı değil.
--
-- SÜRE NASIL ÖLÇÜLÜR (dördü de bilinçli):
--  1) Satır AÇILIŞTA eklenir, süre KAPANIŞTA güncellenir. Yalnızca kapanışta
--     yazılsaydı sekmeyi kapatan öğrencinin açılışı hiç kaydedilmezdi;
--     açılışın kendisi en güvenilir sinyal.
--  2) Yalnızca GÖRÜNÜR süre sayılır (visibilitychange ile sayaç durur).
--     Aksi halde kart açık kalıp başka sekmeye geçildiğinde 40 dakikalık
--     sahte bir "okuma" yazılır. Sınavdaki soru süresi de böyle çalışıyor.
--  3) ÜST SINIR 1800 sn; üstü kırpılır (check bunu zorluyor).
--  4) Ölçülemeyen süre NULL kalır, 0 YAZILMAZ. Sınav süre raporundaki hata
--     (PR #89) tam buydu: arka plandaki sekmede süreler 0 geliyordu ve rapor
--     0'ı gerçek değer sanıp yanlış öneri veriyordu. Analizde
--     "null = bilinmiyor" ile "küçük sayı = göz attı" ayrı kalmalı.
--
-- match_kind: eşleşmenin hangi kademeden geldiği ('exact' | 'contains').
-- Hangi kademenin gerçekten işe yaradığını sonra ölçebilmek için duruyor.
--
-- GÜVENLİK: istemci yalnızca kendi satırını ekler/okur ve YALNIZCA
-- visible_seconds kolonunu günceller (kolon düzeyinde grant). Böylece kavram,
-- kart ya da tarih sonradan değiştirilemez; açılış kaydı geriye dönük
-- uydurulamaz. anon'a hiçbir yetki yok.
--
-- Teste bağlı: tests/kavram-okuma-kaydi.js
-- ==========================================================================

create table if not exists public.concept_study_opens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                    references auth.users(id) on delete cascade,
  concept         text not null,
  study_card_id   uuid references public.study_cards(id) on delete set null,
  document_id     uuid references public.documents(id) on delete set null,
  match_kind      text,
  opened_at       timestamptz not null default now(),
  visible_seconds integer,
  constraint concept_study_opens_match_kind_check
    check (match_kind is null or match_kind in ('exact', 'contains')),
  /* NULL serbest: ölçülemeyen süre 0 değil bilinmiyor demektir (bkz. 4). */
  constraint concept_study_opens_visible_seconds_check
    check (visible_seconds is null or (visible_seconds >= 0 and visible_seconds <= 1800))
);

create index if not exists idx_concept_study_opens_user_concept
  on public.concept_study_opens (user_id, concept, opened_at);

alter table public.concept_study_opens enable row level security;

drop policy if exists "Kendi okuma kaydini ekler" on public.concept_study_opens;
create policy "Kendi okuma kaydini ekler"
  on public.concept_study_opens for insert
  with check (auth.uid() = user_id);

drop policy if exists "Kendi okuma kaydini gorur" on public.concept_study_opens;
create policy "Kendi okuma kaydini gorur"
  on public.concept_study_opens for select
  using (auth.uid() = user_id);

/* Güncelleme yalnız kendi satırı. Hangi KOLONUN güncellenebileceğini politika
   değil, aşağıdaki kolon düzeyinde grant belirliyor. */
drop policy if exists "Kendi okuma suresini gunceller" on public.concept_study_opens;
create policy "Kendi okuma suresini gunceller"
  on public.concept_study_opens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

/* SILME POLITIKASI YOK: kayıt silinemez, yoksa ölçüm geriye dönük temizlenir. */

revoke all on table public.concept_study_opens from anon, authenticated;
grant select, insert on table public.concept_study_opens to authenticated;
grant update (visible_seconds) on table public.concept_study_opens to authenticated;
grant all on table public.concept_study_opens to service_role;
