/* ==========================================================================
   ACADEX — ACADEX KIDS: "KİM OYNUYOR?" VE SINIFTA EŞSİZ YÜZ (tests/kids-yuz.js), 14.11.2026

   NEDEN VAR: 30 çocuklu sınıfta 8 hayvan tekrar ediyordu; bir cihaz da son çocuğu
   hatırlayıp doğrudan içeri alıyordu. Bu dosya şunları korur:
     - yüz = hayvan + renk (8 × 8 = 64); sınıfta iki çocuk aynı yüzü almaz
       (supabase/migrations/20261114b_kids_yuz.sql, davranışı tests/sql/kids-yuz.sql)
     - renk her yerde çizilir: çocuk girişi, öğretmen/yönetici/admin tabloları, kartlar ("Mavi kedi")
     - cihaz kimseyi kendiliğinden içeri almaz: "Kim oynuyor?" listesi + "Sen Ali misin?" onayı
     - soru eki ünlü uyumuna uyar (mısın / misin / musun / müsün)
   Çalıştırma:  node tests/kids-yuz.js
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
const MIG = 'supabase/migrations/20261114b_kids_yuz.sql';

function ctx(files) {
  const store = {};
  const c = { console, document: { getElementById: () => null, querySelectorAll: () => [] }, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } }, matchMedia: () => ({ matches: false }), addEventListener: () => {}, setTimeout, clearTimeout, Promise, location: { hash: '' }, navigator: {} };
  c.window = c; vm.createContext(c);
  for (const f of files) vm.runInContext(read(f), c, { filename: f });
  return c;
}

test('çizim: renk verilince zemin dairesi, verilmeyince eski avatar; "Mavi kedi"', () => {
  const C = ctx(['kids/assets/kids-ciz.js']).KIDS_CIZ;
  assert.equal(C.YUZ_RENK.length, 8);
  assert.equal(new Set(C.YUZ_RENK.map((r) => r[1])).size, 8, 'renkler ayrı');
  assert.equal(new Set(C.YUZ_RENK.map((r) => r[0])).size, 8, 'renk adları ayrı');
  assert.equal(C.avatar('kedi'), C.avatar('kedi', null), 'null renk = renksiz (0 sanılmaz)');
  assert.equal(C.avatar('kedi'), C.avatar('kedi', undefined));
  assert.equal(C.avatar('kedi', 9), C.avatar('kedi'), 'geçersiz renk yok sayılır');
  for (let r = 0; r < 8; r++) assert.ok(C.avatar('kedi', r).includes('fill="' + C.YUZ_RENK[r][1] + '"'), 'renk ' + r);
  assert.ok(C.avatar('kedi', 0).includes('fill="' + C.YUZ_RENK[0][1] + '"'), '0 geçerli bir renk');
  assert.notEqual(C.avatar('kedi', 1), C.avatar('kedi', 2));
  assert.equal(C.yuzAd('kedi', 4), 'Mavi kedi');
  assert.equal(C.yuzAd('kurbaga', 0), 'Kırmızı kurbağa');
  assert.equal(C.yuzAd('ayi', null), 'Ayı');
  assert.ok(C.avatarGiy('kedi', { bas: C.GIYSI[0] }, 3).includes(C.YUZ_RENK[3][1]), 'giysili avatar da renkli');
  assert.equal(read('js/kids-ciz.js').split('\n').slice(2).join('\n'), read('kids/assets/kids-ciz.js').split('\n').slice(2).join('\n'), 'js/kids-ciz.js kopyası güncel');
});

test('veri: sunucudan gelen renk [4]te; örnek okulda her sınıfta yüzler eşsiz', () => {
  const c = ctx(['kids/assets/kids-ciz.js', 'kids/assets/kids-veri.js', 'kids/assets/kids-bulut.js']);
  const o = c.KIDS_BULUT.okulBicim({ kod: 'A', ad: 'B', siniflar: [{ id: 's', ad: 'S', bant: 'kasif', ogr: [{ id: 'x', ad: 'Ali', hayvan: 'kedi', renk: 0 }, { id: 'y', ad: 'Can', hayvan: 'kedi' }] }] });
  assert.equal(o.siniflar[0].ogr[0][4], 0);
  assert.equal(o.siniflar[0].ogr[1][4], null, 'eski kayıt: renksiz');
  for (const s of c.KIDS_VERI.OKUL.siniflar) assert.equal(new Set(s.ogr.map((g) => g[1] + ':' + g[4])).size, s.ogr.length, s.id);
});

test('soru eki ünlü uyumuna uyar; yalnız ilk ad sorulur', () => {
  const src = read('kids/assets/kids-app.js');
  const fn = src.match(/function sorEki\(ad\) \{[\s\S]*?\n  \}/)[0];
  const sorEki = vm.runInNewContext('(' + fn.replace('function sorEki', 'function') + ')');
  const ok = { 'Ali': 'Ali misin?', 'Ada K.': 'Ada mısın?', 'Defne': 'Defne misin?', 'Kaan': 'Kaan mısın?', 'Duru': 'Duru musun?', 'Yusuf': 'Yusuf musun?', 'Mert Y.': 'Mert misin?',
    'Ömür': 'Ömür müsün?', 'Göktürk': 'Göktürk müsün?', 'Doğu': 'Doğu musun?', 'Nil': 'Nil misin?', 'Irmak': 'Irmak mısın?', 'İpek': 'İpek misin?', 'Can': 'Can mısın?', 'Gül': 'Gül müsün?', 'Ozan': 'Ozan mısın?', 'Öykü': 'Öykü müsün?' };
  for (const [ad, s] of Object.entries(ok)) assert.equal(sorEki(ad), s, ad);
});

test('giriş akışı: cihaz kimseyi kendiliğinden almaz; yüz → "Sen … misin?" → şifre', () => {
  const a = read('kids/assets/kids-app.js');
  const kur = a.match(/function kur\(\) \{[\s\S]*?\n  \}/)[0];
  assert.ok(kur.indexOf('kimOynuyor()') > -1 && kur.indexOf('kimOynuyor()') < kur.indexOf('bulutAc(o.token)'), 'liste varsa önce "Kim oynuyor?"');
  assert.match(kur, /eskiOturumuTasi\(o\)/, 'eski tek oturum listeye taşınır');
  assert.doesNotMatch(kur, /return panel\(\)/, 'örnek okul da doğrudan girmez');
  assert.match(a, /kimOnay\(o\[0\], o\[1\], o\[4\], function \(\) \{ S\.ogr = o; girisSifre\(\); \}/, 'sınıf listesinde yüze dokununca ad sorulur');
  assert.match(a, /kimOnay\(x\.ad, x\.hayvan, x\.renk, function \(\) \{ cihazGir\(x\); \}/, 'cihaz listesinde de');
  assert.match(a, /SES\.soyle\(soru, 'tr'\)/, 'Acadia soruyu söyler');
  assert.match(a, /CIHAZ_MAX = 12/);
  assert.match(a, /data-kim aria-label/, 'üst çubuktaki ad/yüz çocuk değiştirir');
  assert.match(a, /veliKapisi\(function \(\) \{ kimOynuyor\(true\); \}\)/, 'listeden silmek büyükler kapısının arkasında');
  assert.match(a, /if \(x && x\.id && er\.tur !== 'lisans'\) return evAc\(\{ kod: x\.kod, ogr: x\.id \}, null\)/, 'oturumu bitmiş çocuk yalnız gizli resimlerini seçer');
  assert.match(a, /function cihazSil\(x\) \{ if \(x\.token\) B\.cikis\(x\.token\);/, 'listeden çıkan çocuğun oturumu kapanır');
  for (const y of ['C.avatar(o[1], o[4])', 'C.avatar(S.ogr[1], S.ogr[4])', 'C.avatar(x.hayvan, x.renk)', 'S.ogr[4]); }']) assert.ok(a.includes(y), y);
});

test('renk her yerde: öğretmen, tahta, yönetici, admin, kartlar', () => {
  assert.equal((read('kids/assets/kids-ogretmen.js').match(/C\.avatar\((x\.)?og\[1\], (x\.)?og\[4\]\)/g) || []).length, 4);   /* 26.11.2026: + sınıf nabzındaki yüzler */
  assert.ok(read('kids/assets/kids-tahta.js').includes('C.avatar(ogr[i].hayvan, ogr[i].renk)'));
  assert.ok(read('kids/assets/kids-yonetici.js').includes('C.avatar(g.hayvan, g.renk)'));
  assert.equal((read('js/admin-kids.js').match(/ciz\('avatar', g\.hayvan, g\.renk\)/g) || []).length, 2);
  const c = ctx(['kids/assets/kids-ciz.js', 'kids/assets/kids-qr.js', 'kids/assets/kids-kart.js']);
  const s = c.KIDS_KART.sayfa({ kod: 'AK-2026', ad: 'K' }, [{ id: '00000000-0000-0000-0000-000000000001', ad: 'Ada K.', hayvan: 'kedi', renk: 4, sifre: ['top', 'ay'], kimlik: 'AK-2026-001', sinif_id: 's1' }], [{ id: 's1', ad: 'Güneş' }]);
  assert.match(s, /Resmin: <b>Mavi kedi<\/b>/);
  assert.equal(read('js/kids-kart.js').split('\n').slice(2).join('\n'), read('kids/assets/kids-kart.js').split('\n').slice(2).join('\n'), 'js/kids-kart.js kopyası güncel');
});

test('SQL: tetikleyici her ekleme yolunu kapsar; var olanların hayvanı değişmez; çıktılarda renk', () => {
  const m = read(MIG);
  assert.match(m, /add column if not exists renk smallint not null default 0/);
  assert.match(m, /check \(renk between 0 and 7\)/);
  assert.match(m, /before insert or update of sinif_id, aktif on public\.kids_ogrenciler/);
  assert.match(m, /pg_advisory_xact_lock/, 'aynı sınıfa eşzamanlı eklemede çakışma yok');
  assert.match(m, /partition by sinif_id, hayvan/, 'var olanlara yalnız renk verilir');
  assert.doesNotMatch(m.split('-- renk alanını döndüren')[0], /set hayvan/, 'eski çocukların hayvanı değişmez');
  for (const f of ['kids_okul_bul', 'kids_okul_detay', 'kids_durum', 'kids_ogretmen_veri', 'kids_yonetici_veri']) {
    const g = m.match(new RegExp('function public\\.' + f + '\\([\\s\\S]*?end \\$\\$;'));
    assert.ok(g && g[0].includes("'renk', g.renk"), f);
  }
  assert.match(m, /revoke all on function public\.kids_yuz_sec\(uuid, uuid\) from public/);
  assert.match(read('tests/kids-kres.js'), /kids-yuz\.sql/, 'davranış testi çalışıyor');
});

summary();
