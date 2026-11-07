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
//   icerik      {tur, alt}                         → {id, veri, kaynak:'havuz'|'yeni'}  (deste: alt = A1–C2 seviye)
//   sozluk      {kelime}                           → {veri:{kelime, okunus, tur, anlam_tr, ornek}}
//   sinav       {seviye, cevaplar[]}               → {kriterler, ozet_tr, duzeltmeler[]}  (07.11.2026, speaking sınavı)
//   sinav_model {seviye, bolum, soru, cevap, sn}   → {model_en, notlar[]}                  (07.11.2026, model cevap)
//   etkinlik    {tip, seviye, kategori, …}         → {yanit_en} | {tahmin}                  (07.11.2026, konuşma atölyesi)
//   icerik tur 'konusma', alt 'etkinlik:kategori:seviye' (A1–C2) → atölye içeriği
// sonuc (ilk dört modda) her zaman 'dogru' | 'kismen' | 'yanlis'.
//
// İçerik havuzu (05.11.2026, migrations/20261105_ingilizce_icerik_havuzu.sql):
// önce ing_icerik_al() ile çağıranın görmediği hazır içerik verilir; yoksa Groq
// yenisini üretir, şekli doğrulanır, service role ile havuza yazılır. Öğrenci
// başına günde en çok GUNLUK_URETIM yeni üretim (ücretsiz katman kotası).
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


/* ---------------- içerik havuzu ---------------- */
const GUNLUK_URETIM = 30
const KONU = ['campus food', 'sleep and memory', 'part-time jobs', 'social media habits', 'learning languages', 'city transport', 'climate and cities', 'online shopping', 'friendship at university', 'music and focus', 'coffee culture', 'remote work', 'exam stress', 'volunteering', 'sports and health', 'artificial intelligence in daily life', 'saving money as a student', 'travel on a budget', 'libraries today', 'street food around the world', 'smartphones and attention', 'renting a flat', 'public speaking', 'team projects', 'internships', 'museums', 'recycling', 'video games and learning', 'walking cities', 'tea and coffee history', 'digital privacy', 'electric scooters', 'night owls and early birds', 'second-hand clothes', 'podcasts', 'cooking at home', 'noise and concentration', 'gap years', 'board games', 'urban gardens']
const rastgele = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const harfler = () => Array.from({ length: 3 }, () => rastgele('abcdefghilmnoprstw'.split(''))).join(', ')
const TEST: Record<string, string> = {
  'writing:hata': '5 items. "soru": an English sentence with exactly ONE common grammar error made by Turkish learners, the wrong part wrapped in <u></u>. "sec": the same sentence split into 4 consecutive segments. "d": index of the segment with the error. "neden": Turkish explanation with the correct form in <b></b>.',
  'writing:baglac': '5 items. "soru": one or two sentences with a blank "____" for a linking word. "sec": 4 linkers (one correct). "yan": true. "neden": Turkish, why.',
  'listening:sayi': '5 items. "dinle": an English sentence containing a time, date, price, number or room code. "soru": a Turkish question about it. "sec": 4 close options written as numbers (e.g. 09:45, £8.50, 13 Mart, B204). "yan": true. "neden": Turkish.',
  'listening:cift': '5 items. "dinle": a short sentence containing one word of an English minimal pair (ship/sheep, live/leave, full/fool, bad/bed, walk/work, thirty/thirteen …). "soru": "Hangi kelime?". "sec": the 2 words. "yan": true. "neden": Turkish note on the sound.',
  'listening:diyalog': '3 items about ONE dialogue. Every item has the same "dinle": a 5-7 line dialogue (about 90 words) at a campus office or service, lines start with "Student:" / "Officer:" or similar. "soru": Turkish question. "sec": 4 Turkish options. "neden": Turkish with the English evidence in <b></b>.',
  'reading:anafikir': '3 items. "ust": "paragraf 1", "paragraf 2", "paragraf 3". "soru": "<i>" + an English paragraph of 50-70 words + "</i>" (three different topics). "sec": 4 Turkish options, one is the main idea, others are details or wrong. "neden": Turkish.',
  'reading:tfng': 'Also return "parca": an English passage of 70-90 words. 4 items: "soru": a statement about the passage. "sec": ["True","False","Not Given"]. "yan": true. Use each answer at least once. "neden": Turkish with evidence.',
  'reading:baglam': '5 items. "soru": an English sentence where one less common word is in <b></b> and the context makes its meaning clear. "sec": 4 Turkish meanings. "yan": true. "neden": Turkish, which clue in the sentence.',
  'vocab:kalip': '5 items. "soru": a sentence with "____" for a verb in a collocation (make/do/take/have/give/pay/catch …). "sec": 4 verbs. "yan": true. "neden": Turkish with the collocation in <b></b>.',
  'vocab:aile': '5 items. "soru": a sentence with "____". "sec": 4 forms of the same word family (noun/verb/adjective/adverb). "yan": true. "neden": Turkish, which form and why.',
  'vocab:es': '5 items. "soru": a sentence with an informal word or phrase in <b></b>. "sec": 4 more academic alternatives, one fits best. "yan": true. "neden": Turkish.',
  'speaking:vurgu': '5 items. "soru": "<b>word</b>" (add "(isim)" or "(fiil)" when stress changes with the part of speech). "dinle": the word or a short sentence with it. "sec": 3 or 4 spellings with the stressed syllable in capitals, e.g. "pho-TO-gra-pher". "neden": Turkish.',
  'speaking:gecis': '5 items. "soru": a Turkish description of a moment in a speaking exam (need time, did not understand, forgot a word, changing topic, finishing). "sec": 4 English phrases, one natural and polite. "neden": Turkish.',
}
/* speaking sınav simülatörü (assets/sinav.js): seviye:bölüm */
const SINAV_ALT: Record<string, string> = {
  'kolay:isinma': 'Preparatory-school placement interview, warm-up. Return {"sorular":[4 short, friendly personal questions (A2-B1) about daily life, hometown, studies or hobbies]}',
  'kolay:gorus': 'Preparatory-school placement interview, opinion part (B1). Return {"sorular":[3 x {"soru":"a simple opinion question about student or daily life","takip":"one short follow-up question that pushes for a reason or the other side"}]}',
  'orta:part1': 'IELTS-style Part 1. Return {"konu":"a familiar everyday topic, 1-3 words, e.g. your hometown","sorular":[4 short personal questions on that topic, from present to past/future]}',
  'orta:part2': 'IELTS-style Part 2 cue card and Part 3. Return {"kart":"Describe … (one sentence)","maddeler":["4 prompts; the last starts with \"and explain\""],"kapanis":"one short rounding-off question","part3":[4 abstract discussion questions related to the card, getting deeper]}',
  'zor:tekrar': 'TOEFL-style Listen and Repeat. Return {"baglam":"a campus situation, 2-4 words, e.g. a library orientation","cumleler":[7 sentences an announcer could say in that situation; sentence 1 has 3-4 words and each next one is longer; sentence 7 has 13-16 words]}',
  'zor:mulakat': 'TOEFL-style academic interview (a researcher interviews a student, no preparation time). Return {"konu":"study topic, 2-3 words","sorular":[4 questions; the first welcomes the student and asks about personal experience, then opinion, then a debatable issue, then a hypothetical or future question]}',
}
/* konuşma atölyesi (assets/konusma.js): etkinlik:kategori:seviye */
const KONUSMA_KAT: Record<string, string> = { spor: 'sport', kultur: 'culture and the arts', egitim: 'education', bilim: 'science and physics', teknoloji: 'technology', saglik: 'health and lifestyle', cevre: 'the environment and nature', is: 'work and money', seyahat: 'travel', yemek: 'food and cooking', medya: 'media and social media', psikoloji: 'psychology and relationships', toplum: 'history and society', sehir: 'cities and homes' }
const KONUSMA_RE = /^(dakika|munazara|taboo|rol|grafik|hikaye|roportaj):([a-z]+):(A1|A2|B1|B2|C1|C2)$/
const KONUSMA_SEV: Record<string, string> = { A1: 'CEFR A1: very simple words, present tense, short sentences', A2: 'CEFR A2: everyday vocabulary, simple past and future', B1: 'CEFR B1: familiar topics, opinions with reasons', B2: 'CEFR B2: abstract topics, pros and cons, wider vocabulary', C1: 'CEFR C1: complex, nuanced topics and sophisticated vocabulary', C2: 'CEFR C2: highly abstract, academic and philosophical depth' }
const konusmaAlt = (alt: string) => { const m = KONUSMA_RE.exec(alt); return m && KONUSMA_KAT[m[2]] ? { etk: m[1], kat: KONUSMA_KAT[m[2]], sev: m[3] } : null }
const KONUSMA_URET: Record<string, string> = {
  dakika: 'A speaking topic for a one-minute talk. Return {"baslik":"short English title","tr":"Turkish title","soru":"one open question to talk about","kelimeler":[6 useful English words for this topic at this level]}',
  munazara: 'A debate statement. Return {"iddia":"one clear, debatable statement","tr":"Turkish translation","lehte":[2 short arguments for],"aleyhte":[2 short arguments against]}',
  taboo: 'Taboo cards. Return {"kartlar":[5 x {"kelime":"a word or short phrase students at this level know","yasak":[4 words most people would use to describe it]}]}',
  rol: 'A role-play for a student and an app tutor. Return {"baslik":"short English title","tr":"Turkish title","sen":"the student’s role and situation, one sentence","sen_tr":"Turkish translation","hoca":"the tutor’s role, 2-4 words","acilis":"the tutor’s first line","replikler":[5 natural next lines of the tutor, in a plausible order],"hedefler":[3 x ["Turkish task for the student, short",[4-6 lowercase English keywords or short phrases that show the task was done]]],"kaliplar":[4 useful English phrases for the student]}',
  grafik: 'A chart template (numbers are generated later). Return {"baslik":"chart title","birim":"unit, e.g. % or hours","tip":"sutun or cizgi","etiketler":[4-7 short category or time labels],"aralik":[minimum value, maximum value],"egilim":"artis, azalis or karisik"}',
  hikaye: 'A story opening. Return {"bas":"one or two sentences that start an intriguing story"}',
  roportaj: 'An expert persona for an interview where the student asks the questions. Return {"kim":"the expert, e.g. a beekeeper","kim_tr":"Turkish","giris":"a friendly first-person greeting with name and job","cevaplar":[6 x [[3-5 lowercase keywords of a likely question],"a short first-person answer"]],"genel":"a polite answer for unexpected questions"}',
}
const URET: Record<string, (alt: string, sev: string) => string> = {
  okuma: (_a, sev) => `Write an original ${sev} reading text for Turkish university students about "${rastgele(KONU)}" (a specific, surprising angle).
Return {"baslik":"title","paragraflar":["3 paragraphs, 45-70 words each"],"sorular":[5 x {"soru_en":"open question","soru_tr":"Turkish translation","paragraf":0-2,"fosfor":"exact phrase of 3-8 words copied from that paragraph that contains the answer","ornek":"short model answer","anahtar":[{"ad_tr":"Turkish label of a key idea","kelimeler":["5-8 lowercase English words or stems a correct answer would contain, with synonyms"]}],"ipucu":["3 Turkish hints, each more specific; the third nearly gives the answer"]}]}
Use 1-2 "anahtar" groups per question; every group is required for a fully correct answer.`,
  dikte: (_a, sev) => `Return {"cumleler":[4 natural ${sev} English sentences of 8-14 words about "${rastgele(KONU)}" and campus life; at least one contains a number, time or date]}.`,
  kelime: (_a, sev) => `Choose 5 useful academic words (${sev}) starting with these letters: ${harfler()}, ${harfler()}.
Return {"kelimeler":[5 x {"kelime":"word","anlam_tr":"Turkish meaning","ornek":"teacher's example sentence","ipucu":["Turkish: the pattern or collocation","Turkish: an idea for the student's own sentence","Turkish: a sentence skeleton with blanks"]}]}`,
  deste: (_a, sev) => `Choose 10 useful ${sev.length === 2 ? 'CEFR ' + sev + ' level' : sev} words (avoid the most common ones at that level) starting with these letters: ${harfler()}, ${harfler()}, ${harfler()}.
Return {"kelimeler":[10 x {"kelime":"word","okunus":"/IPA/","tur":"noun|verb|adj|adv","anlam_tr":"Turkish meaning","ornek":"natural example sentence"}]}`,
  sohbet: () => `Theme: "${rastgele(KONU)}". Return {"sorular":[5 friendly IELTS Part 1 then Part 3 style questions, short, from easy to deeper],"ipucu":[5 Turkish tips, each with an English sentence starter in quotes]}`,
  konusma: (alt) => { const k = konusmaAlt(alt)!; return `Original speaking-practice material for Turkish university students. Category: ${k.kat}. Level: ${KONUSMA_SEV[k.sev]}. Be specific and surprising; avoid the most obvious topic. Theme flavour: "${rastgele(KONU)}".
${KONUSMA_URET[k.etk]}` },
  sinav: (alt) => `Original speaking exam material (do not copy any official test). Theme flavour: "${rastgele(KONU)}".
${SINAV_ALT[alt]}`,
  yazi_konu: () => `Return {"konular":[3 short opinion questions for a one-paragraph student essay, each about a different everyday topic like "${rastgele(KONU)}"]}`,
  test: (alt) => `Create a multiple-choice exercise for Turkish university students (B1-B2). Topic flavour: "${rastgele(KONU)}".
${TEST[alt]}
Return {"sorular":[{"soru":"…","sec":["…"],"d":0,"neden":"…"}]${alt === 'reading:tfng' ? ',"parca":"…"' : ''}}. Only <b>, <i>, <u> tags are allowed. Vary the position of the correct option.`,
}
const metin = (x: unknown, n = 600) => typeof x === 'string' && x.trim().length > 0 && x.length <= n
const dizi = (x: unknown, min: number, max = 20) => Array.isArray(x) && x.length >= min && x.length <= max
const DOGRULA: Record<string, (v: any, alt: string) => boolean> = {
  okuma: (v) => metin(v.baslik, 120) && dizi(v.paragraflar, 3, 3) && v.paragraflar.every((p: unknown) => metin(p, 700)) && dizi(v.sorular, 4, 6) && v.sorular.every((q: any) => metin(q.soru_en, 200) && metin(q.ornek, 300) && dizi(q.anahtar, 1, 3) && q.anahtar.every((a: any) => metin(a.ad_tr, 80) && dizi(a.kelimeler, 1, 12)) && dizi(q.ipucu, 3, 3)),
  dikte: (v) => dizi(v.cumleler, 4, 6) && v.cumleler.every((c: unknown) => metin(c, 160)),
  kelime: (v) => dizi(v.kelimeler, 5, 6) && v.kelimeler.every((k: any) => metin(k.kelime, 30) && metin(k.anlam_tr, 80) && metin(k.ornek, 200) && dizi(k.ipucu, 3, 3)),
  deste: (v) => dizi(v.kelimeler, 8, 12) && v.kelimeler.every((k: any) => metin(k.kelime, 30) && metin(k.anlam_tr, 80) && metin(k.ornek, 200)),
  sohbet: (v) => dizi(v.sorular, 5, 6) && v.sorular.every((q: unknown) => metin(q, 200)) && dizi(v.ipucu, 5, 6),
  sinav: (v, alt) => alt === 'kolay:isinma' ? dizi(v.sorular, 3, 6) && v.sorular.every((q: unknown) => metin(q, 160))
    : alt === 'kolay:gorus' ? dizi(v.sorular, 1, 4) && v.sorular.every((q: any) => metin(q.soru, 200) && metin(q.takip, 200))
    : alt === 'orta:part1' ? metin(v.konu, 40) && dizi(v.sorular, 4, 5) && v.sorular.every((q: unknown) => metin(q, 200))
    : alt === 'orta:part2' ? metin(v.kart, 160) && dizi(v.maddeler, 4, 4) && v.maddeler.every((q: unknown) => metin(q, 120)) && metin(v.kapanis, 160) && dizi(v.part3, 4, 5) && v.part3.every((q: unknown) => metin(q, 200))
    : alt === 'zor:tekrar' ? metin(v.baglam, 60) && dizi(v.cumleler, 7, 7) && v.cumleler.every((c: unknown) => metin(c, 140))
    : alt === 'zor:mulakat' ? metin(v.konu, 60) && dizi(v.sorular, 4, 4) && v.sorular.every((q: unknown) => metin(q, 260))
    : false,
  konusma: (v, alt) => {
    const k = konusmaAlt(alt); if (!k) return false
    const str = (x: unknown, n = 300) => metin(x, n), strs = (x: unknown, a: number, b: number, n = 200) => dizi(x, a, b) && (x as unknown[]).every((y) => metin(y, n))
    if (k.etk === 'dakika') return str(v.baslik, 100) && str(v.soru, 240) && strs(v.kelimeler, 4, 10, 40)
    if (k.etk === 'munazara') return str(v.iddia, 200) && strs(v.lehte, 2, 4) && strs(v.aleyhte, 2, 4)
    if (k.etk === 'taboo') return dizi(v.kartlar, 3, 8) && v.kartlar.every((c: any) => metin(c.kelime, 40) && strs(c.yasak, 3, 5, 30))
    if (k.etk === 'rol') return str(v.sen, 240) && str(v.hoca, 60) && str(v.acilis, 240) && strs(v.replikler, 3, 7, 240) && dizi(v.hedefler, 2, 4) && v.hedefler.every((h: any) => Array.isArray(h) && metin(h[0], 80) && strs(h[1], 2, 8, 40)) && strs(v.kaliplar, 2, 6, 120)
    if (k.etk === 'grafik') return str(v.baslik, 120) && str(v.birim, 30) && strs(v.etiketler, 3, 8, 20) && dizi(v.aralik, 2, 2) && isFinite(+v.aralik[0]) && isFinite(+v.aralik[1]) && +v.aralik[1] > +v.aralik[0]
    if (k.etk === 'hikaye') return str(v.bas, 300)
    if (k.etk === 'roportaj') return str(v.kim, 60) && str(v.giris, 300) && dizi(v.cevaplar, 3, 8) && v.cevaplar.every((c: any) => Array.isArray(c) && strs(c[0], 1, 6, 30) && metin(c[1], 300)) && str(v.genel, 300)
    return false
  },
  yazi_konu: (v) => dizi(v.konular, 3, 5) && v.konular.every((q: unknown) => metin(q, 160)),
  test: (v, alt) => dizi(v.sorular, 3, 6) && v.sorular.every((q: any) => metin(q.soru, 900) && dizi(q.sec, 2, 5) && q.sec.every((x: unknown) => metin(x, 200)) && Number.isInteger(q.d) && q.d >= 0 && q.d < q.sec.length && metin(q.neden, 500)) && (alt !== 'reading:tfng' || metin(v.parca, 900)),
}
async function groqJson(key: string, sistem: string, istem: string, tok = 2400, temp = 0.9) {
  const run = async (model: string) => {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, temperature: temp, max_completion_tokens: tok, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sistem }, { role: 'user', content: istem }] }) })
    let d: any = null; try { d = await r.json() } catch (_e) { d = null }
    return { r, d }
  }
  let { r, d } = await run('openai/gpt-oss-120b')
  if (!r.ok) ({ r, d } = await run('openai/gpt-oss-20b'))
  if (!r.ok) return null
  try { return JSON.parse(d?.choices?.[0]?.message?.content || '') } catch (_e) { return null }
}
const URETICI = `You write original English-learning material for Acadex, a study app for Turkish university students. Natural, modern, inclusive English; no real people, brands or copyrighted text. Always reply with ONLY one JSON object.`
async function gunlukDoldu(admin: any, uid: string) {
  const { count } = await admin.from('ing_icerik').select('id', { count: 'exact', head: true }).eq('olusturan', uid).gte('created_at', new Date(Date.now() - 864e5).toISOString())
  return (count ?? 0) >= GUNLUK_URETIM
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
    if (b && (b.mod === 'icerik' || b.mod === 'sozluk')) return await icerik(b, sb, user.id)
    if (b && b.mod === 'sinav') return await sinavPuan(b)
    if (b && b.mod === 'sinav_model') return await sinavModel(b)
    if (b && b.mod === 'etkinlik') return await etkinlikTur(b)
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

async function icerik(b: any, sb: any, uid: string) {
  const key = Deno.env.get('GROQ_API_KEY')
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  if (b.mod === 'sozluk') {
    const k = String(b.kelime ?? '').toLowerCase().trim()
    if (!/^[a-z][a-z' -]{1,30}$/.test(k)) return json({ error: 'Bad word' }, 400)
    const { data: var_ } = await sb.from('ing_icerik').select('veri').eq('tur', 'sozluk').eq('alt', k).maybeSingle()
    if (var_?.veri) return json({ veri: var_.veri, kaynak: 'havuz' })
    if (!key) return json({ error: 'Groq API key not configured' }, 500)
    if (await gunlukDoldu(admin, uid)) return json({ error: 'limit' }, 429)
    const v = await groqJson(key, URETICI, `Dictionary card for the English word or phrase "${k}" for a Turkish B1-B2 learner. Return {"kelime":"${k}","okunus":"/IPA/","tur":"noun|verb|adj|adv|phrase","anlam_tr":"most common Turkish meaning(s), short","ornek":"natural example sentence","ornek_tr":"Turkish translation of the example"}. If it is not English, set "anlam_tr" to "".`, 400)
    if (!v || !metin(v.anlam_tr, 120) || !metin(v.ornek, 200)) return json({ error: 'Unparseable' }, 502)
    const veri = { kelime: k, okunus: String(v.okunus ?? '').slice(0, 40), tur: String(v.tur ?? '').slice(0, 12), anlam_tr: v.anlam_tr, ornek: v.ornek, ornek_tr: String(v.ornek_tr ?? '').slice(0, 220) }
    await admin.from('ing_icerik').insert({ tur: 'sozluk', alt: k, veri, olusturan: uid })
    return json({ veri, kaynak: 'yeni' })
  }
  const tur = String(b.tur ?? ''), alt = tur === 'test' || tur === 'sinav' || tur === 'konusma' ? String(b.alt ?? '') : ''
  /* deste: alt = öğrencinin seviyesi (assets/kelime.js); havuz seviyeye göre ayrılır */
  const sev = tur === 'deste' && /^(A1|A2|B1|B2|C1|C2)$/.test(String(b.alt ?? '')) ? String(b.alt) : 'B1-B2'
  if (!URET[tur] || (tur === 'test' && !TEST[alt]) || (tur === 'sinav' && !SINAV_ALT[alt]) || (tur === 'konusma' && !konusmaAlt(alt))) return json({ error: 'Unknown content' }, 400)
  const { data: hazir, error: e1 } = await sb.rpc('ing_icerik_al', { p_tur: tur, p_alt: alt, p_seviye: sev })
  if (e1) { console.error('ing_icerik_al:', e1); return json({ error: 'Pool unavailable' }, 503) }
  if (Array.isArray(hazir) && hazir[0]) return json({ id: hazir[0].id, veri: hazir[0].veri, kaynak: 'havuz' })
  if (!key) return json({ error: 'Groq API key not configured' }, 500)
  if (await gunlukDoldu(admin, uid)) return json({ error: 'limit' }, 429)
  const v = await groqJson(key, URETICI, URET[tur](alt, sev), tur === 'okuma' || alt === 'listening:diyalog' ? 3200 : 2400)
  if (!v || !DOGRULA[tur](v, alt)) return json({ error: 'Unparseable' }, 502)
  const { data: yeni, error: e2 } = await admin.from('ing_icerik').insert({ tur, alt, seviye: sev, veri: v, olusturan: uid }).select('id').single()
  if (e2 || !yeni) { console.error('ing_icerik insert:', e2); return json({ veri: v, kaynak: 'yeni' }) }
  await admin.from('ing_gorulen').insert({ user_id: uid, icerik_id: yeni.id })
  return json({ id: yeni.id, veri: v, kaynak: 'yeni' })
}

/* speaking sınav simülatörü: bütün cevaplar tek istekte; kriter puanı seviyenin ölçeğinde, "tahmini" */
const SINAV_OLCEK: Record<string, { kriter: string[], max: number, tarif: string }> = {
  kolay: { kriter: ['gorev', 'akici', 'dogru', 'kelime', 'telaffuz'], max: 4, tarif: 'Preparatory-school placement interview (pass level about B1). Each criterion is an integer 0-4: gorev = answers the question with relevant detail, akici = fluency, dogru = grammatical accuracy, kelime = vocabulary range, telaffuz = intelligibility judged only from the transcript (be moderate).' },
  orta: { kriter: ['akici', 'kelime', 'dogru', 'telaffuz'], max: 9, tarif: 'IELTS-style speaking descriptors. Each criterion is a band 1-9 in steps of 0.5: akici = fluency and coherence, kelime = lexical resource, dogru = grammatical range and accuracy, telaffuz = pronunciation (judge only from the transcript, be moderate).' },
  zor: { kriter: ['tekrar', 'akici', 'kelime', 'telaffuz'], max: 6, tarif: 'TOEFL iBT (2026) style speaking. Each criterion is 1-6 in steps of 0.5: tekrar = accuracy of the repeated sentences (REPEAT items) against their targets, akici = fluency in the interview, kelime = language use, telaffuz = intelligibility (judge only from the transcript, be moderate).' },
}
async function sinavPuan(b: any) {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) return json({ error: 'Groq API key not configured' }, 500)
  const lv = String(b.seviye ?? ''), O = SINAV_OLCEK[lv]
  if (!O || !Array.isArray(b.cevaplar) || !b.cevaplar.length) return json({ error: 'Bad input' }, 400)
  const cev = b.cevaplar.slice(0, 20).map((c: any) => ({ part: kis(c?.bolum, 20), question: kis(c?.soru, 300), answer: kis(c?.cevap, 1500), seconds: Number(c?.sn) || 0 }))
  const istem = `Mode: speaking exam evaluation (an estimate for practice, not an official score).
${O.tarif}
Answers come from speech-to-text, so ignore punctuation and capitalisation. Empty or very short answers must lower the scores.
Answers: ${JSON.stringify(cev)}
Return {"kriterler":{${O.kriter.map((k) => `"${k}":number`).join(',')}},"ozet_tr":"2 Turkish sentences: the strongest point and the one thing to work on next","duzeltmeler":[up to 5 x {"orijinal":"exact sentence or phrase the student said","daha_iyi":"a natural corrected or upgraded version","not_tr":"short Turkish reason, max 15 words"}]}`
  const v = await groqJson(key, KARAKTER.replace(/Judge fairly:[^\n]*\n/, ''), istem, 1400, 0.2)
  if (!v || typeof v !== 'object' || !v.kriterler) return json({ error: 'Unparseable' }, 502)
  const kriterler: Record<string, number> = {}
  for (const k of O.kriter) { const x = Number(v.kriterler[k]); if (!isFinite(x) || x < 0 || x > O.max) return json({ error: 'Bad score' }, 502); kriterler[k] = x }
  const duzeltmeler = (Array.isArray(v.duzeltmeler) ? v.duzeltmeler : []).slice(0, 5).filter((d: any) => metin(d?.orijinal, 400)).map((d: any) => ({ orijinal: kis(d.orijinal, 300), daha_iyi: kis(d.daha_iyi, 300), not_tr: kis(d.not_tr, 160) }))
  return json({ kriterler, ozet_tr: kis(v.ozet_tr, 400), duzeltmeler })
}

/* model cevap: aynı soruya bir üst seviye örnek; öğrencinin fikrinden yola çıkar */
const MODEL_HEDEF: Record<string, string> = { kolay: 'a strong B1+ answer for a preparatory-school placement interview', orta: 'an IELTS-style band 7-8 answer', zor: 'a TOEFL-style answer that would score 5-6' }
async function sinavModel(b: any) {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) return json({ error: 'Groq API key not configured' }, 500)
  const lv = String(b.seviye ?? ''), hedef = MODEL_HEDEF[lv], soru = kis(b.soru, 400)
  if (!hedef || !soru.trim()) return json({ error: 'Bad input' }, 400)
  const sn = Math.max(15, Math.min(150, Number(b.sn) || 45)), kelime = Math.round(sn * 2.1)
  const istem = `Mode: model answer for a speaking practice question (original, natural spoken English).
Part: ${kis(b.bolum, 20)}. Question: ${soru}
Student's answer (speech-to-text): ${kis(b.cevap, 1500) || '(no answer)'}
Write ${hedef}, about ${kelime} words, as the student would say it aloud. Keep the student's own idea and opinion if they had one, but improve structure, linking words and vocabulary. No headings, no lists.
Return {"model_en":"the answer","notlar":["up to 3 short Turkish notes: what the model does better than the student's answer, each max 15 words"]}`
  const v = await groqJson(key, KARAKTER.replace(/Judge fairly:[^\n]*\n/, ''), istem, 900, 0.6)
  if (!v || !metin(v.model_en, 1600)) return json({ error: 'Unparseable' }, 502)
  return json({ model_en: kis(v.model_en, 1600), notlar: (Array.isArray(v.notlar) ? v.notlar : []).filter((n: unknown) => metin(n, 200)).slice(0, 3) })
}

/* konuşma atölyesi: hocanın tur içi cevabı (münazara, rol, hikâye, röportaj) ya da anlat-buldur tahmini */
const ETKINLIK_SEV: Record<string, string> = { A1: 'very simple A1 English', A2: 'simple A2 English', B1: 'clear B1 English', B2: 'natural B2 English', C1: 'rich C1 English', C2: 'sophisticated C2 English' }
async function etkinlikTur(b: any) {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) return json({ error: 'Groq API key not configured' }, 500)
  const tip = String(b.tip ?? ''), dil = ETKINLIK_SEV[String(b.seviye)] || 'clear B1 English'
  const gecmis = JSON.stringify((Array.isArray(b.gecmis) ? b.gecmis : []).slice(-8).map((x: any) => ({ who: x?.rol === 'hoca' ? 'tutor' : 'student', text: kis(x?.metin, 500) })))
  let istem = ''
  if (tip === 'munazara') istem = `Mode: debate. You argue ${b.hoca_taraf === 'for' ? 'FOR' : 'AGAINST'} this statement: "${kis(b.iddia, 200)}".
Conversation: ${gecmis}
Reply to the student's last point directly (quote or paraphrase it), then give one new counter-argument. 2-3 sentences, ${dil}. Stay polite and a little challenging.
Return {"yanit_en":"…"}`
  else if (tip === 'rol') istem = `Mode: role-play. Scenario: ${kis(b.senaryo?.baslik, 100)}. The student: ${kis(b.senaryo?.sen, 200)}. You are: ${kis(b.senaryo?.hoca, 60)}.
Tasks the student has not done yet (do not mention them directly, but give natural chances): ${JSON.stringify((Array.isArray(b.hedefler_kalan) ? b.hedefler_kalan : []).slice(0, 4).map((x: unknown) => kis(x, 80)))}
Conversation: ${gecmis}
Stay in character and reply naturally to the student's last line. 1-2 sentences, ${dil}.
Return {"yanit_en":"…"}`
  else if (tip === 'hikaye') istem = `Mode: story chain. Story so far: "${kis(b.hikaye, 2500)}"
Continue the story with 1-2 sentences that add a twist and make it easy for the student to continue using the word "${kis(b.sonraki_kelime, 30)}" (do not use that word yourself). Keep the same tense. ${dil}.
Return {"yanit_en":"…"}`
  else if (tip === 'roportaj') istem = `Mode: interview. You are ${kis(b.persona?.kim, 60)}. You introduced yourself as: "${kis(b.persona?.giris, 300)}".
Conversation: ${gecmis}
Answer the student's last question in character, with one concrete detail. If it is not a question, kindly ask them to ask a question. 1-3 sentences, ${dil}.
Return {"yanit_en":"…"}`
  else if (tip === 'taboo') istem = `Mode: taboo guessing game, category ${kis(b.kategori, 40)}. A student describes a word without saying it: "${kis(b.aciklama, 800)}"
Guess the single most likely English word or short phrase. Return {"tahmin":"…"}`
  else return json({ error: 'Unknown tip' }, 400)
  const v = await groqJson(key, KARAKTER.replace(/Judge fairly:[^\n]*\n/, ''), istem, 400, tip === 'taboo' ? 0.2 : 0.7)
  if (tip === 'taboo') return v && metin(v.tahmin, 60) ? json({ tahmin: kis(v.tahmin, 60) }) : json({ error: 'Unparseable' }, 502)
  return v && metin(v.yanit_en, 600) ? json({ yanit_en: kis(v.yanit_en, 600) }) : json({ error: 'Unparseable' }, 502)
}
