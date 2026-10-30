/* ==========================================================================
   ACADEX — ODEME TESTLERI (tests/odeme.js)

   NEDEN VAR (28.10.2026, test raporu R91 "odeme sayfasi yok"):
   Odeme iyzico Checkout Form ile alinir (supabase/functions/odeme). Para ve
   plan suresi gecen her kararin sozlesmesi burada:
     - fiyat tarayicidan degil plan_prices'tan okunur
     - iyzico'nun dondurdugu odeme sepet, tutar, para birimi, durum ve
       dolandiricilik kontrolunden gecmeden "odendi" sayilmaz
     - ayni plan suresi dolmadan yeniden alinirsa sure SONUNA eklenir
     - donus adresi yalnizca izinli site kokleri (acik yonlendirme yok)
     - callback ikinci kez gelirse plan iki kez uzamaz ('pending' kosullu guncelleme)

   Calistirma:  node tests/odeme.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const SRC = read('supabase/functions/odeme/index.ts');
const SQL = read('supabase/migrations/20261028_odeme_iyzico.sql');
const PAGE = read('odeme.html');
const F = loadFromSource('supabase/functions/odeme/index.ts', ['kurusToPrice', 'priceToKurus', 'applyCoupon', 'planWindow', 'checkPaid', 'safeReturn']);
const { test, summary } = makeRunner();

const ORDER = { id: 'o-1', amount_kurus: 22900, currency: 'TRY' };
const PAID = { status: 'success', paymentStatus: 'SUCCESS', basketId: 'o-1', paidPrice: '229.0', currency: 'TRY', fraudStatus: 1, paymentId: '123' };

test('tutar kurus <-> iyzico fiyat dizesi', () => {
  assert.equal(F.kurusToPrice(22900), '229.00');
  assert.equal(F.kurusToPrice(5950), '59.50');
  assert.equal(F.priceToKurus('229.0'), 22900);
  assert.equal(F.priceToKurus(59.5), 5950);
});

test('kupon indirimi yuvarlanir ve 1 TL altina inmez', () => {
  assert.equal(F.applyCoupon(22900, 50), 11450);
  assert.equal(F.applyCoupon(5900, 33), 3953);
  assert.equal(F.applyCoupon(150, 90), 100);
});

test('gercek odeme kabul edilir', () => {
  assert.equal(F.checkPaid(PAID, ORDER), null);
});

test('eksik ya da baska siparise ait odeme reddedilir', () => {
  assert.match(F.checkPaid({ ...PAID, status: 'failure', errorMessage: 'kart' }, ORDER), /başarısız/);
  assert.match(F.checkPaid({ ...PAID, paymentStatus: 'FAILURE' }, ORDER), /tamamlanmadı/);
  assert.match(F.checkPaid({ ...PAID, basketId: 'o-2' }, ORDER), /sepet/);
  assert.match(F.checkPaid({ ...PAID, paidPrice: '1.0' }, ORDER), /tutar/);
  assert.match(F.checkPaid({ ...PAID, currency: 'USD' }, ORDER), /para birimi/);
  assert.match(F.checkPaid({ ...PAID, fraudStatus: 0 }, ORDER), /inceleme/);
  assert.match(F.checkPaid({ ...PAID, fraudStatus: -1 }, ORDER), /reddedildi/);
  assert.ok(F.checkPaid(null, ORDER));
});

test('ayni plan surerken alinan donem bitisine eklenir, degilse bugunden baslar', () => {
  const now = Date.parse('2026-10-28T12:00:00Z'), day = 86400000;
  const ext = F.planWindow({ plan: 'premium', valid_until: new Date(now + 10 * day).toISOString() }, 'premium', 30, now);
  assert.equal(Date.parse(ext.until) - now, 40 * day);
  const other = F.planWindow({ plan: 'lite', valid_until: new Date(now + 10 * day).toISOString() }, 'premium', 30, now);
  assert.equal(Date.parse(other.from), now);
  const expired = F.planWindow({ plan: 'premium', valid_until: new Date(now - day).toISOString() }, 'premium', 7, now);
  assert.equal(Date.parse(expired.until) - now, 7 * day);
  assert.equal(Date.parse(F.planWindow(null, 'lite', 30, now).from), now);
});

test('donus adresi yalnizca izinli site (acik yonlendirme yok)', () => {
  const ok = ['https://acadex-1lku.vercel.app'];
  assert.equal(F.safeReturn('https://acadex-1lku.vercel.app/x', ok), 'https://acadex-1lku.vercel.app');
  assert.equal(F.safeReturn('https://kotu.example.com', ok), null);
  assert.equal(F.safeReturn('javascript:alert(1)', ok), null);
  assert.equal(F.safeReturn('http://localhost:5500', ok), 'http://localhost:5500');
  assert.equal(F.safeReturn('', ok), null);
});

test('fiyat sunucuda plan_prices tablosundan okunur, tarayici fiyati yok', () => {
  assert.match(SRC, /from\("plan_prices"\)\.select\("plan, period, amount_kurus, days"\)/);
  assert.ok(!/body\?\.(price|amount)/.test(SRC), 'istekteki fiyat kullanilmamali');
  const call = (PAGE.match(/action: 'baslat'[^\n]*/) || [''])[0];
  assert.ok(call && !/amount|price|tutar/.test(call), 'sayfa odeme isteginde fiyat gondermemeli');
});

test('callback iyzico retrieve ile dogrular ve plani yalnizca bir kez uygular', () => {
  assert.match(SRC, /iyzico\("\/payment\/iyzipos\/checkoutform\/auth\/ecom\/detail"/);
  assert.match(SRC, /\.update\(\{ status: "paid"[\s\S]{0,300}\.eq\("status", "pending"\)\.select\("id"\)/);
  assert.match(SRC, /if \(flipped && flipped\.length\)/);
});

test('IYZWSv2 imzasi: randomKey + uri yolu + govde, HMAC-SHA256, base64 baslik', () => {
  assert.match(SRC, /encode\(rnd \+ path \+ body\)/);
  assert.match(SRC, /"IYZWSv2 " \+ btoa\(`apiKey:\$\{apiKey\}&randomKey:\$\{rnd\}&signature:\$\{sig\}`\)/);
});

test('migration: siparisleri yalnizca sahibi okur, yazma politikasi yok', () => {
  assert.match(SQL, /create policy "payment_orders kendi siparisini okur"[\s\S]*using \(auth\.uid\(\) = user_id\)/);
  assert.ok(!/on public\.payment_orders for (insert|update|delete|all)/.test(SQL));
  assert.match(SQL, /provider_payment_id text unique/);
});

test('odeme sayfasi: TR/EN, sozlesme onayi, sozlesme baglantilari var', () => {
  assert.match(PAGE, /data-l="en"/);
  assert.match(PAGE, /data-agree required/);
  const legal = read('legal.html');
  ['on-bilgilendirme', 'mesafeli-satis', 'iptal-iade'].forEach((id) => {
    assert.match(PAGE, new RegExp('legal\\.html#' + id));
    assert.match(legal, new RegExp('id="' + id + '"'));
  });
});

summary();
