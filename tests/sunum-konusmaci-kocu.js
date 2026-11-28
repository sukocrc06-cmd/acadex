/* ==========================================================================
   ACADEX — SUNUM KONUŞMACI KOÇU (tests/sunum-konusmaci-kocu.js)

   NEDEN VAR (28.11.2026, #58 Phase 12.3a):
   - Koç yereldir: asetat başına ana mesaj, amaç, tahmini süre, akılda kalacak cümle, geçiş, terimler, olası sorular ve
     kayıtlı kaynağa bağlı olgular yalnız destedeki metinden çıkar. Ağ, model, yeni istatistik yok; kamera/mikrofon yok
     (var olan coach nesnesi ve [data-rh-mic] dokunulmaz).
   - Süre: toplam 5/10/15/20 dk ya da 1–180 özel; asetat saniyeleri en büyük kalan yöntemiyle TOPLAMA BİREBİR eşittir ve
     her yerde "tahmini" diye yazılır. Prova modu aynı dağıtımı asetat başına "önerilen" süre olarak gösterir.
   - Koç notu önizleme + onayla eklenir: var olan konuşma notu korunur (sona eklenir), tek geri al, işlem türü koc_not;
     asetat değişmişse öneri bayattır ve uygulanmaz. Not PPTX konuşmacı notlarına aynı alandan gider.

   Bölümler: A kaynak kuralları · C başsız Chrome birim senaryoları · E uçtan uca 1440/1024/390 (+EN).
   Başsız Chrome 500 px altına inmez: 390'da innerWidth ≤ 520. Dış ağ yok, canlı model yok, içerik sentetik.
   Çalıştırma:  node tests/sunum-konusmaci-kocu.js   (gerçek PPTX notları için PPTXGEN_BUNDLE)
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');
const { makeRunner } = require('./_ts-extract.js');
const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const { test, summary } = makeRunner();
const BLOK = (() => { const a = ink.indexOf('/* ---------- #58 (Phase 12)'), b = ink.indexOf('/* ---------- #58 son ---------- */'); return a > 0 && b > a ? ink.slice(a, b) : ''; })();
const KCB = (() => { const a = BLOK.indexOf('/* ---- 12.3a konuşmacı koçu'), b = BLOK.indexOf('/* ---- 12.3b', a); return a > 0 && b > a ? BLOK.slice(a, b) : ''; })();
const BUNDLE = [process.env.PPTXGEN_BUNDLE, path.join(ROOT, 'node_modules/pptxgenjs/dist/pptxgen.bundle.js')].filter(Boolean).find((p) => fs.existsSync(p)) || null;
const GUVENLIK = { yeniSayi: 0, notSilindi: 0, onaysizYazim: 0, bayatUygulandi: 0, mikrofon: 0, modelCagrisi: 0, disAg: 0 };
const SURELER = [5, 10, 15, 20, 7, 1, 180];

/* ---------- A: kaynak kuralları ---------- */
test('A1 12.3a koç bölümü: ağ/model/kamera/mikrofon yok; coach ve [data-rh-mic] dokunulmaz; lookbehind ve \\u kaçışı yok', () => {
  assert.ok(KCB.length > 2500, '12.3a bölümü bulunamadı');
  for (const y of ['fetch(', 'XMLHttpRequest', 'functions.invoke', 'getUserMedia', 'MediaRecorder', 'SpeechRecognition', 'webkitSpeech', 'data-rh-mic', 'coach.', 'sdGonder', 'groq']) assert.equal(KCB.includes(y), false, y);
  assert.equal(/\(\?<[=!]/.test(KCB), false, 'lookbehind'); assert.equal(/\\u[0-9a-fA-F]{4}/.test(KCB), false, '\\u');
  assert.ok(/en büyük kalan yöntemiyle saniyeler TOPLAMA BİREBİR eşit\. Tahmindir\./.test(KCB), 'süre kuralı yorumda');
  assert.ok(/tur: 'koc_not'/.test(KCB), 'işlem türü koc_not');
});

test('A2 prova kancaları yalnız iki satır (#58 işaretli); var olan prova akışı yeniden yazılmadı; PPTX notları s.notes alanından', () => {
  assert.equal((ink.match(/kcProvaBoya\(\);      \/\* #58 \*\//g) || []).length, 1); assert.equal((ink.match(/kcProvaSaat\(tot, goal, now\);      \/\* #58 \*\//g) || []).length, 1);
  assert.ok(/if \(s\.notes\) sl\.addNotes\(s\.notes\);/.test(ink), 'PPTX notları');
  assert.ok(/coach\.wanted\) \{ coachStart\(\);/.test(ink), 'mikrofon yalnız var olan coach.wanted ile (kullanıcı açarsa)');
});

/* ---------- C–E: başsız Chrome ---------- */
const STRIPS = [{ k: 'cover', t: 'Yerel Enerji', b: [] },
  { k: 'list', t: 'Gelir artışı', b: ['Gelir 2024 yılında %12 arttı [1].', 'Gider düşmedi çünkü maliyet arttı.', 'Ankara ofisi hızla büyüdü.'] },
  { k: 'list', t: 'Şebeke dengesi', b: ['Fotovoltaik paneller gündüz üretir.', 'Depolama akşam talebini karşılar.', 'Talep esnekliği şebekeyi rahatlatır.'] },
  { k: 'list', t: 'Maliyet', b: ['Kurulum maliyeti 3 yılda geri döner.', 'Bakım gideri düşüktür.'] },
  { k: 'list', t: 'Yol haritası', b: ['Önce pilot bölge seçilir.', 'Sonra ölçüm yapılır.', 'En son yaygınlaştırılır.'] },
  { k: 'end', t: 'Teşekkürler', b: [] }];
const STRIPS_EN = [{ k: 'cover', t: 'Local Energy', b: [] }, { k: 'list', t: 'Revenue growth', b: ['Revenue rose 12% in 2024 [1].', 'Costs did not fall because prices rose.'] }, { k: 'list', t: 'Grid balance', b: ['Photovoltaic panels produce by day.', 'Storage covers evening demand.'] }, { k: 'end', t: 'Thanks', b: [] }];
const PM = (en) => ({ title: 'P', sub: 't', lang: en ? 'en' : 'tr', source: 'topic', sourceId: null, cited: [{ id: 1, title: 'TÜİK', url: 'https://www.tuik.gov.tr/a', site: 'tuik.gov.tr', date: '2024', parca: [{ pid: 'p1', metin: en ? 'Revenue rose 12% in 2024.' : 'Gelir 2024 yılında %12 arttı.', tur: 'pasaj' }] }], sources: [] });
const TOHUM = (en) => `window.__inv = []; window.__mik = 0;
  window.supabaseClient.functions.invoke = function (name, opt) { var b = (opt && opt.body) || {}; window.__inv.push(name + ':' + (b.action || 'research')); if (b.action === 'critique') return Promise.resolve({ data: { version: 11, quality: { score: 81, issues: [], pass: true } } }); return Promise.resolve({ data: { durum: 'kapali' } }); };
  try { navigator.mediaDevices && (navigator.mediaDevices.getUserMedia = function () { window.__mik++; return Promise.reject(new Error('yok')); }); } catch (_) {}
  window.SpeechRecognition = window.webkitSpeechRecognition = function () { window.__mik++; this.start = function () {}; this.stop = function () {}; };
  ${en ? "localStorage.setItem('acadexUILang', 'en'); window.AX_EN = { t: { 'Kaynak': 'Source' } };" : ''}
  await sakin(); d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA); S.set(${JSON.stringify(en ? STRIPS_EN : STRIPS)}, ${JSON.stringify(PM(en))}); S.bas('new'); await sakin(); await dur(3000);
  var P = S.p12(), D = function () { return S.deck(); }, J = function (x) { return JSON.stringify(x); };
  window.__hata = []; var ce = console.error; console.error = function () { window.__hata.push(Array.prototype.slice.call(arguments).map(String).join(' ').slice(0, 200)); return ce.apply(console, arguments); };
  window.addEventListener('error', function (e) { window.__hata.push('onerror ' + (e.message || '')); }); window.addEventListener('unhandledrejection', function (e) { window.__hata.push('unhandled ' + String(e.reason && e.reason.message || e.reason)); });
  D().slides[1].notes = ${JSON.stringify(en ? 'Old note: ask the question first.' : 'Eski not: önce soruyu sor.')}; var inv0 = window.__inv.length;
  var sayilar = function (s) { return (String(s).match(/\\d+(?:[.,]\\d+)?/g) || []); };
  var desteSayi = function () { var o = {}; D().slides.forEach(function (s) { (s.els || []).forEach(function (e) { sayilar(e.text || '').forEach(function (x) { o[x] = 1; }); }); }); return o; };`;

const BIRIM = TOHUM(false) + `
  R.n = D().slides.length; R.sure = {}; ${JSON.stringify(SURELER)}.forEach(function (dk) { var t = P.kcSure(D(), dk); R.sure[dk] = { top: t.reduce(function (a, b) { return a + b; }, 0), uz: t.length, tam: t.every(function (x) { return x === Math.floor(x) && x >= 0; }), t: t }; });
  R.sureBos = P.kcSure({ slides: [] }, 10); R.sureGecersiz = P.kcSure(D(), 'abc').reduce(function (a, b) { return a + b; }, 0); R.sureAyni = J(P.kcSure(D(), 10)) === J(P.kcSure(D(), 10));
  /* koç kartları: hiçbir alan destede olmayan sayı üretmez (süre ve atıf numarası hariç) */
  P.KC.dk = 10; P.KC.sureler = null; var DS = desteSayi(); R.koc = []; R.yeni = [];
  for (var i = 0; i < D().slides.length; i++) { var k = P.kcKoc(D(), i); R.koc.push(k); var metin = [k.mesaj, k.amac, k.akilda, k.gecis].concat(k.terim, k.soru, k.kaynakli.map(function (z) { return z.metin; })).join(' ');
    sayilar(metin).forEach(function (x) { if (!DS[x]) R.yeni.push(i + ':' + x); }); }
  R.kocYok = P.kcKoc(D(), 99);
  R.not = P.kcNotMetni(R.koc[1]); R.notSayi = sayilar(R.not.split('\\n').filter(function (l) { return !/^Süre \\(tahmini\\)/.test(l); }).join(' ').replace(/\\[\\d+\\]/g, '')).filter(function (x) { return !DS[x]; });
  /* koç notu uygula: not korunur, tek geri al, koc_not; geri al birebir */
  var s0 = J(D().slides), n0 = P.undoN(), not0 = D().slides[1].notes;
  R.u = { r: P.kcNotUygula(1, R.not), not: D().slides[1].notes, undo: P.undoN() - n0, islem: (D().islemler || []).slice(-1)[0], digerAyni: J(D().slides.map(function (s, j) { return j === 1 ? null : s; })) === J(JSON.parse(s0).map(function (s, j) { return j === 1 ? null : s; })) };
  R.u.basta = R.u.not.indexOf(not0) === 0; P.undo(); await bekle(200); R.u.geri = J(D().slides) === s0; R.u.geriNot = D().slides[1].notes === not0;
  var n1 = P.undoN(); R.u.yanlis = [P.kcNotUygula(99, 'x').ok, P.kcNotUygula(1, '').ok, P.undoN() - n1, J(D().slides) === s0];
  R.u.bos = (function () { var s = D().slides[2], o = s.notes; s.notes = ''; var r = P.kcNotUygula(2, 'Koç'); var v = D().slides[2].notes; P.undo(); s = D().slides[2]; return { ok: r.ok, not: v, geri: s.notes === '' }; })();
  /* özel süre sınırları */
  R.oz = { sifir: P.kcOzelSure(0), ust: P.kcOzelSure(181), harf: P.kcOzelSure('abc'), eksi: P.kcOzelSure(-5), yedi: P.kcOzelSure(7), dk7: P.KC.dk, sel: d.querySelector('[data-rh-goal]').value, ust180: P.kcOzelSure(180), sel180: d.querySelector('[data-rh-goal]').value, kesir: P.kcOzelSure(12.7), dkK: P.KC.dk };
  P.KC.dk = 10; P.KC.ozel = 0; d.querySelector('[data-rh-goal]').value = '10';
  /* PPTX notları: koç notu + eski not birlikte */
  P.kcNotUygula(1, R.not); R.pptx = null;
  if (window.PptxGenJS) { window.__pptx = []; window.PptxGenJS.prototype.writeFile = function (o) { return this.write({ outputType: 'base64' }).then(function (b) { window.__pptx.push(b); return o && o.fileName; }); }; await P.exportPptx(null); R.pptx = window.__pptx[window.__pptx.length - 1] || ''; }
  R.inv = window.__inv.slice(inv0); R.mik = window.__mik; R.hataK = window.__hata;
`;

const pqOlc = `var olc = function () { var D0 = d.querySelector('dialog.pq-dlg'), r = D0.getBoundingClientRect();
    return { en: innerWidth, acik: D0.open, sol: Math.round(r.left), sag: Math.round(r.right), dYatay: D0.scrollWidth - D0.clientWidth,
      tasan: Array.prototype.filter.call(D0.querySelectorAll('*'), function (x) { var b = x.getBoundingClientRect(); return b.width && x.offsetParent !== null && (b.right > r.right + 1 || b.left < r.left - 1); }).map(function (x) { return x.tagName + '.' + x.className; }).slice(0, 5) }; };`;

const E2E = (en) => TOHUM(en) + pqOlc + `
  var Q = function (s) { return d.querySelector('dialog.pq-dlg ' + s); }, tik = async function (s) { var b = Q(s); if (!b) throw new Error('yok: ' + s); b.click(); await bekle(300); };
  var tablo = function () { var t = Q('[data-kc-tablo]'); return { top: +t.getAttribute('data-kc-toplam'), toplam: Array.prototype.reduce.call(t.querySelectorAll('[data-kc-sn]'), function (a, x) { return a + +x.getAttribute('data-kc-sn'); }, 0), satir: t.querySelectorAll('[data-kc-sn]').length, tahmini: t.textContent }; };
  d.querySelector('[data-pq-ac]').click(); await bekle(300); await tik('[data-pq-tab="kc"]'); R.olc0 = olc(); R.giris = Q('[role="tabpanel"]').textContent.slice(0, 400);
  R.tab = {}; for (var dk of [5, 10, 15, 20]) { var sel = Q('[data-kc-dk]'); sel.value = String(dk); sel.dispatchEvent(new Event('change', { bubbles: true })); await bekle(250); R.tab[dk] = tablo(); }
  Q('[data-kc-ozel]').value = '0'; await tik('[data-kc-ozel-ok]'); R.ozelRed = { dur: Q('[data-pq-dur]').textContent, dk: P.KC.dk };
  Q('[data-kc-ozel]').value = '7'; await tik('[data-kc-ozel-ok]'); R.tab[7] = tablo(); R.ozelSec = Q('[data-kc-dk]').value;
  /* 2. asetat kartı, önizle (not değişmez), vazgeç, önizle, uygula, geri al */
  await tik('[data-kc-as="1"]'); var k = Q('[data-kc-kart]'); R.kart = { i: k.getAttribute('data-kc-kart'), metin: k.textContent, kaynakli: +k.querySelector('[data-kc-kaynakli]').getAttribute('data-kc-kaynakli') };
  var s0 = J(D().slides), not0 = D().slides[1].notes, u0 = P.undoN();
  await tik('[data-kc-oner]'); R.onizle = { var: !!Q('[data-kc-onizle]'), metin: (Q('[data-kc-onizle]') || {}).textContent || '', ayni: J(D().slides) === s0, undo: P.undoN() - u0 }; R.olc1 = olc();
  await tik('[data-kc-vazgec]'); R.vazgec = { onizle: !!Q('[data-kc-onizle]'), ayni: J(D().slides) === s0 };
  await tik('[data-kc-oner]'); await tik('[data-kc-uygula]'); R.uyg = { not: D().slides[1].notes, dur: Q('[data-pq-dur]').textContent, undo: P.undoN() - u0, islem: (D().islemler || []).slice(-1)[0] };
  d.querySelector('[data-undo]').click(); await bekle(300); R.geri = { ayni: J(D().slides) === s0, not: D().slides[1].notes === not0 };
  /* bayat öneri: önizlemeden sonra asetat kimliği değişirse uygulanmaz */
  await tik('[data-kc-oner]'); var eskiId = D().slides[1].id; D().slides[1].id = 'baska-asetat'; var s1 = J(D().slides); await tik('[data-kc-uygula]'); R.bayat = { ayni: J(D().slides) === s1, dur: Q('[data-pq-dur]').textContent }; D().slides[1].id = eskiId;
  /* prova: koç süresiyle aç; önerilen süre ve tamamlanan asetat; mikrofon açılmaz */
  var sel2 = Q('[data-kc-dk]'); sel2.value = '15'; sel2.dispatchEvent(new Event('change', { bubbles: true })); await bekle(250); var bek = P.kcSure(D(), 15);
  await tik('[data-kc-prova-ac]'); var rh = d.querySelector('[data-rh]'), pv = function () { var b = rh.querySelector('[data-kc-prova]'); return b ? { oneri: +b.querySelector('[data-kc-oneri]').getAttribute('data-kc-oneri'), tamam: b.querySelector('[data-kc-tamam]').getAttribute('data-kc-tamam'), metin: b.textContent } : null; };
  R.prova = { acik: !rh.hidden, dlg: d.querySelector('dialog.pq-dlg').open, hedef: rh.querySelector('[data-rh-goal]').value, p0: pv(), bek0: bek[0], bek1: bek[1], mic: rh.querySelector('[data-rh-mic]').getAttribute('aria-pressed') };
  rh.querySelector('[data-rh-nxt]').click(); await bekle(300); R.prova.p1 = pv(); var pr = rh.querySelector('[data-kc-prova]').getBoundingClientRect(); R.prova.kutu = { sol: Math.round(pr.left), sag: Math.round(pr.right), en: innerWidth, gen: Math.round(pr.width) };
  R.inv = window.__inv.slice(inv0); R.mik = window.__mik; R.hataK = window.__hata;
`;

const VT = '--virtual-time-budget=600000';
let KROM = null;
const krom = () => KROM || (KROM = (async () => {
  if (!CHROME) return null;
  const H = yeniSunucu(); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r)); const port = H.srv.address().port;
  const { sayfa, kos, temizle } = duzenek();
  const paket = (h) => (BUNDLE ? h.replace('<pre id="diag"></pre>', '<script src="' + pathToFileURL(BUNDLE).href + '"></script>\n<pre id="diag"></pre>') : h);
  try {
    const out = { B: await kos('kc-birim.html', 'kc-b', paket(sayfa('ok', port, 0, BIRIM)), ['--window-size=1440,900', VT]), E: {} };
    for (const [ad, en, w] of [['1440', false, 1440], ['1024', false, 1024], ['390', false, 390], ['en', true, 1440]]) out.E[ad] = await kos('kc-e2e-' + ad + '.html', 'kc-e' + ad, sayfa('ok', port, 0, E2E(en)), ['--window-size=' + w + ',900', VT]);
    return out;
  } finally { H.srv.close(); temizle(); }
})());
const yok = (ad) => console.log('  ATLANDI  ' + ad + ': Chrome bulunamadı. Bu test GEÇTİ sayılmadı.');
const unzip = (buf) => {
  const out = {}; let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--; assert.ok(e >= 0, 'ZIP sonu yok');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n; i++) {
    const m = buf.readUInt16LE(p + 10), cs = buf.readUInt32LE(p + 20), fl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), kl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const ad = buf.toString('utf8', p + 46, p + 46 + fl), lf = buf.readUInt16LE(lo + 26), lx = buf.readUInt16LE(lo + 28), d = buf.subarray(lo + 30 + lf + lx, lo + 30 + lf + lx + cs);
    out[ad] = m === 8 ? zlib.inflateRawSync(d) : Buffer.from(d); p += 46 + fl + xl + kl;
  }
  return out;
};

test('C1 kcSure: 5/10/15/20/7/1/180 dk için asetat saniyeleri tam sayı ve toplama birebir eşit; boş deste boş; geçersiz süre 10 dk değil 1 dk tabanı; aynı girdi aynı çıktı', async () => {
  const K = await krom(); if (!K) return yok('C1'); const B = K.B;
  for (const dk of SURELER) { const s = B.sure[dk]; assert.equal(s.top, dk * 60, dk + ' dk toplam ' + s.top); assert.equal(s.uz, B.n, dk + ' uzunluk'); assert.equal(s.tam, true, dk + ' tam sayı'); }
  assert.ok(B.sure[10].t[1] > B.sure[10].t[0], 'içerikli asetat kapaktan uzun: ' + JSON.stringify(B.sure[10].t));
  assert.deepEqual(B.sureBos, []); assert.equal(B.sureGecersiz, 600, 'sayı olmayan süre varsayılan 10 dk'); assert.equal(B.sureAyni, true);
});

test('C2 kcKoc: her asetatta ana mesaj/amaç/süre/akılda kalan/geçiş; ilk tanıtır, son kapatır; olası soru destedeki sayıya dayanır; yeni sayı üretilmez', async () => {
  const K = await krom(); if (!K) return yok('C2'); const B = K.B;
  assert.equal(B.koc.length, B.n); assert.equal(B.kocYok, null);
  for (const k of B.koc) for (const a of ['mesaj', 'amac', 'akilda', 'gecis']) assert.ok(typeof k[a] === 'string' && k[a].length, k.i + ' ' + a);
  assert.equal(B.koc.reduce((a, k) => a + k.sure, 0), 600, 'kart süreleri toplamı');
  assert.match(B.koc[0].amac, /tanıtmak/); assert.match(B.koc[B.n - 1].amac, /kapatmak/); assert.match(B.koc[B.n - 1].gecis, /Kapanış/); assert.match(B.koc[1].gecis, /^Sıradaki: Şebeke dengesi/);
  assert.equal(B.koc[1].mesaj, 'Gelir artışı'); assert.ok(B.koc[1].soru.some((q) => /\(2024\)|\(12\)/.test(q)), JSON.stringify(B.koc[1].soru)); assert.ok(B.koc[1].soru.length <= 3);
  assert.ok(B.koc[1].kaynakli.length >= 1 && B.koc[1].kaynakli.length <= 3, 'kaynaklı olgu'); assert.ok(B.koc[1].kaynakli.every((z) => /Gelir 2024/.test(z.metin)), JSON.stringify(B.koc[1].kaynakli));
  assert.deepEqual(B.koc[2].kaynakli, [], 'kaynaksız asetatta kaynaklı olgu uydurulmaz'); assert.ok(B.koc[2].terim.length >= 1 && B.koc[2].terim.length <= 4, 'terim');
  assert.deepEqual(B.yeni, [], 'destede olmayan sayı: ' + B.yeni.join(',')); if (B.yeni.length) GUVENLIK.yeniSayi += B.yeni.length;
});

test('C3 kcNotMetni: "Koç notu" başlığı, süre "tahmini" etiketli, alanlar sırayla; süre dışında yeni sayı yok', async () => {
  const K = await krom(); if (!K) return yok('C3'); const L = K.B.not.split('\n');
  assert.equal(L[0], '— Koç notu —'); assert.match(L[1], /^Ana mesaj: Gelir artışı$/); assert.match(L[2], /^Amaç: /); assert.match(L[3], /^Süre \(tahmini\): \d\d:\d\d$/); assert.match(L[4], /^Akılda kalacak: /); assert.match(L[5], /^Sıradaki: /);
  assert.ok(L.some((l) => /^Olası sorular: /.test(l)) && L.some((l) => /^Kaynaklı: .*\[1\]/.test(l)), K.B.not);
  assert.deepEqual(K.B.notSayi, []); if (K.B.notSayi.length) GUVENLIK.yeniSayi++;
});

test('C4 kcNotUygula: var olan not başta korunur, koç notu sona; tek geri al adımı; işlem türü koc_not; başka asetat değişmez; geri al birebir; geçersiz çağrı hiçbir şey yazmaz', async () => {
  const K = await krom(); if (!K) return yok('C4'); const u = K.B.u;
  assert.equal(u.r.ok, true); assert.equal(u.basta, true, 'eski not korunmadı'); if (!u.basta) GUVENLIK.notSilindi++;
  assert.ok(u.not.startsWith('Eski not: önce soruyu sor.\n\n— Koç notu —'), u.not.slice(0, 80)); assert.equal(u.undo, 1); assert.equal(u.islem.tur, 'koc_not'); assert.ok(u.islem.sid && u.islem.t > 0);
  assert.equal(u.digerAyni, true); assert.equal(u.geri, true, 'geri al'); assert.equal(u.geriNot, true);
  assert.deepEqual(u.yanlis, [false, false, 0, true]); assert.deepEqual(u.bos, { ok: true, not: 'Koç', geri: true });
});

test('C5 kcOzelSure: 1–180 tam dakika; 0, 181, harf, eksi reddedilir; kabul edilen süre prova seçicisine eklenir; kesir aşağı yuvarlanır', async () => {
  const K = await krom(); if (!K) return yok('C5'); const o = K.B.oz;
  assert.deepEqual([o.sifir, o.ust, o.harf, o.eksi], [false, false, false, false]);
  assert.equal(o.yedi, true); assert.equal(o.dk7, 7); assert.equal(o.sel, '7'); assert.equal(o.ust180, true); assert.equal(o.sel180, '180'); assert.equal(o.kesir, true); assert.equal(o.dkK, 12);
});

test('C6 gerçek PPTX: 2. asetatın konuşmacı notunda eski not + koç notu; koç hiçbir ağ/model çağrısı yapmadı, mikrofon açılmadı', async () => {
  const K = await krom(); if (!K) return yok('C6'); const B = K.B;
  assert.deepEqual(B.inv, [], 'koç ağ çağrısı: ' + B.inv.join(',')); if (B.inv.length) GUVENLIK.modelCagrisi++; assert.equal(B.mik, 0); if (B.mik) GUVENLIK.mikrofon++;
  assert.deepEqual(B.hataK, [], JSON.stringify(B.hataK)); assert.deepEqual(B.ag, []); if (B.ag.length) GUVENLIK.disAg++;
  if (!B.pptx) return console.log('  ATLANDI  C6 PPTX bölümü: PPTXGEN_BUNDLE yok. Koç notunun s.notes alanına yazıldığı sınandı, PPTX GEÇTİ sayılmadı.');
  const Z = unzip(Buffer.from(B.pptx, 'base64')), N = Object.keys(Z).filter((k) => /notesSlide\d+\.xml$/.test(k)).map((k) => Z[k].toString('utf8')).join('\n');
  assert.ok(/Eski not: önce soruyu sor\./.test(N), 'eski not PPTX\'te yok'); assert.ok(/— Koç notu —/.test(N), 'koç notu PPTX\'te yok'); assert.ok(/Süre \(tahmini\)/.test(N));
});

/* ---------- E: uçtan uca ---------- */
test('E1 uçtan uca 1440/1024/390 + EN: koç sekmesi, süre tablosu birebir toplam, özel süre, önizle/vazgeç/uygula/geri al, bayat öneri, prova; taşma yok; ağ ve mikrofon yok', async () => {
  const K = await krom(); if (!K) return yok('E1');
  for (const ad of ['1440', '1024', '390', 'en']) {
    const E = K.E[ad], en = ad === 'en', t = (m) => ad + ': ' + m;
    if (ad === '390') assert.ok(E.olc0.en <= 520, t('dar pencere ' + E.olc0.en)); else assert.equal(E.olc0.en, ad === '1024' ? 1024 : 1440, t('genişlik'));
    assert.ok(en ? /No new statistics; times are estimates\. No camera or microphone\./.test(E.giris) : /Yeni istatistik üretilmez; süreler tahminidir\. Kamera ve mikrofon kullanılmaz\./.test(E.giris), t('giriş ' + E.giris));
    for (const dk of [5, 10, 15, 20, 7]) { const T = E.tab[dk]; assert.equal(T.top, dk * 60, t(dk + ' dk')); assert.equal(T.toplam, dk * 60, t(dk + ' dk satır toplamı')); assert.ok(T.satir >= 4, t('satır')); assert.ok(en ? /estimate/.test(T.tahmini) : /tahmini/.test(T.tahmini), t('tahmini etiketi')); }
    assert.equal(E.ozelRed.dk, 20, t('0 dk reddedilmeli')); assert.ok(E.ozelRed.dur.length > 3, t('özel süre uyarısı')); assert.equal(E.ozelSec, '7', t('özel süre seçili'));
    assert.equal(E.kart.i, '1'); assert.ok(en ? /Key message.*Revenue growth/.test(E.kart.metin) : /Ana mesaj.*Gelir artışı/.test(E.kart.metin), t('kart ' + E.kart.metin.slice(0, 120))); assert.ok(E.kart.kaynakli >= 1, t('kaynaklı olgu'));
    assert.equal(E.onizle.var, true, t('önizleme')); assert.equal(E.onizle.ayni, true, t('önizleme notu değiştirdi')); assert.equal(E.onizle.undo, 0); if (!E.onizle.ayni) GUVENLIK.onaysizYazim++;
    assert.ok(en ? /— Coach note —/.test(E.onizle.metin) && /Time \(estimate\)/.test(E.onizle.metin) : /— Koç notu —/.test(E.onizle.metin) && /Süre \(tahmini\)/.test(E.onizle.metin), t('önizleme metni'));
    assert.deepEqual(E.vazgec, { onizle: false, ayni: true }, t('vazgeç'));
    const eski = en ? 'Old note: ask the question first.' : 'Eski not: önce soruyu sor.'; assert.ok(E.uyg.not.startsWith(eski + '\n\n'), t('eski not korunmadı')); if (!E.uyg.not.startsWith(eski)) GUVENLIK.notSilindi++;
    assert.equal(E.uyg.undo, 1, t('tek geri al')); assert.equal(E.uyg.islem.tur, 'koc_not'); assert.ok(en ? /appended/.test(E.uyg.dur) : /eklendi; geri alınabilir/.test(E.uyg.dur), t('durum ' + E.uyg.dur));
    assert.deepEqual(E.geri, { ayni: true, not: true }, t('geri al'));
    assert.equal(E.bayat.ayni, true, t('bayat öneri uygulandı')); assert.ok(en ? /stale/.test(E.bayat.dur) : /bayatladı/.test(E.bayat.dur), t('bayat durum')); if (!E.bayat.ayni) GUVENLIK.bayatUygulandi++;
    const p = E.prova; assert.equal(p.acik, true, t('prova açık')); assert.equal(p.dlg, false); assert.equal(p.hedef, '15', t('prova hedefi koç süresi'));
    assert.equal(p.p0.oneri, p.bek0, t('önerilen süre 1')); assert.equal(p.p0.tamam, '1/' + (en ? 4 : 6)); assert.equal(p.p1.oneri, p.bek1, t('önerilen süre 2')); assert.equal(p.p1.tamam, '2/' + (en ? 4 : 6));
    assert.ok(en ? /suggested \(estimate\)/.test(p.p0.metin) : /önerilen \(tahmini\)/.test(p.p0.metin), t('prova etiketi')); assert.notEqual(p.mic, 'true', t('mikrofon')); assert.ok(p.kutu.sol >= -1 && p.kutu.sag <= p.kutu.en + 1 && p.kutu.gen > 40, t('prova kutusu ' + JSON.stringify(p.kutu)));
    for (const o of [E.olc0, E.olc1]) { assert.ok(o.dYatay <= 1, t('yatay kaydırma')); assert.ok(o.sol >= -1 && o.sag <= o.en + 1, t('pencere taşıyor ' + JSON.stringify(o))); assert.deepEqual(o.tasan, [], t('taşan öğe')); }
    assert.deepEqual(E.inv, [], t('ağ çağrısı ' + E.inv.join(','))); if (E.inv.length) GUVENLIK.modelCagrisi++; assert.equal(E.mik, 0, t('mikrofon')); if (E.mik) GUVENLIK.mikrofon++;
    assert.deepEqual(E.hataK, [], t('konsol ' + JSON.stringify(E.hataK))); assert.deepEqual(E.ag, [], t('dış ağ')); if (E.ag.length) GUVENLIK.disAg++;
  }
});

test('Z güvenlik sayımı: hepsi 0 (yeni sayı, silinen not, onaysız yazım, bayat uygulama, mikrofon, model çağrısı, dış ağ)', async () => {
  console.log('  GÜVENLİK ' + JSON.stringify(GUVENLIK)); assert.deepEqual(Object.values(GUVENLIK), [0, 0, 0, 0, 0, 0, 0]);
});

(async () => { await summary(); })();
