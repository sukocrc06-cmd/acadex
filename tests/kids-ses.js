/* ==========================================================================
   ACADEX — ACADEX KIDS SESLENDİRME (tests/kids-ses.js), 10.11.2026

   NEDEN VAR: Kids'te tarayıcının robot sesi yerine kayıtlı kadın öğretmen sesi
   (ElevenLabs ile bir kez üretilen MP3'ler, sonra stüdyo kaydı) kullanılıyor:
     kids/ses/katalog.js  → sitenin söylediği bütün cümleler
     kids/ses/uret.js     → MP3 + liste.json + kayit-metni.csv (anahtar yalnız ortam değişkeninde)
     kids/assets/kids-ses.js → önce liste.json'daki dosya, yoksa en doğal tarayıcı sesi
   Bu dosya:
     - kaynaktaki her sabit SES.soyle('...') cümlesi katalogda (eksik cümle robot sesle okunur)
     - dosya adları kararlı, ASCII ve çakışmasız (stüdyo kaydı aynı adla yerine konur)
     - API anahtarı hiçbir dosyada yok; deneme klasörü yayına gitmez
     - site kayıtlı sesi tarayıcı sesinden önce dener; sw liste.json'u önce internetten alır
   Tarayıcı ucu (iki konu baştan sona sesli oynanınca katalogda olmayan cümle sayısı 0,
   226 ses dosyası isteği) Playwright ile denendi.
   Çalıştırma:  node tests/kids-ses.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const katalog = () => require(path.join(ROOT, 'kids/ses/katalog.js'))();

test('kaynaktaki her sabit cümle katalogda', () => {
  const k = new Set(katalog().map((x) => x.dil + ':' + x.metin)), eksik = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'kids/assets')).filter((f) => /^kids-.*\.js$/.test(f))) {
    const src = read('kids/assets/' + f);
    for (const m of src.matchAll(/SES\.soyle\('((?:[^'\\]|\\.)*)', '(en|tr)'/g)) {
      const metin = m[1].replace(/\\'/g, '\'');
      if (!k.has(m[2] + ':' + metin)) eksik.push(f + ' → ' + m[2] + ':' + metin);
    }
  }
  assert.deepEqual(eksik, []);
});

test('katalog: iki konu, şarkılar, sayma, yanlış cevap cümleleri', () => {
  const k = new Set(katalog().map((x) => x.dil + ':' + x.metin));
  for (const c of ['en:Pop the red balloon!', 'en:Pop number seven!', 'en:That is blue. Find red!', 'en:That is two. Find ten!', 'en:one apple!', 'en:three apples!',
    'en:one, two, three, four, five', 'en:Red, red, the apple is red.', 'en:One, two, three, count with me!', 'en:let\'s', 'en:Colour the sun yellow.',
    'tr:Bugünün konusu sayılar. Hadi oynayalım!', 'tr:20 yıldız toplayınca açılacak.', 'en:How many?']) assert.ok(k.has(c), c);
  assert.ok(!k.has('en:one apples!'), 'tekil: one apple');
  assert.ok(katalog().length > 300);
});

test('dosya adları kararlı, ASCII, çakışmasız; stüdyo listesi aynı adlarla', () => {
  const { dosyaAdi } = require(path.join(ROOT, 'kids/ses/uret.js'));
  const L = katalog(), adlar = L.map((x) => dosyaAdi(x.dil, x.metin));
  assert.equal(new Set(adlar).size, adlar.length);
  for (const a of adlar) assert.match(a, /^(en|tr)\/[a-z0-9-]+-[0-9a-f]{6}\.mp3$/);
  assert.equal(dosyaAdi('tr', 'Hangi sınıftasın?'), dosyaAdi('tr', 'Hangi sınıftasın?'));
  assert.match(dosyaAdi('tr', 'Hangi sınıftasın?'), /^tr\/hangi-siniftasin-/);
  const csv = read('kids/ses/kayit-metni.csv');
  for (const a of adlar) assert.ok(csv.includes(a + ';'), a + ' kayıt listesinde yok (node kids/ses/uret.js kuru)');
});

test('anahtar gizli: yalnız ortam değişkeni; deneme klasörü yayına gitmez', () => {
  const u = read('kids/ses/uret.js');
  assert.match(u, /process\.env\.ELEVENLABS_API_KEY/);
  assert.doesNotMatch(u, /xi-api-key': '[A-Za-z0-9_]{8,}/);
  assert.doesNotMatch(u, /writeFileSync\([^)]*ANAHTAR/);
  for (const f of fs.readdirSync(path.join(ROOT, 'kids'), { recursive: true }).map(String).filter((f) => /\.(js|json|html|csv|webmanifest)$/.test(f))) assert.doesNotMatch(read(path.join('kids', f).replace(/\\/g, '/')).slice(0, 2e6), /sk_[a-f0-9]{40,}/, f);
  assert.match(read('.gitignore'), /kids\/ses\/_deneme/);
});

test('site önce kayıtlı sesi çalar; sw liste.json\'u önce internetten alır', () => {
  const s = read('kids/assets/kids-ses.js'), sw = read('kids/sw.js');
  assert.match(s, /if \(LISTE && LISTE\[k\]\) return dosyaCal\(LISTE\[k\], metin, ek, tts\);[\s\S]{0,60}return tts\(\);/);
  assert.match(s, /fetch\(TABAN \+ 'ses\/liste\.json'/);
  assert.match(sw, /u\.pathname === '\/kids\/ses\/liste\.json'[\s\S]{0,80}fetch\(r\)\.then/);
  assert.match(read('kids/index.html'), /\/\* ---- kids-ses\.js ---- \*\/[\s\S]{0,200}Kayıtlı ses/);
});

summary();
