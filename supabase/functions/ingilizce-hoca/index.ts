// ==========================================================================
// Acadex English — Defne Hoca (supabase/functions/ingilizce-hoca), 05.11.2026
//
// ingilizce/assets/hoca.js'in yapay zekâ ucu. Hoca Acadex'in kendi karakteri;
// öğretmen, sınıf ya da ödev yok. Her istek çağıran öğrencinin JWT'siyle
// doğrulanır; veri tabanına hiçbir şey yazılmaz, yalnız değerlendirme döner.
//
// Modlar (body.mod) ve dönen JSON:
//   degerlendir {soru, metin, ornek, cevap}        → {sonuc, tepki_en, geri_tr}
//   kelime      {kelime, anlam, ornek, cevap}      → {sonuc, tepki_en, duzeltme, tr_not}
//   sohbet      {gecmis[], soru, cevap, tur, toplam} → {sonuc, tepki_en, duzeltme, tr_not, sonraki_soru}
//   yazi        {gorev, adim, onceki[], cumle}     → {sonuc, tepki_en, notlar:[{parca, not_tr, oneri}]}
//   nasil       {tr}                               → {oneriler:[{en, not_tr}]}
// sonuc her zaman 'dogru' | 'kismen' | 'yanlis'.
//
// İstemci bu fonksiyon yoksa (404) ya da 9 sn'de dönmezse yerel ölçüte düşer;
// yayınlamak zorunlu değil. Yayın: Supabase panelinden elle (CLAUDE.md §5),
// generate-exam'in kullandığı GROQ_API_KEY ile.
// ==========================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const kis = (s: unknown, n: number) => String(s ?? '').slice(0, n)

const KARAKTER = `You are "Defne Hoca", the English tutor character of Acadex, a study app for Turkish university students.
You are warm, direct and a little playful. You speak simple, natural English (B1–B2 level) and give short explanations in Turkish.
You are an app character, not a real teacher: never mention classes, homework submission, grades from a real teacher or contacting anyone.
Judge fairly: "dogru" = correct and complete, "kismen" = right idea but incomplete or with a clear language error, "yanlis" = wrong, off-topic or contradicts the text.
Always reply with ONLY one JSON object, no markdown.`

const ISTEM: Record<string, (b: any) => string> = {
  degerlendir: (b) => `Mode: reading comprehension check.
Text (may be empty): """${kis(b.metin, 2500)}"""
Question: ${kis(b.soru, 300)}
Model answer: ${kis(b.ornek, 300)}
Student answer: ${kis(b.cevap, 600)}
Decide if the student's answer matches the meaning of the model answer (wording can differ; spelling mistakes are fine).
Return {"sonuc":"dogru|kismen|yanlis","tepki_en":"one short spoken reaction, max 12 words","geri_tr":"one Turkish sentence: what is right or what is missing, max 25 words"}`,
  kelime: (b) => `Mode: vocabulary sentence check.
Target word: ${kis(b.kelime, 40)} (meaning in Turkish: ${kis(b.anlam, 80)})
Teacher's example (the student must not copy it): ${kis(b.ornek, 200)}
Student sentence: ${kis(b.cevap, 400)}
Check that the word is used with the right meaning and grammar.
Return {"sonuc":"dogru|kismen|yanlis","tepki_en":"short spoken reaction, max 12 words","duzeltme":"corrected sentence if needed, else empty","tr_not":"one Turkish sentence, max 25 words"}`,
  sohbet: (b) => `Mode: friendly IELTS Part 1/3 style speaking conversation, turn ${Number(b.tur) || 1} of ${Number(b.toplam) || 5}.
Conversation so far: ${JSON.stringify((Array.isArray(b.gecmis) ? b.gecmis : []).slice(-8).map((x: any) => ({ who: x?.rol === 'hoca' ? 'tutor' : 'student', text: kis(x?.metin, 400) })))}
Your last question: ${kis(b.soru, 300)}
Student's answer (speech-to-text, ignore punctuation): ${kis(b.cevap, 700)}
"dogru" = relevant, at least two sentences or a reason, no serious errors; "kismen" = relevant but too short or has a clear error; "yanlis" = off-topic or one or two words.
Return {"sonuc":"dogru|kismen|yanlis","tepki_en":"natural spoken reaction to what they said, max 15 words","duzeltme":"if there is a clear error: corrected version of the student's sentence, else empty","tr_not":"one Turkish tip, max 20 words","sonraki_soru":"your next question, short, related to their answer, max 20 words"}`,
  yazi: (b) => `Mode: writing a paragraph together, sentence by sentence.
Topic: ${kis(b.gorev, 200)}
This sentence should be the: ${kis(b.adim, 60)}
Sentences so far: ${JSON.stringify((Array.isArray(b.onceki) ? b.onceki : []).slice(0, 6).map((x: unknown) => kis(x, 300)))}
New sentence: ${kis(b.cumle, 500)}
Check grammar, word choice, and whether it does its job in the paragraph. At most 3 notes; "parca" must be an exact substring of the new sentence (or empty).
Return {"sonuc":"dogru|kismen|yanlis","tepki_en":"short spoken reaction, max 12 words","notlar":[{"parca":"…","not_tr":"Turkish explanation, max 20 words","oneri":"better English wording"}]}`,
  nasil: (b) => `Mode: the student asks how to say a Turkish phrase in academic English.
Turkish: ${kis(b.tr, 200)}
Return {"oneriler":[{"en":"natural English phrase","not_tr":"when to use it, max 10 Turkish words"}]} with 2 or 3 options.`,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return json({ error: 'Missing Authorization header' }, 401)
    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } })
    const { data: { user }, error } = await sb.auth.getUser()
    if (error || !user) return json({ error: 'Unauthorized user token' }, 401)

    const b = await req.json().catch(() => null)
    const istem = b && ISTEM[String(b.mod)]
    if (!istem) return json({ error: 'Unknown mod' }, 400)
    const key = Deno.env.get('GROQ_API_KEY')
    if (!key) return json({ error: 'Groq API key not configured' }, 500)

    const run = async (model: string) => {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0.3, max_completion_tokens: 700, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: KARAKTER }, { role: 'user', content: istem(b) }] }),
      })
      let d: any = null
      try { d = await r.json() } catch (_e) { d = null }
      return { r, d }
    }
    let { r, d } = await run('openai/gpt-oss-20b')
    if (!r.ok) { console.warn('ingilizce-hoca 20b:', r.status, JSON.stringify(d).slice(0, 300)); ({ r, d } = await run('openai/gpt-oss-120b')) }
    if (!r.ok) return json({ error: 'Model unavailable', status: r.status }, 502)
    let out: any = null
    try { out = JSON.parse(d?.choices?.[0]?.message?.content || '') } catch (_e) { out = null }
    if (!out || typeof out !== 'object') return json({ error: 'Unparseable' }, 502)
    if (b.mod !== 'nasil' && !/^(dogru|kismen|yanlis)$/.test(out.sonuc)) return json({ error: 'Bad verdict' }, 502)
    /* yalnız beklenen alanlar, kısaltılmış */
    const temiz: Record<string, unknown> = {}
    for (const k of ['sonuc', 'tepki_en', 'geri_tr', 'duzeltme', 'tr_not', 'sonraki_soru']) if (out[k] != null) temiz[k] = kis(out[k], 400)
    if (Array.isArray(out.notlar)) temiz.notlar = out.notlar.slice(0, 3).map((n: any) => ({ parca: kis(n?.parca, 120), not_tr: kis(n?.not_tr, 200), oneri: kis(n?.oneri, 200) }))
    if (Array.isArray(out.oneriler)) temiz.oneriler = out.oneriler.slice(0, 3).map((n: any) => ({ en: kis(n?.en, 120), not_tr: kis(n?.not_tr, 80) }))
    return json(temiz)
  } catch (e) {
    console.error('ingilizce-hoca:', e)
    return json({ error: 'Internal error' }, 500)
  }
})
