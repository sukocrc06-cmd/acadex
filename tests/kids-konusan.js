/* ==========================================================================
   ACADEX — ACADEX KIDS KONUŞAN KELİMELER, ACADIA DİYALOĞU, MİNİ HİKÂYE (tests/kids-konusan.js), 13.11.2026

   NEDEN VAR: İzle durağında kelimeler artık kendini tanıtır ("Woof, woof! I'm a dog!",
   "Hi! I'm a strawberry!"), Acadia soru sorar ve selam verir, sonra küçük bir hikâye oynar
   (top, sepet, tabak, yol…). Hayvanların sesi WebAudio ile sentezlenir. Bu dosya:
     - her konunun her kelimesinin diyaloğu var (Nerede? hariç) ve İngilizcesi düzgün
       (boş/yarım tanıtım yok, a/an doğru, çoğullar "We are")
     - bütün diyalog cümleleri ses kataloğunda (ElevenLabs'te kayıt için)
     - sesi çalınan her hayvanın sentez tarifi var; hikâye eşyalarının hepsi çizilir
     - İzle ve Dokun durakları konuşan kelimeleri kullanır
   Tarayıcı ucu (sıra, balonlar, hikâye animasyonları, mobil) Playwright ile denendi.
   Çalıştırma:  node tests/kids-konusan.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const yukle = () => {
  const W = { document: {}, addEventListener() {}, matchMedia: () => ({ matches: false }), KIDS_SES: {} };
  W.window = W;
  const ctx = vm.createContext({ window: W, localStorage: { getItem: () => null, setItem() {} }, console });
  for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js', 'kids-temalar3.js', 'kids-konusan.js']) vm.runInContext(read('kids/assets/' + f), ctx);
  return W;
};

test('her kelimenin diyaloğu var ve İngilizcesi düzgün', () => {
  const W = yukle(), K = W.KIDS_KONU, KS = W.KIDS_KONUSAN;
  let n = 0;
  for (const id of K.PAKET) for (const r of K.hepsi(id)) {
    const rp = KS.replik(id, r, K.al(id));
    if (id === 'places') { assert.equal(rp, null, 'Nerede? eski akışta kalır'); continue; }
    assert.ok(rp && rp.soru && rp.ben, id + '/' + r.id); n++;
    for (const m of [rp.soru, rp.ben, rp.selam, rp.hikaye].filter(Boolean)) {
      assert.doesNotMatch(m, /\b(a|an)\s*[!?.]/, 'yarım: ' + m);
      assert.doesNotMatch(m, /\ba [aeiou]/, 'a/an: ' + m);
      assert.doesNotMatch(m, /undefined|null|\s{2}/, m);
    }
    assert.ok(rp.ben.toLowerCase().includes(String(r.en).toLowerCase()) || id === 'numbers', 'kelime tanıtımda geçmeli: ' + rp.ben);
  }
  assert.ok(n >= 490, n);
  const b = (id, en) => KS.replik(id, K.hepsi(id).find((x) => x.en === en), K.al(id));
  assert.equal(b('animals', 'dog').ben, 'Hi! I\'m a dog!', 'hav sesi artık efekt; öğretmen sesi "Woof" demez');
  assert.equal(b('transport', 'bus').ben, 'Beep, beep! I\'m a bus!');
  assert.equal(b('animals', 'elephant').ben, 'Hi! I\'m an elephant!');
  assert.equal(b('food', 'strawberry').ben, 'Hi! I\'m a strawberry!');
  assert.equal(b('fruits', 'grapes').ben, 'Hi! We are grapes!');
  assert.equal(b('sea', 'octopus').ben, 'Hi! I\'m an octopus!');
  assert.equal(b('animals', 'dog').selam, 'Hello, dog!');
  assert.equal(b('fruits', 'orange').sahne, 'sepet');
});

test('diyalog cümleleri ses kataloğunda', () => {
  const W = yukle(), K = W.KIDS_KONU, KS = W.KIDS_KONUSAN;
  const kat = require(path.join(ROOT, 'kids/ses/katalog.js'))(), en = new Set(kat.filter((x) => x.dil === 'en').map((x) => x.metin));
  for (const id of K.PAKET) for (const r of K.hepsi(id)) { const rp = KS.replik(id, r, K.al(id)); if (!rp) continue; for (const m of [rp.soru, rp.ben, rp.selam, rp.hikaye].filter(Boolean)) assert.ok(en.has(m), 'katalogda yok: ' + m); }
  assert.ok(read('kids/ses/kayit-metni.csv').includes('Hi! I\'m a dog!'), 'kayit-metni.csv yenilenmeli (node kids/ses/uret.js kuru)');
});

test('hayvan sesleri ve hikâye eşyaları tanımlı', () => {
  const W = yukle(), K = W.KIDS_KONU, KS = W.KIDS_KONUSAN, ses = read('kids/assets/kids-ses.js');
  const tarif = new Set([...ses.matchAll(/^\s{4}([a-z]+): function \(\) \{ (?:kay|hisir|\[)/gm)].map((m) => m[1]));
  for (const id of ['animals', 'sea']) for (const r of K.hepsi(id)) { const h = KS.hayvanSesi(r); if (h) assert.ok(tarif.has(h), 'ses tarifi yok: ' + h); }
  assert.ok(KS.hayvanSesi({ id: 'dog' }) && KS.hayvanSesi({ id: 'cat' }) && !KS.hayvanSesi({ id: 'apple' }));
  assert.match(ses, /function hayvan\(id\)/); assert.match(ses, /LISTE\['fx:' \+ id\]/, 'kayıtlı çizgi film efekti varsa o çalar');
  /* ElevenLabs efekt listesi: sesi olan her hayvanın bir tarifi var */
  const ef = new Set(require(path.join(ROOT, 'kids/ses/efektler.js')).map((x) => x.id));
  for (const id of ['animals', 'sea']) for (const r of K.hepsi(id)) { const h = KS.hayvanSesi(r); if (h) assert.ok(ef.has(h), 'efekt tarifi yok: ' + h); }
  for (const id of K.PAKET) for (const r of K.hepsi(id)) { const rp = KS.replik(id, r, K.al(id)); if (rp && rp.sahne) assert.match(KS.esya(rp.sahne), /<svg/, rp.sahne); }
});

test('İzle ve Dokun konuşan kelimeleri kullanır; giriş animasyonu baştan oynamaz', () => {
  const an = read('kids/assets/kids-anlat.js'), app = read('kids/assets/kids-app.js'), css = read('kids/assets/kids-anlat.css');
  assert.match(an, /KS\.replik\(o\.konu, r, P\)/); assert.match(an, /SES\.hayvan \? SES\.hayvan\(hs\)/); assert.match(an, /o\.acd\('mutlu', 'el'\)/);
  assert.match(app, /KS\.ben\(S\.konu, r, P\)/);
  assert.doesNotMatch(css, /\.kn-gir \.kn-(resim|oge)\b/, 'giriş kuralları :not(.kn-durgun) ile sınırlı olmalı');
  assert.match(read('kids/assets/kids-ciz.js'), /o\.pose === 'el'/);
  assert.ok(read('kids/assets/birlestir.js').includes('kids-konusan.js'));
  assert.ok(read('kids/index.html').includes('KIDS_KONUSAN'), 'index.html yeniden üretilmeli');
});

summary();
