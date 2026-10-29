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
const ctx = { window: {} }; vm.runInNewContext(read('labs/diyet/data/besin.js'), ctx);
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
  assert.equal(M.VK.length, 7);
  const ideal = (v) => {
    const w = M.agirlik(v, v.ag[0]), abn = {}; v.lab.forEach((l, i) => { if (M.labDurum(l) !== 'N') abn[i] = true; });
    const kisit = {}; v.kisit.gerek.forEach((k) => { kisit[k] = true; }); const oneri = {}; v.oneri.gerek.forEach((k) => { oneri[k] = true; });
    return { flags: abn, nrs: v.nrs || {}, ag: v.ag[0], kcal: (v.kcal[0] + v.kcal[1]) / 2, pro: Math.round((v.pro[0] + v.pro[1]) / 2 * w), kisit, oneri, oncelik: v.dogru };
  };
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
  const order = ['data/besin.js', 'diyet-model.js', 'diyet-ikon.js', 'diyet-app.js', 'diyet-klinik.js'].map((s) => h.indexOf('src="' + s + '"'));
  assert.ok(order.every((i) => i > 0) && order.every((v, i) => !i || v > order[i - 1]), 'betik sırası');
  for (const t of ['tabak', 'antro', 'vaka', 'ep']) assert.match(h, new RegExp('data-tab="' + t + '"'));
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
