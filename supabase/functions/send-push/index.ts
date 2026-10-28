// send-push — Acadex telefon bildirimleri (Web Push), 29.10.2026
//
// GET  → { publicKey }   Tarayıcının abone olması için VAPID açık anahtarı (gizli değil).
// POST → kuyruğu (public.push_outbox) gönderir. Yalnız "x-push-secret" başlığı
//        PUSH_SECRET ile eşleşirse çalışır; çağıran veritabanıdır (pg_net,
//        public.push_kick). Kullanıcıdan gelen hiçbir veri gönderilmez.
//
// Gizli değişkenler (Supabase → Edge Functions → Secrets; değerleri
// tools/push-anahtar.html üretir, sohbete/koda yazılmaz):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), PUSH_SECRET
//   SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase'de zaten tanımlı.
// Dağıtım: "Verify JWT" KAPALI olmalı (veritabanı JWT göndermez; koruma PUSH_SECRET).
//
// Akış: push_claim(100) → her satırı web-push ile şifreleyip push servisine yolla →
// sonuçları push_done() ile yaz. 404/410 = abonelik silinmiş, veritabanından temizlenir.
// En fazla ~20 sn döner; kalan iş bir sonraki dürtmede (her dakika) gider.

import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

const env = (k: string) => Deno.env.get(k) ?? "";

// sabit zamanlı karşılaştırma
function same(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const url = env("SUPABASE_URL").replace(/\/$/, "") + "/rest/v1/rpc/" + fn;
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: "Bearer " + key },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(fn + " " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}

// bildirim türüne göre ömür: hatırlatmalar yarım gün, diğerleri bir gün
const TTL: Record<string, number> = { study: 43200, review: 43200, exam: 43200, test: 3600 };

type Row = { id: number; kind: string; title: string; body: string; url: string; tag: string | null; n: number; endpoint: string; p256dh: string; auth: string };

async function sendOne(r: Row) {
  const payload = JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: r.tag || r.kind, kind: r.kind, n: r.n });
  try {
    await webpush.sendNotification(
      { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
      payload,
      { TTL: TTL[r.kind] ?? 86400, urgency: r.kind === "support" ? "high" : "normal" },
    );
    return { id: r.id, ok: true };
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode ?? 0;
    if (code === 404 || code === 410) return { id: r.id, gone: true };
    return { id: r.id, err: (code ? code + " " : "") + String((e as Error).message || e).slice(0, 200) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const pub = env("VAPID_PUBLIC_KEY"), priv = env("VAPID_PRIVATE_KEY");
  if (req.method === "GET") {
    if (!pub) return json({ error: "VAPID_PUBLIC_KEY eksik" }, 503);
    return json({ publicKey: pub }, 200, { "Cache-Control": "public, max-age=3600" });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!same(req.headers.get("x-push-secret") ?? "", env("PUSH_SECRET"))) return json({ error: "yetkisiz" }, 401);
  if (!pub || !priv) return json({ error: "VAPID anahtarları eksik" }, 503);
  webpush.setVapidDetails(env("VAPID_SUBJECT") || "mailto:destek@acadex.com.tr", pub, priv);

  const t0 = Date.now(), total = { ok: 0, gone: 0, err: 0 };
  try {
    while (Date.now() - t0 < 20000) {
      const rows: Row[] = await rpc("push_claim", { p_limit: 100 });
      if (!rows || !rows.length) break;
      const res: unknown[] = [];
      for (let i = 0; i < rows.length; i += 10) {
        res.push(...await Promise.all(rows.slice(i, i + 10).map(sendOne)));
      }
      const d = await rpc("push_done", { p_res: res });
      total.ok += d.ok || 0; total.gone += d.gone || 0; total.err += d.err || 0;
      if (rows.length < 100) break;
    }
    return json(total);
  } catch (e) {
    console.error("send-push", e);
    return json({ error: String((e as Error).message || e).slice(0, 300), ...total }, 500);
  }
});
