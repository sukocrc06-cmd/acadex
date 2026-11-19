/* ==========================================================================
   ACADEX — ACADEX KIDS: CANLI KELİMELER (tests/kids-canli.js), 20.11.2026

   NEDEN VAR: Kelime resimleri sahneye gelip duruyordu. Artık kelimeye özel yoldan gelir
   (otobüs yolda, tren rayda, gemi dalgada, kuş kanat çırparak…) ve durunca da oynar
   (motor titrer, egzoz dumanı, baloncuk, buhar, nota, zzz…). kids/assets/kids-canli.js/.css
   Bu dosya şunları korur:
     - eşlemedeki her kelime gerçek bir kelime (yazım hatası yok), taşıt ve hayvanların hepsi
       kendi giriş yoluyla gelir
     - her giriş ve durunca-hareketinin CSS'i var; parçacık sayıları CSS ile uyumlu
     - resim çizicileri (kids-resim / kids-hayvan) svg'ye hareket sınıfını ekler
     - hareket yalnız İzle sahnesinde, Kelime ustalığı kutularında, Kelimelerim'de ve
       oyunlarda doğru cevapta; alt çubuk simgeleri kıpırdamaz
     - İzle sahnesi uzun girişi kesmez (kn-durgun girişten sonra gelir)
     - hareketi azaltta hiçbir şey oynamaz; paket sırası doğru
   Tarayıcıda (Playwright, 16 örnek kelime) denendi.
   Çalıştırma:  node tests/kids-canli.js
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
const js = read('kids/assets/kids-canli.js'), css = read('kids/assets/kids-canli.css'), anlat = read('kids/assets/kids-anlat.js');

/* gerçek kelime listesi: kids dosyalarını küçük bir pencere taklidiyle yükle */
function yukle() {
  const W = { document: { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() { }, documentElement: { classList: { add() { }, toggle() { } } } }, addEventListener() { }, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() { } }, navigator: {}, console };
  W.window = W; W.self = W; vm.createContext(W);
  for (const f of ['kids-canli.js', 'kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-hayvan.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js', 'kids-temalar3.js']) vm.runInContext(read('kids/assets/' + f), W, { filename: f });
  return W;
}
const W = yukle(), CN = W.KIDS_CANLI, KONU = {};
W.KIDS_VERI.KONU.forEach((k) => { KONU[k.id] = (W.KIDS_KONU.hepsi(k.id) || []).map((o) => o.id); });
const HEPSI = new Set([].concat(...Object.values(KONU)));

test('eşleme: her kelime gerçek; taşıtlar ve hayvanlar kendi yollarıyla gelir', () => {
  assert.ok(HEPSI.size > 400, 'kelime listesi yüklendi: ' + HEPSI.size);
  const yok = Object.keys(CN._T).filter((id) => !HEPSI.has(id));
  assert.equal(yok.join(','), '', 'yazım hatası / olmayan kelime');
  for (const id of KONU.transport) assert.ok(CN.bilgi(id).g, 'taşıt girişsiz: ' + id);
  for (const id of KONU.animals) assert.ok(CN.bilgi(id).g, 'hayvan girişsiz: ' + id);
  assert.equal(JSON.stringify(CN.bilgi('bus')), JSON.stringify({ g: 'yol', o: 'motor', p: 'duman', z: 'yol', s: 1300 }), 'otobüs yolda gelir, durunca motor çalışır');
  assert.equal(CN.bilgi('train').z, 'ray'); assert.equal(CN.bilgi('ship').z, 'deniz');
  assert.equal(CN.bilgi('bird').g, 'kanat'); assert.equal(CN.bilgi('duck').g, 'paytak'); assert.equal(CN.bilgi('frog').g, 'zipla2');
  assert.equal(CN.bilgi('bilinmeyen').o, 'nefes', 'tanımsız kelime de hafifçe süzülür, durmaz');
  assert.equal(CN.sinif('bus'), 'kcn kcn-o-motor');
});

test('CSS: her giriş, her hareket ve her parçacık tanımlı', () => {
  const T = Object.values(CN._T), girisler = new Set(T.map((b) => b.g).filter(Boolean)), hareket = new Set(T.map((b) => b.o)), parca = new Set(T.map((b) => b.p).filter(Boolean)), zemin = new Set(T.map((b) => b.z).filter(Boolean));
  hareket.add('nefes');
  const ESKI = ['yuru', 'yuz'];   /* kids-anlat.css'te zaten var */
  for (const g of girisler) if (!ESKI.includes(g)) assert.match(css, new RegExp('\\.kn-h-' + g + '\\.kn-gir:not\\(\\.kn-durgun\\) \\.kn-resim\\{animation:'), 'giriş ' + g);
  for (const o of hareket) assert.ok(css.includes('.kcn-o-' + o + '{'), 'hareket ' + o);
  for (const p of parca) assert.ok(css.includes('.kcn-p-' + p + ' i'), 'parçacık ' + p);
  for (const z of zemin) assert.ok(css.includes('.kcn-z-' + z + '{'), 'zemin ' + z);
  /* süre: giriş animasyonu js'deki s'den uzun olmasın (yoksa kn-durgun keser) */
  for (const id of Object.keys(CN._T)) { const b = CN.bilgi(id); if (!b.g || ESKI.includes(b.g)) continue; const m = new RegExp('\\.kn-h-' + b.g + '\\.kn-gir:not\\(\\.kn-durgun\\) \\.kn-resim\\{animation:\\w+ ([\\d.]+)s').exec(css); assert.ok(m && +m[1] * 1000 <= b.s, id + ' giriş ' + (m && m[1]) + 's > ' + b.s + 'ms'); }
});

test('resim çizicileri hareket sınıfını ekler; hareket yalnız kelime yerlerinde', () => {
  assert.match(W.KIDS_RESIM.ciz('bus'), /^<svg class="kc kc-resim kcn kcn-o-motor /);
  assert.match(read('kids/assets/kids-hayvan.js'), /W\.KIDS_CANLI \? W\.KIDS_CANLI\.sinif\(id\) \+ ' ' : ''/);
  assert.match(css, /:is\(\.kn-resim,\.ka-usta-liste,\.kp-kelimeler,\.kp-res,\.ko-dogru\) \.kcn-o-motor\{animation:/);
  assert.doesNotMatch(css, /\.ka-dock[^{]*\.kcn/, 'alt çubuk simgeleri kıpırdamaz');
  assert.match(css, /animation-delay:calc\(var\(--i,0\) \* -\.37s\)/, 'kutular aynı anda kıpırdamaz');
});

test('İzle sahnesi: giriş yolu, zemin, parçacık; uzun giriş kesilmez', () => {
  assert.match(anlat, /var cn = W\.KIDS_CANLI \? W\.KIDS_CANLI\.bilgi\(r\.id\) : null, gir = \(cn && cn\.g\) \|\| hareket;/);
  assert.match(anlat, /sk\.className = sk\.className\.replace\(\/\\bkn-h-\\S\+\/, 'kn-h-' \+ gir\);/);
  assert.match(anlat, /W\.KIDS_CANLI\.zeminHtml\(cn\) : ''\) \+ '<div class="kn-resim"/);
  assert.match(anlat, /bekle\(azHareket\(\) \? 100 : Math\.max\(900, sahneCiz\.sure \|\| 0\)\)/);
  assert.equal(CN.ekHtml(CN.bilgi('drum')).match(/<i /g).length, 3, 'nota');
  assert.equal(CN.zeminHtml(CN.bilgi('dog')), '', 'köpeğin yolu yok');
  assert.match(CN.zeminHtml(CN.bilgi('bus')), /kcn-z-yol/);
});

test('hareketi azalt: hiçbiri oynamaz; paket sırası', () => {
  const hareketli = css.split('@media (prefers-reduced-motion:no-preference)');
  assert.ok(hareketli.length >= 3, 'durunca hareket ve parçacıklar yalnız hareket serbestken');
  const disari = hareketli[0];
  assert.doesNotMatch(disari.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, ''), /\.kcn-o-[a-z0-9]+\{animation/, 'durunca-hareket media dışında yok');
  const b = read('kids/assets/birlestir.js'), html = read('kids/index.html');
  assert.ok(b.indexOf("'kids-canli.js'") < b.indexOf("'kids-resim.js'"), 'çizicilerden önce yüklenir');
  assert.ok(b.includes("'kids-canli.css'"));
  assert.ok(html.includes(js.trim().slice(0, 1500)), 'eski index: node kids/assets/birlestir.js');
  assert.doesNotMatch(js + css, /https?:\/\/(?!www\.w3\.org)/);
});

/* tarama 20.11.2026: aynı adlı @keyframes'ler birbirini eziyordu (Colours'ta fırça boyama girişi,
   Shapes'te dönerek giriş, Acadia'nın kutlama zıplaması, ilerleme halkası nabzı, Transport hikâyesinde
   "yol" çalışmıyordu). Kids paketindeki bütün CSS'te her animasyon adı tek olmalı. */
test('kids CSS: her @keyframes adı tek (biri ötekini ezmesin)', () => {
  const b = read('kids/assets/birlestir.js'), dosyalar = [...b.matchAll(/'([\w-]+\.css)'/g)].map((m) => m[1]);
  assert.ok(dosyalar.length >= 10);
  const gor = {}, cift = [];
  for (const f of dosyalar) for (const m of read('kids/assets/' + f).matchAll(/@keyframes\s+([\w-]+)/g)) { if (gor[m[1]]) cift.push(m[1] + ' (' + gor[m[1]] + ' + ' + f + ')'); else gor[m[1]] = f; }
  assert.equal(cift.join(', '), '');
});

test('eşyayla oyun ve karaoke harfler', () => {
  assert.match(css, /\.kn-hk-top \.kn-e-top\{animation:knTop 1\.1s[^}]*kcnTopOyun 2\.6s 1\.1s ease-in-out infinite\}/, 'top gelir, sonra oyun döngüsü');
  assert.match(css, /\.kn-sahne\.kn-hk-top \.kn-resim\{animation:kcnTopHayvan/, 'hayvan pati atar, hoplar');
  assert.match(css, /\.kn-hk-top \.kn-hikaye\{z-index:3\}/, 'top hayvanın önünde');
  assert.match(css, /\.kn-kelime span\.kn-k-on\{scale:1\.2;translate:0 -10%/, 'transform değil: harf animasyonu ezmez');
  assert.match(anlat, /await karaoke\(soyle\(r\.en \+ '!'\)\)/, 'senin sıran: harfler yanar');
  assert.match(anlat, /return karaoke\(SES\.soyle\(rs\[i\]\.en, 'en'\)\)/, 'dokununca da');
  assert.match(anlat, /if \(!yazi \|\| azHareket\(\)\) return p;/, 'yazısız yaşta ve hareketi azaltta yok');
  assert.match(anlat, /kTim\.forEach\(clearTimeout\); if \(W\.KIDS_DINLE\) W\.KIDS_DINLE\.durdur\(\); SES\.sus\(\);/, 'sahne kapanınca zamanlayıcı ve mikrofon kalmaz');
  assert.match(css, /\.kn-kelime:empty\{display:none\}/);
});

summary();
