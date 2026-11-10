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
const dashHtml = read('dashboard.html');
const ink = read('js/acadex-ink.js');
const engine = read('js/exam-engine.js');

/* Bir ögenin KAPSAYAN div acilis etiketlerini dondurur (en yakindan uzaga).
   Satir numarasina bagli degil: 06-10.11 arasinda bu dosyanin numaralari uc kez
   kaydi (1096 -> 1075 -> 1127), o yuzden yapiya bakiyoruz. */
function kapsayanAcilislar(html, idx) {
  const re = /<div\b[^>]*>|<\/div>/gi;
  const parcalar = [];
  let m;
  while ((m = re.exec(html)) !== null && m.index < idx) parcalar.push(m[0]);
  const out = [];
  let acikKapanis = 0;
  for (let k = parcalar.length - 1; k >= 0; k--) {
    if (parcalar[k] === '</div>') acikKapanis++;
    else if (acikKapanis > 0) acikKapanis--;
    else out.push(parcalar[k]);
  }
  return out;
}

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

test('ÖLÇÜLEN BOŞLUK: zayıf konu listesi GİZLİ, çare paintMastery\'de olmalı', () => {
  /* ÖNCÜL DÜZELTİLDİ (10.11.2026).
     Bu test 01.11'de yanlış yeri işaret ediyordu: js/dashboard.js ->
     loadWeakConceptMap / practiceWeakConcept. O kod ekranda YOK —
     #exam-weak-concepts-list, dashboard.html'de display:none bir kabın
     içinde; sınav salonu yeniden tasarlanınca eski liste gizlendi.
     Ekrana çizen yol js/acadex-ink.js -> paintMastery (ustalık haritası) ve
     orada "bu konudan deneme" ZATEN var: kart masasında data-focus-key +
     data-concept ile aynı kartta deneme kurulumu açılıyor, yani karttan gelen
     zayıflıkta öğrenci ders ağacına atılmıyor. Eksik olan tek şey "oku" yolu.

     CLAUDE.md §4'ün dersi: bir UI işine girmeden önce ekrana çizen yolu
     doğrula. Bu hafta aynı tuzağa dört kez düşüldü (gizli .axr-legacy,
     sessiz tablolar ve burası). */

  // (a) Eski liste hâlâ gizli bir kabın içinde — yapıya bakıyoruz, satıra değil.
  const i = dashHtml.indexOf('id="exam-weak-concepts-list"');
  assert.ok(i > -1, '#exam-weak-concepts-list kalkmış — öncül değişti, yorumu güncelle');
  const gizli = kapsayanAcilislar(dashHtml, i).some((t) => /display\s*:\s*none/i.test(t));
  assert.ok(gizli,
    'zayıf konu listesi artık GÖRÜNÜR — çare oraya da eklenebilir, bu testi gözden geçir');

  // (b) Ekrana çizen yol ve orada hazır olan "deneme" düğmesi.
  assert.match(ink, /paintMastery/, 'ustalık haritası kalkmış — görünen yol değişti');
  assert.match(ink, /data-focus-key="/, 'kart masasında konu odaklı deneme düğmesi yok');
  assert.match(ink, /data-practice="/, 'ders masasında deneme düğmesi yok');

  // (c) Kalan boşluk: "oku" yolu. Bağlandığında acadex-ink'te olmalı,
  //     gizli dashboard yolunda DEĞİL.
  const inkte = /concept_study_sources/.test(ink);
  const dashte = /concept_study_sources/.test(dash);
  assert.ok(!dashte || inkte,
    'concept_study_sources yalnızca dashboard.js\'e bağlanmış — orası gizli, paintMastery\'ye taşı');
  if (!inkte && !dashte) {
    assert.ok(true, 'henüz bağlanmadı: sunucu ayağı hazır, arayüz bekliyor');
  }
});

summary();
