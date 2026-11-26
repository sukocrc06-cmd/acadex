/* ==========================================================================
   ACADEX — SUNUM BİRLEŞİK DENETİM VE GÜVENLİ ONARIM (tests/sunum-birlesik-qa.js)

   NEDEN VAR (Phase 6, 27.11.2026; #35):
     "Asetatları denetle" penceresi üç raporu (içerik puanı + yerel içerik denetimleri, Phase 4 teknik, Phase 5 görsel)
     tek normalize listede okur. Eski denetçinin "düzelt / hepsini düzelt"i kaldırıldı: settle sığmayan maddeyi
     konuşmacı notuna taşıyordu (metni değiştirir) ve onaysız topluca çalışıyordu. Yerine tek bulgu için önizlemeli,
     onaylı, geri alınabilir onarım geldi; yalnız teknik TEXT_OVERFLOW ve yalnız doğrulanmış şablon yazısıyla. Bu dosya:
       A (U1–U4)  kaynak kuralları: ağ yok, metin/sıra/not yazımı yok, onarım yalnız tıklamayla, eski yol kalktı
       B (U5–U13) başsız Chrome + durumlu sahte hesap (tests/_capraz-duzenek.js): üç rapor, eksik/bayat/eski/okunamayan
                  rapor (asla "geçti" değil), bilinmeyen kod, birleştirme ve ayrı bulgular, süzgeç, öncelik tablosu,
                  önizleme desteyi değiştirmez, vazgeç etkisiz, onay yalnız o düzeltmeyi uygular, geri al, yarım kalan
                  onarım yok, önizlemeden sonra değişen deste, kirli/kayıt durumu, görsel bulgu düzeltilmez, asetata git
       C (U14)    EN sözlüğü + 390 px genişlikte tek sütun ve yatay taşma yok
     Hiçbir testte model çağrısı yok. Chrome yoksa B ve C AÇIKÇA atlanır (geçti sayılmaz).
   Çalıştırma:  node tests/sunum-birlesik-qa.js
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { makeRunner } = require('./_ts-extract.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const { test, summary } = makeRunner();
const cut = (a, b) => { const i = ink.indexOf(a); assert.ok(i >= 0, 'bulunamadı: ' + a); const j = ink.indexOf(b, i + a.length); assert.ok(j > i, 'son bulunamadı: ' + b); return ink.slice(i, j); };
const P6 = cut('  /* ---------- PHASE 6: BİRLEŞİK DENETİM', '  /* ---------- Acadia: kurgu masası');
const fn = (ad) => cut('  var ' + ad + ' = function', '\n  };\n');

/* ------------------------------ A: kaynak kuralları ------------------------------ */
test('U1 birleşik denetim ağa çıkmaz, kaydettirmez, zamanlamaz; görsel denetimi başlatmaz', () => {
  const yasak = /functions\.invoke|fetch\(|XMLHttpRequest|supabase|GEMINI|generativelanguage|x-goog|gorselQA\(|setTimeout|setInterval|saveNow|saveLocal|queueCloud|localStorage|sessionStorage|store\./;
  assert.ok(!yasak.test(P6), 'Phase 6 bloğunda yasak çağrı: ' + (P6.match(yasak) || [])[0]);
  assert.ok(!/qaPlan\(|qaUygula\(/.test(fn('qaBoya')), 'pencere boyanırken onarım planı kurulmamalı ya da uygulanmamalı');
  assert.deepEqual(ink.match(/.*gorselQA\(\).*/g).map((x) => x.trim()), ["if (t.hasAttribute('data-gq-run')) { gorselQA(); return; }"], 'görsel denetim yalnız düğmeyle');
});

test('U2 onarım anlamı değiştirmez: yalnız size/w/h yazılır; metin, not, sıra, grafik, tablo, kaynak, görsel yazılmaz', () => {
  assert.ok(!/settle\(|\.splice\(|\.unshift\(|slides\.push|\.notes\b|\.reverse\(/.test(P6), 'Phase 6 desteyi yeniden düzenlememeli');
  const yaz = /\.(text|notes|src|chart|table|latex|svg|warn|lay|x|y|type|id|title|creditId|credit|bg|heads)\s*=(?!=)/;
  assert.ok(!yaz.test(P6), 'Phase 6 bloğu içerik alanı yazıyor: ' + (P6.match(yaz) || [])[0]);
  const uy = fn('qaUygula');
  const alan = [...uy.matchAll(/\bh\.e\.(\w+)\s*=(?!=)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(alan)].sort(), ['h', 'size', 'w'], 'onay yalnız yazı boyutu ve kutu ölçüsünü yazar');
  assert.ok(/undoS\.push\(before\); if \(undoS\.length > 60\) undoS\.shift\(\); redoS = \[\]; paintHist\(\); renderAll\(\); dirty\(\);/.test(uy), 'tek geri alma adımı + kirli');
  assert.ok(/catch \(err\) \{\n      hd\.forEach/.test(uy) && uy.indexOf('undoS.push') > uy.indexOf('catch (err)'), 'hata olursa geri alma adımı itilmeden eski değerler geri konmalı');
});

test('U3 onarım yalnız tıklamayla ve tek bulgu için; yalnız teknik TEXT_OVERFLOW, doğrulanmış yazıyla; toplu onarım yok', () => {
  assert.equal(ink.split('qaPlan(').length - 1, 1, 'qaPlan yalnız önizle düğmesinden çağrılır');
  assert.equal(ink.split('qaUygula(').length - 1, 1, 'qaUygula yalnız onayla düğmesinden çağrılır');
  const tk = fn('qaTikla');
  assert.ok(/if \(t\.hasAttribute\('data-qa-pre'\)\) \{[\s\S]*?p = qaPlan\(x\)/.test(tk) && /if \(t\.hasAttribute\('data-qa-ok'\)\) \{[\s\S]*?var r = qaUygula\(pl\)/.test(tk), 'plan önizle, uygulama onayla düğmesinde');
  const hd = fn('qaHedef');
  assert.ok(/x\.code === 'TEXT_OVERFLOW' && x\.sources\.length === 1 && x\.source === 'technical'/.test(hd) && /snapHazir\(deck\)/.test(hd), 'onarılabilir: yalnız teknik TEXT_OVERFLOW, görsel kaynak karışmamış, doğrulanmış yazı');
  assert.ok(!/var audit = function|fixSlide|doFix|data-au-all|data-au-fix|hepsini düzelt/.test(ink), 'eski toplu düzeltme yolu kalmamalı');
});

test('U4 pencere: Phase 4 rozeti ve "asetatları denetle" aynı pencereyi açar; yazı kapısı aynı; pencere katmanda (şablon stili)', () => {
  const oa = fn('openAudit');
  assert.ok(oa.includes("if (!yaziHazirMi() || yaziKuyruk.length) { say('Şablon yazı tipi hazırlanıyor; denetim yazı gelince açılacak.'); yaziSonra(openAudit, 'denetim'); return; }"));
  assert.ok(/LY\.appendChild\(auDlg\)/.test(oa) && /qaTikla\(t, paint\)/.test(oa));
  assert.ok(ink.includes('data-audit>✓ asetatları denetle</button>'), 'giriş düğmesi aynı');
  assert.ok(/gorselBolum\(1\)/.test(fn('qaBoya')), 'Phase 5 bölümü (açıklama + gizlilik + düğme) pencerede kalır');
});

/* ------------------------------ B + C: tarayıcı ------------------------------ */
const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');
if (!CHROME) {
  console.log('  ATLANDI  U5–U14 (başsız Chrome): Chrome bulunamadı — CHROME_BIN ile yol verin. Bu testler GEÇTİ sayılmadı.');
  summary();
} else (async () => {
  const { W, sayfa, temizle } = duzenek();
  const KANCA_QA6 = `  window.__QA6 = { liste: qaListe, plan: qaPlan, oncelik: qaOncelik, TEKNIK: TEKNIK, GORSEL: GORSEL, ICERIK: ICERIK, KALITE_TR: KALITE_TR, ONERI: QA_ONERI, gorselIz: gorselIz, gorselYuklu: gorselYuklu,
    gorselAnahtar: gorselAnahtar, teknikQA: teknikQA, deckKey: deckKey, undoN: function () { return undoS.length; }, redoN: function () { return redoS.length; }, renderAll: renderAll, snapHazir: snapHazir };\n`;
  const qaSayfa = (port, govde) => { let h = sayfa('ok', port, 0, govde); assert.equal(h.split('  window.__S = { set:').length, 2); return h.replace('  window.__S = { set:', () => KANCA_QA6 + '  window.__S = { set:'); };
  const kos = (dosya, prof, icerik, gen) => new Promise((res, rej) => {
    fs.writeFileSync(path.join(W, dosya), icerik);
    execFile(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=' + (gen || 1280) + ',900', '--user-data-dir=' + path.join(W, 'prof-' + prof), '--allow-file-access-from-files', '--virtual-time-budget=120000', '--dump-dom', pathToFileURL(path.join(W, dosya)).href], { maxBuffer: 64 << 20, timeout: 240000 }, (e, out) => {
      if (e) return rej(e); const m = String(out).match(/<pre id="diag">([\s\S]*?)<\/pre>/); if (!m) return rej(new Error(dosya + ': diag yok'));
      res(JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&')));
    });
  });
  const TR = [{ k: 'cover', t: 'Sürdürülebilir şehirler', b: [] },
    { k: 'list', t: 'Şehirler neden kilit?', b: ['Dünya nüfusunun yarısından fazlası şehirlerde yaşıyor', 'Enerji tüketiminin yaklaşık üçte ikisi kentlerden', 'İklim uyumu kararları yerel yönetimlerde veriliyor'] },
    { k: 'list', t: 'Kentsel ısı adası', b: ['Asfalt ve beton gündüz ısıyı depolayıp gece salıyor', 'Şehir merkezi kırsala göre 3–5 °C daha sıcak olabiliyor', 'En çok etkilenenler yaşlılar ve dış mekân çalışanları'] },
    { k: 'list', t: 'Sonuç ve öneriler', b: ['Isı haritası olmadan yatırım önceliklendirilmemeli', 'Gölge ve su çözümleri birlikte planlanmalı', 'Her proje ölçümle izlenmeli'] },
    { k: 'end', t: 'Teşekkürler', b: [] }];
  const EN = [{ k: 'cover', t: 'Sustainable cities', b: [] },
    { k: 'list', t: 'Why cities matter', b: ['More than half of the world lives in cities', 'About two thirds of energy use is urban', 'Climate adaptation is decided locally'] },
    { k: 'list', t: 'Urban heat islands', b: ['Asphalt stores heat by day and releases it at night', 'City centres can be 3–5 °C warmer', 'Older people and outdoor workers are hit hardest'] },
    { k: 'end', t: 'Thank you', b: [] }];
  const PM = (lang) => ({ title: 'Birlesik', sub: 't', lang, source: 'topic', sourceId: null, yol: { k: 'research', yedek: 0 }, sources: [], istek: 5 });
  const KALITE = { version: 11, quality: { score: 81, issues: ['few_visuals'], pass: true } };
  const UZUN = 'Kentsel ısı adası etkisini azaltmak için ağaçlandırma, açık renkli çatı kaplamaları, geçirgen zemin, su öğeleri ve gölgelik koridorlar birlikte planlanmalı; her uygulamanın etkisi yaz aylarında ölçülmeli ve sonuçlar mahalle bazında kamuoyuyla paylaşılmalıdır.';
  /* sayfa: ortak hazırlık + deste + iki taşan asetat (biri tek, biri iki öğe; ikisinin başlığı aynı) */
  const ONCU = (strips, lang) => `
    window.__inv = []; window.__hata = []; window.__say = { save: 0, push: 0 }; var Q6 = window.__QA6;
    var ce = console.error; console.error = function () { window.__hata.push(Array.prototype.slice.call(arguments).map(String).join(' ').slice(0, 200)); return ce.apply(console, arguments); };
    window.addEventListener('error', function (e) { window.__hata.push('onerror ' + (e.message || '')); });
    window.addEventListener('unhandledrejection', function (e) { window.__hata.push('unhandled ' + String(e.reason && e.reason.message || e.reason)); });
    window.supabaseClient.functions.invoke = function (name, opt) { var b = (opt && opt.body) || {}; window.__inv.push(name + ':' + (b.action || 'research'));
      if (b.action === 'critique') return Promise.resolve({ data: JSON.parse(${JSON.stringify(JSON.stringify(KALITE))}) });
      if (b.action === 'plan') return Promise.resolve({ data: { plan: null, durum: 'kapali', rid: 'r' } });
      return Promise.resolve({ data: {} }); };
    var s0 = S.store.saveLocal, p0 = S.store.push;
    S.store.saveLocal = function () { window.__say.save++; return s0.apply(this, arguments); }; S.store.push = function () { window.__say.push++; return p0.apply(this, arguments); };
    ${lang === 'en' ? "localStorage.setItem('acadexUILang', 'en'); window.AX_EN = { t: { 'Kaynak': 'Source', 'Görsel': 'Image', 'Acadia · denetçi': 'Acadia · reviewer' } };" : ''}
    await sakin(); d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA); S.set(${JSON.stringify(strips)}, ${JSON.stringify(PM(lang))}); S.bas('new'); await sakin(); await bekle(3000); await dur(1500);
    var D = S.deck(), UZUN = ${JSON.stringify(UZUN)}, son = D.slides.pop();
    D.slides.push({ id: 'qa-t1', lay: 'list', bg: 'clear', els: [{ id: 'qa-h1', type: 'h', x: 70, y: 46, w: 820, h: 74, text: 'Taşan kutu', size: 40 }, { id: 'qa-t', type: 't', x: 70, y: 150, w: 420, h: 40, text: UZUN, size: 22 }] },
      { id: 'qa-t2', lay: 'list', bg: 'clear', els: [{ id: 'qa-h2', type: 'h', x: 70, y: 46, w: 820, h: 74, text: 'Taşan kutu', size: 40 }, { id: 'qa-a', type: 't', x: 70, y: 150, w: 380, h: 34, text: UZUN, size: 22 }, { id: 'qa-b', type: 't', x: 500, y: 150, w: 380, h: 34, text: UZUN, size: 22 }] },
      { id: 'qa-t3', lay: 'list', bg: 'clear', els: [{ id: 'qa-h3', type: 'h', x: 70, y: 46, w: 820, h: 74, text: 'Alttaki kutu', size: 40 }, { id: 'qa-c', type: 't', x: 70, y: 380, w: 420, h: 40, text: UZUN, size: 22 }] }, son);
    Q6.renderAll(); S.dirty(); await dur(2500);
    if (D.quality) D.qualityKey = Q6.deckKey(D);      /* içerik puanı bu deste için ölçülmüş sayılır (eleştiri test asetatlarından önce koştu) */
    var N1 = D.slides.length - 3, N2 = D.slides.length - 2, N3 = D.slides.length - 1;      /* 1'den sayılı */
    var dlg = function () { var o = d.querySelector('[data-qa-ov]'); return o ? o.closest('dialog') : null; };
    var ekran = function () { var g = dlg(); if (!g) return null; var ck = {}, sy = {};
      Array.prototype.forEach.call(g.querySelectorAll('[data-qa-ck]'), function (x) { ck[x.getAttribute('data-qa-ck')] = x.getAttribute('data-qa-durum'); });
      Array.prototype.forEach.call(g.querySelectorAll('[data-qa-say]'), function (x) { sy[x.getAttribute('data-qa-say')] = +x.textContent.replace(/[^0-9]/g, ''); });
      return { acik: g.open, katman: !!g.closest('#axu-layer'), ck: ck, say: sy, ozet: (g.querySelector('.qa-ov .au-sum span') || {}).textContent,
        it: Array.prototype.map.call(g.querySelectorAll('[data-qa-id]'), function (x) { return { id: x.getAttribute('data-qa-id'), src: x.getAttribute('data-qa-src'), pri: x.getAttribute('data-qa-pri'), onar: x.hasAttribute('data-qa-onar'), git: !!x.querySelector('[data-au-go]') }; }),
        det: g.querySelector('[data-qa-det]').textContent.replace(/[ ]+/g, ' ').trim(), pre: !!g.querySelector('[data-qa-pre]'), ok: !!g.querySelector('[data-qa-ok]'), no: !!g.querySelector('[data-qa-no]'), undo: !!g.querySelector('[data-qa-undo]'),
        pv: g.querySelectorAll('.qa-pv .sx-thv .sx-slide').length, son: (g.querySelector('[data-qa-son]') || { getAttribute: function () { return null; } }).getAttribute('data-qa-son'),
        gq: (g.querySelector('[data-gq] [data-gq-durum]') || { getAttribute: function () { return null; } }).getAttribute('data-gq-durum'), run: !!g.querySelector('[data-gq] [data-gq-run]'), bilgi: g.textContent.indexOf('Gemini hizmetine') >= 0, eski: !!g.querySelector('[data-au-all],[data-au-fix]') }; };
    var tik = function (sec) { var b = dlg().querySelector(sec); if (!b) throw new Error('düğme yok: ' + sec); b.click(); };
    var sec = function (id) { tik('[data-qa-sel="' + id + '"]'); };
    var izle = function () { return { deste: JSON.stringify(D.slides), undo: Q6.undoN(), redo: Q6.redoN(), say: JSON.stringify(window.__say), kirli: !!S.store.dirty }; };
  `;
  const ANA = ONCU(TR, 'tr') + `
    /* görsel rapor: yeni bir Phase 5 sonucu (bilinmeyen kod ve içerikle aynı kodlu bulgu dahil) */
    Q6.gorselIz.set(D, { anahtar: Q6.gorselAnahtar(D), sonuc: { v: 1, status: 'warn', checkedSlides: D.slides.length, skippedSlides: 0, errors: 0, warnings: 3, codes: ['VQ_TEXT_DENSE', 'DUPLICATE_TITLE', 'VQ_FOO'],
      issues: [{ code: 'VQ_TEXT_DENSE', severity: 'warning', slide: 2, why: 'çok <b>yazı</b>' }, { code: 'DUPLICATE_TITLE', severity: 'warning', slide: N2, why: 'aynı başlık' }, { code: 'VQ_FOO', severity: 'warning', slide: 3, why: 'x' }] } });
    R.kalite = D.quality ? { score: D.quality.score, issues: D.quality.issues, key: D.qualityKey === Q6.deckKey(D) } : null; R.N1 = N1; R.N2 = N2; R.N3 = N3;
    var plan = function (n) { var x = Q6.liste(D).bulgu.filter(function (z) { return z.id === 'TEXT_OVERFLOW@' + n; })[0]; var p = x && Q6.plan(x); return p && p.ok ? p.degis.map(function (g) { return [g.id, g.once, g.sonra]; }).concat([p.enKucuk]) : null; };
    R.plan = { 1: plan(N1), 3: plan(N3) }; R.n = D.slides.length; R.hazir = Q6.snapHazir(D);
    var inv0 = window.__inv.length, iz0 = izle();
    d.querySelector('[data-audit]').click(); await bekle(400);
    R.ac = ekran(); R.acIz = JSON.stringify(izle()) === JSON.stringify(iz0);
    R.liste = Q6.liste(D).bulgu.map(function (x) { return { id: x.id, source: x.source, sources: x.sources, code: x.code, severity: x.severity, priority: x.priority, slideIndex: x.slideIndex, repairable: x.repairable, els: x.els, message: x.message, recommendation: x.recommendation }; });
    R.kontrol = (function () { var K = Q6.liste(D).kontrol, o = {}; Object.keys(K).forEach(function (k) { o[k] = K[k].durum; }); return o; })();
    R.teknik = Q6.teknikQA(D, 'deste').summary;
    /* süzgeç */
    tik('[data-qa-f="src"][data-v="visual"]'); R.fVis = ekran().it; tik('[data-qa-f="pri"][data-v="orta"]'); R.fVisOrta = ekran().it;
    tik('[data-qa-f="src"][data-v="all"]'); tik('[data-qa-f="pri"][data-v="all"]'); R.fTum = ekran().it.length;
    /* düzeltilemeyenler: görsel, görsel + içerik, bilinmeyen kod */
    sec('VQ_TEXT_DENSE@2'); R.vis = ekran(); sec('DUPLICATE_TITLE@' + N2); R.dup = ekran(); sec('VQ_FOO@3'); R.foo = ekran();
    R.salt = JSON.stringify(izle()) === JSON.stringify(iz0);
    /* önizle → vazgeç: hiçbir şey değişmez */
    sec('TEXT_OVERFLOW@' + N1); R.sec = ekran(); tik('[data-qa-pre]'); await bekle(300); R.pre = ekran(); R.preIz = izle(); await bekle(900); R.preIz2 = izle();
    R.pvMetin = (dlg().querySelector('.qa-pv ul') || {}).textContent;
    tik('[data-qa-no]'); await bekle(200); R.no = ekran(); R.noIz = izle();
    /* önizlemeden sonra deste değişirse onay uygulanmaz */
    tik('[data-qa-pre]'); var bh = D.slides[1].els.filter(function (e) { return e.type === 'h'; })[0], eskiB = bh.text; bh.text = eskiB + ' (yeni)'; var degisti = JSON.stringify(D.slides);
    tik('[data-qa-ok]'); await bekle(200); R.degisti = { e: ekran(), ayni: JSON.stringify(D.slides) === degisti, undo: Q6.undoN() === iz0.undo };
    bh.text = eskiB;
    /* onay sırasında hata: ikinci öğenin yüksekliği yazılamaz → ilk öğenin boyutu da geri konur, geri alma adımı yok */
    sec('TEXT_OVERFLOW@' + N2); R.sec2 = ekran(); tik('[data-qa-pre]'); await bekle(300); R.pre2 = ekran();
    var hb = D.slides[N2 - 1].els.filter(function (e) { return e.id === 'qa-b'; })[0], hv = hb.h, oncesiH = JSON.stringify(D.slides);
    Object.defineProperty(hb, 'h', { configurable: true, enumerable: true, get: function () { return hv; }, set: function (v) { if (v !== hv) throw new Error('yazılamaz'); } });
    tik('[data-qa-ok]'); await bekle(300); R.hatali = { e: ekran(), ayni: JSON.stringify(D.slides) === oncesiH, undo: Q6.undoN() === iz0.undo }; await bekle(900); R.hatali.say = JSON.stringify(window.__say) === iz0.say;
    delete hb.h; hb.h = hv;
    /* onay: yalnız seçili düzeltme, tek geri alma adımı, kirli + kayıt */
    sec('TEXT_OVERFLOW@' + N1); tik('[data-qa-pre]'); await bekle(300);
    var once = JSON.parse(JSON.stringify(D.slides)), u0 = Q6.undoN(), sv0 = window.__say.save;
    tik('[data-qa-ok]'); await bekle(300); R.ok = ekran(); R.okKirli = !!S.store.dirty; await bekle(1200);
    var sonra = JSON.parse(JSON.stringify(D.slides));
    R.fark = []; sonra.forEach(function (s, i) { s.els.forEach(function (e, j) { var o = once[i].els[j]; Object.keys(Object.assign({}, o, e)).forEach(function (k) { if (JSON.stringify(o[k]) !== JSON.stringify(e[k])) R.fark.push([i + 1, e.id, k, o[k], e[k]]); }); }); });
    R.okYapi = once.length === sonra.length && once.every(function (s, i) { return s.id === sonra[i].id && s.els.length === sonra[i].els.length && JSON.stringify(Object.assign({}, s, { els: 0 })) === JSON.stringify(Object.assign({}, sonra[i], { els: 0 })); });
    R.okUndo = Q6.undoN() - u0; R.okRedo = Q6.redoN(); R.okKayit = window.__say.save - sv0; R.okToast = (d.querySelector('[data-toast-t]') || {}).textContent;
    R.okTeknik = Q6.teknikQA(D, 'deste').issues.filter(function (z) { return z.code === 'TEXT_OVERFLOW'; }).map(function (z) { return z.slide + ':' + z.element; });
    R.okKontrol = (function () { var K = Q6.liste(D).kontrol; return { visual: K.visual.durum }; })();
    /* geri al: deste onaydan önceki hâline döner */
    tik('[data-qa-undo]'); await bekle(400); R.geri = { e: ekran(), ayni: JSON.stringify(D.slides) === JSON.stringify(once), undo: Q6.undoN() === u0 };
    /* asetata git */
    var gt = dlg().querySelector('[data-qa-id="TEXT_OVERFLOW@' + N1 + '"] [data-au-go]'); gt.click(); await bekle(300); R.git = { kapali: !dlg().open, cur: D.cur };
    /* eksik / bayat / eski / okunamayan raporlar (deste aynı kalır) */
    var q0 = D.quality, k0 = D.qualityKey, an = Q6.gorselAnahtar(D), durum = function () { var K = Q6.liste(D).kontrol; return { c: K.content.durum, v: K.visual.durum, t: K.technical.durum }; };
    var kodlar = function () { return Q6.liste(D).bulgu.map(function (x) { return x.id + ':' + x.priority + ':' + x.sources.join('+'); }); };
    R.d = {};
    D.quality = null; R.d.icerikYok = durum();
    D.quality = { score: 'x', issues: [] }; R.d.icerikBozuk = durum();
    D.quality = { score: 80, issues: ['few_visuals', 'zz_yeni'], pass: true }; D.qualityKey = null; R.d.icerikAnahtarsiz = durum(); R.d.icerikAnahtarsizK = kodlar();
    D.qualityKey = 'eski|anahtar'; R.d.icerikBayat = durum(); R.d.icerikBayatK = kodlar();
    D.quality = { score: 90, issues: [], pass: true }; D.qualityKey = Q6.deckKey(D); R.d.icerikTaze = durum();
    D.quality = q0; D.qualityKey = k0;
    Q6.gorselIz.delete(D); R.d.gorselYok = durum();
    Q6.gorselIz.set(D, { anahtar: 'eski', sonuc: { v: 1, status: 'pass', checkedSlides: 3, skippedSlides: 0, errors: 0, warnings: 0, codes: [], issues: [] } }); R.d.gorselBayat = durum();
    Q6.gorselIz.set(D, { anahtar: an, sonuc: { v: 1, status: 'unavailable', checkedSlides: 0, skippedSlides: 0, errors: 0, warnings: 0, codes: [], issues: [] } }); R.d.gorselYapilamadi = durum();
    Q6.gorselIz.set(D, { anahtar: an, sonuc: { v: 1, status: 'warn', checkedSlides: 4, skippedSlides: 2, errors: 0, warnings: 1, codes: ['VQ_PARTIAL'], issues: [{ code: 'VQ_PARTIAL', severity: 'warning', slide: null, why: '' }] } }); R.d.gorselKismi = durum();
    Q6.gorselIz.set(D, { anahtar: an, sonuc: { v: 1, status: 'pass', checkedSlides: D.slides.length, skippedSlides: 0, errors: 0, warnings: 0, codes: [], issues: [] } }); R.d.gorselGecti = durum();
    Q6.gorselIz.delete(D);
    Q6.gorselYuklu.set(D, { v: 1, h: an, status: 'warn', checked: D.slides.length, skipped: 0, errors: 0, warnings: 1, codes: ['VQ_TEXT_DENSE', 'VQ_PARTIAL'], issues: [[2, 'VQ_TEXT_DENSE'], [3, 'VQ_ZZ'], ['x', 'y']] }); R.d.hesap = durum(); R.d.hesapK = kodlar();
    Q6.gorselYuklu.set(D, { v: 1, h: 'eski', status: 'pass', checked: 3, skipped: 0, errors: 0, warnings: 0, codes: [], issues: [] }); R.d.hesapBayat = durum();
    Q6.gorselYuklu.set(D, { v: 2 }); R.d.hesapBozuk = durum(); Q6.gorselYuklu.delete(D);
    R.d.ayni = JSON.stringify(D.slides) === JSON.stringify(once);
    /* öncelik tablosu ve öneriler */
    R.pri = [['DECK_EMPTY', 'error'], ['EXPORT_FAILED', 'error'], ['PDF_PAGE_MISMATCH', 'error'], ['DECK_SKELETON', 'error'], ['TEXT_OVERFLOW', 'error'], ['EL_OVERLAP', 'warning'], ['SNAPSHOT_PENDING', 'info'], ['VQ_PARTIAL', 'warning'], ['VQ_BROKEN', 'error'], ['zz', null], ['zz', 'tuhaf']].map(function (p) { return Q6.oncelik(p[0], p[1]); });
    R.oneriEksik = [].concat(Object.keys(Q6.TEKNIK), Object.keys(Q6.GORSEL), Object.keys(Q6.ICERIK), Object.keys(Q6.KALITE_TR)).filter(function (c) { return !Q6.ONERI[c]; });
    /* görsel rapor yokken pencere: Phase 5 açıklaması + gizlilik bildirimi + başlat düğmesi yerinde */
    d.querySelector('[data-audit]').click(); await bekle(400); R.yok = ekran(); dlg().close();
    R.inv = window.__inv.slice(inv0); R.hataK = window.__hata;
  `;
  /* EN + dar ekran: sözlük kapsaması (ekrandaki her yazı) + tek sütun + yatay taşma yok */
  const DAR = ONCU(EN, 'en') + `
    Q6.gorselIz.set(D, { anahtar: Q6.gorselAnahtar(D), sonuc: { v: 1, status: 'warn', checkedSlides: D.slides.length, skippedSlides: 0, errors: 0, warnings: 1, codes: ['VQ_TEXT_DENSE'], issues: [{ code: 'VQ_TEXT_DENSE', severity: 'warning', slide: 2, why: 'dense' }] } });
    d.querySelector('[data-audit]').click(); await bekle(400); sec('TEXT_OVERFLOW@' + N1); tik('[data-qa-pre]'); await bekle(300);
    var A = window.AX_EN.t, g = dlg(), basliklar = D.slides.map(function (s) { var h = s.els.filter(function (e) { return e.type === 'h'; })[0]; return h ? h.text : ''; });
    var cevir = function (t) { if (A[t] != null) return true; var r = t.replace(/[0-9]+/g, '{#}'); if (A[r] != null) return true;
      if (t.indexOf(' · ') > 0) return t.split(' · ').every(cevir); var k = t.replace(/[:…!?.]+$/, ''); return k !== t && k && cevir(k); };
    var eksik = [], tw = d.createTreeWalker(g, NodeFilter.SHOW_TEXT), n;
    while ((n = tw.nextNode())) { var t = n.nodeValue.replace(/[ \\n]+/g, ' ').trim(); if (!t || /^[0-9 .·∗×+→%/]*$/.test(t)) continue;
      var p = n.parentNode; if (p.closest('code,.qa-pv .sx-thv,.qa-m small,.qa-why small') || basliklar.indexOf(t) >= 0) continue; if (!cevir(t)) eksik.push(t); }
    R.eksik = eksik; R.on = { eski: A['Acadia · denetçi'], kaynak: A['Kaynak'], gorsel: A['Görsel'], ck: A['İçerik denetimi'], ok: A['onayla ve uygula'], st: ['geçti', 'uyarı', 'hata', 'kısmi', 'denetlenmedi', 'kullanılamadı', 'bayat', 'belirsiz'].map(function (k) { return A[k]; }) };
    var gr = getComputedStyle(g.querySelector('.qa-grid')).gridTemplateColumns.split(' ').length, ck = getComputedStyle(g.querySelector('.qa-cks')).gridTemplateColumns.split(' ').length;
    var r = g.querySelector('.sxd-in').getBoundingClientRect();
    R.dar = { en: window.innerWidth, grid: gr, ck: ck, sol: Math.round(r.left), sag: Math.round(r.right), yatay: g.scrollWidth - g.clientWidth, pv: g.querySelectorAll('.qa-pv .sx-thv .sx-slide').length,
      tasan: Array.prototype.filter.call(g.querySelectorAll('.sxd-in *'), function (x) { var b = x.getBoundingClientRect(); return b.width && !x.closest('.qa-pv .sx-thv') && (b.right > window.innerWidth + 1 || b.left < -1); }).length };
    R.hataK = window.__hata; R.inv = window.__inv;
  `;
  const kosu = async (ad, govde, gen) => {
    const H = yeniSunucu({ senkron: true }); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r));
    try { return await kos('qa6-' + ad + '.html', 'qa6-' + ad, qaSayfa(H.srv.address().port, govde), gen); } finally { H.srv.close(); }
  };
  const K = { ana: await kosu('ana', ANA), dar: await kosu('dar', DAR, 390) };
  temizle();
  if (process.env.QA6_DOKUM) fs.writeFileSync(process.env.QA6_DOKUM, JSON.stringify(K, null, 1));
  const T = K.ana;
  const bul = (id) => T.liste.find((x) => x.id === id);

  test('U5 düzenek: deste kuruldu, yazı doğrulandı, içerik puanı ölçüldü, konsol hatası yok', () => {
    assert.ok(!T.hata, T.hata); assert.deepEqual(T.hataK, []); assert.equal(T.hazir, true, 'snapHazir');
    assert.ok(T.kalite && T.kalite.score === 81 && T.kalite.key, 'içerik puanı: ' + JSON.stringify(T.kalite));
  });

  test('U6 üç rapor tek listede: normalize alanlar, kontrol durumları, öncelik sayıları, pencere katmanda; açmak desteyi değiştirmez', () => {
    assert.ok(T.ac.acik && T.ac.katman, 'pencere açık ve #axu-layer içinde');
    assert.deepEqual(T.kontrol, { technical: T.teknik.errors ? 'error' : T.teknik.warnings ? 'warning' : 'passed', content: 'warning', visual: 'warning' });
    assert.deepEqual(T.ac.ck, T.kontrol, 'ekrandaki durumlar bağdaştırıcıyla aynı');
    T.liste.forEach((x) => {
      assert.deepEqual(Object.keys(x).sort(), ['code', 'els', 'id', 'message', 'priority', 'recommendation', 'repairable', 'severity', 'slideIndex', 'source', 'sources'].sort());
      assert.ok(['technical', 'content', 'visual'].includes(x.source) && x.sources[0] === x.source && ['kritik', 'yuksek', 'orta', 'dusuk'].includes(x.priority) && x.message && x.recommendation);
      assert.ok(x.slideIndex === null || (x.slideIndex >= 0 && x.slideIndex < T.n));
    });
    assert.deepEqual(T.ac.it.map((x) => x.id), T.liste.map((x) => x.id), 'ekran sırası = öncelik sırası');
    const sy = {}; T.liste.forEach((x) => { sy[x.priority] = (sy[x.priority] || 0) + 1; }); assert.deepEqual(T.ac.say, sy);
    assert.equal(T.ac.ozet, T.n + ' asetat · ' + T.liste.length + ' bulgu');
    assert.equal(T.ac.gq, 'completed', 'taze görsel sonuç: Phase 5 özeti pencerede');
    assert.deepEqual([T.yok.gq, T.yok.run, T.yok.bilgi, T.yok.ck.visual], ['none', true, true, 'not_checked'], 'görsel rapor yokken açıklama + gizlilik + düğme'); assert.equal(T.ac.eski, false, 'eski düzelt düğmeleri yok');
    assert.equal(T.acIz, true, 'açılış desteyi, geri alma yığınını, kayıt sayısını, kirli bayrağını değiştirmedi');
    const ord = T.liste.map((x) => ['kritik', 'yuksek', 'orta', 'dusuk'].indexOf(x.priority)); assert.deepEqual(ord, ord.slice().sort((a, b) => a - b));
  });

  test('U7 birleştirme: aynı kod + aynı asetat tek bulgu (öğeler ve kaynaklar korunur); farklı kod ya da asetat ayrı kalır; bilinmeyen kod ham', () => {
    const t1 = bul('TEXT_OVERFLOW@' + T.N1), t2 = bul('TEXT_OVERFLOW@' + T.N2);
    assert.ok(t1 && t2, 'iki asetattaki taşma ayrı bulgu');
    assert.deepEqual(t1.els, ['qa-t']); assert.deepEqual(t2.els.slice().sort(), ['qa-a', 'qa-b'], 'aynı asetattaki iki taşan öğe tek bulguda');
    assert.equal(T.liste.filter((x) => x.code === 'TEXT_OVERFLOW' && x.slideIndex === T.N2 - 1).length, 1);
    assert.deepEqual([t1.priority, t1.severity, t1.repairable, t2.repairable], ['yuksek', 'error', true, true]);
    const dp = bul('DUPLICATE_TITLE@' + T.N2); assert.deepEqual(dp.sources, ['content', 'visual'], 'içerik + görsel aynı kod aynı asetat → tek bulgu, iki kaynak');
    assert.deepEqual([dp.priority, dp.repairable], ['orta', false]);
    assert.ok(!bul('DUPLICATE_TITLE@' + T.N1), 'ilk başlık çift sayılmaz');
    const fo = bul('VQ_FOO@3'); assert.deepEqual([fo.message, fo.priority, fo.source, fo.repairable], ['VQ_FOO', 'orta', 'visual', false]);
    assert.equal(fo.recommendation, 'Asetatı açıp bu bulguyu gözden geçir.');
    assert.ok(bul('few_visuals@0') && bul('few_visuals@0').slideIndex === null, 'içerik puanının deste geneli bulgusu');
    assert.ok(bul('VQ_TEXT_DENSE@2'));
    assert.deepEqual(T.liste.filter((x) => x.repairable).map((x) => x.code), ['TEXT_OVERFLOW', 'TEXT_OVERFLOW', 'TEXT_OVERFLOW'], 'yalnız teknik taşma onarılabilir');
  });

  test('U8 süzgeç (kaynak + öncelik) ve düzeltilemeyen bulgular: görsel bulgu için önizleme düğmesi yok', () => {
    assert.ok(T.fVis.length && T.fVis.every((x) => T.liste.find((y) => y.id === x.id).sources.includes('visual')));
    assert.deepEqual(T.fVis.map((x) => x.id).sort(), T.liste.filter((x) => x.sources.includes('visual')).map((x) => x.id).sort());
    assert.ok(T.fVisOrta.every((x) => x.pri === 'orta'));
    assert.equal(T.fTum, T.liste.length);
    for (const e of [T.vis, T.dup]) { assert.equal(e.pre, false); assert.match(e.det, /Görsel bulgular kendiliğinden düzeltilmez/); }
    assert.equal(T.foo.pre, false); assert.match(T.foo.det, /VQ_FOO/);
    assert.match(T.vis.det, /Kaynak\s*Görsel denetim/); assert.match(T.dup.det, /İçerik denetimi, Görsel denetim/);
    assert.equal(T.salt, true, 'seçmek ve süzmek desteyi değiştirmez');
  });

  test('U9 önizleme canlı desteyi değiştirmez; vazgeç etkisizdir', () => {
    assert.equal(T.sec.pre, true); assert.match(T.sec.det, /önce önizlersin/);
    assert.ok(T.pre.ok && T.pre.no && T.pre.pv === 2, 'önce/sonra iki asetat + onayla/vazgeç');
    assert.match(T.pvMetin, /kutu yüksekliği 40 → \d+|yazı boyutu \d+ → \d+/);
    const iz = (x) => JSON.stringify([x.deste, x.undo, x.redo, x.say, x.kirli]);
    assert.equal(iz(T.preIz), iz(T.preIz2), 'önizleme sonrası kayıt/kirli olmadı');
    assert.equal(T.preIz.deste, T.noIz.deste); assert.equal(T.preIz.undo, T.noIz.undo);
    assert.equal(T.no.pre, true); assert.equal(T.no.ok, false); assert.equal(T.no.pv, 0);
  });

  test('U9b onarım sırası: yer varsa yazı boyutu korunur, yalnız kutu uzar; yer yoksa Phase 1 sığdırması (en küçük yazı bildirilir)', () => {
    const [p1, k1] = [T.plan[1][0], T.plan[1].at(-1)];
    assert.deepEqual([p1[0], p1[2].size, p1[2].w], ['qa-t', 22, 420], 'şablonun yazı boyutu kalır: ' + JSON.stringify(T.plan[1]));
    assert.ok(p1[2].h > 40 && p1[1].h === 40); assert.deepEqual(k1, []);
    const p3 = T.plan[3]; assert.ok(p3, 'alttaki kutu için de güvenli plan bulunmalı');
    assert.equal(p3[0][0], 'qa-c'); assert.ok(p3[0][2].size < 22, 'kutu asetattan taşacağı için yazı küçülür: ' + JSON.stringify(p3));
    assert.ok(380 + p3[0][2].h <= 532, 'kutu asetat içinde kalır');
  });

  test('U10 önizlemeden sonra deste değişirse ve onay sırasında hata olursa hiçbir şey yazılmaz (yarım onarım yok)', () => {
    assert.equal(T.degisti.e.son, 'degisti'); assert.equal(T.degisti.ayni, true); assert.equal(T.degisti.undo, true);
    assert.equal(T.pre2.ok, true, 'iki öğeli taşma için güvenli plan bulundu');
    assert.equal(T.hatali.e.son, 'hata'); assert.equal(T.hatali.ayni, true, 'ilk öğenin boyutu da geri konmalı'); assert.equal(T.hatali.undo, true); assert.equal(T.hatali.say, true, 'kaydettirmez');
  });

  test('U11 onay yalnız seçili düzeltmeyi uygular: yalnız o öğenin size/w/h değeri, tek geri alma adımı, kirli + kayıt; taşma kalkar', () => {
    assert.equal(T.ok.son, 'ok'); assert.equal(T.ok.undo, true);
    assert.ok(T.fark.length >= 1 && T.fark.every((f) => f[0] === T.N1 && f[1] === 'qa-t' && ['size', 'w', 'h'].includes(f[2])), 'fark: ' + JSON.stringify(T.fark));
    assert.equal(T.okYapi, true, 'asetat sırası, kimlikleri, öteki alanlar aynı');
    assert.deepEqual([T.okUndo, T.okRedo], [1, 0]); assert.equal(T.okKirli, true); assert.ok(T.okKayit >= 1, 'kayıt tetiklendi');
    assert.equal(T.okToast, 'Düzeltme uygulandı.');
    assert.ok(!T.okTeknik.some((z) => z.startsWith(T.N1 + ':')), 'onarılan asetatta taşma kaldı: ' + T.okTeknik);
    assert.ok(T.okTeknik.some((z) => z.startsWith(T.N2 + ':')), 'öteki asetatın taşması dokunulmadan kalır');
    assert.ok(!T.ok.it.some((x) => x.id === 'TEXT_OVERFLOW@' + T.N1)); assert.equal(T.okKontrol.visual, 'stale', 'görsel rapor artık bayat');
  });

  test('U12 geri al desteyi onaydan önceki hâline döndürür; asetata git pencereyi kapatıp asetatı açar', () => {
    assert.equal(T.geri.ayni, true); assert.equal(T.geri.undo, true); assert.equal(T.geri.e.son, 'geri');
    assert.ok(T.geri.e.it.some((x) => x.id === 'TEXT_OVERFLOW@' + T.N1 && x.onar));
    assert.deepEqual(T.git, { kapali: true, cur: T.N1 - 1 });
  });

  test('U13 eksik/bayat/eski/okunamayan rapor asla "geçti" değil; öncelik tablosu; her kodun önerisi var; ağ isteği yok', () => {
    const D = T.d;
    assert.equal(D.icerikYok.c, 'not_checked'); assert.equal(D.icerikBozuk.c, 'uncertain'); assert.equal(D.icerikAnahtarsiz.c, 'uncertain'); assert.equal(D.icerikBayat.c, 'stale');
    assert.ok(D.icerikAnahtarsizK.includes('few_visuals@0:orta:content') && D.icerikAnahtarsizK.includes('zz_yeni@0:orta:content'), 'eski kayıtta model bulguları gösterilir');
    assert.ok(!D.icerikBayatK.some((k) => /^(few_visuals|zz_yeni)@/.test(k)), 'bayat puanın bulguları gösterilmez');
    assert.equal(D.icerikTaze.c, 'warning', 'yerel içerik bulgusu (çift başlık) varken "geçti" değil');
    assert.equal(D.gorselYok.v, 'not_checked'); assert.equal(D.gorselBayat.v, 'stale'); assert.equal(D.gorselYapilamadi.v, 'unavailable'); assert.equal(D.gorselKismi.v, 'partial'); assert.equal(D.gorselGecti.v, 'passed');
    assert.equal(D.hesap.v, 'warning'); assert.ok(D.hesapK.includes('VQ_TEXT_DENSE@2:orta:visual') && D.hesapK.includes('VQ_ZZ@3:orta:visual') && D.hesapK.includes('VQ_PARTIAL@0:dusuk:visual'), D.hesapK.join());
    assert.equal(D.hesapBayat.v, 'stale'); assert.equal(D.hesapBozuk.v, 'uncertain'); assert.equal(D.ayni, true);
    assert.deepEqual(T.pri, ['kritik', 'kritik', 'kritik', 'kritik', 'yuksek', 'orta', 'dusuk', 'dusuk', 'yuksek', 'orta', 'orta']);
    assert.deepEqual(T.oneriEksik, []);
    assert.deepEqual(T.inv.filter((x) => !/critique$/.test(x)), [], 'denetim penceresi ağ isteği yapmaz: ' + T.inv);
  });

  test('U14 EN: ekrandaki her yazının karşılığı var, var olan anahtar ezilmez; dar ekran (başsız Chrome en az 500 px; kırılım 640 px): tek sütun, yatay taşma yok', () => {
    const E = K.dar; assert.ok(!E.hata, E.hata); assert.deepEqual(E.hataK, []);
    assert.deepEqual(E.eksik, [], 'çevirisi olmayan yazılar');
    assert.deepEqual([E.on.kaynak, E.on.gorsel, E.on.ck, E.on.ok], ['Source', 'Image', 'Content check', 'confirm and apply']);
    assert.deepEqual(E.on.st, ['passed', 'warning', 'error', 'partial', 'not checked', 'unavailable', 'stale', 'uncertain']);
    assert.ok(E.dar.en <= 640, 'mobil kırılımın altında: ' + E.dar.en); assert.equal(E.on.eski, 'Acadia · reviewer', 'var olan anahtar ezilmez'); assert.deepEqual([E.dar.grid, E.dar.ck], [1, 1]); assert.equal(E.dar.pv, 2);
    assert.ok(E.dar.sol >= 0 && E.dar.sag <= E.dar.en, 'pencere ekranda: ' + JSON.stringify(E.dar)); assert.ok(E.dar.yatay <= 1, 'yatay kaydırma'); assert.equal(E.dar.tasan, 0);
  });
  summary();
})().catch((e) => { console.error('  FAIL  tarayıcı düzeneği\n        ' + (e && e.stack || e)); process.exitCode = 1; });
