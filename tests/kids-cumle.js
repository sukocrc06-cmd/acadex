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
     - (22.11) beş durak: kelime, kural, cümle kur, boşluk, diyalog; her temada geçerli durak verisi;
       gezegen ilerlemesi (kilit, yıldız, rozet); veli köşesinde ilkokul raporu; sesler katalogda
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
for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-cumle2.js', 'kids-cumle.js']) vm.runInContext(read('kids/assets/' + f), W, { filename: f });
const KC = W.KIDS_CUMLE, R = W.KIDS_RESIM, EK = W.KIDS_CUMLE_EK;

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
  assert.match(app, /function portalAcik\(il\) \{ return !!W\.KIDS_CUMLE && \(il\.ilkSinif > 0 \|\| \(il\.ilkSinif === undefined && ilkokulMu\(\)\)\); \}/);
  assert.match(app, /gunBandi\(bugun\) \+ portalHtml\(il\) \+/);
  assert.match(app, /W\.KIDS_CUMLE\.ac\(\{ kok: app, il: ilerleme, kaydet:/);
  assert.match(app, /<select data-vilk>/); assert.match(app, /x\.ilkSinif = Math\.max\(0, \+this\.value\)/);
  assert.match(js, /if \(gy > \(i\.cumle\[id\] \|\| 0\)\) i\.cumle\[id\] = gy;/, 'gezegenin en iyi yıldızı saklanır');
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
test('beş durak; her temada kelime, kural, boşluk ve diyalog verisi sağlam', () => {
  assert.deepEqual(Array.from(KC.DURAK, (d) => d[0]), ['kelime', 'kural', 'blok', 'bosluk', 'diyalog']);
  const ids = [2, 3, 4].flatMap((s) => Array.from(KC.VERI[s], (t) => t.id));
  assert.deepEqual(Object.keys(EK.EK).sort(), ids.slice().sort(), 'her temanın durak verisi var, fazlası yok');
  for (const id of ids) {
    const e = EK.EK[id];
    assert.ok(e.k.length >= 8, id + ': kelime sayısı');
    const en = new Set(); for (const [a, b] of e.k) { assert.ok(a && b, id + ': kelime çifti'); assert.ok(!en.has(a), id + ': ' + a + ' tekrar'); en.add(a); }
    assert.ok(e.r.ad && e.r.tr && e.r.o && e.r.ot, id + ': kural alanları');
    assert.ok(e.r.s.length >= 3 && e.r.s.every((r) => r.length === 2 && r[0] && r[1]), id + ': kural satırları');
    assert.ok(e.b.length >= 4, id + ': boşluk sayısı');
    for (const [c, d, y, tr, k] of e.b) {
      assert.equal(c.split('___').length, 2, c + ': tek boşluk');
      assert.equal(y.length, 2, c + ': iki yanlış'); assert.ok(!y.includes(d), c + ': doğru cevap yanlışlarda yok');
      assert.ok(tr, c + ': Türkçesi'); assert.ok(EK.KALIP[k], c + ': kalıp ' + k);
    }
    assert.ok(e.d.length >= 3, id + ': diyalog sayısı');
    for (const [q, a, y, tr, k] of e.d) {
      assert.match(q, /[?!.]$/); assert.equal(y.length, 2, q); assert.ok(!y.includes(a), q + ': doğru cevap yanlışlarda yok');
      assert.ok(tr && EK.KALIP[k], q + ': Türkçe / kalıp');
    }
  }
});
test('gezegen ilerlemesi: durak sırası, gezegen kilidi, yıldız, rozet', () => {
  const L = KC.VERI[2];
  assert.equal(KC.durakAcik({}, 0), true); assert.equal(KC.durakAcik({}, 1), false);
  assert.equal(KC.durakAcik({ kelime: 2 }, 1), true); assert.equal(KC.durakAcik({ kelime: 2 }, 2), false);
  assert.equal(KC.gezegenYildiz({ kelime: 3, blok: 3, bosluk: 3, diyalog: 3 }), 0, 'kural okunmadan yıldız yok');
  assert.equal(KC.gezegenYildiz({ kelime: 3, kural: 1, blok: 3, bosluk: 3 }), 0, 'durak eksikse yıldız yok');
  assert.equal(KC.gezegenYildiz({ kelime: 3, kural: 1, blok: 3, bosluk: 3, diyalog: 3 }), 3);
  assert.equal(KC.gezegenYildiz({ kelime: 3, kural: 1, blok: 2, bosluk: 1, diyalog: 2 }), 2, 'ortalama yuvarlanır');
  const tam = { kelime: 2, kural: 1, blok: 2, bosluk: 2, diyalog: 2 };
  assert.equal(KC.gezegenAcik({}, L, 0), true); assert.equal(KC.gezegenAcik({}, L, 1), false);
  assert.equal(KC.gezegenAcik({ cumleD: { [L[0].id]: { kelime: 3 } } }, L, 1), false, 'yarım gezegen sıradakini açmaz');
  assert.equal(KC.gezegenAcik({ cumleD: { [L[0].id]: tam } }, L, 1), true);
  assert.equal(KC.gezegenAcik({ cumle: { [L[2].id]: 2 } }, L, 2), true, 'eski oyuncunun yıldızlı gezegeni açık kalır');
  assert.equal(KC.tamamMi({ cumleD: { x: tam } }, 'x'), true);
  assert.match(js, /if \(!\(d\[durak\] >= y\)\) d\[durak\] = y;/, 'en iyi durak yıldızı saklanır');
  assert.match(js, /i\.cumleRozet\[id\] = Date\.now\(\); rozet = true;/);
  assert.match(js, /\.slice\(-60\)/, 'günlük sınırlı');
});
test('veli raporu: boşken hiçbir şey, oynanınca tema, güçlü/zayıf kalıp ve evde söylenecek cümle', () => {
  assert.equal(KC.rapor({}), '');
  const L = KC.VERI[3], now = Date.now();
  const i = { ilkSinif: 3, cumleD: { [L[0].id]: { kelime: 3, kural: 1, blok: 3, bosluk: 3, diyalog: 3 }, [L[1].id]: { kelime: 2 } }, cumle: { [L[0].id]: 3 },
    cumleKalip: { be: { d: 5, y: 0 }, past: { d: 1, y: 4 } }, cumleKurdu: ['I like apples.'], cumleLog: [{ t: now, id: L[0].id, d: 'blok', y: 3 }, { t: now - 30 * 864e5, id: L[0].id, d: 'kelime', y: 3 }] };
  const h = KC.rapor(i);
  assert.match(h, /kc2-rapor/); assert.ok(h.includes(L[0].en), 'tema adı');
  assert.ok(h.includes(EK.KALIP.be), 'güçlü kalıp'); assert.ok(h.includes(EK.KALIP.past), 'zayıf kalıp');
  assert.match(h, /data-en="I like apples."/, 'evde dinlenecek cümle');
  assert.match(app, /W\.KIDS_CUMLE && W\.KIDS_CUMLE\.rapor \? W\.KIDS_CUMLE\.rapor\(il\) : ''/, 'veli özetine bağlı');
});
test('galaksinin söylediği cümleler katalogda; durak verisi paketten önce', () => {
  const c = KC.cumleler(), kat = require(path.join(ROOT, 'kids/ses/katalog.js'))(), k = new Set(kat.map((x) => x.dil + ':' + x.metin));
  for (const m of c.en) assert.ok(k.has('en:' + m.trim().replace(/\s+/g, ' ')), 'katalogda yok: ' + m);
  for (const m of c.tr) assert.ok(k.has('tr:' + m.trim().replace(/\s+/g, ' ')), 'katalogda yok: ' + m);
  assert.ok(c.en.includes('She is my teacher.') && c.en.includes('playground'));
  assert.ok(bir.indexOf("'kids-cumle2.js'") > 0 && bir.indexOf("'kids-cumle2.js'") < bir.indexOf("'kids-cumle.js'"));
});
summary();
