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
  'mermaidPrettyLabels',
  // Cozumlu ornek adimlari, para birimi, ozet paragraflari (09.10.2026).
  'escapeHtml', 'normalizeWorkedSteps', 'splitStepCalc', 'prettyCalc', 'splitCalcChain',
  'renderMathInText', 'renderWorkedStepHtml', 'acikVurgu', 'OZET_KISALTMA_RE', 'summaryParagraphs', 'inlineMarkdown',
  'stripInlineMarkdown',
  'drawPdfTable', 'drawChartDataFallback', 'drawMermaidSourceFallback',
  'drawPdfCard', 'appendStudyCardToDoc'
];
const body = NEEDED.map(n => sliceDeclaration(SRC, n)).join('\n\n');
// renderMathInText window.katex'e bakiyor; sahte KaTeX neyi matematik
// saydigini gorunur kilar.
global.window = global.window || {};
const {
  appendStudyCardToDoc, latexToUnicode, mermaidPrettyLabels,
  normalizeWorkedSteps, splitStepCalc, prettyCalc, splitCalcChain, renderMathInText,
  renderWorkedStepHtml, summaryParagraphs, inlineMarkdown, stripInlineMarkdown
} = new Function(
  `${body}\nreturn { appendStudyCardToDoc, latexToUnicode, mermaidPrettyLabels, normalizeWorkedSteps, splitStepCalc, prettyCalc, splitCalcChain, renderMathInText, renderWorkedStepHtml, summaryParagraphs, inlineMarkdown, stripInlineMarkdown };`
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
  outline: {
    document_title_guess: 'Chapter 20 — Introduction to Macroeconomics',
    items: [
      { id: 'o1', heading: 'What Macroeconomics Studies', blurb: 'Output, unemployment, inflation.', level: 1, order: 1 },
      { id: 'o2', heading: 'Output growth', blurb: '', level: 2, order: 2 },
      { id: 'o3', heading: 'The Business Cycle', blurb: 'Expansion, peak, contraction, trough.', level: 1, order: 3 }
    ]
  },
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

test('SAPKA isareti iki yazimda da calisiyor', () => {
  /* Ekonometride her yerde: β̂, ŷ. Iki bicimde geliyor — duzgun LaTeX
     (\hat{\beta}_0) ve modelin canli diyagramda yazdigi kisa bicim
     (β^_0). Ikisi de ayni sonuca varmali. */
  assert.equal(latexToUnicode('\\hat{\\beta}_1 = 0.69', true), 'β̂₁ = 0.69');
  assert.equal(latexToUnicode('β^_0', true), 'β̂₀');
  // Fontsuz modda birlestirici isaret ASCII harfe oturup "betâ" uretiyordu.
  assert.ok(!/̂/.test(latexToUnicode('\\hat{\\beta}_1', false)),
    'fontsuz modda birlestirici sapka kalmamali');
});

test('MERMAID etiketleri donusturuluyor, dugum kimlikleri DEGIL', () => {
  /* 08.10.2026: FORMULLER bolumu duzeldikten sonra bile diyagram kutulari
     "y_i = β_0 + β_1x_1,i" diye duruyordu — latexToUnicode yalnizca
     formulas dizisine uygulaniyordu.

     Kritik sinir: butun kaynagi donusturmek dugum KIMLIKLERINI de bozar
     ("A_1" -> "A₁" gecerli bir Mermaid kimligi degil) ve diyagram tamamen
     kaybolur. Yalnizca [...] ve |...| icine dokunulmali. */
  const src = 'flowchart TD\n' +
    '  A_1[y_i = β_0 + β_1x_1,i + ε_i]\n' +
    '  B_2[ŷ_i = β^_0 + β^_1x_1,i]\n' +
    '  A_1 --> B_2';
  const out = mermaidPrettyLabels(src);

  // Etiket ici donustu.
  assert.ok(/yᵢ = β₀ \+ β₁x₁,i \+ εᵢ/.test(out), `etiket donusmedi:\n${out}`);
  assert.ok(/β̂₀/.test(out), 'sapka uygulanmadi');
  // Dugum kimlikleri ve ok DEGISMEDI.
  assert.ok(/A_1\[/.test(out), 'dugum kimligi bozulmus — diyagram kaybolur');
  assert.ok(/B_2\[/.test(out), 'dugum kimligi bozulmus');
  assert.ok(/A_1 --> B_2/.test(out), 'kenar tanimi bozulmus');
});

test('cok satirli etiketler ATLANMIYOR', () => {
  // Ilk yazimda <br/> iceren etiketleri korumaya almistim — oysa cok
  // satirli etiketler tam olarak formullerin yasadigi yer, yani asil
  // hedefi kaciriyordum.
  const out = mermaidPrettyLabels('A[Model<br/>y_i = β_0 + ε_i]');
  assert.ok(/yᵢ = β₀ \+ εᵢ/.test(out), `cok satirli etiket atlandi: ${out}`);
  assert.ok(out.includes('<br/>'), 'satir sonu etiketi korunmali');
});

test('Mermaid ok isareti tasiyan etikete dokunulmuyor', () => {
  const src = 'flowchart TD\n  A --> B\n  C --- D';
  assert.equal(mermaidPrettyLabels(src), src, 'yapisal satirlar degismemeli');
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


test('SINAV SORULARI ve DEGISKEN aciklamalari da donusuyor', () => {
  /* 08.10.2026, canli ciktidan: FORMULLER bolumu duzelmisti ama ayni
     sayfadaki sinav sorulari ham kaliyordu
       "ln Bill = 9.0 + 0.08*Temp - 0.0012*Temp^2"
     ve degisken aciklamalari ham LaTeX tasiyordu
       "Slope for x_{1}"   "(if \beta_{2}<0)"
     Ogrenci icin ikisi de ayni sayfada ve ayni gozle okunuyor. Donusum
     artik safeText'te, yani bu dosyadaki TEK metin hunisinde. */
  const kart = JSON.parse(JSON.stringify(FULL_CARD));
  kart.quiz_questions = [{
    question: 'If the model is UtilityBill = 9.0 + 0.08*Temp - 0.0012*Temp^2, find the minimum.',
    answer: 'Set \\frac{dy}{dx} = 0.',
  }];
  kart.formulas = [{
    name: 'Extremum',
    latex: 'x^* = -\\frac{\\beta_{1}}{2\\beta_{2}}',
    variables: [
      { symbol: '\\beta_1', meaning: 'Slope for x_{1}' },
      { symbol: 'x^*', meaning: 'maximum if \\beta_{2}<0' },
    ],
  }];
  const txt = render(kart);

  /* render() unicodeReady=FALSE ile kosuyor (gomulu font yok) ve o modda
     ust/alt simge glifleri uretilmiyor — ucuncu kez ayni tuzaga dustum.
     Fontsuz modda aranan sey HAM LATEX'in kalmamasi; gercek glif donusumu
     asagida dogrudan dogrulaniyor. */
  assert.ok(!/\\frac/.test(txt), 'cevapta ham \\frac kalmis');
  assert.ok(!/\\beta/.test(txt), 'degisken aciklamasinda ham \\beta kalmis');
  assert.ok(!/x_\{1\}/.test(txt), 'ham x_{1} kalmis');

  // Unicode font VARKEN gercek glifler: ogrencinin gordugu hal bu.
  assert.ok(latexToUnicode('UtilityBill = 9.0 + 0.08*Temp - 0.0012*Temp^2', true)
    .includes('Temp²'), 'us donusumu calismiyor');
  assert.equal(latexToUnicode('Slope for x_{1}', true), 'Slope for x₁');
  assert.equal(latexToUnicode('maximum if \\beta_{2}<0', true), 'maximum if β₂<0');
});

test('IC ICE suslu parantezli \\frac cozuluyor', () => {
  /* Canli ciktida "x^*= -fracβ₁2β₂" goruluyordu: hem bolu cizgisi hem
     parantezler kayip. Sebep sira idi — \frac, alt simgelerden ONCE
     kosuyordu ve \frac{\beta_{1}}{2\beta_{2}} icindeki {1}/{2} [^{}]*
     kalibini kiriyordu. */
  const cikti = latexToUnicode('x^* = -\\frac{\\beta_{1}}{2\\beta_{2}}', true);
  assert.ok(!/frac/.test(cikti), `frac cozulmemis: ${cikti}`);
  assert.ok(cikti.includes('/'), `bolu cizgisi yok: ${cikti}`);
  assert.ok(/β₁/.test(cikti) && /β₂/.test(cikti), `alt simgeler yok: ${cikti}`);
  assert.ok(!/\^/.test(cikti), `x^* sadelesmemis: ${cikti}`);
});

test('DUZ METIN bozulmuyor (snake_case korunur)', () => {
  /* Donusum artik her metne uygulandigi icin bu sinir kritik. Ilk yazimda
     sinir (?![A-Za-z]) idi ve zincirli alt simgeleri kacirdi
     ("β_kx_k,i"); esik iki harfe cekildi. */
  assert.equal(latexToUnicode('sample_size ve key_points', true),
    'sample_size ve key_points');
  assert.equal(latexToUnicode('Normal bir cumle, matematik yok.', true),
    'Normal bir cumle, matematik yok.');
  assert.ok(/βₖxₖ/.test(latexToUnicode('β_kx_k,i', true)),
    'zincirli alt simge donusmeli');
});

test('donusum IDEMPOTENT', () => {
  // safeText her metne uyguluyor, formul yolu ayrica acikca cagiriyor —
  // yani bazi metinler iki kez geciyor.
  for (const o of ['y = \\beta_0 + x^2', 'x^* = -\\frac{\\beta_{1}}{2\\beta_{2}}', 'Duz cumle.']) {
    const bir = latexToUnicode(o, true);
    assert.equal(latexToUnicode(bir, true), bir, `idempotent degil: ${o}`);
  }
});


console.log('\nCOZUMLU ORNEK GORUNUMU, PARA BIRIMI, OZET PARAGRAFLARI\n');

/* 09.10.2026, kullanicinin ekran goruntusu: bes adim tek maddede, hesaplar
   metnin icinde, ve "Sonuc" satirinda iki dolar isaretinin arasi KaTeX'e
   matematik diye gitmis. Ornek, canli karttaki adim dizgisinin aynisi. */
const EKRAN_ADIMLARI = ['1. Estimate model: UtilityBill = β0 + β1 Temp + β2 Temp^2 + ε. 2. Obtain coefficients: β1 = -9.0, β2 = 0.1212. 3. Compute marginal effect: dY/dTemp = β1 + 2β2 Temp. 4. At Temp=40: dY/dTemp = -9.0 + 2(0.1212)(40) = -5.06. 5. At Temp=80: dY/dTemp = -9.0 + 2(0.1212)(80) = 2.14.'];

test('eski kartin tek dizgi adimlari bes ayri adim, numarasiz', () => {
  const a = normalizeWorkedSteps(EKRAN_ADIMLARI);
  assert.equal(a.length, 5, JSON.stringify(a));
  assert.ok(a.every(x => !/^\d+\.\s/.test(x)));
  assert.deepEqual(normalizeWorkedSteps(['1. A x.', '2. B y.']), ['A x.', 'B y.']);
  assert.deepEqual(normalizeWorkedSteps(['β2 = 0.1212. Then compute.']), ['β2 = 0.1212. Then compute.']);
});

test('adim aciklama + hesap satirina ayriliyor', () => {
  assert.deepEqual(splitStepCalc('At Temp=40: dY/dTemp = -9.0 + 2(0.1212)(40) = -5.06.'),
    { label: 'At Temp=40', calc: 'dY/dTemp = -9.0 + 2(0.1212)(40) = -5.06' });
  assert.deepEqual(splitStepCalc('Interpret: weeks with a holiday sell 15 more pies.'),
    { label: 'Interpret: weeks with a holiday sell 15 more pies.', calc: '' });
  assert.equal(splitStepCalc('-12.08 + 2(0.09)(39) = -12.08 + 7.02 = -5.06').calc,
    '-12.08 + 2(0.09)(39) = -12.08 + 7.02 = -5.06');
});

test('hesap satiri matematik gibi yaziliyor', () => {
  assert.equal(prettyCalc('-12.08 + 2(0.09)(39) = -12.08 + 7.02 = -5.06'),
    '−12.08 + 2(0.09)(39) = −12.08 + 7.02 = −5.06');
  assert.equal(prettyCalc('UtilityBill = β0 + β1 Temp + β2 Temp^2 + ε'),
    'UtilityBill = β₀ + β₁ Temp + β₂ Temp² + ε');
  assert.equal(prettyCalc('β1 + 2β2*39'), 'β₁ + 2β₂ × 39');
  // "log-log" gibi kelimelerdeki tire eksi isaretine donmez.
  assert.equal(prettyCalc('log-log: 0.69'), 'log-log: 0.69');
  const satirlar = splitCalcChain(prettyCalc('484.12 - 12.08(67.11) + 0.09(67.11)^2 = 484.12 - 810.69 + 405.34 = 78.77'));
  assert.ok(satirlar.length === 3 && satirlar[1].startsWith('= ') && satirlar[2] === '= 78.77', JSON.stringify(satirlar));
  // Ikili eksi de eksi isareti olur.
  assert.equal(satirlar[0], '484.12 − 12.08(67.11) + 0.09(67.11)²');
  // Yalniz bir ad ilk satirda tek basina kalmaz.
  assert.deepEqual(splitCalcChain('temp* = −(−12.08)/(2(0.09)) = 12.08/0.18 = 67.11'),
    ['temp* = −(−12.08)/(2(0.09))', '= 12.08/0.18', '= 67.11']);
});

test('adim HTML: hesap ayri kutuda, uzun zincir satirlara bolunmus', () => {
  const h = renderWorkedStepHtml('Bill there: 484.12 - 12.08(67.11) + 0.09(67.11)^2 = 484.12 - 810.69 + 405.34 = 78.77');
  assert.ok(/<span class="ws-label">Bill there<\/span><div class="ws-calc">/.test(h), h);
  assert.equal((h.match(/ws-calc-line/g) || []).length, 3);
  assert.ok(/<li class="ws-step"><span class="ws-label">Interpret/.test(renderWorkedStepHtml('Interpret the sign.')));
});

test('PARA BIRIMI matematik sayilmiyor, gercek matematik sayiliyor', () => {
  const cagrilar = [];
  window.katex = { renderToString: (tex) => { cagrilar.push(tex); return `<k>${tex}</k>`; } };
  try {
    const metin = 'At 40°F the bill decreases by $5.06 per degree; at 80°F it increases by $2.14 per degree.';
    assert.equal(renderMathInText(metin), metin.replace(/'/g, '&#39;'));
    assert.equal(cagrilar.length, 0, `para birimi KaTeX'e gitti: ${cagrilar}`);
    assert.equal(renderMathInText('costs $5 and $10 each'), 'costs $5 and $10 each');
    assert.ok(renderMathInText('slope $\\beta_1$ here').includes('<k>\\beta_1</k>'));
    assert.ok(renderMathInText('$x^2$ and $y$').includes('<k>x^2</k>'));
  } finally {
    delete window.katex;
  }
});

test('ozet paragraflari: kalin giris ayrisiyor', () => {
  const p = summaryParagraphs('**Dummy variables shift the intercept.** A qualitative variable…\n\n**Interactions change the slope.** Multiplying x by a dummy…');
  assert.equal(p.length, 2);
  assert.deepEqual(p[0], { lead: 'Dummy variables shift the intercept.', body: 'A qualitative variable…' });
});

test('TEK BLOK eski ozet bolunuyor — tek karakter dusmeden', () => {
  // Canli ozet 2'nin ilk ~1.100 karakteri (tek paragraf).
  const blok = 'This brief presents a concise guide to extending linear regression for categorical predictors, non-linear relationships, and interaction effects. It begins with a thesis that effective regression modeling requires appropriate encoding of categorical variables. The Dummy Variables section explains encoding a k-level categorical variable with k-1 binary dummies, where the omitted level serves as the reference. The Interaction Effects section shows how adding a product term between a dummy and a continuous predictor alters the slope; the marginal effect becomes β₁+β₃·D. The Polynomial section introduces the model y=β₀+β₁x+β₂x², derives the marginal effect β₁+2β₂x, identifies the minimizing x* = –β₁/(2β₂), and the bill of 484.12 dollars. Finally, the *Population vs. Sample Regression* section reminds readers that the true population model is unknown. Overall, the brief equips students with practical coding strategies and interpretation guidelines for categorical variables.';
  const p = summaryParagraphs(blok);
  assert.ok(p.length >= 2, `bolunmedi (${p.length})`);
  const geri = p.map(x => x.body).join(' ');
  assert.equal(geri.replace(/\s+/g, ' '), blok.replace(/\s+/g, ' '), 'metin degisti');
  assert.ok(p.every(x => !/^\d/.test(x.body)), 'ondalik sayidan bolundu');
  // Kisa ozet bolunmez.
  assert.equal(summaryParagraphs('Kisa bir ozet. Iki cumle.').length, 1);
  // Kisaltmadan ve acik vurgunun icinden bolunmez (canli: "*Population vs. Sample Regression*").
  for (const pr of p) assert.ok(!/\bvs\.$/.test(pr.body), `"vs." sonrasi bolundu: ${pr.body.slice(-40)}`);
  assert.ok(p.some(pr => pr.body.includes('*Population vs. Sample Regression*')), 'vurgu ikiye bolundu');
});

test('satir ici markdown: kalin/italik evet, formul yildizi hayir', () => {
  assert.equal(inlineMarkdown('**Lead.** body'), '<strong>Lead.</strong> body');
  assert.equal(inlineMarkdown('The *Dummy Variables* section'), 'The <em>Dummy Variables</em> section');
  for (const f of ['x* = −β1/(2β2)', '2 * 3 = 6', 'a*b']) assert.equal(inlineMarkdown(f), f, f);
  assert.equal(stripInlineMarkdown('**Lead.** The *X* part'), 'Lead. The X part');
});

test('PDF: ozet paragraflari kalin girisli, isaretsiz', () => {
  const t = render({
    ...FULL_CARD,
    summary: '**Dummy variables shift the intercept.** With m levels use m - 1 dummies.\n\n**Logs give percent effects.** In the log-log model the slope is an elasticity.'
  });
  assert.ok(t.includes('Dummy variables shift the intercept.'), 'giris yok');
  assert.ok(t.includes('Logs give percent effects.'));
  assert.ok(!t.includes('**'), 'yildizlar basildi');
});

test('PDF: eski kartin tek dizgi adimlari "1. 1." OLMADAN, hesap ayri satirda', () => {
  const t = render({
    ...FULL_CARD,
    worked_examples: [{
      title: 'Utility Bill',
      problem_statement: 'Compute marginal effects.',
      steps: EKRAN_ADIMLARI,
      final_answer: 'At 40°F the bill decreases by $5.06 per degree.'
    }]
  });
  assert.ok(!/1\.\s+1\./.test(t), 'cift numara: ' + t.slice(t.indexOf('Utility Bill'), t.indexOf('Utility Bill') + 300));
  assert.ok(/1\. Estimate model/.test(t), 'ilk adim yok');
  assert.ok(/5\. At Temp=80/.test(t), 'besinci adim yok');
  // Hesap aciklamadan ayri satirda: "At Temp=40" satirinin sonunda denklem yok.
  const satir = t.split('\n').find(l => /4\. At Temp=40/.test(l)) || '';
  assert.ok(!/=\s*-?9\.0/.test(satir), `hesap aciklamayla ayni satirda: ${satir}`);
});

test('latexToUnicode: cift ters bolu, bitisik \\ln, \\cdots, \\left/\\right', () => {
  assert.equal(latexToUnicode('y=\\\\beta_0+\\\\beta_1x', true), 'y=β₀+β₁x');
  assert.equal(latexToUnicode('\\ln y=\\beta_0+\\beta_1\\ln x+\\varepsilon', true), 'ln y=β₀+β₁ ln x+ε');
  assert.ok(latexToUnicode('\\beta_2x^2 + \\cdots + \\beta_p x^p', true).includes('⋯'));
  assert.equal(latexToUnicode('\\left( x + 1 \\right)^2', true), '( x + 1 )²');
  // Aralik komutlari: canli PDF'te "12.08\,temp" diye basilmisti.
  assert.equal(latexToUnicode('UtilityBill = 484.12 - 12.08\\,temp + 0.09\\,temp^2', true),
    'UtilityBill = 484.12 - 12.08 temp + 0.09 temp²');
  assert.equal(latexToUnicode('a \\; b \\! c', true), 'a b c');
  // `\ ` — canli PDF'te "H₀:\ β₂ = 0" diye basilmisti.
  assert.equal(latexToUnicode('H_0:\\ \\beta_2 = 0', true), 'H₀: β₂ = 0');
  assert.ok(!latexToUnicode('\\left( x \\right)', false).includes('left'));
});


console.log('\nBELGE ISKELETI PDF ICINDE\n');

/* 09.10.2026. Kart verisinde `outline` her kosuda uretiliyor ve web kartinda
   gosteriliyor, ama PDF ihracinda HIC yoktu — dort ayri ozetin dordunde de.
   Ogrenci karti indirdiginde belgenin yapisini kaybediyordu. */
test('iskelet bolumu PDF e giriyor, basligi ve girintisiyle', () => {
  const t = render(FULL_CARD);
  assert.ok(/BELGE [İI]SKELET[İI]/.test(t), 'bolum basligi yok');
  assert.ok(t.includes('Chapter 20'), 'belge basligi tahmini yok');
  for (const h of ['What Macroeconomics Studies', 'Output growth', 'The Business Cycle']) {
    assert.ok(t.includes(h), `iskelet maddesi yok: ${h}`);
  }
  assert.ok(t.includes('Output, unemployment, inflation.'), 'madde aciklamasi yok');
  // Alt madde (level 2) daha icerden baslamali.
  const satirlar = t.split('\n');
  const ust = satirlar.find(l => l.includes('What Macroeconomics Studies')) || '';
  const alt = satirlar.find(l => l.includes('Output growth')) || '';
  const bosluk = (l) => l.length - l.trimStart().length;
  assert.ok(bosluk(alt) > bosluk(ust), `girinti yok: ${bosluk(ust)} vs ${bosluk(alt)}`);
});

test('iskelet YOKSA bolum hic basilmaz', () => {
  const { outline, ...iskeletsiz } = FULL_CARD;
  const t = render(iskeletsiz);
  assert.ok(!/BELGE [İI]SKELET[İI]/.test(t), 'bos iskelet bolumu basildi');
  // Kartin geri kalani etkilenmemeli.
  assert.ok(/ANAHTAR TER[İI]MLER/.test(t), 'kartin geri kalani da gitti');
});

test('iskelet ozetten SONRA, bolum ozetlerinden ONCE', () => {
  const t = render(FULL_CARD);
  // render() unicodeReady=false ile kosuyor: replaceTurkishChars basliklari
  // ASCII'ye dusuruyor (ÖZET -> OZET). Aramalar iki yazimi da karsilamali.
  const ozet = t.search(/\b[ÖO]ZET\b/);
  const iskelet = t.search(/BELGE [İI]SKELET[İI]/);
  const bolumler = t.search(/B[ÖO]L[ÜU]M [ÖO]ZETLER[İI]/);
  assert.ok(ozet > -1 && iskelet > ozet, 'iskelet ozetten once');
  assert.ok(bolumler > iskelet, 'iskelet bolum ozetlerinden sonra');
});

summary().then(() => process.exit(process.exitCode || 0));
