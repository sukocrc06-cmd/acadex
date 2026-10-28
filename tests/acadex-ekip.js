/* ==========================================================================
   ACADEX — YÖNETİM PANELİ · ACADEX EKİBİ TESTLERİ (tests/acadex-ekip.js)

   NEDEN VAR (29.10.2026): ekip bölümü "Organizasyon Şeması ve Görev Tanımları"
   belgesine göre genişledi (supabase/migrations/20261029c_acadex_ekip_2.sql):
   kişide yetki / başarı göstergesi / bağlı olduğu, açık pozisyon ve aday durumu;
   birimde amaç, görevler, karar usulü, çıktılar, durum, öncelik, danışma.
     - Belge GİZLİ: kişi verisi repoda değil, SQL Editor'de girilir. Bu dosya
       migration'da kişi/ekip verisi olmadığını da denetler.
     - 2. adım kurulu değilse panel eski alanlarla çalışmaya devam eder.
   Davranış (gerçek Postgres; ACADEX_PG verilirse):
     ACADEX_PG="-h /tmp/pg -p 5499 -U postgres" node tests/acadex-ekip.js
   Çalıştırma:  node tests/acadex-ekip.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const MIG1 = 'supabase/migrations/20261024e_acadex_ekip.sql', MIG2 = 'supabase/migrations/20261029c_acadex_ekip_2.sql';
const sql = read(MIG2), adm = read('js/admin-app.js');
const ek = adm.slice(adm.indexOf('/* ---------- Acadex ekibi'), adm.indexOf('/* ---------- kullanıcılar ----------'));

test('migration: yalnız yapı; kişi/ekip verisi yok (belge gizli)', () => {
  assert.doesNotMatch(sql, /\binsert\s+into\b/i);
  assert.doesNotMatch(sql, /\b(update|delete)\s+(from\s+)?public\.ax_/i);
  for (const c of ['authority', 'kpis', 'reports_to']) assert.match(sql, new RegExp('ax_people add column if not exists ' + c + ' '));
  for (const c of ['purpose', 'duties', 'rules', 'outputs', 'coordinator', 'state', 'priority', 'is_advisory']) assert.match(sql, new RegExp('ax_teams add column if not exists ' + c + ' '));
  assert.match(sql, /check \(status in \('aktif', 'yeni', 'yari', 'aday', 'acik', 'ayrildi'\)\)/);
  assert.match(sql, /check \(state in \('kuruldu', 'kuruluyor', 'acik', 'dis'\)\)/);
  assert.doesNotMatch(sql, /create policy|disable row level security|grant /i);
});
test('panel: her durum ve birim durumu için Türkçe etiket; formlar yeni alanları yazar', () => {
  for (const k of ['aktif', 'yeni', 'yari', 'aday', 'acik', 'ayrildi']) assert.match(ek, new RegExp('\\b' + k + ": '"));
  for (const k of ['kuruldu', 'kuruluyor', 'acik', 'dis']) assert.match(ek.slice(ek.indexOf('var ETS'), ek.indexOf('var ETSC')), new RegExp(k + ': '));
  assert.match(ek, /row\.reports_to = f\.rp\.value\.trim\(\); row\.authority = f\.au\.value\.trim\(\); row\.kpis = f\.kp\.value\.trim\(\);/);
  assert.match(ek, /row\.state = f\.st\.value; row\.priority = f\.pr\.value \|\| null;/);
});
test('panel: 2. adım kurulu değilse yeni alanlar gönderilmez (eski şemada kayıt bozulmaz)', () => {
  assert.match(ek, /EK\.v2 = !EK\.teams\.length \|\| Object\.prototype\.hasOwnProperty\.call\(EK\.teams\[0\], 'state'\)/);
  assert.match(ek, /if \(EK\.v2\) \{ row\.reports_to/);
  assert.match(ek, /if \(EK\.v2\) \{ row\.state/);
  assert.match(ek, /20261029c_acadex_ekip_2\.sql/);
});
test('panel: metinler kaçışlı (XSS yok); kişi/birim tıklanınca önce görev kartı', () => {
  // HTML üreten kısım: Excel (düz metin) hariç; onay penceresi (confirm) metinleri HTML değildir
  const html = ek.slice(0, ek.indexOf('var xlsxP')).split('\n').filter((l) => !/confirmBox\(/.test(l)).join('\n');
  const raw = [...html.matchAll(/'\s*\+\s*(p|t)\.(full_name|title|job_description|authority|kpis|reports_to|purpose|description|coordinator|rules|outputs|name)\s*\+\s*'/g)];
  assert.equal(raw.length, 0, 'kaçışsız alan: ' + raw.map((m) => m[0]).join(' '));
  assert.match(ek, /\[data-ekp\][\s\S]{0,80}ekPersonCard\(m/);
  assert.match(ek, /\[data-ekt\][\s\S]{0,80}ekTeamCardView\(m/);
  for (const h of ['Amaç', 'Sorumluluklar', 'Yetkiler', 'Başarı göstergeleri']) assert.ok(ek.includes("ekSec('" + h + "'") || ek.includes("'" + h + "'"), h);
});
test('davranış (gerçek Postgres): eski kurulum üstüne iki kez çalışır, yeni durumlar ve sınırlar', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1', q = (f) => JSON.stringify(path.join(ROOT, f));
  execSync(P + ' -d postgres -c "drop database if exists ax_ekip" -c "create database ax_ekip"', { stdio: 'pipe' });
  try {
    const run = (s) => execSync(P + ' -d ax_ekip -At -f -', { input: s, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
    run("do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; end $$; create function public.admin_ok() returns boolean language sql as $f$ select true $f$;");
    for (const f of [MIG1, MIG2, MIG2]) execSync(P + ' -d ax_ekip -f ' + q(f), { stdio: 'pipe' });
    // eski kurulumun hazır kayıtları yeni şemada geçerli kalır
    assert.ok(+run('select count(*) from ax_people') >= 1);
    assert.equal(run("select state from ax_teams limit 1"), 'kuruldu');
    run("insert into ax_people (full_name, status, title) values ('Pazarlama Sorumlusu', 'acik', 'Pazarlama Sorumlusu'), ('Örnek Aday', 'aday', '')");
    run("update ax_teams set state = 'dis', priority = 'orta', is_advisory = true where sort = 10");
    assert.throws(() => run("update ax_people set status = 'gecersiz' where full_name = 'Örnek Aday'"));
    assert.throws(() => run("update ax_teams set priority = 'acil' where sort = 10"));
    assert.throws(() => run("update ax_people set kpis = repeat('x', 1501) where full_name = 'Örnek Aday'"));
  } finally {
    execSync(P + ' -d postgres -c "drop database if exists ax_ekip"', { stdio: 'pipe' });
  }
});
summary();
