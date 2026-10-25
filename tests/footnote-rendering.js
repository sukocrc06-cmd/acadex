/* ==========================================================================
   ACADEX — DIPNOT RENDER TESTLERI (tests/footnote-rendering.js)

   js/dashboard.js icindeki dipnot render fonksiyonlarini, BACKEND'IN ARTIK
   URETTIGI veri bicimiyle test eder.

   Bu testin varlik sebebi: atif motoru degistiginde `footnotes[].reference`
   alaninin icerigi degisti. Eskiden sayfanin ilk satiriydi ("Talep
   Esnekligi" gibi kisa bir baslik); artik kaynaktan birebir alinmis, 220
   karaktere kadar, NOKTALAMA ICEREN tam bir cumle. Ve bu metin inline bir
   `onclick` attribute'una, bir JS string literal'inin icine gomuluyor:

       onclick="... jumpToFootnote(1, 'REFERANS BURAYA', 4)"

   "Frontend'de degisiklik gerekmiyor" iddiasi kodu OKUYARAK verildi.
   Bu dosya onu olcer.

   Calistirma:  node tests/footnote-rendering.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const UI = loadFromSource('js/dashboard.js', [
  'escapeHtml', 'formatFootnoteMarkers', 'renderFootnotesSectionHtml',
  'renderSuggestedTagChipHtml',
  // Formul degiskenlerinin matematik yolu (18.10.2026).
  'renderMathInText', 'renderMathSymbol', 'mathDelimRe',
  // Formul kutusuna sigdirma (18.10.2026).
  'FORMUL_MIN_REM', 'sigdirFormulKutusu',
  // Anlati ve maddelerdeki $...$ (18.10.2026).
  'inlineMath', 'inlineMarkdown',
  // Cift ters bolu sadelestirmesi (20.10.2026).
  'sadeKatexKomutu',
  // Ozet metninin KACIRAN yolu (24.10.2026) — depolanmis XSS duzeltmesi.
  'inlineMarkdownGuvenli', 'summaryParagraphs', 'OZET_KISALTMA_RE', 'formatSummaryText'
]);

const DASH_SRC = require('node:fs').readFileSync(
  require('node:path').join(__dirname, '..', 'js/dashboard.js'), 'utf8');

const { test, summary } = makeRunner();

/** Uretilen HTML'den onclick attribute'unun degerini cikarir. */
function onclickOf(html) {
  const m = html.match(/onclick="([^"]*)"/);
  return m ? m[1] : null;
}

/**
 * onclick icerigi GECERLI JS mi? new Function sadece ayristirir, calistirmaz
 * — yani jumpToFootnote tanimsiz olsa da sozdizimi hatasi yakalanir.
 * Attribute degeri HTML entity tasiyabilir; tarayici bunlari attribute
 * ayristirmasindan SONRA cozup JS'e verir, o yuzden burada da cozuyoruz.
 */
function onclickIsValidJs(html) {
  const raw = onclickOf(html);
  if (raw === null) return { ok: false, reason: 'onclick attribute bulunamadi' };
  const decoded = raw
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  try { new Function(decoded); return { ok: true, decoded }; }
  catch (e) { return { ok: false, reason: e.message, decoded }; }
}

const fn = (id, reference, page) => ({ id, reference, page });

console.log('\nDIPNOT ISARETCISI RENDER\n');

test('isaretci dogru id ile <sup> uretir', () => {
  const html = UI.formatFootnoteMarkers('Bir iddia [1]', [fn(1, 'Sayfa 4', 4)]);
  assert.match(html, /<sup class="footnote-marker"/);
  assert.match(html, /\[1\]<\/sup>/);
  assert.match(html, /jumpToFootnote\(1,/);
});

test('UZUN cumle referansi (yeni bicim) bozmuyor', () => {
  const long = 'Esneklik katsayisi birden buyukse talep esnek kabul edilir ve firmanin fiyatlandirma stratejisi dogrudan bu duruma gore sekillenmek zorundadir cunku gelir etkisi tersine doner.';
  const html = UI.formatFootnoteMarkers('Bir iddia [1]', [fn(1, long, 11)]);
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}`);
  assert.match(html, /jumpToFootnote\(1,/);
});

test('APOSTROF iceren referans (Turkce: Nash\'in, 2008\'de)', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, "Nash'in dengesi 2008'de yeniden yorumlanmistir", 7)]);
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}\n  ${r.decoded}`);
});

test('CIFT TIRNAK iceren referans', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Yazar bunu "esnek talep" olarak adlandirir', 3)]);
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}\n  ${r.decoded}`);
});

test('HTML karakterleri (< > &) kacirilir, enjeksiyon olmaz', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'a < b & c > d <script>alert(1)</script>', 2)]);
  assert.ok(!html.includes('<script>'), 'script etiketi kacirilmali');
  assert.ok(html.includes('&lt;') || html.includes('&amp;lt;'), 'kacirma uygulanmali');
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}`);
});

test('TERS EGIK CIZGI iceren referans', () => {
  // escapeHtml & < > " ' kaciriyor ama \\ KACIRMIYOR. Referans bir JS string
  // literal'inin icine giriyor, orada \\ kacis karakteridir.
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Gosterim \\alpha katsayisi ile verilir', 5)]);
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}\n  ${r.decoded}`);
});

test('SONU ters egik cizgiyle biten referans (en kotu durum)', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Formul sonu \\', 5)]);
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}\n  ${r.decoded}`);
});

test('SATIR SONU iceren referans', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Birinci satir\nikinci satir', 5)]);
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}\n  ${JSON.stringify(r.decoded)}`);
});

test('eksik dipnot icin yedek metin kullanilir', () => {
  const html = UI.formatFootnoteMarkers('x [9]', [fn(1, 'Sayfa 1', 1)]);
  assert.match(html, /jumpToFootnote\(9,/);
  assert.match(html, /Reference 9/);
});

test('page null ise jumpToFootnote null aliyor', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Bir bolum', null)]);
  assert.match(html, /jumpToFootnote\(1, this\.dataset\.fnRef, null\)/);
  assert.ok(!html.includes('(Sayfa'), 'sayfa yoksa baslikta sayfa yazmamali');
});

// --- DEGISMEZ: yazar metni JS ayristiricisina HIC ulasmamali ----------------
// Bu testin kirilmasi, birinin referansi tekrar onclick icine string olarak
// gommeye dondugu anlamina gelir — apostrof hatasi da onunla geri gelir.
test('DEGISMEZ: referans metni onclick icinde GECMEZ, data- attribute ta durur', () => {
  const ref = "Nash'in dengesi \\alpha ile gosterilir";
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, ref, 7)]);
  const oc = onclickOf(html);
  assert.ok(oc.includes('this.dataset.fnRef'), 'onclick referansi elementten okumali');
  assert.ok(!oc.includes('Nash'), `yazar metni onclick e sizmis: ${oc}`);
  assert.ok(!oc.includes('alpha'), `yazar metni onclick e sizmis: ${oc}`);
  assert.match(html, /data-fn-ref="/, 'data-fn-ref attribute u olmali');
});

test('data-fn-ref degeri attribute i kapatmiyor (cift tirnak kacirilmis)', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Yazar "esnek talep" der', 3)]);
  const m = html.match(/data-fn-ref="([^"]*)"/);
  assert.ok(m, 'data-fn-ref ayristirilabilmeli');
  assert.ok(m[1].includes('&quot;'), 'cift tirnak entity olarak kacirilmali');
  assert.ok(!html.includes('data-fn-ref="Yazar "'), 'attribute erken kapanmamali');
});

test('page varsa baslikta sayfa gorunuyor', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Bir cumle', 12)]);
  assert.match(html, /\(Sayfa 12\)/);
});

test('bos metin / bos dipnot listesi guvenli', () => {
  assert.equal(UI.formatFootnoteMarkers('', [fn(1, 'a', 1)]), '');
  assert.equal(UI.formatFootnoteMarkers('isaretcisiz metin', []), 'isaretcisiz metin');
  assert.equal(UI.formatFootnoteMarkers('x [1]', null).includes('<sup'), true);
});

console.log('\nKAYNAKCA BOLUMU RENDER\n');

test('kaynakca cumle referanslarini ve sayfa etiketini basiyor', () => {
  const html = UI.renderFootnotesSectionHtml([
    fn(1, 'Esneklik katsayisi birden buyukse talep esnek kabul edilir.', 11),
    fn(2, 'Marjinal maliyet uretimi bir birim artirmanin maliyetidir.', 12)
  ]);
  assert.match(html, /Esneklik katsayisi/);
  assert.match(html, /Sayfa 11/);
  assert.match(html, /Sayfa 12/);
  assert.match(html, /id="fn-ref-1"/);
});

test('kaynakcada HTML kacirilir', () => {
  const html = UI.renderFootnotesSectionHtml([fn(1, '<script>alert(1)</script>', 1)]);
  assert.ok(!html.includes('<script>'), 'kacirma uygulanmali');
});

test('kaynakca: sayfasiz dipnotta etiket yok', () => {
  const html = UI.renderFootnotesSectionHtml([fn(1, 'Bir bolum', null)]);
  assert.ok(!html.includes('Sayfa'), 'sayfa yoksa etiket basilmamali');
});

test('kaynakca: bos liste bos string', () => {
  assert.equal(UI.renderFootnotesSectionHtml([]), '');
  assert.equal(UI.renderFootnotesSectionHtml(null), '');
});

console.log('\nONERILEN DERS ETIKETI CIPI (ayni tuzagin ikinci ornegi)\n');

test('apostroflu etiket onclick i bozmuyor', () => {
  const html = UI.renderSuggestedTagChipHtml('d1', 'c1', "Isletme'ye Giris");
  const oc = (html.match(/onclick="([^"]*)"/g) || [])[0] || '';
  const decoded = oc.replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/^onclick="/, '').replace(/"$/, '');
  try { new Function(decoded); } catch (e) {
    assert.fail(`onclick gecersiz: ${e.message}\n  ${decoded}`);
  }
});

test('etiket metni onclick e sizmiyor', () => {
  const html = UI.renderSuggestedTagChipHtml('d1', 'c1', "Isletme'ye Giris");
  const m = html.match(/class="btn-accept-tag"[^>]*onclick="([^"]*)"/);
  assert.ok(m, 'accept butonu bulunamadi');
  assert.ok(m[1].includes('this.dataset.suggestedTag'), 'elementten okumali');
  assert.ok(!m[1].includes('Isletme'), `metin sizmis: ${m[1]}`);
});

test('etiket HTML kacirilmis olarak gosteriliyor', () => {
  const html = UI.renderSuggestedTagChipHtml('d1', 'c1', '<script>x</script>');
  assert.ok(!html.includes('<script>'), 'kacirma uygulanmali');
});

test('bos etiket bos string doner', () => {
  assert.equal(UI.renderSuggestedTagChipHtml('d1', 'c1', ''), '');
});


// ==========================================================================
// FORMUL DEGISKENLERI: SEMBOL MATEMATIK OLARAK DIZILIR
//
// 18.10.2026 CANLI HATA: formulun kendisi KaTeX'ten gecip duzgun
// diziliyordu, hemen altindaki degisken listesi ise kaynak kodunu
// gosteriyordu — ekranda yan yana "∂y/∂x₁ = β₁ + β₃x₂" ve
// "\frac{\partial y}{\partial x_1}". Liste escapeHtml'de kaldigi icin
// LaTeX bilerek METIN olarak basiliyordu.
// ==========================================================================

/** KaTeX taklidi: neyin matematik olarak dizildigini GORUNUR kilar. */
function sahteKatex() {
  const cagrilar = [];
  global.window = global.window || {};
  window.katex = { renderToString: (tex) => { cagrilar.push(tex); return '<KTX>' + tex + '</KTX>'; } };
  return cagrilar;
}
function katexYok() { global.window = global.window || {}; delete window.katex; }

test('ayiracsiz LaTeX sembolu KaTeX ile dizilir', () => {
  const c = sahteKatex();
  try {
    const html = UI.renderMathSymbol('\\beta_3');
    assert.ok(html.includes('<KTX>'), 'sembol KaTeX e gitmedi: ' + html);
    assert.deepEqual(c, ['\\beta_3']);
  } finally { katexYok(); }
});

test('cok parcali LaTeX (\\frac, \\partial) da dizilir', () => {
  const c = sahteKatex();
  try {
    UI.renderMathSymbol('\\frac{\\partial y}{\\partial x_1}');
    assert.equal(c.length, 1, 'tek parca olarak gitmeliydi');
  } finally { katexYok(); }
});

test('DUZ KELIME KaTeX e GITMEZ', () => {
  // "Temperature" italik matematik olarak dizilirse tuhaf gorunur.
  const c = sahteKatex();
  try {
    const html = UI.renderMathSymbol('Temperature');
    assert.equal(html, 'Temperature');
    assert.deepEqual(c, [], 'duz kelime KaTeX e gonderilmis');
  } finally { katexYok(); }
});

test('$....$ ile gelen sembol metin yolundan gecer', () => {
  const c = sahteKatex();
  try {
    const html = UI.renderMathSymbol('$x_1$');
    assert.ok(html.includes('<KTX>'), 'ayiracli sembol dizilmedi: ' + html);
    assert.deepEqual(c, ['x_1'], 'ayiraclar KaTeX e gonderilmis');
  } finally { katexYok(); }
});

test('KaTeX yoksa cokmez, kacirarak basar', () => {
  katexYok();
  assert.equal(UI.renderMathSymbol('\\beta_1 <b>'), '\\beta_1 &lt;b&gt;');
  assert.equal(UI.renderMathSymbol(''), '');
  assert.equal(UI.renderMathSymbol(null), '');
});

test('degisken listesi gercekten bu yoldan geciyor', () => {
  /* Fonksiyonun var olmasi yetmez: cagri yerinde escapeHtml geri gelirse
     hata sessizce doner ve bunu ancak ekrana bakan biri fark eder. */
  const i = DASH_SRC.indexOf("formula-vars-list");
  assert.ok(i > 0, 'degisken listesi render yeri bulunamadi');
  const blok = DASH_SRC.slice(i, i + 400);
  assert.ok(/renderMathSymbol\(v\.symbol\)/.test(blok), 'sembol matematik yolundan gecmiyor');
  assert.ok(/renderMathInText\(v\.meaning/.test(blok), 'aciklama metin yolundan gecmiyor');
});


// ==========================================================================
// FORMUL KUTUSUNA SIGDIRMA
//
// Uzun formul kutuya sigmayinca overflow-x:auto devreye giriyordu: kartin
// ortasinda kaydirma cubugu, formulun sagi hem ekranda hem ciktida
// kayboluyor. Punto dusurulerek sigdiriliyor.
// ==========================================================================

/* Sahte kutu. Karti genisletmek GERCEKTEN alani buyutsun: izgarada tek
   sutundan tum genislige gecmek alani yaklasik ikiye katliyor, ve
   sigdirmanin ilk kademesi tam buna dayaniyor. */
function sahteKutu(alan, genislik) {
  const ic = { scrollWidth: genislik };
  const kart = {
    siniflar: new Set(),
    classList: {
      add(c) { kart.siniflar.add(c); kutu.clientWidth = alan * 2; },
      contains: (c) => kart.siniflar.has(c)
    }
  };
  const kutu = {
    clientWidth: alan,
    style: {},
    querySelector: (sec) => (sec === '.katex-display' ? ic : null),
    firstElementChild: ic,
    /* Secici IKI kart tasarimini da kapsamali: .formula-card (dashboard)
       ve .axr-fig (acadex-ink). Kullanicinin gordugu kart ink tarafindan
       uretiliyor; sabit tek secici ile test yesil gecip ekran bozuk kalir. */
    closest: (sec) => {
      if (!/formula-card/.test(sec) || !/axr-fig/.test(sec)) return null;
      return kart;
    },
    ic,
    kart
  };
  return kutu;
}

test('sigan formule DOKUNULMAZ', () => {
  const k = sahteKutu(400, 320);
  assert.equal(UI.sigdirFormulKutusu(k), null);
  assert.equal(k.style.fontSize, '', 'sigan formulun puntosu degistirilmis');
  assert.equal(k.kart.siniflar.size, 0, 'sigan kart genisletilmis');
});

test('ILK KADEME genisletmek: punto dusurulmeden siginir', () => {
  /* Iki kat tasan formul icin gereken punto 0,49 — tabanin altinda, yani
     kucultmek tek basina cozmuyor. Karti tum genislige yaymak alani ikiye
     katliyor ve formul oldugu puntoda siginiyor. */
  const k = sahteKutu(400, 800);
  const r = UI.sigdirFormulKutusu(k);
  assert.ok(r && r.genis, 'kart genisletilmedi');
  assert.equal(r.oran, null, 'genisletmek yetmisken punto da dusurulmus');
  assert.equal(k.style.fontSize, '', 'punto bosuna degistirilmis');
});

test('IKINCI KADEME punto: genisletmek yetmezse kuculur', () => {
  const k = sahteKutu(400, 2000);         // 800'e yayilsa bile tasiyor
  const r = UI.sigdirFormulKutusu(k);
  assert.ok(r.genis, 'once genisletilmeliydi');
  assert.ok(r.oran > 0 && r.oran < 1, 'punto dusurulmedi: ' + r.oran);
  assert.equal(k.style.fontSize, r.oran + 'rem');
});

test('TABAN var: okunmaz kuculme yok', () => {
  // Cok uzun formulde sonsuza kadar kucultmek yerine kaydirma cubuguna
  // birakiliyor; 0.3rem'lik bir formul zaten okunmuyor.
  const k = sahteKutu(400, 40000);
  assert.equal(UI.sigdirFormulKutusu(k).oran, UI.FORMUL_MIN_REM);
  assert.ok(UI.FORMUL_MIN_REM >= 0.5, 'taban cok dusuk — formul okunmaz');
});

test('olculemeyen ortamda hicbir sey yapilmaz', () => {
  /* Kutu henuz yerlesmemisse clientWidth 0 gelir. O anda kucultmek ya da
     genisletmek, kaydirma cubugundan daha kotu bir sonuc uretir. */
  const k = sahteKutu(0, 800);
  assert.equal(UI.sigdirFormulKutusu(k), null);
  assert.equal(k.style.fontSize, '');
  assert.equal(k.kart.siniflar.size, 0);
  assert.equal(UI.sigdirFormulKutusu(null), null);
});

test('ink kart yolu da matematik ve sigdirma kullaniyor', () => {
  /* 18.10.2026: ilk duzeltme yalnizca dashboard.js yoluna yapildi, oysa
     kullanicinin gordugu formul karti js/acadex-ink.js icindeki
     formulaCard tarafindan uretiliyor. Ekranda hicbir sey degismedi.
     Iki yol da kontrol ediliyor ki ayni hata tekrar etmesin. */
  const INK = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'js/acadex-ink.js'), 'utf8');
  const i = INK.indexOf('axr-vars');
  assert.ok(i > 0, 'ink degisken listesi bulunamadi');
  const blok = INK.slice(i, i + 300);
  assert.ok(blok.includes('sym(v.symbol'), 'ink sembolu matematik yolundan gecmiyor');
  assert.ok(blok.includes('math(v.meaning'), 'ink aciklamasi matematik yolundan gecmiyor');
  assert.ok(INK.includes('sigdirFormulKutusu(el)'), 'ink formulu sigdirilmiyor');
});

test('sigdirma KaTeX render edildikten SONRA cagriliyor', () => {
  // Once olcup sonra dizmek yanlis olcum demek.
  const i = DASH_SRC.indexOf('window.katex.render(f.latex, latexTarget');
  assert.ok(i > 0, 'formul render cagrisi bulunamadi');
  const blok = DASH_SRC.slice(i, i + 300);
  assert.ok(/sigdirFormulKutusu\(latexTarget\)/.test(blok),
    'render sonrasi sigdirma cagrilmiyor');
});


// ==========================================================================
// ANLATI VE MADDELERDE $...$
//
// CANLI HATA: formul kartlari duzgun dizilirken anlati metni kaynak kodu
// gosteriyordu: "...term, $y = \beta_0 + \beta_1 x_j + \varepsilon$,
// allowing...". Anlati da maddeler de inlineMarkdown'dan geciyor ve orada
// $...$ hic ele alinmiyordu.
// ==========================================================================

function sahteKatexKur() {
  const c = [];
  global.window = global.window || {};
  window.katex = { renderToString: (t) => { c.push(t); return '<KTX>' + t + '</KTX>'; } };
  return c;
}
function katexKaldir() { global.window = global.window || {}; delete window.katex; }

test('anlatidaki $...$ dizilir', () => {
  const c = sahteKatexKur();
  try {
    const html = UI.inlineMarkdown('adds a term, $y = \\beta_0 + \\varepsilon$, allowing');
    assert.ok(html.includes('<KTX>'), 'matematik dizilmedi: ' + html);
    assert.deepEqual(c, ['y = \\beta_0 + \\varepsilon']);
    assert.ok(html.startsWith('adds a term, '), 'cevresindeki metin bozulmus');
  } finally { katexKaldir(); }
});

test('ATIF ISARETLERI bozulmaz: gelen metin zaten HTML', () => {
  /* inlineMarkdown'a gelen metin o noktada formatFootnoteMarkers'tan
     gecmis durumda, yani <sup> iceriyor. Kacirmayan bir matematik yolu
     kullanilmasinin sebebi bu — renderMathInText o isaretleri metne
     cevirirdi. */
  const c = sahteKatexKur();
  try {
    const girdi = 'curvature <sup class="fn">[20]</sup> with $x_j$';
    const html = UI.inlineMarkdown(girdi);
    assert.ok(html.includes('<sup class="fn">[20]</sup>'), 'atif isareti bozulmus: ' + html);
    assert.ok(html.includes('<KTX>x_j</KTX>'), 'matematik dizilmedi');
  } finally { katexKaldir(); }
});

test('PARA bicimi formul sanilmaz', () => {
  // "costs $100 and $200" iki dolar isareti tasiyor ama formul degil.
  const c = sahteKatexKur();
  try {
    const html = UI.inlineMath('costs $100 and $200');
    assert.equal(html, 'costs $100 and $200');
    assert.deepEqual(c, [], 'para KaTeX e gonderilmis');
  } finally { katexKaldir(); }
});

test('SIRA: matematik kalin/italikten ONCE', () => {
  /* Tersi olsaydi $a*b$ icindeki yildiz italige donusup LaTeX'i
     bozardi. */
  const c = sahteKatexKur();
  try {
    UI.inlineMarkdown('bak $a*b*c$ burada');
    assert.deepEqual(c, ['a*b*c'], 'yildizlar matematige girmeden yenmis');
  } finally { katexKaldir(); }
});

test('kalin/italik calismaya devam ediyor', () => {
  katexKaldir();
  assert.equal(UI.inlineMarkdown('**kalin** ve *egik*'), '<strong>kalin</strong> ve <em>egik</em>');
});

test('KaTeX yoksa metin AYNEN kalir', () => {
  katexKaldir();
  const girdi = 'su $x_1$ burada';
  assert.equal(UI.inlineMath(girdi), girdi);
});

test('ink madde listeleri de bu yoldan geciyor', () => {
  /* Maddeler formatSummaryText'ten GECMIYOR, kendi HTML'lerini kuruyorlar;
     yalnizca inlineMarkdown'i duzeltmek onlara ulasmazdi. */
  const INK = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'js/acadex-ink.js'), 'utf8');
  /* ONCE matematik, SONRA kacis — tersi KaTeX e &gt; gonderiyordu ve
     formul kirmizi hata metni olarak basiliyordu (18.10.2026). math()
     ikisini dogru sirada yapan tek huni. */
  /* 25.10.2026: madde once gorselKp'den geciyor (Diagram/Visual oneki
     etikete doner); sira yine plain -> math. */
  assert.ok(INK.includes('math(plain(p))') || INK.includes("var g = gorselKp(plain(p)); return '<li>' + g.tag + math(g.s)"),
    'bolum maddeleri matematikten gecmiyor');
  assert.ok(!INK.includes('imath(X(plain'), 'kacir-sonra-diz sirasi geri gelmis');
  assert.ok(INK.includes('imath(typeof formatFootnoteMarkers'), 'kart maddeleri matematikten gecmiyor');
});


/* 25.10.2026 — kosu 38 karti: 'Diagram/Visual:' oneki ham metin olarak
   basiliyordu; tablo hucresindeki \hat{\beta}_0 ham LaTeX kaliyordu. */
test('ink: gorsel madde oneki etikete, LaTeX komutlu tablo hucresi KaTeX e gidiyor', () => {
  const INK = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'js/acadex-ink.js'), 'utf8');
  const m = INK.match(/var GORSEL_KP_RE = (\/.*\/i);/);
  assert.ok(m, 'gorsel onek deseni yok');
  const re = eval(m[1]);
  for (const s of ['Diagram/Visual: x', 'Diyagram/Görsel: x', 'Diyagram: x', ' diagram / visual : x']) assert.ok(re.test(s), s);
  assert.ok(!re.test('Diagrams show x'), 'onek olmayan madde etiketlendi');
  assert.ok((INK.match(/g\.tag \+/g) || []).length >= 2, 'iki madde listesinden biri etiketi kullanmiyor');
  assert.ok(INK.includes("'>' + tcell(r[c]) + '</td>'"), 'tablo hucresi hala duz X() ile kaciriliyor');
  // Hucre kosulu: yalnizca LaTeX KOMUTU. Alt cizgi (Average_Monthly_Temperature) ve "$" (para) degil.
  const k = INK.match(/return (\/\\\\\[A-Za-z\]\{2,\}\/)\.test\(s\) \? sym\(s\) : X\(s\)/);
  assert.ok(k, 'hucre KaTeX kosulu degismis');
  const hucreRe = eval(k[1]);
  assert.ok(hucreRe.test('\\hat{\\beta}_0'));
  assert.ok(!hucreRe.test('Average_Monthly_Temperature') && !hucreRe.test('$1,000s'));
});

test('cleanHTML KaTeX satir ici stillerini KORUR', () => {
  /* 18.10.2026 CANLI HATA: anlati metnindeki formullerin alt simgeleri
     satirin altina dusuyordu. Sebep cleanHTML'in BUTUN style
     attribute'larini silmesiydi; KaTeX ust/alt simgeleri .vlist icinde
     top/height ile konumlandiriyor ve o stiller olmadan yerlesim cokuyor.
     Formul kartlari saglamdi cunku cleanHTML'den gecmiyorlar. */
  const INK = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'js/acadex-ink.js'), 'utf8');
  const i = INK.indexOf('var cleanHTML = function');
  assert.ok(i > 0, 'cleanHTML bulunamadi');
  const blok = INK.slice(i, i + 420);
  assert.ok(blok.includes("closest('.katex')"),
    'cleanHTML KaTeX ciktisini atlamiyor — alt simgeler satirin altina duser');
  assert.ok(blok.includes("removeAttribute('style')"),
    'temizlik tamamen kalkmis: formatSummaryText stilleri ink temasiyla kavga eder');
});


test('KACISLA BITEN formul yakalanir', () => {
  /* 18.10.2026 CANLI HATA: ekranda ham kalan formullerin HEPSI ayni
     sekilde bitiyordu — $1\\%$ , $(\\beta_1 \\times 100)\\%$ ,
     $\\beta_1\\%$ . Eski desen kapanis $ isaretinden once AYRI bir
     \\S karakteri istiyordu; kacisli bir komutla biten formulde o
     karakter kacisin ICINDE kaliyor, geriye \\S icin bir sey kalmiyor ve
     eslesme olmuyordu. Formul de ham basiliyordu. */
  const c = sahteKatexKur();
  try {
    const html = UI.renderMathInText('yaklasik $1\\%$ degisim');
    assert.ok(html.includes('<KTX>'), 'kacisla biten formul hala ham: ' + html);
    assert.deepEqual(c, ['1\\%'], 'KaTeX e giden formul yanlis: ' + JSON.stringify(c));

    const uzun = UI.renderMathInText('approximately $(\\beta_1 \\times 100)\\%$ change');
    assert.ok(uzun.includes('<KTX>'), 'uzun kacisli formul hala ham: ' + uzun);
  } finally { katexKaldir(); }
});

test('PARA ve BOS durumlar hala reddediliyor', () => {
  // Desen gevsetildi; gevsemenin bu ikisini icine almadigi kilitleniyor.
  const c = sahteKatexKur();
  try {
    assert.equal(UI.inlineMath('costs $100 and $200'), 'costs $100 and $200');
    assert.equal(UI.inlineMath('bir $ $ iki'), 'bir $ $ iki');
    assert.deepEqual(c, [], 'para ya da bos parca KaTeX e gonderilmis');
  } finally { katexKaldir(); }
});


test('CIFT ters bolu sadelestirilir (KaTeX satir sonu)', () => {
  /* 20.10.2026 CANLI HATA: madde ekranda soyle cikiyordu —
       "Log-linear models ( lny = / beta_0 + / beta_1x_1 + / varepsilon )"
     Kirilma noktalari tam olarak ters bolunun bulundugu yerlerdi. KaTeX'te
     \\\\ SATIR SONU demek; veride onarim iki kez uygulaninca \\beta
     \\\\beta oluyor ve formul 'satir sonu + beta' diye diziliyor. */
  assert.equal(UI.sadeKatexKomutu('\\\\beta_0 + \\\\ln y'), '\\beta_0 + \\ln y');
});

test('TEK ters bolu ve mesru \\\\ DOKUNULMAZ', () => {
  /* Sadelestirme dar tutulmali: matris ve hizalamada \\\\ gercekten satir
     sonudur ve display matematikte mesrudur. Ardindan HARF gelen durum
     disinda hicbir seye dokunulmuyor. */
  assert.equal(UI.sadeKatexKomutu('\\beta_0'), '\\beta_0');
  assert.equal(UI.sadeKatexKomutu('a \\\\ b'), 'a \\\\ b');
  assert.equal(UI.sadeKatexKomutu('\\\\[ x \\\\]'), '\\\\[ x \\\\]');
  assert.equal(UI.sadeKatexKomutu(''), '');
  assert.equal(UI.sadeKatexKomutu(null), '');
});

test('dizim yolu sadelestirmeden GECIYOR', () => {
  // Fonksiyonun var olmasi yetmez: render cagrisinda kullanilmazsa
  // ekranda hicbir sey degismez.
  const DASH = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'js/dashboard.js'), 'utf8');
  const n = DASH.split('renderToString(sadeKatexKomutu(latex)').length - 1;
  assert.equal(n, 2, 'iki render noktasinin ikisi de sadelestirmeden gecmeli, gecen: ' + n);
});

/* ==========================================================================
   STANDART LATEX AYIRACLARI (24.10.2026)

   Iki desen de yalnizca `$...$` ariyordu. Model, regresyon anlatan bir
   belgede standart LaTeX yaziyor ve ekranda HAM gorunuyordu:

     \(\partial y/\partial x = \beta_1 + \beta_3 D\)
     \(UtilityBill = 484.12 - 12.08\,temp + 0.09\,temp^2\)

   Cizim yolu uctan uca: acadex-ink.js anlati/bolum metnini fmtS ->
   formatSummaryText -> inlineMarkdown -> inlineMath'e veriyor.
   ========================================================================== */
test('SATIR ICI \\(...\\) KaTeX e gidiyor', () => {
  const c = sahteKatexKur();
  try {
    const html = UI.inlineMath('marjinal etki \\(\\beta_1 + \\beta_3 D\\) olur');
    assert.ok(/<KTX>/.test(html), 'satir ici ayirac hala ham basiliyor: ' + html);
    assert.deepEqual(c, ['\\beta_1 + \\beta_3 D'], 'ayiraclar KaTeX e birlikte gonderilmis');
    assert.ok(!/\\\(/.test(html), 'ayiraclar ciktida kalmis: ' + html);
  } finally { katexKaldir(); }
});

test('BLOK \\[...\\] displayMode ile diziliyor', () => {
  const modlar = [];
  global.window = global.window || {};
  window.katex = { renderToString: (tex, o) => { modlar.push(!!(o && o.displayMode)); return '<KTX>' + tex + '</KTX>'; } };
  try {
    UI.inlineMath('once \\[x^2 + y^2 = z^2\\] sonra');
    assert.deepEqual(modlar, [true], 'blok ayirac satir ici dizilmis');
    UI.inlineMath('once \\(a+b\\) sonra');
    assert.deepEqual(modlar, [true, false], 'satir ici ayirac blok dizilmis');
  } finally { katexKaldir(); }
});

test('ERKEN CIKIS ters bolu ayiraclarini da goruyor', () => {
  /* Eski hali `s.indexOf('$') === -1` ile donuyordu; icinde yalnizca
     \(...\) olan bir metin hic incelenmiyordu. Regresyon bu satirdaydi. */
  const c = sahteKatexKur();
  try {
    const html = UI.inlineMath('icinde dolar olmayan \\(a^2\\) metin');
    assert.ok(/<KTX>/.test(html), 'dolarsiz metin erken cikista atlanmis: ' + html);
    assert.equal(c.length, 1);
  } finally { katexKaldir(); }
});

test('DOLAR davranisi degismedi: para hala formul sanilmaz', () => {
  const c = sahteKatexKur();
  try {
    assert.equal(UI.inlineMath('costs $100 and $200'), 'costs $100 and $200');
    assert.deepEqual(c, [], 'para KaTeX e gonderilmis');
    // Ters bolu kolunda para belirsizligi yok, o koruma dolara ozel kalmali.
    UI.inlineMath('\\(100 and 200\\)');
    assert.deepEqual(c, ['100 and 200'], 'ters bolu kolu para korumasina takilmis');
  } finally { katexKaldir(); }
});

test('renderMathInText de iki yeni ayiraci taniyor', () => {
  const c = sahteKatexKur();
  try {
    const html = UI.renderMathInText('egim \\(\\beta_3\\) ve blok \\[\\alpha\\] birlikte');
    assert.equal(c.length, 2, 'iki ayiracin ikisi de dizilmemis: ' + JSON.stringify(c));
    assert.ok(!/\\\(|\\\[/.test(html), 'ayiraclar ciktida kalmis: ' + html);
  } finally { katexKaldir(); }
});

test('OLCULEN ORNEK: kullanicinin ekranda gordugu cumle', () => {
  /* 24.10.2026 kosusunun kartindan birebir. Daha once bu satir ekranda
     ters bolulerle birlikte goruluyordu. */
  const c = sahteKatexKur();
  try {
    const html = UI.inlineMath(
      'In the utility-bill example, \\(UtilityBill = 484.12 - 12.08\\,temp + 0.09\\,temp^2\\).'
    );
    assert.ok(/<KTX>/.test(html), 'ornek cumle hala ham: ' + html);
    assert.ok(/UtilityBill/.test(c[0]), 'latex govdesi dogru alinmamis: ' + c[0]);
    assert.ok(!/\\\(|\\\)/.test(html), 'ayiraclar ciktida kalmis: ' + html);
  } finally { katexKaldir(); }
});

test('mathDelimRe HER cagrida yeni regex veriyor', () => {
  /* g bayrakli bir regex paylasilirsa lastIndex iki fonksiyon arasinda
     tasinir ve renderMathInText'in exec dongusu sessizce atlar. */
  const a = UI.mathDelimRe(), b = UI.mathDelimRe();
  assert.notEqual(a, b, 'ayni regex nesnesi paylasiliyor — lastIndex sizar');
  a.exec('$x$');
  assert.equal(b.lastIndex, 0, 'lastIndex paylasilmis');
});

/* ==========================================================================
   OZET METNI ARTIK KACIRILIYOR (24.10.2026) — DEPOLANMIS XSS

   formatSummaryText modelin urettigi metni dogrudan innerHTML'e yaziyordu ve
   zincirde hicbir yerde kacirma yoktu: baslik dallari metni ciplak enterpole
   ediyor, paragraf/madde dallari ise inlineMarkdown'dan geciyordu — o da
   kacirmiyor (inlineMath ayirac bulamazsa dizgeyi oldugu gibi donduruyor).
   Projede sanitizer de yok.

   Kaynaktan kopyalanmis bir `<img src=x onerror=...>` satiri, kart "bolumumle
   paylas" ile paylasildiginda BASKA ogrencinin oturumunda calisirdi.
   innerHTML'de <script> kosmaz ama onerror/onload kosar.

   Sira: KACIR + matematik (renderMathInText) -> kalin/italik -> dipnot.
   Kacirma matematikten ONCE yapilamaz, cunku LaTeX icinde < > & gecer ve
   kacirilmis dizgeyi KaTeX'e vermek formulu bozar.
   ========================================================================== */
const XSS = '<img src=x onerror=alert(1)>';

test('ozet metni DORT dalda da kaciriliyor', () => {
  const c = sahteKatexKur();
  try {
    const vakalar = [
      ['paragraf', 'Normal cumle ' + XSS + ' devam.'],
      ['## baslik', '## ' + XSS],
      ['sezgisel baslik', '1. ' + XSS],
      ['madde', '- ' + XSS],
    ];
    for (const [ad, girdi] of vakalar) {
      const html = UI.formatSummaryText(girdi, []);
      assert.ok(html.includes('&lt;img'), `${ad}: kacirilmamis — ${html.slice(0, 120)}`);
      assert.ok(!/<img/i.test(html), `${ad}: ham <img> hala ciktida`);
      assert.ok(!/onerror=alert/.test(html.replace(/&lt;[^&]*&gt;/g, '')),
        `${ad}: olay isleyicisi kacirilmamis`);
    }
  } finally { katexKaldir(); }
});

test('kacirma MATEMATIGI bozmuyor (sira dogru)', () => {
  const c = sahteKatexKur();
  try {
    for (const girdi of ['Egim $\\beta_1$ pozitif.', 'Etki \\(\\beta_1 + \\beta_3 D\\) olur.']) {
      const html = UI.formatSummaryText(girdi, []);
      assert.ok(/<KTX>/.test(html), 'matematik dizilmemis: ' + html.slice(0, 140));
      assert.ok(!/&lt;KTX/.test(html), 'KaTeX ciktisi kacirilmis — sira ters');
    }
    // LaTeX govdesi KaTeX'e KACIRILMADAN gitmeli, yoksa formul bozulur.
    assert.ok(c.some((t) => t.includes('\\beta_1')), 'KaTeX e giden latex bozulmus: ' + JSON.stringify(c));
    assert.ok(!c.some((t) => /&lt;|&amp;/.test(t)), 'KaTeX e kacirilmis dizge gonderilmis');
  } finally { katexKaldir(); }
});

test('BASLIKLAR da artik matematik ve kalin isliyor', () => {
  /* Baslik dallari inlineMarkdown'i hic cagirmiyordu; `## Egim $\beta_1$`
     ekranda ham gorunuyordu ve CSS onu 1.15em display fontla diziyordu. */
  const c = sahteKatexKur();
  try {
    assert.ok(/<KTX>/.test(UI.formatSummaryText('## Egim $\\beta_1$', [])),
      'baslikta matematik hala ham');
    assert.ok(/<strong>/.test(UI.formatSummaryText('## Bu **onemli**', [])),
      'baslikta kalin islenmiyor');
  } finally { katexKaldir(); }
});

test('DIPNOT isaretcisi hala baglanti uretiyor (en sonda)', () => {
  const c = sahteKatexKur();
  try {
    const html = UI.formatSummaryText('Issizlik artti [3].', [{ id: 3, reference: 'Sayfa 2', page: 2 }]);
    assert.ok(/<sup/.test(html), 'dipnot isaretcisi uretilmemis: ' + html.slice(0, 140));
    assert.ok(!/&lt;sup/.test(html), 'dipnot isaretlemesi kacirilmis — sira ters');
  } finally { katexKaldir(); }
});

test('kalin/italik hala calisiyor (regresyon)', () => {
  const c = sahteKatexKur();
  try {
    assert.ok(/<strong>onemli<\/strong>/.test(UI.formatSummaryText('Bu **onemli** nokta.', [])));
  } finally { katexKaldir(); }
});

/* ==========================================================================
   SAYI KUTULARI (24.10.2026)

   Kartin ustundeki uc sayi kutusu findNumbers ile seciliyor
   (js/acadex-ink.js). Canli kartta olculen hal:

     $5,06  <- metin "-5.06 ... decreases by $5.06" diyor, ISARET KAYBOLMUS
     1%     <- anlamlilik duzeyi, belgenin konusu degil
     $1000  <- "0.07 tons per $1000" cumlesinden; asil sayi 0.07 GORUNMEZ

   Iki kusur: (1) desende `-` yoktu ve parseFloat oncesi temizlik isareti
   zaten siliyordu; (2) desen yalnizca %, para birimi ve TURKCE birimleri
   taniyordu, ciplak ondalik hic eslesmiyordu. Ingilizce bir istatistik
   destesinde belgenin ASIL sayilari gorunmez kaliyordu.

   Tam sayilar bilerek disarida: sayfa numarasi, yil, madde sirasi hep tam
   sayi. Nicel bir belgede sinyal ondalikta.
   ========================================================================== */
const INK_SAYI_RE = (() => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'js/acadex-ink.js'), 'utf8');
  const m = src.match(/var re = (\/\(-\?[^\n]*\/i);/);
  if (!m) throw new Error('findNumbers deseni bulunamadi — yeniden adlandirilmis olabilir');
  return eval(m[1]);
})();

function sayiSec(cumle) {
  const x = cumle.match(INK_SAYI_RE);
  if (!x) return null;
  const tok = x[1].trim();
  const eksi = /^-/.test(tok) || /^[%$€₺]\s?-/.test(tok);
  let v = parseFloat(tok.replace(/[^\d.,]/g, '').replace(',', '.'));
  if (eksi) v = -v;
  return { tok, v };
}

test('sayi kutusu EKSI isaretini koruyor', () => {
  const r = sayiSec('The marginal effect at temp=40 is -5.06, meaning the bill decreases by $5.06.');
  assert.ok(r, 'hic sayi secilmedi');
  assert.equal(r.v, -5.06,
    `isaret kaybolmus: ${r.tok} -> ${r.v}. Kart "azaliyor" derken kutu pozitif gosterir.`);
});

test('sayi kutusu CIPLAK ondaligi goruyor', () => {
  const vakalar = [
    ['In the energy-GDP example, the slope (0.07 tons per $1000) is significant.', 0.07],
    ['The quadratic model is UtilityBill = 484.12 - 12.08 temp + 0.09 temp^2.', 484.12],
    ['The coefficient of determination R2 = 0.87 shows strong fit.', 0.87],
  ];
  for (const [cumle, beklenen] of vakalar) {
    const r = sayiSec(cumle);
    assert.ok(r, `eslesme yok: ${cumle.slice(0, 50)}`);
    assert.equal(r.v, beklenen, `${cumle.slice(0, 40)} -> ${r.tok} (${r.v}), beklenen ${beklenen}`);
  }
});

test('sayi kutusu TAM sayilari almiyor (sayfa/bolum copu)', () => {
  /* Tam sayiyi da alsaydik kutular sayfa numarasi ve madde siralariyla
     dolardi; bu yuzden ondalik sarti bilincli. */
  assert.equal(sayiSec('Bolum 3 sayfa 12 de anlatiliyor.'), null);
  assert.equal(sayiSec('There are 4 assumptions in this model.'), null);
});

test('sayi kutusu TURKCE davranisi bozulmadi (regresyon)', () => {
  assert.equal(sayiSec('Issizlik orani 2023 yilinda %11 seviyesine yukseldi.').v, 11);
  assert.equal(sayiSec('Toplam maliyet 1,5 milyon TL olarak hesaplandi.').v, 1.5);
});

test('renderMathSymbol STANDART ayiraclari da taniyor', () => {
  /* Ucuncu huni: buraya yalnizca `$` kontrolu vardi. `\(\beta_1\)` ayiraclari
     DOGRUDAN KaTeX'e gidiyor, KaTeX ParseError atiyor ve sembol ekranda ham
     goruluyordu. inlineMath ve renderMathInText bugun genisletilmisti, bu
     dal atlanmisti. */
  const c = sahteKatexKur();
  try {
    for (const girdi of ['\\(\\beta_1\\)', '\\[\\alpha\\]']) {
      const html = UI.renderMathSymbol(girdi);
      assert.ok(/<KTX>/.test(html), `${girdi} dizilmemis: ${html}`);
      assert.ok(!/\\\(|\\\[/.test(html), `${girdi}: ayiraclar ciktida kalmis: ${html}`);
    }
    // KaTeX'e ayiracsiz govde gitmeli.
    assert.ok(c.every((t) => !/\\\(|\\\[/.test(t)), 'KaTeX e ayiracli dizge gonderilmis: ' + JSON.stringify(c));
  } finally { katexKaldir(); }
});

test('KAVRAM ve SINAV kartlari matematik yolundan geciyor', () => {
  /* Kavram tanimlari ve sinav sorulari yalnizca X(plain(...)) ile basiliyordu;
     sayisal bir derste soru metnindeki formul ham kaliyordu. Ayni fonksiyonun
     bir satir otesinde matematik yolu zaten vardi. */
  const INK = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'js/acadex-ink.js'), 'utf8');
  assert.ok(INK.includes("sym(plain(t.term))"), 'kavram terimi sembol yolundan gecmiyor');
  assert.ok(INK.includes("math(plain(t.definition))"), 'kavram tanimi matematik yolundan gecmiyor');
  assert.ok(INK.includes("math(plain(q.question))"), 'sinav sorusu matematik yolundan gecmiyor');
  assert.ok(INK.includes("math(plain(q.explanation))"), 'sinav aciklamasi matematik yolundan gecmiyor');
  assert.ok(!/X\(plain\(t\.definition\)\)/.test(INK), 'eski kacirma-only yol kalmis');
});

test('CLOZE kartinin tam cumlesi okunuyor (full_text)', () => {
  /* Edge function `full_text` yaziyor (bkz. index.ts cloze uretimi), okuyucu
     ise `c.full || c.sentence || c.answer` ariyordu — `full` hic olmadigi icin
     `answer`a dusuyor ve ogrenci kartin arkasinda yalnizca TEK KELIME
     goruyordu; baglam kayboluyordu. */
  const INK = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'js/acadex-ink.js'), 'utf8');
  const yerler = INK.match(/c\.full_text \|\| c\.full \|\| c\.sentence \|\| c\.answer/g) || [];
  assert.equal(yerler.length, 2,
    `full_text ${yerler.length} yerde okunuyor — iki cloze okuyucusunun ikisi de duzelmeli`);
  assert.ok(!/stripTags\(c\.full \|\| c\.sentence/.test(INK), 'eski anahtar sirasi kalmis');
});

test('kacirma TEK yerden geciyor: dort dal da guvenli() cagiriyor', () => {
  /* Dallardan biri ileride dogrudan enterpolasyona donerse XSS geri gelir;
     bu yuzden sayiyi kilitliyorum. */
  const i = DASH_SRC.indexOf('function formatSummaryText(');
  const govde = DASH_SRC.slice(i, DASH_SRC.indexOf('\nfunction ', i + 10));
  assert.equal((govde.match(/\$\{guvenli\(/g) || []).length, 4,
    'dort enterpolasyon noktasinin hepsi guvenli() uzerinden gecmiyor');
  assert.ok(!/\$\{inlineMarkdown\(/.test(govde), 'kacirmayan inlineMarkdown hala kullaniliyor');
  assert.ok(!/\$\{trimmed\}|\$\{headingText\}/.test(govde), 'ciplak enterpolasyon kalmis');
});

summary().then(() => process.exit(process.exitCode || 0));
