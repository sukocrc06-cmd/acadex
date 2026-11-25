// ==========================================================================
// Acadex Kids · ses tanıma yedeği (supabase/functions/kids-ses-tanima/index.ts), 20.11.2026
// Cihazın kendi ses tanıması olmayan tarayıcılarda (Firefox, bazı tabletler, uygulama içi
// tarayıcılar) çocuğun söylediği kısa ses parçası buraya gelir, Groq Whisper ile yazıya
// çevrilir ve yazı döner. Ses HİÇBİR yerde saklanmaz, kayda (log) yazılmaz; yalnız boyutu.
// İstemci: kids/assets/kids-dinle.js (sunucuDinle).
//
// İstek:  POST ?dil=en|tr&ipucu=car, bus   gövde: ham ses (webm / mp4 / ogg / wav), en çok 600 KB
// Yanıt:  { metin: "car" }
// Koruma: yalnız Acadex adresleri (Origin), IP başına dakikada 40 istek, boyut ve süre sınırı.
// Kurulum (proje klasöründe):
//   npx supabase functions deploy kids-ses-tanima --project-ref yrcdvcsowblzmkpbmkut --no-verify-jwt
//   (GROQ_API_KEY zaten tanımlı: ingilizce-hoca / generate-exam de kullanıyor)
// --no-verify-jwt: Kids girişleri Supabase oturumu taşımaz; koruma yukarıdaki sınırlarla yapılır.
// ==========================================================================

const IZINLI = [/^https:\/\/(www\.)?acadex\.com\.tr$/, /^https:\/\/(www\.)?acadex\.tr$/, /^https:\/\/([a-z0-9-]+\.)?acadex-4vp\.pages\.dev$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/]
const EN_FAZLA = 600 * 1024
const DAKIKA_SINIR = 40
const sayac = new Map<string, { n: number; t: number }>()

function cors(origin: string | null) {
  const ok = origin && IZINLI.some((r) => r.test(origin))
  return {
    'Access-Control-Allow-Origin': ok ? origin! : 'https://acadex.com.tr',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
const json = (o: unknown, durum: number, h: Record<string, string>) => new Response(JSON.stringify(o), { status: durum, headers: { ...h, 'Content-Type': 'application/json' } })

function sinirda(ip: string) {
  const simdi = Date.now(), x = sayac.get(ip)
  if (!x || simdi - x.t > 60_000) { sayac.set(ip, { n: 1, t: simdi }); return false }
  x.n++
  if (sayac.size > 5000) sayac.clear()
  return x.n > DAKIKA_SINIR
}

const UZANTI: Record<string, string> = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3' }

Deno.serve(async (req) => {
  const origin = req.headers.get('origin'), h = cors(origin)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })
  if (req.method !== 'POST') return json({ hata: 'yalnız POST' }, 405, h)
  if (!origin || !IZINLI.some((r) => r.test(origin))) return json({ hata: 'izinsiz adres' }, 403, h)
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'yok'
  if (sinirda(ip)) return json({ hata: 'çok sık' }, 429, h)

  const u = new URL(req.url)
  const dil = u.searchParams.get('dil') === 'tr' ? 'tr' : 'en'
  const ipucu = (u.searchParams.get('ipucu') || '').replace(/[^\p{L}\p{N} ,'-]/gu, '').slice(0, 200)
  const tur = (req.headers.get('content-type') || 'audio/webm').split(';')[0].trim().toLowerCase()
  if (!UZANTI[tur]) return json({ hata: 'ses biçimi desteklenmiyor' }, 415, h)

  const ses = new Uint8Array(await req.arrayBuffer())
  if (!ses.length) return json({ metin: '' }, 200, h)
  if (ses.length > EN_FAZLA) return json({ hata: 'ses çok uzun' }, 413, h)

  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) return json({ hata: 'sunucu ayarı eksik' }, 500, h)

  const fd = new FormData()
  fd.append('file', new Blob([ses], { type: tur }), 'ses.' + UZANTI[tur])
  fd.append('model', Deno.env.get('KIDS_WHISPER_MODEL') || 'whisper-large-v3-turbo')
  fd.append('language', dil)
  fd.append('temperature', '0')
  fd.append('response_format', 'json')
  /* ipucu: beklenen kelimeler; Whisper çocuk telaffuzunu bunlara yakın yazar */
  if (ipucu) fd.append('prompt', dil === 'en' ? 'A child says one English word: ' + ipucu + '.' : 'Bir çocuk kısa bir komut söylüyor: ' + ipucu + '.')

  try {
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd, signal: AbortSignal.timeout(8000) })
    if (!r.ok) { console.log('kids-ses-tanima groq', r.status, ses.length); return json({ hata: 'tanıma olmadı' }, 502, h) }
    const j = await r.json()
    const metin = String(j?.text || '').trim().slice(0, 200)
    console.log('kids-ses-tanima ok', dil, ses.length, 'bayt')
    return json({ metin }, 200, h)
  } catch (e) {
    console.log('kids-ses-tanima hata', String(e).slice(0, 120))
    return json({ hata: 'tanıma olmadı' }, 502, h)
  }
})
