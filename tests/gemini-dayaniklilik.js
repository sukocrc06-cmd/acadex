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
  'geminiProblem', 'callGeminiOnce', 'geminiDraft',
  // Akis (SSE) yolu — 18.10.2026.
  'GEMINI_SILENCE_MS', 'GEMINI_FIRST_BYTE_MS', 'GEMINI_PARTIAL_MIN_CHARS',
  'GEMINI_MAX_RESUMES',
  'geminiAkisDurumu', 'geminiSseBlogunuIsle', 'geminiAkisiTuket',
  'geminiAkisIstegi', 'geminiAkisSonucu', 'geminiAkisiDevamEttir',
  'closeTruncatedJson', 'repairLatexEscapes', 'geminiAkisOlcumu'
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

test('KISMI taslaktan uretilen kart ONBELLEGE ALINMAZ', () => {
  // Alinirsa ayni belgeyi ozetleyen herkes yarim karti alir ve bir daha
  // hic tam kart uretilmez.
  assert.ok(/if \(summaryCacheKey && !eksikPencereler && geminiKismiKrk === 0\)/.test(FN_SRC),
    'onbellek kapisi kismi karti disarida tutmuyor');
  assert.ok(/qualityMeta\.gemini_partial = \{ kurtarilanKrk: geminiKismiKrk \}/.test(FN_SRC),
    'kismi kart isaretlenmiyor — arayuz rozeti okuyamaz');
});

test('arayuz KISMI GEMINI rozetini okuyor', () => {
  assert.ok(/qm\.gemini_partial/.test(DASH_SRC),
    'dashboard gemini_partial okumuyor — kart tam kart gibi gorunur');
  const i = DASH_SRC.indexOf('qm.gemini_partial');
  const blok = DASH_SRC.slice(i, i + 800);
  assert.ok(/Kısmi özet/.test(blok), 'ogrenciye gosterilen metin yok');
});

summary();
