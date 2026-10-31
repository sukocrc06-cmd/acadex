import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { extractText, getDocumentProxy } from "npm:unpdf"
import mammoth from "npm:mammoth@1.6.0"
import JSZip from "npm:jszip@3.10.1"
import { PDFDocument } from "npm:pdf-lib@1.17.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// timeoutMs bounds EACH attempt via AbortController. This function typically
// runs as one of several SEQUENTIAL Groq calls in a single request (draft
// then review, or chunk-map then synthesis then review) — without a cap, a
// single slow/hanging attempt (plus its own retries) can quietly burn through
// the edge function's entire execution budget, so that by the time a later
// pass (e.g. the review call) runs, there's no time left and every attempt
// fails the same way, exhausting retries for a reason retrying can't fix.
/**
 * Groq's suggested wait, in ms, from a 429 body.
 *
 * The format is "Please try again in 3m2.736s" — minutes AND seconds. The
 * old pattern was /try again in ([\d.]+)s/, which skipped the "3m" and read
 * that as 2.7 seconds: a 182-second wait understood as three. Live example
 * from 05.10.2026: "try again in 5m16.656s".
 */
function parseGroqRetryAfterMs(body: string): number | null {
  const m = body.match(/try again in (?:(\d+)m)?([\d.]+)s/i)
  if (!m) return null
  const minutes = m[1] ? parseInt(m[1], 10) : 0
  const seconds = parseFloat(m[2]) || 0
  const ms = (minutes * 60 + seconds) * 1000
  return Number.isFinite(ms) && ms > 0 ? Math.ceil(ms) : null
}

/**
 * Is this 429 a DAILY quota (TPD/RPD), rather than a per-minute one?
 *
 * The distinction decides whether waiting can possibly help. A per-minute
 * limit clears in under a minute, so waiting and retrying is right. A daily
 * limit does not:
 *
 *   Rate limit reached for `openai/gpt-oss-120b` ... on tokens per day (TPD):
 *   Limit 200000, Used 196725, Requested 3698. Please try again in 3m2.736s
 *
 * On 05.10.2026 the code could not tell them apart. It treated the daily cap
 * as a per-minute one: each failed window retried, every retry recorded its
 * estimate into the per-MINUTE ledger, that ledger filled, and the pacer then
 * waited 60 seconds for a window rollover that was never the problem. Three
 * attempts, ~2 minutes of pointless waiting, no summary, and a user-facing
 * error that said nothing about the actual cause.
 *
 * Nothing in this function's gift fixes a spent daily quota, so the only
 * useful response is to stop immediately and say so.
 */
function isDailyQuotaError(body: string): boolean {
  return /\b(TPD|RPD)\b/i.test(body) || /tokens per day|requests per day/i.test(body)
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2, timeoutMs = 25000): Promise<Response> {
  // GEMINI_MODE=parallel: Groq'a giden HER cagri (callGroqJson, gorsel
  // gecisler, review) burada Gemini'ye cevrilir — bkz. groqViaGemini.
  /* YEDEK YOLU (28.10.2026). Paralel modda Groq'a giden her cagri Gemini'ye
     cevriliyordu ve Gemini olunce geriye dusecek yer YOKTU: 19:03 ve 19:07
     kosularinda dort modelin dordu de (iki kota, iki 503) dustu, "All windows
     failed" sonrasi nobetci 141 saniyede belgeyi 'failed' isaretledi. only
     modunda boyle bir sey olmuyordu cunku Groq devralıyordu.
     Artik denenecek diri model kalmadiysa yakalama hic yapilmiyor ve cagri
     GERCEK Groq'a gidiyor — kart ucuz yoldan da olsa cikiyor. */
  if (url === GROQ_CHAT_URL && geminiParallelActive()) {
    if (geminiDiriAdayVar()) return groqViaGemini(options, maxRetries, timeoutMs)
    console.warn('Gemini paralel: diri aday model kalmadi — cagri GERCEK Groq yoluna birakiliyor')
  }
  let lastRateLimitedResponse: Response | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId)
      if (response.ok) return response;
      if (response.status === 429) {
        // Rate limited. Log the actual reason (e.g. Groq's TPM-exceeded
        // message) so it's visible in the function logs without a separate
        // dashboard lookup, keep this response so we can return it (instead
        // of throwing an opaque error) if every attempt is exhausted, then
        // wait before retrying.
        lastRateLimitedResponse = response
        let bodyPreview = ""
        try { bodyPreview = await response.clone().text() } catch (_readErr) { /* ignore — body may not be readable twice in all runtimes */ }
        console.warn(`fetchWithRetry: 429 rate-limited (attempt ${attempt + 1}/${maxRetries + 1}): ${bodyPreview}`)
        // A daily cap cannot be waited out inside one request. Hand the
        // response straight back so the caller fails fast with the real
        // reason, instead of burning the pipeline budget on retries that
        // are guaranteed to return the same 429.
        if (isDailyQuotaError(bodyPreview)) {
          console.error('fetchWithRetry: GUNLUK kota (TPD/RPD) doldu — yeniden denenmeyecek')
          return response
        }
        // Two distinct Groq 429 shapes here: "Request too large ... Requested
        // X" (this single request's own tokens exceed the limit — shrinking
        // it helps, waiting doesn't) vs. "Rate limit reached ... Used X,
        // Requested Y. Please try again in Z s" (the per-minute window is
        // already spent from earlier calls — no amount of shrinking this
        // request helps until the window rolls over, so we must actually
        // wait). Parse Groq's own suggested wait time when present.
        /* SON DENEMEDEN SONRA BEKLENMEZ (25.10.2026): bekleme yalnizca bir
           SONRAKI denemeye yer acmak icin. maxRetries=0 cagrilar (review,
           yazar) burada 30 sn'ye kadar bos bekleyip sonra 429'u donduruyordu
           — 150 sn duvarina en yakin yerde. */
        if (attempt >= maxRetries) break
        const suggested = parseGroqRetryAfterMs(bodyPreview)
        const waitMs = suggested !== null ? Math.min(suggested + 500, 30000) : 2500
        await new Promise(r => setTimeout(r, waitMs));
      } else if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 800));
      } else {
        return response; // let the caller handle non-retryable errors normally
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  // Every attempt came back 429 — return the last rate-limited response so
  // the caller's normal "!response.ok" handling can log/react to the real
  // reason, instead of surfacing a generic "Max retries exceeded" with no
  // diagnostic detail.
  if (lastRateLimitedResponse) return lastRateLimitedResponse
  throw new Error("Max retries exceeded");
}

// Defensive safety net: reasoning-capable Groq models (qwen/qwen3.8-27b,
// openai/gpt-oss-120b) can prepend a <think>...</think> block to "content"
// even with reasoning turned down/off via reasoning_effort/include_reasoning
// below — strip it so a stray thinking block never breaks a JSON.parse call.
// Returns null if the block is unterminated (the model ran out of its token
// budget mid-thought before ever writing the real answer) — callers should
// treat that as a failure rather than trying to parse what's left.
/* ===========================================================================
   LATEX TERS BOLULERI JSON'DA SESSIZCE BOZULUYOR
   ===========================================================================
   08.10.2026, canli ekonometri destesinde olculdu. Ozetin bolum maddeleri
   PDF'te soyle cikiyordu:

     - Quadratic model: (y =
     - Marginal effect: (
     - Log-linear: (ln y =

   Yani formulun ortasinda kesiliyorlardi. Once PDF yolunu suclu sandim ve
   yereldeki bir testle hipotezi CURUTTUM: ham ters bolu PDF'i kesmiyor,
   oldugu gibi basiliyor. Demek ki kesilme VERIDE.

   Sebep: prompt modelden "valid raw LaTeX ONLY" istiyor, model de JSON
   dize degerinin icine \beta_0 yaziyor. Ama JSON'da \b GERI SILME
   karakteridir:

     JSON.parse('{"p":"... \beta_0 ..."}')  ->  "... <U+0008>eta_0 ..."

   Bu yalnizca \beta'yi vurmuyor. JSON kacislariyla CAKISAN her LaTeX
   komutu sessizce bozuluyor, ve hepsi bu uygulamanin en cok kullandigi
   semboller:

     \beta \bar \binom   -> \b  geri silme
     \frac               -> \f  sayfa atlatma
     \rho                -> \r  satir basi
     \tau \theta \times  -> \t  sekme

   Hicbiri hata vermiyor; JSON gecerli, dize bozuk. Bu yuzden yillarca
   gorunmeden durabilir.

   ONARIM: ayristirmadan ONCE, dize icindeki ters bolulerden LaTeX olani
   ikiye katlanir. Bilgi ayristirma aninda kayboldugu icin sonradan telafi
   edilemez.

   \n BILEREK DISARIDA: duz metinde satir sonu mesru ve sik ("satir1\nsatir2").
   Onu da LaTeX saymak gercek satir sonlarini bozardi. Bedeli \nu ve \nabla'nin
   bozuk kalmasi — ikisi de bu derslerde nadir, satir sonu ise her yerde.
   =========================================================================== */
const JSON_GECERLI_KACIS = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'])

/* IKI HARFLI LaTeX KOMUTLARI (24.10.2026) — bkz. repairLatexEscapes.
 *
 * 'b', 'f', 'r', 't' JSON'da gecerli kacis oldugu icin bu harflerle baslayan
 * LaTeX komutlari ozel ayirt etme gerektiriyor. repairLatexEscapes'teki
 * genel dal prefiksten SONRA en az iki harf ariyor, yani toplam uc harfli
 * komutlari taniyor (\rho, \tau, \beta). Iki harfli olanlar disarida
 * kaliyor ve gercek kontrol karakterine donuyordu — olculdu:
 *   \to -> TAB, \bm -> geri silme, \rm -> satir basi
 *
 * Kapali liste, serbest desen ({1,}) yerine bilerek: gercek bir TAB'in
 * ardindan harf gelmesi de mumkun ("Adim 1:\tthe result"). Boylece yalnizca
 * BILINEN komutlar kacirilir. Yeni bir iki harfli komut lazim olursa buraya
 * eklenir; uc harf ve uzunu genel dal zaten yakaliyor. */
const LATEX_IKI_HARFLI = new Set(['to', 'bm', 'rm', 'bf', 'tt'])

function repairLatexEscapes(json: string): string {
  const s = String(json || '')
  let out = ''
  let dizedeMi = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]

    if (!dizedeMi) {
      if (c === '"') dizedeMi = true
      out += c
      continue
    }
    if (c !== '\\') {
      if (c === '"') dizedeMi = false
      out += c
      continue
    }

    /* BIR KACIS IKI KARAKTERDIR VE IKISI BIRDEN TUKETILMELIDIR.
       Ilk surumum gecerli bir kaciste yalnizca ters boluyu yazip donguye
       devam ediyordu; ikinci karakter bir sonraki turda BAGIMSIZ olarak
       isleniyordu. Sonuclari:
         \"  -> tirnak dize sonu sanildi, tarayici kaydi
         \\  -> ikinci ters bolu YENI bir kacis sanildi
       Bundan sonra "dize icinde miyim" bilgisi yanlis oluyor ve gercek
       gecersiz kacislar onarilmadan geciyordu. Canli sonuc:
         "Window 1 attempt 1 failed: Bad escaped character in JSON"
       yani ONARMASI gereken hatanin ta kendisi; bir kosuda butun
       pencereler dustu ve ozet son care olarak ilk 5.000 karakterden
       cikarildi. Fuzz ile olculdu: 4.000 gecerli JSON girdisinin 446'si
       bozuluyordu. */
    const n = s[i + 1] ?? ''

    /* TERS BOLU + KESME ISARETI: TERS BOLU ATILIR (29.10.2026 olcumu).
     *
     * "Chp 9 - Group Processes" kartinda kavram tanimi ekranda boyle cikti:
     *   "concerned more with getting the job done than with workers\' feelings"
     * Diyagram basligi da "Fiedler\'s Contingency Theory" oldu. Suclu BU
     * FONKSIYONDU: ' JSON'da gecerli kacis olmadigi icin asagidaki gecersiz
     * kacis dali ters boluyu KACIRIP koruyor ve dize icinde ters bolu +
     * kesme olarak kaliyor.
     *
     * \( ve \[ icin korumak dogru — onlar gercek LaTeX ayiraci. \' icin
     * degil: model orada yalnizca kesme isareti istiyor. LaTeX'te \' keskin
     * aksandir (\'e = é) ama bu derslerde hic gecmiyor ve gecse de ekranda
     * zaten ham basilirdi. Ters bolu atiliyor, karakter kaliyor.
     *
     * Ayni sey ters tirnak icin (\` = ters aksan): o da kesme ailesinden. */
    if (n === "'" || n === '`') { out += n; i++; continue }

    // Gecersiz kacis (\( \) \[ \v \s ...): kacirilir. Bu ayni zamanda
    // sert ayristirma hatalarini da duzeltiyor.
    if (!JSON_GECERLI_KACIS.has(n)) { out += '\\\\' + n; i++; continue }

    // \u + 4 onaltilik: mesru unicode kacisi, oldugu gibi birakilir.
    if (n === 'u' && /^[0-9a-fA-F]{4}/.test(s.slice(i + 2, i + 6))) {
      out += c + n; i++; continue
    }

    /* \u AMA 4 ONALTILIK YOK (24.10.2026) — SERT AYRISTIRMA HATASI.
     *
     * 'u' JSON'da gecerli kacis oldugu icin yukaridaki gecersiz-kacis dali
     * onu gormuyor; 4 hex yoksa unicode dali da dusuyor; 'bfrt' kumesinde
     * olmadigi icin LaTeX dali da dusuyordu. Akis en alttaki "gercek JSON
     * kacisi" satirina inip `\u`'yu OLDUGU GIBI yaziyordu ve bu JSON'da
     * gecersizdir. Olculdu:
     *
     *   {"a":"\upsilon x"}    -> Bad Unicode escape in JSON
     *   {"a":"\underline{x}"} -> Bad Unicode escape in JSON
     *   {"a":"\uparrow"}      -> Bad Unicode escape in JSON
     *
     * Yani \upsilon, \underline, \uparrow, \underbrace gecen TEK bir formul
     * butun Gemini taslagini dusuruyordu: 8222'deki gecerlilik kapisi
     * patliyor, 105 saniye + 1 RPD yaniyor ve kart Groq yedeginden cikiyor.
     * Buraya dusen bir \u her zaman LaTeX komutudur. */
    if (n === 'u') { out += '\\\\' + n; i++; continue }

    // LaTeX komutu: \beta, \frac, \tau, \rho ... (\n disarida — basliga bak)
    if (n !== 'n' && 'bfrt'.includes(n) && /^[A-Za-z]{2,}/.test(s.slice(i + 2))) {
      out += '\\\\' + n; i++; continue
    }

    /* IKI HARFLI LaTeX KOMUTLARI (24.10.2026).
     *
     * Ustteki dal prefiksten SONRA en az iki harf istiyor, yani toplam uc
     * harfli komutlari taniyor (\rho, \tau, \beta). Iki harfli olanlar
     * disarida kaliyor ve en alttaki satirda GERCEK kontrol karakterine
     * donuyorlardi. Olculdu:
     *
     *   {"a":"x \to 0 y"} -> "x <TAB>o 0 y"
     *   {"a":"\bm{x}"}    -> geri silme karakteri
     *   {"a":"\rm{d}"}    -> satir basi
     *
     * Hata vermiyor, JSON gecerli, DIZE bozuk — bu fonksiyonun var olma
     * sebebi olan hata sinifinin aynisi. `\lim_{n \to \infty}` yazan her
     * formul ekranda ortadan kesiliyordu.
     *
     * Serbest desen ({1,}) kullanmiyorum: gercek bir TAB'in ardindan harf
     * gelmesi de mumkun ("Adim 1:\tthe result"). Bunun yerine prefiksle
     * baslayan IKI HARFLI LaTeX komutlarinin kapali listesi — boylece
     * yalnizca bilinen komutlar kacirilir, rastgele \t+harf dizisi degil. */
    if (n !== 'n' && LATEX_IKI_HARFLI.has(n + (s[i + 2] ?? ''))) {
      out += '\\\\' + n; i++; continue
    }

    // Gercek JSON kacisi: ikisi birden yazilir, ikisi birden tuketilir.
    out += c + n
    i++
  }
  return out
}

/* ANLATIDA TERS BOLU GERCEK SATIR SONUNA DONUYOR (29.10.2026 olcumu).
 *
 * Week_8_Derivative kartinin ANLATI metnindeki 22 satir sonunun 18i bir
 * LaTeX komut adinin TAM onundeydi ve saglam `\komut` sayisi SIFIRDI:
 *   "the power rule <LF>frac{d}{dx}(x^n) = nx^{n-1}"
 * Ayni kartta sections ve key_terms icindeki `\frac` saglam, formulas
 * dizisinin 12 formulunun hepsi saglam. Bozulma yalnizca anlati yazarinin
 * yazdigi alanlarda.
 *
 * Sebep repairLatexEscapes DEGIL: fuzz ile olculdu, o fonksiyon \frac,
 * \\frac ve cift gecis icin devirli. Depolanan baytlari (LF,f,r,a,c)
 * ureten tek girdi ham JSONda `\nfrac`, yani model ters boluyu `\n` diye
 * yaziyor. Prompt ona tek kacis ornegi olarak `\n\n` veriyor, formulleri
 * de ham LaTeX olarak gosteriyor; kopyalarken ikisini karistiriyor.
 *
 * Prompt daraltildi ama garanti degil, bu yuzden onarim deterministik:
 * TEK bir satir sonunun ardindan BILINEN bir LaTeX komut adi geliyorsa o
 * satir sonu kayip bir ters boludur. Kapali liste, serbest desen yerine
 * bilerek (bkz. LATEX_IKI_HARFLI): "summary" ile \sum, "integral" ile
 * \int ayni harflerle basliyor, bu yuzden komut adinin ardindan HARF
 * gelmemesi sart. Ingilizcede de kelime olan adlar (sum, int, lim, left,
 * text) ayrica LaTeXe ozgu bir karakter istiyor: { _ ^ ( \ ya da rakam.
 * "<LF>sum of squares" duz yazidir, "<LF>sum_{i=1}" degildir.
 * Paragraf arasi IKI satir sonudur; o yuzden yalnizca tek satir sonu
 * incelenir, paragraf yapisina hic dokunulmuyor. */
const LATEX_ANLATI_NET =
  "frac|dfrac|tfrac|sqrt|cdots|cdot|ldots|leq|geq|neq|approx|infty|partial|" +
  "nabla|varepsilon|varphi|alpha|beta|gamma|delta|epsilon|theta|lambda|" +
  "sigma|Sigma|Delta|Omega|omega|rho|mathrm|mathbb|mathcal|overline|" +
  "underline|binom|qquad|displaystyle"
const LATEX_ANLATI_KELIME =
  "sum|prod|int|lim|times|div|left|right|quad|text|log|ln|exp|hat|bar|" +
  "vec|pi|mu|nu|tau|phi|begin|end|sin|cos|tan|sec|cot|max|min|pm|le|ge|to"

function onarAnlatiTersBolusu(metin: string): { metin: string; onarim: number } {
  const s = String(metin || "")
  if (s.indexOf("\n") === -1) return { metin: s, onarim: 0 }
  let onarim = 0
  /* Desen her cagrida uretiliyor: g bayrakli paylasilan regexin lastIndex
     degeri iki cagri arasinda sessiz atlama yapar (bkz. mathDelimRe). */
  const re = new RegExp(
    "(?<!\\n)\\n(?:(" + LATEX_ANLATI_NET + ")(?![A-Za-z])" +
    "|(" + LATEX_ANLATI_KELIME + ")(?=[{_^(\\\\]|[ ]*[0-9]))",
    "g"
  )
  const out = s.replace(re, (_m: string, net: string, kelime: string) => {
    onarim++
    return "\\" + (net || kelime)
  })
  return { metin: out, onarim }
}

/* ANLATIDA HAM LATEX (29.10.2026 olcumu).
 *
 * ACCOUNTING chapter 7 kartinin anlatisinda bunlar OLDUGU GIBI basildi:
 *   "\\text{Bad Debt Amount} = \\text{Required Balance} - \\text{Existing Balance}"
 *   "Interest = Principal \\times Annual \\, Interest \\, Rate \\times Time"
 *
 * Ters bolu artik korunuyor (bkz. onarAnlatiTersBolusu) ama ayirac yok:
 * renderMathInText yalnizca $...$, \\(...\\) ve \\[...\\] icini diziyor,
 * geri kalani KACIRIYOR — dogrusu da bu, aksi halde duz yazidaki her
 * ters bolu KaTeX'e giderdi.
 *
 * Ayirac EKLEMEK cozum degil: matematik sinirlari duz yaziyla ic ice
 * ("Interest = Principal ..." sozcuklerle basliyor), nerede bittigi
 * guvenilir sekilde bulunamaz. Formuller ZATEN formulas[] icinde kendi
 * kartlarinda, degisken sozluguyle duruyor; anlatinin isi duz yazi.
 *
 * Bu yuzden anlatidaki LaTeX OKUNUR hale getiriliyor:
 *   \\text{Bad Debt Amount}  -> Bad Debt Amount
 *   \\times                  -> x        \\, \\; \\! \\quad -> bosluk
 *   \\frac{a}{b}             -> a/b
 * $...$ ve \\(...\\) ICI HIC ELLENMIYOR: orayi KaTeX dogru diziyor. */
const ANLATI_MATEMATIK_ADACIK_RE = /\$[^$\n]*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g

/* Komut siniri: \int ile \infty ayri komutlar, ve \int_{0} gibi hallerde
   ardindan '_' geliyor — '_' regex'te KELIME karakteri oldugu icin \b
   calismaz. Bu yuzden her yerde (?![a-zA-Z]) kullaniliyor. */
const YUM_SEMBOL: Array<[RegExp, string]> = [
  [/\\iint(?![a-zA-Z])/g, '\u222C'], [/\\oint(?![a-zA-Z])/g, '\u222E'],
  [/\\int(?![a-zA-Z])/g, '\u222B'],
  [/\\sum(?![a-zA-Z])/g, '\u2211'], [/\\prod(?![a-zA-Z])/g, '\u220F'],
  [/\\infty(?![a-zA-Z])/g, '\u221E'],
  [/\\partial(?![a-zA-Z])/g, '\u2202'], [/\\nabla(?![a-zA-Z])/g, '\u2207'],
  [/\\(?:rightarrow|to)(?![a-zA-Z])/g, '\u2192'],
  [/\\(?:lvert|rvert|mid|vert)(?![a-zA-Z])/g, '|'],
  [/\\alpha(?![a-zA-Z])/g, '\u03B1'], [/\\beta(?![a-zA-Z])/g, '\u03B2'],
  [/\\gamma(?![a-zA-Z])/g, '\u03B3'], [/\\delta(?![a-zA-Z])/g, '\u03B4'],
  [/\\(?:varepsilon|epsilon)(?![a-zA-Z])/g, '\u03B5'],
  [/\\theta(?![a-zA-Z])/g, '\u03B8'], [/\\lambda(?![a-zA-Z])/g, '\u03BB'],
  [/\\mu(?![a-zA-Z])/g, '\u03BC'], [/\\pi(?![a-zA-Z])/g, '\u03C0'],
  [/\\rho(?![a-zA-Z])/g, '\u03C1'], [/\\sigma(?![a-zA-Z])/g, '\u03C3'],
  [/\\tau(?![a-zA-Z])/g, '\u03C4'], [/\\phi(?![a-zA-Z])/g, '\u03C6'],
  [/\\omega(?![a-zA-Z])/g, '\u03C9'],
  [/\\Delta(?![a-zA-Z])/g, '\u0394'], [/\\Sigma(?![a-zA-Z])/g, '\u03A3'],
  [/\\Omega(?![a-zA-Z])/g, '\u03A9']
]

/* Fonksiyon adlari: komut isareti kalkar, ad kalir (\\sin x -> sin x). */
const YUM_FONKSIYON = /\\(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|ln|log|exp|lim|max|min|det|deg|gcd)(?![a-zA-Z])/g

/* Rakam alt/ust simgeleri Unicode karsiligina cevrilir: _{0} -> alt 0,
   ^{2} -> ust 2. Harf tasiyanlar (x^n) oldugu gibi kaliyor, cunku Unicode'da
   butun harflerin alt/ust bicimi yok. */
const UST_RAKAM: Record<string, string> = {
  '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074',
  '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079'
}
const ALT_RAKAM: Record<string, string> = {
  '0': '\u2080', '1': '\u2081', '2': '\u2082', '3': '\u2083', '4': '\u2084',
  '5': '\u2085', '6': '\u2086', '7': '\u2087', '8': '\u2088', '9': '\u2089'
}

function anlatiLatexYumusat(parca: string): string {
  let t = String(parca || '')
  /* Erken cikis: ters bolu YA DA suslu alt/ust simge yoksa yapacak is yok.
     Ikinci kosul sart — "nx^{n-1}" ters bolu tasimiyor ama suslu parantezi
     temizlenmeli (olculdu: tek basina gelen madde metinleri boyle). */
  if (t.indexOf('\\') === -1 && !/[\^_]\{/.test(t)) return t

  /* CIFT TERS BOLU VE KACIRILMIS KESME ISARETI (29.10.2026 olcumu).
   *
   * "Week7 Chp5 - The Self" kartinin ANLATISINDA dort yerde ters bolu +
   * kesme isareti cikti:
   *   "defined in terms of one\'s own internal thoughts"
   *   "recognition that others\' behaviors affect one\'s own actions"
   * Ayni kartin KAVRAMLARINDA dogru ("one's"), yani repairLatexEscapes'teki
   * \' duzeltmesi calisiyor — hata baska bir yerden.
   *
   * Sebep: anlati yazari ham JSON'a \\' yaziyor, yani KACIRILMIS ters bolu
   * + kesme. Bu JSON'da GECERLIDIR; ayristirma dogru sekilde literal
   * ters bolu + kesme uretiyor. repairLatexEscapes'in duzeltecegi bir sey
   * yok, cunku girdi zaten gecerli.
   *
   * Yani onarim ayristirmadan SONRA olmali: duz yazida ters bolu + kesme
   * (ya da tirnak) hicbir zaman kasitli degil. Cift ters bolu de ayni
   * sinif — bkz. sanitizeFormulas'taki ayni gerekce (model "\\beta"
   * yazdiginda KaTeX satir sonu goruyordu). */
  t = t.replace(/\\\\(?=[A-Za-z'"`])/g, '\\')
  t = t.replace(/\\(['"`])/g, '$1')

  // \text{...} / \mathrm{...} / \mathbf{...}: yalnizca icerigi kalir.
  t = t.replace(/\\(?:text|textrm|textbf|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g, '$1')
  t = t.replace(/\\(?:times|cdot)\b/g, 'x')
  t = t.replace(/\\div\b/g, '/')
  t = t.replace(/\\pm\b/g, '+/-')
  t = t.replace(/\\(?:leq|le)\b/g, '<=').replace(/\\(?:geq|ge)\b/g, '>=')
  t = t.replace(/\\neq\b/g, '!=').replace(/\\approx\b/g, '~')
  t = t.replace(/\\(?:left|right|displaystyle)\b/g, '')
  // Ince bosluk komutlari: \, \; \! \quad \qquad \ (ters bolu + bosluk)
  t = t.replace(/\\(?:qquad|quad)\b/g, ' ').replace(/\\[,;!:> ]/g, ' ')
  // Sembol ve fonksiyon adlari (bkz. YUM_SEMBOL / YUM_FONKSIYON).
  for (const [re, yerine] of YUM_SEMBOL) t = t.replace(re, yerine)
  t = t.replace(YUM_FONKSIYON, '$1')
  // Rakam alt/ust simgeleri.
  t = t.replace(/\^\{(\d+)\}|\^(\d)/g, (_m, suslu, tek) =>
    [...String(suslu ?? tek)].map((d) => UST_RAKAM[d] || d).join(''))
  t = t.replace(/_\{(\d+)\}|_(\d)/g, (_m, suslu, tek) =>
    [...String(suslu ?? tek)].map((d) => ALT_RAKAM[d] || d).join(''))
  /* Harf tasiyan alt/ust simgede Unicode karsilik yok; suslu parantez
     yerine okunur bicim: \int_{a}^{b} -> ∫_a^b. Icerikte ISLEM varsa
     normal parantez kaliyor, yoksa nx^{n-1} "nx^n-1" diye belirsiz
     okunurdu. Uzun icerik dokunulmuyor; orada parantez anlam tasiyor. */
  t = t.replace(/([\^_])\{([^{}\s]{1,8})\}/g, (_m, isaret, icerik) =>
    /[+\-*/=]/.test(String(icerik)) ? `${isaret}(${icerik})` : `${isaret}${icerik}`)

  /* \frac EN SONDA VE TEKRARLI (29.10.2026 olcumu).
   *
   * Ilk surumde en bastaydi ve desen ic ice suslu parantezi gormuyordu;
   * "Week 9 Introduction to Integrals" kartinda anlatida tam bu kaldi:
   *   ∫ x^n dx = \frac{x^(n+1)}{n+1} + C
   * Kaynak \frac{x^{n+1}}{n+1}'di: pay 'x^{n+1}' suslu tasidigi icin
   * [^{}]* eslesmedi, sonra ust simge temizligi ^{n+1} -> ^(n+1) yapti ve
   * ortada ciplak \frac kaldi.
   *
   * Cozum sira: alt/ust simgeler ONCE sadelesiyor, boylece frac'in pay ve
   * paydasinda suslu kalmiyor. Ustelik dongu: ic ice frac'in her katmani
   * bir gecisle acilir, degisiklik durunca cikilir. */
  for (let gecis = 0; gecis < 3; gecis++) {
    const once = t
    t = t.replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_m, pay, payda, konum: number, tam: string) => {
      const sar = (x: string) => /[+\-*/^\s]/.test(String(x).trim()) ? `(${String(x).trim()})` : String(x).trim()
      const bolum = `${sar(pay)}/${sar(payda)}`
      /* Hemen ardindan harf/rakam geliyorsa TAMAMI parantez icine:
         \frac{3}{4}x^4 -> (3/4)x⁴. Yoksa "3/4x⁴" diye okunurdu. */
      const sonra = String(tam).charAt(Number(konum) + String(_m).length)
      return /[A-Za-z0-9(]/.test(sonra) ? `(${bolum})` : bolum
    })
    if (t === once) break
  }
  return t.replace(/[ \t]{2,}/g, ' ')
}

/* AYIRACSIZ LATEX ANLATI DISINA DA SIZIYOR (29.10.2026 olcumu).
 *
 * "Week 10 Basic Applications of Integrals" kartinda anlati DOGRUYDU —
 * model orada $...$ kullandi ve KaTeX duzgun dizdi:
 *   "finding an antiderivative $F(x)$ and computing $\int_{a}^{b} f(x) \, dx$"
 * Ama ayni model ayiracsiz LaTeX'i baska alanlara yazdi ve oralar ham cikti:
 *   key_points:      "...applies the formula \int u \, dv = uv - \int v \, du."
 *   quiz_questions:  "Compute the definite integral \int_{0}^{3} 3 \, dx."
 *   worked_examples: "Evaluate the integral \int 2x(x^2 + 1)^3 \, dx."
 *
 * Yumusatma anlati icin yazilmisti ama defect ALAN BAGIMSIZ. Ayni islem
 * butun DUZ YAZI alanlarina uygulaniyor. Kapsam disinda kalanlar bilincli:
 *   formulas[].latex  -> gercek LaTeX, KaTeX onu dizecek
 *   diagrams[].mermaid -> mermaid kaynagi, LaTeX degil
 * Ikisine dokunmak calisan tek seyi bozardi. */
const YUM_DUZ_YAZI_ALANLARI = [
  'summary', 'summary_executive'
] as const

/* ALAN ADI TAHMIN ETMEK KIRILGAN (30.10.2026 olcumu).
 *
 * Ilk surum alanlari ELLE sayiyordu: title, prompt, question, final_answer,
 * steps. "Week 8 Derivative" kosusunda cozumlu orneklerin metni baska bir
 * alanda geldi ve ham LaTeX ekrana cikti:
 *   problem_statement: "Find the maximum profit for the model
 *                       \\mathbf{P(x) = -x^2 + 10x + 5}."
 * Log 38 alan yumusattigini yaziyordu; o alan listede olmadigi icin
 * atlanmisti. Modelin alan adini bir daha degistirmesi an meselesi.
 *
 * Artik agac OZYINELEMELI geziliyor: her dize yumusatiliyor, listeye
 * guvenilmiyor. Yalnizca DOKUNULMAZ anahtarlar atlaniyor:
 *   latex      -> gercek LaTeX, KaTeX onu dizecek
 *   mermaid    -> mermaid kaynagi, LaTeX bile degil
 *   footnotes  -> kaynaktan BIREBIR alinti; yumusatmak alintiyi bozar
 * Ucune dokunmak calisan tek seyleri bozardi. */
const YUM_DOKUNULMAZ = new Set(['latex', 'mermaid', 'footnotes'])

function yumusatAgac(deger: any, yum: (s: string) => string, anahtar?: string): any {
  if (anahtar !== undefined && YUM_DOKUNULMAZ.has(anahtar)) return deger
  if (typeof deger === 'string') return yum(deger)
  if (Array.isArray(deger)) return deger.map((x: any) => yumusatAgac(x, yum, anahtar))
  if (deger && typeof deger === 'object') {
    for (const k of Object.keys(deger)) deger[k] = yumusatAgac(deger[k], yum, k)
    return deger
  }
  return deger
}

function onarAnlatiLatex(metin: string): { metin: string; yumusatilan: number } {
  const s = String(metin || '')
  // Erken cikis anlatiLatexYumusat'takiyle AYNI olmali, yoksa ic fonksiyon
  // hic cagrilmaz ve suslu alt/ust simge temizligi olu kod olur.
  if (s.indexOf('\\') === -1 && !/[\^_]\{/.test(s)) return { metin: s, yumusatilan: 0 }
  let yumusatilan = 0
  let out = ''
  let son = 0
  const re = new RegExp(ANLATI_MATEMATIK_ADACIK_RE.source, 'g')
  let m: RegExpExecArray | null
  const ekle = (duz: string) => {
    const y = anlatiLatexYumusat(duz)
    if (y !== duz) yumusatilan++
    out += y
  }
  while ((m = re.exec(s)) !== null) {
    ekle(s.slice(son, m.index))
    out += m[0]            // ayiracli matematik oldugu gibi korunur
    son = m.index + m[0].length
  }
  ekle(s.slice(son))
  return { metin: out, yumusatilan }
}

/* MODELIN KENDI ACIKLAMALARI OZETE GIRMEZ (30.10.2026, test raporu R42/R63).
   Ozetlerde ders icerigi olmayan cumleler kaliyordu: "The visible text does
   not explicitly detail specific reasoning methods..." gibi. Yalnizca BELGENIN
   KENDISINDEN soz eden ("gorunen/saglanan metin ... icermiyor") ya da modelin
   kendinden soz ettigi ("as an AI", "I cannot ...") cumleler atilir.
   js/dashboard.js'teki AI_META_SENTENCE_RE ile BIREBIR AYNI (eski kayitli
   ozetleri o temizliyor); tests/ozet-meta-cumle.js iki kopyanin esitligini
   kilitliyor. */
const AI_META_SENTENCE_RE = new RegExp(
  String.raw`[^.!?\n\]]*(?:` + // "]" dahil degil: onceki cumlenin [1] atfi silinmesin
  String.raw`(?:the|this|these) (?:visible|provided|given|available|uploaded|supplied|extracted) (?:text|content|document|slides?|material|excerpts?|pages?|notes)\b[^.!?\n]*\b(?:does not|doesn't|do not|don't|did not|is not|isn't|are not|aren't|lacks?|only|cannot|can't|fails? to)\b` +
  String.raw`|\bas an ai\b|\bi (?:cannot|can't|do not have|don't have) (?:access|see|determine|verify)` +
  String.raw`|(?:görünen|sağlanan|verilen|yüklenen|mevcut) (?:metin|belge|içerik|slayt(?:lar)?|materyal|sayfa(?:lar)?)[^.!?\n]*(?:belirtilmemiş|belirtmiyor|yer almıyor|yer almamaktadır|içermiyor|içermemektedir|değinmiyor|açıklamıyor|bulunmuyor|bulunmamaktadır)` +
  String.raw`)[^.!?\n]*[.!?]?`, 'gi');
function stripAiMetaSentences(text: string): string {
  // Eslesme yoksa metne HIC dokunulmaz (madde girintileri, satir sonlari korunur).
  const s = String(text || '');
  AI_META_SENTENCE_RE.lastIndex = 0;
  if (!AI_META_SENTENCE_RE.test(s)) return s;
  AI_META_SENTENCE_RE.lastIndex = 0;
  return s.replace(AI_META_SENTENCE_RE, '').replace(/(\S)[ \t]{2,}(\S)/g, '$1 $2').trim();
}

function stripThinkBlock(raw: string): string | null {
  const match = raw.match(/<think>[\s\S]*?<\/think>/i)
  if (match) {
    return raw.slice((match.index ?? 0) + match[0].length).trim()
  }
  if (/^\s*<think>/i.test(raw)) {
    return null
  }
  return raw
}

// Convert raw bytes to a base64 string WITHOUT the one-character-at-a-time
// `binary += String.fromCharCode(bytes[i])` loop used throughout this file
// (Denetim Raporu, 2026-08-31 — LIVE PRODUCTION FINDING). That pattern
// re-allocates and copies a growing string on every single byte — for a
// multi-hundred-KB/multi-MB PNG page image (exactly what the PDF.co visual
// analysis below downloads), that is millions of reallocations and is what
// actually caused a real "Memory limit exceeded" (546) crash in production
// once the presigned-URL fix above finally let this code path run for the
// first time with real image data. Chunking into reasonably sized pieces
// and joining once at the end keeps this O(n) instead of pathological.
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE)
    chunks.push(String.fromCharCode(...chunk))
  }
  return btoa(chunks.join(''))
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parsePptxSlideXml(slideXml: string): string {
  const tableMatches = [...slideXml.matchAll(/<a:tbl[\s>][\s\S]*?<\/a:tbl>/g)];

  if (tableMatches.length === 0) {
    const matches = slideXml.matchAll(/<a:t>(.*?)<\/a:t>/g);
    let text = "";
    for (const match of matches) {
      text += decodeXmlEntities(match[1]) + " ";
    }
    return text.trim();
  }

  const slideParts: string[] = [];
  let lastIdx = 0;

  for (const tMatch of tableMatches) {
    const tblStartIndex = tMatch.index!;
    const tblEndIndex = tblStartIndex + tMatch[0].length;

    const preTextXml = slideXml.substring(lastIdx, tblStartIndex);
    const preMatches = preTextXml.matchAll(/<a:t>(.*?)<\/a:t>/g);
    let preText = "";
    for (const m of preMatches) {
      preText += decodeXmlEntities(m[1]) + " ";
    }
    if (preText.trim()) {
      slideParts.push(preText.trim());
    }

    const tblXml = tMatch[0];
    const rowMatches = [...tblXml.matchAll(/<a:tr[\s>][\s\S]*?<\/a:tr>/g)];
    const tableRows: string[][] = [];

    for (const rMatch of rowMatches) {
      const rowXml = rMatch[0];
      const cellMatches = [...rowXml.matchAll(/<a:tc[\s>][\s\S]*?<\/a:tc>/g)];
      const rowCells: string[] = [];
      for (const cMatch of cellMatches) {
        const cellXml = cMatch[0];
        const textMatches = [...cellXml.matchAll(/<a:t>(.*?)<\/a:t>/g)];
        let cellText = textMatches.map(m => decodeXmlEntities(m[1])).join(" ").trim();
        cellText = cellText.replace(/\|/g, "\\|");
        rowCells.push(cellText);
      }
      if (rowCells.some(c => c.length > 0)) {
        tableRows.push(rowCells);
      }
    }

    if (tableRows.length > 0) {
      const colCount = Math.max(...tableRows.map(r => r.length));
      let mdTable = "\n\n";
      const header = [...tableRows[0]];
      while (header.length < colCount) header.push("");
      mdTable += "| " + header.join(" | ") + " |\n";
      mdTable += "| " + Array(colCount).fill("---").join(" | ") + " |\n";
      for (let r = 1; r < tableRows.length; r++) {
        const row = [...tableRows[r]];
        while (row.length < colCount) row.push("");
        mdTable += "| " + row.join(" | ") + " |\n";
      }
      mdTable += "\n";
      slideParts.push(mdTable);
    }

    lastIdx = tblEndIndex;
  }

  const postTextXml = slideXml.substring(lastIdx);
  const postMatches = postTextXml.matchAll(/<a:t>(.*?)<\/a:t>/g);
  let postText = "";
  for (const m of postMatches) {
    postText += decodeXmlEntities(m[1]) + " ";
  }
  if (postText.trim()) {
    slideParts.push(postText.trim());
  }

  return slideParts.join("\n");
}

function parseDocxHtmlContent(html: string): string {
  if (!html) return "";
  let processed = html;

  processed = processed.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (_m, content) => {
    const clean = content.replace(/<[^>]+>/g, "").trim();
    return clean ? `\n\n## ${clean}\n\n` : "";
  });

  processed = processed.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, (tableHtml) => {
    const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi)];
    const tableRows: string[][] = [];

    for (const rMatch of rowMatches) {
      const rowInner = rMatch[0];
      const cellMatches = [...rowInner.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
      const rowCells: string[] = [];

      for (const cMatch of cellMatches) {
        let cellText = cMatch[1].replace(/<[^>]+>/g, " ").trim();
        cellText = cellText.replace(/\s+/g, " ").replace(/\|/g, "\\|");
        rowCells.push(cellText);
      }

      if (rowCells.some(c => c.length > 0)) {
        tableRows.push(rowCells);
      }
    }

    if (tableRows.length === 0) return "";

    const colCount = Math.max(...tableRows.map(r => r.length));
    let mdTable = "\n\n";
    const header = [...tableRows[0]];
    while (header.length < colCount) header.push("");
    mdTable += "| " + header.join(" | ") + " |\n";
    mdTable += "| " + Array(colCount).fill("---").join(" | ") + " |\n";

    for (let r = 1; r < tableRows.length; r++) {
      const row = [...tableRows[r]];
      while (row.length < colCount) row.push("");
      mdTable += "| " + row.join(" | ") + " |\n";
    }
    mdTable += "\n";
    return mdTable;
  });

  processed = processed.replace(/<\/p>/gi, "\n");
  processed = processed.replace(/<br\s*\/?>/gi, "\n");
  processed = processed.replace(/<\/div>/gi, "\n");
  processed = processed.replace(/<[^>]+>/g, "");

  processed = processed
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  return processed.replace(/\n{3,}/g, "\n\n").trim();
}

function detectAndFormatPdfTables(text: string): string {
  if (!text) return text;

  const lines = text.split("\n");
  const resultLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const columns = line.split(/\s{2,}|\t/).map(c => c.trim()).filter(Boolean);

    if (columns.length >= 2 && i + 1 < lines.length) {
      const potentialTableRows: string[][] = [columns];
      let j = i + 1;

      while (j < lines.length) {
        const nextLine = lines[j];
        const nextCols = nextLine.split(/\s{2,}|\t/).map(c => c.trim()).filter(Boolean);
        if (nextCols.length >= 2 && Math.abs(nextCols.length - columns.length) <= 2) {
          potentialTableRows.push(nextCols);
          j++;
        } else {
          break;
        }
      }

      if (potentialTableRows.length >= 3) {
        const colCount = Math.max(...potentialTableRows.map(r => r.length));
        let mdTable = "\n\n";
        const header = [...potentialTableRows[0]];
        while (header.length < colCount) header.push("");
        mdTable += "| " + header.map(h => h.replace(/\|/g, "\\|")).join(" | ") + " |\n";
        mdTable += "| " + Array(colCount).fill("---").join(" | ") + " |\n";

        for (let r = 1; r < potentialTableRows.length; r++) {
          const row = [...potentialTableRows[r]];
          while (row.length < colCount) row.push("");
          mdTable += "| " + row.map(cell => cell.replace(/\|/g, "\\|")).join(" | ") + " |\n";
        }
        mdTable += "\n";
        resultLines.push(mdTable);
        i = j;
        continue;
      }
    }

    resultLines.push(line);
    i++;
  }

  return resultLines.join("\n");
}

/* ==========================================================================
   DENKLEM SAYFALARININ YENIDEN DIZILMESI (09.10.2026)

   KOK NEDEN. PowerPoint/MathType denklemleri PDF'e iki sekilde bozuk geliyor:

   1. Operatorler Symbol fontunda ve ToUnicode haritasi yok. pdf.js onlari
      ozel kullanim alanina (PUA) koyuyor: U+F02B '+', U+F03D '=', U+F02D '−',
      U+F062 'β', U+F0B6 '∂'. Model bunlari okuyamiyor — ekranda bosluk gibi.
   2. Denklem nesnesinin glifleri akista SAGDAN SOLA ve fonta gore gruplu
      geliyor. Ekonometri destesinin 29. slaytinin modele giden hali:

        2 t 09 . 0 t 08 . 12 12 . 484 emp emp l UtilityBil <F02B> <F02D> <F03D>

      Slaytta yazan: UtilityBill = 484.12 − 12.08 temp + 0.09 temp².

   Sonuc canli olarak goruldu: model katsayilari okuyamadi ve UYDURDU
   (β1 = −9.0, β2 = 0.1212), cozumlu ornegin aritmetigi tutmadi, formul
   listesi destedeki ~22 formulun 8'ini tasidi.

   COZUM. Konumlar dogru — yalnizca sira bozuk. Matematik PUA'si tasiyan
   sayfalarda metin, ogelerin koordinatlarindan yeniden kuruluyor: XY-cut
   ile bloklar (sutunlar once ayrilir, yan kutudaki aciklama denklem satirina
   karismaz), blok icinde taban cizgisine gore satirlar, kucuk ve kaymis
   ogeler ust/alt simge (x^2, β_1), sapka glifi altindaki harfe (ŷ). Ayni
   destede 29. slayt artik:

        UtilityBill = 484.12 − 12.08temp + 0.09temp^2
        -12.08 + 2(0.09)39 = − 12.08 + 7.02 = − 5.06

   KAPSAM. Yalnizca matematik PUA'si olan sayfalar yeniden dizilir; digerleri
   pdf.js'in akis sirasini aynen korur (iki sutunlu ders kitaplarinda akis
   sirasi dogru okuma sirasidir — orada yeniden dizmek risk, kazanc degil).
   PUA haritasi ise her sayfaya uygulanir.
   ========================================================================== */

// Adobe Symbol kodlamasi; pdf.js ToUnicode'u olmayan sembol fontlarini
// U+F000 + fontun kendi baytina koyuyor.
const SYMBOL_PUA: Record<number, string> = {
  0x20: ' ', 0x21: '!', 0x22: '∀', 0x23: '#', 0x24: '∃', 0x25: '%', 0x26: '&', 0x27: '∋',
  0x28: '(', 0x29: ')', 0x2a: '∗', 0x2b: '+', 0x2c: ',', 0x2d: '−', 0x2e: '.', 0x2f: '/',
  0x30: '0', 0x31: '1', 0x32: '2', 0x33: '3', 0x34: '4', 0x35: '5', 0x36: '6', 0x37: '7', 0x38: '8', 0x39: '9',
  0x3a: ':', 0x3b: ';', 0x3c: '<', 0x3d: '=', 0x3e: '>', 0x3f: '?', 0x40: '≅',
  0x41: 'Α', 0x42: 'Β', 0x43: 'Χ', 0x44: 'Δ', 0x45: 'Ε', 0x46: 'Φ', 0x47: 'Γ', 0x48: 'Η', 0x49: 'Ι',
  // 0x4B Symbol'de Kappa, ama ayni bayt MathType'in "MT Extra" fontunda "…" —
  // ve "β1x1 + … + βkxk" her ekonometri slaytinda var, Kappa yok. Font adi
  // getTextContent'ten gelmiyor (yalnizca getOperatorList sonrasi), o yuzden
  // sik olan okuma seciliyor.
  0x4a: 'ϑ', 0x4b: '…', 0x4c: 'Λ', 0x4d: 'Μ', 0x4e: 'Ν', 0x4f: 'Ο', 0x50: 'Π', 0x51: 'Θ', 0x52: 'Ρ',
  0x53: 'Σ', 0x54: 'Τ', 0x55: 'Υ', 0x56: 'ς', 0x57: 'Ω', 0x58: 'Ξ', 0x59: 'Ψ', 0x5a: 'Ζ',
  0x5b: '[', 0x5c: '∴', 0x5d: ']', 0x5e: '⊥', 0x5f: '_',
  0x61: 'α', 0x62: 'β', 0x63: 'χ', 0x64: 'δ', 0x65: 'ε', 0x66: 'φ', 0x67: 'γ', 0x68: 'η', 0x69: 'ι',
  0x6a: 'ϕ', 0x6b: 'κ', 0x6c: 'λ', 0x6d: 'μ', 0x6e: 'ν', 0x6f: 'ο', 0x70: 'π', 0x71: 'θ', 0x72: 'ρ',
  0x73: 'σ', 0x74: 'τ', 0x75: 'υ', 0x76: 'ϖ', 0x77: 'ω', 0x78: 'ξ', 0x79: 'ψ', 0x7a: 'ζ',
  0x7b: '{', 0x7c: '|', 0x7d: '}', 0x7e: '∼',
  0xa1: 'ϒ', 0xa2: '′', 0xa3: '≤', 0xa4: '⁄', 0xa5: '∞', 0xa6: 'ƒ', 0xab: '↔', 0xac: '←', 0xad: '↑',
  0xae: '→', 0xaf: '↓', 0xb0: '°', 0xb1: '±', 0xb2: '″', 0xb3: '≥', 0xb4: '×', 0xb5: '∝', 0xb6: '∂',
  0xb7: '•', 0xb8: '÷', 0xb9: '≠', 0xba: '≡', 0xbb: '≈', 0xbc: '…', 0xc6: '∅', 0xc7: '∩', 0xc8: '∪',
  0xce: '∈', 0xcf: '∉', 0xd1: '∇', 0xd5: '∏', 0xd6: '√', 0xd7: '⋅', 0xd9: '∧', 0xda: '∨',
  0xdb: '⇔', 0xdc: '⇐', 0xde: '⇒', 0xe5: '∑', 0xf2: '∫',
  // Uzun parantez/kume PARCALARI. Duz metinde yalnizca orta parca anlam
  // tasiyor; digerleri gurultu olurdu.
  0xe6: '', 0xe7: '', 0xe8: '', 0xe9: '', 0xea: '', 0xeb: '', 0xec: '', 0xed: '{', 0xee: '', 0xef: '',
  0xf3: '', 0xf4: '', 0xf5: '', 0xf6: '', 0xf7: '', 0xf8: '', 0xf9: '', 0xfa: '', 0xfb: '', 0xfd: '}', 0xfe: ''
}

// Satir basindaki PUA isareti cogu zaman Wingdings madde isaretidir (Pearson
// ve McGraw-Hill destelerinde U+F0D8 "➢"), Symbol karakteri degil. Ayni bayt
// Symbol'de "¬" — satir basinda ve ardindan kelime geliyorsa madde isareti
// okunuyor. Bu kodlar Wingdings'in madde isareti olarak kullanilanlari.
const PUA_BULLET_CODES = new Set([0xd8, 0xa7, 0x6e, 0x71, 0x76, 0xfc, 0x9f, 0xa8, 0x77, 0x75, 0xd9, 0xdf, 0xe0, 0xe8, 0xf0])
const PUA_ANY_RE = /[-]/g
const PUA_LINE_BULLET_RE = /(^|\n)([ \t]*)([-])(?=[ \t]*[A-Za-zÇĞİÖŞÜçğıöşü0-9"“(])/g

/** PUA sembollerini okunur karaktere cevir. Satir basi madde isaretleri '•'. */
function mapSymbolPua(text: string): string {
  return String(text || '')
    .replace(PUA_LINE_BULLET_RE, (m, nl, ws, ch) =>
      PUA_BULLET_CODES.has(ch.charCodeAt(0) - 0xf000) ? `${nl}${ws}•` : m)
    .replace(PUA_ANY_RE, ch => {
      const code = ch.charCodeAt(0) - 0xf000
      const v = SYMBOL_PUA[code]
      if (v !== undefined) return v
      // Tabloda olmayan PUA modele gorunmez bir karakter olarak gider;
      // okunamayan bir isaret, hic isaret olmamasindan iyi degil.
      return PUA_BULLET_CODES.has(code) ? '•' : ''
    })
}

/** Sayfada denklem nesnesi var mi? Satir basi madde isaretleri sayilmaz —
 *  yalnizca isaretli sayfalar yeniden dizilseydi Pearson'un her madde
 *  isaretli slayti gereksiz yere elden gecerdi. Iki matematik PUA'si
 *  esik: tek bir "−" (bir yil araliginda) sayfayi dizmeye deger degil. */
function countMathPua(text: string): number {
  const s = String(text || '').replace(PUA_LINE_BULLET_RE, (m, nl, ws, ch) =>
    PUA_BULLET_CODES.has(ch.charCodeAt(0) - 0xf000) ? `${nl}${ws}` : m)
  return (s.match(PUA_ANY_RE) || []).length
}
const MATH_PUA_MIN = 2

/* SUTUN ESIGI. Bir em'den genis bosluk sutun sayilir: kelime arasi bosluk
   tipik olarak 0.25-0.35 em, sutun arasi birkac em. 15. slaydin calisma
   tablosunda olculen en dar sutun araligi 1.6 em. */
const SUTUN_BOSLUGU_EM = 1.0
/* Sayfayi "tablo bicimli" saymak icin: en az bu kadar satirda en az iki sutun
   ayraci. Uc satir bir basligi ve iki veri satirini karsilar —
   detectAndFormatPdfTables da zaten uc satir istiyor. */
const TABLO_SATIR_MIN = 3

/** Yeniden dizilen metin tablo bicimli mi? (bkz. SUTUN_BOSLUGU_EM) */
function tabloBicimliMi(metin: string): boolean {
  let satir = 0
  for (const l of String(metin || '').split('\n')) {
    if ((l.match(/ {2,}/g) || []).length >= 2) satir++
  }
  return satir >= TABLO_SATIR_MIN
}

interface PdfTextItemLike {
  str?: string
  transform?: number[]
  width?: number
  height?: number
  hasEOL?: boolean
}

interface PdfBox {
  s: string
  x0: number
  x1: number
  y: number
  fs: number
  bot: number
  top: number
  role: '' | '^' | '_'
}

const EQ_OPERATORS = new Set(['=', '+', '−', '≈', '≠', '≤', '≥', '×', '⇒'])
const HAT_GLYPH_RE = /^[ˆ̂]$/

function medianOf(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

function largestGap(boxes: PdfBox[], lo: (b: PdfBox) => number, hi: (b: PdfBox) => number): { size: number; at: number } | null {
  const iv = boxes.map(b => [lo(b), hi(b)]).sort((a, b) => a[0] - b[0])
  let best: { size: number; at: number } | null = null
  let reach = iv[0][1]
  for (let i = 1; i < iv.length; i++) {
    const gap = iv[i][0] - reach
    if (gap > 0 && (!best || gap > best.size)) best = { size: gap, at: (reach + iv[i][0]) / 2 }
    reach = Math.max(reach, iv[i][1])
  }
  return best
}

/** XY-cut: once sutun bosluklari (>= 1.2 em), sonra satir bosluklari. Sutun
 *  once, cunku slaytlarda denklem solda, aciklama kutusu sagda duruyor; satir
 *  once kesilseydi kutunun cumleleri denklem satirlarinin arasina dagilirdi
 *  (10. slaytta tam olarak bu oldu). */
function xyCut(boxes: PdfBox[], depth = 0): PdfBox[][] {
  if (boxes.length <= 1 || depth > 40) return [boxes]
  const em = medianOf(boxes.map(b => b.fs)) || 12
  const v = largestGap(boxes, b => b.x0, b => b.x1)
  if (v && v.size >= 1.2 * em) {
    const L = boxes.filter(b => b.x1 <= v.at)
    const R = boxes.filter(b => b.x0 >= v.at)
    if (L.length && R.length && L.length + R.length === boxes.length) {
      return [...xyCut(L, depth + 1), ...xyCut(R, depth + 1)]
    }
  }
  const h = largestGap(boxes, b => b.bot, b => b.top)
  if (h && h.size >= 0.1 * em) {
    const T = boxes.filter(b => b.bot >= h.at)
    const B = boxes.filter(b => b.top <= h.at)
    if (T.length && B.length && T.length + B.length === boxes.length) {
      return [...xyCut(T, depth + 1), ...xyCut(B, depth + 1)]
    }
  }
  return [boxes]
}

/** Sapka gliflerini (ˆ) altlarindaki harfe birlestirici isaret olarak tak. */
function attachHats(boxes: PdfBox[]): PdfBox[] {
  const hats = boxes.filter(b => HAT_GLYPH_RE.test(b.s.trim()))
  if (!hats.length) return boxes
  const rest = boxes.filter(b => !HAT_GLYPH_RE.test(b.s.trim()))
  const marks = new Map<PdfBox, Set<number>>()
  for (const h of hats) {
    const c = (h.x0 + h.x1) / 2
    let best: { b: PdfBox; dy: number } | null = null
    for (const b of rest) {
      if (c < b.x0 - 1 || c > b.x1 + 1) continue
      const dy = Math.abs(h.y - b.y)
      if (dy > 1.0 * b.fs) continue
      if (!best || dy < best.dy) best = { b, dy }
    }
    if (!best) continue
    const chars = [...best.b.s]
    const k = Math.max(0, Math.min(chars.length - 1,
      Math.floor((c - best.b.x0) / Math.max(1e-6, best.b.x1 - best.b.x0) * chars.length)))
    if (!marks.has(best.b)) marks.set(best.b, new Set())
    marks.get(best.b)!.add(k)
  }
  for (const [b, ks] of marks) {
    b.s = [...b.s].map((ch, i) => (ks.has(i) && /[A-Za-zα-ωΑ-Ω]/.test(ch) ? ch + '̂' : ch)).join('')
  }
  return rest
}

/** Bir yaprak blogu satirlara ayir. En buyuk font taban cizgilerini belirler;
 *  daha kucuk, kisa ve yukari/asagi kaymis ogeler o satirin ust/alt simgesi. */
function leafLines(boxes: PdfBox[]): string[] {
  type Line = { y: number; fs: number; items: PdfBox[]; minX: number; maxX: number }
  const lines: Line[] = []
  for (const b of [...boxes].sort((a, b) => b.fs - a.fs)) {
    let home: Line | null = null
    const scriptLike = b.s.trim().length <= 4 && !/\s/.test(b.s.trim())
    for (const ln of lines) {
      const dy = b.y - ln.y
      if (Math.abs(dy) <= 0.2 * ln.fs) { home = ln; b.role = ''; break }
      const smaller = b.fs < 0.85 * ln.fs
      if (scriptLike && smaller && b.x0 >= ln.minX - 2 && b.x0 <= ln.maxX + 0.6 * ln.fs) {
        if (dy > 0.15 * ln.fs && dy <= 0.65 * ln.fs) { home = ln; b.role = '^'; break }
        if (dy < -0.08 * ln.fs && dy >= -0.45 * ln.fs) { home = ln; b.role = '_'; break }
      }
    }
    if (!home) {
      home = { y: b.y, fs: b.fs, items: [], minX: b.x0, maxX: b.x1 }
      lines.push(home)
      b.role = ''
    }
    home.items.push(b)
    home.minX = Math.min(home.minX, b.x0)
    home.maxX = Math.max(home.maxX, b.x1)
  }
  lines.sort((a, b) => b.y - a.y)
  return lines.map(ln => {
    let out = ''
    let prev: PdfBox | null = null
    for (const b of ln.items.sort((a, b) => a.x0 - b.x0)) {
      const script = b.role === '^' || b.role === '_'
      let s = b.s
      if (script) s = b.role + ([...s].length > 1 ? `{${s}}` : s)
      else if (EQ_OPERATORS.has(s.trim())) s = ` ${s.trim()} `
      if (prev && !script && !out.endsWith(' ') && !s.startsWith(' ')) {
        const gap = b.x0 - prev.x1
        // β_1x_1 -> "β_1 x_1" (bitisik yazilinca alt simgenin nerede bittigi
        // belirsizlesiyor), "andβ_1" -> "and β_1".
        const afterScript = (prev.role === '^' || prev.role === '_') && /^[A-Za-zα-ωΑ-Ω]/.test(s)
        const wordThenGreek = /[A-Za-z]{2,}$/.test(out) && /^[α-ωΑ-Ω]/.test(s)
        // GENIS BOSLUK = SUTUN SINIRI. detectAndFormatPdfTables sutunlari iki
        // ve daha fazla bosluktan tanir; unpdf'in akis metni hic bosluk
        // tasimadigi icin o fonksiyon bu boru hattinda HIC calisamiyordu ve
        // metindeki tablolar (ornegin 15. slaydin calisma tablosu) modele duz
        // bir rakam dizisi olarak gidiyordu. Konum bilgisi elimizde: iki oge
        // arasi bir em'den genisse sutun ayraci yazilir.
        if (gap > SUTUN_BOSLUGU_EM * ln.fs) out += '  '
        else if (gap > 0.22 * ln.fs || afterScript || wordThenGreek) out += ' '
      }
      /* YAN YANA IKI OPERATORUN DOLGUSU SUTUN AYRACI DEGIL. Operatorler
         ` op ` diye yaziliyor; "= −" ikilisi "=  −" (iki bosluk) uretiyor ve
         iki bosluk artik sutun siniri anlamina geldigi icin 29. slaydin
         "-12.08 + 2(0.09)39 = − 12.08 + 7.02 = − 5.06" satiri bozuluyordu.
         Eski surum butun boslukları `\s+` ile ezdigi icin bu gorunmuyordu;
         sutun ayraci korunmaya baslayinca ortaya cikti. */
      if (out.endsWith(' ') && s.startsWith(' ')) s = s.slice(1)
      out += s
      prev = b
    }
    return out
  })
}

/* ===========================================================================
   TABLO SAYFALARI SATIR SATIR OKUNUR (09.10.2026)

   xyCut once SUTUNU ayiriyor — slaytta denklem solda, aciklama kutusu sagda
   oldugu icin dogru karar. Ama gercek bir TABLODA ayni kural satirlari yok
   ediyor: 15. slaydin calisma tablosu sutun sutun okunup

     Case, i / 1 / 2 / 3 / 4 / yi / 1 / 4 / 1 / 3 / x1i / ...

   haline geliyordu, yani devrik. Model bunu tablo olarak goremez; nitekim
   iki canli kosuda da pencerelerden sifir tablo geldi.

   Tablo olup olmadigi OLCULUYOR: ogeler taban cizgisine gore satirlara
   ayrilir, uc veya daha fazla satirda ucer+ hucre varsa ve bu hucrelerin
   sol kenarlari satirdan satira ayni sutunlara hizaliysa sayfa tablodur.
   Hizalama sarti onemli: ust uste gelen uc dolu metin satiri tablo degildir,
   sutunlari ancak gercek bir tablo tutturur.
   =========================================================================== */
const TABLO_SUTUN_MIN = 3
/* Tablo hucresi KISADIR. Duz yazi satiri de ucer parcaya bolunebiliyor
   (slaytta tireyle ayrilmis bir baslik gibi); hucre uzunlugu ikisini ayiriyor.
   15. slaytta en uzun hucre "x1i x2i" = 7 karakter. */
const TABLO_HUCRE_MAX = 16
/* Sutun sol kenarlarinin satirdan satira kayabilecegi pay. */
const TABLO_HIZA_EM = 1.5

/** Ogeleri taban cizgisine gore satirlara ayirir (ustten alta).
 *
 *  Buyuk font ONCE islenir ki satirlari ana metin kursun; kucuk ve kisa
 *  ogeler (ust/alt simge) kendi satirlarini acmak yerine en yakin satira
 *  katilir. Aksi halde 23. slayttaki "x_j^2" ifadesinin 2'si kendi satirina
 *  dusuyor ve formul kareyi kaybediyordu. */
function tabanSatirlari(boxes: PdfBox[]): PdfBox[][] {
  const satirlar: Array<{ y: number; fs: number; items: PdfBox[] }> = []
  for (const b of [...boxes].sort((a, b) => b.fs - a.fs || b.y - a.y)) {
    const kisa = b.s.trim().length <= 4 && !/\s/.test(b.s.trim())
    const ev = satirlar.find(l => {
      const dy = Math.abs(l.y - b.y)
      if (dy <= 0.4 * Math.max(l.fs, b.fs)) return true
      return kisa && b.fs < 0.85 * l.fs && dy <= 0.7 * l.fs
        && b.x0 >= Math.min(...l.items.map(i => i.x0)) - 2
        && b.x0 <= Math.max(...l.items.map(i => i.x1)) + 0.6 * l.fs
    })
    if (ev) ev.items.push(b)
    else satirlar.push({ y: b.y, fs: b.fs, items: [b] })
  }
  return satirlar
    .sort((a, b) => b.y - a.y)
    .map(l => l.items.sort((a, b) => a.x0 - b.x0))
}

/** Sayfa bir tabloysa satir satir metnini doner, degilse null.
 *
 *  OLCUT: ardisik satirlarda AYNI hucre sayisi. Sol kenar hizasi denenip
 *  birakildi — 15. slaydin basligi sola, verisi ortaya hizali ve sapma
 *  43 punto; hucre SAYISI ise alti satirda da tam olarak bes. Denklem
 *  sayfalarinda ise sayi her satirda baska (3, 1, 18, 4, 14, 26...), cunku
 *  formuller cok sayida kucuk parcaya boluniyor — bu yuzden ayni olcut
 *  onlari tablo sanmiyor. */
function tableLayout(boxes: PdfBox[]): string | null {
  const satirlar = tabanSatirlari(boxes)
  const sayilar = satirlar.map(r => r.length)
  let enIyi: { n: number; bas: number; boy: number } | null = null
  for (let i = 0; i < sayilar.length; i++) {
    if (sayilar[i] < TABLO_SUTUN_MIN) continue
    let j = i
    while (j + 1 < sayilar.length && sayilar[j + 1] === sayilar[i]) j++
    const boy = j - i + 1
    if (boy >= TABLO_SATIR_MIN && (!enIyi || boy > enIyi.boy)) {
      enIyi = { n: sayilar[i], bas: i, boy }
    }
    i = j
  }
  if (!enIyi) return null

  const kosu = satirlar.slice(enIyi.bas, enIyi.bas + enIyi.boy)

  // Hucreler kisa olmali: duz yazi satirlari da ayni sayida parcaya
  // bolunebilir, ama parcalari uzundur.
  const uzunluk: number[] = []
  for (const r of kosu) for (const b of r) uzunluk.push(b.s.trim().length)
  if (medianOf(uzunluk) > TABLO_HUCRE_MAX) return null

  /* SUTUNLAR HIZALI OLMALI. Yalnizca "ayni sayida hucre" yetmiyordu: 30.
     slayttaki denklem parcalari da ucer ucer bolunup tablo gibi gorunuyor ve
     o sayfa tablo kipine girince sapkalari kaybediyordu (β̂_1 -> β_1).
     Gercek tabloda k'inci hucrenin sol kenari satirdan satira ayni yerde
     durur. Baslik satiri disarida tutulabiliyor: 15. slaytta baslik sola,
     veri ortaya hizali. */
  const hizaliMi = (rs: PdfBox[][]): boolean => {
    if (rs.length < TABLO_SATIR_MIN) return false
    const em = medianOf(rs.flat().map(b => b.fs)) || 12
    for (let k = 0; k < enIyi!.n; k++) {
      const xs = rs.map(r => r[k].x0)
      if (Math.max(...xs) - Math.min(...xs) > TABLO_HIZA_EM * em) return false
    }
    return true
  }
  if (!hizaliMi(kosu) && !hizaliMi(kosu.slice(1))) return null

  // Her satir leafLines'tan gecer: ust/alt simge ve genis bosluk kurallari
  // tablo kipinde de aynen gecerli olsun diye. Tum sayfayi birlikte vermek
  // denendi ve eksen etiketlerinin alt simgeleri komsu satira atladi; satir
  // satir vermek hem sutunlari hem simgeleri dogru tutuyor.
  // ATLANAN tek sey xyCut — sutunu once ayirip tabloyu devirten oydu.
  const out: string[] = []
  for (const r of satirlar) out.push(...leafLines(attachHats(r)))
  return out
    .map(l => l.replace(/[\t\r\n]+/g, ' ').replace(/ {3,}/g, '  ').trim())
    .filter(Boolean)
    .join('\n')
    .normalize('NFC')
}

/** pdf.js metin ogelerini konumlu kutulara cevirir (PUA haritasi uygulanmis). */
function pageBoxes(items: PdfTextItemLike[]): PdfBox[] {
  const boxes: PdfBox[] = []
  for (const it of items || []) {
    if (!it || typeof it.str !== 'string') continue
    const s = mapSymbolPua(it.str)
    if (!s.trim()) continue
    const t = Array.isArray(it.transform) && it.transform.length >= 6 ? it.transform : [1, 0, 0, 1, 0, 0]
    const fs = Math.hypot(t[2], t[3]) || Math.abs(t[3]) || Number(it.height) || 10
    const x0 = t[4]
    const y = t[5]
    const w = Math.max(0, Number(it.width) || 0)
    boxes.push({ s, x0, x1: x0 + w, y, fs, bot: y - 0.2 * fs, top: y + 0.8 * fs, role: '' })
  }
  return boxes
}

/** Bir sayfanin pdf.js metin ogelerinden okuma sirasinda metin kur. */
function rebuildPageText(items: PdfTextItemLike[]): string {
  const boxes = pageBoxes(items)
  if (!boxes.length) return ''
  const lines: string[] = []
  for (const group of xyCut(attachHats(boxes))) lines.push(...leafLines(group))
  return lines
    // Sutun ayraci olan iki boslugu KORU; sekme/satir sonu ve uc+ boslugu sadelestir.
    .map(l => l.replace(/[\t\r\n]+/g, ' ').replace(/ {3,}/g, '  ').trim())
    .filter(Boolean)
    .join('\n')
    // Geometrinin yerlestiremedigi sapka: gurultu birakmaktansa dusur.
    .replace(/[ \t]*ˆ[ \t]*/g, '')
    // y + U+0302 -> ŷ (U+0177). Hazir bileseni olan harfler tek karaktere
    // iner; β̂ gibi olmayanlar birlesik kalir. Ayni metin iki farkli kodlamayla
    // gelince arama ve tekrar tespiti onlari farkli sanar.
    .normalize('NFC')
}

/** pdf.js'in akis sirasi — unpdf'in extractText'iyle birebir ayni birlestirme. */
function streamPageText(items: PdfTextItemLike[]): string {
  return (items || [])
    .filter(it => it && it.str != null)
    .map(it => String(it.str) + (it.hasEOL ? '\n' : ''))
    .join('')
}

/** Yeniden dizilen sayfa, harf kaybetmemeli. Sapka ve parantez parcalari
 *  dusuyor; daha fazlasi kayboluyorsa bir sey ters gitmistir, akis metni
 *  (PUA haritali) kalir. */
const REBUILD_MIN_KEEP = 0.85

function chooseEquationPageText(items: PdfTextItemLike[]): { text: string; rebuilt: boolean } {
  const stream = streamPageText(items)
  const matematik = countMathPua(stream) >= MATH_PUA_MIN
  let rebuilt: string | null = null
  try {
    // Once TABLO duzeni: sayfa gercekten bir tabloysa satir satir okunur
    // (bkz. tableLayout). Degilse olagan xyCut duzeni.
    rebuilt = tableLayout(pageBoxes(items)) ?? rebuildPageText(items)
  } catch (_e) {
    rebuilt = null
  }
  // Matematik yoksa da TABLO icin yeniden dizilir: akis metni sutun boslugu
  // tasimadigi icin metindeki tablolar modele duz rakam dizisi gidiyordu.
  if (rebuilt !== null && (matematik || tabloBicimliMi(rebuilt))) {
    const harf = (s: string) => s.replace(/[\ŝˆ]/g, '').length
    if (harf(rebuilt) >= REBUILD_MIN_KEEP * harf(mapSymbolPua(stream))) {
      return { text: rebuilt, rebuilt: true }
    }
  }
  return { text: mapSymbolPua(stream), rebuilt: false }
}

/** Tum sayfalar: tek getTextContent, gerekirse yeniden dizim. */
async function extractPdfPagesWithEquations(pdf: any): Promise<{ pages: string[]; rebuilt: number[] }> {
  const pages: string[] = []
  const rebuilt: number[] = []
  const n = Number(pdf?.numPages) || 0
  for (let i = 1; i <= n; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const res = chooseEquationPageText(content?.items || [])
    pages.push(res.text)
    if (res.rebuilt) rebuilt.push(i)
  }
  return { pages, rebuilt }
}

// ==========================================================================
// LONG-DOCUMENT SUMMARIZATION ENGINE (chunked map-reduce + adaptive length)
//
// Problem this solves: previously, ANY document — a 3-page handout or a
// 52-page slide deck — got the exact same fixed output size per length
// preset ("medium" always meant "4-8 sentences, 5-10 key terms, 4-6 quiz
// questions"), and text beyond 40,000 characters was silently truncated and
// never seen by the model at all. Long documents therefore got a shallow
// summary of roughly their first third, at best.
//
// Fix, in two parts:
//   1. computeAdaptiveTargets() / buildLengthInstruction() — the target
//      counts (summary sentences, key terms, key points, quiz questions)
//      now grow with the actual amount of extracted text, per length
//      preset, up to a sane cap. This applies to every document.
//   2. For documents whose extracted text exceeds CHUNK_THRESHOLD, we
//      switch from a single Groq call to a per-window extraction pipeline,
//      then synthesize one cohesive final summary from the per-window
//      digests and merge+dedupe the per-window structured data down to the
//      adaptive target counts. Visual (image) analysis is intentionally
//      skipped for that path to keep this addition scoped — it only ever
//      applies to the short-document fast path today anyway.
//
// WHICH LONG-DOC CODE ACTUALLY RUNS (read this before trusting the rest):
//   The live long-document implementation is the "LONG-DOC PATH" block
//   inside serve(), built on the locally-defined `compactWindowPrompt` and
//   `extractWindow` (MODEL_HEAVY). It was written to fix Groq 413
//   payload-too-large errors and it SUPERSEDED an earlier, richer
//   map-reduce design whose prompt builders are still in this file:
//
//     buildChunkSystemPrompt()     — NOT WIRED
//     buildSynthesisSystemPrompt() — NOT WIRED
//
//   Both are deliberately retained, not dead by accident:
//   tests/map-model-compare.js extracts buildChunkSystemPrompt() from this
//   source at runtime as the "rich" arm of its prompt comparison, so the
//   richer schema can be measured (grounding %, page validity, output
//   counts, latency, tokens) against the live compact prompt on real
//   documents before we decide whether to promote it. Do not delete them
//   without also updating that harness; do not assume either one is what
//   runs in production today.
//
//   Promoting the richer schema is gated on the token budget, not on
//   taste: every extra field competes for the same maxCompletionTokens,
//   and this account's observed tokens-per-minute cap has been as low as
//   8,000 (see the draftTiers and review-tier comments further down). The
//   same constraint is why concept_graph was added, measured as thinner,
//   and correctly reverted — and why citations are now computed
//   deterministically in anchorCitations() instead of being prompted for.
// ==========================================================================

// CHUNK_THRESHOLD used to be 18000, on the assumption that anything under
// that size could always be sent whole on the short-document fast path.
// That assumption broke once the fast path's own TPM-driven "shrink and
// retry" tiers were added (see draftTiers below, tier 1 = 6000 chars): a
// document between 6000-18000 chars was classified "short" but then had
// its OWN fast-path attempt truncate it down to whatever tier finally fit
// the account's 8000 TPM limit — silently dropping most of a genuinely
// substantial document's content (confirmed on a real 52-page slide deck
// where pages ~20-52 never reached the model at all). CHUNK_THRESHOLD must
// therefore match the fast path's actual safe full-send capacity (draft
// tier 1's textChars) — anything larger MUST route to the chunked
// map-reduce pipeline instead, which never truncates (every chunk gets its
// own full analysis pass), rather than being silently cut down to size.
const CHUNK_THRESHOLD = 6000 // chars of extracted text; above this we go chunked — keep in sync with draftTiers[0].textChars below
// HOTFIX: larger chunks → fewer LLM rounds so ~50-page PDFs finish before Edge wall-clock
const CHUNK_TARGET_SIZE = 10000 // chars per chunk

// Madde 6 — model tiering (cost + TPM isolation)
// Heavy model: single-pass draft + synthesis (quality-critical, fewer calls)
// Fast model: per-chunk map + review (many calls, smaller completions)
const MODEL_HEAVY = "openai/gpt-oss-120b"
// Groq meters tokens-per-minute PER MODEL, so putting the review/critic pass
// on a different model from the draft buys it a separate 8,000 rather than
// making it queue behind the draft's spend. That is the whole point of the
// split — and it had never worked, because the id below was Groq's retired
// 3.6 line and every call to it 404'd. Verified against Groq's current model
// list on 2026-10-04: qwen/qwen3.8-27b is the live vision-capable model.
const MODEL_FAST = "qwen/qwen3.8-27b"
// A SECOND extraction lane. Limits read off the org's Groq console on
// 05.10.2026 — identical to gpt-oss-120b in every column:
//
//   openai/gpt-oss-120b   30 RPM  1K RPD  8K TPM  200K TPD
//   openai/gpt-oss-20b    30 RPM  1K RPD  8K TPM  200K TPD
//
// and metered separately, which this pipeline proved the hard way earlier.
// That matters because a window call costs ~6,150 tokens against a 7,200
// working budget: two windows cannot share a lane in one minute, so on a
// multi-window document every window after the first sat out a full 60s.
// Measured on a 31,817-char deck: 3 windows, two 60s waits, 132s total, and
// the vision pass, the narrative writer and review all skipped for want of
// budget. Alternating lanes lets consecutive windows run side by side.
//
// Extraction only. 20b is the smaller sibling and this is pattern work —
// pulling terms and points out of text — not prose. The narrative writer
// stays on MODEL_HEAVY, where the writing quality is the point.
const MODEL_EXTRACT = "openai/gpt-oss-20b"

/**
 * Reasoning parameters for a model id — NEVER hardcode these per call site.
 *
 * The two families disagree on what "don't think, just answer" looks like:
 *   qwen    — hybrid reasoner, thinks by default, accepts reasoning_effort:"none"
 *   gpt-oss — accepts ONLY "low" | "medium" | "high"; "none" is a hard 400
 *
 * That difference was invisible while every call pinned its own model. Then
 * 509bd5f unpinned review so it could pick a free lane, review landed on
 * gpt-oss-120b carrying a literal reasoning_effort:"none", and Groq answered:
 *
 *   400 `reasoning_effort` must be one of `low`, `medium`, or `high`
 *
 * It had already paid a 52-second pacer wait for that lane, so the single-
 * window document lost review entirely and the run got ~4s longer for nothing
 * (05.10.2026, economy chapter 20 — review had been working there before).
 *
 * The lesson is not "put the right string at the review call". It is that a
 * dynamic `model` and a static reasoning parameter cannot coexist: every call
 * that picks its lane at runtime must derive these from the lane it picked.
 */
function reasoningParamsFor(model: string): Record<string, unknown> {
  const id = String(model)
  if (id.includes('gpt-oss') || id.startsWith('openai/')) {
    // "low" is as close to off as this family goes, and include_reasoning:false
    // keeps the <think> block out of `content` so JSON.parse gets clean JSON.
    return { reasoning_effort: "low", include_reasoning: false }
  }
  if (id.includes('qwen')) return { reasoning_effort: "none" }
  // Unknown model: send nothing. An unsupported parameter is a 400, and a
  // silent omission only costs us some reasoning tokens.
  return {}
}

/**
 * Reasoning tokens are COMPLETION tokens, and the gpt-oss family cannot be
 * told to stop producing them.
 *
 * max_completion_tokens caps reasoning plus content together. qwen takes
 * reasoning_effort:"none" and spends the whole budget on the answer; gpt-oss
 * accepts only low/medium/high, so even at its lowest it thinks first and
 * the answer comes out of whatever is left.
 *
 * Review's 850-token budget was sized against qwen's 1,000 OTPM ceiling back
 * when review was pinned to that lane. 509bd5f let it pick a lane at
 * runtime, the budget did not follow, and on the accounting chapter
 * (05.10.2026) review landed on gpt-oss-120b and came back with:
 *
 *   400 json_validate_failed ... "failed_generation": ""
 *
 * Not a malformed answer — NO answer. The reasoning had eaten all 850 tokens
 * before a character of content was written, and the empty string failed
 * Groq's JSON check. The run paid for the call and the wait and got nothing.
 *
 * So the tier numbers stay what they always meant — how much ANSWER this
 * tier needs — and the lane decides how much thinking room to add on top.
 * clampCompletion still applies afterwards, so qwen cannot exceed its OTPM
 * ceiling no matter what this returns.
 *
 * HOW BIG THE HEADROOM CAN BE is not a matter of taste — there is a ceiling,
 * and it comes from the pacer. estimateTokens counts completion at
 * PACER_COMPLETION_FACTOR, so raising this raises review's estimate, its
 * queue wait, and the chance the budget gate skips it on a long document.
 * From the measured economy run (est=6645 at completion=850):
 *
 *   text part of the estimate ............ 6,135 tokens
 *   lane ceiling (8,000 x PACER_SAFETY) .. 7,200
 *   room left for completion x 0.6 ....... 1,065
 *   -> largest completion that still fits . 1,775
 *
 * So the content budget of 850 leaves at most ~900 of headroom before review
 * stops fitting in its own lane at all. 1,200 was the first value tried here
 * and it put the estimate at 7,365 — over the ceiling, which would have
 * traded an empty answer for no answer.
 *
 * 700 it is: 2.3x the thinking room review had, still inside the lane.
 *
 * And it remains a starting value, not a measurement. All that run proved is
 * that "low" reasoning sometimes costs more than the ~550 tokens left over
 * from 850 — the economy document's review passed on the same model and the
 * same budget, so this varies per prompt and probably per run. The real
 * figure is logged per call now
 * (usage.completion_tokens_details.reasoning_tokens) so it can be set from
 * data instead of from this comment.
 */
const REASONING_HEADROOM = 700

function reviewCompletionFor(model: string, contentTokens: number): number {
  const id = String(model)
  const thinks = id.includes('gpt-oss') || id.startsWith('openai/')
  return thinks ? contentTokens + REASONING_HEADROOM : contentTokens
}

/**
 * Pick the lane that can take this call SOONEST.
 *
 * Alternating by index was the first version and it only half worked. On a
 * 3-window document (05.10.2026) windows 1 and 2 did run side by side — same
 * millisecond in the log, the 60s gap between them gone — but window 3 went
 * back to MODEL_HEAVY purely because its index was even, and sat out a full
 * window while the other lane was equally busy. Parity does not know which
 * lane is free; the pacer does.
 *
 * The same run showed the sharper version of the problem downstream. The
 * narrative writer waited 57 seconds on MODEL_HEAVY at a moment when
 * MODEL_EXTRACT's ledger had just aged out and would have taken it instantly.
 * Nothing was overloaded — we were queueing for one lane while another stood
 * empty.
 *
 * Order matters: `models` is in preference order, and ties go to the first,
 * so a caller that cares about quality lists its preferred model first and
 * still gets it whenever that costs nothing.
 */
function pickLane(
  models: string[],
  estTokens: number,
  estCompletion = 0,
  claimed?: Set<string>
): string {
  // Lanes already taken by a sibling call in the SAME batch are skipped while
  // an unclaimed one exists. Without this, concurrent pickers all see empty
  // ledgers and all choose the preferred lane: on 05.10.2026 windows 1 and 2
  // both landed on MODEL_HEAVY and drove it to used=10386/7200 — over its own
  // budget — while MODEL_EXTRACT sat idle and the next call paid a 58s wait.
  // The pacer cannot help here: it records a spend when the response ARRIVES,
  // and these decisions are all made before any of them has.
  const free = claimed ? models.filter(m => !claimed.has(m)) : models
  const pool = free.length > 0 ? free : models
  let best = pool[0]
  let bestWait = Infinity
  for (const m of pool) {
    const wait = tokenPacer.waitEstimate(estTokens, m, estCompletion)
    if (wait < bestWait) { best = m; bestWait = wait }
    if (bestWait === 0) break
  }
  claimed?.add(best)
  return best
}
// Skip the expensive review pass for short, simple documents (saves ~1 full LLM call)
const SKIP_REVIEW_MAX_CHARS = 3500
const CHUNK_MAX_COMPLETION = 1536 // slightly smaller → faster chunk map
const SYNTHESIS_MAX_COMPLETION = 3072
const DRAFT_MAX_COMPLETION = 4096
const REVIEW_MAX_COMPLETION = 4096
// Review timing, used both to budget the gate and to drive the call itself,
// so the two can never disagree about what a review attempt costs.
const REVIEW_ATTEMPT_TIMEOUT_MS = 25_000
/* Review denemesinin EN KISA zaman asimi (25.10.2026). Kapi eskiden her
   zaman 25 sn'lik tam denemeyi fiyatliyordu; olculen review sureleri ise
   0,93 sn (kosu 38, qwen) ve 2,66 sn. Artik deneme suresi kalan butceye
   uyuyor (en fazla REVIEW_ATTEMPT_TIMEOUT_MS) ve ancak bu tabanin altina
   inerse review atlaniyor — olculenin ~4 kati. Akan Gemini akisina verilen
   ek sure (GEMINI_AKIS_SONRASI_PAYI_MS) bunun sayesinde review'u yemiyor. */
const REVIEW_MIN_ATTEMPT_MS = 10_000
// Everything after the review call: JSON parse, grounding gate, near-duplicate
// merge, citation anchoring, cloze build, DB save. All deterministic; measured
// at ~200ms on a live 30-page run, so this is ~40x headroom.
const REVIEW_TAIL_MS = 8_000
// Cap parallel chunk calls to reduce TPM bursts.
// SPEED FIX: the long-document "windows" loop below used to await each
// window's Groq call one at a time (effective concurrency of 1) even though
// this constant existed — it was defined but never actually wired into that
// loop. For an 8-window document at up to 40s per window, that meant up to
// ~5 minutes just for this one stage, and it also meant the budgetLeft()
// early-stop kicked in after only 2-3 windows on longer documents (worse
// coverage, not just slower). The window loop now processes windows in
// concurrent batches of this size instead, which cuts that stage's
// wall-clock time roughly proportionally AND lets more windows complete
// within the same PIPELINE_BUDGET_MS. 3 is a moderate step up from the
// original (unused) value of 2 — each window's own extractWindow() retry
// logic already backs off gracefully on 429s, so a modest concurrency bump
// here trades a small increase in rate-limit retries for a large wall-clock
// win, without the aggressiveness of a bigger jump.
const CHUNK_CONCURRENCY = 3
const MAX_CHUNKS = 12 // hard ceiling: prefer finishing over analyzing every page under Edge timeout
// Soft wall-clock budget (ms) for the whole function — leave headroom under ~150s platform limit
const PIPELINE_BUDGET_MS = 110_000

/* Gemini yolu icin daha genis butce (09.10.2026 olcumu).
 *
 * Ilk basarili gölge kosusunda Gemini cagrisi 72,4 saniye surdu ve geriye
 * 26,8 saniye kaldi; review'un en kucuk kademesi bile 33 saniye istiyordu,
 * dolayisiyla review ATLANDI. Oysa Groq yolunun butun pencere cagrilari ve
 * pacer beklemeleri bu yolda HIC yok — 110 saniye o beklemelere gore
 * secilmisti.
 *
 * Supabase'in sert siniri ~150 saniye. 130 saniye, review'a yer acarken
 * 20 saniyelik emniyet payi birakiyor. YALNIZCA Gemini taslagi geldiginde
 * devreye giriyor; Groq yolu 110 saniyede kaliyor. */
const GEMINI_PIPELINE_BUDGET_MS = 130_000
// A window call, compact-split to window-ok, measured across four live runs:
// 2.9s, 3.3s, 4.0s, 5.3s. Used to budget a retry, and deliberately several
// times the measured cost.
const WINDOW_CALL_MS = 15_000
// Superseded as a gate by a measured wait + cost; see the json_validate_failed
// branch. Kept only so the old reasoning stays readable in one place:
//
//   "A retry is one more window call, which on this account's 8,000 TPM means
//    a ~60s TokenPacer wait"
//
// True with one lane. With two, pickLane sends the retry to whichever lane is
// free, and on 05.10.2026 that would have been a 0.7s wait. The 70s floor was
// a constant left behind by its own fix — the same way the narrative writer's
// 40s reserve was — and it cost a third of a document: window 3 failed at
// 64.1s with 45.9s of budget left, 70 > 45.9, no retry, zero terms from that
// slice.
const JSON_RETRY_MIN_BUDGET_MS = 70_000

// Vision pass sizing, both numbers forced by the same 8,000 TPM ceiling.
//
// Groq bills every image at a flat 2,048 input tokens and accepts at most 3
// per request. Three would be 6,144 tokens of image alone; with the system
// prompt and the completion reservation that lands around 9,000 and the
// request is rejected outright. Two fits: 4,096 + ~330 prompt + ~1,840
// completion reservation is about 6,300, inside the pacer's 7,200 ceiling.
const VISION_TOKENS_PER_IMAGE = 2048
// Raised alongside the compact-window bump (2048 -> 3072): the near-blank
// pages this pass reads are where a table, chart or diagram is most likely to
// live, and a Mermaid block or multi-row table needs the room.
const VISION_MAX_COMPLETION = 3072
const VISION_MAX_IMAGES = 2
// The vision pass is an EXTRA call, and on this tier every extra call means a
// full ~60s TokenPacer wait before it can start. The narrative writer runs
// after it and has its own 35s budget gate, so the visual pass may only start
// when there is room for both: ~65s for itself, 35s for the writer's gate.
// Below that it skips itself, which is the correct trade — a card always has
// a written summary, and figure values are the optional extra.
// Replaced as a gate by a measured wait + cost (see the vision block); kept
// because the fast path still reads it.
const VISUAL_MIN_BUDGET_MS = 100_000
// MEASURED, not guessed. Both of these were round numbers picked for safety,
// and both were wrong by enough to change behaviour: on 05.10.2026 the vision
// pass was skipped at "butce 43031ms <= 70000ms" when the work it was being
// denied budget for takes a fraction of that.
//
// Vision call, PDF.co render to merged patch, across four live runs:
//   6.7s, 6.0s, 7.2s, 6.5s  -> ~6.6s average. The old 30s was 4.5x reality.
const VISION_CALL_MS = 15_000
/* OPSIYONEL ADIMLAR ICIN BEKLEME TAVANI (21.10.2026).
 *
 * IKI YERDE kullaniliyor: compact synthesis ve gorsel gecis. Ikisi de
 * zenginlestirme — kartin kendisi pencerelerden cikiyor, bu ikisi onun
 * ustune bir seyler koyuyor. Dolayisiyla ikisi de "yer varsa kos" degil
 * "deger ediyorsa kos" kuralina tabi.
 *
 * ILK HALI YALNIZCA GORSEL GECISI KORUYORDU VE ISE YARAMADI (ayni gun,
 * iki saat sonra olculdu). Tavan dogru fikirdi, yanlis cagriya kondu:
 *
 *   t=34,4  Window 1 ok / Window 2 ok
 *   t=34,5  TokenPacer[openai/gpt-oss-20b]: 57955ms bekliyor (used=6095/7200)
 *   t=93,6  Gorsel sayfa secimi [26,40]
 *
 * Bekleme gorsel cagridan ONCE, compact synthesis cagrisinda oluyor
 * (callGroqJson -> tokenPacer.acquire). Gorsel kapisi sahneye geldiginde
 * dakikalik pencere coktan donmustu, yani waitEstimate kucuk bir sayi
 * dondurdu ve kapi — kendi mantigina gore DOGRU olarak — gecirdi.
 *
 * Kokeni yapisal: iki pencere cagrisi paralel kosuyor ve Groq'un iki
 * seridini birlikte bosaltiyor (ucretsiz katmanda TPM 7200; W1 120b'de
 * 5747, W2 20b'de 6095 token). Sonraki cagri hangi seride giderse gitsin
 * dakikanin donmesini bekliyor. Iki ayri kosuda olculen bekleme 57.657ms
 * ve 57.955ms — sabit, cunku bekledigi sey dakikalik pencerenin kendisi.
 *
 * 20 saniye: gorsel cagri dort canli kosuda 6,0-7,2 saniye olculdu, synthesis
 * benzeri. Cagrinin kendisinin ucundan uzun bir kuyruk, zenginlestirmeye
 * degmiyor. Atlanan adim quality_meta.skipped_stages'e yaziliyor. */
const OPSIYONEL_ADIM_MAX_BEKLEME_MS = 20_000
// Narrative writer, merge to accepted, once it stopped queueing for a busy
// lane: 1.8s. The old 40s reserve was 22x reality — a figure from when the
// writer could sit out a whole TPM window, which pickLane now prevents.
// Its own wait is budgeted separately, so this is the call alone.
const NARRATIVE_WRITER_RESERVE_MS = 20_000

/* PENCERE MALIYETI KALAN BUTCEYE SIGIYOR MU (27.10.2026).
 *
 * Parti dongusundeki butce kapisi yalnizca "20 sn kaldi mi" diye soruyordu;
 * pencerenin GERCEK maliyetini hic sormuyordu. Olculen kosuda (42 sayfalik
 * deste, 31.817 krk, 3 pencere) karar aninda 51 sn kalmisti, kapi gecti —
 * ama ucuncu pencerenin maliyeti 58,3 sn (TokenPacer beklemesi) + 15 sn
 * (WINDOW_CALL_MS) + 20 sn (NARRATIVE_WRITER_RESERVE_MS) = 93 sn idi.
 * TokenPacer 58,3 sn uyudu, nobetci 141. saniyede belgeyi 'failed' yapti ve
 * kart HIC gelmedi — oysa Window 1+2 (16 terim, 17 nokta, 13 soru) elde
 * hazirdi. Bekleme, yazilacak karti goturen seydi.
 *
 * extractWindow'un attempt > 0 dali ayni hesabi zaten yapiyordu (affordHeavy);
 * eksik olan ilk denemeydi. Formul uc yere dagilmasin diye tek fonksiyon. */
function pencereMaliyetiSigiyor(beklemeMs: number, kalanButceMs: number): boolean {
  return kalanButceMs > beklemeMs + WINDOW_CALL_MS + NARRATIVE_WRITER_RESERVE_MS
}

/* ==========================================================================
   PENCERE CIKIS TAVANI SERIT BUTCESINDEN TURETILIR (09.10.2026)

   OLCUM. 42 slaytlik destede iki pencere de basarili kostu:
       Window 1 token: prompt=2995 completion=2452 / max=3072   (%80)
       Window 2 token: prompt=3248 completion=2887 / max=3072   (%94)
   Referans ozete gore metinde VAR ama karta girmemis 8 maddenin 6'si
   pencere 2'nin bolgesinde (slayt 22, 25, 32, 33, 39, 42 — teget dogrusu,
   kubik model, rastgele artiklar, temel/etkilesimli terim ayrimi ve iki
   kukla katsayi takimi: +%50.5/+%56.6 ile -%9.3/+%41.5). Pencere 2
   yazacak yer kalmadigi icin kesiyor.

   AYNI ANDA BOSTA DURAN BUTCE. Pencere 2'nin gercek harcamasi en kotu
   3248 + 3072 = 6.320 token; serit tavani 7.200. 880 token hic
   kullanilmadan duruyor. Duz 3072 bunu goremez cunku belgeye gore
   degismiyor: kisa belgede gereginden genis, uzun pencerede dar.

   TURETIM. Tavan, o pencerenin KENDI promptundan arta kalan paydir:
       cikis = 7200 - (prompt karakteri / 3.2) - PAY
   Bolme olculdu: 10.553 krk -> tahmin 3.298, Groq'un saydigi 3.248 (%2).
   PAY o sapma icin; taban ve tavan arasinda kirpilir.

   BEKLEME MALIYETI YOK. Pacer kendi hesabinda completion'i 0.6 ile
   carpiyor (PACER_COMPLETION_FACTOR), yani buradaki TAM completion hesabi
   pacer'in zorladigindan daha muhafazakar. Ustelik iki pencere AYRI
   seritlerde kosuyor ve her biri kendi seridinde tek cagri; harcama artsa
   da sonraki cagri yine bir pencere bekliyor.
   ========================================================================== */
const WINDOW_COMPLETION_MIN = 2048
const WINDOW_COMPLETION_MAX = 4096
// Tahminin tutmadigi durum icin pay: olculen sapma %2 (3.298 tahmin /
// 3.248 gercek); 200 token bunun dort katindan fazlasini karsiliyor.
const WINDOW_COMPLETION_MARGIN = 200

function windowCompletionFor(systemPrompt: string, payload: string): number {
  const promptTok = Math.ceil((String(systemPrompt || '').length + String(payload || '').length) / 3.2)
  const kalan = Math.floor(DEFAULT_TPM_LIMIT * PACER_SAFETY) - promptTok - WINDOW_COMPLETION_MARGIN
  return Math.max(WINDOW_COMPLETION_MIN, Math.min(WINDOW_COMPLETION_MAX, kalan))
}

/* TABAN BAGLAYINCA PENCERE COK BUYUK DEMEKTIR. 13.000 karakterlik tek bir
   pencerede prompt tek basina ~5.150 token; uzerine eski duz 3.072 eklenince
   8.221 ediyor ve bu GERCEK 8.000 TPM sinirinin USTUNDE — yani o cagri zaten
   reddedilmeye adaydi. Taban, modelin semayi hic yazamamasindansa dar
   yazmasini secer; dogru cozum pencereyi kucultmektir ve bu satir onu
   gorunur kiliyor. */
function windowCompletionFloored(systemPrompt: string, payload: string): boolean {
  return windowCompletionFor(systemPrompt, payload) === WINDOW_COMPLETION_MIN
}

/* TEK PENCEREDE "DAR" DA TABANDA SAYILIR (30.10.2026 olcumu).
 *
 * windowCompletionFloored tavanin TAM tabanda olmasini istiyor. Olculen iki
 * belge ayni hastaligi tasiyor ama yalnizca biri o esige takiliyordu:
 *
 *   Week3 Chp2   11.154->12.298 krk, 1 pencere, tavan 2048, completion 2256
 *                -> TABANDA, kucultme calisti, kart 2->4 bolum, 8->12 soru
 *   Week 8 Deriv 11.154 krk,        1 pencere, tavan 2256, completion 4581
 *                -> TABANDA DEGIL (208 fark), kucultme CALISMADI, 3 bolum
 *
 * Ikisinde de completion tavanin ~2 KATI. Fark yalnizca promptun uzunlugu:
 * tabana carpma esigi payload >= ~11.800 krk'ta, Week 8 ise 11.154'te.
 *
 * YALNIZCA TEK PENCEREDE gevsetiliyor. Cok pencereli belgede yuk zaten
 * bolunmus durumda ve olculen ornek saglikliydi: "Weeks 4-5 Chp3" 3 pencere,
 * tavan 2097 (daha da dar) ve kart doluydu (21 kavram, 27 madde, 16 soru).
 * Tek pencerede ise butun belge tek cikis butcesi icin yarisiyor ve
 * basvuracak baska yer yok.
 *
 * Esik MARGIN'den turuyor, elle secilmedi: tabanin iki pay kadar ustu. */
function pencereCikisiDar(systemPrompt: string, payload: string, pencereSayisi: number): boolean {
  if (windowCompletionFloored(systemPrompt, payload)) return true
  if (pencereSayisi !== 1) return false
  return windowCompletionFor(systemPrompt, payload) < WINDOW_COMPLETION_MIN + WINDOW_COMPLETION_MARGIN * 2
}

function computeAdaptiveTargets(charCount: number, lengthPreset: string) {
  const presets: Record<string, { summary: [number, number]; terms: [number, number]; points: [number, number]; quiz: [number, number]; capSummary: number; capTerms: number; capPoints: number; capQuiz: number }> = {
    short: { summary: [2, 3], terms: [3, 5], points: [3, 5], quiz: [3, 3], capSummary: 6, capTerms: 12, capPoints: 10, capQuiz: 6 },
    medium: { summary: [4, 8], terms: [5, 10], points: [5, 10], quiz: [4, 6], capSummary: 16, capTerms: 25, capPoints: 22, capQuiz: 12 },
    detailed: { summary: [12, 20], terms: [15, 20], points: [12, 18], quiz: [8, 10], capSummary: 28, capTerms: 40, capPoints: 35, capQuiz: 20 }
  }
  const p = presets[lengthPreset] || presets.medium
  // one "growth unit" per ~4000 extra characters beyond a 6000-char baseline
  // (a baseline-sized document gets exactly the old fixed numbers; only
  // longer-than-that documents scale up, and only up to the per-preset cap)
  const extraUnits = Math.max(0, Math.floor((charCount - 6000) / 4000))
  const grow = (range: [number, number], cap: number, perUnit: number): [number, number] => {
    const lo = Math.min(cap, Math.round(range[0] + extraUnits * perUnit))
    const hi = Math.min(cap, Math.round(range[1] + extraUnits * perUnit))
    return [lo, Math.max(lo, hi)]
  }
  return {
    summarySentences: grow(p.summary, p.capSummary, 1),
    keyTerms: grow(p.terms, p.capTerms, 1),
    keyPoints: grow(p.points, p.capPoints, 1),
    quizQuestions: grow(p.quiz, p.capQuiz, 0.5)
  }
}

function buildLengthInstruction(targets: ReturnType<typeof computeAdaptiveTargets>, lengthPreset: string): string {
  const [sLo, sHi] = targets.summarySentences
  const [tLo, tHi] = targets.keyTerms
  const [pLo, pHi] = targets.keyPoints
  const [qLo, qHi] = targets.quizQuestions
  const scaleNote = (sHi > 8 || tHi > 10 || pHi > 10)
    ? " This document is substantial, so make sure the summary, key terms, key points, and quiz questions genuinely cover its full breadth — not just the first portion of it."
    : ""
  if (lengthPreset === 'short') {
    return `Write a concise summary in ${sLo}-${sHi} sentences. Include only the ${tLo}-${tHi} most essential key terms, ${pLo}-${pHi} key points, and ${qLo}-${qHi} quiz questions.`
  } else if (lengthPreset === 'detailed') {
    return `Write a thorough, in-depth summary (${sLo}-${sHi} sentences). Include ${tLo}-${tHi} key terms, ${pLo}-${pHi} key points, and ${qLo}-${qHi} quiz questions covering the material comprehensively.${scaleNote}`
  }
  return `Write a balanced summary in ${sLo}-${sHi} sentences. Include ${tLo}-${tHi} key terms, ${pLo}-${pHi} key points, and ${qLo}-${qHi} quiz questions.${scaleNote}`
}

function splitIntoChunks(text: string, targetChunkSize: number): string[] {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ""

  for (const para of paragraphs) {
    if (para.length > targetChunkSize * 1.5) {
      if (current) { chunks.push(current); current = "" }
      for (let i = 0; i < para.length; i += targetChunkSize) {
        chunks.push(para.substring(i, i + targetChunkSize))
      }
      continue
    }
    if (current && (current.length + para.length + 2) > targetChunkSize) {
      chunks.push(current)
      current = para
    } else {
      current = current ? current + "\n\n" + para : para
    }
  }
  if (current) chunks.push(current)
  return chunks.length > 0 ? chunks : [text]
}

/**
 * Window builder for the live long-document path.
 *
 * The long-doc loop used to window by raw character offset
 * (`extractedText.slice(start, start + WINDOW)`). Measured against real
 * Turkish prose from this repo, that cut 92% of window boundaries
 * mid-sentence and 67% mid-WORD — each boundary handing the model a
 * fragment like "...provide generat | ive AI functions", which is exactly
 * the kind of garbled input that produces vague key points.
 *
 * splitIntoChunks() above already solves this (paragraph-aware, and
 * "--- SAYFA N ---" markers sit on their own lines so they survive as
 * boundaries), but on its own it can emit a chunk up to 1.5x the target
 * when a single paragraph is oversized — 50% more input tokens per call
 * than the old behaviour, which this account's tokens-per-minute cap
 * cannot absorb. So the paragraph-aware split is followed by a hard cap at
 * `maxChars`, guaranteeing per-window token cost never exceeds what the
 * char-offset version already spent.
 */
function kurPencereler(text: string, hedefChars: number): string[] {
  const out: string[] = []
  for (const chunk of splitIntoChunks(text, hedefChars)) {
    if (chunk.length <= hedefChars) { out.push(chunk); continue }
    for (let i = 0; i < chunk.length; i += hedefChars) out.push(chunk.slice(i, i + hedefChars))
  }
  return out
}

/* ===========================================================================
   PENCERELER DENGELENIR
   ===========================================================================
   08.10.2026, canli ekonometri destesinde olculdu. 13.980 karakter acgozlu
   doldurma ile soyle bolunuyordu:

     pencere 1: 12.192 krk     pencere 2: 2.437 krk

   Ve ikinci pencere su sonucu verdi: terms=0 points=0 quiz=0. Destenin son
   dort slaydi oradaydi (39-42) ve TAM OLARAK ampirik ornekler orada
   yasiyor: "Avrupa'da kisi basi enerji tuketimi %9.3 daha dusuk",
   "K. Amerika %41.5 daha yuksek", log-log icin "%1 artis -> %0.69". Yani
   sinavda sorulacak sayilarin tamami kayboldu — ustelik deste modu
   oncesindeki ozette bunlarin ucu sinav sorusu olarak VARDI, yani bu bir
   geri gidisti.

   Minik bir pencere iki kez kotu: modele neredeyse hic baglam vermez ve
   yine de tam bir cagri (ve pacer beklemesi) harcar.

   PENCERE SAYISI DEGISMIYOR, yalnizca boyutlari esitleniyor — yani bu
   dosyadaki TokenPacer yorumlarinin uyardigi "her ek pencere ~60 sn
   bekleme" maliyeti DOGMUYOR. Ayni iki cagri, bu kez 7.316'sar karakterle.

   Once kaba bolme ile kac pencere gerektigi bulunur; sonra metin hedef
   boyutta KUCUK PARCALARA ayrilip tam o kadar kovaya dagitilir. Ilk
   denemede "hedef boyutta yeniden bol, fazla cikarsa vazgec" yapmistim ve
   hic devreye girmedi: paragraf duyarli bolme hedefte 3 parca uretiyor,
   koruma da 2'ye geri donuyordu. Parcalari saymak degil DAGITMAK gerekiyor.
   =========================================================================== */
function splitIntoWindows(text: string, maxChars: number, maxWindows: number): string[] {
  const kaba = kurPencereler(text, maxChars)
  const n = Math.min(kaba.length, maxWindows)
  if (n <= 1) return kaba.slice(0, maxWindows)

  const hedef = Math.ceil(text.length / n)
  const parcalar = kurPencereler(text, hedef)

  const kovalar: string[] = []
  let simdiki = ''
  for (const p of parcalar) {
    const sonKova = kovalar.length >= n - 1
    if (simdiki && !sonKova && (simdiki.length + p.length + 2) > hedef) {
      kovalar.push(simdiki)
      simdiki = p
    } else {
      simdiki = simdiki ? `${simdiki}\n\n${p}` : p
    }
  }
  if (simdiki) kovalar.push(simdiki)

  // Guvenlik: hicbir kova maxChars'i asmamali (pencere butcesi oradan
  // hesaplaniyor). Asarsa dengelemeden vazgecilir.
  if (kovalar.some(k => k.length > maxChars)) return kaba.slice(0, maxWindows)
  return kovalar.slice(0, maxWindows)
}

type GroqJsonOpts = {
  model?: string
  temperature?: number
  maxCompletionTokens?: number
  timeoutMs?: number
  maxRetries?: number
  /** Verilirse cagrinin gercek token harcamasi loglanir (bkz. callGroqJson). */
  usageLabel?: string
}

// ==========================================================================
// TOKEN PACER — stop hitting the rate limit instead of recovering from it
//
// Live evidence (2026-10-04, 30-page chapter, two identical runs):
//
//   run A: both windows succeeded      -> 26 terms, 19 key points
//   run B: window 1 lost all 3 retries -> 14 terms,  8 key points
//
// Same document, same settings, half the output. Every failure was:
//
//   Rate limit reached ... tokens per minute (TPM): Limit 8000,
//   Used 7362, Requested 3873. Please try again in 24.26s
//
// The cause is that windows were fired CHUNK_CONCURRENCY-at-a-time with no
// idea of what the budget could absorb. At ~5,000 tokens a call against an
// 8,000 TPM ceiling, two simultaneous calls cannot both fit — so they knock
// each other out, and whether a student gets the good summary or the thin
// one is decided by a race.
//
// Retrying harder cannot fix that: when the per-minute window is already
// spent, every retry is just another 429, and the window loop's own budget
// then runs out before the remaining windows are ever tried.
//
// So this paces requests against a rolling 60-second token budget: a call
// waits until its estimated cost fits, and actual usage is recorded from
// the response afterwards. The real ceiling is read from Groq's own
// x-ratelimit-limit-tokens header, so an account upgrade raises throughput
// automatically with no code change.
// ==========================================================================
const PACER_SAFETY = 0.9             // headroom; actual usage is recorded, so this can be tight
const PACER_WINDOW_MS = 60_000
// MUST exceed PACER_WINDOW_MS. The first live run capped this at 55s and the
// logs showed exactly why that is wrong:
//
//   TokenPacer: 55000ms bekliyor (used=4600/6800, est=4378)
//   TokenPacer: 55000ms bekledi, yine de gonderiyor (used=4600, est=4378)
//
// `used` is unchanged after the wait, because an entry that was fresh when
// the wait began is only 55 seconds old at the end of it — still inside the
// 60-second window, so nothing aged out. The wait could not possibly have
// helped, and the call went out anyway: 55 seconds spent to arrive at the
// same place. Five of those is most of the two minutes that run took.
//
// A ceiling below the window length makes every long wait futile by
// construction, so this now sits just past it: a wait that is needed is a
// wait that completes.
const PACER_MAX_WAIT_MS = 65_000
// maxCompletionTokens is a CEILING, not a prediction — a window call asking
// for up to 3072 completion tokens typically spends far less. Charging the
// full ceiling up front made the pacer see a shortage that was not there and
// wait for room it did not need; the proof is that every "yine de
// gonderiyor" call then succeeded without a single 429. Actual usage is
// still recorded from the response, so this only affects the pre-flight
// estimate.
const PACER_COMPLETION_FACTOR = 0.6
const DEFAULT_TPM_LIMIT = 8000       // observed on this account until a header says otherwise

/**
 * A single model's rolling-window budget. Groq meters tokens-per-minute
 * PER MODEL, so each model gets its own 8,000 and its own spend history.
 */
type PacerLane = {
  limit: number
  limitKnown: boolean
  spent: Array<{ at: number; tokens: number }>
  /** Rolling OUTPUT-token spend; see MODEL_OTPM. */
  outSpent: Array<{ at: number; tokens: number }>
}

// OUTPUT tokens per minute — a SEPARATE Groq bucket from TPM, discovered the
// hard way on 04.10.2026:
//
//   Request too large for model `qwen/qwen3.8-27b` ... on output tokens per
//   minute (OTPM): Limit 1000, Requested 1311
//
// Confirmed against console.groq.com/docs/rate-limits: "some organizations
// are also subject to separate per-minute limits on input tokens (ITPM) and
// output tokens (OTPM)", and OTPM "caps how many completion tokens your
// organization can generate per minute, regardless of how many input tokens
// are sent".
//
// The pacer modelled TPM only, so it happily cleared a review call asking for
// 2,500 completion tokens against a 1,000 ceiling. Every tier 429'd, and
// because each retry then waited out a full TPM window, the run spent 81s in
// the tier loop and was killed by the 150s Edge wall clock mid-review —
// leaving the document stuck on "reviewing" forever.
//
// Only models actually observed to have a split limit are listed; a model
// absent here is paced on TPM alone, as before.
const MODEL_OTPM: Record<string, number> = {
  "qwen/qwen3.8-27b": 1000
}
// Leave room for the model overshooting its own completion estimate — Groq
// rejected a 2,500-token ask as "Requested 1311", so its accounting is not
// simply max_completion_tokens and a request sized exactly at the limit is
// not safe.
const OTPM_SAFETY = 0.85

// WHY THIS IS KEYED BY MODEL (2026-10-04):
// The pacer used to hold one `spent[]` and one `limit` for the whole
// function. That silently cancelled the one optimisation the pipeline was
// built around. Groq bills TPM separately for each model, which is the
// entire reason the review/critic passes run on MODEL_FAST while the draft
// runs on MODEL_HEAVY — two models, two 8,000s, no queueing. With a shared
// ledger the review call was charged the draft's spend as well, so it sat
// through a ~60s wait for room it already had. (It never actually got that
// far, because the MODEL_FAST id was dead and every call 404'd; fixing the
// id without also splitting this would have traded a 404 for a stall.)
//
// Per-lane limits also make the Groq header more useful than before: the
// ceiling it reports belongs to the model that was just called, so a
// preview-tier model with a different TPM no longer overwrites the
// production model's known limit.
const tokenPacer = {
  lanes: Object.create(null) as Record<string, PacerLane>,

  /** The budget for one model, created on first use. */
  lane(model: string): PacerLane {
    const key = model || MODEL_HEAVY
    let lane = this.lanes[key]
    if (!lane) {
      lane = { limit: DEFAULT_TPM_LIMIT, limitKnown: false, spent: [], outSpent: [] }
      this.lanes[key] = lane
    }
    return lane
  },

  /**
   * The largest completion this model will accept, or null when it has no
   * known output cap. Asking for more than this is not a slow request, it is
   * a rejected one, so callers clamp rather than wait.
   */
  maxCompletion(model: string): number | null {
    const otpm = MODEL_OTPM[model || MODEL_HEAVY]
    return otpm ? Math.floor(otpm * OTPM_SAFETY) : null
  },

  /** Clamp a requested completion budget to what this model can actually emit. */
  clampCompletion(model: string, requested: number): number {
    // Gemini paralel modunda OTPM tavani Groq'a ait, Gemini'yi baglamaz.
    if (geminiParallelActive()) return requested
    const cap = this.maxCompletion(model)
    if (cap === null || !(requested > cap)) return requested
    console.log(`TokenPacer[${model}]: max_completion ${requested} -> ${cap} (OTPM tavani)`)
    return cap
  },

  /** Rolling OUTPUT-token spend inside the window. */
  usedOut(now: number, model: string): number {
    const lane = this.lane(model)
    lane.outSpent = lane.outSpent.filter(e => now - e.at < PACER_WINDOW_MS)
    return lane.outSpent.reduce((n, e) => n + e.tokens, 0)
  },

  /** Drop entries older than the rolling window and total what's left. */
  used(now: number, model: string): number {
    const lane = this.lane(model)
    lane.spent = lane.spent.filter(e => now - e.at < PACER_WINDOW_MS)
    return lane.spent.reduce((n, e) => n + e.tokens, 0)
  },

  /** Groq reports the real ceiling on every response; believe it over our default. */
  observeHeaders(headers: Headers, model: string) {
    const lane = this.lane(model)
    const raw = headers.get('x-ratelimit-limit-tokens')
    const n = raw ? parseInt(raw, 10) : NaN
    if (Number.isFinite(n) && n > 0 && n !== lane.limit) {
      console.log(`TokenPacer[${model}]: TPM limit ${lane.limit} -> ${n} (Groq header)`)
      lane.limit = n
      lane.limitKnown = true
    } else if (Number.isFinite(n)) {
      lane.limitKnown = true
    }
  },

  record(tokens: number, model: string, completionTokens = 0) {
    const lane = this.lane(model)
    if (Number.isFinite(tokens) && tokens > 0) {
      lane.spent.push({ at: Date.now(), tokens })
    }
    if (Number.isFinite(completionTokens) && completionTokens > 0) {
      lane.outSpent.push({ at: Date.now(), tokens: completionTokens })
    }
  },

  /** How many calls of this size can safely be in flight at once. */
  safeConcurrency(estTokensPerCall: number, model: string): number {
    if (!(estTokensPerCall > 0)) return 1
    return Math.max(1, Math.floor((this.lane(model).limit * PACER_SAFETY) / estTokensPerCall))
  },

  /**
   * How long acquire() would block for this call RIGHT NOW, in ms, without
   * blocking. Mirrors acquire's loop: entries age out oldest-first, and the
   * answer is when enough of them have expired for the call to fit.
   *
   * This exists so a stage can ask "would running me actually cost time?"
   * instead of assuming the worst. The review gate used to assume a flat
   * 55s — correct back when one shared ledger meant any call could eat a
   * full window, but now that lanes are per model the pacer can simply say.
   */
  waitEstimate(estTokens: number, model: string, estCompletion = 0): number {
    if (geminiParallelActive()) return 0
    return Math.max(
      this.waitFor(this.lane(model).spent, this.lane(model).limit * PACER_SAFETY, estTokens, model, false),
      this.waitFor(this.lane(model).outSpent, this.maxCompletion(model) ?? Infinity, estCompletion, model, true)
    )
  },

  /** Shared ledger walk for both the total and output budgets. */
  waitFor(
    ledger: Array<{ at: number; tokens: number }>,
    budget: number,
    est: number,
    _model: string,
    _isOut: boolean
  ): number {
    if (!(est > 0) || !Number.isFinite(budget)) return 0
    const now = Date.now()
    let used = ledger.filter(e => now - e.at < PACER_WINDOW_MS).reduce((n, e) => n + e.tokens, 0)
    if (used + est <= budget || used === 0) return 0
    let wait = 0
    for (const e of ledger) {
      if (now - e.at >= PACER_WINDOW_MS) continue
      used -= e.tokens
      wait = PACER_WINDOW_MS - (now - e.at) + 250
      if (used + est <= budget || used <= 0) break
    }
    return Math.max(0, Math.min(PACER_MAX_WAIT_MS, wait))
  },

  /** Block until this call's estimated cost fits in that model's rolling budget. */
  async acquire(estTokens: number, model: string, estCompletion = 0): Promise<void> {
    // Gemini paralel modunda cagrilar Groq'a gitmiyor (bkz. groqViaGemini);
    // 8.000 TPM defterine gore beklemek, paralelligin tamamini geri alirdi.
    if (geminiParallelActive()) return
    const lane = this.lane(model)
    const budget = lane.limit * PACER_SAFETY
    const outBudget = this.maxCompletion(model)
    const started = Date.now()
    while (true) {
      const now = Date.now()
      const used = this.used(now, model)
      const usedOut = outBudget === null ? 0 : this.usedOut(now, model)
      const totalFits = used + estTokens <= budget || used === 0
      const outFits = outBudget === null || estCompletion <= 0 ||
        usedOut + estCompletion <= outBudget || usedOut === 0
      if (totalFits && outFits) return
      if (totalFits && !outFits) {
        // The output bucket is the binding one. Wait for the oldest completion
        // to age out rather than the oldest total.
        const oldestOut = lane.outSpent[0]
        const needOut = oldestOut
          ? Math.max(250, PACER_WINDOW_MS - (now - oldestOut.at) + 250)
          : 0
        const remainingOut = PACER_MAX_WAIT_MS - (now - started)
        if (!oldestOut || needOut > remainingOut) {
          console.warn(
            `TokenPacer[${model}]: OTPM icin ${Math.round(needOut)}ms gerekiyor ama ` +
            `${Math.round(Math.max(0, remainingOut))}ms kaldi — beklemeden gonderiyor ` +
            `(usedOut=${usedOut}/${outBudget}, est=${estCompletion})`
          )
          return
        }
        console.log(
          `TokenPacer[${model}]: OTPM icin ${Math.round(needOut)}ms bekliyor ` +
          `(usedOut=${usedOut}/${outBudget}, est=${estCompletion})`
        )
        await new Promise(r => setTimeout(r, needOut))
        continue
      }
      // Wait for the oldest recorded spend to age out of the window.
      const oldest = lane.spent[0]
      const needed = Math.max(250, PACER_WINDOW_MS - (now - oldest.at) + 250)
      const remaining = PACER_MAX_WAIT_MS - (now - started)
      // Never wait a length that cannot clear anything: if the time actually
      // required exceeds what we are willing to spend, waiting part of it
      // buys nothing and the call goes out either way. Send now and let the
      // 429 path (which honours Groq's own retry-after) handle it.
      if (needed > remaining) {
        console.warn(
          `TokenPacer[${model}]: ${Math.round(needed)}ms gerekiyor ama ${Math.round(Math.max(0, remaining))}ms kaldi — ` +
          `beklemeden gonderiyor (used=${used}, est=${estTokens})`
        )
        return
      }
      const waitMs = needed
      console.log(
        `TokenPacer[${model}]: ${Math.round(waitMs)}ms bekliyor ` +
        `(used=${used}/${Math.round(budget)}, est=${estTokens})`
      )
      await new Promise(r => setTimeout(r, waitMs))
    }
  }
}

/**
 * Pre-flight token estimate. Input is counted in full (we know its length);
 * the completion budget is counted at PACER_COMPLETION_FACTOR because it is
 * a ceiling the model rarely reaches — see that constant for the evidence.
 */
function estimateTokens(systemPrompt: string, userContent: string, maxCompletion: number): number {
  return Math.ceil((systemPrompt.length + userContent.length) / 3.2)
    + Math.ceil(maxCompletion * PACER_COMPLETION_FACTOR)
}

/* ===========================================================================
   REDDEDILEN URETIMI KURTARMA — json_validate_failed (09.10.2026)

   OLCULEN OLAY. Denklem sayfalari duzgun okunmaya baslayinca 1. pencere
   (1-19. slaytlar: kukla degiskenler, etkilesim) ARTIK ICINDE FORMUL OLAN
   bir metin gordu ve iki denemede de 400 json_validate_failed aldi. Ozetin
   yarisi — pasta satisi, ev fiyati, etkilesim denklemi — karta hic girmedi.
   Ikinci deneme ayrica 60 sn pacer beklemesi yedi ve anlati yazarinin
   butcesini bitirdi; ozet tek kisa paragraf kaldi. Yani bir JSON kacis
   karakteri yuzunden ozetin yarisi ve bicimi gitti.

   NEDEN OLUYOR. response_format json_object: Groq modelin ciktisini KENDI
   ayristirip gecersizse 400 donuyor. LaTeX ise JSON kacis kurallariyla
   dogrudan carpisiyor — \sum, \hat, \partial, \alpha, \varepsilon, \(
   hicbiri gecerli JSON kacisi degil. Model "EVERY equation" istendikce
   bunlari daha cok yaziyor, yani cikarim iyilestikce basarisizlik
   OLASILIGI ARTIYOR.

   NEDEN YENIDEN DENEME COZUM DEGIL. Ayni prompt ayni metinle ayni kacisi
   yaziyor; olculdu, ikinci deneme de basarisiz. Ustelik 8.000 TPM'de her
   deneme ~60 sn bekleme demek.

   KURTARMA. Groq reddettigi metni hata govdesinde failed_generation olarak
   GERI VERIYOR. Bu projede zaten tam bu bozulmayi onaran bir fonksiyon var
   (repairLatexEscapes). Reddedilen uretimi onarip ayristiriyoruz: ek cagri
   yok, ek token yok, ek bekleme yok. Onarim tutmazsa eski davranis (hata)
   aynen devam eder.
   =========================================================================== */
function salvageFailedGeneration(data: any): any | null {
  const err = data?.error ?? data
  if (String(err?.code || '') !== 'json_validate_failed') return null
  const ham = err?.failed_generation ?? err?.failedGeneration ?? err?.generation
  if (typeof ham !== 'string' || ham.trim().length < 2) return null
  const temiz = (stripThinkBlock(ham) ?? ham).replace(/```json\s*|```/g, '').trim()
  try {
    const onarilmis = JSON.parse(repairLatexEscapes(temiz))
    if (onarilmis && typeof onarilmis === 'object') return onarilmis
  } catch { /* onarim yetmedi, ham haliyle dene */ }
  try {
    const hamParsed = JSON.parse(temiz)
    if (hamParsed && typeof hamParsed === 'object') return hamParsed
  } catch { /* kurtarilamadi */ }
  return null
}

async function callGroqJson(
  groqApiKey: string,
  systemPrompt: string,
  userContent: string,
  temperatureOrOpts: number | GroqJsonOpts = 0.3
): Promise<any> {
  const opts: GroqJsonOpts = typeof temperatureOrOpts === 'number'
    ? { temperature: temperatureOrOpts }
    : (temperatureOrOpts || {})
  const model = opts.model || MODEL_HEAVY
  const temperature = opts.temperature ?? 0.3
  // Clamp before anything else: a request whose max_completion_tokens alone
  // exceeds the model's OTPM ceiling is rejected outright, not queued.
  const maxCompletionTokens = tokenPacer.clampCompletion(
    model,
    opts.maxCompletionTokens ?? DRAFT_MAX_COMPLETION
  )
  const timeoutMs = opts.timeoutMs ?? 25000
  const maxRetries = opts.maxRetries ?? 1

  const body: Record<string, unknown> = {
    model,
    temperature,
    max_completion_tokens: maxCompletionTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ]
  }
  // Reasoning controls, derived from the model id — see reasoningParamsFor.
  Object.assign(body, reasoningParamsFor(model))

  // Wait until this call fits the rolling per-minute budget, rather than
  // firing it and letting Groq reject it (see the TokenPacer comment above).
  const estTokens = estimateTokens(systemPrompt, userContent, maxCompletionTokens)
  await tokenPacer.acquire(estTokens, model, maxCompletionTokens)

  const response = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }, maxRetries, timeoutMs)

  tokenPacer.observeHeaders(response.headers, model)

  const data = await response.json()
  if (!response.ok) {
    // A rejected call still consumed budget in Groq's accounting, so record
    // the estimate — otherwise the pacer would under-count after a 429 and
    // immediately fire again into the same wall.
    tokenPacer.record(estTokens, model, maxCompletionTokens)
    // json_validate_failed: KURTARILABILIR (bkz. salvageFailedGeneration).
    const kurtarilan = salvageFailedGeneration(data)
    if (kurtarilan !== null) {
      console.warn(
        `${opts.usageLabel || 'Groq'}: json_validate_failed — reddedilen uretim ` +
        `onarildi (${JSON.stringify(kurtarilan).length} krk), yeniden cagri yok`
      )
      return kurtarilan
    }
    throw new Error(`Groq API error (${response.status}): ${JSON.stringify(data)}`)
  }
  tokenPacer.record(
    Number(data?.usage?.total_tokens) ||
    (Number(data?.usage?.prompt_tokens) || 0) + (Number(data?.usage?.completion_tokens) || 0) ||
    estTokens,
    model,
    Number(data?.usage?.completion_tokens) || maxCompletionTokens
  )
  // Pencere cagrilari 3.072 completion tokenla sinirli ve prompt her alandan
  // daha fazlasini istedikce bu sinirin ne kadar dolu oldugu karar verdiriyor.
  // Bilinen tek olcum ("~1.400 harcandi") bir kosudan; artik her kosuda.
  if (opts.usageLabel && data?.usage) {
    const u = data.usage
    const r = Number(u?.completion_tokens_details?.reasoning_tokens)
    console.log(
      `${opts.usageLabel} token: prompt=${u.prompt_tokens ?? '?'} completion=${u.completion_tokens ?? '?'}` +
      `${Number.isFinite(r) ? ` (reasoning=${r})` : ''} / max=${maxCompletionTokens}` +
      `${data?.choices?.[0]?.finish_reason === 'length' ? ' — SINIRA DAYANDI' : ''}`
    )
  }
  const raw = data.choices?.[0]?.message?.content ?? ""
  if (!raw) throw new Error("Empty Groq response content")
  const stripped = stripThinkBlock(raw)
  if (stripped === null) throw new Error("Model ran out of tokens mid-<think> block, never wrote the actual answer")
  const cleaned = stripped.replace(/```json\s*|```/g, "").trim()
  // LaTeX ters bolulerini onar (bkz. repairLatexEscapes) — ayristirmadan
  // once yapilmali, bilgi parse aninda kayboluyor.
  try {
    return JSON.parse(repairLatexEscapes(cleaned))
  } catch (ayristirmaHatasi) {
    /* KESIK JSON KURTARILIR (30.10.2026 olcumu).
     *
     * "Computer Network Security" kosusunda ikinci pencerenin JSON'u bozuk
     * geldi:
     *   Window 2 token: prompt=3587 completion=2036 / max=2119
     *   Window 2 attempt 1 failed: Expected double-quoted property name in
     *     JSON at position 6276 (line 109 column 7)
     *   EKSIK BELGE: 1/2 pencere dustu [2] — 11957 karakter (belgenin %54'i)
     *     karta hic girmedi
     * 55 sayfalik belgenin YARISI karta hic girmedi; kart 2 bolum, 10
     * kavram, 7 soruda kaldi.
     *
     * SEBEP TAVAN DEGIL (30.10.2026'da duzeltildi). Ilk teshisim "cikis
     * tavanina dayandi" demisti ama log aksini soyluyor: pencere yolu
     * usageLabel geciyor, yani finish_reason='length' olsaydi ayni satira
     * " — SINIRA DAYANDI" eklenirdi. Eklenmemis. Yani model normal
     * bitirdigini bildirdi ve YINE DE bozuk JSON yazdi — kesilme degil,
     * stokastik bozuk uretim. Zaten json_validate_failed yorumunun
     * soyledigi sinif bu.
     *
     * Bu, kurtarmayi gereksiz kilmiyor: kapatma islemi tamamlanmis onEKI
     * her halde kurtariyor, ve asil emniyet kemeri yeniden deneme.
     * AYNI BELGE 24 dakika sonra yeniden ozetlendi ve ayni pencere bu kez
     * 1716 token ile GECERLI JSON yazdi (4 bolum, 22 kavram, 9 soru).
     * Yani hata run-to-run degisiyor; kurtarma+yeniden deneme sigorta.
     *
     * Iki ayri bosluk vardi:
     *  1) Bu hata Groq'un `json_validate_failed`'i DEGIL, bizim
     *     JSON.parse'imizin attigi SyntaxError. extractWindow'daki yeniden
     *     deneme kosullari (413 / 429 / json_validate_failed) hicbiri
     *     eslesmiyor, o yuzden pencere TEK denemede dusuyordu.
     *  2) closeTruncatedJson tam bu is icin yazilmis ama yalnizca Gemini
     *     akis yolunda kullaniliyordu; callGroqJson onu hic cagirmiyordu.
     *
     * Kurtarma BEDAVA: ek model cagrisi yok, yalnizca kesik yapi kapatilip
     * yeniden ayristiriliyor. Tutmazsa ozgun hata aynen firlatiliyor, yani
     * yukarideki yeniden deneme mantigi degismiyor. */
    const kapali = closeTruncatedJson(cleaned)
    if (kapali) {
      try {
        const kurtarilan = JSON.parse(repairLatexEscapes(kapali))
        console.warn(
          `${opts.usageLabel || 'Groq'}: JSON KESIKTI, kapatilip kurtarildi ` +
          `(${cleaned.length} krk -> ${kapali.length} krk) — ` +
          `${String((ayristirmaHatasi as any)?.message || '').slice(0, 90)}`
        )
        return kurtarilan
      } catch (_kurtarmaHatasi) { /* kurtarma da tutmadi: ozgun hataya dus */ }
    }
    throw ayristirmaHatasi
  }
}

// Upload local file bytes to PDF.co via its presigned-URL flow (Denetim
// Raporu, 2026-08-31 — LIVE TEST FINDING). PDF.co's convert endpoints only
// accept a `url` pointing to an already-hosted file; they do NOT accept a
// direct multipart file body. Confirmed via a real 400 in production logs:
// "Long-doc PDF.co response status failed: 400" — the code below this
// comment (and, it turns out, the ORIGINAL fast-path PDF visual-analysis
// block further down, which used the exact same multipart pattern) was
// sending the file the wrong way. Both call sites now go through this one
// upload helper instead. Flow, per PDF.co's docs (developer.pdf.co/api/
// file-upload/generate-presigned-url): GET a presigned URL, PUT the raw
// bytes to it, then use the returned `url` field in the actual conversion
// call. Returns null on any failure.
async function uploadFileToPdfCo(fileBytes: Uint8Array, apiKey: string, filename: string): Promise<string | null> {
  try {
    const presignRes = await fetch(
      `https://api.pdf.co/v1/file/upload/get-presigned-url?name=${encodeURIComponent(filename)}`,
      { headers: { 'x-api-key': apiKey } }
    )
    if (!presignRes.ok) {
      console.warn(`PDF.co presigned-URL request failed: ${presignRes.status}`)
      return null
    }
    const presignData = await presignRes.json()
    if (presignData.error || !presignData.presignedUrl || !presignData.url) {
      console.warn('PDF.co presigned-URL response missing fields:', presignData)
      return null
    }
    const putRes = await fetch(presignData.presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: fileBytes
    })
    if (!putRes.ok) {
      console.warn(`PDF.co presigned upload PUT failed: ${putRes.status}`)
      return null
    }
    return presignData.url as string
  } catch (err) {
    console.error('PDF.co presigned upload flow failed:', err)
    return null
  }
}

// Convert SPECIFIC pages of a PDF to images via PDF.co (Denetim Raporu,
// 2026-08-31). The existing fast-path visual analysis below always asks for
// pages "0-7" — fine for a short document, but on a long slide deck the
// pages worth looking at visually are wherever the text extraction came back
// near-empty, which can be anywhere in the document (on our real test case,
// page 51 of 52). This is a separate, additive function so the working
// fast-path code above is untouched; it is only used by the chunked/long-doc
// path's visual-analysis patch further down, and only when that path has
// already identified which pages are worth converting.
// ==========================================================================
// WHICH PAGES GO TO THE VISION MODEL
//
// The old selector was `pageText.length < 150` — "a page with almost no text
// must be an image page". Measured on a 30-page lecture deck it picked pages
// 1 and 3, which are the publisher's two COVER SLIDES, and none of the eight
// pages that actually carry a figure. The deck's six figures each come with a
// caption of 200-800 characters, so they never looked blank.
//
// The caption itself is the reliable signal. On that same deck a header match
// scores 8/8 with no false positives: six "FIGURE 20.x" pages plus the two
// "ECONOMICS IN PRACTICE" feature pages, and the phrase appears nowhere else
// in the document.
//
// The near-blank list stays as the fallback for documents whose figures carry
// no caption at all (a scanned handout, an image-only deck) — there the old
// heuristic is the only signal available, and it is right for exactly that
// case.
// The Turkish spellings need explicit character classes for their i's. A
// case-insensitive regex cannot match "Şekil" against "ŞEKİL": İ (U+0130)
// lowercases to i + COMBINING DOT ABOVE, not to plain i, so /ŞEKİL/i silently
// fails on the ordinary capitalised form a caption actually uses. Same trap
// for GRAFİK and ÇİZELGE. Written this way all four of Şekil/ŞEKİL/Sekil/
// ŞEKIL match.
const FIGURE_CAPTION_RE =
  /^[ \t]*(FIGURE|TABLE|EXHIBIT|CHART|PLATE|Ş[EĖ]K[İIi]L|SEK[İIi]L|TABLO|GRAF[İIi]K|[ÇC][İIi]ZELGE)\b/im

/* Metin bir veri nesnesini OKUYOR ama nesne metinde yok. Kaliplar olculen
   slaytlardan: "interpreted as", "this slope coefficient", "the dummy
   variables for", "statistically significant/insignificant/different". */
const DANGLING_DATA_RE = new RegExp([
  '\\b(?:is|are)\\s+interpreted\\s+as\\b',
  '\\bthis\\s+(?:slope\\s+)?coefficient\\b',
  '\\bthe\\s+dummy\\s+variables?\\s+for\\b',
  '\\bstatistically\\s+(?:significant|insignificant|different)\\b',
  '\\bscatter\\s*plots?\\s+(?:shows?|of)\\b',
  '\\b(?:shown|reported|summari[sz]ed)\\s+(?:in|below|above)\\b',
  // Turkce ders materyali
  'istatistiksel\\s+olarak\\s+anlaml',
  'katsay[\u0131i]s[\u0131i]\\s+\\S{0,20}\\s*yorumlan'
].join('|'), 'i')
/* Yogun bir duz yazi sayfasi da "statistically significant" diyebilir; orada
   bakilacak bir resim yoktur. Olculen hedef sayfalar 215-592 karakter. */
const DANGLING_MAX_CHARS = 900

/* ATIF TEK BASINA YETMIYOR: sayfa BU BELGENIN VERISINDEN soz etmeli.
   Ilk olcumde yalnizca atif kuralı 4. ve 37. slaytlari da secti — ikisi de
   kural anlatan teori slaytlari ("Regression intercepts are different if the
   variable is statistically significant", "β1 is interpreted as β1·100%").
   Orada okunacak bir cikti yok, ve iki yuvadan birini yiyorlardi. */
const EMPIRICAL_ANCHOR_RE = new RegExp([
  '\\bdependent variable\\b', '\\bexcel\\b', '\\bscatter\\s*plot',
  '\\bsummary output\\b', '\\bR square\\b', '\\bobservations\\b',
  '\\bregression is as follows\\b', '\\bis fit\\b', '\\bthe estimated\\b',
  '\\bomitted group\\b',
  'ba[\u011fg][\u0131i]ml[\u0131i]\\s+de[\u011fg]i[\u015fs]ken', 'g[\u00f6o]zlem say[\u0131i]s[\u0131i]'
].join('|'), 'i')
/* Genel model tanimi yapan sayfa ampirik degildir, kalipları tutsa bile. */
const MODEL_DEFINITION_RE =
  /\bpopulation regression\b|\bgeneral form\b|\bis specified as\b|\bpopulasyon regresyon\b/i

function selectVisualPages(
  pdfPageTexts: string[],
  nearBlankIndices: number[],
  maxPages: number
): { indices: number[]; reason: string } {
  const captioned: Array<{ i: number; len: number }> = []
  for (let i = 0; i < pdfPageTexts.length; i++) {
    const t = pdfPageTexts[i] || ''
    if (FIGURE_CAPTION_RE.test(t)) captioned.push({ i, len: t.trim().length })
  }
  if (captioned.length > 0) {
    // Only VISION_MAX_IMAGES of them can go, so which ones matter. Taking the
    // first N means a long document only ever shows its opening figures, and
    // those are not the valuable ones.
    //
    // The ranking signal is the caption's own length: a figure whose caption
    // already explains it in prose has little left for the vision model to
    // add, while a chart with a one-line caption keeps everything — the axis
    // ranges, the levels, the turning points — inside the image. Measured on
    // the reference deck, shortest-caption-first puts Figure 20.2 (GDP
    // 1900-2014, 200 chars) and Figure 20.5 (unemployment, 222) at the top
    // and the circular-flow diagram (788 chars, fully described in words)
    // last, which is the right order.
    const ranked = [...captioned].sort((a, b) => a.len - b.len || a.i - b.i)
    const picked = ranked.slice(0, maxPages).map(p => p.i).sort((a, b) => a - b)
    return {
      indices: picked,
      reason: `sekil basligi (${captioned.length} aday, en kisa altyaziliar secildi)`
    }
  }
  /* IKINCI KATMAN: VERIYE ATIF EDEN AMA VERIYI TASIMAYAN SAYFA.
     (09.10.2026)

     Olculen durum: ekonometri destesinde FIGURE_CAPTION_RE hic tutmuyor
     (slaytlarda "Figure 20.3" gibi bir altyazi yok) ve is dogrudan bos-sayfa
     yedegine kaliyordu. O yedek 3. ve 17. sayfayi seciyor: 3 bir bolum
     ayraci, 17'nin tablosu ise zaten metindeki denklemden turetilebiliyor
     (18.30 + 22.44 = 40.74). Bu arada yedi Excel regresyon ciktisinin
     hicbiri okunmuyor; referans ozete gore eksik kalan bes maddenin hepsi
     orada (R² 0.124 / 0.92 / 0.50 / 0.68 ve p degerleri).

     Bu sayfalarin ortak isareti su: METIN BIR VERI NESNESINE ATIF EDIYOR
     ama nesnenin kendisi metinde yok — "This slope coefficient is
     interpreted as...", "The dummy variables for Europe and N. America are
     not statistically different...". Yani cumle bir tabloyu okuyor, tablo
     ise resimde.

     SIRALAMA: sayfanin KENDI metnindeki ayirt edici sayi sayisi, artan.
     Gerekce, altyazi katmanindakiyle ayni: metninde sayi olan sayfanin
     tablosu buyuk olcude turetilebilir, hic sayi tasimayaninki tamamen
     kayiptir. Ayni destede bu siralama 27. (dogrusal uyum: metninde tek
     sayi yok, tablosunda R²=0.124 ve p=0.261) ve 41. sayfayi (log-log,
     R²=0.682) secer — ikisi de referansta eksik isaretlenmis maddeler.

     UZUNLUK SINIRI: yogun bir duz yazi sayfasi "statistically significant"
     dediginde bu katman tutmamali; o sayfada bakilacak bir resim yok. */
  const dangling: Array<{ i: number; n: number }> = []
  for (let i = 0; i < pdfPageTexts.length; i++) {
    const t = (pdfPageTexts[i] || '').trim()
    if (!t || t.length > DANGLING_MAX_CHARS) continue
    if (!DANGLING_DATA_RE.test(t)) continue
    if (!EMPIRICAL_ANCHOR_RE.test(t) || MODEL_DEFINITION_RE.test(t)) continue
    dangling.push({ i, n: distinctiveNumbers(t).length })
  }
  if (dangling.length > 0) {
    const ranked = [...dangling].sort((a, b) => a.n - b.n || a.i - b.i)
    const picked = ranked.slice(0, maxPages).map(p => p.i).sort((a, b) => a - b)
    return {
      indices: picked,
      reason: `veri referansi (${dangling.length} aday, metninde en az sayi olanlar secildi)`
    }
  }

  return {
    indices: nearBlankIndices.slice(0, maxPages),
    reason: `sekil basligi yok, bos sayfa yedegi (${nearBlankIndices.length} aday)`
  }
}

async function extractVisualImagesForLongDoc(
  fileBytes: Uint8Array,
  pageIndices: number[] // 0-indexed page numbers to convert
): Promise<string[]> {
  const pdfcoApiKey = Deno.env.get('PDFCO_API_KEY')
  if (!pdfcoApiKey || pageIndices.length === 0) return []
  try {
    // Confirmed against PDF.co's own docs: comma-separated 0-indexed page
    // numbers/ranges is the correct format (e.g. "0, 2-4, !0").
    // Hard cap matches what one Groq request can carry at 2,048 tokens an
    // image on this account's TPM — rasterising more would only be thrown away.
    const pages = pageIndices.slice(0, VISION_MAX_IMAGES).join(',')
    console.log(`Long-doc visual analysis: converting page(s) [${pages}] via PDF.co...`)

    const fileUrl = await uploadFileToPdfCo(fileBytes, pdfcoApiKey, 'document.pdf')
    if (!fileUrl) {
      console.warn('Long-doc visual analysis: PDF.co file upload failed, skipping visual patch')
      return []
    }

    const pdfcoRes = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
      method: 'POST',
      headers: { 'x-api-key': pdfcoApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fileUrl, pages })
    })
    if (!pdfcoRes.ok) {
      let bodyText = ''
      try { bodyText = await pdfcoRes.text() } catch (_e) { /* ignore */ }
      console.warn(`Long-doc PDF.co response status failed: ${pdfcoRes.status} — ${bodyText.slice(0, 500)}`)
      return []
    }
    const pdfcoData = await pdfcoRes.json()
    if (pdfcoData.error || !(pdfcoData.urls || pdfcoData.url)) {
      console.warn("Long-doc PDF.co API returned error:", pdfcoData)
      return []
    }
    const rawUrls = pdfcoData.urls || pdfcoData.url
    const imageUrls: string[] = Array.isArray(rawUrls) ? rawUrls : [rawUrls]

    const base64Images: string[] = []
    for (const imgUrl of imageUrls) {
      try {
        const imgRes = await fetch(imgUrl)
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer()
          base64Images.push(bytesToBase64(new Uint8Array(buffer)))
        }
      } catch (imgDownloadErr) {
        console.error(`Long-doc: failed to download page image from ${imgUrl}:`, imgDownloadErr)
      }
    }
    return base64Images
  } catch (err) {
    console.error("Long-doc PDF.co page conversion failed:", err)
    return []
  }
}

function buildChunkSystemPrompt(chunkIndex: number, totalChunks: number, langLabel: string, hasPageMarkers: boolean, pageMarkerLabel: string, isDeck = false): string {
  return `You are an academic study assistant helping process a LARGE document that has been split into ${totalChunks} sequential parts because of its length. You are given ONLY part ${chunkIndex + 1} of ${totalChunks} below — you do NOT see the rest of the document, so do not reference "the whole document" or assume content beyond what's shown here.

Respond with ONLY a valid JSON object, no markdown code fences, no commentary before or after — matching this exact shape: { "chunk_summary": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "tables": [ { "title": string, "headers": [ string ], "rows": [ [ string ] ] } ], "charts": [ { "title": string, "type": string, "labels": [ string ], "data": [ number ] } ], "footnotes": [ { "id": number, "reference": string, "page": number | null } ], "is_quantitative": boolean, "formulas": [ { "name": string, "latex": string, "variables": [ { "symbol": string, "meaning": string } ] } ], "worked_examples": [ { "title": string, "problem_statement": string, "steps": [ string ], "final_answer": string } ], "diagrams": [ { "title": string, "mermaid": string, "description": string } ], "concept_graph": { "nodes": [ { "id": string, "label": string, "type": string } ], "edges": [ { "from": string, "to": string, "relation": string } ] } }.

CHUNK SUMMARY:
Write a 2-4 sentence "chunk_summary" capturing specifically what THIS part covers — it will later be combined with the other parts' summaries into one final document summary, so be concrete and self-contained about the actual topics discussed here rather than vague.

${buildSlideDeckInstruction(isDeck, pageMarkerLabel === "SLAYT" ? "slide" : "page")}

EXTRACTION SCOPE:
Extract key terms, key points, and 1-3 quiz questions found in THIS PART ONLY. Scale the amount to how much substantive academic content this part actually contains — a short or mostly administrative/transitional part may legitimately warrant few or even zero key terms/points/quiz questions. Do not pad for the sake of padding.

EXAM-FOCUSED CONTENT FILTERING (not optional):
Separate this part's content into (a) actual academic subject matter — concepts, definitions, theories, frameworks/models, processes, relationships, formulas, examples — and (b) course administration/logistics — grading weights/percentages, exam format/rules, attendance policy, bonus/late-submission policy, grade-appeal procedures, office hours, textbook title/edition. ONLY (a) belongs in chunk_summary, key_points, footnotes, or quiz_questions. COMPLETELY EXCLUDE (b), even if its numbers are specific and checkable — a student is never tested on grading weights or textbook editions. If this part is mostly administrative logistics, it is correct to return few or zero key_terms/key_points/quiz_questions for it — do not pad with excluded content.

QUANTITATIVE & FORMULAS:
Set "is_quantitative" true if this part centers on mathematical formulas, numerical calculations, or financial/statistical computations. Extract EVERY distinct formula into 'formulas'. Use valid raw LaTeX ONLY (no surrounding $ or \\( \\) delimiters) — examples: "E = mc^2", "\\\\frac{a}{b}", "\\\\sum_{i=1}^{n} x_i", "F = ma". For each formula also list its variables with meanings. Additionally produce 1-2 worked_examples when formulas are present (prefer the source's own example with its real numbers; otherwise generate one clear realistic practice example). Return empty arrays if not applicable to this part.

TABLES & CHARTS:
Identify any tabular data ('tables') or chart-worthy numeric data ('charts', type "bar"|"pie"|"line") actually present in this part. Empty arrays are the correct output if none exists — never fabricate.

DIAGRAMS (Mermaid reconstruction):
You only see extracted text — visual layout (boxes, arrows, side-by-side positioning) is lost. A flowchart, comparison diagram, process illustration, hierarchy or cycle on the original slide/page often survives only as a cluster of short disconnected phrases, sequential stage names, or paired opposing terms. When you detect such a structure in THIS part, RECONSTRUCT it as a real Mermaid diagram and put it in the "diagrams" array:
{ "title": "short descriptive title", "mermaid": "valid Mermaid source code", "description": "1-2 sentence plain-language explanation of what the diagram shows" }.
Prefer these Mermaid types: flowchart TD, flowchart LR, graph TD, sequenceDiagram, mindmap. Keep syntax simple and valid (no experimental plugins). Limit to the 1-2 most important diagrams in this part. Also still add a key_point prefixed with "Diyagram/Görsel:" (or "Diagram/Visual:" in English) that briefly states the same idea. Return empty "diagrams" array when nothing is reconstructible — never invent diagrams that have no basis in the text.

CONCEPT GRAPH (this part only):
Extract the main academic concepts that appear in THIS part and their relationships. Output in concept_graph:
- nodes: [{ "id": "c1", "label": "Concept Name", "type": "concept" }] — short, exam-relevant concept labels (3-8 words max). Use sequential ids c1, c2, ... within this part.
- edges: [{ "from": "c1", "to": "c2", "relation": "includes" }] — only real relationships visible in the text. Allowed relation values: includes, is_a, causes, part_of, related_to, depends_on, contrasts_with.
Keep it focused: 3-8 nodes and 2-10 edges max for this part. Empty nodes/edges arrays are correct if this part has little conceptual structure.

FOOTNOTES:
For specific, checkable factual claims within key_points (numbers, definitions, named findings), add a footnote marker like [1], [2] immediately after the claim (numbering restarts at 1 for this part — it will be renumbered globally later). List each in 'footnotes': [{ "id": number, "reference": "brief description of the topic/heading this relates to", "page": number | null }]. ${buildFootnotePageInstruction(hasPageMarkers, pageMarkerLabel)} Don't over-footnote.

ACCURACY:
Base everything STRICTLY on the text in this part. Do not invent facts or assume content not shown. Copy specific numbers, names, and technical terms exactly as they appear.

LANGUAGE:
Respond entirely in: '${langLabel}'.`
}

function buildSynthesisSystemPrompt(courseCatalogBlock: string, langLabel: string, styleInstruction: string, summaryLengthPhrase: string): string {
  return `You are an academic study assistant. A large document was split into sequential parts and each part was already summarized independently. Below you are given all of those part-summaries, in order, plus a hint about what fraction were flagged as quantitative. Your job is to synthesize ONE cohesive, well-organized final summary of the ENTIRE document — write a genuinely unified narrative that flows across the whole document, not a mechanical concatenation of the part-summaries.

Respond with ONLY a valid JSON object, no markdown fences, no commentary before or after: { "summary": string, "summary_executive": string, "document_type": string, "suggested_course_tag": string | null, "is_quantitative": boolean, "outline": { "document_title_guess": string, "items": [ { "id": string, "heading": string, "blurb": string, "level": number, "order": number, "parent_id": string | null } ] }, "sections": [ { "heading": string, "summary": string, "key_points": [ string ], "outline_id": string | null } ], "concept_graph": { "nodes": [ { "id": string, "label": string, "type": string } ], "edges": [ { "from": string, "to": string, "relation": string } ] } }.

EXECUTIVE SUMMARY:
Write "summary_executive" as a 2-3 sentence ultra-short overview that NAMES the actual subject (e.g. "machine learning lecture notes covering supervised learning, neural nets, and evaluation metrics"). Forbidden: vague lines like "this document provides a qualitative overview of key concepts".

OUTLINE ENGINE (document skeleton — REQUIRED when the material has structure):
Build "outline" as a table-of-contents for the whole document:
- document_title_guess: short title if evident, else ""
- items: 3-12 entries in reading order. Each: { "id": "o1", "heading": "2-6 word label", "blurb": "one sentence: what this part contributes to the document", "level": 1 or 2, "order": 1, "parent_id": null or parent id }
- level 1 = major parts; level 2 = sub-topics under a parent
- Headings MUST reflect real topics from the part-summaries (e.g. "Supervised Learning", "Neural Networks", "Evaluation Metrics") — NOT generic labels like "Introduction", "Main Discussion", "Conclusion", "Key Concepts" when specific topics exist
- Never include pure admin/logistics (grading weights, attendance, office hours, textbook edition)
- If the document is truly one continuous topic with no natural splits, return 2-3 coarse items rather than an empty list

CONCEPT GRAPH (whole document):
From the part-summaries, build a unified concept_graph covering the whole document. nodes: [{ "id": "c1", "label": "...", "type": "concept" }], edges: [{ "from": "c1", "to": "c2", "relation": "includes"|"is_a"|"causes"|"part_of"|"related_to"|"depends_on"|"contrasts_with" }]. 5-15 nodes and their real relationships. Reuse consistent ids. Empty graph only if the material truly has no conceptual structure.

DOCUMENT-TYPE CLASSIFICATION:
Identify the overall document type as exactly one of: "Lecture Notes/Slides", "Academic Article", "Syllabus", "Case Study", "Textbook Chapter", or "Other".

SECTION PASS (deep per-topic summaries — aligned with outline):
Output "sections" as 2-8 items matching major outline level-1 topics. Each item MUST be:
{ "heading": "same as outline", "summary": "4-8 sentence DEEP academic summary of ONLY this topic — coherent paragraph(s), not a bullet dump; explain arguments, definitions, and why it matters", "key_points": ["3-6 concrete takeaways for this section only"], "outline_id": "o1" }
Rules:
- summary must be substantially longer and more specific than outline.blurb
- Do not repeat the whole-document summary inside every section
- Skip pure administration (grading, attendance, textbook edition)
- If outline has items, sections should mirror those level-1 headings and set outline_id accordingly

SUGGESTED COURSE TAG:
Below is this student's OFFICIAL course catalog (format: CODE — Course Name):
${courseCatalogBlock}
Compare the document's content against this catalog. If it clearly matches one listed course, return that course's EXACT code (character-for-character). Otherwise, if a course code or clear subject label is evident from the part-summaries, use that as free text instead. If genuinely unclear and nothing fits, return null. Never invent a code that isn't in the catalog above and isn't evident in the part-summaries.

IS_QUANTITATIVE:
You'll be told what fraction of parts were flagged quantitative — combine that with your own reading of the part-summaries to make one final true/false call for the document as a whole.

LENGTH INSTRUCTION:
${summaryLengthPhrase}

STYLE INSTRUCTION:
${styleInstruction}

LANGUAGE INSTRUCTION:
Respond strictly in: '${langLabel}' (except "document_type", which must be one of the exact English strings listed above).

ACCURACY:
Base the summary strictly on the part-summaries provided — do not invent content beyond what they describe.
The summary MUST mention concrete terms, methods, or chapter themes that appear in the part-summaries. Generic academic filler without domain content is a failure.

EXAM-FOCUSED CONTENT FILTERING (not optional):
If any part-summary contains course administration/logistics — grading weights, exam format/rules, attendance policy, grade-appeal procedures, office hours, textbook title/edition — EXCLUDE it from your final summary entirely, even if it was mistakenly included in a part-summary. Only synthesize the actual academic subject matter (concepts, theories, definitions, processes, relationships, formulas, examples).`
}

/* MADDE METNINI SEKILDEN BAGIMSIZ OKU (24.10.2026).
 *
 * Model sema disina ciktiginda (ozellikle gpt-oss-20b, ki pencere 2
 * sistematik olarak oraya dusuyor) `key_points` bazen dizge yerine
 * {text}/{point} nesnesi donuyor. Dosyanin bir yerinde bunu tolere eden
 * okuyucu VAR, iki dedupeByText cagrisi ise kimlik fonksiyonu geciyordu ve
 * normalizeForDedup dizge bekledigi icin TypeError atiyordu:
 *
 *   normalizeForDedup({text: '...'}) -> (s || "").toLowerCase is not a function
 *
 * Istisna birlesme sirasinda olusuyor; en dis catch de belgeyi askida
 * birakiyordu (bkz. hataIcinDocumentId). Yani tek bir sema sapmasi =
 * sonsuz bekleyen ogrenci. Ayni mantigin iki ayri yazimi, yine. */
function maddeMetni(p: any): string {
  return typeof p === 'string' ? p : String(p?.text || p?.point || '')
}

/* KEY_TERMS DIZGE DIZISI OLARAK GELIRSE (24.10.2026).
 *
 * `if (!t || !t.term) continue` dizge girdiyi hicbir sayac artirmadan
 * dusuruyordu: model `key_terms: ["Esneklik","GSYH"]` dondugunde
 * "Window 2 ok: terms=24" yaziliyor, birlesim o 24'u HIC icermiyor ve
 * hicbir satir neden gittigini soylemiyordu. Olculdu:
 *   dedupeKeyTerms(['Esneklik','GSYH']) -> 0 kayit
 *
 * Artik dizge girdi {term, definition:''} olarak normalize ediliyor ve
 * gercekten atilan kayit SAYILIP loglaniyor. Tanimsiz terim karta girebilir;
 * cloze uretimi onlari zaten atliyor, sessiz kaybetmek daha kotu. */
function dedupeKeyTerms(terms: any[]): any[] {
  const seen = new Map<string, any>()
  let atilan = 0
  for (const t of terms) {
    const kayit = typeof t === 'string' ? { term: t, definition: '' } : t
    if (!kayit || !kayit.term) { if (t != null) atilan++; continue }
    const key = String(kayit.term).trim().toLowerCase()
    if (!seen.has(key)) seen.set(key, kayit)
  }
  if (atilan > 0) {
    console.warn(`dedupeKeyTerms: ${atilan} kayit 'term' alani olmadigi icin atildi`)
  }
  return Array.from(seen.values())
}

/** Normalize deep sections: heading + long summary + key_points + outline_id */
function normalizeSections(raw: any, outline?: { items?: any[] } | null): any[] {
  const arr = Array.isArray(raw) ? raw : []
  const outlineItems = outline?.items || []
  return arr
    .filter((s: any) => s && (s.heading || s.title))
    .map((s: any, idx: number) => {
      const heading = String(s.heading || s.title || '').trim()
      const summary = String(s.summary || s.body || '').trim()
      let keyPoints: string[] = []
      if (Array.isArray(s.key_points)) {
        keyPoints = s.key_points
          .map((p: any) => String(typeof p === 'string' ? p : (p?.point || p?.text || '')).trim())
          .filter(Boolean)
      }
      let outlineId = s.outline_id || s.outlineId || null
      if (!outlineId && outlineItems.length) {
        const match = outlineItems.find((o: any) =>
          String(o.heading || '').toLowerCase() === heading.toLowerCase()
        )
        if (match) outlineId = match.id
      }
      return {
        heading,
        summary,
        key_points: keyPoints.slice(0, 8),
        outline_id: outlineId,
        order: Number(s.order) || idx + 1
      }
    })
    .filter((s: any) => s.heading.length > 0 && s.summary.length > 0)
}

/** Normalize outline from model output into a stable shape for study_cards.outline */
function normalizeOutline(raw: any, sectionsFallback?: any[]): { document_title_guess: string; items: any[] } {
  const empty = { document_title_guess: '', items: [] as any[] }
  if (raw && typeof raw === 'object' && Array.isArray(raw.items) && raw.items.length > 0) {
    const items = raw.items
      .filter((it: any) => it && (it.heading || it.title))
      .map((it: any, idx: number) => ({
        id: String(it.id || `o${idx + 1}`),
        heading: String(it.heading || it.title || '').trim(),
        blurb: String(it.blurb || it.summary || it.role || '').trim(),
        level: Math.min(3, Math.max(1, Number(it.level) || 1)),
        order: Number(it.order) || idx + 1,
        parent_id: it.parent_id || it.parent || null
      }))
      .filter((it: any) => it.heading.length > 0)
    return {
      document_title_guess: String(raw.document_title_guess || raw.title || '').trim(),
      items
    }
  }
  // Fallback: lift flat sections into outline items
  if (Array.isArray(sectionsFallback) && sectionsFallback.length > 0) {
    return {
      document_title_guess: '',
      items: sectionsFallback
        .filter((s: any) => s && (s.heading || s.title))
        .map((s: any, idx: number) => ({
          id: `o${idx + 1}`,
          heading: String(s.heading || s.title || '').trim(),
          blurb: String(s.summary || s.blurb || '').trim().slice(0, 280),
          level: 1,
          order: idx + 1,
          parent_id: null
        }))
    }
  }
  return empty
}

function normalizeForDedup(s: string): string {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim()
}

// ==========================================================================
// NEAR-DUPLICATE MERGE
//
// dedupeByText below keys on the first 50 normalised characters:
//
//     const sig = norm.slice(0, 50)
//
// That catches an exact repeat but misses the kind of duplicate this
// pipeline actually produces. Each window is summarised independently and
// never sees its neighbours, so the same idea comes back worded differently
// from two windows:
//
//     "Talep esnekliği fiyat değişimine duyarlılığı ölçer"
//     "Esneklik, fiyat değişimine talebin duyarlılığıdır"
//
// Different first 50 characters, so both survive and the student reads the
// same fact twice — and both occupy slots in a capped list, pushing out
// content that is actually new.
//
// Comparing content-term sets catches them. The overlap COEFFICIENT (shared
// terms over the smaller set) is used rather than Jaccard on purpose: a
// short point that is fully contained in a longer one is a duplicate, and
// Jaccard would score that pair low simply because the lengths differ.
// ==========================================================================
const NEAR_DUP_THRESHOLD = 0.7   // share of the smaller term set that must match
const NEAR_DUP_MIN_TERMS = 3     // below this, wording is too thin to compare

// Fixed-prefix stem length for duplicate comparison.
//
// Exact token matching collapses on Turkish, which is precisely where this
// merge is needed: "esneklik"/"esnekliği", "duyarlılığı"/"duyarlılığını" and
// "talep"/"talebin" are the same word, and comparing them literally scored
// the two paraphrases below the threshold — so the duplicate survived.
//
// Raising the threshold's tolerance instead would have merged genuinely
// different points, so the cause is fixed rather than the bar lowered. The
// Postgres side solves this with the snowball Turkish stemmer; there is no
// stemmer available inside a Deno edge function, so fixed-prefix stemming
// stands in. It works because Turkish is suffixing: cut the suffixes off and
// the stem is the prefix. Five characters is the length long established for
// Turkish retrieval — short enough to survive inflection, long enough that
// unrelated words do not collide.
//
// Used ONLY for duplicate detection. Citation anchoring deliberately keeps
// stricter matching, because there a false match means pointing a student at
// the wrong page.
const NEAR_DUP_STEM_LEN = 5

function nearDupStem(term: string): string {
  const t = String(term || '')
  return t.length <= NEAR_DUP_STEM_LEN ? t : t.slice(0, NEAR_DUP_STEM_LEN)
}

function nearDupTermSet(text: string): Set<string> {
  return new Set(anchorTerms(text).map(nearDupStem))
}

// Do two glossary entries name the SAME term?
//
// Word overlap alone cannot answer this, because the text being compared is
// term + definition and the definition dominates it. A glossary defines
// related concepts in deliberately parallel sentences, which is precisely
// when overlap misfires. Measured on the reference chapter's own glossary:
//
//   0.86  Treasury bonds, notes, or bills  <->  Corporate bonds
//   0.73  Expansion or boom                <->  Contraction, recession, or slump
//   0.60  Inflation                        <->  Deflation
//
// The first two merged and were lost from the card. The second pair are
// OPPOSITES — "from a trough up to a peak ... grow" against "from a peak down
// to a trough ... fall" — sharing almost every content word and differing only
// in direction. Inflation/deflation sat one wording change away from the same
// fate.
//
// Raising the threshold would not fix this; it would only move which pairs
// collide, and it would stop catching the real duplicates. The structural
// answer is that a glossary is keyed by its term: entries whose HEAD TERMS
// differ are different entries, however similar the prose. So when a key is
// available, it has a veto.
const NEAR_DUP_KEY_OVERLAP = 0.8

function nearDupKeysMatch(a: string, b: string): boolean {
  const na = gateNormalize(a)
  const nb = gateNormalize(b)
  // No usable key on one side — fall back to the text comparison alone, which
  // is the old behaviour and the right one for key_points and quiz questions.
  if (!na || !nb) return true
  if (na === nb) return true
  // "business cycle" vs "the business cycle", "aggregate output" vs
  // "aggregate output (real GDP)" — the same term, stated at more length.
  if (na.includes(nb) || nb.includes(na)) return true
  // "sticky prices" vs "price stickiness" — same words, inflected or
  // reordered. Stems, so Turkish suffixes do not defeat it.
  const sa = nearDupTermSet(na)
  const sb = nearDupTermSet(nb)
  if (sa.size === 0 || sb.size === 0) return false
  let shared = 0
  for (const t of sa) if (sb.has(t)) shared++
  return shared / Math.min(sa.size, sb.size) >= NEAR_DUP_KEY_OVERLAP
}

/**
 * Collapse near-duplicates, keeping the more informative wording (the longer
 * text) of each group rather than whichever happened to come first.
 * Preserves input order based on where each surviving item first appeared.
 *
 * `getKey` is optional. When supplied (key_terms pass the term itself), two
 * items whose keys name different things are never merged, no matter how
 * alike their full text reads.
 */
/* AYNI DIYAGRAM KARTA IKI KEZ GIRIYOR (29.10.2026 olcumu).
 *
 * "Weeks 4-5 Chp 3" kartinda ikinci ve ucuncu diyagram ayni seydi:
 *   "The Self-Fulfilling Prophecy Cycle"                    (pencereden)
 *   "The Self-Fulfilling Prophecy: A sad cycle in four acts" (gorsel gecisten)
 * Log sebebi soyluyor:
 *   Long-doc visual patch: ... +1 diagrams
 *   Near-duplicate merge: terms 20->20, points 27->27, quiz 16->16
 * Kopya birlestirme terim/madde/soru'ya bakiyor, DIYAGRAMLARA hic bakmiyor.
 *
 * NEDEN GENEL DEDUPE YETMIYOR: olculdu, iki diyagramin dugum metni
 * ortusmesi 0,643 — NEAR_DUP_THRESHOLD (0,7) bunu KACIRIYOR. Esigi genel
 * olarak dusurmek madde ve terimleri de etkilerdi.
 *
 * IKI KOSUL. Baslik ortusmesi bu veride cok daha keskin: ayni diyagram icin
 * 1,000, farkli diyagramla (Types of Social Cognition) 0,000. Ama baslik
 * TEK BASINA yetmez — "Social Cognition: Automatic" ile ".. Controlled"
 * baslikta ortusur, iceride ortusmez. Bu yuzden ikisi birden isteniyor:
 *   baslik ortusmesi >= DIYAGRAM_BASLIK_ESIGI (0,7)  VE
 *   dugum ortusmesi  >= DIYAGRAM_DUGUM_ESIGI  (0,5)
 * Olculen cift: baslik 1,000, dugum 0,500 -> kopya. Farkli cift (Types of
 * Social Cognition): 0,000 / 0,000 -> ayri.
 *
 * DUGUM ESIGI BILEREK GEVSETILMEDI. Olculen kopya tam 0,500'de, yani
 * sinirda. Esigi dusurmek merging'i kolaylastirir ve yanlis tarafa hata
 * yapar: bir kopyayi KACIRMAK (iki diyagram gorunur) gercek bir diyagrami
 * SILMEKTEN iyidir. Sinirda kalmasi kabul; kaybetmemek esas. */
const DIYAGRAM_BASLIK_ESIGI = NEAR_DUP_THRESHOLD
const DIYAGRAM_DUGUM_ESIGI = 0.5

/** Mermaid dugum etiketleri: A[Metin], B("Metin"), C{Metin}. Ok bicimi ve
 *  yon anahtar sozcukleri disarida — ayni diyagram farkli ok yazabilir. */
function diagramDugumMetni(d: any): string {
  const src = String(d?.mermaid || '')
  const out: string[] = []
  const re = /[[({]\s*"?([^\])}"|]+)"?\s*[\])}]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1].trim())
  return out.join(' ')
}

function kumeOrtusmesi(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let paylasilan = 0
  for (const t of a) if (b.has(t)) paylasilan++
  return paylasilan / Math.min(a.size, b.size)
}

function dedupeDiagrams(diagrams: any[]): { diagrams: any[]; dropped: string[] } {
  const list = Array.isArray(diagrams) ? diagrams : []
  type Tutulan = { d: any; bas: Set<string>; dug: Set<string>; uz: number }
  const kept: Tutulan[] = []
  const dropped: string[] = []
  for (const d of list) {
    const dugMetin = diagramDugumMetni(d)
    const aday: Tutulan = {
      d,
      bas: nearDupTermSet(String(d?.title || '')),
      dug: nearDupTermSet(dugMetin),
      uz: dugMetin.length
    }
    let es = -1
    for (let i = 0; i < kept.length; i++) {
      if (aday.bas.size < NEAR_DUP_MIN_TERMS || kept[i].bas.size < NEAR_DUP_MIN_TERMS) continue
      if (kumeOrtusmesi(aday.bas, kept[i].bas) < DIYAGRAM_BASLIK_ESIGI) continue
      if (kumeOrtusmesi(aday.dug, kept[i].dug) < DIYAGRAM_DUGUM_ESIGI) continue
      es = i
      break
    }
    if (es === -1) { kept.push(aday); continue }
    /* Ayni diyagram: DAHA DOLU olan kalir, sirasi degismez. Gorsel gecisten
       gelen kopya genelde belgenin kendi sekil altyazisini ve numarali
       adimlarini tasiyor, yani daha iyi olani odur. */
    const dusen = aday.uz > kept[es].uz ? kept[es].d : d
    dropped.push(String(dusen?.title || '(isimsiz)'))
    if (aday.uz > kept[es].uz) kept[es] = aday
  }
  return { diagrams: kept.map((k) => k.d), dropped }
}

/* AYNI BOLUM KARTA IKI KEZ GIRIYOR (30.10.2026 olcumu).
 *
 * "Week 9 Introduction to Integrals" kartinda 2. ve 4. bolum ayni seydi:
 *   "Area Under a Curve and Riemann Sums"  (pencereden)
 *   "Accumulation and Area"                (gorsel gecisten)
 * Log sebebi soyluyor:
 *   Long-doc visual patch: ... +1 sections
 *   Near-duplicate merge: terms 15->15, points 13->11, quiz 10->8, diagrams 0
 * Kopya birlestirme terim/madde/soru ve diyagrama bakiyor, BOLUMLERE hic
 * bakmiyor. Ogrenci ayni konuyu kartta iki ayri bolum olarak goruyor.
 *
 * NEDEN GENEL DEDUPE YETMIYOR: olculdu, kopya ciftin govde ortusmesi 0,458
 * — NEAR_DUP_THRESHOLD (0,7) bunu KACIRIYOR.
 *
 * IKI KOSUL, dedupeDiagrams ile ayni kalip. Olculen dort bolumun alti cifti:
 *   baslik / govde
 *   0,500 / 0,458   Area Under a Curve + Riemann  <->  Accumulation and Area  KOPYA
 *   0,333 / 0,118   Bridge from Derivatives       <->  Basic Rules
 *   0,000 / 0,294   Bridge from Derivatives       <->  Accumulation and Area
 *   0,000 / 0,059   geri kalan uc cift            <= 0,059
 * Kopya ile en yakin masum cift arasinda hem baslikta hem govdede acik
 * mesafe var; esikler o araliga konuyor, kopyanin uzerine degil.
 *
 * BASLIKTA MIN TERIM 3 OLAMAZ. Olculen basliklarin terim sayilari 3,4,3,2:
 * "Accumulation and Area" YALNIZCA 2 terim uretiyor, yani dedupeDiagrams'in
 * kullandigi NEAR_DUP_MIN_TERMS (3) kapisi tam olculen kopyayi atlardi.
 * Bolum basliklari kisa olmak zorunda, bu yuzden kendi tabani var.
 *
 * UZUNLUK TEK BASINA YANLIS BOLUMU SECIYOR. Olculen ciftte kopya olan
 * (gorsel gecisten gelen) 298 karakter, dogru bolum 285 — yani "daha dolu
 * olan kalsin" kurali dedupeDiagrams'ta oldugu gibi uygulanirsa kart
 * belgenin kendi ana basligini atip mugalak olani tutar. Bolumun ogrenciye
 * degeri MADDESINDE: olculen ciftte 3'e karsi 2. Once madde sayisi, esitlik
 * halinde metin uzunlugu. */
const BOLUM_BASLIK_ESIGI = 0.45
const BOLUM_GOVDE_ESIGI = 0.4
const BOLUM_BASLIK_MIN_TERIM = 2

/** Bolumun govdesi: ozet + maddeler. Baslik AYRI olculuyor. */
function bolumGovdeMetni(sec: any): string {
  const kp = Array.isArray(sec?.key_points)
    ? sec.key_points.map((x: any) => typeof x === 'string' ? x : String(x?.text || '')).join(' ')
    : ''
  return (String(sec?.summary || '') + ' ' + kp).trim()
}

function bolumMaddeSayisi(sec: any): number {
  return Array.isArray(sec?.key_points) ? sec.key_points.length : 0
}

function dedupeSections(sections: any[]): { sections: any[]; dropped: string[] } {
  const list = Array.isArray(sections) ? sections : []
  type Tutulan = { sec: any; bas: Set<string>; gov: Set<string>; madde: number; uz: number }
  const kept: Tutulan[] = []
  const dropped: string[] = []
  for (const sec of list) {
    const govMetin = bolumGovdeMetni(sec)
    const aday: Tutulan = {
      sec,
      bas: nearDupTermSet(String(sec?.heading || '')),
      gov: nearDupTermSet(govMetin),
      madde: bolumMaddeSayisi(sec),
      uz: govMetin.length
    }
    let es = -1
    for (let i = 0; i < kept.length; i++) {
      if (aday.bas.size < BOLUM_BASLIK_MIN_TERIM || kept[i].bas.size < BOLUM_BASLIK_MIN_TERIM) continue
      if (aday.gov.size < NEAR_DUP_MIN_TERMS || kept[i].gov.size < NEAR_DUP_MIN_TERMS) continue
      if (kumeOrtusmesi(aday.bas, kept[i].bas) < BOLUM_BASLIK_ESIGI) continue
      if (kumeOrtusmesi(aday.gov, kept[i].gov) < BOLUM_GOVDE_ESIGI) continue
      es = i
      break
    }
    if (es === -1) { kept.push(aday); continue }
    // Once MADDE sayisi, esitlikte metin uzunlugu — bkz. yukaridaki olcum.
    const adayDahaIyi = aday.madde > kept[es].madde ||
      (aday.madde === kept[es].madde && aday.uz > kept[es].uz)
    const dusen = adayDahaIyi ? kept[es].sec : sec
    dropped.push(String(dusen?.heading || '(basliksiz)'))
    if (adayDahaIyi) kept[es] = aday
  }
  return { sections: kept.map((k) => k.sec), dropped }
}

function dedupeNearDuplicates(
  items: any[],
  getText: (item: any) => string,
  getKey?: (item: any) => string
): any[] {
  const list = Array.isArray(items) ? items : []
  type Kept = { item: any; terms: Set<string>; order: number; len: number; key: string }
  const kept: Kept[] = []

  for (let i = 0; i < list.length; i++) {
    const text = String(getText(list[i]) || '')
    if (!text.trim()) continue
    const terms = nearDupTermSet(text)
    const key = getKey ? String(getKey(list[i]) || '') : ''

    if (terms.size < NEAR_DUP_MIN_TERMS) { kept.push({ item: list[i], terms, order: kept.length, len: text.length, key }); continue }

    let mergedInto = -1
    for (let k = 0; k < kept.length; k++) {
      const other = kept[k]
      if (other.terms.size < NEAR_DUP_MIN_TERMS) continue
      // Different head terms → different entries, whatever the prose says.
      if (!nearDupKeysMatch(key, other.key)) continue
      let shared = 0
      for (const t of terms) if (other.terms.has(t)) shared++
      const overlap = shared / Math.min(terms.size, other.terms.size)
      if (overlap >= NEAR_DUP_THRESHOLD) { mergedInto = k; break }
    }

    if (mergedInto === -1) {
      kept.push({ item: list[i], terms, order: kept.length, len: text.length, key })
    } else if (text.length > kept[mergedInto].len) {
      // Same idea, better stated — keep the fuller wording at the original
      // position so ordering stays stable.
      kept[mergedInto] = { item: list[i], terms, order: kept[mergedInto].order, len: text.length, key }
    }
  }

  return kept.sort((a, b) => a.order - b.order).map(k => k.item)
}

/* ANLATIDA BIREBIR TEKRAR EDEN CUMLE (28.10.2026 olcumu).
 *
 * "economy chapter 25" kartinda profesyonel ozet AYNI cumleyi iki kez
 * tasiyordu:
 *   "The Fed uses open-market operations, reserve requirement changes, and
 *    the discount rate to influence the money supply."   (ust uste iki kez)
 *   "The demand for money rises with transaction size and falls with higher
 *    interest rates."                                     (ayni paragrafta)
 * Ogrenci profesyonel ozette ayni cumleyi iki kere okuyor.
 *
 * Sebep: dedupeNearDuplicates terim/madde/soruya uygulaniyor (bkz.
 * "Near-duplicate merge" logu) ama ANLATI metnine HIC uygulanmiyordu.
 *
 * Ozette birebir tekrar eden bir cumle hicbir zaman kasitli degil: ya iki
 * pencere ayni seyi yazdi, ya yazar kendi girdisini tekrarladi.
 *
 * ESIK NEDEN TAM ESLESME: yakin-kopya olcusu (nearDupKeysMatch) burada
 * tehlikeli — ozet cumleleri kisa ve ayni konuyu farkli yonden anlatan iki
 * mesru cumle kolayca yuksek ortusme verir. Birebir tekrar ise tartismasiz
 * kusur. Uzunluk esigi de var: kisa baglayicilar ("Bu onemlidir.") mesru
 * olarak tekrarlanabilir.
 *
 * METIN AYNEN KORUNUYOR: ayirici cumleye BITISIK birakiliyor ve parcalar
 * join('') ile geri yapistiriliyor, yani hicbir sey dusmediginde cikti
 * girdiyle bayt bayt ayni. Bu yuzden ondalik sayida ("$2,988.2") olusan
 * yanlis bolunme de zararsiz: parca 40 krk esiginin altinda kalip hic
 * dedup'a girmiyor, metin de bozulmuyor. */
const NARRATIVE_DUP_MIN_CHARS = 40

function narrativeDupKey(s: string): string {
  return trNormalize(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

function dedupeNarrativeSentences(text: string): { text: string; dropped: string[] } {
  if (typeof text !== 'string' || !text.trim()) return { text: typeof text === 'string' ? text : '', dropped: [] }
  const gorulen = new Set<string>()
  const dropped: string[] = []
  const paragraflar = text.split(/\n{2,}/)
  const cikti = paragraflar.map((p) => {
    const cumleler = p.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) || [p]
    const tut: string[] = []
    for (const c of cumleler) {
      const key = narrativeDupKey(c)
      if (key.length >= NARRATIVE_DUP_MIN_CHARS) {
        if (gorulen.has(key)) { dropped.push(c.trim().slice(0, 90)); continue }
        gorulen.add(key)
      }
      tut.push(c)
    }
    return tut.join('').replace(/[ \t]+$/, '')
  })
  /* Tamamen bosalan paragraf dusuyor; geri kalanlar arasindaki bos satir
     korunuyor ki paragraf yapisi bozulmasin. */
  return { text: cikti.filter((p) => p.trim()).join('\n\n'), dropped }
}

/* BOLUMLER HIC DEDUP'TAN GECMIYORDU (27.10.2026).
 *
 * Terimler, maddeler, sorular, tablolar — hepsinin bir dedup'i var; BOLUMLERIN
 * yoktu. Bolumler iki yerde birikiyor: pencerelerin flatMap'i ve gorsel
 * yamanin `bestSections.concat(newSections)` satiri. Gorsel yama metin
 * pencerelerinin okudugu sayfalari yeniden okuyor, yani ayni konuyu ikinci
 * kez bolum olarak yaziyor.
 *
 * Canli kart (27.10.2026, RSH Hemsireligi, 55 slayt): kartta alti bolum vardi
 * ve ikisi aynisiydi —
 *   02 "Egitim Gereksinimleri"  (pencereden)
 *   05 "Psikiyatri Hemsireligi Egitimi (Turkiye)"  (gorsel yamadan)
 * Ikisi de "lisans sonrasi yuksek lisans zorunludur" diyordu. Sentezin
 * gruplama adimi bunu toplardi ama o kosuda model 4 bolum icin 4 grup
 * dondurdu (indirgeme yok) ve review butceye sigmadigi icin hic kosmadi.
 * Yani kartin tek dedup'i olmayan listesi, tam da tekrari ureten listeydi.
 *
 * OLCULDU (ayni kartin bolumleri, baslik + ozet metni uzerinde):
 *   0.82  02 <-> 05   (tekrar — birlesmeli)
 *   0.17  02 <-> 06
 *   0.14  01 <-> 03
 *   0.12  04 <-> 06
 * Gercek tekrarla gercek farkin arasi genis; NEAR_DUP_THRESHOLD (0.7) bu
 * araliga rahat oturuyor, yeni bir esik uydurmaya gerek yok.
 *
 * Baslik metne DAHIL: yalnizca ozet karsilastirildiginda ayni cift 0.60
 * veriyor ve tekrar hayatta kaliyor. Basliklar ayrisan degil, birlestiren
 * sinyal — ikisi de "egitim" diyor.
 *
 * dedupeNearDuplicates tek basina yetmiyordu cunku kaybedeni TAMAMEN atiyor;
 * bolumun maddeleri de onunla giderdi. Burada ozetin uzunu kaliyor,
 * maddeler BIRLESIYOR (sentezGruplariniUygula ile ayni mantik). */
function dedupeBolumler(bolumler: any[]): any[] {
  const list = Array.isArray(bolumler) ? bolumler : []
  const bolumMetni = (b: any) =>
    `${String(b?.heading || b?.title || '')} ${String(b?.summary || b?.content || b?.body || '')}`.trim()
  type Tutulan = { bolum: any; terms: Set<string>; uzunluk: number }
  const tutulan: Tutulan[] = []

  for (const b of list) {
    const metin = bolumMetni(b)
    if (!metin) continue
    const terms = nearDupTermSet(metin)
    let birlestirilecek = -1
    if (terms.size >= NEAR_DUP_MIN_TERMS) {
      for (let k = 0; k < tutulan.length; k++) {
        if (tutulan[k].terms.size < NEAR_DUP_MIN_TERMS) continue
        let ortak = 0
        for (const t of terms) if (tutulan[k].terms.has(t)) ortak++
        if (ortak / Math.min(terms.size, tutulan[k].terms.size) >= NEAR_DUP_THRESHOLD) {
          birlestirilecek = k
          break
        }
      }
    }
    if (birlestirilecek === -1) {
      tutulan.push({ bolum: b, terms, uzunluk: metin.length })
      continue
    }
    // Maddeler birlesiyor: tekrar eden bolum yeni bir madde getirmis olabilir.
    const once = tutulan[birlestirilecek].bolum
    const maddeler: any[] = []
    const gorulen = new Set<string>()
    for (const kaynak of [once, b]) {
      for (const m of (Array.isArray(kaynak?.key_points) ? kaynak.key_points : [])) {
        const anahtar = maddeMetni(m).trim().toLowerCase()
        if (!anahtar || gorulen.has(anahtar)) continue
        gorulen.add(anahtar)
        maddeler.push(m)
      }
    }
    /* Uzun olan ANLATIM kaliyor, BASLIK ilk gorulenin: anahat pencerelerle
       birlikte uretiliyor ve normalizeSections outline_id'yi baslik
       esitligiyle buluyor. Gorsel yamanin basligina gecmek bolumu kendi
       anahat maddesinden koparirdi. Sira da ilk gorulenin. */
    const ozetOf = (x: any) => String(x?.summary || x?.content || x?.body || '')
    const onceOzet = ozetOf(once)
    const yeniOzet = ozetOf(b)
    tutulan[birlestirilecek] = {
      bolum: {
        ...once,
        summary: yeniOzet.length > onceOzet.length ? yeniOzet : onceOzet,
        key_points: maddeler
      },
      terms: tutulan[birlestirilecek].terms,
      uzunluk: Math.max(metin.length, tutulan[birlestirilecek].uzunluk)
    }
  }
  return tutulan.map(t => t.bolum)
}

function dedupeByText(items: any[], getText: (item: any) => string): any[] {
  const seen = new Set<string>()
  const out: any[] = []
  for (const item of items) {
    const norm = normalizeForDedup(getText(item))
    if (!norm) continue
    const sig = norm.slice(0, 50)
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push(item)
  }
  return out
}

// Word boundaries via \b are ASCII-centric and mis-fire around Turkish
// letters, so the edges are asserted against Unicode letter/number classes.
// Turkish dotted/dotless I. JavaScript's /i/ flag uses simple case folding,
// in which "İ" (U+0130) folds to "i" PLUS a combining dot (U+0307) — so it is
// not equal to plain "i" and /işsizlik/iu does NOT match "İşsizlik".
//
// That is not a corner case here: glossary terms come back lowercase and
// Turkish sentences capitalise the first word, so the single most likely
// placement of a term is the one form the regex could not see. Before this,
// a Turkish cloze would blank the lowercase occurrence and leave the
// capitalised one standing — printing the answer next to its own blank.
//
// Each i-family letter therefore becomes an explicit class. The /i/ flag
// still folds everything else.
function turkishIClasses(escaped: string): string {
  return escaped.replace(/[iıİI]/g, ch =>
    (ch === 'i' || ch === 'İ') ? '[iİ]' : '[ıI]'
  )
}

function clozeTermPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const body = turkishIClasses(escaped)
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${body})(?![\\p{L}\\p{N}])`, 'iu')
}

/**
 * Blank EVERY occurrence of a term, not just the first.
 *
 * Blanking only the first is how the 2026-10-04 export printed its own answer
 * key inside the question:
 *
 *   7. "...grew from approximately 300 billion ___ in 1900 to over
 *       17,000 billion 2009 dollars by 2014."          (answer: 2009 dollars)
 *   8. "...peaked near 10.5% during the 1980-1982 ___ and again reached
 *       approximately 10% during the 2008-2009 recessionary period."
 *
 * Both are sentences that repeat the term, which is common in exactly the
 * comparative sentences that make the best cards ("rose from X in 1900 to Y
 * in 2014"). Dropping those sentences would throw away good material, so
 * blank them all instead and the card stays worth answering.
 */
function blankAllOccurrences(text: string, term: string): string {
  const re = new RegExp(clozeTermPattern(term).source, 'giu')
  return text.replace(re, (_full, lead) => `${lead}___`)
}

/** Build cloze (fill-in-the-blank) cards from key terms and key points.
 *  Prefer model-produced cloze_cards when present; otherwise derive deterministically.
 *  Each card: { id, prompt, answer, full_text, source }
 *
 *  Two things were wrong with the derivation, and the library's whole
 *  "Boşluk Doldurma — aktif hatırlama" mode was the quieter for it.
 *
 *  1. Sentence clozes never ran. The key_term pass went first and, with a
 *     real glossary of 25-28 entries, consumed every one of the 20 slots.
 *     Every card a student saw was "___: <definition>", which is the
 *     ANAHTAR TERİMLER list read backwards — the same material twice, once
 *     labelled as an exercise. So the sentence pass now goes FIRST and the
 *     definition pass fills whatever is left. Both directions have study
 *     value; only one of them is distinctive.
 *
 *  2. The sentence pass blanked the wrong word. It looked for "the first
 *     capitalised phrase", but every sentence begins with a capital, so the
 *     first word always won:
 *         "___ five recessionary periods show increases in the
 *          unemployment rate."                            -> answer: "The"
 *         "___ policy involves government taxation..."     -> answer: "Fiscal"
 *     A stopword as the answer is not recall, and "Fiscal policy" being cut
 *     in half leaves the other half sitting in the prompt. Capitalisation
 *     was never the signal: this card already carries a vetted glossary, so
 *     the blank is now chosen by matching those terms against the sentence,
 *     longest first, so "unemployment rate" wins over "rate".
 */
function buildClozeCards(
  modelClozes: any[] | undefined,
  keyTerms: any[],
  keyPoints: any[],
  maxCards = 20
): any[] {
  const out: any[] = []
  const seenAnswers = new Set<string>()

  /**
   * Cross-card answer leakage.
   *
   * seenAnswers stops the same answer appearing twice. Nothing stopped one
   * card's QUESTION from containing another card's ANSWER, and on a real
   * glossary that happens constantly, because good cloze sentences name
   * neighbouring concepts. Measured on the economy chapter (05.10.2026):
   *
   *   #5  "Fiscal policy involves taxation and spending; ___ involves
   *        Federal Reserve actions..."                 -> monetary policy
   *   #17 "___: Government policies concerning taxes and spending."
   *                                                    -> fiscal policy
   *
   * #5 prints #17's answer verbatim. And it runs both ways:
   *
   *   #3  "___ is measured as real GDP"                -> aggregate output
   *   #10 "U.S. Aggregate Output (___), 1900-2014"     -> Real GDP
   *
   * So the check has to look in BOTH directions for every candidate: does
   * this prompt reveal an answer already committed, and does any committed
   * prompt reveal this candidate's answer.
   *
   * A leaking candidate is SKIPPED, not patched. Blanking the extra term
   * would give the card two blanks and one answer field, which is
   * unanswerable, and the candidate pool is normally much larger than
   * maxCards (29 terms and 16 points on this document), so the slot is
   * refilled by the next candidate instead of being lost.
   *
   * clozeTermPattern, not indexOf: the match must respect word boundaries
   * and the Turkish dotted-I folding, exactly like the blanking does.
   */
  const leaks = (prompt: string, answer: string): boolean => {
    for (const c of out) {
      // This candidate's question would print an earlier card's answer.
      if (clozeTermPattern(c.answer).test(prompt)) return true
      // An earlier card's question already prints this candidate's answer.
      if (clozeTermPattern(answer).test(c.prompt)) return true
    }
    return false
  }

  // 1) Keep valid model-produced clozes first
  if (Array.isArray(modelClozes)) {
    for (const c of modelClozes) {
      if (!c || !c.prompt || !c.answer) continue
      const ansKey = String(c.answer).trim().toLowerCase()
      if (!ansKey || seenAnswers.has(ansKey)) continue
      const mPrompt = String(c.prompt).trim()
      const mAnswer = String(c.answer).trim()
      if (leaks(mPrompt, mAnswer)) continue
      seenAnswers.add(ansKey)
      out.push({
        id: c.id || `cl${out.length + 1}`,
        prompt: mPrompt,
        answer: mAnswer,
        full_text: String(c.full_text || c.prompt.replace(/_{2,}/g, c.answer)).trim(),
        source: c.source || 'model'
      })
      if (out.length >= maxCards) return out
    }
  }

  // 3) Sentence clozes, chosen by the glossary rather than by capitalisation.
  //    Runs BEFORE the key_term pass below (see the note on the function) so
  //    it is not starved of slots by a long glossary.
  const clozeTerms = (keyTerms || [])
    .map((t: any) => String(t?.term || '').trim())
    .filter(t => t.length >= 3)
    // Longest first: in "the unemployment rate rose" the card must ask for
    // "unemployment rate", never for "rate".
    .sort((a, b) => b.length - a.length)

  for (const p of (keyPoints || [])) {
    if (out.length >= maxCards) break
    const text = String(typeof p === 'string' ? p : (p?.point || p?.text || '')).trim()
    if (!text || text.length < 20 || text.length > 180) continue

    for (const term of clozeTerms) {
      const ansKey = term.toLowerCase()
      // One blank per term: five cards asking the same word is one exercise
      // repeated, and it crowds out the rest of the glossary.
      if (seenAnswers.has(ansKey)) continue

      const m = text.match(clozeTermPattern(term))
      if (!m || typeof m.index !== 'number') continue

      // Every occurrence, so a sentence that repeats the term does not hand
      // the answer back in the question — see blankAllOccurrences.
      const prompt = blankAllOccurrences(text, term)
      // Nothing left to reason from if the blanks swallowed the sentence.
      if (prompt.replace(/_{3,}/g, ' ').trim().split(/\s+/).length < 5) continue
      // `continue`, not `break`: this sentence may still yield a clean card
      // from a different glossary term, so try the rest before giving up on it.
      if (leaks(prompt, term)) continue

      seenAnswers.add(ansKey)
      out.push({
        id: `cl${out.length + 1}`,
        prompt,
        // The glossary's own spelling, not whatever casing the sentence used.
        answer: term,
        full_text: text,
        source: 'key_point'
      })
      break   // one blank per sentence
    }
  }

  // 4) Definition prompts fill whatever capacity the sentence clozes left.
  //    Useful in their own right (definition -> term is the reverse of the
  //    ANAHTAR TERİMLER list), just not distinctive enough to crowd it out.
  for (const t of (keyTerms || [])) {
    if (out.length >= maxCards) break
    const term = String(t?.term || '').trim()
    const def = String(t?.definition || '').trim()
    if (!term || !def || term.length < 2) continue
    const ansKey = term.toLowerCase()
    if (seenAnswers.has(ansKey)) continue
    // Prefer blanking the term inside the definition when it appears; else "___ : definition"
    let prompt: string
    const defHasTerm = def.toLowerCase().includes(term.toLowerCase())
    if (defHasTerm) {
      // All occurrences, and on word boundaries. The old version replaced the
      // first bare substring, which both leaked the answer when a definition
      // used the term twice and could blank a fragment inside a longer word.
      prompt = blankAllOccurrences(def, term)
      // If the term only occurred as a substring of another word, nothing was
      // blanked — fall back to the definition prompt rather than shipping a
      // card whose question is just its own answer.
      if (!prompt.includes('___')) prompt = `___: ${def}`
    } else {
      prompt = `___: ${def}`
    }
    // Leak check AFTER the prompt is built — the "___: <definition>" fallback
    // and the blanked-definition form carry different text, so only the final
    // prompt can be checked. This is also why seenAnswers is marked here
    // rather than above: a skipped candidate must not burn its answer.
    if (leaks(prompt, term)) continue
    seenAnswers.add(ansKey)
    // full_text must restore the sentence the prompt was cut from, so it
    // follows which prompt shape we actually ended up with, not defHasTerm.
    const blanked = prompt !== `___: ${def}`
    out.push({
      id: `cl${out.length + 1}`,
      prompt,
      answer: term,
      full_text: blanked ? def : `${term}: ${def}`,
      source: 'key_term'
    })
  }

  return out
}

/**
 * Merge the review pass's output onto the draft instead of replacing it.
 *
 * WHY THIS EXISTS (04.10.2026, first live run with review enabled):
 * The review prompt asked for "the REFINED full study-card JSON" while the
 * call was capped at 2500 completion tokens. A 26-term brief does not fit in
 * 2500 tokens, so the model did the only thing it could and shipped a
 * shortened version. Its output replaced the draft wholesale:
 *
 *   merge            : terms=26 points=14 quiz=13
 *   after review     : terms=12 points=5  quiz=5
 *
 * Over half the study card, deleted by the pass that was supposed to improve
 * it. The prompt has since been narrowed so review only returns the narrative
 * fields, but a prompt is a request, not a guarantee — a model can always
 * return less than it was asked for. So the merge is where the guarantee
 * lives: arrays come from the DRAFT unless review sends back at least as many
 * items, and a review that returns nothing usable leaves the draft untouched.
 *
 * Review can therefore still fix wording and catch hallucinations; it can no
 * longer lose content by running out of room.
 */
const REVIEW_ARRAY_FIELDS = ['key_terms', 'key_points', 'quiz_questions', 'sections', 'footnotes']

/**
 * How much of the draft's narrative a rewrite must keep to be accepted.
 *
 * The arrays were guarded against shrinkage from the start; the narrative was
 * not, and on 04.10.2026 that asymmetry cost the summary three of its four
 * paragraphs. The chain: the narrative writer runs on MODEL_HEAVY, which has
 * no output cap, and produced ~1,600 characters. Review and then the critic
 * both run on MODEL_FAST, whose OTPM ceiling clamps them to 850 completion
 * tokens — and both REWRITE the summary. Two passes through a budget smaller
 * than the text they were handed, and ~1,600 characters came out ~560.
 *
 * Nothing was broken: each pass did exactly what it was asked, inside the
 * room it had. The mistake was letting a pass with less room than the writer
 * replace the writer's work unconditionally.
 *
 * Legitimate review trimming — dropping an unsupported clause, cutting admin
 * noise — takes a few percent. Losing a quarter of the text is compression,
 * not editing, so a rewrite below this share of the original is refused and
 * the draft's narrative stands. Review's findings are not lost either way:
 * they come back in quality_gate.issues regardless.
 */
const NARRATIVE_MIN_KEEP_RATIO = 0.75

/**
 * Compact synthesis'in GRUPLARINI pencere bolumlerine uygular (25.10.2026).
 *
 * Sentez artik bolum metni yazmiyor; numaralanmis bolumleri (S1..Sn) konu
 * gruplarina ayiriyor. Birlestirmeyi burasi yapiyor ve hicbir metni
 * KAYBETMIYOR: grup basligi modelden, ozet uyelerin ozetlerinin birlesimi,
 * maddeler uyelerin maddelerinin (tekrarsiz) birlesimi. Gruba girmeyen
 * bolum kendi basina kalir. Sira belge sirasi (grubun ilk uyesine gore),
 * modelin sirasi degil — konu akisi belgeden gelir.
 *
 * null = uygulanmadi (pencere bolumleri aynen kalir): girdi bozuksa, gecerli
 * grup ikiden azsa ya da sonuc bolum sayisini AZALTMIYORSA.
 */
function sentezGruplariniUygula(bolumler: any[], gruplar: any): any[] | null {
  if (!Array.isArray(bolumler) || bolumler.length < 3 || !Array.isArray(gruplar)) return null
  const kullanilan = new Set<number>()
  const girdiler: Array<{ ilk: number; bolum: any }> = []
  let gecerliGrup = 0
  for (const g of gruplar) {
    const uyeler: number[] = (Array.isArray(g?.members) ? g.members : [])
      .map((x: any) => Number(x) - 1)
      .filter((i: number) => Number.isInteger(i) && i >= 0 && i < bolumler.length && !kullanilan.has(i))
    const tekil = [...new Set(uyeler)].sort((a, b) => a - b)
    if (!tekil.length) continue
    tekil.forEach((i) => kullanilan.add(i))
    gecerliGrup++
    const parcalar = tekil.map((i) => bolumler[i])
    const maddeler: any[] = []
    const gorulen = new Set<string>()
    for (const p of parcalar) {
      for (const m of (Array.isArray(p?.key_points) ? p.key_points : [])) {
        const anahtar = maddeMetni(m).trim().toLowerCase()
        if (!anahtar || gorulen.has(anahtar)) continue
        gorulen.add(anahtar)
        maddeler.push(m)
      }
    }
    girdiler.push({
      ilk: tekil[0],
      bolum: {
        ...parcalar[0],
        heading: String(g?.heading || '').trim() || String(parcalar[0]?.heading || ''),
        summary: parcalar.map((p) => String(p?.summary || p?.content || '').trim()).filter(Boolean).join('\n\n'),
        key_points: maddeler
      }
    })
  }
  if (gecerliGrup < 2) return null
  bolumler.forEach((b, i) => { if (!kullanilan.has(i)) girdiler.push({ ilk: i, bolum: b }) })
  if (girdiler.length >= bolumler.length) return null
  return girdiler.sort((a, b) => a.ilk - b.ilk).map((x) => x.bolum)
}

/**
 * Apply review's targeted corrections to the narrative.
 *
 * WHY REVIEW NO LONGER REWRITES THE SUMMARY (05.10.2026, measured):
 * Review runs on MODEL_FAST, whose OTPM ceiling caps it at 850 completion
 * tokens for its ENTIRE answer — summary, executive summary, footnotes and
 * quality_gate together. A 2,157-character summary is ~674 tokens on its own,
 * 79% of the budget. Two live runs bear it out: 1,644 chars came back as 563,
 * and 2,157 came back as 635. Both around 30%, both against the same ceiling.
 *
 * So asking review to re-emit the summary is not a thing that sometimes
 * fails; it is a thing that cannot work. NARRATIVE_MIN_KEEP_RATIO caught the
 * damage, but catching it meant throwing away the corrections too — and
 * correcting the narrative is the whole reason review exists (it is what
 * caught "10.5% in the 2008-09 downturn" being the 1980-82 figure).
 *
 * A factual fix is a sentence, not a document. Review now returns the
 * sentences it wants changed, which costs ~60 tokens each instead of 674,
 * and they are applied here deterministically. The length of the narrative is
 * then preserved by construction rather than by a guard, every change is
 * logged, and a correction whose "find" text cannot be located exactly once
 * is skipped — a miss is a no-op, never a corruption.
 */
/* ===========================================================================
   YOKLUK IDDIASI KAPISI
   ===========================================================================
   08.10.2026, canli bir ekonometri destesinde (42 slayt) olculdu. Ozet su
   paragrafi tasiyordu:

     "The source does not discuss log-linear models that log-transform the
      dependent variable. The source does not describe coefficients as
      semi-elasticities... The source does not cover log-log models or
      elasticity interpretations of slopes."

   Kaynakta ise AYNEN su var:
     "- Log-Log Model"
     "In the log-log model β is an elasticity."

   Ustelik ozet KENDISIYLE celisiyordu: ayni belgede "Log-Log Model and
   Elasticity Interpretation" diye bir bolum, "log-log model" diye bir
   anahtar terim ve log-log uzerine bir sinav sorusu vardi.

   SEBEP YAPISAL. Review promptu modele acikca "You are shown only a
   truncated slice of the source" diyor ve "kaynagin desteklemedigi
   iddialari duzelt" istiyor. Model kendi diliminde log-log'u bulamayinca
   DOGRU cumleleri "kaynak bunu kapsamiyor" diye duzeltti.

   Prompt bu tuzagi ATIFLAR icin zaten fark etmis ("sadece bir dilim
   goruyorsun, sayfa numarasi yazma"). Ayni mantik olumsuz iddialar icin de
   birebir gecerli: gormedigin bir sey, OLMADIGI anlamina gelmez.

   Bu kapi deterministik: modelin kurala uymasina guvenmez. Taslakta
   OLMAYAN bir yokluk iddiasini review EKLEYEMEZ. Gercek bir olgu
   duzeltmesi (yanlis yil, yanlis rakam) etkilenmez — yalnizca "belgede X
   yok" seklindeki, dilimi goren birinin dogrulayamayacagi iddialar.
   =========================================================================== */
const YOKLUK_IDDIASI = new RegExp([
  // Ingilizce
  'does\\s+not\\s+(discuss|cover|mention|describe|provide|include|contain|address|present)',
  "doesn'?t\\s+(discuss|cover|mention|describe|provide|include|contain|address)",
  'is\\s+not\\s+(discussed|covered|mentioned|described|addressed|present)',
  'are\\s+not\\s+(discussed|covered|mentioned|described|addressed)',
  'no\\s+mention\\s+of',
  'not\\s+found\\s+in\\s+the\\s+(source|document|text)',
  // Turkce
  // Hem etken hem edilgen: "ele almiyor" / "ele alinmiyor". Ilk yazimda
  // yalnizca edilgen hali vardi ve test etken halini kacirdigimi gosterdi.
  'ele\\s+al([ıi]n)?m[ıi]yor', 'bahsedilmiyor', 'yer\\s+alm[ıi]yor',
  'belirtilmemi[şs]', 'i[çc]ermiyor', 'kapsam[ıi]yor', 'de[ğg]inilmemi[şs]',
].join('|'), 'i')

/* ===========================================================================
   REVIEW KAYNAKTA GECEN ICERIGI SILEMEZ (09.10.2026)

   Review kaynagin bir DILIMINI goruyor (reviewTiers[0] = 11.000 krk;
   ekonometri destesi 13.980). Canli kosuda "Hallucinated claim about
   elasticities and log-linear models" dedi ve ozete bir duzeltme uyguladi —
   log modelleri destenin 36-42. slaytlari, review'in gormedigi kisim. Ozette
   log modellerinden geriye bir sey kalmadi.

   Duzeltmenin isi yanlis bir cumleyi DOGRUSUYLA degistirmek ("replace is
   that sentence corrected"); bir cumleyi silmek degil. Silme bicimindeki
   bir duzeltme (replace, find'in yarisindan kisa), sildigi terimlerin cogu
   kaynakta geciyorsa reddedilir: silinen sey kaynaktaki icerik, uydurma
   degil. Gercek bir uydurmanin silinmesi gecer ("logistic regression"
   kaynakta yok). Idari gurultu (sinav tarihi, devam) kaynakta gecse de
   silinebilir — review'in D maddesi tam olarak bu.
   =========================================================================== */
const DUZELTME_SILME_ORANI = 0.5
const DUZELTME_DAYANAK_ORANI = 0.75
const IDARI_GURULTU_RE = /\b(exam|midterm|final exam|grading|grade[sd]?|attendance|office hours?|syllabus|deadline|textbook|edition|s[ıi]nav|vize|devam zorunlulu|ofis saat)/i

function kaynakIcerigiSiliyor(find: string, replace: string, sourceNorm: string): string | null {
  if (!sourceNorm || sourceNorm.length < 200) return null
  if (replace.length >= find.length * DUZELTME_SILME_ORANI) return null
  if (IDARI_GURULTU_RE.test(find)) return null
  const kalan = new Set(anchorTerms(replace))
  // 5+ harf: "read", "show", "uses" gibi genel fiiller oranda gurultu.
  const silinen = [...new Set(anchorTerms(find))].filter(t => t.length >= 5 && !/^\d+$/.test(t) && !kalan.has(t))
  if (silinen.length < 2) return null
  const kaynakta = silinen.filter(t => sourceNorm.includes(t) || (t.length > 6 && sourceNorm.includes(t.slice(0, 6))))
  if (kaynakta.length / silinen.length < DUZELTME_DAYANAK_ORANI) return null
  return `kaynakta gecen icerigi siliyor (${kaynakta.length}/${silinen.length} terim kaynakta): "${find.slice(0, 60)}..."`
}

function applyCorrections(
  text: string,
  corrections: any,
  sourceText: string = ''
): { text: string; applied: number; skipped: string[] } {
  const skipped: string[] = []
  if (!Array.isArray(corrections) || !text) return { text, applied: 0, skipped }
  let out = text
  let applied = 0
  const sourceNorm = sourceText ? normalizeForIssueMatch(sourceText) : ''

  for (const c of corrections.slice(0, 8)) {
    const find = String(c?.find || '').trim()
    const replace = String(c?.replace ?? '').trim()
    if (find.length < 8 || find === replace) continue

    const silme = kaynakIcerigiSiliyor(find, replace, sourceNorm)
    if (silme) {
      skipped.push(silme)
      continue
    }

    // Review, taslakta olmayan bir YOKLUK iddiasi getiremez: gordugu dilim
    // belgenin tamami degil (bkz. YOKLUK_IDDIASI basligi). Taslak zaten
    // boyle bir ifade tasiyorsa duzeltmesine izin verilir — orada iddiayi
    // URETEN review degil.
    if (YOKLUK_IDDIASI.test(replace) && !YOKLUK_IDDIASI.test(find)) {
      skipped.push(`yokluk iddiasi eklenmeye calisildi: "${replace.slice(0, 70)}..."`)
      continue
    }

    // Exact match first; it must be unambiguous, or we cannot know which
    // occurrence the model meant.
    const occurrences = out.split(find).length - 1
    if (occurrences === 1) {
      out = out.replace(find, replace)
      applied++
      continue
    }
    if (occurrences > 1) {
      skipped.push(`"${find.slice(0, 40)}..." ${occurrences} kez geciyor, hangisi belirsiz`)
      continue
    }

    // Models reflow whitespace when quoting. Retry on a whitespace-normalised
    // view, mapping the hit back to the original text by index.
    const norm = (s: string) => s.replace(/\s+/g, ' ')
    const flatOut = norm(out)
    const flatFind = norm(find)
    if (flatFind.length >= 8 && flatOut.split(flatFind).length - 1 === 1) {
      // Walk the original, counting non-space-collapsed characters, to find
      // the span that corresponds to the normalised match.
      const start = flatOut.indexOf(flatFind)
      let seen = 0
      let from = -1
      let to = -1
      let prevWasSpace = false
      for (let i = 0; i <= out.length; i++) {
        if (seen === start && from === -1) from = i
        if (seen === start + flatFind.length && to === -1) { to = i; break }
        const ch = out[i]
        if (ch === undefined) break
        const isSpace = /\s/.test(ch)
        if (isSpace && prevWasSpace) { continue }
        prevWasSpace = isSpace
        seen++
      }
      if (from >= 0) {
        out = out.slice(0, from) + replace + out.slice(to === -1 ? out.length : to)
        applied++
        continue
      }
    }
    skipped.push(`"${find.slice(0, 40)}..." metinde bulunamadi`)
  }

  return { text: out, applied, skipped }
}

// Inline source citation, e.g. "(s. 12)" / "(slayt 4)" / "(p. 7)".
const INLINE_PAGE_CITE = /\s*\((?:s\.|sayfa|slayt|p\.|page)\s*\d+\)/giu

/**
 * Strip inline page citations that review INTRODUCED.
 *
 * Review is shown a truncated slice of the source (reviewTiers[0] is 4,000
 * chars of an 11,000-char document), so it can only see page markers near the
 * start. Asked for citations, it dutifully produced them — and a live run on
 * 04.10.2026 came back with all ELEVEN markers reading "(s. 1)" for facts
 * drawn from across 30 pages. Confidently wrong provenance is worse than
 * none: a student who turns to page 1 does not find the claim, and stops
 * trusting the citations that ARE right.
 *
 * Citations are computed deterministically downstream by anchorCitations(),
 * which indexes the whole document. The prompt now says not to add them; this
 * is the part that does not depend on the model complying. Markers the DRAFT
 * already had are kept — only ones that appear in review's text and not in
 * the draft's are removed.
 */
function stripIntroducedCitations(draftText: string, reviewText: string): string {
  const draftHas = INLINE_PAGE_CITE.test(String(draftText || ''))
  INLINE_PAGE_CITE.lastIndex = 0
  if (draftHas) return reviewText
  const cleaned = reviewText.replace(INLINE_PAGE_CITE, '')
  INLINE_PAGE_CITE.lastIndex = 0
  return cleaned
}

function mergeReviewOntoDraft(
  draftRaw: string,
  reviewRaw: string,
  sourceText: string = ''
): { merged: string; notes: string[] } {
  const notes: string[] = []
  const parse = (s: string): any => {
    try {
      const stripped = stripThinkBlock(s)
      return JSON.parse(repairLatexEscapes((stripped ?? s).replace(/```json\s*|```/g, '').trim()))
    } catch {
      return null
    }
  }

  const draft = parse(draftRaw)
  const review = parse(reviewRaw)
  if (!draft || typeof draft !== 'object') return { merged: draftRaw, notes: ['taslak okunamadi'] }
  if (!review || typeof review !== 'object') {
    return { merged: draftRaw, notes: ['review JSON okunamadi — taslak korundu'] }
  }

  const out: any = { ...draft }

  // Targeted corrections are the primary path — review cannot fit a rewritten
  // summary in its token budget, so it sends the sentences to change instead.
  // See applyCorrections.
  if (Array.isArray(review.corrections) && review.corrections.length > 0) {
    const draftSummary = String(draft.summary || '')
    const fixed = applyCorrections(draftSummary, review.corrections, sourceText)
    if (fixed.applied > 0) {
      out.summary = fixed.text
      notes.push(`summary: ${fixed.applied} duzeltme uygulandi`)
    }
    for (const s of fixed.skipped) notes.push(`duzeltme atlandi — ${s}`)
    if (fixed.applied === 0 && fixed.skipped.length === 0) {
      notes.push('duzeltme listesi bos geldi')
    }
  }

  // Narrative fields: review's job. Accept a non-trivial rewrite.
  // Still supported for short documents, where the whole summary genuinely
  // fits in the budget and a clean rewrite beats a list of patches.
  for (const field of ['summary', 'summary_executive']) {
    // A summary already corrected above must not then be replaced wholesale.
    if (field === 'summary' && typeof out.summary === 'string'
        && out.summary !== String(draft.summary || '')) continue
    const v = review[field]
    if (typeof v === 'string' && v.trim().length > 40) {
      const draftText = String(draft[field] || '').trim()
      const incoming = v.trim()
      // Measure the floor on what the MODEL returned, before our own citation
      // scrub shortens it. Scrubbing can strip 15-20% from a heavily cited
      // summary, and judging after it would reject a perfectly good rewrite
      // for an edit we made ourselves. The floor is about whether the model
      // compressed the text — see NARRATIVE_MIN_KEEP_RATIO.
      if (draftText.length > 0 && incoming.length < draftText.length * NARRATIVE_MIN_KEEP_RATIO) {
        notes.push(
          `${field} KORUNDU (review ${incoming.length} krk dondu, taslak ${draftText.length} krk)`
        )
        continue
      }
      const scrubbed = stripIntroducedCitations(draftText, incoming).trim()
      if (scrubbed.length < 40) continue
      if (scrubbed !== v.trim()) notes.push(`${field} uydurma (s. N) temizlendi`)
      if (scrubbed !== draftText) notes.push(`${field} guncellendi`)
      out[field] = scrubbed
    }
  }

  // Arrays: only accept when review did not shrink them. Equal length is
  // fine — that is review rewording in place, which is what we want.
  for (const field of REVIEW_ARRAY_FIELDS) {
    const rv = review[field]
    const dv = draft[field]
    if (!Array.isArray(rv)) continue
    const draftLen = Array.isArray(dv) ? dv.length : 0
    /* UZUNLUK YETMEZ, ICERIK DE OLCULMELI (24.10.2026).
     *
     * Tek kosul `rv.length >= draftLen` idi: eleman SAYISI esitse icerik ne
     * olursa olsun kabul ediliyordu. Review kaynagin yalnizca ilk 11.000
     * karakterini goruyor, taslak ise butun belgeyi kapsiyor; 20 maddeyi 20
     * madde olarak geri yazip gormedigi (gec slaytlardan gelen) maddeleri
     * kisaltirsa ya da bosaltirsa birlesme bunu AYNEN kabul ediyordu.
     *
     * Metin alanlarinda ayni karar icin NARRATIVE_MIN_KEEP_RATIO tabani
     * zaten var (bkz. yukarisi); dizilerde hicbir karsiligi yoktu — ayni
     * mantigin iki ayri yazimi. Simdi toplam KARAKTER de ayni tabandan
     * geciyor. maddeMetni sekilden bagimsiz okuyor, yani dizge ve
     * {text}/{point} nesneleri birlikte olculuyor; footnote gibi metin
     * tasimayan alanlarda iki taraf da 0 olur ve kosul etkisiz kalir. */
    const toplamKrk = (a: any[]) => a.reduce((n, x) => n + maddeMetni(x).length, 0)
    const rvKrk = toplamKrk(rv)
    const dvKrk = Array.isArray(dv) ? toplamKrk(dv) : 0
    if (rv.length >= draftLen && (dvKrk === 0 || rvKrk >= dvKrk * NARRATIVE_MIN_KEEP_RATIO)) {
      if (rv.length > draftLen) notes.push(`${field} ${draftLen}→${rv.length}`)
      out[field] = rv
    } else if (rv.length >= draftLen) {
      notes.push(
        `${field} KORUNDU (sayi ayni ama icerik kisaldi: review ${rvKrk} krk, taslak ${dvKrk} krk)`
      )
    } else {
      notes.push(`${field} KORUNDU (review ${rv.length} dondu, taslakta ${draftLen})`)
    }
  }

  // Scalars review may legitimately correct.
  for (const field of ['document_type', 'suggested_course_tag']) {
    if (typeof review[field] === 'string' && review[field].trim()) out[field] = review[field].trim()
  }
  if (typeof review.is_quantitative === 'boolean') out.is_quantitative = review.is_quantitative
  /* OUTLINE HICBIR KONTROLDEN GECMIYORDU (24.10.2026).
     24 maddelik bir anahat 2 maddeye dusebilir ve log bile basilmazdi.
     Dizilerle ayni taban: madde sayisi dortte ucun altina inemez. */
  if (review.outline && typeof review.outline === 'object') {
    const yeniAdet = Array.isArray(review.outline.items) ? review.outline.items.length : 0
    const eskiAdet = Array.isArray(draft?.outline?.items) ? draft.outline.items.length : 0
    if (eskiAdet === 0 || yeniAdet >= eskiAdet * NARRATIVE_MIN_KEEP_RATIO) {
      out.outline = review.outline
    } else {
      notes.push(`outline KORUNDU (review ${yeniAdet} madde dondu, taslakta ${eskiAdet})`)
    }
  }
  if (review.quality_gate && typeof review.quality_gate === 'object') {
    out.quality_gate = review.quality_gate
    // Log the verdict, always. Without it "degisiklik yok" is ambiguous in
    // exactly the way that matters: it cannot distinguish review reading the
    // draft and finding it sound from review returning an empty list because
    // that is the cheapest answer. The verdict plus the issue count says
    // which — a pass with issues listed is a review that engaged; a bare pass
    // with nothing to say, run after run, is one to be suspicious of.
    const g = review.quality_gate
    const issues = Array.isArray(g.issues) ? g.issues : []
    notes.push(
      `quality_gate: pass=${g.pass !== false}, grounded=${!!g.grounded}, ` +
      `${issues.length} sorun${issues.length ? ': ' + issues.map((i: any) => String(i).slice(0, 60)).join(' / ') : ''}`
    )
  } else {
    notes.push('quality_gate GELMEDI — review beklenen bicimde cevap vermemis')
  }

  return { merged: JSON.stringify(out), notes }
}

function roundRobinInterleave<T>(lists: T[][]): T[] {
  const out: T[] = []
  let idx = 0
  let anyLeft = true
  while (anyLeft) {
    anyLeft = false
    for (const list of lists) {
      if (idx < list.length) {
        out.push(list[idx])
        anyLeft = true
      }
    }
    idx++
  }
  return out
}

// (remapChunkFootnotes was removed on 2026-10-03: it renumbered footnotes
// per-chunk with an offset, which only made sense while each chunk produced
// its own footnotes. Citations are now derived centrally in
// anchorCitations() from the page index, so a single dense renumbering
// there replaces it. applyFootnoteRemap below is still used — by that
// function and by the summary remap at the call site.)

function applyFootnoteRemap(text: string, idMap: Record<number, number>): string {
  if (!text) return text
  return text.replace(/\[(\d+)\]/g, (match, idStr) => {
    const oldId = parseInt(idStr, 10)
    const newId = idMap[oldId]
    return newId != null ? `[${newId}]` : match
  })
}

// Shared instruction text telling the model how to populate the new
// footnotes[].page field — either real page/slide numbers copied from the
// "--- SAYFA N ---" / "--- SLAYT N ---" markers inserted during extraction
// (see PDF/PPTX extraction above), or null with the old topic/heading
// description when no such markers exist for this document (DOCX/plain text,
// which have no reliable fixed-page concept).
/* ===========================================================================
   SLAYT DESTESI TESPITI
   ===========================================================================
   07.10.2026, bir ekonometri ders notu ozetine gelen geri bildirim uzerine:
   "ders slaytlari daha ozet gibi kaldi", "slayt slayt degil de hangi slayt
   gerekli hangisi gereksiz iyi analiz etmeli".

   Dogru teshis: bir deste duz metinden FARKLI bir is istiyor. Bir slaytta
   "Heteroskedastisite -> OLS etkin degil" yazar. Bunu OZETLEMEK geriye
   hicbir sey birakmaz; ogrencinin ihtiyaci olan sey tersi, ACMAK. Ustelik
   destenin metninin onemli bir kismi yapisal gurultu: baslik slayti,
   ajanda, bolum ayraci, "Sorular?", tekrarlayan altbilgi.

   Boru hatti bunu ZATEN biliyordu, ama GEC: document_type siniflandirmasi
   ("Lecture Notes/Slides" secenegi dahil) SENTEZ adiminda, yani butun
   pencereler cikarildiktan SONRA yapiliyor. Sistem destenin deste oldugunu,
   ona duz metin muamelesi yapmayi bitirdikten sonra ogreniyordu.

   Oysa sinyal en bastan elde. Iki yoldan:
     - pptx: KESIN. mime type zaten biliniyor ve isaretler "SLAYT".
     - PDF: ogrenciler slaytlari cogu zaman PDF olarak disa aktariyor ve o
       zaman etiket "SAYFA" oluyor. Burada icerikten taninir: deste
       sayfalari KISA olur.

   ESIK OLCULMUS DEGIL — ve bu kodda yaziyor diye gercek olmuyor. Bir ders
   slayti tipik olarak 30-80 kelime (~200-600 karakter), bir kitap/makale
   sayfasi 2.000-4.000 karakter tasir; aradaki bosluk genis, 800 oraya
   muhafazakar bicimde oturuyor. Sayfa alt siniri, iki sayfalik bir belgenin
   yanlis siniflandirilmamasi icin. Karar HER CALISMADA sayilariyla
   loglanir; ilk gercek deste bu esigin dogru olup olmadigini soyleyecek.
   =========================================================================== */
const DECK_MIN_PAGES = 8
const DECK_MAX_CHARS_PER_PAGE = 800

/**
 * Uzun-belge yolunda ders etiketi — KATALOGDAN, KESIN ESLESMEYLE (25.10.2026).
 *
 * Uzun-belge (pencereli) yolunda tum-belge sentezi yok, yani modelin
 * suggested_course_tag secimi hic yapilmiyordu ve alan sabit `null` idi;
 * document_type da her belge icin sabit 'Lecture Notes/Slides'. Kart, kitap
 * bolumune "ders slayti" diyordu.
 *
 * Model cagrisi yok: ogrencinin bolum katalogundaki ("KOD — ad" satirlari)
 * kodlardan TAM OLARAK BIRI metinde geciyorsa o kod donuyor ("BUS330" ve
 * "BUS 330" ayni sayilir). Hic biri ya da birden fazlasi geciyorsa null —
 * yanlis ders etiketi, etiketsizlikten kotudur. Katalog yoksa da null.
 */
function katalogdanDersEtiketi(courseCatalogBlock: string, metin: string): string | null {
  const kodlar = String(courseCatalogBlock || '').split('\n')
    .map((satir) => satir.split(' — ')[0].trim())
    .filter((kod) => /^[A-Za-zÇĞİÖŞÜçğıöşü]{2,6}\s?\d{2,4}[A-Za-z]?$/.test(kod))
  if (!kodlar.length || !metin) return null
  const bulunan = new Set<string>()
  for (const kod of kodlar) {
    const m = kod.match(/^(\D+?)\s?(\d.*)$/)
    if (!m) continue
    const kalip = new RegExp(`(^|[^\\p{L}\\p{N}])${m[1]}\\s?${m[2]}(?![\\p{L}\\p{N}])`, 'iu')
    if (kalip.test(metin)) bulunan.add(kod)
  }
  return bulunan.size === 1 ? [...bulunan][0] : null
}

function detectSlideDeck(
  text: string,
  pageMarkerLabel: string
): { isDeck: boolean; pages: number; charsPerPage: number; reason: string } {
  const sayi = (text.match(new RegExp(`---\\s*${pageMarkerLabel}\\s+\\d+\\s*---`, 'g')) || []).length
  const basina = sayi > 0 ? Math.round(text.length / sayi) : 0

  // pptx: tartisma yok, dosyanin kendisi deste.
  if (pageMarkerLabel === "SLAYT") {
    return { isDeck: true, pages: sayi, charsPerPage: basina, reason: 'pptx' }
  }
  if (sayi < DECK_MIN_PAGES) {
    return { isDeck: false, pages: sayi, charsPerPage: basina, reason: `sayfa az (${sayi})` }
  }
  if (basina <= DECK_MAX_CHARS_PER_PAGE) {
    return { isDeck: true, pages: sayi, charsPerPage: basina, reason: `seyrek sayfa (${basina} krk)` }
  }
  return { isDeck: false, pages: sayi, charsPerPage: basina, reason: `yogun sayfa (${basina} krk)` }
}

/**
 * Deste icin cikarim talimati. Duz metinde BOS doner — tek karakter maliyeti yok.
 *
 * KISA TUTULMASI ZORUNLU. Canli pencere cagrisinin butcesi dar:
 *   WINDOW/4 (metin) + prompt + 3072 (completion) <= 7200 (8000 TPM * 0.9)
 * WINDOW=13000 iken pay yalnizca ~351 token. Ilk yazim ~425 tokendi ve
 * tavani asacakti — bu projede tam bu tur tasma daha once pencere
 * kaybettirdi. Blok sikistirildi ve maliyeti DECK_PROMPT_CHARS olarak
 * pencere butcesinden dusuluyor, boylece tavan aritmetigi aynen korunuyor.
 */
function buildSlideDeckInstruction(isDeck: boolean, unitWord: string): string {
  if (!isDeck) return ''
  const U = unitWord
  return `
DECK MODE (lecture ${U}s, not prose):
- EXPAND, don't compress: ${U} text is telegraphic; summarising it leaves nothing. Say what each fragment MEANS in full sentences — output for a content ${U} is normally LONGER than it.
- JUDGE ${U}s: skip title, agenda, dividers, "Sorular?"/"Questions?", references, ${U}s restating their title. GROUP the rest by topic — never "${U} 1 covers…".
- FORMULAS/TABLES/NUMBERS ARE THE LESSON: copy each formula, name every variable; keep each estimated value with its unit and significance level.`
}
/* UCUNCU MADDE NEDEN SAYILARI SOYLUYOR (09.10.2026).
   Ekonometri destesinin alti ampirik sonucunun ALTISI DA metinde var —
   "0.026 ... 2.6%", "50.5% higher", ".69%", "484.12 - 12.08 temp" — gorsel
   gerektirmiyor. Yine de dort canli ozet bunlarin en fazla 3'unu tasidi,
   sonuncusu 0'ini. Eski madde formul ve tablo istiyordu, sayiyi istemiyordu;
   model "log-dogrusal modelde egim yuzde degisim olarak yorumlanir" yazip
   0.026'yi atiyordu. Ders bu sayidir.
   Ayni 549 krk payina sigdirildi: "(spoken explanation is gone)" ve "say what
   it computes" cikti — ikincisini birinci maddenin "Say what each fragment
   MEANS" kurali zaten karsiliyor. */

/* Talimatin pencere butcesinden dustugu karakter payi.
   BU SAYIYI OLCUM SECTI, BEN DEGIL. Canli referans: 30 sayfalik bir ders
   destesinden cikan 12.451 karakter. O belge iki pencereye bolundugunde
   araya ~60 sn pacer beklemesi giriyor, PIPELINE_BUDGET_MS (110 sn)
   tukeniyor ve review pass hic calismiyor — olculmus, tahmin degil
   (bkz. tests/summary-quality.js, "tipik tek bolumluk belge tek pencereye
   sigar"). Dolayisiyla deste penceresi 12.451'in altina DUSEMEZ:
     13000 - 12451 = 549
   Talimat bu paya sigacak sekilde yazildi; pay buyutulemez, talimat
   kisaltilir. Ilk yazim 1.077 karakterdi ve tam o referans belgeyi
   bolecekti — yani kuralin yazilmasina sebep olan belge tipini. */
const DECK_PROMPT_CHARS = 549

function buildFootnotePageInstruction(hasPageMarkers: boolean, pageMarkerLabel: string): string {
  if (hasPageMarkers) {
    const unitWord = pageMarkerLabel === "SLAYT" ? "slide" : "page"
    return `The source text contains markers in the form "--- ${pageMarkerLabel} N ---" marking where each ${unitWord} begins. For every footnote, set "page" to the N of the marker that appears immediately BEFORE the claim in the source text — this must be a real number copied from an actual marker you saw, never guessed or estimated. Still also write a short "reference" description as before (e.g. 'Introduction section').`
  }
  return `This document has no page/slide markers available, so set "page" to null for every footnote and continue describing the topical section or heading area in "reference" as before.`
}

// ==========================================================================
// DETERMINISTIC PAGE ANCHORING (citations without spending model tokens)
//
// Why this exists, and why it is NOT another prompt instruction:
//
//   The long-document path used to ship `footnotes: []` hardcoded — long
//   documents got no citations at all. The obvious fix (add a "footnotes"
//   field to compactWindowPrompt's JSON schema and ask the model for them)
//   is the SAME mistake that was already made and correctly reverted for
//   concept_graph (see the merge block below): every extra schema field
//   competes for the same `maxCompletionTokens` budget, so the model pays
//   for citations by returning fewer key terms/points — and on an account
//   whose observed tokens-per-minute cap is as low as 8,000, extra output
//   tokens also push window calls into 429 territory.
//
//   Worse, a model-reported page number is unverifiable: nothing checked
//   that the page it named actually contains the claim. A footnote that
//   jumps the PDF viewer to the wrong page is worse than no footnote,
//   because the student stops trusting every citation on the card.
//
//   So citations are COMPUTED here instead, from text we already have:
//   the "--- SAYFA N ---" / "--- SLAYT N ---" markers inserted at
//   extraction time give us a page->text index, and each claim is matched
//   against that index by inverse-page-frequency-weighted term overlap.
//   Cost: zero extra model tokens, zero extra API calls. A page number
//   produced this way is one where the claim's distinctive vocabulary
//   demonstrably appears, so "page 7" means page 7 really discusses it.
//
//   The same index also VALIDATES the short/fast path's model-produced
//   footnote pages, which were previously trusted blind.
// ==========================================================================

// Terms this common carry no signal about WHICH page a claim came from.
const ANCHOR_STOPWORDS = new Set([
  // Turkish
  'ancak', 'ayrıca', 'bunun', 'burada', 'çünkü', 'daha', 'değil', 'diğer', 'fakat',
  'gibi', 'göre', 'için', 'ile', 'olan', 'olarak', 'olduğu', 'olur', 'sonra', 'şekilde',
  'bütün', 'böyle', 'kadar', 'sadece', 'tüm', 'üzerinde', 'vardır', 'veya', 'yani',
  'bazı', 'birlikte', 'eğer', 'hem', 'ise', 'yine', 'çok', 'önemli', 'bölüm', 'konu',
  // English
  'about', 'after', 'also', 'because', 'been', 'between', 'both', 'does', 'each',
  'from', 'have', 'however', 'into', 'more', 'most', 'other', 'should', 'such',
  'than', 'that', 'their', 'then', 'there', 'these', 'this', 'those', 'through',
  'under', 'when', 'where', 'which', 'while', 'will', 'with', 'would', 'they',
  'important', 'section', 'chapter', 'example', 'following'
])

/** Content-bearing terms of a string: >=4 chars, not a stopword, diacritics kept. */
/* BUYUK "I" KELIMEYI IKIYE BOLUYORDU (24.10.2026).
 *
 * JavaScript'te 'İ'.toLowerCase() iki kod birimi uretiyor: 'i' + U+0307
 * (birlesen ustteki nokta). U+0307 bir birlesme isareti oldugu icin
 * \p{L} ve \p{N} kumelerine girmiyor, dolayisiyla asagidaki noktalama
 * temizligi onu BOSLUGA cevirip kelimeyi ikiye boluyordu. Olculdu:
 *
 *   gateNormalize('İşsizlik Oranı') -> "i şsizlik oranı"
 *   anchorTerms('İstatistik')       -> ["statistik"]   (bastaki 'i' 4
 *                                      harf esigine takilip dusuyor)
 *   anchorTerms('istatistik')       -> ["istatistik"]
 *
 * Sonuc: model terimi baslik bicimiyle (İ ile), kaynak cumle icinde kucuk
 * harfle yazdiginda — ya da tersi — grounding kapisi terimi "uydurma"
 * sayip siliyor, atif eslemesi de sayfa capasini kaybediyordu. Turkce bir
 * urunde bu, kaynakta BIREBIR gecen icerigi silmek demek.
 *
 * Duzeltme once NFC ile birlestirip sonra kalan birlesen noktayi atiyor,
 * yani 'İ' -> 'i'. Eslesme orani yalnizca YUKARI gidebilir: hicbir yeni
 * eslesme uydurma bir terimi geciremez, cunku iki taraf da ayni
 * fonksiyondan geciyor. Bu yuzden esiklerin kalibrasyonu degismiyor. */
function trNormalize(s: string): string {
  return String(s == null ? '' : s).normalize('NFC').toLowerCase().replace(/̇/g, '')
}

/* ONDALIK SAYI KORLUGU (25.10.2026).
 *
 * Noktalama temizligi "9.3"u "9" ve "3"e boluyordu, ikisi de 4 harf
 * esigine takilip dusuyordu: "%9.3", "0.21", "1,96" gibi degerler hicbir
 * karsilastirmaya girmiyordu. Bir ekonometri destesinde iddiayi sayfasina
 * baglayan en ayirt edici sey cogu zaman tam olarak bu sayi; kosu 37'de
 * atifsiz kalan madde sayisi 8-16 idi.
 *
 * Artik ondalik sayi TEK terim ("9,3" -> "9.3"; Turkce virgul de ayni
 * terime iner). Kisa tamsayilar hala disarida: "3", "20" sayfa ve madde
 * numarasi gurultusu. 4+ haneli tamsayilar (1982) zaten geciyordu.
 *
 * Kesinlik yonu: belgede bulunan bir ondalik dogru sayfaya agirlik ekler
 * (idf'i yuksek, ayirt edici); belgede HIC bulunmayan bir ondalik
 * (modelin hesapladigi bir deger) iddianin toplam agirligini buyutup
 * skoru DUSURUR — yani yeni bir yanlis atif uretemez, ancak atifi daha
 * temkinli yapar ("yanlis atif, eksik atiftan kotudur"). */
/* UC HARFLI MATEMATIK ADLARI ELENIYORDU (30.10.2026 olcumu).
 *
 * "Week 8 Derivative" kartinda bes madde atifsiz kaldi. Ikisinin sebebi
 * esik DEGIL, terim cikarimiydi:
 *   "The derivative of sin x is cos x."     -> cikan terim: derivative
 *   "The derivative of tan x is sec^2 x."   -> cikan terim: derivative, sec²
 * Yani cumlenin en bilgilendirici sozcukleri (sin, cos, tan) kayboluyor ve
 * geriye tek terim kaliyor; ANCHOR_MIN_TERMS (3) kapisi maddeyi dusuruyor.
 * Sebep asagidaki uzunluk suzgeci: trigonometrik ve logaritmik fonksiyon
 * adlari TAM UC HARF.
 *
 * Esigi dusurmek cozum degildi, olculdu: "When f'(x) > 0, the function f is
 * increasing." maddesinde terimler (function, increasing) hicbir sayfada
 * BIRLIKTE gecmiyor, yani eslesen terim sayisi her halde 1 — taban 2'ye
 * inse de baglanmaz. O madde kaynakta tamamen NOTASYONLA yazili
 * ("f'(x) > 0 → f is increasing") ve sozcuk duzeyinde eslesmenin
 * ulasamayacagi yerde; bilerek atifsiz kaliyor.
 *
 * Kisa ad listesi BELGEYE OZGU DEGIL: evrensel matematik gosterimi. Hicbiri
 * ANCHOR_STOPWORDS'te degil (kontrol edildi). "sec"/"min"/"var" gunluk
 * dilde baska anlam tasiyor ama bu listenin acildigi yer ders metni; iki
 * teknik anlam arasindaki karisma kabul, bilgiyi tamamen atmak degil.
 *
 * UST SIMGE SOYULUYOR: "sec²" tek jeton olarak geliyordu ve kaynaktaki
 * "sec" ile eslesmiyordu. Sondaki ust simge rakamlari atilinca hem listeye
 * giriyor hem kaynagi buluyor. */
const ANCHOR_KISA_MATEMATIK = new Set([
  // trigonometri
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  // logaritma / us
  'log', 'exp',
  // limit ve ucdegerler
  'lim', 'max', 'min',
  // dogrusal cebir ve istatistik
  'det', 'dim', 'var', 'cov'
])

/** Sondaki ust simge rakamlari: "sec²" -> "sec", "x³" -> "x". */
const ANCHOR_UST_SIMGE = /[\u00b2\u00b3\u00b9\u2070\u2074-\u2079]+$/

function anchorTerms(s: string): string[] {
  const parcalar = trNormalize(s).match(/\d+(?:[.,]\d+)+|[\p{L}\p{N}]+/gu) || []
  return parcalar
    .map(w => /^\d+(?:[.,]\d+)+$/.test(w) ? w.replace(/,/g, '.') : w.replace(ANCHOR_UST_SIMGE, ''))
    .filter(w =>
      (w.length >= 4 || /^\d+\.\d+/.test(w) || ANCHOR_KISA_MATEMATIK.has(w)) &&
      !ANCHOR_STOPWORDS.has(w))
}

type PageSegment = { page: number; terms: Set<string>; head: string; body: string; termsTekil?: Set<string> }

// Abbreviations whose trailing dot must NOT end a sentence. Without this a
// Turkish academic page splits at "s. 42", "vb.", "Prof. Dr." and the quote
// shown to the student becomes a two-word fragment.
const SENTENCE_ABBREV = new Set([
  's', 'ss', 'vb', 'vs', 'bkz', 'örn', 'orn', 'age', 'agm', 'yy', 'bkz',
  'dr', 'doç', 'doc', 'prof', 'yrd', 'arş', 'ars', 'gör', 'gor', 'no', 'nr',
  'yay', 'çev', 'cev', 'ed', 'vol', 'pp', 'fig', 'eq', 'etc', 'al'
])

/**
 * Split prose into sentences, conservatively. Over-merging two sentences is
 * harmless here (the quote is simply a little longer); splitting mid-sentence
 * is not, because the fragment is shown to the student as the source text.
 */
function splitSentences(text: string): string[] {
  const rough = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…])\s+/)
  const out: string[] = []
  for (const piece of rough) {
    const prevNeedsMerge = out.length > 0 && (() => {
      const prev = out[out.length - 1]
      const lastWord = (prev.match(/([\p{L}\p{N}]+)\.$/u) || [])[1]
      if (!lastWord) return false
      // "...vb." / "...s." / a bare initial like "A." / a list number "3."
      return SENTENCE_ABBREV.has(lastWord.toLowerCase())
        || lastWord.length <= 2
        || /^\d+$/.test(lastWord)
    })()
    if (prevNeedsMerge) out[out.length - 1] += ' ' + piece
    else out.push(piece)
  }
  return out.map(s => s.trim()).filter(s => s.length > 0)
}

/* ALINTI OCR COPUYLE BIRLIKTE GELIYORDU (30.10.2026 olcumu).
 *
 * "Week 8 Derivative" kartinin kaynakcasinda 12 referansin 9'u bu haldeydi:
 *   [4] （ょり＝なな、 -62-3-32-1/2 Key idea Power rule: the exponent moves
 *       down, then decreases by one.
 *   [5] + 1) = 9x2 - 10x + 3 g' (x) = 3x2 sin x + ... ANSWER Key idea A
 *       product-rule derivative has two terms before simplification.
 * Ogrenci atifa bakinca kaynagin ne dedigini degil OCR'in artigini goruyor.
 *
 * SEBEP: kaynak metinde cop ile temiz cumle AYRI SATIRLARDA.
 *   （ょり＝なな、
 *   -62-3-32-1/2
 *   Key idea
 *   Power rule: the exponent moves down, then
 *   decreases by one.
 * Ama splitSentences ilk isi olarak \s+ -> bosluk yapiyor, yani satir
 * sonlarini SILIYOR ve noktalama tasimayan OCR satirlari tek bir "cumle"
 * halinde birlesiyor. Yani kusur alinti secmede degil, aday uretmede.
 *
 * COZUM: satirlari once METNE GORE birlestir, sonra cumlelere bol. Bir satir
 * sonu SARMA sayilir (birlestirilir) ancak onceki satir cumle noktalamasiyla
 * bitmiyorsa VE sonraki satir kucuk harfle basliyorsa (ya da onceki satir
 * tire ile bolunmusse). Aksi halde sinirdir.
 *
 * OLCUM: 9 bozuk referansin 9'u temiz kaynak cumlesine dondu ve sarmalanmis
 * cumleler dogru birlesti ("...the exponent moves down, then" + "decreases
 * by one." ; "Critical candidates occur where f'(x)=0 or f'(x)" + "is
 * undefined, as long as the original function is" + "defined there.").
 *
 * BILINEN SINIR, BILEREK KABUL: devami BUYUK harfle baslayan bir sarma
 * yanlis bolunur. Iki gercek belgede olculdu — ders kitabindaki
 * "...included in the U.S. ________ and in the" / "Japanese ________." ve
 * slayttaki "...with Respect to The Nature of The" / "Transaction". Ikisi de
 * BASLIK/bosluk-doldurma satiri, yani zaten zayif alinti adaylari:
 * bestQuoteForClaim en az 2 eslesen terim ve 0,3 skor istiyor, eksik parca
 * tam cumleye kaybeder.
 *
 * DENENEN ALTERNATIF REDDEDILDI: "onceki satir uzun ve harf agirlikliysa
 * sarmadir" kurali olculdu; basligi duzeltiyor ama iki AYRI basligi
 * ("...known as TRADE RECEIVABLES" + "Receivables and Types of Receivables")
 * birlestiriyor ve bosluk-doldurma satirini alt cizgiler harf oranini
 * dusurdugu icin yine kaciriyor. Bir hata sinifini baskasiyla takas ediyor,
 * net kazanc yok. */
function alintiBloklari(body: string): string[] {
  const satirlar = String(body || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  const out: string[] = []
  for (const satir of satirlar) {
    if (out.length === 0) { out.push(satir); continue }
    const onceki = out[out.length - 1]
    const noktalamaylaBitti = /[.!?\u2026:]$/.test(onceki)
    const tireyleBolundu = /[-\u2010-\u2015]$/.test(onceki)
    const kucukBasliyor = /^[a-z\u00e0-\u00f6\u00f8-\u00ff\u011f\u015f\u0131\u00f6\u00e7\u00fc]/.test(satir)
    if (tireyleBolundu) {
      out[out.length - 1] = onceki.replace(/[-\u2010-\u2015]$/, '') + satir
    } else if (!noktalamaylaBitti && kucukBasliyor) {
      out[out.length - 1] = onceki + ' ' + satir
    } else {
      out.push(satir)
    }
  }
  return out
}

// A quote shorter than this carries no context; longer than this is a wall of
// text in a tooltip.
const QUOTE_MIN_CHARS = 25
const QUOTE_MAX_CHARS = 220

/**
 * The sentence on this page that best supports the claim, returned VERBATIM
 * so it can be checked against the source. This is what turns "page 7" into
 * "page 7 says this", which is the whole difference between a citation a
 * student trusts and one they learn to ignore.
 *
 * Returns null when no sentence matches well enough; the caller then falls
 * back to the page's heading line.
 */
function bestQuoteForClaim(claim: string, body: string, idf: Map<string, number>, tekil = false): string | null {
  const claimTerms = [...new Set(anchorTerms(claim))]
  if (!claimTerms.length) return null
  const fallbackIdf = Math.log(2)
  /* AGIRLIK ESLESEN BICIMDEN OKUNUR. idf tablosu sayfa terimlerinden
     kurulu, yani TEKIL bicimi tasiyor; "products" ile eslesen sey
     "product". Agirligi cogul bicimle aramak `?? 0` dondurup eslesmeyi
     skora HIC yansitmiyordu (olculdu: eslesen terim sayisi artti, skor
     ayni kaldi, madde yine atifsiz). */
  const agirlik = (t: string) => idf.get(t) ?? (tekil ? idf.get(ingTekil(t)) : undefined) ?? fallbackIdf
  const totalWeight = claimTerms.reduce((a, t) => a + agirlik(t), 0)
  if (totalWeight <= 0) return null

  let best: { text: string; score: number } | null = null
  /* Adaylar SATIR YAPISINA saygi gostererek uretiliyor — bkz.
     alintiBloklari yanindaki olcum notu. Dogrudan splitSentences(body)
     cagrilirsa OCR'in cop satirlari temiz cumleye yapisik geliyor. */
  const adaylar = alintiBloklari(body).flatMap((blok) => splitSentences(blok))
  for (const raw of adaylar) {
    if (raw.length < QUOTE_MIN_CHARS) continue
    const hamTerms = new Set(anchorTerms(raw))
    if (!hamTerms.size) continue
    // Cogul eki — bkz. ingTekil. Yalnizca Ingilizce kartta aciliyor.
    const sentTerms = tekil ? tekilKume(hamTerms) : hamTerms
    let w = 0, matched = 0
    for (const t of claimTerms) {
      if (sentTerms.has(t) || (tekil && sentTerms.has(ingTekil(t)))) { w += agirlik(t); matched++ }
    }
    if (matched < 2) continue
    // Normalising by the claim's own weight (not the sentence's) keeps a long
    // rambling sentence from winning just by containing more words.
    const score = w / totalWeight
    if (!best || score > best.score) best = { text: raw, score }
  }
  if (!best || best.score < 0.3) return null
  return best.text.length > QUOTE_MAX_CHARS
    ? best.text.slice(0, QUOTE_MAX_CHARS).replace(/\s+\S*$/, '') + '…'
    : best.text
}

// ==========================================================================
// REPEATED BOILERPLATE — the running header/footer tax
//
// A lecture deck or a textbook chapter repeats the same line on every page:
// a copyright notice, a course code, a running title, a page number. The
// model pays for every copy. Measured on a 30-page deck: "Copyright © 2017
// Pearson Education, Inc." plus its "20-1 / 20-2 / ..." page number came to
// ~1,700 of 12,451 characters — 13% of everything the model was shown, none
// of it study material, on a budget where one window is already 6,200 of the
// account's 8,000 tokens per minute.
//
// Detection is positional, not a pattern list: a line is boilerplate when it
// is SHORT and appears on MOST pages. Nothing about copyright or Pearson is
// hardcoded, so it generalises to whatever a given course's deck repeats.
//
// Three guards keep it from eating content:
//   - documents with too few pages are left alone (no basis to judge)
//   - only short lines qualify; a repeated paragraph is not a running header
//   - digits are wildcarded for COUNTING only ("20-1" and "20-2" are the same
//     footer), never for matching anything else
const BOILERPLATE_MIN_PAGES = 5
const BOILERPLATE_PAGE_SHARE = 0.6
const BOILERPLATE_MAX_LINE_CHARS = 120

function boilerplateKey(line: string): string {
  return line
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripRepeatedBoilerplate(
  text: string,
  pageMarkerLabel: string
): { text: string; removed: string[]; charsSaved: number } {
  const pages = splitByPageMarkers(text, pageMarkerLabel)
  // One segment with page === null means the document has no page markers at
  // all (DOCX / plain text) — there is nothing to compare across.
  if (pages.length < BOILERPLATE_MIN_PAGES || pages[0]?.page === null) {
    return { text, removed: [], charsSaved: 0 }
  }

  // How many distinct pages carry each short line?
  const pageCount = new Map<string, number>()
  const sample = new Map<string, string>()
  for (const p of pages) {
    const seen = new Set<string>()
    for (const raw of p.body.split('\n')) {
      const line = raw.trim()
      if (!line || line.length > BOILERPLATE_MAX_LINE_CHARS) continue
      const key = boilerplateKey(line)
      if (!key || seen.has(key)) continue
      seen.add(key)
      pageCount.set(key, (pageCount.get(key) || 0) + 1)
      if (!sample.has(key)) sample.set(key, line)
    }
  }

  const threshold = Math.ceil(pages.length * BOILERPLATE_PAGE_SHARE)
  const boilerplate = new Set(
    [...pageCount.entries()].filter(([, n]) => n >= threshold).map(([k]) => k)
  )
  if (boilerplate.size === 0) return { text, removed: [], charsSaved: 0 }

  const rebuilt = pages.map(p => {
    const kept = p.body.split('\n').filter(raw => {
      const line = raw.trim()
      if (!line || line.length > BOILERPLATE_MAX_LINE_CHARS) return true
      return !boilerplate.has(boilerplateKey(line))
    })
    // Never blank a page out entirely: a page whose every line looks repeated
    // is more likely a detector mistake than a genuinely empty page, and an
    // empty page breaks the citation anchor for anything that cites it.
    const body = kept.join('\n').trim() ? kept.join('\n') : p.body
    return `--- ${pageMarkerLabel} ${p.page} ---\n${body.replace(/^\n+/, '')}`
  }).join('\n\n')

  const out = rebuilt.replace(/\n{3,}/g, '\n\n').trim()
  return {
    text: out,
    removed: [...boilerplate].map(k => sample.get(k) || k),
    charsSaved: text.length - out.length
  }
}

/**
 * Split extracted text on its "--- SAYFA N ---" / "--- SLAYT N ---" marker
 * lines into one segment per page, keeping each page's raw body.
 *
 * When the document carries no markers at all (DOCX / plain text) this
 * returns a single segment with page === null rather than an empty list:
 * such a document still has text worth chunking, it just has no page
 * concept. Callers that specifically need page numbers (buildPageIndex)
 * discard that null-page case themselves.
 */
function splitByPageMarkers(
  text: string,
  pageMarkerLabel: string
): Array<{ page: number | null; body: string }> {
  if (!text || !text.trim()) return []
  const re = new RegExp(`---\\s*${pageMarkerLabel}\\s+(\\d+)\\s*---`, 'g')
  const hits: Array<{ page: number; start: number; end: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    hits.push({ page: parseInt(m[1], 10), start: m.index, end: m.index + m[0].length })
  }
  if (hits.length === 0) return [{ page: null, body: text }]
  const out: Array<{ page: number | null; body: string }> = []
  for (let i = 0; i < hits.length; i++) {
    out.push({
      page: hits[i].page,
      body: text.slice(hits[i].end, i + 1 < hits.length ? hits[i + 1].start : text.length)
    })
  }
  return out
}

/**
 * Page index for citation anchoring. Returns [] when the document has no
 * page markers, which correctly disables anchoring rather than inventing
 * page numbers for a format that has no pages.
 */
function buildPageIndex(text: string, pageMarkerLabel: string): PageSegment[] {
  const segments: PageSegment[] = []
  for (const seg of splitByPageMarkers(text, pageMarkerLabel)) {
    if (seg.page === null) return []   // no page concept for this document
    const trimmed = seg.body.trim()
    if (!trimmed) continue
    segments.push({
      page: seg.page,
      terms: new Set(anchorTerms(trimmed)),
      // First non-empty line is the fallback "reference" label when no
      // sentence on the page matches the claim well enough to quote.
      head: (trimmed.split('\n').map(l => l.trim()).find(l => l.length > 3) || '').slice(0, 70),
      body: trimmed
    })
  }
  return segments
}

// ==========================================================================
// CHUNK PERSISTENCE (document_chunks)
//
// The extracted text used to be thrown away when this function returned, so
// chat-with-document re-downloaded and re-parsed the same file on every
// single message. Persisting it once here ends that, and gives every future
// feature a stable, addressable unit of the document to point at.
//
// Chunk size is deliberately NOT the extraction window size (WINDOW, further
// down): windows are sized by the model's token budget, chunks by how
// precisely we want to address a passage. The two move independently — do not
// re-couple them. See the migration for the full rationale.
// ==========================================================================
const CHUNK_STORE_SIZE = 1200

type StorableChunk = {
  chunk_index: number
  page_start: number | null
  page_end: number | null
  text: string
  char_count: number
}

/**
 * Paragraph-aware chunks that never span a page boundary, so page_start /
 * page_end genuinely identify where a passage came from. Several short
 * consecutive pages (slides, for instance) may share one chunk, in which
 * case the range covers them; a long page is split into several chunks that
 * each carry that one page number.
 */
function buildStorableChunks(text: string, pageMarkerLabel: string): StorableChunk[] {
  const out: StorableChunk[] = []
  let buf: string[] = []
  let bufLen = 0
  let bufFirstPage: number | null = null
  let bufLastPage: number | null = null

  const flush = () => {
    if (!buf.length) return
    const joined = buf.join('\n\n').trim()
    if (joined) {
      out.push({
        chunk_index: out.length,
        page_start: bufFirstPage,
        page_end: bufLastPage,
        text: joined,
        char_count: joined.length
      })
    }
    buf = []; bufLen = 0; bufFirstPage = null; bufLastPage = null
  }

  for (const seg of splitByPageMarkers(text, pageMarkerLabel)) {
    const body = seg.body.trim()
    if (!body) continue
    const pieces = splitIntoChunks(body, CHUNK_STORE_SIZE)

    if (pieces.length > 1) {
      // A long page: emit its pieces on their own so each keeps this exact
      // page number rather than being blended with a neighbouring page.
      flush()
      for (const piece of pieces) {
        const t = piece.trim()
        if (!t) continue
        out.push({
          chunk_index: out.length,
          page_start: seg.page,
          page_end: seg.page,
          text: t,
          char_count: t.length
        })
      }
      continue
    }

    // A short page: accumulate with following short pages up to the target.
    const piece = pieces[0]?.trim()
    if (!piece) continue
    if (bufLen > 0 && bufLen + piece.length + 2 > CHUNK_STORE_SIZE) flush()
    if (!buf.length) bufFirstPage = seg.page
    bufLastPage = seg.page
    buf.push(piece)
    bufLen += piece.length + 2
  }
  flush()
  return out
}

/**
 * Best-effort write. A failure here must never fail the summarization job:
 * the student's study card is the product, stored chunks are an optimisation
 * and a foundation for later features. Existing rows are deleted first so a
 * re-processed document replaces its chunks instead of accumulating stale
 * ones (and so a shorter re-extraction cannot leave orphan tail chunks).
 */
/* POSTGRES NUL VE ESI OLMAYAN VEKIL KARAKTERI KABUL ETMIYOR (29.10.2026).
 *
 * "Chp8 - Conformity" kosusunda chunk yazimi TAMAMEN dustu:
 *   document_chunks: insert failed at 0: unsupported Unicode escape sequence
 * 78 sayfalik belge icin "Kaynakla calis" ve belge sohbeti bos kaldi. Hata
 * Postgres'ten geliyor: JSON dizesinde \u0000 ya da esi olmayan vekil
 * karakter varsa jsonb/text donusumu reddediyor. PDF metin cikarimi ikisini
 * de uretebiliyor (gomulu font tablolari, bozuk kodlama).
 *
 * Ozet akisi bu hatadan etkilenmiyordu — kart modelin urettigi metinden
 * kuruluyor, chunk ise HAM metinden. Bu yuzden hata yalnizca chunk
 * yolunda goruldu ve sessizce 'uyari' olarak gecti.
 *
 * Temizlik insert'in TAM ONUNDE: buildStorableChunks'ta yapmak da olurdu
 * ama chunk'lari baska bir yol uretirse oradan da gecmesi gerekir. */
function pgGuvenliMetin(deger: string): string {
  return String(deger ?? '')
    // NUL ve oteki C0 kontrol karakterleri (\t \n \r haric) bosluga donuyor.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    /* Esi olmayan vekil karakter: 'u' bayragiyla gecerli cift TEK kod
       noktasi sayilir ve Cs kategorisine girmez, yani bu desen yalnizca
       YARIM kalanlari siliyor. */
    .replace(/\p{Cs}/gu, '')
}

async function persistDocumentChunks(
  serviceClient: any,
  documentId: string,
  chunks: StorableChunk[]
): Promise<{ written: number; error: string | null }> {
  if (!chunks.length) return { written: 0, error: null }
  try {
    const { error: delError } = await serviceClient
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId)
    if (delError) return { written: 0, error: `delete failed: ${delError.message}` }

    // Batched so a long book does not become one oversized request.
    const BATCH = 200
    let written = 0
    for (let i = 0; i < chunks.length; i += BATCH) {
      let temizlenen = 0
      const rows = chunks.slice(i, i + BATCH).map(c => {
        const temiz = pgGuvenliMetin(c.text)
        if (temiz !== c.text) temizlenen++
        return { ...c, text: temiz, document_id: documentId }
      })
      if (temizlenen > 0) {
        console.log(`document_chunks: ${temizlenen} chunk Postgres icin temizlendi (NUL / yarim vekil karakter)`)
      }
      const { error: insError } = await serviceClient.from('document_chunks').insert(rows)
      if (insError) return { written, error: `insert failed at ${i}: ${insError.message}` }
      written += rows.length
    }
    return { written, error: null }
  } catch (e: any) {
    return { written: 0, error: String(e?.message || e) }
  }
}

/** Inverse page frequency: a term on every page discriminates nothing. */
function buildAnchorIdf(pageIndex: PageSegment[]): Map<string, number> {
  const df = new Map<string, number>()
  for (const seg of pageIndex) {
    for (const t of seg.terms) df.set(t, (df.get(t) || 0) + 1)
  }
  const N = Math.max(1, pageIndex.length)
  const idf = new Map<string, number>()
  for (const [t, d] of df) idf.set(t, Math.log((N + 1) / (d + 0.5)))
  return idf
}

// Precision-first thresholds: a missing citation is a small loss, a wrong one
// costs the student's trust in every other citation on the card.
/* COGUL EKI ATIFI OLDURUYORDU (30.10.2026 olcumu).
 *
 * "Week 8 Derivative" kartinda iki madde atifsiz kaldi
 * ("Citation anchoring: ... unanchored=2"). Bunlardan birinin kaynaktaki
 * karsiligi NEREDEYSE BIREBIR:
 *   madde  : "Decision mapping classifies expressions into sums, products,
 *             quotients, or composites before differentiation."
 *   sayfa 23: "Classify the expression first: sum, product, quotient, or
 *             composite form."
 * Ama olculen eslesme 10 terimden 1: yalnizca "decision". Geri kalan ALTI
 * kavram Ingilizce cekim ekinde kayboluyor — classifies/classify,
 * expressions/expression, sums/sum, products/product, quotients/quotient,
 * composites/composite.
 *
 * NEDEN nearDupStem KULLANILMIYOR: o 5 karakterlik sabit onek kesiyor ve
 * yalnizca KOPYA TESPITI icin guvenli (bkz. NEAR_DUP_STEM_LEN notu). Atifta
 * yanlis eslesme ogrenciyi YANLIS SAYFAYA gonderir, bu yuzden burada tek
 * tek sayilan ve geri cevrilebilir bir cogul kurali var, onek kesme yok.
 *
 * YALNIZCA INGILIZCE, BILEREK. Turkce cogul -lar/-ler'dir; Ingilizce -s
 * kurali Turkceye uygulandiginda olculen zarar gercek: "kurs" -> "kur",
 * "ders" -> "der", "ters" -> "ter". "kur" BASKA bir Turkce sozcuk (dovizin
 * kuru), yani ayni belgede ikisi varsa atif yanlis sayfayi gosterir. Bu
 * yuzden kapi dile bagli: lang === 'en' disinda eslesme BUGUNKUYLE BIREBIR
 * ayni kaliyor.
 *
 * Tuzaklar elenmis: ss/us/is/os ile bitenlere dokunulmuyor (class, focus,
 * analysis, chaos), ingilizce harf disi karakter tasiyan sozcuge
 * dokunulmuyor, 4 karakterden kisa sozcuge dokunulmuyor. */
function ingTekil(term: string): string {
  const t = String(term || '')
  if (t.length < 4) return t
  if (/[^a-z]/.test(t)) return t
  if (/(ss|us|is|os)$/.test(t)) return t
  if (/ies$/.test(t) && t.length > 4) return t.slice(0, -3) + 'y'
  if (/(ch|sh|s|x|z)es$/.test(t)) return t.slice(0, -2)
  if (/s$/.test(t)) return t.slice(0, -1)
  return t
}

/** Kumenin tekil karsiligi. Ozgun bicim de kalir: eslesme kaybedilmez. */
function tekilKume(terms: Set<string>): Set<string> {
  const out = new Set<string>()
  for (const t of terms) { out.add(t); out.add(ingTekil(t)) }
  return out
}

const ANCHOR_MIN_SCORE = 0.42   // share of the claim's weighted vocabulary found on the page
const ANCHOR_MIN_TERMS = 3      // distinct matched content terms

/**
 * Best page for a single claim, or null when no page matches it well enough.
 * Score = matched idf weight / total idf weight of the claim's own terms.
 */
function anchorClaimToPage(
  claim: string,
  pageIndex: PageSegment[],
  idf: Map<string, number>,
  tekil = false
): { page: number; score: number; matched: number; head: string; quote: string | null } | null {
  if (!pageIndex.length) return null
  const terms = [...new Set(anchorTerms(claim))]
  if (terms.length === 0) return null
  // Agirlik ESLESEN bicimden okunur — bkz. bestQuoteForClaim icindeki not.
  const agirlik = (t: string) =>
    idf.get(t) ?? (tekil ? idf.get(ingTekil(t)) : undefined) ?? Math.log(pageIndex.length + 1)
  const totalWeight = terms.reduce((a, t) => a + agirlik(t), 0)
  if (totalWeight <= 0) return null

  let best: { seg: PageSegment; score: number; matched: number } | null = null
  for (const seg of pageIndex) {
    /* Cogul eki — bkz. ingTekil. Tekil kume sayfa basina BIR KEZ uretilip
       segmentte saklaniyor: her madde icin yeniden kurmak 24 sayfa x 14
       madde demekti. */
    let kume = seg.terms
    if (tekil) {
      if (!seg.termsTekil) seg.termsTekil = tekilKume(seg.terms)
      kume = seg.termsTekil
    }
    let w = 0, matched = 0
    for (const t of terms) {
      if (kume.has(t) || (tekil && kume.has(ingTekil(t)))) { w += agirlik(t); matched++ }
    }
    if (matched === 0) continue
    const score = w / totalWeight
    // Strictly-greater keeps the EARLIEST page on a tie, which is where a
    // topic is normally introduced.
    if (!best || score > best.score) best = { seg, score, matched }
  }
  if (!best) return null
  if (best.matched < ANCHOR_MIN_TERMS || best.score < ANCHOR_MIN_SCORE) return null
  return {
    page: best.seg.page,
    score: best.score,
    matched: best.matched,
    head: best.seg.head,
    // Verbatim sentence from that page, so the student sees what the source
    // actually says rather than just a page number.
    quote: bestQuoteForClaim(claim, best.seg.body, idf, tekil)
  }
}

// ==========================================================================
// LATEX VALIDATION
//
// Formulas are rendered client-side by KaTeX (dashboard.html loads it). A
// malformed expression does not degrade gracefully — KaTeX throws and the
// student gets an error box or a blank where the formula should be, which
// reads as a broken app rather than a missing formula. Nothing validated
// these strings before they were stored, so one unbalanced brace from the
// model went straight to the screen.
//
// Two jobs here:
//   REPAIR what is merely over-wrapped. The prompt asks for raw LaTeX with
//   no delimiters, and models routinely add "$...$", "\(...\)" or "\[...\]"
//   anyway. Stripping those is safe and keeps a perfectly good formula.
//   REJECT what cannot render. An unbalanced brace or \left without \right
//   has no safe repair — guessing where the author meant to close it could
//   silently change the mathematics, so the formula is dropped instead.
// ==========================================================================

/** Strip delimiters the prompt forbids but models add anyway. */
function stripLatexDelimiters(raw: string): string {
  let s = String(raw || '').trim()
  for (let i = 0; i < 3; i++) {
    const before = s
    s = s.replace(/^\$\$([\s\S]*)\$\$$/, '$1').trim()
    s = s.replace(/^\$([\s\S]*)\$$/, '$1').trim()
    s = s.replace(/^\\\(([\s\S]*)\\\)$/, '$1').trim()
    s = s.replace(/^\\\[([\s\S]*)\\\]$/, '$1').trim()
    if (s === before) break
  }
  return s
}

/**
 * Is this renderable by KaTeX? Conservative: only structural problems that
 * definitely throw are rejected, so an unusual but valid expression is not
 * thrown away for being unfamiliar.
 */
function validateLatex(raw: string): { ok: boolean; latex: string; reason?: string } {
  const latex = stripLatexDelimiters(raw)
  if (!latex) return { ok: false, latex, reason: 'bos' }
  if (latex.length < 2) return { ok: false, latex, reason: 'cok kisa' }
  if (latex.length > 1000) return { ok: false, latex, reason: 'cok uzun' }

  // Unescaped brace balance. A literal brace is written \{ or \}, so those
  // pairs are skipped rather than counted.
  let depth = 0
  for (let i = 0; i < latex.length; i++) {
    if (latex[i] === '\\') { i++; continue }      // skip the escaped char
    if (latex[i] === '{') depth++
    else if (latex[i] === '}') { depth--; if (depth < 0) return { ok: false, latex, reason: 'fazla kapanis parantezi' } }
  }
  if (depth !== 0) return { ok: false, latex, reason: 'dengesiz suslu parantez' }

  // \left must pair with \right or KaTeX throws.
  const lefts = (latex.match(/\\left/g) || []).length
  const rights = (latex.match(/\\right/g) || []).length
  if (lefts !== rights) return { ok: false, latex, reason: '\\left / \\right dengesiz' }

  // A stray delimiter left INSIDE (after the strip above) means the model
  // mixed modes; KaTeX in text mode throws on a bare $.
  if (/(^|[^\\])\$/.test(latex)) return { ok: false, latex, reason: 'kacak $' }

  // A backslash with nothing after it is an incomplete command.
  if (/\\$/.test(latex)) return { ok: false, latex, reason: 'yarim komut' }

  return { ok: true, latex }
}

/**
 * Validate a formula list: repaired formulas are kept with their cleaned
 * LaTeX, unrenderable ones are removed. A formula with no usable LaTeX but a
 * real name/variable list is still dropped — the card shows formulas as
 * rendered math, so a nameless broken entry has nothing to display.
 */
/** Iki formulun AYNI formul olup olmadigini anlamak icin anahtar.
 *
 *  Canli ozette ikinci derece model uc kez listelendi — "Quadratic
 *  regression", "Quadratic (non-linear) model", "Quadratic regression
 *  function" — cunku iki pencere ve gorsel gecis ayni denklemi ayri adla
 *  yazdi. Ad degil denklem karsilastirilir: bosluk, suslu parantez, \left/
 *  \right, sapka, carpi isareti atilir; tek harfli gosterge altlari (x_j,
 *  x_i) dusurulur cunku ayni slayt ayni modeli bazen x, bazen x_j ile yaziyor.
 *  Rakam altlari (β_1, x_2) KORUNUR — onlar farkli degiskenler. */
function formulaKey(latex: string): string {
  return String(latex || '')
    .replace(/\\(?:left|right|displaystyle|,|;|!|quad|qquad)/g, '')
    .replace(/\\hat\s*\{?\s*(\\?[A-Za-z]+)\s*\}?/g, '$1')
    .replace(/\\(?:cdot|times)/g, '')
    .replace(/\\(?:varepsilon|epsilon)/g, 'ε')
    .replace(/\\beta/g, 'β').replace(/\\alpha/g, 'α')
    .replace(/[{}\s]/g, '')
    .replace(/_([a-zA-Z])(?![a-zA-Z0-9])/g, '')
    .replace(/[̂ˆ]/g, '')
    .toLowerCase()
}

/* COK HARFLI SOZCUK MATEMATIK MODUNDA HARF HARF DIZILIR (29.10.2026).
 *
 * ACCOUNTING chapter 7 kartinda dort formulden ikisi ekranda boyle cikti:
 *   "I n t e r e s t = P r i n c i p a l x A n n u a l ..."
 * Sebep KaTeX degil LaTeX: matematik modunda `Interest` sekiz AYRI
 * degiskendir (I.n.t.e.r.e.s.t) ve her biri italik, aralarinda carpim
 * boslugu ile dizilir. Ayni kartin oteki iki formulu dogru cikti, cunku
 * model onlarda \text{...} yazmisti.
 *
 * Uc harften uzun ciplak harf dizileri \text{} ile sariliyor. Esik 3:
 * degisken adlari (x, dx, nx, AB) matematik modunda DOGRU gorunur ve
 * sarilmamalari gerekir.
 *
 * KOMUT ADLARI VE MEVCUT SARMALLAR ATLANIYOR: \times'in 'times'i sozcuk
 * degil komuttur; \text{Bad Debt Amount} icindeki metne de ikinci kez
 * dokunmak sarmali bozar. Tarayici bu yuzden karakter karakter ilerliyor,
 * tek bir regex ile yapilamaz. */
const FORMUL_SOZCUK_ESIK = 3
const FORMUL_KORUNAN_SARMAL = new Set([
  'text', 'textrm', 'textbf', 'textit', 'textsf', 'texttt',
  'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'mathcal', 'mathbb',
  'operatorname'
])

function formulSozcukleriniSar(latex: string): string {
  const s = String(latex || '')
  if (!/[A-Za-z]{3,}/.test(s)) return s
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s[i] === '\\') {
      const komut = /^\\([A-Za-z]+)/.exec(s.slice(i))
      if (!komut) { out += s.slice(i, i + 2); i += 2; continue }
      out += komut[0]
      i += komut[0].length
      if (FORMUL_KORUNAN_SARMAL.has(komut[1])) {
        while (i < s.length && /\s/.test(s[i])) { out += s[i]; i++ }
        if (s[i] === '{') {
          let derinlik = 0
          do {
            if (s[i] === '{') derinlik++
            else if (s[i] === '}') derinlik--
            out += s[i]
            i++
          } while (i < s.length && derinlik > 0)
        }
      }
      continue
    }
    const sozcuk = /^[A-Za-z]+/.exec(s.slice(i))
    if (sozcuk) {
      out += sozcuk[0].length >= FORMUL_SOZCUK_ESIK ? `\\text{${sozcuk[0]}}` : sozcuk[0]
      i += sozcuk[0].length
      continue
    }
    out += s[i]
    i++
  }
  return out
}

function sanitizeFormulas(formulas: any[]): { formulas: any[]; dropped: Array<{ name: string; reason: string }>; repaired: number; duplicates: number } {
  const list = Array.isArray(formulas) ? formulas : []
  const out: any[] = []
  const dropped: Array<{ name: string; reason: string }> = []
  const seen = new Set<string>()
  /* AYNI AD IKI KEZ (30.10.2026 olcumu). formulaKey LATEX'i
     karsilastiriyor; ayni kural iki ayri notasyonla yazilinca iki ayri
     anahtar cikiyor ve kart ayni formulu iki kez gosteriyor. "Week 8
     Derivative" kosusunda 14 formulden dordu kopyaydi:
       Product Rule   : \frac{d}{dx}(u(x)v(x))=u'v+uv'   ve   (uv)'=u'v+uv'
       Quotient Rule  : \frac{d}{dx}(\frac{u}{v})=...    ve   (u/v)'=...
     Ad eslesmesi bunu yakaliyor: ayni derste ayni adla iki AYRI kural
     olmasi beklenmez, ama ayni kuralin iki notasyonu siktir. */
  const seenName = new Set<string>()
  let repaired = 0
  let duplicates = 0
  for (const f of list) {
    const original = String(f?.latex || '')
    // Cift kacisli komut: model "\\beta" yazinca KaTeX "\\" satir sonu +
    // "beta" goruyor, PDF "\β" basiyordu (canli: "y=\β₀+\∑ⱼ₌₁^k..."). Harften
    // once gelen cift ters bolu tek ters boluya indirilir; gercek satir sonu
    // ("a \\ b") arkasindan bosluk geldigi icin etkilenmez.
    const deduped = original.replace(/\\\\(?=[A-Za-z])/g, '\\')
    /* Ciplak sozcukler \text{} ile sarilir — bkz. formulSozcukleriniSar.
       Dogrulamadan ONCE, cunku karta giden hali bu. */
    const v = validateLatex(formulSozcukleriniSar(deduped))
    if (!v.ok) {
      dropped.push({ name: String(f?.name || '(isimsiz)').slice(0, 40), reason: v.reason || 'gecersiz' })
      continue
    }
    const key = formulaKey(v.latex)
    if (key && seen.has(key)) { duplicates++; continue }
    const adKey = trNormalize(String(f?.name || '')).replace(/[^a-z0-9]+/g, '')
    if (adKey && seenName.has(adKey)) { duplicates++; continue }
    if (key) seen.add(key)
    if (adKey) seenName.add(adKey)
    if (v.latex !== original.trim()) repaired++
    out.push({ ...f, latex: v.latex })
  }
  return { formulas: out, dropped, repaired, duplicates }
}

// ==========================================================================
// MERMAID VALIDATION
//
// Same class of problem as the LaTeX check above, and reported from the live
// app: every "View Summary" showed three bomb icons reading "Syntax error in
// text / mermaid version 10.9.8". The model writes `diagrams[].mermaid` and
// nothing ever checked it, so broken source went to the database and then to
// the renderer.
//
// The front end now refuses to draw invalid source (safeMermaidRender in
// dashboard.js parses before rendering), which stops the bombs. This does
// the other half: a diagram that cannot be valid is not stored in the first
// place, so the card does not carry dead weight and the front end is not
// left hiding empty boxes.
//
// Deliberately structural-only. A real Mermaid parser cannot run here, and
// guessing at semantics would throw away diagrams that render fine — so this
// rejects only what is definitely broken: no diagram type, unbalanced
// brackets or quotes, or nothing but a header line.
// ==========================================================================
const MERMAID_TYPES = [
  'flowchart', 'graph', 'sequencediagram', 'classdiagram', 'statediagram',
  'erdiagram', 'journey', 'gantt', 'pie', 'mindmap', 'timeline',
  'quadrantchart', 'requirementdiagram', 'gitgraph', 'c4context', 'sankey',
  'xychart', 'block'
]

// Mermaid has no left-pointing LABELLED edge: `-->|text|` is valid, `<--|text|`
// is not, and a flowchart containing one fails to parse in full — the single
// bad line takes the whole diagram down. Models reach for it constantly when
// describing a two-way relationship ("households receive wages FROM firms"),
// and it is exactly backwards from a form that already exists: `A <--|t| B`
// means the same thing as `B -->|t| A`.
//
// Observed live: a circular-flow diagram, otherwise correct, carried
//   H <--|receives wages, dividends, interest| F
// and silently never rendered. Dropping it would have been a loss (the diagram
// is good), so this rewrites the edge instead and only fails validation if
// something unrepairable is left. Rewriting is safe because the transform is
// pure direction-swapping — no content is invented or discarded.
const MERMAID_REVERSE_LABELLED_EDGE = /^(\s*)(.+?)\s*<(-{2,3}|={2,3}|-\.-+)\|([^|]*)\|\s*(.+?)\s*$/

function repairMermaidArrows(src: string): { mermaid: string; repaired: number } {
  let repaired = 0
  const out = src.split('\n').map(line => {
    const m = line.match(MERMAID_REVERSE_LABELLED_EDGE)
    if (!m) return line
    const [, indent, left, dashes, label, right] = m
    // `--` -> `-->`, `==` -> `==>`, `-.-` -> `-.->`
    const forward = dashes.startsWith('=') ? `${dashes}>` : dashes.endsWith('.') ? `${dashes}->` : `${dashes}>`
    repaired++
    return `${indent}${right} ${forward}|${label}| ${left}`
  })
  return { mermaid: out.join('\n'), repaired }
}

// A node label containing bare parentheses is a syntax error:
// `Money[Money (Financial) Market]` has to be written
// `Money["Money (Financial) Market"]`. The balance check further down cannot
// catch it — the parentheses ARE balanced — so the diagram passes validation
// and then Mermaid rejects it whole.
//
// Observed live: a "Three Market Arenas" graph, correct in every other
// respect, lost to that single line while the circular-flow diagram beside it
// rendered fine. Quoting is lossless, so this repairs rather than drops.
//
// Deliberately narrow: only the `ID[label]` form, only when the label has no
// quote or bracket of its own. The lookahead skips `[[subroutine]]` and
// `[(database)]`, whose second character is part of the SHAPE rather than the
// label, and which quoting would corrupt.
/* TIRNAKSIZ ETIKET YALNIZCA PARANTEZDE DEGIL (30.10.2026 olcumu).
 *
 * Desen yalnizca ( ya da ) tasiyan etiketi tirnakliyordu. "Week 8
 * Derivative" kosusunda ilk diyagram EKRANA HIC cizilmedi ve numaralandirma
 * "DIYAGRAM 2"de kaldi; saklanan kaynak:
 *   A --> C[Product: u'v + uv']
 *   A --> D[Quotient: \frac{u'v - uv'}{v^2}]
 * Ikisinde de parantez YOK; kesme isareti, suslu parantez ve iki nokta var
 * ve mermaid bunlari tirnaksiz ayristiramiyor. Dogrulayici "2 kept" dedi
 * cunku bizim kontrolumuz gecti — ama tarayici cizemedi.
 *
 * Tetikleyici kume genisletildi. Tirnak ZATEN dislanmis durumda
 * ([^\[\]"]*), yani elle tirnaklanmis etiket iki kez sarilmiyor. */
const MERMAID_UNQUOTED_PAREN_LABEL = /(^|[\s>|-])([A-Za-z_][\w-]*)\[(?!\[|\()([^\[\]"]*['(){}:;,#&\\][^\[\]"]*)\]/g

function repairMermaidLabels(src: string): { mermaid: string; repaired: number } {
  let repaired = 0
  const mermaid = src.replace(
    MERMAID_UNQUOTED_PAREN_LABEL,
    (_m, lead: string, id: string, label: string) => {
      repaired++
      return `${lead}${id}["${label.trim()}"]`
    }
  )
  return { mermaid, repaired }
}

/** Duz metin kacis dizilerini gercek satir sonuna cevirir; yon satirini
 *  basliga birlestirir. Bkz. validateMermaid icindeki olcum notu. */
function normalizeMermaidKacislari(raw: string): { mermaid: string; repaired: number } {
  let s = String(raw || '')
  let repaired = 0
  /* Mermaid satir sonunu <br/> ile yazar, \n diye YAZMAZ — yani metinde
     duz ters bolu+n gorunduyse o bir kacis artigidir. */
  if (/\\[nrt]/.test(s)) {
    const once = s
    s = s.replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\\t/g, '    ')
    if (s !== once) repaired++
  }
  // 'flowchart' / 'graph' tek basina, yon alt satirda: ayni satira alinir.
  const yonAyri = /^([ \t]*(?:flowchart|graph))[ \t]*\n[ \t]*(TD|TB|BT|LR|RL)\b[ \t]*/i
  if (yonAyri.test(s)) {
    /* Sonrasindaki satir sonu OLDUGU GIBI kaliyor: '\n' eklemek bos satir
       uretiyordu (zararsiz ama kaynagi kirletiyor). */
    s = s.replace(yonAyri, '$1 $2')
    repaired++
  }
  return { mermaid: s.trim(), repaired }
}

function validateMermaid(raw: string): { ok: boolean; mermaid: string; reason?: string; repaired?: number } {
  let src = String(raw || '').trim()
  // Models often wrap it in a fenced code block despite being asked not to.
  src = src.replace(/^```+\s*mermaid\s*/i, '').replace(/```+\s*$/, '').trim()
  /* DUZ METIN \n MERMAID'I OLDURUYOR (29.10.2026 olcumu).
   *
   * "Chp 9 - Group Processes" kartinda ucuncu diyagram ekranda HIC
   * cizilmedi ve numaralandirma 1, 3 diye atladi. Sunucu onu saklamisti
   * ("Mermaid validation: 3 kept, 0 dropped"), yani dogrulayici fazla
   * yumusakti. Saklanan kaynak:
   *
   *   flowchart
   *   TD\n    A[Situational Control] --> B[High Control]\n    A --> C[...]
   *
   * Iki ayri kusur: (1) satir sonlari GERCEK degil, duz metin ters bolu+n;
   * (2) 'flowchart' tek basina bir satirda, yon 'TD' alt satirda. Mermaid
   * ikisini de ayristiramaz. Tek bir gercek \n kacisi islemis, geri kalani
   * model \\n diye yazdigi icin duz metin kalmis.
   *
   * tekSatirAc bu halde yardim edemiyor: kaynakta gercek satir sonu VAR,
   * o yuzden dokunmadan geciyor. Normalizasyon ondan once gelmeli. */
  const kacislar = normalizeMermaidKacislari(src)
  src = kacislar.mermaid

  if (!src) return { ok: false, mermaid: src, reason: 'bos' }
  if (src.length > 4000) return { ok: false, mermaid: src, reason: 'cok uzun' }

  const arrowsFixed = repairMermaidArrows(src)
  src = arrowsFixed.mermaid
  // Anything still pointing left with a label could not be rewritten (e.g. the
  // line had more than one such edge, or no right-hand node) — Mermaid would
  // reject the whole diagram, so fail here rather than ship a blank render.
  if (/<(-{2,3}|={2,3}|-\.-+)\|/.test(src)) {
    return { ok: false, mermaid: src, reason: 'onarilamayan ters etiketli ok (<--|...|)' }
  }

  // Must run AFTER the arrow repair: that step rewrites whole lines and would
  // otherwise undo the quoting.
  const labelsFixed = repairMermaidLabels(src)
  src = labelsFixed.mermaid
  const fixed = { repaired: kacislar.repaired + arrowsFixed.repaired + labelsFixed.repaired }

  /* TEK SATIR HER ZAMAN COPLUK DEGIL (09.10.2026).
     Canli kosuda "Dummy Variable and Interaction Structure" diyagrami tam
     bu satirda dustu ve karttaki diyagram sayisi 2'den 1'e indi. Modelin
     tek satira sikistirmasinin iki olagan bicimi var ve ikisi de KAYIPSIZ
     acilabiliyor:
       "graph TD; A-->B; B-->C"   -> noktali virgul Mermaid'in KENDI ifade
                                     ayraci, satir sonuna cevrilir
       "flowchart TD A-->B"       -> tur basligi govdeyle ayni satirda;
                                     baslik kendi satirina alinir
     Bunun otesi (noktali virgulsuz birden fazla ifade) belirsiz, orada
     reddetmek dogru. */
  const tekSatirAc = (t: string): string => {
    if (t.includes('\n')) return t
    if (t.includes(';')) return t.split(';').map(x => x.trim()).filter(Boolean).join('\n')
    const m = /^(\s*[A-Za-z][A-Za-z0-9]*(?:\s+(?:TD|TB|BT|LR|RL))?)\s+(\S.*)$/.exec(t)
    // Kalan kisim GERCEKTEN bir ifade olmali: ok, dugum parantezi ya da iki
    // nokta tasimali. Yoksa "flowchart TD" gibi govdesiz bir baslik
    // "flowchart" + "TD" diye bolunup gecerli sayilirdi (mevcut test bunu
    // yakaladi).
    if (m && /(-{2,3}>|={2,3}>|-\.->|[[({:])/.test(m[2])
        && MERMAID_TYPES.some(ty => m[1].toLowerCase().replace(/\s+/g, '').startsWith(ty))) {
      return `${m[1].trim()}\n${m[2].trim()}`
    }
    return t
  }
  const acilmis = tekSatirAc(src)
  if (acilmis !== src) {
    src = acilmis
    fixed.repaired++
  }

  const lines = src.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { ok: false, mermaid: src, reason: 'tek satir — govde yok' }

  // First line must name a diagram type, or Mermaid cannot even start.
  const head = lines[0].toLowerCase().replace(/\s+/g, '')
  if (!MERMAID_TYPES.some(t => head.startsWith(t))) {
    return { ok: false, mermaid: src, reason: `bilinmeyen diyagram turu: ${lines[0].slice(0, 30)}` }
  }

  // Bracket and quote balance. Unbalanced delimiters are the most common way
  // the model's output fails, and the one thing checkable without a parser.
  const pairs: Array<[string, string]> = [['[', ']'], ['(', ')'], ['{', '}']]
  for (const [open, close] of pairs) {
    let depth = 0
    for (const ch of src) {
      if (ch === open) depth++
      else if (ch === close) { depth--; if (depth < 0) break }
    }
    if (depth !== 0) return { ok: false, mermaid: src, reason: `dengesiz ${open}${close}` }
  }
  if ((src.match(/"/g) || []).length % 2 !== 0) {
    return { ok: false, mermaid: src, reason: 'dengesiz tirnak' }
  }

  return { ok: true, mermaid: src, repaired: fixed.repaired }
}

function sanitizeDiagrams(diagrams: any[]): { diagrams: any[]; dropped: Array<{ title: string; reason: string }>; repaired: number } {
  const list = Array.isArray(diagrams) ? diagrams : []
  const out: any[] = []
  const dropped: Array<{ title: string; reason: string }> = []
  let repaired = 0
  for (const d of list) {
    const v = validateMermaid(d?.mermaid)
    if (!v.ok) {
      dropped.push({ title: String(d?.title || '(isimsiz)').slice(0, 40), reason: v.reason || 'gecersiz' })
      continue
    }
    repaired += v.repaired || 0
    out.push({ ...d, mermaid: v.mermaid })
  }
  return { diagrams: out, dropped, repaired }
}

// ==========================================================================
// CHART GATE — a chart with no numbers is worse than no chart
//
// The extraction prompts all say "only chart-worthy numeric data actually
// present ... never fabricate". A model that can see a figure's TITLE and
// AXIS LABELS in the extracted text, but not the figure itself, reads that
// rule as satisfied by emitting the labels with a zero for every value — it
// invented no numbers, after all. The student then gets a chart.
//
// Measured live on a 30-page deck: three charts ("U.S. Aggregate Output
// 1970-2014", "Unemployment Rate", "Inflation Rate"), each with ten year
// labels and data = [0,0,0,0,0,0,0,0,0,0], rendering as three identical flat
// lines along the x-axis. charts=0 would have been strictly better.
//
// Prompt wording cannot fix this reliably — the model believes it complied.
// This is the deterministic counterpart, in the same family as
// sanitizeFormulas/sanitizeDiagrams: it costs no tokens, runs after every
// pipeline, and holds regardless of what the model emits.
const CHART_TYPES = ['bar', 'pie', 'line']
const CHART_MIN_POINTS = 2
// Share of a chart's values that must be findable in the source before the
// chart is believed. Not all of them: a legitimate chart may carry a total or
// a percentage the author derived rather than printed. Half is enough to tell
// "read from the document" apart from "written from memory".
//
// WHAT THIS COSTS, stated plainly: a chart whose values are all DERIVED is
// dropped with the fabrications. Text saying "30 passed, 20 failed" turned
// into a pie of [60, 40] has no value in the source, and this gate cannot
// tell that from invention. The trade is taken on measured grounds — across
// the runs on 05.10.2026 the pipeline produced four fabricated charts and
// not one legitimate chart — and it is the right way round regardless: a
// missing chart is a gap the student can see, a fabricated one is a lie they
// cannot.
const CHART_MIN_GROUNDED_RATIO = 0.5

/**
 * Every number the source text actually contains.
 *
 * Thousands separators are stripped so "17,000" and 17000 are the same
 * number, and a trailing period or comma is dropped so a figure at the end of
 * a sentence still matches.
 *
 * Noise is fine here, and deliberately so: page markers like "20-30" land in
 * the set as -30. Extra members can only make the check more PERMISSIVE,
 * never make it drop a real chart, and erring toward keeping is the right
 * direction for a gate the student cannot see.
 */
function sourceNumbers(text: string): Set<number> {
  const out = new Set<number>()
  const tokens = String(text || '').match(/-?\d[\d.,]*/g) || []
  for (const token of tokens) {
    /* TURKCE ONDALIK AYIRICI KUMEYI BOSALTIYORDU (24.10.2026).
     *
     * Burasi yalnizca Ingilizce okumayi deniyordu: `Number('0,09')` NaN
     * oldugu icin Turkce bicimli bir kaynakta kume TAMAMEN bos kaliyordu.
     * Olculdu — ayni cumlenin iki dili:
     *
     *   EN "Coefficient 0.09 and constant 484.12" -> [0.09, 0, 0.1, 484.12, …]
     *   TR "Katsayi 0,09 ve sabit 484,12"         -> []
     *
     * Bos kume iki kapiyi birden yikiyordu: grafik kapisi
     * (found/paired < CHART_MIN_GROUNDED_RATIO) BUTUN grafikleri, cozumlu
     * ornek kapisi da BUTUN ornekleri "sayilar kaynakta yok" diye siliyordu.
     * Yani Turkce bicimli sayi tasiyan her belgede — ekonometri/istatistik
     * ders notu tam olarak bu — grafik ve ornek bolumu bos cikiyor ve log
     * bunu "uydurma" diye raporluyordu.
     *
     * Dogru okuyucu AYNI DOSYADA zaten vardi: sayiOkumalari iki bicimi de
     * cozuyor (`sayiOkumalari('0,09')` -> [0.09]). Ayni mantigin iki ayri
     * yazimi ve ayrismasiydi; artik tek kaynaktan okunuyor.
     *
     * Kume buyudugu icin iki kapi biraz daha gecirgen olur — fonksiyonun
     * kendi sozlesmesi bunu zaten kabul ediyor: fazladan uye yalnizca
     * kontrolu DAHA MUSAMAHAKAR yapabilir, daha siki yapamaz. */
    for (const value of sayiOkumalari(token)) {
      out.add(value)
      // The model routinely rounds what it read ("17,042 billion" -> 17000),
      // and a rounded value is still a read value, not an invented one.
      out.add(Math.round(value))
      out.add(Math.round(value * 10) / 10)
    }
  }
  return out
}

/* ==========================================================================
   SAYISAL KAPSAMA — kaynagin OLCULMUS degerlerinin ne kadari ozete ulasti
   (09.10.2026)

   Bu projenin ozet kalitesi icin bir olcusu yoktu. "Bence asiri zayif kaldi"
   dogru bir gozlemdi ama bir sayi degildi; bir sonraki surumun daha iyi mi
   kotu mu oldugunu ancak biri iki PDF'i yan yana okuyarak soyleyebiliyordu.

   Olculen sey: kaynakta gecen AYIRT EDICI sayilardan kacinin ozette de
   gectigi. Ayirt edici = ondalikli bir deger ya da |v| >= 100 —
   gateWorkedExamples'in kullandigi tanimin aynisi. Kucuk tam sayilar
   (slayt numarasi, "%10 duzeyinde", "2 kategori") her metinde bulunur ve
   hicbir sey olcmez.

   Ayni ekonometri destesinin dort canli ozeti, BU uygulamayla olculdu
   (kaynak 41 ayirt edici sayi, dipnotlar haric):
       08.10 ozet A        19/41   %46
       08.10 ozet B        15/41   %37
       08.10 ozet C        19/41   %46   (alti ampirik sonuctan 3'u — en iyisi)
       09.10 "asiri zayif" 11/41   %27   (repairLatexEscapes hatasi kosusu)
   Kullanicinin "asiri zayif" dedigi kosu acik farkla en dusuk. A ile C'yi
   ayirt EDEMIYOR: C alti sonuctan 3'unu, A 1'ini tasiyor ama A baska
   slaytlarin sayilarini daha cok tutmus. Yani kaba kaliteyi goruyor, ince
   farki gormuyor — bir sonraki surumun belirgin geriledigini ya da
   ilerledigini soylemeye yetiyor, ve her kosuda, ek model cagrisi olmadan.

   YALNIZCA TANI. Hicbir seyi kapilamiyor, dusurmuyor, yeniden istemiyor.
   Mutlak deger anlamli degil (kaynakta ders olmayan sayilar da var); anlamli
   olan AYNI belgenin kosulari arasindaki fark ve pencere -> birlesim ->
   son kart arasinda nerede kayboldugu.
   ========================================================================== */

// Kaynak metindeki "--- SAYFA N ---" / "--- SLAYT N ---" isaretleri olcuye
// girmemeli: 100+ sayfalik bir belgede isaretin kendisi "ayirt edici" sayilir.
const SAYFA_ISARETI_RE = /---\s*(?:SAYFA|SLAYT)\s+\d+\s*---/g

// Model okudugunu yuvarlar ("484.12" -> "484", "41.5%" -> "42%") ve yuvarlanmis
// bir deger de okunmus bir degerdir. GORELI tolerans, mutlak degil: mutlak
// yuvarlama tam olarak gateWorkedExamples'ta dustugumuz tuzak — 0.0012 sifira
// yuvarlanir ve her metinde 0 vardir. Goreli %2.5'te 0.026'nin penceresi
// +/-0.00065; "0.03" (yuzde 15 uzak) KABUL EDILMIYOR, 484.12 icin "484" ediliyor.
const SAYISAL_KAPSAMA_TOLERANS = 0.025

// Bastaki nokta DAHIL: ders slaytlari ".07 tons", ".69%" yaziyor (Amerikan
// istatistik gelenegi). \d ile baslayan bir desen bunlari 7 ve 69 olarak okur
// — ikisi de kucuk tam sayi, ikisi de olcuden duser. Referans destenin alti
// sonucundan ikisi tam olarak bu bicimde.
const SAYI_BELIRTECI = /\.?\d[\d.,]*/g
const SAYISAL_KAPSAMA_ORNEK = 8
// Kayip sayinin iki yanindan basilan baglam uzunlugu — bkz. sayisalKayipBaglami.
const SAYISAL_BAGLAM_KRK = 40

/** Bir sayi belirtecinin okumalari; ILK eleman birincil okuma.
 *
 *  Turkce ondalik virgul ("12,08", "%2,6") de okunur: ozet dili Turkce
 *  oldugunda model sayiyi boyle yaziyor, ve bu okunmazsa Turkce her ozet
 *  sistematik olarak dusuk olculur.
 *
 *  "1,500" iki turlu okunabilir (1500 / 1.5). Kaynak tarafi YALNIZCA birincil
 *  okumayi kullanir — yoksa her binlik ayracli sayi olcuye bir de hayali 1.5
 *  ekler ve o hep "kayip" cikar. Ozet tarafi hepsini kullanir: orada fazla
 *  aday olcuyu yalnizca comertlestirir. */
function sayiOkumalari(token: string): number[] {
  const base = token.replace(/[.,]+$/, '')
  const okumalar: number[] = []
  // Ingilizce: "1,500.25" -> 1500.25 ; "0.026" -> 0.026 ; "12,08" -> NaN
  const en = Number(base.replace(/,(?=\d{3}\b)/g, ''))
  if (Number.isFinite(en)) okumalar.push(en)
  // Turkce: "1.500,25" -> 1500.25 ; "12,08" -> 12.08. Yalnizca virgul varsa
  // anlamli; "0.026" icin bu okuma 26 uretirdi.
  if (base.includes(',')) {
    const tr = Number(base.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
    if (Number.isFinite(tr) && !okumalar.includes(tr)) okumalar.push(tr)
  }
  return okumalar
}

/** Kaynagin ayirt edici sayilari, ILK GORULDUKLERI SIRADA ve mutlak degere
 *  gore tekillestirilmis. Isaret karsilastirilmiyor: cikaricilar eksi
 *  isaretini sik kaybediyor (sembol fontu), ve "12.08 kayboldu mu" sorusu
 *  isaretten bagimsiz. Yil gibi duran tam sayilar (1500-2100) disarida — ders
 *  icerigi degil, ama her donem slaytinda var. */
/* URL VE DOSYA ADI SAYI DEGILDIR (28.10.2026 — olculmus).
 *
 * BUS211 week2 kosusunda kart "sayisal kapsama %41" rozetiyle cikti ve
 * kullaniciya oyle gosterildi. Kayip sayilarin baglami (bkz. asagidaki
 * "KAYIP SAYILARIN BAGLAMI" notunun sordugu soru) cevabi verdi:
 *   1122  <- "1122sciencedefns.html"
 *   10393 <- "/topic/1350805/history-of-technology/10393/Stone"
 *   812   <- "article-0-03B05683000005DC-812_306x516.jpg"
 * Ucu de kaynak linki. Kaynak slayt destesi link dolu; ozet onlari
 * "ogretmedigi" icin degil, ogretilecek bir sey olmadigi icin almiyor.
 * Kartin gercek sayilari (15.000 yillik mamut disi, 7500-5700 BC, 12000
 * yil, 5.000-20.000 kisi) yerindeydi — kusur KAPIDAYDI, kartta degil.
 *
 * Yalnizca HEDEF listesinden dusuyorlar: ciktida bir URL sayisi geciyorsa
 * zarar yok, sadece hedef sayilmiyorlar. */
const URL_BENZERI_RE = /\b(?:https?:\/\/|www\.)\S+|\S+\.(?:html?|php|aspx?|jpe?g|png|gif|pdf|svg|webp)\b/gi

/* BOZUK 10'UN KUVVETI SAYI DEGILDIR (28.10.2026 — olculmus).
 *
 * "2.CURRENT, VOLTAGE AND RESISTANCE" kosusunda kart %65 rozetiyle cikti.
 * Kayiplarin baglami:
 *   1018 <- "(1.6 10-19 )-1 that is 6.25 1018 electrons has to move"
 * PDF'ten ust simge duzlesiyor: 6,25x10^18 -> "6,25x1018", 1,6x10^-19 ->
 * "1,6 x 10-19". Yani 1018 OLCULEN bir deger degil, usun kendisi. Kart
 * zaten "6.25 \times 10^{18}" yaziyordu — olcu var olani yok sayiyordu.
 *
 * Yalnizca US atiliyor, MANTIS kaliyor: 1.6 ve 6.25 gercek hedeflerdir ve
 * kartta gectikleri icin zaten kept sayiliyorlar. */
const BOZUK_US_RE = /(\d[.,]\d+)\s*[x×*]?\s*10-?\d{1,3}\b/gi

/* CAG ISARETLI YIL DA YILDIR (28.10.2026 — olculmus).
 *
 * Asagidaki yil kuralı yalnizca 1500-2100 arasi DORT haneliyi eliyor.
 * "BUS211 week4" kosusunda tek kayip sayi suydu:
 *   390 <- "his Republic (ca. 390 bce), for example, Plato mocks"
 * Antik tarihler uc haneli ve filtrenin disinda kaliyordu. Kapsama olcusu
 * MIKTAR olcuyor, tarih degil — "1,800 dolar bir tutar, 1800 bir yil"
 * ayrimi burada da gecerli, yalnizca cag isareti tasiyan hali atlanmisti.
 *
 * Bu, tarihin karta GIRMEMESI gerektigi anlamina GELMEZ: prompt zaten
 * "dates, ranges and quantities ... carry them verbatim" diyor. Degisen
 * sey yalnizca sayisal kapsama rozetinin neyi sayacagi. */
/* NOKTALI CAG ISARETI DE CAG ISARETIDIR (29.10.2026 olcumu).
 *
 * Desen yalnizca noktasiz bicimi taniyordu. "BUS211 week3" kosusunda
 * kayip sayilardan biri suydu:
 *   3200 <- "--- SAYFA 24 --- 3200 B.C. Mesopotamia"
 * "390 bce" yakalaniyor ama "3200 B.C." yakalanmiyordu: `bc` ardi ardina
 * iki harf istiyor, metinde arada nokta var. Noktalar artik istege bagli.
 *
 * Sondaki \b kalkti: noktali bicim nokta ile bitiyor ve ardindan bosluk
 * geliyor ("B.C. Mesopotamia"), iki non-word karakter arasinda sinir
 * YOKTUR — eski desen bu yuzden noktali hali hic eslestirmezdi. Yerine
 * "ardindan harf/rakam gelmesin" kontrolu kondu. */
const CAG_YILI_RE = /\b\d{1,4}\s*(?:b\.?c\.?e\.?|b\.?c\.?|a\.?d\.?|c\.?e\.?|m\.?o\.?|m\.?s\.?)(?![a-z0-9])/gi

/* DERS KODU SAYI DEGILDIR (29.10.2026 olcumu).
 *
 * "BUS211 week3" kosusunda kart %67 rozetiyle cikti. Kayiplarin baglami:
 *   211 <- "remained as BUS101. --- SAYFA 2 --- BUS211 History of Science"
 *   101 <- ayni yerden (Window 1: 0/2, %0)
 * BUS211 ve BUS101 ders kodu; olculen bir miktar degil kimlik. Kart
 * bunlari tasimadigi icin rozet %67 diyordu, gercek kapsama 4/4'tu.
 *
 * Kural: rakamlar 2+ HARFE DOGRUDAN yapismissa kimliktir. Gercek bir
 * miktarin onunde bosluk ya da simge olur ("20 meters", "$43,803", "%50").
 * Iki harf sarti bilincli: "H2O" ve "m2" tek harfli, onlar us/alt simge
 * ve zaten baska daldan geciyor. Degisken alt simgeleri (beta1) de bu
 * daldan dusuyor — onlar da miktar degil. */
const DERS_KODU_RE = /\b[A-Za-z]{2,}\d{1,4}\b/g

/* BOSLUKLU DERS KODU: "BUS 110" (30.10.2026 olcumu).
 *
 * DERS_KODU_RE rakamin harflere YAPISIK olmasini istiyor (BUS211). Ayni
 * belgenin ust bilgisi ise "BUS 110 - Ipek Mete" yaziyor ve 110 rozete
 * miktar olarak girdi.
 *
 * Boslukluda kural DARALTILMAK ZORUNDA: "harf + bosluk + rakam" serbest
 * kalsa "about 250", "yaklasik 250", "toplam 500" gibi GERCEK miktarlar da
 * silinirdi. Bu yuzden uc sart birden: harfler TAMAMI BUYUK (ders kodlari
 * oyle yazilir, "about" degil), 3-5 harf (iki harfli "TL" disarida),
 * 2-4 rakam. Para/olcu kisaltmalari ayrica muaf: "USD 250" bir tutardir. */
/* SLAYT ALTBILGISI: "planned.13-38" (30.10.2026 olcumu).
 *
 * Slayt destelerinin altbilgisi bolum-slayt numarasi tasiyor (13-38, 7-28)
 * ve PDF cikariminda cumlenin sonuna YAPISIYOR:
 *   "...to ensure that it operates as planned.13-38 --- SAYFA 39 ---"
 * Jeton ".13" olarak okunuyor ve 0,13 diye OLCULEN bir deger sayiliyor.
 * Bu belgede metrigin buldugu TEK sayi buydu (0/1, %0); payda 4'un altinda
 * oldugu icin rozet yayinlanmadi, yani ogrenci gormedi — ama olcu yalan.
 * Ayni kalip ekonometri destesinde de vardi: 7-13, 7-28, 7-38, 7-41.
 *
 * Kural DAR: kucuk harf + nokta + N-NN. "12-25 miles wide" gercek bir
 * aralik ve oyle kalmali — onunde harf+nokta yok, onunde bosluk var. */
const SLAYT_ALTBILGI_RE = /[a-zçğıöşü]\.(\d{1,2}-\d{1,3})(?![\d-])/g

const KOD_DISI = new Set(['USD', 'EUR', 'TRY', 'GBP', 'CHF', 'JPY', 'KWH', 'RPM', 'BMI'])
const DERS_KODU_BOSLUKLU_RE = /\b([A-Z]{3,5})\s(\d{2,4})\b/g

/* ATIF ETIKETI SAYI DEGILDIR (29.10.2026 — iki bagimsiz olcum).
 *
 * "Chp 9 - Group Processes" kosusunda kapsama kayiplarinin baglami:
 *   9.4 <- "Figure 9.4 Groupthink: Antecedents, Symptoms, and..."
 *   9.5 <- "Figure 9.5 Fiedler's Contingency Theory of Leaders"
 * "Chp8 - Conformity" kosusunda:
 *   349 <- "urns his back on reality and truth” (p. 349)."
 *
 * Ucu de SEKIL/SAYFA etiketi: belgenin kendi numaralandirmasi, olculen bir
 * miktar degil. Kapsama olcusu MIKTAR olcuyor (bkz. CAG_YILI_RE yanindaki
 * ayni gerekce).
 *
 * YALNIZCA ONEKLI bicim eleniyor. Ciplak bolum numarasi ("9.3 Group
 * Decision Making" gibi bir gundem satiri) BILEREK disarida: onun icin
 * guvenli bir kural tek ornekten cikmaz ve "3.5 Million dollars" gibi
 * gercek miktarlari da yutabilir. Onek sarti o riski sifirliyor.
 *
 * 'ek' ve 'bolum' listede YOK: "ek 5 birim" gercek bir miktardir. */
/* ONUNDE RAKAM VARSA \b KIRILIYOR (30.10.2026 olcumu).
 *
 * Desen `\b` ile basliyordu. PDF cikariminda sayfa numarasi sozcuge
 * yapisabiliyor ve "29Figure 2.2" oluyor: '9' ile 'F' ikisi de kelime
 * karakteri, aralarinda SINIR YOK, yani `\bfigure` eslesmiyordu. Olculdu:
 *   "Figure 2.2 Independent..."    -> elendi
 *   "29Figure 2.2 Independent..."  -> ELENMEDI, rozete 2.2 olarak girdi
 * Yerine "onunde HARF olmasin": rakam serbest, boylece yapisik sayfa
 * numarasi engel degil, ama "configure 2.2" gibi sozcuk ici eslesme yine
 * engelli. */
const ATIF_ETIKETI_RE =
  /(?<![A-Za-z])(?:figure|fig|table|tablo|\u015fekil|sekil|chart|exhibit|slide|slayt|appendix|page|sayfa|chapter|section|equation|eq|pp|p)\s*\.?\s*\d+(?:\.\d+)*\b/gi

function distinctiveNumbers(text: string): number[] {
  const temiz = String(text || '')
    .replace(URL_BENZERI_RE, ' ')
    .replace(BOZUK_US_RE, '$1 ')
    .replace(CAG_YILI_RE, ' ')
    .replace(ATIF_ETIKETI_RE, ' ')
    .replace(DERS_KODU_RE, ' ')
    .replace(DERS_KODU_BOSLUKLU_RE, (tam: string, kod: string) => KOD_DISI.has(String(kod)) ? tam : ' ')
    /* Yalnizca NUMARA atiliyor, cumlenin son harfi ve noktasi kaliyor:
       "planned.13-38" -> "planned." */
    .replace(SLAYT_ALTBILGI_RE, (tam: string) => tam.slice(0, 2))
    .replace(SAYFA_ISARETI_RE, ' ')
  const out: number[] = []
  const gorulen = new Set<number>()
  for (const token of temiz.match(SAYI_BELIRTECI) || []) {
    // Ayracsiz 7+ hane olculmus bir deger degil, denklem nesnesinin bozuk
    // cikarimi: canli logda "kayip: 3210, 12010, 3152143210" — "x_1 x_2 x_3"
    // alt simgelerinin yan yana dizilmis hali. Kimlik/telefon da ayni sinif.
    if (/^\d{7,}$/.test(token)) continue
    const birincil = sayiOkumalari(token)[0]
    if (birincil === undefined) continue
    const v = Math.abs(birincil)
    const kesirli = v !== Math.trunc(v)
    /* YIL KURALI JETONUN NOKTALAMASINA TAKILIYORDU (30.10.2026 olcumu).
     *
     * SAYI_BELIRTECI (/\.?\d[\d.,]*​/) sondaki virgulu de yutuyor: "In the
     * fall of 1936, a magazine" icin jeton "1936," oluyor ve /^\d{4}$/
     * testi FALSE donuyor. Sonuc: yil kurali HIC calismiyor ve yil olculmus
     * bir miktar sayiliyor. "Week3 Chp2" kartinda rozet ogrenciye %25 dedi;
     * kayiplardan biri tam bu 1936'ydi. Daha onceki kosularda da gorulmustu
     * ("BUS211 week3": kayip 2015, 2012).
     *
     * Sekil testi artik SADELESMIS jetonla. Deger (v) zaten dogru
     * okunuyordu; kusur yalnizca sekil testindeydi. */
    const sadeJeton = token.replace(/^[.,]+|[.,]+$/g, '')
    // Yil hicbir zaman ayracla yazilmaz: "1,800 dolar" bir tutar, "1800" bir yil.
    const yil = !kesirli && v >= 1500 && v <= 2100 && /^\d{4}$/.test(sadeJeton)
    if (yil || (!kesirli && v < 100)) continue
    if (gorulen.has(v)) continue
    gorulen.add(v)
    out.push(v)
  }
  return out
}

/** Ozetteki tum sayilar, siralanmis mutlak degerler (ikili arama icin). */
function outputNumbers(text: string): number[] {
  const out: number[] = []
  for (const token of String(text || '').match(SAYI_BELIRTECI) || []) {
    for (const v of sayiOkumalari(token)) out.push(Math.abs(v))
  }
  return out.sort((a, b) => a - b)
}

function yakinDegerVar(sirali: number[], v: number): boolean {
  const alt = v * (1 - SAYISAL_KAPSAMA_TOLERANS)
  const ust = v * (1 + SAYISAL_KAPSAMA_TOLERANS)
  let lo = 0, hi = sirali.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sirali[mid] < alt) lo = mid + 1
    else hi = mid
  }
  return lo < sirali.length && sirali[lo] <= ust
}

/** Olcuye girmeyen alanlar. footnotes kaynaktan BIREBIR alinti tasir — onu
 *  saymak "ozet bu sayiyi ogretti mi" sorusunu "kaynak kendini tekrar etti mi"
 *  sorusuna cevirir. Digerleri sayfa numarasi ve kimlik tasir. */
/* Rozet basmak icin gereken en az hedef sayi — bkz. qualityMeta.numeric_coverage. */
const KAPSAMA_ROZET_MIN_ORNEK = 4

const KAPSAMA_DISI_ALANLAR = new Set([
  'footnotes', 'quality_meta', 'outline', 'document_id', 'user_id',
  'page', 'page_start', 'page_end', 'source_pages'
])

function coverageText(obj: unknown): string {
  if (typeof obj === 'string') return obj
  try {
    return JSON.stringify(obj, (k, v) => (KAPSAMA_DISI_ALANLAR.has(k) ? undefined : v)) || ''
  } catch {
    return ''
  }
}

function numericCoverage(
  sourceText: string,
  output: unknown
): { total: number; kept: number; missing: number[] } {
  const hedef = distinctiveNumbers(sourceText)
  if (hedef.length === 0) return { total: 0, kept: 0, missing: [] }
  const cikti = outputNumbers(coverageText(output))
  const missing: number[] = []
  let kept = 0
  for (const v of hedef) {
    if (yakinDegerVar(cikti, v)) kept++
    else missing.push(v)
  }
  return { total: hedef.length, kept, missing }
}

/* KAYIP SAYILARIN BAGLAMI (28.10.2026).
 *
 * Olcum sekiz ardisik kosuda ayni orani ve ayni sekiz sayiyi bildirdi:
 *   Son kart sayisal kapsama: 7/15 (%47) — kayip: 3787, 976, 765, 0.3,
 *   0.798, 805, 0.123, 0.24
 * Groq yolunda da, Gemini devre kesicisi acikken de, iki pencerede de uc
 * pencerede de AYNI. Yani kayip butceyle, pencere sayisiyla ya da motorla
 * ilgili degil — belgenin o dilimindeki bu sekiz sayiyi hicbir yol almiyor.
 *
 * Ama satir sayiyi soyluyor, YERINI soylemiyor. Bu sekiz deger ders
 * icerigi ise kusur modelin cikariminda; kaynakca sayfa araligi, DOI ya da
 * istatistik tablosu artigi ise kusur KAPIDA ve kart aslinda saglam.
 * Ikisi tamamen farkli isler ve logdan ayirt edilemiyor. Tahmin yurutmek
 * yerine bir kosu olcsun diye baglam basiliyor (bkz. CLAUDE.md bolum 9).
 *
 * Ayni belirteci (SAYI_BELIRTECI) ve ayni okumayi (sayiOkumalari)
 * kullaniyor, yani basilan baglam sayinin GERCEKTEN cikarildigi yer —
 * ikinci bir ayristirici tahmini degil.
 *
 * "KAYNAKTA BULUNAMADI" kendi basina bulgu: kayip diye bildirilen bir deger
 * ayni metinde yeniden bulunamiyorsa sorun modelde degil olcumun
 * kendisinde. */
function sayisalKayipBaglami(sourceText: string, missing: number[], enFazla = 5): string {
  const metin = String(sourceText || '')
  const aranan = missing.slice(0, enFazla)
  if (aranan.length === 0 || !metin) return ''
  const istenen = new Set(aranan)
  const bulunan = new Map<number, string>()
  /* Kendi lastIndex'i: SAYI_BELIRTECI modul duzeyinde /g ve paylasilan bir
     regex nesnesinin lastIndex'ini tasimak baska cagiranlari bozar. */
  const re = new RegExp(SAYI_BELIRTECI.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(metin)) !== null) {
    for (const okuma of sayiOkumalari(m[0])) {
      const v = Math.abs(okuma)
      if (!istenen.has(v) || bulunan.has(v)) continue
      const bas = Math.max(0, m.index - SAYISAL_BAGLAM_KRK)
      const son = Math.min(metin.length, m.index + m[0].length + SAYISAL_BAGLAM_KRK)
      bulunan.set(v, metin.slice(bas, son).replace(/\s+/g, ' ').trim())
    }
    if (bulunan.size === istenen.size) break
    // Sifir uzunluklu eslesme olamaz (desen en az bir hane istiyor), yine de
    // sonsuz dongu olmasin.
    if (m[0].length === 0) re.lastIndex++
  }
  return aranan
    .map((v) => `${v} <- ${bulunan.has(v) ? `"${bulunan.get(v)}"` : 'KAYNAKTA BULUNAMADI'}`)
    .join(' | ')
}

function formatCoverage(cov: { total: number; kept: number; missing: number[] }): string {
  if (cov.total === 0) return 'olculecek ayirt edici sayi yok'
  const oran = Math.round((100 * cov.kept) / cov.total)
  if (cov.missing.length === 0) return `${cov.kept}/${cov.total} (%${oran})`
  const ornek = cov.missing.slice(0, SAYISAL_KAPSAMA_ORNEK).join(', ')
  const fazla = cov.missing.length > SAYISAL_KAPSAMA_ORNEK
    ? ` +${cov.missing.length - SAYISAL_KAPSAMA_ORNEK}`
    : ''
  return `${cov.kept}/${cov.total} (%${oran}) — kayip: ${ornek}${fazla}`
}

/**
 * sourceText is optional on purpose: the chunked and single-pass pipelines
 * reach this from different places, and a caller that cannot supply the text
 * should still get the structural checks rather than no checks.
 */
function sanitizeCharts(charts: any[], sourceText?: string): { charts: any[]; dropped: Array<{ title: string; reason: string }> } {
  const list = Array.isArray(charts) ? charts : []
  const out: any[] = []
  const dropped: Array<{ title: string; reason: string }> = []

  for (const c of list) {
    const title = String(c?.title || '(isimsiz)').slice(0, 40)
    const rawData = Array.isArray(c?.data) ? c.data : []
    const rawLabels = Array.isArray(c?.labels) ? c.labels : []

    // Keep only points that are real numbers. A string "12%" or a null is not
    // plottable, and silently coercing it is how a 0 gets into the series in
    // the first place.
    const paired: Array<{ label: string; value: number }> = []
    for (let i = 0; i < rawData.length; i++) {
      const v = typeof rawData[i] === 'number' ? rawData[i] : Number(rawData[i])
      if (!Number.isFinite(v)) continue
      paired.push({ label: String(rawLabels[i] ?? ''), value: v })
    }

    if (paired.length < CHART_MIN_POINTS) {
      dropped.push({ title, reason: `sayisal veri yok (${paired.length} gecerli nokta)` })
      continue
    }

    // Every value identical — including the all-zero case this gate exists
    // for — carries no information at any chart type.
    const distinct = new Set(paired.map(p => p.value))
    if (distinct.size < 2) {
      dropped.push({ title, reason: `tum degerler ayni (${[...distinct][0]})` })
      continue
    }

    // Are these numbers in the document, or did the model supply them?
    //
    // The all-identical check above catches the zero-filled chart, which is
    // how a model fabricates when it is TRYING to comply. It does not catch
    // the more dangerous case: a figure the model cannot see, filled with
    // varied, plausible values it knows from training. A flat line at zero
    // looks broken at a glance; "GDP: 14.9, 15.4, 16.1" looks right and is
    // not from this document.
    //
    // Same principle as applyGroundingGate for terms and points — a claim
    // that cannot be traced to the source does not ship.
    if (sourceText) {
      const inSource = sourceNumbers(sourceText)
      const found = paired.filter(p =>
        inSource.has(p.value) ||
        inSource.has(Math.round(p.value)) ||
        inSource.has(Math.round(p.value * 10) / 10)
      ).length
      if (found / paired.length < CHART_MIN_GROUNDED_RATIO) {
        dropped.push({
          title,
          reason: `sayilar kaynakta yok (${found}/${paired.length} bulundu)`
        })
        continue
      }
    }

    // A pie of negative or zero slices cannot be drawn; such data is almost
    // always a line/bar series the model mislabelled.
    let type = String(c?.type || '').toLowerCase().trim()
    if (!CHART_TYPES.includes(type)) type = 'bar'
    if (type === 'pie' && paired.some(p => p.value <= 0)) type = 'bar'

    out.push({
      ...c,
      type,
      labels: paired.map((p, i) => p.label || String(i + 1)),
      data: paired.map(p => p.value)
    })
  }

  return { charts: out, dropped }
}

// ==========================================================================
// NARRATIVE YEAR GATE — the one blind spot applyGroundingGate has
//
// applyGroundingGate judges key_terms and key_points. It does not judge the
// prose: "summary", "summary_executive" and sections[].summary are written by
// the narrative writer AFTER the gate has run, and nothing checks them. That
// is where the model's own world knowledge leaks back in, and it leaks as
// specifics — exactly the specifics a student would be tested on.
//
// Observed twice in eleven runs of the same 30-page deck, with the gate
// reporting "25 kept / 0 dropped" both times:
//     "the Great Depression (1929-1933)"
// The source says "began in 1929 and continued throughout the 1930s" and
// never mentions 1933 anywhere.
//
// A four-digit year is the one claim class that can be checked literally: it
// is either in the source or it is not, with no paraphrase to reason about.
// So this gate is deliberately narrow — it only judges years, and it only
// REWRITES the two shapes where a rewrite is provably grammatical:
//
//   1. a parenthetical made of nothing but year material  -> drop it whole
//      ("the Great Depression (1929-1933)" -> "the Great Depression")
//   2. a range with one supported endpoint -> keep that endpoint
//      ("from 1929-1933" -> "from 1929")
//
// Anything else — a bare unsupported year mid-sentence — is reported and left
// alone. Editing prose blind is how a gate starts causing the damage it was
// added to prevent, and a logged year we can act on beats a mangled sentence
// we cannot.
const YEAR_RE = /\b(1[89]\d{2}|20\d{2})\b/g
// The model writes ranges with whatever dash it likes, including U+2011
// NON-BREAKING HYPHEN — the same character class that once made the grounding
// gate drop "fine-tuning" as fabricated.
const YEAR_RANGE_RE = /\b(1[89]\d{2}|20\d{2})\s*[-‐-―]\s*(1[89]\d{2}|20\d{2})\b/g
// A parenthetical safe to delete: years, separators and whitespace only.
const YEAR_ONLY_PAREN_RE = /\s*\(([\d\s,;./‐-―-]*)\)/g

function yearInSource(year: string, sourceText: string): boolean {
  return new RegExp(`(?<![\\d])${year}(?![\\d])`).test(sourceText)
}

function scrubUnsupportedYears(
  text: string,
  sourceText: string
): { text: string; removed: string[]; flagged: string[] } {
  let out = String(text || '')
  if (!out) return { text: out, removed: [], flagged: [] }

  const removed: string[] = []
  const supported = (y: string) => yearInSource(y, sourceText)

  // (1) Parentheticals that carry nothing but year material.
  out = out.replace(YEAR_ONLY_PAREN_RE, (whole, inner: string) => {
    const years = String(inner).match(YEAR_RE) || []
    if (!years.length) return whole                       // "(3)" etc — not ours
    const bad = years.filter(y => !supported(y))
    if (!bad.length) return whole
    /* LOG YALAN SOYLUYORDU (24.10.2026).
     *
     * Parantez butunuyle silindiginde icindeki DESTEKLENEN yillar da
     * gidiyor, ama `removed`'a yalnizca desteklenmeyenler yaziliyordu.
     * Olculdu, kaynak "began in 1929":
     *   "Great Depression (1929-1933), the post-war era."
     *     -> "Great Depression, the post-war era."   removed: ["1933"]
     * 1929 metinden cikti ama hicbir yerde yazmadi.
     *
     * DAVRANIS BILEREK DEGISTIRILMEDI. Parantezli yarim bir aralik —
     * "(1929)" — okuyana tam bir tarih gibi gorunur ve yanlis bilgi verir;
     * bu yuzden parantezin tumden silinmesi savunulabilir bir editoryal
     * karar ve "karttan birebir" notuyla teste baglanmis durumda. Degisen
     * tek sey RAPORLAMA: `removed` artik metinden gercekten cikan butun
     * yillari tasiyor, yani log olanı oldugu gibi soyluyor.
     *
     * Not: parantezsiz ayni aralik (2) numarali onarimda desteklenen ucu
     * KORUYOR. Iki bicimin farkli davranmasi kasitli; biri cumle icinde
     * akan bir tarih, oteki parantez icinde bir kunye. */
    removed.push(...years)
    return ''
  })

  // (2) Ranges where exactly one endpoint is supported — keep that endpoint.
  out = out.replace(YEAR_RANGE_RE, (whole, a: string, b: string) => {
    const aOk = supported(a)
    const bOk = supported(b)
    if (aOk && bOk) return whole
    if (aOk) { removed.push(b); return a }
    if (bOk) { removed.push(a); return b }
    return whole                                          // both bad — flagged below
  })

  // Whatever unsupported year survives both passes stays in the text.
  const flagged = [...new Set((out.match(YEAR_RE) || []).filter(y => !supported(y)))]
  // Deleting a parenthetical can leave a doubled space or a space before a
  // comma/period.
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim()

  return { text: out, removed: [...new Set(removed)], flagged }
}

function sanitizeNarrativeYears(
  draft: any,
  sourceText: string
): { changed: number; removed: string[]; flagged: string[] } {
  const removed: string[] = []
  const flagged: string[] = []
  let changed = 0
  if (!draft || typeof draft !== 'object' || !sourceText) {
    return { changed, removed, flagged }
  }

  for (const field of ['summary', 'summary_executive']) {
    if (typeof draft[field] !== 'string') continue
    const r = scrubUnsupportedYears(draft[field], sourceText)
    if (r.text !== draft[field]) { draft[field] = r.text; changed++ }
    removed.push(...r.removed)
    flagged.push(...r.flagged)
  }

  if (Array.isArray(draft.sections)) {
    for (const s of draft.sections) {
      if (!s || typeof s.summary !== 'string') continue
      const r = scrubUnsupportedYears(s.summary, sourceText)
      if (r.text !== s.summary) { s.summary = r.text; changed++ }
      removed.push(...r.removed)
      flagged.push(...r.flagged)
    }
  }

  return { changed, removed: [...new Set(removed)], flagged: [...new Set(flagged)] }
}

// ==========================================================================
// QUALITY GATE — drop what the document does not support
//
// The anchoring machinery above already answers, for every claim, "do this
// claim's distinctive words appear in the source?". Until now a claim that
// answered no was merely left uncited. But that answer is worth more than
// that: a claim whose distinctive vocabulary appears NOWHERE in a 50-page
// document is not a paraphrase, it is something the model supplied from
// outside the source — exactly what a grounded study tool must not show.
//
// The distinction that matters, and the reason this gate is deliberately
// narrow:
//
//   LOW overlap  -> a legitimate paraphrase. The model used synonyms, or
//                   summarised across pages. KEEP IT. Dropping these would
//                   strip the summary of its best writing.
//   ZERO overlap -> with three or more distinctive terms and a whole
//                   document to match against, zero is not word choice.
//                   DROP IT.
//
// Key terms are judged more strictly than key points, because a term is
// supposed to be lifted from the document, not composed. Turkish
// suffixation happens to help here: a substring test matches the stem
// ("esneklik" is found inside the document's "esnekliği"), so a real term
// is found even in an inflected document.
// ==========================================================================

/**
 * Normalisation for the gate's substring test.
 *
 * The first live run exposed why this has to do more than lowercase: the
 * gate dropped "Fine‑tuning", "Goods‑and‑services market" and "Inflation
 * rate (GDP deflator)" as fabrications when all three are straight out of
 * the chapter. The model writes typographic punctuation — the hyphen in
 * "Fine‑tuning" is U+2011 NON-BREAKING HYPHEN — while the PDF's own text
 * has a plain hyphen, or just a space ("goods and services"). Comparing
 * those literally can only fail.
 *
 * So every dash variant AND every other punctuation mark becomes a space,
 * and runs of whitespace collapse. "Fine‑tuning", "fine-tuning" and "fine
 * tuning" all normalise to "fine tuning", and the parentheses in
 * "Inflation rate (GDP deflator)" stop welding themselves to the words
 * inside. Letters and digits are the only things that survive, which is
 * also what anchorTerms() already does — this brings the two comparisons
 * into agreement.
 *
 * Dropping a real term is the expensive failure here: it deletes correct
 * content from the student's card and inflates the "model is fabricating"
 * signal in the logs.
 */
function gateNormalize(s: string): string {
  // Buyuk "I" icin bkz. trNormalize: 'İ'.toLowerCase() birlesen nokta
  // uretiyor ve asagidaki temizlik onu bosluga cevirip kelimeyi boluyordu.
  return trNormalize(s)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')   // dashes, quotes, brackets, punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

// A claim needs at least this many distinctive terms before "none of them
// appear" is evidence of anything rather than just a short sentence.
const GATE_MIN_TERMS_TO_JUDGE = 3
// Past this share of judged claims, the gate distrusts ITSELF rather than the
// model and drops nothing (see the safety valve in applyGroundingGate).
const GATE_MAX_DROP_SHARE = 0.6

type GroundingStats = {
  termsKept: number; termsDropped: number; droppedTerms: string[]
  pointsKept: number; pointsDropped: number; droppedPoints: string[]
  score: number | null
  aborted?: boolean
  /* Supap hangi populasyon icin acildi — bkz. terimSupabi/maddeSupabi. */
  abortedTerms?: boolean
  abortedPoints?: boolean
  /* Kapi OLCUM modunda kostu: sayilar gercek, hicbir sey dusurulmedi.
     Bkz. applyGroundingGate'in olcumModu parametresi. */
  olcumModu?: boolean
}

/**
 * Drop key terms and key points the document does not support.
 *
 * Returns new arrays plus a grounding score (share of judgeable claims that
 * were supported) so the log shows which documents the model is inventing
 * on — a number to watch over time, not just a one-off fix.
 */
// `visionGrounded` holds the normalised text of claims that came from the
// VISION pass rather than from the extracted text, and exempts them.
//
// Without it the gate and the vision pass work against each other by
// construction: the gate asks "does the document's text support this claim",
// and the vision pass exists precisely to recover what the text does NOT
// contain. Every term it contributes is therefore a candidate for being
// called a fabrication.
//
// Observed live the first time the vision pass actually ran: it read "First
// oil shock" / "Second oil shock" off the axis annotations of Figure 20.2 and
// the gate dropped "Oil shock" as invented. The phrase occurs zero times in
// the extracted text and is plainly there in the image — the claim was true
// and the gate was judging it against a source that cannot contain it.
//
// These claims are not ungrounded, they are grounded in a source this
// function cannot read, so they are passed through and counted as kept.
/* ===========================================================================
   COZUMLU ORNEKLERIN SAYILARI DA DAYANDIRILIR
   ===========================================================================
   08.10.2026, canli ekonometri destesinde olculdu. Grounding gate
   "score=100%, 0 dropped" dedi ve ayni kartta su cozumlu ornek vardi:

     "Given the estimated quadratic model
      UtilityBill = 208.12 - 0.09*Temp + 0.0012*Temp^2 ..."

   Kaynaktaki gercek denklem (slayt 28):

     UtilityBill = 484.12 - 12.08*temp + 0.09*temp^2

   Dort katsayidan ucu uydurma. Daha kotusu, ornegin VARDIGI sonuclar
   (40 derecede -5.06 dolar, minimum 67.1 derece) kaynaktaki DOGRU
   sonuclar — ama yazdigi denklemden cikmiyorlar. Metin bunu kendi icinde
   itiraf bile ediyor ("using the provided numbers yields -0.0054, i.e., a
   $5.06 drop"). Dogru cevap, yanlis denklem: adimlari tekrar etmeye
   calisan ogrenci icin en kotu hata turu.

   Kapi bunu goremezdi, cunku YALNIZCA key_terms ve key_points'e bakiyordu.
   Oysa uydurma sayinin en cok zarar verdigi yer tam olarak cozumlu ornek.

   YALNIZCA problem_statement YARGILANIR. steps ve final_answer modelin
   KENDI hesapladigi sayilari tasir; onlarin kaynakta gecmemesi dogaldir.
   Ayirt edici olmayan sayilar (tek-iki haneli tam sayilar: 2, 40, 100) da
   elenir, yoksa her ornek yanlis yere takilir. Esik grafik kapisiyla ayni
   (CHART_MIN_GROUNDED_RATIO): yarisindan fazlasi dayanaksizsa atilir.
   =========================================================================== */
function gateWorkedExamples(
  examples: any[],
  sourceText: string
): { kept: any[]; dropped: string[] } {
  const list = Array.isArray(examples) ? examples : []
  if (!sourceText || sourceText.length < 200 || list.length === 0) {
    return { kept: list, dropped: [] }
  }
  const inSource = sourceNumbers(sourceText)
  const dropped: string[] = []

  const kept = list.filter((ex: any) => {
    const verilen = String(ex?.problem_statement || '')
    if (!verilen) return true
    // Ayirt edici sayilar: ondalikli, ya da uc+ basamakli.
    const adaylar = (verilen.match(/-?\d[\d.,]*/g) || [])
      .map(t => Number(t.replace(/[.,]+$/, '').replace(/,(?=\d{3}\b)/g, '')))
      .filter(v => Number.isFinite(v) && (Math.abs(v) >= 100 || !Number.isInteger(v)))
    if (adaylar.length < 2) return true          // yargilayacak kadar sayi yok
    /* YUVARLAMA TOLERANSI YALNIZCA BUYUK SAYILARA. sourceNumbers her degerin
       yuvarlanmisini da kumeye koyuyor ("17.042 milyar" -> 17000 okumasi
       gercek bir davranis). Ama 0.0012 yuvarlaninca 0 oluyor ve her metinde
       0 vardir — yani kucuk ondalikli her uydurma sayi "dayanakli" cikiyor.
       Ilk yazimda tam bu yuzden kapi GERCEK uydurma ornegi kacirdi. */
    const dayanan = adaylar.filter(v => {
      if (inSource.has(v)) return true
      if (Math.abs(v) < 10) return false
      return inSource.has(Math.round(v)) || inSource.has(Math.round(v * 10) / 10)
    }).length
    if (dayanan / adaylar.length >= CHART_MIN_GROUNDED_RATIO) return true
    dropped.push(
      `${String(ex?.title || 'baslıksız').slice(0, 40)} ` +
      `(${adaylar.length - dayanan}/${adaylar.length} sayi kaynakta yok)`
    )
    return false
  })

  return { kept, dropped }
}

/* ===========================================================================
   COZUMLU ORNEK: ADIMLAR VE ARITMETIK (09.10.2026)

   gateWorkedExamples yalnizca problem_statement'a bakiyor; adimlardaki
   katsayilar ise orada hic gecmeyebilir. Canli iki kosuda ayni ornek:

     "Obtain coefficients: β1 = -9.0, β2 = 0.1212"
     "At Temp=40: dY/dTemp = -9.0 + 2(0.1212)(40) = -5.06"
     "Temp* = -β1/(2β2) = 11.67/0.2424 ≈ 67.11"

   Kaynakta β1 = −12.08, β2 = 0.09. Sonuclar (−5.06, 67.11) kaynaktan
   kopyalanmis, katsayilar uydurulmus — ve aritmetik kendini ele veriyor:
   −9.0 + 2(0.1212)(40) = 0.696, 11.67/0.2424 = 48.1. Ogrencinin adim adim
   tekrar edecegi bir ornekte bu, yanlis cevaptan beter: dogru cevap, yanlis
   yol.

   Kapi kaynaga bakmiyor, ornegin KENDI ICINDE tutarli olup olmadigina
   bakiyor: "sayisal ifade = sayi" biciminde her esitlik hesaplanir.
   Sembolik esitlikler (β1 + 2β2x = 0, x* = −β1/(2β2)) atlanir — ifadenin
   bitisiginde harf varsa hesaplanacak bir sey yoktur.
   =========================================================================== */

/** Adimlari temizle: tek dizgiye sikistirilmis "1. … 2. … 3. …" ayrilir,
 *  her adimin basindaki numara silinir (arayuz zaten numaraliyor; ikisi
 *  birden "1. 1. Fit model" oluyordu). */
function normalizeExampleSteps(steps: any): string[] {
  const raw: string[] = (Array.isArray(steps) ? steps : (steps == null ? [] : [steps]))
    .map((s: any) => (typeof s === 'string' ? s : (s && typeof s === 'object' ? String(s.text || s.step || s.description || '') : String(s ?? ''))))
  const out: string[] = []
  for (const s of raw) {
    for (const part of splitInlineSteps(s)) {
      const clean = part.replace(/^\s*(?:(?:step|adım|adim)\s*)?\d{1,2}\s*[.):]\s+/i, '').trim()
      if (clean) out.push(clean)
    }
  }
  return out
}

/** "1. A 2. B 3. C" -> ["1. A", "2. B", "3. C"]. Yalnizca 1'den baslayan
 *  ve ardisik ilerleyen numaralar bolme noktasi sayilir: "0.1212. 3." gibi
 *  ondalik sonu ya da tek bir "2." metnin ortasinda bolme yaratmaz. */
function splitInlineSteps(s: string): string[] {
  const text = String(s || '')
  const re = /(^|\s)(\d{1,2})[.)]\s+(?=\D)/g
  const marks: Array<{ n: number; at: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    marks.push({ n: Number(m[2]), at: m.index + m[1].length })
  }
  const seq: Array<{ n: number; at: number }> = []
  for (const mk of marks) {
    const want = seq.length === 0 ? 1 : seq[seq.length - 1].n + 1
    if (mk.n === want) seq.push(mk)
  }
  if (seq.length < 2 || text.slice(0, seq[0].at).trim() !== '') return [text]
  const parts: string[] = []
  for (let i = 0; i < seq.length; i++) {
    parts.push(text.slice(seq[i].at, i + 1 < seq.length ? seq[i + 1].at : undefined).trim())
  }
  return parts
}

/* KEY_POINTS VERITABANINA TEK SEKILDE GIDER (29.10.2026 olcumu).
 *
 * ACCOUNTING chapter 7 kartinda "akilda kalsin" listesinde 11 satir
 * `[object Object]` olarak cikti. Olculdu: key_points 32 maddenin 11'i duz
 * metin degil `{ text: "..." }` NESNESI. Atif numaralari da o yuzden
 * eksikti ([1], [4], [7], [10], [13], [16], [19], [22], [25], [27]) —
 * arayuz nesneyi metin sanip dogrudan basiyor.
 *
 * Kaynak sunucu degil MODEL: 4 pencereden biri maddeleri nesne olarak
 * yazdi (11/32 tam bir pencerenin payi). Sunucu tarafi iki sekli de
 * okuyor — anchorCitations'taki readText/writeText ikilisi sekli bilerek
 * KORUYOR, applyDensityGate ve grounding kapisi da `oku()` ile ikisini de
 * anliyor — ama veritabani tek sekil tasimak zorunda, cunku arayuz
 * elemani ciplak basiyor.
 *
 * Bu yuzden duzlestirme TEK CIKISTA: atiflar islendikten SONRA, kart
 * kurulmadan once. Oncesinde duzlestirmek atif sisteminin nesne icindeki
 * alanlari kullanma hakkini elinden alirdi. */
/* KURTARMA BOS KABUK BIRAKIYOR (30.10.2026 olcumu).
 *
 * "Building IS ... Planlama Analysis2" kosusunda kesik JSON kurtarildi:
 *   Window 2: JSON KESIKTI, kapatilip kurtarildi (7133 krk -> 5162 krk)
 *   Window 2 ok: terms=8 points=9 quiz=5
 * Pencere eskiden TAMAMEN duserdi, yani kurtarma dogru isi yapti. Ama
 * closeTruncatedJson yarida kesilen nesneyi oldugu yerde KAPATIYOR:
 *   {"term":"Outsourcing"          ->  {"term":"Outsourcing"}
 * Sonuc: terim var, TANIM YOK. Kartta 15 kavramin 8'i bos kart olarak
 * cizildi (End-user development, Outsourcing, RAD, JAD, Agile development,
 * Work breakdown structure, System analysis, Application software packages).
 *
 * Bos kabuk ogrenciye hicbir sey anlatmiyor ve ekranda bosluk olarak
 * gorunuyor — gostermektense dusurmek dogru. "Icerik kaybi" DEGIL: kaybolan
 * sey zaten yoktu, yalnizca kabugu kalmisti.
 *
 * Grounding kapisi bunu yakalamiyor: o terimin KAYNAKTA gecip gecmedigine
 * bakiyor, tanimin dolu olup olmadigina bakmiyor (olculen kosuda
 * "terms 15 kept / 0 would-drop" yazdi). */
function bosKabuklariAyikla(parsed: any): Record<string, number> {
  const dusen: Record<string, number> = {}
  const say = (ad: string, n: number) => { if (n > 0) dusen[ad] = n }
  const dolu = (v: any) => String(v ?? '').trim().length > 0

  if (Array.isArray(parsed?.key_terms)) {
    const once = parsed.key_terms.length
    parsed.key_terms = parsed.key_terms.filter(
      (t: any) => t && typeof t === 'object' && dolu(t.term) && dolu(t.definition)
    )
    say('key_terms', once - parsed.key_terms.length)
  }
  if (Array.isArray(parsed?.quiz_questions)) {
    const once = parsed.quiz_questions.length
    /* Cevapsiz soru da bos kabuk: "KENDINI SINA" bolumu cevabi aciyor. */
    parsed.quiz_questions = parsed.quiz_questions.filter(
      (q: any) => q && typeof q === 'object' && dolu(q.question) && dolu(q.answer)
    )
    say('quiz_questions', once - parsed.quiz_questions.length)
  }
  if (Array.isArray(parsed?.sections)) {
    const once = parsed.sections.length
    // Baslıksiz bolum ciziliyor ama adi olmadigi icin gezinilemez.
    parsed.sections = parsed.sections.filter(
      (sec: any) => sec && typeof sec === 'object' && dolu(sec.heading)
    )
    say('sections', once - parsed.sections.length)
  }
  if (Array.isArray(parsed?.worked_examples)) {
    const once = parsed.worked_examples.length
    parsed.worked_examples = parsed.worked_examples.filter(
      (w: any) => w && typeof w === 'object' && (dolu(w.title) || dolu(w.prompt) || dolu(w.question))
    )
    say('worked_examples', once - parsed.worked_examples.length)
  }
  return dusen
}

function duzMaddeMetni(raw: any): string {
  if (typeof raw === 'string') return raw
  if (raw == null) return ''
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw)
  if (Array.isArray(raw)) return raw.map(duzMaddeMetni).filter(Boolean).join(' ')
  const t = raw.text ?? raw.point ?? raw.content ?? raw.value
  return typeof t === 'string' ? t : ''
}

function normalizeKeyPoints(points: any[]): { key_points: string[]; duzlesen: number } {
  const list = Array.isArray(points) ? points : []
  let duzlesen = 0
  const out: string[] = []
  for (const p of list) {
    if (typeof p !== 'string') duzlesen++
    const metin = duzMaddeMetni(p).trim()
    /* Metni cikarilamayan madde ZATEN ekranda `[object Object]` olacakti;
       dusurmek onu basmaktan iyidir. */
    if (metin) out.push(metin)
  }
  return { key_points: out, duzlesen }
}

function normalizeWorkedExamples(examples: any[]): any[] {
  return (Array.isArray(examples) ? examples : []).map((ex: any) =>
    ex && typeof ex === 'object' ? { ...ex, steps: normalizeExampleSteps(ex.steps) } : ex)
}

/** Kucuk aritmetik degerlendirici: sayilar, + − * / ^, parantez, ortuk carpim
 *  ("2(0.09)39"). Gecersiz girdide null. */
function evalArithmetic(expr: string): number | null {
  const src = String(expr || '')
  let i = 0
  const peek = () => src[i]
  const skip = () => { while (i < src.length && /\s/.test(src[i])) i++ }
  function number(): number | null {
    skip()
    const m = /^(\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/.exec(src.slice(i))
    if (!m) return null
    i += m[0].length
    return Number(m[0])
  }
  function primary(): number | null {
    skip()
    if (peek() === '(') {
      i++
      const v = sum()
      skip()
      if (v === null || peek() !== ')') return null
      i++
      return v
    }
    return number()
  }
  function power(): number | null {
    const base = primary()
    if (base === null) return null
    const once = i
    skip()
    if (peek() === '^') {
      i++
      const e = unary()
      return e === null ? null : Math.pow(base, e)
    }
    // Boslugu tuketme: product() bosluktan sonraki rakami ortuk carpim
    // saymamak icin boslugun orada oldugunu gormeli.
    i = once
    return base
  }
  function unary(): number | null {
    skip()
    if (peek() === '-') { i++; const v = unary(); return v === null ? null : -v }
    if (peek() === '+') { i++; return unary() }
    return power()
  }
  function product(): number | null {
    let v = unary()
    if (v === null) return null
    for (;;) {
      const once = i
      skip()
      const c = peek()
      // Bosluktan sonra gelen rakam ortuk carpim DEGIL: "hafta 3 15 + 2"
      // 3*15 okunursa dogru bir hesap yanlis gorunur. Ortuk carpim yalnizca
      // parantez bitisikliginde: 2(0.09), (0.09)39, (a)(b).
      if (i > once && c !== undefined && /[\d.]/.test(c)) return v
      if (c === '*' || c === '/') {
        i++
        const r = unary()
        if (r === null) return null
        v = c === '*' ? v * r : v / r
      } else if (c === '(' || (c !== undefined && /[\d.]/.test(c))) {
        // ortuk carpim: 2(0.09) ya da (0.09)39
        const r = power()
        if (r === null) return null
        v = v * r
      } else {
        return v
      }
    }
  }
  function sum(): number | null {
    let v = product()
    if (v === null) return null
    for (;;) {
      skip()
      const c = peek()
      if (c !== '+' && c !== '-') return v
      i++
      const r = product()
      if (r === null) return null
      v = c === '+' ? v + r : v - r
    }
  }
  const v = sum()
  skip()
  return v !== null && i === src.length && Number.isFinite(v) ? v : null
}

/** Esitlik denetimi icin metni duzle: Unicode isaretler, para/yuzde, ust
 *  simge rakamlari, binlik/ondalik virgul. */
function normalizeArithmeticText(s: string): string {
  return String(s || '')
    .replace(/[−–]/g, '-')
    .replace(/[×·⋅∗]/g, '*')
    .replace(/÷/g, '/')
    .replace(/≈|≅/g, '=')
    .replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/[$€£₺%]/g, '')
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
    .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2')
}

const ARITH_RUN_CHARS = /[0-9.+\-*/^()\s]/
const ARITH_TOLERANCE = 0.02

/** Bir metindeki "sayisal ifade = sayi" esitliklerinin hepsi tutuyor mu? */
function checkArithmetic(text: string): { checked: number; failures: string[] } {
  const s = normalizeArithmeticText(text)
  const segs = s.split('=')
  const failures: string[] = []
  let checked = 0
  for (let k = 0; k + 1 < segs.length; k++) {
    const left = segs[k]
    const right = segs[k + 1]
    // Soldaki segmentin SONUNDAKI sayisal kosu
    let a = left.length
    while (a > 0 && ARITH_RUN_CHARS.test(left[a - 1])) a--
    const before = left[a - 1]
    // Harf/alt cizgi/ters bolu BITISIKSE ifade sembolik ("2β2*39"):
    // hesaplanacak sey yok. Arada bosluk varsa ("slope 98 + 45") onceki
    // kelime duz yazidir, hesap hesaptir.
    const bitisik = a < left.length && !/\s/.test(left[a])
    if (before !== undefined && bitisik && /[A-Za-zα-ωΑ-Ω_\\']/.test(before)) continue
    let lhs = left.slice(a).trim().replace(/^[+*/^]+/, '').trim()
    // Sagdaki segmentin BASINDAKI sayisal kosu
    let b = 0
    while (b < right.length && ARITH_RUN_CHARS.test(right[b])) b++
    const run = right.slice(0, b)
    const after = right[b]
    if (after !== undefined && run === run.trimEnd() && /[A-Za-zα-ωΑ-Ω_]/.test(after)) continue
    let rhs = run.trim().replace(/[.+\-*/^]+$/, '').trim()
    lhs = lhs.replace(/[.+\-*/^]+$/, '').trim()
    if (!/\d/.test(lhs) || !/\d/.test(rhs)) continue
    // Sol taraf bir HESAP olmali (en az iki sayi ve bir islem); "40 = 40" degil.
    if ((lhs.match(/\d+(?:\.\d+)?|\.\d+/g) || []).length < 2) continue
    const L = evalArithmetic(lhs)
    const R = evalArithmetic(rhs)
    if (L === null || R === null) continue
    checked++
    const tol = Math.max(0.015, ARITH_TOLERANCE * Math.max(Math.abs(L), Math.abs(R)))
    if (Math.abs(L - R) > tol) {
      failures.push(`${lhs} = ${Math.round(L * 1000) / 1000}, yazilan ${rhs}`)
    }
  }
  return { checked, failures }
}

/* ===========================================================================
   REVIEW SORUNLARININ SUZULMESI (09.10.2026)

   Review'in quality_gate.issues listesi critic'e "bunlari duzelt" diye
   gidiyor. Iki canli kosuda da liste su maddeleri tasidi:

     "Contains unsupported discussion of log-linear and log-log models"
     "Hallucinated claim about elasticities and log-linear models"

   Log-dogrusal ve log-log modeller destenin 36-42. slaytlari — kaynakta
   acikca var. Critic soyleneni yapti ve DOGRU icerigi ozetten sildi; iki
   ozette de log modeller yok. Ayni turden ucuncu madde ("lacks an opening
   statement that clearly states the thesis") critic'e ozeti tek paragrafa
   cevirip "It begins with a thesis that..." diye baslatma sebebi verdi.

   Kural: "kaynakta yok / uydurma" diyen bir madde, adlandirdigi terimlerin
   kaynakta GECIP GECMEDIGINE bakilarak dogrulanir; terimlerin cogu
   kaynaktaysa madde dusurulur. "Tez" maddesi ders materyali icin anlamsiz
   oldugundan dusurulur. Gercek bir uydurmayi ("logistic regression") bu
   kontrol tutar, cunku o terim kaynakta yoktur.
   =========================================================================== */
const ISSUE_ABSENCE_RE = /hallucinat|unsupported|not (?:supported|present|found|mentioned|discussed|covered|in the source)|absent|does not (?:discuss|mention|cover|include|contain)|no (?:mention|discussion) of|fabricat|invented|kaynakta (?:yok|gecmiyor)|uydurma/i
const ISSUE_THESIS_RE = /\bthesis\b|opening statement|core (?:purpose|claim)|\btez\b/i
const ISSUE_STOPWORDS = new Set([
  'hallucinated', 'hallucination', 'hallucinations', 'claim', 'claims', 'about', 'unsupported',
  'discussion', 'discusses', 'discussed', 'source', 'summary', 'draft', 'statement', 'statements',
  'mention', 'mentions', 'mentioned', 'model', 'models', 'contains', 'contain', 'regarding',
  'missing', 'explicit', 'potential', 'section', 'sections', 'chapter', 'document', 'text',
  'information', 'content', 'details', 'present', 'presents', 'provides', 'which', 'that', 'this',
  'there', 'their', 'with', 'from', 'into', 'also', 'than', 'more', 'most', 'very', 'does',
  'not', 'the', 'and', 'such', 'these', 'those', 'claimed', 'portion', 'part', 'parts', 'include',
  'includes', 'fabricated', 'invented', 'absent', 'covered', 'found', 'supported', 'should',
  'removed', 'remove', 'brief', 'slides', 'slide', 'lecture', 'material'
])

function normalizeForIssueMatch(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/\s*[-‐‑–—−]\s*/g, '-')
    .replace(/\s+/g, ' ')
}

function filterReviewIssues(
  issues: string[],
  sourceText: string
): { kept: string[]; dropped: Array<{ issue: string; reason: string }> } {
  const src = normalizeForIssueMatch(sourceText)
  const kept: string[] = []
  const dropped: Array<{ issue: string; reason: string }> = []
  for (const raw of Array.isArray(issues) ? issues : []) {
    const issue = String(raw || '')
    if (!issue.trim()) continue
    if (ISSUE_THESIS_RE.test(issue)) {
      dropped.push({ issue, reason: 'tez beklentisi ders materyaline uymuyor' })
      continue
    }
    if (src.length >= 200 && ISSUE_ABSENCE_RE.test(issue)) {
      const terms = (normalizeForIssueMatch(issue).match(/[a-zçğıöşü][a-zçğıöşü-]{3,}/g) || [])
        .map(t => t.replace(/^-+|-+$/g, ''))
        // Cogul -> tekil yaklasimi: "elasticities" kaynakta "elasticity"
        // olarak da gecebilir. Kok olarak ilk 6 harf aranir.
        .filter(t => t.length >= 4 && !ISSUE_STOPWORDS.has(t))
      if (terms.length > 0) {
        const found = terms.filter(t => src.includes(t) || (t.length > 6 && src.includes(t.slice(0, 6)))).length
        if (found / terms.length >= 0.75) {
          dropped.push({ issue, reason: `terimler kaynakta var (${found}/${terms.length})` })
          continue
        }
      }
    }
    kept.push(issue)
  }
  return { kept, dropped }
}

/** Critic'in yazdigi metin taslagin paragraf yapisini korudu mu? */
function paragraphCount(text: string): number {
  return String(text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).length
}

function gateWorkedExampleArithmetic(examples: any[]): { kept: any[]; dropped: string[] } {
  const dropped: string[] = []
  const girdiler = Array.isArray(examples) ? examples : []
  const kept = girdiler.filter((ex: any) => {
    if (!ex || typeof ex !== 'object') {
      /* SESSIZ DUSUS (24.10.2026): dizge seklinde gelen bir ornek hicbir
         sayaca yazilmadan siliniyordu, yani log "0 dusuruldu" derken kart
         eksiliyordu. */
      if (ex != null) dropped.push(`sekil hatasi (${typeof ex}) — nesne bekleniyordu`)
      return false
    }
    const parts = [
      ...(Array.isArray(ex.steps) ? ex.steps : []),
      String(ex.final_answer || '')
    ]
    const failures: string[] = []
    let suclu = ''
    for (const p of parts) {
      const r = checkArithmetic(String(p || ''))
      if (r.failures.length && !suclu) suclu = String(p || '').slice(0, 120)
      failures.push(...r.failures)
    }
    if (failures.length === 0) return true
    // ADIMIN KENDISI DE LOGA GIRER. 09.10.2026'da bir ornek
    // "300 - 360 + 15 = -45, yazilan -45 + 15" diye atildi; kapinin hakli
    // mi yoksa modelin yazim bicimini mi yanlis okudugu loga bakarak
    // anlasilamadi. Adim metni olmadan bu ayrim yapilamiyor.
    dropped.push(
      `${String(ex.title || 'basliksiz').slice(0, 40)} (${failures[0]}) — adim: "${suclu}"`
    )
    return false
  })

  /* EMNIYET VALFI (24.10.2026) — grounding kapisindakinin aynisi.
   *
   * Bu kapida valf YOKTU: tek bir aritmetik yanlis-pozitifi butun cozumlu
   * ornekleri silebiliyordu ve hicbir sey durdurmuyordu. Bugun somut bir
   * ornegi olculdu — `sourceNumbers` Turkce ondalik ayiriciyi okumuyordu,
   * yani Turkce bicimli bir belgede kaynak sayi kumesi BOS kaliyor ve
   * sayiya dayanan kapilar her kaydi "kaynakta yok" diye siliyordu. O hata
   * duzeltildi, ama ders genel: kartı BOSALTAN bir kapi, kutlesel uydurma
   * konusunda hakli olmaktan cok KARSILASTIRMA konusunda yanlis olmaya
   * yakindir — kodlama uyusmazligi, bicim okuma hatasi, beklenmedik bir
   * normalizasyon hepsi "model her seyi uydurdu" gibi gorunur.
   *
   * Budayan bir kapi faydali; ogrencinin sonucunu silen bir kapi hatadir.
   * Bu paydan sonra hicbir sey atilmiyor ve anomali loga yaziliyor. */
  const atilanPay = girdiler.length > 0 ? dropped.length / girdiler.length : 0
  if (girdiler.length >= 2 && atilanPay > GATE_MAX_DROP_SHARE) {
    console.warn(
      `Cozumlu ornek aritmetik kapisi IPTAL: ${girdiler.length} ornegin ` +
      `${dropped.length}'i (%${Math.round(100 * atilanPay)}) atilacakti — bu, modelden cok ` +
      `karsilastirmaya isaret ediyor, hepsi korunuyor. Ornek: ${dropped.slice(0, 2).join(' | ')}`
    )
    return { kept: girdiler, dropped: [] }
  }
  return { kept, dropped }
}

/* ==========================================================================
   BILGI YOGUNLUGU KAPISI (20.10.2026)
   ==========================================================================
   SIKAYET: "neredeyse her seyi cikariyor ama bos seyleri de cikardigina
   eminim". Dogru teshis: sistem ogrenmedigi icin degil, ona HER SEYI
   cikarmasi soylendigi icin boyle. Prompt "her denklemi, her sayiyi al"
   diyor; model de uyuyor ve arasina dolgu cumleler karisiyor:

     "Logarithmic transformations help linearize power-law relationships"
     "These specifications are widely used in economic modeling"

   Ikisi de DOGRU, ikisi de kaynakta geciyor — yani ne grounding kapisi ne
   kopya birlestirme bunlari eliyor. Eksik olan sey farkli: bu cumleler
   SOMUT hicbir sey tasimiyor. Ogrenci bunlari okuyup bir sey ogrenmiyor.

   OLCU, MODEL DEGIL. Bir maddenin somut capasi var mi:
     - SAYI            ("0.045", "%67", "43.96 thousand")
     - FORMUL IZI      (=, ^, _, Yunan harfi, ters bolu)
     - KAYNAK TERIMI   (belgede gecen, iki kelimeden uzun ayirt edici terim)
   Ucunden HICBIRI yoksa madde dolgudur.

   GUVENLIK VALFI: kapi maddelerin ucte birinden fazlasini atacaksa HICBIR
   SEY atmiyor. Bu, grounding kapisinin valfiyle ayni mantik ve ayni
   sebeple var: olcum yanlissa kartin yarisini silmektense hicbir sey
   silmemek iyidir. Valf devreye girdiginde log bunu SOYLUYOR, sessizce
   gecmiyor.
   ========================================================================== */
/* Kapi su an ELEMIYOR, yalnizca olcuyor. Gercek loglara bakip kurali
   koyduktan sonra true yapilacak — tek satir. */
const YOGUNLUK_KAPISI_ELIYOR = false

type YogunlukStats = {
  kept: number
  /* OLCULEN ORANIN PAYDASI (24.10.2026).
   *
   * Log ve quality_meta `dropped/kept` yaziyordu. Olcum modunda bu DOGRU,
   * cunku orada `kept = points.length`, yani zaten toplam. Ama kapi elemeye
   * gecirilince (YOGUNLUK_KAPISI_ELIYOR = true) `kept` HAYATTA KALANLAR
   * oluyor ve ayni ifade sessizce `dropped/hayattaKalan`a donuyor — orani
   * oldugundan buyuk gosterir ve kimse bunu fark etmez.
   *
   * `toplam` bir kez, girdinin kendisinden kuruluyor; iki mod da ayni
   * paydayi kullaniyor. */
  toplam: number
  dropped: number
  droppedPoints: string[]
  valfAcildi: boolean
}

/* ==========================================================================
   CAPA LISTESI YENIDEN KURULDU (29.10.2026 CANLI OLCUM)
   ==========================================================================
   Eski kural tekti: madde RAKAM ya da FORMUL IZI tasimiyorsa dolgu. Olculdu
   — 18 kartta %39-78'i dolgu isaretlendi; 7 derste (turev, anatomi, muhasebe,
   tarih, hemsirelik, tuketici psikolojisi, immunoloji) 48 isaretli madde tek
   tek okundu ve GERCEK dolgu sayisi ~0 cikti. Isaretlenenlerden ornekler:

     "The power rule moves the exponent down and decreases it by one."
     "The inside argument of every logarithm must be strictly positive."
     "Addison hastaligi anemiye, Cushing hastaligi ise polisitemiye zemin..."
     "Olgun eritrositlerde cekirdek, mitokondri, ribozom ve golgi bulunmaz."
     "TSMC, ABD'ye fabrika kurarak tedarik zinciri riskini azaltmaktadir."

   Hepsi sinavda sorulabilir somut bilgi. Yani eski kural "dolgu" degil
   "NICEL MI" olcuyordu: rakamsiz yazilmis bir kalkulus kurali bile eliyordu
   (12/17). Valf esigi 1/3 oldugu icin kapi canliya alinsa her kartta valf
   acilir ve hicbir sey elenmezdi — yani olcu hem yanlis hem islevsizdi.

   Kuralin kendisini yazdiran 20.10 ornekleri ("Logarithmic transformations
   help linearize...", "These specifications are widely used...") ise artik
   HIC uretilmiyor: butun key_points kulliyatinda hedge kaliplari tek bir
   cumle yakaliyor, o da yanlis pozitif. Sadakat kurallari dolguyu bitirdi.

   IKI KOSUL, TEK YONLU GUVENLIK. Bir madde ancak (1) hicbir capa tasimiyor
   VE (2) bilinen bos-yuklem kaliplarindan birine uyuyorsa dolgu sayiliyor.
   Sebep olculdu: capa listesi el yapimi bir fiil sozlugu ve her sozluk
   deliginden GERCEK icerik dolgu gorunur ("Insulin lowers blood glucose...",
   "The accrual basis records expenses..." ilk surumde tam boyle kacti).
   Ikinci kosul o deliklerin yanlis pozitif uretmesini imkansiz kiliyor:
   eksik kalan sozluk yalnizca bir dolguyu KACIRABILIR, ki bu zararsiz —
   kapinin isi regresyonu gormek, kart budamak degil.

   Testteki olculen korpusa karsi: 32 somut maddenin HICBIRI elenmiyor,
   10/10 dolgu cumlesi yakalaniyor (bkz. YOG_SOMUT / YOG_DOLGU).
   ========================================================================== */

/* Yaziyla yazilmis sayi ve sira sayisi. "decreases it by one", "less than
   four valence electrons", "seventh century", "dort ana bolum". */
const YOG_SAYI_SOZCUGU = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|fifty|hundred|thousand|million|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|half|twice|double|triple|single|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|elli|yüz|bin|milyon|ilk|ikinci|üçüncü|dördüncü|beşinci|yarı|çift)\b/i

/* Kural/tanim kipi: zorunluluk, esitlik, kapsama. Bir SAV kuruyor. */
const YOG_KURAL_KIPI = /\b(must|cannot|can not|never|always|only|requires?|required|necessary|sufficient|equals?|consists? of|contains?|defined as|indicates?|implies|prevents?|triggers?|yields?|ensures?)\b|\b(zorunlu|gerekir|gerekmekte|olamaz|bulunmaz|yalnızca|sadece|oluşur|oluşmakta|tanımlanır|yol aç|zemin hazırla|eşittir|içerir)/i

/* Adlandirilmis kural: "power rule", "quotient rule", "chain rule". Bosluk
   SART: "power-law relationships" (tireli) bilerek eslesmiyor, cunku o
   olculen dolgu cumlesinin ta kendisi. */
const YOG_ADLANDIRILMIS_KURAL = /\b[A-Za-zçğıöşü]+\s+(rule|law|theorem|principle|identity|test|criterion|effect|bias|equation)\b|\b[A-Za-zçğıöşü]+\s+(kuralı|yasası|teoremi|ilkesi|etkisi|denklemi)\b/i

/* Kisaltma: iki buyuk harf tasiyan tek sozcuk (TSMC, ABD, BRICS, ESH, IgG)
   ya da cumle basinda OLMAYAN tek buyuk harf ("B hucreleri", "R, K, M"). */
const YOG_KISALTMA = /\b[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü]*[A-ZÇĞİÖŞÜ][A-Za-z]*\b|(?<=[a-zçğıöşü,;:)\]] )[A-ZÇĞİÖŞÜ](?=[\s.,;:'’])/

const YOG_KOSUL = /\b(when|whenever|if|unless|until|while)\b|\b(iken|ise|durumunda|halinde)\b/i
const YOG_DEGISIM = /\b(more than|less than|fewer|greater than|higher|lowers?|increases?|decreases?|reduces?|raises?|rises?|falls?|shifts?|doubles?)\b|\b(artır|artar|azalt|azalır|yüksel|düşür|düşer|yavaşlat|hızlandır)/i

/* BOS YUKLEM KALIPLARI. Ikinci kosul (bkz. ustteki blok): bir madde ancak
   capasi yoksa VE bunlardan birine uyuyorsa dolgu. Liste writerSys'teki
   genericHits ile bilerek ortusuyor — ayni cumle sinifi. */
const YOG_DOLGU_KALIBI: RegExp[] = [
  /\b(widely|commonly|often|frequently|generally|broadly)\s+(used|applied|employed|discussed|recognized)\b/i,
  /\bhelps?\s+[a-z]+/i,
  /\bprovides?\s+(a|an)?\s*(broad|general|deeper|better|comprehensive|holistic)\s+(overview|understanding|view|picture|perspective)/i,
  /\b(is|are)\s+(important|essential|crucial|fundamental|valuable|useful|key|central)\s+(for|to|in)\b/i,
  /\boffers?\s+(valuable|useful|important|key)\s+(insights?|perspectives?)/i,
  /\b(theoretical|conceptual)\s+(frameworks?|underpinnings?|terrain|depth|clarity)/i,
  /\bbroader\s+(field|landscape|context|scholarly|academic)/i,
  /\bplays?\s+an?\s+(important|key|crucial|significant|vital)\s+role/i,
  /\b(various|numerous|several|many)\s+(applications|contexts|fields|areas|ways|methods|settings)/i,
  /genel\s+bir\s+(değerlendirme|bakış|çerçeve|fikir)/i,
  /bütüncül\s+bir\s+bakış/i,
  /(geniş\s+biçimde|yaygın\s+olarak)\s+(tartışıl|kullanıl|kabul\s+edil)/i,
  /önemli\s+bir\s+rol/i,
  /\b(önemlidir|gereklidir|katkı\s+sağlar)\b/i
]

/** Madde bilinen bir bos-yuklem kalibina uyuyor mu. */
function yogunlukBosYuklem(text: string): boolean {
  const s = String(text || '')
  return YOG_DOLGU_KALIBI.some((re) => re.test(s))
}

/* KAYNAKTAN OGRENILEN OZEL ADLAR. "Thales sought natural causes..." somut
   ama ozel adi CUMLE BASINDA, yani konum kuraliyla gorunmez. Cozum: belgede
   CUMLE ICINDE buyuk harfle gecen sozcukler toplanip maddede araniyor.
   Cumle basi buyuk harfi capa SAYILMIYOR, cunku "Logarithmic
   transformations help..." da oyle baslıyor ve o dolgu.
   Virgulden sonraki buyuk harf alinmiyor (", The" gibi) ve islevsel
   sozcukler listede: biri capa sayilsa butun maddeler capali olurdu. */
const YOG_KAYNAK_OZELAD_RE = /(?<=[a-zçğıöşü]\s)([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,})/g
const YOG_OZELAD_DISI = new Set([
  'The', 'This', 'These', 'Those', 'That', 'And', 'But', 'For', 'When', 'While',
  'With', 'From', 'They', 'Their', 'Its', 'Each', 'Every', 'All', 'Both', 'Such',
  'Bir', 'Bunu', 'Bunun', 'Ancak', 'Ama', 'Ile', 'Için', 'Veya', 'Daha', 'Olarak'
])
function yogunlukKaynakOzelAdlari(sourceText: string): Set<string> {
  const out = new Set<string>()
  const s = String(sourceText || '')
  let m: RegExpExecArray | null
  const re = new RegExp(YOG_KAYNAK_OZELAD_RE.source, 'g')
  while ((m = re.exec(s)) !== null) {
    const ad = m[1]
    if (!YOG_OZELAD_DISI.has(ad)) out.add(ad)
    if (out.size >= 4000) break   // bellek siniri; kapi teshis, sozluk degil
  }
  return out
}

/** Somut capa tasiyan bir maddede bulunan isaretler. Bos dizi = capasiz. */
function yogunlukIsaretleri(text: string, kaynakOzelAdlar: Set<string>): string[] {
  const t = String(text || '')
  const isaretler: string[] = []
  const atifsiz = t.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '')

  // SAYI: atif numarasi disinda bir rakam. "k - 1" gibi tek haneli sembolik
  // ifadeler de sayilir, cunku onlar kuralin kendisi.
  if (/\d/.test(atifsiz)) isaretler.push('sayi')

  // FORMUL IZI: esitlik, us, alt simge, Yunan harfi ya da LaTeX komutu.
  if (/[=^_\\]|[α-ωΑ-Ω]/.test(t)) isaretler.push('formul')

  if (YOG_SAYI_SOZCUGU.test(t)) isaretler.push('sayi-sozcugu')
  if (YOG_KISALTMA.test(t)) isaretler.push('kisaltma')

  /* OZEL AD: cumle BASI OLMAYAN buyuk harfli sozcuk. Once cumle basi
     sozcukleri dusuruluyor, kalanda buyuk harf araniyor. */
  const govde = t
    .replace(/^[^A-Za-zÇĞİÖŞÜçğıöşü]*[A-ZÇĞİÖŞÜ][^\s]*\s?/, ' ')
    .replace(/([.;:!?]\s+)[A-ZÇĞİÖŞÜ][^\s]*/g, '$1')
  if (/(?:^|\s)[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}/.test(govde)) isaretler.push('ozel-ad')
  if (!isaretler.includes('ozel-ad') && kaynakOzelAdlar && kaynakOzelAdlar.size) {
    for (const ad of kaynakOzelAdlar) {
      if (t.includes(ad)) { isaretler.push('ozel-ad-kaynak'); break }
    }
  }

  /* SIRALAMA: 3+ ogeli liste. Parantez ici ve atif disarida tutuluyor. */
  const virgul = (atifsiz.replace(/\([^)]*\)/g, '').match(/,/g) || []).length
  if (virgul >= 2 || (virgul >= 1 && /\b(and|or|ve|veya|ile)\b/i.test(t))) isaretler.push('siralama')

  // PARANTEZ: rakamla baslamayan, en az uc karakterlik parantez ici = ornekleme.
  if (/\([^)\d][^)]{2,}\)/.test(t)) isaretler.push('parantez')

  if (YOG_KURAL_KIPI.test(t)) isaretler.push('kural-kipi')
  if (YOG_ADLANDIRILMIS_KURAL.test(t)) isaretler.push('adlandirilmis-kural')
  if (YOG_KOSUL.test(t)) isaretler.push('kosul')
  if (YOG_DEGISIM.test(t)) isaretler.push('degisim')

  return isaretler
}
/**
 * Somut capasi olmayan maddeleri eler.
 *
 * Kaynak metin yoksa ya da kisaysa HICBIR SEY yapmaz: terim capasini
 * kuracak zemin yok demektir ve o durumda elemek, kotu bir olcumle karti
 * budamak olur.
 */
function applyDensityGate(
  keyPoints: any[],
  sourceText: string,
  figureText: string = ''
): { key_points: any[]; stats: YogunlukStats } {
  const points = Array.isArray(keyPoints) ? keyPoints : []
  const stats: YogunlukStats = { kept: points.length, toplam: points.length, dropped: 0, droppedPoints: [], valfAcildi: false }
  if (!sourceText || sourceText.length < 200 || points.length === 0) return { key_points: points, stats }

  const birlesik = figureText ? sourceText + '\n' + figureText : sourceText
  const kaynakOzelAdlar = yogunlukKaynakOzelAdlari(birlesik)
  const oku = (raw: any) => typeof raw === 'string' ? raw : String(raw?.text || raw?.point || '')

  const tutulan: any[] = []
  const atilan: any[] = []
  for (const p of points) {
    const metin = oku(p)
    /* IKI KOSUL: capasiz OLMASI yetmiyor, bilinen bir bos-yuklem kalibina da
       uymasi gerekiyor. Sebep yukarida olculdu — capa sozlugunun her deligi
       aksi halde GERCEK icerigi dolgu ilan ediyor. */
    if (yogunlukIsaretleri(metin, kaynakOzelAdlar).length > 0 || !yogunlukBosYuklem(metin)) tutulan.push(p)
    else atilan.push(p)
  }

  /* OLCUM MODU: aday isaretlenir, kart DEGISMEZ. Yanlis olcuyle elemek,
     olcmemekten kotudur (bkz. ustteki not). */
  stats.dropped = atilan.length
  stats.droppedPoints = atilan.map(p => oku(p).slice(0, 90))
  stats.kept = tutulan.length
  if (!YOGUNLUK_KAPISI_ELIYOR) {
    stats.kept = points.length
    return { key_points: points, stats }
  }

  /* VALF: ucte birden fazlasi gidecekse hicbiri gitmesin. Boyle bir oran,
     maddelerin dolgu oldugunu degil OLCUMUN yanlis oldugunu gosterir —
     ornegin kaynak metin cok kisa cikmistir ve terim capasi hic
     kurulamamistir. */
  if (atilan.length > Math.floor(points.length / 3)) {
    stats.valfAcildi = true
    return { key_points: points, stats }
  }

  return { key_points: tutulan, stats }
}

/* TERIMI BAGIMSIZ PARCALARA BOL — CAPRAZ DIL (28.10.2026 olcumu).
 *
 * "Chp 7 Attitudes" kosusunda OLCUM MODU 18 terimden 8'inin dusecegini
 * yakaladi; sekizi de ayni kaliptaydi: "Bilissel Temelli Tutum (Cognitively
 * Based Attitude)". Kaynak INGILIZCE, ozet TURKCE. Eski yedek kontrol butun
 * kelimeleri TEK havuzda ariyordu; Turkce etiketin kelimeleri Ingilizce
 * kaynakta yok, dolayisiyla parantez ici kaynakta AYNEN gectigi halde terim
 * dusuyordu. Kurtulan 10 terim yalnizca Turkce sekil notlarinda (figureText)
 * gectigi icin kurtuldu — o kart kazara kurtuldu.
 *
 * Parantez modelin NOTUDUR (ceviri ya da kisaltma), kaynak hakkinda ayri bir
 * iddia tasimaz. Artik parantez disi etiket ve her parantez grubu AYRI
 * sinaniyor; biri tamamen temellenmisse terim temellenmis sayilir.
 *
 * Tam terim ilk parca olarak DURUYOR: kontrol yalnizca genisledi, daha once
 * KALAN hicbir terim bu degisiklikle dusemez. */
function gateTermParcalari(term: string): string[][] {
  const kelimeler = (s: string) =>
    gateNormalize(s).split(' ').filter(w => w.length >= 4)
  const icler = (term.match(/\(([^)]*)\)/g) || []).map(s => s.slice(1, -1))
  return [
    kelimeler(term),                             // eski davranis
    kelimeler(term.replace(/\([^)]*\)/g, ' ')),  // parantez disi etiket
    ...icler.map(kelimeler)                      // her parantez grubu
  ]
}

function applyGroundingGate(
  keyTerms: any[],
  keyPoints: any[],
  sourceText: string,
  visionGrounded: Set<string> = new Set(),
  figureText: string = '',
  /* OLCUM MODU (28.10.2026) — kapi KARSILASTIRMASINA guvenemedigi kosullarda
     yalnizca olcer, kesmez. Varsayilan false, yani butun mevcut cagiranlar
     eskisi gibi caliyor; karari cagiran veriyor cunku motoru ve belgeyi
     yalnizca o biliyor (bkz. cagri yerindeki uzun not). */
  olcumModu = false
): { key_terms: any[]; key_points: any[]; stats: GroundingStats } {
  const terms = Array.isArray(keyTerms) ? keyTerms : []
  const points = Array.isArray(keyPoints) ? keyPoints : []
  const stats: GroundingStats = {
    termsKept: 0, termsDropped: 0, droppedTerms: [],
    pointsKept: 0, pointsDropped: 0, droppedPoints: [],
    score: null
  }
  if (!sourceText || sourceText.length < 200) {
    // Nothing trustworthy to judge against — never gate on a non-existent
    // source, or a failed extraction would delete a good summary.
    stats.termsKept = terms.length
    stats.pointsKept = points.length
    return { key_terms: terms, key_points: points, stats }
  }

  /* KAPININ VARSAYIMI MOTORA GORE DEGISIR (10.10.2026).
   *
   * Bu kapi Groq icin yazildi ve dayandigi onerme suydu: model YALNIZCA
   * cikarilan metni gordu, dolayisiyla metinde gecmeyen bir terim uydurma.
   * Gemini icin bu onerme YANLIS — o, sayfalarin kendisini okuyor. Test
   * destesinin 42 sayfasinin 22'sinde denklem resim olarak duruyor ve
   * cikarilan metin sayfa basina 344 karakter.
   *
   * Olculdu: 10.10.2026'da kapi 18 terimin 7'sini atti — "Differential
   * Intercept", "Semi-Elasticity", "Reference (Omitted) Category"...
   * Hicbiri uydurma degil; hepsi slaytlarda yaziyor, cikarilan metinde
   * yok. Ogrenci kartin %39'unu bu yuzden kaybetti.
   *
   * figureText: modelin SEKILLERDEN okudugunu bildirdigi satirlar. Metin
   * gibi muamele goruyor, yani kapi ikisinin BIRLESIMINDE ariyor.
   *
   * DAIRESELLIK — acikca: burada modelin kendi raporunu kendi ciktisini
   * dogrulamak icin kullaniyoruz. Bilincli bir takas. Kapinin zaten var
   * olan visionGroundedClaims muafiyeti ayni seyi yapiyordu, yalnizca TAM
   * ESLESME ile — yani pratikte hic calismiyordu, cunku muafiyet listesi
   * cumlelerden olusuyor, terimler ise iki kelime. Uyduran bir modelin bu
   * kapiyi gecmesi icin artik hem terimi hem onu iceren bir sekil bulgusu
   * uydurmasi gerekiyor; bu, terimi tek basina uydurmaktan cok daha zor.
   * Halusinasyon korumasinin asil yuku zaten review ve sanitizeCharts'ta. */
  const birlesikKaynak = figureText ? sourceText + '\n' + figureText : sourceText
  const haystack = ' ' + gateNormalize(birlesikKaynak) + ' '
  const docTerms = new Set(anchorTerms(birlesikKaynak))
  const readText = (raw: any) => typeof raw === 'string' ? raw : String(raw?.text || raw?.point || '')

  // --- Key terms: the term itself must occur in the document ---
  const keptTerms = terms.filter((t: any) => {
    const term = String(t?.term || '').trim()
    if (!term) return false
    const norm = gateNormalize(term)
    if (norm.length < 3) return true            // too short to judge
    if (visionGrounded.has(norm)) { stats.termsKept++; return true }
    if (haystack.includes(norm)) { stats.termsKept++; return true }
    // Multi-word term: accept when every word of it occurs somewhere. Some
    // documents write "esneklik katsayısı" across a line break, and the
    // model legitimately reassembles it.
    /* PARANTEZLI KISALTMA TERIMI DISKALIFIYE EDIYORDU (28.10.2026).
     *
     * Eski kosul `words.length > 1` isterdi. 4 harften kisa belirtecler
     * yukarida suzuldugu icin "Hematokrit (Htc)" -> norm "hematokrit htc"
     * -> words ["hematokrit"] -> uzunluk 1 -> yedek kontrol HIC calismiyor
     * ve terim, tek icerik kelimesi kaynakta gectigi halde dusuyordu.
     * Olculen kosuda (28.10, Kanin Ozellikleri) dusen alti terimden biri
     * tam bu yuzdendi. Turkce akademik metinde parantezli kisaltma cok
     * yaygin: ESH, Htc, EPO, KOAH, EKG.
     *
     * Kisaltma terimin kendisi degil, modelin notu. Atildiktan sonra kalan
     * icerik kelimelerinin HEPSI kaynakta geciyorsa terim temellendirilmis.
     *
     * Esigi `> 0` yapmak CIPLAK tek kelimeli terimler icin davranisi
     * degistirmiyor: orada norm zaten tek kelime, yani yukaridaki dogrudan
     * `haystack.includes(norm)` kontrolu ayni soruyu sormus ve hayir
     * demisti; yedek kontrol ayni sonuca varir. Degisen YALNIZCA kisa
     * belirtec tasiyan terimler. */
    /* Parcalar halinde — bkz. gateTermParcalari. Eski tek havuzlu kontrol
       ilk parca olarak duruyor, yani bu dal yalnizca genisledi. */
    const parcalar = gateTermParcalari(term)
    if (parcalar.some(p => p.length > 0 && p.every(w => haystack.includes(w)))) {
      stats.termsKept++; return true
    }
    stats.termsDropped++
    if (stats.droppedTerms.length < 8) stats.droppedTerms.push(term)
    return false
  })

  // --- Key points: only a ZERO-overlap point is dropped ---
  const keptPoints = points.filter((p: any) => {
    const text = readText(p)
    if (!text.trim()) return false
    if (visionGrounded.has(gateNormalize(text))) { stats.pointsKept++; return true }
    const claimTerms = [...new Set(anchorTerms(text))]
    if (claimTerms.length < GATE_MIN_TERMS_TO_JUDGE) { stats.pointsKept++; return true }
    const matched = claimTerms.filter(t => docTerms.has(t)).length
    if (matched > 0) { stats.pointsKept++; return true }
    stats.pointsDropped++
    if (stats.droppedPoints.length < 6) stats.droppedPoints.push(text.slice(0, 90))
    return false
  })

  const judged = stats.termsKept + stats.termsDropped + stats.pointsKept + stats.pointsDropped
  stats.score = judged > 0
    ? Math.round(100 * (stats.termsKept + stats.pointsKept) / judged)
    : null

  /* OLCUM MODU: sayilar hesaplandi, hicbir sey dusurulmuyor. Supaptan ONCE
     donuyor cunku supabin "ABORTED — keeping everything" uyarisi burada
     yanlis olurdu: zaten hicbir sey atilmayacak. */
  if (olcumModu) {
    return {
      key_terms: terms,
      key_points: points,
      stats: { ...stats, olcumModu: true } as GroundingStats
    }
  }

  // SAFETY VALVE. A gate that guts the output is far more likely to be wrong
  // about the comparison than right about mass fabrication — an encoding
  // mismatch, a failed extraction that left `extractedText` holding
  // something other than what the model actually read, or an unforeseen
  // normalisation bug would all look exactly like "the model invented
  // everything". A trimming gate is useful; a gate that empties the study
  // card is a bug that deletes the student's result. So past this share,
  // nothing is dropped and the anomaly is logged for investigation.
  /* SUPAP HER POPULASYON ICIN AYRI OLCUYOR (28.10.2026).
   *
   * Eski hesap terimlerle maddeleri tek havuzda ortaliyordu. Ama ikisinin
   * yanlis-dusme orani YAPISAL olarak farkli: terim birebir altdizi
   * esleşmesi istiyor, madde ise tek bir ortusen terimle geciyor. Yani
   * terimler cok daha kolay yanlis dusuyor ve maddeler ortalamayi aşağı
   * cekip supabi tam gerektigi yerde kor ediyor.
   *
   * OLCULEN KOSU (28.10, Kanin Ozellikleri, 67 sayfa):
   *   terms  8 kept / 6 dropped  -> %43
   *   points 18 kept / 0 dropped -> %0
   *   havuz  6/32 = %19  <  esik %60   -> supap acilmadi
   * Alti terimin altisi gercekti. Havuz, terime ozgu bir karsilastirma
   * kusurunu maddelerin arkasina sakliyordu.
   *
   * Supap artik yalnizca SORUNLU populasyonu koruyor: terimler anomali
   * gosteriyorsa butun terimler kaliyor ama temellendirilmemis maddeler
   * yine duser. Hepsini birden geri vermek, ikinci populasyon saglikliyken
   * gereksiz bir taviz.
   *
   * Takasin oteki yuzu: eskiden terim %60'in ALTINDA kalirken havuz esigi
   * asabiliyor ve terimler de kurtuluyordu (orn. terim %60, madde %70).
   * Artik o durumda yalnizca maddeler kurtuluyor — terimler anomali
   * gostermiyordu, ortalama gosteriyordu. */
  const termsJudged = stats.termsKept + stats.termsDropped
  const pointsJudged = stats.pointsKept + stats.pointsDropped
  const termShare = termsJudged > 0 ? stats.termsDropped / termsJudged : 0
  const pointShare = pointsJudged > 0 ? stats.pointsDropped / pointsJudged : 0
  const terimSupabi = termShare > GATE_MAX_DROP_SHARE
  const maddeSupabi = pointShare > GATE_MAX_DROP_SHARE
  if (terimSupabi || maddeSupabi) {
    console.warn(
      `Grounding gate ABORTED [${[terimSupabi ? 'terim' : '', maddeSupabi ? 'madde' : ''].filter(Boolean).join('+')}]: ` +
      `terim %${Math.round(100 * termShare)} (${stats.termsDropped}/${termsJudged}), ` +
      `madde %${Math.round(100 * pointShare)} (${stats.pointsDropped}/${pointsJudged}) ` +
      `dusecekti. Bu oran modeli degil KARSILASTIRMAYI gosterir — ` +
      `${terimSupabi && maddeSupabi ? 'ikisi de' : terimSupabi ? 'terimler' : 'maddeler'} korunuyor. ` +
      `Ornek atilacaklar: ${[...stats.droppedTerms, ...stats.droppedPoints].slice(0, 4).join(' | ')}`
    )
    return {
      key_terms: terimSupabi ? terms : keptTerms,
      key_points: maddeSupabi ? points : keptPoints,
      stats: {
        ...stats,
        aborted: true,
        abortedTerms: terimSupabi,
        abortedPoints: maddeSupabi
      } as GroundingStats
    }
  }

  return { key_terms: keptTerms, key_points: keptPoints, stats }
}

/**
 * Single citation step for BOTH pipelines, run once just before the study
 * card is saved:
 *   1. Validate footnote pages the model produced (fast path) — a page the
 *      index cannot corroborate is demoted to null instead of sending the
 *      student's PDF viewer somewhere wrong.
 *   2. Compute footnotes for key_points that carry no marker yet (this is
 *      what finally gives long documents citations), appending "[n]" to the
 *      point text so the existing formatFootnoteMarkers()/jumpToFootnote()
 *      front-end path renders and links them with no UI change at all.
 * Returns new arrays; never mutates its inputs.
 */
function anchorCitations(
  keyPoints: any[],
  existingFootnotes: any[],
  pageIndex: PageSegment[],
  lang: string
): { key_points: any[]; footnotes: any[]; idMap: Record<number, number>; stats: Record<string, number> } {
  const incoming = Array.isArray(existingFootnotes) ? existingFootnotes : []
  const stats = { kept: 0, demoted: 0, added: 0, skipped: 0, quoted: 0, paylasilan: 0 }

  const readText = (raw: any) => typeof raw === 'string' ? raw : String(raw?.text || raw?.point || '')
  const writeText = (raw: any, text: string) =>
    typeof raw === 'string' ? text : { ...raw, text }

  // Footnote ids are reassigned to a dense 1..n sequence below, so any "[n]"
  // markers the model already embedded in key_points (and in the summary,
  // which the caller remaps with the returned idMap) must be rewritten to
  // match. Without this, a model that emitted ids out of order or with gaps
  // — which it is free to do — would leave every marker pointing at the
  // wrong footnote, i.e. at the wrong page. This is what applyFootnoteRemap
  // is for; it runs BEFORE any new markers are appended, so the ids this
  // function allocates afterwards cannot collide with remapped ones.
  const idMap: Record<number, number> = {}
  incoming.forEach((fn: any, i: number) => {
    if (fn?.id != null) idMap[Number(fn.id)] = i + 1
  })
  const points = (Array.isArray(keyPoints) ? keyPoints : []).map(raw =>
    writeText(raw, applyFootnoteRemap(readText(raw), idMap))
  )

  if (!pageIndex.length) {
    // No page concept for this format (DOCX / plain text) — keep the
    // footnotes but strip page numbers we cannot corroborate, rather than
    // letting the viewer jump somewhere arbitrary.
    const cleaned = incoming.map((fn: any, i: number) => ({
      id: i + 1,
      reference: fn?.reference || `Reference ${i + 1}`,
      page: null
    }))
    stats.demoted = incoming.filter((fn: any) => typeof fn?.page === 'number').length
    stats.kept = cleaned.length
    return { key_points: points, footnotes: cleaned, idMap, stats }
  }

  const idf = buildAnchorIdf(pageIndex)
  const validPages = new Set(pageIndex.map(s => s.page))
  const out: any[] = []

  // --- 1. Carry over the model's footnotes, verifying their page numbers ---
  for (const fn of incoming) {
    const id = out.length + 1
    const claimedPage = (typeof fn?.page === 'number' && Number.isFinite(fn.page)) ? fn.page : null
    let page: number | null = null
    if (claimedPage !== null && validPages.has(claimedPage)) { page = claimedPage; stats.kept++ }
    else if (claimedPage !== null) { stats.demoted++ }
    out.push({ id, reference: fn?.reference || `Reference ${id}`, page })
  }

  // --- 2. Anchor key_points that carry no marker yet ---
  // The label the student actually reads: prefer the verbatim source
  // sentence, fall back to the page's heading line, then to a bare page
  // number. The front end already renders `reference` both in the [n]
  // tooltip and in the "Kaynakça" list, so a real quote here upgrades both
  // with no UI change.
  const labelFor = (hit: { head: string; page: number; quote: string | null }) =>
    hit.quote || hit.head || (lang === 'tr' ? `Sayfa ${hit.page}` : `Page ${hit.page}`)

  /* AYNI ALINTI UC AYRI DIPNOT OLUYORDU (30.10.2026 olcumu).
   *
   * "Week 9 Integrals" kartinin kaynakcasinda [3], [11] ve [12] BIREBIR
   * ayni cumleydi (sayfa 6, "When the rectangles become very thin, the
   * approximation approaches the exact area."). Ogrenci kaynakcada ayni
   * cumleyi uc kez okuyor. Maddeler de ayni seyi soyluyordu:
   *   [3]  "A Riemann sum approximates area using thin rectangles, and the
   *         limit of this sum as rectangles become very thin is the
   *         definite integral."
   *   [11] "Rectangle approximation uses finite thin rectangles to estimate
   *         area under a curve before exact integration."
   *   [12] "Taking the limit of a Riemann sum as the number of rectangles
   *         approaches infinity yields the exact definite integral."
   * Ikisi gorsel gecisten geldi (log: "+9 points").
   *
   * NEDEN GENEL DEDUPE YETMIYOR: olculdu, uclunun kelime ortusmesi 0,455 /
   * 0,545 / 0,364 — NEAR_DUP_THRESHOLD (0,7) hepsini kaciriyor. Esigi 0,35'e
   * cekmek BUTUN kartlardaki butun maddeleri etkiler; olculen "masum" cift
   * sayisi iki (0,125 ve 0,143), yani genel esigi oynatmak icin veri yok.
   *
   * AYNI ALINTI DAHA GUCLU BIR KANIT. Kelime ortusmesi tahmin yurutuyor;
   * atif motorunun ayni (sayfa, cumle) ciftine baglamasi BELGENIN KENDI
   * delili. Bu yuzden kapi iki kosullu — dedupeDiagrams/dedupeSections ile
   * ayni kalip:
   *   1) ayni sayfa + ayni alinti  VE
   *   2) kelime ortusmesi >= AYNI_ALINTI_ORTUSME (0,35)
   * Ikinci kosul "tek cumleden IKI AYRI olgu" halini koruyor: alt ve ust
   * siniri anlatan iki madde ayni cumleye baglanabilir ama ortusmeleri
   * dusuktur, o yuzden ikisi de kalir.
   *
   * ALINTISIZ ISABET BIRLESTIRILMEZ: alinti yoksa etiket sayfa basligina
   * ya da "Sayfa N"e dusuyor; o kadar genel bir eslesmeyi kopya saymak
   * ayni sayfadaki butun maddeleri tek dipnota indirirdi. */
  const AYNI_ALINTI_ORTUSME = 0.35
  const alintiKaydi = new Map<string, { id: number; terimler: Set<string> }>()

  for (let i = 0; i < points.length; i++) {
    const text = readText(points[i])
    if (!text.trim()) continue
    if (/\[\d+\]/.test(text)) continue // already cited — leave it alone

    const hit = anchorClaimToPage(text, pageIndex, idf, lang === 'en')
    if (!hit) { stats.skipped++; continue }

    /* Ayni (sayfa, alinti) daha once gorulduyse YENI dipnot acilmaz:
       var olan id yeniden kullanilir. */
    if (hit.quote) {
      const anahtar = `${hit.page}\u0000${hit.quote}`
      const onceki = alintiKaydi.get(anahtar)
      const terimler = nearDupTermSet(text)
      if (onceki) {
        const ortusme = kumeOrtusmesi(terimler, onceki.terimler)
        if (ortusme >= AYNI_ALINTI_ORTUSME) {
          points[i] = writeText(points[i], `${text.replace(/\s+$/, '')} [${onceki.id}]`)
          stats.paylasilan = (stats.paylasilan || 0) + 1
          continue
        }
      } else {
        alintiKaydi.set(anahtar, { id: out.length + 1, terimler })
      }
    }

    const id = out.length + 1
    out.push({
      id,
      reference: labelFor(hit),
      page: hit.page,
      // Kept as its own field too: `reference` is what today's UI shows, but
      // a verbatim quote is distinct data (it can be highlighted in the
      // source viewer, and it is what makes the citation checkable).
      quote: hit.quote
    })
    if (hit.quote) stats.quoted++
    points[i] = writeText(points[i], `${text.replace(/\s+$/, '')} [${id}]`)
    stats.added++
  }

  return { key_points: points, footnotes: out, idMap, stats }
}

// ==========================================================================
// GEMINI GOLGE YOLU (09.10.2026)
//
// NE YAPAR: GEMINI_API_KEY tanimliysa ve belge bir PDF ise, belgenin TAMAMI
// tek cagrida Gemini'ye gonderilir ve taslak (rawContent) oradan gelir.
// Anahtar yoksa, belge PDF degilse, dosya/sayfa/zaman siniri asilirsa veya
// cagri herhangi bir sekilde basarisiz olursa Groq yolu AYNEN calisir.
// Asagidaki iki pipeline'in (tek-gecis ve chunked) tek satiri degismedi —
// secim serve() icinde tek bir `else if` ile yapiliyor.
//
// NEDEN: darbogaz prompt ya da pacer degil, hesaba tanimli 8.000 TPM.
// Loglardan olculenler:
//   - 77 saniyelik bir kosunun 58 saniyesi TEK bir pacer beklemesiydi
//   - review 4 kosunun 3'unde zaman butcesinden atlandi
//   - cikis 3.702 token'da tavan yapti
//   - gorsel analiz tek istekte en fazla 2 sayfa (bir gorsel 2.048 token)
// Dordu de ayni kotanin turevi. Ikinci saglayici o kotanin tamamen disinda
// ve PDF'i sayfa sayfa PNG'ye cevirmeden, native olarak okuyor — yani
// PDF.co adimi da bu yolda hic yok.
//
// DURUST NOT: Gemini ucretsiz katmaninin kesin TPM/RPD rakamlari Google
// tarafindan YAYINLANMIYOR; hesaba ozel ve AI Studio panelinde goruluyor.
// Plandaki "~1.000.000 TPM" dogrulanmis bir sayi DEGIL. Bu yuzden
// asagidaki her sinir muhafazali ve her basarisizlik Groq'a dusuyor.
// ==========================================================================

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions'

// Model adlari hizli degisiyor. GEMINI_MODEL secret'i tanimliysa o one
// gecer; tanimli degilse sirayla denenir ve "boyle bir model yok" cevabi
// bir sonrakine gecisi tetikler (bkz. geminiModelMissing).
/* AI Studio panelinden OKUNAN gercek limitler (09.10.2026, 21:30):
   her Flash modeli icin RPM 5, TPM 250K, RPD 20. Daha once 100K sandigimiz
   TPM baska bir satirdi (Antigravity); token tarafinda sikinti yok. Asil
   darbogaz GUNLUK 20 ISTEK — ve o gun gemini-3.8-flash zaten 8/20'deydi.

   Sira buna gore kuruldu: 3.8 o aksam ustuste 503 "high demand" donduren
   TEK modeldi (hatalarin tamami ondan geldi) ve kotasinin yarisi yanmisti;
   3.7 ve 3.5 ayni limitlere sahip ve o gun hic dokunulmamisti. Onler
   dolu/sikisik olunca arkadakine gecilir, liste bunun icin var.

   gemini-2.5-flash listede DEGIL: panelde gorunuyor ama bu yuzeyde 404
   donuyor, yani her kosuda gunluk 20 istekten birini bosa yakardi.

   Flash Lite modelleri (RPM 15, RPD 500) bilincli olarak burada degil:
   gölge yolun isi formul goruntusu ve Excel ekran goruntusu okumak, orada
   model kalitesi dogrudan kartin dogrulugu demek. Kota dar gelirse once
   olculur, sonra gecilir — GEMINI_MODEL=gemini-3.5-flash-lite yeter. */
/* 3.8 EN SONA (25.10.2026). 24-25 Ekim canli kosularinda 0/5: iki 503, uc
   olu akis (baslik 15,3 sn, sonra tek olay yok). Kosu 38'de gecikmeli yedek
   olarak 3.8 basladi, yine olay getirmedi ve bir RPD bosa gitti. 3.5 ve 3.6
   bu yuzeyde henuz olculmedi; olculmus olarak calismayan bir modelden once
   denenmeleri daha iyi bahis. Olcum degisirse sira degisir.

   3.7 DE EN SONA (28.10.2026) — yukaridaki kuralin kendisi geregi, cunku
   olcum degisti. 3.7-flash bu yuzeyde DORT kosuda dort kez 0 karakter:
     27.10 18:40  ilk byte 15.348ms, ilk olay yok, 0 olay, toplam 87.350ms
     27.10 20:34  ilk byte 15.391ms, ilk olay yok, 0 olay, toplam 87.393ms
     28.10 10:21  ilk byte 15.546ms, ilk olay yok, 0 olay, toplam 60.859ms
     (+ devir oncesi kosu, ayni desen)
   Her seferinde HTTP 200 ve ": keep-alive" ilk byte'i geliyor, sonra hicbir
   sey. Listenin basinda oldugu icin her kosu once onu deniyor ve calisan bir
   modele ancak GEMINI_YEDEK_GECIKME_MS_VARSAYILAN (35 sn) sonra sira geliyor.

   3.5-flash ise OLCULMUS olarak CALISIYOR — oturumun ilk AKIS GERCEK satiri:
     28.10 10:22  ilk byte 15.556ms, ILK OLAY 25.560ms, 345 olay,
                  26.025 karakter, toplam 66.971ms — AKIS GERCEK
   Taslak kabul edildi, kart Gemini'den cikti, Groq yolu hic calismadi.

   Bu satir ayni zamanda GEMINI_ILK_OLAY_MS tartismasini kapatiyor: saglikli
   bir akisin ilk olayi 25,6 saniyede geliyor (ilk byte'tan ~10 sn sonra),
   esik ise 72 sn. Yani esigi dusurmek gerekmiyordu; gereken sey olu modeli
   listenin basindan almakti. Yedek gecikmesinin 35 sn olmasi da bu olcumle
   dogrulaniyor: saglikli pencerenin hemen ustunde duruyor. */
const GEMINI_MODEL_CANDIDATES = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash'
]

// Yukleme siniri zaten 20 MB. 18 MB'in ustunu Groq'a birakiyoruz: inline
// base64 gonderim dosyayi 4/3 buyutuyor ve Files API'ye gecmek (resumable
// upload + ayri finalize) bu kadar kucuk dosyalar icin uc ekstra tur demek.
const GEMINI_INLINE_MAX_BYTES = 18 * 1024 * 1024
const GEMINI_MAX_PAGES = 900

// Gemini cagrisi icin EN AZ bu kadar butce kalmali, yoksa hic baslanmaz:
// yarida kesilen bir cagri Groq yoluna dusmek icin de zaman birakmaz.
const GEMINI_MIN_BUDGET_MS = 55_000
// Cagri bittikten sonra review + kapilar + kayit icin ayrilan pay.
const GEMINI_RESERVE_MS = 35_000
/* 78 saniye keyfi degil: GEMINI_PIPELINE_BUDGET_MS (130) eksi
 * GEMINI_GROQ_RESERVE_MS (52) = 78. Yani EN UZUN Gemini cagrisi zaman
 * asimina ugrasa bile Groq'a tam 62 saniye kalir. Uc sayi birbirine
 * bagli; biri degisirse testteki degismez kontrolu uyarir.
 *
 * ACIK GERILIM: olculen BASARILI cagri 72,4 saniye surmustu, bu tavanin
 * ustunde. Istege eklenen metin 120.000'den 40.000 karaktere indi ve
 * cikis tavani 32.768'den 16.384'e cekildi; sure bunlarla 68 saniyenin
 * altina inmezse gölge yol bu belgede tamamlanamaz. O zaman karar
 * gercekten ikili olur: ya butceyi 140 saniyeye cikarmak (Supabase'in
 * ~150 sn sert sinirina 10 sn pay kalir) ya da ozetlemeyi arka plana
 * tasimak. Tahminle degil, olcumle secilecek. */
const GEMINI_MAX_CALL_MS = 78_000

/* GROQ'A SAKLANAN PAY — 09.10.2026 dorduncu kosusunun dersi.
 *
 * O kosuda tek Gemini cagrisi 74,9 saniyede zaman asimina ugradi. Bir
 * onceki surumde ekledigim 25 saniyelik "basarisiz denemeler" tavani ise
 * denemeden ONCE bakiyordu — yani TEK bir cagrinin kendisi 75 saniye
 * surunce tavan hic devreye giremedi. Groq'a sifir butce kaldi ve o kart
 * anlati yazarini da, gorsel gecisini de, review'u da kaybetti: gölge yol
 * calismadigi halde karti bozdu, ki tek sozu bunu yapmamakti.
 *
 * Dogru koruma sure tavani degil, CAGRININ KENDI ZAMAN ASIMI: Gemini'ye
 * ancak "zaman asimina ugrasa bile Groq'un tam bir kosuya yetecek kadar
 * zamani kalir" kadar sure verilir. Olculen tam Groq kosusu (iki pencere +
 * birlesim + yazar + review + kayit) 71 saniye surmustu; 62 saniye pencere
 * ve birlesimi garanti eder, review'u etmez — ama sifir butceden cok daha
 * iyidir.
 *
 * Bedeli acik: Gemini'nin basarili kosusu 72,4 saniye surmustu, bu tavanin
 * ustunde. Yani istek basina metin kirpildiktan sonra (120.000 -> 40.000
 * karakter) sure bu tavanin altina inmezse gölge yol bu belgede hic
 * tamamlanamaz. Olculecek sey tam olarak budur. */
/* 62 -> 52 saniye (09.10.2026 21:40 olcumu).
   gemini-3.7-flash ILK TAM KOSUYU yapti: 67,4 saniye, 32.639 karakter, 26
   gorsel bulgu, 12 formul, 6 tablo (dordu Excel ekran goruntusunden
   okunmus regresyon ciktisi), uc cozumlu ornek, ve review de kostu.
   Ama 67,4 ile 68 saniyelik tavan arasinda yarim saniye var: biraz daha
   icerik istemek dogrudan zaman asimi demek, ve gunluk kota 20 istek.

   Pay 52 saniyeye iniyor, tavan 78'e cikiyor. Bedeli acik: Gemini zaman
   asimina ugrarsa Groq'a 52 saniye kalir — pencereler ve birlesim siger
   (olculdu, ~40 sn), review sigmaz. Gemini'nin calistigi artik olculdugune
   gore bu takas dogru tarafa yapiliyor. */
const GEMINI_GROQ_RESERVE_MS = 52_000

/* ==========================================================================
   GEMINI_MODE — gölge mi, tek yol mu (09.10.2026 aksami)
   ==========================================================================
   Olculen gercek: bu belgede Gemini ~72 sn (72,4 / 74,9 / 67,9 — biri
   basarili, ikisi zaman asimi), Groq'un tam kosusu ~71 sn (57 sn'si kendi
   TPM pacer beklemesi). 72 + 71 = 143 ve Supabase'in sert siniri ~150.
   Yani TEK bir istek icinde "Gemini'yi dene, olmazsa Groq'u tam kostur"
   yapisi aritmetik olarak kurulamiyor: hangi payi secersem secim birini
   ac birakiyor. Son iki duzeltmem de bu yuzden yetmedi.

   Karar: Groq KALDIRILMADI, yalnizca devre disi. Iki yol da kodda duruyor.

     GEMINI_MODE=only   (VARSAYILAN) — PDF'ler yalnizca Gemini'den gecer,
                        butun butce (GEMINI_ONLY_BUDGET_MS) onundur,
                        basarisiz olursa belge 'failed' isaretlenir ve
                        kullanici tekrar dener. Groq taslak icin HIC
                        cagrilmaz. Deneme donemi icin bu.
     GEMINI_MODE=shadow — eski davranis: Gemini dener, olmazsa Groq'a
                        duser (ve ikisi butceyi paylastigi icin review
                        genelde atlanir).

   Ucuncu kapatma yolu zaten var: GEMINI_API_KEY secret'ini silmek. O zaman
   mod ne olursa olsun Groq yolu bugunku haliyle calisir. */
/* VARSAYILAN shadow'a GERI ALINDI (09.10.2026, 21:15).
   only modunda Gemini tamamlanamayinca kart hic uretilmiyor ve ogrenci
   bos donuyor. Gemini guvenilir sekilde tamamlanana kadar Groq agda
   kalir: yarim bir Groq karti, karti olmamasindan iyidir. GEMINI_MODE=only
   ile deneme modu istenildigi zaman acilabilir. */
function geminiMode(): 'only' | 'shadow' | 'parallel' {
  const m = String(Deno.env.get('GEMINI_MODE') || '').trim().toLowerCase()
  if (m === 'only') return 'only'
  if (m === 'parallel') return 'parallel'
  return 'shadow'
}

/* ==========================================================================
   GEMINI PARALEL MODU (19.10.2026) — GEMINI_MODE=parallel
   ==========================================================================
   NEDEN: only/shadow modlari PDF'in TAMAMINI tek cagrida gonderiyor. Olculen
   sure 67-111 sn (yukaridaki yorumlar) ve her sayfa gorsel olarak
   ucretlendiriliyor. Hedef 10-20 sn ve sayfa basina dusuk maliyet.

   NE YAPAR: Groq icin yazilmis hattin TAMAMI (pencereler, birlesim, sentez,
   anlati yazari, review, kalite kapilari, atif baglama) oldugu gibi calisir;
   yalnizca LLM cagrilari Groq yerine Gemini'ye gider:

     - fetchWithRetry, Groq adresine giden istegi yakalar ve groqViaGemini'ye
       verir. Hattin bes ayri cagri noktasinin hicbiri degismedi.
     - tokenPacer bu modda beklemez: Groq'un 8.000 TPM'i burada yok.
     - Uzun belgede pencereler AYNI ANDA gonderilir (GEMINI_PARALLEL_CONCURRENCY).
     - Metin sayfalari METIN olarak gider (sayfa basina ~400-700 token);
       yalnizca metni bos sayfalar kucuk bir PDF'e kesilip gorsel olarak
       gider (bkz. buildPdfSubsetBase64). Taranmis/gorsel sayfa disinda
       hicbir sayfa resim olarak ucretlendirilmez.

   MODELLER: pencereler ve kontrol gecisleri GEMINI_FAST_MODEL (varsayilan
   Flash-Lite), MODEL_HEAVY seridi (sentez, anlati yazari) GEMINI_MODEL.
   Model adlari hizli degisiyor; ikisi de secret ile ezilebilir.

   ON KOSUL — GUNCELLENDI (28.10.2026): "ucretli katman sart" notu, limitin
   PROJE basina oldugu varsayimiyla yazilmisti. Panelden okunan limit model
   basina RPM 5 / RPD 20. Pencere 13.000 krk ve GEMINI_PARALLEL_CONCURRENCY
   4'e indirildi; ucretsiz katmanda ch7 boyutunda bir belge bu sinirlarin
   icinde kosuyor. Gunluk tavan hala dar: ~3 istek/belge ile RPD 20, model
   basina ~6 belge demek.

   KAPATMAK: GEMINI_MODE secret'ini 'shadow' yapmak ya da silmek.
   ========================================================================== */
function geminiParallelActive(): boolean {
  return geminiMode() === 'parallel' && !!Deno.env.get('GEMINI_API_KEY')
}

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'
/* SURUM v1, v1beta DEGIL (28.10.2026 — OLCULDU).
   Ayni anahtar, ayni model, ayni govde ile:
     v1beta/models/gemini-3.5-flash:generateContent  -> once 404, 20 dk sonra 503
     v1alpha/...                                      -> 503
     v1/...                                           -> 200, "Pong!"
   Ve ch7 boyutunda (39.526 krk) tam istek: v1beta 503, v1 200 / 7 sn.
   Yani gunlerdir "kota/model/boyut" diye arananin tamami SURUM hatasiymis.
   v1beta bu hesapta 404 ile 503 arasinda saliniyor; uzerine kosu kurulmaz. */
const GEMINI_GENERATE_BASE = 'https://generativelanguage.googleapis.com/v1/models'
const GEMINI_FAST_MODEL_DEFAULT = 'gemini-3.5-flash-lite'
/* ESZAMANLILIK = RPM 5 EKSI PAY (28.10.2026).
   10 ucretli katman varsayimiydi. Ucretsiz katmanda panelden okunan limit
   model basina RPM 5; pencereler ayni seride (ayni Gemini modeli) gittigi
   icin 10 eszamanli pencere ilk koside 429 yer. 4 secildi: bir kosu RPM'i
   doldurmuyor ve ard arda iki kosu arasinda pay kaliyor.
   Model basina dagitim yapilirsa (bkz. geminiModelsForLane) bu yukseltilebilir. */
const GEMINI_PARALLEL_CONCURRENCY = 4
/** Paralel modda okunabilecek en fazla pencere (13.000 krk x 40 ~ 200+ sayfa). */
const GEMINI_PARALLEL_MAX_WINDOWS = 40
/** Gorsel gecise kesilip gonderilecek en fazla sayfa (tek mini-PDF). */
const GEMINI_VISION_MAX_PAGES = 12
/** Groq'un dar cikis tavanlari Gemini'de gereksiz; JSON'un yarim kalmamasi icin taban. */
const GEMINI_PARALLEL_MIN_OUTPUT = 8192

/** Bu istekteki Gemini harcamasi — maliyeti olcmek icin karta (quality_meta) yazilir. */
const geminiParallelUsage = { calls: 0, prompt: 0, output: 0, thoughts: 0, models: {} as Record<string, number> }
function resetGeminiParallelUsage() {
  geminiParallelUsage.calls = 0
  geminiSerit.tamIstek = 0
  geminiSorunlu.clear()
  geminiParallelUsage.prompt = 0
  geminiParallelUsage.output = 0
  geminiParallelUsage.thoughts = 0
  geminiParallelUsage.models = {}
}

/**
 * PDF'in yalnizca verilen (0 tabanli) sayfalarindan yeni bir PDF uretir ve
 * base64 dondurur. Gemini bunu native okur: PNG'ye cevirme (PDF.co) adimi ve
 * metni zaten cikarilmis sayfalarin gorsel ucreti yok. Basarisizlikta null.
 */
async function buildPdfSubsetBytes(fileBytes: Uint8Array, pageIndices: number[]): Promise<Uint8Array | null> {
  try {
    const src = await PDFDocument.load(fileBytes, { ignoreEncryption: true })
    const total = src.getPageCount()
    const indices = Array.from(new Set(pageIndices)).filter(i => i >= 0 && i < total).sort((a, b) => a - b)
    if (indices.length === 0) return null
    const out = await PDFDocument.create()
    const pages = await out.copyPages(src, indices)
    for (const p of pages) out.addPage(p)
    return await out.save()
  } catch (err) {
    console.warn('buildPdfSubsetBytes: mini-PDF uretilemedi:', err)
    return null
  }
}

async function buildPdfSubsetBase64(fileBytes: Uint8Array, pageIndices: number[]): Promise<string | null> {
  const bytes = await buildPdfSubsetBytes(fileBytes, pageIndices)
  return bytes ? bytesToBase64(bytes) : null
}

/* HATA CEVABI HER ZAMAN GECERLI JSON (28.10.2026 — olculmus hata).
 *
 * `lastBody` yukarida `(await res.text()).slice(0, 800)` ile KESILIYOR.
 * Kesik govdeyi oldugu gibi dondurmek, cagiranin icine JSON ayristirma
 * hatasi olarak patliyordu — callGroqJson govdeyi `!response.ok`
 * kontrolunden ONCE `response.json()` ile okuyor:
 *
 *   Madde 3 narrative writer skipped (keeping draft summary):
 *     SyntaxError: Unterminated string in JSON at position 800
 *
 * "position 800" tam olarak o slice. Gercek sebep (gunluk kota dolu) log
 * disinda hicbir yere ulasmiyordu ve kuyruk yanlis yerde hata aratiyordu.
 * Artik ham govde bir ALANIN icinde tasiniyor, zarf her zaman gecerli. */
function geminiHataCevabi(status: number, mesaj: string, ham: string): Response {
  return new Response(
    JSON.stringify({ error: { message: mesaj, gemini_body: ham.slice(0, 400) } }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}

/** Groq model seridine karsilik gelen Gemini aday listesi. */
/* PENCERE SERIDI ARTIK FLASH-LITE'TA DEGIL (28.10.2026 olcumu).
 *
 * ACCOUNTING ch6, ilk canli paralel kosu. Pencereler flash-lite'a gitti:
 *   Window 1 sayisal kapsama: 0/11 (%0) — kayip: 720, 750, 800, 1200, 1470...
 *   Window 2 sayisal kapsama: 10/10 (%100)
 * Pencere 1'in sayfalarindaki Crivitz (specific identification) ve FIFO
 * ornekleri karta HIC girmedi; son kart %76'da kaldi. Pencereler kartin
 * ICERIGINI uretiyor ve only modunun kendi notu bunu zaten soyluyor:
 * "model kalitesi dogrudan kartin dogrulugu demek" — orada Flash-Lite
 * bilerek listeye alinmamisti, paralel modda ise serit basindaydi.
 *
 * DAGITIM: RPD model BASINA 20. Pencereleri tek modele yigmak kaliteyi ve
 * kotayi ayni yere bagliyordu. Sirayla dagitmak dort modelin RPD'sini
 * (4 x 20) kullanilir kiliyor ve model basina RPM 5'e de yaklasmiyor.
 *
 * Flash-Lite listeden ATILMADI, SONA alindi: butun tam modeller duserse
 * hala bir cevap gelsin. GEMINI_FAST_MODEL secret'i acikca tanimliysa
 * dagitim yapilmaz — elle verilen model olcum yapanin karari. */
/* Sayac bir const nesnede tutuluyor: testlerin kaynak cikaricisi (bkz.
   tests/_ts-extract.js) ciplak bir `let` bildirimini dilimleyemiyor.
   tamIstek: bu kosuda RPD 20'lik tam Flash havuzuna kac kez dokunuldugu. */
const geminiSerit = { tamIstek: 0 }

/* KOTASI DOLAN MODEL BIR DAHA DENENMEZ (28.10.2026 — olculmus israf).
 *
 * AI Studio panelinden okunan gercek limitler:
 *   Flash-Lite : RPM 15, RPD 500
 *   tam Flash  : RPM  5, RPD  20      <-- 25 kat dar
 *
 * 19:03 kosusunda 3.5 ve 3.6 gunluk kotayi doldurmustu; dis yeniden-deneme
 * dongusu (Window N attempt 1/2/3) her denemede ayni olu modellere yeniden
 * istek atti ve her biri RPD'den bir tane daha goturdu. Panelde iki model de
 * 21/20'ye cikti. Olu model artik 30 dk boyunca aday listesinden dusuyor. */
const GEMINI_KOTA_OLU_MS = 30 * 60_000
const geminiKotaOlu = new Map<string, number>()

/* AYNI KOSUDA IKI KEZ 503/zaman asimi veren model de atlanir. Ayni kosuda
   3.7 ve 3.8 once 503 verdi, sonra 40.000ms zaman asimina girdi; 139
   saniyelik butcenin cogu orada yandi ve belge 'failed' oldu. */
const GEMINI_SORUNLU_ESIK = 2
const geminiSorunlu = new Map<string, number>()

/* ZAMAN ASIMI TEK CENTIKTE MODELI DUSURUR (29.10.2026 olcumu).
 *
 * Esik 2, 503 icin dogru: 503 hizli doner, yeniden denemek neredeyse
 * bedava. Zaman asimi ise zaten BUTUN dilimi harcamis olan arizadir ve
 * ikinci kez beklemenin bilgi degeri yok. ACCOUNTING chapter 6 kosusunda
 * (18:07:53 -> 18:09:57) tam bu oldu:
 *
 *   t=42,1 sn  Gemini[flash-lite] paralel: zaman asimi (40000ms)
 *   t=93,5 sn  Gemini[flash-lite] paralel: zaman asimi (30000ms)
 *
 * Ayni model, ayni kosu, 70 saniye. Geriye kalan: gorsel gecis, anlati
 * yazari ve review UCU BIRDEN 'butce 0ms' diye atlandi. Kart cikti ama
 * ac kaldi. Ilk zaman asiminda model kosu boyunca dusuyor; 503 esigi
 * oldugu gibi kaliyor. */
function geminiZamanAsimiCentik(model: string) {
  geminiSorunlu.set(model, GEMINI_SORUNLU_ESIK)
}

/* GEMINI'NIN BIR CAGRIDAN ALABILECEGI EN BUYUK DILIM (29.10.2026 olcumu).
 *
 * groqViaGemini, cevirdigi Groq cagrisinin zaman asimini OLDUGU GIBI miras
 * aliyordu: pencereler icin 40 sn, sentez icin 30 sn. Gemini cevap
 * vermeyince o dilim tamamen gidiyor VE gerçek Groq cagrisi yine sifirdan
 * kosuyor. Yani paralel modda bir asamanin maliyeti `groq` degil
 * `gemini_zaman_asimi + groq` oluyor. Olculen kosu: 40+21 (pencereler) ve
 * 30+30 (sentez) = 121 sn; 150 sn duvarina kalite asamalari hic yetismedi.
 *
 * Saglikli bir Lite cagrisi bu is yukunde 7-22 sn araliginda donuyor
 * (ch7 tam istek v1: 7 sn; BUS211 kosusu: 5 cagri 22,6 sn). 15 saniye
 * tavan hem saglikli cagriyi hic etkilemiyor hem olu cagrinin bedelini
 * 40 sn'den 15 sn'ye indiriyor. Taban 8 sn: cagiranin zaman asimi kucukse
 * (review 18 sn) Gemini'ye yarisindan fazlasi verilmiyor.
 *
 * BUTCE CAGRI BASINA DEGIL ZINCIR BASINA: aday listesi 4-5 model tasiyor
 * ve her biri tavan kadar bekleseydi tek cagri 75 sn yakabilirdi. */
const GEMINI_PARALLEL_MAX_CALL_MS = 15_000
const GEMINI_PARALLEL_MIN_CALL_MS = 8_000
/** Yeni bir denemeye girmek icin gereken en az kalan sure. */
const GEMINI_PARALLEL_DENEME_TABANI = 2_000

function geminiParalelCagriButcesi(timeoutMs: number): number {
  const yari = Math.floor(Number(timeoutMs || 0) / 2)
  return Math.min(GEMINI_PARALLEL_MAX_CALL_MS, Math.max(GEMINI_PARALLEL_MIN_CALL_MS, yari))
}

function geminiModelDiri(m: string): boolean {
  const t = geminiKotaOlu.get(m)
  if (t !== undefined) {
    if (Date.now() - t <= GEMINI_KOTA_OLU_MS) return false
    geminiKotaOlu.delete(m)
  }
  return (geminiSorunlu.get(m) || 0) < GEMINI_SORUNLU_ESIK
}

/** Paralel modda hala denenebilecek bir Gemini modeli var mi. */
function geminiDiriAdayVar(): boolean {
  const hepsi = [...GEMINI_LITE_CANDIDATES, ...GEMINI_MODEL_CANDIDATES, GEMINI_FAST_MODEL_DEFAULT,
    String(Deno.env.get('GEMINI_MODEL') || '').trim(),
    String(Deno.env.get('GEMINI_FAST_MODEL') || '').trim()]
  return hepsi.some(m => m && geminiModelDiri(m))
}

/* TAM MODEL BUTCESI: pencereler kalite icin tam modelden baslar ama RPD 20
   ile bir kosu havuzu bosaltmamali. Butce dolunca serit basi Flash-Lite'a
   (RPD 500) donuyor — kart yine cikiyor, yalnizca ucuz seritten. */
const GEMINI_TAM_MODEL_BUTCESI = 6

/* PENCERELER LITE'TA KALIYOR (28.10.2026 — panel okumasi karari verdi).
 *
 * Bir ara pencere seridi tam modellere tasinmisti: ACCOUNTING ch6 kosusunda
 * "Window 1 sayisal kapsama: 0/11" gorulmustu ve kalite gerekcesi mantikli
 * duruyordu. Panel okununca takas sacma cikti:
 *   Flash-Lite : RPM 15, RPD 500
 *   tam Flash  : RPM  5, RPD  20
 * Pencereler kosu basina EN COK cagri gonderen yer; onlari 25 kat dar bir
 * havuza baglamak ayni gun kotayi bitirdi (3.6 ve 3.8 panelde 21/20).
 *
 * Ustelik elimizdeki TEK tam basarili paralel kosu bastan sona Lite'ti:
 *   modeller={"gemini-3.5-flash-lite":5}, 62 sn, cache TAM, grounded=true,
 *   son kart sayisal kapsama %76.
 * Tek pencerenin sayi kaybi, 25 kat kotayi harcamak icin yeterli kanit
 * degil. Kalite sorunu olcumle ayrica kovalanacak.
 *
 * Lite ADAYLARI birden fazla: biri 503 verirse otekine gecilsin diye.
 * Tam modeller listeden ATILMADI, derin yedek olarak sonda duruyor. */
/* SIRA SABIT, DONUSUMLU DEGIL. Kisa sure donusumlu denendi; 19:21
   kosusunda sira 3.1-flash-lite'i basa aldi, o iki kez 503 verdi ve pencere
   ancak 3.5'e dustukten sonra calisti. RPD 500 ile donusume kota gerekcesi
   yok; 3.5-flash-lite olculmus calisan model, oteki yalnizca yedek. */
const GEMINI_LITE_CANDIDATES = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite'
]

function geminiModelsForLane(groqModel: string): string[] {
  /* AGIR SERIT DE LITE (28.10.2026 karari).
     Varsayilan eskiden GEMINI_MODEL_CANDIDATES[0] (tam Flash, RPD 20) idi.
     Tam Flash'in gunluk hakki 20, Lite'inki 500 ve 19:21 kosusunda agir
     serit tam o yuzden 429 yiyip anlati yazarini dusurdu. Artik butun
     seritler ayni Lite modelinde; GEMINI_MODEL secret'i hala ezebiliyor. */
  const heavy = String(Deno.env.get('GEMINI_MODEL') || '').trim() || GEMINI_LITE_CANDIDATES[0]
  const fastSecret = String(Deno.env.get('GEMINI_FAST_MODEL') || '').trim()
  const lite = fastSecret || GEMINI_FAST_MODEL_DEFAULT
  let first: string
  if (groqModel === MODEL_HEAVY) {
    first = heavy
  } else if (fastSecret) {
    first = fastSecret
  } else {
    first = GEMINI_LITE_CANDIDATES[0]
  }
  /* Sira: once Lite adaylari (RPD 500), sonra agir serit modeli, en sonda
     tam Flash adaylari (RPD 20) — derin yedek. */
  const sira = groqModel === MODEL_HEAVY
    ? [first, heavy, ...GEMINI_MODEL_CANDIDATES, lite, ...GEMINI_LITE_CANDIDATES]
    : [first, lite, ...GEMINI_LITE_CANDIDATES, heavy, ...GEMINI_MODEL_CANDIDATES]
  const out: string[] = []
  for (const m of sira) {
    if (m && out.indexOf(m) === -1 && geminiModelDiri(m)) out.push(m)
  }
  /* Hepsi olu: bos liste dondurmek cagiranin "hicbir model cevap vermedi"
     demesine yol acardi. Bos donuyoruz ve fetchWithRetry bu durumda
     yakalamayi hic yapmayip cagriyi GERCEK Groq'a birakiyor. */
  return out
}

/** OpenAI bicimindeki bir mesaj icerigini Gemini part listesine cevirir. */
function openAiContentToGeminiParts(content: unknown): any[] {
  if (typeof content === 'string') return content ? [{ text: content }] : []
  if (!Array.isArray(content)) return []
  const parts: any[] = []
  for (const c of content) {
    if (!c || typeof c !== 'object') continue
    if (c.type === 'text' && typeof c.text === 'string') {
      parts.push({ text: c.text })
    } else if (c.type === 'image_url') {
      const url = String(c.image_url?.url || '')
      const m = url.match(/^data:([^;,]+);base64,(.*)$/s)
      if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } })
    }
  }
  return parts
}

/**
 * Groq chat-completions istegini Gemini generateContent'e cevirir ve cevabi
 * Groq'un bicimiyle (choices[0].message.content + usage) geri verir. Cagiran
 * kodun hicbir satiri hangi saglayicinin cevap verdigini bilmez.
 */
async function groqViaGemini(options: RequestInit, maxRetries: number, timeoutMs: number): Promise<Response> {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || ''
  let req: any
  try {
    req = JSON.parse(String(options.body || '{}'))
  } catch (_e) {
    return new Response(JSON.stringify({ error: { message: 'groqViaGemini: istek govdesi okunamadi' } }), { status: 400 })
  }
  const messages: any[] = Array.isArray(req.messages) ? req.messages : []
  const systemText = messages
    .filter(m => m?.role === 'system')
    .map(m => typeof m.content === 'string' ? m.content : openAiContentToGeminiParts(m.content).map(p => p.text || '').join('\n'))
    .join('\n\n')
  const contents = messages
    .filter(m => m?.role !== 'system')
    .map(m => ({ role: m?.role === 'assistant' ? 'model' : 'user', parts: openAiContentToGeminiParts(m?.content) }))
    .filter(c => c.parts.length > 0)

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: Math.max(Number(req.max_completion_tokens || req.max_tokens || 0), GEMINI_PARALLEL_MIN_OUTPUT)
  }
  if (typeof req.temperature === 'number') generationConfig.temperature = req.temperature
  if (req.response_format?.type === 'json_object') generationConfig.responseMimeType = 'application/json'
  // Dusuk dusunme: hiz ve maliyet icin. Yuzey reddederse asagida dusurulur.
  let thinking: Record<string, unknown> | null = {
    thinkingLevel: String(Deno.env.get('GEMINI_THINKING_LEVEL') || 'low').trim()
  }

  const body = () => JSON.stringify({
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents,
    generationConfig: thinking ? { ...generationConfig, thinkingConfig: thinking } : generationConfig
  })

  let lastStatus = 0
  let lastBody = ''
  /* ZINCIR BUTCESI — bkz. geminiParalelCagriButcesi. Bu cagrida Gemini'ye
     ayrilan toplam sure; dolunca yakalama biter ve cagri GERCEK Groq'a
     gider (bkz. fetchWithRetry yedek yolu). */
  const zincirButcesi = geminiParalelCagriButcesi(timeoutMs)
  const zincirBasladi = Date.now()
  const zincirKalan = () => zincirButcesi - (Date.now() - zincirBasladi)
  let zincirDoldu = false
  for (const model of geminiModelsForLane(String(req.model || ''))) {
    if (zincirDoldu) break
    for (let attempt = 0; attempt <= Math.max(1, maxRetries); attempt++) {
      const kalan = zincirKalan()
      if (kalan < GEMINI_PARALLEL_DENEME_TABANI) {
        zincirDoldu = true
        console.warn(
          `Gemini paralel: cagri butcesi doldu (${zincirButcesi}ms, caginin zaman asimi ` +
          `${timeoutMs}ms) — kalan Gemini adaylari denenmiyor, Groq'a birakiliyor`
        )
        break
      }
      if (GEMINI_MODEL_CANDIDATES.indexOf(model) !== -1) geminiSerit.tamIstek++
      const controller = new AbortController()
      // Deneme, caginin zaman asimini de zincir butcesini de asamaz.
      const denemeMs = Math.min(timeoutMs, kalan)
      const timer = setTimeout(() => controller.abort(), denemeMs)
      let res: Response
      try {
        res = await fetch(`${GEMINI_GENERATE_BASE}/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: body(),
          signal: controller.signal
        })
      } catch (err) {
        clearTimeout(timer)
        lastStatus = 0
        const iptal = (err as any)?.name === 'AbortError'
        lastBody = iptal ? `zaman asimi (${denemeMs}ms)` : String((err as any)?.message || err)
        if (iptal) {
          /* Tek centikte dusuyor — bkz. geminiZamanAsimiCentik. */
          geminiZamanAsimiCentik(model)
          console.warn(
            `Gemini[${model}] paralel: ${lastBody} — model bu kosuda ` +
            `aday listesinden DUSURULDU (zaman asimi dilimi zaten harcandi)`
          )
        } else {
          geminiSorunlu.set(model, (geminiSorunlu.get(model) || 0) + 1)
          console.warn(`Gemini[${model}] paralel: ${lastBody}`)
        }
        continue
      }
      clearTimeout(timer)

      if (res.ok) {
        const data = await res.json()
        const text = extractGeminiText(data)
        const finish = String(data?.candidates?.[0]?.finishReason || 'STOP')
        if (!text.trim()) {
          lastStatus = 502
          lastBody = `bos cevap (finishReason=${finish})`
          console.warn(`Gemini[${model}] paralel: ${lastBody}`)
          break
        }
        const u = data?.usageMetadata || {}
        const promptTok = Number(u.promptTokenCount) || 0
        const outTok = Number(u.candidatesTokenCount) || 0
        const thoughtTok = Number(u.thoughtsTokenCount) || 0
        geminiParallelUsage.calls++
        geminiParallelUsage.prompt += promptTok
        geminiParallelUsage.output += outTok
        geminiParallelUsage.thoughts += thoughtTok
        geminiParallelUsage.models[model] = (geminiParallelUsage.models[model] || 0) + 1
        return new Response(JSON.stringify({
          model,
          choices: [{
            message: { role: 'assistant', content: text },
            finish_reason: finish === 'MAX_TOKENS' ? 'length' : 'stop'
          }],
          usage: {
            prompt_tokens: promptTok,
            completion_tokens: outTok + thoughtTok,
            total_tokens: Number(u.totalTokenCount) || promptTok + outTok + thoughtTok
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      lastStatus = res.status
      try { lastBody = (await res.text()).slice(0, 800) } catch (_e) { lastBody = '' }

      if (thinking && res.status === 400 && /thinking/i.test(lastBody)) {
        console.warn(`Gemini[${model}] paralel: thinkingConfig reddedildi — dusurulup tekrar deneniyor`)
        thinking = null
        attempt--
        continue
      }
      if (geminiModelMissing(res.status, lastBody)) {
        console.warn(`Gemini[${model}] paralel: model yok (${res.status}) — sonraki aday`)
        break
      }
      if (res.status === 429 || res.status >= 500) {
        if (geminiQuotaExhausted(res.status, lastBody)) {
          /* SIRADAKI ADAYA GEC (28.10.2026 duzeltmesi).
             Burasi eskiden dogrudan donuyordu ("baska model denemeden") —
             limitin PROJE basina oldugu sanildigi donemde dogruydu, cunku
             sonraki modeli denemek ayni duvara carpmakti. Panel okumasi
             limitin MODEL basina oldugunu gosterdi (3.6 ve 3.8 bagimsiz
             olarak 21/20). Donmek yuzunden 19:21 kosusunda anlati yazari
             atlandi: agir serit 3.5-flash'ta 429 yedi, arkasindaki Lite
             adaylari hic denenmedi. Olu model zaten isaretlendigi icin
             sonrakine gecmek bedava. */
          geminiKotaOlu.set(model, Date.now())
          console.error(
            `Gemini[${model}] paralel: GUNLUK kota dolu — bu model ` +
            `${Math.round(GEMINI_KOTA_OLU_MS / 60000)} dk aday listesinden dusuruldu, ` +
            `siradaki aday deneniyor`
          )
          break
        }
        geminiSorunlu.set(model, (geminiSorunlu.get(model) || 0) + 1)
        console.warn(`Gemini[${model}] paralel: gecici ${res.status} (deneme ${attempt + 1}) — ${lastBody.slice(0, 160)}`)
        await new Promise(r => setTimeout(r, 1200 * (attempt + 1)))
        continue
      }
      console.warn(`Gemini[${model}] paralel: basarisiz ${res.status} — ${lastBody.slice(0, 240)}`)
      return geminiHataCevabi(res.status, `Gemini ${res.status} (${model})`, lastBody)
    }
  }
  return new Response(
    JSON.stringify({ error: { message: `Gemini paralel: hicbir model cevap vermedi (${lastStatus}: ${lastBody.slice(0, 200)})` } }),
    { status: lastStatus >= 400 ? lastStatus : 502 }
  )
}

/* only modunda butun istek Gemini'nin: 120 sn butce, geriye kapilar ve
   kayit icin GEMINI_RESERVE_MS kaliyor. Groq'a saklanan pay yok, cunku
   Groq cagrilmayacak. */
/* OLCULEN: 10.10.2026, ilk only-modu basarisi — ve kil payi.
 *
 *   Gemini cagrisi : 89.908 ms   /  tavan 89.960 ms  -> pay 52 MS
 *   Review kapisi  : budgetLeft 33.096 ms / gereken 33.000 ms -> pay 96 MS
 *
 * Kart geldi ama ikisi de sans eseri. Bu halde kapsami artirmak, yani
 * modelden daha fazla uretim istemek, dogrudan "kart hic gelmiyor" demek
 * (only modunda Groq yedek degil).
 *
 * SURE BELGENIN BOYUNA BAGLI DEGIL. 42 sayfalik gorsel-yogun deste 67,4
 * saniye surmustu; bu 9 sayfalik, sayfa basina 1.716 karakterlik METIN
 * belgesi 89,9 saniye surdu. Yani sureyi belirleyen Google'in o andaki
 * gecikmesi, bizim istedigimiz is degil. 67-90 saniye arasi oynuyor.
 *
 * YER NEREDE SAKLI: cagri bittikten SONRAKI gercek is 3,1 saniye surdu
 * (taslak 983767'de geldi, kart 986900'de yazildi) — ama review kapisi
 * 33 saniyelik BUTCE goruyor olmak istiyor. Yani 35 saniyelik pay'in
 * neredeyse tamami nominal; gercekte kullanilmiyor.
 *
 * Toplam kosu 94,4 saniye surdu (Supabase'in sert siniri ~150 sn).
 * Butce 145'e, tavan 105'e cikariliyor: cagri 105 saniyeye kadar
 * yasayabiliyor, geriye 40 saniyelik nominal butce kaliyor ve review'un
 * 33 saniyelik kapisi rahat geciyor. En kotu halde gercek duvar saati
 * ~105 + 3 = 108 saniye, yani sert sinira 40 saniye pay var. */
/* only modunda Groq'a DONUS ESIGI (10.10.2026 16:05).
 *
 * only modu bir KARSILASTIRMA modu olarak tasarlanmisti: kart ya
 * Gemini'den gelir ya hic gelmez, boylece yarim bir Groq kosusu olcumu
 * kirletmesin. Karsilastirma bitti — Gemini her sayida Groq'a esit ya da
 * ustun, ustune formulleri, Excel tablolarini ve dogrulanmis atiflari
 * koyuyor. Artik mod bir urun yolu, ve bu haliyle tek 503 ogrenciye bos
 * ekran demek.
 *
 * Ama her basarisizlikta Groq'a dusmek de olmaz: Gemini 105 saniyeyi
 * yakip zaman asimina ugradiysa geriye Groq'un tam kosusuna (olculen ~71
 * sn) yer kalmiyor ve toplam Supabase'in ~150 sn sinirini zorlar.
 *
 * ILK HALI YANLISTI (100 sn, yani Groq'un TAM kosusuna yer). 17:40
 * kosusunda Gemini 111 saniye yakti, geriye 33,9 saniye kaldi ve belge
 * basarisiz isaretlendi — oysa 33,9 saniye bir kart uretmeye yeterdi.
 * Secim "tam Groq karti mi, hic kart mi" degil; "yarim Groq karti mi,
 * hic kart mi". Ogrenci icin ikincisi her zaman daha kotu.
 *
 * Groq'un pencereleri, Gemini'den sonra pacer butcesi TAZE oldugu icin
 * hizli doner — olculdu: iki pencere 6 saniyede bitti. Pencereler +
 * birlesim + kayit 30 saniyede siger; review ve anlati yazari sigmazsa
 * kartin quality_meta.skipped_stages alani bunu zaten yaziyor.
 *
 * Ayrica geminiToplamTavan sayesinde Gemini artik 105 saniyeden fazlasini
 * yakamiyor, yani geriye en az 40 saniye kaliyor ve bu esik pratikte her
 * zaman gecilir. */
const GEMINI_ONLY_FALLBACK_MIN_MS = 32_000

/* Bir yuklemenin harcayabilecegi en fazla Gemini istegi (17.10.2026).
   Gunluk kota 20; tek bir PDF'in hepsini yakmasi kabul edilemez.
   Dis dongu 4 aday model x ic dongu 5 deneme = kagit uzerinde 20, yani
   gunun tamami. Tavan bunu kesiyor ama mesru akislari kesmiyor: dort aday
   modelin her birini bir kez denemek (4) ya da taninmayan alanlari
   dusurerek istegi duzeltmek (GEMINI_DUSURULEBILIR dort kalem) hala
   sigiyor. Alti istek, en kotu halde gunluk kotanin ucte biri. */
const GEMINI_MAX_REQUESTS_PER_RUN = 6

/* MODEL YARISI (24.10.2026) — "en bosta olani sec".
 *
 * Google'in "bu model ne kadar mesgul" diye bir ucu YOK; bunu sormakla degil
 * YARISTIRARAK ogreniyoruz. Bugunun olcumleri bunu mumkun kiliyor:
 *
 *   - 503 ("currently experiencing high demand") 5-7 saniyede donuyor
 *     (olculen: 6,9 / 7,5 / 5,6 sn) — mesgul model kendini HIZLI belli ediyor.
 *   - Ilk byte her modelde ~15,2 sn: Google'in SSE keepalive'i, ayirt
 *     ETMIYOR. Bu yuzden kazanan ilk BYTE'a gore secilmiyor.
 *   - Ilk OLAY 17-60 sn arasinda savruluyor. "Bosta olma" sinyali bu: ilk
 *     islenmis olayi getiren model, o an en hizli cevap verendir.
 *
 * Sirali denemeye gore kazanc: mesgul model basina ~7 saniye ODENMIYOR ve
 * secim tahminle degil OLCUMLE yapiliyor. Bedeli: yarisa giren her modelin
 * gunluk kotasindan (RPD 20, model BASINA) bir istek.
 *
 * VARSAYILAN KAPALI (1) — ve sebebi onemli.
 *
 * Yaris, BASARILI kosuda da bir istek fazla harciyor: iki POST ayni anda
 * gidiyor, yani henuz hicbir sey bilmeden ikinci modelin RPD'sinden bir
 * istek yaniyor. Bu, bu dosyada BILEREK konmus bir korumayla celisiyor:
 * "terminal olmayan durumda SONRAKI ADAY MODEL denenmez — sorun modelde
 * degil, yanit henuz hazir degil; aday turlamak gunluk kotadan bos yere
 * istek goturur" (bkz. geminiProblem dali ve ayni adli test).
 *
 * Kazanci olculmus ve sinirli: mesgul model basina ~7 saniye (503'un donus
 * suresi). Bedeli her kosuda +1 RPD. RPD model basina 20 oldugu icin gunluk
 * kosu sayisi dogrudan etkilenir.
 *
 * Bu yuzden kod HAZIR ama kapali: 2 yazmak yarisi acar, 1 kalirsa sirali
 * yol aynen isler ve butun kota korumalari yerinde kalir. Sirali yol da
 * artik tek modele bagli degil — 503 veren model digerlerini kilitlemiyor
 * (bkz. geciciModeller), yani "en bosta olani bul" davranisinin buyuk kismi
 * yaris olmadan da calisiyor; yaris yalnizca o 7 saniyeyi kurtariyor.
 *
 * Yaris genisligi ayrica GEMINI_MAX_REQUESTS_PER_RUN'in kalanıyla kirpiliyor.
 *
 * Secret'tan okunuyor (GEMINI_MODE ile ayni desen) ve CAGRI aninda, sabit
 * olarak degil: boylece yarisi acmak icin deploy gerekmiyor — Supabase
 * panelinden GEMINI_YARIS_GENISLIGI=2 yazmak yeterli, geri almak icin de
 * silmek. Testler de ayni env uzerinden her iki davranisi olcebiliyor. */
const GEMINI_YARIS_GENISLIGI_VARSAYILAN = 1
function geminiYarisGenisligi(): number {
  const ham = Number(String(Deno.env.get('GEMINI_YARIS_GENISLIGI') ?? '').trim())
  if (!Number.isFinite(ham) || ham < 1) return GEMINI_YARIS_GENISLIGI_VARSAYILAN
  return Math.min(Math.floor(ham), GEMINI_MODEL_CANDIDATES.length)
}
/* Kazanani belirlemek icin durumlar bu araliklarla yoklaniyor. 250ms, ilk
   olay gecikmesinin (17-60 sn) yaninda olcum hatasi sayilir; daha sik
   yoklamak olay dongusunu bos mesgul eder. */
const GEMINI_YARIS_YOKLAMA_MS = 250

/* GECIKMELI YEDEK MODEL (25.10.2026) — "sessiz modeli beklerken ikincisini baslat".
 *
 * Kosu 37 (24.10, 42 sayfa IPPT): ilk aday gemini-3.8-flash istegi KABUL
 * etti, basliklar 15,3 sn'de geldi, sonra 72 sn tek olay gelmedi — olu akis
 * ancak 87. saniyede anlasilabildi. Toplam tavan 105 sn oldugu icin ikinci
 * modele 15 sn kaldi ve 3.7 HIC DENENMEDI; kart Groq'tan cikti.
 *
 * Sirali yolda bu aritmetik olarak cozulemez: olu akisin tespiti ~87 sn,
 * basarili bir Gemini cagrisi ~72-81 sn (olculen 30.374 krk / 72,4 sn,
 * 46.084 krk / 81,3 sn); toplam ~160 sn, Supabase duvari ~150 sn. Ilk olay
 * esigini kismak da cozmuyor: mesru ilk olaylar istegin basindan 17,5 /
 * 26,1 / 29,9 / 55,4 / 60,2 sn'de geldi; esigi 60'in altina indirmek
 * canli akisi keser, ustunde birakmak ikinci modele yer birakmaz.
 *
 * Cozum yarisin GECIKMELI hali: ilk model bu sure icinde tek olay
 * getirmediyse siradaki aday PARALEL baslatilir, ilk OLAYI getiren kazanir,
 * oteki kesilir. Yarisin (GEMINI_YARIS_GENISLIGI) kota itirazi burada
 * gecerli degil: hizli cevap veren modelde (bant kucultulduktan sonra
 * olculen ilk olaylarin ucu de 30 sn'nin altinda) yedek HIC baslamaz ve
 * kosu tek istek harcar. +1 RPD yalnizca ilk model sessizken odenir — tam
 * da o RPD'nin karsiliginda kartin Groq'a dusmedigi durumda.
 *
 * 35 sn: olculen hizli ilk olaylarin (17,5-29,9 sn) ustunde; yedek bu anda
 * baslarsa ilk olayi ~52-65. sn'de, tamamlanmayi ~107. sn civarinda verir.
 * Yedegin tavani bu yuzden URETIM tavanina degil devam tavanina
 * (geminiDevamTavan) bagli; ama TOPLAM tavana kadar hicbir yarisci olay
 * getirmediyse hepsi kesilir ve Groq'un payi eskisi gibi korunur.
 *
 * Yalnizca only modunda: shadow modunda Gemini birincil yol degil ve
 * fazladan RPD harcamanin karsiligi yok. Secret'tan okunuyor (testler ve
 * operasyon icin); 'kapali' ya da negatif deger yedegi kapatir. */
const GEMINI_YEDEK_GECIKME_MS_VARSAYILAN = 35_000
function geminiYedekGecikmeMs(): number {
  const ham = String(Deno.env.get('GEMINI_YEDEK_GECIKME_MS') ?? '').trim()
  if (!ham) return GEMINI_YEDEK_GECIKME_MS_VARSAYILAN
  if (/^kapali$/i.test(ham)) return -1
  const n = Number(ham)
  return Number.isFinite(n) ? n : GEMINI_YEDEK_GECIKME_MS_VARSAYILAN
}
/* Yedek ancak toplam tavana bu kadar varken baslatilir: ~15 sn baslik +
   olculen en gec mesru ilk olay (~45 sn baslik sonrasi) icin yer. Altinda
   baslatilan yedek olay getiremeden toplam tavanda kesilir; RPD bosa gider. */
const GEMINI_YEDEK_MIN_KALAN_MS = 50_000

/* AKAN AKIS KESILMEZ (25.10.2026, kosu 38).
 *
 * Kosu 38: yedek dogru calisti, 3.7 ilk olayi 75,7. saniyede getirdi ve
 * GERCEK akis basladi (185 olay, ~560 krk/sn). Ama 105. saniyede toplam
 * tavanda KESILDI: 16.329 krk elde, devam ettirme 3.7'de yok, kart KISMI
 * ve sayisal kapsama %49. Kart 110. saniyede bitti — butceden ~33 sn hic
 * kullanilmadan kaldi.
 *
 * 105 sn'lik tavanin gerekcesi Groq'a pay birakmakti. Akis AKIYORSA o pay
 * gereksiz: Groq'a dusulmeyecek. Artik ilk olay geldiginde akisin mutlak
 * tavani butcenin sonundan bu kadar oncesine uzatiliyor. Olay getirmeyen
 * akis eskisi gibi toplam tavanda kesiliyor (Groq'un payi korunuyor).
 *
 * 24 sn neden: Gemini'den sonra yazar (kapi NARRATIVE_WRITER_RESERVE_MS =
 * 20 sn, olculen ~2 sn) ve review (artik kalan butceye uyan deneme suresi,
 * taban REVIEW_MIN_ATTEMPT_MS; olculen 0,9-2,7 sn) kosuyor. Kosu 38'de bu,
 * 3.7'ye +14,5 sn yani ~8.000 krk daha demekti. */
const GEMINI_AKIS_SONRASI_PAYI_MS = 24_000

/* Ust uste kac gecici hata (503/500) sonrasi Gemini birakilir.

   20.10.2026 olcumu: 76 sayfalik bir destede ALTI istegin altisi da 503
   "high demand" dondu. 48 saniye ve gunluk kotanin %30'u hicbir ise
   yaramadan yandi; geriye kalan butce review'a yetmedi ve kart %43
   kapsamayla cikti.

   Ust uste 503 almak "bu model yogun" degil, "yuzey yogun" demektir —
   sonraki aday modeli denemek ayni duvara carpmaktir. Iki ardisik
   gecici hata yeter.

   IKI, bir degil: 09.10.2026'da ilk deneme 503 alip ikincisi tutmustu ve
   kart Gemini'den geldi. O vakayi kaybetmiyoruz.

   IKI DEGIL, BUTUN ADAYLAR (25.10.2026). Hedef degisti: Gemini her
   durumda calissin, Groq YALNIZCA butun Gemini modelleri gercekten
   erisilemezken. 24.10 kosu 37'de iki ayri modelin gecici hatasi (3.8 olu
   akis + 3.7'ye yer kalmamasi) kosuyu Groq'a dusurdu; kart %67 kapsamayla,
   yazarsiz ve review'suz cikti. Iki model "yuzey yogun" demeye yetmiyor —
   o gun 3.8 0/4, 3.7 503 almadigi her denemede gercek akis verdi. Model
   guvenilirligi modele gore degisiyor, yani "yuzey yogun" ancak HER aday
   gecici hata verdiginde soylenebilir. 503 4-7 saniyede donuyor; dort
   adayi turlamak ~30 saniye ve istek tavani (GEMINI_MAX_REQUESTS_PER_RUN)
   yerinde. */
const GEMINI_ARDISIK_GECICI_MAX = GEMINI_MODEL_CANDIDATES.length

/* Atanan seridin beklemesi bu esigi asarsa bos serit aranir.
   20.10.2026 olcumu: ucuncu pencere atanan seridinde 58.534ms bekledi,
   kosunun yarisi orada gecti ve review'a yer kalmadi. 15 saniyenin
   altindaki beklemeler icin devretmiyoruz: TPM penceresi 60 saniye,
   kisa bekleme modeli degistirmenin riskinden ucuz. */
const PENCERE_DEVIR_ESIGI_MS = 15_000

/* Devretmenin en az bu kadar kazandirmasi gerekir. Iki serit de
   doluyken bir oraya bir buraya gecip hicbir sey kazanmamak icin. */
const PENCERE_DEVIR_KAZANC_MS = 10_000

/* Dakikalik limite (RPM 5) carpinca beklenecek sure. Pencere 60 saniye;
   20 saniye onu garanti ETMEZ ama 2,5 saniyelik eski payla ayni dakikaya
   tekrar girmek kesin basarisizlikti. Yalnizca butcede gercek bos yer
   varsa kullanilir (bkz. cagri noktasi). Testler ve operasyon icin
   GEMINI_RPM_WAIT_MS secret'iyla ezilebilir — surenin kendisi bir tahmin,
   olcum geldikce degisecek. */
function geminiRpmWaitMs(): number {
  const ham = Number(Deno.env.get('GEMINI_RPM_WAIT_MS') || '')
  return Number.isFinite(ham) && ham >= 0 ? ham : 20_000
}

/* Ardisik Gemini istekleri arasindaki pay (RPM 5 — bkz. geminiDraft icindeki
   GEMINI_RETRY_WAIT_MS notu). geminiRpmWaitMs ile ayni desen: secret'la
   ezilebiliyor, cunku 25.10.2026'dan beri bir kosu dort adayin hepsini
   deneyebiliyor ve testler her denemede 2,5 sn bekleyince dosya run-all'in
   120 sn sinirini asiyordu. Canlida secret yok, deger 2.500. */
function geminiRetryWaitMs(): number {
  const ham = Number(Deno.env.get('GEMINI_RETRY_WAIT_MS') || '')
  return Number.isFinite(ham) && ham >= 0 ? ham : 2_500
}

/* Dakikalik 429'u bekleyip tekrar denemek, ancak bir Gemini cagrisina
   (olculen 67-111 sn) hala yer kaliyorsa mantikli. Altinda beklemek kalan
   zamani yakip hicbir sey uretmemek demek. */
const GEMINI_RPM_RETRY_MIN_REMAINING_MS = 90_000

const GEMINI_ONLY_BUDGET_MS = 145_000
const GEMINI_ONLY_MAX_CALL_MS = 105_000

/* 16.384 -> 32.768, GERI ALINDI (10.10.2026 15:03).
 *
 * 09.10'da 32.768'den 16.384'e indirmistim, gerekcem suydu: "olculen
 * cikti 30.374 karakter, yani tavanin dortte biri; yuksek tavan uretimi
 * artirmiyor ama modelin ayirdigi butceyi ve dolayisiyla SUREYI
 * buyutebiliyor". O gerekce bir OLCUM DEGIL, bir tahmindi — ve yanlisti.
 *
 * Olculen: 32.768 tavanla 30.374 karakter / 72,4 sn. 16.384 tavanla
 * 46.084 karakter / 81,3 sn. Yani sureyi tavan degil, istenen ICERIK
 * belirliyor; tavani kismak hicbir sey kazandirmadi.
 *
 * Kazandirmadigi gibi kaybettirdi: nokta bandi 22-28'e cikinca iki
 * kosuda da model tavana carpti ve JSON yarim dondu —
 *   "status=incomplete (cikti tavana carpti, JSON yarim)"
 * 3.7'de de 3.8'de de. 46.084 karakterlik JSON zaten ~14.000 token;
 * 16.384 tavanin hemen altindaydi, yani o basarili kosu da kil payiymis.
 *
 * 32.768, olculen en buyuk ciktinin iki katindan fazla. Gunluk kota 20
 * istek ve tavana carpan her cagri ~88 saniye yakip hicbir sey
 * uretmiyor; bu tarafta cimrilik etmenin karsiligi yok. */
const GEMINI_MAX_OUTPUT_TOKENS = 32_768

/** GEMINI_MODEL secret'i varsa basa alinmis model listesi. */
function geminiModelCandidates(): string[] {
  const override = String(Deno.env.get('GEMINI_MODEL') || '').trim()
  if (!override) return [...GEMINI_MODEL_CANDIDATES]
  return [override, ...GEMINI_MODEL_CANDIDATES.filter(m => m !== override)]
}

/**
 * Gemini'ye native gonderilebilecek mime tipi, yoksa null.
 *
 * Bilerek SADECE PDF. Gemini baska tipleri de okuyor, ama gölge yolun amaci
 * kapsam genisletmek degil olculebilir bir karsilastirma yapmak; DOCX/PPTX
 * zaten gömülü medyayi `word/media`, `ppt/media` uzerinden cikariyor ve o
 * yol calisiyor. Blast radius kucuk kalsin.
 */
function geminiNativeMime(mimeType: string): string | null {
  const m = String(mimeType || '').toLowerCase().split(';')[0].trim()
  return m === 'application/pdf' ? 'application/pdf' : null
}

/** Cevap "boyle bir model yok" mu diyor? Oyleyse sonraki adaya gecilir. */
function geminiModelMissing(status: number, body: string): boolean {
  if (status === 404) return true
  if (status !== 400) return false
  return /not found|not supported|unsupported model|unknown model|is not available|does not exist/i.test(body)
}

/** Cevap response_format/schema alanindan mi sikayetci? Oyleyse o alan dusurulur. */
function geminiFormatRejected(status: number, body: string): boolean {
  if (status !== 400) return false
  return /response_format|responseFormat|mime_type|schema|json/i.test(body)
}

/* Istegin govdesinden dusurulmesine IZIN VERILEN alanlar.
   Hicbiri dogruluk tasimiyor: response_format olmadan da prompt "SADECE
   gecerli JSON" diyor, generation_config olmadan da model varsayilan
   tavanla cevap veriyor. system_instruction ve input bu listede DEGIL —
   onlar dusurulurse istek anlamini kaybeder, o yuzden onlara takilan bir
   hata Groq'a dusmeyi hak eder. */
/* 'stream' ve 'store' da burada: yuzey akisi reddederse ("Unknown parameter
   'stream'") callGeminiOnce AKISSIZ eski yola duser, hat durmaz. */
const GEMINI_DUSURULEBILIR = ['response_format', 'generation_config', 'thinking_level', 'thinking_summaries', 'stream', 'store']

/**
 * "Unknown parameter 'X'" hatasindan X'i cikarir, dusurulebilir degilse null.
 *
 * 09.10.2026, ILK CANLI KOSU. Uc aday modelin ucu de soyle dondu:
 *   400 {"error":{"message":"Unknown parameter 'thinking_level'."}}
 * Yani endpoint de model adlari da DOGRUYDU; tek bir istege-ozel alan
 * kabul edilmedi ve butun kosu Groq'a dustu. Dokumanda listelenen bir
 * alanin gercek yuzeyde bulunmamasi bir kez oldugu icin bir daha olur;
 * bu yuzden tek tek alan adi kovalamak yerine genel bir mekanizma var:
 * hangi alana takildigini hatadan oku, o alani at, ayni modeli tekrar
 * dene. thinking_level artik bastan gonderilmiyor (olculdu, reddediliyor),
 * ama mekanizma bir sonraki surprizi de karsilar.
 */
/**
 * 429 PROJE KOTASI mi, yoksa anlik bir sikisiklik mi?
 *
 * 09.10.2026, ucuncu kosu: gemini-3.6-flash
 *   429 {"message":"Your project has exceeded a quota..."}
 * Kota PROJE seviyesinde — modele ozel degil. Yani baska bir adayi denemek
 * de, 800 ms sonra tekrar denemek de ayni duvara carpar ve her deneme
 * gunluk 100 isteklik kotadan bir tane daha goturur. Boyle bir 429'da
 * gölge yoldan HEMEN cikilir.
 *
 * 503 ("high demand") farkli: o gercekten gecici ve tekrar denemeye deger —
 * ikinci kosuda ilk deneme 503 aldi, ikincisi tuttu ve kart Gemini'den
 * geldi.
 */
/* 17.10.2026 DUZELTMESI — dakikalik limit GUNLUK kota sanilıyordu.
 *
 * Eski hali her 429'u olumcul sayiyordu: govdede "quota" ya da "rate limit"
 * gecmesi yetiyordu. Ama RPM 5 limitine carpan 429 de tam bu sozlerle
 * geliyor (bkz. :5841 civarindaki GEMINI_RETRY_WAIT_MS yorumu, ayni seyi
 * zaten soyluyor) ve o hata GECICI: birkac saniye beklenince gecer.
 *
 * Sonuc: dakikalik bir sinirlama yuzunden Gemini yolu tamamen terk ediliyor,
 * ustelik bu kontrol :5933'teki 503/500/429 gecici-hata dalindan ONCE
 * oldugu icin o dal 429 icin hic calismiyordu — yani tekrar deneme sansi
 * olan tek hata sinifi sessizce oluyordu.
 *
 * Artik yalnizca GUNLUK bir metrik adi gecerse olumcul sayiliyor. Groq
 * tarafindaki isDailyQuotaError (:56) ayni ayrimi zaten yapiyor. */
function geminiQuotaExhausted(status: number, body: string): boolean {
  if (status !== 429) return false
  return /per[ _-]?day|\bRPD\b|\bTPD\b|requests per day|PerDay|daily limit|gunluk/i.test(body)
}

function geminiUnknownParameter(status: number, body: string): string | null {
  if (status !== 400) return null
  const m = String(body || '').match(/Unknown (?:parameter|name|field)\s*['"`]?([A-Za-z0-9_.]+)/i)
  if (!m) return null
  const ad = m[1].split('.')[0]
  return GEMINI_DUSURULEBILIR.indexOf(ad) !== -1 ? ad : null
}

/**
 * Taslak promptuna eklenen native-belge talimati.
 *
 * Iki sey kritik:
 *  1. GRAFIK SERISI ISTENMIYOR. Chunked yoldaki gorsel gecisi tam bunu
 *     ogrendi: cizilmis bir egriden okunan seri tahmin oluyor (04.10.2026'da
 *     issizlik serisinin 1982 zirvesi 10,6 kaybolmus, GDP'nin log ekseni
 *     dogrusala duzlesmisti). Ustelik sanitizeCharts sayilari kaynak METINDE
 *     aradigi icin gorselden okunan seriyi zaten dusuruyor — yani istemek
 *     hem riskli hem bosuna. Okuma kelimeyle ya da tabloyla isteniyor.
 *  2. visual_findings. Grounding kapisi metni okuyor, resmi okuyamiyor; bir
 *     formul goruntusunden ya da Excel ekran goruntusunden gelen dogru bir
 *     bulguyu "uydurma" sayabilir. Modelden bu bulgulari ayrica listelemesini
 *     istiyoruz ki kapiya muaf olarak verilebilsin ve review de onlari
 *     KAYNAK olarak gorsun (bkz. visionNotes).
 */
/* CIKTI BUTCESI — KALEM KOTASI TOPLAM UZUNLUGU BAGLAMIYOR (21.10.2026).
 *
 * Band 25-60 araliginda indirildi ve ISE YARADI: nokta 27'den 18'e, soru
 * 13'ten 11'e dustu. Ama cikti BUYUDU — 34.372 karakterden 39.649'a.
 *
 * Sebep: kotali olan tek kisim terim/nokta/soru. "formulas", "tables" ve
 * visual_findings bilerek TAVANSIZ, cunku golge yolun var olma sebebi
 * onlar. Band kalemlerden yer bosaltinca model o yeri tavansiz kisma
 * harcadi — gorsel bulgu uc kosuda 6 → 13 → 22 oldu. Ucu uce olcum:
 *
 *   ilk olay   olay   karakter   gorsel   sonuc
 *   60.166ms   290    25.492     6        KISMI (tavan 105 sn)
 *   26.132ms   392    34.372     13       KISMI (tavan 96,9 sn, 503)
 *   17.524ms   517    39.649     22       KISMI (tavan 105 sn)
 *
 * Ilk olay 60 saniyeden 17,5'e indi, yani modele 87,5 saniye yazma suresi
 * kaldi — ve o sureyi de doldurdu. Hicbir yerde TOPLAM uzunluk siniri
 * olmadigi icin model her zaman duvara kadar yaziyor.
 *
 * 30.000 karakter uydurma degil: bu fonksiyonun kendi tarihcesindeki
 * TAMAMLANAN tek kosu 30.374 karakterdi ve 72,4 saniye surmustu. Olculen
 * yazma hizi 450-560 krk/sn; 30 KB, ilk olay 17-30 saniye araligindan sonra
 * bile tavanin altinda bitiyor.
 *
 * Kalem kotasini daha da kismak bu deligi kapatmaz — model bosalan yeri
 * yine tavansiz kisma harcar. Siniri TOPLAM uzunluga koymak gerekiyordu. */
const GEMINI_CIKTI_BUTCESI_KRK = 30_000

/**
 * Gemini yolunun KAPSAM KOTASI — belgenin boyuna gore.
 *
 * 09.10.2026, ilk basarili gölge kosusu. Gemini 42 sayfanin tamamini okudu,
 * 16 gorsel bulgu cikardi, 7 formulu degisken aciklamalariyla yakaladi — ama
 * yalnizca 7 terim, 9 nokta, 6 soru uretti. Groq ayni belgede 15/24/11
 * cikarmisti. Sebep modelin yetersizligi DEGILDI: paylasilan sistem promptu
 * "5-15 key_terms" diyor ve o rakam TEK GECIS yolu icin, yani kisa belgeler
 * icin yazilmisti. Groq'un uzun-belge yolunda her pencere o kotayi ayri ayri
 * dolduruyor ve iki pencerenin birlesimi dogal olarak iki kat aday uretiyor;
 * Gemini belgenin tamamini TEK cagrida okudugu icin kotayi bir kez doldurdu.
 *
 * Yani tek cagriya gecmenin bedeli buydu ve cozumu kotayi belgenin gercek
 * boyuna baglamak. Olcu olarak SAYFA sayisi kullaniliyor, cikarilan metnin
 * uzunlugu degil: bu destede metin 14.465 karakter (depth=standard'a denk
 * geliyor) ama belge 42 sayfa — icerigin cogu resimde oldugu icin karakter
 * sayisi belgenin boyunu sistematik olarak kucuk gosteriyor, ki gölge yolun
 * var olma sebebi zaten tam olarak bu.
 */
function geminiCoverageQuota(pageCount: number): string {
  /* OLCULEN GERI ADIM (09.10.2026, 21:15).
     Ilk hali 42 sayfalik belge icin 25-40 terim, 20-30 nokta, 10-15 soru
     ve TAVANSIZ formul/tablo istiyordu. Sonuc: tamamlanan tek kosu
     (30.374 karakter, 72,4 sn) bir daha tamamlanmadi — modelden uc dort
     kati uretim istenince sure 68 sn'ye de 90 sn'ye de sigmadi. Yani
     "sayilar az" duzeltmesi tamamlanmanin kendisini bozdu.

     Simdi yalnizca ASIL DEGER isteniyor: formuller ve tablolar. Onlar
     gölge yolun var olma sebebi (42 sayfanin 22'sinde denklem resim
     olarak duruyor ve Groq onlarin yalnizca 2'sini gorebiliyor) ve
     uretimin kucuk bir kismi. Terim/nokta/soru sayilari temel promptun
     kendi rakamlarinda birakildi; onlari buyutmenin bedeli, olculdugu
     uzere, kartin hic gelmemesi.

     Sayilari geri eklemek icin once tamamlanan bir kosu gerekiyor; o
     zaman tek tek, olcerek eklenir. */
  /* Sayilar OLCULEREK geri geldi (09.10.2026 21:40). Ilk hali 25-40 terim
     isteyip kosuyu tamamlanamaz hale getirmisti; kota tamamen kaldirilinca
     kosu tamamlandi ama 8 terim / 9 nokta kaldi (Groq 16/25 veriyordu).
     Bu bant ikisinin arasi ve formul/tablodan SONRA isteniyor — oncelik
     sirasi promptta acik, cunku gölge yolun degeri orada. */
  /* 10.10.2026 15:14 — BANT SORUN DEGILMIS, CEKINCELER SORUNMUS.
     Bandi 22-28'e cikardim ve nokta sayisi 18'den 11'e DUSTU, soru 10'dan
     5'e. Cikti tavana da carpmiyordu (44.855 karakter, tavan 32.768 token
     ~ 105.000 karakter). Yani model yer bulamadigi icin degil, IZIN
     verildigi icin durdu: kapsam metninde uc ayri cekince vardi —
     "if and only if the document genuinely supports it", "a floor to aim
     at, not a quota to fill", "stopping short of them is correct". Dolgu
     yapmasin diye yazmistim; sonucu, sayilarin istege donusmesi oldu.
     Simdi tek cekince kaldi ve sayilar duz emir olarak veriliyor.

     Ayni kosuda BIREBIR kurali ise tuttu: atilan terim 5'ten 1'e indi,
     grounding %87'den %96'ya cikti, sayisal kapsama %69 ile rekor
     (Groq'un en iyisi %67'ydi). Yani kalite yukseldi, nicelik dustu.

     Prompttaki tarihce de koda tasindi: "Differential Intercept,
     Differential Slope ve Semi-Elasticity iki kosuda da atildi" anekdotu
     bizim icin degerli, model icin dikkat dagitici. */
  /* 10.10.2026 14:51 — bant ILK KEZ yer oldugu icin yukseliyor.
     O kosu 81,3 saniye surdu (tavan 105), yani 23,7 saniye bosluk vardi;
     onceki kosu 101,2 saniyeydi, yani sure hala Google'in gecikmesiyle
     oynuyor ve bant bu dalgalanmaya dayanacak kadar olculu kalmali.
     Olculen uretim: 15 terim / 18 nokta / 10 soru. Groq'un ayni destedeki
     en iyisi 16 / 25 / 13 idi — aradaki tek gercek fark NOKTALAR, o yuzden
     once o bant aciliyor. */
  /* 20.10.2026 — BAND COK BUYUK BELGEDE GERI INIYOR.
     Band 25 sayfada tavana vurup bir daha inmiyordu: 86 sayfalik bir
     bolumde modelden 18-26 terim + 22-28 nokta + 12-15 soru + tavansiz
     formul/tablo isteniyordu. Yani sayfa basina en az zamani oldugu anda
     EN COK cikti.

     Olculdu: 86 sayfa / 68.205 krk metinde model 55 saniye dusundu,
     kalan ~50 saniyede 29.557 karakter yazdi (~600 krk/sn) ve yetisemedi.
     Kart KISMI cikti, kapsama %31, onbellege alinmadi.

     60 sayfa ustunde terim/nokta/soru geri iniyor. Formul ve tablo
     TAVANSIZ kaliyor: golge yolun var olma sebebi onlar. Takas bilincli —
     biraz daha az terim tasiyan TAM bir kart, yarim bir karttan iyidir;
     ustelik tam kart onbellege girer ve ayni belge bir daha 105 saniye
     yakmaz. */
  /* 21.10.2026 — EN BUYUK BANT 25-60 ARALIGINDAYDI.
     20.10'da band 60 sayfa USTUNDE geri indirildi, ama zirve orada degildi:
     25-60 araligi hem en yuksek istegi tasiyordu hem de gunluk kullanimin
     tamami o araliga dusuyor. Ucu uce iki olcum, ikisi de bu bantta:

       38 sayfa (economy ch.21): 22 terim / 25 nokta / 13 soru
                                 36.680 krk, 105 sn tavanda kesildi, KISMI
       42 sayfa (IPPT dummy):    16 terim / 27 nokta / 13 soru
                                 34.372 krk, 96,9 sn tavanda kesildi, KISMI

     Pencere hesabi: yazma hizi olculen 560 krk/sn, ilk olay 26-30 sn. Yani
     tavan 105 sn iken yazilabilir en fazla ~44 KB; 503 tavani 96,9 sn'ye
     indirdiginde ~40 KB. Band bu iki belgede modelden o siniri gecen bir
     uretim istiyor ve kart her seferinde yarim kaliyor — onbellege de
     girmedigi icin ayni dosya her yuklemede bastan 105 saniye yakiyor.

     Bu fonksiyonun kendi tarihcesi ayni seyi zaten yaziyor: AYNI 42
     sayfalik destede kota yokken kosu 30.374 karakterle 72,4 saniyede
     TAMAMLANMISTI ve "modelden uc dort kati uretim istenince sure 68 sn'ye
     de 90 sn'ye de sigmadi". 10.10'da band yer varmis gibi gorundugu icin
     yukseltildi (o kosu 81,3 sn surmustu, 23,7 sn bosluk vardi) — ama o
     olcumde ne 503 vardi ne de ilk olay 26 saniyeye kadar gecikiyordu.

     Simdi 25-60 araligi 10-25 bandiyla ayni: bant 10 sayfadan 60 sayfaya
     duz gidiyor. Takas yine bilincli ve yonu 20.10 ile ayni — biraz daha az
     nokta tasiyan TAM bir kart, yarim karttan iyidir. En pahali kalem
     noktalar (27 adet); formul ve tablo TAVANSIZ kaliyor, golge yolun var
     olma sebebi onlar. */
  let terms = '12-18', points = '14-18', quiz = '8-10'
  if (pageCount > 60) { terms = '14-18'; points = '16-20'; quiz = '8-10' }
  else if (pageCount > 10) { terms = '15-22'; points = '16-20'; quiz = '10-13' }
  const olcek = pageCount > 0 ? `all ${pageCount} pages` : 'the whole document'
  const destek = pageCount > 0
    ? `A ${pageCount}-page lecture document`
    : 'A document of this size'
  return `

COVERAGE FOR THIS RUN:
Cover ${olcek}, not only the opening ones — a term or example from the last third is worth more than a third variation on the first idea.
No cap on "formulas" (every equation, including the image-only ones) or "tables" (every table, including spreadsheet screenshots and regression output — copy the figures exactly, to the last decimal). These two are why you were given the original file: do them first and be complete.
Then produce ${terms} key_terms, ${points} key_points and ${quiz} quiz_questions. ${destek} supports these counts — reach them. The one thing worse than falling short is restating the same idea in different words to fill the list.

LENGTH BUDGET: keep the ENTIRE JSON response under ${GEMINI_CIKTI_BUTCESI_KRK} characters. This is a wall, not a style note: the connection is cut at that point, and a card assembled from a truncated response loses its citations and is never cached, so the same file is re-read from scratch on every upload. Budget the space — formulas and tables first, then the counts above. Write definitions and points in one or two sentences; drop the lead-ins ("It is important to note that"). A COMPLETE response with fewer items is worth more than a longer one that gets cut off mid-field.`
}

function buildGeminiDocInstruction(pageMarkerLabel: string, pageCount: number): string {
  const unit = pageMarkerLabel === 'SLAYT' ? 'slide' : 'page'
  const extent = pageCount > 0
    ? `This document has ${pageCount} ${unit}s. Cover ALL of them, first to last.`
    : `Cover the ENTIRE document, first ${unit} to last.`
  return `

NATIVE DOCUMENT ACCESS (this run only — read this before anything else):
You are given the ORIGINAL document file, not only the extracted text below. You can see every ${unit} exactly as it is laid out: equations pasted in as images from an equation editor, spreadsheet screenshots, scatter plots, comparison diagrams. The extracted text below is a LOSSY copy of the same document — where the two disagree, the document itself is correct.
${extent} There is no ${unit} budget on this run.

- FORMULAS: read every equation off the ${unit}, including the ones that are images, and put them in "formulas" as LaTeX with each variable's meaning. This is the single most valuable thing you can do here — in the extracted text these equations do not exist at all.
- TABLES: read every table off the ${unit}, including spreadsheet screenshots and regression output, into "tables" with real headers and rows. Copy the values character-for-character; do not round, re-order or "tidy" them.
- DIAGRAMS: reconstruct process flows, hierarchies and comparison figures as Mermaid in "diagrams", and explain each in "description".
- CHARTS — IMPORTANT: do NOT put a numeric series into "charts" unless those same numbers are also printed as text or in a table in the document. A series read off a plotted curve is a guess, and a downstream validator drops any series it cannot find in the text anyway. Instead, state what the chart shows IN WORDS as a key_point (axes, direction, named extremes and their labelled values if the ${unit} prints them).
- FOOTNOTE PAGES: use the document's own 1-based ${unit} numbers in "footnotes[].page". You can see the ${unit} a claim came from — use it.
- EXTRA FIELD FOR THIS RUN: "visual_findings": [ string ]. One short sentence per fact you read from a FIGURE, an EQUATION IMAGE or a TABLE SCREENSHOT rather than from the running text. A downstream validator can only read the extracted text; this list is how it is told that such a fact is grounded in a picture it cannot see. Use [] if everything you reported came from the text.
  ONE RULE IS STRICT HERE: every key_term written on a ${unit} rather than in the running text must appear VERBATIM — same words, same order — in one of these lines, written as "<the term>: <what the ${unit} says>". A paraphrase does not count; a validator matches exact words and discards the term as invented.`
}

/**
 * Gemini cevabindan metni cikarir.
 *
 * Iki sekli birden destekliyor: Interactions API'nin `steps[].content[].text`
 * yapisi ve generateContent'in `candidates[0].content.parts[].text` yapisi.
 * Sebep tek: hangi yuzeyin bu hesapta cevap verdigine bakmadan ayni kod
 * calissin — doküman degisirse burasi sessizce bos string dondurmesin.
 */
function extractGeminiText(data: any): string {
  if (!data || typeof data !== 'object') return ''
  const pieces: string[] = []

  const steps = Array.isArray(data.steps) ? data.steps : []
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i]
    if (!step || typeof step !== 'object') continue
    if (step.type && step.type !== 'model_output') continue
    const content = Array.isArray(step.content) ? step.content : []
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      if (part.type && part.type !== 'text') continue
      if (typeof part.text === 'string') pieces.push(part.text)
    }
    if (pieces.length > 0) break
  }
  if (pieces.length > 0) return pieces.join('')

  const parts = data?.candidates?.[0]?.content?.parts
  if (Array.isArray(parts)) {
    for (const p of parts) if (p && typeof p.text === 'string') pieces.push(p.text)
  }
  if (pieces.length === 0 && typeof data.output_text === 'string') pieces.push(data.output_text)
  return pieces.join('')
}

/**
 * 200 donmus ama ise yaramaz bir cevabi tespit eder; sebebi dondurur,
 * sorun yoksa null. Ozellikle `incomplete` onemli: cikti tavana carpmis
 * demek, yani JSON yarim — Groq'a dusmek dogru karar.
 */
function geminiProblem(data: any): string | null {
  if (!data || typeof data !== 'object') return 'bos yanit'
  const status = String(data.status || '')
  if (status === 'failed' || status === 'cancelled') return `status=${status}`
  if (status === 'incomplete') return 'status=incomplete (cikti tavana carpti, JSON yarim)'
  /* Interactions API'nin terminal OLMAYAN durumlari (in_progress, queued,
     requires_action). Bugun stream:false + background yokken donmemeleri
     gerekir; ama donduklerinde eski kod bunlari "sorun yok" sayip bos
     metin goruyor ve "cevapta metin yok" deyip SONRAKI MODELI yakiyordu —
     gunluk kotadan bos yere bir istek daha. Adiyla anilsin. */
  if (status === 'in_progress' || status === 'queued' || status === 'requires_action') {
    return `status=${status} (terminal degil — yanit henuz hazir degil)`
  }
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return `errors=${JSON.stringify(data.errors).slice(0, 300)}`
  }
  if (data.error) return `error=${JSON.stringify(data.error).slice(0, 300)}`
  const finish = data?.candidates?.[0]?.finishReason
  if (finish && finish !== 'STOP') return `finishReason=${finish}`
  return null
}

/**
 * Gemini'nin GORSELDEN okudugunu bildirdigi bulgular, review'a kaynak ve
 * grounding kapisina muafiyet olarak verilmek uzere duz metin satirlari.
 * visual_findings'in yaninda formul adlari ve tablo basliklari da alinir:
 * ikisi de taniminda gorselden geliyor ve kapi ikisini de metinde arar.
 */
/* SEKIL NOTU TAVANI (28.10.2026'da 60 -> 200).
 *
 * 60'in gerekcesi "review prompt sismesin" idi. Ama review prompt'u zaten
 * visionNotes.slice(0, 20) aliyor (bkz. figureBlock) — tavan onu hic
 * korumuyordu. Tavanin gercek musterisi temellendirme kapisi: o notlarin
 * TAMAMINI kaynak metne ekliyor ve resimden okunan icerik ne kadar genisse
 * o kadar az gercek terim "uydurma" sayiliyor. Tablo hucreleri eklenince
 * 60 hemen doluyor (uc tablo x 11 satir + diyagram dugumleri). */
const GEMINI_SEKIL_NOTU_TAVANI = 200

/* Mermaid kaynagindaki dugum etiketleri: A[Metin], B(Metin), C{Metin}.
   Yalnizca kapinin kaynak metnini genisletmek icin cikariliyor — yeniden
   cizim yok, bu yuzden ayristirma kasitli olarak kaba. */
function mermaidEtiketleri(src: string): string[] {
  const out: string[] = []
  const re = /\[([^\]\n]{2,120})\]|\(([^)\n]{2,120})\)|\{([^}\n]{2,120})\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const etiket = String(m[1] ?? m[2] ?? m[3] ?? '').replace(/^["']|["']$/g, '').trim()
    if (etiket) out.push(etiket)
    if (out.length >= 40) break
  }
  return out
}

function geminiFigureNotes(parsed: any): string[] {
  const out: string[] = []
  const push = (s: unknown) => {
    const t = String(s ?? '').replace(/\s+/g, ' ').trim()
    if (t.length >= 3 && out.length < GEMINI_SEKIL_NOTU_TAVANI) out.push(t.slice(0, 300))
  }
  if (!parsed || typeof parsed !== 'object') return out

  if (Array.isArray(parsed.visual_findings)) {
    for (const f of parsed.visual_findings) push(typeof f === 'string' ? f : (f?.text ?? f?.finding))
  }
  if (Array.isArray(parsed.formulas)) {
    for (const f of parsed.formulas) {
      const name = String(f?.name ?? '').trim()
      const latex = String(f?.latex ?? '').trim()
      if (name && latex) push(`${name}: ${latex}`)
      else push(name || latex)
    }
  }
  if (Array.isArray(parsed.tables)) {
    for (const t of parsed.tables) {
      const title = String(t?.title ?? '').trim()
      const heads = Array.isArray(t?.headers) ? t.headers.map((h: unknown) => String(h ?? '').trim()).filter(Boolean) : []
      if (title) push(heads.length ? `${title} (${heads.join(' | ')})` : title)
    }
  }
  if (Array.isArray(parsed.diagrams)) {
    for (const d of parsed.diagrams) push(String(d?.title ?? '').trim())
  }

  /* RESIMDEN OKUNANIN GOVDESI DE KAYNAK (28.10.2026).
   *
   * Yukarisi yalnizca BASLIK topluyordu: tablo basligi + sutun adlari,
   * diyagram basligi, formul adi. Oysa yalnizca resim olarak var olan
   * icerik tam da govdede duruyor: tablo HUCRELERI, diyagram DUGUM
   * etiketleri, formul DEGISKENLERININ anlamlari.
   *
   * Olculen kosu (28.10, Kanin Ozellikleri, 67 sayfa, 160 krk/sayfa):
   * kartta uc tablonun 25+ satiri ve iki diyagramin 18 dugumu
   * (Pluripotent Kok Hucre, CFU-GEMM, Proeritroblast ...) vardi; hicbiri
   * figureText'e ulasmiyordu. 9592'deki yorum hedefi zaten yazmis:
   * "Gemini'nin tek kattigi deger — resimden okunan formul ve TABLO".
   * Tablo adi geciyordu, icerigi degil.
   *
   * SIRA ONEM TASIYOR: review prompt'u visionNotes.slice(0, 20) aliyor.
   * Hacimli govde malzemesi bu yuzden SONA ekleniyor — review'un gordugu
   * ozet bulgular degismiyor, kapi ise tamamini aliyor (join('\n')). */
  if (Array.isArray(parsed.formulas)) {
    for (const f of parsed.formulas) {
      for (const v of (Array.isArray(f?.variables) ? f.variables : [])) {
        const sembol = String(v?.symbol ?? '').trim()
        const anlam = String(v?.meaning ?? '').trim()
        if (sembol && anlam) push(`${sembol}: ${anlam}`)
        else push(anlam)
      }
    }
  }
  if (Array.isArray(parsed.tables)) {
    for (const t of parsed.tables) {
      for (const satir of (Array.isArray(t?.rows) ? t.rows : [])) {
        if (!Array.isArray(satir)) { push(satir); continue }
        push(satir.map((c: unknown) => String(c ?? '').trim()).filter(Boolean).join(' | '))
      }
    }
  }
  if (Array.isArray(parsed.diagrams)) {
    for (const d of parsed.diagrams) {
      push(String(d?.description ?? '').trim())
      for (const etiket of mermaidEtiketleri(String(d?.mermaid ?? ''))) push(etiket)
    }
  }
  return out
}

/* ==========================================================================
   GEMINI AKIS (SSE) — 18.10.2026
   ==========================================================================
   NE DEGISTI: istek `stream: true` ile gidiyor ve cevap Server-Sent Events
   olarak okunuyor. Dokumanda (ai.google.dev/api/interactions-v1) olaylar
   sunlar: `interaction.status_update` (status=in_progress), `step.delta`
   ({delta:{type:'text',text:'...'}}), `step.stop`, `interaction.completed`,
   `error`. Her olay bir `event_id` tasiyabiliyor.

   NEDEN. Eski hali tek atislik bir zaman asimiydi: 105 saniye boyunca
   modelin calisip calismadigi BILINMIYOR, sonra her sey copa gidiyordu.
   10.10 ve 17.10 kosularinda olculen Gemini gecikmesi 67-111 saniye, yani
   tavan nereye konursa konsun bir kismi her zaman kesilecek. Akis bu soruyu
   ikiye boluyor:

     - MODEL CALISIYOR AMA YAVAS  -> delta geliyor, beklemeye devam
     - BAGLANTI OLDU              -> delta gelmiyor, hemen bitir

   Eskiden ikisi ayni hataydi. Simdi zaman asimi SESSIZLIK sayacina bagli
   (GEMINI_SILENCE_MS): her olayda sifirlanir, yalnizca gercekten hicbir sey
   gelmiyorsa tetiklenir. Mutlak tavan yine duruyor (Supabase'in ~150 sn
   duvarina karsi emniyet), ama artik istisna degil son durak.

   VE KESILEN CIKTI ARTIK KURTARILIYOR. Akis kesildiginde elde o ana kadar
   gelen metin var; closeTruncatedJson onu kapatip ayristirmayi deniyor.
   105 saniye yanip elde hicbir sey kalmamasi bitti.

   DUSURULEBILIR: `stream` ve `store` GEMINI_DUSURULEBILIR listesinde. Yuzey
   bu alanlari reddederse ("Unknown parameter 'stream'") mevcut dusur-ve-
   tekrar-dene mekanizmasi devreye girer ve cagri AKISSIZ eski yoldan gider.
   Yani akisin kabul edilmedigi bir anahtarda bile hat calismaya devam eder.
   ========================================================================== */

/* AKIS BASLADIKTAN SONRA iki olay arasinda gecebilecek en uzun sure.
   Olaylar akmaya basladiysa 25 saniyelik bir bosluk olu baglanti demektir;
   o noktada beklemeye devam etmek 105 saniyeye kadar bos bekleyen eski
   davranisin ta kendisi olurdu. */
const GEMINI_SILENCE_MS = 25_000

/* ILK BYTE'A kadar beklenecek sure — SESSIZLIKTEN AYRI, ve bu ayrim bir
   OLCUMUN sonucu (18.10.2026, ilk akisli canli kosu).

   O kosuda uc model ust uste "sessizlik (25000ms olay gelmedi)" ile
   dustu ve elde 0 karakter kaldi. Istek 400 ALMADI, yani yuzey
   `stream: true`'yu reddetmiyor — YOK SAYIYOR: yanit eskisi gibi tek
   parca ve olculen 90-111 saniyede geliyor. Tek bir sayac bu iki durumu
   ayirt edemez:
     - ilk byte 90 saniye sonra gelebilir (normal, yok sayilan akis)
     - olaylar arasi 25 saniye bosluk ise anormal (olu baglanti)
   Tek esik 25 saniye olunca birinci durum ikinci sanildi ve her model
   gunluk kotadan (RPD 20) bir istek yakti. Simdi ilk byte mutlak tavana
   kadar bekleniyor; sessizlik sayaci yalnizca akis GERCEKTEN basladiktan
   sonra devreye giriyor. Yuzey bir gun delta gondermeye baslarsa kazanc
   kendiliginden geri gelir. */
const GEMINI_FIRST_BYTE_MS = 100_000

/* ILK OLAYA kadar beklenecek sure — ilk BYTE'tan ayri.

   20.10.2026 olcumu, ayni belgenin iki kosusu:
     ilk byte 15.235ms, ilk olay  55.441ms -> 307 olay, 29.557 krk (iyi)
     ilk byte 15.229ms, ilk olay 101.843ms ->  23 olay,  2.148 krk (bos)
   Yani baglanti aciliyor ama olay gelmiyor; aradaki fark kartin dolu
   olmasiyla bos olmasi arasindaki fark.

   72 saniye: mesru dusunme suresi olarak 55,4 saniye OLCULDU, esik onun
   belirgin ustunde kalmali. Ote yandan bu sure dolunca Groq'un tam bir
   kosusu icin hala ~70 saniye kaliyor — vazgecmenin bedeli bos bir
   karttan kucuk. */
const GEMINI_ILK_OLAY_MS = 72_000

/* GEMINI DEVRE KESICI (25.10.2026).
 *
 * 23.10 aksamindan beri HER kosu ayni: baglanti aciliyor (ilk byte ~15 sn,
 * icerigi ": keep-alive"), sonra 72 sn hic olay gelmiyor ve cagri 87 sn'de
 * olu akis olarak dusuyor. Groq yedek yolu ancak ondan SONRA basliyor ve
 * Supabase'in 150 sn sinirina ~60 sn kaliyor. 42 sayfalik belgeler sigdi;
 * 49 sayfalik BF415 Week01'de Groq'un ucuncu penceresi TokenPacer yuzunden
 * 57 sn bekledi, isci 150. saniyede 546 ile kapatildi ve belge 'processing'
 * durumunda takili kaldi.
 *
 * Sonraki GEMINI_DEVRE_MS boyunca Gemini hic denenmez; Groq butun butceyle
 * hemen baslar. Sure dolunca ilk istek Gemini'yi yeniden dener; o da duserse
 * devre yeniden acilir. Durum isciler arasinda paylasilsin diye
 * site_settings'te (key = gemini_devre) tutuluyor.
 *
 * DARALTILDI (27.10.2026). Ilk hali TEK bir olu akis ya da 503'te 30 dk
 * aciliyordu. Bu, "Gemini her durumda, Groq yalnizca cok acil durumda"
 * hedefiyle celisiyordu ve olculen kosu bunu gosterdi: 26.10'da devre acikken
 * IPPT destesi Gemini denenmeden Groq'tan cikti (kapsama %56, yazar 47 sn
 * pacer bekledi). Oysa artik tek modelin dusmesi Gemini'nin dusmesi demek
 * degil: gecikmeli yedek model ve aday kuyrugu var (kosu 38'de 3.8 olu akis
 * verirken 3.7 karti getirdi).
 *
 * Artik devre YALNIZCA bir kosuda BUTUN aday modeller kota ya da gecici hata
 * (503/500/olu akis) verdiginde aciliyor — bkz. geminiDraft tani.hepsiDustu.
 * Zaman/istek tavani yuzunden denenemeyen aday varsa acilmiyor: o modelin
 * dustugunu bilmiyoruz.
 *
 * 5 dk: "high demand" dalgalari dakikalar suruyor; butun modeller dusmusken
 * her yuklemede ~30 sn'lik bos denemeyi (4 aday x ~7 sn 503) engellemeye
 * yetiyor, ama Gemini geri geldiginde en fazla 5 dk kayip. Gunluk kota
 * bittiyse her 5 dk'da bir yoklama 4 hizli 429 demek — kabul edilebilir. */
const GEMINI_DEVRE_MS = 5 * 60_000
/* KOTA 429'U KENDI SURESI (27.10.2026).
 *
 * 5 dakika "high demand" dalgasi icin olculdu: o dalgalar dakikalar suruyor.
 * KOTA bambaska bir sey. Ucretsiz katmanda Flash basina RPD 20 ve govde
 * hangisine carptigimizi SOYLEMIYOR — "Your project has exceeded a quota"
 * hem RPM hem RPD icin ayni metin (bkz. geminiQuotaExhausted). Gunluk kota
 * bittiyse 5 dakikalik devre gunde ~288 yoklama demek ve her yoklama
 * RPD'den yiyebilecek bir istek.
 *
 * 30 dakika iki tarafa da dayaniyor: RPM dalgasiysa en fazla 30 dk Gemini'siz
 * kaliriz (kart yine cikar — Groq TAM butceyle kosar, ki olculen kosuda
 * Gemini'nin yedigi 87 saniye tam da bu butceydi), RPD ise gunde ~48
 * yoklamaya iniyoruz.
 *
 * Olculen kosu (27.10, 18:40): 3.7 olu akis, 3.5 ve 3.6 429, 3.8 503. Devre
 * ACILMADI, cunku 429 dali `geciciModeller`'e model EKLEMIYORDU ve tetik
 * hepsiDustu'ydu. Yani kota bittigi gun her yukleme 87 saniyeyi yeniden
 * yakiyordu. */
const GEMINI_KOTA_DEVRE_MS = 30 * 60_000
const GEMINI_DEVRE_ANAHTAR = 'gemini_devre'

async function geminiDevreOku(client: any): Promise<{ acik: boolean; kalanDk: number; neden: string }> {
  try {
    const { data } = await client.from('site_settings').select('value').eq('key', GEMINI_DEVRE_ANAHTAR).maybeSingle()
    const v = (data && data.value) || {}
    const until = Date.parse(String(v.until || '')) || 0
    return { acik: until > Date.now(), kalanDk: Math.max(0, Math.ceil((until - Date.now()) / 60_000)), neden: String(v.neden || '') }
  } catch (_e) {
    return { acik: false, kalanDk: 0, neden: '' }
  }
}

async function geminiDevreAc(client: any, neden: string, sureMs = GEMINI_DEVRE_MS) {
  try {
    const until = new Date(Date.now() + sureMs).toISOString()
    await client.from('site_settings').upsert({
      key: GEMINI_DEVRE_ANAHTAR,
      value: { until, neden, acildi: new Date().toISOString() },
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })
    console.warn(`Gemini devre kesici ACILDI: ${Math.round(sureMs / 60_000)} dk boyunca dogrudan Groq (${neden})`)
  } catch (e) {
    console.warn('Gemini devre kesici yazilamadi: ', e)
  }
}

/* ISCI NOBETCISI (25.10.2026): Supabase isciyi ~150 sn'de kapatiyor ve o anda
 * hicbir catch calismiyor; belge 'processing' kalip ogrenci sonsuza kadar
 * "isleniyor" goruyordu. 141. saniyede belge hala 'processing' ise 'failed'
 * isaretlenir (ekran "tekrar dene" gosterir). Is ondan sonra yine de
 * biterse 'summarized' yazimi bunu ezer. */
const ISCI_NOBET_MS = 141_000

/* Kurtarmaya deger en kucuk kismi cikti. Bunun altinda bir tampon zaten bir
   karta donusmez; kurtarmayi denemek yalnizca logu kirletir. */
const GEMINI_PARTIAL_MIN_CHARS = 2_000

/* Kopan akisin GET ile kac kez devam ettirilebilecegi. Devam ettirme YENI
   bir uretim istegi degil (ayni etkilesim okunuyor), ama yine de bir HTTP
   istegi — sinirsiz birakmak bir dongude butceyi yiyebilir. */
const GEMINI_MAX_RESUMES = 2

/* DEVAM ETTIRME PENCERESI (21.10.2026).
 *
 * geminiToplamTavan URETIM istekleri icindir: toplami 105 saniyede tutup
 * Groq'a sabit pay birakir. Devam ettirme ise uretim istegi degil — ayni
 * etkilesim GET ile okunuyor, gunluk kotadan (RPD 20) istek goturmuyor.
 * Ikisini ayni tavana baglamak devam ettirmeyi OLU KOD yapiyordu: akis tam
 * `tavan` ms'de abort ediliyor, dolayisiyla resume dongusune varildiginda
 * geriye daima ~0 kaliyor. 20.10 kosusu: "devam ettirmeye yer kalmadi
 * (-12ms)" — tesadüf degil, aritmetik zorunluluk. O kosuda tam JSON'a
 * 59 KARAKTER kalmisti ve ogrenci kismi kart gordu.
 *
 * Pencere GEMINI_RESERVE_MS'ten (review + kapilar + kayit) aliniyor.
 * Olculen: review 33 saniye istedi, 2,66 saniyede bitti; daralan butceyi
 * review'in kademe makinesi zaten yonetiyor. Karsiliginda kart tamamlanir
 * ve ONBELLEGE YAZILIR — kismi kart yazilmiyor, yani bu pencere olmadan
 * ayni PDF her yuklemede 105 saniye + 1 RPD yakmaya devam ediyor. */
/* DEVAM ETTIRME BU MODELDE DESTEKLENMIYOR (21.10.2026, aksam kosusu).
 *
 * Sebep yazilmaya baslandigi ilk kosuda cevap geldi:
 *
 *   devam ettirme HTTP 400: {"error":{"message":"Streaming retrieval of
 *   interactions is not supported for this model","code":"invalid_request"}}
 *
 * Yani GET ile kaldigi yerden okuma gemini-3.7-flash'ta hic yok. Dun acilan
 * 15 saniyelik pencere dogru tasarlanmisti ama yuzey onu kabul etmiyor;
 * bedeli her kesik akista bir bos HTTP istegi ve ~600ms. Model bir kez
 * reddettiyse ayni ornekte bir daha denenmiyor. */
const geminiDevamDesteklemeyen = new Set<string>()

const GEMINI_DEVAM_PAYI_MS = 15_000
/* Devam ettirme ne kadar yer bulursa bulsun kapilar + kayit icin bu kadari
   dokunulmaz kalir; pencere butcenin sonunu yiyemez. */
const GEMINI_DEVAM_KAYIT_PAYI_MS = 20_000

type GeminiAkisDurum = {
  metin: string
  interactionId: string
  lastEventId: string
  status: string
  tamamlandi: boolean
  hata: string | null
  olaySayisi: number
  /* Akisin kendisi token sayisi tasimiyor; `interaction.completed` olayinin
     kismi kaynaginda bulunursa alinir, yoksa null kalir. */
  usage: any
  /* Govdenin tamami, ayristirilmadan. Yuzey akisi yok sayarsa buradaki
     metin duz bir Interaction JSON'u olur (bkz. geminiAkisiTuket). */
  ham: string
  /* Akis hic olay vermediyse ve ham govde duz JSON olarak ayristirildiysa
     yanit nesnesi. Varsa cagri BASARILI sayilir. */
  duzYanit: any
  /* OLCUM (18.10.2026). Istegin basindan itibaren ms: ilk veri parcasi ve
     ilk ayristirilan olay. -1 = hic gelmedi. Ikisi birbirine YAKIN ve
     toplam sureden KUCUK ise akis gercekten akiyor; ikisi de toplam sureye
     esitse yuzey her seyi sonda tek seferde gondermis demektir. */
  t0: number
  ilkByteMs: number
  ilkOlayMs: number
}

function geminiAkisDurumu(): GeminiAkisDurum {
  return {
    metin: '', interactionId: '', lastEventId: '', status: '', tamamlandi: false,
    hata: null, olaySayisi: 0, usage: null, ham: '', duzYanit: null,
    t0: 0, ilkByteMs: -1, ilkOlayMs: -1
  }
}

/** Tek bir SSE blogunu (bos satira kadar olan kisim) durum uzerine isler. */
function geminiSseBlogunuIsle(blok: string, durum: GeminiAkisDurum): void {
  const veri: string[] = []
  for (const satir of blok.split('\n')) {
    const t = satir.trim()
    if (!t || t.startsWith(':')) continue            // yorum / heartbeat
    if (t.startsWith('id:')) {
      const id = t.slice(3).trim()
      if (id) durum.lastEventId = id
      continue
    }
    if (t.startsWith('data:')) veri.push(t.slice(5).trim())
  }
  if (veri.length === 0) return
  let olay: any
  try { olay = JSON.parse(veri.join('\n')) } catch (_e) { return }
  durum.olaySayisi++
  if (durum.ilkOlayMs < 0 && durum.t0 > 0) durum.ilkOlayMs = Date.now() - durum.t0

  if (typeof olay?.event_id === 'string' && olay.event_id) durum.lastEventId = olay.event_id
  if (typeof olay?.interaction_id === 'string' && olay.interaction_id) durum.interactionId = olay.interaction_id
  if (typeof olay?.interaction?.id === 'string' && olay.interaction.id) durum.interactionId = olay.interaction.id

  switch (String(olay?.event_type || '')) {
    case 'step.delta': {
      const d = olay.delta
      if (d && (!d.type || d.type === 'text') && typeof d.text === 'string') durum.metin += d.text
      return
    }
    case 'interaction.status_update':
      if (olay.status) durum.status = String(olay.status)
      return
    case 'interaction.completed':
      /* Olayin tasidigi kismi kaynak kendi `status` alanini verebiliyor:
         incomplete (cikti tavani), failed, cancelled. Korumak ZORUNLU —
         geminiProblem bu durumlara gore karar veriyor ve 'completed'
         yazmak yarim bir JSON'u tam sanmak olurdu. */
      durum.status = String(olay?.interaction?.status || 'completed')
      durum.tamamlandi = true
      if (olay?.interaction?.usage) durum.usage = olay.interaction.usage
      return
    case 'error':
      durum.hata = String(olay?.error?.message || olay?.error?.code || 'akis hatasi')
      return
    default:
      return
  }
}

/**
 * Akisi tuketir. `dokun` her veri parcasinda cagrilir — sessizlik sayacini
 * sifirlayan sey bu, yani "yavas model" ile "olu baglanti" burada ayriliyor.
 */
async function geminiAkisiTuket(
  res: Response,
  durum: GeminiAkisDurum,
  dokun: (tur?: 'byte' | 'olay' | 'baslangic') => void
): Promise<void> {
  const reader = res.body?.getReader?.()
  if (!reader) { durum.hata = 'akis govdesi okunamadi'; return }
  const dec = new TextDecoder()
  let tampon = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    dokun('byte')
    const parca = dec.decode(value, { stream: true })
    /* ILK BYTE'IN ICERIGI (21.10.2026).
     *
     * Dort kosuda ilk byte 15.193 / 15.215 / 15.299 / 15.303ms — varyans
     * 110ms, oysa govde %13,7 degisiyor (438-504 KB dosya + ~19 KB sistem
     * promptu + ~40 KB userText). Boyuttan bagimsiz sabit bir sayi gecikme
     * olcmez, PERIYOT olcer; en guclu aciklama Google'in SSE keepalive'i,
     * yani `:` ile baslayan bir yorum satiri.
     *
     * `durum.ham` bugune kadar YALNIZCA olay hic gelmediginde logluyordu
     * (asagidaki blok), yani basarili kosuda ilk byte'in ne oldugunu hic
     * gormedik. Bu satir onu kesinlestiriyor:
     *   `:` ile basliyorsa  -> dolgu, ilk byte kovalanacak bir sey degil,
     *                          butun caba ilkOlayMs'e kayar
     *   `data:` ile baslarsa -> icerik, o zaman gecikme gercek ve Files API
     *                          olcmeye deger hale gelir
     * dokun('byte') BU SATIRDAN ONCE cagriliyor, cunku ilkByteMs mumkun
     * olan en erken anda kurulmali; bu yuzden icerik `durum.ham`'dan degil
     * `parca`'dan okunuyor — ham henuz bos. */
    if (durum.ham.length === 0) {
      console.log(
        `Gemini ilk byte icerigi (${durum.ilkByteMs}ms, ${value?.byteLength ?? 0} bayt): ` +
        JSON.stringify(parca.slice(0, 120))
      )
    }
    durum.ham += parca
    tampon += parca
    let kes = tampon.indexOf('\n\n')
    while (kes !== -1) {
      const oncekiOlay = durum.olaySayisi
      geminiSseBlogunuIsle(tampon.slice(0, kes), durum)
      // Sayaci sifirlayan sey ISLENEN olay; bosluk ya da heartbeat degil.
      if (durum.olaySayisi > oncekiOlay) dokun('olay')
      tampon = tampon.slice(kes + 2)
      kes = tampon.indexOf('\n\n')
    }
  }
  if (tampon.trim()) geminiSseBlogunuIsle(tampon, durum)

  /* YUZEY AKISI YOK SAYDIYSA. Tek bir olay bile cikmadiysa gelen sey SSE
     degil, duz bir Interaction JSON'udur — 18.10.2026 kosusunda olan tam
     buydu. Bunu copa atmak, akis uygulanmadan ONCE calisan bir yolu
     kirmak olurdu; ayristirip normal yanit gibi kullaniyoruz. */
  if (durum.olaySayisi === 0 && durum.ham.trim()) {
    try {
      const d = JSON.parse(durum.ham)
      if (d && typeof d === 'object') {
        durum.duzYanit = d
        durum.tamamlandi = true
        durum.status = String(d.status || 'completed')
        durum.interactionId = String(d.id || durum.interactionId)
        console.warn(
          `Gemini: yuzey stream'i yok saydi (olay yok, ${durum.ham.length} karakter ` +
          `duz JSON geldi) — yanit akissiz yoldaki gibi okundu, status=${durum.status}`
        )
      }
    } catch (_e) {
      /* Ne SSE ne JSON. Govdenin basi loga girsin, bir daha teshis
         gerekmesin — sessiz bir basarisizlik en pahali olani. */
      console.warn(
        `Gemini: akisda olay yok ve govde JSON degil (${durum.ham.length} karakter): ` +
        durum.ham.slice(0, 200)
      )
    }
  }
}

/**
 * Akisli bir Gemini istegi: mutlak tavan + sessizlik sayaci. HTTP hatasinda
 * {status, body} doner; akis okunduysa null doner ve sonuc `durum`da olur.
 */
async function geminiAkisIstegi(
  url: string,
  init: RequestInit,
  durum: GeminiAkisDurum,
  mutlakMs: number,
  sessizlikMs: number,
  /* Ilk byte toleransi. Varsayilan sabit; parametre oldugu icin testler
     100 saniye beklemeden hangi sayacin kestigini olcebiliyor. */
  ilkByteMsIstenen: number = GEMINI_FIRST_BYTE_MS,
  /* Ilk OLAY son tarihi — ayni sebeple parametre. */
  ilkOlayMsIstenen: number = GEMINI_ILK_OLAY_MS,
  /* DIS IPTAL (24.10.2026). Model yarisinin altyapisi: kazanan belli olunca
     kaybedenlerin akisi disaridan kesilir, yoksa iptal edilmeyen istekler
     hem token hem baglanti tutmaya devam eder. Yaris henuz YAZILMADI —
     once her denemenin sonucunu isleyen blok (devam ettirme + kismi kurtarma
     + geminiProblem kapisi) ortak bir fonksiyona cikarilmali, yoksa yaris o
     mantigi kopyalamak zorunda kalir ve "ayni mantik iki yerde" hatasinin
     yenisi dogar. */
  disSinyal?: AbortSignal,
  /* AKAN AKISIN TAVANI (25.10.2026) — bkz. GEMINI_AKIS_SONRASI_PAYI_MS.
     Ilk OLAY geldiginde mutlak tavan bu degere (istegin basindan, ms)
     uzatilir. Verilmezse ya da mutlakMs'ten kucukse davranis aynen eski. */
  akisTavanMs?: number
): Promise<{ status: number; body: string } | null> {
  const controller = new AbortController()
  let sebep = ''
  let mutlak = setTimeout(() => { sebep = `mutlak tavan (${mutlakMs}ms)`; controller.abort() }, mutlakMs)
  let uzatildi = false
  /* Dis iptal: yarisi kaybeden akis buradan kesiliyor. Sebep YAZILIYOR,
     cunku sebebi bos birakmak asagidaki catch'te "zaman asimi" diye
     raporlanmasina yol aciyor ve log yanlis hikaye anlatirdi. */
  // Kesen taraf sebebini signal.reason ile verebilir (yedek yarisi, toplam tavan).
  const disIptal = () => {
    const r = (disSinyal as any)?.reason
    sebep = sebep || (typeof r === 'string' && r ? r : 'yaris kaybedildi')
    controller.abort()
  }
  if (disSinyal) {
    if (disSinyal.aborted) disIptal()
    else disSinyal.addEventListener('abort', disIptal, { once: true })
  }
  /* IKI AYRI BEKLEME. Ilk byte'a kadar GEMINI_FIRST_BYTE_MS (yok sayilan
     akista yanitin tamami 90+ saniyede geliyor), ondan sonra sessizlikMs.
     Tek sayac bu ikisini ayirt edemiyordu — bkz. GEMINI_FIRST_BYTE_MS. */
  const ilkByteMs = Math.min(mutlakMs, ilkByteMsIstenen)
  const ilkOlayMs = Math.min(mutlakMs, ilkOlayMsIstenen)
  /* Olcum saati her istek icin yeniden kuruluyor: devam ettirme de kendi
     ilk byte'ini olcsun. */
  durum.t0 = Date.now()
  durum.ilkByteMs = -1
  durum.ilkOlayMs = -1
  let veriGeldi = false
  let sessiz: number | undefined
  /* UC KADEME, ve ikincisi 20.10.2026'da eklendi.
     Eski hali sayaci her veri PARCASINDA sifirliyordu; yuzey bosluk ya da
     heartbeat gonderdikce 86 saniyelik gercek sessizlik gorunmez kaldi ve
     kart bos cikti. Artik byte yalnizca ILK BYTE kademesini kapatiyor;
     sessizlik sayacini OLAY sifirliyor. */
  const dokun = (tur: 'byte' | 'olay' | 'baslangic' = 'baslangic') => {
    const ilkByteMiydi = (tur === 'byte' || tur === 'olay') && durum.ilkByteMs < 0
    if (tur === 'byte' || tur === 'olay') {
      veriGeldi = true
      if (ilkByteMiydi) durum.ilkByteMs = Date.now() - durum.t0
    }
    /* SON TARIH BYTE'LARLA KAYMAZ (20.10.2026, ikinci tur).
       Ilk surum her byte'ta zamanlayiciyi yeniden kuruyordu; yuzey 15
       saniyede bir heartbeat gonderince 72 saniyelik ilk-olay son tarihi
       hic dolmuyordu. Canli olcum: ilk byte 15.245ms, ilk olay 90.163ms,
       son tarih tetiklenmedi ve kart yine kismi cikti.

       Artik ilk-olay son tarihi ILK BYTE'ta bir kez kuruluyor; sonraki
       byte'lar ona dokunmuyor. Sayaci yalnizca ISLENEN OLAY ileri tasir. */
    if (tur === 'byte' && !ilkByteMiydi) return
    if (tur === 'olay' && !uzatildi && akisTavanMs !== undefined && akisTavanMs > mutlakMs) {
      uzatildi = true
      clearTimeout(mutlak)
      const kalan = Math.max(0, akisTavanMs - (Date.now() - durum.t0))
      mutlak = setTimeout(() => {
        sebep = `mutlak tavan (${akisTavanMs}ms, akis uzatmasi)`
        controller.abort()
      }, kalan)
      console.log(
        `Gemini akis basladi (${Date.now() - durum.t0}ms) — mutlak tavan ${mutlakMs}ms -> ` +
        `${akisTavanMs}ms'ye uzatildi`
      )
    }
    if (sessiz !== undefined) clearTimeout(sessiz)
    const sure = durum.olaySayisi > 0
      ? sessizlikMs
      : (veriGeldi ? ilkOlayMs : ilkByteMs)
    sessiz = setTimeout(() => {
      sebep = durum.olaySayisi > 0
        ? `sessizlik (${sessizlikMs}ms olay gelmedi)`
        : (veriGeldi
          ? `ilk olay gelmedi (${ilkOlayMs}ms, baglanti acik ama veri yok)`
          : `ilk byte gelmedi (${ilkByteMs}ms)`)
      controller.abort()
    }, sure)
  }
  dokun()
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    /* BASLIK SURESI (TTFB) — ilk byte'tan AYRI olcum (21.10.2026).
       `ilkByteMs` tek basina "baglanti 15 saniye kuruldu" ile "basliklar
       hemen geldi ama govde 15 saniye sustu" durumlarini ayirt edemiyor.
       Ikisi cok farkli sey: ilki bizim odedigimiz bir maliyet (govde
       yuklemesi, kabul kuyrugu), ikincisi Google'in keepalive takvimi ve
       bize ait degil. Bu satir ayrimi yapiyor. */
    console.log(`Gemini baslik suresi: ${Date.now() - durum.t0}ms (HTTP ${res.status})`)
    if (!res.ok) {
      let text = ''
      try { text = (await res.text()).slice(0, 1200) } catch (_e) { /* govde okunamadi */ }
      return { status: res.status, body: text }
    }
    await geminiAkisiTuket(res, durum, dokun)
    return null
  } catch (err) {
    const iptal = (err as any)?.name === 'AbortError'
    /* sebep bos ise iptal BIZIM sayaclarimizdan gelmedi (cagiranin
       iptali ya da platform zaman asimi). Eski sozlesme bu durumu
       "zaman asimi (Xms)" diye raporluyordu; aynen korunuyor. */
    durum.hata = durum.hata ||
      (iptal ? (sebep || `zaman asimi (${mutlakMs}ms)`) : String((err as any)?.message || err))
    return null
  } finally {
    clearTimeout(mutlak)
    if (sessiz !== undefined) clearTimeout(sessiz)
  }
}

/** Olcum satiri: akis gercekten akti mi, yoksa sonda tek parca mi geldi. */
function geminiAkisOlcumu(durum: GeminiAkisDurum, toplamMs: number): string {
  const ms = (v: number) => (v < 0 ? 'yok' : `${v}ms`)
  const akisVar = durum.olaySayisi > 1 && durum.ilkOlayMs >= 0 && durum.ilkOlayMs < toplamMs * 0.8
  return (
    `ilk byte ${ms(durum.ilkByteMs)}, ilk olay ${ms(durum.ilkOlayMs)}, ` +
    `${durum.olaySayisi} olay, ${durum.metin.length} karakter, toplam ${toplamMs}ms — ` +
    (durum.duzYanit
      ? 'AKIS YOK (duz JSON)'
      : akisVar
        ? 'AKIS GERCEK (olaylar sureye yayildi)'
        : 'AKIS SOZDE (olaylar sonda toplu geldi)')
  )
}

/** Akistan tam bir Interaction kaynagi gibi gorunen nesne uretir. */
function geminiAkisSonucu(durum: GeminiAkisDurum): any {
  return {
    id: durum.interactionId || '',
    object: 'interaction',
    /* Durum once olaydan gelir. `tamamlandi` yalnizca VARSAYILANI secer:
       completed olayi incomplete/failed/cancelled tasiyabiliyor ve onu
       'completed' diye yazmak yarim JSON'u tam saymak olurdu. */
    status: durum.status || (durum.tamamlandi ? 'completed' : 'in_progress'),
    steps: [{ type: 'model_output', content: [{ type: 'text', text: durum.metin }] }],
    usage: durum.usage ?? null
  }
}

/**
 * Kopan akisi kaldigi yerden devam ettirir:
 *   GET /v1beta/interactions/{id}?stream=true&last_event_id=<event_id>
 * Dokumanda last_event_id "akisi bu olaydan SONRAKI parcadan surdurur"
 * diyor, yani yeni bir uretim degil ayni etkilesimin okunmasi.
 */
async function geminiAkisiDevamEttir(
  apiKey: string,
  durum: GeminiAkisDurum,
  mutlakMs: number
): Promise<{ status: number; body: string } | null> {
  const q = new URLSearchParams({ stream: 'true' })
  if (durum.lastEventId) q.set('last_event_id', durum.lastEventId)
  durum.hata = null
  const oncekiUzunluk = durum.metin.length
  const oncekiOlay = durum.olaySayisi
  const http = await geminiAkisIstegi(
    `${GEMINI_ENDPOINT}/${encodeURIComponent(durum.interactionId)}?${q.toString()}`,
    { method: 'GET', headers: { 'x-goog-api-key': apiKey } },
    durum,
    mutlakMs,
    GEMINI_SILENCE_MS
  )

  /* HTTP HATASI YUTULUYORDU (21.10.2026).
   *
   * geminiAkisIstegi ok OLMAYAN cevapta {status, body} DONDURUYOR, durum.hata'ya
   * hicbir sey yazmiyor. Bu fonksiyon donen degeri atiyordu ve ustunde
   * durum.hata'yi null'a cekiyordu — yani GET ne dondurursa dondursun geriye
   * hicbir iz kalmiyordu. 21.10 kosusunun logu tam bunu gosteriyor:
   *
   *   akis kesildi (mutlak tavan (95445ms)) — GET ile devam ettiriliyor (1/2)
   *   akis kesildi (null) — GET ile devam ettiriliyor (2/2)
   *   akis tamamlanmadi (null) — KISMI JSON kurtarildi
   *
   * Ikinci satirdaki `null` sebebin yoklugu degil, SILINMIS sebep. Iki GET
   * 679ms ve 596ms surdu, tek karakter getirmedi ve neden basarisiz
   * olduklarini soylemedi. Artik sebep yaziliyor; bos donen bir devam
   * ettirme de sessiz gecmiyor. */
  if (http) {
    durum.hata = `devam ettirme HTTP ${http.status}: ${String(http.body || '').slice(0, 300)}`
  } else if (durum.metin.length === oncekiUzunluk && !durum.tamamlandi) {
    durum.hata = durum.hata ||
      `devam ettirme bos dondu (last_event_id ${durum.lastEventId ? 'gonderildi' : 'YOK'}, ` +
      `etkilesim durumu ${durum.status || 'bildirilmedi'})`
  }
  console.log(
    `Gemini devam ettirme: +${durum.metin.length - oncekiUzunluk} karakter, ` +
    `+${durum.olaySayisi - oncekiOlay} olay, tamamlandi=${durum.tamamlandi}` +
    (durum.hata ? ` — ${durum.hata}` : '')
  )
  return http
}

/**
 * Yarim kalmis JSON'u kapatmayi dener; kurtarilamazsa null.
 *
 * Akis kesildiginde elde kalan metin neredeyse her zaman gecerli JSON'un bir
 * ONEKI: aciklar kapanmamis, son eleman yarim. Strateji: once oldugu gibi,
 * sonra son virgullerden geri cekilerek dene; acik parantezleri kapat ve
 * JSON.parse ile DOGRULA. Dogrulanmayan bir sey asla dondurulmez — bu
 * fonksiyonun ciktisi dogrudan karta gidiyor.
 */
/**
 * Kurtarilan taslak bir KART olmaya yetiyor mu?
 *
 * 20.10.2026: 2.074 karakterlik bir kurtarma karakter esigini gecti ve
 * kart uretildi — icinde 2 terim, 0 nokta, 0 soru vardi, kapsama %0.
 * Karakter sayisi icerik olcusu degil; bir JSON'da 2.000 karakter
 * yalnizca summary alaninda da birikebilir.
 *
 * Esik mutevazi: ogrenciye verilebilecek en az sey. Altinda kalan taslak
 * yok sayilir ve normal yedek yolu (Groq) isler.
 */
function geminiKurtarmaYeterli(json: string): { yeterli: boolean; ozet: string } {
  try {
    const p = JSON.parse(repairLatexEscapes(json))
    const terim = Array.isArray(p?.key_terms) ? p.key_terms.length : 0
    const nokta = Array.isArray(p?.key_points) ? p.key_points.length : 0
    const soru = Array.isArray(p?.quiz_questions) ? p.quiz_questions.length : 0
    const ozetVar = String(p?.summary || '').trim().length >= 200
    const yeterli = ozetVar && (nokta >= 3 || terim >= 6)
    return { yeterli, ozet: `${terim} terim, ${nokta} nokta, ${soru} soru, ozet ${ozetVar ? 'var' : 'yok'}` }
  } catch (_e) {
    return { yeterli: false, ozet: 'ayristirilamadi' }
  }
}

function closeTruncatedJson(text: string): string | null {
  const temiz = String(text || '').replace(/```json\s*|```/g, '').trim()
  const bas = temiz.search(/[{[]/)
  if (bas === -1) return null
  const s = temiz.slice(bas)

  // Dize icinde olmayan virgullerin konumlari + acik yapi yigini.
  const tara = (parca: string) => {
    const stack: string[] = []
    const virguller: number[] = []
    let inStr = false, esc = false
    for (let i = 0; i < parca.length; i++) {
      const c = parca[i]
      if (inStr) {
        if (esc) { esc = false; continue }
        if (c === '\\') { esc = true; continue }
        if (c === '"') inStr = false
        continue
      }
      if (c === '"') { inStr = true; continue }
      if (c === '{') stack.push('}')
      else if (c === '[') stack.push(']')
      else if (c === '}' || c === ']') stack.pop()
      else if (c === ',') virguller.push(i)
    }
    return { stack, virguller, inStr }
  }

  const dene = (parca: string): string | null => {
    const { stack, inStr } = tara(parca)
    /* Dize ORTASINDA bitmis bir parca kapatilamaz: tirnagi kendimiz
       kapatsak uydurma bir deger uretiriz. Cagiran taraf bir virgul
       geri cekilip tekrar deniyor. Yigin BOS olmasi ise hata degil —
       tam JSON de buradan geciyor. */
    if (inStr) return null
    let kesik = parca.replace(/[\s,]+$/, '')
    /* Degeri gelmemis anahtar: `"key":` kuyrugu. Iki nokta ust uste
       ZORUNLU, cunku onsuz bu desen tamamlanmis bir DIZI ELEMANINI de
       siliyordu (`["bir","iki"` -> `["bir"`). */
    kesik = kesik.replace(/,?\s*"(?:[^"\\]|\\.)*"\s*:\s*$/, '')
    kesik = kesik.replace(/[\s,]+$/, '')
    if (!kesik) return null
    const aday = kesik + stack.slice().reverse().join('')
    try {
      const p = JSON.parse(repairLatexEscapes(aday))
      if (!p || typeof p !== 'object') return null
      /* BOS kurtarma kurtarma degildir: '{' girdisi '{}' olarak
         ayristirilabiliyor ama kart uretmez, ustelik asagidaki JSON.parse
         kapisini gecip ic bos bir karta donusur. */
      if (Array.isArray(p) ? p.length === 0 : Object.keys(p).length === 0) return null
      return aday
    } catch (_e) { /* bir sonraki kesim denenecek */ }
    return null
  }

  const tamam = dene(s)
  if (tamam) return tamam

  const { virguller } = tara(s)
  let denenen = 0
  for (let i = virguller.length - 1; i >= 0 && denenen < 80; i--, denenen++) {
    const aday = dene(s.slice(0, virguller[i]))
    if (aday) return aday
  }
  return null
}


/* `durum` IKI kolda da tanimli (yalnizca hata kolunda doluyor): boyle
   olmazsa `res.durum` okumasi birlesimi daraltmayi bozuyor ve asagidaki
   `res.status` erisimleri derlenmiyor. */
type GeminiCagriSonucu =
  | { ok: true; data: any; durum?: GeminiAkisDurum }
  | { ok: false; status: number; body: string; durum?: GeminiAkisDurum }

type GeminiTaslak = { raw: string; model: string; ms: number; usage: any; kismi?: boolean }

/* Bir denemenin sonucu — bkz. denemeSonucunuIsle.
 *
 * Akis kontrolu DEGER olarak tasiniyor: `continue`/`break` yalnizca bir
 * dongunun icinde anlamlidir, isleme mantigi ise iki ayri cagirandan
 * (sirali dongu ve model yarisi) kullaniliyor. Cagiran ne yapacagina
 * kendisi karar veriyor.
 *   taslak  : kullanilabilir bir kart cikti
 *   birak   : Gemini yolu burada biter (cik() ile bayrak konur)
 *   tekrar  : AYNI modeli bir daha dene (alan dusurme, dakikalik limit)
 *   sonraki : bu modelle isimiz bitti, SONRAKI adaya gec
 *   sonra   : SONRAKI adaya gec, bu modeli SIRANIN SONUNDA bir kez daha
 *             dene (503 — bkz. denemeSonucunuIsle) */
type GeminiDenemeSonucu =
  | { tur: 'taslak'; taslak: GeminiTaslak }
  | { tur: 'birak' }
  | { tur: 'tekrar' }
  | { tur: 'sonraki' }
  | { tur: 'sonra' }

/**
 * Tek Gemini cagrisi: belgenin tamami inline, JSON modu, AKIS (SSE) ve
 * sessizlik sayaci. Akis blogundaki nota bakin.
 *
 * fetchWithRetry KULLANILMIYOR: o fonksiyon Groq'un 429 govdesini ve gunluk
 * kota mesajini ayristiriyor (parseGroqRetryAfterMs, isDailyQuotaError) ve
 * burada yanlis sonuc verir. Bu yuzden kendi, daha dar denemesi var.
 */
async function callGeminiOnce(
  apiKey: string,
  model: string,
  systemInstruction: string,
  fileBase64: string,
  fileMime: string,
  userText: string,
  timeoutMs: number,
  drop: string[] = [],
  /* MODEL YARISI ICIN IKI EK (24.10.2026).
   *
   * `durumDisi`: akis durumunu CAGIRAN kuruyor. Yarisin kazananini secmek
   * icin `durum.olaySayisi`'ni ucus sirasinda okumak gerekiyor; durum bu
   * fonksiyonun icinde kalirsa disaridan gorulemez.
   * `disSinyal`: kaybedenleri kesmek icin.
   * Ikisi de opsiyonel — tek cagri yolu hic degismiyor. */
  durumDisi?: GeminiAkisDurum,
  disSinyal?: AbortSignal,
  // Akan akisin uzatilmis tavani — bkz. geminiAkisIstegi / GEMINI_AKIS_SONRASI_PAYI_MS.
  akisTavanMs?: number
): Promise<GeminiCagriSonucu> {
  const dusuruldu = (ad: string) => drop.indexOf(ad) !== -1

  const body: Record<string, unknown> = {
    model,
    system_instruction: systemInstruction,
    input: [
      { type: 'document', data: fileBase64, mime_type: fileMime },
      { type: 'text', text: userText }
    ]
  }
  // Groq'ta 3.702 token'da tavan yapan sey buydu; burada acikca yukseltiliyor.
  if (!dusuruldu('generation_config')) {
    body.generation_config = { max_output_tokens: GEMINI_MAX_OUTPUT_TOKENS }
  }
  // Prompt zaten "SADECE gecerli JSON" diyor; bu alan onu garantiye aliyor.
  if (!dusuruldu('response_format')) {
    body.response_format = { type: 'text', mime_type: 'application/json' }
  }
  // thinking_level / thinking_summaries BILEREK GONDERILMIYOR: dokumanda
  // listeleniyorlar ama 09.10.2026'daki ilk canli kosuda uc modelin ucu de
  // "Unknown parameter 'thinking_level'" ile 400 dondu. Gondermeye devam
  // etmek her belgede bir istegi bosa harcardi — gunluk kota 100 istek.
  // Yine de geminiUnknownParameter onlari da dusurebiliyor, cunku bir gun
  // kabul edilmeye baslarlarsa buraya geri eklemek tek satir.

  /* AKIS. `stream` dusurulebilir: yuzey reddederse ayni dongu alani atip
     tekrar deniyor ve asagidaki AKISSIZ yola giriyoruz. `store` ise GET ile
     devam ettirmenin onkosulu (bkz. geminiAkisiDevamEttir). */
  const akisli = !dusuruldu('stream')
  if (akisli) body.stream = true
  if (!dusuruldu('store')) body.store = true

  const init: RequestInit = {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }

  if (akisli) {
    // Cagiran bir durum verdiyse ONU kullan — yaris onu ucus sirasinda okuyor.
    const durum = durumDisi ?? geminiAkisDurumu()
    const akisBasladi = Date.now()
    const hata = await geminiAkisIstegi(
      GEMINI_ENDPOINT, init, durum, timeoutMs, GEMINI_SILENCE_MS,
      GEMINI_FIRST_BYTE_MS, GEMINI_ILK_OLAY_MS, disSinyal, akisTavanMs
    )
    if (hata) return { ok: false, status: hata.status, body: hata.body }
    console.log(`Gemini akis [${model}]: ${geminiAkisOlcumu(durum, Date.now() - akisBasladi)}`)
    /* Yuzey akisi yok saydiysa elimizde GERCEK yanit nesnesi var; sentez
       etmeye gerek yok ve etmemek daha dogru (usage, steps, errors alanlari
       oldugu gibi kaliyor). */
    if (durum.duzYanit) return { ok: true, data: durum.duzYanit }
    if (durum.tamamlandi) return { ok: true, data: geminiAkisSonucu(durum) }
    /* Akis tamamlanmadan bitti. Elde kismi metin VAR — cagiran taraf once
       devam ettirmeyi, sonra kurtarmayi deneyecek (bkz. geminiDraft). */
    return {
      ok: false,
      status: 0,
      body: durum.hata || 'akis tamamlanmadan bitti',
      durum
    }
  }

  /* AKISSIZ YOL — yalnizca yuzey `stream` alanini reddettiginde. Eski
     davranis birebir korunuyor: tek atislik zaman asimi, tam JSON. */
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(GEMINI_ENDPOINT, { ...init, signal: controller.signal })
    if (!res.ok) {
      let text = ''
      try { text = (await res.text()).slice(0, 1200) } catch (_e) { /* govde okunamadi */ }
      return { ok: false, status: res.status, body: text }
    }
    return { ok: true, data: await res.json() }
  } catch (err) {
    const msg = String((err as any)?.name === 'AbortError'
      ? `zaman asimi (${timeoutMs}ms)`
      : ((err as any)?.message || err))
    return { ok: false, status: 0, body: msg }
  } finally {
    clearTimeout(timer)
  }
}


/**
 * Gölge yolun tamami. Basarisizlikta HER ZAMAN null doner — cagiran taraf
 * null gorunce Groq yoluna duser, yani bu fonksiyon hicbir durumda bir
 * belgenin islenmesini engellemez.
 */
async function geminiDraft(
  apiKey: string,
  systemInstruction: string,
  fileBytes: Uint8Array,
  fileMime: string,
  userText: string,
  budgetMs: number,
  mode: 'only' | 'shadow' = 'only',
  /* Cagiran icin TANI. Su an tek alani var: Gemini GECICI hatalar (503/500)
     yuzunden hic taslak uretemediyse true. Cikan kart yedek yoldan geliyor
     ve KALICI cevap sayilmamali — bkz. summary_cache yazimi. */
  tani?: { geciciDustu?: boolean; hepsiDustu?: boolean; kota429?: boolean }
): Promise<{ raw: string; model: string; ms: number; usage: any; kismi?: boolean } | null> {
  /* Cagrinin zaman asimi:
     - her iki modda: GEMINI_RESERVE_MS, cagri BASARILI olursa kapilar+kayit
     - YALNIZCA shadow modunda: GEMINI_GROQ_RESERVE_MS, cagri ZAMAN ASIMINA
       ugrarsa Groq'un tam kosusu. only modunda Groq cagrilmayacagi icin
       boyle bir pay yok ve butun butce Gemini'nin. */
  const basariPayi = budgetMs - GEMINI_RESERVE_MS
  const tavan = mode === 'only' ? GEMINI_ONLY_MAX_CALL_MS : GEMINI_MAX_CALL_MS
  const paylar = [tavan, Math.max(0, basariPayi)]
  if (mode === 'shadow') paylar.push(Math.max(0, budgetMs - GEMINI_GROQ_RESERVE_MS))
  const callMs = Math.min(...paylar)
  if (callMs < 35_000) {
    // 35 saniyenin altinda 42 sayfalik bir PDF'in donme ihtimali yok.
    console.log(`Gemini: atlandi (cagri icin ${callMs}ms kaliyor, en az 35.000ms gerekli)`)
    /* cik() DEGIL: buraya henuz hic istek atilmadan geliniyor, yani
       geciciModeller zorunlu olarak bos ve cik() ile ayni sey. Ustelik cik
       asagida tanimli — burada cagirmak TDZ hatasi verir. */
    return null
  }
  console.log(
    `Gemini: mod=${mode}, cagri zaman asimi ${callMs}ms (butce ${budgetMs}ms` +
    (mode === 'shadow' ? `, Groq'a ${GEMINI_GROQ_RESERVE_MS}ms saklandi)` : `, Groq devre disi)`)
  )

  let fileBase64 = ''
  try {
    fileBase64 = bytesToBase64(fileBytes)
  } catch (encErr) {
    console.warn('Gemini: base64 kodlama basarisiz, Groq yoluna dusuluyor:', encErr)
    // cik() DEGIL — istek oncesi yol, bkz. yukaridaki not.
    return null
  }

  /* Yuzeyin kabul etmedigi istege-ozel alanlar. Modeller arasinda TASINIR:
     bir alan bir modelde reddedildiyse digerlerinde de reddedilecektir ve
     ayni hatayi uc kez yemek gunluk kotadan uc istek goturur. */
  const dropped: string[] = []
  let gecici = 0   // dakikalik 429 beklemesi — model degisince sifirlanir; 503'ler model503'te
  /* MODELLER ARASI ardisik gecici hata. `gecici` her modelde sifirlaniyor;
     bu sayac sifirlanmiyor ve yuzeyin tamaminin yogun oldugunu gormemizi
     sagliyor (bkz. GEMINI_ARDISIK_GECICI_MAX). */
  let ardisikGecici = 0
  /* GECICI HATA VEREN MODELLER (21.10.2026).
   *
   * `ardisikGecici` denemeleri sayiyordu, modelleri degil. Bir modele iki
   * kez deneyip iki 503 almak sayaci doldurmaya yetiyordu ve "yuzey yogun"
   * denip kalan uc aday model hic denenmiyordu. Oysa 503'un govdesi modeli
   * ADIYLA soyluyor:
   *
   *   "gemini-3.7-flash is currently experiencing high demand"
   *
   * Tek modelin yogun olmasi yuzeyin tamaminin yogun oldugunu gostermez.
   * 21.10 kosusu: iki 503 ikisi de gemini-3.7-flash'tan geldi, Gemini
   * tamamen birakildi ve geriye 130 SANIYE butce kalmisti — bir sonraki
   * adayi denemek gunluk kotadan tek istek goturecekti. Kart Groq yolundan
   * cikti, sayisal kapsama %77'den %56'ya dustu.
   *
   * Artik "yuzey yogun" sonucu AYRI modellerden gecici hata gelmesini
   * istiyor. Istek sayisini GEMINI_MAX_REQUESTS_PER_RUN, bosa giden sureyi
   * GEMINI_FAIL_BUDGET_MS zaten baglıyor. */
  const geciciModeller = new Set<string>()
  /* BU KOSUDA KOTA 429'U GORULDU MU.
     Limit PROJENIN, modelin degil (bkz. asagidaki 429 dali) — yani tek bir
     429 butun adaylar hakkinda bilgi. Iki yerde kullaniliyor: yedek model
     baslatmayi durduruyor (yedekliDene) ve cagirana devre kesiciyi actiriyor
     (tani.kota429). */
  let kota429Gorulen = false
  /* Model basina 503/500 sayisi — bkz. denemeSonucunuIsle'deki "ONCE
     DIGER MODELLER" notu. */
  const model503 = new Map<string, number>()

  /* TEK CIKIS: GECICI-HATA BAYRAGI HER DONUS YOLUNDA KONUR (24.10.2026).
   *
   * Bayrak iki yerde set ediliyordu: "yuzey yogun" esigi ve dongunun
   * tukenmesi. Ama bu fonksiyonun ON BIR ayri `return null` yolu var — fail
   * butcesi, buCagriMs < esik, istek tavani, `incomplete`, terminal olmayan
   * durum, kurtarma yetmedi... Bunlarin hicbiri bayragi koymuyordu.
   *
   * Senaryo (olculmus parcalardan kurulu): model-1 503 verir
   * (geciciModeller = {gemini-3.7-flash}), model-2'nin akisi 105 sn'de
   * kesilir, kurtarma "kart olmaya yetmiyor" der ve o daldan `return null`
   * olur. Bayrak false kaldigi icin %56 kapsamali Groq karti
   * `summary_cache`'e KALICI yazilir ve o dosya icin Gemini bir daha hic
   * denenmez — 21.10'da bu koruma tam bunun icin eklenmisti ve yalnizca tek
   * dalda calisiyordu.
   *
   * Kural tek yerde: gecici hata GORULDUYSE cikan kart yedek yoldan geliyor
   * ve kalici cevap sayilmamali. */
  const cik = (): null => {
    if (tani && geciciModeller.size > 0) tani.geciciDustu = true
    /* Kota 429'u TEK BASINA devre kesici sebebi: hepsiDustu'yu beklemek
       anlamsiz, cunku oteki adaylari denemek ayni projenin ayni limitine
       carpmak demek. Olculen kosuda tetik tam burada kayboluyordu. */
    if (tani && kota429Gorulen) tani.kota429 = true
    /* BUTUN adaylar kota/gecici hata verdi mi — devre kesicinin TEK tetigi
       (bkz. GEMINI_DEVRE_MS). Denenemeyen aday varsa false kalir. */
    if (tani && geminiModelCandidates().every((m) => geciciModeller.has(m))) tani.hepsiDustu = true
    return null
  }

  /* BASARISIZ DENEMELERIN TOPLAM SURESI.
   *
   * 09.10.2026 ucuncu kosu: Gemini hic taslak uretemedi (503, 503, 429, 404)
   * ama denemeler 34 saniye yedi. Groq'a geriye 76 saniye kaldi ve o yuzden
   * HEM gorsel gecisi HEM review atlandi — yani gölge yol calismadigi halde
   * kartin kalitesini dusurdu. Kabul edilemez: bu yolun tek sozu "ne olursa
   * olsun Groq yolunu bozmam".
   *
   * Basarili bir cagri bu sinirdan etkilenmez (kontrol denemeden ONCE
   * yapiliyor ve basaridan sonra butce zaten genisliyor).
   *
   * only modunda bu sinir cok daha genis: korudugu sey Groq'un kosusuydu,
   * o modda Groq zaten cagrilmiyor. Orada tek kisit isteginn kendi butcesi,
   * yani tekrar denemeye yer kaldigi surece deniyoruz. */
  const basladi = Date.now()
  let toplamIstek = 0
  const GEMINI_FAIL_BUDGET_MS = mode === 'only'
    ? Math.max(0, budgetMs - GEMINI_RESERVE_MS - 20_000)
    : 25_000

  /* GEMINI'NIN TOPLAM DUVAR SAATI TAVANI (10.10.2026 17:40 dersi).
   *
   * callMs dongu BASLAMADAN once bir kez hesaplaniyordu, yani her deneme
   * ayri ayri tam tavani aliyordu. 17:40 kosusunda olan tam buydu:
   *   deneme 1 -> 503, 3,5 saniyede dondu
   *   deneme 2 -> 105 saniyede zaman asimi
   *   toplam 111 saniye, geriye 33,9 saniye kaldi
   * Yani HIZLI bir hatayi YAVAS bir hata izledi ve Groq'a donus esigini
   * (o zaman 100 sn) altindan gecirdi. Fallback mantigi dogru calisti,
   * ama korudugu butce zaten yanmisti.
   *
   * Artik her denemenin zaman asimi, toplam tavandan GERIYE KALANA gore
   * yeniden hesaplaniyor: ilk deneme 3,5 saniye yerse ikincisine 101,5
   * saniye kalir, toplam yine tavani asmaz. Boylece Gemini ne yaparsa
   * yapsin Groq'a sabit bir pay kaliyor ve fallback esigi guvenilir
   * oluyor. */
  const geminiToplamTavan = tavan
  /* Devam ettirmenin tavani URETIM tavanindan ayri — bkz.
     GEMINI_DEVAM_PAYI_MS. Pencere butcede gercekten yer varsa aciliyor,
     yoksa uretim tavaninda kaliyor ve davranis eskisi gibi. */
  const geminiDevamTavan = Math.min(
    geminiToplamTavan + GEMINI_DEVAM_PAYI_MS,
    Math.max(geminiToplamTavan, budgetMs - GEMINI_DEVAM_KAYIT_PAYI_MS)
  )

  /* RPM 5 (panelden okundu). Istekleri arka arkaya atmak dakikalik limite
     carpiyor ve o 429 "project has exceeded a quota" diye geliyor — gunluk
     kota sanip bos yere paniklediğimiz hata buydu. Ilk istek beklemez;
     sonrakilerin arasina kucuk bir pay konur. */
  const GEMINI_RETRY_WAIT_MS = geminiRetryWaitMs()
  let ilkIstek = true

  /* HER DENEMENIN SONUCUNU ISLEYEN TEK YER (24.10.2026).
   *
   * Bu blok eskiden deneme dongusunun govdesinde duruyordu. Model yarisi
   * da ayni isi yapmak zorunda — devam ettirme, kismi kurtarma,
   * geminiProblem kapisi, 429/503 ayrimi. Kopyalamak bu dosyada butun gun
   * avladigimiz hata sinifinin yenisini dogururdu: ayni mantik iki yerde
   * yazilir, biri duzeltilir, oteki eskir (bkz. sourceNumbers/sayiOkumalari,
   * sentez completion'i, kapi/genisletme butcesi).
   *
   * Akis kontrolu DEGER olarak donuyor, cunku `continue`/`break` yalnizca
   * dongunun icinde anlamli: cagiran ne yapacagina kendisi karar veriyor.
   * Ic devam-ettirme dongusunun kendi break'leri AYNEN korundu. */
  const denemeSonucunuIsle = async (
    model: string,
    res: GeminiCagriSonucu,
    startedAt: number,
    buCagriMs: number
  ): Promise<GeminiDenemeSonucu> => {
    const ms = Date.now() - startedAt

    /* AKIS YARIM KALDI (18.10.2026).
     *
     * Burasi eskiden yoktu, cunku yarim bir cikti diye bir sey yoktu: cagri
     * ya tam JSON dondururdu ya 105 saniye sonra hicbir sey. Akisla birlikte
     * ucuncu bir hal var — elde o ana kadar gelen metin.
     *
     * SIRA ONEMLI. Once DEVAM ETTIRMEYI deniyoruz (GET ile ayni etkilesime
     * geri baglanmak, yeni bir uretim istegi degil), cunku tam bir kart yarim
     * bir karttan her zaman iyidir ve gunluk kotadan (RPD 20) istek
     * goturmuyor. Ancak o da olmazsa kurtarmaya iniyoruz.
     *
     * KURTARMA DOGRULANIR: closeTruncatedJson ayristiramadigi hicbir seyi
     * dondurmuyor, yani buradan cikan taslak asagidaki JSON.parse kapisini
     * zaten gecer. 17.10'da olculup kullanilmayan kismi metin artik
     * ogrencinin karti oluyor. */
    if (!res.ok && res.durum) {
      const durum = res.durum
      for (let devam = 0; devam < GEMINI_MAX_RESUMES && !durum.tamamlandi && durum.interactionId; devam++) {
        if (geminiDevamDesteklemeyen.has(model)) {
          console.warn(
            `Gemini ${model}: GET ile devam ettirme bu modelde desteklenmiyor — ` +
            `denenmiyor, dogrudan kurtarmaya iniliyor`
          )
          break
        }
        const kalanMs = geminiDevamTavan - (Date.now() - basladi)
        if (kalanMs < 10_000) {
          console.warn(`Gemini ${model}: devam ettirmeye yer kalmadi (${kalanMs}ms)`)
          break
        }
        console.warn(
          `Gemini ${model}: akis kesildi (${durum.hata}), ${durum.metin.length} karakter elde — ` +
          `GET ile devam ettiriliyor (${devam + 1}/${GEMINI_MAX_RESUMES}, ${kalanMs}ms kaldi)`
        )
        const devamHata = await geminiAkisiDevamEttir(apiKey, durum, Math.min(kalanMs, buCagriMs))
        /* 4xx kendi kendine duzelmez: etkilesim yok, bitmis ya da
           last_event_id kabul edilmiyor. Ikinci GET'i yakmanin anlami
           yok. 5xx gecici olabilir, ona pencere kalmissa devam. */
        if (devamHata && devamHata.status >= 400 && devamHata.status < 500) {
          /* "not supported for this model" kalici bir YETENEK eksigi, gecici
             bir hata degil: bu ornek yasadikca bir daha denenmemeli. */
          if (/not supported/i.test(String(devamHata.body || ''))) {
            geminiDevamDesteklemeyen.add(model)
            console.warn(
              `Gemini ${model}: yuzey GET ile devam ettirmeyi desteklemiyor — ` +
              `bu model icin kalici olarak kapatildi`
            )
          }
          console.warn(
            `Gemini ${model}: devam ettirme kalici hatayla dustu (HTTP ${devamHata.status}) — ` +
            `yeniden denenmiyor`
          )
          break
        }
      }
      if (durum.tamamlandi && durum.metin.trim()) {
        console.log(
          `Gemini ${model}: akis DEVAM ETTIRILEREK tamamlandi, ` +
          `${durum.metin.length} karakter, ${Date.now() - startedAt}ms`
        )
        return { tur: 'taslak', taslak: { raw: durum.metin, model, ms: Date.now() - startedAt, usage: durum.usage } }
      }
      if (durum.metin.length >= GEMINI_PARTIAL_MIN_CHARS) {
        const kurtarilan = closeTruncatedJson(durum.metin)
        /* Karakter esigi yetmiyor: ICERIGE de bakiliyor (20.10.2026,
           bkz. geminiKurtarmaYeterli). Bos bir kart, Groq'a dusmekten
           kotudur. */
        const yeterlilik = kurtarilan ? geminiKurtarmaYeterli(kurtarilan) : { yeterli: false, ozet: 'kurtarilamadi' }
        if (kurtarilan && !yeterlilik.yeterli) {
          console.warn(
            `Gemini ${model}: kismi JSON kurtarildi ama KART OLMAYA YETMIYOR ` +
            `(${yeterlilik.ozet}) — taslak yok sayiliyor, Groq yoluna dusuluyor`
          )
          return { tur: 'birak' }
        }
        if (kurtarilan) {
          console.warn(
            `Gemini ${model}: akis tamamlanmadi (${durum.hata}) — KISMI JSON kurtarildi, ` +
            `${durum.metin.length} karakterden ${kurtarilan.length} karakter, ${Date.now() - startedAt}ms`
          )
          return { tur: 'taslak', taslak: { raw: kurtarilan, model, ms: Date.now() - startedAt, usage: durum.usage, kismi: true } }
        }
        console.warn(
          `Gemini ${model}: kismi cikti KURTARILAMADI (${durum.metin.length} karakter, ` +
          `${durum.olaySayisi} olay) — ${durum.hata}`
        )
      } else {
        console.warn(
          `Gemini ${model}: akis ${durum.metin.length} karakterde kesildi ` +
          `(esik ${GEMINI_PARTIAL_MIN_CHARS}) — kurtarma denenmiyor: ${durum.hata}`
        )
      }
      /* TERMINAL OLMAYAN DURUM, AKIS SURUMU. Akissiz yolda bu karari
         geminiProblem veriyor: in_progress/queued/requires_action ise
         sorun modelde DEGIL, yanit henuz hazir degil — sonraki aday
         modeli denemek gunluk kotadan (RPD 20) bos yere istek goturur.
         Akista ayni bilgi status_update olayindan geliyor, yani ayni
         karar burada veriliyor. Devam ettirme ZATEN denendi (yukarida);
         o da tutmadiysa yapacak sey Groq yoluna dusmek. */
      if (durum.status === 'in_progress' || durum.status === 'queued' || durum.status === 'requires_action') {
        console.warn(
          `Gemini ${model}: akis status=${durum.status} ile bitti (terminal degil) — ` +
          `baska aday model denenmiyor`
        )
        return { tur: 'birak' }
      }
    }

    if (res.ok) {
      // Yuzey cevap veriyor: ardisiklik bozuldu.
      ardisikGecici = 0
      const problem = geminiProblem(res.data)
      if (problem) {
        console.warn(`Gemini ${model}: cevap kullanilamaz — ${problem}`)
        /* Cikti tavani: SONRAKI ADAYI DENEME. Ayni prompt, ayni tavan,
           ayni sonuc — tek kazanci gunluk 20 istekten birini daha
           yakmak, ustelik her deneme ~88 saniye suruyor. Kosuyu burada
           bitirmek, uc kez ayni duvara carpmaktan iyidir. */
        if (/incomplete/.test(problem)) {
          /* 17.10.2026: once OLC, sonra kurtarmaya karar ver. Kesilen
             govdede ne kadar metin oldugunu bilmiyoruz; "neredeyse tam
             JSON" varsayimi bu repoda daha once olcumsuz yapilip geri
             alinmisti. Log once gelsin. */
          const kismi = extractGeminiText(res.data)
          console.warn(
            `Gemini ${model}: yarim cikti — kurtarilabilir metin ` +
            `${kismi.length} karakter (esik yok, simdilik sadece olculuyor)`
          )
          return { tur: 'birak' }
        }
        /* Terminal olmayan durum (in_progress/queued/requires_action):
           baska aday model denemek anlamsiz, cunku sorun modelde degil —
           yanit henuz hazir degil. Sonraki adayi denemek gunluk kotadan
           bos yere bir istek goturur. */
        if (/terminal degil/.test(problem)) return { tur: 'birak' }
        return { tur: 'sonraki' }   // ayni modeli tekrar denemek ayni sonucu verir   // ayni modeli tekrar denemek ayni sonucu verir
      }
      const text = extractGeminiText(res.data)
      if (!text.trim()) {
        console.warn(`Gemini ${model}: cevapta metin yok (${JSON.stringify(res.data).slice(0, 300)})`)
        return { tur: 'sonraki' }
      }
      console.log(
        `Gemini ${model}: taslak geldi, ${ms}ms, ${text.length} karakter` +
        (dropped.length ? `, dusurulen alanlar: ${dropped.join(', ')}` : '')
      )
      return { tur: 'taslak', taslak: { raw: text, model, ms, usage: res.data?.usage ?? null } }
    }

    // Taninmayan bir alan: at ve AYNI modeli tekrar dene. Bu kontrol
    // digerlerinden once geliyor, cunku "Unknown parameter 'X'" asagidaki
    // model-yok desenine benzeyebilir ve yanlis teshis butun adaylari
    // bosa harcar (09.10.2026'da tam olarak bu oldu).
    const bilinmeyen = geminiUnknownParameter(res.status, res.body)
    if (bilinmeyen && dropped.indexOf(bilinmeyen) === -1) {
      dropped.push(bilinmeyen)
      console.warn(`Gemini ${model}: '${bilinmeyen}' alani taninmadi — atilip tekrar denenecek`)
      return { tur: 'tekrar' }
    }

    if (geminiModelMissing(res.status, res.body)) {
      console.warn(`Gemini ${model}: model yok (${res.status}) — sonraki aday denenecek`)
      return { tur: 'sonraki' }
    }
    if (dropped.indexOf('response_format') === -1 && geminiFormatRejected(res.status, res.body)) {
      // Alan adini vermeyen bir bicim sikayeti (ornegin yalnizca "schema"
      // ya da "mime_type" diyen). Prompt zaten "SADECE gecerli JSON"
      // diyor, alani dusurup ayni modeli bir kez daha deniyoruz.
      console.warn(`Gemini ${model}: response_format reddedildi (${res.status}: ${res.body.slice(0, 200)}) — JSON modu kapatilip tekrar denenecek`)
      dropped.push('response_format')
      return { tur: 'tekrar' }
    }
    /* GUNLUK KOTA MODEL BASINA (25.10.2026).
     *
     * Burasi eskiden "baska aday denenmeyecek, Groq yoluna dusuluyor"
     * diyordu. Ama ucretsiz katmanda RPD MODEL basina 20 (bkz. yaris notu:
     * "yarisa giren her modelin gunluk kotasindan"): 3.7'nin gunu bittiginde
     * 3.5 ve 3.6'nin kotasi el degmemis duruyor. Hedef "Groq yalnizca kota
     * bittiginde" — bir modelin kotasi degil, BUTUN modellerinki. Ayni
     * modeli tekrar denemek hala anlamsiz; sonraki aday deneniyor.
     *
     * geciciModeller'e ekleniyor: gunluk kota da yarin kendiliginden
     * acilir, yani bugunun yedek karti kalicilasmamali (bkz. cik()). Her
     * aday kota/gecici hata verdiyse esik dolar ve Groq'a dusulur — tam da
     * "cok acil durum". */
    if (geminiQuotaExhausted(res.status, res.body)) {
      kota429Gorulen = true
      geciciModeller.add(model)
      console.warn(
        `Gemini ${model}: GUNLUK KOTA dolu (429) — bu model bugun denenmeyecek, ` +
        `sonraki aday deneniyor: ${res.body.slice(0, 200)}`
      )
      if (geciciModeller.size >= GEMINI_ARDISIK_GECICI_MAX) {
        console.warn(
          `Gemini: ${geciciModeller.size} AYRI modelde kota/gecici hata ` +
          `(${[...geciciModeller].join(', ')}) — Groq yoluna dusuluyor`
        )
        return { tur: 'birak' }
      }
      return { tur: 'sonraki' }
    }
    /* GUNLUK OLMAYAN 429 = dakikalik limit (RPM 5).
     *
     * Google'in govdesi ikisini ayirt etmiyor: "Your project has exceeded
     * a quota" hem gunluk hem dakikalik limitte geliyor. Eski kod hepsini
     * olumcul sayiyordu ve dakikalik bir sinirlama Gemini yolunu tamamen
     * kapatiyordu.
     *
     * Ama durust olmak gerekirse: RPM penceresi 60 saniye ve bizim tek
     * istegimizin TAMAMI 150 saniye. Yani bu hatayi "bekleyip gecmek"
     * ancak butce genisken mumkun. Butce dar ise beklemek, kalan zamani
     * da yakip hicbir sey uretmemek demek — o yuzden cikiyoruz.
     *
     * Aday model turlamak da yok: limit projenin, modelin degil. */
    if (res.status === 429) {
      /* Model DUSMUS sayiliyor (27.10.2026). Burasi `geciciModeller`'e
         dokunmuyordu; sonuc: devre kesicinin tetigi (hepsiDustu) kota
         bittigi gun hic dolmuyor ve her yukleme ayni 87 saniyeyi yakiyordu.
         Limit projenin oldugu icin bu model yarin da ayni cevabi verecek. */
      kota429Gorulen = true
      geciciModeller.add(model)
      /* Kalan GERCEK zaman: cagri tavanindan degil, isin butcesinden
         olculur — tavan 105 saniye sabit, butce ise kosu icinde erir. */
      const kalanButce = budgetMs - (Date.now() - basladi)
      const bekleme = Math.min(
        geminiRpmWaitMs(),
        Math.max(0, kalanButce - GEMINI_RPM_RETRY_MIN_REMAINING_MS)
      )
      if (gecici < 1 && kalanButce > GEMINI_RPM_RETRY_MIN_REMAINING_MS) {
        gecici++
        console.warn(
          `Gemini ${model}: dakikalik limit (429) — ${bekleme}ms beklenip ` +
          `BIR kez tekrar denenecek (kalan butce ${kalanButce}ms): ${res.body.slice(0, 160)}`
        )
        if (bekleme > 0) await new Promise((r) => setTimeout(r, bekleme))
        return { tur: 'tekrar' }
      }
      console.warn(
        `Gemini ${model}: dakikalik limit (429) ve beklemeye yer yok ` +
        `(kalan ${kalanButce}ms) — Groq yoluna dusuluyor: ${res.body.slice(0, 160)}`
      )
      return { tur: 'birak' }
    }
    /* OLU AKIS DA GECICI BIR HATADIR (24.10.2026).
     *
     * Burasi yalnizca 503/500'u gecici sayiyordu. Ama yuzey istegi KABUL
     * edip hicbir sey uretmeyebiliyor; o hal `status: 0` ile donuyor.
     * Canli olcum (24.10 kosusu):
     *
     *   Gemini akis [gemini-3.8-flash]: ilk byte 15422ms, ilk olay yok,
     *     0 olay, 0 karakter, toplam 87424ms — AKIS SOZDE
     *   Gemini gemini-3.8-flash: cagri basarisiz (0): ilk olay gelmedi
     *     (72000ms, baglanti acik ama veri yok)
     *
     * Bu 503'ten farkli bir sey degil: yuzey o an is yapamiyor, yarin ayni
     * belge Gemini karti uretebilir. Ama gecici sayilmadigi icin
     * `geciciModeller` bos kaliyor, `cik()` bayragi koymuyor ve o kosunun
     * ZAYIF Groq karti (kapsama %49, yazar ve review atlanmis) onbellege
     * KALICI yaziliyordu. Sonraki yuklemeler 1,9 saniyede o karti aliyor ve
     * Gemini bir daha hic denenmiyor — 21.10'da bu korumayi tam bunun icin
     * eklemistim, deligi bugunku log gosterdi.
     *
     * Ayni modeli TEKRAR denemiyoruz: olu akis 87 saniye yakti, ikincisi
     * butceyi bitirir. Dogrudan sonraki adaya geciliyor. */
    const oluAkis = res.status === 0
    if (oluAkis || res.status === 503 || res.status === 500) {
      ardisikGecici++
      geciciModeller.add(model)
      const bu503 = (model503.get(model) || 0) + (oluAkis ? 0 : 1)
      if (!oluAkis) model503.set(model, bu503)
      console.warn(
        `Gemini ${model}: gecici hata ${res.status}` +
        (oluAkis ? ' (akis olu: olay gelmedi)' : ` (bu modelde ${bu503}/2)`) +
        `: ${res.body.slice(0, 200)}`
      )
      /* Yuzeyin tamami yogunsa sonraki aday modeli denemek ayni duvara
         carpmak: istek de sure de bosa gidiyor. Ama bunun kaniti AYRI
         modellerden gecici hata gelmesi — bkz. geciciModeller. */
      if (geciciModeller.size >= GEMINI_ARDISIK_GECICI_MAX) {
        console.warn(
          `Gemini: ${geciciModeller.size} AYRI modelde gecici hata ` +
          `(${[...geciciModeller].join(', ')}, ${ardisikGecici} deneme) — ` +
          `yuzey yogun sayiliyor, kalan aday modeller denenmiyor, Groq yoluna dusuluyor`
        )
        // Bayragi cik() koyuyor — tek kural, tek yer.
        return { tur: 'birak' }
      }
      /* 503: ONCE DIGER MODELLER (25.10.2026).
       *
       * 503 alan model eskiden 2,5 sn sonra AYNI modelle tekrar deneniyordu.
       * Dort aday x iki deneme = 8 istek, tavan 6: en kotu halde dorduncu
       * aday hic denenmiyordu. Ustelik 503'un govdesi "bu model su an
       * yogun" diyor; 2,5 sn sonra ayni modeli denemek ayni yogunluga
       * carpmak. Simdi 503 veren model SIRANIN SONUNA bir kez ekleniyor:
       * once el degmemis adaylar deneniyor, o model ancak ~30 sn sonra
       * (yogunlugun gecmis olma ihtimali daha yuksekken) ikinci sansini
       * aliyor. 09.10 vakasi (ilk deneme 503, ikincisi tuttu) korunuyor —
       * ikinci deneme yine var, yalnizca sirasi degisti.
       *
       * Olu akis ayni modelde tekrar denenmez — bkz. yukaridaki not. */
      if (!oluAkis && bu503 < 2) return { tur: 'sonra' }
      return { tur: 'sonraki' }
    }
    console.warn(`Gemini ${model}: cagri basarisiz (${res.status}): ${res.body.slice(0, 300)}`)
    return { tur: 'sonraki' }
  }

  /* MODEL YARISI — bkz. GEMINI_YARIS_GENISLIGI.
   *
   * Isi yapan tek yeni sey "kazanan kim" sorusu; sonucu isleyen kod
   * denemeSonucunuIsle, yani sirali yolla BIREBIR ayni. Yaris yalnizca bir
   * hizlandirma katmani: hepsi 503 verirse sirali dongu kalan adaylarla
   * devam ediyor ve yolun kendisi degismiyor. */
  const yarisaGirenler = new Set<string>()
  const yarisGenisligi = Math.max(0, Math.min(
    geminiYarisGenisligi(),
    GEMINI_MAX_REQUESTS_PER_RUN - toplamIstek,
    geminiModelCandidates().length
  ))
  if (yarisGenisligi >= 2) {
    const adaylar = geminiModelCandidates().slice(0, yarisGenisligi)
    const yarisCagriMs = Math.min(callMs, geminiToplamTavan - (Date.now() - basladi))
    if (yarisCagriMs < 35_000) {
      console.log(`Gemini yaris: atlandi (cagri icin ${yarisCagriMs}ms kaliyor)`)
    } else {
      const kontroller = adaylar.map(() => new AbortController())
      const durumlar = adaylar.map(() => geminiAkisDurumu())
      const sonuclar: (GeminiCagriSonucu | null)[] = adaylar.map(() => null)
      let biten = 0
      const basladiYaris = Date.now()
      console.log(
        `Gemini yaris BASLIYOR: ${adaylar.join(' vs ')} ` +
        `(tavan ${yarisCagriMs}ms, kazanan ilk OLAYI getiren)`
      )
      const istekler = adaylar.map((m, i) =>
        callGeminiOnce(
          apiKey, m, systemInstruction, fileBase64, fileMime, userText,
          yarisCagriMs, dropped, durumlar[i], kontroller[i].signal
        ).then((res) => { sonuclar[i] = res; biten++; return res })
      )
      toplamIstek += adaylar.length

      // Kazanan: ilk ISLENMIS olayi getiren. Hepsi duserse kazanan yok.
      let kazanan = -1
      while (kazanan < 0 && biten < adaylar.length) {
        kazanan = durumlar.findIndex((d) => d.olaySayisi > 0)
        if (kazanan >= 0) break
        await new Promise((r) => setTimeout(r, GEMINI_YARIS_YOKLAMA_MS))
      }
      if (kazanan < 0) kazanan = durumlar.findIndex((d) => d.olaySayisi > 0)

      /* Yarista 503 verenler BILINEN mesgul: hem esige sayilsinlar hem de
         sirali dongu onlari bir daha denemesin (kota bosa gitmesin). */
      sonuclar.forEach((r, i) => {
        if (r && !r.ok && (r.status === 503 || r.status === 500)) {
          geciciModeller.add(adaylar[i])
          yarisaGirenler.add(adaylar[i])
        }
      })

      if (kazanan >= 0) {
        const kazananModel = adaylar[kazanan]
        kontroller.forEach((c, i) => { if (i !== kazanan) c.abort() })
        console.log(
          `Gemini yaris: ${kazananModel} kazandi ` +
          `(ilk olay ${durumlar[kazanan].ilkOlayMs}ms, ${adaylar.length - 1} istek iptal edildi)`
        )
        const kazananRes = await istekler[kazanan]
        const sonuc = await denemeSonucunuIsle(kazananModel, kazananRes, basladiYaris, yarisCagriMs)
        if (sonuc.tur === 'taslak') return sonuc.taslak
        if (sonuc.tur === 'birak') return cik()
        /* 'tekrar'/'sonraki': kazananin sonucu kullanilabilir degil (alan
           dusurme, bicim reddi...). Sirali dongu bu modeli yeniden
           denesin — alan dusurme tam bu is icin var. */
        console.warn(
          `Gemini yaris: ${kazananModel} kazandi ama sonuc '${sonuc.tur}' — sirali yola donuluyor`
        )
        yarisaGirenler.delete(kazananModel)
      } else {
        console.warn(
          `Gemini yaris: kazanan yok (${adaylar.length} adayin hicbiri olay getirmedi) — ` +
          `sirali yola donuluyor`
        )
      }
      if (geciciModeller.size >= GEMINI_ARDISIK_GECICI_MAX) {
        console.warn(
          `Gemini: yarista ${geciciModeller.size} AYRI modelde gecici hata ` +
          `(${[...geciciModeller].join(', ')}) — yuzey yogun sayiliyor, Groq yoluna dusuluyor`
        )
        return cik()
      }
    }
  }

  /* SIRALI YOL ARTIK BIR KUYRUK (25.10.2026).
   *
   * Ic ice iki dongu (aday x deneme) iki yeni davranisi tasiyamiyordu:
   *  - 503 veren modeli SIRANIN SONUNA almak (bkz. 'sonra'),
   *  - sessiz modeli beklerken yedek modeli PARALEL baslatmak (bkz.
   *    GEMINI_YEDEK_GECIKME_MS_VARSAYILAN) — yedek, kuyruktaki siradaki adayi
   *    alir; bir denemenin sonucu iki ayri modelden gelebilir.
   * Kurallar aynen yerinde: model basina en fazla 5 deneme (alan dusurme),
   * istek tavani, fail butcesi, toplam tavan. */
  const sira: string[] = []
  for (const m of geminiModelCandidates()) {
    if (yarisaGirenler.has(m)) {
      console.log(`Gemini ${m}: yarista 503 verdi — sirali yolda tekrar denenmiyor`)
      continue
    }
    sira.push(m)
  }
  const modelDenemesi = new Map<string, number>()
  const sonaAlinan = new Set<string>()
  const yonlendir = (m: string, tur: GeminiDenemeSonucu['tur']) => {
    if (tur === 'tekrar') {
      if ((modelDenemesi.get(m) || 0) < 5) sira.unshift(m)
    } else if (tur === 'sonra' && !sonaAlinan.has(m)) {
      sonaAlinan.add(m)
      sira.push(m)
    }
  }

  type DenemeKaydi = { model: string; res: GeminiCagriSonucu; startedAt: number; buCagriMs: number }
  const yedekGecikme = mode === 'only' ? geminiYedekGecikmeMs() : -1
  let sonIstekAni = 0

  /* Bir deneme + gerekirse GECIKMELI YEDEK. Dondurdugu dizinin ILK elemani
     kazanan (ilk olayi getiren) ya da yedek hic baslamadiysa tek deneme;
     arkasindakiler kazanan belli olmadan DUSEN yarisci(lar). Kesilen
     kaybeden dondurulmez — onun sonucu modelin degil bizim iptalimizin. */
  const yedekliDene = async (model: string, buCagriMs: number): Promise<DenemeKaydi[]> => {
    type Kosu = {
      model: string; startedAt: number; buCagriMs: number
      durum: GeminiAkisDurum; kontrol: AbortController
      res: GeminiCagriSonucu | null; p: Promise<GeminiCagriSonucu>
    }
    const baslat = (m: string, ms: number): Kosu => {
      const k = {
        model: m, startedAt: Date.now(), buCagriMs: ms,
        durum: geminiAkisDurumu(), kontrol: new AbortController(), res: null
      } as unknown as Kosu
      sonIstekAni = k.startedAt
      // Yalnizca only modunda: shadow modunda Groq'un payi pazarlik konusu degil.
      const akisTavani = mode === 'only'
        ? Math.max(0, budgetMs - GEMINI_AKIS_SONRASI_PAYI_MS - (k.startedAt - basladi))
        : undefined
      k.p = callGeminiOnce(
        apiKey, m, systemInstruction, fileBase64, fileMime, userText, ms, dropped,
        k.durum, k.kontrol.signal, akisTavani
      ).then((r) => { k.res = r; return r })
      return k
    }
    const kayit = (k: Kosu): DenemeKaydi =>
      ({ model: k.model, res: k.res as GeminiCagriSonucu, startedAt: k.startedAt, buCagriMs: k.buCagriMs })

    const ilk = baslat(model, buCagriMs)
    /* Akissiz yolda (yuzey stream alanini reddetti) olay hic gelmez ve
       cevap 70-110 sn surer: yedek HER kosuda baslar ve RPD yakardi. */
    if (yedekGecikme < 0 || dropped.indexOf('stream') !== -1) {
      await ilk.p
      return [kayit(ilk)]
    }
    const aktif: Kosu[] = [ilk]
    const dusen: DenemeKaydi[] = []
    let tavanKesti = false
    let kotaYedekSusturuldu = false
    for (;;) {
      /* Kazanan: ilk OLAYI getiren — ya da akissiz/duz JSON yolunda olay
         saymadan BASARIYLA biten. */
      const olayli = aktif.find((k) => k.durum.olaySayisi > 0 || (k.res !== null && k.res.ok))
      if (olayli) {
        for (const k of aktif) {
          if (k === olayli) continue
          k.kontrol.abort('yedek yarisi kaybedildi')
          console.log(
            `Gemini yedek: ${olayli.model} ilk olayi getirdi ` +
            `(${olayli.durum.ilkOlayMs}ms) — ${k.model} kesildi`
          )
        }
        await olayli.p
        return [kayit(olayli), ...dusen]
      }
      for (let i = aktif.length - 1; i >= 0; i--) {
        const bitti = aktif[i].res
        if (!bitti) continue
        /* Kota 429'u YARIS SIRASINDA goruluyor; denemeSonucunuIsle yarisin
           SONUNDA calistigi icin bayrak oraya birakilamaz — bir sonraki
           yedek coktan baslamis olur. Olculen kosuda (27.10, 18:40) tam
           bu oldu: 3.5 429 dondu, saniyeler sonra 3.6 baslatildi, o da 429,
           arkasindan 3.8. Uc istek, ayni projenin ayni limitine. */
        if (bitti.ok === false && bitti.status === 429) kota429Gorulen = true
        dusen.push(kayit(aktif.splice(i, 1)[0]))
      }
      if (aktif.length === 0) return dusen

      const gecen = Date.now() - basladi
      /* Toplam tavanda hala HICBIR yarisci olay getirmediyse hepsi kesilir:
         yedegin kendi tavani devam tavanina kadar uzanir, ama olay
         getirmeyen bir akisin Groq'un payini yemesine izin yok. */
      if (gecen >= geminiToplamTavan && !tavanKesti) {
        tavanKesti = true
        console.warn(
          `Gemini yedek: toplam tavan (${geminiToplamTavan}ms) doldu, hicbir model olay ` +
          `getirmedi — ${aktif.map((k) => k.model).join(', ')} kesiliyor`
        )
        for (const k of aktif) k.kontrol.abort(`toplam tavanda ilk olay yok (${geminiToplamTavan}ms)`)
      }
      /* KOTA 429'DAN SONRA YEDEK YOK (27.10.2026).
         Kodun kendi teshisi asagida yaziyor: "limit projenin, modelin
         degil". Yedek baslatmak o limite bir kez daha carpmak, ustelik
         RPD'den bir istek daha goturmek demek. Olculen kosuda uc yedegin
         ucu de reddedildi; kurtarma stratejisinin kendisi hastaligi
         buyutuyordu. */
      if (kota429Gorulen && aktif.length < 2 && !kotaYedekSusturuldu) {
        kotaYedekSusturuldu = true
        console.warn('Gemini yedek: kota 429 goruldu — yedek model baslatilmiyor (limit projenin, modelin degil)')
      }
      if (
        !tavanKesti &&
        !kota429Gorulen &&
        aktif.length < 2 &&
      /* YEDEK GECIKMESI ARTIK SON ISTEKTEN SAYILIYOR (28.10.2026).
         Esik `ilk.startedAt`e bakiyordu: ilk gecikme bir kez dolduktan sonra
         kosul kalici olarak dogru kaliyor ve dusen her yarisci yerine tek fren
         olarak GEMINI_RETRY_WAIT_MS (2,5 sn) kaliyordu. 28.10 19:52 kosusunda
         tam bu oldu: 3.5 olu akis, 3.6 35,2 sn de basladi, 3.7 bes saniye
         sonra, 3.8 iki saniye sonra — DORT istek YEDI saniyeye sigdi, ucu de
         503 ve bir kosuda dort RPD yandi. Oysa olculen saglikli akisin ilk
         olayi 25,6 sn de geliyor; aninda baslatilan yedegin kendi penceresi
         hic verilmemis oluyordu. sonIstekAni her baslat() cagrisinda
         guncellendigi icin ILK yedek yine tam gecikmede basliyor, sonrakiler
         de kendi penceresini aliyor. Hepsi 503 veren bir yuzeyde aktif
         bosalinca dongu dusenleri donduruyor, yani kuyruk SIRAYLA yurutuluyor.
         Not: GEMINI_RETRY_WAIT_MS kosulu altta duruyor — gecikme secret ile
         2,5 sn nin altina cekilirse RPM payi yine korunsun. */
        Date.now() - sonIstekAni >= yedekGecikme &&
        Date.now() - sonIstekAni >= GEMINI_RETRY_WAIT_MS &&
        toplamIstek < GEMINI_MAX_REQUESTS_PER_RUN &&
        geminiToplamTavan - gecen >= GEMINI_YEDEK_MIN_KALAN_MS
      ) {
        const i = sira.findIndex((m) => !aktif.some((k) => k.model === m))
        if (i >= 0) {
          const yedek = sira.splice(i, 1)[0]
          const yedekMs = Math.min(callMs, geminiDevamTavan - gecen)
          toplamIstek++
          modelDenemesi.set(yedek, (modelDenemesi.get(yedek) || 0) + 1)
          console.warn(
            `Gemini yedek: ${aktif.map((k) => `${k.model} ${Date.now() - k.startedAt}ms`).join(', ')} ` +
            `olay getirmedi — ${yedek} paralel baslatiliyor (tavan ${yedekMs}ms, ` +
            `istek ${toplamIstek}/${GEMINI_MAX_REQUESTS_PER_RUN})`
          )
          aktif.push(baslat(yedek, yedekMs))
        }
      }
      // Bir cagri biterse yoklama araligini beklemeden uyan.
      await Promise.race([
        new Promise((r) => setTimeout(r, GEMINI_YARIS_YOKLAMA_MS)),
        ...aktif.map((k) => k.p)
      ])
    }
  }

  let oncekiModel = ''
  while (sira.length > 0) {
    const model = sira.shift() as string
    if (model !== oncekiModel) gecici = 0
    oncekiModel = model
    const gecen = Date.now() - basladi
    if (!ilkIstek && gecen > GEMINI_FAIL_BUDGET_MS) {
      console.warn(
        `Gemini: denemeler ${gecen}ms yedi (sinir ${GEMINI_FAIL_BUDGET_MS}ms) — ` +
        (mode === 'only'
          ? 'yeni deneme baslatilmiyor'
          : "Groq'a yer birakmak icin durduruluyor")
      )
      return cik()
    }
    if (!ilkIstek) await new Promise((r) => setTimeout(r, GEMINI_RETRY_WAIT_MS))
    ilkIstek = false

    // Toplam tavandan geriye kalan — bkz. geminiToplamTavan.
    const buCagriMs = Math.min(callMs, geminiToplamTavan - (Date.now() - basladi))
    if (buCagriMs < 20_000) {
      console.warn(
        `Gemini: toplam tavandan geriye ${buCagriMs}ms kaldi — ` +
        `yeni deneme baslatilmiyor, Groq'a pay birakiliyor`
      )
      return cik()
    }

    /* GUNLUK KOTA KORUMASI (17.10.2026).
     * Dis dongu 4 aday model, ic dongu 5 deneme: ust sinir 20 istek, yani
     * TAM GUNLUK KOTA (RPD 20). Gercekte bu kadarina ulasmak icin hatalarin
     * hizli donmesi gerekir, ama o durum tam olarak kotanin en hizli
     * yandigi durum. Bir yuklemenin gunun tamamini yakmasina izin yok. */
    if (toplamIstek >= GEMINI_MAX_REQUESTS_PER_RUN) {
      console.warn(
        `Gemini: bu yuklemede ${toplamIstek} istek harcandi (tavan ` +
        `${GEMINI_MAX_REQUESTS_PER_RUN}) — gunluk kotayi korumak icin duruluyor`
      )
      return cik()
    }
    toplamIstek++
    modelDenemesi.set(model, (modelDenemesi.get(model) || 0) + 1)

    /* Isleme TEK yerde — bkz. denemeSonucunuIsle. Akis kontrolu burada
       deger olarak karsilaniyor. Kazanan once islenir: bir yedegin dusmesi
       kazananin kartini asla engellememeli. */
    for (const d of await yedekliDene(model, buCagriMs)) {
      const denemeSonucu = await denemeSonucunuIsle(d.model, d.res, d.startedAt, d.buCagriMs)
      if (denemeSonucu.tur === 'taslak') return denemeSonucu.taslak
      if (denemeSonucu.tur === 'birak') return cik()
      yonlendir(d.model, denemeSonucu.tur)
    }
  }

  /* Esik dolmadan liste tukendiginde de (ornegin bir model 503, digerleri
     404) tasiyici sebep GECICI: yarin ayni belge Gemini kartini uretebilir,
     yani bugunun yedek karti kalicilastirilmamali. Bayragi cik() koyuyor. */
  console.warn(
    'Gemini: hicbir aday model taslak uretemedi — Groq yoluna dusuluyor' +
    (geciciModeller.size > 0 ? ` (gecici hata veren: ${[...geciciModeller].join(', ')})` : '')
  )
  return cik()
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  /* ISTEGIN GERCEK BASLANGICI (17.10.2026).
   *
   * Butce bugune kadar pipelineStartedAt'ten olculuyordu — ama o an
   * indirme, PDF metin cikarma, OCR ve document_chunks yazimindan SONRA
   * geliyor. Yani 145.000 ms'lik butce aslinda "145 saniye + olculmemis
   * hazirlik suresi" demekti ve Supabase'in ~150 saniyelik duvariyla
   * arasindaki pay kagit uzerinde oldugundan dardi.
   *
   * Artik hazirlik suresi butceden DUSULUYOR: butce ne olursa olsun
   * istegin tamami duvarin altinda kaliyor. */
  const requestStartedAt = Date.now()
  /* BEKLENMEYEN ISTISNA BELGEYI ASKIDA BIRAKIYORDU (24.10.2026).
   *
   * En dis catch 500 donuyor ama markFailed'i CAGIRMIYORDU; documents.status
   * 'processing' olarak kaliyor ve ogrenci sonsuza kadar bekliyor. Akis
   * icindeki ~10 ayri hata yolu markFailed cagiriyor, yalnizca "hic
   * beklenmeyen" yol cagirmiyordu — yani en tehlikelisi.
   *
   * Somut ornek: model `key_points`'i [{point: "..."}] olarak dondurdugunde
   * birlesme TypeError atiyor (normalizeForDedup dizge bekliyor) ve belge
   * askida kaliyor. O sekil hatasi ayrica duzeltildi, ama ag burada olmali:
   * hangi istisna olursa olsun kart basarisiz ISARETLENMELI.
   *
   * documentId try'in ICINDE ayristiriliyor; catch'in ona erisebilmesi icin
   * disarida tutuluyor. Istisna req.json()'dan once olursa null kalir ve
   * isaretleyecek bir belge de yoktur. */
  let hataIcinDocumentId: string | null = null
  let hataIcinClient: any = null

  try {
    if (req.method !== 'POST') {
      console.warn(`Erken cikis 405: method=${req.method}`)
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Every early return below used to be silent. A failed first attempt
    // therefore produced a worker that logged "booted" and "Listening" and
    // nothing else — which is exactly what the student's "first press errors,
    // second press works" looks like in the logs, with no way to tell WHICH
    // of the five exits it took. Each one now names itself.
    const { documentId, summaryStyle, language, summaryLength, analyzeVisuals: analyzeVisualsRequested, depth: depthRaw, yenile: yenileRaw } = await req.json()
    /* Onbellek okumasini atlar — kismi satira sikisan belgenin cikis yolu.
       Yazma etkilenmez: tazelenen kosu tam kart uretirse tam satir dusuyor. */
    const onbellegiAtla = !!yenileRaw
    // let: Lite planinda gorsel analiz kapali — kota okununca dusurulebilir.
    let analyzeVisuals = !!analyzeVisualsRequested
    // En dis catch'in belgeyi isaretleyebilmesi icin — bkz. hataIcinDocumentId.
    hataIcinDocumentId = documentId ?? null
    resetGeminiParallelUsage()
    const istekBasladi = Date.now()
    console.log(`Istek alindi: documentId=${documentId ?? '(yok)'}, visuals=${analyzeVisuals ? 'evet' : 'hayir'}, gemini_mode=${geminiMode()}`)
    if (!documentId) {
      console.warn('Erken cikis 400: documentId gonderilmedi')
      return new Response(JSON.stringify({ error: 'documentId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let style = (summaryStyle || 'standard').toLowerCase()
    const lang = (language || 'en').toLowerCase()
    let len = (summaryLength || 'medium').toLowerCase()
    // Denetim Raporu, 2026-08-31 — UI SIMPLIFICATION: the upload modal
    // (dashboard.html) no longer asks the student for depth/summaryLength at
    // all — only language + a single "want visuals?" toggle. Only honor an
    // explicit depth if some caller actually sends one (kept for backward
    // compatibility / API callers); otherwise it is auto-selected below,
    // once the real extracted document length is known — see
    // "AUTO DEPTH SELECTION" further down, right after useChunkedPipeline is
    // computed. depth/depthFlags are not read anywhere before that point.
    const explicitDepth = ['brief', 'standard', 'deep', 'exam'].includes(String(depthRaw || '').toLowerCase())
      ? String(depthRaw).toLowerCase()
      : null



    // Get User Authorization JWT to verify ownership
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn('Erken cikis 401: Authorization basligi yok')
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

    // Fetch document to verify ownership.
    //
    // Retried once on purpose. The dashboard inserts the documents row and
    // calls this function immediately after; when the row is not yet visible
    // to this request's scoped client, the select comes back empty and the
    // student sees "Document not found or access denied" on the first press,
    // then a second press a moment later works. That is the single most
    // reported annoyance in this flow, and it costs one short wait to absorb.
    //
    // A genuine permission failure is unaffected: under RLS a document that
    // is not the caller's returns no rows on the retry either, so the same
    // 404 is returned, just ~700ms later and with a log line saying so.
    const DOC_LOOKUP_RETRY_MS = 700
    let document: any = null
    let docError: any = null
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await userClient.from('documents').select('*').eq('id', documentId).single()
      document = res.data
      docError = res.error
      if (document) {
        if (attempt > 0) console.log(`Belge ${attempt + 1}. denemede bulundu (ilk deneme bos dondu)`)
        break
      }
      if (attempt === 0) {
        console.warn(`Belge ilk denemede bulunamadi (code=${docError?.code ?? '-'}), ${DOC_LOOKUP_RETRY_MS}ms sonra tekrar deneniyor`)
        await new Promise(r => setTimeout(r, DOC_LOOKUP_RETRY_MS))
      }
    }

    if (docError || !document) {
      console.error(`Erken cikis 404: belge bulunamadi veya erisim yok (documentId=${documentId}, code=${docError?.code ?? '-'}, message=${docError?.message ?? '-'})`)
      return new Response(JSON.stringify({ error: 'Document not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Service role client for download and DB write modifications
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)
    hataIcinClient = serviceClient   // bkz. hataIcinDocumentId

    // ==========================================================================
    // COURSE CATALOG LOOKUP — makes the AI's course-tag suggestion department-aware
    // Fetches the official curriculum ("Ders Ağacı") courses for the uploading
    // student's declared department (public.departments / public.courses,
    // seeded via 20260721_add_course_catalog.sql) and passes it to the LLM so it
    // can match the document against a REAL course code instead of guessing one
    // out of thin air. Fails soft — if the catalog tables don't exist yet or the
    // student has no department on file, we just fall back to the old free-guess
    // behavior instead of erroring the whole summarization out.
    // ==========================================================================
    let courseCatalogBlock = "No official course catalog is available for this student — suggest a course code or subject label only if one is explicitly evident in the document text itself."
    try {
      const { data: ownerProfile } = await serviceClient
        .from('profiles')
        .select('department')
        .eq('id', document.user_id)
        .single()

      if (ownerProfile?.department) {
        const { data: deptRow } = await serviceClient
          .from('departments')
          .select('code')
          .eq('name', ownerProfile.department)
          .maybeSingle()

        if (deptRow?.code) {
          const { data: deptCourses } = await serviceClient
            .from('courses')
            .select('course_code, course_name')
            .eq('department_code', deptRow.code)
            .order('course_code')

          if (deptCourses && deptCourses.length > 0) {
            courseCatalogBlock = deptCourses.map((c: any) => `${c.course_code} — ${c.course_name}`).join('\n')
          }
        }
      }
    } catch (catalogErr) {
      console.warn('Course catalog lookup failed, continuing with free-text course guessing: ', catalogErr)
    }

    // 1. Instantly set document status to processing
    await serviceClient
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId)

    // Isci nobetcisi — bkz. ISCI_NOBET_MS.
    {
      const nobetci = setTimeout(async () => {
        try {
          const { data: durumSatiri } = await serviceClient.from('documents').select('status').eq('id', documentId).maybeSingle()
          if (durumSatiri && durumSatiri.status === 'processing') {
            console.error(`Nobetci: ${Date.now() - istekBasladi}ms doldu, belge hala 'processing' — isci kapatilmadan once 'failed' isaretleniyor`)
            await markFailed(serviceClient, documentId)
          }
        } catch (_e) { /* nobetci sessiz */ }
      }, Math.max(5_000, ISCI_NOBET_MS - (Date.now() - istekBasladi)))
      try { (Deno as any).unrefTimer(nobetci) } catch (_e) { /* eski calisma ortami */ }
    }

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
    /* Taranmis belge OCR'da sayfa sinirina takildiysa: kac sayfa okunabildi.
       Karta rozet olarak yaziliyor (quality_meta.ocr_kismi) — ogrenci
       ozetin belgenin tamamini gormedigini bilmeli. Bildirim BURADA,
       cunku OCR blogu asagidaki oteki `let`lerden ONCE calisiyor (TDZ). */
    let ocrKismi: { sayfa: number } | null = null
    /* Metin OCR'dan mi geldi. Sayisal kapsama rozetinin yayinlanip
       yayinlanmayacagini belirliyor — bkz. KAPSAMA_ROZET_MIN_ORNEK yanindaki
       kullanim. OCR matematigi bozuyor ve hayalet sayi uretiyor. */
    let ocrKullanildi = false
    /* Dosyanin sha256'si iki yerde lazim: OCR onbellegi (asagida) ve ozet
       onbellegi anahtari. Bir kez hesaplaniyor. */
    let dosyaHash: string | null = null
    const mimeType = document.mime_type?.toLowerCase() || ""
    // Per-page PDF text, kept around after extraction (Denetim Raporu,
    // 2026-08-31) so we can measure text density per page below — this is
    // what lets us tell a text-heavy long document apart from a slide deck
    // that just happens to be long, without adding a second PDF parse.
    let pdfPageTexts: string[] = []

    try {
      if (mimeType === "text/plain") {
        extractedText = new TextDecoder("utf-8").decode(fileBytes)
      }
      else if (mimeType === "application/pdf") {
        let isScannedOrFailed = false
        try {
          const pdf = await getDocumentProxy(fileBytes)
          // mergePages: false (per-page array) instead of true (one merged
          // string) — we insert an explicit "--- SAYFA N ---" marker before
          // each page's text below so the model can cite the EXACT page a
          // claim came from (see the FOOTNOTES prompt instructions), instead
          // of only a vague topic/section description as before.
          // Denklem sayfalari koordinattan yeniden diziliyor (bkz.
          // extractPdfPagesWithEquations). Herhangi bir hata unpdf'in duz
          // cikarimina duser — eski davranis, yalnizca PUA haritasiyla.
          let pdfPages: string[]
          try {
            const res = await extractPdfPagesWithEquations(pdf)
            pdfPages = res.pages
            if (res.rebuilt.length > 0) {
              console.log(`Denklem sayfalari yeniden dizildi: ${res.rebuilt.length}/${pdfPages.length} sayfa [${res.rebuilt.slice(0, 30).join(',')}]`)
            }
          } catch (eqErr) {
            console.warn('Denklem duzeni kurulamadi, duz cikarim kullaniliyor:', String((eqErr as any)?.message || eqErr).slice(0, 200))
            const { text } = await extractText(pdf, { mergePages: false })
            pdfPages = text.map(mapSymbolPua)
          }
          pdfPageTexts = pdfPages
          const pdfTextWithPageMarkers = pdfPages.map((pageText, idx) => `--- SAYFA ${idx + 1} ---\n${pageText}`).join('\n\n')
          extractedText = detectAndFormatPdfTables(pdfTextWithPageMarkers)

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
          console.log("PDF text is empty, short or extraction failed — OCR yolu deneniyor.")
          /* OCR CAGRISINDAN ONCE ONBELLEK — bkz. onbellektenOcrMetni.
             Sorgu yalnizca GERCEKTEN OCR yapilacaksa atiliyor, yani normal
             metinli PDF yolu hicbir ek maliyet gormuyor. */
          /* Onbellek kapaliyken OCR metni de yok (ayni tabloda duruyor),
             bos sorgu atmanin anlami kalmiyor. */
          if (SUMMARY_CACHE_ACIK && !onbellegiAtla) {
            dosyaHash = dosyaHash ?? await sha256Hex(fileBytes)
            const ocrOnbellek = await onbellektenOcrMetni(serviceClient, dosyaHash)
            if (ocrOnbellek) {
              ocrKullanildi = true
              if (ocrOnbellek.sayfa !== null) ocrKismi = { sayfa: ocrOnbellek.sayfa }
              /* detectAndFormatPdfTables UYGULANMIYOR: satirdaki metin zaten
                 islenmis halde yazildi (bkz. summary_cache yazimi). */
              extractedText = ocrOnbellek.text
              isScannedOrFailed = false
              console.log(
                `OCR ONBELLEK ISABETI: ${extractedText.length} karakter` +
                `${ocrKismi ? `, kismi (${ocrKismi.sayfa} sayfa)` : ''}` +
                ` — OCR.space cagrisi yok`
              )
            }
          }
        }

        if (isScannedOrFailed) {
          const ocrApiKey = Deno.env.get('OCR_SPACE_API_KEY')
          if (ocrApiKey) {
            try {
              const ocr = await tryOCRParcali(fileBytes, ocrApiKey)
              const ocrTextLen = (ocr.text || "").trim().length
              if (ocrTextLen >= 200) {
                if (ocr.okunanSayfa < ocr.toplamSayfa) {
                  ocrKismi = { sayfa: ocr.okunanSayfa }
                  console.warn(
                    `OCR KISMI: ${ocr.okunanSayfa}/${ocr.toplamSayfa} sayfa okundu ` +
                    `(${ocrTextLen} karakter) — kart bu kadariyla uretiliyor ve rozetleniyor`
                  )
                } else {
                  console.log(`OCR succeeded! ${ocr.toplamSayfa} sayfa, ${ocrTextLen} karakter.`)
                }
                ocrKullanildi = true
                extractedText = detectAndFormatPdfTables(ocr.text)
              } else {
                /* YUZEY DUSTUYSE MESAJ BASKA (31.10.2026 olcumu).
                 * Hic metin gelmedi ve dusen parcalarin sebebi 5xx/429 ise
                 * belgede bir sorun YOK: ocr.space kisa sure yanit vermedi.
                 * Olculen kosu: Week 9, dort parca birden HTTP 503; AYNI
                 * belge 90 sn once ve 80 sn sonra 27/27 sayfa okundu.
                 * Ogrenciye "taranmis PDF, OCR yazilimiyla cevirin" demek
                 * onu bos yere ugrastiriyordu — dogru tavsiye beklemek. */
                throw new Error(ocr.yuzeyHatasi > 0 ? "OCR_SERVICE_DOWN" : "SCANNED_PDF")
              }
            } catch (ocrErr: any) {
              console.error("OCR fallback failed: ", ocrErr)
              throw new Error(ocrErr?.message === "OCR_SERVICE_DOWN" ? "OCR_SERVICE_DOWN" : "SCANNED_PDF")
            }
          } else {
            console.warn("OCR_SPACE_API_KEY not configured. Falling back to scanned error.")
            throw new Error("SCANNED_PDF")
          }
        }
      }
      else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        try {
          const docxHtmlResult = await mammoth.convertToHtml({ buffer: fileBytes })
          const parsedDocxText = parseDocxHtmlContent(docxHtmlResult.value || "")
          if (parsedDocxText.trim()) {
            extractedText = parsedDocxText
          } else {
            const rawFallback = await mammoth.extractRawText({ buffer: fileBytes })
            extractedText = rawFallback.value
          }
        } catch (docxErr) {
          console.warn("Mammoth HTML conversion failed, falling back to raw text: ", docxErr)
          const docxResult = await mammoth.extractRawText({ buffer: fileBytes })
          extractedText = docxResult.value
        }
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
          // Use the slide's real numeric filename (slideN.xml), not the loop
          // index — slides can be non-contiguous if some were deleted, so
          // the index alone could point students to the wrong slide.
          const slideNumMatch = slidePath.match(/slide(\d+)\.xml$/)
          const slideNum = slideNumMatch ? parseInt(slideNumMatch[1], 10) : (slideFiles.indexOf(slidePath) + 1)
          const slideXml = await zip.files[slidePath].async("text")
          const slideText = parsePptxSlideXml(slideXml)
          if (slideText) {
            // "--- SLAYT N ---" marker mirrors the PDF path's page markers so
            // the model can cite the exact slide a claim came from.
            pptxText += `--- SLAYT ${slideNum} ---\n${slideText}\n\n`
          }
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
      } else if (extractionError?.message === "OCR_SERVICE_DOWN") {
        // Belge okunabilir, servis o anda yanit vermedi — bkz. yukaridaki not.
        errorMsg = "The text-recognition service did not respond just now (it returned a temporary error). Your file is fine — please try again in a few minutes."
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

    // PDF pages get "--- SAYFA N ---" markers, PPTX slides get "--- SLAYT N
    // ---" markers (see extraction above); DOCX/plain-text/fallback paths
    // have no reliable page concept, so they get neither. This flag tells the
    // footnote-instruction prompts below whether to ask the model for real
    // page/slide numbers or to fall back to the old topic/heading reference.
    const hasPageMarkers = mimeType === "application/pdf" || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    const pageMarkerLabel = mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ? "SLAYT" : "SAYFA"

    // Drop running headers/footers before anything downstream sees the text,
    // so the saving reaches the window budget, the stored chunks, the
    // grounding gate's source and the citation index alike. Must run after the
    // page markers exist and before document_chunks is written.
    if (hasPageMarkers) {
      const deboilerplated = stripRepeatedBoilerplate(extractedText, pageMarkerLabel)
      if (deboilerplated.charsSaved > 0) {
        extractedText = deboilerplated.text
        console.log(
          `Boilerplate strip: ${deboilerplated.charsSaved} krk kazanildi ` +
          `(%${((deboilerplated.charsSaved / (deboilerplated.charsSaved + extractedText.length)) * 100).toFixed(1)}), ` +
          `silinen: ${deboilerplated.removed.map(l => JSON.stringify(l.slice(0, 50))).join(', ')}`
        )
      }
    }

    // ==========================================================================
    // PERSIST THE EXTRACTED TEXT (document_chunks)
    //
    // This is the only place in the system that has the document's text in a
    // clean, page-aware form, and it used to throw it away on return — which
    // is why chat-with-document re-downloaded and re-parsed the same file on
    // every message. Writing it once here, right after extraction and before
    // either pipeline branch, means every document gets chunked regardless of
    // its size or which path summarizes it.
    //
    // Deliberately NOT awaited behind a failure path: if this write fails the
    // student still gets their study card, and chat falls back to extracting
    // on demand exactly as it does today.
    // ==========================================================================
    try {
      const storable = buildStorableChunks(extractedText, pageMarkerLabel)
      const { written, error: chunkError } = await persistDocumentChunks(serviceClient, documentId, storable)
      if (chunkError) {
        console.warn(`document_chunks: ${chunkError} (ozet akisi etkilenmedi)`)
      } else {
        const paged = storable.filter(c => c.page_start !== null).length
        console.log(
          `document_chunks: ${written} chunk yazildi ` +
          `(${paged} tanesi sayfa numarali, ort. ${Math.round(extractedText.length / Math.max(1, written))} krk)`
        )
      }
    } catch (chunkErr) {
      console.warn('document_chunks: beklenmeyen hata, atlandi:', chunkErr)
    }

    // ==========================================================================
    // KOTA + OZET CACHE'I (19.10.2026) — bkz. 20261019_ozet_cache_ve_kota.sql
    //
    // Burada, yani metin cikarildiktan ve document_chunks yazildiktan SONRA,
    // ilk model cagrisindan ONCE duruyor: cache'ten gelen belgede de
    // chat-with-document calismaya devam eder, ama hicbir LLM token'i harcanmaz.
    //
    // Sira bilincli: once cache, sonra kota. Cache isabeti maliyetsiz oldugu
    // icin sayfa kotasindan dusulmez ve kotasi dolmus kullanici da ayni
    // dosyanin hazir ozetini alabilir.
    //
    // Migration uygulanmamissa her iki adim da uyari yazip atlanir.
    // ==========================================================================
    const billablePages = pdfPageTexts.length > 0
      ? pdfPageTexts.length
      : Math.max(1, Math.ceil(extractedText.length / 3000))

    // Kota cache'ten ONCE okunur ama ancak cache'ten SONRA uygulanir: plan
    // gorsel analizi kapatiyorsa bu, cache anahtarina da yansimali.
    let quota: any = null
    {
      const { data, error: quotaErr } = await serviceClient
        .rpc('get_summary_quota', { p_user: document.user_id })
      if (quotaErr || !data) {
        console.warn(`Kota okunamadi (${quotaErr?.message ?? 'bos'}) — kota kontrolu atlandi`)
      } else {
        quota = data
        if (analyzeVisuals && quota.visual_analysis === false) {
          analyzeVisuals = false
          console.log(`Gorsel analiz kapatildi: ${quota.plan} planinda yok`)
        }
      }
    }

    let summaryCacheKey: string | null = null
    let metinCacheKey: string | null = null
    try {
      /* GORSEL BAYRAGI ISABETI ENGELLEMIYOR (25.10.2026).
         Bayrak anahtarin parcasi oldugu icin gorseli acmak ya da kapatmak
         ayni dosyanin eski hizli satirini gecersiz kiliyordu; kart 2 sn
         yerine sifirdan uretiliyordu. Tam esleme HALA once gelir, yoksa
         KARSI bayragin satiri yedek isabet sayilir: gorsel kapali istenip
         acik satir gelirse icerik zengin, zarar yok; tersinde kart gorsel
         analizi olmadan gelir — hic kart uretmemekten ucuz. */
      const ayarlariKur = (gorsel: boolean) =>
        [lang, style, len, gorsel ? 'v' : 'nv', SUMMARY_CACHE_VERSION]
      const ayarlar = ayarlariKur(analyzeVisuals)
      const ayarlarYedek = ayarlariKur(!analyzeVisuals)
      // Tarama yolunda OCR onbellegi icin zaten hesaplanmis olabilir.
      const contentHash = dosyaHash ?? await sha256Hex(fileBytes)
      dosyaHash = contentHash
      summaryCacheKey = [contentHash, ...ayarlar].join(':')
      const yedekDosyaKey = [contentHash, ...ayarlarYedek].join(':')
      /* IKINCI ANAHTAR: cikarilan metnin hash'i. Ayni sunum yeniden
         kaydedilmis ya da baska bir araçla taranmissa bayt dizisi degisir,
         metin degismez — dosya hash'i iskalar, bu yakalar. */
      const metinHash = await sha256Metin(extractedText)
      metinCacheKey = metinHash ? ['t' + metinHash, ...ayarlar].join(':') : null
      const yedekMetinKey = metinHash ? ['t' + metinHash, ...ayarlarYedek].join(':') : null
      /* SIRA ONEM TASIYOR: tam esleme > metin eslemesi > gorsel yedegi.
         Bu yuzden .limit(1) KALKTI — surucu hangi satiri dondurecegini
         secemez, siralamayi burada biz yapiyoruz. */
      const tamAnahtarlar = [summaryCacheKey, metinCacheKey, yedekDosyaKey, yedekMetinKey]
        .filter(Boolean) as string[]
      /* Kismi satirlar EN SONDA: tam kart bir kez uretildiginde kismi satir
         bir daha secilmez — bkz. CACHE_KISMI_EKI. */
      const anahtarlar = [...tamAnahtarlar, ...tamAnahtarlar.map(k => k + CACHE_KISMI_EKI)]
      const { data: cachedRows, error: cacheErr } = (!SUMMARY_CACHE_ACIK || onbellegiAtla)
        ? (console.log(SUMMARY_CACHE_ACIK
            ? 'summary_cache: okuma atlandi — istek yenile=true'
            : 'summary_cache: KAPALI (SUMMARY_CACHE_ACIK=false) — her kosu sifirdan'),
           { data: null, error: null })
        : await serviceClient
          .from('summary_cache')
          .select('card, cache_key')
          .in('cache_key', anahtarlar)
      const cached = anahtarlar
        .map(k => (Array.isArray(cachedRows) ? cachedRows.find((r: any) => r?.cache_key === k) : null))
        .find((r: any) => r?.card) || null

      /* 'GECICI' KISMI KART SURESIZ SERVIS EDILIYORDU (28.10.2026 olcumu).
       *
       * Gemini kesintisinde kart Groq yedek yolundan cikiyor ve ':k' satirina
       * yaziliyor — TAM O YUZDEN: devre kapaninca ayni belge Gemini'yle
       * yeniden denenebilsin (bkz. kismiKayitSebebi, onbellegeYazilabilir).
       * Ama ARAMA tarafinda boyle bir kontrol yoktu: ':k' satiri bulundugu
       * surece sonsuza kadar servis ediliyordu, yani "yeniden denenebilsin"
       * vaadi hic islemiyordu.
       *
       * OLCULDU: 28.10.2026 18:37'de Gemini 4 modelde de 503 verdi, kart
       * Groq'tan tam cikti (2/2 pencere, 24 kavram) ve KISMI/'gecici'
       * yazildi. 15:50 ve 16:01'deki iki yuklemede ayni kart 1.489 ms ve
       * 2.325 ms'de onbellekten dondu. documentId her seferinde farkliydi —
       * cache anahtari dosyanin sha256'si oldugu icin YENIDEN YUKLEMEK kacis
       * degil. Ogrenci "yeniden ozetle" dugmesini bilmiyorsa zayif karti
       * kalici sanıyor.
       *
       * Artik: isabet 'gecici' sebepli KISMI satirsa VE Gemini su an gercekten
       * kullanilabilirse (anahtar var, mod parallel degil, devre KAPALI)
       * onbellek ISKA sayilir ve tam kosu yapilir.
       *
       * KENDI KENDINI SINIRLIYOR: Gemini hala dusukse devre ACIK olur, kosul
       * saglanmaz, kart yine aninda doner — yani bu dal kesinti suresince
       * hicbir ek maliyet getirmiyor. Devre kapandiginda bir kez tam kosu
       * yapilir; basarili olursa TAM satir yazilir ve ':k' bir daha hic
       * secilmez (tam anahtarlar listede ONCE geliyor).
       *
       * 'eksik' sebepli kismi kartlar bu daldan ETKILENMIYOR: oradaki boslugu
       * (dusen pencere, yarim kurtarilan taslak) Gemini'nin donmesi
       * duzeltmez. */
      let geciciIskasi = ''
      if (cached?.card && String((cached as any)?.cache_key || '').endsWith(CACHE_KISMI_EKI)
          && (cached.card as any)?.quality_meta?.cache_kismi === 'gecici') {
        const geminiAnahtarVar = !!Deno.env.get('GEMINI_API_KEY')
        const kacisModu = geminiMode()
        if (geminiAnahtarVar && kacisModu !== 'parallel') {
          const devreSimdi = await geminiDevreOku(serviceClient)
          if (!devreSimdi || !devreSimdi.acik) {
            geciciIskasi = `mod=${kacisModu}, devre kapali`
          } else {
            console.log(
              `summary_cache: KISMI/'gecici' isabet SERVIS EDILIYOR — Gemini devresi ` +
              `hala acik (${devreSimdi.kalanDk} dk), yeniden denemek bos gider`
            )
          }
        }
      }
      if (geciciIskasi) {
        console.log(
          `summary_cache: KISMI/'gecici' isabet ATLANDI (${geciciIskasi}) — ` +
          `kart Gemini'siz uretilmisti, tam kosu yapiliyor`
        )
      }

      if (cacheErr) {
        console.warn(`summary_cache okunamadi (${cacheErr.message}) — cache atlandi`)
      } else if (cached?.card && !geciciIskasi) {
        const cachedPayload: Record<string, unknown> = {
          ...cached.card,
          document_id: documentId,
          user_id: document.user_id,
          course_tag: document.course_tag ?? null
        }
        /* OCR metni yalnizca onbellek satirina ait — bkz. onbellektenOcrMetni.
           study_cards'ta boyle bir kolon yok, insert'ten once siliniyor. */
        delete (cachedPayload as any)._ocr_metin
        let hit = await serviceClient.from('study_cards').insert(cachedPayload).select('id').single()
        if (hit.error && /quality_meta/i.test(String(hit.error.message || hit.error.details || ''))) {
          delete cachedPayload.quality_meta
          hit = await serviceClient.from('study_cards').insert(cachedPayload).select('id').single()
        }
        if (hit.error) {
          console.warn(`Cache isabeti kaydedilemedi (${hit.error.message}) — normal akisa devam`)
        } else {
          await serviceClient
            .from('documents')
            .update({ status: 'summarized', processing_stage: null })
            .eq('id', documentId)
          /* ISABET EDEN satir dokunulur: yedek isabette yanlis anahtari
             tazelemek o satiri soguma listesinde birakirdi. */
          const isabetKey = String((cached as any)?.cache_key || summaryCacheKey)
          await bestEffortRpc(serviceClient, 'touch_summary_cache', { p_key: isabetKey })
          await bestEffortRpc(serviceClient, 'record_summary_usage', { p_user: document.user_id, p_pages: 0, p_cache_hit: true })
          /* Hangi anahtarin isabet ettigi loga giriyor: metin anahtarinin
             gercekten is gorup gormedigi ancak boyle olculur. */
          const kismiIsabet = isabetKey.endsWith(CACHE_KISMI_EKI)
          const kokKey = kismiIsabet ? isabetKey.slice(0, -CACHE_KISMI_EKI.length) : isabetKey
          const isabetTuru = (kokKey === metinCacheKey ? 'METIN'
            : kokKey === yedekDosyaKey ? 'DOSYA/GORSEL-YEDEK'
            : kokKey === yedekMetinKey ? 'METIN/GORSEL-YEDEK'
            : 'DOSYA') + (kismiIsabet ? '/KISMI' : '')
          console.log(
            `CACHE ISABETI [${isabetTuru}]: ${isabetKey.slice(0, 18)}… ` +
            `— ${Date.now() - requestStartedAt}ms, model cagrisi yok`
          )
          return new Response(JSON.stringify({ success: true, studyCardId: hit.data.id, cached: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }
    } catch (cacheEx) {
      console.warn('summary_cache: beklenmeyen hata, atlandi:', cacheEx)
    }

    {
      if (quota) {
        const isTr = lang === 'tr'
        let quotaError: string | null = null
        if (billablePages > quota.max_pages_per_doc) {
          quotaError = isTr
            ? `Bu belge ${billablePages} sayfa. ${quota.plan === 'premium' ? 'Premium' : 'Lite'} planında belge başına en fazla ${quota.max_pages_per_doc} sayfa özetlenebilir.`
            : `This document has ${billablePages} pages. The ${quota.plan} plan allows up to ${quota.max_pages_per_doc} pages per document.`
        } else if (quota.pages_used + billablePages > quota.monthly_pages) {
          const kalan = Math.max(0, quota.monthly_pages - quota.pages_used)
          quotaError = isTr
            ? `Aylık sayfa kotan doldu (${quota.pages_used}/${quota.monthly_pages}, kalan ${kalan}). Bu belge ${billablePages} sayfa.`
            : `Monthly page quota reached (${quota.pages_used}/${quota.monthly_pages}, ${kalan} left). This document has ${billablePages} pages.`
        }
        if (quotaError) {
          console.warn(`Erken cikis 403 (kota): plan=${quota.plan}, sayfa=${billablePages}, kullanilan=${quota.pages_used}/${quota.monthly_pages}`)
          await markFailed(serviceClient, documentId)
          return new Response(JSON.stringify({ error: quotaError, code: 'QUOTA_EXCEEDED' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        console.log(`Kota: plan=${quota.plan}, bu belge ${billablePages} sayfa, ay icinde ${quota.pages_used}/${quota.monthly_pages}`)
      }
    }

    // ==========================================================================
    // VISUAL-DENSITY SIGNAL (Denetim Raporu, 2026-08-31)
    // CHUNK_THRESHOLD below only ever measures character COUNT. That is the
    // right signal for deciding whether the text needs the chunked/map-reduce
    // pipeline (see the big comment above), but it is the WRONG signal for
    // deciding whether visual analysis matters — a slide-deck PDF can be
    // "long" purely because it has many slides, while each slide carries
    // almost no extractable text and most of its real content lives in
    // diagrams/frameworks/charts. Confirmed on a real 52-page lecture deck:
    // only 17,787 extractable characters total (avg 342/page — well under
    // the chunked pipeline's 56K-char ceiling), but 216 embedded images and
    // 5 pages (13%) with ZERO extractable text. Those near-blank pages are
    // exactly where whole frameworks (e.g. a closing "major developments"
    // slide) were being silently dropped, because the chunked path below
    // never ran visual analysis at all.
    // We flag that pattern here — independent of useChunkedPipeline — and
    // use it further down to (a) run one extra vision-capable pass over just
    // the near-blank pages of a chunked document, and (b) not let a chunked
    // document skip the quality/hallucination review pass purely because
    // depth !== 'deep'.
    // ==========================================================================
    const pdfPageCount = pdfPageTexts.length
    const avgCharsPerPdfPage = pdfPageCount > 0 ? extractedText.length / pdfPageCount : 0
    // 0-indexed page numbers whose extracted text is essentially empty —
    // these are the pages PDF.co should convert to images below, instead of
    // always guessing "the first 8 pages". Threshold is 150 chars, not a
    // stricter "truly blank" cutoff, on purpose: a chart/table/formula
    // exhibit page (common in quantitative courses — finance, stats,
    // accounting) often still extracts a short title or axis-label caption,
    // so a page can carry almost none of its real content in text while
    // still clearing a very strict blank check. This is meant to generalize
    // across course types, not just the image-only slide-deck case it was
    // first found on.
    const nearBlankPdfPageIndices = pdfPageTexts
      .map((t, i) => ({ i, len: t.trim().length }))
      .filter(p => p.len < 150)
      .map(p => p.i)
    const isVisuallyDenseDocument = mimeType === "application/pdf" && pdfPageCount > 0 &&
      (avgCharsPerPdfPage < 500 || (nearBlankPdfPageIndices.length / pdfPageCount) > 0.08)
    if (isVisuallyDenseDocument) {
      console.log(`Visual-density signal tripped: avgCharsPerPage=${avgCharsPerPdfPage.toFixed(0)}, nearBlankPages=${nearBlankPdfPageIndices.length}/${pdfPageCount}`)
    }

    // ==========================================================================
    // DECIDE PIPELINE: short/medium documents use the original single-pass
    // (fast, cheap, supports visual analysis); long documents route through
    // the chunked map-reduce pipeline below so nothing gets silently
    // truncated and depth scales with actual document length.
    // ==========================================================================
    const useChunkedPipeline = extractedText.length > CHUNK_THRESHOLD
    const pipelineStartedAt = Date.now()

    // Claims the vision pass contributes, normalised the way the grounding
    // gate normalises, so the gate can recognise and exempt them.
    //
    // Declared HERE, outside both pipelines, because that is where it is
    // read: the vision pass fills it inside the chunked branch, but
    // applyGroundingGate runs further down on the path both pipelines share.
    // Declaring it next to the vision pass put it out of scope at the gate
    // and threw "ReferenceError: visionGroundedClaims is not defined" after
    // ~3 minutes of completed work, losing the whole card. Stays empty when
    // the pass does not run, which is the no-op case the gate already
    // handles.
    const visionGroundedClaims = new Set<string>()

    // The same findings, kept VERBATIM for the review pass.
    //
    // visionGroundedClaims above is normalised for the grounding gate's
    // matching; review needs the readable sentences. Review is shown the
    // document's TEXT, and a figure's annotations are not in the text — they
    // are drawn inside the image. So without this, everything the vision pass
    // contributes is invisible to review, and that cuts both ways: it cannot
    // confirm a correct figure reading, and it cannot catch a wrong one.
    //
    // Measured on 05.10.2026. Figure 20.2 is annotated "World War I, Roaring
    // Twenties, The Great Depression, World War II, Korean War, Vietnam War,
    // First oil shock, Second oil shock" plus five recessions. The summary
    // reported "the Korean and Vietnam wars, and oil shocks of the 1970s and
    // 2000s" — the wars right, read off the chart, and "2000s" wrong, since
    // both labelled oil shocks are 1974 and 1980. Review had no way to tell,
    // because the only place that distinction exists is the picture.
    const visionNotes: string[] = []

    // Set when Groq reports the DAILY token cap (TPD). Declared out here, in
    // the scope both pipelines share, for the same reason visionGroundedClaims
    // is: a flag written inside the chunked branch and read outside it is a
    // ReferenceError in production that no extracted-function test can see.
    let dailyQuotaExhausted = false

    // Stages the time budget forced us to drop, recorded so the SAVED CARD can
    // say so. A long document can lose vision, the narrative writer or review
    // and still look complete — the student has no way to tell a card that got
    // the full pipeline from one that ran out of minutes. Declared out here for
    // the same scope reason as the two above.
    const skippedStages: string[] = []
    // Gemini taslagi geldiginde GEMINI_PIPELINE_BUDGET_MS'e yukseltilir;
    // Groq yolunda hic degismez.
    /* Hazirlik (indirme + metin cikarma + chunk yazimi) zaten harcandi;
       butce ondan GERIYE KALANDIR. bkz. requestStartedAt. */
    const hazirlikMs = pipelineStartedAt - requestStartedAt
    let pipelineBudgetMs = Math.max(0, PIPELINE_BUDGET_MS - hazirlikMs)
    const budgetLeft = () => Math.max(0, pipelineBudgetMs - (Date.now() - pipelineStartedAt))

    // ==========================================================================
    // AUTO DEPTH SELECTION (Denetim Raporu, 2026-08-31)
    // The simplified upload UI no longer sends `depth`/`summaryLength` — pick
    // one from the actual extracted text length so a 1-page handout and a
    // 60-page lecture pack don't both get treated as "standard". Explicit
    // depth (any caller that still sends one) always takes priority.
    // ==========================================================================
    let depth = explicitDepth
    /* TARANMIS BELGEDE textLen YANLIS OLCUDUR (28.10.2026 — olculmus).
     *
     * Esikler cikarilan metnin uzunluguna bakiyor. Taranmis bir belgede o
     * uzunluk BELGEYI degil OCR'in nerede kesildigini olcer. Olculen kosu:
     * 29 sayfalik bir tarama OCR'dan 1.230 karakter dondu -> depth=brief ->
     * skipNarrativeWriter, skipSectionDeepen VE review atlandi. Yani
     * belgenin kisa olmasi degil, okunamamis olmasi butun kalite
     * adimlarini kapatti.
     * OCR kesildiyse olcu SAYFA SAYISI. Esikler karakter esikleriyle ayni
     * yerde: ~950 krk/sayfa olculdu (loglardaki "ort. 892-1048 krk"),
     * yani 2.500 krk ~ 3 sayfa, 30.000 krk ~ 32 sayfa. */
    if (!depth && ocrKismi) {
      depth = billablePages <= 3 ? 'brief' : billablePages > 32 ? 'deep' : 'standard'
      console.log(
        `Derinlik SAYFADAN secildi: ${billablePages} sayfa -> ${depth} ` +
        `(OCR kesik, textLen=${extractedText.length} belgeyi temsil etmiyor)`
      )
    }
    if (!depth) {
      if (extractedText.length < 2500) depth = 'brief'
      else if (extractedText.length > 30000) depth = 'deep'
      else depth = 'standard'
    }
    if (depth === 'brief' && len === 'medium') len = 'short'
    if (depth === 'deep' && len !== 'detailed' && len !== 'long') len = 'detailed'
    if (depth === 'exam' && style === 'standard') style = 'exam_focused'
    const depthFlags = {
      skipSectionDeepen: depth === 'brief',
      forceSectionDeepen: depth === 'deep' || depth === 'exam',
      skipNarrativeWriter: depth === 'brief',
      longNarrative: depth === 'deep',
      examBias: depth === 'exam',
      // Very long docs: prefer selective digests in section pass
      selectiveLongDoc: depth === 'deep' || depth === 'standard'
    }
    console.log(`Madde 6 depth=${depth} (${explicitDepth ? 'explicit' : 'auto from textLen=' + extractedText.length})`, depthFlags)

    // Fast-path truncation (unchanged behavior) — only ever applies when NOT chunking
    let textToSend = extractedText
    if (!useChunkedPipeline && textToSend.length > 40000) {
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
    // Paralel modda Groq'a hic cagri gitmez (bkz. groqViaGemini); anahtar
    // yoksa bos string yeter.
    const groqApiKey = Deno.env.get('GROQ_API_KEY') || (geminiParallelActive() ? '' : undefined)
    if (groqApiKey === undefined) {
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

    // Part B: Length instruction — now adaptive to actual document length (see
    // computeAdaptiveTargets above). A baseline-sized document gets the same
    // numbers as before; longer documents get proportionally more, up to a cap.
    const adaptiveTargets = computeAdaptiveTargets(useChunkedPipeline ? extractedText.length : textToSend.length, len)
    const lengthInstruction = buildLengthInstruction(adaptiveTargets, len)

    const langLabel = lang === 'tr' ? 'Turkish / Türkçe' : 'English'

    // Part A: System prompt with document type classification & type specific guidance
    const systemPrompt = `You are an academic study assistant. You will be given the raw text extracted from a student's uploaded document. Analyze it and respond with ONLY a valid JSON object, no markdown code fences, no commentary before or after — just the raw JSON object matching this exact shape: { "summary": string, "summary_executive": string, "key_terms": [ { "term": string, "definition": string } ], "key_points": [ string ], "quiz_questions": [ { "question": string, "answer": string } ], "document_type": string, "tables": [ { "title": string, "headers": [ string ], "rows": [ [ string ] ] } ], "charts": [ { "title": string, "type": string, "labels": [ string ], "data": [ number ] } ], "footnotes": [ { "id": number, "reference": string, "page": number | null } ], "outline": { "document_title_guess": string, "items": [ { "id": string, "heading": string, "blurb": string, "level": number, "order": number, "parent_id": string | null } ] }, "sections": [ { "heading": string, "summary": string, "key_points": [ string ], "outline_id": string | null } ], "suggested_course_tag": string | null, "is_quantitative": boolean, "formulas": [ { "name": string, "latex": string, "variables": [ { "symbol": string, "meaning": string } ] } ], "worked_examples": [ { "title": string, "problem_statement": string, "steps": [ string ], "final_answer": string } ], "diagrams": [ { "title": string, "mermaid": string, "description": string } ], "concept_graph": { "nodes": [ { "id": string, "label": string, "type": string } ], "edges": [ { "from": string, "to": string, "relation": string } ] }, "cloze_cards": [ { "id": string, "prompt": string, "answer": string, "full_text": string } ] }.

EXECUTIVE SUMMARY:
Write "summary_executive" as a 2-3 sentence ultra-short overview — what a student would say if asked "what is this document about in 30 seconds?". No bullet lists.

OUTLINE ENGINE (document skeleton):
Always produce "outline": { "document_title_guess": "...", "items": [ { "id": "o1", "heading": "short label", "blurb": "one sentence role of this part", "level": 1 or 2, "order": 1, "parent_id": null } ] }.
- 3-12 items in document order; level 1 = major parts, level 2 = sub-topics
- Prefer real structure (intro, theory, methods, cases, conclusion…)
- Never admin-only items (grading, attendance, textbook edition)
- Even for a single-topic document, return 2-3 coarse outline items (not empty)

SECTION PASS (deep per-topic summaries):
Also produce "sections" aligned with outline level-1 items. Each:
{ "heading": "...", "summary": "4-8 sentence DEEP academic summary of ONLY this topic — coherent prose, explain arguments and definitions", "key_points": ["3-6 takeaways for this section"], "outline_id": "o1" }
- summary must be deeper than outline.blurb; do not paste the global summary into every section
- Skip admin-only topics

CONCEPT GRAPH:
Extract the main academic concepts and how they relate. Output concept_graph with:
- nodes: [{ "id": "c1", "label": "Concept Name", "type": "concept" }] (5-15 nodes, short labels)
- edges: [{ "from": "c1", "to": "c2", "relation": "includes"|"is_a"|"causes"|"part_of"|"related_to"|"depends_on"|"contrasts_with" }]
Only real relationships from the text. Empty graph if the material has almost no conceptual structure.

CLOZE CARDS (fill-in-the-blank):
Create 5-12 cloze cards for spaced-repetition study. Each: { "id": "cl1", "prompt": "sentence with ___ blank", "answer": "the hidden word or short phrase", "full_text": "complete sentence" }. Blank the most exam-relevant term or phrase. Prefer one blank per card. Keep answers short (1-5 words).

QUANTITATIVE COURSE DETECTION & ADAPTATION:
Determine whether this document is primarily QUANTITATIVE in nature — meaning it centers on mathematical formulas, numerical calculations, statistical methods, or financial/accounting computations (e.g. Calculus, Statistics, Financial Management, Investment Analysis, Accounting, Economics with heavy math) — as opposed to conceptual/qualitative material (e.g. Marketing, Management theory, general business discussion). Put this boolean classification in the 'is_quantitative' JSON field (true or false).
When 'is_quantitative' is true: shift your summarization approach to prioritize extracting formulas and worked examples thoroughly, keeping the narrative summary comparatively brief and high-level in favor of these structured practical elements — since for quantitative material, the formulas and worked examples ARE the primary study content.

FORMULA EXTRACTION:
Identify every distinct formula/equation presented (especially when is_quantitative is true, but also extract any clear formulas even in mixed documents). For each, output an object in the 'formulas' array: { "name": "short descriptive name, e.g. 'Compound Interest Formula'", "latex": "raw LaTeX ONLY — no surrounding $ or \\( \\) delimiters, e.g. 'A = P(1 + r/n)^{nt}' or '\\\\frac{a}{b}' or '\\\\sum_{i=1}^{n} x_i'", "variables": [ { "symbol": "e.g. P", "meaning": "e.g. Principal amount (initial investment)" } ] }. Return an empty array [] if the document has no formulas.

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

STRUCTURAL SECTIONS INSTRUCTION (hierarchical outline):
In addition to the single overall "summary", break the document down into 2-6 major topic-based SECTIONS — but ONLY if it genuinely covers that many distinct topics (e.g. a lecture covering "Tanımlar", "4P Karışımı", "Pazar Bölümlendirme" would get 3 sections, each in the order the topics appear). For each section output an object in the 'sections' array: { "heading": "short 2-5 word topic label", "summary": "2-4 sentence blurb covering just that section's academic content — footnote markers [n] allowed and encouraged where applicable" }. This lets a student jump straight to the topic they need instead of reading one long undifferentiated summary — like a table of contents with a preview under each entry.
If the document covers only ONE continuous topic, or is too short/simple to meaningfully split (a short handout, a single-topic one-pager), return an empty array — do not force sections onto material that doesn't naturally have them. Sections must still obey the EXAM-FOCUSED CONTENT FILTERING rule below — never create a section purely about course administration/logistics.

TABULAR AND CHART DATA EXTRACTION:
In addition to the summary, key terms, key points, and quiz questions, also identify any TABULAR DATA (rows/columns of related figures, comparisons, structured lists of data) and any CHART-WORTHY DATA (numeric comparisons, percentages, breakdowns, trends that would be clearly shown as a bar/pie/line chart) present in the source material. If visual analysis was used and chart/graph images were shown to you, extract the ACTUAL data values from those images for this purpose. Include this as two new JSON fields:
- 'tables': an array of objects, each { "title": string, "headers": [string, ...], "rows": [[string, ...], ...] } — one object per distinct table found. Return an empty array if no clear tabular data exists.
- 'charts': an array of objects, each { "title": string, "type": "bar" | "pie" | "line", "labels": [string, ...], "data": [number, ...] } — one object per distinct chart-worthy dataset found (pick the most fitting chart type for the data — proportions/percentages of a whole → 'pie', comparisons across categories → 'bar', progression over time → 'line'). Return an empty array if no clear chart-worthy data exists.
Do NOT fabricate tables/charts if the source doesn't actually contain this kind of data — empty arrays are the correct output for purely narrative/text documents.

INLINE FOOTNOTES / SOURCE REFERENCES INSTRUCTION:
For non-obvious or specific factual claims in the summary and key_points, add a footnote marker like [1], [2], etc. immediately after the claim. Build a corresponding 'footnotes' array in your JSON output: [{ "id": 1, "reference": "brief description of which section/topic of the source this relates to, e.g. 'Section 2.2 - SEO discussion' or 'Introduction section'", "page": number | null }]. ${buildFootnotePageInstruction(hasPageMarkers, pageMarkerLabel)} Don't over-footnote — reserve markers for specific, checkable claims (numbers, definitions, named findings), not every sentence.

SUGGESTED COURSE TAG INSTRUCTION:
Below is this student's OFFICIAL course catalog (format: CODE — Course Name):
${courseCatalogBlock}

Compare the document's content, terminology, and subject matter against this catalog. If it clearly corresponds to one of these listed courses, return that course's EXACT code (copied character-for-character, e.g. 'BUS330') as 'suggested_course_tag' — do not alter, reformat, or add spaces to it. Only if the content doesn't match any listed course, but a course code or clear subject label is otherwise evident directly in the source text, fall back to that as a short free-text string instead. If genuinely unclear and nothing in the catalog fits, return null. Never invent a course code that is neither in the catalog above nor explicitly present in the source text.

LENGTH INSTRUCTION:
${lengthInstruction}

ACCURACY INSTRUCTION:
Base your summary, key terms, key points, and quiz questions STRICTLY on content actually present in the provided text. Do not invent, assume, or add information not found in the source material. If a section of the document is unclear or incomplete, reflect that faithfully rather than filling gaps with assumptions. Copy any specific numbers, formulas, names, or technical terms EXACTLY as they appear in the source — do not paraphrase or alter precise factual details.

LANGUAGE INSTRUCTION:
Respond strictly in the language: '${langLabel}'. Write the ENTIRE response (the summary, all key_terms terms and definitions, all key_points, all quiz_questions, and the document_type) in that specified language (the returned value of "document_type" must be one of the specified English strings: "Lecture Notes/Slides", "Academic Article", "Syllabus", "Case Study", "Textbook Chapter", or "Other").

EXAM-FOCUSED CONTENT FILTERING (applies regardless of style, and is NOT optional):
Before writing anything, separate the source into (a) actual academic subject matter — concepts, definitions, theories, frameworks/models (e.g. "the 4Ps"), processes, relationships, formulas, examples, case findings, named studies — and (b) course administration/logistics — grading weights or percentages, exam format/rules (open/closed book, question types), attendance/absence policy, late-submission or bonus-point policy, grade-appeal/itiraz procedures and deadlines, office hours, contact info, syllabus housekeeping, textbook title/edition/ISBN.
ONLY (a) belongs anywhere in your output — summary, key_points, footnotes, and quiz_questions. COMPLETELY EXCLUDE (b): do not summarize it, do not footnote it, and never turn it into a quiz_question — a student is never tested on how many percentage points the midterm is worth, how to appeal a grade, or which textbook edition is assigned, no matter how specific or "checkable" those numbers are.
If a document is mostly or entirely administrative logistics (e.g. a course intro/syllabus slide with little real subject matter), it is completely correct — and REQUIRED — to produce a short summary and few or even zero key_points/quiz_questions. Never pad the output with excluded (b) content just to reach a target count; a short, honest summary is far better than a long one padded with grading/attendance/appeal trivia.

DIAGRAMS (Mermaid reconstruction) & VISUAL-STRUCTURE AWARENESS:
You are only given extracted text — visual layout (boxes, arrows, side-by-side positioning) is lost in extraction. A flowchart, comparison diagram, process illustration, hierarchy or cycle often survives only as a cluster of short disconnected phrases, sequential stage names, or paired opposing terms. When you detect such a structure:
1. RECONSTRUCT it as a real Mermaid diagram and put it in the "diagrams" array: { "title": "short descriptive title", "mermaid": "valid Mermaid source (prefer flowchart TD / flowchart LR / graph TD / sequenceDiagram / mindmap)", "description": "1-2 sentence plain-language explanation of what the diagram shows" }. Keep Mermaid syntax simple and valid. Limit to the 2-4 most important diagrams in the whole document.
2. Also add ONE key_point reconstructing the same idea, clearly prefixed with "Diyagram/Görsel:" (or "Diagram/Visual:" if responding in English) so the student knows it is an interpretation of a visual element — e.g. "Diyagram: 'Satış kavramı' (ürün/satış odaklı) ile 'Pazarlama kavramı' (müşteri ihtiyaç odaklı) karşılaştırılıyor."
Only do this when fragments genuinely look diagram-like — never invent diagrams that have no basis in the text. Return empty "diagrams" array when nothing is reconstructible.

CODE SNIPPETS & DATA PREVIEWS INSTRUCTION:
If the source material includes programming code snippets (e.g. Python, R, SQL used for data analysis), do not ignore them — briefly describe WHAT METHODOLOGY STEP each code block represents in the summary/key_points (e.g. 'the analysis loads and cleans the dataset, then engineers features including a lagged return and rolling volatility measure' rather than omitting this entirely). Do not attempt to reproduce the code verbatim in the summary, just describe its purpose and role in the overall analysis. If a code block's output shows a small data preview (a few rows of a dataframe), treat that as a legitimate table for the 'tables' field.

PROFESSIONAL TONE INSTRUCTION:
Write in a clear, formal academic register. Avoid filler phrases, redundant restatements, and vague generalities. Use precise terminology appropriate to the subject matter.

STYLE-SPECIFIC INSTRUCTION:
${styleInstruction}`

    let rawContent = ""
    let sourceTextForReview = ""
    // Dusen pencere varsa karta yazilir: ogrenci ozetin eksik oldugunu
    // bilmeli, ve iki kosu loglar gittikten sonra da karsilastirilabilmeli.
    let eksikPencereler: { dusen: number; toplam: number; kayipKrk: number } | null = null
    /* Kart kesilen bir Gemini akisindan KURTARILDIysa kurtarilan karakter
       sayisi. Sifir degilse kart tam degil: rozet yaziliyor ve onbellege
       ALINMIYOR (bkz. summary_cache yazimi). */
    let geminiKismiKrk = 0
    /* Gemini GECICI hatalar yuzunden hic taslak uretemediyse true. Cikan
       kart Groq yedek yolundan geliyor; tam olabilir ama ISTENEN kart
       degil. Olculdu (21.10.2026, ayni 42 sayfalik deste):

         Gemini yolu : kapsama %72-77, citation anchoring kept=30 / kept=15
         Groq yedegi : kapsama %56,   citation anchoring kept=0

       Onbellege yazilirsa o dosya icin KALICI cevap bu olur ve Gemini bir
       daha hic denenmez — yuzeyin bir dakikalik yogunlugu kalici kalite
       kaybina doner. Bkz. summary_cache yazimi. */
    const geminiTani: { geciciDustu?: boolean; hepsiDustu?: boolean; kota429?: boolean } = {}
    /* Yogunluk kapisinin OLCUM modundaki bulgusu; kapi eledigi gun bu
       alan karari degil gecmisi tutacak. */
    let yogunlukOlcumu: { dropped: number; toplam: number; ornekler: string[] } | null = null
    let visualAnalysisUsed = false

    // ==========================================================================
    // GEMINI GOLGE YOLU — secim noktasi (bkz. dosyanin ustundeki blok)
    //
    // Bu `if` disinda Groq yolunun hicbir satiri degismedi. Anahtar yoksa ya
    // da burasi null dondurursek asagidaki iki pipeline eskisi gibi calisir.
    // ==========================================================================
    let draftEngine: 'groq' | 'gemini' = 'groq'
    let geminiMeta: Record<string, unknown> | null = null
    let geminiResult: { raw: string; model: string; ms: number; usage: any; kismi?: boolean } | null = null
    // only modunda Gemini DENENDI ve BASARISIZ oldu mu? Oyleyse Groq'a
    // dusulmez; belge 'failed' isaretlenir (bkz. geminiMode).
    let geminiOnlyBasarisiz = false

    {
      const mod = geminiMode()
      /* KAPI, GEMINI'NIN GERCEKTEN KOSACAGI BUTCEYE BAKMALI (24.10.2026).
       *
       * Asagidaki atlama kapisi `budgetLeft()` okuyordu, ama o fonksiyon
       * `pipelineBudgetMs`'e bagli ve orasi Gemini kolu secilene kadar hala
       * GROQ butcesi (PIPELINE_BUDGET_MS = 110 sn eksi hazirlik). Gemini'nin
       * kendi butcesi (only modunda GEMINI_ONLY_BUDGET_MS = 145 sn) ancak
       * kapi GECILDIKTEN sonra, birkac satir asagida kuruluyordu.
       *
       * Sonucu: hazirligi uzun bir belgede (OCR'li 42 sayfalik deste,
       * hazirlik ~58 sn) kapi `52.000 < 55.000` diye Gemini'yi atliyordu —
       * oysa only modunda o belgeye `145.000 - 58.000 = 87.000 ms` kalacakti,
       * yani tam bir cagriya rahat yetiyordu. Belge sessizce Groq yoluna
       * dusuyor ve (geciciDustu bayragi da set edilmediginden) o zayif kart
       * onbellege KALICI yaziliyordu.
       *
       * Ayni ifade hem kapida hem genisletmede kullanilsin diye tek yerden
       * okunuyor; ikisi ayrisirsa kapi yine yanlis butceye bakar. */
      const geminiModButcesi = () => Math.max(0,
        (mod === 'only' ? GEMINI_ONLY_BUDGET_MS : GEMINI_PIPELINE_BUDGET_MS) - hazirlikMs)
      const geminiModKalan = () => Math.max(0,
        geminiModButcesi() - (Date.now() - pipelineStartedAt))
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
      const geminiMime = geminiNativeMime(mimeType)
      const devre = (geminiApiKey && mod !== 'parallel') ? await geminiDevreOku(serviceClient) : null
      if (!geminiApiKey) {
        // Tek satir, her kosuda: hangi yolun calistigi loglardan belli olsun.
        console.log('Gemini: GEMINI_API_KEY yok — Groq yolu')
      } else if (mod === 'parallel') {
        // Tek-cagri yolu atlanir; asagidaki hat calisir ve LLM cagrilari
        // groqViaGemini uzerinden Gemini'ye gider.
        console.log(
          `Gemini: mod=parallel — tum-PDF cagrisi yok, hat paralel pencerelerle ` +
          `(${useChunkedPipeline ? 'uzun belge' : 'kisa belge'}) Gemini'de kosacak`
        )
      } else if (devre && devre.acik) {
        /* Devre kesici — bkz. GEMINI_DEVRE_MS. Bu kart Gemini'siz uretildi;
           onbellege KALICI yazilmasin ki devre kapaninca ayni belge Gemini'yle
           yeniden denenebilsin (geciciDustu ayni korumayi kullaniyor). */
        geminiTani.geciciDustu = true
        console.log(`Gemini: devre kesici ACIK (${devre.kalanDk} dk daha; ${devre.neden || 'olu akis'}) — denenmiyor, dogrudan Groq yolu`)
      } else if (!geminiMime) {
        console.log(`Gemini: atlandi (mime=${mimeType || '(yok)'}, gölge yol yalnizca PDF)`)
      } else if (fileBytes.byteLength > GEMINI_INLINE_MAX_BYTES) {
        console.log(`Gemini: atlandi (dosya ${Math.round(fileBytes.byteLength / 1024 / 1024)} MB > ${GEMINI_INLINE_MAX_BYTES / 1024 / 1024} MB)`)
      } else if (pdfPageCount > GEMINI_MAX_PAGES) {
        console.log(`Gemini: atlandi (${pdfPageCount} sayfa > ${GEMINI_MAX_PAGES})`)
      } else if (geminiModKalan() < GEMINI_MIN_BUDGET_MS) {
        // Groq butcesi degil, Gemini'nin KENDI butcesi — bkz. geminiModButcesi.
        console.log(
          `Gemini: atlandi (mod=${mod} butcesinden ${geminiModKalan()}ms kaldi ` +
          `< ${GEMINI_MIN_BUDGET_MS}ms, hazirlik ${hazirlikMs}ms)`
        )
      } else {
        /* Butce, cagridan SONRA degil ONCE genisletiliyor; Gemini hic
           DENENMEDIGINDE 110 saniyede kalir.
           only modunda butun butce Gemini'nin (Groq cagrilmayacak),
           shadow modunda Groq'a 62 saniye saklanir. */
        // Kapiyla AYNI ifade — bkz. geminiModButcesi.
        pipelineBudgetMs = geminiModButcesi()
        if (hazirlikMs > 5_000) {
          console.log(`Butce: hazirlik ${hazirlikMs}ms dusuldu, kalan butce ${pipelineBudgetMs}ms`)
        }

        await serviceClient
          .from('documents')
          .update({ processing_stage: 'analyzing' })
          .eq('id', documentId)

        const geminiSystemPrompt = systemPrompt
          + buildGeminiDocInstruction(pageMarkerLabel, pdfPageCount)
          + geminiCoverageQuota(pdfPageCount)
        // Cikarilan metin de gonderiliyor: Gemini'nin okudugu sayfa ile bizim
        // asagida kapilarda/atiflarda kullandigimiz metin ayni belgeden gelse
        // de AYNI SEY DEGIL. Model ikisini yan yana gorursa, metinde zaten
        // bulunan bir terimi metindeki yazimiyla yazar ve grounding kapisi
        // ile anchorCitations onu bulabilir.
        const geminiUserText =
          `Here is the text our extractor pulled out of the same document — it is lossy ` +
          `(equations, spreadsheet screenshots and charts are missing from it), and it is ` +
          `shown only so you can match your wording to it where the two overlap:\n\n` +
          // 120.000 degil 40.000: hesabin TPM'i 100K ve bu metin PDF'in
          // kendisiyle BIRLIKTE gidiyor, yani ayni bilginin ikinci kopyasi.
          // 42 sayfa ~10.800 token tutuyor; 120.000 karakter buna ~35.000
          // token daha ekliyordu. 40.000 karakter (~12.000 token) eslestirme
          // faydasini korurken dakikada kac kosu sigacagini ikiye katliyor.
          extractedText.slice(0, 40_000)

        geminiResult = await geminiDraft(
          geminiApiKey,
          geminiSystemPrompt,
          fileBytes,
          geminiMime,
          geminiUserText,
          budgetLeft(),
          mod,
          geminiTani
        )

        /* TASLAK GECERLI MI? (17.10.2026)
         *
         * Eskiden bu kontrol yoktu: bozuk bir Gemini taslagi 1900 satir
         * asagiya kadar tasiniyordu. Review KOSARSA zararsiz, cunku
         * rawFinalContent review ciktisindan geliyor ve bozuk metin
         * degistiriliyor. Ama review ATLANDIGINDA — yani tam da Gemini'nin
         * yavas oldugu, butcenin daraldigi kosularda — ayni metin tekrar
         * JSON.parse ediliyor, orada patliyor ve ogrenci 500 goruyor.
         * O noktada Groq'a dusmek icin gereken zaman coktan yanmis oluyor.
         *
         * Artik taslak daha DOGARKEN dogrulanıyor: ayristirilamiyorsa yok
         * sayiliyor ve asagidaki normal butce kurali isliyor — Groq yolu
         * payini aliyor, ogrenci yarim da olsa bir kart aliyor. */
        if (geminiResult) {
          try {
            JSON.parse(repairLatexEscapes(geminiResult.raw.replace(/```json\s*|```/g, '').trim()))
          } catch (_bozuk) {
            console.warn(
              `Gemini taslagi JSON olarak ayristirilamadi (${geminiResult.raw.length} karakter) — ` +
              `taslak yok sayiliyor, normal yedek yolu isleyecek`
            )
            geminiResult = null
          }
        }

        /* Kurtarilmis taslak: kart uretilecek ama TAM DEGIL. Sessizce
           tam bir kart gibi gostermek, 17.10'da missing_windows rozetinin
           eklenme sebebiyle ayni hata olurdu — ogrenci eksigi fark
           edemiyor, biz de geri bildirim alamiyoruz. */
        if (geminiResult && geminiResult.kismi) {
          geminiKismiKrk = geminiResult.raw.length
          console.warn(
            `Gemini taslagi KISMI (kurtarilan ${geminiKismiKrk} karakter) — ` +
            `kart uretilecek, rozet yazilacak ve onbellege alinmayacak`
          )
        }

        /* Kota once bakilir: tek 429 yeter ve suresi daha uzun
           (bkz. GEMINI_KOTA_DEVRE_MS). hepsiDustu'yu beklemek, oteki
           adaylari ayni limite carptirmak demekti. Ikinci dal eskisi gibi:
           yalnizca BUTUN modeller dustuyse (bkz. GEMINI_DEVRE_MS). */
        if (!geminiResult && geminiTani.kota429) {
          await geminiDevreAc(serviceClient, 'Gemini kota limiti (429)', GEMINI_KOTA_DEVRE_MS)
        } else if (!geminiResult && geminiTani.hepsiDustu) {
          await geminiDevreAc(serviceClient, 'butun Gemini modelleri kota/gecici hata')
        }

        if (!geminiResult && mod === 'only') {
          /* Hizli basarisizlikta Groq'a duselim, yavasinda duselmeyelim —
             bkz. GEMINI_ONLY_FALLBACK_MIN_MS. Esik butceden olculuyor,
             sureden degil: ikisi ayni sey ama butce okumasi kosu icinde
             nerede oldugumuzu dogru gosteriyor. */
          const kalan = budgetLeft()
          if (kalan >= GEMINI_ONLY_FALLBACK_MIN_MS) {
            /* "hizli basarisizlik" DEMIYOR (10.10.2026 17:59 dersi): esik
               100 sn'den 32 sn'ye indikten sonra bu dal yavas hatalarda da
               calisiyor ve o metin okuyani yaniltiyordu — 105 saniyelik
               bir zaman asimina "hizli" diyen bir log, bir dahaki sefere
               yanlis yerde hata aratir. Log ne olduğunu yazsin. */
            console.warn(
              `Gemini (mod=only): taslak uretilemedi, ${kalan}ms butce kaldi ` +
              `(esik ${GEMINI_ONLY_FALLBACK_MIN_MS}ms) — Groq yoluna dusuluyor`
            )
          } else {
            geminiOnlyBasarisiz = true
            console.error(
              `Gemini (mod=only): taslak uretilemedi ve yalnizca ${kalan}ms kaldi ` +
              `(esik ${GEMINI_ONLY_FALLBACK_MIN_MS}ms) — Groq'un tam kosusuna yer yok, ` +
              `belge basarisiz isaretleniyor`
            )
          }
        }
      }
    }

    if (geminiOnlyBasarisiz) {
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({
        error: 'Özet motoru şu anda yanıt vermedi — birkaç dakika sonra tekrar deneyin'
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (geminiResult) {
      draftEngine = 'gemini'
      rawContent = geminiResult.raw.replace(/```json\s*|```/g, '').trim()

      // Gorselden gelen bulgular. Ikisi de asagida paylasilan yolda okunuyor:
      // visionNotes review'a KAYNAK olarak gider, visionGroundedClaims ise
      // grounding kapisina muafiyet olur. Ikisi de olmazsa, Gemini'nin tek
      // kattigi deger — resimden okunan formul ve tablo — metin tabanli kapi
      // tarafindan "uydurma" diye silinir.
      let geminiParsed: any = null
      try {
        geminiParsed = JSON.parse(repairLatexEscapes(rawContent))
      } catch (_parseErr) {
        // Taslak bozuksa asagidaki ortak yol zaten kendi hatasini verecek;
        // burada sadece not cikarimi atlanir.
        geminiParsed = null
      }
      const notes = geminiFigureNotes(geminiParsed)
      for (const n of notes) {
        visionNotes.push(n)
        const norm = gateNormalize(n)
        if (norm) visionGroundedClaims.add(norm)
      }
      if (notes.length > 0) visualAnalysisUsed = true

      sourceTextForReview = extractedText.length > 6000
        ? extractedText.substring(0, 6000) + ' [truncated for review]'
        : extractedText

      geminiMeta = {
        model: geminiResult.model,
        ms: geminiResult.ms,
        chars: rawContent.length,
        figure_notes: notes.length,
        pages: pdfPageCount || null,
        usage: geminiResult.usage ?? null
      }
      console.log(
        `GOLGE YOL: taslak Gemini'den (model=${geminiResult.model}, ${geminiResult.ms}ms, ` +
        `${pdfPageCount || '?'} sayfa, ${notes.length} gorsel bulgu, ` +
        `chunked_olacakti=${useChunkedPipeline}) — Groq yolu hic calismadi`
      )
    } else if (!useChunkedPipeline) {
      // ========================================================================
      // FAST PATH (unchanged): short/medium documents — single Groq call,
      // optional visual (image) analysis pass.
      // ========================================================================
      const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      const isPptx = mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      const isPdf = mimeType === "application/pdf"

      const runVisuals = !!analyzeVisuals && (isPdf || isPptx || isDocx)
      let base64Images: string[] = []

      if (runVisuals) {
        if (isDocx) {
          try {
            console.log("DOCX Visual analysis enabled. Extracting embedded media images from word/media/...")
            const zip = new JSZip()
            await zip.loadAsync(fileBytes)

            const mediaFiles = Object.keys(zip.files).filter(name =>
              name.startsWith("word/media/") && /\.(png|jpe?g|webp|gif|bmp)$/i.test(name)
            )

            mediaFiles.sort((a, b) => {
              const numA = parseInt(a.replace(/[^0-9]/g, ""), 10) || 0
              const numB = parseInt(b.replace(/[^0-9]/g, ""), 10) || 0
              return numA !== numB ? numA - numB : a.localeCompare(b)
            })

            const cappedMediaFiles = mediaFiles.slice(0, 8)
            console.log(`Found ${mediaFiles.length} media files in DOCX. Processing top ${cappedMediaFiles.length}...`)

            for (const mediaPath of cappedMediaFiles) {
              try {
                const imgBytes = await zip.files[mediaPath].async("uint8array")
                if (imgBytes && imgBytes.byteLength > 0) {
                  base64Images.push(bytesToBase64(imgBytes))
                }
              } catch (mediaErr) {
                console.error(`Failed to extract DOCX media image ${mediaPath}:`, mediaErr)
              }
            }

            if (base64Images.length > 0) {
              visualAnalysisUsed = true
              console.log(`Successfully prepared ${base64Images.length} DOCX media images for vision-based analysis.`)
            }
          } catch (docxVisionErr) {
            console.error("DOCX media image extraction failed:", docxVisionErr)
          }
        } else if (isPptx) {
          try {
            console.log("PPTX Visual analysis enabled. Extracting embedded media images from ppt/media/...")
            const zip = new JSZip()
            await zip.loadAsync(fileBytes)

            const mediaFiles = Object.keys(zip.files).filter(name =>
              name.startsWith("ppt/media/") && /\.(png|jpe?g|webp|gif|bmp)$/i.test(name)
            )

            mediaFiles.sort((a, b) => {
              const numA = parseInt(a.replace(/[^0-9]/g, ""), 10) || 0
              const numB = parseInt(b.replace(/[^0-9]/g, ""), 10) || 0
              return numA !== numB ? numA - numB : a.localeCompare(b)
            })

            const cappedMediaFiles = mediaFiles.slice(0, 8)
            console.log(`Found ${mediaFiles.length} media files in PPTX. Processing top ${cappedMediaFiles.length}...`)

            for (const mediaPath of cappedMediaFiles) {
              try {
                const imgBytes = await zip.files[mediaPath].async("uint8array")
                if (imgBytes && imgBytes.byteLength > 0) {
                  base64Images.push(bytesToBase64(imgBytes))
                }
              } catch (mediaErr) {
                console.error(`Failed to extract media image ${mediaPath}:`, mediaErr)
              }
            }

            if (base64Images.length > 0) {
              visualAnalysisUsed = true
              console.log(`Successfully prepared ${base64Images.length} PPTX media images for vision-based analysis.`)
            }
          } catch (pptxVisionErr) {
            console.error("PPTX media image extraction failed:", pptxVisionErr)
          }
        } else if (mimeType === "application/pdf") {
          const pdfcoApiKey = Deno.env.get('PDFCO_API_KEY')
          if (pdfcoApiKey) {
            try {
              console.log("PDF.co Visual analysis enabled. Uploading PDF to convert first 8 pages to images...")
              // Denetim Raporu, 2026-08-31 — LIVE TEST FINDING: this used to
              // POST the file directly as multipart form-data, which PDF.co's
              // convert endpoint rejects with a 400 (it only accepts a `url`
              // to an already-hosted file). See uploadFileToPdfCo() above —
              // confirmed against PDF.co's own docs and against a real 400
              // in this project's production logs.
              const fileUrl = await uploadFileToPdfCo(fileBytes, pdfcoApiKey, 'document.pdf')

              const pdfcoRes = fileUrl
                ? await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
                    method: 'POST',
                    headers: { 'x-api-key': pdfcoApiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: fileUrl, pages: '0-7' })
                  })
                : null

              if (!fileUrl) {
                console.warn('PDF.co file upload failed. Falling back to text-only analysis.')
              } else if (pdfcoRes && pdfcoRes.ok) {
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
                        base64Images.push(bytesToBase64(new Uint8Array(buffer)))
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
                console.warn(`PDF.co response status failed: ${pdfcoRes?.status ?? 'unknown'}`)
              }
            } catch (pdfcoErr) {
              console.error("PDF.co page conversion failed, falling back to text-only:", pdfcoErr)
            }
          } else {
            console.warn("PDFCO_API_KEY is missing. Falling back to text-only analysis.")
          }
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

          console.log("Attempting vision-based analysis using qwen/qwen3.8-27b...")
          groqResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${groqApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              // Groq retired llama-3.2-90b-vision-preview; qwen/qwen3.8-27b is
              // the current vision-capable model (same image_url format).
              model: "qwen/qwen3.8-27b",
              temperature: 0.3,
              // Qwen3.8 is a hybrid reasoning model that thinks by default —
              // turn that off so "content" is just the direct JSON answer.
              reasoning_effort: "none",
              // See callGroqJson above — an explicit cap keeps this request's
              // estimated token usage safely under the account's per-model
              // tokens-per-minute limit.
              max_completion_tokens: 4096,
              response_format: { type: "json_object" },
              messages: pass1Messages
            })
          }, 0, 25000) // no retries, 25s cap — leave real time budget for the text-only fallback below and the review pass afterward

          if (groqResponse.ok) {
            pass1Completed = true
            console.log("Vision-based Pass 1 completed successfully.")
          } else {
            let visionErrBody = ""
            try { visionErrBody = await groqResponse.clone().text() } catch (_readErr) { /* ignore */ }
            console.warn(`Vision model call returned non-ok status: ${groqResponse.status}. Falling back to text-only. Body: ${visionErrBody}`)
            visualAnalysisUsed = false
          }
        } catch (visionErr) {
          console.warn("Vision-based analysis call failed. Falling back to text-only:", visionErr)
          visualAnalysisUsed = false
        }
      }

      if (!pass1Completed) {
        console.log("Running standard text-only analysis using openai/gpt-oss-120b...")

        // This account's tokens-per-minute limit for openai/gpt-oss-120b has
        // been observed as low as 8000 — the system prompt alone (~2,900
        // tokens, since it carries all the formatting/LaTeX/quantitative
        // instructions) leaves surprisingly little room for the document
        // text plus the completion. Rather than hand-tune one "safe" size
        // (impossible to get right for every document/tokenizer), try
        // progressively smaller (text budget, completion budget) pairs and
        // only give up if a non-token-size error occurs or every tier fails.
        const draftTiers: Array<{ textChars: number; maxCompletionTokens: number }> = [
          { textChars: 6000, maxCompletionTokens: 2500 },
          { textChars: 3000, maxCompletionTokens: 1800 },
          { textChars: 1200, maxCompletionTokens: 1200 }
        ]

        for (let i = 0; i < draftTiers.length; i++) {
          const tier = draftTiers[i]
          const draftUserContent = textToSend.length > tier.textChars
            ? textToSend.substring(0, tier.textChars) + " [truncated to fit the AI provider's rate limits]"
            : textToSend

          try {
            groqResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${groqApiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                // llama-3.3-70b-versatile is being retired by Groq (shutdown
                // 2026-08-16); openai/gpt-oss-120b is one of Groq's recommended
                // replacements.
                model: "openai/gpt-oss-120b",
                temperature: 0.3,
                reasoning_effort: "low",
                include_reasoning: false,
                max_completion_tokens: tier.maxCompletionTokens,
                response_format: { type: "json_object" },
                messages: [
                  {
                    role: "system",
                    content: systemPrompt
                  },
                  {
                    role: "user",
                    content: draftUserContent
                  }
                ]
              })
            }, 1, 25000) // 1 retry max, 25s cap per attempt — leaves time for the review pass afterward
          } catch (fetchErr) {
            console.error("Pass 1 Groq API fetchWithRetry exception: ", fetchErr)
            await markFailed(serviceClient, documentId)
            return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
              status: 503,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          if (groqResponse.ok) break

          let draftErrBody: any = null
          try { draftErrBody = await groqResponse.clone().json() } catch (_readErr) { /* ignore */ }
          // Groq has been observed returning this error as a 400, a 429, OR
          // a 413 ("Request too large"), depending on the exact overage —
          // treat all three the same way. Missing 413 here was a real bug:
          // it fell through to the "non-retryable" branch below and gave up
          // on tier 1 instead of shrinking to tier 2/3, failing documents
          // that a smaller tier would have handled fine.
          const isTokenSizeError = (groqResponse.status === 400 || groqResponse.status === 429 || groqResponse.status === 413) &&
            draftErrBody?.error?.code === 'rate_limit_exceeded' &&
            draftErrBody?.error?.type === 'tokens'

          console.error(`Groq API Draft call failed (text budget ${tier.textChars} chars, completion budget ${tier.maxCompletionTokens}, status ${groqResponse.status}): `, JSON.stringify(draftErrBody))

          if (!isTokenSizeError || i === draftTiers.length - 1) {
            await markFailed(serviceClient, documentId)
            return new Response(JSON.stringify({ error: 'Our AI service is experiencing high demand right now — please try again in a moment' }), {
              status: 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          // else: too-large-for-TPM error — loop again with a smaller tier
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

      rawContent = groqData.choices?.[0]?.message?.content ?? ""
      if (!rawContent) {
        console.error('Empty response content from Groq Draft: ', JSON.stringify(groqData))
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({ error: 'AI failed to generate a response' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      // Strip any stray <think> block before this draft text gets embedded
      // into the review-pass prompt below (see stripThinkBlock definition).
      const draftStripped = stripThinkBlock(rawContent)
      if (draftStripped === null) {
        console.error('Groq Draft response was an unterminated <think> block (ran out of tokens while reasoning):', rawContent)
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({ error: 'The AI ran out of thinking time before writing a draft — please try again' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      rawContent = draftStripped

      sourceTextForReview = textToSend
      if (sourceTextForReview.length > 6000) {
        sourceTextForReview = sourceTextForReview.substring(0, 6000) + " [truncated for review]"
      }
    } else {
      // ========================================================================
      // LONG-DOC PATH — compact prompts (fixes Groq 413 payload-too-large)
      // Huge systemPrompt + 22k text was causing ALL windows to 413.
      // ========================================================================
      await serviceClient
        .from('documents')
        .update({ processing_stage: 'analyzing' })
        .eq('id', documentId)

      // Per-window extraction quotas.
      //
      // These used to be the fixed "5-15 key_terms / 5-12 key_points / 3-6
      // quiz_questions" below, written when a window was always one SLICE of
      // a document: several windows each hit the cap, and the merge + dedupe
      // downstream turned 2x15 candidates into ~24 distinct terms. Once
      // WINDOW grew to 13000 and a single-chapter upload started landing in
      // ONE window, that per-slice cap silently became the cap for the whole
      // document — measured on a 30-page deck whose own glossary lists 25
      // terms: two windows produced 24/25, one window produced exactly 15.
      // The window got better (it finally kept "peak"/"trough", which every
      // two-window run had dropped) while coverage got worse.
      //
      // So the quota has to follow what the window actually covers. At
      // total === 1 the window IS the document and asks for full coverage;
      // from 2 windows up the original per-slice numbers apply unchanged,
      // because there the merge step is what reaches full coverage.
      //
      // This costs no extra token budget: the single-window run above spent
      // ~1,400 of its 3,072 completion tokens, so the model was obeying this
      // prompt's cap, not running out of room. maxCompletionTokens stays at
      // 3072 and the pacer arithmetic in the WINDOW comment is unaffected.
      const wholeDocInOneWindow = (total: number) => total === 1
      // "this part" is a lie when the window is the whole document, and the
      // model reads it as licence to skip material it thinks belongs to some
      // other part that does not exist. Every mention of scope in the prompt
      // goes through this.
      const scopeWord = (total: number) => wholeDocInOneWindow(total) ? 'the document' : 'this part'
      const termQuota = (total: number) => wholeDocInOneWindow(total) ? '15-28' : '8-15'
      const pointQuota = (total: number) => wholeDocInOneWindow(total) ? '10-18' : '5-12'
      const quizQuota = (total: number) => wholeDocInOneWindow(total) ? '5-10' : '4-8'
      /* BOLUM KOTASI YOKTU (30.10.2026 olcumu). Semada "sections" duruyordu
         ama key_terms/key_points/quiz/diagrams/formulas/worked_examples'in
         hepsinin bir kural satiri varken bolumun YOKTU; model bos biraktigi
         gibi dolduruyordu. Olculen sonuc: ayni 27 sayfalik belge uc kosuda
         4, 3 ve 2 bolum verdi, son kosuda ANLATI dort konu isliyordu
         (accumulation / area+Riemann / definite vs indefinite / basic rules)
         ama bolum listesi IKI taneydi. Tam-belge yolundaki prompt (bkz.
         "Output \"sections\" as 2-8 items") bunu zaten soyluyor; eksik olan
         pencere yoluydu.
         AYRI KURAL SATIRI OLARAK EKLENEMEDI, OLCULDU: pencere promptunun
         serit tavanina (7200 token) payi degisiklikten once 6 TOKENDI
         (prompt 874 + deste talimati 135 = 1009 / 1015). 340 karakterlik bir
         kural satiri tahmini 7279'a cikardi, yani tavani asan pencere 429
         alip hic kosmazdi. DECK_PROMPT_CHARS yanindaki olcum notu da
         "pay buyutulemez, talimat kisaltilir" diyor. Bu yuzden kota, zaten
         "cover every section" diyen TEK PENCERE satirinin icine katlandi:
         net maliyet ~5 token ve o satir boyle daha fazlasini soyluyor.
         Parca (total > 1) dalinda bolum kurali YOK: orada her pencere
         belgenin bir dilimini gorur, bolum basligi dilim sinirina
         denk gelmez ve kota uydurma bolum uretmeye zorlardi. */
      const BOLUM_KOTASI = '4-8'

      // Compact extraction prompt — keeps request under Groq limits
      // BIR KEZ hesaplanir. compactWindowPrompt pencere basina birkac kez
      // cagriliyor (token tahmini, cagri, yeniden deneme tahmini), ve
      // tespit butun metin uzerinde regex kosturuyor — her cagrida yeniden
      // yapmak bos is.
      const deste = detectSlideDeck(extractedText, pageMarkerLabel)
      const desteTalimati = buildSlideDeckInstruction(
        deste.isDeck,
        pageMarkerLabel === "SLAYT" ? "slide" : "page"
      )
      console.log(
        `summarize-document: belge tipi ${deste.isDeck ? 'SLAYT DESTESI' : 'duz metin'} ` +
        `(${deste.reason}; ${deste.pages} isaret, isaret basina ${deste.charsPerPage} krk)`
      )

      const compactWindowPrompt = (wi: number, total: number) =>
        `You extract study material from ${total === 1 ? 'a complete academic document' : `part ${wi + 1}/${total} of a long academic document`}.
Language for all text fields: ${langLabel}.${desteTalimati}
Respond ONLY with JSON. In every string, a backslash must be written TWICE ("\\\\beta_0", "\\\\frac{a}{b}") — a single backslash makes the whole response invalid and it is thrown away.
{
  "summary": "5-10 sentences of CONCRETE content from ${total === 1 ? 'the document' : 'this part only'} — name real topics, methods, definitions",
  "summary_executive": "1-2 sentences naming the subject of ${total === 1 ? 'the document' : 'this part'}",
  "key_terms": [{"term":"...","definition":"..."}],
  "key_points": ["..."],
  "quiz_questions": [{"question":"...","answer":"..."}],
  "is_quantitative": false,
  "formulas": [{"name":"...","latex":"...","variables":[{"symbol":"...","meaning":"..."}]}],
  "outline_items": [{"heading":"...","blurb":"..."}],
  "sections": [{"heading":"...","summary":"...","key_points":["..."]}],
  "tables": [{"title":"...","headers":["..."],"rows":[["..."]]}],
  "charts": [{"title":"...","type":"bar|pie|line","labels":["..."],"data":[0]}],
  "diagrams": [{"title":"...","mermaid":"...","description":"..."}],
  "worked_examples": [{"title":"...","problem_statement":"...","steps":["..."],"final_answer":"..."}]
}
Rules:
- Extract ${termQuota(total)} key_terms and ${pointQuota(total)} key_points when content allows; every number stated (result, count, constant, rating, tolerance, coded value) must reach a key_point, table or worked_example WITH its units — verbatim, never invented
- ${quizQuota(total)} quiz_questions when content allows; if is_quantitative, at least half make the student calculate or read a number from ${scopeWord(total)} (the answer shows the result)${total === 1 ? `
- This is the WHOLE document: give ${BOLUM_KOTASI} 'sections', one per MAJOR topic (not per slide), and if it ends with a glossary or "review terms" list, every entry must appear in key_terms
- Keep definitions to one sentence so the full set fits
- A figure or table CAPTION is content: dates, ranges and quantities are often written out only there — carry them verbatim
- Worked cases, named examples and boxed features ("in practice", "case study", applications) are testable material too; do not skip them as filler` : `
- Captions and worked cases ("in practice", case studies) are testable: carry their dates, ranges and numbers into key_points and quiz_questions verbatim`}
- NEVER write meta text like "no draft provided" or "qualitative overview"
- Use real topic names from the text (e.g. supervised learning, neural networks)
- Ignore grading/attendance/admin text
- 'tables': real tabular data in ${scopeWord(total)}, or facts stated in parallel for several cases (each group's intercept and slope, each test's H0) or a value->notation list (470 -> 470Ω, 5K6 -> 5,6KΩ) with EVERY pair as its own row — every cell from ${scopeWord(total)}; empty array if none, never fabricate
- 'charts': only chart-worthy numeric data actually present in ${scopeWord(total)} (pick bar for category comparisons, pie for proportions of a whole, line for progression over time) — empty array if none
- 'diagrams': when short disconnected phrases, stage names, or paired opposing terms in ${scopeWord(total)} clearly reconstruct a flowchart/comparison/hierarchy/cycle, rebuild it as valid Mermaid source (flowchart TD/LR, graph TD, sequenceDiagram, or mindmap); at most ${total === 1 ? '2-3' : '1-2'}; empty array if nothing reconstructible — never invent
- 'formulas': EVERY equation in ${scopeWord(total)} — model forms, estimated equations with their numbers, derivatives, hypotheses (H0/H1) — latex copied from the source, each once
- 'worked_examples': 1-3, solving ${scopeWord(total)}'s OWN examples with ITS numbers — never invent a coefficient; every "a = b" you write must compute; one action per steps item, no numbering; empty array if there is no calculation`

      // Window size is bounded by this account's tokens-per-minute cap, not by
      // the HTTP payload limit — the 413 comment this constant used to carry
      // was measuring the wrong thing. The real budget for ONE window call is:
      //
      //     compactWindowPrompt   ~527 tokens  (measured, not estimated)
      //   + document text          WINDOW / 4
      //   + maxCompletionTokens   3072 tokens  (worst case)
      //   <= tokenPacer ceiling   7200 tokens  (8000 TPM * PACER_SAFETY 0.9)
      //
      // which solves to WINDOW <= ~14,400 chars. 7000 left ~3,600 tokens of
      // that budget permanently unused, and the cost of under-filling is not
      // merely "more calls": on 8,000 TPM, EVERY extra window costs a full
      // ~60s TokenPacer wait before it can start. A live 30-page, 12,451-char
      // deck measured 130s end to end, 114s of which (87%) was the pacer
      // waiting between two windows that would have fit in one. That wait is
      // also what kept budgetLeft() at 0 and made the review pass structurally
      // unreachable (PIPELINE_BUDGET_MS is 110s; the waits alone exceeded it).
      //
      // 13000 keeps the worst case at 3250 + 527 + 3072 = 6,849 tokens, under
      // the 7,200 ceiling, while letting a typical single-chapter upload land
      // in one window. If a document's text tokenizes worse than 4 chars/token
      // (Turkish does) and a window still overshoots, this is self-correcting:
      // extractWindow's catch shrinks an oversized payload to 55% and retries,
      // which lands back at ~7,150 chars — i.e. the old behaviour — at a cost
      // of one failed call rather than a failed summary.
      // DESTE MODU PENCEREYI DARALTIR — gerekce PAY, tavan degil.
      //
      // Ilk gerekcem yanlisti ve kendi testim yakaladi. Talimat 425 token
      // iken dusme ZORUNLUYDU (13000/4 + 527 + 425 + 3072 = 7274 > 7200).
      // Blok 270 tokene sikistirilinca o hesap gecerliligini yitirdi:
      // dusmeden de 7119, yani tavanin altinda. "Teknik olarak siger" ile
      // "guvenli" ayni sey degil:
      //
      //   duz metin, dusulmemis : 6849  → 351 token pay
      //   deste,     dusulmemis : 7119  →  81 token pay
      //   deste,     dusulmus   : 6807  → 393 token pay
      //
      // 81 token, bu promptun kendi yorumunun uyardigi seye karsi cok ince:
      // Turkce 4 krk/token'dan KOTU tokenlesiyor, yani WINDOW/4 tahmini
      // eksik kaliyor. Dusme, desteye duz metin yolunun dayandigi payin
      // AYNISINI veriyor — korunan sey tavan degil, tasarimin guvendigi pay.
      //
      // Bedeli durustce: sinirin hemen altindaki bir deste bir pencere
      // fazla bolunebilir, o da bir pacer beklemesi demek. Tipik bir deste
      // (30 slayt ~12.500 krk) yine tek pencereye siger.
      const WINDOW = deste.isDeck ? 13000 - DECK_PROMPT_CHARS : 13000
      // Denetim Raporu, 2026-08-31: this cap used to be a hardcoded 8 —
      // 8 * 7000 = 56,000 characters, silently dropping anything past that
      // point with NO signal to the student that content was cut. MAX_CHUNKS
      // already existed in this file (defined above, "hard ceiling: prefer
      // finishing over analyzing every page under Edge timeout") for exactly
      // this purpose but was only ever wired into the unused map-reduce
      // system, never into this actual live loop. Using it here raises the
      // ceiling to MAX_CHUNKS * WINDOW = 12 * 13000 = 156,000 characters
      // (84,000 back when WINDOW was 7000). The real protection
      // against exceeding the Edge wall-clock is the per-batch
      // `budgetLeft() < 20_000` check a few lines below, which already stops
      // adding more windows once time is genuinely short — that check is
      // what should decide "when to stop", not a fixed window count guessed
      // in advance.
      // Paralel modda pencereler ayni anda kostugu icin tavan sureyi degil
      // yalnizca maliyeti buyutur: 12 pencere (~156.000 krk) yerine belgenin
      // tamami okunur. README'deki "%28 kapsama" sorunu bu modda yok.
      const parallelGemini = geminiParallelActive()
      const pencereTavani = parallelGemini ? GEMINI_PARALLEL_MAX_WINDOWS : MAX_CHUNKS
      let windows: string[] = splitIntoWindows(extractedText, WINDOW, pencereTavani)

      /* TAVAN TABANA DAYANIRSA PENCERE KUCULTULUYOR (30.10.2026 olcumu).
       *
       * Iki butce birbiriyle TUTARSIZDI:
       *   WINDOW = 13.000 krk   -> bir pencerenin ne kadar buyuk OLABILECEGI
       *   windowCompletionFor() -> o pencereye TPM'den ne kadar cikis kaldigi
       * Ikinci butce ~11.500 krk'tan sonra tabana (WINDOW_COMPLETION_MIN)
       * cokuyor, ama birincisi 13.000'e kadar tek pencereye izin veriyor.
       * Yani arada bir aralik var: belge tek pencereye SIGIYOR ama modelin
       * yazacak yeri yok.
       *
       * Olculdu — "Week3 Chp2", 12.298 krk, TEK pencere:
       *   Pencere cikis tavani TABANA dayandi (2048): pencere 12298 krk ile
       *   cok buyuk, model yazacak yer bulamayabilir
       *   Window 1 token: prompt=3956 completion=2256 / max=2048
       * completion tavanı ASTI, yani cikti kesildi; kart 40 sayfadan 2 bolum
       * ve 8 soruyla cikti. Saglikli kosularda ayni log 3047, 2824, 3452,
       * 3737 yaziyor ve kartlar dolu.
       *
       * windowCompletionFloored zaten bu durumu GORUYOR ve uyariyordu; yorumu
       * da "dogru cozum pencereyi kucultmektir" diyordu. Artik kuculuyor.
       *
       * GEREKCE ZAYIFLADI — SONRAKI OLCUM (30.10.2026). "Computer Network
       * Security" belgesi ayni pencereyle uc kez kosuldu:
       *   completion 2036 / max 2119 -> BOZUK JSON, pencere dustu
       *   completion 1716 / max 2119 -> gecerli
       *   completion 2177 / max 2119 -> GECERLI, tavani ASTI
       * Tavani asan kosu basarili, altindaki basarisiz. Yani Gemini yolunda
       * max_completion_tokens (maxOutputTokens) SIKI uygulanmiyor; tavan
       * baglayici degil, tavsiye niteliginde. Hata tavan degil stokastik
       * bozuk uretim (bkz. callGroqJson icindeki kurtarma notu).
       *
       * Bu blok YINE DE duruyor, iki sebeple: (1) GERCEK Groq yolunda tavan
       * baglayicidir ve orada kesilme yasanir; (2) yalnizca cok dar bir
       * bantta (tek pencere >= ~12.250 krk) devreye giriyor ve olculen
       * saglikli uzunluklara hic dokunmuyor.
       *
       * KANITLANDI (30.10.2026, "Week3 Chp2" ayni belgede iki kosu).
       * Once — tek pencere, tavan tabanda:
       *   Long-doc compact: 1 window(s), totalChars=12298
       *   Pencere cikis tavani TABANA dayandi (2048)
       *   Window 1 token: prompt=3956 completion=2256 / max=2048
       *   kart: 2 bolum, 15 madde, 8 soru, 0 tablo, 0 diyagram
       * Sonra — bu blok devreye girdi:
       *   Pencere kucultuldu: cikis tavani tabanda kaldi, hedef 9338 krk
       *     -> 1 pencere yerine 2 pencere
       *   Window 1: completion 1511 / max 3971
       *   Window 2: completion 1895 / max 3897
       *   kart: 4 bolum, 22 madde, 12 soru, 1 tablo, 1 diyagram
       * Tavan 2048 -> 3971/3897 ve iki completion da rahatca icinde kaldi.
       * Bolum sayisi ikiye katlandi, soru %50 artti. Ince kartin sebebi
       * gercekten buydu.
       *
       * Dongu KENDINI SINIRLIYOR: hedef %25 kuculuyor, pencere sayisi
       * artmazsa cikiliyor (bolunemeyen metinde sonsuz dongu yok) ve en
       * fazla dort tur deneniyor. Pencere tavanina ulasildiysa hic
       * denenmiyor — oradan sonra kucultmek kapsamayi dusururdu. */
      {
        const enUzun = (p: string[]) => p.reduce((u, w) => (w.length > u.length ? w : u), '')
        let hedef = WINDOW
        for (let tur = 0; tur < 4; tur++) {
          if (windows.length >= pencereTavani) break
          if (!pencereCikisiDar(compactWindowPrompt(0, windows.length), enUzun(windows), windows.length)) break
          hedef = Math.floor(hedef * 0.75)
          const yeni = splitIntoWindows(extractedText, hedef, pencereTavani)
          if (yeni.length <= windows.length) break
          console.log(
            `Pencere kucultuldu: cikis tavani dar kaldi ` +
            `(${windowCompletionFor(compactWindowPrompt(0, windows.length), enUzun(windows))}, ` +
            `taban ${WINDOW_COMPLETION_MIN}), hedef ${hedef} krk ` +
            `-> ${windows.length} pencere yerine ${yeni.length} pencere`
          )
          windows = yeni
        }
      }
      const windowedChars = windows.reduce((n, w) => n + w.length, 0)
      console.log(
        `Long-doc compact: ${windows.length} window(s), totalChars=${extractedText.length}, ` +
        `windowedChars=${windowedChars} (${Math.round(100 * windowedChars / Math.max(1, extractedText.length))}% of document reachable)`
      )

      // Which lane each window actually used, for the success log. Kept
      // beside the results rather than ON them: a stray field on the result
      // object would ride into the merge and out into the saved card.
      const windowLanes = new Map<number, string>()

      async function extractWindow(wi: number, text: string, assignedLane?: string): Promise<any | null> {
        let payload = text
        for (let attempt = 0; attempt < 3; attempt++) {
          // First attempt uses the lane the batch assigned (distinct across
          // siblings — see pickLane). A retry re-picks, because by then the
          // other calls have landed and the ledgers have moved.
          //
          // A RETRY PREFERS THE BIG MODEL, and will wait for it.
          //
          // pickLane chooses by availability, which is right when the goal is
          // throughput and wrong here: the lane the first attempt just spent
          // is the one it will avoid, so a failed window is systematically
          // handed to the SMALLER model. Measured on the economy chapter
          // (06.10.2026) — attempt 1 failed with json_validate_failed, the
          // retry went to gpt-oss-20b, and the window came back
          // "terms=24 points=10 quiz=0". The same document and the same
          // prompt on gpt-oss-120b the day before gave quiz=10. The card
          // shipped with 3 questions instead of 13.
          //
          // A retry exists to rescue the window's quality, so giving it to
          // the weaker model defeats the point. It takes MODEL_HEAVY whenever
          // that lane's wait fits the remaining budget, and only falls back
          // to whatever is free when it does not — the rescue still happens,
          // it just prefers the model that can actually fill the schema.
          // Cikis tavani serit butcesinden turetilir (bkz. windowCompletionFor).
          // if/else'in DISINDA tanimli: asagidaki cagri bunu kullaniyor ve ilk
          // yazimda else blogunun icinde kalmisti — scope-check yakaladi.
          const winCompletion = windowCompletionFor(compactWindowPrompt(wi, windows.length), payload)
          let windowLane: string
          if (parallelGemini) {
            // Pencereler toplam token'in cogu: ucuz serit (Flash-Lite).
            windowLane = MODEL_EXTRACT
          } else if (attempt === 0 && assignedLane) {
            windowLane = assignedLane
            /* ATANAN SERIT BEKLETIYORSA DEVRET (20.10.2026).
               Ilk deneme seridi batch'in attigi haliyle kullaniyordu ve
               beklemesini HIC olcmuyordu. Olculen kosuda ucuncu pencere
               bu yuzden 58,5 saniye bekledi — kosunun yarisi — ve
               review'a yer kalmadi. pickLane zaten beklemeye gore
               seciyor; yalnizca bu dal onu atliyordu. */
            const atananEst = estimateTokens(compactWindowPrompt(wi, windows.length), payload, winCompletion)
            const atananBekleme = tokenPacer.waitEstimate(atananEst, windowLane, winCompletion)
            if (atananBekleme >= PENCERE_DEVIR_ESIGI_MS) {
              const alternatif = pickLane([MODEL_HEAVY, MODEL_EXTRACT], atananEst, winCompletion)
              const altBekleme = tokenPacer.waitEstimate(atananEst, alternatif, winCompletion)
              if (alternatif !== windowLane && altBekleme + PENCERE_DEVIR_KAZANC_MS <= atananBekleme) {
                console.log(
                  `Window ${wi + 1}: ${windowLane} ${atananBekleme}ms bekletiyor — ` +
                  `${alternatif} seridine devrediliyor (${altBekleme}ms, kazanc ${atananBekleme - altBekleme}ms)`
                )
                windowLane = alternatif
              } else {
                console.log(
                  `Window ${wi + 1}: ${windowLane} ${atananBekleme}ms bekletiyor ama ` +
                  `devredilecek bos serit yok (en iyi alternatif ${altBekleme}ms)`
                )
              }
            }
          } else {
            const est = estimateTokens(compactWindowPrompt(wi, windows.length), payload, winCompletion)
            const heavyWaitMs = tokenPacer.waitEstimate(est, MODEL_HEAVY, winCompletion)
            const affordHeavy = pencereMaliyetiSigiyor(heavyWaitMs, budgetLeft())
            windowLane = affordHeavy
              ? MODEL_HEAVY
              : pickLane([MODEL_HEAVY, MODEL_EXTRACT], est, winCompletion)
            if (attempt > 0) {
              console.log(
                `Window ${wi + 1}: tekrar denemesi ${windowLane} seridinde ` +
                `(${MODEL_HEAVY} beklemesi ${heavyWaitMs}ms, ${affordHeavy ? 'butceye sigdi' : 'sigmadi'})`
              )
            }
          }
          windowLanes.set(wi, windowLane)
          try {
            const result = await callGroqJson(
              groqApiKey,
              compactWindowPrompt(wi, windows.length),
              payload,
              {
                model: windowLane,
                temperature: 0.2,
                // Denetim Raporu, 2026-08-31: raised from 2048 → 3072 to make
                // room for the tables/charts/diagrams/worked_examples fields
                // added to compactWindowPrompt above — those were previously
                // absent from this schema entirely (the pre-existing
                // regression this fixes), and a Mermaid diagram or a table
                // with several rows can genuinely need the extra tokens to
                // avoid getting silently truncated mid-JSON.
                maxCompletionTokens: winCompletion,
                timeoutMs: Math.min(40000, Math.max(15000, budgetLeft() - 10000)),
                maxRetries: 0,
                usageLabel: `Window ${wi + 1}`
              }
            )
            return result
          } catch (err: any) {
            const msg = String(err?.message || err)
            console.error(`Window ${wi + 1} attempt ${attempt + 1} failed:`, msg.slice(0, 200))
            // 413 / context length → shrink payload and retry
            if (/413|too large|context_length|maximum context|payload/i.test(msg)) {
              payload = payload.slice(0, Math.floor(payload.length * 0.55))
              console.warn(`Window ${wi + 1}: shrinking payload to ${payload.length} chars`)
              continue
            }
            // Daily cap: retrying cannot help, and each retry poisons the
            // per-minute ledger and buys a 60s pacer wait on top. Give up on
            // the spot and let the caller report the real reason.
            if (isDailyQuotaError(msg)) {
              console.error(`Window ${wi + 1}: GUNLUK kota doldu — pencere dongusu durduruluyor`)
              dailyQuotaExhausted = true
              return null
            }
            // rate limit → brief wait then retry once
            if (/429|rate limit|tpm/i.test(msg) && attempt < 2) {
              await new Promise(r => setTimeout(r, 2500 * (attempt + 1)))
              continue
            }
            // json_validate_failed → retry unchanged.
            //
            // Groq returns this as a 400, which used to fall through to the
            // `return null` below and give up after ONE attempt. That is the
            // wrong read of the error: it does not mean the request was too
            // big or too fast, it means the model happened to emit malformed
            // JSON this time. Nothing about the input is at fault, so neither
            // shrinking the payload nor waiting helps — sending the identical
            // request again does, because the failure is stochastic.
            //
            // The cost of getting this wrong is the whole card: with one
            // window, a failed window means "All windows failed" and the
            // last-resort path rebuilds the summary from the first 5,000
            // characters. Measured live on an 11,050-char deck: 17 key terms
            // instead of the 28 the same document produced on a clean run.
            // Retried ONCE, not twice, and only with budget to spare. A
            // retry costs a fresh window call, which on 8,000 TPM means a
            // full ~60s pacer wait — but so does the last-resort mini
            // extract this replaces, so one retry is free in wall-clock
            // terms and buys the whole document instead of 5,000 characters.
            // A second retry would NOT be free: it stacks another wait on
            // top, and by then the narrative writer's own budget gate
            // (35s) is at risk — trading a thin card for one with no
            // written summary at all is not a trade worth making.
            /* YEREL AYRISTIRMA HATASI DA AYNI SINIF (30.10.2026). Groq'un
               json_validate_failed'i ile bizim JSON.parse SyntaxError'i ayni
               seyi soyluyor: model bu kez bozuk JSON yazdi. Girdide kusur
               yok, ayni istegi yeniden gondermek caliyor. closeTruncatedJson
               cogunu zaten kurtariyor; bu dal kurtarmanin da tutmadigi hal
               icin. */
            if (/json_validate_failed|failed to generate json|in JSON at position|Unexpected end of JSON|Unterminated string in JSON/i.test(msg) && attempt < 1) {
              // Ask what the retry would ACTUALLY cost on the lane it would
              // actually use, instead of assuming a full TPM window.
              const retryCompletion = windowCompletionFor(compactWindowPrompt(wi, windows.length), payload)
              const retryEst = estimateTokens(compactWindowPrompt(wi, windows.length), payload, retryCompletion)
              const retryWaitMs = Math.min(
                tokenPacer.waitEstimate(retryEst, MODEL_HEAVY, retryCompletion),
                tokenPacer.waitEstimate(retryEst, MODEL_EXTRACT, retryCompletion)
              )
              const retryNeedsMs = retryWaitMs + WINDOW_CALL_MS + NARRATIVE_WRITER_RESERVE_MS
              if (budgetLeft() > retryNeedsMs) {
                console.warn(
                  `Window ${wi + 1}: json_validate_failed — tekrar deneniyor ` +
                  `(butce ${budgetLeft()}ms, gereken ${retryNeedsMs}ms [pacer ${retryWaitMs}ms])`
                )
                continue
              }
              console.warn(
                `Window ${wi + 1}: json_validate_failed — butce yetmiyor, bu dilim atlaniyor ` +
                `(butce ${budgetLeft()}ms, gereken ${retryNeedsMs}ms)`
              )
            }
            return null
          }
        }
        return null
      }

      // SPEED FIX: process windows in concurrent batches (CHUNK_CONCURRENCY at
      // a time) instead of one fully sequential Groq round-trip per window.
      // Early-exit/budget checks now run between batches rather than between
      // every single window — slightly less granular, but this is what turns
      // an up-to-8x-sequential-calls stage into ~8/CHUNK_CONCURRENCY calls of
      // wall-clock time, and lets more windows fit inside the same budget.
      // ADAPTIVE CONCURRENCY. CHUNK_CONCURRENCY is now a ceiling, not the
      // batch size: the real batch size is whatever the account's token
      // budget can absorb at once. On the observed 8,000 TPM this resolves
      // to 1, which is exactly right — two ~5,000-token window calls cannot
      // both fit in 8,000, and firing them together is what made two runs of
      // the same document produce 26 terms and 14 terms respectively. On a
      // larger plan the same expression allows real parallelism again.
      const estWindowTokens = estimateTokens(
        compactWindowPrompt(0, windows.length),
        windows[0] || '',
        windowCompletionFor(compactWindowPrompt(0, windows.length), windows[0] || '')
      )
      // Windows alternate between two lanes (windowModel), so capacity is the
      // SUM of what each lane can take, not one lane's share. Computing it
      // from MODEL_HEAVY alone is what kept this pinned at 1: a ~6,150-token
      // window against a 7,200 budget allows exactly one per lane per minute,
      // and reading one lane made that the answer for the whole batch.
      // With two lanes a batch of two runs side by side instead of the second
      // sitting out a full window.
      const perLane = [MODEL_HEAVY, MODEL_EXTRACT].map(m => ({
        model: m,
        fits: tokenPacer.safeConcurrency(estWindowTokens, m),
        lane: tokenPacer.lane(m)
      }))
      const windowConcurrency = parallelGemini
        ? Math.max(1, Math.min(GEMINI_PARALLEL_CONCURRENCY, windows.length))
        : Math.min(
          CHUNK_CONCURRENCY,
          Math.max(1, perLane.reduce((n, l) => n + l.fits, 0))
        )
      console.log(
        `Window concurrency: ${windowConcurrency} ` +
        `(${perLane.map(l => `${l.model}: ${l.lane.limit} TPM${l.lane.limitKnown ? '' : '/varsayilan'} -> ${l.fits}`).join(', ')}, ` +
        `~${estWindowTokens} token/pencere, cikis tavani ` +
        `${windowCompletionFor(compactWindowPrompt(0, windows.length), windows[0] || '')}, ` +
        `tavan ${CHUNK_CONCURRENCY})`
      )
      if (windowCompletionFloored(compactWindowPrompt(0, windows.length), windows[0] || '')) {
        console.warn(
          `Pencere cikis tavani TABANA dayandi (${WINDOW_COMPLETION_MIN}): pencere ` +
          `${windows[0]?.length || 0} krk ile cok buyuk, model yazacak yer bulamayabilir`
        )
      }

      const windowResults: any[] = []
      // Dusen pencere SESSIZ kalmamali. 09.10.2026: 1. pencere (1-19.
      // slaytlar) iki denemede de 400 aldi, merge satiri "terms=14 points=17"
      // yazip devam etti ve kart belgenin yarisiyla cikti. Hicbir satir
      // yarisinin eksik oldugunu soylemiyordu.
      const dusenPencereler: number[] = []
      for (let batchStart = 0; batchStart < windows.length; batchStart += windowConcurrency) {
        /* ATLANAN PENCERELER DE KAYIP (24.10.2026).
         *
         * Iki kisa devre (bütce ve "enough extractions") kalan pencereleri
         * hic cagirmiyor, ama bu pencereler `dusenPencereler`'e GIRMIYORDU.
         * Sonuc: "EKSIK BELGE" olcumu ve karttaki quality_meta.missing_windows
         * bu kaybi hic gormuyor; log yalnizca "Enough extractions" diyor.
         *
         * 12 pencereli bir belgede ilk dort pencere terim kotasini
         * doldurdugunda 5-12. pencereler hic okunmuyor — yani belgenin
         * ucte ikisi karta girmiyor ve HICBIR YERDE yazmiyor. Simdi ayni
         * muhasebeye giriyorlar; rozet tarafi bugun ekrana baglandi, yani
         * ogrenci de gorecek. */
        const kalanlariAtla = (sebep: string) => {
          for (let wi = batchStart; wi < windows.length; wi++) dusenPencereler.push(wi + 1)
          console.warn(
            `${sebep} — ${windows.length - batchStart}/${windows.length} pencere ATLANDI ` +
            `(${batchStart + 1}-${windows.length}), eksik kapsama olarak sayiliyor`
          )
        }
        if (budgetLeft() < 20_000 && windowResults.length > 0) {
          kalanlariAtla(`Butce dar (${budgetLeft()}ms)`)
          break
        }
        // Enough good extractions already?
        // Paralel modda DEGIL: orada bir sonraki parti beklemesizdir ve bu
        // kisayol 10'luk ilk partiden sonra belgenin geri kalanini atardi.
        if (!parallelGemini && windowResults.length >= 4) {
          const termsSoFar = windowResults.reduce((n, r) => n + (r.key_terms?.length || 0), 0)
          if (termsSoFar >= 12) {
            kalanlariAtla(`Yeterli cikarim (${termsSoFar} terim)`)
            break
          }
        }

        const batchEnd = Math.min(batchStart + windowConcurrency, windows.length)
        await serviceClient.from('documents')
          .update({ processing_stage: `chunking:${batchEnd}/${windows.length}` })
          .eq('id', documentId)

        const batchIndices: number[] = []
        for (let wi = batchStart; wi < batchEnd; wi++) batchIndices.push(wi)

        /* BUTCEYE SIGMAYAN BEKLEME YAPILMIYOR (27.10.2026).
         *
         * Yukaridaki "Butce dar" kapisi 20 saniyeyi sorup geciyor, pencerenin
         * ne kadar BEKLEYECEGINI sormuyordu. TokenPacer dakikalik pencerenin
         * donmesini bekledigi icin tek bir pencere 58 saniye uyuyabiliyor:
         * olculen kosuda karar aninda 51 sn butce vardi, kapi gecti, pencere
         * 58,3 sn uyudu ve nobetci (ISCI_NOBET_MS) t=141'de belgeyi 'failed'
         * yapti. Elde iki bitmis pencere vardi ve kart HIC gelmedi.
         *
         * Olculen sey BEKLEMENIN TABANI: her pencere icin iki seridin en
         * iyisi, parti icin de en yavas pencere (parti Promise.all ile tek
         * seferde bekleniyor, maliyeti en yavas pencere belirliyor). Taban
         * bile sigmiyorsa serit devri de kurtarmaz — kalan pencereler
         * atlanir, kart eksik kapsama rozetiyle de olsa cikar.
         *
         * Bekleme 0 ise kapi susar: kacinilacak bir sey yok, o durumu
         * 20 saniyelik butce kapisi zaten tutuyor. */
        const partiSeritleri = parallelGemini ? [MODEL_EXTRACT] : [MODEL_HEAVY, MODEL_EXTRACT]
        const partiBeklemeMs = Math.max(0, ...batchIndices.map(wi => {
          const prompt = compactWindowPrompt(wi, windows.length)
          const tavan = windowCompletionFor(prompt, windows[wi])
          const est = estimateTokens(prompt, windows[wi], tavan)
          return Math.min(...partiSeritleri.map(m => tokenPacer.waitEstimate(est, m, tavan)))
        }))
        if (
          partiBeklemeMs > 0 &&
          windowResults.length > 0 &&
          !pencereMaliyetiSigiyor(partiBeklemeMs, budgetLeft())
        ) {
          kalanlariAtla(
            `Bekleme butceye sigmiyor (${partiBeklemeMs}ms bekleme + ` +
            `${WINDOW_CALL_MS}ms cagri + ${NARRATIVE_WRITER_RESERVE_MS}ms yazar payi ` +
            `> ${budgetLeft()}ms kalan butce)`
          )
          break
        }

        // Assign lanes up front so siblings in this batch cannot pick the same
        // one. Done here rather than inside extractWindow because every call in
        // the batch starts before any of them records a spend.
        const claimedLanes = new Set<string>()
        const batchLanes = batchIndices.map(wi => pickLane(
          [MODEL_HEAVY, MODEL_EXTRACT],
          estimateTokens(compactWindowPrompt(wi, windows.length), windows[wi],
            windowCompletionFor(compactWindowPrompt(wi, windows.length), windows[wi])),
          windowCompletionFor(compactWindowPrompt(wi, windows.length), windows[wi]),
          claimedLanes
        ))
        const batchResults = await Promise.all(
          batchIndices.map((wi, bi) => extractWindow(wi, windows[wi], batchLanes[bi]))
        )
        for (let bi = 0; bi < batchResults.length; bi++) {
          const result = batchResults[bi]
          const wi = batchIndices[bi]
          if (!result) dusenPencereler.push(wi + 1)
          if (result) {
            // Normalize alternate field names
            if (!result.summary && result.chunk_summary) result.summary = result.chunk_summary
            windowResults.push(result)
            // The lane is in the line on purpose: windows are spread across
            // both models, so one run of one document compares 120b and 20b on
            // neighbouring slices of the same text. If 20b extracts materially
            // less, this log is where it shows, with no separate experiment.
            const nTerms = (result.key_terms || []).length
            const nPoints = (result.key_points || []).length
            const nQuiz = (result.quiz_questions || []).length
            /* BOLUM SAYISI LOGDA YOKTU (30.10.2026 olcumu). Week 9 karti
               27 sayfalik bir desteyi 2 bolumle temsil ediyordu, ama ne
               pencere ne birlesim satiri bolum sayisi yaziyordu: modelin 2
               mi dondurdugu yoksa 8 dondurup 6'sinin mi suzuldugu
               AYIRT EDILEMIYORDU. Bos kabuk ayiklayici yalnizca basliksiz
               bolumu atiyor ve attiginda kendi logunu basiyor; o log da
               yoktu, yani model gercekten 2 dondurmus. */
            const nSections = (result.sections || []).length
            console.log(`Window ${wi + 1} ok [${windowLanes.get(wi) || '?'}]: terms=${nTerms} points=${nPoints} quiz=${nQuiz} sections=${nSections}`)
            // Pencerenin KENDI dilimine karsi: sayi burada kayboluyorsa sorun
            // cikarimda, birlesimde degil. Uc asamanin uc satiri (pencere,
            // birlesim, son kart) kaybin nerede oldugunu ayirt ediyor.
            console.log(`Window ${wi + 1} sayisal kapsama: ${formatCoverage(numericCoverage(windows[wi], result))}`)
            // A window that returns plenty of one array and NOTHING of
            // another did not fail — it was accepted, merged and shipped.
            // On 06.10.2026 a window came back terms=24 points=10 quiz=0 and
            // the card went out with 3 questions where 13 was normal, with
            // nothing anywhere saying a whole field had gone missing. "ok"
            // was the only word in the log. An empty array next to a full one
            // is not a document without quiz questions; it is a model that
            // dropped a field.
            const emptyFields = [
              nTerms === 0 ? 'key_terms' : '',
              nPoints === 0 ? 'key_points' : '',
              nQuiz === 0 ? 'quiz_questions' : ''
            ].filter(Boolean)
            if (emptyFields.length > 0 && nTerms + nPoints + nQuiz > 0) {
              console.warn(
                `Window ${wi + 1}: ${emptyFields.join(', ')} BOS dondu ` +
                `[${windowLanes.get(wi) || '?'}] — model alani atlamis olabilir`
              )
            }
          }
        }
      }

      // Last-resort: single tiny window if everything failed.
      // Skipped when the DAILY quota is gone: a smaller window is still a
      // call, and the cap rejects it exactly as it rejected the big one.
      // Trying anyway is how the 05.10.2026 run spent another ~20s and a
      // third 429 to arrive at the same place.
      if (windowResults.length === 0 && !dailyQuotaExhausted) {
        console.warn('All windows failed — last-resort mini extract on first 5000 chars')
        const mini = await extractWindow(0, extractedText.slice(0, 5000))
        if (mini) windowResults.push(mini)
      }

      if (windowResults.length === 0) {
        if (dailyQuotaExhausted) {
          console.error('Gunluk Groq kotasi (TPD) doldu — ozet uretilemedi')
          await markFailed(serviceClient, documentId)
          return new Response(JSON.stringify({
            error: 'Günlük AI kotası doldu. Kota saat başı yenilenir — bir süre sonra tekrar deneyin. / Daily AI quota exhausted; it refills gradually, please retry later.'
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        console.error('All long-doc windows failed even after shrink retries')
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({
          error: 'AI istek boyutu/kota hatası. 1 dk bekleyip tekrar deneyin. / AI payload or rate error — wait 1 min and retry.'
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // FAIR MERGE ACROSS WINDOWS.
      // These merges used to flatMap in window order and then slice to a cap.
      // Because each window returns 5-15 key terms, the 40-item cap was
      // typically filled by windows 1-3 and every later window's extractions
      // were silently discarded at the slice — the back of the document lost
      // its terms even when its windows HAD been analyzed successfully.
      // roundRobinInterleave (already in this file, previously unwired) takes
      // one item per window per pass instead, so a cap now trims the tail of
      // every window evenly rather than deleting the last windows entirely.
      const perWindow = (key: string) =>
        windowResults.map((r: any) => Array.isArray(r[key]) ? r[key] : [])

      const mergedKeyTerms = dedupeKeyTerms(roundRobinInterleave(perWindow('key_terms'))).slice(0, 40)
      const mergedKeyPoints = dedupeByText(roundRobinInterleave(perWindow('key_points')), maddeMetni).slice(0, 35)
      const mergedQuiz = dedupeByText(roundRobinInterleave(perWindow('quiz_questions')), (q: any) => q?.question || '').slice(0, 20)
      const mergedFormulas = roundRobinInterleave(perWindow('formulas')).slice(0, 30)
      const quantFraction = windowResults.filter(r => r.is_quantitative).length / Math.max(1, windowResults.length)
      // Denetim Raporu, 2026-08-31 — ROOT-CAUSE FIX: this long-doc path used to
      // hardcode tables/charts/diagrams/worked_examples to empty arrays below
      // (mergedDraft), even though compactWindowPrompt now asks each window
      // for them. Merge them here exactly like the other per-window fields,
      // with a light title-based dedupe (windows don't overlap, but the same
      // table/diagram sometimes reappears if a slide repeats) and the same
      // "cap at N" pattern already used for terms/points/quiz above.
      const mergedTables = dedupeByText(
        roundRobinInterleave(perWindow('tables')),
        (t: any) => t?.title || ''
      ).filter((t: any) => t && t.title && Array.isArray(t.rows) && t.rows.length > 0).slice(0, 12)
      const mergedCharts = dedupeByText(
        roundRobinInterleave(perWindow('charts')),
        (c: any) => c?.title || ''
      ).filter((c: any) => c && c.title && Array.isArray(c.data) && c.data.length > 0).slice(0, 10)
      const mergedDiagrams = dedupeByText(
        roundRobinInterleave(perWindow('diagrams')),
        (d: any) => d?.title || ''
      ).filter((d: any) => d && d.title && d.mermaid).slice(0, 8)
      const mergedWorkedExamples = dedupeByText(
        roundRobinInterleave(perWindow('worked_examples')),
        (w: any) => w?.title || w?.problem_statement || ''
      ).filter((w: any) => w && (w.title || w.problem_statement)).slice(0, 10)
      // Denetim Raporu, 2026-08-31: attempted to restore "Kavram Grafiği"
      // (concept_graph) the same way tables/charts/diagrams were restored
      // above, but reverted at the user's request after a live test came
      // back noticeably thinner (fewer terms/points/quiz) than the prior
      // confirmed-good run — kökten çözmeden önce şüpheli değişikliği geri
      // almak, belirsiz bir teoriyle üstüne inşa etmekten daha güvenli.
      //
      // 2026-10-03 — THE ROOT CAUSE IS NOW IDENTIFIED, and it confirms that
      // revert was right. Each window call runs under a fixed
      // maxCompletionTokens (3072) against an account whose observed Groq
      // tokens-per-minute cap is as low as 8,000. Adding a schema field does
      // not buy extra output budget; the model pays for the new field out of
      // the same completion allowance, so concept_graph's nodes/edges were
      // funded by returning fewer key terms/points/quiz. "Thinner output"
      // was not noise — it is the arithmetic.
      //
      // So concept_graph deliberately STAYS empty on this path. The fix is
      // not a prompt tweak; it needs either (a) resumable multi-invocation
      // processing so a window's extraction is not competing for one
      // completion budget, or (b) one dedicated graph pass over the already
      // merged key terms, which costs a single extra call instead of taxing
      // every window. Do not re-add it to compactWindowPrompt's schema
      // without one of those in place first.
      //
      // Note the contrast with footnotes: those were ALSO absent from this
      // path, and were restored WITHOUT touching the schema at all, by
      // computing page anchors from the "--- SAYFA N ---" index after the
      // fact (anchorCitations(), called once before the study card is
      // saved). Zero extra tokens, and the page numbers are verifiable.
      // concept_graph has no equivalent purely-textual derivation, which is
      // exactly why it is the one field still waiting.

      let bestSummary = windowResults.map(r => String(r.summary || '')).filter(s => s.length > 40).join('\n\n')
      let bestExec = String(windowResults[0]?.summary_executive || '')
      const outlineFromWindows = {
        document_title_guess: '',
        items: windowResults.flatMap((r, i) =>
          Array.isArray(r.outline_items) ? r.outline_items.map((it: any, j: number) => ({
            id: `o${i + 1}_${j + 1}`,
            heading: it.heading || it.title || '',
            blurb: it.blurb || it.summary || '',
            level: 1,
            order: i * 10 + j + 1,
            parent_id: null
          })) : []
        ).filter((it: any) => it.heading)
      }
      let bestSections = dedupeBolumler(windowResults.flatMap(r => Array.isArray(r.sections) ? r.sections : []))
      let bestOutline: any = outlineFromWindows.items.length ? outlineFromWindows : null

      // Compact synthesis (small prompt — only digests)
      if (windowResults.length >= 2 && budgetLeft() > 25_000) {
        try {
          await serviceClient.from('documents').update({ processing_stage: 'synthesizing' }).eq('id', documentId)
          const digests = windowResults.map((r, i) =>
            `P${i + 1}: ${String(r.summary || '').slice(0, 600)}`
          ).join('\n')
          const termHint = mergedKeyTerms.slice(0, 20).map((t: any) => t.term).filter(Boolean).join(', ')
          /* GRUPLAR, BOLUM YENIDEN YAZIMI DEGIL (25.10.2026).
           *
           * Sentez bolumleri YENIDEN YAZIYORDU ve uc kosunun ucunde de
           * reddedildi (kosu 37: `bolumleri (icerik) 688 < 2180x0.75`,
           * `ozeti 803 < 1600x0.75`, `anahati 3 < 25x0.75`). Sebep bir
           * celiski: sentez yalnizca 600 krk'lik ozetceleri goruyor ama
           * ciktisi pencerelerin TAM bolumleriyle kiyaslaniyor — gormedigi
           * icerigi yeniden uretemez. 768 token'in bir kismini da gpt-oss'un
           * akil yurutmesi yiyor (bkz. REASONING_HEADROOM).
           *
           * Kullanicinin "iyiydi" dedigi kart 4 bolumdu; pencereler 7-9
           * bolum veriyor. Istenen sey yapi, yeni metin degil. Artik sentez
           * numaralanmis bolumleri konu GRUPLARINA ayiriyor ve birlestirmeyi
           * kod yapiyor (sentezGruplariniUygula): her bolumun metni ve
           * maddeleri INSA GEREGI korunuyor. Anahat da istenmiyor (pencere
           * anahati korunuyor). Bosalan cikti butcesi tek bir butunlesik
           * ozete gidiyor — kartin OZET bolumu iki pencere ozetinin alt alta
           * yapistirilmis hali olmasin. */
          const synBolumListesi = bestSections.slice(0, 24).map((s: any, i: number) =>
            `S${i + 1}: ${String(s?.heading || '').slice(0, 80)} — ${String(s?.summary || s?.content || '').slice(0, 70)}`
          ).join('\n')
          const synSys = `Merge part digests into one study brief in ${langLabel}. JSON only: {"summary":"...","summary_executive":"...","groups":[{"heading":"...","members":[1,2]}]}.
summary: ONE flowing overview of the whole document, 200-260 words, concrete topic names from digests and terms; never open with "This part" or "This section".
groups: sort the numbered sections S1..Sn into 3-6 topic groups, every number exactly once; heading = a concrete topic name. No meta filler.`
          const synUser = `Terms: ${termHint}\n\nSections:\n${synBolumListesi}\n\nDigests:\n${digests}`.slice(0, 12000)
          // Prefers MODEL_EXTRACT, the reverse of the narrative writer.
          //
          // These two calls run back to back and used to both want MODEL_HEAVY:
          // synthesis took it, and the writer — the one call a student actually
          // reads the output of — found it busy and waited 50 seconds behind it
          // (05.10.2026). Two calls, two lanes; they should not queue.
          //
          // Synthesis is structuring work: fold digests into an outline and
          // section headings. The writer is prose. So the smaller model takes
          // the structuring and the better one stays free for the writing,
          // which is where the difference is visible. Either falls back if its
          // preferred lane is busy.
          /* Sentezin completion rezervasyonu — bkz. cagri yerindeki yorum.
             pickLane, waitEstimate ve cagrinin kendisi UCU de bu degeri
             kullaniyor; biri 2048'de kalirsa serit secimi yanlis seride
             gider ya da kapi sigacak bir cagriyi atlar. */
          const synCompletion = 768
          const synLane = pickLane(
            [MODEL_EXTRACT, MODEL_HEAVY],
            estimateTokens(synSys, synUser, synCompletion),
            synCompletion
          )
          /* SENTEZ DE OPSIYONEL — bkz. OPSIYONEL_ADIM_MAX_BEKLEME_MS.
             21.10 kosusunda 57.955ms'lik pacer beklemesi TAM BURADA olustu:
             iki pencere her iki seridi bosaltmis durumdaydi ve bu cagri
             dakikalik pencerenin donmesini bekledi. Kartin icerigi
             pencerelerden zaten gelmis; sentez onun uzerine ozet/anahat
             koyuyor. 58 saniyelik kuyruk buna degmiyor. */
          const synBekleme = tokenPacer.waitEstimate(
            estimateTokens(synSys, synUser, synCompletion), synLane, synCompletion
          )
          if (synBekleme > OPSIYONEL_ADIM_MAX_BEKLEME_MS) {
            skippedStages.push('compact synthesis')
            console.log(
              `Compact synthesis atlandi: pacer ${synBekleme}ms bekletiyor ` +
              `(tavan ${OPSIYONEL_ADIM_MAX_BEKLEME_MS}ms) — pencerelerin ciktisi korunuyor`
            )
          } else {
            const syn = await callGroqJson(
              groqApiKey,
              synSys,
              synUser,
              /* COMPLETION REZERVASYONU BEKLEMENIN ASIL SEBEBIYDI (21.10.2026).
               *
               * Logdaki `est=1795`in 1.229'u metin degil, rezervasyon:
               * PACER_COMPLETION_FACTOR (0,6) x maxCompletionTokens (2048).
               * Gercek prompt yalnizca ~566 token. Yani pacer, sentezin
               * harcamayacagi bir yer icin dakikanin donmesini bekletiyordu.
               *
               * 768'e inince est ~1.048 oluyor ve olculen iki kosu da
               * siğiyor: 6.095 + 1.048 = 7.143 <= 7.200 (sinir PACER_SAFETY
               * ile kirpilmis 8.000). Yani bekleme SIFIRLANIYOR ve sentez
               * ATLANMAK yerine gercekten kosuyor — kart da kazaniyor.
               *
               * En kotu hal "atlamakla ayni": 768 token cikti kesilirse JSON
               * ayristirilamaz, asagidaki catch yutar ve pencerelerin ciktisi
               * korunur. Ustteki atlama kapisi yine duruyor, ag olarak. */
              { model: synLane, temperature: 0.25, maxCompletionTokens: synCompletion, timeoutMs: 30000, maxRetries: 0 }
            )
            /* SENTEZ PENCERELERIN CIKTISINI TABANSIZ EZIYORDU (24.10.2026).
             *
             * `bestSections` 12 pencereden gelen bolumlerin flatMap'i; tek
             * kosul `length >= 1` oldugu icin sentez IKI baslik dondurunce
             * 20 bolum 2'ye iniyordu. `bestSummary` de pencerelerin birlesik
             * ozeti (binlerce karakter) iken 81 karakterlik bir ciktiyla
             * degistirilebiliyordu.
             *
             * Sentez yalnizca 600 karakterlik ozetceleri goruyor ve 768
             * token butcesiyle kosuyor — yani PENCERELERDEN DAHA AZ bilgiyle
             * yaziyor. Review tarafinda ayni karar icin NARRATIVE_MIN_KEEP_RATIO
             * tabani var; burada ayni mantigin ikinci yazimi tabansizdi.
             *
             * Simdi ayni taban burada da: sentez ancak mevcut icerigin
             * dortte ucunu koruyorsa gecerli. Reddedilen hal loglanir, cunku
             * sessiz bir ret "sentez neden hic ise yaramiyor" sorusunu
             * cevapsiz birakir. */
            const sentezRet = (ad: string, eski: number, yeni: number) => {
              console.warn(
                `Compact synthesis ${ad} REDDEDILDI: ${yeni} < ${eski} x ` +
                `${NARRATIVE_MIN_KEEP_RATIO} — pencerelerin ciktisi korunuyor`
              )
            }
            if (syn?.summary && String(syn.summary).length > 80) {
              const yeni = String(syn.summary)
              if (!bestSummary || yeni.length >= bestSummary.length * NARRATIVE_MIN_KEEP_RATIO) {
                bestSummary = yeni
              } else {
                sentezRet('ozeti', bestSummary.length, yeni.length)
              }
            }
            if (syn?.summary_executive) bestExec = String(syn.summary_executive)
            if (syn?.outline?.items?.length) {
              // `arr` acadex-ink yardimcisi; bu dosyada YOK (scope-check yakaladi).
              const eski = Array.isArray(bestOutline?.items) ? bestOutline.items.length : 0
              if (syn.outline.items.length >= eski * NARRATIVE_MIN_KEEP_RATIO) bestOutline = syn.outline
              else sentezRet('anahati', eski, syn.outline.items.length)
            }
            /* BOLUMLERDE SAYI YANLIS OLCU (24.10.2026, duzeltme).
             *
             * Dun buraya sayi tabani koydum ve YANLISTI: sentezin isi tam
             * olarak cok sayida pencere bolumunu daha az, daha derli toplu
             * bolume indirmek. Sayiya bakan bir taban, sentezin yapmasi
             * gereken seyi garanti olarak reddeder.
             *
             * Canli kanit — kullanicinin yan yana koydugu iki kart:
             *   Compact synthesis bolumleri REDDEDILDI: 4 < 7 x 0.75
             * Kart 7 pencere bolumu + 2 gorsel yama = 9 BOLUMLE kaldi.
             * "Iyiydi" dedigi eski kart ise 4 BOLUMDU — yani sentezin
             * onerdigi yapinin ta kendisi.
             *
             * Korunmasi gereken sey ICERIK, dagilim degil: sentez metni
             * yariya dusurduyse kayip, 7 bolumu 4'e topladiysa duzenleme.
             * Olcu artik toplam karakter.
             *
             * Anahat bolumlerle BIRLIKTE uretiliyor; bolumler kabul
             * edildiyse 12 maddelik eski anahati 4 bolume yapistirmak
             * tutarsiz olurdu, o yuzden o da sentezin surumune geciyor. */
            const gruplu = sentezGruplariniUygula(bestSections, syn?.groups)
            if (gruplu) {
              console.log(
                `Compact synthesis gruplari kabul edildi: ${bestSections.length} bolum -> ` +
                `${gruplu.length} bolum (metin ve maddeler korunarak)`
              )
              bestSections = gruplu
            } else if (syn?.groups) {
              console.warn(
                `Compact synthesis gruplari kullanilamadi (${Array.isArray(syn.groups) ? syn.groups.length : 0} grup, ` +
                `${bestSections.length} bolum) — pencere bolumleri korunuyor`
              )
            }
            /* Eski bicim (sections) hala taniniyor: model semayi yok sayip
               bolum yazarsa icerik tabani karar veriyor. */
            if (!gruplu && Array.isArray(syn?.sections) && syn.sections.length) {
              const bolumKrk = (a: any[]) => a.reduce(
                (n, s) => n + String(s?.heading || '').length + String(s?.summary || s?.content || '').length, 0
              )
              const eskiKrk = bolumKrk(bestSections)
              const yeniKrk = bolumKrk(syn.sections)
              if (eskiKrk === 0 || yeniKrk >= eskiKrk * NARRATIVE_MIN_KEEP_RATIO) {
                console.log(
                  `Compact synthesis bolumleri kabul edildi: ${bestSections.length} bolum ` +
                  `${eskiKrk} krk -> ${syn.sections.length} bolum ${yeniKrk} krk`
                )
                bestSections = syn.sections
                if (syn.outline?.items?.length) bestOutline = syn.outline
              } else {
                sentezRet('bolumleri (icerik)', eskiKrk, yeniKrk)
              }
            }
          }
        } catch (synErr) {
          console.warn('Compact synthesis skipped:', synErr)
        }
      }

      // ------------------------------------------------------------------
      // VISUAL ANALYSIS PATCH FOR ANY LONG DOCUMENT WITH IMAGE-ONLY PAGES
      // (Denetim Raporu, 2026-08-31, generalized after live testing).
      // This used to also require the WHOLE document to trip
      // isVisuallyDenseDocument (a slide-deck-shaped avg-chars-per-page
      // signal) before even checking nearBlankPdfPageIndices — that overfits
      // to one document shape. A quantitative course PDF (finance, stats,
      // accounting) can be mostly dense text with just one or two exhibit
      // pages that are a screenshotted chart/table/formula sheet; a verbal
      // course PDF can be the reverse. Either way, the actual signal that
      // matters is simpler and more general: are there SPECIFIC pages this
      // document's own extraction came back with essentially no text for?
      // If so, those pages' content is trapped in an image regardless of
      // what the rest of the document looks like, so we spend ONE extra
      // vision-capable call on just those pages (not all pages — bounds
      // cost/latency to a single call) and merge anything new it finds into
      // the terms/points/quiz/sections gathered from the text-only windows.
      // isVisuallyDenseDocument (logged above) stays as a diagnostic signal,
      // it just no longer gates this block. Fully additive and best-effort:
      // any failure here just leaves the text-only result untouched, same
      // as the compact synthesis above.
      // ------------------------------------------------------------------
      const visualPlan = analyzeVisuals
        ? selectVisualPages(pdfPageTexts, nearBlankPdfPageIndices, parallelGemini ? GEMINI_VISION_MAX_PAGES : VISION_MAX_IMAGES)
        : { indices: [] as number[], reason: 'kapali' }

      // Budget the vision pass the way the review gate is budgeted: what the
      // call would actually WAIT plus what it would actually COST, instead of
      // a flat reserve.
      //
      // VISUAL_MIN_BUDGET_MS is 100s against a 110s pipeline, so vision could
      // only ever run if it started inside the first ten seconds. On a
      // single-window document it does. On a multi-window one it never can —
      // and on 05.10.2026 that is exactly what happened: "Gorsel gecis
      // atlandi: butce 41096ms <= 100000ms". 41 seconds was plenty for a call
      // that needs about thirty.
      //
      // The reserve was there to leave the narrative writer room. The writer
      // now falls back to a free lane instead of queueing for a busy one, so
      // the room it needs is far smaller than 100s.
      const visionEstTokens = visualPlan.indices.length * VISION_TOKENS_PER_IMAGE + 2000
      const visionWaitMs = tokenPacer.waitEstimate(visionEstTokens, MODEL_FAST, VISION_MAX_COMPLETION)
      const visionNeedsMs = visionWaitMs + VISION_CALL_MS + NARRATIVE_WRITER_RESERVE_MS
      /* "Yer var mi" ile "deger mi" ayri sorular — bkz. OPSIYONEL_ADIM_MAX_BEKLEME_MS.
         Iki kol ayni karari okuyor ki birbirinden kayamasinlar. */
      const visionBeklemeAsiri = visionWaitMs > OPSIYONEL_ADIM_MAX_BEKLEME_MS
      const visionAtlanir = budgetLeft() <= visionNeedsMs || visionBeklemeAsiri
      if (analyzeVisuals && visualPlan.indices.length > 0 && visionAtlanir) {
        skippedStages.push('gorsel analiz')
        console.log(
          visionBeklemeAsiri
            ? `Gorsel gecis atlandi: pacer ${visionWaitMs}ms bekletiyor ` +
              `(tavan ${OPSIYONEL_ADIM_MAX_BEKLEME_MS}ms, cagrinin kendisi ~6600ms) — ` +
              `butce ${budgetLeft()}ms olsa bile zenginlestirme icin bu kuyruk beklenmez`
            : `Gorsel gecis atlandi: butce ${budgetLeft()}ms <= ${visionNeedsMs}ms ` +
              `[pacer ${visionWaitMs}ms + cagri ${VISION_CALL_MS}ms + yazar payi ${NARRATIVE_WRITER_RESERVE_MS}ms] — ` +
              `anlati yazarina yer birakiliyor`
        )
      }

      if (analyzeVisuals && visualPlan.indices.length > 0 && !visionAtlanir) {
        try {
          console.log(`Gorsel sayfa secimi: [${visualPlan.indices.join(',')}] — ${visualPlan.reason}`)
          await serviceClient.from('documents').update({ processing_stage: 'visual_analysis' }).eq('id', documentId)
          // Paralel modda PNG yok: secilen sayfalar TEK bir mini-PDF olarak
          // gider (PDF.co adimi ve sayfa sayfa gorsel ucreti yok). Dizi tek
          // elemanli olur; asagidaki data URL mime'i PDF'i tanir.
          let visualImages: string[]
          if (parallelGemini) {
            const subset = await buildPdfSubsetBase64(fileBytes, visualPlan.indices)
            visualImages = subset ? [subset] : []
            console.log(`Gorsel gecis (paralel): ${visualPlan.indices.length} sayfa tek mini-PDF${subset ? '' : ' — URETILEMEDI, atlaniyor'}`)
          } else {
            visualImages = await extractVisualImagesForLongDoc(fileBytes, visualPlan.indices)
          }

          if (visualImages.length > 0) {
            const knownTermsHint = mergedKeyTerms.slice(0, 25).map((t: any) => t.term).filter(Boolean).join(', ')
            /* GORSEL GECIS TASLAKTAKI MADDELERI YENIDEN IFADE EDIYORDU
               (31.10.2026 olcumu).
               Promptta `knownTermsHint` vardi ama yalnizca KAVRAMLARI
               listeliyor ("do not repeat terms already listed above");
               maddeler icin hicbir ipucu yoktu. Olculen sonuc: gorsel gecis
               +5 madde ekledi, dordu taslakta zaten olan bir maddenin
               parafraziydi ve dordu de atifsiz kaldi:
                 "Riemann sums approximate area using thin rectangles..."  vs
                 "Taking the limit of a Riemann sum as the number of
                  rectangles approaches infinity..."              (0,545)
                 "The constant of integration (+ C) accounts for..."       vs
                 "Adding a constant to a function shifts its graph..."     (0,556)
               Kopya birlestirme bunlari YAKALAYAMAZ: 51 kartin 8.333 madde
               ciftinin dagilimi olculdu, 0,4-0,7 bandindaki 18 ciftin 16'si
               GERCEKTEN AYRI (log-linear vs log-log modeli, yerel maksimum
               vs minimum, Asch'in iki ayri istatistigi). Esigi o banda
               cekmek gercek icerik silerdi. Dogru yer kaynak: madde hic
               uretilmesin.
               MADDELER KISALTILIYOR: tamami ~1.800 krk, yani gorsel cagri
               tahminine ~560 token. Ilk 80 karakter konuyu tanitmaya yetiyor
               ve maliyet ucte bire iniyor. Atif isaretcileri atiliyor;
               modele gosterilen sey iddia, numarasi degil. */
            const knownPointsHint = mergedKeyPoints
              .slice(0, 18)
              .map((p: any) => maddeMetni(p).replace(/\s*\[\d+\]/g, '').trim().slice(0, 80))
              .filter(Boolean)
              .map((t: string) => `- ${t}`)
              .join('\n')
            const visualSystemPrompt = `You are an academic study assistant. You are shown page images of the figure/table pages of a lecture document. Their captions were already extracted as text; what you can see and the text cannot is the CONTENT of the graphic itself — the axis ranges, the plotted levels and turning points, the rows of a table, the boxes and arrows of a diagram. Identify exam-relevant content readable in these images that is NOT already covered by these already-known terms: ${knownTermsHint || '(none yet)'}.
The draft ALREADY STATES the key_points below. Do not restate any of them, not even reworded, reordered or generalised — a point that repeats one of these is worse than no point, because the card then shows the same fact twice. Add a key_point only for something these do not already say:
${knownPointsHint || '- (none yet)'}
Respond ONLY with JSON in ${langLabel}: {"key_terms":[{"term":"...","definition":"..."}],"key_points":["..."],"quiz_questions":[{"question":"...","answer":"..."}],"sections":[{"heading":"...","summary":"...","key_points":["..."]}],"tables":[{"title":"...","headers":["..."],"rows":[["..."]]}],"diagrams":[{"title":"...","mermaid":"...","description":"..."}]}
Rules: only include content actually visible in the images; return empty arrays for any field with nothing new; do not repeat terms already listed above. Reconstruct any table you can read as 'tables' and any flowchart/framework/process image as a Mermaid 'diagrams' entry. Never invent one that isn't visibly there.
When a chart's shape carries the lesson — where it peaks, when it falls, which period is highest — write that in WORDS as a key_point. Do not attempt to output a series of numbers.
PHRASE EVERY key_point AND quiz_question AS THE FACT, NEVER AS A DESCRIPTION OF THE FIGURE. Write "Negative priming produced a far more unfavourable impression than positive priming" — never "Figure 3.2 shows that...", "Table 1 lists...", "The chart demonstrates...". A student revising reads the finding, not the figure number, and a question that asks about "the cycle shown in Figure 3.3" is unanswerable once the figure is gone. Do not mention figure, table or slide numbers at all.
Give a numeric value ONLY when that number is PRINTED on the image: an axis tick, a data label, a gridline you can read the plotted point against. If you are estimating a level by eye, say it in relative words instead ("the highest of the five", "roughly double the previous peak", "falls back to about where it started"). A shape described correctly is worth more than a decimal invented to look precise.
The example that used to sit here named a real-looking percentage, and a live run copied that number straight out of this prompt into the summary as if it were read from the chart — attached to the wrong period, no less. So there is no numeric example here on purpose. Any figure in your answer must come from the image in front of you.`

            const visualUserContent = [
              { type: "text", text: "Analyze these slide images for exam-relevant content not already covered." },
              // "JVBER" = "%PDF" base64'te: paralel moddaki mini-PDF. Groq bu
              // mime'i hic gormez, groqViaGemini onu inlineData'ya cevirir.
              ...visualImages.map(b64 => ({
                type: "image_url",
                image_url: { url: `data:${b64.startsWith('JVBER') ? 'application/pdf' : 'image/png'};base64,${b64}` }
              }))
            ]

            // This call does NOT go through callGroqJson, so it has to pay the
            // pacer itself. Skipping that was harmless only while the model
            // id was wrong and every call 404'd: once it actually spends
            // tokens, a pacer that never saw them tells the narrative writer
            // afterwards that there is room, and the writer takes the 429.
            const estVisionTokens =
              visualImages.length * VISION_TOKENS_PER_IMAGE +
              Math.ceil(visualSystemPrompt.length / 3.2) +
              Math.ceil(3072 * PACER_COMPLETION_FACTOR)
            console.log(`Gorsel cagri butcesi: ~${estVisionTokens} token (${visualImages.length} gorsel)`)
            // MODEL_FAST, not a literal: this call and the review/critic passes
            // are the same Groq model, so they must share one lane — Groq
            // counts them against one TPM bucket and so must we.
            // NOT clamped to the OTPM ceiling, unlike review and the critic.
            // This call has run at 3072 on every live run without a single
            // OTPM rejection, while review 429'd at 2500 — which says Groq is
            // metering a rolling window of actual output rather than each
            // request's max_tokens, and this call is simply the first on the
            // qwen lane. Clamping it to ~850 would truncate exactly the
            // diagrams and tables it exists to extract, so it keeps its room
            // and instead RECORDS what it spends, which is what makes review
            // queue behind it correctly a minute later.
            await tokenPacer.acquire(estVisionTokens, MODEL_FAST, VISION_MAX_COMPLETION)

            const visionRes = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                // MODEL_FAST, never a literal. A hardcoded id here is exactly
                // how this call ended up on Groq's retired 3.6 line and 404'd
                // every time ("Long-doc visual patch call returned non-ok
                // status: 404"), and it is also how the id could drift away
                // from the pacer lane keyed above. One constant, one lane.
                model: MODEL_FAST,
                temperature: 0.3,
                // Derived from MODEL_FAST, not written out: if that constant
                // ever moves to a gpt-oss vision model, a literal "none" here
                // would 400 exactly the way review did.
                ...reasoningParamsFor(MODEL_FAST),
                // Raised alongside the compact-window bump (2048 → 3072):
                // these near-blank pages are exactly where a table/chart/
                // diagram is most likely to live, and a Mermaid block or a
                // multi-row table needs the extra room to avoid truncation.
                max_completion_tokens: VISION_MAX_COMPLETION,
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: visualSystemPrompt },
                  { role: "user", content: visualUserContent }
                ]
              })
            }, 0, Math.min(25000, Math.max(10000, budgetLeft() - 15000)))

            // Read the body FIRST so the output spend can be recorded from
            // Groq's own usage figure. That number is what review collides
            // with a minute later under the OTPM ceiling, so guessing it is
            // not good enough: the estimate falls back to the ceiling only
            // when the response does not report one.
            tokenPacer.observeHeaders(visionRes.headers, MODEL_FAST)
            const visionData = visionRes.ok ? await visionRes.json() : null
            // Record the spend either way: a rejected call still consumed the
            // image tokens as far as the minute's budget is concerned, and a
            // successful one must not leave the next caller over-optimistic.
            tokenPacer.record(
              Number(visionData?.usage?.total_tokens) || estVisionTokens,
              MODEL_FAST,
              Number(visionData?.usage?.completion_tokens) || VISION_MAX_COMPLETION
            )

            if (visionData) {
              const visionRaw = visionData.choices?.[0]?.message?.content ?? ""
              const visionStripped = stripThinkBlock(visionRaw)
              const visionCleaned = (visionStripped ?? visionRaw).replace(/```json\s*|```/g, '').trim()
              // Gorsel gecis de model ciktisi: ayni LaTeX kacis sorunu burada
              // da var (09.10.2026'da kurtarma calismasi sirasinda gorundu).
              /* GORSEL GECIS DE KESIK JSON ALIYOR (30.10.2026 olcumu).
                 "Building IS ... Planlama Analysis2" kosusunda:
                   Long-doc visual analysis patch skipped: SyntaxError:
                   Expected ',' or ']' after array element in JSON at
                   position 2414
                 Bu cagri callGroqJson'dan GECMIYOR, kendi JSON.parse'ini
                 yapiyor — yani oradaki kurtarma buraya hic uygulanmiyordu ve
                 butun gorsel katki (tablo, ek kavram, diyagram) dusuyordu.
                 Ayni kurtarma: kapatip yeniden ayristir, tutmazsa null. */
              const visionParsed = visionCleaned ? (() => {
                try {
                  return JSON.parse(repairLatexEscapes(visionCleaned))
                } catch (gorselAyristirmaHatasi) {
                  const kapali = closeTruncatedJson(visionCleaned)
                  if (kapali) {
                    try {
                      const kurtarilan = JSON.parse(repairLatexEscapes(kapali))
                      console.warn(
                        `Gorsel gecis: JSON KESIKTI, kapatilip kurtarildi ` +
                        `(${visionCleaned.length} krk -> ${kapali.length} krk)`
                      )
                      return kurtarilan
                    } catch (_e) { /* kurtarma da tutmadi */ }
                  }
                  throw gorselAyristirmaHatasi
                }
              })() : null

              if (visionParsed && typeof visionParsed === 'object') {
                const newTerms = Array.isArray(visionParsed.key_terms) ? visionParsed.key_terms : []
                const newPoints = Array.isArray(visionParsed.key_points) ? visionParsed.key_points : []
                const newQuiz = Array.isArray(visionParsed.quiz_questions) ? visionParsed.quiz_questions : []
                const newSections = Array.isArray(visionParsed.sections) ? visionParsed.sections : []
                // Tables and diagrams merge into the same arrays the text
                // windows feed. CHARTS DELIBERATELY DO NOT.
                //
                // Reading a plotted series off an image is the one thing in
                // this pass the model cannot do reliably, and a chart is the
                // one output where being approximately right is worse than
                // being absent — it looks authoritative. Measured on the
                // first run where the vision pass worked, against Figure
                // 20.5: it sampled every five years and returned 1980 ≈ 6,
                // missing the series maximum of ~10.6 in 1982 entirely. The
                // same card carried the key point "the five recessionary
                // reference periods show increases in the unemployment rate",
                // so the chart contradicted the card's own text. The GDP
                // chart flattened a log-scale axis into a linear one and
                // erased the Great Depression trough with it.
                //
                // The prompt now asks for that reading in WORDS instead, which
                // keeps the fact and cannot be misread as a measured series.
                //
                // It used to demonstrate that with a worked example naming a
                // real percentage. That example leaked: on 04.10.2026 the
                // summary came back claiming unemployment peaked at "10.6% in
                // 2008-09" — the number lifted verbatim out of this prompt and
                // pinned to the wrong decade (the real 2008-09 peak is ~10%,
                // and 10.6 belongs to 1982, which is where the example got it).
                // A concrete figure inside an instruction is indistinguishable
                // from a figure read off the page, so the prompt now carries
                // no numeric example at all and asks for a value only when one
                // is actually printed on the image.
                //
                // Charts from the TEXT windows are unaffected; those come from
                // figures a document actually tabulates.
                const newTables = Array.isArray(visionParsed.tables) ? visionParsed.tables : []
                const newDiagrams = Array.isArray(visionParsed.diagrams) ? visionParsed.diagrams : []
                const droppedVisionCharts = Array.isArray(visionParsed.charts) ? visionParsed.charts.length : 0
                if (droppedVisionCharts > 0) {
                  console.log(`Gorsel gecis: ${droppedVisionCharts} grafik alinmadi (gorselden okunan seri guvenilir degil, kelimeyle isteniyor)`)
                }

                // Everything this pass contributes is grounded in the IMAGE,
                // which applyGroundingGate cannot read — see visionGrounded
                // there. Without this the gate calls the pass's own findings
                // fabrications: it dropped "Oil shock", read correctly off
                // Figure 20.2's annotations, on the first run that worked.
                for (const t of newTerms) {
                  const n = gateNormalize(String(t?.term || ''))
                  if (n) visionGroundedClaims.add(n)
                  const term = String(t?.term || '').trim()
                  const def = String(t?.definition || '').trim()
                  if (term) visionNotes.push(def ? `${term}: ${def}` : term)
                }
                for (const p of newPoints) {
                  const n = gateNormalize(typeof p === 'string' ? p : String(p?.text || p?.point || ''))
                  if (n) visionGroundedClaims.add(n)
                  const text = (typeof p === 'string' ? p : String(p?.text || p?.point || '')).trim()
                  if (text) visionNotes.push(text)
                }

                if (newTerms.length || newPoints.length || newQuiz.length) {
                  const patchedTerms = dedupeKeyTerms([...mergedKeyTerms, ...newTerms]).slice(0, 40)
                  const patchedPoints = dedupeByText([...mergedKeyPoints, ...newPoints], maddeMetni).slice(0, 35)
                  const patchedQuiz = dedupeByText([...mergedQuiz, ...newQuiz], (q: any) => q?.question || '').slice(0, 20)
                  mergedKeyTerms.length = 0; mergedKeyTerms.push(...patchedTerms)
                  mergedKeyPoints.length = 0; mergedKeyPoints.push(...patchedPoints)
                  mergedQuiz.length = 0; mergedQuiz.push(...patchedQuiz)
                }
                /* MADDESIZ BOLUM EKLENMIYOR (30.10.2026, bes kartta ust uste).
                 *
                 * Gorsel gecisin bolum semasinda `key_points` alani HIC
                 * yoktu, yani bu cagri tasarim geregi yalnizca baslik +
                 * ozet uretiyordu. Sonuc: kartin son bolumu her seferinde
                 * madde listesi olmadan ciziliyor, oteki butun bolumlerde
                 * madde var. Olculen ornek:
                 *   05  "System Analysis and Design Overview"  -> 0 madde
                 *
                 * Semaya key_points eklendi ama prompt garanti degil. Hala
                 * maddesiz geliyorsa o bolum ATILIYOR ve bu KAYIP DEGIL:
                 * ayni cagri `+N points` ile zaten icerigi veriyor. Bu
                 * kartta gorsel gecis 4 madde ekledi ve o dort madde tam o
                 * bolumun anlattigi seyi tasiyor; bolum yalnizca slaydi
                 * tarif eden bir cumleydi. */
                const maddeliBolumler = newSections.filter((sec: any) => {
                  const m = Array.isArray(sec?.key_points)
                    ? sec.key_points.filter((x: any) => String(x ?? '').trim()).length
                    : 0
                  return m > 0
                })
                const maddesizAtilan = newSections.length - maddeliBolumler.length
                if (maddesizAtilan > 0) {
                  console.log(
                    `Gorsel yama: ${maddesizAtilan} bolum MADDESIZ geldi, eklenmedi ` +
                    `(icerigi ayni cagrinin maddelerinde duruyor)`
                  )
                }
                if (maddeliBolumler.length) {
                  const oncekiBolum = bestSections.length
                  bestSections = dedupeBolumler(bestSections.concat(maddeliBolumler))
                  const birlesen = oncekiBolum + maddeliBolumler.length - bestSections.length
                  if (birlesen > 0) {
                    console.log(
                      `Gorsel yama: ${birlesen} bolum metin pencereleriyle ayniydi, birlestirildi ` +
                      `(${oncekiBolum} + ${maddeliBolumler.length} -> ${bestSections.length})`
                    )
                  }
                }
                /* FILTRE YALNIZCA YENI KAYITLARA (24.10.2026).
                 *
                 * Sekil filtresi BIRLESTIRILMIS dizinin tamamina
                 * uygulaniyordu, yani metin pencerelerinden gelmis saglam
                 * bir tablo da sekil kontrolune giriyordu. Gorsel gecis en az
                 * bir tablo dondurdugu ANDA, basligi olmayan ya da `rows`
                 * yerine baska alan tasiyan eski kayitlar siliniyordu —
                 * gorsel gecis hic calismadigi kosuda ayni tablolar karta
                 * giriyordu. Yani kayip, ILGISIZ bir adimin calisip
                 * calismamasina bagliydi ve hicbir log bunu bildirmiyordu:
                 * "Long-doc visual patch: +N tables" yalnizca EKLENENI sayar.
                 *
                 * Ikinci kayip dedupeByText'in kendisinde: anahtar bos
                 * normalize olursa kayit atiliyor (`if (!norm) continue`),
                 * yani BASLIKSIZ bir tablo baslikla ayiklanirken dusuyor.
                 * Davranis korunuyor (baslik olmadan ayiklama yapilamaz) ama
                 * artik kac kayit dustugu loglaniyor. */
                const yamaKaybiLogla = (ad: string, once: number, sonra: number, eklenen: number) => {
                  const beklenen = once + eklenen
                  if (sonra < beklenen) {
                    console.warn(
                      `Gorsel yama ${ad}: ${beklenen - sonra} kayit birlesmede dustu ` +
                      `(${once} mevcut + ${eklenen} yeni -> ${sonra}); basligi olmayan ya da ` +
                      `tekrar eden kayitlar ayiklanir`
                    )
                  }
                }
                if (newTables.length) {
                  const yeniTemiz = newTables.filter(
                    (t: any) => t && t.title && Array.isArray(t.rows) && t.rows.length > 0
                  )
                  const once = mergedTables.length
                  const patchedTables = dedupeByText(
                    [...mergedTables, ...yeniTemiz], (t: any) => t?.title || ''
                  ).slice(0, 12)
                  yamaKaybiLogla('tablo', once, patchedTables.length, yeniTemiz.length)
                  mergedTables.length = 0; mergedTables.push(...patchedTables)
                }
                if (newDiagrams.length) {
                  const yeniTemiz = newDiagrams.filter((d: any) => d && d.title && d.mermaid)
                  const once = mergedDiagrams.length
                  const patchedDiagrams = dedupeByText(
                    [...mergedDiagrams, ...yeniTemiz], (d: any) => d?.title || ''
                  ).slice(0, 8)
                  yamaKaybiLogla('diyagram', once, patchedDiagrams.length, yeniTemiz.length)
                  mergedDiagrams.length = 0; mergedDiagrams.push(...patchedDiagrams)
                }

                visualAnalysisUsed = true
                console.log(`Long-doc visual patch: +${newTerms.length} terms, +${newPoints.length} points, +${newQuiz.length} quiz, +${maddeliBolumler.length} sections, +${newTables.length} tables, +${newDiagrams.length} diagrams (grafik alinmaz) from ${visualImages.length} sekil sayfasi`)
              }
            } else {
              console.warn(`Long-doc visual patch call returned non-ok status: ${visionRes.status}`)
            }
          }
        } catch (visualPatchErr) {
          console.warn('Long-doc visual analysis patch skipped:', visualPatchErr)
        }
      }

      // Guarantee non-empty executive from terms if needed
      if (!bestExec && mergedKeyTerms.length) {
        bestExec = lang === 'tr'
          ? `Belge başlıca şu konuları kapsar: ${mergedKeyTerms.slice(0, 6).map((t: any) => t.term).join(', ')}.`
          : `This document covers: ${mergedKeyTerms.slice(0, 6).map((t: any) => t.term).join(', ')}.`
      }
      if (!bestSummary && mergedKeyPoints.length) {
        bestSummary = mergedKeyPoints.slice(0, 10).map((p: string) => `• ${p}`).join('\n')
      }

      const mergedDraft = {
        summary: bestSummary || '',
        summary_executive: bestExec || '',
        /* Sabit 'Lecture Notes/Slides' idi — kitap bolumu de "slayt"
           sayiliyordu. Deste tespiti (detectSlideDeck) bu yolda zaten var;
           deste degilse turu bilmiyoruz ve "Other" durustce bunu soyluyor. */
        document_type: deste.isDeck ? 'Lecture Notes/Slides' : 'Other',
        suggested_course_tag: katalogdanDersEtiketi(courseCatalogBlock, extractedText),
        is_quantitative: quantFraction >= 0.3,
        key_terms: mergedKeyTerms,
        key_points: mergedKeyPoints,
        quiz_questions: mergedQuiz,
        tables: mergedTables,
        charts: mergedCharts,
        formulas: mergedFormulas,
        worked_examples: mergedWorkedExamples,
        diagrams: mergedDiagrams,
        concept_graph: { nodes: [], edges: [] },
        footnotes: [],
        outline: normalizeOutline(bestOutline, bestSections),
        sections: normalizeSections(bestSections, normalizeOutline(bestOutline, bestSections)),
        cloze_cards: [] as any[]
      }

      console.log(`Long-doc merge: terms=${mergedKeyTerms.length} points=${mergedKeyPoints.length} quiz=${mergedQuiz.length} sections=${bestSections.length} tables=${mergedTables.length} charts=${mergedCharts.length} diagrams=${mergedDiagrams.length} worked_examples=${mergedWorkedExamples.length} summaryLen=${(mergedDraft.summary || '').length}`)
      console.log(`Birlesim sayisal kapsama: ${formatCoverage(numericCoverage(extractedText, mergedDraft))}`)
      if (dusenPencereler.length > 0) {
        const kayipKrk = dusenPencereler.reduce((n, p) => n + (windows[p - 1]?.length || 0), 0)
        console.error(
          `EKSIK BELGE: ${dusenPencereler.length}/${windows.length} pencere dustu ` +
          `[${dusenPencereler.join(',')}] — ${kayipKrk} karakter (belgenin ` +
          `%${Math.round((100 * kayipKrk) / Math.max(1, extractedText.length))}'i) karta hic girmedi`
        )
        eksikPencereler = { dusen: dusenPencereler.length, toplam: windows.length, kayipKrk }
      }

      rawContent = JSON.stringify(mergedDraft)
      // THE SOURCE, not a summary of it (05.10.2026).
      //
      // This used to be the windows' own summaries, each cut to 500 chars:
      //
      //   windowResults.map((r, i) => `Part ${i+1}: ${r.summary.slice(0,500)}`)
      //
      // So the pass whose job is to check the draft against the document was
      // handed a summary of the draft instead. It could confirm the draft was
      // consistent with itself and nothing more — a hallucination that made it
      // into every window would read as perfectly grounded. Review said so
      // itself once the verdict was logged: "The source text provided is
      // truncated and does not contain t[he ...]".
      //
      // Every document over CHUNK_THRESHOLD (6,000 chars) takes this path, so
      // this was the state for every real document.
      //
      // There is room for the real thing now: review no longer receives the
      // whole draft JSON (see buildReviewUserPrompt), which was ~14,000 of the
      // ~20,000 characters going into the call. The tiers below trim this if a
      // document is genuinely too big.
      sourceTextForReview = extractedText
      if (sourceTextForReview.length > 14000) {
        sourceTextForReview = sourceTextForReview.substring(0, 14000) + ' [truncated for review]'
      }
    }

    // Pass 2: Madde 4 — Grounding + Critic quality gate
    const citationUnit = pageMarkerLabel === 'SLAYT' ? 'slayt' : 's.'
    const reviewSystemPrompt = `You are a strict academic quality critic AND copy-editor for a student study brief (NotebookLM-grade). Compare the draft against the source text.

QUALITY RUBRIC (must evaluate):
A) Opening — does the summary open by saying what the material teaches (its topics and main results)? Lecture material has topics, not a "thesis": never ask for one.
B) Hallucination — any claim not supported by source must be removed or softened
C) Completeness — major topics from outline/sections present in the narrative?
D) Admin noise — grading, attendance, office hours, textbook edition MUST be removed
E) Grounding — specific facts (numbers, dates, named findings) should cite source location when markers exist
F) Structure — preserve narrative prose if the draft summary is already flowing paragraphs (Madde 3 writer). Only keep bullet/outline form if the draft summary itself is clearly bullets/outline. Do NOT convert a polished narrative back into fragments.

CITATIONS / GROUNDING — DO NOT ADD PAGE NUMBERS.
Citations are attached deterministically after you, by code that indexes the
WHOLE document. You are shown only a truncated slice of the source, so any
(${citationUnit} N) you write would be anchored to the part you happen to see
rather than to where the claim actually comes from. ${hasPageMarkers
  ? `A live run proved this: every one of 11 markers you added came out as "(${citationUnit} 1)", for facts spread across 30 pages.`
  : `Page markers are not even available here.`}
So: do not write (${citationUnit} N) markers, and do not invent page numbers.
Keep any marker the draft already had exactly as it is. Judge grounding by
whether the source supports a claim, and report what it does not in "issues".

FOOTNOTES: Preserve existing footnote page values when present; only change if the visible source clearly contradicts them.

SECTIONS / OUTLINE: Preserve structure; refine inaccurate section summaries; remove admin-only sections.

OUTPUT — READ CAREFULLY. Respond ONLY with a single JSON object. Do NOT
re-emit the study card, and do NOT rewrite the summary. Return your
CORRECTIONS and your verdict, as JSON:

{ "corrections": [ { "find": string, "replace": string } ], "summary_executive": string, "footnotes": [ { "id": number, "reference": string, "page": number | null } ], "quality_gate": { "pass": boolean, "grounded": boolean, "issues": [ string ] } }

- "corrections": the sentences in the draft summary that are WRONG, and what
  they should say. At most 8. "find" must be copied EXACTLY from the draft
  summary, character for character, and must be long enough to appear only
  once — a whole sentence is right, three words is not. "replace" is that
  sentence corrected. A correction whose "find" cannot be located is thrown
  away, so copy carefully rather than paraphrasing.
  Correct: a wrong year, a figure attributed to the wrong period, a claim the
  visible source positively contradicts, admin noise that survived. Return []
  when the narrative is sound — an empty list is a perfectly good answer, and
  inventing changes to look thorough makes the card worse.
  NEVER TURN "I CANNOT FIND IT" INTO "THE SOURCE DOES NOT HAVE IT". You see a
  truncated slice, exactly as with page numbers above, so a topic missing from
  your slice is most likely in the part you cannot see. Writing "the source
  does not discuss X" is therefore a claim you are structurally unable to
  verify, and a live run proved the damage: a 42-slide econometrics deck whose
  summary ended up asserting the source did not cover log-log models or
  elasticity, while the deck had a slide titled "Log-Log Model" reading "In the
  log-log model β is an elasticity" — and the same summary carried a whole
  section, a key term and an exam question on it. Only correct a claim when
  the text you CAN see says something different; silence is not disagreement.
  Do NOT rewrite sentences merely to restyle them.
- "summary_executive": the corrected executive summary, in full. It is short,
  so it fits.
- "footnotes": optional. Omit the field entirely if you are not changing it.

Why corrections and not a rewrite: your reply is capped at a few hundred
tokens, and the summary alone is longer than that. Asked for the whole thing
you would have to compress it, and a measured run did exactly that — 2,157
characters came back as 635, losing three quarters of the card to make room.
Your edits are applied to the original text, so the summary keeps its length
and gets your fixes.
- "quality_gate":
  - pass=false only for serious problems (hallucinations, heavy admin noise
    left in). Before calling a claim unsupported, search the WHOLE source
    text for its key term — late slides are easy to miss.
  - grounded=true if important claims are citation-backed or source clearly
    supports them
  - issues: short list of remaining concerns, naming anything wrong in
    key_terms / key_points / quiz_questions so it can be fixed separately
    (empty array if clean)

key_terms, key_points, quiz_questions, sections and outline are NOT yours to
rewrite — leave them out of your answer completely. They are carried over
from the draft unchanged. Report problems with them in "issues" instead.
This keeps your answer short enough to finish; an answer that runs out of
room is worse than no answer.
Preserve summary_executive, outline, and deep sections unless clearly wrong.
DO NOT include "tables", "charts", "diagrams", "worked_examples", "formulas", "concept_graph", or "cloze_cards" in your output at all — omit those keys entirely. They are extracted/validated separately outside this review step and are not part of your job; re-emitting them here only burns completion-token budget that "summary"/"sections"/"key_points" need.`

    function buildReviewUserPrompt(sourceBudgetChars: number): string {
      let trimmedSource = sourceTextForReview
      if (sourceBudgetChars <= 0) {
        trimmedSource = "[omitted to fit token limits — rely on the draft's internal consistency]"
      } else if (trimmedSource.length > sourceBudgetChars) {
        trimmedSource = trimmedSource.substring(0, sourceBudgetChars) + " [truncated for review]"
      }
      // Send ONLY the narrative under review, not the whole draft card.
      //
      // The full JSON was ~14,000 of the ~20,000 characters in this call —
      // 32 key terms, 16 key points, 13 quiz questions, sections, outline —
      // none of which review may rewrite any more. It was spending two thirds
      // of its input budget on material it cannot touch, while the source it
      // must check against was cut to 4,000 characters.
      //
      // Swapping them costs nothing and buys review the whole document.
      let narrative = ''
      try {
        const d = JSON.parse(repairLatexEscapes(rawContent))
        narrative = JSON.stringify({
          summary: d?.summary ?? '',
          summary_executive: d?.summary_executive ?? ''
        }, null, 1)
      } catch {
        // Unparseable draft: fall back to the raw text rather than sending
        // nothing, so review still has something to check.
        narrative = rawContent.slice(0, 4000)
      }
      // Figure annotations live in the images, never in the extracted text.
      // Without this block review would treat every correct chart reading as
      // unsupported, and could not catch a wrong one either. See visionNotes.
      const figureBlock = visionNotes.length
        ? `\n\nRead from the document's FIGURES and TABLES (page images, not present in the text above — treat these as source, equally authoritative):\n${visionNotes.slice(0, 20).map(n => `- ${n}`).join('\n')}`
        : ''

      return `Original requested format parameters:
- Summary Style: ${style}
- Summary Length: ${len}
- Summary Language: ${lang}

Original source text:
${trimmedSource}${figureBlock}

The draft narrative you are reviewing (these two fields only — the rest of
the study card is not yours to change, and is not shown):
${narrative}`
    }

    // ==========================================================================
    // MADDE 3 — NARRATIVE WRITER (professional prose summary)
    // Madde 6: skipped for depth=brief; expanded for depth=deep
    // ==========================================================================
    try {
      if (depthFlags.skipNarrativeWriter) {
        console.log('Madde 6: skipping narrative writer (depth=brief)')
      } else if (budgetLeft() < NARRATIVE_WRITER_RESERVE_MS) {
        // UCUZ TABAN. Gercek karar asagida, serit ve prompt belli olunca
        // OLCULEREK veriliyor (bkz. yazarGereken). Burada duran duz 35 sn,
        // 09.10.2026'da 30.757 ms kalan bir kosuda yazari atlatti ve ozet
        // tek kisa paragraf kaldi — oysa yazarin seridi bostu ve cagri
        // birkac saniye surecekti. Review kapisi ayni hatadan donmustu.
        console.log('Madde 3: anlati yazari atlandi (butce', budgetLeft(), 'ms)')
        skippedStages.push('anlati yazari')
      } else {
      await serviceClient.from('documents').update({ processing_stage: 'writing' }).eq('id', documentId)

      let draftObj: any = null
      try {
        const strippedDraft = stripThinkBlock(rawContent)
        draftObj = JSON.parse(repairLatexEscapes((strippedDraft ?? rawContent).replace(/```json\s*|```/g, '').trim()))
      } catch (_e) {
        draftObj = null
      }

      if (draftObj && typeof draftObj === 'object') {
        const outlineItems = Array.isArray(draftObj.outline?.items) ? draftObj.outline.items : []
        const sectionItems = Array.isArray(draftObj.sections) ? draftObj.sections : []
        const outlineBlock = outlineItems
          .map((it: any) => `- ${it.heading}${it.blurb ? ': ' + it.blurb : ''}`)
          .join('\n')
          .slice(0, 2500)
        const sectionsBlock = sectionItems
          .map((s: any) => `## ${s.heading}\n${(s.summary || '').slice(0, depthFlags.longNarrative ? 900 : 600)}`)
          .join('\n\n')
          /* YAZARIN ISTEGI GERCEK TPM TAVANINI ASIYORDU (21.10.2026).
           *
           * Olculen: writerSys 2.234 krk, writerUser tavanlarinin toplami
           * 20.300 krk. estimateTokens = (2.234 + 20.300)/3,2 + 0,6x2048 =
           * 8.271 token; derin modda (completion 3072) 8.886. Seridin
           * GERCEK limiti 8.000 (DEFAULT_TPM_LIMIT) — yani yazarin istegi
           * tek basina tavani asiyor ve sogùk seritte gectiginde Groq'un
           * kendisi "Request too large" ile reddetmeye adaydi.
           *
           * BU KIRPMA SURE KAZANDIRMIYOR, bilerek yaziyorum: pencerelerin
           * biraktigi bosluk HEAVY'de 7.200-5.747 = 1.453, EXTRACT'te 1.105
           * token. Kirpilmis est 6.709 bile bunun dort kati, yani yazar yine
           * yalnizca `used === 0` kolundan (bkz. waitFor) geciyor ve seridin
           * tamamen bosalmasini bekliyor. Harcama tek bir kayit olarak
           * atomik eskidigi icin daha kucuk bir est beklemeyi kisaltmiyor da.
           * Kazanc: istek gercek tavanin altina iniyor ve tahmin durustlesiyor.
           *
           * Sureyi dusuren sey ucuncu bir serit; bkz. pacer denetimi. */
          /* Derin modda da 5.000: o yol completion'i 2048 yerine 3072
             istiyor, yani rezervasyon 1.229 degil 1.844 token. Bolum
             metnine fazladan 500 krk vermek payi 216 token'a dusuruyordu;
             tek sayi hem daha basit hem daha guvenli (pay 373). */
          .slice(0, 5000)

        const lengthHint =
          depthFlags.longNarrative || len === 'detailed' || len === 'long'
            ? 'Write a thorough brief of 5-8 paragraphs (roughly 450-750 words).'
            : len === 'short'
            ? 'Write about 2-3 dense paragraphs (roughly 180-280 words).'
            : 'Write a clear brief of 3-5 paragraphs (roughly 280-450 words).'

        const keyTermsBlock = (Array.isArray(draftObj.key_terms) ? draftObj.key_terms : [])
          .slice(0, 25)
          .map((t: any) => `- ${t?.term || t}: ${t?.definition || ''}`)
          .join('\n')
          .slice(0, 2000)
        const keyPointsBlock = (Array.isArray(draftObj.key_points) ? draftObj.key_points : [])
          .slice(0, 20)
          .map((p: any) => `- ${typeof p === 'string' ? p : ''}`)
          .join('\n')
          .slice(0, 2000)
        // Yazar formulleri ve cozumlu orneklerin SONUCLARINI hic gormuyordu;
        // ozetin sayisiz ve formulsuz cikmasinin bir nedeni buydu (09.10.2026:
        // iki canli ozette de sifir sayisal bulgu). Adlari ve sonuclari yeter.
        const formulasBlock = (Array.isArray(draftObj.formulas) ? draftObj.formulas : [])
          .slice(0, 14)
          .map((f: any) => `- ${String(f?.name || '').slice(0, 60)}: ${String(f?.latex || '').slice(0, 140)}`)
          .join('\n')
          .slice(0, 1600)
        // Aritmetigi tutmayan ornek yazara da gitmez — kapi asagida karttan
        // atacak; sonucunu ozete tasimak onu arka kapidan geri sokmak olurdu.
        const workedBlock = gateWorkedExampleArithmetic(normalizeWorkedExamples(draftObj.worked_examples)).kept
          .slice(0, 5)
          .map((w: any) => `- ${String(w?.title || '').slice(0, 70)}: ${String(w?.final_answer || '').slice(0, 220)}`)
          .join('\n')
          .slice(0, 1200)

        const writerSys = `You are an expert academic writer for university study briefs (NotebookLM-grade).
Respond with ONLY valid JSON: { "summary": string, "summary_executive": string }.

GOAL:
Write "summary" as a cohesive NARRATIVE in ${langLabel} that a student could study from — concrete topics, methods, definitions, and takeaways from THIS document only.
${lengthHint}

HARD RULES (violations = failure):
1. Use CONCRETE content from the inputs: named topics, techniques, formulas, metrics, chapter themes. Quote or paraphrase real substance.
2. NEVER write generic filler. Forbidden phrases/patterns include:
   - "qualitative overview", "scholarly landscape", "theoretical terrain", "conceptual depth"
   - "broader academic field", "interrelated ideas", "forward-looking synthesis"
   - "Introduction / Main Discussion / Conclusion" as the only structure when inputs name specific topics
   - Empty abstractions like "key concepts", "theoretical frameworks", "implications" without naming what they are
3. If outline/sections name specific subjects (e.g. supervised learning, neural networks, precision/recall), those subjects MUST appear in the summary by name.
4. Do NOT invent theories, numbers, or conclusions absent from inputs.
5. No grading/attendance/office-hours/textbook logistics.
6. "summary_executive" = 2-3 sentences naming the actual subject of the document (not vague "this document discusses theories").
7. FORMAT — the student reads this first, so it must scan:
   - Paragraphs separated by a blank line (\\n\\n), as many as the length line above asks for. Never one block of text.
   - LaTeX inside prose: DOUBLE the backslash (\\\\frac, \\\\sum_{i=1}) — a lone \\n is a line break, never the start of a command name.
   - Open each paragraph with a bold lead-in that names its topic and ends with a period, e.g. "**Dummy variables shift the intercept.** A qualitative variable…". No markdown headings (#).
   - When the inputs give results, state them WITH their numbers: coefficients, % changes, significance levels, turning points, fit (R²).
   - Teach the content directly. Never narrate the document: no "This brief/chapter presents…", "The X section explains…", "It begins with a thesis…".
8. If inputs are thin or mostly empty, write a SHORT honest note about limited extractable content — do NOT pad with generic academic prose.`

        const writerUser = `Existing executive (refine only if it names real topics; otherwise rewrite from inputs):
${(draftObj.summary_executive || '').slice(0, 500)}

Document outline (USE these real headings):
${outlineBlock || '(none)'}

Deep section summaries (primary factual source):
${sectionsBlock || '(none)'}

Key terms from the document:
${keyTermsBlock || '(none)'}

Key points from the document:
${keyPointsBlock || '(none)'}

Formulas (cite the central ones inline, in plain text):
${formulasBlock || '(none)'}

Worked results (numbers you may state):
${workedBlock || '(none)'}

Existing draft summary (keep factual content; rewrite only for flow):
${String(draftObj.summary || '').slice(0, 1500)}`

        // MODEL_HEAVY first — this is the one call where prose quality is the
        // product. But a 57s queue for it, measured on 05.10.2026, is not a
        // quality decision; it is the difference between a written summary and
        // the skipped-writer path that leaves the card with none. When heavy
        // is busy and extract is free, take extract.
        const writerCompletion = depthFlags.longNarrative || len === 'long' || len === 'detailed' ? 3072 : 2048
        const writerLane = pickLane(
          [MODEL_HEAVY, MODEL_EXTRACT],
          estimateTokens(writerSys, writerUser, writerCompletion),
          writerCompletion
        )
        if (writerLane !== MODEL_HEAVY) {
          console.log(`Madde 3: yazar ${writerLane} seridine alindi (${MODEL_HEAVY} mesgul)`)
        }
        // OLCULMUS KAPI: pacer'in bu serit icin soyledigi bekleme + cagrinin
        // kendisi. Serit bossa bekleme 0'dir ve yazar 30 sn kalan butceyle de
        // calisir; serit gercekten doluysa zaten atlanir.
        const yazarBekleme = tokenPacer.waitEstimate(
          estimateTokens(writerSys, writerUser, writerCompletion),
          writerLane,
          writerCompletion
        )
        const yazarGereken = yazarBekleme + WINDOW_CALL_MS
        if (budgetLeft() < yazarGereken) {
          console.log(
            `Madde 3: anlati yazari atlandi (butce ${budgetLeft()}ms, ` +
            `gereken ${yazarGereken}ms [pacer ${yazarBekleme}ms + cagri ${WINDOW_CALL_MS}ms])`
          )
          skippedStages.push('anlati yazari')
          throw new Error('__yazar_butce__')
        }
        /* IKINCI DENEME ANCAK SIGARSA (25.10.2026). maxRetries sabit 1'di:
           zaman asiminda fetchWithRetry ayni sureyi bir kez DAHA bekliyor,
           yani yazar kalan butcenin iki katini harcayabiliyordu. Akan Gemini
           akisi uzatildiktan sonra yazar ~24 sn kalanla basliyor; iki
           deneme orada 150 sn duvarini asar ve belge 'processing'te kalir. */
        const yazarZamanAsimi = Math.min(35000, Math.max(12000, budgetLeft() - 5000))
        const yazarYenidenDene = budgetLeft() >= yazarZamanAsimi * 2 + 1000 ? 1 : 0
        const written = await callGroqJson(groqApiKey, writerSys, writerUser, {
          model: writerLane,
          temperature: 0.2,
          maxCompletionTokens: writerCompletion,
          timeoutMs: yazarZamanAsimi,
          maxRetries: yazarYenidenDene
        })

        // Reject generic filler narratives — keep pre-writer draft if detection fires
        const candidateSummary = written?.summary ? String(written.summary).trim() : ''
        const candidateExec = written?.summary_executive ? String(written.summary_executive).trim() : ''
        const genericHits = [
          /qualitative overview/i,
          /scholarly landscape/i,
          /theoretical terrain/i,
          /broader (academic|scholarly) (field|landscape)/i,
          /forward-?looking synthesis/i,
          /conceptual (depth|clarity|map|threads)/i,
          /non-?quantitative (understanding|comprehension)/i,
          /interrelated ideas/i,
          /essential terminology that will frame/i
        ].filter((re) => re.test(candidateSummary) || re.test(candidateExec)).length
        const hasConcreteFromInput = (() => {
          const bag = `${outlineBlock}\n${keyTermsBlock}\n${keyPointsBlock}`.toLowerCase()
          const tokens = bag.split(/[^a-zçğıöşü0-9]+/i).filter((t) => t.length >= 6).slice(0, 40)
          if (tokens.length < 3) return true // cannot judge
          const lower = candidateSummary.toLowerCase()
          let hits = 0
          for (const t of tokens) if (lower.includes(t)) hits++
          return hits >= 2
        })()
        const acceptWriter = candidateSummary.length > 80 && genericHits === 0 && hasConcreteFromInput
        if (acceptWriter) {
          draftObj.summary = candidateSummary
          if (candidateExec.length > 20) draftObj.summary_executive = candidateExec
          console.log('Madde 3: narrative writer accepted')
        } else {
          console.warn(`Madde 3: narrative writer REJECTED (genericHits=${genericHits}, concrete=${hasConcreteFromInput}) — keeping draft`)
        }
        rawContent = JSON.stringify(draftObj)
        console.log('Madde 3: narrative writer done, depth=' + depth)
      }
      } // end else !skipNarrativeWriter
    } catch (writerErr) {
      // Butce kapisi zaten kendi satirini yazdi; burada tekrar etme.
      if (String((writerErr as any)?.message || '') !== '__yazar_butce__') {
        console.warn('Madde 3 narrative writer skipped (keeping draft summary):', writerErr)
      }
    }

    // Madde 6: progressive signal — draft exists, review may follow
    await serviceClient
      .from('documents')
      .update({ processing_stage: 'draft_ready' })
      .eq('id', documentId)

    // Skip review only for short single-pass docs, or any chunked long doc
    // that is genuinely out of time budget.
    // Denetim Raporu, 2026-08-31: this used to ALSO skip review for every
    // chunked document unless depth === 'deep' — meaning the hallucination/
    // grounding check never ran on a standard-depth long document, no matter
    // how much time budget was actually left. That was a blunt, static proxy
    // for "will this run out of time" when a real, dynamic measurement of
    // the same thing already exists one line above: budgetLeft() < 55_000.
    // Long documents need this check MORE than short ones (more windows to
    // go wrong, more room for the merge step to introduce inconsistencies),
    // so the time-budget check is now the only gate — review runs on every
    // chunked document depth gets, as long as there is genuinely enough
    // wall-clock left to do it safely.
    // Groq enforces a tokens-per-minute cap per model (as low as 8000 on
    // this account). A long/detailed draft plus the reference source text
    // can occasionally exceed it even after the 6,000-char truncation above.
    // Rather than fail outright, retry with progressively smaller reference-
    // text AND completion budgets together (the draft JSON itself is never
    // trimmed, since that would lose content from the final output).
    //
    // Declared above the gate because the gate needs tier 0's size to ask the
    // pacer what the call would cost in time.
    // Completion budgets sized for what review now RETURNS, not for the whole
    // study card it used to re-emit: a ~950-char summary (~300 tokens), a
    // short executive summary and quality_gate fit well inside 850. The old
    // 2500/1800/1200 ladder was both unnecessary after the contract was
    // narrowed AND impossible — qwen's OTPM ceiling is 1000, so every rung
    // 429'd on 04.10.2026 before the model saw a single token of the draft.
    // clampCompletion() enforces the ceiling independently, in case this list
    // and MODEL_OTPM ever drift apart.
    // Source budgets raised now that the draft card no longer rides along:
    // 11,000 characters covers the whole reference document, which is the
    // point — review cannot check a claim against a source it was not shown.
    // These are CONTENT budgets — what the answer itself needs. The number
    // actually sent adds reasoning headroom per lane, see reviewCompletionFor.
    const reviewTiers: Array<{ sourceChars: number; maxCompletionTokens: number }> = [
      { sourceChars: 11000, maxCompletionTokens: Math.min(850, REVIEW_MAX_COMPLETION) },
      { sourceChars: 5000, maxCompletionTokens: 700 },
      { sourceChars: 1500, maxCompletionTokens: 550 }
    ]

    // WHY THIS IS NOT A FLAT 55s ANY MORE (2026-10-04, measured):
    // A live run finished all its work at 73.6s of a 110s budget, yet review
    // was skipped at 72.2s because budgetLeft() was 39.2s and the gate wanted
    // 55s. The 55s came from the era of ONE shared token ledger, where any
    // call might have to sit out a whole 60s window. With per-model lanes the
    // review call runs on MODEL_FAST and the pacer can say exactly how long
    // that lane would make it wait — in that run, about 4 seconds. The gate
    // was refusing a ~15s job because it assumed a ~55s one.
    //
    // So: ask the pacer, add the work itself, compare to what is left. Still
    // skips when the lane really is full (waitEstimate returns the real ~55s
    // and the sum exceeds the budget), which is the case the 55s was for.
    /* ==========================================================================
       KADEMEYI BUTCE SECER, HEP EN BUYUGU DEGIL (09.10.2026)

       Review iki ardisik canli kosuda da hic calismadi:
         "Review atlandi (budgetLeft=35070ms, gereken=83237ms
          [pacer beklemesi 50237ms + 1 deneme x 25000ms + kuyruk 8000ms],
          est=7200 token)"
       Yani kalite kapisi ve duzeltme adimi bu belgede hic devreye girmiyor.

       Sebep fiyatlamada: kapi HER ZAMAN reviewTiers[0]'i (11.000 karakter
       kaynak) fiyatliyordu. O cagri tek basina ~7.200 token, yani bir seridin
       butun dakikasi; pencereler ve gorsel gecis sonrasi butun seritler sicak
       oldugu icin pacer tam bir pencere (50 sn) bekleme soyluyor ve kapi
       review'i tamamen atiyordu. Oysa 5.000 ve 1.500 karakterlik iki kucuk
       kademe zaten tanimli ve dongu onlari kullanabiliyor — kapi onlari hic
       denemiyordu.

       Artik kademeler sirayla fiyatlaniyor ve butceye SIGAN ilki seciliyor;
       hicbiri sigmazsa review yine atlanir. Serit secimi de o kademenin
       tahminiyle yapiliyor: kucuk kademe daha cok seride sigar.

       Kucuk dilimin riski — review'in gormedigi konuyu "kaynakta yok"
       sanmasi — bu projede ayrica kapatildi: filterReviewIssues o maddeyi
       dusuruyor ve kaynakIcerigiSiliyor o duzeltmeyi reddediyor. Yani kucuk
       kademe artik hic review yapmamaktan iyi.
       ========================================================================== */
    const reviewTierPlan = (tierIndex: number) => {
      const t = reviewTiers[tierIndex]
      const est = estimateTokens(reviewSystemPrompt, buildReviewUserPrompt(t.sourceChars), t.maxCompletionTokens)
      const lane = pickLane([MODEL_FAST, MODEL_EXTRACT, MODEL_HEAVY], est, t.maxCompletionTokens)
      const wait = tokenPacer.waitEstimate(est, lane, t.maxCompletionTokens)
      const retries = budgetLeft() >= wait + REVIEW_ATTEMPT_TIMEOUT_MS * 2 + REVIEW_TAIL_MS ? 1 : 0
      // Deneme suresi kalan butceye uyar; tabanin altindaysa needs butceyi asar ve kademe atlanir.
      const attempt = retries
        ? REVIEW_ATTEMPT_TIMEOUT_MS
        : Math.min(REVIEW_ATTEMPT_TIMEOUT_MS, Math.max(REVIEW_MIN_ATTEMPT_MS, budgetLeft() - wait - REVIEW_TAIL_MS))
      const needs = wait + attempt * (retries + 1) + REVIEW_TAIL_MS
      return { tierIndex, est, lane, wait, retries, attempt, needs }
    }
    let reviewPlan = reviewTierPlan(0)
    let reviewStartTier = -1
    for (let i = 0; i < reviewTiers.length; i++) {
      const aday = reviewTierPlan(i)
      if (budgetLeft() >= aday.needs) { reviewPlan = aday; reviewStartTier = i; break }
    }
    const reviewEstTokens = reviewPlan.est
    // The last call still pinned to one model. It was put on MODEL_FAST to
    // keep it off the draft's lane — which is exactly what pickLane does now,
    // and better, because it looks at what is actually free. Pinning also made
    // review inherit whatever the vision pass had just spent on qwen: on
    // 05.10.2026 vision finished 2 seconds earlier and review was quoted a 58s
    // wait on a lane it had no reason to be on.
    const reviewLane = reviewPlan.lane
    const reviewWaitMs = reviewPlan.wait
    // The work half is derived, not guessed: one attempt can take at most the
    // fetch timeout, and everything after review (parse, grounding gate,
    // near-duplicate merge, citation anchoring, cloze build, save) is
    // deterministic and measured at ~0.2s live — 8s is generous headroom.
    //
    // The retry is then budgeted explicitly rather than assumed. The gate's
    // promise is "if I start this, I can finish it", so if there is not room
    // for a second attempt we simply do not allow one. That keeps the worst
    // case equal to the number actually checked here, instead of the old 55s
    // which was a guess at one attempt plus a retry.
    const reviewRetries = reviewPlan.retries
    const reviewNeedsMs = reviewPlan.needs
    const reviewAttemptMs = reviewPlan.attempt

    const shouldSkipReview =
      (!useChunkedPipeline && extractedText.length <= SKIP_REVIEW_MAX_CHARS) ||
      (useChunkedPipeline && reviewStartTier < 0)

    let rawFinalContent = ""

    if (shouldSkipReview) {
      if (useChunkedPipeline) skippedStages.push('review')
      console.log(
        `Review atlandi (chunked=${useChunkedPipeline}, depth=${depth}, ` +
        `budgetLeft=${budgetLeft()}ms, hicbir kademe sigmadi — en kucugu ` +
        `${reviewTiers[reviewTiers.length - 1].sourceChars} krk icin gereken ` +
        `${reviewTierPlan(reviewTiers.length - 1).needs}ms ` +
        `[pacer ${reviewTierPlan(reviewTiers.length - 1).wait}ms], est=${reviewEstTokens} token)`
      )
      rawFinalContent = rawContent
      await serviceClient.from('documents').update({ processing_stage: 'saving' }).eq('id', documentId)
    } else {
      console.log(
        `Review BASLIYOR (model=${reviewLane}, kademe ${reviewStartTier + 1}/` +
        `${reviewTiers.length} = ${reviewTiers[reviewStartTier].sourceChars} krk kaynak, ` +
        `budgetLeft=${budgetLeft()}ms, gereken=${reviewNeedsMs}ms ` +
        `[pacer beklemesi ${reviewWaitMs}ms, ${reviewRetries + 1} deneme], est=${reviewEstTokens} token)`
      )
      // Update stage to reviewing
      await serviceClient
        .from('documents')
        .update({ processing_stage: 'reviewing' })
        .eq('id', documentId)

      let groqReviewData: any = null

      for (let i = Math.max(0, reviewStartTier); i < reviewTiers.length; i++) {
        const tier = reviewTiers[i]
        const attemptPrompt = buildReviewUserPrompt(tier.sourceChars)
        // Lane first (thinking room), ceiling second (qwen's OTPM).
        const tierCompletion = tokenPacer.clampCompletion(
          reviewLane,
          reviewCompletionFor(reviewLane, tier.maxCompletionTokens)
        )
        // THE GATE'S PROMISE HAS TO HOLD FOR THE WHOLE LOOP, NOT ONE FETCH.
        // The gate above budgets wait + attempt + tail, but this is a loop of
        // up to three tiers and EACH ONE can sit through its own pacer wait.
        // On 04.10.2026 two 60s waits stacked inside here: the gate promised
        // 38s, the loop ran 81s, and the 150s Edge wall clock killed the
        // function mid-review — leaving the document stuck on "reviewing"
        // with no summary and no failure marker. A tier that cannot finish
        // inside the remaining budget must not be started.
        const tierWaitMs = tokenPacer.waitEstimate(
          estimateTokens(reviewSystemPrompt, attemptPrompt, tierCompletion),
          reviewLane,
          tierCompletion
        )
        const tierAttemptMs = i === Math.max(0, reviewStartTier)
          ? reviewAttemptMs
          : Math.min(REVIEW_ATTEMPT_TIMEOUT_MS, Math.max(REVIEW_MIN_ATTEMPT_MS, budgetLeft() - tierWaitMs - REVIEW_TAIL_MS))
        const tierNeedsMs = tierWaitMs + tierAttemptMs + REVIEW_TAIL_MS
        if (i > Math.max(0, reviewStartTier) && budgetLeft() < tierNeedsMs) {
          console.warn(
            `Review tier ${i + 1} atlandi — butce yetmiyor ` +
            `(kalan=${budgetLeft()}ms, gereken=${tierNeedsMs}ms [pacer ${tierWaitMs}ms]). ` +
            `Taslak korunuyor.`
          )
          rawFinalContent = rawContent
          break
        }
        // This call does NOT go through callGroqJson, so like the vision call
        // it has to pay the pacer itself. Without this it both fires into a
        // full window (429) and never records what it spent, leaving the
        // critic pass after it believing the lane is emptier than it is.
        const attemptEst = estimateTokens(reviewSystemPrompt, attemptPrompt, tierCompletion)
        await tokenPacer.acquire(attemptEst, reviewLane, tierCompletion)
        let attemptResponse: Response
        try {
          attemptResponse = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${groqApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              // reviewLane is chosen at runtime by pickLane (509bd5f) — it is
              // whichever of MODEL_FAST / MODEL_EXTRACT / MODEL_HEAVY can take
              // the call soonest, NOT a fixed second model. Groq meters TPM
              // per model, so spreading review across lanes is the point.
              model: reviewLane,
              temperature: 0.2,
              // Derived from reviewLane, never a literal: a hardcoded
              // reasoning_effort:"none" here 400'd on every gpt-oss lane.
              ...reasoningParamsFor(reviewLane),
              max_completion_tokens: tierCompletion,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: reviewSystemPrompt },
                { role: "user", content: attemptPrompt }
              ]
            })
          }, reviewRetries, tierAttemptMs)
        } catch (fetchReviewErr) {
          /* REVIEW DUSERSE BELGE DUSMEZ (25.10.2026). Burasi markFailed
             cagirip 503 donuyordu: review isteginin zaman asimi (ya da ag
             hatasi) elde SAGLAM bir taslak varken ogrencinin butun kartini
             siliyordu. Review opsiyonel bir kalite gecisi — TPM hatasindaki
             "taslagi koru" davranisi (asagida) burada da gecerli. */
          console.warn('Review istegi dustu — taslak korunuyor (review atlandi): ', fetchReviewErr)
          skippedStages.push('review')
          rawFinalContent = rawContent
          break
        }

        tokenPacer.observeHeaders(attemptResponse.headers, reviewLane)
        const attemptData = await attemptResponse.json()

        // What the thinking actually cost. REASONING_HEADROOM is a starting
        // value chosen from one failure, and the only honest way to set it is
        // to watch this number across a few documents: if reasoning routinely
        // comes in at 400, the headroom is wasting pacer budget and pushing
        // review past its gate on long documents; if it comes in at 1,100,
        // the margin is thinner than it looks.
        const usage = attemptData?.usage
        const reasoned = Number(usage?.completion_tokens_details?.reasoning_tokens)
        if (usage) {
          /* ICERIDEKI <think> OLCULUYOR (30.10.2026).
           *
           * Yukaridaki REASONING_HEADROOM notu "gercek rakam artik her
           * cagrida loglaniyor, bu yuzden yorumdan degil veriden
           * ayarlanabilir" diyor — ama o alan
           * (completion_tokens_details.reasoning_tokens) 18 canli review'un
           * HICBIRINDE gelmedi: serit hep qwen/qwen3.8-27b'ydi ve qwen
           * dusunmesini ayri alan olarak degil ICERIGIN ICINDE <think>
           * blogu olarak yaziyor (stripThinkBlock'un varlik sebebi). Yani
           * sayac tam ihtiyac duyulan seride kordu.
           *
           * Olculen dagilim: 18 kosunun 16'si ~78-123 token (yalnizca
           * quality_gate), is yapan ikisi 3037 ve 3616 token — ilan edilen
           * butce 850. Asim 3,5-4,3 kat ve bugun yalnizca Groq
           * max_completion_tokens'i siki uygulamadigi icin zararsiz.
           * Butceyi buyutmek bu seritte cozum DEGIL: OTPM duvari 1000,
           * clampCompletion geri kirpiyor ve tahmin sisince kapi review'u
           * daha sik atliyor. Bu yuzden korunma ayristirma tarafinda
           * (taslaga donus), burada ise yalnizca OLCUM var. */
          const reviewIcerik = String(attemptData?.choices?.[0]?.message?.content ?? '')
          const thinkEslesme = reviewIcerik.match(/<think>[\s\S]*?<\/think>/i)
          const thinkKrk = thinkEslesme ? thinkEslesme[0].length : 0
          const harcanan = Number(usage.completion_tokens)
          console.log(
            `Review token: completion=${usage.completion_tokens ?? '?'}` +
            `${Number.isFinite(reasoned) ? ` (reasoning=${reasoned}, icerik=${(usage.completion_tokens ?? 0) - reasoned})` : ''}` +
            `${thinkKrk > 0 ? ` (icerideki <think> ${thinkKrk} krk ~${Math.round(thinkKrk / 4)} token)` : ''}` +
            ` / butce=${tierCompletion} [${reviewLane}]` +
            (Number.isFinite(harcanan) && harcanan > tierCompletion
              ? ` — BUTCE ASILDI ${(harcanan / tierCompletion).toFixed(1)}x (saglayici tavani uygulamadi)`
              : '')
          )
        }
        // Record either way: a rejected call still consumed the minute's
        // budget as far as Groq is concerned, and the next tier (or the
        // critic) must not start out over-optimistic.
        tokenPacer.record(
          Number(attemptData?.usage?.total_tokens) || attemptEst,
          reviewLane,
          Number(attemptData?.usage?.completion_tokens) || tierCompletion
        )

        if (attemptResponse.ok) {
          groqReviewData = attemptData
          break
        }

        const isTokenSizeError = (attemptResponse.status === 400 || attemptResponse.status === 429 || attemptResponse.status === 413) &&
          attemptData?.error?.code === 'rate_limit_exceeded' &&
          attemptData?.error?.type === 'tokens'

        console.error(`Groq Review API call failed (source budget ${tier.sourceChars} chars, completion budget ${tier.maxCompletionTokens}, status ${attemptResponse.status}): `, JSON.stringify(attemptData))

        if (!isTokenSizeError || i === reviewTiers.length - 1) {
          // Madde 6 fallback: if review fails on TPM, keep the draft instead of failing the whole job
          console.warn('Madde 6: review failed — falling back to unreviewed draft')
          rawFinalContent = rawContent
          break
        }
      }

      if (!rawFinalContent) {
        const reviewOut = groqReviewData?.choices?.[0]?.message?.content ?? ""
        if (reviewOut) {
          // Never let review's answer BE the final content — merge it onto the
          // draft, so a short or truncated answer can only fail to improve
          // things, not delete them. See mergeReviewOntoDraft.
          const { merged, notes } = mergeReviewOntoDraft(rawContent, reviewOut, extractedText)
          rawFinalContent = merged
          console.log(`Review birlestirme: ${notes.length ? notes.join(', ') : 'degisiklik yok'}`)
        }
      }
      if (!rawFinalContent) {
        // Bos review cevabi da taslagi silmez — bkz. "REVIEW DUSERSE BELGE DUSMEZ".
        console.warn('Review bos cevap dondu — taslak korunuyor: ', JSON.stringify(groqReviewData).slice(0, 300))
        skippedStages.push('review')
        rawFinalContent = rawContent
      }

      await serviceClient.from('documents').update({ processing_stage: 'saving' }).eq('id', documentId)
    }

    // ==========================================================================
    // STEP 3 — PARSE THE RESPONSE (defensive parsing of final reviewed output)
    // ==========================================================================
    /* BOZUK REVIEW CEVABI DA BELGEYI DUSURMEZ (30.10.2026 olcumu).
     *
     * Bu iki kapi (kesik <think> ve bozuk JSON) markFailed cagirip 502/500
     * donuyordu, yani elde SAGLAM bir taslak varken ogrencinin butun karti
     * siliniyordu. Ayni fonksiyonun yukarisinda bu ilke iki kez yazili:
     * "REVIEW DUSERSE BELGE DUSMEZ" (istek dustugunde) ve "Bos review
     * cevabi da taslagi silmez". Kesik cevap yolu o ilkenin DISINDA
     * kalmisti.
     *
     * NEDEN TEORIK DEGIL: 18 canli review olculdu. 16'si ~90 token
     * (yalnizca quality_gate), ama is yapan IKI kosu 3037 ve 3616 token
     * harcadi — ilan edilen butce 850. qwen3 dusunmesini `reasoning_tokens`
     * olarak DEGIL, icerigin icinde <think> blogu olarak yaziyor (bu yuzden
     * stripThinkBlock var), ve reviewCompletionFor dusunme payini yalnizca
     * gpt-oss/openai seritlerine ekliyor — qwen'e hic eklemiyor. Yani
     * uretken review'lar butceyi 3,5-4,3 kat asiyor ve bugun yalnizca Groq
     * max_completion_tokens'i SIKI uygulamadigi icin calisiyorlar. Sinir
     * uygulanmaya baslarsa cevap tam <think> icinde kesilir, stripThinkBlock
     * null doner ve kart silinir — hem de review'un soyleyecek SOZU oldugu
     * (pass=false, 4 duzeltme, yakalanan halusinasyon) kosularda.
     *
     * Kesik JSON kurtarmasi da deneniyor: review dort duzeltmeden sonra
     * kesilmisse closeTruncatedJson ucunu kurtarabilir (bkz. callGroqJson).
     * Taslak da ayristirilamiyorsa gercek bir basarisizlik var, o zaman
     * markFailed dogru davranis. */
    const ayristir = (ham: string): any | null => {
      const soyulan = stripThinkBlock(ham)
      if (soyulan === null) return null
      const temiz = soyulan.replace(/```json\s*|```/g, "").trim()
      if (!temiz) return null
      try {
        return JSON.parse(repairLatexEscapes(temiz))
      } catch (_e) {
        const kapatilan = closeTruncatedJson(temiz)
        if (!kapatilan) return null
        try {
          return JSON.parse(repairLatexEscapes(kapatilan))
        } catch (_e2) {
          return null
        }
      }
    }

    let parsedContent = ayristir(rawFinalContent)
    if (!parsedContent && rawFinalContent !== rawContent) {
      console.error(
        'Review cevabi ayristirilamadi (kesik <think> ya da bozuk JSON) — TASLAGA donuluyor: ' +
        String(rawFinalContent).slice(0, 400)
      )
      skippedStages.push('review')
      rawFinalContent = rawContent
      parsedContent = ayristir(rawFinalContent)
    }
    if (!parsedContent) {
      console.error('Taslak da ayristirilamadi — belge dusuruluyor: ', String(rawFinalContent).slice(0, 400))
      await markFailed(serviceClient, documentId)
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON formatting after review' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Denetim Raporu, 2026-08-31 — ROOT-CAUSE FIX (part 2): the review pass
    // above is now deliberately told to NOT re-emit tables/charts/diagrams/
    // worked_examples/formulas/concept_graph/cloze_cards (to keep its
    // completion-token budget stable and avoid truncation/JSON-parse
    // failures now that those fields can carry real content). That means
    // parsedContent never has them — splice them back in here from the
    // pre-review draft (rawContent still holds the full draft object,
    // including when review was skipped entirely, in which case this is a
    // harmless no-op since parsedContent already came from the same JSON).
    try {
      const preReviewStripped = stripThinkBlock(rawContent)
      const preReviewCleaned = (preReviewStripped ?? rawContent).replace(/```json\s*|```/g, '').trim()
      // Tek gecisli yolda rawContent modelin HAM ciktisi; onarimsiz ayristirma
      // formul tasiyan her kartta tables/formulas alanlarini dusurebilirdi.
      const preReviewDraft = preReviewCleaned ? JSON.parse(repairLatexEscapes(preReviewCleaned)) : null
      if (preReviewDraft && typeof preReviewDraft === 'object') {
        for (const field of ['tables', 'charts', 'diagrams', 'worked_examples', 'formulas', 'concept_graph', 'cloze_cards']) {
          if (parsedContent[field] === undefined && preReviewDraft[field] !== undefined) {
            parsedContent[field] = preReviewDraft[field]
          }
        }
      }
    } catch (spliceErr) {
      console.warn('Post-review field splice-back skipped (pre-review draft unparsable):', spliceErr)
    }

    // Madde 4 — normalize quality gate; optional one-shot critic rewrite if FAIL
    let qualityMeta: any = {
      pass: true,
      grounded: false,
      issues: [] as string[],
      critic_retry: false,
      // The SAME array, by reference, not a copy: the critic's own skip
      // decision is made further down and must still land in the saved card.
      skipped_stages: skippedStages,
      // Hangi motor bu taslagi yazdi. Iki yolu ayni sunumla karsilastiracagiz
      // ve loglar birkac gun sonra gidiyor — kartin kendisinde durmali.
      engine: draftEngine,
      gemini: geminiMeta
    }
    if (parsedContent.quality_gate && typeof parsedContent.quality_gate === 'object') {
      qualityMeta = {
        pass: parsedContent.quality_gate.pass !== false,
        grounded: !!parsedContent.quality_gate.grounded,
        issues: Array.isArray(parsedContent.quality_gate.issues)
          ? parsedContent.quality_gate.issues.map((x: any) => String(x).slice(0, 200)).slice(0, 8)
          : [],
        critic_retry: false,
        // Carried through the quality_gate branch too — this is set by OUR
        // budget decisions, not by the model, so it must survive the model's
        // verdict replacing the rest of this object.
        skipped_stages: skippedStages,
        engine: draftEngine,
        gemini: geminiMeta
      }
    }
    // Review sorunlari critic'e gitmeden suzulur (bkz. filterReviewIssues):
    // kaynakta GECEN konuyu "uydurma" diye isaretleyen madde, critic'in dogru
    // icerigi silmesine yol aciyordu.
    if (qualityMeta.issues.length > 0) {
      const suzulmus = filterReviewIssues(qualityMeta.issues, extractedText)
      if (suzulmus.dropped.length > 0) {
        console.log(
          `Review sorunlari suzuldu: ${suzulmus.dropped.length} madde dusuruldu — ` +
          suzulmus.dropped.map(d => `"${d.issue.slice(0, 60)}" (${d.reason})`).join(' | ')
        )
        qualityMeta.issues = suzulmus.kept
        if (suzulmus.kept.length === 0) qualityMeta.pass = true
      }
    }
    // Heuristic grounded: footnotes with page numbers or inline (s. N)/(slayt N)
    const summaryText = String(parsedContent.summary || '')
    const hasInlineCite = /\((?:s\.|sayfa|slayt|p\.|page)\s*\d+\)/i.test(summaryText)
    const footWithPage = Array.isArray(parsedContent.footnotes)
      && parsedContent.footnotes.some((f: any) => f && f.page != null)
    if (hasInlineCite || footWithPage) qualityMeta.grounded = true

    // The critic is the last LLM call before the save, and it had no budget
    // guard at all — it could only ever run after review, which used to be
    // gated so conservatively that there was always time left. Now that review
    // starts closer to the wall clock, guard the critic the same way: a
    // rewrite is a quality improvement, and losing the whole run to the Edge
    // timeout at the save step costs far more than keeping an unpolished
    // summary. (We have already seen one run lose ~3 minutes of completed work
    // at exactly that step.)
    // The completion budget must be passed to waitEstimate, not just to the
    // call. Without it the OTPM branch sees estCompletion=0, reports no wait,
    // and the guard waves the critic through — then acquire() sits out a full
    // 60s output window anyway. That is exactly what happened on 04.10.2026:
    // guard said "no wait", the critic waited 60.1s, and the run reached 135s
    // of the 150s Edge wall clock.
    const criticLane = pickLane(
      [MODEL_FAST, MODEL_EXTRACT, MODEL_HEAVY],
      estimateTokens('', summaryText.slice(0, 4000), 2048),
      2048
    )
    // Same reasoning-headroom rule as review, and the critic needs it more:
    // it rewrites the whole summary (~2,500 characters, ~800 tokens), so on a
    // gpt-oss lane a flat 2,048 leaves well under that once the thinking is
    // paid for. A short result is rejected by the NARRATIVE_MIN_KEEP_RATIO
    // floor below, which would turn a budget problem into a silent no-op.
    const criticCompletion = tokenPacer.clampCompletion(
      criticLane,
      reviewCompletionFor(criticLane, 2048)
    )
    const criticWaitMs = tokenPacer.waitEstimate(
      estimateTokens('', summaryText.slice(0, 4000), criticCompletion),
      criticLane,
      criticCompletion
    )
    const criticNeedsMs = criticWaitMs + 30_000
    if (qualityMeta.pass === false && qualityMeta.issues.length > 0 && budgetLeft() < criticNeedsMs) {
      skippedStages.push('critic')
      console.log(
        `Madde 4: critic atlandi (budgetLeft=${budgetLeft()}ms, ` +
        `gereken=${criticNeedsMs}ms [pacer ${criticWaitMs}ms + is 30000ms])`
      )
    } else if (qualityMeta.pass === false && qualityMeta.issues.length > 0) {
      try {
        await serviceClient.from('documents').update({ processing_stage: 'critic' }).eq('id', documentId)
        const fixSys = `You fix a FAILED academic study brief. Respond ONLY with JSON: { "summary": string, "summary_executive": string }.
Fix the listed issues. Remove hallucinations and admin noise. Keep ${langLabel}. Do not invent facts.
Change ONLY the sentences the issues name. Keep everything else exactly: the paragraph breaks (\\n\\n), each paragraph's bold lead-in (**...**), every number and every formula.`
        const fixUser = `Issues to fix:\n${qualityMeta.issues.map((i: string) => `- ${i}`).join('\n')}\n\nCurrent summary:\n${summaryText.slice(0, 4000)}\n\nCurrent executive:\n${String(parsedContent.summary_executive || '').slice(0, 500)}`
        const fixed = await callGroqJson(groqApiKey, fixSys, fixUser, {
          model: criticLane,
          temperature: 0.2,
          maxCompletionTokens: criticCompletion,
          timeoutMs: 25000,
          maxRetries: 0
        })
        // Same floor as the review merge: the critic runs on whichever lane
        // pickLane gave it, clamped to that lane's OTPM ceiling, so it can
        // easily have less room than the narrative writer that produced this
        // text. A "fix" that returns a quarter of the summary is compression,
        // not a fix.
        const fixedSummary = String(fixed?.summary || '').trim()
        const keepFloor = summaryText.length * NARRATIVE_MIN_KEEP_RATIO
        // Paragraf yapisini ezen duzeltme reddedilir: canli iki kosuda critic
        // cok paragrafli ozeti tek bloga cevirdi ve kullanicinin ilk sikayeti
        // tam olarak buydu ("tek paragraf olmasini istemiyorum").
        const taslakParagraf = paragraphCount(summaryText)
        const yapiBozuldu = taslakParagraf >= 3 && paragraphCount(fixedSummary) < 2
        if (yapiBozuldu && fixedSummary.length > 80) {
          console.warn(
            `Madde 4: critic yazisi REDDEDILDI — taslak ${taslakParagraf} paragraf, ` +
            `duzeltme tek blok. Taslak korunuyor.`
          )
        } else if (fixedSummary.length > 80 && fixedSummary.length >= keepFloor) {
          parsedContent.summary = fixedSummary
          qualityMeta.critic_retry = true
          qualityMeta.pass = true
          qualityMeta.issues = []
          console.log('Madde 4: critic rewrite applied')
        } else if (fixedSummary.length > 80) {
          console.warn(
            `Madde 4: critic yazisi REDDEDILDI — ${fixedSummary.length} krk dondu, ` +
            `taslak ${summaryText.length} krk (esik ${Math.round(keepFloor)}). Taslak korunuyor.`
          )
        }
        const fixedExec = String(fixed?.summary_executive || '').trim()
        const execFloor = String(parsedContent.summary_executive || '').length * NARRATIVE_MIN_KEEP_RATIO
        if (fixedExec.length > 20 && fixedExec.length >= execFloor) {
          parsedContent.summary_executive = fixedExec
        }
      } catch (critErr) {
        console.warn('Madde 4 critic rewrite skipped:', critErr)
      }
    }
    delete parsedContent.quality_gate

    // HOTFIX: reject only truly empty OR pure-meta with no extractions
    {
      const sum = String(parsedContent.summary || '')
      const terms = Array.isArray(parsedContent.key_terms) ? parsedContent.key_terms : []
      const points = Array.isArray(parsedContent.key_points) ? parsedContent.key_points : []
      const quiz = Array.isArray(parsedContent.quiz_questions) ? parsedContent.quiz_questions : []
      const metaRe = /sağlanmamış|sağlanmamıştır|no (detailed )?draft|taslak.*sağlan|içerik taslağı|qualitative overview|scholarly landscape|only a general framework|genel bir çerçevesi/i
      const isMeta = metaRe.test(sum) || metaRe.test(String(parsedContent.summary_executive || ''))
      const hasExtractions = terms.length > 0 || points.length > 0 || quiz.length > 0
      const isEmpty = !hasExtractions && sum.trim().length < 80
      // If meta but we have real terms/points, strip meta summary is still bad — fail only if no extractions
      if (isEmpty || (isMeta && !hasExtractions)) {
        console.error('HOTFIX: refusing to save empty/meta study card', { isMeta, isEmpty, terms: terms.length, points: points.length, quiz: quiz.length, sumLen: sum.length })
        await markFailed(serviceClient, documentId)
        return new Response(JSON.stringify({
          error: 'Özet içeriği boş kaldı. Lütfen tekrar deneyin. / Summary was empty — please retry.'
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (isMeta && hasExtractions) {
        // Keep extractions; replace meta summary with a short concrete fallback from terms
        const termList = terms.slice(0, 8).map((t: any) => t?.term || t).filter(Boolean).join(', ')
        parsedContent.summary = lang === 'tr'
          ? `Bu belge şu başlıca konuları kapsar: ${termList}. Aşağıdaki ana noktalar ve terimler çalışmak için çıkarılmıştır.`
          : `This document covers: ${termList}. Key points and terms were extracted for study.`
        parsedContent.summary_executive = termList.slice(0, 200)
        console.warn('HOTFIX: replaced meta summary, kept extractions')
      }
    }

    // ==========================================================================
    // STEP 3.5 — CITATION ANCHORING (both pipelines meet here)
    //
    // Runs once, after whichever path produced `parsedContent`, so the fast
    // path gets its model-reported footnote pages VERIFIED and the long-doc
    // path — which ships `footnotes: []` because asking each window for them
    // would eat the completion-token budget it needs for key terms/points —
    // finally gets citations at all. See buildPageIndex/anchorCitations above
    // for why this is computed rather than prompted.
    // ==========================================================================
    {
      // --- (a) Formulas: repair what is over-wrapped, drop what cannot render
      const sanitized = sanitizeFormulas(parsedContent.formulas)
      parsedContent.formulas = sanitized.formulas
      if (sanitized.dropped.length || sanitized.repaired || sanitized.duplicates) {
        console.log(
          `Formula validation: ${sanitized.formulas.length} kept, ` +
          `${sanitized.repaired} repaired, ${sanitized.duplicates} tekrar, ${sanitized.dropped.length} dropped` +
          (sanitized.dropped.length
            ? ` — ${sanitized.dropped.map(d => `${d.name}(${d.reason})`).join('; ')}`
            : '')
        )
      }

      // --- (a2) Diagrams: drop Mermaid that cannot render
      const diagramsChecked = sanitizeDiagrams(parsedContent.diagrams)
      parsedContent.diagrams = diagramsChecked.diagrams
      if (diagramsChecked.dropped.length || diagramsChecked.repaired) {
        console.log(
          `Mermaid validation: ${diagramsChecked.diagrams.length} kept, ` +
          `${diagramsChecked.dropped.length} dropped, ` +
          `${diagramsChecked.repaired} ok onarildi` +
          (diagramsChecked.dropped.length
            ? ' — ' + diagramsChecked.dropped.map(d => `${d.title}(${d.reason})`).join('; ')
            : '')
        )
      }

      // extractedText, so a chart has to be traceable to the document — see
      // the CHART GATE comment.
      const chartsChecked = sanitizeCharts(parsedContent.charts, extractedText)
      parsedContent.charts = chartsChecked.charts
      if (chartsChecked.dropped.length) {
        console.log(
          `Chart validation: ${chartsChecked.charts.length} kept, ` +
          `${chartsChecked.dropped.length} dropped — ` +
          chartsChecked.dropped.map(c => `${c.title}(${c.reason})`).join('; ')
        )
      }

      /* --- (b) Grounding gate: remove claims the source does not support
       *
       * KAPI MOTORA VE CIKARIM KALITESINE BAKIYOR (28.10.2026).
       *
       * Kapinin onermesi kendi yorumunda yazili: "model YALNIZCA cikarilan
       * metni gordu, dolayisiyla metinde gecmeyen bir terim uydurma". Taslak
       * Gemini'den geldiginde bu onerme YANLIS — o sayfalarin kendisini
       * okuyor. figureText muafiyeti bunu kismen kapatiyor ama yalnizca
       * modelin SEKIL olarak bildirdigini kapsiyor; slayt govdesinde duran,
       * cikaricinin goremedigi metni kapsamiyor.
       *
       * OLCULEN KOSU (28.10.2026, 10:22 — Kanin Ozellikleri, 67 sayfa):
       *   Visual-density signal tripped: avgCharsPerPage=160, nearBlankPages=40/67
       *   GOLGE YOL: taslak Gemini'den (67 sayfa, 10 gorsel bulgu)
       *   Grounding gate: score=81% terms 8 kept / 6 dropped
       *     | uydurma terim: Hematokrit (Htc), Eritrosit Sedimantasyon Hizi
       *       (ESH), Klor Gocu (Chloride Shift), Buffy Coat,
       *       Ekstrameduller Hematopoez, Kolloidal Dispers Sistem
       * Altisi da GERCEK: kartin kendi bolumleri ve kaynakcasi onlari
       * kullaniyor. 67 sayfadan 10.750 karakter cikmis, 40 sayfa neredeyse
       * bos. Yani kapi modelin dogrulugunu degil CIKARICININ KORLUGUNU
       * olcuyor ve ogrenci 14 kavramin 6'sini kaybediyor.
       *
       * Guvenlik supabi bunu yakalayamadi: terimler %43 dustu ama maddeler
       * %0, havuz %19 ve esik %60. Iki populasyonun yanlis-dusme orani
       * yapisal olarak farkli (terim birebir altdizi ister, madde tek bir
       * ortusen terimle gecer), ortalamak supabi tam gerektigi yerde kor
       * ediyor.
       *
       * Artik kapi, GUVENEMEDIGI karsilastirmada kesmiyor yalnizca olcuyor —
       * supabin zaten aldigi durusun aynisi, farki tetigin yuksek dusme
       * orani degil BILINEN-BOZUK karsilastirma olmasi. Iki kosul birden
       * gerekiyor: taslak Gemini'den gelmis OLACAK (yani sayfalari okudu) VE
       * cikarim olculmus olarak ince OLACAK. Groq yolunda ya da metni duzgun
       * cikan bir belgede kapi eskisi gibi kesiyor.
       *
       * Takas acikca: uyduran bir Gemini, gorsel agirlikli bir belgede bu agi
       * kaybediyor. Kapinin kendi yorumu bunu zaten cevapliyor —
       * "halusinasyon korumasinin asil yuku zaten review ve sanitizeCharts'ta"
       * — ve olculen kosuda review gercekten kostu, dort duzeltme uyguladi. */
      /* KAPI KARSILASTIRMAYA GUVENEBILIYOR MU (28.10.2026'da iki kez genisledi).
       *
       * 1) PARALEL MOD. `draftEngine` yalnizca tum-PDF yolunda (only/shadow)
       *    'gemini' oluyor; parallel modda `geminiResult` hic kurulmuyor
       *    ("mod=parallel — tum-PDF cagrisi yok"), yani bu kapi su an
       *    kostugumuz modda HIC acilamiyordu. Oysa onermesi orada daha da
       *    gecerli: gorsel gecis sayfa goruntulerini gercekten okuyor.
       *
       * 2) KESIK OCR. Taranmis belgede kaynak metnin kendisi guvenilmez.
       *    Olculen kosu (Week_8_Derivative_Problem_Solving_II_SS.pdf, 29
       *    sayfa, 29 JPEG, 0 font): OCR 29 sayfanin 4'unden 1.230 karakter
       *    verdi ve o da bozuktu ("f（a） = 「a2， × <1 122-1,2≥1").
       *    Kapi o 1.230 karaktere bakip "Power Rule, Product Rule,
       *    Quotient Rule" terimlerini UYDURMA sayip atti — ucu de kartin
       *    formul bolumunde duruyor, yani sayfalarda yaziyor. Ogrenci
       *    kavramlarin %60'ini kaybetti.
       *
       * Her iki dalda da kapi KESMIYOR, yalnizca olcuyor. Kesme karari
       * karsilastirmanin saglam oldugu durumlar icin saklaniyor. */
      const kapiOlcumModu =
        ((draftEngine === 'gemini' || geminiParallelActive()) && isVisuallyDenseDocument) ||
        !!ocrKismi
      const gated = applyGroundingGate(
        parsedContent.key_terms,
        parsedContent.key_points,
        extractedText,
        visionGroundedClaims,
        // Modelin sekillerden okudugunu bildirdigi satirlar da kaynak
        // sayilir — bkz. applyGroundingGate'teki uzun not.
        visionNotes.join('\n'),
        kapiOlcumModu
      )
      parsedContent.key_terms = gated.key_terms
      parsedContent.key_points = gated.key_points
      /* Olcum modunda "uydurma" kelimesi yanlis olur: hicbir sey atilmadi,
         sayilar yalnizca karsilastirmanin ne dediğini gosteriyor. */
      const olcum = !!gated.stats.olcumModu
      console.log(
        `Grounding gate${olcum ? ' [OLCUM MODU: Gemini taslagi + gorsel agirlikli belge — kesilmedi]' : ''}: ` +
        `score=${gated.stats.score ?? '—'}% ` +
        `terms ${gated.stats.termsKept} kept / ${gated.stats.termsDropped} ${olcum ? 'would-drop' : 'dropped'}, ` +
        `points ${gated.stats.pointsKept} kept / ${gated.stats.pointsDropped} ${olcum ? 'would-drop' : 'dropped'}` +
        (gated.stats.droppedTerms.length
          ? ` | ${olcum ? 'olculen terim (KORUNDU)' : 'uydurma terim'}: ${gated.stats.droppedTerms.join(', ')}`
          : '') +
        (gated.stats.droppedPoints.length
          ? ` | ${olcum ? 'olculen nokta (KORUNDU)' : 'uydurma nokta'}: ${gated.stats.droppedPoints.map(p => `"${p}"`).join(' ')}`
          : '')
      )

      /* --- (b0) BILGI YOGUNLUGU KAPISI.
         Grounding kapisi "uydurma mi" diye bakar; bu kapi "bir sey
         soyluyor mu" diye. Dolgu cumleler dogru VE kaynakta gecer, o
         yuzden oteki kapidan rahatca gecerler. */
      // Olcum asagida quality_meta ye yazilacak.
      const yogunluk = applyDensityGate(
        parsedContent.key_points,
        extractedText,
        visionNotes.join('\n')
      )
      parsedContent.key_points = yogunluk.key_points
      yogunlukOlcumu = yogunluk.stats.dropped > 0
        ? { dropped: yogunluk.stats.dropped, toplam: yogunluk.stats.toplam, ornekler: yogunluk.stats.droppedPoints.slice(0, 5) }
        : null
      if (yogunluk.stats.valfAcildi) {
        console.warn(
          `Yogunluk kapisi: VALF ACILDI — maddelerin ucte birinden fazlasi elenecekti, ` +
          `hicbiri elenmedi (olcum guvenilmez sayildi)`
        )
      } else if (yogunluk.stats.dropped > 0) {
        console.log(
          `Yogunluk olcumu: ${yogunluk.stats.dropped}/${yogunluk.stats.toplam} madde capasiz VE bos yuklemli` +
          ` | dolgu: ${yogunluk.stats.droppedPoints.map((x) => '"' + x + '"').join(' ')}`
        )
      }

      // --- (b1) Cozumlu orneklerin VERILEN sayilari da dayandirilir.
      // Kapi uzun sure yalnizca terim ve noktaya bakiyordu; uydurma sayinin
      // en cok zarar verdigi yer ise cozumlu ornek (bkz. gateWorkedExamples).
      const ornekKapi = gateWorkedExamples(parsedContent.worked_examples, extractedText)
      if (ornekKapi.dropped.length) {
        console.warn(
          `Cozumlu ornek kapisi: ${ornekKapi.dropped.length} ornek atildi — ` +
          ornekKapi.dropped.join(' | ')
        )
      }
      // (b1') Adimlar temizlenir, sonra aritmetigi tutmayan ornek atilir
      // (bkz. gateWorkedExampleArithmetic). Sira onemli: tek dizgiye
      // sikistirilmis adimlar ayrilmadan esitlikler dogru okunmuyor.
      const aritmetikKapi = gateWorkedExampleArithmetic(normalizeWorkedExamples(ornekKapi.kept))
      if (aritmetikKapi.dropped.length) {
        console.warn(
          `Cozumlu ornek aritmetik kapisi: ${aritmetikKapi.dropped.length} ornek atildi — ` +
          aritmetikKapi.dropped.join(' | ')
        )
      }
      parsedContent.worked_examples = aritmetikKapi.kept

      // --- (b2) Narrative year gate: the prose the gate above never sees
      const yearsChecked = sanitizeNarrativeYears(parsedContent, extractedText)
      if (yearsChecked.removed.length || yearsChecked.flagged.length) {
        console.log(
          `Narrative year gate: ${yearsChecked.changed} alan duzeltildi` +
          (yearsChecked.removed.length ? ` | kaynakta olmayan yil silindi: ${yearsChecked.removed.join(', ')}` : '') +
          (yearsChecked.flagged.length ? ` | silinemedi, metinde kaldi: ${yearsChecked.flagged.join(', ')}` : '')
        )
      }

      // --- (c) Near-duplicate merge: the same idea worded twice by two windows
      const beforeDedup = {
        terms: (parsedContent.key_terms || []).length,
        points: (parsedContent.key_points || []).length,
        quiz: (parsedContent.quiz_questions || []).length
      }
      parsedContent.key_terms = dedupeNearDuplicates(
        parsedContent.key_terms,
        (t: any) => `${t?.term || ''} ${t?.definition || ''}`,
        (t: any) => String(t?.term || '')
      )
      parsedContent.key_points = dedupeNearDuplicates(
        parsedContent.key_points,
        (p: any) => typeof p === 'string' ? p : String(p?.text || p?.point || '')
      )
      parsedContent.quiz_questions = dedupeNearDuplicates(
        parsedContent.quiz_questions,
        (q: any) => String(q?.question || '')
      )
      /* Diyagramlar AYRI kural ile — bkz. dedupeDiagrams yanindaki olcum
         notu. Genel esik (0,7) olculen kopya cifti icin fazla yuksek. */
      const diyagramDedup = dedupeDiagrams(parsedContent.diagrams)
      if (diyagramDedup.dropped.length > 0) {
        parsedContent.diagrams = diyagramDedup.diagrams
        console.log(
          `Diyagram kopyasi birlestirildi: ${diyagramDedup.dropped.length} dustu — ` +
          diyagramDedup.dropped.map((t) => `"${t}"`).join(' | ')
        )
      }
      /* Bolumler de AYRI kural ile — bkz. dedupeSections yanindaki olcum
         notu. Gorsel gecisin ekledigi bolum pencerenin bolumunu tekrar
         ediyordu ve genel esik (0,7) 0,458'lik ortusmeyi kaciriyordu. */
      const bolumSayisiOnce = Array.isArray(parsedContent.sections) ? parsedContent.sections.length : 0
      const bolumDedup = dedupeSections(parsedContent.sections)
      if (bolumDedup.dropped.length > 0) {
        parsedContent.sections = bolumDedup.sections
        console.log(
          `Bolum kopyasi birlestirildi: ${bolumDedup.dropped.length} dustu — ` +
          bolumDedup.dropped.map((t) => `"${t}"`).join(' | ')
        )
      }
      console.log(
        `Near-duplicate merge: terms ${beforeDedup.terms}→${parsedContent.key_terms.length}, ` +
        `points ${beforeDedup.points}→${parsedContent.key_points.length}, ` +
        `quiz ${beforeDedup.quiz}→${parsedContent.quiz_questions.length}, ` +
        `sections ${bolumSayisiOnce}→${Array.isArray(parsedContent.sections) ? parsedContent.sections.length : 0}, ` +
        `diagrams ${Array.isArray(parsedContent.diagrams) ? parsedContent.diagrams.length : 0}`
      )

      /* --- (c1) Anlatidaki kayip LaTeX ters bolusu — bkz.
         onarAnlatiTersBolusu. Tek cikis noktasinda duruyor: anlatiyi
         yazar da, review de, Gemini taslagi da yazabiliyor; uc yolun
         hepsi bu satirdan geciyor. */
      for (const alan of ["summary", "summary_executive"] as const) {
        if (typeof parsedContent[alan] !== "string") continue
        const o = onarAnlatiTersBolusu(parsedContent[alan])
        if (o.onarim > 0) {
          parsedContent[alan] = o.metin
          console.log(`Anlati LaTeX ters bolu onarimi: ${alan} alaninda ${o.onarim} komut`)
        }
        /* SIRA: once ters bolu onarilir, SONRA yumusatilir. Tersi olsaydi
           yumusatma satir sonuna donmus komutu goremezdi. */
        const y = onarAnlatiLatex(parsedContent[alan])
        if (y.yumusatilan > 0) {
          parsedContent[alan] = y.metin
          console.log(`Anlati LaTeX duz yaziya cevrildi: ${alan} (${y.yumusatilan} parca)`)
        }
      }

      /* --- Ayni yumusatma ANLATI DISI butun duz yazi alanlarina — bkz.
         yumusatAgac yanindaki olcum notu. Alan adi ELLE sayilmiyor: agac
         ozyinelemeli geziliyor, yalnizca latex/mermaid/footnotes atlaniyor. */
      {
        let sayac = 0
        const yum = (t: string): string => {
          if (typeof t !== 'string' || (t.indexOf('\\') === -1 && !/[\^_]\{/.test(t))) return t
          const r = onarAnlatiLatex(t)
          if (r.yumusatilan > 0) sayac++
          return r.metin
        }
        for (const alan of Object.keys(parsedContent)) {
          if (YUM_DUZ_YAZI_ALANLARI.indexOf(alan as any) !== -1) continue  // yukarida islendi
          parsedContent[alan] = yumusatAgac(parsedContent[alan], yum, alan)
        }
        if (sayac > 0) {
          console.log(`Ayiracsiz LaTeX duz yaziya cevrildi: ${sayac} alan (anlati disi)`)
        }
      }

      // --- (c2) Anlatida birebir tekrar eden cumle — bkz. dedupeNarrativeSentences
      if (typeof parsedContent.summary === 'string') {
        const anlatiDedup = dedupeNarrativeSentences(parsedContent.summary)
        if (anlatiDedup.dropped.length > 0) {
          parsedContent.summary = anlatiDedup.text
          console.log(
            `Anlati tekrar temizligi: ${anlatiDedup.dropped.length} cumle dusuruldu — ` +
            anlatiDedup.dropped.map((d) => `"${d}"`).join(' | ')
          )
        }
      }

      // --- (d) Citations, computed from the page index (see above)
      const pageIndex = buildPageIndex(extractedText, pageMarkerLabel)
      const anchored = anchorCitations(
        Array.isArray(parsedContent.key_points) ? parsedContent.key_points : [],
        Array.isArray(parsedContent.footnotes) ? parsedContent.footnotes : [],
        pageIndex,
        lang
      )
      parsedContent.key_points = anchored.key_points

      /* --- Bos kabuklar ayikliniyor — bkz. bosKabuklariAyikla. Kesik JSON
         kurtarmasi terim/soru/bolum nesnelerini yarida kapatabiliyor. */
      {
        const kabuk = bosKabuklariAyikla(parsedContent)
        const toplam = Object.values(kabuk).reduce((a, b) => a + b, 0)
        if (toplam > 0) {
          console.warn(
            `Bos kabuk ayiklandi: ${Object.entries(kabuk).map(([k, v]) => `${k}=${v}`).join(', ')} ` +
            `— tanimsiz/cevapsiz kayit ekranda bos cizilirdi`
          )
        }
      }

      /* --- Maddeler duz metne indiriliyor — bkz. normalizeKeyPoints.
         Atiflar yukarida islendi, bundan sonra nesne sekli bilgi tasimiyor. */
      {
        const duz = normalizeKeyPoints(parsedContent.key_points)
        if (duz.duzlesen > 0) {
          console.warn(
            `key_points duzlestirildi: ${duz.duzlesen}/${(parsedContent.key_points || []).length} ` +
            `madde nesne olarak gelmisti (ekranda [object Object] olurdu), ` +
            `${duz.key_points.length} madde kaydediliyor`
          )
        }
        parsedContent.key_points = duz.key_points
        /* Bolum maddeleri ayni sinif: ayni pencere ayni sekli oraya da yazar. */
        if (Array.isArray(parsedContent.sections)) {
          for (const sec of parsedContent.sections) {
            if (sec && Array.isArray(sec.key_points)) {
              sec.key_points = normalizeKeyPoints(sec.key_points).key_points
            }
          }
        }
      }
      parsedContent.footnotes = anchored.footnotes
      /* GROUNDED'I BURADA BIR DAHA SOR (28.10.2026 olcumu).
       *
       * Sezgisel (hasInlineCite / footWithPage) ~330 satir YUKARIDA kosuyor,
       * yani anchorCitations'tan ONCE. Groq uzun-belge yolunda taslakta atif
       * HIC istenmiyor ("taslakta atif YOKTU, tamami hesaplandi"), dolayisiyla
       * sezgisel bos diziye bakip grounded'i false birakiyordu — oysa atiflar
       * tam bu satirda hesaplanmis oluyor.
       *
       * Olculen kosu (28.10.2026 18:36:56, "economy chapter 25"): review
       * grounded=false dedi, atif baglama 24 sayfali atif URETTI, kart yine de
       * "kaynaga bagli" rozetini kaybetti. Bedeli tek rozet degil: rozet
       * js/acadex-ink.js:10281'de qm.grounded'a bagli ve "kalite kontrolunden
       * gecti" de ONA bagli, yani tek bayrak IKI rozeti birden goturuyor —
       * review'in uc sorunu yanlis pozitif diye suzulup pass dogru sekilde
       * true'ya cekilmis olsa bile (bkz. filterReviewIssues).
       *
       * Sezgiseli silmiyorum: Gemini yolunda taslak atifla geliyor (olculen
       * kosuda kept=16) ve orada erken karar dogru. Burada yalnizca TEKRAR
       * soruluyor, hicbir zaman true'dan false'a dondurulmuyor. */
      if (!qualityMeta.grounded && anchored.footnotes.some((f: any) => f && f.page != null)) {
        qualityMeta.grounded = true
        console.log(
          `grounded: atif baglamadan sonra true — ${anchored.stats.added} atif hesaplandi ` +
          `(sezgisel, taslakta atif olmadigi icin false birakmisti)`
        )
      }
      // Footnote ids were renumbered to a dense sequence, so markers already
      // embedded in the summary text have to follow them.
      if (typeof parsedContent.summary === 'string') {
        parsedContent.summary = applyFootnoteRemap(parsedContent.summary, anchored.idMap)
      }
      /* `kept=0` YANLIS TESHISE YOL ACTI (21.10.2026).
       *
       * Groq uzun-belge yolunda `kept` HER ZAMAN 0, cunku o yolda modelden
       * atif hic istenmiyor: pencere semasinda `footnotes` yok ve birlesim
       * onu sabit `footnotes: []` olarak gonderiyor. `kept` yalnizca GELEN
       * atiflar uzerinde donen dongude artiyor, yani gelen bos oldugunda
       * artabilecegi tek yer hic calismiyor.
       *
       * Bu satiri Gemini yolunun `kept=30` degeriyle yan yana koyup "Groq
       * yolunda atiflarin tamami dusuyor" diye okudum — yanlisti. Dusen bir
       * sey yok; istenen bir sey yok. `demoted=0` bunu zaten kesinlestiriyor
       * (dizi dolu olup sayfalari hatali olsaydi demoted artardi).
       *
       * Artik log hangi halde oldugunu kendisi soyluyor. */
      const atifIstenmedi = anchored.stats.kept === 0 && anchored.stats.demoted === 0
      console.log(
        `Citation anchoring: pages=${pageIndex.length} ` +
        `kept=${anchored.stats.kept} demoted=${anchored.stats.demoted} ` +
        `added=${anchored.stats.added} quoted=${anchored.stats.quoted} ` +
        `unanchored=${anchored.stats.skipped}` +
        // Ayni alintiyi paylasan madde sayisi — bkz. AYNI_ALINTI_ORTUSME.
        (anchored.stats.paylasilan ? ` alinti-paylasan=${anchored.stats.paylasilan}` : '') +
        (atifIstenmedi
          ? ' — taslakta atif YOKTU (modelden istenmedi), tamami hesaplandi'
          : '')
      )
    }

    // ==========================================================================
    // STEP 4 — SAVE STUDY CARD & UPDATE STATUS
    // ==========================================================================

    // Built before the insert so the mix is visible. Sentence clozes are the
    // ones worth having -- a run that produces only key_term prompts means
    // the key_points carried none of the glossary's terms, which is itself
    // worth seeing in the logs.
    const clozeCards = buildClozeCards(
      parsedContent.cloze_cards,
      Array.isArray(parsedContent.key_terms) ? parsedContent.key_terms : [],
      Array.isArray(parsedContent.key_points) ? parsedContent.key_points : [],
      20
    )
    if (clozeCards.length > 0) {
      const bySource = clozeCards.reduce((acc: Record<string, number>, c: any) => {
        const k = String(c?.source || 'bilinmiyor')
        acc[k] = (acc[k] || 0) + 1
        return acc
      }, {})
      console.log(
        `Cloze kartlari: ${clozeCards.length} ` +
        `(${Object.entries(bySource).map(([k, n]) => `${k}=${n}`).join(', ')})`
      )
    } else {
      console.log('Cloze kartlari: 0 uretildi')
    }

    // R42: modelin belge/kendisi hakkindaki aciklamalari kayittan once ayiklanir
    {
      let atilan = 0
      const temizle = (t: unknown) => {
        if (typeof t !== 'string' || !t) return t
        const y = stripAiMetaSentences(t)
        if (y !== t) atilan++
        return y
      }
      parsedContent.summary = temizle(parsedContent.summary)
      parsedContent.summary_executive = temizle(parsedContent.summary_executive)
      if (Array.isArray(parsedContent.sections)) {
        parsedContent.sections = parsedContent.sections.map((sec: any) =>
          sec && typeof sec === 'object' ? { ...sec, summary: temizle(sec.summary) } : sec)
      }
      if (atilan) console.log(`R42: ${atilan} alanda model aciklamasi ayiklandi`)
    }

    const cardPayload: Record<string, unknown> = {
      document_id: documentId,
      user_id: document.user_id,
      summary: parsedContent.summary || '',
      summary_executive: parsedContent.summary_executive || '',
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
      diagrams: Array.isArray(parsedContent.diagrams) ? parsedContent.diagrams : [],
      concept_graph: (parsedContent.concept_graph && typeof parsedContent.concept_graph === 'object')
        ? parsedContent.concept_graph
        : { nodes: [], edges: [] },
      cloze_cards: clozeCards,
      outline: normalizeOutline(parsedContent.outline, parsedContent.sections),
      sections: normalizeSections(
        parsedContent.sections,
        normalizeOutline(parsedContent.outline, parsedContent.sections)
      ),
      summary_style: style,
      summary_language: lang,
      summary_length: len,
      document_type: parsedContent.document_type || 'Other',
      visual_analysis: visualAnalysisUsed,
      course_tag: document.course_tag ?? null,
      quality_meta: qualityMeta
    }

    // Ogrencinin gordugu karta karsi, kaynagin tamamiyla. Kartla birlikte
    // saklaniyor ki iki kosu loglar kaybolduktan sonra da karsilastirilabilsin.
    // qualityMeta cardPayload.quality_meta ile AYNI nesne — burada eklenen
    // alan insert'e giriyor.
    {
      const kapsama = numericCoverage(extractedText, cardPayload)
      console.log(`Son kart sayisal kapsama: ${formatCoverage(kapsama)}`)
      if (kapsama.missing.length > 0) {
        const baglam = sayisalKayipBaglami(extractedText, kapsama.missing)
        if (baglam) console.log(`Sayisal kapsama kayiplari nerede: ${baglam}`)
      }
      /* KUCUK ORNEKLEMDEN YUZDE CIKMAZ (28.10.2026 — olculmus).
         "3.ELECTRIC CIRCUIT" kartinda belgenin TAMAMINDA tek bir hedef sayi
         vardi (0,75 A) ve kart onu almayinca olcu 0/1 oldu; kullaniciya
         "sayisal kapsama %0" rozeti gosterildi. Payda 1 iken sonuc yalnizca
         %0 ya da %100 olabilir — bu bir kalite sinyali degil, gurultu.
         Gercek sayisal belgelerde payda 21-33 olculdu (ch6 21, ch7 33,
         BUS211 22), yani esik olcumu bozmuyor.
         LOG yine basiliyor: oradaki 0,75 GERCEK bir eksikti ("0,75 A ceken
         devreye 1 A sigorta"). Susturdugumuz sey olcu degil, ROZET. */
      /* OCR METNINDE ROZET YAYINLANMAZ (29.10.2026 — olculmus).
         OCR matematigi bozuyor ve olmayan sayi uretiyor. Olculen kosu
         (29 sayfalik tarama, 0/23 = %0 rozeti) kayiplarin baglami:
           521 <- "A) d (521 - 323+7)"    aslinda d(5x^3 - 3x^2 + 7)
           122 <- "f（a） = 「a2， × <1 122-1,2≥1"
           213 <- "f（z）＝丁8-213"
         23 hedefin hepsi bu siniftan; kart onlari ASLA iceremez cunku
         belgede yoklar. Grounding kapisiyla ayni durus: guvenilmez
         karsilastirmada OLCULUR, hukum verilmez. Log basilmaya devam
         ediyor — gercek bir kayip varsa orada gorunur. */
      if (kapsama.total >= KAPSAMA_ROZET_MIN_ORNEK && !ocrKullanildi) {
        qualityMeta.numeric_coverage = { kept: kapsama.kept, total: kapsama.total }
      } else if (ocrKullanildi && kapsama.total > 0) {
        console.log(
          `Sayisal kapsama rozeti YAYINLANMADI: metin OCR'dan geldi ` +
          `(${kapsama.kept}/${kapsama.total}) — OCR bozuk sayi uretiyor`
        )
      }
      if (eksikPencereler) qualityMeta.missing_windows = eksikPencereler
      // Taranmis belge yalnizca ilk N sayfasiyla okunduysa karta yaziliyor.
      if (ocrKismi) qualityMeta.ocr_kismi = ocrKismi
      if (geminiKismiKrk > 0) qualityMeta.gemini_partial = { kurtarilanKrk: geminiKismiKrk }
      /* Olcum modundaki yogunluk kapisinin bulgusu karta da yaziliyor:
         loglar birkac gunde kayboluyor, kart kaliyor. Kurali veriye bakip
         koyarken bu alan kaynak olacak. */
      if (yogunlukOlcumu && yogunlukOlcumu.dropped > 0) qualityMeta.dolgu_adayi = yogunlukOlcumu
      // Paralel modun gercek maliyeti: belge basina token, model dagilimi, sure.
      if (geminiParallelUsage.calls > 0) {
        qualityMeta.gemini_parallel = {
          ...geminiParallelUsage,
          pages: billablePages,
          total_ms: Date.now() - requestStartedAt
        }
        console.log(
          `Gemini paralel maliyet: ${geminiParallelUsage.calls} cagri, ` +
          `prompt=${geminiParallelUsage.prompt} cikti=${geminiParallelUsage.output} dusunme=${geminiParallelUsage.thoughts} token, ` +
          `${billablePages} sayfa, ${Date.now() - requestStartedAt}ms, modeller=${JSON.stringify(geminiParallelUsage.models)}`
        )
      }
    }

    let newCard: any = null
    let cardError: any = null
    {
      const res = await serviceClient.from('study_cards').insert(cardPayload).select('id').single()
      newCard = res.data
      cardError = res.error
    }
    // If quality_meta column missing, retry without it
    if (cardError && /quality_meta/i.test(String(cardError.message || cardError.details || ''))) {
      console.warn('quality_meta column missing — retrying insert without it')
      delete cardPayload.quality_meta
      const res2 = await serviceClient.from('study_cards').insert(cardPayload).select('id').single()
      newCard = res2.data
      cardError = res2.error
    }

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

    // Kota: yalnizca BASARILI ozet kullanimdan duser.
    await bestEffortRpc(serviceClient, 'record_summary_usage', { p_user: document.user_id, p_pages: billablePages, p_cache_hit: false })

    // Cache: yarim kalan (eksik pencereli) bir ozet baska ogrencilere
    // dagitilmamali — o belge bir sonraki yuklemede tam kosuyla denenir.
    /* Kismi kart onbellege GIRMEZ: girerse ayni belgeyi bir daha ozetlemek
       isteyen herkes yarim karti alir ve bir daha hic tam kart uretilmez. */
    /* UCUNCU KOSUL (21.10.2026): yedek yoldan gelen kart kalicilastirilmaz.
       Ilk iki kosul "kart TAM mi" diye soruyor; bu "kart ISTENEN kart mi"
       diye soruyor. 21.10'da ayni deste icin Gemini iki 503 aldi, Groq
       karti uretti (tam, yani iki kosul da gecti) ve onbellege girdi —
       sonraki yukleme 1.929ms'de %56 kapsamali o karti dondurdu ve
       Gemini'nin bir daha denenmesi imkansiz hale geldi. */
    if (geminiTani.geciciDustu) {
      console.log(
        'summary_cache: kart Gemini gecici hatasindan sonra Groq yedek yolundan ' +
        'geldi — kalici cevap sayilmiyor, KISMI satira yaziliyor'
      )
    }
    /* Karar saf fonksiyonda — bkz. onbellekKayitTuru. 'tam' eski kapinin
       kendisi; 'kismi' eskiden HIC yazmamak demekti ve ayni dosyayi her
       yuklemede sifirdan odetiyordu. */
    const kayitTuru = onbellekKayitTuru({
      anahtarVar: !!summaryCacheKey,
      eksikPencereVar: !!eksikPencereler,
      geminiKismiKrk,
      geciciDustu: !!geminiTani.geciciDustu
    })
    if (!SUMMARY_CACHE_ACIK) {
      console.log('summary_cache: yazma KAPALI (SUMMARY_CACHE_ACIK=false)')
    } else if (kayitTuru !== 'hayir') {
      const { document_id: _d, user_id: _u, course_tag: _c, ...shareable } = cardPayload
      const kismiKayit = kayitTuru === 'kismi'
      /* Kart KENDI icinde isaretli: arayuz rozeti ve sonraki teshis, satirin
         anahtarini gormeden de kismi oldugunu bilmeli. */
      const paylasilan = kismiKayit
        ? {
          ...shareable,
          quality_meta: {
            ...((shareable as any).quality_meta || {}),
            /* true DEGIL sebep yaziliyor — bkz. kismiKayitSebebi. Eski
               satirlar `true` tasiyor; arayuz onu 'eksik' sayiyor, yani
               geriye donuk davranis degismiyor. */
            cache_kismi: kismiKayitSebebi({ eksikPencereVar: !!eksikPencereler, geminiKismiKrk })
          }
        }
        : shareable
      /* OCR CIKTISI SATIRA EKLENIYOR — bkz. onbellektenOcrMetni. Yalnizca
         metin gercekten OCR'dan geldiyse: metinli PDF'in cikarimi ~1 sn,
         onbellekte tutmaya degmez. */
      const paylasilanTam = ocrKullanildi && extractedText.length <= ONBELLEK_OCR_MAX_KRK
        ? { ...paylasilan, _ocr_metin: { surum: ONBELLEK_OCR_SURUM, text: extractedText, sayfa: ocrKismi ? ocrKismi.sayfa : null } }
        : paylasilan
      /* IKI SATIR: dosya hash'i ve metin hash'i. Ikisi de ayni karti
         gosteriyor; hangisi once isabet ederse o kullanilir. */
      const satirlar = [summaryCacheKey, metinCacheKey].filter(Boolean).map((k) => ({
        cache_key: (k as string) + (kismiKayit ? CACHE_KISMI_EKI : ''),
        content_hash: (k as string).split(':')[0],
        page_count: billablePages,
        /* OCR metni YALNIZCA dosya hash'i satirinda: arama content_hash ile
           yapiliyor ve metin hash'i satirinin content_hash'i 't' ile
           basliyor, yani o kopya hic okunmazdi. */
        card: (k as string) === summaryCacheKey ? paylasilanTam : paylasilan
      }))
      // Bkz. onbellekUzerineYaz: yalnizca TAM yeniden-ozet eski satiri ezer.
      const uzerineYaz = onbellekUzerineYaz(kayitTuru, onbellegiAtla)
      const { error: cacheWriteErr } = await serviceClient
        .from('summary_cache')
        .upsert(satirlar, { onConflict: 'cache_key', ignoreDuplicates: !uzerineYaz })
      if (cacheWriteErr) console.warn(`summary_cache yazilamadi: ${cacheWriteErr.message}`)
      else console.log(`summary_cache yazildi [${kayitTuru.toUpperCase()}${uzerineYaz ? ', YENILE: eski satir guncellendi' : ''}]: ${satirlar.length} satir`)
    }

    return new Response(JSON.stringify({ success: true, studyCardId: newCard.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Unexpected Edge Function exception: ', err)
    /* Belge ASKIDA kalmasin — bkz. hataIcinDocumentId. Isaretleme bastirilan
       bir hatayla da olsa denenir; markFailed kendi icinde try/catch'li. */
    if (hataIcinClient && hataIcinDocumentId) {
      console.error(`Beklenmeyen istisna: ${hataIcinDocumentId} basarisiz isaretleniyor`)
      await markFailed(hataIcinClient, hataIcinDocumentId)
    }
    return new Response(JSON.stringify({ error: 'An unexpected Edge Function error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/* Ozet cache surumu. Prompt, model ya da kart semasi ozeti GORUNUR sekilde
 * degistirdiginde arttir: eski cache kayitlari anahtar uyusmadigi icin
 * kendiliginden devre disi kalir (silmeye gerek yok). */
/* SURUM 'c2' (29.10.2026). Anahtarin cekirdegi sha256(fileBytes), yani AYNI
   dosya hat ne kadar iyilesse de ayni satiri getiriyor. Olculen durum:
   parcali OCR ayni belgeden 1.230 yerine 10.970 karakter cikardi (4 -> 29
   sayfa), ama kart `CACHE ISABETI [DOSYA]` ile eski 4-sayfalik haliyle
   dondu ve 34 saniyelik OCR bosa gitti. Bir gunde kart icerigini DEGISTIREN
   dort sey birikti: parcali OCR, grounding kapisinin olcum modu (parallel +
   kesik OCR), pencere promptunun sadakat kurallari, kapsama olcusunun
   artefakt elemeleri. Eski satirlarin hicbiri bunlari gormedi.
   Surum artarsa butun satirlar gecersiz olur — kasitli: bir sonraki okuma
   yeni hattan geciyor. "yeniden ozetle" su an kapali oldugu icin
   (YENIDEN_OZETLE_ACIK) kullanicinin baska bir tazeleme yolu da yok. */
/* ONBELLEK DONDURULDU (30.10.2026, Berkay'in karari).
 *
 * Su an ozet KALITESI uzerinde calisiliyor ve ayni belgeyi tekrar tekrar
 * ozetleyip ilerlemeyi gormek gerekiyor. Onbellek bunu imkansiz kiliyordu:
 * anahtarin cekirdegi sha256(fileBytes), yani ayni dosya hat ne kadar
 * iyilesse de eski satiri getiriyor (bkz. SURUM 'c2' notu).
 *
 * Kapali oldugunda: okuma yok, yazma yok. Her kosu sifirdan.
 *
 * BEDELI BILINCLI:
 *  - Ayni dosyanin ikinci ozeti yine tam ucreti odiyor (~15-90 sn + kota).
 *  - OCR metni de bu tabloda duruyordu (bkz. onbellektenOcrMetni), yani
 *    taranmis belgeler her kosuda yeniden OCR'a gidiyor (olculen: 47-50 sn).
 *
 * Kalite yeterince yukseldiginde tek satir: true. Surum ('c2') ve butun
 * okuma/yazma mantigi oldugu gibi duruyor, silinmedi. */
const SUMMARY_CACHE_ACIK = false

const SUMMARY_CACHE_VERSION = 'c2'

/* Ikinci (metin) cache anahtarinin devreye girdigi en kisa metin.
   400 karakterin altinda — bos kapak, "Hafta 3" gibi — iki ayri belgenin
   ayni metne sahip olmasi gercek bir ihtimal ve yanlis isabet, yavas
   ozetten cok daha kotu. */
const CACHE_METIN_MIN_KRK = 400

/* KISMI SATIRIN ANAHTAR EKI. Kismi kart ayni anahtara yazilsa tam kartin
   yerini alirdi; ayri anahtara yazilinca arama onu YALNIZCA tam satir
   yokken secer. Eki sona koyuyoruz: content_hash ayrismasi bozulmuyor. */
const CACHE_KISMI_EKI = ':k'

/** Cache icin metin normalizasyonu: bosluk sadelestirme + kucuk harf.
 *  Ayni destenin iki ayri taramasi bayt duzeyinde farkli, metin
 *  duzeyinde ayni oluyor; esitligi burada kuruyoruz. */
/* ONBELLEGE YAZILABILIR MI — SAF KARAR (24.10.2026).
 *
 * Karar dort kosuldan olusuyor ve uc test bunu YALNIZCA DIZGE ARAYARAK
 * dogruluyordu (`satir.includes('geminiKismiKrk === 0')` gibi). Yani
 * `&&` -> `||` yazilsa, bir `!` dusse ya da kapi baska bir dalin icine
 * tasinsa UC TESTIN UCU DE YESIL kalir ve kismi/zayif kart kalici olarak
 * onbellege girer. Kosullarin VARLIGI olculuyordu, MANTIGI degil.
 *
 * Karar artik saf bir fonksiyon: 16 kombinasyonun tamami tabloyla
 * sinanabiliyor.
 *
 * Kosullarin anlami:
 *   anahtarVar      — anahtar uretilemediyse yazacak yer yok
 *   eksikPencereYok — yarim kalan ozet baska ogrencilere dagitilmamali
 *   kismiDegil      — kesilen Gemini akisindan kurtarilan kart tam degil
 *   geciciDusmedi   — Gemini gecici hatayla dustuyse cikan kart YEDEK
 *                     yoldan geliyor; tam olabilir ama ISTENEN kart degil
 *                     ve o dosya icin Gemini bir daha hic denenmemeli */
/* UC DEGERLI KARAR (25.10.2026). onbellegeYazilabilir "tam kart mi" diye
   soruyor ve oldugu gibi kaliyor; bu sarmal ona "yazilmayacaksa bile kismi
   satira yazilabilir mi" sorusunu ekliyor. Anahtar yoksa yazacak yer yok. */
/* KISMI SATIRIN SEBEBI (28.10.2026).
 *
 * 'kismi' iki bambaska durumu birden anlatiyordu ve ikisi de ogrenciye
 * ayni rozet olarak donuyordu:
 *
 *   eksik  — kartin ICERIGINDE bosluk var: pencere dustu ya da Gemini
 *            taslagi yarim kurtarildi. "Kismi ozet" demek dogru.
 *   gecici — kart TAM; satir yalnizca Gemini denenemedigi icin kalici
 *            sayilmiyor (devre kesici acik / kota 429). Kartta eksik bir
 *            sey yok, yalnizca "yarin daha iyisi uretilebilir".
 *
 * OLCULDU (27.10.2026, 20:46 kosusu): devre kesici acikken Groq butun
 * butceyi aldi, 3/3 pencere okundu, anlati yazari kostu, 27 kavram ve 33
 * atif cikti. Kartta "eksik ozet" rozeti BILE YOKTU ama "kismi ozet"
 * yaziyordu. Atlanan tek asama review'du ve kart onu zaten ayri bir
 * rozette soyluyor.
 *
 * Satir her iki durumda da ':k' ekiyle yaziliyor — onbellek davranisi
 * degismiyor, degisen yalnizca ogrenciye ne denildigi. */
function kismiKayitSebebi(k: { eksikPencereVar: boolean; geminiKismiKrk: number }): 'eksik' | 'gecici' {
  return (k.eksikPencereVar || k.geminiKismiKrk > 0) ? 'eksik' : 'gecici'
}

function onbellekKayitTuru(k: {
  anahtarVar: boolean
  eksikPencereVar: boolean
  geminiKismiKrk: number
  geciciDustu: boolean
}): 'tam' | 'kismi' | 'hayir' {
  if (!k.anahtarVar) return 'hayir'
  return onbellegeYazilabilir(k) ? 'tam' : 'kismi'
}

/* YENIDEN OZETLE ESKI KARTIN USTUNE YAZAR (28.10.2026).
 *
 * Yazim `ignoreDuplicates: true` idi: ayni anahtarda satir varsa yeni kart
 * hic yazilmiyordu. Yeniden ozetleme (yenile=true) onbellek OKUMASINI
 * atliyor, yani yeni karti uretiyor ama kalicilastiramiyordu — belge bir
 * sonraki normal "Ozetle"de yine ESKI karti 2 sn'de donduruyordu.
 *
 * Yalnizca TAM kart ustune yazar. Kismi kart zaten ':k' satirina gidiyor
 * ve tam satir siralamada onden geldigi icin iyi karti golgeleyemez; ama
 * kismi bir yeniden-ozet ayni ':k' satirini da ezmesin — onun da eskisinden
 * iyi oldugunu bilmiyoruz. Normal kosu davranisi DEGISMEZ. */
function onbellekUzerineYaz(kayitTuru: 'tam' | 'kismi' | 'hayir', onbellegiAtla: boolean): boolean {
  return onbellegiAtla && kayitTuru === 'tam'
}

function onbellegeYazilabilir(k: {
  anahtarVar: boolean
  eksikPencereVar: boolean
  geminiKismiKrk: number
  geciciDustu: boolean
}): boolean {
  return k.anahtarVar && !k.eksikPencereVar && k.geminiKismiKrk === 0 && !k.geciciDustu
}

function cacheMetniNormalize(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Metnin ikinci cache anahtari icin hash'i. Kisa metinde null:
 *  carpisma riski kazanctan buyuk. */
async function sha256Metin(text: string): Promise<string | null> {
  const norm = cacheMetniNormalize(text)
  if (norm.length < CACHE_METIN_MIN_KRK) return null
  return await sha256Hex(new TextEncoder().encode(norm))
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/* OCR CIKTISI ONBELLEKTE TUTULUYOR (29.10.2026 olcumu).
 *
 * Week_8_Derivative (29 sayfa, saf tarama: 29 JPEG + 0 font) OCR'da 10
 * parcada 31.846 ms harciyor. Ozet onbellegi ISABET ETSE BILE o 32 saniye
 * her yuklemede yeniden yaniyordu, cunku onbellek kontrolu metin
 * cikariminin SONRASINDA duruyor. Kontrolu yukari tasimak secenek degil:
 * oradaki yorum sebebini yaziyor — onbellekten gelen belgede de
 * document_chunks yazilmali, yoksa "Kaynakla calis" ve belge sohbeti o
 * belge icin bos kalir.
 *
 * Bu yuzden tasinan sey kontrol degil, OCR CIKTISI. Onbellek satiri kendi
 * metnini de tasiyor; ayni bayt dizisi yeniden yuklendiginde OCR cagrisi
 * hic yapilmiyor, metin satirdan okunuyor. Cikarimin geri kalani, chunk
 * yazimi, kota ve kart servisi oldugu gibi kaliyor — yani davranis degismiyor,
 * yalnizca 32 saniye ve 10 OCR.space cagrisi gidiyor.
 *
 * Arama content_hash ILE: anahtar dil/stil/uzunluk/gorsel ayarlarini da
 * tasiyor ama OCR metni bunlarin hicbirine bagli degil, dosyanin kendisine
 * bagli. Metin hash'i satirlarinin content_hash'i 't' ile basliyor
 * (bkz. summary_cache yazimi), yani dosya hash'iyle cakismiyor.
 *
 * `_ocr_metin` study_cards'a ASLA gitmiyor: isabet yolunda insert'ten once
 * siliniyor (quality_meta'daki ayni savunma gibi). */
const ONBELLEK_OCR_MAX_KRK = 300_000

/* OCR METNININ KENDI SURUMU (29.10.2026). Arama content_hash ile yapiliyor,
   yani SUMMARY_CACHE_VERSION bu metni GECERSIZ KILMIYOR. Dun tam bu tuzak
   olculdu: parcali OCR ayni belgeden 1.230 yerine 10.970 karakter cikardi
   ama onbellek eski satiri dondurdu (bkz. SURUM 'c2' notu). OCR yolu
   degistiginde — parcalama, sayfa butcesi, isaretleme, tablo bicimleme —
   BU SABIT artirilir; surumu uymayan satir okunmaz, metin yeniden cikarilir.
   Damgasiz satir da okunmaz. */
const ONBELLEK_OCR_SURUM = 'o1'

async function onbellektenOcrMetni(
  client: any,
  contentHash: string
): Promise<{ text: string; sayfa: number | null } | null> {
  try {
    const { data, error } = await client
      .from('summary_cache')
      .select('card')
      .eq('content_hash', contentHash)
    if (error) {
      console.warn(`OCR onbellegi okunamadi (${error.message}) — normal OCR yoluna devam`)
      return null
    }
    if (!Array.isArray(data)) return null
    for (const satir of data) {
      const m = (satir as any)?.card?._ocr_metin
      if (m && m.surum !== ONBELLEK_OCR_SURUM) {
        console.log(
          `OCR onbellegi ATLANDI: satir surumu ${JSON.stringify(m.surum)}, ` +
          `beklenen '${ONBELLEK_OCR_SURUM}' — metin yeniden cikarilacak`
        )
        continue
      }
      // 200 krk esigi OCR blogundakinin aynisi: daha kisasi "tarandi ama
      // okunamadi" demek ve SCANNED_PDF hatasina gitmeli.
      if (m && typeof m.text === 'string' && m.text.trim().length >= 200) {
        return { text: m.text, sayfa: typeof m.sayfa === 'number' ? m.sayfa : null }
      }
    }
    return null
  } catch (e) {
    console.warn('OCR onbellegi: beklenmeyen hata, atlandi:', e)
    return null
  }
}

/** Kota/cache RPC'leri ozet akisini asla dusurmemeli. */
async function bestEffortRpc(client: any, fn: string, args: Record<string, unknown>) {
  try {
    const { error } = await client.rpc(fn, args)
    if (error) console.warn(`${fn} basarisiz: ${error.message}`)
  } catch (e) {
    console.warn(`${fn} istisna:`, e)
  }
}

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

/* PARCALI OCR (28.10.2026 — olculmus kayip uzerine).
 *
 * OCR.space tek istekte plan sinirina kadar okuyor; olculen sinir 3-4
 * sayfa. Week_8_Derivative_Problem_Solving_II_SS.pdf (29 sayfa, 29 JPEG,
 * 0 font) tek istekte 4 sayfadan 1.230 karakter verdi — belgenin %4'u.
 * API'nin sayfa araligi parametresi YOK, dolayisiyla belgeyi BIZ boluyoruz
 * ve her parcayi ayri istekle okuyoruz. Mini-PDF uretimi zaten vardi
 * (buildPdfSubsetBytes, gorsel gecis icin yazilmisti).
 *
 * Parca 3 sayfa: olculen sinirin (3) altinda kalmak, dorde guvenmemek.
 * Butce, Supabase'in ~150 sn'lik sert sinirina karsi: parcalar kucuk
 * oldugu icin her cagri tam dosyadan hizli (1,5 MB yukleme yok), ama 29
 * sayfa 10 istek demek ve hepsi sigmayabilir. Sigmayan kisim eksik kalir
 * ve KART ROZETLENIR — sessizce kaybolmaz. */
const OCR_PARCA_SAYFA = 3
const OCR_PARCA_BUTCE_MS = 60_000

/* PARCALAR SIRAYLA KOSUYORDU VE BELGE BITMIYORDU (30.10.2026 olcumu).
 *
 * Iki kosu, iki belge, ayni sonuc:
 *   Week 8 (29 sayfa): 8 parca, 70300ms -> butce doldu, 24/29 sayfa
 *   Week 9 (27 sayfa): 7 parca, 60555ms -> butce doldu, 21/27 sayfa
 * Parca basina ~8,8 sn ve parcalar TEK TEK bekleniyordu; 29 sayfa 10 parca
 * demek, yani 88 sn — 60 sn'lik butceye hicbir zaman sigmiyor. Bedeli
 * yalnizca eksik sayfa degil: OCR hattin %74-76'sini yiyordu, Week 8'de
 * gorsel gecis "butce 27685ms <= 35000ms" diye komple atlandi.
 *
 * NEDEN ILAC PARALELLIK: her parca ayri bir HTTP cagrisi ve bekleme
 * ag gecikmesi; es zamanli uc cagri ile 10 parca 4 dalgaya iner
 * (~35 sn). Butce buyutmek cozum DEGILDI: Supabase'in sert siniri ~150 sn
 * ve kalan sureyi anlati yazari ile gorsel gecis paylasiyor.
 *
 * ES ZAMAN 3, DOKUMANTE SINIR OLMADIGI ICIN TEMKINLI. ocr.space ucretsiz
 * katmani 500 istek/gun/IP, 1 MB dosya ve 3 sayfa/PDF yaziyor; es zamanli
 * baglanti sinirini HIC yazmiyor. Bu yuzden sayi kucuk tutuldu ve hata
 * halinde kendini kapatiyor: bir dalgada parca duserse es zaman 1'e iner
 * (geri kalani sirayla okunur) ve dusen parcalar bir kez tekrar denenir.
 *
 * ROZETIN SOZU KORUNUYOR. Ekranda "yalnizca ilk N sayfa okunabildi"
 * yaziyor (js/acadex-ink.js). Paralel kosuda ortada bir parca duserse
 * okunan sayfalar kesintisiz olmaz, bu yuzden rozete giden sayi
 * KESINTISIZ ONEK; delikten sonraki sayfalarin metni yine karta giriyor,
 * rozet onu iddia etmiyor. Az soylemek, fazla soylemekten iyi. */
const OCR_ES_ZAMAN = 3
/* Dalgada parca dustukten sonraki bir kerelik bekleme — bkz. parcaOku
   icindeki "BOS CEVAP BASARI DEGIL" notu. Hiz siniri serilestirmekle degil
   zamanla geciyor. */
const OCR_HIZ_BEKLEME_MS = 1_500

async function tryOCRParcali(
  fileBytes: Uint8Array,
  apiKey: string,
  butceMs: number = OCR_PARCA_BUTCE_MS
): Promise<{ text: string; okunanSayfa: number; toplamSayfa: number; yuzeyHatasi: number }> {
  let toplam = 0
  try {
    toplam = (await PDFDocument.load(fileBytes, { ignoreEncryption: true })).getPageCount()
  } catch (_e) {
    toplam = 0
  }
  // Sayfa sayisi okunamadiysa ya da zaten tek parcaysa: eski tek-istek yolu.
  /* SAYFA ISARETI KOYULUYOR (29.10.2026 — olculmus kayip).
   *
   * Normal cikarim metne "--- SAYFA N ---" basiyor; OCR yolu basmiyordu ve
   * bedeli olculdu: 29 sayfalik tarama "belge tipi duz metin (sayfa az (0);
   * 0 isaret)" oldu, kart "Diger" tipiyle cikti ve atif katmani komple
   * sustu ("Citation anchoring: pages=0 added=0") — onceki kartta [1]-[5]
   * atiflari vardi, bu kartta hic kaynakca yok.
   * Parcali OCR sayfa sinirini zaten BILIYOR: parca i, sayfa i*3+1'den
   * basliyor ve ParsedResults sayfa basina bir kayit donuyor. */
  const isaretle = (sayfalar: string[], ilkSayfa: number) =>
    sayfalar.map((m, i) => `--- SAYFA ${ilkSayfa + i} ---\n${m}`).join('\n\n')

  if (toplam <= OCR_PARCA_SAYFA) {
    const tek = await tryOCR(fileBytes, apiKey)
    return {
      text: isaretle(tek.sayfalar, 1),
      okunanSayfa: tek.sayfa,
      toplamSayfa: toplam || tek.sayfa,
      yuzeyHatasi: (typeof tek.durum === 'number' && (tek.durum >= 500 || tek.durum === 429)) ? 1 : 0
    }
  }

  const basladi = Date.now()
  const parcaSayisi = Math.ceil(toplam / OCR_PARCA_SAYFA)
  // Sonuc SIRASINA gore degil PARCA SIRASINA gore toplaniyor: sayfa
  // isaretleri dogru kalsin ve metin belgenin sirasini izlesin.
  const metinler: Array<string | null> = new Array(parcaSayisi).fill(null)
  const sayfaAdedi: number[] = new Array(parcaSayisi).fill(0)
  let esZaman = OCR_ES_ZAMAN
  // Kac parca YUZEY hatasiyla dustu (5xx/429) — bkz. tryOCR icindeki not.
  let yuzeyHatasi = 0

  /** Tek parcayi okur. Hata firlatmaz; dusen parca null doner. */
  const parcaOku = async (k: number): Promise<boolean> => {
    const bas = k * OCR_PARCA_SAYFA
    const idx: number[] = []
    for (let i = bas; i < Math.min(bas + OCR_PARCA_SAYFA, toplam); i++) idx.push(i)
    const alt = await buildPdfSubsetBytes(fileBytes, idx)
    if (!alt) {
      console.warn(`OCR parcali: ${bas + 1}-${bas + idx.length}. sayfalar icin mini-PDF uretilemedi`)
      return false
    }
    try {
      const r = await tryOCR(alt, apiKey)
      /* BOS CEVAP BASARI DEGIL (30.10.2026 olcumu).
       *
       * Eski hali `sayfaAdedi[k] = Math.max(r.sayfa, 0) || idx.length`
       * yaziyordu: parca hic metin dondurmese bile sayfalari OKUNMUS
       * sayiyordu ve `true` donuyordu. Kusur eski sirali kodda da vardi,
       * ama orada tetiklenmiyordu; paralellik onu acti ve bedeli olculdu:
       *   Week 10 1. deneme: 31/31 sayfa, 0 parca, 0 karakter, 229ms
       *   Week 9  1. deneme: 27/27 sayfa, 3 parca, 3347 karakter
       * Yani sifir sayfa okunmusken "31/31 sayfa" raporlandi, kismi rozeti
       * yanmadi, hat belgenin tamamina sahip oldugunu sanip 3.347 karakterle
       * devam etti ve kart vision 502 + draft 502 ile DUSTU. Ustelik bos
       * cevap `true` dondugu icin tasarlanan korunma (tekrar deneme + es
       * zamani 1'e dusurme) hic devreye girmedi.
       *
       * 229ms'de 11 istegin hepsinin reddedilmesi ocr.space'in dokumante
       * EDILMEYEN es zamanlilik/patlama sinirinin gercek oldugunu gosteriyor
       * (bkz. OCR_ES_ZAMAN notu). Artik bos cevap DUSEN parca sayiliyor:
       * korunma aciliyor ve sayfa sayaci yalanlamiyor. */
      const krk = r.text.trim().length
      if (krk === 0 || r.sayfa <= 0) {
        // 5xx / 429: yuzeyin kendi sorunu, belgenin degil — bkz. tryOCR notu.
        if (typeof r.durum === 'number' && (r.durum >= 500 || r.durum === 429)) yuzeyHatasi++
        console.warn(
          `OCR parcali: ${bas + 1}-${bas + idx.length}. sayfalar BOS dondu ` +
          `(sayfa=${r.sayfa}, ${krk} krk${r.kesildi ? ', kesildi' : ''}` +
          `${r.durum ? `, HTTP ${r.durum}` : ''}) — dusen parca sayiliyor`
        )
        return false
      }
      metinler[k] = isaretle(r.sayfalar, bas + 1)
      sayfaAdedi[k] = Math.min(r.sayfa, idx.length)
      return true
    } catch (err) {
      /* Bir parca duserse elimizdekini tutuyoruz: yarim metin, hic
         metinden iyidir ve eksiklik karta rozet olarak yaziliyor. */
      console.warn(`OCR parcali: ${bas + 1}. sayfadan itibaren parca dustu (${err})`)
      return false
    }
  }

  const okunanSayfaToplami = () => sayfaAdedi.reduce((a, b) => a + b, 0)

  let k = 0
  let durdu = false
  while (k < parcaSayisi && !durdu) {
    const gecen = Date.now() - basladi
    if (gecen > butceMs) {
      console.warn(
        `OCR parcali: butce doldu (${gecen}ms > ${butceMs}ms), ` +
        `${okunanSayfaToplami()}/${toplam} sayfa okundu`
      )
      break
    }
    const grup: number[] = []
    for (let i = k; i < Math.min(k + esZaman, parcaSayisi); i++) grup.push(i)
    k += grup.length
    const sonuclar = await Promise.all(grup.map(parcaOku))
    const dusenler = grup.filter((_g, i) => !sonuclar[i])
    if (dusenler.length === 0) continue

    /* Dalgada parca dustu. Sebebi bilmiyoruz — dokumante edilmemis bir es
       zamanlilik siniri da olabilir — bu yuzden once es zamani kapatip
       dusenleri TEK TEK bir kez daha deniyoruz. */
    const eskiEsZaman = esZaman
    esZaman = 1
    /* Hiz siniri SERILESTIRMEKLE degil ZAMANLA geciyor: dusen parcalari
       hemen tekrar denemek ayni duvara carpar. Bir kerelik kisa bekleme,
       butceden sayilan ve olcuyle sinirli bir bedel. */
    if (eskiEsZaman !== 1 && Date.now() - basladi + OCR_HIZ_BEKLEME_MS < butceMs) {
      await new Promise((r) => setTimeout(r, OCR_HIZ_BEKLEME_MS))
    }
    for (const d of dusenler) {
      if (Date.now() - basladi > butceMs) { durdu = true; break }
      if (await parcaOku(d)) continue
      // Sirayla da dusuyorsa sorun es zamanlilik degil: duruluyor.
      durdu = true
      break
    }
    if (eskiEsZaman !== 1) {
      console.warn(
        `OCR parcali: ${dusenler.length} parca dustu, es zaman ${eskiEsZaman} -> 1 ` +
        `(geri kalani sirayla)`
      )
    }
  }

  /* Rozet "ilk N sayfa" diyor: KESINTISIZ onek sayiliyor. Delikten
     sonraki sayfalarin metni karta giriyor, rozet onu iddia etmiyor. */
  let onek = 0
  for (let i = 0; i < parcaSayisi && metinler[i] !== null; i++) onek += sayfaAdedi[i]
  const toplamOkunan = okunanSayfaToplami()
  const parcalar = metinler.filter((m): m is string => m !== null && m.length > 0)
  console.log(
    `OCR parcali: ${toplamOkunan}/${toplam} sayfa, ${parcalar.length} parca, ` +
    `${parcalar.join('').length} karakter, ${Date.now() - basladi}ms, es zaman ${OCR_ES_ZAMAN}` +
    (onek !== toplamOkunan ? ` — ARADA DELIK VAR, rozete kesintisiz onek (${onek}) yaziliyor` : '')
  )
  return {
    text: parcalar.join('\n\n'),
    okunanSayfa: Math.min(onek, toplam),
    toplamSayfa: toplam,
    yuzeyHatasi
  }
}

async function tryOCR(
  fileBytes: Uint8Array,
  apiKey: string
): Promise<{ text: string; sayfalar: string[]; kesildi: boolean; sayfa: number; durum?: number }> {
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
  const parcalar = (result.ParsedResults ?? []) as any[]
  /* ParsedResults SAYFA BASINA bir kayit. Birlesik metin geriye uyumluluk
     icin duruyor; `sayfalar` ise cagirana sayfa sinirini veriyor ki
     "--- SAYFA N ---" isaretlerini koyabilsin (bkz. tryOCRParcali). */
  const sayfalar = parcalar.map((r: any) => String(r.ParsedText || ''))
  const text = sayfalar.join('\n\n')

  /* KESIK OCR SONUCU ATILMIYOR (28.10.2026 — olculmus kayip).
   *
   * OCR.space sayfa sinirina takildiginda HEM `IsErroredOnProcessing: true`
   * koyuyor HEM DE sinira kadarki sayfalarin metnini donduruyor:
   *   "The maximum page limit of 3 was reached and only pages upto the
   *    limit were parsed successfully"
   * Eski kod bayragi gorup firlatiyordu ve elindeki 3 sayfalik metni
   * cope atiyordu; cagiran da SCANNED_PDF'e cevirip belgeyi 'failed'
   * isaretliyordu. Week_8_Derivative_Problem_Solving_II_SS.pdf 20:07'de
   * ve ondan onceki her denemede tam burada oluyordu.
   * Artik kullanilabilir metin varsa donuyor, KESILDIGI soylenerek —
   * cagiran bunu karta rozet olarak yaziyor. */
  if (result.IsErroredOnProcessing) {
    if (text.trim().length >= 200) {
      return { text, sayfalar, kesildi: true, sayfa: parcalar.length }
    }
    throw new Error(result.ErrorMessage?.[0] || 'OCR processing failed');
  }
  /* BOS CEVAP SEBEBINI SOYLEMELI (30.10.2026 olcumu). ParsedResults bos
   * gelip IsErroredOnProcessing de yoksa eski kod sessizce bos metin
   * donuyordu; log "0 parca, 0 karakter, 229ms" diyor ama NEDEN demiyordu.
   * Teshis icin yuzeyin kendi alanlari basiliyor — anahtar YOK, yalnizca
   * durum ve kisa mesaj. */
  if (parcalar.length === 0) {
    const sebep = result.ErrorMessage?.[0] || result.ErrorDetails ||
      (typeof result.OCRExitCode === 'number' ? `OCRExitCode=${result.OCRExitCode}` : '') ||
      `HTTP ${response.status}`
    console.warn(`OCR yuzeyi BOS dondu: ${String(sebep).slice(0, 200)}`)
    /* YUZEY DUSTU MU, BELGE MI OKUNAMIYOR (31.10.2026 olcumu).
     * Sebep yalnizca loglaniyordu; cagiran ikisini ayirt edemedigi icin
     * ogrenciye her halde "taranmis PDF, OCR yazilimiyla cevirin" diyordu.
     * Olculen kosu: Week 9, dort parca birden "HTTP 503" — ocr.space kisa
     * sure kapanmisti, belgede bir sorun YOKTU; ayni belge 90 saniye once
     * ve 80 saniye sonra 27/27 sayfa okunmustu. Durum kodu artik yukari
     * tasiniyor ki mesaj dogruyu soyleyebilsin. */
    return { text, sayfalar, kesildi: false, sayfa: 0, durum: response.status }
  }
  return { text, sayfalar, kesildi: false, sayfa: parcalar.length };
}
