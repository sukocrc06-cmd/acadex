/* ==========================================================================
   ACADEX — KAYNAKLA ÇALIŞ: ÇALIŞMA ARAÇLARI (tests/kaynak-calis.js), 18.11.2026

   NEDEN VAR: js/acadex-kaynak-calis.js okuma masasına okuma ilerlemesi, kavram haritası,
   kendini sına (test + kartlar) ve telefonda Özet · Belge · Acadia sekmelerini ekler.
   Hepsi kartın mevcut verisiyle çalışır (sections, footnotes, key_terms, concept_graph,
   cloze_cards, quiz_questions); yeni yapay zekâ isteği ya da veritabanı yazması yok.
   Bu dosya şunları korur:
     - sayfaya bağlı; okuma masasından sonra yüklenir; özet her çizildiğinde kurulur
     - harita: concept_graph en az 3 kavramsa ondan, yoksa bölüm → önemli nokta / terimden
     - harita SVG'si NaN içermez; 8 bölümde kutular tuvalin içinde kalır
     - sorular bölüme ve dipnot sayfasına bağlanır (kelime kökü eşleşmesi)
     - boşluk cevabı büyük/küçük harf, yazım hatası ve Türkçe harften bağımsız kabul edilir
     - diyalog body'de (alt menünün altında kalmaz), [hidden] her zaman gizler
     - ağ isteği ve veritabanı yazması yok; yalnız localStorage
   Tarayıcıda (Playwright, masaüstü + telefon, sahte oturumla) denendi.
   Çalıştırma:  node tests/kaynak-calis.js
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
const js = read('js/acadex-kaynak-calis.js'), css = read('css/acadex-kaynak-calis.css'), html = read('dashboard.html');

/* her şeye “evet” diyen sahte DOM: yalnız saf fonksiyonları denemek için */
const sahte = () => new Proxy(function () {}, {
  get(t, k) {
    if (k === 'classList') return { contains: () => true, add() {}, remove() {}, toggle() {} };
    if (k === 'querySelectorAll') return () => [];
    if (k === 'hidden' || k === 'innerHTML' || k === 'textContent') return '';
    if (k === Symbol.toPrimitive) return () => '';
    return sahte();
  },
  apply() { return sahte(); }, set() { return true; }
});
const card = {
  id: 'c1', documents: { file_name: 'Hipotez.pdf' },
  sections: [
    { heading: 'Hipotezlerin kurulması', summary: 'Sıfır hipotezi eşitlik içerir [1].', key_points: ['H0: μ = μ0'] },
    { heading: 'Hata türleri', summary: 'Birinci tip hata olasılığı anlamlılık düzeyidir [2].', key_points: ['α birinci tip hata'] }
  ],
  footnotes: [{ id: 1, page: 3, quote: 'Sıfır hipotezi her zaman eşitlik içerir', reference: 'B1' }, { id: 2, page: 7, quote: 'birinci tip hata olasılığı anlamlılık düzeyi alfa', reference: 'B2' }],
  key_terms: [{ term: 'anlamlılık düzeyi', definition: 'birinci tip hata olasılığı' }],
  cloze_cards: [{ prompt: 'Sıfır hipotezi her zaman ____ içerir.', answer: 'eşitlik', full_text: 'Sıfır hipotezi her zaman eşitlik içerir.' }, { prompt: 'bozuk kart', answer: 'x' }],
  quiz_questions: [{ question: 'Birinci tip hata nedir?', answer: 'Doğru sıfır hipotezini reddetmek; olasılığı anlamlılık düzeyi.' }, { question: 'eksik' }],
  concept_graph: { nodes: [], edges: [] }
};
const win = { matchMedia: () => ({ matches: false }), addEventListener() {}, console };
const doc = { getElementById: () => sahte(), createElement: () => sahte(), body: sahte(), addEventListener() {}, activeElement: null };
win.document = doc;
const ctx = { window: win, document: doc, localStorage: { getItem: () => null, setItem() {} }, Event: function () {}, MutationObserver: undefined, setTimeout, clearTimeout, sourceHubCards: [card], sourceHubActiveCardId: 'c1', console };
vm.createContext(ctx);
vm.runInContext(js, ctx, { filename: 'acadex-kaynak-calis.js' });
const K = win.AXKAYNAK._test;

test('sayfaya bağlı: CSS ve JS okuma masasından sonra; özet çizimine takılır', () => {
  assert.ok(html.indexOf('css/acadex-kaynak-masa.css') < html.indexOf('css/acadex-kaynak-calis.css'));
  assert.ok(html.indexOf('src="js/acadex-ink.js"') < html.indexOf('src="js/acadex-kaynak-calis.js"'));
  assert.ok(html.indexOf('src="js/acadex-kaynak-masa.js"') < html.indexOf('src="js/acadex-kaynak-calis.js"'));
  assert.match(js, /renderSourceHubSummary = window\.__kcRSS/);
});

test('sorular: bozuklar atlanır; bölüme ve dipnot sayfasına bağlanır', () => {
  const L = K.sorular(card);
  assert.equal(L.length, 2);
  const b = L.find((s) => s.tip === 'bosluk'), a = L.find((s) => s.tip === 'acik');
  assert.equal(b.bolum, 0); assert.equal(b.fn.page, 3);
  assert.equal(a.bolum, 1); assert.equal(a.fn.page, 7);
});

test('boşluk cevabı: harf, büyük/küçük ve küçük yazım hatası toleransı; boş ve yanlış reddedilir', () => {
  assert.ok(K.bosDogru('Eşitlik', 'eşitlik'));
  assert.ok(K.bosDogru('esitlik', 'eşitlik'));
  assert.ok(K.bosDogru('anlamlilik duzeyi', 'anlamlılık düzeyi'));
  assert.ok(K.bosDogru('anlamlılık düzeyidir', 'anlamlılık düzeyi'));
  assert.ok(!K.bosDogru('', 'eşitlik'));
  assert.ok(!K.bosDogru('eşitsizlik', 'eşitlik'));
  assert.ok(!K.bosDogru('z', 't') && K.bosDogru('T', 't'));
});

test('harita: concept_graph yoksa bölüm → nokta/terim; varsa kavramlar ve ilişkiler', () => {
  const R = K.haritaVeri(card);
  assert.equal(R.alt.length, 2); assert.equal(R.alt[0].ad, 'Hipotezlerin kurulması');
  assert.ok(R.alt[1].alt.some((k) => k.tur === 'terim' && k.ad === 'anlamlılık düzeyi'));
  const g = Object.assign({}, card, { concept_graph: { nodes: [{ id: 1, label: 'Hipotez' }, { id: 2, label: 'H0' }, { id: 3, label: 'H1' }, { id: 4, label: 'α' }, { id: 5, label: 'p değeri' }], edges: [{ from: 1, to: 2, relation: 'içerir' }, { from: 1, to: 3, relation: 'içerir' }, { from: 2, to: 4, relation: 'hata' }] } });
  const G = K.haritaVeri(g);
  assert.equal(G.ad, 'Hipotez'); assert.ok(G.alt.some((c) => c.ad === 'H0' && c.iliski === 'içerir' && c.alt.some((k) => k.ad === 'α')));
  assert.ok(G.alt.some((c) => c.ad === 'p değeri'), 'bağsız kavram da haritada');
});

test('harita SVG: NaN yok, 8 bölümde kutular tuvalin içinde', () => {
  const secs = Array.from({ length: 8 }, (_, i) => ({ heading: 'Bölüm başlığı oldukça uzun bir ad ' + i, summary: 's', key_points: ['nokta bir uzun açıklama', 'nokta iki', 'nokta üç'] }));
  const svg = K.haritaSvg(K.haritaVeri(Object.assign({}, card, { sections: secs, key_terms: [] })));
  assert.ok(!/NaN|undefined/.test(svg));
  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/), Wd = +vb[1], H = +vb[2];
  [...svg.matchAll(/<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].forEach((m) => {
    assert.ok(+m[1] >= 0 && +m[1] + +m[3] <= Wd && +m[2] >= 0 && +m[2] + +m[4] <= H, m[0]);
  });
});

test('diyalog body\'de, alt menünün üstünde; [hidden] gizler; telefonda üç sekme', () => {
  assert.match(js, /D\.body\.appendChild\(dlg\)/);
  assert.match(css, /#kc-katman\{position:fixed;inset:0;z-index:99\d\d/);
  assert.match(css, /#kc-katman\[hidden\]\{display:none!important\}/);
  assert.match(js, /\['ozet', 'Özet'\], \['belge', 'Belge'\], \['acadia', 'Acadia'\]/);
  assert.match(css, /@media \(max-width:820px\)\{[\s\S]*\.kc-mt\{position:sticky/);
  assert.match(css, /prefers-reduced-motion:no-preference/);
});

test('ağ isteği ve veritabanı yazması yok', () => {
  assert.ok(!/fetch\(|XMLHttpRequest|supabaseClient|\.from\(|functions\.invoke/.test(js));
});

summary();
