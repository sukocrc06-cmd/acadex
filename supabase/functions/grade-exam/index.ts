import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const { examId, answers } = await req.json()
    if (!examId || !answers) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
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

    // Fetch user details from auth token
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch exam details to verify ownership
    const { data: exam, error: examError } = await userClient
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single()

    if (examError || !exam) {
      console.error("Exam ownership check failed: ", examError)
      return new Response(JSON.stringify({ error: 'Exam not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (exam.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Access denied: You do not own this exam' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const questions = exam.questions || []
    const language = exam.language || 'en'
    const isTr = language === 'tr'

    // Define intermediate results array
    const results = []
    const classicToGrade = []

    for (const q of questions) {
      const studentAns = (answers[q.id] || "").trim()
      const correctAns = (q.correct_answer || "").trim()

      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        const isCorrect = studentAns.toLowerCase() === correctAns.toLowerCase()
        results.push({
          question_id: q.id,
          type: q.type,
          question: q.question,
          options: q.options,
          concept: q.concept || null,
          student_answer: studentAns,
          correct_answer: correctAns,
          is_correct: isCorrect,
          score: isCorrect ? 100 : 0,
          feedback: isCorrect
            ? (isTr ? "Tebrikler, doğru cevap!" : "Correct! Good job!")
            : (isTr ? `Yanlış cevap. Doğru cevap: ${correctAns}` : `Incorrect. The correct answer is: ${correctAns}`)
        })
      }
      else if (q.type === 'fill_blank') {
        const isCorrect = studentAns.toLowerCase() === correctAns.toLowerCase()
        results.push({
          question_id: q.id,
          type: q.type,
          question: q.question,
          options: q.options,
          concept: q.concept || null,
          student_answer: studentAns,
          correct_answer: correctAns,
          is_correct: isCorrect,
          score: isCorrect ? 100 : 0,
          feedback: isCorrect
            ? (isTr ? "Tebrikler, boşluğu doğru tamamladınız!" : "Correct! Good job!")
            : (isTr ? `Yanlış cevap. Doğru cevap: ${correctAns}` : `Incorrect. The correct answer is: ${correctAns}`)
        })
      }
      else if (q.type === 'calculation') {
        const studentNum = parseFloat(studentAns.replace(/[^0-9.-]/g, ''))
        const correctNum = typeof q.correct_answer === 'number'
          ? q.correct_answer
          : parseFloat(String(q.correct_answer).replace(/[^0-9.-]/g, ''))
        
        const tolPercent = typeof q.tolerance_percent === 'number' ? q.tolerance_percent : 2
        const tolRatio = tolPercent / 100
        
        let isFullCorrect = false
        let isPartialCorrect = false
        
        if (!isNaN(studentNum) && !isNaN(correctNum)) {
          const diff = Math.abs(studentNum - correctNum)
          const margin = correctNum !== 0 ? Math.abs(correctNum) * tolRatio : tolRatio
          
          if (diff <= margin) {
            isFullCorrect = true
          } else if (diff <= margin * 2) {
            isPartialCorrect = true
          }
        }
        
        const score = isFullCorrect ? 100 : (isPartialCorrect ? 50 : 0)
        const isCorrect = isFullCorrect
        
        const unitSuffix = q.units ? ` ${q.units}` : ''
        let feedback = ''
        if (isFullCorrect) {
          feedback = isTr
            ? `Tebrikler! Hesaplamanız doğru (${studentAns}${unitSuffix}).`
            : `Correct! Excellent calculation (${studentAns}${unitSuffix}).`
        } else if (isPartialCorrect) {
          feedback = isTr
            ? `Kısmi Doğru! Cevabınız (${studentAns}${unitSuffix}) kabul edilebilir tolerans aralığında (${correctNum}${unitSuffix} ±${tolPercent}%).`
            : `Close! Your answer (${studentAns}${unitSuffix}) is within partial credit tolerance (${correctNum}${unitSuffix} ±${tolPercent}%).`
        } else {
          feedback = isTr
            ? `Yanlış cevap (${studentAns || '-'}${unitSuffix}). Doğru cevap: ${correctNum}${unitSuffix} (±${tolPercent}% tolerans).`
            : `Incorrect calculation (${studentAns || '-'}${unitSuffix}). Correct answer: ${correctNum}${unitSuffix} (±${tolPercent}% margin).`
        }

        results.push({
          question_id: q.id,
          type: q.type,
          question: q.question,
          options: null,
          concept: q.concept || null,
          student_answer: studentAns,
          correct_answer: correctNum,
          units: q.units || null,
          tolerance_percent: tolPercent,
          solution_steps: q.solution_steps || [],
          is_correct: isCorrect,
          score: score,
          feedback: feedback
        })
      }
      else if (q.type === 'open_ended') {
        if (!studentAns) {
          results.push({
            question_id: q.id,
            type: q.type,
            question: q.question,
            options: null,
            concept: q.concept || null,
            student_answer: "",
            correct_answer: correctAns,
            is_correct: false,
            score: 0,
            feedback: isTr ? "Bu soruya herhangi bir cevap verilmedi." : "No answer was provided for this question."
          })
        } else {
          // Store it to be graded by Groq in a batched call
          classicToGrade.push({
            id: q.id,
            question: q.question,
            correct_answer: correctAns,
            student_answer: studentAns,
            concept: q.concept || null
          })
        }
      }
    }

    // Call Groq to grade classic open-ended questions in batch if any exist
    if (classicToGrade.length > 0) {
      const groqApiKey = Deno.env.get('GROQ_API_KEY')
      if (!groqApiKey) {
        return new Response(JSON.stringify({ error: 'Groq API key not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const gradingSysPrompt = `
You are an academic grader. You will be given a list of open-ended questions, their correct/sample reference answers, and the student's submitted answers.
Your task is to grade each answer out of 100 based on accuracy, depth, and relevance.
Write the grading feedback strictly in the requested language: '${language}' (en = English, tr = Turkish).

RESPONSE FORMAT:
You must respond with ONLY a valid JSON array of objects, with no markdown code fences (do NOT use \`\`\`json or similar), no introductory or concluding text, and no conversational commentary.
The array must contain exactly ${classicToGrade.length} objects matching this JSON schema:
[
  {
    "question_id": number,
    "score": number (0 to 100),
    "feedback": "string (a short 1-2 sentence explanation of why they received this score and what was correct or missing)"
  }
]
      `.trim()

      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
            { role: "system", content: gradingSysPrompt },
            { role: "user", content: JSON.stringify(classicToGrade) }
          ]
        })
      })

      const groqData = await groqResponse.json()
      if (!groqResponse.ok) {
        console.error("Groq AI grading failed: ", groqData)
        return new Response(JSON.stringify({ error: 'AI grading service failed' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const rawContent = groqData.choices?.[0]?.message?.content ?? ""
      const cleaned = rawContent.replace(/```json\s*|```/g, "").trim()

      let gradesArray
      try {
        gradesArray = JSON.parse(cleaned)
      } catch (e) {
        console.error("Failed to parse Groq grading response as JSON: ", rawContent, e)
        return new Response(JSON.stringify({ error: 'AI returned invalid grading formatting. Please try again.' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Merge grades back into results
      for (const gradeItem of gradesArray) {
        const matchingQ = classicToGrade.find(item => item.id === gradeItem.question_id)
        if (matchingQ) {
          results.push({
            question_id: matchingQ.id,
            type: 'open_ended',
            question: matchingQ.question,
            options: null,
            concept: matchingQ.concept || null,
            student_answer: matchingQ.student_answer,
            correct_answer: matchingQ.correct_answer,
            is_correct: gradeItem.score >= 50,
            score: gradeItem.score,
            feedback: gradeItem.feedback
          })
        }
      }
    }

    // Sort results by question_id to match original order
    results.sort((a, b) => a.question_id - b.question_id)

    // Calculate final grade
    const totalScoreSum = results.reduce((sum, item) => sum + item.score, 0)
    const finalGrade = Math.round(totalScoreSum / questions.length)

    // Service role client to save results and update completed status
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: updatedExam, error: updateError } = await serviceClient
      .from('exams')
      .update({
        answers: answers,
        question_results: results,
        grade: finalGrade,
        completed_at: new Date().toISOString()
      })
      .eq('id', examId)
      .select()
      .single()

    if (updateError || !updatedExam) {
      console.error("Failed to update graded exam record: ", updateError)
      return new Response(JSON.stringify({ error: 'Failed to save exam results' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify(updatedExam), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error("grade-exam exception: ", err)
    return new Response(JSON.stringify({ error: 'Internal server error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
