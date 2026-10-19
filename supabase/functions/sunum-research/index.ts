// ==========================================================================
// Acadex Sunum — gerçek web araştırmasıyla sunum (sunum-research)
//
// action 'research': konu → Tavily web araması → Groq yalnız bu kaynaklardan
//   sunum kurgusu yazar (her asetat için uygun düzen + kaynak numarası) →
//   SUNUCU, rakam ve tarihleri kaynak metniyle birebir karşılaştırır
//   (yapay zekâya sorulmaz, uydurma "doğrulandı" olamaz) → APA kaynakça.
// action 'images': konu → Unsplash'ten telifsiz yatay fotoğraflar (Pexels yedek).
// action 'track':  seçilen Unsplash fotoğrafının indirme sayacı (Unsplash kuralı).
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

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const yearOf = (d: string) => { const m = String(d || "").match(/(19|20)\d{2}/); return m ? m[0] : ""; };
const apa = (s: Src, lang: string, accessed: string) => {
  const site = s.site || hostOf(s.url);
  const y = yearOf(s.date) || (lang === "en" ? "n.d." : "t.y.");
  return lang === "en"
    ? `${site}. (${y}). ${s.title}. Retrieved ${accessed}, from ${s.url}`
    : `${site}. (${y}). ${s.title}. Erişim tarihi: ${accessed}. ${s.url}`;
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
      const uKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
      const pKey = Deno.env.get("PEXELS_API_KEY");
      const UTM = "utm_source=acadex&utm_medium=referral";
      if (uKey) {
        const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape&content_filter=high`, { headers: { Authorization: `Client-ID ${uKey}`, "Accept-Version": "v1" } });
        if (r.status === 403 || r.status === 429) return J({ error: "Unsplash saatlik arama sınırı doldu", code: "rate" }, 429);
        if (!r.ok) return J({ error: "Unsplash yanıt vermedi", status: r.status }, 502);
        const d = await r.json();
        const photos = (d.results || []).map((p: any) => ({
          id: p.id, alt: p.alt_description || p.description || q, w: p.width, h: p.height,
          thumb: p.urls?.small, large: p.urls?.regular,
          photographer: p.user?.name, photographer_url: `${p.user?.links?.html}?${UTM}`, page: `${p.links?.html}?${UTM}`,
          source: "Unsplash", source_url: `https://unsplash.com/?${UTM}`, track: p.links?.download_location,
        }));
        return J({ photos });
      }
      if (pKey) {
        const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape&locale=${lang === "en" ? "en-US" : "tr-TR"}`, { headers: { Authorization: pKey } });
        if (!r.ok) return J({ error: "Pexels yanıt vermedi", status: r.status }, 502);
        const d = await r.json();
        const photos = (d.photos || []).map((p: any) => ({
          id: p.id, alt: p.alt || q, w: p.width, h: p.height, thumb: p.src?.medium, large: p.src?.large,
          photographer: p.photographer, photographer_url: p.photographer_url, page: p.url, source: "Pexels", source_url: "https://www.pexels.com",
        }));
        return J({ photos });
      }
      return J({ error: "UNSPLASH_ACCESS_KEY tanımlı değil", code: "no_key" }, 503);
    }

    // ---------------- araştırma ----------------
    const tKey = Deno.env.get("TAVILY_API_KEY");
    const gKey = Deno.env.get("GROQ_API_KEY");
    if (!tKey) return J({ error: "TAVILY_API_KEY tanımlı değil", code: "no_key" }, 503);
    if (!gKey) return J({ error: "GROQ_API_KEY tanımlı değil" }, 500);
    const topic = String(body?.topic || "").slice(0, 160).trim();
    if (topic.length < 2) return J({ error: "Konu boş" }, 400);
    const n = Math.max(3, Math.min(14, Number(body?.slideCount) || 7));
    const tone = String(body?.tone || "academic");

    const tv = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${tKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: topic, search_depth: "advanced", max_results: 7, include_raw_content: true, include_answer: false, chunks_per_source: 3 }),
    });
    if (!tv.ok) { const t = await tv.text().catch(() => ""); console.error("tavily", tv.status, t.slice(0, 300)); return J({ error: "Web araması yapılamadı", status: tv.status }, 502); }
    const tj = await tv.json();
    const srcs: Src[] = (tj.results || []).filter((r: any) => r?.url && (r.content || r.raw_content)).slice(0, 6).map((r: any, i: number) => ({
      id: i + 1, title: String(r.title || hostOf(r.url)).slice(0, 200), url: r.url, site: hostOf(r.url), date: String(r.published_date || ""),
      text: String(r.raw_content || r.content || "").slice(0, 20000), snippet: String(r.content || "").slice(0, 1400),
    }));
    if (srcs.length < 2) return J({ error: "Bu konuda yeterli kaynak bulunamadı", code: "few_sources" }, 422);

    const L = lang === "en" ? "English" : "Turkish (Türkçe)";
    const sys = `You build a factual university presentation in ${L} for a Business Faculty student, using ONLY the numbered SOURCES given.
Rules:
- Every fact, number, date and name must come from the sources. If the sources do not contain something, leave it out. Never invent numbers.
- Write ${n - 2} content slides (cover and closing are added separately). Tone: ${tone}.
- For each slide pick the layout that fits the content:
  "stat": exactly 3 key numbers from the sources (value + short label);
  "chart": a numeric series of 3-8 points that appears in the sources (labels + numeric values, same unit);
  "time": 3-4 chronological steps or dates; "two": a comparison of two sides (heads = the two side names);
  "table": a small comparison table (max 5 rows, max 4 columns); "quote": one striking sentence or definition;
  "list": 3-5 concise bullet points (max ~14 words each).
  Use at least 3 different layouts across the deck; avoid more than 2 "list" slides in a row.
- "src" = the source ids used on that slide. "notes" = 2-3 natural spoken sentences for the presenter.
Return ONLY JSON: {"title":"short deck title","slides":[{"title":"","kind":"list|two|time|stat|chart|quote|table","bullets":[""],"heads":["",""],"stats":[{"value":"","label":""}],"chart":{"type":"bar|line|pie","labels":[""],"values":[0],"unit":""},"table":{"headers":[""],"rows":[[""]]},"notes":"","src":[1]}]}`;
    const user = `TOPIC: ${topic}\n\nSOURCES:\n` + srcs.map((s) => `[${s.id}] ${s.title} (${s.site}${s.date ? ", " + s.date.slice(0, 10) : ""})\n${s.snippet}\n${s.text.slice(0, 900)}`).join("\n\n");

    let g = await groq(gKey, "openai/gpt-oss-120b", sys, user, 6000);
    if (!g.ok) { console.warn("groq 120b", g.status, JSON.stringify(g.data).slice(0, 300)); g = await groq(gKey, "openai/gpt-oss-20b", sys, user, 6000); }
    if (!g.ok) return J({ error: "Acadia sunumu yazamadı", status: g.status }, 502);
    let out: any = null;
    try { out = JSON.parse(g.data?.choices?.[0]?.message?.content || ""); } catch { out = null; }
    if (!out || !Array.isArray(out.slides) || !out.slides.length) return J({ error: "Acadia yanıtı okunamadı" }, 502);

    // ---------- doğrulama: sunucuda, kaynak metniyle ----------
    const allIdx = buildNumIndex(srcs.map((s) => s.text + " " + s.snippet).join(" "));
    const idxOf = (ids: number[]) => {
      const pick = srcs.filter((s) => ids.includes(s.id));
      return pick.length ? buildNumIndex(pick.map((s) => s.text + " " + s.snippet).join(" ")) : allIdx;
    };
    let checked = 0, unverified = 0;
    const slides = out.slides.slice(0, n).map((s: any) => {
      const ids = (Array.isArray(s.src) ? s.src : []).map((x: any) => Number(x)).filter((x: number) => srcs.some((y) => y.id === x));
      const idx = idxOf(ids);
      const kind = KINDS.includes(s.kind) ? s.kind : "list";
      const bullets = (Array.isArray(s.bullets) ? s.bullets : []).map((x: any) => String(x || "").trim()).filter(Boolean).slice(0, 6);
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
      return { title: String(s.title || "").trim(), kind: k, bullets, warn, heads: Array.isArray(s.heads) ? s.heads.slice(0, 2).map(String) : [], stats: stats.filter((x: any) => x.ok).slice(0, 3), chart: k === "chart" ? chart : null, table: k === "table" ? table : null, notes: String(s.notes || "").trim(), src: ids };
    });

    const accessed = new Date().toLocaleDateString(lang === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", year: "numeric" });
    const used = new Set<number>(); slides.forEach((s: any) => s.src.forEach((x: number) => used.add(x)));
    const sources = srcs.filter((s) => used.has(s.id) || !used.size).map((s) => ({ id: s.id, title: s.title, url: s.url, site: s.site, date: s.date, apa: apa(s, lang, accessed) }));
    return J({ title: String(out.title || topic).trim(), slides, sources, check: { checked, unverified } });
  } catch (e) {
    console.error("sunum-research", e);
    return J({ error: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
