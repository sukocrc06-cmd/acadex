/* ==========================================================================
   ACADEX — MEDLAB 3B KAMPÜS GİRİŞİ (tests/medlab-kampus.js)

   NEDEN VAR (01.11.2026): Oylama sonucu MedLab'in girişi 3B sağlık kampüsü oldu.
     - Kampüs ayrı sayfa (labs/kampus/index.html, kendi three.js importmap'i) ve
       MedLab görünümünde iframe'de çalışır. Yalnız MedLab açıkken yüklenir,
       başka panele geçince boşaltılır (WebGL belleği serbest kalır).
     - Binaya girince kampüs {src:'axkampus', type:'ac', lab} gönderir; lab
       mevcut tam ekran katmanda açılır. Katman kapanınca kampüse 'geri' gider.
     - Zayıf cihaz, WebGL yokluğu ya da "2B" seçimi liste görünümüne (lab kartları)
       geçirir; tercih axKampusGrafik anahtarında, kampüsle aynı.
   Calistirma:  node tests/medlab-kampus.js
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

test('dashboard: kampüs iframe\'i lab rafından önce, src olmadan (ilk açılışta yüklenir), liste çubuğu gizli', () => {
  const d = read('dashboard.html'), k = d.indexOf('data-medlab-kampus=""'), t = d.indexOf('<section class="axm-tray land"');
  assert.ok(k > 0 && k < t, 'kampüs raf bölümünden önce');
  const blok = d.slice(k, t);
  assert.match(blok, /<iframe class="axm-kampus-fr" data-kampus-frame="" title="[^"]+" allow="fullscreen"><\/iframe>/);
  assert.doesNotMatch(blok, /<iframe[^>]* src=/, 'iframe başlangıçta boş');
  assert.match(blok, /data-kampus-mod="liste"/); assert.match(d, /<div class="axm-liste-bar" data-kampus-liste="" hidden>/); assert.match(d, /data-kampus-mod="3b"/);
  const css = read('css/acadex-medlab.css');
  assert.match(css, /#medlab-view\.axm\.axm-3b \.axm-tray,#medlab-view\.axm\.axm-3b \.axm-cite\{display:none\}/);
  assert.match(css, /#medlab-view\.axm\.axm-3b \.axm-kampus\{display:block\}/);
  assert.ok(fs.existsSync(path.join(ROOT, 'labs/kampus/index.html')) && fs.existsSync(path.join(ROOT, 'labs/kampus/kampus-onizleme.webp')));
});

test('kampüs sayfası: gömülüyken başlığı gizler, girişi ve 2B\'yi ana sayfaya bildirir, yalnız aynı kaynaktan dinler', () => {
  const h = read('labs/kampus/index.html');
  assert.match(h, /if\(window\.parent!==window\)document\.documentElement\.classList\.add\('gom'\)/);
  assert.match(h, /"imports":\{"three":"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/build\/three\.module\.js"/);
  assert.match(h, /if \(GOMULU\) setTimeout\(\(\) => ust\(\{ type: 'ac', lab: id \}\)/);
  assert.match(h, /const ikiB = \(neden, kalici\) => \{ if \(GOMULU\) ust\(\{ type: '2b'/);
  assert.match(h, /if \(e\.origin !== ORG \|\| e\.source !== W\.parent\) return;/);
  assert.match(h, /if \(d\.type === 'geri' && yakin\) geri\(\);/);
  assert.match(h, /disGorunur = !!d\.v/); assert.match(h, /if \(D\.hidden \|\| !gorunur \|\| !disGorunur\) \{ calisiyor = false; return; \}/);
  assert.doesNotMatch(h, /kampus-2b\.html/, 'ayrı 2B sayfa yok; liste görünümü lab kartları');
  for (const id of ['medica', 'anatomi', 'fizyo', 'odyoloji', 'diyet', 'dkt', 'eczacilik', 'hemsirelik']) assert.match(h, new RegExp("\\{ id: '" + id + "', ad: "), 'bina ' + id);
});

/* ---------- davranış: acadex-medlab.js sahte DOM'da ---------- */
function el(attrs) {
  const e = {
    attrs: Object.assign({}, attrs), hidden: false, textContent: '', title: '', href: '', children: [], listeners: {}, style: {},
    classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); }, toggle(c, on) { if (on === undefined ? !this.set.has(c) : on) this.set.add(c); else this.set.delete(c); } },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }, fire(t, ev) { (this.listeners[t] || []).forEach(f => f(ev || {})); },
    focus() {}, closest(sel) { const k = /\[([^\]]+)\]/.exec(sel)[1]; return k in this.attrs ? this : null; },
    querySelector(sel) { const k = /\[([^\]=]+)/.exec(sel)[1]; return this.children.find(c => k in c.attrs) || null; },
    appendChild(c) { this.children.push(c); c.parent = this; return c; }
  };
  return e;
}
function setup(kayit) {
  const sec = el({ id: 'medlab-view' }), run = el({ 'data-medlab-run': '' }); run.hidden = true;
  ['data-medlab-frame', 'data-medlab-title', 'data-medlab-newtab', 'data-medlab-close'].forEach(k => run.appendChild(el({ [k]: '' })));
  const kmp = el({ 'data-medlab-kampus': '' }), kfr = el({ 'data-kampus-frame': '' }), kon = el({ 'data-kampus-on': '' }), liste = el({ 'data-kampus-liste': '' });
  const giden = []; kfr.contentWindow = { postMessage: (m) => giden.push(Object.assign({}, m)), location: { replace() {} } };
  kmp.appendChild(kfr); kmp.appendChild(kon); sec.children.push(run, kmp, liste);
  const side = el({ id: 'side-medlab' }), body = el({}), winL = {}, store = Object.assign({}, kayit || {});
  const ctx = {
    console, setTimeout: (f) => f(), clearTimeout: () => {}, setInterval: () => 0, currentActiveTab: 'home', location: { origin: 'https://acadex.test' },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    addEventListener: (t, f) => { winL[t] = f; },
    document: { body, getElementById: (id) => ({ 'medlab-view': sec, 'side-medlab': side })[id] || null, querySelector: () => el({}), querySelectorAll: () => [], addEventListener: () => {} },
    switchDashboardView: function (v) { ctx.currentActiveTab = v; }
  };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('js/acadex-medlab.js'), ctx);
  const mesaj = (data, kaynak) => winL.message({ origin: 'https://acadex.test', source: kaynak || kfr.contentWindow, data });
  return { ctx, sec, run, kfr, kon, liste, giden, store, mesaj };
}

test('kampüs yalnız MedLab açıkken yüklenir, başka panelde boşaltılır', () => {
  const { ctx, sec, kfr, liste } = setup();
  assert.ok(sec.classList.contains('axm-3b')); assert.equal(liste.hidden, true);
  assert.equal(kfr.getAttribute('src'), null, 'MedLab açılmadan yüklenmez');
  ctx.switchDashboardView('medlab'); assert.equal(kfr.getAttribute('src'), 'labs/kampus/index.html');
  ctx.switchDashboardView('home'); assert.equal(kfr.getAttribute('src'), null, 'başka panelde boşaltılır');
});

test('binaya giriş: kampüs mesajı lab katmanını açar; kapanınca kampüse geri ve görünürlük gider', () => {
  const { ctx, run, kfr, kon, giden, mesaj } = setup();
  ctx.switchDashboardView('medlab');
  mesaj({ src: 'axkampus', type: 'hazir' }); assert.equal(kon.hidden, true);
  mesaj({ src: 'axkampus', type: 'boy', h: 930 }); assert.equal(kfr.style.height, '930px');
  mesaj({ src: 'axkampus', type: 'ac', lab: 'yok' }); assert.equal(run.hidden, true, 'bilinmeyen lab açılmaz');
  mesaj({ src: 'axkampus', type: 'ac', lab: 'dkt' }, {}); assert.equal(run.hidden, true, 'başka kaynaktan gelen mesaj yok sayılır');
  mesaj({ src: 'axkampus', type: 'ac', lab: 'eczacilik' });
  assert.equal(run.hidden, false); assert.equal(run.querySelector('[data-medlab-frame]').getAttribute('src'), 'labs/eczacilik/index.html?medlab=1');
  assert.deepEqual(giden.pop(), { type: 'gorunur', v: false, src: 'axhost-kampus' }, 'lab açıkken kampüs çizmez');
  run.querySelector('[data-medlab-close]').fire('click');
  assert.equal(run.hidden, true);
  assert.deepEqual(giden.slice(-2).map((m) => m.type), ['gorunur', 'geri']);
});

test('2B: kampüsün isteği liste görünümüne geçirir; seçim kalıcıysa saklanır, düğmeyle 3B\'ye dönülür', () => {
  const { ctx, sec, kfr, liste, store, mesaj } = setup();
  ctx.switchDashboardView('medlab');
  mesaj({ src: 'axkampus', type: '2b', neden: 'cihaz', kalici: false });
  assert.ok(!sec.classList.contains('axm-3b')); assert.equal(liste.hidden, false); assert.equal(kfr.getAttribute('src'), null);
  assert.equal(store.axKampusGrafik, undefined, 'otomatik geçiş tercihi değiştirmez');
  sec.classList.add('active'); sec.fire('click', { target: el({ 'data-kampus-mod': '3b' }) });
  assert.ok(sec.classList.contains('axm-3b')); assert.equal(store.axKampusGrafik, 'oto'); assert.equal(kfr.getAttribute('src'), 'labs/kampus/index.html');
  sec.fire('click', { target: el({ 'data-kampus-mod': 'liste' }) }); assert.equal(store.axKampusGrafik, '2b');
  const s2 = setup({ axKampusGrafik: '2b' }); assert.ok(!s2.sec.classList.contains('axm-3b'), 'kayıtlı 2B tercihi açılışta liste'); s2.ctx.switchDashboardView('medlab'); assert.equal(s2.kfr.getAttribute('src'), null);
});

summary();
