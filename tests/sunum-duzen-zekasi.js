/* ==========================================================================
   ACADEX — SUNUM DÜZEN ZEKÂSI TESTLERİ (tests/sunum-duzen-zekasi.js)

   NEDEN VAR (26.11.2026, Phase 1 Revizyon 5 + P1 + P2):
     - Düzen seçici artık sayaçla dönmüyor (VSIRA sırası). Her aday çeşit gerçek
       VARY/LAY ile kurulup üretimin fitSlide'ı ile sığdırılıyor, measureH ile
       ölçülüyor; içerik uygunluğu (U) > gerçek taşma (O) > sığdırma sonrası gövde
       yazısı (P) > okunurluk (R) > çeşitlilik anahtarları > W > başlık özeti.
     - P1: şablon yazı tipi doğrulanmadan sığdırma/basım yok; yüklenemezse
       ölçüm kutusu da asetat da tek ortak yedek yazıyla çizilir, kullanıcı uyarılır.
     - P2: ölçüm kutusu (fitBox) asetatın şablon sınıfını ve stilini taşır; eskiden
       gövde yazısı yüklenmemiş "Instrument Sans" yerine sistem yazısıyla ölçülüp
       ekranda Inter ile taşıyordu.

   Bölümler:  A seçici · B aday denemesi güvenliği · C korunan eski davranışlar ·
              D P1/P2 (başsız Chrome; Chrome yoksa D bölümü AÇIKÇA atlanır).
   Çalıştırma:  node tests/sunum-duzen-zekasi.js
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { makeRunner } = require('./_ts-extract.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
/* #38: düzenler ilk harfi deste dilinde büyütür (ilkBuyuk); dilimli düzeneğe gerçek tanım + Türkçe deste verilir */
const ILK = "var deck = { lang: 'tr' };" + ink.match(/  var ilkBuyuk = function[^\n]+/)[0] + '\n';
const { test, summary } = makeRunner();
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const cut = (a, b, from) => { const i = ink.indexOf(a, from || 0); assert.ok(i >= 0, 'bulunamadı: ' + a.slice(0, 50)); const j = ink.indexOf(b, i + a.length); assert.ok(j > i, 'bulunamadı: ' + b.slice(0, 50)); return ink.slice(i, j); };

/* ---------- Node düzeneği: eski testlerle aynı dilimler (VARY…LAILE, vSay/vSec…push, newSlide) ---------- */
let id = 0;
const E = (type, x, y, w, h, o) => Object.assign({ id: ++id, type, x, y, w, h, text: '', size: 24 }, o);
const head = (t) => [E('h', 70, 46, 820, 74, { text: t, size: 42 }), E('mark', 70, 118, 190, 16, {})];
const statsOf = (bb) => (bb || []).map((x) => { const m = String(x).split(' — '); return m.length > 1 ? { value: m[0], label: m[1] } : null; }).filter(Boolean);
const arr = (x) => (Array.isArray(x) ? x : []);
const { VARY, VSIRA, LAILE } = new Function('E', 'head', 'statsOf', 'NAVY', 'BLUE', 'SOFT', 'statBoy', 'arr', 'txt',
  ILK + cut("var TINT = ['#DCE6FF'", '/* ---------- özetten taşınan zenginlik') + ';return { VARY, VSIRA, LAILE };')(E, head, statsOf, '#0D1838', '#2F6BFF', '#6A7593', (ss, o) => o[3], arr, (x) => String(x == null ? '' : x).trim());
const VS = cut('var vSay = {}, vSec', 'push(); var made = strips.map');
const NS = cut('  var newSlide = function (kind, t, b, c) {', '  /* ---------- rendering ---------- */');
const LAY = {};
['list', 'time', 'stat', 'two', 'quote', 'chart', 'table', 'cover', 'end', 'refs'].forEach((k) => { LAY[k] = { f: (t, bb) => head(t).concat([E('ul', 90, 160, 780, 340, { text: arr(bb).join('\n') })]) }; });
/* basım döngüsü taklidi: printDeck'teki satırların aynısı (C7 kaynakta doğrular) */
const RET = `;var bas = function (s, kind) { kind = vTur(kind); var cx = { heads: s.heads, split: s.split, data: s.data };
  cx.v = s.vz && kind === 'list' ? s.vz : vSec(s, kind); cx.zorla = !!s.vz; cx.aile = vSay.aile || ''; cx.tek = vSay.tek;
  cx.yedek = s.vz && kind === 'list' ? null : vSay.yedek; vSay.yedek = null;
  var sl = newSlide(kind, String(s.t).trim(), s.b, cx); DZ.duzelt(kind, sl.v || 0, !!(s.vz && kind === 'list'));
  if (cx.hata) { vSay.hatalar = (vSay.hatalar || []).concat(cx.hata.map(function (x) { return Object.assign({ t: String(s.t).trim() }, x); })); delete cx.hata; }
  if (kind === 'list') vSay.aile = LAILE[sl.v || 0] || '';
  return { kind: kind, v: sl.v || 0, req: cx.v, sl: sl, tani: vSay.tani, yedekKaldi: vSay.yedek, cx: cx }; };
  return { bas: bas, vSay: vSay, vSec: vSec, DZ: DZ, newSlide: newSlide };`;
const yap = (o = {}) => {
  const names = ['VSIRA', 'VARY', 'LAILE', 'arr', 'LAY', 'uid'], vals = [VSIRA, o.VARY || VARY, LAILE, arr, LAY, () => ++id];
  if (o.dom) { names.push('fitSlide', 'measureH', 'document', 'W', 'H'); vals.push(o.dom.fitSlide, o.dom.measureH, {}, 960, 540); }
  if (o.ikon) { names.push('ikonKul', 'ikonBag'); vals.push(o.ikon, ''); }
  return new Function(...names, VS + NS + RET)(...vals);
};
const deste = (run, deck) => deck.map((s0, i) => run.bas(Object.assign({}, s0, { son: i === deck.length - 1 }), s0.k));
const seri = (r) => r.map((x) => x.kind + ':' + x.v).join(' ');
const DUZ = ['Planlama güne başlamadan önce yapılırsa öncelikler netleşir', 'Kesintileri azaltmak odak süresini belirgin biçimde uzatır', 'Haftalık gözden geçirme sapmaları erken gösterir'];
const KOL = ['Pomodoro: 25 dakika odak ve 5 dakika mola döngüsüyle çalışılır', 'Eisenhower: işler önem ve aciliyete göre dörde ayrılır', 'Pareto: sonuçların çoğu işlerin küçük bir bölümünden gelir'];
/* İç deste (HOLDOUT setleri DEĞİL). Altın seri dondurulmuş tasarımın kendisinden alındı:
   ACADEX-QA-TRANSFER/scripts/rev5-module.js (SEC + kaydet, aynı dilimler, tasarlanan boyutlar) — üretimle birebir aynı. */
const D1 = [{ t: 'Neden bahçe tarımı yükseliyor', k: 'list', b: ['Kentlerde boş çatı alanları artık sebze yetiştirmek için kiralanıyor', 'Yerel üretim taşıma maliyetini ve gecikmeyi belirgin biçimde azaltıyor', 'Gençler hobi olarak başladıkları işi küçük girişimlere dönüştürüyor'] },
  { t: 'Kompost hazırlama adımları', k: 'list', b: ['Adım 1: kahverengi ve yeşil atığı ayır', 'Adım 2: katmanlar hâlinde yığ', 'Adım 3: haftada bir karıştır', 'Adım 4: olgun kompostu ele'] },
  { t: 'Temel kavramlar', k: 'list', b: ['Malç: toprağın üstünü örten ve nemi tutan organik katman', 'Rotasyon: aynı tarhta her yıl farklı bitki ailesi yetiştirmek', 'Aşılama: iki bitkiyi tek gövdede birleştirme tekniği'] },
  { t: 'Bahçe verileri', k: 'stat', b: ['%38 — su tasarrufu', '1.200 — gönüllü', '14 — mahalle bahçesi'], data: { stats: [{ value: '%38', label: 'su tasarrufu' }, { value: '1.200', label: 'gönüllü' }, { value: '14', label: 'mahalle bahçesi' }] } },
  { t: 'Mevzuat tarihçesi', k: 'time', b: ['1985: ilk hobi bahçesi yönetmeliği', '2004: kent tarımı teşviki', '2019: çatı bahçesi izni', '2023: yağmur suyu hasadı zorunluluğu'] },
  { t: 'Çatı bahçesi ile toprak bahçe', k: 'two', b: ['Hafif saksı toprağı gerektirir', 'Rüzgâra açık olduğu için sulama sık yapılır', 'Derin köklü bitkilere uygundur', 'Kış aylarında daha az bakım ister'], heads: ['Çatı', 'Toprak'] },
  { t: 'Bir gönüllü anlattı', k: 'quote', b: ['Bahçede geçirdiğim her sabah, mahallemizi yeniden tanımamı sağladı ve komşularımla ilk kez gerçekten konuştum.'] },
  { t: 'Sık yapılan hatalar ve ayrıntılı açıklamaları', k: 'list', b: ['Fideleri çok sık dikmek havalanmayı azaltır ve mantar hastalıklarının yayılmasını kolaylaştırır, bu yüzden aralık bırakılmalıdır', 'Akşam geç saatte sulamak yaprakların gece boyunca ıslak kalmasına ve küf oluşmasına yol açar', 'Toprağı hiç dinlendirmeden aynı bitkiyi yıllarca yetiştirmek besin dengesini bozar ve verimi düşürür', 'Kimyasal gübreyi ölçüsüz kullanmak toprak canlılarını öldürür ve uzun vadede yapıyı bozar', 'Malç katmanını gövdeye dayamak kabuk çürümesine ve zararlıların barınmasına neden olur'] },
  { t: 'Kısa not', k: 'list', b: ['Her bahçe kendi iklimine göre planlanmalıdır'] },
  { t: 'Kapanış: akılda kalanlar', k: 'list', b: ['Küçük başla ve ölç', 'Komşularınla paylaş', 'Toprağı dinlendir'] }];
const D2 = [{ t: 'Kitap kulübü nasıl kurulur', k: 'list', b: ['Önce düzenli buluşabilecek beş altı kişilik çekirdek bir grup oluşturulur', 'Okuma takvimi ay başında herkesin görebileceği bir yerde paylaşılır', 'Her buluşmanın sonunda bir sonraki kitap ortak oyla seçilir'] },
  { t: 'Okuma alışkanlığı', k: 'list', b: ['Günde yirmi dakika okuyan öğrencilerin sözcük dağarcığı belirgin biçimde genişliyor', 'Sesli okuma küçük çocuklarda dikkat süresini uzatıyor', 'Basılı kitap ekrana göre daha az göz yorgunluğu yaratıyor'] },
  { t: 'Katılım rakamları', k: 'list', b: ['%62 üye her ay en az bir buluşmaya katılıyor', '3.400 kitap kulüp kütüphanesinden ödünç alındı', '27 farklı mahallede kulüp şubesi açıldı'] },
  { t: 'Bir üye yazdı', k: 'quote', b: ['Kulübe katılmadan önce yılda bir kitap okuyordum, şimdi her ay yeni bir yazar keşfediyorum.'] },
  { t: 'Tartışma soruları', k: 'list', b: ['Ana karakterin kararı haklı mıydı', 'Hangi sahne seni en çok etkiledi', 'Kitabın sonu başka nasıl olabilirdi', 'Yazar hangi soruyu açık bıraktı'] },
  { t: 'Gelecek dönem planı', k: 'list', b: ['Yazarla söyleşi düzenlemek', 'Çocuk kulübü açmak'] }];
const ALTIN1 = 'list:2 list:8 list:11 stat:0 time:4 two:0 quote:2 list:9 list:6 list:2';
const ALTIN2 = 'list:12 list:9 list:5 quote:2 list:4 list:6';
/* aday kümesi: sec() ile aynı kural (VSIRA ∪ {0} ∪ liste için {6,7}, gündem 10 hariç) */
const adaylar = (kind) => (VSIRA[kind] || [0]).concat([0], kind === 'list' ? [6, 7] : []).filter((v, i, a) => a.indexOf(v) === i && !(kind === 'list' && v === 10)).filter((v) => !v || (VARY[kind] && VARY[kind][v - 1]));
/* bir çeşidin ürettiği öğeleri işaretleyen sarmalayıcı (sahte ölçüm için) */
const isaretle = (kind, vs, extra) => { const V2 = Object.assign({}, VARY); V2[kind] = VARY[kind].slice(); vs.forEach((v) => { const f = VARY[kind][v - 1]; V2[kind][v - 1] = (...a) => { const r = f(...a); if (r) r.forEach((e) => { e._isaret = 1; }); return r; }; }); if (extra) extra(V2); return V2; };

/* ================================ A · SEÇİCİ ================================ */
test('A1 tablolar, sınıflandırıcı, bantlar ve haritalar dondurulmuş Revizyon 5 tasarımıyla birebir aynı (SHA-256)', () => {
  /* ACADEX-QA-TRANSFER/scripts/rev5-module.js satır 4–14, 25, 27–88 (AILE…ESIK_PX), 4 boşluk içerlek. Tasarım değişirse yeni revizyon gerekir. */
  const i = ink.indexOf('    var DZ = (function () {\n'); assert.ok(i > 0, 'DZ bloğu yok');
  const a = i + '    var DZ = (function () {\n'.length, b = ink.indexOf('\n      // ---------- ölçüm:', a);
  const govde = ink.slice(a, b).split('\n').map((x) => x.replace(/^    /, '')).join('\n');
  assert.equal(sha(govde), '780442e071bc43318b9d05484342349017bd141f29fb07252d9abc03b075f0be');
  assert.ok(ink.indexOf('var DZ = (function () {') > ink.indexOf('var vSay = {}, vSec') && ink.indexOf('var DZ = (function () {') < ink.indexOf('push(); var made = strips.map'), 'DZ, eski düzeneklerin kestiği dilimin içinde olmalı');
});

test('A2 altın seri: iki iç destede seçimler dondurulmuş tasarımla aynı', () => {
  assert.equal(seri(deste(yap(), D1)), ALTIN1);
  assert.equal(seri(deste(yap(), D2)), ALTIN2);
});

test('A3 U önce gelir: her puanlanan asetatta kazananın uygunluğu adayların en yükseği', () => {
  [D1, D2].forEach((deck) => {
    const run = yap(); deste(run, deck).forEach((r, i) => {
      if (!r.tani) return;
      const U = (v) => run.DZ.uyum(r.tani.tur, r.kind, v), kur = (v) => (v ? VARY[r.kind][v - 1](deck[i].t, arr(deck[i].b).slice(), { heads: deck[i].heads, data: deck[i].data }) : 1);
      const enY = Math.max(...adaylar(r.kind).filter((v) => kur(v)).map(U));
      assert.equal(U(r.req), enY, deck[i].t + ': ' + r.kind + ':' + r.req + ' U=' + U(r.req) + ' < ' + enY);
    });
  });
});

test('A4 O ikinci anahtar: kazanan aday asetattan taşınca seçilmez; hepsi taşarsa kapasiteTasma tanısı', () => {
  const s = { t: 'Planlama ilkeleri', k: 'list', b: DUZ };
  const v1 = yap().vSec(s, 'list'); assert.ok(v1 > 0, 'başlangıç kazananı klasik olmamalı: ' + v1);
  const tasan = { fitSlide: () => 0, measureH: (e) => (e._isaret ? 9999 : e.h) };
  const r2 = yap({ VARY: isaretle('list', [v1]), dom: tasan }), v2 = r2.vSec(s, 'list');
  assert.notEqual(v2, v1); assert.equal(r2.vSay.tani.kapasiteTasma, false);
  const hepsi = { fitSlide: () => 0, measureH: () => 9999 }, r3 = yap({ dom: hepsi }); r3.vSec(s, 'list');
  assert.equal(r3.vSay.tani.kapasiteTasma, true); assert.equal(r3.vSay.tani.olcum.oSlide > 0, true);
});

test('A4b U, O\'dan önce gelir: en uygun çeşitler taşsa da seçilir, uygunluk taşmaya feda edilmez (taşma tanıya yazılır)', () => {
  const s = { t: 'Kompost hazırlama adımları', k: 'list', b: ['Adım 1: kahverengi ve yeşil atığı ayır', 'Adım 2: katmanlar hâlinde yığ', 'Adım 3: haftada bir karıştır', 'Adım 4: olgun kompostu ele'] };
  const base = yap(); base.vSec(s, 'list'); const U = (v) => base.DZ.uyum(base.vSay.tani.tur, 'list', v);
  const kurulur = adaylar('list').filter((v) => !v || VARY.list[v - 1](s.t, s.b.slice(), {})), max = Math.max(...kurulur.map(U)), ust = kurulur.filter((v) => U(v) === max);
  assert.ok(ust.length < kurulur.length && ust.indexOf(0) < 0, 'test içeriği farklı uygunluk düzeyleri vermeli: ' + kurulur.map((v) => v + '=' + U(v)).join(' '));
  const r = yap({ VARY: isaretle('list', ust), dom: { fitSlide: () => 0, measureH: (e) => (e._isaret ? 9999 : e.h) } }), v = r.vSec(s, 'list');
  assert.equal(U(v), max, 'seçilen ' + v + ' U=' + U(v)); assert.equal(r.vSay.tani.kapasiteTasma, true);
});

test('A5 P üçüncü anahtar: sığdırma gövdeyi 18 px altına küçültürse aday geriler; hepsi küçülürse kapasiteFont', () => {
  const s = { t: 'Planlama ilkeleri', k: 'list', b: DUZ };
  const v1 = yap().vSec(s, 'list');
  const kucult = (hepsi) => ({ fitSlide: (sl) => { sl.els.forEach((e) => { if ((hepsi || e._isaret) && (e.type === 't' || e.type === 'ul')) e.size = 14; }); return 1; }, measureH: (e) => e.h });
  const r2 = yap({ VARY: isaretle('list', [v1]), dom: kucult(false) }), v2 = r2.vSec(s, 'list');
  assert.notEqual(v2, v1); assert.equal(r2.vSay.tani.kapasiteFont, false);
  const r3 = yap({ dom: kucult(true) }); r3.vSec(s, 'list'); assert.equal(r3.vSay.tani.kapasiteFont, true); assert.equal(r3.vSay.tani.olcum.px, 14);
});

test('A6 klasik (v = 0) aday olarak kurulup ölçülür; bütün çeşitler taşarsa klasik basılır', () => {
  const s = { t: 'Planlama ilkeleri', k: 'list', b: DUZ }, run = yap(); run.vSec(s, 'list');
  assert.equal(run.vSay.tani.aday, adaylar('list').length, 'aday sayısı klasik dahil bütün kümeyi kapsamalı');
  const tumu = adaylar('list').filter(Boolean), r2 = yap({ VARY: isaretle('list', tumu), dom: { fitSlide: () => 0, measureH: (e) => (e._isaret ? 9999 : e.h) } });
  const x = r2.bas(s, 'list'); assert.equal(x.req, 0); assert.equal(x.v, 0); assert.equal(x.sl.v, undefined, 'klasik asetatta v alanı yazılmaz');
});

test('A7 belirlenimli: aynı deste iki kez aynı seçimleri ve aynı tanı günlüğünü üretir', () => {
  const a = yap(), b = yap(), ra = deste(a, D1), rb = deste(b, D1);
  assert.equal(seri(ra), seri(rb));
  assert.deepEqual(a.vSay.gunluk, b.vSay.gunluk);
});

test('A8 tanı yalnız bellekte: vSay.gunluk + vSay.tani; asetat nesnesine yeni alan yazılmaz', () => {
  const run = yap(), r = deste(run, D1);
  assert.equal(run.vSay.gunluk.length, D1.length);
  run.vSay.gunluk.forEach((g) => assert.ok(['en-uygun', 'tekrar-kacinilmaz', 'klasik-yedek', 'kural', 'menu', 'yedek'].includes(g.neden), g.neden));
  r.forEach((x) => Object.keys(x.sl).forEach((k) => assert.ok(['id', 'lay', 'bg', 'notes', 'els', 'v'].includes(k), 'asetatta yeni alan: ' + k)));
  const t = r[0].tani; ['tur', 'neden', 'kapasiteFont', 'kapasiteTasma', 'olcum', 'aday', 'ms'].forEach((k) => assert.ok(k in t, 'tanıda yok: ' + k));
  assert.ok(!/localStorage|S\(store/.test(cut('    var DZ = (function () {', '    })();\n')), 'tanı kalıcı saklanmamalı (Phase 4 kararı)');
});

/* ================================ B · ADAY DENEMESİ GÜVENLİĞİ ================================ */
test('B1 ikonKul: deneme sonrası aynı nesne, aynı değerler — bir aday hata fırlatsa da; hata yalnız o adayı düşürür', () => {
  const ik = { 'trending-down': 1, kitap: 2 }, ref = ik;
  const V2 = isaretle('list', [], (V) => { V.list[0] = () => { ik.yeni = 1; ik.kitap = 99; delete ik['trending-down']; return null; }; V.list[1] = () => { ik.baska = 1; throw new Error('çeşit patladı'); }; });
  const run = yap({ VARY: V2, ikon: ik });
  const v = run.vSec({ t: 'Başlık', k: 'list', b: DUZ }, 'list');
  assert.notEqual(v, 2, 'hata fırlatan aday seçilmemeli');
  assert.equal(ik, ref); assert.deepEqual(ik, { 'trending-down': 1, kitap: 2 });
  assert.deepEqual(run.vSay.tani.hata, [{ kv: 'list:2', tur: 'Error', asama: 'aday' }]);
  const ik2 = { a: 1 }, r2 = yap({ VARY: isaretle('list', [], (V) => { V.list[0] = () => { ik2.b = 2; return null; }; }), ikon: ik2 });
  r2.vSec({ t: 'Başlık', b: DUZ }, 'list'); assert.deepEqual(ik2, { a: 1 });
});

/* Belirli bir içerikte hata fırlatan çeşit: yalnız "PATLA" geçen asetatta, kazanacak olan çeşit patlar */
const patlak = (vPat, sayac) => isaretle('list', [], (V) => { const f = VARY.list[vPat - 1]; V.list[vPat - 1] = (t, b, c) => { if (sayac) sayac.n++; if (/PATLA/.test(String(t))) { globalThis.ikonKul && (globalThis.ikonKul.kirli = 1); throw new TypeError('içerik ' + t); } return f(t, b, c); }; });

test('B5 enjekte hata: aday hata fırlatınca öteki adaylar denenir, seçilen düzen doğru basılır, tanı görünür, yedek bir kez tüketilir', () => {
  const s = { t: 'PATLA planlama', k: 'list', b: DUZ };
  const temiz = yap(), v1 = temiz.vSec({ t: 'PATLA planlama', k: 'list', b: DUZ }, 'list'); assert.ok(v1 > 0);
  const n0 = temiz.vSay.tani.aday, sayac = { n: 0 }, run = yap({ VARY: patlak(v1, sayac) });
  const x = run.bas(s, 'list');
  assert.equal(run.vSay.tani.aday, n0, 'bütün adaylar denenmeli'); assert.equal(sayac.n, 1, 'patlayan aday basımda yeniden denenmemeli');
  assert.notEqual(x.req, v1); assert.equal(x.v, x.req, 'seçilen ikinci aday basılmalı'); assert.ok(x.sl.els.length > 2);
  assert.deepEqual(run.vSay.tani.hata, [{ kv: 'list:' + v1, tur: 'TypeError', asama: 'aday' }]);
  assert.deepEqual(run.vSay.hatalar, [{ t: 'PATLA planlama', kv: 'list:' + v1, tur: 'TypeError', asama: 'aday' }]);
  assert.equal(x.yedekKaldi, null); assert.ok(x.cx.yedek && x.cx.yedek.sira.indexOf(v1) < 0, 'patlayan aday sıralı yedekte olmamalı');
  Object.keys(x.sl).forEach((k) => assert.ok(['id', 'lay', 'bg', 'notes', 'els', 'v'].includes(k), 'asetata hata alanı yazılmamalı: ' + k));
  const y = run.bas({ t: 'Sonraki', k: 'list', b: DUZ }, 'list'); assert.equal(y.yedekKaldi, null); assert.equal(run.vSay.tani.hata.length, 0, 'tanı asetat başına');
});

test('B6 basımda patlayan çeşit: newSlide sıradaki yedeğe geçer, ikon kaydı kirlenmez, hata basım tanısına yazılır', () => {
  const s = { t: 'Planlama ilkeleri', k: 'list', b: DUZ }, v1 = yap().vSec(s, 'list');
  let n = 0, atildi = false, gorulen = null;
  const V2 = isaretle('list', [], (V) => {
    const f = VARY.list[v1 - 1]; V.list[v1 - 1] = (t, b, c) => { if (n++) { globalThis.ikonKul.kirli = 1; atildi = true; throw new RangeError('basımda'); } return f(t, b, c); };
    V.list.forEach((g, i) => { if (i !== v1 - 1) V.list[i] = (t, b, c) => { if (atildi && !gorulen) gorulen = Object.assign({}, globalThis.ikonKul); return g(t, b, c); }; });
  });
  const run = yap({ VARY: V2 }), uyar = console.warn; let uyari = 0; console.warn = () => { uyari++; };
  let x; try { x = run.bas(s, 'list'); } finally { console.warn = uyar; }
  assert.equal(x.req, v1); assert.notEqual(x.v, v1); assert.ok(x.v === 0 || x.cx.yedek.sira.indexOf(x.v) > 0);
  assert.ok(x.v === 0 || (gorulen && !('kirli' in gorulen)), 'sıradaki çeşit kirli ikon kaydı görmemeli: ' + JSON.stringify(gorulen));
  assert.equal(uyari, 1);
  const h = run.vSay.hatalar.filter((e) => e.asama === 'basim'); assert.deepEqual(h, [{ t: 'Planlama ilkeleri', kv: 'list:' + v1, tur: 'RangeError', asama: 'basim' }]);
  assert.ok(!('hata' in x.cx), 'basım bağlamındaki hata kaydı devredildikten sonra silinmeli');
  assert.equal(run.vSay.gunluk[run.vSay.gunluk.length - 1].v, x.v);
});

test('B7 ilgisiz hatalar yutulmaz: ölçüm hatası, bütün yollar kapanınca klasik düzenin hatası yukarı çıkar', () => {
  assert.throws(() => yap({ dom: { fitSlide: () => 0, measureH: () => { throw new Error('ölçüm bozuk'); } } }).vSec({ t: 'X', k: 'list', b: DUZ }, 'list'), /ölçüm bozuk/);
  const hepsi = isaretle('list', [], (V) => { V.list.forEach((g, i) => { V.list[i] = () => { throw new Error('çeşit'); }; }); });
  const LAY0 = LAY.list; LAY.list = { f: () => { throw new Error('klasik bozuk'); } };
  const uyar = console.warn; console.warn = () => {};
  try { assert.throws(() => yap({ VARY: hepsi }).bas({ t: 'X', k: 'list', b: DUZ }, 'list'), /klasik bozuk/); } finally { LAY.list = LAY0; console.warn = uyar; }
  /* bütün çeşitler patlar, klasik sağlamsa klasik basılır */
  console.warn = () => {}; let x; try { x = yap({ VARY: hepsi }).bas({ t: 'X', k: 'list', b: DUZ }, 'list'); } finally { console.warn = uyar; }
  assert.equal(x.v, 0); assert.equal(x.req, 0);
  assert.match(NS, /alt = fv \? cesitKur\(fv, kind, dene\[di\], t, b, c\) : null;/);
  assert.match(NS, /els: alt \|\| LAY\[kind\]\.f\(t, b, c\) \}/, 'klasik düzen sarılmamalı');
});

test('B2 eski düzenek dilimi: yalnız VSIRA, VARY, LAILE, arr, LAY, uid ile bütün türlerde ReferenceError yok', () => {
  const run = yap();
  const D = [{ t: 'Kapak', k: 'cover', b: [] }].concat(D1, [{ t: 'Kaynaklar', k: 'refs', b: ['a', 'b'] }, { t: 'Teşekkürler', k: 'end', b: [] }]);
  assert.doesNotThrow(() => deste(run, D));
  assert.equal(run.vSay.gunluk.length, D1.length, 'kapak, kaynakça ve kapanış belleğe girmez');
});

test('B3 sıralı yedek tek kullanımlık: basımda devredilir ve silinir; tür/başlık/ilk çeşit uymazsa yok sayılır; ilk 0 da kesilir', () => {
  const run = yap(), x = run.bas({ t: '  Planlama ilkeleri ', b: DUZ }, 'list');
  assert.equal(x.yedekKaldi, null); assert.ok(x.cx.yedek && x.cx.yedek.t === 'Planlama ilkeleri' && x.cx.yedek.sira[0] === x.req, 'yedek kırpılmış başlıkla devredilmeli');
  const V2 = isaretle('list', [], (V) => { V.list[4] = () => null; }), ns = yap({ VARY: V2 }).newSlide;
  const t = 'Başlık', b = DUZ;
  assert.equal(ns('list', t, b, { v: 5, yedek: { kind: 'list', t, sira: [5, 3, 0, 1] } }).v, 3, 'sıralı yedek kullanılmalı');
  assert.equal(ns('list', t, b, { v: 5, yedek: { kind: 'list', t, sira: [5, 0, 3] } }).v, undefined, 'ilk 0 da kesilip klasik basılmalı');
  const eski = ns('list', t, b, { v: 5 }).v;
  assert.equal(ns('list', t, b, { v: 5, yedek: { kind: 'list', t: 'başka başlık', sira: [5, 0] } }).v, eski, 'başka asetatın yedeği kullanılmamalı');
  assert.equal(ns('list', t, b, { v: 5, yedek: { kind: 'time', t, sira: [5, 0] } }).v, eski);
  assert.equal(ns('list', t, b, { v: 5, yedek: { kind: 'list', t, sira: [3, 0] } }).v, eski, 'ilk çeşit istenenle aynı değilse yok sayılır');
});

test('B4 newSlide yedeğe düşerse bellek BASILAN çeşidi tutar', () => {
  const s = { t: 'Planlama ilkeleri', b: DUZ }, v1 = yap().vSec(s, 'list');
  let n = 0; const V2 = isaretle('list', [], (V) => { const f = VARY.list[v1 - 1]; V.list[v1 - 1] = (...a) => (n++ ? null : f(...a)); });
  const run = yap({ VARY: V2 }), x = run.bas(s, 'list');
  assert.equal(x.req, v1); assert.notEqual(x.v, v1);
  const g = run.vSay.gunluk[run.vSay.gunluk.length - 1]; assert.equal(g.v, x.v); assert.equal(g.neden, 'yedek'); assert.equal(g.gorunum, run.DZ.gorunum('list', x.v));
});

/* ================================ C · KORUNAN ESKİ DAVRANIŞLAR ================================ */
test('C1 alıntı koyu zemin (2); fotoğraf ipucu düzen ayırmaz (Phase 2): ipuçlu alıntı ve varlık ipuçlu liste ipuçsuzla aynı', () => {
  const run = yap(), q = (img) => ({ t: 'Q', b: ['Kısa ve net bir cümle burada yer alır.'], img });
  assert.equal(run.vSec(q({ q: 'kütüphane' }), 'quote'), 2); assert.equal(run.vSay.tani, null, 'kural dönüşünde aday denenmez');
  assert.equal(run.vSec(q({ q: 'kütüphane' }), 'quote'), 2); assert.equal(run.vSec(q(null), 'quote'), 2);
  assert.equal(run.vSec(q({ entity: 'Atatürk' }), 'quote'), 2);
  assert.equal(yap().vSec({ t: 'L', b: DUZ, img: { entity: 'Ankara' } }, 'list'), yap().vSec({ t: 'L', b: DUZ }, 'list'), 'varlık ipucu liste düzenini değiştiriyor');
});

test('C2 kural 4–6: ince liste kutusu art arda gelmez, "Terim: açıklama" kolona açılır, fotoğraflı liste ipuçsuzla aynı (Phase 2)', () => {
  const r1 = yap(); assert.equal(r1.vSec({ t: 'A', b: ['Tek cümlelik not'] }, 'list'), 6); assert.equal(r1.vSay.tani, null, 'kural dönüşünde aday denenmez');
  r1.vSay.aile = LAILE[6]; assert.equal(r1.vSec({ t: 'B', b: ['Bir not daha'] }, 'list'), 0, 'ince liste kutusu art arda gelmez');
  assert.equal(yap().bas({ t: 'K', b: KOL }, 'list').v, 7);
  const r3 = yap(), r4 = yap(), ph = [0, 1, 2, 3].map(() => r3.bas({ t: 'F', b: DUZ, img: { q: 'wafer' } }, 'list').v), ph0 = [0, 1, 2, 3].map(() => r4.bas({ t: 'F', b: DUZ }, 'list').v);
  assert.deepEqual(ph, ph0, 'fotoğraf ipucu liste düzenini değiştiriyor: ' + ph.join(',') + ' / ' + ph0.join(','));
});

test('C3 vTur: alıntı art arda gelmez, destede en çok iki', () => {
  const run = yap(), Q = { t: 'Q', b: ['Kısa ve net bir cümle burada yer alır.'] };
  const k = [Q, Q, { t: 'L', b: DUZ }, Q, { t: 'L2', b: DUZ }, Q].map((s, i) => run.bas(s, i === 2 || i === 4 ? 'list' : 'quote').kind);
  assert.deepEqual(k, ['quote', 'list', 'list', 'quote', 'list', 'list']);
});

test('C4 menü çeşidi (vz) sıraya uyulmadan basılır, yedek devredilmez, bellekte "menu" kaydı', () => {
  const run = yap(); run.bas({ t: 'Önce', b: DUZ }, 'list');
  const x = run.bas({ t: 'Menü', b: DUZ, vz: 4 }, 'list');
  assert.equal(x.req, 4); assert.equal(x.cx.yedek, null); assert.equal(x.cx.zorla, true);
  assert.equal(x.v, run.newSlide('list', 'Menü', DUZ, { v: 4, zorla: true, aile: x.cx.aile }).v || 0, 'menü çeşidi eski newSlide sırasıyla basılır');
  assert.equal(run.vSay.gunluk[run.vSay.gunluk.length - 1].neden, 'menu');
});

test('C5 eski 8 liste serisi (sunum-arastirma-gorsel :686–702) Revizyon 5 ile de geçer', () => {
  const run = yap(), s8 = [KOL, DUZ, KOL, DUZ, KOL, DUZ, DUZ, DUZ].map((bb) => run.bas({ t: 'Başlık', b: bb }, 'list').v);
  s8.forEach((v, i) => { if (i) assert.notEqual(LAILE[v], LAILE[s8[i - 1]], s8.join(',')); });
  assert.ok(new Set(s8).size >= 5, s8.join(',')); assert.ok(s8.filter((v) => LAILE[v] === 's').length <= 3, s8.join(','));
});

test('C6 kural 1–6, vTur, VSIRA/VARY/LAILE ve newSlide girişi kaynakta korunur', () => {
  assert.match(VS, /if \(!VSIRA\[kind\]\) return 0;/);
  assert.ok(!/vSay\.fo|vSay\.qf|s\.img\.entity\)\) return 0/.test(VS), 'fotoğraf için düzen ayıran kural geri geldi (Phase 2)');
  assert.match(VS, /if \(kind === 'quote'\) return 2;/);
  assert.match(VS, /return vSay\.aile === LAILE\[6\] \? 0 : 6;/);
  assert.match(VS, /if \(kol && !vSay\.kol\) \{ vSay\.kol = 1; return 7; \}/);
  assert.match(VS, /var vTur = function \(kind\) \{ if \(kind === 'quote' && \(vSay\.son === 'quote' \|\| vSay\.qn >= 2\)\) kind = 'list';/);
  assert.ok(!/vSay\.son = null/.test(VS), 'vSay.son vTur\'un belleğidir; seçici onu silmemeli');
  assert.match(NS, /var v = c && c\.v, alt = null, sira = \(VARY\[kind\] && VSIRA\[kind\]\) \|\| \[\]/);
  assert.ok(!/var sr = VSIRA\[kind\], n = vSay\[kind\]/.test(VS), 'sayaçlı sıra kaldırılmış olmalı');
});

test('C7 basım döngüsü: yedek devri, bellek düzeltmesi ve sığdırma printDeck\'te; vSay her basımda yeni', () => {
  const pd = cut('  var printDeck = function (mode, kalanBos) {', '\n  };\n');
  assert.match(pd, /var vSay = \{\}, vSec = function \(s, kind\) \{ vSay\.yedek = null; vSay\.tani = null;/);
  assert.match(pd, /cx\.yedek = s\.vz && kind === 'list' \? null : vSay\.yedek; vSay\.yedek = null;/);
  assert.match(pd, /var sl = newSlide\(kind, s\.t\.trim\(\), s\.b, cx\); if \(s\.notes\) sl\.notes = s\.notes;\n      DZ\.duzelt\(kind, sl\.v \|\| 0, !!\(s\.vz && kind === 'list'\)\);/);
  assert.match(pd, /var fitted = 0; made\.forEach\(function \(sl\) \{ fitted \+= fitSlide\(sl\); \}\);/);
  assert.match(pd, /if \(cx\.hata\) \{ vSay\.hatalar = \(vSay\.hatalar \|\| \[\]\)\.concat\(cx\.hata\.map\(function \(x\) \{ return Object\.assign\(\{ t: s\.t\.trim\(\) \}, x\); \}\)\); delete cx\.hata; \}/);
  assert.match(pd, /fitIzKur\(\); if \(fitIz\) fitIz\.set\(deck, yaziIz\(\)\);/);
  assert.ok(!/olcH/.test(ink), 'olcH üretimde olmamalı (P2 sonrası measureH = görünen asetat)');
});

/* ================================ D · P1 / P2 (tarayıcı) ================================ */
const CHROME = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });

test('D0 P1 kaynak kuralları: check() kapı değil, sabitler, basım sırası, tema seçimi ve düzenleyici sığdırmaları', () => {
  const sbx = cut("  var root = document.getElementById('sunum'); if (!root) return;", "  var LY = layer ? layer.querySelector('.axb-l')");
  assert.ok(!/document\.fonts\.check\(/.test(sbx), 'document.fonts.check sunum modülünde yükleme kapısı olmamalı');
  assert.match(ink, /var FONT_ORNEK = 'Ağçİöşü Aa 0123', FONT_SURE = 8000;/);
  assert.match(ink, /var fontYedek = 0, FONT_YEDEK = "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";/);
  assert.equal(ink.split('fontYukle(').length - 1, 1, 'fontYukle yalnız temaHazir üzerinden çağrılmalı');
  const b = cut('  var bas = function (mode) {', '\n  };\n');
  assert.ok(b.indexOf('basTemasi(mode)') < b.indexOf('temaHazirGuncel()') && b.indexOf('temaHazirGuncel()') < b.indexOf('printDeck(mode, kalan)'), 'basım: şablon → yazı doğrulaması → printDeck');
  assert.match(b, /if \(no !== basNo \|\| deck !== d0\) return;/);
  const pd = cut('  var printDeck = function (mode, kalanBos) {', '    var fitted = 0;');
  assert.ok(!/fontYukle\(|document\.fonts\.ready|deck\.tema = temaKur/.test(pd), 'printDeck yazı yüklememeli ve şablon atamamalı');
  assert.match(cut('  var temaSec = function (T) {', '\n  };\n'), /deck\.temaEl = 1; fitIzKur\(\); deck\.tema = [^\n]+\n[\s\S]*yaziSonra\(function \(\) \{\}, 'uyum'\);/);
  assert.match(ink, /var T = deck\.tema; fitIzKur\(\); temaHazir\(T\);/);
  /* sığdırma ve ölçüm yapan her yol yazı kapısından geçer */
  ['placePhoto(s0, p, imQ.value.trim()); yaziFit(s0);', 's.v = alt ? v : 0; yaziFit(s);'].forEach((x) => assert.ok(ink.includes(x), 'düzenleyici sığdırması beklemeli: ' + x));
  /* Phase 2: otomatik fotoğraf yerleştirme yuva motorundan geçer; ölçüm yalnız doğrulanmış yazıyla (gorselSec kapısı, yanıtlar yaziSonra içinde) */
  assert.match(ink, /var gorselSec = function \(sl, ps, bic, alt\) \{\n    if \(!yaziHazirMi\(\)\) return null;/);
  assert.match(ink, /var dn = null; if \(hazir\) \{ for \(var k = 0; k < fs\.length && !dn; k\+\+\) dn = yuvaDene\(/);
  assert.ok((ink.match(/yuvaDene\(/g) || []).length === 2, 'yuvaDene yalnız gorselSec ve illustrate denemesinden çağrılır');
  assert.ok(!/fitHazir/.test(ink), '"şimdi sığdır, sonra bir daha" yolu kalmamalı');
  assert.equal(ink.split('fitSlide(').length - 1, 5, 'fitSlide çağrıları: yaziUyum, yaziFit, DZ ölçümü, printDeck, yuvaDene (Phase 2, kapıdan geçer) — yenisi eklendiyse yazı kapısından geçmeli');
  assert.match(cut('  var openAudit = function () {', '    var paint = function'), /if \(!yaziHazirMi\(\) \|\| yaziKuyruk\.length\) \{ say\([^)]*\); yaziSonra\(openAudit, 'denetim'\); return; \}/);
  assert.match(cut('  var qaHedef = function (x) {', '\n  };\n'), /x\.els\.length && snapHazir\(deck\)/, 'denetim onarımı (fitEl) yalnız doğrulanmış şablon yazısıyla');
  assert.match(ink, /var apply = function \(\) \{\n        if \(!yaziHazirMi\(\) \|\| yaziKuyruk\.length\) \{ yaziSonra\(apply, 'ai:' \+ sid\); return; \}/);
  assert.match(ink, /return yaziHazirSoz\(\)\.then\(function \(\) \{ addQ\(s, 'Soru: '/);
  assert.match(ink, /setTimeout\(res, calm \? 0 : 250\); \}\)\.then\(yaziHazirSoz\)\.then\(function \(\) \{ return AI\[k\]\(work\); \}\);/);
  assert.match(ink, /return yaziHazirSoz\(\)\.then\(function \(\) \{ work = clone\(s\); var m = AI\[k\]\(work\);/);
  assert.equal((ink.match(/\bsettle\(/g) || []).length, 3, 'settle çağıranları: addQ ×2, Acadia apply (hepsi kapıdan geçer; denetçinin düzelt\'i Phase 6 ile kalktı)');
  assert.equal((ink.match(/\baddQ\(/g) || []).length, 2, 'addQ çağıranları: AI.q ve REMOTE.q (ikisi de kapıdan geçer)');
  /* #18: paylaşım görüntüsü yalnız doğrulanmış şablon yazısıyla sığdırılmış açık desteden; yoksa hesaptaki görüntü kalır */
  assert.match(ink, /var snapHazir = function \(d\) \{ return !!\(d && d === deck && !fontYedek && yaziHazirMi\(\) && fitIz && fitIz\.get\(d\) === yaziIz\(\)\); \};\n  var snapOf = function \(d\) \{ return snapHazir\(d\) \? snapKur\(d\) : null; \};/, 'paylaşım görüntüsü yedek yazıyla kurulmamalı');
  assert.equal((ink.match(/\bsnapOf\(/g) || []).length, 2, 'snapOf çağıranları: bağlantı oluştur ve store.push (ikisi de null görüntüyü ele alır)');
  assert.match(ink, /await shReady\(\); await yaziHazirSoz\(\); var t = newToken\(\), sn = snapOf\(deck\);\n      if \(!sn\) \{ yaziTipiUyar\(\); throw new Error\(/);
  assert.match(ink, /var sn = d\.share && d\.dbId \? snapOf\(d\) : null, surum = uid\(\); if \(sn\) \{ sn\.surum = surum; row\.share_snapshot = sn; \} else if \(d\.share && d\.dbId\) d\.snapBekle = 1;/);
  /* 18B: açılışta deste KAYDEDİLMEZ; bekleyen görüntü yalnız görüntü olarak, koşullu yazılır */
  assert.match(ink, /if \(fontYedek\) yaziTipiUyar\(\); else if \(deck\.share && deck\.snapBekle\) snapTazele\(deck\);/);
  const yu = cut('  var yaziUyum = function () {', '\n  };\n'); assert.ok(!/dirty\(\)|saveNow\(\)|store\.push/.test(yu), 'yazı uyumu desteyi kaydettirmemeli (18A: eski yerel kopya yeni içeriği ezerdi)');
  const st = cut('  var snapTazele = function (d) {', '\n  };\n');
  assert.ok(!/presentation_slides'\)\.(insert|delete|update|upsert)|dirty\(\)|saveNow\(\)|store\.push|saveLocal/.test(st), 'görüntü yenileme asetatlara ve deste kaydına dokunmamalı');
  assert.match(st, /\.update\(\{ share_snapshot: sn \}\)\.eq\('id', d\.dbId\)\.eq\('updated_at', p\.data\.updated_at\)\.select\('id'\)/, 'yalnız share_snapshot, okunan sürüm hâlâ aynıysa');
  assert.match(st, /if \(d !== deck \|\| !snapHazir\(d\) \|\| !ayniIcerik\(d, r\.data\)\) return 'farkli';/);
  const pu = cut('    push: async function (d) {', '\n    },\n');
  assert.ok(pu.indexOf("presentation_slides').insert(rows)") < pu.indexOf("if (!yeniSatir) { var r2 = await c.from('presentations').update(row)"), 'var olan destede satır asetatlardan sonra yazılmalı');
  /* #18: yazarın boyutu açıkça işaretlenir; yalnız kalem kutusu (büyüt/küçült), sığdırma değil */
  assert.match(ink, /var boyYazar = function \(e, v\) \{ e\.size = v; if \(fitTaban\) fitTaban\.set\(e, \{ taban: v, son: v \}\); \};/);
  assert.equal((ink.match(/\bboyYazar\(/g) || []).length, 2, 'boyYazar çağıranları: büyüt ve küçült');
  assert.ok(!/boyYazar/.test(cut('  var fitEl = function (e) {', '  var fitSlide')), 'otomatik sığdırma yazar tercihi sayılmamalı');
});

if (!CHROME) {
  console.log('  ATLANDI  D1–D16, E1–E7 ve F1–F8 (P1/P2 ve kayıt bütünlüğü tarayıcı testleri): Chrome bulunamadı — CHROME_BIN ile yol verin. Bu testler GEÇTİ sayılmadı.');
} else {
  const W = fs.mkdtempSync(path.join(os.tmpdir(), 'acadex-dz-'));
  const fontUrl = (n) => pathToFileURL(path.join(ROOT, 'assets/landing/fonts', n)).href;
  const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  const LATEXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  /* yerel yazı tipleri: dar (Instrument Sans) ve geniş (JetBrains Mono); ikisinde de latin + latin-ext alt kümesi */
  const yuz = (fam, dosya) => ['400', '700'].map((w) => `@font-face{font-family:"${fam}";font-weight:${w};font-display:swap;src:url("${fontUrl(dosya + '-latin.woff2')}") format("woff2");unicode-range:${LATIN}}@font-face{font-family:"${fam}";font-weight:${w};font-display:swap;src:url("${fontUrl(dosya + '-latin-ext.woff2')}") format("woff2");unicode-range:${LATEXT}}`).join('');
  const AILE = { 'dz-basari': ['Dz Basari', 'instrument'], 'dz-gec': ['Dz Gec', 'instrument'], 'dz-gec-ok': ['Dz Gec Ok', 'instrument'], 'dz-tekrar': ['Dz Tekrar', 'instrument'], 'dz-tekrar2': ['Dz Tekrar2', 'instrument'],
    'dz-genis': ['Dz Genis', 'jbmono'], 'dz-gec-a': ['Dz Gec A', 'jbmono'], 'dz-gec-b': ['Dz Gec B', 'instrument'], 'dz-gec-c': ['Dz Gec C', 'instrument'], 'dz-gec-d': ['Dz Gec D', 'instrument'], 'dz-gec-e': ['Dz Gec E', 'jbmono'], 'dz-e-ok': ['Dz E Ok', 'instrument'],
    'dz-kayip': ['Dz Kayip', 'instrument'], 'dz-gen-a': ['Dz Gen A', 'jbmono'], 'dz-dar-b': ['Dz Dar B', 'instrument'] };
  Object.keys(AILE).forEach((k) => fs.writeFileSync(path.join(W, 'ok-' + k + '.css'), yuz(AILE[k][0], AILE[k][1])));
  fs.writeFileSync(path.join(W, 'bos-dz-bos.css'), '/* @font-face yok */ body{}');
  const BASE = pathToFileURL(W).href + '/';
  /* fonts.bunny.net isteği yerel CSS'e çevrilir: ok · cdn (dosya yok → error) · bos (FontFace yok) · asili (hiç olay yok) · gec (400 ms gecikmeli ok) · gecHata */
  const SENARYO = { 'dz-cdn': 'cdn', 'dz-bos': 'bos', 'dz-asili': 'asili', 'dz-gec-hata': 'gecHata', 'dz-tekrar': 'cdn', 'dz-tekrar2': 'cdn' };
  Object.keys(AILE).filter((k) => /^dz-gec/.test(k)).forEach((k) => { SENARYO[k] = 'gec'; });
  const KESICI = `<script>
window.__linkler = []; window.__senaryo = ${JSON.stringify(SENARYO)};
(function () { var ap = document.head.appendChild.bind(document.head), BASE = ${JSON.stringify(BASE)};
  document.head.appendChild = function (n) {
    if (!(n && n.tagName === 'LINK' && /fonts\\.bunny\\.net/.test(n.href))) return ap(n);
    var slug = decodeURIComponent(n.href.split('family=')[1].split(':')[0]), sc = window.__senaryo[slug] || 'ok'; window.__linkler.push(slug);
    if (sc === 'asili') return n;
    if (sc === 'cdn') { n.href = BASE + 'yok-' + slug + '.css'; return ap(n); }
    if (sc === 'bos') { n.href = BASE + 'bos-' + slug + '.css'; return ap(n); }
    if (sc === 'gec' || sc === 'gecHata') { n.href = BASE + (sc === 'gec' ? 'ok-' : 'yok-') + slug + '.css'; setTimeout(function () { ap(n); }, 400); return n; }
    n.href = BASE + 'ok-' + slug + '.css'; return ap(n);
  }; })();
window.fetch = function (u) { (window.__ag = window.__ag || []).push(String(u)); return Promise.reject(new Error('test: ağ kapalı')); };
</script>`;
  const kos = (dosya, html) => {
    fs.writeFileSync(path.join(W, dosya), html);
    const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + path.join(W, 'prof-' + dosya), '--allow-file-access-from-files', '--virtual-time-budget=90000', '--dump-dom', pathToFileURL(path.join(W, dosya)).href], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 180000 }).toString();
    const m = dom.match(/<pre id="diag">([\s\S]*?)<\/pre>/);
    return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
  };

  /* ---------------- D sayfası: P1/P2 çekirdeği (modül dilimi, eski düzeneklerle aynı sınırlar) ---------------- */
  const SLICE = cut("  var root = document.getElementById('sunum'); if (!root) return;", "  /* ---------- .pptx'ten şablon çıkarma").replace('FONT_SURE = 8000', 'FONT_SURE = 700');
  const EXTRA = cut('  /* sl verilirse ölçüm o asetatın', '  var overflows = function');
  const TOAST = '<div data-toast hidden><span data-toast-t></span><button data-toast-b></button><a data-toast-a></a></div><span data-saved></span>';
  const sayfaD = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(ROOT, 'css/acadex-ink.css')).href}">
<style>html,body{margin:0}#sunum{display:none!important}</style></head><body><div id="sunum"></div><section id="acadexsunum-view" class="axu"></section><div id="axu-layer"><div class="axu-l"></div></div><pre id="diag"></pre>
${KESICI}
<script>
document.getElementById('sunum').innerHTML = ${JSON.stringify(TOAST)};
(function () {
${SLICE}
${EXTRA}
  var renderStage = function () { window.__ciz = (window.__ciz || 0) + 1; }, renderThumbs = function () {}; dirty = function () {};
  var fitAsil = fitSlide; fitSlide = function (sl) { (window.__fit = window.__fit || []).push({ id: sl && sl.id, hazir: yaziHazirMi() }); return fitAsil(sl); };
  window.__T = { temaHazir: temaHazir, temaKur: temaKur, TEMALAR: TEMALAR, deck: function () { return deck; }, yedek: function () { return fontYedek; }, FONT_YEDEK: FONT_YEDEK,
    fitSlide: function (sl) { return fitSlide(sl); }, yaziFit: yaziFit, hazirMi: function () { return yaziHazirMi(); }, kuyruk: function () { return yaziKuyruk.length; },
    measureH: measureH, temaSty: temaSty, temaCls: temaCls, slideHTML: slideHTML, elHTML: elHTML, kutu: function () { return fitBox; }, LY: LY };
})();
</script>
<script>
(async function () {
  var T = window.__T, R = {}, d = document;
  var tema = function (f) { var x = T.temaKur(T.TEMALAR.filter(function (t) { return t.id === 'ax-pitch'; })[0].def); x.hf = f; x.bf = f; return x; };
  /* üretimdeki sözleşme: temaHazir yalnız AÇIK destenin şablonu için çağrılır */
  var hazir = function (Tm) { T.deck().tema = Tm; return T.temaHazir(Tm); };
  var yuzler = function (f) { var o = []; d.fonts.forEach(function (x) { if (x.family.replace(/"/g, '') === f) o.push(x.weight + ':' + x.status); }); return o; };
  var toast = function () { return { t: d.querySelector('[data-toast-t]').textContent, a: d.querySelector('[data-toast-a]').getAttribute('href'), al: d.querySelector('[data-toast-a]').textContent }; };
  var bekle = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var el = function (type, y, h, text, size) { return { id: 'e' + type + y, type: type, x: 70, y: y, w: 520, h: h, text: text, size: size, color: '#0D1838', align: 'left', bold: false }; };
  var UZUN = 'Kentlerde boş çatı alanları artık sebze yetiştirmek için kiralanıyor ve yerel üretim taşıma maliyetini belirgin biçimde azaltıyor; gençler hobi olarak başladıkları işi küçük girişimlere dönüştürüyor.';
  try {
    var Tok = tema('Dz Basari'), t0 = performance.now(), r1 = await hazir(Tok);
    R.d1 = { r: r1, yedek: T.yedek(), yuz: yuzler('Dz Basari'), ms: performance.now() - t0 };
    var r2 = await hazir(tema('Dz Cdn')); R.d2 = { r: r2, yedek: T.yedek(), toast: toast() };
    await hazir(Tok); R.d2b = { yedek: T.yedek() };
    var r3 = await hazir(tema('Dz Bos')); R.d3 = { r: r3, yedek: T.yedek(), yuz: yuzler('Dz Bos') };
    t0 = performance.now(); var r4 = await hazir(tema('Dz Asili')); R.d4 = { r: r4, yedek: T.yedek(), ms: performance.now() - t0 };
    var Tf = tema('Dz Asili'); await hazir(Tf);
    var sl = { id: 'sD5', bg: 'clear', els: [el('h', 40, 70, 'Şablon başlığı ğüşİ', 40), el('t', 130, 120, UZUN, 22), el('ul', 270, 200, UZUN + '\\n' + UZUN, 20)] };
    var tut = d.createElement('div'); tut.style.cssText = 'position:fixed;left:-30000px;top:0;visibility:hidden'; T.LY.appendChild(tut);
    var gor = function (s) { tut.innerHTML = T.slideHTML(s); var k = tut.firstChild; return { kok: k, bul: function (id) { return k.querySelector('[data-id="' + id + '"]'); } }; };
    var g = gor(sl); T.fitSlide({ els: [], bg: 'clear' });
    R.d5 = { yedek: T.yedek(), govde: getComputedStyle(g.kok).fontFamily, baslik: getComputedStyle(g.bul('eh40')).fontFamily, kutu: getComputedStyle(T.kutu()).fontFamily, Y: T.FONT_YEDEK };
    var n0 = window.__linkler.length, r6 = await hazir(tema('')); R.d6 = { r: r6, yeniLink: window.__linkler.length - n0, yedek: T.yedek() };
    var T7 = tema('Dz Tekrar'); var r7 = await hazir(T7); R.d7 = { ilk: r7, yedek1: T.yedek(), toast1: toast() };
    window.__senaryo['dz-tekrar'] = 'ok'; d.querySelector('[data-toast-a]').click();
    for (var k = 0; k < 40 && toast().t !== 'Şablon yazı tipi yüklendi.'; k++) await bekle(100);
    R.d7.yedek2 = T.yedek(); R.d7.toast2 = toast(); R.d7.istek = window.__linkler.filter(function (x) { return x === 'dz-tekrar'; }).length;
    var pa = hazir(tema('Dz Gec Hata')); await hazir(Tok); var ya = T.yedek(); await pa; R.d8 = { a1: ya, a2: T.yedek() };
    var pb = hazir(tema('Dz Gec Ok')); await hazir(tema('Dz Cdn')); var yb = T.yedek(); await pb; R.d8.b1 = yb; R.d8.b2 = T.yedek();
    /* D9 düzenleyici sığdırması yazı doğrulanana dek bekler, sonra güncel şablonla BİR KEZ yapılır */
    await hazir(Tok); var Tg = tema('Dz Gec'); var sg = { id: 'sD9', bg: 'clear', els: [el('ul', 160, 120, UZUN + '\\n' + UZUN, 26)] }; T.deck().slides.push(sg);
    var pg = hazir(Tg); window.__fit = []; var c0 = window.__ciz || 0; var hemen = T.yaziFit(sg); var f1 = window.__fit.slice(), q1 = T.kuyruk(); await pg; await bekle(50);
    R.d9 = { hemen: hemen, once: f1, kuyruk: q1, sonra: window.__fit.slice(), ciz: (window.__ciz || 0) - c0, r: await pg, kuyrukSon: T.kuyruk() };
    T.deck().slides.splice(T.deck().slides.indexOf(sg), 1);
    /* P2 */
    await hazir(Tok);
    var navy = { bg: 'navy', els: sl.els.map(function (e) { return Object.assign({}, e); }) };
    T.fitSlide(navy); var k1 = T.kutu();
    R.d10 = { cls: k1.className, beklenenCls: T.temaCls(navy), stil: k1.getAttribute('style'), beklenenStil: T.temaSty(navy), gorunur: getComputedStyle(k1).visibility, display: getComputedStyle(k1).display, aile: getComputedStyle(k1).fontFamily };
    T.deck().tema = null; T.fitSlide({ bg: 'clear', els: [] });
    R.d11 = { cls: T.kutu().className, stil: T.kutu().getAttribute('style'), ayni: T.kutu() === k1 };
    var olc = function (s) { var g2 = gor(s); return s.els.map(function (e) { var n = g2.bul(e.id); n.style.height = 'auto'; n.style.overflow = 'visible'; return [e.type, T.measureH(e, s), n.scrollHeight]; }); };
    await hazir(Tok); R.d12 = { sablon: olc(sl), koyu: olc(navy) };
    await hazir(Tf); R.d12.yedek = olc(sl); R.d12.yedekAcik = T.yedek();
    await hazir(Tok); R.d12.sablonYedek = T.yedek();
    var L0 = T.LY.children.length; for (var i = 0; i < 50; i++) { T.fitSlide(i % 2 ? navy : sl); sl.els.forEach(function (e) { T.measureH(e, sl); }); }
    R.d13 = { once: L0, sonra: T.LY.children.length, bos: T.kutu().innerHTML === '' };
    /* D14–D16 geri alınabilir sığdırma: geniş (Dz Genis) ve dar (Dz Basari) yazı; asıl boyutlar 40 / 24 / 26 */
    var rvN = 0, tasarim = function () { rvN++; return { id: 'rv' + rvN, bg: 'clear', els: [el('h', 40, 70, 'Başlık ğüşİ yazısı ve uzun bir başlık satırı', 40), el('t', 130, 110, UZUN, 24), el('ul', 260, 220, UZUN + '\\n' + UZUN, 26)] }; };
    var boy = function (s) { return s.els.map(function (e) { return e.size; }).join(','); };
    var TA = tema('Dz Genis'), TB = tema('Dz Basari');
    var taze = async function (Tm) { var c = tasarim(); T.deck().slides = [c]; await hazir(Tm); T.fitSlide(c); return boy(c); };
    var RA = await taze(TA), RB = await taze(TB);
    var c = tasarim(); T.deck().slides = [c]; await hazir(TA); T.fitSlide(c); var s1 = boy(c); T.fitSlide(c); T.fitSlide(c); T.fitSlide(c);
    R.d14 = { RA: RA, RB: RB, ilk: s1, uc: boy(c) };
    var dd = tasarim(), anahtar0 = JSON.stringify(dd.els.map(function (e) { return Object.keys(e).sort(); })); T.deck().slides = [dd]; T.fitSlide(dd); var a1 = boy(dd);
    await hazir(TB); var b1 = boy(dd); await hazir(TA); var a2 = boy(dd); await hazir(TB); await hazir(TA); await hazir(TB); await hazir(TA); var a3 = boy(dd);
    R.d15 = { a1: a1, b1: b1, a2: a2, a3: a3, anahtar: JSON.stringify(dd.els.map(function (e) { return Object.keys(e).sort(); })) === anahtar0, json: JSON.stringify(dd) };
    var Tt = tema('Dz Tekrar2'), rr = tasarim(); T.deck().slides = [rr]; await hazir(Tt); var fy = T.yedek(), fb = boy(rr);
    window.__senaryo['dz-tekrar2'] = 'ok'; d.querySelector('[data-toast-t]').textContent = ''; d.querySelector('[data-toast-a]').click();
    for (k = 0; k < 40 && toast().t !== 'Şablon yazı tipi yüklendi.'; k++) await bekle(100);
    var rt = boy(rr), cz = tasarim(); T.fitSlide(cz);
    R.d16 = { yedek: fy, yedekBoy: fb, sonra: rt, taze: boy(cz), yedekSon: T.yedek(), temaHf: T.deck().tema.hf, temaBf: T.deck().tema.bf, temaJson: JSON.stringify(T.deck().tema).indexOf('system-ui') < 0, json: JSON.stringify(rr) };
  } catch (e) { R.hata = String(e && e.stack || e); }
  d.getElementById('diag').textContent = JSON.stringify(R);
})();
</script></body></html>`;

  /* ---------------- E sayfası: GERÇEK modülün tamamı (dashboard.html işaretlemesi; tek eklenen satır içeriyi açar) ---------------- */
  const html = read('dashboard.html').split('\n');
  const i0 = html.findIndex((l) => l.includes('<section id="acadexsunum-view"')), i1 = html.findIndex((l, i) => i > i0 && l.includes('<div id="axu-layer">'));
  const ma = ink.indexOf("  (function () {\n  var root = document.getElementById('sunum'); if (!root) return;"), son = '  if (me()) boot();\n\n  })();', mb = ink.indexOf(son, ma);
  const KANCA = `  window.__iz = [];
  var fitAsilE = fitSlide; fitSlide = function (sl) { window.__iz.push({ op: 'fit', id: sl && sl.id, hazir: yaziHazirMi(), k: fontAnahtar(deck.tema), yedek: fontYedek }); return fitAsilE(sl); };
  var olcAsilE = measureH; measureH = function (e, sl) { window.__iz.push({ op: 'olc', hazir: yaziHazirMi(), k: fontAnahtar(deck.tema), yedek: fontYedek }); return olcAsilE(e, sl); };
  window.__S = { set: function (st, pm) { strips = st; plotMeta = pm; }, bas: bas, deck: function () { return deck; }, temaSec: temaSec, TEMALAR: TEMALAR, yaziFit: yaziFit, placePhoto: placePhoto,
    yedek: function () { return fontYedek; }, basiliyor: function () { return basiliyor; }, kuyruk: function () { return yaziKuyruk.length; }, hazirMi: function () { return yaziHazirMi(); }, VARY: VARY, k: fontAnahtar };\n`;
  const sayfaE = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(ROOT, 'css/acadex-ink.css')).href}"></head><body>
${KESICI}
${html.slice(i0, i1 + 2).join('\n')}
<pre id="diag"></pre>
<script>
${ink.slice(ma, mb).replace('FONT_SURE = 8000', 'FONT_SURE = 700') + '  if (me()) boot();\n' + KANCA + '\n  })();'}
</script>
<script>
(async function () {
  var S = window.__S, R = {}, d = document, bekle = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var AX = S.TEMALAR.filter(function (t) { return t.id === 'ax-pitch'; })[0].def;
  var sec = function (f) { return { def: Object.assign({}, AX, { id: 'dz-' + f.toLowerCase().replace(/ /g, '-'), hf: f, bf: f }) }; };
  var izle = function () { var a = window.__iz.length; return function () { return window.__iz.slice(a); }; };
  var sakin = async function () { for (var k = 0; k < 100 && (S.kuyruk() || !S.hazirMi() || S.basiliyor()); k++) await bekle(50); await bekle(50); };
  var temiz = function (iz) { return iz.every(function (x) { return x.hazir; }); };
  var UZ = 'Kentlerde boş çatı alanları artık sebze yetiştirmek için kiralanıyor ve yerel üretim taşıma maliyetini azaltıyor';
  var STRIPS = [{ k: 'cover', t: 'Kent bahçeleri', b: [] }, { k: 'list', t: 'Neden yükseliyor', b: [UZ, UZ + ' ikinci', UZ + ' üçüncü'] }, { k: 'list', t: 'Kompost adımları', b: ['Adım 1: ayır', 'Adım 2: yığ', 'Adım 3: karıştır'] },
    { k: 'list', t: 'PATLA sık hatalar', b: [UZ, UZ + ' iki', UZ + ' üç', UZ + ' dört'] }, { k: 'list', t: 'Kapanış', b: ['Küçük başla', 'Paylaş', 'Dinlendir'] }, { k: 'end', t: 'Teşekkürler', b: [] }];
  try {
    /* E1 basım: şablon yazısı gecikmeli; doğrulanmadan hiçbir sığdırma/ölçüm yok; bir VARY adayı "PATLA" içerikte hata fırlatır (E7) */
    var patN = 0; S.VARY.list = S.VARY.list.map(function (f) { return function (t, b, c) { if (/PATLA/.test(String(t))) { patN++; throw new TypeError('enjekte'); } return f(t, b, c); }; });
    var uyarilar = []; var cw = console.warn; console.warn = function () { uyarilar.push([].slice.call(arguments).join(' ')); };
    d.querySelector('[data-newdeck]').click(); S.deck().tema = null; S.temaSec(sec('Dz Gec C'));
    var iz1 = izle(); S.set(JSON.parse(JSON.stringify(STRIPS)), { title: 'Kent bahçeleri', sub: 'test', lang: 'tr', source: 'topic', sourceId: null });
    var basSirasinda = S.hazirMi(); S.bas('new'); var hemenSonra = S.deck().slides.length;
    await sakin(); console.warn = cw;
    var e1 = iz1();
    R.e1 = { basOncesiHazir: basSirasinda, hemenSonra: hemenSonra, slides: S.deck().slides.length, fit: e1.filter(function (x) { return x.op === 'fit'; }).length, olc: e1.filter(function (x) { return x.op === 'olc'; }).length, temiz: temiz(e1), anahtar: e1.every(function (x) { return x.k === 'Dz Gec C|Dz Gec C'; }) };
    R.e7 = { patN: patN, patla: S.deck().slides.filter(function (s) { return /PATLA/.test(JSON.stringify(s.els)); }).map(function (s) { return s.lay + ':' + (s.v || 0) + ':' + s.els.length; }), uyari: uyarilar.length, json: !/"(hata|hatalar|tani)"\s*:/.test(JSON.stringify(S.deck().slides)) };
    /* E2 düzen değiştir (gerçek düğme) şablon yazısı beklerken → kuyruk; sonra tek sığdırma */
    S.deck().cur = 1; S.temaSec(sec('Dz Gec D')); var iz2 = izle(); var hedef = S.deck().slides[1];
    d.querySelector('[data-lay="list"][data-dz]').click(); var e2once = iz2().length, q2 = S.kuyruk();
    await sakin(); var e2 = iz2();
    R.e2 = { once: e2once, kuyruk: q2, temiz: temiz(e2), anahtar: e2.every(function (x) { return x.k === 'Dz Gec D|Dz Gec D'; }), hedefFit: e2.filter(function (x) { return x.op === 'fit' && x.id === hedef.id; }).length, toplamFit: e2.filter(function (x) { return x.op === 'fit'; }).length, slides: S.deck().slides.length };
    /* E3 görsel yerleştirme (placePhoto + yaziFit, kaynaktaki çağrının aynısı) beklerken */
    S.temaSec(sec('Dz Gec A')); var iz3 = izle(); var s3 = S.deck().slides[2];
    S.placePhoto(s3, { large: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', w: 3, h: 2 }, 'deneme'); var hemen3 = S.yaziFit(s3); var e3once = iz3().length;
    await sakin(); var e3 = iz3();
    R.e3 = { hemen: hemen3, once: e3once, temiz: temiz(e3), hedefFit: e3.filter(function (x) { return x.op === 'fit' && x.id === s3.id; }).length };
    /* E4 denetim (gerçek düğme) beklerken: bildirim, sonra açılır; ölçümler doğrulanmış yazıyla */
    S.temaSec(sec('Dz Gec B')); var iz4 = izle(); d.querySelector('[data-audit]').click();
    var e4once = iz4().length, toast4 = d.querySelector('[data-toast-t]').textContent, acik0 = !!d.querySelector('dialog[open]');
    await sakin(); var e4 = iz4(), acik1 = !!d.querySelector('dialog[open]');
    R.e4 = { once: e4once, toast: toast4, acikOnce: acik0, acikSonra: acik1, olc: e4.filter(function (x) { return x.op === 'olc'; }).length, temiz: temiz(e4) };
    var dlg = d.querySelector('dialog[open]'); if (dlg) dlg.close();
    /* E5 bekleyen iş varken şablon yine değişir: iş güncel şablonla BİR KEZ çalışır, eski şablonla hiç */
    S.deck().cur = 1; var iz5 = izle(); S.temaSec(sec('Dz Gec E')); d.querySelector('[data-lay="list"][data-dz]').click(); S.temaSec(sec('Dz E Ok'));
    var e5once = iz5().filter(function (x) { return x.op === 'fit'; }).length;
    await sakin(); var e5 = iz5();
    R.e5 = { once: e5once, temiz: temiz(e5), eskiAnahtar: e5.filter(function (x) { return x.k === 'Dz Gec E|Dz Gec E'; }).length, hedefFit: e5.filter(function (x) { return x.op === 'fit' && x.id === S.deck().slides[1].id; }).length, toplamFit: e5.filter(function (x) { return x.op === 'fit'; }).length, slides: S.deck().slides.length };
    /* E6 eski deste: bekleyen iş başka desteye geçilince atılır */
    S.temaSec(sec('Dz Gec')); var eski = S.deck(), es = eski.slides[1]; var iz6 = izle(); S.yaziFit(es);
    d.querySelector('[data-newdeck]').click(); await sakin(); var e6 = iz6();
    R.e6 = { eskiFit: e6.filter(function (x) { return x.op === 'fit' && x.id === es.id; }).length, yeniDeste: S.deck() !== eski, kuyruk: S.kuyruk() };
    R.ag = window.__ag || [];
  } catch (e) { R.hata = String(e && e.stack || e); }
  d.getElementById('diag').textContent = JSON.stringify(R);
})();
</script></body></html>`;

  let RD = null, RE = null, hataD = null, hataE = null;
  try { RD = kos('d.html', sayfaD); } catch (e) { hataD = e; }
  try { RE = kos('e.html', sayfaE); } catch (e) { hataE = e; }

  /* ---------------- F sayfaları: KAYIT BÜTÜNLÜĞÜ — gerçek modül, gerçek localStorage, GERÇEK yeniden yükleme ----------------
     F1 desteleri basar, düzenler, kaydeder (localStorage + sahte Supabase istemcisinin aldığı satırlar + paylaşım görüntüsü);
     F2 aynı profille sayfayı baştan açar ve kayıttan yükler. Kullanıcı sahte (window.currentUser); istemci yalnız store.push
     sırasında takılır ve gelen yükü kaydeder, ağa çıkmaz. 'dz-kayip' F1'de ulaşılamaz (yedek yazı), F2'de yüklenir. */
  const KANCA_F = `  window.__S = { set: function (st, pm) { strips = st; plotMeta = pm; }, bas: bas, deck: function () { return deck; }, temaSec: temaSec, TEMALAR: TEMALAR,
    yedek: function () { return fontYedek; }, basiliyor: function () { return basiliyor; }, kuyruk: function () { return yaziKuyruk.length; }, hazirMi: function () { return yaziHazirMi(); },
    store: store, openDeck: openDeck, saveNow: saveNow, dirty: function () { dirty(); }, pushU: push, undo: undo, redo: redo, snapOf: snapOf, kaliciBoy: kaliciBoy, kaliciJSON: kaliciJSON,
    fitSlide: function (sl) { return fitSlide(sl); }, op: op, sec: function (id) { selId = id; }, selId: function () { return selId; },
    measureH: measureH, snapKur: snapKur, fitKopya: fitKopya, fitAktar: fitAktar };\n`;
  const sayfaF = (senaryo, govde) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(ROOT, 'css/acadex-ink.css')).href}"></head><body>
${KESICI}
<script>Object.assign(window.__senaryo, ${JSON.stringify(senaryo)});</script>
<script>window.currentUser = { id: 'u-dz-test' };</script>
${html.slice(i0, i1 + 2).join('\n')}
<pre id="diag"></pre>
<script>
${ink.slice(ma, mb).replace('FONT_SURE = 8000', 'FONT_SURE = 700') + '  if (me()) boot();\n' + KANCA_F + '\n  })();'}
</script>
<script>
(async function () {
  var S = window.__S, R = {}, d = document, bekle = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var AX = S.TEMALAR.filter(function (t) { return t.id === 'ax-pitch'; })[0].def;
  var sec = function (f) { return { def: Object.assign({}, AX, { id: 'dz-' + f.toLowerCase().replace(/ /g, '-'), hf: f, bf: f }) }; };
  var sakin = async function () { for (var k = 0; k < 120 && (S.kuyruk() || !S.hazirMi() || S.basiliyor()); k++) await bekle(50); await bekle(80); };
  var yazilar = function (sl) { return sl.els.filter(function (e) { return (e.type === 't' || e.type === 'ul' || e.type === 'h') && e.text && !e.dz; }); };
  var boylar = function (slides) { return slides.map(function (s) { return yazilar(s).map(function (e) { return e.size; }).join(','); }).join('|'); };
  var tabanlar = function (slides) { return slides.map(function (s) { return yazilar(s).map(function (e) { return S.kaliciBoy(e); }).join(','); }).join('|'); };
  var kalici = function (slides) { return JSON.parse(JSON.stringify(slides, S.kaliciJSON)); };
  var taze = function (slides) { var c = JSON.parse(JSON.stringify(slides)); c.forEach(function (s) { S.fitSlide(s); }); return boylar(c); };      /* kayıttaki asıl boyutlardan, hiç sığdırılmamış kopyaya taze sığdırma */
  var yuk = function (id) { return localStorage.getItem(S.store.k('d.' + id)); };
  var snapBoylar = function (sn, slides) { return slides.map(function (s, i) { var h = sn.slides[i].html; return yazilar(s).map(function (e) { return +((h.match(new RegExp('data-id="' + e.id + '"[^>]*font-size:(\\\\d+)px')) || [])[1]); }).join(','); }).join('|'); };
  var bul = function (id) { var r = null; S.deck().slides.forEach(function (s) { s.els.forEach(function (e) { if (e.id === id) r = e; }); }); return r; };
  var an = function (id) { var e = bul(id); return e ? [e.size, S.kaliciBoy(e)] : null; };
  var iz = /"(taban|son|fit|iz)"\\s*:/;
  var bosZaman = function () { clearTimeout(S.store.timer); S.store.timer = 0; };
  var sahte = function () { var kayit = []; var c = { functions: { invoke: function () { return Promise.reject(new Error('test: model yok')); } }, rpc: function () { return Promise.reject(new Error('test')); },
    from: function (t) { var op = null, o = { select: function () { return o; }, eq: function () { return o; }, order: function () { return o; }, limit: function () { return o; }, single: function () { return o; }, maybeSingle: function () { return o; }, delete: function () { op = 'sil'; return o; },
      insert: function (x) { op = 'ekle'; kayit.push({ t: t, op: op, x: JSON.parse(JSON.stringify(x)) }); return o; }, update: function (x) { op = 'guncelle'; kayit.push({ t: t, op: op, x: JSON.parse(JSON.stringify(x)) }); return o; },
      then: function (a, b) { return Promise.resolve({ data: op === 'ekle' && t === 'presentations' ? { id: 'db-test' } : [], error: null }).then(a, b); } }; return o; } };
    return { c: c, kayit: kayit }; };
  var UZ = 'Kentlerde boş çatı alanları artık sebze yetiştirmek için kiralanıyor ve yerel üretim taşıma maliyetini belirgin biçimde azaltıyor';
  var STRIPS = [{ k: 'cover', t: 'Kayıt testi', b: [] }, { k: 'list', t: 'Uzun maddeler', b: [UZ, UZ + ' ikinci', UZ + ' üçüncü', UZ + ' dördüncü', UZ + ' beşinci'] }, { k: 'list', t: 'Kısa liste', b: ['Bir madde', 'İki madde', 'Üç madde'] }, { k: 'end', t: 'Son', b: [] }];
  var yeniDeste = async function (T, ad) { d.querySelector('[data-newdeck]').click(); S.temaSec(T); S.set(JSON.parse(JSON.stringify(STRIPS)), { title: ad, sub: 't', lang: 'tr', source: 'topic', sourceId: null }); S.bas('new'); await sakin(); return S.deck(); };
  try {
${govde}
  } catch (e) { R.hata = String(e && e.stack || e); }
  R.ag = window.__ag || [];
  d.getElementById('diag').textContent = JSON.stringify(R);
})();
</script></body></html>`;
  const F1 = `
    /* A: şablon yazısı yok → yedek yazıyla basılır ve sığdırılır; metin düzenlenir; kaydedilir */
    var A = await yeniDeste(sec('Dz Kayip'), 'A kayıt'), ua = A.slides[1].els.filter(function (e) { return e.type === 'ul'; })[0];
    R.a = { id: A.id, yedek: S.yedek(), goruntu: boylar(A.slides), taban: tabanlar(A.slides) };
    ua.text += '\\nDüzenlenmiş madde'; S.dirty(); S.saveNow();
    var ham = yuk(A.id), ka = JSON.parse(ham); R.a.kayit = boylar(ka.slides); R.a.metin = ham.indexOf('Düzenlenmiş madde') > 0; R.a.temaHf = ka.tema && ka.tema.hf; R.a.sizinti = /"(taban|son|fit|iz)"\\s*:/.test(ham);
    R.a.ekranSonra = boylar(A.slides);
    /* veritabanı satırları; deste paylaşımda, yedek yazı etkin → görüntü YAZILMAZ, hesaptaki son görüntü kalır, deste bekletilir */
    var TOK = 'dztokendztokendztokendz01', yerelA = JSON.stringify(kalici(A.slides));
    A.dbId = 'db-test'; A.share = TOK; bosZaman(); var f = sahte(); window.supabaseClient = f.c; await S.store.push(A);
    var sat = f.kayit.filter(function (x) { return x.t === 'presentation_slides' && x.op === 'ekle'; })[0], pr = f.kayit.filter(function (x) { return x.t === 'presentations' && x.op === 'guncelle'; })[0];
    R.a.db = sat ? boylar(sat.x.map(function (r) { return { els: r.content.els }; })) : null; R.a.dbTema = sat && sat.x[0].content.tema ? sat.x[0].content.tema.hf : null; R.a.dbSizinti = sat ? /"(taban|son)"\\s*:/.test(JSON.stringify(sat.x)) : null;
    R.a.paylasim = { satir: !!pr, alan: pr ? Object.prototype.hasOwnProperty.call(pr.x, 'share_snapshot') : null, bekle: A.snapBekle, ekranAyni: boylar(A.slides) === R.a.goruntu };
    /* "bağlantı oluştur" yedek yazı etkinken: bağlantı da görüntü de yazılmaz, yazı tipi uyarısı ("Yeniden dene") çıkar */
    A.share = null; var n0 = f.kayit.length; d.querySelector('[data-sh-on]').click(); await bekle(800);
    R.a.paylas = { not: d.querySelector('[data-sh-note]').textContent, yazilan: f.kayit.slice(n0).filter(function (x) { return x.t === 'presentations' && x.x && ('share_token' in x.x || 'share_snapshot' in x.x); }).length, share: A.share, uyari: d.querySelector('[data-toast-a]') ? d.querySelector('[data-toast-a]').getAttribute('href') : null };
    A.share = TOK; delete window.supabaseClient; S.saveNow(); R.a.yerelAyni = JSON.stringify(kalici(A.slides)) === yerelA && boylar(A.slides) === R.a.goruntu; R.a.bekleKayit = JSON.parse(yuk(A.id)).snapBekle;
    /* B: normal şablon (geniş yazı) ile basılır, kaydedilir */
    var B = await yeniDeste(sec('Dz Gen A'), 'B kayıt'); S.saveNow(); R.b = { id: B.id, yedek: S.yedek(), goruntu: boylar(B.slides), taban: tabanlar(B.slides), kayit: boylar(JSON.parse(yuk(B.id)).slides) };
    /* normal şablon yazısı: "bağlantı oluştur" ve sonraki kayıt görüntüyü ekrandaki (sığdırılmış) boyutlarla yazar (değişmeyen davranış) */
    bosZaman(); var fb = sahte(); window.supabaseClient = fb.c; await S.store.push(B); var yerelB = JSON.stringify(kalici(B.slides));      /* önce hesaba yazılır (bkz. rapor: shReady flush + push yarışı, #18 kapsamı dışı) */
    d.querySelector('[data-sh-on]').click(); await bekle(800);
    var ub = fb.kayit.filter(function (x) { return x.t === 'presentations' && x.x && x.x.share_token; })[0];
    R.b.paylas = { not: d.querySelector('[data-sh-note]').textContent, token: !!ub, snap: ub ? snapBoylar(ub.x.share_snapshot, B.slides) : null, share: !!B.share, yerelAyni: JSON.stringify(kalici(B.slides)) === yerelB && boylar(B.slides) === R.b.goruntu };
    bosZaman(); await S.store.push(B); var pb = fb.kayit.filter(function (x) { return x.t === 'presentations' && x.op === 'guncelle' && x.x.share_snapshot && !x.x.share_token; }).pop();
    R.b.push = pb ? snapBoylar(pb.x.share_snapshot, B.slides) : null; R.b.snap = ub ? ub.x.share_snapshot : null; R.b.snapYedek = ub ? /-apple-system/.test(JSON.stringify(ub.x.share_snapshot)) : null;
    delete window.supabaseClient; S.saveNow();
    /* C: yazar boyutu bilerek küçültür (gerçek kalem kutusu düğmesi) */
    var C = await yeniDeste(sec('Dz Gen A'), 'C kayıt'), uc = C.slides[1].els.filter(function (e) { return e.type === 'ul'; })[0];
    R.c = { id: C.id, oncekiEkran: uc.size, oncekiAsil: S.kaliciBoy(uc) }; C.cur = 1; S.sec(uc.id); S.op('smaller'); S.op('smaller');
    R.c.yazar = uc.size; R.c.asilSimdi = S.kaliciBoy(uc); S.fitSlide(C.slides[1]); R.c.sigdirSonra = uc.size; S.saveNow();
    R.c.kayit = JSON.parse(yuk(C.id)).slides[1].els.filter(function (e) { return e.id === uc.id; })[0].size; R.c.uid = uc.id;
    /* D: geri al / yinele */
    var D = await yeniDeste(sec('Dz Gen A'), 'D kayıt'), ud = D.slides[1].els.filter(function (e) { return e.type === 'ul'; })[0];
    var e0 = boylar(D.slides), t0 = tabanlar(D.slides), m0 = ud.text;
    S.pushU(); ud.text += '\\nGeri alınacak madde'; S.fitSlide(D.slides[1]); S.undo();
    var D2 = S.deck(); R.d = { geriEkran: boylar(D2.slides) === e0, geriAsil: tabanlar(D2.slides) === t0, geriMetin: D2.slides[1].els.filter(function (e) { return e.type === 'ul'; })[0].text === m0 };
    S.redo(); R.d.ileriMetin = /Geri alınacak madde/.test(JSON.stringify(S.deck().slides)); R.d.ileriAsil = tabanlar(S.deck().slides).split('|')[0] === t0.split('|')[0];
    S.undo(); var g1 = boylar(S.deck().slides); S.deck().slides.forEach(function (s) { S.fitSlide(s); S.fitSlide(s); }); R.d.birikmeYok = boylar(S.deck().slides) === g1;
    /* görüntü A yazısıyla alındı, şablon B'ye geçti, sonra geri al: geri gelen asetatlar B yazısıyla ASIL boyutlarından sığdırılır */
    S.pushU(); S.temaSec(sec('Dz Dar B')); await sakin(); var ekB = boylar(S.deck().slides); S.undo(); await sakin();
    R.d.capraz = boylar(S.deck().slides); R.d.taze = taze(kalici(S.deck().slides)); R.d.ekB = ekB; R.d.e0 = e0;
    R.d.json = /"(taban|son)"\\s*:/.test(JSON.stringify(S.deck().slides));
    /* Y (#18 ZORUNLU): asıl 24 px, sığdırılmış 18 px; yazar bilerek 18 px seçer (küçült + büyüt = son sığdırmayla aynı boyut) */
    var Y = await yeniDeste(sec('Dz Gen A'), 'Y kayıt'), ys = { id: 'y-sl', bg: 'clear', notes: '', els: [] }; Y.slides.push(ys);
    var ye = { id: 'y-ul', type: 'ul', x: 90, y: 120, w: 700, h: 400, text: [UZ, UZ + ' iki', UZ + ' üç'].join('\\n'), size: 18, color: '#0D1838', align: 'left', bold: false };
    var h18 = S.measureH(ye, ys); ye.h = h18; ye.size = 20; var h20 = S.measureH(ye, ys); ye.size = 24; ys.els.push(ye); S.fitSlide(ys);
    R.y = { id: Y.id, h18: h18, h20: h20, sigdi: ye.size, asil0: S.kaliciBoy(ye) };
    Y.cur = Y.slides.length - 1; S.sec('y-ul'); S.op('smaller'); R.y.ara = [ye.size, S.kaliciBoy(ye)]; S.op('bigger'); R.y.yazar = ye.size; R.y.asil = S.kaliciBoy(ye);
    S.fitSlide(ys); R.y.sigdirSonra = ye.size; R.y.asilSonra = S.kaliciBoy(ye); S.saveNow();
    var yk = JSON.parse(yuk(Y.id)); R.y.kayit = yk.slides.filter(function (s) { return s.id === 'y-sl'; })[0].els[0].size; R.y.json = iz.test(yuk(Y.id));
    /* fitKopya, gerçek yol 1: kalem kutusu "çoğalt" (asıl boyutu sığdırılmış boyuttan büyük bir öğe) */
    Y.cur = 1; var s1 = Y.slides[1], yu = s1.els.filter(function (e) { return e.type === 'ul'; })[0], YU = yu.id; R.k = { T: S.kaliciBoy(yu), F: yu.size };
    S.sec(YU); S.op('dup'); var kc = bul(S.selId()), kk = kalici(S.deck().slides[1]);
    R.k.dup = { yeni: kc && kc.id !== YU, boy: kc.size, asil: S.kaliciBoy(kc), json: kk.els.filter(function (e) { return e.id === kc.id; })[0].size, sizinti: iz.test(JSON.stringify(kk)), asilOrj: S.kaliciBoy(yu), boyOrj: yu.size };
    var tz = JSON.parse(JSON.stringify(kk)); S.fitSlide(tz); S.fitSlide(S.deck().slides[1]);
    R.k.dup.sigdi = kc.size; R.k.dup.taze = tz.els.filter(function (e) { return e.id === kc.id; })[0].size; R.k.dup.asilSonra = S.kaliciBoy(kc); R.k.dup.orjSonra = [yu.size, S.kaliciBoy(yu)];
    S.undo(); yu = bul(YU); R.k.dupGeri = [yu.size, S.kaliciBoy(yu), S.deck().slides[1].els.length];
    /* fitKopya, gerçek yol 2: asetatı çoğalt (küçük resim düğmesi) */
    var n1 = S.deck().slides.length; d.querySelector('[data-tdup="1"]').click(); var o1 = S.deck().slides[1], c1 = S.deck().slides[2];
    R.k.tdup = { n: S.deck().slides.length - n1, asil: yazilar(c1).map(function (e) { return S.kaliciBoy(e); }).join(','), asilOrj: yazilar(o1).map(function (e) { return S.kaliciBoy(e); }).join(','), boy: yazilar(c1).map(function (e) { return e.size; }).join(','), boyOrj: yazilar(o1).map(function (e) { return e.size; }).join(','), idFarkli: c1.els.every(function (e, j) { return e.id !== o1.els[j].id; }), sizinti: iz.test(JSON.stringify(kalici([c1]))) };
    var tz2 = kalici([c1]); S.fitSlide(tz2[0]); S.fitSlide(c1); R.k.tdup.sigdi = yazilar(c1).map(function (e) { return e.size; }).join(','); R.k.tdup.taze = yazilar(tz2[0]).map(function (e) { return e.size; }).join(','); R.k.tdup.orjSonra = yazilar(o1).map(function (e) { return S.kaliciBoy(e) + '/' + e.size; }).join(',');
    S.undo(); R.k.tdupGeri = S.deck().slides.length === n1;
    /* fitKopya doğrudan: boyutu aynı kopya kaydı alır; boyutu değişen kopya almaz (yeni boyut asıl boyuttur) */
    yu = bul(YU); var k1 = JSON.parse(JSON.stringify(yu)), k2 = JSON.parse(JSON.stringify(yu)); k2.size = yu.size + 3; S.fitKopya(yu, k1); S.fitKopya(yu, k2);
    R.k.dogrudan = { k1: S.kaliciBoy(k1), k2: S.kaliciBoy(k2), k2boy: k2.size, orj: [yu.size, S.kaliciBoy(yu)], json: JSON.stringify([k1, k2], S.kaliciJSON) };
    /* fitAktar, gerçek yol: Acadia "soru ekle" (model yok → yerel AI.q; çalışma kopyası JSON'dur, kayıt fitAktar ile taşınır) */
    bosZaman(); var fq = sahte(); window.supabaseClient = fq.c; var eskiEls = S.deck().slides[1].els.slice(), yuEski = bul(YU), eskiIz = [yuEski.size, S.kaliciBoy(yuEski)];
    d.querySelector('[data-ai="q"]').click(); await bekle(1200); await sakin(); delete window.supabaseClient;
    var s1b = S.deck().slides[1], yuY = bul(YU);
    R.a2 = { yeniDizi: s1b.els.length > eskiEls.length, yeniNesne: yuY !== yuEski, yeni: [yuY.size, S.kaliciBoy(yuY)], eski: eskiIz, eskiSonra: [yuEski.size, S.kaliciBoy(yuEski)], soru: /Soru:/.test(JSON.stringify(s1b.els)) };
    var kk2 = kalici([s1b]); R.a2.json = kk2[0].els.filter(function (e) { return e.id === YU; })[0].size; R.a2.sizinti = iz.test(JSON.stringify(kk2));
    var tz3 = JSON.parse(JSON.stringify(kk2)); S.fitSlide(tz3[0]); S.fitSlide(s1b); R.a2.sigdi = yuY.size; R.a2.taze = tz3[0].els.filter(function (e) { return e.id === YU; })[0].size;
    /* fitAktar doğrudan: kimliği eşleşen ve boyutu aynı öğe kaydı alır; boyutu değişen ya da yeni öğe almaz */
    var ey = s1b.els, yy = JSON.parse(JSON.stringify(ey)), yi = yy.filter(function (e) { return e.id === YU; })[0], ht = yy.filter(function (e) { return e.type === 'h'; })[0];
    ht.size = ht.size - 2; yy.push({ id: 'yeni-t', type: 't', x: 90, y: 480, w: 300, h: 30, text: 'yeni', size: 20 }); S.fitAktar(ey, yy);
    R.a2.dogrudan = { yu: S.kaliciBoy(yi), h: [ht.size, S.kaliciBoy(ht)], yeniT: S.kaliciBoy(yy[yy.length - 1]), orj: [bul(YU).size, S.kaliciBoy(bul(YU))], json: iz.test(JSON.stringify(yy, S.kaliciJSON)) };
    /* büyüt / küçült ve geri al / yinele (yazar boyutu her adımda asıl boyut; geri al önceki asıl boyutu geri getirir) */
    var Y0 = an(YU); S.sec(YU); S.op('smaller'); var Y1 = an(YU); S.op('bigger'); var Y2 = an(YU); S.op('bigger'); var Y3 = an(YU);
    S.undo(); var U1 = an(YU); S.undo(); var U2 = an(YU); S.undo(); var U3 = an(YU); S.redo(); var R1 = an(YU); S.redo(); var R2 = an(YU); S.redo(); var R3 = an(YU);
    S.fitSlide(S.deck().slides[1]); R.u = { Y: [Y0, Y1, Y2, Y3], U: [U1, U2, U3], R: [R1, R2, R3], fit: an(YU) };
    R.y.son = an('y-ul'); S.saveNow();
    /* E: eski (bu değişiklikten önce kaydedilmiş) deste: boyutlar olduğu gibi */
    var L = { id: 'eski-1', dbId: null, title: 'Eski deste', cur: 0, source: 'blank', sourceId: null, slides: [{ id: 'L1', lay: 'list', bg: 'clear', notes: 'not', els: [{ id: 'Lh', type: 'h', x: 70, y: 46, w: 820, h: 74, text: 'Eski deste', size: 42, color: '#0D1838', align: 'left', bold: false }, { id: 'Lu', type: 'ul', x: 90, y: 160, w: 780, h: 160, text: [UZ, UZ, UZ, UZ].join('\\n'), size: 22, color: '#0D1838', align: 'left', bold: false }] }] };
    localStorage.setItem(S.store.k('d.eski-1'), JSON.stringify(L)); S.store.list.push({ id: 'eski-1', title: 'Eski deste', n: 1, updated: 1 }); S.store.putList();
    R.ids = { A: A.id, B: B.id, C: C.id, Y: Y.id };
`;
  const F2 = `
    await sakin(); var ids = JSON.parse(localStorage.getItem('dz-f-ids') || 'null');
    R.yuklenen = !!ids;
    /* A: yeniden yükle, şablon yazısı artık var → asıl boyutlardan sığdırılır = taze sığdırma */
    var hamA = yuk(ids.A), kayA = JSON.parse(hamA); bosZaman(); var fa = sahte(); window.supabaseClient = fa.c; await S.openDeck(ids.A); await sakin(); var A = S.deck();
    R.a = { acildi: A.id === ids.A, yedek: S.yedek(), ekran: boylar(A.slides), taze: taze(kayA.slides), kayit: boylar(kayA.slides), metin: /Düzenlenmiş madde/.test(JSON.stringify(A.slides)), temaHf: A.tema && A.tema.hf };
    /* 18B: açılış desteyi KAYDETMEZ (bekleyen işaret olsa bile). Görüntünün yalnız görüntü olarak yazılması durumlu sunucu
       ister: tests/sunum-capraz-cihaz.js. Burada görüntü, snapTazele'nin kullandığı snapKur ile sığdırılmış desteden kurulur. */
    await bekle(2500); R.a.acilisYazma = fa.kayit.filter(function (x) { return x.t === 'presentation_slides' || (x.t === 'presentations' && x.op === 'guncelle' && 'slide_count' in x.x); }).length; delete window.supabaseClient;
    var pa = { x: { share_snapshot: S.snapKur(A) } };
    S.dirty(); S.saveNow(); R.a.kayit2 = boylar(JSON.parse(yuk(ids.A)).slides);
    R.a.bekleOnce = kayA.snapBekle; R.a.snap = pa.x.share_snapshot; R.a.snapBoy = snapBoylar(pa.x.share_snapshot, A.slides); R.a.ekran2 = boylar(A.slides);
    R.a.yedekYazi = /-apple-system/.test(JSON.stringify(pa.x.share_snapshot));
    R.a.kontrol = S.snapKur({ tema: A.tema, slides: kalici(A.slides) }); R.a.kontrolBoy = snapBoylar(R.a.kontrol, A.slides);      /* #17'nin yedek yazıdaki görüntüsü (asıl boyutlar): izleyici ölçümünün duyarlılığı için */
    R.a.editorTasan = A.slides.map(function (s) { return yazilar(s).filter(function (e) { return S.measureH(e, s) > e.h + 3; }).length; }).reduce(function (x, y) { return x + y; }, 0);
    /* B: yeniden yükle, B şablonuyla aç, A'ya dön → taze A */
    var kayB = JSON.parse(yuk(ids.B)); await S.openDeck(ids.B); await sakin(); var ilkA = boylar(S.deck().slides);
    S.temaSec(sec('Dz Dar B')); await sakin(); var ekB = boylar(S.deck().slides); S.temaSec(sec('Dz Gen A')); await sakin();
    R.b = { ilkA: ilkA, ekB: ekB, sonA: boylar(S.deck().slides), taze: taze(kayB.slides), kayit2: (S.saveNow(), boylar(JSON.parse(yuk(ids.B)).slides)), kayit1: boylar(kayB.slides) };
    /* C: yazarın boyutu korunur, sığdırma oradan başlar */
    await S.openDeck(ids.C); await sakin(); var uc = S.deck().slides[1].els.filter(function (e) { return e.id === ids.Cuid; })[0];
    R.c = { boy: uc && uc.size, asil: uc && S.kaliciBoy(uc) };
    /* Y: yazarın 18 px'i asıl boyut: yeniden aç (Gen A), dar şablonla sığdır, geri dön — hep 18'den */
    await S.openDeck(ids.Y); await sakin(); var ysl = S.deck().slides.filter(function (s) { return s.id === 'y-sl'; })[0], yel = ysl && ysl.els[0];
    var ykay = function () { return JSON.parse(yuk(ids.Y)).slides.filter(function (s) { return s.id === 'y-sl'; })[0].els[0].size; };
    R.y = { acik: yel.size, asil: S.kaliciBoy(yel), kayit0: ykay() };
    S.temaSec(sec('Dz Dar B')); await sakin(); yel = bul('y-ul'); R.y.darB = yel.size; R.y.asilB = S.kaliciBoy(yel); S.saveNow(); R.y.kayitB = ykay();
    S.temaSec(sec('Dz Gen A')); await sakin(); yel = bul('y-ul'); R.y.genA = yel.size; R.y.asilA = S.kaliciBoy(yel); S.saveNow(); R.y.kayitA = ykay(); R.y.json = iz.test(yuk(ids.Y));
    /* E: eski deste okunur, boyutlar tahmin edilmez */
    await S.openDeck('eski-1'); await sakin(); var L = S.deck();
    R.e = { acildi: L.id === 'eski-1', slides: L.slides.length, metin: L.slides[0].els[1].text.split('\\n').length, boy: L.slides[0].els[1].size, asil: S.kaliciBoy(L.slides[0].els[1]) };
    S.dirty(); S.saveNow(); R.e.kayit = JSON.parse(yuk('eski-1')).slides[0].els[1].size;
`;
  let RF1 = null, RF2 = null, hataF = null;
  try {
    const p1 = sayfaF({ 'dz-kayip': 'cdn' }, F1 + "    localStorage.setItem('dz-f-ids', JSON.stringify(Object.assign({}, R.ids, { Cuid: R.c.uid })));\n    await bekle(300);\n");
    fs.writeFileSync(path.join(W, 'f1.html'), p1); fs.writeFileSync(path.join(W, 'f2.html'), sayfaF({ 'dz-kayip': 'ok' }, F2));
    const kosF = (dosya) => { const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + path.join(W, 'prof-f'), '--allow-file-access-from-files', '--virtual-time-budget=90000', '--dump-dom', pathToFileURL(path.join(W, dosya)).href], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 180000 }).toString(); const m = dom.match(/<pre id="diag">([\s\S]*?)<\/pre>/); return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&')); };
    RF1 = kosF('f1.html'); RF2 = kosF('f2.html');
  } catch (e) { hataF = e; }
  const F = (name, fn) => test(name, () => { if (hataF) throw hataF; assert.ok(!RF1.hata, 'F1: ' + RF1.hata); assert.ok(!RF2.hata, 'F2: ' + RF2.hata); fn(RF1, RF2); });

  F('F1 yedek yazı: kayıt (tarayıcı ve hesap) ASIL boyutu taşır, yedek yazıyla sığdırılmış boyutu değil; metin ve şablon korunur', (a, b) => {
    assert.equal(a.a.yedek, 1); assert.notEqual(a.a.goruntu, a.a.taban, 'yedek yazıyla küçülme olmalı (yoksa test anlamsız)');
    assert.equal(a.a.kayit, a.a.taban); assert.equal(a.a.db, a.a.taban); assert.equal(a.a.ekranSonra, a.a.goruntu, 'ekrandaki sığdırılmış boyut değişmemeli');
    assert.equal(a.a.metin, true); assert.equal(a.a.temaHf, 'Dz Kayip'); assert.equal(a.a.dbTema, 'Dz Kayip'); assert.equal(a.a.sizinti, false); assert.equal(a.a.dbSizinti, false);
  });
  F('F2 yedek yazı → yeniden yükle → şablon yazısı gelir: sonuç taze sığdırmayla aynı, kayıt kaymaz', (a, b) => {
    assert.equal(b.yuklenen, true); assert.equal(b.a.acildi, true); assert.equal(b.a.yedek, 0); assert.equal(b.a.kayit, a.a.taban);
    assert.equal(b.a.ekran, b.a.taze); assert.equal(b.a.metin, true); assert.equal(b.a.temaHf, 'Dz Kayip'); assert.equal(b.a.kayit2, b.a.kayit, 'yeniden kayıt asıl boyutu değiştirmemeli');
  });
  F('F3 yedek yazı etkinken paylaşım görüntüsü yazılmaz: hesaptaki görüntü değişmez, "bağlantı oluştur" reddedilir, deste bekletilir, deste verisi değişmez', (a) => {
    assert.equal(a.a.paylasim.satir, true); assert.equal(a.a.paylasim.alan, false, 'kayıt share_snapshot alanına dokunmamalı'); assert.equal(a.a.paylasim.bekle, 1); assert.equal(a.a.paylasim.ekranAyni, true);
    assert.equal(a.a.paylas.yazilan, 0, 'bağlantı ve görüntü yazılmamalı'); assert.equal(a.a.paylas.share, null); assert.match(a.a.paylas.not, /şablon yazı tipi bu cihazda yüklenemedi/); assert.equal(a.a.paylas.uyari, '#sx-yazi-tipi');
    assert.equal(a.a.yerelAyni, true); assert.equal(a.a.bekleKayit, 1);
  });
  F('F9 şablon yazısı gelince: açılış desteyi kaydetmez (18B); görüntü ekrandaki (sığdırılmış) boyutlarla kurulur; normal şablonda paylaşım değişmedi', (a, b) => {
    assert.equal(b.a.bekleOnce, 1); assert.equal(b.a.acilisYazma, 0, 'açılış asetatları ya da satırı yazmamalı'); assert.equal(b.a.snapBoy, b.a.ekran2); assert.equal(b.a.ekran2, b.a.taze);
    assert.equal(b.a.yedekYazi, false); assert.deepEqual(b.a.snap.fonts, ['Dz Kayip', 'Dz Kayip']);
    assert.notEqual(b.a.kontrolBoy, b.a.snapBoy, 'asıl boyutlu görüntü sığdırılmış görüntüden farklı olmalı (yoksa izleyici ölçümü anlamsız)');
    assert.equal(a.b.paylas.token, true, a.b.paylas.not); assert.equal(a.b.paylas.share, true); assert.equal(a.b.paylas.snap, a.b.goruntu); assert.notEqual(a.b.goruntu, a.b.taban, 'B sığdırılmış olmalı');
    assert.equal(a.b.push, a.b.goruntu); assert.equal(a.b.paylas.yerelAyni, true); assert.equal(a.b.snapYedek, false);
  });
  F('F10 ZORUNLU: asıl 24 → sığdırılmış 18; yazar bilerek 18 seçer → asıl 18; kaydet, yeniden aç, başka şablonla sığdır: asıl 18 kalır', (a, b) => {
    assert.ok(a.y.h20 > a.y.h18 + 3, 'kutu 18 px\'e göre kurulmalı (20 taşmalı)'); assert.equal(a.y.sigdi, 18); assert.equal(a.y.asil0, 24);
    assert.deepEqual(a.y.ara, [16, 16]); assert.equal(a.y.yazar, 18); assert.equal(a.y.asil, 18, 'yazarın 18\'i son sığdırmayla aynı; eskiden 24 sayılıyordu');
    assert.equal(a.y.sigdirSonra, 18); assert.equal(a.y.asilSonra, 18); assert.equal(a.y.kayit, 18); assert.equal(a.y.json, false); assert.deepEqual(a.y.son, [18, 18]);
    assert.equal(b.y.kayit0, 18); assert.equal(b.y.acik, 18); assert.equal(b.y.asil, 18); assert.ok(b.y.darB <= 18); assert.equal(b.y.asilB, 18); assert.equal(b.y.kayitB, 18);
    assert.equal(b.y.genA, 18); assert.equal(b.y.asilA, 18); assert.equal(b.y.kayitA, 18); assert.equal(b.y.json, false);
  });
  F('F11 büyüt / küçült ve geri al / yinele: her adımda yazarın boyutu asıl boyut; geri al önceki asıl boyutu geri getirir; sığdırma son tercihten başlar', (a) => {
    const [Y0, Y1, Y2, Y3] = a.u.Y, F = Y0[0];
    assert.ok(Y0[1] > Y0[0], 'öğe önce sığdırılmış olmalı'); assert.deepEqual(Y1, [F - 2, F - 2]); assert.deepEqual(Y2, [F, F], 'son sığdırmayla aynı boyut da yazarın tercihi'); assert.deepEqual(Y3, [F + 2, F + 2]);
    assert.deepEqual(a.u.U, [Y2, Y1, Y0]); assert.deepEqual(a.u.R, [Y1, Y2, Y3]); assert.ok(a.u.fit[1] === F + 2 && a.u.fit[0] <= F + 2);
  });
  F('F12 fitKopya: öğe ve asetat çoğaltma asıl boyutu kopyaya taşır, kopya asıl boyuttan sığdırılır, orijinal değişmez, kalıcı JSON temiz', (a) => {
    const k = a.k; assert.ok(k.T > k.F, 'öğe sığdırılmış olmalı');
    assert.equal(k.dup.yeni, true); assert.equal(k.dup.boy, k.F); assert.equal(k.dup.asil, k.T); assert.equal(k.dup.json, k.T); assert.equal(k.dup.sizinti, false); assert.equal(k.dup.asilOrj, k.T); assert.equal(k.dup.boyOrj, k.F);
    assert.equal(k.dup.sigdi, k.dup.taze); assert.equal(k.dup.asilSonra, k.T); assert.deepEqual(k.dup.orjSonra, [k.F, k.T]); assert.deepEqual(k.dupGeri.slice(0, 2), [k.F, k.T]);
    assert.equal(k.tdup.n, 1); assert.equal(k.tdup.asil, k.tdup.asilOrj); assert.equal(k.tdup.boy, k.tdup.boyOrj); assert.notEqual(k.tdup.asil, k.tdup.boy, 'asetatta sığdırılmış öğe olmalı'); assert.equal(k.tdup.idFarkli, true); assert.equal(k.tdup.sizinti, false);
    assert.equal(k.tdup.sigdi, k.tdup.taze); assert.equal(k.tdup.sigdi, k.tdup.boyOrj); assert.equal(k.tdup.orjSonra, k.tdup.asilOrj.split(',').map((x, i) => x + '/' + k.tdup.boyOrj.split(',')[i]).join(',')); assert.equal(k.tdupGeri, true);
    assert.equal(k.dogrudan.k1, k.T); assert.equal(k.dogrudan.k2, k.dogrudan.k2boy); assert.deepEqual(k.dogrudan.orj, [k.F, k.T]); assert.ok(!/"(taban|son)"/.test(k.dogrudan.json));
    assert.deepEqual(JSON.parse(k.dogrudan.json).map((e) => e.size), [k.T, k.dogrudan.k2boy]);
  });
  F('F13 fitAktar: Acadia çalışma kopyası asıl boyutu taşır, hedef asıl boyuttan sığdırılır, eski öğenin kaydı değişmez, kalıcı JSON temiz', (a) => {
    const q = a.a2; assert.equal(q.soru, true, 'Acadia soru eklemedi'); assert.equal(q.yeniDizi, true); assert.equal(q.yeniNesne, true, 'Acadia öğeleri yeni nesnelerle değiştirir');
    assert.ok(q.eski[1] > q.eski[0], 'öğe sığdırılmış olmalı'); assert.deepEqual(q.yeni, q.eski); assert.deepEqual(q.eskiSonra, q.eski); assert.equal(q.json, q.eski[1]); assert.equal(q.sizinti, false); assert.equal(q.sigdi, q.taze);
    assert.equal(q.dogrudan.yu, q.eski[1]); assert.equal(q.dogrudan.h[1], q.dogrudan.h[0], 'boyutu değişen öğe yeni boyutu asıl sayar'); assert.equal(q.dogrudan.yeniT, 20); assert.equal(q.dogrudan.json, false);
  });
  F('F4 normal şablon: A ile kaydet → yeniden yükle → B → A = taze A; kayıt asıl boyutu taşır', (a, b) => {
    assert.equal(a.b.yedek, 0); assert.equal(a.b.kayit, a.b.taban); assert.equal(b.b.kayit1, a.b.taban);
    assert.equal(b.b.ilkA, b.b.taze); assert.equal(b.b.sonA, b.b.taze); assert.notEqual(b.b.ekB, b.b.sonA, 'geniş ve dar yazı farklı sığdırmalı'); assert.equal(b.b.kayit2, b.b.kayit1);
  });
  F('F5 yazarın bilerek değiştirdiği boyut asıl boyut olur, kaydedilir, yeniden yüklemede korunur ve sığdırma oradan başlar', (a, b) => {
    assert.ok(a.c.oncekiAsil > a.c.oncekiEkran, 'öğe önce küçültülmüş olmalı'); assert.equal(a.c.yazar, a.c.oncekiEkran - 4);
    assert.equal(a.c.asilSimdi, a.c.yazar); assert.equal(a.c.sigdirSonra, a.c.yazar, 'sığdırma eski asıl boyuttan başladı'); assert.equal(a.c.kayit, a.c.yazar);
    assert.equal(b.c.boy, a.c.yazar); assert.equal(b.c.asil, a.c.yazar);
  });
  F('F6 geri al / yinele: içerik ve asıl boyut korunur; yeniden sığdırma birikmez; başka yazı durumundaki görüntü taze sığdırılır', (a) => {
    assert.deepEqual([a.d.geriEkran, a.d.geriAsil, a.d.geriMetin, a.d.ileriMetin, a.d.ileriAsil, a.d.birikmeYok], [true, true, true, true, true, true]);
    assert.equal(a.d.capraz, a.d.taze); assert.notEqual(a.d.capraz, a.d.e0, 'geri gelen asetatlar eski yazının boyutunda kalmamalı'); assert.equal(a.d.json, false);
  });
  F('F7 eski kayıtlı deste okunur; asıl boyut tahmin edilmez, kayıttaki boyut korunur', (a, b) => {
    assert.equal(b.e.acildi, true); assert.equal(b.e.slides, 1); assert.equal(b.e.metin, 4); assert.ok(b.e.boy <= 22); assert.equal(b.e.asil, 22); assert.equal(b.e.kayit, 22);
  });
  F('F8 ağ isteği yok; ekran, PPTX ve kayıt ayrımı kaynakta', (a, b) => {
    assert.deepEqual(a.ag, []); assert.deepEqual(b.ag, []);
    const ex = cut('  var exportPptx = async function (btn) {', '  /* ---------- paylaşım bağlantısı');
    assert.match(ex, /await yaziHazirSoz\(\);/); assert.ok(!/kaliciBoy|kaliciJSON/.test(ex), 'PPTX sığdırılmış (ekrandaki) boyutu kullanmalı');
    ["S(store.k('d.' + d.id), d, kaliciJSON)", "S(store.k('d.' + m.id), d, kaliciJSON)", "S(store.k('d.' + m.id), gone, kaliciJSON)", 'els: JSON.parse(JSON.stringify(sl.els, kaliciJSON))'].forEach((x) => assert.ok(ink.includes(x), 'kalıcı yol asıl boyutu yazmalı: ' + x));
    assert.equal((ink.match(/S\(store\.k\('d\.'/g) || []).length, 6, 'deste kaydı yolları: saveLocal, push sonrası, buluttan önbellek, silmeyi geri al, görüntü yenileme (işaret silinir), gezinme saveCur (#56)');      /* #56: saveCur de kaliciJSON ile yazar */
    assert.ok(ink.includes("var yerel = function () { delete d.snapBekle; S(store.k('d.' + d.id), d, kaliciJSON); }"), 'görüntü yenileme de asıl boyutu yazmalı');
  });
  /* ---------------- V sayfaları: GERÇEK izleyici (izle.html) — paylaşım görüntüsünü açar, her asetatta taşmayı ölçer ----------------
     Sayfanın kendi betiği değişmez; yalnız dış adresler yerele çevrilir: DOMPurify node_modules'tan, Supabase istemcisi
     yerine görüntüyü döndüren sahte rpc, bağlantı anahtarı sabit, yazı tipleri KESICI ile yerel CSS'ten (ağa çıkılmaz). */
  const izle = read('izle.html');
  const OLCER = `<pre id="diag"></pre><script>
(async function () { var R = { slides: [] }, bekle = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  try {
    for (var k = 0; k < 100 && !document.querySelector('#vw-stage .sx-slide'); k++) await bekle(50);
    await bekle(300); await document.fonts.ready; await bekle(300);
    R.n = +(document.getElementById('vw-pos').textContent.split('/')[1] || 0); R.yuz = Array.from(document.fonts).map(function (f) { return f.family.replace(/"/g, '') + ':' + f.status; });
    for (var i = 0; i < R.n; i++) {
      var els = Array.from(document.querySelectorAll('#vw-stage .sx-el')).filter(function (e) { return /^(h|t|ul)$/.test(e.getAttribute('data-type')) && !e.classList.contains('muted') && e.textContent.trim(); });
      R.slides.push({ yazi: els.length, tasan: els.filter(function (e) { return e.scrollHeight > e.clientHeight + 3 || e.scrollWidth > e.clientWidth + 3; }).map(function (e) { return e.getAttribute('data-type') + ':' + (e.scrollHeight - e.clientHeight); }) });
      document.getElementById('vw-next').click(); await bekle(80);
    }
  } catch (e) { R.hata = String(e && e.stack || e); }
  R.ag = window.__ag || []; document.getElementById('diag').textContent = JSON.stringify(R);
})();
</script>`;
  const sayfaV = (snap, senaryo) => {
    let h = izle; const r = (a, b) => { assert.equal(h.split(a).length - 1, 1, 'izle.html değişmiş: ' + a); h = h.replace(a, b); };
    const veri = JSON.stringify(Object.assign({ title: 'İzleyici testi', language: 'tr' }, snap)).replace(/</g, '\\u003c');
    r('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">', '');
    r('href="css/acadex-ink.css"', 'href="' + pathToFileURL(path.join(ROOT, 'css/acadex-ink.css')).href + '"');
    r('<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js"></script>', '<script src="' + pathToFileURL(path.join(ROOT, 'node_modules/dompurify/dist/purify.min.js')).href + '"></script>');
    r('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>', KESICI + `<script>Object.assign(window.__senaryo, ${JSON.stringify(senaryo)}); window.supabaseClient = { rpc: function () { return Promise.resolve({ data: ${veri}, error: null }); } };</script>`);
    r('<script src="js/supabase-config.js"></script>', '');
    r("new URLSearchParams(location.search).get('k') || ''", "'dztokendztokendztokendz01'");
    h = h.replace(/<link rel="(icon|apple-touch-icon)"[^>]*>\n/g, '').replace('<img src="assets/logo-icon-only.png" alt="">', '');
    return h.replace('</body>', OLCER + '\n</body>');
  };
  const V = {}; let hataV = null;
  try {
    if (RF2 && RF2.a && RF2.a.snap) {
      V.ok = kos('v-ok.html', sayfaV(RF2.a.snap, { 'dz-kayip': 'ok' }));
      V.yok = kos('v-yok.html', sayfaV(RF2.a.snap, { 'dz-kayip': 'cdn' }));
      V.kontrol = kos('v-kontrol.html', sayfaV(RF2.a.kontrol, { 'dz-kayip': 'ok' }));
    }
    if (RF1 && RF1.b && RF1.b.snap) V.b = kos('v-b.html', sayfaV(RF1.b.snap, {}));
  } catch (e) { hataV = e; }
  const tasan = (r) => r.slides.reduce((n, x) => n + x.tasan.length, 0);
  const Vt = (name, fn) => test(name, () => { if (hataF) throw hataF; if (hataV) throw hataV; ['ok', 'yok', 'kontrol', 'b'].forEach((k) => { assert.ok(V[k], 'izleyici sayfası kurulmadı: ' + k); assert.ok(!V[k].hata, k + ': ' + V[k].hata); assert.deepEqual(V[k].ag, [], k + ': ağ isteği'); }); fn(V); });
  Vt('F14 gerçek izleyici, şablon yazısı yüklü: yedek yazıdan sonra şablon yazısıyla yazılan görüntüde uzun metin ve listeler taşmaz; #17\'nin asıl boyutlu görüntüsü taşardı', (V) => {
    assert.equal(V.ok.n, RF2.a.snap.slides.length); assert.ok(V.ok.yuz.includes('Dz Kayip:loaded'), V.ok.yuz.join(' '));
    assert.equal(RF2.a.editorTasan, 0); assert.equal(tasan(V.ok), 0, JSON.stringify(V.ok.slides));
    assert.ok(tasan(V.kontrol) > 0, 'ölçüm duyarlı olmalı: asıl boyutlu görüntü taşmalı ' + JSON.stringify(V.kontrol.slides));
    console.log('    izleyici, şablon yazısı yüklü: bekletilip yazılan görüntü ' + tasan(V.ok) + ' taşan · #17 asıl boyutlu görüntü ' + tasan(V.kontrol) + ' taşan ' + JSON.stringify(V.kontrol.slides.map((x) => x.tasan)) + ' · normal şablon (B) ' + tasan(V.b));
    assert.equal(V.b.n, RF1.b.snap.slides.length); assert.ok(V.b.yuz.includes('Dz Gen A:loaded'), V.b.yuz.join(' ')); assert.equal(tasan(V.b), 0, JSON.stringify(V.b.slides));
  });
  Vt('F15 gerçek izleyici, şablon yazısı izleyicide yüklenemez: sayfa bütün asetatları çizer (yeniden sığdırma yok); taşma ölçülüp raporlanır', (V) => {
    assert.equal(V.yok.n, RF2.a.snap.slides.length); assert.ok(!V.yok.yuz.includes('Dz Kayip:loaded'), V.yok.yuz.join(' '));
    assert.ok(V.yok.slides.every((x) => x.yazi > 0)); console.log('    izleyicide şablon yazısı yok → taşan yazı kutusu: ' + tasan(V.yok) + ' ' + JSON.stringify(V.yok.slides.map((x) => x.tasan)));
  });
  try { fs.rmSync(W, { recursive: true, force: true }); } catch (e) { /* geçici klasör */ }
  const D = (name, fn) => test(name, () => { if (hataD) throw hataD; assert.ok(!RD.hata, RD.hata); fn(RD); });
  const Ex = (name, fn) => test(name, () => { if (hataE) throw hataE; assert.ok(!RE.hata, RE.hata); fn(RE); });

  D('D1 başarı: stil sayfası + her ağırlıkta gerçek FontFace (Türkçe alt küme dahil) → ok, yedek yok', (R) => {
    assert.deepEqual(R.d1.r, { ok: true, aileler: ['Dz Basari'], hata: [] }); assert.equal(R.d1.yedek, 0);
    assert.ok(R.d1.yuz.filter((x) => /:loaded$/.test(x)).length >= 4, 'latin + latin-ext × 400/700 yüklenmeli: ' + R.d1.yuz.join(' '));
  });
  D('D2 CDN hatası → ok:false, ortak yedek yazı, kurtarılabilir bildirim; başarılı şablona dönünce yedek kalkar', (R) => {
    assert.equal(R.d2.r.ok, false); assert.deepEqual(R.d2.r.hata, ['Dz Cdn']); assert.equal(R.d2.yedek, 1);
    assert.deepEqual(R.d2.toast, { t: 'Şablon yazı tipi yüklenemedi; varsayılan yazı tipiyle gösteriliyor.', a: '#sx-yazi-tipi', al: 'Yeniden dene' });
    assert.equal(R.d2b.yedek, 0);
  });
  D('D3 stil sayfası yüklendi ama FontFace yok → başarısız sayılır (check() olsaydı geçerdi)', (R) => { assert.equal(R.d3.r.ok, false); assert.equal(R.d3.yedek, 1); assert.equal(R.d3.yuz.length, 0); });
  D('D4 zaman aşımı: ne load ne error gelirse söz sınırlı sürede ok:false ile çözülür', (R) => { assert.equal(R.d4.r.ok, false); assert.equal(R.d4.yedek, 1); assert.ok(R.d4.ms < 5000, R.d4.ms + ' ms'); });
  D('D5 yedek eşitliği: gövde, başlık ve ölçüm kutusu aynı ortak yığını kullanır', (R) => {
    assert.equal(R.d5.yedek, 1); const n = (x) => x.replace(/"/g, "'").replace(/\s*,\s*/g, ',');
    assert.equal(n(R.d5.govde), n(R.d5.Y)); assert.equal(n(R.d5.baslik), n(R.d5.Y)); assert.equal(n(R.d5.kutu), n(R.d5.Y));
  });
  D('D6 boş yazı tipi yuvası: istek yok, ok, yedek yok', (R) => { assert.deepEqual(R.d6.r, { ok: true, aileler: [], hata: [] }); assert.equal(R.d6.yeniLink, 0); assert.equal(R.d6.yedek, 0); });
  D('D7 "Yeniden dene": yükleme baştan istenir, başarıda yedek kalkar ve kullanıcıya söylenir', (R) => {
    assert.equal(R.d7.ilk.ok, false); assert.equal(R.d7.yedek1, 1); assert.equal(R.d7.toast1.a, '#sx-yazi-tipi');
    assert.equal(R.d7.istek, 2, 'başarısız aile önbellekte kalmamalı'); assert.equal(R.d7.yedek2, 0); assert.equal(R.d7.toast2.t, 'Şablon yazı tipi yüklendi.');
  });
  D('D8 eski söz yenisinin üzerine yazmaz (her iki yönde)', (R) => { assert.deepEqual([R.d8.a1, R.d8.a2], [0, 0]); assert.deepEqual([R.d8.b1, R.d8.b2], [1, 1]); });
  D('D9 düzenleyici sığdırması: yazı doğrulanmadan HİÇ sığdırma yok; doğrulanınca güncel şablonla tam bir kez', (R) => {
    assert.equal(R.d9.hemen, false); assert.deepEqual(R.d9.once, [], 'doğrulanmamış yazıyla sığdırma yapıldı'); assert.equal(R.d9.kuyruk, 1);
    assert.ok(R.d9.sonra.every((x) => x.hazir), JSON.stringify(R.d9.sonra)); assert.equal(R.d9.sonra.filter((x) => x.id === 'sD9').length, 1, 'tam bir kez: ' + JSON.stringify(R.d9.sonra));
    assert.ok(R.d9.ciz >= 1); assert.equal(R.d9.r.ok, true); assert.equal(R.d9.kuyrukSon, 0);
  });
  D('D10 P2 ölçüm kutusu = görünen asetat: aynı sınıf, aynı şablon stili, şablon yazısı; visibility:hidden (display:none değil)', (R) => {
    assert.equal(R.d10.cls, R.d10.beklenenCls); assert.ok(R.d10.stil.indexOf(R.d10.beklenenStil) === 0, R.d10.stil);
    assert.equal(R.d10.gorunur, 'hidden'); assert.notEqual(R.d10.display, 'none'); assert.match(R.d10.aile, /Dz Basari/);
  });
  D('D11 P2 şablon izi kalmaz: stil tamamen yeniden yazılır, kutu aynı kalır', (R) => {
    assert.equal(R.d11.cls, 'sx-slide bg-clear'); assert.ok(!/Dz Basari|background|font-family/.test(R.d11.stil), R.d11.stil); assert.equal(R.d11.ayni, true);
  });
  D('D12 P2 measureH(e, sl) görünen asetattaki yükseklikle aynı (şablon, koyu zemin, yedek yazı)', (R) => {
    ['sablon', 'koyu', 'yedek'].forEach((k) => R.d12[k].forEach(([t, a, b]) => assert.equal(a, b, k + ' ' + t + ': ölçüm ' + a + ' ≠ görünen ' + b)));
    assert.equal(R.d12.yedekAcik, 1); assert.equal(R.d12.sablonYedek, 0);
  });
  D('D13 P2 tek kutu yeniden kullanılır: 100 ölçümde DOM büyümez, kutu boş kalır', (R) => { assert.equal(R.d13.sonra, R.d13.once); assert.equal(R.d13.bos, true); });
  D('D14 aynı şablon ve yazıyla tekrar sığdırma özdeş (idempotent); iki yazı gerçekten farklı sığdırıyor', (R) => {
    assert.equal(R.d14.ilk, R.d14.RA); assert.equal(R.d14.uc, R.d14.RA, 'tekrar sığdırma küçülme biriktirdi');
    assert.notEqual(R.d14.RA, R.d14.RB, 'geniş ve dar yazı aynı sonucu verirse test anlamsız: ' + R.d14.RA);
  });
  D('D15 şablon A → B → A taze A ile aynı; dört tur sonra birikme yok; öğe alanları ve kayıt değişmez', (R) => {
    assert.equal(R.d15.a1, R.d14.RA); assert.equal(R.d15.b1, R.d14.RB, 'dar yazıya geçince asıl boyuta göre yeniden sığmalı'); assert.equal(R.d15.a2, R.d14.RA); assert.equal(R.d15.a3, R.d14.RA);
    assert.equal(R.d15.anahtar, true); assert.ok(!/taban|"son"/.test(R.d15.json), 'asıl boyut kayda sızmamalı');
  });
  D('D16 yedek yazı → yeniden dene → şablon yazısı: taze sığdırmayla aynı; kayıtlı şablon değişmez', (R) => {
    assert.equal(R.d16.yedek, 1); assert.equal(R.d16.yedekSon, 0); assert.equal(R.d16.sonra, R.d16.taze, 'yedek: ' + R.d16.yedekBoy);
    assert.equal(R.d16.temaHf, 'Dz Tekrar2'); assert.equal(R.d16.temaBf, 'Dz Tekrar2'); assert.equal(R.d16.temaJson, true); assert.ok(!/taban/.test(R.d16.json));
  });
  Ex('E1 gerçek basım: şablon yazısı doğrulanmadan hiçbir sığdırma ya da ölçüm yok; basım doğrulamadan sonra, güncel yazıyla', (R) => {
    assert.equal(R.e1.basOncesiHazir, false); assert.equal(R.e1.hemenSonra, 0, 'printDeck yazıdan önce çalıştı');
    assert.ok(R.e1.slides >= 6); assert.ok(R.e1.fit > 0 && R.e1.olc > 0); assert.equal(R.e1.temiz, true); assert.equal(R.e1.anahtar, true);
  });
  Ex('E2 düzen değiştir (gerçek düğme) yazı beklerken kuyruğa girer; sonra yalnız doğrulanmış güncel yazıyla, hedef asetat bir kez', (R) => {
    assert.equal(R.e2.once, 0); assert.equal(R.e2.kuyruk >= 1, true); assert.equal(R.e2.temiz, true); assert.equal(R.e2.anahtar, true);
    assert.equal(R.e2.hedefFit, 1); assert.equal(R.e2.toplamFit, R.e2.slides, 'şablon değişti: deste bir kez yeniden sığdırılır, tek asetat işi ayrıca koşmaz');
  });
  Ex('E3 görsel yerleştirme sığdırması yazı beklerken yapılmaz; sonra bir kez', (R) => { assert.equal(R.e3.hemen, false); assert.equal(R.e3.once, 0); assert.equal(R.e3.temiz, true); assert.equal(R.e3.hedefFit, 1); });
  Ex('E4 denetim (gerçek düğme) yazı beklerken ölçmez, kullanıcıya söyler; yazı gelince açılır ve doğrulanmış yazıyla ölçer', (R) => {
    assert.equal(R.e4.once, 0); assert.match(R.e4.toast, /hazırlanıyor/); assert.equal(R.e4.acikOnce, false); assert.equal(R.e4.acikSonra, true);
    assert.ok(R.e4.olc > 0); assert.equal(R.e4.temiz, true);
  });
  Ex('E5 iş beklerken şablon yeniden değişir: eski şablonla hiç sığdırma yok, güncel şablonla deste bir kez', (R) => {
    assert.equal(R.e5.once, 0); assert.equal(R.e5.temiz, true); assert.equal(R.e5.eskiAnahtar, 0); assert.equal(R.e5.hedefFit, 1); assert.equal(R.e5.toplamFit, R.e5.slides);
  });
  Ex('E6 başka desteye geçilince bekleyen iş atılır (eski deste ezilmez)', (R) => { assert.equal(R.e6.eskiFit, 0); assert.equal(R.e6.yeniDeste, true); assert.equal(R.e6.kuyruk, 0); });
  Ex('E7 gerçek basımda bir aday hata fırlatır: basım tamamlanır, asetat başka düzenle basılır, kayda hata alanı girmez; ağ isteği yok', (R) => {
    assert.ok(R.e7.patN >= 1); assert.equal(R.e7.patla.length, 1); assert.ok(R.e7.json); assert.deepEqual(R.ag, []);
  });
}

summary();
