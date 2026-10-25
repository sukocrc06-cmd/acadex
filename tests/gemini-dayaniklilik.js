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
  'GEMINI_MODEL_CANDIDATES', 'GEMINI_MAX_REQUESTS_PER_RUN', 'GEMINI_ARDISIK_GECICI_MAX', 'GEMINI_YARIS_GENISLIGI_VARSAYILAN', 'geminiYarisGenisligi', 'GEMINI_YARIS_YOKLAMA_MS', 'GEMINI_YEDEK_GECIKME_MS_VARSAYILAN', 'geminiYedekGecikmeMs', 'GEMINI_YEDEK_MIN_KALAN_MS', 'GEMINI_AKIS_SONRASI_PAYI_MS',
  'GEMINI_RPM_RETRY_MIN_REMAINING_MS', 'geminiRpmWaitMs', 'geminiRetryWaitMs',
  'GEMINI_ENDPOINT', 'GEMINI_INLINE_MAX_BYTES', 'GEMINI_MAX_PAGES',
  'GEMINI_MIN_BUDGET_MS', 'GEMINI_RESERVE_MS', 'GEMINI_MAX_CALL_MS',
  'GEMINI_MAX_OUTPUT_TOKENS', 'GEMINI_GROQ_RESERVE_MS', 'geminiMode',
  'GEMINI_ONLY_BUDGET_MS', 'GEMINI_ONLY_MAX_CALL_MS',
  'GEMINI_ONLY_FALLBACK_MIN_MS', 'bytesToBase64', 'geminiModelCandidates',
  'geminiModelMissing', 'geminiFormatRejected', 'GEMINI_DUSURULEBILIR',
  'geminiUnknownParameter', 'geminiQuotaExhausted', 'extractGeminiText',
  'geminiProblem', 'callGeminiOnce', 'geminiDraft',
  // Akis (SSE) yolu — 18.10.2026.
  'GEMINI_SILENCE_MS', 'GEMINI_FIRST_BYTE_MS', 'GEMINI_ILK_OLAY_MS', 'geminiKurtarmaYeterli', 'GEMINI_PARTIAL_MIN_CHARS',
  'GEMINI_MAX_RESUMES', 'GEMINI_DEVAM_PAYI_MS', 'GEMINI_DEVAM_KAYIT_PAYI_MS', 'geminiDevamDesteklemeyen',
  'geminiAkisDurumu', 'geminiSseBlogunuIsle', 'geminiAkisiTuket',
  'geminiAkisIstegi', 'geminiAkisSonucu', 'geminiAkisiDevamEttir',
  'closeTruncatedJson', 'LATEX_IKI_HARFLI', 'repairLatexEscapes', 'geminiAkisOlcumu', 'onbellegeYazilabilir', 'onbellekKayitTuru', 'maddeMetni'
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
      text: async () => r.text ?? JSON.stringify(r.json ?? {}),
      body: sseBody(r, init)
    };
  };
}
function restoreFetch() { globalThis.fetch = realFetch; }

/* Kukla SSE govdesi. `sse`: olay nesneleri (her biri ayri parca olarak
   gonderilir, yani deltalarin BIRLESMESI gercekten test edilir).
   `sseRaw`: ham metin, parcalanma sinirlarini elle kurmak icin.
   `hang`: hic veri gondermez, yalnizca iptali bekler — sessizlik sayacinin
   testi bu. */
function sseBody(r, init) {
  if (!r.sse && !r.sseRaw && !r.hang) return undefined;
  const enc = new TextEncoder();
  const parcalar = r.sseRaw !== undefined
    ? [r.sseRaw]
    : (r.sse || []).map(o => (typeof o === 'string' ? o : `data: ${JSON.stringify(o)}\n\n`));
  let i = 0;
  return {
    getReader() {
      return {
        read() {
          if (r.hang || i >= parcalar.length) {
            // Iptal edilene kadar hicbir sey dondurmeyen okuma.
            if (r.hang) {
              return new Promise((_res, rej) => {
                const sig = init && init.signal;
                if (!sig) return;
                sig.addEventListener('abort', () => {
                  const e = new Error('iptal'); e.name = 'AbortError'; rej(e);
                });
              });
            }
            return Promise.resolve({ done: true, value: undefined });
          }
          return Promise.resolve({ done: false, value: enc.encode(parcalar[i++]) });
        }
      };
    }
  };
}

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
  // AKIS SURUMU: status_update in_progress gelir, completed GELMEZ.
  stubFetch(new Array(10).fill({
    status: 200,
    sse: [{ event_type: 'interaction.status_update', interaction_id: 'v1_x', status: 'in_progress' }]
  }));
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 300_000));
    assert.equal(out, null);
    /* AKIS SURUMU (18.10.2026): sayilan sey URETIM istegi, yani POST.
       status=in_progress ise etkilesim SUNUCUDA calisiyor olabilir ve
       dogru hamle GET ile ayni etkilesime geri baglanmak — bu gunluk
       kotadan istek goturmuyor. Yasak olan sey SONRAKI ADAY MODELI
       denemek; o da tam olarak ikinci bir POST olurdu. */
    const postlar = fetchCalls.filter(c => !c.init || !c.init.method || c.init.method === 'POST');
    const getler = fetchCalls.filter(c => c.init && c.init.method === 'GET');
    assert.equal(postlar.length, 1,
      `${postlar.length} POST yapildi — terminal olmayan durumda tek uretim istegi yeterli`);
    assert.ok(getler.length <= G.GEMINI_MAX_RESUMES,
      `${getler.length} devam ettirme istegi, tavan ${G.GEMINI_MAX_RESUMES}`);
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


console.log('\n6 — AKIS (SSE), SESSIZLIK SAYACI VE KISMI KURTARMA\n');

/* Gecikmeli parcalar gonderen kukla akis. `adimlar`: [{ms, metin}] —
   her parca kendinden once verilen kadar bekler. Sessizlik sayacinin
   OLAY GELDIKCE SIFIRLANDIGINI ancak zamanla olcebiliriz. */
function stubGecikmeliAkis(adimlar, { hangSonda = true } = {}) {
  const enc = new TextEncoder();
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    let i = 0;
    return {
      ok: true, status: 200, json: async () => ({}), text: async () => '',
      body: {
        getReader() {
          return {
            read() {
              if (i < adimlar.length) {
                const a = adimlar[i++];
                return new Promise((res, rej) => {
                  const sig = init && init.signal;
                  const t = setTimeout(() => res({ done: false, value: enc.encode(a.metin) }), a.ms);
                  if (sig) sig.addEventListener('abort', () => {
                    clearTimeout(t);
                    const e = new Error('iptal'); e.name = 'AbortError'; rej(e);
                  });
                });
              }
              if (!hangSonda) return Promise.resolve({ done: true, value: undefined });
              return new Promise((_res, rej) => {
                const sig = init && init.signal;
                if (!sig) return;
                sig.addEventListener('abort', () => {
                  const e = new Error('iptal'); e.name = 'AbortError'; rej(e);
                });
              });
            }
          };
        }
      }
    };
  };
}

const olay = (o) => `data: ${JSON.stringify(o)}\n\n`;
const DELTA = (t) => olay({ event_type: 'step.delta', delta: { type: 'text', text: t } });
const TAMAM = olay({ event_type: 'interaction.completed', event_id: 'e9', interaction: { id: 'v1_a' } });

test('istek AKISLI gidiyor: stream ve store gonderiliyor', async () => {
  fetchCalls = [];
  stubGecikmeliAkis([{ ms: 0, metin: DELTA('{"a":1}') }, { ms: 0, metin: TAMAM }], { hangSonda: false });
  try {
    await quiet(() => G.callGeminiOnce('K', 'm', 'sis', 'AAA', 'application/pdf', 'kul', 5000, []));
    const govde = JSON.parse(fetchCalls[0].init.body);
    assert.equal(govde.stream, true, 'stream gonderilmiyor — ilk byte beklemesi geri gelir');
    assert.equal(govde.store, true, 'store gonderilmiyor — GET ile devam ettirme calismaz');
  } finally { restoreFetch(); }
});

test("'stream' DUSURULEBILIR: yuzey reddederse akissiz yola dusulur", async () => {
  // Hat, akisin kabul edilmedigi bir anahtarda da calismak ZORUNDA.
  assert.ok(G.GEMINI_DUSURULEBILIR.includes('stream'), "'stream' dusurulebilir degil");
  assert.ok(G.GEMINI_DUSURULEBILIR.includes('store'), "'store' dusurulebilir degil");
  fetchCalls = [];
  stubFetch([{ status: 200, json: { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"a":1}' }] }] } }]);
  try {
    const r = await quiet(() => G.callGeminiOnce('K', 'm', 'sis', 'AAA', 'application/pdf', 'kul', 5000, ['stream', 'store']));
    assert.equal(r.ok, true, 'akissiz yol calismiyor');
    assert.equal(G.extractGeminiText(r.data), '{"a":1}');
    const govde = JSON.parse(fetchCalls[0].init.body);
    assert.ok(!('stream' in govde), 'dusurulen alan yine gonderiliyor');
  } finally { restoreFetch(); }
});

test('step.delta parcalari BIRLESIYOR', async () => {
  fetchCalls = [];
  stubGecikmeliAkis([
    { ms: 0, metin: DELTA('{"sum') },
    { ms: 0, metin: DELTA('mary":"x"') },
    { ms: 0, metin: DELTA('}') },
    { ms: 0, metin: TAMAM }
  ], { hangSonda: false });
  try {
    const r = await quiet(() => G.callGeminiOnce('K', 'm', 'sis', 'AAA', 'application/pdf', 'kul', 5000, []));
    assert.equal(r.ok, true);
    assert.equal(G.extractGeminiText(r.data), '{"summary":"x"}');
  } finally { restoreFetch(); }
});

test('tek TCP parcasinda birden fazla olay gelirse ikisi de islenir', () => {
  // Akis sinirlari olay sinirlariyla ortusmek zorunda degil.
  const d = G.geminiAkisDurumu();
  for (const blok of (DELTA('a') + DELTA('b')).split('\n\n')) {
    if (blok.trim()) G.geminiSseBlogunuIsle(blok, d);
  }
  assert.equal(d.metin, 'ab');
  assert.equal(d.olaySayisi, 2);
});

test('ILK BYTE hic gelmezse sebep ILK BYTE, sessizlik DEGIL', async () => {
  /* 18.10.2026 CANLI KOSU — bu testin dogdugu yer. Ilk surumde tek sayac
     vardi: 25 saniye olay gelmezse kes. Yuzey stream'i yok saydigi icin
     ilk byte 90+ saniyede geliyor ve uc model ust uste "sessizlik" diye
     kesildi — gunluk kotadan uc istek. Iki bekleme AYRI olmali ve log
     hangisinin tetiklendigini SOYLEMELI, yoksa ayni teshis bastan
     yapilir. */
  fetchCalls = [];
  stubGecikmeliAkis([], { hangSonda: true });
  const d = G.geminiAkisDurumu();
  const t0 = Date.now();
  try {
    // mutlak 10 sn, ilk byte 400 ms: kesen seyin ILK BYTE sayaci oldugu kesin.
    await quiet(() => G.geminiAkisIstegi('http://x', { method: 'POST' }, d, 10_000, 200, 400));
  } finally { restoreFetch(); }
  const gecen = Date.now() - t0;
  assert.ok(/ilk byte/.test(String(d.hata)), `sebep ilk byte olmali, gelen: ${d.hata}`);
  assert.ok(gecen < 3_000, `${gecen}ms beklendi`);
});

test('ILK BYTE toleransi sessizlikten BELIRGIN sekilde uzun', () => {
  // Olculen yanit suresi 90-111 sn (yok sayilan akis). Ilk byte toleransi
  // bunun altinda kalirsa her kosu bos yere kesilir.
  assert.ok(G.GEMINI_FIRST_BYTE_MS >= 90_000,
    `ilk byte toleransi ${G.GEMINI_FIRST_BYTE_MS}ms — olculen 90-111 sn yanit suresinin altinda`);
  assert.ok(G.GEMINI_FIRST_BYTE_MS > G.GEMINI_SILENCE_MS * 2,
    'iki bekleme birbirine cok yakin — ayirmanin anlami kalmiyor');
});

test('SESSIZLIK sayaci akis BASLADIKTAN SONRA devreye girer', async () => {
  /* Ilk parca geldikten sonra akis gercekten var demektir; o noktadan
     itibaren 25 saniyelik bosluk olu baglanti sayilir. Mutlak tavan
     buyuk tutuluyor ki kesen seyin sessizlik oldugu kesin olsun. */
  fetchCalls = [];
  stubGecikmeliAkis([{ ms: 10, metin: DELTA('{"a":1') }], { hangSonda: true });
  const d = G.geminiAkisDurumu();
  const t0 = Date.now();
  try {
    await quiet(() => G.geminiAkisIstegi('http://x', { method: 'POST' }, d, 10_000, 200));
  } finally { restoreFetch(); }
  const gecen = Date.now() - t0;
  assert.ok(/sessizlik/.test(String(d.hata)), `sebep sessizlik olmali, gelen: ${d.hata}`);
  assert.equal(d.metin, '{"a":1', 'gelen parca tutulmamis');
  assert.ok(gecen < 3_000, `${gecen}ms beklendi — mutlak tavana (10.000ms) kadar bekliyor`);
});

test('YUZEY AKISI YOK SAYARSA govde DUZ JSON olarak okunur', async () => {
  /* 18.10.2026 canli kosusunun ikinci yarisi: yuzey stream:true'yu
     reddetmiyor, yok sayiyor. O zaman govde SSE degil duz Interaction
     JSON'u olur. Bunu copa atmak, akis eklenmeden ONCE calisan bir yolu
     kirmak demekti. */
  fetchCalls = [];
  const duz = JSON.stringify({
    id: 'v1_duz', object: 'interaction', status: 'completed',
    steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"summary":"duz"}' }] }]
  });
  stubGecikmeliAkis([{ ms: 0, metin: duz }], { hangSonda: false });
  try {
    const r = await quiet(() => G.callGeminiOnce('K', 'm', 'sis', 'AAA', 'application/pdf', 'kul', 5000, []));
    assert.equal(r.ok, true, 'duz JSON yanit basarisiz sayildi — akissiz yol kirilmis');
    assert.equal(G.extractGeminiText(r.data), '{"summary":"duz"}');
    assert.equal(r.data.id, 'v1_duz', 'yanit nesnesi sentezlenmis, oldugu gibi kullanilmamis');
  } finally { restoreFetch(); }
});

test('ne SSE ne JSON olan govde SESSIZ gecmez', async () => {
  // Sessiz basarisizlik en pahali olani: bir daha bastan teshis demek.
  fetchCalls = [];
  stubGecikmeliAkis([{ ms: 0, metin: '<html>502 Bad Gateway</html>' }], { hangSonda: false });
  const d = G.geminiAkisDurumu();
  const basildi = [];
  const w = console.warn;
  console.warn = (...a) => basildi.push(a.join(' '));
  try {
    await G.geminiAkisIstegi('http://x', { method: 'POST' }, d, 5000, 200);
  } finally { console.warn = w; restoreFetch(); }
  assert.equal(d.duzYanit, null);
  assert.ok(basildi.some(l => /govde JSON degil/.test(l)),
    `govde loga girmedi: ${JSON.stringify(basildi)}`);
  assert.ok(basildi.some(l => /502 Bad Gateway/.test(l)), 'govdenin basi loga girmiyor');
});

test('SESSIZLIK sayaci olay geldikce SIFIRLANIYOR', async () => {
  /* Sayac toplam sureye baglansaydi bu kosu kesilirdi: olaylar 5 x 80ms =
     400ms boyunca geliyor, sessizlik esigi 200ms. Her olayda sifirlandigi
     icin kesilmemeli — "yavas ama calisiyor" ile "olu baglanti" ayrimi
     tam olarak bu. */
  fetchCalls = [];
  stubGecikmeliAkis([
    { ms: 80, metin: DELTA('{"a') },
    { ms: 80, metin: DELTA('":1') },
    { ms: 80, metin: DELTA(',"b"') },
    { ms: 80, metin: DELTA(':2}') },
    { ms: 80, metin: TAMAM }
  ], { hangSonda: false });
  const d = G.geminiAkisDurumu();
  try {
    await quiet(() => G.geminiAkisIstegi('http://x', { method: 'POST' }, d, 10_000, 200));
  } finally { restoreFetch(); }
  assert.equal(d.hata, null, `akis kesilmemeliydi: ${d.hata}`);
  assert.equal(d.tamamlandi, true);
  assert.equal(d.metin, '{"a":1,"b":2}');
});

/* 25.10.2026 — KOSU 38: AKAN AKIS 105 SN TAVANINDA KESILDI.
 * 3.7 ilk olayi 75,7 sn'de getirdi, 185 olay / 16.329 krk akarken toplam
 * tavanda kesildi; kart KISMI (%49 kapsama) cikti ve butceden ~33 sn
 * kullanilmadan kaldi. Ilk olay geldiginde mutlak tavan akisTavanMs'e
 * uzatiliyor; olay gelmeyen akis eski tavanda kalir. */
test('AKAN akis mutlak tavanda KESILMEZ: ilk olayla tavan akisTavanMs e uzar', async () => {
  fetchCalls = [];
  stubGecikmeliAkis([
    { ms: 60, metin: DELTA('{"a') },
    { ms: 60, metin: DELTA('":1') },
    { ms: 60, metin: DELTA(',"b"') },
    { ms: 60, metin: DELTA(':2}') },
    { ms: 60, metin: TAMAM }
  ], { hangSonda: false });
  const d = G.geminiAkisDurumu();
  try {
    // Mutlak tavan 150ms — uzatma olmasa ikinci olaydan sonra kesilirdi.
    await quiet(() => G.geminiAkisIstegi('http://x', { method: 'POST' }, d, 150, 10_000,
      G.GEMINI_FIRST_BYTE_MS, G.GEMINI_ILK_OLAY_MS, undefined, 5_000));
  } finally { restoreFetch(); }
  assert.equal(d.hata, null, `akan akis kesildi: ${d.hata}`);
  assert.equal(d.tamamlandi, true);
  assert.equal(d.metin, '{"a":1,"b":2}');
});

test('uzatma VERILMEZSE eski davranis: akis mutlak tavanda kesilir', async () => {
  fetchCalls = [];
  stubGecikmeliAkis([
    { ms: 60, metin: DELTA('{"a') },
    { ms: 60, metin: DELTA('":1') },
    { ms: 60, metin: DELTA(',"b"') },
    { ms: 60, metin: DELTA(':2}') },
    { ms: 60, metin: TAMAM }
  ], { hangSonda: false });
  const d = G.geminiAkisDurumu();
  try {
    await quiet(() => G.geminiAkisIstegi('http://x', { method: 'POST' }, d, 150, 10_000));
  } finally { restoreFetch(); }
  assert.ok(/mutlak tavan \(150ms\)/.test(String(d.hata)), `beklenen kesilme yok: ${d.hata}`);
  assert.equal(d.tamamlandi, false);
});

test('akis uzatmasi yalnizca only modunda ve butcenin sonundan pay birakarak', () => {
  const i = FN_SRC.indexOf('const akisTavani = mode === ');
  assert.ok(i > 0, 'geminiDraft akis tavanini hesaplamiyor');
  const blok = FN_SRC.slice(i, i + 240);
  assert.ok(/mode === 'only'/.test(blok), 'shadow modunda da uzatiliyor — Groq payi yenir');
  assert.ok(/budgetMs - GEMINI_AKIS_SONRASI_PAYI_MS - \(k\.startedAt - basladi\)/.test(blok));
  // Pay, Gemini sonrasi yazar kapisini (20 sn) gecebilmeli.
  const pay = Number((FN_SRC.match(/const GEMINI_AKIS_SONRASI_PAYI_MS = ([\d_]+)/) || [])[1].replace(/_/g, ''));
  assert.ok(pay >= 20_000 && pay <= 35_000, `pay ${pay}ms — yazar kapisi ya da akis uzatmasi bozulur`);
  // Uzatma YALNIZCA olayla tetiklenir: olaysiz akis toplam tavanda kalir.
  assert.ok(/if \(tur === 'olay' && !uzatildi && akisTavanMs !== undefined && akisTavanMs > mutlakMs\)/.test(FN_SRC));
});

/* 25.10.2026 — REVIEW DUSERSE BELGE DUSUYORDU. fetchWithRetry zaman
   asiminda firlatiyor; catch markFailed cagirip 503 donuyordu — saglam bir
   Gemini taslagi varken ogrencinin karti siliniyordu. Bos review cevabi da
   ayni sekilde belgeyi dusuruyordu. */
test('review istegi ya da cevabi duserse TASLAK korunur, belge dusmez', () => {
  const i = FN_SRC.indexOf('} catch (fetchReviewErr) {');
  assert.ok(i > 0);
  // Yalnizca catch govdesi: ilk 'break'e kadar (sonraki markFailed'ler baska hatalar icin).
  const blok = FN_SRC.slice(i, FN_SRC.indexOf('break', i) + 5);
  assert.ok(!blok.includes('markFailed('), 'review zaman asimi hala belgeyi basarisiz isaretliyor');
  assert.ok(/rawFinalContent = rawContent/.test(blok) && /skippedStages\.push\('review'\)/.test(blok));
  assert.ok(!/Empty response content from Groq Review[\s\S]{0,120}markFailed/.test(FN_SRC),
    'bos review cevabi hala belgeyi dusuruyor');
});

test('review deneme suresi kalan butceye uyuyor, taban 10 sn', () => {
  assert.ok(/const REVIEW_MIN_ATTEMPT_MS = 10_000/.test(FN_SRC));
  assert.ok(/Math\.min\(REVIEW_ATTEMPT_TIMEOUT_MS, Math\.max\(REVIEW_MIN_ATTEMPT_MS, budgetLeft\(\) - wait - REVIEW_TAIL_MS\)\)/.test(FN_SRC),
    'kapi hala sabit 25 sn fiyatliyor — akis uzatmasi review u yer');
  assert.ok(/\}, reviewRetries, tierAttemptMs\)/.test(FN_SRC), 'cagri kapinin fiyatladigi sureyi kullanmiyor');
});

test('error olayi cagriyi dusurur ve sebebi tasir', async () => {
  fetchCalls = [];
  stubGecikmeliAkis([
    { ms: 0, metin: olay({ event_type: 'error', event_id: 'e1', error: { code: 'not_found', message: 'Result not found.' } }) }
  ], { hangSonda: false });
  try {
    const r = await quiet(() => G.callGeminiOnce('K', 'm', 'sis', 'AAA', 'application/pdf', 'kul', 5000, []));
    assert.equal(r.ok, false);
    assert.ok(/Result not found/.test(r.body), `sebep tasinmiyor: ${r.body}`);
  } finally { restoreFetch(); }
});

test('devam ettirme GET ile ve last_event_id vererek yapiliyor', async () => {
  fetchCalls = [];
  stubGecikmeliAkis([{ ms: 0, metin: TAMAM }], { hangSonda: false });
  const d = G.geminiAkisDurumu();
  d.interactionId = 'v1_abc';
  d.lastEventId = 'ev42';
  try {
    await quiet(() => G.geminiAkisiDevamEttir('K', d, 5000));
  } finally { restoreFetch(); }
  const c = fetchCalls[0];
  assert.equal(c.init.method, 'GET', 'devam ettirme POST atiyor — bu yeni bir uretim istegi olurdu');
  assert.ok(String(c.url).includes('v1_abc'), 'etkilesim id adreste yok');
  assert.ok(/stream=true/.test(String(c.url)), 'stream=true yok');
  assert.ok(/last_event_id=ev42/.test(String(c.url)), 'last_event_id gonderilmiyor — akis bastan baslar');
});

test('OLCUM: ilk byte ve ilk olay ayri ayri yaziliyor', async () => {
  /* 18.10.2026 kosusu taslagi 88,1 saniyede getirdi ve olaylar islendi,
     ama log olaylarin sureye YAYILIP yayilmadigini soylemiyordu. Bu iki
     sayi olmadan "akis gercekten calisiyor mu" sorusu her koşuda yeniden
     tahmin olurdu. */
  fetchCalls = [];
  stubGecikmeliAkis([
    { ms: 60, metin: DELTA('{"a":1') },
    { ms: 30, metin: DELTA(',"b":2}') },
    { ms: 10, metin: TAMAM }
  ], { hangSonda: false });
  const d = G.geminiAkisDurumu();
  try {
    await quiet(() => G.geminiAkisIstegi('http://x', { method: 'POST' }, d, 10_000, 500));
  } finally { restoreFetch(); }
  assert.ok(d.ilkByteMs >= 0, 'ilk byte olculmemis');
  assert.ok(d.ilkOlayMs >= 0, 'ilk olay olculmemis');
  assert.equal(d.olaySayisi, 3);
  assert.ok(d.ilkOlayMs >= d.ilkByteMs, 'ilk olay ilk byte tan once olamaz');
});

test('OLCUM: olaylar sureye yayilirsa AKIS GERCEK denir', () => {
  const d = G.geminiAkisDurumu();
  d.olaySayisi = 40; d.ilkByteMs = 900; d.ilkOlayMs = 1000; d.metin = 'x'.repeat(5000);
  assert.match(G.geminiAkisOlcumu(d, 60_000), /AKIS GERCEK/);
});

test('OLCUM: olaylar SONDA toplu gelirse AKIS SOZDE denir', () => {
  // Yuzey stream'i kabul edip her seyi sonda gonderirse akis sozde
  // kalir: kismi kurtarma ve devam ettirme pratikte hic calismaz.
  const d = G.geminiAkisDurumu();
  d.olaySayisi = 40; d.ilkByteMs = 88_000; d.ilkOlayMs = 88_010; d.metin = 'x'.repeat(5000);
  assert.match(G.geminiAkisOlcumu(d, 88_200), /AKIS SOZDE/);
});

test('OLCUM: duz JSON yolunda AKIS YOK denir', () => {
  const d = G.geminiAkisDurumu();
  d.duzYanit = { status: 'completed' }; d.ilkByteMs = 88_000;
  assert.match(G.geminiAkisOlcumu(d, 88_100), /AKIS YOK/);
});

console.log('\n7 — KESIK JSON KURTARMA\n');

test('kesik nesne kapatilip ayristirilir', () => {
  const kesik = '{"summary":"Makro", "key_terms":[{"term":"GSYIH","definition":"toplam"},{"term":"Enf';
  const r = G.closeTruncatedJson(kesik);
  assert.ok(r, 'kurtarilamadi');
  const p = JSON.parse(r);
  assert.equal(p.summary, 'Makro');
  assert.equal(p.key_terms.length, 1, 'yarim eleman atilmali');
  assert.equal(p.key_terms[0].term, 'GSYIH');
});

test('kesik dizi ortasindaki yarim DIZE atilir', () => {
  const r = G.closeTruncatedJson('{"a":1,"list":["bir","iki","uc');
  assert.ok(r);
  const p = JSON.parse(r);
  assert.deepEqual(p.list, ['bir', 'iki']);
});

test('degeri gelmemis ANAHTAR atilir', () => {
  const r = G.closeTruncatedJson('{"a":1,"b":');
  assert.ok(r);
  assert.deepEqual(JSON.parse(r), { a: 1 });
});

test('kod blogu sarmalayicisi siyrilir', () => {
  const r = G.closeTruncatedJson('```json\n{"a":1,"b":[2,3');
  assert.ok(r);
  assert.deepEqual(JSON.parse(r), { a: 1, b: [2, 3] });
});

test('TAM JSON oldugu gibi gecer', () => {
  const r = G.closeTruncatedJson('{"a":1}');
  assert.deepEqual(JSON.parse(r), { a: 1 });
});

test('kurtarilamayan girdi NULL doner (dogrulanmamis metin asla donmez)', () => {
  assert.equal(G.closeTruncatedJson(''), null);
  assert.equal(G.closeTruncatedJson('bu JSON degil'), null);
  assert.equal(G.closeTruncatedJson('{'), null);
  // Her kurtarma JSON.parse ile dogrulanir; aksi halde kart uretim yolunda
  // 1900 satir asagida patlar (17.10.2026 dersi).
  const r = G.closeTruncatedJson('{"a":1,"b":[1,2');
  if (r !== null) JSON.parse(r);
});

test('dize icindeki suslu parantez yapiyi bozmuyor', () => {
  const r = G.closeTruncatedJson('{"t":"a { b } [ c ]","x":[1,2');
  assert.ok(r);
  const p = JSON.parse(r);
  assert.equal(p.t, 'a { b } [ c ]');
});

test('esik: cok kisa kismi cikti kurtarmaya GIRMEZ', () => {
  // Sayinin kendisi bir karar: altinda kalan bir tampon zaten karta donusmez.
  assert.ok(G.GEMINI_PARTIAL_MIN_CHARS >= 500,
    'esik cok kucuk — ic bos bir kart ogrenciye tam kart gibi gorunur');
  assert.ok(G.GEMINI_SILENCE_MS <= 40_000,
    'sessizlik esigi cok buyuk — olu baglanti yine uzun bekletir');
  assert.ok(G.GEMINI_SILENCE_MS >= 10_000,
    'sessizlik esigi cok kucuk — dusunen model sessiz kalirken kesilir');
});

test('KISMI taslaktan uretilen kart TAM satira ALINMAZ', () => {
  /* 24.10: kismi kart onbellege hic girmiyordu — girerse ayni belgeyi
     ozetleyen herkes yarim karti alir ve bir daha hic tam kart uretilmezdi.
     25.10: o kural TAM SATIR icin aynen duruyor, ama 'hic yazmamak' ayni
     dosyayi her yuklemede sifirdan odetiyordu (kosu 37/38). Kismi kart
     artik ':k' ekli AYRI satira giriyor ve arama onu yalnizca tam satir
     yokken seciyor. Burada ikisi birden olculuyor. */
  const kismi = { anahtarVar: true, eksikPencereVar: false, geminiKismiKrk: 2074, geciciDustu: false };
  assert.equal(G.onbellegeYazilabilir(kismi), false,
    'onbellek kapisi kismi karti TAM satirda tutuyor');
  assert.equal(G.onbellekKayitTuru(kismi), 'kismi',
    'kismi kart hic yazilmiyor — ayni dosya her yuklemede sifirdan odenir');

  const tam = { anahtarVar: true, eksikPencereVar: false, geminiKismiKrk: 0, geciciDustu: false };
  assert.equal(G.onbellegeYazilabilir(tam), true, 'tam kart da yazilamiyor — kapi fazla sIki');
  assert.equal(G.onbellekKayitTuru(tam), 'tam');

  assert.ok(/qualityMeta\.gemini_partial = \{ kurtarilanKrk: geminiKismiKrk \}/.test(FN_SRC),
    'kismi kart isaretlenmiyor — arayuz rozeti okuyamaz');
});

/* 24.10.2026 — BU TEST OLU YOLU DOGRULUYORDU.
 *
 * `dashboard.js`'in yazdigi uyari `#study-card-summary-text`'e gidiyor; o
 * dugum `dashboard.html`'de `<div class="axr-legacy" hidden>` blogunun
 * icinde ve `css/acadex-ink.css` onu `display:none!important` yapiyor.
 * Yani test yesil, ekran bos: ogrenci %23 kapsamali karti tam kart gibi
 * goruyor ve ustune yesil "kalite kontrolunden gecti" rozeti aliyordu.
 *
 * Canli cizim yolu `js/acadex-ink.js` -> renderFlow. Test artik ONU
 * dogruluyor; dashboard kontrolu de kaliyor (o yol hala PDF/diger
 * yuzeyler icin duruyor), ama tek basina YETERLI sayilmiyor. */
const INK_SRC = require('node:fs').readFileSync(
  require('node:path').join(__dirname, '..', 'js/acadex-ink.js'), 'utf8');

test('CANLI arayuz kalite uyarilarini okuyor', () => {
  for (const alan of ['missing_windows', 'gemini_partial', 'skipped_stages', 'numeric_coverage']) {
    assert.ok(INK_SRC.includes('qm.' + alan),
      `acadex-ink ${alan} okumuyor — uyari ekranda gorunmez`);
  }
  // Uyarilar gercekten bir rozete donmeli, sadece okunup atilmasin.
  assert.ok(/uyarilar\.push\(/.test(INK_SRC), 'uyarilar toplanmiyor');
  assert.ok(/chip\(u, 'warn'\)/.test(INK_SRC), 'uyari rozeti uretilmiyor');
  assert.ok(/uyariChip \+ '<\/div>'/.test(INK_SRC), 'uyari rozetleri rozet satirina eklenmiyor');
});

test('uyari varken "kalite kontrolunden gecti" BASTIRILIYOR', () => {
  /* Asil kusur ikisinin BIRLIKTE gorunmesiydi: eksik kart + yesil onay. */
  assert.ok(/qm\.pass !== false && qm\.grounded && !uyarilar\.length/.test(INK_SRC),
    'olumlu rozet uyari varken de basiliyor');
});

test('uyari rozetinin CSS i var', () => {
  const CSS = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'css/acadex-ink.css'), 'utf8');
  assert.ok(/\.axr-chip\.warn\{/.test(CSS), 'warn rozeti icin stil yok — rozet notr gorunur');
});

test('arayuz KISMI GEMINI rozetini okuyor (eski/legacy yol)', () => {
  assert.ok(/qm\.gemini_partial/.test(DASH_SRC),
    'dashboard gemini_partial okumuyor');
  const i = DASH_SRC.indexOf('qm.gemini_partial');
  const blok = DASH_SRC.slice(i, i + 800);
  assert.ok(/Kısmi özet/.test(blok), 'ogrenciye gosterilen metin yok');
});


test('ILK OLAY gelmezse kesiliyor: baglanti acik ama veri yok', async () => {
  /* 20.10.2026 CANLI HATA. Ayni belgenin iki kosusu:
       ilk byte 15.235ms, ilk olay  55.441ms -> 307 olay, 29.557 krk (iyi)
       ilk byte 15.229ms, ilk olay 101.843ms ->  23 olay,  2.148 krk (bos)
     Ikincisinde baglanti 15. saniyede acildi, 86 SANIYE boyunca tek olay
     gelmedi ve kart 2 terim / 0 nokta / 0 soru ile cikti.

     Sessizlik sayaci bunu GORMEDI, cunku her veri PARCASINDA
     sifirlaniyordu: yuzey bosluk/heartbeat gonderdikce 25 saniyelik esik
     hic devreye girmedi. Artik sayaci ISLENEN OLAY sifirliyor ve ilk
     olayin kendi son tarihi var. */
  fetchCalls = [];
  // Byte akiyor (hicbiri olay degil), olay hic gelmiyor.
  stubGecikmeliAkis([
    { ms: 10, metin: ': heartbeat\n\n' },
    { ms: 10, metin: ': heartbeat\n\n' },
    { ms: 10, metin: ': heartbeat\n\n' }
  ], { hangSonda: true });
  const d = G.geminiAkisDurumu();
  const t0 = Date.now();
  try {
    // mutlak 10 sn, ilk byte 5 sn, sessizlik 200 ms, ILK OLAY 1 sn.
    await quiet(() => G.geminiAkisIstegi('http://x', { method: 'POST' }, d, 10_000, 200, 5_000, 1_000));
  } finally { restoreFetch(); }
  assert.equal(d.olaySayisi, 0, 'heartbeat olay sayilmis');
  assert.ok(/ilk olay gelmedi/.test(String(d.hata)),
    'heartbeat akarken ilk-olay son tarihi tetiklenmedi: ' + d.hata);
  assert.ok(Date.now() - t0 < 9_000, 'mutlak tavana kadar beklenmis');
});

test('ILK OLAY esigi olculen dusunme suresinin USTUNDE', () => {
  /* Mesru dusunme suresi 55,4 saniye olculdu ve o kosu 29.557 karakter
     uretti. Esik onun altina inerse iyi kosulari da keseriz. */
  assert.ok(G.GEMINI_ILK_OLAY_MS > 55_441,
    'esik olculen mesru dusunme suresinin altinda: ' + G.GEMINI_ILK_OLAY_MS);
  assert.ok(G.GEMINI_ILK_OLAY_MS <= 80_000,
    'esik cok yuksek — Groq a tam kosu icin yer kalmaz: ' + G.GEMINI_ILK_OLAY_MS);
});

test('KURTARMA icerige bakiyor, karaktere degil', () => {
  /* 2.074 karakterlik kurtarma karakter esigini gecip kart uretmisti:
     2 terim, 0 nokta, 0 soru, kapsama %0. */
  const bos = JSON.stringify({ summary: 'x'.repeat(400), key_terms: [1, 2], key_points: [], quiz_questions: [] });
  assert.equal(G.geminiKurtarmaYeterli(bos).yeterli, false, 'bos kart yeterli sayildi');

  const dolu = JSON.stringify({
    summary: 'x'.repeat(400),
    key_terms: [1, 2, 3, 4, 5, 6],
    key_points: [1, 2, 3],
    quiz_questions: [1]
  });
  assert.equal(G.geminiKurtarmaYeterli(dolu).yeterli, true, 'dolu kart reddedildi');

  // Ozet yoksa terim/nokta sayisi ne olursa olsun yetmez.
  const ozetsiz = JSON.stringify({ summary: '', key_terms: [1, 2, 3, 4, 5, 6, 7], key_points: [1, 2, 3, 4] });
  assert.equal(G.geminiKurtarmaYeterli(ozetsiz).yeterli, false, 'ozetsiz kart yeterli sayildi');

  assert.equal(G.geminiKurtarmaYeterli('{bozuk').yeterli, false);
});


test('ILK OLAY son tarihi heartbeat ile KAYMAZ', () => {
  /* 20.10.2026, IKINCI TUR. Ilk duzeltme sessizlik sayacini olaya bagladi
     ama ilk-olay son tarihini HER BYTE'ta yeniden kuruyordu. Yuzey 15
     saniyede bir bosluk gonderince 72 saniyelik son tarih hic dolmadi:
       canli olcum -> ilk byte 15.245ms, ILK OLAY 90.163ms,
       son tarih tetiklenmedi, cagri 105 sn tavana carpti, kart kismi (%4).

     Onceki testim bunu KACIRDI: heartbeat'leri 10ms arayla gonderip
     susuyordu, yani kayma gorunmuyordu. Kayma ancak heartbeat'ler son
     tarihe YAKIN araliklarla gelince ortaya cikiyor — bu test onu kuruyor
     ve davranisi KAYNAKTAN dogruluyor. */
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  const i = src.indexOf('SON TARIH BYTE');
  assert.ok(i > -1, 'kayma notu kaybolmus');
  const blok = src.slice(i - 600, i + 700);
  assert.ok(blok.includes("if (tur === 'byte' && !ilkByteMiydi) return"),
    'sonraki byte lar hala zamanlayiciyi yeniden kuruyor');
  assert.ok(!blok.includes("if (tur === 'byte' && durum.olaySayisi > 0) return"),
    'kayan eski kosul geri gelmis');
});

test('ILK OLAY son tarihi ARALIKLI heartbeat te de doluyor', async () => {
  /* Gercek senaryo: bosluklar son tarihin hemen altinda araliklarla
     geliyor. Son tarih ilk byte'ta BIR KEZ kuruldugu icin dolmak zorunda. */
  fetchCalls = [];
  stubGecikmeliAkis([
    { ms: 10, metin: ': hb\n\n' },
    { ms: 180, metin: ': hb\n\n' },
    { ms: 180, metin: ': hb\n\n' },
    { ms: 180, metin: ': hb\n\n' }
  ], { hangSonda: true });
  const d = G.geminiAkisDurumu();
  const t0 = Date.now();
  try {
    // mutlak 10 sn, sessizlik 5 sn, ilk byte 5 sn, ILK OLAY 400 ms.
    await quiet(() => G.geminiAkisIstegi('http://x', { method: 'POST' }, d, 10_000, 5_000, 5_000, 400));
  } finally { restoreFetch(); }
  const gecen = Date.now() - t0;
  assert.equal(d.olaySayisi, 0, 'heartbeat olay sayilmis');
  assert.ok(/ilk olay gelmedi/.test(String(d.hata)),
    'araliklı heartbeat son tarihi kaydirmis: ' + d.hata);
  /* ESIK SIKI, bilerek: heartbeat ler 180ms arayla geliyor ve son tarih
     400ms. Son tarih ILK BYTE tan sayiliyorsa iptal ~410ms de olur. Her
     byte ta yeniden kurulsaydi iptal ancak akis sustuktan 400ms sonra,
     yani ~950ms de olurdu — gevsek bir esik bu farki yutar ve test eski
     davranisi yakalamaz (mutasyonla olculdu). */
  assert.ok(gecen < 800, gecen + 'ms beklendi — son tarih byte larla kayiyor');
});

/* ==========================================================================
   8 — DEVAM ETTIRME PENCERESI (21.10.2026)

   20.10 kosusu: ilk byte 15.193ms, ilk olay 60.166ms (72 sn kapisi dogru
   davrandi, tetiklenmedi), 290 olay, mutlak tavan 105.008ms de abort.
   Taslak tam JSON a 59 KARAKTER uzaktaydi. Devam ettirme tam bu is icin
   yazilmisti ve su satiri basti:

     Gemini gemini-3.7-flash: devam ettirmeye yer kalmadi (-12ms)

   -12ms tesadüf degil. geminiToplamTavan = tavan oldugu, akisin da tam
   `tavan` ms de abort edildigi icin resume dongusune varildiginda kalan
   daima ~0. Yani devam ettirme, en cok gerektigi senaryoda yapisal olarak
   OLU KODDU — ve bu, kota yakmayan tek kurtarma yolu.

   Kesildigi anda butcede 38,1 saniye vardi (review budgetLeft=35.887ms
   olarak gordu ve 2,66 saniyede bitti). Pencere oradan aliniyor.
   ========================================================================== */
console.log('\n8 — DEVAM ETTIRME PENCERESI\n');

test('devam ettirme tavani URETIM tavanindan ayri hesaplaniyor', () => {
  const i = FN_SRC.indexOf('const geminiToplamTavan = tavan');
  assert.ok(i > 0, 'geminiToplamTavan bulunamadi');
  assert.ok(/const geminiDevamTavan = Math\.min\(/.test(FN_SRC.slice(i, i + 600)),
    'geminiDevamTavan yok — devam ettirme uretim tavanina bagli kalmis');
});

test('resume dongusu geminiDevamTavan okuyor, geminiToplamTavan DEGIL', () => {
  const i = FN_SRC.indexOf('devam < GEMINI_MAX_RESUMES');
  assert.ok(i > 0, 'resume dongusu bulunamadi');
  const blok = FN_SRC.slice(i, i + 900);
  assert.ok(/const kalanMs = geminiDevamTavan - \(Date\.now\(\) - basladi\)/.test(blok),
    'kalanMs uretim tavanindan olculuyor — akis tam o tavanda abort edildigi ' +
    'icin resume daima ~0 gorur ve hic calismaz');
});

test('uretim denemeleri HALA toplam tavana bagli — Groq payi korunuyor', () => {
  assert.ok(
    /const buCagriMs = Math\.min\(callMs, geminiToplamTavan - \(Date\.now\(\) - basladi\)\)/
      .test(FN_SRC),
    'uretim denemesi devam tavanina baglanmis — Groq fallback payi yanar'
  );
});

// Kaynaktaki formulun aynisi; sabitler degisirse asagidaki esikler uyarir.
function devamTavani(budgetMs) {
  const tavan = G.GEMINI_ONLY_MAX_CALL_MS;
  return Math.min(
    tavan + G.GEMINI_DEVAM_PAYI_MS,
    Math.max(tavan, budgetMs - G.GEMINI_DEVAM_KAYIT_PAYI_MS)
  );
}

test('ARITMETIK: tavan tamamen yandiginda resume penceresi 10 sn esigini geciyor', () => {
  // 20.10 kosusunun sayilari: hazirlik ~5 sn, uretim tavani sonuna kadar yandi.
  const budgetMs = G.GEMINI_ONLY_BUDGET_MS - 5_000;
  const kalan = devamTavani(budgetMs) - G.GEMINI_ONLY_MAX_CALL_MS;
  assert.ok(kalan >= 10_000,
    `devam penceresi ${kalan}ms — resume dongusunun 10.000ms esigini gecmiyor, ` +
    'yani duzeltme kagit uzerinde kaldi');
});

test('pencere kapilar + kayit payini yemiyor', () => {
  const budgetMs = G.GEMINI_ONLY_BUDGET_MS - 5_000;
  const kalanSonra = budgetMs - devamTavani(budgetMs);
  assert.ok(kalanSonra >= G.GEMINI_DEVAM_KAYIT_PAYI_MS,
    `devam tavaninden sonra ${kalanSonra}ms kaliyor — kapilar + kayit icin yetmez`);
});

test('dar butcede pencere ACILMIYOR, davranis eskisi gibi kaliyor', () => {
  /* Hazirlik uzun surerse (indirme + OCR) butce daralir. O zaman pencere
     acilmamali: Supabase nin ~150 sn duvari pencereden onemli. */
  const dar = G.GEMINI_ONLY_MAX_CALL_MS + 5_000;
  assert.equal(devamTavani(dar), G.GEMINI_ONLY_MAX_CALL_MS,
    'yer yokken pencere acilmis — toplam butce asilir');
});

/* ==========================================================================
   9 — DEVAM ETTIRME SEBEBINI SOYLUYOR (21.10.2026)

   Pencere acildi ve devam ettirme GERCEKTEN kostu — 21.10 kosusu:

     akis kesildi (mutlak tavan (95445ms)) — GET ile devam ettiriliyor (1/2, 14994ms kaldi)
     akis kesildi (null)                   — GET ile devam ettiriliyor (2/2, 14316ms kaldi)
     akis tamamlanmadi (null)              — KISMI JSON kurtarildi

   Iki GET 679ms ve 596ms surdu, TEK KARAKTER getirmedi (36680 sabit kaldi)
   ve neden basarisiz olduklarini soylemedi. O `null` sebebin yoklugu degil:
   geminiAkisiDevamEttir once durum.hata'yi null'a cekiyor, sonra
   geminiAkisIstegi'nin ok OLMAYAN cevapta DONDURDUGU {status, body} degerini
   atiyordu. Yani HTTP hatasi yapisal olarak goze gorunmezdi.
   ========================================================================== */
console.log('\n9 — DEVAM ETTIRME SEBEBINI SOYLUYOR\n');

test('devam ettirme HTTP hatasi durum.hata ya YAZILIYOR', async () => {
  stubFetch([{ status: 404, text: '{"error":{"message":"Interaction not found"}}' }]);
  const d = G.geminiAkisDurumu();
  d.interactionId = 'v1_abc'; d.lastEventId = 'ev42'; d.metin = '{"a":1';
  let http;
  try {
    http = await quiet(() => G.geminiAkisiDevamEttir('K', d, 5_000));
  } finally { restoreFetch(); }
  assert.ok(http && http.status === 404, 'HTTP sonucu cagirana donmuyor');
  assert.ok(/HTTP 404/.test(String(d.hata)),
    'sebep yutuldu — log yine "akis kesildi (null)" yazar: ' + d.hata);
  assert.ok(/Interaction not found/.test(String(d.hata)),
    'cevap govdesi tasinmiyor: ' + d.hata);
});

test('BOS donen devam ettirme sessiz gecmiyor', async () => {
  /* 200 ve OKUNABILIR bir govde, ama icinde tek olay yok (yalnizca
     heartbeat yorumu). Govde okunamadiginda sebebi geminiAkisiTuket zaten
     yaziyor; SESSIZ kalan hal bu. */
  stubFetch([{ status: 200, sseRaw: ': hb\n\n' }]);
  const d = G.geminiAkisDurumu();
  d.interactionId = 'v1_abc'; d.metin = '{"a":1';
  try {
    await quiet(() => G.geminiAkisiDevamEttir('K', d, 5_000));
  } finally { restoreFetch(); }
  assert.equal(d.metin, '{"a":1', 'metin degismemeliydi');
  assert.ok(/bos dondu/.test(String(d.hata)),
    'bos devam ettirme sebepsiz kaldi: ' + d.hata);
  assert.ok(/last_event_id YOK/.test(String(d.hata)),
    'last_event_id gonderildi mi yazilmiyor — tani icin gerekli: ' + d.hata);
});

test('devam ettirme TAMAMLANIRSA sebep YAZILMIYOR', async () => {
  stubGecikmeliAkis([{ ms: 0, metin: TAMAM }], { hangSonda: false });
  const d = G.geminiAkisDurumu();
  d.interactionId = 'v1_abc';
  try {
    await quiet(() => G.geminiAkisiDevamEttir('K', d, 5_000));
  } finally { restoreFetch(); }
  assert.equal(d.tamamlandi, true, 'devam ettirme tamamlanmadi');
  assert.equal(d.hata, null, 'basarili devam ettirmeye sebep yazilmis: ' + d.hata);
});

/* 21.10.2026 aksami — SEBEP YAZILINCA CEVAP GELDI:

     devam ettirme HTTP 400: {"error":{"message":"Streaming retrieval of
     interactions is not supported for this model","code":"invalid_request"}}

   Yani dun acilan 15 saniyelik pencere dogru tasarlanmisti ama yuzey GET
   ile kaldigi yerden okumayi gemini-3.7-flash'ta hic desteklemiyor. Pencere
   zararsiz (kullanilmazsa harcanmiyor) ama her kesik akista bir bos HTTP
   istegi ve ~600ms gidiyordu. */
test('yuzey devam ettirmeyi reddederse model KALICI olarak isaretleniyor', () => {
  const i = FN_SRC.indexOf('const geminiDevamDesteklemeyen');
  assert.ok(i > 0, 'desteklemeyen modeller tutulmuyor — her kesikte bos GET gider');
  assert.ok(/geminiDevamDesteklemeyen\.add\(model\)/.test(FN_SRC),
    'reddeden model isaretlenmiyor');
  assert.ok(/not supported/i.test(FN_SRC.slice(FN_SRC.indexOf('devamHata.status >= 400'), FN_SRC.indexOf('devamHata.status >= 400') + 600)),
    '"not supported" gecici hatadan ayirt edilmiyor');
});

test('isaretli modelde devam ettirme HIC denenmiyor', () => {
  const i = FN_SRC.indexOf('devam < GEMINI_MAX_RESUMES');
  const blok = FN_SRC.slice(i, i + 500);
  assert.ok(/geminiDevamDesteklemeyen\.has\(model\)/.test(blok),
    'dongu isaretli modeli atlamiyor — bos GET yine gidiyor');
  assert.ok(blok.indexOf('geminiDevamDesteklemeyen.has(model)') < blok.indexOf('const kalanMs'),
    'kontrol pencere hesabindan SONRA — once bos yere yer ayriliyor');
});

test('kalici 4xx ten sonra IKINCI GET yakilmiyor', () => {
  const i = FN_SRC.indexOf('const devamHata = await geminiAkisiDevamEttir(');
  assert.ok(i > 0, 'devam ettirmenin donen degeri okunmuyor — hata yine yutulur');
  const blok = FN_SRC.slice(i, i + 600);
  assert.ok(/devamHata\.status >= 400 && devamHata\.status < 500/.test(blok),
    'kalici 4xx de dongu kirilmiyor, ikinci GET bos yere yaniyor');
});

summary();
