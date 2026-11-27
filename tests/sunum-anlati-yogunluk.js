/* ==========================================================================
   ACADEX — SUNUM ANLATI VE YOĞUNLUK TESTLERİ (tests/sunum-anlati-yogunluk.js)

   NEDEN VAR (27.11.2026, #44 Phase 7.1 + 7.2):
     - sunum-research yazarın çıktısına DETERMİNİSTİK bir son geçiş uygular (anlatiBicim → uzunBol → notSade):
       tarihli adımlar "time", iki taraf önekli karşılaştırma "two" olur; 18 kelimeyi aşan madde yalnız kendi cümle
       sınırından bölünür (kesilmez, sayı kaybolmaz, bağlaçla bağlı ikinci yarı bölünmez); notun maddeyi ya da başlığı
       yineleyen cümlesi atılır (köprü cümlesi ve 45 kelime tabanı korunur). Model çağrısı, yeniden deneme, ikinci düzen
       seçicisi YOK; çeşidi (kart/kolon/sıra) yine istemcinin düzen zekâsı (DZ) seçer.
     - İstemci qaIcerik üç YALNIZ ÖNERİ (info) kodu ekler: THIN_SLIDE, NOTES_ECHO, REPEATED_LAYOUT. Notlara ve düzene
       dokunmaz, durum/puan değişmez; alıntı/sayı/grafik/tablo/kapak/kapanış/kaynakça/gündem cezalandırılmaz.
     - 10 sentetik senaryo (ağ yok): sunucu geçişi → fromResearch (ink'ten dilim) → DZ düzeneği (sunum-duzen-zekasi
       ile aynı dilimler) → önce/sonra ölçüleri. Bu ölçüler DETERMİNİSTİK kanıttır; gerçek model çıktısının kalitesi değil.

   Bölümler:  A kaynak kuralları · B uzun madde bölme · C içerik biçimi · D not sadeleştirme ·
              E istemci önerileri · F 10 senaryo (önce/sonra) · G maliyet.
   Çalıştırma:  node tests/sunum-anlati-yogunluk.js
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const SRV_PATH = 'supabase/functions/sunum-research/index.ts';
const srv = read(SRV_PATH);
const { test, summary } = makeRunner();
const cut = (src, a, b) => { const i = src.indexOf(a); assert.ok(i >= 0, 'bulunamadı: ' + a.slice(0, 60)); const j = src.indexOf(b, i + a.length); assert.ok(j > i, 'son bulunamadı: ' + b.slice(0, 60)); return src.slice(i, j); };
const kel = (t) => (String(t || '').trim().match(/\S+/g) || []).length;
const sayilar = (t) => (String(t || '').match(/\d+(?:[.,]\d+)*/g) || []);
const kopya = (x) => JSON.parse(JSON.stringify(x));

const F = loadFromSource(SRV_PATH, ['numTokens', 'timeOk', 'sidesOf', 'onekAt', 'kelimeSay', 'BAGLI', 'KISALTMA', 'SIRA', 'FIILSAYI', 'bolNokta', 'uzunBol', 'TARIHBAS', 'tarihliMi', 'KARSI', 'ikiTaraf', 'anlatiBicim', 'META_NOT', 'kok5', 'notSade']);
/* üretimdeki bağlama sırasının aynısı (A3 kaynakta doğrular) */
const gecis = (slides, lang) => {
  const anlati = Object.assign({}, F.anlatiBicim(slides, lang), { bolunen: 0, notCumle: 0 });
  slides.forEach((x, i) => { if (i < slides.length - 1) anlati.bolunen += F.uzunBol(x, lang); anlati.notCumle += F.notSade(x); });
  return anlati;
};
const S = (title, bullets, notes, o) => Object.assign({ title, kind: 'list', bullets, warn: [], heads: [], split: 0, stats: [], chart: null, table: null, notes: notes || '', image: null, src: [1] }, o);

/* ---------- istemci dilimleri: fromResearch, qaKok/qaAnlati, qaIcerik, ICERIK ---------- */
const arr = (x) => (Array.isArray(x) ? x : []);
const txt = (x) => String(x == null ? '' : x).trim();
const fromResearch = new Function('arr', 'txt', cut(ink, '  var fromResearch = function (d) {', '  /* akıllı düzen:') + ';return fromResearch;')(arr, txt);
const ICERIK = Function('return ' + cut(ink, '  var ICERIK = {', '\n  };\n').replace('  var ICERIK = ', '') + '\n}')();
const titleOf = new Function(cut(ink, '  var titleOf = function (s) {', '  var fitThumbs') + ';return titleOf;')();
const titleKey = new Function(ink.match(/  var titleKey = function[^\n]+/)[0] + ';return titleKey;')();
const kunyeSahibi = new Function(ink.match(/  var kunyeSahibi = function[^\n]+/)[0] + ';return kunyeSahibi;')();
const DECOR = { mark: 1, arrow: 1, rect: 1, ellipse: 1 };
const ANL = cut(ink, '  var qaKok = function', '  /* ---------- PHASE 6: BİRLEŞİK DENETİM');
const QI = cut(ink, '  var qaIcerik = function (d) {', '  var qaTeknik = function');
const istemci = new Function('arr', 'titleKey', 'titleOf', 'ICERIK', 'DECOR', 'kunyeSahibi', 'deckKey', ANL + QI + ';return { qaAnlati: qaAnlati, qaIcerik: qaIcerik };')(arr, titleKey, titleOf, ICERIK, DECOR, kunyeSahibi, () => 'k');
let eid = 0;
const el = (type, o) => Object.assign({ id: 'e' + (++eid), type, x: 0, y: 0, w: 400, h: 80, size: 24, text: '' }, o);
const asetat = (lay, title, body, o) => Object.assign({ id: 's' + (++eid), lay, bg: 'clear', notes: '', els: [el('h', { text: title, size: 42 })].concat(body) }, o);
const kodlar = (slides) => istemci.qaIcerik({ slides, quality: null }).bulgu.filter((z) => /^(THIN_SLIDE|NOTES_ECHO|REPEATED_LAYOUT)$/.test(z.code)).map((z) => z.code + '@' + z.slide);

/* ---------- DZ düzeneği: tests/sunum-duzen-zekasi.js ile aynı dilimler (VARY…LAILE, vSay/vSec…push, newSlide) ---------- */
let id = 0;
const E = (type, x, y, w, h, o) => Object.assign({ id: ++id, type, x, y, w, h, text: '', size: 24 }, o);
const head = (t) => [E('h', 70, 46, 820, 74, { text: t, size: 42 }), E('mark', 70, 118, 190, 16, {})];
const statsOf = (bb) => (bb || []).map((x) => { const m = String(x).split(' — '); return m.length > 1 ? { value: m[0], label: m[1] } : null; }).filter(Boolean);
const ILK = "var deck = { lang: 'tr' };" + ink.match(/  var ilkBuyuk = function[^\n]+/)[0] + '\n';
const { VARY, VSIRA, LAILE } = new Function('E', 'head', 'statsOf', 'NAVY', 'BLUE', 'SOFT', 'statBoy', 'arr', 'txt',
  ILK + cut(ink, "var TINT = ['#DCE6FF'", '/* ---------- özetten taşınan zenginlik') + ';return { VARY, VSIRA, LAILE };')(E, head, statsOf, '#0D1838', '#2F6BFF', '#6A7593', (ss, o) => o[3], arr, txt);
const VS = cut(ink, 'var vSay = {}, vSec', 'push(); var made = strips.map');
const NS = cut(ink, '  var newSlide = function (kind, t, b, c) {', '  /* ---------- rendering ---------- */');
const LAY = {};
['list', 'time', 'stat', 'two', 'quote', 'chart', 'table', 'cover', 'end', 'refs'].forEach((k) => { LAY[k] = { f: (t, bb) => head(t).concat([E('ul', 90, 160, 780, 340, { text: arr(bb).join('\n') })]) }; });
const RET = `;var bas = function (s, kind) { kind = vTur(kind); var cx = { heads: s.heads, split: s.split, data: s.data };
  cx.v = s.vz && kind === 'list' ? s.vz : vSec(s, kind); cx.zorla = !!s.vz; cx.aile = vSay.aile || ''; cx.tek = vSay.tek;
  cx.yedek = s.vz && kind === 'list' ? null : vSay.yedek; vSay.yedek = null;
  var sl = newSlide(kind, String(s.t).trim(), s.b, cx); DZ.duzelt(kind, sl.v || 0, !!(s.vz && kind === 'list'));
  if (cx.hata) { vSay.hatalar = (vSay.hatalar || []).concat(cx.hata.map(function (x) { return Object.assign({ t: String(s.t).trim() }, x); })); delete cx.hata; }
  if (kind === 'list') vSay.aile = LAILE[sl.v || 0] || '';
  return { kind: kind, v: sl.v || 0, sl: sl }; };
  return { bas: bas };`;
const yap = () => new Function('VSIRA', 'VARY', 'LAILE', 'arr', 'LAY', 'uid', VS + NS + RET)(VSIRA, VARY, LAILE, arr, LAY, () => ++id);
/* basılan deste: içerik asetatları DZ'den; ölçüler için notlar üretimdeki gibi asetata geçer */
const basim = (srvSlides) => {
  const items = fromResearch({ slides: srvSlides }).items, run = yap();
  return items.map((s0, i) => { const r = run.bas(Object.assign({}, s0, { son: i === items.length - 1 }), s0.k); r.sl.notes = s0.notes || ''; r.item = s0; return r; });
};
/* aile: düz madde (0 klasik, 9 madde kartı) tek aile; öteki liste çeşitleri istemcinin kendi aile haritasıyla (LAILE) */
const aile = (r) => (r.kind !== 'list' ? r.kind : r.v === 0 || r.v === 9 ? 'list/madde' : 'list/' + (LAILE[r.v] || r.v));
const olc = (srvSlides) => {
  const r = basim(srvSlides), q = kodlar(r.map((x) => x.sl));
  let kos = 0, enKos = 0, uc = 0;
  r.forEach((x, i) => { kos = aile(x) === 'list/madde' ? kos + 1 : 0; enKos = Math.max(enKos, kos);
    if (i >= 2 && [r[i - 2], r[i - 1], x].every((y) => y.kind + ':' + y.v === x.kind + ':' + x.v)) uc++; });
  const maddeler = r.flatMap((x) => (x.kind === 'stat' || x.kind === 'chart' || x.kind === 'table' ? [] : x.item.b));
  return { seri: r.map((x) => x.kind + ':' + x.v).join(' '), aile: new Set(r.map(aile)).size, enKos, uc,
    uzun: maddeler.filter((b) => kel(b) > 18).length, ince: q.filter((c) => /^THIN/.test(c)).length,
    yanki: q.filter((c) => /^NOTES/.test(c)).length, tekrar: q.filter((c) => /^REPEATED/.test(c)).length, kod: q };
};

/* ================================ A · KAYNAK KURALLARI ================================ */
const BLOK = cut(srv, '/* ===== #44 Phase 7.1 + 7.2: ANLATI VE YOĞUNLUK', 'async function groq(');
test('A1 sunucu geçişi ağa çıkmaz, model çağırmaz, yeniden denemez; yalnız for döngüsü (P9) ve fitSlide sayısı değişmedi', () => {
  assert.ok(!/groq\(|fetch\(|await |gemini|setTimeout|while \(/i.test(BLOK), 'anlatı bloğunda yasak çağrı: ' + (BLOK.match(/groq\(|fetch\(|await |gemini|setTimeout|while \(/i) || [])[0]);
  assert.equal((ink.match(/fitSlide\(/g) || []).length, 5, 'istemci fitSlide sayısı (DZ sözleşmesi)');
});
test('A2 bağlama: tek satır, dizinin İÇİNDE ve anlam denetiminden/not uzatmadan ÖNCE; yanıt sözleşmesi aynı, yalnız log satırı', () => {
  const i = srv.indexOf('const anlati = { ...anlatiBicim(slides, lang), bolunen: 0, notCumle: 0 };');
  assert.ok(i > 0, 'bağlama satırı yok');
  assert.ok(srv.indexOf('if (!slides.length) return J(', i) > i, 'boş deste denetiminden önce olmalı');
  const not = srv.search(/wc\(x\.s\.notes\)\s*<\s*45/); assert.ok(not > i, 'var olan tek not uzatma çağrısı geçişten SONRA gelmeli (sadeleşen notu görür, ek çağrı yok)');
  assert.ok(/\| anlati \$\{JSON\.stringify\(anlati\)\}/.test(srv), 'ölçüm log satırı');
  assert.ok(!/anlati[,}\s]*\}\s*\)\s*;?\s*$/m.test(srv.slice(i, i + 200)) && !/[{,]\s*anlati\s*[,}]/.test(srv.replace(/console\.log\([^\n]*/g, '')), 'anlati yanıta konmamalı (sözleşme aynı)');
});
test('A3 yazar istemi: yeni yoğunluk/süreç/not kuralları var, eski sabit kurallar (45-80, 12-22) aynen duruyor', () => {
  ['Density follows the role: explanation and analysis slides carry 3-4 full bullets, while "quote", "stat" and "chart" slides stay short on purpose.',
    'One bullet is one idea: a point that needs two sentences becomes two bullets.',
    'A step-by-step process is one "list" whose title names the process and whose bullets start "Step 1:", "Step 2:"… in order (Turkish: "Adım 1:").',
    'Never just repeat the bullets or the title, and never open with "In this slide" / "Bu slaytta".',
    '3-4 natural spoken sentences, 45-80 words', 'A bullet is an analytical statement, not a label: 12-22 words'].forEach((p) => assert.ok(srv.includes(p), 'istemde yok: ' + p.slice(0, 50)));
});
test('A4 istemci: üç kod yalnız info, önerisi var; çözümleyici Phase 6 onarım bloğunun DIŞINDA ve desteye yazmaz', () => {
  ['THIN_SLIDE', 'NOTES_ECHO', 'REPEATED_LAYOUT'].forEach((k) => { assert.equal(ICERIK[k][0], 'info', k); assert.ok(new RegExp(k + ": \\['[^']+', '[^']+'\\]").test(ink), k + ' önerisi'); });
  const fn = cut(ink, '  var qaAnlati = function', '\n  };\n');
  assert.ok(!/\b(s|e|t|d|deck)\.[\w$]+\s*=(?!=)/.test(fn) && !/\.(splice|unshift|reverse|sort)\(/.test(fn), 'qaAnlati desteye yazıyor');
  assert.ok(!/fetch\(|invoke|setTimeout|localStorage|saveNow|dirty\(/.test(fn), 'qaAnlati yan etkili');
  assert.ok(ink.indexOf('  var qaAnlati = function') < ink.indexOf('  /* ---------- PHASE 6: BİRLEŞİK DENETİM'), 'Phase 6 bloğunun dışında');
  assert.ok(/qaAnlati\(s, n, out\.bulgu, sira\);/.test(QI), 'qaIcerik çağırıyor');
});

/* ================================ B · UZUN MADDE BÖLME ================================ */
test('B1 18 kelimeyi aşan madde cümle sınırından ikiye bölünür: tek kelime kaybolmaz, sayılar aynı, ikinci parça büyük harfle', () => {
  const b = 'Gece uykusu sırasında hipokampus gün içinde öğrenilen bilgileri yeniden oynatır ve kortekse aktarır. Uykusuz geçen bir gecenin ardından ertesi gün öğrenilen listelerin hatırlanma oranı yaklaşık %40 düşer.';
  const s = S('Uyku ve bellek', [b, 'Kısa şekerlemeler motor becerilerin pekişmesine katkı sağlar ve dikkat süresini artırır']);
  assert.equal(F.uzunBol(s, 'tr'), 1);
  assert.equal(s.bullets.length, 3);
  assert.equal(s.bullets[0] + ' ' + s.bullets[1], b, 'kesinti ya da sözcük değişimi yok');
  assert.deepEqual(sayilar(s.bullets.join(' ')).sort(), sayilar(b + ' x').sort());
  assert.ok(s.bullets.slice(0, 2).every((x) => kel(x) >= 6 && /^\p{Lu}/u.test(x)));
});
test('B2 sınır yoksa ya da ikinci yarı bağlaç/zamirle bağlıysa (Bu nedenle, Because, This…) BÖLÜNMEZ ve KISALTILMAZ', () => {
  const tek = 'Bölgesel enerji şebekeleri yenilenebilir kaynakların payı arttıkça depolama kapasitesine ve esnek talep yönetimine giderek daha çok ihtiyaç duyuyor';
  const bagli = 'Rüzgâr türbinleri kıyı bölgelerinde yüksek ve düzenli kapasite faktörüne ulaşıyor. Bu nedenle kıyıdaki yatırımlar iç bölgelere göre daha hızlı geri dönüyor ve finansmanı kolaylaşıyor.';
  const en = 'Spaced repetition beats massed practice for long term retention in most classroom studies. Because each recall attempt strengthens the memory trace, gaps between sessions matter a lot.';
  [[tek, 'tr'], [bagli, 'tr'], [en, 'en']].forEach(([b, l]) => { const s = S('T', [b, 'İkinci madde yeterince uzun ve anlamlı bir cümledir burada']); assert.equal(F.uzunBol(s, l), 0, b.slice(0, 30)); assert.equal(s.bullets[0], b); });
});
test('B3 kısaltma (örn., Dr., e.g.) cümle sınırı sayılmaz; noktalı virgül sınırı nokta olur; EN maddesi bölünür', () => {
  assert.equal(F.bolNokta('Bazı enzimler örn. amilaz ve lipaz sindirimin ilk aşamasında çok hızlı çalışır ve besinleri küçük parçalara ayırır', 'tr'), null);
  const p = F.bolNokta('Cloud providers charge for storage by the gigabyte each month across regions; egress fees are billed separately and often surprise new teams.', 'en');
  assert.deepEqual(p, ['Cloud providers charge for storage by the gigabyte each month across regions.', 'Egress fees are billed separately and often surprise new teams.']);
});
test('B4 terim kolonlu liste, grafik/tablo asetatı ve liste dışı türler bölünmez; en çok 2 bölme, liste en çok 5 madde', () => {
  const uz = (i) => 'Birinci cümle burada yeterince uzun bir açıklama yapıyor ' + i + '. İkinci cümle de en az altı kelimeden oluşan bağımsız bir düşünce.';
  const terim = S('Kavramlar', ['Esneklik: ' + uz(1), 'Depolama: ' + uz(2)]);
  assert.equal(F.uzunBol(terim, 'tr'), 0);
  assert.equal(F.uzunBol(S('G', [uz(1), uz(2)], '', { chart: { type: 'bar', labels: ['a', 'b'], values: [1, 2] } }), 'tr'), 0);
  assert.equal(F.uzunBol(S('Q', [uz(1)], '', { kind: 'quote' }), 'tr'), 0);
  const cok = S('Çok', [uz(1), uz(2), uz(3), uz(4)]);
  assert.equal(F.uzunBol(cok, 'tr'), 1, 'liste 5 maddeye ulaşınca durur');
  assert.equal(cok.bullets.length, 5);
  const iki = S('İki', [uz(1), uz(2), uz(3)]);
  assert.equal(F.uzunBol(iki, 'tr'), 2); assert.equal(iki.bullets.length, 5);
});
test('B5 doğrulanmamış sayı uyarısı ve neden (why) sayıyı taşıyan parçaya geçer; öteki maddelerin indisleri kayar', () => {
  const s = S('W', ['Kısa ama yeterli uzunlukta bir giriş maddesi burada duruyor', 'Kentlerde çatı bahçeleri hızla yaygınlaşıyor ve belediyeler bunları teşvik ediyor. Ankara\'da son beş yılda kurulan bahçe sayısı 1.240\'a ulaştı ve artıyor.', 'Son madde de doğrulanmış 2.500 sayısını taşıyor ve uzun değil'], '', { warn: [1, 2], why: { 1: 'kaynakta yok', 2: 'yuvarlanmış' } });
  assert.equal(F.uzunBol(s, 'tr'), 1);
  assert.deepEqual(s.warn, [2, 3]);
  assert.deepEqual(s.why, { 2: 'kaynakta yok', 3: 'yuvarlanmış' });
  assert.ok(/1\.240/.test(s.bullets[2]));
});
/* #47 (27.11.2026): #46 kabul taraması dört sınırı yanlış buldu ("başlayan 2. | Dünya Savaşı", "John F. | Kennedy",
   "M.Ö. | 2560", "Apple Inc. | Within"). Sözcük kaybolmuyordu ama ad ikiye bölünüyordu. Kural: sıra sayısı (TR), baş harf,
   harf-nokta dizisi ve kısaltma/şirket eki cümle bitirmez; güvenli sınır yoksa madde bölünmez. */
const naifSinir = (b) => [...b.matchAll(/[.!?]\s+(?=[\p{Lu}\d])/gu)].some((m) => kel(b.slice(0, m.index + 1)) >= 6 && kel(b.slice(m.index + 1)) >= 6);
const KORU = [
  ['tr', 'Almanya’nın Polonya’yı işgal etmesiyle 1939 yılında başlayan 2. Dünya Savaşı altı yıl sürdü ve milyonlarca sivilin ölümüne yol açtı', '2. Dünya Savaşı'],
  ['tr', 'Osmanlı Devleti’nde anayasal düzene geçiş denemesi olarak 1876 yılında ilan edilen 1. Meşrutiyet kısa sürede askıya alındı ve meclis kapatıldı', '1. Meşrutiyet'],
  ['tr', 'Yeniçeri Ocağını kaldırıp ordunun modernleşmesini başlatan ve yönetimde köklü reformlar yapan II. Mahmut merkezi otoriteyi taşrada da yeniden güçlendirmeye çalıştı', 'II. Mahmut'],
  ['tr', 'Mısırlılar Giza platosundaki büyük piramidi yaklaşık olarak M.Ö. 2560 yılında tamamladı ve yapı binlerce yıl en yüksek yapı oldu', 'M.Ö. 2560'],
  ['tr', 'Roma İmparatorluğu Hristiyanlığı resmi din olarak kabul ettiğinde takvim M.S. 380 yılını gösteriyordu ve kilise örgütü kentlerde hızla büyüdü', 'M.S. 380'],
  ['tr', 'Okuma alışkanlıklarını inceleyen ve sonuçlarını iki makalede yayımlayan Yılmaz vd. Ankara ile İzmir okullarında öğrencileri iki yıl boyunca izledi', 'vd. Ankara'],
  ['tr', 'Çalışmanın yürütücüsü olan ve yıllardır bu alanda araştırma yapan Prof. Ayşe Demir sonuçları uluslararası bir konferansta ilk kez kamuoyuyla paylaştı', 'Prof. Ayşe'],
  ['tr', 'Kırtasiye ürünleri, defterler, kalemler, boya setleri vb. Ürünler okul açılmadan önceki iki haftada her yıl en yüksek satış rakamlarına ulaşıyor', 'vb. Ürünler'],
  ['en', 'The space programme gained momentum after President John F. Kennedy announced in 1961 that America would land a man on the Moon', 'John F. Kennedy'],
  ['en', 'The original survey of coastal erosion was led by the geologist A. B. Smith and later extended to every harbour along the northern coast', 'A. B. Smith'],
  ['en', 'Many readers first met the fantasy genre through the novels written by J. R. R. Tolkien, whose invented languages still inspire linguists', 'J. R. R. Tolkien'],
  ['en', 'The first commercial smartphone platform was released by Apple Inc. Within two years more than 100 thousand apps were available in its store', 'Apple Inc. Within'],
  ['en', 'The long term maintenance contract was signed with Example Ltd. Following the audit the remaining suppliers were asked to renew their agreements', 'Example Ltd. Following'],
  ['en', 'Several cheap and simple classroom interventions, e.g. Spaced practice and retrieval quizzes, raised average scores in most of the observed schools over two terms', 'e.g. Spaced'],
  ['en', 'Most teams adopted the smaller model, i.e. The one that fitted on a single consumer graphics card, because hosting costs mattered more than accuracy', 'i.e. The'],
  ['en', 'According to tradition the city of Rome was founded around 753 B.C. By its first king, who gave the settlement his own name and built walls', 'B.C. By'],
  ['en', 'The eruption of the volcano in the year 79 A.D. Buried the towns of Pompeii and Herculaneum under metres of ash and preserved them', 'A.D. Buried'],
];
test('B6 #47 sıra sayısı, baş harf, M.Ö./M.S., vd./vb./Prof., Inc./Ltd., e.g./i.e., B.C./A.D. cümle sınırı sayılmaz: ad ya da ifade bölünmez, madde olduğu gibi kalır', () => {
  KORU.forEach(([l, b, ifade]) => {
    assert.ok(kel(b) > 18 && b.includes(ifade), 'fikstür: ' + ifade);
    assert.ok(naifSinir(b), 'fikstürde naif kurala göre bölünebilir bir nokta olmalı: ' + ifade);
    assert.equal(F.bolNokta(b, l), null, ifade + ' bölündü');
    const s = S('T', [b, 'İkinci madde yeterince uzun ve anlamlı bir cümledir burada']);
    assert.equal(F.uzunBol(s, l), 0, ifade);
    assert.equal(s.bullets[0], b);
  });
});
test('B7 #47 gerçek cümle sonu hâlâ sınırdır (korunan ifade içerde kalır); noktalı virgül çalışır; ondalık, sürüm, yıl ve EN sayı sonu doğru', () => {
  const GERCEK = [
    ['tr', '1939 yılında başlayan 2. Dünya Savaşı altı yıl sürdü ve Avrupa’yı derinden yıktı. Savaşın ardından kurulan Birleşmiş Milletler barışı korumayı amaçladı', 'yıktı.', '2. Dünya Savaşı'],
    ['tr', 'Mısırlılar büyük piramidi yaklaşık olarak M.Ö. 2560 yılında tamamladı ve yapı çok uzun süre ayakta kaldı. Bugün Giza platosu her yıl milyonlarca ziyaretçi ağırlıyor', 'kaldı.', 'M.Ö. 2560'],
    ['tr', 'Ölçülen ortalama büyüme hızı 3.5 birim olarak hesaplandı ve önceki yılın 2,75 değerinin belirgin biçimde üzerinde kaldı. Araştırmacılar bu farkı daha sıcak geçen ilkbahara bağlıyor', 'kaldı.', '3.5 birim'],
    ['tr', 'Birinci cümle burada yeterince uzun bir açıklama yapıyor 3. İkinci cümle de en az altı kelimeden oluşan bağımsız bir düşünce.', 'yapıyor 3.', 'yapıyor 3.'],
    ['tr', 'Ülkede ilk modern nüfus sayımı yapıldığında kayıtlı şehir sayısı oldukça azdı ve sayım yılı 1927. Sonraki sayımlar her beş yılda bir düzenli olarak yapıldı', '1927.', 'yılı 1927.'],
    ['en', 'President John F. Kennedy set an ambitious goal for the national space programme in a famous speech. Eight years later Apollo 11 reached the lunar surface with three astronauts', 'speech.', 'John F. Kennedy'],
    ['en', 'The release notes for version v2.1 describe a faster parser and several fixes for memory leaks in the server. Users of the older 1.9 branch should upgrade within six months', 'server.', 'v2.1'],
    ['en', 'Over the last decade the number of member states in the regional economic alliance rose to 24. Analysts expect further enlargement once the current negotiations conclude next year', 'to 24.', 'to 24.'],
  ];
  GERCEK.forEach(([l, b, son, ifade]) => {
    assert.ok(kel(b) > 18, 'fikstür uzun: ' + son);
    const p = F.bolNokta(b, l);
    assert.ok(p, 'gerçek sınır bulunmalı: ' + son);
    assert.ok(p[0].endsWith(son), son + ' → ' + JSON.stringify(p));
    assert.equal(p[0] + ' ' + p[1], b, 'sözcük ve sayı aynen korunur');
    assert.ok(p.some((x) => x.includes(ifade)), ifade + ' bir parçada bütün');
    assert.deepEqual(sayilar(p.join(' ')), sayilar(b));
  });
  const nv = F.bolNokta('Çalışmayı Prof. Ayşe Demir ve ekibi iki yıl boyunca yürüttü; sonuçlar uluslararası bir dergide yayımlandı ve geniş ilgi gördü', 'tr');
  assert.deepEqual(nv, ['Çalışmayı Prof. Ayşe Demir ve ekibi iki yıl boyunca yürüttü', 'Sonuçlar uluslararası bir dergide yayımlandı ve geniş ilgi gördü']);
});
test('B8 #47 korunan ifade varken warn/why sayıyı taşıyan parçaya geçer; bölünmeyen maddede indisler aynen kalır', () => {
  const b = 'President John F. Kennedy set an ambitious goal for the national space programme in a famous speech. Eight years later Apollo 11 reached the lunar surface with three astronauts';
  const s = S('Space', ['A short but adequate opening bullet stays here', b, 'The last bullet mentions 300 launches and stays short'], '', { warn: [1, 2], why: { 1: 'not in source', 2: 'rounded' } });
  assert.equal(F.uzunBol(s, 'en'), 1);
  assert.equal(s.bullets.length, 4);
  assert.ok(s.bullets[1].includes('John F. Kennedy') && /Apollo 11/.test(s.bullets[2]));
  assert.deepEqual(s.warn, [2, 3]);
  assert.deepEqual(s.why, { 2: 'not in source', 3: 'rounded' });
  const k = S('Savaş', ['Kısa ama yeterli uzunlukta bir giriş maddesi burada duruyor', KORU[0][1]], '', { warn: [1], why: { 1: 'kaynakta yok' } });
  assert.equal(F.uzunBol(k, 'tr'), 0);
  assert.deepEqual([k.warn, k.why, k.bullets[1]], [[1], { 1: 'kaynakta yok' }, KORU[0][1]]);
});
test('B9 #47 deterministik ve kararlı: aynı girdi → aynı çıktı; güvenli bölünmüş liste ikinci geçişte değişmez', () => {
  const liste = () => S('Karışık', [KORU[0][1], 'Birinci cümle burada yeterince uzun bir açıklama yapıyor 3. İkinci cümle de en az altı kelimeden oluşan bağımsız bir düşünce.', 'Mısırlılar büyük piramidi yaklaşık olarak M.Ö. 2560 yılında tamamladı ve yapı çok uzun süre ayakta kaldı. Bugün Giza platosu her yıl milyonlarca ziyaretçi ağırlıyor']);
  const x = liste(), y = liste();
  assert.equal(F.uzunBol(x, 'tr'), 2); F.uzunBol(y, 'tr');
  assert.deepEqual(x, y);
  assert.ok(x.bullets.every((t) => kel(t) <= 18 || t === KORU[0][1]), 'parçalar eşiğin altında: ' + JSON.stringify(x.bullets));
  const once = kopya(x);
  assert.equal(F.uzunBol(x, 'tr'), 0, 'ikinci geçiş bölmez');
  assert.deepEqual(x, once);
  KORU.forEach(([l, b]) => { const s = S('T', [b]); F.uzunBol(s, l); F.uzunBol(s, l); assert.deepEqual(s.bullets, [b]); });
});

/* ================================ C · İÇERİK BİÇİMİ ================================ */
test('C1 her maddesi kendi tarihiyle başlayan, ileri giden 3-4 madde "time" olur; tarihsiz, geri giden, uyarılı ya da son asetat liste kalır', () => {
  const t = ['1923: Cumhuriyet ilan edildi ve yeni başkent Ankara oldu', '1928: Harf devrimiyle Latin alfabesine geçildi', '1934: Kadınlara milletvekili seçme ve seçilme hakkı tanındı'];
  const d = [S('Kuruluş yılları', t), S('Tarihsiz', ['1923: Cumhuriyet ilan edildi', 'Sonra harf devrimi geldi ve okuma arttı', '1934: Seçme hakkı']), S('Geri', [t[2], t[0], t[1]]),
    S('Uyarılı', t.slice(), '', { warn: [1] }), S('Son', t.slice())];
  const r = F.anlatiBicim(d, 'tr');
  assert.deepEqual(d.map((x) => x.kind), ['time', 'list', 'list', 'list', 'list']);
  assert.equal(r.time, 1); assert.deepEqual(d[0].bullets, t, 'maddeler aynen');
});
test('C2 karşılaştırma başlığı + iki önek (her tarafta ≥2) → "two"; önek sütun başlığına taşınır, metin aynı; başlık karşılaştırma değilse liste kalır', () => {
  const b = ['Python: Hızlı prototipleme ve geniş kütüphane desteği sunar', 'Rust: Bellek güvenliğini derleme anında garanti eder', 'Python: Yorumlanan yapısı nedeniyle yoğun hesapta yavaştır', 'Rust: Öğrenme eğrisi diktir ve derleme süresi uzundur'];
  const d = [S('Python ile Rust karşılaştırması', b.slice()), S('Python ve Rust', b.slice()), S('Son', ['x: a b c d e f', 'y: a b c d e f'])];
  F.anlatiBicim(d, 'tr');
  assert.equal(d[0].kind, 'two'); assert.deepEqual(d[0].heads, ['Python', 'Rust']); assert.equal(d[0].split, 2);
  assert.deepEqual(d[0].bullets, ['Hızlı prototipleme ve geniş kütüphane desteği sunar', 'Yorumlanan yapısı nedeniyle yoğun hesapta yavaştır', 'Bellek güvenliğini derleme anında garanti eder', 'Öğrenme eğrisi diktir ve derleme süresi uzundur']);
  assert.equal(d[1].kind, 'list', 'karşılaştırma başlığı yok');
  const uc = S('A vs B vs C', ['A: bir iki üç dört', 'B: bir iki üç dört', 'C: bir iki üç dört', 'A: beş altı yedi sekiz']);
  F.anlatiBicim([uc, S('son', [])], 'en'); assert.equal(uc.kind, 'list', 'üç taraf → liste');
});
test('C3 grafik, sayı, alıntı, tablo UYDURULMAZ: sayılı liste stat/chart olmaz, tırnaklı madde quote olmaz', () => {
  const d = [S('Rakamlarla', ['%62 üye her ay en az bir buluşmaya katılıyor', '3.400 kitap ödünç alındı ve iade edildi', '27 farklı mahallede şube açıldı']),
    S('Söz', ['“Bahçe bize komşuluğu yeniden öğretti” diyen gönüllüler çoğunlukta']), S('son', [])];
  F.anlatiBicim(d, 'tr');
  assert.deepEqual(d.map((x) => x.kind), ['list', 'list', 'list']);
  assert.ok(d.every((x) => !x.chart && !x.table && !x.stats.length));
});

/* ================================ D · NOT SADELEŞTİRME ================================ */
test('D1 maddeyi yineleyen ve "bu asetatta" meta cümlesi atılır; köprü (son) cümle kalır; bağlam cümlesi kalır', () => {
  const s = S('Uyku ve bellek', ['Gece uykusu sırasında hipokampus öğrenilen bilgileri kortekse aktarır', 'Kısa şekerlemeler motor becerilerin pekişmesine katkı sağlar'],
    'Bu asetatta uyku ve belleği ele alıyoruz. Gece uykusu sırasında hipokampus öğrenilen bilgileri kortekse aktarır. Bu bulgu ilk kez 1994 yılında sıçanlarda labirent deneyleriyle gösterildi ve sonra insanlarda doğrulandı. Sınav öncesi gece uykudan çalmanın neden ters teptiğini bir sonraki asetatta göreceğiz.');
  assert.equal(F.notSade(s), 2);
  assert.ok(/^Bu bulgu ilk kez 1994/.test(s.notes) && /sonraki asetatta göreceğiz\.$/.test(s.notes));
});
test('D2 korumalar: 3 cümleden kısa not, iki cümlenin altına inmek ve 45 kelime tabanının altına düşmek yok; dolgu eklenmez', () => {
  const kisa = S('T', ['Bir iki üç dört beş altı'], 'Bir iki üç dört beş altı. Köprü cümlesi.');
  assert.equal(F.notSade(kisa), 0); assert.equal(kisa.notes, 'Bir iki üç dört beş altı. Köprü cümlesi.');
  const b = 'Yenilenebilir enerji kapasitesi geçen yıl rekor düzeyde arttı ve kıyı bölgelerinde yoğunlaştı';
  const taban = S('Enerji', [b], b + '. Bu artışın yarısı rüzgârdan geldi, güneş ise maliyet düşüşüyle ikinci sırada kaldı ve yatırımcıyı çekti. Şebeke yatırımları bu hıza yetişemedi ve bağlantı kuyruğu birkaç yıl içinde uzadı. Sonraki asetatta bunun tüketiciye yansıyan bedelini birlikte göreceğiz.');
  const once = taban.notes; assert.ok(kel(once) >= 45);
  assert.equal(F.notSade(taban), 0, '45 kelimenin altına düşürecek atım yapılmaz'); assert.equal(taban.notes, once);
  const bos = S('T', ['x'], ''); assert.equal(F.notSade(bos), 0); assert.equal(bos.notes, '');
});
test('D3 EN: "In this slide" meta cümlesi ve madde yankısı atılır, rakamlı bağlam cümlesi kalır', () => {
  const s = S('Spaced repetition', ['Spaced repetition beats massed practice for long term retention'], 'In this slide we look at spaced repetition. Spaced repetition beats massed practice for long term retention. Cepeda and colleagues pooled 317 experiments and found the optimal gap grows with the retention interval. Next we turn to how to schedule reviews.');
  assert.equal(F.notSade(s), 2);
  assert.ok(/^Cepeda and colleagues pooled 317/.test(s.notes));
});

/* ================================ E · İSTEMCİ ÖNERİLERİ ================================ */
test('E1 THIN_SLIDE yalnız sıradan listede: alıntı, sayı, grafik, tablo, kapak, kapanış, kaynakça, gündem ve tek cümlelik ana mesaj cezalandırılmaz', () => {
  const ul = (t) => el('ul', { text: t });
  const d = [asetat('cover', 'Kapak', [el('t', { text: 'Alt başlık' })]), asetat('list', 'Gündem', [ul('Giriş\nYöntem\nSonuç')], { v: 10 }),
    asetat('list', 'Özet', [ul('Hız\nMaliyet')]),
    asetat('list', 'Ana fikir', [ul('Küçük başlayıp her adımda ölçmek riski belirgin biçimde azaltır.')]),
    asetat('quote', 'Söz', [el('t', { text: 'Kısa söz.' })]), asetat('stat', 'Rakam', [el('t', { text: '%38' }), el('t', { text: 'tasarruf' })]),
    asetat('chart', 'Grafik', [el('t', { text: 'ton' })]), asetat('refs', 'Kaynakça', [ul('a\nb')]), asetat('end', 'Teşekkürler', [])];
  assert.deepEqual(kodlar(d), ['THIN_SLIDE@3']);
});
test('E2 künye, soluk ve küçük yazı gövde sayılmaz; yeterli gövde ince değildir', () => {
  const img = el('img', { creditId: null }), kun = el('t', { text: 'Fotoğraf: Ad Soyad / Wikimedia · CC BY-SA 4.0 lisansı ile kullanılmıştır', size: 12 }); img.creditId = kun.id;
  const s = asetat('list', 'Bahçe', [el('ul', { text: 'Çatılar kiralanıyor\nYerel üretim' }), img, kun, el('t', { text: 'çok uzun bir soluk yer tutucu metin burada duruyor gerçekten', muted: true })]);
  assert.deepEqual(kodlar([s]), ['THIN_SLIDE@1']);
  const dolu = asetat('list', 'Bahçe', [el('ul', { text: 'Kentlerde boş çatı alanları sebze için kiralanıyor\nYerel üretim taşıma maliyetini azaltıyor' })]);
  assert.deepEqual(kodlar([dolu]), []);
});
test('E3 NOTES_ECHO: maddeyi ya da yalnız başlığı yineleyen not önerilir; bağlam ekleyen ve boş not önerilmez; not DEĞİŞMEZ', () => {
  const ul = el('ul', { text: 'Gece uykusu hipokampustaki bilgileri kortekse aktarır\nKısa şekerlemeler motor becerileri pekiştirir' });
  const yanki = asetat('list', 'Uyku ve bellek', [ul], { notes: 'Gece uykusu hipokampustaki bilgileri kortekse aktarır. Kısa şekerlemeler motor becerileri pekiştirir.' });
  const baslik = asetat('list', 'Uyku ve bellek', [el('ul', { text: ul.text })], { notes: 'Uyku ve bellek.' });
  const iyi = asetat('list', 'Uyku ve bellek', [el('ul', { text: ul.text })], { notes: 'Bu bulgu 1994 yılında sıçan deneyleriyle gösterildi. Sınav gecesi uykusuz kalmanın neden ters teptiğini birazdan göreceğiz.' });
  const bos = asetat('list', 'Uyku ve bellek', [el('ul', { text: ul.text })]);
  const n0 = yanki.notes;
  assert.deepEqual(kodlar([yanki, baslik, iyi, bos]).filter((c) => /^NOTES/.test(c)), ['NOTES_ECHO@1', 'NOTES_ECHO@2']);
  assert.equal(yanki.notes, n0);
});
test('E4 REPEATED_LAYOUT: üç düz madde listesi art arda bir kez önerilir; süreç dizisi (sıra ailesi), iki sütun ve tablo dizileri, araya giren tür önerilmez', () => {
  const L = (v) => asetat('list', 'Başlık ' + (++eid), [el('ul', { text: 'Yeterince uzun ve açıklayıcı bir madde burada duruyor\nİkinci madde de uzunca bir açıklama yapıyor' })], v ? { v } : {});
  const T = (lay) => asetat(lay, 'Başlık ' + (++eid), [el('t', { text: 'Yeterince uzun ve açıklayıcı bir gövde metni burada duruyor şimdi' })]);
  assert.deepEqual(kodlar([L(0), L(9), L(0), L(0)]), ['REPEATED_LAYOUT@3'], 'dizi başına bir kez');
  assert.deepEqual(kodlar([L(2), L(2), L(2)]), ['REPEATED_LAYOUT@3'], 'aynı çeşit üç kez');
  assert.deepEqual(kodlar([L(8), L(8), L(12), L(8)]), [], 'süreç dizisi bilinçli');
  assert.deepEqual(kodlar([T('two'), T('two'), T('two'), T('table'), T('table'), T('table')]), [], 'karşılaştırma dizisi');
  assert.deepEqual(kodlar([L(0), L(9), T('quote'), L(0), L(9)]), [], 'araya giren tür diziyi keser');
  assert.deepEqual(kodlar([asetat('cover', 'Kapak', []), L(0), asetat('list', 'Gündem', [el('ul', { text: 'a\nb\nc' })], { v: 10 }), L(0), L(9)]), ['REPEATED_LAYOUT@5'], 'yapı asetatı (kapak, gündem) sayılmaz: ne diziye girer ne diziyi keser');
  assert.deepEqual(kodlar([L(0), L(9)]), [], 'iki liste dizi değildir');
});
test('E5 öneriler durumu değiştirmez: Acadia puanı geçerken üç info bulgusu olsa da durum "passed"', () => {
  const ul = el('ul', { text: 'Hız\nMaliyet' });
  const d = { slides: [asetat('list', 'Özet', [ul], { notes: 'Özet.' })], quality: { score: 90, pass: true, issues: [] }, qualityKey: 'k' };
  const r = istemci.qaIcerik(d);
  assert.ok(r.bulgu.some((z) => z.code === 'THIN_SLIDE') && r.bulgu.some((z) => z.code === 'NOTES_ECHO'));
  assert.equal(r.durum, 'passed');
  assert.ok(r.bulgu.filter((z) => /THIN|NOTES|REPEATED/.test(z.code)).every((z) => z.severity === 'info'));
});

/* ================================ F · 10 SENARYO ================================ */
const SEN = [
  { ad: 'akademik', lang: 'tr', d: [
    S('Uyku ve bellek arasındaki bağ', ['Gece uykusu sırasında hipokampus gün içinde öğrenilen bilgileri yeniden oynatır ve kortekse aktarır. Bu süreç özellikle derin uyku evresinde yoğunlaşır ve kalıcı belleği besler.', 'REM evresi duygusal anıların işlenmesinde ve yaratıcı çözümlerde belirgin bir rol oynar', 'Uyku yoksunluğu dikkat ve çalışma belleği performansını aynı gün içinde düşürür'],
      'Bu asetatta uyku ve belleği ele alıyoruz. Gece uykusu sırasında hipokampus gün içinde öğrenilen bilgileri yeniden oynatır ve kortekse aktarır. Bu bulgu ilk kez sıçanlarda labirent deneyleriyle gösterildi, sonra insan beyin görüntülemesiyle doğrulandı ve bugün ders kitaplarına girdi. Birazdan bunun sınav dönemine etkisini göreceğiz.'),
    S('Temel kavramlar', ['Konsolidasyon: yeni öğrenilen bilginin zamanla kararlı belleğe dönüşmesi', 'Yavaş dalga uykusu: derin uyku evresi, beyin dalgaları yavaşlar', 'REM: hızlı göz hareketli uyku evresi, rüyaların çoğu burada görülür']),
    S('Öğrencilerde uyku düzeni', ['Sınav haftasında öğrencilerin çoğu gece yarısından sonra uyuyor ve sabah erken kalkıyor', 'Hafta sonu uzun uyumak hafta içindeki açığı tam olarak kapatmıyor', 'Ekran ışığı uykuya dalmayı geciktiriyor ve uyku kalitesini düşürüyor']),
    S('Rakamlarla uyku', [], '', { kind: 'stat', stats: [{ value: '%40', label: 'hatırlamada düşüş' }, { value: '7-9 saat', label: 'önerilen süre' }, { value: '90 dk', label: 'bir uyku döngüsü' }] }),
    S('Araştırmacıların uyarısı', ['Uykudan çalınan her saat ertesi günün öğrenmesinden borç alınmış zamandır.'], '', { kind: 'quote' }),
    S('Çalışma alışkanlıkları için öneriler', ['Zor konuları uykudan önceki saatlere değil sabah saatlerine yerleştirmek verimi artırıyor', 'Kısa şekerlemeler öğleden sonraki dikkat düşüşünü belirgin biçimde azaltıyor', 'Sınavdan önceki gece tam uyku son dakika tekrarından daha fazla puan getiriyor']),
    S('Sonuç', ['Uyku öğrenmenin bir parçasıdır, ondan çalınan zaman bellekten geri alınır', 'Düzenli uyku takvimi sınav başarısını yoğun tekrardan daha çok etkiler'])] },
  { ad: 'iş stratejisi', lang: 'en', d: [
    S('Why enter the Southeast Asian market now', ['Mobile payment adoption in the region doubled over three years and is still accelerating in cities', 'Local competitors lack the logistics depth that our platform already offers in Europe', 'Regulators in two key countries recently simplified licensing for foreign marketplaces']),
    S('Build versus buy comparison', ['Build: Full control over the product roadmap and data platform', 'Buy: Immediate access to an existing customer base and local brand', 'Build: Slower entry, roughly two years before meaningful revenue', 'Buy: High acquisition premium and difficult integration of teams']),
    S('Revenue outlook', ['Revenue grows steadily once the logistics hub opens'], '', { kind: 'chart', chart: { type: 'bar', labels: ['2025', '2026', '2027'], values: [12, 19, 31], unit: 'M USD' } }),
    S('Key risks', ['Currency volatility can erase margins within a single quarter in smaller markets', 'Talent for senior engineering roles is scarce and expensive in the region', 'A price war with incumbents would delay profitability beyond the plan']),
    S('Mitigation plan', ['Hedge currency exposure for the first two years through forward contracts', 'Open a regional engineering office in a city with strong universities', 'Compete on delivery speed and reliability rather than on price alone']),
    S('Partnerships', ['Local banks can bundle our checkout with their mobile wallets for faster adoption', 'Logistics partners reduce the capital needed for the first warehouses', 'Universities supply interns and research on regional consumer behaviour']),
    S('Recommendation', ['Enter through a minority stake in a local player, then build our own platform on top', 'Review the decision after eighteen months against clear revenue and retention targets'])] },
  { ad: 'tarih', lang: 'tr', d: [
    S('Cumhuriyetin ilk yılları', ['Yeni devlet savaştan çıkmış, nüfusu azalmış ve ekonomisi zayıf bir ülkeyi devraldı', 'Kurucu kadro hukuk, eğitim ve ekonomide köklü reformları kısa sürede başlattı', 'Reformlar kentlerde hızla, kırsal bölgelerde daha yavaş benimsendi']),
    S('Reform takvimi', ['1923: Cumhuriyet ilan edildi ve Ankara başkent oldu', '1926: Medeni Kanun kabul edilerek aile hukuku yenilendi', '1928: Harf devrimiyle Latin alfabesine geçildi', '1934: Kadınlara milletvekili seçme ve seçilme hakkı tanındı']),
    S('Eğitimdeki değişim', ['Millet mektepleri yetişkinlere okuma yazma öğretmek için ülke geneline yayıldı', 'Köy enstitüleri kırsal kesimde öğretmen yetiştirmeyi amaçlayan özgün bir modeldi', 'Okuryazarlık oranı on beş yılda belirgin biçimde yükseldi']),
    S('Ekonomik yapı', ['Devletçilik politikası özel sermayenin yetersiz kaldığı alanlarda devlet yatırımını öne çıkardı', 'İlk beş yıllık sanayi planı dokuma, şeker ve çimento fabrikalarına odaklandı', 'Demiryolu ağı iç bölgeleri limanlara bağlayacak biçimde genişletildi']),
    S('Bir tanığın anlatımı', ['Köyümüze ilk okul açıldığında annem de bizimle birlikte harfleri öğrenmeye geldi.'], '', { kind: 'quote' }),
    S('Toplumsal yaşam', ['Kılık kıyafet ve soyadı düzenlemeleri gündelik hayatı doğrudan etkiledi', 'Radyo ve gazeteler yeni değerlerin yayılmasında önemli araçlar oldu', 'Kentleşme hızlanırken geleneksel yapılar da varlığını sürdürdü']),
    S('Değerlendirme', ['Reformların hızı kalıcı kurumlar yarattı, ancak toplumsal karşılığı bölgeden bölgeye farklıydı', 'Bugünkü tartışmaların önemli bir kısmı bu dönemin mirasına dayanıyor'])] },
  { ad: 'bilimsel (gerçek sayılar)', lang: 'en', d: [
    S('Global temperature trend', ['Surface temperatures rose about 1.1 °C above the pre-industrial average by the early 2020s', 'The last nine years were the warmest nine on the instrumental record', 'Warming over land is roughly twice as fast as warming over the oceans']),
    S('Measured warming', ['Each decade has been warmer than the one before since the 1980s'], '', { kind: 'chart', chart: { type: 'line', labels: ['1980', '1990', '2000', '2010', '2020'], values: [0.26, 0.45, 0.62, 0.82, 1.1], unit: '°C' } }),
    S('Key figures', [], '', { kind: 'stat', stats: [{ value: '420 ppm', label: 'CO2 concentration' }, { value: '3.7 mm', label: 'sea level rise per year' }, { value: '13%', label: 'Arctic ice loss per decade' }] }),
    S('Ocean heat content', ['Oceans absorbed more than 90 percent of the excess heat trapped since 1970 and stored it in the upper layers. Ocean heat content reached a new record in 2023 according to several independent datasets.', 'Marine heatwaves are becoming longer and more frequent in most basins', 'Warmer water expands, which accounts for about a third of sea level rise'], '', { warn: [0] }),
    S('Ice and sea level', ['Greenland and Antarctica together lost roughly 400 billion tonnes of ice per year in the last decade. Mountain glaciers retreated almost everywhere on Earth during the same period and lost mass.', 'Sea level rise accelerated from 1.4 mm per year to about 3.7 mm per year', 'Coastal cities face more frequent flooding even under moderate scenarios']),
    S('Uncertainties', ['Cloud feedbacks remain the largest source of uncertainty in climate sensitivity estimates', 'Ice sheet dynamics could add more sea level rise than current models project', 'Regional rainfall changes are harder to predict than global temperature']),
    S('Conclusions', ['The warming trend is clear in every independent dataset, and its causes are well understood', 'Remaining uncertainties concern the pace of impacts, not the direction'])] },
  { ad: 'teknoloji karşılaştırması', lang: 'tr', d: [
    S('Neden dil seçimi önemli', ['Sistem programlamada dil seçimi güvenlik, performans ve ekip verimliliğini birlikte belirliyor', 'Yanlış seçim yıllar sonra yeniden yazım maliyeti olarak geri dönüyor', 'Ekosistem olgunluğu çoğu projede ham hızdan daha belirleyici oluyor']),
    S('Python ile Rust karşılaştırması', ['Python: Hızlı prototipleme ve geniş kütüphane desteği sunar', 'Rust: Bellek güvenliğini derleme anında garanti eder', 'Python: Yorumlanan yapısı nedeniyle yoğun hesapta yavaş kalır', 'Rust: Öğrenme eğrisi diktir ve derleme süresi uzundur']),
    S('Ölçülen başarım', ['Aynı algoritma için yanıt süreleri'], '', { kind: 'table', table: { headers: ['Ölçüt', 'Python', 'Rust'], rows: [['İstek/sn', '1.200', '9.800'], ['Bellek (MB)', '210', '35']] } }),
    S('Ekosistem', ['Python veri bilimi ve yapay zekâ kütüphanelerinde açık ara önde', 'Rust paket yöneticisi cargo bağımlılık yönetimini sadeleştiriyor', 'İki dil de olgun test ve belgeleme araçlarına sahip']),
    S('Ekip ve işe alım', ['Python bilen geliştirici bulmak kolay, ama kıdemli Rust geliştiricisi az', 'Rust ekipleri ilk aylarda yavaş ilerliyor, sonra hata oranı belirgin biçimde düşüyor', 'Karma ekipler iki dili birlikte kullanarak riskleri dengeleyebiliyor']),
    S('Birlikte kullanım', ['Python arayüz ve iş mantığını taşırken hesap yoğun çekirdek Rust ile yazılabilir', 'PyO3 gibi köprüler iki dili aynı süreçte çalıştırmayı kolaylaştırıyor', 'Bu yaklaşım yeniden yazım riskini adım adım azaltıyor']),
    S('Öneri', ['Prototip ve veri işleri için Python, gecikmeye duyarlı servisler için Rust seçilmeli', 'Karar her yeni serviste ölçülen başarım ve ekip yetkinliğiyle yeniden gözden geçirilmeli'])] },
  { ad: 'adım adım süreç', lang: 'tr', d: [
    S('Neden kompost', ['Mutfak atıklarının yaklaşık yarısı organik ve kompostlanabilir nitelikte', 'Kompost toprağın su tutma kapasitesini artırıyor ve gübre ihtiyacını azaltıyor', 'Evde kompost çöp hacmini belirgin biçimde düşürüyor']),
    S('Kompost hazırlama süreci', ['Adım 1: Kahverengi ve yeşil atıkları ayrı kaplarda topla', 'Adım 2: Atıkları katmanlar hâlinde kompost kutusuna yığ', 'Adım 3: Yığını haftada bir havalandırmak için karıştır', 'Adım 4: Altı ila sekiz hafta sonra olgun kompostu elekten geçir']),
    S('Doğru karışım', ['Kahverengi malzeme karbon, yeşil malzeme azot sağlar ve ikisi dengelenmelidir', 'Fazla yeşil atık kötü koku, fazla kahverengi atık yavaş ayrışma demektir', 'Nem sıkılmış bir sünger kıvamında tutulmalıdır']),
    S('Sık yapılan hatalar', ['Et ve süt ürünleri eklemek zararlıları çekiyor ve kötü koku yaratıyor', 'Yığını hiç karıştırmamak havasız ayrışmaya ve çürümeye yol açıyor', 'Kutuyu güneşe tamamen açık bırakmak yığını hızla kurutuyor']),
    S('Kompostun kullanımı', ['Olgun kompost saksı toprağına üçte bir oranında karıştırılabilir', 'Bahçede bitki diplerine ince bir katman hâlinde serilebilir', 'Kompost çayı yaprak gübresi olarak seyreltilerek kullanılabilir']),
    S('Akılda kalanlar', ['Denge, nem ve hava doğru olduğunda kompost kendiliğinden olgunlaşır', 'Küçük bir kutuyla başlayıp deneyim kazandıkça büyütmek en güvenli yoldur'])] },
  { ad: 'eğitim', lang: 'en', d: [
    S('How memory works in learning', ['Working memory holds only a few items at once, so new material must be chunked into small parts', 'Long term memory grows when new knowledge is connected to what students already know', 'Forgetting is fast at first and then slows down over the following weeks']),
    S('Spaced repetition', ['Reviewing material at increasing intervals produces stronger retention than cramming the night before. Students who space their reviews remember more after a month, even with the same total time.', 'Short daily reviews are more effective than one long weekly session', 'Flashcard apps can schedule reviews automatically for each student'],
      'In this slide we look at spaced repetition. Reviewing material at increasing intervals produces stronger retention than cramming the night before. A meta analysis of 317 experiments found that the best gap between reviews grows with how long students need to remember the material. Next we look at retrieval practice.'),
    S('Retrieval practice', ['Testing yourself is a learning tool, not just a way to measure what you know. Because each recall attempt strengthens the memory trace, low stakes quizzes help most.', 'Explaining a concept aloud reveals gaps that rereading hides', 'Practice tests work best when students get feedback right after']),
    S('A teacher reflects', ['When my students started quizzing each other, their exam anxiety dropped along with their mistakes.'], '', { kind: 'quote' }),
    S('Common myths', ['Learning styles matching instruction to visual or auditory preference has little evidence behind it', 'Rereading and highlighting feel productive but produce weak long term retention', 'Multitasking during study lowers comprehension and increases study time']),
    S('Classroom techniques', ['Start each lesson with three quick questions from previous weeks', 'Mix different problem types in one practice set instead of blocking them', 'Ask students to write a short summary at the end of each lesson']),
    S('Takeaways', ['Spacing and retrieval are simple, low cost techniques with strong evidence behind them', 'Small changes in routine can make study time far more effective'])] },
  { ad: 'kavramsal', lang: 'tr', d: [
    S('Etik nedir', ['Etik, doğru ve yanlış davranışın ölçütlerini sistemli biçimde sorgulayan felsefe dalıdır', 'Gündelik ahlaki yargılarımızın çoğu farkında olmadığımız etik varsayımlara dayanır', 'Etik kuramlar bu varsayımları açık hâle getirip karşılaştırmayı sağlar']),
    S('Üç temel kuram', ['Erdem etiği: iyi bir insanın hangi karakter özelliklerine sahip olduğunu sorar', 'Ödev etiği: sonuçtan bağımsız olarak uyulması gereken ilkeleri öne çıkarır', 'Sonuççuluk: bir eylemin doğruluğunu doğurduğu sonuçlara göre değerlendirir']),
    S('Bir düşünce deneyi', ['Raydan çıkan bir vagonu tek kişiyi feda ederek beş kişiyi kurtarmak için yönlendirmek doğru mudur', 'Sonuççular çoğunlukla evet derken ödev etikçileri insanı araç olarak kullanmaya itiraz eder', 'Deney sezgilerimizin kuramlardan daha karmaşık olduğunu gösterir']),
    S('Gündelik hayatta etik', ['Sosyal medyada paylaşım yaparken başkalarının mahremiyetine saygı göstermek etik bir tercihtir', 'Grup ödevinde emeği adil paylaşmak ödev etiğine yakın bir tutumdur', 'Tüketim tercihleri de sonuçları açısından etik değerlendirmeye açıktır']),
    S('Kuramların zayıf yanları', ['Erdem etiği somut ikilemlerde net bir yol göstermekte zorlanır', 'Ödev etiği ilkeler çatıştığında hangisinin öncelikli olduğunu söylemez', 'Sonuççuluk sonuçları önceden bilmenin zorluğuyla karşı karşıyadır']),
    S('Bir filozofun sözü', ['Sorgulanmamış bir hayat yaşanmaya değmez.'], '', { kind: 'quote' }),
    S('Sonuç', ['Hiçbir kuram tek başına yeterli değil, ama her biri farklı bir soruyu görünür kılıyor', 'Etik düşünmek doğru cevabı ezberlemekten çok iyi soru sormayı öğrenmektir'])] },
  { ad: 'kısa odaklı mesajlar', lang: 'tr', d: [
    S('Tek bir fikir', ['Küçük başlayıp her adımda ölçmek riski belirgin biçimde azaltır.']),
    S('Rakamlarla', [], '', { kind: 'stat', stats: [{ value: '%38', label: 'su tasarrufu' }, { value: '1.200', label: 'gönüllü' }, { value: '14', label: 'mahalle bahçesi' }] }),
    S('Bir gönüllü anlattı', ['Bahçede geçirdiğim her sabah mahallemizi yeniden tanımamı sağladı.'], '', { kind: 'quote' }),
    S('Üç kelime', ['Hız', 'Maliyet', 'Güven']),
    S('Su kullanımı', ['Damla sulama yağmurlamaya göre suyu doğrudan köke ulaştırır', 'Akşam yerine sabah sulamak yaprak hastalıklarını azaltır', 'Malç katmanı toprağın nemini günlerce korur']),
    S('Hasat', [], '', { kind: 'chart', chart: { type: 'bar', labels: ['Haz', 'Tem', 'Ağu'], values: [40, 85, 60], unit: 'kg' } }),
    S('Son söz', ['Toprağa ne verirsen o geri döner, sabırla ve ölçerek ilerle'])] },
  { ad: 'bilinçli tutarlı düzen', lang: 'en', d: [
    S('Onboarding in three phases', ['Phase one prepares accounts and equipment before the first day', 'Phase two pairs new hires with a mentor for their first project', 'Phase three reviews progress after ninety days and sets goals']),
    S('Phase one process', ['Step 1: Create accounts and send equipment a week before the start', 'Step 2: Share the first week schedule and team contacts', 'Step 3: Prepare a small starter task with clear instructions']),
    S('Phase two process', ['Step 1: Assign a mentor from a neighbouring team', 'Step 2: Pair on a real but low risk project for four weeks', 'Step 3: Hold short weekly check ins with mentor and manager']),
    S('Phase three process', ['Step 1: Collect feedback from the new hire and the team', 'Step 2: Compare progress against the goals set on day one', 'Step 3: Agree on development goals for the next quarter']),
    S('Remote versus office comparison', ['Remote: Flexible schedules and access to a wider talent pool', 'Office: Faster informal learning through everyday contact', 'Remote: Harder to build trust without shared routines', 'Office: Commuting time reduces focus and satisfaction']),
    S('What we measure', ['Time to first merged contribution shows how quickly people become productive', 'Ninety day retention reveals whether onboarding builds commitment', 'Mentor feedback highlights gaps in documentation and tooling']),
    S('Next steps', ['Pilot the three phase plan with the next hiring cohort and track the same three measures', 'Adjust each phase based on feedback before rolling it out company wide'])] }];

const SONUC = [];
SEN.forEach((sc, si) => {
  test('F' + (si + 1) + ' senaryo "' + sc.ad + '": sıra, başlık, kaynak, sayı ve sözcükler korunur; tür yalnız içerik kanıtıyla değişir', () => {
    const once = kopya(sc.d), sonra = kopya(sc.d), t0 = process.hrtime.bigint();
    const iz = gecis(sonra, sc.lang), ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.equal(sonra.length, once.length, 'asetat sayısı aynı');
    sonra.forEach((x, i) => {
      const o = once[i];
      assert.equal(x.title, o.title); assert.deepEqual(x.src, o.src, 'atıf korunur'); assert.deepEqual(x.stats, o.stats); assert.deepEqual(x.chart, o.chart); assert.deepEqual(x.table, o.table); assert.deepEqual(x.image, o.image);
      assert.ok(x.kind === o.kind || (o.kind === 'list' && /^(time|two)$/.test(x.kind)), 'yalnız list → time/two: ' + o.kind + '→' + x.kind);
      const ob = o.bullets.join(' '), sb = x.bullets.join(' ');
      assert.deepEqual(sayilar(sb).sort(), sayilar(ob).sort(), 'sayı kaybı yok: ' + o.title);
      if (x.kind === o.kind) assert.equal(sb.replace(/[.;]\s/g, ' ').toLocaleLowerCase('tr'), ob.replace(/[.;]\s/g, ' ').toLocaleLowerCase('tr'), 'sözcükler aynen (yalnız bölme): ' + o.title);
      else assert.equal(kel(sb) <= kel(ob) && kel(sb) >= kel(ob) - x.bullets.length, true, 'iki sütunda yalnız önek kalkar');
      if (o.notes) assert.ok(x.notes && o.notes.includes(x.notes.split(/(?<=[.!?])\s+/).pop()), 'köprü cümlesi kalır');
      assert.ok(kel(o.notes) < 45 || kel(x.notes) >= 45, 'en az 45 kelimelik not tabanın altına düşmez (yoksa not uzatma çağrısı yeniden tetiklenirdi)');
    });
    if (o_last(once).kind === 'list') assert.equal(o_last(sonra).kind, 'list', 'sonuç asetatı liste kalır');
    const a = olc(once), b = olc(sonra);
    SONUC.push({ ad: sc.ad, lang: sc.lang, n: sonra.length, iz, ms, a, b });
    assert.ok(b.uzun <= a.uzun, 'uzun madde artmaz'); assert.ok(b.yanki <= a.yanki, 'yankılı not artmaz');
  });
});
function o_last(d) { return d[d.length - 1]; }

test('F11 hedefler (malzeme destekliyorsa): ≥6 içerik asetatında ≥3 düzen ailesi, en çok 2 art arda düz madde listesi; bilinçli dizi önerilmez', () => {
  assert.equal(SONUC.length, 10);
  SONUC.forEach((r) => {
    if (r.n >= 6) assert.ok(r.b.aile >= 3, r.ad + ': aile ' + r.b.aile + ' (' + r.b.seri + ')');
    assert.ok(r.b.enKos <= 2, r.ad + ': art arda madde listesi ' + r.b.enKos + ' (' + r.b.seri + ')');
  });
  const kisa = SONUC.find((r) => r.ad === 'kısa odaklı mesajlar'), tut = SONUC.find((r) => r.ad === 'bilinçli tutarlı düzen');
  assert.deepEqual(kisa.b.kod.filter((c) => /^THIN/.test(c)), ['THIN_SLIDE@4'], 'yalnız "Üç kelime" ince; alıntı, sayı, grafik ve tek cümlelik ana mesaj değil');
  assert.equal(tut.b.tekrar, 0, 'süreç dizisi önerilmez: ' + tut.b.seri);
  assert.ok(tut.b.seri.split(' ').slice(1, 4).every((x) => /^list:(8|12)$/.test(x)), 'üç süreç asetatı sıra çeşidinde (8/12): ' + tut.b.seri);
});

/* ================================ G · MALİYET ================================ */
test('G1 geçiş deterministik ve ucuz: aynı girdi → aynı çıktı; 10 senaryonun toplamı 50 ms altında', () => {
  SEN.forEach((sc) => { const x = kopya(sc.d), y = kopya(sc.d); gecis(x, sc.lang); gecis(y, sc.lang); assert.deepEqual(x, y); });
  const t0 = process.hrtime.bigint(); for (let k = 0; k < 20; k++) SEN.forEach((sc) => gecis(kopya(sc.d), sc.lang));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 20;
  assert.ok(ms < 50, 'ortalama ' + ms.toFixed(2) + ' ms');
  console.log('        geçiş (10 deste, ortalama): ' + ms.toFixed(2) + ' ms');
});

/* ================================ H · GERÇEK PENCERE (başsız Chrome) ================================ */
const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');
const tarayici = () => {
  if (!CHROME) { console.log('  ATLANDI  H1 (başsız Chrome): Chrome bulunamadı — CHROME_BIN ile yol verin. Bu test GEÇTİ sayılmadı.'); return Promise.resolve(); }
  const { sayfa, kos, temizle } = duzenek();
  const KANCA = '  window.__QA7 = { liste: qaListe, ICERIK: ICERIK, baslik: titleOf };\n';
  const NOT = 'Bu eğilim 2020 sonrasında hızlandı; bazı belediyeler çatı kiralamasını vergi indirimiyle destekliyor. İzmir örneği bunu gösteriyor.';
  const STR = [{ k: 'cover', t: 'Bahçe tarımı', b: [] },
    { k: 'list', t: 'Neden yükseliyor', b: ['Kentlerde boş çatı alanları artık sebze yetiştirmek için kiralanıyor', 'Yerel üretim taşıma maliyetini ve gecikmeyi belirgin biçimde azaltıyor', 'Gençler hobi olarak başladıkları işi küçük girişimlere dönüştürüyor'] },
    { k: 'list', t: 'Özet', b: ['Hız', 'Maliyet'] },
    { k: 'quote', t: 'Bir gönüllü', b: ['Bahçe bize komşuluğu yeniden öğretti.'] },
    { k: 'end', t: 'Teşekkürler', b: [] }];
  /* Ağ kapalı: Acadia not yazamaz, basımın kendi şablon notu kalır ("İlk olarak <madde>…")
     — bu not maddeleri yineler, NOTES_ECHO'nun gerçek hedefi. */
  const govde = `
    await sakin(); d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA);
    S.set(${JSON.stringify(STR)}, { title: 'Anlati', sub: 't', lang: 'tr', source: 'topic', sourceId: null, yol: { k: 'research', yedek: 0 }, sources: [], istek: 5 }); S.bas('new'); await sakin(); await bekle(2500); await dur(1200);
    var D = S.deck(), Q = window.__QA7, titleOf = Q.baslik, bul = function () { return Q.liste(D).bulgu.filter(function (x) { return /^(THIN_SLIDE|NOTES_ECHO|REPEATED_LAYOUT)$/.test(x.code); }); };
    R.seri = D.slides.map(function (s) { return s.lay + ':' + (s.v || 0) + ':' + titleOf(s); });
    R.liste = bul().map(function (x) { return { id: x.id, severity: x.severity, priority: x.priority, repairable: x.repairable, message: x.message, recommendation: x.recommendation }; });
    var iz0 = JSON.stringify(D.slides);
    d.querySelector('[data-audit]').click(); await bekle(500);
    var g = d.querySelector('[data-qa-ov]'); g = g && g.closest('dialog');
    R.it = g ? Array.prototype.map.call(g.querySelectorAll('[data-qa-id]'), function (x) { return { id: x.getAttribute('data-qa-id'), pri: x.getAttribute('data-qa-pri'), onar: x.hasAttribute('data-qa-onar') }; }) : null;
    R.det = {}; R.it && R.it.forEach(function (x) { if (!/^(THIN_SLIDE|NOTES_ECHO)@/.test(x.id)) return; var b = g.querySelector('[data-qa-sel="' + x.id + '"]'); if (b) b.click(); var t = g.querySelector('[data-qa-det]'); R.det[x.id] = { metin: t ? t.textContent.replace(/[ ]+/g, ' ').trim() : '', pre: !!g.querySelector('[data-qa-pre]') }; });
    R.ayni = JSON.stringify(D.slides) === iz0;
    /* kullanıcı nota bağlam yazar: yankı önerisi kalkar, not olduğu gibi kalır */
    var n2 = D.slides.findIndex(function (s) { return titleOf(s) === 'Neden yükseliyor'; }); D.slides[n2].notes = ${JSON.stringify(NOT)};
    R.sonra = bul().map(function (x) { return x.id; }); R.not2 = D.slides[n2].notes; R.n2 = n2 + 1;`;
  return (async () => {
    const H = yeniSunucu({ senkron: true }); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r));
    let R;
    try { let h = sayfa('ok', H.srv.address().port, 0, govde); assert.equal(h.split('  window.__S = { set:').length, 2); h = h.replace('  window.__S = { set:', () => KANCA + '  window.__S = { set:'); R = await kos('anlati-h1.html', 'anlati-h1', h); }
    finally { H.srv.close(); temizle(); }
    test('H1 gerçek pencere: ince liste ve yankılı not önerisi düşük öncelikte, onarımsız, iletisiyle görünür; alıntı cezalandırılmaz; pencere desteyi değiştirmez, kullanıcı notu korunur', () => {
      assert.ok(!R.hata, R.hata);
      const yer = (ad) => R.seri.findIndex((x) => x.endsWith(':' + ad)) + 1;
      const n2 = yer('Neden yükseliyor'), n3 = yer('Özet'), n4 = yer('Bir gönüllü');
      assert.ok(n2 && n3 && n4, 'basılan seri: ' + R.seri.join(' | '));
      assert.equal(R.seri[n3 - 1].split(':').slice(0, 2).join(':'), 'list:' + R.seri[n3 - 1].split(':')[1]);
      assert.deepEqual(R.liste.map((x) => x.id).sort(), ['NOTES_ECHO@' + n2, 'THIN_SLIDE@' + n3].sort(), 'öneriler: ' + JSON.stringify(R.liste.map((x) => x.id)) + ' / ' + R.seri.join(' | '));
      R.liste.forEach((x) => { assert.equal(x.severity, 'info'); assert.equal(x.priority, 'dusuk'); assert.equal(x.repairable, false); assert.ok(x.message && x.recommendation, x.id + ' iletisi'); });
      const ekr = R.it.filter((x) => /^(THIN_SLIDE|NOTES_ECHO)@/.test(x.id));
      assert.equal(ekr.length, 2, 'pencerede iki öneri: ' + JSON.stringify(R.it));
      assert.ok(ekr.every((x) => x.pri === 'dusuk' && !x.onar), 'düşük öncelik, onarım düğmesi yok');
      assert.ok(R.det['THIN_SLIDE@' + n3].metin.includes('asetat çok ince'), 'ince asetat iletisi: ' + R.det['THIN_SLIDE@' + n3].metin);
      assert.ok(R.det['NOTES_ECHO@' + n2].metin.includes('konuşma notu'), 'yankı iletisi: ' + R.det['NOTES_ECHO@' + n2].metin);
      assert.ok(Object.values(R.det).every((x) => !x.pre), 'öneri için önizle/uygula yok');
      assert.ok(R.ayni, 'pencereyi açmak ve öneri seçmek desteyi değiştirdi');
      assert.equal(R.n2, n2);
      assert.deepEqual(R.sonra, ['THIN_SLIDE@' + n3], 'bağlam yazılınca yankı önerisi kalkar');
      assert.ok(R.not2.startsWith('Bu eğilim 2020'), 'kullanıcı notu korunur');
      assert.deepEqual(R.ag.filter((u) => !/^https?:\/\/127\.0\.0\.1/.test(u)), [], 'dış ağ isteği yok: ' + JSON.stringify(R.ag));
    });
  })();
};

tarayici().then(() => summary()).then(() => rapor());
function rapor() {
  if (!process.env.ANLATI_TABLO) return;
  console.log('\n  senaryo | n | aile önce→sonra | en uzun madde koşusu | 3× aynı | uzun madde | ince | yankılı not | tekrar önerisi | time/two/bölünen/not cümlesi');
  SONUC.forEach((r) => console.log(`  ${r.ad} (${r.lang}) | ${r.n} | ${r.a.aile}→${r.b.aile} | ${r.a.enKos}→${r.b.enKos} | ${r.a.uc}→${r.b.uc} | ${r.a.uzun}→${r.b.uzun} | ${r.a.ince}→${r.b.ince} | ${r.a.yanki}→${r.b.yanki} | ${r.a.tekrar}→${r.b.tekrar} | ${r.iz.time}/${r.iz.two}/${r.iz.bolunen}/${r.iz.notCumle}\n     önce ${r.a.seri}\n     sonra ${r.b.seri}`));
}
