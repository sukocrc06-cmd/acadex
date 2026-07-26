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
        // wait longer before retrying.
        lastRateLimitedResponse = response
        try {
          const bodyPreview = await response.clone().text()
          console.warn(`fetchWithRetry: 429 rate-limited (attempt ${attempt + 1}/${maxRetries + 1}): ${bodyPreview}`)
        } catch (_readErr) { /* ignore — body may not be readable twice in all runtimes */ }
        await new Promise(r => setTimeout(r, 2500));
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

const CHUNK_THRESHOLD = 18000 // chars of extracted text; above this we go chunked
const CHUNK_TARGET_SIZE = 6500 // chars per chunk (well within model context; sized for extraction depth, not context limits)
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

async function callGroqJson(groqApiKey: string, systemPrompt: string, userContent: string, temperature = 0.3): Promise<any> {
  const response = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      // llama-3.3-70b-versatile is being retired by Groq (shutdown
      // 2026-08-16); openai/gpt-oss-120b is one of Groq's recommended
      // replacements and has a comparable (131K) context window.
      model: "openai/gpt-oss-120b",
      temperature,
      // gpt-oss is a reasoning model; keep its reasoning minimal and out of
      // "content" so a stray <think> block can't break JSON.parse below.
      reasoning_effort: "low",
      include_reasoning: false,
      // Without an explicit cap, Groq reserves a large default completion
      // budget against this account's tokens-per-minute limit, which alone
      // can push an otherwise modest request over the limit and return a
      // "Request too large" / rate_limit_exceeded error.
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ]
    })
  }, 1, 25000) // 1 retry max, 25s cap per attempt — this runs many times per document (chunk map + synthesis), so a tight-ish cap keeps the total pipeline within the edge function's execution budget
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

function buildChunkSystemPrompt(chunkIndex: number, totalChunks: number, langLabel: string): string {
  return `You are an academic study assistant helping process a LARGE document that has been split into ${totalChunks} sequential parts because of its length. You are given ONLY part ${chunkIndex + 1} of ${totalChunks} below — you do NOT see the rest of the document, so do not reference "the whole document" or assume content beyond what's shown here.

Respond with ONLY a valid JSON object, no markdown code fences, no commentary before or after — matching this exact shape: { "chunk_summary": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "tables": [ { "title": string, "headers": [ string ], "rows": [ [ string ] ] } ], "charts": [ { "title": string, "type": string, "labels": [ string ], "data": [ number ] } ], "footnotes": [ { "id": number, "reference": string } ], "is_quantitative": boolean, "formulas": [ { "name": string, "latex": string, "variables": [ { "symbol": string, "meaning": string } ] } ], "worked_examples": [ { "title": string, "problem_statement": string, "steps": [ string ], "final_answer": string } ] }.

CHUNK SUMMARY:
Write a 2-4 sentence "chunk_summary" capturing specifically what THIS part covers — it will later be combined with the other parts' summaries into one final document summary, so be concrete and self-contained about the actual topics discussed here rather than vague.

EXTRACTION SCOPE:
Extract key terms, key points, and 1-3 quiz questions found in THIS PART ONLY. Scale the amount to how much substantive academic content this part actually contains — a short or mostly administrative/transitional part may legitimately warrant few or even zero key terms/points/quiz questions. Do not pad for the sake of padding.

QUANTITATIVE & FORMULAS:
Set "is_quantitative" true if this part centers on mathematical formulas, numerical calculations, or financial/statistical computations. If so, extract every distinct formula in 'formulas' (valid LaTeX notation) and 1-2 worked examples in 'worked_examples' (reuse the source's own example if present, preserving its actual numbers; otherwise generate one clear, realistic example). Return empty arrays if not applicable to this part.

TABLES & CHARTS:
Identify any tabular data ('tables') or chart-worthy numeric data ('charts', type "bar"|"pie"|"line") actually present in this part. Empty arrays are the correct output if none exists — never fabricate.

DIAGRAM & VISUAL-STRUCTURE AWARENESS:
You only see extracted text — visual layout (boxes, arrows, side-by-side positioning) is lost, so a flowchart, comparison diagram, or process illustration on the original slide/page often survives only as a cluster of short, disconnected phrases that don't read as normal prose (e.g. two or three parallel short labels repeated near each other, a sequence of terse stage names, or paired opposing terms). When you notice such a cluster in THIS part, infer its likely meaning and add ONE key_point reconstructing it, clearly prefixed with "Diyagram/Görsel:" ("Diagram/Visual:" in English) so the student knows it's your interpretation of a visual element, not a verbatim quote. Only do this when fragments genuinely look diagram-like — don't force it onto ordinary bullet lists.

FOOTNOTES:
For specific, checkable factual claims within key_points (numbers, definitions, named findings), add a footnote marker like [1], [2] immediately after the claim (numbering restarts at 1 for this part — it will be renumbered globally later). List each in 'footnotes': [{ "id": number, "reference": "brief description of the topic/heading this relates to" }]. Don't over-footnote.

ACCURACY:
Base everything STRICTLY on the text in this part. Do not invent facts or assume content not shown. Copy specific numbers, names, and technical terms exactly as they appear.

LANGUAGE:
Respond entirely in: '${langLabel}'.`
}

function buildSynthesisSystemPrompt(courseCatalogBlock: string, langLabel: string, styleInstruction: string, summaryLengthPhrase: string): string {
  return `You are an academic study assistant. A large document was split into sequential parts and each part was already summarized independently. Below you are given all of those part-summaries, in order, plus a hint about what fraction were flagged as quantitative. Your job is to synthesize ONE cohesive, well-organized final summary of the ENTIRE document — write a genuinely unified narrative that flows across the whole document, not a mechanical concatenation of the part-summaries.

Respond with ONLY a valid JSON object, no markdown fences, no commentary before or after: { "summary": string, "document_type": string, "suggested_course_tag": string | null, "is_quantitative": boolean }.

DOCUMENT-TYPE CLASSIFICATION:
Identify the overall document type as exactly one of: "Lecture Notes/Slides", "Academic Article", "Syllabus", "Case Study", "Textbook Chapter", or "Other".

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
Base the summary strictly on the part-summaries provided — do not invent content beyond what they describe.`
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
    return { id: newId, reference: fn?.reference || `Reference ${newId}` }
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
          const { text } = await extractText(pdf, { mergePages: true })
          extractedText = detectAndFormatPdfTables(text)

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
          const slideXml = await zip.files[slidePath].async("text")
          const slideText = parsePptxSlideXml(slideXml)
          if (slideText) {
            pptxText += slideText + "\n\n"
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
    const systemPrompt = `You are an academic study assistant. You will be given the raw text extracted from a student's uploaded document. Analyze it and respond with ONLY a valid JSON object, no markdown code fences, no commentary before or after — just the raw JSON object matching this exact shape: { "summary": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "document_type": string, "tables": [ { "title": string, "headers": [ string ], "rows": [ [ string ] ] } ], "charts": [ { "title": string, "type": string, "labels": [ string ], "data": [ number ] } ], "footnotes": [ { "id": number, "reference": string } ], "suggested_course_tag": string | null, "is_quantitative": boolean, "formulas": [ { "name": string, "latex": string, "variables": [ { "symbol": string, "meaning": string } ] } ], "worked_examples": [ { "title": string, "problem_statement": string, "steps": [ string ], "final_answer": string } ] }.

QUANTITATIVE COURSE DETECTION & ADAPTATION:
Determine whether this document is primarily QUANTITATIVE in nature — meaning it centers on mathematical formulas, numerical calculations, statistical methods, or financial/accounting computations (e.g. Calculus, Statistics, Financial Management, Investment Analysis, Accounting, Economics with heavy math) — as opposed to conceptual/qualitative material (e.g. Marketing, Management theory, general business discussion). Put this boolean classification in the 'is_quantitative' JSON field (true or false).
When 'is_quantitative' is true: shift your summarization approach to prioritize extracting formulas and worked examples thoroughly, keeping the narrative summary comparatively brief and high-level in favor of these structured practical elements — since for quantitative material, the formulas and worked examples ARE the primary study content.

FORMULA EXTRACTION:
If this document is quantitative, identify every distinct formula/equation presented. For each, output an object in the 'formulas' array: { "name": "short descriptive name, e.g. 'Compound Interest Formula'", "latex": "the formula written in valid LaTeX notation, e.g. 'A = P(1 + r/n)^{nt}'", "variables": [ { "symbol": "e.g. P", "meaning": "e.g. Principal amount (initial investment)" } ] }. Return an empty array [] if the document has no formulas or is non-quantitative.

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

TABULAR AND CHART DATA EXTRACTION:
In addition to the summary, key terms, key points, and quiz questions, also identify any TABULAR DATA (rows/columns of related figures, comparisons, structured lists of data) and any CHART-WORTHY DATA (numeric comparisons, percentages, breakdowns, trends that would be clearly shown as a bar/pie/line chart) present in the source material. If visual analysis was used and chart/graph images were shown to you, extract the ACTUAL data values from those images for this purpose. Include this as two new JSON fields:
- 'tables': an array of objects, each { "title": string, "headers": [string, ...], "rows": [[string, ...], ...] } — one object per distinct table found. Return an empty array if no clear tabular data exists.
- 'charts': an array of objects, each { "title": string, "type": "bar" | "pie" | "line", "labels": [string, ...], "data": [number, ...] } — one object per distinct chart-worthy dataset found (pick the most fitting chart type for the data — proportions/percentages of a whole → 'pie', comparisons across categories → 'bar', progression over time → 'line'). Return an empty array if no clear chart-worthy data exists.
Do NOT fabricate tables/charts if the source doesn't actually contain this kind of data — empty arrays are the correct output for purely narrative/text documents.

INLINE FOOTNOTES / SOURCE REFERENCES INSTRUCTION:
For non-obvious or specific factual claims in the summary and key_points, add a footnote marker like [1], [2], etc. immediately after the claim. Build a corresponding 'footnotes' array in your JSON output: [{ "id": 1, "reference": "brief description of which section/topic of the source this relates to, e.g. 'Section 2.2 - SEO discussion' or 'Introduction section'" }]. Since you don't have exact page numbers, reference the topical section or heading area instead. Don't over-footnote — reserve markers for specific, checkable claims (numbers, definitions, named findings), not every sentence.

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

EXAM-FOCUSED CONTENT FILTERING:
Before summarizing, identify and EXCLUDE administrative/logistical information that would not appear on an exam. Focus exclusively on the actual academic subject matter: concepts, theories, definitions, processes, relationships, examples, and any content a student would need to understand or recall for an exam.

DIAGRAM & VISUAL-STRUCTURE AWARENESS:
You are only given extracted text — visual layout (boxes, arrows, side-by-side positioning) is lost in extraction, so a flowchart, comparison diagram, or process illustration often survives only as a cluster of short, disconnected phrases that don't read as normal prose (e.g. two or three parallel short labels repeated near each other, a sequence of terse stage names, or paired opposing terms). When you notice such a cluster, infer that it likely represents a diagram and add ONE key_point that reconstructs its probable meaning, clearly prefixed with "Diyagram/Görsel:" (or "Diagram/Visual:" if responding in English) so the student knows this is your interpretation of a visual element rather than a verbatim quote — e.g. "Diyagram: 'Satış kavramı' (ürün/satış odaklı, mevcut ürünleri satmaya çalışır) ile 'Pazarlama kavramı' (müşteri ihtiyaçlarını anlayıp buna göre değer yaratır) karşılaştırılıyor gibi görünüyor." Only do this when the fragments genuinely look diagram-like — don't force it onto ordinary bullet lists or normal prose.

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
              // See callGroqJson above — an explicit cap keeps this request's
              // estimated token usage safely under the account's per-model
              // tokens-per-minute limit.
              max_completion_tokens: 4096,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: systemPrompt
                },
                {
                  role: "user",
                  content: textToSend
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
        chunkResults = await mapWithConcurrency(chunksToProcess, 4, async (chunkText, i) => {
          try {
            return await callGroqJson(groqApiKey, buildChunkSystemPrompt(i, chunksToProcess.length, langLabel), chunkText, 0.3)
          } catch (chunkErr) {
            console.error(`Chunk ${i + 1}/${chunksToProcess.length} extraction failed, using empty fallback:`, chunkErr)
            return {
              chunk_summary: '', key_terms: [], key_points: [], quiz_questions: [],
              tables: [], charts: [], footnotes: [], is_quantitative: false,
              formulas: [], worked_examples: []
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

      const mergedKeyTerms = dedupeKeyTerms(roundRobinInterleave(chunkResults.map(r => Array.isArray(r.key_terms) ? r.key_terms : [])))
        .slice(0, adaptiveTargets.keyTerms[1])
      const mergedKeyPoints = dedupeByText(roundRobinInterleave(chunkResults.map(r => Array.isArray(r.key_points) ? r.key_points : [])), (x: string) => x)
        .slice(0, adaptiveTargets.keyPoints[1])
      const mergedQuiz = dedupeByText(roundRobinInterleave(chunkResults.map(r => Array.isArray(r.quiz_questions) ? r.quiz_questions : [])), (q: any) => q?.question || '')
        .slice(0, adaptiveTargets.quizQuestions[1])
      const mergedTables = chunkResults.flatMap(r => Array.isArray(r.tables) ? r.tables : []).slice(0, 15)
      const mergedCharts = chunkResults.flatMap(r => Array.isArray(r.charts) ? r.charts : []).slice(0, 10)
      const mergedFormulas = chunkResults.flatMap(r => Array.isArray(r.formulas) ? r.formulas : []).slice(0, 20)
      const mergedWorkedExamples = chunkResults.flatMap(r => Array.isArray(r.worked_examples) ? r.worked_examples : []).slice(0, 10)
      const mergedFootnotes = chunkResults.flatMap(r => Array.isArray(r.footnotes) ? r.footnotes : [])
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
        synthesis = await callGroqJson(
          groqApiKey,
          buildSynthesisSystemPrompt(courseCatalogBlock, langLabel, styleInstruction, summaryLengthPhrase),
          synthesisUserContent,
          0.3
        )
      } catch (synthesisErr) {
        console.error('Synthesis call failed: ', synthesisErr)
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const mergedDraft = {
        summary: synthesis.summary || '',
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
        footnotes: mergedFootnotes
      }

      rawContent = JSON.stringify(mergedDraft)

      sourceTextForReview = chunkResults.map((r, i) => `Part ${i + 1}: ${r.chunk_summary || ''}`).join('\n\n')
      if (sourceTextForReview.length > 6000) {
        sourceTextForReview = sourceTextForReview.substring(0, 6000) + " [truncated for review]"
      }
    }

    // Pass 2: Self-Review for Higher Accuracy (shared by both pipelines above)
    const reviewSystemPrompt = `You are reviewing a draft academic summary for accuracy and quality. Compare the draft against the original source text. Check for: (1) any factual errors or details not actually present in the source, (2) any important information from the source that was missed, (3) clarity and organization issues, (4) verify that any extracted tables and charts accurately represent the source data numbers and values, (5) verify footnote references are accurate and preserve footnote markers [1], [2] in text, (6) verify that is_quantitative, formulas, and worked_examples are accurate, well-formatted, and use valid LaTeX string syntax.
In addition to checking factual accuracy, you MUST preserve the original requested style, length, and language of the draft. If the draft was written in bullet-point format, your refined version must ALSO be in bullet-point format (using '- ' prefixed lines). If it was an outline with '## ' headings, preserve that heading structure. If it was written in short/simplified sentences, keep sentences short and simple. Do NOT normalize or flatten distinctive formatting back into generic flowing prose — your job is to improve accuracy and clarity WITHIN the same style and structure the draft already used, not to rewrite it in a different format.

Produce a REFINED, corrected final version in the exact same JSON format: { "summary": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "document_type": string, "tables": [ { "title": string, "headers": [ string ], "rows": [ [ string ] ] } ], "charts": [ { "title": string, "type": string, "labels": [ string ], "data": [ number ] } ], "footnotes": [ { "id": number, "reference": string } ], "suggested_course_tag": string | null, "is_quantitative": boolean, "formulas": [ { "name": string, "latex": string, "variables": [ { "symbol": string, "meaning": string } ] } ], "worked_examples": [ { "title": string, "problem_statement": string, "steps": [ string ], "final_answer": string } ] }. If the draft was already accurate and complete, you may return it largely unchanged — only make genuine improvements, don't change things arbitrarily.`

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

    // Update stage to reviewing
    await serviceClient
      .from('documents')
      .update({ processing_stage: 'reviewing' })
      .eq('id', documentId)

    // Groq enforces a tokens-per-minute cap per model. A long/detailed draft
    // plus the reference source text can occasionally exceed it even after
    // the 6,000-char truncation above. Rather than fail outright, retry with
    // a progressively smaller reference-text budget (the draft JSON itself
    // is never trimmed, since that would lose content from the final output).
    const sourceBudgets = [6000, 1200, 0]
    let groqReviewResponse: Response | null = null
    let groqReviewData: any = null

    for (let i = 0; i < sourceBudgets.length; i++) {
      const attemptPrompt = buildReviewUserPrompt(sourceBudgets[i])
      let attemptResponse: Response
      try {
        attemptResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
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
            temperature: 0.2,
            reasoning_effort: "low",
            include_reasoning: false,
            max_completion_tokens: 4096,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: reviewSystemPrompt
              },
              {
                role: "user",
                content: attemptPrompt
              }
            ]
          })
        }, 1, 25000) // 1 retry max, 25s cap per attempt
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
        groqReviewResponse = attemptResponse
        groqReviewData = attemptData
        break
      }

      // Groq has been observed returning this error as either a 400 or a
      // 429, depending on the exact overage — treat both the same way.
      const isTokenSizeError = (attemptResponse.status === 400 || attemptResponse.status === 429) &&
        attemptData?.error?.code === 'rate_limit_exceeded' &&
        attemptData?.error?.type === 'tokens'

      console.error(`Groq Review API call failed (source budget ${sourceBudgets[i]} chars, status ${attemptResponse.status}): `, JSON.stringify(attemptData))

      if (!isTokenSizeError || i === sourceBudgets.length - 1) {
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      // else: too-large-for-TPM error — loop again with a smaller source budget
    }

    const rawFinalContent = groqReviewData.choices?.[0]?.message?.content ?? ""
    if (!rawFinalContent) {
      console.error('Empty response content from Groq Review: ', JSON.stringify(groqReviewData))
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
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

    // ==========================================================================
    // STEP 4 — SAVE STUDY CARD & UPDATE STATUS
    // ==========================================================================
    const { data: newCard, error: cardError } = await serviceClient
      .from('study_cards')
      .insert({
        document_id: documentId,
        user_id: document.user_id,
        summary: parsedContent.summary || '',
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
        summary_style: style,
        summary_language: lang,
        summary_length: len,
        document_type: parsedContent.document_type || 'Other',
        visual_analysis: visualAnalysisUsed,
        course_tag: document.course_tag ?? null  // Phase 17A: propagate parent doc's tag
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
