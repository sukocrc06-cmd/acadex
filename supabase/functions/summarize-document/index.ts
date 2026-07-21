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

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 429) {
        // Rate limited — wait longer before retrying
        await new Promise(r => setTimeout(r, 2500));
      } else if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 800));
      } else {
        return response; // let the caller handle non-retryable errors normally
      }
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  throw new Error("Max retries exceeded");
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
          console.log("PDF text is empty, short or extraction failed. Attempting OCR fallback...")
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
      } 
      else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const docxResult = await mammoth.extractRawText({ buffer: fileBytes })
        extractedText = docxResult.value
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
          const matches = slideXml.matchAll(/<a:t>(.*?)<\/a:t>/g)
          let slideText = ""
          for (const match of matches) {
            slideText += match[1] + " "
          }
          
          // Decode basic XML entities
          slideText = slideText
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            
          pptxText += slideText + "\n"
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

    // Truncate to first 40,000 characters if too long, snapping to sentence/paragraph boundary
    let textToSend = extractedText
    if (textToSend.length > 40000) {
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

    // Part B: Length instruction
    let lengthInstruction = "Write a balanced summary in 4-8 sentences. Include 5-10 key terms, 5-10 key points, and 4-6 quiz questions."
    if (len === 'short') {
      lengthInstruction = "Write a concise summary in 2-3 sentences. Include only the 3-5 most essential key terms, 3-5 key points, and 3 quiz questions."
    } else if (len === 'detailed') {
      lengthInstruction = "Write a thorough, in-depth summary (12-20 sentences). Include 15-20 key terms, 12-18 key points, and 8-10 quiz questions covering the material comprehensively."
    }

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
Based on the document's content, suggest a likely course code or short subject name if one is evident (e.g. a course code mentioned in the document like 'BUS 340', or a general subject label like 'Digital Marketing' if no explicit code is found). Include this as 'suggested_course_tag' (a short string, or null if genuinely unclear) in your JSON output.

LENGTH INSTRUCTION:
${lengthInstruction}

ACCURACY INSTRUCTION:
Base your summary, key terms, key points, and quiz questions STRICTLY on content actually present in the provided text. Do not invent, assume, or add information not found in the source material. If a section of the document is unclear or incomplete, reflect that faithfully rather than filling gaps with assumptions. Copy any specific numbers, formulas, names, or technical terms EXACTLY as they appear in the source — do not paraphrase or alter precise factual details.

LANGUAGE INSTRUCTION:
Respond strictly in the language: '${langLabel}'. Write the ENTIRE response (the summary, all key_terms terms and definitions, all key_points, all quiz_questions, and the document_type) in that specified language (the returned value of "document_type" must be one of the specified English strings: "Lecture Notes/Slides", "Academic Article", "Syllabus", "Case Study", "Textbook Chapter", or "Other").

EXAM-FOCUSED CONTENT FILTERING:
Before summarizing, identify and EXCLUDE administrative/logistical information that would not appear on an exam. Focus exclusively on the actual academic subject matter: concepts, theories, definitions, processes, relationships, examples, and any content a student would need to understand or recall for an exam.

PROFESSIONAL TONE INSTRUCTION:
Write in a clear, formal academic register. Avoid filler phrases, redundant restatements, and vague generalities. Use precise terminology appropriate to the subject matter.

STYLE-SPECIFIC INSTRUCTION:
${styleInstruction}`

    // Visual analysis (Part B & C)
    const runVisuals = !!analyzeVisuals && mimeType === "application/pdf"
    let visualAnalysisUsed = false
    let base64Images: string[] = []

    if (runVisuals) {
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

        console.log("Attempting vision-based analysis using llama-3.2-90b-vision-preview...")
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
            messages: pass1Messages
          })
        })

        if (groqResponse.ok) {
          pass1Completed = true
          console.log("Vision-based Pass 1 completed successfully.")
        } else {
          console.warn(`Vision model call returned non-ok status: ${groqResponse.status}. Falling back to text-only.`)
          visualAnalysisUsed = false
        }
      } catch (visionErr) {
        console.warn("Vision-based analysis call failed. Falling back to text-only:", visionErr)
        visualAnalysisUsed = false
      }
    }

    if (!pass1Completed) {
      console.log("Running standard text-only analysis using Llama-3.3-70b-versatile...")
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
        })
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

    const rawContent = groqData.choices?.[0]?.message?.content ?? ""
    if (!rawContent) {
      console.error('Empty response content from Groq Draft: ', JSON.stringify(groqData))
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'AI failed to generate a response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Pass 2: Self-Review for Higher Accuracy
    let sourceTextForReview = textToSend
    if (sourceTextForReview.length > 15000) {
      sourceTextForReview = sourceTextForReview.substring(0, 15000) + " [truncated for review]"
    }

    const reviewSystemPrompt = `You are reviewing a draft academic summary for accuracy and quality. Compare the draft against the original source text. Check for: (1) any factual errors or details not actually present in the source, (2) any important information from the source that was missed, (3) clarity and organization issues, (4) verify that any extracted tables and charts accurately represent the source data numbers and values, (5) verify footnote references are accurate and preserve footnote markers [1], [2] in text, (6) verify that is_quantitative, formulas, and worked_examples are accurate, well-formatted, and use valid LaTeX string syntax.
In addition to checking factual accuracy, you MUST preserve the original requested style, length, and language of the draft. If the draft was written in bullet-point format, your refined version must ALSO be in bullet-point format (using '- ' prefixed lines). If it was an outline with '## ' headings, preserve that heading structure. If it was written in short/simplified sentences, keep sentences short and simple. Do NOT normalize or flatten distinctive formatting back into generic flowing prose — your job is to improve accuracy and clarity WITHIN the same style and structure the draft already used, not to rewrite it in a different format.

Produce a REFINED, corrected final version in the exact same JSON format: { "summary": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "document_type": string, "tables": [ { "title": string, "headers": [ string ], "rows": [ [ string ] ] } ], "charts": [ { "title": string, "type": string, "labels": [ string ], "data": [ number ] } ], "footnotes": [ { "id": number, "reference": string } ], "suggested_course_tag": string | null, "is_quantitative": boolean, "formulas": [ { "name": string, "latex": string, "variables": [ { "symbol": string, "meaning": string } ] } ], "worked_examples": [ { "title": string, "problem_statement": string, "steps": [ string ], "final_answer": string } ] }. If the draft was already accurate and complete, you may return it largely unchanged — only make genuine improvements, don't change things arbitrarily.`

    const reviewUserPrompt = `Original requested format parameters:
- Summary Style: ${style}
- Summary Length: ${len}
- Summary Language: ${lang}

Original source text:
${sourceTextForReview}

Draft JSON summary:
${rawContent}`

    // Update stage to reviewing
    await serviceClient
      .from('documents')
      .update({ processing_stage: 'reviewing' })
      .eq('id', documentId)

    let groqReviewResponse;
    try {
      groqReviewResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: reviewSystemPrompt
            },
            {
              role: "user",
              content: reviewUserPrompt
            }
          ]
        })
      })
    } catch (fetchReviewErr) {
      console.error("Pass 2 Groq API fetchWithRetry exception: ", fetchReviewErr)
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const groqReviewData = await groqReviewResponse.json()

    if (!groqReviewResponse.ok) {
      console.error("Groq Review API call failed: ", JSON.stringify(groqReviewData))
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
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
    const cleaned = rawFinalContent.replace(/```json\s*|```/g, "").trim()
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
