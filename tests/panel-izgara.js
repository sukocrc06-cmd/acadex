/* ==========================================================================
   ACADEX — SADE MENÜ + PANEL IZGARASI TESTLERİ (tests/panel-izgara.js), 06.11.2026

   NEDEN VAR: kullanıcılar sol menünün kalabalık olduğunu söyledi. Hiçbir panel kalkmadan:
     - menü Bugün + Çalış · Laboratuvarlar · Belgeler · Ölç (+ Proje) gruplarına indi
       (açık görünümün grubu açılır, aynı anda tek grup; dar menüde ve turda düz liste)
     - Bugün sayfasında "bugünün tek işi" kartı yerine logolu, üzerine gelince canlanan
       panel kartları var; kart menüdeki bağlantıyı tıklar (rol/gizlilik kuralları aynen)
   Bu dosya: her panelin menüde ve ızgarada yeri olduğunu, grup davranışını (sahte DOM ile),
   eski kartın çizilmediğini, çevirileri ve hareket azaltmayı sınar.
   Görsel doğrulama Playwright ile yapıldı (1440 px, dar menü, 390 px çekmece).
   Çalıştırma:  node tests/panel-izgara.js
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

const HTML = read('dashboard.html');
const JS = read('js/acadex-panel-izgara.js');
const CSS = read('css/acadex-panel-izgara.css');
const nav = HTML.slice(HTML.indexOf('<aside class="sidebar ax-side" id="nav-menu">'), HTML.indexOf('</aside>'));
const grupOf = (id) => { const i = nav.indexOf('id="side-' + id + '"'); if (i < 0) return null; const g = nav.lastIndexOf('<div class="ax-grp" data-grp="', i); const kap = nav.lastIndexOf('</div>', i); return g > kap ? nav.slice(g + 30, nav.indexOf('"', g + 30)) : 'yok'; };

/* --- sahte DOM: yalnız modülün kullandığı kadarı --- */
function sahteDom() {
  class Cls { constructor(el) { this.el = el; this.s = new Set(); } add(...c) { c.forEach((x) => this.s.add(x)); } remove(...c) { c.forEach((x) => this.s.delete(x)); } contains(c) { return this.s.has(c); } toggle(c, on) { if (on === undefined) on = !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; } }
  class El {
    constructor(tag, cls = [], id = '') { this.tag = tag; this.classList = new Cls(this); cls.forEach((c) => this.classList.add(c)); this.id = id; this.children = []; this.parentNode = null; this.attrs = {}; this.style = {}; this.hidden = false; this.ls = {}; this.textContent = ''; }
    add(c) { c.parentNode = this; this.children.push(c); return c; }
    all() { return this.children.flatMap((c) => [c, ...c.all()]); }
    m(sel) { return sel.split(',').some((one) => { one = one.trim(); const parts = one.split(/\s+/); const last = parts[parts.length - 1]; const ok = (e, s) => { const [t, ...cl] = s.split('.'); const idm = t.startsWith('#') ? t.slice(1) : null; return (idm ? e.id === idm : (!t || e.tag === t)) && cl.every((c) => e.classList.contains(c)); }; if (!ok(this, last)) return false; let p = this.parentNode; for (let i = parts.length - 2; i >= 0; i--) { while (p && !ok(p, parts[i])) p = p.parentNode; if (!p) return false; p = p.parentNode; } return true; }); }
    querySelectorAll(sel) { return this.all().filter((e) => e.m(sel)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; }
    addEventListener(t, f) { (this.ls[t] = this.ls[t] || []).push(f); } click() { (this.ls.click || []).forEach((f) => f({ target: this })); this.tik = (this.tik || 0) + 1; }
  }
  const root = new El('html'); const body = root.add(new El('body')); const aside = body.add(new El('aside', ['ax-side'])); const nv = aside.add(new El('nav'));
  const li = (id, active) => { const l = new El('li', ['sidebar-item'], 'side-' + id); if (active) l.classList.add('active'); const a = l.add(new El('a')); const s = a.add(new El('span', ['lbl'])); s.textContent = id; return l; };
  const grp = (g, ids) => { const d = nv.add(new El('div', ['ax-grp'])); d.attrs['data-grp'] = g; d.dataset = { grp: g }; const b = d.add(new El('button', ['ax-grp-b'])); b.add(new El('span', ['ax-grp-n'])); const u = d.add(new El('ul', ['ax-grp-ul'])); ids.forEach((i) => u.add(li(i))); return d; };
  nv.add(li('home', true));
  const G = { calis: grp('calis', ['planner', 'notebook', 'cards', 'sourcehub', 'acadia']), lab: grp('lab', ['studylab', 'medlab', 'finans']), belge: grp('belge', ['docs', 'feed', 'acadexsunum']), olc: grp('olc', ['exams']) };
  const document = { documentElement: root, body, readyState: 'complete', querySelector: (s) => root.querySelector(s), querySelectorAll: (s) => root.querySelectorAll(s), getElementById: (id) => root.all().find((e) => e.id === id) || null, addEventListener() {}, contains: () => true, createElement: (t) => new El(t) };
  return { document, G, root, byId: document.getElementById };
}
function yukle() {
  const D = sahteDom(); const gozlem = [];
  const ctx = { window: {}, document: D.document, setTimeout: (f) => { gozlem.push(f); return 0; }, clearTimeout() {}, MutationObserver: class { constructor(f) { this.f = f; gozlem.push(f); } observe() {} } };
  vm.runInNewContext(JS, ctx);
  return { ...D, api: ctx.window.AX_PANEL, aktifYap: (id) => { D.document.querySelectorAll('.sidebar-item').forEach((l) => l.classList.remove('active')); D.byId('side-' + id).classList.add('active'); ctx.window.AX_PANEL.esitle(); } };
}

test('her panel menüde bir grupta, hiçbiri kaybolmadı', () => {
  const beklenen = { planner: 'calis', notebook: 'calis', cards: 'calis', sourcehub: 'calis', acadia: 'calis', studylab: 'lab', medlab: 'lab', finans: 'lab', docs: 'belge', feed: 'belge', acadexsunum: 'belge', exams: 'olc', sandbox: 'proje', 'sandbox-interaction': 'proje' };
  for (const [id, g] of Object.entries(beklenen)) assert.equal(grupOf(id), g, id);
  assert.equal(grupOf('home'), 'yok', 'Bugün grupsuz, en üstte'); assert.equal(grupOf('settings'), 'yok', 'Ayarlar grupsuz');
  const gs = [...nav.matchAll(/<div class="ax-grp" data-grp="([a-z]+)">/g)].map((m) => m[1]);
  assert.deepEqual(gs, ['calis', 'lab', 'belge', 'olc', 'proje']);
  for (const g of gs) { assert.match(nav, new RegExp('aria-controls="ax-grp-' + g + '"')); assert.match(nav, new RegExp('<ul class="sidebar-nav[^"]*ax-grp-ul" id="ax-grp-' + g + '">')); }
  assert.equal((nav.match(/<h4>/g) || []).length, 5, 'dar menü ve tur için grup başlıkları korunur');
});

test('ızgara: 12 panelin her biri menüdeki elemana bağlı ve kendi ikonuna sahip', () => {
  const { api } = yukle();
  const ids = Array.from(api.PANEL, (p) => p.id);
  assert.equal(ids.length, 12); assert.equal(new Set(ids).size, 12);
  for (const p of api.PANEL) {
    assert.ok(HTML.includes('id="side-' + p.id + '"'), p.id + ' menüde yok');
    assert.match(api.IKON[p.id] || '', /^<svg class="ic-[a-z]+" viewBox="0 0 48 48" aria-hidden="true"/, p.id + ' ikonu');
    assert.equal(grupOf(p.id), p.g, p.id + ' grubu menüyle aynı');
    assert.ok(p.d.length > 5 && p.d.length < 40, p.id + ' kısa açıklama');
  }
  /* her ikonun hareketi CSS'te tanımlı (yalnız üzerine gelince/odakta) */
  for (const svg of Object.values(api.IKON)) { const c = svg.match(/class="(ic-[a-z]+)"/)[1]; assert.match(CSS, new RegExp('\\.ax-pg-t:hover \\.' + c + ' '), c); }
  assert.match(JS, /var a = \$\('#side-' \+ b\.getAttribute\('data-p'\) \+ ' a'\); if \(a\) a\.click\(\);/, 'kart menü bağlantısını tıklar');
  assert.match(JS, /b\.parentNode\.hidden = !li \|\| gizli\(li\);/, 'gizli menü elemanı = gizli kart');
});

test('grup davranışı: açık görünümün grubu açılır, tek grup açık, tek elemanlı grup doğrudan açar', () => {
  const t = yukle(); const { G } = t;
  assert.ok(t.root.classList.contains('ax-grp-on'));
  assert.equal(G.calis.querySelector('.ax-grp-n').textContent, '5'); assert.ok(G.olc.classList.contains('tek'));
  assert.ok(!G.calis.classList.contains('acik'), 'Bugün açıkken grup kapalı');
  t.aktifYap('cards'); assert.ok(G.calis.classList.contains('acik') && G.calis.classList.contains('aktif'));
  assert.equal(G.calis.querySelector('.ax-grp-b').getAttribute('aria-expanded'), 'true');
  G.lab.querySelector('.ax-grp-b').click(); assert.ok(G.lab.classList.contains('acik')); assert.ok(!G.calis.classList.contains('acik'), 'aynı anda tek grup');
  t.api.esitle(); assert.ok(G.lab.classList.contains('acik'), 'görünüm değişmedikçe kullanıcının açtığı grup açık kalır');
  G.lab.querySelector('.ax-grp-b').click(); assert.ok(!G.lab.classList.contains('acik'), 'ikinci tık kapatır');
  const ex = t.byId('side-exams').querySelector('a'); G.olc.querySelector('.ax-grp-b').click(); assert.equal(ex.tik, 1, 'Ölç tek panel: doğrudan Sınav platformu');
  t.aktifYap('medlab'); assert.ok(G.lab.classList.contains('acik') && !G.calis.classList.contains('acik'));
  t.byId('side-finans').style.display = 'none'; t.byId('side-medlab').hidden = true; t.byId('side-studylab').hidden = true; t.api.sayac();
  assert.ok(G.lab.hidden, 'bütün elemanları gizli grup görünmez');
});

test('Bugün: eski "tek iş" kartı çizilmez, ızgara onun yerinde; betik sırası doğru', () => {
  const plus = read('js/acadex-plus.js');
  assert.match(plus, /var mountToday = function \(\) \{[\s\S]{0,400}if \(window\.__axPanelIzgara\) return false;/);
  const at = (f) => HTML.indexOf('src="js/' + f + '"');
  assert.ok(at('acadex-panel-izgara.js') > 0 && at('acadex-panel-izgara.js') < at('acadex-plus.js'), 'ızgara bayrağı acadex-plus’tan önce');
  assert.ok(at('acadex-panel-izgara.js') < at('acadex-i18n.js'), 'çeviri ızgarayı da görür');
  assert.match(HTML, /<link rel="stylesheet" href="css\/acadex-panel-izgara\.css">/);
  assert.match(JS, /grid\.parentNode\.insertBefore\(izgara, grid\);/);
});

test('erişilebilirlik ve hareket: düğmeler, aria, hareket azaltma, dar menü, tur', () => {
  assert.match(nav, /<button type="button" class="ax-grp-b" aria-expanded="false" aria-controls="ax-grp-calis">/);
  assert.match(JS, /<button type="button" class="ax-pg-t" data-p="/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)\{[\s\S]*\.ax-pg-t \*[\s\S]*animation:none!important/);
  assert.match(CSS, /html\.nav-c body\.acx \.ax-side \.ax-grp-b,html\.ax-grp-hepsi body\.acx \.ax-side \.ax-grp-b\{display:none\}/, 'dar menüde ve turda düz liste');
  assert.match(JS, /H\.classList\.toggle\('ax-grp-hepsi', !!\(o && o\.classList\.contains\('active'\)\)\)/, 'tur açıkken her şey görünür');
  assert.match(CSS, /\.ax-pg-t:focus-visible \.ic-med \.ekg/, 'klavye odağında da canlanır');
  assert.match(CSS, /html\.ax-dark #home-view \.ax-pg-i svg\{filter:invert\(1\) hue-rotate\(180deg\)\}/);
});

test('çeviri: yeni metinlerin İngilizcesi var', () => {
  const en = read('js/i18n-en.js'); const { api } = yukle();
  for (const t of ['Çalış', 'Laboratuvarlar', 'Belgeler', 'Ölç', 'Proje', 'panellerin', 'hepsi burada; menüde gruplar hâlinde de duruyor', ...Array.from(api.PANEL, (p) => p.d)]) assert.ok(en.includes('"' + t + '":'), t);
});

summary();
