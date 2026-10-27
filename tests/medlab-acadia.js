/* ==========================================================================
   ACADEX — MEDLAB × ACADIA KOPRUSU TESTLERI (tests/medlab-acadia.js)

   NEDEN VAR (27.10.2026): MedLab'de Anatomi/Fizyo Lab iframe'de acilinca
   ekranda iki Acadia vardi: labin kendi Acadia'si (#axaMas/#axaPanel) ve
   sitenin her panelde duran Acadia'si (#acadia-widget-container).
     - Lab ?medlab=1 ile acilir, kendi Acadia'sini gizler; yeni sekmede degismez.
     - Lab baglami postMessage ile gelir; site Acadia'si "Anatomi Lab · <yapi>"
       etiketi, lab cipleri ve karttan cevap verir; gerisi yapay zekaya kart
       bilgisiyle gider (window.axAcadiaPrefix -> dashboard.js).
     - Spot sinavda Acadia susar, bitince karneyi yorumlar.
     - Lab sohbeti lab basina localStorage'da saklanir.
   Tarayici ucu (gercek lab + 3B model) scratchpad e2e ile denendi; burada
   kopru sozlesmesi ve js/acadex-medlab-acadia.js sahte DOM'da sinanir.

   Calistirma:  node tests/medlab-acadia.js
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

for (const k of ['anatomi', 'fizyo']) {
  const src = read(`labs/${k}/index.html`);
  test(`${k} lab: iframe'de (?medlab=1) kendi Acadia'si ilk boyamadan once gizli`, () => {
    const head = src.slice(0, src.indexOf('</head>'));
    assert.match(head, /window\.parent!==window&&\/\[\?&\]medlab=1\(&\|\$\)\/\.test\(location\.search\)\)document\.documentElement\.classList\.add\('axm-embed'\)/);
    assert.match(head, /\.axm-embed #axaMas,\.axm-embed #axaPanel\{display:none!important\}/);
  });
  test(`${k} lab: kopru yalniz ust sayfadan ve ayni kaynaktan mesaj kabul eder`, () => {
    const i = src.indexOf('MedLab köprüsü (27.10.2026)');
    assert.ok(i > 0 && i > src.indexOf('window.__lab = {'), 'kopru __lab tanimindan sonra (lab hazirken) kurulmali');
    const br = src.slice(i, src.indexOf('})();', src.indexOf("post(reply);\n    });", i)));
    assert.match(br, /if \(e\.origin !== ORG \|\| e\.source !== window\.parent\) return;/);
    assert.match(br, /d\.src !== 'axhost'/);
    assert.match(br, /window\.parent\.postMessage\(m, ORG\)/, 'hedef kaynak "*" olmamali');
    assert.match(br, /var _ra = renderAcadia; renderAcadia = function/, 'baglam her Acadia cizimiyle gitmeli');
    assert.match(br, /post\(\{ type: 'ack', id: d\.id \}\)/);
    assert.match(br, /o\.spotRes = /, 'spot bitince karne gonderilmeli');
  });
}

test('MedLab katmani lab\'i ?medlab=1 ile acar, bagli script sirasi dogru', () => {
  const med = read('js/acadex-medlab.js');
  assert.match(med, /var fsrc = L\.src \+ '\?medlab=1';/);
  assert.match(med, /newTab\.href = L\.src;/, 'yeni sekme koprusuz acilmali (lab kendi Acadia\'siyla)');
  const a = html.indexOf('<script src="js/acadex-medlab.js"></script>'), b = html.indexOf('<script src="js/acadex-medlab-acadia.js"></script>'), d = html.indexOf('<script src="js/dashboard.js"></script>');
  assert.ok(d > 0 && a > d && b > a, 'dashboard.js -> acadex-medlab.js -> acadex-medlab-acadia.js');
  assert.match(read('js/dashboard.js'), /message: \(typeof window\.axAcadiaPrefix === 'function' \? window\.axAcadiaPrefix\(text\) : ''\) \+ text,/);
});

/* ---------- davranis: sahte DOM ---------- */
function el(id) {
  const e = {
    id, hidden: false, textContent: '', innerHTML: '', disabled: false, style: {}, children: [], listeners: {},
    classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, contains(c) { return this.s.has(c); }, toggle(c, on) { if (on) this.s.add(c); else this.s.delete(c); } },
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    get lastElementChild() { return this.children[this.children.length - 1] || null; },
    appendChild(c) { this.children.push(c); return c; },
    parentNode: null
  };
  return e;
}
function setup(lsInit) {
  const ids = {};
  ['acadia-messages', 'acadia-context-label', 'btn-acadia-select-card', 'acadia-card-picker', 'acadia-typing-indicator', 'btn-acadia-toggle'].forEach(i => { ids[i] = el(i); });
  const panelBox = el('panel'); panelBox.insertBefore = (n) => { ids[n.id] = n; };
  ids['acadia-card-picker'].parentNode = panelBox;
  ids['acadia-context-label'].textContent = 'Bir özet seç (bağlam ekle)';
  const ls = Object.assign({}, lsInit || {});
  const sent = [], winL = {}, aiCalls = [];
  const frameWin = { postMessage: (m, o) => sent.push([m, o]) };
  const ctx = {
    console, JSON, Promise, Object, Array, String, setTimeout, clearTimeout,
    location: { origin: 'https://acadex.com.tr' },
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
    document: { body: el('body'), getElementById: i => ids[i] || null, createElement: () => el(null) },
    acadiaChatHistory: [{ role: 'assistant', content: 'genel' }], acadiaHasGreeted: true,
    renderAcadiaMessage: (r, t) => { const b = el(null); b.textContent = t; b.role = r; ids['acadia-messages'].children.push(b); },
    toggleAcadiaPanel: () => {},
    sendAcadiaMessage: async (t) => { aiCalls.push(t); },
    clearAcadiaChat: () => {}
  };
  ctx.window = ctx;
  ctx.addEventListener = (t, f) => { winL[t] = f; };
  vm.createContext(ctx);
  vm.runInContext('var acadiaChatHistory = this.acadiaChatHistory, acadiaHasGreeted = true;' + read('js/acadex-medlab-acadia.js'), ctx);
  const frame = { contentWindow: frameWin };
  const fromLab = (data, src) => winL.message({ source: src || frameWin, origin: 'https://acadex.com.tr', data: Object.assign({ src: 'axlab', lab: 'anatomi' }, data) });
  return { ctx, ids, ls, sent, frame, fromLab, aiCalls, frameWin };
}
const SEL = { key: 'biceps', title: 'İki başlı kol kası', la: 'M. biceps brachii', rows: [['İnervasyon', 'N. musculocutaneus (C5–C6)'], ['Fonksiyon', 'Önkol fleksiyonu ve supinasyonu']] };

test('lab acilinca panel lab sohbetine gecer, etiket ve cipler lab baglamini gosterir', () => {
  const { ctx, ids, sent, frame, fromLab } = setup();
  ctx.axMedLabHook('anatomi', frame);
  assert.equal(JSON.stringify(sent[0]), JSON.stringify([{ type: 'hello', src: 'axhost' }, 'https://acadex.com.tr']), 'hello ayni kaynaga gitmeli');
  assert.match(ids['acadia-context-label'].textContent, /Anatomi Lab · modelden bir yapı seç/);
  assert.equal(ids['btn-acadia-select-card'].disabled, true, 'lab acikken ozet secici kapali');
  assert.match(ids['acadia-messages'].children[0].textContent, /Anatomi Lab’deyim/);
  fromLab({ type: 'ctx', sel: SEL, chips: [['tour', 'Bu bölgeyi bana anlat'], ['inv', 'Hangi sinir innerve eder?']], spot: false });
  assert.match(ids['acadia-context-label'].textContent, /Anatomi Lab · İki başlı kol kası/);
  assert.equal(ids['acadia-lab-chips'].hidden, false);
  assert.match(ids['acadia-lab-chips'].innerHTML, /data-axl-q="tour" class="axl-tour">Bu bölgeyi bana anlat/);
});

test('yapay zekaya giden soruya kart bilgisi eklenir; yapi secili degilse eklenmez', () => {
  const { ctx, frame, fromLab } = setup();
  assert.equal(ctx.axAcadiaPrefix('x'), '', 'lab kapaliyken onek yok');
  ctx.axMedLabHook('anatomi', frame);
  assert.equal(ctx.axAcadiaPrefix('x'), '');
  fromLab({ type: 'ctx', sel: SEL, chips: [], spot: false });
  const p = ctx.axAcadiaPrefix('x');
  assert.match(p, /^\[Acadex Anatomi Lab bağlamı: öğrenci 3B modelde "İki başlı kol kası" \(M\. biceps brachii\)/);
  assert.match(p, /İnervasyon: N\. musculocutaneus/);
  assert.ok(p.endsWith(']\n'));
});

test('baska kaynaktan / baska pencereden gelen lab mesaji yok sayilir', () => {
  const { ctx, ids, frame, fromLab } = setup();
  ctx.axMedLabHook('anatomi', frame);
  fromLab({ type: 'ctx', sel: SEL, chips: [], spot: false }, { postMessage() {} });
  assert.match(ids['acadia-context-label'].textContent, /modelden bir yapı seç/);
  fromLab({ type: 'ctx', sel: SEL, chips: [], spot: false, lab: 'fizyo' });
  assert.match(ids['acadia-context-label'].textContent, /modelden bir yapı seç/, 'acik olmayan labin mesaji');
});

test('spot sinavda Acadia susar, bitince karneyi yorumlar', () => {
  const { ctx, ids, frame, fromLab } = setup();
  ctx.axMedLabHook('anatomi', frame);
  fromLab({ type: 'ctx', sel: null, chips: [], spot: true });
  assert.ok(ctx.document.body.classList.contains('axl-spot'));
  assert.match(ids['acadia-context-label'].textContent, /spot sınav sürüyor/);
  fromLab({ type: 'ctx', sel: null, chips: [], spot: false, spotRes: [{ tr: 'Kol kemiği', la: 'Humerus', ok: true, ans: 'humerus' }, { tr: 'İki başlı kol kası', la: 'M. biceps brachii', ok: false, ans: '' }] });
  assert.ok(!ctx.document.body.classList.contains('axl-spot'));
  const last = ids['acadia-messages'].lastElementChild.textContent;
  assert.match(last, /^Spot bitti: 2 istasyondan 1 doğru\. Kaçırdıkların: İki başlı kol kası \(M\. biceps brachii; boş\)/);
});

test('lab sohbeti lab basina saklanir; lab kapaninca genel sohbet geri gelir', () => {
  const { ctx, ids, ls, frame, fromLab } = setup();
  ctx.axMedLabHook('anatomi', frame);
  fromLab({ type: 'ctx', sel: null, chips: [], spot: true });
  fromLab({ type: 'ctx', sel: null, chips: [], spot: false, spotRes: [{ tr: 'A', la: 'A', ok: true }] });
  const saved = JSON.parse(ls['acadex.labchat.anatomi']);
  assert.equal(saved.length, 2, 'karsilama + karne');
  ctx.axMedLabHook(null);
  assert.equal(ctx.acadiaChatHistory.length, 1);
  assert.equal(ctx.acadiaChatHistory[0].content, 'genel');
  assert.match(ids['acadia-context-label'].textContent, /Bir özet seç/);
  assert.equal(ids['btn-acadia-select-card'].disabled, false);
  const again = setup({ 'acadex.labchat.anatomi': ls['acadex.labchat.anatomi'] });
  again.ctx.axMedLabHook('anatomi', again.frame);
  assert.equal(again.ids['acadia-messages'].children.length, 2, 'kayitli sohbet geri cizilir, yeniden karsilama yok');
  assert.ok(!('acadex.labchat.fizyo' in ls));
});

test('lab cevaplayamazsa (ack yok) soru yapay zekaya gider', async () => {
  const { ctx, frame, fromLab, aiCalls } = setup();
  ctx.axMedLabHook('anatomi', frame);
  fromLab({ type: 'ctx', sel: SEL, chips: [], spot: false });
  const p = ctx.sendAcadiaMessage('evrimsel kökeni ne');
  await new Promise(r => setTimeout(r, 10));
  fromLab({ type: 'reply', id: 'q1', miss: true });
  await p;
  assert.equal(JSON.stringify(aiCalls), '["evrimsel kökeni ne"]');
});

test('lab cevaplarsa yapay zekaya gitmez, cevap ve model cipleri panelde', async () => {
  const { ctx, ids, frame, fromLab, aiCalls, sent } = setup();
  ctx.axMedLabHook('anatomi', frame);
  fromLab({ type: 'ctx', sel: SEL, chips: [], spot: false });
  const p = ctx.sendAcadiaMessage('komşu yapılar');
  await new Promise(r => setTimeout(r, 10));
  const q = sent.find(s => s[0].type === 'ask')[0];
  assert.equal(q.q, 'komşu yapılar');
  fromLab({ type: 'ack', id: q.id });
  assert.equal(ids['acadia-typing-indicator'].style.display, 'block');
  fromLab({ type: 'reply', id: q.id, text: 'İlişkili yapılar ışıklandı: Döner kemik.', show: [{ n: 'Radius.l', t: 'Döner kemik' }] });
  await p;
  assert.deepEqual(aiCalls, []);
  const m = ids['acadia-messages'].children;
  assert.equal(m[m.length - 2].textContent, 'komşu yapılar');
  assert.equal(m[m.length - 1].textContent, 'İlişkili yapılar ışıklandı: Döner kemik.');
  assert.match(m[m.length - 1].children[0].innerHTML, /data-axl-show="Radius\.l">Döner kemik/);
});

summary();
