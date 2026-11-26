/* ==========================================================================
   tests/kids-maskot.js · 26.11.2026 Kids: kalkış, canlı harita, maskot, ekran süresi, veli raporu, sınıf nabzı
     - SES.fxDinle: efekt dinleyicisi çağrılır, aboneliği bırakılınca çağrılmaz, hata akışı bozmaz
     - ekran süresi: gün başına çocuk başına sayılır; sınır + büyüklerin verdiği ek süre; 0 = sınırsız
     - sınıf nabzı: destek nedenleri (3+ yanlış · 5+ gün ara · ortalamanın yarısı) ve örnek süreler
     - 3B: konudan dönüşte kalkış, süzülen/zıplayan gezegen, uydu, ipucu; modül adresi sürümlü
     - maskot sınıfları kms- öneki (masalın km- sınıflarıyla çakışmaz), paket ve ses kataloğu güncel
   Çalıştırma:  node tests/kids-maskot.js
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
const app = read('kids/assets/kids-app.js'), mk = read('kids/assets/kids-maskot.js'), mkc = read('kids/assets/kids-maskot.css');
const ogr = read('kids/assets/kids-ogretmen.js'), src3 = read('kids/assets/kids-uzay3d.src.js'), uz = read('kids/assets/kids-uzay.js');
/* kaynaktan iki boşlukla girintili bir fonksiyonu kes (kapanış: satır başında "  }") */
function fn(kaynak, ad) { const i = kaynak.indexOf('  function ' + ad + '('); assert.ok(i > -1, ad + ' yok'); const j = kaynak.indexOf('\n  }\n', i); const tek = kaynak.indexOf('\n', i); return /\}\s*$/.test(kaynak.slice(i, tek)) && kaynak.slice(i, tek).split('{').length === kaynak.slice(i, tek).split('}').length ? kaynak.slice(i, tek) : kaynak.slice(i, j + 4); }

test('SES.fxDinle: dinleyici her efektte çağrılır, bırakılınca susar, hata zinciri bozmaz', () => {
  const c = { console, location: { hostname: 'localhost', pathname: '/kids/', search: '', hash: '' }, setTimeout, clearTimeout, setInterval, clearInterval, Promise, navigator: {}, document: { addEventListener() {}, createElement: () => ({}) }, localStorage: { getItem: () => null, setItem() {} }, fetch: () => Promise.reject(new Error('yok')) };
  c.addEventListener = () => {}; c.window = c; vm.createContext(c); vm.runInContext(read('kids/assets/kids-ses.js'), c);
  const S = c.KIDS_SES, gelen = [];
  S.fxDinle(() => { throw new Error('bozuk dinleyici'); });
  const birak = S.fxDinle((ad, x) => gelen.push(ad + (x == null ? '' : ':' + x)));
  S.fx('dogru'); S.fx('seri', 3); S.fx('bilinmeyen');
  assert.deepEqual(gelen, ['dogru', 'seri:3', 'bilinmeyen'], 'ses kapalı/bilinmeyen efekt de bildirilir (görsel tepki sese bağlı değil)');
  birak(); S.fx('yanlis');
  assert.equal(gelen.length, 3, 'abonelik bırakıldı');
});

test('ekran süresi: çocuk ve gün başına; sınır + ek süre; 0 = sınırsız', () => {
  const kod = ['gunNo', 'sureLimit', 'sureSahip', 'ekSn', 'bugunSn', 'sureDoldu'].map((a) => fn(app, a)).join('\n');
  const store = {}, al = (k, d) => (k in store ? store[k] : d), V = { gunAnahtar: () => '2026-11-26' };
  const S = { okul: { kod: 'K' }, sinif: { id: 's' }, ogr: ['Ada', 'kedi', 'o1'] };
  const f = new Function('al', 'V', 'S', 'ilAnahtar', 'sureBirik', kod + '; return { sureDoldu, bugunSn, gunNo };');
  const ilA = () => 'il.' + S.ogr[2];
  let H = f(al, V, S, ilA, 0);
  store['il.o1'] = { sure: { '2026-11-26': 20 * 60, '2026-11-25': 9999 } };
  assert.equal(H.bugunSn(), 1200, 'yalnız bugün sayılır');
  assert.equal(H.sureDoldu(), false, 'sınır yok (0) → hiç dolmaz');
  store.sure = 20; assert.equal(H.sureDoldu(), true, '20 dk sınır, 20 dk oynadı');
  store.sure = 30; assert.equal(H.sureDoldu(), false);
  store.sure = 15; store.sureEk = { gun: '2026-11-26', kim: 'il.o1', sn: 600 }; assert.equal(H.sureDoldu(), false, '+10 dk verildi');
  store.sureEk = { gun: '2026-11-25', kim: 'il.o1', sn: 600 }; assert.equal(H.sureDoldu(), true, 'dünkü ek süre bugün geçmez');
  store.sureEk = { gun: '2026-11-26', kim: 'il.baska', sn: 600 }; assert.equal(H.sureDoldu(), true, 'kardeşe verilen ek süre bu çocuğa geçmez');
  S.ogr = ['Can', 'ayi', 'o2']; assert.equal(H.sureDoldu(), false, 'kardeşin süresi ayrı sayılır');
  H = f(al, V, S, ilA, 15 * 60); assert.equal(H.sureDoldu(), true, 'henüz yazılmamış birikim de sayılır');
  assert.equal(H.gunNo(new Date(2026, 10, 26, 23, 50)), H.gunNo(new Date(2026, 10, 26, 0, 5)), 'gün numarası yerel güne göre');
});

test('ekran süresi akışı: sayaç, 2 dk uyarısı, gece, büyükler kapısı, kardeş', () => {
  assert.match(app, /if \(g !== 'konu' && Date\.now\(\) - sonEtkin > 120000\) return;/, 'konu dışında boşta beklerken sayılmaz');
  assert.match(app, /var ks = Object\.keys\(il\.sure\)\.sort\(\); while \(ks\.length > 35\)/, 'en çok 35 gün saklanır (kayıt 64 KB sınırının altında)');
  assert.match(app, /if \(sureDoldu\(\)\) \{ uyku\(\); return; \}/, 'süre dolunca yeni durak açılmaz');
  assert.match(app, /veliKapisi\(function \(\) \{\s*var v = o\.querySelector\('\[data-uv\]'\)/, 'devam yalnız büyüklerin işlemiyle');
  assert.match(app, /data-uek="600">\+10 dakika/); assert.match(app, /data-ukim>Başka çocuk oynasın/);
  assert.match(app, /function kimOynuyor\(duzen\) \{\s*sureYaz\(\);/, 'çocuk değişince önceki çocuğun süresi ona yazılır');
  assert.match(app, /D\.body\.classList\.add\('ka-gece'\)/); assert.match(mkc, /body\.ka-gece \.kd-komut,body\.ka-gece \.kms\{display:none\}/, 'gece açıkken mikrofon ve maskot gizli');
  assert.match(app, /if \(ilkKarsilama && !uykuAcik && app\.dataset\.gorunum === 'harita'\)/, 'gece açıkken karşılama konuşmaz');
  assert.match(app, /data-sure>' \+ \[0, 15, 20, 30, 45, 60\]/, 'veli ayarı: sınırsız / 15-60 dk');
});

test('veli raporu: günlük süre grafiği, tanışılan kelimeler, öneri; kelime ilk günü kaydedilir', () => {
  assert.match(app, /il\.kelGun = il\.kelGun \|\| \{\}; if \(!il\.kelGun\[id\]\) il\.kelGun\[id\] = gunNo\(\);/);
  assert.match(app, /class="ka-veli-sure"/); assert.match(app, /class="ka-vs-sinir"/); assert.match(app, /Bu hafta tanıştığı kelimeler/); assert.match(app, /Sıradaki önerimiz/);
  assert.match(app, /\+ topDk \+ '<\/b><span>dakika oynadı<\/span>/);
  assert.match(mkc, /\.ka-veli \.ka-veli-ozet\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}/);
});

test('sınıf nabzı: destek nedenleri doğru; süre sunucu kaydından temizlenerek okunur', () => {
  const kod = ['enZor', 'yildizSay', 'renkBul', 'konuZor', 'gunFark', 'destekNedenleri', 'haftaDk'].map((a) => fn(ogr, a)).join('\n');
  const V = { ogeBul: (id) => ({ blue: { en: 'blue' } })[id] || null, gunAnahtar: (d) => d.toISOString().slice(0, 10) };
  const W = { KIDS_KONU: { al: () => ({}), hepsi: () => [{ id: 'blue' }, { id: 'red' }] } };
  const N = new Function('V', 'W', kod + '; return { destekNedenleri, haftaDk };')(V, W);
  const bugun = Date.now(), gun = (n) => bugun - n * 864e5;
  const t = (k, ort) => N.destekNedenleri(Object.assign({ zor: {}, yildiz: {}, son: bugun }, k), 'colours', ort).map((r) => r.t);
  assert.deepEqual(t({ zor: { blue: 3 } }, 0), ['kelime']);
  assert.deepEqual(t({ zor: { blue: 2, dog: 9 } }, 0), [], 'başka konunun kelimesi sayılmaz, 2 yanlış destek değil');
  assert.deepEqual(t({ son: gun(6) }, 0), ['ara']); assert.deepEqual(t({ son: gun(4) }, 0), []);
  assert.deepEqual(t({ son: 0 }, 0), [], 'hiç girmeyen zaten "Henüz girmeyenler"de');
  assert.deepEqual(t({ yildiz: { colours: { balon: 2 } } }, 6), ['geri']); assert.deepEqual(t({ yildiz: { colours: { balon: 4 } } }, 6), []);
  assert.deepEqual(t({ yildiz: { colours: { balon: 1 } } }, 2), [], 'ortalama düşükken kimse geride sayılmaz');
  const s = {}; s[V.gunAnahtar(new Date())] = 600; s[V.gunAnahtar(new Date(gun(3)))] = 300; s[V.gunAnahtar(new Date(gun(9)))] = 9000;
  assert.equal(N.haftaDk({ sure: s }), 15, 'yalnız son 7 gün');
  assert.match(ogr, /gunler: sayiHarita\(u\.gunler\), sure: sayiHarita\(u\.sure\),/, 'sunucudan gelen süre sayıya zorlanır');
  assert.match(ogr, /nabiz\(sinif, kz, o\) \+/); assert.match(ogr, /<th scope="col">Bu hafta<\/th>/);
});

test('3B: kalkış, canlı harita, uydu, ipucu; adlar süzülen gezegeni izler; modül sürümlü', () => {
  assert.match(src3, /const donusI = o\.donus \? idx\(o\.donus\) : -1;/);
  assert.match(src3, /cikis = \{ i: donusI, t0: performance\.now\(\) \+ 60, sure: 1700/);
  assert.match(src3, /if \(donusI >= 0 && !sakin\)/, 'hareketi azaltta kalkış yok');
  assert.match(src3, /if \(cikis\) cikisBitir\(\);/, 'kalkış sürerken dokunulursa hemen biter, uçuş başlar');
  assert.match(src3, /function uyduKur\(\)/); assert.match(src3, /function zipla\(i\) \{ if \(i >= 0 && i < N && !sakin\)/);
  assert.match(src3, /v\.copy\(G2\[i\]\.g\.position\)\.project\(kam\)/);
  assert.match(src3, /salinG \+= \(\(ucus \|\| dalis \|\| cikis \|\| isaret\.size \? 0 : 1\) - salinG\)/, 'sürüklerken ve uçuşta kamera salınmaz');
  assert.match(src3, /ipucu: \(kid\) => \{/);
  const mjs = read('kids/assets/kids-uzay3d.mjs');
  assert.ok(mjs.includes('kalkiyor') && mjs.includes('ipucu'), 'mjs yeniden üretildi (npx esbuild …)');
  assert.match(uz, /kids-uzay3d\.mjs\?v=\d{8}/); assert.match(read('kids/sw.js'), /kids-uzay3d\.mjs\?v=\d{8}/);
  assert.match(uz, /donus: o\.donus \|\| null/); assert.match(app, /var donusK = app\.dataset\.gorunum === 'konu' && S\.konu \? S\.konu : null;/);
  assert.match(app, /if \(W\.KIDS_UZAY && W\.KIDS_UZAY\.aktif\(\)\) return atmosferCikis\(V\.konuBul\(kid\)\);/);
  assert.match(uz, /Date\.now\(\) - b\.t > 350 \|\| Math\.hypot\(e\.clientX - b\.x, e\.clientY - b\.y\) > 8/, 'sürükleme yıldız tozu saçmaz');
});

test('maskot: tepkiler, ipucu sınırları, kms- öneki, paket', () => {
  assert.match(mk, /if \(ad === 'dogru'\)/); assert.match(mk, /else if \(ad === 'yanlis'\)/); assert.match(mk, /ad === 'seri' && \(x \|\| 0\) >= 3/);
  assert.match(mk, /if \(!el \|\| !gorunur\(dn\) \|\| ipucuSay >= AYAR\.konuEnCok/, 'yönergesiz durakta (izle/şarkı) ipucu yok; en çok 2');
  assert.match(mk, /haritaSay >= AYAR\.haritaEnCok/);
  assert.match(mk, /el\.setAttribute\('aria-hidden', 'true'\)/); assert.match(mkc, /\.kms\{position:fixed;[^}]*pointer-events:none/);
  assert.doesNotMatch(mk + mkc, /\bkm-|\.km\b|'km'/, 'masalın km- sınıflarıyla çakışmaz');
  const b = read('kids/assets/birlestir.js'); assert.match(b, /'kids-maskot\.css'/); assert.ok(b.indexOf("'kids-maskot.js'") > b.indexOf("'kids-app.js'"));
  const html = read('kids/index.html'); assert.ok(html.includes('/* ---- kids-maskot.js ---- */') && html.includes('.kms-balon{'), 'node kids/assets/birlestir.js');
  const kat = read('kids/ses/katalog.js'); assert.ok(kat.includes('Bugünlük bu kadar! Yarın yine görüşürüz.') && kat.includes('İki dakika kaldı. Oyununu bitirebilirsin.'));
});

summary();
