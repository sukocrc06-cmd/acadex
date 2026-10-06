import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { extractText, getDocumentProxy } from "npm:unpdf"
import mammoth from "npm:mammoth@1.6.0"
import JSZip from "npm:jszip@3.10.1"

// ==========================================================================
// chat-with-document
//
// NotebookLM-style "chat with your source" feature. Unlike the general
// Acadia assistant (supabase/functions/acadia-chat), which explicitly has NO
// access to a student's uploaded files, this function re-extracts the exact
// text of the study card's source document(s) on every call and instructs
// the model to answer ONLY from that text — grounded Q&A with inline
// citation markers ([1], [2], ...) that mirror the same footnote format
// already used for study card summaries/key points, so the existing
// formatFootnoteMarkers()/showFootnoteToast() client-side helpers work
// unchanged for chat answers too.
//
// No new database tables/columns are needed: conversation history lives in
// the browser tab only (same privacy model as Acadia) and source text is
// re-extracted per request rather than cached, trading a little latency for
// zero schema/storage changes.
// ==========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// timeoutMs bounds EACH individual attempt via AbortController — without
// this, a slow/hanging call (e.g. a vision model chewing on a large image)
// can silently eat the whole request's time budget, leaving no room for a
// text-only fallback attempt afterward and surfacing as a generic network
// exception rather than a clean, fast failure we can recover from.
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2, timeoutMs = 25000): Promise<Response> {
  let lastRateLimitedResponse: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) return response;
      if (response.status === 429) {
        // Rate limited. Log the actual reason (e.g. Groq's TPM-exceeded
        // message) so it's visible in the function logs without a separate
        // dashboard lookup, keep this response so we can return it (instead
        // of throwing an opaque error) if every attempt is exhausted, then
        // wait longer before retrying.
        lastRateLimitedResponse = response;
        let bodyPreview = "";
        try { bodyPreview = await response.clone().text(); } catch (_readErr) { /* ignore — body may not be readable twice in all runtimes */ }
        console.warn(`fetchWithRetry: 429 rate-limited (attempt ${attempt + 1}/${maxRetries + 1}): ${bodyPreview}`);
        // Two distinct Groq 429 shapes here: "Request too large ... Requested
        // X" (this single request's own tokens exceed the limit — shrinking
        // it helps, waiting doesn't) vs. "Rate limit reached ... Used X,
        // Requested Y. Please try again in Z s" (the per-minute window is
        // already spent from earlier calls — no amount of shrinking this
        // request helps until the window rolls over, so we must actually
        // wait). Parse Groq's own suggested wait time when present.
        const retryAfterMatch = bodyPreview.match(/try again in ([\d.]+)s/i);
        const waitMs = retryAfterMatch
          ? Math.min(Math.ceil(parseFloat(retryAfterMatch[1]) * 1000) + 500, 30000)
          : 2500;
        await new Promise(r => setTimeout(r, waitMs));
      } else if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 800));
      } else {
        return response;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  if (lastRateLimitedResponse) return lastRateLimitedResponse;
  throw new Error("Max retries exceeded");
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parsePptxSlideXml(slideXml: string): string {
  const matches = slideXml.matchAll(/<a:t>(.*?)<\/a:t>/g);
  let text = "";
  for (const match of matches) {
    text += decodeXmlEntities(match[1]) + " ";
  }
  return text.trim();
}

function parseDocxHtmlContent(html: string): string {
  if (!html) return "";
  let processed = html;
  processed = processed.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (_m, content) => {
    const clean = content.replace(/<[^>]+>/g, "").trim();
    return clean ? `\n\n## ${clean}\n\n` : "";
  });
  processed = processed.replace(/<\/p>/gi, "\n");
  processed = processed.replace(/<br\s*\/?>/gi, "\n");
  processed = processed.replace(/<\/div>/gi, "\n");
  processed = processed.replace(/<[^>]+>/g, "");
  processed = processed
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  return processed.replace(/\n{3,}/g, "\n\n").trim();
}

async function tryOCR(fileBytes: Uint8Array, apiKey: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([fileBytes], { type: 'application/pdf' });
  formData.append('file', blob, 'document.pdf');
  formData.append('apikey', apiKey);
  formData.append('filetype', 'PDF');
  formData.append('OCREngine', '2');
  formData.append('isOverlayRequired', 'false');

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
  });
  const result = await response.json();
  if (result.IsErroredOnProcessing) {
    throw new Error(result.ErrorMessage?.[0] || 'OCR processing failed');
  }
  return (result.ParsedResults ?? []).map((r: any) => r.ParsedText).join('\n\n');
}

// Extracts plain text from one document row's file bytes based on its mime type.
// Deliberately text-only (no vision/image analysis) to keep per-message latency
// and cost low — the visual analysis pass already ran once at summarization time.
/**
 * Read a document's text from document_chunks instead of re-downloading and
 * re-parsing the original file.
 *
 * Before this existed, every chat message against a 60-page PDF cost a full
 * storage download plus a full unpdf parse — repeated work on bytes that
 * never change. summarize-document now persists the text once, at extraction
 * time, so the normal path here is a single indexed SELECT.
 *
 * Returns null (not an error) when the document has no stored chunks, which
 * is the expected case for anything uploaded before the document_chunks
 * migration was applied. The caller then falls back to on-demand extraction,
 * so older documents keep working exactly as they did.
 */
async function loadStoredText(serviceClient: any, documentId: string): Promise<string | null> {
  try {
    const { data, error } = await serviceClient
      .from('document_chunks')
      .select('text, chunk_index')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })
    if (error) {
      // A missing table (migration not yet applied) lands here too — warn
      // once and fall back rather than failing the student's question.
      console.warn(`document_chunks read failed for ${documentId}: ${error.message}`)
      return null
    }
    if (!data || data.length === 0) return null
    const joined = data.map((r: any) => String(r.text || '')).filter(Boolean).join('\n\n').trim()
    return joined || null
  } catch (e) {
    console.warn('document_chunks read threw, falling back to extraction:', e)
    return null
  }
}

// ==========================================================================
// RETRIEVAL — send the passages that answer the question, not the document
//
// The old behaviour assembled the whole document and cut it at 100,000
// characters (~45 dense pages). On a longer source a question about page 70
// reached a model that had never been shown page 70, so it answered "this
// isn't in the source" — the one failure mode a grounded Q&A feature must
// not have, because it is indistinguishable from an honest "not found".
//
// Now: for documents that do not fit, rank the stored chunks against the
// question (Postgres full-text, see the 20261003b migration) and send the
// best ones. Documents that DO fit are sent whole exactly as before, so the
// common case has no behaviour change at all.
// ==========================================================================

// ==========================================================================
// HOW MUCH SOURCE TEXT ACTUALLY FITS
//
// This used to be a pair of flat 50,000-character constants, chosen as "well
// under the old 100,000". Measured against the account's real limit on
// 05.10.2026 they are not under anything:
//
//   Groq TPM, per model .......... 8,000 tokens / minute
//   estimateTokens ratio ......... 3.2 characters per token
//   this call's completion cap .... 2,048 tokens
//
//   50,000 chars = 15,625 tokens + 2,048 completion = 17,673  -> 2.2x the cap
//   31,817 chars (Cognitive Dissonance, a real test document)
//               =  9,943 tokens + 2,048 completion = 11,991  -> over the cap
//   11,050 chars (economy chapter 20)
//               =  3,453 tokens + 2,048 completion =  5,501  -> fits
//
// So the two constants left a DEAD ZONE: a document between roughly 19,000
// and 50,000 characters was sent whole (too big for the minute's budget, so
// Groq answers "Request too large") while retrieval stood by, because its
// trigger was "bigger than 50,000". The only documents that worked were the
// small ones, which is exactly what got tested.
//
// The budget is now derived instead of declared, and derived PER REQUEST,
// because the two things competing with the source text for the same 8,000
// tokens both vary: the system prompt grows with the study-card context
// block, and the conversation history grows with the chat.
//
// Deliberately NOT the summarize function's TokenPacer. That paces by
// WAITING — up to 60 seconds for the window to roll — which is right for a
// background job and wrong for a student watching a chat box. Here the fix
// is to make the request fit in the first place; genuine contention between
// several students still falls to fetchWithRetry's 429 handling, which waits
// the seconds Groq actually asks for rather than a fixed minute.
// ==========================================================================
const CHAT_TPM_LIMIT = 8000
// Headroom for the 3.2 ratio being an estimate while Groq counts the real
// tokenisation (Turkish runs denser than English, so it undershoots there).
//
// 0.9, not a fresh guess: this is the summarize function's PACER_SAFETY, and
// that one is evidence rather than taste — every measured run logs its spend
// against the resulting 7,200 ceiling ("used=6226/7200") and not one of them
// has come back "Request too large". A tighter 0.85 was tried here first and
// pushed the 11,050-character economy chapter — a document that demonstrably
// fits today — over into retrieval, which is a capability lost to a number
// nobody had measured.
const CHAT_TPM_SAFETY = 0.9
// The ceiling for a chat answer. 2,048 is 28% of the whole minute, reserved
// on every message whether or not the answer could possibly need it: Groq
// counts max_completion_tokens against TPM up front, not what the model
// actually emits. A plain conceptual answer runs a few hundred tokens.
//
// So it follows the same signal as the instruction sections — the questions
// that need the long rules (a worked numeric solution, a Mermaid diagram)
// are the questions whose answers are long. Everything else gets the lower
// cap, and the difference goes to the document.
const CHAT_MAX_COMPLETION = 2048
const CHAT_MAX_COMPLETION_SHORT = 1024
// DERIVED FROM THE TEXT, not one number for everything.
//
// Which way an error hurts is worth being precise about:
//
//   real tokens = chars / real ratio
//   our estimate = chars / CHARS_PER_TOKEN
//
//   CHARS_PER_TOKEN above the real ratio -> we UNDERestimate -> the request
//     is bigger than we think -> "Request too large"
//   below it -> we overestimate -> we send less document than we could
//
// So the constant has to sit under the LOWEST real ratio we will meet. Two
// measurements from usage.prompt_tokens, both English sources with Turkish
// questions:
//
//   4.18 krk/token  (economy chapter)
//   4.69 krk/token  (accounting chapter)
//
// A single number cannot serve both languages, and that is the whole
// problem: Turkish tokenises denser, so its ratio is LOWER, and a constant
// tuned to English would underestimate exactly when a Turkish document
// arrives — which is what the note-sharing in this product is for.
//
// Measured Turkish-letter density, real files: English sources 0.00%-0.18%,
// Turkish course notes 14.2%. Seventy times apart, so a 2% threshold
// separates them with room to spare. A Turkish question over an English
// document reads 0.56% and is correctly treated as English, which is right —
// the source text, not the question, is what fills the window.
//
// 4.1 for English sits under the lower of the two measurements. 3.2 for
// Turkish is NOT measured — it is the old inherited value kept as the
// cautious end until a Turkish document gives us a real number, which the
// per-call ratio log will.
const CHARS_PER_TOKEN_EN = 4.1
const CHARS_PER_TOKEN_TR = 3.2
const TURKISH_LETTER_SHARE = 0.02

function charsPerTokenFor(sampleText: string): number {
  const text = String(sampleText || '')
  const turkish = (text.match(/[ğüşıöçĞÜŞİÖÇ]/g) || []).length
  const letters = (text.match(/\p{L}/gu) || []).length
  if (letters < 200) return CHARS_PER_TOKEN_TR   // too little to judge — be cautious
  return (turkish / letters) >= TURKISH_LETTER_SHARE ? CHARS_PER_TOKEN_TR : CHARS_PER_TOKEN_EN
}

// Kept for the call sites that only need a safe default.
const CHARS_PER_TOKEN = CHARS_PER_TOKEN_TR
// An attached image is billed as tokens too and is not in any string we can
// measure. Reserved whenever one is present.
const IMAGE_TOKEN_RESERVE = 1600
// Never send less than this, even if the overhead calculation says so — a
// couple of pages is the floor below which an answer is not worth attempting,
// and at that point the honest outcome is a short prompt, not an empty one.
const SOURCE_MIN_CHARS = 4000

/**
 * Characters of source text this particular request can afford.
 *
 * overheadChars covers everything else that goes into the same budget: the
 * system prompt minus the source block, and the conversation history.
 */
function sourceBudgetChars(
  overheadChars: number,
  hasImage: boolean,
  maxCompletion = CHAT_MAX_COMPLETION,
  charsPerToken = CHARS_PER_TOKEN
): number {
  const available =
    CHAT_TPM_LIMIT * CHAT_TPM_SAFETY
    - maxCompletion
    - Math.ceil(overheadChars / charsPerToken)
    - (hasImage ? IMAGE_TOKEN_RESERVE : 0)
  return Math.max(SOURCE_MIN_CHARS, Math.floor(available * charsPerToken))
}

const RETRIEVED_MAX_CHUNKS = 40

// Words too common to tell one passage from another. Short list on purpose:
// ts_rank already discounts frequent terms, this just keeps the query tidy.
const QUERY_STOPWORDS = new Set([
  'nedir', 'nasil', 'nasıl', 'nicin', 'niçin', 'neden', 'hangi', 'kimdir',
  'misin', 'mısın', 'bana', 'bunu', 'sunu', 'şunu', 'bunlar', 'daha', 'gibi',
  'icin', 'için', 'ile', 'olan', 'olarak', 'anlat', 'aciklar', 'açıklar',
  'aciklama', 'açıklama', 'ozetle', 'özetle', 'soyle', 'söyle', 'lutfen',
  'lütfen', 'kisaca', 'kısaca', 'yukarida', 'yukarıda', 'belge', 'belgede',
  'kaynak', 'kaynakta', 'sayfa', 'konu', 'hakkinda', 'hakkında',
  'what', 'which', 'where', 'when', 'explain', 'about', 'please', 'tell',
  'does', 'this', 'that', 'from', 'with', 'document', 'source', 'page'
])

/**
 * Turn a student's question into tsquery syntax: an OR of its content words.
 *
 * OR rather than AND on purpose — websearch_to_tsquery() ANDs terms, which
 * on a full sentence ("marjinal maliyet egrisi neden U biciminde?") matches
 * nothing at all. ORing and letting ts_rank_cd sort by how many terms hit
 * gives recall first and precision from the ranking.
 *
 * Everything that is not a letter or digit is stripped before the terms are
 * joined, so no user input can reach to_tsquery as operator syntax — a
 * question containing "&", "|", "!" or "(" cannot change the query's shape
 * or break it.
 */
// ==========================================================================
// TURKISH QUESTION OVER AN ENGLISH SOURCE
//
// This is the normal case here, not an edge case: every department in the
// business faculty teaches in English, so the PDFs are English and the
// students ask in Turkish. Retrieval matched the question's own words
// against the chunks, so it was comparing Turkish to English and losing.
// Measured 05.10.2026:
//
//   "Ben Franklin etkisi nedir?"      -> 2 chunks  (only because "Franklin"
//                                        is a proper noun and survives)
//   "makro ekonominin temeli nedir"   -> 0 chunks
//
// Zero matches is not a quiet degradation. It drops the whole question to
// the whole-document path, and on anything long that means the first N
// characters — a student asking about page 40 gets page 1.
//
// Three deterministic layers, no model call, nothing drawn from the daily
// quota. Each one only ADDS candidates to an OR query, so a wrong guess
// costs a term that matches nothing, while a right one rescues the question.
// ==========================================================================

/**
 * Strip Turkish inflection so "ekonominin", "ekonomiyi" and "ekonomide" all
 * reach "ekonomi" — the form the glossary below is keyed on.
 *
 * Turkish is agglutinative: the suffixes stack, so this strips repeatedly,
 * longest first. The stem floor stops it eating short words down to nothing.
 */
const TR_SUFFIXES = [
  'lerinden', 'larindan', 'larından', 'lerinde', 'larinda', 'larında',
  'lerini', 'larini', 'larını', 'lerin', 'larin', 'ların', 'leri', 'lari', 'ları',
  'ndan', 'dan', 'den', 'tan', 'ten', 'nin', 'nın', 'nun', 'nün',
  'ler', 'lar', 'nda', 'nde', 'da', 'de', 'ta', 'te',
  'in', 'ın', 'un', 'ün', 'si', 'sı', 'su', 'sü', 'yi', 'yı', 'yu', 'yü',
  'le', 'la', 'i', 'ı', 'u', 'ü', 'e', 'a'
]

/** Stem-final softening reverts once the suffix is gone: "işsizliği" -> "işsizlik". */
function unsoften(w: string): string {
  return w.replace(/ğ$/, 'k').replace(/b$/, 'p').replace(/c$/, 'ç').replace(/d$/, 't')
}

/**
 * ALL the stems a word can reach, not just the shortest one.
 *
 * A single greedy stem was the first version and it lost the two most common
 * words in the test questions, both by overshooting the form the glossary is
 * keyed on:
 *
 *   ekonominin -> ekonomi -> ekonom     "ekonomi" is the glossary key, and
 *                                       the extra pass threw away "economy"
 *   enflasyonun -> enflasyo             longest-first matched "nun", but the
 *                                       n belongs to the stem; "un" gives
 *                                       "enflasyon" -> "inflation"
 *
 * Both failures are the same shape: committing to one strip. So every
 * applicable suffix is tried at every level and all the intermediate forms
 * are kept. The set is small (a Turkish word rarely yields more than a
 * handful) and a wrong stem only contributes a term that matches nothing.
 */
function turkishStemCandidates(word: string): string[] {
  const seen = new Set<string>([word])
  let frontier = [word]
  for (let depth = 0; depth < 3; depth++) {
    const next: string[] = []
    for (const w of frontier) {
      for (const suf of TR_SUFFIXES) {
        if (w.length - suf.length >= 4 && w.endsWith(suf)) {
          const cut = w.slice(0, -suf.length)
          for (const form of [cut, unsoften(cut)]) {
            if (!seen.has(form)) { seen.add(form); next.push(form) }
          }
        }
      }
    }
    if (next.length === 0) break
    frontier = next
  }
  seen.delete(word)
  return [...seen]
}

/** The single most likely stem — for callers that want one form, not the set. */
function turkishStem(word: string): string {
  const all = turkishStemCandidates(word)
  // The glossary is the best evidence we have about where the word ends.
  for (const s of all) if (TR_EN_TERMS[s]) return s
  return all.length ? all.reduce((a, b) => (a.length >= b.length ? a : b)) : word
}

/**
 * Regular orthographic correspondences for the Latinate vocabulary both
 * languages borrowed. These are genuinely rule-like, unlike the glossary
 * below which is word-by-word because the words are not related at all.
 */
function cognateCandidates(stem: string): string[] {
  const out: string[] = []
  const rules: Array<[RegExp, string]> = [
    [/syon$/, 'tion'],     // deflasyon -> deflation, pozisyon -> position
    [/zyon$/, 'sion'],     // revizyon -> revision
    [/izm$/, 'ism'],       // kapitalizm -> capitalism
    [/loji$/, 'logy'],     // teknoloji -> technology
    [/lojik$/, 'logic'],
    [/ik$/, 'ic'],         // ekonomik -> economic
    [/if$/, 'ive']         // aktif -> active
  ]
  for (const [re, rep] of rules) {
    if (re.test(stem)) out.push(stem.replace(re, rep))
  }
  return out
}

/**
 * Turkish -> English for the vocabulary of this faculty (economics,
 * accounting, finance, management, marketing, information systems).
 *
 * Word-by-word on purpose: "arz" and "supply" share nothing to derive from.
 * Values are arrays because one Turkish word often covers two English ones
 * and an OR query can afford both.
 */
const TR_EN_TERMS: Record<string, string[]> = {
  // iktisat
  'ekonomi': ['economy', 'economics'], 'iktisat': ['economics'],
  'makro': ['macro', 'macroeconomics'], 'mikro': ['micro', 'microeconomics'],
  'arz': ['supply'], 'talep': ['demand'], 'piyasa': ['market'], 'pazar': ['market'],
  'enflasyon': ['inflation'], 'deflasyon': ['deflation'], 'stagflasyon': ['stagflation'],
  'issizlik': ['unemployment'], 'işsizlik': ['unemployment'], 'istihdam': ['employment'],
  'buyume': ['growth'], 'büyüme': ['growth'], 'durgunluk': ['recession', 'slump'],
  'resesyon': ['recession'], 'daralma': ['contraction'], 'genisleme': ['expansion'],
  'genişleme': ['expansion'], 'bunalim': ['depression'], 'bunalım': ['depression'],
  'kriz': ['crisis'], 'cevrim': ['cycle'], 'çevrim': ['cycle'], 'konjonktur': ['cycle'],
  'uretim': ['production', 'output'], 'üretim': ['production', 'output'],
  'cikti': ['output'], 'çıktı': ['output'], 'girdi': ['input'],
  'milli': ['national'], 'gelir': ['income', 'revenue'], 'harcama': ['spending', 'expenditure'],
  'tasarruf': ['savings'], 'yatirim': ['investment'], 'yatırım': ['investment'],
  'tuketim': ['consumption'], 'tüketim': ['consumption'], 'hanehalki': ['household'],
  'hanehalkı': ['household'], 'hane': ['household'], 'firma': ['firm', 'company'],
  'devlet': ['government'], 'hukumet': ['government'], 'hükümet': ['government'],
  'maliye': ['fiscal'], 'parasal': ['monetary'], 'para': ['money', 'monetary'],
  'politika': ['policy'], 'vergi': ['tax', 'taxation'], 'faiz': ['interest'],
  'merkez': ['central'], 'banka': ['bank'], 'tahvil': ['bond'], 'bono': ['bond'],
  'hisse': ['share', 'stock'], 'senet': ['note', 'security'], 'temettu': ['dividend'],
  'temettü': ['dividend'], 'fiyat': ['price'], 'duzey': ['level'], 'düzey': ['level'],
  'seviye': ['level'], 'oran': ['rate', 'ratio'], 'denge': ['equilibrium', 'balance'],
  'esneklik': ['elasticity'], 'verim': ['yield', 'efficiency'],
  // muhasebe / finans
  'muhasebe': ['accounting'], 'bilanco': ['balance'], 'bilanço': ['balance'],
  'varlik': ['asset'], 'varlık': ['asset'], 'borc': ['debt', 'liability'],
  'borç': ['debt', 'liability'], 'yukumluluk': ['liability'], 'yükümlülük': ['liability'],
  'ozkaynak': ['equity'], 'özkaynak': ['equity'], 'sermaye': ['capital'],
  'kar': ['profit'], 'kâr': ['profit'], 'zarar': ['loss'], 'maliyet': ['cost'],
  'gider': ['expense'], 'nakit': ['cash'], 'akis': ['flow'], 'akış': ['flow'],
  'stok': ['inventory', 'stock'], 'envanter': ['inventory'], 'amortisman': ['depreciation'],
  'defter': ['ledger', 'book'], 'kayit': ['record', 'entry'], 'kayıt': ['record', 'entry'],
  'fatura': ['invoice'], 'alacak': ['receivable'], 'satis': ['sales'], 'satış': ['sales'],
  'satin': ['purchase'], 'satın': ['purchase'], 'iskonto': ['discount'],
  'indirim': ['discount'], 'navlun': ['freight'], 'sigorta': ['insurance'],
  'deger': ['value'], 'değer': ['value'], 'degerleme': ['valuation'], 'değerleme': ['valuation'],
  'butce': ['budget'], 'bütçe': ['budget'], 'denetim': ['audit'], 'raporlama': ['reporting'],
  // yonetim / pazarlama / MIS
  'yonetim': ['management'], 'yönetim': ['management'], 'orgut': ['organization'],
  'örgüt': ['organization'], 'strateji': ['strategy'], 'karar': ['decision'],
  'surec': ['process'], 'süreç': ['process'], 'musteri': ['customer'], 'müşteri': ['customer'],
  'pazarlama': ['marketing'], 'marka': ['brand'], 'urun': ['product'], 'ürün': ['product'],
  'hizmet': ['service'], 'rekabet': ['competition'], 'tedarik': ['supply', 'procurement'],
  'bilgi': ['information', 'knowledge'], 'veri': ['data'], 'sistem': ['system'],
  'yazilim': ['software'], 'yazılım': ['software'], 'donanim': ['hardware'],
  'donanım': ['hardware'], 'veritabani': ['database'], 'veritabanı': ['database'],
  'guvenlik': ['security'], 'güvenlik': ['security'], 'ag': ['network'], 'ağ': ['network'],
  // genel akademik
  'tanim': ['definition'], 'tanım': ['definition'], 'ornek': ['example'], 'örnek': ['example'],
  'fark': ['difference'], 'etki': ['effect', 'impact'], 'neden': ['cause'], 'sonuc': ['result'],
  'sonuç': ['result'], 'avantaj': ['advantage'], 'dezavantaj': ['disadvantage'],
  'ozellik': ['feature', 'characteristic'], 'özellik': ['feature', 'characteristic'],
  'amac': ['purpose', 'objective'], 'amaç': ['purpose', 'objective'],
  'yontem': ['method'], 'yöntem': ['method'], 'kuram': ['theory'], 'teori': ['theory'],
  'model': ['model'], 'varsayim': ['assumption'], 'varsayım': ['assumption'],
  'olcum': ['measurement'], 'ölçüm': ['measurement'], 'hesap': ['account', 'calculation'],
  'tablo': ['table'], 'grafik': ['chart', 'graph'], 'sekil': ['figure'], 'şekil': ['figure'],
  'bolum': ['chapter', 'section'], 'bölüm': ['chapter', 'section'],
  'temel': ['basis', 'foundation', 'fundamental'], 'ilke': ['principle'],
  'kural': ['rule'], 'asama': ['stage', 'phase'], 'aşama': ['stage', 'phase'],
  'tur': ['type', 'kind'], 'tür': ['type', 'kind'], 'cesit': ['type'], 'çeşit': ['type'],
  'artis': ['increase'], 'artış': ['increase'], 'azalis': ['decrease'], 'azalış': ['decrease'],
  'dusus': ['decline', 'decrease'], 'düşüş': ['decline', 'decrease'],
  'yuzde': ['percent', 'percentage'], 'yüzde': ['percent', 'percentage'],
  'donem': ['period'], 'dönem': ['period'], 'yil': ['year'], 'yıl': ['year'],
  'ceyrek': ['quarter'], 'çeyrek': ['quarter'], 'toplam': ['total', 'aggregate'],
  'ortalama': ['average'], 'agirlikli': ['weighted'], 'ağırlıklı': ['weighted']
}

/** Every English candidate a Turkish word can reach. */
function englishCandidatesFor(word: string): string[] {
  const out = new Set<string>()
  // Every candidate stem, not one: see turkishStemCandidates.
  for (const form of [word, ...turkishStemCandidates(word)]) {
    for (const t of TR_EN_TERMS[form] || []) out.add(t)
  }
  // Cognate rules only on the word and its likeliest stem — applying them to
  // every candidate produces noise like "arasindak" -> nothing useful.
  for (const form of [word, turkishStem(word)]) {
    for (const c of cognateCandidates(form)) out.add(c)
  }
  return [...out]
}

function buildChunkTsQuery(questionText: string): string | null {
  const words = String(questionText || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !QUERY_STOPWORDS.has(w))

  const terms: string[] = []
  for (const w of words) {
    // The original word first: proper nouns ("Franklin"), English questions,
    // and Turkish sources all depend on it, and it is the only term we are
    // certain the student meant.
    terms.push(w)
    // Then the stem, which catches a Turkish source where the chunk happens
    // to carry a different inflection of the same word.
    const stem = turkishStem(w)
    if (stem !== w && stem.length >= 3) terms.push(stem)
    // Then the bridge to English.
    for (const en of englishCandidatesFor(w)) terms.push(en)
  }

  // Cap raised from 24: each original word can now contribute two or three
  // candidates, and cutting at 24 would silently drop the English half of a
  // longer question — the half that does the matching.
  const unique = [...new Set(terms)].filter(t => t.length >= 3).slice(0, 60)
  if (unique.length === 0) return null
  return unique.join(' | ')
}

/** Per-document chunk sizes, cheap enough to ask before deciding strategy. */
async function loadChunkSizes(
  serviceClient: any,
  documentId: string
): Promise<{ count: number; totalChars: number } | null> {
  try {
    const { data, error } = await serviceClient
      .from('document_chunks')
      .select('char_count')
      .eq('document_id', documentId)
    if (error || !data || data.length === 0) return null
    return {
      count: data.length,
      totalChars: data.reduce((n: number, r: any) => n + (Number(r.char_count) || 0), 0)
    }
  } catch (_e) {
    return null
  }
}

/**
 * Rank a document's chunks against the question. Returns [] when nothing
 * matched and null when the search itself was unavailable (RPC missing
 * because the migration has not been run yet, for instance) — the caller
 * treats those differently: no matches is an answer, an unavailable search
 * means fall back to sending the document.
 */
async function retrieveRelevantChunks(
  serviceClient: any,
  documentIds: string[],
  tsquery: string
): Promise<any[] | null> {
  try {
    const { data, error } = await serviceClient.rpc('search_document_chunks', {
      p_document_ids: documentIds,
      p_tsquery: tsquery,
      p_limit: RETRIEVED_MAX_CHUNKS
    })
    if (error) {
      console.warn(`search_document_chunks unavailable (${error.message}) — falling back to whole document`)
      return null
    }
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.warn('search_document_chunks threw, falling back:', e)
    return null
  }
}

/**
 * Assemble retrieved chunks into prompt context.
 *
 * Selection is by relevance, but the assembled text is re-sorted into
 * READING order: a model handed passages in rank order sees page 70 before
 * page 12 and reasons about the document as if it were shuffled. Page labels
 * are included so the model can say where an answer came from.
 */
function assembleRetrieved(rows: any[], charBudget: number): { text: string; used: number; pages: number[] } {
  const picked: any[] = []
  let used = 0
  for (const r of rows) {
    const t = String(r?.text || '')
    if (!t) continue
    if (used + t.length > charBudget && picked.length > 0) break
    picked.push(r)
    used += t.length
  }
  picked.sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
  const pages: number[] = []
  const parts = picked.map(r => {
    const ps = (typeof r.page_start === 'number') ? r.page_start : null
    const pe = (typeof r.page_end === 'number') ? r.page_end : null
    if (ps !== null && !pages.includes(ps)) pages.push(ps)
    const label = ps === null ? '' : (pe !== null && pe !== ps ? `[Sayfa ${ps}-${pe}]\n` : `[Sayfa ${ps}]\n`)
    return `${label}${String(r.text || '').trim()}`
  })
  return { text: parts.join('\n\n'), used, pages }
}

async function extractDocumentText(serviceClient: any, doc: any): Promise<string> {
  const { data: fileBlob, error: downloadError } = await serviceClient.storage
    .from('documents')
    .download(doc.storage_path)

  if (downloadError || !fileBlob) {
    throw new Error(`DOWNLOAD_FAILED:${doc.file_name || doc.id}`)
  }

  const arrayBuffer = await fileBlob.arrayBuffer()
  const fileBytes = new Uint8Array(arrayBuffer)
  const mimeType = (doc.mime_type || "").toLowerCase()
  let extractedText = ""

  if (mimeType === "text/plain") {
    extractedText = new TextDecoder("utf-8").decode(fileBytes)
  } else if (mimeType === "application/pdf") {
    let isScannedOrFailed = false
    try {
      const pdf = await getDocumentProxy(fileBytes)
      const { text } = await extractText(pdf, { mergePages: true })
      extractedText = text
      const textLen = (extractedText || "").trim().length
      if (textLen < 200 || textLen < (fileBytes.length / 500)) {
        isScannedOrFailed = true
      }
    } catch (_pdfErr) {
      isScannedOrFailed = true
    }

    if (isScannedOrFailed) {
      const ocrApiKey = Deno.env.get('OCR_SPACE_API_KEY')
      if (ocrApiKey) {
        try {
          const ocrText = await tryOCR(fileBytes, ocrApiKey)
          if ((ocrText || "").trim().length >= 200) {
            extractedText = ocrText
          }
        } catch (_ocrErr) {
          // fall through with whatever extractedText we already have
        }
      }
    }
  } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    try {
      const docxHtmlResult = await mammoth.convertToHtml({ buffer: fileBytes })
      const parsedDocxText = parseDocxHtmlContent(docxHtmlResult.value || "")
      extractedText = parsedDocxText.trim() ? parsedDocxText : (await mammoth.extractRawText({ buffer: fileBytes })).value
    } catch (_docxErr) {
      const docxResult = await mammoth.extractRawText({ buffer: fileBytes })
      extractedText = docxResult.value
    }
  } else if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    const zip = new JSZip()
    await zip.loadAsync(fileBytes)
    const slideFiles = Object.keys(zip.files)
      .filter(name => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"))
      .sort((a, b) => parseInt(a.replace(/[^0-9]/g, ""), 10) - parseInt(b.replace(/[^0-9]/g, ""), 10))
    let pptxText = ""
    for (const slidePath of slideFiles) {
      const slideXml = await zip.files[slidePath].async("text")
      const slideText = parsePptxSlideXml(slideXml)
      if (slideText) pptxText += slideText + "\n\n"
    }
    extractedText = pptxText
  } else {
    extractedText = new TextDecoder("utf-8").decode(fileBytes)
  }

  return (extractedText || "").trim()
}

// When asked for tables/lists, the model sometimes writes its "answer" field
// with literal line breaks between rows instead of escaped "\n" sequences —
// that's invalid JSON and JSON.parse() rejects the whole response outright.
// This walks the raw text tracking whether we're inside a JSON string
// (toggling on unescaped double quotes) and escapes stray control characters
// found there, then retries the parse. Only kicks in when a plain parse
// already failed, so well-formed responses are unaffected.
function tryParseJsonLoose(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch (_firstErr) {
    let repaired = ''
    let inString = false
    let prevChar = ''
    for (const ch of raw) {
      if (ch === '"' && prevChar !== '\\') {
        inString = !inString
        repaired += ch
      } else if (inString && (ch === '\n' || ch === '\r' || ch === '\t')) {
        repaired += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : '\\t'
      } else {
        repaired += ch
      }
      prevChar = ch
    }
    return JSON.parse(repaired)
  }
}

// The student explicitly wants chat answers to consider BOTH the raw source
// text and the study card summary already generated for it — the summary can
// carry synthesized info (e.g. a diagram's meaning inferred at generation
// time) that the raw extracted text alone doesn't make obvious. Kept compact
// since this rides along on every chat turn.
function buildSummaryContextBlock(card: any): string {
  const parts: string[] = []
  if (card.summary && typeof card.summary === 'string') {
    parts.push(`Study card summary:\n${card.summary}`)
  }
  if (Array.isArray(card.key_points) && card.key_points.length > 0) {
    parts.push(`Key points:\n- ${card.key_points.slice(0, 20).join('\n- ')}`)
  }
  if (Array.isArray(card.tables) && card.tables.length > 0) {
    parts.push(`Tables identified when this card was generated:\n${JSON.stringify(card.tables).slice(0, 2000)}`)
  }
  if (Array.isArray(card.charts) && card.charts.length > 0) {
    parts.push(`Charts/diagrams identified when this card was generated:\n${JSON.stringify(card.charts).slice(0, 2000)}`)
  }
  if (Array.isArray(card.formulas) && card.formulas.length > 0) {
    parts.push(`Formulas identified when this card was generated:\n${JSON.stringify(card.formulas).slice(0, 1500)}`)
  }
  let block = parts.join('\n\n')
  const MAX_SUMMARY_CONTEXT = 6000
  if (block.length > MAX_SUMMARY_CONTEXT) {
    block = block.substring(0, MAX_SUMMARY_CONTEXT) + '\n...[truncated]'
  }
  return block
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { studyCardId, messages, image, checkWorkMode } = await req.json()
    if (!studyCardId) {
      return new Response(JSON.stringify({ error: 'studyCardId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid "messages" parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Optional: a student can attach a screenshot/photo of a specific page —
    // e.g. a diagram that the extracted text renders as garbled/disconnected
    // fragments. When present we route this one turn through a vision-capable
    // model instead of the usual text-only one. Validated defensively since
    // it's a raw base64 data URL coming straight from the client.
    let imageDataUrl: string | undefined = undefined
    if (typeof image === 'string' && image.trim().length > 0) {
      const candidate = image.trim()
      if (!/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(candidate)) {
        return new Response(JSON.stringify({ error: 'Attached image must be a valid PNG/JPEG/WEBP/GIF data URL.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const approxBytes = candidate.length * 0.75
      const MAX_IMAGE_BYTES = 6 * 1024 * 1024 // ~6MB decoded — plenty for a screenshot, keeps latency/cost sane
      if (approxBytes > MAX_IMAGE_BYTES) {
        return new Response(JSON.stringify({ error: 'Attached image is too large (max ~6MB). Try a smaller screenshot or crop it.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      imageDataUrl = candidate
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // 1. Verify the caller can actually see this study card (RLS-enforced —
    //    covers both "it's my own card" and "I'm a teacher with open access").
    const { data: card, error: cardError } = await userClient
      .from('study_cards')
      .select('id, document_id, is_merged, source_documents, summary_language, summary, key_points, tables, charts, formulas')
      .eq('id', studyCardId)
      .single()

    if (cardError || !card) {
      return new Response(JSON.stringify({ error: 'Study card not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 2. Resolve which document row(s) back this card, then download + extract text.
    let docIds: string[] = []
    if (card.is_merged && Array.isArray(card.source_documents) && card.source_documents.length > 0) {
      docIds = card.source_documents.map((d: any) => d.id).filter(Boolean)
    } else if (card.document_id) {
      docIds = [card.document_id]
    }

    if (docIds.length === 0) {
      return new Response(JSON.stringify({ error: 'This study card has no linked source document to chat with.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: docs, error: docsError } = await serviceClient
      .from('documents')
      .select('id, storage_path, mime_type, file_name')
      .in('id', docIds)

    if (docsError || !docs || docs.length === 0) {
      return new Response(JSON.stringify({ error: 'The original source document(s) could not be found (they may have been deleted).' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ========================================================================
    // SOURCE TEXT STRATEGY
    //
    //   small enough  -> send the whole document (unchanged behaviour)
    //   too large     -> rank chunks against the question, send the best
    //   no chunks yet -> extract on demand, truncate (pre-migration docs)
    //
    // Every branch falls back toward the older, simpler behaviour rather than
    // failing the student's question.
    // ========================================================================
    // Bound the conversation window we forward to the model: last 10 turns
    // (5 exchanges) is plenty of context for follow-ups without ballooning cost.
    //
    // Computed HERE, before the strategy below, because the history competes
    // with the source text for the same per-minute budget and so has to be
    // measurable before we decide how much source we can afford. A long
    // conversation legitimately shrinks the source window.
    const safeMessages = messages
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 3000) }))

    if (safeMessages.length === 0 || safeMessages[safeMessages.length - 1].role !== 'user') {
      return new Response(JSON.stringify({ error: 'No valid question found in the request.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Everything that competes with the source text for the same per-minute
    // budget, declared before the strategy below so the budget can be measured
    // rather than assumed.
    //
    // WHICH INSTRUCTIONS THIS QUESTION ACTUALLY NEEDS
    //
    // Measured 05.10.2026: the system prompt ran to 13,048 characters, about
    // 3,300 tokens of standing instructions on every single message, before
    // the question or one character of the document. Broken down, two
    // sections were 59% of it:
    //
    //   DIAGRAM & VISUAL-STRUCTURE AWARENESS + DIAGRAM GENERATION  ~4,990
    //   MATH FORMULA FORMAT + STEP-BY-STEP NUMERIC SOLUTIONS       ~3,080
    //
    // Both are conditional in nature — one earns its place when the student
    // asks about a figure, the other when the material is quantitative — and
    // both were being sent for "makro ekonominin temeli nedir". Shortening
    // the text would cost capability where it matters; sending it only when
    // it applies costs nothing. Every 3,200 characters saved is ~1,000
    // tokens handed back to the document.
    //
    // Both tests err toward INCLUDING: a missing instruction degrades an
    // answer, while an unnecessary one only costs budget on a question that
    // had room anyway.
    const lastUserText = String(
      [...messages].reverse().find((m: any) => m?.role === 'user')?.content || ''
    ).toLowerCase()

    const VISUAL_WORDS = /g[öo]rsel|[şs]ekil|[şs]ema|grafik|diyagram|tablo|çizim|cizim|resim|foto|akı[şs]|aki[sş]|diagram|chart|figure|graph|table|flow|image|picture/
    const NUMERIC_WORDS = /hesapla|hesab|kaç|kac|ne kadar|yüzde|yuzde|oran|formül|formul|çöz|coz|soru çöz|calculate|compute|how much|how many|percent|ratio|formula|solve|step by step/
    // The QUESTION decides the visual rules, not the card. "This card has a
    // diagram" was the first version of this test and it eliminated nothing:
    // nearly every card the pipeline produces has at least one diagram, so
    // the 4,990 characters shipped on every message exactly as before. What
    // the rules are for is a student asking about a figure, and a student
    // asking about a figure says so. If they don't, they get a prose answer
    // and can ask again with "şema çiz" — cheap to recover from, unlike a
    // truncated document.
    const needsVisualRules =
      typeof imageDataUrl === 'string' || VISUAL_WORDS.test(lastUserText)

    // is_quantitative is a property of the DOCUMENT, not of one question, and
    // that is the right level here: in an accounting or economics chapter the
    // next question is likely to be numeric even when this one wasn't, and a
    // mis-formatted formula is a worse failure than a slightly smaller window.
    const needsNumericRules =
      card?.is_quantitative === true ||
      (Array.isArray(card?.formulas) && card.formulas.length > 0) ||
      (Array.isArray(card?.worked_examples) && card.worked_examples.length > 0) ||
      NUMERIC_WORDS.test(lastUserText) || /\d/.test(lastUserText)

    type SourceView = 'whole' | 'retrieval' | 'truncated'

    const docNames = docs.map((d: any) => d.file_name).join(', ')
    const summaryContextBlock = buildSummaryContextBlock(card)
    const hasImage = typeof imageDataUrl === 'string'
    // "Check my work" only makes sense when there's actually an image to look
    // at — a checked checkbox with no attachment is just ignored.
    const isCheckWorkMode = checkWorkMode === true && hasImage

    // Measured, not estimated: build the real prompt with an empty source and
    // take its length. `true` for the retrieval variant because that one is
    // ~700 characters longer (the selected-passages caveat), so whichever
    // strategy wins, the real prompt is no larger than what we budgeted for.
    // The document's own language decides the ratio, so the sample is the
    // card's summary — it is written in the document's language and is
    // available here, before the source text itself has been chosen.
    const charsPerToken = charsPerTokenFor(summaryContextBlock || docNames)

    const historyChars = () => safeMessages.reduce(
      (n: number, m: any) => n + String(m.content || '').length, 0
    )
    // 'retrieval' because it is the longest of the three variants (it adds
    // the selected-passages caveat), so whichever view wins, the real
    // prompt is no larger than what we budgeted for.
    const basePromptChars = buildSystemPrompt('', 'retrieval').length

    // A long conversation can eat the whole minute on its own: ten turns at
    // the 3,000-character cap is 30,000 characters, nearly 9,400 tokens
    // before the document is even considered. The floor in
    // sourceBudgetChars() keeps the source from going to zero, but a floor
    // that pushes the TOTAL back over the ceiling just trades an empty prompt
    // for "Request too large" — the student sees an error either way.
    //
    // So when it comes to that, the history is what gets cut. The source
    // document is what the question is about; turn 6 of the chat is not.
    // Oldest first, and never the current question.
    // Uzun yoneri gerektiren soru, uzun cevabi da gerektiren sorudur.
    const maxCompletion = (needsNumericRules || needsVisualRules || hasImage)
      ? CHAT_MAX_COMPLETION
      : CHAT_MAX_COMPLETION_SHORT

    let droppedTurns = 0
    while (
      safeMessages.length > 1 &&
      sourceBudgetChars(basePromptChars + historyChars(), hasImage, maxCompletion, charsPerToken) <= SOURCE_MIN_CHARS
    ) {
      safeMessages.shift()
      droppedTurns++
    }
    if (droppedTurns > 0) {
      console.warn(
        `chat-with-document: ${droppedTurns} eski sohbet turu dusuruldu — ` +
        `gecmis kaynak metnine yer birakmiyordu`
      )
    }

    const promptOverheadChars = basePromptChars + historyChars()
    const SOURCE_BUDGET = sourceBudgetChars(promptOverheadChars, hasImage, maxCompletion, charsPerToken)
    console.log(
      `chat-with-document budget: ${SOURCE_BUDGET} krk kaynak ` +
      `(prompt ${basePromptChars} + gecmis ${historyChars()} krk, completion ${maxCompletion}, ` +
      `gorsel=${needsVisualRules ? 'kural+' : '-'}${hasImage ? 'ek' : ''}, ` +
      `sayisal=${needsNumericRules ? 'kural+' : '-'}, oran ${charsPerToken}, ` +
      `TPM ${CHAT_TPM_LIMIT}×${CHAT_TPM_SAFETY})`
    )

    type ChunkSize = { count: number; totalChars: number } | null
    const sizes: ChunkSize[] = await Promise.all(
      docs.map((d: any) => loadChunkSizes(serviceClient, d.id))
    )
    const allChunked = sizes.every((s: ChunkSize) => s !== null)
    const totalChunkChars = sizes.reduce((n: number, s: ChunkSize) => n + (s?.totalChars || 0), 0)

    // The question being asked, plus the previous question for follow-ups
    // like "peki onun formülü?" whose own words name nothing searchable.
    const userTurns = messages.filter((m: any) => m?.role === 'user' && typeof m?.content === 'string')
    const latestQuestion = String(userTurns[userTurns.length - 1]?.content || '')
    const priorQuestion = String(userTurns[userTurns.length - 2]?.content || '')
    const retrievalQuery = buildChunkTsQuery(`${latestQuestion} ${priorQuestion}`.trim())

    let sourceText = ''
    let strategy = 'none'

    if (allChunked && totalChunkChars > SOURCE_BUDGET && retrievalQuery) {
      const rows = await retrieveRelevantChunks(serviceClient, docIds, retrievalQuery)
      if (rows && rows.length > 0) {
        const { text, used, pages } = assembleRetrieved(rows, SOURCE_BUDGET)
        if (text) {
          sourceText = text
          strategy = 'retrieval'
          console.log(
            `chat-with-document: retrieval — ${rows.length} chunk matched, ` +
            `${Math.min(rows.length, RETRIEVED_MAX_CHUNKS)} ranked, ${used} chars sent ` +
            `(document total ${totalChunkChars}), pages=[${pages.slice(0, 12).join(', ')}]`
          )
        }
      } else if (rows && rows.length === 0) {
        // The search ran and genuinely matched nothing. Sending the whole
        // (large) document is still better than answering from nothing, and
        // the model's own grounding rule handles "not in the source".
        console.log('chat-with-document: retrieval matched 0 chunks — sending document head instead')
      }
    }

    if (!sourceText) {
      const sections: string[] = []
      let storedHits = 0
      let extractedHits = 0
      for (const doc of docs) {
        try {
          // Stored chunks first; on-demand extraction only for documents that
          // predate document_chunks (or whose write failed).
          let text = await loadStoredText(serviceClient, doc.id)
          if (text) {
            storedHits++
          } else {
            text = await extractDocumentText(serviceClient, doc)
            if (text) extractedHits++
          }
          if (text) {
            sections.push(docs.length > 1 ? `=== DOCUMENT: ${doc.file_name} ===\n${text}` : text)
          }
        } catch (extractErr) {
          console.error('Text extraction failed for doc', doc.id, extractErr)
        }
      }

      if (sections.length === 0) {
        return new Response(JSON.stringify({ error: 'No readable text could be extracted from the source document(s).' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      sourceText = sections.join('\n\n')
      strategy = storedHits > 0 ? 'whole-document (stored)' : 'whole-document (extracted)'

      // Safety net for a document that is large AND could not be served by
      // retrieval (no chunks, or the search was unavailable). Still a cut, but
      // now only on the path that has no better option.
      //
      // The cut used to be at a flat 100,000 characters, which is five times
      // what the minute's budget can carry — so it did not prevent anything:
      // the request still went out too large and Groq rejected it. Cutting at
      // the budget means the student gets an answer from the first N pages
      // instead of an error, which is worse than retrieval and much better
      // than nothing.
      if (sourceText.length > SOURCE_BUDGET) {
        console.warn(
          `chat-with-document: source text (${sourceText.length} krk) butceyi ` +
          `(${SOURCE_BUDGET} krk) asiyor, kirpiliyor — retrieval bu yolda kullanilamadi`
        )
        const truncated = sourceText.substring(0, SOURCE_BUDGET)
        const lastBoundary = Math.max(truncated.lastIndexOf(". "), truncated.lastIndexOf(".\n"), truncated.lastIndexOf("\n"))
        sourceText = lastBoundary > SOURCE_BUDGET - 3000 ? truncated.substring(0, lastBoundary + 1) : truncated
        strategy += ' + truncated'
      }
      console.log(`chat-with-document source text: ${storedHits} from document_chunks, ${extractedHits} re-extracted`)
    }

    console.log(`chat-with-document strategy=${strategy}, sourceText=${sourceText.length} chars`)

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: 'AI key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    /**
     * The system prompt, as a function of the source text.
     *
     * It used to be one inline template literal built after the strategy was
     * chosen. It has to be a function now because the source-text budget is
     * "what is left of the minute after everything else" — so the everything
     * else has to be MEASURABLE before the source is picked, and the only
     * honest way to measure it is to build this with an empty source.
     *
     * A hardcoded "the prompt is about 4,000 characters" constant would have
     * been smaller, and would have silently drifted the first time anyone
     * edited the text below.
     */
    function buildSystemPrompt(sourceText: string, view: SourceView): string {
      // What the model is actually looking at depends on the strategy, and
      // getting this wrong produces the one answer a grounded Q&A feature
      // must never give: a confident "that isn't in the document" about
      // something that is, just not in the part it was shown.
      //
      // 'retrieval' has said so since this feature shipped. 'truncated' did
      // NOT, and that was a live bug: a cut document was described as "the
      // full extracted text" — 05.10.2026, the economy chapter went in at
      // 3,983 of 10,549 characters under that exact sentence. The model was
      // told it had everything while holding 38% of it.
      const isRetrieval = view === 'retrieval'
      const isPartial = view !== 'whole'
      const sourceDescription =
        view === 'retrieval'
          ? `Below are the passages from that source that are most relevant to the student's question, selected from a longer document and shown in reading order with their page numbers`
          : view === 'truncated'
            ? `Below is the BEGINNING of that source — it was too long to include in full, so it is cut off partway through`
            : `You are given the full extracted text of that source below`
      const retrievalCaveat = isRetrieval
        ? `

SELECTED-PASSAGES CAVEAT (important):
What follows is a RELEVANCE-SELECTED SUBSET of a longer document, not the whole thing. Answer from these passages exactly as strictly as always — but when they do not contain the answer, say that these passages don't cover it and that it may appear elsewhere in the document (suggest the student rephrase with more specific terms, or name the topic/chapter). Do NOT state or imply that the document itself does not contain something, because you cannot see all of it. Page numbers shown in "[Sayfa N]" headers are real — use them in your citations' "reference" text when relevant.`
        : view === 'truncated'
          ? `

TRUNCATED-SOURCE CAVEAT (important):
What follows is only the FIRST PART of a longer document. Answer from it exactly as strictly as always — but when it does not contain the answer, say that the part you can see doesn't cover it and that it probably appears later in the document (suggest the student ask again naming the specific topic, chapter or term). Do NOT state or imply that the document itself does not contain something, because you have not seen most of it.`
          : ''

      return `You are a grounded document Q&A assistant for Acadex, an academic study platform. The student is asking questions about a specific uploaded source (${docNames}). ${sourceDescription}${summaryContextBlock ? ', along with the study card summary already generated for it' : ''}.${retrievalCaveat}

STRICT GROUNDING RULE:
Answer ONLY using information that is actually present in the source text${summaryContextBlock ? ' or the study card summary' : ''} below. Do NOT use outside knowledge to fill in gaps, and do NOT invent facts, numbers, names, or details that are not in the text. If the source does not contain enough information to answer the question, say so honestly and clearly (in the student's own language) instead of guessing — you may still briefly explain the general concept if it's common academic knowledge, but you MUST clearly distinguish that from what the source itself says.

CITATION RULE:
When you state a specific fact, definition, number, or claim drawn from the source, add a citation marker like [1], [2], etc. immediately after it, reusing the same marker for the same location if you reference it again. Build a "citations" array in your JSON output: [{ "id": number, "reference": string }], where "reference" briefly names the topical section/heading area the claim came from (e.g. "Bölüm 2 - SEO tartışması" or "Giriş bölümü"). Don't over-cite — reserve markers for specific, checkable claims, not every sentence. If your answer makes no specific checkable claims (e.g. it's just a clarifying question back to the student, or a general "not found in the source" answer), return an empty citations array.

${needsVisualRules ? `
DIAGRAM & VISUAL-STRUCTURE AWARENESS:
You only have the extracted text, not the original page images — so a flowchart, comparison diagram, or process illustration in the source often survives only as a cluster of short, disconnected phrases that don't read as normal prose (e.g. parallel short labels repeated near each other, a sequence of terse stage names, or paired opposing terms). If the student asks about a chart, diagram, graphic, or "görsel/şekil" and you spot such a cluster in the source text (or in the study card summary/tables/charts context below, if provided), reconstruct and explain its likely meaning — but explicitly flag that you're inferring the diagram's structure from scattered text labels rather than describing an image you can see (e.g. "Kaynak metindeki dağınık ifadelere bakılırsa, bu muhtemelen ... karşılaştıran bir diyagram."). If you genuinely can't find any fragments that plausibly correspond to what they're asking about, tell them honestly instead of guessing — and mention they can attach a photo/screenshot of that page so you can look at it directly.${hasImage ? `

ATTACHED IMAGE FROM STUDENT:${isCheckWorkMode ? `
The student has checked "Bu benim çözümüm — kontrol et" (this is my own solution — check it), so this attached image is the STUDENT'S OWN handwritten or typed attempt at solving a problem — it is NOT a page from the source document, do not describe it as source material. Act as a grader: work through their solution step by step yourself, verify each of their steps against the correct method, and then:
- If it's fully correct, say so clearly and confirm the final answer.
- If there's a mistake, identify the EXACT step where it first goes wrong (quote or describe that specific step precisely, e.g. "2. adımda ... yazmışsın"), explain what's wrong about it, and show the correct way to do that step. Note whether the mistake changes the final answer, and if so, what the correct final answer actually is.
- Reference the actual numbers/values the student wrote — be concrete, not vague.
- Keep an encouraging tone even when pointing out a mistake; you're helping a student learn, not grading a final exam.
- If the image genuinely isn't a solution attempt (e.g. it's blank, unrelated, or you can't read the handwriting), say so honestly instead of guessing at what it might say.` : `
The student has attached a photo or screenshot of part of this source (for example, a diagram, chart, or page they want you to look at directly) along with their latest message. You DO have real vision on this image — actually look at it and describe/explain what it shows, don't just infer from text fragments. Cross-reference the source text and summary above to name the section/concept the image illustrates where relevant, but the image itself is your primary evidence for what it depicts. If the image is blurry, unrelated to this document, or you can't make out enough detail, say so honestly instead of guessing.`}` : ''}

DIAGRAM GENERATION (free, drawn — not a photo):${isCheckWorkMode ? ' Not applicable in CHECK-WORK MODE (see ATTACHED IMAGE FROM STUDENT above) — skip diagram generation entirely while grading the student\'s solution unless a small diagram would genuinely help illustrate the correct method.' : ''}
When the student is asking about a chart, diagram, flowchart, comparison, process, or hierarchy — and you can reconstruct its actual structure (from the source text, the study card summary/tables/charts context, and/or an attached image) — also produce a Mermaid.js diagram definition of it (see the MERMAID BLOCK part of OUTPUT FORMAT below), so it can be rendered as a real picture for the student instead of only described in prose. Rules:
- Use "flowchart TD" or "flowchart LR" for processes/hierarchies/flows, "graph TD" for simple relationship diagrams. Keep node labels short (a few words) — put fuller explanation in your "answer" text instead.
- Every node id must be a short alphanumeric token (e.g. A, B1, step2) — never put special characters or quotes inside node ids, only inside the bracketed label text.
- Inside node/edge labels, prefer plain words with no punctuation at all. If you must include a comma or a slash, that's fine, but NEVER use a double-quote character ("") anywhere in the diagram — Mermaid doesn't need quoted labels for ordinary text, and a stray quote is the single most common way this block gets garbled downstream. If a label would otherwise need quotes, just reword it without them.
- Keep it to at most ~12 nodes. Prefer a simple, correct diagram over an elaborate, possibly-wrong one.
- Skip the diagram entirely (omit the whole MERMAID BLOCK) whenever the question isn't about a diagram/chart/structure, or when you don't have enough grounded structure to draw one honestly — never fabricate a diagram just to have something to show.
- The diagram is entirely separate from and in addition to your normal "answer" text — still write a normal grounded answer as usual.
` : ''}
LANGUAGE RULE:
Respond in the same language the student's latest question is written in (default to Turkish if genuinely ambiguous).

CONVERSATION STYLE:
Be concise, clear, and directly helpful — write like a knowledgeable classmate walking them through the material, not a formal report. Refer back to earlier turns in the conversation naturally if the student asks a follow-up question.

TABLES AND LISTS IN YOUR ANSWER:
If the student asks you to bring back a table, ranking, or list of items from the source, reproduce it inside the "answer" string using "- " bullet lines or simple "label: value" lines separated by "\\n" (a literal backslash-n escape sequence, NOT an actual line break) — never break your answer across multiple real lines. Keep each row/item on its own "\\n"-separated line so it still reads clearly when displayed, but the JSON string itself must remain a single line.

${needsNumericRules ? `
MATH FORMULA FORMAT:
Whenever your answer includes a mathematical formula, equation, or expression (variables, fractions, exponents, summations, financial/statistical notation, etc.), write it in valid LaTeX and wrap it in single dollar signs so it renders as a real formula instead of plain text, e.g. $A = P(1 + r/n)^{nt}$. This matters especially for quantitative subjects (finance, accounting, statistics, economics) — don't just write formulas as plain text like "A = P(1+r/n)^nt" when you can express them properly in LaTeX. Since your answer is a JSON string value, every backslash inside the LaTeX must be escaped as a double backslash in the JSON text itself: to display $\\frac{a}{b}$, the actual JSON string content must contain "$\\\\frac{a}{b}$" (two backslash characters before "frac", not one). Keep formulas inline within your sentences using single $...$ delimiters only — never use $$...$$ block delimiters.

STEP-BY-STEP NUMERIC SOLUTIONS:
When the student asks you to solve, calculate, or work through a numeric/quantitative problem (e.g. compute an interest amount, solve for an unknown, work out a statistic), structure your "answer" as clearly numbered steps rather than one dense paragraph: "1) ...\\n2) ...\\n3) ..." (the same "\\n"-separated-line convention as TABLES AND LISTS above — a literal backslash-n, not a real line break). Each step should name the formula being applied (in LaTeX per MATH FORMULA FORMAT above) and show the actual numbers plugged in, not just the abstract formula in isolation. Finish with a clearly labeled final line such as "Sonuç: ..." or "Final answer: ..." stating the numeric result with correct units. Only use this structured format for genuinely numeric/computational questions — for conceptual/qualitative questions, answer normally in prose.
` : ''}
OUTPUT FORMAT (read carefully, this is machine-parsed, not just for a human):
Respond with a single-line JSON object and NOTHING else${needsVisualRules ? ' except the optional diagram block described below' : ''} — no markdown code fences, no commentary before or after, every string value valid single-line JSON (escape any newlines inside it as "\\n"): { "answer": string, "citations": [ { "id": number, "reference": string } ] }. The "answer" field is required and must never be empty; if you cannot answer from the source, say so IN that field.${needsVisualRules ? `
Then, ONLY when DIAGRAM GENERATION above applies, immediately after the JSON object (on new lines, which is fine since this part is plain text, not JSON) append exactly this block with your Mermaid definition inside it, real line breaks allowed:
###MERMAID_START###
flowchart TD
  A[Example] --> B[Node]
###MERMAID_END###
Use the literal markers "###MERMAID_START###" and "###MERMAID_END###" on their own lines, nothing else on those lines. If no diagram applies, output NOTHING after the JSON object — do not include the markers at all in that case. Do NOT put any diagram inside the JSON object.` : ''}
${summaryContextBlock ? `
STUDY CARD SUMMARY CONTEXT (already generated for this document — may capture a diagram/table/chart's meaning even where the raw source text below is sparse or garbled; cross-check both when relevant):
"""
${summaryContextBlock}
"""
` : ''}
SOURCE TEXT:
"""
${sourceText}
"""`
    }

    const sourceView: SourceView =
      strategy === 'retrieval' ? 'retrieval'
        : strategy.includes('truncated') ? 'truncated'
        : 'whole'
    const systemPrompt = buildSystemPrompt(sourceText, sourceView)

    // Build the actual message list. Only the LAST user turn ever carries the
    // attached image — older turns stay plain text so the conversation history
    // doesn't balloon with base64 data on every follow-up.
    function buildChatMessages(withImage: boolean) {
      const built: any[] = [{ role: "system", content: systemPrompt }]
      safeMessages.forEach((m, idx) => {
        const isLastUserMsg = withImage && idx === safeMessages.length - 1 && m.role === 'user'
        if (isLastUserMsg && imageDataUrl) {
          built.push({
            role: 'user',
            content: [
              { type: 'text', text: m.content },
              { type: 'image_url', image_url: { url: imageDataUrl } }
            ]
          })
        } else {
          built.push({ role: m.role, content: m.content })
        }
      })
      return built
    }

    let groqResponse
    let visionUsed = false
    if (hasImage) {
      try {
        console.log("chat-with-document: attempting vision analysis with qwen/qwen3.8-27b...")
        groqResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            // Groq retired llama-3.2-90b-vision-preview; qwen/qwen3.8-27b is the
            // current vision-capable model (same OpenAI-style image_url format).
            model: "qwen/qwen3.8-27b",
            temperature: 0.3,
            // Qwen3.8 is a hybrid reasoning model that THINKS by default (a
            // <think>...</think> block prepended to content), which broke our
            // JSON parsing and burned most of the time/token budget on
            // reasoning instead of the actual answer. "none" turns reasoning
            // off entirely so "content" is just the direct final answer.
            reasoning_effort: "none",
            // Without an explicit cap, Groq reserves a large default completion
            // budget against this account's tokens-per-minute limit, which alone
            // can push an otherwise modest request over the limit and return a
            // "Request too large" / rate_limit_exceeded error.
            max_completion_tokens: maxCompletion,
            // No response_format:"json_object" here — that mode forces the ENTIRE
            // reply to be one JSON value, which would forbid the optional
            // ###MERMAID_START###...###MERMAID_END### block appended after it
            // (see OUTPUT FORMAT in the system prompt). We parse the JSON part
            // ourselves below instead.
            messages: buildChatMessages(true)
          })
        }, 0, 20000) // no retries, 20s cap — leave real time budget for the text-only fallback below
        if (groqResponse.ok) {
          visionUsed = true
        } else {
          console.warn(`chat-with-document: vision call returned non-ok status ${groqResponse.status}, falling back to text-only.`)
          groqResponse = undefined
        }
      } catch (visionErr) {
        console.warn("chat-with-document: vision call failed, falling back to text-only:", visionErr)
        groqResponse = undefined
      }
    }

    if (!groqResponse) {
      // FALL BACK TO ANOTHER MODEL WHEN ONE LANE'S DAY IS SPENT.
      //
      // 05.10.2026, 19:20 — a student asked "stagflasyon nedir" and got
      // "Şu anda cevap veremiyorum":
      //
      //   Rate limit reached for model `openai/gpt-oss-120b` ... on tokens
      //   per day (TPD): Limit 200000, Used 198585. Try again in 24m2.88s
      //
      // Nothing was wrong with the request. One model's DAILY allowance was
      // gone, and this call was pinned to that model, so it retried the same
      // exhausted lane once and gave up. Groq meters TPD per model, and the
      // other two lanes had their own untouched 200,000.
      //
      // Each lane is tried in turn. A daily quota error moves on immediately
      // — waiting 24 minutes is not an option with a student watching — while
      // any other failure also falls through, since a worse model answering
      // beats no answer.
      //
      // ORDER IS MEASURED, NOT ASSUMED (06.10.2026). It used to be
      // quality-first — 120b, then 20b, then qwen — on the reasoning that a
      // bigger model is a better answer. On this prompt 120b does not answer
      // at all. Four consecutive runs, two different questions ("FIFO
      // nedir", "LIFO ve FIFO arasindaki fark nedir"):
      //
      //   finish_reason=stop, completion=147/153/319, reasoning=12/13/25,
      //   content="" and choice{ index message={role,content} logprobs
      //   finish_reason } — no tool_calls, no reasoning field, nothing else.
      //
      // So ~294 of those 319 tokens were produced and landed in no field the
      // response exposes. gpt-oss emits channel-tagged output and Groq maps
      // `final` to content and `analysis` to reasoning; an answer written to
      // a third channel reaches neither. Consistent with the other half of
      // the evidence: 120b works fine in summarize-document, where every
      // call sets response_format json_object. Here it is free prose.
      //
      // 20b answered all four times, with citations, on the same prompt. So
      // the old order cost one guaranteed-dead call per question — ~4,300
      // prompt tokens of 120b's 200K daily and ~1.1s of the student's wait
      // — and then landed on 20b anyway. 20b first is strictly better: same
      // model finally answers, minus the wasted call.
      //
      // 120b stays second rather than being dropped: it is a real fallback
      // if 20b's day runs out, and keeping it in the chain is what will show
      // whether this ever changes. To re-test it as primary, swap the first
      // two entries back — one line, and the log above says what to look at.
      const textLanes = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b']
      let lastLaneError = ''

      for (let i = 0; i < textLanes.length; i++) {
        const lane = textLanes[i]
        try {
          const res = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${groqApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              // llama-3.3-70b-versatile is being retired by Groq (shutdown
              // 2026-08-16); openai/gpt-oss-120b is one of Groq's recommended
              // replacements and has a comparable (131K) context window.
              model: lane,
              temperature: 0.3,
              // Per model, never written out: gpt-oss rejects
              // reasoning_effort:"none" outright while qwen needs exactly
              // that. The summarize function learned this the hard way when
              // its review call started picking lanes at runtime and 400'd
              // on every gpt-oss one.
              // `include_reasoning: false` was dropped from the gpt-oss side
              // on 06.10.2026. It told Groq to throw the reasoning text away
              // — while the open question on this prompt is precisely where
              // 294 produced tokens went. Asking for a field back costs no
              // tokens (reasoning is metered whether or not it is returned,
              // and at effort=low it is 12-25 tokens), and it is the only
              // way the empty-content log below can say whether the answer
              // ended up in `reasoning` instead of `content`.
              ...(lane.includes('qwen')
                ? { reasoning_effort: "none" }
                : { reasoning_effort: "low" }),
              // See the comment on the vision call above re: max_completion_tokens
              // and why response_format is deliberately omitted here too.
              max_completion_tokens: maxCompletion,
              messages: buildChatMessages(false)
            })
            // No retry on the first lanes: when this one is out of daily
            // quota, the next lane is a better use of the student's wait
            // than a second attempt at the same exhausted one. The last lane
            // keeps its retry because after it there is nowhere to go.
          }, i === textLanes.length - 1 ? 1 : 0, 20000)

          if (res.ok) {
            // A 200 with no content is this lane failing, not the request
            // failing. 06.10.2026: a student asked "FIFO nedir", Groq
            // answered 200, the pipeline logged its token ratio and then
            // returned a silent 502 — the content was empty and the only
            // visible symptom was the log stopping mid-run.
            //
            // The empty answer has to be SEEN here, before the body is
            // consumed downstream, so the next lane can be tried: the whole
            // point of the chain is that one model's bad turn is not the end
            // of the question. finish_reason and the token counts are logged
            // with it, because "ran out of budget while reasoning" and "the
            // model simply returned nothing" need different fixes and
            // guessing between them is how the last silent failure survived.
            const peek = await res.clone().json().catch(() => null)
            const content = peek?.choices?.[0]?.message?.content ?? ''
            if (!String(content).trim()) {
              const finish = peek?.choices?.[0]?.finish_reason ?? '?'
              const u = peek?.usage || {}
              // WHERE the tokens went, not just how many. 06.10.2026:
              // gpt-oss-120b returned finish_reason=stop with
              // completion=147 and reasoning=12 — it finished normally and
              // produced 147 tokens, while `content` was empty. The counts
              // alone cannot say which field received them, so the message
              // object's own shape is logged: its keys, and a short head of
              // every string field. Without this the next empty answer is
              // the same guess all over again.
              // The CHOICE, not just its message. The message turned out to
              // hold only role and an empty content (06.10.2026), so the
              // 153 completion tokens were accounted for somewhere else
              // entirely — a sibling field on the choice, or nowhere the
              // response exposes. Logging the whole choice is the only way
              // to tell those apart, and it is two lines.
              // ONE LEVEL DEEP. The first version printed only the keys of
              // nested objects, so `message={role,content}` told us the
              // answer was not in `message.content` but could not have shown
              // it sitting in `message.reasoning` if it were there. A nested
              // string's head is what distinguishes "the field is missing"
              // from "the field is full and we were reading the wrong one".
              const choice = peek?.choices?.[0]
              const kisalt = (v: unknown, derinlik = 0): string =>
                typeof v === 'string' ? `"${v.slice(0, 120)}"`
                  : v === null ? 'null'
                  : typeof v === 'object'
                    ? (derinlik > 0
                        ? `{${Object.keys(v as object).join(',')}}`
                        : `{${Object.entries(v as object)
                            .map(([k, nv]) => `${k}=${kisalt(nv, derinlik + 1)}`)
                            .join(' ')}}`)
                  : String(v)
              const sekil = choice && typeof choice === 'object'
                ? Object.entries(choice).map(([k, v]) => `${k}=${kisalt(v)}`).join(' ')
                : String(choice)
              console.warn(
                `chat-with-document: ${lane} BOS icerik dondu ` +
                `(finish_reason=${finish}, completion=${u.completion_tokens ?? '?'}, ` +
                `reasoning=${u.completion_tokens_details?.reasoning_tokens ?? '?'}, ` +
                `butce=${maxCompletion}) choice{ ${sekil} }` +
                `${i < textLanes.length - 1 ? ' — sonraki seride geciliyor' : ''}`
              )
              lastLaneError = `empty_content finish_reason=${finish}`
              continue
            }
            groqResponse = res
            if (i > 0) console.warn(`chat-with-document: ${lane} seridine dusuldu (onceki serit(ler) kullanilamadi)`)
            break
          }

          lastLaneError = await res.clone().text().catch(() => '')
          const daily = /tokens per day|TPD/i.test(lastLaneError)
          console.warn(
            `chat-with-document: ${lane} ${res.status} verdi` +
            `${daily ? ' (GUNLUK kota bitti)' : ''}` +
            `${i < textLanes.length - 1 ? ' — sonraki seride geciliyor' : ''}`
          )
        } catch (fetchErr) {
          lastLaneError = String(fetchErr)
          console.warn(`chat-with-document: ${lane} istisna attı:`, fetchErr)
        }
      }

      if (!groqResponse) {
        console.error("chat-with-document: butun seritler basarisiz. Son hata:", lastLaneError)
        // Say WHICH wall was hit. "Try again in a moment" is wrong and
        // frustrating when the real answer is "tomorrow": the daily quota
        // does not clear in a moment, and a student retrying every 30
        // seconds for an hour deserves to know that.
        const daily = /tokens per day|TPD/i.test(lastLaneError)
        return new Response(JSON.stringify({
          error: daily
            ? 'Bugünkü AI kotamız doldu — yarın tekrar deneyebilirsin. (Özet çıkarma ve sohbet aynı günlük kotayı paylaşıyor.)'
            : 'Our AI service is experiencing high demand right now — please try again in a moment'
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    const groqData = await groqResponse.json()

    // MEASURE THE RATIO INSTEAD OF ARGUING ABOUT IT.
    //
    // CHARS_PER_TOKEN decides how much document the student gets, and it was
    // inherited from the summarize function's pacer where being pessimistic
    // is nearly free — you wait a little longer. Here it is expensive: too
    // low a ratio means a document that fits gets cut, which is how the
    // economy chapter went in at 3,983 of 10,549 characters on 05.10.2026.
    //
    // Groq reports what it actually counted. Logging the real ratio on every
    // call turns the constant from a guess into something we can set from
    // data — and it will differ by language, which matters here because the
    // sources are English and the questions are Turkish.
    const promptTokens = Number(groqData?.usage?.prompt_tokens)
    if (Number.isFinite(promptTokens) && promptTokens > 0) {
      const promptChars = systemPrompt.length +
        safeMessages.reduce((n: number, m: any) => n + String(m.content || '').length, 0)
      console.log(
        `chat-with-document token orani: ${(promptChars / promptTokens).toFixed(2)} krk/token ` +
        `(gercek ${promptTokens} token / ${promptChars} krk; varsayim ${charsPerToken})`
      )
    }

    if (!groqResponse.ok) {
      console.error("chat-with-document Groq API error:", JSON.stringify(groqData))
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let rawContent = groqData.choices?.[0]?.message?.content ?? ""
    if (!rawContent) {
      // Reached only when EVERY lane came back empty — the per-lane warning
      // above has already said which and why. Logged here too so the final
      // outcome is never a 502 with nothing behind it in the log, which is
      // exactly how this failure hid on 06.10.2026.
      console.error(
        `chat-with-document: tum seritler bos icerik dondu ` +
        `(finish_reason=${groqData?.choices?.[0]?.finish_reason ?? '?'}, ` +
        `completion=${groqData?.usage?.completion_tokens ?? '?'})`
      )
      return new Response(JSON.stringify({
        error: 'Yapay zekâ bu soruya yanıt üretemedi — soruyu biraz farklı sorarsan tekrar deneyebilirim.'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Defensive safety net: reasoning-capable models (qwen/qwen3.8-27b,
    // openai/gpt-oss-120b) can still prepend a <think>...</think> block to
    // "content" even with reasoning turned down/off above — e.g. Groq changes
    // a default, or a future model swap reintroduces this. Strip it so a
    // stray thinking block never breaks the JSON parse below.
    const thinkMatch = rawContent.match(/<think>[\s\S]*?<\/think>/i)
    if (thinkMatch) {
      rawContent = rawContent.slice(thinkMatch.index! + thinkMatch[0].length).trim()
    } else if (/^\s*<think>/i.test(rawContent)) {
      // Opening tag with no closing tag — the model ran out of its token
      // budget mid-thought before ever writing the real answer. Nothing
      // usable is left; fail with a message that tells the student to retry
      // rather than a confusing generic JSON error.
      console.error("chat-with-document: model response was an unterminated <think> block (ran out of tokens while reasoning):", rawContent)
      return new Response(JSON.stringify({ error: 'The AI ran out of thinking time before writing an answer — please try again' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (!rawContent) {
      return new Response(JSON.stringify({ error: 'AI failed to generate a response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Pull the optional Mermaid diagram block out via plain string search
    // BEFORE touching JSON.parse at all — Mermaid syntax (brackets, arrows,
    // occasional stray quotes) is exactly the kind of content that breaks a
    // naive "embed it as a JSON string value" approach when the model
    // forgets to escape something. Extracting it out-of-band means the JSON
    // parse below only ever has to handle the simple {answer, citations}
    // shape, regardless of how messy the diagram syntax gets.
    const MERMAID_START = '###MERMAID_START###'
    const MERMAID_END = '###MERMAID_END###'
    let mermaidCode: string | null = null
    let jsonPart = rawContent
    const mermaidStartIdx = rawContent.indexOf(MERMAID_START)
    const mermaidEndIdx = rawContent.indexOf(MERMAID_END)
    if (mermaidStartIdx !== -1 && mermaidEndIdx !== -1 && mermaidEndIdx > mermaidStartIdx) {
      mermaidCode = rawContent
        .substring(mermaidStartIdx + MERMAID_START.length, mermaidEndIdx)
        .replace(/```mermaid\s*|```/g, '')
        .trim()
      jsonPart = rawContent.substring(0, mermaidStartIdx).trim()
    }

    const cleaned = jsonPart.replace(/```json\s*|```/g, "").trim()
    let parsedContent
    try {
      parsedContent = tryParseJsonLoose(cleaned)
    } catch (parseError) {
      console.error("Failed to parse chat-with-document JSON:", rawContent, parseError)
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON formatting' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      answer: parsedContent.answer || '',
      citations: Array.isArray(parsedContent.citations) ? parsedContent.citations : [],
      mermaid: mermaidCode && mermaidCode.length > 0 ? mermaidCode : null,
      visionUsed
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Unexpected chat-with-document exception: ', err)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
