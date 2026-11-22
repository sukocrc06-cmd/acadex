/* ==========================================================================
   ACADEX — ACADEX KIDS: CÜMLE GALAKSİSİ (tests/kids-cumle.js), 22.11.2026
   NEDEN VAR: İlkokul (2-3-4. sınıf) için ayrı galaksi; gezegenler MEB Türkiye Yüzyılı Maarif
   Modeli İngilizce temaları, oyun cümle blokları (kids/assets/kids-cumle.js/.css).
   Bu dosya şunları korur:
     - her sınıfta altı tema (MEB sırası), her temada en az 6 cümle; her cümlenin Türkçesi var,
       blokları en az 3, görevleri geçerli, cümle sonu işareti var; gezegen resimleri gerçek çizim
     - doğru/yanlış denetimi aynı kelimeler tekrar etse de sıraya bakar; karışık hâl doğru sıra olmaz
     - yıldız: 0-1 deneme 3, 2-4 deneme 2, fazlası 1
     - haritada kapı yalnız ilkokulda (ya da velinin seçtiği sınıfta); veli köşesinde sınıf seçimi
     - paket sırası, önek kc2-, hareketi azalt
   Tarayıcıda (Playwright, masaüstü + telefon) baştan sona oynandı.
   Çalıştırma:  node tests/kids-cumle.js
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
const js = read('kids/assets/kids-cumle.js'), css = read('kids/assets/kids-cumle.css'), app = read('kids/assets/kids-app.js'), bir = read('kids/assets/birlestir.js');
const W = { document: { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() { }, documentElement: { classList: { add() { }, toggle() { } } } }, addEventListener() { }, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() { } }, navigator: {}, console };
W.window = W; W.self = W; vm.createContext(W);
for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-cumle.js']) vm.runInContext(read('kids/assets/' + f), W, { filename: f });
const KC = W.KIDS_CUMLE, R = W.KIDS_RESIM;

test('her sınıfta MEB sırasıyla altı tema, her temada en az 6 sağlam cümle', () => {
  const ilk = ['School Life', 'Classroom Life'];
  const idler = new Set();
  for (const s of [2, 3, 4]) {
    const L = KC.VERI[s]; assert.equal(L.length, 6, s + '. sınıf');
    assert.deepEqual(Array.from(L.slice(0, 2), (x) => x.en), ilk, s + '. sınıf ilk iki tema');
    assert.match(L[3].en, /Family Life/);
    for (const t of L) {
      assert.ok(!idler.has(t.id), t.id + ' tekil'); idler.add(t.id);
      assert.ok(R.var(t.simge), t.id + ': gezegen resmi ' + t.simge);
      assert.match(t.renk, /^#[0-9A-F]{6}$/i);
      assert.ok(t.c.length >= 6, t.id + ': cümle sayısı');
      const gor = new Set();
      for (const [en, tr] of t.c) {
        const p = KC.parcala(en);
        assert.ok(tr && tr.length > 2, en + ': Türkçesi');
        assert.ok(p.son, en + ': sonu . ? !');
        assert.ok(p.bloklar.length >= 3 && p.bloklar.length <= 7, en + ': blok sayısı ' + p.bloklar.length);
        assert.ok(p.bloklar.every((b) => /^[sxvoq]$/.test(b.r) && b.m.length), en + ': görevler');
        assert.ok(!/\//.test(en.split(' ').map((w) => w.replace(/\/[a-z]$/, '')).join(' ')), en + ': biçim');
        if (p.son === '?') assert.ok(p.bloklar.some((b) => b.r === 'q') || /^(Can|Could|Do|Is|Have)/.test(p.bloklar[0].m), en + ': soru kelimesi');
        const m = KC.metin(en); assert.ok(!gor.has(m), m + ' tekrar'); gor.add(m);
      }
    }
  }
});
test('denetim, yıldız, karıştırma', () => {
  const s = 'She/s is/v in/o the_library/o .';
  assert.equal(KC.metin(s), 'She is in the library.');
  assert.equal(KC.dogruMu(['She', 'is', 'in', 'the library'], s), true);
  assert.equal(KC.dogruMu(['is', 'She', 'in', 'the library'], s), false);
  assert.equal(KC.dogruMu(['She', 'is', 'in'], s), false);
  const t = 'It/s is/v five/o o\'clock/o .'; assert.equal(KC.dogruMu(['It', 'is', 'five', 'o\'clock'], t), true);
  assert.deepEqual([0, 1, 2, 4, 5, 9].map(KC.yildiz), [3, 3, 2, 2, 1, 1]);
  const p = KC.parcala('I/s like/v apples/o .').bloklar;
  for (let i = 0; i < 30; i++) { const k = KC.karisik(p); assert.notDeepEqual(Array.from(k), [0, 1, 2]); }
});
test('haritada kapı yalnız ilkokulda; veli köşesinde sınıf; oyun bağlı', () => {
  assert.match(app, /function portalAcik\(il\) \{ return !!W\.KIDS_CUMLE && \(il\.ilkSinif > 0 \|\| \(il\.ilkSinif === undefined && S\.sinif && S\.sinif\.bant === 'yildiz'\)\); \}/);
  assert.match(app, /gunBandi\(bugun\) \+ portalHtml\(il\) \+/);
  assert.match(app, /W\.KIDS_CUMLE\.ac\(\{ kok: app, il: ilerleme, kaydet:/);
  assert.match(app, /<select data-vilk>/); assert.match(app, /x\.ilkSinif = Math\.max\(0, \+this\.value\)/);
  assert.match(js, /i\.cumle\[x\.id\] = y/, 'en iyi yıldız saklanır'); assert.match(js, /if \(y > eski\)/);
  assert.match(js, /kart\.onclick = function/, 'her turda dinleyici birikmez');
  assert.match(js, /SES\.soyle\(x\.tr \+ ' gezegenine yolculuk başlıyor!', 'tr'\)/);
});
test('paket sırası, önek, hareketi azalt', () => {
  assert.ok(bir.indexOf("'kids-cumle.js'") > bir.indexOf("'kids-ciz.js'") && bir.indexOf("'kids-cumle.js'") < bir.indexOf("'kids-app.js'"));
  assert.match(bir, /'kids-cumle\.css'/);
  const sec = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{').slice(-2, -1)[0] || '').map((x) => x.trim()).filter((x) => x && !/^(from|to|\d|@)/.test(x));
  for (const x of sec) for (const parca of x.split(',')) assert.match(parca, /kc2|ka-portal/, 'önek: ' + parca);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.ka-portal,/);
});
summary();
