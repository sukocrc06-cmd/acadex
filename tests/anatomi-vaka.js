/* ==========================================================================
   ACADEX — ANATOMİ LAB VAKA REHBERİ TESTLERİ (tests/anatomi-vaka.js), 06.11.2026

   NEDEN VAR: Anatomi Lab klinik vakaları üç yenilik kazandı:
     1) adım adım yaklaşma: her ipucu kademesinde kamera hedefe biraz daha yaklaşır
        (1: bölge, 2: yakın + saydam üst katmanlar, 3: kırık/odak noktası)
     2) Dr. Ela soru sorarak götürür: 3. kademe metin değil soru listesi döndürür
        (doku türü → bölge → yapı); labs/medica/medica-cerrah.js → sorgula bunları sorar,
        her doğru cevapta model yaklaşır, en sonda dokunmak yine öğrencinindir
     3) vakaya göre model: kemik gerçekten kırılır (geometri iki parçaya bölünüp yer
        değiştirir), lezyon işaretlenir; her adımda yalnız gereken sistem görünür
   Bu dosya tarayıcısız sınanabilen her şeyi kaynak dosyadan çıkararak sınar
   (kopyalamaz: kaynak değişirse test ya yeni davranışı ölçer ya açık hata verir).
   Görsel doğrulama Playwright ile elle yapıldı (kalça, suprakondiler, kot, apandisit, inme,
   gluteal, pterion; masaüstü ve 390 px).
   Çalıştırma:  node tests/anatomi-vaka.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeRunner, sliceDeclaration } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();

const AN = read('labs/anatomi/index.html');
const CER = read('labs/medica/medica-cerrah.js');
const al = (names, extra = {}) => {
  const ctx = vm.createContext({ Math, ...extra });
  vm.runInContext(names.map((n) => sliceDeclaration(AN, n)).join('\n') + '\n;this.__ = {' + names.join(',') + '};', ctx);
  return ctx.__;
};

/* ---- vakaya göre lezyon tanımları ---- */
test('lezyonlar: her lezyon kendi vakasının bir adımındaki yapıya bağlı ve geçerli', () => {
  const { CASES } = al(['CASES']);
  const lezli = CASES.filter((c) => c.lez);
  assert.deepEqual(Array.from(lezli, (c) => c.id).sort(), ['apandisit', 'gluteal', 'inme', 'kalca', 'kot', 'pterion', 'supra']);
  for (const c of lezli) for (const L of c.lez) {
    assert.ok(c.steps.some((s) => s[0] === L.sid), c.id + ': ' + L.sid + ' adımlarda yok');
    assert.ok(L.tip === 'kirik' || L.tip === 'isaret', c.id);
    assert.ok(typeof L.not === 'string' && L.not.length > 10, c.id + ': lezyon açıklaması');
    if (L.taraf) assert.ok(L.taraf === 'R' || L.taraf === 'L', c.id);
    if (L.tip === 'kirik') {
      assert.equal(L.P.length >= 2, true, c.id); assert.equal(L.n.length, 3, c.id); assert.equal(L.tr.length, 3, c.id);
      assert.ok(Math.hypot(...L.n) > 0.5, c.id + ': kırık düzlemi normali');
      for (const v of L.P) assert.ok(v >= 0 && v <= 1, c.id + ': P kutu oranı');
    } else {
      assert.equal(L.ham.length, 3, c.id); for (const v of L.ham) assert.ok(v >= 0 && v <= 1, c.id);
      assert.ok(L.r > 0 && L.r < .05, c.id + ': işaret yarıçapı');
    }
  }
  /* hastanın tarafı: kalça kırığında sağ femur, kot kırığında sağ 7–8. kaburga */
  const kal = CASES.find((c) => c.id === 'kalca').lez[0], kot = CASES.find((c) => c.id === 'kot').lez[0];
  assert.equal(kal.sid, 'femur'); assert.equal(kal.taraf, 'R'); assert.ok(kal.P[1] > .85, 'kırık boyunda (proksimal)');
  assert.ok(kot.ad.test('Seventh rib.r') && kot.ad.test('Eighth rib.r') && !kot.ad.test('Seventh rib.l') && !kot.ad.test('Ninth rib.r'));
});

/* ---- kemiği gerçekten kırma: üçgenleri düzlemin iki yanına ayırma ---- */
test('vkBol: geometri kırık düzleminin iki yanına bölünür, üçgen kaybolmaz', () => {
  class Attr { constructor(a, k) { this.array = a; this.itemSize = k; this.count = a.length / k; } getX(i) { return this.array[i * this.itemSize]; } getY(i) { return this.array[i * this.itemSize + 1]; } getZ(i) { return this.array[i * this.itemSize + 2]; } }
  class Geo { constructor() { this.attributes = {}; this.index = null; } setAttribute(n, a) { this.attributes[n] = a; } computeBoundingBox() {} computeBoundingSphere() {} }
  const THREE = { BufferGeometry: Geo, Float32BufferAttribute: class extends Attr { constructor(a, k) { super(Float32Array.from(a), k); } } };
  const { vkBol } = al(['vkBol'], { THREE });
  /* 4 üçgen: ikisi y=0 civarında, ikisi y=1 civarında (indekssiz) */
  const tri = (y) => [0, y, 0, 1, y, 0, 0, y + .1, 0];
  const g = new Geo(); g.setAttribute('position', new Attr([...tri(0), ...tri(.05), ...tri(1), ...tri(1.05)], 3));
  const k = vkBol(g, { x: 0, y: .5, z: 0 }, { x: 0, y: 1, z: 0 });
  assert.equal(k.nA / 9, 2, 'üst parça 2 üçgen'); assert.equal(k.nB / 9, 2, 'alt parça 2 üçgen');
  assert.ok(Array.from(k.A.attributes.position.array).filter((_, i) => i % 3 === 1).every((y) => y > .5));
  assert.ok(Array.from(k.B.attributes.position.array).filter((_, i) => i % 3 === 1).every((y) => y < .5));
  /* indeksli geometri de aynı sonucu verir */
  const gi = new Geo(); gi.setAttribute('position', g.attributes.position); gi.index = { count: 12, getX: (i) => i };
  const ki = vkBol(gi, { x: 0, y: .5, z: 0 }, { x: 0, y: 1, z: 0 });
  assert.equal(ki.nA, k.nA); assert.equal(ki.nB, k.nB);
});

/* ---- Dr. Ela'nın soruları ---- */
test('vkSecenek: doğru şık her zaman listede, tekrar yok, indeks doğru', () => {
  const { vkSecenek } = al(['vkSecenek']);
  const hepsi = ['Kemik', 'Kas', 'Damar', 'Sinir', 'Organ'];
  for (let i = 0; i < 200; i++) {
    const d = hepsi[i % 5], r = vkSecenek(d, hepsi);
    assert.equal(r.sec.length, 3); assert.equal(r.sec[r.dogru], d); assert.equal(new Set(r.sec).size, 3);
  }
  const r = vkSecenek('Uyluk kemiği', ['Uyluk atardamarı', 'Uyluk kemiği']); assert.equal(r.sec.length, 2); assert.equal(r.sec[r.dogru], 'Uyluk kemiği');
});

test('vkBolge: yapının merkezine göre doğru vücut bölgesi (tek taraf esas alınır)', () => {
  const sphereOf = (ms) => { const c = ms.reduce((a, m) => ({ x: a.x + m.c[0] / ms.length, y: a.y + m.c[1] / ms.length }), { x: 0, y: 0 }); return { center: c }; };
  const { vkBolge, VK_BOLGE } = al(['vkBolge', 'VK_BOLGE'], { sphereOf });
  const m = (x, y, side) => ({ c: [x, y], userData: { side } });
  const B = (...ms) => VK_BOLGE[vkBolge(ms)];
  assert.equal(B(m(-.09, .66, 'R'), m(.09, .66, 'L')), VK_BOLGE[4], 'femur');
  assert.equal(B(m(-.2, 1.25, 'R'), m(.2, 1.25, 'L')), VK_BOLGE[3], 'humerus: iki taraf ortalanınca göğüs çıkmamalı');
  assert.equal(B(m(-.03, 1.4, 'R'), m(.03, 1.4, 'L')), VK_BOLGE[0], 'a. carotis communis boyunda');
  assert.equal(B(m(0, 1.6)), VK_BOLGE[0], 'cranium');
  assert.equal(B(m(-.08, .9, 'R')), VK_BOLGE[2], 'gluteus maximus kalçada');
  assert.equal(B(m(0, .98)), VK_BOLGE[2], 'kolon');
  assert.equal(B(m(0, 1.25)), VK_BOLGE[1], 'kalp');
});

test('ipucu merdiveni: 1 bölge, 2 yakın + saydam katman, 3 üç soru; kırık varsa odağa yaklaşır', () => {
  const ip = sliceDeclaration(AN, 'vkIpucu');
  assert.match(ip, /if \(n === 1\) \{ vkFrame\(hs, 3\.2\);/);
  assert.match(ip, /const o = vkOdak\(sid\); vkFrame\(hs, o \? 2\.2 : 1\.25, o\);/);
  const k = (ip.match(/vkFrame\(hs, ([\d.]+)\)/g) || []).map((x) => +x.match(/[\d.]+/)[0]);
  assert.ok(k[0] > k[1], 'her adımda daha yakın: ' + k.join(' > '));
  assert.match(ip, /sorular: \[/); assert.equal((ip.match(/\{ s: '/g) || []).length, 3, 'üç soru');
  assert.match(ip, /son: 'İşte orada: parlayan yapıya şimdi sen dokun\.'/, 'son dokunuş öğrencinin');
  assert.match(ip, /vkHale\(hs, true\); const o = vkOdak\(sid\); vkFrame\(hs, o \? 1\.6 : \.95, o\);/, 'son soru kırık/odak noktasına iner');
  assert.doesNotMatch(ip, /selectMesh|caseClick|CASE\.i\+\+/, 'ipucu yapıyı öğrenci yerine seçmez');
  assert.match(AN, /const VK_ETIKET = \['İpucu \+ bölgeye bak', 'Yakına git', 'Dr\. Ela ile bul'\];/);
});

test('vaka akışı: başlarken lezyon + adım katmanı, doğru dokununca sonraki sistem, kapanınca model eski haline', () => {
  const sc = sliceDeclaration(AN, 'startCase');
  assert.match(sc, /await vkLezyon\(c\); await vkAdim\(c\.steps\[0\]\[0\]\); vkRehber\(\);/);
  assert.match(AN, /vkLezKaldir\(\); vkKatmanGeri\(\); \}/, 'kapat: kırık geri alınır, katmanlar geri gelir');
  const cc = sliceDeclaration(AN, 'caseClick');
  assert.match(cc, /vkHale\(null\);/); assert.match(cc, /vkAdim\(CASE\.c\.steps\[CASE\.i\]\[0\]\)/); assert.match(cc, /setTimeout\(vkKatmanGeri, 1600\)/);
  const va = sliceDeclaration(AN, 'vkAdim');
  assert.match(va, /if \(k === hedef\) \{ L\.on = true; L\.op = 1; \}/); assert.match(va, /L\.op = hedef === 'iskelet' \? 1 : \.32;/, 'kemik dışı adımda iskelet saydam bağlam');
  const lk = sliceDeclaration(AN, 'vkLezKaldir');
  assert.match(lk, /if \(l\.g0\) \{ const g = l\.m\.geometry; l\.m\.geometry = l\.g0; g\.dispose\(\); \}/, 'asıl geometri geri konur');
  const lz = sliceDeclaration(AN, 'vkLezyon');
  assert.match(lz, /fr\.onBeforeRender = function/, 'küçük parça seçim kimliğini asıl yapıdan alır');
  assert.match(lz, /depthTest: false/, 'işaret dokunun içinde kalsa da görünür');
  assert.match(lz, /if \(VK\.lez\.length && !RM\.matches\)/, 'hareket azaltmada nabız yok');
});

/* ---- medica-cerrah: soru sorarak götürme sözleşmesi ---- */
test('medica-cerrah: kademe nesne döndürürse sorgula; ceza değişmedi; tek başına çalışır', () => {
  assert.match(CER, /var CEZA = \[5, 10, 20\];/);
  assert.match(CER, /if \(typeof cv === 'object' && cv\.sorular && cv\.sorular\.length\) \{ sorgula\(cv\); return; \}/);
  assert.match(CER, /soyle\(typeof cv === 'object' \? cv\.metin : cv\); dugmeler\(\);/, 'eski metin kademeleri çalışmaya devam eder');
  assert.match(CER, /if \(j !== q\.dogru\) \{ x\.classList\.add\('no'\); x\.disabled = true; soyle\(q\.yanlis/, 'yanlış şık kapanır, açıklama gelir, aynı soru bekler');
  assert.match(CER, /try \{ if \(q\.sonra\) q\.sonra\(\); \} catch \(er\) \{\}/, 'doğru cevapta model yaklaşır');
  assert.match(CER, /if \(S\.cev\) r\.removeEventListener\('click', S\.cev\);/, 'yeniden açılınca eski dinleyici kalmaz');
  assert.match(CER, /if \(o\.anahtar\(\) !== ak\) \{ dugmeler\(\); return; \}/, 'öğrenci yapıyı bulursa sorular biter');
  assert.match(CER, /var bildir = function \(n\) \{ if \(W\.parent === W\) return;/, 'Medica dışında hastaneye ileti gitmez');
  assert.match(AN, /function medicaCerrah\(o\) \{ if \(window\.AXCERRAH\) \{ window\.AXCERRAH\.kur\(o\); return; \} if \(document\.querySelector\('script\[data-axc\]'\)\) return;/);
});

summary();
