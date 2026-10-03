/* ==========================================================================
   ACADEX — MAP-PASS KARSILASTIRMA HARNESS (tests/map-model-compare.js)

   Ne yapar:
     summarize-document edge function'inin "map" (pencere basina cikarim)
     adimini, PRODUCTION PROMPTUNUN BIREBIR AYNISIYLA, birden fazla model ve
     birden fazla prompt varyanti icin ayni metin pencerelerinde calistirir ve
     sonuclari OLCULEBILIR metriklerle puanlar.

   Neden kaynaktan prompt cikariyor:
     Prompt metni bu dosyaya kopyalanmis olsa, index.ts degistiginde test
     sessizce eski promptu olcmeye devam ederdi. Bunun yerine promptlar
     supabase/functions/summarize-document/index.ts icinden calisma aninda
     okunur. Prompt tasinirsa test ACIK HATA verir, yanlis sonuc uretmez.

   Kullanim:
     export GROQ_API_KEY=gsk_...
     node tests/map-model-compare.js --input belge.pdf
     node tests/map-model-compare.js --input metin.txt --windows 4 --runs 2

   Secenekler:
     --input <yol>     .txt (hazir metin) veya .pdf (pdftotext ile sayfa
                       isaretcileri uretilir — poppler-utils gerekir)
     --windows <n>     Kac pencere test edilsin (varsayilan 3)
     --runs <n>        Her kombinasyon kac kez kosulsun (varsayilan 2, varyans
                       gormek icin)
     --models <a,b>    Virgullu model listesi (varsayilan: index.ts'teki
                       MODEL_HEAVY ve MODEL_FAST)
     --prompts <a,b>   live | rich  (varsayilan: ikisi de)
     --split <mod>     char | paragraph  (varsayilan: ikisi de — production
                       char kullaniyor, paragraph olu splitIntoChunks mantigi)
     --lang <tr|en>    Varsayilan tr
     --out <dizin>     Varsayilan tests/out
     --dry-run         Groq'a cikmadan promptlari/pencereleri dogrula
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SRC = path.join(__dirname, '..', 'supabase', 'functions', 'summarize-document', 'index.ts');
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const o = {
    input: null, windows: 3, runs: 2, models: null, prompts: null,
    split: null, lang: 'tr', out: path.join(__dirname, 'out'), dryRun: false
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) { throw new Error(`${a} bir deger bekliyor`); }
      return v;
    };
    if (a === '--input') o.input = next();
    else if (a === '--windows') o.windows = parseInt(next(), 10);
    else if (a === '--runs') o.runs = parseInt(next(), 10);
    else if (a === '--models') o.models = next().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--prompts') o.prompts = next().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--split') o.split = next().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--lang') o.lang = next();
    else if (a === '--out') o.out = next();
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else throw new Error(`Bilinmeyen secenek: ${a}`);
  }
  if (!Number.isFinite(o.windows) || o.windows < 1) throw new Error('--windows >= 1 olmali');
  if (!Number.isFinite(o.runs) || o.runs < 1) throw new Error('--runs >= 1 olmali');
  if (!o.input) throw new Error('--input zorunlu (bir .txt veya .pdf yolu). --help ile kullanim.');
  return o;
}

function printHelp() {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*+/, ''));
}

// ---------------------------------------------------------------------------
// KAYNAKTAN SABIT + PROMPT CIKARIMI
// Amac: index.ts degisirse test ya dogru yeni degeri kullanir ya da patlar.
// ---------------------------------------------------------------------------
function readSource() {
  if (!fs.existsSync(SRC)) throw new Error(`Kaynak bulunamadi: ${SRC}`);
  return fs.readFileSync(SRC, 'utf8');
}

function extractConst(src, name, { numeric = false } = {}) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([0-9_]+))`);
  const m = src.match(re);
  if (!m) throw new Error(`index.ts icinde ${name} bulunamadi — sabit tasinmis olabilir, harness guncellenmeli.`);
  const raw = m[1] || m[2] || m[3];
  return numeric ? parseInt(String(raw).replace(/_/g, ''), 10) : raw;
}

/** Verilen indexten sonraki ilk template literal'i (backtick) dengeli sekilde cikarir. */
function extractTemplateLiteral(src, fromIndex, label) {
  const start = src.indexOf('`', fromIndex);
  if (start === -1) throw new Error(`${label}: template literal baslangici bulunamadi.`);
  let i = start + 1, depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '$' && src[i + 1] === '{') { depth++; i += 2; continue; }
    if (c === '}' && depth > 0) { depth--; i++; continue; }
    if (c === '`' && depth === 0) return src.slice(start + 1, i);
    i++;
  }
  throw new Error(`${label}: template literal kapanisi bulunamadi.`);
}

/** Canli uzun-belge promptu: serve() icindeki compactWindowPrompt arrow fn. */
function getLivePromptFactory(src) {
  const anchor = 'const compactWindowPrompt =';
  const at = src.indexOf(anchor);
  if (at === -1) throw new Error('compactWindowPrompt bulunamadi — canli uzun-belge yolu degismis, harness guncellenmeli.');
  const lit = extractTemplateLiteral(src, at, 'compactWindowPrompt');
  // Literal icinde ${wi + 1}, ${total}, ${langLabel} gecer.
  const fn = new Function('wi', 'total', 'langLabel', 'return `' + lit + '`;');
  return (wi, total, langLabel) => fn(wi, total, langLabel);
}

/** Olu ama daha zengin map promptu: buildChunkSystemPrompt. */
function getRichPromptFactory(src) {
  const anchor = 'function buildChunkSystemPrompt(';
  const at = src.indexOf(anchor);
  if (at === -1) throw new Error('buildChunkSystemPrompt bulunamadi — harness guncellenmeli.');
  const lit = extractTemplateLiteral(src, at, 'buildChunkSystemPrompt');

  // Bagimliligi: buildFootnotePageInstruction. Onu da kaynaktan cikar.
  const fnAt = src.indexOf('function buildFootnotePageInstruction(');
  if (fnAt === -1) throw new Error('buildFootnotePageInstruction bulunamadi — harness guncellenmeli.');
  const hasLit = extractTemplateLiteral(src, src.indexOf('return `', fnAt), 'footnote-has-markers');
  const noLit = extractTemplateLiteral(src, src.indexOf('return `', src.indexOf('`', src.indexOf('return `', fnAt) + 8)), 'footnote-no-markers');
  const footnoteFn = (hasPageMarkers, pageMarkerLabel) => {
    const unitWord = pageMarkerLabel === 'SLAYT' ? 'slide' : 'page';
    const body = hasPageMarkers ? hasLit : noLit;
    return new Function('hasPageMarkers', 'pageMarkerLabel', 'unitWord', 'return `' + body + '`;')(
      hasPageMarkers, pageMarkerLabel, unitWord
    );
  };

  const fn = new Function(
    'chunkIndex', 'totalChunks', 'langLabel', 'hasPageMarkers', 'pageMarkerLabel', 'buildFootnotePageInstruction',
    'return `' + lit + '`;'
  );
  return (wi, total, langLabel, hasPageMarkers, pageMarkerLabel) =>
    fn(wi, total, langLabel, hasPageMarkers, pageMarkerLabel, footnoteFn);
}

// ---------------------------------------------------------------------------
// GIRDI: metin + sayfa isaretcileri
// ---------------------------------------------------------------------------
function loadText(input, pageMarkerLabel) {
  if (!fs.existsSync(input)) throw new Error(`Girdi bulunamadi: ${input}`);
  const ext = path.extname(input).toLowerCase();
  if (ext === '.txt' || ext === '.md') {
    return { text: fs.readFileSync(input, 'utf8'), source: 'txt' };
  }
  if (ext !== '.pdf') throw new Error(`Desteklenmeyen girdi tipi: ${ext} (.txt veya .pdf kullan)`);

  // production "--- SAYFA N ---" bicimini taklit et
  let pageCount;
  try {
    const info = execFileSync('pdfinfo', [input], { encoding: 'utf8' });
    const m = info.match(/^Pages:\s*(\d+)/m);
    if (!m) throw new Error('pdfinfo sayfa sayisi vermedi');
    pageCount = parseInt(m[1], 10);
  } catch (e) {
    throw new Error(
      'PDF okumak icin poppler-utils gerekiyor (pdfinfo/pdftotext).\n' +
      '  macOS: brew install poppler\n  Debian/Ubuntu: sudo apt install poppler-utils\n' +
      '  Alternatif: PDF metnini elle bir .txt dosyasina cikarip --input ile ver.\n' +
      `  Orijinal hata: ${e.message}`
    );
  }
  const parts = [];
  for (let p = 1; p <= pageCount; p++) {
    let pageText = '';
    try {
      pageText = execFileSync('pdftotext', ['-layout', '-f', String(p), '-l', String(p), input, '-'],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch (_e) { pageText = ''; }
    parts.push(`--- ${pageMarkerLabel} ${p} ---\n${pageText.trim()}`);
  }
  return { text: parts.join('\n\n'), source: `pdf(${pageCount}s)` };
}

// ---------------------------------------------------------------------------
// PENCERELEME: production char-slice vs olu paragraph-aware
// ---------------------------------------------------------------------------
function windowsByChar(text, size, max) {
  const out = [];
  for (let s = 0; s < text.length && out.length < max; s += size) out.push(text.slice(s, s + size));
  return out;
}

/** index.ts'teki (olu) splitIntoChunks mantigi. */
function windowsByParagraph(text, targetChunkSize, max) {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const para of paragraphs) {
    if (para.length > targetChunkSize * 1.5) {
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < para.length; i += targetChunkSize) chunks.push(para.substring(i, i + targetChunkSize));
      continue;
    }
    if (current && (current.length + para.length + 2) > targetChunkSize) { chunks.push(current); current = para; }
    else current = current ? current + '\n\n' + para : para;
  }
  if (current) chunks.push(current);
  return (chunks.length ? chunks : [text]).slice(0, max);
}

// ---------------------------------------------------------------------------
// GROQ
// ---------------------------------------------------------------------------
function stripThinkBlock(raw) {
  const match = raw.match(/<think>[\s\S]*?<\/think>/i);
  if (match) return raw.slice((match.index ?? 0) + match[0].length).trim();
  if (/^\s*<think>/i.test(raw)) return null;
  return raw;
}

async function callGroq(apiKey, model, systemPrompt, userContent, maxCompletionTokens, timeoutMs) {
  const body = {
    model, temperature: 0.2, max_completion_tokens: maxCompletionTokens,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }]
  };
  if (String(model).includes('gpt-oss') || String(model).includes('openai/')) {
    body.reasoning_effort = 'low';
    body.include_reasoning = false;
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctl.signal
    });
    const latency = Date.now() - t0;
    // Gercek hesap limitleri: kaynak dosyadaki yorumlar 8000 TPM "gozlemlendi"
    // diyor ama bu eski bir denetimden kalma olabilir. Mimari karari tahminle
    // degil bu header'larla vereceğiz.
    const limits = {
      limit_tokens: res.headers.get('x-ratelimit-limit-tokens'),
      remaining_tokens: res.headers.get('x-ratelimit-remaining-tokens'),
      reset_tokens: res.headers.get('x-ratelimit-reset-tokens'),
      limit_requests: res.headers.get('x-ratelimit-limit-requests'),
      remaining_requests: res.headers.get('x-ratelimit-remaining-requests'),
      retry_after: res.headers.get('retry-after')
    };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false, latency, limits, usage: null,
        rateLimited: res.status === 429,
        error: `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`
      };
    }
    const raw = data.choices?.[0]?.message?.content ?? '';
    const usage = data.usage || null;
    if (!raw) return { ok: false, latency, limits, error: 'bos icerik', usage };
    const stripped = stripThinkBlock(raw);
    if (stripped === null) return { ok: false, latency, limits, error: 'bitmeyen <think> blogu', usage, raw };
    const cleaned = stripped.replace(/```json\s*|```/g, '').trim();
    try {
      return { ok: true, latency, limits, json: JSON.parse(cleaned), usage, raw };
    } catch (e) {
      return { ok: false, latency, limits, error: `JSON parse hatasi: ${e.message}`, usage, raw };
    }
  } catch (e) {
    return { ok: false, latency: Date.now() - t0, limits: null, error: `istek hatasi: ${e.name === 'AbortError' ? 'timeout' : e.message}`, usage: null };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// PUANLAMA — hepsi olculebilir, insan yargisi gerektirmez
// ---------------------------------------------------------------------------
const norm = s => String(s == null ? '' : s).toLowerCase()
  .replace(/\s+/g, ' ')
  .replace(/[“”"'’‘`()[\]{}.,;:!?]/g, '')
  .trim();

const ADMIN_LEAK = [
  'devamsızlık', 'devamsizlik', 'vize ağırlığ', 'vize agirlig', 'final ağırlığ',
  'ofis saat', 'bütünleme', 'butunleme', 'not itiraz', 'ders kitabı baskı',
  'attendance polic', 'grading weight', 'office hours', 'textbook edition',
  'late submission', 'grade appeal'
];
const FILLER = [
  'no draft provided', 'qualitative overview', 'genel bir bakış sunar',
  'temel kavramları ele alır', 'bu belge genel olarak', 'key concepts',
  'ana hatlarıyla özetlenmiştir', 'provides an overview of key'
];

function flat(o) {
  // Cikti JSON'undaki tum string degerleri tek metne indirger (sizinti taramasi icin).
  const acc = [];
  (function walk(v) {
    if (v == null) return;
    if (typeof v === 'string') { acc.push(v); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') { Object.values(v).forEach(walk); }
  })(o);
  return acc.join('\n');
}

function scoreOutput(json, windowText, lang, pageMarkerLabel) {
  const s = {};
  const haystack = norm(windowText);

  const terms = Array.isArray(json.key_terms) ? json.key_terms : [];
  const points = Array.isArray(json.key_points) ? json.key_points : [];
  const quiz = Array.isArray(json.quiz_questions) ? json.quiz_questions : [];
  const formulas = Array.isArray(json.formulas) ? json.formulas : [];
  const diagrams = Array.isArray(json.diagrams) ? json.diagrams : [];
  const tables = Array.isArray(json.tables) ? json.tables : [];
  const charts = Array.isArray(json.charts) ? json.charts : [];
  const examples = Array.isArray(json.worked_examples) ? json.worked_examples : [];
  const notes = Array.isArray(json.footnotes) ? json.footnotes : [];
  const cg = json.concept_graph || {};
  const cgNodes = Array.isArray(cg.nodes) ? cg.nodes : [];
  const cgEdges = Array.isArray(cg.edges) ? cg.edges : [];

  s.n_terms = terms.length;
  s.n_points = points.length;
  s.n_quiz = quiz.length;
  s.n_formulas = formulas.length;
  s.n_diagrams = diagrams.length;
  s.n_tables = tables.length;
  s.n_charts = charts.length;
  s.n_examples = examples.length;
  s.n_footnotes = notes.length;
  s.n_cg_nodes = cgNodes.length;
  s.n_cg_edges = cgEdges.length;

  const summary = String(json.summary || json.chunk_summary || '');
  s.summary_chars = summary.length;
  s.summary_sentences = (summary.match(/[.!?]+(\s|$)/g) || []).length;

  // TEMELLENDIRME: cikarilan terim kaynak metinde gercekten geciyor mu?
  const groundedTerms = terms.filter(t => t && t.term && haystack.includes(norm(t.term)));
  s.grounded_terms_pct = terms.length ? Math.round(100 * groundedTerms.length / terms.length) : null;
  s.ungrounded_terms = terms.filter(t => t && t.term && !haystack.includes(norm(t.term)))
    .map(t => String(t.term)).slice(0, 6);

  // Formul degisken sembolleri metinde geciyor mu?
  const allVars = formulas.flatMap(f => Array.isArray(f?.variables) ? f.variables : []);
  const groundedVars = allVars.filter(v => v && v.symbol && haystack.includes(norm(v.symbol)));
  s.grounded_formula_vars_pct = allVars.length ? Math.round(100 * groundedVars.length / allVars.length) : null;

  // Sayfa gecerliligi: iddia edilen sayfa isaretcisi bu pencerede VAR mi?
  const markersHere = new Set(
    [...windowText.matchAll(new RegExp(`---\\s*${pageMarkerLabel}\\s+(\\d+)\\s*---`, 'g'))].map(m => m[1])
  );
  const pagedNotes = notes.filter(n => n && typeof n.page === 'number' && Number.isFinite(n.page));
  const validPages = pagedNotes.filter(n => markersHere.has(String(n.page)));
  s.markers_in_window = markersHere.size;
  s.n_paged_footnotes = pagedNotes.length;
  s.page_valid_pct = pagedNotes.length ? Math.round(100 * validPages.length / pagedNotes.length) : null;

  // Prompt'un acikca yasakladigi iceriklerin sizmasi
  const blob = norm(flat(json));
  s.admin_leaks = ADMIN_LEAK.filter(k => blob.includes(norm(k)));
  s.filler_hits = FILLER.filter(k => blob.includes(norm(k)));

  // Dil uyumu (tr istenince gercekten Turkce mi?)
  if (lang === 'tr') {
    const trChars = (summary.match(/[çğıöşüÇĞİÖŞÜ]/g) || []).length;
    const trStop = (norm(summary).match(/\b(ve|bir|bu|ile|için|olarak|daha|gibi)\b/g) || []).length;
    s.lang_tr_signal = trChars + trStop;
    s.lang_ok = summary.length < 40 ? null : (trChars + trStop) >= 3;
  } else {
    s.lang_ok = null;
    s.lang_tr_signal = null;
  }

  return s;
}

// ---------------------------------------------------------------------------
// RAPOR
// ---------------------------------------------------------------------------
function avg(xs) {
  const v = xs.filter(x => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
const fmt = (x, d = 0) => (x == null ? '—' : (typeof x === 'number' ? x.toFixed(d) : String(x)));

function buildReport(meta, rows) {
  const L = [];
  L.push('# Acadex — map-pass karsilastirma raporu', '');
  L.push(`- Tarih: ${meta.startedAt}`);
  L.push(`- Girdi: \`${meta.input}\` (${meta.source}), ${meta.totalChars.toLocaleString('tr-TR')} karakter`);
  L.push(`- Pencere boyutu: ${meta.windowSize} krk — index.ts'ten okundu`);
  L.push(`- Test edilen pencere: ${meta.windowCount}, her kombinasyon ${meta.runs} kez`);
  L.push(`- Modeller: ${meta.models.join(', ')}`);
  L.push(`- Promptlar: ${meta.prompts.join(', ')}  (live = compactWindowPrompt, rich = buildChunkSystemPrompt)`);
  L.push(`- Pencereleme: ${meta.splits.join(', ')}  (char = production, paragraph = olu splitIntoChunks)`);
  L.push(`- Dil: ${meta.lang}`, '');

  // Kombinasyon ozeti
  const keyOf = r => `${r.model} | ${r.prompt} | ${r.split}`;
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(keyOf(r))) groups.set(keyOf(r), []);
    groups.get(keyOf(r)).push(r);
  }

  L.push('## Ozet tablo', '');
  L.push('| model | prompt | split | parse | gecikme ms | terim | temelli % | nokta | formul | diyagram | dipnot | sayfa gecerli % | admin sizint | filler |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, g] of groups) {
    const ok = g.filter(r => r.ok);
    const [model, prompt, split] = k.split(' | ');
    L.push('| ' + [
      model, prompt, split,
      `${ok.length}/${g.length}`,
      fmt(avg(g.map(r => r.latency))),
      fmt(avg(ok.map(r => r.score?.n_terms)), 1),
      fmt(avg(ok.map(r => r.score?.grounded_terms_pct))),
      fmt(avg(ok.map(r => r.score?.n_points)), 1),
      fmt(avg(ok.map(r => r.score?.n_formulas)), 1),
      fmt(avg(ok.map(r => r.score?.n_diagrams)), 1),
      fmt(avg(ok.map(r => r.score?.n_footnotes)), 1),
      fmt(avg(ok.map(r => r.score?.page_valid_pct))),
      String(ok.reduce((n, r) => n + (r.score?.admin_leaks?.length || 0), 0)),
      String(ok.reduce((n, r) => n + (r.score?.filler_hits?.length || 0), 0))
    ].join(' | ') + ' |');
  }
  L.push('');
  L.push('**temelli %** = cikarilan key_term\'lerin kaynak pencerede birebir gectigi oran. Dusukse model terim uyduruyor.');
  L.push('**sayfa gecerli %** = dipnotun iddia ettigi sayfa isaretcisinin o pencerede gercekten bulundugu oran. Dusukse atiflar guvenilmez.');
  L.push('');

  // Token / maliyet
  L.push('## Token kullanimi', '');
  L.push('| model | prompt | split | ort. girdi tok | ort. cikti tok | toplam cagri |');
  L.push('|---|---|---|---|---|---|');
  for (const [k, g] of groups) {
    const [model, prompt, split] = k.split(' | ');
    L.push('| ' + [model, prompt, split,
      fmt(avg(g.map(r => r.usage?.prompt_tokens))),
      fmt(avg(g.map(r => r.usage?.completion_tokens))),
      String(g.length)].join(' | ') + ' |');
  }
  L.push('', '> Birim fiyatlari Groq fiyat sayfasindan alip bu tablodaki token sayilariyla carpin — fiyatlar degistigi icin harness fiyat gommez.', '');

  // -------------------------------------------------------------------------
  // GERCEK HESAP LIMITLERI — mimari karari bu belirliyor.
  // index.ts'teki yorumlar gpt-oss-120b icin 8000 TPM "gozlemlendi" diyor.
  // Bu bolum o sayiyi dogrular veya curutur.
  // -------------------------------------------------------------------------
  L.push('## Gercek hesap limitleri (Groq yanit header\'larindan)', '');
  const byModel = new Map();
  for (const r of rows) {
    if (!byModel.has(r.model)) byModel.set(r.model, []);
    byModel.get(r.model).push(r);
  }
  L.push('| model | TPM limiti | RPM limiti | gorulen en dusuk kalan token | 429 sayisi |');
  L.push('|---|---|---|---|---|');
  const tpmByModel = new Map();
  for (const [model, g] of byModel) {
    const lim = g.map(r => r.limits).filter(Boolean);
    const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
    const tpm = lim.map(l => num(l.limit_tokens)).filter(v => v != null);
    const rpm = lim.map(l => num(l.limit_requests)).filter(v => v != null);
    const rem = lim.map(l => num(l.remaining_tokens)).filter(v => v != null);
    const tpmVal = tpm.length ? Math.min(...tpm) : null;
    tpmByModel.set(model, tpmVal);
    L.push('| ' + [
      model,
      tpmVal == null ? 'header yok' : tpmVal.toLocaleString('tr-TR'),
      rpm.length ? Math.min(...rpm).toLocaleString('tr-TR') : 'header yok',
      rem.length ? Math.min(...rem).toLocaleString('tr-TR') : '—',
      String(g.filter(r => r.rateLimited).length)
    ].join(' | ') + ' |');
  }
  L.push('');

  // Tek-cagrida kac pencere mumkun? (PIPELINE_BUDGET_MS = 110s)
  L.push('### Tek Edge cagrisinda kac pencere islenebilir?', '');
  L.push('| model | olculen token/pencere | TPM | dakikada pencere | 110 sn de pencere |');
  L.push('|---|---|---|---|---|');
  for (const [model, g] of byModel) {
    const ok = g.filter(r => r.usage);
    const perCall = avg(ok.map(r => (r.usage.prompt_tokens || 0) + (r.usage.completion_tokens || 0)));
    const tpm = tpmByModel.get(model);
    const perMin = (perCall && tpm) ? tpm / perCall : null;
    L.push('| ' + [
      model,
      fmt(perCall),
      tpm == null ? '—' : tpm.toLocaleString('tr-TR'),
      fmt(perMin, 2),
      perMin == null ? '—' : fmt(perMin * (110 / 60), 1)
    ].join(' | ') + ' |');
  }
  L.push('');
  L.push('> **Bu tablo ikinci PR\'in mimarisini belirliyor.** "110 sn de pencere" degeri');
  L.push('> MAX_CHUNKS (su an 12) degerinden kucukse, tam kapsama tek bir Edge');
  L.push('> cagrisinda MATEMATIKSEL OLARAK imkansizdir ve `document_chunks` tablosu +');
  L.push('> cok-cagrili resumable isleme zorunludur. Buyukse, erken-cikis kaldirilip');
  L.push('> eszamanlilik TPM\'e gore ayarlanarak tek cagrida cozulebilir.');
  L.push('');

  // Hatalar
  const failed = rows.filter(r => !r.ok);
  if (failed.length) {
    L.push('## Basarisiz cagrilar', '');
    for (const r of failed.slice(0, 40)) {
      L.push(`- \`${r.model}\` / ${r.prompt} / ${r.split} / pencere ${r.windowIndex + 1} / kosu ${r.run}: ${r.error}`);
    }
    L.push('');
  }

  // Temellendirme ihlalleri
  const ungrounded = rows.filter(r => r.ok && r.score?.ungrounded_terms?.length);
  if (ungrounded.length) {
    L.push('## Kaynakta bulunmayan terimler (ornekler)', '');
    for (const r of ungrounded.slice(0, 25)) {
      L.push(`- \`${r.model}\` / ${r.prompt} / pencere ${r.windowIndex + 1}: ${r.score.ungrounded_terms.map(t => `"${t}"`).join(', ')}`);
    }
    L.push('');
  }

  L.push('## Yan yana ozet metinleri', '');
  const byWindow = new Map();
  for (const r of rows.filter(x => x.ok && x.run === 1)) {
    if (!byWindow.has(r.windowIndex)) byWindow.set(r.windowIndex, []);
    byWindow.get(r.windowIndex).push(r);
  }
  for (const [wi, rs] of [...byWindow].sort((a, b) => a[0] - b[0])) {
    L.push(`### Pencere ${wi + 1}`, '');
    for (const r of rs) {
      L.push(`**${r.model} / ${r.prompt} / ${r.split}**`, '');
      L.push('> ' + String(r.json?.summary || r.json?.chunk_summary || '(ozet yok)').replace(/\n+/g, ' ').slice(0, 900), '');
    }
  }

  L.push('---', '', 'Ham ciktilar `raw/` altinda. Harness promptlari index.ts\'ten calisma aninda okur.');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv);
  const src = readSource();

  // Production sabitleri — kaynaktan
  const MODEL_HEAVY = extractConst(src, 'MODEL_HEAVY');
  const MODEL_FAST = extractConst(src, 'MODEL_FAST');
  const MAX_CHUNKS = extractConst(src, 'MAX_CHUNKS', { numeric: true });
  const CHUNK_TARGET_SIZE = extractConst(src, 'CHUNK_TARGET_SIZE', { numeric: true });
  const windowSizeMatch = src.match(/const\s+WINDOW\s*=\s*(\d+)/);
  if (!windowSizeMatch) throw new Error('Canli WINDOW sabiti bulunamadi — harness guncellenmeli.');
  const WINDOW = parseInt(windowSizeMatch[1], 10);

  const models = opts.models || [MODEL_HEAVY, MODEL_FAST];
  const prompts = opts.prompts || ['live', 'rich'];
  const splits = opts.split || ['char', 'paragraph'];
  for (const p of prompts) if (!['live', 'rich'].includes(p)) throw new Error(`--prompts degeri live|rich olmali: ${p}`);
  for (const s of splits) if (!['char', 'paragraph'].includes(s)) throw new Error(`--split degeri char|paragraph olmali: ${s}`);

  const livePrompt = prompts.includes('live') ? getLivePromptFactory(src) : null;
  const richPrompt = prompts.includes('rich') ? getRichPromptFactory(src) : null;

  const pageMarkerLabel = 'SAYFA';
  const langLabel = opts.lang === 'tr' ? 'Turkish / Türkçe' : 'English';
  const { text, source } = loadText(opts.input, pageMarkerLabel);
  if (!text.trim()) throw new Error('Girdiden metin cikarilamadi.');

  const winSets = {};
  if (splits.includes('char')) winSets.char = windowsByChar(text, WINDOW, MAX_CHUNKS);
  if (splits.includes('paragraph')) winSets.paragraph = windowsByParagraph(text, CHUNK_TARGET_SIZE, MAX_CHUNKS);

  const windowCount = Math.min(opts.windows, ...Object.values(winSets).map(w => w.length));
  if (windowCount < 1) throw new Error('Test edilecek pencere olusmadi.');

  console.log(`Kaynak sabitleri: WINDOW=${WINDOW} MAX_CHUNKS=${MAX_CHUNKS} CHUNK_TARGET_SIZE=${CHUNK_TARGET_SIZE}`);
  console.log(`MODEL_HEAVY=${MODEL_HEAVY}  MODEL_FAST=${MODEL_FAST}`);
  console.log(`Metin: ${text.length.toLocaleString('tr-TR')} krk (${source})`);
  for (const [k, w] of Object.entries(winSets)) console.log(`  ${k}: ${w.length} pencere olustu, ${windowCount} tanesi test edilecek`);
  const totalCalls = models.length * prompts.length * splits.length * windowCount * opts.runs;
  console.log(`Planlanan cagri sayisi: ${totalCalls}\n`);

  if (opts.dryRun) {
    const sampleLive = livePrompt ? livePrompt(0, windowCount, langLabel) : null;
    const sampleRich = richPrompt ? richPrompt(0, windowCount, langLabel, true, pageMarkerLabel) : null;
    if (sampleLive) console.log(`live prompt: ${sampleLive.length} krk, ilk satir: ${sampleLive.split('\n')[0]}`);
    if (sampleRich) console.log(`rich prompt: ${sampleRich.length} krk, ilk satir: ${sampleRich.split('\n')[0]}`);
    console.log('\n--dry-run: Groq cagrisi yapilmadi. Promptlar ve pencereleme dogrulandi.');
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY ortam degiskeni yok. export GROQ_API_KEY=gsk_...');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(opts.out, `map-compare-${stamp}`);
  fs.mkdirSync(path.join(outDir, 'raw'), { recursive: true });

  const rows = [];
  let done = 0;
  for (const split of splits) {
    for (let wi = 0; wi < windowCount; wi++) {
      const windowText = winSets[split][wi];
      for (const prompt of prompts) {
        const sys = prompt === 'live'
          ? livePrompt(wi, winSets[split].length, langLabel)
          : richPrompt(wi, winSets[split].length, langLabel, true, pageMarkerLabel);
        for (const model of models) {
          for (let run = 1; run <= opts.runs; run++) {
            const res = await callGroq(apiKey, model, sys, windowText, 3072, 60000);
            done++;
            const row = {
              model, prompt, split, windowIndex: wi, run,
              ok: res.ok, latency: res.latency, error: res.error || null,
              usage: res.usage, limits: res.limits || null, rateLimited: !!res.rateLimited,
              json: res.ok ? res.json : null,
              score: res.ok ? scoreOutput(res.json, windowText, opts.lang, pageMarkerLabel) : null
            };
            rows.push(row);
            const tag = `${model.replace(/[^\w.-]/g, '_')}__${prompt}__${split}__w${wi + 1}__r${run}`;
            fs.writeFileSync(path.join(outDir, 'raw', `${tag}.json`),
              JSON.stringify({ model, prompt, split, windowIndex: wi, run, result: res }, null, 2));
            const mark = res.ok ? 'ok' : 'HATA';
            const extra = res.ok
              ? `terim=${row.score.n_terms} temelli=${row.score.grounded_terms_pct ?? '—'}% dipnot=${row.score.n_footnotes}`
              : res.error;
            console.log(`[${done}/${totalCalls}] ${mark}  ${model} ${prompt}/${split} w${wi + 1} r${run} ${res.latency}ms  ${extra}`);
          }
        }
      }
    }
  }

  const meta = {
    startedAt: new Date().toISOString(), input: opts.input, source,
    totalChars: text.length, windowSize: WINDOW, windowCount,
    runs: opts.runs, models, prompts, splits, lang: opts.lang
  };
  const report = buildReport(meta, rows);
  fs.writeFileSync(path.join(outDir, 'report.md'), report);
  fs.writeFileSync(path.join(outDir, 'rows.json'), JSON.stringify({ meta, rows }, null, 2));
  console.log(`\nRapor: ${path.join(outDir, 'report.md')}`);
  console.log(`Ham cikti: ${path.join(outDir, 'raw')}`);
}

main().catch(e => { console.error('\nHATA:', e.message); process.exit(1); });
