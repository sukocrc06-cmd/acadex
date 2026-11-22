/* ==========================================================================
   ACADEX — ACADEX KIDS: UZAY TEMASI (tests/kids-uzay.js), 19.11.2026

   NEDEN VAR: Giriş akışı ve harita uzayda geçer (kids/assets/kids-uzay.js/.css):
   adalar konunun renginde gezegen, çocuk kendi hayvanıyla kasklı astronot olarak
   gezegenden gezegene uçar, arkada kat kat yıldızlar, kayan yıldızlar ve ateş topları.
   Bu dosya şunları korur:
     - paket: dosyalar index.html içinde, dış kaynak yok, kids-ciz'den sonra yüklenir
     - gezegen: NaN yok, her gezegenin degrade kimliği tek, aşamaya göre bayrak / ay / altın
       halka, kilitli gezegende süs yok ve soluk
     - harita: gezegen çizer, astronot uçuşu bitince konu açılır, Acadia ikinci kez uçmaz
     - uzay yalnız giriş ve haritada; konu ekranlarının kendi sahnesi bozulmaz
     - hareketi azaltta yıldızlar durağan, kayan yıldız / ateş topu yok
     - telefonu yormaz: piksel oranı en çok 2, sekme gizliyken durur
     - 3B galaksi (kids-uzay3d.mjs, three.js r160 içinde): dış bağlantı yok, çevrimdışı önbellekte,
       WebGL yoksa / modül gelmezse düz haritaya döner; düğmeler gerçek düğme olarak gezegen üstünde
   Tarayıcıda (Playwright + SwiftShader WebGL, masaüstü + telefon) denendi.
   Çalıştırma:  node tests/kids-uzay.js
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
const js = read('kids/assets/kids-uzay.js'), css = read('kids/assets/kids-uzay.css'), app = read('kids/assets/kids-app.js'), ucus = read('kids/assets/kids-ucus.js');

test('paket: uzay dosyaları index.html içinde, dış kaynak yok', () => {
  const b = read('kids/assets/birlestir.js'), html = read('kids/index.html');
  for (const f of ['kids-uzay.css', 'kids-uzay.js']) assert.ok(b.includes("'" + f + "'"), f);
  assert.ok(b.indexOf("'kids-uzay.js'") > b.indexOf("'kids-ciz.js'") && b.indexOf("'kids-uzay.js'") < b.indexOf("'kids-app.js'"));
  for (const f of ['kids-uzay.js', 'kids-uzay.css']) {
    assert.ok(html.includes(read('kids/assets/' + f).trim().slice(0, 2500)), f + ' eski: node kids/assets/birlestir.js');
    assert.doesNotMatch(read('kids/assets/' + f), /https?:\/\/(?!www\.w3\.org)/, f + ' dış kaynak yok');
  }
});

const win = { matchMedia: () => ({ matches: false }), addEventListener() {}, document: { readyState: 'complete', getElementById: () => null, addEventListener() {}, documentElement: { classList: { contains: () => false } } } };
win.window = win;
const ctx = { window: win, document: win.document, Math, JSON, String, Number, Array, Object, parseInt, isFinite };
vm.createContext(ctx);
vm.runInContext(read('kids/assets/kids-ciz.js'), ctx);
vm.runInContext(js, ctx);
const U = win.KIDS_UZAY;

test('gezegen: NaN yok, degrade kimliği tek, aşama süsleri, kilitli soluk', () => {
  const g0 = U.gezegen('#FF7AA8', 'yildiz', false, 0, 0), g3 = U.gezegen('#4AA8FF', 'yildiz', false, 3, 1), k = U.gezegen('#4AA8FF', 'yildiz', true, 3, 2);
  for (const s of [g0, g3, k]) { assert.ok(!/NaN|undefined/.test(s)); assert.match(s, /class="kc kc-ada kz-gz/); }
  const ids = [g0, g3, k].flatMap((s) => [...s.matchAll(/id="(kz[gl]\d+)"/g)].map((m) => m[1]));
  assert.equal(new Set(ids).size, ids.length, 'her gezegenin degradesi kendine ait');
  assert.ok(!/kz-bayrak|kz-ay|kz-altin/.test(g0));
  assert.ok(/kz-bayrak/.test(g3) && /kz-ay/.test(g3) && /kz-altin/.test(g3));
  assert.ok(!/kz-bayrak|kz-ay|kz-altin/.test(k), 'kilitlide süs yok');
  assert.match(k, /kz-kilit/); assert.match(k, /opacity="\.45"/);
  assert.match(g3, /a92 22 0 0 0 184 0/, 'her üç gezegenden birinde halka');
  assert.equal(U._test.karis('#000000', '#ffffff', 0.5), '#808080');
});

test('harita: gezegen çizer; astronot uçar, sonra konu açılır; Acadia ikinci kez uçmaz', () => {
  assert.match(app, /W\.KIDS_UZAY \? W\.KIDS_UZAY\.gezegen\(k\.renk, k\.simge, !k\.acik, k\.acik \? as : 0, i\) : C\.ada/);
  assert.match(app, /W\.KIDS_UZAY\.uc\(kid, function \(\) \{ adaSec\(kid\); \}\)/);
  assert.match(app, /W\.KIDS_UZAY\.yerlestir\(app, \{ anahtar:/);
  assert.match(app, /duration: uzay \? 1 : 780/);
  assert.match(ucus, /W\.KIDS_UZAY \? W\.KIDS_UZAY\.gezegen\(/, 'giriş uçuşunda da gezegenler');
  assert.match(js, /setTimeout\(bit, 1400\)/, 'animasyon takılsa da konu açılır');
});

test('uzay yalnız giriş ve harita; hareketi azaltta sakin; telefonu yormaz', () => {
  assert.match(js, /var TAM = \{ giris: 1, harita: 1 \}, SAKINGOR = \{\}/);
  assert.match(js, /if \(SAKIN \|\| tek\) return;/, 'hareketi azaltta kayan yıldız / ateş topu yok');
  assert.match(js, /if \(SAKIN\) \{ ciz\(performance\.now\(\), true\); return; \}/);
  assert.match(js, /Math\.min\(2, W\.devicePixelRatio/);
  assert.match(js, /if \(D\.hidden\) dur\(\); else basla\(\)/);
  assert.match(css, /\.kz-tuval\{position:fixed;inset:0;[^}]*pointer-events:none/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.kz-ast\{animation:none\}/);
  assert.match(css, /html\.kz-uzay body,html\.kz-uzay-sakin body\{\s*background-color:#0B1033/);
});


test('3B galaksi: modül yerel, önbellekte, düşerse düz harita; düğmeler gezegen üstünde', () => {
  const mjs = read('kids/assets/kids-uzay3d.mjs'), src = read('kids/assets/kids-uzay3d.src.js'), sw = read('kids/sw.js'), css3 = css;
  assert.ok(mjs.length > 100000 && mjs.length < 700000, 'paket boyutu ' + mjs.length);
  assert.match(mjs, /"160"/, 'three r160 (MedLab kampüsüyle aynı)');
  assert.doesNotMatch(mjs, /(?:import|from)\s*["']https?:/, 'CDN içe aktarımı yok');
  assert.doesNotMatch(mjs, /cdn\.jsdelivr|unpkg|esm\.sh/);
  assert.match(src, /export function kur\(o\)/);
  assert.match(sw, /'\/kids\/assets\/kids-uzay3d\.mjs'/, 'çevrimdışı önbellekte');
  assert.match(js, /new Function\('u', 'return import\(u\)'\)\('\/kids\/assets\/kids-uzay3d\.mjs'\)/, 'eski tarayıcıda sözdizimi hatası yok');
  assert.match(js, /var sure = setTimeout\(vazgec, 7000\)/, 'modül gelmezse düz harita');
  assert.match(js, /getContext\('webgl2'\) \|\| c\.getContext\('webgl'\)/);
  assert.match(js, /if \(U3 && U3\.harita && U3\.harita\.isConnected\)/, 'uçuş 3B astronotla');
  assert.match(app, /app\.querySelector\('\.kz-ast-yer, \.kz3-acik'\)/);
  assert.match(css3, /\.ka-harita\.kz3-acik \.ka-ada\{[^}]*pointer-events:auto/);
  assert.match(css3, /isolation:isolate/, 'etiketler üst çubuğun üstüne taşmaz');
  assert.match(src, /if \(!kap\.isConnected\) \{ temizle\(\); return; \}/, 'harita kapanınca WebGL bırakılır');
  assert.match(src, /if \(sakin\) \{ suan = i; A\.a\.position\.copy\(astYeri\(i\)\); park\(i\); hedef\.copy\(hedefSon\); return setTimeout\(sonra, 0\); \}/, 'hareketi azaltta uçuş ve dalış yok');
});

/* 20.11.2026: kullanıcı ekranında Colours / Numbers / Animals üst üste binmişti */
test('yerleşim: gezegenler eşit aralıklı sarmalda, hiçbiri ötekine binmez (22 konu)', () => {
  const src = read('kids/assets/kids-uzay3d.src.js');
  const m = /const N = o\.konular\.length, R0 = ([\d.]+), B = ([\d.]+), ADIM = ([\d.]+);/.exec(src); assert.ok(m, 'sabitler');
  const PR = +/const PR = ([\d.]+);/.exec(src)[1], R0 = +m[1], B = +m[2], ADIM = +m[3];
  let th = 0; const P = [];
  for (let i = 0; i < 22; i++) { const r = R0 + B * th, a = th - 0.5; P.push([Math.cos(a) * r, Math.sin(a) * r]); th += ADIM / Math.hypot(r, B); }
  /* halkalı gezegen ~ PR*1.95 yarıçap; adı altta: iki gezegen merkezi arası en az ~4.5 PR */
  let en = Infinity; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) en = Math.min(en, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]));
  assert.ok(en >= PR * 4.5, 'en yakın iki gezegen ' + en.toFixed(2) + ' < ' + (PR * 4.5).toFixed(2));
  assert.ok(2 * Math.PI * B >= PR * 5, 'sarmal kolları arası yeterli');
  assert.ok(R0 > 1.7 + PR * 2.5, 'ilk gezegen güneşe değmez');
});

test('dalış: kamera gezegene iner, konu açılır, sonra harita eski haline döner', () => {
  const src = read('kids/assets/kids-uzay3d.src.js');
  assert.match(src, /function dal\(i, sonra\)/);
  assert.match(src, /A\.a\.rotation\.y = 0\.5; dal\(suan, s\); \}/, 'uçuş bitince dalış');
  assert.match(src, /if \(i === suan\) \{ A\.a\.position\.copy\(astYeri\(i\)\); return dal\(i, sonra\); \}/, 'zaten oradaysa da dalar');
  assert.match(src, /if \(ucus \|\| dalis\) return;/, 'çift dokunuş iki kez açmaz');
  assert.match(src, /uzak = dalis\.u0 \+ \(PR \* 1\.25 - dalis\.u0\) \* e/, 'kamera gezegenin yüzeyine kadar iner');
  assert.match(src, /harita\.classList\.remove\('kz3-dal'\)/, 'konu kapanınca adlar geri gelir');
  assert.match(src, /uzak = uzakSon = d\.u0; A\.a\.visible = true;/);
  assert.match(css, /\.ka-harita\.kz3-dal \.ka-adalar li,\.ka-harita\.kz3-dal \.kz-dostlar\{opacity:0;pointer-events:none\}/);
});

test('alt çubuk uzayda ince ve yarı saydam; harita ekranın altına uzanır', () => {
  assert.match(css, /html\.kz-uzay \.ka-dock-r\{width:44px/);
  assert.match(css, /html\.kz-uzay \.ka-dock-ic\{[^}]*backdrop-filter:blur/);
  assert.match(css, /html\.kz-uzay \.ka-dock-bosluk\{height:calc\(76px/);
  assert.match(css, /@media \(max-width:600px\)\{\s*html\.kz-uzay \.ka-dock/);
});

test('canlı gökyüzü: nebula, kuyruklu yıldız, UFO; ateş topu ve UFO dokunulur, düğmeler etkilenmez', () => {
  for (const f of ['function nebula()', 'function kuyrukluEkle()', 'function ufoEkle()', 'function patlat(', 'function dokunus(e)']) assert.ok(js.includes(f), f);
  assert.match(js, /W\.addEventListener\('pointerdown', dokunus, true\)/, 'sürüklemeden önce yakalanır');
  assert.match(js, /if \(mod !== 'harita' \|\| SAKIN\) return;/, 'yalnız haritada, hareketi azaltta yok');
  assert.match(js, /t\.closest\('button,a,input,select,textarea,label,\[role="button"\],\.ka-dock,\.ka-serit'\)/, 'düğmeye dokunuş gezegeni açmaya devam eder');
  assert.match(js, /f\.hiz = true; f\.vx \*= 3\.4/, 'ateş topu hızlanır');
  assert.match(js, /if \(f\.hiz && f\.t > f\.bit\) \{ patlat\(/, 'sonra yıldız patlaması');
  assert.match(js, /u\.isin = 0\.9; u\.kac = true;/, 'UFO ışık saçar ve kaçar');
  assert.match(js, /KAY = \[\]; ATES = \[\]; KUY = \[\]; UFO = \[\]; PAR = \[\];/, 'haritadan çıkınca temizlenir');
});

test('astronot arkadaşlar: gerçek düğme, sırayla el sallar / takla / zıplar, adların altında', () => {
  assert.match(js, /dostlarKur\(harita, o\);/);
  /* 20.11.2026: konudan dönünce düz harita kalıyordu; uzay sınıfı haritayı kurmadan önce açılmalı */
  assert.match(js, /if \(app\) guncelle\(app\);\s*var harita = kok\.querySelector\('\.ka-harita'\); if \(!harita \|\| !aktif\(\)\) return;/);
  assert.match(js, /b\.type = 'button'; b\.className = 'kz-dost';/);
  assert.match(js, /HAREKET = \['kz-selam', 'kz-takla', 'kz-zipla'\]/);
  assert.match(js, /C\.HAYVAN\.filter\(function \(h\) \{ return h !== o\.hayvan; \}\)/, 'çocuğun kendi hayvanı değil');
  assert.match(js, /harita\.insertBefore\(kat, adalar \|\| null\)/, 'gezegen düğmelerinin altında');
  assert.match(js, /<g class="kz-kol">/, 'sallanan kol');
  assert.match(css, /\.kz-dost\.kz-selam \.kz-kol\{animation:kzSalla/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.kz-dost\.kz-selam/);
});

test('22.11.2026: büyük konu kartı yerine ince cam şerit; bugün ışık sütunu; roket bekler ve yol boyunca uçar; kilitli gezegen bulutsuda', () => {
  const src = read('kids/assets/kids-uzay3d.src.js'), mjs = read('kids/assets/kids-uzay3d.mjs');
  /* kart kalktı; başlık ekran okuyucuda; sol üstte tek satırlık cam şerit + tek düğme (bugün: Uç, serbest: Sürpriz) */
  assert.doesNotMatch(app, /class="ka-bugun/); assert.doesNotMatch(app, /class="ka-rehber/); assert.match(app, /<h1 class="ka-gizli">/);
  assert.match(app, /function gunBandi\(bugun\)/); assert.match(app, /class="ka-serit-uc" data-konu="' \+ bugun\.id/); assert.match(app, /class="ka-serit-uc" data-surpriz/);
  assert.match(app, /cikis = app\.querySelector\('\.ka-serit-acd'\)/);
  assert.match(css, /\.ka-serit\{[^}]*min-height:56px/); assert.match(css, /backdrop-filter:blur/); assert.match(css, /prefers-reduced-motion:reduce\)\{\.ka-serit,/);
  assert.doesNotMatch(css, /\.ka-rehber/);
  /* yeni açılan gezegen: ilk girişte sessiz, sonra bir kez bulut dağılır */
  assert.match(app, /if \(!il\.acikGor\) \{ il\.acikGor = acikIds\.slice\(\);/); assert.match(app, /yeniAcik: !!yeniAcik\[k\.id\]/);
  assert.match(js, /yeniAcik: !!k\.yeniAcik/);
  assert.match(src, /function bulutsuKur\(i\)/); assert.match(src, /if \(kilit \|\| k\.yeniAcik\)/); assert.match(src, /if \(u >= 1\) \{ b\.g\.visible = false; p\.ek\.bulut = null; \}/);
  assert.match(src, /if \(sakin\) G2\.forEach\(\(p\) => \{ if \(p\.ek\.bulut && p\.ek\.bulut\.dagit\)/, 'hareketi azaltta dağılma beklemez');
  /* roket son gidilen gezegende bekler, uçuş oradan kalkar, inince yine park eder */
  assert.match(src, /function park\(i\)/); assert.match(src, /kalk: rokYeri\(suan\)/); assert.match(src, /p\.lerp\(rokYeri\(ucus\.i\), in_ \* in_\)/);
  /* 3B: kamera bugüne bakar, sütun, roket, iz, ilerlemeye göre yol; eğri parametresi 1'i aşmaz */
  assert.match(src, /const bugunI = o\.konular\.findIndex\(\(k\) => k\.bugun\);/);
  assert.match(src, /ek\.sutun = sutun/); assert.match(src, /function roketKur\(yuzSvg\)/); assert.match(src, /ucus = \{ roket: true/);
  assert.match(src, /const yanik = o\.konular\.map\(\(k\) => !k\.kilit && \(k\.asama \|\| 0\) >= 2\)/);
  assert.match(src, /egri\.getPoint\(MathUtils\.clamp\(/);
  assert.match(src, /if \(sakin\) \{ suan = i;[^\n]*return setTimeout\(sonra, 0\); \}\n    if \(i === suan\)/, 'hareketi azaltta roket yok, anında');
  assert.ok(mjs.length > 100000 && /roket|BUGÜN|kayan nokta/.test(src), 'paket üretilmiş');
});

summary();
