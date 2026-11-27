/* ==========================================================================
   ACADEX — SUNUM KAYNAK KAYDI VE İDDİA KÖKENİ (tests/sunum-kaynak-kayit.js)

   NEDEN VAR (27.11.2026, #49 Phase 8.1):
     - Deste kaynakları kalıcı bir kayıtta (deck.kaynaklar, KaynakKaydi) tutulur: sid kanonik adresten (izleme parametresi
       atılır, kaynağı ayıran parametre kalır), belge/kartta gerçek kimlikten; sid kaynakçadaki n'den ayrıdır.
     - sunum-research her iddia için kaynağından BİREBİR parça çıkarır (≤300, kaynak başına 6, deste başına 40), yalnız "aday" ya
       da "baglam" rolüyle. "destek" yok; kanıt kontrolü Phase 8.2'nin işi. Tam metin, parça ve iddia paylaşım görüntüsüne girmez.
     - İstemci iddiaları (e.iddia) son içerikten kurar; kimlik asetat + öğe + metin + sıra; metin değişince kayıt bayat olur, silinmez.
     - Eski deste: kayıt yok, geri doldurma yok; pencere satırları "Doğrulanmadı" diye yalnız gösterir.
   Bölümler:  A kimlik · B parça güvenliği · C eşleme · D doğrulama sınırı · E kalıcılık (çapraz cihaz, eski deste) ·
              F belge/kart · G pencere ve güvenlik (başsız Chrome, ağ sıfır).
   Çalıştırma:  node tests/sunum-kaynak-kayit.js
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
const kopya = (x) => JSON.parse(JSON.stringify(x));
const yorumsuz = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ---------- sunucu (loadFromSource) ---------- */
const F = loadFromSource(SRV_PATH, ['PARCA_KAYNAK', 'PARCA_BOY', 'PARCA_TOPLAM', 'GUVENSIZ', 'parcaPencere', 'parcaAnahtar', 'parcaSayi', 'parcaIddia', 'parcaKur']);
const SRVBLOK = cut(srv, '/* #49 (Phase 8.1) KAYNAK PARÇASI', '\nconst PLAN_KIND');

/* ---------- istemci dilimleri ---------- */
const arr = (x) => (Array.isArray(x) ? x : []);
const txt = (x) => String(x == null ? '' : x).trim();
const DECOR = { mark: 1, arrow: 1, rect: 1, ellipse: 1 };
const titleOf = new Function(cut(ink, '  var titleOf = function (s) {', '  var fitThumbs') + ';return titleOf;')();
const kunyeSahibi = new Function(ink.match(/  var kunyeSahibi = function[^\n]+/)[0] + ';return kunyeSahibi;')();
const KBLOK = cut(ink, '  /* ---------- #49 (Phase 8.1) KAYNAK KAYDI', '  /* ---------- #49 son ---------- */');
const K = new Function('arr', 'txt', 'titleOf', 'DECOR', 'kunyeSahibi', KBLOK + ';return { kyHash: kyHash, kyKanon: kyKanon, kyNorm: kyNorm, kyAnah: kyAnah, kyParca: kyParca, kyKes: kyKes, kaynakKur: kaynakKur, kaynakListe: kaynakListe, kaynakEsle: kaynakEsle, kanitCevir: kanitCevir, kartKaynak: kartKaynak, kyYapi: kyYapi, kyCapa: kyCapa, iddiaKur: iddiaKur, iddiaTazele: iddiaTazele, iddiaYenile: iddiaYenile, kyKayit: kyKayit, kyEksik: kyEksik, kyGoster: kyGoster, kySrc: kySrc, KY_GUVENSIZ: KY_GUVENSIZ };')(arr, txt, titleOf, DECOR, kunyeSahibi);
const fromResearch = new Function('arr', 'txt', cut(ink, '  var fromResearch = function (d) {', '  /* akıllı düzen:') + ';return fromResearch;')(arr, txt);
const cite = new Function('arr', 'curLang', cut(ink, '  var cite = function (st, srcs) {', '\n  };\n') + '\n  };return cite;')(arr, () => 'tr');

let eid = 0;
const el = (type, o) => Object.assign({ id: 'e' + (++eid), type, x: 0, y: 0, w: 400, h: 80, size: 24, text: '' }, o);
const asetat = (lay, title, body, o) => Object.assign({ id: 's' + (++eid), lay, bg: 'clear', notes: '', els: [el('h', { text: title, size: 42 })].concat(body) }, o);
const iddialar = (sl) => sl.els.flatMap((e) => (e.iddia || []).map((r) => Object.assign({ el: e.id }, r)));
const WEB = { tmp: 1, n: 1, tur: 'web', baslik: 'Dünya Kentleşme Raporu', url: 'https://ornek.org/rapor?id=7&utm_source=x', site: 'ornek.org', apa: 'Örnek (2024).', parca: [{ metin: 'Dünya nüfusunun yüzde 56 kadarı bugün kentlerde yaşıyor ve oran artıyor.', tur: 'pasaj' }, { metin: 'Rapor kentleşmenin hızını bölgelere göre karşılaştırıyor.', tur: 'snippet' }] };

/* ------------------------------ A: kimlik ------------------------------ */
test('A1 kanonik adres: yalnız izleme parametreleri atılır, kaynağı ayıran parametre ve sırası kalır; # yalnız #!/#/ yoluysa; http(s) dışı boş', () => {
  assert.equal(K.kyKanon('HTTPS://Ornek.ORG:443/a/b?utm_source=x&id=7&fbclid=1&page=2#bolum'), 'https://ornek.org/a/b?id=7&page=2');
  assert.equal(K.kyKanon('https://ornek.org/a?page=2&id=7'), 'https://ornek.org/a?page=2&id=7', 'parametre sırası korunur');
  assert.notEqual(K.kyKanon('https://ornek.org/a?id=7'), K.kyKanon('https://ornek.org/a?id=8'), 'kaynağı ayıran parametre atılmamalı');
  assert.equal(K.kyKanon('https://app.ornek.org/#!/makale/3'), 'https://app.ornek.org/#!/makale/3', 'hash yönlendirmeli sayfa ayrı kaynaktır');
  assert.equal(K.kyKanon('https://app.ornek.org/#/m/3'), 'https://app.ornek.org/#/m/3');
  assert.equal(K.kyKanon('https://ornek.org/x#giris'), 'https://ornek.org/x', 'bölüm çapası aynı kaynak');
  ['javascript:alert(1)', 'data:text/html,x', 'ftp://ornek.org/a', 'ornek.org/a', '', null].forEach((u) => assert.equal(K.kyKanon(u), '', String(u)));
  assert.equal(K.kyKanon('https://ornek.org/a?UTM_Medium=e&gclid=2&mc_cid=3&_ga=1&igshid=4&msclkid=5&yclid=6&dclid=7&mc_eid=8&q=ara'), 'https://ornek.org/a?q=ara');
});

test('A2 sid: izleme parametresi farklı aynı adres → aynı sid; kaynakçadaki n sid değildir; çakışan sid yeniden özetlenir', () => {
  const a = K.kaynakKur([], [WEB]), b = K.kaynakKur([], [Object.assign({}, WEB, { url: 'https://ornek.org/rapor?id=7&utm_campaign=y#ust', n: 4 })]);
  assert.equal(a.kaynaklar[0].sid, b.kaynaklar[0].sid, 'izleme/çapa sid değiştirmemeli');
  assert.equal(a.kaynaklar[0].n, 1); assert.equal(b.kaynaklar[0].n, 4); assert.ok(/^w[0-9a-z]+$/.test(a.kaynaklar[0].sid) && a.kaynaklar[0].sid !== '1');
  const c = K.kaynakKur([], [Object.assign({}, WEB, { url: 'https://ornek.org/rapor?id=8' })]);
  assert.notEqual(c.kaynaklar[0].sid, a.kaynaklar[0].sid);
  /* çakışma: eski kayıt aynı sid'i başka bir adresle taşıyor */
  const sahte = { sid: a.kaynaklar[0].sid, n: 1, tur: 'web', baslik: 'Başka', url: 'https://baska.org/z', site: 'baska.org', parca: [] };
  const d = K.kaynakKur([sahte], [WEB]);
  assert.equal(d.kaynaklar.length, 2); assert.notEqual(d.kaynaklar[1].sid, sahte.sid, 'çakışan sid yeniden özetlenmeli');
  assert.equal(d.harita['1'].sid, d.kaynaklar[1].sid); assert.equal(d.kaynaklar[0].url, 'https://baska.org/z', 'eski kayıt değişmemeli');
  /* ekleme kipi: aynı kaynak birleşir, n ilk kaydınki kalır */
  const e = K.kaynakKur(a.kaynaklar, [Object.assign({}, WEB, { n: 3, tmp: 5 })]);
  assert.equal(e.kaynaklar.length, 1); assert.equal(e.kaynaklar[0].n, 1); assert.equal(e.harita['5'].sid, a.kaynaklar[0].sid);
  /* kayıt alanları: tam metin, ctx, snippet alanı yok */
  assert.deepEqual(Object.keys(a.kaynaklar[0]).sort(), ['apa', 'baslik', 'erisim', 'kalite', 'n', 'parca', 'ref', 'sid', 'site', 'tarih', 'tur', 'url']);
  assert.deepEqual(a.kaynaklar[0].kalite, { guvenilir: null, sendika: null });
  assert.equal(K.kaynakKur([], [{ tmp: 2, tur: 'web', url: 'https://tr.wikipedia.org/wiki/Kent', baslik: 'Kent' }]).kaynaklar[0].tur, 'wiki');
});

const listeAsetat = () => asetat('list', 'Şehirler neden kilit?', [el('ul', { text: 'Aynı cümle iki kez geçiyor burada [1]\nEnerji tüketiminin üçte ikisi kentlerden [1]\nAynı cümle iki kez geçiyor burada [1]' })]);
const listeSerit = { t: 'Şehirler neden kilit?', k: 'list', b: ['Aynı cümle iki kez geçiyor burada [1]', 'Enerji tüketiminin üçte ikisi kentlerden [1]', 'Aynı cümle iki kez geçiyor burada [1]'], src: [1], pv: [[{ id: 1, p: 0, rol: 'aday' }], [{ id: 1, p: 1, rol: 'baglam' }], []] };

test('A3 cid: aynı metin iki kez → iki ayrı kayıt; asetat sırası değişse, kopyalansa, kaydedilip yüklense de kimlik tutarlı', () => {
  const H = K.kaynakKur([], [WEB]).harita, sl = listeAsetat();
  assert.equal(K.iddiaKur(sl, listeSerit, H), 3);
  const r = iddialar(sl); assert.equal(new Set(r.map((x) => x.cid)).size, 3, 'çift metin ezilmemeli');
  assert.equal(r[0].h, r[2].h, 'aynı metnin çapası aynı'); assert.notEqual(r[0].cid, r[2].cid);
  assert.equal(r[0].text, 'Aynı cümle iki kez geçiyor burada', 'atıf etiketi iddia metnine girmez');
  /* aynı kimliklerle yeniden kurulum → aynı cid (deterministik); sıra değişimi cid'e girmez */
  const sl2 = kopya(sl); sl2.els.forEach((e) => { delete e.iddia; }); K.iddiaKur(sl2, listeSerit, H);
  assert.deepEqual(iddialar(sl2).map((x) => x.cid), r.map((x) => x.cid));
  const deste = { slides: [asetat('cover', 'Kapak', []), sl] }, ters = kopya(deste); ters.slides.reverse();
  assert.deepEqual(iddialar(ters.slides[0]).map((x) => x.cid), r.map((x) => x.cid), 'sıra değişimi kimliği değiştirmemeli');
  /* kaydet/yükle: JSON gidiş-dönüş aynen; tazeleme bayat yazmaz */
  const geri = JSON.parse(JSON.stringify(sl)); assert.equal(K.iddiaTazele(geri), 0); assert.deepEqual(iddialar(geri), r);
  /* çoğaltma: yeni asetat/öğe kimliği → yeni cid, kanıt kopyalanır (aynı nesne değil), çakışma yok */
  const yid = {}, c = kopya(sl); c.id = 'kopya-s'; c.els.forEach((e) => { const n = 'k-' + e.id; yid[e.id] = n; e.id = n; }); K.iddiaYenile(c, yid);
  const rc = iddialar(c); assert.equal(rc.length, 3); rc.forEach((x, i) => { assert.notEqual(x.cid, r[i].cid); assert.deepEqual(x.kanit, r[i].kanit); });
  assert.equal(new Set(rc.concat(r).map((x) => x.cid)).size, 6);
  assert.notEqual(c.els[1].iddia[0].kanit, sl.els[1].iddia[0].kanit, 'kanıt dizisi paylaşılmamalı');
});

test('A4 düzenleme: metni değişen iddia bayat olur, kaydı SİLİNMEZ; metin geri gelince bayatlık kalkar; iki eşten biri değişince yalnız biri bayat', () => {
  const H = K.kaynakKur([], [WEB]).harita, sl = listeAsetat(); K.iddiaKur(sl, listeSerit, H);
  const ul = sl.els[1], once = kopya(ul.iddia);
  ul.text = ul.text.replace('Enerji tüketiminin üçte ikisi', 'Enerji tüketiminin yarısı');
  assert.equal(K.iddiaTazele(sl), 1); assert.equal(ul.iddia.length, 3);
  assert.equal(ul.iddia[1].bayat, 1); assert.equal(ul.iddia[1].text, once[1].text, 'eski metin kayıtta kalır');
  ul.text = ul.text.replace('Enerji tüketiminin yarısı', 'Enerji tüketiminin üçte ikisi');
  assert.equal(K.iddiaTazele(sl), 1); assert.deepEqual(ul.iddia, once);
  ul.text = ul.text.replace(/Aynı cümle iki kez geçiyor burada \[1\]$/, 'Bambaşka bir cümle');
  K.iddiaTazele(sl); assert.equal(ul.iddia.filter((r) => r.bayat).length, 1, 'eşlerden yalnız biri bayat');
});

/* ------------------------------ B: parça güvenliği ------------------------------ */
const UZUN = 'Giriş paragrafı burada başlıyor ve konuyu tanıtıyor. ' + 'Ara metin dolgu cümlesi olarak tekrar ediyor. '.repeat(12) +
  'Dünya nüfusunun yüzde 56 kadarı bugün kentlerde yaşıyor; bu oranın 2050 yılında yüzde 68 olacağı tahmin ediliyor. ' + 'Son bölüm başka konulara geçiyor ve kapanıyor. '.repeat(10);
const SRCS = [{ id: 1, text: UZUN, snippet: 'Kentleşme raporu, nüfusun kentlere kaymasını bölgelere göre ele alıyor.' }, { id: 2, text: '', snippet: 'Kısa özet: enerji kullanımı ve kentler arasındaki ilişki üzerine bir derleme.' }];

test('B1 aday parça kaynağın BİREBİR alt dizisidir: ≤300, sözcük sınırında, güvensiz karakter yok; konum uydurulmaz (yer null)', () => {
  const sl = [{ bullets: ['Dünya nüfusunun yüzde 56 kadarı kentlerde yaşıyor', 'Alakasız bir madde metni yazıldı'], src: [1], stats: [], chart: null, table: null }];
  const k = F.parcaKur(sl, SRCS), p = k.parca.get(1);
  assert.ok(p.length >= 1); p.forEach((x) => { assert.ok((x.tur === 'snippet' ? SRCS[0].snippet : UZUN).includes(x.metin), 'birebir değil: ' + x.tur); assert.ok(x.metin.length <= 300 && x.metin.length >= 20); assert.equal(x.yer, null); assert.ok(!F.GUVENSIZ.test(x.metin)); assert.ok(!/^\s|\s$/.test(x.metin)); });
  const c0 = k.prov[0][0]; assert.equal(c0.kanit[0].rol, 'aday'); assert.ok(p[c0.kanit[0].p].metin.includes('yüzde 56'));
  const c1 = k.prov[0][1]; assert.ok(c1.kanit.every((x) => x.rol === 'baglam'), 'zayıf eşleşme aday olmamalı');
  const i = UZUN.indexOf(p[c0.kanit[0].p].metin); assert.ok(i === 0 || /\s/.test(UZUN[i - 1]), 'sol sınır sözcük ortası');
});

test('B2 sınırlar: kaynak başına ≤6, deste başına ≤40 parça; tam metin yanıtta yok; ctxFor yedeği kanıt değil; rol yalnız aday/baglam', () => {
  const metin = Array.from({ length: 60 }, (_, i) => `Bölüm ${i + 1}: kentsel ısı ölçümünde istasyon numarası ${1000 + i} kayıtlı değer gösteriyor.`).join(' ');
  const srcs = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, text: metin, snippet: '' }));
  const slides = Array.from({ length: 10 }, (_, s) => ({ bullets: Array.from({ length: 8 }, (_, b) => `İstasyon numarası ${1000 + s * 5 + b} kayıtlı değer`), src: [s + 1], stats: [], chart: null, table: null }));
  const k = F.parcaKur(slides, srcs); let top = 0;
  k.parca.forEach((l) => { assert.ok(l.length <= F.PARCA_KAYNAK); top += l.length; }); assert.ok(top <= F.PARCA_TOPLAM && top > 6, 'toplam ' + top);
  assert.equal(F.PARCA_KAYNAK, 6); assert.equal(F.PARCA_BOY, 300); assert.equal(F.PARCA_TOPLAM, 40);
  k.prov.flat().forEach((c) => c.kanit.forEach((x) => assert.ok(x.rol === 'aday' || x.rol === 'baglam')));
  /* metni olmayan kaynak: yalnız snippet'ten baglam (tur snippet) */
  const k2 = F.parcaKur([{ bullets: ['Enerji kullanımı ve kentler ilişkisi'], src: [2] }], SRCS);
  assert.deepEqual(k2.prov[0][0].kanit.map((x) => x.rol), ['baglam']); assert.equal(k2.parca.get(2)[0].tur, 'snippet');
  const kod = yorumsuz(SRVBLOK);
  assert.ok(!/ctxFor|destek|supported|console\.|fetch\(|await |groq|gemini|setTimeout/i.test(kod), 'parça bloğunda yasak: ' + (kod.match(/ctxFor|destek|supported|console\.|fetch\(|await |groq|gemini|setTimeout/i) || [])[0]);
  const yanit = cut(srv, 'const sources = srcs.filter(', '\n');
  assert.ok(/parca: kp\.parca\.get\(s\.id\) \|\| \[\]/.test(yanit) && !/\btext: s\.text|\bs\.text\b/.test(yanit), 'yanıta tam metin girmemeli');
});

test('B3 güvensiz karakter: pencere daralır, anahtarın içindeyse parça yok; istemci uzun ya da güvensiz parçayı DEĞİŞTİRMEZ, atar', () => {
  const Z = String.fromCharCode(0x202E), N = String.fromCharCode(0);
  const t = 'Başlangıç metni burada uzun uzun anlatıyor' + Z + ' kentlerde yaşayanların oranı yüzde 56 düzeyine ulaştı ve artmaya devam ediyor' + N + ' son.';
  const at = t.indexOf('yüzde 56'), w = F.parcaPencere(t, at, 8), m = t.slice(w.bas, w.son);
  assert.ok(!F.GUVENSIZ.test(m) && m.includes('yüzde 56'));
  assert.equal(F.parcaPencere('abc' + Z + 'def kentlerde yaşayan nüfus', 2, 3), null);
  assert.equal(K.kyParca('a'.repeat(301)), ''); assert.equal(K.kyParca('temiz' + Z + 'metin'), ''); assert.equal(K.kyParca('  '), ''); assert.equal(K.kyParca('Kısa ve temiz bir parça.'), 'Kısa ve temiz bir parça.');
  const r = K.kaynakKur([], [Object.assign({}, WEB, { parca: [{ metin: 'x'.repeat(301) }, { metin: 'yön' + Z + 'li' }, { metin: 'Geçerli parça metni.', tur: 'destek' }] })]);
  assert.deepEqual(r.kaynaklar[0].parca.map((p) => [p.metin, p.tur, p.yer]), [['Geçerli parça metni.', 'pasaj', null]]);
  assert.deepEqual(r.harita['1'].pids.map((x) => x === null), [true, true, false], 'atılan parçanın kanıtı boş kalır');
  /* istemci sınırları */
  const cok = Array.from({ length: 12 }, (_, i) => ({ tmp: i, tur: 'web', url: 'https://k' + i + '.org/', parca: Array.from({ length: 9 }, (_, j) => ({ metin: 'Parça ' + i + '-' + j + ' metni.' })) }));
  const rc = K.kaynakKur([], cok); assert.ok(rc.kaynaklar.every((k) => k.parca.length <= 6)); assert.equal(rc.kaynaklar.reduce((a, k) => a + k.parca.length, 0), 40);
  const G = cut(ink, '  var KY_GUVENSIZ = ', '\n');
  [0, 8, 11, 12, 14, 31, 127, 159, 0x200B, 0x200F, 0x2028, 0x202E, 0x2060, 0x206F, 0xFEFF, 0xFFF9, 0xFFFC].forEach((c) => { assert.ok(K.KY_GUVENSIZ.test(String.fromCharCode(c)), c.toString(16)); assert.ok(F.GUVENSIZ.test(String.fromCharCode(c)), 's ' + c.toString(16)); });
  [9, 10, 13, 32, 0x2010, 0x2030].forEach((c) => { assert.ok(!K.KY_GUVENSIZ.test(String.fromCharCode(c)), c.toString(16)); assert.ok(!F.GUVENSIZ.test(String.fromCharCode(c))); });
  assert.ok(G.length > 0);
});

/* ------------------------------ C: eşleme ------------------------------ */
test('C1 fromResearch: kanıt satıra paralel (boş madde atılınca kayar); grafik maddesinin anlam uyarısı artık DÜŞMEZ; grafik değeri/tablo satırı/istatistik kanıtı', () => {
  const k1 = [{ id: 1, p: 0, rol: 'aday' }], k2 = [{ id: 1, p: 1, rol: 'baglam' }];
  const r = fromResearch({ slides: [
    { title: 'L', kind: 'list', bullets: ['', 'Birinci', 'İkinci'], warn: [], src: [1], prov: [{ t: 'b', i: 1, kanit: k1 }, { t: 'b', i: 2, kanit: k2 }] },
    { title: 'G', kind: 'chart', bullets: ['Kentli nüfus artıyor'], warn: [0], why: { 0: 'kaynakta yok' }, chart: { type: 'bar', labels: ['1950', '2050'], values: [30, 68], unit: '%' }, src: [1], prov: [{ t: 'b', i: 0, kanit: k2 }, { t: 'c', i: 1, kanit: k1 }] },
    { title: 'T', kind: 'table', bullets: ['Tablo notu'], warn: [0], table: { headers: ['a', 'b'], rows: [['x', '1'], ['y', '2']] }, src: [1], prov: [{ t: 'r', i: 1, kanit: k1 }] },
    { title: 'S', kind: 'stat', stats: [{ value: '56%', label: 'kentli' }, { value: '', label: 'boş' }, { value: '2/3', label: 'enerji' }, { value: '3 °C', label: 'ısı' }], src: [1], prov: [{ t: 's', i: 2, kanit: k1 }] },
  ], sources: [], belge: { parca: [{ metin: 'p' }] } });
  const [L, G, T, S] = r.items;
  assert.deepEqual(L.b, ['Birinci', 'İkinci']); assert.deepEqual(L.pv, [k1, k2]);
  assert.deepEqual(G.warnI, [0], 'grafik maddesinin uyarısı korunmalı (eski kayıp)'); assert.deepEqual(G.pv, [k2]); assert.deepEqual(G.pvC, [[], k1]);
  assert.deepEqual(T.warnI, [0]); assert.deepEqual(T.pvR, [[], k1]);
  assert.deepEqual(S.pv, [[], k1, []], 'boş istatistik atılınca kanıt kayar');
  assert.deepEqual(r.belge, { parca: [{ metin: 'p' }] });
  /* cite: grafik/tablo tek maddeye iner; kanıt ve uyarı yalnız o maddeninki */
  const st = [{ t: 'G', k: 'chart', b: ['Bir', 'İki'], src: [1], pv: [k1, k2], warnI: [0, 1] }]; cite(st, [{ id: 1 }]);
  assert.deepEqual(st[0].b, ['Bir [1]']); assert.deepEqual(st[0].pv, [k1]); assert.deepEqual(st[0].warnI, [0]);
});

test('C2 sl.src: geçici numara → kalıcı sid; çözülemeyen bağ SAYILIR, başka kaynak yerine KONMAZ; bilinmeyen kanıt atılır', () => {
  const H = K.kaynakKur([], [WEB, { tmp: 2, n: 2, tur: 'web', url: 'https://iki.org/', parca: [] }]).harita;
  assert.deepEqual(K.kaynakEsle([1, 9, 1, 2], H), { sid: [H['1'].sid, H['2'].sid], eksik: 1 });
  assert.deepEqual(K.kaynakEsle([9], H), { sid: [], eksik: 1 });
  assert.deepEqual(K.kanitCevir([{ id: 1, p: 0, rol: 'aday' }, { id: 1, p: 0, rol: 'aday' }, { id: 1, p: 1, rol: 'destek' }, { id: 9, p: 0, rol: 'aday' }, { id: 1, p: 7, rol: 'aday' }, null], H),
    [{ sid: H['1'].sid, pid: H['1'].pids[0], rol: 'aday' }, { sid: H['1'].sid, pid: H['1'].pids[1], rol: 'baglam' }]);
  const reg = K.kyKayit({ kaynaklar: K.kaynakKur([], [WEB]).kaynaklar });
  assert.equal(K.kyEksik({ src: [H['1'].sid, 'wyok'], srcEksik: 2 }, reg), 3); assert.equal(K.kyEksik({ src: [1, 2] }, reg), 0, 'eski destenin sayısal src\'si eksik sayılmaz');
  /* basım bağlantısı: sid ve iddia map içinde, kayıt destede; kyR vSay diliminin dışında */
  const pd = cut(ink, '    var bosCerceve = 0;', '    if (plotMeta.lang) deck.lang = plotMeta.lang;');
  assert.ok(/var kyR = kaynakKur\(mode === 'append' \? deck\.kaynaklar : \[\], kaynakListe\(plotMeta\)\);/.test(pd));
  assert.ok(ink.indexOf('var kyR = kaynakKur(') < ink.indexOf('var vSay = {}, vSec'), 'eski düzeneklerin kestiği dilime girmemeli');
  assert.ok(/iddiaKur\(sl, s, kyR\.harita\); if \(arr\(s\.src\)\.length\) \{ var km = kaynakEsle\(s\.src, kyR\.harita\); sl\.src = km\.sid; if \(km\.eksik\) sl\.srcEksik = km\.eksik; \}/.test(pd));
  assert.ok(/if \(kyR\.kaynaklar\.length\) deck\.kaynaklar = kyR\.kaynaklar; else if \(mode !== 'append'\) delete deck\.kaynaklar;/.test(pd));
  /* şerit dönüşümleri kanıtı satırla taşır */
  assert.ok(/var pv0 = s\.pv; if \(pv0\) s\.pv = \[\]; s\.b = \(s\.b \|\| \[\]\)\.filter\(function \(x, i\) \{ var ok = x && String\(x\)\.trim\(\); if \(ok && pv0\) s\.pv\.push/.test(ink), 'fillEmpty');
  assert.ok(/s\.b = lines\.slice\(0, s\.k === 'swot' \? 4 : 6\); s\.pv = null;/.test(ink), 'kaynaksız doldurmanın kanıtı yok');
  assert.ok(/pv: arr\(s\.pv\)\.slice\(h\) \}; s\.b = s\.b\.slice\(0, h\); s\.pv = arr\(s\.pv\)\.slice\(0, h\);/.test(ink), 'flowFix bölmesi');
});

test('C3 iddiaKur: madde, istatistik (değer+etiket eşi), grafik değeri ve tablo satırı kayıtları; başlık iddia değildir', () => {
  const H = K.kaynakKur([], [WEB]).harita, k1 = [{ id: 1, p: 0, rol: 'aday' }];
  const hv = el('h', { text: '56%' }), tl = el('t', { text: 'kentli nüfus' });
  const st = asetat('stat', 'Rakamlar', [hv, tl]);
  K.iddiaKur(st, { t: 'Rakamlar', k: 'stat', b: ['56% — kentli nüfus [1]'], pv: [k1] }, H);
  const rs = iddialar(st); assert.equal(rs.length, 1); assert.equal(rs[0].el, tl.id); assert.equal(rs[0].es, hv.id); assert.equal(rs[0].tur, 'istatistik');
  assert.equal(K.iddiaTazele(st), 0); hv.text = '58%'; assert.equal(K.iddiaTazele(st), 1, 'değer değişince bayat');
  const ch = el('chart', { chart: { type: 'bar', labels: ['1950', '2050'], data: [30, 68] } }), tb = el('table', { table: { headers: ['a', 'b'], rows: [['x', '1'], ['y', '2']] } });
  const g = asetat('chart', 'Grafik', [ch, tb]); K.iddiaKur(g, { t: 'Grafik', k: 'chart', b: [], pvC: [[], k1], pvR: [k1] }, H);
  assert.deepEqual(iddialar(g).map((r) => [r.tur, r.text, r.kanit.length]), [['grafik', '1950: 30', 0], ['grafik', '2050: 68', 1], ['tablo', 'x · 1', 1], ['tablo', 'y · 2', 0]]);
  ch.chart.data[1] = 70; tb.table.rows[0][1] = '9'; assert.equal(K.iddiaTazele(g), 2);
  const t = asetat('list', 'Başlık metni burada', [el('t', { text: 'Başlık metni burada' })]);
  assert.equal(K.iddiaKur(t, { t: 'Başlık metni burada', k: 'list', b: ['Başlık metni burada'] }, H), 0, 'başlıkla aynı yazı iddia değil');
});

/* ------------------------------ D: doğrulama sınırı ------------------------------ */
test('D1 durum hep "unverified": eski ok ≠ supported, eski uyarı ≠ contradicted; warn/why okunmaz, değişmez; "destek" rolü yok', () => {
  const H = K.kaynakKur([], [WEB]).harita, sl = listeAsetat(); sl.els[1].warn = ['Aynı cümle iki kez geçiyor burada']; const w0 = kopya(sl.els[1].warn);
  K.iddiaKur(sl, Object.assign({}, listeSerit, { warnI: [0], why: { 0: 'kaynakta yok' }, fixed: [1] }), H);
  iddialar(sl).forEach((r) => { assert.equal(r.durum, 'unverified'); assert.deepEqual(Object.keys(r).filter((k) => !['el'].includes(k)).sort(), ['cid', 'durum', 'h', 'kanit', 'text', 'tur']); });
  assert.deepEqual(sl.els[1].warn, w0);
  const kod = yorumsuz(KBLOK);
  assert.ok(!/supported|contradicted|not_applicable|'destek'|"destek"|\.warn\b|\.why\b|warnI/.test(kod), 'istemci kayıt bloğu doğrulama durumu üretmemeli: ' + (kod.match(/supported|contradicted|not_applicable|'destek'|"destek"|\.warn\b|\.why\b|warnI/) || [])[0]);
  assert.ok(!/fetch\(|invoke|XMLHttpRequest|localStorage|sessionStorage|console\.|setTimeout|Math\.random|Date\.now/.test(kod), 'kayıt bloğu ağ/depo/log/rastgelelik kullanmamalı');
});

test('D2 yapısal asetat (kapak, kapanış, kaynakça, gündem) iddia taşımaz; not_applicable hiç üretilmez', () => {
  const H = K.kaynakKur([], [WEB]).harita;
  [asetat('cover', 'Kapak', [el('t', { text: 'Alt başlık uzun bir cümle' })]), asetat('end', 'Teşekkürler', []), asetat('refs', 'Kaynakça', [el('ul', { text: '[1] Örnek (2024).' })]),
    asetat('list', 'Gündem', [el('ul', { text: 'Giriş bölümü\nSonuç bölümü' })]), asetat('list', 'Liste', [el('ul', { text: 'Bir\nİki' })], { v: 10 })].forEach((sl) => {
    assert.ok(K.kyYapi(sl), sl.lay); assert.equal(K.iddiaKur(sl, { t: titleOf(sl), k: 'list', b: ['Giriş bölümü', 'Sonuç bölümü', '[1] Örnek (2024).'] }, H), 0);
    assert.deepEqual(K.kyGoster(sl), { kayitli: false, l: [] });
  });
  const i50 = ink.indexOf('  /* ---------- #50 (Phase 8.2)'), j50 = ink.indexOf('  /* ---------- #50 son ---------- */');      /* #50: not_applicable yalnız kontrol kaydında (e.iddia[].kontrol), iddia durumunda değil */
  assert.ok(i50 > 0 && j50 > i50 && !/not_applicable/.test(ink.slice(0, i50) + ink.slice(j50)), 'istemci not_applicable üretmemeli (#50 bloğu dışında)');
});

test('D3 sunucu: parçalar anlam denetiminden SONRA, son içerikten; denetimin warn/why sonucu aynen kalır; yanıt sözleşmesi genişler, daralmaz', () => {
  const i = srv.indexOf('const kp = parcaKur(slides, srcs);'), cw = srv.indexOf('_cw');
  assert.ok(i > 0 && cw > 0 && i > srv.lastIndexOf('meaningCheck(', i), 'parça anlam denetiminden sonra kurulmalı');
  assert.ok(!/\.warn\b|\.why\b|\.fixed\b/.test(yorumsuz(SRVBLOK)), 'parça bloğu denetim sonucunu okumamalı');
  const slides = [{ bullets: ['Dünya nüfusunun yüzde 56 kadarı kentlerde yaşıyor'], warn: [0], why: { 0: 'x' }, fixed: [], src: [1], stats: [], chart: null, table: null }], once = kopya(slides);
  F.parcaKur(slides, SRCS); assert.deepEqual(slides, once, 'parcaKur asetatı değiştirmemeli');
  assert.ok(/sources: docText \? \[\] : sources, belge: docText \? \{ parca: kp\.parca\.get\(1\) \|\| \[\] \} : undefined, check:/.test(srv));
  assert.equal(srv.split('parcaKur(').length - 1, 1, 'tek çağrı'); assert.equal(srv.split('const parcaKur = ').length - 1, 1);
});

/* ------------------------------ F: belge / kart ------------------------------ */
test('F1 belge ve kart: gerçek kimlik (ref), adres UYDURULMAZ; kimliksiz kayıt atlanır; kart parçası arka yüzün birebir başı', () => {
  const pm = { source: 'study_card', sourceId: 'c0ffee00-0000-4000-8000-000000000001', belgeAd: 'Ekonomi 101.pdf', via: 'docstory', belge: { parca: [{ metin: 'Enflasyon fiyatlar genel düzeyinin sürekli artışıdır.', tur: 'pasaj' }] } };
  const L = K.kaynakListe(pm); assert.deepEqual(L.map((x) => [x.tmp, x.tur, x.ref]), [[1, 'belge', pm.sourceId]]);
  const r = K.kaynakKur([], L), b = r.kaynaklar[0];
  assert.equal(b.tur, 'belge'); assert.equal(b.url, ''); assert.equal(b.ref, pm.sourceId); assert.equal(b.baslik, 'Ekonomi 101.pdf'); assert.ok(/^b/.test(b.sid)); assert.equal(b.parca.length, 1); assert.equal(r.harita['1'].sid, b.sid);
  assert.deepEqual(K.kaynakListe(Object.assign({}, pm, { via: 'direct' })).map((x) => [x.tmp, x.parca.length]), [['belge', 0]], 'iskelet dışı belge yolunda parça yok');
  assert.equal(K.kaynakKur([], [{ tmp: 'x', tur: 'belge', ref: '', url: 'https://uydurma.org/' }]).kaynaklar.length, 0, 'kimliksiz belge kaydedilmez');
  assert.equal(K.kaynakKur([], [{ tmp: 'x', tur: 'kart', ref: 'k1', url: 'https://uydurma.org/' }]).kaynaklar[0].url, '', 'kart/belgeye adres yazılmaz');
  const back = 'Arz ve talep dengesi piyasada fiyatı belirler; ' + 'ayrıntılı açıklama devam ediyor '.repeat(15);
  const kk = K.kartKaynak([{ front: 'Arz-talep', back, from: 'Kart · Ekonomi', ref: 'card-1' }, { front: 'Esneklik', back: 'Fiyat değişimine tepki.', from: 'Kart · Ekonomi', ref: 'card-1' }, { front: 'Yerel', back: 'Kimliksiz kart.', from: 'x', ref: null }]);
  assert.equal(kk.kaynak.length, 1); assert.equal(kk.kaynak[0].parca.length, 2);
  const p0 = kk.kaynak[0].parca[0].metin; assert.ok(back.startsWith(p0) && p0.length <= 300 && !/\s$/.test(p0));
  assert.deepEqual(kk.st[0].pv, [[{ id: 'k:card-1', p: 0, rol: 'aday' }]]); assert.deepEqual(kk.st[1].pv, [[{ id: 'k:card-1', p: 1, rol: 'aday' }]]); assert.equal(kk.st[2].src, undefined);
  const rk = K.kaynakKur([], K.kaynakListe({ kartlar: kk.kaynak })); assert.equal(rk.kaynaklar[0].tur, 'kart'); assert.ok(/^k/.test(rk.kaynaklar[0].sid));
  assert.ok(/ref: isUuid\(c\.id\) \? c\.id : null/.test(ink), 'kart kimliği gerçek kayıttan');
  assert.ok(/plotMeta = o\.pm = \{ [^}]*source: 'study_card', sourceId: c\.id, belgeAd: docLabel\(c\) \};/.test(ink) && /plotMeta\.check = r\.check; plotMeta\.belge = r\.belge;/.test(ink));
});

/* ------------------------------ E + G: tarayıcı ------------------------------ */
test('G0 paylaşım ve PPTX: iddia/kaynak kaydı görüntüye, PPTX\'e ve notlara girmez (statik)', () => {
  ['elHTML', 'snapKur'].forEach((ad) => assert.ok(!/iddia|kaynaklar|parca/.test(cut(ink, '  var ' + ad + ' = function', '\n  };\n').replace(/\/\*[\s\S]*?\*\//g, '')), ad));
  const px = cut(ink, '  var exportPptx = async function', '\n  };\n'); assert.ok(!/iddia|kaynaklar|parca|\.src\b(?!\s*=)/.test(px.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\b(img|im|e|o|x|el)\.src\b/g, '')), 'PPTX iddia/kaynak okumamalı');
  assert.ok(!/addHyperlink|hyperlink/i.test(px), 'bağlantı 8.3');
});

const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');
if (!CHROME) {
  console.log('  ATLANDI  E1–E3, G1–G3 (başsız Chrome): Chrome bulunamadı — CHROME_BIN ile yol verin. Bu testler GEÇTİ sayılmadı.');
  summary();
} else (async () => {
  const { sayfa, kos, temizle } = duzenek();
  const H = yeniSunucu(); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r)); const port = H.srv.address().port;
  const XSS = '<img src=x onerror="window.__xss=1">Kentlerin sıcaklığı 3 °C yükseliyor';
  const PASAJ = 'Dünya nüfusunun yüzde 56 kadarı bugün kentlerde yaşıyor ve oran artıyor.';
  const CITED = [
    { id: 1, title: 'Dünya Kentleşme Raporu', url: 'https://ornek.org/rapor?id=7&utm_source=x', site: 'ornek.org', apa: 'Örnek (2024). Dünya Kentleşme Raporu.', erisim: '2026-11-27', ctx: 'GIZLI-CTX-METNI', parca: [{ metin: PASAJ, yer: null, tur: 'pasaj' }, { metin: 'Rapor kentleşmenin hızını bölgelere göre karşılaştırıyor.', yer: null, tur: 'snippet' }] },
    { id: 2, title: 'Zararlı <b>başlık</b>', url: 'javascript:alert(1)', site: 'kotu.site', apa: 'Kötü (2024).', parca: [{ metin: XSS, yer: null, tur: 'pasaj' }] },
  ];
  const k1 = [{ id: 1, p: 0, rol: 'aday' }], k2 = [{ id: 1, p: 1, rol: 'baglam' }], kx = [{ id: 2, p: 0, rol: 'aday' }];
  const STRIPS = [{ k: 'cover', t: 'Kentleşme', b: [] },
    { k: 'list', t: 'Şehirler neden kilit?', b: ['Dünya nüfusunun yüzde 56 kadarı kentlerde [1]', 'Aynı cümle iki kez geçiyor burada [1]', 'Aynı cümle iki kez geçiyor burada [1]'], src: [1], pv: [k1, k2, []], warnI: [1], why: { 1: 'kaynakta yok' } },
    { k: 'list', t: 'Isı adası', b: ['Kentlerin sıcaklığı 3 °C yükseliyor [2]', 'Gölge ve su birlikte planlanmalı [2]'], src: [2], pv: [kx, []] },
    { k: 'list', t: 'Çözülemeyen bağ', b: ['Bu asetatın kaynağı kaynakçada yok', 'İkinci madde de burada duruyor'], src: [9], pv: [[], []] },
    { k: 'refs', t: 'Kaynakça', b: ['[1] Örnek (2024). Dünya Kentleşme Raporu.', '[2] Kötü (2024).'] },
    { k: 'end', t: 'Teşekkürler', b: [] }];
  const PM = { title: 'Kaynak kaydı', sub: 't', lang: 'tr', source: 'topic', sourceId: null, yol: { k: 'research', yedek: 0 }, sources: CITED, cited: CITED, istek: 6 };
  const KANCA = `  window.__KY = { tikla: function (s) { var b = document.querySelector(s); if (b) b.click(); return !!b; } };\n`;
  const ORTAK = `
    window.__inv = []; window.__hata = []; window.__xhr = 0; var X0 = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function () { window.__xhr++; return X0.apply(this, arguments); };
    window.supabaseClient.functions.invoke = function (n, o) { window.__inv.push(n + ':' + ((o && o.body && o.body.action) || '')); return Promise.resolve({ data: {} }); };
    var ce = console.error; console.error = function () { window.__hata.push(Array.prototype.slice.call(arguments).map(String).join(' ').slice(0, 200)); return ce.apply(console, arguments); };
    window.addEventListener('error', function (e) { window.__hata.push('onerror ' + (e.message || '')); });
    var dlg = function () { var k = d.querySelector('[data-ky]'); return k && k.closest('dialog'); };
    var bolum = function () { var k = d.querySelector('[data-ky]'); if (!k) return null; return { i: +k.getAttribute('data-ky'), html: k.innerHTML, metin: k.textContent, cid: Array.prototype.map.call(k.querySelectorAll('[data-ky-cid]'), function (x) { return x.getAttribute('data-ky-cid'); }),
      rol: Array.prototype.map.call(k.querySelectorAll('blockquote[data-ky-rol]'), function (x) { return x.getAttribute('data-ky-rol') + ':' + x.querySelector('b').textContent; }),
      a: Array.prototype.map.call(k.querySelectorAll('a'), function (x) { return [x.getAttribute('href'), x.target, x.rel]; }), img: k.querySelectorAll('img,script').length, eski: !!k.querySelector('[data-ky-eski]'), eksik: !!k.querySelector('[data-ky-eksik]') }; };
    var gez = async function (n) { var out = []; for (var i = 0; i < n; i++) { out.push(bolum()); if (!window.__KY.tikla('[data-ky-yon="1"]:not([disabled])')) break; await bekle(120); } return out; };
    var ag = function () { return { inv: window.__inv.length, xhr: window.__xhr, fetch: window.__ag.length }; };
  `;
  const KANCALI = (govde) => { const h = sayfa('ok', port, 0, ORTAK + govde); assert.equal(h.split('  window.__S = { set:').length, 2); return h.replace('  window.__S = { set:', () => KANCA + '  window.__S = { set:'); };
  const A = `
    await sakin(); d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA); S.set(${JSON.stringify(STRIPS)}, ${JSON.stringify(PM)}); S.bas('new'); await sakin(); await bekle(3000); await dur(2500);
    var D = S.deck(); R.kaynaklar = D.kaynaklar; R.src = D.slides.map(function (s) { return [s.src || null, s.srcEksik || 0]; });
    R.iddia = D.slides.map(function (s) { return s.els.reduce(function (a, e) { return a.concat((e.iddia || []).map(function (r) { return { cid: r.cid, text: r.text, tur: r.tur, durum: r.durum, kanit: r.kanit, uyari: !!(e.warn && e.warn.length) }; })); }, []); });
    d.querySelector('[data-sh-on]').click(); await bekle(2500); await dur(1500);
    var a0 = ag(); d.querySelector('[data-audit]').click(); await bekle(600); var a1 = ag();
    window.__KY.tikla('[data-ky-yon="-1"]:not([disabled])'); await bekle(100); for (var k = 0; k < 8 && window.__KY.tikla('[data-ky-yon="-1"]:not([disabled])'); k++) await bekle(100);
    R.panel = await gez(D.slides.length); var a2 = ag(); R.agS = { ac: [a0, a1], gez: [a1, a2] }; R.inv = window.__inv.slice();
    R.qa = window.__xss || 0; R.dlgMetin = (dlg() || {}).textContent || ''; dlg().close();
    R.yerel = localStorage.getItem(S.store.k('d.' + D.id)) || ''; R.hata = window.__hata;
  `;
  const B = `
    await dur(4000); var D = S.deck(); R.kaynaklar = D.kaynaklar || null; R.src = D.slides.map(function (s) { return [s.src || null, s.srcEksik || 0]; });
    R.iddia = D.slides.map(function (s) { return s.els.reduce(function (a, e) { return a.concat((e.iddia || []).map(function (r) { return { cid: r.cid, text: r.text, tur: r.tur, durum: r.durum, kanit: r.kanit, uyari: !!(e.warn && e.warn.length) }; })); }, []); });
    var a0 = ag(); d.querySelector('[data-audit]').click(); await bekle(600); for (var k = 0; k < 8 && window.__KY.tikla('[data-ky-yon="-1"]:not([disabled])'); k++) await bekle(100);
    R.panel = await gez(D.slides.length); R.agS = [a0, ag()];
    R.qaKod = window.__inv.length; R.dlgMetin = (dlg() || {}).textContent || ''; dlg().close();
    /* düzenleme: iddiası olan maddeyi değiştir, kaydet → bayat kayıt kalır ve hesaba gider */
    var s1 = D.slides[1], ul = s1.els.filter(function (e) { return e.type === 'ul' && e.iddia && e.iddia.length; })[0] || s1.els.filter(function (e) { return e.iddia && e.iddia.length; })[0];
    R.duzenOnce = ul ? ul.iddia.length : -1; if (ul) { ul.text = ul.text.replace('yüzde 56', 'yüzde 57'); S.dirty(); } await bekle(4500); await dur(1500);
    R.duzen = ul ? ul.iddia.map(function (r) { return [r.cid, r.bayat || 0]; }) : null; R.hata = window.__hata;
  `;
  const EN = `
    localStorage.setItem('acadexUILang', 'en'); window.AX_EN = { t: { 'Kaynak': 'Source', 'Asetat': 'Slide' } };
    await dur(3000); d.querySelector('[data-audit]').click(); await bekle(600); for (var k = 0; k < 8 && window.__KY.tikla('[data-ky-yon="-1"]:not([disabled])'); k++) await bekle(100); window.__KY.tikla('[data-ky-yon="1"]'); await bekle(150);
    var Aen = window.AX_EN.t, eksik = [], yaz = [], g = d.querySelector('[data-ky]');
    var cevir = function (t) { if (Aen[t] != null) return true; var r = t.replace(/[0-9]+/g, '{#}'); if (Aen[r] != null) return true; return false; };
    var tw = d.createTreeWalker(g, NodeFilter.SHOW_TEXT), n; while ((n = tw.nextNode())) { var t = n.nodeValue.replace(/\\s+/g, ' ').trim(); if (!t || /^[0-9 .·/\\[\\]—]*$/.test(t) || n.parentNode.closest('[data-no-i18n]')) continue; yaz.push(t); if (!cevir(t)) eksik.push(t); }
    Array.prototype.forEach.call(g.querySelectorAll('[aria-label]'), function (b) { if (!cevir(b.getAttribute('aria-label'))) eksik.push(b.getAttribute('aria-label')); });
    R.eksik = eksik; R.yaz = yaz; R.en = ['Kaynaklar ve iddialar', 'İddialar', 'Bağlam', 'Doğrulanmadı', 'metin değişti', 'Kanıt kontrolü'].map(function (k) { return Aen[k]; }); R.hata = window.__hata;
  `;
  let RA, RB, RL, RE, snap, SATIR;
  const satir = () => H.DB.presentation_slides.filter((r) => r.presentation_id === H.P().id).sort((a, b) => a.order_index - b.order_index);
  try {
    RA = await kos('ka.html', 'A', KANCALI(A));
    snap = JSON.stringify(H.P().share_snapshot || null);
    RB = await kos('kb.html', 'B', KANCALI(B));
    RE = await kos('ke.html', 'E', KANCALI(EN)); SATIR = kopya(satir());
    /* eski deste: hesaptaki satırlardan 8.1 alanları silinir (8.1 öncesi kaydın biçimi), sayısal src bırakılır */
    H.DB.presentation_slides.forEach((r) => { delete r.content.kaynaklar; delete r.content.srcEksik; if (r.content.src) r.content.src = [1, 2]; (r.content.els || []).forEach((e) => { delete e.iddia; }); });
    H.dokun();
    RL = await kos('kl.html', 'L', KANCALI(`
      await dur(4000); var D = S.deck(); R.kaynaklar = D.kaynaklar || null; R.iddiaSay = D.slides.reduce(function (a, s) { return a + s.els.filter(function (e) { return e.iddia; }).length; }, 0);
      d.querySelector('[data-audit]').click(); await bekle(600); for (var k = 0; k < 8 && window.__KY.tikla('[data-ky-yon="-1"]:not([disabled])'); k++) await bekle(100);
      R.panel = await gez(D.slides.length); R.dlgMetin = (dlg() || {}).textContent || ''; dlg().close();
      S.dirty(); await bekle(4000); await dur(1500); R.sonra = D.slides.reduce(function (a, s) { return a + s.els.filter(function (e) { return e.iddia; }).length; }, 0); R.sonraKayit = D.kaynaklar || null; R.hata = window.__hata;
    `));
  } catch (e) { test('E0 tarayıcı koşusu', () => { throw e; }); H.srv.close(); temizle(); summary(); return; }

  test('E1 basım + kayıt: deste kaydı, asetat sid\'leri, iddialar; hesapta content.src, rows[0].content.kaynaklar, els[].iddia; tam metin/ctx kaydedilmez', () => {
    assert.ok(!RA.hata.length, RA.hata.join(' | '));
    const kay = RA.kaynaklar; assert.equal(kay.length, 2); assert.deepEqual(kay.map((k) => k.n), [1, 2]);
    assert.equal(kay[0].url, 'https://ornek.org/rapor?id=7&utm_source=x', 'özgün adres saklanır (sid kanonikten)'); assert.equal(kay[1].url, '', 'http(s) dışı adres saklanmaz');
    assert.equal(kay[0].parca[0].metin, PASAJ); assert.ok(!JSON.stringify(kay).includes('GIZLI-CTX-METNI'), 'ctx kayda girmemeli');
    const s = RA.src; assert.deepEqual(s[1], [[kay[0].sid], 0]); assert.deepEqual(s[2], [[kay[1].sid], 0]); assert.deepEqual(s[3], [[], 1], 'çözülemeyen bağ sayılır, yerine kaynak konmaz'); assert.deepEqual(s[0], [null, 0]);
    const i1 = RA.iddia[1]; assert.equal(i1.length, 3); assert.equal(new Set(i1.map((r) => r.cid)).size, 3); assert.ok(i1.every((r) => r.durum === 'unverified'));
    assert.deepEqual(i1[0].kanit, [{ sid: kay[0].sid, pid: kay[0].parca[0].pid, rol: 'aday' }]); assert.deepEqual(i1[1].kanit.map((k) => k.rol), ['baglam']);
    assert.equal(RA.iddia[0].length + RA.iddia[4].length + RA.iddia[5].length, 0, 'kapak/kaynakça/kapanış iddiasız');
    const rows = SATIR; assert.ok(rows.length >= 6);
    assert.deepEqual(rows[0].content.kaynaklar.map((k) => k.sid), kay.map((k) => k.sid)); assert.ok(rows.slice(1).every((r) => !r.content.kaynaklar), 'kayıt yalnız ilk satırda');
    assert.deepEqual(rows[1].content.src, [kay[0].sid]); assert.deepEqual([rows[3].content.src, rows[3].content.srcEksik], [[], 1]);
    assert.ok(rows[1].content.els.some((e) => e.iddia && e.iddia.length === 3));
    assert.ok(!JSON.stringify(SATIR).includes('GIZLI-CTX-METNI'), 'ctx asetat satırına girmemeli');
    assert.ok(RA.yerel.includes('"kaynaklar"') && RA.yerel.includes('"iddia"'), 'yerel kopya kaydı taşır');
  });

  test('E2 çapraz cihaz: temiz profil aynı kaydı, sid\'leri ve iddiaları (cid dahil) görür; düzenleme bayat yazar, kaydı silmez', () => {
    assert.ok(!RB.hata.length, RB.hata.join(' | '));
    assert.deepEqual(RB.kaynaklar, RA.kaynaklar); assert.deepEqual(RB.src, RA.src); assert.deepEqual(RB.iddia, RA.iddia);
    assert.deepEqual(RB.panel.map((p) => p && p.cid), RA.panel.map((p) => p && p.cid));
    assert.equal(RB.duzenOnce, 3); assert.equal(RB.duzen.length, 3); assert.deepEqual(RB.duzen.map((x) => x[1]), [1, 0, 0]); assert.deepEqual(RB.duzen.map((x) => x[0]), RA.iddia[1].map((r) => r.cid));
    const ul = SATIR[1].content.els.filter((e) => e.iddia && e.iddia.length)[0]; assert.equal(ul.iddia[0].bayat, 1, 'bayatlık hesaba gider'); assert.equal(ul.iddia.length, 3);
  });

  test('E3 eski deste: kayıt yok, geri doldurma yok; pencere satırları "Doğrulanmadı" ile yalnız gösterilir; sayısal src çözülemedi sayılmaz; kaydetmek iddia yazmaz', () => {
    assert.ok(!RL.hata.length, RL.hata.join(' | '));
    assert.equal(RL.kaynaklar, null); assert.equal(RL.iddiaSay, 0); assert.equal(RL.sonra, 0, 'eski destede iddia kaydedilmemeli'); assert.equal(RL.sonraKayit, null);
    const p1 = RL.panel[1]; assert.ok(p1.eski, 'eski deste satırları işaretli'); assert.ok(/Doğrulanmadı/.test(p1.metin)); assert.deepEqual(p1.rol, []); assert.equal(p1.eksik, false);
    assert.ok(RL.panel.every((p) => !p || !p.eksik));
    assert.ok(satir().every((r) => !r.content.kaynaklar && (r.content.els || []).every((e) => !e.iddia)));
  });

  test('G1 pencere: tek pencere içinde bölüm; Kaynak/Bağlam/Doğrulanmadı; kontrolsüz satırda "destekleniyor" yok (#50 açıklaması hariç); bağlantı yalnız http(s) ve noopener; kaynak içeriği kaçar; çözülemedi bildirimi', () => {
    const P = RA.panel; assert.equal(P.length, 6); assert.deepEqual(P.map((p) => p.i), [0, 1, 2, 3, 4, 5]);
    assert.ok(/Yapısal asetat; iddia yok\./.test(P[0].metin) && /Yapısal asetat/.test(P[4].metin));
    assert.equal(P[1].cid.length, 3); assert.deepEqual(P[1].rol, ['aday:Kaynak', 'baglam:Bağlam']); assert.equal((P[1].html.match(/data-kk-st="unverified">Doğrulanmadı</g) || []).length, 3);
    assert.deepEqual(P[1].a, [['https://ornek.org/rapor?id=7&utm_source=x', '_blank', 'noopener noreferrer']]);
    assert.deepEqual(P[2].a, [], 'javascript: bağlantı olmamalı'); assert.equal(P[2].img, 0, 'kaynak içeriği öğe üretmemeli'); assert.ok(P[2].metin.includes('<img src=x onerror="window.__xss=1">'), 'metin olarak görünmeli'); assert.ok(RA.kaynaklar[1].baslik.startsWith('Zararlı <b') && P[2].metin.includes(RA.kaynaklar[1].baslik) && !/<b>başlık/.test(P[2].html), 'başlık metin olarak, kaçmış');
    assert.equal(RA.qa, 0, 'betik çalışmamalı');
    assert.ok(P[3].eksik && /Bazı kaynak bağları çözülemedi\./.test(P[3].metin));
    /* #50: Phase 8.2 kontrol paneli; destek sözcükleri yalnız açıklamada, kontrol edilmemiş satırda yok */
    assert.ok(P.every((p) => /Kanıt kontrolü/.test(p.metin) && /data-kk-run/.test(p.html)));
    const ACK = ['Desteklenmiyor: seçilen kaynak parçalarında bu iddia yok. Çelişki bulundu: parça aynı konu, dönem ve birim için başka bir değer söylüyor.', 'Doğrulanmadı ya da Kontrol yapılamadı, iddianın yanlış olduğu anlamına gelmez. Sunum içeriği otomatik değiştirilmez.'];
    assert.ok(!/destekleniyor|desteklen|supported|doğrulandı/i.test(ACK.reduce((t, a) => t.split(a).join(''), RA.dlgMetin)), 'destek dili yok');
    assert.ok(/asetatın bir kaynak bağı kaynak kaydında bulunamadı/.test(RA.dlgMetin), 'SOURCE_UNRESOLVED bilgi bulgusu listede');
    assert.equal(RA.iddia[1][1].uyari, true, 'eski anlam uyarısı (warn) yerinde kalır');
  });

  test('G2 ağ: pencereyi açmak ve bölümde gezinmek SIFIR istek (invoke, fetch, XHR); paylaşım görüntüsünde parça/iddia/kayıt yok', () => {
    const [a0, a1] = RA.agS.ac, [b0, b1] = RA.agS.gez;
    assert.deepEqual(b1, b0, 'gezinme isteği: ' + JSON.stringify([b0, b1]));
    assert.deepEqual(a1, a0, 'açılış isteği: ' + JSON.stringify([a0, a1]) + ' ' + RA.inv.join());
    assert.deepEqual(RB.agS[1], RB.agS[0]);
    assert.ok(snap && snap.length > 500, 'görüntü yazılmadı'); ['iddia', 'kaynaklar', 'parca', 'bugün kentlerde yaşıyor ve oran', 'bölgelere göre karşılaştırıyor', 'kanit', 'GIZLI-CTX'].forEach((k) => assert.ok(!snap.includes(k), 'görüntüde ' + k));
  });

  test('G3 EN: bölümdeki her arayüz yazısının karşılığı var; kaynak/iddia içeriği çeviriye girmez (data-no-i18n)', () => {
    assert.ok(!RE.hata.length, RE.hata.join(' | '));
    assert.deepEqual(RE.eksik, [], 'çevirisi olmayan: ' + RE.eksik.join(' | ')); assert.ok(RE.yaz.length >= 5);
    assert.deepEqual(RE.en, ['Sources and claims', 'Claims', 'Context', 'Not verified', 'text changed', 'Evidence check']);
    assert.ok(/data-no-i18n/.test(cut(ink, '  var kaynakBolum = function', '\n  };\n')));
  });

  H.srv.close(); temizle(); summary();
})();
