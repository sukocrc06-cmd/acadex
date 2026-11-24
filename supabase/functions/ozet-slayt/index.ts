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
const TURLER = ['harita', 'kartlar', 'surec', 'tablo', 'ornek', 'sorular', 'tekrar']
const RENKLER = ['lacivert', 'turuncu', 'yesil', 'kirmizi']
const TUR_RENK: Record<string, string> = { harita: 'lacivert', kartlar: 'lacivert', surec: 'kirmizi', tablo: 'turuncu', ornek: 'yesil', sorular: 'kirmizi', tekrar: 'kirmizi' }

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
    if (s.tur === 'tekrar') x.kutular = dizi(s.kutular, 12).map((k) => ({ simge: str(k?.simge, 8), baslik: str(k?.baslik, 40), metin: str(k?.metin, 170), tr: str(k?.tr, 110) })).filter((k) => k.baslik)
    const bos = (x.tur === 'harita' && !x.ogeler.length) || (x.tur === 'kartlar' && !x.kartlar.length) || (x.tur === 'surec' && !x.adimlar.length) ||
      (x.tur === 'tablo' && !x.satirlar.length) || (x.tur === 'ornek' && !x.metin) || (x.tur === 'sorular' && !x.sorular.length) || (x.tur === 'tekrar' && !x.kutular.length)
    if (!bos && x.baslik) out.slaytlar.push(x)
  }
  if (!out.ikidil) out.slaytlar.forEach((s: any) => { s.etiket_tr = ''; s.baslik_tr = '' })
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
- "ornek": model exam answer ("Write it like this"). metin: 3-5 short paragraphs separated by \\n\\n, 110-170 words, simple academic English, **bold** key terms; it must define the concept, give an example from the source, and end with "In conclusion, ...". yan: {simge, baslik:"Answer formula" or "Logic map", maddeler: 3-4 short lines, tr}. ek: optional one-line bonus tip.
- "sorular": 4-6 likely exam questions. sorular: [{soru, tr, ipucu (keywords of the answer, not the full answer), yildiz}].
- "tekrar": final cheat sheet. kutular: 8-12 boxes {simge, baslik (1-3 words), metin (max 18 words), tr (max 6 words)}. The last box is "Exam tips".
not (optional callout): {tur: "ipucu"|"uyari"|"bilgi", simge (emoji), baslik (2-3 words), metin (max 30 words), tr}. Use "uyari" for common mistakes / confusions, "ipucu" for exam tips, "bilgi" for an extra fact.

DECK PLAN (${yedek ? '9-12' : '12-18'} slides, in the source's order):
1. one "harita"; 2. "kartlar" slides covering EVERY major topic of the chapter (do not skip lists, definitions, typologies); 3. at least one "tablo" when the source has types/categories/states; 4. at least one "surec" when there is an evolution, process or sequence; 5. ${yedek ? '1' : '2'} "ornek" model answers for the most likely essay questions (one may compare two concepts); 6. one "sorular"; 7. optionally one "kartlar" writing toolkit with 4 cards of useful phrases (Define / Compare / Example / Conclude); 8. one "tekrar" as the LAST slide.

STYLE RULES
- Main language = the language of the source. Simple, clear English (B1-B2) if the source is English: short sentences, one idea per sentence, keep technical terms exactly as the source uses them.
- ${ikidil ? 'Every "tr" field: natural, short Turkish (not word-by-word), max 12 words. Turkish technical terms as used in Turkish universities.' : 'The source is Turkish: write everything in Turkish and leave every "tr", "baslik_tr" and "etiket_tr" field EMPTY ("").'}
- Ground everything in the provided source and summary. Prefer examples, numbers, names and cases that appear in the source. If the source has no example for a key concept, add one short everyday example starting with "e.g.".
- yildiz = estimated exam importance: 3 = core definition, numbered list, learning objective or repeatedly emphasised idea; 2 = important supporting idea; 1 = background; 0 = no stars (use 0 for "ornek", "sorular" slides' own yildiz and for toolkit slides).
- Emojis: one fitting emoji per card/item; never use emojis inside sentences.
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
    const istem = `SOURCE FILE: ${dosya || '-'}\nSUMMARY LANGUAGE: ${card.summary_language || 'en'}\n\n=== STUDY SUMMARY (already verified) ===\n${ozet}\n\n=== SOURCE TEXT (chapter) ===\n${belge || '(not available — use the summary)'}`

    let sonuc: { veri: any; model: string } | { hata: string } = { hata: 'anahtar yok' }
    const gKey = Deno.env.get('GEMINI_API_KEY')
    if (gKey) sonuc = await geminiUret(gKey, sistemTalimati(ikidil), istem)
    if ('hata' in sonuc) {
      const qKey = Deno.env.get('GROQ_API_KEY')
      if (qKey) {
        const kisa = `SOURCE FILE: ${dosya || '-'}\n\n=== STUDY SUMMARY ===\n${kartDokumu(card, 6000)}`
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
