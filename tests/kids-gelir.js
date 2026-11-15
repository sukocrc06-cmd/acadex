/* ==========================================================================
   ACADEX — ACADEX KIDS GELİR MODELİ (tests/kids-gelir.js), 15.11.2026

   NEDEN VAR: Finans › Kids sekmesi kreşlere kontenjan paketi (Mini 30 · Standart 60 · Büyük 100 ·
   Kampüs özel) satar: aylık / 6 aylık / yıllık dönem, erken kayıt ve referans indirimi, teklif →
   protokol → imza (okul lisanslı açılır) → taksitli tahsilat; satış hunisi ve 31 Aralık'a kadar
   yol haritası (supabase/migrations/20261115b_kids_gelir.sql, js/admin-finans-kids.js). Korunan:
     - tarayıcıdaki önizleme sunucu hesabıyla aynı sonucu verir (aynı örnekler, tests/sql/kids-gelir.sql)
     - taksitlerin toplamı genel toplama eşit, kalan kuruş sonuncuda
     - protokol TASLAK uyarısı taşır; KVKK'da kreş veri sorumlusu, Acadex veri işleyen; çocuk verisi en az
     - yetki: yalnız fin_ok() (yönetici + finans ekibi); tablolar doğrudan okunamaz
   Çalıştırma:  node tests/kids-gelir.js
                ACADEX_PG="-h /tmp/kpg -p 5499 -U postgres" node tests/kids-gelir.js
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
const SQL = 'supabase/migrations/20261115b_kids_gelir.sql';
const FIYAT = 'supabase/migrations/20261115c_kids_fiyat.sql';

function yukle() {
  const DT = (d) => { const p = String(d).slice(0, 10).split('-'); return p[2] + '.' + p[1] + '.' + p[0]; };
  const c = { console, AXADM: { X: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])), NF: String, DT, $: () => null, $$: () => [] } };
  c.window = c; vm.createContext(c); vm.runInContext(read('js/admin-finans-kids.js'), c);
  c.AXFIN_KIDS_TEST.kur({ TL: (k) => (Number(k) / 100).toFixed(2) + ' TL' });
  return c.AXFIN_KIDS_TEST;
}
const AYAR = { indirim_6ay: 10, indirim_yil: 20, erken_yuzde: 10, erken_bitis: '2026-12-31', referans_yuzde: 10, ek_indirim_ust: 15, kdv: 20, hedef_tarih: '2026-12-31', hedef_kres: 10, hedef_tahsilat_kurus: 15000000 };
const PAKET = [{ kod: 'mini', ad: 'Mini', kota: 30, aylik_kurus: 2750000, alti_ay_kurus: 2550000, yil_kurus: 2450000, ozel: false, aktif: true },
  { kod: 'standart', ad: 'Standart', kota: 60, aylik_kurus: 2750000, alti_ay_kurus: 2550000, yil_kurus: 2450000, ozel: false, aktif: true },
  { kod: 'buyuk', ad: 'Büyük', kota: 100, aylik_kurus: 2750000, alti_ay_kurus: 2550000, yil_kurus: 2450000, ozel: false, aktif: true }, { kod: 'kampus', ad: 'Kampüs', kota: 300, aylik_kurus: 0, alti_ay_kurus: 0, yil_kurus: 0, ozel: true, aktif: true }];

test('önizleme hesabı sunucuyla aynı (aynı örnekler: tests/sql/kids-gelir.sql)', () => {
  const T = yukle();
  /* 20261115c: aylık 27.500 · 6 aylık ayda 25.500 · yıllık ayda 24.500 TL (KDV hariç) */
  let h = T.hesap(AYAR, PAKET, { paket: 'mini', donem: 'yil', erken: true, tarih: '2026-12-01', taksit: 3 });
  assert.equal(h.liste, 33000000); assert.equal(h.ind[0].kurus, 3600000); assert.equal(h.ind[0].ad, 'Yıllık plan (ayda 24.500 TL)');
  assert.equal(h.net, 26460000); assert.equal(h.kdv, 5292000); assert.equal(h.toplam, 31752000); assert.equal(h.taksit, 3); assert.equal(h.ind.length, 2); assert.equal(h.donemAylik, 2450000);
  h = T.hesap(AYAR, PAKET, { paket: 'mini', donem: 'aylik', erken: true, tarih: '2027-01-05', taksit: 3 });
  assert.equal(h.net, 2750000); assert.equal(h.erken, false); assert.equal(h.taksit, 1); assert.equal(h.ind.length, 0);
  assert.equal(T.hesap(AYAR, PAKET, { paket: 'mini', donem: '6ay' }).net, 2550000 * 6);
  assert.match(T.hesap(AYAR, PAKET, { paket: 'kampus', donem: 'yil' }).hata, /Kampüs/);
  h = T.hesap(AYAR, PAKET, { paket: 'kampus', donem: 'aylik', ozel_aylik_kurus: 800000, ogrenci: 420 }); assert.equal(h.net, 800000); assert.equal(h.kota, 420);
  assert.match(T.hesap(AYAR, PAKET, { paket: 'mini', donem: 'aylik', ek_yuzde: 40 }).hata, /Ek indirim/);
  assert.equal(T.hesap(AYAR, PAKET, { paket: 'mini', donem: 'aylik', ref_kod: 'ref-2026' }).net, 2475000);
  /* SQL de aynı rakamları bekliyor */
  const s = read('tests/sql/kids-gelir.sql');
  for (const n of ['33000000', '3600000', '26460000', '5292000', '31752000', '2475000']) assert.ok(s.includes(n), n);
  const c = read(FIYAT);
  assert.match(c, /update public\.kids_paketler set aylik_kurus = 2750000, alti_ay_kurus = 2550000, yil_kurus = 2450000/, 'kreş fiyatları: 27.500 / 25.500 / 24.500 TL');
});

test('taksit takvimi: toplam korunur, kalan sonuncuda, 2 taksit 6 ay, 3 taksit 4 ay arayla', () => {
  const T = yukle();
  const t3 = T.takvim(3618433, 3, '2026-12-01');
  assert.deepEqual(Array.from(t3, (x) => x.vade), ['2026-12-01', '2027-04-01', '2027-08-01']);
  assert.equal(t3.reduce((a, x) => a + x.tutar, 0), 3618433); assert.equal(t3[2].tutar - t3[0].tutar, 1);
  assert.deepEqual(Array.from(T.takvim(1000, 2, '2026-12-15'), (x) => x.vade), ['2026-12-15', '2027-06-15']);
  assert.equal(T.takvim(500, 1, '2026-12-01').length, 1);
  assert.match(read(SQL), /aralik := case t\.taksit when 2 then 6 when 3 then 4 else 0 end/, 'sunucu aynı aralıkları kullanır');
});

test('pano sayıları: aylık gelir, tahsil, gecikme, huni', () => {
  const T = yukle();
  const v = { bugun: '2026-12-20', ayar: AYAR, paketler: PAKET, okullar: [],
    istekler: [{ durum: 'bekliyor' }, { durum: 'arandi' }, { durum: 'teklif' }, { durum: 'onaylandi' }, { durum: 'reddedildi' }],
    teklifler: [
      { t: { durum: 'imzalandi', donem: 'yil', net_kurus: 1200000, baslangic: '2026-12-01', bitis: '2027-11-30', imza_at: '2026-12-02T10:00:00Z' }, tahsilat: [{ tutar_kurus: 720000, vade: '2026-12-01', odendi_at: '2026-12-03T09:00:00Z' }, { tutar_kurus: 720000, vade: '2027-06-01', odendi_at: null }] },
      { t: { durum: 'imzalandi', donem: 'aylik', net_kurus: 149000, baslangic: '2026-12-10', bitis: '2027-01-09', imza_at: '2026-12-09T10:00:00Z' }, tahsilat: [{ tutar_kurus: 178800, vade: '2026-12-10', odendi_at: null }] },
      { t: { durum: 'gonderildi', donem: '6ay', net_kurus: 1, baslangic: '2027-01-01', bitis: '2027-06-30' }, tahsilat: [] }] };
  const s = T.sayilar(v);
  assert.equal(s.imzali.length, 2); assert.equal(Math.round(s.mrr), 100000 + 149000);
  assert.equal(s.tahsil, 720000); assert.equal(s.bekleyen, 898800); assert.equal(s.gecikenN, 1); assert.equal(s.geciken, 178800);
  assert.deepEqual(Array.from(s.huni, (h) => h[1]), [5, 3, 3, 2, 0]); assert.equal(s.imzaHedefe, 2);
});

test('teklif ve protokol belgeleri: taslak uyarısı, KVKK rolleri, ödeme takvimi', () => {
  const T = yukle();
  const x = { t: { no: 7, kres_ad: 'Lale <Kreşi>', yetkili_ad: 'Ayşe K.', eposta: 'a@b.co', tel: '', il: 'Ankara', ilce: 'Çankaya', paket: 'buyuk', donem: 'yil', kota: 100, taksit: 2, aylik_kurus: 349000, liste_kurus: 4188000,
    indirimler: [{ ad: 'Yıllık dönem', yuzde: 20, kurus: 837600 }], net_kurus: 3350400, kdv_kurus: 670080, toplam_kurus: 4020480, baslangic: '2026-12-01', bitis: '2027-11-30', created_at: '2026-11-20T10:00:00Z', erken: false, notlar: '' },
    tahsilat: [{ sira: 1, vade: '2026-12-01', tutar_kurus: 2010240 }, { sira: 2, vade: '2027-06-01', tutar_kurus: 2010240 }] };
  const v = { ayar: AYAR, paketler: PAKET };
  const tk = T.belgeHtml('teklif', x, v), pr = T.belgeHtml('protokol', x, v);
  assert.match(tk, /Kreşinize özel teklif/); assert.match(tk, /tarihine kadar geçerlidir/); assert.match(tk, /2\. ödeme/);
  assert.ok(tk.includes('Lale &lt;Kreşi&gt;') && !tk.includes('Lale <Kreşi>'), 'kaçışlı');
  assert.match(pr, /TASLAK — hukuk danışmanı kontrolünden geçmeden imzaya açmayın/);
  assert.match(pr, /<b>Kreş veri sorumlusu<\/b>, Acadex <b>veri işleyen<\/b>dir/);
  assert.match(pr, /çocuğun adı ve soyadının baş harfi, sınıfı/); assert.match(pr, /en çok <b>100 çocuk<\/b>/);
  assert.match(pr, /\[Acadex şirket unvanı\]/, 'doldurulacak alanlar köşeli parantezli');
  assert.doesNotMatch(tk + pr, /ücretsiz deneme/i);
});

test('panel bağlantısı ve yetki', () => {
  const f = read('js/admin-finans.js'), h = read('admin.html'), m = read(SQL);
  assert.match(f, /\['rapor', 'Rapor'\], \['kids', 'Kids'\]\]/);
  assert.match(f, /return window\.AXFIN_KIDS\(box, \{/);
  assert.ok(h.indexOf('js/admin-finans.js') < h.indexOf('js/admin-finans-kids.js') && h.includes('css/admin-finans-kids.css'));
  for (const fn of ['kids_teklif_hesap', 'kids_teklif_kaydet', 'kids_teklif_durum', 'kids_teklif_imzala', 'kids_tahsilat_isaretle', 'kids_gelir_ayar_kaydet', 'kids_paket_kaydet', 'kids_gelir_ozet', 'kids_gelir_yol_kur']) {
    const g = m.match(new RegExp('function public\\.' + fn + '\\([\\s\\S]*?end \\$\\$;'));
    assert.ok(g && /perform public\.kids_fin_guard\(\);/.test(g[0]), fn + ' fin_ok ile korunmalı');
    assert.ok(m.includes("'" + fn + '('), fn + ' yetki listesinde');
  }
  assert.match(m, /execute format\('revoke all on public\.%I from anon, authenticated', t\)/, 'tablolar doğrudan okunamaz');
  const j = read('js/admin-finans-kids.js');
  for (const fn of ['kids_gelir_ozet', 'kids_teklif_kaydet', 'kids_teklif_durum', 'kids_teklif_imzala', 'kids_tahsilat_isaretle', 'kids_gelir_ayar_kaydet', 'kids_paket_kaydet', 'kids_gelir_yol_kur']) assert.ok(j.includes("'" + fn + "'"), fn + ' panelde');
  assert.equal((m.match(/\('Kids · /g) || []).length, 17, 'yol haritası 17 iş');
  assert.ok([...m.matchAll(/date '(2026-1[12]-\d\d)', '/g)].every((x) => x[1] <= '2026-12-31'), 'hepsi 31 Aralık\'a kadar');
});

test('davranış (gerçek Postgres): hesap, teklif, imza, taksit, ödendi, yol haritası, yetki', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1', q = (f) => JSON.stringify(path.join(ROOT, f));
  execSync(P + ' -d postgres -c "drop database if exists ax_gelir" -c "create database ax_gelir"', { stdio: 'pipe' });
  try {
    for (const f of ['tests/sql/kids-yonetim-stub.sql', 'tests/sql/kids-gelir-stub.sql', 'supabase/migrations/20261110_kids_yonetim.sql', 'supabase/migrations/20261110b_kids_giris.sql',
      'supabase/migrations/20261112c_kids_temalar_ve_sertlestirme.sql', 'supabase/migrations/20261112d_kids_oturum_yonetimi.sql', 'supabase/migrations/20261114_kids_kres.sql',
      'supabase/migrations/20261114b_kids_yuz.sql', 'supabase/migrations/20261115_kids_istek.sql', SQL, SQL, FIYAT, FIYAT]) execSync(P + ' -d ax_gelir -f ' + q(f), { stdio: 'pipe' });
    const out = execSync(P + ' -d ax_gelir -f ' + q('tests/sql/kids-gelir.sql') + ' 2>&1').toString();
    assert.match(out, /GELIR AKIS GECTI/); assert.match(out, /GELIR YETKI GECTI/);
  } finally { execSync(P + ' -d postgres -c "drop database if exists ax_gelir"', { stdio: 'pipe' }); }
});

summary();
