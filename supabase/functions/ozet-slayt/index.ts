/* ==========================================================================
   ACADEX — AKILLI ÇALIŞMA SLAYTLARI SUNUCUSU (supabase/functions/ozet-slayt)
   22.11.2026

   İki iş yapar (gövdede islem):
     islem:'uret'  Özet kartı + belgenin kayıtlı metninden (document_chunks) 16:9
                   çalışma slaytlarının verisini (deste) üretir. Gemini Flash-Lite
                   (JSON), olmazsa Groq. Sonuç study_cards.slayt'a yazılır; aynı kart
                   ikinci kez istenirse model çağrılmaz (yenile:true hariç).
     islem:'pdf'   Tarayıcının hazırladığı slayt HTML'ini Cloudflare Browser Run ile
                   vektör PDF'e çevirir ve PDF'i döner. CF_ACCOUNT_ID / CF_API_TOKEN
                   yoksa 501 döner; tarayıcı o zaman "PDF olarak kaydet" penceresini açar.

   Slaytları çizen: js/ozet-slayt.js (aynı deste şeması, aynı normalize sınırları).
   Veritabanı: supabase/migrations/20261122d_ozet_slayt.sql
   Secret'lar: GEMINI_API_KEY (var), GROQ_API_KEY (var), CF_ACCOUNT_ID, CF_API_TOKEN
               ("Browser Run - Edit" izinli API token), isteğe bağlı OZET_SLAYT_MODEL.
   Testler: tests/ozet-slayt.js
   ========================================================================== */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GUNLUK_URET = 12
const GUNLUK_PDF = 40
const BELGE_SINIRI = 90_000
const OZET_SINIRI = 14_000
const HTML_SINIRI = 4_000_000
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1/models'
const GEMINI_MODELLERI = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']
const GEMINI_DENEME_MS = 95_000
const GROQ_MODEL = 'openai/gpt-oss-120b'
const TURLER = ['harita', 'kartlar', 'vurgu', 'liste', 'formul', 'surec', 'tablo', 'cozum', 'ornek', 'sorular', 'tekrar']
const RENKLER = ['lacivert', 'turuncu', 'yesil', 'kirmizi']
const TUR_RENK: Record<string, string> = { harita: 'lacivert', kartlar: 'lacivert', surec: 'kirmizi', tablo: 'turuncu', cozum: 'turuncu', vurgu: 'kirmizi', liste: 'lacivert', formul: 'yesil', ornek: 'yesil', sorular: 'kirmizi', tekrar: 'kirmizi' }

function json(veri: unknown, durum = 200): Response {
  return new Response(JSON.stringify(veri), { status: durum, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/* ---------------- deste normalize (js/ozet-slayt.js → normalize ile aynı sınırlar) ---------------- */
function str(v: unknown, n = 400): string { return typeof v === 'string' ? v.trim().slice(0, n) : (typeof v === 'number' ? String(v) : '') }
function dizi(v: unknown, n: number): any[] { return Array.isArray(v) ? v.slice(0, n) : [] }
function yildizSay(v: unknown): number { const n = Math.round(Number(v) || 0); return n < 0 ? 0 : (n > 3 ? 3 : n) }

export function desteNormalize(d: any, varsayilan: { kaynak?: string; ikidil?: boolean } = {}): any {
  d = d && typeof d === 'object' ? d : {}
  const not_ = (n: any) => n && typeof n === 'object' && str(n.metin) ? { tur: /^(uyari|bilgi)$/.test(n.tur) ? n.tur : 'ipucu', simge: str(n.simge, 8), baslik: str(n.baslik, 60), metin: str(n.metin, 360), tr: str(n.tr, 300) } : null
  const kart = (k: any) => ({ simge: str(k?.simge, 8), baslik: str(k?.baslik, 80), alt: str(k?.alt, 40), maddeler: dizi(k?.maddeler, 5).map((m) => str(m, 160)).filter(Boolean), metin: str(k?.metin, 320), tr: str(k?.tr, 220) })
  const out: any = {
    surum: 1,
    ders: str(d.ders, 80), baslik: str(d.baslik, 140) || 'Study Slides', baslik_tr: str(d.baslik_tr, 140),
    alt: str(d.alt, 140), simge: str(d.simge, 8) || '📘',
    ikidil: typeof varsayilan.ikidil === 'boolean' ? varsayilan.ikidil : d.ikidil !== false,
    kaynak: str(varsayilan.kaynak || d.kaynak, 140),
    slaytlar: [] as any[]
  }
  for (const s of dizi(d.slaytlar, 24)) {
    if (!s || !TURLER.includes(s.tur)) continue
    const x: any = {
      tur: s.tur, renk: RENKLER.includes(s.renk) ? s.renk : TUR_RENK[s.tur],
      etiket: str(s.etiket, 50), etiket_tr: str(s.etiket_tr, 50), baslik: str(s.baslik, 110), baslik_tr: str(s.baslik_tr, 140),
      yildiz: yildizSay(s.yildiz), not: not_(s.not)
    }
    if (s.tur === 'harita') x.ogeler = dizi(s.ogeler, 9).map((o) => ({ simge: str(o?.simge, 8), baslik: str(o?.baslik, 70), tr: str(o?.tr, 90), yildiz: yildizSay(o?.yildiz) })).filter((o) => o.baslik)
    if (s.tur === 'kartlar') { x.kartlar = dizi(s.kartlar, 4).map(kart).filter((k) => k.baslik); x.ornek = str(s.ornek, 420) }
    if (s.tur === 'surec') {
      x.adimlar = dizi(s.adimlar, 6).map((a) => ({ baslik: str(a?.baslik, 50), metin: str(a?.metin, 160), tr: str(a?.tr, 90), vurgu: !!a?.vurgu })).filter((a) => a.baslik)
      x.kartlar = dizi(s.kartlar, 2).map(kart).filter((k) => k.baslik)
    }
    if (s.tur === 'tablo') {
      x.sutunlar = dizi(s.sutunlar, 4).map((c) => str(c, 50))
      const n = x.sutunlar.length || 2
      x.satirlar = dizi(s.satirlar, 8).map((r) => dizi(r, n).map((c) => str(c, 150))).filter((r) => r.length && r[0])
      x.satir_tr = dizi(s.satir_tr, 8).map((t) => str(t, 90))
    }
    if (s.tur === 'ornek') {
      x.metin = str(s.metin, 1600)
      x.yan = s.yan && typeof s.yan === 'object' && (str(s.yan.baslik) || dizi(s.yan.maddeler, 1).length)
        ? { simge: str(s.yan.simge, 8), baslik: str(s.yan.baslik, 60), maddeler: dizi(s.yan.maddeler, 6).map((m) => str(m, 120)).filter(Boolean), tr: str(s.yan.tr, 200) } : null
      x.ek = str(s.ek, 300)
    }
    if (s.tur === 'sorular') x.sorular = dizi(s.sorular, 6).map((q) => ({ soru: str(q?.soru, 220), tr: str(q?.tr, 200), ipucu: str(q?.ipucu, 200), yildiz: yildizSay(q?.yildiz) })).filter((q) => q.soru)
    if (s.tur === 'vurgu') x.maddeler = dizi(s.maddeler, 8).map((m) => ({ metin: str(m?.metin ?? m, 200), tr: str(m?.tr, 160), kaynak: str(m?.kaynak, 20) })).filter((m) => m.metin)
    if (s.tur === 'liste') { x.maddeler = dizi(s.maddeler, 10).map((m) => ({ ad: str(m?.ad ?? m, 60), aciklama: str(m?.aciklama, 140), tr: str(m?.tr, 90) })).filter((m) => m.ad); x.ipucu = str(s.ipucu, 200); x.ipucu_tr = str(s.ipucu_tr, 160) }
    if (s.tur === 'formul') {
      x.formul = str(s.formul, 160); x.ad = str(s.ad, 80); x.ne_zaman = str(s.ne_zaman, 220); x.ornek = str(s.ornek, 260)
      x.degiskenler = dizi(s.degiskenler, 8).map((d) => ({ sembol: str(d?.sembol, 20), anlam: str(d?.anlam, 120), tr: str(d?.tr, 90) })).filter((d) => d.sembol)
    }
    if (s.tur === 'cozum') {
      const v = s.veri && typeof s.veri === 'object' ? s.veri : {}
      x.veri = { sutunlar: dizi(v.sutunlar, 5).map((c) => str(c, 40)), satirlar: dizi(v.satirlar, 7).map((r) => dizi(r, 5).map((c) => str(c, 60))).filter((r) => r.length) }
      x.soru = str(s.soru, 260); x.adimlar = dizi(s.adimlar, 6).map((a) => str(a, 200)).filter(Boolean)
      x.sonuc = str(s.sonuc, 260); x.sonuc_tr = str(s.sonuc_tr, 200); x.kaynak = str(s.kaynak, 60)
    }
    if (s.tur === 'tekrar') x.kutular = dizi(s.kutular, 12).map((k) => ({ simge: str(k?.simge, 8), baslik: str(k?.baslik, 40), metin: str(k?.metin, 170), tr: str(k?.tr, 110) })).filter((k) => k.baslik)
    const bos = (x.tur === 'harita' && !x.ogeler.length) || (x.tur === 'kartlar' && !x.kartlar.length) || (x.tur === 'surec' && !x.adimlar.length) ||
      (x.tur === 'tablo' && !x.satirlar.length) || (x.tur === 'vurgu' && x.maddeler.length < 2) || (x.tur === 'liste' && x.maddeler.length < 3) || (x.tur === 'formul' && !x.formul) || (x.tur === 'cozum' && (!x.adimlar.length || !x.sonuc)) || (x.tur === 'ornek' && !x.metin) || (x.tur === 'sorular' && !x.sorular.length) || (x.tur === 'tekrar' && !x.kutular.length)
    if (!bos && x.baslik) out.slaytlar.push(x)
  }
  if (!out.ikidil) out.slaytlar.forEach((s: any) => { s.etiket_tr = ''; s.baslik_tr = ''; if (s.tur === 'cozum') s.sonuc_tr = '' })
  return out
}

/* ---------------- model talimatı ---------------- */
/* Örnek alınan biçim: "Smart Study Slides" (Arçelik vaka sınavı destesi). Kurallar
   oradan çıkarıldı: tek fikir = tek slayt, kısa cümle, her kavrama kaynaktan örnek,
   yıldızlı önem, "sınavda böyle yaz" örnek cevabı, son tekrar sayfası. */
export function sistemTalimati(ikidil: boolean, yedek = false): string {
  return `You turn a university chapter into "Smart Study Slides": a 16:9 exam-prep deck for Turkish university students.
Return ONLY one JSON object (no markdown) with this shape:
{"ders": "course · chapter", "baslik": "chapter title", "baslik_tr": "Turkish title", "alt": "textbook / author line or empty", "simge": "one emoji", "slaytlar": [ ...slides ]}

SLIDE TYPES (field "tur"). Every slide has: tur, etiket (2-3 word kicker in the main language), etiket_tr (Turkish kicker), baslik (max 8 words, a claim or a question), baslik_tr (Turkish subtitle that adds meaning, max 12 words), yildiz (0-3), optional not.
- "harita": chapter map. ogeler: 5-8 items {simge, baslik, tr, yildiz}.
- "kartlar": 2-4 cards side by side. kartlar: [{simge, baslik, alt (optional short tag), metin (1-2 short sentences) and/or maddeler (2-4 bullets, max 10 words each), tr}], optional ornek (one sentence: a short exam-ready definition or example).
- "surec": a sequence/evolution/process. adimlar: 3-6 {baslik, metin (max 18 words), tr, vurgu (true for the 1-2 most important steps)}.
- "tablo": comparison or list of types. sutunlar: 2-4 headers; satirlar: 3-8 rows (arrays of cells, max 14 words per cell); satir_tr: Turkish name of each row's first cell.
- "cozum": a NUMERICAL EXAMPLE from the source, solved step by step (one slide per example listed under NUMERICAL EXAMPLES). veri: {sutunlar: headers, satirlar: rows} = the source's data table with its REAL numbers (empty if the example has no table); soru: the task as it would be asked in an exam (1 sentence); adimlar: 3-5 steps, each one comparison or calculation with the numbers ("Wheat: A needs 2 h, B needs 4 h → A is cheaper"); sonuc: the conclusion in one sentence; sonuc_tr: its Turkish; kaynak: e.g. "p.13". Never change the numbers.
- "vurgu": "What the lecturer stressed" — the SOURCE INVENTORY's emphasised ideas (KEY IDEA / MAIN IDEA / Remember…). maddeler: 4-8 [{metin: the idea in one short sentence (keep its arrows/logic, e.g. "Exports > Imports → gold inflow → prices ↑"), tr, kaynak: "p.3"}]. yildiz 3.
- "liste": memory card for a numbered list / classification from the inventory (e.g. "8 demand states"). maddeler: EVERY item [{ad: item name, aciklama: max 12 words, tr}]; ipucu: one memory trick (first letters, a story or grouping); ipucu_tr.
- "formul": one formula from the inventory. formul: plain text with symbols (e.g. "M × V = P × Y"); ad: its name; degiskenler: [{sembol, anlam, tr}] for EVERY symbol; ne_zaman: when/why it is used (1 sentence); ornek: a one-line use with the source's numbers if any, else a simple illustration starting with "e.g."; not (optional) for a common mistake.
- "ornek": model exam answer ("Write it like this"). metin: 3-5 short paragraphs separated by \\n\\n, 110-170 words, simple academic English, **bold** key terms; it must define the concept, give an example from the source, and end with "In conclusion, ...". yan: {simge, baslik:"Answer formula" or "Logic map", maddeler: 3-4 short lines, tr}. ek: optional one-line bonus tip.
- "sorular": 4-6 likely exam questions. sorular: [{soru, tr, ipucu (keywords of the answer, not the full answer), yildiz}].
- "tekrar": final cheat sheet. kutular: 8-12 boxes {simge, baslik (1-3 words), metin (max 18 words), tr (max 6 words)}. The last box is "Exam tips".
not (optional callout): {tur: "ipucu"|"uyari"|"bilgi", simge (emoji), baslik (2-3 words), metin (max 30 words), tr}. Use "uyari" for common mistakes / confusions, "ipucu" for exam tips, "bilgi" for an extra fact.

DECK PLAN (${yedek ? '9-12' : '12-18'} slides, in the source's order):
1. one "harita"; 2. "kartlar" slides covering EVERY major topic; right after the theory it illustrates, one "cozum" slide for EACH item under NUMERICAL EXAMPLES (these are exam material — never skip them, they come before any other optional slide); one "formul" slide per formula in the SOURCE INVENTORY (max 3; group trivial ones); one "liste" slide for each numbered list with 4+ items (max 3); one "vurgu" slide when the inventory has 3+ emphasised ideas (put it right after "harita"); every definition in the inventory must appear on some slide; "sorular" uses the document's own questions first of the chapter (do not skip lists, definitions, typologies); 3. at least one "tablo" when the source has types/categories/states; 4. at least one "surec" when there is an evolution, process or sequence; 5. ${yedek ? '1' : '2'} "ornek" model answers for the most likely essay questions (one may compare two concepts); 6. one "sorular"; 7. optionally one "kartlar" writing toolkit with 4 cards of useful phrases (Define / Compare / Example / Conclude); 8. one "tekrar" as the LAST slide.

STYLE RULES
- Main language = the language of the source. Simple, clear English (B1-B2) if the source is English: short sentences, one idea per sentence, keep technical terms exactly as the source uses them.
- ${ikidil ? 'Every "tr" field: natural, short Turkish (not word-by-word), max 12 words. Turkish technical terms as used in Turkish universities.' : 'The source is Turkish: write everything in Turkish and leave every "tr", "baslik_tr" and "etiket_tr" field EMPTY ("").'}
- Ground everything in the provided source and summary. Prefer examples, numbers, names and cases that appear in the source. If the source has no example for a key concept, add one short everyday example starting with "e.g.".
- yildiz = estimated exam importance: 3 = core definition, numbered list, learning objective or repeatedly emphasised idea; 2 = important supporting idea; 1 = background; 0 = no stars (use 0 for "ornek", "sorular" slides' own yildiz and for toolkit slides).
- Emojis: one fitting emoji per card/item; never use emojis inside sentences.
- Keep the source's original technical terms (e.g. "price-specie-flow mechanism"); never back-translate a term from the Turkish summary.
- Never invent statistics, quotes or page numbers. No teacher names. No markdown except **bold**.`
}

/* Özet kartından modele giden kısa döküm. */
export function kartDokumu(card: any, sinir = OZET_SINIRI): string {
  const p: string[] = []
  const ek = (s: string) => { if (s) p.push(s) }
  ek(card.summary_executive ? 'EXECUTIVE SUMMARY: ' + String(card.summary_executive) : '')
  ek(card.summary ? 'SUMMARY:\n' + String(card.summary).replace(/\s*\[\d+(?:[,–-]\s*\d+)*\]/g, '') : '')
  const sec = Array.isArray(card.sections) ? card.sections : []
  if (sec.length) ek('SECTIONS:\n' + sec.map((s: any) => `## ${str(s?.heading, 160)}\n${str(s?.summary, 900)}\n${dizi(s?.key_points, 10).map((k) => '- ' + str(k, 240)).join('\n')}`).join('\n'))
  const kt = Array.isArray(card.key_terms) ? card.key_terms : []
  if (kt.length) ek('KEY TERMS:\n' + kt.slice(0, 30).map((t: any) => `- ${str(t?.term, 80)}: ${str(t?.definition, 260)}`).join('\n'))
  const qs = Array.isArray(card.quiz_questions) ? card.quiz_questions : []
  if (qs.length) ek('QUIZ QUESTIONS:\n' + qs.slice(0, 12).map((q: any) => `- ${str(q?.question, 240)} → ${str(q?.answer, 200)}`).join('\n'))
  const we = Array.isArray(card.worked_examples) ? card.worked_examples : []
  if (we.length) ek('WORKED EXAMPLES:\n' + we.slice(0, 4).map((w: any) => `- ${str(w?.title, 120)}: ${str(w?.problem_statement, 300)} → ${str(w?.final_answer, 200)}`).join('\n'))
  const tb = Array.isArray(card.tables) ? card.tables : []
  if (tb.length) ek('TABLES:\n' + tb.slice(0, 3).map((t: any) => `${str(t?.title, 100)}\n${[t?.headers, ...dizi(t?.rows, 10)].filter(Array.isArray).map((r: any[]) => r.map((c) => str(c, 60)).join(' | ')).join('\n')}`).join('\n\n'))
  return p.join('\n\n').replace(/\[\d+\]/g, '').slice(0, sinir)
}

function jsonCoz(metin: string): any {
  let t = String(metin || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('JSON bulunamadi')
  t = t.slice(a, b + 1)
  return JSON.parse(t)
}

/* ---------------- model çağrıları ---------------- */
async function geminiUret(apiKey: string, sistem: string, kullanici: string): Promise<{ veri: any; model: string } | { hata: string }> {
  const modeller = [...new Set([String(Deno.env.get('OZET_SLAYT_MODEL') || '').trim(), ...GEMINI_MODELLERI].filter(Boolean))]
  let sonHata = ''
  for (const model of modeller) {
    let jsonModu = true, dusunme = true
    for (let deneme = 0; deneme < 3; deneme++) {
      const ctrl = new AbortController()
      const zaman = setTimeout(() => ctrl.abort(), GEMINI_DENEME_MS)
      try {
        const res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST', signal: ctrl.signal,
          headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sistem }] },
            contents: [{ role: 'user', parts: [{ text: kullanici }] }],
            generationConfig: {
              temperature: 0.4, maxOutputTokens: 16000,
              ...(jsonModu ? { responseMimeType: 'application/json' } : {}),
              ...(dusunme ? { thinkingConfig: { thinkingLevel: 'low' } } : {})
            }
          })
        })
        clearTimeout(zaman)
        const govde = await res.text()
        if (!res.ok) {
          sonHata = `${model}: ${res.status} ${govde.replace(/\s+/g, ' ').slice(0, 200)}`
          if (res.status === 400 && /responseMimeType|response_mime_type/i.test(govde) && jsonModu) { jsonModu = false; continue }
          if (res.status === 400 && /thinking/i.test(govde) && dusunme) { dusunme = false; continue }
          break
        }
        const data = JSON.parse(govde)
        const parts = data?.candidates?.[0]?.content?.parts || []
        const metin = parts.filter((p: any) => typeof p?.text === 'string' && !p.thought).map((p: any) => p.text).join('')
        const u = data?.usageMetadata || {}
        console.log(`ozet-slayt Gemini[${model}]: ${u.promptTokenCount ?? '?'} giris + ${u.candidatesTokenCount ?? '?'} cikis, finish=${data?.candidates?.[0]?.finishReason}`)
        return { veri: jsonCoz(metin), model }
      } catch (e) {
        clearTimeout(zaman)
        sonHata = `${model}: ${(e as any)?.name === 'AbortError' ? 'zaman asimi' : String((e as any)?.message || e)}`
        break
      }
    }
    console.warn('ozet-slayt Gemini basarisiz:', sonHata)
  }
  return { hata: sonHata || 'Gemini cevap vermedi' }
}

async function groqUret(apiKey: string, sistem: string, kullanici: string): Promise<{ veri: any; model: string } | { hata: string }> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL, temperature: 0.4, max_completion_tokens: 4800, reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sistem }, { role: 'user', content: kullanici }]
      })
    })
    const govde = await res.text()
    if (!res.ok) return { hata: `groq ${res.status} ${govde.slice(0, 200)}` }
    const metin = JSON.parse(govde)?.choices?.[0]?.message?.content || ''
    return { veri: jsonCoz(metin), model: GROQ_MODEL }
  } catch (e) {
    return { hata: 'groq ' + String((e as any)?.message || e) }
  }
}

/* ==========================================================================
   SAYISAL ÖRNEK BULUCU (24.11.2026) — ozet-slayt ve summarize-document'ta AYNI kopya
   (tests/ornek-bulucu.js iki kopyanın birebir aynı olduğunu denetler).
   NEDEN: "ITB 311 Lecture 2" kartında kaynakta iki 2×2 L/Q örneği vardı (vizede de
   çıktı) ama Gemini zaman aşımına düşünce özet küçük modele kaldı, talimat çözümlü örneği
   yalnız formül varken istiyordu ve kart 0 örnekle çıktı. Bu bulucu modele bağlı değil:
   kaynak metinde örnek sayfasını kodla bulur, modele "bunları mutlaka işle" listesi olur,
   sonunda kartın bunları gerçekten işleyip işlemediği ölçülür (ornekKapsama).
   ========================================================================== */
export type OrnekBlok = { baslik: string; sayfa: number | null; metin: string; sayilar: string[]; satirlar: string[][]; puan: number }

const ORNEK_ACIK_RE = /\b(examples?|exercises?|illustrations?|numerical|worked|problems?|örne[kğ]i?|örnekler|alıştırma|uygulama)\b/i
/* güçlü kurulum (ders kitabı örneği) +2; zayıf ("consider the following scenario" psikolojide düz anlatımdır) +1 */
const ORNEK_KURULUM_RE = /\b(suppose|assume|assuming|given that|varsayalım|diyelim|farz edelim|verilsin)\b/i
const ORNEK_ZAYIF_KURULUM_RE = /\b(consider|imagine|let us|düşünelim)\b/i
const ORNEK_SORU_RE = /\b(calculate|compute|determine|find the|how much|how many|hesapla|hesaplayınız|bulunuz|kaç)\b/i
const ORNEK_YONETIM_RE = /\b(mid-?term|final exam|grading|grade[sd]?|attendance|syllabus|office hours|course objectives|learning outcomes|vize|büt|devam zorunlu|not dağılımı|assessment methods)\b/i
/* etiket (rakamsız, en çok 40 karakter) + en az iki sayı, sonrasında yazı yok */
const ORNEK_TABLO_SATIRI_RE = /^[^\d:→=]{0,40}?(?:\s+-?\d+(?:[.,]\d+)?%?){2,}\s*$/

/** Metindeki sayılar (sırasıyla). Yıl (1500-2099) ve sayfa/slayt numarası gibi tek başına satırlar sayılmaz. */
export function ornekSayilari(s: string): string[] {
  const out: string[] = []
  const t = String(s || '').replace(/^[ \t]*\d+[.)][ \t]+/gm, '') // madde numarası sayı değildir
  for (const m of t.matchAll(/(?<![\w.,])(\d+(?:[.,]\d+)?)(%?)(?![\w])/g)) {
    const v = m[1].replace(',', '.')
    if (/^\d{4}$/.test(v) && +v >= 1500 && +v <= 2099) continue
    out.push(v + m[2])
  }
  return out
}

function ornekBolumle(metin: string): { sayfa: number | null; metin: string }[] {
  const t = String(metin || '').replace(/\r\n/g, '\n')
  const isaret = /^[ \t]*-{2,}\s*(?:PAGE|SAYFA|SLAYT|SLIDE)\s*(\d+)\s*-{2,}[ \t]*$/gim
  const parcalar: { sayfa: number | null; metin: string }[] = []
  const bol = (s: string, sayfa: number | null) => s.split(/\f|\n[ \t]*\n/).forEach((p) => { if (p.trim()) parcalar.push({ sayfa, metin: p.trim() }) })
  let son = 0, sayfa: number | null = null, m: RegExpExecArray | null
  while ((m = isaret.exec(t))) { bol(t.slice(son, m.index), sayfa); sayfa = +m[1]; son = m.index + m[0].length }
  bol(t.slice(son), sayfa)
  return parcalar
}

/** Kaynakta sayısal örnek içeren blokları bulur (en çok `enCok`, sayfa sırasıyla). */
export function ornekBul(metin: string, enCok = 8): OrnekBlok[] {
  const bulunan: OrnekBlok[] = [], gorulen = new Set<string>()
  for (const b of ornekBolumle(metin)) {
    if (b.metin.length < 60 || ORNEK_YONETIM_RE.test(b.metin)) continue
    const satirlar = b.metin.split('\n').map((l) => l.trim()).filter(Boolean)
    const ilk = satirlar.slice(0, 2).join(' ')
    /* tablo satırı: kısa bir etiket + yalnız sayılar ("Country A 2 6", "Ürün X  120  45%") */
    const tablo = satirlar.slice(1).filter((l) => l.length < 90 && ORNEK_TABLO_SATIRI_RE.test(l)).map((l) => ornekSayilari(l))
    const hesap = satirlar.filter((l) => /\d\s*(?:[×*\/+=−-]\s*\d|%|hours?\b|units?\b|saat\b|birim\b|TL\b|USD\b|EUR\b|times\b|kez\b)|[=→]\s*\d|[$€£₺]\s?\d/i.test(l)).length
    const puan = (ORNEK_ACIK_RE.test(ilk) || /\b(?:example|örnek)\s*:/i.test(b.metin) ? 2 : (ORNEK_ACIK_RE.test(b.metin) ? 1 : 0)) +
      (ORNEK_KURULUM_RE.test(b.metin) ? 2 : ORNEK_ZAYIF_KURULUM_RE.test(b.metin) ? 1 : 0) + (ORNEK_SORU_RE.test(b.metin) ? 1 : 0) + (tablo.length >= 2 ? 2 : 0) + (tablo.length >= 3 ? 1 : 0) +
      (hesap >= 4 ? 2 : hesap >= 2 ? 1 : 0)
    const sayilar = ornekSayilari(b.metin)
    /* yoğun sayılı paragraf (ders kitabı örneği: "Sold 8 bikes costing $91 ...") */
    const yogun = sayilar.length >= 10 && hesap >= 3 ? 1 : 0
    if (puan + yogun < 3 || new Set(sayilar).size < 3 || sayilar.length < 4) continue
    /* aynı tablo bir sonraki slaytta tekrar edilir ("Remember our example"): bir kez say */
    const anahtar = tablo.length >= 2 ? tablo.map((r) => r.join(' ')).join('|') : [...new Set(sayilar)].sort().join(' ')
    if (gorulen.has(anahtar)) continue
    gorulen.add(anahtar)
    bulunan.push({ baslik: satirlar[0].replace(/^[•\-–*\s]+/, '').slice(0, 90), sayfa: b.sayfa, metin: b.metin.slice(0, 1400), sayilar, satirlar: tablo, puan: puan + yogun })
  }
  return bulunan.slice(0, enCok)
}

/** Kart bu örnekleri işledi mi? Yalnız çözümlü örnekler ve tablolar sayılır (bir key_point'te
    "2" ve "4" geçmesi örneği işlemek değildir). Tablolu örnekte satır ya da sütun çiftleri
    bir öğenin sayı dizisinde ardışık bulunmalı; tablosuzda sayıların %75'i aynı öğede olmalı. */
export function ornekKapsama(ornekler: OrnekBlok[], kart: any): { bulunan: number; islenen: number; eksik: { baslik: string; sayfa: number | null }[] } {
  const ogeler = [...(Array.isArray(kart?.worked_examples) ? kart.worked_examples : []), ...(Array.isArray(kart?.tables) ? kart.tables : [])]
    .map((o) => ornekSayilari(JSON.stringify(o)))
  const ardisik = (dizi: string[], a: string, b: string) => dizi.some((x, i) => x === a && dizi[i + 1] === b)
  const islendi = (o: OrnekBlok) => ogeler.some((d) => {
    if (o.satirlar.length >= 2) {
      const ciftler = (rs: string[][]) => rs.every((r) => r.slice(1).every((v, i) => ardisik(d, r[i], v)))
      const sutunlar = o.satirlar[0].map((_, j) => o.satirlar.map((r) => r[j]).filter((v) => v != null))
      return ciftler(o.satirlar) || ciftler(sutunlar)
    }
    const hedef = [...new Set(o.sayilar)], var_ = new Set(d)
    return hedef.filter((n) => var_.has(n)).length / hedef.length >= 0.75
  })
  const eksik = ornekler.filter((o) => !islendi(o)).map((o) => ({ baslik: o.baslik, sayfa: o.sayfa }))
  return { bulunan: ornekler.length, islenen: ornekler.length - eksik.length, eksik }
}

/** Modele giden "mutlaka işle" satırı (pencere talimatının sonuna eklenir; örnek yoksa boş). */
export function ornekTalimati(ornekler: OrnekBlok[]): string {
  if (!ornekler.length) return ''
  return `\n- MUST COVER: this text contains ${ornekler.length} numerical example(s) that students are examined on: ${ornekler.map((o) => `"${o.baslik}"${o.sayfa ? ` (p.${o.sayfa})` : ''}`).join('; ')}. For EACH one write a worked_example with the source's own numbers (problem_statement gives the data, steps compare/compute, final_answer states the conclusion) and copy its data table into 'tables' — even when there is no formula.`
}

/* ---------- KAYNAK ENVANTERİ (25.11.2026): tanım, formül, liste, vurgu, öğrenme çıktısı, soru ----------
   "Önce çıkar, sonra özetle": yapay zekâ özetlerinin en sık hatası atlamaktır. Bu dedektörler
   modele bağlı değil; buldukları modele "MUST COVER" olarak gider, sonunda kartla karşılaştırılır
   (kaynakKapsama) ve ekranda kapsama karnesi olarak görünür. */
export type Envanter = {
  tanimlar: { terim: string; tanim: string; sayfa: number | null }[]
  formuller: { ifade: string; sayfa: number | null }[]
  listeler: { baslik: string; maddeler: string[]; sayfa: number | null }[]
  vurgular: { metin: string; sayfa: number | null }[]
  ciktilar: string[]
  sorular: { soru: string; sayfa: number | null }[]
  ornekler: OrnekBlok[]
}
const ENV_VURGU_RE = /^(?:[•\-–*\s]*)((?:[A-Z’'A-Z]+\s)?(?:KEY IDEA|MAIN IDEA|MAIN (?:GOAL|MESSAGE|POINT|CHANGE)|KEY (?:POINT|TAKEAWAY|MESSAGE)|BIG IDEA|IMPORTANT|REMEMBER|NOTE|TAKEAWAY|THE PROBLEM|ÖNEMLİ|DİKKAT|UNUTMA|ANA FİKİR|TEMEL FİKİR|HATIRLA))\s*[:!]\s*(.*)$/i
const ENV_CIKTI_RE = /^(?:learning (?:objectives?|outcomes?)|course objectives|objectives|öğrenme (?:çıktıları|hedefleri)|dersin (?:amaçları|hedefleri)|kazanımlar)\s*:?\s*$/i
const ENV_SORU_BASLIK_RE = /^(?:review questions|discussion questions|questions for review|exercises|problems|check your understanding|self[- ]test|sorular|tartışma soruları|alıştırmalar|değerlendirme soruları)\s*:?\s*$/i
const ENV_LISTE_BASLIK_RE = /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)\b|\b(types?|kinds?|forms?|stages?|steps?|phases?|elements?|components?|levels?|dimensions?|principles?|concepts?|tasks?|factors?|functions?|characteristics|categories|methods?|approaches|states|sins|ps|türleri|çeşitleri|aşamaları|adımları|unsurları|öğeleri|boyutları|ilkeleri|özellikleri|görevleri|faktörleri|yöntemleri|kategorileri)\b/i
const ENV_MADDE_RE = /^(?:[•\-–*▪◦●○]|\d{1,2}[.)]|[a-h][.)])\s+(.+)$/
const ENV_TANIM_KALIP_RE = /(?:^|[.;•]\s+)((?:an?|the)\s+)?([A-Za-zÇĞİÖŞÜçğıöşü][\w’'\-]*(?:\s+[\w’'\-()]+){0,3}?)\s+(?:is|are)\s+(?:defined as|called|known as|referred to as)\s+([^.]{12,220})/i
const ENV_TANIM_IS_RE = /(?:^|[.•]\s+)(?:An?|The)\s+([a-z][\w\-]*(?:\s[a-z][\w\-]*){0,2})\s+(?:is|are)\s+((?:the|a|an|someone|something|any|one|those)\s+[^.]{12,220})/
const ENV_TANIM_TR_RE = /^([A-ZÇĞİÖŞÜ][\wçğıöşüÇĞİÖŞÜ’'\-]*(?:\s+[\wçğıöşüÇĞİÖŞÜ’'\-]+){0,3})\s*[,;:]?\s+(.{12,220}?)\s+(?:olarak tanımlanır|denir|adı verilir)\.?$/
const ENV_KOLON_RE = /^(?:[•\-–*▪]\s*)?([A-ZÇĞİÖŞÜ][\w’'\-/()&çğıöşüÇĞİÖŞÜ]*(?:\s+[\w’'\-/()&çğıöşüÇĞİÖŞÜ]+){0,4})\s*[:–—]\s+(.{18,240})$/
const ENV_KOLON_YASAK_RE = /^(?:country|step|note|example|source|figure|table|chapter|week|lecture|slide|page|q\d|answer|key|main|remember|image|photo|picture|caption|topic|section|unit|objective|important|how|why|what|then|so|now|consider|suppose|assume|e\.g|i\.e|ex|grade|mid-?term|final|ders|hafta|örnek|kaynak|sayfa|şekil|tablo|soru|cevap)\b/i

function envNorm(s: string): string {
  return String(s || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9= +*/^-]/g, ' ').replace(/\s+/g, ' ').trim()
}
function envFormulNorm(s: string): string {
  return String(s || '').replace(/\\(?:times|cdot)/g, '*').replace(/\\(?:text|mathrm|operatorname)\s*/g, '').replace(/\\[a-zA-Z]+/g, '').replace(/[×·∙]/g, '*').replace(/[−–]/g, '-').replace(/[{}\s$\\]/g, '').toLowerCase()
}

/** Kaynak metinden envanter çıkarır. Her kategori sayfa sırasıyla, tekrarsız, sınırlı. */
export function kaynakEnvanteri(metin: string): Envanter {
  const env: Envanter = { tanimlar: [], formuller: [], listeler: [], vurgular: [], ciktilar: [], sorular: [], ornekler: ornekBul(metin, 8) }
  const gor = new Set<string>()
  const ilkKez = (k: string) => { const n = envNorm(k); if (!n || gor.has(n)) return false; gor.add(n); return true }
  /* satırlar sayfa numarasıyla tek dizide (başlık ile maddeleri arasında boş satır olabiliyor);
     PDF'in kırdığı satırlar birleştirilir: küçük harfle başlayan satır öncekinin devamıdır */
  const satir: string[] = [], sayfaOf: (number | null)[] = [], yonetimOf: boolean[] = []
  for (const b of ornekBolumle(metin)) {
    const yon = ORNEK_YONETIM_RE.test(b.metin)
    for (const ham of b.metin.split('\n')) {
      const l = ham.trim(); if (!l || /^\d{1,3}$/.test(l)) continue
      const onceki = satir[satir.length - 1]
      if (onceki && sayfaOf[satir.length - 1] === b.sayfa && /^[a-zçğıöşü(]/.test(l) && !/[.:?!;]$/.test(onceki) && onceki.length > 25 && !ENV_MADDE_RE.test(l)) { satir[satir.length - 1] = onceki + ' ' + l; continue }
      satir.push(l); sayfaOf.push(b.sayfa); yonetimOf.push(yon)
    }
  }
  {
    for (let i = 0; i < satir.length; i++) {
      const l = satir[i], b = { sayfa: sayfaOf[i] }, yonetim = yonetimOf[i]
      /* hocanın vurgusu: "KEY IDEA:" satırı; metin boşsa sonraki satır(lar) */
      const v = l.match(ENV_VURGU_RE)
      if (v) {
        let t = v[2].trim()
        if (t.length < 12 && satir[i + 1] && !ENV_VURGU_RE.test(satir[i + 1])) t = (t + ' ' + satir[i + 1]).trim()
        if (t.length >= 8 && ilkKez('v:' + t)) env.vurgular.push({ metin: t.slice(0, 260), sayfa: b.sayfa })
        continue
      }
      /* öğrenme çıktıları ve soru bölümü başlıkları: altındaki maddeler */
      if (ENV_CIKTI_RE.test(l) || ENV_SORU_BASLIK_RE.test(l)) {
        const cikti = ENV_CIKTI_RE.test(l)
        for (let j = i + 1; j < satir.length; j++) {
          const m = satir[j].match(ENV_MADDE_RE); const t = (m ? m[1] : satir[j]).trim()
          if (!m && j > i + 1 && !/^(will|to|be able|explain|describe)/i.test(t)) break
          if (t.length < 8) continue
          if (cikti) { if (ilkKez('c:' + t)) env.ciktilar.push(t.slice(0, 200)) }
          else if ((/\?\s*$/.test(t) || /^(explain|describe|discuss|define|compare|calculate|compute|show|list|identify|açıklayınız|tartışınız|hesaplayınız|karşılaştırınız)\b/i.test(t)) && ilkKez('s:' + t)) env.sorular.push({ soru: t.slice(0, 240), sayfa: b.sayfa })
          else if (!cikti && !/\?\s*$/.test(t)) break
        }
        continue
      }
      /* soru: '?' ile biten, en az 4 kelime; retorik "How?" / "So..." değil */
      if (/\?\s*$/.test(l) && l.split(/\s+/).length >= 4 && l.length <= 240 && !yonetim) {
        const t = l.replace(ENV_MADDE_RE, '$1').trim()
        if (ilkKez('s:' + t)) env.sorular.push({ soru: t, sayfa: b.sayfa })
      }
      /* formül: '=' + (işlem işareti ya da sembol sol taraf); sayısal örnek satırı değil */
      if (/=/.test(l) && l.length <= 160 && !/https?:|www\./.test(l) && !/^[A-E]\)\s/.test(l) && !((l.match(/=/g) || []).length >= 2 && /,/.test(l) && !/[+×*/^√Σ−]/.test(l))) {
        const ik = l.indexOf('='), ikn = l.lastIndexOf(':', ik)
        const parca = (ikn >= 0 ? l.slice(ikn + 1) : l).replace(ENV_MADDE_RE, '$1').trim()
        const [sol, ...sag] = parca.split('=')
        const sagM = sag.join('=').trim()
        const sembolSol = /^\s*(?:[A-ZΔΣ](?:[A-Z0-9_/'’ΔΣ]{0,4}|[a-z])|[a-zπλμσαβ](?:_?\w)?|[A-Z][a-z]?\([a-z]\))\s*$/.test(sol) || (/[+×*/^√Σ∫−]/.test(sol) && sol.length <= 30 && sol.trim().split(/\s+/).length <= 5)
        /* OCR bozuntusu (∫ yerine "/", "cosædx"): formül sayılmaz; o belgelerde formülü görsel okuma hattı çıkarıyor */
        const bozuk = /^\s*\//.test(parca) || /[^\x20-\x7E×·∙−–ΔΣπλμσαβθ√∫≤≥≠²³’]/.test(parca)
        const islemli = /[+×*/^√Σ∫−]|\s-\s/.test(parca) || /\\frac|\\sum/.test(parca)
        const sadeceSayi = /^\s*[$€£₺]?\s*\d[\d.,]*\s*%?\s*[a-zA-Zçşğüöı]{0,8}\s*$/.test(sagM)
        if (sol && sagM && sembolSol && !bozuk && (islemli || /^[A-Z][A-Za-z/]{0,5}$/.test(sol.trim())) && !sadeceSayi && ilkKez('f:' + envFormulNorm(parca)))
          env.formuller.push({ ifade: parca.slice(0, 140), sayfa: b.sayfa })
      }
      /* tanım: "X is defined as/called…", "A market is the set of…", "X: …", Türkçe "…denir" */
      if (!yonetim) {
        let terim = '', tanim = ''
        const k = l.match(ENV_TANIM_KALIP_RE) || l.match(ENV_TANIM_IS_RE)
        const tr = l.match(ENV_TANIM_TR_RE)
        const kol = l.match(ENV_KOLON_RE)
        const sonraki = satir[i + 1] || ''
        const basTerim = l.length <= 40 && !/[:?.!=]/.test(l) && l.split(/\s+/).length <= 4 && /^[A-ZÇĞİÖŞÜ]/.test(l) && !ENV_MADDE_RE.test(l) ? envNorm(l) : ''
        if (k) { terim = (k.length === 4 ? k[2] : k[1]).trim(); tanim = (k.length === 4 ? k[3] : k[2]).trim() }
        else if (basTerim && basTerim.length >= 4 && sonraki.split(/\s+/).length >= 8 && envNorm(sonraki).includes(basTerim) && /\b(when|if|is|are|means|refers|occurs|happens|describes|olduğunda|demektir|ifade eder)\b/i.test(sonraki)) { terim = l; tanim = sonraki }
        else if (tr) { terim = tr[1].trim(); tanim = tr[2].trim() }
        else if (kol && !KOLON_DEGIL(kol[1], kol[2])) { terim = kol[1].trim(); tanim = kol[2].trim() }
        tanim = tanim.replace(/^[•\-–*▪]\s*/, '')
        { const ic = tanim.match(/^([A-Z][\w\-]*(?:\s[a-z][\w\-]*){0,2})\s+(?:is|are)\s+(.{12,})$/); if (ic && /definition|tanım/i.test(terim)) { terim = ic[1]; tanim = ic[2] } }
        if (terim && tanim && terim.split(/\s+/).length <= 5 && tanim.split(/\s+/).length >= 4 && ilkKez('t:' + terim))
          env.tanimlar.push({ terim: terim.slice(0, 70), tanim: tanim.slice(0, 240), sayfa: b.sayfa })
      }
      /* numaralı liste / sınıflandırma: kısa başlık + en az 3 kısa madde */
      if (!yonetim && l.length <= 70 && !ENV_MADDE_RE.test(l) && !/[=(]|^\(|data from|source:/i.test(l) && (ENV_LISTE_BASLIK_RE.test(l) || /[:?]\s*$/.test(l))) {
        const maddeler: string[] = []
        for (let j = i + 1; j < satir.length && maddeler.length < 12; j++) {
          const m = satir[j].match(ENV_MADDE_RE)
          if (!m) { if (maddeler.length && satir[j].length < 60 && /^[–\-]\s/.test(satir[j])) continue; break }
          maddeler.push(m[1].replace(/\s+/g, ' ').trim().slice(0, 90))
        }
        const kisa = maddeler.length ? maddeler.reduce((t, x) => t + x.length, 0) / maddeler.length <= 70 : false
        if (maddeler.length >= (ENV_LISTE_BASLIK_RE.test(l) ? 3 : 4) && kisa && ilkKez('l:' + l)) env.listeler.push({ baslik: l.replace(/:\s*$/, '').replace(/^[•\-–*\s]+/, '').slice(0, 80), maddeler, sayfa: b.sayfa })
      }
    }
  }
  env.tanimlar = env.tanimlar.slice(0, 30); env.formuller = env.formuller.slice(0, 15); env.listeler = env.listeler.slice(0, 12)
  env.vurgular = env.vurgular.slice(0, 20); env.ciktilar = env.ciktilar.slice(0, 12); env.sorular = env.sorular.slice(0, 20)
  return env
}
/** "Country A: 2 hours", "Paid: TV" gibi tanım olmayan iki nokta satırları */
function KOLON_DEGIL(terim: string, tanim: string): boolean {
  if (ENV_KOLON_YASAK_RE.test(terim)) return true
  if (/^\d|^[$€£₺]/.test(tanim) || ornekSayilari(tanim).length >= 2) return true
  if (/^[A-ZÇĞİÖŞÜ\s\-]{4,}$/.test(terim) && terim.split(/\s+/).length > 4) return true // uzun BÜYÜK HARF başlık
  return false
}

/** Envanterin kartta karşılığı var mı? Kart dili kaynaktan farklıysa yalnız dilden bağımsız
    kategoriler (formül, örnek) ve İngilizce aslı parantez içinde yazılmış terimler ölçülür;
    öteki kategoriler "olcum: 'dil'" ile işaretlenir ve ekran sayıyı "kaynakta N" diye gösterir. */
export function kaynakKapsama(env: Envanter, kart: any, ayniDil: boolean): any {
  const metin = envNorm(JSON.stringify([kart?.summary, kart?.summary_executive, kart?.key_terms, kart?.key_points, kart?.sections, kart?.quiz_questions, kart?.tables, kart?.formulas, kart?.worked_examples, kart?.cloze_cards]))
  const terimler = (Array.isArray(kart?.key_terms) ? kart.key_terms : []).map((t: any) => envNorm(String(t?.term || '')))
  const duz = (v: any): string => typeof v === 'string' ? v : Array.isArray(v) ? v.map(duz).join(' ') : v && typeof v === 'object' ? Object.values(v).map(duz).join(' ') : ''
  const formuller = envFormulNorm(duz([kart?.formulas, kart?.worked_examples, kart?.key_points, kart?.key_terms]))
  const kelimeler = (s: string) => envNorm(s).split(' ').filter((w) => w.length >= 4)
  const icinde = (s: string, oran: number) => { const k = kelimeler(s); return !k.length || k.filter((w) => metin.includes(w)).length / k.length >= oran }
  const sonuc = (adlar: string[], tamam: (i: number) => boolean, olcum = 'sozcuk') => {
    const eksik: string[] = []; let n = 0
    adlar.forEach((a, i) => { if (tamam(i)) n++; else eksik.push(a) })
    return { bulunan: adlar.length, islenen: n, eksik: eksik.slice(0, 12), olcum }
  }
  const terimVar = (t: string) => { const n = envNorm(t); return terimler.some((x: string) => x.includes(n) || (n.length > 5 && n.includes(x) && x.length > 3)) || (ayniDil && metin.includes(n)) }
  const ok = ornekKapsama(env.ornekler, kart)
  const kt = Array.isArray(kart?.key_terms) ? kart.key_terms : []
  const parantezli = kt.length > 0 && kt.filter((t: any) => /\([^)]{3,}\)/.test(String(t?.term || ''))).length / kt.length >= 0.5
  return {
    tanimlar: ayniDil || parantezli ? sonuc(env.tanimlar.map((t) => t.terim), (i) => terimVar(env.tanimlar[i].terim), ayniDil ? 'sozcuk' : 'terim') : sonuc(env.tanimlar.map((t) => t.terim), () => false, 'dil'),
    formuller: sonuc(env.formuller.map((f) => f.ifade), (i) => {
      const ham = env.formuller[i].ifade, f = envFormulNorm(ham).replace(/[()]/g, ''), kf = formuller.replace(/[()]/g, '')
      /* "Q/L = Output per Unit of Labor": sağ taraf sözcük → sembolün kartta geçmesi yeter (dil bağımsız) */
      if (!/[+×*/^√Σ∫−\d]/.test(ham.split('=').slice(1).join('='))) return kf.includes(envFormulNorm(ham.split('=')[0]))
      return kf.includes(f) || kf.includes(f.split('=').reverse().join('='))
    }, 'formul'),
    listeler: ayniDil ? sonuc(env.listeler.map((l) => l.baslik), (i) => env.listeler[i].maddeler.filter((m) => icinde(m, 0.6)).length / env.listeler[i].maddeler.length >= 0.7) : sonuc(env.listeler.map((l) => l.baslik), () => false, 'dil'),
    vurgular: ayniDil ? sonuc(env.vurgular.map((v) => v.metin), (i) => icinde(env.vurgular[i].metin, 0.6)) : sonuc(env.vurgular.map((v) => v.metin), () => false, 'dil'),
    /* öğrenme çıktıları çoğu zaman bütün dersin listesidir (bu bölümde olmayan konular da var): eksik sayılmaz */
    ciktilar: { bulunan: env.ciktilar.length, islenen: env.ciktilar.length, eksik: [], olcum: 'bilgi' },
    sorular: ayniDil ? sonuc(env.sorular.map((s) => s.soru), (i) => icinde(env.sorular[i].soru, 0.6)) : sonuc(env.sorular.map((s) => s.soru), () => false, 'dil'),
    ornekler: { bulunan: ok.bulunan, islenen: ok.islenen, eksik: ok.eksik.map((e) => e.baslik), olcum: 'sayi' }
  }
}

/** Kaynağın dili kabaca: İngilizce işlev sözcükleri mi, Türkçe harfler mi ağır basıyor */
export function kaynakDili(metin: string): 'en' | 'tr' {
  const t = String(metin || '').slice(0, 20000).toLowerCase()
  const en = (t.match(/\b(the|and|of|is|are|to|in|with|for)\b/g) || []).length
  const tr = (t.match(/[çğışöü]/g) || []).length + 3 * (t.match(/\b(ve|bir|bu|ile|için|olarak|olan)\b/g) || []).length
  return tr > en ? 'tr' : 'en'
}

/** Pencere talimatına eklenen envanter satırları (boş kategori yazılmaz; uzunluk sınırlı). */
export function envanterTalimati(env: Envanter, farkliDil: boolean): string {
  const k = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s
  const satirlar: string[] = []
  if (env.tanimlar.length) satirlar.push(`definitions → key_terms (keep the source wording): ${env.tanimlar.slice(0, 14).map((t) => k(t.terim, 36)).join('; ')}`)
  if (env.formuller.length) satirlar.push(`formulas → formulas (latex, every variable explained): ${env.formuller.slice(0, 6).map((f) => k(f.ifade, 50)).join(' | ')}`)
  if (env.listeler.length) satirlar.push(`numbered lists → keep EVERY item (as a table or key_point): ${env.listeler.slice(0, 6).map((l) => `${k(l.baslik, 40)} (${l.maddeler.length})`).join('; ')}`)
  if (env.vurgular.length) satirlar.push(`the lecturer's emphasised ideas → key_points: ${env.vurgular.slice(0, 8).map((v) => '"' + k(v.metin, 60) + '"').join('; ')}`)
  if (env.ciktilar.length) satirlar.push(`learning outcomes → make sure each is answered somewhere: ${env.ciktilar.slice(0, 6).map((c) => k(c, 45)).join('; ')}`)
  if (env.sorular.length) satirlar.push(`the document's own questions → quiz_questions with answers: ${env.sorular.slice(0, 6).map((s) => k(s.soru, 60)).join(' | ')}`)
  if (!satirlar.length) return ''
  /* pencere çıktı tavanı bu satırın uzunluğu kadar kısalır: 1500 karakterde kes */
  satirlar.splice(0, satirlar.length, ...satirlar.map((x) => k(x, 420)))
  return `\n- SOURCE INVENTORY (must all appear in the output):\n  * ${satirlar.join('\n  * ')}${farkliDil ? '\n  * the output language differs from the source: write each key_term as "translated term (original term)"' : ''}`
}
/* KAYNAK ENVANTERİ SONU */

/** Deste istemine giden envanter: formül, liste (maddeleriyle), vurgu, tanım, soru, çıktı. */
export function envanterDokumu(env: Envanter): string {
  const p: string[] = []
  if (env.vurgular.length) p.push("LECTURER'S EMPHASIS:\n" + env.vurgular.slice(0, 12).map((v) => `- ${v.metin}${v.sayfa ? ' (p.' + v.sayfa + ')' : ''}`).join('\n'))
  if (env.formuller.length) p.push('FORMULAS:\n' + env.formuller.slice(0, 8).map((f) => '- ' + f.ifade).join('\n'))
  if (env.listeler.length) p.push('NUMBERED LISTS:\n' + env.listeler.slice(0, 8).map((l) => `- ${l.baslik} (${l.maddeler.length}): ${l.maddeler.join(' | ')}`).join('\n'))
  if (env.tanimlar.length) p.push('DEFINITIONS:\n' + env.tanimlar.slice(0, 20).map((t) => `- ${t.terim}: ${t.tanim}`).join('\n'))
  if (env.sorular.length) p.push("DOCUMENT'S QUESTIONS:\n" + env.sorular.slice(0, 10).map((q) => '- ' + q.soru).join('\n'))
  if (env.ciktilar.length) p.push('LEARNING OUTCOMES:\n' + env.ciktilar.slice(0, 8).map((c) => '- ' + c).join('\n'))
  return p.length ? '\n\n=== SOURCE INVENTORY (found in the lecture; cover all of it) ===\n' + p.join('\n\n') : ''
}

/* ---------------- eksik tamamlama (kaynak envanteri) ---------------- */
export const TAMAMLA_TALIMATI = (tr: boolean) => `You complete a student's study card with what it MISSED from the lecture. You get the lecture's inventory (definitions, formulas, numbered lists, the lecturer's emphasised ideas, the document's own questions, numerical examples) and what the card already has.
Return ONLY JSON: {"key_terms": [{"term": "...", "definition": "..."}], "formulas": [{"name": "...", "latex": "...", "variables": [{"symbol": "...", "meaning": "..."}]}], "key_points": ["..."], "tables": [{"title": "...", "headers": ["..."], "rows": [["..."]]}], "quiz_questions": [{"question": "...", "answer": "..."}], "worked_examples": [{"title": "...", "problem_statement": "...", "steps": ["..."], "final_answer": "..."}]}
Rules:
- Add ONLY items the card does not already cover (same idea in other words = covered). Never repeat an existing item.
- Language: ${tr ? 'Turkish; write key terms as "Türkçe terim (English original)" and keep formulas and symbols as in the source' : 'English, keeping the source wording'}.
- definitions → key_terms (one-sentence definition from the source); formulas → formulas (valid LaTeX, explain every variable); numbered lists → one table per list (headers ["#", "Item", "Meaning"], EVERY item as a row); emphasised ideas → key_points (one sentence each); the document's questions → quiz_questions with correct answers from the source; numerical examples → worked_examples with the source's exact numbers (3-6 steps) and their data table in tables.
- Never invent numbers, names or facts that are not in the inventory or examples.`

export function tamamlaIstemi(env: Envanter, kapsama: any, kart: any): string {
  const eksik = (ad: string) => kapsama?.[ad]?.olcum === 'dil' ? null : new Set((kapsama?.[ad]?.eksik || []) as string[])
  const sec = <T>(ad: string, liste: T[], anahtar: (x: T) => string) => { const e = eksik(ad); return e ? liste.filter((x) => e.has(anahtar(x))) : liste }
  const p: string[] = []
  const t = sec('tanimlar', env.tanimlar, (x) => x.terim); if (t.length) p.push('DEFINITIONS:\n' + t.map((x) => `- ${x.terim}: ${x.tanim}`).join('\n'))
  const f = sec('formuller', env.formuller, (x) => x.ifade); if (f.length) p.push('FORMULAS:\n' + f.map((x) => '- ' + x.ifade).join('\n'))
  const l = sec('listeler', env.listeler, (x) => x.baslik); if (l.length) p.push('NUMBERED LISTS:\n' + l.map((x) => `- ${x.baslik}: ${x.maddeler.join(' | ')}`).join('\n'))
  const v = sec('vurgular', env.vurgular, (x) => x.metin); if (v.length) p.push("LECTURER'S EMPHASIS:\n" + v.map((x) => '- ' + x.metin).join('\n'))
  const q = sec('sorular', env.sorular, (x) => x.soru); if (q.length) p.push("DOCUMENT'S QUESTIONS:\n" + q.map((x) => '- ' + x.soru).join('\n'))
  const okE = new Set((kapsama?.ornekler?.eksik || []) as string[]), o = env.ornekler.filter((x) => okE.has(x.baslik))
  if (o.length) p.push('NUMERICAL EXAMPLES:\n' + o.map((x, i) => `=== EXAMPLE ${i + 1}${x.sayfa ? ' (p.' + x.sayfa + ')' : ''} ===\n${x.metin}`).join('\n\n'))
  const ad = (v: any, k: string) => (Array.isArray(v) ? v : []).map((x: any) => str(x?.[k] ?? x, 90)).filter(Boolean)
  const var_ = [`key_terms: ${ad(kart.key_terms, 'term').join('; ')}`, `formulas: ${ad(kart.formulas, 'name').join('; ')}`, `tables: ${ad(kart.tables, 'title').join('; ')}`,
    `worked_examples: ${ad(kart.worked_examples, 'title').join('; ')}`, `quiz_questions: ${ad(kart.quiz_questions, 'question').join(' | ')}`, `key_points: ${ad(kart.key_points, '').join(' | ').slice(0, 3000)}`]
  return `=== LECTURE INVENTORY (possibly missing from the card) ===\n${p.join('\n\n')}\n\n=== THE CARD ALREADY HAS ===\n${var_.join('\n')}`
}

export function tamamlaTemizle(v: any) {
  const o = ornekCiktisiTemizle(v)
  return {
    key_terms: dizi(v?.key_terms, 30).map((t) => ({ term: str(t?.term, 120), definition: str(t?.definition, 500) })).filter((t) => t.term && t.definition),
    formulas: dizi(v?.formulas, 15).map((f) => ({ name: str(f?.name, 120), latex: str(f?.latex, 400), variables: dizi(f?.variables, 12).map((x) => ({ symbol: str(x?.symbol, 40), meaning: str(x?.meaning, 200) })).filter((x) => x.symbol) })).filter((f) => f.latex),
    key_points: dizi(v?.key_points, 25).map((k) => str(k, 400)).filter(Boolean),
    quiz_questions: dizi(v?.quiz_questions, 20).map((q) => ({ question: str(q?.question, 400), answer: str(q?.answer, 500) })).filter((q) => q.question && q.answer),
    tables: o.tables, worked_examples: o.worked_examples
  }
}

/** Eklenecekleri karta yazar; aynı terim/soru/formül/başlık ikinci kez eklenmez. */
export function birlesik(kart: any, ek: ReturnType<typeof tamamlaTemizle>) {
  const n = (s: unknown) => String(s || '').toLocaleLowerCase('tr').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const alanlar: any = {}, eklenen: Record<string, number> = {}
  const ekle = (alan: string, anahtar: (x: any) => string) => {
    const eski = Array.isArray(kart?.[alan]) ? kart[alan] : []
    const gor = new Set(eski.map((x: any) => n(anahtar(x))))
    const yeni = ((ek as any)[alan] as any[]).filter((x) => { const k = n(anahtar(x)); if (!k || gor.has(k)) return false; gor.add(k); return true })
    eklenen[alan] = yeni.length
    if (yeni.length) alanlar[alan] = [...eski, ...yeni]
  }
  ekle('key_terms', (x) => x.term); ekle('formulas', (x) => x.latex || x.name); ekle('key_points', (x) => x); ekle('tables', (x) => x.title)
  ekle('quiz_questions', (x) => x.question); ekle('worked_examples', (x) => x.title)
  return { alanlar, eklenen }
}

/* ---------------- eksik örnek çıkarıcı ---------------- */
export const ORNEK_TALIMATI = `You turn numerical examples from a lecture into exam-ready worked examples. Return ONLY JSON:
{"worked_examples": [{"title": "...", "problem_statement": "the setup with ALL the source's data", "steps": ["one comparison or calculation per step, with the numbers"], "final_answer": "the conclusion"}], "tables": [{"title": "...", "headers": ["..."], "rows": [["..."]]}]}
Rules: one worked_example per EXAMPLE block, in order; use the source's exact numbers and units, never invent or change a number; 3-6 steps; if the example has a data table, also copy it into "tables" (first column = row label); if a step uses a rule (e.g. "with L/Q, lower is better"), state it.`

export function ornekCiktisiTemizle(v: any): { worked_examples: any[]; tables: any[] } {
  const we = dizi(v?.worked_examples, 8).map((w) => ({
    title: str(w?.title, 140), problem_statement: str(w?.problem_statement, 1200),
    steps: dizi(w?.steps, 10).map((x) => str(x, 400)).filter(Boolean), final_answer: str(w?.final_answer, 500)
  })).filter((w) => w.title && w.steps.length && w.final_answer)
  const tb = dizi(v?.tables, 8).map((t) => ({
    title: str(t?.title, 140), headers: dizi(t?.headers, 8).map((h) => str(h, 60)),
    rows: dizi(t?.rows, 20).map((r) => dizi(r, 8).map((c) => str(c, 80))).filter((r) => r.length)
  })).filter((t) => t.rows.length && t.headers.length)
  return { worked_examples: we, tables: tb }
}

/* ---------------- başlık ---------------- */
export const BASLIK_TALIMATI = `From the first pages of a university course document, return ONLY a JSON object:
{"ders": "course name, e.g. Marketing Management, or empty", "bolum": "chapter/week/unit label, e.g. Chapter 1 or Week 9, or empty", "baslik": "the chapter or topic title WITHOUT the label, e.g. Defining Marketing for the New Realities"}
Copy the wording used in the document (keep its language). Never return a semester, date, university, instructor or "Course Introduction" as baslik. If there is no explicit title, write the main topic in max 8 words.`

export function baslikTemizle(v: any): { baslik: string; ders: string; bolum: string } {
  const t = (x: unknown, n: number) => str(x, n).replace(/\s+/g, ' ').replace(/^["'“”]+|["'“”]+$/g, '').trim()
  let baslik = t(v?.baslik, 140), bolum = t(v?.bolum, 40)
  const ders = t(v?.ders, 80)
  /* model etiketi başlığa da yazarsa ayır: "Chapter 1: Defining..." */
  const m = baslik.match(/^((?:chapter|ch\.?|week|unit|lecture|bölüm|hafta|ünite|ders)\s*\d+[a-z]?)\s*[:.\-–—]\s*(.+)$/i)
  if (m) { bolum = bolum || m[1]; baslik = m[2] }
  if (/^(course introduction|introduction|giriş|ders tanıtımı)$/i.test(baslik)) baslik = ''
  return { baslik, ders, bolum }
}

/* ---------------- PDF ---------------- */
/* Tarayıcıdan gelen HTML yalnız slayt belgesi olabilir; betik ve olay öznitelikleri
   atılır (Cloudflare'in tarayıcısında bizim adımıza kod çalışmasın). */
export function htmlTemizle(html: string): string | null {
  if (typeof html !== 'string' || html.length > HTML_SINIRI) return null
  if (!/^<!doctype html>/i.test(html.trim()) || !/class="oz-s[ "]/.test(html)) return null
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*>/gi, '')
    .replace(/<(iframe|object|embed|frame|frameset|base|form)\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*http-equiv[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

async function cloudflarePdf(html: string): Promise<{ pdf: Uint8Array; ms: string } | { hata: string; durum: number }> {
  const hesap = String(Deno.env.get('CF_ACCOUNT_ID') || '').trim()
  const anahtar = String(Deno.env.get('CF_API_TOKEN') || '').trim()
  if (!hesap || !anahtar) return { hata: 'pdf_kapali', durum: 501 }
  const govde = JSON.stringify({
    html,
    pdfOptions: { printBackground: true, preferCSSPageSize: true },
    gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 }
  })
  /* Ürünün adı "Browser Rendering" → "Browser Run" oldu (2026); eski yol da denenir. */
  for (const yol of ['browser-run', 'browser-rendering']) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${hesap}/${yol}/pdf`, {
      method: 'POST', headers: { Authorization: `Bearer ${anahtar}`, 'Content-Type': 'application/json' }, body: govde
    })
    if (res.status === 404 && yol === 'browser-run') continue
    const buf = new Uint8Array(await res.arrayBuffer())
    const pdfMi = buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 // %PDF
    if (res.ok && pdfMi) return { pdf: buf, ms: res.headers.get('X-Browser-Ms-Used') || '?' }
    const metin = new TextDecoder().decode(buf.slice(0, 300))
    console.warn(`ozet-slayt Cloudflare ${yol} ${res.status}: ${metin}`)
    return { hata: `cloudflare ${res.status}`, durum: res.status === 429 ? 429 : 502 }
  }
  return { hata: 'cloudflare yol bulunamadi', durum: 502 }
}

/* ---------------- sunucu ---------------- */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ mesaj: 'Yalnız POST.' }, 405)
  try {
    const govde = await req.json().catch(() => ({}))
    const islem = govde?.islem
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ mesaj: 'Oturum gerekli.' }, 401)
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: u } = await userClient.auth.getUser()
    const kullanici = u?.user
    if (!kullanici) return json({ mesaj: 'Oturum gerekli.' }, 401)

    const gunlukSay = async (tur: string): Promise<number> => {
      const { count, error } = await service.from('ozet_slayt_kullanim').select('id', { count: 'exact', head: true })
        .eq('user_id', kullanici.id).eq('tur', tur).gte('created_at', new Date(Date.now() - 864e5).toISOString())
      if (error) { console.warn('ozet_slayt_kullanim okunamadi:', error.message); return 0 }
      return count || 0
    }
    const kaydet = (tur: string) => service.from('ozet_slayt_kullanim').insert({ user_id: kullanici.id, tur }).then(({ error }) => { if (error) console.warn('kullanim yazilamadi:', error.message) })

    if (islem === 'pdf') {
      const html = htmlTemizle(govde?.html)
      if (!html) return json({ mesaj: 'Geçersiz slayt belgesi.' }, 400)
      if (await gunlukSay('pdf') >= GUNLUK_PDF) return json({ mesaj: 'Bugünlük PDF sınırına ulaştın.' }, 429)
      const r = await cloudflarePdf(html)
      if ('hata' in r) return json({ mesaj: r.hata }, r.durum)
      await kaydet('pdf')
      console.log(`ozet-slayt PDF: ${r.pdf.length} bayt, tarayici ${r.ms} ms`)
      return new Response(r.pdf, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="acadex-slaytlar.pdf"' } })
    }

    /* SAYISAL ÖRNEKLER (24.11.2026). 'ornek-kontrol': kaynakta bulunan örneklerden hangileri
       kartta işlenmemiş (yalnız veritabanı, model yok). 'ornekler': eksikleri yalnız o sayfalardan
       çıkarıp karta çözümlü örnek + tablo olarak ekler (kartın sahibi; günlük üretim sınırına sayılır).
       Ekleme sonrası slayt destesi silinir ki bir sonraki açılışta "cozum" slaytlarıyla yeniden üretilsin. */
    if (islem === 'ornek-kontrol' || islem === 'ornekler' || islem === 'kaynak-kontrol' || islem === 'tamamla') {
      const kartId = String(govde?.kartId || '')
      const { data: card } = await userClient.from('study_cards').select('*').eq('id', kartId).single()
      if (!card) return json({ mesaj: 'Özet bulunamadı.' }, 404)
      const docIds: string[] = card.is_merged && Array.isArray(card.source_documents) ? card.source_documents.map((d: any) => d?.id).filter(Boolean) : (card.document_id ? [card.document_id] : [])
      if (!docIds.length) return json({ bulunan: 0, islenen: 0, eksik: [], kapsama: {} })
      const { data: parcalar } = await service.from('document_chunks').select('text, chunk_index, document_id').in('document_id', docIds).order('document_id').order('chunk_index', { ascending: true }).limit(400)
      const belge = (parcalar || []).map((r: any) => String(r.text || '')).join('\n\n').slice(0, BELGE_SINIRI)
      const env = kaynakEnvanteri(belge)
      const ayniDil = (kaynakDili(belge) === 'en') === (card.summary_language === 'en')
      const eskiKK = card.quality_meta && typeof card.quality_meta === 'object' ? card.quality_meta.kaynak_kapsama || {} : {}
      const kapsamaOlc = (k: any) => {
        const kk = kaynakKapsama(env, k, ayniDil)
        /* dilden ötürü ölçülemeyen kategoride, tamamlama sonrası modelin kararı geçerli */
        for (const ad of Object.keys(kk)) if (kk[ad].olcum === 'dil' && eskiKK[ad]?.olcum === 'model' && eskiKK[ad]?.bulunan === kk[ad].bulunan) kk[ad] = eskiKK[ad]
        return kk
      }
      const kapsama = kapsamaOlc(card)
      const ornekK = ornekKapsama(env.ornekler, card)
      if (islem === 'ornek-kontrol') return json(ornekK)
      if (islem === 'kaynak-kontrol') return json({ kapsama, ayniDil })
      /* tamamla (ve eski ad 'ornekler'): eksikleri karta ekle */
      const eksikVar = Object.values(kapsama).some((v: any) => v.olcum !== 'bilgi' && (v.eksik?.length || (v.olcum === 'dil' && v.bulunan > v.islenen)))
      if (!eksikVar) return json({ kapsama, eklenen: 0, worked_examples: card.worked_examples || [], tables: card.tables || [] })
      if (card.user_id !== kullanici.id) return json({ mesaj: 'Yalnız kendi özetine ekleme yapabilirsin.' }, 403)
      if (await gunlukSay('uret') >= GUNLUK_URET) return json({ mesaj: 'Bugünlük sınıra ulaştın; yarın yeniden dene.' }, 429)
      const istem = tamamlaIstemi(env, kapsama, card)
      let sonuc: { veri: any; model: string } | { hata: string } = { hata: 'anahtar yok' }
      const gKey = Deno.env.get('GEMINI_API_KEY'), qKey = Deno.env.get('GROQ_API_KEY')
      const talimat = TAMAMLA_TALIMATI(card.summary_language === 'tr')
      if (gKey) sonuc = await geminiUret(gKey, talimat, istem)
      if ('hata' in sonuc && qKey) sonuc = await groqUret(qKey, talimat, istem.slice(0, 14000))
      if ('hata' in sonuc) return json({ mesaj: 'Eksikler şu an eklenemedi. Biraz sonra yeniden dene.' }, 502)
      const ek = tamamlaTemizle(sonuc.veri)
      const birlestir = birlesik(card, ek)
      const toplam = Object.values(birlestir.eklenen).reduce((t: number, n: any) => t + n, 0)
      if (!toplam) return json({ mesaj: 'Eklenecek yeni bir şey bulunamadı.', kapsama }, 200)
      await kaydet('uret')
      const yeniKart = { ...card, ...birlestir.alanlar }
      const sonKapsama = kaynakKapsama(env, yeniKart, ayniDil)
      for (const ad of Object.keys(sonKapsama)) if (sonKapsama[ad].olcum === 'dil') sonKapsama[ad] = { ...sonKapsama[ad], islenen: sonKapsama[ad].bulunan, eksik: [], olcum: 'model' }
      const { error } = await service.from('study_cards').update({
        ...birlestir.alanlar, slayt: null,
        quality_meta: { ...(card.quality_meta && typeof card.quality_meta === 'object' ? card.quality_meta : {}), kaynak_kapsama: sonKapsama, ornek_kapsama: ornekKapsama(env.ornekler, yeniKart) }
      }).eq('id', card.id)
      if (error) return json({ mesaj: 'Kaydedilemedi: ' + error.message }, 500)
      console.log(`ozet-slayt tamamla: kart ${card.id}, eklenen ${JSON.stringify(birlestir.eklenen)} (${sonuc.model})`)
      return json({ ...birlestir.alanlar, kapsama: sonKapsama, eklenen: toplam, eklenenler: birlestir.eklenen })
    }

    /* islem:'baslik' (24.11.2026): özet ekranının başlığı "Chapter 1" yerine belgenin gerçek
       konusu olsun. Kart başına bir kez, yalnız kartın sahibi; sonuç outline'a yazılır
       (document_title_guess, course_guess, bolum_guess) ve sonra hep oradan okunur. */
    if (islem === 'baslik') {
      const kartId = String(govde?.kartId || '')
      const { data: card } = await userClient.from('study_cards').select('id, user_id, document_id, is_merged, source_documents, outline, slayt, summary_executive').eq('id', kartId).single()
      if (!card) return json({ mesaj: 'Özet bulunamadı.' }, 404)
      const o = card.outline && typeof card.outline === 'object' && !Array.isArray(card.outline) ? card.outline : {}
      if (str(o.document_title_guess)) return json({ baslik: str(o.document_title_guess, 140), ders: str(o.course_guess, 80), bolum: str(o.bolum_guess, 40) })
      if (card.user_id !== kullanici.id) return json({ baslik: '' })
      let bilgi = { baslik: '', ders: '', bolum: '' }
      if (card.slayt?.deste?.baslik) bilgi = { baslik: str(card.slayt.deste.baslik, 140), ders: str(card.slayt.deste.ders, 80), bolum: '' }
      else {
        const docIds: string[] = card.is_merged && Array.isArray(card.source_documents) ? card.source_documents.map((d: any) => d?.id).filter(Boolean) : (card.document_id ? [card.document_id] : [])
        if (!docIds.length) return json({ baslik: '' })
        const { data: docs } = await service.from('documents').select('file_name').in('id', docIds)
        const { data: parcalar } = await service.from('document_chunks').select('text').eq('document_id', docIds[0]).order('chunk_index', { ascending: true }).limit(3)
        const ilk = (parcalar || []).map((r: any) => String(r.text || '')).join('\n').slice(0, 5000)
        const istem = `FILE NAME: ${(docs || []).map((d: any) => d.file_name).join(', ')}\nSUMMARY: ${str(card.summary_executive, 600)}\n\nFIRST PAGES:\n${ilk || '(not available)'}`
        let sonuc: { veri: any; model: string } | { hata: string } = { hata: 'anahtar yok' }
        const gKey = Deno.env.get('GEMINI_API_KEY'), qKey = Deno.env.get('GROQ_API_KEY')
        if (gKey) sonuc = await geminiUret(gKey, BASLIK_TALIMATI, istem)
        if ('hata' in sonuc && qKey) sonuc = await groqUret(qKey, BASLIK_TALIMATI, istem)
        if ('hata' in sonuc) return json({ baslik: '' })
        bilgi = baslikTemizle(sonuc.veri)
      }
      if (!bilgi.baslik) return json({ baslik: '' })
      const { error } = await service.from('study_cards').update({ outline: { ...o, document_title_guess: bilgi.baslik, course_guess: bilgi.ders, bolum_guess: bilgi.bolum } }).eq('id', card.id)
      if (error) console.warn('baslik kaydedilemedi:', error.message)
      return json(bilgi)
    }

    if (islem !== 'uret') return json({ mesaj: 'Bilinmeyen işlem.' }, 400)
    const kartId = String(govde?.kartId || '')
    if (!kartId) return json({ mesaj: 'kartId gerekli.' }, 400)
    const { data: card, error: kartHata } = await userClient.from('study_cards').select('*').eq('id', kartId).single()
    if (kartHata || !card) return json({ mesaj: 'Özet bulunamadı ya da erişim yok.' }, 404)
    if (!('slayt' in card)) return json({ mesaj: 'Veritabanı güncellemesi eksik (20261122d_ozet_slayt.sql).' }, 503)
    if (card.slayt?.deste && !govde?.yenile) return json({ deste: card.slayt.deste, uretildi: card.slayt.uretildi, model: card.slayt.model, onbellek: true })
    if (await gunlukSay('uret') >= GUNLUK_URET) return json({ mesaj: 'Bugün çok slayt ürettin; yarın yeniden dene.' }, 429)

    /* kaynak metin: özet + belgenin kayıtlı parçaları */
    const docIds: string[] = card.is_merged && Array.isArray(card.source_documents) ? card.source_documents.map((d: any) => d?.id).filter(Boolean) : (card.document_id ? [card.document_id] : [])
    let belge = '', dosya = ''
    if (docIds.length) {
      const { data: docs } = await service.from('documents').select('id, file_name').in('id', docIds)
      dosya = (docs || []).map((d: any) => d.file_name).filter(Boolean).join(', ')
      const { data: parcalar } = await service.from('document_chunks').select('text, chunk_index, document_id').in('document_id', docIds).order('document_id').order('chunk_index', { ascending: true }).limit(400)
      belge = (parcalar || []).map((r: any) => String(r.text || '')).join('\n\n').slice(0, BELGE_SINIRI)
    }
    const ozet = kartDokumu(card)
    if (!ozet && !belge) return json({ mesaj: 'Bu özette slayta dönüştürülecek içerik yok.' }, 400)
    const ikidil = card.summary_language !== 'tr'
    const ornekler = ornekBul(belge, 6)
    const ornekMetni = ornekler.length ? `\n\n=== NUMERICAL EXAMPLES (${ornekler.length}) — one "cozum" slide each ===\n` + ornekler.map((o, i) => `[${i + 1}] ${o.sayfa ? 'p.' + o.sayfa + ' ' : ''}${o.metin}`).join('\n\n') : ''
    const envD = kaynakEnvanteri(belge)
    const envMetni = envanterDokumu(envD)
    const istem = `SOURCE FILE: ${dosya || '-'}\nSUMMARY LANGUAGE: ${card.summary_language || 'en'}\n\n=== STUDY SUMMARY (already verified) ===\n${ozet}${ornekMetni}${envMetni}\n\n=== SOURCE TEXT (chapter) ===\n${belge || '(not available — use the summary)'}`

    let sonuc: { veri: any; model: string } | { hata: string } = { hata: 'anahtar yok' }
    const gKey = Deno.env.get('GEMINI_API_KEY')
    if (gKey) sonuc = await geminiUret(gKey, sistemTalimati(ikidil), istem)
    if ('hata' in sonuc) {
      const qKey = Deno.env.get('GROQ_API_KEY')
      if (qKey) {
        /* yedek modelin bütçesi dar: özet + örnek sayfaları (örnekler en çok bunu kaybediyordu) */
        const kisa = `SOURCE FILE: ${dosya || '-'}\n\n=== STUDY SUMMARY ===\n${kartDokumu(card, 4500)}${ornekMetni.slice(0, 3000)}${envMetni.slice(0, 2500)}`
        const g = await groqUret(qKey, sistemTalimati(ikidil, true), kisa)
        if (!('hata' in g)) sonuc = g
        else console.warn('ozet-slayt Groq basarisiz:', g.hata)
      }
    }
    if ('hata' in sonuc) return json({ mesaj: 'Slaytlar şu an hazırlanamadı. Biraz sonra yeniden dene.' }, 502)

    const deste = desteNormalize(sonuc.veri, { kaynak: dosya, ikidil })
    if (deste.slaytlar.length < 4) return json({ mesaj: 'Slaytlar eksik üretildi. Yeniden dene.' }, 502)
    const kayit = { surum: 1, uretildi: new Date().toISOString(), model: sonuc.model, deste }
    await kaydet('uret')
    if (card.user_id === kullanici.id) {
      const { error } = await service.from('study_cards').update({ slayt: kayit }).eq('id', card.id)
      if (error) console.warn('slayt kaydedilemedi:', error.message)
    }
    console.log(`ozet-slayt uretildi: kart ${card.id}, ${deste.slaytlar.length} slayt, ${sonuc.model}`)
    return json({ deste, uretildi: kayit.uretildi, model: kayit.model })
  } catch (e) {
    console.error('ozet-slayt hata:', e)
    return json({ mesaj: 'Beklenmeyen bir hata oldu.' }, 500)
  }
})
