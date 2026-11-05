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
    const sira = ['supabase-js@2/dist/umd/supabase.min.js', '../js/supabase-config.js', '../js/acadex-erisim.js', 'assets/kapi.js', 'assets/ing.js'].map((x) => h.indexOf(x));
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
  const D = { readyState: 'complete', documentElement: { classList: { add: (c) => sinif.add(c), remove: (c) => sinif.delete(c), contains: (c) => sinif.has(c) } }, body: { appendChild: (e) => eklenen.push(e) }, createElement: el, addEventListener() {} };
  const ctx = { document: D, window: { addEventListener() {} }, console };
  ctx.window.acadexAccess = { check: async () => ({ ok: izin }) };
  if (!istemciYok) ctx.supabaseClient = { auth: { getSession: async () => ({ data: { session: oturum ? { user: { id: 'u' } } : null } }), onAuthStateChange() {} } };
  vm.createContext(ctx);
  vm.runInContext(read('ingilizce/assets/kapi.js'), ctx);
  return new Promise((r) => setTimeout(() => r({ kilitli: sinif.has('kapi'), kart: eklenen.map((e) => e.innerHTML).join('') }), 20));
}
test('kapi.js: oturum yok → kilit ve giriş bağlantısı; izinsiz → kilit; izinli → açık; istemci yok → kilit', async () => {
  let r = await kos(false, true); assert.ok(r.kilitli); assert.match(r.kart, /href="\.\.\/login\.html"/); assert.doesNotMatch(r.kart, /register/);
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

summary();
