/* ==========================================================================
   ACADEX — TELEFON BİLDİRİMLERİ (WEB PUSH) TESTLERİ (tests/web-push.js)

   NEDEN VAR (29.10.2026): ücretsiz telefon bildirimi kendi sistemimizle kuruldu:
   tarayıcının push servisi + supabase/migrations/20261029_web_push.sql +
   supabase/functions/send-push + sw.js + js/acadex-push.js.
   Bildirimler: panoda beğeni/yorum, canlı destek cevabı, çalışma hatırlatması
   (seri), tekrar zamanı gelen kartlar, yarınki sınav.
     - Tablolara doğrudan erişim yok (RLS açık, politika yok); yalnız fonksiyonlar.
     - Abonelik adresi yalnız bilinen push servisleri (SSRF koruması).
     - Kuyruğu yalnız service_role (edge function) alır; fonksiyonu yalnız
       Vault'taki gizli anahtarı bilen veritabanı dürtebilir.
     - Bildirime dokununca yalnız kendi sitemizin adresi açılır.
   Davranış testi (gerçek Postgres): tests/sql/web-push.sql
     ACADEX_PG="-h /tmp/pg -p 5499 -U postgres" node tests/web-push.js
   Çalıştırma:  node tests/web-push.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execSync } = require('node:child_process');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const MIG = 'supabase/migrations/20261029_web_push.sql';
const sql = read(MIG);
const fn = read('supabase/functions/send-push/index.ts');
const sw = read('sw.js');
const cli = read('js/acadex-push.js');

test('SQL: tablolar RLS açık, politika yok, anon/authenticated doğrudan erişemez', () => {
  for (const t of ['push_subscriptions', 'push_outbox']) assert.match(sql, new RegExp('alter table public\\.' + t + ' enable row level security'));
  assert.doesNotMatch(sql, /create policy/i);
  assert.match(sql, /revoke all on public\.push_subscriptions, public\.push_outbox from anon, authenticated;/);
});
test('SQL: kuyruk yalnız service_role; ziyaretçi yalnız destek aboneliği', () => {
  assert.match(sql, /grant execute on function public\.push_claim\(int\), public\.push_done\(jsonb\) to service_role;/);
  assert.match(sql, /grant execute on function public\.support_push_subscribe\(text, text, text, text\), public\.support_push_unsubscribe\(text, text\) to anon, authenticated;/);
  assert.doesNotMatch(sql, /push_claim\([^)]*\)[^;]*to (anon|authenticated)/);
});
test('SQL: gizli anahtar kodda değil Vault\'ta; tetikleyiciler kaydı asla bozmaz', () => {
  assert.match(sql, /vault\.decrypted_secrets where name = 'push_secret'/);
  assert.doesNotMatch(sql, /eyJ[A-Za-z0-9_-]{10,}/); // gömülü JWT yok
  for (const f of ['push_on_like', 'push_on_comment', 'push_on_support']) {
    const i = sql.indexOf('function public.' + f + '('), j = sql.indexOf('end $$;', i);
    assert.ok(i > 0, f); assert.match(sql.slice(i, j), /exception when others/, f + ' hata yutmuyor');
  }
});
test('SQL: abonelik adresi yalnız bilinen push servisleri', () => {
  const i = sql.indexOf('function public.push_endpoint_ok('), body = sql.slice(i, sql.indexOf('$$;', i));
  for (const h of ['fcm\\.googleapis\\.com', 'push\\.apple\\.com', 'push\\.services\\.mozilla\\.com', 'notify\\.windows\\.com']) assert.ok(body.includes(h), h);
  assert.ok(body.includes("'^https://("), 'yalnız https ve listeye bağlı başlangıç');
});
test('edge function: gizli başlık sabit zamanlı karşılaştırılır; silinmiş abonelik temizlenir', () => {
  assert.match(fn, /same\(req\.headers\.get\("x-push-secret"\) \?\? "", env\("PUSH_SECRET"\)\)/);
  assert.match(fn, /code === 404 \|\| code === 410/);
  assert.match(fn, /import webpush from "npm:web-push@\d+\.\d+\.\d+"/);
  assert.doesNotMatch(fn, /BEGIN PRIVATE KEY|VAPID_PRIVATE_KEY\s*=\s*"/);
});

/* sw.js'i sahte servis çalışanı ortamında çalıştır */
function swEnv() {
  const L = {}, shown = [], opened = [], nav = [];
  const clients = [];
  const self = {
    location: { origin: 'https://acadex.com.tr' },
    addEventListener: (k, f) => { L[k] = f; },
    skipWaiting() {},
    registration: { showNotification: (t, o) => { shown.push([t, o]); return Promise.resolve(); } },
    clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve(clients), openWindow: (u) => { opened.push(u); return Promise.resolve(); } },
  };
  vm.runInNewContext(sw, { self, URL, Promise, String });
  return { L, shown, opened, nav, clients };
}
const ev = (extra) => { let p = null; return Object.assign({ waitUntil: (x) => { p = x; }, get p() { return p; } }, extra); };
test('sw.js: gelen push bildirimi başlık, metin, simge ve adresle gösterilir', async () => {
  const E = swEnv(), e = ev({ data: { json: () => ({ title: 'Kalp Atlası', body: 'Berk projeni beğendi', url: '/dashboard.html#sandbox', kind: 'like' }) } });
  E.L.push(e); await e.p;
  assert.equal(E.shown.length, 1);
  const [t, o] = E.shown[0];
  assert.equal(t, 'Kalp Atlası'); assert.equal(o.body, 'Berk projeni beğendi');
  assert.equal(o.icon, '/assets/pwa/icon-192.png'); assert.equal(o.data.url, '/dashboard.html#sandbox'); assert.equal(o.renotify, true);
});
test('sw.js: bozuk veri gelse de bildirim çöker değil, düz metin gösterilir', async () => {
  const E = swEnv(), e = ev({ data: { json: () => { throw new Error('x'); }, text: () => 'merhaba' } });
  E.L.push(e); await e.p;
  assert.equal(E.shown[0][0], 'Acadex'); assert.equal(E.shown[0][1].body, 'merhaba');
});
test('sw.js: dokununca yalnız kendi sitemiz açılır (dış adres panele düşer)', async () => {
  let E = swEnv(), e = ev({ notification: { close() {}, data: { url: 'https://kotu.example.com/x' } } });
  E.L.notificationclick(e); await e.p;
  assert.deepEqual(E.opened, ['https://acadex.com.tr/dashboard.html']);
  E = swEnv(); e = ev({ notification: { close() {}, data: { url: '/dashboard.html#cards' } } });
  E.L.notificationclick(e); await e.p;
  assert.deepEqual(E.opened, ['https://acadex.com.tr/dashboard.html#cards']);
});
test('sw.js: aynı sayfa açıksa yeni pencere açılmaz, o pencere öne gelip adrese gider', async () => {
  const E = swEnv(); let focused = 0, went = null;
  E.clients.push({ url: 'https://acadex.com.tr/dashboard.html#home', focus() { focused++; return Promise.resolve(this); }, navigate(u) { went = u; return Promise.resolve(this); } });
  const e = ev({ notification: { close() {}, data: { url: '/dashboard.html#planner' } } });
  E.L.notificationclick(e); await e.p;
  assert.equal(E.opened.length, 0); assert.equal(focused, 1); assert.equal(went, 'https://acadex.com.tr/dashboard.html#planner');
});

test('istemci: iPhone Safari sekmesinde önce "Ana Ekrana Ekle" istenir', () => {
  assert.match(cli, /needsInstall/);
  assert.match(cli, /standalone/);
  assert.match(cli, /push_subscribe/); assert.match(cli, /support_push_subscribe/);
  assert.match(cli, /userVisibleOnly:\s*true/);
});
test('sayfalar: manifest ve iPhone simgesi bağlı, modül yüklü; simgeler var', () => {
  for (const p of ['index.html', 'dashboard.html']) {
    const h = read(p);
    assert.match(h, /rel="manifest" href="\/manifest\.webmanifest"/, p);
    assert.match(h, /js\/acadex-push\.js/, p);
  }
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  for (const ic of m.icons) assert.ok(fs.existsSync(path.join(ROOT, ic.src.replace(/^\//, ''))), ic.src);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/pwa/apple-touch-icon.png')));
});
test('anahtar aracı: VAPID anahtarı tarayıcıda üretilir, hiçbir yere gönderilmez', () => {
  const t = read('tools/push-anahtar.html');
  assert.match(t, /crypto\.subtle\.generateKey/);
  assert.doesNotMatch(t, /fetch\(|XMLHttpRequest|sendBeacon|<script src=/);
});

test('davranış (gerçek Postgres): güvenlik, beğeni/yorum/destek, hatırlatmalar, kuyruk', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1', q = (f) => JSON.stringify(path.join(ROOT, f));
  execSync(P + ' -d postgres -c "drop database if exists ax_push" -c "create database ax_push"', { stdio: 'pipe' });
  try {
    for (const f of ['tests/sql/web-push-stub.sql', 'supabase/migrations/20261028_canli_destek.sql', MIG, MIG]) execSync(P + ' -d ax_push -f ' + q(f), { stdio: 'pipe' });
    const out = execSync(P + ' -d ax_push -f ' + q('tests/sql/web-push.sql'), { stdio: 'pipe' }).toString();
    assert.match(out, /TUM SENARYOLAR GECTI/);
  } finally {
    execSync(P + ' -d postgres -c "drop database if exists ax_push"', { stdio: 'pipe' });
  }
});
test('stil: bildirim kutusu kendi önekini (axpn) kullanır; Plus/planlayıcının .axp sınıfına dokunmaz', () => {
  // 29.10.2026: ilk sürüm .axp / .axp-steps kullanıyordu; acadex-ink.css'teki aynı adlı
  // kural iPhone rehberini soluk boyadı, #planner-view de .axp taşıyor.
  const css = read('css/acadex-push.css');
  assert.doesNotMatch(css, /\.axp(?![a-z])/);
  assert.doesNotMatch(cli, /['" ]axp(?![a-z])/);
  const ink = read('css/acadex-ink.css');
  const mine = [...new Set(css.match(/\.axpn[a-z-]*/g))];
  assert.ok(mine.length > 3);
  for (const c of mine) assert.ok(!ink.includes(c), c + ' acadex-ink.css içinde de var');
});
summary();
