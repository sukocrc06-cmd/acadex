/* ==========================================================================
   ACADEX — ACADEX KIDS: KAYDIRMA ŞÖLENİ VE "OYUN DÜNYANA GİDİYORSUN" UÇUŞU (tests/kids-ucus.js), 15.11.2026

   NEDEN VAR: Tanıtım sayfasında gökyüzü sabahtan geceye döner (paralaks bulut, güneş, ay,
   yıldız), kartlar zıplayarak, başlık harfleri hoplayarak gelir, hero'da adalar açılır ve balonlu
   bir çocuk yükselir (kids-scroll.js/.css). Çocuk giriş yapınca renkli evrenden roketle oyun
   dünyasına uçar (kids-ucus.js/.css). Bu dosya şunları korur:
     - uçuş yalnız girişte (şifre ya da "Kim oynuyor?"), haritaya her dönüşte değil
     - aynı gün aynı çocuk için kısa hâl; dokununca atlanır; sessiz; Acadia karşılaması uçuştan sonra
     - hareketi azalt: kaydırma ve uçuş animasyonsuz (yalnız solma), içerik baştan görünür
     - gece bölümlerinde başlıklar açık renk; çizimler özgün, dış kaynak yok
   Tarayıcıda (Playwright, masaüstü + telefon + hareketi azalt) denendi.
   Çalıştırma:  node tests/kids-ucus.js
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

test('paket: kaydırma ve uçuş dosyaları index.html içinde', () => {
  const b = read('kids/assets/birlestir.js'), html = read('kids/index.html');
  for (const f of ['kids-scroll.css', 'kids-ucus.css', 'kids-scroll.js', 'kids-ucus.js']) assert.ok(b.includes("'" + f + "'"), f);
  assert.ok(b.indexOf("'kids-scroll.js'") > b.indexOf("'kids-landing.js'"), 'adalar ve konular kurulduktan sonra');
  for (const f of ['kids-scroll.js', 'kids-ucus.js', 'kids-scroll.css', 'kids-ucus.css']) assert.ok(html.includes(read('kids/assets/' + f).trim().slice(0, 2500)), f + ' eski: node kids/assets/birlestir.js');
  for (const f of ['kids-scroll.js', 'kids-ucus.js', 'kids-scroll.css', 'kids-ucus.css']) assert.doesNotMatch(read('kids/assets/' + f), /https?:\/\/(?!www\.w3\.org)/, f + ' dış kaynak yok');
});

test('gökyüzü: durakların hepsi sayfada, gece başlıkları açık renk, paralaks hareketi azaltta yok', () => {
  const j = read('kids/assets/kids-scroll.js'), s = read('kids/assets/sayfa.html'), css = read('kids/assets/kids-scroll.css');
  for (const m of j.matchAll(/\['(#[\w-]+|\.[\w-]+)', '#[0-9A-F]{6}'\]/g)) assert.ok(m[1][0] === '#' ? s.includes('id="' + m[1].slice(1) + '"') : s.includes(m[1].slice(1)), m[1] + ' sayfada yok');
  assert.match(j, /\[null, '#23304D'\]/, 'en alt renk alt bilgi şeridiyle aynı');
  assert.match(css, /\.kl-gok #fiyat>h2,\.kl-gok #sss>h2\{color:var\(--krem\)/);
  assert.match(j, /function gokCiz\(\) \{\s*if \(SAKIN \|\| !kat\) return;/);
  assert.match(j, /function ziplaKur\(\) \{\s*if \(SAKIN \|\| !\('IntersectionObserver' in W\)\) return;/, 'hareketi azaltta kartlar baştan görünür');
  assert.match(css, /\.kl-zip-hazir \.kl-zip\{opacity:0;translate:/, 'gizleme yalnız betik hazırsa ve transform yerine translate (eğik tablet bozulmaz)');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{\s*\.kl-gok-kat>span/);
});

test('başlıklar harf harf: metin aynı kalır, kelimeler bölünmez', () => {
  const j = read('kids/assets/kids-scroll.js');
  /* minik DOM: harfle() yalnız childNodes, createElement, createTextNode, createDocumentFragment kullanır */
  function el(tag) { return { tagName: tag, nodeType: 1, childNodes: [], style: { setProperty() {} }, dataset: {}, className: '', appendChild(c) { if (c.frag) { c.childNodes.forEach((x) => this.childNodes.push(x)); } else this.childNodes.push(c); return c; }, replaceChild(n, o) { const i = this.childNodes.indexOf(o); this.childNodes.splice(i, 1, ...(n.frag ? n.childNodes : [n])); }, set textContent(v) { this.childNodes = [txt(v)]; } }; }
  function txt(v) { return { nodeType: 3, nodeValue: v }; }
  const D = { readyState: 'loading', addEventListener() {}, createElement: el, createTextNode: txt, createDocumentFragment() { const f = el('#f'); f.frag = true; return f; } };
  const c = { document: D, matchMedia: () => ({ matches: false }), KIDS_CIZ: {} }; c.window = c; vm.createContext(c); vm.runInContext(j, c);
  const h = el('H2'); h.childNodes = [txt('Okul ve '), el('BR'), txt('veli için')];
  c.KIDS_SCROLL.harfle(h);
  const metin = (n) => n.nodeType === 3 ? n.nodeValue : n.tagName === 'BR' ? '\n' : n.childNodes.map(metin).join('');
  assert.equal(metin(h), 'Okul ve \nveli için');
  const kel = h.childNodes.filter((n) => n.className === 'kl-hk');
  assert.equal(kel.length, 4); assert.ok(kel.every((k) => k.childNodes.every((x) => x.className === 'kl-hh')));
  c.KIDS_SCROLL.harfle(h); assert.equal(h.childNodes.filter((n) => n.className === 'kl-hk').length, 4, 'iki kez bölünmez');
  assert.doesNotMatch(c.KIDS_SCROLL.cocuk(), /<image|href=/, 'çocuk çizimi özgün, dış resim yok');
});

test('uçuş: yalnız girişte; kısa hâl aynı gün; sessiz; Acadia sonra konuşur', () => {
  const a = read('kids/assets/kids-app.js');
  assert.equal((a.match(/S\.ucus = true/g) || []).length, 4, 'örnek şifre, okul şifresi, "Kim oynuyor?" örnek + oturum');
  assert.match(a, /var ucus = S\.ucus && W\.KIDS_UCUS; S\.ucus = false;/, 'haritaya geri dönüşte oynamaz');
  assert.match(a, /W\.KIDS_UCUS\.oynat\(\{ ad: S\.ogr\[0\], hayvan: S\.ogr\[1\], renk: S\.ogr\[4\], anahtar: [\s\S]*?\}\)\.then\(karsila\); else karsila\(\);/);
  const u = read('kids/assets/kids-ucus.js');
  assert.doesNotMatch(u, /SES\.|KIDS_SES|speechSynthesis/, 'sessiz');
  assert.match(u, /sure = SAKIN \? 900 : kisa \? 1100 : 3200/);
  assert.match(u, /k\.addEventListener\('pointerdown', function \(\) \{ bitir\(true\); \}\)/, 'dokununca atlanır');
  const store = {}, c = { document: { body: null }, matchMedia: () => ({ matches: false }), localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } }, KIDS_CIZ: {} };
  c.window = c; vm.createContext(c); vm.runInContext(u, c);
  const U = c.KIDS_UCUS;
  assert.equal(U.kisaMi('A|1'), false); assert.equal(U.kisaMi('A|1'), true, 'aynı gün ikinci giriş kısa'); assert.equal(U.kisaMi('A|2'), false, 'kardeşin ilk girişi tam');
  store['kids.ucus'] = JSON.stringify({ 'A|1': '2020-1-1' }); assert.equal(U.kisaMi('A|1'), false, 'ertesi gün yine tam'); assert.ok(!JSON.parse(store['kids.ucus'])['2020-1-1']);
  assert.equal(U.ilkAd('Ada K.'), 'Ada'); assert.equal(U.ilkAd('Göktürk'), 'Göktürk');
  return U.oynat({ ad: 'Ali' }).then((r) => assert.equal(r, undefined, 'sayfa yoksa beklemeden biter'));
});

test('uçuş görünümü: yüz pencerede, hareketi azaltta yalnız solma', () => {
  const css = read('kids/assets/kids-ucus.css'), u = read('kids/assets/kids-ucus.js');
  assert.match(u, /<span class="ku-yuz">' \+ C\.avatar\(o\.hayvan, o\.renk\) \+ '<\/span>/, 'roketin penceresinde çocuğun kendi yüzü');
  assert.match(u, /Oyun dünyana gidiyorsun/); assert.match(u, /role="status"/);
  assert.match(css, /\.ku-sakin \.ku-nebula,\.ku-sakin \.ku-yildizlar,\.ku-sakin \.ku-bulutlar,\.ku-sakin \.ku-gokkusagi\{display:none\}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{\.ku \*\{animation:none!important\}\}/);
  assert.match(css, /\.ku\{position:fixed;inset:0;z-index:300/);
});

summary();
