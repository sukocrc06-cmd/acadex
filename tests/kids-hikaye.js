/* ==========================================================================
   tests/kids-hikaye.js · 26.11.2026 İzle durağı: her kelimenin kendi mini hikâyesi
     - 15 konuda her kelimenin kaydı var (yeni kelime eklenince test kırılır, kalıba düşmez)
     - TEKRAR BEKÇİSİ: bir konuda aynı cümle kalıbı kelimelerin %25'inden fazlasında olamaz
       ("Look! A crab under the sea!" sorunu bir daha sessizce geri gelmesin)
     - eşyalar çizilebiliyor (r: kelime resmi, s: simge, düz ad çizim), davranışların CSS'i var
     - efektli kelimelerin ElevenLabs tarifi ve tarayıcı yedeği var; deniz canlıları kendi sesiyle tanışır
   Çalıştırma:  node tests/kids-hikaye.js
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
const KONULAR = ['sea', 'food', 'fruits', 'body', 'toys', 'transport', 'jobs', 'clothes', 'home', 'school', 'feelings', 'actions', 'colours', 'shapes', 'family'];

function yukle() {
  const W = { document: {}, addEventListener() {}, matchMedia: () => ({ matches: false }), KIDS_SES: {} };
  W.window = W;
  const ctx = vm.createContext({ window: W, localStorage: { getItem: () => null, setItem() {} }, console });
  for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js', 'kids-temalar3.js', 'kids-hikaye.js', 'kids-konusan.js']) vm.runInContext(read('kids/assets/' + f), ctx);
  return W;
}
/* kelimeyi cümleden çıkar: kalan iskelet "kalıp"tır */
function kalip(c, r) {
  let t = c;
  for (const a of [r.en, r.cok, r.bir].filter((x) => typeof x === 'string' && x.length > 2).sort((x, y) => y.length - x.length)) t = t.split(a).join('X').split(a.charAt(0).toUpperCase() + a.slice(1)).join('X');
  return t.replace(/\b(a|an|the|The|A|An) X/g, 'X');
}

test('15 konuda her kelimenin kendi hikâyesi var; konudaki her cümle farklı', () => {
  const W = yukle(), K = W.KIDS_KONU, KS = W.KIDS_KONUSAN, HK = W.KIDS_HIKAYE;
  for (const k of KONULAR) {
    const L = K.hepsi(k), cumle = new Set();
    for (const r of L) {
      const rp = KS.replik(k, r, K.al(k));
      assert.ok(HK.al(k, r.id), 'kayıt yok: ' + k + '/' + r.id + ' (kids-hikaye.js)');
      assert.ok(rp && rp.hikaye && rp.sahne && rp.grup, k + '/' + r.id);
      cumle.add(rp.hikaye);
    }
    assert.equal(cumle.size, L.length, k + ': tekrar eden cümle');
    for (const id of Object.keys(HK.H[k])) assert.ok(L.some((r) => r.id === id), 'listede olmayan kelime: ' + k + '/' + id);
  }
});

test('tekrar bekçisi: hiçbir konuda tek kalıp kelimelerin %25\'ini geçmez', () => {
  const W = yukle(), K = W.KIDS_KONU, KS = W.KIDS_KONUSAN;
  for (const k of KONULAR) {
    const say = {}, L = K.hepsi(k);
    for (const r of L) { const rp = KS.replik(k, r, K.al(k)); const t = kalip(rp.hikaye, r); say[t] = (say[t] || 0) + 1; }
    const [enSik, n] = Object.entries(say).sort((a, b) => b[1] - a[1])[0];
    assert.ok(n <= Math.max(2, Math.floor(L.length * 0.25)), k + ': "' + enSik + '" ' + n + '/' + L.length + ' kelimede');
  }
  /* bekçinin kendisi kırılabiliyor mu: eski deniz kalıbı yakalanır */
  const eski = ['whale', 'crab', 'shark', 'turtle'].map((id) => kalip('Look! A ' + id + ' under the sea!', { en: id }));
  assert.equal(new Set(eski).size, 1, 'kalıp çıkarıcı aynı iskeleti tanır');
});

test('eşya çizimleri, davranış CSS\'i ve dil', () => {
  const W = yukle(), KS = W.KIDS_KONUSAN, HK = W.KIDS_HIKAYE, css = read('kids/assets/kids-hikaye.css') + read('kids/assets/kids-canli.css');
  const ESKI = ['oyun', 'ses', 'puskur', 'su', 'yem'];
  for (const k of KONULAR) for (const [id, x] of Object.entries(HK.H[k])) {
    assert.match(KS.esya(x.e), /<svg/, k + '/' + id + ': eşya ' + x.e);
    if (x.e.startsWith('r:')) assert.ok(W.KIDS_RESIM.var(x.e.slice(2)), 'resim yok: ' + x.e);
    assert.ok(HK.GRUP.includes(x.g) || ESKI.includes(x.g), 'bilinmeyen davranış: ' + x.g);
    assert.doesNotMatch(x.c, /\b(a|an)\s*[!?.]/, 'yarım: ' + x.c); assert.doesNotMatch(x.c, /\ba [aeiou]/i, 'a/an: ' + x.c); assert.doesNotMatch(x.c, /\ban [^aeiouAEIOU]/, 'an: ' + x.c);
  }
  for (const g of HK.GRUP) {
    assert.match(css, new RegExp('\\.kn-hg-' + g + ' \\.kn-esya[,{]'), g + ': eşyanın yeri');
    assert.match(css, new RegExp('\\.kn-sahne\\.kn-hg-' + g + ' \\.kn-resim\\{animation'), g + ': resmin hareketi');
  }
  assert.match(read('kids/assets/kids-hikaye.css'), /@media \(prefers-reduced-motion:no-preference\)\{/, 'hareketi azaltta oynamaz');
  assert.match(read('kids/assets/kids-anlat.js'), /hikayeBasla\(rp\.sahne, rp\.grup\)/);
  assert.match(read('kids/assets/kids-anlat.js'), /String\(ad\)\.replace\(\/\[\^a-z0-9-\]\/gi, '-'\)/, 'r:/s: eşya adı sınıf adında temizlenir');
});

test('sesler: efektli kelimenin tarifi ve yedeği var; deniz canlıları kendi sesiyle tanışır', () => {
  const W = yukle(), KS = W.KIDS_KONUSAN, HK = W.KIDS_HIKAYE, ses = read('kids/assets/kids-ses.js');
  const yedek = new Set([...ses.matchAll(/^\s{4}([a-z]+): function \(\) \{ (?:kay|hisir|nota|\[)/gm)].map((m) => m[1]));
  const tarif = new Set(require(path.join(ROOT, 'kids/ses/efektler.js')).map((x) => x.id));
  let n = 0;
  for (const k of KONULAR) for (const x of Object.values(HK.H[k])) if (x.fx) { n++; assert.ok(tarif.has(x.fx), 'efekt tarifi yok: ' + x.fx); assert.ok(yedek.has(x.fx), 'tarayıcı yedeği yok: ' + x.fx); }
  assert.ok(n >= 35, 'taşıt ve müzik oyuncaklarının efekti: ' + n);
  for (const id of Object.keys(HK.H.sea)) if (id !== 'seal' && id !== 'walrus' && id !== 'whale' && id !== 'dolphin') assert.equal(KS.hayvanSesi({ id }), id, id + ' tanıtımda kendi sesi');
  assert.match(read('kids/assets/kids-anlat.js'), /if \(rp\.fx && SES\.hayvan\) \{ await Promise\.race\(\[SES\.hayvan\(rp\.fx\), bekle\(2500\)\]\);/, 'efekt en çok 2,5 sn bekletir');
  const b = read('kids/assets/birlestir.js'); assert.ok(b.indexOf("'kids-hikaye.js'") > -1 && b.indexOf("'kids-hikaye.js'") < b.indexOf("'kids-konusan.js'")); assert.match(b, /'kids-hikaye\.css'/);
  assert.ok(read('kids/ses/katalog.js').includes("'kids-hikaye.js'"), 'katalog hikâye cümlelerini toplar');
  assert.ok(read('kids/ses/kayit-metni.csv').includes('The crab walks sideways on the sand!'), 'kayit-metni.csv yenilendi (node kids/ses/uret.js kuru)');
});

summary();
