/* ==========================================================================
   ACADEX — ACADEX ENGLISH (tests/ingilizce.js)

   NEDEN VAR (05.11.2026): İngilizce bölümü panelde değil; landing'den açılan
   ayrı bir yer (ingilizce/). Kendi giriş ya da kayıt ekranı yok; yalnız
   oturumu açık ve kapalı betada erişimi olan Acadex hesapları görür.
     - Her sayfa <html class="kapi"> ile görünmez başlar; assets/kapi.js
       oturumu ve acadexAccess.check'i denetleyip açar.
     - Supabase yüklenemezse sayfa kilitli kalır (açık kapı yok).
     - Sayfalarda kayıt bağlantısı ya da fiyat yok; kilit kartı yalnız
       ../login.html'e götürür.
     - Landing'den üç yerden girilir: üst menü, yapışkan menü, alt menü.
   Tarayıcı ucu (sahte Supabase ile: oturum yok / izinsiz / izinli / CDN yok)
   scratchpad e2e ile denendi.
   Calistirma:  node tests/ingilizce.js
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
const SAYFALAR = ['index', 'vocab', 'listening', 'reading', 'speaking', 'writing'];

for (const s of SAYFALAR) {
  test(`ingilizce/${s}.html: kapı sırası, noindex, kayıt yok`, () => {
    const h = read(`ingilizce/${s}.html`);
    assert.match(h, /^<!doctype html>\n<html lang="tr" class="kapi">/, 'ilk boyamada gizli');
    assert.match(h, /<meta name="robots" content="noindex">/);
    const sira = ['supabase-js@2/dist/umd/supabase.min.js', '../js/supabase-config.js', '../js/acadex-erisim.js', 'assets/kapi.js', 'assets/ing.js'].map((x) => h.indexOf('src="' + (x.startsWith('supabase') ? 'https://cdn.jsdelivr.net/npm/@supabase/' : '') + x + '"'));
    /* son 30 dk'da doğrulanmışsa açık başlar (sayfa çevirme geçişi boş kâğıt göstermesin); kapi.js yine denetler */
    assert.match(h, /<meta name="robots" content="noindex">\n<script>[^<]*sessionStorage\.getItem\('acx\.kapi'\)\|\|0\)<18e5\)document\.documentElement\.classList\.remove\('kapi'\)/);
    assert.ok(sira.every((x, i) => x > 0 && (i === 0 || x > sira[i - 1])), 'betik sırası: ' + sira);
    assert.doesNotMatch(h, /register\.html|Ücretsiz başla|Bir kahve parasına|<h3>Pro<\/h3>/i, 'kayıt ya da satış yok');
    assert.doesNotMatch(h, /src="assets\/acadex-logo|url\(fonts\//, 'logo ve fontlar landing varlıklarından');
    for (const ad of SAYFALAR.slice(1)) assert.match(h, new RegExp(`href="${ad}\\.html"`), `${ad} sekmesi`);
  });
}

test('ing.css: kapı kuralı ve fontlar landing klasöründen', () => {
  const c = read('ingilizce/assets/ing.css');
  assert.match(c, /html\.kapi body>\*:not\(#kilit\)\{visibility:hidden\}/);
  assert.match(c, /url\(\.\.\/\.\.\/assets\/landing\/fonts\/bricolage-latin\.woff2\)/);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/landing/fonts/bricolage-latin.woff2')));
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/landing/acadex-logo.png')));
});

/* kapi.js sahte DOM'da: dört durum */
function kos(oturum, izin, istemciYok) {
  const sinif = new Set(['kapi']), eklenen = [];
  const el = () => { const e = { id: '', innerHTML: '', children: [], setAttribute() {}, remove() { e.silindi = true; }, querySelector: () => ({ textContent: '', focus() {} }) }; return e; };
  const D = { dispatchEvent() {}, readyState: 'complete', documentElement: { classList: { add: (c) => sinif.add(c), remove: (c) => sinif.delete(c), contains: (c) => sinif.has(c) } }, body: { appendChild: (e) => eklenen.push(e) }, createElement: el, addEventListener() {} };
  const depo = {}; const ctx = { Event: class { constructor(t) { this.type = t; } }, document: D, window: { addEventListener() {} }, console, sessionStorage: { getItem: (k) => depo[k] || null, setItem: (k, v) => { depo[k] = v; }, removeItem: (k) => { delete depo[k]; } } };
  ctx.window.acadexAccess = { check: async () => ({ ok: izin }) };
  if (!istemciYok) ctx.supabaseClient = { auth: { getSession: async () => ({ data: { session: oturum ? { user: { id: 'u' } } : null } }), onAuthStateChange() {} } };
  vm.createContext(ctx);
  vm.runInContext(read('ingilizce/assets/kapi.js'), ctx);
  return new Promise((r) => setTimeout(() => r({ kilitli: sinif.has('kapi'), kart: eklenen.map((e) => e.innerHTML).join('') }), 20));
}
test('kapi.js: oturum yok → kilit ve giriş bağlantısı; izinsiz → kilit; izinli → açık; istemci yok → kilit', async () => {
  let r = await kos(false, true); assert.ok(r.kilitli); assert.match(r.kart, /href="\.\.\/login\.html\?sonra=ingilizce"/); assert.doesNotMatch(r.kart, /register/);
  r = await kos(true, false); assert.ok(r.kilitli); assert.doesNotMatch(r.kart, /login\.html/);
  r = await kos(true, true); assert.ok(!r.kilitli);
  r = await kos(true, true, true); assert.ok(r.kilitli, 'Supabase yoksa açık kapı yok');
});

test('landing: English bağlantısı üst menü, yapışkan menü ve alt menüde', () => {
  const h = read('index.html');
  assert.match(h, /<a href="#medlab" data-sec="medlab">MedLab<\/a>\n<a href="ingilizce\/">English<\/a>/);
  assert.match(h, /<a href="ingilizce\/" style="color: #C5CFE6; text-decoration: none">English<\/a>/);
  assert.match(h, /<a href="ingilizce\/" style="color: #B4C0DA; text-decoration: none">Acadex English<\/a>/);
  assert.doesNotMatch(read('dashboard.html'), /ingilizce\//, 'panelde değil');
});

/* auth.js: ?sonra=ingilizce → girişten sonra panel değil ingilizce/ (Google dönüşü sessionStorage ile) */
function hedef(arama, izin) {
  const a = read('js/auth.js'), i = a.indexOf('const SONRA_HEDEF'), j = a.indexOf('/* GERI TUSU');
  assert.ok(i > 0 && j > i, 'SONRA bloğu getPostLoginDestination ile birlikte');
  const depo = {};
  const ctx = { window: { location: { search: arama }, acadexAccess: { check: async () => ({ ok: izin }) } }, sessionStorage: { getItem: (k) => (k in depo ? depo[k] : null), setItem: (k, v) => { depo[k] = String(v); }, removeItem: (k) => { delete depo[k]; } }, supabaseClient: { auth: { signOut: async () => {} } }, URLSearchParams, console };
  vm.createContext(ctx); vm.runInContext(a.slice(i, j) + '\nthis.git = getPostLoginDestination;', ctx);
  return { git: () => ctx.git('u'), depo, ctx };
}
test('auth.js: sonra=ingilizce girişten sonra ingilizce/e, bir kez; bilinmeyen hedef ve izinsiz hesap yok sayılır', async () => {
  let h = hedef('?sonra=ingilizce', true); assert.equal(await h.git(), 'ingilizce/'); assert.equal(await h.git(), 'dashboard.html', 'bir kez kullanılır');
  h = hedef('', true); assert.equal(await h.git(), 'dashboard.html');
  h = hedef('?sonra=https://kotu.site', true); assert.equal(await h.git(), 'dashboard.html', 'açık yönlendirme yok');
  h = hedef('?sonra=ingilizce', false); assert.equal(await h.git(), 'login.html?erisim=yok');
  /* Google dönüşü: login.html parametresiz açılır, hedef oturum deposundan gelir */
  h = hedef('?sonra=ingilizce', true); const kayit = Object.assign({}, h.depo); const g = hedef('', true); Object.assign(g.depo, kayit); assert.equal(await g.git(), 'ingilizce/');
});

test('kapi.js: doğrulanınca 30 dk izi ve acx:acik olayı; kilitlenince iz silinir', () => {
  const k = read('ingilizce/assets/kapi.js');
  assert.match(k, /function ac\(\) \{[^\n]*iz\(true\);[^\n]*D\.dispatchEvent\(new Event\('acx:acik'\)\)/);
  assert.match(k, /function kilit\(baslik, metin, giris\) \{\n    iz\(false\);/);
});

test('ing.js: görsel ve hareket katmanı (ışık, ses, ödül, parallax, karalama, kapak, şimdi, hafta)', () => {
  const j = read('ingilizce/assets/ing.js'), c = read('ingilizce/assets/ing.css');
  /* ışık: 05–11 sabah, 11–17 öğle, 17–20 akşam, gerisi gece */
  const isikAd = new Function(j.match(/function isikAd\(saat\) \{[^\n]+\}/)[0] + '; return isikAd;')();
  assert.deepEqual([3, 6, 12, 18, 22].map(isikAd), ['gece', 'sabah', 'ogle', 'aksam', 'gece']);
  assert.match(c, /html\[data-isik=gece\] body\{background-color:#17203E/);
  /* ses dosyasız (Web Audio), kapatılabilir; titreşim yalnız dokunmatikte */
  assert.match(j, /var sesAcik = ls\.al\('sesAcik', true\)/); assert.match(j, /pointer:coarse/); assert.doesNotMatch(j, /\.mp3|\.wav|new Audio\(/);
  /* ödül yalnız ilk bitirişte; rozet dört alıştırma bitince */
  assert.match(j, /if \(el && yeni\) odul\(el\);/); assert.match(j, /if \(tum\.length && n === tum\.length\) rozet\(\);/);
  /* hareket azaltılmışsa parallax, kırpıntı ve kapak yok */
  assert.match(j, /function parallax\(\) \{\n    if \(sakin\) return;/); assert.match(j, /if \(!yer \|\| sakin\) return;/);
  assert.match(c, /@media \(prefers-reduced-motion:reduce\)\{::view-transition-old\(root\),::view-transition-new\(root\)\{animation:none\}\}/);
  assert.match(c, /@view-transition\{navigation:auto\}/);
  /* her panelin kendi kostümü */
  for (const p of ['vocab', 'listening', 'reading', 'speaking', 'writing', 'hub']) assert.match(j, new RegExp('\\n    ' + p + ": '<g class=\"kos\">"));
  /* hub: kapak kapıdan sonra, şimdiki durak ve takvim kutuları */
  const h = read('ingilizce/index.html');
  assert.match(h, /<body data-panel="" data-sayfa="hub"/); assert.match(h, /id="simdi"/); assert.match(h, /<section class="bolum" id="hafta" data-yirtik>/);
  assert.match(j, /kapiSonra\(kapak\)/);
});

/* haftalık seri: eski kayıtlar (bitti zaman damgaları) da takvime düşer */
test('ing.js gunluk(): gunluk kaydı ve bitti damgaları birleşir', () => {
  const j = read('ingilizce/assets/ing.js');
  const f = j.match(/function gunAnahtar\(d\) \{[^\n]+\}\n  function gunluk\(\) \{[\s\S]*?\n  \}/)[0];
  const ls = { al: (k, v) => ({ gunluk: { '2026-11-03': { vocab: 1 } }, bitti: { writing: { hata: new Date(2026, 10, 5, 22).getTime() } } }[k] || v) };
  const g = new Function('ls', f + '; return gunluk();')(ls);
  assert.deepEqual(g, { '2026-11-03': { vocab: 1 }, '2026-11-05': { writing: 1 } });
});

summary();
