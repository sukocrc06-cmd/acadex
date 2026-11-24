/* ==========================================================================
   ACADEX — SAYISAL ÖRNEK BULUCU (tests/ornek-bulucu.js), 24.11.2026
   NEDEN VAR: "ITB 311 Lecture 2" kartı kaynaktaki iki 2×2 L/Q örneğini (vizede çıktı)
   hiç işlemedi: Gemini zaman aşımına düştü, özet gpt-oss-20b'ye kaldı, pencere talimatı
   çözümlü örneği yalnız formül varken istiyordu; slaytlar da belge metnini görmeden
   bu özetten üretildi. Artık örnekler kodla bulunuyor (ornekBul), modele "MUST COVER"
   olarak veriliyor, kartın onları işleyip işlemediği ölçülüyor (ornekKapsama), eksikse
   kartta "ekle" düğmesi çıkıyor ve slaytlarda her örneğe bir "cozum" slaytı geliyor.
   Bu dosya şunları korur:
     - bulucu: ders kitabı / slayt örneklerini bulur; tekrar eden tabloyu bir kez sayar;
       psikoloji anlatısını, not dağılımını, madde numaralarını örnek saymaz
     - kapsama: tablo satır/sütun çifti ardışık olmalı; key_point'teki sayı yetmez
     - iki kopya (summarize-document ve ozet-slayt) birebir aynı
     - özet hattı: pencere talimatına MUST COVER, karta quality_meta.ornek_kapsama
     - slayt: "cozum" türü (talimat, normalize, çizim), yedek modele örnek sayfaları
     - ekran: eksikse uyarı + "ekle"; ekleme sonrası slayt destesi silinir
   Gerçek belgelerle ayarlandı (ITB 311 L2: 3 örnek; Accounting ch6: 5; Conformity ve
   Marketing ch1: 0). Çalıştırma:  node tests/ornek-bulucu.js
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
const SLAYT = 'supabase/functions/ozet-slayt/index.ts', OZET = 'supabase/functions/summarize-document/index.ts';
const ADLAR = ['ORNEK_ACIK_RE', 'ORNEK_KURULUM_RE', 'ORNEK_ZAYIF_KURULUM_RE', 'ORNEK_SORU_RE', 'ORNEK_YONETIM_RE', 'ORNEK_TABLO_SATIRI_RE', 'ornekSayilari', 'ornekBolumle', 'ornekBul', 'ornekKapsama', 'ornekTalimati'];
const B = loadFromSource(SLAYT, ADLAR);
const S = loadFromSource(SLAYT, ['str', 'dizi', 'ornekCiktisiTemizle', 'ORNEK_TALIMATI', 'sistemTalimati', 'yildizSay', 'TURLER', 'RENKLER', 'TUR_RENK', 'desteNormalize']);
const fn = read(SLAYT), oz = read(OZET), js = read('js/ozet-slayt.js'), ink = read('js/acadex-ink.js');

/* kendi yazdığımız, gerçek derslerin biçimini taklit eden metin */
const DERS = `--- PAGE 3 ---
TRADE AND MONEY
• Developed between the 16th and 18th centuries.
1. Wealth = Gold
2. Trade is zero-sum
--- PAGE 5 ---
MEASURING OUTPUT: Q/L AND L/Q
Example:
Country A: Q/L = 12 units
Country B: Q/L = 7 units
Example:
Country A: L/Q = 3 hours
Country B: L/Q = 8 hours
--- PAGE 6 ---
ABSOLUTE ADVANTAGE: A 2×2 EXAMPLE
Suppose two countries make Rice and Steel. Labor hours per unit (L/Q):
Rice Steel
Home 3 9
Foreign 5 4
Remember: lower is better
→ Home has an absolute advantage in RICE.
--- PAGE 7 ---
GAINS FROM SPECIALIZATION
Remember our example:
Rice Steel
Home 3 9
Foreign 5 4
Total production can increase.
--- PAGE 8 ---
WHEN ONE COUNTRY IS BETTER AT BOTH
Now consider a different example:
Rice Steel
Home 3 5
Foreign 9 7
Home is better in both goods.
--- PAGE 9 ---
Inventory costing
• Assume a shop buys three identical lamps at $40, $45 and $52 and sells two for $80 each.
• Cost of goods sold may be $85 ($40 + $45) or $97 ($45 + $52).
--- PAGE 10 ---
Grading
• Mid-Term Exam %40
• Final Exam %60
--- PAGE 11 ---
In one study, researchers (1981) asked 40 students to wait 2 hours; only 20% agreed. Consider the
scenario where 3 friends are present: 55% agreed. People conform when others are watching.`;

test('bulucu: örnekleri bulur, tekrar tabloyu bir kez sayar, anlatıyı ve not dağılımını almaz', () => {
  const o = B.ornekBul(DERS);
  assert.deepEqual(Array.from(o, (x) => x.baslik), ['MEASURING OUTPUT: Q/L AND L/Q', 'ABSOLUTE ADVANTAGE: A 2×2 EXAMPLE', 'WHEN ONE COUNTRY IS BETTER AT BOTH', 'Inventory costing']);
  assert.deepEqual(Array.from(o, (x) => x.sayfa), [5, 6, 8, 9]);
  assert.deepEqual(JSON.parse(JSON.stringify(o[1].satirlar)), [['3', '9'], ['5', '4']], 'başlıktaki 2×2 tablo satırı değil');
  assert.deepEqual(Array.from(B.ornekSayilari('1. Item\n2. Item 15 and 2019 and 7,5%')), ['15', '7.5%'], 'madde no ve yıl sayı değil');
  assert.equal(B.ornekBul(DERS, 2).length, 2);
  assert.deepEqual(Array.from(B.ornekBul('Mid-term 40%\nFinal 60%\nAttendance 10 20 30 40 50')), []);
});
test('kapsama: tablo çifti ardışık olmalı, key_point yetmez, Türkçe çözüm sayılır', () => {
  const o = B.ornekBul(DERS);
  const bos = B.ornekKapsama(o, { key_points: ['Home 3 9, Foreign 5 4'] });
  assert.equal(bos.islenen, 0, 'key_point örneği işlemek değil'); assert.equal(bos.eksik.length, 4);
  const tr = B.ornekKapsama(o, { worked_examples: [{ title: 'Mutlak avantaj', problem_statement: 'Ev ülkesi pirinç 3, çelik 9 saat; yabancı ülke pirinç 5, çelik 4 saat.', steps: ['Pirinç: 3 < 5'], final_answer: 'Ev pirinçte' }] });
  assert.equal(tr.islenen, 1); assert.deepEqual(Array.from(tr.eksik, (e) => e.sayfa), [5, 8, 9]);
  const sutun = B.ornekKapsama(o, { tables: [{ headers: ['', 'Home', 'Foreign'], rows: [['Rice', '3', '9'], ['Steel', '5', '7']] }] });
  assert.ok(sutun.eksik.every((e) => e.sayfa !== 8), 'sütun yönünde yazılmış tablo da sayılır');
  assert.match(B.ornekTalimati(o), /^\n- MUST COVER: this text contains 4 numerical example\(s\)/); assert.equal(B.ornekTalimati([]), '');
});
test('iki kopya birebir aynı (summarize-document = ozet-slayt)', () => {
  const kes = (t) => { const a = t.indexOf('SAYISAL ÖRNEK BULUCU (24.11.2026)'), b = t.indexOf('\n}', t.indexOf('export function ornekTalimati')); assert.ok(a > 0 && b > a); return t.slice(a, b); };
  assert.equal(kes(oz), kes(fn));
});
test('özet hattı: pencerelere MUST COVER, karta ornek_kapsama', () => {
  assert.match(oz, /let pencereOrnekleri: OrnekBlok\[\]\[\] = \[\]/);
  assert.match(oz, /empty array if there is no calculation` \+ ornekTalimati\(pencereOrnekleri\[wi\] \|\| \[\]\)/);
  assert.match(oz, /pencereOrnekleri = windows\.map\(\(w\) => ornekBul\(w, 4\)\)/);
  assert.match(oz, /;\(qualityMeta as any\)\.ornek_kapsama = ok/);
});
test('slayt: cozum türü talimatta, istemde örnekler, yedek model örnek sayfalarını görür', () => {
  const t = S.sistemTalimati(true);
  assert.match(t, /- "cozum": a NUMERICAL EXAMPLE from the source/); assert.match(t, /one "cozum" slide for EACH item under NUMERICAL EXAMPLES/);
  assert.match(t, /never back-translate a term from the Turkish summary/, 'price-specie-flow "fiyat-parça-akış"tan geri çevrilip "price-part-flow" olmuştu');
  assert.match(fn, /const ornekler = ornekBul\(belge, 6\)/); assert.match(fn, /=== NUMERICAL EXAMPLES \(\$\{ornekler\.length\}\)/);
  assert.match(fn, /\$\{kartDokumu\(card, 5000\)\}\$\{ornekMetni\.slice\(0, 3500\)\}/);
  const d = S.desteNormalize({ slaytlar: [{ tur: 'cozum', baslik: 'A 2×2 example', veri: { sutunlar: ['', 'Rice', 'Steel'], satirlar: [['Home', '3', '9'], ['Foreign', '5', '4']] }, adimlar: ['Rice: 3 < 5'], sonuc: 'Home → rice', sonuc_tr: 'Ev pirinç' }, { tur: 'cozum', baslik: 'boş', adimlar: [] }] }, { ikidil: false });
  assert.equal(d.slaytlar.length, 1); assert.equal(d.slaytlar[0].renk, 'turuncu'); assert.equal(d.slaytlar[0].sonuc_tr, '', 'tek dilde Türkçe satır yok');
});
test('slayt: istemci aynı normalize + çizim', () => {
  const W = { document: {}, console, addEventListener() { } }; W.window = W; vm.createContext(W);
  vm.runInContext(js, W); const A = W.AcadexOzetSlayt;
  const ham = { slaytlar: [{ tur: 'cozum', baslik: 'A 2×2 example', soru: 'Who has the absolute advantage?', kaynak: 'p.6', veri: { sutunlar: ['', 'Rice', 'Steel'], satirlar: [['Home', '3', '9'], ['Foreign', '5', '4']] }, adimlar: ['Rice: **3 < 5** → Home'], sonuc: 'Home exports rice', sonuc_tr: 'Ev pirinç ihraç eder' }] };
  assert.deepEqual(JSON.parse(JSON.stringify(A.normalize(ham).slaytlar)), S.desteNormalize(ham).slaytlar);
  const h = A.desteHtml(ham);
  assert.match(h, /class="oz-s oz-t-cozum"/); assert.match(h, /<span class="oz-sayi">9<\/span>/); assert.match(h, /<b>3 &lt; 5<\/b>/);
  assert.match(h, /class="oz-sonuc"/); assert.match(h, /Ev pirinç ihraç eder/); assert.match(h, /p\.6/);
});
test('eksik örnek çıkarıcı: çıktı temizliği, yalnız sahibi, slayt yenilenir', () => {
  const t = S.ornekCiktisiTemizle({ worked_examples: [{ title: 'x', problem_statement: 'p', steps: ['a', ''], final_answer: 'f' }, { title: 'adımsız', steps: [], final_answer: 'f' }], tables: [{ title: 't', headers: ['a'], rows: [['1']] }, { title: 'satırsız', headers: ['a'], rows: [] }] });
  assert.equal(t.worked_examples.length, 1); assert.deepEqual(t.worked_examples[0].steps, ['a']); assert.equal(t.tables.length, 1);
  assert.match(S.ORNEK_TALIMATI, /never invent or change a number/);
  assert.match(fn, /if \(card\.user_id !== kullanici\.id\) return json\(\{ mesaj: 'Yalnız kendi özetine örnek ekleyebilirsin\.' \}, 403\)/);
  assert.match(fn, /\.\.\.yeni, slayt: null,/);
  assert.match(fn, /if \(islem === 'ornek-kontrol' \|\| !kapsama\.eksik\.length\) return json\(kapsama\)/, 'kontrol model çağırmaz');
});
test('ekran: eksikse uyarı + ekle; eklenince kart yeniden çizilir', () => {
  assert.match(ink, /if \(own\) axrOrnekKontrol\(mast, c\);/);
  assert.match(ink, /var qmk = c\.quality_meta && c\.quality_meta\.ornek_kapsama;/);
  assert.match(ink, /X\('kaynakta ' \+ n \+ ' sayısal örnek var, özette yok · ekle'\)/);
  assert.match(ink, /axrSlaytIstek\(\{ islem: 'ornekler', kartId: c\.id \}\)/);
  assert.match(ink, /k\.slayt = null;/); assert.match(ink, /renderFlow\(\);\n\s+say\(j\.eklenen \+ ' çözümlü örnek eklendi/);
  assert.match(ink, /closest\('\[data-ornek-ekle\]'\); if \(b\) axrOrnekEkle\(b\);/);
});
summary();
