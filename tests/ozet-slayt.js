/* ==========================================================================
   ACADEX — AKILLI ÇALIŞMA SLAYTLARI (tests/ozet-slayt.js), 22.11.2026
   NEDEN VAR: Özetin PDF'i jsPDF'in düz A4 dökümüydü; artık 16:9 çalışma slaytı
   (js/ozet-slayt.js çizer, supabase/functions/ozet-slayt üretir ve PDF basar).
   Bu dosya şunları korur:
     - örnek deste (tests/ozet-slayt-ornek.json, Marketing Management Ch.1) her slayt
       türünü içerir ve normalize'dan kayıpsız geçer
     - istemci ve sunucu normalize'ı aynı sonucu verir (iki kopya ayrışmasın)
     - model çıktısındaki HTML kaçırılır; bilinmeyen tür / boş slayt atılır; yıldız 0-3
     - Türkçe belgede Türkçe satırlar çizilmez; İngilizce etiket "İ" ile büyümez
     - PDF'e giden HTML'de betik ve olay özniteliği kalmaz; slayt dışı HTML reddedilir
     - model talimatı örnek destenin kurallarını taşır (tekrar sonda, örnek cevap, uydurma yok)
     - PDF düğmesi slaytlara gider, klasik A4 duruyor; migration RLS'li
   Tarayıcıda (Playwright) desteden PDF basıldı, 16 sayfa 1280x720, taşma yok.
   Çalıştırma:  node tests/ozet-slayt.js
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

const W = { document: {}, console };
W.window = W; vm.createContext(W);
vm.runInContext(read('js/ozet-slayt.js'), W, { filename: 'ozet-slayt.js' });
const A = W.AcadexOzetSlayt;
const ORNEK = JSON.parse(read('tests/ozet-slayt-ornek.json'));
const S = loadFromSource('supabase/functions/ozet-slayt/index.ts',
  ['str', 'dizi', 'yildizSay', 'TURLER', 'RENKLER', 'TUR_RENK', 'desteNormalize', 'HTML_SINIRI', 'htmlTemizle', 'OZET_SINIRI', 'kartDokumu', 'sistemTalimati']);
const js = read('js/ozet-slayt.js'), fn = read('supabase/functions/ozet-slayt/index.ts');

test('örnek deste her türü içerir ve normalize\'dan kayıpsız geçer', () => {
  const d = A.normalize(ORNEK);
  assert.equal(d.slaytlar.length, ORNEK.slaytlar.length);
  const turler = new Set(Array.from(d.slaytlar, (s) => s.tur));
  for (const t of ['harita', 'kartlar', 'surec', 'tablo', 'ornek', 'sorular', 'tekrar']) assert.ok(turler.has(t), t);
  assert.equal(d.slaytlar[d.slaytlar.length - 1].tur, 'tekrar', 'son tekrar en sonda');
  const html = A.desteHtml(ORNEK);
  assert.equal((html.match(/class="oz-s /g) || []).length, ORNEK.slaytlar.length + 1, 'kapak + slaytlar');
  assert.match(html, /The 8 demand states/); assert.match(html, /8 talep durumu/);
  assert.match(html, /<b>art and science<\/b>/, '**kalın**');
});
test('istemci ve sunucu normalize aynı', () => {
  const a = JSON.parse(JSON.stringify(A.normalize(ORNEK))), b = S.desteNormalize(ORNEK);
  assert.deepEqual(b.slaytlar, a.slaytlar);
  const bozuk = { baslik: 'x', slaytlar: [{ tur: 'yok', baslik: 'a' }, { tur: 'kartlar', baslik: 'b', kartlar: [] }, { tur: 'kartlar', baslik: 'c', yildiz: 9, kartlar: [{ baslik: 'k', maddeler: [1, 'm', null] }] }] };
  const x = A.normalize(bozuk), y = S.desteNormalize(bozuk);
  assert.equal(x.slaytlar.length, 1); assert.equal(y.slaytlar.length, 1);
  assert.equal(x.slaytlar[0].yildiz, 3); assert.deepEqual(Array.from(x.slaytlar[0].kartlar[0].maddeler), ['1', 'm']);
  assert.deepEqual(JSON.parse(JSON.stringify(x.slaytlar)), y.slaytlar);
});
test('model çıktısındaki HTML kaçırılır', () => {
  const h = A.desteHtml({ baslik: '<img src=x onerror=alert(1)>', slaytlar: [{ tur: 'kartlar', baslik: '<script>x()</script>', kartlar: [{ baslik: 'a"b', metin: '**ok** <b>no</b>' }] }] });
  assert.ok(!/<script>|<img/i.test(h)); assert.match(h, /&lt;script&gt;/); assert.match(h, /<b>ok<\/b> &lt;b&gt;no&lt;\/b&gt;/);
});
test('Türkçe belge: Türkçe satır yok; İngilizce etiket İ ile büyümez', () => {
  const tek = A.desteHtml(Object.assign({}, ORNEK, { ikidil: false }));
  assert.ok(!/class="oz-tr"|class="oz-alt"/.test(tek), 'tek dilde Türkçe satır çizilmez');
  const iki = A.desteHtml(ORNEK);
  assert.match(iki, /DEFINITIONS · TANIMLAR/); assert.match(iki, /CHAPTER MAP · BÖLÜM HARİTASI/);
  assert.match(iki, /MARKETING MANAGEMENT · CHAPTER 1 · SMART STUDY SLIDES/);
  assert.ok(!/text-transform:uppercase/.test(A.CSS));
  assert.equal(S.desteNormalize(ORNEK, { ikidil: false }).slaytlar.every((s) => !s.baslik_tr && !s.etiket_tr), true);
});
test('PDF belgesi: sayfa 1280x720, arka plan basılır, sunucuya betik gitmez', () => {
  const doc = A.pdfBelgesi(A.desteHtml(ORNEK), 'x', false);
  assert.match(doc, /^<!doctype html>/); assert.match(doc, /@page\{size:1280px 720px;margin:0\}/);
  assert.ok(!/<script/i.test(doc)); assert.match(A.pdfBelgesi('', 'x', true), /window\.print\(\)/);
  assert.match(A.CSS, /print-color-adjust:exact/);
  const t = S.htmlTemizle(doc.replace('</body>', '<script>fetch(1)</script><div onclick="x()" class="a">j</div><iframe src="//e"></iframe></body>'));
  assert.ok(t && !/<script|onclick|<iframe/i.test(t));
  assert.equal(S.htmlTemizle('<!doctype html><p>merhaba</p>'), null, 'slayt dışı HTML reddedilir');
  assert.equal(S.htmlTemizle('x'.repeat(10)), null);
  assert.match(fn, /preferCSSPageSize: true/); assert.match(fn, /printBackground: true/);
  assert.match(fn, /buf\[0\] === 0x25 && buf\[1\] === 0x50/, 'yanıt gerçekten PDF mi');
});
test('sığdırma: taşan küçülür (en az 0.7), boş kalan en çok 1.2 büyür', () => {
  assert.match(js, /var K_EN_AZ = 0\.7, K_EN_COK = 1\.2, PAY = 48;/);
  assert.match(A.CSS, /\.oz-govde\{margin-top:24px;zoom:var\(--k\)\}/);
  assert.match(js, /class="oz-s oz-t-' \+ s\.tur/, 'slayt sınıfı içerik sınıflarıyla çakışmaz (oz-harita grid oluyordu)');
});
test('model talimatı ve kart dökümü', () => {
  const t = S.sistemTalimati(true), tt = S.sistemTalimati(false);
  for (const re of [/"tekrar" as the LAST slide/, /"ornek" model answers/, /Never invent statistics/, /yildiz = estimated exam importance/, /one idea per sentence/]) assert.match(t, re);
  assert.match(tt, /leave every "tr", "baslik_tr" and "etiket_tr" field EMPTY/);
  assert.match(S.sistemTalimati(true, true), /9-12/);
  const d = S.kartDokumu({ summary: 'GDP is output. [1] More [2,3].', sections: [{ heading: 'H1', summary: 'S', key_points: ['kp'] }], key_terms: [{ term: 'GDP', definition: 'def' }], quiz_questions: [{ question: 'Q?', answer: 'A' }] });
  assert.ok(!/\[\d/.test(d)); assert.match(d, /## H1/); assert.match(d, /- GDP: def/); assert.match(d, /Q\? → A/);
  assert.ok(S.kartDokumu({ summary: 'x'.repeat(50000) }).length <= S.OZET_SINIRI);
});
test('sunucu: önbellek, günlük sınır, yalnız sahibi kaydeder', () => {
  assert.match(fn, /if \(card\.slayt\?\.deste && !govde\?\.yenile\) return json/);
  assert.match(fn, /const GUNLUK_URET = 12\nconst GUNLUK_PDF = 40/);
  assert.match(fn, /if \(card\.user_id === kullanici\.id\) \{\n\s+const \{ error \} = await service\.from\('study_cards'\)\.update\(\{ slayt: kayit \}\)/);
  assert.match(fn, /if \(!hesap \|\| !anahtar\) return \{ hata: 'pdf_kapali', durum: 501 \}/);
  const mig = read('supabase/migrations/20261122d_ozet_slayt.sql');
  assert.match(mig, /add column if not exists slayt jsonb/); assert.match(mig, /ozet_slayt_kullanim enable row level security/);
  assert.ok(!/create policy/i.test(mig), 'istemciye izin yok');
});
test('panel: slaytlar düğmesi, PDF slayta gider, klasik A4 duruyor', () => {
  const html = read('dashboard.html'), d = read('js/dashboard.js');
  assert.match(html, /id="btn-study-slides"/); assert.match(html, /<script src="js\/ozet-slayt\.js"><\/script>/);
  assert.match(d, /window\.AcadexOzetSlayt\.ac\(currentActiveStudyCard, \{ indir: true \}\);\n\s+return;/);
  assert.match(d, /await exportStudyCardToPDF\(currentActiveStudyCard\);/, 'eski yol yedek olarak duruyor');
  assert.match(js, /exportStudyCardToPDF\(kart\)/, 'görüntüleyicide Klasik A4 PDF');
});
summary();
