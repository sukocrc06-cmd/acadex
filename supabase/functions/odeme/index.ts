// ==========================================================================
// Acadex Ödeme — iyzico Checkout Form (odeme)
// 28.10.2026, test raporu R91 ("ödeme sayfası yok").
//
// Akış (iyzico CF, ön ödemeli dönem; abonelik değil):
//   1. odeme.html → POST { action: 'baslat', plan, period, coupon, locale, buyer, donus }
//      Sunucu fiyatı plan_prices'tan okur (tarayıcının söylediği fiyata bakılmaz),
//      payment_orders'a 'pending' sipariş yazar, iyzico CF initialize çağırır,
//      tarayıcıya paymentPageUrl döner.
//   2. Kullanıcı iyzico'nun sayfasında öder; iyzico TARAYICIYI callbackUrl'e
//      (bu fonksiyon, ?donus=1) token ile POST eder. Bu istekte oturum yoktur.
//   3. Sunucu token'la iyzico CF retrieve'i KENDİSİ çağırır (gelen veriye
//      güvenilmez), tutar / sepet / durum eşleşirse siparişi 'paid' yapar ve
//      user_plans.valid_until'i uzatır, tarayıcıyı odeme.html?siparis=…'ye yollar.
//   4. odeme.html → POST { action: 'durum', siparis } ile sonucu gösterir.
//
// DEPLOY (elle, Supabase paneli):
//   - Fonksiyon adı: odeme. "Enforce JWT verification" KAPALI olmalı: iyzico'nun
//     yönlendirdiği callback isteğinde Authorization başlığı yoktur. 'baslat' ve
//     'durum' oturumu bu dosyada kendisi doğrular.
//   - Secrets: IYZICO_API_KEY, IYZICO_SECRET_KEY,
//     IYZICO_BASE_URL (deneme: https://sandbox-api.iyzipay.com,
//                      canlı:  https://api.iyzipay.com — varsayılan deneme),
//     SITE_URLS (virgülle izinli site kökleri, ör. https://acadex-1lku.vercel.app),
//     SUPABASE_SERVICE_ROLE_KEY (Supabase'de hazır gelir).
//   - Migration: supabase/migrations/20261028_odeme_iyzico.sql
//
// iyzico kimlik doğrulama (IYZWSv2, docs.iyzico.com → HMACSHA256 auth):
//   signature = hex(HMACSHA256(randomKey + uriPath + body, secretKey))
//   Authorization: IYZWSv2 base64("apiKey:"+apiKey+"&randomKey:"+randomKey+"&signature:"+signature)
// ==========================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PERIOD_TR: Record<string, string> = { month: "1 ay", term: "1 dönem", year: "1 yıl", week: "7 gün" };
const PERIOD_EN: Record<string, string> = { month: "1 month", term: "1 term", year: "1 year", week: "7 days" };
const PLAN_AD: Record<string, string> = { lite: "Lite", premium: "Premium" };

// ---------- saf yardımcılar (tests/odeme.js bunları kaynaktan çıkarıp sınar) ----------
const kurusToPrice = (k: number): string => (Math.round(k) / 100).toFixed(2);
const priceToKurus = (p: unknown): number => Math.round(Number(p) * 100);
const applyCoupon = (listKurus: number, percentOff: number): number =>
  Math.max(100, Math.round(listKurus * (100 - percentOff) / 100));
/** Yeni dönem nereden başlar: aynı plan hâlâ geçerliyse bitişinden, yoksa şimdiden. */
const planWindow = (cur: { plan?: string | null; valid_until?: string | null } | null, plan: string, days: number, now: number) => {
  const curEnd = cur && cur.plan === plan && cur.valid_until ? Date.parse(cur.valid_until) : NaN;
  const from = !isNaN(curEnd) && curEnd > now ? curEnd : now;
  return { from: new Date(from).toISOString(), until: new Date(from + days * 86400000).toISOString() };
};
/** iyzico retrieve yanıtı bu sipariş için GERÇEK ve tam bir ödeme mi? */
const checkPaid = (r: any, order: { id: string; amount_kurus: number; currency: string }): string | null => {
  if (!r || r.status !== "success") return "iyzico yanıtı başarısız" + (r && r.errorMessage ? ": " + r.errorMessage : "");
  if (r.paymentStatus !== "SUCCESS") return "ödeme tamamlanmadı (" + String(r.paymentStatus || "?") + ")";
  if (String(r.basketId) !== String(order.id)) return "sepet eşleşmedi";
  if (priceToKurus(r.paidPrice) !== order.amount_kurus) return "tutar eşleşmedi";
  if (String(r.currency || "TRY") !== order.currency) return "para birimi eşleşmedi";
  if (Number(r.fraudStatus) !== 1) return Number(r.fraudStatus) === 0 ? "ödeme iyzico incelemesinde" : "ödeme iyzico tarafından reddedildi";
  return null;
};
/** Dönüş adresi yalnızca izinli site köklerinden biri olabilir (açık yönlendirme olmasın). */
const safeReturn = (url: unknown, allowed: string[]): string | null => {
  try {
    const u = new URL(String(url || ""));
    const ok = allowed.some((a) => { try { return new URL(a).origin === u.origin; } catch { return false; } }) ||
      ((u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.protocol === "http:");
    return ok ? u.origin : null;
  } catch { return null; }
};

// ---------- iyzico çağrısı ----------
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function iyzico(path: string, payload: Record<string, unknown>) {
  const apiKey = Deno.env.get("IYZICO_API_KEY") || "";
  const secret = Deno.env.get("IYZICO_SECRET_KEY") || "";
  if (!apiKey || !secret) return { ok: false, status: 503, data: { status: "failure", errorMessage: "IYZICO_API_KEY / IYZICO_SECRET_KEY tanımlı değil" } };
  const base = (Deno.env.get("IYZICO_BASE_URL") || "https://sandbox-api.iyzipay.com").replace(/\/+$/, "");
  const body = JSON.stringify(payload);
  const rnd = String(Date.now()) + String(Math.floor(Math.random() * 1e9));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rnd + path + body)));
  const auth = "IYZWSv2 " + btoa(`apiKey:${apiKey}&randomKey:${rnd}&signature:${sig}`);
  const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: auth, "x-iyzi-rnd": rnd }, body });
  let d: any = null; try { d = await r.json(); } catch { d = null; }
  return { ok: r.ok, status: r.status, data: d };
}

const svc = () => createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const allowedSites = () => String(Deno.env.get("SITE_URLS") || "").split(",").map((s) => s.trim()).filter(Boolean);
const clip = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

// ---------- 3. iyzico dönüşü: siparişi doğrula, planı uygula, siteye yönlendir ----------
async function handleReturn(req: Request, url: URL): Promise<Response> {
  const db = svc();
  let token = url.searchParams.get("token") || "";
  if (!token && req.method === "POST") {
    try { const f = await req.formData(); token = String(f.get("token") || ""); } catch { /* boş */ }
  }
  const go = (site: string | null, id: string | null, ok: boolean) => {
    const root = site || allowedSites()[0] || "/";
    const to = `${root.replace(/\/+$/, "")}/odeme.html?${id ? "siparis=" + encodeURIComponent(id) + "&" : ""}durum=${ok ? "ok" : "hata"}`;
    return new Response(null, { status: 303, headers: { Location: to } });
  };
  if (!token) return go(null, null, false);

  const { data: order } = await db.from("payment_orders").select("*").eq("provider_token", token).maybeSingle();
  if (!order) return go(null, null, false);
  if (order.status === "paid") return go(order.return_url, order.id, true);   // yenilenen sayfa, ikinci POST

  const rr = await iyzico("/payment/iyzipos/checkoutform/auth/ecom/detail", { locale: order.locale, conversationId: order.id, token });
  const why = checkPaid(rr.data, order);
  if (why) {
    const inReview = /incelemesinde/.test(why);
    await db.from("payment_orders").update({ status: inReview ? "pending" : "failed", fail_reason: why })
      .eq("id", order.id).eq("status", "pending");
    console.warn(`odeme: siparis ${order.id} onaylanmadi — ${why}`);
    return go(order.return_url, order.id, false);
  }

  // Yalnızca 'pending' → 'paid' geçişini YAPAN istek planı uygular (çift dönüşte iki kez uzamasın).
  const { data: cur } = await db.from("user_plans").select("plan, valid_until").eq("user_id", order.user_id).maybeSingle();
  const w = planWindow(cur, order.plan, order.days, Date.now());
  const { data: flipped } = await db.from("payment_orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), provider_payment_id: String(rr.data.paymentId || ""), plan_from: w.from, plan_until: w.until, fail_reason: null })
    .eq("id", order.id).eq("status", "pending").select("id");
  if (flipped && flipped.length) {
    const up = await db.from("user_plans").upsert({ user_id: order.user_id, plan: order.plan, valid_until: w.until, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (up.error) console.error(`odeme: siparis ${order.id} ODENDI ama plan yazilamadi — elle uygulayin`, up.error);
    if (order.coupon) {
      const { data: c } = await db.from("payment_coupons").select("used_count").eq("code", order.coupon).maybeSingle();
      if (c) await db.from("payment_coupons").update({ used_count: (c.used_count || 0) + 1 }).eq("code", order.coupon);
    }
    console.log(`odeme: siparis ${order.id} odendi — ${order.plan}/${order.period}, ${kurusToPrice(order.amount_kurus)} TL, ${w.from} → ${w.until}`);
  }
  return go(order.return_url, order.id, true);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  try {
    if (url.searchParams.get("donus") === "1") return await handleReturn(req, url);

    const auth = req.headers.get("Authorization") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return J({ error: "Oturum gerekli" }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const db = svc();

    // ---------- 4. sipariş durumu ----------
    if (action === "durum") {
      const { data: o } = await db.from("payment_orders").select("id, plan, period, amount_kurus, status, fail_reason, plan_until, paid_at").eq("id", String(body?.siparis || "")).eq("user_id", u.user.id).maybeSingle();
      if (!o) return J({ error: "Sipariş bulunamadı" }, 404);
      return J({ siparis: o });
    }

    if (action !== "baslat") return J({ error: "Bilinmeyen işlem" }, 400);

    // ---------- 1. ödeme başlat ----------
    const plan = String(body?.plan || ""), period = String(body?.period || "");
    const locale = body?.locale === "en" ? "en" : "tr";
    const donus = safeReturn(body?.donus, allowedSites());
    if (!donus) return J({ error: "Geçersiz dönüş adresi (SITE_URLS'e ekleyin)" }, 400);
    const { data: price } = await db.from("plan_prices").select("plan, period, amount_kurus, days").eq("plan", plan).eq("period", period).eq("active", true).maybeSingle();
    if (!price) return J({ error: "Bu paket satışta değil" }, 400);

    let amount = price.amount_kurus, coupon: string | null = null;
    const code = clip(body?.coupon, 32).toUpperCase();
    if (code) {
      const { data: c } = await db.from("payment_coupons").select("*").eq("code", code).eq("active", true).maybeSingle();
      const ok = c && (!c.valid_until || Date.parse(c.valid_until) > Date.now()) && (!c.only_user || c.only_user === u.user.id) && (c.max_uses == null || c.used_count < c.max_uses);
      if (!ok) return J({ error: locale === "en" ? "Coupon is not valid" : "Kupon geçerli değil", code: "coupon" }, 400);
      amount = applyCoupon(price.amount_kurus, c.percent_off); coupon = code;
    }

    const b = body?.buyer || {};
    const name = clip(b.name, 60), surname = clip(b.surname, 60), phone = clip(b.phone, 20).replace(/[^\d+]/g, "");
    const city = clip(b.city, 40), address = clip(b.address, 200);
    const tckn = /^\d{11}$/.test(String(b.identityNumber || "")) ? String(b.identityNumber) : "11111111111";
    if (!name || !surname || phone.replace(/\D/g, "").length < 10 || !city || address.length < 5) {
      return J({ error: locale === "en" ? "Please fill in name, surname, phone, city and address" : "Ad, soyad, telefon, şehir ve adresi doldur", code: "buyer" }, 400);
    }

    const { data: order, error: oe } = await db.from("payment_orders").insert({
      user_id: u.user.id, plan, period, days: price.days, amount_kurus: amount, list_kurus: price.amount_kurus,
      coupon, locale, return_url: donus,
    }).select("*").single();
    if (oe || !order) { console.error("odeme: siparis yazilamadi", oe); return J({ error: "Sipariş oluşturulamadı" }, 500); }

    const p = kurusToPrice(amount);
    const itemName = `Acadex ${PLAN_AD[plan] || plan} · ${(locale === "en" ? PERIOD_EN : PERIOD_TR)[period] || period}`;
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "85.34.78.112";
    const addr = { contactName: `${name} ${surname}`, city, country: "Turkey", address };
    const init = await iyzico("/payment/iyzipos/checkoutform/initialize/auth/ecom", {
      locale, conversationId: order.id, price: p, paidPrice: p, currency: "TRY", basketId: order.id, paymentGroup: "PRODUCT",
      callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/odeme?donus=1`,
      enabledInstallments: [1],
      buyer: { id: u.user.id, name, surname, gsmNumber: phone, email: u.user.email || "", identityNumber: tckn, registrationAddress: address, city, country: "Turkey", ip },
      shippingAddress: addr, billingAddress: addr,
      basketItems: [{ id: `${plan}-${period}`, name: itemName, category1: "Dijital abonelik", itemType: "VIRTUAL", price: p }],
    });
    if (!init.ok || init.data?.status !== "success" || !init.data?.paymentPageUrl) {
      const msg = init.data?.errorMessage || "iyzico ödeme formu açılamadı";
      await db.from("payment_orders").update({ status: "failed", fail_reason: msg }).eq("id", order.id);
      console.error(`odeme: initialize basarisiz (${init.status})`, init.data);
      return J({ error: msg }, 502);
    }
    await db.from("payment_orders").update({ provider_token: init.data.token }).eq("id", order.id);
    return J({ siparis: order.id, paymentPageUrl: init.data.paymentPageUrl, tutar: p });
  } catch (e) {
    console.error("odeme: beklenmeyen hata", e);
    return J({ error: "Ödeme servisi şu an yanıt vermiyor" }, 500);
  }
});
