/* ==========================================================================
   ACADEX — GEMINI PARALEL MODU TESTLERI (tests/gemini-parallel.js)

   GEMINI_MODE=parallel'de Groq icin yazilmis hattin TUM cagrilari
   fetchWithRetry -> groqViaGemini uzerinden Gemini'ye cevriliyor. Bu
   adaptor bozulursa her ozet bozulur, ama hicbir cagri noktasi bunu
   gostermez — o yuzden ceviri burada ag olmadan test ediliyor.

   Calistirma:  node tests/gemini-parallel.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');
const { readSource } = require('./_ts-extract.js');
// Kaynak metni: bazi iddialar davranisi degil SIRAYI/BAGLANTIYI olcuyor.
const SRC = readSource('supabase/functions/summarize-document/index.ts');

const { test, summary } = makeRunner();

const denoEnv = new Map();
globalThis.Deno = { env: { get: (k) => (denoEnv.has(k) ? denoEnv.get(k) : undefined) } };

const G = loadFromSource('supabase/functions/summarize-document/index.ts', [
  'MODEL_HEAVY', 'MODEL_FAST', 'MODEL_EXTRACT',
  'GEMINI_MODEL_CANDIDATES', 'geminiModelMissing', 'geminiQuotaExhausted', 'extractGeminiText',
  'geminiMode', 'geminiParallelActive',
  'GROQ_CHAT_URL', 'GEMINI_GENERATE_BASE', 'GEMINI_FAST_MODEL_DEFAULT', 'GEMINI_PARALLEL_MIN_OUTPUT',
  'geminiParallelUsage', 'resetGeminiParallelUsage',
  'geminiSerit', 'URL_BENZERI_RE', 'BOZUK_US_RE', 'CAG_YILI_RE', 'DERS_KODU_RE', 'ATIF_ETIKETI_RE', 'BOLUK_ONDALIK_RE', 'BANT_ETIKETI_RE', 'KAYNAKCA_CILT_RE', 'PROJE_KODU_RE', 'KOD_DISI', 'DERS_KODU_BOSLUKLU_RE', 'SLAYT_ALTBILGI_RE', 'SAYFA_ISARETI_RE', 'YUZDE_CEVRIM_RE', 'ARA_HESAP_ISLEM_RE', 'ARA_HESAP_SAF_SOL_RE', 'ARA_HESAP_MIN_OPERAND', 'araHesabiAyikla', 'SAYI_BELIRTECI', 'sayiOkumalari',
  // Grafik eksen centikleri hedeften duser (31.10.2026 olcumu).
  'EKSEN_MIN_UZUNLUK', 'eksenCentikleriniAyikla',
  'distinctiveNumbers',
  'geminiModelsForLane', 'openAiContentToGeminiParts', 'groqViaGemini',
  'geminiHataCevabi', 'geminiKotaOlu', 'geminiSorunlu', 'geminiModelDiri', 'geminiDiriAdayVar',
  'GEMINI_TAM_MODEL_BUTCESI', 'GEMINI_SORUNLU_ESIK', 'GEMINI_KOTA_OLU_MS',
  // Cagri basina Gemini dilimi ve zaman asimi centigi (29.10.2026 olcumu).
  'GEMINI_PARALLEL_MAX_CALL_MS', 'GEMINI_PARALLEL_MIN_CALL_MS',
  'GEMINI_PARALLEL_DENEME_TABANI', 'geminiParalelCagriButcesi', 'geminiZamanAsimiCentik',
  'GEMINI_LITE_CANDIDATES',
  'GEMINI_PARALLEL_CONCURRENCY'
]);

// ---------------------------------------------------------------------------
// Kukla fetch
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch;
let calls = [];
function stubFetch(responses) {
  calls = [];
  const queue = responses.slice();
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    const next = queue.shift();
    if (!next) throw new Error('kukla fetch: beklenenden fazla cagri');
    /* ZAMAN ASIMI TAKLIDI (01.11.2026): gercek kosuda fetch ABORT ile
       FIRLATIYOR, status dondurmuyor — yedek yolu testi bunu gerektiriyor. */
    if (next.throws) throw next.throws;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.json,
      text: async () => (typeof next.text === 'string' ? next.text : JSON.stringify(next.json ?? {}))
    };
  };
}
function restoreFetch() { globalThis.fetch = realFetch; }
async function quiet(fn) {
  const log = console.log, warn = console.warn, error = console.error;
  console.log = console.warn = console.error = () => {};
  try { return await fn(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

const OK = (text, extra = {}) => ({
  status: 200,
  json: {
    candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 50, totalTokenCount: 1250 },
    ...extra
  }
});

function groqBody(overrides = {}) {
  return {
    body: JSON.stringify({
      model: G.MODEL_EXTRACT,
      temperature: 0.2,
      max_completion_tokens: 3072,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'SISTEM' },
        { role: 'user', content: 'METIN' }
      ],
      ...overrides
    })
  };
}

// ===========================================================================
// Mod secimi
// ===========================================================================
test('geminiMode: parallel taninir, bilinmeyen deger shadow', () => {
  denoEnv.set('GEMINI_MODE', 'Parallel');
  assert.equal(G.geminiMode(), 'parallel');
  denoEnv.set('GEMINI_MODE', 'baska');
  assert.equal(G.geminiMode(), 'shadow');
  denoEnv.delete('GEMINI_MODE');
  assert.equal(G.geminiMode(), 'shadow');
});

test('geminiParallelActive: anahtar yoksa kapali (Groq yolu bozulmaz)', () => {
  denoEnv.set('GEMINI_MODE', 'parallel');
  denoEnv.delete('GEMINI_API_KEY');
  assert.equal(G.geminiParallelActive(), false);
  denoEnv.set('GEMINI_API_KEY', 'k');
  assert.equal(G.geminiParallelActive(), true);
  denoEnv.delete('GEMINI_MODE');
  assert.equal(G.geminiParallelActive(), false);
});

// ===========================================================================
// Model sirasi
// ===========================================================================
/* ESKIDEN "ucuz modelle baslar" DIYORDU — 28.10.2026'da degisti.
   Flash-Lite pencerelerde Window 1 sayisal kapsamasini 0/11'e dusurdu;
   serit basi tam model oldu, Flash-Lite son careye alindi. Liste kuralinin
   geri kalani (tekrar eden aday olmamasi) aynen duruyor. */
test('geminiModelsForLane: aday listesinde tekrar eden model olmaz', () => {
  denoEnv.delete('GEMINI_MODEL'); denoEnv.delete('GEMINI_FAST_MODEL');
  const m = G.geminiModelsForLane(G.MODEL_EXTRACT);
  assert.equal(new Set(m).size, m.length, 'tekrar eden aday olmamali');
  assert.ok(m.includes(G.GEMINI_FAST_MODEL_DEFAULT), 'flash-lite listeden silinmemeli');
});

test('geminiModelsForLane: MODEL_HEAVY agir modelle baslar, secret ezer', () => {
  denoEnv.set('GEMINI_MODEL', 'agir-x');
  denoEnv.set('GEMINI_FAST_MODEL', 'hafif-y');
  assert.equal(G.geminiModelsForLane(G.MODEL_HEAVY)[0], 'agir-x');
  assert.equal(G.geminiModelsForLane(G.MODEL_FAST)[0], 'hafif-y');
  denoEnv.delete('GEMINI_MODEL'); denoEnv.delete('GEMINI_FAST_MODEL');
});

// ===========================================================================
// Icerik cevirisi
// ===========================================================================
test('openAiContentToGeminiParts: duz metin', () => {
  assert.deepEqual(G.openAiContentToGeminiParts('merhaba'), [{ text: 'merhaba' }]);
  assert.deepEqual(G.openAiContentToGeminiParts(''), []);
});

test('openAiContentToGeminiParts: PNG ve mini-PDF data URL inlineData olur', () => {
  const parts = G.openAiContentToGeminiParts([
    { type: 'text', text: 'bak' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
    { type: 'image_url', image_url: { url: 'data:application/pdf;base64,JVBERi0x' } },
    { type: 'image_url', image_url: { url: 'https://disari.example/x.png' } }
  ]);
  assert.deepEqual(parts, [
    { text: 'bak' },
    { inlineData: { mimeType: 'image/png', data: 'AAAA' } },
    { inlineData: { mimeType: 'application/pdf', data: 'JVBERi0x' } }
  ], 'uzak URL atlanir, data URL mime korunur');
});

// ===========================================================================
// groqViaGemini
// ===========================================================================
test('groqViaGemini: istek Gemini bicimine cevrilir, cevap Groq biciminde doner', async () => {
  denoEnv.set('GEMINI_API_KEY', 'k');
  G.resetGeminiParallelUsage();
  stubFetch([OK('{"summary":"x"}')]);
  try {
    const res = await quiet(() => G.groqViaGemini(groqBody(), 1, 5000));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.choices[0].message.content, '{"summary":"x"}');
    assert.equal(data.choices[0].finish_reason, 'stop');
    assert.equal(data.usage.prompt_tokens, 1000);

    const call = calls[0];
    // Pencere seridi Lite adaylarindan baslar (RPD 500 / RPD 20 takasi,
    // bkz. GEMINI_LITE_CANDIDATES ustundeki panel okumasi).
    assert.ok(
      G.GEMINI_LITE_CANDIDATES.some((m) => call.url.startsWith(G.GEMINI_GENERATE_BASE + '/' + m + ':generateContent')),
      `Lite modeli bekleniyordu, cagrilan: ${call.url}`
    );
    assert.equal(call.body.systemInstruction.parts[0].text, 'SISTEM');
    assert.deepEqual(call.body.contents, [{ role: 'user', parts: [{ text: 'METIN' }] }]);
    assert.equal(call.body.generationConfig.responseMimeType, 'application/json');
    assert.ok(call.body.generationConfig.maxOutputTokens >= G.GEMINI_PARALLEL_MIN_OUTPUT, 'Groq tavani Gemini cikisini kismamali');

    assert.equal(G.geminiParallelUsage.calls, 1);
    assert.equal(G.geminiParallelUsage.output, 200);
  } finally { restoreFetch(); }
});

test('groqViaGemini: model yoksa (404) sonraki adaya gecer', async () => {
  stubFetch([{ status: 404, text: 'model not found' }, OK('{}')]);
  try {
    const res = await quiet(() => G.groqViaGemini(groqBody(), 1, 5000));
    assert.equal(res.status, 200);
    assert.notEqual(calls[0].url, calls[1].url, 'ikinci deneme baska modelle');
  } finally { restoreFetch(); }
});

test('groqViaGemini: thinkingConfig reddedilirse dusurulup ayni model tekrar denenir', async () => {
  stubFetch([{ status: 400, text: 'Unknown name "thinkingConfig"' }, OK('{}')]);
  try {
    const res = await quiet(() => G.groqViaGemini(groqBody(), 0, 5000));
    assert.equal(res.status, 200);
    assert.ok(calls[0].body.generationConfig.thinkingConfig);
    assert.equal(calls[1].body.generationConfig.thinkingConfig, undefined);
    assert.equal(calls[0].url, calls[1].url, 'ayni model');
  } finally { restoreFetch(); }
});

/* DAVRANIS DEGISTI (28.10.2026). Eskiden gunluk kotada hic baska model
   denemeden donuyordu — limit PROJE basina saniliyordu. Panel limitin MODEL
   basina oldugunu gosterdi; donmek yuzunden anlati yazari atlanmisti.
   Artik olu model isaretlenip SIRADAKI aday deneniyor. */
test('groqViaGemini: gunluk kotada siradaki aday denenir', async () => {
  G.geminiKotaOlu.clear(); G.geminiSorunlu.clear();
  denoEnv.delete('GEMINI_MODEL'); denoEnv.delete('GEMINI_FAST_MODEL');
  stubFetch([
    { status: 429, text: 'Quota exceeded for GenerateRequestsPerDay' },
    OK('{"ok":1}')
  ]);
  try {
    const res = await quiet(() => G.groqViaGemini(groqBody(), 2, 5000));
    assert.equal(res.status, 200, 'ikinci aday cevap vermeli');
    assert.equal(calls.length, 2, 'tam olarak bir sonraki aday denenmeli');
    assert.ok(G.geminiKotaOlu.size >= 1, 'kotasi dolan model isaretlenmeli');
  } finally { restoreFetch(); G.geminiKotaOlu.clear(); }
});

/* Hepsi kotadaysa yine de gecerli JSON ve 4xx donmeli. */
/* YEDEK YOLU: "CEVAP YOK" ISE GROQ DENENIR (01.11.2026, uc kosuda olculdu)

   Eski surum bu halde 502 donduruyordu ve o 502 dogrudan cagirana gidiyordu,
   yani fetchWithRetry'nin GERCEK Groq kolu hic denenmiyordu:
     Gemini paralel: cagri butcesi doldu (15000ms, caginin zaman asimi 40000ms)
       — kalan Gemini adaylari denenmiyor, Groq'a birakiliyor
     Window 1 attempt 1 failed: Groq API error (502): {"error":{"message":
       "Gemini paralel: hicbir model cevap vermedi (0: zaman asimi (15000ms))"}}
     EKSIK BELGE: 2/2 pencere dustu [1,2] — 11138 karakter karta hic girmedi
   Ogrenci kartta "eksik ozet: 2/2 pencere dustu" gordu. null artik
   "ben yapamadim, sen dene" demek. */
test('groqViaGemini: butun adaylar kotadaysa NULL doner (Groq denenebilsin)', async () => {
  G.geminiKotaOlu.clear(); G.geminiSorunlu.clear();
  stubFetch(Array.from({ length: 12 }, () => ({ status: 429, text: 'Quota exceeded for GenerateRequestsPerDay' })));
  try {
    const res = await quiet(() => G.groqViaGemini(groqBody(), 0, 5000));
    assert.equal(res, null,
      'cevap YOK halinde null donmeli — 502 cagiranin Groq kolunu kapatiyor');
  } finally { restoreFetch(); G.geminiKotaOlu.clear(); }
});

test('groqViaGemini: zaman asiminda da NULL doner', async () => {
  /* Olculen hal tam buydu: zincir butcesi doldu, hicbir model cevap vermedi. */
  G.geminiKotaOlu.clear(); G.geminiSorunlu.clear();
  stubFetch(Array.from({ length: 12 }, () => ({ throws: new Error('zaman asimi (15000ms)') })));
  try {
    const res = await quiet(() => G.groqViaGemini(groqBody(), 0, 5000));
    assert.equal(res, null, 'zaman asiminda null donmeli');
  } finally { restoreFetch(); G.geminiKotaOlu.clear(); G.geminiSorunlu.clear(); }
});

test('fetchWithRetry NULL gelince GERCEK Groq yoluna geciyor', () => {
  /* Kaynak kontrolu: yakalama null dondugunde asagidaki Groq dongusune
     DUSMELI, erken return etmemeli. */
  const SRC = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  assert.ok(/const geminiCevabi = await groqViaGemini\(options, maxRetries, timeoutMs\)/.test(SRC),
    'yakalama sonucu bir degiskene alinmali — dogrudan return Groq kolunu kapatiyor');
  assert.ok(/if \(geminiCevabi\) return geminiCevabi/.test(SRC),
    'yalnizca GERCEK cevap dondurulmeli');
  assert.ok(!/if \(geminiDiriAdayVar\(\)\) return groqViaGemini/.test(SRC),
    'eski dogrudan-return yolu geri gelmis — yedek yolu yine kopar');
});

test('groqViaGemini: cikti tavani finish_reason=length olarak isaretlenir', async () => {
  stubFetch([{ status: 200, json: { candidates: [{ content: { parts: [{ text: '{"a":' }] }, finishReason: 'MAX_TOKENS' }] } }]);
  try {
    const res = await quiet(() => G.groqViaGemini(groqBody(), 0, 5000));
    const data = await res.json();
    assert.equal(data.choices[0].finish_reason, 'length');
  } finally { restoreFetch(); }
});

/* ---------------------------------------------------------------------------
   API SURUMU — 28.10.2026'da olculmus, tekrar v1beta'ya kaymasin.

   Ayni anahtar/model/govde ile v1beta once 404 sonra 503 donuyordu, v1 ise
   200. ch7 boyutunda (39.526 krk) tam istek: v1beta 503, v1 200 / 7 sn.
   Sabit v1beta'ya donerse butun Gemini yolu yine sessizce Groq'a duser ve
   bu testten baska hicbir sey uyarmaz.
   --------------------------------------------------------------------------- */
test('GEMINI_GENERATE_BASE v1 surumunu kullanir (v1beta bu hesapta 404/503 saliniyor)', () => {
  assert.ok(
    G.GEMINI_GENERATE_BASE.includes('/v1/models'),
    `v1 bekleniyordu, gelen: ${G.GEMINI_GENERATE_BASE}`
  );
  assert.ok(!G.GEMINI_GENERATE_BASE.includes('v1beta'));
  assert.ok(!G.GEMINI_GENERATE_BASE.includes('v1alpha'));
});

/* Ucretsiz katmanda limit model basina RPM 5. Pencereler ayni seride gittigi
   icin eszamanlilik 5'e dayanirsa ilk kosu 429 yer; 4 bir kosuyu guvenle
   gecirir ve ard arda kosular icin pay birakir. */
test('GEMINI_PARALLEL_CONCURRENCY ucretsiz katmanin RPM 5 limitinin altinda', () => {
  assert.ok(G.GEMINI_PARALLEL_CONCURRENCY >= 1);
  assert.ok(
    G.GEMINI_PARALLEL_CONCURRENCY <= 4,
    `RPM 5 icin en fazla 4 bekleniyordu, gelen: ${G.GEMINI_PARALLEL_CONCURRENCY}`
  );
});

/* ---------------------------------------------------------------------------
   28.10.2026 canli kosusunun iki hatasi.
   --------------------------------------------------------------------------- */

/* Pencereler flash-lite'a gidince Window 1 sayisal kapsamasi 0/11 cikti.
   Serit basi artik tam model; Flash-Lite yalnizca son care olarak listede. */
/* RPD 500 / RPD 20 takasi: pencereler kosu basina en cok cagri gonderen yer,
   onlar Lite'ta kalir. Tam modeller listeden silinmez, SONDA derin yedek. */
test('geminiModelsForLane: pencere seridi Lite ile baslar, tam modeller sonda', () => {
  G.geminiKotaOlu.clear(); G.geminiSorunlu.clear(); G.resetGeminiParallelUsage();
  denoEnv.delete('GEMINI_MODEL'); denoEnv.delete('GEMINI_FAST_MODEL');
  const liste = G.geminiModelsForLane(G.MODEL_EXTRACT);
  assert.ok(G.GEMINI_LITE_CANDIDATES.includes(liste[0]), `Lite bekleniyordu, gelen: ${liste[0]}`);
  const ilkTam = liste.findIndex((m) => G.GEMINI_MODEL_CANDIDATES.includes(m));
  const sonLite = liste.map((m, i) => (G.GEMINI_LITE_CANDIDATES.includes(m) ? i : -1)).filter((i) => i >= 0).pop();
  assert.ok(ilkTam > sonLite, 'tam modeller butun Lite adaylarindan SONRA gelmeli');
});

/* RPD model basina 20; pencereleri tek modele yigmak hem kaliteyi hem
   kotayi ayni yere bagliyordu. Ard arda cagrilar sirayla dagilmali. */
/* Sira SABIT: her cagri olculmus calisan modelden baslar. Donusumlu sira
   19:21 kosusunda 3.1'i basa alip iki 503 yedirmisti. */
test('geminiModelsForLane: her cagri ayni Lite modeliyle baslar', () => {
  G.geminiKotaOlu.clear(); G.geminiSorunlu.clear();
  denoEnv.delete('GEMINI_MODEL'); denoEnv.delete('GEMINI_FAST_MODEL');
  for (let i = 0; i < 4; i++) {
    assert.equal(G.geminiModelsForLane(G.MODEL_EXTRACT)[0], G.GEMINI_LITE_CANDIDATES[0]);
  }
});

/* Agir serit (sentez / anlati yazari) de Lite'ta: tam Flash'in RPD'si 20 ve
   19:21 kosusunda anlati yazari tam o yuzden dustu. */
test('geminiModelsForLane: agir serit de Lite ile baslar', () => {
  G.geminiKotaOlu.clear(); G.geminiSorunlu.clear();
  denoEnv.delete('GEMINI_MODEL'); denoEnv.delete('GEMINI_FAST_MODEL');
  assert.equal(G.geminiModelsForLane(G.MODEL_HEAVY)[0], G.GEMINI_LITE_CANDIDATES[0]);
  denoEnv.set('GEMINI_MODEL', 'elle-verilen');
  try {
    assert.equal(G.geminiModelsForLane(G.MODEL_HEAVY)[0], 'elle-verilen', 'secret hala ezebilmeli');
  } finally { denoEnv.delete('GEMINI_MODEL'); }
});

/* GEMINI_FAST_MODEL acikca verilmisse dagitim yapilmaz. */
test('geminiModelsForLane: GEMINI_FAST_MODEL verilmisse dagitim devre disi', () => {
  denoEnv.set('GEMINI_FAST_MODEL', 'gemini-3.5-flash-lite');
  try {
    assert.equal(G.geminiModelsForLane(G.MODEL_EXTRACT)[0], 'gemini-3.5-flash-lite');
    assert.equal(G.geminiModelsForLane(G.MODEL_EXTRACT)[0], 'gemini-3.5-flash-lite');
  } finally { denoEnv.delete('GEMINI_FAST_MODEL'); }
});

/* Ham govde 800 karakterde kesiliyor; oldugu gibi dondurulunce cagiranda
   "Unterminated string in JSON at position 800" oluyordu. Zarf artik her
   zaman gecerli JSON, kesik govde bir ALANIN icinde tasiniyor. */
test('groqViaGemini: terminal hata cevabi gecerli JSON doner', async () => {
  G.geminiKotaOlu.clear(); G.geminiSorunlu.clear();
  stubFetch([{ status: 400, text: 'bu hic JSON degil ' + 'y'.repeat(900) }]);
  try {
    const res = await quiet(() => G.groqViaGemini(groqBody(), 0, 5000));
    assert.equal(res.status, 400);
    const data = await res.json();   // eskiden SyntaxError atiyordu
    assert.ok(data.error.message.includes('400'));
    assert.ok(data.error.gemini_body.length <= 400, 'ham govde alanda ve kirpik');
  } finally { restoreFetch(); G.geminiKotaOlu.clear(); }
});

/* URL ve dosya adi icindeki sayilar HEDEF sayilmaz: BUS211 kosusunda kart
   "%41 sayisal kapsama" rozetiyle cikmisti, kayiplarin cogu linkti. */
test('distinctiveNumbers: URL ve dosya adi icindeki sayilar hedef degildir', () => {
  const link = 'http://www.gly.uga.edu/railsback/1122sciencedefns.html ' +
               'article-0-03B05683000005DC-812_306x516.jpg';
  assert.deepEqual(G.distinctiveNumbers(link), [], 'linkten hedef sayi cikmamali');
  // Gercek icerik sayisi etkilenmemeli.
  const metin = 'Leaders controlled resources for 5,000 to 20,000 people.';
  const hedef = G.distinctiveNumbers(metin);
  assert.ok(hedef.includes(5000) && hedef.includes(20000), `gelen: ${hedef.join(', ')}`);
});

/* BOLUNMUS ONDALIK ve BANT ETIKETI (04.11.2026 olcumu).

   Kosu: 2-Eritrositler -3 (1).pdf, canli log
     "Son kart sayisal kapsama: 21/31 (%68) — kayip: 0.4, 600, 110, 2.1, 2.2,
      2.6, 4.5, 6.25 +2"
   Kayiplar incelendi ve IKI SINIFA ayrildi (belgeye sadakat ilkesi: artefakt
   ise metrik duzeltilir, gercek icerikse cikarim duzeltilir):

   ARTEFAKT (metrik duzeltildi):
     0.4            <- "Erkek: ~ 5 .4 milyon/mm3"   PDF ondaligi bosluklu
                       birakmis; jeton ".4" olup 0.4 okunuyordu. Iki yonlu
                       hata: hayalet hedef uretiyor VE gercek 5.4'u kaciriyor.
     2.1 2.2 2.6    <- "Band 2.1, 2.2, 2.3 ve 2.6"  eritrosit zar proteini
                       ADI, olculen miktar degil.
   GERCEK ICERIK (metrige dokunulmadi, kapsama aciginda kaliyor):
     600            <- "600- 900 g Hb"
     110            <- "MCV 110 uzerine cikarsa folat/B12 eksikligi"

   Bu test iki onarimi ve UC regresyon korumasini birlikte tutuyor. */
test('distinctiveNumbers: bolunmus ondalik ONARILIR, bant etiketi ELENIR', () => {
  // ONARIM: 5.4 geri geliyor, hayalet 0.4 gidiyor.
  assert.deepEqual(
    G.distinctiveNumbers('normal sayısı Erkek: ~ 5 .4 milyon/mm3 Kadın: ~ 4,8milyon/mm3'),
    [5.4, 4.8], 'bolunmus ondalik onarilmiyor');

  // ELEME: etiket listenin DEVAMINI da yutmali, yoksa 2.2/2.3/2.6 hedef kalir.
  assert.deepEqual(
    G.distinctiveNumbers('band 2: spektrinin iki zinciri • Band 2.1, 2.2, 2.3 ve 2.6 :ankirin'),
    [], 'bant etiketleri hedef sayiliyor');

  /* KORUMA 1: lookbehind. "husband" icindeki "band" eslesmemeli. */
  assert.deepEqual(G.distinctiveNumbers('her husband 2.5 kg aldi'), [2.5],
    'sozcuk ici eslesme gercek sayiyi yedi');

  /* KORUMA 2: noktayla BASLAYAN gercek degerler. SAYI_BELIRTECI bastaki
     noktayi bilerek kabul ediyor (".07 tons", ".69%" Amerikan istatistik
     gelenegi; referans destenin alti sonucundan ikisi tam bu bicimde).
     Onarim bunlari bozmamali. */
  assert.deepEqual(G.distinctiveNumbers('slaytta .07 tons ve .69% yaziyor'), [0.07, 0.69],
    'nokta onekli gercek degerler kayboldu');

  /* KORUMA 3: gercek icerik kaybi artefakt sayilmamali — 600/900 ve 110
     olcude KALMALI, yoksa kapsama acigi suslenmis olur. */
  const hb = G.distinctiveNumbers('Erişkin bir erkekte yaklaşık 600- 900 g Hb bulunur.');
  assert.ok(hb.includes(600) && hb.includes(900), `gelen: ${hb.join(', ')}`);
  const mcv = G.distinctiveNumbers('hacmi:80-100 fl) 110 üzerine çıkarsa folat');
  assert.ok(mcv.includes(110), `gelen: ${mcv.join(', ')}`);

  /* KORUMA 4: satir sonu birlestirilmemeli — "Tablo 5\n.4" sayfa kirilmasi
     olabilir, birlestirmek uydurma sayi uretir. */
  assert.ok(!G.distinctiveNumbers('Tablo 5\n.4 oranini gosterir').includes(5.4),
    'satir sonu uzerinden ondalik birlestirildi');
});

test('distinctiveNumbers: KAYNAKCA kunyesi hedef degildir (10.11.2026)', () => {
  /* Olculen kosu: RSH Hemsireligi.pdf, canli log
       "Window 1 sayisal kapsama: 0/4 (%0) — kayip: 3787, 976, 765, 805"
     ve "kayiplari nerede" satirlarinin DORDU de kaynakcaya isaret ediyordu.
     Yani ogrenciye gosterilen "sayisal kapsama %0" rozeti UYDURMAYDI: kart
     gercekte eksik degil, metrik dergi sayfa numarasini olgu sayiyordu.
     Belgeye sadakat ilkesinin ayrimi: kapsama dusukse cikarim duzeltilir,
     ARTEFAKT HARIC — bu dorduncu artefakt sinifi.

     MUHAFIZ DEGERLERI 100 USTU SECILDI (bilerek): fonksiyonun sonunda
     `if (yil || (!kesirli && v < 100)) continue` var, yani 100 altindaki
     tam sayi ile 1500-2100 arasi yil ZATEN hedef olmuyor. Muhafizi 5 veya
     15 ile yazmak hicbir sey olcmez — kural kaldirilsa da test gecer.
     Ayni filtre, logdaki kayip listesinde 2018/2020/2021 bulunmamasinin da
     sebebi. */
  const KAYNAKCA = [
    ['Proje numarası: TSA-2018-3787, Çukurova Nobel Tıp Kitabevi; 2020', 3787],
    ['Issues Ment Health Nurs. 2020;41(11):976-84.', 976],
    ['Int J Ment Health Nurs. 2018;27(2):765-73.', 765],
    ['İstanbul Tıp Kitabevleri; 2021. p.798-805.', 805],
  ];
  for (const [satir, kayip] of KAYNAKCA) {
    const out = G.distinctiveNumbers(satir);
    assert.ok(!out.includes(kayip),
      'kaynakcadan ' + kayip + ' hedef olarak cikti: [' + out.join(', ') + '] <- ' + satir);
  }

  /* ARALIGIN IKINCI YARISI: eski desen "p.798"i eliyor, "-805"i BIRAKIYORDU.
     Regresyonun tam yeri burasi. */
  assert.ok(!G.distinctiveNumbers('p.798-805.').includes(805),
    'sayfa araliginin ikinci yarisi hedef kaldi');
  assert.ok(!G.distinctiveNumbers('sayfa 120-240 arasinda').includes(240),
    'sayfa araliginin ikinci yarisi hedef kaldi (Turkce onek)');

  /* KORUMA 1: tire ile sayi arasinda BOSLUK varsa aralik SAYILMAZ — yoksa
     "chapter 3 - 500 million" cumlesinde gercek miktar yutulur. Gercek
     atiflarda aralik bosluksuz yazilir (976-84, 798-805). */
  assert.ok(G.distinctiveNumbers('chapter 3 - 500 million people').includes(500),
    'bosluklu tireden sonraki gercek miktar yutuldu');

  /* KORUMA 2: dergi kuralinda PARANTEZ ZORUNLU. Parantezsiz "41:976"
     bicimi de kabul edilse onunla birlikte saat ("14:30") ve oran ("3:1")
     da yutulurdu; ikisi de gercek icerik. Bu satir kuralin darligini
     dogrudan olcuyor. */
  assert.ok(G.distinctiveNumbers('Sure 41:976 olarak kaydedildi').includes(976),
    'parantezsiz iki nokta bicimi de elendi — kural fazla genis');
  const saat = G.distinctiveNumbers('Saat 14:30 itibariyle 250 kisi basvurdu');
  assert.ok(saat.includes(250), 'saat kurali gercek miktari yuttu: [' + saat.join(', ') + ']');

  /* KORUMA 3: kaynakca kalibina BENZEMEYEN gercek olgular yerinde. 976
     tek basina gectiginde olcum degeridir; 3.787 ise binlik ayracli sayi,
     proje kodunun son blogu degil. */
  assert.ok(G.distinctiveNumbers('Hemoglobin 976 g/L olarak olculdu').includes(976),
    'ciplak 976 elendi — kural fazla genis');
  assert.ok(G.distinctiveNumbers('Toplam 3.787 hasta izlendi').includes(3.787),
    'binlik ayracli 3.787 proje kodu sanildi');

  /* KORUMA 4: proje kodu kurali BUYUK HARF istiyor (i bayragi yok) —
     kucuk harfli tireli siradan ifade yutulmamali. */
  assert.ok(G.distinctiveNumbers('sonuc-2018-450 birim artti').includes(450),
    'kucuk harfli tireli ifade proje kodu sanildi');
});

/* ---------------------------------------------------------------------------
   19:03 kosusunun israfi: kotasi dolan modele yeniden istek atmak.
   Panelden okunan gercek limitler — Flash-Lite RPD 500, tam Flash RPD 20.
   --------------------------------------------------------------------------- */

test('kotasi dolan model aday listesinden dusurulur', () => {
  G.geminiKotaOlu.clear(); G.geminiSorunlu.clear(); G.resetGeminiParallelUsage();
  denoEnv.delete('GEMINI_MODEL'); denoEnv.delete('GEMINI_FAST_MODEL');
  const olu = G.GEMINI_LITE_CANDIDATES[0];
  G.geminiKotaOlu.set(olu, Date.now());
  try {
    assert.equal(G.geminiModelDiri(olu), false);
    for (let i = 0; i < 6; i++) {
      assert.ok(!G.geminiModelsForLane(G.MODEL_EXTRACT).includes(olu), 'olu model listede olmamali');
    }
  } finally { G.geminiKotaOlu.clear(); }
});

test('ust uste 503/zaman asimi veren model esikten sonra atlanir', () => {
  G.geminiKotaOlu.clear(); G.geminiSorunlu.clear();
  const m = G.GEMINI_LITE_CANDIDATES[1];
  G.geminiSorunlu.set(m, G.GEMINI_SORUNLU_ESIK);
  try {
    assert.equal(G.geminiModelDiri(m), false);
    assert.ok(!G.geminiModelsForLane(G.MODEL_EXTRACT).includes(m));
  } finally { G.geminiSorunlu.clear(); }
});

/* Tam modellerin RPD'si 20; bir kosu havuzu bosaltmamali. Butce dolunca
   serit basi RPD 500'luk Flash-Lite'a doner. */
/* Tam model istekleri sayiliyor ve her kosuda sifirlaniyor: RPD 20'lik
   havuza kac kez dokunuldugunu gormeden ayar yapilamaz. */
test('tam model istek sayaci her kosuda sifirlanir', () => {
  G.geminiSerit.tamIstek = G.GEMINI_TAM_MODEL_BUTCESI;
  G.resetGeminiParallelUsage();
  assert.equal(G.geminiSerit.tamIstek, 0, 'butce her kosuda sifirlanmali');
});

/* Butun modeller olunce paralel mod belgeyi batiriyordu (19:03/19:07:
   "All windows failed" -> nobetci 141 sn -> failed). Artik diri aday
   kalmayinca yakalama yapilmiyor, cagri gercek Groq'a gidiyor. */
test('diri aday kalmayinca yakalama devre disi kalir (Groq yedegi)', () => {
  G.geminiKotaOlu.clear(); G.geminiSorunlu.clear();
  denoEnv.delete('GEMINI_MODEL'); denoEnv.delete('GEMINI_FAST_MODEL');
  assert.equal(G.geminiDiriAdayVar(), true);
  const simdi = Date.now();
  for (const m of [...G.GEMINI_LITE_CANDIDATES, ...G.GEMINI_MODEL_CANDIDATES]) G.geminiKotaOlu.set(m, simdi);
  G.geminiKotaOlu.set(G.GEMINI_FAST_MODEL_DEFAULT, simdi);
  try {
    assert.equal(G.geminiDiriAdayVar(), false, 'hepsi oluyken yedege gecilmeli');
  } finally { G.geminiKotaOlu.clear(); }
});

/* ==========================================================================
   CAGRI BASINA GEMINI DILIMI (29.10.2026 — ACCOUNTING chapter 6 OLCUMU)
   ==========================================================================
   Kart cikti ama AC KALDI: gorsel gecis, anlati yazari ve review ucu
   birden 'butce 0ms' diye atlandi. Loglardan zaman cizelgesi
   (t=0 -> 18:07:53,99):

     t=  2,1 sn  2 pencere, 24.138 krk, 57 sayfa
     t= 42,1 sn  Gemini[gemini-3.5-flash-lite] paralel: zaman asimi (40000ms)
     t= 63,4 sn  Window 1 ok [openai/gpt-oss-20b]   <- gercek Groq
     t= 93,5 sn  Gemini[gemini-3.5-flash-lite] paralel: zaman asimi (30000ms)
     t=123,2 sn  sentez bitti, 6 bolum -> 3 bolum
     t=123,2 sn  Gorsel gecis atlandi: butce 0ms
     t=123,2 sn  Madde 3: anlati yazari atlandi (butce 0 ms)
     t=123,3 sn  Review atlandi (budgetLeft=0ms)

   Iki kusur birden:
     1) groqViaGemini caginin zaman asimini OLDUGU GIBI miras aliyordu
        (40 sn / 30 sn), yani bir asamanin maliyeti `groq` degil
        `gemini_zaman_asimi + groq` oluyordu: 40+21 ve 30+30 = 121 sn.
     2) Zaman asimi 503 ile ayni agirlikta tek centik sayiliyordu, bu
        yuzden AYNI model 50 sn sonra ikinci tam zaman asimini da yakti.
   ========================================================================== */

test('Gemini dilimi caginin zaman asimini MIRAS ALMIYOR', () => {
  // Olculen iki deger: pencere 40 sn, sentez 30 sn.
  assert.ok(G.geminiParalelCagriButcesi(40000) <= G.GEMINI_PARALLEL_MAX_CALL_MS,
    '40 sn lik cagri Gemini ye 15 sn den fazlasini vermemeli');
  assert.ok(G.geminiParalelCagriButcesi(30000) <= G.GEMINI_PARALLEL_MAX_CALL_MS);
  // Gemini dilimi + gercek Groq cagrisi caginin butcesine SIGMALI.
  for (const t of [18000, 30000, 40000]) {
    assert.ok(G.geminiParalelCagriButcesi(t) <= Math.floor(t / 2),
      `${t}ms lik cagride Gemini yarisindan fazlasini aliyor`);
  }
});

test('kucuk zaman asiminda da TABAN korunuyor', () => {
  /* Review 18 sn ile cagriliyor; yarisi 9 sn. Saglikli bir Lite cagrisi
     7-22 sn araliginda donuyor, bu yuzden taban 8 sn nin altina
     inilmiyor — aksi halde Gemini hic sans bulamazdi. */
  assert.equal(G.geminiParalelCagriButcesi(18000), 9000);
  assert.ok(G.geminiParalelCagriButcesi(4000) >= G.GEMINI_PARALLEL_MIN_CALL_MS,
    'cok kucuk zaman asiminda taban uygulanmali');
  assert.ok(G.GEMINI_PARALLEL_MIN_CALL_MS < G.GEMINI_PARALLEL_MAX_CALL_MS);
  assert.ok(G.GEMINI_PARALLEL_DENEME_TABANI < G.GEMINI_PARALLEL_MIN_CALL_MS);
});

test('ZAMAN ASIMI tek centikte modeli dusurur, 503 dusurmez', () => {
  G.geminiKotaOlu.clear(); G.geminiSorunlu.clear();
  const m = G.GEMINI_LITE_CANDIDATES[0];
  try {
    G.geminiZamanAsimiCentik(m);
    assert.equal(G.geminiModelDiri(m), false,
      'ilk zaman asiminda model kosu boyunca dusmeli — dilim zaten harcandi');
    G.geminiSorunlu.clear();
    // 503 hizli doner; bir kez gormek dusurmemeli (esik oldugu gibi).
    G.geminiSorunlu.set(m, 1);
    assert.equal(G.geminiModelDiri(m), true, '503 esigi degismemis olmali');
    assert.equal(G.GEMINI_SORUNLU_ESIK, 2);
  } finally { G.geminiSorunlu.clear(); }
});

test('ZINCIR butcesi: aday listesi tavan kadar BEKLEMEZ', () => {
  /* Aday listesi 4-5 model tasiyor. Butce cagri basina degil ZINCIR
     basina olmasa tek cagri 5 x 15 = 75 sn yakabilirdi. */
  assert.match(SRC, /const zincirButcesi = geminiParalelCagriButcesi\(timeoutMs\)/,
    'zincir butcesi kurulmuyor');
  assert.match(SRC, /if \(kalan < GEMINI_PARALLEL_DENEME_TABANI\)/,
    'kalan sure denemeden ONCE kontrol edilmiyor');
  assert.match(SRC, /const denemeMs = Math\.min\(timeoutMs, kalan\)/,
    'deneme hem caginin zaman asimini hem zincir butcesini asmamali');
  const i = SRC.indexOf('zincirDoldu = true');
  const j = SRC.indexOf('geminiZamanAsimiCentik(model)');
  assert.ok(i > 0 && j > 0, 'zincir butcesi ya da zaman asimi centigi bagli degil');
});

test('butce dolunca cagri GERCEK Groq a birakiliyor', () => {
  /* Yakalama bitmezse kart hic cikmaz: diri aday kalmayinca fetchWithRetry
     zaten Groq a dusuyor, zincir butcesi de ayni kapiyi kullaniyor. */
  assert.match(SRC, /kalan Gemini adaylari denenmiyor, Groq'a birakiliyor/,
    'butce dolunca durum loglanmali — aksi halde teshis edilemez');
});

summary();
