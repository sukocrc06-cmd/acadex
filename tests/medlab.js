/* ==========================================================================
   ACADEX — MEDLAB PANELI TESTLERI (tests/medlab.js)

   NEDEN VAR (24.10.2026, "Acadex MedLab" paneli):
     - Sol menuye Study Lab'in yanina "Acadex MedLab" eklendi; gorunum
       dashboard.html → #medlab-view, davranis js/acadex-medlab.js.
     - dashboard.js'teki sekme listesi 'medlab'i tanimiyor; kenar menu
       isareti ve ilk acilis acadex-medlab.js'teki sarmalayicida. Bu sarmalayici
       duserse panel acilir ama menu isaretlenmez (ya da hic acilmaz).
     - Anatomi Lab (tasarim klasorundeki anatomi-lab-v10.html) labs/anatomi/
       altina kopyalandi. Sayfa 3B veriyi 'data/ax-*.js' goreli yoluyla yukler;
       bir dosya eksik kalirsa lab acilir ama o sistem (kas, sinir...) hic gelmez.
     - Lab tam ekran katmanda iframe ile acilir. Katman section'in icinde
       kalirsa sayfa gecis animasyonunun transform'u position:fixed'i bozar;
       bu yuzden body'ye tasinir.

   Calistirma:  node tests/medlab.js
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

const html = read('dashboard.html');
const lab = read('labs/anatomi/index.html');

test('sol menude Study Lab\'in hemen altinda Acadex MedLab var', () => {
  const sl = html.indexOf('id="side-studylab"'), ml = html.indexOf('id="side-medlab"');
  assert.ok(sl > 0 && ml > sl, 'side-medlab, side-studylab\'dan sonra gelmeli');
  const li = html.slice(ml, html.indexOf('</li>', ml));
  assert.match(li, /switchDashboardView\('medlab'\)/);
  assert.match(li, /<span class="lbl">Acadex MedLab<\/span>/);
});

test('MedLab gorunumu, Anatomi Lab karti, kapak ve "tip ogrencileri icin" notu', () => {
  const s = html.indexOf('<section id="medlab-view"');
  assert.ok(s > 0, '#medlab-view yok');
  const sec = html.slice(s, html.indexOf('</section>\n', html.indexOf('data-medlab-run', s)) + 10);
  assert.match(sec, /class="dashboard-view-section axd axm"/);
  const card = sec.slice(sec.indexOf('data-medlab-open="anatomi"'), sec.indexOf('</button>', sec.indexOf('data-medlab-open="anatomi"')));
  assert.match(card, /<span class="axm-lab-t disp">Anatomi Lab<\/span>/);
  assert.match(card, /tıp öğrencileri için/);
  /* kapak 29.10.2026'dan beri animasyonlu iskelet karakteri (satır içi SVG); hareket tercihine bağlı */
  assert.match(card, /class="axm-cover axm-cover-ana" role="img" aria-label="[^"]+"/, 'kartta erişilebilir kapak yok');
  assert.match(card, /<svg class="axm-ana"[^>]*aria-hidden="true"/, 'kapak karakteri yok');
});

test('stil ve script dashboard.html\'e bagli, script acadex-ink.js\'ten sonra', () => {
  assert.match(html, /<link rel="stylesheet" href="css\/acadex-medlab.css">/);
  const ink = html.indexOf('<script src="js/acadex-ink.js"></script>'), med = html.indexOf('<script src="js/acadex-medlab.js"></script>');
  assert.ok(ink > 0 && med > ink, 'acadex-medlab.js, acadex-ink.js\'ten sonra yuklenmeli');
  assert.ok(fs.existsSync(path.join(ROOT, 'css/acadex-medlab.css')));
});

/* Fizyo Lab (tasarim klasorundeki fizyo-lab-v2.html) ayri veri tasimiyor: FILES tablosu
   '../anatomi/data/...' der, yani labs/fizyo/ ile labs/anatomi/ kardes kalmali. */
const LABS = { anatomi: lab, fizyo: read('labs/fizyo/index.html') };
for (const [k, src] of Object.entries(LABS)) {
  test(`${k} lab: sayfanin istedigi her veri dosyasi repoda var`, () => {
    const m = /const FILES = (\{[^}]+\})/.exec(src);
    assert.ok(m, 'FILES tablosu bulunamadi');
    const files = Object.values(vm.runInNewContext('(' + m[1] + ')'));
    assert.ok(files.length >= 8, 'en az 8 veri dosyasi beklenir');
    for (const f of files) {
      const p = path.join(ROOT, 'labs', k, f);
      assert.ok(fs.existsSync(p), `eksik: labs/${k}/${f}`);
      assert.match(fs.readFileSync(p, 'utf8').slice(0, 60), /window\.AXD=window\.AXD\|\|\{\}/, `${f} AXD'ye yazmiyor`);
    }
  });

  test(`${k} lab: goreli yol disinda yerel varlik istemiyor (kopya kendi basina calisir)`, () => {
    const srcs = [...src.matchAll(/\b(?:src|href)=["']([^"'#]+)["']/g)].map(x => x[1]);
    const local = srcs.filter(u => !/^(https?:|data:|mailto:|javascript:|\$\{)/.test(u)); // ${...}: JS sablonunda dis baglanti
    assert.deepEqual(local, [], 'yerel varlik referansi: ' + local.join(', '));
  });

  test(`${k} lab: tasarim onizleme cubugu (Cihaz / Lab arkadasi simulasyonu) uygulamada gizli`, () => {
    const tb = /<div class="tb"[^>]*>/.exec(src);
    assert.ok(tb, '.tb ogesi silinmemeli: #tbW/#tbF script\'leri ona bagli');
    assert.match(tb[0], /display:none/);
    assert.match(src, /id="tbW"/);
  });
}

test('3B model lisans notu (CC BY-SA) veriyle birlikte duruyor', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'labs/anatomi/data/LISANS.txt')));
  assert.match(html, /3B model: Z-Anatomy · BodyParts3D \(DBCLS\) · CC BY-SA 4.0/);
});

test('Fizyo Lab karti acilabilir, kapagi var, "tip ogrencileri icin" yaziyor', () => {
  const i = html.indexOf('data-medlab-open="fizyo"');
  assert.ok(i > 0, 'Fizyo Lab karti buton olmali (yakinda karti degil)');
  const card = html.slice(i, html.indexOf('</button>', i));
  assert.match(card, /<span class="axm-lab-t disp">Fizyo Lab<\/span>/);
  assert.match(card, /tıp öğrencileri için/);
  assert.match(card, /class="axm-cover axm-cover-fiz" role="img" aria-label="[^"]+"/, 'Fizyo Lab kapagi yok');
  assert.match(card, /<svg class="axm-fiz"[^>]*aria-hidden="true"/, 'diz karakteri yok');
  const css = fs.readFileSync(path.join(ROOT, 'css/acadex-medlab.css'), 'utf8'), k = css.slice(css.indexOf('Anatomi ve Fizyo Lab kapakları'));
  const motion = k.slice(k.indexOf('@media (prefers-reduced-motion:no-preference)'), k.indexOf('@keyframes'));
  assert.match(motion, /animation:ana-wave/); assert.match(motion, /animation:fiz-flex/);
  assert.ok(!/animation:(ana|fiz)-/.test(k.replace(motion, '')), 'karakter animasyonları yalnız hareket tercihi açıkken');
  assert.doesNotMatch(html, /axm-soon/, 'yakinda karti kalmamali');
});

/* Gorsel katman (24.10.2026): canli EKG monitoru, kart uzerinde tarama isigi, raf animasyonlari,
   karttan buyuyen acilis ve "model hazirlaniyor" ekrani, milimetrik arka plan.
   Hareketler prefers-reduced-motion'da durmali; EKG izi tam bir vurusluk kaymali ki dikis gorunmesin. */
test('gorsel katman: monitor, yukleniyor ekrani ve hareket azaltma korumasi', () => {
  assert.match(html, /class="axm-mon"/);
  assert.match(html, /data-medlab-bpm=""/);
  assert.match(html, /data-medlab-load="" hidden/);
  const css = read('css/acadex-medlab.css');
  for (const k of ['axm-trace', 'axm-pulse', 'axm-scan', 'axm-wave', 'axm-bubble', 'axm-draw']) {
    assert.match(css, new RegExp('@keyframes ' + k + '\\{'), `@keyframes ${k} yok`);
    const uses = [...css.matchAll(new RegExp('animation:' + k + '\\b', 'g'))];
    assert.ok(uses.length, `${k} hic kullanilmiyor`);
    for (const u of uses) {
      const before = css.slice(0, u.index), m = before.lastIndexOf('@media');
      assert.ok(m >= 0 && before.startsWith('@media (prefers-reduced-motion:no-preference)', m), `${k}: en yakin @media hareket azaltma korumasi degil`);
      assert.ok(!/\n\}\n|\}\}/.test(before.slice(m)), `${k}: hareket azaltma blogu kullanimdan once kapanmis`);
    }
  }
  // iz: 440 birimlik viewBox 420px'e cizilir -> bir vurus (110 birim) 105px; iki vurus = 210px kayma
  const tr = /\.axm-mon-tr\{[^}]*width:(\d+)px/.exec(css), shift = /@keyframes axm-trace\{from\{transform:translateX\(0\)\}to\{transform:translateX\(-(\d+)px\)\}\}/.exec(css);
  assert.ok(tr && shift);
  assert.equal(+shift[1], (+tr[1]) * 220 / 440, 'EKG izi tam iki vurusluk kaymali');
});

/* ---------- davranis: acadex-medlab.js en kucuk sahte DOM'da ---------- */
function el(attrs) {
  const e = {
    attrs: Object.assign({}, attrs), hidden: false, textContent: '', title: '', href: '', children: [], listeners: {},
    classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); }, toggle(c, on) { if (on === undefined ? !this.set.has(c) : on) this.set.add(c); else this.set.delete(c); } },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    fire(t, ev) { (this.listeners[t] || []).forEach(f => f(ev || {})); },
    focus() {}, closest(sel) { const k = /\[([^\]]+)\]/.exec(sel)[1]; return k in this.attrs ? this : null; },
    querySelector(sel) { const k = /\[([^\]=]+)/.exec(sel)[1]; return this.children.find(c => k in c.attrs) || null; },
    appendChild(c) { this.children.push(c); c.parent = this; return c; }
  };
  return e;
}
function setup() {
  const sec = el({ id: 'medlab-view' }), run = el({ 'data-medlab-run': '' });
  run.hidden = true;
  ['data-medlab-frame', 'data-medlab-title', 'data-medlab-newtab', 'data-medlab-close'].forEach(k => run.appendChild(el({ [k]: '' })));
  sec.children.push(run);
  const side = el({ id: 'side-medlab' }), other = el({ id: 'side-home' }); other.classList.add('active');
  const body = el({}), docL = {};
  const calls = [];
  const ctx = {
    console, setTimeout: (f) => f(), clearTimeout: () => {}, currentActiveTab: 'home',
    document: {
      body, getElementById: (id) => ({ 'medlab-view': sec, 'side-medlab': side })[id] || null,
      querySelector: (s) => s === '.dashboard-view-section.active' ? ctx.activeSection : null,
      querySelectorAll: () => [side, other].filter(x => x.classList.contains('active')),
      addEventListener: (t, f) => { docL[t] = f; }
    },
    activeSection: el({ id: 'home-view' }),
    switchDashboardView: function (v) { calls.push(v); ctx.currentActiveTab = v; }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/acadex-medlab.js'), ctx);
  return { ctx, sec, run, side, other, body, docL, calls };
}

test('katman body\'ye tasinir, kart tiklaninca Anatomi Lab iframe\'e yuklenir', () => {
  const { ctx, sec, run, body } = setup();
  assert.equal(run.parent, body, 'tam ekran katman body\'ye tasinmali');
  const frame = run.querySelector('[data-medlab-frame]');
  assert.equal(frame.getAttribute('src'), null, 'iframe ilk acilistan once yuklenmemeli (veri agir)');
  const btn = el({ 'data-medlab-open': 'anatomi' });
  sec.fire('click', { target: btn });
  assert.equal(run.hidden, false);
  assert.equal(frame.getAttribute('src'), 'labs/anatomi/index.html?medlab=1', 'iframe kopru parametresiyle acilir');
  assert.equal(run.querySelector('[data-medlab-title]').textContent, 'Anatomi Lab');
  assert.ok(body.classList.contains('axm-open'));
  assert.equal(ctx.AX_MEDLABS.anatomi.src, 'labs/anatomi/index.html');
  sec.fire('click', { target: el({ 'data-medlab-open': 'fizyo' }) });
  assert.equal(frame.getAttribute('src'), 'labs/fizyo/index.html?medlab=1', 'Fizyo Lab ayni katmanda acilmali');
  assert.equal(run.querySelector('[data-medlab-title]').textContent, 'Fizyo Lab');
  assert.equal(run.querySelector('[data-medlab-newtab]').href, 'labs/fizyo/index.html');
});

test('Esc ve "MedLab\'e don" kapatir; baska sekmeye gecis de kapatir', () => {
  const { ctx, run, body, docL } = setup();
  ctx.axMedLabOpen('anatomi');
  docL.keydown({ key: 'Escape' });
  assert.equal(run.hidden, true);
  assert.ok(!body.classList.contains('axm-open'));
  ctx.axMedLabOpen('anatomi');
  run.querySelector('[data-medlab-close]').fire('click');
  assert.equal(run.hidden, true);
  ctx.axMedLabOpen('anatomi');
  ctx.switchDashboardView('home');
  assert.equal(run.hidden, true, 'baska panele gecince lab kapanmali');
  assert.equal(ctx.axMedLabOpen('yok'), false, 'bilinmeyen lab acilmaz');
});

test('switchDashboardView sarmalayici: medlab menuyu isaretler, digerlerini temizler', () => {
  const { ctx, side, other, calls } = setup();
  ctx.switchDashboardView('medlab');
  assert.deepEqual(calls, ['medlab'], 'aktif bolum varken asil gecis cagrilmali');
  assert.ok(side.classList.contains('active'));
  assert.ok(!other.classList.contains('active'));
  ctx.switchDashboardView('home');
  assert.ok(!side.classList.contains('active'));
});

test('ilk acilista aktif bolum yoksa #medlab-view dogrudan acilir', () => {
  const { ctx, sec, side, calls } = setup();
  ctx.activeSection = null;
  ctx.switchDashboardView('medlab');
  assert.deepEqual(calls, [], 'dashboard.js medlab\'i tanimadigi icin cagrilmamali');
  assert.ok(sec.classList.contains('active'));
  assert.ok(side.classList.contains('active'));
  assert.equal(ctx.currentActiveTab, 'medlab');
});

test('Acadia gorunum listesi, sayfa sirasi ve Ctrl+K komutlari medlab\'i biliyor', () => {
  const ink = read('js/acadex-ink.js'), plus = read('js/acadex-plus.js');
  assert.match(ink, /studylab: 'Study Lab', medlab: 'MedLab'/);
  assert.match(ink, /'studylab', 'medlab', 'docs'/);
  assert.match(ink, /\n\s+medlab: \[/);
  assert.match(plus, /t: 'Acadex MedLab'[^}]+v: 'medlab' \}/);
});

summary();
