/* ==========================================================================
   ACADEX — YÖNETİM PANELİ · ACADEX KIDS (tests/admin-kids.js), 10.11.2026

   NEDEN VAR: Yönetim paneline "Acadex Kids" bölümü eklendi (js/admin-kids.js,
   css/admin-kids.css, supabase/migrations/20261110_kids_yonetim.sql):
   okul + lisans, toplu sınıf ve öğrenci (kimlik, hayvan, resimli şifre),
   A4'e 8 giriş kartı. Bu dosya şunları korur:
     - KVKK: istemci ve sunucu soyadı aynı biçimde kısaltır ("Ayşe Nur K.")
     - okul kodu önerisi AY-2026 biçiminde ve sunucunun kabul ettiği desende
     - tablolar ve fonksiyonlar dışarıya kapalı, her fonksiyon admin_guard() çağırır
     - davranış (gerçek Postgres, ACADEX_PG verilirse): kota, kimlik sırası,
       şifre özeti, RLS, anon yetkisi → tests/sql/kids-yonetim.sql
   Tarayıcı ucu (okul ekle → sınıf → ad listesi → şifre → kart basımı, telefon)
   Playwright ile gerçek Postgres'e karşı denendi.
   Çalıştırma:  node tests/admin-kids.js
                ACADEX_PG="-h /tmp/pg -p 5499 -U postgres" node tests/admin-kids.js
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
const SQL = 'supabase/migrations/20261110_kids_yonetim.sql';

const yukle = () => {
  const X = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const w = { AXADM: { VIEWS: {}, X, NF: String, DT: String, $: () => null, $$: () => [], rpc: async () => null, toast() {}, errMsg: String } };
  vm.runInNewContext(read('js/admin-kids.js'), { window: w, document: {}, navigator: {}, console });
  return w;
};

test('istemci kısaltması sunucuyla aynı (KVKK: tam soyad tutulmaz)', () => {
  const T = yukle().AXKIDS_TEST;
  assert.equal(T.adKisalt('  Ayşe   Nur  Kaya '), 'Ayşe Nur K.');
  assert.equal(T.adKisalt('Defne'), 'Defne');
  assert.equal(T.adKisalt('ali özdemir'), 'ali Ö.');
  assert.equal(T.adKisalt('ilknur ışık'), 'ilknur I.');
  assert.equal(T.adKisalt(''), '');
  assert.deepEqual([...T.adlariAyikla('1. Defne Kaya\n\n  \nAli Yılmaz\t5-A\n2) Zeynep Ak;Mert Can')], ['Defne K.', 'Ali Y.', 'Zeynep A.', 'Mert C.']);
  // sunucu da aynı kuralı uygular
  const sql = read(SQL);
  assert.match(sql, /upper\(left\(a\[array_length\(a, 1\)\], 1\)\) \|\| '\.'/);
  assert.match(sql, /kids_ogrenci_ekle[\s\S]{0,900}public\.kids_ad_kisalt\(t\)/);
});

test('okul kodu önerisi: AY-2026 biçimi, genel sözcükler atlanır, sunucu deseniyle uyumlu', () => {
  const T = yukle().AXKIDS_TEST, desen = /^[A-Z0-9]{2,8}-[0-9]{4}$/;
  assert.equal(T.kodOner('Ay Kreşi ve Anaokulu', '2026'), 'AY-2026');
  assert.equal(T.kodOner('Mavi Bulut Anaokulu', '2026'), 'MB-2026');
  assert.equal(T.kodOner('Özel Işıklı Çocuk Yuvası', '2027'), 'ISI-2027');
  assert.equal(T.kodOner('Güneş Çiçeği Koleji İlkokulu', '2026'), 'GC-2026');
  for (const ad of ['', 'Kreş', 'A', 'Şirin Şirinler Şirketi Şenliği Okulu', '123 Okulu']) assert.match(T.kodOner(ad, '2026'), desen, ad);
  assert.match(read(SQL), /check \(kod ~ '\^\[A-Z0-9\]\{2,8\}-\[0-9\]\{4\}\$'\)/);
});

test('lisans tarihi: bir yıl, bitiş günü dahil; kalan gün', () => {
  const T = yukle().AXKIDS_TEST;
  assert.equal(T.birYilSonra('2026-11-10'), '2027-11-09');
  assert.equal(T.birYilSonra('2028-03-01'), '2029-02-28');
  assert.equal(T.gunKaldi('2026-11-20', '2026-11-10T15:00:00'), 10);
  assert.equal(T.gunKaldi('2026-11-01', '2026-11-10T00:00:00'), -9);
});

test('kart sayfası: A4, 8 kartta bir sayfa, kaçışlı ad', () => {
  const T = yukle().AXKIDS_TEST;
  const g = (i) => ({ id: 'g' + i, sinif_id: 's', no: i, kimlik: 'AY-2026-' + String(i).padStart(3, '0'), ad: i === 1 ? '<b>x</b>' : 'Çocuk ' + i, hayvan: 'kedi', sifre: ['elma', 'top'] });
  const h = T.kartSayfa({ kod: 'AY-2026', ad: 'Ay' }, Array.from({ length: 17 }, (_, i) => g(i + 1)), [{ id: 's', ad: 'Papatyalar' }]);
  assert.equal((h.match(/<section class="sayfa">/g) || []).length, 3);
  assert.equal((h.match(/<div class="kart">/g) || []).length, 17);
  assert.match(h, /@page\{size:A4;margin:0\}/);
  assert.ok(!h.includes('<b>x</b>') && h.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.match(h, /AY-2026-017/);
});

test('güvenlik: tablolar kapalı, her yönetici fonksiyonu admin_guard() ile başlar, anon çağıramaz', () => {
  const sql = read(SQL);
  assert.match(sql, /enable row level security[\s\S]{0,120}revoke all on public\.%I from anon, authenticated/);
  const fns = [...sql.matchAll(/create or replace function public\.(kids_\w+)\(/g)].map((m) => m[1]);
  const yardimci = ['kids_ad_kisalt', 'kids_sifre_uret', 'kids_okul_json'];
  for (const f of fns.filter((f) => !yardimci.includes(f))) {
    const govde = sql.slice(sql.indexOf('function public.' + f + '('), sql.indexOf('end $$;', sql.indexOf('function public.' + f + '(')));
    assert.match(govde, /security definer/, f);
    assert.match(govde, /begin\s+perform public\.admin_guard\(\);/, f + ' admin_guard ile başlamalı');
    assert.ok(sql.includes("'" + f + '('), f + ' yetki listesinde olmalı');
  }
  for (const f of yardimci) assert.match(sql, new RegExp('revoke all on function public\\.' + f + '\\([^)]*\\) from public, anon, authenticated'), f);
  assert.match(sql, /extensions\.crypt\(s, extensions\.gen_salt\('bf'\)\)/);   // öğretmen şifresi düz tutulmaz
  assert.doesNotMatch(read('js/admin-kids.js'), /service_role|\.from\('kids_/);    // istemci tabloya doğrudan gitmez
});

test('panel: menüde Acadex Kids, betikler admin-app.js\'ten sonra yüklenir', () => {
  const app = read('js/admin-app.js'), html = read('admin.html');
  assert.match(app, /\{ k: 'kids', t: 'Acadex Kids' \}/);
  assert.match(app, /kids: 'Acadex Kids'/);
  assert.match(app, /\n    kids: '<path/);
  const i = (s) => html.indexOf(s);
  assert.ok(i('js/admin-app.js') < i('js/kids-ciz.js') && i('js/kids-ciz.js') < i('js/admin-kids.js'));
  assert.ok(i('css/admin-kids.css') > 0);
  assert.match(read('js/admin-kids.js'), /A\.VIEWS\.kids = async function/);
});

test('davranış (gerçek Postgres): kota, kimlik, KVKK, şifre özeti, RLS, anon', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1', q = (f) => JSON.stringify(path.join(ROOT, f));
  execSync(P + ' -d postgres -c "drop database if exists ax_kids" -c "create database ax_kids"', { stdio: 'pipe' });
  try {
    for (const f of ['tests/sql/kids-yonetim-stub.sql', SQL, SQL]) execSync(P + ' -d ax_kids -f ' + q(f), { stdio: 'pipe' });
    const out = execSync(P + ' -d ax_kids -f ' + q('tests/sql/kids-yonetim.sql') + ' 2>&1').toString();
    assert.match(out, /HEPSI GECTI/); assert.match(out, /RLS GECTI/); assert.match(out, /ANON GECTI/);
  } finally { execSync(P + ' -d postgres -c "drop database if exists ax_kids"', { stdio: 'pipe' }); }
});

summary();
