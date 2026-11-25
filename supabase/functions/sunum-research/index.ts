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
/* Commons'un Artist alanı şablonla gelir: etiketler atılınca "Unknown author Unknown author"
   kalıyordu (canlı deste 25.11.2026). Yinelenen yarı tek, "bilinmiyor" boş sayılır. */
/* Tarih konusunun sorgusuna bu yıl eklenmez: istem kuralına rağmen "History Of Guns"
   için "history of firearms 2026" arandı (25.11.2026). Konu kendisi yıl taşımıyorsa
   ve tarih/gelişim/köken bildiriyorsa yıl sorgudan atılır. */
const TARIH = /\b(?:history|historical|evolution|origins?|chronolog\w*|ancient|medieval)\b|tarih(?:i|çe|çesi|sel)?\b|gelişim|köken|kronoloj/i;
const tarihSorgu = (topic: string, q: string): string => TARIH.test(topic) && !/\b(?:19|20)\d{2}\b/.test(topic) ? q.replace(new RegExp("\\s*\\b" + new Date().getFullYear() + "\\b", "g"), "").trim() || q : q;
const artistOf = (h: string): string => {
  let a = stripTags(h); const w = a.split(" "), n = w.length;
  if (n > 1 && n % 2 === 0 && w.slice(0, n / 2).join(" ") === w.slice(n / 2).join(" ")) a = w.slice(0, n / 2).join(" ");
  return /^(?:unknown(?: author| artist)?|author unknown|anonymous|bilinmiyor)$/i.test(a) ? "" : a.slice(0, 60);
};

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
      thumb: ii.thumburl || ii.url, large: ii.thumburl || ii.url, photographer: artistOf(meta.Artist?.value || ""), page: ii.descriptionurl || "",
      source: "Wikimedia Commons", source_url: "https://commons.wikimedia.org", license: stripTags(meta.LicenseShortName?.value || "") });
  }
  return out;
}
// Wikipedia maddesinin kendi görseli: yalnız ÖZGÜR lisanslı (pilicense=free) —
// adil kullanım (logo, afiş, kapak) görselleri sunuma taşınmaz.
const wikiNotPhoto = (file: string, src: string): boolean => /\.svg/i.test(file + " " + src) || NOT_PHOTO.test(file.replace(/_/g, " "));
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
    // Ülke/kurum maddelerinin baş görseli çoğu kez bayrak, arma ya da haritadır (SVG): fotoğraf değil, kapakta kırpılıp biçimsiz durur.
    if (wikiNotPhoto(String(pg.pageimage || ""), String(th.source))) continue;
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
  const memo = new Map<string, Photo[]>();   // aynı sorgunun ikinci fotoğrafı yeni arama harcamaz
  /* Sorguyla ortak sözcüğü olan fotoğraf öne alınır: "person holding red pen while
     writing on book" aramasından "woman putting on nail polish" fotoğrafı ders
     çalışma destesine kondu (canlı deste 14.11.2026). Uyan yoksa fotoğraf ALINMAZ:
     "Coinage Takes Hold in Ancient Greece" asetatına ilk sonuç diye kahve kupası
     geldi (25.11.2026); sıradaki arşive (Pexels, Commons) geçilir. */
  const take = (list: Photo[], q = "") => { const qk = gorselKok(q);
    const ok = list.filter((x) => x && x.large && !used.has(x.large)); const p = qk.length ? ok.find((x) => gorselUyar(qk, x.alt)) || null : ok[0] || null; if (p) used.add(p.large); return p; };
  // Wikipedia aramaları paralel; stok aramaları sırayla (sınır sayacı ve tekrar denetimi için).
  const wiki = await Promise.all(hints.map((h) => h.entity ? wikiImage(h.entity) : Promise.resolve(null)));
  const photos: (Photo & { i: number })[] = [];
  for (let k = 0; k < hints.length; k++) {
    const h = hints[k]; let p: Photo | null = wiki[k] ? take([wiki[k] as Photo]) : null;
    const q = (h.q || h.entity || "").slice(0, 80).trim();
    if (!p && q && memo.has(q)) p = take(memo.get(q) || [], q);
    if (!p && q && !memo.has(q) && !rate && uCalls < UNSPLASH_MAX) { uCalls++; const u = await unsplashSearch(q, 6); if (u.rate) rate = true; memo.set(q, u.photos); p = take(u.photos, q); }
    if (!p && q) p = take(await pexelsSearch(q, 6, lang), q);
    if (!p && q) p = take(await commonsSearch(h.entity || q, 8));
    if (p) photos.push({ ...p, i: h.i });
  }
  return { photos, rate };
}

// ---------- kaynak metninden konuya en yakın paragraflar ----------
// Modele kaynağın BAŞI değil, konuyla örtüşen yerleri gider: sayfanın ilk 900
// karakteri çoğu sitede menü, çerez bildirimi ve giriş cümlesidir.
/* Fotoğraf açıklamasıyla sorgu karşılaştırması: "coin" ile "coins" aynı köktür (önek),
   "close", "photo", "with" gibi her açıklamada geçen sözcükler sayılmaz. */
const GORSEL_BOS = /^(?:with|from|close|photo|image|pictur|view|shot|backgr|detail|showin|over|into|that|this|their|while|scene|concep)$/;
const gorselKok = (q: string): string[] => keysOf(q).filter((k) => !GORSEL_BOS.test(k));
const gorselUyar = (qk: string[], alt: string): boolean => { const ak = gorselKok(alt); return qk.some((k) => ak.some((a) => a.startsWith(k) || k.startsWith(a))); };
const keysOf = (s: string): string[] => [...new Set((String(s || "").toLocaleLowerCase("tr").match(/[\p{L}\d]{4,}/gu) || []).map((w) => w.slice(0, 6)))];
// Konunun alt başlıkları ("altın", "mevduat faizi"…) bir metinde geçiyor mu: sözcük başından kök eşleşmesi.
// Kaynak seçiminde ve destenin konuyu yanıtlayıp yanıtlamadığını ölçmekte kullanılır.
const aspHit = (aspects: string[], text: string): number => {
  const flat = " " + String(text || "").toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]+/gu, " ");
  return aspects.filter((a) => { const w = (a.toLocaleLowerCase("tr").match(/[\p{L}\p{N}]{3,}/gu) || []).map((x) => x.length <= 5 ? (x.length >= 4 ? x.replace(/[aeıioöuü]$/, "") : x) : x.slice(0, Math.max(5, x.length - 2)));   /* "faizi" → "faiz", "fonu" → "fon"; "altın" olduğu gibi */ return w.length > 0 && w.every((x) => flat.includes(" " + x)); }).length;
};
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

/* Aynı ajans haberinin kopyaları ayrı kaynak değildir: canlı destede
   (yenilenebilir enerji, 14.11.2026) beş kaynağın dördü aynı AA haberiydi;
   deste iki rakamı (442,2 TWh, 21,5 milyar $) beş asetatta tekrarladı.
   Ölçü: metnin başındaki ayırt edici sayılar (yıl ve tek-iki haneli tam sayı
   hariç) büyük oranda aynıysa aynı haberdir. */
/* Ondalıklı sayı kısa da olsa ayırt edicidir: "%5,7 güneş" ve "%3,4 jeotermal"
   sayı asetatından sonra iki maddelik ayrı bir asetat olarak yinelendi
   (canlı deste 14.11.2026) — "57" iki hane diye sayılmıyordu. */
/* İki haneli yüzde de ayırt edici sayıdır: "History of Money" destesinde (25.11.2026)
   "%80 nakit" dört asetatta yinelendi; "80" iki hane olduğu için hiç sayılmıyordu. */
const pctOf = (t: string): Set<string> => new Set((String(t || "").match(/%\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?%/g) || []).map((m) => m.replace(/[%\s.,]/g, "")));
const sigNums = (t: string): string[] => { const pc = pctOf(t); return [...new Set(numTokens(t).filter((x) => !/^(1[5-9]|20)\d{2}$/.test(x)).filter((x) => /[.,]/.test(x) || x.length >= 3 || pc.has(x.replace(/[.,]/g, ""))).map((x) => x.replace(/[.,]/g, "")))]; };
const flatChart = (vals: number[]): boolean => vals.length >= 2 && new Set(vals).size === 1;
const sameStory = (a: string, b: string): boolean => {
  const x = sigNums(String(a || "").slice(0, 3000)), y = new Set(sigNums(String(b || "").slice(0, 3000)));
  if (x.length < 3 || y.size < 3) return false;
  const ortak = x.filter((v) => y.has(v)).length;
  return ortak / Math.min(x.length, y.size) >= 0.6;
};
/* Aynı rakam ikinci kez madde olarak yazılmaz (son asetat özet olduğu için
   hariç). Dönen: maddesi atılan asetat sayısı. */
const dropRepeats = (slides: any[]): number => {
  const seen = new Set<string>(); let n = 0;
  slides.forEach((s: any, si: number) => {
    if (s.kind === "list" && si < slides.length - 1) {
      const keep: string[] = [], warn: number[] = [];
      s.bullets.forEach((b: string, i: number) => { const t = sigNums(b); if (t.length && t.every((v) => seen.has(v))) return; if (s.warn.includes(i)) warn.push(keep.length); keep.push(b); });
      if (keep.length < s.bullets.length) { s.bullets = keep; s.warn = warn; n++; }
    }
    [...s.bullets, ...s.stats.map((x: any) => x.value), ...(s.table ? s.table.rows.flat() : [])].forEach((b: string) => sigNums(b).forEach((v) => seen.add(v)));
  });
  return n;
};
/* Aynı FİKİR ikinci kez madde olmaz: canlı destede (14.11.2026, zaman
   yönetimi) "araç seçimi: dijital ya da fiziksel planlayıcı" üç ayrı asetatta,
   Eisenhower/Pareto tanımı iki asetatta yinelendi — sayı taşımadıkları için
   dropRepeats görmüyordu. Ölçü: sözcük köklerinin en az %60'ı önceki bir
   maddede geçiyorsa (en az 4 kök) yinelemedir. Son asetat özettir, hariç. */
const dropEchoes = (slides: any[]): number => {
  const seen: string[][] = []; let n = 0;
  const echo = (ks: string[]) => ks.length >= 4 && seen.some((p) => { const o = ks.filter((w) => p.includes(w)).length; return o / Math.min(ks.length, p.length) >= 0.6; });
  slides.forEach((s: any, si: number) => {
    const add: string[][] = [];
    if (s.kind === "list" && si > 0 && si < slides.length - 1) {
      const keep: string[] = [], warn: number[] = [];
      s.bullets.forEach((b: string, i: number) => { const ks = keysOf(b); if (echo(ks)) return; add.push(ks); if (s.warn.includes(i)) warn.push(keep.length); keep.push(b); });
      if (keep.length < s.bullets.length) { s.bullets = keep; s.warn = warn; n++; }
    } else s.bullets.forEach((b: string) => add.push(keysOf(b)));
    add.forEach((ks) => { if (ks.length >= 4) seen.push(ks); });
  });
  return n;
};
/* "Alıntı" bir cümledir. Canlı destede kurum adlarının listesi tırnak içinde
   alıntı diye basıldı ("SHURA … – …, …, … ortaklığı"). */
const isSentence = (t: string) => /[.!?…]["”»']?\s*$/.test(String(t || "").trim());
/* Yıl etiketli çıplak sayılar madde değil seridir: "2000: 27.3 GW · 2023:
   110.9 GW · 2024-Kasım: 115 GW" fotoğraflı madde listesi olarak basıldı
   (aynı deste). Hepsi "yıl: sayı birim" ise ve birim aynıysa çizgi grafiği olur. */
const seriesOf = (bullets: string[]): { labels: string[]; values: number[]; unit: string } | null => {
  if (!Array.isArray(bullets) || bullets.length < 3 || bullets.length > 8) return null;
  const rows = bullets.map((b) => String(b).trim().match(/^(.{2,24}?)\s*(?::|\s[–—-])\s*(%)?\s*(\d+(?:[.,]\d+)*)\s*(%|[\p{L}$€₺/²³]{1,12}(?:\s[\p{L}]{1,8})?)?\.?$/u));
  if (!rows.every((m) => m && /\b(?:19|20)\d{2}\b/.test(m[1]))) return null;
  const num = (x: string) => Number(/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(x) ? x.replace(/\./g, "").replace(",", ".") : x.replace(",", "."));
  const labels = rows.map((m) => m![1].trim()), values = rows.map((m) => num(m![3])), units = rows.map((m) => String(m![2] || m![4] || "").toLocaleLowerCase("tr"));
  if (values.some((v) => isNaN(v)) || new Set(units).size !== 1 || new Set(labels).size !== labels.length) return null;
  return { labels, values, unit: String(rows[0]![2] || rows[0]![4] || "") };
};
/* Zaman çizelgesinde her adımın kendi tarihi olur: "2023 · 2035 · 2035" diye
   aynı tarih iki durakta basıldı (aynı deste). Yinelenen tarih varsa liste. */
/* "two": maddeler kendi tarafına dizilir. İstemci listeyi ortadan böler; canlı
   destede (14.11.2026) "2023: …" ve "2026: …" maddelerinin ikisi de sol kolona
   ("2023") düştü, sağda ("2026") yalnız "Fark: …" kaldı. Dizilemiyorsa dokunmaz. */
const sidesOf = (bullets: string[], heads: string[], warn: number[]): { bullets: string[]; warn: number[] } => {
  const low = (t: string) => String(t || "").toLocaleLowerCase("tr").trim();
  const h = heads.slice(0, 2).map(low); const n = bullets.length, target = Math.ceil(n / 2);
  if (h.length < 2 || !h[0] || !h[1] || n < 2) return { bullets, warn };
  const side = bullets.map((b) => { const m = String(b).match(/^([^:]{2,32}):\s/); const p = m ? low(m[1]) : ""; return !p ? -1 : h[0].startsWith(p) ? 0 : h[1].startsWith(p) ? 1 : -1; });
  const ix = (k: number) => side.map((v, i) => v === k ? i : -1).filter((i) => i >= 0);
  const Lx = ix(0), Rx = ix(1), Ox = ix(-1);
  if (!Lx.length || !Rx.length || Lx.length > target || Rx.length > n - target) return { bullets, warn };
  const order = [...Lx, ...Ox.slice(0, target - Lx.length), ...Rx, ...Ox.slice(target - Lx.length)];
  return { bullets: order.map((i) => bullets[i]), warn: warn.map((w) => order.indexOf(w)).filter((w) => w >= 0) };
};
const timeOk = (bullets: string[]): boolean => {
  const l = (bullets || []).map((b) => { const m = String(b).match(/^(.{2,34}?)\s*(?::|\s[–—-])\s+/); return (m && /\d/.test(m[1]) ? m[1] : (String(b).match(/\b(?:1[5-9]|20)\d{2}\b/) || [""])[0]).toLocaleLowerCase("tr").trim(); }).filter(Boolean);
  return new Set(l).size === l.length;
};
/* Türkçe destede ondalık ayırıcı virgüldür ("27.3 GW" değil "27,3 GW").
   Tarih (14.11.2026) ve binlik (1.250) dokunulmaz kalır. */
/* Yazım (canlı deste 14.11.2026): model kesilmez tire (U+2011) yazıyor, istemcinin
   sayı ayrıştırıcısı "%1‑2"yi "%1" diye bölüyordu; "2016-01-01" asetatta tarih
   gibi okunmuyor; Türkçede yüzde işareti öndedir ("10%" değil "%10"). */
const AYLAR: Record<string, string[]> = { tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"], en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] };
const yazim = (t: string, lang: string): string => {
  const ay = AYLAR[lang === "en" ? "en" : "tr"];
  const x = String(t || "").replace(/[\u2010\u2011]/g, "-").replace(/\b((?:19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g, (_m, y, m, d) => `${+d} ${ay[+m - 1]} ${y}`);
  return lang === "en" ? x : trDec(x).replace(/(?<![\d%.,-])(\d+(?:,\d+)?(?:\s?[-–]\s?\d+(?:,\d+)?)?)\s?%(?!\s?\d)/g, "%$1");
};
const trDec = (t: string) => String(t || "").replace(/(?<![\d.,])(\d+)\.(\d{1,2})(?!\d|\.\d)/g, "$1,$2");

// akademik sunuma uymayan kaynaklar (video, sosyal medya, forum)
const BLOCK = ["youtube.com", "youtu.be", "facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com", "reddit.com", "quora.com", "pinterest.com", "linkedin.com", "eksisozluk.com", "uludagsozluk.com", "incisozluk.com.tr", "dailymotion.com", "vimeo.com", "scribd.com", "slideshare.net"];
// Kurumsal kaynak öne alınır: canlı destede (Apollo 11, 14.11.2026) dört
// kaynaktan biri siyasi bir haber sitesiydi ve ilk adımın saatini yanlış
// veriyordu (01:56; doğrusu 02:56 UTC). Engellemek yerine sıralamada geri
// düşer: yeterince kurumsal kaynak varsa listeye hiç girmez.
const TRUSTED = /(\.edu(\.[a-z]{2})?|\.gov(\.[a-z]{2})?|\.ac\.[a-z]{2}|\.int|\.k12\.tr)$|(^|\.)(nasa\.gov|esa\.int|si\.edu|britannica\.com|tuik\.gov\.tr|tcmb\.gov\.tr|oecd\.org|worldbank\.org|imf\.org|un\.org|who\.int|europa\.eu|nature\.com|sciencedirect\.com|springer\.com|jstor\.org|dergipark\.org\.tr|tubitak\.gov\.tr|history\.com|nationalgeographic\.com|bbc\.com|bbc\.co\.uk|reuters\.com|aa\.com\.tr|trthaber\.com)$/i;
const trust = (h: string) => (TRUSTED.test(h) ? 0.25 : 0);
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
  /* Adresteki yıl aralığı yayın yılı değildir: ".../turkiye-2015-2025-te-..."
     kaynakçaya "(2015)" diye geçti (canlı deste, 14.11.2026). */
  const u = String(url || "").match(/(?<!(?:19|20)\d{2})[/_-]((?:19|20)\d{2})[/_-](?!(?:19|20)\d{2})/); if (u && ok(+u[1])) return u[1];
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
  // "Bu söz, bilimup.com'da tam olarak bu ifadeyle yer alıyor": site adı anan cümle söylenmez.
  .split(/(?<=[.!?])\s+/).filter((c) => !/\b[a-z0-9-]+\.(?:com|org|net|edu|gov|info|co)(?:\.[a-z]{2})?\b/i.test(c)).join(" ")
  .replace(/\s+([.,;:!?])/g, "$1").replace(/([.!?])\s*,/g, "$1").replace(/\s{2,}/g, " ").trim()
  .replace(/(^|[.!?]\s+)([a-zçğıöşü])/g, (_m, a, b) => a + b.toLocaleUpperCase("tr"));
// Asetat metninde "(Kaynak 2, 8)" kalmaz: canlı destede (Apollo 11, 14.11.2026)
// zaman çizelgesi maddeleri hem bunu hem gerçek atfı "[1, 2, 4]" taşıyordu.
const ABSOLUTE = /(?:^|\s)en (?:hızlı|büyük|küçük|uzun|kısa|yüksek|düşük|önemli|eski|yeni|iyi|kötü|pahalı|ucuz)|\bilk kez\b|\btarihte(?:ki)?\b|\bkanıtla|\bkesin(?:likle)?\b|\brekor|\bthe (?:first|fastest|largest|biggest|smallest|longest|highest|lowest|most|only)\b|\bproved?\b|\brecord\b|\bnever\b|\balways\b/i;
const mixedUnits = (labels: string[]) => new Set((labels || []).map((l) => (String(l).match(/\(([^)]+)\)\s*$/) || [])[1]).filter(Boolean).map((u) => String(u).toLocaleLowerCase("tr").trim())).size > 1;
// "(src1)", "(src2, src4)", "[src 3]": model kaynak alanının adını metne de yazdı
// (canlı deste 14.11.2026, zaman yönetimi — madde, alıntı ve kolon metinlerinde).
/* Madde sonundaki yazar-tarih atıfı atılır: "(Bank of England, 2018)", "(Wikipedia,
   25 November 2026)" — istem yasaklıyor ama "History of Money" destesinde (25.11.2026)
   dört maddede kaldı; "[n]" atfıyla birlikte iki ayrı atıf biçimi basılıyordu. */
const dropDated = (b: string): string => String(b || "").replace(/\s*\((?:[^()]{2,80}),\s*(?:\d{1,2}\s+\p{L}+\s+)?(?:1[5-9]|20)\d{2}[a-z]?\)(?=[.!?;]?\s*$|[.!?;]\s)/gu, "").trim();
const cleanCite = (t: string) => String(t || "").replace(/\s*\(\s*(?:Kaynak(?:lar)?|Sources?)\s*\d+(?:\s*(?:,|ve|and|&)\s*\d+)*\s*\)/gi, "").replace(/\s*[(\[]\s*src\s*\d+(?:\s*(?:,|;|ve|and|&)\s*(?:src\s*)?\d+)*\s*[)\]]/gi, "").trim();
/* Üç "sayı" aynı ölçünün üç değeri değilse sayı asetatı olmaz. Aynı destede
   Pomodoro'nun 25 ve 5 dakikası "Sabah: dakika · Öğle: dakika · Akşam: dakika"
   etiketleriyle günlük rutin diye basıldı: etiket "ad: birim" biçimindeyse
   (2) uydurma bir dizidir ve maddeye de çevrilmez; yalnız değer yineliyorsa
   (1) listeye iner. */
const statOdd = (st: { value: string; label: string }[]): number => st.some((x) => /^[^:]{1,24}:\s*\S{1,12}$/.test(String(x.label || "").trim())) ? 2 : new Set(st.map((x) => String(x.value || "").replace(/\s+/g, ""))).size < st.length ? 1 : 0;
/* Not, asetatın SON hâline uyar: grafik listeye indiyse "bu grafikte" diyen
   cümle, tablo yoksa "tabloda" diyen cümle düşer; "Udemy kaynağı…", "Kuveyt
   Türk blogu…" diye site adı anan cümle söylenmez (en az iki cümle kalıyorsa);
   Türkçe notta "slide" sözcüğü "slayt" olur. */
const noteFit = (s: any, lang: string): string => {
  const c = String(s.notes || "").split(/(?<=[.!?])\s+/).filter(Boolean);
  let k = c.filter((x) => !((!s.chart && /\bgrafi[kğ]|\bcharts?\b|\bgraphs?\b/i.test(x)) || (!s.table && /\btablo(?:da|ya|su|yu|daki)?\b|\btable\b/i.test(x))));
  const adsiz = k.filter((x) => !/\bkaynağ[ıi]|\bblogu|\bweb\s+sitesi|\b(?:the|this)\s+[\w-]+\s+(?:source|blog|website)\b/i.test(x));
  if (adsiz.length >= 2) k = adsiz;
  let t = (k.length ? k : c).join(" ");
  if (lang !== "en") t = t.replace(/\bslide(?:['’](\p{L}+))?(?!\p{L})/giu, (m: string, e?: string) => (/^S/.test(m) ? "Slayt" : "slayt") + String(e || "").toLocaleLowerCase("tr").replace(/^y/, "").replace(/^d/, "t").replace(/e/g, "a").replace(/i/g, "ı"));
  return t;
};
/* Aynı cümle her notun sonuna eklenmez: "Etkili ders çalışma" destesinde
   (14.11.2026) üç not "…zaman yönetimi ve aktif öğrenme teknikleriyle
   desteklenmelidir" dolgusuyla bitti. Cümlenin köklerinin en az %70'i önceki
   bir asetatın not cümlesinde geçiyorsa (en az 4 kök) atılır; notta en az iki
   cümle kalır. */
const noteEchoes = (slides: any[]): number => {
  const seen: string[][] = []; let n = 0;
  slides.forEach((s: any) => {
    const c = String(s.notes || "").split(/(?<=[.!?])\s+/).filter(Boolean), ks = c.map(keysOf);
    const dup = ks.map((k) => k.length >= 4 && seen.some((p) => k.filter((w) => p.includes(w)).length / k.length >= 0.7));
    let keep = c.filter((_, i) => !dup[i]);
    if (keep.length < 2) keep = c; else if (keep.length < c.length) { s.notes = keep.join(" "); n++; }
    ks.forEach((k) => { if (k.length >= 4) seen.push(k); });
  });
  return n;
};
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
      /* "iki: 1" isteyen asetata aynı sorgudan İKİNCİ fotoğraf da döner (üst üste
         iki fotoğraf düzeni); ikisi de aynı "i" ile gelir, istemci gruplayıp dizer. */
      const cift = new Set((Array.isArray(body?.slides) ? body.slides : []).filter((x: any) => x?.iki).map((x: any) => Number(x?.i) || 0));
      const hints: Hint[] = []; items.forEach((x: any) => { hints.push({ i: x.i, q: x.q, entity: x.entity }); if (cift.has(x.i) && x.q) hints.push({ i: x.i, q: x.q, entity: "" }); });
      const res = await resolveImages(hints, lang);
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

    /* ---------------- konuşmacı notu: asetatın KENDİ içeriğinden ----------------
       Belge/kart yolundan basılan destede not istemcideki şablondan geliyordu:
       "“X” konusunu anlatıyorum. İlk olarak … Son olarak …" (canlı deste
       14.11.2026, kanın fizyolojik özellikleri — 18 asetatın 18'i). Kaynak
       araması yok; not yalnız asetatta yazanı açar. Asetatta geçmeyen sayı
       taşıyan cümle atılır, iki cümlenin altına düşen not hiç dönmez (istemci
       şablonu korur). */
    if (action === "notes") {
      const gk = Deno.env.get("GROQ_API_KEY");
      const ns = (Array.isArray(body?.slides) ? body.slides : []).slice(0, 12).map((x: any) => ({ i: Number(x?.i) || 0, kind: String(x?.kind || "list").slice(0, 12), title: String(x?.title || "").slice(0, 160), text: String(x?.text || "").slice(0, 700) })).filter((x: any) => x.title || x.text);
      if (!gk || !ns.length) return J({ notes: [] });
      const LN = lang === "en" ? "English" : "Turkish (Türkçe)";
      const sysN = `You write speaker notes in ${LN} for presentation slides. For each slide you get its kind, title and the text shown on it.
"n" = what the presenter SAYS: 3-4 natural spoken sentences, 45-80 words. Explain the idea behind the slide and how its items relate; do not read the bullets back one by one and do not list table row names.
Use ONLY what the slide shows: never add a number, date, name or fact that is not in its text. kind "table": say what the comparison shows. kind "math": say in plain words what the formula relates, no symbols or LaTeX. kind "mmd": tell the flow as a story. kind "chart": say what stands out.
Never start with "This slide", "Bu slaytta", "… konusunu anlatıyorum" or with the title in quotes; do not open two notes the same way; no "First / Next / Finally" scaffolding; do not end notes with a sentence about moving to the next slide. No markdown.
Return ONLY JSON: {"r":[{"i":0,"n":""}]}`;
      const userN = JSON.stringify({ topic: String(body?.topic || "").slice(0, 200), slides: ns });
      let gn = await groq(gk, "openai/gpt-oss-120b", sysN, userN, 3600);
      if (!gn.ok) gn = await groq(gk, "openai/gpt-oss-20b", sysN, userN, 3600);
      let on: any = null; try { on = JSON.parse(gn.data?.choices?.[0]?.message?.content || ""); } catch { on = null; }
      if (!gn.ok || !on || !Array.isArray(on.r)) return J({ error: "Acadia notları yazamadı" }, 502);
      const outN = ns.map((x: any) => {
        const r = on.r.find((y: any) => Number(y?.i) === x.i), idxN = buildNumIndex(x.title + " " + x.text);
        const notes = cleanNote(String(r?.n || "")).split(/(?<=[.!?])\s+/).filter((t) => !numTokens(t).length || verified(t, idxN)).join(" ");
        return { i: x.i, notes: noteFit({ notes, chart: x.kind === "chart", table: x.kind === "table" }, lang) };
      });
      noteEchoes(outN);
      return J({ notes: outN.filter((x: any) => x.notes.split(/(?<=[.!?])\s+/).length >= 2 && x.notes.split(/\s+/).length >= 20) });
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
    let queries: string[] = [topic]; let topicEn = "", wikiT = "", wikiE = "", ask = ""; let aspects: string[] = [];
    const engine = { queries: 1, web: 0, wiki: 0 };
    if (docText) {
      const dt = String(body?.sourceTitle || topic).slice(0, 200);
      srcs = [{ id: 1, title: dt, url: "", site: "", date: "", text: docText, snippet: docText.slice(0, 1400) }];
    } else {
      // 1) Konuyu arama sorgularına aç. Tek sorgu (konu cümlesinin kendisi)
      //    dar ve tek dilli sonuç veriyordu; küçük model hızlıdır, düşerse
      //    yalnız konu aranır.
      const sysQ = `You plan web research for a university presentation. Given a TOPIC, return ONLY JSON:
{"queries":["q1","q2","q3"],"en":"topic in English, max 7 words","wiki":"best matching Wikipedia article title in the topic's own language","wiki_en":"best matching English Wikipedia article title","ask":"the one question the audience expects this talk to answer, in the topic's language","aspects":["a1","a2","a3","a4","a5"],"aq":"one search query in the topic's language that names those aspects together"}
"aspects" = the 4-6 concrete sub-topics a good talk on exactly this topic is built from, each 1-3 words in the topic's language, named specifically (for "ways to protect savings from inflation": the instruments themselves, e.g. gold, deposit interest, foreign currency, funds, stocks, real estate — NOT "inflation data" or "government policy"; for a history topic: the key people, inventions and periods by name). They are what the audience came to hear, never background.
q1 = the topic as a precise search query in its own language; q2 = a query for concrete data, statistics, dates or a timeline about what the topic asks for — for a how/ways topic that means data comparing those ways (their returns, costs, results), not general data about the underlying problem (same language); q3 = the topic as an English search query. If the topic asks HOW, or for ways, methods, strategies, solutions or advice, q1 and q3 must search for those ways themselves (the concrete instruments, options and their evidence), not for background data about the problem. No quotes, no site: operators.
Today is ${new Date().toISOString().slice(0, 10)}. If the topic is an ongoing situation (economy, policy, markets, technology, a living person or organisation), q2 must ask for the latest data and include the current year; a history topic is not ongoing and gets no year.
The deck is written in ${lang === "en" ? "English" : "Turkish"}: "the topic's language" above means ${lang === "en" ? "English" : "Turkish"}, whatever the topic looks like — q1, q2, ask, aspects and aq are in that language.`;
      const gq = await groq(gKey, "openai/gpt-oss-20b", sysQ, `TOPIC: ${topic}`, 600);
      try { const pq = JSON.parse(gq.data?.choices?.[0]?.message?.content || ""); const qs = (Array.isArray(pq?.queries) ? pq.queries : []).map((x: any) => String(x || "").slice(0, 160).trim()).filter((x: string) => x.length > 3); aspects = (Array.isArray(pq?.aspects) ? pq.aspects : []).map((x: any) => String(x || "").slice(0, 40).trim()).filter((x: string) => x.length > 2).slice(0, 6); ask = String(pq?.ask || "").slice(0, 200).trim(); const aq = String(pq?.aq || "").slice(0, 160).trim();
        /* konu + alt başlık sorgusu + veri sorgusu + İngilizce sorgu; q1 konunun kendisiyle aynı işi görür.
           Alt başlık sorgusu olmadan "…yolları" konusu yalnız sorunun verisini (enflasyon rakamları) buluyordu. */
        if (gq.ok && qs.length) queries = [...new Set([topic, ...(aq.length > 3 ? [aq] : []), ...qs.slice(-2)].map((q) => tarihSorgu(topic, q)))].slice(0, 4); topicEn = String(pq?.en || "").slice(0, 80).trim(); wikiT = String(pq?.wiki || "").slice(0, 80).trim(); wikiE = String(pq?.wiki_en || "").slice(0, 80).trim(); } catch { /* yalnız konu aranır */ }
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
      const seen = new Set<string>(); const perHost: Record<string, number> = {}; let untrusted = 0;
      const web = tv.flat().filter((r: any) => r?.url && (r.content || r.raw_content) && !blocked(hostOf(r.url)))
        .map((r: any) => ({ ...r, _asp: aspHit(aspects, String(r.title || "") + " " + String(r.raw_content || r.content || "").slice(0, 12000)) }))
        // alt başlıkları taşıyan kaynak öne geçer: kurumsal ama konuyu yanıtlamayan sayfa (yalnız veri) tek başına deste kurmasın
        .sort((a: any, b: any) => (Number(b.score) || 0) + trust(hostOf(b.url)) + 0.12 * b._asp - (Number(a.score) || 0) - trust(hostOf(a.url)) - 0.12 * a._asp)
        .filter((r: any) => { const u0 = String(r.url).split("#")[0]; const h = hostOf(u0); if (seen.has(u0) || (perHost[h] || 0) >= 2 || /wikipedia\.org$/.test(h)) return false; seen.add(u0); perHost[h] = (perHost[h] || 0) + 1; return true; })
        // En az 3 kurumsal kaynak varsa ötekilerden en çok 2 alınır.
        .filter((r: any, _i: number, all: any[]) => { if (trust(hostOf(r.url)) || r._asp >= 2 || all.filter((x) => trust(hostOf(x.url))).length < 3) return true; return ++untrusted <= 2; })
        .filter((r: any, i: number, all: any[]) => !all.slice(0, i).some((x) => sameStory(String(x.raw_content || x.content), String(r.raw_content || r.content))))
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
- ANSWER THE TOPIC AS PHRASED: if the topic asks how, or for ways, methods, strategies or solutions, most body slides present those ways one by one (what it is, evidence from the sources, limits) — background data about the problem takes at most two slides. If the sources do not cover such ways, say so on the critical slide instead of filling the deck with background.
- Never start a bullet with "Kaynak", "Kaynaklar", "Source(s)" or a website name, and never write a domain name (example.com) inside a bullet: state the fact itself; the numbered "src" field already carries the attribution. A year in front of a bullet is only for an event that happened in that year, never the publication year of the source.
- The user message may give AUDIENCE EXPECTS and ASPECTS. They are the plan of the talk: the body is organised around the aspects, and each aspect the sources cover gets its own slide (or at least its own bullet) saying what it is, the evidence the sources give for it, and its limit or risk. They are NOT facts: say nothing about an aspect that the sources do not say, and leave out an aspect the sources do not cover (name the uncovered ones on the critical slide). Slides about background that the audience did not ask for (general data on the problem, what the government or central bank does when the topic asks what a person can do) take at most two slides.
- Never put a source name in parentheses inside a bullet ("(NPR)", "(TCMB)") — sources are cited through "src" only. Never compute a number yourself (difference, ratio, total, average): every figure appears in a source exactly as written.
- ACADEMIC DEPTH: this is a university seminar, not a fact sheet. As far as the sources allow, the deck contains (a) one slide that defines the key concepts and the scope, (b) at least one analysis slide that explains WHY — causes, mechanisms, drivers, (c) one comparison (kind "two" or "table") of periods, countries, methods or viewpoints, and (d) one critical slide: limitations, risks, open debates, or points where the sources disagree. That slide is about the subject itself (its costs, risks, disputed interpretations, unresolved questions); it never lists what the sources fail to provide ("data not provided in the sources"). The conclusion states implications ("what follows from this"), not a recap of numbers.
- A bullet is an analytical statement, not a label: 12-22 words (max 150 characters) that give a claim together with its cause, mechanism, comparison or consequence, written as a full sentence. Never write a bare number with a two-word label as a bullet ("%5,7 güneş" is a failure). On analysis, concept and critical slides start each bullet with a 2-4 word key term and a colon ("Şebeke esnekliği: ...").
- Every "list" slide has 3-4 bullets; never write a slide with a single bullet. Use "stat" only when you have exactly 3 numbers; a lone number belongs inside a bullet of another slide.
- For "quote", "time" and "two" slides the content goes in "bullets" (quote: bullets[0] is the sentence).
- The FIRST content slide hooks the audience: why this topic matters, with one concrete fact from the sources. The LAST content slide is the conclusion: kind "list" with exactly 3 takeaway bullets. Every slide must have real content — never leave bullets empty.
- For each slide pick the layout that fits the content:
  "stat": exactly 3 key numbers from the sources (value + short label);
  "chart": put 2-3 short insights (max 120 characters each: what the chart shows, from the sources) in "bullets"; one quantity in ONE unit across comparable categories or over time (never mix miles, km and seconds in one chart) — a numeric series of 3-8 points that the sources state point by point (labels + numeric values, same unit). Never split a total into parts the sources do not give, and never invent a per-day or per-year breakdown;
  "time": 3-4 chronological steps, EACH starting with its own date or period (the year alone unless the source itself states the month or day — never invent a day or month) — statements without a date belong in a "list"; "two": a comparison of exactly two sides (heads = the two side names; 2-3 bullets per side, first all bullets of side one, then all of side two; "n1" = how many bullets belong to side one — every bullet stays on its own side) — three or more people, items or groups go in a "list" or "table", never in "two";
  "table": a small comparison table (max 5 rows, max 4 columns). For comparing 2-3 items on several criteria write a feature matrix: headers = ["Criterion", item1, item2(, item3)], one row per criterion (speed, cost, risk, adoption…), cells short ratings from the sources — "High"/"Medium"/"Low", "Yes"/"No", "✓"/"✕" — or at most 6 words; "quote": one striking sentence or definition. Attribute it to a person ONLY if that exact sentence appears word for word in the sources as that person's words; otherwise write it as a plain statement with no quotation marks and no name. Never invent or paraphrase a quotation;
  "list": 3-4 analytical bullets as described above. A list of years with bare values is a "chart", not a "list".
  Use at least 4 different layouts across the deck when the sources allow (a "two" or "table" comparison, a "time" chronology, a "stat" or "chart" with real numbers); never two "list" slides in a row unless the content is truly a list; at most half of the slides may be "list". Never invent a number, date or rating to fill a layout.
- When sources disagree on a number, date or time, follow the institutional source (space agency, statistics office, museum, university, encyclopedia) over news or opinion sites, and give a clock time only together with the time zone the source itself states — never invent or translate a time-zone abbreviation; if the source gives none, give the date without the clock time.
- Today is ${new Date().toISOString().slice(0, 10)}. Say which period every number refers to; if the newest data in the sources is more than a year old, the conclusion slide says up to which date the deck is current. Never present old data as the present situation.
- Do not write academic citations such as "(Yılmaz et al., 2023)" inside bullets or labels; attribution is carried by "src". Naming the reporting institution ("TCMB raporu") is fine.
- Titles and headings are fully in ${L}; translate foreign terms (e.g. "unorthodox policy" = "alışılmadık politika").
- Do not repeat the same fact, advice or definition on two slides: each slide adds something new, and a method explained once (e.g. the Eisenhower matrix) is not explained again. The closing summary slide states conclusions in new words; it does not quote again a figure already shown on an earlier slide (\"18-20 °C\"). Notes never end with the same linking sentence on several slides. "stat" needs three values of comparable quantities with meaningful labels — never reuse one number under different labels, never use a label that is just a category and a unit ("Sabah: dakika"). "stat" values are quantities (amounts, percentages, durations), never calendar dates — dates belong on a "time" slide.
- A "quote" slide's title says who said it and when; the title is never the quotation itself.
- No superlatives or absolute claims ("the fastest", "the first", "proved", "en hızlı", "kanıtladı") unless a source states exactly that — this applies to notes too.
- Use the established ${L} term for technical vocabulary (e.g. breccia = "breş"); if unsure, keep the original term in parentheses.
- "src" = the source ids used on that slide. Source ids go ONLY in "src": never write "(Kaynak 2)", "(Source 2)" or "(src2)" inside titles, bullets, labels or notes.
- "notes" = what the presenter SAYS: 3-4 natural spoken sentences, 45-80 words. Explain the slide, add one detail or example from the sources that is NOT written on the slide, and end with a one-sentence bridge to the next slide. Never just repeat the bullets. Notes are spoken aloud: never mention source numbers or labels in them (no "Source 1", "Kaynak 2", "[3]"); name the institution or author instead if the origin matters, and never say "X kaynağı", "X blogu" or a website's name. In Turkish say "slayt", never "slide". Notes describe the slide as it is: do not mention a chart or table the slide does not have. Fewer than 45 words is a failure.
- "image" = a picture that would genuinely help this slide, or empty strings if the slide is a chart/table/stat. "q": ENGLISH stock-photo query, 3-6 concrete visual words naming a physical object, place or scene that a camera can photograph, with its period or material ("ancient greek silver coin museum", not "ancient greece" or "economy"); no abstract words. "entity": the exact English Wikipedia article title if the slide is mainly about one specific person, machine, product, building, place, organisation or event (e.g. "ENIAC", "Grace Hopper"); otherwise "".
- "cover_image" = same shape, for the cover slide of the whole deck.
Return ONLY JSON: {"title":"short deck title","cover_image":{"q":"","entity":""},"slides":[{"title":"","kind":"list|two|time|stat|chart|quote|table","bullets":[""],"heads":["",""],"n1":0,"stats":[{"value":"","label":""}],"chart":{"type":"bar|line|pie","labels":[""],"values":[0],"unit":""},"table":{"headers":[""],"rows":[[""]]},"notes":"","image":{"q":"","entity":""},"src":[1]}]}`;
    // Kaynak bütçesi: toplam ~18 bin karakter, kaynak başına en çok 3 bin.
    // Paragraflar konu + sorgu sözcükleriyle puanlanıp seçilir.
    const keys = keysOf([topic, topicEn, ...queries, ...aspects].join(" "));
    const plan = (ask ? `\nAUDIENCE EXPECTS: ${ask}` : "") + (aspects.length ? `\nASPECTS: ${aspects.join("; ")}` : "");
    const srcBlock = (total: number) => {
      const per = Math.min(3000, Math.floor(total / Math.max(1, srcs.length)));
      return docText ? `[1] ${srcs[0].title}\n${docText.slice(0, Math.min(14000, total))}`
        : srcs.map((s) => `[${s.id}] ${s.title} (${s.site}${s.date ? ", " + s.date.slice(0, 10) : ""})\n${pickPassages(s.text, keys, per) || s.snippet}`).join("\n\n");
    };
    /* TOKEN BÜTÇESİ (canlı log, 14.11.2026): Groq ücretsiz katmanda model başına
       dakikada 8000 token. 18 bin karakterlik kaynak bloğu 8282 token tuttu, büyük
       model 413 verdi ve deste küçük modelle yazıldı. Blok 13 bine indi; yine 413
       gelirse büyük model 9 binle bir kez daha denenir, küçük modele ondan sonra
       inilir. */
    const user = `TOPIC: ${topic}${plan}\n\nSOURCES:\n` + srcBlock(13000);

    let g = await groq(gKey, "openai/gpt-oss-120b", sys, user, 7000);
    if (!g.ok && g.status === 413) g = await groq(gKey, "openai/gpt-oss-120b", sys, `TOPIC: ${topic}${plan}\n\nSOURCES:\n` + srcBlock(9000), 7000);
    // Yedek: küçük model + yarı bütçe. Büyük model meşgulken ya da istek
    // dakikalık token sınırına takıldığında aynı isteği yinelemek işe yaramaz.
    if (!g.ok) { console.warn("groq 120b", g.status, JSON.stringify(g.data).slice(0, 300)); g = await groq(gKey, "openai/gpt-oss-20b", sys, `TOPIC: ${topic}${plan}\n\nSOURCES:\n` + srcBlock(9000), 6000); }
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
    /* Madde sonundaki kaynak adı ("… (SBB).", "(NPR)", "(Devlet)", "(SCIENTIFIC)")
       atılır: atıf zaten "[n]" ile basılıyor, model adı çoğu kez de yanlış koyuyor
       (canlı deste 14.11.2026). Yalnız kaynak listesindeki bir site/başlık sözcüğü
       ya da genel etiket silinir; "(TÜFE)" gibi kısaltma açıklaması kalır. */
    const srcWords = " " + flat(srcs.map((x) => `${x.site} ${x.title}`).join(" ")) + " ", srcGlue = srcWords.replace(/ /g, "");
    const dropAttr = (b: string) => b.replace(/\s*\(([^()\d]{2,30})\)(?=[.!?]?\s*$)/, (m, a) => { const f = flat(a); return /^(wikipedia|vikipedi|scientific|devlet|kaynak|source|web)$/.test(f) || (f.length >= 3 && (srcWords.includes(` ${f} `) || srcGlue.includes(f.replace(/ /g, "")))) ? "" : m; });
    /* Madde İÇİNDEKİ kaynak girişi de atılır: canlı destede (14.11.2026) maddeler
       "Kaynaklar (hiwellapp.com, 2018) gösteriyor ki, …", "Kaynak (acikbeyin.com)
       bildiriyor ki, …" diye başlıyordu. dropAttr yalnız madde SONUNDAKİ ayracı
       siliyor; alan adı asetatta okunmaz, atıf zaten "[n]" ile basılıyor.
       "Tim Bono (2016)" gibi kişi + yıl atfı kalır. */
    const dropLead = (b: string) => {
      const t = b.replace(/\s*\((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s()]*)?(?:\s*,\s*\d{4})?\)/gi, "")
        .replace(/^\s*(?:(?:bu\s+)?kaynak(?:lar|ça)?(?:\s*\([^()]{0,40}\))?\s+(?:gösteriyor|bildiriyor|belirtiyor|aktarıyor|söylüyor|vurguluyor|gösterir|belirtir)(?:\s+ki)?|(?:the\s+)?sources?(?:\s*\([^()]{0,40}\))?\s+(?:shows?|reports?|states?|says?|notes?|indicates?)(?:\s+that)?|kaynak(?:lar)?a\s+göre|according\s+to\s+(?:the\s+)?sources?)\s*[,:]?\s*/i, "");
      return t === b ? b : t.charAt(0).toLocaleUpperCase(lang === "en" ? "en" : "tr") + t.slice(1);
    };
    /* Bütün maddeler AYNI yılla başlıyorsa o yıl tarih değil, kaynağın yayın
       yılıdır ("2016 – şeker reddi…", "2016 – telefon…"): baştan atılır. */
    const dropYear = (bs: string[]) => { const ys = bs.map((b) => (b.match(/^\s*((?:1[5-9]|20)\d{2})\s*[–—:-]\s+(?=\S)/) || [])[1]); return bs.length >= 2 && ys[0] && ys.every((y) => y === ys[0]) ? bs.map((b) => { const t = b.replace(/^\s*\d{4}\s*[–—:-]\s+/, ""); return t.charAt(0).toLocaleUpperCase(lang === "en" ? "en" : "tr") + t.slice(1); }) : bs; };
    const slides = out.slides.slice(0, n).map((s: any) => {
      const ids = (Array.isArray(s.src) ? s.src : []).map((x: any) => Number(x)).filter((x: number) => srcs.some((y) => y.id === x));
      const idx = idxOf(ids);
      const kind = KINDS.includes(s.kind) ? s.kind : "list";
      const bullets = dropYear((Array.isArray(s.bullets) ? s.bullets : []).map((x: any) => dropLead(dropAttr(dropDated(cleanCite(String(x || "")))))).filter(Boolean).slice(0, 6));
      if (kind === "quote" && !bullets.length) { const qt = String(s.quote || s.text || "").trim(); if (qt) bullets.push(qt); }
      if (kind === "quote" && bullets.length) bullets[0] = safeQuote(bullets[0]);
      const warn: number[] = [];
      bullets.forEach((b: string, i: number) => { if (numTokens(b).length) { checked++; if (!verified(b, idx) && !verified(b, allIdx)) { warn.push(i); unverified++; } } });
      let stats = (Array.isArray(s.stats) ? s.stats : []).map((x: any) => ({ value: String(x?.value || "").trim(), label: cleanCite(String(x?.label || "")) })).filter((x: any) => x.value);
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
        /* Bütün değerleri aynı olan grafik veri değildir: "History of Money" destesinde
           (25.11.2026) 2009/2015/2026 yıllarına birer "milestone" çizildi, listeye inince
           "2009: 1 milestone" maddeleri basıldı. Grafik atılır, değerler maddeye yazılmaz. */
        if (flatChart(vals)) { chart = null; chartOk = false; }
      }
      const table = s.table && Array.isArray(s.table.rows) ? { headers: (s.table.headers || []).map(String).slice(0, 4), rows: s.table.rows.slice(0, 5).map((r: any) => (Array.isArray(r) ? r : []).map(String).slice(0, 4)) } : null;
      let k = kind;
      /* Tek eksende üç ayrı birim grafik değildir: canlı destede (14.11.2026)
         "10 mil · 7 km · 20 saniye" aynı çubuk grafikte yan yana çizildi. */
      if (chart && mixedUnits(chart.labels)) chartOk = false;
      if (k === "quote" && bullets.length && !isSentence(bullets[0])) k = "list";
      if (k === "time" && !timeOk(bullets)) k = "list";
      /* İki taraf adı olmayan "two" karşılaştırma değildir: canlı destede (14.11.2026)
         sınırlılıklar asetatı "birinci taraf / ikinci taraf" yer tutucusuyla basıldı. */
      if (k === "two" && (!Array.isArray(s.heads) || s.heads.slice(0, 2).filter((h: any) => /[\p{L}\d]/u.test(String(h || ""))).length < 2)) k = "list";
      const ser = k === "list" && !warn.length ? seriesOf(bullets) : null;
      if (ser && !flatChart(ser.values)) { k = "chart"; chart = { type: "line", ...ser }; chartOk = true; }
      if (k === "chart" && (!chart || !chartOk)) k = "list";
      // Grafik listeye inince maddesi yoksa asetat boş sayılıp düşüyordu; değerler maddeye yazılır.
      if (k === "list" && kind === "chart" && chart && !bullets.length) chart.values.forEach((v: number, i: number) => { const l = String(chart.labels[i] || ""); const u = (l.match(/\(([^)]+)\)\s*$/) || [])[1] || chart.unit; bullets.push(`${l.replace(/\s*\([^)]+\)\s*$/, "")}: ${String(v).replace(".", lang === "en" ? "." : ",")} ${u}`.trim()); if (!verified(String(v), idx) && !verified(String(v), allIdx)) warn.push(bullets.length - 1); });
      if (k === "stat" && stats.filter((x: any) => x.ok).length < 3) k = "list";
      if (k === "stat" && statOdd(stats)) { k = "list"; if (statOdd(stats) === 2) stats = []; }
      if (k === "table" && (!table || !table.rows.length)) k = "list";
      if (k === "list" && kind === "stat" && !bullets.length) stats.forEach((x: any) => { if (!x.ok) warn.push(bullets.length); bullets.push(`${x.value} — ${x.label}`); });
      const yaz = (t: string) => yazim(t, lang);
      if (k === "two") { const sd = sidesOf(bullets, s.heads.map(String), warn); if (sd.bullets.some((b, i) => b !== bullets[i])) s.n1 = 0; /* dizildiyse sınır ortadır */ bullets.splice(0, bullets.length, ...sd.bullets); warn.splice(0, warn.length, ...sd.warn); }
      if (ser) return { title: String(s.title || "").trim(), kind: k, bullets: [], warn: [], heads: [], stats: [], chart, table: null, notes: cleanNote(s.notes), image: imgOf(null), src: ids };
      return { title: yaz(cleanCite(String(s.title || ""))), kind: k, bullets: bullets.map(yaz), warn, heads: Array.isArray(s.heads) ? s.heads.slice(0, 2).map((h: any) => cleanCite(String(h))) : [], split: k === "two" ? Math.max(0, Math.min(bullets.length - 1, Number(s.n1) || 0)) : 0, stats: stats.filter((x: any) => x.ok).slice(0, 3).map((x: any) => ({ ...x, value: yaz(x.value) })), chart: k === "chart" ? chart : null, table: k === "table" ? table : null, notes: cleanNote(s.notes), image: imgOf(s.image), src: ids };
    });

    // İçeriği olmayan asetat (madde, sayı, grafik, tablo — hiçbiri yok) kurguya
    // girmez: istemci onu "ana fikri yaz…" yer tutucusuyla basıyordu.
    /* Düşen asetatın öncesindeki not son cümlesinde ona köprü kurar ("şimdi
       Armstrong'ın ünlü sözüne bakalım" — o asetat destede yoktu, 14.11.2026);
       asetat düşünce o cümle de düşer. */
    dropRepeats(slides);
    dropEchoes(slides);
    slides.forEach((x: any) => { x.notes = noteFit(x, lang); }); noteEchoes(slides);
    const sentences = (t: string) => String(t || "").split(/(?<=[.!?])\s+/).filter(Boolean);
    const dropAt = (i: number) => { slides.splice(i, 1); const p: any = slides[i - 1]; if (p) { const ns = sentences(p.notes); if (ns.length >= 3) p.notes = ns.slice(0, -1).join(" "); } };
    for (let i = slides.length - 1; i >= 0; i--) { const x: any = slides[i]; if (!x.title || (!x.bullets.length && !x.stats.length && !x.chart && !x.table)) dropAt(i); }
    /* Tek maddelik liste asetat değildir (aynı destede "650 milyon — izleyici"
       tek başına bir asetattı: 3 sayısı olmayan "stat" listeye inince böyle
       kalıyor). Madde komşu listeye taşınır, asetat düşer. */
    const plain = (x: any) => x && x.kind === "list" && !x.chart && !x.table;
    for (let i = slides.length - 2; i >= 0; i--) {
      const x: any = slides[i]; if (!plain(x) || x.bullets.length !== 1) continue;
      /* Komşu liste değilse en yakın listeye taşınır: canlı destede (14.11.2026)
         tek maddelik asetatın komşuları kapak ve zaman çizelgesiydi, asetat kaldı. */
      const t: any = slides.map((y: any, j: number) => ({ y, d: Math.abs(j - i) })).filter((o: any) => o.d && plain(o.y) && o.y.bullets.length > 1 && o.y.bullets.length < 4).sort((a: any, b: any) => a.d - b.d).map((o: any) => o.y)[0]; if (!t) continue;
      if (x.warn.length) { t.warn.push(t.bullets.length); }
      t.bullets.push(x.bullets[0]); t.src = [...new Set([...t.src, ...x.src])];
      dropAt(i);
    }
    if (!slides.length) return J({ error: "Acadia yanıtı okunamadı" }, 502);

    // ---------- anlam doğrulaması: her iddia kaynağın ilgili paragrafıyla karşılaştırılır ----------
    const ctxFor = (ids: number[], claim: string, max = 1100) => {
      const pool = srcs.filter((x) => !ids.length || ids.includes(x.id));
      const keys = (claim.match(/\d+(?:[.,]\d+)*|[\p{L}]{6,}/gu) || []).slice(0, 6);
      const parts: string[] = [];
      for (const s0 of pool) {
        const low = s0.text.toLocaleLowerCase("tr");
        for (const k of keys) { const at = low.indexOf(k.toLocaleLowerCase("tr")); if (at >= 0) { parts.push(`[${s0.id}] …${s0.text.slice(Math.max(0, at - 260), at + 260)}…`); break; } }
      }
      return (parts.length ? parts : pool.slice(0, 2).map((x) => `[${x.id}] ${x.snippet.slice(0, 500)}`)).join("\n").slice(0, max);
    };
    const claims: { k: string; si: number; bi: number; text: string; ctx: string }[] = [];
    slides.forEach((s: any, si: number) => {
      s.bullets.forEach((b: string, bi: number) => { if (b.length > 12) claims.push({ k: `${si}.b${bi}`, si, bi, text: b, ctx: ctxFor(s.src, b) }); });
      s.stats.forEach((x: any, bi: number) => claims.push({ k: `${si}.s${bi}`, si, bi, text: `${x.value} — ${x.label}`, ctx: ctxFor(s.src, x.value + " " + x.label) }));
    });
    /* KISA NOT UZATILIR (14.11.2026): yazara 45-80 kelime söylendiği hâlde üç
       canlı destede notlar 38-45 kelimede kaldı. 45'in altındaki notlar tek
       çağrıda, asetatın kendi kaynak paragrafıyla yeniden yazdırılır; yeni
       metin kaynakta geçmeyen bir sayı taşıyorsa ya da kısalıyorsa eski not kalır.
       Aşağıdaki anlam denetimi uzatılmış notu da görür. */
    const wc = (t: string) => (String(t || "").trim().match(/\S+/g) || []).length;
    const short = slides.map((s: any, i: number) => ({ s, i })).filter((x: any) => wc(x.s.notes) < 45);
    if (short.length && body?.expandNotes !== false) {
      const LN = lang === "en" ? "English" : "Turkish (Türkçe)";
      const sysN = `You improve presenter notes in ${LN}. For each item you get the slide title, what is on the slide, the current note and SOURCE EXCERPTS.
Rewrite the note as 4-5 natural spoken sentences, 55-75 words: keep what is correct, add one concrete detail or example from the excerpts that is NOT on the slide, and keep the final bridge sentence if there is one.
Use ONLY facts from the excerpts or the slide. No new numbers unless they are in the excerpts. No superlatives the excerpts do not state. Never mention source numbers or labels.
Return ONLY JSON: {"r":[{"i":0,"notes":""}]}`;
      // En kısa 6 not, 450 karakterlik kaynakla: bu çağrı anlam denetimiyle aynı
      // modelin dakikalık bütçesini paylaşır, o denetim daha önemlidir.
      const payN = short.sort((a: any, b: any) => wc(a.s.notes) - wc(b.s.notes)).slice(0, 6).map((x: any) => ({ i: x.i, title: x.s.title, slide: [...x.s.bullets, ...x.s.stats.map((y: any) => `${y.value} ${y.label}`)].join(" | ").slice(0, 300), note: x.s.notes, source: ctxFor(x.s.src, x.s.title + " " + x.s.bullets.join(" "), 450) }));
      const gn = await groq(gKey, "openai/gpt-oss-20b", sysN, JSON.stringify(payN), 2000);
      let rn: any = null; try { rn = JSON.parse(gn.data?.choices?.[0]?.message?.content || ""); } catch { rn = null; }
      if (gn.ok && rn && Array.isArray(rn.r)) for (const r of rn.r) {
        const s: any = slides[Number(r?.i)]; if (!s) continue;
        const nt = cleanNote(r?.notes);
        if (wc(nt) > wc(s.notes) && wc(nt) <= 110 && (verified(nt, allIdx) || !numTokens(nt).length)) s.notes = nt;
      } else console.warn("note expand", gn.status);
    }
    /* Grafik değerleri ve notlardaki sayılı cümleler de denetlenir (14.11.2026):
       sayı kaynakta geçtiği için geçerli sayılıyordu ama anlamı kaymıştı —
       "21,5 saat" yüzeyde kalış süresiyken not "21,5 saat yürüdüler" diyordu,
       grafik de 2,5 saatlik yürüyüşü "iniş hazırlığı" diye etiketlemişti. */
    slides.forEach((s: any, si: number) => {
      if (s.chart) s.chart.values.forEach((v: number, bi: number) => { const t = `${s.title} — ${s.chart.labels[bi] || ""}: ${v} ${s.chart.unit}`.trim(); claims.push({ k: `${si}.c${bi}`, si, bi, text: t, ctx: ctxFor(s.src, t) }); });
      s._ns = sentences(s.notes);
      // Sayısız ama mutlak iddia da denetlenir: "insanlık tarihindeki en hızlı
      // uzay yolculuğu" kaynakta yoktu ve sayı taşımadığı için geçmişti.
      s._ns.forEach((t: string, bi: number) => { if (numTokens(t).length || ABSOLUTE.test(t)) claims.push({ k: `${si}.n${bi}`, si, bi, text: t, ctx: ctxFor(s.src, t) }); });
    });
    const meaning = { checked: 0, flagged: 0, fixed: 0 };
    if (claims.length && body?.meaningCheck !== false) {
      const LL = lang === "en" ? "English" : "Turkish (Türkçe)";
      const sysV = `You are a strict fact checker. For each CLAIM, read its SOURCE EXCERPTS and decide:
"ok" = the excerpts support the claim as worded; "mislabel" = the number/fact is in the source but the claim labels it wrongly (e.g. a measured value called a forecast, wrong year, wrong institution, wrong unit); "unsupported" = the excerpts do not support it or contradict it.
For "mislabel" give "fix": the corrected claim in ${LL}, same length and style, keeping the number. For others "fix" is "". "why" = max 10 words in ${LL}.
Superlatives and absolute claims ("the fastest", "the first", "proved", "en hızlı", "kanıtladı") are "unsupported" unless the excerpts state exactly that.
A claim of the form "title — label: value unit" is a chart data point: it is "ok" only if the excerpts explicitly give that value for that label; a total divided into parts the source does not state is "unsupported".
Be lenient on paraphrase and rounding; be strict on meaning. Return ONLY JSON: {"r":[{"k":"","v":"ok|mislabel|unsupported","fix":"","why":""}]}`;
      /* Canlı log (14.11.2026): 70 iddia × 1100 karakter 413 verdi ve o destede
         HİÇBİR iddia denetlenmedi. İddialar önem sırasına dizilir (sayı kutusu,
         grafik, sayılı madde, sayılı/mutlak not cümlesi, öteki maddeler),
         kaynak parçası 420 karaktere iner ve yük ~10 bin karakterde kesilir. */
      const rank = (c: any) => { const t = c.k.split(".")[1][0]; return t === "s" ? 0 : t === "c" ? 1 : t === "b" && numTokens(c.text).length ? 2 : t === "n" ? 3 : 4; };
      const pack = (limit: number) => { const out: any[] = []; let used = 0; for (const c of [...claims].sort((a, b) => rank(a) - rank(b))) { const it = { k: c.k, claim: c.text, source: c.ctx.slice(0, 420) }; const len = JSON.stringify(it).length; if (used + len > limit) break; used += len; out.push(it); } return out; };
      let payload = pack(10000);
      // ayrı model: aynı dakikada ana yazımla aynı token sınırına takılmasın
      let gv = await groq(gKey, "openai/gpt-oss-20b", sysV, JSON.stringify(payload), 3000);
      // Yedek: öteki model (ayrı dakikalık bütçe) ve yarım yük — en önemli iddialar yine denetlenir.
      if (!gv.ok) { console.warn("meaning check 20b", gv.status, payload.length); payload = pack(4500); await new Promise((r) => setTimeout(r, 1500)); gv = await groq(gKey, "openai/gpt-oss-120b", sysV, JSON.stringify(payload), 2000); }
      let rv: any = null; try { rv = JSON.parse(gv.data?.choices?.[0]?.message?.content || ""); } catch { rv = null; }
      if (gv.ok && rv && Array.isArray(rv.r)) {
        meaning.checked = payload.length;
        for (const r of rv.r) {
          const c = claims.find((x) => x.k === r?.k); if (!c) continue;
          const s: any = slides[c.si]; const why = String(r?.why || "").slice(0, 90); const fix = String(r?.fix || "").trim();
          const tur = c.k.split(".")[1][0];
          if (tur === "n") {   // not cümlesi: düzeltilebiliyorsa düzelt, yoksa söyletme
            if (r.v === "mislabel" && fix && numTokens(fix).every((t) => numTokens(c.text).includes(t))) { s._ns[c.bi] = fix; meaning.fixed++; }
            /* Canlı deste (14.11.2026): 420 karakterlik kaynak parçasıyla denetçi
               "veri yok" deyip doğru cümleleri de sildi, notlar 13-18 kelimeye
               indi. Cümle yalnız iki kanıt birlikteyse silinir: denetçi
               desteklemiyor VE (sayısı kaynak metninde hiç geçmiyor YA DA
               mutlak bir iddia taşıyor). */
            else if ((r.v === "unsupported" || r.v === "mislabel") && (ABSOLUTE.test(c.text) || (numTokens(c.text).length > 0 && !verified(c.text, allIdx)))) { s._ns[c.bi] = ""; meaning.flagged++; }
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
      if (s._cw && s.chart) { s.chart.values.forEach((v: number, i: number) => { const bi = s.bullets.length; s.bullets.push(yazim(`${s.chart.labels[i] || ""}: ${v}${s.chart.unit === "%" ? "%" : " " + (s.chart.unit || "")}`.trim(), lang)); if (s._cw[i]) { s.warn.push(bi); (s.why = s.why || {})[bi] = s._cw[i]; } }); s.chart = null; s.kind = "list"; }
      delete s._cw;
    });

    const accessed = new Date().toLocaleDateString(lang === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", year: "numeric" });
    const used = new Set<number>(); slides.forEach((s: any) => s.src.forEach((x: number) => used.add(x)));
    const sources = srcs.filter((s) => used.has(s.id) || !used.size).map((s) => ({ id: s.id, title: s.title, url: s.url, site: s.site, date: s.date, apa: apa(s, lang, accessed), ctx: s.snippet.slice(0, 1200) }));
    // Deste konuyu yanıtladı mı: alt başlıkların kaçı asetatlara girdi. Log teşhis içindir (sorgular + kaynaklar + odak tek satırda).
    const body2 = slides.map((x: any) => [x.title, ...(x.bullets || []), ...(x.stats || []).map((y: any) => y.label), ...((x.table?.rows || []).flat())].join(" ")).join(" ");
    const focus = { aspects: aspects.length, sources: aspects.filter((a) => aspHit([a], srcs.map((x) => x.text).join(" ").slice(0, 200000))).length, covered: aspects.filter((a) => aspHit([a], body2)).length };
    console.log(`sunum arastirma: "${topic.slice(0, 60)}" | sorgular ${JSON.stringify(queries)} | alt basliklar ${JSON.stringify(aspects)} | kaynak ${srcs.map((x) => x.site).join(",")} | odak ${focus.covered}/${focus.aspects} (kaynakta ${focus.sources})`);
    return J({ title: String(out.title || topic).trim(), cover_image: imgOf(out.cover_image), slides, sources: docText ? [] : sources, check: { checked, unverified, meaning }, engine: { ...engine, focus } });
  } catch (e) {
    console.error("sunum-research", e);
    return J({ error: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
