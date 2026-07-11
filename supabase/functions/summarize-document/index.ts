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

    const { documentId, summaryStyle, language } = await req.json()
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'documentId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const style = (summaryStyle || 'standard').toLowerCase()
    const lang = (language || 'en').toLowerCase()

    console.log("RECEIVED Edge Function parameters: documentId =", documentId, "summaryStyle =", summaryStyle, "language =", language, "mapped lang =", lang);

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
      return new Response(JSON.stringify({ error: 'Failed to download document from storage' }), {
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
        const pdf = await getDocumentProxy(fileBytes)
        const { text } = await extractText(pdf, { mergePages: true })
        extractedText = text
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
    } catch (extractionError) {
      console.error("Text extraction failed: ", extractionError)
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: "Could not extract readable text from this file." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate extracted text content
    extractedText = extractedText.trim()
    if (!extractedText) {
      console.error("Extracted text is empty or blank")
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: "Could not extract readable text from this file." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Truncate to first 15,000 characters if too long, snapping to sentence/paragraph boundary
    let textToSend = extractedText
    if (textToSend.length > 15000) {
      const truncated = textToSend.substring(0, 15000)
      const lastBoundary = Math.max(
        truncated.lastIndexOf(". "),
        truncated.lastIndexOf(".\n"),
        truncated.lastIndexOf("\n")
      )
      if (lastBoundary > 12000) {
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

    // Select style instruction
    let styleInstruction = "Write the summary as a clear, well-balanced paragraph-style overview."
    if (style === 'bullet') {
      styleInstruction = "Write the summary primarily as a series of short, scannable bullet points rather than flowing prose (you may still return it as a single string with bullet characters and line breaks)."
    } else if (style === 'outline') {
      styleInstruction = "Write the summary as a hierarchical outline with clear section headings and indented sub-points, mirroring the structure of the source document."
    } else if (style === 'simplified') {
      styleInstruction = "Write the summary in simple, plain language suitable for someone new to the topic, avoiding jargon or clearly defining any technical terms used. Also phrase the key_terms definitions as simply as possible."
    } else if (style === 'exam_focused') {
      styleInstruction = "Write a concise, fact-dense summary emphasizing definitions, relationships, and facts most likely to appear on an exam. Prioritize precision over narrative flow. Also generate slightly more challenging quiz_questions than usual, focused on application and recall rather than simple recognition."
    }

    const langLabel = lang === 'tr' ? 'Turkish / Türkçe' : 'English'

    const systemPrompt = `You are an academic study assistant. You will be given the raw text extracted from a student's uploaded document (lecture slides, article, or syllabus). Analyze it and respond with ONLY a valid JSON object, no markdown code fences, no commentary before or after — just the raw JSON object matching this exact shape: { "summary": string (4-8 sentences, clear and well-structured), "key_terms": [ { "term": string, "definition": string } ] (5-10 items), "key_points": [ string ] (5-10 concise bullet points of the most important ideas), "quiz_questions": [ { "question": string, "answer": string } ] (4-6 self-test questions with answers covering the material) }.

LANGUAGE INSTRUCTION:
Respond strictly in the language: '${langLabel}'. Write the ENTIRE response (the summary, all key_terms terms and definitions, all key_points, and all quiz_questions questions and answers) in that specified language, REGARDLESS of the language of the source text. If the source document is in Turkish but the target language is English, translate and write in English. If the source document is in English but the target language is Turkish, translate and write in Turkish.

EXAM-FOCUSED CONTENT FILTERING:
Before summarizing, identify and EXCLUDE administrative/logistical information that would not appear on an exam, such as: instructor names, contact information, office hours, course policies, attendance rules, grading weight breakdowns (e.g. 'midterm 30%, final 40%'), textbook edition/publisher/ISBN details, and general syllabus housekeeping. Focus exclusively on the actual academic subject matter: concepts, theories, definitions, processes, relationships, examples, and any content a student would need to understand or recall for an exam. If the source document is primarily a syllabus with little actual academic content, note this clearly in the summary rather than padding it with logistics.

PROFESSIONAL TONE INSTRUCTION:
Write in a clear, formal academic register. Avoid filler phrases, redundant restatements, and vague generalities. Use precise terminology appropriate to the subject matter. Prefer concrete, specific statements over vague ones.

STYLE-SPECIFIC INSTRUCTION:
${styleInstruction}`

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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

    const groqData = await groqResponse.json()

    if (!groqResponse.ok) {
      console.error("Groq API call failed: ", JSON.stringify(groqData))
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'Groq AI service error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const rawContent = groqData.choices?.[0]?.message?.content ?? ""
    if (!rawContent) {
      console.error('Empty response content from Groq: ', JSON.stringify(groqData))
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'AI failed to generate a response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==========================================================================
    // STEP 3 — PARSE THE RESPONSE (defensive parsing)
    // ==========================================================================
    const cleaned = rawContent.replace(/```json\s*|```/g, "").trim()
    let parsedContent
    try {
      parsedContent = JSON.parse(cleaned)
    } catch (parseError) {
      console.error("Failed to parse Groq response as JSON: ", rawContent, parseError)
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON formatting' }), {
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
        summary_style: style,
        summary_language: lang,
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

    // Update document status to summarized
    await serviceClient
      .from('documents')
      .update({ status: 'summarized' })
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
      .update({ status: 'failed' })
      .eq('id', documentId)
  } catch (e) {
    console.error('Failed to set document status to failed: ', e)
  }
}
