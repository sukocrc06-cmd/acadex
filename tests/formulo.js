/* ==========================================================================
   ACADEX — FORMULO (tests/formulo.js)

   NEDEN VAR (08.11.2026): Formulo, mühendislik ortak derslerinin formül
   atölyesi; Acadingo gibi panelin dışında ayrı bir yer (formulo/).
     - formulo/index.html <html class="kapi"> ile görünmez başlar; kapı
       (formulo/assets/kapi.js) yalnız oturumu açık ve erişimi olan hesapları açar,
       kilit kartı ../login.html?sonra=formulo'ya götürür; auth.js oraya döner.
     - Profesör Acadia Acadex'in kendi karakteridir; platformda insan öğretmen,
       sınıf, ödev ya da "öğretmene ilet" yok (tests/sinav-kaydi-koruma.js ile aynı ilke).
     - Masada (dashboard.html) "günün formülü" kartı Acadingo kartından sonra,
       saatlerden önce; bağlantılar data-fok-kok ile formulo/ altına gider.
     - Landing'de #formulo kaydırma sahnesi "Her derse uygun teknik" (#akis) ile
       MedLab arasında; site rehberi bu bölümde kenara çekilir.
     - Soru üreticileri her derste çalışır: sayısal cevap sonlu, şıklı soruda
       doğru şık listede.
   Tarayıcı ucu (390/820/1440, tüm formüllerin anlatımı, landing adımları)
   scratchpad Playwright ile denendi.
   Calistirma:  node tests/formulo.js
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

test('formulo/index.html: kapı önce, noindex, Acadia ortak kitten, Acadex\'e dönüş', () => {
  const h = read('formulo/index.html');
  assert.match(h, /<html lang="tr" class="kapi">/);
  assert.match(h, /<meta name="robots" content="noindex">/);
  const sira = ['../js/supabase-config.js', '../js/acadex-erisim.js', 'assets/kapi.js', 'assets/formulo-veri.js', 'assets/formulo-veri-ek.js', '../js/acadia-kit.js', 'assets/formulo.js'].map((x) => h.indexOf('<script src="' + x + '">'));
  sira.forEach((v, i) => { assert.ok(v > 0, 'betik yok: ' + i); if (i) assert.ok(v > sira[i - 1], 'betik sırası ' + i); });
  assert.match(h, /<link rel="stylesheet" href="\.\.\/css\/acadia-kit\.css">/);
  assert.match(h, /<a class="fo-acadex" href="\.\.\/dashboard\.html">/);
  assert.doesNotMatch(h, /register|fiyat/i);
  assert.ok(!fs.existsSync(path.join(ROOT, 'formulo/assets/acadia-kit.js')), 'Acadia kitinin kopyası yok, tek kaynak js/acadia-kit.js');
});

test('kapı: kilit kartı login.html?sonra=formulo, auth.js oraya bir kez döner', async () => {
  const k = read('formulo/assets/kapi.js');
  assert.match(k, /href="\.\.\/login\.html\?sonra=formulo"/);
  assert.doesNotMatch(k, /sonra=ingilizce|Acadingo şu an/);
  assert.match(k, /function ac\(\) \{[^\n]*iz\(true\);/);
  const a = read('js/auth.js'), i = a.indexOf('const SONRA_HEDEF'), j = a.indexOf('/* GERI TUSU');
  assert.ok(i > 0 && j > i);
  const hedef = (arama) => {
    const depo = {};
    const ctx = { window: { location: { search: arama }, acadexAccess: { check: async () => ({ ok: true }) } }, sessionStorage: { getItem: (x) => (x in depo ? depo[x] : null), setItem: (x, v) => { depo[x] = String(v); }, removeItem: (x) => { delete depo[x]; } }, supabaseClient: { auth: { signOut: async () => {} } }, URLSearchParams, console };
    vm.createContext(ctx); vm.runInContext(a.slice(i, j) + '\nthis.git = getPostLoginDestination;', ctx); return () => ctx.git('u');
  };
  let g = hedef('?sonra=formulo'); assert.equal(await g(), 'formulo/'); assert.equal(await g(), 'dashboard.html');
  g = hedef('?sonra=ingilizce'); assert.equal(await g(), 'ingilizce/', 'Acadingo yolu bozulmadı');
});

test('dashboard: Formulo kartı Acadingo\'dan sonra, saatlerden önce; bağlantılar formulo/ altında', () => {
  const d = read('dashboard.html'), g = d.indexOf('data-acg-kart'), f = d.indexOf('data-fok '), s = d.indexOf('<section class="card sched land"');
  assert.ok(g > 0 && g < f && f < s, 'sıra: acadingo < formulo < saatler');
  assert.match(d, /<section class="card c-6 land fok" data-fok data-fok-kok="formulo\/"/);
  assert.match(d, /<link rel="stylesheet" href="formulo\/assets\/formulo-kart\.css">/);
  const sira = ['formulo/assets/formulo-veri.js', 'formulo/assets/formulo-veri-ek.js', 'formulo/assets/formulo-kart.js'].map((x) => d.indexOf('<script src="' + x + '">'));
  assert.ok(sira[0] > 0 && sira[0] < sira[1] && sira[1] < sira[2]);
  const k = read('formulo/assets/formulo-kart.js');
  assert.match(k, /var KOK = el\.getAttribute\('data-fok-kok'\) \|\| ''/);
  assert.equal((k.match(/KOK \+ 'index\.html/g) || []).length, 3, 'günün formülü, kaldığın yer ve boş durum bağlantıları');
  assert.match(read('formulo/assets/formulo-kart.css'), /@font-face\{font-family:'LM Roman'[^}]*fonts\/lm-regular\.woff/);
});

test('landing: #formulo sahnesi #akis ile MedLab arasında, menülerde ve altta bağlantı', () => {
  const h = read('index.html'), a = h.indexOf('<section id="akis"'), f = h.indexOf('<section id="formulo"'), m = h.indexOf('<section id="medlab"');
  assert.ok(a > 0 && a < f && f < m, 'sıra: akis < formulo < medlab');
  assert.match(h, /<a href="#formulo" data-sec="formulo">Formulo<\/a>\n<a href="#medlab" data-sec="medlab">MedLab<\/a>\n<a href="#acadingo"/);
  assert.match(h, /<a href="#formulo" style="color: #C5CFE6; text-decoration: none">Formulo<\/a>/);
  assert.match(h, /<a href="formulo\/" style="color: #B4C0DA; text-decoration: none">Formulo<\/a>/);
  const sec = h.slice(f, m);
  assert.equal((sec.match(/<li style="--c:#[0-9A-F]{6}"><button type="button">/g) || []).length, 5, 'beş adım');
  assert.match(sec, /<a class="fmu-btn" href="formulo\/">Formulo'yu aç/);
  assert.match(h, /<link rel="stylesheet" href="css\/acadex-formulo\.css">/);
  assert.ok(h.indexOf('<script src="js/acadex-formulo.js">') > h.indexOf('<script src="js/acadia-kit.js">'), 'Profesör Acadia için kit önce yüklenir');
  const css = read('css/acadex-formulo.css');
  assert.match(css, /\.fmu-stage\{position:sticky/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{[\s\S]*\.fmu-stage\{position:relative/);
  assert.match(css, /\.acd-guide\.fmu-sakla\{opacity:0/);
  assert.doesNotMatch(css, /(^|[^-\w])\.(on|ust)\b(?![-\w])\s*[{,]/m, 'çakışan çıplak sınıf yok');
  const js = read('js/acadex-formulo.js');
  assert.match(js, /Math\.floor\(p \* N\)/);
  assert.match(js, /bas = 'kep'; o\.goz = 'gozluk'; o\.boyun = 'papyon'/);
  const reh = read('js/acadia-rehber.js');
  assert.match(reh, /q: '#formulo'[^}]*sakla: true/);
  assert.match(reh, /g\.classList\.toggle\('fmu-sakla', !!s\.sakla\); if \(s\.sakla\) return;/);
});

test('ürün kuralı: Formulo\'da öğretmen, sınıf, ödev ya da "öğretmene ilet" yok', () => {
  const dosyalar = fs.readdirSync(path.join(ROOT, 'formulo/assets')).filter((f) => /\.(js|css)$/.test(f)).map((f) => 'formulo/assets/' + f).concat(['formulo/index.html', 'js/acadex-formulo.js']);
  dosyalar.forEach((f) => assert.doesNotMatch(read(f), /öğretmene ilet|teacher|ödev|my_classes|assignment/i, f));
});

/* veri ve üreticiler: tarayıcı olmadan, sahte pencereyle */
function yukle() {
  const div = () => ({ set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, querySelector: () => null, querySelectorAll: () => [] });
  const W = { matchMedia: () => ({ matches: false }), document: { createElement: div } };
  W.window = W; const ctx = vm.createContext(W);
  ['formulo-veri', 'formulo-veri-ek', 'formulo-uret'].forEach((f) => vm.runInContext(read('formulo/assets/' + f + '.js'), ctx));
  return W;
}
test('veri: 8 ders, her derste en az 25 formül, kimlikler tekil, hesaplananlar varsayılanda sonlu', () => {
  const FO = yukle().FORMULO, say = {};
  assert.equal(FO.dersler.length, 8);
  const ids = new Set();
  FO.formuller.forEach((f) => {
    assert.ok(!ids.has(f.id), 'tekrar: ' + f.id); ids.add(f.id); say[f.d] = (say[f.d] || 0) + 1;
    const d = FO.dersler.find((x) => x.id === f.d); assert.ok(d && d.konular.some((k) => k.id === f.k), 'konu: ' + f.id);
    if (f.o) { const v = {}; Object.keys(f.v).forEach((k) => { v[k] = f.v[k].val; }); assert.ok(Number.isFinite(f.o.f(v)), 'sonuç: ' + f.id); }
  });
  FO.dersler.forEach((d) => assert.ok(say[d.id] >= 25, d.id + ': ' + say[d.id]));
});
test('üreticiler: her biri 60 denemede sonlu cevap ya da geçerli şık, ipucu ve çözüm verir', () => {
  const U = yukle().FORMULO_URET;
  assert.ok(U.G.length >= 45);
  U.G.forEach((g) => {
    for (let n = 0; n < 60; n++) {
      const q = U.uret(g);
      if (q.mc) assert.ok(q.mc.length >= 2 && q.dogruI >= 0 && q.dogruI < q.mc.length, g.id);
      else assert.ok(Number.isFinite(q.dogru), g.id);
      assert.ok(q.ip.length === 2 && q.cozum.length >= 1, g.id);
    }
  });
});

summary();
