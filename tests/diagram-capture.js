/* ==========================================================================
   ACADEX — DIYAGRAM GORSEL YAKALAMA TESTLERI (tests/diagram-capture.js)

   js/dashboard.js icindeki PDF gorsel hazirlama yolunu tarayicisiz test
   eder. Fonksiyonlar kaynaktan calisma aninda cikarilir — kopyalanmaz.

   NEDEN VAR:
   Diyagram gorseli yalnizca kartin MODALI ACIKKEN yakalanabiliyordu. Toplu
   ihracta hicbir kartin modali acik olmadigi icin her diyagram PDF'e metin
   dokumu olarak dusuyordu. Asagidaki testlerin asil olcusu su: modal KAPALI
   iken de bir PNG uretiliyor mu, ve ekran disina kurulan gecici kutu her
   durumda (basarida da, hatada da) DOM'dan temizleniyor mu.

   DOM yok: document, Image ve XMLSerializer bu dosyada kuklalanir.

   Calistirma:  node tests/diagram-capture.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sliceDeclaration, makeRunner } = require('./_ts-extract.js');

const { test, summary } = makeRunner();

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/dashboard.js'), 'utf8');
const NEEDED = [
  'LATEX_SEMBOL', 'LATEX_ALT', 'LATEX_UST', 'LATEX_ASCII', 'latexToUnicode',
  'mermaidPrettyLabels', 'safeMermaidRender',
  'captureCanvasAsImageData', 'captureMermaidSvgAsImageData',
  'captureMermaidSourceAsImageData', 'prepareStudyCardVisualAssets'
];

// ---------------------------------------------------------------------------
// Kukla DOM. Gercek bir tarayici degil — yalnizca bu yolun dokundugu yuzey.
// ---------------------------------------------------------------------------
const PNG = 'data:image/png;base64,KUKLA';
let eklenenler = [];      // body'ye eklenen dugumler (sirayla)
let canliDugumler = [];   // su an body'de duranlar

function fakeSvg() {
  return {
    tagName: 'svg',
    attrs: { xmlns: 'http://www.w3.org/2000/svg' },
    cloneNode() { return fakeSvg(); },
    getAttribute(k) { return this.attrs[k] ?? null; },
    setAttribute(k, v) { this.attrs[k] = v; },
    getBoundingClientRect() { return { width: 640, height: 480 }; }
  };
}

function fakeBox(id) {
  const box = {
    id,
    attrs: {},
    innerHTML: '',
    parentNode: null,
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    querySelector(sel) {
      return (sel === 'svg' && /<svg/.test(this.innerHTML)) ? fakeSvg() : null;
    }
  };
  return box;
}

function installDom() {
  eklenenler = [];
  canliDugumler = [];

  global.document = {
    createElement(tag) {
      if (tag === 'canvas') {
        return {
          width: 0, height: 0,
          getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }),
          toDataURL: () => PNG
        };
      }
      return fakeBox('');
    },
    getElementById(id) {
      return canliDugumler.find(n => n.id === id) || null;
    },
    body: {
      appendChild(node) {
        node.parentNode = global.document.body;
        eklenenler.push(node);
        canliDugumler.push(node);
        return node;
      },
      removeChild(node) {
        canliDugumler = canliDugumler.filter(n => n !== node);
        node.parentNode = null;
        return node;
      }
    }
  };

  global.XMLSerializer = class { serializeToString() { return '<svg></svg>'; } };
  global.Image = class {
    constructor() { this.onload = null; this.onerror = null; this._src = ''; }
    set src(v) { this._src = v; setTimeout(() => { if (this.onload) this.onload(); }, 0); }
    get src() { return this._src; }
  };
  global.window = global.window || {};
}

/** Mermaid kuklasi: gecerli saydigi kaynaklari cizer, digerine false der. */
function installMermaid({ gecerli = () => true } = {}) {
  global.window.mermaid = {
    parse: async (src) => (gecerli(src) ? true : false),
    render: async (_id, src) => {
      if (!gecerli(src)) throw new Error('render patladi');
      return { svg: `<svg data-src="${String(src).length}"></svg>` };
    }
  };
}

installDom();
installMermaid();

const body = NEEDED.map(n => sliceDeclaration(SRC, n)).join('\n\n');
const D = new Function(`${body}\nreturn { ${NEEDED.join(', ')} };`)();

const AKIS = 'flowchart TD\n  A[Baslangic] --> B[Son]';
const KART = (over) => Object.assign({
  id: 'kart-1',
  diagrams: [{ title: 'Karar akisi', mermaid: AKIS }],
  charts: [{ title: 'Dagilim', type: 'bar', labels: ['a', 'b'], data: [1, 2] }]
}, over || {});

/** Her testten once temiz DOM. */
function sifirla(opts) {
  installDom();
  installMermaid(opts);
}

// ===========================================================================
// ASIL KUSUR: modal kapaliyken de diyagram gorseli uretilmeli
// ===========================================================================
test('prepareStudyCardVisualAssets: modal KAPALIYKEN diyagram gorseli uretir', async () => {
  sifirla();
  const assets = await D.prepareStudyCardVisualAssets(KART());
  assert.equal(assets.diagramImages[0], PNG,
    'modal kapaliyken diyagram hala metne dusuyor — toplu ihracin kusuru bu');
});

test('prepareStudyCardVisualAssets: modal kapaliyken grafik gorseli beklenmiyor', async () => {
  // Bilincli sinir: Chart.js ornegini ekran disinda yeniden kurmak ayri bir
  // is. Grafiklerin metin yedegi zaten butun sayilari tasiyor.
  sifirla();
  const assets = await D.prepareStudyCardVisualAssets(KART());
  assert.equal(assets.chartImages[0], undefined);
});

test('prepareStudyCardVisualAssets: cok diyagramli kart icin hepsi uretilir', async () => {
  sifirla();
  const kart = KART({
    diagrams: [
      { mermaid: AKIS },
      { mermaid: 'flowchart LR\n  X[Girdi] --> Y[Cikti]' },
      { mermaid: 'graph TD\n  P[Bir] --> Q[Iki]' }
    ]
  });
  const assets = await D.prepareStudyCardVisualAssets(kart);
  assert.deepEqual([0, 1, 2].map(i => assets.diagramImages[i]), [PNG, PNG, PNG]);
});

test('prepareStudyCardVisualAssets: diyagramsiz kart bos nesne doner, patlamaz', async () => {
  sifirla();
  assert.deepEqual(await D.prepareStudyCardVisualAssets({ id: 'x' }),
    { chartImages: {}, diagramImages: {} });
  assert.deepEqual(await D.prepareStudyCardVisualAssets(null),
    { chartImages: {}, diagramImages: {} });
});

// ===========================================================================
// Gecici kutu: olculebilir olmali ve HER DURUMDA temizlenmeli
// ===========================================================================
test('gecici kutu basarili yakalamadan sonra DOM da kalmaz', async () => {
  sifirla();
  await D.captureMermaidSourceAsImageData(AKIS, 'k-0');
  assert.equal(eklenenler.length, 1, 'tam bir gecici kutu eklenmeliydi');
  assert.equal(canliDugumler.length, 0, 'gecici kutu DOM da birakildi — her ihracta birikir');
});

test('gecici kutu gecersiz kaynaktan sonra da DOM da kalmaz', async () => {
  sifirla({ gecerli: () => false });
  const img = await D.captureMermaidSourceAsImageData('bu gecerli mermaid degil', 'k-1');
  assert.equal(img, null, 'gecersiz kaynaktan gorsel uretilmemeli (metin yedegi devreye girer)');
  assert.equal(canliDugumler.length, 0, 'hata yolunda gecici kutu temizlenmedi');
});

test('gecici kutu display:none DEGIL, ekran disinda konumlanir', () => {
  // display:none bir dugumu yerlesimden cikarir; getBoundingClientRect 0x0
  // doner ve yakalama 1x1 lik bos bir PNG uretir. Bu testin tek isi o
  // regresyonu engellemek.
  const kaynak = sliceDeclaration(SRC, 'captureMermaidSourceAsImageData');
  assert.ok(/left:-10000px/.test(kaynak), 'kutu ekran disina konmuyor');
  assert.ok(!/display:\s*none/.test(kaynak), 'display:none bos PNG uretir');
  assert.ok(/aria-hidden/.test(kaynak), 'gecici kutu erisilebilirlik agacindan gizlenmeli');
});

// ===========================================================================
// Sinir durumlari
// ===========================================================================
test('captureMermaidSourceAsImageData: mermaid yuklu degilse null', async () => {
  sifirla();
  global.window.mermaid = undefined;
  assert.equal(await D.captureMermaidSourceAsImageData(AKIS, 'k-2'), null);
  assert.equal(eklenenler.length, 0, 'cizemeyecekken kutu kurulmamali');
});

test('captureMermaidSourceAsImageData: bos kaynak null, DOM a dokunmaz', async () => {
  sifirla();
  assert.equal(await D.captureMermaidSourceAsImageData('', 'k-3'), null);
  assert.equal(await D.captureMermaidSourceAsImageData(null, 'k-4'), null);
  assert.equal(await D.captureMermaidSourceAsImageData('   ', 'k-5'), null);
  assert.equal(eklenenler.length, 0);
});

test('captureMermaidSvgAsImageData: SVG yoksa null', async () => {
  sifirla();
  assert.equal(await D.captureMermaidSvgAsImageData('olmayan-kutu'), null);
});

test('prepareStudyCardVisualAssets: bir diyagram cizilemese de digerleri gider', async () => {
  // Modelin uc diyagramindan biri bozuk olabiliyor; o birinin PDF in geri
  // kalanini goturmemesi gerek.
  sifirla({ gecerli: (src) => !/BOZUK/.test(String(src)) });
  const kart = KART({
    diagrams: [{ mermaid: AKIS }, { mermaid: 'BOZUK kaynak' }, { mermaid: AKIS }]
  });
  const assets = await D.prepareStudyCardVisualAssets(kart);
  assert.equal(assets.diagramImages[0], PNG);
  assert.equal(assets.diagramImages[1], null, 'bozuk diyagram metin yedegine dusmeli');
  assert.equal(assets.diagramImages[2], PNG);
  assert.equal(canliDugumler.length, 0);
});

summary();
