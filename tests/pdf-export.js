/* ==========================================================================
   ACADEX — PDF IHRACI (tests/pdf-export.js)

   appendStudyCardToDoc u GERCEK jsPDF ile kosturur, uretilen PDF'in metnini
   geri okur ve kartta ne varsa sayfada da oldugunu dogrular.

   NEDEN VAR:
   05.10.2026'da bir kosu worked_examples=2 uretti, tum kapilardan gecirdi,
   veritabanina yazdi — ve PDF ihracinda o alan icin HIC BOLUM YOKTU. Ayni
   sekilde footnotes de yoktu, dolayisiyla gövdeye basilan [1]..[12] atif
   isaretlerinin karsiligi hicbir yerde gorunmuyordu. Hicbir test patlamadi
   cunku hicbir test PDF'in icine bakmiyordu.

   Bu dosya tam o acigi kapatiyor: "uretildi ama ihrac edilmedi" durumunu
   sessiz birakmaz.

   Calistirma:  node tests/pdf-export.js      (jspdf gerekir)
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sliceDeclaration, makeRunner } = require('./_ts-extract.js');

const { test, summary } = makeRunner();

let jsPDFmod;
try {
  jsPDFmod = require('jspdf');
} catch (_e) {
  console.log('jspdf bulunamadi — PDF ihrac testi atlandi (npm i -D jspdf)');
  process.exit(0);
}
const { jsPDF } = jsPDFmod;

// --- dashboard.js'ten PDF yolunu cikar -------------------------------------
// Kopyalamak yerine cikariyoruz: kaynak degisince test ya yeni davranisi
// olcer ya ACIK HATA verir (bkz. _ts-extract.js bas yorumu).
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/dashboard.js'), 'utf8');
const NEEDED = [
  'PDF_INK', 'replaceTurkishChars', 'pdfSetFont', 'pdfText', 'getStyleLabel',
  // LaTeX -> Unicode donusturucu ve tablolari (08.10.2026).
  'LATEX_SEMBOL', 'LATEX_ALT', 'LATEX_UST', 'LATEX_ASCII', 'latexToUnicode',
  'drawPdfTable', 'drawChartDataFallback', 'drawMermaidSourceFallback',
  'drawPdfCard', 'appendStudyCardToDoc'
];
const body = NEEDED.map(n => sliceDeclaration(SRC, n)).join('\n\n');
const { appendStudyCardToDoc, latexToUnicode } = new Function(
  `${body}\nreturn { appendStudyCardToDoc, latexToUnicode };`
)();

/** Uretilen PDF'i pdftotext ile metne cevirip doner. */
function pdfToText(doc) {
  const tmp = path.join(__dirname, '.pdf-export-fixture.pdf');
  fs.writeFileSync(tmp, Buffer.from(doc.output('arraybuffer')));
  try {
    const { execFileSync } = require('node:child_process');
    return execFileSync('pdftotext', ['-layout', tmp, '-'], { encoding: 'utf8' });
  } finally {
    fs.unlinkSync(tmp);
  }
}

function render(card) {
  const doc = new jsPDF();
  // unicodeReady=false: gomulu font yok, pdfText ASCII'ye dusuruyor. Bolumun
  // VAR OLUP OLMADIGINI test ediyoruz, Turkce glif isleme degil.
  appendStudyCardToDoc(doc, card, false, null);
  return pdfToText(doc);
}

// Her alani dolu, gercekci bir kart. Alanlarin sekilleri
// summarize-document/index.ts icindeki normalize* fonksiyonlarindan.
const FULL_CARD = {
  created_at: '2026-10-05T18:00:00Z',
  summary_style: 'standard',
  summary_language: 'en',
  documentFileName: 'economy chapter 20.pdf',
  summary: 'Macroeconomics concerns output growth, unemployment and inflation. [1] The business cycle alternates between expansion and contraction. [2]',
  sections: [
    { heading: 'The Business Cycle', summary: 'Expansion, peak, contraction and trough.', key_points: ['A recession is two consecutive quarters of decline.'], order: 1 },
    { heading: 'Policy Instruments', summary: 'Fiscal and monetary policy.', key_points: ['The Fed sets short-term rates.'], order: 2 }
  ],
  key_terms: [
    { term: 'recession', definition: 'Two consecutive quarters of declining output.' },
    { term: 'stagflation', definition: 'High inflation together with high unemployment.' }
  ],
  key_points: ['Output, employment and prices move together. [1]'],
  quiz_questions: [{ question: 'What is a recession?', answer: 'Two consecutive quarters of declining output.' }],
  formulas: [
    { name: 'Aggregate expenditure', latex: 'Y = C + I + G + NX', variables: [{ symbol: 'Y', meaning: 'aggregate output' }, { symbol: 'C', meaning: 'consumption' }] }
  ],
  worked_examples: [
    {
      title: 'Identifying a recession',
      problem_statement: 'Real GDP falls for two quarters running. Is this a recession?',
      steps: ['Check the definition: two consecutive quarters of decline.', 'Both quarters declined.'],
      final_answer: 'Yes, it meets the definition.'
    }
  ],
  tables: [],
  charts: [],
  diagrams: [],
  cloze_cards: [
    { id: 'cl1', prompt: 'A ___ is two consecutive quarters of declining output.', answer: 'recession', source: 'key_point' },
    { id: 'cl2', prompt: '___: High inflation together with high unemployment.', answer: 'stagflation', source: 'key_term' }
  ],
  footnotes: [
    { id: 1, reference: 'Chapter 20, introduction', page: 1 },
    { id: 2, reference: 'Figure 20.2, aggregate output', page: 4 }
  ]
};

test('PDF, kartin her bolumunu basiyor', () => {
  const txt = render(FULL_CARD);
  // Bolum etiketleri. unicodeReady=false oldugu icin Turkce harfler
  // sadelestiriliyor; o yuzden ASCII'ye dayanikli parcalari ariyoruz.
  const expected = [
    ['ozet', /OZET|ÖZET/],
    ['bolum ozetleri', /BOLUM OZETLER|BÖLÜM ÖZETLER/],
    ['anahtar terimler', /ANAHTAR TER/],
    ['onemli noktalar', /ONEMLI NOKTA|ÖNEMLİ NOKTA/],
    ['sinav sorulari', /SINAV SORU/],
    ['formuller', /FORMULLER|FORMÜLLER/],
    ['cozumlu ornekler', /COZUMLU ORNEK|ÇÖZÜMLÜ ÖRNEK/],
    ['bosluk doldurma', /BOSLUK DOLDURMA|BOŞLUK DOLDURMA/],
    ['kaynaklar', /KAYNAKLAR/]
  ];
  const eksik = expected.filter(([, re]) => !re.test(txt)).map(([ad]) => ad);
  assert.equal(eksik.length, 0, `PDF'te olmayan bolum(ler): ${eksik.join(', ')}`);
});

test('uretilen icerik gercekten sayfada', () => {
  const txt = render(FULL_CARD);
  const eksik = [];
  // Her bolumden, o bolume OZGU bir icerik parcasi — baslik basilip govdenin
  // bos kalmasi da bir hata bicimi.
  const probes = {
    'bolum basligi': 'The Business Cycle',
    'bolum alt maddesi': 'two consecutive quarters of decline',
    'formul adi': 'Aggregate expenditure',
    'formul latex': 'Y = C + I + G + NX',
    'formul degiskeni': 'aggregate output',
    'ornek problemi': 'Real GDP falls for two quarters',
    'ornek adimi': 'Both quarters declined',
    'ornek sonucu': 'meets the definition',
    'dipnot metni': 'Figure 20.2, aggregate output'
  };
  for (const [ad, parca] of Object.entries(probes)) {
    if (!txt.includes(parca)) eksik.push(`${ad} ("${parca}")`);
  }
  assert.equal(eksik.length, 0, `basilmayan icerik:\n  ${eksik.join('\n  ')}`);
});

test('dipnot numaralari govdedeki isaretlerle ayni', () => {
  /* Asil amac bu: govdeye [1], [2] basilip karsiliginin hicbir yerde
     olmamasi, 05.10.2026 ekonomi kosusunda 12 olu atif uretmisti. */
  const txt = render(FULL_CARD);
  const govdeIsaretleri = new Set((txt.match(/\[(\d+)\]/g) || []).map(s => s.slice(1, -1)));
  assert.ok(govdeIsaretleri.size > 0, 'test karti atif isareti tasimali');
  // Bolumun VARLIGINI once dogrula: yoksa search() -1 doner, slice(-1) de tek
  // karakter verir ve test sasirtici bir yerde patlar. Bir de ilk kosusta
  // etiketi "KAYNAKLAR_SILINDI" yapinca bu regex yine eslesip testi yesil
  // birakti — tam eslesmeyi sart kosmak o aciklik.
  const basi = txt.search(/^\s*KAYNAKLAR\s*$/m);
  assert.notEqual(basi, -1, 'KAYNAKLAR bolumu hic basilmamis');
  const kaynakBolumu = txt.slice(basi);
  for (const n of govdeIsaretleri) {
    assert.ok(
      new RegExp(`\\[${n}\\]`).test(kaynakBolumu),
      `[${n}] govdede var ama KAYNAKLAR bolumunde yok — olu atif`
    );
  }
});

test('sayfa numarasi dogrulanmamis dipnot "s. null" basmiyor', () => {
  // Capalama, dogrulayamadigi sayfayi bilerek null'a dusuruyor; "s. null"
  // basmak o durusu bozar.
  const txt = render({
    ...FULL_CARD,
    footnotes: [{ id: 1, reference: 'Kaynagi dogrulanamayan not', page: null }]
  });
  assert.ok(txt.includes('Kaynagi dogrulanamayan not'), 'not yine de basilmali');
  assert.ok(!/s\.\s*null/i.test(txt), '"s. null" basilmamali');
  assert.ok(!/\(s\.\s*\)/.test(txt), 'bos sayfa parantezi basilmamali');
});

test('bos/eksik alanlar bolum basligi uretmiyor', () => {
  // Bir alan yoksa basligi da olmamali — "FORMULLER" yazip altini bos
  // birakmak, hic basmamaktan kotu.
  const txt = render({
    ...FULL_CARD,
    sections: [], formulas: [], worked_examples: [], footnotes: [],
    cloze_cards: []
  });
  for (const [ad, re] of [
    ['BOLUM OZETLERI', /BOLUM OZETLER|BÖLÜM ÖZETLER/],
    ['FORMULLER', /FORMULLER|FORMÜLLER/],
    ['COZUMLU ORNEKLER', /COZUMLU ORNEK|ÇÖZÜMLÜ ÖRNEK/],
    ['KAYNAKLAR', /KAYNAKLAR/],
    ['BOSLUK DOLDURMA', /BOSLUK DOLDURMA|BOŞLUK DOLDURMA/]
  ]) {
    assert.ok(!re.test(txt), `${ad} basligi bos alanda basilmamali`);
  }
  // Dolu olanlar yine basilmali.
  assert.ok(/ANAHTAR TER/.test(txt), 'dolu bolumler etkilenmemeli');
});

test('bozuk/yarim alanlar PDF uretimini patlatmiyor', () => {
  // Model her zaman tam sekil dondurmez. Ihrac, eksik alanla cokmek yerine
  // elindekini basmali.
  const txt = render({
    created_at: '2026-10-05T18:00:00Z',
    documentFileName: 'bozuk.pdf',
    summary: 'Kisa ozet.',
    sections: [{ heading: 'Basligi var, ozeti yok' }, null, { summary: 'ozeti var, basligi yok' }],
    formulas: [{ name: 'Adi var, latexi yok' }, { latex: 'a=b' }, null],
    worked_examples: [{ title: 'Adimsiz ornek' }, { steps: ['tek adim'] }, null],
    footnotes: [{ reference: 'id siz dipnot' }, null, { id: 5 }],
    key_terms: [], key_points: [], quiz_questions: [],
    tables: [], charts: [], diagrams: [], cloze_cards: []
  });
  assert.ok(txt.includes('Kisa ozet.'), 'ozet basilmali');
  // id'si olmayan dipnot sirasindan numara almali, "[undefined]" olmamali.
  assert.ok(!/\[undefined\]|undefined/.test(txt), `"undefined" basilmamali:\n${txt.slice(0, 400)}`);
});

/* ==========================================================================
   SUNUCU HATA MESAJI — kullaniciya ULASIYOR mu
   ========================================================================== */
const DASH_SRC = fs.readFileSync(path.join(__dirname, '..', 'js/dashboard.js'), 'utf8');
const { serverErrorMessage } = new Function(
  sliceDeclaration(DASH_SRC, 'serverErrorMessage') + '\nreturn { serverErrorMessage };'
)();

const sahteHata = (govde, status = 503) => ({
  context: { status, text: async () => govde }
});

test('sunucunun kendi hata mesaji gosteriliyor', async () => {
  /* supabase-js 2xx olmayan govdeyi `data`ya koymaz; FunctionsHttpError
     firlatir ve govde `error.context` icindeki ham Response'ta kalir, yani
     bilerek okunmasi gerekir. Ozet yolu bunu hep yapiyordu, sohbet yollari
     hic yapmiyordu ve sunucunun mesajini cope atiyordu.

     Kozmetik degil: chat-with-document gunluk kota bitisini anlik
     yogunluktan AYIRIYOR, cunku "biraz sonra tekrar dene" dogru cevap
     "yarin" iken yanlistir ve ogrenciyi yarim saat bosuna denemeye iter.
     05.10.2026'da TPD dolmusken sorulan soru tam da o genel mesaji aldi:
     sunucu dogru cumleyi yazmisti, ekran yanlisiyla degistirdi. */
  const kota = 'Bugünkü AI kotamız doldu — yarın tekrar deneyebilirsin.';
  const sonuc = await serverErrorMessage(sahteHata(JSON.stringify({ error: kota })), 'genel mesaj');
  assert.equal(sonuc, kota);
});

test('govde bos/bozuksa cagiranin mesaji kullaniliyor', async () => {
  // Govdeyi okurken olusan bir hata, HATANIN KENDISINI yutmamali.
  for (const govde of ['', 'JSON degil', '{}', '{"error":""}', '{"error":"   "}']) {
    const sonuc = await serverErrorMessage(sahteHata(govde), 'genel mesaj');
    assert.equal(sonuc, 'genel mesaj', `govde ${JSON.stringify(govde)} icin yedek mesaj beklenirdi`);
  }
  assert.equal(await serverErrorMessage(null, 'genel mesaj'), 'genel mesaj');
  assert.equal(await serverErrorMessage({}, 'genel mesaj'), 'genel mesaj');
});

test('her iki sohbet yolu da sunucu mesajini okuyor', () => {
  // Iki ayri sohbet var (Kaynakla Calis ve Bilgi Karti) ve ikisi de ayni
  // sabit mesaji tasiyordu; birini duzeltip otekini unutmak kolaydi.
  const cagri = (DASH_SRC.match(/await serverErrorMessage\(error, isTr/g) || []).length;
  assert.ok(cagri >= 2, `her iki sohbet yolu da okumali, bulunan: ${cagri}`);

  // Olcut SUNUCU HATASI dalinda helper kullanilmasi — "bu metin hicbir yerde
  // gecmesin" degil. Ilk yazdigimda genis tutmustum ve `catch` blogundaki
  // sabit mesaji yakaladi; orasi ag hatasi icin ve orada okunacak bir sunucu
  // govdesi YOK, yani genel mesaj dogru olan. Test yanlis yeri gosteriyordu.
  const dallar = [...DASH_SRC.matchAll(/console\.error\('chat-with-document invocation failed[^\n]*\n/g)];
  assert.ok(dallar.length >= 2, `iki sohbet yolunun hata dali bulunmali, bulunan: ${dallar.length}`);
  for (const d of dallar) {
    const sonrasi = DASH_SRC.slice(d.index, d.index + 400);
    assert.ok(/serverErrorMessage\(error/.test(sonrasi),
      `bu hata dali sunucu mesajini okumuyor:\n${sonrasi.slice(0, 200)}`);
  }
});

test('formuller HAM LATEX olarak basilmiyor', () => {
  /* 08.10.2026, canli bir ekonometri destesinin ozetinde olculdu. PDF'in
     FORMULLER bolumu aynen soyle cikiyordu:

       y = \beta_0 + \beta_1 x + \beta_2 x^2 + \varepsilon
       \frac{\partial y}{\partial x}=\beta_1+2\beta_2 x
       \beta_0 = Intercept

     Cikarim tarafinda sorun YOK — prompt "valid raw LaTeX ONLY" istiyor ve
     dogrusunu uretmis. Bozuk olan GOSTERIM, ve yalnizca PDF yolunda:
     ekranda KaTeX yuklu ve render ediyor, PDF yolu latex alanini dogrudan
     doc.text'e veriyordu. Bir ekonometri ogrencisi icin bu, kartin en
     gorunur kusuru. */
  const kart = JSON.parse(JSON.stringify(FULL_CARD));
  kart.formulas = [{
    name: 'Kuadratik regresyon',
    latex: 'y = \\beta_0 + \\beta_1 x + \\beta_2 x^2 + \\varepsilon',
    variables: [
      { symbol: '\\beta_0', meaning: 'sabit terim' },
      { symbol: '\\varepsilon', meaning: 'hata terimi' },
    ],
  }, {
    name: 'Marjinal etki',
    latex: '\\frac{\\partial y}{\\partial x}=\\beta_1+2\\beta_2 x',
    variables: [],
  }];
  const txt = render(kart);

  // Ham LaTeX komutu sayfada GORUNMEMELI.
  for (const ham of ['\\beta', '\\varepsilon', '\\frac', '\\partial']) {
    assert.ok(!txt.includes(ham), `ham LaTeX sayfada: "${ham}"`);
  }
  /* Ve KARSILIGI gorunmeli — yoksa "hicbir sey basma" da bu testi gecerdi.
     render() unicodeReady=FALSE ile kosuyor (gomulu font yok), ve o modda
     dogru cikti Yunan harfi DEGIL okunur ASCII: jsPDF'in helvetica'si "β"
     verildiginde sayfaya hicbir sey dusurmuyor. Ilk yazimda "β" bekledim
     ve test hakli olarak dustu. */
  for (const beklenen of ['beta', 'eps']) {
    assert.ok(txt.includes(beklenen), `okunur karsilik basilmamis: "${beklenen}"`);
  }
  // Degisken listesi de donusturulmeli: "\beta_0 = sabit terim" olmamali.
  assert.ok(/beta_0\s*=\s*sabit terim/.test(txt),
    'degisken sembolleri hala ham LaTeX');
});

test('Unicode font VARKEN gercek matematik glifleri basiliyor', () => {
  /* Yukaridaki test fontsuz yolu kapsiyor. Asil hedef bu: gomulu DejaVu
     yuklendiginde ogrenci "β₀" gorur, "beta_0" degil. Donusturucu dogrudan
     cagrilir — jsPDF'e gomulu font yuklemek bu testin isi degil. */
  const f = (s) => latexToUnicode(s, true);
  assert.equal(f('y = \\beta_0 + \\beta_1 x + \\beta_2 x^2 + \\varepsilon'),
    'y = β₀ + β₁ x + β₂ x² + ε');
  assert.equal(f('\\ln y = \\beta_0 + \\beta_1 \\ln x'), 'ln y = β₀ + β₁ ln x');
  assert.ok(/∂/.test(f('\\frac{\\partial y}{\\partial x}')), 'kismi turev isareti');
  assert.ok(/≈/.test(f('\\Delta y \\approx 100\\beta_1')), 'yaklasik isareti');
});

test('fontsuz modda ham LaTeX kalmiyor, ters bolu da kalmiyor', () => {
  // Her iki modda da ogrenci ters bolu gormemeli.
  for (const mod of [true, false]) {
    const cikti = latexToUnicode('\\frac{\\Delta y}{y}=\\beta_1 \\frac{\\Delta x}{x}', mod);
    assert.ok(!cikti.includes('\\'), `mod=${mod}: ters bolu kaldi — "${cikti}"`);
  }
});

test('donusturucu tanimadigi seyi BOZMUYOR', () => {
  // Kapsam dar: tam bir LaTeX motoru degil. Tanimadigi bir yapiyi
  // okunmaz hale getirmektense oldugu gibi birakmasi yeglenir.
  const kart = JSON.parse(JSON.stringify(FULL_CARD));
  kart.formulas = [{ name: 'Duz metin', latex: 'Y = C + I + G + NX', variables: [] }];
  const txt = render(kart);
  assert.ok(txt.includes('Y = C + I + G + NX'), 'LaTeX olmayan formul degismemeli');
});

summary().then(() => process.exit(process.exitCode || 0));
