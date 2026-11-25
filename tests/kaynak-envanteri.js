/* ==========================================================================
   ACADEX — KAYNAK ENVANTERİ VE KAPSAMA KARNESİ (tests/kaynak-envanteri.js), 25.11.2026
   NEDEN VAR: Yapay zekâ özetinin en sık hatası atlamak (ARC, EVA-Score, BooookScore).
   "Önce çıkar, sonra özetle": kaynak metinden kodla (modelsiz) tanım, formül, numaralı
   liste, hocanın vurgusu (KEY/MAIN IDEA, Remember), öğrenme çıktısı, belgenin kendi
   soruları ve sayısal örnekler çıkarılır; özet penceresine "SOURCE INVENTORY" olarak
   verilir, kart bununla ölçülür (quality_meta.kaynak_kapsama), ekranda kapsama karnesi
   ve "eksikleri ekle" (ozet-slayt islem:'tamamla') çıkar; slaytlarda vurgu / ezber kartı /
   formül slaytları gelir.
   Gerçek belgelerle ayarlandı: ITB 311 L2 (3 tanım, 3 formül, 4 liste, 13 vurgu, 7 soru,
   3 örnek), Marketing ch1 (14 tanım, 5 liste, 12 çıktı), Accounting ch6, Integrals (OCR'lı
   formüller ELENDİ), Conformity (psikoloji anlatısı: neredeyse boş).
   Çalıştırma:  node tests/kaynak-envanteri.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeRunner, loadFromSource } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const { test, summary } = makeRunner();
const SLAYT = 'supabase/functions/ozet-slayt/index.ts';
const E = loadFromSource(SLAYT, ['ORNEK_ACIK_RE', 'ORNEK_KURULUM_RE', 'ORNEK_ZAYIF_KURULUM_RE', 'ORNEK_SORU_RE', 'ORNEK_YONETIM_RE', 'ORNEK_TABLO_SATIRI_RE', 'ornekSayilari', 'ornekBolumle', 'ornekBul', 'ornekKapsama',
  'ENV_VURGU_RE', 'ENV_CIKTI_RE', 'ENV_SORU_BASLIK_RE', 'ENV_LISTE_BASLIK_RE', 'ENV_MADDE_RE', 'ENV_TANIM_KALIP_RE', 'ENV_TANIM_IS_RE', 'ENV_TANIM_TR_RE', 'ENV_KOLON_RE', 'ENV_KOLON_YASAK_RE',
  'envNorm', 'envFormulNorm', 'kaynakEnvanteri', 'KOLON_DEGIL', 'kaynakKapsama', 'kaynakDili', 'envanterTalimati']);
const S = loadFromSource(SLAYT, ['str', 'dizi', 'yildizSay', 'TURLER', 'RENKLER', 'TUR_RENK', 'desteNormalize', 'sistemTalimati', 'ornekCiktisiTemizle', 'tamamlaTemizle', 'birlesik', 'TAMAMLA_TALIMATI']);
const fn = read(SLAYT), oz = read('supabase/functions/summarize-document/index.ts'), ink = read('js/acadex-ink.js'), css = read('css/acadex-ink.css'), js = read('js/ozet-slayt.js');

/* kendi yazdığımız, gerçek slayt biçimini taklit eden ders metni */
const DERS = `--- PAGE 1 ---
Learning Objectives
1. Why do nations trade?
2. What limits the gains from trade?
--- PAGE 2 ---
THE OLD VIEW
Two beliefs were central to the old view:
1. Wealth = Gold
2. Trade is a fixed pie
KEY IDEA:
One nation gains → another nation loses
--- PAGE 3 ---
PRICE ADJUSTMENT
The quantity equation links money and prices: M × V = P × Y
M = money, V = velocity, P = prices, Y = output
Remember: More money does not mean more real wealth.
Q/L = Output per Unit of Labor
--- PAGE 4 ---
FREE TRADE
LAISSEZ-FAIRE: The state should let firms make their own economic decisions within the law.
A tariff is a tax that a government places on imported goods to protect home producers.
OPEN MARKETS
Open markets are markets where buyers can choose freely among domestic and foreign sellers.
--- PAGE 5 ---
Four Types of Trade Barriers
• Tariffs
• Quotas
• Subsidies
• Embargoes
Can a country keep a surplus forever?
--- PAGE 6 ---
Grading
• Mid-term 40%
• Final 60%
--- PAGE 7 ---
Week 9 integrals (scanned)
/ 2a dx = x3 + C
/ cosædx = sinx + C`;

test('envanter: her kategori bulunur, gürültü ve OCR bozuntusu girmez', () => {
  const e = E.kaynakEnvanteri(DERS);
  assert.deepEqual(Array.from(e.ciktilar), ['Why do nations trade?', 'What limits the gains from trade?']);
  assert.ok(e.vurgular.some((v) => /One nation gains → another nation loses/.test(v.metin)), 'boş KEY IDEA: sonraki satır alınır');
  assert.ok(e.vurgular.some((v) => /More money does not mean more real wealth/.test(v.metin)));
  assert.deepEqual(Array.from(e.formuller, (f) => f.ifade), ['M × V = P × Y', 'Q/L = Output per Unit of Labor'], 'Wealth = Gold formül değil; değişken açıklaması formül değil; OCR elenir');
  const t = Array.from(e.tanimlar, (x) => x.terim);
  assert.ok(t.includes('LAISSEZ-FAIRE')); assert.ok(t.includes('tariff')); assert.ok(t.includes('OPEN MARKETS'), 'başlık + tanım satırı');
  const l = e.listeler.find((x) => /Four Types of Trade Barriers/.test(x.baslik));
  assert.ok(l); assert.deepEqual(Array.from(l.maddeler), ['Tariffs', 'Quotas', 'Subsidies', 'Embargoes']);
  assert.ok(e.sorular.some((q) => q.soru === 'Can a country keep a surplus forever?'));
  assert.ok(!e.listeler.some((x) => /Grading/.test(x.baslik)), 'not dağılımı liste değil');
  assert.equal(E.kaynakDili(DERS), 'en'); assert.equal(E.kaynakDili('Bu ders ile pazarlama olarak tanımlanır ve bir süreçtir.'), 'tr');
});
test('kapsama: aynı dilde sözcükle, farklı dilde yalnız dilden bağımsızlar; çıktılar eksik sayılmaz', () => {
  const e = E.kaynakEnvanteri(DERS);
  const kart = { key_terms: [{ term: 'Tariff', definition: 'tax on imports' }, { term: 'Laissez-faire', definition: '...' }], formulas: [{ latex: 'M \\times V = P \\times Y' }],
    key_points: ['Four types of trade barriers: tariffs, quotas, subsidies, embargoes.'], quiz_questions: [{ question: 'Can a country keep a surplus forever?', answer: 'No' }] };
  const k = E.kaynakKapsama(e, kart, true);
  assert.equal(k.formuller.islenen, 1, 'latex \\times ile yazılmış formül tanınır'); assert.deepEqual(Array.from(k.formuller.eksik), ['Q/L = Output per Unit of Labor']);
  assert.ok(k.tanimlar.islenen >= 2); assert.equal(k.listeler.islenen, 1); assert.equal(k.sorular.islenen, 1);
  assert.equal(k.ciktilar.olcum, 'bilgi'); assert.equal(k.ciktilar.eksik.length, 0);
  const f = E.kaynakKapsama(e, { key_terms: [{ term: 'Gümrük vergisi' }], formulas: [{ latex: 'M V = P Y' }] }, false);
  assert.equal(f.tanimlar.olcum, 'dil'); assert.equal(f.vurgular.olcum, 'dil'); assert.equal(f.formuller.olcum, 'formul');
  const p = E.kaynakKapsama(e, { key_terms: [{ term: 'Gümrük vergisi (Tariff)' }, { term: 'Bırakınız yapsınlar (Laissez-faire)' }] }, false);
  assert.equal(p.tanimlar.olcum, 'terim', 'İngilizce aslı parantezdeyse farklı dilde de ölçülür'); assert.ok(p.tanimlar.islenen >= 2);
});
test('pencere talimatı: kategoriler, uzunluk sınırı, farklı dilde terim kuralı', () => {
  const e = E.kaynakEnvanteri(DERS), t = E.envanterTalimati(e, true);
  assert.match(t, /^\n- SOURCE INVENTORY \(must all appear in the output\):/);
  for (const re of [/definitions → key_terms/, /formulas → formulas/, /numbered lists → keep EVERY item/, /lecturer's emphasised ideas → key_points/, /learning outcomes →/, /document's own questions → quiz_questions/]) assert.match(t, re);
  assert.match(t, /"translated term \(original term\)"/); assert.ok(!/translated term/.test(E.envanterTalimati(e, false)));
  assert.equal(E.envanterTalimati(E.kaynakEnvanteri('kısa metin'), false), '');
  const uzun = E.kaynakEnvanteri(Array.from({ length: 40 }, (_, i) => `TERM${i}: a definition that is long enough to count as a definition number ${'x'.repeat(i % 3)}`).join('\n'));
  assert.ok(E.envanterTalimati(uzun, false).length < 1700, 'pencere çıktı tavanını yememeli');
});
test('özet hattı: pencereye envanter, karta kaynak_kapsama', () => {
  assert.match(oz, /let pencereEnvanteri: Envanter\[\] = \[\]/);
  assert.match(oz, /\+ \(pencereEnvanteri\[wi\] \? envanterTalimati\(pencereEnvanteri\[wi\], kaynakFarkliDil\) : ''\)/);
  assert.match(oz, /pencereEnvanteri = windows\.map\(\(w\) => kaynakEnvanteri\(w\)\)/);
  assert.match(oz, /;\(qualityMeta as any\)\.kaynak_kapsama = kk/);
  const kes = (t) => t.slice(t.indexOf('SAYISAL ÖRNEK BULUCU (24.11.2026)'), t.indexOf('/* KAYNAK ENVANTERİ SONU */'));
  assert.equal(kes(oz), kes(fn), 'iki kopya aynı');
});
test('tamamla: yalnız eksikler, çift eklenmez, model sayı uydurmaz', () => {
  assert.match(S.TAMAMLA_TALIMATI(true), /"Türkçe terim \(English original\)"/); assert.match(S.TAMAMLA_TALIMATI(false), /Never invent numbers/);
  assert.match(S.TAMAMLA_TALIMATI(true), /Add ONLY items the card does not already cover/);
  const ek = S.tamamlaTemizle({ key_terms: [{ term: 'Tarife (Tariff)', definition: 'ithalat vergisi' }, { term: 'Kota', definition: 'miktar sınırı' }, { term: 'boş' }], quiz_questions: [{ question: 'Soru?', answer: 'Cevap' }], key_points: ['a'], formulas: [{ name: 'q', latex: 'MV=PY' }] });
  const b = S.birlesik({ key_terms: [{ term: 'Tarife', definition: 'x' }], quiz_questions: [] }, ek);
  assert.equal(b.eklenen.key_terms, 1, '"Tarife (Tariff)" mevcut "Tarife" ile aynı sayılır'); assert.equal(b.alanlar.key_terms.length, 2);
  assert.equal(b.eklenen.quiz_questions, 1); assert.equal(b.eklenen.formulas, 1);
  assert.match(fn, /if \(islem === 'kaynak-kontrol'\) return json\(\{ kapsama, ayniDil \}\)/);
  assert.match(fn, /for \(const ad of Object\.keys\(sonKapsama\)\) if \(sonKapsama\[ad\]\.olcum === 'dil'\) sonKapsama\[ad\] = \{ \.\.\.sonKapsama\[ad\], islenen: sonKapsama\[ad\]\.bulunan, eksik: \[\], olcum: 'model' \}/);
  assert.match(fn, /\.\.\.birlestir\.alanlar, slayt: null,/);
});
test('slayt: vurgu, ezber kartı, formül türleri (talimat + normalize + çizim)', () => {
  const t = S.sistemTalimati(true);
  for (const re of [/- "vurgu": "What the lecturer stressed"/, /- "liste": memory card/, /- "formul": one formula from the inventory/, /one "vurgu" slide when the inventory has 3\+ emphasised ideas/, /"sorular" uses the document's own questions first/]) assert.match(t, re);
  assert.match(fn, /const envMetni = envanterDokumu\(envD\)/); assert.match(fn, /\$\{envMetni\.slice\(0, 2500\)\}/, 'yedek model de envanteri görür');
  const ham = { slaytlar: [
    { tur: 'vurgu', baslik: 'What the lecturer stressed', maddeler: [{ metin: 'A → B', tr: 'A, B', kaynak: 'p.2' }, { metin: 'C' }] },
    { tur: 'liste', baslik: '4 barriers', maddeler: [{ ad: 'Tariffs', aciklama: 'tax', tr: 'Tarife' }, { ad: 'Quotas' }, { ad: 'Subsidies' }, { ad: 'Embargoes' }], ipucu: 'TQSE', ipucu_tr: 'baş harfler' },
    { tur: 'formul', baslik: 'Quantity equation', formul: 'M × V = P × Y', ad: 'QTM', degiskenler: [{ sembol: 'M', anlam: 'money', tr: 'para' }], ne_zaman: 'prices', ornek: 'e.g. M doubles' },
    { tur: 'vurgu', baslik: 'tek madde', maddeler: [{ metin: 'yalnız' }] }, { tur: 'formul', baslik: 'boş' }] };
  const W = { document: {}, console, addEventListener() { } }; W.window = W; vm.createContext(W); vm.runInContext(js, W); const A = W.AcadexOzetSlayt;
  assert.deepEqual(JSON.parse(JSON.stringify(A.normalize(ham).slaytlar)), S.desteNormalize(ham).slaytlar, 'istemci = sunucu');
  assert.equal(S.desteNormalize(ham).slaytlar.length, 3, 'tek maddeli vurgu ve formülsüz formül atılır');
  const h = A.desteHtml(ham);
  assert.match(h, /class="oz-s oz-t-vurgu"/); assert.match(h, /A → B <small class="oz-kaynak-i">p\.2<\/small>/);
  assert.match(h, /class="oz-liste" style="grid-template-columns:repeat\(4,1fr\)"/); assert.match(h, /Memory trick:<\/b> TQSE/);
  assert.match(h, /<p class="oz-f">M × V = P × Y<\/p>/); assert.match(h, /<td class="oz-f-sem">M<\/td>/);
});
test('ekran: kapsama karnesi + eksikleri ekle', () => {
  assert.match(ink, /if \(own\) axrKaynakKarne\(mast, c\);/);
  assert.match(ink, /var qmk = c\.quality_meta && c\.quality_meta\.kaynak_kapsama;/);
  assert.match(ink, /axrSlaytIstek\(\{ islem: 'kaynak-kontrol', kartId: c\.id \}\)/);
  assert.match(ink, /axrSlaytIstek\(\{ islem: 'tamamla', kartId: c\.id \}\)/);
  assert.match(ink, /closest\('\[data-kaynak-tamamla\]'\); if \(b\) axrKaynakTamamla\(b\);/);
  assert.match(ink, /AXR_ALANLAR\.forEach\(function \(a\) \{ if \(Array\.isArray\(j\[a\]\)\) k\[a\] = j\[a\]; \}\);/);
  assert.match(css, /#study-card-modal\.axr \.axr-kk\.eksik\{/);
  /* karne HTML'i: tam = yeşil, eksik = turuncu, dil = sayı, bilgi = eksik sayılmaz */
  const kes = (ad) => { const a = ink.indexOf('function ' + ad + '('), b = ink.indexOf('\n  }\n', a); return ink.slice(a, b + 4); };
  const f = new Function('X', ink.match(/  var AXR_KARNE_AD = [^\n]+\n/)[0] + kes('axrKarneEksikVar') + kes('axrKarneHtml') + '\nreturn axrKarneHtml;')((s) => String(s));
  const h = f({ tanimlar: { bulunan: 3, islenen: 3, eksik: [], olcum: 'sozcuk' }, formuller: { bulunan: 2, islenen: 1, eksik: ['M = x'], olcum: 'formul' }, vurgular: { bulunan: 5, islenen: 0, eksik: [], olcum: 'dil' }, ciktilar: { bulunan: 4, islenen: 4, eksik: [], olcum: 'bilgi' } });
  assert.match(h, /<span class="axr-kk ok"><b>3\/3<\/b> tanım<\/span>/); assert.match(h, /<span class="axr-kk eksik" title="Eksik: M = x"><b>1\/2<\/b> formül<\/span>/);
  assert.match(h, /<b>5<\/b> hoca vurgusu/); assert.match(h, /<b>4<\/b> öğrenme çıktısı/); assert.match(h, /data-kaynak-tamamla/);
  assert.ok(!/data-kaynak-tamamla/.test(f({ tanimlar: { bulunan: 2, islenen: 2, eksik: [], olcum: 'sozcuk' }, ciktilar: { bulunan: 3, islenen: 3, eksik: [], olcum: 'bilgi' } })), 'hepsi tamamsa düğme yok');
});
summary();
