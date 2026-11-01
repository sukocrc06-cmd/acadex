/* ==========================================================================
   ACADEX — ZAYIF KAVRAM → NEREDE ANLATILIYOR (tests/kavram-kaynaklari.js)

   NEDEN VAR (01.11.2026): ustalık tahmini eksik değil — js/exam-engine.js
   içinde BKT + FSRS var (prior/slip/learn, soru tipine göre şans payı,
   "işaretledim"/ipucu güven ağırlıkları, az veri kapıları). Eksik olan ÇAREYDİ:
   js/dashboard.js -> loadWeakConceptMap() zayıf kavramı bulup "pratik yap"
   diyor, practiceWeakConcept() ise kaynağı zorla 'course'a çeviriyor. Döngü
   sınav → zayıf kavram → yine sınav; öğrenci içeriğe hiç dönmüyor.

   20261101c_kavram_kaynaklari.sql o boşluğu kapatan sunucu ayağını ekler.
   Bu test üç şeyi kilitler:
     1) Fonksiyon ustalık HESAPLAMIYOR — o iş exam-engine'de kalır, burada
        kopyası tutulmaz (CLAUDE.md §3).
     2) Eşleşme iki kademeli ve ETİKETLİ ('exact' | 'contains'). İkinci kademe
        şart: ders sınavlarının kavramları kartın key_terms dağarcığından
        gelmiyor (01.11'de ölçüldü: 68 denemenin 0'ı birebir eşleşti).
     3) SECURITY DEFINER DEĞİL ve auth.uid()'e bağlı — kullanıcı yalnız kendi
        indeksini görür.

   Çalıştırma:  node tests/kavram-kaynaklari.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

const sql = read('supabase/migrations/20261101c_kavram_kaynaklari.sql');
const indeksSql = read('supabase/migrations/20261101b_kavram_indeksi.sql');
const dash = read('js/dashboard.js');
const engine = read('js/exam-engine.js');

test('ustalık hesabı exam-engine\'de KALIYOR — SQL kopyasını tutmuyor', () => {
  // exam-engine'deki BKT/FSRS yerinde mi (çarenin dayandığı taraf)
  assert.match(engine, /MASTERY_PARAMS = \{ prior: 0\.3, slip: 0\.1, learn: 0\.1/,
    'BKT parametreleri değişmiş — bu testin öncülü geçersiz');
  assert.match(engine, /function masteryLevelOf\(p, okDays, n\)/, 'seviye kapısı yok');
  assert.match(engine, /Math\.pow\(1 \+ \(19 \/ 81\) \* days \/ stability, -0\.5\)/,
    'FSRS unutma eğrisi yok');
  // SQL tarafında ustalık/puan hesabı OLMAMALI
  for (const yasak of ['slip', 'prior', 'retention', 'mastery', 'stability']) {
    assert.ok(!new RegExp(`\\b${yasak}\\b`, 'i').test(sql.replace(/--[^\n]*/g, '')),
      `SQL '${yasak}' hesaplıyor — ustalık mantığı iki yere kopyalanmış`);
  }
});

test('eşleşme iki kademeli ve kademe ETİKETLİ dönüyor', () => {
  assert.match(sql, /match_kind\s+text/, 'match_kind dönmüyor — çağıran neye güveneceğini bilemez');
  assert.match(sql, /case when u\.concept_key = i\.k then 'exact' else 'contains' end/,
    'kademe etiketi üretilmiyor');
  assert.match(sql, /u\.concept_key like '%' \|\| i\.k \|\| '%'/, 'gevşek eşleşme yok');
  assert.match(sql, /i\.k like '%' \|\| u\.concept_key \|\| '%'/, 'ters yön gevşek eşleşme yok');
  assert.match(sql, /\(e\.match_kind = 'exact'\) desc/, 'birebir eşleşme öne alınmıyor');
});

test('anahtar normalizasyonu indeksle AYNI fonksiyondan geliyor', () => {
  assert.match(sql, /public\.concept_key_of\(c\)/,
    'kendi normalizasyonunu yazıyor — indeksle ayrışır');
  assert.match(indeksSql, /function public\.concept_key_of/,
    'concept_key_of 20261101b içinde tanımlı değil');
  // İki dosyada iki ayrı normalizasyon olmamalı
  assert.ok(!/lower\(|regexp_replace\(/.test(sql.replace(/--[^\n]*/g, '')),
    'SQL kendi lower/regexp normalizasyonunu kuruyor');
});

test('güvenlik: SECURITY DEFINER değil, auth.uid()\'e bağlı, anon çağıramaz', () => {
  assert.ok(!/security definer/i.test(sql), 'SECURITY DEFINER — RLS aşılır, başkasının indeksi görünür');
  assert.match(sql, /u\.user_id = auth\.uid\(\)/, 'kullanıcı süzgeci yok');
  assert.match(sql, /revoke all on function public\.concept_study_sources\(text\[\]\) from public/,
    'anon yetkisi geri alınmıyor');
  assert.match(sql, /grant execute on function public\.concept_study_sources\(text\[\]\) to authenticated, service_role/,
    'authenticated çağıramıyor — arayüz bağlanamaz');
  assert.match(sql, /\blanguage sql\b[\s\S]{0,20}\bstable\b/, 'STABLE işaretlenmemiş');
});

test('boş/null girdi patlamıyor', () => {
  assert.match(sql, /unnest\(coalesce\(p_concepts, '\{\}'::text\[\]\)\)/,
    'null dizi coalesce edilmiyor — fonksiyon hata verir');
  assert.match(sql, /where public\.concept_key_of\(c\) is not null/,
    'boş etiket süzülmüyor');
});

test('ÖLÇÜLEN BOŞLUK yerinde: çare hâlâ sınavdan sınava dönüyor', () => {
  /* Bu test arayüzü DEĞİŞTİRMEZ, durumu kaydeder. loadWeakConceptMap sınav
     platformunun içinde ve onu başka bir geliştirici ilerletiyor; bağlama işi
     ona ait. Burası yalnızca öncülün hâlâ geçerli olduğunu söyler: gün gelip
     "git şunu çalış" yolu eklenirse bu test düşer ve yorumu güncellenmelidir. */
  assert.match(dash, /async function loadWeakConceptMap\(\)/, 'zayıf kavram haritası kalkmış');
  const blok = dash.slice(dash.indexOf('function practiceWeakConcept'),
                          dash.indexOf('function practiceWeakConcept') + 400);
  assert.match(blok, /input\[name="exam-source"\]\[value="course"\]/,
    'practiceWeakConcept artık kaynağı course\'a çevirmiyor — öncül değişti');
  assert.ok(!/concept_study_sources/.test(dash),
    'arayüz artık fonksiyonu çağırıyor — bu testin yorumu güncellenmeli');
});

summary();
