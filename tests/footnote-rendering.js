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
  'renderMathInText', 'renderMathSymbol',
  // Formul kutusuna sigdirma (18.10.2026).
  'FORMUL_MIN_REM', 'sigdirFormulKutusu',
  // Anlati ve maddelerdeki $...$ (18.10.2026).
  'inlineMath', 'inlineMarkdown'
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
  assert.ok(INK.includes('math(plain(p))'), 'bolum maddeleri matematikten gecmiyor');
  assert.ok(!INK.includes('imath(X(plain'), 'kacir-sonra-diz sirasi geri gelmis');
  assert.ok(INK.includes('imath(typeof formatFootnoteMarkers'), 'kart maddeleri matematikten gecmiyor');
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

summary().then(() => process.exit(process.exitCode || 0));
