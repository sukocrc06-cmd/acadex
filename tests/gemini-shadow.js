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
  'bytesToBase64',
  'geminiModelCandidates', 'geminiNativeMime', 'geminiModelMissing',
  'geminiFormatRejected', 'GEMINI_DUSURULEBILIR', 'geminiUnknownParameter',
  'geminiQuotaExhausted',
  'PIPELINE_BUDGET_MS', 'GEMINI_PIPELINE_BUDGET_MS', 'geminiCoverageQuota',
  'buildGeminiDocInstruction', 'extractGeminiText',
  'geminiProblem', 'geminiFigureNotes', 'callGeminiOnce', 'geminiDraft'
];

// Deno global'i: cikarilan kod Deno.env.get cagiriyor. Node'da yok, kukla.
const denoEnv = new Map();
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
    fetchCalls.push({ url, body: JSON.parse(options.body), headers: options.headers });
    const next = fetchQueue.shift();
    if (!next) throw new Error('kukla fetch: beklenenden fazla cagri yapildi');
    if (next.throw) throw next.throw;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.json,
      text: async () => (typeof next.text === 'string' ? next.text : JSON.stringify(next.json ?? {}))
    };
  };
}
function restoreFetch() { globalThis.fetch = realFetch; }

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
  assert.match(s, /key_terms/);
  assert.ok(/paraphrase does not count/.test(s),
    'tarif etmenin yetmedigi acikca soylenmeli');
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
test('geminiCoverageQuota: sayilar OLCULEN banda geri geldi, sisirilmedi', () => {
  // Ilk hali 25-40 terim isteyip kosuyu tamamlanamaz hale getirmisti;
  // kota tamamen kalkinca kosu tamamlandi ama 8 terim kaldi. Bu bant
  // ikisinin arasi ve bir daha yukari kacmamali.
  const q = G.geminiCoverageQuota(42);
  const alt = Number(q.match(/(\d+)-(\d+) key_terms/)[1]);
  const ust = Number(q.match(/(\d+)-(\d+) key_terms/)[2]);
  assert.ok(alt >= 15, `alt sinir ${alt} — Groq un 16 terimine yaklasmali`);
  assert.ok(ust <= 30, `ust sinir ${ust} — 25-40 bandi kosuyu tamamlanamaz yapmisti`);
  assert.match(q, /not a quota to fill/);
});

test('geminiCoverageQuota: sayilar formul ve tablodan SONRA isteniyor', () => {
  // Sira onemli: tavan 78 sn ve olculen kosu 67,4 sn surdu. Model once
  // degerli olani uretmeli, sayilar artan zamana kalmali.
  const q = G.geminiCoverageQuota(42);
  assert.ok(q.indexOf('"formulas"') < q.indexOf('key_terms'),
    'formuller sayilardan sonra isteniyor — sira ters');
  assert.match(q, /do those first/);
});

test('geminiCoverageQuota: nokta bandi Groq un uretimine yetisiyor', () => {
  // Groq ayni destede 25 nokta veriyordu, Gemini 18. Aradaki tek gercek
  // fark buydu ve 81,3 sn'lik kosuda 23,7 sn bosluk vardi.
  const q = G.geminiCoverageQuota(42);
  const alt = Number(q.match(/(\d+)-(\d+) key_points/)[1]);
  assert.ok(alt >= 20, `nokta alt siniri ${alt} — Groq un 25'ine yaklasmiyor`);
  assert.ok(Number(q.match(/(\d+)-(\d+) key_points/)[2]) <= 32,
    'bant yine sisirildi — 09.10 aksami bu kosuyu tamamlanamaz yapmisti');
});

test('geminiCoverageQuota: formul ve tablo tavansiz kalir', () => {
  // Gölge yolun butun gerekcesi bu ikisi: 42 sayfanin 22'sinde denklem
  // resim olarak duruyor ve Groq onlarin yalnizca 2'sini gorebiliyor.
  const q = G.geminiCoverageQuota(42);
  assert.match(q, /NO cap/);
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

test('geminiFigureNotes: 60 kayitta durur (review prompt sismesin)', () => {
  const notes = G.geminiFigureNotes({
    visual_findings: Array.from({ length: 200 }, (_, i) => `bulgu numarasi ${i}`)
  });
  assert.equal(notes.length, 60);
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

test('geminiDraft: 503 bir kez tekrar denenir, sonra sonraki modele gecer', async () => {
  // Olculdu: ikinci kosuda ilk deneme 503 aldi, ikincisi tuttu ve kart
  // Gemini'den geldi. 503 gercekten gecici.
  stubFetch([
    { status: 503, text: 'currently experiencing high demand' },
    { status: 503, text: 'currently experiencing high demand' },
    { status: 200, json: OK_JSON }
  ]);
  try {
    const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
    assert.ok(out);
    assert.equal(fetchCalls.length, 3);
    assert.equal(out.model, G.GEMINI_MODEL_CANDIDATES[1]);
  } finally { restoreFetch(); }
});

// ===========================================================================
// Proje kotasi — 09.10.2026 ucuncu kosu
// ===========================================================================
test('geminiQuotaExhausted: proje kotasi 429 u taninir', () => {
  const govde = '{"error":{"message":"Your project has exceeded a quota. See https://ai.dev/rate-limit to manage your rate limits.","code":"too_many_requests"}}';
  assert.equal(G.geminiQuotaExhausted(429, govde), true);
});

test('geminiQuotaExhausted: 503 ve 500 kota degildir', () => {
  assert.equal(G.geminiQuotaExhausted(503, 'currently experiencing high demand'), false);
  assert.equal(G.geminiQuotaExhausted(500, 'internal'), false);
  assert.equal(G.geminiQuotaExhausted(400, 'exceeded a quota'), false);
});

test('geminiDraft: proje kotasi dolunca TEK istekte durur', async () => {
  // Kota proje seviyesinde: baska modeli denemek de, tekrar denemek de ayni
  // duvara carpar ve gunluk 100 isteklik kotadan bosuna istek goturur.
  stubFetch([{ status: 429, text: 'Your project has exceeded a quota.' }]);
  {
    try {
      const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
      assert.equal(out, null);
      assert.equal(fetchCalls.length, 1,
        `kota 429 undan sonra ${fetchCalls.length} istek yapildi — biri yeterli`);
    } finally { restoreFetch(); }
  }
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

summary();
