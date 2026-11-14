// ==========================================================================
// Acadex Sunum — gerçek web araştırmasıyla sunum (sunum-research)
//
// action 'research': konu → Tavily web araması → Groq yalnız bu kaynaklardan
//   sunum kurgusu yazar (her asetat için uygun düzen + kaynak numarası) →
//   SUNUCU, rakam ve tarihleri kaynak metniyle birebir karşılaştırır
//   (yapay zekâya sorulmaz, uydurma "doğrulandı" olamaz) → APA kaynakça.
// action 'images': konu → Unsplash'ten telifsiz yatay fotoğraflar (Pexels yedek,
//   ikisi de sonuç vermezse Wikimedia Commons).
// action 'illustrate': asetat listesi → her asetata konusuna uygun görsel.
//   Somut bir kişi/makine/yer/kurum ise Wikipedia'nın kendi görseli (yalnız
//   özgür lisanslı), kavramsa Unsplash → Pexels → Wikimedia Commons.
// action 'track':  seçilen Unsplash fotoğrafının indirme sayacı (Unsplash kuralı).
//
// v2 (14.11.2026) — NEDEN: canlı ölçümde araştırma tek Tavily sorgusuna (konu
// cümlesinin kendisi) dayanıyordu ve modele her kaynağın yalnız ilk ~2.300
// karakteri gidiyordu; görsel ise deste başına TEK aramaydı ve çoğu destede
// hiç fotoğraf çıkmıyordu. Artık:
//   1) konu 3 arama sorgusuna açılır (kendi dili, bir alt başlık, İngilizce),
//   2) sorgular paralel aranır, sonuçlar birleştirilir, alan adı başına 2 kaynak,
//   3) Wikipedia (TR + EN) anahtarsız ek kaynak olur — Tavily düşse de araştırma
//      ayakta kalır,
//   4) modele kaynağın başı değil, konuyla en çok örtüşen paragrafları gider,
//   5) yazar her asetat için bir görsel ipucu üretir (image.q / image.entity).
//
// Gizli anahtarlar Supabase → Edge Functions → Secrets'ta durur:
//   TAVILY_API_KEY, UNSPLASH_ACCESS_KEY, GROQ_API_KEY. Tarayıcıya hiç gitmez.
// ==========================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Src = { id: number; title: string; url: string; site: string; date: string; text: string; snippet: string };

const KINDS = ["list", "two", "time", "stat", "chart", "quote", "table"];

// ---------- ağ yardımcıları ----------
// Wikimedia, kimliği belli olmayan istemcileri reddeder; User-Agent zorunlu.
const UA = { "User-Agent": "AcadexSunum/2.0 (https://acadex.com.tr)", "Accept": "application/json" };
const tfetch = async (url: string, init: RequestInit = {}, ms = 7000): Promise<Response | null> => {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal }); } catch { return null; } finally { clearTimeout(t); }
};
const stripTags = (h: string) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

// ---------- Wikipedia: anahtarsız kaynak ----------
type Wiki = { title: string; url: string; text: string; date: string; lang: string };
async function wikiPages(lang: string, q: string, n: number): Promise<Wiki[]> {
  const base = `https://${lang}.wikipedia.org/w/api.php?format=json&origin=*`;
  const sr = await tfetch(`${base}&action=query&list=search&srlimit=${n}&srsearch=${encodeURIComponent(q)}`, { headers: UA }, 6000);
  if (!sr || !sr.ok) return [];
  const sj: any = await sr.json().catch(() => null);
  const titles: string[] = (sj?.query?.search || []).map((x: any) => String(x.title || "")).filter(Boolean).slice(0, n);
  const out = await Promise.all(titles.map(async (t) => {
    // Tam metin yalnız tek sayfalık istekte döner (exlimit=1).
    const r = await tfetch(`${base}&action=query&prop=extracts|info&explaintext=1&redirects=1&titles=${encodeURIComponent(t)}`, { headers: UA }, 7000);
    if (!r || !r.ok) return null;
    const j: any = await r.json().catch(() => null);
    const pg: any = Object.values(j?.query?.pages || {})[0];
    const text = String(pg?.extract || "").trim();
    if (text.length < 400) return null;                      // taslak/anlam ayrımı sayfası kaynak olmaz
    return { title: String(pg.title || t), url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(pg.title || t).replace(/ /g, "_"))}`, text: text.slice(0, 20000), date: String(pg?.touched || "").slice(0, 10), lang } as Wiki;
  }));
  return out.filter(Boolean) as Wiki[];
}

// ---------- görsel kaynakları ----------
type Photo = { id: string; alt: string; w: number; h: number; thumb: string; large: string; photographer: string; photographer_url?: string; page: string; source: string; source_url: string; track?: string; license?: string };
const UTM = "utm_source=acadex&utm_medium=referral";
const mapUnsplash = (p: any, q: string): Photo => ({
  id: String(p.id), alt: p.alt_description || p.description || q, w: p.width, h: p.height,
  thumb: p.urls?.small, large: p.urls?.regular,
  photographer: p.user?.name, photographer_url: `${p.user?.links?.html}?${UTM}`, page: `${p.links?.html}?${UTM}`,
  source: "Unsplash", source_url: `https://unsplash.com/?${UTM}`, track: p.links?.download_location,
});
const mapPexels = (p: any, q: string): Photo => ({
  id: String(p.id), alt: p.alt || q, w: p.width, h: p.height, thumb: p.src?.medium, large: p.src?.large,
  photographer: p.photographer, photographer_url: p.photographer_url, page: p.url, source: "Pexels", source_url: "https://www.pexels.com",
});
async function unsplashSearch(q: string, per: number): Promise<{ photos: Photo[]; rate: boolean; ok: boolean }> {
  const key = Deno.env.get("UNSPLASH_ACCESS_KEY"); if (!key) return { photos: [], rate: false, ok: false };
  const r = await tfetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${per}&orientation=landscape&content_filter=high`, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } }, 7000);
  if (!r) return { photos: [], rate: false, ok: false };
  if (r.status === 403 || r.status === 429) return { photos: [], rate: true, ok: false };
  if (!r.ok) return { photos: [], rate: false, ok: false };
  const d: any = await r.json().catch(() => null);
  return { photos: (d?.results || []).map((p: any) => mapUnsplash(p, q)).filter((p: Photo) => p.large), rate: false, ok: true };
}
async function pexelsSearch(q: string, per: number, lang: string): Promise<Photo[]> {
  const key = Deno.env.get("PEXELS_API_KEY"); if (!key) return [];
  const r = await tfetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${per}&orientation=landscape&locale=${lang === "en" ? "en-US" : "tr-TR"}`, { headers: { Authorization: key } }, 7000);
  if (!r || !r.ok) return [];
  const d: any = await r.json().catch(() => null);
  return (d?.photos || []).map((p: any) => mapPexels(p, q)).filter((p: Photo) => p.large);
}
// Wikimedia Commons: anahtarsız, tamamı özgür lisanslı. Stok fotoğraf kadar
// "şık" değildir ama somut konularda (tarihî makine, bina, belge) gerçeğini verir.
const NOT_PHOTO = /chart|diagram|graph|\bmap\b|logo|icon|flag|insignia|emblem|patch|schema|schematic|timeline|table|plot|infographic|screenshot|poster|cover|stamp|signature|coat of arms/i;
async function commonsSearch(q: string, per: number): Promise<Photo[]> {
  const r = await tfetch(`https://commons.wikimedia.org/w/api.php?format=json&origin=*&action=query&generator=search&gsrnamespace=6&gsrlimit=${per}&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1200`, { headers: UA }, 7000);
  if (!r || !r.ok) return [];
  const j: any = await r.json().catch(() => null);
  const pages: any[] = Object.values(j?.query?.pages || {});
  pages.sort((a, b) => (a.index || 0) - (b.index || 0));
  const out: Photo[] = [];
  for (const pg of pages) {
    // Yalnız fotoğraf: canlı destede giriş asetatına "Astronaut Assignments
    // Chart.png" geldi (14.11.2026). PNG'ler çoğunlukla çizelge, harita, şema.
    const ii = pg?.imageinfo?.[0]; if (!ii || String(ii.mime || "") !== "image/jpeg") continue;
    if (NOT_PHOTO.test(String(pg.title || ""))) continue;
    if ((ii.width || 0) < 700 || (ii.height || 0) < 400) continue;          // küçük görsel perdede bulanır
    if ((ii.height || 1) / (ii.width || 1) > 1.6) continue;                  // çok dikey görsel asetata oturmaz
    const meta = ii.extmetadata || {};
    out.push({ id: "c" + pg.pageid, alt: stripTags(meta.ImageDescription?.value || "").slice(0, 160) || q, w: ii.thumbwidth || ii.width, h: ii.thumbheight || ii.height,
      thumb: ii.thumburl || ii.url, large: ii.thumburl || ii.url, photographer: stripTags(meta.Artist?.value || "").slice(0, 60), page: ii.descriptionurl || "",
      source: "Wikimedia Commons", source_url: "https://commons.wikimedia.org", license: stripTags(meta.LicenseShortName?.value || "") });
  }
  return out;
}
// Wikipedia maddesinin kendi görseli: yalnız ÖZGÜR lisanslı (pilicense=free) —
// adil kullanım (logo, afiş, kapak) görselleri sunuma taşınmaz.
async function wikiImage(entity: string): Promise<Photo | null> {
  for (const lang of ["en", "tr"]) {
    const base = `https://${lang}.wikipedia.org/w/api.php?format=json&origin=*&action=query&prop=pageimages|info&inprop=url&piprop=thumbnail|name&pithumbsize=1200&pilicense=free&redirects=1`;
    let r = await tfetch(`${base}&titles=${encodeURIComponent(entity)}`, { headers: UA }, 6000);
    let j: any = r && r.ok ? await r.json().catch(() => null) : null;
    let pg: any = Object.values(j?.query?.pages || {})[0];
    if (!pg?.thumbnail) {
      r = await tfetch(`${base}&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(entity)}`, { headers: UA }, 6000);
      j = r && r.ok ? await r.json().catch(() => null) : null;
      pg = Object.values(j?.query?.pages || {})[0];
    }
    const th = pg?.thumbnail; if (!th?.source || (th.width || 0) < 420) continue;
    return { id: "w" + pg.pageid, alt: String(pg.title || entity), w: th.width, h: th.height, thumb: th.source, large: th.source, photographer: "",
      page: pg.pageimage ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(pg.pageimage)}` : String(pg.fullurl || ""), source: "Wikimedia Commons", source_url: "https://commons.wikimedia.org" };
  }
  return null;
}
// Bir destenin görselleri: her ipucu için sırayla dener, aynı görseli iki
// asetata koymaz. Unsplash'in saatlik sınırı dar olduğu için (ücretsiz katman
// 50 istek) deste başına en çok UNSPLASH_MAX arama yapılır.
const UNSPLASH_MAX = 5;
type Hint = { i: number; q: string; entity: string };
async function resolveImages(hints: Hint[], lang: string): Promise<{ photos: (Photo & { i: number })[]; rate: boolean }> {
  const used = new Set<string>(); let uCalls = 0, rate = false;
  const take = (list: Photo[]) => { const p = list.find((x) => x && x.large && !used.has(x.large)); if (p) used.add(p.large); return p || null; };
  // Wikipedia aramaları paralel; stok aramaları sırayla (sınır sayacı ve tekrar denetimi için).
  const wiki = await Promise.all(hints.map((h) => h.entity ? wikiImage(h.entity) : Promise.resolve(null)));
  const photos: (Photo & { i: number })[] = [];
  for (let k = 0; k < hints.length; k++) {
    const h = hints[k]; let p: Photo | null = wiki[k] ? take([wiki[k] as Photo]) : null;
    const q = (h.q || h.entity || "").slice(0, 80).trim();
    if (!p && q && !rate && uCalls < UNSPLASH_MAX) { uCalls++; const u = await unsplashSearch(q, 6); if (u.rate) rate = true; p = take(u.photos); }
    if (!p && q) p = take(await pexelsSearch(q, 6, lang));
    if (!p && q) p = take(await commonsSearch(h.entity || q, 8));
    if (p) photos.push({ ...p, i: h.i });
  }
  return { photos, rate };
}

// ---------- kaynak metninden konuya en yakın paragraflar ----------
// Modele kaynağın BAŞI değil, konuyla örtüşen yerleri gider: sayfanın ilk 900
// karakteri çoğu sitede menü, çerez bildirimi ve giriş cümlesidir.
const keysOf = (s: string): string[] => [...new Set((String(s || "").toLocaleLowerCase("tr").match(/[\p{L}\d]{4,}/gu) || []).map((w) => w.slice(0, 6)))];
const pickPassages = (text: string, keys: string[], budget: number): string => {
  const raw = String(text || "");
  let paras = raw.split(/\n+/).map((x) => x.replace(/\s+/g, " ").trim()).filter((x) => x.length > 60);
  if (paras.length < 4) { paras = []; const flat = raw.replace(/\s+/g, " "); for (let i = 0; i < flat.length; i += 600) paras.push(flat.slice(i, i + 600)); }
  const scored = paras.slice(0, 220).map((p, i) => {
    const low = p.toLocaleLowerCase("tr"); let sc = 0;
    for (const k of keys) if (low.includes(k)) sc += 2;
    if (/\d{2,}/.test(p)) sc += 1;                                           // rakam/tarih taşıyan paragraf sunuma malzeme olur
    if (p.length < 120) sc -= 1;
    return { p: p.slice(0, 900), i, sc };
  });
  const top = [...scored].sort((a, b) => b.sc - a.sc || a.i - b.i); const pick: typeof scored = []; let used = 0;
  for (const x of top) { if (used + x.p.length > budget) continue; pick.push(x); used += x.p.length; if (used > budget * 0.92) break; }
  return pick.sort((a, b) => a.i - b.i).map((x) => x.p).join("\n");
};

// ---------- rakam doğrulama: iddiadaki her anlamlı sayı kaynakta geçiyor mu ----------
const numTokens = (s: string): string[] => {
  const out: string[] = [];
  for (const m of String(s || "").matchAll(/\d+(?:[.,]\d+)*/g)) {
    const raw = m[0];
    const plain = raw.replace(/[.,]/g, "");
    // tek haneli tam sayılar (1., 3 adım...) iddia sayılmaz
    if (!/[.,]/.test(raw) && plain.length < 2) continue;
    out.push(raw);
  }
  return out;
};
const variants = (raw: string): string[] => {
  const v = new Set<string>();
  v.add(raw);
  v.add(raw.replace(/,/g, "."));
  v.add(raw.replace(/\./g, ","));
  v.add(raw.replace(/[.,]/g, ""));
  // 2.5 milyon / 2,5 / 2.50 gibi küçük farklar
  const f = Number(raw.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  if (!isNaN(f)) { v.add(String(f)); v.add(String(f).replace(".", ",")); }
  return [...v].filter(Boolean);
};
const buildNumIndex = (text: string): Set<string> => {
  const idx = new Set<string>();
  for (const m of String(text || "").matchAll(/\d+(?:[.,]\d+)*/g)) for (const x of variants(m[0])) idx.add(x);
  return idx;
};
const verified = (claim: string, idx: Set<string>): boolean => {
  const toks = numTokens(claim);
  if (!toks.length) return true;
  return toks.every((t) => variants(t).some((x) => idx.has(x)));
};

// akademik sunuma uymayan kaynaklar (video, sosyal medya, forum)
const BLOCK = ["youtube.com", "youtu.be", "facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com", "reddit.com", "quora.com", "pinterest.com", "linkedin.com", "eksisozluk.com", "uludagsozluk.com", "incisozluk.com.tr", "dailymotion.com", "vimeo.com", "scribd.com", "slideshare.net"];
const blocked = (h: string) => BLOCK.some((b) => h === b || h.endsWith("." + b));
// yayın yılı: Tavily tarih vermezse sayfanın başındaki tarihten ya da adresten bul
const AY = "ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const findYear = (text: string, url: string): string => {
  const now = new Date().getFullYear();
  const ok = (y: number) => y >= 1990 && y <= now;
  const head = String(text || "").slice(0, 4000);
  const pats = [
    /\b(?:published|updated|yayın(?:lanma)?(?: tarihi)?|güncelleme(?: tarihi)?|tarih)\s*[:\-]?\s*[^\n]{0,40}?\b((?:19|20)\d{2})\b/i,
    new RegExp(`\\b\\d{1,2}\\s+(?:${AY})\\.?\\s+((?:19|20)\\d{2})\\b`, "i"),
    new RegExp(`\\b(?:${AY})\\.?\\s+\\d{1,2},?\\s+((?:19|20)\\d{2})\\b`, "i"),
    /\b\d{1,2}[./]\d{1,2}[./]((?:19|20)\d{2})\b/,
    /\b((?:19|20)\d{2})-\d{2}-\d{2}\b/,
  ];
  for (const re of pats) { const m = head.match(re); if (m && ok(+m[1])) return m[1]; }
  const u = String(url || "").match(/[/_-]((?:19|20)\d{2})[/_-]/); if (u && ok(+u[1])) return u[1];
  return "";
};
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const yearOf = (d: string) => { const m = String(d || "").match(/(19|20)\d{2}/); return m ? m[0] : ""; };
const apa = (s: Src, lang: string, accessed: string) => {
  const site = s.site || hostOf(s.url);
  const y = yearOf(s.date) || (lang === "en" ? "n.d." : "t.y.");
  return lang === "en"
    ? `${site}. (${y}). ${s.title}. Retrieved ${accessed}, from ${s.url}`
    : `${site}. (${y}). ${s.title}. Erişim tarihi: ${accessed}. ${s.url}`;
};

/* Canlı deste (14.11.2026): notlar "Kaynak1 ve 3'e göre", "(Kaynak1,5)"
   diye yazılmıştı — bunlar yüksek sesle okunan cümleler, dinleyici için
   anlamsız. Model kurala uymazsa burada temizlenir. */
const cleanNote = (t: string) => String(t || "")
  .replace(/according to\s+sources?\s*\d+(?:\s*(?:,|and|&)\s*\d+)*\s*,?\s*/gi, "")
  .replace(/\(\s*(?:Kaynak(?:lar)?|Sources?)\s*\d+(?:\s*(?:,|ve|and|&)\s*\d+)*\s*\)/gi, "")
  .replace(/(?:Kaynak(?:lar)?|Sources?)\s*\d+(?:\s*(?:,|ve|and|&)\s*\d+)*\s*['’]?\s*(?:[a-zçğıöşü]{1,4}\s+göre|according to)?\s*,?/gi, "")
  .replace(/\[\s*\d+(?:\s*,\s*\d+)*\s*\]/g, "")
  .replace(/\s+([.,;:!?])/g, "$1").replace(/([.!?])\s*,/g, "$1").replace(/\s{2,}/g, " ").trim()
  .replace(/(^|[.!?]\s+)([a-zçğıöşü])/g, (_m, a, b) => a + b.toLocaleUpperCase("tr"));
async function groq(key: string, model: string, sys: string, user: string, maxTok: number) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model, temperature: 0.2, max_completion_tokens: maxTok, response_format: { type: "json_object" },
      reasoning_effort: "low", include_reasoning: false,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    }),
  });
  let d: any = null; try { d = await r.json(); } catch { d = null; }
  return { ok: r.ok, status: r.status, data: d };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const auth = req.headers.get("Authorization") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return J({ error: "Oturum gerekli" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "research");
    const lang = body?.language === "en" ? "en" : "tr";

    // ---------------- görseller: Unsplash (yoksa Pexels) ----------------
    if (action === "track") {
      // Unsplash kuralı: kullanılan fotoğrafın "indirme" sayacı tetiklenir
      const key = Deno.env.get("UNSPLASH_ACCESS_KEY");
      const url = String(body?.url || "");
      if (key && /^https:\/\/api\.unsplash\.com\/photos\/[\w-]+\/download/.test(url)) await fetch(url, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => null);
      return J({ ok: true });
    }
    if (action === "images") {
      const q = String(body?.query || "").slice(0, 100).trim();
      if (!q) return J({ error: "Arama boş" }, 400);
      const hasKey = !!(Deno.env.get("UNSPLASH_ACCESS_KEY") || Deno.env.get("PEXELS_API_KEY"));
      const u = await unsplashSearch(q, 12);
      let photos: Photo[] = u.photos;
      if (!photos.length) photos = await pexelsSearch(q, 12, lang);
      // Stok arşivler boş döndüyse ya da sınır dolduysa Wikimedia Commons:
      // anahtar istemez, bu yüzden "görsel ara" hiçbir zaman tamamen kapanmaz.
      if (!photos.length) photos = await commonsSearch(q, 12);
      if (!photos.length && u.rate) return J({ error: "Unsplash saatlik arama sınırı doldu", code: "rate" }, 429);
      if (!photos.length && !hasKey) return J({ error: "UNSPLASH_ACCESS_KEY tanımlı değil", code: "no_key" }, 503);
      return J({ photos });
    }

    // ---------------- asetatlara görsel: ipucu yoksa Acadia üretir ----------------
    if (action === "illustrate") {
      const items = (Array.isArray(body?.slides) ? body.slides : []).slice(0, 8).map((x: any) => ({
        i: Number(x?.i) || 0, title: String(x?.title || "").slice(0, 140), text: String(x?.text || "").slice(0, 320),
        q: String(x?.q || "").slice(0, 80).trim(), entity: String(x?.entity || "").slice(0, 80).trim(),
      }));
      if (!items.length) return J({ photos: [] });
      const topicI = String(body?.topic || "").slice(0, 160);
      const need = items.filter((x: any) => !x.q && !x.entity);
      const gk = Deno.env.get("GROQ_API_KEY");
      if (need.length && gk) {
        const sysI = `For each presentation slide, choose the image that would genuinely help the audience.
"q" = an ENGLISH stock-photo search query, 2-4 concrete visual words (objects, places, scenes — never abstract words like "concept", "importance", "development"; never the slide title translated word by word).
"entity" = the exact English Wikipedia article title IF the slide is mainly about one specific person, machine, product, building, place, organisation or historical event (e.g. "ENIAC", "Grace Hopper", "Hagia Sophia"); otherwise "".
The deck topic is given for context. Return ONLY JSON: {"r":[{"i":0,"q":"","entity":""}]}`;
        const gi = await groq(gk, "openai/gpt-oss-20b", sysI, JSON.stringify({ topic: topicI, slides: need.map((x: any) => ({ i: x.i, title: x.title, text: x.text })) }), 900);
        let ri: any = null; try { ri = JSON.parse(gi.data?.choices?.[0]?.message?.content || ""); } catch { ri = null; }
        if (gi.ok && ri && Array.isArray(ri.r)) for (const r of ri.r) { const it = items.find((x: any) => x.i === Number(r?.i)); if (it) { it.q = String(r?.q || "").slice(0, 80).trim(); it.entity = String(r?.entity || "").slice(0, 80).trim(); } }
      }
      // İpucu hiç üretilemediyse başlık + konu ile aranır: hiç görsel olmamasından iyidir.
      items.forEach((x: any) => { if (!x.q && !x.entity) x.q = (x.title + " " + topicI).slice(0, 80); });
      const res = await resolveImages(items.map((x: any) => ({ i: x.i, q: x.q, entity: x.entity })), lang);
      return J({ photos: res.photos, rate: res.rate });
    }

    /* ---------------- boş şeridi KAYNAKLA yaz ----------------
       Canlı deste (14.11.2026, Apollo 11): "giriş ekle" şeridini kaynaksız
       generate-slide-content yazdı ve "12.000 metre yürüdü", "0,24 kg örnek"
       uydurdu (doğrusu ~1 km ve 21,5 kg). Araştırmalı destede eklenen şerit de
       aynı kaynaklardan yazılır; kaynakta geçmeyen sayı taşıyan madde atılır. */
    if (action === "fill") {
      const gk = Deno.env.get("GROQ_API_KEY");
      const fs = (Array.isArray(body?.sources) ? body.sources : []).slice(0, 10).map((x: any) => ({ id: Number(x?.id) || 0, title: String(x?.title || "").slice(0, 160), text: String(x?.text || "").slice(0, 1400) })).filter((x: any) => x.id && x.text.length > 80);
      const st = String(body?.slideTitle || "").slice(0, 160).trim();
      if (!gk || !fs.length || !st) return J({ error: "kaynak yok", code: "no_sources" }, 422);
      const LF = lang === "en" ? "English" : "Turkish (Türkçe)";
      const sysF = `You write ONE presentation slide in ${LF}, using ONLY the numbered SOURCES given.
Every fact, number, date and name must come from the sources; if the sources lack something, leave it out. Never invent numbers. Translate faithfully, keep proper names and numbers unchanged, and label each number exactly as the source does.
Write 3-4 concise bullets (max ~14 words each) that fit the slide title. Do not repeat facts already listed under OTHER SLIDES.
"notes" = what the presenter says: 3-4 natural spoken sentences, 45-80 words, with no source numbers or labels in them.
Return ONLY JSON: {"bullets":[""],"notes":"","src":[1]}`;
      const userF = `DECK TOPIC: ${String(body?.topic || "").slice(0, 200)}\nSLIDE TITLE: ${st}\nOTHER SLIDES:\n${String(body?.context || "").slice(0, 1400)}\n\nSOURCES:\n` + fs.map((x: any) => `[${x.id}] ${x.title}\n${x.text}`).join("\n\n");
      let gf = await groq(gk, "openai/gpt-oss-120b", sysF, userF, 1500);
      if (!gf.ok) gf = await groq(gk, "openai/gpt-oss-20b", sysF, userF, 1500);
      let of: any = null; try { of = JSON.parse(gf.data?.choices?.[0]?.message?.content || ""); } catch { of = null; }
      if (!gf.ok || !of || !Array.isArray(of.bullets)) return J({ error: "Acadia şeridi yazamadı" }, 502);
      const idxF = buildNumIndex(fs.map((x: any) => x.text).join(" "));
      const bulletsF = of.bullets.map((x: any) => String(x || "").trim()).filter((b: string) => b.length > 2 && (!numTokens(b).length || verified(b, idxF))).slice(0, 4);
      const noteF = cleanNote(of.notes).split(/(?<=[.!?])\s+/).filter((t) => !numTokens(t).length || verified(t, idxF)).join(" ");
      return J({ bullets: bulletsF, notes: noteF, src: (Array.isArray(of.src) ? of.src : []).map(Number).filter((n: number) => fs.some((x: any) => x.id === n)) });
    }

    // ---------------- prova yorumu: söylenenler + notlar → asetat başına geri bildirim ----------------
    if (action === "coach") {
      const gk = Deno.env.get("GROQ_API_KEY");
      if (!gk) return J({ error: "GROQ_API_KEY tanımlı değil" }, 500);
      const items = (Array.isArray(body?.slides) ? body.slides : []).slice(0, 25).map((x: any, i: number) => ({
        n: i + 1, title: String(x?.title || "").slice(0, 120), slide: String(x?.text || "").slice(0, 600),
        notes: String(x?.notes || "").slice(0, 600), said: String(x?.said || "").slice(0, 1500), seconds: Math.round(Number(x?.seconds) || 0),
      }));
      if (!items.some((x: any) => x.said.trim().length > 8)) return J({ error: "Provada konuşma duyulmadı" }, 400);
      const LL = lang === "en" ? "English" : "Turkish (Türkçe)";
      const sysC = `You are a warm but honest presentation coach for a university Business Faculty student. Write in ${LL}.
For each slide you get: what is on the slide, the speaker notes, and the transcript of what the student actually SAID (speech-to-text, may contain recognition errors; ignore spelling).
For every slide where the student spoke, give: "good" = one specific thing done well (max 14 words); "tip" = one concrete improvement, ideally a better sentence the student could literally say (max 28 words); "issue" = only if something said is factually wrong, contradicts the slide/notes, or is confusing (else empty).
Then "overall" = 2 sentences: the biggest strength and the single most important thing to practise. Do not invent content that is not on the slide or notes, and keep every fact exactly as labelled on the slide (a measurement stays a measurement, not a forecast).
Return ONLY JSON: {"overall":"","slides":[{"n":1,"good":"","tip":"","issue":""}]}`;
      const g0 = await groq(gk, "openai/gpt-oss-120b", sysC, JSON.stringify(items), 3500);
      let c0: any = null; try { c0 = JSON.parse(g0.data?.choices?.[0]?.message?.content || ""); } catch { c0 = null; }
      if (!g0.ok || !c0) return J({ error: "Acadia yorum yazamadı", status: g0.status }, 502);
      return J({ overall: String(c0.overall || ""), slides: (Array.isArray(c0.slides) ? c0.slides : []).map((x: any) => ({ n: Number(x?.n) || 0, good: String(x?.good || ""), tip: String(x?.tip || ""), issue: String(x?.issue || "") })) });
    }

    // ---------------- araştırma ----------------
    const tKey = Deno.env.get("TAVILY_API_KEY");
    const gKey = Deno.env.get("GROQ_API_KEY");
    const docText = String(body?.sourceText || "").slice(0, 24000).trim();
    if (!gKey) return J({ error: "GROQ_API_KEY tanımlı değil" }, 500);
    const topic = String(body?.topic || "").slice(0, 160).trim();
    if (topic.length < 2) return J({ error: "Konu boş" }, 400);
    const n = Math.max(3, Math.min(14, Number(body?.slideCount) || 7));
    const tone = String(body?.tone || "academic");
    const STORY: Record<string, string> = {
      problem: "Story arc PROBLEM → SOLUTION → RESULT: open with the problem and why it matters, then causes, then the solution(s), then evidence/results, end with the takeaway.",
      scqa: "Story arc SCQA: Situation (context everyone agrees on) → Complication (what changed / the tension) → Question (the key question this raises) → Answer (the answer, supported by evidence).",
      compare: "Story arc COMPARISON: introduce the two (or more) options, compare them criterion by criterion (use a table or two-column slide), then give a verdict on when each fits.",
      chrono: "Story arc CHRONOLOGICAL: past → turning points → present situation → outlook; keep dates in order and use a timeline slide.",
    };
    const story = STORY[String(body?.story || "")] || "Story arc: introduction (why it matters) → body → conclusion with key takeaways.";

    let srcs: Src[] = [];
    let queries: string[] = [topic]; let topicEn = "", wikiT = "", wikiE = "";
    const engine = { queries: 1, web: 0, wiki: 0 };
    if (docText) {
      const dt = String(body?.sourceTitle || topic).slice(0, 200);
      srcs = [{ id: 1, title: dt, url: "", site: "", date: "", text: docText, snippet: docText.slice(0, 1400) }];
    } else {
      // 1) Konuyu arama sorgularına aç. Tek sorgu (konu cümlesinin kendisi)
      //    dar ve tek dilli sonuç veriyordu; küçük model hızlıdır, düşerse
      //    yalnız konu aranır.
      const sysQ = `You plan web research for a university presentation. Given a TOPIC, return ONLY JSON:
{"queries":["q1","q2","q3"],"en":"topic in English, max 7 words","wiki":"best matching Wikipedia article title in the topic's own language","wiki_en":"best matching English Wikipedia article title"}
q1 = the topic as a precise search query in its own language; q2 = a query for concrete data, statistics, dates or a timeline about the topic (same language); q3 = the topic as an English search query. No quotes, no site: operators.`;
      const gq = await groq(gKey, "openai/gpt-oss-20b", sysQ, `TOPIC: ${topic}`, 300);
      try { const pq = JSON.parse(gq.data?.choices?.[0]?.message?.content || ""); const qs = (Array.isArray(pq?.queries) ? pq.queries : []).map((x: any) => String(x || "").slice(0, 160).trim()).filter((x: string) => x.length > 3); if (gq.ok && qs.length) queries = [...new Set([topic, ...qs.slice(-2)])].slice(0, 3);   /* konu + veri sorgusu + İngilizce sorgu; q1 konunun kendisiyle aynı işi görür */ topicEn = String(pq?.en || "").slice(0, 80).trim(); wikiT = String(pq?.wiki || "").slice(0, 80).trim(); wikiE = String(pq?.wiki_en || "").slice(0, 80).trim(); } catch { /* yalnız konu aranır */ }
      engine.queries = queries.length;

      // 2) Tavily (varsa) ve Wikipedia paralel. İlk sorgu derin, ötekiler hızlı.
      const tavily = async (q: string, deep: boolean): Promise<any[]> => {
        if (!tKey) return [];
        const r = await tfetch("https://api.tavily.com/search", { method: "POST", headers: { "Authorization": `Bearer ${tKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, search_depth: deep ? "advanced" : "basic", max_results: deep ? 8 : 5, include_raw_content: true, include_answer: false, ...(deep ? { chunks_per_source: 3 } : {}), exclude_domains: BLOCK }) }, 20000);
        if (!r || !r.ok) { console.error("tavily", r?.status, q.slice(0, 60)); return []; }
        const j: any = await r.json().catch(() => null); return Array.isArray(j?.results) ? j.results : [];
      };
      const [tv, wTr, wEn] = await Promise.all([
        Promise.all(queries.map((q, i) => tavily(q, i === 0))),
        wikiPages(lang === "en" ? "en" : "tr", wikiT || topic, 1),
        lang === "en" ? Promise.resolve([] as Wiki[]) : wikiPages("en", wikiE || topicEn || topic, 1),
      ]);
      // Wikipedia araması her zaman BİR sayfa döndürür, alakasız da olsa
      // (canlı deneme: "Yazılımın tarihsel gelişimi" → "Diyalektik ve Tarihsel
      // Materyalizm"). Sayfa, konunun ya da İngilizce karşılığının ayırt edici
      // sözcüklerinin hepsini taşımıyorsa kaynak yapılmaz.
      const stems = (t: string) => [...new Set((t.toLocaleLowerCase("tr").match(/[\p{L}\d]{4,}/gu) || []).map((w) => w.slice(0, Math.max(5, w.length - 2))))];
      const onTopic = (w: Wiki) => { const low = (w.title + " " + w.text).toLocaleLowerCase("tr"); return [topic, topicEn].filter(Boolean).some((t) => { const k = stems(t); return k.length > 0 && k.every((x) => low.includes(x)); }); };
      // 3) Birleştir: aynı adres bir kez, alan adı başına en çok 2, puana göre sırala.
      const seen = new Set<string>(); const perHost: Record<string, number> = {};
      const web = tv.flat().filter((r: any) => r?.url && (r.content || r.raw_content) && !blocked(hostOf(r.url)))
        .sort((a: any, b: any) => (Number(b.score) || 0) - (Number(a.score) || 0))
        .filter((r: any) => { const u0 = String(r.url).split("#")[0]; const h = hostOf(u0); if (seen.has(u0) || (perHost[h] || 0) >= 2 || /wikipedia\.org$/.test(h)) return false; seen.add(u0); perHost[h] = (perHost[h] || 0) + 1; return true; })
        .slice(0, 7);
      engine.web = web.length;
      srcs = web.map((r: any, i: number) => ({
        id: i + 1, title: String(r.title || hostOf(r.url)).replace(/\s+[|–-]\s+[^|–-]{2,40}$/, "").slice(0, 200), url: r.url, site: hostOf(r.url), date: String(r.published_date || "") || findYear(String(r.raw_content || r.content || ""), r.url),
        text: String(r.raw_content || r.content || "").slice(0, 20000), snippet: String(r.content || "").slice(0, 1400),
      }));
      for (const w of [...wTr, ...wEn].filter(onTopic)) { srcs.push({ id: srcs.length + 1, title: w.title, url: w.url, site: `${w.lang}.wikipedia.org`, date: w.date, text: w.text, snippet: w.text.slice(0, 1400) }); engine.wiki++; }
      if (!srcs.length && !tKey) return J({ error: "TAVILY_API_KEY tanımlı değil", code: "no_key" }, 503);
      if (srcs.length < 2) return J({ error: "Bu konuda yeterli kaynak bulunamadı", code: "few_sources" }, 422);
    }

    const L = lang === "en" ? "English" : "Turkish (Türkçe)";
    const sys = `You build a factual university presentation in ${L} for a Business Faculty student, using ONLY the numbered SOURCES given.
Rules:
- Every fact, number, date and name must come from the sources. If the sources do not contain something, leave it out. Never invent numbers.
- Label every number exactly as the source does: a measured/realised value is not a forecast, a target is not a result, an estimate is not an official figure. Name who reported it (e.g. "TÜİK ölçümü", "ENAG hesaplaması", "TCMB tahmini").
- Sources may be in another language; translate faithfully into ${L}, keep proper names and numbers unchanged.
- Write ${n - 2} content slides (cover and closing are added separately). Tone: ${tone}.
- ${story} Slide titles should make this arc visible. Every title is a specific claim or topic (never generic like "Giriş", "Introduction", "Genel Bakış"), unique, max 9 words.
- COVERAGE: before writing, plan the deck so that it tells the whole story, as far as the sources allow: (1) what it is and the context/background, (2) the key people, organisations or actors by name, (3) how it happened or how it works — the chronology or mechanism, (4) the key numbers, (5) the results, impact or legacy. A deck that is only a list of numbers is a failure: at most 2 slides may be "stat" or "chart". Draw on at least 3 different sources when that many are given.
- Every "list" slide has 3-4 bullets; never write a slide with a single bullet. Use "stat" only when you have exactly 3 numbers; a lone number belongs inside a bullet of another slide.
- For "quote", "time" and "two" slides the content goes in "bullets" (quote: bullets[0] is the sentence).
- The FIRST content slide hooks the audience: why this topic matters, with one concrete fact from the sources. The LAST content slide is the conclusion: kind "list" with exactly 3 takeaway bullets. Every slide must have real content — never leave bullets empty.
- For each slide pick the layout that fits the content:
  "stat": exactly 3 key numbers from the sources (value + short label);
  "chart": a numeric series of 3-8 points that appears in the sources (labels + numeric values, same unit);
  "time": 3-4 chronological steps or dates; "two": a comparison of two sides (heads = the two side names);
  "table": a small comparison table (max 5 rows, max 4 columns); "quote": one striking sentence or definition. Attribute it to a person ONLY if that exact sentence appears word for word in the sources as that person's words; otherwise write it as a plain statement with no quotation marks and no name. Never invent or paraphrase a quotation;
  "list": 3-4 concise bullet points (max ~14 words each).
  Use at least 3 different layouts across the deck; never more than 2 "list" slides in a row; at most half of the slides may be "list".
- "src" = the source ids used on that slide.
- "notes" = what the presenter SAYS: 3-4 natural spoken sentences, 45-80 words. Explain the slide, add one detail or example from the sources that is NOT written on the slide, and end with a one-sentence bridge to the next slide. Never just repeat the bullets. Notes are spoken aloud: never mention source numbers or labels in them (no "Source 1", "Kaynak 2", "[3]"); name the institution or author instead if the origin matters. Fewer than 45 words is a failure.
- "image" = a picture that would genuinely help this slide, or empty strings if the slide is a chart/table/stat. "q": ENGLISH stock-photo query, 2-4 concrete visual words (objects, places, scenes; no abstract words). "entity": the exact English Wikipedia article title if the slide is mainly about one specific person, machine, product, building, place, organisation or event (e.g. "ENIAC", "Grace Hopper"); otherwise "".
- "cover_image" = same shape, for the cover slide of the whole deck.
Return ONLY JSON: {"title":"short deck title","cover_image":{"q":"","entity":""},"slides":[{"title":"","kind":"list|two|time|stat|chart|quote|table","bullets":[""],"heads":["",""],"stats":[{"value":"","label":""}],"chart":{"type":"bar|line|pie","labels":[""],"values":[0],"unit":""},"table":{"headers":[""],"rows":[[""]]},"notes":"","image":{"q":"","entity":""},"src":[1]}]}`;
    // Kaynak bütçesi: toplam ~18 bin karakter, kaynak başına en çok 3 bin.
    // Paragraflar konu + sorgu sözcükleriyle puanlanıp seçilir.
    const keys = keysOf([topic, topicEn, ...queries].join(" "));
    const srcBlock = (total: number) => {
      const per = Math.min(3000, Math.floor(total / Math.max(1, srcs.length)));
      return docText ? `[1] ${srcs[0].title}\n${docText.slice(0, Math.min(14000, total))}`
        : srcs.map((s) => `[${s.id}] ${s.title} (${s.site}${s.date ? ", " + s.date.slice(0, 10) : ""})\n${pickPassages(s.text, keys, per) || s.snippet}`).join("\n\n");
    };
    const user = `TOPIC: ${topic}\n\nSOURCES:\n` + srcBlock(18000);

    let g = await groq(gKey, "openai/gpt-oss-120b", sys, user, 7000);
    // Yedek: küçük model + yarı bütçe. Büyük model meşgulken ya da istek
    // dakikalık token sınırına takıldığında aynı isteği yinelemek işe yaramaz.
    if (!g.ok) { console.warn("groq 120b", g.status, JSON.stringify(g.data).slice(0, 300)); g = await groq(gKey, "openai/gpt-oss-20b", sys, `TOPIC: ${topic}\n\nSOURCES:\n` + srcBlock(9000), 6000); }
    if (!g.ok) return J({ error: "Acadia sunumu yazamadı", status: g.status }, 502);
    let out: any = null;
    try { out = JSON.parse(g.data?.choices?.[0]?.message?.content || ""); } catch { out = null; }
    if (!out || !Array.isArray(out.slides) || !out.slides.length) return J({ error: "Acadia yanıtı okunamadı" }, 502);
    const imgOf = (x: any) => ({ q: String(x?.q || "").slice(0, 80).trim(), entity: String(x?.entity || "").slice(0, 80).trim() });

    // ---------- doğrulama: sunucuda, kaynak metniyle ----------
    const allIdx = buildNumIndex(srcs.map((s) => s.text + " " + s.snippet).join(" "));
    const idxOf = (ids: number[]) => {
      const pick = srcs.filter((s) => ids.includes(s.id));
      return pick.length ? buildNumIndex(pick.map((s) => s.text + " " + s.snippet).join(" ")) : allIdx;
    };
    let checked = 0, unverified = 0;
    /* Aynı destede bir özet cümlesi tırnak içinde Margaret Hamilton'a
       atfedilmişti. Söz kaynak metninde harfi harfine geçmiyorsa kişiye
       atfedilmez: tırnak ve ad düşer, cümle düz ifade olarak kalır. */
    const flat = (t: string) => t.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const srcFlat = flat(srcs.map((s) => s.text + " " + s.snippet).join(" "));
    const safeQuote = (b: string) => {
      const m = b.match(/^\s*["“”«']+(.+?)["“”»']+\s*[–—-]\s*.+$/s);
      if (!m) return b;
      const q = flat(m[1]);
      return q.length > 12 && srcFlat.includes(q) ? b : m[1].trim();
    };
    const slides = out.slides.slice(0, n).map((s: any) => {
      const ids = (Array.isArray(s.src) ? s.src : []).map((x: any) => Number(x)).filter((x: number) => srcs.some((y) => y.id === x));
      const idx = idxOf(ids);
      const kind = KINDS.includes(s.kind) ? s.kind : "list";
      const bullets = (Array.isArray(s.bullets) ? s.bullets : []).map((x: any) => String(x || "").trim()).filter(Boolean).slice(0, 6);
      if (kind === "quote" && !bullets.length) { const qt = String(s.quote || s.text || "").trim(); if (qt) bullets.push(qt); }
      if (kind === "quote" && bullets.length) bullets[0] = safeQuote(bullets[0]);
      const warn: number[] = [];
      bullets.forEach((b: string, i: number) => { if (numTokens(b).length) { checked++; if (!verified(b, idx) && !verified(b, allIdx)) { warn.push(i); unverified++; } } });
      let stats = (Array.isArray(s.stats) ? s.stats : []).map((x: any) => ({ value: String(x?.value || "").trim(), label: String(x?.label || "").trim() })).filter((x: any) => x.value);
      stats = stats.map((x: any) => { checked++; const ok = verified(x.value, idx) || verified(x.value, allIdx); if (!ok) unverified++; return { ...x, ok }; });
      let chart = s.chart && Array.isArray(s.chart.values) ? s.chart : null;
      let chartOk = true;
      if (chart) {
        const vals = chart.values.map((v: any) => Number(String(v).replace(",", "."))).filter((v: number) => !isNaN(v));
        const miss = vals.filter((v: number) => !verified(String(v), allIdx)).length;
        checked += vals.length;
        chartOk = vals.length >= 2 && miss <= Math.floor(vals.length / 4);
        if (!chartOk) unverified += miss;
        chart = { type: chart.type || "bar", labels: (chart.labels || []).map(String).slice(0, vals.length), values: vals, unit: String(chart.unit || "") };
      }
      const table = s.table && Array.isArray(s.table.rows) ? { headers: (s.table.headers || []).map(String).slice(0, 4), rows: s.table.rows.slice(0, 5).map((r: any) => (Array.isArray(r) ? r : []).map(String).slice(0, 4)) } : null;
      let k = kind;
      if (k === "chart" && (!chart || !chartOk)) k = "list";
      if (k === "stat" && stats.filter((x: any) => x.ok).length < 3) k = "list";
      if (k === "table" && (!table || !table.rows.length)) k = "list";
      if (k === "list" && kind === "stat" && !bullets.length) stats.forEach((x: any) => { if (!x.ok) warn.push(bullets.length); bullets.push(`${x.value} — ${x.label}`); });
      return { title: String(s.title || "").trim(), kind: k, bullets, warn, heads: Array.isArray(s.heads) ? s.heads.slice(0, 2).map(String) : [], stats: stats.filter((x: any) => x.ok).slice(0, 3), chart: k === "chart" ? chart : null, table: k === "table" ? table : null, notes: cleanNote(s.notes), image: imgOf(s.image), src: ids };
    });

    // İçeriği olmayan asetat (madde, sayı, grafik, tablo — hiçbiri yok) kurguya
    // girmez: istemci onu "ana fikri yaz…" yer tutucusuyla basıyordu.
    /* Düşen asetatın öncesindeki not son cümlesinde ona köprü kurar ("şimdi
       Armstrong'ın ünlü sözüne bakalım" — o asetat destede yoktu, 14.11.2026);
       asetat düşünce o cümle de düşer. */
    const sentences = (t: string) => String(t || "").split(/(?<=[.!?])\s+/).filter(Boolean);
    const dropAt = (i: number) => { slides.splice(i, 1); const p: any = slides[i - 1]; if (p) { const ns = sentences(p.notes); if (ns.length >= 3) p.notes = ns.slice(0, -1).join(" "); } };
    for (let i = slides.length - 1; i >= 0; i--) { const x: any = slides[i]; if (!x.title || (!x.bullets.length && !x.stats.length && !x.chart && !x.table)) dropAt(i); }
    /* Tek maddelik liste asetat değildir (aynı destede "650 milyon — izleyici"
       tek başına bir asetattı: 3 sayısı olmayan "stat" listeye inince böyle
       kalıyor). Madde komşu listeye taşınır, asetat düşer. */
    const plain = (x: any) => x && x.kind === "list" && !x.chart && !x.table;
    for (let i = slides.length - 2; i >= 0; i--) {
      const x: any = slides[i]; if (!plain(x) || x.bullets.length !== 1) continue;
      const t: any = [slides[i - 1], slides[i + 1]].find((y: any) => plain(y) && y.bullets.length < 4); if (!t) continue;
      if (x.warn.length) { t.warn.push(t.bullets.length); }
      t.bullets.push(x.bullets[0]); t.src = [...new Set([...t.src, ...x.src])];
      dropAt(i);
    }
    if (!slides.length) return J({ error: "Acadia yanıtı okunamadı" }, 502);

    // ---------- anlam doğrulaması: her iddia kaynağın ilgili paragrafıyla karşılaştırılır ----------
    const ctxFor = (ids: number[], claim: string) => {
      const pool = srcs.filter((x) => !ids.length || ids.includes(x.id));
      const keys = (claim.match(/\d+(?:[.,]\d+)*|[\p{L}]{6,}/gu) || []).slice(0, 6);
      const parts: string[] = [];
      for (const s0 of pool) {
        const low = s0.text.toLocaleLowerCase("tr");
        for (const k of keys) { const at = low.indexOf(k.toLocaleLowerCase("tr")); if (at >= 0) { parts.push(`[${s0.id}] …${s0.text.slice(Math.max(0, at - 260), at + 260)}…`); break; } }
      }
      return (parts.length ? parts : pool.slice(0, 2).map((x) => `[${x.id}] ${x.snippet.slice(0, 500)}`)).join("\n").slice(0, 1100);
    };
    const claims: { k: string; si: number; bi: number; text: string; ctx: string }[] = [];
    slides.forEach((s: any, si: number) => {
      s.bullets.forEach((b: string, bi: number) => { if (b.length > 12) claims.push({ k: `${si}.b${bi}`, si, bi, text: b, ctx: ctxFor(s.src, b) }); });
      s.stats.forEach((x: any, bi: number) => claims.push({ k: `${si}.s${bi}`, si, bi, text: `${x.value} — ${x.label}`, ctx: ctxFor(s.src, x.value + " " + x.label) }));
    });
    /* Grafik değerleri ve notlardaki sayılı cümleler de denetlenir (14.11.2026):
       sayı kaynakta geçtiği için geçerli sayılıyordu ama anlamı kaymıştı —
       "21,5 saat" yüzeyde kalış süresiyken not "21,5 saat yürüdüler" diyordu,
       grafik de 2,5 saatlik yürüyüşü "iniş hazırlığı" diye etiketlemişti. */
    slides.forEach((s: any, si: number) => {
      if (s.chart) s.chart.values.forEach((v: number, bi: number) => { const t = `${s.title} — ${s.chart.labels[bi] || ""}: ${v} ${s.chart.unit}`.trim(); claims.push({ k: `${si}.c${bi}`, si, bi, text: t, ctx: ctxFor(s.src, t) }); });
      s._ns = sentences(s.notes);
      s._ns.forEach((t: string, bi: number) => { if (numTokens(t).length) claims.push({ k: `${si}.n${bi}`, si, bi, text: t, ctx: ctxFor(s.src, t) }); });
    });
    const meaning = { checked: 0, flagged: 0, fixed: 0 };
    if (claims.length && body?.meaningCheck !== false) {
      const LL = lang === "en" ? "English" : "Turkish (Türkçe)";
      const sysV = `You are a strict fact checker. For each CLAIM, read its SOURCE EXCERPTS and decide:
"ok" = the excerpts support the claim as worded; "mislabel" = the number/fact is in the source but the claim labels it wrongly (e.g. a measured value called a forecast, wrong year, wrong institution, wrong unit); "unsupported" = the excerpts do not support it or contradict it.
For "mislabel" give "fix": the corrected claim in ${LL}, same length and style, keeping the number. For others "fix" is "". "why" = max 10 words in ${LL}.
Be lenient on paraphrase and rounding; be strict on meaning. Return ONLY JSON: {"r":[{"k":"","v":"ok|mislabel|unsupported","fix":"","why":""}]}`;
      const payload = claims.slice(0, 60).map((c) => ({ k: c.k, claim: c.text, source: c.ctx }));
      // ayrı model: aynı dakikada ana yazımla aynı token sınırına takılmasın
      let gv = await groq(gKey, "openai/gpt-oss-20b", sysV, JSON.stringify(payload), 6000);
      if (!gv.ok) { await new Promise((r) => setTimeout(r, 1500)); gv = await groq(gKey, "openai/gpt-oss-120b", sysV, JSON.stringify(payload), 6000); }
      let rv: any = null; try { rv = JSON.parse(gv.data?.choices?.[0]?.message?.content || ""); } catch { rv = null; }
      if (gv.ok && rv && Array.isArray(rv.r)) {
        meaning.checked = payload.length;
        for (const r of rv.r) {
          const c = claims.find((x) => x.k === r?.k); if (!c) continue;
          const s: any = slides[c.si]; const why = String(r?.why || "").slice(0, 90); const fix = String(r?.fix || "").trim();
          const tur = c.k.split(".")[1][0];
          if (tur === "n") {   // not cümlesi: düzeltilebiliyorsa düzelt, yoksa söyletme
            if (r.v === "mislabel" && fix && numTokens(fix).every((t) => numTokens(c.text).includes(t))) { s._ns[c.bi] = fix; meaning.fixed++; }
            else if (r.v === "unsupported" || r.v === "mislabel") { s._ns[c.bi] = ""; meaning.flagged++; }
            continue;
          }
          if (tur === "c") { if (r.v === "unsupported" || r.v === "mislabel") { (s._cw = s._cw || {})[c.bi] = why || "kaynakla tam örtüşmüyor"; meaning.flagged++; } continue; }
          if (r.v === "mislabel" && fix && numTokens(fix).every((t) => numTokens(c.text).includes(t))) {
            meaning.fixed++;
            if (c.k.includes(".s")) { const parts = fix.split(/\s+[—–-]\s+/); if (parts.length > 1) s.stats[c.bi].label = parts.slice(1).join(" — "); }
            else s.bullets[c.bi] = fix;
            (s.fixed = s.fixed || []).push({ kind: c.k.includes(".s") ? "stat" : "bullet", i: c.bi, was: c.text, why });
          } else if (r.v === "unsupported" || r.v === "mislabel") {
            meaning.flagged++;
            if (c.k.includes(".b")) { if (!s.warn.includes(c.bi)) s.warn.push(c.bi); (s.why = s.why || {})[c.bi] = why || "kaynakta bu anlamda geçmiyor"; }
            else s.stats[c.bi].weak = why || "kaynakla tam örtüşmüyor";
          }
        }
        slides.forEach((s: any) => { const weak = s.stats.filter((x: any) => x.weak); if (s.kind === "stat" && weak.length) { s.kind = "list"; s.stats.forEach((x: any) => { const i = s.bullets.length; s.bullets.push(`${x.value} — ${x.label}`); if (x.weak) { s.warn.push(i); (s.why = s.why || {})[i] = x.weak; } }); s.stats = []; } });
      } else console.warn("meaning check", gv.status);
    }
    slides.forEach((s: any) => {
      if (s._ns) { const nt = s._ns.filter(Boolean).join(" "); if (nt) s.notes = nt; delete s._ns; }
      // Etiketi kaynakla örtüşmeyen grafik çizilmez: değerler uyarılı maddeye iner.
      if (s._cw && s.chart) { s.chart.values.forEach((v: number, i: number) => { const bi = s.bullets.length; s.bullets.push(`${s.chart.labels[i] || ""}: ${v} ${s.chart.unit}`.trim()); if (s._cw[i]) { s.warn.push(bi); (s.why = s.why || {})[bi] = s._cw[i]; } }); s.chart = null; s.kind = "list"; }
      delete s._cw;
    });

    const accessed = new Date().toLocaleDateString(lang === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", year: "numeric" });
    const used = new Set<number>(); slides.forEach((s: any) => s.src.forEach((x: number) => used.add(x)));
    const sources = srcs.filter((s) => used.has(s.id) || !used.size).map((s) => ({ id: s.id, title: s.title, url: s.url, site: s.site, date: s.date, apa: apa(s, lang, accessed), ctx: s.snippet.slice(0, 1200) }));
    return J({ title: String(out.title || topic).trim(), cover_image: imgOf(out.cover_image), slides, sources: docText ? [] : sources, check: { checked, unverified, meaning }, engine });
  } catch (e) {
    console.error("sunum-research", e);
    return J({ error: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
