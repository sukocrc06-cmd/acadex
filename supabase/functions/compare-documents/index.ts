import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"
import { getDocumentProxy, extractText } from "https://esm.sh/unpdf@0.12.1"
import mammoth from "https://esm.sh/mammoth@1.7.2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      if (attempt >= maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error("Max retries reached");
}

// openai/gpt-oss-120b (the replacement for the retired llama-3.3-70b-versatile
// below) is a reasoning model and can prefix its answer with a <think>...</think>
// block even with reasoning_effort set low — strip it before JSON.parse so a
// leftover reasoning trace doesn't break parsing.
function stripThinkBlock(raw: string): string | null {
  const match = raw.match(/<think>[\s\S]*?<\/think>/i)
  if (match) return raw.slice((match.index ?? 0) + match[0].length).trim()
  if (/^\s*<think>/i.test(raw)) return null
  return raw
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: 'Groq API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { documentIds, language } = await req.json()

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
      return new Response(JSON.stringify({ error: 'Select at least 2 documents to compare' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
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

    const { data: documents, error: docError } = await userClient
      .from('documents')
      .select('*')
      .in('id', documentIds)

    if (docError || !documents || documents.length < documentIds.length) {
      return new Response(JSON.stringify({ error: 'One or more documents were not found or access was denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Download & extract text from all documents
    const docTextBlocks: string[] = []
    const documentNames: string[] = []

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]
      documentNames.push(doc.file_name)

      const { data: fileBlob, error: downloadError } = await serviceClient.storage
        .from('documents')
        .download(doc.storage_path)

      if (downloadError || !fileBlob) {
        console.error(`Failed to download ${doc.file_name}:`, downloadError)
        continue
      }

      const arrayBuffer = await fileBlob.arrayBuffer()
      const fileBytes = new Uint8Array(arrayBuffer)
      let extractedText = ""
      const mimeType = doc.mime_type?.toLowerCase() || ""

      try {
        if (mimeType === "text/plain") {
          extractedText = new TextDecoder("utf-8").decode(fileBytes)
        } else if (mimeType === "application/pdf") {
          try {
            const pdf = await getDocumentProxy(fileBytes)
            const { text } = await extractText(pdf, { mergePages: true })
            extractedText = text
          } catch (pdfErr) {
            console.error(`PDF extraction error for ${doc.file_name}:`, pdfErr)
          }
        } else if (
          mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          mimeType === "application/msword"
        ) {
          const result = await mammoth.extractRawText({ arrayBuffer })
          extractedText = result.value
        }
      } catch (err) {
        console.error(`Text extraction failed for ${doc.file_name}:`, err)
      }

      if (!extractedText.trim()) {
        extractedText = `[Document ${doc.file_name} content could not be extracted as plain text]`
      } else if (extractedText.length > 20000) {
        extractedText = extractedText.substring(0, 20000) + " [truncated]"
      }

      docTextBlocks.push(`=== DOCUMENT ${i + 1}: ${doc.file_name} ===\n${extractedText}`)
    }

    const combinedText = docTextBlocks.join("\n\n")
    const targetLang = (language === 'tr' || language === 'tr-TR') ? 'Turkish / Türkçe' : 'English'

    const systemPrompt = `You are an academic comparison assistant. You will be given text extracted from multiple documents. Compare them thoroughly and synthesize their relationship. Respond with ONLY a valid JSON object matching this exact shape: { "comparison_summary": string, "similarities": [ string ], "differences": [ { "aspect": string, "comparison": string } ] }.

COMPARISON INSTRUCTIONS:
1. "comparison_summary": a brief 2-4 sentence overview framing what documents are being compared, their primary themes, and why the comparison matters.
2. "similarities": an array of strings describing core concepts, findings, methodologies, or topics that the documents share in common.
3. "differences": an array of objects, each { "aspect": string, "comparison": string } detailing how the documents contrast on specific dimensions (e.g. aspect: "Methodology", comparison: "Document A uses quantitative surveys while Document B relies on qualitative case studies").

Respond strictly in the language: '${targetLang}'. Base everything strictly on the provided content without inventing details.`

    const groqResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // llama-3.3-70b-versatile was retired by Groq on 2026-08-16 (calls
        // now fail with a decommissioned-model error) — openai/gpt-oss-120b
        // is Groq's recommended replacement, already adopted by
        // summarize-document. This function was silently broken since the
        // retirement date until this fix.
        model: "openai/gpt-oss-120b",
        temperature: 0.3,
        reasoning_effort: "low",
        include_reasoning: false,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: combinedText }
        ]
      })
    })

    const groqData = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error("Groq comparison call failed:", JSON.stringify(groqData))
      return new Response(JSON.stringify({ error: 'AI comparison service failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const rawContent = groqData.choices?.[0]?.message?.content ?? ""
    const stripped = stripThinkBlock(rawContent)
    if (stripped === null) {
      console.error('Groq comparison response was an unterminated <think> block')
      return new Response(JSON.stringify({ error: 'The AI ran out of thinking time — please try again' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const cleaned = stripped.replace(/```json\s*|```/g, "").trim()
    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseError) {
      console.error("Failed to parse Groq comparison JSON:", rawContent, parseError)
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON formatting' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = documents[0].user_id

    const { data: newComparison, error: insertError } = await serviceClient
      .from('document_comparisons')
      .insert({
        user_id: userId,
        document_ids: documentIds,
        document_names: documentNames,
        comparison_summary: parsed.comparison_summary || '',
        similarities: parsed.similarities || [],
        differences: parsed.differences || [],
        language: language || 'en'
      })
      .select('*')
      .single()

    if (insertError) {
      console.error("Failed to save document comparison:", insertError)
      return new Response(JSON.stringify({ error: 'Failed to save document comparison' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify(newComparison), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error("Exception in compare-documents:", err)
    return new Response(JSON.stringify({ error: 'Comparison request failed due to an unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
