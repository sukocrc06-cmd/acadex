/* ==========================================================================
   ACADEX — GEMINI GOLGE YOLU TESTLERI (tests/gemini-shadow.js)

   summarize-document/index.ts icindeki Gemini gölge yolunu, tek bir ag
   cagrisi yapmadan test eder. Fonksiyonlar kaynak dosyadan calisma aninda
   cikarilir (tests/_ts-extract.js) — bu dosyaya kopyalanmaz.

   NEDEN BU TESTLER VAR:
   Gölge yolun tek vaadi su: "ne olursa olsun Groq yolunu bozmam." Yani asil
   test edilmesi gereken sey basari degil, BASARISIZLIK. Asagidaki testlerin
   cogu, cagri 404/429/400 donunce, govde bos gelince, cikti tavana carpinca
   ya da butce yetmeyince geminiDraft'in null dondugunu — yani cagiranin
   Groq'a dusebildigini — dogruluyor.

   Ag yok: globalThis.fetch bu dosya icinde kukla ile degistiriliyor.

   Calistirma:  node tests/gemini-shadow.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const { test, summary } = makeRunner();

// Cikarilacak bildirimler. Kaynakta biri yeniden adlandirilirsa test ACIK
// HATA verir — sessizce eski bir kopyayi test etmeye devam etmez.
const NAMES = [
  'GEMINI_ENDPOINT', 'GEMINI_MODEL_CANDIDATES', 'GEMINI_INLINE_MAX_BYTES',
  'GEMINI_MAX_PAGES', 'GEMINI_MIN_BUDGET_MS', 'GEMINI_RESERVE_MS',
  'GEMINI_MAX_CALL_MS', 'GEMINI_MAX_OUTPUT_TOKENS', 'GEMINI_GROQ_RESERVE_MS',
  'geminiMode', 'GEMINI_ONLY_BUDGET_MS', 'GEMINI_ONLY_MAX_CALL_MS',
  'GEMINI_ONLY_FALLBACK_MIN_MS',
  'GEMINI_MAX_REQUESTS_PER_RUN', 'GEMINI_ARDISIK_GECICI_MAX', 'geminiRpmWaitMs', 'geminiRetryWaitMs', 'OPSIYONEL_ADIM_MAX_BEKLEME_MS', 'GEMINI_SEKIL_NOTU_TAVANI', 'mermaidEtiketleri',
  'GEMINI_YARIS_GENISLIGI_VARSAYILAN', 'geminiYarisGenisligi', 'GEMINI_YARIS_YOKLAMA_MS', 'GEMINI_YEDEK_GECIKME_MS_VARSAYILAN', 'geminiYedekGecikmeMs', 'GEMINI_YEDEK_MIN_KALAN_MS', 'GEMINI_AKIS_SONRASI_PAYI_MS',
  'PACER_COMPLETION_FACTOR', 'DEFAULT_TPM_LIMIT', 'PACER_SAFETY',
  'GEMINI_RPM_RETRY_MIN_REMAINING_MS',
  'bytesToBase64',
  'geminiModelCandidates', 'geminiNativeMime', 'geminiModelMissing',
  'geminiFormatRejected', 'GEMINI_DUSURULEBILIR', 'geminiUnknownParameter',
  'geminiQuotaExhausted',
  'PIPELINE_BUDGET_MS', 'GEMINI_PIPELINE_BUDGET_MS', 'geminiCoverageQuota', 'GEMINI_CIKTI_BUTCESI_KRK',
  'buildGeminiDocInstruction', 'extractGeminiText',
  'geminiProblem', 'geminiFigureNotes', 'callGeminiOnce', 'geminiDraft',
  // Akis (SSE) yolu — 18.10.2026.
  'GEMINI_SILENCE_MS', 'GEMINI_FIRST_BYTE_MS', 'GEMINI_ILK_OLAY_MS', 'geminiKurtarmaYeterli', 'GEMINI_PARTIAL_MIN_CHARS',
  'GEMINI_MAX_RESUMES', 'GEMINI_DEVAM_PAYI_MS', 'GEMINI_DEVAM_KAYIT_PAYI_MS', 'geminiDevamDesteklemeyen',
  'geminiAkisDurumu', 'geminiSseBlogunuIsle', 'geminiAkisiTuket',
  'geminiAkisIstegi', 'geminiAkisSonucu', 'geminiAkisiDevamEttir',
  'closeTruncatedJson', 'LATEX_IKI_HARFLI', 'repairLatexEscapes', 'geminiAkisOlcumu', 'onbellegeYazilabilir', 'onbellekKayitTuru', 'onbellekUzerineYaz', 'kismiKayitSebebi', 'maddeMetni',
  'dedupeByText', 'dedupeKeyTerms', 'normalizeForDedup', 'NEAR_DUP_THRESHOLD'
];

// Deno global'i: cikarilan kod Deno.env.get cagiriyor. Node'da yok, kukla.
const denoEnv = new Map();
// Dakikalik 429 beklemesi gercekte 20 saniye; testi uyutmasin.
denoEnv.set('GEMINI_RPM_WAIT_MS', '10');
// Ardisik istekler arasi 2,5 sn'lik pay testte kisaltiliyor — bkz. geminiRetryWaitMs.
denoEnv.set('GEMINI_RETRY_WAIT_MS', '10');
globalThis.Deno = { env: { get: (k) => (denoEnv.has(k) ? denoEnv.get(k) : undefined) } };

const G = loadFromSource('supabase/functions/summarize-document/index.ts', NAMES);

// ---------------------------------------------------------------------------
// Kukla fetch. Her cagriyi kaydeder, sirayla verilen cevaplari doner.
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch;
let fetchCalls = [];
let fetchQueue = [];

function stubFetch(responses) {
  fetchCalls = [];
  fetchQueue = responses.slice();
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({
      at: Date.now(),
      url,
      method: (options && options.method) || 'POST',
      body: options && options.body ? JSON.parse(options.body) : null,
      headers: options && options.headers
    });
    const next = fetchQueue.shift();
    if (!next) throw new Error('kukla fetch: beklenenden fazla cagri yapildi');
    if (next.throw) throw next.throw;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.json,
      text: async () => (typeof next.text === 'string' ? next.text : JSON.stringify(next.json ?? {})),
      body: akisGovdesi(next, options)
    };
  };
}
function restoreFetch() { globalThis.fetch = realFetch; }

/* 18.10.2026 — AKIS. Cagri artik stream: true gonderiyor ve cevabi SSE
   olarak okuyor, yani kuklanin json() dondurmesi yetmiyor. Bu yardimci,
   testlerde yazili `json` cevabini DENK bir olay akisina ceviriyor:
   metin step.delta olarak, durum da interaction.completed olayinin
   tasidigi kismi kaynakta. Boylece 89 testin kurdugu senaryolar
   degismeden akis yolunu olcuyor.

   `sse` alani verilirse olaylar aynen kullanilir (akisa ozgu testler),
   `hang: true` ise hicbir sey gonderilmez (sessizlik sayaci testi). */
function akisGovdesi(next, options) {
  if (!(next.status >= 200 && next.status < 300)) return undefined;
  const enc = new TextEncoder();
  const olay = (o) => `data: ${JSON.stringify(o)}\n\n`;
  let parcalar;
  if (next.hang) parcalar = null;
  else if (next.sse) parcalar = next.sse.map(o => (typeof o === 'string' ? o : olay(o)));
  else {
    const d = next.json || {};
    const durum = String(d.status || 'completed');
    const metin = G.extractGeminiText(d);
    parcalar = [];
    if (metin) parcalar.push(olay({ event_type: 'step.delta', delta: { type: 'text', text: metin } }));
    if (durum === 'in_progress' || durum === 'queued' || durum === 'requires_action') {
      parcalar.unshift(olay({ event_type: 'interaction.status_update', interaction_id: d.id || 'v1_x', status: durum }));
    } else {
      parcalar.push(olay({
        event_type: 'interaction.completed',
        event_id: 'e1',
        interaction: { id: d.id || 'v1_x', status: durum, usage: d.usage }
      }));
    }
  }
  let i = 0;
  return {
    getReader() {
      return {
        read() {
          if (parcalar && i < parcalar.length) {
            return Promise.resolve({ done: false, value: enc.encode(parcalar[i++]) });
          }
          if (!parcalar) {
            return new Promise((_res, rej) => {
              const sig = options && options.signal;
              if (!sig) return;
              sig.addEventListener('abort', () => {
                const e = new Error('iptal'); e.name = 'AbortError'; rej(e);
              });
            });
          }
          return Promise.resolve({ done: true, value: undefined });
        }
      };
    }
  };
}

/** geminiDraft bilerek cok log basiyor; testlerde sessize alinir. */
async function quiet(fn) {
  const log = console.log, warn = console.warn, error = console.error;
  console.log = console.warn = console.error = () => {};
  try { return await fn(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

const BYTES = new Uint8Array([1, 2, 3, 4]);
const OK_JSON = { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"summary":"x"}' }] }] };

// ===========================================================================
// geminiNativeMime — gölge yol YALNIZCA PDF
// ===========================================================================
test('geminiNativeMime: PDF kabul', () => {
  assert.equal(G.geminiNativeMime('application/pdf'), 'application/pdf');
});

test('geminiNativeMime: charset ekli ve buyuk harfli mime de PDF sayilir', () => {
  assert.equal(G.geminiNativeMime('APPLICATION/PDF; charset=binary'), 'application/pdf');
});

test('geminiNativeMime: DOCX/PPTX/bos gölge yola girmez', () => {
  const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const pptx = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  assert.equal(G.geminiNativeMime(docx), null);
  assert.equal(G.geminiNativeMime(pptx), null);
  assert.equal(G.geminiNativeMime(''), null);
  assert.equal(G.geminiNativeMime(undefined), null);
});

// ===========================================================================
// Model secimi
// ===========================================================================
test('geminiModelCandidates: GEMINI_MODEL yoksa varsayilan sira', () => {
  denoEnv.delete('GEMINI_MODEL');
  assert.deepEqual(G.geminiModelCandidates(), G.GEMINI_MODEL_CANDIDATES);
});

test('geminiModelCandidates: GEMINI_MODEL basa gecer, kopyalanmaz', () => {
  const sonuncu = G.GEMINI_MODEL_CANDIDATES[G.GEMINI_MODEL_CANDIDATES.length - 1];
  denoEnv.set('GEMINI_MODEL', sonuncu);
  const list = G.geminiModelCandidates();
  assert.equal(list[0], sonuncu);
  assert.equal(new Set(list).size, list.length, 'ayni model iki kez listelenmemeli');
  assert.equal(list.length, G.GEMINI_MODEL_CANDIDATES.length);
  denoEnv.delete('GEMINI_MODEL');
});

test('geminiModelCandidates: bilinmeyen bir GEMINI_MODEL de denenir', () => {
  denoEnv.set('GEMINI_MODEL', 'gemini-9-ultra-deneme');
  const list = G.geminiModelCandidates();
  assert.equal(list[0], 'gemini-9-ultra-deneme');
  assert.equal(list.length, G.GEMINI_MODEL_CANDIDATES.length + 1);
  denoEnv.delete('GEMINI_MODEL');
});

/* 09.10.2026 21:30 — AI Studio panelinden OKUNAN limitler: RPM 5,
   TPM 250K, RPD 20 (daha once 100K sandigimiz satir Antigravity'ydi).
   Asil darbogaz gunluk 20 istek. */
test('aday listesi: 503 yiyen model basta DEGIL', () => {
  // O aksam butun 503 "high demand" hatalari gemini-3.8-flash'tan geldi ve
  // gunluk kotasinin 8/20'si yanmisti; dokunulmamis modeller var.
  assert.notEqual(G.GEMINI_MODEL_CANDIDATES[0], 'gemini-3.8-flash');
  assert.ok(G.GEMINI_MODEL_CANDIDATES.includes('gemini-3.8-flash'),
    'yine de listede kalmali — sirasi degisti, elenmedi');
});

/* 25.10.2026 — 3.8 canlida 0/5 (iki 503, uc olu akis); kosu 38'de gecikmeli
   yedek olarak basladi ve yine olay getirmedi, bir RPD bosa gitti. */
test('aday listesi: olculmus olarak calismayan 3.8 EN SONDA (yedek o olmasin)', () => {
  assert.equal(G.GEMINI_MODEL_CANDIDATES[G.GEMINI_MODEL_CANDIDATES.length - 1], 'gemini-3.8-flash');
  /* 28.10.2026: 3.7 dort kosuda dort kez 0 karakter (keep-alive, sonra
     sessizlik); 3.5 olculmus AKIS GERCEK. Bas artik 3.5, 3.7 basa donmemeli. */
  assert.equal(G.GEMINI_MODEL_CANDIDATES[0], 'gemini-3.5-flash', 'gercek akis veren model basta olmali');
  assert.ok(G.GEMINI_MODEL_CANDIDATES.indexOf('gemini-3.7-flash') >
    G.GEMINI_MODEL_CANDIDATES.indexOf('gemini-3.6-flash'),
    'olculmus olu akis veren 3.7, olculmemis 3.6 dan once denenmemeli');
});

test('aday listesi: gunluk 20 istekte tukenmeyecek kadar kisa', () => {
  // Her aday basarisiz bir kosuda gunluk kotadan en az bir istek goturur.
  assert.ok(G.GEMINI_MODEL_CANDIDATES.length <= 4,
    `${G.GEMINI_MODEL_CANDIDATES.length} aday, RPD 20 icin fazla`);
  assert.ok(!G.GEMINI_MODEL_CANDIDATES.includes('gemini-2.5-flash'),
    '404 donen model listeye geri girmis — her kosuda bir istek bosa gider');
});

test('geminiModelCandidates: liste kaynaktaki diziyi degistirmez', () => {
  const before = G.GEMINI_MODEL_CANDIDATES.slice();
  G.geminiModelCandidates().push('kirletme');
  assert.deepEqual(G.GEMINI_MODEL_CANDIDATES, before);
});

// ===========================================================================
// Hata siniflandirmasi
// ===========================================================================
test('geminiModelMissing: 404 her zaman "model yok"', () => {
  assert.equal(G.geminiModelMissing(404, ''), true);
});

test('geminiModelMissing: 400 govdesine gore ayrisir', () => {
  assert.equal(G.geminiModelMissing(400, 'models/gemini-x is not found'), true);
  assert.equal(G.geminiModelMissing(400, 'Unknown model: gemini-x'), true);
  assert.equal(G.geminiModelMissing(400, 'document too large'), false);
});

test('geminiModelMissing: 429/500 model hatasi degildir', () => {
  assert.equal(G.geminiModelMissing(429, 'quota exceeded'), false);
  assert.equal(G.geminiModelMissing(500, 'internal'), false);
});

test('geminiFormatRejected: yalnizca 400 ve bicim sikayetinde', () => {
  assert.equal(G.geminiFormatRejected(400, 'Unknown field response_format'), true);
  assert.equal(G.geminiFormatRejected(400, 'mime_type not supported'), true);
  assert.equal(G.geminiFormatRejected(400, 'file too large'), false);
  assert.equal(G.geminiFormatRejected(429, 'response_format'), false);
});

/* 09.10.2026 ILK CANLI KOSU — uc modelin ucu de soyle dondu:
   400 {"error":{"message":"Unknown parameter 'thinking_level'."}}
   Endpoint ve model adlari dogruydu; tek bir alan yuzunden butun kosu
   Groq'a dustu. Bu testler o teshisi ve dusurme mekanizmasini korur. */
test('geminiUnknownParameter: canli hatadan alan adini cikarir', () => {
  const govde = '{"error":{"message":"Unknown parameter \'thinking_level\'.","code":"invalid_request"}}';
  assert.equal(G.geminiUnknownParameter(400, govde), 'thinking_level');
});

test('geminiUnknownParameter: Unknown name/field yazimlarini da okur', () => {
  assert.equal(G.geminiUnknownParameter(400, 'Unknown name "response_format"'), 'response_format');
  assert.equal(G.geminiUnknownParameter(400, 'Unknown field `generation_config`'), 'generation_config');
});

test('geminiUnknownParameter: noktali yol en ust alana indirilir', () => {
  assert.equal(G.geminiUnknownParameter(400, "Unknown parameter 'generation_config.seed'"), 'generation_config');
});

test('geminiUnknownParameter: dusurulemeyecek alan null doner', () => {
  // system_instruction ve input atilirsa istek anlamini kaybeder; o hata
  // Groq a dusmeyi hak eder, sonsuz tekrara degil.
  assert.equal(G.geminiUnknownParameter(400, "Unknown parameter 'system_instruction'"), null);
  assert.equal(G.geminiUnknownParameter(400, "Unknown parameter 'input'"), null);
  assert.equal(G.geminiUnknownParameter(400, "Unknown parameter 'model'"), null);
});

test('geminiUnknownParameter: alan adi yoksa ve 400 degilse null', () => {
  assert.equal(G.geminiUnknownParameter(400, 'file too large'), null);
  assert.equal(G.geminiUnknownParameter(429, "Unknown parameter 'thinking_level'"), null);
});

test('thinking_level artik bastan gonderilmiyor', () => {
  // Olculdu: bu hesapta reddediliyor. Gondermeye devam etmek her belgede
  // bir istegi bosa harcar ve gunluk kota 100 istek.
  assert.ok(G.GEMINI_DUSURULEBILIR.includes('thinking_level'),
    'yine de dusurulebilir listesinde kalmali — bir gun kabul edilirse diye');
});

// ===========================================================================
// buildGeminiDocInstruction — prompt'un tasimasi ZORUNLU maddeler
// ===========================================================================
test('buildGeminiDocInstruction: sayfa sayisi biliniyorsa yazilir', () => {
  const s = G.buildGeminiDocInstruction('SAYFA', 42);
  assert.match(s, /42 pages/);
  assert.match(s, /first to last/i);
});

test('buildGeminiDocInstruction: sayfa sayisi 0 ise sayi uydurulmaz', () => {
  const s = G.buildGeminiDocInstruction('SAYFA', 0);
  assert.doesNotMatch(s, /\b0 pages\b/);
  assert.match(s, /ENTIRE document/i);
});

test('buildGeminiDocInstruction: SLAYT etiketi slide der', () => {
  const s = G.buildGeminiDocInstruction('SLAYT', 12);
  assert.match(s, /12 slides/);
  assert.doesNotMatch(s, /12 pages/);
});

test('buildGeminiDocInstruction: grafik serisi ACIKCA yasaklanir', () => {
  // Bu madde dusursek sessizce sanitizeCharts tarafindan silinen, ama
  // ondan once karta girmis gibi gorunen seriler uretilir. Chunked yoldaki
  // gorsel gecisi tam bu dersi 04.10.2026'da ogrendi.
  const s = G.buildGeminiDocInstruction('SAYFA', 42);
  assert.match(s, /do NOT put a numeric series into "charts"/);
  assert.match(s, /IN WORDS/);
});

test('buildGeminiDocInstruction: visual_findings alani istenir', () => {
  // Grounding kapisinin muafiyeti bu alandan besleniyor; prompt'tan
  // dusurulurse kapi Gemini'nin tek kattigi degeri siler.
  const s = G.buildGeminiDocInstruction('SAYFA', 42);
  assert.match(s, /"visual_findings"/);
});

/* 10.10.2026 — iki kosuda ayni uc terim atildi (Differential Intercept,
   Differential Slope, Semi-Elasticity). Kapi duzeltmesi 7 atilani 5'e
   indirdi ama bu ucu kurtaramadi: model onlari visual_findings icinde
   TARIF ediyor, ADINI yazmiyor, kapi ise tam kelime esliyor. */
test('buildGeminiDocInstruction: sekil terimlerinin BIREBIR yazilmasi sart kosuluyor', () => {
  const s = G.buildGeminiDocInstruction('SAYFA', 42);
  assert.match(s, /VERBATIM/);
  assert.match(s, /key_term/);
  assert.ok(/paraphrase does not count/.test(s),
    'tarif etmenin yetmedigi acikca soylenmeli');
  // Tarihce koda tasindi: modelin dikkati kurala gitmeli, anekdota degil.
  assert.doesNotMatch(s, /Differential Intercept/,
    'prompt icine olay kaydi yazilmis — orasi kod yorumunun yeri');
});

test('buildGeminiDocInstruction: formul ve tablo okumasi istenir', () => {
  const s = G.buildGeminiDocInstruction('SAYFA', 42);
  assert.match(s, /FORMULAS:/);
  assert.match(s, /TABLES:/);
  assert.match(s, /LaTeX/);
});

// ===========================================================================
// geminiCoverageQuota
//
// 09.10.2026 ilk basarili kosu: Gemini 42 sayfayi okudu ama 7 terim / 9
// nokta / 6 soru uretti; Groq ayni belgede 15/24/11 cikarmisti. Sebep
// paylasilan promptun "5-15 key_terms" kotasiydi — o rakam kisa belgeler
// icin yazilmis. Bu testler kotanin belgenin boyuna bagli kalmasini korur.
// ===========================================================================
/* 09.10.2026 21:15 — OLCULEN GERI ADIM.
   Sisirilmis kota (25-40 terim, 20-30 nokta, tavansiz her sey) tamamlanan
   tek kosuyu bir daha tamamlanmaz hale getirdi. Bu testler kotanin bir
   daha sisirilmemesini ve formul/tablo onceliginin kaybolmamasini korur. */
/* 10.10.2026 15:14: bant 22-28'e cikarildi ve nokta sayisi 18'den 11'e
   DUSTU. Cikti tavana da carpmiyordu. Sebep kapsam metnindeki uc ayri
   cekinceydi — sayilar istege donusmustu. */
test('geminiCoverageQuota: sayilar EMIR, istek degil', () => {
  const q = G.geminiCoverageQuota(42);
  assert.doesNotMatch(q, /if and only if/i, 'cekince sayilari istege cevirir');
  assert.doesNotMatch(q, /not a quota to fill/i);
  assert.doesNotMatch(q, /stopping short of them is correct/i);
  assert.match(q, /reach them/, 'sayilar duz emir olarak verilmeli');
  // Dolguya karsi TEK cumle kalmali — uc tane birikince sayilar eriyor.
  assert.match(q, /restating the same idea/);
});

test('geminiCoverageQuota: sayilar OLCULEN banda geri geldi, sisirilmedi', () => {
  // Ilk hali 25-40 terim isteyip kosuyu tamamlanamaz hale getirmisti;
  // kota tamamen kalkinca kosu tamamlandi ama 8 terim kaldi. Bu bant
  // ikisinin arasi ve bir daha yukari kacmamali.
  const q = G.geminiCoverageQuota(42);
  const alt = Number(q.match(/(\d+)-(\d+) key_terms/)[1]);
  const ust = Number(q.match(/(\d+)-(\d+) key_terms/)[2]);
  assert.ok(alt >= 15, `alt sinir ${alt} — Groq un 16 terimine yaklasmali`);
  assert.ok(ust <= 30, `ust sinir ${ust} — 25-40 bandi kosuyu tamamlanamaz yapmisti`);
});

test('geminiCoverageQuota: sayilar formul ve tablodan SONRA isteniyor', () => {
  // Sira onemli: tavan 78 sn ve olculen kosu 67,4 sn surdu. Model once
  // degerli olani uretmeli, sayilar artan zamana kalmali.
  const q = G.geminiCoverageQuota(42);
  assert.ok(q.indexOf('"formulas"') < q.indexOf('key_terms'),
    'formuller sayilardan sonra isteniyor — sira ters');
  assert.match(q, /do them first/);
});

/* 21.10.2026 — BU TEST ESKIDEN "nokta bandi Groq un uretimine yetisiyor"
   diye alt siniri 20'de TUTUYORDU. Gerekcesi 10.10'daki olcumdu: Groq ayni
   destede 25 nokta veriyordu, Gemini 18, ve 81,3 sn'lik kosuda 23,7 saniye
   bosluk vardi. O bosluk artik yok — 21.10'da ayni deste 96,9 saniyede
   kesildi, cunku ilk olay 26 saniyeye gecikiyor ve ilk denemeyi 503 yakiyor.
   Groq'un nokta sayisina yetismek, olculdugu uzere, kartin kendisine mal
   oluyor: iki belgede de 27 nokta uretildi ve ikisi de KISMI kaldi.

   Artik korunan sey tersi: bandin pencereye sigmasi. */
test('geminiCoverageQuota: nokta bandi PENCEREYE sigiyor', () => {
  const q = G.geminiCoverageQuota(42);
  const ust = Number(q.match(/(\d+)-(\d+) key_points/)[2]);
  /* 560 krk/sn olculen yazma hizi, ilk olay 26-30 sn, tavan 105 sn (503
     varsa 96,9): yazilabilir en fazla ~40-44 KB. 22-28 bandi iki olcumde de
     34-37 KB uretti ve bitiremedi. */
  assert.ok(ust <= 20,
    `nokta ust siniri ${ust} — 22-28 bandi iki belgede de karti yarim birakti`);
  assert.ok(Number(q.match(/(\d+)-(\d+) key_points/)[1]) >= 14,
    'alt sinir cok dustu, kart icerik tasimaz');
});

const QUOTA_RE = /(\d+)-(\d+) key_terms, (\d+)-(\d+) key_points and (\d+)-(\d+) quiz_questions/;
const quotaBant = (n) => G.geminiCoverageQuota(n).match(QUOTA_RE).slice(1).map(Number);

test('geminiCoverageQuota: 25-60 araligi ARTIK zirve degil', () => {
  /* 20.10'da band 60 sayfa USTUNDE geri indirilmisti, ama zirve orada
     degildi: gunluk kullanimin tamami 25-60 araligina dusuyor ve en yuksek
     istek oradaydi. 38 ve 42 sayfalik iki belge, iki KISMI kart. */
  assert.deepEqual(quotaBant(42), quotaBant(20),
    '42 sayfa 20 sayfadan daha fazla uretim istiyor — zirve yine 25-60 arasinda');
  assert.deepEqual(quotaBant(38), quotaBant(20),
    '38 sayfa icin band hala yukseltilmis');
});

/* 21.10.2026 — KALEM KOTASI TOPLAM UZUNLUGU BAGLAMIYOR.
   Band 25-60'ta indirildi, nokta 27 → 18 oldu ve cikti BUYUDU: 34.372 →
   39.649 karakter. Kotali olan tek kisim terim/nokta/soru; "formulas",
   "tables" ve visual_findings bilerek tavansiz. Model bosalan yeri tavansiz
   kisma harcadi — gorsel bulgu 6 → 13 → 22. Sinir TOPLAM uzunluga konmali. */
/* 21.10.2026 — 91 SANIYELIK KOSUNUN 57,7 SANIYESI BEKLEMEYDI.
 *
 *   TokenPacer[openai/gpt-oss-20b]: 57657ms bekliyor (used=5891/7200, est=1795)
 *   Long-doc visual patch: +2 terms, +2 points, +2 quiz, +2 sections, +2 tables
 *
 * Pencereler 20,9. saniyede bitti, kart 90,6. saniyede cikti. Kapi yalnizca
 * "yer var mi" diye soruyordu; Gemini iki 503 ile erken dustugu icin geriye
 * 130 saniye kalmisti, yani yer boldu ve 57,7 saniyelik kuyruk beklemesi
 * onaylandi — iki sekil sayfasindan 2 terim almak icin. */
test('gorsel gecis: pacer kuyrugu uzunsa butce bol olsa bile ATLANIR', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  assert.ok(/const OPSIYONEL_ADIM_MAX_BEKLEME_MS = /.test(src),
    'bekleme tavani yok — kapi yine yalnizca butceye bakar');
  assert.ok(src.includes('visionWaitMs > OPSIYONEL_ADIM_MAX_BEKLEME_MS'),
    'pacer beklemesi tavanla karsilastirilmiyor');
  /* Iki kol ayni karari okumali: biri atlarken digeri cagirirsa gorsel
     gecis hem atlanmis sayilir hem kosar. */
  const atla = src.indexOf('const visionAtlanir =');
  assert.ok(atla > 0, 'tek bir atlama karari yok');
  assert.ok(src.includes('visualPlan.indices.length > 0 && visionAtlanir'), 'atlama kolu karari okumuyor');
  assert.ok(src.includes('visualPlan.indices.length > 0 && !visionAtlanir'), 'cagri kolu karari okumuyor');
  assert.ok(!/budgetLeft\(\) > visionNeedsMs/.test(src),
    'cagri kolu hala dogrudan butceye bakiyor — iki kol birbirinden kayabilir');
});

/* 21.10.2026, IKINCI TUR — TAVAN YANLIS CAGRIYA KONMUSTU.
 *
 * Ilk hali yalnizca gorsel gecisi koruyordu ve kosu yine 57,9 saniye
 * bekledi:
 *
 *   t=34,4  Window 1 ok / Window 2 ok
 *   t=34,5  TokenPacer[openai/gpt-oss-20b]: 57955ms bekliyor (used=6095/7200)
 *   t=93,6  Gorsel sayfa secimi [26,40]
 *
 * Bekleme gorsel cagridan ONCE, compact synthesis'te olusuyor. Gorsel kapisi
 * sahneye geldiginde dakikalik pencere donmustu, waitEstimate kucuk cikti ve
 * kapi kendi mantigina gore dogru olarak gecirdi. Iki pencere cagrisi her iki
 * seridi birlikte bosaltiyor; sonraki cagri hangi seride giderse gitsin
 * bekliyor (olculen: 57.657ms ve 57.955ms — dakikalik pencerenin kendisi). */
test('compact synthesis de pacer kuyrugu uzunsa ATLANIYOR', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  const i = src.indexOf('const synBekleme = tokenPacer.waitEstimate');
  assert.ok(i > 0,
    'sentez cagrisinin pacer beklemesi hic olculmuyor — 58 saniyelik kuyruk yine yanar');
  const blok = src.slice(i, i + 900);
  assert.ok(blok.includes('synBekleme > OPSIYONEL_ADIM_MAX_BEKLEME_MS'),
    'sentez beklemesi tavanla karsilastirilmiyor');
  assert.ok(blok.includes("skippedStages.push('compact synthesis')"),
    'atlanan sentez karta yazilmiyor — ogrenci neyi kaybettigini bilmiyor');
  /* Atlama try/catch'e throw ile degil, else koluyla yapilmali: catch
     'Compact synthesis skipped:' basiyor ve iki log birbiriyle celisirdi. */
  assert.ok(/\} else \{\s*\n\s*const syn = await callGroqJson/.test(blok),
    'sentez atlamasi else koluyla yapilmiyor');
});

/* 21.10.2026, UCUNCU TUR — BEKLEMENIN SEBEBI METIN DEGIL REZERVASYONDU.
 *
 * Logdaki `est=1795`in 1.229'u PACER_COMPLETION_FACTOR (0,6) x 2048
 * rezervasyonu; gercek prompt ~566 token. Yani pacer, sentezin
 * harcamayacagi bir yer icin dakikanin donmesini bekletiyordu:
 *   6.095 (kullanilmis) + 1.816 (est) = 7.911 > 7.200 -> 57.955ms bekleme
 * completion 768 olunca est ~1.048 ve 6.095 + 1.048 = 7.143 <= 7.200,
 * yani bekleme sifir ve sentez ATLANMAK yerine kosuyor.
 *
 * Bu testin korudugu sey bir sayi degil, UC YERIN AYNI sayiyi kullanmasi:
 * pickLane, waitEstimate ve cagrinin kendisi. Biri 2048'de kalirsa kapi
 * sigacak bir cagriyi atlar ve rezervasyon hatasi geri doner. */
/* 21.10.2026 — YAZARIN ISTEGI GERCEK TPM TAVANINI ASIYORDU.
 *
 * Olculen: writerSys 2.205 krk, writerUser tavanlarinin toplami 20.300 krk.
 * est = (2.205 + 20.300)/3,2 + 0,6x2048 = 8.271 token; derin modda
 * (completion 3072) 8.886. Seridin GERCEK limiti 8.000 — yani yazarin istegi
 * TEK BASINA tavani asiyordu ve soguk seritte gectiginde Groq'un kendisi
 * "Request too large" ile reddetmeye adaydi.
 *
 * ONEMLI: bu kirpma SURE KAZANDIRMIYOR. Pencerelerin biraktigi bosluk
 * HEAVY'de 7.200-5.747 = 1.453, EXTRACT'te 1.105 token; kirpilmis est 7.012
 * bile bunun dort kati. Yazar yine yalnizca `used === 0` kolundan geciyor ve
 * seridin bosalmasini bekliyor; harcama tek kayit olarak atomik eskidigi icin
 * daha kucuk est beklemeyi kisaltmiyor da. Test bu yuzden sureyi degil
 * TAVANI koruyor. */
test('anlati yazarinin istegi gercek TPM tavaninin ALTINDA', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  const i = src.indexOf('const writerSys = `');
  assert.ok(i > 0, 'writerSys bulunamadi');
  const sysLen = src.slice(i + 19, src.indexOf('`', i + 19)).length;

  /* writerUser'in tavanlari. Kaynakta slice(0, N) olarak duruyorlar; biri
     buyutulurse bu liste de guncellenmeli, yoksa test yanlis sayiyi korur. */
  const caps = [
    500,    // summary_executive
    2500,   // terms/konu basliklari blogu
    5000,   // sectionsBlock  <- 7000'den indirildi
    2000,   // key_terms
    2000,   // key_points
    1600,   // formuller
    1200,   // cozumlu ornekler
    1500    // taslak ozet    <- 3500'den indirildi
  ];
  const userLen = caps.reduce((a, b) => a + b, 0);
  const est = (c) => Math.ceil((sysLen + userLen) / 3.2) + Math.ceil(c * G.PACER_COMPLETION_FACTOR);

  for (const [ad, completion] of [['standard', 2048], ['derin', 3072]]) {
    assert.ok(est(completion) <= G.DEFAULT_TPM_LIMIT,
      `${ad} modda yazar istegi ${est(completion)} token — gercek tavan ` +
      `${G.DEFAULT_TPM_LIMIT}; Groq "Request too large" ile reddedebilir`);
  }

  // Kaynaktaki iki sayinin gercekten indirildigini de kilitle.
  assert.ok(/\.slice\(0, 5000\)/.test(src), 'sectionsBlock kirpmasi geri alinmis');
  assert.ok(!/slice\(0, depthFlags\.longNarrative \? 10000 : 7000\)/.test(src),
    'sectionsBlock hala 7000/10000 — est tavani asar');
  assert.ok(!/draftObj\.summary \|\| ''\)\.slice\(0, 3500\)/.test(src),
    'taslak ozet hala 3500 — est tavani asar');
});

test('yazar kirpmasi sureyi DEGIL tavani koruyor (aritmetik)', () => {
  /* Bu test bir iddiayi degil bir YANLIS BEKLENTIYI kilitliyor: kirpmanin
     ~48 sn kazandirdigi soylenmisti, aritmetik tutmuyor. Birisi ileride
     "yazar neden hala bekliyor" diye sorarsa cevap burada. */
  const seritButcesi = Math.floor(G.DEFAULT_TPM_LIMIT * G.PACER_SAFETY);
  assert.equal(seritButcesi, 7200, 'serit butcesi degismis, asagidaki sayilar yeniden hesaplanmali');
  const w1 = 5747, w2 = 6095;   // olculen pencere harcamalari
  const kalanHeavy = seritButcesi - w1;
  const kalanExtract = seritButcesi - w2;
  assert.ok(kalanHeavy < 2000 && kalanExtract < 2000,
    'pencereler seritleri bosaltmiyor — yazarin beklemesi baska sebepten');
  /* Yazarin en iyi haldeki est'i bile bu bosluklarin katlari; yani bekleme
     promptu kirparak kaldirilamaz. Kaldirmanin yolu kapasite artirmak. */
  assert.ok(7012 > kalanHeavy * 3,
    'aritmetik degismis: kirpilmis est artik bosluga sigiyor olabilir, yeniden olc');
});

test('sentezin completion degeri UC yerde de ayni', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  const i = src.indexOf('const synCompletion =');
  assert.ok(i > 0, 'sentez completion degeri tek degiskene baglanmamis');
  const blok = src.slice(i, i + 1800);
  assert.ok(/const synCompletion = (\d+)/.test(blok), 'synCompletion sayisi okunamadi');
  const deger = Number(blok.match(/const synCompletion = (\d+)/)[1]);
  assert.ok(deger <= 1024,
    `synCompletion ${deger} — 0,6 carpaniyla rezervasyon ${Math.round(deger * 0.6)} token, ` +
    'olculen 6.095 kullanimin ustune eklenince 7.200 asilir ve bekleme geri doner');
  assert.ok(deger >= 512, `synCompletion ${deger} — ozet + anahat bu kadara sigmaz`);
  // pickLane, waitEstimate ve cagri: ucu de degiskeni okumali, sabit yazmamali.
  /* Tanim ile cagri arasi ~40 satir (araya gerekceli yorum giriyor), o yuzden
     bu iki kontrol pencerede degil TUM kaynakta yapiliyor; isimler tekil. */
  assert.equal(
    (src.match(/estimateTokens\(synSys, synUser, synCompletion\)/g) || []).length, 2,
    'pickLane ve waitEstimate ikisi de degiskeni okumali');
  assert.ok(src.includes('maxCompletionTokens: synCompletion'),
    'cagrinin kendisi hala sabit completion kullaniyor');
  assert.ok(!/estimateTokens\(synSys, synUser, 2048\)/.test(src),
    '2048 ile tahmin eden bir yer kalmis — kapi sigacak cagriyi atlar');
});

/* `kept=0` BENI YANLIS TESHISE GOTURDU (21.10.2026).
   Groq uzun-belge yolunda `kept` her zaman 0, cunku o yolda modelden atif
   istenmiyor: pencere semasinda `footnotes` yok, birlesim sabit `[]`
   gonderiyor. Ben bunu Gemini'nin `kept=30`uyla yan yana koyup "atiflarin
   tamami dusuyor" diye okudum. Dusen yok; istenen yok. */
test('citation anchoring logu atif ISTENMEDIGI hali soyluyor', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  assert.ok(src.includes('const atifIstenmedi ='),
    'log kept=0 halini ayirt etmiyor — ayni yanlis teshis tekrar edilir');
  const i = src.indexOf('const atifIstenmedi =');
  const blok = src.slice(i, i + 700);
  assert.ok(/kept === 0 && anchored\.stats\.demoted === 0/.test(blok),
    'ayrim demoted ile birlikte yapilmali: dizi dolu olup sayfalari hatali olsaydi demoted artardi');
  assert.ok(/atif YOKTU/.test(blok), 'log metni durumu yazmiyor');
});

test('long-doc birlesimi atif istemiyor — bu BILINCLI, log da oyle demeli', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  /* Semaya footnotes eklemek olculerek reddedilmis bir taviz: her ek alan
     maxCompletionTokens'i key_terms/key_points'ten caliyor. Bu test o
     tavizi KORUYOR, degistirmek isteyen bilerek bu testi dusurecek. */
  assert.ok(src.includes('footnotes: [],'),
    'long-doc birlesimi artik footnotes gonderiyor — kota tavizi gozden gecirilmeli');
});

test('tavan IKI opsiyonel adimi da kapsiyor', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  const kullanim = (src.match(/OPSIYONEL_ADIM_MAX_BEKLEME_MS/g) || []).length;
  // 1 tanim + sentez kapisi + gorsel kapisi + iki log satiri
  assert.ok(kullanim >= 4,
    `tavan ${kullanim} yerde geciyor — iki opsiyonel adimdan biri korunmasiz`);
  assert.ok(!/VISION_PACER_MAX_WAIT_MS/.test(src),
    'eski isim kalmis — tavan artik yalnizca gorsel gecise ait degil');
});

test('gorsel bekleme tavani cagrinin kendisinden buyuk ama kuyruga izin vermiyor', () => {
  /* Cagrinin kendisi dort canli kosuda 6,0-7,2 saniye olculdu. Tavan onun
     uzerinde olmali (kisa bir pacer beklemesi mesru), ama 57,7 saniyelik
     kuyrugu gecirmemeli. */
  assert.ok(G.OPSIYONEL_ADIM_MAX_BEKLEME_MS > 7_200,
    `tavan ${G.OPSIYONEL_ADIM_MAX_BEKLEME_MS}ms — mesru kisa beklemeleri de keser`);
  assert.ok(G.OPSIYONEL_ADIM_MAX_BEKLEME_MS < 57_657,
    `tavan ${G.OPSIYONEL_ADIM_MAX_BEKLEME_MS}ms — 21.10'daki 57,7 saniyelik kuyrugu gecirir`);
});

test('geminiCoverageQuota: TOPLAM uzunluk butcesi veriliyor', () => {
  const q = G.geminiCoverageQuota(42);
  assert.match(q, /LENGTH BUDGET/, 'toplam uzunluk butcesi yok — model duvara kadar yazar');
  assert.ok(q.includes(String(G.GEMINI_CIKTI_BUTCESI_KRK)),
    `butce sayisi promptta gecmiyor (${G.GEMINI_CIKTI_BUTCESI_KRK})`);
  assert.match(q, /ENTIRE JSON/, 'butce tek alana degil butun cevaba baglanmali');
});

test('cikti butcesi OLCULEN tamamlanmaya dayaniyor', () => {
  /* Tamamlanan tek kosu 30.374 karakterdi (72,4 sn). Yazma hizi 450-560
     krk/sn; butce bunun ustune cikarsa tavanin altinda bitmez. */
  assert.ok(G.GEMINI_CIKTI_BUTCESI_KRK <= 32_000,
    `butce ${G.GEMINI_CIKTI_BUTCESI_KRK} — tamamlanan kosu 30.374 karakterdi, bu ustu asiyor`);
  assert.ok(G.GEMINI_CIKTI_BUTCESI_KRK >= 20_000,
    `butce ${G.GEMINI_CIKTI_BUTCESI_KRK} — bu kadar kisa bir cevap kart tasimaz`);
});

test('cikti butcesi sayilari EMIR olmaktan cikarmiyor', () => {
  /* 10.10 dersi: cekinceler sayilari istege cevirmisti. Butce metni
     "elinden geldigince" gibi bir kacis kapisi getirmemeli. */
  const q = G.geminiCoverageQuota(42);
  assert.match(q, /reach them/, 'sayilar emir olmaktan cikmis');
  assert.doesNotMatch(q, /if possible|try to keep|aim to stay/i,
    'butce metni kacis kapisi iceriyor');
});

test('cikti butcesi formul ve tablo onceligini KORUYOR', () => {
  // Butce kisarken ilk kesilecek sey golge yolun var olma sebebi olmamali.
  const q = G.geminiCoverageQuota(42);
  assert.match(q, /No cap on/, 'formul/tablo tavansizligi butceyle birlikte gitmis');
  const butceAt = q.indexOf('LENGTH BUDGET');
  assert.ok(/formulas and tables first/.test(q.slice(butceAt)),
    'butce metni neyin once gelecegini soylemiyor');
});

test('geminiCoverageQuota: HICBIR sayfa sayisi 10-25 bandini gecmiyor', () => {
  /* "Sayfa basina en az zamani oldugu anda en cok cikti" hatasinin genel
     hali. Bir daha herhangi bir araliga gizlice zirve eklenmesin. */
  const tavan = quotaBant(20);
  for (const n of [0, 5, 10, 11, 25, 26, 42, 60, 61, 86, 200]) {
    const b = quotaBant(n);
    for (let i = 0; i < b.length; i++) {
      assert.ok(b[i] <= tavan[i],
        `${n} sayfa icin band 10-25 bandini geciyor: ${b} > ${tavan}`);
    }
  }
});

test('geminiCoverageQuota: formul ve tablo tavansiz kalir', () => {
  // Gölge yolun butun gerekcesi bu ikisi: 42 sayfanin 22'sinde denklem
  // resim olarak duruyor ve Groq onlarin yalnizca 2'sini gorebiliyor.
  const q = G.geminiCoverageQuota(42);
  assert.match(q, /No cap/i);
  assert.match(q, /"formulas"/);
  assert.match(q, /"tables"/);
});

test('geminiCoverageQuota: butun sayfalardan toplamasi istenir', () => {
  assert.match(G.geminiCoverageQuota(42), /all 42 pages/);
  assert.match(G.geminiCoverageQuota(0), /the whole document/);
  assert.doesNotMatch(G.geminiCoverageQuota(0), /all 0 pages/);
});

test('butce: Gemini yolu review a yer birakacak kadar genis, sert sinirin altinda', () => {
  // Olculdu: 72,4 sn Gemini cagrisindan sonra 110 sn butcede 26,8 sn
  // kaliyordu ve review un en kucuk kademesi 33 sn istiyor.
  assert.ok(G.GEMINI_PIPELINE_BUDGET_MS > G.PIPELINE_BUDGET_MS,
    'Gemini yolunda pencere cagrilari yok, butce dar kalmamali');
  assert.ok(G.GEMINI_PIPELINE_BUDGET_MS - 72_400 > 33_000,
    '72,4 sn lik bir cagridan sonra review (33 sn) hala sigmali');
  assert.ok(G.GEMINI_PIPELINE_BUDGET_MS <= 135_000,
    'Supabase nin ~150 sn sert sinirina emniyet payi kalmali');
});

// ===========================================================================
// GEMINI_MODE — only (varsayilan) ve shadow
//
// Olculdu: Gemini ~72 sn, Groq'un tam kosusu ~71 sn, Supabase'in sert siniri
// ~150 sn. Ikisi tek istege sigmiyor. only modunda Groq taslak icin hic
// cagrilmaz ve butun butce Gemini'nindir.
// ===========================================================================
test('geminiMode: varsayilan shadow — Groq agda kalir', () => {
  // only modunda Gemini tamamlanamayinca ogrenci bos donuyordu.
  denoEnv.delete('GEMINI_MODE');
  assert.equal(G.geminiMode(), 'shadow');
});

test('geminiMode: only acikca secilir, yazim/bosluk onemsiz', () => {
  denoEnv.set('GEMINI_MODE', '  ONLY ');
  assert.equal(G.geminiMode(), 'only');
  denoEnv.delete('GEMINI_MODE');
});

test('geminiMode: taninmayan deger shadow sayilir', () => {
  denoEnv.set('GEMINI_MODE', 'bilinmeyen');
  assert.equal(G.geminiMode(), 'shadow');
  denoEnv.delete('GEMINI_MODE');
});

/* 10.10.2026 16:05 — only modu artik bir URUN yolu, karsilastirma modu
   degil. Tek 503 ogrenciye bos ekran demek; ama her basarisizlikta Groq'a
   dusmek de olmaz, cunku Gemini 105 saniyeyi yakmissa geriye Groq'un tam
   kosusuna yer kalmiyor.

   O aksamin olcumleri ikiye ayriliyor ve arada bosluk var:
     HIZLI (503/429/400): 3,9 / 8,4 / 11,1 / 35,8 saniye
     YAVAS (zaman asimi): 67,9 / 74,9 / 77,9 / 89,9 / 105 saniye */
/* 10.10.2026 17:40 — ILK ESIK (100 sn) YANLISTI.
   O kosuda: deneme 1 -> 503 (3,5 sn), deneme 2 -> zaman asimi (105 sn),
   toplam 111 sn, geriye 33,9 sn. Esigin altinda kaldi ve belge basarisiz
   isaretlendi — oysa 33,9 saniye bir kart uretmeye yeterdi.

   Iki duzeltme: (1) Gemini'nin TOPLAM duvar saati tavanla sinirli, yani
   geriye her zaman en az butce-tavan kadar kaliyor; (2) esik "tam Groq
   kosusu" degil "en az bir kart" olcusune indi. */
test('only fallback: Gemini en cok tavani yakabilir, toplami degil', () => {
  // geminiToplamTavan sayesinde en kotu halde geriye bu kadar kalir.
  const enAzKalan = G.GEMINI_ONLY_BUDGET_MS - G.GEMINI_ONLY_MAX_CALL_MS;
  assert.ok(enAzKalan >= G.GEMINI_ONLY_FALLBACK_MIN_MS,
    `Gemini tavani tamamen yakarsa geriye ${enAzKalan}ms kaliyor ama esik ` +
    `${G.GEMINI_ONLY_FALLBACK_MIN_MS}ms — fallback hic tetiklenemez`);
});

test('only fallback esigi: Groq un pencerelerine yetecek kadar', () => {
  // Olculdu: Gemini'den sonra pacer butcesi taze, iki pencere 6 saniyede
  // bitiyor. Pencereler + birlesim + kayit 30 saniyede siger.
  assert.ok(G.GEMINI_ONLY_FALLBACK_MIN_MS >= 25_000,
    'esik cok dusuk — Groq pencereleri bile bitiremeden butce doluyor');
  assert.ok(G.GEMINI_ONLY_FALLBACK_MIN_MS <= 60_000,
    'esik cok yuksek — 17:40 kosusundaki gibi uretilebilir kartlar atilir');
});

test('only fallback: en kotu toplam sure Supabase sinirinin altinda', () => {
  // Gemini tavani + geriye kalan butcenin tamami + kayit payi.
  const enKotu = G.GEMINI_ONLY_MAX_CALL_MS +
    (G.GEMINI_ONLY_BUDGET_MS - G.GEMINI_ONLY_MAX_CALL_MS) + 5_000;
  assert.ok(enKotu <= 150_000, `en kotu toplam ${enKotu}ms`);
});

test('only modu butun butceyi Gemini ye verir', () => {
  // Olculen (10.10.2026): 42 sayfalik gorsel deste 67,4 sn; 9 sayfalik
  // metin belgesi 89,9 sn — ve o kosu 52 MS kala yetisti. Tavan olculen
  // en uzun sureye rahat pay birakmali, yoksa kapsami artirmak dogrudan
  // "kart hic gelmiyor" demek (only modunda Groq yedek degil).
  assert.ok(G.GEMINI_ONLY_MAX_CALL_MS >= 100_000,
    `only tavani ${G.GEMINI_ONLY_MAX_CALL_MS}ms — olculen 89,9 sn ye pay birakmiyor`);
  assert.ok(G.GEMINI_ONLY_BUDGET_MS - G.GEMINI_ONLY_MAX_CALL_MS >= G.GEMINI_RESERVE_MS - 5_000,
    'cagri bittikten sonra review kapisina ve kayda yer kalmiyor');
  // Sinir NOMINAL butce degil, GERCEK duvar saati: cagri tavani + cagri
  // sonrasi is (olculdu: 3,1 sn). Toplam kosu 94,4 sn surmustu.
  const gercekEnKotu = G.GEMINI_ONLY_MAX_CALL_MS + 10_000
  assert.ok(gercekEnKotu <= 125_000,
    `en kotu gercek sure ~${gercekEnKotu}ms — Supabase nin ~150 sn sinirina pay kalmali`);
});

test('geminiDraft: only modunda cagri shadow dan uzun yasar', async () => {
  // Ayni butce, iki mod: only modunda Groq a pay saklanmadigi icin cagri
  // daha uzun surebilmeli. Fark gölge yolun bu belgede tamamlanip
  // tamamlanamayacagini belirliyor.
  let onlyMs = 0, shadowMs = 0;
  const yakala = async (mode) => {
    stubFetch([{ status: 200, json: OK_JSON }]);
    const log = console.log;
    let satir = '';
    console.log = (s) => { if (typeof s === 'string' && /cagri zaman asimi/.test(s)) satir = s; };
    try {
      await G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 125_000, mode);
    } finally { console.log = log; restoreFetch(); }
    return Number((satir.match(/zaman asimi (\d+)ms/) || [])[1] || 0);
  };
  onlyMs = await yakala('only');
  shadowMs = await yakala('shadow');
  assert.ok(onlyMs > shadowMs,
    `only (${onlyMs}ms) shadow dan (${shadowMs}ms) uzun olmaliydi`);
  assert.ok(onlyMs >= 80_000, `only modunda cagri yalnizca ${onlyMs}ms yasiyor`);
});

// ===========================================================================
// extractGeminiText
// ===========================================================================
test('extractGeminiText: Interactions sekli', () => {
  const data = { steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"a":1}' }] }] };
  assert.equal(G.extractGeminiText(data), '{"a":1}');
});

test('extractGeminiText: parcali metin birlestirilir', () => {
  const data = { steps: [{ type: 'model_output', content: [{ text: '{"a":' }, { text: '1}' }] }] };
  assert.equal(G.extractGeminiText(data), '{"a":1}');
});

test('extractGeminiText: SON model_output alinir', () => {
  const data = {
    steps: [
      { type: 'model_output', content: [{ text: 'eski' }] },
      { type: 'user_input', content: [{ text: 'soru' }] },
      { type: 'model_output', content: [{ text: 'yeni' }] }
    ]
  };
  assert.equal(G.extractGeminiText(data), 'yeni');
});

test('extractGeminiText: metin olmayan parcalar atlanir', () => {
  const data = {
    steps: [{
      type: 'model_output',
      content: [{ type: 'thought', text: 'dusunce' }, { type: 'text', text: 'cevap' }]
    }]
  };
  assert.equal(G.extractGeminiText(data), 'cevap');
});

test('extractGeminiText: generateContent sekli de okunur', () => {
  const data = { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] };
  assert.equal(G.extractGeminiText(data), 'ab');
});

test('extractGeminiText: taninmayan sekilde bos string, patlamaz', () => {
  assert.equal(G.extractGeminiText(null), '');
  assert.equal(G.extractGeminiText({}), '');
  assert.equal(G.extractGeminiText({ steps: [] }), '');
  assert.equal(G.extractGeminiText('metin'), '');
});

// ===========================================================================
// geminiProblem
// ===========================================================================
test('geminiProblem: temiz cevapta null', () => {
  assert.equal(G.geminiProblem({ status: 'completed', steps: [] }), null);
});

test('geminiProblem: incomplete yakalanir (yarim JSON)', () => {
  const p = G.geminiProblem({ status: 'incomplete' });
  assert.ok(p && /incomplete/.test(p), `beklenen incomplete, gelen: ${p}`);
});

test('geminiProblem: failed/cancelled yakalanir', () => {
  assert.match(String(G.geminiProblem({ status: 'failed' })), /failed/);
  assert.match(String(G.geminiProblem({ status: 'cancelled' })), /cancelled/);
});

test('geminiProblem: errors ve error alanlari yakalanir', () => {
  assert.match(String(G.geminiProblem({ errors: [{ code: 7 }] })), /errors=/);
  assert.match(String(G.geminiProblem({ error: { message: 'x' } })), /error=/);
});

test('geminiProblem: STOP disi finishReason yakalanir, STOP gecer', () => {
  assert.match(String(G.geminiProblem({ candidates: [{ finishReason: 'MAX_TOKENS' }] })), /MAX_TOKENS/);
  assert.equal(G.geminiProblem({ candidates: [{ finishReason: 'STOP' }] }), null);
});

test('geminiProblem: bos/yanlis tipte cevap sorun sayilir', () => {
  assert.ok(G.geminiProblem(null));
  assert.ok(G.geminiProblem('metin'));
});

// ===========================================================================
// geminiFigureNotes
// ===========================================================================
test('geminiFigureNotes: visual_findings, formul, tablo ve diyagram toplanir', () => {
  const notes = G.geminiFigureNotes({
    visual_findings: ['Regresyon ciktisinda R-kare 0,87 olarak okundu'],
    formulas: [{ name: 'OLS tahmincisi', latex: '\\hat{\\beta} = (X^TX)^{-1}X^Ty' }],
    tables: [{ title: 'Regresyon ciktisi', headers: ['Degisken', 'Katsayi'] }],
    diagrams: [{ title: 'Model kurma akisi' }]
  });
  assert.equal(notes.length, 4);
  assert.match(notes[0], /R-kare/);
  assert.match(notes[1], /OLS tahmincisi: /);
  assert.match(notes[2], /Regresyon ciktisi \(Degisken \| Katsayi\)/);
  assert.equal(notes[3], 'Model kurma akisi');
});

test('geminiFigureNotes: bos/kisa/eksik kayitlar atilir', () => {
  const notes = G.geminiFigureNotes({
    visual_findings: ['', '  ', 'ab', null, 'gecerli bulgu'],
    formulas: [{ name: '', latex: '' }],
    tables: [{ title: '' }],
    diagrams: [{}]
  });
  assert.deepEqual(notes, ['gecerli bulgu']);
});

test('geminiFigureNotes: bosluklar tek bosluga iner, 300 karakterde kesilir', () => {
  const notes = G.geminiFigureNotes({ visual_findings: ['a\n\n  b\tc'] });
  assert.equal(notes[0], 'a b c');
  const uzun = G.geminiFigureNotes({ visual_findings: ['x'.repeat(500)] });
  assert.equal(uzun[0].length, 300);
});

test('geminiFigureNotes: tavanda durur (60 -> 200, 28.10.2026)', () => {
  /* 60'in gerekcesi "review prompt sismesin" idi ama review zaten
     visionNotes.slice(0, 20) aliyor — tavan onu hic korumuyordu. Tavanin
     gercek musterisi temellendirme kapisi: notlarin TAMAMINI kaynak metne
     ekliyor. Tablo hucreleri eklenince 60 hemen doluyordu. */
  const notes = G.geminiFigureNotes({
    visual_findings: Array.from({ length: 400 }, (_, i) => `bulgu numarasi ${i}`)
  });
  assert.equal(notes.length, G.GEMINI_SEKIL_NOTU_TAVANI);
  assert.ok(G.GEMINI_SEKIL_NOTU_TAVANI >= 100, 'tavan tablo hucrelerine yetmiyor');
});

test('geminiFigureNotes: tablo HUCRELERI de toplanir', () => {
  /* Olculen kosu (28.10, Kanin Ozellikleri): uc tablonun 25+ satiri
     figureText'e hic ulasmiyordu, cunku yalnizca baslik+sutun aliniyordu.
     Yalnizca resim olarak var olan icerik tam da hucrelerde. */
  const notes = G.geminiFigureNotes({
    tables: [{
      title: 'Plazma inorganik bilesenleri',
      headers: ['Madde', 'Miktar'],
      rows: [['Sodyum', '145 mM'], ['Klor', '103 mM']]
    }]
  });
  assert.ok(notes.some(function (n) { return /Sodyum \| 145 mM/.test(n); }),
    'tablo hucresi toplanmiyor: ' + JSON.stringify(notes));
  assert.ok(notes.some(function (n) { return /Klor \| 103 mM/.test(n); }));
  // Baslik+sutun satiri ONCE gelmeli: review ilk 20'yi aliyor.
  assert.ok(/Plazma inorganik bilesenleri \(Madde \| Miktar\)/.test(notes[0]),
    'ozet satir sona dusmus — review hacimli malzemeyi gorur');
});

test('geminiFigureNotes: diyagram ETIKETLERI ve aciklamasi toplanir', () => {
  const notes = G.geminiFigureNotes({
    diagrams: [{
      title: 'Eritropoez basamaklari',
      description: 'Kok hucreden olgun eritrosite gecis evreleri',
      mermaid: 'graph TD; A[Proeritroblast] --> B[Basofilik Eritroblast]; B --> C{Retikulosit}'
    }]
  });
  assert.equal(notes[0], 'Eritropoez basamaklari', 'baslik ilk sirada kalmali');
  assert.ok(notes.some(function (n) { return n === 'Proeritroblast'; }),
    'mermaid dugum etiketi alinmiyor: ' + JSON.stringify(notes));
  assert.ok(notes.some(function (n) { return n === 'Basofilik Eritroblast'; }));
  assert.ok(notes.some(function (n) { return n === 'Retikulosit'; }), 'suslu parantezli dugum atlandi');
  assert.ok(notes.some(function (n) { return /olgun eritrosite/.test(n); }), 'aciklama alinmiyor');
});

test('geminiFigureNotes: formul DEGISKENLERI toplanir', () => {
  const notes = G.geminiFigureNotes({
    formulas: [{
      name: 'Bagil viskozite',
      latex: 'n_2 = n_1 (t_2/t_1)',
      variables: [{ symbol: 'n_1', meaning: 'Saf suyun viskozitesi' }]
    }]
  });
  assert.ok(/Bagil viskozite: /.test(notes[0]), 'formul adi+latex ilk sirada kalmali');
  assert.ok(notes.some(function (n) { return /n_1: Saf suyun viskozitesi/.test(n); }),
    'degisken anlami alinmiyor: ' + JSON.stringify(notes));
});

test('geminiFigureNotes: govde malzemesi SONA ekleniyor', () => {
  /* Review prompt'u ilk 20 notu aliyor. Hacimli hucre/etiket malzemesi
     basa gecerse review'un gordugu ozet bulgular disari itilir. */
  const notes = G.geminiFigureNotes({
    visual_findings: ['Tabloda sodyum 145 mM olarak okundu'],
    tables: [{ title: 'T', headers: ['a'], rows: [['hucre degeri']] }],
    diagrams: [{ title: 'D', mermaid: 'graph TD; X[dugum etiketi]' }]
  });
  assert.ok(/sodyum 145/.test(notes[0]), 'visual_findings basta degil');
  const hucreI = notes.findIndex(function (n) { return /hucre degeri/.test(n); });
  const ozetI = notes.findIndex(function (n) { return /^T \(a\)$/.test(n); });
  assert.ok(ozetI > -1 && hucreI > ozetI, 'hucre satiri ozet satirindan once gelmis');
});

test('geminiFigureNotes: cop girdi bos dizi dondurur, patlamaz', () => {
  assert.deepEqual(G.geminiFigureNotes(null), []);
  assert.deepEqual(G.geminiFigureNotes({}), []);
  assert.deepEqual(G.geminiFigureNotes({ formulas: 'dizi degil' }), []);
});

// ===========================================================================
// callGeminiOnce — istek govdesi ve hata yolu
// ===========================================================================
test('callGeminiOnce: istek govdesi ve basliklar dogru', async () => {
  stubFetch([{ status: 200, json: OK_JSON }]);
  try {
    const res = await G.callGeminiOnce('ANAHTAR', 'gemini-test', 'SISTEM', 'QkFTRTY0', 'application/pdf', 'KULLANICI', 5000, []);
    assert.equal(res.ok, true);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, G.GEMINI_ENDPOINT);
    assert.equal(fetchCalls[0].headers['x-goog-api-key'], 'ANAHTAR');
    const body = fetchCalls[0].body;
    assert.equal(body.model, 'gemini-test');
    assert.equal(body.system_instruction, 'SISTEM');
    assert.equal(body.input[0].type, 'document');
    assert.equal(body.input[0].mime_type, 'application/pdf');
    assert.equal(body.input[0].data, 'QkFTRTY0');
    assert.equal(body.input[1].text, 'KULLANICI');
    assert.equal(body.generation_config.max_output_tokens, G.GEMINI_MAX_OUTPUT_TOKENS);
    assert.equal(body.response_format.mime_type, 'application/json');
    assert.equal('thinking_level' in body, false, 'thinking_level bu yuzeyde 400 donduruyor');
    assert.equal('thinking_summaries' in body, false);
  } finally { restoreFetch(); }
});

test('callGeminiOnce: dusurulen alanlar govdeye konmaz', async () => {
  stubFetch([{ status: 200, json: OK_JSON }]);
  try {
    await G.callGeminiOnce('K', 'm', 's', 'b', 'application/pdf', 'u', 5000,
      ['response_format', 'generation_config']);
    assert.equal('response_format' in fetchCalls[0].body, false);
    assert.equal('generation_config' in fetchCalls[0].body, false);
    // Dusurulemeyecekler yerinde durmali.
    assert.equal(fetchCalls[0].body.system_instruction, 's');
    assert.ok(Array.isArray(fetchCalls[0].body.input));
  } finally { restoreFetch(); }
});

test('callGeminiOnce: cikis tavani olculen en buyuk ciktiyi RAHAT tasiyor', () => {
  // 10.10.2026: 46.084 karakterlik JSON ~14.000 token tutuyor. 16.384
  // tavanla iki kosuda da model tavana carpti ve JSON yarim dondu
  // ("status=incomplete"), her biri ~88 saniye ve gunluk 20 istekten
  // birini yakarak. Tavan o olcumun en az iki kati olmali.
  assert.ok(G.GEMINI_MAX_OUTPUT_TOKENS >= 28_000,
    `tavan ${G.GEMINI_MAX_OUTPUT_TOKENS} — olculen 14.000 token'lik ciktiya pay birakmiyor`);
});

test('callGeminiOnce: ok olmayan cevap status ve govdeyle doner', async () => {
  stubFetch([{ status: 429, text: 'quota exceeded' }]);
  try {
    const res = await G.callGeminiOnce('K', 'm', 's', 'b', 'application/pdf', 'u', 5000, []);
    assert.equal(res.ok, false);
    assert.equal(res.status, 429);
    assert.match(res.body, /quota/);
  } finally { restoreFetch(); }
});

test('callGeminiOnce: ag hatasi status 0 olarak doner, atmaz', async () => {
  stubFetch([{ throw: new Error('ECONNRESET') }]);
  try {
    const res = await G.callGeminiOnce('K', 'm', 's', 'b', 'application/pdf', 'u', 5000, []);
    assert.equal(res.ok, false);
    assert.equal(res.status, 0);
    assert.match(res.body, /ECONNRESET/);
  } finally { restoreFetch(); }
});

test('callGeminiOnce: zaman asimi abort olarak raporlanir', async () => {
  const err = new Error('aborted'); err.name = 'AbortError';
  stubFetch([{ throw: err }]);
  try {
    const res = await G.callGeminiOnce('K', 'm', 's', 'b', 'application/pdf', 'u', 5000, []);
    assert.equal(res.ok, false);
    assert.match(res.body, /zaman asimi/);
  } finally { restoreFetch(); }
});

// ===========================================================================
// geminiDraft — asil sozlesme: basarisizlikta HER ZAMAN null
// ===========================================================================
test('geminiDraft: basarili kosuda taslak, model ve sure doner', async () => {
  stubFetch([{ status: 200, json: OK_JSON }]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out, 'taslak gelmeliydi');
    assert.equal(out.raw, '{"summary":"x"}');
    assert.equal(out.model, G.GEMINI_MODEL_CANDIDATES[0]);
    assert.equal(typeof out.ms, 'number');
    assert.equal(fetchCalls.length, 1, 'basarili kosuda tek cagri yeter');
  } finally { restoreFetch(); }
});

test('geminiDraft: dosya base64 olarak gonderilir', async () => {
  stubFetch([{ status: 200, json: OK_JSON }]);
  try {
    await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.equal(fetchCalls[0].body.input[0].data, G.bytesToBase64(BYTES));
  } finally { restoreFetch(); }
});

test('geminiDraft: butce yetmezse hic cagri yapilmaz', async () => {
  stubFetch([]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 30_000));
    assert.equal(out, null);
    assert.equal(fetchCalls.length, 0, 'yarim kalacak bir cagri hic baslamamali');
  } finally { restoreFetch(); }
});

test('geminiDraft: 404 alan model atlanir, sonraki aday denenir', async () => {
  stubFetch([
    { status: 404, text: 'model not found' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out);
    assert.equal(out.model, G.GEMINI_MODEL_CANDIDATES[1]);
    assert.equal(fetchCalls.length, 2);
  } finally { restoreFetch(); }
});

test('geminiDraft: response_format reddedilirse JSON modu kapatilip tekrar denenir', async () => {
  stubFetch([
    { status: 400, text: 'Unknown name "response_format"' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out);
    assert.equal(fetchCalls.length, 2);
    assert.equal('response_format' in fetchCalls[0].body, true);
    assert.equal('response_format' in fetchCalls[1].body, false, 'ikinci denemede alan dusmeliydi');
    assert.equal(fetchCalls[1].body.model, G.GEMINI_MODEL_CANDIDATES[0], 'ayni model tekrar denenmeli');
  } finally { restoreFetch(); }
});

test('geminiDraft: taninmayan alan atilip AYNI model tekrar denenir', async () => {
  // 09.10.2026 canli kosusunun birebir senaryosu.
  stubFetch([
    { status: 400, text: '{"error":{"message":"Unknown parameter \'generation_config\'."}}' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out, 'alan atildiktan sonra taslak gelmeliydi');
    assert.equal(out.model, G.GEMINI_MODEL_CANDIDATES[0], 'ayni model tekrar denenmeli');
    assert.equal(fetchCalls.length, 2);
    assert.equal('generation_config' in fetchCalls[0].body, true);
    assert.equal('generation_config' in fetchCalls[1].body, false);
  } finally { restoreFetch(); }
});

test('geminiDraft: atilan alan sonraki modellere de TASINIR', async () => {
  // Tasinmazsa ayni hata her modelde tekrar yenir ve gunluk kotadan
  // (100 istek) bosuna istek gider.
  stubFetch([
    { status: 400, text: "Unknown parameter 'generation_config'" },
    { status: 404, text: 'model not found' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out);
    assert.equal(out.model, G.GEMINI_MODEL_CANDIDATES[1]);
    assert.equal(fetchCalls.length, 3);
    assert.equal('generation_config' in fetchCalls[2].body, false,
      'ikinci modele giden istek alani yine tasimis');
  } finally { restoreFetch(); }
});

test('geminiDraft: ayni alan iki kez atilmaya calisilmaz (sonsuz dongu yok)', async () => {
  stubFetch(G.GEMINI_MODEL_CANDIDATES.flatMap(() => [
    { status: 400, text: "Unknown parameter 'generation_config'" },
    { status: 400, text: "Unknown parameter 'generation_config'" }
  ]));
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.equal(out, null);
    // Ilk modelde 2 cagri (biri atma denemesi), sonrakilerde 1'er.
    assert.equal(fetchCalls.length, G.GEMINI_MODEL_CANDIDATES.length + 1);
  } finally { restoreFetch(); }
});

/* 25.10.2026 — 503 ALAN MODEL ARTIK SIRANIN SONUNDA TEKRAR DENENIYOR.
 *
 * 09.10 vakasi (ilk deneme 503, ikincisi tuttu) hala korunuyor: 503 alan
 * model ikinci sansini aliyor. Degisen SIRASI: once el degmemis adaylar.
 * Eski hali (2,5 sn sonra ayni model) dort aday x iki deneme = 8 istekle
 * 6'lik tavana carpip dorduncu adayi hic denemiyordu. */
test('geminiDraft: TEK 503 sonrasi ONCE diger aday denenir', async () => {
  stubFetch([
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out, '503 sonrasi ikinci aday denenmedi');
    assert.equal(fetchCalls.length, 2);
    assert.equal(out.model, G.GEMINI_MODEL_CANDIDATES[1], 'yogun model 2,5 sn sonra yine denenmis');
  } finally { restoreFetch(); }
});

test('geminiDraft: 503 veren model SIRANIN SONUNDA ikinci sansini alir ve tutar', async () => {
  // Diger adaylar yoksa (404) 503 veren model yine denenir — 09.10 vakasi.
  stubFetch([
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 404, text: 'model not found' },
    { status: 404, text: 'model not found' },
    { status: 404, text: 'model not found' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out, '503 veren model ikinci kez denenmedi');
    assert.equal(out.model, G.GEMINI_MODEL_CANDIDATES[0]);
    assert.equal(fetchCalls.length, 5);
    assert.equal(fetchCalls[4].body.model, G.GEMINI_MODEL_CANDIDATES[0]);
  } finally { restoreFetch(); }
});

test('geminiDraft: 503 veren model en fazla IKI kez denenir (sonsuz kuyruk yok)', async () => {
  stubFetch([
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 404, text: 'model not found' },
    { status: 404, text: 'model not found' },
    { status: 404, text: 'model not found' },
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 200, json: OK_JSON }
  ]);
  const tani = {};
  try {
    const out = await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only', tani));
    assert.equal(out, null);
    assert.equal(fetchCalls.length, 5, `${fetchCalls.length} istek — ucuncu 503 denemesi yapilmis`);
    assert.equal(tani.geciciDustu, true);
  } finally { restoreFetch(); }
});

/* 21.10.2026 — BU TESTIN IDDIASI YINE DEGISTI, bir adim GERI.
 *
 * 20.10'da sayac denemeleri sayacak hale getirildi: alti 503'un alti da
 * bosa gidiyordu, 48 saniye ve gunluk kotanin %30'u yaniyordu. Dogru
 * teshisti ama fazla genis bir sonuc cikardi — tek modele iki kez deneyip
 * iki 503 almak "yuzeyin tamami yogun" sayildi.
 *
 * 21.10 kosusu bedelini gosterdi: iki 503 IKISI DE gemini-3.7-flash'tan
 * geldi, Gemini tamamen birakildi, geriye 130 SANIYE butce vardi. Kart
 * Groq yolundan cikti ve sayisal kapsama %77'den %56'ya dustu. 503'un
 * govdesi modeli adiyla soyluyor ("gemini-3.7-flash is currently
 * experiencing high demand"), yani tek modelin yogunlugu yuzeyin
 * yogunlugu degil.
 *
 * Simdi "yuzey yogun" sonucu AYRI modellerden hata gelmesini istiyor.
 * Bedeli iki degil UC istek; 20.10'un korktugu alti istege hala uzak. */
test('geminiDraft: tek model 503 verirse SONRAKI ADAY denenir', async () => {
  stubFetch([
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out, 'ikinci aday model denenmedi — 130 saniye butce varken Groq yoluna dusuldu');
    assert.equal(fetchCalls.length, 3, `${fetchCalls.length} istek — ucuncu istek ikinci aday olmali`);
  } finally { restoreFetch(); }
});

/* 25.10.2026 — IKI AYRI MODEL "YUZEY YOGUN" DEMEYE YETMIYOR.
 *
 * Kosu 37: 3.8 olu akis verdi, 3.7'ye hic sira gelmedi ve kart Groq'tan
 * %67 kapsamayla cikti. O gun 3.8 0/4, 3.7 503 almadigi her denemede gercek
 * akis verdi — model guvenilirligi modele gore degisiyor. Hedef: Groq
 * YALNIZCA butun Gemini modelleri erisilemezken. */
test('geminiDraft: IKI AYRI modelde 503 artik DURDURMUYOR — ucuncu aday denenir', async () => {
  stubFetch([
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 503, text: 'gemini-3.8-flash is currently experiencing high demand' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out, 'iki model yogunken ucuncu aday denenmedi — kart gereksiz yere Groq a dustu');
    assert.equal(out.model, G.GEMINI_MODEL_CANDIDATES[2]);
  } finally { restoreFetch(); }
});

test('geminiDraft: HER adayda gecici hata alinirsa durulur', async () => {
  // Butun modeller yogunsa ikinci tur ayni duvara carpmak — Groq'un gercek isi bu.
  stubFetch([
    ...G.GEMINI_MODEL_CANDIDATES.map(m => ({ status: 503, text: `${m} is currently experiencing high demand` })),
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.equal(out, null, 'butun modeller yogunken Groq yoluna dusulmeliydi');
    assert.equal(fetchCalls.length, G.GEMINI_MODEL_CANDIDATES.length,
      `${fetchCalls.length} istek — her aday bir kez yeterli`);
  } finally { restoreFetch(); }
});

/* 21.10.2026 — ZAYIF YEDEK KART KALICILASIYORDU.
 *
 * Ilk kez gozlenen cache isabeti:
 *
 *   CACHE ISABETI [DOSYA]: 231eb9e17d522b74e1… — 1929ms, model cagrisi yok
 *
 * 1,9 saniye, harika. Ama donen kart bir onceki kosunun GROQ YEDEK karti:
 * Gemini iki 503 almis, Groq devralmis, kart TAM oldugu icin (eksik pencere
 * yok, Gemini kismi degil) onbellege girmis. Olculen fark, ayni deste:
 *
 *   Gemini yolu : kapsama %72-77, citation anchoring kept=30 / kept=15
 *   Groq yedegi : kapsama %56,   citation anchoring kept=0
 *
 * Yani yuzeyin bir dakikalik yogunlugu, o dosya icin KALICI kalite kaybina
 * dondu ve Gemini'nin bir daha denenmesi imkansiz hale geldi. Ilk iki kosul
 * "kart tam mi" diye soruyor; eksik olan "kart ISTENEN kart mi". */
/* 24.10.2026 — OLU AKIS GECICI SAYILMIYORDU VE ZAYIF KART KALICILASIYORDU.
 *
 * Canli olcum: yuzey istegi kabul etti, 15,4 sn'de baslik gonderdi, sonra
 * 87 saniye boyunca TEK OLAY uretmedi ve cagri `status: 0` ile dustu
 * ("ilk olay gelmedi"). Siniflandirma yalnizca 503/500'u gecici saydigi
 * icin geciciModeller bos kaldi, cik() bayragi koymadi ve o kosunun zayif
 * Groq karti (kapsama %49, yazar ve review atlanmis) onbellege KALICI
 * yazildi. Sonraki yuklemeler 1,9 saniyede o karti aldi. */
test('OLU AKIS gecici sayiliyor — zayif kart kalicilasmaz', async () => {
  // status 0 + "ilk olay gelmedi": yuzey kabul etti, hicbir sey uretmedi.
  stubFetch([
    { status: 0, text: 'ilk olay gelmedi (72000ms, baglanti acik ama veri yok)' },
    { status: 0, text: 'ilk olay gelmedi (72000ms, baglanti acik ama veri yok)' }
  ]);
  const tani = {};
  try {
    const out = await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only', tani));
    assert.equal(out, null, 'olu akista Groq yoluna dusulmeliydi');
    assert.equal(tani.geciciDustu, true,
      'olu akis gecici sayilmiyor — zayif Groq karti onbellege kalici yazilir');
  } finally { restoreFetch(); }
});

test('OLU AKIS ayni modelde TEKRAR denenmiyor', async () => {
  /* Olu akis 87 saniye yakti; ikinci deneme butceyi bitirir. 503'ten farki
     bu: 503 hizli doner, tekrar denemek ucuzdur. */
  stubFetch([
    { status: 0, text: 'ilk olay gelmedi (72000ms, baglanti acik ama veri yok)' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out, 'sonraki aday denenmeliydi');
    assert.equal(out.model, G.GEMINI_MODEL_CANDIDATES[1],
      `ayni model tekrar denenmis: ${out.model}`);
    assert.equal(fetchCalls.length, 2, `${fetchCalls.length} istek — olu akis tekrar denenmis`);
  } finally { restoreFetch(); }
});

test('503 veren model SIRANIN SONUNDA bir kez daha deneniyor (regresyon)', () => {
  /* Olu akis ayrimi 503'un ikinci sansini yok etmemeli; 25.10.2026'dan beri
     ikinci sans 2,5 sn sonra degil, diger adaylardan SONRA. */
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  assert.ok(/if \(!oluAkis && bu503 < 2\) return \{ tur: 'sonra' \}/.test(src),
    '503 icin ikinci sans kaybolmus');
  assert.ok(/tur === 'sonra' && !sonaAlinan\.has\(m\)/.test(src), 'sona alma bir kezle sinirli degil');
  assert.ok(/const oluAkis = res\.status === 0/.test(src), 'olu akis ayrimi yok');
});

/* 25.10.2026 — GECIKMELI YEDEK MODEL (kosu 37 dersi).
 *
 * 3.8 istegi kabul etti, 72 sn tek olay gelmedi; olu akis 87. saniyede
 * anlasildi ve 3.7'ye 15 sn kaldi — hic denenmedi, kart Groq'tan cikti.
 * Artik ilk model GEMINI_YEDEK_GECIKME_MS icinde olay getirmezse siradaki
 * aday paralel baslar; ilk olayi getiren kazanir. */
test('YEDEK: sessiz ilk model beklenirken ikinci aday baslar ve kazanir', async () => {
  denoEnv.set('GEMINI_YEDEK_GECIKME_MS', '20');
  stubFetch([
    { status: 200, hang: true },       // 3.7: baglanti acik, olay yok (olu akis)
    { status: 200, json: OK_JSON }     // 3.8: gercek akis
  ]);
  try {
    const out = await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only'));
    assert.ok(out, 'yedek model baslamadi — olu akis butun Gemini butcesini yerdi');
    assert.equal(out.model, G.GEMINI_MODEL_CANDIDATES[1]);
    assert.equal(fetchCalls.length, 2, `${fetchCalls.length} istek`);
  } finally { restoreFetch(); denoEnv.delete('GEMINI_YEDEK_GECIKME_MS'); }
});

test('YEDEK: hizli cevap veren modelde yedek HIC baslamaz (RPD korunur)', async () => {
  denoEnv.set('GEMINI_YEDEK_GECIKME_MS', '20');
  stubFetch([{ status: 200, json: OK_JSON }, { status: 200, json: OK_JSON }]);
  try {
    const out = await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only'));
    assert.ok(out);
    assert.equal(fetchCalls.length, 1, 'hizli modelde yedek baslatilmis — her kosu +1 RPD');
  } finally { restoreFetch(); denoEnv.delete('GEMINI_YEDEK_GECIKME_MS'); }
});

test('YEDEK: yedek de 503 verirse siradaki aday yedek olur', async () => {
  denoEnv.set('GEMINI_YEDEK_GECIKME_MS', '20');
  stubFetch([
    { status: 200, hang: true },
    { status: 503, text: 'gemini-3.8-flash is currently experiencing high demand' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only'));
    assert.ok(out, 'ikinci yedek baslatilmadi');
    assert.equal(out.model, G.GEMINI_MODEL_CANDIDATES[2]);
    assert.equal(fetchCalls.length, 3);
  } finally { restoreFetch(); denoEnv.delete('GEMINI_YEDEK_GECIKME_MS'); }
});

/* 28.10.2026 — YEDEK GECIKMESI ILK ISTEKTEN SAYILIYORDU (19:52 kosusu dersi).
 *
 * Esik `ilk.startedAt`e bakinca ilk gecikme dolduktan sonra kalici olarak
 * dogru kaliyor ve dusen her yarisci yerine GEMINI_RETRY_WAIT_MS sonra
 * yenisi giriyordu. Canlida: 3.5 olu akis, 3.6 35,2 sn, 3.7 +5 sn, 3.8
 * +2 sn — dort istek yedi saniyeye sigdi, ucu de 503. Olculen saglikli
 * akisin ilk olayi 25,6 sn de geldigi icin her yedegin KENDI penceresi
 * olmali; yoksa yedek stratejisi RPD yi bosa yakmaktan ibaret kaliyor. */
test('YEDEK: her yedek kendi gecikmesini bekler (dusen yerine aninda yenisi girmez)', async () => {
  denoEnv.set('GEMINI_YEDEK_GECIKME_MS', '400');
  stubFetch([
    { status: 200, hang: true },                                                    // 3.5: olu akis, acik kalir
    { status: 503, text: 'gemini-3.6-flash is currently experiencing high demand' }, // 3.6: aninda duser
    { status: 200, json: OK_JSON }                                                  // 3.7: gercek akis
  ]);
  try {
    const out = await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only'));
    assert.ok(out, 'ucuncu aday hic baslatilmadi');
    assert.equal(fetchCalls.length, 3, `${fetchCalls.length} istek`);
    const aralik = fetchCalls[2].at - fetchCalls[1].at;
    assert.ok(aralik >= 350,
      `3. istek 2.'den yalnizca ${aralik}ms sonra basladi — yedek gecikmesi ilk ` +
      'istekten sayiliyor, dusen yarisci yerine aninda yenisi giriyor (RPD bosa yanar)');
  } finally { restoreFetch(); denoEnv.delete('GEMINI_YEDEK_GECIKME_MS'); }
});

test('YEDEK: kurallar kaynakta — yalnizca only, akissiz yolda yok, toplam tavanda kesilir', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  assert.ok(/const yedekGecikme = mode === 'only' \? geminiYedekGecikmeMs\(\) : -1/.test(src),
    'yedek shadow modunda da calisiyor — Gemini birincil degilken RPD yakar');
  assert.ok(/yedekGecikme < 0 \|\| dropped\.indexOf\('stream'\) !== -1/.test(src),
    'akissiz yolda olay hic gelmez; yedek her kosuda baslar');
  // Yedegin tavani devam tavanina uzanir ama olaysiz yarisci toplam tavanda kesilir.
  assert.ok(/const yedekMs = Math\.min\(callMs, geminiDevamTavan - gecen\)/.test(src));
  assert.ok(/gecen >= geminiToplamTavan && !tavanKesti/.test(src),
    'olay getirmeyen yedek Groq un payini yiyebilir');
  // Kazanan once islenir; kesilen kaybeden hic islenmez.
  assert.ok(/return \[kayit\(olayli\), \.\.\.dusen\]/.test(src));
  assert.ok(/toplamIstek < GEMINI_MAX_REQUESTS_PER_RUN &&\s*geminiToplamTavan - gecen >= GEMINI_YEDEK_MIN_KALAN_MS/.test(src),
    'yedek istek tavanina ya da kalan sureye bakmiyor');
  // 28.10.2026 — gecikme SON istekten sayilir, ilk yarisciningkinden degil.
  assert.ok(/Date\.now\(\) - sonIstekAni >= yedekGecikme &&/.test(src),
    'gecikme ilk istekten sayiliyor — dusen yarisci yerine aninda yenisi baslar, RPD yanar');
});

test('YEDEK: gecikme olculen hizli ilk olaylarin ustunde, ikinci modele yer birakiyor', () => {
  // Bant kucultulduktan sonra olculen ilk olaylar: 17,5 / 26,1 / 29,9 sn.
  assert.ok(G.GEMINI_YEDEK_GECIKME_MS_VARSAYILAN > 29_900,
    'hizli cevap veren modelde de yedek baslar — her kosu +1 RPD');
  // Yedek bu anda baslarsa ~72 sn'lik bir uretim devam tavanina sigmali.
  assert.ok(G.GEMINI_YEDEK_GECIKME_MS_VARSAYILAN + 72_000 <= G.GEMINI_ONLY_MAX_CALL_MS + G.GEMINI_DEVAM_PAYI_MS,
    'yedek basladiginda tam bir uretime yer kalmiyor');
  denoEnv.set('GEMINI_YEDEK_GECIKME_MS', 'kapali');
  assert.equal(G.geminiYedekGecikmeMs(), -1);
  denoEnv.delete('GEMINI_YEDEK_GECIKME_MS');
  assert.equal(G.geminiYedekGecikmeMs(), G.GEMINI_YEDEK_GECIKME_MS_VARSAYILAN);
});

test('gecici hatayla dusuldugunde tani cagirana BILDIRILIYOR', async () => {
  stubFetch([
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 503, text: 'gemini-3.8-flash is currently experiencing high demand' }
  ]);
  const tani = {};
  try {
    const out = await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only', tani));
    assert.equal(out, null, 'gecici hatalarda Groq yoluna dusulmeliydi');
    assert.equal(tani.geciciDustu, true,
      'gecici dusus bildirilmiyor — zayif yedek kart yine onbellege girer');
  } finally { restoreFetch(); }
});

test('esik dolmadan liste tukenirse de gecici dusus bildiriliyor', async () => {
  /* Bir model 503, digerleri "boyle model yok": esik (AYRI iki model)
     dolmuyor ama tasiyici sebep hala gecici. */
  stubFetch([
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 404, text: 'models/gemini-3.8-flash is not found' },
    { status: 404, text: 'models/gemini-3.5-flash is not found' },
    { status: 404, text: 'models/gemini-3.6-flash is not found' }
  ]);
  const tani = {};
  try {
    await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only', tani));
    assert.equal(tani.geciciDustu, true, 'gecici hata gormus kosu temiz sayiliyor');
  } finally { restoreFetch(); }
});

/* 27.10.2026 — DEVRE KESICININ TETIGI. Devre yalnizca BUTUN adaylar kota ya
   da gecici hata verdiginde acilir (bkz. GEMINI_DEVRE_MS). Tek modelin
   dusmesi Gemini'nin dusmesi degil: yedek model ve aday kuyrugu var. */
test('hepsiDustu: BUTUN adaylar 503 verince konur', async () => {
  stubFetch(G.GEMINI_MODEL_CANDIDATES.map(m =>
    ({ status: 503, text: `${m} is currently experiencing high demand` })));
  const tani = {};
  try {
    const out = await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only', tani));
    assert.equal(out, null);
    assert.equal(tani.geciciDustu, true);
    assert.equal(tani.hepsiDustu, true, 'butun modeller dustu ama devre tetigi konmadi');
  } finally { restoreFetch(); }
});

test('hepsiDustu: kota + 503 karisik ama HEPSI dustuyse yine konur', async () => {
  const [a, b, c, d] = G.GEMINI_MODEL_CANDIDATES;
  stubFetch([
    { status: 429, text: `Quota exceeded for metric generate_requests_per_day, model: ${a}` },
    { status: 503, text: `${b} is currently experiencing high demand` },
    { status: 429, text: `Quota exceeded for metric generate_requests_per_day, model: ${c}` },
    { status: 503, text: `${d} is currently experiencing high demand` }
  ]);
  const tani = {};
  try {
    await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only', tani));
    assert.equal(tani.hepsiDustu, true);
  } finally { restoreFetch(); }
});

test('hepsiDustu: TEK modelin gecici hatasi devreyi tetiklemez', async () => {
  // 3.7 yogun, digerleri "boyle model yok": gecici dusus var ama butun
  // modeller gecici hatada degil — devre acilmamali.
  stubFetch([
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 404, text: 'model not found' },
    { status: 404, text: 'model not found' },
    { status: 404, text: 'model not found' },
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' }
  ]);
  const tani = {};
  try {
    await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only', tani));
    assert.equal(tani.geciciDustu, true, 'kart yine kalici yazilmamali');
    assert.ok(!tani.hepsiDustu, 'tek modelin 503u devreyi 5 dk aciyor');
  } finally { restoreFetch(); }
});

test('kota429: GUNLUK OLMAYAN 429 da devre tetigini koyuyor', async () => {
  /* Google'in govdesi RPM ile RPD'yi ayirt etmiyor: "Your project has
     exceeded a quota" ikisinde de ayni (bkz. geminiQuotaExhausted). Eski
     kod bu metni dakikalik sayip `geciciModeller`'e DOKUNMUYORDU, yani
     devre kesicinin tetigi (hepsiDustu) kota bittigi gun hic dolmuyordu.
     Olculen kosu (27.10, 18:40): 3.7 olu akis, 3.5/3.6 bu 429, 3.8 503 —
     devre acilmadi ve her yukleme 87 saniyeyi yeniden yakti.

     Iki cevap: dal butceye yer varsa BIR kez tekrar deniyor. */
  const kota = { status: 429, text: 'Your project has exceeded a quota. See https://ai.dev/rate-limit' };
  stubFetch([kota, kota]);
  const tani = {};
  try {
    const out = await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only', tani));
    assert.equal(out, null);
    assert.equal(tani.kota429, true, 'kota bayragi konmadi — devre kesici acilmaz');
    assert.equal(tani.geciciDustu, true, 'kota kartı kalici yazilmamali: yarin Gemini calisabilir');
  } finally { restoreFetch(); }
});

test('kota429: BASARILI kosuda konmuyor', async () => {
  // Yoksa bir model 429 verip oteki karti getirdiginde devre bosuna acilir.
  stubFetch([{ status: 200, json: OK_JSON }]);
  const tani = {};
  try {
    await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only', tani));
    assert.ok(!tani.kota429, 'kart geldigi halde kota bayragi konmus');
  } finally { restoreFetch(); }
});

test('BASARILI kosuda gecici dusus BILDIRILMIYOR', async () => {
  // Yoksa her kart onbellek disi kalir ve cache hic calismaz.
  stubFetch([{ status: 200, json: OK_JSON }]);
  const tani = {};
  try {
    const out = await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only', tani));
    assert.ok(out, 'taslak gelmeliydi');
    assert.ok(!tani.geciciDustu, 'basarili kosu gecici dusmus sayilmis — cache hic yazilmaz');
  } finally { restoreFetch(); }
});

/* 24.10.2026 — BU TEST KOSULLARIN VARLIGINI OLCUYORDU, MANTIGINI DEGIL.
 *
 * Eski hali `satir.includes('geminiKismiKrk === 0')` gibi dizge aramalari
 * yapiyordu. Yani `&&` -> `||` yazilsa, bir `!` dusse ya da kapi baska bir
 * dalin icine tasinsa test YESIL kalir ve kismi/zayif kart kalici olarak
 * onbellege girerdi. Karar artik saf bir fonksiyonda (onbellegeYazilabilir)
 * ve 16 kombinasyonun tamami sinaniyor. */
/* 24.10.2026 — SEMA SAPMASI BIRLESMEYI COKERTIYORDU VE BELGE ASKIDA KALIYORDU.
 *
 * Model (ozellikle gpt-oss-20b, ki pencere 2 sistematik olarak oraya dusuyor)
 * `key_points`'i bazen [{point: "..."}] olarak donduruyor. Iki dedupeByText
 * cagrisi kimlik fonksiyonu geciyordu ve normalizeForDedup dizge bekledigi
 * icin TypeError atiyordu — olculdu:
 *   normalizeForDedup({text:'...'}) -> (s || "").toLowerCase is not a function
 * Ustune en dis catch markFailed CAGIRMIYORDU, yani belge sonsuza kadar
 * 'processing' kaliyor ve ogrenci bekliyordu. */
test('maddeMetni SEKILDEN bagimsiz okuyor', () => {
  assert.equal(G.maddeMetni('Issizlik artti'), 'Issizlik artti');
  assert.equal(G.maddeMetni({ text: 'Issizlik artti' }), 'Issizlik artti');
  assert.equal(G.maddeMetni({ point: 'Issizlik artti' }), 'Issizlik artti');
  assert.equal(G.maddeMetni(null), '');
  assert.equal(G.maddeMetni({}), '');
});

test('birlesme NESNE maddelerde COKMUYOR', () => {
  /* Asil kusur bir istisnaydi; bu yuzden "patlamiyor" iddiasini aciktan
     yaziyorum. Kimlik fonksiyonu geri gelirse bu test duser. */
  assert.doesNotThrow(() => G.dedupeByText([{ point: 'a' }, { point: 'b' }], G.maddeMetni));
  assert.equal(G.dedupeByText([{ point: 'a' }, { point: 'b' }, { point: 'a' }], G.maddeMetni).length, 2);
  assert.equal(G.dedupeByText(['a', { point: 'b' }, null], G.maddeMetni).length, 2,
    'karisik dizi de tolere edilmeli');
});

test('cagri yerleri kimlik fonksiyonu KULLANMIYOR', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  assert.ok(!/dedupeByText\([^)]*\(x: string\) => x\)/.test(src),
    'kimlik getter geri gelmis — nesne maddede TypeError atar');
  assert.equal((src.match(/dedupeByText\([^;]*maddeMetni\)/g) || []).length, 2,
    'iki key_points birlesmesinin ikisi de sekil-toleransli okuyucu kullanmali');
});

test('key_terms DIZGE dizisi olarak gelirse sozluk KAYBOLMUYOR', () => {
  /* Olculdu: dedupeKeyTerms(['Esneklik','GSYH']) -> 0 kayit. "Window 2 ok:
     terms=24" yaziliyor, birlesim o 24'u hic icermiyor, hicbir satir neden
     gittigini soylemiyordu. */
  const r = G.dedupeKeyTerms(['Esneklik', 'GSYH', 'Esneklik']);
  assert.equal(r.length, 2, 'dizge terimler hala sessizce dusuyor');
  assert.equal(r[0].term, 'Esneklik');
  assert.equal(r[0].definition, '', 'tanim alani bos dizge olmali');
  // Nesne yolu bozulmadi.
  assert.equal(G.dedupeKeyTerms([{ term: 'Esneklik', definition: 'tanim' }]).length, 1);
  // Gercekten atilan kayit hala atiliyor (ama artik loglaniyor).
  assert.equal(G.dedupeKeyTerms([{ definition: 'term alani yok' }]).length, 0);
});

test('beklenmeyen istisna belgeyi ASKIDA birakmiyor', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  const i = src.indexOf("console.error('Unexpected Edge Function exception: '");
  assert.ok(i > 0, 'en dis catch bulunamadi');
  const blok = src.slice(i, i + 600);
  assert.ok(/markFailed\(hataIcinClient, hataIcinDocumentId\)/.test(blok),
    'en dis catch belgeyi basarisiz isaretlemiyor — ogrenci sonsuza kadar bekler');
  // documentId'nin catch'e ulasabilmesi icin try DISINDA tutulmasi gerekiyor.
  assert.ok(/let hataIcinDocumentId: string \| null = null/.test(src),
    'documentId catch e tasinmiyor');
});

test('ATLANAN pencereler eksik kapsamaya sayiliyor', () => {
  /* Iki kisa devre (butce ve "enough extractions") kalan pencereleri hic
     cagirmiyor, ama dusenPencereler'e girmiyordu: "EKSIK BELGE" olcumu ve
     quality_meta.missing_windows bu kaybi hic gormuyordu. 12 pencereli bir
     belgede ucte ikisi karta girmeyebilir ve hicbir yerde yazmazdi. */
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  assert.ok(/const kalanlariAtla = \(sebep: string\)/.test(src), 'atlama muhasebesi yok');
  const i = src.indexOf('const kalanlariAtla =');
  const blok = src.slice(i, i + 420);
  assert.ok(/dusenPencereler\.push\(wi \+ 1\)/.test(blok),
    'atlanan pencereler dusenPencereler e yazilmiyor');
  /* Iki kisa devrenin IKISI de bu muhasebeden gecmeli: butce dar ve
     "yeterli cikarim". Tanim `kalanlariAtla = (` biciminde oldugu icin
     asagidaki desene uymuyor; sayilan sey yalnizca CAGRI yerleri. */
  assert.equal((src.match(/kalanlariAtla\(\s*\n?\s*`/g) || []).length, 3,
    'kisa devrelerden biri muhasebeye baglanmamis');
  assert.ok(/kalanlariAtla\(`Butce dar/.test(src), 'butce kisa devresi baglanmamis');
  assert.ok(/kalanlariAtla\(`Yeterli cikarim/.test(src), 'yeterli-cikarim kisa devresi baglanmamis');
  /* 27.10.2026: ucuncu kisa devre — bekleme kalan butceye sigmiyorsa pencere
     CAGRILMADAN atlaniyor. Olculen kosuda 58,3 sn'lik TokenPacer beklemesi
     51 sn'lik butceyi asti, nobetci belgeyi 'failed' yapti ve iki bitmis
     pencere bosa gitti. O da ayni muhasebeden gecmeli. */
  assert.ok(/kalanlariAtla\(\s*\n?\s*`Bekleme butceye sigmiyor/.test(src),
    'bekleme kisa devresi muhasebeye baglanmamis');
  assert.ok(!/console\.log\('Enough extractions — skipping remaining windows'\)/.test(src),
    'eski sessiz log hala duruyor');
});

test('onbellek kapisi: 16 kombinasyonun tamami', () => {
  const T = [true, false];
  let yazilan = 0;
  for (const anahtarVar of T) {
    for (const eksikPencereVar of T) {
      for (const kismi of T) {
        for (const geciciDustu of T) {
          const k = { anahtarVar, eksikPencereVar, geminiKismiKrk: kismi ? 2000 : 0, geciciDustu };
          const sonuc = G.onbellegeYazilabilir(k);
          const beklenen = anahtarVar && !eksikPencereVar && !kismi && !geciciDustu;
          assert.equal(sonuc, beklenen,
            `yanlis karar: ${JSON.stringify(k)} -> ${sonuc}, beklenen ${beklenen}`);
          if (sonuc) yazilan++;
        }
      }
    }
  }
  // 16 kombinasyondan YALNIZCA biri yazmali: dort kosulun hepsi lehte.
  assert.equal(yazilan, 1, `${yazilan} kombinasyon yaziyor — kapi gevsemis`);
});

test('onbellek kapisi: her kosul TEK BASINA engelliyor', () => {
  const temel = { anahtarVar: true, eksikPencereVar: false, geminiKismiKrk: 0, geciciDustu: false };
  assert.equal(G.onbellegeYazilabilir(temel), true, 'temel hal yazmali');
  const engeller = [
    ['anahtar yok', { anahtarVar: false }],
    ['eksik pencere', { eksikPencereVar: true }],
    ['kismi Gemini taslagi', { geminiKismiKrk: 1 }],
    ['gecici hatayla dusus', { geciciDustu: true }],
  ];
  for (const [ad, fark] of engeller) {
    assert.equal(G.onbellegeYazilabilir({ ...temel, ...fark }), false,
      `${ad} tek basina engellemiyor — zayif kart kalicilasir`);
  }
});

test('YENILE: yalnizca TAM yeniden-ozet eski satirin ustune yazar', () => {
  /* ignoreDuplicates: true iken yeniden ozetin yeni karti hic
     kalicilasmiyordu; sonraki normal ozet yine eski karti donduruyordu. */
  assert.equal(G.onbellekUzerineYaz('tam', true), true, 'tam yeniden-ozet eskiyi guncellemeli');
  assert.equal(G.onbellekUzerineYaz('kismi', true), false, 'kismi yeniden-ozet eski satiri ezmemeli');
  assert.equal(G.onbellekUzerineYaz('hayir', true), false);
  assert.equal(G.onbellekUzerineYaz('tam', false), false, 'normal kosu davranisi degismemeli');
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  assert.ok(src.includes('const uzerineYaz = onbellekUzerineYaz(kayitTuru, onbellegiAtla)'),
    'karar yazim yerine baglanmamis');
  assert.ok(src.includes("ignoreDuplicates: !uzerineYaz"), 'upsert karari kullanmiyor');
});

test('onbellek kapisi kaynakta SAF fonksiyondan cagriliyor', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  assert.ok(src.includes('const kayitTuru = onbellekKayitTuru({'),
    'kapi hala satir ici kosul zinciri — mantigi test edilemez');
  assert.ok(!src.includes('if (summaryCacheKey && !eksikPencereler'),
    'eski satir ici kapi hala duruyor');
  // Dort alanin dordu de gercekten baglanmis olmali.
  const i = src.indexOf('const kayitTuru = onbellekKayitTuru({');
  const blok = src.slice(i, i + 320);
  for (const alan of ['anahtarVar', 'eksikPencereVar', 'geminiKismiKrk', 'geciciDustu']) {
    assert.ok(blok.includes(alan), alan + ' kapiya baglanmamis: ' + blok.slice(0, 160));
  }
});

test('KAYIT TURU: 16 kombinasyonun tamami', () => {
  /* 25.10.2026. Eski kapi kismi karti HIC yazmiyordu; gerekcesi dogruydu
     ama sonucu ters dondu: ayni dosya her yuklemede 110 saniyeyi sifirdan
     odedi. Artik kismi kart ':k' ekli satira giriyor. Burada olculen sey
     'hayir' ile 'kismi' ayriminin KAYBOLMADIGI: anahtar yoksa yazacak yer
     de yok, geri kalan her halde en azindan kismi satir yazilmali. */
  const T = [true, false];
  const sayac = { tam: 0, kismi: 0, hayir: 0 };
  for (const anahtarVar of T) {
    for (const eksikPencereVar of T) {
      for (const kismi of T) {
        for (const geciciDustu of T) {
          const k = { anahtarVar, eksikPencereVar, geminiKismiKrk: kismi ? 2000 : 0, geciciDustu };
          const sonuc = G.onbellekKayitTuru(k);
          const beklenen = !anahtarVar
            ? 'hayir'
            : (!eksikPencereVar && !kismi && !geciciDustu) ? 'tam' : 'kismi';
          assert.equal(sonuc, beklenen,
            'yanlis karar: ' + JSON.stringify(k) + ' -> ' + sonuc + ', beklenen ' + beklenen);
          sayac[sonuc]++;
        }
      }
    }
  }
  assert.equal(sayac.tam, 1, sayac.tam + ' kombinasyon TAM yaziyor — kapi gevsemis');
  assert.equal(sayac.hayir, 8, 'anahtarsiz haller yazmamali');
  assert.equal(sayac.kismi, 7, 'kismi satira dusen haller eksik');
});

test('kismiKayitSebebi: icerik boslugu ile Gemini yoklugunu ayiriyor', () => {
  /* Satir her iki durumda da ':k' ile yaziliyor (onbellek davranisi ayni);
     ayrilan sey ogrenciye ne denildigi — bkz. acadex-ink.js kismiSebep. */
  const F = G.kismiKayitSebebi;
  assert.equal(F({ eksikPencereVar: true, geminiKismiKrk: 0 }), 'eksik', 'dusen pencere gercek bosluktur');
  assert.equal(F({ eksikPencereVar: false, geminiKismiKrk: 2000 }), 'eksik', 'yarim kurtarilan taslak da bosluktur');
  assert.equal(F({ eksikPencereVar: true, geminiKismiKrk: 2000 }), 'eksik', 'ikisi birdeyse yine eksik');
  /* Olculen kart (27.10, 20:46): 3/3 pencere, Gemini hic denenmedi
     (devre kesici acik) — kartta eksik YOK, satir yalnizca gecici. */
  assert.equal(F({ eksikPencereVar: false, geminiKismiKrk: 0 }), 'gecici',
    'tam kart "eksik" sayilirsa ogrenciye ozetin yarim oldugu soylenir');
});

test('KISMI satir AYRI anahtara ve isaretli yaziliyor', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  assert.ok(src.includes("const CACHE_KISMI_EKI = ':k'"), 'kismi eki yok');
  assert.ok(src.includes("cache_key: (k as string) + (kismiKayit ? CACHE_KISMI_EKI : '')"),
    'kismi kart TAM satirin anahtarina yaziliyor — tam kartin yerini alir');
  assert.ok(src.includes('cache_kismi: kismiKayitSebebi({ eksikPencereVar: !!eksikPencereler, geminiKismiKrk })'),
    'kismi kart kendi icinde isaretlenmiyor ya da SEBEP yazilmiyor — arayuz rozeti ayiramaz');
  assert.ok(src.includes('const onbellegiAtla = !!yenileRaw'),
    'yenile cikis yolu yok — kismi satira sikisan belge tazelenemez');
});

/* 24.10.2026 — ATLAMA KAPISI YANLIS BUTCEYE BAKIYORDU.
 *
 * Kapi `budgetLeft()` okuyordu; o fonksiyon `pipelineBudgetMs`'e bagli ve
 * orasi Gemini kolu secilene kadar hala GROQ butcesi (110 sn eksi hazirlik).
 * Gemini'nin kendi butcesi (only modunda 145 sn) kapi GECILDIKTEN sonra
 * kuruluyordu. Hazirligi uzun bir belgede (OCR'li deste, hazirlik ~58 sn)
 * kapi 52.000 < 55.000 diye Gemini'yi atliyordu — oysa only modunda o
 * belgeye 87.000 ms kalacakti. */
/* ==========================================================================
   MODEL YARISI (24.10.2026)

   "En bosta olani sec" sorgulamayla yapilamaz — Google'in boyle bir ucu yok.
   Olcumler yarisi mumkun kiliyor: 503 5-7 saniyede donuyor (mesgul model
   kendini hizli belli ediyor), ilk byte her modelde ~15,2 sn oldugu icin
   AYIRT ETMIYOR, ilk OLAY ise 17-60 sn arasinda savruluyor — kazanan ilk
   islenmis olayi getiren.

   VARSAYILAN KAPALI ve bu bilincli: yaris basarili kosuda da bir istek fazla
   harciyor (iki POST ayni anda gider) ve bu, "terminal olmayan durumda
   SONRAKI ADAY MODEL denenmez" korumasiyla celisiyor. Kazanc mesgul model
   basina ~7 saniye, bedel her kosuda +1 RPD (model basina 20).
   ========================================================================== */
test('yaris VARSAYILAN KAPALI: basarili kosuda tek istek', async () => {
  denoEnv.delete('GEMINI_YARIS_GENISLIGI');
  assert.equal(G.geminiYarisGenisligi(), 1, 'varsayilan 1 degil — kota korumasi acilmis');
  stubFetch([{ status: 200, json: OK_JSON }]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out, 'taslak gelmeliydi');
    assert.equal(fetchCalls.length, 1, 'yaris kapaliyken ikinci istek atilmis');
  } finally { restoreFetch(); }
});

test('yaris genisligi secret ten okunuyor, deploy gerekmiyor', () => {
  denoEnv.set('GEMINI_YARIS_GENISLIGI', '2');
  assert.equal(G.geminiYarisGenisligi(), 2);
  denoEnv.set('GEMINI_YARIS_GENISLIGI', '  3 ');
  assert.equal(G.geminiYarisGenisligi(), 3, 'bosluk/yazim onemsiz olmali');
  // Aday sayisindan fazlasi istenemez.
  denoEnv.set('GEMINI_YARIS_GENISLIGI', '99');
  assert.equal(G.geminiYarisGenisligi(), G.GEMINI_MODEL_CANDIDATES.length);
  // Anlamsiz deger varsayilana doner (yaris kapali kalir).
  for (const kotu of ['0', '-1', 'abc', '']) {
    denoEnv.set('GEMINI_YARIS_GENISLIGI', kotu);
    assert.equal(G.geminiYarisGenisligi(), G.GEMINI_YARIS_GENISLIGI_VARSAYILAN,
      `"${kotu}" varsayilana donmeli`);
  }
  denoEnv.delete('GEMINI_YARIS_GENISLIGI');
});

test('yaris ACIKKEN iki model AYNI ANDA deneniyor', async () => {
  denoEnv.set('GEMINI_YARIS_GENISLIGI', '2');
  stubFetch([
    { status: 200, json: OK_JSON },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out, 'taslak gelmeliydi');
    assert.equal(fetchCalls.length, 2, 'yaris acikken iki istek gitmeli');
    const modeller = fetchCalls.map((c) => {
      return (c.body && c.body.model) || null;   // stubFetch body'yi ZATEN ayristiriyor
    });
    assert.deepEqual(modeller, G.GEMINI_MODEL_CANDIDATES.slice(0, 2),
      'yarisa ilk iki aday girmedi: ' + JSON.stringify(modeller));
  } finally { restoreFetch(); denoEnv.delete('GEMINI_YARIS_GENISLIGI'); }
});

test('yarista 503 veren model SIRALI yolda tekrar denenmiyor', async () => {
  /* Yarista mesgul oldugu OLCULEN bir modeli sirali yolda bir daha denemek
     gunluk kotadan bos yere istek goturur. */
  denoEnv.set('GEMINI_YARIS_GENISLIGI', '2');
  stubFetch([
    { status: 503, text: 'gemini-3.7-flash is currently experiencing high demand' },
    { status: 503, text: 'gemini-3.8-flash is currently experiencing high demand' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    /* Yarisin iki adayi 503 verdi; sirali yol onlari ATLAYIP ucuncu adayla
       devam eder (25.10.2026: iki model artik "yuzey yogun" sayilmiyor). */
    assert.ok(out, 'yarista iki model yogunken ucuncu aday denenmedi');
    assert.equal(fetchCalls.length, 3);
    assert.equal(fetchCalls[2].body.model, G.GEMINI_MODEL_CANDIDATES[2],
      'yarista 503 veren model sirali yolda yine denenmis');
  } finally { restoreFetch(); denoEnv.delete('GEMINI_YARIS_GENISLIGI'); }
});

test('yaris isleme blogunu PAYLASIYOR, kopyalamiyor', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  // Yaris ve sirali yol AYNI fonksiyonu cagirmali.
  const cagrilar = (src.match(/await denemeSonucunuIsle\(/g) || []).length;
  assert.equal(cagrilar, 2, `isleme fonksiyonu ${cagrilar} yerden cagriliyor — biri kopya olabilir`);
  assert.equal((src.match(/const denemeSonucunuIsle = async/g) || []).length, 1,
    'isleme fonksiyonu birden fazla tanimlanmis');
  // Kaybedenler iptal edilmeli, yoksa token ve baglanti tutmaya devam ederler.
  assert.ok(/kontroller\.forEach\(\(c, i\) => \{ if \(i !== kazanan\) c\.abort\(\) \}\)/.test(src),
    'yarisi kaybedenler iptal edilmiyor');
  assert.ok(/disSinyal\?: AbortSignal/.test(src), 'dis iptal borusu yok');
});

test('atlama kapisi MOD BUTCESINE bakiyor, Groq butcesine degil', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  assert.ok(src.includes('const geminiModButcesi = ()'), 'mod butcesi tek yerden okunmuyor');
  assert.ok(src.includes('geminiModKalan() < GEMINI_MIN_BUDGET_MS'),
    'kapi hala budgetLeft() okuyor — Groq butcesiyle karar veriyor');
  assert.ok(!/else if \(budgetLeft\(\) < GEMINI_MIN_BUDGET_MS\)/.test(src),
    'eski kapi hala duruyor');
  /* Kapi ve genisletme AYNI ifadeyi okumali; ayrisirlarsa kapi yine yanlis
     butceye bakar. Genisletme artik dogrudan yardimciyi cagiriyor. */
  assert.ok(src.includes('pipelineBudgetMs = geminiModButcesi()'),
    'genisletme kapiyla ayni ifadeyi kullanmiyor');
});

test('ARITMETIK: uzun hazirlikta only modu Gemini\'yi ATLAMAZ', () => {
  const hazirlikMs = 58_000;   // OCR'li 42 sayfalik deste
  const groqButcesi = G.PIPELINE_BUDGET_MS - hazirlikMs;
  const onlyButcesi = G.GEMINI_ONLY_BUDGET_MS - hazirlikMs;
  // Eski davranis: Groq butcesiyle karar -> atlanirdi.
  assert.ok(groqButcesi < G.GEMINI_MIN_BUDGET_MS,
    `Groq butcesi ${groqButcesi}ms esigin ustunde — bu testin anlatti­gi hata artik olusmaz, senaryoyu guncelle`);
  // Yeni davranis: only butcesiyle karar -> atlanmaz.
  assert.ok(onlyButcesi >= G.GEMINI_MIN_BUDGET_MS,
    `only butcesi ${onlyButcesi}ms — esik ${G.GEMINI_MIN_BUDGET_MS}ms, Gemini hala atlanir`);
});

/* 24.10.2026 — GECICI-HATA BAYRAGI ON BIR CIKISIN IKISINDE KONUYORDU.
 *
 * Senaryo: model-1 503 verir, model-2'nin akisi tavanda kesilir, kurtarma
 * "kart olmaya yetmiyor" der ve o daldan donulur. Bayrak false kaldigi icin
 * %56 kapsamali Groq karti onbellege KALICI yazilir ve o dosya icin Gemini
 * bir daha hic denenmez. Artik kural tek yerde: cik(). */
test('geminiDraft butun cikislari cik() uzerinden gecirir', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  const bas = src.indexOf('async function geminiDraft(');
  assert.ok(bas > 0, 'geminiDraft bulunamadi');
  const son = src.indexOf('\n}', src.indexOf('hicbir aday model taslak uretemedi', bas));
  const govde = src.slice(bas, son);

  // Bayrak TEK yerde konmali: cik() icinde.
  const bayrakSayisi = (govde.match(/geciciDustu = true/g) || []).length;
  assert.equal(bayrakSayisi, 1,
    `bayrak ${bayrakSayisi} yerde konuyor — kural dagilmis, bir cikis atlanabilir`);
  assert.ok(/const cik = \(\): null => \{[\s\S]{0,160}geciciDustu = true/.test(govde),
    'bayrak cik() icinde degil');

  /* Ciplak `return null` yalnizca iki ISTEK ONCESI yolda ve cik()'in kendi
     govdesinde mesru (orada geciciModeller zorunlu olarak bos). Bundan
     fazlasi, bayragi atlayan yeni bir cikis demek. */
  /* Yorumlar ayiklanir: gerekce metinleri `return null` ifadesini anlatiyor
     ve sayimi sisiriyordu (bu test ilk yazildiginda tam bunu yasadi). */
  const kod = govde
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');
  const ciplak = (kod.match(/return null/g) || []).length;
  assert.ok(ciplak <= 3,
    `${ciplak} ciplak return null var — yeni bir cikis bayragi atliyor olabilir`);

  /* 24.10.2026: isleme blogu ortak bir fonksiyona (denemeSonucunuIsle)
     tasindiktan sonra "birak" karari DEGER olarak donuyor; bayragi dagitim
     noktasi koyuyor. Korunan sey ayni: her birakma yolu cik()'ten geciyor.
     Bu yuzden artik `return cik()` SAYISI degil, her `'birak'` degerinin
     cik()'e baglandigi dogrulaniyor. */
  assert.ok(/denemeSonucu\.tur === 'birak'\) return cik\(\)/.test(kod),
    "dagitim 'birak' sonucunu cik()'e baglamiyor — bayrak atlanir");
  assert.ok(/denemeSonucu\.tur === 'taslak'\) return denemeSonucu\.taslak/.test(kod),
    'dagitim taslak sonucunu dondurmuyor');
  assert.ok((kod.match(/return cik\(\)/g) || []).length >= 3,
    'cik() neredeyse hic kullanilmiyor — bayrak yolu kopmus olabilir');
  // Isleme blogu TEK yerde olmali: ikinci bir kopya dogmasin.
  assert.equal((kod.match(/const denemeSonucunuIsle = async/g) || []).length, 1,
    'isleme fonksiyonu birden fazla kez tanimlanmis');
});

test('gecici hata sayaci MODEL ayirt ediyor', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
  assert.ok(src.includes('ardisikGecici = 0'), 'sayac basarida sifirlanmiyor');
  assert.ok(src.includes('geciciModeller.size >= GEMINI_ARDISIK_GECICI_MAX'),
    'esik MODEL sayisina degil deneme sayisina bakiyor');
  assert.ok(src.includes('geciciModeller.add(model)'), 'hata veren model kaydedilmiyor');
});

// ===========================================================================
// Proje kotasi — 09.10.2026 ucuncu kosu
// ===========================================================================
/* 17.10.2026'da DEGISTI — bu test eskiden tam tersini iddia ediyordu.
 *
 * Govdedeki "Your project has exceeded a quota" mesaji Google'in HEM gunluk
 * (RPD) HEM dakikalik (RPM 5) limitte dondurdugu ortak metin. Eski
 * siniflandirma hepsini olumcul sayiyor, yani dakikalik bir sinirlama
 * Gemini yolunu gun boyu kapatiyordu. Repo bunu zaten BILIYORDU: geminiDraft
 * icindeki GEMINI_RETRY_WAIT_MS yorumu "dakikalik limite carpiyor ve o 429
 * 'project has exceeded a quota' diye geliyor — gunluk kota sanip bos yere
 * panikledigimiz hata buydu" diyor. Siniflandirma o yorumu takip etmiyordu.
 *
 * Artik yalnizca GUNLUK bir metrik adi geciyorsa olumcul. Ayirt edilemeyen
 * genel mesaj dakikalik kabul edilip cagri noktasinda bir kez bekleniyor
 * (bkz. GEMINI_RPM_WAIT_MS) — yanlis tahminin bedeli bir istek, dogrunun
 * karsiligi kartin gelmesi. */
test('geminiQuotaExhausted: yalnizca GUNLUK kota olumcul sayilir', () => {
  const gunluk = '{"error":{"message":"Quota exceeded for metric generate_requests_per_day","code":"RESOURCE_EXHAUSTED"}}';
  assert.equal(G.geminiQuotaExhausted(429, gunluk), true, 'gunluk metrik adi olumcul olmali');
  assert.equal(G.geminiQuotaExhausted(429, 'exceeded your quota: GenerateRequestsPerDay'), true);
  assert.equal(G.geminiQuotaExhausted(429, 'requests per day limit reached'), true);
});

test('geminiQuotaExhausted: ayirt edilemeyen 429 olumcul DEGIL (dakikalik olabilir)', () => {
  const genel = '{"error":{"message":"Your project has exceeded a quota. See https://ai.dev/rate-limit to manage your rate limits.","code":"too_many_requests"}}';
  assert.equal(G.geminiQuotaExhausted(429, genel), false,
    'bu metin dakikalik limitte de geliyor — olumcul saymak Gemini yolunu gereksiz kapatir');
});

test('geminiQuotaExhausted: 503 ve 500 kota degildir', () => {
  assert.equal(G.geminiQuotaExhausted(503, 'currently experiencing high demand'), false);
  assert.equal(G.geminiQuotaExhausted(500, 'internal'), false);
  assert.equal(G.geminiQuotaExhausted(400, 'exceeded a quota'), false);
});

/* 25.10.2026 — GUNLUK KOTA MODEL BASINA. Eski test "proje seviyesinde"
   diyordu; ucretsiz katmanda RPD model basina 20. 3.7'nin gunu bitince
   3.5/3.6'nin kotasi duruyor — "Groq yalnizca kota bitince" butun modellerin
   kotasi demek. */
test('geminiDraft: bir modelin GUNLUK kotasi dolunca SONRAKI aday denenir', async () => {
  stubFetch([
    { status: 429, text: 'Quota exceeded for metric generate_requests_per_day, model: gemini-3.7-flash' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out, 'tek modelin kotasi dolunca Groq a dusuldu');
    assert.equal(out.model, G.GEMINI_MODEL_CANDIDATES[1]);
    assert.equal(fetchCalls.length, 2);
  } finally { restoreFetch(); }
});

test('geminiDraft: BUTUN modellerin kotasi doluysa durulur, kart kalicilasmaz', async () => {
  stubFetch(G.GEMINI_MODEL_CANDIDATES.map(m =>
    ({ status: 429, text: `Quota exceeded for metric generate_requests_per_day, model: ${m}` })));
  const tani = {};
  try {
    const out = await quiet(() =>
      G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000, 'only', tani));
    assert.equal(out, null);
    assert.equal(fetchCalls.length, G.GEMINI_MODEL_CANDIDATES.length, 'her model bir kez yeterli');
    assert.equal(tani.geciciDustu, true, 'kota yarin acilir — bugunun Groq karti onbellege girmemeli');
  } finally { restoreFetch(); }
});

test('geminiDraft: dakikalik 429 BIR kez tekrar denenir, aday turlanmaz', async () => {
  /* RPM limiti gecicidir, ama penceresi 60 saniye ve tek istegin tamami 150
     saniye — o yuzden bekleme yalnizca butce genisken yapilir, ve ikinci kez
     denenmez. Aday model turlamak da anlamsiz: limit projenin, modelin
     degil. Iki istekten fazlasi gunluk kotayi bos yere yakar. */
  stubFetch([
    { status: 429, text: 'Your project has exceeded a quota.' },
    { status: 429, text: 'Your project has exceeded a quota.' }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 200_000));
    assert.equal(out, null);
    assert.equal(fetchCalls.length, 2,
      `dakikalik 429 dan sonra ${fetchCalls.length} istek yapildi — tam iki olmali`);
  } finally { restoreFetch(); }
});

test('geminiDraft: butce darsa dakikalik 429 BEKLENMEZ, hemen cikilir', async () => {
  // Beklemek kalan zamani yakip hicbir sey uretmemek demek.
  stubFetch([{ status: 429, text: 'Your project has exceeded a quota.' }]);
  try {
    // 80 sn butce, esik 90 sn: beklemeye yer yok.
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 80_000));
    assert.equal(out, null);
    assert.equal(fetchCalls.length, 1, 'dar butcede beklemeden cikilmali');
  } finally { restoreFetch(); }
});

test('geminiDraft: her aday tukenirse null (cagiran Groq a duser)', async () => {
  stubFetch(G.GEMINI_MODEL_CANDIDATES.map(() => ({ status: 403, text: 'API key invalid' })));
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.equal(out, null);
    assert.equal(fetchCalls.length, G.GEMINI_MODEL_CANDIDATES.length, 'her aday bir kez denenmeli');
  } finally { restoreFetch(); }
});

test('geminiDraft: 200 ama incomplete ise null — yarim JSON karta girmez', async () => {
  stubFetch(G.GEMINI_MODEL_CANDIDATES.map(() => ({ status: 200, json: { status: 'incomplete', steps: [] } })));
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.equal(out, null);
  } finally { restoreFetch(); }
});

test('geminiDraft: cikti tavaninda TEK istekte durur, aday turlamaz', async () => {
  // Ayni prompt + ayni tavan = ayni sonuc. Her deneme ~88 sn suruyor ve
  // gunluk 20 istekten birini yakiyor; uc kez ayni duvara carpmanin
  // hicbir kazanci yok.
  stubFetch(G.GEMINI_MODEL_CANDIDATES.map(() => ({ status: 200, json: { status: 'incomplete', steps: [] } })));
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.equal(out, null);
    assert.equal(fetchCalls.length, 1,
      `tavana carpinca ${fetchCalls.length} istek yapildi — biri yeterli`);
  } finally { restoreFetch(); }
});

test('geminiDraft: 200 ama metin bossa null', async () => {
  stubFetch(G.GEMINI_MODEL_CANDIDATES.map(() => ({ status: 200, json: { status: 'completed', steps: [] } })));
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.equal(out, null);
  } finally { restoreFetch(); }
});

test('geminiDraft: ag tamamen coktuyse null, istisna disari sizmaz', async () => {
  stubFetch(G.GEMINI_MODEL_CANDIDATES.flatMap(() => [
    { throw: new Error('ENOTFOUND') },
    { throw: new Error('ENOTFOUND') }
  ]));
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.equal(out, null);
  } finally { restoreFetch(); }
});

// ===========================================================================
// Sinir sabitleri — sessizce gevsetilmesinler
// ===========================================================================
test('sinirlar: yukleme siniri (20 MB) inline sinirin ustunde kalmali', () => {
  assert.ok(G.GEMINI_INLINE_MAX_BYTES <= 20 * 1024 * 1024);
  assert.ok(G.GEMINI_INLINE_MAX_BYTES >= 8 * 1024 * 1024);
});

test('sinirlar: butce payi cagri suresinden sonra review a yer birakir', () => {
  assert.ok(G.GEMINI_MIN_BUDGET_MS > G.GEMINI_RESERVE_MS,
    'en az butce, ayrilan paydan buyuk olmali yoksa cagri hic baslayamaz');
  assert.ok(G.GEMINI_RESERVE_MS >= 25_000, 'review + kapilar + kayit icin pay cok dar');
  assert.ok(G.GEMINI_MAX_CALL_MS <= 90_000, 'tek cagri 150 sn lik fonksiyon sinirini zorlamamali');
});

/* 09.10.2026 DORDUNCU KOSU: tek Gemini cagrisi 74,9 sn de zaman asimina
   ugradi, Groq a 0 ms kaldi ve kart anlati yazarini, gorsel gecisini ve
   review u kaybetti. Asagidaki uc test o kombinasyonun geri gelmesini
   engeller. */
test('zaman asimi olsa bile Groq a pencere+birlesim suresi kalir', () => {
  // 62 -> 52 sn (09.10.2026 21:40): Gemini'nin calistigi olculdukten sonra
  // takas onun lehine yapildi. 52 sn pencereleri ve birlesimi tasir
  // (olculdu ~40 sn), review'u tasimaz — ama Gemini artik calisiyor.
  assert.ok(G.GEMINI_GROQ_RESERVE_MS >= 45_000,
    `Groq a saklanan pay ${G.GEMINI_GROQ_RESERVE_MS}ms — pencereler bile sigmaz`);
  assert.ok(
    G.GEMINI_PIPELINE_BUDGET_MS - G.GEMINI_MAX_CALL_MS >= G.GEMINI_GROQ_RESERVE_MS,
    'en uzun Gemini cagrisi zaman asimina ugrarsa Groq a saklanan pay kalmiyor'
  );
});

test('Gemini cagrisi olculen 67,4 sn ye rahat pay birakiyor', () => {
  // Basarili kosu 72,4 sn surmustu. Tavan bunun altina inerse gölge yol
  // bu belgede hic tamamlanamaz — kirpma sonrasi sure olculene kadar
  // tavani bilerek 70 sn de tutuyoruz.
  // Tamamlanan kosu 67,4 sn surdu. Tavan ona yapisik kalirsa biraz daha
  // icerik istemek dogrudan zaman asimi demek — ve gunluk kota 20 istek.
  assert.ok(G.GEMINI_MAX_CALL_MS >= 75_000,
    `cagri tavani ${G.GEMINI_MAX_CALL_MS}ms — olculen 67,4 sn ye pay birakmiyor`);
});

test('geminiDraft: butce cagriya 35 sn bile veremiyorsa hic denemez', async () => {
  stubFetch([]);
  {
    try {
      // shadow modu: 80 sn butce, Groq a 52 sn saklaninca 28 sn kaliyor —
      // esigin altinda, dolayisiyla hic denenmemeli.
      const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 80_000, 'shadow'));
      assert.equal(out, null);
      assert.equal(fetchCalls.length, 0,
        'yarim kalacagi belli bir cagri Groq tan zaman calmamali');
    } finally { restoreFetch(); }
  }
});


test('kapsam bandi COK BUYUK belgede geri iniyor', () => {
  /* 20.10.2026 OLCUMU: 86 sayfalik bolumde (68.205 krk cikarilan metin)
     model 55 saniye dusundu, kalan ~50 saniyede 29.557 karakter yazdi
     (~600 krk/sn) ve YETISEMEDI — mutlak tavanda kesildi, kart KISMI
     cikti, kapsama %31, onbellege de alinmadi.

     Sebep: band 25 sayfada tavana vurup bir daha inmiyordu, yani sayfa
     basina en az zamani oldugu anda EN COK cikti isteniyordu. */
  const bant = (q) => (q.match(/\b\d+-\d+\b/g) || []).slice(0, 3).join('/');
  /* 21.10.2026: orta bant 18-26/22-28/12-15 DEGIL artik. O bant 38 ve 42
     sayfalik iki belgede de karti yarim birakti (34-37 KB, 96,9 ve 105 sn
     tavanlarinda kesildi), yani 20.10'da 86 sayfa icin verilen karar 25-60
     araligi icin de gecerliydi. Bant 10-25 ile ayni; asagidaki notEqual
     hala tutuyor, cunku dev belge terim ve soru bandinda daha da iniyor. */
  assert.equal(bant(G.geminiCoverageQuota(42)), '15-22/16-20/10-13', 'orta bant degismis');
  assert.equal(bant(G.geminiCoverageQuota(86)), '14-18/16-20/8-10', 'dev belgede band geri inmiyor');
  assert.notEqual(
    bant(G.geminiCoverageQuota(86)),
    bant(G.geminiCoverageQuota(42)),
    'dev belge orta belgeyle ayni miktarda cikti istiyor');
});

test('FORMUL ve TABLO dev belgede de TAVANSIZ', () => {
  /* Golge yolun var olma sebebi onlar: slaytlarda resim olarak duran
     denklemleri Groq goremiyor. Band inerken bunlara DOKUNULMAMALI —
     kisilan sey terim/nokta/soru. */
  const dev = G.geminiCoverageQuota(86);
  assert.ok(/No cap on/.test(dev), 'formul/tablo tavansizligi kaybolmus');
  assert.ok(/every equation/.test(dev), 'her denklem istegi kaybolmus');
});

summary();
