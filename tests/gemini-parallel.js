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

const { test, summary } = makeRunner();

const denoEnv = new Map();
globalThis.Deno = { env: { get: (k) => (denoEnv.has(k) ? denoEnv.get(k) : undefined) } };

const G = loadFromSource('supabase/functions/summarize-document/index.ts', [
  'MODEL_HEAVY', 'MODEL_FAST', 'MODEL_EXTRACT',
  'GEMINI_MODEL_CANDIDATES', 'geminiModelMissing', 'geminiQuotaExhausted', 'extractGeminiText',
  'geminiMode', 'geminiParallelActive',
  'GROQ_CHAT_URL', 'GEMINI_GENERATE_BASE', 'GEMINI_FAST_MODEL_DEFAULT', 'GEMINI_PARALLEL_MIN_OUTPUT',
  'geminiParallelUsage', 'resetGeminiParallelUsage',
  'geminiSerit', 'geminiModelsForLane', 'openAiContentToGeminiParts', 'groqViaGemini',
  'geminiHataCevabi',
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
    // Pencere seridi artik Flash-Lite'tan degil tam modellerden basliyor
    // (bkz. geminiModelsForLane ustundeki 28.10 olcumu).
    assert.ok(
      G.GEMINI_MODEL_CANDIDATES.some((m) => call.url.startsWith(G.GEMINI_GENERATE_BASE + '/' + m + ':generateContent')),
      `tam model bekleniyordu, cagrilan: ${call.url}`
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

test('groqViaGemini: gunluk kota 429 baska model denemeden doner', async () => {
  stubFetch([{ status: 429, text: 'Quota exceeded for GenerateRequestsPerDay' }]);
  try {
    const res = await quiet(() => G.groqViaGemini(groqBody(), 2, 5000));
    assert.equal(res.status, 429);
    assert.equal(calls.length, 1);
  } finally { restoreFetch(); }
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
test('geminiModelsForLane: pencere seridi tam modelle baslar, flash-lite sonda', () => {
  denoEnv.delete('GEMINI_FAST_MODEL');
  const liste = G.geminiModelsForLane(G.MODEL_EXTRACT);
  assert.ok(
    G.GEMINI_MODEL_CANDIDATES.includes(liste[0]),
    `tam model bekleniyordu, gelen: ${liste[0]}`
  );
  assert.notEqual(liste[0], G.GEMINI_FAST_MODEL_DEFAULT);
  assert.equal(liste[liste.length - 1], G.GEMINI_FAST_MODEL_DEFAULT, 'flash-lite son care olarak kalmali');
});

/* RPD model basina 20; pencereleri tek modele yigmak hem kaliteyi hem
   kotayi ayni yere bagliyordu. Ard arda cagrilar sirayla dagilmali. */
test('geminiModelsForLane: ard arda pencere cagrilari modellere dagitilir', () => {
  denoEnv.delete('GEMINI_FAST_MODEL');
  const n = G.GEMINI_MODEL_CANDIDATES.length;
  const ilkler = [];
  for (let i = 0; i < n; i++) ilkler.push(G.geminiModelsForLane(G.MODEL_EXTRACT)[0]);
  assert.equal(new Set(ilkler).size, n, `${n} ayri model bekleniyordu, gelen: ${ilkler.join(', ')}`);
});

/* GEMINI_FAST_MODEL acikca verilmisse dagitim yapilmaz. */
test('geminiModelsForLane: GEMINI_FAST_MODEL verilmisse dagitim devre disi', () => {
  denoEnv.set('GEMINI_FAST_MODEL', 'gemini-3.5-flash-lite');
  try {
    assert.equal(G.geminiModelsForLane(G.MODEL_EXTRACT)[0], 'gemini-3.5-flash-lite');
    assert.equal(G.geminiModelsForLane(G.MODEL_EXTRACT)[0], 'gemini-3.5-flash-lite');
  } finally { denoEnv.delete('GEMINI_FAST_MODEL'); }
});

/* Gunluk kota govdesi 800 karakterde kesiliyordu ve ham dondurulunce
   cagiranda "Unterminated string in JSON at position 800" oluyordu.
   Zarf artik her zaman gecerli JSON; ham govde bir alanin icinde. */
test('groqViaGemini: gunluk kota cevabi ayristirilabilir JSON doner', async () => {
  const kesik = '{"error":{"message":"' + 'x'.repeat(900);
  stubFetch([{ status: 429, text: 'Quota exceeded for GenerateRequestsPerDay ' + kesik }]);
  try {
    const res = await quiet(() => G.groqViaGemini(groqBody(), 2, 5000));
    assert.equal(res.status, 429);
    const data = await res.json();   // eskiden SyntaxError atiyordu
    assert.match(data.error.message, /gunluk kota dolu/);
  } finally { restoreFetch(); }
});

/* Ayni tuzak terminal olmayan hata yolunda da vardi. */
test('groqViaGemini: terminal hata cevabi da gecerli JSON doner', async () => {
  stubFetch([{ status: 400, text: 'bu hic JSON degil ' + 'y'.repeat(900) }]);
  try {
    const res = await quiet(() => G.groqViaGemini(groqBody(), 0, 5000));
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.message.includes('400'));
  } finally { restoreFetch(); }
});

summary();
