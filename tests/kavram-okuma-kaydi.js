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

/* --------------------------------------------------------------------------
   ARAYÜZ: paintMastery'deki "notunu aç" yolu (10.11.2026)
   -------------------------------------------------------------------------- */

test('TEK toplu RPC — satır başına çağrı yok', () => {
  /* 10 satırlık haritada satır başına istek atmak 10 RPC demekti. Düğme çıkan
     kavramlar (level <= 1 || due) tek istekte sorulur, sonuç önbelleğe alınır
     ve loadData yenileyince temizlenir. */
  assert.match(ink, /rpc\('concept_study_sources', \{ p_concepts: eksik \}\)/,
    'toplu çağrı yok');
  assert.ok((ink.match(/rpc\('concept_study_sources'/g) || []).length === 1,
    'birden fazla çağrı yeri var — toplu olma özelliği kaybolmuş');
  assert.match(ink, /if \(Object\.prototype\.hasOwnProperty\.call\(SRC, c\.name\)\) return;/,
    'önbellek kontrolü yok — her paint tekrar çağırır');
  assert.match(ink, /var srcSifirla = function \(\)/, 'önbellek sıfırlayıcı yok');
  assert.match(ink, /if \(loading\) return loading;\n\s*\/\*[\s\S]{0,120}?\*\/\n\s*srcSifirla\(\);/,
    'loadData önbelleği temizlemiyor — kart silinse bile eski kaynak gösterilir');
});

test('EŞLEŞME SIRASI: masa dışında contains KABUL EDİLMEZ', () => {
  /* "faiz" gibi kısa kavramlar contains ile her şeyi yakalar; masa dışında
     kabul edilirse öğrenci alakasız bir belgeye yollanır. */
  const blok = ink.slice(ink.indexOf('var srcSec = function'),
                         ink.indexOf('var srcSec = function') + 700);
  assert.match(blok, /icinde\(x\) && x\.match_kind === 'exact'/, 'masa içi exact önce gelmiyor');
  assert.match(blok, /icinde\(x\) && x\.match_kind === 'contains'/, 'masa içi contains ikinci sırada değil');
  assert.match(blok, /if \(c\.desk && c\.desk\.code\) return l\.filter\(function \(x\) \{ return x\.match_kind === 'exact'/,
    'ders masasında genel exact dalı yok');
  /* Ders masası dalının İÇİNDE contains geçmemeli. Bloğu kesip bakıyoruz;
     mesafe tabanlı regex yanıltıcıydı (araya 50 karakter girince eşleşiyordu). */
  const dersDali = blok.slice(blok.indexOf('if (c.desk && c.desk.code)'));
  assert.ok(dersDali.indexOf('contains') < 0,
    'ders masasında contains kabul ediliyor — alakasız belge açılabilir');
  assert.ok(dersDali.indexOf("'exact'") > -1, 'ders masası dalı exact kullanmıyor');
});

test('RPC hatası SESSİZ: harita bozulmaz, istek tekrarlanmaz', () => {
  assert.match(ink, /if \(r\.error\) \{ srcHata = true; return; \}/, 'hata yutulmuyor');
  assert.match(ink, /if \(srcBusy \|\| srcHata \|\| !sb\(\) \|\| !me\(\)\) return;/,
    'hata sonrası istek tekrarlanıyor ya da oturumsuz çağrı yapılıyor');
});

test('SÜRE: yalnız görünür, tavan 1800, ölçülemezse NULL', () => {
  /* Üçü birlikte olmazsa ölçü yalan söyler: gizli sekmede 40 dakikalık sahte
     okuma, ya da 0 yazıp "göz attı" sanılması (PR #89). */
  assert.match(ink, /document\.addEventListener\('visibilitychange', o\.gorunurluk\)/,
    'gizli sekmede sayaç durmuyor');
  assert.match(ink, /visible_seconds: Math\.min\(1800, sn\)/, 'üst sınır uygulanmıyor');
  assert.match(ink, /if \(!o\.id \|\| !\(sn > 0\) \|\| !sb\(\)\) return;/,
    'süre 0 iken de yazılıyor — NULL kalmalı');
});

test('AÇILIŞ önce kaydedilir, süre sonra güncellenir', () => {
  /* Yalnız kapanışta yazılsaydı sekmeyi kapatan öğrencinin açılışı hiç
     kaydedilmezdi; açılış en güvenilir sinyal. */
  assert.match(ink, /from\('concept_study_opens'\)\.insert\(\{/, 'açılış eklenmiyor');
  assert.match(ink, /from\('concept_study_opens'\)\.update\(\{ visible_seconds/, 'süre güncellenmiyor');
  assert.match(ink, /window\.addEventListener\('pagehide', o\.kapat\)/, 'pagehide bağlanmamış');
  assert.match(ink, /attributeFilter: \['class'\]/, 'kart kapanışı izlenmiyor');
  assert.match(ink, /if \(!r\.error && r\.data && OKU === o\) o\.id = r\.data\.id;/,
    'geç dönen insert eski oturuma bağlanabilir');
});

test('kaynağı olmayan kavramda "notun yok" ve yükleme yolu', () => {
  assert.match(ink, /data-no-doc=""/, '"notun yok" düğmesi yok');
  assert.match(ink, /switchDashboardView\('docs'\)/, 'materyal yükleme ekranına götürmüyor');
  assert.match(ink, /SRC\[c\.name\] && !SRC\[c\.name\]\.length/,
    '"notun yok" henüz yüklenmemiş kavramda da çıkıyor olabilir');
});

test('mevcut "bu konudan deneme" düğmesi korundu', () => {
  assert.match(ink, /data-focus-key="/, 'kart masasındaki deneme düğmesi kaybolmuş');
  assert.match(ink, /data-practice="/, 'ders masasındaki deneme düğmesi kaybolmuş');
  assert.match(ink, /var acts = \(act \|\| oku\) \? '<span class="acts">' \+ act \+ oku/,
    'iki düğme tek hücrede toplanmıyor — .sn-mrow 5 kolonlu grid, düzen bozulur');
  assert.match(ink, /\+ acts \+ '<\/li>'/, 'satıra acts basılmıyor');
  const css = read('css/acadex-ink.css');
  assert.match(css, /\.sn-mrow \.acts\{display:flex;flex-wrap:wrap/,
    'acts hücresi sarmıyor — dar ekranda düğmeler taşar');
  /* ASIL DÜZEN BURADA. .sn-mrow sınav salonunda 5 kolonlu bir satır DEĞİL,
     "ring nm"/"ring lv"/"act act" alanlı bir KART; düğmeler grid-area:act
     ile alt şeride oturuyor. Sarmalayıcı o alanı devralmazsa örtük alana
     düşüp kartın dışına taşar — 10.11.2026'da canlıda böyle oldu. */
  const salon = read('css/acadex-sinav.css');
  assert.match(salon, /\.sn-mrow \.acts\{grid-area:act;display:flex;flex-wrap:wrap/,
    'salon stilinde acts "act" alanını devralmıyor — düğmeler karttan taşar');
  assert.match(salon, /\.sn-mrow \.acts \.sn-ghost\{margin-top:0/,
    'düğmelerin eski margin-top\'u sıfırlanmamış — çift boşluk olur');
  assert.match(salon, /grid-template-areas:"ring nm" "ring lv" "act act"/,
    'kart alan düzeni değişmiş — acts kuralının öncülü geçersiz');
});

summary();
