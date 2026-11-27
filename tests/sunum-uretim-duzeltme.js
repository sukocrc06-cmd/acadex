/* ==========================================================================
   SUNUM — #38: ÜRETİM KALİTESİ DÜZELTMELERİ VE ÖNERİ PANELİ YAŞAM DÖNGÜSÜ (27.11.2026)
   Kaynak: ACADEX-QA-TRANSFER #37 (gerçek sunum denetimi) ve #38 (düzeltme).

   Sorunlar:
     P0  araştırma 429/502/zaman aşımıyla düşünce eski motor sessizce çağrılıyor, deste kaynaksız çıkıyordu
     P0  İngilizce destede Türkçe büyük harf ("İt", "İmmune") ve Türkçe bölüm adı (kapak)
     P1  istenen sayfa sayısı son PPTX'in toplamı değildi (kaynakça + gündem sonradan ekleniyordu: 10 → 11–12)
     P1  öneri paneli: geç gelen eski çalıştırma yeniyi eziyor, iptal/hatada eski öneri kalıyor, liste bitmeden öneri
     P1  deterministik denetim: sayı (iki yön), meta yazı, yerel ayar, kaynaksız araştırma, atıf eşlemesi
     P1  repeated_facts %72/%73/%69'u kaçırıyordu (iki basamaklı yüzde ve grafik değerleri sayılmıyordu)
     P1  İngilizce deste + Türkçe konu: ilk derin sorgu Türkçe konunun kendisiydi
     P2  PPTX'e çözülmemiş TEXT_OVERFLOW ile uyarısız çıkılıyordu

   A: kaynak kuralları · B: saf işlevler (acadex-ink.js'ten kesilerek) · C: yönetmen/araştırma (gerçek kaynaktan
   çıkarım) · D: tarayıcı (başsız Chrome, sahte hesap, sahte invoke; ağ ve model çağrısı yok).
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { makeRunner, loadFromSource } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const cut = (a, b) => { const i = ink.indexOf(a); assert.ok(i >= 0, 'bulunamadı: ' + a); const j = ink.indexOf(b, i + a.length); assert.ok(j > i, 'son bulunamadı: ' + b); return ink.slice(i, j); };
const arr = (x) => (Array.isArray(x) ? x : []);

/* ------------------------------ A: kaynak ------------------------------ */
test('A1 P0: araştırma düşünce eski motor kendiliğinden çağrılmaz; yalnız o.legacy (açık seçim) ya da web kapalı', () => {
  const m0 = cut('  var makeOutline0 = function (o) {', '  var legacyTopic = function');
  const red = m0.slice(m0.indexOf('return research.then('));
  assert.match(red, /if \(!web\) return legacyTopic\(tp, o, title\);/);
  assert.match(red, /return \{ hata: hataTuru\(e\) \};/);
  assert.equal((m0.match(/legacyTopic\(/g) || []).length, 2, 'eski motor yalnız iki yerde: açık seçim + web kapalı');
  assert.match(m0, /if \(o\.legacy\) \{ plotMeta\.webFail = true; plotMeta\.secim = 1; return legacyTopic/);
  assert.ok(!/setInterval|setTimeout\([^)]*makeOutline|retry\s*\(/.test(m0), 'otomatik yeniden deneme döngüsü');
});

test('A2 P1: çalıştırma numarası ve künye — geç gelen eski sonuç atılır, plotMeta yalnız güncel çalıştırmada kurulur', () => {
  const mo = cut('  var makeOutline = function (o) {', '  var buildOutline = function');
  assert.match(mo, /var my = \+\+outlineNo; o\.pm = \{\};/);
  assert.equal((mo.match(/if \(my !== outlineNo\) return null;/g) || []).length, 2);
  assert.equal((mo.match(/plotMetaKur\(plotMeta\)/g) || []).length, 2);
  const ss = cut('  var showStrips = function (p) {', '  var stripHTML = function');
  assert.match(ss, /var run = \+\+plotRun; step\(2\); plotHazir = false; strips = \[\]; akisTemizle\(\);/);
  assert.ok(ss.indexOf('plotHazir = true; paintStrips(true)') > ss.indexOf("help.textContent = bas0"), 'öneriler liste ve yardım yazısından sonra');
  assert.match(cut('  var paintFlow = function () {', '\n  };\n'), /if \(!plotHazir\) \{ flowList = \[\]; flowEl\.hidden = true; flowEl\.innerHTML = ''; return; \}/);
  assert.match(ink, /var plotBirak = function \(\) \{ plotRun\+\+; outlineNo\+\+; plotHazir = false; akisTemizle\(\); \};/);
  assert.match(ink, /plot\.addEventListener\('cancel', plotBirak\); plot\.addEventListener\('close', plotBirak\);/);
  assert.equal((ink.match(/function \(\) \{ plotBirak\(\); plot\.close\(\); \}/g) || []).length, 2, 'vazgeç ve kapat eşzamanlı geçersizleştirir (close olayı sonraki görevde)');
  const ff = cut('  var flowFix = function (it) {', '  var paintFlow = function');
  assert.match(ff, /var r0 = plotRun/); assert.match(ff, /if \(r0 !== plotRun\) return;/);
});

test('A3 P0: İngilizce kapak Türkçe bölüm adı taşımaz; ilk harf deste dilinde büyür; dil kayıtta ve açılışta korunur', () => {
  assert.match(ink, /if \(lang === 'en'\) return window\.AX_BOLUM && window\.AX_BOLUM\.valid\(p\.department\) \? String\(p\.department\) : '';/);
  assert.ok(!/toLocaleUpperCase\('tr'\) \+ [a-z]+\.slice\(1\)/.test(cut('  var VARY = ', '\n  };\n')), "VARY'de sabit tr büyütme kaldı");
  assert.match(ink, /if \(d\.lang\) m\.lang = d\.lang;/);
  assert.match(ink, /'quality_report,source_type,source_id,language'/);
  assert.match(ink, /if \(mode !== 'append' && plotMeta\.lang\) deck\.lang = plotMeta\.lang;/);
});

test('A4 P2: PPTX öncesi çözülmemiş taşma uyarısı — liste + git bağlantısı, silme yok, ikinci basışta devam', () => {
  const ex = cut('  var exportPptx = async function', '\n  };\n');
  assert.match(ex, /exportPptx\._izin !== ak/); assert.match(ex, /'#sx-tasma'/);
  assert.ok(!/splice|\.text\s*=|settle\(/.test(ex.slice(ex.indexOf('tasmaGit'), ex.indexOf('exportPptx._izin = ak') + 200)), 'uyarı bloğu desteyi değiştiriyor');
});

/* ------------------------------ B: saf işlevler ------------------------------ */
const SAYI = Function('arr', cut('  var hataTuru = function (e) {', '  var outlineNo = 0') + '\nreturn { hataTuru: hataTuru, sayiAyarla: sayiAyarla };')(arr);
const ICERIK = Function('arr', cut('  var META_RE = ', '  /* A + C + E') + '\nreturn { teknikIcerik: teknikIcerik, localeHata: localeHata };')(arr);

test('B1 hata türü: 429 → kota, 502/500 → sunucu, 504/zaman aşımı → zaman, ağ → ag', () => {
  const H = SAYI.hataTuru, http = (st) => ({ name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: { status: st } });
  assert.equal(H(http(429)), 'kota'); assert.equal(H(http(502)), 'sunucu'); assert.equal(H(http(500)), 'sunucu'); assert.equal(H(http(504)), 'zaman');
  assert.equal(H(new Error('zaman aşımı')), 'zaman'); assert.equal(H({ name: 'FunctionsFetchError', message: 'Failed to send a request' }), 'ag'); assert.equal(H(new Error('x')), 'diger');
});

const govdeOf = (n, gundem) => [{ t: 'Kapak', k: 'cover' }].concat(gundem ? [{ t: 'Agenda', k: 'list' }] : []).concat(Array.from({ length: n }, (_, i) => ({ t: 'Bölüm ' + (i + 1), k: 'list', src: ['s' + (i % 3 + 1)] }))).concat([{ t: 'Sonuç', k: 'list' }, { t: 'Teşekkürler', k: 'end' }]);
const sonToplam = (out, pm, ek) => out.length + ek + pm.gundem;

test('B2 P1 kesin sayı: 10→10 ve 12→12; kaynakçalı (araştırma) ve kaynakçasız (eski motor); kapak + gündem + kaynakça + kapanış dahil; sonuç asetatı korunur', () => {
  for (const n of [10, 12]) for (const ek of [1, 0]) for (const gd of [false, true]) {
    const out = govdeOf(n, gd), pm = {}; SAYI.sayiAyarla(out, n, pm, ek);
    assert.equal(sonToplam(out, pm, ek), n, `n=${n} ek=${ek} gündem=${gd}: ${JSON.stringify(pm.sayi)}`);
    assert.equal(pm.sayi.toplam, n); assert.equal(pm.sayi.eksik, 0); assert.equal(pm.sayi.imkansiz, 0); assert.equal(pm.sayi.serit, out.length + ek);
    assert.equal(out[out.length - 2].t, 'Sonuç', 'sonuç asetatı atıldı'); assert.equal(out[0].k, 'cover'); assert.equal(out[out.length - 1].k, 'end');
    assert.equal(pm.gundem, gd ? 0 : 1, 'gündem zaten varsa ikinci gündem eklenmez');
  }
});

test('B3 P1 eksik ve imkânsız sayı söylenir, uydurma asetatla doldurulmaz', () => {
  const out = govdeOf(2), pm = {}; SAYI.sayiAyarla(out, 10, pm, 1);
  assert.equal(out.length, 5, 'asetat eklendi'); assert.deepEqual([pm.sayi.toplam, pm.sayi.eksik, pm.sayi.imkansiz, pm.gundem], [6, 4, 0, 0]);
  const o2 = govdeOf(4), p2 = {}; SAYI.sayiAyarla(o2, 2, p2, 1);
  assert.equal(p2.sayi.imkansiz, 1, 'kapak + kaynakça + kapanış 2 sayfaya sığmaz'); assert.ok(p2.sayi.toplam > 2);
});

const sl = (id, lay, ...texts) => ({ id, lay, els: texts.map((t, i) => ({ id: id + 'e' + i, type: 't', text: t })) });
const kos = (d, yol, uret) => { const out = []; ICERIK.teknikIcerik(d, d.slides, yol, uret || {}, (c, sev, n, el) => out.push(c + '@' + n)); return out; };
const kodlar = (x) => [...new Set(x.map((k) => k.split('@')[0]))].sort();

test('B4 P1 sayı denetimi iki yönde: fazla → SLIDE_COUNT_OVER, eksik → SLIDE_COUNT_UNDER; kullanıcının sildiği asetat eksik sayılmaz; kesin sayısız eski kayıtta ölçülmez', () => {
  const deste = (n) => ({ lang: 'tr', slides: Array.from({ length: n }, (_, i) => sl('a' + i, i ? 'list' : 'cover', 'Metin ' + i)) });
  const uret = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => ['a' + i, 1])), ids = (n) => Array.from({ length: n }, (_, i) => 'a' + i);
  assert.deepEqual(kodlar(kos(deste(11), { tam: 1, istek: 10, uret: ids(11) }, uret(11))), ['SLIDE_COUNT_OVER']);
  assert.deepEqual(kodlar(kos(deste(9), { tam: 1, istek: 10, uret: ids(9) }, uret(9))), ['SLIDE_COUNT_UNDER']);
  assert.deepEqual(kos(deste(9), { tam: 1, istek: 10, uret: ids(10) }, uret(10)), [], 'kullanıcı bir asetat sildi');
  assert.deepEqual(kos(deste(10), { tam: 1, istek: 10, uret: ids(10) }, uret(10)), []);
  assert.deepEqual(kos(deste(12), { istek: 10, uret: ids(12) }, uret(12)), [], 'tam yoksa (eski kayıt) ölçülmez');
  const d = deste(10); d.slides.push(sl('el', 'list', 'Elle eklenen')); assert.deepEqual(kos(d, { tam: 1, istek: 10, uret: ids(10) }, uret(10)), [], 'elle eklenen sayılmaz');
});

test('B5 P0 yerel ayar: İngilizce destede "İt", "İmmune", "INTEGRATİNG" işaretlenir; İstanbul, İnönü, İzmir, EDİRNE, TÜRKİYE, İTÜ işaretlenmez; Türkçe destede hiç', () => {
  const L = ICERIK.localeHata;
  ['İt', 'İts', 'İmmune', 'İntegrating', 'İnto', 'İnformation', 'INTEGRATİNG', 'TEACHİNG', 'İNTERNATİONAL', 'İT'].forEach((w) => assert.equal(L(w), true, w));
  ['İstanbul', 'İnönü', 'İzmir', 'İzmit', 'EDİRNE', 'TÜRKİYE', 'İTÜ', 'İSTANBUL', 'İl', 'İsmail', 'Immune', 'It', 'Ankara'].forEach((w) => assert.equal(L(w), false, w));
  const en = { lang: 'en', slides: [sl('c', 'cover', 'İntegrating AI into Teaching'), sl('b', 'list', 'İt supports feedback\nİmmune responses as an analogy'), sl('t', 'list', 'Study at İstanbul University, EDİRNE campus, İnönü')] };
  assert.deepEqual(kos(en, null), ['LOCALE_CASE@1', 'LOCALE_CASE@2']);
  assert.deepEqual(kos(Object.assign({}, en, { lang: 'tr' }), null), [], 'Türkçe destede yerel ayar kuralı çalışmaz');
});

test('B6 P1 meta yazı: model/şablon kalıbı işaretlenir, olağan cümle işaretlenmez', () => {
  const d = { lang: 'en', slides: [sl('a', 'list', 'As an AI, I cannot verify this'), sl('b', 'list', 'Lorem ipsum dolor'), sl('c', 'list', 'Bu asetatta şunları göreceğiz'), sl('d', 'list', 'AI tutors raise exam scores in two studies'), sl('e', 'list', 'The slide rule was replaced by calculators')] };
  assert.deepEqual(kos(d, null), ['META_TEXT@1', 'META_TEXT@2', 'META_TEXT@3']);
});

test('B7 P1 sıfır kaynak temiz geçmez: kaynaksız araştırma → NO_SOURCES; kaynaklı ya da araştırma dışı yol → yok', () => {
  const d = { lang: 'tr', slides: [sl('a', 'list', 'Metin')] };
  assert.deepEqual(kos(d, { k: 'research', kaynak: 0 }), ['NO_SOURCES@null']);
  assert.deepEqual(kos(d, { k: 'research' }), ['NO_SOURCES@null']);
  assert.deepEqual(kos(d, { k: 'research', kaynak: 3 }), []);
  assert.deepEqual(kos(d, { k: 'legacy', kaynak: 0 }), []);
});

test('B8 P1 atıf: kaynakçada olmayan numara, kullanılmayan kaynak, biçim bozukluğu; aralık [1–3] eşlenir; kaynakçasız elle destede "[1, 2, 3]" atıf sayılmaz', () => {
  const refs = sl('r', 'refs', '[1] Yılmaz, A. (2023). Kentsel ısı. İstanbul Üniversitesi.\n[2] Öztürk, Ş. (2022). Şehir iklimi.\n[3] Çelik, Ğ. (2021). Gölge.');
  const yol = { k: 'research', kaynak: 3 };
  assert.deepEqual(kos({ lang: 'tr', slides: [sl('a', 'list', 'Isı %72 arttı [1]'), sl('b', 'list', 'Gölge [2, 3]'), refs] }, yol), []);
  assert.deepEqual(kos({ lang: 'tr', slides: [sl('a', 'list', 'Isı [1–3]'), refs] }, yol), [], 'aralık');
  assert.deepEqual(kos({ lang: 'tr', slides: [sl('a', 'list', 'Isı [1, 4]'), sl('b', 'list', 'Gölge [2]'), refs] }, yol), ['CITE_UNMAPPED@1', 'REF_UNUSED@3']);
  assert.deepEqual(kodlar(kos({ lang: 'tr', slides: [sl('a', 'list', 'Isı [1,] ve [ ] ve [0]'), sl('b', 'list', '[2] [3]'), refs] }, yol)), ['CITE_FORMAT', 'REF_UNUSED']);
  assert.deepEqual(kos({ lang: 'tr', slides: [sl('a', 'list', 'Dizi [1, 2, 3] örneği')] }, null), [], 'elle deste, kaynakça yok');
  assert.deepEqual(kos({ lang: 'tr', slides: [sl('a', 'list', 'Isı [1]')] }, { k: 'legacy' }), ['CITE_UNMAPPED@1'], 'üretilmiş destede kaynakçasız atıf');
});

/* ------------------------------ C: yönetmen ve araştırma ------------------------------ */
test('C1 P1 repeated_facts: %72/%73/%69 artık yakalanır (iki basamaklı yüzde + grafik değerleri); yıl ve küçük tam sayı yine yineleme değil', () => {
  const D = loadFromSource('supabase/functions/acadia-presentation-director/index.ts', ['cleanText', 'words', 'repeatedFacts']);
  assert.equal(D.repeatedFacts(['2023 yılında 12 ülke', '2023 yılında 12 şirket']), 0);
  assert.equal(D.repeatedFacts(['Öğretmenlerin %72’si yapay zekâ kullanıyor', 'Katılımcıların %72 oranı']), 1, 'iki basamaklı yüzde');
  assert.equal(D.repeatedFacts(['Kullanım %73 düzeyinde', 'Kullanım oranları'], [[], [72, 73, 69]]), 1, 'metindeki %73 ve grafikteki 73');
  assert.equal(D.repeatedFacts(['Grafik A', 'Grafik B'], [[72, 73, 69], [72, 73, 69]]), 3, 'aynı grafik iki asetatta');
  assert.equal(D.repeatedFacts(['a', 'b'], [[2019, 2020, 5], [2019, 2020, 5]]), 0, 'yıl ve tek basamak sayılmaz');
  const dir = read('supabase/functions/acadia-presentation-director/index.ts');
  assert.match(dir, /const rb = body\.slice\(0, -1\)/, 'sonuç asetatı yine yinelemeden muaf');
});

test('C2 P1 Türkçe konu + İngilizce deste: ilk sorgu planlayıcının İngilizce sorgusu (ek çağrı yok); İngilizce konu ve Türkçe deste değişmez', () => {
  const src = read('supabase/functions/sunum-research/index.ts'), { dilDisi } = loadFromSource('supabase/functions/sunum-research/index.ts', ['dilDisi']);
  const a = src.match(/ {8}const trKonu = [^\n]+\n {8}const ilk = [^\n]+/); assert.ok(a, 'trKonu/ilk satırları');
  const f = Function('lang', 'topic', 'qs', 'pq', 'dilDisi', a[0] + '\nreturn { trKonu: trKonu, ilk: ilk };');
  const pq = { en: 'integrating artificial intelligence into teaching' };
  assert.deepEqual(f('en', 'Yapay zekânın öğretime entegrasyonu', ['AI in teaching evidence', 'x'], pq, dilDisi), { trKonu: true, ilk: 'AI in teaching evidence' });
  assert.deepEqual(f('en', 'Eğitimde yapay zeka ve etkileri', [], pq, dilDisi), { trKonu: true, ilk: pq.en }, 'q yoksa en');
  assert.equal(f('en', 'Eğitimde yapay zeka ve etkileri', [], {}, dilDisi).ilk, 'Eğitimde yapay zeka ve etkileri', 'planlayıcı düştüyse konu');
  assert.deepEqual(f('en', 'Integrating AI into Teaching', ['q1'], pq, dilDisi), { trKonu: false, ilk: 'Integrating AI into Teaching' });
  assert.deepEqual(f('tr', 'Yapay zekânın öğretime entegrasyonu', ['q1'], pq, dilDisi), { trKonu: false, ilk: 'Yapay zekânın öğretime entegrasyonu' });
  assert.ok(!/blacklist|engelli_alan|blockedDomains/i.test(a[0]), 'alan adı kara listesi yok');
});

/* ------------------------------ D: tarayıcı ------------------------------ */
const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');
if (!CHROME) {
  console.log('  ATLANDI  D1–D4 (başsız Chrome: 429/502, tekrar dene, geç gelen sonuç, iptal, kesin sayı, PPTX, İngilizce): Chrome bulunamadı. Bu testler GEÇTİ sayılmadı.');
  summary();
} else (async () => {
  const { W, sayfa, temizle } = duzenek();
  const KANCA = '  window.__U = { pm: function () { return plotMeta; }, strips: function () { return strips; }, qa: teknikQA, renderAll: renderAll, snapHazir: snapHazir };\n';
  const uSayfa = (port, govde) => { const h = sayfa('ok', port, 0, govde); assert.equal(h.split('  window.__S = { set:').length, 2); return h.replace('  window.__S = { set:', () => KANCA + '  window.__S = { set:'); };
  const kosU = (dosya, prof, icerik) => new Promise((res, rej) => {
    fs.writeFileSync(path.join(W, dosya), icerik);
    execFile(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1280,900', '--user-data-dir=' + path.join(W, 'prof-' + prof), '--allow-file-access-from-files', '--virtual-time-budget=240000', '--dump-dom', pathToFileURL(path.join(W, dosya)).href], { maxBuffer: 64 << 20, timeout: 300000 }, (e, out) => {
      if (e) return rej(e); const m = String(out).match(/<pre id="diag">([\s\S]*?)<\/pre>/); if (!m) return rej(new Error(dosya + ': diag yok'));
      res(JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&')));
    });
  });
  /* ortak: sahte invoke (çağrı günlüğü), sahte PptxGenJS (yazı + asetat sayısı), panel durumu */
  const ONCU = (profil) => `
    window.currentUserProfile = ${JSON.stringify(profil)};
    var LOG = window.__inv = [], CEVAP = {}, HATALAR = []; var Qp = function (s) { return d.querySelector('[data-plotdlg] ' + s); };
    var ce = console.error; console.error = function () { HATALAR.push(Array.prototype.slice.call(arguments).map(String).join(' ').slice(0, 200)); return ce.apply(console, arguments); };
    window.addEventListener('unhandledrejection', function (e) { HATALAR.push('unhandled ' + String(e.reason && e.reason.message || e.reason)); });
    window.supabaseClient.functions.invoke = function (name, opt) { var b = (opt && opt.body) || {}; LOG.push(name + ':' + (b.action || '') + ':' + (b.topic || ''));
      var f = CEVAP[name + ':' + (b.action || '')] || CEVAP[name]; return f ? f(b) : Promise.resolve({ data: b.action === 'plan' ? { plan: null, durum: 'kapali' } : {} }); };
    var httpHata = function (st) { return function () { return Promise.resolve({ data: null, error: { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: { status: st } } }); }; };
    var gec = function (ms, x) { return new Promise(function (r) { setTimeout(function () { r({ data: x, error: null }); }, ms); }); };
    var KAYNAK = [{ id: 's1', apa: 'Yılmaz, A. (2023). Kentsel ısı adası. İstanbul Üniversitesi Yayınları.', url: 'https://example.org/1' },
      { id: 's2', apa: 'Öztürk, Ş., & Çelik, Ğ. (2022). Şehir iklimi ve gölge. Ankara: Deneme Yayınevi.', url: 'https://example.org/2' },
      { id: 's3', apa: 'İnönü, E. (2021). Kent ölçümleri. EDİRNE: Örnek Basım.', url: 'https://example.org/3' }];
    var arastirma = function (konu, n, kaynak, madde) { return { title: konu, sources: kaynak ? KAYNAK : [], engine: { queries: 3, web: kaynak ? 3 : 0, wiki: 0 },
      slides: Array.from({ length: n }, function (_, i) { return { kind: 'list', title: konu + ' — ' + (i + 1) + '. bölüm', bullets: madde(i), notes: 'Konuşma notu ' + (i + 1) + ': bu bölümü örnekle anlat ve bir sonrakine bağla.', src: kaynak ? ['s' + (i % 3 + 1)] : [] }; }) }; };
    var trMadde = function (i) { return ['Asfalt yüzeyler gündüz ısıyı depolayıp gece salıyor (' + (i + 1) + ')', 'Ağaçlandırma yüzey sıcaklığını belirgin biçimde düşürüyor', 'Ölçüm olmadan yatırım önceliklendirilemiyor']; };
    var panel = function () { var f = Qp('[data-flow]'), h = Qp('[data-plhelp]'); return { help: h.hidden ? '' : h.textContent, retry: !!Qp('[data-pl-retry]'), legacy: !!Qp('[data-pl-legacy]'), ack: !!Qp('[data-pl-ack]'),
      ok: Qp('[data-pl-ok]').disabled, seritler: Qp('[data-strips]').children.length, basliklar: window.__U.strips().map(function (s) { return s.t; }), flowGizli: f.hidden, flowHTML: f.innerHTML,
      konu: Qp('[data-pl-topic]').value, n: Qp('[data-pl-n]').value, inv: LOG.slice() }; };
    var PPTX = [], ADD = 0; var vekil = function (ad) { return new Proxy(function () {}, { get: function (t, k) { if (k === 'then') return undefined; return vekil(ad + '.' + String(k)); }, apply: function (t, s, a) { PPTX.push([ad, JSON.parse(JSON.stringify(a))]); return vekil(ad + '()'); }, set: function () { return true; } }); };
    window.PptxGenJS = function () { var o = { ShapeType: new Proxy({}, { get: function (t, k) { return 'shape:' + String(k); } }), ChartType: new Proxy({}, { get: function (t, k) { return 'chart:' + String(k); } }),
      addSlide: function () { ADD++; return vekil('slide'); }, writeFile: function () { PPTX.push(['writeFile']); return Promise.resolve(); } }; return o; };
    var toasts = []; new MutationObserver(function () { var t = (d.querySelector('[data-toast-t]') || {}).textContent || ''; if (t && toasts[toasts.length - 1] !== t) toasts.push(t); }).observe(d.body, { subtree: true, childList: true, characterData: true });
    var pptxAl = async function () { d.querySelector('[data-pptx]').click(); await bekle(2500); var uyari = 0; if (!PPTX.some(function (x) { return x[0] === 'writeFile'; })) { uyari = 1; d.querySelector('[data-pptx]').click(); await bekle(2500); }
      return { asetat: ADD, yazildi: PPTX.some(function (x) { return x[0] === 'writeFile'; }), uyari: uyari, metin: JSON.stringify(PPTX) }; };
    var desteMetin = function () { return S.deck().slides.map(function (s) { return s.els.filter(function (e) { return e.text; }).map(function (e) { return e.text; }).join(' / '); }); };
    var ac = async function (konu, n, dil) { await window.axSunumPlot({ topic: konu, n: n }); var wb = Qp('[data-pl-web]'); if (wb) wb.checked = true;
      if (dil) { var r = Qp('input[name=pl-lang][value=' + dil + ']'); if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } } await bekle(200); };
    await sakin(); S.temaSec(TEMA); await sakin();      /* yerel yazılı şablon: yazı doğrulanır, geometri ölçülür */
  `;
  const TR = ONCU({ department: 'Kamu Yönetimi (elle yazılmış)', full_name: 'Deneme Öğrenci' }) + `
    await ac('Kentsel ısı adası', 10, 'tr');
    CEVAP['sunum-research'] = httpHata(429); Qp('[data-pl-go]').click(); await bekle(1500); R.k429 = panel();
    LOG.length = 0; CEVAP['sunum-research'] = httpHata(502); Qp('[data-pl-retry]').click(); await bekle(1500); R.k502 = panel();
    LOG.length = 0; CEVAP['sunum-research'] = function (b) { return gec(3000, arastirma(b.topic, 10, 1, trMadde)); };
    Qp('[data-pl-retry]').click(); await bekle(500); R.bekler = panel(); await bekle(4000); R.basari = panel(); R.basariSayi = window.__U.pm().sayi;
    /* A geç, B hızlı: A'nın sonucu B'yi ezmemeli */
    LOG.length = 0; CEVAP['sunum-research'] = function (b) { return /^Kentsel/.test(b.topic) ? gec(4000, arastirma(b.topic, 10, 1, trMadde)) : gec(300, arastirma(b.topic, 10, 1, trMadde)); };
    Qp('[data-pl-go]').click(); await bekle(300); Qp('[data-pl-topic]').value = 'Sürdürülebilir ulaşım'; Qp('[data-pl-go]').click();
    await bekle(1500); R.B1 = panel(); await bekle(4500); R.B2 = panel(); R.B2pm = { title: window.__U.pm().title, kaynak: (window.__U.pm().sources || []).length, sayi: window.__U.pm().sayi, gundem: window.__U.pm().gundem };
    /* B basılır: 10 istendi → deste 10, PPTX 10 */
    Qp('[data-pl-ok]').click(); await bekle(4000); await dur(1500);
    var D0 = S.deck(); R.deste = { n: D0.slides.length, lay: D0.slides.map(function (s) { return s.lay; }), lang: D0.lang, yol: D0.yol, metin: desteMetin(),
      kodlar: (window.__U.qa(D0, 'deste') || { issues: [] }).issues.map(function (z) { return z.code; }) };
    R.pptx = await pptxAl(); R.toasts = toasts.slice();
    /* iptal: bekleyen çalıştırma kapatılınca sonucu hiçbir yere yazılmaz */
    await ac('Yeşil çatılar', 10, 'tr'); LOG.length = 0; CEVAP['sunum-research'] = function (b) { return gec(3000, arastirma(b.topic, 10, 1, trMadde)); };
    Qp('[data-pl-go]').click(); await bekle(300); Qp('[data-pl-no]').click(); await bekle(4000);
    R.iptal = { strips: window.__U.strips().length, pmTitle: window.__U.pm().title, flowGizli: Qp('[data-flow]').hidden, flowHTML: Qp('[data-flow]').innerHTML, inv: LOG.slice(), desteN: S.deck().slides.length };
    /* kaynaksız araştırma: onay istenir */
    await ac('Mavi altyapı', 10, 'tr'); LOG.length = 0; CEVAP['sunum-research'] = function (b) { return gec(100, arastirma(b.topic, 10, 0, trMadde)); };
    Qp('[data-pl-go]').click(); await bekle(1500); R.kaynaksiz = panel(); var ack = Qp('[data-pl-ack]'); if (ack) ack.click(); await bekle(100); R.onay = panel();
    /* zaman aşımı + açık seçimle eski motor */
    await ac('Kent ormanları', 10, 'tr'); LOG.length = 0; CEVAP['sunum-research'] = httpHata(504);
    CEVAP['generate-presentation'] = function (b) { return gec(100, { slides: Array.from({ length: 10 }, function (_, i) { return { title: 'Kent ormanları ' + (i + 1), bullets: trMadde(i) }; }) }); };
    Qp('[data-pl-go]').click(); await bekle(1500); R.k504 = panel(); Qp('[data-pl-legacy]').click(); await bekle(1500); R.eski = panel(); R.eskiSayi = window.__U.pm().sayi; R.eskiGundem = window.__U.pm().gundem;
    R.hatalar = HATALAR;
  `;
  const EN = ONCU({ department: 'Kamu Yönetimi (elle yazılmış)', full_name: 'Deneme Öğrenci' }) + `
    var enMadde = function (i) { if (i % 3 === 1) return ['Feedback: it speeds up marking for large classes and frees time', 'Safety: immune-style layered checks keep assessment honest', 'Policy: integrating AI requires clear course rules for everyone']; return ['it supports feedback loops in large classes (' + (i + 1) + ')', 'immune-style layered checks keep assessment honest', 'integrating AI needs clear course rules']; };
    await ac('integrating AI into teaching', 12, 'en');      /* küçük harfli konu: kapak başlığı deste dilinde büyür */ CEVAP['sunum-research'] = function (b) { var x = arastirma(b.topic, 12, 1, enMadde); x.title = ''; return gec(200, x); };      /* sunucu başlığı yok: kapak yerel başlıktan */
    Qp('[data-pl-go]').click(); await bekle(1500); R.panel = panel(); R.istek = LOG.filter(function (x) { return /^sunum-research/.test(x); });
    Qp('[data-pl-ok]').click(); await bekle(4000); await dur(1500);
    var D0 = S.deck(); R.deste = { n: D0.slides.length, lay: D0.slides.map(function (s) { return s.lay; }), lang: D0.lang, metin: desteMetin(), kodlar: (window.__U.qa(D0, 'deste') || { issues: [] }).issues.map(function (z) { return z.code; }) };
    R.pptx = await pptxAl();
    /* P2: taşan kutu → ilk basış uyarır (asetat no + git), indirmez; git o asetata götürür; ikinci basış indirir; deste değişmez */
    var UZUN = Array.from({ length: 40 }, function (_, i) { return 'overflowing sentence ' + i; }).join(' ');
    S.deck().slides[2].els.push({ id: 'u38-t', type: 't', x: 70, y: 380, w: 420, h: 40, text: UZUN, size: 22 }); window.__U.renderAll(); S.dirty(); await dur(2500);
    var once = JSON.stringify(S.deck().slides.map(function (x) { return x.els.map(function (e) { return [e.id, e.text || '']; }); })); PPTX.length = 0; ADD = 0; toasts.length = 0;
    d.querySelector('[data-pptx]').click(); await bekle(2500); var ta = d.querySelector('[data-toast-a]');
    R.tasma = { snap: window.__U.snapHazir(S.deck()), olcum: (window.__U.qa(S.deck(), 'deste') || {}).olcum, oz: (window.__U.qa(S.deck(), 'deste') || { issues: [] }).issues.map(function (z) { return z.code + '@' + z.slide; }), yazildi: PPTX.some(function (x) { return x[0] === 'writeFile'; }), toast: toasts.slice(), href: ta && ta.getAttribute('href'), aYazi: ta && ta.textContent };
    d.querySelector('[data-pptx]').click(); await bekle(3000);
    R.tasma.ikinci = PPTX.some(function (x) { return x[0] === 'writeFile'; }); R.tasma.asetat = ADD;
    PPTX.length = 0; ADD = 0; d.querySelector('[data-pptx]').click(); await bekle(2500); R.tasma.ucuncu = PPTX.some(function (x) { return x[0] === 'writeFile'; });
    S.deck().cur = 0; window.__U.renderAll(); ta = d.querySelector('[data-toast-a]'); R.tasma.git = null;
    PPTX.length = 0; S.deck().slides[2].els[S.deck().slides[2].els.length - 1].text = UZUN + ' more'; window.__U.renderAll(); S.dirty(); await dur(1500);
    d.querySelector('[data-pptx]').click(); await bekle(2500); ta = d.querySelector('[data-toast-a]'); R.tasma.yeniUyari = !PPTX.some(function (x) { return x[0] === 'writeFile'; });
    if (ta && ta.getAttribute('href') === '#sx-tasma') { ta.click(); await bekle(300); R.tasma.git = S.deck().cur; }
    R.tasma.degismedi = once === JSON.stringify(S.deck().slides.map(function (x) { return x.els.map(function (e) { return [e.id, e.id === 'u38-t' ? UZUN : (e.text || '')]; }); }));
    R.hatalar = HATALAR;
  `;
  const kosSahne = async (ad, govde) => {
    const H = yeniSunucu({ senkron: true }); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r));
    try { const r = await kosU('u38-' + ad + '.html', 'u38-' + ad, uSayfa(H.srv.address().port, govde)); r.sunum = H.DB.presentations.length; return r; } finally { H.srv.close(); }
  };
  let A, B;
  try { [A, B] = await Promise.all([kosSahne('tr', TR), kosSahne('en', EN)]); } catch (e) { A = B = { hata: String(e && e.stack || e) }; }
  const hic = (inv, ad) => assert.ok(!inv.some((x) => x.indexOf(ad + ':') === 0), ad + ' çağrıldı: ' + JSON.stringify(inv));

  test('D1 P0 429 ve 502: anlaşılır hata, konu ve sayı duruyor, tekrar dene + açık eski motor düğmesi; eski motor/yönetmen çağrılmaz, sahte başarı ve deste yok', () => {
    assert.ok(!A.hata, A.hata);
    for (const [k, metin] of [['k429', /kota.*429/], ['k502', /sunucu hatası/]]) {
      const p = A[k]; assert.match(p.help, /Araştırma şu an yapılamadı/); assert.match(p.help, metin); assert.match(p.help, /kendiliğinden yeniden denenmeyecek/);
      assert.ok(p.retry && p.legacy, k + ': düğmeler'); assert.equal(p.ok, true, k + ': bas düğmesi açık'); assert.equal(p.seritler, 0); assert.equal(p.konu, 'Kentsel ısı adası'); assert.equal(p.n, '10');
      assert.equal(p.inv.filter((x) => /^sunum-research/.test(x)).length, 1, k + ': tek araştırma çağrısı'); hic(p.inv, 'generate-presentation'); hic(p.inv, 'acadia-presentation-director');
      assert.equal(p.flowGizli, true); assert.equal(p.flowHTML, ''); assert.ok(!/araştırıldı|kaynak; sona kaynakça/.test(p.help));
    }
    assert.match(A.k504.help, /süre sınırında/); hic(A.k504.inv, 'generate-presentation');
  });

  test('D2 P0 tekrar dene tek çalıştırma; açık seçimle eski motor "kaynaksız" etiketli; kaynaksız araştırma onaysız basılamaz; tekrarlar ikinci sunum yaratmaz', () => {
    assert.ok(!A.hata, A.hata);
    assert.equal(A.basari.inv.filter((x) => /^sunum-research/.test(x)).length, 1); assert.ok(A.basari.seritler > 0); assert.equal(A.basari.ok, false);
    const e = A.eski; assert.match(e.help, /Kaynaksız yazıldı \(senin seçiminle, eski motor\)/); assert.equal(e.inv.filter((x) => /^generate-presentation/.test(x)).length, 1);
    assert.equal(e.ok, false); assert.ok(e.basliklar.length > 0); assert.ok(!e.basliklar.some((t) => /Kaynakça|References/.test(t)), 'kaynaksız destede kaynakça');
    assert.match(A.kaynaksiz.help, /kullanılabilir kaynak bulamadı/); assert.equal(A.kaynaksiz.ok, true, 'onaysız basılabiliyor'); assert.ok(A.kaynaksiz.ack);
    assert.equal(A.onay.ok, false, 'onay sonrası basılamıyor'); assert.equal(A.onay.ack, false);
    assert.equal(A.sunum, 1, 'iki hata + tekrar + iptal + eski motor: hesapta tek sunum (yalnız basılan)');
    assert.deepEqual(A.hatalar, []);
  });

  test('D3 P1 panel yaşam döngüsü: bekleyen çalıştırmada öneri yok; geç gelen A, B\'yi ezmez; iptal sonrası sonuç yazılmaz', () => {
    assert.ok(!A.hata, A.hata);
    const bk = JSON.stringify(A.bekler).slice(0, 400); assert.equal(A.bekler.flowGizli, true, bk); assert.equal(A.bekler.flowHTML, '', bk); assert.equal(A.bekler.seritler, 0, bk); assert.equal(A.bekler.help, '', bk);
    for (const p of [A.B1, A.B2]) { assert.ok(p.basliklar.length && p.basliklar.every((t) => !/^Kentsel/.test(t)), JSON.stringify(p.basliklar)); assert.match(p.basliklar[0], /^Sürdürülebilir ulaşım/); }
    assert.deepEqual(A.B1.basliklar, A.B2.basliklar, 'geç gelen A şeritleri değiştirdi'); assert.equal(A.B2.flowHTML, A.B1.flowHTML, 'geç gelen A önerileri değiştirdi');
    assert.match(A.B2pm.title, /^Sürdürülebilir ulaşım/);
    assert.equal(A.iptal.strips, 0, JSON.stringify(A.iptal).slice(0, 400)); assert.ok(!/Yeşil/.test(A.iptal.pmTitle || '')); assert.equal(A.iptal.flowGizli, true); assert.equal(A.iptal.flowHTML, '');
    assert.equal(A.iptal.desteN, A.deste.n, 'iptal edilen çalıştırma desteye dokundu');
  });

  test('D4 P1 kesin sayı uçtan uca: TR araştırma 10 → deste 10, PPTX 10; EN araştırma 12 → 12; eski motor 10 → 10; kaynakçalı; sayı/kaynak kodu yok', () => {
    assert.ok(!A.hata, A.hata); assert.ok(!B.hata, B.hata);
    assert.equal(A.B2pm.sayi.toplam, 10); assert.equal(A.deste.n, 10, JSON.stringify(A.deste.lay)); assert.equal(A.pptx.asetat, 10); assert.equal(A.pptx.yazildi, true);
    assert.ok(A.deste.lay.includes('refs')); assert.equal(A.deste.lay[0], 'cover');
    assert.equal(B.deste.n, 12, JSON.stringify(B.deste.lay)); assert.equal(B.pptx.asetat, 12); assert.ok(B.deste.lay.includes('refs'));
    assert.equal(A.eskiSayi.toplam, 10); assert.equal(A.eski.basliklar.length + A.eskiGundem, 10);
    for (const k of ['SLIDE_COUNT_OVER', 'SLIDE_COUNT_UNDER', 'NO_SOURCES', 'CITE_UNMAPPED', 'REF_UNUSED', 'CITE_FORMAT', 'REFS_MISSING', 'META_TEXT', 'LOCALE_CASE']) {
      assert.ok(!A.deste.kodlar.includes(k), 'TR: ' + k); assert.ok(!B.deste.kodlar.includes(k), 'EN: ' + k);
    }
    assert.equal(A.deste.yol.tam, 1);
  });

  test('D5 P0 İngilizce: canlı deste ve PPTX\'te Türkçe büyük harf yok, kapakta Türkçe bölüm yok; Türkçe özel adlar ve kaynak başlıkları korunur; Türkçe destede bölüm kalır', () => {
    assert.ok(!B.hata, B.hata); assert.equal(B.deste.lang, 'en');
    const canli = B.deste.metin.join(' | '), pp = B.pptx.metin;
    for (const [ad, t] of [['canlı', canli], ['pptx', pp]]) {
      assert.ok(!/İt\b|İmmune|İntegrat|İNTEGRAT/.test(t), ad + ': Türkçe büyük harf — ' + (t.match(/.{0,30}(İt\b|İmmune|İntegrat|İNTEGRAT).{0,30}/) || [])[0]);
      assert.ok(!/Kamu Yönetimi/.test(t), ad + ': İngilizce kapakta Türkçe bölüm');
      assert.ok(/Yılmaz/.test(t) && /Öztürk, Ş\., & Çelik, Ğ\./.test(t) && /İnönü, E\./.test(t) && /İstanbul Üniversitesi/.test(t), ad + ': Türkçe adlar/kaynak başlıkları bozuldu');
    }
    assert.ok(/Deneme Öğrenci/.test(B.deste.metin[0]), 'kapakta ad kalmalı'); assert.ok(/It supports|it supports/.test(canli));
    assert.ok(/Kamu Yönetimi/.test(A.deste.metin[0]), 'Türkçe kapakta bölüm kalmalı');
    assert.ok(B.istek.length === 1 && /integrating AI into teaching/.test(B.istek[0]), JSON.stringify(B.istek));
    assert.match(B.deste.metin[0], /^Integrating AI into teaching/, 'kapak başlığı: ' + B.deste.metin[0]);
    assert.ok(/It speeds up|Immune-style|Integrating AI requires/.test(canli), 'kolon düzeni deste dilinde büyütmeli: ' + canli.slice(0, 300));
    assert.deepEqual(B.hatalar, []);
    /* gözlem (#38 kapsamı dışı, düzeltilmedi): kapanış asetatı dilden bağımsız 'Teşekkürler' yazılıyor — raporda geri listede */
    console.log('  GOZLEM  EN kapanış asetatı: ' + JSON.stringify(B.deste.metin[B.deste.metin.length - 1]));
  });

  test('D6 P2 PPTX taşma uyarısı: ilk basış indirmez, asetat numarasını ve git bağlantısını verir; git o asetata götürür; ikinci basış indirir; deste ve metin silinmez; deste değişince yeniden uyarır', () => {
    assert.ok(!B.hata, B.hata); const t = B.tasma, j = JSON.stringify(t).slice(0, 500);
    assert.equal(t.yazildi, false, j); assert.ok(t.toast.some((x) => /yazı kutusundan taşıyor \(asetat [^)]*\b3\b/.test(x)), j); assert.equal(t.href, '#sx-tasma', j); assert.match(t.aYazi || '', /asetat 3/);
    assert.equal(t.ikinci, true, j); assert.equal(t.asetat, 12); assert.equal(t.ucuncu, false, 'izin bir kez: aynı deste üçüncü basışta yine uyarır — ' + j);
    assert.equal(t.yeniUyari, true, j); assert.equal(t.git, 2, 'git bağlantısı 3. asetata götürmeli — ' + j); assert.equal(t.degismedi, true, 'uyarı desteyi değiştirdi');
  });

  temizle(); summary();
})();
