/* ==========================================================================
   ACADEX — ACADIA MASKOT TESTLERI (tests/acadia-maskot.js)

   NEDEN VAR (28.10.2026): Acadia artık Acadex'in maskotu. Tek kaynaktan çizilir
   (js/acadia-kit.js), landing'de scroll'la eşlik eder (js/acadia-rehber.js), her
   panelin başlığında durur (js/acadia-yerinde.js), sağ alttaki düğme de aynı kitten
   gelir ve "Acadia'nı giydir" stüdyosuyla kişiselleştirilir (user_metadata.acadia).
     - Kit yüklenmeden acadex-ink.js çalışırsa sağ alttaki Acadia eski çizime düşer;
       sıra bozulmamalı.
     - Geçersiz bir seçim (eski sürüm, elle düzenlenmiş metadata) çizimi bozmamalı.
     - Panel kılığı yalnız kullanıcı "kılık değiştirsin"i açık bıraktıysa uygulanır.
     - Hareketler prefers-reduced-motion'da durmalı.

   Çalıştırma:  node tests/acadia-maskot.js
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

function loadKit(stored) {
  const ls = {}; if (stored) ls['acadex.acadia.style'] = JSON.stringify(stored);
  const doc = { readyState: 'complete', body: {}, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, dispatchEvent() {}, createElement: () => ({}) };
  const ctx = { console, JSON, Object, Array, String, Math, Date, setTimeout, clearTimeout, CustomEvent: function () {}, document: doc,
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = v; } }, matchMedia: () => ({ matches: true }) };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('js/acadia-kit.js'), ctx);
  return { K: ctx.AcadiaKit, ls };
}

test('kit: ruh hali, poz ve renk SVG\'ye işlenir; eski sağ alt sınıfları korunur', () => {
  const { K } = loadKit();
  const s = K.svg({ mood: 'kutlama', pose: 'selam', size: 100 });
  assert.match(s, /^<svg class="acd acd-m-kutlama acd-p-selam"/);
  assert.match(s, /<g class="bd">/);
  assert.match(s, /class="st"[^>]*style="fill:#FFD86B/);
  assert.match(s, /class="acd-wave"/);
  assert.match(s, /class="acd-fx acd-spark"/);
  const m = K.svg({ mood: 'mutlu' });
  for (const c of ['class="ck"', 'class="ey"', 'class="w"', 'class="pu"', 'class="gl"', 'class="mo"']) assert.ok(m.includes(c), c + ' yok (axa-mas stilleri buna bağlı)');
});

test('kit: aksesuarlar ve renk seçimi çizime girer', () => {
  const { K } = loadKit({ renk: 'nane', bas: 'kep', goz: 'gozluk', boyun: 'papyon' });
  const s = K.svg({});
  assert.match(s, /style="fill:#93E4C4/);
  assert.match(s, /acc acc-bas/); assert.match(s, /acc acc-goz/); assert.match(s, /acc acc-boyun/);
});

test('kit: geçersiz kayıtlı seçim varsayılana döner', () => {
  const { K } = loadKit({ renk: 'mor<script>', bas: 'roket', goz: 1, ifade: 'kizgin', kostum: 'evet' });
  assert.equal(JSON.stringify(K.style), JSON.stringify({ renk: 'sari', bas: '', goz: '', boyun: '', ifade: 'mutlu', kostum: true }));
  assert.doesNotMatch(K.svg({}), /script/);
});

test('kit: panel kılığı yalnız "kılık değiştirsin" açıkken uygulanır', () => {
  const on = loadKit({ boyun: 'atki' }).K.svg({ costume: 'medlab' });
  assert.match(on, /#C8D3DC/, 'MedLab\'de stetoskop beklenir');
  assert.doesNotMatch(on, /#D9485F;stroke/, 'kılık açıkken atkı yerine stetoskop');
  const off = loadKit({ boyun: 'atki', kostum: false }).K.svg({ costume: 'medlab' });
  assert.match(off, /#D9485F;stroke/, 'kılık kapalıyken kullanıcının atkısı kalır');
});

test('bağlantılar: dashboard kit\'i acadex-ink.js\'ten önce, landing kit + rehberi yükler', () => {
  const html = read('dashboard.html'), idx = read('index.html'), ink = read('js/acadex-ink.js');
  const a = html.indexOf('<script src="js/acadia-kit.js"></script>'), b = html.indexOf('<script src="js/acadex-ink.js"></script>');
  assert.ok(a > 0 && b > a, 'acadia-kit.js, acadex-ink.js\'ten önce');
  assert.ok(html.indexOf('<script src="js/acadia-yerinde.js"></script>') > html.indexOf('<script src="js/acadex-medlab.js"></script>'));
  assert.match(html, /href="css\/acadia-kit\.css"/);
  assert.match(html, /data-acd-studio="">Acadia’nı giydir<\/button>/);
  assert.match(html, /class="acd-perch" data-acadia="" data-acd-kt=""/);
  assert.match(idx, /<script src="js\/acadia-kit\.js"><\/script>\n<script src="js\/acadia-rehber\.js"><\/script>/);
  assert.match(ink, /window\.AcadiaKit \? window\.AcadiaKit\.svg\(\{ mood: mood \}\) : MAS_OLD/);
  assert.match(ink, /document\.addEventListener\('acadia:style'/);
});

test('kayıt: user_metadata.acadia, veritabanı sütunu yok', () => {
  const k = read('js/acadia-kit.js');
  assert.match(k, /c\.auth\.updateUser\(\{ data: \{ acadia: STYLE \} \}\)/);
  assert.match(k, /u\.user_metadata && u\.user_metadata\.acadia/);
  assert.doesNotMatch(k, /from\('profiles'\)/);
});

test('stil: maskot hareketleri hareket azaltmada durur', () => {
  const css = read('css/acadia-kit.css');
  const blk = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference){'), css.indexOf('@keyframes acd-bob'));
  for (const k of ['acd-bob', 'acd-blink', 'acd-wave', 'acd-jump', 'acd-hop']) assert.match(blk, new RegExp('animation:' + k + '\\b'), k + ' korumasız');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.acd-guide\{transition:opacity \.3s;transform:none\}/);
});
test('landing rehberi: yıldız gibi kenardan kenara süzülür, altın iz bırakır (02.11.2026)', () => {
  const reh = read('js/acadia-rehber.js'), css = read('css/acadia-kit.css');
  /* her durak bir kenarda; sağ ve sol ikisi de kullanılır */
  const sides = [...reh.matchAll(/\{ q: '[^']+', side: '([lr])'/g)].map((m) => m[1]);
  assert.equal(sides.length, 10); assert.ok(sides.includes('l') && sides.includes('r'));
  /* landing'in .in görünme animasyonu (upIn) transform'u ezip Acadia'yı köşeye çakıyordu */
  assert.match(css, /\.acd-guide\.acd-fly\{left:0;top:0;right:auto;transition:opacity \.5s;will-change:transform;animation:none!important\}/);
  assert.match(reh, /if \(calm\) return;/, 'hareket azaltmada uçuş ve iz yok');
  assert.match(reh, /var want = !narrow\(\);/, 'telefonda eski sabit yerinde');
  assert.match(reh, /cv\.hidden = true;/);
  assert.match(reh, /\.pkt-dock/, 'soldaki paket ipine çarpmaz');
  assert.match(reh, /hush\(\);/, 'uçarken balon kapanır, varınca konuşur');
  assert.match(reh, /host\.classList\.toggle\('say-r', sd === 'l'\)/, 'solda balon sayfanın içine doğru açılır');
  assert.match(css, /#acd-trail\{position:fixed;inset:0;width:100vw;height:100vh;z-index:45;pointer-events:none\}/);
  assert.match(reh, /if \(parts\.length > 120\)/, 'pırıltı sayısı sınırlı');
  /* yay ekranın içinde: kenar değiştirirken yukarı kavis Acadia'yı ekranın üstünden dışarı taşıyordu */
  assert.match(reh, /if \(0\.25 \* from\.y \+ 0\.5 \* cy \+ 0\.25 \* dest\.y < top\) cy = Math\.max\(from\.y, dest\.y\) \+ lift;/);
  assert.match(reh, /cy = Math\.max\(2 \* top - 0\.5 \* \(from\.y \+ dest\.y\), Math\.min\(2 \* bot - 0\.5 \* \(from\.y \+ dest\.y\), cy\)\);/);
  assert.match(reh, /cx\.lineWidth = pass \? \.6 \+ 1\.4 \* a : 3 \+ 4 \* a;/, 'iz ince: en fazla 2 px çizgi, 7 px hafif parıltı');
});
test('stüdyo canlı sahne: arka plan, süzülme, takınca pırıltı, zar (03.11.2026)', () => {
  const k = read('js/acadia-kit.js'), css = read('css/acadia-kit.css');
  for (const sc of ['sade', 'gece', 'kutuphane', 'kampus']) assert.match(k, new RegExp("\\['" + sc + "', '"), sc);
  assert.match(k, /localStorage\.setItem\('acadex\.acadia\.sahne', scene\)/, 'sahne bu cihazda hatırlanır');
  assert.match(k, /wear = t\.getAttribute\('data-slot'\); render\(\); wear = '';/, 'pırıltı yalnızca takılan an');
  assert.match(k, /draft\.renk = pick\(Object\.keys\(COLORS\)\); \['bas', 'goz', 'boyun'\]\.forEach/);
  assert.match(k, /aria-label="Rastgele kombin"/); assert.match(k, /role="radiogroup" aria-label="Sahne"/);
  const blk = css.slice(css.indexOf('.acd-st-stage{position:relative'), css.indexOf('@keyframes acd-st-float'));
  assert.match(blk, /@media \(prefers-reduced-motion:no-preference\)\{\n  \.acd-st-fly\{animation:acd-st-float/, 'süzülme hareket serbestken');
});
summary();
