/* ==========================================================================
   ACADEX — YÖNETİM: ACADEX GÖREV (tests/acadex-gorev.js), 21.11.2026
   NEDEN VAR: Yönetim panelinde birimlere iş görevi (Acadex Kids lansmanı, son teslim
   10 Aralık). Bu dosya şunları korur:
     - tarih/gecikme hesabı, sıralama, filtreler (saf yardımcılar)
     - bağlantı yalnız https:// (javascript: vb. sayfaya girmez)
     - menüde "Acadex Görev" düğmesi, sayfa betiği ve stili bağlı; finans rolü de görür
     - SQL: tablo + RLS (yönetici her şey, finans yalnız Finans görevinde durum/not),
       tohumda altı birimin Kids görevleri, hepsi 10.12.2026'ya kadar, tekrar çalıştırılabilir
   Yerel Postgres 16'da (yetki taklitleriyle) ve tarayıcıda denendi.
   Çalıştırma:  node tests/acadex-gorev.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const js = read('js/admin-gorev.js'), app = read('js/admin-app.js'), html = read('admin.html'), sql = read('supabase/migrations/20261121_acadex_gorev.sql');

const W = { AXADM: { VIEWS: {}, X: (t) => String(t), $: () => null, $$: () => [], sb: {} }, localStorage: { getItem: () => null, setItem() { } } };
W.window = W; vm.createContext(W); vm.runInContext(js, W);
const G = W.AX_GOREV, SIMDI = new Date(2026, 10, 21);

test('gün farkı ve gecikme', () => {
  assert.equal(G.gunFark('2026-11-21', SIMDI), 0); assert.equal(G.gunFark('2026-12-10', SIMDI), 19); assert.equal(G.gunFark('2026-11-20', SIMDI), -1);
  assert.equal(G.gecikti({ teslim: '2026-11-20', durum: 'suruyor' }, SIMDI), true);
  assert.equal(G.gecikti({ teslim: '2026-11-20', durum: 'bitti' }, SIMDI), false);
  assert.equal(G.gecikti({ teslim: null, durum: 'yapilacak' }, SIMDI), false);
  assert.match(G.teslimYazi({ teslim: '2026-11-18', durum: 'yapilacak' }, SIMDI), /3 gün gecikti/);
  assert.match(G.teslimYazi({ teslim: '2026-11-22', durum: 'yapilacak' }, SIMDI), /yarın/);
});
test('özet, sıralama, filtre', () => {
  const l = [{ id: 1, teslim: '2026-12-01', durum: 'bitti', team_id: 'a', proje: 'kids' }, { id: 2, teslim: '2026-11-01', durum: 'suruyor', team_id: 'b', proje: 'kids' }, { id: 3, teslim: '2026-11-25', durum: 'yapilacak', team_id: 'a', proje: 'acadex' }];
  const o = G.ozet(l, SIMDI); assert.deepEqual([o.toplam, o.bitti, o.gecikti, o.yuzde], [3, 1, 1, 33]);
  assert.deepEqual(Array.from(G.sirala(l), (g) => g.id), [2, 3, 1], 'bitenler sonda, yakın teslim önde');
  assert.equal(G.suz(l, { proje: 'kids', birim: 'a' }).length, 1);
  assert.equal(G.suz(l, { durum: 'acik' }).length, 2);
});
test('bağlantı yalnız https', () => {
  assert.equal(G.guvenliLink('https://docs.google.com/x'), 'https://docs.google.com/x');
  for (const k of ['javascript:alert(1)', 'http://x.com', 'https://x.com/"onmouseover=1', '']) assert.equal(G.guvenliLink(k), '');
  assert.match(sql, /baglanti ~\* '\^https:\/\/'/);
});
test('menü, başlık, betik ve stil bağlı; finans rolü görür', () => {
  assert.match(app, /\{ k: 'gorev', t: 'Acadex Görev'/); assert.match(app, /gorev: 'Acadex Görev'/); assert.match(app, /\n    gorev: '</);
  assert.match(app, /FIN_NAV = \{[^}]*gorev: 1/);
  assert.match(html, /css\/admin-gorev\.css/);
  assert.ok(html.indexOf('js/admin-app.js') < html.indexOf('js/admin-gorev.js'));
});
test('SQL: RLS ve finans sınırı', () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /ax_gorev_admin[\s\S]*admin_ok\(\)/);
  assert.match(sql, /ax_gorev_fin_yaz[\s\S]*'Finans ve İş Modeli'/);
  assert.match(sql, /yalnız durum, not ve bağlantıyı/);
  assert.match(sql, /revoke all on public\.ax_gorev from anon/);
  assert.match(sql, /on conflict \(kod\) do nothing/);
});
test('tohum: altı birim, Kids, 10 Aralık\'a kadar', () => {
  const satir = [...sql.matchAll(/\('(kids-[a-z]+-\d)', '([^']+)', '((?:[^']|'')+)', '((?:[^']|'')*)', '(\d{4}-\d\d-\d\d)', '(yuksek|orta|dusuk)'/g)];
  assert.ok(satir.length >= 30, 'görev sayısı: ' + satir.length);
  const birim = new Set(satir.map((s) => s[2]));
  for (const b of ['Test Birimi', 'Tasarım', 'Pazarlama', 'Digital Marketing', 'Finans ve İş Modeli', 'Ürün ve Yazılım']) assert.ok(birim.has(b), b);
  for (const s of satir) assert.ok(s[5] >= '2026-11-21' && s[5] <= '2026-12-10', s[1] + ' ' + s[5]);
  assert.equal(new Set(satir.map((s) => s[1])).size, satir.length, 'kodlar tekil');
  assert.ok(satir.some((s) => /Finans/.test(s[3]) && s[2] === 'Pazarlama'), 'kreş verisi Finans\'a bildirilir');
  assert.ok(satir.some((s) => /Excel/.test(s[3]) && s[2] === 'Pazarlama'), 'kreş araştırması Excel\'i');
});
summary();
