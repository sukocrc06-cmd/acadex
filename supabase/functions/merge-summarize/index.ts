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
            const { text } = await extractText(pdf, { mergePages: true })
            extractedText = text

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
                  extractedText = ocrText
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
          const docxResult = await mammoth.extractRawText({ buffer: fileBytes })
          extractedText = docxResult.value
        } else if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
          const zip = new JSZip()
          await zip.loadAsync(fileBytes)
          const slideFiles = Object.keys(zip.files)
            .filter(name => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"))
            .sort((a, b) => parseInt(a.replace(/[^0-9]/g, ""), 10) - parseInt(b.replace(/[^0-9]/g, ""), 10))
          let pptxText = ""
          for (const slidePath of slideFiles) {
            const slideXml = await zip.files[slidePath].async("text")
            const matches = slideXml.matchAll(/<a:t>(.*?)<\/a:t>/g)
            let slideText = ""
            for (const match of matches) { slideText += match[1] + " " }
            slideText = slideText.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
            pptxText += slideText + "\n"
          }
          extractedText = pptxText
        } else {
          extractedText = new TextDecoder("utf-8").decode(fileBytes)
        }
      } catch (extractionError) {
        console.error("Extraction failed for doc", doc.id, extractionError)
        let errorMsg = `Failed to extract readable content from "${doc.file_name}". The file could not be downloaded/opened (it may be corrupted, password-protected, or unreadable).`
        if (extractionError.message === "SCANNED_PDF") {
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

    let styleInstruction = "Write the summary as a clear, well-balanced paragraph-style overview."
    if (style === "bullet") styleInstruction = "Write the summary primarily as a series of short, scannable bullet points rather than flowing prose."
    else if (style === "outline") styleInstruction = "Write the summary as a hierarchical outline with clear section headings and indented sub-points, mirroring the structure of the source documents."
    else if (style === "simplified") styleInstruction = "Write the summary in simple, plain language suitable for someone new to the topic, avoiding jargon or clearly defining any technical terms used."
    else if (style === "exam_focused") styleInstruction = "Write a concise, fact-dense summary emphasizing definitions, relationships, and facts most likely to appear on an exam. Prioritize precision over narrative flow."

    // Part B: Length instruction
    let lengthInstruction = "Write a balanced summary in 4-8 sentences. Include 5-10 key terms, 5-10 key points, and 4-6 quiz questions."
    if (len === 'short') {
      lengthInstruction = "Write a concise summary in 2-3 sentences. Include only the 3-5 most essential key terms, 3-5 key points, and 3 quiz questions."
    } else if (len === 'detailed') {
      lengthInstruction = "Write a thorough, in-depth summary (8-14 sentences). Include 10-15 key terms, 10-15 key points, and 6-8 quiz questions covering the material comprehensively."
    }

    const langLabel = lang === "tr" ? "Turkish / Turkce" : "English"
    const docNames = documents.map(d => d.file_name).join(", ")

    // Part A: System prompt with document type classification & type specific guidance
    const systemPrompt = `You are an academic study assistant. You will be given combined text extracted from MULTIPLE student documents (${docNames}). Analyze all of them together and produce a UNIFIED study card that synthesizes the key information across all sources. Respond with ONLY a valid JSON object, no markdown code fences, no commentary before or after — just the raw JSON matching this exact shape: { "summary": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "document_type": string }.

DOCUMENT-TYPE CLASSIFICATION:
Identify the synthesized document type as one of the following exact strings: "Lecture Notes/Slides", "Academic Article", "Syllabus", "Case Study", "Textbook Chapter", or "Other". Put this classification in the "document_type" JSON field.
Adapt your summary approach according to this classification:
- "Lecture Notes/Slides": focus on key concepts, definitions, and the structure as originally presented.
- "Academic Article": focus on research question/purpose, methodology, key findings, and conclusions.
- "Syllabus": focus on course objectives, topics covered, and learning outcomes.
- "Case Study": structure around Problem/Context, Analysis, and Solution/Recommendation.
- "Textbook Chapter": focus on core theory, definitions, and illustrative examples.
- "Other": use standard general-purpose summarization.

LENGTH INSTRUCTION:
${lengthInstruction}

ACCURACY INSTRUCTION:
Base your summary, key terms, key points, and quiz questions STRICTLY on content actually present in the provided text. Do not invent, assume, or add information not found in the source material. If a section of the document is unclear or incomplete, reflect that faithfully rather than filling gaps with assumptions. Copy any specific numbers, formulas, names, or technical terms EXACTLY as they appear in the source — do not paraphrase or alter precise factual details.

LANGUAGE INSTRUCTION:
Respond strictly in the language: '${langLabel}'. Write the ENTIRE response (the summary, all key_terms, all key_points, all quiz_questions, and the document_type) in that specified language (the returned value of "document_type" must be one of the specified English strings: "Lecture Notes/Slides", "Academic Article", "Syllabus", "Case Study", "Textbook Chapter", or "Other").

EXAM-FOCUSED CONTENT FILTERING:
Exclude administrative/logistical information (instructor names, office hours, grading policies, textbook ISBN, etc.). Focus on actual academic content.

STYLE-SPECIFIC INSTRUCTION:
${styleInstruction}`

    // Pass 1: Call Groq to generate Draft
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + groqApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: combinedText }
        ]
      })
    })

    const groqData = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error("Groq API error:", JSON.stringify(groqData))
      return new Response(JSON.stringify({ error: "AI service error. The AI model is temporarily unavailable or has failed to generate a response." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const rawContent = groqData.choices?.[0]?.message?.content ?? ""
    if (!rawContent) {
      return new Response(JSON.stringify({ error: "AI failed to generate a draft response" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Pass 2: Self-Review for Higher Accuracy
    let sourceTextForReview = combinedText
    if (sourceTextForReview.length > 15000) {
      sourceTextForReview = sourceTextForReview.substring(0, 15000) + " [truncated for review]"
    }

    const reviewSystemPrompt = `You are reviewing a draft academic summary for accuracy and quality. Compare the draft against the original source text. Check for: (1) any factual errors or details not actually present in the source, (2) any important information from the source that was missed, (3) clarity and organization issues. Produce a REFINED, corrected final version in the exact same JSON format: { "summary": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "document_type": string }. If the draft was already accurate and complete, you may return it largely unchanged — only make genuine improvements, don't change things arbitrarily.`

    const reviewUserPrompt = `Original source text:\n${sourceTextForReview}\n\nDraft JSON summary:\n${rawContent}`

    const groqReviewResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + groqApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: reviewSystemPrompt },
          { role: "user", content: reviewUserPrompt }
        ]
      })
    })

    const groqReviewData = await groqReviewResponse.json()
    if (!groqReviewResponse.ok) {
      console.error("Groq Review API error:", JSON.stringify(groqReviewData))
      return new Response(JSON.stringify({ error: "AI review service error. Please try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const rawFinalContent = groqReviewData.choices?.[0]?.message?.content ?? ""
    if (!rawFinalContent) {
      return new Response(JSON.stringify({ error: "AI failed to generate a review response" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const cleaned = rawFinalContent.replace(/```json\s*|```/g, "").trim()
    let parsedContent
    try {
      parsedContent = JSON.parse(cleaned)
    } catch (parseError) {
      console.error("Failed to parse Groq JSON:", rawFinalContent, parseError)
      return new Response(JSON.stringify({ error: "AI returned invalid JSON formatting after review" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const inheritedTag = documents.find(d => d.course_tag)?.course_tag ?? null
    const userId = documents[0].user_id
    const sourceDocumentsMeta = documents.map(d => ({ id: d.id, file_name: d.file_name }))

    const { data: newCard, error: cardError } = await serviceClient
      .from("study_cards")
      .insert({
        document_id: null,
        user_id: userId,
        summary: parsedContent.summary || "",
        key_terms: parsedContent.key_terms || [],
        key_points: parsedContent.key_points || [],
        quiz_questions: parsedContent.quiz_questions || [],
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
