/* ==========================================================================
   ACADEX — ECZACILIK LAB ve HEMŞİRELİK LAB (tests/eczacilik-hemsirelik.js)

   NEDEN VAR (01.11.2026): MedLab'e iki yeni bölüm eklendi.
     Eczacılık Lab (labs/eczacilik/): eczane tezgâhı (reçete → raf → profil →
       müdahale → danışmanlık), doz hesap masası (şurup, tablet, Cockcroft-Gault,
       infüzyon, sulandırma), etkileşim ağı ve çift testi, majistral laboratuvarı.
     Hemşirelik Lab (labs/hemsirelik/): hasta başı (vital + NEWS2 + hemşirelik
       süreci), beceri istasyonları, ilaç uygulama (doğru ilkeleri, damla/pompa),
       servis vardiyası (öncelik, olay, SBAR).
     Acadex Medica: 6. kat hastane eczanesi, 7. kat dahiliye servisi; vaka masası
       sonucu hastaneye bildirir.
   Bu test hesapların doğruluğunu (NEWS2 RCP 2017, Cockcroft-Gault, damla/pompa),
   verinin tutarlılığını ve sayfaların bağlantısını tutar.

   Calistirma:  node tests/eczacilik-hemsirelik.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const E = require(path.join(ROOT, 'labs/eczacilik/ecz-veri.js'));
const H = require(path.join(ROOT, 'labs/hemsirelik/hem-veri.js'));
const SE = require(path.join(ROOT, 'labs/klinik/senaryo-eczacilik.js'));
const SH = require(path.join(ROOT, 'labs/klinik/senaryo-hemsirelik.js'));
const K = require(path.join(ROOT, 'labs/klinik/klinik.js'));
const tekDogru = (L, i) => L.filter((o) => o[i]).length;

test('Eczacılık: ilaç rafı ve etkileşim ağı tutarlı, simetrik ve dereceye göre sıralı', () => {
  const ids = E.ILAC.map((x) => x.id); assert.equal(new Set(ids).size, ids.length);
  for (const x of E.ILAC) { assert.ok(['normal', 'kirmizi', 'yesil'].includes(x.rec), x.id); assert.ok(x.mek && x.uyari && x.kullanim, x.id); }
  assert.equal(E.ilac('alprazolam').rec, 'yesil'); assert.equal(E.ilac('morfin').rec, 'kirmizi');
  for (const e of E.ETK) { assert.ok(E.dugum(e.a) && E.dugum(e.b), e.a + '|' + e.b); assert.ok(E.DERECE[e.derece], e.derece); assert.equal(E.etkilesim(e.b, e.a), e); }
  assert.equal(E.etkilesim('simvastatin', 'klaritromisin').derece, 'kontrendike');
  assert.equal(E.etkilesim('sildenafil', 'nitrogliserin').derece, 'kontrendike');
  assert.equal(E.etkilesim('parasetamol', 'amlodipin'), null);
  const t = E.tara(['levotiroksin', 'kalsiyum', 'simvastatin', 'klaritromisin']);
  assert.deepEqual(t.map((x) => x.derece), ['kontrendike', 'orta']);
});

test('Eczacılık: tezgâh reçeteleri — doğru bulgu seçeneklerde, doz vakası mg/kg ile tutarlı', () => {
  assert.ok(E.RECETE.length >= 8);
  for (const r of E.RECETE) {
    for (const s of r.satir) assert.ok(E.ilac(s[0]), r.id + ' ' + s[0]);
    for (const m of r.mevcut) assert.ok(E.ilac(m), r.id + ' ' + m);
    assert.ok(E.SORUN_SEC(r).some((o) => o[0] === r.sorun), r.id + ' sorun seçeneklerde');
    assert.ok(E.MUDAHALE.some((m) => m[0] === r.mudahale) && E.GECERLI.some((g) => g[0] === r.gecerli), r.id);
    assert.ok(r.danisma.some((d) => d[1]) && r.danisma.some((d) => !d[1]), r.id + ' danışmanlıkta doğru ve yanlış');
    if (/^etk:/.test(r.sorun)) assert.ok(E.etkilesim(...r.sorun.slice(4).split('|')), r.id);
  }
  const yesil = E.RECETE.find((r) => r.sorun === 'tur'); assert.equal(E.ilac(yesil.satir[0][0]).rec, 'yesil');
  assert.equal(E.mgKgDoz(20, 120, 18), 26.7, '20 ml × 24 mg/ml ÷ 18 kg');
  assert.ok(E.mgKgDoz(20, 120, 18) > 15, 'şurup vakası gerçekten doz aşımı');
});

test('Eczacılık: doz hesapları (şurup, tablet, Cockcroft-Gault, infüzyon, sulandırma)', () => {
  assert.equal(Math.round(E.crcl(80, 54, 1, false)), 45);
  assert.equal(Math.round(E.crcl(80, 54, 1, true)), 38, 'kadında × 0,85');
  let s = 1; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 200; i++) for (const t of Object.keys(E.DOZ_TIP)) {
    const p = E.problem(t, r); assert.equal(p.tip, t); assert.ok(p.cevap > 0 && p.cozum.length >= 2 && p.veri.length >= 2, t);
    assert.ok(E.dogruMu(p, p.cevap) && E.dogruMu(p, p.cevap + p.tol) && !E.dogruMu(p, p.cevap + p.tol + 0.5) && !E.dogruMu(p, NaN), t);
    if (t === 'crcl') assert.equal(p.sinif, p.cevap >= 50 ? 'normal' : p.cevap >= 30 ? 'yari' : 'yok');
  }
  const q = E.problem('infuzyon', () => 0); /* 55 kg, 2 mcg/kg/dk, 400 mg/250 ml → 6,6 mg/saat ÷ 1,6 = 4,1 ml/saat */
  assert.equal(q.cevap, 4.1);
});

test('Eczacılık: majistral formüller (% a/a, % a/h, C₁V₁ = C₂V₂) ve tartım toleransı', () => {
  const m = Object.fromEntries(E.MAJ.map((x) => [x.id, E.majMiktar(x)]));
  assert.deepEqual(m.salisilik, [2, 98]); assert.deepEqual(m.lassar, [10, 10, 20]); assert.deepEqual(m.serum, [4.5, null]); assert.deepEqual(m.alkol, [72.92, null]);
  assert.equal(E.tartTol(2), 0.05); assert.equal(E.tartTol(98), 1.96);
  for (const x of E.MAJ) { assert.ok(x.adim.length >= 5); assert.ok(x.etiket.some((e) => e[1]) && x.etiket.some((e) => !e[1]), x.id); }
});

test('Hemşirelik: NEWS2 parametre sınırları ve klinik yanıt (RCP 2017)', () => {
  const sk = H.newsSkor;
  assert.deepEqual([8, 9, 11, 12, 20, 21, 24, 25].map(sk.sol), [3, 1, 1, 0, 0, 2, 2, 3]);
  assert.deepEqual([91, 92, 93, 94, 95, 96].map(sk.spo2), [3, 2, 2, 1, 1, 0]);
  assert.deepEqual([90, 91, 100, 101, 110, 111, 219, 220].map(sk.sis), [3, 2, 2, 1, 1, 0, 0, 3]);
  assert.deepEqual([40, 41, 50, 51, 90, 91, 110, 111, 130, 131].map(sk.nabiz), [3, 1, 1, 0, 0, 1, 1, 2, 2, 3]);
  assert.deepEqual([35, 35.1, 36, 36.1, 38, 38.1, 39, 39.1].map(sk.ates), [3, 1, 1, 0, 0, 1, 1, 2]);
  assert.deepEqual([sk.o2(true), sk.o2(false), sk.bilinc('A'), sk.bilinc('C'), sk.bilinc('V')], [2, 0, 0, 3, 3]);
  const n = (v) => H.news(Object.assign({ sol: 16, spo2: 98, o2: false, sis: 120, nabiz: 70, bilinc: 'A', ates: 36.8 }, v));
  assert.deepEqual([n({}).toplam, n({}).yanit], [0, 'sifir']);
  assert.equal(n({ nabiz: 95 }).yanit, 'dusuk');
  assert.equal(n({ bilinc: 'V' }).yanit, 'tek3', 'tek parametrede 3 → acil haber');
  assert.equal(n({ sol: 22, spo2: 93, nabiz: 95 }).yanit, 'orta');
  assert.equal(n({ sol: 26, spo2: 91, o2: true }).yanit, 'yuksek');
  const yanit = H.HASTA.map((h) => H.news(h.v).yanit);
  for (const y of ['sifir', 'dusuk', 'tek3', 'orta', 'yuksek']) assert.ok(yanit.includes(y), 'hasta başında her yanıt düzeyi var: ' + y);
});

test('Hemşirelik: hasta başı, beceriler, ilaç uygulama ve servis verisi tutarlı', () => {
  for (const h of H.HASTA) { assert.equal(tekDogru(h.tanilar, 1), 1, h.id); assert.ok(h.girisim.some((g) => g[1]) && h.girisim.some((g) => !g[1]), h.id); }
  for (const b of H.BECERI) {
    assert.ok(b.adim.length >= 7 && /tanı|doğrula/i.test(b.adim[0]), b.id + ' hasta kimliğiyle başlar');
    for (const k of b.karar) assert.equal(tekDogru(k.o, 1), 1, b.id);
    if (b.bolge) assert.ok(b.bolge.L.some((p) => p[0] === b.bolge.dogru), b.id);
  }
  assert.equal(H.BECERI.find((b) => b.id === 'im').bolge.dogru, 'vg', 'erişkinde ventrogluteal');
  const dg = H.DOGRU.map((d) => d[0]);
  for (const u of H.UYG) { assert.ok(u.hata.length && u.hata.every((x) => dg.includes(x)), u.id); if (u.hata.includes('yok')) assert.equal(u.hata.length, 1); }
  assert.ok(H.UYG.find((u) => /Potasyum/.test(u.istem[0])).hata.includes('yol'), 'KCl doğrudan verilmez');
  assert.equal(Math.round(H.damla(1000, 480, 20)), 42); assert.equal(H.damla(250, 300, 60), 50); assert.equal(H.pompa(1000, 8), 125);
  for (let i = 0; i < 100; i++) { const p = H.hizProblem(); assert.ok(p.cevap > 0 && p.cozum.length === 2, p.tip); }
  const ids = H.SERVIS.map((x) => x.id).slice(0, 5);
  assert.equal(H.siraPuan(H.dogruSira(ids)), 1); assert.equal(H.siraPuan(H.dogruSira(ids).reverse()), 0);
  for (const x of H.SERVIS) { assert.equal(tekDogru(x.olay.o, 1), 1, x.id); for (const L of 'SBAR') assert.ok(x.sbar[L], x.id + ' ' + L); }
});

test('Acadex Medica: eczane ve servis hastaları vaka dosyasıyla aynı kişi, şema temiz', () => {
  for (const [L, V, lab] of [[SE, E, 'eczacilik'], [SH, H, 'hemsirelik']]) {
    assert.equal(L.length, 8);
    for (const s of L) {
      assert.deepEqual(K.denetle(s), [], s.id); assert.equal(s.lab, lab);
      const v = V.VAKA.find((x) => x.id === s.vaka); assert.ok(v, s.id + ' vaka dosyası');
      assert.equal(v.ad, s.hasta.hitap, s.id + ' ad'); assert.equal(v.yas, s.hasta.yas + ' yaş', s.id + ' yaş');
    }
    for (const v of V.VAKA) { assert.equal(tekDogru(v.tani, 2), 1, v.id); assert.ok(v.deg.some((o) => o[2]) && v.terapi.some((o) => o[2]) && v.terapi.some((o) => !o[2]), v.id); }
  }
  for (const s of SH) { assert.equal(s.oda, 'servis'); assert.equal(s.hasta.poz, 'yat'); assert.ok(s.vital, s.id + ' monitör'); }
  for (const s of SE) assert.equal(s.oda, 'eczane');
  const kl = read('labs/klinik/klinik.js'); assert.match(kl, /    eczane: function \(\) \{/); assert.match(kl, /    servis: function \(\) \{/); assert.match(kl, /oda === 'servis'/);
});

test('sayfalar: betik sırası, sekmeler, vaka sonucu hastaneye, ?ad= ile yeni ad', () => {
  for (const [dir, ns, mods] of [['eczacilik', 'EC', ['ecz-veri', 'ecz-app', 'ecz-tezgah', 'ecz-doz', 'ecz-etkilesim', 'ecz-majistral', 'ecz-vaka']], ['hemsirelik', 'HM', ['hem-veri', 'hem-app', 'hem-yatak', 'hem-beceri', 'hem-ilac', 'hem-servis', 'hem-vaka']]]) {
    const h = read('labs/' + dir + '/index.html'), at = (f) => h.indexOf('src="' + f + '.js"');
    mods.forEach((m, i) => { assert.ok(at(m) > 0, m); if (i) assert.ok(at(mods[i - 1]) < at(m), m + ' sırası'); });
    assert.match(h, /<html lang="tr">/); assert.match(h, /@media \(prefers-reduced-motion:reduce\)/); assert.match(h, /role="tablist"/);
    for (const m of mods.slice(2)) { const js = read('labs/' + dir + '/' + m + '.js'); assert.match(js, new RegExp(ns + '\\.st\\.[a-z]+ = \\{')); }
    const v = read('labs/' + dir + '/' + mods[6] + '.js');
    assert.match(v, new RegExp("src: 'axmedica', type: 'sonuc', lab: '" + dir + "'"));
    assert.match(v, /var MAD = C\.MEDICA \? Q\.get\('ad'\) : null;/);
    assert.match(read('labs/' + dir + '/' + mods[1] + '.js'), /var TABS = MEDICA \? \[[^\]]+'vaka'\] : \[[^\]]+\];/);
  }
});

summary();
