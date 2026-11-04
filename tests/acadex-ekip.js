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
test('şema (04.11.2026): bütün birimler yönetime bağlı, rozet koordinatör kurucuyu gösterir; finans yanda; tasarım ile pazarlama yan yana', () => {
  const vm = require('node:vm');
  const blk = ek.slice(ek.indexOf('  var EK_LANE = '), ek.indexOf('  /* doluluk: dolu'));
  const F1 = { id: 'f1', full_name: 'Şükrü Çerçi', status: 'aktif' }, F2 = { id: 'f2', full_name: 'Serhat Arslan', status: 'aktif' };
  const T = (id, name, sort, coordinator, extra) => Object.assign({ id, name, sort, coordinator, is_board: false, is_advisory: false }, extra || {});
  const teams = [T('b', 'Yönetim', 10, '', { is_board: true }), T('u', 'Ürün ve Yazılım', 20, 'Lider: Şükrü Çerçi'), T('t', 'Test Birimi', 30, 'Koordinatör: Şevval Aksakal'),
    T('d', 'Tasarım', 40, 'Koordinasyon : Şükrü Çerçi'), T('f', 'Finans ve İş Modeli', 50, 'Koordinasyon: Serhat Arslan'), T('p', 'Pazarlama', 60, 'Koordinasyon: Serhat Arslan'),
    T('a', 'Akademik İçerik Kurulu', 70, 'Kuruluş ve koordinasyon: SERHAT ARSLAN'), T('h', 'Hukuk ve KVKK', 80, 'Serhat Arslan'), T('k', 'Kullanıcı Destek', 90, 'şevval aksakal'),
    T('v', 'Veri ve Analitik', 100, 'Şükrü Çerçi'), T('g', 'Digital Marketing', 120, 'Şükrü Çerçi'), T('x', 'Danışma', 200, '', { is_advisory: true })];
  const ctx = { EK: { teams, people: [F1, F2] }, ekOpen: (p) => p.status === 'acik', ekOf: (id) => (id === 'b' ? [F1, F2] : []) };
  vm.runInNewContext(blk + ';this.o = { ekFounderOf, ekIsStaff, ekLaneTeams };', ctx);
  const o = ctx.o, fs = [F1, F2], by = (n) => teams.find((t) => t.name === n);
  assert.equal(o.ekFounderOf(by('Pazarlama'), fs), F2); assert.equal(o.ekFounderOf(by('Akademik İçerik Kurulu'), fs), F2, 'büyük/küçük harf fark etmez');
  assert.equal(o.ekFounderOf(by('Test Birimi'), fs), F1, 'kurucu adı geçmeyen birim ilk kurucunun kolunda');
  assert.equal(o.ekIsStaff(by('Finans ve İş Modeli')), true); assert.equal(o.ekIsStaff(by('Pazarlama')), false);
  const left = o.ekLaneTeams(F1, 0, 2, fs).map((t) => t.name), right = o.ekLaneTeams(F2, 1, 2, fs).map((t) => t.name);
  assert.equal(left[left.length - 1], 'Tasarım', 'Tasarım ilk kurucunun birimlerinin sonunda: ' + left); assert.equal(right[0], 'Pazarlama');
  /* ikisi aynı kurucudaysa birlikte sonda */
  by('Pazarlama').coordinator = 'Koordinasyon: Şükrü Çerçi';
  const both = o.ekLaneTeams(F1, 0, 2, fs).map((t) => t.name); assert.deepEqual(both.slice(-2), ['Tasarım', 'Pazarlama'], String(both));
  by('Pazarlama').coordinator = 'Koordinasyon: Serhat Arslan';
  assert.ok(!left.concat(right).includes('Finans ve İş Modeli'), 'finans kollarda değil');
  assert.equal(left.length + right.length, 9);
  const css = read('css/admin.css'); assert.doesNotMatch(css.slice(css.indexOf('organizasyon şeması (04.11.2026)')), /color-mix/, 'html2canvas color-mix okuyamaz');
  assert.match(ek, /html2canvas\/1\.4\.1\/html2canvas\.min\.js/); assert.match(ek, /jspdf\/2\.5\.1\/jspdf\.umd\.min\.js/);
  /* tek gövde: birimler kurucu kartlarının değil yönetim kutusunun altında; kurucular yönetim kutusunun içinde */
  assert.match(ek, /class="ek-board ek-boardx"[\s\S]{0,300}<div class="ek-top">' \+ fnodes/);
  assert.match(ek, /'<div class="ek-row ek-flat' \+ \(r \+ cols < n \? ' ek-more' : ''\)/, 'satırlar soldaki çizgiyle bağlı'); assert.doesNotMatch(ek, /ek-lane/);
  assert.match(ek, /Math\.floor\(pi \/ cols\) !== Math\.floor\(\(pi \+ 1\) \/ cols\)\) units\.splice\(pi \+ 1, 0, units\.splice\(pi - 1, 1\)\[0\]\)/, 'çift satır sonunda bölünmez');
  assert.match(css, /@media \(max-width:760px\)\{\.ek-wide\{display:none\}\.ek-tree\{display:block\}/, 'telefonda dikey ağaç');
});
summary();
