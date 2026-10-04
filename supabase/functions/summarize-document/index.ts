import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { extractText, getDocumentProxy } from "npm:unpdf"
import mammoth from "npm:mammoth@1.6.0"
import JSZip from "npm:jszip@3.10.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// timeoutMs bounds EACH attempt via AbortController. This function typically
// runs as one of several SEQUENTIAL Groq calls in a single request (draft
// then review, or chunk-map then synthesis then review) — without a cap, a
// single slow/hanging attempt (plus its own retries) can quietly burn through
// the edge function's entire execution budget, so that by the time a later
// pass (e.g. the review call) runs, there's no time left and every attempt
// fails the same way, exhausting retries for a reason retrying can't fix.
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2, timeoutMs = 25000): Promise<Response> {
  let lastRateLimitedResponse: Response | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId)
      if (response.ok) return response;
      if (response.status === 429) {
        // Rate limited. Log the actual reason (e.g. Groq's TPM-exceeded
        // message) so it's visible in the function logs without a separate
        // dashboard lookup, keep this response so we can return it (instead
        // of throwing an opaque error) if every attempt is exhausted, then
        // wait before retrying.
        lastRateLimitedResponse = response
        let bodyPreview = ""
        try { bodyPreview = await response.clone().text() } catch (_readErr) { /* ignore — body may not be readable twice in all runtimes */ }
        console.warn(`fetchWithRetry: 429 rate-limited (attempt ${attempt + 1}/${maxRetries + 1}): ${bodyPreview}`)
        // Two distinct Groq 429 shapes here: "Request too large ... Requested
        // X" (this single request's own tokens exceed the limit — shrinking
        // it helps, waiting doesn't) vs. "Rate limit reached ... Used X,
        // Requested Y. Please try again in Z s" (the per-minute window is
        // already spent from earlier calls — no amount of shrinking this
        // request helps until the window rolls over, so we must actually
        // wait). Parse Groq's own suggested wait time when present.
        const retryAfterMatch = bodyPreview.match(/try again in ([\d.]+)s/i)
        const waitMs = retryAfterMatch
          ? Math.min(Math.ceil(parseFloat(retryAfterMatch[1]) * 1000) + 500, 30000)
          : 2500
        await new Promise(r => setTimeout(r, waitMs));
      } else if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 800));
      } else {
        return response; // let the caller handle non-retryable errors normally
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  // Every attempt came back 429 — return the last rate-limited response so
  // the caller's normal "!response.ok" handling can log/react to the real
  // reason, instead of surfacing a generic "Max retries exceeded" with no
  // diagnostic detail.
  if (lastRateLimitedResponse) return lastRateLimitedResponse
  throw new Error("Max retries exceeded");
}

// Defensive safety net: reasoning-capable Groq models (qwen/qwen3.6-27b,
// openai/gpt-oss-120b) can prepend a <think>...</think> block to "content"
// even with reasoning turned down/off via reasoning_effort/include_reasoning
// below — strip it so a stray thinking block never breaks a JSON.parse call.
// Returns null if the block is unterminated (the model ran out of its token
// budget mid-thought before ever writing the real answer) — callers should
// treat that as a failure rather than trying to parse what's left.
function stripThinkBlock(raw: string): string | null {
  const match = raw.match(/<think>[\s\S]*?<\/think>/i)
  if (match) {
    return raw.slice((match.index ?? 0) + match[0].length).trim()
  }
  if (/^\s*<think>/i.test(raw)) {
    return null
  }
  return raw
}

// Convert raw bytes to a base64 string WITHOUT the one-character-at-a-time
// `binary += String.fromCharCode(bytes[i])` loop used throughout this file
// (Denetim Raporu, 2026-08-31 — LIVE PRODUCTION FINDING). That pattern
// re-allocates and copies a growing string on every single byte — for a
// multi-hundred-KB/multi-MB PNG page image (exactly what the PDF.co visual
// analysis below downloads), that is millions of reallocations and is what
// actually caused a real "Memory limit exceeded" (546) crash in production
// once the presigned-URL fix above finally let this code path run for the
// first time with real image data. Chunking into reasonably sized pieces
// and joining once at the end keeps this O(n) instead of pathological.
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE)
    chunks.push(String.fromCharCode(...chunk))
  }
  return btoa(chunks.join(''))
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
  const tableMatches = [...slideXml.matchAll(/<a:tbl[\s>][\s\S]*?<\/a:tbl>/g)];

  if (tableMatches.length === 0) {
    const matches = slideXml.matchAll(/<a:t>(.*?)<\/a:t>/g);
    let text = "";
    for (const match of matches) {
      text += decodeXmlEntities(match[1]) + " ";
    }
    return text.trim();
  }

  const slideParts: string[] = [];
  let lastIdx = 0;

  for (const tMatch of tableMatches) {
    const tblStartIndex = tMatch.index!;
    const tblEndIndex = tblStartIndex + tMatch[0].length;

    const preTextXml = slideXml.substring(lastIdx, tblStartIndex);
    const preMatches = preTextXml.matchAll(/<a:t>(.*?)<\/a:t>/g);
    let preText = "";
    for (const m of preMatches) {
      preText += decodeXmlEntities(m[1]) + " ";
    }
    if (preText.trim()) {
      slideParts.push(preText.trim());
    }

    const tblXml = tMatch[0];
    const rowMatches = [...tblXml.matchAll(/<a:tr[\s>][\s\S]*?<\/a:tr>/g)];
    const tableRows: string[][] = [];

    for (const rMatch of rowMatches) {
      const rowXml = rMatch[0];
      const cellMatches = [...rowXml.matchAll(/<a:tc[\s>][\s\S]*?<\/a:tc>/g)];
      const rowCells: string[] = [];
      for (const cMatch of cellMatches) {
        const cellXml = cMatch[0];
        const textMatches = [...cellXml.matchAll(/<a:t>(.*?)<\/a:t>/g)];
        let cellText = textMatches.map(m => decodeXmlEntities(m[1])).join(" ").trim();
        cellText = cellText.replace(/\|/g, "\\|");
        rowCells.push(cellText);
      }
      if (rowCells.some(c => c.length > 0)) {
        tableRows.push(rowCells);
      }
    }

    if (tableRows.length > 0) {
      const colCount = Math.max(...tableRows.map(r => r.length));
      let mdTable = "\n\n";
      const header = [...tableRows[0]];
      while (header.length < colCount) header.push("");
      mdTable += "| " + header.join(" | ") + " |\n";
      mdTable += "| " + Array(colCount).fill("---").join(" | ") + " |\n";
      for (let r = 1; r < tableRows.length; r++) {
        const row = [...tableRows[r]];
        while (row.length < colCount) row.push("");
        mdTable += "| " + row.join(" | ") + " |\n";
      }
      mdTable += "\n";
      slideParts.push(mdTable);
    }

    lastIdx = tblEndIndex;
  }

  const postTextXml = slideXml.substring(lastIdx);
  const postMatches = postTextXml.matchAll(/<a:t>(.*?)<\/a:t>/g);
  let postText = "";
  for (const m of postMatches) {
    postText += decodeXmlEntities(m[1]) + " ";
  }
  if (postText.trim()) {
    slideParts.push(postText.trim());
  }

  return slideParts.join("\n");
}

function parseDocxHtmlContent(html: string): string {
  if (!html) return "";
  let processed = html;

  processed = processed.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (_m, content) => {
    const clean = content.replace(/<[^>]+>/g, "").trim();
    return clean ? `\n\n## ${clean}\n\n` : "";
  });

  processed = processed.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, (tableHtml) => {
    const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi)];
    const tableRows: string[][] = [];

    for (const rMatch of rowMatches) {
      const rowInner = rMatch[0];
      const cellMatches = [...rowInner.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
      const rowCells: string[] = [];

      for (const cMatch of cellMatches) {
        let cellText = cMatch[1].replace(/<[^>]+>/g, " ").trim();
        cellText = cellText.replace(/\s+/g, " ").replace(/\|/g, "\\|");
        rowCells.push(cellText);
      }

      if (rowCells.some(c => c.length > 0)) {
        tableRows.push(rowCells);
      }
    }

    if (tableRows.length === 0) return "";

    const colCount = Math.max(...tableRows.map(r => r.length));
    let mdTable = "\n\n";
    const header = [...tableRows[0]];
    while (header.length < colCount) header.push("");
    mdTable += "| " + header.join(" | ") + " |\n";
    mdTable += "| " + Array(colCount).fill("---").join(" | ") + " |\n";

    for (let r = 1; r < tableRows.length; r++) {
      const row = [...tableRows[r]];
      while (row.length < colCount) row.push("");
      mdTable += "| " + row.join(" | ") + " |\n";
    }
    mdTable += "\n";
    return mdTable;
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

function detectAndFormatPdfTables(text: string): string {
  if (!text) return text;

  const lines = text.split("\n");
  const resultLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const columns = line.split(/\s{2,}|\t/).map(c => c.trim()).filter(Boolean);

    if (columns.length >= 2 && i + 1 < lines.length) {
      const potentialTableRows: string[][] = [columns];
      let j = i + 1;

      while (j < lines.length) {
        const nextLine = lines[j];
        const nextCols = nextLine.split(/\s{2,}|\t/).map(c => c.trim()).filter(Boolean);
        if (nextCols.length >= 2 && Math.abs(nextCols.length - columns.length) <= 2) {
          potentialTableRows.push(nextCols);
          j++;
        } else {
          break;
        }
      }

      if (potentialTableRows.length >= 3) {
        const colCount = Math.max(...potentialTableRows.map(r => r.length));
        let mdTable = "\n\n";
        const header = [...potentialTableRows[0]];
        while (header.length < colCount) header.push("");
        mdTable += "| " + header.map(h => h.replace(/\|/g, "\\|")).join(" | ") + " |\n";
        mdTable += "| " + Array(colCount).fill("---").join(" | ") + " |\n";

        for (let r = 1; r < potentialTableRows.length; r++) {
          const row = [...potentialTableRows[r]];
          while (row.length < colCount) row.push("");
          mdTable += "| " + row.map(cell => cell.replace(/\|/g, "\\|")).join(" | ") + " |\n";
        }
        mdTable += "\n";
        resultLines.push(mdTable);
        i = j;
        continue;
      }
    }

    resultLines.push(line);
    i++;
  }

  return resultLines.join("\n");
}

// ==========================================================================
// LONG-DOCUMENT SUMMARIZATION ENGINE (chunked map-reduce + adaptive length)
//
// Problem this solves: previously, ANY document — a 3-page handout or a
// 52-page slide deck — got the exact same fixed output size per length
// preset ("medium" always meant "4-8 sentences, 5-10 key terms, 4-6 quiz
// questions"), and text beyond 40,000 characters was silently truncated and
// never seen by the model at all. Long documents therefore got a shallow
// summary of roughly their first third, at best.
//
// Fix, in two parts:
//   1. computeAdaptiveTargets() / buildLengthInstruction() — the target
//      counts (summary sentences, key terms, key points, quiz questions)
//      now grow with the actual amount of extracted text, per length
//      preset, up to a sane cap. This applies to every document.
//   2. For documents whose extracted text exceeds CHUNK_THRESHOLD, we
//      switch from a single Groq call to a per-window extraction pipeline,
//      then synthesize one cohesive final summary from the per-window
//      digests and merge+dedupe the per-window structured data down to the
//      adaptive target counts. Visual (image) analysis is intentionally
//      skipped for that path to keep this addition scoped — it only ever
//      applies to the short-document fast path today anyway.
//
// WHICH LONG-DOC CODE ACTUALLY RUNS (read this before trusting the rest):
//   The live long-document implementation is the "LONG-DOC PATH" block
//   inside serve(), built on the locally-defined `compactWindowPrompt` and
//   `extractWindow` (MODEL_HEAVY). It was written to fix Groq 413
//   payload-too-large errors and it SUPERSEDED an earlier, richer
//   map-reduce design whose prompt builders are still in this file:
//
//     buildChunkSystemPrompt()     — NOT WIRED
//     buildSynthesisSystemPrompt() — NOT WIRED
//
//   Both are deliberately retained, not dead by accident:
//   tests/map-model-compare.js extracts buildChunkSystemPrompt() from this
//   source at runtime as the "rich" arm of its prompt comparison, so the
//   richer schema can be measured (grounding %, page validity, output
//   counts, latency, tokens) against the live compact prompt on real
//   documents before we decide whether to promote it. Do not delete them
//   without also updating that harness; do not assume either one is what
//   runs in production today.
//
//   Promoting the richer schema is gated on the token budget, not on
//   taste: every extra field competes for the same maxCompletionTokens,
//   and this account's observed tokens-per-minute cap has been as low as
//   8,000 (see the draftTiers and review-tier comments further down). The
//   same constraint is why concept_graph was added, measured as thinner,
//   and correctly reverted — and why citations are now computed
//   deterministically in anchorCitations() instead of being prompted for.
// ==========================================================================

// CHUNK_THRESHOLD used to be 18000, on the assumption that anything under
// that size could always be sent whole on the short-document fast path.
// That assumption broke once the fast path's own TPM-driven "shrink and
// retry" tiers were added (see draftTiers below, tier 1 = 6000 chars): a
// document between 6000-18000 chars was classified "short" but then had
// its OWN fast-path attempt truncate it down to whatever tier finally fit
// the account's 8000 TPM limit — silently dropping most of a genuinely
// substantial document's content (confirmed on a real 52-page slide deck
// where pages ~20-52 never reached the model at all). CHUNK_THRESHOLD must
// therefore match the fast path's actual safe full-send capacity (draft
// tier 1's textChars) — anything larger MUST route to the chunked
// map-reduce pipeline instead, which never truncates (every chunk gets its
// own full analysis pass), rather than being silently cut down to size.
const CHUNK_THRESHOLD = 6000 // chars of extracted text; above this we go chunked — keep in sync with draftTiers[0].textChars below
// HOTFIX: larger chunks → fewer LLM rounds so ~50-page PDFs finish before Edge wall-clock
const CHUNK_TARGET_SIZE = 10000 // chars per chunk

// Madde 6 — model tiering (cost + TPM isolation)
// Heavy model: single-pass draft + synthesis (quality-critical, fewer calls)
// Fast model: per-chunk map + review (many calls, smaller completions)
const MODEL_HEAVY = "openai/gpt-oss-120b"
const MODEL_FAST = "qwen/qwen3.6-27b"
// Skip the expensive review pass for short, simple documents (saves ~1 full LLM call)
const SKIP_REVIEW_MAX_CHARS = 3500
const CHUNK_MAX_COMPLETION = 1536 // slightly smaller → faster chunk map
const SYNTHESIS_MAX_COMPLETION = 3072
const DRAFT_MAX_COMPLETION = 4096
const REVIEW_MAX_COMPLETION = 4096
// Cap parallel chunk calls to reduce TPM bursts.
// SPEED FIX: the long-document "windows" loop below used to await each
// window's Groq call one at a time (effective concurrency of 1) even though
// this constant existed — it was defined but never actually wired into that
// loop. For an 8-window document at up to 40s per window, that meant up to
// ~5 minutes just for this one stage, and it also meant the budgetLeft()
// early-stop kicked in after only 2-3 windows on longer documents (worse
// coverage, not just slower). The window loop now processes windows in
// concurrent batches of this size instead, which cuts that stage's
// wall-clock time roughly proportionally AND lets more windows complete
// within the same PIPELINE_BUDGET_MS. 3 is a moderate step up from the
// original (unused) value of 2 — each window's own extractWindow() retry
// logic already backs off gracefully on 429s, so a modest concurrency bump
// here trades a small increase in rate-limit retries for a large wall-clock
// win, without the aggressiveness of a bigger jump.
const CHUNK_CONCURRENCY = 3
const MAX_CHUNKS = 12 // hard ceiling: prefer finishing over analyzing every page under Edge timeout
// Soft wall-clock budget (ms) for the whole function — leave headroom under ~150s platform limit
const PIPELINE_BUDGET_MS = 110_000
// Floor for retrying a window after json_validate_failed. A retry is one more
// window call, which on this account's 8,000 TPM means a ~60s TokenPacer wait;
// below this there is no longer room for both that wait and the narrative
// writer afterwards, so the thin-but-complete card wins over a card with no
// written summary.
const JSON_RETRY_MIN_BUDGET_MS = 70_000

// Vision pass sizing, both numbers forced by the same 8,000 TPM ceiling.
//
// Groq bills every image at a flat 2,048 input tokens and accepts at most 3
// per request. Three would be 6,144 tokens of image alone; with the system
// prompt and the completion reservation that lands around 9,000 and the
// request is rejected outright. Two fits: 4,096 + ~330 prompt + ~1,840
// completion reservation is about 6,300, inside the pacer's 7,200 ceiling.
const VISION_TOKENS_PER_IMAGE = 2048
const VISION_MAX_IMAGES = 2
// The vision pass is an EXTRA call, and on this tier every extra call means a
// full ~60s TokenPacer wait before it can start. The narrative writer runs
// after it and has its own 35s budget gate, so the visual pass may only start
// when there is room for both: ~65s for itself, 35s for the writer's gate.
// Below that it skips itself, which is the correct trade — a card always has
// a written summary, and figure values are the optional extra.
const VISUAL_MIN_BUDGET_MS = 100_000

function computeAdaptiveTargets(charCount: number, lengthPreset: string) {
  const presets: Record<string, { summary: [number, number]; terms: [number, number]; points: [number, number]; quiz: [number, number]; capSummary: number; capTerms: number; capPoints: number; capQuiz: number }> = {
    short: { summary: [2, 3], terms: [3, 5], points: [3, 5], quiz: [3, 3], capSummary: 6, capTerms: 12, capPoints: 10, capQuiz: 6 },
    medium: { summary: [4, 8], terms: [5, 10], points: [5, 10], quiz: [4, 6], capSummary: 16, capTerms: 25, capPoints: 22, capQuiz: 12 },
    detailed: { summary: [12, 20], terms: [15, 20], points: [12, 18], quiz: [8, 10], capSummary: 28, capTerms: 40, capPoints: 35, capQuiz: 20 }
  }
  const p = presets[lengthPreset] || presets.medium
  // one "growth unit" per ~4000 extra characters beyond a 6000-char baseline
  // (a baseline-sized document gets exactly the old fixed numbers; only
  // longer-than-that documents scale up, and only up to the per-preset cap)
  const extraUnits = Math.max(0, Math.floor((charCount - 6000) / 4000))
  const grow = (range: [number, number], cap: number, perUnit: number): [number, number] => {
    const lo = Math.min(cap, Math.round(range[0] + extraUnits * perUnit))
    const hi = Math.min(cap, Math.round(range[1] + extraUnits * perUnit))
    return [lo, Math.max(lo, hi)]
  }
  return {
    summarySentences: grow(p.summary, p.capSummary, 1),
    keyTerms: grow(p.terms, p.capTerms, 1),
    keyPoints: grow(p.points, p.capPoints, 1),
    quizQuestions: grow(p.quiz, p.capQuiz, 0.5)
  }
}

function buildLengthInstruction(targets: ReturnType<typeof computeAdaptiveTargets>, lengthPreset: string): string {
  const [sLo, sHi] = targets.summarySentences
  const [tLo, tHi] = targets.keyTerms
  const [pLo, pHi] = targets.keyPoints
  const [qLo, qHi] = targets.quizQuestions
  const scaleNote = (sHi > 8 || tHi > 10 || pHi > 10)
    ? " This document is substantial, so make sure the summary, key terms, key points, and quiz questions genuinely cover its full breadth — not just the first portion of it."
    : ""
  if (lengthPreset === 'short') {
    return `Write a concise summary in ${sLo}-${sHi} sentences. Include only the ${tLo}-${tHi} most essential key terms, ${pLo}-${pHi} key points, and ${qLo}-${qHi} quiz questions.`
  } else if (lengthPreset === 'detailed') {
    return `Write a thorough, in-depth summary (${sLo}-${sHi} sentences). Include ${tLo}-${tHi} key terms, ${pLo}-${pHi} key points, and ${qLo}-${qHi} quiz questions covering the material comprehensively.${scaleNote}`
  }
  return `Write a balanced summary in ${sLo}-${sHi} sentences. Include ${tLo}-${tHi} key terms, ${pLo}-${pHi} key points, and ${qLo}-${qHi} quiz questions.${scaleNote}`
}

function splitIntoChunks(text: string, targetChunkSize: number): string[] {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ""

  for (const para of paragraphs) {
    if (para.length > targetChunkSize * 1.5) {
      if (current) { chunks.push(current); current = "" }
      for (let i = 0; i < para.length; i += targetChunkSize) {
        chunks.push(para.substring(i, i + targetChunkSize))
      }
      continue
    }
    if (current && (current.length + para.length + 2) > targetChunkSize) {
      chunks.push(current)
      current = para
    } else {
      current = current ? current + "\n\n" + para : para
    }
  }
  if (current) chunks.push(current)
  return chunks.length > 0 ? chunks : [text]
}

/**
 * Window builder for the live long-document path.
 *
 * The long-doc loop used to window by raw character offset
 * (`extractedText.slice(start, start + WINDOW)`). Measured against real
 * Turkish prose from this repo, that cut 92% of window boundaries
 * mid-sentence and 67% mid-WORD — each boundary handing the model a
 * fragment like "...provide generat | ive AI functions", which is exactly
 * the kind of garbled input that produces vague key points.
 *
 * splitIntoChunks() above already solves this (paragraph-aware, and
 * "--- SAYFA N ---" markers sit on their own lines so they survive as
 * boundaries), but on its own it can emit a chunk up to 1.5x the target
 * when a single paragraph is oversized — 50% more input tokens per call
 * than the old behaviour, which this account's tokens-per-minute cap
 * cannot absorb. So the paragraph-aware split is followed by a hard cap at
 * `maxChars`, guaranteeing per-window token cost never exceeds what the
 * char-offset version already spent.
 */
function splitIntoWindows(text: string, maxChars: number, maxWindows: number): string[] {
  const out: string[] = []
  for (const chunk of splitIntoChunks(text, maxChars)) {
    if (chunk.length <= maxChars) { out.push(chunk); continue }
    for (let i = 0; i < chunk.length; i += maxChars) out.push(chunk.slice(i, i + maxChars))
  }
  return out.slice(0, maxWindows)
}

type GroqJsonOpts = {
  model?: string
  temperature?: number
  maxCompletionTokens?: number
  timeoutMs?: number
  maxRetries?: number
}

// ==========================================================================
// TOKEN PACER — stop hitting the rate limit instead of recovering from it
//
// Live evidence (2026-10-04, 30-page chapter, two identical runs):
//
//   run A: both windows succeeded      -> 26 terms, 19 key points
//   run B: window 1 lost all 3 retries -> 14 terms,  8 key points
//
// Same document, same settings, half the output. Every failure was:
//
//   Rate limit reached ... tokens per minute (TPM): Limit 8000,
//   Used 7362, Requested 3873. Please try again in 24.26s
//
// The cause is that windows were fired CHUNK_CONCURRENCY-at-a-time with no
// idea of what the budget could absorb. At ~5,000 tokens a call against an
// 8,000 TPM ceiling, two simultaneous calls cannot both fit — so they knock
// each other out, and whether a student gets the good summary or the thin
// one is decided by a race.
//
// Retrying harder cannot fix that: when the per-minute window is already
// spent, every retry is just another 429, and the window loop's own budget
// then runs out before the remaining windows are ever tried.
//
// So this paces requests against a rolling 60-second token budget: a call
// waits until its estimated cost fits, and actual usage is recorded from
// the response afterwards. The real ceiling is read from Groq's own
// x-ratelimit-limit-tokens header, so an account upgrade raises throughput
// automatically with no code change.
// ==========================================================================
const PACER_SAFETY = 0.9             // headroom; actual usage is recorded, so this can be tight
const PACER_WINDOW_MS = 60_000
// MUST exceed PACER_WINDOW_MS. The first live run capped this at 55s and the
// logs showed exactly why that is wrong:
//
//   TokenPacer: 55000ms bekliyor (used=4600/6800, est=4378)
//   TokenPacer: 55000ms bekledi, yine de gonderiyor (used=4600, est=4378)
//
// `used` is unchanged after the wait, because an entry that was fresh when
// the wait began is only 55 seconds old at the end of it — still inside the
// 60-second window, so nothing aged out. The wait could not possibly have
// helped, and the call went out anyway: 55 seconds spent to arrive at the
// same place. Five of those is most of the two minutes that run took.
//
// A ceiling below the window length makes every long wait futile by
// construction, so this now sits just past it: a wait that is needed is a
// wait that completes.
const PACER_MAX_WAIT_MS = 65_000
// maxCompletionTokens is a CEILING, not a prediction — a window call asking
// for up to 3072 completion tokens typically spends far less. Charging the
// full ceiling up front made the pacer see a shortage that was not there and
// wait for room it did not need; the proof is that every "yine de
// gonderiyor" call then succeeded without a single 429. Actual usage is
// still recorded from the response, so this only affects the pre-flight
// estimate.
const PACER_COMPLETION_FACTOR = 0.6
const DEFAULT_TPM_LIMIT = 8000       // observed on this account until a header says otherwise

const tokenPacer = {
  limit: DEFAULT_TPM_LIMIT,
  limitKnown: false,
  spent: [] as Array<{ at: number; tokens: number }>,

  /** Drop entries older than the rolling window and total what's left. */
  used(now: number): number {
    this.spent = this.spent.filter(e => now - e.at < PACER_WINDOW_MS)
    return this.spent.reduce((n, e) => n + e.tokens, 0)
  },

  /** Groq reports the real ceiling on every response; believe it over our default. */
  observeHeaders(headers: Headers) {
    const raw = headers.get('x-ratelimit-limit-tokens')
    const n = raw ? parseInt(raw, 10) : NaN
    if (Number.isFinite(n) && n > 0 && n !== this.limit) {
      console.log(`TokenPacer: TPM limit ${this.limit} -> ${n} (Groq header)`)
      this.limit = n
      this.limitKnown = true
    } else if (Number.isFinite(n)) {
      this.limitKnown = true
    }
  },

  record(tokens: number) {
    if (Number.isFinite(tokens) && tokens > 0) this.spent.push({ at: Date.now(), tokens })
  },

  /** How many calls of this size can safely be in flight at once. */
  safeConcurrency(estTokensPerCall: number): number {
    if (!(estTokensPerCall > 0)) return 1
    return Math.max(1, Math.floor((this.limit * PACER_SAFETY) / estTokensPerCall))
  },

  /** Block until this call's estimated cost fits in the rolling budget. */
  async acquire(estTokens: number): Promise<void> {
    const budget = this.limit * PACER_SAFETY
    const started = Date.now()
    while (true) {
      const now = Date.now()
      const used = this.used(now)
      if (used + estTokens <= budget || used === 0) return
      // Wait for the oldest recorded spend to age out of the window.
      const oldest = this.spent[0]
      const needed = Math.max(250, PACER_WINDOW_MS - (now - oldest.at) + 250)
      const remaining = PACER_MAX_WAIT_MS - (now - started)
      // Never wait a length that cannot clear anything: if the time actually
      // required exceeds what we are willing to spend, waiting part of it
      // buys nothing and the call goes out either way. Send now and let the
      // 429 path (which honours Groq's own retry-after) handle it.
      if (needed > remaining) {
        console.warn(
          `TokenPacer: ${Math.round(needed)}ms gerekiyor ama ${Math.round(Math.max(0, remaining))}ms kaldi — ` +
          `beklemeden gonderiyor (used=${used}, est=${estTokens})`
        )
        return
      }
      const waitMs = needed
      console.log(`TokenPacer: ${Math.round(waitMs)}ms bekliyor (used=${used}/${Math.round(budget)}, est=${estTokens})`)
      await new Promise(r => setTimeout(r, waitMs))
    }
  }
}

/**
 * Pre-flight token estimate. Input is counted in full (we know its length);
 * the completion budget is counted at PACER_COMPLETION_FACTOR because it is
 * a ceiling the model rarely reaches — see that constant for the evidence.
 */
function estimateTokens(systemPrompt: string, userContent: string, maxCompletion: number): number {
  return Math.ceil((systemPrompt.length + userContent.length) / 3.2)
    + Math.ceil(maxCompletion * PACER_COMPLETION_FACTOR)
}

async function callGroqJson(
  groqApiKey: string,
  systemPrompt: string,
  userContent: string,
  temperatureOrOpts: number | GroqJsonOpts = 0.3
): Promise<any> {
  const opts: GroqJsonOpts = typeof temperatureOrOpts === 'number'
    ? { temperature: temperatureOrOpts }
    : (temperatureOrOpts || {})
  const model = opts.model || MODEL_HEAVY
  const temperature = opts.temperature ?? 0.3
  const maxCompletionTokens = opts.maxCompletionTokens ?? DRAFT_MAX_COMPLETION
  const timeoutMs = opts.timeoutMs ?? 25000
  const maxRetries = opts.maxRetries ?? 1

  const body: Record<string, unknown> = {
    model,
    temperature,
    max_completion_tokens: maxCompletionTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ]
  }
  // Reasoning controls only for models that support them (gpt-oss family)
  if (String(model).includes('gpt-oss') || String(model).includes('openai/')) {
    body.reasoning_effort = "low"
    body.include_reasoning = false
  }

  // Wait until this call fits the rolling per-minute budget, rather than
  // firing it and letting Groq reject it (see the TokenPacer comment above).
  const estTokens = estimateTokens(systemPrompt, userContent, maxCompletionTokens)
  await tokenPacer.acquire(estTokens)

  const response = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }, maxRetries, timeoutMs)

  tokenPacer.observeHeaders(response.headers)

  const data = await response.json()
  if (!response.ok) {
    // A rejected call still consumed budget in Groq's accounting, so record
    // the estimate — otherwise the pacer would under-count after a 429 and
    // immediately fire again into the same wall.
    tokenPacer.record(estTokens)
    throw new Error(`Groq API error (${response.status}): ${JSON.stringify(data)}`)
  }
  tokenPacer.record(
    Number(data?.usage?.total_tokens) ||
    (Number(data?.usage?.prompt_tokens) || 0) + (Number(data?.usage?.completion_tokens) || 0) ||
    estTokens
  )
  const raw = data.choices?.[0]?.message?.content ?? ""
  if (!raw) throw new Error("Empty Groq response content")
  const stripped = stripThinkBlock(raw)
  if (stripped === null) throw new Error("Model ran out of tokens mid-<think> block, never wrote the actual answer")
  const cleaned = stripped.replace(/```json\s*|```/g, "").trim()
  return JSON.parse(cleaned)
}

// Upload local file bytes to PDF.co via its presigned-URL flow (Denetim
// Raporu, 2026-08-31 — LIVE TEST FINDING). PDF.co's convert endpoints only
// accept a `url` pointing to an already-hosted file; they do NOT accept a
// direct multipart file body. Confirmed via a real 400 in production logs:
// "Long-doc PDF.co response status failed: 400" — the code below this
// comment (and, it turns out, the ORIGINAL fast-path PDF visual-analysis
// block further down, which used the exact same multipart pattern) was
// sending the file the wrong way. Both call sites now go through this one
// upload helper instead. Flow, per PDF.co's docs (developer.pdf.co/api/
// file-upload/generate-presigned-url): GET a presigned URL, PUT the raw
// bytes to it, then use the returned `url` field in the actual conversion
// call. Returns null on any failure.
async function uploadFileToPdfCo(fileBytes: Uint8Array, apiKey: string, filename: string): Promise<string | null> {
  try {
    const presignRes = await fetch(
      `https://api.pdf.co/v1/file/upload/get-presigned-url?name=${encodeURIComponent(filename)}`,
      { headers: { 'x-api-key': apiKey } }
    )
    if (!presignRes.ok) {
      console.warn(`PDF.co presigned-URL request failed: ${presignRes.status}`)
      return null
    }
    const presignData = await presignRes.json()
    if (presignData.error || !presignData.presignedUrl || !presignData.url) {
      console.warn('PDF.co presigned-URL response missing fields:', presignData)
      return null
    }
    const putRes = await fetch(presignData.presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: fileBytes
    })
    if (!putRes.ok) {
      console.warn(`PDF.co presigned upload PUT failed: ${putRes.status}`)
      return null
    }
    return presignData.url as string
  } catch (err) {
    console.error('PDF.co presigned upload flow failed:', err)
    return null
  }
}

// Convert SPECIFIC pages of a PDF to images via PDF.co (Denetim Raporu,
// 2026-08-31). The existing fast-path visual analysis below always asks for
// pages "0-7" — fine for a short document, but on a long slide deck the
// pages worth looking at visually are wherever the text extraction came back
// near-empty, which can be anywhere in the document (on our real test case,
// page 51 of 52). This is a separate, additive function so the working
// fast-path code above is untouched; it is only used by the chunked/long-doc
// path's visual-analysis patch further down, and only when that path has
// already identified which pages are worth converting.
// ==========================================================================
// WHICH PAGES GO TO THE VISION MODEL
//
// The old selector was `pageText.length < 150` — "a page with almost no text
// must be an image page". Measured on a 30-page lecture deck it picked pages
// 1 and 3, which are the publisher's two COVER SLIDES, and none of the eight
// pages that actually carry a figure. The deck's six figures each come with a
// caption of 200-800 characters, so they never looked blank.
//
// The caption itself is the reliable signal. On that same deck a header match
// scores 8/8 with no false positives: six "FIGURE 20.x" pages plus the two
// "ECONOMICS IN PRACTICE" feature pages, and the phrase appears nowhere else
// in the document.
//
// The near-blank list stays as the fallback for documents whose figures carry
// no caption at all (a scanned handout, an image-only deck) — there the old
// heuristic is the only signal available, and it is right for exactly that
// case.
// The Turkish spellings need explicit character classes for their i's. A
// case-insensitive regex cannot match "Şekil" against "ŞEKİL": İ (U+0130)
// lowercases to i + COMBINING DOT ABOVE, not to plain i, so /ŞEKİL/i silently
// fails on the ordinary capitalised form a caption actually uses. Same trap
// for GRAFİK and ÇİZELGE. Written this way all four of Şekil/ŞEKİL/Sekil/
// ŞEKIL match.
const FIGURE_CAPTION_RE =
  /^[ \t]*(FIGURE|TABLE|EXHIBIT|CHART|PLATE|Ş[EĖ]K[İIi]L|SEK[İIi]L|TABLO|GRAF[İIi]K|[ÇC][İIi]ZELGE)\b/im

function selectVisualPages(
  pdfPageTexts: string[],
  nearBlankIndices: number[],
  maxPages: number
): { indices: number[]; reason: string } {
  const captioned: Array<{ i: number; len: number }> = []
  for (let i = 0; i < pdfPageTexts.length; i++) {
    const t = pdfPageTexts[i] || ''
    if (FIGURE_CAPTION_RE.test(t)) captioned.push({ i, len: t.trim().length })
  }
  if (captioned.length > 0) {
    // Only VISION_MAX_IMAGES of them can go, so which ones matter. Taking the
    // first N means a long document only ever shows its opening figures, and
    // those are not the valuable ones.
    //
    // The ranking signal is the caption's own length: a figure whose caption
    // already explains it in prose has little left for the vision model to
    // add, while a chart with a one-line caption keeps everything — the axis
    // ranges, the levels, the turning points — inside the image. Measured on
    // the reference deck, shortest-caption-first puts Figure 20.2 (GDP
    // 1900-2014, 200 chars) and Figure 20.5 (unemployment, 222) at the top
    // and the circular-flow diagram (788 chars, fully described in words)
    // last, which is the right order.
    const ranked = [...captioned].sort((a, b) => a.len - b.len || a.i - b.i)
    const picked = ranked.slice(0, maxPages).map(p => p.i).sort((a, b) => a - b)
    return {
      indices: picked,
      reason: `sekil basligi (${captioned.length} aday, en kisa altyaziliar secildi)`
    }
  }
  return {
    indices: nearBlankIndices.slice(0, maxPages),
    reason: `sekil basligi yok, bos sayfa yedegi (${nearBlankIndices.length} aday)`
  }
}

async function extractVisualImagesForLongDoc(
  fileBytes: Uint8Array,
  pageIndices: number[] // 0-indexed page numbers to convert
): Promise<string[]> {
  const pdfcoApiKey = Deno.env.get('PDFCO_API_KEY')
  if (!pdfcoApiKey || pageIndices.length === 0) return []
  try {
    // Confirmed against PDF.co's own docs: comma-separated 0-indexed page
    // numbers/ranges is the correct format (e.g. "0, 2-4, !0").
    // Hard cap matches what one Groq request can carry at 2,048 tokens an
    // image on this account's TPM — rasterising more would only be thrown away.
    const pages = pageIndices.slice(0, VISION_MAX_IMAGES).join(',')
    console.log(`Long-doc visual analysis: converting page(s) [${pages}] via PDF.co...`)

    const fileUrl = await uploadFileToPdfCo(fileBytes, pdfcoApiKey, 'document.pdf')
    if (!fileUrl) {
      console.warn('Long-doc visual analysis: PDF.co file upload failed, skipping visual patch')
      return []
    }

    const pdfcoRes = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
      method: 'POST',
      headers: { 'x-api-key': pdfcoApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fileUrl, pages })
    })
    if (!pdfcoRes.ok) {
      let bodyText = ''
      try { bodyText = await pdfcoRes.text() } catch (_e) { /* ignore */ }
      console.warn(`Long-doc PDF.co response status failed: ${pdfcoRes.status} — ${bodyText.slice(0, 500)}`)
      return []
    }
    const pdfcoData = await pdfcoRes.json()
    if (pdfcoData.error || !(pdfcoData.urls || pdfcoData.url)) {
      console.warn("Long-doc PDF.co API returned error:", pdfcoData)
      return []
    }
    const rawUrls = pdfcoData.urls || pdfcoData.url
    const imageUrls: string[] = Array.isArray(rawUrls) ? rawUrls : [rawUrls]

    const base64Images: string[] = []
    for (const imgUrl of imageUrls) {
      try {
        const imgRes = await fetch(imgUrl)
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer()
          base64Images.push(bytesToBase64(new Uint8Array(buffer)))
        }
      } catch (imgDownloadErr) {
        console.error(`Long-doc: failed to download page image from ${imgUrl}:`, imgDownloadErr)
      }
    }
    return base64Images
  } catch (err) {
    console.error("Long-doc PDF.co page conversion failed:", err)
    return []
  }
}

function buildChunkSystemPrompt(chunkIndex: number, totalChunks: number, langLabel: string, hasPageMarkers: boolean, pageMarkerLabel: string): string {
  return `You are an academic study assistant helping process a LARGE document that has been split into ${totalChunks} sequential parts because of its length. You are given ONLY part ${chunkIndex + 1} of ${totalChunks} below — you do NOT see the rest of the document, so do not reference "the whole document" or assume content beyond what's shown here.

Respond with ONLY a valid JSON object, no markdown code fences, no commentary before or after — matching this exact shape: { "chunk_summary": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "tables": [ { "title": string, "headers": [ string ], "rows": [ [ string ] ] } ], "charts": [ { "title": string, "type": string, "labels": [ string ], "data": [ number ] } ], "footnotes": [ { "id": number, "reference": string, "page": number | null } ], "is_quantitative": boolean, "formulas": [ { "name": string, "latex": string, "variables": [ { "symbol": string, "meaning": string } ] } ], "worked_examples": [ { "title": string, "problem_statement": string, "steps": [ string ], "final_answer": string } ], "diagrams": [ { "title": string, "mermaid": string, "description": string } ], "concept_graph": { "nodes": [ { "id": string, "label": string, "type": string } ], "edges": [ { "from": string, "to": string, "relation": string } ] } }.

CHUNK SUMMARY:
Write a 2-4 sentence "chunk_summary" capturing specifically what THIS part covers — it will later be combined with the other parts' summaries into one final document summary, so be concrete and self-contained about the actual topics discussed here rather than vague.

EXTRACTION SCOPE:
Extract key terms, key points, and 1-3 quiz questions found in THIS PART ONLY. Scale the amount to how much substantive academic content this part actually contains — a short or mostly administrative/transitional part may legitimately warrant few or even zero key terms/points/quiz questions. Do not pad for the sake of padding.

EXAM-FOCUSED CONTENT FILTERING (not optional):
Separate this part's content into (a) actual academic subject matter — concepts, definitions, theories, frameworks/models, processes, relationships, formulas, examples — and (b) course administration/logistics — grading weights/percentages, exam format/rules, attendance policy, bonus/late-submission policy, grade-appeal procedures, office hours, textbook title/edition. ONLY (a) belongs in chunk_summary, key_points, footnotes, or quiz_questions. COMPLETELY EXCLUDE (b), even if its numbers are specific and checkable — a student is never tested on grading weights or textbook editions. If this part is mostly administrative logistics, it is correct to return few or zero key_terms/key_points/quiz_questions for it — do not pad with excluded content.

QUANTITATIVE & FORMULAS:
Set "is_quantitative" true if this part centers on mathematical formulas, numerical calculations, or financial/statistical computations. Extract EVERY distinct formula into 'formulas'. Use valid raw LaTeX ONLY (no surrounding $ or \\( \\) delimiters) — examples: "E = mc^2", "\\\\frac{a}{b}", "\\\\sum_{i=1}^{n} x_i", "F = ma". For each formula also list its variables with meanings. Additionally produce 1-2 worked_examples when formulas are present (prefer the source's own example with its real numbers; otherwise generate one clear realistic practice example). Return empty arrays if not applicable to this part.

TABLES & CHARTS:
Identify any tabular data ('tables') or chart-worthy numeric data ('charts', type "bar"|"pie"|"line") actually present in this part. Empty arrays are the correct output if none exists — never fabricate.

DIAGRAMS (Mermaid reconstruction):
You only see extracted text — visual layout (boxes, arrows, side-by-side positioning) is lost. A flowchart, comparison diagram, process illustration, hierarchy or cycle on the original slide/page often survives only as a cluster of short disconnected phrases, sequential stage names, or paired opposing terms. When you detect such a structure in THIS part, RECONSTRUCT it as a real Mermaid diagram and put it in the "diagrams" array:
{ "title": "short descriptive title", "mermaid": "valid Mermaid source code", "description": "1-2 sentence plain-language explanation of what the diagram shows" }.
Prefer these Mermaid types: flowchart TD, flowchart LR, graph TD, sequenceDiagram, mindmap. Keep syntax simple and valid (no experimental plugins). Limit to the 1-2 most important diagrams in this part. Also still add a key_point prefixed with "Diyagram/Görsel:" (or "Diagram/Visual:" in English) that briefly states the same idea. Return empty "diagrams" array when nothing is reconstructible — never invent diagrams that have no basis in the text.

CONCEPT GRAPH (this part only):
Extract the main academic concepts that appear in THIS part and their relationships. Output in concept_graph:
- nodes: [{ "id": "c1", "label": "Concept Name", "type": "concept" }] — short, exam-relevant concept labels (3-8 words max). Use sequential ids c1, c2, ... within this part.
- edges: [{ "from": "c1", "to": "c2", "relation": "includes" }] — only real relationships visible in the text. Allowed relation values: includes, is_a, causes, part_of, related_to, depends_on, contrasts_with.
Keep it focused: 3-8 nodes and 2-10 edges max for this part. Empty nodes/edges arrays are correct if this part has little conceptual structure.

FOOTNOTES:
For specific, checkable factual claims within key_points (numbers, definitions, named findings), add a footnote marker like [1], [2] immediately after the claim (numbering restarts at 1 for this part — it will be renumbered globally later). List each in 'footnotes': [{ "id": number, "reference": "brief description of the topic/heading this relates to", "page": number | null }]. ${buildFootnotePageInstruction(hasPageMarkers, pageMarkerLabel)} Don't over-footnote.

ACCURACY:
Base everything STRICTLY on the text in this part. Do not invent facts or assume content not shown. Copy specific numbers, names, and technical terms exactly as they appear.

LANGUAGE:
Respond entirely in: '${langLabel}'.`
}

function buildSynthesisSystemPrompt(courseCatalogBlock: string, langLabel: string, styleInstruction: string, summaryLengthPhrase: string): string {
  return `You are an academic study assistant. A large document was split into sequential parts and each part was already summarized independently. Below you are given all of those part-summaries, in order, plus a hint about what fraction were flagged as quantitative. Your job is to synthesize ONE cohesive, well-organized final summary of the ENTIRE document — write a genuinely unified narrative that flows across the whole document, not a mechanical concatenation of the part-summaries.

Respond with ONLY a valid JSON object, no markdown fences, no commentary before or after: { "summary": string, "summary_executive": string, "document_type": string, "suggested_course_tag": string | null, "is_quantitative": boolean, "outline": { "document_title_guess": string, "items": [ { "id": string, "heading": string, "blurb": string, "level": number, "order": number, "parent_id": string | null } ] }, "sections": [ { "heading": string, "summary": string, "key_points": [ string ], "outline_id": string | null } ], "concept_graph": { "nodes": [ { "id": string, "label": string, "type": string } ], "edges": [ { "from": string, "to": string, "relation": string } ] } }.

EXECUTIVE SUMMARY:
Write "summary_executive" as a 2-3 sentence ultra-short overview that NAMES the actual subject (e.g. "machine learning lecture notes covering supervised learning, neural nets, and evaluation metrics"). Forbidden: vague lines like "this document provides a qualitative overview of key concepts".

OUTLINE ENGINE (document skeleton — REQUIRED when the material has structure):
Build "outline" as a table-of-contents for the whole document:
- document_title_guess: short title if evident, else ""
- items: 3-12 entries in reading order. Each: { "id": "o1", "heading": "2-6 word label", "blurb": "one sentence: what this part contributes to the document", "level": 1 or 2, "order": 1, "parent_id": null or parent id }
- level 1 = major parts; level 2 = sub-topics under a parent
- Headings MUST reflect real topics from the part-summaries (e.g. "Supervised Learning", "Neural Networks", "Evaluation Metrics") — NOT generic labels like "Introduction", "Main Discussion", "Conclusion", "Key Concepts" when specific topics exist
- Never include pure admin/logistics (grading weights, attendance, office hours, textbook edition)
- If the document is truly one continuous topic with no natural splits, return 2-3 coarse items rather than an empty list

CONCEPT GRAPH (whole document):
From the part-summaries, build a unified concept_graph covering the whole document. nodes: [{ "id": "c1", "label": "...", "type": "concept" }], edges: [{ "from": "c1", "to": "c2", "relation": "includes"|"is_a"|"causes"|"part_of"|"related_to"|"depends_on"|"contrasts_with" }]. 5-15 nodes and their real relationships. Reuse consistent ids. Empty graph only if the material truly has no conceptual structure.

DOCUMENT-TYPE CLASSIFICATION:
Identify the overall document type as exactly one of: "Lecture Notes/Slides", "Academic Article", "Syllabus", "Case Study", "Textbook Chapter", or "Other".

SECTION PASS (deep per-topic summaries — aligned with outline):
Output "sections" as 2-8 items matching major outline level-1 topics. Each item MUST be:
{ "heading": "same as outline", "summary": "4-8 sentence DEEP academic summary of ONLY this topic — coherent paragraph(s), not a bullet dump; explain arguments, definitions, and why it matters", "key_points": ["3-6 concrete takeaways for this section only"], "outline_id": "o1" }
Rules:
- summary must be substantially longer and more specific than outline.blurb
- Do not repeat the whole-document summary inside every section
- Skip pure administration (grading, attendance, textbook edition)
- If outline has items, sections should mirror those level-1 headings and set outline_id accordingly

SUGGESTED COURSE TAG:
Below is this student's OFFICIAL course catalog (format: CODE — Course Name):
${courseCatalogBlock}
Compare the document's content against this catalog. If it clearly matches one listed course, return that course's EXACT code (character-for-character). Otherwise, if a course code or clear subject label is evident from the part-summaries, use that as free text instead. If genuinely unclear and nothing fits, return null. Never invent a code that isn't in the catalog above and isn't evident in the part-summaries.

IS_QUANTITATIVE:
You'll be told what fraction of parts were flagged quantitative — combine that with your own reading of the part-summaries to make one final true/false call for the document as a whole.

LENGTH INSTRUCTION:
${summaryLengthPhrase}

STYLE INSTRUCTION:
${styleInstruction}

LANGUAGE INSTRUCTION:
Respond strictly in: '${langLabel}' (except "document_type", which must be one of the exact English strings listed above).

ACCURACY:
Base the summary strictly on the part-summaries provided — do not invent content beyond what they describe.
The summary MUST mention concrete terms, methods, or chapter themes that appear in the part-summaries. Generic academic filler without domain content is a failure.

EXAM-FOCUSED CONTENT FILTERING (not optional):
If any part-summary contains course administration/logistics — grading weights, exam format/rules, attendance policy, grade-appeal procedures, office hours, textbook title/edition — EXCLUDE it from your final summary entirely, even if it was mistakenly included in a part-summary. Only synthesize the actual academic subject matter (concepts, theories, definitions, processes, relationships, formulas, examples).`
}

function dedupeKeyTerms(terms: any[]): any[] {
  const seen = new Map<string, any>()
  for (const t of terms) {
    if (!t || !t.term) continue
    const key = String(t.term).trim().toLowerCase()
    if (!seen.has(key)) seen.set(key, t)
  }
  return Array.from(seen.values())
}

/** Normalize deep sections: heading + long summary + key_points + outline_id */
function normalizeSections(raw: any, outline?: { items?: any[] } | null): any[] {
  const arr = Array.isArray(raw) ? raw : []
  const outlineItems = outline?.items || []
  return arr
    .filter((s: any) => s && (s.heading || s.title))
    .map((s: any, idx: number) => {
      const heading = String(s.heading || s.title || '').trim()
      const summary = String(s.summary || s.body || '').trim()
      let keyPoints: string[] = []
      if (Array.isArray(s.key_points)) {
        keyPoints = s.key_points
          .map((p: any) => String(typeof p === 'string' ? p : (p?.point || p?.text || '')).trim())
          .filter(Boolean)
      }
      let outlineId = s.outline_id || s.outlineId || null
      if (!outlineId && outlineItems.length) {
        const match = outlineItems.find((o: any) =>
          String(o.heading || '').toLowerCase() === heading.toLowerCase()
        )
        if (match) outlineId = match.id
      }
      return {
        heading,
        summary,
        key_points: keyPoints.slice(0, 8),
        outline_id: outlineId,
        order: Number(s.order) || idx + 1
      }
    })
    .filter((s: any) => s.heading.length > 0 && s.summary.length > 0)
}

/** Normalize outline from model output into a stable shape for study_cards.outline */
function normalizeOutline(raw: any, sectionsFallback?: any[]): { document_title_guess: string; items: any[] } {
  const empty = { document_title_guess: '', items: [] as any[] }
  if (raw && typeof raw === 'object' && Array.isArray(raw.items) && raw.items.length > 0) {
    const items = raw.items
      .filter((it: any) => it && (it.heading || it.title))
      .map((it: any, idx: number) => ({
        id: String(it.id || `o${idx + 1}`),
        heading: String(it.heading || it.title || '').trim(),
        blurb: String(it.blurb || it.summary || it.role || '').trim(),
        level: Math.min(3, Math.max(1, Number(it.level) || 1)),
        order: Number(it.order) || idx + 1,
        parent_id: it.parent_id || it.parent || null
      }))
      .filter((it: any) => it.heading.length > 0)
    return {
      document_title_guess: String(raw.document_title_guess || raw.title || '').trim(),
      items
    }
  }
  // Fallback: lift flat sections into outline items
  if (Array.isArray(sectionsFallback) && sectionsFallback.length > 0) {
    return {
      document_title_guess: '',
      items: sectionsFallback
        .filter((s: any) => s && (s.heading || s.title))
        .map((s: any, idx: number) => ({
          id: `o${idx + 1}`,
          heading: String(s.heading || s.title || '').trim(),
          blurb: String(s.summary || s.blurb || '').trim().slice(0, 280),
          level: 1,
          order: idx + 1,
          parent_id: null
        }))
    }
  }
  return empty
}

function normalizeForDedup(s: string): string {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim()
}

// ==========================================================================
// NEAR-DUPLICATE MERGE
//
// dedupeByText below keys on the first 50 normalised characters:
//
//     const sig = norm.slice(0, 50)
//
// That catches an exact repeat but misses the kind of duplicate this
// pipeline actually produces. Each window is summarised independently and
// never sees its neighbours, so the same idea comes back worded differently
// from two windows:
//
//     "Talep esnekliği fiyat değişimine duyarlılığı ölçer"
//     "Esneklik, fiyat değişimine talebin duyarlılığıdır"
//
// Different first 50 characters, so both survive and the student reads the
// same fact twice — and both occupy slots in a capped list, pushing out
// content that is actually new.
//
// Comparing content-term sets catches them. The overlap COEFFICIENT (shared
// terms over the smaller set) is used rather than Jaccard on purpose: a
// short point that is fully contained in a longer one is a duplicate, and
// Jaccard would score that pair low simply because the lengths differ.
// ==========================================================================
const NEAR_DUP_THRESHOLD = 0.7   // share of the smaller term set that must match
const NEAR_DUP_MIN_TERMS = 3     // below this, wording is too thin to compare

// Fixed-prefix stem length for duplicate comparison.
//
// Exact token matching collapses on Turkish, which is precisely where this
// merge is needed: "esneklik"/"esnekliği", "duyarlılığı"/"duyarlılığını" and
// "talep"/"talebin" are the same word, and comparing them literally scored
// the two paraphrases below the threshold — so the duplicate survived.
//
// Raising the threshold's tolerance instead would have merged genuinely
// different points, so the cause is fixed rather than the bar lowered. The
// Postgres side solves this with the snowball Turkish stemmer; there is no
// stemmer available inside a Deno edge function, so fixed-prefix stemming
// stands in. It works because Turkish is suffixing: cut the suffixes off and
// the stem is the prefix. Five characters is the length long established for
// Turkish retrieval — short enough to survive inflection, long enough that
// unrelated words do not collide.
//
// Used ONLY for duplicate detection. Citation anchoring deliberately keeps
// stricter matching, because there a false match means pointing a student at
// the wrong page.
const NEAR_DUP_STEM_LEN = 5

function nearDupStem(term: string): string {
  const t = String(term || '')
  return t.length <= NEAR_DUP_STEM_LEN ? t : t.slice(0, NEAR_DUP_STEM_LEN)
}

function nearDupTermSet(text: string): Set<string> {
  return new Set(anchorTerms(text).map(nearDupStem))
}

/**
 * Collapse near-duplicates, keeping the more informative wording (the longer
 * text) of each group rather than whichever happened to come first.
 * Preserves input order based on where each surviving item first appeared.
 */
function dedupeNearDuplicates(items: any[], getText: (item: any) => string): any[] {
  const list = Array.isArray(items) ? items : []
  type Kept = { item: any; terms: Set<string>; order: number; len: number }
  const kept: Kept[] = []

  for (let i = 0; i < list.length; i++) {
    const text = String(getText(list[i]) || '')
    if (!text.trim()) continue
    const terms = nearDupTermSet(text)

    if (terms.size < NEAR_DUP_MIN_TERMS) { kept.push({ item: list[i], terms, order: kept.length, len: text.length }); continue }

    let mergedInto = -1
    for (let k = 0; k < kept.length; k++) {
      const other = kept[k]
      if (other.terms.size < NEAR_DUP_MIN_TERMS) continue
      let shared = 0
      for (const t of terms) if (other.terms.has(t)) shared++
      const overlap = shared / Math.min(terms.size, other.terms.size)
      if (overlap >= NEAR_DUP_THRESHOLD) { mergedInto = k; break }
    }

    if (mergedInto === -1) {
      kept.push({ item: list[i], terms, order: kept.length, len: text.length })
    } else if (text.length > kept[mergedInto].len) {
      // Same idea, better stated — keep the fuller wording at the original
      // position so ordering stays stable.
      kept[mergedInto] = { item: list[i], terms, order: kept[mergedInto].order, len: text.length }
    }
  }

  return kept.sort((a, b) => a.order - b.order).map(k => k.item)
}

function dedupeByText(items: any[], getText: (item: any) => string): any[] {
  const seen = new Set<string>()
  const out: any[] = []
  for (const item of items) {
    const norm = normalizeForDedup(getText(item))
    if (!norm) continue
    const sig = norm.slice(0, 50)
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push(item)
  }
  return out
}

/** Build cloze (fill-in-the-blank) cards from key terms and key points.
 *  Prefer model-produced cloze_cards when present; otherwise derive deterministically.
 *  Each card: { id, prompt, answer, full_text, source }
 */
function buildClozeCards(
  modelClozes: any[] | undefined,
  keyTerms: any[],
  keyPoints: any[],
  maxCards = 20
): any[] {
  const out: any[] = []
  const seenAnswers = new Set<string>()

  // 1) Keep valid model-produced clozes first
  if (Array.isArray(modelClozes)) {
    for (const c of modelClozes) {
      if (!c || !c.prompt || !c.answer) continue
      const ansKey = String(c.answer).trim().toLowerCase()
      if (!ansKey || seenAnswers.has(ansKey)) continue
      seenAnswers.add(ansKey)
      out.push({
        id: c.id || `cl${out.length + 1}`,
        prompt: String(c.prompt).trim(),
        answer: String(c.answer).trim(),
        full_text: String(c.full_text || c.prompt.replace(/_{2,}/g, c.answer)).trim(),
        source: c.source || 'model'
      })
      if (out.length >= maxCards) return out
    }
  }

  // 2) Derive from key_terms: "X is defined as Y" → blank the term
  for (const t of (keyTerms || [])) {
    if (out.length >= maxCards) break
    const term = String(t?.term || '').trim()
    const def = String(t?.definition || '').trim()
    if (!term || !def || term.length < 2) continue
    const ansKey = term.toLowerCase()
    if (seenAnswers.has(ansKey)) continue
    seenAnswers.add(ansKey)
    // Prefer blanking the term inside the definition when it appears; else "___ : definition"
    let prompt: string
    const defHasTerm = def.toLowerCase().includes(term.toLowerCase())
    if (defHasTerm) {
      // case-insensitive replace first occurrence
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      prompt = def.replace(re, '___')
    } else {
      prompt = `___: ${def}`
    }
    out.push({
      id: `cl${out.length + 1}`,
      prompt,
      answer: term,
      full_text: defHasTerm ? def : `${term}: ${def}`,
      source: 'key_term'
    })
  }

  // 3) Derive from short key_points that contain a clear noun phrase (optional, limited)
  for (const p of (keyPoints || [])) {
    if (out.length >= maxCards) break
    const text = String(typeof p === 'string' ? p : (p?.point || p?.text || '')).trim()
    if (!text || text.length < 20 || text.length > 180) continue
    // Heuristic: blank the first capitalized multi-word phrase or a quoted term
    const m = text.match(/[""']([^""']{3,40})[""']/) || text.match(/\b([A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü\-]{2,}(?:\s+[A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü\-]{2,}){0,3})\b/)
    if (!m) continue
    const answer = m[1].trim()
    if (answer.length < 3 || seenAnswers.has(answer.toLowerCase())) continue
    // Don't blank if it's the whole sentence
    if (answer.length > text.length * 0.6) continue
    seenAnswers.add(answer.toLowerCase())
    const prompt = text.replace(answer, '___')
    if (prompt === text) continue
    out.push({
      id: `cl${out.length + 1}`,
      prompt,
      answer,
      full_text: text,
      source: 'key_point'
    })
  }

  return out
}

function roundRobinInterleave<T>(lists: T[][]): T[] {
  const out: T[] = []
  let idx = 0
  let anyLeft = true
  while (anyLeft) {
    anyLeft = false
    for (const list of lists) {
      if (idx < list.length) {
        out.push(list[idx])
        anyLeft = true
      }
    }
    idx++
  }
  return out
}

// (remapChunkFootnotes was removed on 2026-10-03: it renumbered footnotes
// per-chunk with an offset, which only made sense while each chunk produced
// its own footnotes. Citations are now derived centrally in
// anchorCitations() from the page index, so a single dense renumbering
// there replaces it. applyFootnoteRemap below is still used — by that
// function and by the summary remap at the call site.)

function applyFootnoteRemap(text: string, idMap: Record<number, number>): string {
  if (!text) return text
  return text.replace(/\[(\d+)\]/g, (match, idStr) => {
    const oldId = parseInt(idStr, 10)
    const newId = idMap[oldId]
    return newId != null ? `[${newId}]` : match
  })
}

// Shared instruction text telling the model how to populate the new
// footnotes[].page field — either real page/slide numbers copied from the
// "--- SAYFA N ---" / "--- SLAYT N ---" markers inserted during extraction
// (see PDF/PPTX extraction above), or null with the old topic/heading
// description when no such markers exist for this document (DOCX/plain text,
// which have no reliable fixed-page concept).
function buildFootnotePageInstruction(hasPageMarkers: boolean, pageMarkerLabel: string): string {
  if (hasPageMarkers) {
    const unitWord = pageMarkerLabel === "SLAYT" ? "slide" : "page"
    return `The source text contains markers in the form "--- ${pageMarkerLabel} N ---" marking where each ${unitWord} begins. For every footnote, set "page" to the N of the marker that appears immediately BEFORE the claim in the source text — this must be a real number copied from an actual marker you saw, never guessed or estimated. Still also write a short "reference" description as before (e.g. 'Introduction section').`
  }
  return `This document has no page/slide markers available, so set "page" to null for every footnote and continue describing the topical section or heading area in "reference" as before.`
}

// ==========================================================================
// DETERMINISTIC PAGE ANCHORING (citations without spending model tokens)
//
// Why this exists, and why it is NOT another prompt instruction:
//
//   The long-document path used to ship `footnotes: []` hardcoded — long
//   documents got no citations at all. The obvious fix (add a "footnotes"
//   field to compactWindowPrompt's JSON schema and ask the model for them)
//   is the SAME mistake that was already made and correctly reverted for
//   concept_graph (see the merge block below): every extra schema field
//   competes for the same `maxCompletionTokens` budget, so the model pays
//   for citations by returning fewer key terms/points — and on an account
//   whose observed tokens-per-minute cap is as low as 8,000, extra output
//   tokens also push window calls into 429 territory.
//
//   Worse, a model-reported page number is unverifiable: nothing checked
//   that the page it named actually contains the claim. A footnote that
//   jumps the PDF viewer to the wrong page is worse than no footnote,
//   because the student stops trusting every citation on the card.
//
//   So citations are COMPUTED here instead, from text we already have:
//   the "--- SAYFA N ---" / "--- SLAYT N ---" markers inserted at
//   extraction time give us a page->text index, and each claim is matched
//   against that index by inverse-page-frequency-weighted term overlap.
//   Cost: zero extra model tokens, zero extra API calls. A page number
//   produced this way is one where the claim's distinctive vocabulary
//   demonstrably appears, so "page 7" means page 7 really discusses it.
//
//   The same index also VALIDATES the short/fast path's model-produced
//   footnote pages, which were previously trusted blind.
// ==========================================================================

// Terms this common carry no signal about WHICH page a claim came from.
const ANCHOR_STOPWORDS = new Set([
  // Turkish
  'ancak', 'ayrıca', 'bunun', 'burada', 'çünkü', 'daha', 'değil', 'diğer', 'fakat',
  'gibi', 'göre', 'için', 'ile', 'olan', 'olarak', 'olduğu', 'olur', 'sonra', 'şekilde',
  'bütün', 'böyle', 'kadar', 'sadece', 'tüm', 'üzerinde', 'vardır', 'veya', 'yani',
  'bazı', 'birlikte', 'eğer', 'hem', 'ise', 'yine', 'çok', 'önemli', 'bölüm', 'konu',
  // English
  'about', 'after', 'also', 'because', 'been', 'between', 'both', 'does', 'each',
  'from', 'have', 'however', 'into', 'more', 'most', 'other', 'should', 'such',
  'than', 'that', 'their', 'then', 'there', 'these', 'this', 'those', 'through',
  'under', 'when', 'where', 'which', 'while', 'will', 'with', 'would', 'they',
  'important', 'section', 'chapter', 'example', 'following'
])

/** Content-bearing terms of a string: >=4 chars, not a stopword, diacritics kept. */
function anchorTerms(s: string): string[] {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !ANCHOR_STOPWORDS.has(w))
}

type PageSegment = { page: number; terms: Set<string>; head: string; body: string }

// Abbreviations whose trailing dot must NOT end a sentence. Without this a
// Turkish academic page splits at "s. 42", "vb.", "Prof. Dr." and the quote
// shown to the student becomes a two-word fragment.
const SENTENCE_ABBREV = new Set([
  's', 'ss', 'vb', 'vs', 'bkz', 'örn', 'orn', 'age', 'agm', 'yy', 'bkz',
  'dr', 'doç', 'doc', 'prof', 'yrd', 'arş', 'ars', 'gör', 'gor', 'no', 'nr',
  'yay', 'çev', 'cev', 'ed', 'vol', 'pp', 'fig', 'eq', 'etc', 'al'
])

/**
 * Split prose into sentences, conservatively. Over-merging two sentences is
 * harmless here (the quote is simply a little longer); splitting mid-sentence
 * is not, because the fragment is shown to the student as the source text.
 */
function splitSentences(text: string): string[] {
  const rough = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…])\s+/)
  const out: string[] = []
  for (const piece of rough) {
    const prevNeedsMerge = out.length > 0 && (() => {
      const prev = out[out.length - 1]
      const lastWord = (prev.match(/([\p{L}\p{N}]+)\.$/u) || [])[1]
      if (!lastWord) return false
      // "...vb." / "...s." / a bare initial like "A." / a list number "3."
      return SENTENCE_ABBREV.has(lastWord.toLowerCase())
        || lastWord.length <= 2
        || /^\d+$/.test(lastWord)
    })()
    if (prevNeedsMerge) out[out.length - 1] += ' ' + piece
    else out.push(piece)
  }
  return out.map(s => s.trim()).filter(s => s.length > 0)
}

// A quote shorter than this carries no context; longer than this is a wall of
// text in a tooltip.
const QUOTE_MIN_CHARS = 25
const QUOTE_MAX_CHARS = 220

/**
 * The sentence on this page that best supports the claim, returned VERBATIM
 * so it can be checked against the source. This is what turns "page 7" into
 * "page 7 says this", which is the whole difference between a citation a
 * student trusts and one they learn to ignore.
 *
 * Returns null when no sentence matches well enough; the caller then falls
 * back to the page's heading line.
 */
function bestQuoteForClaim(claim: string, body: string, idf: Map<string, number>): string | null {
  const claimTerms = [...new Set(anchorTerms(claim))]
  if (!claimTerms.length) return null
  const fallbackIdf = Math.log(2)
  const totalWeight = claimTerms.reduce((a, t) => a + (idf.get(t) ?? fallbackIdf), 0)
  if (totalWeight <= 0) return null

  let best: { text: string; score: number } | null = null
  for (const raw of splitSentences(body)) {
    if (raw.length < QUOTE_MIN_CHARS) continue
    const sentTerms = new Set(anchorTerms(raw))
    if (!sentTerms.size) continue
    let w = 0, matched = 0
    for (const t of claimTerms) {
      if (sentTerms.has(t)) { w += (idf.get(t) ?? fallbackIdf); matched++ }
    }
    if (matched < 2) continue
    // Normalising by the claim's own weight (not the sentence's) keeps a long
    // rambling sentence from winning just by containing more words.
    const score = w / totalWeight
    if (!best || score > best.score) best = { text: raw, score }
  }
  if (!best || best.score < 0.3) return null
  return best.text.length > QUOTE_MAX_CHARS
    ? best.text.slice(0, QUOTE_MAX_CHARS).replace(/\s+\S*$/, '') + '…'
    : best.text
}

// ==========================================================================
// REPEATED BOILERPLATE — the running header/footer tax
//
// A lecture deck or a textbook chapter repeats the same line on every page:
// a copyright notice, a course code, a running title, a page number. The
// model pays for every copy. Measured on a 30-page deck: "Copyright © 2017
// Pearson Education, Inc." plus its "20-1 / 20-2 / ..." page number came to
// ~1,700 of 12,451 characters — 13% of everything the model was shown, none
// of it study material, on a budget where one window is already 6,200 of the
// account's 8,000 tokens per minute.
//
// Detection is positional, not a pattern list: a line is boilerplate when it
// is SHORT and appears on MOST pages. Nothing about copyright or Pearson is
// hardcoded, so it generalises to whatever a given course's deck repeats.
//
// Three guards keep it from eating content:
//   - documents with too few pages are left alone (no basis to judge)
//   - only short lines qualify; a repeated paragraph is not a running header
//   - digits are wildcarded for COUNTING only ("20-1" and "20-2" are the same
//     footer), never for matching anything else
const BOILERPLATE_MIN_PAGES = 5
const BOILERPLATE_PAGE_SHARE = 0.6
const BOILERPLATE_MAX_LINE_CHARS = 120

function boilerplateKey(line: string): string {
  return line
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripRepeatedBoilerplate(
  text: string,
  pageMarkerLabel: string
): { text: string; removed: string[]; charsSaved: number } {
  const pages = splitByPageMarkers(text, pageMarkerLabel)
  // One segment with page === null means the document has no page markers at
  // all (DOCX / plain text) — there is nothing to compare across.
  if (pages.length < BOILERPLATE_MIN_PAGES || pages[0]?.page === null) {
    return { text, removed: [], charsSaved: 0 }
  }

  // How many distinct pages carry each short line?
  const pageCount = new Map<string, number>()
  const sample = new Map<string, string>()
  for (const p of pages) {
    const seen = new Set<string>()
    for (const raw of p.body.split('\n')) {
      const line = raw.trim()
      if (!line || line.length > BOILERPLATE_MAX_LINE_CHARS) continue
      const key = boilerplateKey(line)
      if (!key || seen.has(key)) continue
      seen.add(key)
      pageCount.set(key, (pageCount.get(key) || 0) + 1)
      if (!sample.has(key)) sample.set(key, line)
    }
  }

  const threshold = Math.ceil(pages.length * BOILERPLATE_PAGE_SHARE)
  const boilerplate = new Set(
    [...pageCount.entries()].filter(([, n]) => n >= threshold).map(([k]) => k)
  )
  if (boilerplate.size === 0) return { text, removed: [], charsSaved: 0 }

  const rebuilt = pages.map(p => {
    const kept = p.body.split('\n').filter(raw => {
      const line = raw.trim()
      if (!line || line.length > BOILERPLATE_MAX_LINE_CHARS) return true
      return !boilerplate.has(boilerplateKey(line))
    })
    // Never blank a page out entirely: a page whose every line looks repeated
    // is more likely a detector mistake than a genuinely empty page, and an
    // empty page breaks the citation anchor for anything that cites it.
    const body = kept.join('\n').trim() ? kept.join('\n') : p.body
    return `--- ${pageMarkerLabel} ${p.page} ---\n${body.replace(/^\n+/, '')}`
  }).join('\n\n')

  const out = rebuilt.replace(/\n{3,}/g, '\n\n').trim()
  return {
    text: out,
    removed: [...boilerplate].map(k => sample.get(k) || k),
    charsSaved: text.length - out.length
  }
}

/**
 * Split extracted text on its "--- SAYFA N ---" / "--- SLAYT N ---" marker
 * lines into one segment per page, keeping each page's raw body.
 *
 * When the document carries no markers at all (DOCX / plain text) this
 * returns a single segment with page === null rather than an empty list:
 * such a document still has text worth chunking, it just has no page
 * concept. Callers that specifically need page numbers (buildPageIndex)
 * discard that null-page case themselves.
 */
function splitByPageMarkers(
  text: string,
  pageMarkerLabel: string
): Array<{ page: number | null; body: string }> {
  if (!text || !text.trim()) return []
  const re = new RegExp(`---\\s*${pageMarkerLabel}\\s+(\\d+)\\s*---`, 'g')
  const hits: Array<{ page: number; start: number; end: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    hits.push({ page: parseInt(m[1], 10), start: m.index, end: m.index + m[0].length })
  }
  if (hits.length === 0) return [{ page: null, body: text }]
  const out: Array<{ page: number | null; body: string }> = []
  for (let i = 0; i < hits.length; i++) {
    out.push({
      page: hits[i].page,
      body: text.slice(hits[i].end, i + 1 < hits.length ? hits[i + 1].start : text.length)
    })
  }
  return out
}

/**
 * Page index for citation anchoring. Returns [] when the document has no
 * page markers, which correctly disables anchoring rather than inventing
 * page numbers for a format that has no pages.
 */
function buildPageIndex(text: string, pageMarkerLabel: string): PageSegment[] {
  const segments: PageSegment[] = []
  for (const seg of splitByPageMarkers(text, pageMarkerLabel)) {
    if (seg.page === null) return []   // no page concept for this document
    const trimmed = seg.body.trim()
    if (!trimmed) continue
    segments.push({
      page: seg.page,
      terms: new Set(anchorTerms(trimmed)),
      // First non-empty line is the fallback "reference" label when no
      // sentence on the page matches the claim well enough to quote.
      head: (trimmed.split('\n').map(l => l.trim()).find(l => l.length > 3) || '').slice(0, 70),
      body: trimmed
    })
  }
  return segments
}

// ==========================================================================
// CHUNK PERSISTENCE (document_chunks)
//
// The extracted text used to be thrown away when this function returned, so
// chat-with-document re-downloaded and re-parsed the same file on every
// single message. Persisting it once here ends that, and gives every future
// feature a stable, addressable unit of the document to point at.
//
// Chunk size is deliberately NOT the extraction window size (WINDOW, further
// down): windows are sized by the model's token budget, chunks by how
// precisely we want to address a passage. The two move independently — do not
// re-couple them. See the migration for the full rationale.
// ==========================================================================
const CHUNK_STORE_SIZE = 1200

type StorableChunk = {
  chunk_index: number
  page_start: number | null
  page_end: number | null
  text: string
  char_count: number
}

/**
 * Paragraph-aware chunks that never span a page boundary, so page_start /
 * page_end genuinely identify where a passage came from. Several short
 * consecutive pages (slides, for instance) may share one chunk, in which
 * case the range covers them; a long page is split into several chunks that
 * each carry that one page number.
 */
function buildStorableChunks(text: string, pageMarkerLabel: string): StorableChunk[] {
  const out: StorableChunk[] = []
  let buf: string[] = []
  let bufLen = 0
  let bufFirstPage: number | null = null
  let bufLastPage: number | null = null

  const flush = () => {
    if (!buf.length) return
    const joined = buf.join('\n\n').trim()
    if (joined) {
      out.push({
        chunk_index: out.length,
        page_start: bufFirstPage,
        page_end: bufLastPage,
        text: joined,
        char_count: joined.length
      })
    }
    buf = []; bufLen = 0; bufFirstPage = null; bufLastPage = null
  }

  for (const seg of splitByPageMarkers(text, pageMarkerLabel)) {
    const body = seg.body.trim()
    if (!body) continue
    const pieces = splitIntoChunks(body, CHUNK_STORE_SIZE)

    if (pieces.length > 1) {
      // A long page: emit its pieces on their own so each keeps this exact
      // page number rather than being blended with a neighbouring page.
      flush()
      for (const piece of pieces) {
        const t = piece.trim()
        if (!t) continue
        out.push({
          chunk_index: out.length,
          page_start: seg.page,
          page_end: seg.page,
          text: t,
          char_count: t.length
        })
      }
      continue
    }

    // A short page: accumulate with following short pages up to the target.
    const piece = pieces[0]?.trim()
    if (!piece) continue
    if (bufLen > 0 && bufLen + piece.length + 2 > CHUNK_STORE_SIZE) flush()
    if (!buf.length) bufFirstPage = seg.page
    bufLastPage = seg.page
    buf.push(piece)
    bufLen += piece.length + 2
  }
  flush()
  return out
}

/**
 * Best-effort write. A failure here must never fail the summarization job:
 * the student's study card is the product, stored chunks are an optimisation
 * and a foundation for later features. Existing rows are deleted first so a
 * re-processed document replaces its chunks instead of accumulating stale
 * ones (and so a shorter re-extraction cannot leave orphan tail chunks).
 */
async function persistDocumentChunks(
  serviceClient: any,
  documentId: string,
  chunks: StorableChunk[]
): Promise<{ written: number; error: string | null }> {
  if (!chunks.length) return { written: 0, error: null }
  try {
    const { error: delError } = await serviceClient
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId)
    if (delError) return { written: 0, error: `delete failed: ${delError.message}` }

    // Batched so a long book does not become one oversized request.
    const BATCH = 200
    let written = 0
    for (let i = 0; i < chunks.length; i += BATCH) {
      const rows = chunks.slice(i, i + BATCH).map(c => ({ ...c, document_id: documentId }))
      const { error: insError } = await serviceClient.from('document_chunks').insert(rows)
      if (insError) return { written, error: `insert failed at ${i}: ${insError.message}` }
      written += rows.length
    }
    return { written, error: null }
  } catch (e: any) {
    return { written: 0, error: String(e?.message || e) }
  }
}

/** Inverse page frequency: a term on every page discriminates nothing. */
function buildAnchorIdf(pageIndex: PageSegment[]): Map<string, number> {
  const df = new Map<string, number>()
  for (const seg of pageIndex) {
    for (const t of seg.terms) df.set(t, (df.get(t) || 0) + 1)
  }
  const N = Math.max(1, pageIndex.length)
  const idf = new Map<string, number>()
  for (const [t, d] of df) idf.set(t, Math.log((N + 1) / (d + 0.5)))
  return idf
}

// Precision-first thresholds: a missing citation is a small loss, a wrong one
// costs the student's trust in every other citation on the card.
const ANCHOR_MIN_SCORE = 0.42   // share of the claim's weighted vocabulary found on the page
const ANCHOR_MIN_TERMS = 3      // distinct matched content terms

/**
 * Best page for a single claim, or null when no page matches it well enough.
 * Score = matched idf weight / total idf weight of the claim's own terms.
 */
function anchorClaimToPage(
  claim: string,
  pageIndex: PageSegment[],
  idf: Map<string, number>
): { page: number; score: number; matched: number; head: string; quote: string | null } | null {
  if (!pageIndex.length) return null
  const terms = [...new Set(anchorTerms(claim))]
  if (terms.length === 0) return null
  const totalWeight = terms.reduce((a, t) => a + (idf.get(t) ?? Math.log(pageIndex.length + 1)), 0)
  if (totalWeight <= 0) return null

  let best: { seg: PageSegment; score: number; matched: number } | null = null
  for (const seg of pageIndex) {
    let w = 0, matched = 0
    for (const t of terms) {
      if (seg.terms.has(t)) { w += (idf.get(t) ?? 0); matched++ }
    }
    if (matched === 0) continue
    const score = w / totalWeight
    // Strictly-greater keeps the EARLIEST page on a tie, which is where a
    // topic is normally introduced.
    if (!best || score > best.score) best = { seg, score, matched }
  }
  if (!best) return null
  if (best.matched < ANCHOR_MIN_TERMS || best.score < ANCHOR_MIN_SCORE) return null
  return {
    page: best.seg.page,
    score: best.score,
    matched: best.matched,
    head: best.seg.head,
    // Verbatim sentence from that page, so the student sees what the source
    // actually says rather than just a page number.
    quote: bestQuoteForClaim(claim, best.seg.body, idf)
  }
}

// ==========================================================================
// LATEX VALIDATION
//
// Formulas are rendered client-side by KaTeX (dashboard.html loads it). A
// malformed expression does not degrade gracefully — KaTeX throws and the
// student gets an error box or a blank where the formula should be, which
// reads as a broken app rather than a missing formula. Nothing validated
// these strings before they were stored, so one unbalanced brace from the
// model went straight to the screen.
//
// Two jobs here:
//   REPAIR what is merely over-wrapped. The prompt asks for raw LaTeX with
//   no delimiters, and models routinely add "$...$", "\(...\)" or "\[...\]"
//   anyway. Stripping those is safe and keeps a perfectly good formula.
//   REJECT what cannot render. An unbalanced brace or \left without \right
//   has no safe repair — guessing where the author meant to close it could
//   silently change the mathematics, so the formula is dropped instead.
// ==========================================================================

/** Strip delimiters the prompt forbids but models add anyway. */
function stripLatexDelimiters(raw: string): string {
  let s = String(raw || '').trim()
  for (let i = 0; i < 3; i++) {
    const before = s
    s = s.replace(/^\$\$([\s\S]*)\$\$$/, '$1').trim()
    s = s.replace(/^\$([\s\S]*)\$$/, '$1').trim()
    s = s.replace(/^\\\(([\s\S]*)\\\)$/, '$1').trim()
    s = s.replace(/^\\\[([\s\S]*)\\\]$/, '$1').trim()
    if (s === before) break
  }
  return s
}

/**
 * Is this renderable by KaTeX? Conservative: only structural problems that
 * definitely throw are rejected, so an unusual but valid expression is not
 * thrown away for being unfamiliar.
 */
function validateLatex(raw: string): { ok: boolean; latex: string; reason?: string } {
  const latex = stripLatexDelimiters(raw)
  if (!latex) return { ok: false, latex, reason: 'bos' }
  if (latex.length < 2) return { ok: false, latex, reason: 'cok kisa' }
  if (latex.length > 1000) return { ok: false, latex, reason: 'cok uzun' }

  // Unescaped brace balance. A literal brace is written \{ or \}, so those
  // pairs are skipped rather than counted.
  let depth = 0
  for (let i = 0; i < latex.length; i++) {
    if (latex[i] === '\\') { i++; continue }      // skip the escaped char
    if (latex[i] === '{') depth++
    else if (latex[i] === '}') { depth--; if (depth < 0) return { ok: false, latex, reason: 'fazla kapanis parantezi' } }
  }
  if (depth !== 0) return { ok: false, latex, reason: 'dengesiz suslu parantez' }

  // \left must pair with \right or KaTeX throws.
  const lefts = (latex.match(/\\left/g) || []).length
  const rights = (latex.match(/\\right/g) || []).length
  if (lefts !== rights) return { ok: false, latex, reason: '\\left / \\right dengesiz' }

  // A stray delimiter left INSIDE (after the strip above) means the model
  // mixed modes; KaTeX in text mode throws on a bare $.
  if (/(^|[^\\])\$/.test(latex)) return { ok: false, latex, reason: 'kacak $' }

  // A backslash with nothing after it is an incomplete command.
  if (/\\$/.test(latex)) return { ok: false, latex, reason: 'yarim komut' }

  return { ok: true, latex }
}

/**
 * Validate a formula list: repaired formulas are kept with their cleaned
 * LaTeX, unrenderable ones are removed. A formula with no usable LaTeX but a
 * real name/variable list is still dropped — the card shows formulas as
 * rendered math, so a nameless broken entry has nothing to display.
 */
function sanitizeFormulas(formulas: any[]): { formulas: any[]; dropped: Array<{ name: string; reason: string }>; repaired: number } {
  const list = Array.isArray(formulas) ? formulas : []
  const out: any[] = []
  const dropped: Array<{ name: string; reason: string }> = []
  let repaired = 0
  for (const f of list) {
    const original = String(f?.latex || '')
    const v = validateLatex(original)
    if (!v.ok) {
      dropped.push({ name: String(f?.name || '(isimsiz)').slice(0, 40), reason: v.reason || 'gecersiz' })
      continue
    }
    if (v.latex !== original.trim()) repaired++
    out.push({ ...f, latex: v.latex })
  }
  return { formulas: out, dropped, repaired }
}

// ==========================================================================
// MERMAID VALIDATION
//
// Same class of problem as the LaTeX check above, and reported from the live
// app: every "View Summary" showed three bomb icons reading "Syntax error in
// text / mermaid version 10.9.8". The model writes `diagrams[].mermaid` and
// nothing ever checked it, so broken source went to the database and then to
// the renderer.
//
// The front end now refuses to draw invalid source (safeMermaidRender in
// dashboard.js parses before rendering), which stops the bombs. This does
// the other half: a diagram that cannot be valid is not stored in the first
// place, so the card does not carry dead weight and the front end is not
// left hiding empty boxes.
//
// Deliberately structural-only. A real Mermaid parser cannot run here, and
// guessing at semantics would throw away diagrams that render fine — so this
// rejects only what is definitely broken: no diagram type, unbalanced
// brackets or quotes, or nothing but a header line.
// ==========================================================================
const MERMAID_TYPES = [
  'flowchart', 'graph', 'sequencediagram', 'classdiagram', 'statediagram',
  'erdiagram', 'journey', 'gantt', 'pie', 'mindmap', 'timeline',
  'quadrantchart', 'requirementdiagram', 'gitgraph', 'c4context', 'sankey',
  'xychart', 'block'
]

// Mermaid has no left-pointing LABELLED edge: `-->|text|` is valid, `<--|text|`
// is not, and a flowchart containing one fails to parse in full — the single
// bad line takes the whole diagram down. Models reach for it constantly when
// describing a two-way relationship ("households receive wages FROM firms"),
// and it is exactly backwards from a form that already exists: `A <--|t| B`
// means the same thing as `B -->|t| A`.
//
// Observed live: a circular-flow diagram, otherwise correct, carried
//   H <--|receives wages, dividends, interest| F
// and silently never rendered. Dropping it would have been a loss (the diagram
// is good), so this rewrites the edge instead and only fails validation if
// something unrepairable is left. Rewriting is safe because the transform is
// pure direction-swapping — no content is invented or discarded.
const MERMAID_REVERSE_LABELLED_EDGE = /^(\s*)(.+?)\s*<(-{2,3}|={2,3}|-\.-+)\|([^|]*)\|\s*(.+?)\s*$/

function repairMermaidArrows(src: string): { mermaid: string; repaired: number } {
  let repaired = 0
  const out = src.split('\n').map(line => {
    const m = line.match(MERMAID_REVERSE_LABELLED_EDGE)
    if (!m) return line
    const [, indent, left, dashes, label, right] = m
    // `--` -> `-->`, `==` -> `==>`, `-.-` -> `-.->`
    const forward = dashes.startsWith('=') ? `${dashes}>` : dashes.endsWith('.') ? `${dashes}->` : `${dashes}>`
    repaired++
    return `${indent}${right} ${forward}|${label}| ${left}`
  })
  return { mermaid: out.join('\n'), repaired }
}

// A node label containing bare parentheses is a syntax error:
// `Money[Money (Financial) Market]` has to be written
// `Money["Money (Financial) Market"]`. The balance check further down cannot
// catch it — the parentheses ARE balanced — so the diagram passes validation
// and then Mermaid rejects it whole.
//
// Observed live: a "Three Market Arenas" graph, correct in every other
// respect, lost to that single line while the circular-flow diagram beside it
// rendered fine. Quoting is lossless, so this repairs rather than drops.
//
// Deliberately narrow: only the `ID[label]` form, only when the label has no
// quote or bracket of its own. The lookahead skips `[[subroutine]]` and
// `[(database)]`, whose second character is part of the SHAPE rather than the
// label, and which quoting would corrupt.
const MERMAID_UNQUOTED_PAREN_LABEL = /(^|[\s>|-])([A-Za-z_][\w-]*)\[(?!\[|\()([^\[\]"]*[()][^\[\]"]*)\]/g

function repairMermaidLabels(src: string): { mermaid: string; repaired: number } {
  let repaired = 0
  const mermaid = src.replace(
    MERMAID_UNQUOTED_PAREN_LABEL,
    (_m, lead: string, id: string, label: string) => {
      repaired++
      return `${lead}${id}["${label.trim()}"]`
    }
  )
  return { mermaid, repaired }
}

function validateMermaid(raw: string): { ok: boolean; mermaid: string; reason?: string; repaired?: number } {
  let src = String(raw || '').trim()
  // Models often wrap it in a fenced code block despite being asked not to.
  src = src.replace(/^```+\s*mermaid\s*/i, '').replace(/```+\s*$/, '').trim()
  if (!src) return { ok: false, mermaid: src, reason: 'bos' }
  if (src.length > 4000) return { ok: false, mermaid: src, reason: 'cok uzun' }

  const arrowsFixed = repairMermaidArrows(src)
  src = arrowsFixed.mermaid
  // Anything still pointing left with a label could not be rewritten (e.g. the
  // line had more than one such edge, or no right-hand node) — Mermaid would
  // reject the whole diagram, so fail here rather than ship a blank render.
  if (/<(-{2,3}|={2,3}|-\.-+)\|/.test(src)) {
    return { ok: false, mermaid: src, reason: 'onarilamayan ters etiketli ok (<--|...|)' }
  }

  // Must run AFTER the arrow repair: that step rewrites whole lines and would
  // otherwise undo the quoting.
  const labelsFixed = repairMermaidLabels(src)
  src = labelsFixed.mermaid
  const fixed = { repaired: arrowsFixed.repaired + labelsFixed.repaired }

  const lines = src.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { ok: false, mermaid: src, reason: 'tek satir — govde yok' }

  // First line must name a diagram type, or Mermaid cannot even start.
  const head = lines[0].toLowerCase().replace(/\s+/g, '')
  if (!MERMAID_TYPES.some(t => head.startsWith(t))) {
    return { ok: false, mermaid: src, reason: `bilinmeyen diyagram turu: ${lines[0].slice(0, 30)}` }
  }

  // Bracket and quote balance. Unbalanced delimiters are the most common way
  // the model's output fails, and the one thing checkable without a parser.
  const pairs: Array<[string, string]> = [['[', ']'], ['(', ')'], ['{', '}']]
  for (const [open, close] of pairs) {
    let depth = 0
    for (const ch of src) {
      if (ch === open) depth++
      else if (ch === close) { depth--; if (depth < 0) break }
    }
    if (depth !== 0) return { ok: false, mermaid: src, reason: `dengesiz ${open}${close}` }
  }
  if ((src.match(/"/g) || []).length % 2 !== 0) {
    return { ok: false, mermaid: src, reason: 'dengesiz tirnak' }
  }

  return { ok: true, mermaid: src, repaired: fixed.repaired }
}

function sanitizeDiagrams(diagrams: any[]): { diagrams: any[]; dropped: Array<{ title: string; reason: string }>; repaired: number } {
  const list = Array.isArray(diagrams) ? diagrams : []
  const out: any[] = []
  const dropped: Array<{ title: string; reason: string }> = []
  let repaired = 0
  for (const d of list) {
    const v = validateMermaid(d?.mermaid)
    if (!v.ok) {
      dropped.push({ title: String(d?.title || '(isimsiz)').slice(0, 40), reason: v.reason || 'gecersiz' })
      continue
    }
    repaired += v.repaired || 0
    out.push({ ...d, mermaid: v.mermaid })
  }
  return { diagrams: out, dropped, repaired }
}

// ==========================================================================
// CHART GATE — a chart with no numbers is worse than no chart
//
// The extraction prompts all say "only chart-worthy numeric data actually
// present ... never fabricate". A model that can see a figure's TITLE and
// AXIS LABELS in the extracted text, but not the figure itself, reads that
// rule as satisfied by emitting the labels with a zero for every value — it
// invented no numbers, after all. The student then gets a chart.
//
// Measured live on a 30-page deck: three charts ("U.S. Aggregate Output
// 1970-2014", "Unemployment Rate", "Inflation Rate"), each with ten year
// labels and data = [0,0,0,0,0,0,0,0,0,0], rendering as three identical flat
// lines along the x-axis. charts=0 would have been strictly better.
//
// Prompt wording cannot fix this reliably — the model believes it complied.
// This is the deterministic counterpart, in the same family as
// sanitizeFormulas/sanitizeDiagrams: it costs no tokens, runs after every
// pipeline, and holds regardless of what the model emits.
const CHART_TYPES = ['bar', 'pie', 'line']
const CHART_MIN_POINTS = 2

function sanitizeCharts(charts: any[]): { charts: any[]; dropped: Array<{ title: string; reason: string }> } {
  const list = Array.isArray(charts) ? charts : []
  const out: any[] = []
  const dropped: Array<{ title: string; reason: string }> = []

  for (const c of list) {
    const title = String(c?.title || '(isimsiz)').slice(0, 40)
    const rawData = Array.isArray(c?.data) ? c.data : []
    const rawLabels = Array.isArray(c?.labels) ? c.labels : []

    // Keep only points that are real numbers. A string "12%" or a null is not
    // plottable, and silently coercing it is how a 0 gets into the series in
    // the first place.
    const paired: Array<{ label: string; value: number }> = []
    for (let i = 0; i < rawData.length; i++) {
      const v = typeof rawData[i] === 'number' ? rawData[i] : Number(rawData[i])
      if (!Number.isFinite(v)) continue
      paired.push({ label: String(rawLabels[i] ?? ''), value: v })
    }

    if (paired.length < CHART_MIN_POINTS) {
      dropped.push({ title, reason: `sayisal veri yok (${paired.length} gecerli nokta)` })
      continue
    }

    // Every value identical — including the all-zero case this gate exists
    // for — carries no information at any chart type.
    const distinct = new Set(paired.map(p => p.value))
    if (distinct.size < 2) {
      dropped.push({ title, reason: `tum degerler ayni (${[...distinct][0]})` })
      continue
    }

    // A pie of negative or zero slices cannot be drawn; such data is almost
    // always a line/bar series the model mislabelled.
    let type = String(c?.type || '').toLowerCase().trim()
    if (!CHART_TYPES.includes(type)) type = 'bar'
    if (type === 'pie' && paired.some(p => p.value <= 0)) type = 'bar'

    out.push({
      ...c,
      type,
      labels: paired.map((p, i) => p.label || String(i + 1)),
      data: paired.map(p => p.value)
    })
  }

  return { charts: out, dropped }
}

// ==========================================================================
// NARRATIVE YEAR GATE — the one blind spot applyGroundingGate has
//
// applyGroundingGate judges key_terms and key_points. It does not judge the
// prose: "summary", "summary_executive" and sections[].summary are written by
// the narrative writer AFTER the gate has run, and nothing checks them. That
// is where the model's own world knowledge leaks back in, and it leaks as
// specifics — exactly the specifics a student would be tested on.
//
// Observed twice in eleven runs of the same 30-page deck, with the gate
// reporting "25 kept / 0 dropped" both times:
//     "the Great Depression (1929-1933)"
// The source says "began in 1929 and continued throughout the 1930s" and
// never mentions 1933 anywhere.
//
// A four-digit year is the one claim class that can be checked literally: it
// is either in the source or it is not, with no paraphrase to reason about.
// So this gate is deliberately narrow — it only judges years, and it only
// REWRITES the two shapes where a rewrite is provably grammatical:
//
//   1. a parenthetical made of nothing but year material  -> drop it whole
//      ("the Great Depression (1929-1933)" -> "the Great Depression")
//   2. a range with one supported endpoint -> keep that endpoint
//      ("from 1929-1933" -> "from 1929")
//
// Anything else — a bare unsupported year mid-sentence — is reported and left
// alone. Editing prose blind is how a gate starts causing the damage it was
// added to prevent, and a logged year we can act on beats a mangled sentence
// we cannot.
const YEAR_RE = /\b(1[89]\d{2}|20\d{2})\b/g
// The model writes ranges with whatever dash it likes, including U+2011
// NON-BREAKING HYPHEN — the same character class that once made the grounding
// gate drop "fine-tuning" as fabricated.
const YEAR_RANGE_RE = /\b(1[89]\d{2}|20\d{2})\s*[-‐-―]\s*(1[89]\d{2}|20\d{2})\b/g
// A parenthetical safe to delete: years, separators and whitespace only.
const YEAR_ONLY_PAREN_RE = /\s*\(([\d\s,;./‐-―-]*)\)/g

function yearInSource(year: string, sourceText: string): boolean {
  return new RegExp(`(?<![\\d])${year}(?![\\d])`).test(sourceText)
}

function scrubUnsupportedYears(
  text: string,
  sourceText: string
): { text: string; removed: string[]; flagged: string[] } {
  let out = String(text || '')
  if (!out) return { text: out, removed: [], flagged: [] }

  const removed: string[] = []
  const supported = (y: string) => yearInSource(y, sourceText)

  // (1) Parentheticals that carry nothing but year material.
  out = out.replace(YEAR_ONLY_PAREN_RE, (whole, inner: string) => {
    const years = String(inner).match(YEAR_RE) || []
    if (!years.length) return whole                       // "(3)" etc — not ours
    const bad = years.filter(y => !supported(y))
    if (!bad.length) return whole
    removed.push(...bad)
    return ''
  })

  // (2) Ranges where exactly one endpoint is supported — keep that endpoint.
  out = out.replace(YEAR_RANGE_RE, (whole, a: string, b: string) => {
    const aOk = supported(a)
    const bOk = supported(b)
    if (aOk && bOk) return whole
    if (aOk) { removed.push(b); return a }
    if (bOk) { removed.push(a); return b }
    return whole                                          // both bad — flagged below
  })

  // Whatever unsupported year survives both passes stays in the text.
  const flagged = [...new Set((out.match(YEAR_RE) || []).filter(y => !supported(y)))]
  // Deleting a parenthetical can leave a doubled space or a space before a
  // comma/period.
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim()

  return { text: out, removed: [...new Set(removed)], flagged }
}

function sanitizeNarrativeYears(
  draft: any,
  sourceText: string
): { changed: number; removed: string[]; flagged: string[] } {
  const removed: string[] = []
  const flagged: string[] = []
  let changed = 0
  if (!draft || typeof draft !== 'object' || !sourceText) {
    return { changed, removed, flagged }
  }

  for (const field of ['summary', 'summary_executive']) {
    if (typeof draft[field] !== 'string') continue
    const r = scrubUnsupportedYears(draft[field], sourceText)
    if (r.text !== draft[field]) { draft[field] = r.text; changed++ }
    removed.push(...r.removed)
    flagged.push(...r.flagged)
  }

  if (Array.isArray(draft.sections)) {
    for (const s of draft.sections) {
      if (!s || typeof s.summary !== 'string') continue
      const r = scrubUnsupportedYears(s.summary, sourceText)
      if (r.text !== s.summary) { s.summary = r.text; changed++ }
      removed.push(...r.removed)
      flagged.push(...r.flagged)
    }
  }

  return { changed, removed: [...new Set(removed)], flagged: [...new Set(flagged)] }
}

// ==========================================================================
// QUALITY GATE — drop what the document does not support
//
// The anchoring machinery above already answers, for every claim, "do this
// claim's distinctive words appear in the source?". Until now a claim that
// answered no was merely left uncited. But that answer is worth more than
// that: a claim whose distinctive vocabulary appears NOWHERE in a 50-page
// document is not a paraphrase, it is something the model supplied from
// outside the source — exactly what a grounded study tool must not show.
//
// The distinction that matters, and the reason this gate is deliberately
// narrow:
//
//   LOW overlap  -> a legitimate paraphrase. The model used synonyms, or
//                   summarised across pages. KEEP IT. Dropping these would
//                   strip the summary of its best writing.
//   ZERO overlap -> with three or more distinctive terms and a whole
//                   document to match against, zero is not word choice.
//                   DROP IT.
//
// Key terms are judged more strictly than key points, because a term is
// supposed to be lifted from the document, not composed. Turkish
// suffixation happens to help here: a substring test matches the stem
// ("esneklik" is found inside the document's "esnekliği"), so a real term
// is found even in an inflected document.
// ==========================================================================

/**
 * Normalisation for the gate's substring test.
 *
 * The first live run exposed why this has to do more than lowercase: the
 * gate dropped "Fine‑tuning", "Goods‑and‑services market" and "Inflation
 * rate (GDP deflator)" as fabrications when all three are straight out of
 * the chapter. The model writes typographic punctuation — the hyphen in
 * "Fine‑tuning" is U+2011 NON-BREAKING HYPHEN — while the PDF's own text
 * has a plain hyphen, or just a space ("goods and services"). Comparing
 * those literally can only fail.
 *
 * So every dash variant AND every other punctuation mark becomes a space,
 * and runs of whitespace collapse. "Fine‑tuning", "fine-tuning" and "fine
 * tuning" all normalise to "fine tuning", and the parentheses in
 * "Inflation rate (GDP deflator)" stop welding themselves to the words
 * inside. Letters and digits are the only things that survive, which is
 * also what anchorTerms() already does — this brings the two comparisons
 * into agreement.
 *
 * Dropping a real term is the expensive failure here: it deletes correct
 * content from the student's card and inflates the "model is fabricating"
 * signal in the logs.
 */
function gateNormalize(s: string): string {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')   // dashes, quotes, brackets, punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

// A claim needs at least this many distinctive terms before "none of them
// appear" is evidence of anything rather than just a short sentence.
const GATE_MIN_TERMS_TO_JUDGE = 3
// Past this share of judged claims, the gate distrusts ITSELF rather than the
// model and drops nothing (see the safety valve in applyGroundingGate).
const GATE_MAX_DROP_SHARE = 0.6

type GroundingStats = {
  termsKept: number; termsDropped: number; droppedTerms: string[]
  pointsKept: number; pointsDropped: number; droppedPoints: string[]
  score: number | null
  aborted?: boolean
}

/**
 * Drop key terms and key points the document does not support.
 *
 * Returns new arrays plus a grounding score (share of judgeable claims that
 * were supported) so the log shows which documents the model is inventing
 * on — a number to watch over time, not just a one-off fix.
 */
// `visionGrounded` holds the normalised text of claims that came from the
// VISION pass rather than from the extracted text, and exempts them.
//
// Without it the gate and the vision pass work against each other by
// construction: the gate asks "does the document's text support this claim",
// and the vision pass exists precisely to recover what the text does NOT
// contain. Every term it contributes is therefore a candidate for being
// called a fabrication.
//
// Observed live the first time the vision pass actually ran: it read "First
// oil shock" / "Second oil shock" off the axis annotations of Figure 20.2 and
// the gate dropped "Oil shock" as invented. The phrase occurs zero times in
// the extracted text and is plainly there in the image — the claim was true
// and the gate was judging it against a source that cannot contain it.
//
// These claims are not ungrounded, they are grounded in a source this
// function cannot read, so they are passed through and counted as kept.
function applyGroundingGate(
  keyTerms: any[],
  keyPoints: any[],
  sourceText: string,
  visionGrounded: Set<string> = new Set()
): { key_terms: any[]; key_points: any[]; stats: GroundingStats } {
  const terms = Array.isArray(keyTerms) ? keyTerms : []
  const points = Array.isArray(keyPoints) ? keyPoints : []
  const stats: GroundingStats = {
    termsKept: 0, termsDropped: 0, droppedTerms: [],
    pointsKept: 0, pointsDropped: 0, droppedPoints: [],
    score: null
  }
  if (!sourceText || sourceText.length < 200) {
    // Nothing trustworthy to judge against — never gate on a non-existent
    // source, or a failed extraction would delete a good summary.
    stats.termsKept = terms.length
    stats.pointsKept = points.length
    return { key_terms: terms, key_points: points, stats }
  }

  const haystack = ' ' + gateNormalize(sourceText) + ' '
  const docTerms = new Set(anchorTerms(sourceText))
  const readText = (raw: any) => typeof raw === 'string' ? raw : String(raw?.text || raw?.point || '')

  // --- Key terms: the term itself must occur in the document ---
  const keptTerms = terms.filter((t: any) => {
    const term = String(t?.term || '').trim()
    if (!term) return false
    const norm = gateNormalize(term)
    if (norm.length < 3) return true            // too short to judge
    if (visionGrounded.has(norm)) { stats.termsKept++; return true }
    if (haystack.includes(norm)) { stats.termsKept++; return true }
    // Multi-word term: accept when every word of it occurs somewhere. Some
    // documents write "esneklik katsayısı" across a line break, and the
    // model legitimately reassembles it.
    const words = norm.split(' ').filter(w => w.length >= 4)
    if (words.length > 1 && words.every(w => haystack.includes(w))) { stats.termsKept++; return true }
    stats.termsDropped++
    if (stats.droppedTerms.length < 8) stats.droppedTerms.push(term)
    return false
  })

  // --- Key points: only a ZERO-overlap point is dropped ---
  const keptPoints = points.filter((p: any) => {
    const text = readText(p)
    if (!text.trim()) return false
    if (visionGrounded.has(gateNormalize(text))) { stats.pointsKept++; return true }
    const claimTerms = [...new Set(anchorTerms(text))]
    if (claimTerms.length < GATE_MIN_TERMS_TO_JUDGE) { stats.pointsKept++; return true }
    const matched = claimTerms.filter(t => docTerms.has(t)).length
    if (matched > 0) { stats.pointsKept++; return true }
    stats.pointsDropped++
    if (stats.droppedPoints.length < 6) stats.droppedPoints.push(text.slice(0, 90))
    return false
  })

  const judged = stats.termsKept + stats.termsDropped + stats.pointsKept + stats.pointsDropped
  stats.score = judged > 0
    ? Math.round(100 * (stats.termsKept + stats.pointsKept) / judged)
    : null

  // SAFETY VALVE. A gate that guts the output is far more likely to be wrong
  // about the comparison than right about mass fabrication — an encoding
  // mismatch, a failed extraction that left `extractedText` holding
  // something other than what the model actually read, or an unforeseen
  // normalisation bug would all look exactly like "the model invented
  // everything". A trimming gate is useful; a gate that empties the study
  // card is a bug that deletes the student's result. So past this share,
  // nothing is dropped and the anomaly is logged for investigation.
  const droppedShare = judged > 0 ? (stats.termsDropped + stats.pointsDropped) / judged : 0
  if (droppedShare > GATE_MAX_DROP_SHARE) {
    console.warn(
      `Grounding gate ABORTED: would have dropped ${Math.round(100 * droppedShare)}% of claims ` +
      `(${stats.termsDropped} terms, ${stats.pointsDropped} points of ${judged} judged). ` +
      `That points at the comparison, not the model — keeping everything. ` +
      `Ornek atilacaklar: ${[...stats.droppedTerms, ...stats.droppedPoints].slice(0, 4).join(' | ')}`
    )
    return {
      key_terms: terms,
      key_points: points,
      stats: { ...stats, aborted: true } as GroundingStats
    }
  }

  return { key_terms: keptTerms, key_points: keptPoints, stats }
}

/**
 * Single citation step for BOTH pipelines, run once just before the study
 * card is saved:
 *   1. Validate footnote pages the model produced (fast path) — a page the
 *      index cannot corroborate is demoted to null instead of sending the
 *      student's PDF viewer somewhere wrong.
 *   2. Compute footnotes for key_points that carry no marker yet (this is
 *      what finally gives long documents citations), appending "[n]" to the
 *      point text so the existing formatFootnoteMarkers()/jumpToFootnote()
 *      front-end path renders and links them with no UI change at all.
 * Returns new arrays; never mutates its inputs.
 */
function anchorCitations(
  keyPoints: any[],
  existingFootnotes: any[],
  pageIndex: PageSegment[],
  lang: string
): { key_points: any[]; footnotes: any[]; idMap: Record<number, number>; stats: Record<string, number> } {
  const incoming = Array.isArray(existingFootnotes) ? existingFootnotes : []
  const stats = { kept: 0, demoted: 0, added: 0, skipped: 0, quoted: 0 }

  const readText = (raw: any) => typeof raw === 'string' ? raw : String(raw?.text || raw?.point || '')
  const writeText = (raw: any, text: string) =>
    typeof raw === 'string' ? text : { ...raw, text }

  // Footnote ids are reassigned to a dense 1..n sequence below, so any "[n]"
  // markers the model already embedded in key_points (and in the summary,
  // which the caller remaps with the returned idMap) must be rewritten to
  // match. Without this, a model that emitted ids out of order or with gaps
  // — which it is free to do — would leave every marker pointing at the
  // wrong footnote, i.e. at the wrong page. This is what applyFootnoteRemap
  // is for; it runs BEFORE any new markers are appended, so the ids this
  // function allocates afterwards cannot collide with remapped ones.
  const idMap: Record<number, number> = {}
  incoming.forEach((fn: any, i: number) => {
    if (fn?.id != null) idMap[Number(fn.id)] = i + 1
  })
  const points = (Array.isArray(keyPoints) ? keyPoints : []).map(raw =>
    writeText(raw, applyFootnoteRemap(readText(raw), idMap))
  )

  if (!pageIndex.length) {
    // No page concept for this format (DOCX / plain text) — keep the
    // footnotes but strip page numbers we cannot corroborate, rather than
    // letting the viewer jump somewhere arbitrary.
    const cleaned = incoming.map((fn: any, i: number) => ({
      id: i + 1,
      reference: fn?.reference || `Reference ${i + 1}`,
      page: null
    }))
    stats.demoted = incoming.filter((fn: any) => typeof fn?.page === 'number').length
    stats.kept = cleaned.length
    return { key_points: points, footnotes: cleaned, idMap, stats }
  }

  const idf = buildAnchorIdf(pageIndex)
  const validPages = new Set(pageIndex.map(s => s.page))
  const out: any[] = []

  // --- 1. Carry over the model's footnotes, verifying their page numbers ---
  for (const fn of incoming) {
    const id = out.length + 1
    const claimedPage = (typeof fn?.page === 'number' && Number.isFinite(fn.page)) ? fn.page : null
    let page: number | null = null
    if (claimedPage !== null && validPages.has(claimedPage)) { page = claimedPage; stats.kept++ }
    else if (claimedPage !== null) { stats.demoted++ }
    out.push({ id, reference: fn?.reference || `Reference ${id}`, page })
  }

  // --- 2. Anchor key_points that carry no marker yet ---
  // The label the student actually reads: prefer the verbatim source
  // sentence, fall back to the page's heading line, then to a bare page
  // number. The front end already renders `reference` both in the [n]
  // tooltip and in the "Kaynakça" list, so a real quote here upgrades both
  // with no UI change.
  const labelFor = (hit: { head: string; page: number; quote: string | null }) =>
    hit.quote || hit.head || (lang === 'tr' ? `Sayfa ${hit.page}` : `Page ${hit.page}`)

  for (let i = 0; i < points.length; i++) {
    const text = readText(points[i])
    if (!text.trim()) continue
    if (/\[\d+\]/.test(text)) continue // already cited — leave it alone

    const hit = anchorClaimToPage(text, pageIndex, idf)
    if (!hit) { stats.skipped++; continue }

    const id = out.length + 1
    out.push({
      id,
      reference: labelFor(hit),
      page: hit.page,
      // Kept as its own field too: `reference` is what today's UI shows, but
      // a verbatim quote is distinct data (it can be highlighted in the
      // source viewer, and it is what makes the citation checkable).
      quote: hit.quote
    })
    if (hit.quote) stats.quoted++
    points[i] = writeText(points[i], `${text.replace(/\s+$/, '')} [${id}]`)
    stats.added++
  }

  return { key_points: points, footnotes: out, idMap, stats }
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      console.warn(`Erken cikis 405: method=${req.method}`)
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Every early return below used to be silent. A failed first attempt
    // therefore produced a worker that logged "booted" and "Listening" and
    // nothing else — which is exactly what the student's "first press errors,
    // second press works" looks like in the logs, with no way to tell WHICH
    // of the five exits it took. Each one now names itself.
    const { documentId, summaryStyle, language, summaryLength, analyzeVisuals, depth: depthRaw } = await req.json()
    console.log(`Istek alindi: documentId=${documentId ?? '(yok)'}, visuals=${analyzeVisuals ? 'evet' : 'hayir'}`)
    if (!documentId) {
      console.warn('Erken cikis 400: documentId gonderilmedi')
      return new Response(JSON.stringify({ error: 'documentId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let style = (summaryStyle || 'standard').toLowerCase()
    const lang = (language || 'en').toLowerCase()
    let len = (summaryLength || 'medium').toLowerCase()
    // Denetim Raporu, 2026-08-31 — UI SIMPLIFICATION: the upload modal
    // (dashboard.html) no longer asks the student for depth/summaryLength at
    // all — only language + a single "want visuals?" toggle. Only honor an
    // explicit depth if some caller actually sends one (kept for backward
    // compatibility / API callers); otherwise it is auto-selected below,
    // once the real extracted document length is known — see
    // "AUTO DEPTH SELECTION" further down, right after useChunkedPipeline is
    // computed. depth/depthFlags are not read anywhere before that point.
    const explicitDepth = ['brief', 'standard', 'deep', 'exam'].includes(String(depthRaw || '').toLowerCase())
      ? String(depthRaw).toLowerCase()
      : null



    // Get User Authorization JWT to verify ownership
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn('Erken cikis 401: Authorization basligi yok')
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // Scoped client using user auth header
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Fetch document to verify ownership.
    //
    // Retried once on purpose. The dashboard inserts the documents row and
    // calls this function immediately after; when the row is not yet visible
    // to this request's scoped client, the select comes back empty and the
    // student sees "Document not found or access denied" on the first press,
    // then a second press a moment later works. That is the single most
    // reported annoyance in this flow, and it costs one short wait to absorb.
    //
    // A genuine permission failure is unaffected: under RLS a document that
    // is not the caller's returns no rows on the retry either, so the same
    // 404 is returned, just ~700ms later and with a log line saying so.
    const DOC_LOOKUP_RETRY_MS = 700
    let document: any = null
    let docError: any = null
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await userClient.from('documents').select('*').eq('id', documentId).single()
      document = res.data
      docError = res.error
      if (document) {
        if (attempt > 0) console.log(`Belge ${attempt + 1}. denemede bulundu (ilk deneme bos dondu)`)
        break
      }
      if (attempt === 0) {
        console.warn(`Belge ilk denemede bulunamadi (code=${docError?.code ?? '-'}), ${DOC_LOOKUP_RETRY_MS}ms sonra tekrar deneniyor`)
        await new Promise(r => setTimeout(r, DOC_LOOKUP_RETRY_MS))
      }
    }

    if (docError || !document) {
      console.error(`Erken cikis 404: belge bulunamadi veya erisim yok (documentId=${documentId}, code=${docError?.code ?? '-'}, message=${docError?.message ?? '-'})`)
      return new Response(JSON.stringify({ error: 'Document not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Service role client for download and DB write modifications
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // ==========================================================================
    // COURSE CATALOG LOOKUP — makes the AI's course-tag suggestion department-aware
    // Fetches the official curriculum ("Ders Ağacı") courses for the uploading
    // student's declared department (public.departments / public.courses,
    // seeded via 20260721_add_course_catalog.sql) and passes it to the LLM so it
    // can match the document against a REAL course code instead of guessing one
    // out of thin air. Fails soft — if the catalog tables don't exist yet or the
    // student has no department on file, we just fall back to the old free-guess
    // behavior instead of erroring the whole summarization out.
    // ==========================================================================
    let courseCatalogBlock = "No official course catalog is available for this student — suggest a course code or subject label only if one is explicitly evident in the document text itself."
    try {
      const { data: ownerProfile } = await serviceClient
        .from('profiles')
        .select('department')
        .eq('id', document.user_id)
        .single()

      if (ownerProfile?.department) {
        const { data: deptRow } = await serviceClient
          .from('departments')
          .select('code')
          .eq('name', ownerProfile.department)
          .maybeSingle()

        if (deptRow?.code) {
          const { data: deptCourses } = await serviceClient
            .from('courses')
            .select('course_code, course_name')
            .eq('department_code', deptRow.code)
            .order('course_code')

          if (deptCourses && deptCourses.length > 0) {
            courseCatalogBlock = deptCourses.map((c: any) => `${c.course_code} — ${c.course_name}`).join('\n')
          }
        }
      }
    } catch (catalogErr) {
      console.warn('Course catalog lookup failed, continuing with free-text course guessing: ', catalogErr)
    }

    // 1. Instantly set document status to processing
    await serviceClient
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId)

    // 2. Download file blob from private storage bucket
    const { data: fileBlob, error: downloadError } = await serviceClient.storage
      .from('documents')
      .download(document.storage_path)

    if (downloadError || !fileBlob) {
      console.error('Download error: ', downloadError)
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'Failed to download the document. The file could not be downloaded or opened.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Convert blob to ArrayBuffer & Uint8Array
    const arrayBuffer = await fileBlob.arrayBuffer()
    const fileBytes = new Uint8Array(arrayBuffer)

    // ==========================================================================
    // STEP 1 — TEXT EXTRACTION (based on document.mime_type)
    // ==========================================================================
    let extractedText = ""
    const mimeType = document.mime_type?.toLowerCase() || ""
    // Per-page PDF text, kept around after extraction (Denetim Raporu,
    // 2026-08-31) so we can measure text density per page below — this is
    // what lets us tell a text-heavy long document apart from a slide deck
    // that just happens to be long, without adding a second PDF parse.
    let pdfPageTexts: string[] = []

    try {
      if (mimeType === "text/plain") {
        extractedText = new TextDecoder("utf-8").decode(fileBytes)
      }
      else if (mimeType === "application/pdf") {
        let isScannedOrFailed = false
        try {
          const pdf = await getDocumentProxy(fileBytes)
          // mergePages: false (per-page array) instead of true (one merged
          // string) — we insert an explicit "--- SAYFA N ---" marker before
          // each page's text below so the model can cite the EXACT page a
          // claim came from (see the FOOTNOTES prompt instructions), instead
          // of only a vague topic/section description as before.
          const { text: pdfPages } = await extractText(pdf, { mergePages: false })
          pdfPageTexts = pdfPages
          const pdfTextWithPageMarkers = pdfPages.map((pageText, idx) => `--- SAYFA ${idx + 1} ---\n${pageText}`).join('\n\n')
          extractedText = detectAndFormatPdfTables(pdfTextWithPageMarkers)

          const textLen = (extractedText || "").trim().length
          const fileSize = fileBytes.length
          if (textLen < 200 || textLen < (fileSize / 500)) {
            isScannedOrFailed = true
          }
        } catch (pdfErr) {
          console.error("Normal PDF text extraction failed, trying OCR fallback: ", pdfErr)
          isScannedOrFailed = true
        }

        if (isScannedOrFailed) {
          console.log("PDF text is empty, short or extraction failed. Attempting OCR fallback...")
          const ocrApiKey = Deno.env.get('OCR_SPACE_API_KEY')
          if (ocrApiKey) {
            try {
              const ocrText = await tryOCR(fileBytes, ocrApiKey)
              const ocrTextLen = (ocrText || "").trim().length
              if (ocrTextLen >= 200) {
                console.log(`OCR succeeded! Extracted ${ocrTextLen} characters.`)
                extractedText = detectAndFormatPdfTables(ocrText)
              } else {
                throw new Error("SCANNED_PDF")
              }
            } catch (ocrErr) {
              console.error("OCR fallback failed: ", ocrErr)
              throw new Error("SCANNED_PDF")
            }
          } else {
            console.warn("OCR_SPACE_API_KEY not configured. Falling back to scanned error.")
            throw new Error("SCANNED_PDF")
          }
        }
      }
      else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        try {
          const docxHtmlResult = await mammoth.convertToHtml({ buffer: fileBytes })
          const parsedDocxText = parseDocxHtmlContent(docxHtmlResult.value || "")
          if (parsedDocxText.trim()) {
            extractedText = parsedDocxText
          } else {
            const rawFallback = await mammoth.extractRawText({ buffer: fileBytes })
            extractedText = rawFallback.value
          }
        } catch (docxErr) {
          console.warn("Mammoth HTML conversion failed, falling back to raw text: ", docxErr)
          const docxResult = await mammoth.extractRawText({ buffer: fileBytes })
          extractedText = docxResult.value
        }
      }
      else if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        const zip = new JSZip()
        await zip.loadAsync(fileBytes)

        // Filter slide XML files
        const slideFiles = Object.keys(zip.files).filter(name =>
          name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
        )

        // Sort slides numerically (ppt/slides/slide1.xml, slide2.xml etc)
        slideFiles.sort((a, b) => {
          const numA = parseInt(a.replace(/[^0-9]/g, ""), 10)
          const numB = parseInt(b.replace(/[^0-9]/g, ""), 10)
          return numA - numB
        })

        let pptxText = ""
        for (const slidePath of slideFiles) {
          // Use the slide's real numeric filename (slideN.xml), not the loop
          // index — slides can be non-contiguous if some were deleted, so
          // the index alone could point students to the wrong slide.
          const slideNumMatch = slidePath.match(/slide(\d+)\.xml$/)
          const slideNum = slideNumMatch ? parseInt(slideNumMatch[1], 10) : (slideFiles.indexOf(slidePath) + 1)
          const slideXml = await zip.files[slidePath].async("text")
          const slideText = parsePptxSlideXml(slideXml)
          if (slideText) {
            // "--- SLAYT N ---" marker mirrors the PDF path's page markers so
            // the model can cite the exact slide a claim came from.
            pptxText += `--- SLAYT ${slideNum} ---\n${slideText}\n\n`
          }
        }
        extractedText = pptxText
      }
      else {
        // Fallback: try UTF-8 decoding
        extractedText = new TextDecoder("utf-8").decode(fileBytes)
      }
    } catch (extractionError: any) {
      console.error("Text extraction failed: ", extractionError)
      await markFailed(serviceClient, documentId)
      let errorMsg = "Failed to extract readable content. The file could not be downloaded/opened (it may be corrupted, password-protected, or unreadable)."
      if (extractionError?.message === "SCANNED_PDF") {
        errorMsg = "This PDF appears to be a scanned image without selectable text. Please try a text-based PDF, or convert it using OCR software first."
      }
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate extracted text content
    extractedText = extractedText.trim()
    if (!extractedText) {
      console.error("Extracted text is empty or blank")
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: "No readable text found in this file." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // PDF pages get "--- SAYFA N ---" markers, PPTX slides get "--- SLAYT N
    // ---" markers (see extraction above); DOCX/plain-text/fallback paths
    // have no reliable page concept, so they get neither. This flag tells the
    // footnote-instruction prompts below whether to ask the model for real
    // page/slide numbers or to fall back to the old topic/heading reference.
    const hasPageMarkers = mimeType === "application/pdf" || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    const pageMarkerLabel = mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ? "SLAYT" : "SAYFA"

    // Drop running headers/footers before anything downstream sees the text,
    // so the saving reaches the window budget, the stored chunks, the
    // grounding gate's source and the citation index alike. Must run after the
    // page markers exist and before document_chunks is written.
    if (hasPageMarkers) {
      const deboilerplated = stripRepeatedBoilerplate(extractedText, pageMarkerLabel)
      if (deboilerplated.charsSaved > 0) {
        extractedText = deboilerplated.text
        console.log(
          `Boilerplate strip: ${deboilerplated.charsSaved} krk kazanildi ` +
          `(%${((deboilerplated.charsSaved / (deboilerplated.charsSaved + extractedText.length)) * 100).toFixed(1)}), ` +
          `silinen: ${deboilerplated.removed.map(l => JSON.stringify(l.slice(0, 50))).join(', ')}`
        )
      }
    }

    // ==========================================================================
    // PERSIST THE EXTRACTED TEXT (document_chunks)
    //
    // This is the only place in the system that has the document's text in a
    // clean, page-aware form, and it used to throw it away on return — which
    // is why chat-with-document re-downloaded and re-parsed the same file on
    // every message. Writing it once here, right after extraction and before
    // either pipeline branch, means every document gets chunked regardless of
    // its size or which path summarizes it.
    //
    // Deliberately NOT awaited behind a failure path: if this write fails the
    // student still gets their study card, and chat falls back to extracting
    // on demand exactly as it does today.
    // ==========================================================================
    try {
      const storable = buildStorableChunks(extractedText, pageMarkerLabel)
      const { written, error: chunkError } = await persistDocumentChunks(serviceClient, documentId, storable)
      if (chunkError) {
        console.warn(`document_chunks: ${chunkError} (ozet akisi etkilenmedi)`)
      } else {
        const paged = storable.filter(c => c.page_start !== null).length
        console.log(
          `document_chunks: ${written} chunk yazildi ` +
          `(${paged} tanesi sayfa numarali, ort. ${Math.round(extractedText.length / Math.max(1, written))} krk)`
        )
      }
    } catch (chunkErr) {
      console.warn('document_chunks: beklenmeyen hata, atlandi:', chunkErr)
    }

    // ==========================================================================
    // VISUAL-DENSITY SIGNAL (Denetim Raporu, 2026-08-31)
    // CHUNK_THRESHOLD below only ever measures character COUNT. That is the
    // right signal for deciding whether the text needs the chunked/map-reduce
    // pipeline (see the big comment above), but it is the WRONG signal for
    // deciding whether visual analysis matters — a slide-deck PDF can be
    // "long" purely because it has many slides, while each slide carries
    // almost no extractable text and most of its real content lives in
    // diagrams/frameworks/charts. Confirmed on a real 52-page lecture deck:
    // only 17,787 extractable characters total (avg 342/page — well under
    // the chunked pipeline's 56K-char ceiling), but 216 embedded images and
    // 5 pages (13%) with ZERO extractable text. Those near-blank pages are
    // exactly where whole frameworks (e.g. a closing "major developments"
    // slide) were being silently dropped, because the chunked path below
    // never ran visual analysis at all.
    // We flag that pattern here — independent of useChunkedPipeline — and
    // use it further down to (a) run one extra vision-capable pass over just
    // the near-blank pages of a chunked document, and (b) not let a chunked
    // document skip the quality/hallucination review pass purely because
    // depth !== 'deep'.
    // ==========================================================================
    const pdfPageCount = pdfPageTexts.length
    const avgCharsPerPdfPage = pdfPageCount > 0 ? extractedText.length / pdfPageCount : 0
    // 0-indexed page numbers whose extracted text is essentially empty —
    // these are the pages PDF.co should convert to images below, instead of
    // always guessing "the first 8 pages". Threshold is 150 chars, not a
    // stricter "truly blank" cutoff, on purpose: a chart/table/formula
    // exhibit page (common in quantitative courses — finance, stats,
    // accounting) often still extracts a short title or axis-label caption,
    // so a page can carry almost none of its real content in text while
    // still clearing a very strict blank check. This is meant to generalize
    // across course types, not just the image-only slide-deck case it was
    // first found on.
    const nearBlankPdfPageIndices = pdfPageTexts
      .map((t, i) => ({ i, len: t.trim().length }))
      .filter(p => p.len < 150)
      .map(p => p.i)
    const isVisuallyDenseDocument = mimeType === "application/pdf" && pdfPageCount > 0 &&
      (avgCharsPerPdfPage < 500 || (nearBlankPdfPageIndices.length / pdfPageCount) > 0.08)
    if (isVisuallyDenseDocument) {
      console.log(`Visual-density signal tripped: avgCharsPerPage=${avgCharsPerPdfPage.toFixed(0)}, nearBlankPages=${nearBlankPdfPageIndices.length}/${pdfPageCount}`)
    }

    // ==========================================================================
    // DECIDE PIPELINE: short/medium documents use the original single-pass
    // (fast, cheap, supports visual analysis); long documents route through
    // the chunked map-reduce pipeline below so nothing gets silently
    // truncated and depth scales with actual document length.
    // ==========================================================================
    const useChunkedPipeline = extractedText.length > CHUNK_THRESHOLD
    const pipelineStartedAt = Date.now()
    const budgetLeft = () => Math.max(0, PIPELINE_BUDGET_MS - (Date.now() - pipelineStartedAt))

    // ==========================================================================
    // AUTO DEPTH SELECTION (Denetim Raporu, 2026-08-31)
    // The simplified upload UI no longer sends `depth`/`summaryLength` — pick
    // one from the actual extracted text length so a 1-page handout and a
    // 60-page lecture pack don't both get treated as "standard". Explicit
    // depth (any caller that still sends one) always takes priority.
    // ==========================================================================
    let depth = explicitDepth
    if (!depth) {
      if (extractedText.length < 2500) depth = 'brief'
      else if (extractedText.length > 30000) depth = 'deep'
      else depth = 'standard'
    }
    if (depth === 'brief' && len === 'medium') len = 'short'
    if (depth === 'deep' && len !== 'detailed' && len !== 'long') len = 'detailed'
    if (depth === 'exam' && style === 'standard') style = 'exam_focused'
    const depthFlags = {
      skipSectionDeepen: depth === 'brief',
      forceSectionDeepen: depth === 'deep' || depth === 'exam',
      skipNarrativeWriter: depth === 'brief',
      longNarrative: depth === 'deep',
      examBias: depth === 'exam',
      // Very long docs: prefer selective digests in section pass
      selectiveLongDoc: depth === 'deep' || depth === 'standard'
    }
    console.log(`Madde 6 depth=${depth} (${explicitDepth ? 'explicit' : 'auto from textLen=' + extractedText.length})`, depthFlags)

    // Fast-path truncation (unchanged behavior) — only ever applies when NOT chunking
    let textToSend = extractedText
    if (!useChunkedPipeline && textToSend.length > 40000) {
      const truncated = textToSend.substring(0, 40000)
      const lastBoundary = Math.max(
        truncated.lastIndexOf(". "),
        truncated.lastIndexOf(".\n"),
        truncated.lastIndexOf("\n")
      )
      if (lastBoundary > 35000) {
        textToSend = truncated.substring(0, lastBoundary + 1)
      } else {
        textToSend = truncated
      }
    }

    // ==========================================================================
    // STEP 2 — CALL GROQ API WITH THE EXTRACTED TEXT
    // ==========================================================================
    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      console.error('Missing GROQ_API_KEY env secret')
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'AI summarization key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Select style instruction (Part A)
    let styleInstruction = "Write the summary as 4-8 well-formed sentences in flowing prose."
    if (style === 'bullet') {
      styleInstruction = "Write the summary as a series of SHORT bullet points, each starting with '- ' at the beginning of its own line (use '\\n' between each bullet). Do NOT write flowing paragraph sentences — every line must be a distinct, concise bullet fragment, not a full narrative paragraph. Aim for 6-10 bullets."
    } else if (style === 'outline') {
      styleInstruction = "Write the summary as a hierarchical outline. Use '## ' prefixed lines for major section headings (identify 2-4 natural sections in the material), and '- ' prefixed indented lines beneath each heading for sub-points. Use '\\n' between every line. This must visually read as a structured outline, NOT as flowing paragraph prose."
    } else if (style === 'simplified') {
      styleInstruction = "Write the summary in very short sentences (aim for under 15 words per sentence) using simple, everyday vocabulary. Avoid compound/complex sentence structures. Explain any necessary technical term immediately in parentheses using plain language."
    } else if (style === 'exam_focused') {
      styleInstruction = "Write the summary as terse, fact-dense statements — prefer sentence fragments and direct statements over flowing narrative connectors like 'furthermore' or 'in addition.' Each sentence should pack in a specific fact, definition, or relationship. Keep it noticeably more compact and dense than a standard-style summary, with less narrative connective tissue between ideas."
    }

    // Part B: Length instruction — now adaptive to actual document length (see
    // computeAdaptiveTargets above). A baseline-sized document gets the same
    // numbers as before; longer documents get proportionally more, up to a cap.
    const adaptiveTargets = computeAdaptiveTargets(useChunkedPipeline ? extractedText.length : textToSend.length, len)
    const lengthInstruction = buildLengthInstruction(adaptiveTargets, len)

    const langLabel = lang === 'tr' ? 'Turkish / Türkçe' : 'English'

    // Part A: System prompt with document type classification & type specific guidance
    const systemPrompt = `You are an academic study assistant. You will be given the raw text extracted from a student's uploaded document. Analyze it and respond with ONLY a valid JSON object, no markdown code fences, no commentary before or after — just the raw JSON object matching this exact shape: { "summary": string, "summary_executive": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "document_type": string, "tables": [ { "title": string, "headers": [ string ], "rows": [ [ string ] ] } ], "charts": [ { "title": string, "type": string, "labels": [ string ], "data": [ number ] } ], "footnotes": [ { "id": number, "reference": string, "page": number | null } ], "outline": { "document_title_guess": string, "items": [ { "id": string, "heading": string, "blurb": string, "level": number, "order": number, "parent_id": string | null } ] }, "sections": [ { "heading": string, "summary": string, "key_points": [ string ], "outline_id": string | null } ], "suggested_course_tag": string | null, "is_quantitative": boolean, "formulas": [ { "name": string, "latex": string, "variables": [ { "symbol": string, "meaning": string } ] } ], "worked_examples": [ { "title": string, "problem_statement": string, "steps": [ string ], "final_answer": string } ], "diagrams": [ { "title": string, "mermaid": string, "description": string } ], "concept_graph": { "nodes": [ { "id": string, "label": string, "type": string } ], "edges": [ { "from": string, "to": string, "relation": string } ] }, "cloze_cards": [ { "id": string, "prompt": string, "answer": string, "full_text": string } ] }.

EXECUTIVE SUMMARY:
Write "summary_executive" as a 2-3 sentence ultra-short overview — what a student would say if asked "what is this document about in 30 seconds?". No bullet lists.

OUTLINE ENGINE (document skeleton):
Always produce "outline": { "document_title_guess": "...", "items": [ { "id": "o1", "heading": "short label", "blurb": "one sentence role of this part", "level": 1 or 2, "order": 1, "parent_id": null } ] }.
- 3-12 items in document order; level 1 = major parts, level 2 = sub-topics
- Prefer real structure (intro, theory, methods, cases, conclusion…)
- Never admin-only items (grading, attendance, textbook edition)
- Even for a single-topic document, return 2-3 coarse outline items (not empty)

SECTION PASS (deep per-topic summaries):
Also produce "sections" aligned with outline level-1 items. Each:
{ "heading": "...", "summary": "4-8 sentence DEEP academic summary of ONLY this topic — coherent prose, explain arguments and definitions", "key_points": ["3-6 takeaways for this section"], "outline_id": "o1" }
- summary must be deeper than outline.blurb; do not paste the global summary into every section
- Skip admin-only topics

CONCEPT GRAPH:
Extract the main academic concepts and how they relate. Output concept_graph with:
- nodes: [{ "id": "c1", "label": "Concept Name", "type": "concept" }] (5-15 nodes, short labels)
- edges: [{ "from": "c1", "to": "c2", "relation": "includes"|"is_a"|"causes"|"part_of"|"related_to"|"depends_on"|"contrasts_with" }]
Only real relationships from the text. Empty graph if the material has almost no conceptual structure.

CLOZE CARDS (fill-in-the-blank):
Create 5-12 cloze cards for spaced-repetition study. Each: { "id": "cl1", "prompt": "sentence with ___ blank", "answer": "the hidden word or short phrase", "full_text": "complete sentence" }. Blank the most exam-relevant term or phrase. Prefer one blank per card. Keep answers short (1-5 words).

QUANTITATIVE COURSE DETECTION & ADAPTATION:
Determine whether this document is primarily QUANTITATIVE in nature — meaning it centers on mathematical formulas, numerical calculations, statistical methods, or financial/accounting computations (e.g. Calculus, Statistics, Financial Management, Investment Analysis, Accounting, Economics with heavy math) — as opposed to conceptual/qualitative material (e.g. Marketing, Management theory, general business discussion). Put this boolean classification in the 'is_quantitative' JSON field (true or false).
When 'is_quantitative' is true: shift your summarization approach to prioritize extracting formulas and worked examples thoroughly, keeping the narrative summary comparatively brief and high-level in favor of these structured practical elements — since for quantitative material, the formulas and worked examples ARE the primary study content.

FORMULA EXTRACTION:
Identify every distinct formula/equation presented (especially when is_quantitative is true, but also extract any clear formulas even in mixed documents). For each, output an object in the 'formulas' array: { "name": "short descriptive name, e.g. 'Compound Interest Formula'", "latex": "raw LaTeX ONLY — no surrounding $ or \\( \\) delimiters, e.g. 'A = P(1 + r/n)^{nt}' or '\\\\frac{a}{b}' or '\\\\sum_{i=1}^{n} x_i'", "variables": [ { "symbol": "e.g. P", "meaning": "e.g. Principal amount (initial investment)" } ] }. Return an empty array [] if the document has no formulas.

STEP-BY-STEP WORKED EXAMPLES:
If this document is quantitative, provide 1-3 worked examples showing how to apply the key formula(s) to a realistic problem. If the source document already contains a worked example, use and clean up that one (preserving its actual numbers). If it doesn't but a formula is present, GENERATE a clear, realistic illustrative example (clearly reasonable numbers, not the exact same as any example in the source, creating a new one for practice). Output each in the 'worked_examples' array: { "title": "short description of the scenario", "problem_statement": "the problem as a student would read it, with specific numbers", "steps": [ "step 1 description with calculation shown", "step 2..." ], "final_answer": "the final numeric result with units, e.g. '$1,432.50'" }. Return an empty array [] if not applicable.

DOCUMENT-TYPE CLASSIFICATION:
Identify the document type as one of the following exact strings: "Lecture Notes/Slides", "Academic Article", "Syllabus", "Case Study", "Textbook Chapter", or "Other". Put this classification in the "document_type" JSON field.
Adapt your summary approach according to this classification:
- "Lecture Notes/Slides": focus on key concepts, definitions, and the structure as originally presented.
- "Academic Article": focus on research question/purpose, methodology, key findings, and conclusions.
- "Syllabus": focus on course objectives, topics covered, and learning outcomes.
- "Case Study": structure around Problem/Context, Analysis, and Solution/Recommendation.
- "Textbook Chapter": focus on core theory, definitions, and illustrative examples.
- "Other": use standard general-purpose summarization.

STRUCTURAL SECTIONS INSTRUCTION (hierarchical outline):
In addition to the single overall "summary", break the document down into 2-6 major topic-based SECTIONS — but ONLY if it genuinely covers that many distinct topics (e.g. a lecture covering "Tanımlar", "4P Karışımı", "Pazar Bölümlendirme" would get 3 sections, each in the order the topics appear). For each section output an object in the 'sections' array: { "heading": "short 2-5 word topic label", "summary": "2-4 sentence blurb covering just that section's academic content — footnote markers [n] allowed and encouraged where applicable" }. This lets a student jump straight to the topic they need instead of reading one long undifferentiated summary — like a table of contents with a preview under each entry.
If the document covers only ONE continuous topic, or is too short/simple to meaningfully split (a short handout, a single-topic one-pager), return an empty array — do not force sections onto material that doesn't naturally have them. Sections must still obey the EXAM-FOCUSED CONTENT FILTERING rule below — never create a section purely about course administration/logistics.

TABULAR AND CHART DATA EXTRACTION:
In addition to the summary, key terms, key points, and quiz questions, also identify any TABULAR DATA (rows/columns of related figures, comparisons, structured lists of data) and any CHART-WORTHY DATA (numeric comparisons, percentages, breakdowns, trends that would be clearly shown as a bar/pie/line chart) present in the source material. If visual analysis was used and chart/graph images were shown to you, extract the ACTUAL data values from those images for this purpose. Include this as two new JSON fields:
- 'tables': an array of objects, each { "title": string, "headers": [string, ...], "rows": [[string, ...], ...] } — one object per distinct table found. Return an empty array if no clear tabular data exists.
- 'charts': an array of objects, each { "title": string, "type": "bar" | "pie" | "line", "labels": [string, ...], "data": [number, ...] } — one object per distinct chart-worthy dataset found (pick the most fitting chart type for the data — proportions/percentages of a whole → 'pie', comparisons across categories → 'bar', progression over time → 'line'). Return an empty array if no clear chart-worthy data exists.
Do NOT fabricate tables/charts if the source doesn't actually contain this kind of data — empty arrays are the correct output for purely narrative/text documents.

INLINE FOOTNOTES / SOURCE REFERENCES INSTRUCTION:
For non-obvious or specific factual claims in the summary and key_points, add a footnote marker like [1], [2], etc. immediately after the claim. Build a corresponding 'footnotes' array in your JSON output: [{ "id": 1, "reference": "brief description of which section/topic of the source this relates to, e.g. 'Section 2.2 - SEO discussion' or 'Introduction section'", "page": number | null }]. ${buildFootnotePageInstruction(hasPageMarkers, pageMarkerLabel)} Don't over-footnote — reserve markers for specific, checkable claims (numbers, definitions, named findings), not every sentence.

SUGGESTED COURSE TAG INSTRUCTION:
Below is this student's OFFICIAL course catalog (format: CODE — Course Name):
${courseCatalogBlock}

Compare the document's content, terminology, and subject matter against this catalog. If it clearly corresponds to one of these listed courses, return that course's EXACT code (copied character-for-character, e.g. 'BUS330') as 'suggested_course_tag' — do not alter, reformat, or add spaces to it. Only if the content doesn't match any listed course, but a course code or clear subject label is otherwise evident directly in the source text, fall back to that as a short free-text string instead. If genuinely unclear and nothing in the catalog fits, return null. Never invent a course code that is neither in the catalog above nor explicitly present in the source text.

LENGTH INSTRUCTION:
${lengthInstruction}

ACCURACY INSTRUCTION:
Base your summary, key terms, key points, and quiz questions STRICTLY on content actually present in the provided text. Do not invent, assume, or add information not found in the source material. If a section of the document is unclear or incomplete, reflect that faithfully rather than filling gaps with assumptions. Copy any specific numbers, formulas, names, or technical terms EXACTLY as they appear in the source — do not paraphrase or alter precise factual details.

LANGUAGE INSTRUCTION:
Respond strictly in the language: '${langLabel}'. Write the ENTIRE response (the summary, all key_terms terms and definitions, all key_points, all quiz_questions, and the document_type) in that specified language (the returned value of "document_type" must be one of the specified English strings: "Lecture Notes/Slides", "Academic Article", "Syllabus", "Case Study", "Textbook Chapter", or "Other").

EXAM-FOCUSED CONTENT FILTERING (applies regardless of style, and is NOT optional):
Before writing anything, separate the source into (a) actual academic subject matter — concepts, definitions, theories, frameworks/models (e.g. "the 4Ps"), processes, relationships, formulas, examples, case findings, named studies — and (b) course administration/logistics — grading weights or percentages, exam format/rules (open/closed book, question types), attendance/absence policy, late-submission or bonus-point policy, grade-appeal/itiraz procedures and deadlines, office hours, contact info, syllabus housekeeping, textbook title/edition/ISBN.
ONLY (a) belongs anywhere in your output — summary, key_points, footnotes, and quiz_questions. COMPLETELY EXCLUDE (b): do not summarize it, do not footnote it, and never turn it into a quiz_question — a student is never tested on how many percentage points the midterm is worth, how to appeal a grade, or which textbook edition is assigned, no matter how specific or "checkable" those numbers are.
If a document is mostly or entirely administrative logistics (e.g. a course intro/syllabus slide with little real subject matter), it is completely correct — and REQUIRED — to produce a short summary and few or even zero key_points/quiz_questions. Never pad the output with excluded (b) content just to reach a target count; a short, honest summary is far better than a long one padded with grading/attendance/appeal trivia.

DIAGRAMS (Mermaid reconstruction) & VISUAL-STRUCTURE AWARENESS:
You are only given extracted text — visual layout (boxes, arrows, side-by-side positioning) is lost in extraction. A flowchart, comparison diagram, process illustration, hierarchy or cycle often survives only as a cluster of short disconnected phrases, sequential stage names, or paired opposing terms. When you detect such a structure:
1. RECONSTRUCT it as a real Mermaid diagram and put it in the "diagrams" array: { "title": "short descriptive title", "mermaid": "valid Mermaid source (prefer flowchart TD / flowchart LR / graph TD / sequenceDiagram / mindmap)", "description": "1-2 sentence plain-language explanation of what the diagram shows" }. Keep Mermaid syntax simple and valid. Limit to the 2-4 most important diagrams in the whole document.
2. Also add ONE key_point reconstructing the same idea, clearly prefixed with "Diyagram/Görsel:" (or "Diagram/Visual:" if responding in English) so the student knows it is an interpretation of a visual element — e.g. "Diyagram: 'Satış kavramı' (ürün/satış odaklı) ile 'Pazarlama kavramı' (müşteri ihtiyaç odaklı) karşılaştırılıyor."
Only do this when fragments genuinely look diagram-like — never invent diagrams that have no basis in the text. Return empty "diagrams" array when nothing is reconstructible.

CODE SNIPPETS & DATA PREVIEWS INSTRUCTION:
If the source material includes programming code snippets (e.g. Python, R, SQL used for data analysis), do not ignore them — briefly describe WHAT METHODOLOGY STEP each code block represents in the summary/key_points (e.g. 'the analysis loads and cleans the dataset, then engineers features including a lagged return and rolling volatility measure' rather than omitting this entirely). Do not attempt to reproduce the code verbatim in the summary, just describe its purpose and role in the overall analysis. If a code block's output shows a small data preview (a few rows of a dataframe), treat that as a legitimate table for the 'tables' field.

PROFESSIONAL TONE INSTRUCTION:
Write in a clear, formal academic register. Avoid filler phrases, redundant restatements, and vague generalities. Use precise terminology appropriate to the subject matter.

STYLE-SPECIFIC INSTRUCTION:
${styleInstruction}`

    let rawContent = ""
    let sourceTextForReview = ""
    let visualAnalysisUsed = false

    if (!useChunkedPipeline) {
      // ========================================================================
      // FAST PATH (unchanged): short/medium documents — single Groq call,
      // optional visual (image) analysis pass.
      // ========================================================================
      const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      const isPptx = mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      const isPdf = mimeType === "application/pdf"

      const runVisuals = !!analyzeVisuals && (isPdf || isPptx || isDocx)
      let base64Images: string[] = []

      if (runVisuals) {
        if (isDocx) {
          try {
            console.log("DOCX Visual analysis enabled. Extracting embedded media images from word/media/...")
            const zip = new JSZip()
            await zip.loadAsync(fileBytes)

            const mediaFiles = Object.keys(zip.files).filter(name =>
              name.startsWith("word/media/") && /\.(png|jpe?g|webp|gif|bmp)$/i.test(name)
            )

            mediaFiles.sort((a, b) => {
              const numA = parseInt(a.replace(/[^0-9]/g, ""), 10) || 0
              const numB = parseInt(b.replace(/[^0-9]/g, ""), 10) || 0
              return numA !== numB ? numA - numB : a.localeCompare(b)
            })

            const cappedMediaFiles = mediaFiles.slice(0, 8)
            console.log(`Found ${mediaFiles.length} media files in DOCX. Processing top ${cappedMediaFiles.length}...`)

            for (const mediaPath of cappedMediaFiles) {
              try {
                const imgBytes = await zip.files[mediaPath].async("uint8array")
                if (imgBytes && imgBytes.byteLength > 0) {
                  base64Images.push(bytesToBase64(imgBytes))
                }
              } catch (mediaErr) {
                console.error(`Failed to extract DOCX media image ${mediaPath}:`, mediaErr)
              }
            }

            if (base64Images.length > 0) {
              visualAnalysisUsed = true
              console.log(`Successfully prepared ${base64Images.length} DOCX media images for vision-based analysis.`)
            }
          } catch (docxVisionErr) {
            console.error("DOCX media image extraction failed:", docxVisionErr)
          }
        } else if (isPptx) {
          try {
            console.log("PPTX Visual analysis enabled. Extracting embedded media images from ppt/media/...")
            const zip = new JSZip()
            await zip.loadAsync(fileBytes)

            const mediaFiles = Object.keys(zip.files).filter(name =>
              name.startsWith("ppt/media/") && /\.(png|jpe?g|webp|gif|bmp)$/i.test(name)
            )

            mediaFiles.sort((a, b) => {
              const numA = parseInt(a.replace(/[^0-9]/g, ""), 10) || 0
              const numB = parseInt(b.replace(/[^0-9]/g, ""), 10) || 0
              return numA !== numB ? numA - numB : a.localeCompare(b)
            })

            const cappedMediaFiles = mediaFiles.slice(0, 8)
            console.log(`Found ${mediaFiles.length} media files in PPTX. Processing top ${cappedMediaFiles.length}...`)

            for (const mediaPath of cappedMediaFiles) {
              try {
                const imgBytes = await zip.files[mediaPath].async("uint8array")
                if (imgBytes && imgBytes.byteLength > 0) {
                  base64Images.push(bytesToBase64(imgBytes))
                }
              } catch (mediaErr) {
                console.error(`Failed to extract media image ${mediaPath}:`, mediaErr)
              }
            }

            if (base64Images.length > 0) {
              visualAnalysisUsed = true
              console.log(`Successfully prepared ${base64Images.length} PPTX media images for vision-based analysis.`)
            }
          } catch (pptxVisionErr) {
            console.error("PPTX media image extraction failed:", pptxVisionErr)
          }
        } else if (mimeType === "application/pdf") {
          const pdfcoApiKey = Deno.env.get('PDFCO_API_KEY')
          if (pdfcoApiKey) {
            try {
              console.log("PDF.co Visual analysis enabled. Uploading PDF to convert first 8 pages to images...")
              // Denetim Raporu, 2026-08-31 — LIVE TEST FINDING: this used to
              // POST the file directly as multipart form-data, which PDF.co's
              // convert endpoint rejects with a 400 (it only accepts a `url`
              // to an already-hosted file). See uploadFileToPdfCo() above —
              // confirmed against PDF.co's own docs and against a real 400
              // in this project's production logs.
              const fileUrl = await uploadFileToPdfCo(fileBytes, pdfcoApiKey, 'document.pdf')

              const pdfcoRes = fileUrl
                ? await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
                    method: 'POST',
                    headers: { 'x-api-key': pdfcoApiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: fileUrl, pages: '0-7' })
                  })
                : null

              if (!fileUrl) {
                console.warn('PDF.co file upload failed. Falling back to text-only analysis.')
              } else if (pdfcoRes && pdfcoRes.ok) {
                const pdfcoData = await pdfcoRes.json()
                if (!pdfcoData.error && (pdfcoData.urls || pdfcoData.url)) {
                  let imageUrls: string[] = []
                  const rawUrls = pdfcoData.urls || pdfcoData.url
                  if (Array.isArray(rawUrls)) {
                    imageUrls = rawUrls
                  } else if (typeof rawUrls === 'string') {
                    imageUrls = [rawUrls]
                  }

                  console.log(`PDF.co converted ${imageUrls.length} pages. Downloading page images...`)
                  for (const imgUrl of imageUrls) {
                    try {
                      const imgRes = await fetch(imgUrl)
                      if (imgRes.ok) {
                        const buffer = await imgRes.arrayBuffer()
                        base64Images.push(bytesToBase64(new Uint8Array(buffer)))
                      }
                    } catch (imgDownloadErr) {
                      console.error(`Failed to download page image from ${imgUrl}:`, imgDownloadErr)
                    }
                  }

                  if (base64Images.length > 0) {
                    visualAnalysisUsed = true
                    console.log(`Successfully prepared ${base64Images.length} images for vision-based analysis.`)
                  }
                } else {
                  console.warn("PDF.co API returned error:", pdfcoData)
                }
              } else {
                console.warn(`PDF.co response status failed: ${pdfcoRes?.status ?? 'unknown'}`)
              }
            } catch (pdfcoErr) {
              console.error("PDF.co page conversion failed, falling back to text-only:", pdfcoErr)
            }
          } else {
            console.warn("PDFCO_API_KEY is missing. Falling back to text-only analysis.")
          }
        }
      }

      // Update stage to analyzing
      await serviceClient
        .from('documents')
        .update({ processing_stage: 'analyzing' })
        .eq('id', documentId)

      // Pass 1: Call Groq to generate Draft
      let groqResponse;
      let pass1Completed = false;

      if (visualAnalysisUsed && base64Images.length > 0) {
        try {
          const visualSystemPrompt = systemPrompt + `\n\nVISUAL ANALYSIS INSTRUCTION:
In addition to the text below, you are shown images of this document's pages. Use these images to also identify and incorporate any information from charts, diagrams, tables, or visual elements that the text alone doesn't fully capture. Reference specific visual content in your summary/key_points where relevant.`

          const pass1Messages = [
            {
              role: "system",
              content: visualSystemPrompt
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Here is the extracted text from the document:\n\n${textToSend}`
                },
                ...base64Images.map(b64 => ({
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${b64}`
                  }
                }))
              ]
            }
          ]

          console.log("Attempting vision-based analysis using qwen/qwen3.6-27b...")
          groqResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${groqApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              // Groq retired llama-3.2-90b-vision-preview; qwen/qwen3.6-27b is
              // the current vision-capable model (same image_url format).
              model: "qwen/qwen3.6-27b",
              temperature: 0.3,
              // Qwen3.6 is a hybrid reasoning model that thinks by default —
              // turn that off so "content" is just the direct JSON answer.
              reasoning_effort: "none",
              // See callGroqJson above — an explicit cap keeps this request's
              // estimated token usage safely under the account's per-model
              // tokens-per-minute limit.
              max_completion_tokens: 4096,
              response_format: { type: "json_object" },
              messages: pass1Messages
            })
          }, 0, 25000) // no retries, 25s cap — leave real time budget for the text-only fallback below and the review pass afterward

          if (groqResponse.ok) {
            pass1Completed = true
            console.log("Vision-based Pass 1 completed successfully.")
          } else {
            let visionErrBody = ""
            try { visionErrBody = await groqResponse.clone().text() } catch (_readErr) { /* ignore */ }
            console.warn(`Vision model call returned non-ok status: ${groqResponse.status}. Falling back to text-only. Body: ${visionErrBody}`)
            visualAnalysisUsed = false
          }
        } catch (visionErr) {
          console.warn("Vision-based analysis call failed. Falling back to text-only:", visionErr)
          visualAnalysisUsed = false
        }
      }

      if (!pass1Completed) {
        console.log("Running standard text-only analysis using openai/gpt-oss-120b...")

        // This account's tokens-per-minute limit for openai/gpt-oss-120b has
        // been observed as low as 8000 — the system prompt alone (~2,900
        // tokens, since it carries all the formatting/LaTeX/quantitative
        // instructions) leaves surprisingly little room for the document
        // text plus the completion. Rather than hand-tune one "safe" size
        // (impossible to get right for every document/tokenizer), try
        // progressively smaller (text budget, completion budget) pairs and
        // only give up if a non-token-size error occurs or every tier fails.
        const draftTiers: Array<{ textChars: number; maxCompletionTokens: number }> = [
          { textChars: 6000, maxCompletionTokens: 2500 },
          { textChars: 3000, maxCompletionTokens: 1800 },
          { textChars: 1200, maxCompletionTokens: 1200 }
        ]

        for (let i = 0; i < draftTiers.length; i++) {
          const tier = draftTiers[i]
          const draftUserContent = textToSend.length > tier.textChars
            ? textToSend.substring(0, tier.textChars) + " [truncated to fit the AI provider's rate limits]"
            : textToSend

          try {
            groqResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${groqApiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                // llama-3.3-70b-versatile is being retired by Groq (shutdown
                // 2026-08-16); openai/gpt-oss-120b is one of Groq's recommended
                // replacements.
                model: "openai/gpt-oss-120b",
                temperature: 0.3,
                reasoning_effort: "low",
                include_reasoning: false,
                max_completion_tokens: tier.maxCompletionTokens,
                response_format: { type: "json_object" },
                messages: [
                  {
                    role: "system",
                    content: systemPrompt
                  },
                  {
                    role: "user",
                    content: draftUserContent
                  }
                ]
              })
            }, 1, 25000) // 1 retry max, 25s cap per attempt — leaves time for the review pass afterward
          } catch (fetchErr) {
            console.error("Pass 1 Groq API fetchWithRetry exception: ", fetchErr)
            await markFailed(serviceClient, documentId)
            return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
              status: 503,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          if (groqResponse.ok) break

          let draftErrBody: any = null
          try { draftErrBody = await groqResponse.clone().json() } catch (_readErr) { /* ignore */ }
          // Groq has been observed returning this error as a 400, a 429, OR
          // a 413 ("Request too large"), depending on the exact overage —
          // treat all three the same way. Missing 413 here was a real bug:
          // it fell through to the "non-retryable" branch below and gave up
          // on tier 1 instead of shrinking to tier 2/3, failing documents
          // that a smaller tier would have handled fine.
          const isTokenSizeError = (groqResponse.status === 400 || groqResponse.status === 429 || groqResponse.status === 413) &&
            draftErrBody?.error?.code === 'rate_limit_exceeded' &&
            draftErrBody?.error?.type === 'tokens'

          console.error(`Groq API Draft call failed (text budget ${tier.textChars} chars, completion budget ${tier.maxCompletionTokens}, status ${groqResponse.status}): `, JSON.stringify(draftErrBody))

          if (!isTokenSizeError || i === draftTiers.length - 1) {
            await markFailed(serviceClient, documentId)
            return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
              status: 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          // else: too-large-for-TPM error — loop again with a smaller tier
        }
      }

      const groqData = await groqResponse.json()

      if (!groqResponse.ok) {
        console.error("Groq API Draft call failed: ", JSON.stringify(groqData))
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      rawContent = groqData.choices?.[0]?.message?.content ?? ""
      if (!rawContent) {
        console.error('Empty response content from Groq Draft: ', JSON.stringify(groqData))
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({ error: 'AI failed to generate a response' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      // Strip any stray <think> block before this draft text gets embedded
      // into the review-pass prompt below (see stripThinkBlock definition).
      const draftStripped = stripThinkBlock(rawContent)
      if (draftStripped === null) {
        console.error('Groq Draft response was an unterminated <think> block (ran out of tokens while reasoning):', rawContent)
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({ error: 'The AI ran out of thinking time before writing a draft — please try again' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      rawContent = draftStripped

      sourceTextForReview = textToSend
      if (sourceTextForReview.length > 6000) {
        sourceTextForReview = sourceTextForReview.substring(0, 6000) + " [truncated for review]"
      }
    } else {
      // ========================================================================
      // LONG-DOC PATH — compact prompts (fixes Groq 413 payload-too-large)
      // Huge systemPrompt + 22k text was causing ALL windows to 413.
      // ========================================================================
      await serviceClient
        .from('documents')
        .update({ processing_stage: 'analyzing' })
        .eq('id', documentId)

      // Per-window extraction quotas.
      //
      // These used to be the fixed "5-15 key_terms / 5-12 key_points / 3-6
      // quiz_questions" below, written when a window was always one SLICE of
      // a document: several windows each hit the cap, and the merge + dedupe
      // downstream turned 2x15 candidates into ~24 distinct terms. Once
      // WINDOW grew to 13000 and a single-chapter upload started landing in
      // ONE window, that per-slice cap silently became the cap for the whole
      // document — measured on a 30-page deck whose own glossary lists 25
      // terms: two windows produced 24/25, one window produced exactly 15.
      // The window got better (it finally kept "peak"/"trough", which every
      // two-window run had dropped) while coverage got worse.
      //
      // So the quota has to follow what the window actually covers. At
      // total === 1 the window IS the document and asks for full coverage;
      // from 2 windows up the original per-slice numbers apply unchanged,
      // because there the merge step is what reaches full coverage.
      //
      // This costs no extra token budget: the single-window run above spent
      // ~1,400 of its 3,072 completion tokens, so the model was obeying this
      // prompt's cap, not running out of room. maxCompletionTokens stays at
      // 3072 and the pacer arithmetic in the WINDOW comment is unaffected.
      const wholeDocInOneWindow = (total: number) => total === 1
      // "this part" is a lie when the window is the whole document, and the
      // model reads it as licence to skip material it thinks belongs to some
      // other part that does not exist. Every mention of scope in the prompt
      // goes through this.
      const scopeWord = (total: number) => wholeDocInOneWindow(total) ? 'the document' : 'this part'
      const termQuota = (total: number) => wholeDocInOneWindow(total) ? '15-28' : '5-15'
      const pointQuota = (total: number) => wholeDocInOneWindow(total) ? '10-18' : '5-12'
      const quizQuota = (total: number) => wholeDocInOneWindow(total) ? '5-10' : '3-6'

      // Compact extraction prompt — keeps request under Groq limits
      const compactWindowPrompt = (wi: number, total: number) =>
        `You extract study material from ${total === 1 ? 'a complete academic document' : `part ${wi + 1}/${total} of a long academic document`}.
Language for all text fields: ${langLabel}.
Respond ONLY with JSON:
{
  "summary": "5-10 sentences of CONCRETE content from ${total === 1 ? 'the document' : 'this part only'} — name real topics, methods, definitions",
  "summary_executive": "1-2 sentences naming the subject of ${total === 1 ? 'the document' : 'this part'}",
  "key_terms": [{"term":"...","definition":"..."}],
  "key_points": ["..."],
  "quiz_questions": [{"question":"...","answer":"..."}],
  "is_quantitative": false,
  "formulas": [{"name":"...","latex":"...","variables":[{"symbol":"...","meaning":"..."}]}],
  "outline_items": [{"heading":"...","blurb":"..."}],
  "sections": [{"heading":"...","summary":"...","key_points":["..."]}],
  "tables": [{"title":"...","headers":["..."],"rows":[["..."]]}],
  "charts": [{"title":"...","type":"bar|pie|line","labels":["..."],"data":[0]}],
  "diagrams": [{"title":"...","mermaid":"...","description":"..."}],
  "worked_examples": [{"title":"...","problem_statement":"...","steps":["..."],"final_answer":"..."}]
}
Rules:
- Extract ${termQuota(total)} key_terms and ${pointQuota(total)} key_points when content allows
- ${quizQuota(total)} quiz_questions when content allows${total === 1 ? `
- This is the WHOLE document, not an excerpt: cover every section, and if it ends with a glossary or "review terms" list, every entry on that list must appear in key_terms
- Keep definitions to one sentence so the full set fits
- A figure or table CAPTION is content, not decoration: it is often the only place a date, range, period or quantity is written out in words, and those are exactly what gets examined — carry them into key_points and quiz_questions verbatim
- Worked cases, named examples and boxed features ("in practice", "case study", applications) are testable material too; do not skip them as filler` : ''}
- NEVER write meta text like "no draft provided" or "qualitative overview"
- Use real topic names from the text (e.g. supervised learning, neural networks)
- Ignore grading/attendance/admin text
- 'tables': only real tabular data actually present in ${scopeWord(total)} — empty array if none, never fabricate
- 'charts': only chart-worthy numeric data actually present in ${scopeWord(total)} (pick bar for category comparisons, pie for proportions of a whole, line for progression over time) — empty array if none
- 'diagrams': when short disconnected phrases, stage names, or paired opposing terms in ${scopeWord(total)} clearly reconstruct a flowchart/comparison/hierarchy/cycle, rebuild it as valid Mermaid source (flowchart TD/LR, graph TD, sequenceDiagram, or mindmap); at most ${total === 1 ? '2-3' : '1-2'}; empty array if nothing reconstructible — never invent
- 'worked_examples': 1-2 solved problems when formulas/calculations are present in ${scopeWord(total)} (prefer the source's own worked numbers); empty array otherwise`

      // Window size is bounded by this account's tokens-per-minute cap, not by
      // the HTTP payload limit — the 413 comment this constant used to carry
      // was measuring the wrong thing. The real budget for ONE window call is:
      //
      //     compactWindowPrompt   ~527 tokens  (measured, not estimated)
      //   + document text          WINDOW / 4
      //   + maxCompletionTokens   3072 tokens  (worst case)
      //   <= tokenPacer ceiling   7200 tokens  (8000 TPM * PACER_SAFETY 0.9)
      //
      // which solves to WINDOW <= ~14,400 chars. 7000 left ~3,600 tokens of
      // that budget permanently unused, and the cost of under-filling is not
      // merely "more calls": on 8,000 TPM, EVERY extra window costs a full
      // ~60s TokenPacer wait before it can start. A live 30-page, 12,451-char
      // deck measured 130s end to end, 114s of which (87%) was the pacer
      // waiting between two windows that would have fit in one. That wait is
      // also what kept budgetLeft() at 0 and made the review pass structurally
      // unreachable (PIPELINE_BUDGET_MS is 110s; the waits alone exceeded it).
      //
      // 13000 keeps the worst case at 3250 + 527 + 3072 = 6,849 tokens, under
      // the 7,200 ceiling, while letting a typical single-chapter upload land
      // in one window. If a document's text tokenizes worse than 4 chars/token
      // (Turkish does) and a window still overshoots, this is self-correcting:
      // extractWindow's catch shrinks an oversized payload to 55% and retries,
      // which lands back at ~7,150 chars — i.e. the old behaviour — at a cost
      // of one failed call rather than a failed summary.
      const WINDOW = 13000
      // Denetim Raporu, 2026-08-31: this cap used to be a hardcoded 8 —
      // 8 * 7000 = 56,000 characters, silently dropping anything past that
      // point with NO signal to the student that content was cut. MAX_CHUNKS
      // already existed in this file (defined above, "hard ceiling: prefer
      // finishing over analyzing every page under Edge timeout") for exactly
      // this purpose but was only ever wired into the unused map-reduce
      // system, never into this actual live loop. Using it here raises the
      // ceiling to MAX_CHUNKS * WINDOW = 12 * 13000 = 156,000 characters
      // (84,000 back when WINDOW was 7000). The real protection
      // against exceeding the Edge wall-clock is the per-batch
      // `budgetLeft() < 20_000` check a few lines below, which already stops
      // adding more windows once time is genuinely short — that check is
      // what should decide "when to stop", not a fixed window count guessed
      // in advance.
      const windows: string[] = splitIntoWindows(extractedText, WINDOW, MAX_CHUNKS)
      const windowedChars = windows.reduce((n, w) => n + w.length, 0)
      console.log(
        `Long-doc compact: ${windows.length} window(s), totalChars=${extractedText.length}, ` +
        `windowedChars=${windowedChars} (${Math.round(100 * windowedChars / Math.max(1, extractedText.length))}% of document reachable)`
      )

      async function extractWindow(wi: number, text: string): Promise<any | null> {
        let payload = text
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await callGroqJson(
              groqApiKey,
              compactWindowPrompt(wi, windows.length),
              payload,
              {
                model: MODEL_HEAVY,
                temperature: 0.2,
                // Denetim Raporu, 2026-08-31: raised from 2048 → 3072 to make
                // room for the tables/charts/diagrams/worked_examples fields
                // added to compactWindowPrompt above — those were previously
                // absent from this schema entirely (the pre-existing
                // regression this fixes), and a Mermaid diagram or a table
                // with several rows can genuinely need the extra tokens to
                // avoid getting silently truncated mid-JSON.
                maxCompletionTokens: 3072,
                timeoutMs: Math.min(40000, Math.max(15000, budgetLeft() - 10000)),
                maxRetries: 0
              }
            )
            return result
          } catch (err: any) {
            const msg = String(err?.message || err)
            console.error(`Window ${wi + 1} attempt ${attempt + 1} failed:`, msg.slice(0, 200))
            // 413 / context length → shrink payload and retry
            if (/413|too large|context_length|maximum context|payload/i.test(msg)) {
              payload = payload.slice(0, Math.floor(payload.length * 0.55))
              console.warn(`Window ${wi + 1}: shrinking payload to ${payload.length} chars`)
              continue
            }
            // rate limit → brief wait then retry once
            if (/429|rate limit|tpm/i.test(msg) && attempt < 2) {
              await new Promise(r => setTimeout(r, 2500 * (attempt + 1)))
              continue
            }
            // json_validate_failed → retry unchanged.
            //
            // Groq returns this as a 400, which used to fall through to the
            // `return null` below and give up after ONE attempt. That is the
            // wrong read of the error: it does not mean the request was too
            // big or too fast, it means the model happened to emit malformed
            // JSON this time. Nothing about the input is at fault, so neither
            // shrinking the payload nor waiting helps — sending the identical
            // request again does, because the failure is stochastic.
            //
            // The cost of getting this wrong is the whole card: with one
            // window, a failed window means "All windows failed" and the
            // last-resort path rebuilds the summary from the first 5,000
            // characters. Measured live on an 11,050-char deck: 17 key terms
            // instead of the 28 the same document produced on a clean run.
            // Retried ONCE, not twice, and only with budget to spare. A
            // retry costs a fresh window call, which on 8,000 TPM means a
            // full ~60s pacer wait — but so does the last-resort mini
            // extract this replaces, so one retry is free in wall-clock
            // terms and buys the whole document instead of 5,000 characters.
            // A second retry would NOT be free: it stacks another wait on
            // top, and by then the narrative writer's own budget gate
            // (35s) is at risk — trading a thin card for one with no
            // written summary at all is not a trade worth making.
            if (
              /json_validate_failed|failed to generate json/i.test(msg) &&
              attempt < 1 &&
              budgetLeft() > JSON_RETRY_MIN_BUDGET_MS
            ) {
              console.warn(`Window ${wi + 1}: json_validate_failed — ayni istek bir kez daha deneniyor (butce ${budgetLeft()}ms)`)
              continue
            }
            return null
          }
        }
        return null
      }

      // SPEED FIX: process windows in concurrent batches (CHUNK_CONCURRENCY at
      // a time) instead of one fully sequential Groq round-trip per window.
      // Early-exit/budget checks now run between batches rather than between
      // every single window — slightly less granular, but this is what turns
      // an up-to-8x-sequential-calls stage into ~8/CHUNK_CONCURRENCY calls of
      // wall-clock time, and lets more windows fit inside the same budget.
      // ADAPTIVE CONCURRENCY. CHUNK_CONCURRENCY is now a ceiling, not the
      // batch size: the real batch size is whatever the account's token
      // budget can absorb at once. On the observed 8,000 TPM this resolves
      // to 1, which is exactly right — two ~5,000-token window calls cannot
      // both fit in 8,000, and firing them together is what made two runs of
      // the same document produce 26 terms and 14 terms respectively. On a
      // larger plan the same expression allows real parallelism again.
      const estWindowTokens = estimateTokens(
        compactWindowPrompt(0, windows.length),
        windows[0] || '',
        3072
      )
      const windowConcurrency = Math.min(CHUNK_CONCURRENCY, tokenPacer.safeConcurrency(estWindowTokens))
      console.log(
        `Window concurrency: ${windowConcurrency} ` +
        `(TPM limit ${tokenPacer.limit}${tokenPacer.limitKnown ? '' : ', varsayilan'}, ` +
        `~${estWindowTokens} token/pencere, tavan ${CHUNK_CONCURRENCY})`
      )

      const windowResults: any[] = []
      for (let batchStart = 0; batchStart < windows.length; batchStart += windowConcurrency) {
        if (budgetLeft() < 20_000 && windowResults.length > 0) {
          console.warn(`Budget low — stopping before batch starting at window ${batchStart}`)
          break
        }
        // Enough good extractions already?
        if (windowResults.length >= 4) {
          const termsSoFar = windowResults.reduce((n, r) => n + (r.key_terms?.length || 0), 0)
          if (termsSoFar >= 12) {
            console.log('Enough extractions — skipping remaining windows')
            break
          }
        }

        const batchEnd = Math.min(batchStart + windowConcurrency, windows.length)
        await serviceClient.from('documents')
          .update({ processing_stage: `chunking:${batchEnd}/${windows.length}` })
          .eq('id', documentId)

        const batchIndices: number[] = []
        for (let wi = batchStart; wi < batchEnd; wi++) batchIndices.push(wi)

        const batchResults = await Promise.all(batchIndices.map(wi => extractWindow(wi, windows[wi])))
        for (let bi = 0; bi < batchResults.length; bi++) {
          const result = batchResults[bi]
          const wi = batchIndices[bi]
          if (result) {
            // Normalize alternate field names
            if (!result.summary && result.chunk_summary) result.summary = result.chunk_summary
            windowResults.push(result)
            console.log(`Window ${wi + 1} ok: terms=${(result.key_terms || []).length} points=${(result.key_points || []).length} quiz=${(result.quiz_questions || []).length}`)
          }
        }
      }

      // Last-resort: single tiny window if everything failed
      if (windowResults.length === 0) {
        console.warn('All windows failed — last-resort mini extract on first 5000 chars')
        const mini = await extractWindow(0, extractedText.slice(0, 5000))
        if (mini) windowResults.push(mini)
      }

      if (windowResults.length === 0) {
        console.error('All long-doc windows failed even after shrink retries')
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({
          error: 'AI istek boyutu/kota hatası. 1 dk bekleyip tekrar deneyin. / AI payload or rate error — wait 1 min and retry.'
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // FAIR MERGE ACROSS WINDOWS.
      // These merges used to flatMap in window order and then slice to a cap.
      // Because each window returns 5-15 key terms, the 40-item cap was
      // typically filled by windows 1-3 and every later window's extractions
      // were silently discarded at the slice — the back of the document lost
      // its terms even when its windows HAD been analyzed successfully.
      // roundRobinInterleave (already in this file, previously unwired) takes
      // one item per window per pass instead, so a cap now trims the tail of
      // every window evenly rather than deleting the last windows entirely.
      const perWindow = (key: string) =>
        windowResults.map((r: any) => Array.isArray(r[key]) ? r[key] : [])

      const mergedKeyTerms = dedupeKeyTerms(roundRobinInterleave(perWindow('key_terms'))).slice(0, 40)
      const mergedKeyPoints = dedupeByText(roundRobinInterleave(perWindow('key_points')), (x: string) => x).slice(0, 35)
      const mergedQuiz = dedupeByText(roundRobinInterleave(perWindow('quiz_questions')), (q: any) => q?.question || '').slice(0, 20)
      const mergedFormulas = roundRobinInterleave(perWindow('formulas')).slice(0, 30)
      const quantFraction = windowResults.filter(r => r.is_quantitative).length / Math.max(1, windowResults.length)
      // Denetim Raporu, 2026-08-31 — ROOT-CAUSE FIX: this long-doc path used to
      // hardcode tables/charts/diagrams/worked_examples to empty arrays below
      // (mergedDraft), even though compactWindowPrompt now asks each window
      // for them. Merge them here exactly like the other per-window fields,
      // with a light title-based dedupe (windows don't overlap, but the same
      // table/diagram sometimes reappears if a slide repeats) and the same
      // "cap at N" pattern already used for terms/points/quiz above.
      const mergedTables = dedupeByText(
        roundRobinInterleave(perWindow('tables')),
        (t: any) => t?.title || ''
      ).filter((t: any) => t && t.title && Array.isArray(t.rows) && t.rows.length > 0).slice(0, 12)
      const mergedCharts = dedupeByText(
        roundRobinInterleave(perWindow('charts')),
        (c: any) => c?.title || ''
      ).filter((c: any) => c && c.title && Array.isArray(c.data) && c.data.length > 0).slice(0, 10)
      const mergedDiagrams = dedupeByText(
        roundRobinInterleave(perWindow('diagrams')),
        (d: any) => d?.title || ''
      ).filter((d: any) => d && d.title && d.mermaid).slice(0, 8)
      const mergedWorkedExamples = dedupeByText(
        roundRobinInterleave(perWindow('worked_examples')),
        (w: any) => w?.title || w?.problem_statement || ''
      ).filter((w: any) => w && (w.title || w.problem_statement)).slice(0, 10)
      // Denetim Raporu, 2026-08-31: attempted to restore "Kavram Grafiği"
      // (concept_graph) the same way tables/charts/diagrams were restored
      // above, but reverted at the user's request after a live test came
      // back noticeably thinner (fewer terms/points/quiz) than the prior
      // confirmed-good run — kökten çözmeden önce şüpheli değişikliği geri
      // almak, belirsiz bir teoriyle üstüne inşa etmekten daha güvenli.
      //
      // 2026-10-03 — THE ROOT CAUSE IS NOW IDENTIFIED, and it confirms that
      // revert was right. Each window call runs under a fixed
      // maxCompletionTokens (3072) against an account whose observed Groq
      // tokens-per-minute cap is as low as 8,000. Adding a schema field does
      // not buy extra output budget; the model pays for the new field out of
      // the same completion allowance, so concept_graph's nodes/edges were
      // funded by returning fewer key terms/points/quiz. "Thinner output"
      // was not noise — it is the arithmetic.
      //
      // So concept_graph deliberately STAYS empty on this path. The fix is
      // not a prompt tweak; it needs either (a) resumable multi-invocation
      // processing so a window's extraction is not competing for one
      // completion budget, or (b) one dedicated graph pass over the already
      // merged key terms, which costs a single extra call instead of taxing
      // every window. Do not re-add it to compactWindowPrompt's schema
      // without one of those in place first.
      //
      // Note the contrast with footnotes: those were ALSO absent from this
      // path, and were restored WITHOUT touching the schema at all, by
      // computing page anchors from the "--- SAYFA N ---" index after the
      // fact (anchorCitations(), called once before the study card is
      // saved). Zero extra tokens, and the page numbers are verifiable.
      // concept_graph has no equivalent purely-textual derivation, which is
      // exactly why it is the one field still waiting.

      let bestSummary = windowResults.map(r => String(r.summary || '')).filter(s => s.length > 40).join('\n\n')
      let bestExec = String(windowResults[0]?.summary_executive || '')
      const outlineFromWindows = {
        document_title_guess: '',
        items: windowResults.flatMap((r, i) =>
          Array.isArray(r.outline_items) ? r.outline_items.map((it: any, j: number) => ({
            id: `o${i + 1}_${j + 1}`,
            heading: it.heading || it.title || '',
            blurb: it.blurb || it.summary || '',
            level: 1,
            order: i * 10 + j + 1,
            parent_id: null
          })) : []
        ).filter((it: any) => it.heading)
      }
      let bestSections = windowResults.flatMap(r => Array.isArray(r.sections) ? r.sections : [])
      let bestOutline: any = outlineFromWindows.items.length ? outlineFromWindows : null

      // Compact synthesis (small prompt — only digests)
      if (windowResults.length >= 2 && budgetLeft() > 25_000) {
        try {
          await serviceClient.from('documents').update({ processing_stage: 'synthesizing' }).eq('id', documentId)
          const digests = windowResults.map((r, i) =>
            `P${i + 1}: ${String(r.summary || '').slice(0, 600)}`
          ).join('\n')
          const termHint = mergedKeyTerms.slice(0, 20).map((t: any) => t.term).filter(Boolean).join(', ')
          const syn = await callGroqJson(
            groqApiKey,
            `Merge part digests into one study brief in ${langLabel}. JSON only: {"summary":"...","summary_executive":"...","outline":{"document_title_guess":"","items":[{"id":"o1","heading":"...","blurb":"...","level":1,"order":1,"parent_id":null}]},"sections":[{"heading":"...","summary":"...","key_points":["..."]}]}.
Use CONCRETE topic names from digests and terms. No meta filler.`,
            `Terms: ${termHint}\n\nDigests:\n${digests}`.slice(0, 12000),
            { model: MODEL_HEAVY, temperature: 0.25, maxCompletionTokens: 2048, timeoutMs: 30000, maxRetries: 0 }
          )
          if (syn?.summary && String(syn.summary).length > 80) bestSummary = String(syn.summary)
          if (syn?.summary_executive) bestExec = String(syn.summary_executive)
          if (syn?.outline?.items?.length) bestOutline = syn.outline
          if (Array.isArray(syn?.sections) && syn.sections.length) bestSections = syn.sections
        } catch (synErr) {
          console.warn('Compact synthesis skipped:', synErr)
        }
      }

      // ------------------------------------------------------------------
      // VISUAL ANALYSIS PATCH FOR ANY LONG DOCUMENT WITH IMAGE-ONLY PAGES
      // (Denetim Raporu, 2026-08-31, generalized after live testing).
      // This used to also require the WHOLE document to trip
      // isVisuallyDenseDocument (a slide-deck-shaped avg-chars-per-page
      // signal) before even checking nearBlankPdfPageIndices — that overfits
      // to one document shape. A quantitative course PDF (finance, stats,
      // accounting) can be mostly dense text with just one or two exhibit
      // pages that are a screenshotted chart/table/formula sheet; a verbal
      // course PDF can be the reverse. Either way, the actual signal that
      // matters is simpler and more general: are there SPECIFIC pages this
      // document's own extraction came back with essentially no text for?
      // If so, those pages' content is trapped in an image regardless of
      // what the rest of the document looks like, so we spend ONE extra
      // vision-capable call on just those pages (not all pages — bounds
      // cost/latency to a single call) and merge anything new it finds into
      // the terms/points/quiz/sections gathered from the text-only windows.
      // isVisuallyDenseDocument (logged above) stays as a diagnostic signal,
      // it just no longer gates this block. Fully additive and best-effort:
      // any failure here just leaves the text-only result untouched, same
      // as the compact synthesis above.
      // ------------------------------------------------------------------
      // Claims the vision pass contributes, normalised the way the grounding
      // gate normalises, so the gate can recognise and exempt them. Stays
      // empty whenever the pass does not run, which is the no-op case.
      const visionGroundedClaims = new Set<string>()

      const visualPlan = analyzeVisuals
        ? selectVisualPages(pdfPageTexts, nearBlankPdfPageIndices, VISION_MAX_IMAGES)
        : { indices: [] as number[], reason: 'kapali' }

      if (analyzeVisuals && visualPlan.indices.length > 0 && budgetLeft() <= VISUAL_MIN_BUDGET_MS) {
        console.log(
          `Gorsel gecis atlandi: butce ${budgetLeft()}ms <= ${VISUAL_MIN_BUDGET_MS}ms — ` +
          `anlati yazarina yer birakiliyor`
        )
      }

      if (analyzeVisuals && visualPlan.indices.length > 0 && budgetLeft() > VISUAL_MIN_BUDGET_MS) {
        try {
          console.log(`Gorsel sayfa secimi: [${visualPlan.indices.join(',')}] — ${visualPlan.reason}`)
          await serviceClient.from('documents').update({ processing_stage: 'visual_analysis' }).eq('id', documentId)
          const visualImages = await extractVisualImagesForLongDoc(fileBytes, visualPlan.indices)

          if (visualImages.length > 0) {
            const knownTermsHint = mergedKeyTerms.slice(0, 25).map((t: any) => t.term).filter(Boolean).join(', ')
            const visualSystemPrompt = `You are an academic study assistant. You are shown page images of the figure/table pages of a lecture document. Their captions were already extracted as text; what you can see and the text cannot is the CONTENT of the graphic itself — the axis ranges, the plotted levels and turning points, the rows of a table, the boxes and arrows of a diagram. Identify exam-relevant content readable in these images that is NOT already covered by these already-known terms: ${knownTermsHint || '(none yet)'}.
Respond ONLY with JSON in ${langLabel}: {"key_terms":[{"term":"...","definition":"..."}],"key_points":["..."],"quiz_questions":[{"question":"...","answer":"..."}],"sections":[{"heading":"...","summary":"..."}],"tables":[{"title":"...","headers":["..."],"rows":[["..."]]}],"diagrams":[{"title":"...","mermaid":"...","description":"..."}]}
Rules: only include content actually visible in the images; return empty arrays for any field with nothing new; do not repeat terms already listed above. Reconstruct any table you can read as 'tables' and any flowchart/framework/process image as a Mermaid 'diagrams' entry. Never invent one that isn't visibly there.
When a chart's shape carries the lesson — where it peaks, when it falls, which period is highest — write that in WORDS as a key_point, naming the value and the year you read ("unemployment peaks near 10.6% in 1982"). Do not attempt to output a series of numbers.`

            const visualUserContent = [
              { type: "text", text: "Analyze these slide images for exam-relevant content not already covered." },
              ...visualImages.map(b64 => ({ type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } }))
            ]

            // This call does NOT go through callGroqJson, so it has to pay the
            // pacer itself. Skipping that was harmless only while the model
            // id was wrong and every call 404'd: once it actually spends
            // tokens, a pacer that never saw them tells the narrative writer
            // afterwards that there is room, and the writer takes the 429.
            const estVisionTokens =
              visualImages.length * VISION_TOKENS_PER_IMAGE +
              Math.ceil(visualSystemPrompt.length / 3.2) +
              Math.ceil(3072 * PACER_COMPLETION_FACTOR)
            console.log(`Gorsel cagri butcesi: ~${estVisionTokens} token (${visualImages.length} gorsel)`)
            await tokenPacer.acquire(estVisionTokens)

            const visionRes = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                // Groq retired the 3.6 line; qwen/qwen3.8-27b is the current
                // vision-capable model (same image_url payload shape). The
                // stale id is what every "Long-doc visual patch call returned
                // non-ok status: 404" in the logs was.
                model: "qwen/qwen3.8-27b",
                temperature: 0.3,
                reasoning_effort: "none",
                // Raised alongside the compact-window bump (2048 → 3072):
                // these near-blank pages are exactly where a table/chart/
                // diagram is most likely to live, and a Mermaid block or a
                // multi-row table needs the extra room to avoid truncation.
                max_completion_tokens: 3072,
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: visualSystemPrompt },
                  { role: "user", content: visualUserContent }
                ]
              })
            }, 0, Math.min(25000, Math.max(10000, budgetLeft() - 15000)))

            // Record the spend either way: a rejected call still consumed the
            // image tokens as far as the minute's budget is concerned, and a
            // successful one must not leave the next caller over-optimistic.
            tokenPacer.observeHeaders(visionRes.headers)
            tokenPacer.record(estVisionTokens)

            if (visionRes.ok) {
              const visionData = await visionRes.json()
              const visionRaw = visionData.choices?.[0]?.message?.content ?? ""
              const visionStripped = stripThinkBlock(visionRaw)
              const visionCleaned = (visionStripped ?? visionRaw).replace(/```json\s*|```/g, '').trim()
              const visionParsed = visionCleaned ? JSON.parse(visionCleaned) : null

              if (visionParsed && typeof visionParsed === 'object') {
                const newTerms = Array.isArray(visionParsed.key_terms) ? visionParsed.key_terms : []
                const newPoints = Array.isArray(visionParsed.key_points) ? visionParsed.key_points : []
                const newQuiz = Array.isArray(visionParsed.quiz_questions) ? visionParsed.quiz_questions : []
                const newSections = Array.isArray(visionParsed.sections) ? visionParsed.sections : []
                // Tables and diagrams merge into the same arrays the text
                // windows feed. CHARTS DELIBERATELY DO NOT.
                //
                // Reading a plotted series off an image is the one thing in
                // this pass the model cannot do reliably, and a chart is the
                // one output where being approximately right is worse than
                // being absent — it looks authoritative. Measured on the
                // first run where the vision pass worked, against Figure
                // 20.5: it sampled every five years and returned 1980 ≈ 6,
                // missing the series maximum of ~10.6 in 1982 entirely. The
                // same card carried the key point "the five recessionary
                // reference periods show increases in the unemployment rate",
                // so the chart contradicted the card's own text. The GDP
                // chart flattened a log-scale axis into a linear one and
                // erased the Great Depression trough with it.
                //
                // The prompt now asks for that reading in WORDS instead —
                // "unemployment peaks near 10.6% in 1982" is checkable, keeps
                // the fact, and cannot be misread as a measured series. Charts
                // from the TEXT windows are unaffected; those come from
                // figures a document actually tabulates.
                const newTables = Array.isArray(visionParsed.tables) ? visionParsed.tables : []
                const newDiagrams = Array.isArray(visionParsed.diagrams) ? visionParsed.diagrams : []
                const droppedVisionCharts = Array.isArray(visionParsed.charts) ? visionParsed.charts.length : 0
                if (droppedVisionCharts > 0) {
                  console.log(`Gorsel gecis: ${droppedVisionCharts} grafik alinmadi (gorselden okunan seri guvenilir degil, kelimeyle isteniyor)`)
                }

                // Everything this pass contributes is grounded in the IMAGE,
                // which applyGroundingGate cannot read — see visionGrounded
                // there. Without this the gate calls the pass's own findings
                // fabrications: it dropped "Oil shock", read correctly off
                // Figure 20.2's annotations, on the first run that worked.
                for (const t of newTerms) {
                  const n = gateNormalize(String(t?.term || ''))
                  if (n) visionGroundedClaims.add(n)
                }
                for (const p of newPoints) {
                  const n = gateNormalize(typeof p === 'string' ? p : String(p?.text || p?.point || ''))
                  if (n) visionGroundedClaims.add(n)
                }

                if (newTerms.length || newPoints.length || newQuiz.length) {
                  const patchedTerms = dedupeKeyTerms([...mergedKeyTerms, ...newTerms]).slice(0, 40)
                  const patchedPoints = dedupeByText([...mergedKeyPoints, ...newPoints], (x: string) => x).slice(0, 35)
                  const patchedQuiz = dedupeByText([...mergedQuiz, ...newQuiz], (q: any) => q?.question || '').slice(0, 20)
                  mergedKeyTerms.length = 0; mergedKeyTerms.push(...patchedTerms)
                  mergedKeyPoints.length = 0; mergedKeyPoints.push(...patchedPoints)
                  mergedQuiz.length = 0; mergedQuiz.push(...patchedQuiz)
                }
                if (newSections.length) bestSections = bestSections.concat(newSections)
                if (newTables.length) {
                  const patchedTables = dedupeByText([...mergedTables, ...newTables], (t: any) => t?.title || '')
                    .filter((t: any) => t && t.title && Array.isArray(t.rows) && t.rows.length > 0).slice(0, 12)
                  mergedTables.length = 0; mergedTables.push(...patchedTables)
                }
                if (newDiagrams.length) {
                  const patchedDiagrams = dedupeByText([...mergedDiagrams, ...newDiagrams], (d: any) => d?.title || '')
                    .filter((d: any) => d && d.title && d.mermaid).slice(0, 8)
                  mergedDiagrams.length = 0; mergedDiagrams.push(...patchedDiagrams)
                }

                visualAnalysisUsed = true
                console.log(`Long-doc visual patch: +${newTerms.length} terms, +${newPoints.length} points, +${newQuiz.length} quiz, +${newSections.length} sections, +${newTables.length} tables, +${newDiagrams.length} diagrams (grafik alinmaz) from ${visualImages.length} sekil sayfasi`)
              }
            } else {
              console.warn(`Long-doc visual patch call returned non-ok status: ${visionRes.status}`)
            }
          }
        } catch (visualPatchErr) {
          console.warn('Long-doc visual analysis patch skipped:', visualPatchErr)
        }
      }

      // Guarantee non-empty executive from terms if needed
      if (!bestExec && mergedKeyTerms.length) {
        bestExec = lang === 'tr'
          ? `Belge başlıca şu konuları kapsar: ${mergedKeyTerms.slice(0, 6).map((t: any) => t.term).join(', ')}.`
          : `This document covers: ${mergedKeyTerms.slice(0, 6).map((t: any) => t.term).join(', ')}.`
      }
      if (!bestSummary && mergedKeyPoints.length) {
        bestSummary = mergedKeyPoints.slice(0, 10).map((p: string) => `• ${p}`).join('\n')
      }

      const mergedDraft = {
        summary: bestSummary || '',
        summary_executive: bestExec || '',
        document_type: 'Lecture Notes/Slides',
        suggested_course_tag: null,
        is_quantitative: quantFraction >= 0.3,
        key_terms: mergedKeyTerms,
        key_points: mergedKeyPoints,
        quiz_questions: mergedQuiz,
        tables: mergedTables,
        charts: mergedCharts,
        formulas: mergedFormulas,
        worked_examples: mergedWorkedExamples,
        diagrams: mergedDiagrams,
        concept_graph: { nodes: [], edges: [] },
        footnotes: [],
        outline: normalizeOutline(bestOutline, bestSections),
        sections: normalizeSections(bestSections, normalizeOutline(bestOutline, bestSections)),
        cloze_cards: [] as any[]
      }

      console.log(`Long-doc merge: terms=${mergedKeyTerms.length} points=${mergedKeyPoints.length} quiz=${mergedQuiz.length} tables=${mergedTables.length} charts=${mergedCharts.length} diagrams=${mergedDiagrams.length} worked_examples=${mergedWorkedExamples.length} summaryLen=${(mergedDraft.summary || '').length}`)

      rawContent = JSON.stringify(mergedDraft)
      sourceTextForReview = windowResults.map((r, i) => `Part ${i + 1}: ${String(r.summary || '').slice(0, 500)}`).join('\n\n')
      if (sourceTextForReview.length > 4000) {
        sourceTextForReview = sourceTextForReview.substring(0, 4000) + ' [truncated]'
      }
    }

    // Pass 2: Madde 4 — Grounding + Critic quality gate
    const citationUnit = pageMarkerLabel === 'SLAYT' ? 'slayt' : 's.'
    const reviewSystemPrompt = `You are a strict academic quality critic AND copy-editor for a student study brief (NotebookLM-grade). Compare the draft against the source text.

QUALITY RUBRIC (must evaluate):
A) Thesis clarity — does summary open with the document's core purpose/claim?
B) Hallucination — any claim not supported by source must be removed or softened
C) Completeness — major topics from outline/sections present in the narrative?
D) Admin noise — grading, attendance, office hours, textbook edition MUST be removed
E) Grounding — specific facts (numbers, dates, named findings) should cite source location when markers exist
F) Structure — preserve narrative prose if the draft summary is already flowing paragraphs (Madde 3 writer). Only keep bullet/outline form if the draft summary itself is clearly bullets/outline. Do NOT convert a polished narrative back into fragments.

CITATIONS / GROUNDING:
${hasPageMarkers
  ? `Source contains "--- ${pageMarkerLabel} N ---" markers. For important checkable claims in summary and key_points, append inline markers like (${citationUnit} N) using real N values from markers you can see — never invent page numbers. Also keep footnotes[{id, reference, page}] where page is that N or null.`
  : `Page markers are not available. Do not invent page numbers. Keep footnotes with page: null unless a real page is already in the draft.`}

FOOTNOTES: Preserve existing footnote page values when present; only change if the visible source clearly contradicts them.

SECTIONS / OUTLINE: Preserve structure; refine inaccurate section summaries; remove admin-only sections.

OUTPUT: Return the REFINED full study-card JSON in the same shape as the draft, PLUS:
"quality_gate": { "pass": boolean, "grounded": boolean, "issues": [ string ] }
- pass=false only for serious problems (hallucinations, missing thesis, heavy admin noise left in)
- grounded=true if important claims are citation-backed or source clearly supports them
- issues: short list of remaining concerns (empty array if clean)

JSON shape: { "summary": string, "summary_executive": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "document_type": string, "footnotes": [ { "id": number, "reference": string, "page": number | null } ], "outline": { ... }, "sections": [ { "heading": string, "summary": string, "key_points": [ string ], "outline_id": string | null } ], "suggested_course_tag": string | null, "is_quantitative": boolean, "quality_gate": { "pass": boolean, "grounded": boolean, "issues": [ string ] } }.
Preserve summary_executive, outline, and deep sections unless clearly wrong.
DO NOT include "tables", "charts", "diagrams", "worked_examples", "formulas", "concept_graph", or "cloze_cards" in your output at all — omit those keys entirely. They are extracted/validated separately outside this review step and are not part of your job; re-emitting them here only burns completion-token budget that "summary"/"sections"/"key_points" need.`

    function buildReviewUserPrompt(sourceBudgetChars: number): string {
      let trimmedSource = sourceTextForReview
      if (sourceBudgetChars <= 0) {
        trimmedSource = "[omitted to fit token limits — rely on the draft's internal consistency]"
      } else if (trimmedSource.length > sourceBudgetChars) {
        trimmedSource = trimmedSource.substring(0, sourceBudgetChars) + " [truncated for review]"
      }
      return `Original requested format parameters:
- Summary Style: ${style}
- Summary Length: ${len}
- Summary Language: ${lang}

Original source text:
${trimmedSource}

Draft JSON summary:
${rawContent}`
    }

    // ==========================================================================
    // MADDE 3 — NARRATIVE WRITER (professional prose summary)
    // Madde 6: skipped for depth=brief; expanded for depth=deep
    // ==========================================================================
    try {
      if (depthFlags.skipNarrativeWriter) {
        console.log('Madde 6: skipping narrative writer (depth=brief)')
      } else if (budgetLeft() < 35_000) {
        console.log('HOTFIX: skipping narrative writer (low budget', budgetLeft(), 'ms)')
      } else {
      await serviceClient.from('documents').update({ processing_stage: 'writing' }).eq('id', documentId)

      let draftObj: any = null
      try {
        const strippedDraft = stripThinkBlock(rawContent)
        draftObj = JSON.parse((strippedDraft ?? rawContent).replace(/```json\s*|```/g, '').trim())
      } catch (_e) {
        draftObj = null
      }

      if (draftObj && typeof draftObj === 'object') {
        const outlineItems = Array.isArray(draftObj.outline?.items) ? draftObj.outline.items : []
        const sectionItems = Array.isArray(draftObj.sections) ? draftObj.sections : []
        const outlineBlock = outlineItems
          .map((it: any) => `- ${it.heading}${it.blurb ? ': ' + it.blurb : ''}`)
          .join('\n')
          .slice(0, 2500)
        const sectionsBlock = sectionItems
          .map((s: any) => `## ${s.heading}\n${(s.summary || '').slice(0, depthFlags.longNarrative ? 900 : 600)}`)
          .join('\n\n')
          .slice(0, depthFlags.longNarrative ? 10000 : 7000)

        const lengthHint =
          depthFlags.longNarrative || len === 'detailed' || len === 'long'
            ? 'Write a thorough brief of 5-8 paragraphs (roughly 450-750 words).'
            : len === 'short'
            ? 'Write about 2-3 dense paragraphs (roughly 180-280 words).'
            : 'Write a clear brief of 3-5 paragraphs (roughly 280-450 words).'

        const keyTermsBlock = (Array.isArray(draftObj.key_terms) ? draftObj.key_terms : [])
          .slice(0, 25)
          .map((t: any) => `- ${t?.term || t}: ${t?.definition || ''}`)
          .join('\n')
          .slice(0, 2000)
        const keyPointsBlock = (Array.isArray(draftObj.key_points) ? draftObj.key_points : [])
          .slice(0, 20)
          .map((p: any) => `- ${typeof p === 'string' ? p : ''}`)
          .join('\n')
          .slice(0, 2000)

        const writerSys = `You are an expert academic writer for university study briefs (NotebookLM-grade).
Respond with ONLY valid JSON: { "summary": string, "summary_executive": string }.

GOAL:
Write "summary" as a cohesive NARRATIVE in ${langLabel} that a student could study from — concrete topics, methods, definitions, and takeaways from THIS document only.
${lengthHint}

HARD RULES (violations = failure):
1. Use CONCRETE content from the inputs: named topics, techniques, formulas, metrics, chapter themes. Quote or paraphrase real substance.
2. NEVER write generic filler. Forbidden phrases/patterns include:
   - "qualitative overview", "scholarly landscape", "theoretical terrain", "conceptual depth"
   - "broader academic field", "interrelated ideas", "forward-looking synthesis"
   - "Introduction / Main Discussion / Conclusion" as the only structure when inputs name specific topics
   - Empty abstractions like "key concepts", "theoretical frameworks", "implications" without naming what they are
3. If outline/sections name specific subjects (e.g. supervised learning, neural networks, precision/recall), those subjects MUST appear in the summary by name.
4. Do NOT invent theories, numbers, or conclusions absent from inputs.
5. No grading/attendance/office-hours/textbook logistics.
6. "summary_executive" = 2-3 sentences naming the actual subject of the document (not vague "this document discusses theories").
7. Plain paragraphs only (\\n\\n separators). No markdown headings inside summary.
8. If inputs are thin or mostly empty, write a SHORT honest note about limited extractable content — do NOT pad with generic academic prose.`

        const writerUser = `Existing executive (refine only if it names real topics; otherwise rewrite from inputs):
${(draftObj.summary_executive || '').slice(0, 500)}

Document outline (USE these real headings):
${outlineBlock || '(none)'}

Deep section summaries (primary factual source):
${sectionsBlock || '(none)'}

Key terms from the document:
${keyTermsBlock || '(none)'}

Key points from the document:
${keyPointsBlock || '(none)'}

Existing draft summary (keep factual content; rewrite only for flow):
${String(draftObj.summary || '').slice(0, 3500)}`

        const written = await callGroqJson(groqApiKey, writerSys, writerUser, {
          model: MODEL_HEAVY,
          temperature: 0.2,
          maxCompletionTokens: depthFlags.longNarrative || len === 'long' || len === 'detailed' ? 3072 : 2048,
          timeoutMs: Math.min(35000, Math.max(12000, budgetLeft() - 5000)),
          maxRetries: 1
        })

        // Reject generic filler narratives — keep pre-writer draft if detection fires
        const candidateSummary = written?.summary ? String(written.summary).trim() : ''
        const candidateExec = written?.summary_executive ? String(written.summary_executive).trim() : ''
        const genericHits = [
          /qualitative overview/i,
          /scholarly landscape/i,
          /theoretical terrain/i,
          /broader (academic|scholarly) (field|landscape)/i,
          /forward-?looking synthesis/i,
          /conceptual (depth|clarity|map|threads)/i,
          /non-?quantitative (understanding|comprehension)/i,
          /interrelated ideas/i,
          /essential terminology that will frame/i
        ].filter((re) => re.test(candidateSummary) || re.test(candidateExec)).length
        const hasConcreteFromInput = (() => {
          const bag = `${outlineBlock}\n${keyTermsBlock}\n${keyPointsBlock}`.toLowerCase()
          const tokens = bag.split(/[^a-zçğıöşü0-9]+/i).filter((t) => t.length >= 6).slice(0, 40)
          if (tokens.length < 3) return true // cannot judge
          const lower = candidateSummary.toLowerCase()
          let hits = 0
          for (const t of tokens) if (lower.includes(t)) hits++
          return hits >= 2
        })()
        const acceptWriter = candidateSummary.length > 80 && genericHits === 0 && hasConcreteFromInput
        if (acceptWriter) {
          draftObj.summary = candidateSummary
          if (candidateExec.length > 20) draftObj.summary_executive = candidateExec
          console.log('Madde 3: narrative writer accepted')
        } else {
          console.warn(`Madde 3: narrative writer REJECTED (genericHits=${genericHits}, concrete=${hasConcreteFromInput}) — keeping draft`)
        }
        rawContent = JSON.stringify(draftObj)
        console.log('Madde 3: narrative writer done, depth=' + depth)
      }
      } // end else !skipNarrativeWriter
    } catch (writerErr) {
      console.warn('Madde 3 narrative writer skipped (keeping draft summary):', writerErr)
    }

    // Madde 6: progressive signal — draft exists, review may follow
    await serviceClient
      .from('documents')
      .update({ processing_stage: 'draft_ready' })
      .eq('id', documentId)

    // Skip review only for short single-pass docs, or any chunked long doc
    // that is genuinely out of time budget.
    // Denetim Raporu, 2026-08-31: this used to ALSO skip review for every
    // chunked document unless depth === 'deep' — meaning the hallucination/
    // grounding check never ran on a standard-depth long document, no matter
    // how much time budget was actually left. That was a blunt, static proxy
    // for "will this run out of time" when a real, dynamic measurement of
    // the same thing already exists one line above: budgetLeft() < 55_000.
    // Long documents need this check MORE than short ones (more windows to
    // go wrong, more room for the merge step to introduce inconsistencies),
    // so the time-budget check is now the only gate — review runs on every
    // chunked document depth gets, as long as there is genuinely enough
    // wall-clock left to do it safely.
    const shouldSkipReview =
      (!useChunkedPipeline && extractedText.length <= SKIP_REVIEW_MAX_CHARS) ||
      (useChunkedPipeline && budgetLeft() < 55_000)

    let rawFinalContent = ""

    if (shouldSkipReview) {
      console.log(`HOTFIX: skipping review (chunked=${useChunkedPipeline}, depth=${depth}, budgetLeft=${budgetLeft()})`)
      rawFinalContent = rawContent
      await serviceClient.from('documents').update({ processing_stage: 'saving' }).eq('id', documentId)
    } else {
      // Update stage to reviewing
      await serviceClient
        .from('documents')
        .update({ processing_stage: 'reviewing' })
        .eq('id', documentId)

      // Groq enforces a tokens-per-minute cap per model (as low as 8000 on
      // this account). A long/detailed draft plus the reference source text
      // can occasionally exceed it even after the 6,000-char truncation above.
      // Rather than fail outright, retry with progressively smaller reference-
      // text AND completion budgets together (the draft JSON itself is never
      // trimmed, since that would lose content from the final output).
      const reviewTiers: Array<{ sourceChars: number; maxCompletionTokens: number }> = [
        { sourceChars: 4000, maxCompletionTokens: Math.min(2500, REVIEW_MAX_COMPLETION) },
        { sourceChars: 1200, maxCompletionTokens: 1800 },
        { sourceChars: 0, maxCompletionTokens: 1200 }
      ]
      let groqReviewData: any = null

      for (let i = 0; i < reviewTiers.length; i++) {
        const tier = reviewTiers[i]
        const attemptPrompt = buildReviewUserPrompt(tier.sourceChars)
        let attemptResponse: Response
        try {
          attemptResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${groqApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              // Deliberately a DIFFERENT model than the Draft pass above
              // (openai/gpt-oss-120b). Groq tracks tokens-per-minute limits
              // PER MODEL — review draws from MODEL_FAST quota.
              model: MODEL_FAST,
              temperature: 0.2,
              reasoning_effort: "none",
              max_completion_tokens: tier.maxCompletionTokens,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: reviewSystemPrompt },
                { role: "user", content: attemptPrompt }
              ]
            })
          }, 1, 25000)
        } catch (fetchReviewErr) {
          console.error("Pass 2 Groq API fetchWithRetry exception: ", fetchReviewErr)
          await markFailed(serviceClient, documentId)
          return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const attemptData = await attemptResponse.json()

        if (attemptResponse.ok) {
          groqReviewData = attemptData
          break
        }

        const isTokenSizeError = (attemptResponse.status === 400 || attemptResponse.status === 429 || attemptResponse.status === 413) &&
          attemptData?.error?.code === 'rate_limit_exceeded' &&
          attemptData?.error?.type === 'tokens'

        console.error(`Groq Review API call failed (source budget ${tier.sourceChars} chars, completion budget ${tier.maxCompletionTokens}, status ${attemptResponse.status}): `, JSON.stringify(attemptData))

        if (!isTokenSizeError || i === reviewTiers.length - 1) {
          // Madde 6 fallback: if review fails on TPM, keep the draft instead of failing the whole job
          console.warn('Madde 6: review failed — falling back to unreviewed draft')
          rawFinalContent = rawContent
          break
        }
      }

      if (!rawFinalContent) {
        rawFinalContent = groqReviewData?.choices?.[0]?.message?.content ?? ""
      }
      if (!rawFinalContent) {
        console.error('Empty response content from Groq Review: ', JSON.stringify(groqReviewData))
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      await serviceClient.from('documents').update({ processing_stage: 'saving' }).eq('id', documentId)
    }

    // ==========================================================================
    // STEP 3 — PARSE THE RESPONSE (defensive parsing of final reviewed output)
    // ==========================================================================
    const reviewStripped = stripThinkBlock(rawFinalContent)
    if (reviewStripped === null) {
      console.error('Groq Review response was an unterminated <think> block (ran out of tokens while reasoning):', rawFinalContent)
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'The AI ran out of thinking time before finishing its review — please try again' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const cleaned = reviewStripped.replace(/```json\s*|```/g, "").trim()
    let parsedContent
    try {
      parsedContent = JSON.parse(cleaned)
    } catch (parseError) {
      console.error("Failed to parse Groq final response as JSON: ", rawFinalContent, parseError)
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON formatting after review' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Denetim Raporu, 2026-08-31 — ROOT-CAUSE FIX (part 2): the review pass
    // above is now deliberately told to NOT re-emit tables/charts/diagrams/
    // worked_examples/formulas/concept_graph/cloze_cards (to keep its
    // completion-token budget stable and avoid truncation/JSON-parse
    // failures now that those fields can carry real content). That means
    // parsedContent never has them — splice them back in here from the
    // pre-review draft (rawContent still holds the full draft object,
    // including when review was skipped entirely, in which case this is a
    // harmless no-op since parsedContent already came from the same JSON).
    try {
      const preReviewStripped = stripThinkBlock(rawContent)
      const preReviewCleaned = (preReviewStripped ?? rawContent).replace(/```json\s*|```/g, '').trim()
      const preReviewDraft = preReviewCleaned ? JSON.parse(preReviewCleaned) : null
      if (preReviewDraft && typeof preReviewDraft === 'object') {
        for (const field of ['tables', 'charts', 'diagrams', 'worked_examples', 'formulas', 'concept_graph', 'cloze_cards']) {
          if (parsedContent[field] === undefined && preReviewDraft[field] !== undefined) {
            parsedContent[field] = preReviewDraft[field]
          }
        }
      }
    } catch (spliceErr) {
      console.warn('Post-review field splice-back skipped (pre-review draft unparsable):', spliceErr)
    }

    // Madde 4 — normalize quality gate; optional one-shot critic rewrite if FAIL
    let qualityMeta: any = {
      pass: true,
      grounded: false,
      issues: [] as string[],
      critic_retry: false
    }
    if (parsedContent.quality_gate && typeof parsedContent.quality_gate === 'object') {
      qualityMeta = {
        pass: parsedContent.quality_gate.pass !== false,
        grounded: !!parsedContent.quality_gate.grounded,
        issues: Array.isArray(parsedContent.quality_gate.issues)
          ? parsedContent.quality_gate.issues.map((x: any) => String(x).slice(0, 200)).slice(0, 8)
          : [],
        critic_retry: false
      }
    }
    // Heuristic grounded: footnotes with page numbers or inline (s. N)/(slayt N)
    const summaryText = String(parsedContent.summary || '')
    const hasInlineCite = /\((?:s\.|sayfa|slayt|p\.|page)\s*\d+\)/i.test(summaryText)
    const footWithPage = Array.isArray(parsedContent.footnotes)
      && parsedContent.footnotes.some((f: any) => f && f.page != null)
    if (hasInlineCite || footWithPage) qualityMeta.grounded = true

    if (qualityMeta.pass === false && qualityMeta.issues.length > 0) {
      try {
        await serviceClient.from('documents').update({ processing_stage: 'critic' }).eq('id', documentId)
        const fixSys = `You fix a FAILED academic study brief. Respond ONLY with JSON: { "summary": string, "summary_executive": string }.
Fix the listed issues. Remove hallucinations and admin noise. Keep ${langLabel}. Keep narrative prose. Do not invent facts.`
        const fixUser = `Issues to fix:\n${qualityMeta.issues.map((i: string) => `- ${i}`).join('\n')}\n\nCurrent summary:\n${summaryText.slice(0, 4000)}\n\nCurrent executive:\n${String(parsedContent.summary_executive || '').slice(0, 500)}`
        const fixed = await callGroqJson(groqApiKey, fixSys, fixUser, {
          model: MODEL_FAST,
          temperature: 0.2,
          maxCompletionTokens: 2048,
          timeoutMs: 25000,
          maxRetries: 0
        })
        if (fixed?.summary && String(fixed.summary).trim().length > 80) {
          parsedContent.summary = String(fixed.summary).trim()
          qualityMeta.critic_retry = true
          qualityMeta.pass = true
          qualityMeta.issues = []
        }
        if (fixed?.summary_executive && String(fixed.summary_executive).trim().length > 20) {
          parsedContent.summary_executive = String(fixed.summary_executive).trim()
        }
        console.log('Madde 4: critic rewrite applied')
      } catch (critErr) {
        console.warn('Madde 4 critic rewrite skipped:', critErr)
      }
    }
    delete parsedContent.quality_gate

    // HOTFIX: reject only truly empty OR pure-meta with no extractions
    {
      const sum = String(parsedContent.summary || '')
      const terms = Array.isArray(parsedContent.key_terms) ? parsedContent.key_terms : []
      const points = Array.isArray(parsedContent.key_points) ? parsedContent.key_points : []
      const quiz = Array.isArray(parsedContent.quiz_questions) ? parsedContent.quiz_questions : []
      const metaRe = /sağlanmamış|sağlanmamıştır|no (detailed )?draft|taslak.*sağlan|içerik taslağı|qualitative overview|scholarly landscape|only a general framework|genel bir çerçevesi/i
      const isMeta = metaRe.test(sum) || metaRe.test(String(parsedContent.summary_executive || ''))
      const hasExtractions = terms.length > 0 || points.length > 0 || quiz.length > 0
      const isEmpty = !hasExtractions && sum.trim().length < 80
      // If meta but we have real terms/points, strip meta summary is still bad — fail only if no extractions
      if (isEmpty || (isMeta && !hasExtractions)) {
        console.error('HOTFIX: refusing to save empty/meta study card', { isMeta, isEmpty, terms: terms.length, points: points.length, quiz: quiz.length, sumLen: sum.length })
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({
          error: 'Özet içeriği boş kaldı. Lütfen tekrar deneyin. / Summary was empty — please retry.'
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (isMeta && hasExtractions) {
        // Keep extractions; replace meta summary with a short concrete fallback from terms
        const termList = terms.slice(0, 8).map((t: any) => t?.term || t).filter(Boolean).join(', ')
        parsedContent.summary = lang === 'tr'
          ? `Bu belge şu başlıca konuları kapsar: ${termList}. Aşağıdaki ana noktalar ve terimler çalışmak için çıkarılmıştır.`
          : `This document covers: ${termList}. Key points and terms were extracted for study.`
        parsedContent.summary_executive = termList.slice(0, 200)
        console.warn('HOTFIX: replaced meta summary, kept extractions')
      }
    }

    // ==========================================================================
    // STEP 3.5 — CITATION ANCHORING (both pipelines meet here)
    //
    // Runs once, after whichever path produced `parsedContent`, so the fast
    // path gets its model-reported footnote pages VERIFIED and the long-doc
    // path — which ships `footnotes: []` because asking each window for them
    // would eat the completion-token budget it needs for key terms/points —
    // finally gets citations at all. See buildPageIndex/anchorCitations above
    // for why this is computed rather than prompted.
    // ==========================================================================
    {
      // --- (a) Formulas: repair what is over-wrapped, drop what cannot render
      const sanitized = sanitizeFormulas(parsedContent.formulas)
      parsedContent.formulas = sanitized.formulas
      if (sanitized.dropped.length || sanitized.repaired) {
        console.log(
          `Formula validation: ${sanitized.formulas.length} kept, ` +
          `${sanitized.repaired} repaired, ${sanitized.dropped.length} dropped` +
          (sanitized.dropped.length
            ? ` — ${sanitized.dropped.map(d => `${d.name}(${d.reason})`).join('; ')}`
            : '')
        )
      }

      // --- (a2) Diagrams: drop Mermaid that cannot render
      const diagramsChecked = sanitizeDiagrams(parsedContent.diagrams)
      parsedContent.diagrams = diagramsChecked.diagrams
      if (diagramsChecked.dropped.length || diagramsChecked.repaired) {
        console.log(
          `Mermaid validation: ${diagramsChecked.diagrams.length} kept, ` +
          `${diagramsChecked.dropped.length} dropped, ` +
          `${diagramsChecked.repaired} ok onarildi` +
          (diagramsChecked.dropped.length
            ? ' — ' + diagramsChecked.dropped.map(d => `${d.title}(${d.reason})`).join('; ')
            : '')
        )
      }

      const chartsChecked = sanitizeCharts(parsedContent.charts)
      parsedContent.charts = chartsChecked.charts
      if (chartsChecked.dropped.length) {
        console.log(
          `Chart validation: ${chartsChecked.charts.length} kept, ` +
          `${chartsChecked.dropped.length} dropped — ` +
          chartsChecked.dropped.map(c => `${c.title}(${c.reason})`).join('; ')
        )
      }

      // --- (b) Grounding gate: remove claims the source does not support
      const gated = applyGroundingGate(
        parsedContent.key_terms,
        parsedContent.key_points,
        extractedText,
        visionGroundedClaims
      )
      parsedContent.key_terms = gated.key_terms
      parsedContent.key_points = gated.key_points
      console.log(
        `Grounding gate: score=${gated.stats.score ?? '—'}% ` +
        `terms ${gated.stats.termsKept} kept / ${gated.stats.termsDropped} dropped, ` +
        `points ${gated.stats.pointsKept} kept / ${gated.stats.pointsDropped} dropped` +
        (gated.stats.droppedTerms.length ? ` | uydurma terim: ${gated.stats.droppedTerms.join(', ')}` : '') +
        (gated.stats.droppedPoints.length ? ` | uydurma nokta: ${gated.stats.droppedPoints.map(p => `"${p}"`).join(' ')}` : '')
      )

      // --- (b2) Narrative year gate: the prose the gate above never sees
      const yearsChecked = sanitizeNarrativeYears(parsedContent, extractedText)
      if (yearsChecked.removed.length || yearsChecked.flagged.length) {
        console.log(
          `Narrative year gate: ${yearsChecked.changed} alan duzeltildi` +
          (yearsChecked.removed.length ? ` | kaynakta olmayan yil silindi: ${yearsChecked.removed.join(', ')}` : '') +
          (yearsChecked.flagged.length ? ` | silinemedi, metinde kaldi: ${yearsChecked.flagged.join(', ')}` : '')
        )
      }

      // --- (c) Near-duplicate merge: the same idea worded twice by two windows
      const beforeDedup = {
        terms: (parsedContent.key_terms || []).length,
        points: (parsedContent.key_points || []).length,
        quiz: (parsedContent.quiz_questions || []).length
      }
      parsedContent.key_terms = dedupeNearDuplicates(
        parsedContent.key_terms,
        (t: any) => `${t?.term || ''} ${t?.definition || ''}`
      )
      parsedContent.key_points = dedupeNearDuplicates(
        parsedContent.key_points,
        (p: any) => typeof p === 'string' ? p : String(p?.text || p?.point || '')
      )
      parsedContent.quiz_questions = dedupeNearDuplicates(
        parsedContent.quiz_questions,
        (q: any) => String(q?.question || '')
      )
      console.log(
        `Near-duplicate merge: terms ${beforeDedup.terms}→${parsedContent.key_terms.length}, ` +
        `points ${beforeDedup.points}→${parsedContent.key_points.length}, ` +
        `quiz ${beforeDedup.quiz}→${parsedContent.quiz_questions.length}`
      )

      // --- (d) Citations, computed from the page index (see above)
      const pageIndex = buildPageIndex(extractedText, pageMarkerLabel)
      const anchored = anchorCitations(
        Array.isArray(parsedContent.key_points) ? parsedContent.key_points : [],
        Array.isArray(parsedContent.footnotes) ? parsedContent.footnotes : [],
        pageIndex,
        lang
      )
      parsedContent.key_points = anchored.key_points
      parsedContent.footnotes = anchored.footnotes
      // Footnote ids were renumbered to a dense sequence, so markers already
      // embedded in the summary text have to follow them.
      if (typeof parsedContent.summary === 'string') {
        parsedContent.summary = applyFootnoteRemap(parsedContent.summary, anchored.idMap)
      }
      console.log(
        `Citation anchoring: pages=${pageIndex.length} ` +
        `kept=${anchored.stats.kept} demoted=${anchored.stats.demoted} ` +
        `added=${anchored.stats.added} quoted=${anchored.stats.quoted} ` +
        `unanchored=${anchored.stats.skipped}`
      )
    }

    // ==========================================================================
    // STEP 4 — SAVE STUDY CARD & UPDATE STATUS
    // ==========================================================================
    const cardPayload: Record<string, unknown> = {
      document_id: documentId,
      user_id: document.user_id,
      summary: parsedContent.summary || '',
      summary_executive: parsedContent.summary_executive || '',
      key_terms: parsedContent.key_terms || [],
      key_points: parsedContent.key_points || [],
      quiz_questions: parsedContent.quiz_questions || [],
      tables: parsedContent.tables || [],
      charts: parsedContent.charts || [],
      footnotes: parsedContent.footnotes || [],
      suggested_course_tag: parsedContent.suggested_course_tag || null,
      is_quantitative: parsedContent.is_quantitative ?? false,
      formulas: Array.isArray(parsedContent.formulas) ? parsedContent.formulas : [],
      worked_examples: Array.isArray(parsedContent.worked_examples) ? parsedContent.worked_examples : [],
      diagrams: Array.isArray(parsedContent.diagrams) ? parsedContent.diagrams : [],
      concept_graph: (parsedContent.concept_graph && typeof parsedContent.concept_graph === 'object')
        ? parsedContent.concept_graph
        : { nodes: [], edges: [] },
      cloze_cards: buildClozeCards(
        parsedContent.cloze_cards,
        Array.isArray(parsedContent.key_terms) ? parsedContent.key_terms : [],
        Array.isArray(parsedContent.key_points) ? parsedContent.key_points : [],
        20
      ),
      outline: normalizeOutline(parsedContent.outline, parsedContent.sections),
      sections: normalizeSections(
        parsedContent.sections,
        normalizeOutline(parsedContent.outline, parsedContent.sections)
      ),
      summary_style: style,
      summary_language: lang,
      summary_length: len,
      document_type: parsedContent.document_type || 'Other',
      visual_analysis: visualAnalysisUsed,
      course_tag: document.course_tag ?? null,
      quality_meta: qualityMeta
    }

    let newCard: any = null
    let cardError: any = null
    {
      const res = await serviceClient.from('study_cards').insert(cardPayload).select('id').single()
      newCard = res.data
      cardError = res.error
    }
    // If quality_meta column missing, retry without it
    if (cardError && /quality_meta/i.test(String(cardError.message || cardError.details || ''))) {
      console.warn('quality_meta column missing — retrying insert without it')
      delete cardPayload.quality_meta
      const res2 = await serviceClient.from('study_cards').insert(cardPayload).select('id').single()
      newCard = res2.data
      cardError = res2.error
    }

    if (cardError) {
      console.error('Failed to save study card: ', cardError)
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'Failed to save generated study card' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update document status to summarized and clear processing_stage
    await serviceClient
      .from('documents')
      .update({ status: 'summarized', processing_stage: null })
      .eq('id', documentId)

    return new Response(JSON.stringify({ success: true, studyCardId: newCard.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Unexpected Edge Function exception: ', err)
    return new Response(JSON.stringify({ error: 'An unexpected Edge Function error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function markFailed(client: any, documentId: string) {
  try {
    await client
      .from('documents')
      .update({ status: 'failed', processing_stage: null })
      .eq('id', documentId)
  } catch (e) {
    console.error('Failed to set document status to failed: ', e)
  }
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
