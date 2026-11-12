/* ==========================================================================
   ACADEX — ACADEX KIDS İÇERİK, DOLAP, VELİ KÖŞESİ, ÇEVRİMDIŞI (tests/kids-icerik.js), 10.11.2026

   NEDEN VAR: Kids'e ikinci konu (Numbers), her konuya şarkı durağı, adaya uçuş,
   avatar dolabı, veli köşesi ve ana ekrana ekleme (kids/sw.js) geldi. Bu dosya:
     - açık her konunun oynanabilir bir paketi var; paket yaşa göre kelime verir
     - şarkı satırları yaş dünyasındaki kelimelere göre süzülür
     - Numbers'ın üçüncü oyunu "say" gerçekten var ve doğru rakamla biter
     - dolap eşikleri artan sırada, yuvalar bas/yuz; yönetim kopyası çizimlerle aynı
     - sw.js yalnız /kids/ altına karışır, Supabase'i önbelleğe almaz; manifest ve simgeler yerinde
   Tarayıcı ucu (iki konu baştan sona, uçuş, karaoke, dolap, veli köşesi, telefonda
   yedi durak, çevrimdışı açılış ve ilerlemenin bağlanınca gitmesi) Playwright ile denendi.
   Çalıştırma:  node tests/kids-icerik.js
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
  const W = { document: {}, addEventListener() {}, matchMedia: () => ({ matches: false }) };
  W.window = W;
  const ctx = vm.createContext({ window: W, localStorage: { getItem: () => null, setItem() {} }, console });
  for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js']) vm.runInContext(read('kids/assets/' + f), ctx);
  return W;
};

test('açık her konunun paketi var; yaşa göre kelime sayısı', () => {
  const W = yukle(), V = W.KIDS_VERI, K = W.KIDS_KONU;
  const acik = V.KONU.filter((k) => k.acik).map((k) => k.id);
  assert.deepEqual([...acik], [...V.KONU.map((k) => k.id)], 'on iki konunun hepsi açık');
  for (const id of acik) {
    const p = K.al(id);
    assert.ok(p, id);
    for (const alan of ['ogeler', 'gorsel', 'izleGiris', 'izleCumle', 'dokunYon', 'balon', 'hafiza', 'oyun3', 'cikartma', 'sarki', 'ev', 'bitis']) assert.ok(p[alan], id + '.' + alan);
    assert.equal(p.cikartma.length, 3);
  }
  const n = K.al('numbers');
  assert.equal(n.ogeler(V.BANT.minik).length, 5);
  assert.equal(n.ogeler(V.BANT.kasif).length, 10);
  assert.equal(K.al('colours').ogeler(V.BANT.minik).length, 3);
  assert.deepEqual([...n.ogeler(V.BANT.kasif).map((o) => o.n)], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.match(n.gorsel(n.ogeler(V.BANT.kasif)[9]), />10<\/text>/);
  assert.equal(n.oyun3.id, 'say');
});

test('şarkı: yaş dünyasında olmayan kelimenin satırı atlanır, kapanış satırı kalır', () => {
  const W = yukle(), V = W.KIDS_VERI, K = W.KIDS_KONU;
  const minik = K.sarkiSatir(K.al('numbers'), K.al('numbers').ogeler(V.BANT.minik));
  assert.deepEqual([...minik.map((s) => s.kim)], ['three', 'five', null]);
  assert.equal(K.sarkiSatir(K.al('colours'), K.al('colours').ogeler(V.BANT.minik)).length, 4);   // red, yellow, blue + kapanış
  assert.equal(K.sarkiSatir(K.al('colours'), K.al('colours').ogeler(V.BANT.kasif)).length, 6);
});

test('oyunlar: say var; balon ve hafıza konu paketini kullanır', () => {
  const o = read('kids/assets/kids-oyun.js'), app = read('kids/assets/kids-app.js');
  assert.match(o, /function say\(kok, a\)/);
  assert.match(o, /W\.KIDS_OYUN = \{[^}]*say: say,/);
  assert.match(o, /var B = \(a\.paket \|\| RENK_PAKET\)\.balon/);
  assert.match(o, /var H = \(a\.paket \|\| RENK_PAKET\)\.hafiza/);
  assert.match(app, /OYUN\[d\.id\]\(sahne, \{ renkler: renkler\(\), bant: bant\(\), paket: paket\(\),/);
  assert.match(app, /\{ id: 'sarki', ad: 'Şarkı', simge: 'nota' \}/);
});

test('dolap: eşikler artan, yuvalar bas/yuz, her giysinin çizimi var', () => {
  const W = yukle(), V = W.KIDS_VERI, C = W.KIDS_CIZ;
  const e = V.GIYSI.filter((g) => !g.tema).map((g) => g.yildiz);
  /* tema giysileri yıldızla değil, o konunun adası bitince açılır: her konuya bir tane */
  const tg = V.GIYSI.filter((g) => g.tema).map((g) => g.tema);
  assert.deepEqual([...tg].sort(), [...V.KONU.filter((k) => !['colours', 'numbers'].includes(k.id) && k.grup !== 2).map((k) => k.id)].sort());
  assert.deepEqual([...e], [...e].sort((a, b) => a - b));
  for (const g of V.GIYSI) { assert.ok(['bas', 'yuz'].includes(g.yuva), g.id); assert.ok(C.GIYSI.includes(g.id), g.id + ' çizimi'); }
  assert.ok(e[e.length - 1] <= 2 * 9 + 2, 'en pahalı giysi iki konuyla açılabilmeli');
  assert.match(C.avatarGiy('kedi', { bas: 'tac', yuz: 'gozluk' }), /kc-giyik[\s\S]*kc-giysi[\s\S]*kc-giysi/);
  assert.doesNotMatch(C.avatarGiy('kedi', {}), /kc-giyik/);
  assert.equal(read('js/kids-ciz.js').split('\n').slice(2).join('\n'), read('kids/assets/kids-ciz.js').split('\n').slice(2).join('\n'), 'yönetim kopyası güncel değil');
});

test('veli köşesi matematik kapısının arkasında; çıkış orada', () => {
  const app = read('kids/assets/kids-app.js');
  assert.match(app, /data-veli[\s\S]{0,200}veliKapisi\(veliKosesi\)/);
  assert.doesNotMatch(app, /data-cikis/);
  assert.match(app, /data-vcikis[\s\S]{0,200}koy\('oturum', null\); koy\('sonDurum', null\)/);
});

test('çevrimdışı: sw yalnız /kids/, Supabase önbelleğe girmez; manifest ve simgeler', () => {
  const sw = read('kids/sw.js'), m = JSON.parse(read('kids/manifest.webmanifest')), pwa = read('kids/assets/kids-pwa.js');
  assert.match(sw, /u\.origin !== self\.location\.origin \|\| !u\.pathname\.startsWith\('\/kids\/'\)\) return;/);
  assert.match(sw, /const SURUM = 'acadex-kids-/);
  assert.match(pwa, /register\('\/kids\/sw\.js', \{ scope: '\/kids\/' \}\)/);
  assert.equal(m.scope, '/kids/'); assert.equal(m.start_url, '/kids/#oyna');
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(ROOT, i.src.slice(1))), i.src);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  const html = read('kids/index.html');
  assert.match(html, /<link rel="manifest" href="\/kids\/manifest\.webmanifest">/);
  assert.ok(fs.existsSync(path.join(ROOT, 'kids/assets/ikon-180.png')));
  assert.match(read('kids/assets/kids-bulut.js'), /addEventListener\('online', function \(\) \{ gonder\(\); \}\)/);
});

summary();
