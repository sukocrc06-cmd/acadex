/* ==========================================================================
   ACADEX — GEMINI DEVRE KESICI + ISCI NOBETCISI (tests/gemini-devre.js)

   NEDEN VAR (25.10.2026, BF415 Week01 Ch01 "isleniyor %25"te kaldi):
     23.10'dan beri Gemini her kosuda olu akis veriyordu (ilk byte 15 sn,
     sonra 72 sn olay yok, 87 sn'de dusus). Groq yedek yolu ancak ondan sonra
     basliyor, 49 sayfalik belgede TokenPacer 57 sn bekledi ve isci 150 sn'de
     546 ile kapatildi; belge 'processing' kaldi.
       - BUTUN Gemini modelleri kota/gecici hata verince 5 dk devre kesici
         acilir (27.10.2026'da daraltildi: ilk hali tek bir olu akista 30 dk
         aciliyordu), bu surede Gemini denenmez, Groq butun butceyle baslar.
       - Devre acikken uretilen kart onbellege kalici yazilmaz.
       - 141. saniyede belge hala 'processing' ise 'failed' isaretlenir.
       - Istemci 546/504 alirsa belgeyi 'failed' yapar (tekrar dene).

   Calistirma:  node tests/gemini-devre.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const src = read('supabase/functions/summarize-document/index.ts');
const { test, summary } = makeRunner();

test('devre kesici sabitleri ve site_settings anahtari', () => {
  /* 30 -> 5 dk (27.10.2026). Hedef "Gemini her durumda": devre acikken
     Gemini geri gelse bile denenmiyor, sure kisa olmali. */
  const m = src.match(/const GEMINI_DEVRE_MS = (\d+) \* 60_000/);
  assert.ok(m, 'GEMINI_DEVRE_MS tanimli olmali');
  assert.ok(Number(m[1]) >= 1 && Number(m[1]) <= 10, `devre ${m[1]} dk — Gemini gereksiz uzun kapali kalir`);
  assert.match(src, /const GEMINI_DEVRE_ANAHTAR = 'gemini_devre'/);
  assert.match(src, /async function geminiDevreOku\(/);
  assert.match(src, /async function geminiDevreAc\(/);
});

test('devre acikken Gemini denenmez ve kart onbellege kalici yazilmaz', () => {
  const kapi = src.indexOf('} else if (devre && devre.acik) {');
  const cagri = src.indexOf('geminiResult = await geminiDraft(');
  assert.ok(kapi > 0 && cagri > kapi, 'devre kapisi geminiDraft cagrisindan once olmali');
  const dal = src.slice(kapi, src.indexOf('} else if (!geminiMime)', kapi));
  assert.match(dal, /geminiTani\.geciciDustu = true/);
});

test('devre YALNIZCA butun modeller dustugunde acilir (tek olu akista degil)', () => {
  const cagri = src.indexOf('geminiResult = await geminiDraft(');
  const sonra = src.slice(cagri, cagri + 6000);
  assert.match(sonra, /if \(!geminiResult && geminiTani\.hepsiDustu\) \{\n\s*await geminiDevreAc\(serviceClient/);
  assert.doesNotMatch(sonra, /if \(!geminiResult && geminiTani\.geciciDustu\) \{\n\s*await geminiDevreAc/,
    'tek bir gecici hata hala devreyi aciyor');
  // Bayrak geminiDraft'in tek cikisinda, BUTUN adaylara bakilarak konuyor.
  assert.match(src, /if \(tani && geminiModelCandidates\(\)\.every\(\(m\) => geciciModeller\.has\(m\)\)\) tani\.hepsiDustu = true/);
});

// ---------------------------------------------------------------------------
// KOTA 429 (27.10.2026)
// ---------------------------------------------------------------------------
/* Olculen kosu (27.10, 18:40, RSH Hemsireligi): 3.7-flash olu akis, yedekler
   3.5 -> 429, 3.6 -> 429, 3.8 -> 503. Devre kesici ACILMADI ve kart 87
   saniyesini Gemini'ye kaptirdi; 3. pencere, anlati yazari ve review
   butceye sigmadi. Sebep: 429 dali `geciciModeller`'e model EKLEMIYORDU,
   devrenin tek tetigi ise hepsiDustu idi. Kota bittigi gun her yukleme
   ayni 87 saniyeyi yeniden yakiyordu. */

test('kota 429 devre kesiciye BAGLI (tetik artik doluyor)', () => {
  /* 429 dali modeli dusmus sayiyor: limit projenin oldugu icin o model
     bir sonraki istekte de ayni cevabi verecek. */
  const i = src.indexOf('if (res.status === 429) {');
  assert.ok(i > 0, '429 dali kaybolmus');
  const dal = src.slice(i, i + 900);
  assert.match(dal, /kota429Gorulen = true/, '429 kosu bayragini kurmuyor');
  assert.match(dal, /geciciModeller\.add\(model\)/, '429 modeli dusmus saymiyor — devre yine acilmaz');
  // Gunluk sozcugu gecen 429 de ayni bayragi kurmali.
  const g = src.indexOf('if (geminiQuotaExhausted(res.status, res.body)) {');
  assert.match(src.slice(g, g + 200), /kota429Gorulen = true/, 'gunluk 429 bayragi kurmuyor');
});

test('kota 429 TEK BASINA devreyi aciyor, hepsiDustu beklenmiyor', () => {
  const cagri = src.indexOf('geminiResult = await geminiDraft(');
  const sonra = src.slice(cagri, cagri + 6000);
  assert.match(sonra, /if \(!geminiResult && geminiTani\.kota429\) \{\n\s*await geminiDevreAc\(serviceClient, 'Gemini kota limiti \(429\)', GEMINI_KOTA_DEVRE_MS\)/,
    'kota dali yok ya da kendi suresini gecmiyor');
  // Kota dali hepsiDustu'dan ONCE: oteki adaylari denemek ayni limite carpmak.
  assert.ok(sonra.indexOf('geminiTani.kota429') < sonra.indexOf('geminiTani.hepsiDustu'),
    'kota dali hepsiDustu dalindan sonraya kalmis');
  assert.match(src, /if \(tani && kota429Gorulen\) tani\.kota429 = true/,
    'bayrak cik() uzerinden cagirana tasinmiyor');
});

test('kota devresi normal devreden UZUN ama sinirsiz degil', () => {
  /* 5 dk "high demand" dalgasi icin olculdu; kota bambaska. Ucretsiz
     katmanda RPD 20 ve govde RPM mi RPD mi soylemiyor, o yuzden iki
     tarafa da dayanan bir sure gerekiyor. */
  const m = src.match(/const GEMINI_KOTA_DEVRE_MS = (\d+) \* 60_000/);
  assert.ok(m, 'GEMINI_KOTA_DEVRE_MS tanimli olmali');
  const dk = Number(m[1]);
  assert.ok(dk >= 10 && dk <= 120, `kota devresi ${dk} dk — araligin disinda`);
  const normal = Number(src.match(/const GEMINI_DEVRE_MS = (\d+) \* 60_000/)[1]);
  assert.ok(dk > normal, 'kota devresi normal devreden kisa ya da esit');
  assert.match(src, /async function geminiDevreAc\(client: any, neden: string, sureMs = GEMINI_DEVRE_MS\)/,
    'geminiDevreAc sure almiyor — kota suresi uygulanamaz');
  assert.match(src, /const until = new Date\(Date\.now\(\) \+ sureMs\)/, 'sure parametresi kullanilmiyor');
});

test('kota 429 goruldukten sonra YEDEK MODEL baslatilmiyor', () => {
  /* Kodun kendi teshisi: "limit projenin, modelin degil". Yedek baslatmak
     ayni limite bir kez daha carpmak ve RPD'den bir istek daha goturmek.
     Olculen kosuda uc yedegin ucu de reddedildi. */
  const i = src.indexOf('KOTA 429\'DAN SONRA YEDEK YOK');
  assert.ok(i > 0, 'yedek kapisi kaybolmus');
  const kapi = src.slice(i, i + 1200);
  assert.match(kapi, /!tavanKesti &&\n\s*!kota429Gorulen &&\n\s*aktif\.length < 2/,
    'yedek baslatma kosulu kota bayragini sormuyor');
  assert.match(kapi, /yedek model baslatilmiyor/, 'susturma loglanmiyor');
});

test('429 yaris SIRASINDA yakalaniyor, sonunda degil', () => {
  /* denemeSonucunuIsle yarisin SONUNDA calisiyor; bayragi oraya birakmak
     bir sonraki yedegin coktan baslamis olmasi demek. Olculen kosuda 3.5
     429 dondukten saniyeler sonra 3.6, ardindan 3.8 baslatildi. */
  assert.match(src, /if \(bitti\.ok === false && bitti\.status === 429\) kota429Gorulen = true/,
    'dusen yarisci okunurken 429 bakilmiyor');
  const i = src.indexOf('if (bitti.ok === false && bitti.status === 429)');
  const j = src.indexOf('aktif.push(baslat(yedek, yedekMs))');
  assert.ok(i > 0 && j > i, 'kontrol yedek baslatmadan once olmali');
});

test('isci nobetcisi 150 sn sinirindan once failed yazar', () => {
  const m = src.match(/const ISCI_NOBET_MS = (\d+)_(\d+)/);
  assert.ok(m, 'ISCI_NOBET_MS tanimli olmali');
  const ms = Number(m[1] + m[2]);
  assert.ok(ms < 150000 && ms > 120000, 'nobet 120-150 sn arasinda olmali: ' + ms);
  const i = src.indexOf("// Isci nobetcisi");
  assert.ok(i > src.indexOf(".update({ status: 'processing' })"), 'nobetci processing yazildiktan sonra kurulmali');
  const blok = src.slice(i, i + 1200);
  assert.match(blok, /durumSatiri\.status === 'processing'/);
  assert.match(blok, /await markFailed\(serviceClient, documentId\)/);
  assert.match(blok, /unrefTimer/);
});

test('istemci 546/504 de belgeyi failed yapar', () => {
  const d = read('js/dashboard.js');
  assert.match(d, /if \(httpDurum === 546 \|\| httpDurum === 504\) \{\n\s*await supabaseClient\.from\('documents'\)\.update\(\{ status: 'failed' \}\)\.eq\('id', docId\)\.eq\('status', 'processing'\);/);
});

summary();
