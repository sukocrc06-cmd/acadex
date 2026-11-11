/* ==========================================================================
   ACADEX — ACADEX KIDS ON TEMA, ÖDÜL DÜNYASI, AKILLI TAHTA, SINIF RAPORU (tests/kids-temalar.js), 12.11.2026

   NEDEN VAR: Kids'in kalan on konusu (Animals … Feelings) açıldı; her konunun kendi
   üçüncü oyunu, rozeti ve tema giysisi var; öğretmen paneline akıllı tahta ve sınıf
   raporu (ısı haritası, veli bülteni), veli köşesine sekmeler geldi. Bu dosya:
     - her konu yaşa göre 6 / 8 / 10 kelime verir; her kelimenin çizimi var, kimlikler tekil
     - her konunun üçüncü oyunu kayıtlı, motoru var; oyun cümleleri katalogda
     - çıkartmalar tekil ve çizili; rozet adı ve tema giysisi her konuda
     - ogeBul tema kelimelerini bulur (veli köşesi, öğretmen tablosu bunu kullanır)
     - birleştirici yeni dosyaları sırasıyla gömer; akıllı tahta ve rapor panelde
   Tarayıcı ucu (on konu × üç yaş dünyası, yedi durak, oyunların sonuna kadar oynanması,
   390px'te taşma yok, harita/albüm/dolap/veli köşesi, rapor, bülten PDF'i, tahta) Playwright ile denendi.
   Çalıştırma:  node tests/kids-temalar.js
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
const TEMA = ['animals', 'family', 'body', 'food', 'toys', 'clothes', 'home', 'school', 'weather', 'feelings'];

const yukle = () => {
  const W = { document: {}, addEventListener() {}, matchMedia: () => ({ matches: false }), KIDS_SES: {} };
  W.window = W;
  const ctx = vm.createContext({ window: W, localStorage: { getItem: () => null, setItem() {} }, console });
  for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-oyun.js', 'kids-oyun2.js']) vm.runInContext(read('kids/assets/' + f), ctx);
  return W;
};

test('on tema: yaşa göre 6 / 8 / 10 kelime, her kelimenin çizimi, kimlikler bütün konularda tekil', () => {
  const W = yukle(), V = W.KIDS_VERI, K = W.KIDS_KONU, R = W.KIDS_RESIM, gor = new Set();
  assert.deepEqual([...K.PAKET], [...V.KONU.map((k) => k.id)], 'paket sırası harita sırası');
  for (const id of K.PAKET) for (const o of K.al(id).ogeler(V.BANT.yildiz)) { assert.ok(!gor.has(o.id), 'kimlik iki konuda: ' + o.id); gor.add(o.id); }
  for (const id of TEMA) {
    const p = K.al(id);
    assert.deepEqual([p.ogeler(V.BANT.minik).length, p.ogeler(V.BANT.kasif).length, p.ogeler(V.BANT.yildiz).length], [6, 8, 10], id);
    for (const o of p.ogeler(V.BANT.yildiz)) {
      assert.ok(o.en && o.tr && /^#[0-9A-F]{6}$/i.test(o.hex), id + '.' + o.id);
      assert.ok(R.var(o.id), o.id + ' çizimi yok');
      assert.match(p.gorsel(o), /<svg[^>]*viewBox="0 0 100 100"[\s\S]*<\/svg>$/);
      assert.ok(R.ic(o.id).length > 60, o.id + ' çizimi boş');
    }
    assert.ok(p.sarki.length >= 5 && p.sarki.some((s) => !s.kim), id + ' şarkı kapanış satırı');
    assert.ok(K.sarkiSatir(p, p.ogeler(V.BANT.minik)).length >= 3, id + ' minikler en az üç satır söyler');
    assert.equal(p.ev.length, 3); assert.equal(p.etkinlik.length, 2);
    assert.match(p.balon.html(p.ogeler(V.BANT.kasif)[0]), /<b style="--r:#/);
  }
});

test('üçüncü oyunlar: her konuda ayrı, kayıtlı, motoru var; cümleleri katalogda', () => {
  const W = yukle(), K = W.KIDS_KONU, O = W.KIDS_OYUN;
  const ids = TEMA.map((id) => K.al(id).oyun3.id);
  assert.deepEqual(ids, ['sesbul', 'foto', 'simon', 'piknik', 'kutu', 'giydir', 'oda', 'canta', 'cark', 'yuz']);
  for (const id of TEMA) { const T = K.al(id).oyun3; assert.equal(typeof O[T.id], 'function', T.id); assert.ok(O.MOTOR[T.motor], T.motor); assert.ok(T.ad && T.simge && T.son); }
  const kat = new Set(require(path.join(ROOT, 'kids/ses/katalog.js'))().map((x) => x.dil + ':' + x.metin));
  for (const id of TEMA) for (const m of O.cumleler(K.al(id))) assert.ok(kat.has('en:' + m), id + ' → ' + m);
  for (const c of ['en:Meow, meow! Who says meow?', 'en:The cow says moo!', 'en:Put grandma in the photo!', 'en:Touch your nose!', 'en:I like strawberries! Put them in the basket.',
    'en:I like milk! Put it in the basket.', 'en:The blocks are in the box!', 'en:It\'s rainy! Put on your boots.', 'en:The lamp goes in the living room!', 'en:Put the ruler in your bag!',
    'en:There\'s a rainbow today!', 'en:A present for me! How do I feel?', 'en:I feel surprised!', 'en:Point to the cat!', 'en:Point to mum!', 'en:Simon says!',
    'tr:Hayvanlar adasını bitirince açılacak.', 'tr:Yeni bir rozet kazandın!']) assert.ok(kat.has(c), c);
  /* temalarda yanlış balon iki kısa cümle: 100 kelimelik "That is X. Find Y!" çarpımı üretilmez */
  assert.ok(!kat.has('en:That is dog. Find cat!'));
  assert.deepEqual([...K.al('animals').balon.yanlis({ en: 'dog' }, { en: 'cat' })], ['dog.', 'Pop the cat!']);
});

test('ödül dünyası: çıkartmalar tekil ve çizili; her konuya rozet ve tema giysisi', () => {
  const W = yukle(), V = W.KIDS_VERI, K = W.KIDS_KONU, C = W.KIDS_CIZ, R = W.KIDS_RESIM, yok = C.simge('bu-yok');
  const cik = K.PAKET.flatMap((id) => [...K.al(id).cikartma]);
  assert.equal(cik.length, 36); assert.equal(new Set(cik).size, 36, 'çıkartma iki konuda');
  for (const c of cik) if (c !== 'yildiz') assert.notEqual(C.simge(c), yok, c + ' çizimi yok');
  for (const k of V.KONU) {
    assert.ok(k.acik && k.rozet, k.id);
    if (k.simge !== 'yildiz') assert.notEqual(C.simge(k.simge), yok, k.id + ' ada simgesi');
    assert.match(C.ada(k.renk, k.simge, false), /<g transform[^>]*>\s*<[a-z]/, k.id + ' adada simge çizilmeli');
  }
  assert.match(R.rozet('#FFD98A', R.ic('lion'), false), /kc-rozet/);
  assert.match(R.rozet('#FFD98A', '', true), /kc-kilitli/);
  for (const g of V.GIYSI.filter((x) => x.tema)) { assert.ok(V.konuBul(g.tema), g.id); assert.ok(C.GIYSI.includes(g.id), g.id + ' giysi çizimi'); }
  const app = read('kids/assets/kids-app.js');
  assert.match(app, /var tk = g\.tema && V\.konuBul\(g\.tema\), acik = tk \? !!il\.bitti\[g\.tema\] : top >= g\.yildiz/);
  assert.match(app, /var ilk = !il\.bitti\[kid\]/);
  assert.match(app, /tum\.map\(/, 'albüm bütün çıkartmaları gösterir');
});

test('ogeBul tema kelimelerini bulur; ogeKonu kelimenin konusunu verir', () => {
  const W = yukle(), V = W.KIDS_VERI;
  assert.equal(V.ogeBul('lion').tr, 'aslan'); assert.equal(V.ogeBul('red').en, 'red'); assert.equal(V.ogeBul('yok'), null);
  assert.equal(V.ogeKonu('sofa'), 'home'); assert.equal(V.ogeKonu('seven'), 'numbers');
});

test('Simon figürü: My Body kelimelerinin hepsi dokunulabilir parça', () => {
  const W = yukle(), V = W.KIDS_VERI, b = W.KIDS_RESIM.beden();
  for (const o of W.KIDS_KONU.al('body').ogeler(V.BANT.yildiz)) assert.match(b, new RegExp('data-parca="' + o.id + '" tabindex="0" role="button"'), o.id);
  for (const o of W.KIDS_KONU.al('clothes').ogeler(V.BANT.yildiz)) assert.ok(['bas', 'govde', 'boyun', 'el', 'bacak', 'ayak'].includes(o.yer) && o.hava && o.durum, o.id);
  for (const o of W.KIDS_KONU.al('home').ogeler(V.BANT.yildiz).filter((x) => x.oda)) for (const r of o.oda) assert.ok(W.KIDS_TEMALAR.ODA.some((x) => x.id === r), o.id + ' → ' + r);
});

test('panel: akıllı tahta, sınıf raporu, bülten; veli köşesi sekmeleri; birleştirici sırası', () => {
  const og = read('kids/assets/kids-ogretmen.js'), t = read('kids/assets/kids-tahta.js'), app = read('kids/assets/kids-app.js'), bir = read('kids/assets/birlestir.js'), html = read('kids/index.html');
  assert.match(og, /\[data-tahta\]'\)\.addEventListener\('click', function \(\) \{ if \(W\.KIDS_TAHTA\) W\.KIDS_TAHTA\.ac\(\{ sinif: sinif/);
  assert.match(og, /function rapor\(sinif, kz\)[\s\S]*kt-tamam-t[\s\S]*kt-isi/);
  assert.match(og, /Bu bültende çocuklara ait kişisel bilgi yoktur/);
  assert.doesNotMatch(og, /function bulten[\s\S]{0,3000}og\[0\]/, 'bülten çocuk adı içermez');
  for (const b of ['kart', 'sarki', 'simon', 'cark']) assert.match(t, new RegExp("\\['" + b + "'"));
  assert.match(t, /S\.secilen\.indexOf\(ogr\[i\]\.ad\) < 0/, 'çark herkes seçilmeden tekrar etmez');
  assert.match(app, /\['ozet', 'Bu hafta'\], \['kelime', 'Kelimeler'\], \['evde', 'Evde 5 dakika'\], \['ayar', 'Ayarlar'\]/);
  const js = bir.match(/JS = \[([^\]]+)\]/)[1].split(',').map((x) => x.trim().replace(/'/g, ''));
  const once = (a, b) => assert.ok(js.indexOf(a) > -1 && js.indexOf(a) < js.indexOf(b), a + ' önce ' + b);
  once('kids-ciz.js', 'kids-resim.js'); once('kids-konu.js', 'kids-temalar.js'); once('kids-oyun.js', 'kids-oyun2.js'); once('kids-oyun2.js', 'kids-app.js'); once('kids-tahta.js', 'kids-ogretmen.js');
  for (const f of js) assert.ok(html.includes('/* ---- ' + f + ' ---- */'), f + ' index.html içinde yok (node assets/birlestir.js)');
  for (const c of ['kids-tema.css', 'kids-tahta.css']) assert.ok(bir.includes("'" + c + "'"));
  assert.ok(html.includes(read('kids/assets/kids-temalar.js').slice(200, 400)), 'index.html güncel değil');
});

summary();
