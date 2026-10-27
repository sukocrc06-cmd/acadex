/* ==========================================================================
   ACADEX — CANLI DESTEK TESTLERİ (tests/canli-destek.js)

   NEDEN VAR (28.10.2026): landing'in sağ altına kulaklıklı Acadia'lı destek hattı
   kuruldu (js/acadex-destek.js); bilmediğini ekibe aktarıyor, görüşme yönetim
   panelindeki "Canlı destek" sekmesine düşüyor (js/admin-app.js).
   Sunucu: supabase/migrations/20261028_canli_destek.sql.
     - Ziyaretçi tablolara doğrudan erişemez (RLS açık, politika yok); yalnız
       anahtarla çağrılan RPC'ler. Anahtarın kendisi saklanmaz, yalnız özeti.
     - Acadia'nın cevapları landing'deki metinlerden; yapay zekâ çağrısı yok.
     - Yönetici fonksiyonları admin_guard() ile korunur.
   Uçtan uca akış (ziyaretçi → SSS → ekibe aktar → admin cevap → ziyaretçi görür →
   yenileme → kapatma) yerel Postgres + iki tarayıcıyla denendi.

   Çalıştırma:  node tests/canli-destek.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const sql = read('supabase/migrations/20261028_canli_destek.sql');
const js = read('js/acadex-destek.js');
const adm = read('js/admin-app.js');

test('SQL: tablolar RLS açık, politika yok, anon/authenticated doğrudan erişemez', () => {
  for (const t of ['support_threads', 'support_messages', 'support_presence']) assert.match(sql, new RegExp('alter table public\\.' + t + ' enable row level security;'));
  assert.doesNotMatch(sql, /create policy/i);
  assert.match(sql, /revoke all on public\.support_threads, public\.support_messages, public\.support_presence from anon, authenticated;/);
  assert.match(sql, /token_hash text not null unique/);
  assert.doesNotMatch(sql, /\btoken text\b/, 'ham anahtar saklanmamalı');
});

test('SQL: yönetici fonksiyonlarının hepsi admin_guard çağırır, ziyaretçi fonksiyonları anon\'a açık', () => {
  const fns = [...sql.matchAll(/create or replace function public\.(admin_support_\w+)\([\s\S]*?\nend \$\$;/g)];
  assert.equal(fns.length, 5);
  for (const f of fns) assert.match(f[0], /perform public\.admin_guard\(\);/, f[1] + ' korumasız');
  assert.match(sql, /grant execute on function public\.support_status\(\), public\.support_open\(text, text, text, text, text\), public\.support_send\(text, text, boolean\),\n  public\.support_fetch\(text, bigint\), public\.support_peek\(text\), public\.support_close\(text\) to anon, authenticated;/);
  assert.match(sql, /revoke all on function public\.support_hash\(text\), public\.support_thread_of\(text\) from public, anon, authenticated;/);
});

test('SQL: kötüye kullanım sınırları (uzunluk, hız, IP başına görüşme)', () => {
  assert.match(sql, /check \(char_length\(body\) between 1 and 2000\)/);
  assert.match(sql, /interval '1 minute';\n  if n >= 6 then raise exception 'DESTEK_HIZ'/);
  assert.match(sql, /interval '1 hour';\n  if n >= 6 then raise exception 'DESTEK_SINIR'/);
  assert.match(sql, /char_length\(p_token\) < 32/);
});

test('widget: Acadia SSS eşleştirmesi landing metinlerinden, yapay zekâ çağrısı yok', () => {
  assert.doesNotMatch(js, /functions\/v1|acadia-assistant|invoke\(/);
  const ctx = { window: {}, document: { querySelector: () => true } };
  const m = js.match(/var norm = [^\n]+\n/)[0] + js.slice(js.indexOf('  var FAQ = ['), js.indexOf('  /* ---------- durum ---------- */'));
  const f = new Function(m + 'return { match: match, FAQ: FAQ };')();
  assert.equal(f.match('Fiyatlar ne kadar, ücretli mi?').k, 'ucret');
  assert.equal(f.match('KAYIT OLAMIYORUM yardım').k, 'kayit');
  assert.equal(f.match('pptx yükleyebilir miyim').k, 'dosya');
  assert.equal(f.match('mobil uygulamanız var mı?'), null, 'bilinmeyen soru ekibe gitmeli');
  void ctx;
});

test('widget: anahtar tarayıcıda üretilir; görüşme sürerken düzenli çekilir, kapalıyken yalnız okunmamış sorulur', () => {
  assert.match(js, /getRandomValues\(a\)/);
  assert.match(js, /rpc\('support_fetch', \{ p_token: S\.tok, p_after: S\.last \|\| 0 \}\)/);
  assert.match(js, /pollT = setTimeout\(tick, 4000\)/);
  assert.match(js, /rpc\('support_peek', \{ p_token: S\.tok \}\)/);
  assert.match(js, /costume: 'destek', forceCostume: true/);
});

test('admin: Canlı destek sekmesi, rozet, nabız ve bildirim', () => {
  assert.match(adm, /\{ k: 'support', t: 'Canlı destek', badge: 'support_unread' \}/);
  assert.match(adm, /VIEWS\.support = async function \(m\)/);
  assert.match(adm, /setInterval\(function \(\) \{ if \(ME\) supPulse\(\); \}, 15000\);/);
  assert.match(adm, /new Notification\('Acadex · canlı destek'/);
  assert.match(adm, /o\.support_unread = SUP\.unread; COUNTS = o;/);
});

test('bağlantılar: landing destek dosyalarını kit\'ten sonra yükler', () => {
  const idx = read('index.html');
  const a = idx.indexOf('<script src="js/acadia-kit.js"></script>'), b = idx.indexOf('<script src="js/acadex-destek.js"></script>');
  assert.ok(a > 0 && b > a);
  assert.match(idx, /<link rel="stylesheet" href="css\/acadex-destek\.css">/);
  assert.match(read('js/acadia-kit.js'), /destek: \{ bas: 'cagri' \}/);
});
summary();
