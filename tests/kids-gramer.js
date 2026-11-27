/* ==========================================================================
   ACADEX KIDS — ZAMAN MAKİNESİ KASABASI TESTLERİ (tests/kids-gramer.js), 27.11.2026

   NEDEN VAR: ilkokul dil bilgisi (30 konu, Kolay 2. / Orta 3. / Zor 4. sınıf) üç adımla öğretilir:
   İzle → Dene → Oyna. Veri elle yazılıyor; bir boşluk, yanlış seçenek ya da bozuk kelime işareti
   çocuğa yanlış İngilizce öğretir ya da oyunu kilitler.
     - Her seviyede 10 konu, her konuda en az 4 anlatım karesi, 5 deneme, 6 oyun sorusu.
     - Boşluklu cümlede tek "___"; doğru cevap yanlışların arasında olmaz; seçenekler tekil.
     - "Doğru mu?" sorusunda yanlış cümlenin doğrusu yazılı olmalı.
     - Ek (play+s) ve dönüşüm (go>went) işaretleri doğru çözülmeli.
     - Binalar sırayla, adımlar sırayla açılır; üst seviye alt seviye bitince ya da sınıf yetince açılır.
     - Kasabanın söylediği cümleler ses kataloğunda.
   Calistirma:  node tests/kids-gramer.js
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
const js = read('kids/assets/kids-gramer.js'), css = read('kids/assets/kids-gramer.css'), app = read('kids/assets/kids-app.js'), bir = read('kids/assets/birlestir.js');
const W = { document: { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() { }, documentElement: { classList: { add() { }, toggle() { } } } }, addEventListener() { }, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() { } }, navigator: {}, console };
W.window = W; W.self = W; vm.createContext(W);
for (const f of ['kids-ciz.js', 'kids-gramer2.js', 'kids-gramer.js']) vm.runInContext(read('kids/assets/' + f), W, { filename: f });
const G = W.KIDS_GRAMER, V = W.KIDS_GRAMER_VERI;

test('30 konu: her seviyede 10, kolaydan zora; zaman konuları doğru istasyonda', () => {
  assert.equal(V.KONU.length, 30);
  for (const sv of [2, 3, 4]) assert.equal(V.KONU.filter((k) => k.sv === sv).length, 10, sv + '. sınıf');
  assert.deepEqual(Array.from(V.KONU, (k) => k.sv), [...Array(10).fill(2), ...Array(10).fill(3), ...Array(10).fill(4)], 'sıra kolay → orta → zor');
  assert.equal(new Set(V.KONU.map((k) => k.id)).size, 30);
  const bul = (id) => V.KONU.find((k) => k.id === id);
  assert.equal(bul('k-be').sv, 2); assert.equal(bul('o-genis').zaman, 'her'); assert.equal(bul('o-simdiki').zaman, 'simdi');
  for (const id of ['z-was', 'z-ed', 'z-duzensiz', 'z-did', 'z-could']) assert.equal(bul(id).zaman, 'dun', id);
  for (const id of ['z-will', 'z-going']) assert.equal(bul(id).zaman, 'yarin', id);
  for (const k of V.KONU) for (const f of k.iz) if (f.z) assert.ok(['dun', 'her', 'simdi', 'yarin'].includes(f.z), k.id + ' istasyon ' + f.z);
});

test('veri sağlam: anlatım, deneme ve oyun soruları', () => {
  for (const k of V.KONU) {
    assert.ok(k.iz.length >= 4, k.id + ' en az 4 kare');
    for (const f of k.iz) { assert.ok(f.t && f.t.length > 10, k.id + ' anlatım'); const p = G.parca(f.s); assert.ok(p.bloklar.length >= 2, k.id + ' cümle: ' + f.s); for (const b of p.bloklar) assert.ok(b.m && !/[+>/]/.test(b.m), k.id + ' blok: ' + b.m); if (f.r) assert.match(f.r, /^[a-z-]+$/); }
    assert.equal(k.de.length, 5, k.id + ' 5 deneme');
    for (const d of k.de) { assert.equal(d[0].split('___').length, 2, k.id + ' tek boşluk: ' + d[0]); assert.ok(!d[2].includes(d[1]), k.id + ' doğru yanlışlarda: ' + d[0]); assert.equal(new Set([d[1], ...d[2]]).size, d[2].length + 1); assert.ok(d[3], k.id + ' Türkçesi'); }
    assert.equal(k.oy.length, 6, k.id + ' 6 oyun');
    const tip = new Set();
    for (const o of k.oy) {
      const q = G.oyCoz(o); tip.add(q.t);
      if (q.t === 's') { assert.equal(q.c.split('___').length, 2, k.id + ' ' + o); assert.ok(!q.y.includes(q.d) && q.y.length >= 1, k.id + ' ' + o); }
      if (q.t === 'y') { if (!q.ok) assert.ok(q.dz && q.dz !== q.c, k.id + ' doğrusu: ' + o); }
      if (q.t === 'd') assert.ok(G.parca(q.s).bloklar.length >= 3, k.id + ' sıralama: ' + o);
      assert.ok(q.tr, k.id + ' Türkçesi: ' + o);
    }
    assert.deepEqual([...tip].sort(), ['d', 's', 'y'], k.id + ' üç soru türü');
  }
});

test('ek ve dönüşüm işaretleri; görünen cümle', () => {
  const p = G.parca('She/s play+s/v football/o .');
  assert.equal(p.son, '.'); assert.equal(p.bloklar[1].kok, 'play'); assert.equal(p.bloklar[1].ek, 's'); assert.equal(p.bloklar[1].m, 'plays'); assert.equal(p.bloklar[1].r, 'v');
  const d = G.parca('I/s go>went/v to_the_zoo/o .').bloklar[1]; assert.equal(d.eski, 'go'); assert.equal(d.m, 'went');
  assert.equal(G.metin('This/s is/v Ali+\'s/x bag/o .'), 'This is Ali\'s bag.');
  assert.equal(G.metin('Open/v the_door,/o please/x !'), 'Open the door, please!');
  assert.equal(G.metin('two/x cat+s/o'), 'two cats');
  assert.equal(G.yildiz(0), 3); assert.equal(G.yildiz(2), 2); assert.equal(G.yildiz(9), 1);
});

test('ilerleme: bina ve adım sırası, seviye kilidi', () => {
  G._oz({ sinifAd: 0 });
  const L2 = V.KONU.filter((k) => k.sv === 2), i = { ilkSinif: 2, gramer: {} };
  assert.ok(G.konuAcik(i, L2, 0)); assert.ok(!G.konuAcik(i, L2, 1));
  i.gramer[L2[0].id] = { izle: 1, dene: 2 }; assert.ok(!G.konuAcik(i, L2, 1), 'oyna bitmeden sıradaki açılmaz');
  i.gramer[L2[0].id].oyna = 1; assert.ok(G.konuAcik(i, L2, 1)); assert.ok(G.bittiMi(i, L2[0].id));
  assert.ok(G.adimAcik({}, 'izle') && !G.adimAcik({}, 'dene') && G.adimAcik({ izle: 1 }, 'dene') && !G.adimAcik({ izle: 1 }, 'oyna') && G.adimAcik({ izle: 1, dene: 1 }, 'oyna'));
  assert.ok(G.seviyeAcik(i, 2) && !G.seviyeAcik(i, 3) && !G.seviyeAcik(i, 4));
  L2.forEach((x) => { i.gramer[x.id] = { izle: 1, dene: 3, oyna: 3 }; }); assert.ok(G.seviyeAcik(i, 3), 'kolay bitince orta açılır'); assert.ok(!G.seviyeAcik(i, 4));
  assert.ok(G.seviyeAcik({ ilkSinif: 4 }, 3) && G.seviyeAcik({ ilkSinif: 4 }, 4), '4. sınıfta hepsi açık');
});

test('haritaya bağlı, pakette, veli raporunda; önek kzm, hareketi azalt', () => {
  assert.match(app, /data-gramer aria-label="Zaman Makinesi Kasabasına git"/);
  assert.match(app, /\(W\.KIDS_GRAMER && W\.KIDS_EKIP \? '<button type="button" class="ka-portal kzm-portal"/, 'kapı yalnız test ekibinde');
  assert.match(js, /function kAcik\(i, L, k\) \{ return ekip\(\) \|\| konuAcik\(i, L, k\); \}/, 'ekipte hepsi açık');
  assert.match(app, /W\.KIDS_GRAMER\.ac\(\{ kok: app, il: ilerleme/);
  assert.match(app, /W\.KIDS_GRAMER && W\.KIDS_GRAMER\.rapor \? W\.KIDS_GRAMER\.rapor\(il\)/);
  assert.ok(bir.indexOf("'kids-gramer2.js'") > 0 && bir.indexOf("'kids-gramer2.js'") < bir.indexOf("'kids-gramer.js'") && bir.indexOf("'kids-gramer.js'") < bir.indexOf("'kids-app.js'"));
  assert.match(bir, /'kids-gramer\.css'/);
  assert.doesNotMatch(js, /['"]kg-|class="kg /, 'kg- öneki kids sitesinde dolu');
  const kurallar = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
  for (const b of kurallar.split(/(?=@media)/)) if (/animation:/.test(b) && !/^@media \(prefers-reduced-motion:no-preference\)/.test(b.trim())) for (const l of b.split('}')) if (/animation:/.test(l) && !/animation:none/.test(l)) assert.fail('korumasız animasyon: ' + l.trim().slice(0, 90));
  const sec = kurallar.split('}').map((r) => r.split('{').slice(-2, -1)[0] || '').map((x) => x.trim()).filter((x) => x && !/^(from|to|\d|@)/.test(x));
  for (const x of sec) for (const parca of x.split(',')) assert.match(parca, /kzm|ka-portal/, 'önek: ' + parca);
  const r = G.rapor({ gramer: { 'k-be': { izle: 1, dene: 3, oyna: 1 } }, gramerLog: [{ t: Date.now() }] });
  assert.match(r, /Zaman Makinesi Kasabası/); assert.match(r, /am \/ is \/ are/, 'tek yıldızlı konu tekrar listesinde');
  assert.equal(G.rapor({}), '');
});

test('kasabanın söylediği cümleler katalogda', () => {
  const c = G.cumleler(), kat = require(path.join(ROOT, 'kids/ses/katalog.js'))(), k = new Set(kat.map((x) => x.dil + ':' + x.metin));
  for (const m of c.en) assert.ok(k.has('en:' + m.trim().replace(/\s+/g, ' ')), 'katalogda yok: ' + m);
  for (const m of c.tr) assert.ok(k.has('tr:' + m.trim().replace(/\s+/g, ' ')), 'katalogda yok: ' + m);
  assert.ok(c.en.includes('She plays football.') && c.en.includes('I went to the zoo yesterday.'));
});

summary();
