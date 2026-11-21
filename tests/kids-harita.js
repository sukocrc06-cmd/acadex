/* ==========================================================================
   ACADEX — ACADEX KIDS: ÇOCUĞUN HARİTASI, "OYUN ODASI" ÇUBUĞU (tests/kids-harita.js), 15.11.2026

   NEDEN VAR: Haritadaki etkinlikler (Kitaplık, Resim yap, Kelimelerim, Dolabım, Albüm) üst
   çubukta küçük yuvarlak düğmelerdi. Artık altta sabit, büyük resimli bir "oyun odası" çubuğu
   var; Evcil hayvanım / Benim günüm / Uyku vakti "Daha fazlası" penceresinde. Üst çubukta yalnız
   yüz, yıldız, ses ve veli kalır. Adalar sadeleşti: büyük ada, adı ve ilerleme halkası (madalya,
   kelime, paket ayrıntısı adaya dokununca açılan pencerede). Dokununca Acadia düğmenin adını
   söyler; dolaba yeni giysi ya da albüme yeni çıkartma gelince düğmede "yeni" yazar.
   Tarayıcıda (Playwright, masaüstü + telefon) denendi.
   Çalıştırma:  node tests/kids-harita.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const app = read('kids/assets/kids-app.js'), css = read('kids/assets/kids.css');
const fn = (ad) => { const i = app.indexOf('  function ' + ad + '('); assert.ok(i > -1, ad); const j = app.indexOf('\n  function ', i + 10); return app.slice(i, j); };

test('üst çubuk: yalnız yüz, yıldız, ses ve veli', () => {
  const u = fn('ustCubuk');
  for (const a of ['data-kim', 'ka-sayac', 'data-ses', 'data-veli']) assert.ok(u.includes(a), a);
  for (const a of ['data-kitap', 'data-sozluk', 'data-sahnekur', 'data-album', 'data-dolap']) assert.ok(!u.includes(a), a + ' artık altta');
});

test('oyun odası: yedi büyük düğme, hepsi bağlı, dokununca adı söylenir', () => {
  const m = app.match(/var DOK = \[([\s\S]*?)\n  \];/); assert.ok(m);
  const kler = [...m[1].matchAll(/k: '(\w+)'/g)].map((x) => x[1]);
  assert.deepEqual(kler, ['adalar', 'kitap', 'sahnekur', 'sozluk', 'dolap', 'album', 'daha']);
  const ck = fn('cubukKur');
  for (const k of kler) assert.ok(ck.includes("'[data-" + k + "]'"), k + ' bağlı değil');
  assert.match(ck, /if \(d && d\.s\) SES\.soyle\(d\.s, 'tr'\)/);
  const tr = read('kids/ses/katalog.js');
  for (const s of m[1].matchAll(/s: '([^']+)'/g)) assert.ok(tr.includes("'" + s[1] + "'"), s[1] + ' seslendirme kataloğunda yok');
  /* kendi karşılaması olanlar ikinci kez konuşmaz */
  for (const k of ['kitap', 'sahnekur', 'dolap']) assert.doesNotMatch(m[1], new RegExp("k: '" + k + "'[^}]*\\bs: '"), k);
  assert.match(fn('dockHtml'), /<nav class="ka-dock" aria-label="Oyun odası">/);
  assert.match(fn('dockHtml'), /ka-dock-bosluk/, 'harita içeriği çubuğun altında kalmaz');
});

test('köşeler "Daha fazlası" penceresinde; haritada şerit yok', () => {
  assert.ok(!fn('panel').includes('seritHtml'), 'şerit haritadan kalktı');
  assert.match(fn('cubukKur'), /W\.KIDS_PANEL3\.seritHtml\(ilerleme\(\)\), 'ka-dahak'\)/);
  assert.match(fn('cubukKur'), /k\.kapat\(\); dur\(\); var r = W\.KIDS_PANEL3\.ac\(/);
});

test('"yeni" rozeti: ilk girişte sessiz, dolap ve albüm açılınca kalkar', () => {
  assert.match(fn('panel'), /if \(!il\.gorulen\) il\.gorulen = yeniSay\(il\);/, 'eski kazanımlar boş yere "yeni" göstermez');
  assert.match(fn('dolap'), /gordum\(il, 'dolap'\)/);
  assert.match(fn('album'), /gordum\(il, 'album'\)/);
  assert.match(fn('yeniSay'), /tk \? !!\(il\.bitti \|\| \{\}\)\[g\.tema\] : top >= g\.yildiz/, 'dolaptaki açılma kuralıyla aynı');
});

test('sade ada: halka var; madalya, kelime ve paket ayrıntısı kartta yok', () => {
  const p = fn('panel');
  assert.match(p, /halka\(n, OD\.konuMax\(k\.id\), k\.renk\)/);
  assert.ok(!p.includes('ka-ada-usta') && !p.includes('ka-madalyalar'), 'ayrıntı dokununca açılan pencerede');
  assert.match(p, /' yıldız' \+ \(bitti \? ', bitti' : ''\)/, 'ekran okuyucu yıldızı duyar');
  assert.match(fn('adaSec'), /ka-usta-liste/, 'ayrıntılar adanın penceresinde duruyor');
});

test('görünüm: telefonda kaydırılır, hareketi azaltta animasyon yok, yazdırmada gizli', () => {
  assert.match(css, /\.ka-dock\{position:fixed;left:0;right:0;bottom:0;z-index:25/);
  assert.match(css, /@media \(max-width:720px\)\{[\s\S]*?\.ka-dock-ic\{[^}]*overflow-x:auto/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.ka-dock-yeni,\.ka-halka-tam\{animation:none\}/);
  assert.match(css, /@media print\{\.ka-dock\{display:none\}\}/);
  assert.match(css, /\.ka-halka>svg\{/, 'halkanın içindeki yıldız simgesi etkilenmez');
});

test('paket: index.html yeniden üretildi, önbellek sürümü yeni', () => {
  const html = read('kids/index.html');
  assert.ok(html.includes('function dockHtml(il)') && html.includes('.ka-dock-bosluk{'), 'node kids/assets/birlestir.js');
  assert.match(read('kids/sw.js'), /acadex-kids-2026-11-21b/);
});

summary();
