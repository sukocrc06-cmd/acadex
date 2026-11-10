/* ==========================================================================
   ACADEX — KAVRAM OKUMA KAYDI (tests/kavram-okuma-kaydi.js)

   NEDEN VAR (10.11.2026): ustalık haritasındaki zayıf konulara "notunu aç"
   düğmesi ekleniyor; public.concept_study_opens o açılışı kaydediyor.

   Bu tablo ÖLÇÜM ARACI, ürün özelliği değil. Ölçmek istediğimiz zincir:
     zayıf kavram → öğrenci o kartı açtı → sonraki denemede o kavramdaki puan
   Ortadaki terim olmadan "kart öğretmiyor" ile "öğrenci hiç bakmadı"
   ayrılamaz. Bu yüzden testin işi, kaydı GÜVENİLİR tutan dört kuralı
   kilitlemek — biri gevşerse ölçüm sessizce yalan söylemeye başlar:

     1) süre NULL olabilmeli   → ölçülemeyen süre 0 değil "bilinmiyor"
     2) süre 0..1800 arası     → gizli sekmede biriken sahte saatler girmesin
     3) güncelleme YALNIZ visible_seconds → kavram/kart/tarih sonradan
        değiştirilemesin, açılış geriye dönük uydurulamasın
     4) anon yetkisiz, RLS açık, satır sahibi dışında kimse görmesin

   (1) özellikle önemli: sınav süre raporundaki hata (PR #89) 0'ı gerçek değer
   sanmaktan çıkmıştı. Aynı tuzağa burada düşmeyelim diye check NULL'a izin
   veriyor ve testi bunu doğruluyor.

   Çalıştırma:  node tests/kavram-okuma-kaydi.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

const sql = read('supabase/migrations/20261110_kavram_okuma_kaydi.sql');
const ink = read('js/acadex-ink.js');
const kaynakSql = read('supabase/migrations/20261101c_kavram_kaynaklari.sql');

test('süre NULL olabilir — ölçülemeyen süre 0 DEĞİL', () => {
  /* PR #89 dersi: 0 yazılırsa analiz "göz attı" sanır. */
  assert.ok(/visible_seconds integer(?!\s+not null)/.test(sql),
    'visible_seconds NOT NULL yapılmış — ölçülemeyen süre 0 olmak zorunda kalır');
  assert.match(sql, /visible_seconds is null or/,
    'check NULL\'a izin vermiyor');
});

test('süre üst sınırı 1800 ve negatif kabul edilmiyor', () => {
  assert.match(sql, /visible_seconds >= 0 and visible_seconds <= 1800/,
    'sınır yok — gizli sekmede biriken sahte saatler kaydedilebilir');
});

test('GÜNCELLEME yalnız visible_seconds kolonuna açık', () => {
  /* Asıl koruma burada: kolon düzeyinde grant. Politika satırı sınırlar,
     kolonu sınırlamaz — ikisi birlikte gerekiyor. */
  assert.match(sql, /grant update \(visible_seconds\) on table public\.concept_study_opens to authenticated/,
    'kolon düzeyinde update yetkisi yok');
  assert.ok(!/grant[^;]*\bupdate\b(?!\s*\()[^;]*on table public\.concept_study_opens[^;]*to authenticated/.test(sql),
    'authenticated\'a kolonsuz UPDATE verilmiş — kavram/kart/tarih değiştirilebilir');
  assert.match(sql, /for update\s*\n?\s*using \(auth\.uid\(\) = user_id\)/,
    'update politikası satır sahibini doğrulamıyor');
});

test('anon yetkisiz, RLS açık, sahibi dışında kimse göremez', () => {
  assert.match(sql, /revoke all on table public\.concept_study_opens from anon, authenticated/,
    'önce revoke edilmemiş — varsayılan yetkiler açık kalabilir');
  assert.ok(!/to anon/.test(sql), 'anon\'a yetki verilmiş');
  assert.match(sql, /enable row level security/, 'RLS açılmamış');
  assert.match(sql, /for select\s*\n?\s*using \(auth\.uid\(\) = user_id\)/,
    'select politikası sahibe bağlı değil');
  assert.match(sql, /for insert\s*\n?\s*with check \(auth\.uid\(\) = user_id\)/,
    'insert politikası sahibe bağlı değil');
});

test('SİLME politikası YOK — kayıt geriye dönük temizlenemez', () => {
  assert.ok(!/for delete/i.test(sql),
    'delete politikası eklenmiş; ölçüm kaydı silinebilir hale gelir');
  assert.ok(!/grant[^;]*\bdelete\b[^;]*to authenticated/.test(sql),
    'authenticated\'a delete yetkisi verilmiş');
});

test('bağlar ve indeks: kart/belge silinince kayıt kalır, sorgu hızlı', () => {
  /* Kart silinince satır SİLİNMEMELİ (set null): "o kart artık yok" bilgisi
     de ölçümün parçası. Kullanıcı silinince cascade, çünkü kişisel veri. */
  assert.match(sql, /study_card_id\s+uuid references public\.study_cards\(id\) on delete set null/,
    'kart silininceki davranış set null değil');
  assert.match(sql, /document_id\s+uuid references public\.documents\(id\) on delete set null/,
    'belge silininceki davranış set null değil');
  assert.match(sql, /user_id[\s\S]{0,80}references auth\.users\(id\) on delete cascade/,
    'kullanıcı silininceki davranış cascade değil');
  assert.match(sql, /on public\.concept_study_opens \(user_id, concept, opened_at\)/,
    'indeks yok ya da kolonları farklı');
});

test('match_kind yalnız concept_study_sources\'ın ürettiği iki değeri alır', () => {
  assert.match(sql, /match_kind is null or match_kind in \('exact', 'contains'\)/,
    'match_kind serbest metin — hangi kademenin işe yaradığı sonra ölçülemez');
  // Kaynak fonksiyon gerçekten bu iki değeri üretiyor mu (tek doğruluk kaynağı).
  assert.match(kaynakSql, /then 'exact' else 'contains' end as match_kind/,
    'concept_study_sources artık başka kademe üretiyor — check güncellenmeli');
});

test('öğrencinin kendi verisi indirme listesine eklendi', () => {
  /* Yeni bir kişisel veri tablosu, dışa aktarmada da görünmeli. */
  assert.match(ink, /\['kavram_okumalari', 'concept_study_opens', 'user_id'\]/,
    'dışa aktarma listesinde yok — öğrenci kendi okuma kaydını indiremez');
});

summary();
