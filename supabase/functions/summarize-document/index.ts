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
//      switch from a single Groq call to a map-reduce pipeline: split the
//      text into sequential chunks, extract key terms/points/quiz/tables/
//      charts/formulas/footnotes from EACH chunk independently (so nothing
//      past character 40,000 is ever skipped), then synthesize one cohesive
//      final summary from the per-chunk summaries and merge+dedupe the
//      per-chunk structured data down to the adaptive target counts.
//      Visual (image) analysis is intentionally skipped for the chunked
//      path to keep this addition scoped — it only ever applies to the
//      short-document fast path today anyway.
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
const CHUNK_TARGET_SIZE = 6500 // chars per chunk (well within model context; sized for extraction depth, not context limits)

// Madde 6 — model tiering (cost + TPM isolation)
// Heavy model: single-pass draft + synthesis (quality-critical, fewer calls)
// Fast model: per-chunk map + review (many calls, smaller completions)
const MODEL_HEAVY = "openai/gpt-oss-120b"
const MODEL_FAST = "qwen/qwen3.6-27b"
// Skip the expensive review pass for short, simple documents (saves ~1 full LLM call)
const SKIP_REVIEW_MAX_CHARS = 3500
const CHUNK_MAX_COMPLETION = 2048
const SYNTHESIS_MAX_COMPLETION = 3072
const DRAFT_MAX_COMPLETION = 4096
const REVIEW_MAX_COMPLETION = 4096
// Cap parallel chunk calls to reduce TPM bursts (was 4)
const CHUNK_CONCURRENCY = 3
const MAX_CHUNKS = 24 // hard ceiling (~150k chars) protecting cost/time on pathological inputs

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

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  async function worker() {
    while (true) {
      const i = nextIndex++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  }
  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

type GroqJsonOpts = {
  model?: string
  temperature?: number
  maxCompletionTokens?: number
  timeoutMs?: number
  maxRetries?: number
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

  const response = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }, maxRetries, timeoutMs)

  const data = await response.json()
  if (!response.ok) {
    throw new Error(`Groq API error (${response.status}): ${JSON.stringify(data)}`)
  }
  const raw = data.choices?.[0]?.message?.content ?? ""
  if (!raw) throw new Error("Empty Groq response content")
  const stripped = stripThinkBlock(raw)
  if (stripped === null) throw new Error("Model ran out of tokens mid-<think> block, never wrote the actual answer")
  const cleaned = stripped.replace(/```json\s*|```/g, "").trim()
  return JSON.parse(cleaned)
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
Write "summary_executive" as a 2-3 sentence ultra-short overview of the ENTIRE document — what a student would say if asked "what is this document about in 30 seconds?". No lists, no jargon overload.

OUTLINE ENGINE (document skeleton — REQUIRED when the material has structure):
Build "outline" as a table-of-contents for the whole document:
- document_title_guess: short title if evident, else ""
- items: 3-12 entries in reading order. Each: { "id": "o1", "heading": "2-6 word label", "blurb": "one sentence: what this part contributes to the document", "level": 1 or 2, "order": 1, "parent_id": null or parent id }
- level 1 = major parts; level 2 = sub-topics under a parent
- Prefer real structure from the part-summaries (introduction, theory, method, cases, conclusion, etc.)
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

function remapChunkFootnotes(chunkResult: any, idOffset: number): { footnotes: any[]; idMap: Record<number, number> } {
  const footnotesArr = Array.isArray(chunkResult.footnotes) ? chunkResult.footnotes : []
  const idMap: Record<number, number> = {}
  const remapped = footnotesArr.map((fn: any, i: number) => {
    const oldId = fn?.id
    const newId = idOffset + i + 1
    if (oldId != null) idMap[oldId] = newId
    return { id: newId, reference: fn?.reference || `Reference ${newId}`, page: (typeof fn?.page === 'number' && Number.isFinite(fn.page)) ? fn.page : null }
  })
  return { footnotes: remapped, idMap }
}

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

serve(async (req) => {
  // Handle CORS preflight request
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

    const { documentId, summaryStyle, language, summaryLength, analyzeVisuals } = await req.json()
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'documentId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const style = (summaryStyle || 'standard').toLowerCase()
    const lang = (language || 'en').toLowerCase()
    const len = (summaryLength || 'medium').toLowerCase()



    // Get User Authorization JWT to verify ownership
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
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

    // Fetch document to verify ownership
    const { data: document, error: docError } = await userClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
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

    // ==========================================================================
    // DECIDE PIPELINE: short/medium documents use the original single-pass
    // (fast, cheap, supports visual analysis); long documents route through
    // the chunked map-reduce pipeline below so nothing gets silently
    // truncated and depth scales with actual document length.
    // ==========================================================================
    const useChunkedPipeline = extractedText.length > CHUNK_THRESHOLD

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
                  let binary = ''
                  const lenBytes = imgBytes.byteLength
                  for (let i = 0; i < lenBytes; i++) {
                    binary += String.fromCharCode(imgBytes[i])
                  }
                  base64Images.push(btoa(binary))
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
                  let binary = ''
                  const lenBytes = imgBytes.byteLength
                  for (let i = 0; i < lenBytes; i++) {
                    binary += String.fromCharCode(imgBytes[i])
                  }
                  base64Images.push(btoa(binary))
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
              const formData = new FormData()
              const pdfBlob = new Blob([fileBytes], { type: 'application/pdf' })
              formData.append('file', pdfBlob, 'document.pdf')
              formData.append('pages', '0-7')

              const pdfcoRes = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
                method: 'POST',
                headers: { 'x-api-key': pdfcoApiKey },
                body: formData
              })

              if (pdfcoRes.ok) {
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
                        const bytes = new Uint8Array(buffer)
                        let binary = ''
                        const lenBytes = bytes.byteLength
                        for (let i = 0; i < lenBytes; i++) {
                          binary += String.fromCharCode(bytes[i])
                        }
                        base64Images.push(btoa(binary))
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
                console.warn(`PDF.co response status failed: ${pdfcoRes.status}`)
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
      // CHUNKED MAP-REDUCE PATH: long documents. Every character of the
      // extracted text (up to MAX_CHUNKS chunks) is analyzed — nothing is
      // silently dropped the way the old 40,000-char cutoff did. Visual
      // analysis is not run on this path.
      // ========================================================================
      await serviceClient
        .from('documents')
        .update({ processing_stage: 'analyzing' })
        .eq('id', documentId)

      const rawChunks = splitIntoChunks(extractedText, CHUNK_TARGET_SIZE)
      let chunksToProcess = rawChunks
      if (rawChunks.length > MAX_CHUNKS) {
        console.warn(`Document produced ${rawChunks.length} chunks; capping to ${MAX_CHUNKS} — remaining content will not be analyzed.`)
        chunksToProcess = rawChunks.slice(0, MAX_CHUNKS)
      }
      console.log(`Chunked pipeline: processing ${chunksToProcess.length} chunk(s) for document ${documentId}.`)

      let chunkResults: any[]
      try {
        // Madde 6: FAST model + smaller completion budget + limited concurrency → lower TPM / cost
        await serviceClient.from('documents').update({ processing_stage: 'chunking' }).eq('id', documentId)
        chunkResults = await mapWithConcurrency(chunksToProcess, CHUNK_CONCURRENCY, async (chunkText, i) => {
          try {
            return await callGroqJson(
              groqApiKey,
              buildChunkSystemPrompt(i, chunksToProcess.length, langLabel, hasPageMarkers, pageMarkerLabel),
              chunkText,
              { model: MODEL_FAST, temperature: 0.25, maxCompletionTokens: CHUNK_MAX_COMPLETION, timeoutMs: 22000, maxRetries: 1 }
            )
          } catch (chunkErr) {
            console.error(`Chunk ${i + 1}/${chunksToProcess.length} extraction failed, using empty fallback:`, chunkErr)
            return {
              chunk_summary: '', key_terms: [], key_points: [], quiz_questions: [],
              tables: [], charts: [], footnotes: [], is_quantitative: false,
              formulas: [], worked_examples: [], diagrams: [],
              concept_graph: { nodes: [], edges: [] }
            }
          }
        })
      } catch (mapErr) {
        console.error('Chunked map phase failed unexpectedly: ', mapErr)
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Renumber each chunk's footnotes into one global sequence, in order,
      // and rewrite any [n] markers in that chunk's text to match.
      let footnoteOffset = 0
      for (const result of chunkResults) {
        const { footnotes, idMap } = remapChunkFootnotes(result, footnoteOffset)
        result.footnotes = footnotes
        result.chunk_summary = applyFootnoteRemap(result.chunk_summary, idMap)
        result.key_points = (Array.isArray(result.key_points) ? result.key_points : []).map((p: string) => applyFootnoteRemap(p, idMap))
        footnoteOffset += footnotes.length
      }

      // adaptiveTargets' caps grow with total character count, but for a
      // document split into MANY chunks, a preset-based cap alone can
      // saturate well before every chunk gets a fair share — round-robin
      // interleaving takes item[0] from every chunk before item[1] from
      // any, so slicing to (say) 25 across 24 chunks leaves most chunks
      // only their FIRST item, silently dropping the rest even though
      // nothing was actually a duplicate. chunkAwareCap() raises the
      // ceiling to guarantee roughly `perChunk` items per chunk survive
      // (bounded by an absolute ceiling so pathological inputs still
      // produce a usable, not endless, list) — completeness over a
      // preset number that was tuned for much shorter, single-pass docs.
      const chunkCount = chunksToProcess.length
      function chunkAwareCap(presetCap: number, perChunk: number, absoluteCeiling: number): number {
        return Math.min(absoluteCeiling, Math.max(presetCap, Math.round(chunkCount * perChunk)))
      }
      const keyTermsCap = chunkAwareCap(adaptiveTargets.keyTerms[1], 1.5, 60)
      const keyPointsCap = chunkAwareCap(adaptiveTargets.keyPoints[1], 1.5, 55)
      const quizCap = chunkAwareCap(adaptiveTargets.quizQuestions[1], 1, 30)
      const tablesCap = chunkAwareCap(15, 1, 40)
      const chartsCap = chunkAwareCap(10, 0.75, 30)
      const formulasCap = chunkAwareCap(20, 1.5, 60)
      const workedExamplesCap = chunkAwareCap(10, 0.75, 30)
      const diagramsCap = chunkAwareCap(8, 0.75, 20)

      const interleavedKeyTerms = dedupeKeyTerms(roundRobinInterleave(chunkResults.map(r => Array.isArray(r.key_terms) ? r.key_terms : [])))
      const interleavedKeyPoints = dedupeByText(roundRobinInterleave(chunkResults.map(r => Array.isArray(r.key_points) ? r.key_points : [])), (x: string) => x)
      const interleavedQuiz = dedupeByText(roundRobinInterleave(chunkResults.map(r => Array.isArray(r.quiz_questions) ? r.quiz_questions : [])), (q: any) => q?.question || '')
      const flatTables = chunkResults.flatMap(r => Array.isArray(r.tables) ? r.tables : [])
      const flatCharts = chunkResults.flatMap(r => Array.isArray(r.charts) ? r.charts : [])
      const flatFormulas = chunkResults.flatMap(r => Array.isArray(r.formulas) ? r.formulas : [])
      const flatWorkedExamples = chunkResults.flatMap(r => Array.isArray(r.worked_examples) ? r.worked_examples : [])
      const flatDiagrams = chunkResults.flatMap(r => Array.isArray(r.diagrams) ? r.diagrams : [])

      const mergedKeyTerms = interleavedKeyTerms.slice(0, keyTermsCap)
      const mergedKeyPoints = interleavedKeyPoints.slice(0, keyPointsCap)
      const mergedQuiz = interleavedQuiz.slice(0, quizCap)
      const mergedTables = flatTables.slice(0, tablesCap)
      const mergedCharts = flatCharts.slice(0, chartsCap)
      const mergedFormulas = flatFormulas.slice(0, formulasCap)
      const mergedWorkedExamples = flatWorkedExamples.slice(0, workedExamplesCap)
      const mergedDiagrams = flatDiagrams.slice(0, diagramsCap)
      const mergedFootnotes = chunkResults.flatMap(r => Array.isArray(r.footnotes) ? r.footnotes : [])

      // No silent caps: log exactly what (if anything) still got trimmed,
      // so a genuinely pathological document's data loss is visible in the
      // Edge Function logs rather than invisible.
      if (interleavedKeyTerms.length > keyTermsCap || interleavedKeyPoints.length > keyPointsCap || interleavedQuiz.length > quizCap ||
          flatTables.length > tablesCap || flatCharts.length > chartsCap || flatFormulas.length > formulasCap || flatWorkedExamples.length > workedExamplesCap ||
          flatDiagrams.length > diagramsCap) {
        console.warn(`Chunked merge truncation for document ${documentId} (${chunkCount} chunks): ` +
          `key_terms ${interleavedKeyTerms.length}->${mergedKeyTerms.length}, key_points ${interleavedKeyPoints.length}->${mergedKeyPoints.length}, ` +
          `quiz ${interleavedQuiz.length}->${mergedQuiz.length}, tables ${flatTables.length}->${mergedTables.length}, ` +
          `charts ${flatCharts.length}->${mergedCharts.length}, formulas ${flatFormulas.length}->${mergedFormulas.length}, ` +
          `worked_examples ${flatWorkedExamples.length}->${mergedWorkedExamples.length}, diagrams ${flatDiagrams.length}->${mergedDiagrams.length}`)
      }
      const quantFlaggedCount = chunkResults.filter(r => r.is_quantitative).length
      const quantFraction = chunkResults.length > 0 ? quantFlaggedCount / chunkResults.length : 0

      const [sLo, sHi] = adaptiveTargets.summarySentences
      const summaryLengthPhrase = len === 'short'
        ? `Write a concise final summary in ${sLo}-${sHi} sentences.`
        : len === 'detailed'
          ? `Write a thorough final summary in ${sLo}-${sHi} sentences, synthesizing across all parts.`
          : `Write a balanced final summary in ${sLo}-${sHi} sentences, synthesizing across all parts.`

      const synthesisUserContent = `Fraction of parts flagged quantitative: ${Math.round(quantFraction * 100)}%\n\n` +
        chunkResults.map((r, i) => `Part ${i + 1}/${chunkResults.length}:\n${r.chunk_summary || '(no summary extracted for this part)'}`).join('\n\n')

      let synthesis: any
      try {
        await serviceClient.from('documents').update({ processing_stage: 'synthesizing' }).eq('id', documentId)
        synthesis = await callGroqJson(
          groqApiKey,
          buildSynthesisSystemPrompt(courseCatalogBlock, langLabel, styleInstruction, summaryLengthPhrase),
          synthesisUserContent,
          { model: MODEL_HEAVY, temperature: 0.3, maxCompletionTokens: SYNTHESIS_MAX_COMPLETION, timeoutMs: 30000, maxRetries: 1 }
        )
      } catch (synthesisErr) {
        console.error('Synthesis call failed: ', synthesisErr)
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Prefer synthesis-level concept_graph (unified); fall back to merging chunk graphs
      let mergedConceptGraph = (synthesis.concept_graph && Array.isArray(synthesis.concept_graph.nodes))
        ? synthesis.concept_graph
        : { nodes: [], edges: [] }
      if ((!mergedConceptGraph.nodes || mergedConceptGraph.nodes.length === 0)) {
        const allNodes: any[] = []
        const allEdges: any[] = []
        const seenNode = new Set<string>()
        chunkResults.forEach((r, ci) => {
          const g = r.concept_graph || { nodes: [], edges: [] }
          ;(g.nodes || []).forEach((n: any) => {
            const id = `p${ci + 1}_${n.id || n.label}`
            if (!seenNode.has(String(n.label || '').toLowerCase())) {
              seenNode.add(String(n.label || '').toLowerCase())
              allNodes.push({ id, label: n.label, type: n.type || 'concept' })
            }
          })
          ;(g.edges || []).forEach((e: any) => {
            allEdges.push({ from: `p${ci + 1}_${e.from}`, to: `p${ci + 1}_${e.to}`, relation: e.relation || 'related_to' })
          })
        })
        mergedConceptGraph = { nodes: allNodes.slice(0, 20), edges: allEdges.slice(0, 30) }
      }

      const mergedDraft = {
        summary: synthesis.summary || '',
        summary_executive: synthesis.summary_executive || '',
        document_type: synthesis.document_type || 'Other',
        suggested_course_tag: synthesis.suggested_course_tag ?? null,
        is_quantitative: synthesis.is_quantitative ?? (quantFraction >= 0.5),
        key_terms: mergedKeyTerms,
        key_points: mergedKeyPoints,
        quiz_questions: mergedQuiz,
        tables: mergedTables,
        charts: mergedCharts,
        formulas: mergedFormulas,
        worked_examples: mergedWorkedExamples,
        diagrams: mergedDiagrams,
        concept_graph: mergedConceptGraph,
        footnotes: mergedFootnotes,
        outline: normalizeOutline(synthesis.outline, synthesis.sections),
        sections: normalizeSections(synthesis.sections, normalizeOutline(synthesis.outline, synthesis.sections))
      }

      // Madde 2: if sections are thin, run a dedicated SECTION PASS on chunk summaries
      try {
        const thin = !mergedDraft.sections.length ||
          mergedDraft.sections.every((s: any) => (s.summary || '').length < 220)
        if (thin && chunkResults.length > 0 && mergedDraft.outline?.items?.length > 0) {
          await serviceClient.from('documents').update({ processing_stage: 'sectioning' }).eq('id', documentId)
          const partDigest = chunkResults.map((r: any, i: number) =>
            `Part ${i + 1}: ${(r.chunk_summary || '').slice(0, 500)}`
          ).join('\n')
          const outlineLines = (mergedDraft.outline.items || [])
            .filter((it: any) => (it.level || 1) === 1)
            .map((it: any) => `- [${it.id}] ${it.heading}: ${it.blurb || ''}`)
            .join('\n')
          const sectionSys = `You deepen section summaries for a long academic document. Given an OUTLINE and PART DIGESTS, write deep per-section summaries. Respond ONLY with JSON: { "sections": [ { "heading": string, "summary": string, "key_points": [ string ], "outline_id": string | null } ] }. Each summary must be 4-8 academic sentences about ONLY that section. key_points: 3-6 takeaways. Match outline level-1 headings. Language: ${langLabel}. No admin/logistics sections.`
          const sectionUser = `OUTLINE:\n${outlineLines}\n\nPART DIGESTS:\n${partDigest.slice(0, 9000)}`
          const deepened = await callGroqJson(groqApiKey, sectionSys, sectionUser, {
            model: MODEL_FAST,
            temperature: 0.25,
            maxCompletionTokens: 3072,
            timeoutMs: 28000,
            maxRetries: 1
          })
          const norm = normalizeSections(deepened?.sections, mergedDraft.outline)
          if (norm.length > 0) mergedDraft.sections = norm
        }
      } catch (secErr) {
        console.warn('Madde 2 section deepen skipped:', secErr)
      }

      rawContent = JSON.stringify(mergedDraft)

      sourceTextForReview = chunkResults.map((r, i) => `Part ${i + 1}: ${r.chunk_summary || ''}`).join('\n\n')
      if (sourceTextForReview.length > 6000) {
        sourceTextForReview = sourceTextForReview.substring(0, 6000) + " [truncated for review]"
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

JSON shape: { "summary": string, "summary_executive": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "document_type": string, "tables": [ ... ], "charts": [ ... ], "footnotes": [ { "id": number, "reference": string, "page": number | null } ], "outline": { ... }, "sections": [ { "heading": string, "summary": string, "key_points": [ string ], "outline_id": string | null } ], "suggested_course_tag": string | null, "is_quantitative": boolean, "formulas": [ ... ], "worked_examples": [ ... ], "diagrams": [ ... ], "concept_graph": { ... }, "cloze_cards": [ ... ], "quality_gate": { "pass": boolean, "grounded": boolean, "issues": [ string ] } }.
Preserve summary_executive, outline, deep sections, concept_graph, cloze_cards unless clearly wrong.`

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
    // Turns outline + deep sections into a single NotebookLM-style narrative.
    // Does not invent facts; rewrites for flow, clarity, and academic brief tone.
    // ==========================================================================
    try {
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
          .map((s: any) => `## ${s.heading}\n${(s.summary || '').slice(0, 600)}`)
          .join('\n\n')
          .slice(0, 7000)

        const lengthHint =
          len === 'short' ? 'Write about 2-3 dense paragraphs (roughly 180-280 words).' :
          len === 'long' ? 'Write a thorough brief of 5-8 paragraphs (roughly 450-700 words).' :
          'Write a clear brief of 3-5 paragraphs (roughly 280-450 words).'

        const writerSys = `You are an expert academic writer producing a NotebookLM-quality document brief for a university student.
Respond with ONLY valid JSON: { "summary": string, "summary_executive": string }.

GOAL:
Write "summary" as a single cohesive NARRATIVE in ${langLabel} — professional prose, not a bullet dump, not a mechanical merge of sections.
Structure: open with the document's core thesis or purpose → develop the main arguments/topics in logical order → close with implications or takeaways.
Use smooth transitions. Prefer precise academic language without fluff.
${lengthHint}

RULES:
- Ground every claim in the outline/sections provided — do NOT invent theories, numbers, or conclusions absent from the inputs
- Do not discuss grading, attendance, office hours, or textbook logistics
- "summary_executive" = 2-3 sentence ultra-short overview (may refine the existing one)
- Do not use markdown headings inside summary; plain paragraphs separated by \\n\\n are fine
- If inputs are thin, write a shorter honest brief rather than padding`

        const writerUser = `Existing executive (may refine):
${(draftObj.summary_executive || '').slice(0, 500)}

Document outline:
${outlineBlock || '(none)'}

Deep section summaries:
${sectionsBlock || '(none — use existing draft summary below)'}

Existing draft summary (improve into narrative; keep factual content):
${String(draftObj.summary || '').slice(0, 3500)}`

        const written = await callGroqJson(groqApiKey, writerSys, writerUser, {
          model: MODEL_HEAVY,
          temperature: 0.35,
          maxCompletionTokens: len === 'long' ? 3072 : 2048,
          timeoutMs: 35000,
          maxRetries: 1
        })

        if (written?.summary && String(written.summary).trim().length > 80) {
          draftObj.summary = String(written.summary).trim()
        }
        if (written?.summary_executive && String(written.summary_executive).trim().length > 20) {
          draftObj.summary_executive = String(written.summary_executive).trim()
        }
        rawContent = JSON.stringify(draftObj)
        console.log('Madde 3: narrative writer applied')
      }
    } catch (writerErr) {
      console.warn('Madde 3 narrative writer skipped (keeping draft summary):', writerErr)
    }

    // Madde 6: progressive signal — draft exists, review may follow
    await serviceClient
      .from('documents')
      .update({ processing_stage: 'draft_ready' })
      .eq('id', documentId)

    // Skip review for short single-pass docs → saves 1 full LLM call (cost + latency)
    const shouldSkipReview = !useChunkedPipeline && extractedText.length <= SKIP_REVIEW_MAX_CHARS

    let rawFinalContent = ""

    if (shouldSkipReview) {
      console.log(`Madde 6: skipping review pass (doc ${extractedText.length} chars <= ${SKIP_REVIEW_MAX_CHARS})`)
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

    // ==========================================================================
    // STEP 4 — SAVE STUDY CARD & UPDATE STATUS
    // ==========================================================================
    const { data: newCard, error: cardError } = await serviceClient
      .from('study_cards')
      .insert({
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
        course_tag: document.course_tag ?? null,  // Phase 17A: propagate parent doc's tag
        quality_meta: qualityMeta
      })
      .select('id')
      .single()

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
