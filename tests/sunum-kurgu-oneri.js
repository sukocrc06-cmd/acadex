/* ==========================================================================
   SUNUM — #41: KURGU ÖNERİSİ, PHASE 1 (yerel, deterministik) (27.11.2026)
   Kaynak: ACADEX-QA-TRANSFER #40 (tasarım) ve #41 (uygulama).

   "Acadia'dan öneri al" sunum penceresinde kurgu seçicisinin (data-pl-story) altında. Konu başlığındaki sözcük
   işaretlerine bakar; anlam çıkarmaz, model ya da ağ çağrısı yapmaz. Seçiciyi yalnız açık "kullan" tıklaması yazar,
   "geri al" tek düzey geri döner. Web araştırması kapalıyken (legacyTopic kurguyu kullanmaz) öneri ve uygulama kapalı.

   A: kaynak kuralları · B: saf işlevler (acadex-ink.js'ten kesilerek) · H: ayrılmış ölçüt listesi (sözlükten ÖNCE
   yazıldı, sözlük ölçümden önce donduruldu; sonuç yalnız raporlanır, ayar için kullanılmaz) · D: tarayıcı (başsız
   Chrome, sahte hesap, sahte invoke; fetch/XHR/invoke/from/rpc casusu, öneri yolunda tek istek bile testi düşürür).
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js'), html = read('dashboard.html');
const cut = (a, b) => { const i = ink.indexOf(a); assert.ok(i >= 0, 'yok: ' + a); const j = ink.indexOf(b, i + a.length); assert.ok(j > i, 'yok: ' + b); return ink.slice(i, j); };

const SAF = cut('  /* ---------- #41: KURGU ÖNERİSİ', '  var curLang = ');
const EKRAN = cut('  /* #41 kurgu önerisi: ekran ve yaşam döngüsü.', '  var norm = function (t) {');
const K = Function(SAF + '\nreturn { KURGU_ID: KURGU_ID, KURGU: KURGU, KURGU_BELIRSIZ: KURGU_BELIRSIZ, kurguOner: kurguOner, kurguDogrula: kurguDogrula };')();
const ID = ['auto', 'problem', 'scqa', 'compare', 'chrono'], TONLAR = ['akademik', 'kurumsal', 'hikaye', 'ozet'];
const on = (t, ton, dil) => K.kurguOner(t, ton || 'akademik', dil);
const net = (t, ton, dil) => { const r = on(t, ton, dil); return r.confidence === 'clear' ? r.recommended_structure : '?'; };

/* ------------------------------ H: ayrılmış ölçüt listesi ------------------------------
   Sözlükten ÖNCE yazıldı (sha256 b2269880…0e92, 27.11.2026 11:01); sözlük 11:05'te donduruldu (sha256 35155617…47bc), ölçüm
   ondan sonra. #40'taki beş örnek başlık listede yok. Eşik yalnız kaba akıl sağlığı: başarı oranı ayar hedefi değildir. */
const HELD = [
  ['compare', 'Nuclear vs. Solar Energy for Developing Countries'], ['compare', 'Remote Work or Office Work: Which Boosts Productivity?'], ['compare', 'Kapitalizm ve sosyalizm arasındaki farklar'],
  ['compare', 'Kiralamak mı, satın almak mı?'], ['compare', 'Comparing Keynesian and Monetarist Economics'], ['compare', 'Elektrikli araçlar ile benzinli araçların karşılaştırması'], ['compare', 'Public vs Private Universities'],
  ['chrono', 'The History of the Internet'], ['chrono', 'Türk Lirası\'nın tarihçesi'], ['chrono', 'How Smartphones Changed Between 2007 and 2024'], ['chrono', 'Osmanlı\'dan Cumhuriyet\'e eğitim sistemi'],
  ['chrono', 'The Evolution of Marketing Since the 1950s'], ['chrono', 'Dünden bugüne İstanbul\'un ulaşımı'],
  ['problem', 'How to Reduce Food Waste in Restaurants'], ['problem', 'Strategies for Reducing Employee Turnover'], ['problem', 'Üniversite öğrencilerinde stresle başa çıkma yolları'],
  ['problem', 'Trafik kazalarını önlemek için çözümler'], ['problem', 'Tackling Plastic Pollution in the Oceans'], ['problem', 'Gençlik işsizliği sorunu ve çözüm önerileri'],
  ['scqa', 'Lessons from the 2008 Financial Crisis'], ['scqa', 'Should Universities Ban Smartphones in Class?'], ['scqa', 'Case Study: Nokia\'s Decline'],
  ['scqa', 'Bir veri sızıntısı yaşandığında şirket ne yapmalı?'], ['scqa', 'Örnek olay: Bir girişimin batışı'], ['scqa', 'Pandemide okullar kapatılmalı mıydı?'],
  ['auto', 'What Is Machine Learning?'], ['auto', 'Introduction to Supply Chain Management'], ['auto', 'Fotosentez nedir?'], ['auto', 'Temel muhasebe kavramları'],
  ['auto', 'Principles of Microeconomics'], ['auto', 'Blokzincir teknolojisinin temelleri'],
  ['belirsiz', 'Marketing'], ['belirsiz', 'Yapay zekâ ve sağlık'], ['belirsiz', 'Renewable Energy in Europe'], ['belirsiz', 'Sosyal medya'], ['belirsiz', 'Urban Transportation'], ['belirsiz', 'Türkiye\'de turizm']];

/* ------------------------------ A: kaynak kuralları ------------------------------ */
test('A1 kimlikler: beş kimlik seçicinin seçenekleri ve sunum-research STORY haritasıyla birebir; etiketler seçicideki yazı', () => {
  assert.deepEqual(K.KURGU_ID, ID);
  const sec = html.match(/<select data-pl-story="">([\s\S]*?)<\/select>/); assert.ok(sec, 'seçici');
  const opt = [...sec[1].matchAll(/<option value="([a-z]+)">([^<]+)<\/option>/g)];
  assert.deepEqual(opt.map((m) => m[1]), ID);
  opt.forEach((m) => assert.equal(K.KURGU[m[1]].ad, m[2], m[1] + ' etiketi'));
  const srv = read('supabase/functions/sunum-research/index.ts'), st = srv.match(/const STORY: Record<string, string> = \{([\s\S]*?)\n\s*\};/);
  assert.ok(st, 'STORY haritası'); for (const k of ID.filter((x) => x !== 'auto')) assert.match(st[1], new RegExp('\\b' + k + ':'), 'sunucu ' + k);
});

test('A2 ağ yok: öneri blokları fetch/XHR/invoke/fn/from/rpc/depolama/zamanlayıcı/dispatchEvent içermiyor', () => {
  for (const [ad, b] of [['saf', SAF], ['ekran', EKRAN]]) {
    const kod = b.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const re of [/\bfetch\s*\(/, /XMLHttpRequest/, /\.invoke\s*\(/, /\bfn\s*\(/, /supabaseClient/, /\.from\s*\(/, /\.rpc\s*\(/, /localStorage|sessionStorage|indexedDB/, /sendBeacon|WebSocket|EventSource|import\s*\(/,
      /setTimeout|setInterval|requestAnimationFrame/, /dispatchEvent/, /groq|gemini|generativelanguage|tavily|openai|anthropic/i]) assert.ok(!re.test(kod), ad + ': ' + re);
  }
});

test('A3 seçiciyi yalnız oneriKullan ve oneriGeri yazar; oneriAl yalnız düğme tıklamasına bağlı; açılış/axSunumPlot çalıştırmaz', () => {
  const kod = EKRAN.replace(/\/\*[\s\S]*?\*\//g, ''), yaz = [...kod.matchAll(/\.value\s*=(?!=)/g)].map((m) => m.index);
  assert.equal(yaz.length, 2, 'seçiciye iki yazım');
  const ku = kod.indexOf('var oneriKullan = '), ge = kod.indexOf('var oneriGeri = '), so = kod.indexOf('var oneriSozluk = ');
  assert.ok(yaz[0] > ku && yaz[0] < ge && yaz[1] > ge && yaz[1] < so, 'yazımlar yalnız oneriKullan/oneriGeri içinde');
  assert.equal(kod.split('oneriAl').length - 1, 2, 'tanım + tek bağlantı');
  assert.match(kod, /Q\('\[data-oneri-al\]', plot\)\.addEventListener\('click', oneriAl\)/);
  const ac = cut('  var openPlot = function (from) {', '  var fillDocs = '), sp = cut('  window.axSunumPlot = function (o) {', '  plot.addEventListener(\'click\'');
  assert.ok(!/oneriAl|kurguOner/.test(ac + sp), 'açılış ya da axSunumPlot öneri çalıştırıyor');
  assert.match(ac, /if \(oneriSifirla\) oneriSifirla\(\);/, 'açılışta sıfırlama');
  assert.match(cut('  var paintSrc = function () {', '  var openPlot = '), /if \(oneriBoya\) oneriBoya\(\);\n  \};\n$/);
  assert.match(kod, /plot\.addEventListener\('close', oneriSifirla\)/, 'kapanınca geçersiz');
});

test('A4 #38 korunur: plotBirak aynı; üretim yolu kurguyu seçiciden okumaya devam eder; web kapalı yol kurguyu yok sayar', () => {
  assert.match(ink, /var plotBirak = function \(\) \{ plotRun\+\+; outlineNo\+\+; plotHazir = false; akisTemizle\(\); \};\n {2}plot\.addEventListener\('cancel', plotBirak\); plot\.addEventListener\('close', plotBirak\);/);
  assert.match(ink, /story: sy \? sy\.value : 'auto', web: !wb \|\| wb\.checked/);
  assert.match(ink, /fn\('sunum-research', \{ action: 'research', topic: tp, story: o\.story \|\| 'auto', slideCount: o\.n/);
  assert.ok(!/story/.test(cut('  var legacyTopic = function (tp, o, title) {', '\n  };\n')), 'legacyTopic kurgu kullanmaya başladı: web kapalı açıklaması yeniden düşünülmeli');
});

test('A5 işaretleme: düğme seçicinin hemen altında, yalnız konu kaynağında; kart aria-live; İngilizce sözlükte her ekran yazısı var', () => {
  assert.match(html, /<\/select><\/label>\n<div class="sx-oneri" data-srcf="topic" data-oneri hidden role="group" aria-label="kurgu önerisi">\n<div class="sx-oneri-ust"><button type="button" class="bp-ghost sx-ghost" data-oneri-al>Acadia'dan öneri al<\/button><small data-oneri-not><\/small><\/div>\n<div class="sx-oneri-kart" data-oneri-kart aria-live="polite" hidden><\/div>\n<\/div>\n<fieldset class="sx-f sx-tones"><legend>sunum dili<\/legend>/);
  const so = cut('  var oneriSozluk = function () {', '  oneriSozluk();'), A = {};
  Function('window', so + '\noneriSozluk();')({ AX_EN: { t: A } });
  const yazilar = ["Acadia'dan öneri al", 'önce bir konu yaz', 'Acadia başlığa bakıyor…', 'Web araştırması kapalıyken kurgu iskeleti uygulanmaz; öneri için webde araştır’ı aç.',
    'Başlıktaki işaretlere bakar; seçimini sen onaylamadan değiştirmez.', 'Konu ya da ayarlar değişti; önceki öneri bu girdi için geçerli değil.', 'Öneri çıkarılamadı. Kurguyu öneri olmadan da çıkarabilirsin.',
    'Önerim:', 'Net bir işaret yok.', 'Güvenli seçim:', 'işaret:', 'alternatif:', '✓ kullanılıyor:', 'bu kurgu zaten seçili', 'Bu kurguyu kullan', 'alternatifi kullan', 'beşini de gör', 'listeyi gizle',
    'geri al', 'önerilen', 'seçili', 'kullan', K.KURGU_BELIRSIZ].concat(ID.map((k) => K.KURGU[k].neden), ID.map((k) => K.KURGU[k].uyar));
  for (const y of yazilar) { assert.ok(A[y], 'EN anahtarı yok: ' + y); if (!ID.some((k) => K.KURGU[k].neden === y || K.KURGU[k].uyar === y) && y !== K.KURGU_BELIRSIZ) assert.ok(EKRAN.includes(y) || html.includes(y), 'ekranda yok: ' + y); }
  const B = { "Acadia'dan öneri al": 'önceden' }; Function('window', so + '\noneriSozluk();')({ AX_EN: { t: B } });
  assert.deepEqual(B, { "Acadia'dan öneri al": 'önceden' }, 'koruma: ilk anahtar varsa sözlüğe dokunmaz');
  const C = { 'geri al': 'revert' }; Function('window', so + '\noneriSozluk();')({ AX_EN: { t: C } }); assert.equal(C['geri al'], 'revert', 'var olan anahtar ezilmez');
});

test('A6 CSS: kapsamlı seçiciler, 44px dokunma hedefi, taşma koruması ve dar ekran bloğu', () => {
  const css = read('css/acadex-ink.css'), i = css.indexOf('/* Kurgu önerisi (#41'); assert.ok(i > 0); const c = css.slice(i);
  assert.match(c, /\.sx-oneri button\{min-height:44px;max-width:100%;white-space:normal;overflow-wrap:anywhere/);
  assert.match(c, /@media \(max-width:640px\)\{[^\n]*\.sx-oneri-b\{flex-direction:column/);
  assert.ok(c.split('\n').filter((l) => /^[^/@\s].*\{/.test(l)).every((l) => l.startsWith(':is(#acadexsunum-view.axu,#axu-layer) .sx-oneri')), 'kapsam dışı seçici');
});

/* ------------------------------ B: saf işlevler ------------------------------ */
test('B1 olumlu işaretler, TR ve EN: her kurgu net önerilir', () => {
  const durum = [['compare', ['Agile vs Waterfall', 'iOS versus Android', 'Pros and cons of nuclear power', 'Kahve mi, çay mı?', 'Doğalgaz ile kömürün karşılaştırması', 'Advantages and disadvantages of e-learning']],
    ['chrono', ['History of jazz', 'Dijital dönüşümün tarihi', 'Geçmişten günümüze tiyatro', 'Fashion from 1960 to 2020', 'Ankara\'dan Paris\'e bir yolculuk', 'How the web has evolved']],
    ['problem', ['How to prevent burnout', 'İklim değişikliğiyle mücadele', 'Ways to reduce water use', 'Okul terkini önleme stratejileri', 'Tackling misinformation', 'Gürültü kirliliğini azaltmanın yolları']],
    ['scqa', ['Should we tax sugar?', 'Case study: Kodak', 'Lessons learned from Chernobyl', 'Örnek olay: bir markanın krizi', 'Şehir merkezleri araçlara kapatılmalı mı?', 'What went wrong at Theranos']],
    ['auto', ['Bitcoin nedir?', 'Introduction to statistics', 'Principles of marketing', 'Termodinamiğin temel ilkeleri', 'What are enzymes', 'Basics of photography']]];
  for (const [k, ts] of durum) for (const t of ts) assert.equal(net(t), k, t + ' → ' + JSON.stringify(on(t)));
  /* bilinen kaçırma (sözlük donduruldu): edilgen "karşılaştırılması" karşılaştırma\p{L}* ile eşleşmez */
  assert.equal(net('Doğalgaz ve kömürün karşılaştırılması'), '?');
});

test('B2 anlatım (4 ton): net kararı ve güveni hiç değiştirmez; yalnız eşitlikte alternatifi sıralar', () => {
  const ts = ['Agile vs Waterfall', 'History of jazz', 'How to prevent burnout', 'Should we tax sugar?', 'Bitcoin nedir?', 'Marketing', 'Krizler', 'Water treatment methods', 'Big data or small data?'];
  for (const t of ts) { const r0 = on(t, 'akademik'); for (const ton of TONLAR) { const r = on(t, ton); assert.equal(r.confidence, r0.confidence, t + ' ' + ton); assert.equal(r.recommended_structure, r0.recommended_structure, t + ' ' + ton); } }
  assert.deepEqual(TONLAR.map((t) => on('Krizler', t).alternative_structure), ['problem', 'problem', 'scqa', 'problem'], 'kriz: problem/scqa eşit');
  assert.equal(on('Elektrik devreleri', 'hikaye').alternative_structure, 'scqa'); assert.equal(on('Elektrik devreleri', 'kurumsal').alternative_structure, 'problem');
  assert.equal(on('Agile vs Waterfall', 'bilinmeyen').recommended_structure, 'compare', 'bilinmeyen ton güvenli');
});

test('B3 nötr ve belirsiz başlıklar: otomatik + uncertain, yüzde ya da sayı yok; eşit iki işaret net sayılmaz', () => {
  for (const t of ['Marketing', 'Climate change', 'Göç ve kimlik', 'Elektrik devreleri', 'Ottoman history: an introduction', 'Big data or small data?', 'Krizler', 'Risk management in banking']) {
    const r = on(t); assert.equal(r.confidence, 'uncertain', t + ' ' + JSON.stringify(r)); assert.equal(r.recommended_structure, 'auto'); assert.notEqual(r.alternative_structure, 'auto');
    assert.equal(r.reason, K.KURGU_BELIRSIZ); assert.ok(!/\d|%/.test(r.reason));
  }
  for (const k of ID) assert.ok(!/\d|%/.test(K.KURGU[k].neden), k);
});

test('B4 bilinen yanlış pozitif tuzakları: çıplak problem/ile/and/evolution/comparative tek başına net karar vermez', () => {
  for (const t of ['Problem-based learning', 'Python ile veri analizi', 'Supply and demand', 'Theory of Evolution', 'Comparative literature', 'Problem solving in mathematics teaching', 'Kitap ve okur']) {
    const r = on(t); assert.ok(!(r.confidence === 'clear' && ['compare', 'chrono', 'problem'].includes(r.recommended_structure) && !/solving/.test(t)), t + ' → ' + JSON.stringify(r));
  }
  assert.equal(net('Problem-based learning'), '?'); assert.equal(net('Python ile veri analizi'), '?'); assert.equal(net('Supply and demand'), '?'); assert.equal(net('Theory of Evolution'), '?');
  /* bilinen kalan yanlış pozitifler (sözlük donduruldu, düzeltilmedi; raporda sınırlılık) */
  const kalan = ['Reducing Fractions', 'Solution chemistry basics', 'The Should-Cost Model', 'From Data to Wisdom'].map((t) => t + ' → ' + net(t));
  console.log('  GOZLEM  bilinen kalan yanlış pozitifler: ' + kalan.join(' · '));
});

test('B5 boş/boşluk null; 80 karakter, emoji, tırnak, karışık dil, çok uzun girdi: geçerli ve sınırlı çıktı; deterministik', () => {
  for (const t of ['', '   ', '\n\t', null, undefined]) assert.equal(K.kurguOner(t, 'akademik'), null, JSON.stringify(t));
  const t80 = 'Türkiye ve Almanya karşılaştırması: mesleki eğitim, çıraklık ve istihdam sonuçları'.slice(0, 80); assert.equal(t80.length, 80);
  assert.equal(net(t80), 'compare');
  assert.equal(net('🚀 Mars\'a yolculuk: dünden bugüne'), 'chrono'); assert.equal(net('Yapay zekâ vs. insan yaratıcılığı'), 'compare');
  assert.equal(net('"Quoted" title vs ‘other’'), 'compare'); assert.equal(net('“Sosyal medya” nedir?'), 'auto'); assert.equal(net('İSTANBUL\'UN TARİHİ'), 'chrono', 'büyük harf Türkçe');
  assert.equal(net('INTRODUCTION TO PHYSICS', 'akademik', 'tr'), 'auto', 'İngilizce büyük harf tr küçültmede de bulunur');
  const uzun = 'versus '.repeat(300) + 'history '.repeat(300); const r = on(uzun); assert.ok(K.kurguDogrula(r).ok); assert.ok(r.signals.every((s) => s.length <= 40));
  const a = JSON.stringify(on('Agile vs Waterfall', 'hikaye', 'en')), b = JSON.stringify(on('Agile vs Waterfall', 'hikaye', 'en')); assert.equal(a, b);
  assert.deepEqual(Object.keys(on('x')), ['v', 'recommended_structure', 'alternative_structure', 'reason', 'signals', 'confidence']);
});

test('B6 üretilen her sonuç doğrulamadan geçer (ölçüt listesi + ek başlıklar × 4 ton × 3 dil)', () => {
  const ts = HELD.map((x) => x[1]).concat(['Agile vs Waterfall', 'Krizler', 'Marketing', '🚀', '?', 'vs', 'a'.repeat(80), 'Kahve mi, çay mı?', 'İSTANBUL\'UN TARİHİ']);
  let n = 0; for (const t of ts) for (const ton of TONLAR) for (const dil of ['tr', 'en', null]) {
    const r = K.kurguOner(t, ton, dil), v = K.kurguDogrula(r); assert.ok(v.ok, t + ' ' + ton + ' ' + v.neden); assert.deepEqual(v.sonuc, r);
    assert.ok(r.signals.length <= 4); assert.notEqual(r.alternative_structure, r.recommended_structure); n++;
  }
  assert.ok(n >= 500);
  assert.ok(K.kurguDogrula(JSON.stringify(on('History of jazz'))).ok, 'JSON metni de kabul');
});

test('B7 geçersiz şema: her bozuk durum reddedilir, onarılmaz', () => {
  const iyi = on('Agile vs Waterfall'); const d = (o) => Object.assign({}, iyi, o);
  const kotu = [[null, 'nesne'], [[], 'nesne'], ['{x', 'json'], ['"metin"', 'nesne'], [42, 'nesne'], [d({ v: 2 }), 'surum'], [d({ v: '1' }), 'surum'],
    [d({ recommended_structure: 'timeline' }), 'oneri'], [d({ recommended_structure: undefined }), 'oneri'], [d({ recommended_structure: 'AUTO' }), 'oneri'],
    [d({ alternative_structure: 'compare' }), 'alternatif'], [d({ alternative_structure: 'x' }), 'alternatif'], [(() => { const o = d({}); delete o.alternative_structure; return o; })(), 'alternatif'],
    [d({ reason: '' }), 'gerekce'], [d({ reason: 'kısa' }), 'gerekce'], [d({ reason: 'x'.repeat(161) }), 'gerekce'], [d({ reason: 'satır bir\nsatır iki uzun' }), 'gerekce'], [d({ reason: 5 }), 'gerekce'],
    [d({ reason: 'Bu kurgu %85 uygun görünüyor.' }), 'yuzde'], [d({ reason: 'Uygunluk 90 % düzeyinde.' }), 'yuzde'], [d({ reason: 'confidence: 0.9 for this one' }), 'yuzde'], [d({ reason: 'Güven 9 üzerinden yüksek' }), 'yuzde'],
    [d({ signals: 'vs' }), 'isaret'], [d({ signals: ['a', 'b', 'c', 'd', 'e'] }), 'isaret'], [d({ signals: [''] }), 'isaret'], [d({ signals: ['x'.repeat(41)] }), 'isaret'], [d({ signals: [3] }), 'isaret'],
    [d({ confidence: 'high' }), 'guven'], [d({ confidence: 0.8 }), 'guven'], [d({ score: 0.8 }), 'fazla-alan'], [d({ confidence_pct: 80 }), 'fazla-alan']];
  for (const [g, neden] of kotu) { const v = K.kurguDogrula(g); assert.equal(v.ok, false, JSON.stringify(g)); assert.equal(v.neden, neden, JSON.stringify(g) + ' → ' + v.neden); }
  assert.ok(K.kurguDogrula(d({ alternative_structure: null })).ok, 'alternatifsiz (null) geçerli');
});

test('H1 ayrılmış liste (≥30, karışık TR/EN, her kurguda ~6 + geniş): karışıklık matrisi raporlanır; yanlış net öneri ve geniş başlıkta net öneri sınırlı', () => {
  assert.ok(HELD.length >= 36); const L = ['compare', 'chrono', 'problem', 'scqa', 'auto', 'belirsiz'], P = ['compare', 'chrono', 'problem', 'scqa', 'auto', '?'], M = {};
  L.forEach((l) => { M[l] = {}; P.forEach((p) => { M[l][p] = 0; }); assert.ok(HELD.filter((x) => x[0] === l).length >= 6, l); });
  let dogru = 0, yanlis = 0, belirsiz = 0, yapili = 0, genisNet = 0;
  for (const [lab, t] of HELD) { const p = net(t); M[lab][p]++; if (lab === 'belirsiz') { if (p !== '?') genisNet++; continue; } yapili++; if (p === '?') belirsiz++; else if (p === lab) dogru++; else yanlis++; }
  console.log('  OLCUM   yapılı ' + yapili + ': doğru net ' + dogru + ', yanlış net ' + yanlis + ', belirsiz ' + belirsiz + ' (' + Math.round(100 * belirsiz / yapili) + '%) · geniş 6: net ' + genisNet);
  console.log('  OLCUM   etiket\\tahmin ' + P.join(' ') + ' | ' + L.map((l) => l + ' ' + P.map((p) => M[l][p]).join(' ')).join(' | '));
  assert.ok(yanlis <= 3, 'yanlış net öneri: ' + yanlis); assert.ok(genisNet <= 2, 'geniş başlıkta net öneri: ' + genisNet); assert.ok(dogru >= 18, 'doğru net: ' + dogru);
});

/* ------------------------------ D: tarayıcı ------------------------------ */
const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');
if (!CHROME) {
  console.log('  ATLANDI  D1–D7 (başsız Chrome: ağ yalıtımı, uygula/geri al, geçersiz kılma, yeniden açma, üretim gövdesi, 500px): Chrome bulunamadı. Bu testler GEÇTİ sayılmadı.');
  summary();
} else (async () => {
  const { W, sayfa, temizle } = duzenek();
  const kosK = (dosya, prof, icerik, gen) => new Promise((res, rej) => {
    fs.writeFileSync(path.join(W, dosya), icerik);
    execFile(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=' + (gen || 1280) + ',900', '--user-data-dir=' + path.join(W, 'prof-' + prof), '--allow-file-access-from-files', '--virtual-time-budget=120000', '--dump-dom', pathToFileURL(path.join(W, dosya)).href], { maxBuffer: 64 << 20, timeout: 240000 }, (e, out) => {
      if (e) return rej(e); const m = String(out).match(/<pre id="diag">([\s\S]*?)<\/pre>/); if (!m) return rej(new Error(dosya + ': diag yok'));
      res(JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&')));
    });
  });
  /* casus: her istek türü sayılır; YASAK adresler/işlev adları ayrıca işaretlenir */
  const ONCU = `
    window.currentUserProfile = { department: 'Deneme', full_name: 'Deneme Öğrenci' };
    var AG = window.__casus = [], HATALAR = [], Qp = function (s) { return d.querySelector('[data-plotdlg] ' + s); }, plot = d.querySelector('[data-plotdlg]');
    var ce = console.error; console.error = function () { HATALAR.push(Array.prototype.slice.call(arguments).map(String).join(' ').slice(0, 200)); return ce.apply(console, arguments); };
    window.addEventListener('unhandledrejection', function (e) { HATALAR.push('unhandled ' + String(e.reason && e.reason.message || e.reason)); });
    var GOVDE = [];
    window.supabaseClient.functions.invoke = function (name, opt) { var b = (opt && opt.body) || {}; AG.push('invoke:' + name + ':' + (b.action || '')); GOVDE.push([name, JSON.parse(JSON.stringify(b))]);
      return Promise.resolve({ data: b.action === 'plan' ? { plan: null, durum: 'kapali' } : {}, error: null }); };
    var f0 = window.fetch; window.fetch = function (u) { AG.push('fetch:' + String(u && u.url || u)); return f0.apply(this, arguments); };
    var xo = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u) { AG.push('xhr:' + u); return xo.apply(this, arguments); };
    var fr = window.supabaseClient.from, rp = window.supabaseClient.rpc;
    window.supabaseClient.from = function (t) { AG.push('from:' + t); return fr.apply(this, arguments); }; window.supabaseClient.rpc = function (n) { AG.push('rpc:' + n); return rp.apply(this, arguments); };
    if (navigator.sendBeacon) navigator.sendBeacon = function (u) { AG.push('beacon:' + u); return true; };
    var oneri = function () { var k = Qp('[data-oneri]'), kart = Qp('[data-oneri-kart]');
      return { durum: k.getAttribute('data-oneri-durum'), guven: k.getAttribute('data-oneri-guven'), gizli: k.hidden, al: Qp('[data-oneri-al]').disabled, not: Qp('[data-oneri-not]').textContent,
        kart: kart.hidden ? '' : kart.textContent, kullan: Array.prototype.map.call(kart.querySelectorAll('[data-oneri-kullan]'), function (b) { return b.getAttribute('data-oneri-kullan'); }),
        geri: !!kart.querySelector('[data-oneri-geri]'), sec: Qp('[data-pl-story]').value, odak: d.activeElement && d.activeElement.getAttribute ? (d.activeElement.hasAttribute('data-oneri-geri') ? 'geri' : d.activeElement.getAttribute('data-oneri-kullan') || d.activeElement.tagName) : '' }; };
    var yaz = function (t) { var i = Qp('[data-pl-topic]'); i.value = t; i.dispatchEvent(new Event('input', { bubbles: true })); };
    var ton = function (v) { Qp('input[name=pl-tone][value=' + v + ']').click(); };
    var web = function (acik) { var w = Qp('[data-pl-web]'); if (w.checked !== acik) w.click(); };
    var kaynak = function (v) { Qp('input[name=pl-src][value=' + v + ']').click(); };
    var al = function () { Qp('[data-oneri-al]').click(); };
    var kullan = function (id) { var b = Qp('[data-oneri-kart] [data-oneri-kullan="' + id + '"]'); if (!b) throw new Error('kullan düğmesi yok: ' + id + ' ' + JSON.stringify(oneri())); b.click(); };
    var elle = function (v) { var s = Qp('[data-pl-story]'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); };
    var tdk = function () { var b = Qp('[data-oneri-kart] [data-oneri-geri]'); if (!b) throw new Error('geri al yok'); b.click(); };
    var ac = async function () { var b = d.querySelector('[data-plot]'); b.click(); await bekle(400); };
    var kapat = function () { Qp('[data-pl-x]').click(); };
    var dil = function (v) { var r = Qp('input[name=pl-lang][value=' + v + ']'); if (r) r.click(); };
    var uret = async function () { GOVDE.length = 0; Qp('[data-pl-go]').click(); await bekle(1200); var g = GOVDE.filter(function (x) { return x[0] === 'sunum-research' && x[1].action === 'research'; })[0]; return g ? g[1] : null; };
    await sakin();
  `;
  const YASAK = /groq|generativelanguage|gemini|tavily|openai|anthropic|api\.|kurgu|oneri|recommend/i;
  const AKIS = ONCU + `
    var a0 = AG.length; await ac(); R.acilis = { o: oneri(), ag: AG.slice(a0), oneriInv: AG.slice(a0).filter(function (x) { return /^invoke|^fetch/.test(x); }) };
    kaynak('topic'); web(true); a0 = AG.length;
    yaz(''); R.bos = oneri(); yaz('A'); yaz('Ag'); yaz('Agile vs Waterfall'); ton('hikaye'); dil('en'); dil('tr'); R.yazma = { o: oneri(), ag: AG.slice(a0) };
    /* öner: seçici değişmez */
    var s0 = Qp('[data-pl-story]').value; a0 = AG.length; al(); al(); R.oner = { o: oneri(), once: s0, ag: AG.slice(a0) };
    /* uygula → geri al; çift tıklama tek kayıt */
    kullan('compare'); R.uygula = oneri(); tdk(); R.geri = oneri();
    kullan('compare'); kullan('problem'); R.ikiUygula = oneri(); tdk(); R.ikiGeri = oneri();
    /* beşini de gör */
    Qp('[data-oneri-hep]').click(); R.hep = { o: oneri(), exp: Qp('[data-oneri-hep]').getAttribute('aria-expanded'), li: Qp('[data-oneri-kart]').querySelectorAll('.sx-oneri-hep li').length };
    kullan('chrono'); R.hepKullan = oneri(); tdk();
    /* elle seçim korunur: uygulamadan sonra elle değiştir → geri al yok, öneri yenilense de seçim durur */
    kullan('compare'); elle('scqa'); R.elle = oneri(); al(); R.elleSonraOner = oneri();
    /* geçersiz kılma */
    elle('auto'); al(); yaz('Agile vs Waterfall '); R.bosluk = oneri(); yaz('Agile vs Scrum'); R.konu = oneri();
    var bk = Qp('[data-oneri-kart] [data-oneri-kullan]'); R.bayatKullanDugme = !!bk;
    yaz('Agile vs Waterfall'); R.geriDonus = oneri();
    al(); ton('kurumsal'); R.ton = oneri(); al(); web(false); R.webKapali = oneri(); web(true); R.webAcik = oneri();
    al(); kaynak('cards'); R.kaynakKart = oneri(); kaynak('topic'); R.kaynakGeri = oneri();
    al(); dil('en'); R.dilDegisti = oneri();
    /* bayat sonuç uygulanamaz: kullan düğmesi saklanıp girdi değişince tıklanır */
    al(); var eski = Qp('[data-oneri-kart] [data-oneri-kullan="compare"]'); var sx = Qp('[data-pl-story]').value; yaz('History of jazz'); if (eski && eski.isConnected) eski.click(); R.bayatTik = { sec: Qp('[data-pl-story]').value, once: sx, o: oneri(), bagli: !!(eski && eski.isConnected) };
    /* yeniden açma ve kapatma */
    al(); kullan('chrono'); var acikSec = Qp('[data-pl-story]').value; kapat(); await bekle(100); R.kapali = { o: oneri(), sec: Qp('[data-pl-story]').value, acikSec: acikSec };
    await ac(); R.yenidenAc = oneri();
    plot.dispatchEvent(new Event('cancel')); plot.close(); await bekle(100); await ac(); R.escSonra = oneri();
    /* axSunumPlot: otomatik çalışmaz */
    kapat(); await bekle(100); a0 = AG.length; await window.axSunumPlot({ topic: 'Kiralamak mı, satın almak mı?', n: 8, tone: 'hikaye' }); await bekle(800);
    R.plotApi = { o: oneri(), inv: AG.slice(a0).filter(function (x) { return /^invoke|^fetch/.test(x); }) };
    /* web kapalıyken üretim çalışır; öneri uygulanamaz */
    web(false); R.webOff = oneri(); R.uretOnce = AG.length; GOVDE.length = 0; Qp('[data-pl-go]').click(); await bekle(1500); R.webOffUret = GOVDE.map(function (x) { return x[0] + ':' + (x[1].action || ''); });
    kapat(); await bekle(200);
    R.tumAg = AG.slice(); R.hatalar = HATALAR;
  `;
  /* üretim gövdesi: özellik kullanılmadan (ve işaretleme hiç yokken) aynı; uygulandıktan sonra story taşınır */
  const GOVDE = ONCU + `
    await ac(); kaynak('topic'); web(true); yaz('Agile vs Waterfall'); ton('akademik');
    R.kullanilmadan = await uret(); kapat(); await bekle(200);
    await ac(); kaynak('topic'); web(true); yaz('Agile vs Waterfall'); ton('akademik'); al(); R.onerildi = await uret(); kapat(); await bekle(200);
    await ac(); kaynak('topic'); web(true); yaz('Agile vs Waterfall'); ton('akademik'); al(); kullan('compare'); R.uygulandi = await uret(); kapat(); await bekle(200);
    R.hatalar = HATALAR;
  `;
  const YOK = ONCU + `
    await ac(); kaynak('topic'); web(true); yaz('Agile vs Waterfall'); ton('akademik'); R.oneriYok = !Qp('[data-oneri]');
    R.kullanilmadan = await uret(); kapat(); await bekle(200); R.hatalar = HATALAR;
  `;
  const DAR = ONCU + `
    await ac(); kaynak('topic'); web(true); await bekle(200); var sayfa0 = d.documentElement.scrollWidth, genis = function () { var o = []; d.querySelectorAll('body *').forEach(function (e) { var r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1 && !e.closest('[data-plotdlg]')) o.push(e.tagName + '.' + String(e.className).slice(0, 40) + ':' + Math.round(r.right)); }); return o.slice(0, 6); }; yaz('Türkiye ve Almanya karşılaştırması: mesleki eğitim, çıraklık ve istihdam sonuçları'.slice(0, 80)); al(); kullan('compare');
    Qp('[data-oneri-hep]').click(); await bekle(200);
    var k = Qp('[data-oneri]'), kr = k.getBoundingClientRect(), pr = plot.getBoundingClientRect(), tasan = [];
    k.querySelectorAll('*').forEach(function (e) { var r = e.getBoundingClientRect(); if (r.width && (r.right > pr.right + 1 || r.left < pr.left - 1 || e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible')) tasan.push(e.tagName + '.' + e.className + ' ' + Math.round(r.left) + '-' + Math.round(r.right)); });
    var dug = Array.prototype.map.call(k.querySelectorAll('button'), function (b) { var r = b.getBoundingClientRect(); return [b.textContent.trim(), Math.round(r.width), Math.round(r.height)]; });
    R.dar = { en: innerWidth, sayfa0: sayfa0, disari: genis(), plotDisari: (function () { var o = []; plot.querySelectorAll('*').forEach(function (e) { var r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1) o.push(e.tagName + '.' + String(e.className).slice(0, 30)); }); return o; })(), sayfa: d.documentElement.scrollWidth, plotSW: plot.scrollWidth, plotCW: plot.clientWidth, kut: [Math.round(kr.left), Math.round(kr.right)], plot: [Math.round(pr.left), Math.round(pr.right)], tasan: tasan, dug: dug,
      hamTasma: k.scrollWidth - k.clientWidth };
    R.hatalar = HATALAR;
  `;
  const kosSahne = async (ad, govde, gen, html) => {
    const H = yeniSunucu({ senkron: true }); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r));
    try { let h = sayfa('ok', H.srv.address().port, 0, govde); if (html) h = html(h); return await kosK('k41-' + ad + '.html', 'k41-' + ad, h, gen); } finally { H.srv.close(); }
  };
  const isaretsiz = (h) => { const a = h.indexOf('<div class="sx-oneri" data-srcf="topic" data-oneri'), b = h.indexOf('</div>\n</div>\n', a); assert.ok(a > 0 && b > a, 'işaretleme kesilemedi'); return h.slice(0, a) + h.slice(b + '</div>\n</div>\n'.length); };
  let A, G, Y, N;
  try { [A, G, Y, N] = await Promise.all([kosSahne('akis', AKIS), kosSahne('govde', GOVDE), kosSahne('yok', YOK, 1280, isaretsiz), kosSahne('dar', DAR, 500)]); } catch (e) { A = G = Y = N = { hata: String(e && e.stack || e) }; }
  const ozet = (x) => JSON.stringify(x).slice(0, 600);

  test('D1 ağ yalıtımı: açılış, yazma, anlatım/dil değişimi ve öneri/uygula/geri al sıfır istek; hiçbir yerde model/arama adresi yok', () => {
    assert.ok(!A.hata, A.hata);
    assert.deepEqual(A.acilis.oneriInv, [], 'açılışta invoke/fetch: ' + ozet(A.acilis.ag));
    assert.ok(A.acilis.ag.every((x) => /^(from|rpc|xhr):/.test(x)), 'açılışta yalnız var olan kart/belge okuması olmalı: ' + ozet(A.acilis.ag));
    assert.deepEqual(A.yazma.ag, [], 'yazma/ton/dil sırasında istek'); assert.deepEqual(A.oner.ag, [], 'öneri isteği');
    assert.deepEqual(A.plotApi.inv, [], 'axSunumPlot invoke/fetch');
    const yasak = A.tumAg.filter((x) => YASAK.test(x.replace(/^xhr:http:\/\/127\.0\.0\.1:\d+\/$/, 'yerel')));
    assert.deepEqual(yasak, [], 'yasak adres/işlev');
    assert.deepEqual(A.tumAg.slice(0, A.uretOnce).filter((x) => /^(invoke|fetch|beacon):/.test(x)), [], 'üretim düğmesinden önce invoke/fetch');
    assert.ok(A.tumAg.slice(A.uretOnce).some((x) => /^invoke:/.test(x)), 'üretim çağrısı görülmedi (casus çalışmıyor olabilir)');
    assert.deepEqual(A.hatalar, []);
  });

  test('D2 öner seçiciyi değiştirmez; uygula değiştirir, geri al geri getirir; iki uygulamada geri al ilk değere döner; odak yönetimi', () => {
    assert.ok(!A.hata, A.hata);
    assert.equal(A.oner.o.durum, 'tamam', ozet(A.oner)); assert.equal(A.oner.o.guven, 'clear'); assert.equal(A.oner.o.sec, A.oner.once); assert.equal(A.oner.once, 'auto');
    assert.match(A.oner.o.kart, /Önerim:\s*karşılaştırma \(A mı, B mi\?\)/); assert.match(A.oner.o.kart, /işaret:\s*vs/); assert.match(A.oner.o.kart, /alternatif:/); assert.ok(!/%|\d+\s*puan/.test(A.oner.o.kart));
    assert.equal(A.uygula.sec, 'compare'); assert.ok(A.uygula.geri); assert.match(A.uygula.kart, /✓ kullanılıyor:\s*karşılaştırma/); assert.match(A.uygula.kart, /bu kurgu zaten seçili/); assert.equal(A.uygula.odak, 'geri');
    assert.equal(A.geri.sec, 'auto'); assert.equal(A.geri.geri, false); assert.equal(A.geri.odak, 'compare');
    assert.equal(A.ikiUygula.sec, 'problem'); assert.equal(A.ikiGeri.sec, 'auto', 'tek düzey: ilk uygulamadan önceki değer');
    assert.equal(A.hep.exp, 'true'); assert.equal(A.hep.li, 5); assert.equal(A.hepKullan.sec, 'chrono');
  });

  test('D3 elle seçim hiçbir zaman ezilmez: uygulamadan sonra elle değişiklik geri al\'ı kaldırır; yeni öneri seçiciye dokunmaz', () => {
    assert.ok(!A.hata, A.hata);
    assert.equal(A.elle.sec, 'scqa'); assert.equal(A.elle.geri, false); assert.ok(!/kullanılıyor/.test(A.elle.kart));
    assert.equal(A.elleSonraOner.sec, 'scqa'); assert.equal(A.elleSonraOner.durum, 'tamam');
  });

  test('D4 geçersiz kılma: konu, anlatım, web ve kaynak değişince eski sonuç gösterilmez; bayat sonuç uygulanamaz; dil anahtarda değil', () => {
    assert.ok(!A.hata, A.hata);
    assert.equal(A.bosluk.durum, 'tamam', 'yalnız sondaki boşluk: aynı anahtar');
    for (const k of ['konu', 'ton']) { assert.equal(A[k].durum, 'bayat', k + ' ' + ozet(A[k])); assert.match(A[k].kart, /önceki öneri bu girdi için geçerli değil/); assert.ok(!/Önerim/.test(A[k].kart)); assert.deepEqual(A[k].kullan, []); }
    assert.equal(A.bayatKullanDugme, false); assert.equal(A.geriDonus.durum, 'bayat', 'eski konuya dönmek bayat sonucu canlandırmaz');
    assert.equal(A.webKapali.durum, 'kapali'); assert.equal(A.webKapali.al, true); assert.equal(A.webKapali.kart, ''); assert.match(A.webKapali.not, /Web araştırması kapalıyken kurgu iskeleti uygulanmaz/);
    assert.equal(A.webAcik.durum, 'hazir', 'web yeniden açılınca eski sonuç geri gelmez');
    assert.equal(A.kaynakKart.gizli, true); assert.equal(A.kaynakKart.durum, 'gizli'); assert.equal(A.kaynakGeri.durum, 'hazir', 'kaynak değişimi sıfırlar');
    assert.equal(A.dilDegisti.durum, 'tamam', 'dil anahtarda değil');
    assert.equal(A.bayatTik.sec, A.bayatTik.once, 'bayat düğme seçiciyi değiştirdi: ' + ozet(A.bayatTik)); assert.equal(A.bayatTik.o.durum, 'bayat');
    assert.equal(A.bos.durum, 'bos'); assert.equal(A.bos.al, true); assert.equal(A.bos.not, 'önce bir konu yaz');
  });

  test('D5 yaşam döngüsü: kapatma ve Esc geçersiz kılar, yeniden açılışta öneri yok; açılış ve axSunumPlot çalıştırmaz; uygulanan seçim kalır', () => {
    assert.ok(!A.hata, A.hata);
    assert.equal(A.acilis.o.durum === 'tamam' || A.acilis.o.kart !== '', false, ozet(A.acilis.o));
    assert.equal(A.kapali.sec, 'chrono'); assert.equal(A.kapali.acikSec, 'chrono');
    for (const k of ['yenidenAc', 'escSonra']) { assert.notEqual(A[k].durum, 'tamam', k); assert.equal(A[k].kart, '', k); assert.equal(A[k].geri, false, k); }
    assert.equal(A.plotApi.o.durum, 'hazir', 'axSunumPlot öneri çalıştırdı: ' + ozet(A.plotApi.o)); assert.equal(A.plotApi.o.kart, '');
    assert.equal(A.webOff.durum, 'kapali'); assert.ok(A.webOffUret.length > 0, 'web kapalıyken üretim çalışmadı'); assert.ok(!A.webOffUret.some((x) => /^sunum-research:research/.test(x)), ozet(A.webOffUret));
  });

  test('D6 üretim gövdesi: özellik kullanılmadan ve işaretleme yokken aynı; yalnız öneri almak gövdeyi değiştirmez; uygulamadan sonra story var olan yoldan gider', () => {
    assert.ok(!G.hata, G.hata); assert.ok(!Y.hata, Y.hata); assert.equal(Y.oneriYok, true);
    assert.ok(G.kullanilmadan && Y.kullanilmadan, ozet([G, Y]));
    assert.deepEqual(G.kullanilmadan, Y.kullanilmadan); assert.deepEqual(G.onerildi, G.kullanilmadan);
    assert.equal(G.kullanilmadan.story, 'auto'); assert.equal(G.uygulandi.story, 'compare');
    const { story: s1, ...g1 } = G.uygulandi, { story: s0, ...g0 } = G.kullanilmadan; assert.deepEqual(g1, g0, 'story dışında alan değişti');
    assert.deepEqual(G.hatalar, []); assert.deepEqual(Y.hatalar, []);
  });

  test('D7 500 px: yatay taşma yok; tüm düğmeler ≥44 px dokunma hedefi', () => {
    assert.ok(!N.hata, N.hata); const r = N.dar, j = ozet(r);
    assert.ok(r.en <= 520, j); assert.deepEqual(r.plotDisari, [], 'pencere içinden ekran dışına taşan: ' + j);
    assert.ok(r.sayfa <= Math.max(r.en, r.sayfa0), 'öneri sayfa genişliğini artırdı: ' + j); assert.ok(r.plotSW <= r.plotCW + 1, 'pencere taşıyor: ' + j);
    assert.deepEqual(r.tasan, [], j); assert.ok(r.hamTasma <= 1, j); assert.ok(r.kut[1] <= r.plot[1], j);
    assert.ok(r.dug.length >= 5, j); for (const [ad, w, h] of r.dug) { assert.ok(h >= 44, ad + ' yükseklik ' + h); assert.ok(w >= 44, ad + ' genişlik ' + w); }
    assert.deepEqual(N.hatalar, []);
  });

  temizle(); summary();
})();
