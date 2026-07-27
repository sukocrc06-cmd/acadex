import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { extractText, getDocumentProxy } from "npm:unpdf"
import mammoth from "npm:mammoth@1.6.0"
import JSZip from "npm:jszip@3.10.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// timeoutMs bounds EACH attempt via AbortController. This function runs as
// one of two SEQUENTIAL Groq calls in a single request (draft, then review)
// — without a cap, a slow/hanging draft call (plus its own retries) can
// quietly burn through the edge function's entire execution budget, so by
// the time the review call runs there's no time left and every attempt
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
  if (lastRateLimitedResponse) return lastRateLimitedResponse
  throw new Error("Max retries exceeded");
}

// Defensive safety net: reasoning-capable Groq models (openai/gpt-oss-120b)
// can prepend a <think>...</think> block to "content" even with reasoning
// turned down via reasoning_effort/include_reasoning below — strip it so a
// stray thinking block never breaks a JSON.parse call. Returns null if the
// block is unterminated (the model ran out of its token budget mid-thought
// before ever writing the real answer) — callers should treat that as a
// failure rather than trying to parse what's left.
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { documentIds, summaryStyle, language, summaryLength } = await req.json()

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
      return new Response(JSON.stringify({ error: "documentIds must be an array of at least 2 IDs" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const style = (summaryStyle || "standard").toLowerCase()
    const lang = (language || "en").toLowerCase()
    const len = (summaryLength || "medium").toLowerCase()
    console.log("merge-summarize: documentIds =", documentIds, "style =", style, "lang =", lang, "len =", len)

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Fetch all documents (RLS ensures user only sees their own)
    const { data: documents, error: docsError } = await userClient
      .from("documents")
      .select("*")
      .in("id", documentIds)

    if (docsError || !documents) {
      return new Response(JSON.stringify({ error: "Failed to fetch documents or access denied" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (documents.length !== documentIds.length) {
      return new Response(JSON.stringify({ error: "One or more documents not found or not owned by user" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // ==========================================================================
    // COURSE CATALOG LOOKUP — same department-aware course suggestion as
    // summarize-document (see 20260721_add_course_catalog.sql). All merged
    // documents belong to the same caller (enforced above), so one profile
    // lookup covers the whole merge. Fails soft if catalog tables are missing.
    // ==========================================================================
    let courseCatalogBlock = "No official course catalog is available for this student — suggest a course code or subject label only if one is explicitly evident in the document text itself."
    try {
      const mergeOwnerId = documents[0]?.user_id
      const { data: ownerProfile } = mergeOwnerId
        ? await serviceClient.from("profiles").select("department").eq("id", mergeOwnerId).single()
        : { data: null }

      if (ownerProfile?.department) {
        const { data: deptRow } = await serviceClient
          .from("departments")
          .select("code")
          .eq("name", ownerProfile.department)
          .maybeSingle()

        if (deptRow?.code) {
          const { data: deptCourses } = await serviceClient
            .from("courses")
            .select("course_code, course_name")
            .eq("department_code", deptRow.code)
            .order("course_code")

          if (deptCourses && deptCourses.length > 0) {
            courseCatalogBlock = deptCourses.map((c: any) => `${c.course_code} — ${c.course_name}`).join("\n")
          }
        }
      }
    } catch (catalogErr) {
      console.warn("Course catalog lookup failed, continuing with free-text course guessing: ", catalogErr)
    }

    const extractedSections: Array<{ fileName: string; text: string }> = []

    for (const doc of documents) {
      const { data: fileBlob, error: downloadError } = await serviceClient.storage
        .from("documents")
        .download(doc.storage_path)

      if (downloadError || !fileBlob) {
        console.error("Download failed for doc", doc.id, downloadError)
        return new Response(JSON.stringify({ error: `Failed to download "${doc.file_name}". The file could not be downloaded or opened.` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      const arrayBuffer = await fileBlob.arrayBuffer()
      const fileBytes = new Uint8Array(arrayBuffer)
      const mimeType = doc.mime_type?.toLowerCase() || ""
      let extractedText = ""

      try {
        if (mimeType === "text/plain") {
          extractedText = new TextDecoder("utf-8").decode(fileBytes)
        } else if (mimeType === "application/pdf") {
          let isScannedOrFailed = false
          try {
            const pdf = await getDocumentProxy(fileBytes)
            // mergePages: false → per-page array, so we can insert explicit
            // "--- SAYFA N ---" markers (mirrors summarize-document's page-
            // level citation feature) letting the model cite the exact page
            // a claim came from within this document.
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
            console.log(`PDF text is empty, short or extraction failed for "${doc.file_name}". Attempting OCR fallback...`)
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
        } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
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
        } else if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
          const zip = new JSZip()
          await zip.loadAsync(fileBytes)
          const slideFiles = Object.keys(zip.files)
            .filter(name => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"))
            .sort((a, b) => parseInt(a.replace(/[^0-9]/g, ""), 10) - parseInt(b.replace(/[^0-9]/g, ""), 10))
          let pptxText = ""
          for (const slidePath of slideFiles) {
            // Use the slide's real numeric filename, not the loop index —
            // slides can be non-contiguous if some were deleted.
            const slideNumMatch = slidePath.match(/slide(\d+)\.xml$/)
            const slideNum = slideNumMatch ? parseInt(slideNumMatch[1], 10) : (slideFiles.indexOf(slidePath) + 1)
            const slideXml = await zip.files[slidePath].async("text")
            const slideText = parsePptxSlideXml(slideXml)
            if (slideText) {
              pptxText += `--- SLAYT ${slideNum} ---\n${slideText}\n\n`
            }
          }
          extractedText = pptxText
        } else {
          extractedText = new TextDecoder("utf-8").decode(fileBytes)
        }
      } catch (extractionError: any) {
        console.error("Extraction failed for doc", doc.id, extractionError)
        let errorMsg = `Failed to extract readable content from "${doc.file_name}". The file could not be downloaded/opened (it may be corrupted, password-protected, or unreadable).`
        if (extractionError?.message === "SCANNED_PDF") {
          errorMsg = `"${doc.file_name}" appears to be a scanned image without selectable text. Please try a text-based PDF, or convert it using OCR software first.`
        }
        return new Response(JSON.stringify({ error: errorMsg }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      extractedText = extractedText.trim()
      if (!extractedText) {
        return new Response(JSON.stringify({ error: `No readable text found in "${doc.file_name}".` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      extractedSections.push({ fileName: doc.file_name, text: extractedText })
    }

    let combinedText = extractedSections
      .map(s => "=== DOCUMENT: " + s.fileName + " ===\n" + s.text)
      .join("\n\n")

    // Truncate combined text to first 40,000 characters
    if (combinedText.length > 40000) {
      const truncated = combinedText.substring(0, 40000)
      const lastBoundary = Math.max(truncated.lastIndexOf(". "), truncated.lastIndexOf(".\n"), truncated.lastIndexOf("\n"))
      combinedText = lastBoundary > 35000 ? truncated.substring(0, lastBoundary + 1) : truncated
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY")
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: "AI summarization key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Select style instruction (Part A)
    let styleInstruction = "Write the summary as 4-8 well-formed sentences in flowing prose."
    if (style === "bullet") {
      styleInstruction = "Write the summary as a series of SHORT bullet points, each starting with '- ' at the beginning of its own line (use '\\n' between each bullet). Do NOT write flowing paragraph sentences — every line must be a distinct, concise bullet fragment, not a full narrative paragraph. Aim for 6-10 bullets."
    } else if (style === "outline") {
      styleInstruction = "Write the summary as a hierarchical outline. Use '## ' prefixed lines for major section headings (identify 2-4 natural sections in the material), and '- ' prefixed indented lines beneath each heading for sub-points. Use '\\n' between every line. This must visually read as a structured outline, NOT as flowing paragraph prose."
    } else if (style === "simplified") {
      styleInstruction = "Write the summary in very short sentences (aim for under 15 words per sentence) using simple, everyday vocabulary. Avoid compound/complex sentence structures. Explain any necessary technical term immediately in parentheses using plain language."
    } else if (style === "exam_focused") {
      styleInstruction = "Write the summary as terse, fact-dense statements — prefer sentence fragments and direct statements over flowing narrative connectors like 'furthermore' or 'in addition.' Each sentence should pack in a specific fact, definition, or relationship. Keep it noticeably more compact and dense than a standard-style summary, with less narrative connective tissue between ideas."
    }

    // Part B: Length instruction
    let lengthInstruction = "Write a balanced summary in 4-8 sentences. Include 5-10 key terms, 5-10 key points, and 4-6 quiz questions."
    if (len === 'short') {
      lengthInstruction = "Write a concise summary in 2-3 sentences. Include only the 3-5 most essential key terms, 3-5 key points, and 3 quiz questions."
    } else if (len === 'detailed') {
      lengthInstruction = "Write a thorough, in-depth summary (12-20 sentences). Include 15-20 key terms, 12-18 key points, and 8-10 quiz questions covering the material comprehensively."
    }

    const langLabel = lang === "tr" ? "Turkish / Turkce" : "English"
    const docNames = documents.map((d: any) => d.file_name).join(", ")

    // Part A: System prompt with document type classification & type specific guidance
    const systemPrompt = `You are an academic study assistant. You will be given combined text extracted from MULTIPLE student documents (${docNames}). Analyze all of them together and produce a UNIFIED study card that synthesizes the key information across all sources. Respond with ONLY a valid JSON object, no markdown code fences, no commentary before or after — just the raw JSON matching this exact shape: { "summary": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "document_type": string, "tables": [ { "title": string, "headers": [ string ], "rows": [ [ string ] ] } ], "charts": [ { "title": string, "type": string, "labels": [ string ], "data": [ number ] } ], "footnotes": [ { "id": number, "reference": string, "page": number | null } ], "sections": [ { "heading": string, "summary": string } ], "suggested_course_tag": string | null, "is_quantitative": boolean, "formulas": [ { "name": string, "latex": string, "variables": [ { "symbol": string, "meaning": string } ] } ], "worked_examples": [ { "title": string, "problem_statement": string, "steps": [ string ], "final_answer": string } ] }.

QUANTITATIVE COURSE DETECTION & ADAPTATION:
Determine whether these combined documents are primarily QUANTITATIVE in nature — meaning they center on mathematical formulas, numerical calculations, statistical methods, or financial/accounting computations (e.g. Calculus, Statistics, Financial Management, Investment Analysis, Accounting, Economics with heavy math) — as opposed to conceptual/qualitative material (e.g. Marketing, Management theory, general business discussion). Put this boolean classification in the 'is_quantitative' JSON field (true or false).
When 'is_quantitative' is true: shift your summarization approach to prioritize extracting formulas and worked examples thoroughly, keeping the narrative summary comparatively brief and high-level in favor of these structured practical elements — since for quantitative material, the formulas and worked examples ARE the primary study content.

FORMULA EXTRACTION:
If this material is quantitative, identify every distinct formula/equation presented. For each, output an object in the 'formulas' array: { "name": "short descriptive name, e.g. 'Compound Interest Formula'", "latex": "the formula written in valid LaTeX notation, e.g. 'A = P(1 + r/n)^{nt}'", "variables": [ { "symbol": "e.g. P", "meaning": "e.g. Principal amount (initial investment)" } ] }. Return an empty array [] if the document has no formulas or is non-quantitative.

STEP-BY-STEP WORKED EXAMPLES:
If this material is quantitative, provide 1-3 worked examples showing how to apply the key formula(s) to a realistic problem. If the source documents already contain a worked example, use and clean up that one (preserving its actual numbers). If they don't but a formula is present, GENERATE a clear, realistic illustrative example (clearly reasonable numbers, not the exact same as any example in the source, creating a new one for practice). Output each in the 'worked_examples' array: { "title": "short description of the scenario", "problem_statement": "the problem as a student would read it, with specific numbers", "steps": [ "step 1 description with calculation shown", "step 2..." ], "final_answer": "the final numeric result with units, e.g. '$1,432.50'" }. Return an empty array [] if not applicable.

DOCUMENT-TYPE CLASSIFICATION:
Identify the synthesized document type as one of the following exact strings: "Lecture Notes/Slides", "Academic Article", "Syllabus", "Case Study", "Textbook Chapter", or "Other". Put this classification in the "document_type" JSON field.
Adapt your summary approach according to this classification:
- "Lecture Notes/Slides": focus on key concepts, definitions, and the structure as originally presented.
- "Academic Article": focus on research question/purpose, methodology, key findings, and conclusions.
- "Syllabus": focus on course objectives, topics covered, and learning outcomes.
- "Case Study": structure around Problem/Context, Analysis, and Solution/Recommendation.
- "Textbook Chapter": focus on core theory, definitions, and illustrative examples.
- "Other": use standard general-purpose summarization.

STRUCTURAL SECTIONS INSTRUCTION (hierarchical outline):
In addition to the single overall "summary", break the combined material down into 2-6 major topic-based SECTIONS spanning across the merged documents — but ONLY if it genuinely covers that many distinct topics, each in the order the topics appear. For each, output an object in the 'sections' array: { "heading": "short 2-5 word topic label", "summary": "2-4 sentence blurb covering just that section's academic content — footnote markers [n] allowed" }. This becomes a clickable table-of-contents so a student can jump straight to the topic they need. If the combined material is really just one continuous topic, or too short/simple to meaningfully split, return an empty array — never force sections onto material that doesn't naturally have them, and never create a section purely about course administration/logistics.

TABULAR AND CHART DATA EXTRACTION:
In addition to the summary, key terms, key points, and quiz questions, also identify any TABULAR DATA (rows/columns of related figures, comparisons, structured lists of data) and any CHART-WORTHY DATA (numeric comparisons, percentages, breakdowns, trends that would be clearly shown as a bar/pie/line chart) present in the source material. Include this as two new JSON fields:
- 'tables': an array of objects, each { "title": string, "headers": [string, ...], "rows": [[string, ...], ...] } — one object per distinct table found. Return an empty array if no clear tabular data exists.
- 'charts': an array of objects, each { "title": string, "type": "bar" | "pie" | "line", "labels": [string, ...], "data": [number, ...] } — one object per distinct chart-worthy dataset found (pick the most fitting chart type for the data — proportions/percentages of a whole → 'pie', comparisons across categories → 'bar', progression over time → 'line'). Return an empty array if no clear chart-worthy data exists.
Do NOT fabricate tables/charts if the source doesn't actually contain this kind of data — empty arrays are the correct output for purely narrative/text documents.

INLINE FOOTNOTES / SOURCE REFERENCES INSTRUCTION:
For non-obvious or specific factual claims in the summary and key_points, add a footnote marker like [1], [2], etc. immediately after the claim. Build a corresponding 'footnotes' array in your JSON output: [{ "id": 1, "reference": "brief description of which document and section/topic this relates to, e.g. 'Lecture1.pdf, Section 2.2 - SEO discussion'", "page": number | null }]. Some of the combined documents' text below includes markers in the form "--- SAYFA N ---" (page) or "--- SLAYT N ---" (slide) directly in the source, within the "=== DOCUMENT: filename ===" section they belong to. When a claim's supporting text is preceded by such a marker, set "page" to that real N (copied exactly from an actual marker you saw, never guessed) and mention the document's file name in "reference". If the claim comes from a document with no such markers in its text, set "page" to null and describe the topical section or heading area in "reference" as before. Don't over-footnote — reserve markers for specific, checkable claims (numbers, definitions, named findings), not every sentence.

SUGGESTED COURSE TAG INSTRUCTION:
Below is this student's OFFICIAL course catalog (format: CODE — Course Name):
${courseCatalogBlock}

Compare the combined documents' content, terminology, and subject matter against this catalog. If they clearly correspond to one of these listed courses, return that course's EXACT code (copied character-for-character, e.g. 'BUS330') as 'suggested_course_tag' — do not alter, reformat, or add spaces to it. Only if the content doesn't match any listed course, but a course code or clear subject label is otherwise evident directly in the source text, fall back to that as a short free-text string instead. If genuinely unclear and nothing in the catalog fits, return null. Never invent a course code that is neither in the catalog above nor explicitly present in the source text.

LENGTH INSTRUCTION:
${lengthInstruction}

ACCURACY INSTRUCTION:
Base your summary, key terms, key points, and quiz questions STRICTLY on content actually present in the provided text. Do not invent, assume, or add information not found in the source material. If a section of the document is unclear or incomplete, reflect that faithfully rather than filling gaps with assumptions. Copy any specific numbers, formulas, names, or technical terms EXACTLY as they appear in the source — do not paraphrase or alter precise factual details.

LANGUAGE INSTRUCTION:
Respond strictly in the language: '${langLabel}'. Write the ENTIRE response (the summary, all key_terms, all key_points, all quiz_questions, and the document_type) in that specified language (the returned value of "document_type" must be one of the specified English strings: "Lecture Notes/Slides", "Academic Article", "Syllabus", "Case Study", "Textbook Chapter", or "Other").

EXAM-FOCUSED CONTENT FILTERING (applies regardless of style, and is NOT optional):
Separate the combined content into (a) actual academic subject matter — concepts, definitions, theories, frameworks/models, processes, relationships, formulas, examples, case findings — and (b) course administration/logistics — grading weights/percentages, exam format/rules, attendance policy, bonus/late-submission policy, grade-appeal procedures, office hours, contact info, textbook title/edition/ISBN. ONLY (a) belongs anywhere in your output (summary, key_points, footnotes, quiz_questions). COMPLETELY EXCLUDE (b), even if its numbers are specific and checkable — a student is never tested on grading weights, attendance rules, or textbook editions. If one of the combined documents is mostly administrative logistics, it is correct to draw little or nothing from it — never pad the output with excluded content just to reach a target count.

CODE SNIPPETS & DATA PREVIEWS INSTRUCTION:
If the source material includes programming code snippets (e.g. Python, R, SQL used for data analysis), do not ignore them — briefly describe WHAT METHODOLOGY STEP each code block represents in the summary/key_points (e.g. 'the analysis loads and cleans the dataset, then engineers features including a lagged return and rolling volatility measure' rather than omitting this entirely). Do not attempt to reproduce the code verbatim in the summary, just describe its purpose and role in the overall analysis. If a code block's output shows a small data preview (a few rows of a dataframe), treat that as a legitimate table for the 'tables' field.

STYLE-SPECIFIC INSTRUCTION:
${styleInstruction}`

    // Pass 1: Call Groq to generate Draft
    // This account's tokens-per-minute limit for openai/gpt-oss-120b has been
    // observed as low as 8000 — the system prompt alone can be ~2,500 tokens,
    // leaving little room for combinedText (capped at 40,000 chars above)
    // plus the completion. Try progressively smaller (text, completion)
    // budget pairs instead of guessing one "safe" size.
    const draftTiers: Array<{ textChars: number; maxCompletionTokens: number }> = [
      { textChars: 6000, maxCompletionTokens: 2500 },
      { textChars: 3000, maxCompletionTokens: 1800 },
      { textChars: 1200, maxCompletionTokens: 1200 }
    ]
    let groqResponse: Response | null = null
    let groqData: any = null

    for (let i = 0; i < draftTiers.length; i++) {
      const tier = draftTiers[i]
      const draftUserContent = combinedText.length > tier.textChars
        ? combinedText.substring(0, tier.textChars) + " [truncated to fit the AI provider's rate limits]"
        : combinedText

      let attemptResponse: Response
      try {
        attemptResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": "Bearer " + groqApiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            // llama-3.3-70b-versatile is being retired by Groq (shutdown
            // 2026-08-16); openai/gpt-oss-120b is one of Groq's recommended
            // replacements.
            model: "openai/gpt-oss-120b",
            temperature: 0.3,
            // gpt-oss is a reasoning model; keep its reasoning minimal and out
            // of "content" so a stray <think> block can't break JSON.parse.
            reasoning_effort: "low",
            include_reasoning: false,
            max_completion_tokens: tier.maxCompletionTokens,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: draftUserContent }
            ]
          })
        }, 1, 25000) // 1 retry max, 25s cap per attempt — leaves time for the review pass afterward
      } catch (fetchErr) {
        console.error("Pass 1 Groq API fetchWithRetry exception: ", fetchErr)
        return new Response(JSON.stringify({ error: "Our AI service is experiencing high demand right now — please try again in a moment" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      const attemptData = await attemptResponse.json()

      if (attemptResponse.ok) {
        groqResponse = attemptResponse
        groqData = attemptData
        break
      }

      // Groq has been observed returning this error as either a 400 or a
      // 429, depending on the exact overage — treat both the same way.
      const isTokenSizeError = (attemptResponse.status === 400 || attemptResponse.status === 429) &&
        attemptData?.error?.code === 'rate_limit_exceeded' &&
        attemptData?.error?.type === 'tokens'

      console.error(`Groq API error (text budget ${tier.textChars} chars, completion budget ${tier.maxCompletionTokens}, status ${attemptResponse.status}):`, JSON.stringify(attemptData))

      if (!isTokenSizeError || i === draftTiers.length - 1) {
        return new Response(JSON.stringify({ error: "Our AI service is experiencing high demand right now — please try again in a moment" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }
      // else: too-large-for-TPM error — loop again with a smaller tier
    }

    let rawContent = groqData.choices?.[0]?.message?.content ?? ""
    if (!rawContent) {
      return new Response(JSON.stringify({ error: "Our AI service is experiencing high demand right now — please try again in a moment" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    // Strip any stray <think> block before this draft text gets embedded
    // into the review-pass prompt below.
    const draftStripped = stripThinkBlock(rawContent)
    if (draftStripped === null) {
      console.error('Groq Draft response was an unterminated <think> block (ran out of tokens while reasoning):', rawContent)
      return new Response(JSON.stringify({ error: "The AI ran out of thinking time before writing a draft — please try again" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    rawContent = draftStripped

    // Pass 2: Self-Review for Higher Accuracy
    let sourceTextForReview = combinedText
    if (sourceTextForReview.length > 6000) {
      sourceTextForReview = sourceTextForReview.substring(0, 6000) + " [truncated for review]"
    }

    const reviewSystemPrompt = `You are reviewing a draft academic summary for accuracy and quality. Compare the draft against the original source text. Check for: (1) any factual errors or details not actually present in the source, (2) any important information from the source that was missed, (3) clarity and organization issues, (4) verify that any extracted tables and charts accurately represent the source data numbers and values, (5) verify footnote references are accurate and preserve footnote markers [1], [2] in text, (6) verify that is_quantitative, formulas, and worked_examples are accurate, well-formatted, and use valid LaTeX string syntax, (7) scan the summary, key_points, footnotes, and quiz_questions for any course administration/logistics content that slipped in — grading weights/percentages, exam format/rules, attendance policy, grade-appeal procedures, office hours, textbook title/edition — and REMOVE it entirely (renumbering/adjusting footnote markers as needed). This content is NEVER appropriate here, no matter how specific or factually accurate it is. If removing it leaves a list shorter than before, that is correct.
In addition to checking factual accuracy, you MUST preserve the original requested style, length, and language of the draft. If the draft was written in bullet-point format, your refined version must ALSO be in bullet-point format (using '- ' prefixed lines). If it was an outline with '## ' headings, preserve that heading structure. If it was written in short/simplified sentences, keep sentences short and simple. Do NOT normalize or flatten distinctive formatting back into generic flowing prose — your job is to improve accuracy and clarity WITHIN the same style and structure the draft already used, not to rewrite it in a different format.

FOOTNOTE PAGE NUMBERS: each footnote in the draft may already carry a "page" field (a real page/slide number, or null). PRESERVE each footnote's existing "page" value exactly as given in the draft — the source text shown to you here may be truncated and missing the page markers it was originally derived from, so do not null out or guess a different page number unless the visible source text clearly shows a different marker for that exact claim.

STRUCTURAL SECTIONS: the draft may already carry a "sections" array (a topic-based outline, each with its own heading + short blurb). Verify each section's summary is accurate against the source and PRESERVE the overall section breakdown unless clearly wrong (e.g. a section that's purely administrative content, which must be removed). Do not invent new sections, and do not force sections into existence if the draft correctly left this array empty.

Produce a REFINED, corrected final version in the exact same JSON format: { "summary": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "document_type": string, "tables": [ { "title": string, "headers": [ string ], "rows": [ [ string ] ] } ], "charts": [ { "title": string, "type": string, "labels": [ string ], "data": [ number ] } ], "footnotes": [ { "id": number, "reference": string, "page": number | null } ], "sections": [ { "heading": string, "summary": string } ], "suggested_course_tag": string | null, "is_quantitative": boolean, "formulas": [ { "name": string, "latex": string, "variables": [ { "symbol": string, "meaning": string } ] } ], "worked_examples": [ { "title": string, "problem_statement": string, "steps": [ string ], "final_answer": string } ] }. If the draft was already accurate and complete, you may return it largely unchanged — only make genuine improvements, don't change things arbitrarily.`

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

    // Groq enforces a tokens-per-minute cap per model (as low as 8000 on
    // this account). A long/detailed draft plus the reference source text
    // can occasionally exceed it even after the 6,000-char truncation above.
    // Rather than fail outright, retry with progressively smaller reference-
    // text AND completion budgets together (the draft JSON itself is never
    // trimmed, since that would lose content from the final output).
    const reviewTiers: Array<{ sourceChars: number; maxCompletionTokens: number }> = [
      { sourceChars: 4000, maxCompletionTokens: 2500 },
      { sourceChars: 1200, maxCompletionTokens: 1800 },
      { sourceChars: 0, maxCompletionTokens: 1200 }
    ]
    let groqReviewResponse: Response | null = null
    let groqReviewData: any = null

    for (let i = 0; i < reviewTiers.length; i++) {
      const tier = reviewTiers[i]
      const attemptPrompt = buildReviewUserPrompt(tier.sourceChars)
      let attemptResponse: Response
      try {
        attemptResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": "Bearer " + groqApiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            // Deliberately a DIFFERENT model than the Draft pass above
            // (openai/gpt-oss-120b). Groq tracks tokens-per-minute limits
            // PER MODEL, and this account's gpt-oss-120b allowance (8000
            // TPM) is easily exhausted by the Draft pass alone, causing the
            // Review pass to immediately collide with the same budget a
            // moment later ("Used 6982/8000..."). Using qwen/qwen3.6-27b
            // here draws from a separate quota entirely.
            model: "qwen/qwen3.6-27b",
            temperature: 0.2,
            // Qwen3.6 is a hybrid reasoning model that thinks by default —
            // turn that off so "content" is just the direct JSON answer.
            reasoning_effort: "none",
            max_completion_tokens: tier.maxCompletionTokens,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: reviewSystemPrompt },
              { role: "user", content: attemptPrompt }
            ]
          })
        }, 1, 25000) // 1 retry max, 25s cap per attempt
      } catch (fetchReviewErr) {
        console.error("Pass 2 Groq API fetchWithRetry exception: ", fetchReviewErr)
        return new Response(JSON.stringify({ error: "Our AI service is experiencing high demand right now — please try again in a moment" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" }
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

      console.error(`Groq Review API error (source budget ${tier.sourceChars} chars, completion budget ${tier.maxCompletionTokens}, status ${attemptResponse.status}):`, JSON.stringify(attemptData))

      if (!isTokenSizeError || i === reviewTiers.length - 1) {
        return new Response(JSON.stringify({ error: "Our AI service is experiencing high demand right now — please try again in a moment" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }
      // else: too-large-for-TPM error — loop again with a smaller source budget
    }

    const rawFinalContent = groqReviewData.choices?.[0]?.message?.content ?? ""
    if (!rawFinalContent) {
      return new Response(JSON.stringify({ error: "Our AI service is experiencing high demand right now — please try again in a moment" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const reviewStripped = stripThinkBlock(rawFinalContent)
    if (reviewStripped === null) {
      console.error('Groq Review response was an unterminated <think> block (ran out of tokens while reasoning):', rawFinalContent)
      return new Response(JSON.stringify({ error: "The AI ran out of thinking time before finishing its review — please try again" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    const cleaned = reviewStripped.replace(/```json\s*|```/g, "").trim()
    let parsedContent
    try {
      parsedContent = JSON.parse(cleaned)
    } catch (parseError) {
      console.error("Failed to parse Groq JSON:", rawFinalContent, parseError)
      return new Response(JSON.stringify({ error: "AI returned invalid JSON formatting after review" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const inheritedTag = documents.find((d: any) => d.course_tag)?.course_tag ?? null
    const userId = documents[0].user_id
    const sourceDocumentsMeta = documents.map((d: any) => ({ id: d.id, file_name: d.file_name }))

    const { data: newCard, error: cardError } = await serviceClient
      .from("study_cards")
      .insert({
        document_id: null,
        user_id: userId,
        summary: parsedContent.summary || "",
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
        sections: Array.isArray(parsedContent.sections) ? parsedContent.sections : [],
        summary_style: style,
        summary_language: lang,
        summary_length: len,
        document_type: parsedContent.document_type || "Other",
        is_merged: true,
        source_documents: sourceDocumentsMeta,
        course_tag: inheritedTag
      })
      .select("id")
      .single()

    if (cardError) {
      console.error("Failed to save merged study card:", cardError)
      return new Response(JSON.stringify({ error: "Failed to save merged study card" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    return new Response(JSON.stringify({ success: true, studyCardId: newCard.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err) {
    console.error("Unexpected merge-summarize error:", err)
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})

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
