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

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 2500));
      } else if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 800));
      } else {
        return response;
      }
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 800));
    }
  }
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

    const { studyCardId, messages, image } = await req.json()
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

    const sections: string[] = []
    for (const doc of docs) {
      try {
        const text = await extractDocumentText(serviceClient, doc)
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

    let sourceText = sections.join('\n\n')
    // llama-3.3-70b-versatile has a large (128k token) context window, so for
    // chat we send the WHOLE document rather than truncating early the way a
    // one-shot summarization pass does — a student can ask about slide 3 or
    // slide 50 of the same deck in the same conversation. This cap is a safety
    // net for truly oversized documents only, not a normal ceiling.
    const MAX_CHARS = 100000
    if (sourceText.length > MAX_CHARS) {
      console.warn(`chat-with-document: source text (${sourceText.length} chars) exceeds ${MAX_CHARS}, truncating.`)
      const truncated = sourceText.substring(0, MAX_CHARS)
      const lastBoundary = Math.max(truncated.lastIndexOf(". "), truncated.lastIndexOf(".\n"), truncated.lastIndexOf("\n"))
      sourceText = lastBoundary > MAX_CHARS - 3000 ? truncated.substring(0, lastBoundary + 1) : truncated
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: 'AI key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const docNames = docs.map((d: any) => d.file_name).join(', ')
    const summaryContextBlock = buildSummaryContextBlock(card)
    const hasImage = typeof imageDataUrl === 'string'

    const systemPrompt = `You are a grounded document Q&A assistant for Acadex, an academic study platform. The student is asking questions about a specific uploaded source (${docNames}). You are given the full extracted text of that source below${summaryContextBlock ? ', along with the study card summary already generated for it' : ''}.

STRICT GROUNDING RULE:
Answer ONLY using information that is actually present in the source text${summaryContextBlock ? ' or the study card summary' : ''} below. Do NOT use outside knowledge to fill in gaps, and do NOT invent facts, numbers, names, or details that are not in the text. If the source does not contain enough information to answer the question, say so honestly and clearly (in the student's own language) instead of guessing — you may still briefly explain the general concept if it's common academic knowledge, but you MUST clearly distinguish that from what the source itself says.

CITATION RULE:
When you state a specific fact, definition, number, or claim drawn from the source, add a citation marker like [1], [2], etc. immediately after it, reusing the same marker for the same location if you reference it again. Build a "citations" array in your JSON output: [{ "id": number, "reference": string }], where "reference" briefly names the topical section/heading area the claim came from (e.g. "Bölüm 2 - SEO tartışması" or "Giriş bölümü"). Don't over-cite — reserve markers for specific, checkable claims, not every sentence. If your answer makes no specific checkable claims (e.g. it's just a clarifying question back to the student, or a general "not found in the source" answer), return an empty citations array.

DIAGRAM & VISUAL-STRUCTURE AWARENESS:
You only have the extracted text, not the original page images — so a flowchart, comparison diagram, or process illustration in the source often survives only as a cluster of short, disconnected phrases that don't read as normal prose (e.g. parallel short labels repeated near each other, a sequence of terse stage names, or paired opposing terms). If the student asks about a chart, diagram, graphic, or "görsel/şekil" and you spot such a cluster in the source text (or in the study card summary/tables/charts context below, if provided), reconstruct and explain its likely meaning — but explicitly flag that you're inferring the diagram's structure from scattered text labels rather than describing an image you can see (e.g. "Kaynak metindeki dağınık ifadelere bakılırsa, bu muhtemelen ... karşılaştıran bir diyagram."). If you genuinely can't find any fragments that plausibly correspond to what they're asking about, tell them honestly instead of guessing — and mention they can attach a photo/screenshot of that page so you can look at it directly.${hasImage ? `

ATTACHED IMAGE FROM STUDENT:
The student has attached a photo or screenshot of part of this source (for example, a diagram, chart, or page they want you to look at directly) along with their latest message. You DO have real vision on this image — actually look at it and describe/explain what it shows, don't just infer from text fragments. Cross-reference the source text and summary above to name the section/concept the image illustrates where relevant, but the image itself is your primary evidence for what it depicts. If the image is blurry, unrelated to this document, or you can't make out enough detail, say so honestly instead of guessing.` : ''}

LANGUAGE RULE:
Respond in the same language the student's latest question is written in (default to Turkish if genuinely ambiguous).

CONVERSATION STYLE:
Be concise, clear, and directly helpful — write like a knowledgeable classmate walking them through the material, not a formal report. Refer back to earlier turns in the conversation naturally if the student asks a follow-up question.

TABLES AND LISTS IN YOUR ANSWER:
If the student asks you to bring back a table, ranking, or list of items from the source, reproduce it inside the "answer" string using "- " bullet lines or simple "label: value" lines separated by "\\n" (a literal backslash-n escape sequence, NOT an actual line break) — never break your answer across multiple real lines. Keep each row/item on its own "\\n"-separated line so it still reads clearly when displayed, but the JSON string itself must remain a single line.

OUTPUT FORMAT:
Respond with ONLY a valid JSON object, no markdown code fences, no commentary before or after, and make sure every string value is valid single-line JSON (escape any newlines inside it as "\\n"): { "answer": string, "citations": [ { "id": number, "reference": string } ] }.
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

    // Bound the conversation window we forward to the model: last 10 turns
    // (5 exchanges) is plenty of context for follow-ups without ballooning cost.
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
        console.log("chat-with-document: attempting vision analysis with llama-3.2-90b-vision-preview...")
        groqResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.2-90b-vision-preview",
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: buildChatMessages(true)
          })
        })
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
      try {
        groqResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: buildChatMessages(false)
          })
        })
      } catch (fetchErr) {
        console.error("chat-with-document Groq fetch exception: ", fetchErr)
        return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    const groqData = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error("chat-with-document Groq API error:", JSON.stringify(groqData))
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const rawContent = groqData.choices?.[0]?.message?.content ?? ""
    if (!rawContent) {
      return new Response(JSON.stringify({ error: 'AI failed to generate a response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const cleaned = rawContent.replace(/```json\s*|```/g, "").trim()
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
