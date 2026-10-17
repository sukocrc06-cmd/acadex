/* ==========================================================================
   ACADEX — GEMINI YOLUNUN DAYANIKLILIGI (tests/gemini-dayaniklilik.js)

   17.10.2026'da yapilan dayaniklilik duzeltmelerini kilitler. Hepsinin
   dogdugu kosu ayni: 42 sayfalik bir destede Gemini 105 saniyeyi yakip
   hicbir sey uretmedi, Groq'a 39 saniye kaldi, bir pencere dustu ve kart
   belgenin %52'sinden yapildi — ogrenciye de tam bir kart gibi gorundu.

   Burada test edilenler (her biri ayri bir kaybi kapatiyor):

     1. GUNLUK KOTA KORUMASI. Dis dongu 4 aday model, ic dongu 5 deneme:
        kagit uzerinde 20 istek, yani gunluk kotanin TAMAMI (RPD 20). Tek
        bir PDF'in gunun tamamini yakmasi kabul edilemez.

     2. TERMINAL OLMAYAN DURUMLAR. Interactions API in_progress / queued /
        requires_action donebiliyor. Eski kod bunlari "sorun yok" sayip bos
        metin goruyor ve "cevapta metin yok" deyip SONRAKI MODELI yakiyordu.
        Arka plan yurutmesine gecildiginde bu durumlar NORMAL olacak.

     3. BUTCE SAATI. 145 saniyelik butce pipelineStartedAt'ten olculuyordu;
        o an indirme, PDF cikarma ve OCR'dan SONRA geliyor. Yani gercek
        duvar saati "145 + olculmemis hazirlik" idi ve Supabase'in ~150
        saniyelik siniri kagit uzerindekinden daha yakindi.

     4. BOZUK TASLAK. Ayristirilamayan bir Gemini taslagi 1900 satir asagiya
        tasiniyordu. Review kosarsa zararsiz; review ATLANIRSA (yani tam da
        Gemini'nin yavas oldugu kosularda) orada patliyor ve ogrenci 500
        goruyor — Groq'a dusmek icin gereken zaman coktan yanmis oluyor.

     5. EKSIK KAPSAMA GORUNUR MU. missing_windows ve skipped_stages edge
        function tarafindan YAZILIYORDU ama arayuzde hicbir sey okumuyordu:
        %23 kapsamali kart, tam kartla birebir ayni gorunuyordu.

   Calistirma:  node tests/gemini-dayaniklilik.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const FN_SRC = fs.readFileSync(path.join(ROOT, 'supabase/functions/summarize-document/index.ts'), 'utf8');
const DASH_SRC = fs.readFileSync(path.join(ROOT, 'js/dashboard.js'), 'utf8');

const denoEnv = new Map();
globalThis.Deno = { env: { get: (k) => (denoEnv.has(k) ? denoEnv.get(k) : undefined) } };

const G = loadFromSource('supabase/functions/summarize-document/index.ts', [
  'GEMINI_MODEL_CANDIDATES', 'GEMINI_MAX_REQUESTS_PER_RUN',
  'GEMINI_RPM_RETRY_MIN_REMAINING_MS', 'geminiRpmWaitMs',
  'GEMINI_ENDPOINT', 'GEMINI_INLINE_MAX_BYTES', 'GEMINI_MAX_PAGES',
  'GEMINI_MIN_BUDGET_MS', 'GEMINI_RESERVE_MS', 'GEMINI_MAX_CALL_MS',
  'GEMINI_MAX_OUTPUT_TOKENS', 'GEMINI_GROQ_RESERVE_MS', 'geminiMode',
  'GEMINI_ONLY_BUDGET_MS', 'GEMINI_ONLY_MAX_CALL_MS',
  'GEMINI_ONLY_FALLBACK_MIN_MS', 'bytesToBase64', 'geminiModelCandidates',
  'geminiModelMissing', 'geminiFormatRejected', 'GEMINI_DUSURULEBILIR',
  'geminiUnknownParameter', 'geminiQuotaExhausted', 'extractGeminiText',
  'geminiProblem', 'callGeminiOnce', 'geminiDraft'
]);

// --- kukla fetch -----------------------------------------------------------
const realFetch = globalThis.fetch;
let fetchCalls = [];
let fetchQueue = [];

function stubFetch(responses) {
  fetchCalls = [];
  fetchQueue = responses.slice();
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    const r = fetchQueue.shift() || { status: 500, text: 'kukla cevap bitti' };
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.json ?? {},
      text: async () => r.text ?? JSON.stringify(r.json ?? {})
    };
  };
}
function restoreFetch() { globalThis.fetch = realFetch; }

const BYTES = new Uint8Array([1, 2, 3, 4]);
async function quiet(fn) {
  const w = console.warn, l = console.log, e = console.error;
  console.warn = console.log = console.error = () => {};
  try { return await fn(); } finally { console.warn = w; console.log = l; console.error = e; }
}

console.log('\n1 — GUNLUK KOTA KORUMASI\n');

test('tavan, mesru akislari kesmeyecek kadar genis', () => {
  // Dort aday modelin her birini bir kez denemek, ya da taninmayan alanlari
  // dusurerek istegi duzeltmek (GEMINI_DUSURULEBILIR) hala sigmali.
  assert.ok(G.GEMINI_MAX_REQUESTS_PER_RUN >= G.GEMINI_MODEL_CANDIDATES.length,
    `tavan (${G.GEMINI_MAX_REQUESTS_PER_RUN}) aday model sayisindan ` +
    `(${G.GEMINI_MODEL_CANDIDATES.length}) kucuk — model yedeklemesi calisamaz`);
});

test('tavan, gunluk kotanin yarisindan az', () => {
  // RPD 20 panelden okundu (index.ts:5195 civari). Tek yukleme gunun
  // yarisini yakiyorsa koruma degil, kota tuketicisidir.
  assert.ok(G.GEMINI_MAX_REQUESTS_PER_RUN <= 10,
    `tavan ${G.GEMINI_MAX_REQUESTS_PER_RUN} — gunluk 20 kotaya gore fazla`);
});

test('tavana ulasinca durulur: 4 model x 5 deneme 20 istek YAPMAZ', async () => {
  // Her cevap "taninmayan alan" olsa bile dongu sonsuza kadar donmez.
  stubFetch(new Array(30).fill({ status: 503, text: 'high demand' }));
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 300_000));
    assert.equal(out, null);
    assert.ok(fetchCalls.length <= G.GEMINI_MAX_REQUESTS_PER_RUN,
      `${fetchCalls.length} istek yapildi, tavan ${G.GEMINI_MAX_REQUESTS_PER_RUN}`);
  } finally { restoreFetch(); }
});

console.log('\n2 — TERMINAL OLMAYAN DURUMLAR\n');

for (const durum of ['in_progress', 'queued', 'requires_action']) {
  test(`geminiProblem: ${durum} bir sorun olarak ADLANDIRILIR`, () => {
    const p = G.geminiProblem({ status: durum, steps: [] });
    assert.ok(p, `${durum} "sorun yok" sayiliyor — bos metin sanilip model yakilir`);
    assert.ok(/terminal degil/.test(p), `sebep acik yazilmali, gelen: ${p}`);
  });
}

test('terminal olmayan durumda SONRAKI ADAY MODEL denenmez', async () => {
  // Sorun modelde degil: yanit henuz hazir degil. Aday turlamak gunluk
  // kotadan bos yere istek goturur.
  stubFetch(new Array(10).fill({ status: 200, json: { status: 'in_progress', steps: [] } }));
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 300_000));
    assert.equal(out, null);
    assert.equal(fetchCalls.length, 1,
      `${fetchCalls.length} istek yapildi — terminal olmayan durumda tek istek yeterli`);
  } finally { restoreFetch(); }
});

test('geminiProblem: gercek terminal durumlar hala sorun sayiliyor', () => {
  assert.ok(G.geminiProblem({ status: 'failed' }));
  assert.ok(G.geminiProblem({ status: 'cancelled' }));
  assert.ok(/incomplete/.test(G.geminiProblem({ status: 'incomplete' }) || ''));
  assert.equal(G.geminiProblem({ status: 'completed', steps: [] }), null);
});

console.log('\n3 — BUTCE SAATI ISTEGIN BASINDAN\n');

test('butce istegin basindan olculuyor', () => {
  assert.ok(/const requestStartedAt = Date\.now\(\)/.test(FN_SRC),
    'requestStartedAt yok — butce hala hazirlik suresini saymiyor');
  assert.ok(/const hazirlikMs = pipelineStartedAt - requestStartedAt/.test(FN_SRC),
    'hazirlik suresi hesaplanmiyor');
});

test('hazirlik suresi HER IKI butce atamasindan da dusuluyor', () => {
  assert.ok(/PIPELINE_BUDGET_MS - hazirlikMs/.test(FN_SRC),
    'ilk butce atamasi hazirligi dusmuyor');
  assert.ok(/GEMINI_ONLY_BUDGET_MS : GEMINI_PIPELINE_BUDGET_MS\) - hazirlikMs/.test(FN_SRC),
    'Gemini moduna gecerken butce hazirligi dusmuyor — asil tehlikeli olan bu');
});

test('requestStartedAt gercekten serve() icinde, CORS dalindan sonra', () => {
  const serveAt = FN_SRC.indexOf('serve(async (req) => {');
  const reqAt = FN_SRC.indexOf('const requestStartedAt = Date.now()');
  const pipeAt = FN_SRC.indexOf('const pipelineStartedAt = Date.now()');
  assert.ok(serveAt > 0 && reqAt > serveAt, 'requestStartedAt serve() icinde degil');
  assert.ok(reqAt < pipeAt, 'requestStartedAt, pipelineStartedAt ten SONRA — olcum anlamsiz');
});

console.log('\n4 — BOZUK TASLAK DOGARKEN YAKALANIYOR\n');

test('Gemini taslagi uretildigi yerde ayristirilabilirlik icin sinaniyor', () => {
  const i = FN_SRC.indexOf('geminiResult = await geminiDraft(');
  const j = FN_SRC.indexOf("if (!geminiResult && mod === 'only')");
  assert.ok(i > 0 && j > i, 'beklenen sira bozulmus');
  const arasi = FN_SRC.slice(i, j);
  assert.ok(/JSON\.parse\(repairLatexEscapes/.test(arasi),
    'taslak dogarken ayristirilmiyor — bozuk taslak review atlandiginda 500 e gider');
  assert.ok(/geminiResult = null/.test(arasi),
    'bozuk taslak yok sayilmiyor');
});

test('bozuk taslak yedek yolu KAPATMIYOR (markFailed degil, null)', () => {
  const i = FN_SRC.indexOf('geminiResult = await geminiDraft(');
  const j = FN_SRC.indexOf("if (!geminiResult && mod === 'only')");
  const arasi = FN_SRC.slice(i, j);
  assert.ok(!/markFailed/.test(arasi),
    'bozuk taslak dogrudan basarisiz isaretliyor — oysa Groq yolu hala kart uretebilir');
});

console.log('\n5 — EKSIK KAPSAMA ARAYUZDE GORUNUYOR\n');

test('missing_windows arayuzde okunuyor', () => {
  assert.ok(/quality_meta/.test(DASH_SRC) && /missing_windows/.test(DASH_SRC),
    'missing_windows hala hicbir yerde okunmuyor — yarim kart tam kart gibi gorunur');
});

test('skipped_stages arayuzde okunuyor', () => {
  assert.ok(/skipped_stages/.test(DASH_SRC),
    'skipped_stages hala okunmuyor');
});

test('uyari rozeti kayip ORANINI soyluyor, sadece "eksik" demiyor', () => {
  const i = DASH_SRC.indexOf('const mw = qm.missing_windows');
  assert.ok(i > 0, 'rozet kodu bulunamadi');
  const blok = DASH_SRC.slice(i, i + 1200);
  assert.ok(/mw\.dusen/.test(blok) && /mw\.toplam/.test(blok),
    'oran hesaplanmiyor');
  assert.ok(/Kısmi özet/.test(blok), 'ogrenciye gosterilen metin yok');
});

test('rozet metni kacis uygulanmis veriden uretiliyor', () => {
  const i = DASH_SRC.indexOf('const ss = Array.isArray(qm.skipped_stages)');
  const blok = DASH_SRC.slice(i, i + 700);
  assert.ok(/escapeHtml\(ss\.join/.test(blok),
    'atlanan asama adlari kacirilmadan HTML e giriyor');
});

summary();
