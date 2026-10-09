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
  'GEMINI_MAX_CALL_MS', 'GEMINI_MAX_OUTPUT_TOKENS',
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
test('geminiCoverageQuota: 42 sayfalik deste Groq un uretiminin ustunu ister', () => {
  const q = G.geminiCoverageQuota(42);
  assert.match(q, /key_terms: 25-40/);
  assert.match(q, /key_points: 20-30/);
  assert.match(q, /quiz_questions: 10-15/);
  const altSinir = Number(q.match(/key_terms: (\d+)-/)[1]);
  assert.ok(altSinir > 15, `alt sinir Groq un 15 terimini gecmeli, ${altSinir} bulundu`);
});

test('geminiCoverageQuota: kisa belgeye buyuk kota dayatilmaz', () => {
  const q = G.geminiCoverageQuota(4);
  assert.match(q, /key_terms: 10-18/);
  assert.doesNotMatch(q, /25-40/);
});

test('geminiCoverageQuota: orta boy belge arada kalir', () => {
  assert.match(G.geminiCoverageQuota(18), /key_terms: 18-28/);
});

test('geminiCoverageQuota: sayfa sayisi bilinmiyorsa sayi uydurulmaz', () => {
  const q = G.geminiCoverageQuota(0);
  assert.doesNotMatch(q, /\b0-page\b/);
  assert.match(q, /this document/);
});

test('geminiCoverageQuota: formul ve tablo tavansiz istenir', () => {
  // Gölge yolun butun gerekcesi bu ikisi; bir sayiyla sinirlanirlarsa
  // 42 sayfalik bir destede en degerli icerik kesilir.
  const q = G.geminiCoverageQuota(42);
  assert.match(q, /formulas: EVERY distinct equation[^\n]*no cap/);
  assert.match(q, /tables: EVERY table[^\n]*no cap/);
});

test('geminiCoverageQuota: dolgu acikca yasaklanir', () => {
  assert.match(G.geminiCoverageQuota(42), /padding with restatements is worse/);
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

test('callGeminiOnce: cikis tavani Groq un 3.702 tavaninin cok ustunde', () => {
  // Gölge yolun var olma sebeplerinden biri bu sayi. 8.000 in altina
  // dusurulurse yol amacini kaybeder.
  assert.ok(G.GEMINI_MAX_OUTPUT_TOKENS >= 16384, `tavan cok dusuk: ${G.GEMINI_MAX_OUTPUT_TOKENS}`);
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

test('geminiDraft: proje kotasi dolunca TEK istekte durur', () => {
  // Kota proje seviyesinde: baska modeli denemek de, tekrar denemek de ayni
  // duvara carpar ve gunluk 100 isteklik kotadan bosuna istek goturur.
  stubFetch([{ status: 429, text: 'Your project has exceeded a quota.' }]);
  return (async () => {
    try {
      const out = await quiet(() => G.geminiDraft('K', 'SIS', BYTES, 'application/pdf', 'KUL', 120_000));
      assert.equal(out, null);
      assert.equal(fetchCalls.length, 1,
        `kota 429 undan sonra ${fetchCalls.length} istek yapildi — biri yeterli`);
    } finally { restoreFetch(); }
  })();
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

summary();
