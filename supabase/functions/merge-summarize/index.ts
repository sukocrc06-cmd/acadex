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

    const { documentIds, summaryStyle, language } = await req.json()

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
      return new Response(JSON.stringify({ error: "documentIds must be an array of at least 2 IDs" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const style = (summaryStyle || "standard").toLowerCase()
    const lang = (language || "en").toLowerCase()
    console.log("merge-summarize: documentIds =", documentIds, "style =", style, "lang =", lang)

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
        return new Response(JSON.stringify({ error: "Failed to download: " + doc.file_name }), {
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
          const pdf = await getDocumentProxy(fileBytes)
          const { text } = await extractText(pdf, { mergePages: true })
          extractedText = text
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
        return new Response(JSON.stringify({ error: "Could not extract text from: " + doc.file_name }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      extractedText = extractedText.trim()
      if (!extractedText) {
        return new Response(JSON.stringify({ error: "No readable text in: " + doc.file_name }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      extractedSections.push({ fileName: doc.file_name, text: extractedText })
    }

    let combinedText = extractedSections
      .map(s => "=== DOCUMENT: " + s.fileName + " ===\n" + s.text)
      .join("\n\n")

    if (combinedText.length > 18000) {
      const truncated = combinedText.substring(0, 18000)
      const lastBoundary = Math.max(truncated.lastIndexOf(". "), truncated.lastIndexOf(".\n"), truncated.lastIndexOf("\n"))
      combinedText = lastBoundary > 14000 ? truncated.substring(0, lastBoundary + 1) : truncated
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

    const langLabel = lang === "tr" ? "Turkish / Turkce" : "English"
    const docNames = documents.map(d => d.file_name).join(", ")

    const systemPrompt = `You are an academic study assistant. You will be given combined text extracted from MULTIPLE student documents (${docNames}). Analyze all of them together and produce a UNIFIED study card that synthesizes the key information across all sources. Respond with ONLY a valid JSON object, no markdown code fences, no commentary before or after — just the raw JSON matching this exact shape: { "summary": string (4-8 sentences synthesizing all documents), "key_terms": [ { "term": string, "definition": string } ] (5-10 items from across all documents), "key_points": [ string ] (5-10 concise bullet points of the most important ideas across all documents), "quiz_questions": [ { "question": string, "answer": string } ] (4-6 questions covering material from multiple documents) }.

LANGUAGE INSTRUCTION:
Respond strictly in the language: '${langLabel}'. Write the ENTIRE response in that specified language, REGARDLESS of the language of the source text.

EXAM-FOCUSED CONTENT FILTERING:
Exclude administrative/logistical information (instructor names, office hours, grading policies, textbook ISBN, etc.). Focus on actual academic content.

STYLE-SPECIFIC INSTRUCTION:
${styleInstruction}`

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
      return new Response(JSON.stringify({ error: "Groq AI service error" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const rawContent = groqData.choices?.[0]?.message?.content ?? ""
    if (!rawContent) {
      return new Response(JSON.stringify({ error: "AI failed to generate a response" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const cleaned = rawContent.replace(/```json\s*|```/g, "").trim()
    let parsedContent
    try {
      parsedContent = JSON.parse(cleaned)
    } catch (parseError) {
      console.error("Failed to parse Groq JSON:", rawContent, parseError)
      return new Response(JSON.stringify({ error: "AI returned invalid JSON formatting" }), {
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
