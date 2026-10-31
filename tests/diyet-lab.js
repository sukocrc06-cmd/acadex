/* ==========================================================================
   ACADEX — MEDLAB DİYET LAB TESTLERİ (tests/diyet-lab.js)

   NEDEN VAR (29.10.2026): MedLab'e beslenme ve diyetetik öğrencileri için Diyet Lab eklendi
   (labs/diyet/): tabak & menü analizi, antropometri, klinik vaka masası, enteral/parenteral.
   Klinik ve sayısal doğruluk bu testlerle korunur:
     - besin verisi USDA SR28'den; enerji Atwater hesabıyla tutarlı; gluten bayrakları doğru
     - Mifflin-St Jeor, Harris-Benedict, BKİ ve WHO bel sınırları bilinen değerleri verir
     - menü görevleri: kriter sağlanınca geçer, gluten görevi glutenli besini yakalar
     - vaka anahtarları kılavuzlarla aynı (KDOQI 2020, ESPEN 2019, NRS-2002); kusursuz reçete 100,
       diyalizde ve sirozda protein kısıtlaması yanlış sayılır
     - TPN hesabı (enerji, glukoz infüzyon hızı, lipid g/kg) ve yeniden beslenme sınırı (≤10 kcal/kg)
     - MedLab kartı, katman kaydı ve Acadia köprüsü Diyet Lab'i tanır; animasyon hareket tercihine bağlı
   31.10.2026 (diyetisyen raporu v1): antropometride formül seçimi (Mifflin / Harris-Benedict), Schofield ve
   ateş katsayısı, WHO 2007 yaşa göre BKİ z-skoru, 4 yeni vaka (pediatrik obezite, osteomiyelit + ateş,
   nefrotik sendrom, gut + diyabet) ve besin değişim tablosu (TÜBER 2022 değerleri).
   Çalıştırma:  node tests/diyet-lab.js
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
const ctx = { window: {} }; vm.runInNewContext(read('labs/diyet/data/besin.js'), ctx); vm.runInNewContext(read('labs/diyet/data/who2007-bki.js'), ctx);
const AXDB = ctx.window.AXDB;
const M = require(path.join(ROOT, 'labs/diyet/diyet-model.js'));
M.load(AXDB);

test('besin verisi: USDA SR28 kaynağı, ≥80 besin, enerji Atwater ile tutarlı, gluten bayrakları', () => {
  assert.match(read('labs/diyet/data/besin.js'), /USDA ARS, National Nutrient Database for Standard Reference, Release 28/);
  assert.ok(AXDB.besin.length >= 80 && AXDB.tarif.length >= 8);
  for (const b of AXDB.besin) {
    for (const k of ['kcal', 'pro', 'yag', 'kh', 'na']) assert.equal(typeof b.n[k], 'number', b.id + ' ' + k);
    assert.ok(b.ol.length && b.ol.every((o) => o[1] > 0), b.id + ' ev ölçüsü');
    /* genel Atwater 4-4-9; USDA sebze-meyvede besine özgü (daha düşük) katsayı kullanır → daha geniş pay */
    if (b.n.kcal > 60) { const at = 4 * b.n.pro + 4 * b.n.kh + 9 * b.n.yag, tol = /sebze|meyve/.test(b.kat) ? 0.2 : 0.1; assert.ok(Math.abs(at - b.n.kcal) / b.n.kcal < tol, b.id + ' Atwater ' + at + ' / ' + b.n.kcal); }
  }
  const by = M.DB.by;
  for (const id of ['ekmek', 'tamekmek', 'cavdar', 'bulgur', 'makarna', 'kraker', 'biskuvi', 'un']) assert.match(by[id].b, /g/, id + ' gluten');
  for (const id of ['pirinc', 'patates', 'mercimek', 'yumurta', 'elma']) assert.doesNotMatch(by[id].b || '', /[gy]/, id + ' glutensiz');
  assert.match(by.yulaf.b, /y/); assert.match(by['t-kofte'].b, /g/, 'köfte tarifi ekmek içiyle gluten taşır');
  assert.ok(by.beyazpeynir.n.na > 900 && by.tuz.n.na > 38000, 'sodyum kaynakları');
  const t = by['t-mercimekcorba']; assert.ok(t.ol[0][1] > 250 && t.n.kcal * t.ol[0][1] / 100 > 150 && t.n.kcal * t.ol[0][1] / 100 < 220, 'mercimek çorbası porsiyonu');
});
test('formüller: Mifflin-St Jeor, Harris-Benedict, BKİ sınıfı ve WHO bel sınırları', () => {
  assert.equal(M.bmh.mifflin({ kg: 70, cm: 175, yas: 30, cins: 'E' }), 1648.75);
  assert.equal(M.bmh.mifflin({ kg: 60, cm: 165, yas: 30, cins: 'K' }), 1320.25);
  assert.ok(Math.abs(M.bmh.harris({ kg: 70, cm: 175, yas: 30, cins: 'E' }) - 1701.9) < 0.1);
  assert.equal(M.bkiSinif(18.4), 'zayif'); assert.equal(M.bkiSinif(24.9), 'normal'); assert.equal(M.bkiSinif(25), 'fazla'); assert.equal(M.bkiSinif(30), 'obez1'); assert.equal(M.bkiSinif(40), 'obez3');
  assert.equal(M.belRisk('E', 93), 'yok'); assert.equal(M.belRisk('E', 94), 'artmis'); assert.equal(M.belRisk('E', 102), 'cok'); assert.equal(M.belRisk('K', 80), 'artmis'); assert.equal(M.belRisk('K', 88), 'cok');
  const H = M.hedef({ kcal: 2000, cins: 'K', yas: 30, kg: 60 });
  assert.equal(H.kh.min, 225); assert.equal(H.kh.max, 300); assert.equal(H.na.max, 2000); assert.equal(H.fe.min, 16); assert.equal(H.lif.min, 25);
});
test('menü görevleri: kriterler, enerji dağılımı ve gluten yakalama', () => {
  const kahv = [{ id: 'tamekmek', g: 60 }, { id: 'yumurta', g: 100 }, { id: 'lor', g: 40 }, { id: 'domates', g: 120 }, { id: 'biber', g: 40 }, { id: 'ceviz', g: 15 }];
  const s = M.analiz(kahv), g = M.GOREV.find((x) => x.id === 'g-kahvalti');
  assert.ok(Math.abs(s.e.kh + s.e.pro + s.e.yag - 100) < 6, 'enerji yüzdeleri toplamı ≈100');
  assert.equal(M.gorevPuan(g, s, kahv).puan, 100);
  const gc = M.GOREV.find((x) => x.id === 'g-colyak'), r = M.gorevPuan(gc, s, kahv);
  assert.equal(r.rows.find((x) => x.k === '!g').ok, false, 'tam buğday ekmeği glutenli');
  const tuzlu = kahv.concat([{ id: 'beyazpeynir', g: 60 }, { id: 'zeytin', g: 40 }]);
  assert.equal(M.gorevPuan(g, M.analiz(tuzlu), tuzlu).rows.find((x) => x.k === 'na').ok, false, 'peynir + zeytin sodyumu aşar');
});
test('antropometri: kusursuz form 100; bel ölçüm noktası ve BKİ yanılgısı', () => {
  for (const h of M.AH) {
    const T = M.antroTruth(h), f = { bki: T.bki, bkiS: T.bkiS, belS: T.bel, bko: T.bko, bmh: T.mifflin, tee: T.tee };
    assert.equal(M.antroPuan(h, { kg: h.kg, cm: h.cm, bel: h.bel, kalca: h.kalca, belYer: 'who' }, f).puan, 100, h.id);
    assert.equal(M.antroPuan(h, { kg: h.kg, cm: h.cm, bel: h.gobek, kalca: h.kalca, belYer: 'gobek' }, f).puan, 90, h.id + ' göbek hizası');
    assert.ok(h.gobek > h.bel, h.id);
  }
  const mert = M.AH.find((h) => h.id === 'a-mert'), T = M.antroTruth(mert);
  assert.equal(T.bkiS, 'fazla'); assert.equal(T.bel, 'yok', 'sporcu: BKİ yüksek ama bel normal');
  const hakan = M.antroTruth(M.AH.find((h) => h.id === 'a-hakan')); assert.equal(hakan.bel, 'cok'); assert.equal(hakan.bkoS, 'var');
});
test('vaka masası: anahtarlar kılavuzlarla aynı; kusursuz reçete 100; yaygın yanılgılar yakalanır', () => {
  assert.equal(M.VK.length, 11);
  const ideal = (v) => {
    const w = M.agirlik(v, v.ag[0]), abn = {}; v.lab.forEach((l, i) => { if (M.labDurum(l) !== 'N') abn[i] = true; });
    const kisit = {}; v.kisit.gerek.forEach((k) => { kisit[k] = true; }); const oneri = {}; v.oneri.gerek.forEach((k) => { oneri[k] = true; });
    const P = v.ped ? M.pedTruth(v) : null;
    return { flags: abn, nrs: v.nrs || {}, ag: v.ag[0], kcal: (v.kcal[0] + v.kcal[1]) / 2, pro: v.proG ? (v.proG[0] + v.proG[1]) / 2 : Math.round((v.pro[0] + v.pro[1]) / 2 * w), kisit, oneri, oncelik: v.dogru,
      esit: v.esit ? v.esit[0] : undefined, pedZ: P ? P.z : undefined, pedS: P ? P.s : undefined };
  };
  globalThis.__idealVaka = ideal;
  for (const v of M.VK) {
    assert.ok(v.oncelik[v.dogru] && v.not, v.id);
    for (const k of v.kisit.gerek.concat(v.kisit.yasak)) assert.ok(M.KISIT[k], v.id + ' ' + k);
    assert.equal(M.vakaPuan(v, ideal(v)).puan, 100, v.id);
    assert.ok(M.vakaPuan(v, Object.assign(ideal(v), { oncelik: (v.dogru + 1) % 4 })).puan < 100, v.id + ' öncelik');
  }
  const V = (id) => M.VK.find((v) => v.id === id);
  assert.deepEqual(V('v-kbh').pro, [0.55, 0.6], 'KDOQI 2020: diyaliz öncesi 0,55–0,6 g/kg');
  assert.deepEqual(V('v-hd').pro, [1.0, 1.2], 'KDOQI 2020: diyalizde 1,0–1,2 g/kg');
  const s = V('v-siroz'); assert.deepEqual(s.pro, [1.2, 1.5]); assert.ok(s.kcal[0] / 73 >= 32 && s.kcal[1] / 73 <= 38, 'ESPEN: ≈35 kcal/kg kuru ağırlık');
  for (const id of ['v-hd', 'v-siroz']) { const b = Object.assign(ideal(V(id)), { kisit: Object.assign({}, ideal(V(id)).kisit, { prokisit: true }) }); assert.ok(M.vakaPuan(V(id), b).puan < 100, id + ': protein kısıtlaması yanlış'); }
  const y = V('v-yasli'); assert.equal(y.nrs.durum + y.nrs.siddet + y.nrs.yas, 4, 'NRS-2002 = 4 (≥3 risk)');
  assert.equal(M.agirlik(s, 'kuru'), 73); assert.ok(Math.abs(M.duzKg(V('v-dm')) - 71.8) < 0.1, 'düzeltilmiş ağırlık');
});
test('BMH: formül seçimi, Schofield ve ateş katsayısı', () => {
  /* Schofield 1985 (kcal): kız 3–10: 20,315 W + 485,9; kız 10–18: 13,384 W + 692,6; erkek 18–30: 15,057 W + 692,2 */
  assert.ok(Math.abs(M.bmh.schofield({ kg: 15, yas: 5, cins: 'K' }) - 790.6) < 0.1);
  assert.ok(Math.abs(M.bmh.schofield({ kg: 50, yas: 10, cins: 'K' }) - 1361.8) < 0.1);
  assert.ok(Math.abs(M.bmh.schofield({ kg: 70, yas: 25, cins: 'E' }) - 1746.2) < 0.1);
  assert.equal(M.atesKat(0), 1); assert.ok(Math.abs(M.atesKat(1) - 1.13) < 1e-9, 'DuBois: 1 °C → %13');
  /* antropometri: seçilen formüle göre puanlanır */
  for (const h of M.AH) {
    const T = M.antroTruth(h), base = { bki: T.bki, bkiS: T.bkiS, belS: T.bel, bko: T.bko }, olc = { kg: h.kg, cm: h.cm, bel: h.bel, kalca: h.kalca, belYer: 'who' };
    assert.equal(M.antroPuan(h, olc, Object.assign({ formul: 'harris', bmh: T.harris, tee: T.teeH }, base)).puan, 100, h.id + ' HB');
    if (Math.abs(T.harris - T.mifflin) > 20) assert.ok(M.antroPuan(h, olc, Object.assign({ formul: 'harris', bmh: T.mifflin, tee: T.tee }, base)).puan < 100, h.id + ' HB seçiliyken Mifflin değeri yanlış');
  }
});
test('WHO 2007 yaşa göre BKİ: bilinen eşikler ve vaka sınıfları', () => {
  /* WHO 2007, 10 yaş kız: medyan 16,6; +1 SD 19,0; +2 SD 22,6; +3 SD 28,4 */
  assert.equal(M.bkiAtZ(0, 10, 'K').toFixed(1), '16.6'); assert.equal(M.bkiAtZ(1, 10, 'K').toFixed(1), '19.0');
  assert.equal(M.bkiAtZ(2, 10, 'K').toFixed(1), '22.6'); assert.equal(M.bkiAtZ(3, 10, 'K').toFixed(1), '28.4');
  assert.equal(M.lmsAt(4.9, 'K'), null, '5 yaş altı WHO 2007 kapsamı dışında');
  assert.equal(M.pedSinif(2.01), 'obez'); assert.equal(M.pedSinif(1.5), 'fazla'); assert.equal(M.pedSinif(-2.01), 'zayif'); assert.equal(M.pedSinif(-1.9), 'normal');
  assert.ok(Math.abs(M.ncdf(1.96) - 0.975) < 0.001);
  const V = (id) => M.VK.find((v) => v.id === id);
  const o = M.pedTruth(V('v-ped-obez')); assert.equal(o.s, 'obez'); assert.ok(o.z > 2.4 && o.z < 2.6 && o.p > 97, 'rapordaki >97 p');
  const a = M.pedTruth(V('v-ped-osteo')); assert.equal(a.s, 'normal'); assert.ok(a.z < -1.8 && a.z > -2, 'zayıflık eşiğine yakın');
  assert.ok(Math.abs(M.idealOf(V('v-ped-obez')) - 33) < 0.5, 'çocukta ideal ağırlık yaşa göre medyan BKİ ile');
});
test('yeni vakalar: kılavuz aralıkları ve yaygın yanılgılar', () => {
  const ideal = globalThis.__idealVaka, V = (id) => M.VK.find((v) => v.id === id);
  const n = V('v-nefrotik'); assert.deepEqual(n.pro, [0.8, 1.0], 'KDIGO 2021: 0,8–1,0 g/kg'); assert.ok(n.kisit.gerek.includes('na'));
  assert.equal(M.agirlik(n, 'kuru'), 71, 'ödemsiz ağırlık');
  assert.ok(M.vakaPuan(n, Object.assign(ideal(n), { pro: Math.round(1.5 * 71) })).puan < 100, 'yüksek protein yanlış');
  const g = V('v-gut-dm'), hb = Math.round(M.bmh.harris(g) * 1.6 - 500); assert.ok(hb >= g.kcal[0] && hb <= g.kcal[1], 'HB × 1,6 − 500 aralıkta: ' + hb);
  assert.ok(g.kisit.gerek.includes('purin') && g.oneri.gerek.includes('alkol'));
  const e = V('v-ped-obez'); assert.ok(e.kcal[0] >= 1500, 'çocukta sıkı kısıtlama yok'); assert.deepEqual(e.esit, ['schofield']);
  assert.ok(M.vakaPuan(e, Object.assign(ideal(e), { esit: 'mifflin' })).puan < 100, 'çocukta yetişkin eşitliği yanlış');
  assert.ok(M.vakaPuan(e, Object.assign(ideal(e), { pedS: 'fazla' })).puan < 100, 'yanlış persentil sınıfı');
  const d = V('v-ped-osteo'), est = M.bmhHesap('schofield', d, 1) * 1.3; assert.ok(est >= d.kcal[0] && est <= d.kcal[1], 'Schofield × ateş × 1,3 aralıkta: ' + Math.round(est));
  assert.ok(M.vakaPuan(d, Object.assign(ideal(d), { kisit: { sivi: true } })).puan < 100, 'ateşte sıvı kısıtlaması yanlış');
});
test('besin değişim tablosu: TÜBER 2022 değerleri, otomatik hesap, menü karşılığı', () => {
  const G = {}; M.DEG.forEach((g) => { G[g.k] = g; });
  assert.deepEqual([G.sut.kh, G.sut.pro, G.sut.yag, G.sut.kcal], [9, 6, 6, 114]);
  assert.deepEqual([G.et.pro, G.et.yag, G.et.kcal], [6, 5, 69]);
  assert.deepEqual([G.ekmek.kh, G.ekmek.pro, G.ekmek.kcal], [15, 2, 68]);
  assert.equal(G.meyve.kcal, 60); assert.equal(G.yag.kcal, 45); assert.equal(G.baklagil.kcal, 80); assert.equal(G.tohum.kcal, 53); assert.equal(G.sebze.kcal, 28);
  const h = { kcal: 1800, kh: 55, pro: 15, yag: 30 }, r = M.degisimOtomatik(h, { sut: 2, sebze: 3, meyve: 3 });
  assert.deepEqual([r.c.ekmek, r.c.et, r.c.yag], [11, 5, 4.5]);
  assert.equal(M.degisimKontrol(h, r.c).ok, true, 'otomatik plan hedefte');
  assert.equal(M.degisimKontrol(h, Object.assign({}, r.c, { yag: 12 })).ok, false, 'fazla yağ yakalanır');
  const m = M.menuDegisim([{ id: 'sut', g: 200 }, { id: 'ekmek', g: 50 }, { id: 'beyazpeynir', g: 30 }, { id: 't-mercimekcorba', g: 250 }]);
  assert.ok(Math.abs(m.sut - 1) < 0.25, 'bir bardak süt ≈ 1 değişim: ' + m.sut);
  assert.ok(m.ekmek >= 1.5 && m.ekmek <= 2, 'iki ince dilim ekmek ≈ 1,5–2 değişim: ' + m.ekmek);
  assert.ok(m.et > 0.5, 'peynir et grubunda');
  assert.ok(m.baklagil > 0.8, 'tarif bileşenlerine ayrılır');
});
test('enteral, TPN ve yeniden beslenme hesapları', () => {
  const h = M.tpnHesap({ dexPct: 50, dexMl: 376, aaPct: 10, aaMl: 900, lipMl: 250, kg: 60 });
  assert.equal(h.dexG, 188); assert.equal(h.aaG, 90); assert.equal(h.lipG, 50); assert.equal(h.kcal, 1499); assert.equal(h.gir, 2.2); assert.equal(h.lipKg, 0.83);
  const tpn = M.EP.find((c) => c.tip === 'tpn');
  assert.equal(M.epPuan(tpn, { dexPct: 50, dexMl: 376, aaPct: 10, aaMl: 900, lipMl: 250, hiz: h.hiz }).puan, 100);
  assert.ok(M.epPuan(tpn, { dexPct: 70, dexMl: 900, aaPct: 10, aaMl: 900, lipMl: 250, hiz: 85 }).rows.find((r) => /Glukoz/.test(r.t)).ok === false, 'yüksek glukoz hızı yakalanır');
  const en = M.EP.find((c) => c.tip === 'enteral');
  assert.equal(M.epPuan(en, { kcal: 2000, pro: 104, urun: 'yp', ml: 1600, hiz: 66.7, modul: 0 }).puan, 100);
  const std = M.epPuan(en, { kcal: 2000, pro: 104, urun: 'std', ml: 2000, hiz: 83.3, modul: 0 });
  assert.equal(std.rows.find((r) => /Protein karşılanıyor/.test(r.t)).ok, false, 'standart ürün proteini karşılamaz');
  assert.equal(M.epPuan(en, { kcal: 2000, pro: 104, urun: 'std', ml: 2000, hiz: 83.3, modul: 20 }).puan, 100, 'protein modülüyle tamam');
  const rf = M.EP.find((c) => c.tip === 'refeed');
  assert.equal(M.epPuan(rf, { kcal: 185, gerek: { tiamin: true, elektrolit: true, kademeli: true } }).puan, 100);
  assert.ok(M.epPuan(rf, { kcal: 1100, gerek: { tiamin: true, elektrolit: true, kademeli: true } }).puan < 100, '30 kcal/kg ile başlamak yanlış');
  assert.ok(M.epPuan(rf, { kcal: 185, gerek: { tiamin: true, elektrolit: true, kademeli: true, hizli: true } }).puan < 100);
});
test('sayfa: modüller, uyarı, kaynak notu ve hareket tercihi', () => {
  const h = read('labs/diyet/index.html');
  const order = ['data/besin.js', 'data/who2007-bki.js', 'diyet-model.js', 'diyet-ikon.js', 'diyet-app.js', 'diyet-klinik.js', 'diyet-degisim.js'].map((s) => h.indexOf('src="' + s + '"'));
  assert.ok(order.every((i) => i > 0) && order.every((v, i) => !i || v > order[i - 1]), 'betik sırası');
  for (const t of ['tabak', 'degisim', 'antro', 'vaka', 'ep']) assert.match(h, new RegExp('data-tab="' + t + '"'));
  assert.match(h, /<select id="f-formul"><option value="mifflin">Mifflin-St Jeor<\/option><option value="harris">Harris-Benedict<\/option>/, 'antropometri formül seçimi');
  assert.match(read('labs/diyet/diyet-app.js'), /\['tabak', 'degisim', 'antro', 'vaka', 'ep'\]/);
  assert.match(read('labs/diyet/data/who2007-bki.js'), /de Onis ve ark\., Bull WHO 2007/);
  assert.match(h, /eğitim amaçlı/); assert.match(h, /kişisel diyet önerisi değildir/); assert.match(h, /USDA SR28 \(kamu malı\)/);
  assert.match(h, /@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important\}\}/);
  const ik = {}; vm.runInNewContext(read('labs/diyet/diyet-ikon.js'), { window: ik });
  for (const b of AXDB.besin.concat(AXDB.tarif)) assert.ok(ik.AXIKON.I[ik.AXIKON.BES[b.id]], b.id + ' ikonu');
  const app = read('labs/diyet/diyet-app.js');
  assert.match(app, /localStorage\.getItem\('acadex\.diyet\.'/); assert.match(app, /m\.lab = 'diyet'/);
  assert.match(app, /if \(e\.origin !== ORG \|\| e\.source !== W\.parent\) return;/, 'köprü yalnız aynı kaynak');
});
test('MedLab: kart, katman kaydı ve Acadia köprüsü Diyet Lab\'i tanır', () => {
  assert.match(read('js/acadex-medlab.js'), /diyet: \{ t: 'Diyet Lab', src: 'labs\/diyet\/index\.html' \}/);
  const ac = read('js/acadex-medlab-acadia.js');
  assert.match(ac, /diyet: 'Diyet Lab'/); assert.match(ac, /diyet: 'beslenme ve diyetetik öğrencisine'/);
  const dash = read('dashboard.html'), i = dash.indexOf('data-medlab-open="diyet"'), card = dash.slice(i, dash.indexOf('</li>', i));
  assert.ok(i > 0); assert.match(card, /class="axm-cover axm-cover-dyt" role="img" aria-label="[^"]+"/); assert.match(card, /<svg class="axm-dyt"[^>]*aria-hidden="true"/);
  const css = read('css/acadex-medlab.css'), rm = css.slice(css.indexOf('Diyet Lab kapağı'));
  const motion = rm.slice(rm.indexOf('@media (prefers-reduced-motion:no-preference)'), rm.indexOf('@keyframes'));
  assert.match(motion, /animation:dyt-hop/); assert.ok(!/animation:dyt-/.test(rm.replace(motion, '')), 'animasyon yalnız hareket tercihi açıkken');
});

summary();
