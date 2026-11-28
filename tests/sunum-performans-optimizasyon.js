/* ==========================================================================
   ACADEX — SUNUM PERFORMANS, GÜVENİLİRLİK VE MALİYET (tests/sunum-performans-optimizasyon.js)

   NEDEN VAR (28.11.2026, #56 Phase 11): önce ölç, sonra yalnız kanıtlanan darboğazı düzelt.
     Ölçülen darboğaz: asetat değiştirmek (go) dirty() çağırıyordu — her gezinme destenin bütününü
     yerel olarak yeniden yazıyor, 1,5 sn sonra hesaptaki bütün asetat satırlarını silip yeniden
     ekliyor, updated/bekleyen işaretini ilerletiyordu (yalnız deck.cur değişmişken; cur hesaba
     yazılmaz). Şimdi gezinme yalnız yerel cur yazımıdır (curSakla): hesaba istek yok, updated/bekleyen
     dokunulmaz, bekleyen gerçek kayıt iptal edilmez.
     Ölçüm sırasında bulunan kayıt hatası (önce sürümünde de vardı): yerel alan (görseller) dolunca deste yerelde yazılamıyor
     ama meta updated ilerliyordu; sonraki yerel açılış eski kopyayı gösteriyordu. Şimdi yazım başarısızsa updated 0 → hesaptan açılır (B3).
     Sunucu: içerik günlüğü (konu, sorgu, alt başlık, Tavily sorgusu, Groq hata gövdesi, hata yığını)
     sayıya/koda indi; 500 yanıtı iç hata metnini döndürmez; Content-Length başlığı olmayan büyük gövde
     model çağrısından önce 413.

   Bölümler: A ön yüz ölçümü (gerçek saat, DevTools protokolü; ≥3 tekrar, ortanca) · B kayıt/yükleme (sahte
   hesap sunucusu, yazım sayısı ve yük) · C gerçek PPTX ZIP yapısı (XML/ilişki sayımı; GÖRSEL DOĞRULAMA DEĞİLDİR) ·
   D sunucu yolu (gerçek Deno.serve işleyicisi; Groq/Tavily/createClient sahte) · E sıfır metrikleri.
   Desteler sentetiktir; süreler bu makinede başsız Chrome ölçümüdür, gerçek kullanıcı performansı değildir.
   Çalıştırma:  node tests/sunum-performans-optimizasyon.js
     PERF_TAM=1        §13'ün 12 destesinin hepsi (varsayılan: 3 temsilci deste; run-all 120 sn sınırı)
     PERF_TEKRAR=n     tekrar sayısı (en az 3)
     PERF_INK=dosya    başka bir acadex-ink.js ile ölç (önce/sonra karşılaştırması; kaynak denetimleri atlanır)
     DOKUM=dosya.json  ham ölçümler
     PPTXGEN_BUNDLE    pptxgenjs@3.12.0 paketi (yoksa C ATLANDI, geçti sayılmaz)
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { makeRunner, readSource } = require('./_ts-extract.js');
const { ROOT, read, CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');

const { test, summary } = makeRunner();
const INK_YOL = process.env.PERF_INK || '';
const ink = INK_YOL ? fs.readFileSync(INK_YOL, 'utf8').replace(/\r\n/g, '\n') : read('js/acadex-ink.js');
const SRV_PATH = 'supabase/functions/sunum-research/index.ts';
const srv = read(SRV_PATH);
const TEKRAR = Math.max(3, +process.env.PERF_TEKRAR || 3);
const BUNDLE = [process.env.PPTXGEN_BUNDLE, path.join(ROOT, 'node_modules/pptxgenjs/dist/pptxgen.bundle.js')].filter(Boolean).find((p) => fs.existsSync(p)) || null;
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, 'bulunamadı: ' + a.slice(0, 60)); const j = s.indexOf(b, i + a.length); assert.ok(j > i, 'son bulunamadı: ' + b.slice(0, 60)); return s.slice(i, j); };
const ortanca = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };

/* §13 sentetik küme: [ad, tür, asetat] — 3 metin, 3 görsel, 2 grafik, 2 kaynakça/iddia, 2 karma */
const KUME = [['metin-10', 'metin', 10], ['metin-30', 'metin', 30], ['metin-50', 'metin', 50], ['gorsel-10', 'gorsel', 10], ['gorsel-30', 'gorsel', 30], ['gorsel-50', 'gorsel', 50],
  ['grafik-10', 'grafik', 10], ['grafik-30', 'grafik', 30], ['kaynak-10', 'kaynak', 10], ['kaynak-30', 'kaynak', 30], ['karma-30', 'karma', 30], ['karma-50', 'karma', 50]];
const SECILEN = process.env.PERF_TAM ? KUME : KUME.filter((k) => /^(metin-10|gorsel-30|karma-50)$/.test(k[0]));

/* ========================================================================== kaynak kuralları */
if (!INK_YOL) {
  test('A0 gezinme yalnız yerel cur yazar: go dirty() çağırmaz, curSakla bekleyen kaydı iptal etmez, store.saveCur updated/bekleyen/queueCloud yok', () => {
    const go = cut(ink, '  var go = function (i, focusThumb) {', '\n  };\n');
    assert.doesNotMatch(go, /\bdirty\(\)/, 'gezinme tam kayıt tetikliyor'); assert.match(go, /commitEdit\(\);/, 'süren düzenleme önce işlenir'); assert.match(go, /curSakla\(\);/);
    const cs = cut(ink, '  var curT = 0, curSakla = function', '\n'); assert.match(cs, /if \(store\.dirty\) return;/); assert.doesNotMatch(cs, /clearTimeout\(sT\)|queueCloud|store\.timer/);
    const sc = cut(ink, '    saveCur: function (d) {', '/* #56'); assert.doesNotMatch(sc, /updated|bekleyen|queueCloud|push\(|iddiaTazele/); assert.match(sc, /kaliciJSON/);
  });
}

/* ========================================================================== tarayıcı sayfası */
const KANCA = `  window.__P = { go: go, renderAll: function () { renderAll(); }, openAudit: openAudit, auKapat: function () { if (auDlg && auDlg.open) auDlg.close(); }, sdAc: sdAc, exp: exportPptx,
    sayiAyarla: sayiAyarla, hazirla: function () { plotHazir = true; paintStrips(); }, openDeck: openDeck, undoN: function () { return undoS.length; }, undo: undo,
    duzenle: function (id, metin) { var el = stage.querySelector('[data-id="' + id + '"]'); if (!el) return false; editId = id; el.setAttribute('contenteditable', 'true'); el.innerText = metin; commitEdit(); return true; } };\n`;

const GOVDE = (tekrar) => `
  await sakin(); window.__pptx = []; var P = window.__P, TEKRAR = ${tekrar};
  var P0 = window.PptxGenJS; if (P0) P0.prototype.writeFile = function (o) { return this.write({ outputType: 'base64' }).then(function (b) { window.__pptx.push(b); return o && o.fileName; }); };
  /* yerel yazım sayacı (bayt = UTF-16 karakter) */
  window.__ls = { n: 0, bayt: 0, deste: 0 }; var ls0 = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (window.__dolu && /\\.d\\./.test(k)) throw new DOMException('dolu', 'QuotaExceededError'); window.__ls.n++; window.__ls.bayt += String(v).length; if (/\\.d\\./.test(k)) window.__ls.deste++; return ls0.apply(this, arguments); };
  var ms = function (f) { var t = performance.now(); f(); void d.body.offsetHeight; return performance.now() - t; };      /* zorunlu yerleşim dahil */
  var ort = function (a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[s.length >> 1]; };
  var foto = function (w, h, i) { var cv = d.createElement('canvas'); cv.width = w; cv.height = h; var x = cv.getContext('2d'), g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'hsl(' + (i * 47 % 360) + ',60%,45%)'); g.addColorStop(1, '#eee'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (var k = 0; k < 400; k++) { x.fillStyle = 'rgba(' + (k * 37 % 255) + ',' + (k * 91 % 255) + ',' + (k * 13 % 255) + ',.35)'; x.fillRect((k * 53) % w, (k * 29) % h, 6 + k % 17, 6 + k % 11); } return cv.toDataURL('image/jpeg', 0.7); };
  var L = function (t, b, k) { return { k: k || 'list', t: t, b: b }; };
  var serit = function (tur, i, srcs) {
    var r = i % 4, ek = srcs.length ? ' [' + ((i % srcs.length) + 1) + ']' : '';
    if (tur === 'karma') tur = ['metin', 'gorsel', 'grafik', 'kaynak'][r];
    if (tur === 'grafik') return r === 1 ? L('Dağılım ' + i, ['Kuzey | Güney | Doğu', '42 | 31 | 18', '40 | 33 | 20'], 'table') : r === 2 ? L('Oranlar ' + i, ['%62 — katılım', '%18 — artış', '%9 — kayıp'], 'stat') : L('Bölgelere göre gelir ' + i, ['Kuzey: ' + (40 + i % 7), 'Güney: 31', 'Doğu: 18', 'Batı: 9'], 'chart');
    if (tur === 'kaynak') { var s = L('Bulgu ' + i, ['Ölçüm iki yılda yüzde ' + (10 + i % 9) + ' arttı' + ek, 'Etki yoğun yapılaşmada daha güçlü' + ek, 'Sonuç ' + (2020 + i % 5) + ' verisiyle tutarlı' + ek]); s.src = [(i % srcs.length) + 1]; return s; }
    if (tur === 'gorsel') return L('Görsel asetat ' + i, ['Kıyı ekosistemi dalgayı kırar', 'Sulak alanlar kuşlara yuva']);
    return L('Uzun metinli asetat ' + i, ['Belediye su şebekelerinin çoğu tasarım ömrünün sonuna yaklaşıyor ve yenileme bütçeleri bozulma hızına yetişmiyor', 'Kaçak oranının dörtte biri aştığı bölgeler yaygın; ölçüm verisi çoğu yerde eksik', 'İklim değişkenliği hem arza hem arıtma kapasitesine ek baskı yapıyor', 'Yenileme kararları arıza sonrasında veriliyor, risk sırasına göre değil']);
  };
  var kaynaklar = function (tur) { var o = []; if (tur !== 'kaynak' && tur !== 'karma') return o;
    for (var q = 0; q < 8; q++) o.push({ id: q + 1, title: 'Sentetik kaynak ' + (q + 1), url: 'https://ornek' + q + '.example.org/k' + q, site: 'ornek.invalid', date: '2024', apa: 'Yazar, A. (2024). Sentetik kaynak ' + (q + 1) + '. Örnek Yayınevi.', erisim: '1 Ocak 2026', ctx: 'Sentetik bağlam.',
      parca: [0, 1, 2, 3, 4, 5].map(function (p) { return { metin: 'Kaynak ' + (q + 1) + ', parça ' + p + ': ölçüm iki yılda yüzde ' + (10 + p) + ' arttı.', tur: 'pasaj' }; }) }); return o; };
  window.__kur = async function (ad, tur, N) {
    Object.keys(localStorage).forEach(function (k) { if (/\\.d\\./.test(k)) localStorage.removeItem(k); });      /* desteler birbirinin yerel alanını doldurmasın */
    d.querySelector('[data-newdeck]').click(); await bekle(50); S.temaSec({ def: S.TEMALAR[0].def });
    var srcs = kaynaklar(tur), out = [{ k: 'cover', t: 'Sentetik deste ' + ad, b: [] }];
    for (var i = 0; i < N - 2; i++) out.push(serit(tur, i, srcs));
    out.push({ k: 'end', t: 'Teşekkürler', b: [] });
    var pm = { title: out[0].t, sub: 't', lang: 'tr', source: 'topic', sourceId: null, via: 'research', yol: { k: 'research', yedek: 0 }, sources: srcs, istek: N };
    P.sayiAyarla(out, N, pm, srcs.length ? 1 : 0);
    if (srcs.length) out.splice(out.length - 1, 0, { t: 'Kaynakça', k: 'refs', b: srcs.map(function (x, i) { return '[' + (i + 1) + '] ' + x.apa + ' ' + x.url; }), notes: '' });
    S.set(out, pm); P.hazirla();
    var t0 = performance.now(); S.bas('new'); await sakin(); var tBas = performance.now() - t0; await dur(200);
    var D = S.deck(), foto0 = 0;
    D.slides.forEach(function (s, i) { if (!(tur === 'gorsel' || (tur === 'karma' && i % 4 === 2)) || s.lay === 'cover' || s.lay === 'end' || s.lay === 'refs') return;
      s.els.push({ id: 'pf' + i, type: 'img', x: 500, y: 140, w: 420, h: 236, src: foto(960, 540, i), alt: 'sentetik', fit: 'cover' }); foto0++; });
    if (foto0) { P.renderAll(); await dur(200); }
    return JSON.stringify({ n: D.slides.length, tBas: tBas, foto: foto0, kaynak: (D.kaynaklar || []).length, iddia: D.slides.reduce(function (t, s) { return t + s.els.reduce(function (u, e) { return u + (e.iddia || []).length; }, 0); }, 0) });
  };
  window.__olc = async function () {
    var D = S.deck(), n = D.slides.length, U = { n: n }, a;
    a = []; for (var k = 0; k < TEKRAR; k++) a.push(ms(function () { P.renderAll(); })); U.ciz = ort(a);
    a = []; for (k = 0; k < TEKRAR; k++) { var t = 0; for (var j = 0; j < 20; j++) { var hd = (j * 7 + k) % n; t += ms(function () { P.go(hd); }); } a.push(t / 20); } U.gecis = ort(a);
    var hedef = function () { var s = D.slides[D.cur]; return s.els.filter(function (e) { return (e.type === 'ul' || e.type === 't') && e.text && !e.muted && !e.dz; })[0]; };
    a = []; for (k = 0; k < TEKRAR; k++) { P.go(1 + k % Math.max(1, n - 2)); var e = hedef(); if (!e) continue; var yeni = e.text + ' ek' + k; a.push(ms(function () { P.duzenle(e.id, yeni); })); } U.duzen = ort(a);
    a = []; for (k = 0; k < TEKRAR; k++) { a.push(ms(function () { P.openAudit(); })); P.auKapat(); } U.qa = ort(a);
    a = []; for (k = 0; k < TEKRAR; k++) { a.push(ms(function () { P.sdAc(true); })); P.sdAc(false); } U.sohbet = ort(a);
    U.dom = d.getElementsByTagName('*').length;
    await dur(2600);
    return JSON.stringify(U);
  };
  /* B3: yerel alan dolu (görseller) → deste yerelde yazılamaz, hesaba gider; sonraki yerel açılış eski kopyayı değil son hâli göstermeli */
  window.__kota = async function () { var D = S.deck(), id = D.id; P.go(1); var e = D.slides[1].els.filter(function (x) { return (x.type === 'ul' || x.type === 't') && x.text && !x.muted && !x.dz; })[0];
    P.duzenle(e.id, 'Kota öncesi'); await dur(2600); window.__dolu = 1; P.duzenle(e.id, 'Kota sonrası metin'); await dur(2600); window.__dolu = 0;
    var yerel = localStorage.getItem(S.store.k('d.' + id)) || ''; await P.openDeck(id, false); var t = S.deck().slides[1].els.filter(function (x) { return x.id === e.id; })[0];
    return JSON.stringify({ yerelEski: yerel.indexOf('Kota öncesi') >= 0 && yerel.indexOf('Kota sonrası metin') < 0, acilan: t && t.text }); };
  window.__gez = function (adet) { var D = S.deck(), n = D.slides.length, u0 = D.updated, m = S.store.meta(D.id), b0 = m && m.bekleyen, l0 = Object.assign({}, window.__ls), un = P.undoN();
    for (var j = 0; j < adet; j++) P.go((j * 3 + 1) % n);
    return JSON.stringify({ u0: u0, b0: b0 || 0, l0: l0, un: un, cur: D.cur }); };
  window.__gezSon = function (o) { var D = S.deck(), m = S.store.meta(D.id), x = localStorage.getItem(S.store.k('d.' + D.id));
    return JSON.stringify({ u1: D.updated, b1: (m && m.bekleyen) || 0, ls: { n: window.__ls.n - o.l0.n, deste: window.__ls.deste - o.l0.deste, bayt: window.__ls.bayt - o.l0.bayt }, un: P.undoN(), yerelCur: x ? JSON.parse(x).cur : null, cur: D.cur }); };
  window.__kayit = function () { var D = S.deck(), a = [], l0 = window.__ls.bayt; for (var k = 0; k < TEKRAR; k++) { var t = performance.now(); S.saveNow(); a.push(performance.now() - t); }
    var x = localStorage.getItem(S.store.k('d.' + D.id)) || ''; return JSON.stringify({ kayit: ort(a), yerel: x.length, yazilan: (window.__ls.bayt - l0) / TEKRAR }); };
  window.__yukle = async function () { var D = S.deck(), id = D.id, a = [], b = [];
    for (var k = 0; k < TEKRAR; k++) { var t = performance.now(); await P.openDeck(id, true); a.push(performance.now() - t); t = performance.now(); await P.openDeck(id, false); b.push(performance.now() - t); }
    var E = S.deck(); return JSON.stringify({ hesap: ort(a), yerel: ort(b), n: E.slides.length, kaynak: (E.kaynaklar || []).length, iddia: E.slides.reduce(function (t, s) { return t + s.els.reduce(function (u, e) { return u + (e.iddia || []).length; }, 0); }, 0),
      src: E.slides.filter(function (s) { return s.src && s.src.length; }).length, foto: E.slides.reduce(function (t, s) { return t + s.els.filter(function (e) { return e.type === 'img' && /^data:/.test(e.src || ''); }).length; }, 0) }); };
  window.__iz = function () { var D = S.deck(); return JSON.stringify({ kaynak: JSON.stringify(D.kaynaklar || []), iddia: JSON.stringify(D.slides.map(function (s) { return s.els.map(function (e) { return [e.id, e.iddia || null]; }); })), src: JSON.stringify(D.slides.map(function (s) { return s.src || null; })),
    foto: JSON.stringify(D.slides.map(function (s) { return s.els.filter(function (e) { return e.type === 'img'; }).map(function (e) { return [e.src.length, e.alt || '', e.credit || null]; }); })) }); };
  window.__pptxOl = async function () { var a = [], son = null; for (var k = 0; k < TEKRAR; k++) { var n0 = window.__pptx.length, t = performance.now(); await P.exp(null); if (window.__pptx.length === n0) await P.exp(null); a.push(performance.now() - t); son = window.__pptx[window.__pptx.length - 1]; }
    var D = S.deck(); return JSON.stringify({ ms: ort(a), b64: son || null, n: D.slides.length, notlar: D.slides.filter(function (s) { return String(s.notes || '').trim(); }).length,
      foto: D.slides.reduce(function (t, s) { return t + s.els.filter(function (e) { return e.type === 'img' && e.src && !e.muted; }).length; }, 0), grafik: D.slides.reduce(function (t, s) { return t + s.els.filter(function (e) { return e.type === 'chart' && !e.muted; }).length; }, 0) }); };
  R.hazir = 1;
`;

/* DevTools protokolü (gerçek saat; sanal saatte eşzamanlı kodda performance.now() ilerlemez) */
const kosCDP = async (W, dosya, prof, icerik, adim) => {
  fs.writeFileSync(path.join(W, dosya), icerik);
  const bekle = (ms) => new Promise((r) => setTimeout(r, ms)), prd = path.join(W, 'prof-' + prof), dosyaP = path.join(prd, 'DevToolsActivePort');
  let ws = null; const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--user-data-dir=' + prd, '--allow-file-access-from-files', '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
  try {
    let tgt = null, port = 0;
    for (let k = 0; k < 150 && !tgt; k++) { await bekle(100); try { port = port || +fs.readFileSync(dosyaP, 'utf8').split('\n')[0]; if (port) tgt = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find((x) => x.type === 'page'); } catch (e) { /* Chrome açılıyor */ } }
    if (!tgt) throw new Error('CDP hedefi yok');
    ws = new WebSocket(tgt.webSocketDebuggerUrl); let id = 0; const bek = {};
    const gonder = (method, params) => new Promise((r) => { const i = ++id; bek[i] = r; ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && bek[m.id]) { bek[m.id](m.result || m); delete bek[m.id]; } };
    await new Promise((r) => { ws.onopen = r; });
    await gonder('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await gonder('Page.navigate', { url: pathToFileURL(path.join(W, dosya)).href });
    let txt = '';
    for (let k = 0; k < 240 && !txt; k++) { await bekle(250); const r = await gonder('Runtime.evaluate', { expression: 'document.getElementById("diag") ? document.getElementById("diag").textContent : ""', returnByValue: true }); txt = r.result && r.result.value; }
    if (!txt) throw new Error(dosya + ': diag yok');
    const R0 = JSON.parse(txt); if (R0.hata) throw new Error('sayfa hatası: ' + R0.hata);
    const ifade = async (x) => { const r = await gonder('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (!r.result || typeof r.result.value !== 'string') throw new Error(x.slice(0, 40) + ': ' + JSON.stringify(r).slice(0, 400)); return JSON.parse(r.result.value); };
    const out = await adim(gonder, bekle, ifade);
    await Promise.race([gonder('Browser.close'), bekle(2000)]);
    return out;
  } finally {
    try { if (ws) ws.close(); } catch (e) { /* kapalı */ }
    const bitti = new Promise((r) => { if (ch.exitCode !== null || ch.signalCode) r(); else ch.once('exit', r); });
    ch.kill(); if (await Promise.race([bitti.then(() => 1), bekle(3000).then(() => 0)]) === 0) { ch.kill('SIGKILL'); await Promise.race([bitti, bekle(2000)]); }
  }
};

const unzip = (buf) => {
  const out = {}; let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--; assert.ok(e >= 0, 'ZIP sonu yok');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'merkez dizin bozuk');
    const m = buf.readUInt16LE(p + 10), cs = buf.readUInt32LE(p + 20), fl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), kl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const ad = buf.toString('utf8', p + 46, p + 46 + fl), lf = buf.readUInt16LE(lo + 26), lx = buf.readUInt16LE(lo + 28), d = buf.subarray(lo + 30 + lf + lx, lo + 30 + lf + lx + cs);
    out[ad] = m === 8 ? zlib.inflateRawSync(d) : Buffer.from(d); p += 46 + fl + xl + kl;
  }
  return out;
};
/* yapı imzası: slayt/not/medya/grafik/bağlantı sayısı ve slayt XML'lerinin (medya adları hariç) özeti */
const pptxYapi = (b64) => {
  const buf = Buffer.from(b64, 'base64'), z = unzip(buf), ad = Object.keys(z), say = (re) => ad.filter((x) => re.test(x)).length;
  const sl = ad.filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  const rels = ad.filter((x) => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(x)).map((x) => z[x].toString());
  const ozet = require('node:crypto').createHash('sha1').update(sl.map((x) => z[x].toString().replace(/r:embed="rId\d+"/g, '')).join('|')).digest('hex').slice(0, 12);
  return { bayt: buf.length, slayt: sl.length, not: say(/^ppt\/notesSlides\/notesSlide\d+\.xml$/), medya: say(/^ppt\/media\//), grafik: say(/^ppt\/charts\/chart\d+\.xml$/),
    baglanti: rels.reduce((t, r) => t + (r.match(/TargetMode="External"/g) || []).length, 0), ozet };
};

const tarayici = async () => {
  if (!CHROME) { console.log('  ATLANDI  A–C (başsız Chrome yok): CHROME_BIN ile yol verin. Bu testler GEÇTİ sayılmadı.'); return; }
  const { W, sayfa, temizle } = duzenek(INK_YOL ? { ink } : undefined);
  const hazir = (h) => {
    assert.equal(h.split('  window.__S = { set:').length, 2); h = h.replace('  window.__S = { set:', () => KANCA + '  window.__S = { set:');
    return BUNDLE ? h.replace('<pre id="diag"></pre>', '<script src="' + pathToFileURL(BUNDLE).href + '"></script>\n<pre id="diag"></pre>') : h;
  };
  const Hs = yeniSunucu({ senkron: true }); let gelen = 0;
  Hs.srv.on('request', (req) => { req.on('data', (c) => { gelen += c.length; }); });
  await new Promise((r) => Hs.srv.listen(0, '127.0.0.1', r));
  const yazim = (a) => Hs.LOG.slice(a).filter((x) => x.op && x.op !== 'select').length;
  let OUT = [];
  try {
    OUT = await kosCDP(W, 'perf.html', 'perf', hazir(sayfa('ok', Hs.srv.address().port, 0, GOVDE(TEKRAR))), async (gonder, bekle, ifade) => {
      const sonuc = [];
      for (const [ad, tur, N] of SECILEN) {
        const r = { ad, tur, N }, bas = [];
        for (let k = 0; k < TEKRAR; k++) { const x = await ifade(`window.__kur(${JSON.stringify(ad)}, ${JSON.stringify(tur)}, ${N})`); bas.push(x.tBas); Object.assign(r, { n: x.n, foto: x.foto, kaynak: x.kaynak, iddia: x.iddia }); }
        r.ilk = ortanca(bas); await bekle(2600);
        Object.assign(r, await ifade('window.__olc()'));
        await gonder('HeapProfiler.collectGarbage'); const hp = await gonder('Runtime.getHeapUsage'); r.bellek = hp.usedSize;
        /* gezinme: 30 asetat değişimi; 2,6 sn sonra (yerel 0,5 + hesap 1,5 sn erteleme) yazımlar sayılır */
        const L0 = Hs.LOG.length, g0 = gelen, o = await ifade('window.__gez(30)'); await bekle(2600);
        const s = await ifade('window.__gezSon(' + JSON.stringify(o) + ')'); r.gez = { hesap: yazim(L0), bayt: gelen - g0, yerel: s.ls, updated: s.u1 !== o.u0, bekleyen: [o.b0, s.b1], undo: [o.un, s.un], cur: [s.cur, s.yerelCur] };
        /* düzenleme: tek gerçek düzenleme hesaba bir kez gider */
        const L1 = Hs.LOG.length, g1 = gelen, iz0 = await ifade('window.__iz()'); await ifade('JSON.stringify((window.__P.go(1), window.__P.duzenle(window.__S.deck().slides[1].els.filter(function (e) { return (e.type === "ul" || e.type === "t") && e.text && !e.muted && !e.dz; })[0].id, "Değişen metin satırı")))'); await bekle(2600);
        r.duz = { hesap: yazim(L1), bayt: gelen - g1, satir: Hs.LOG.slice(L1).filter((x) => x.t === 'presentation_slides' && x.op === 'insert').length };
        Object.assign(r, { kayit: await ifade('window.__kayit()') }); await bekle(2600);
        const iz1 = await ifade('window.__iz()'), y = await ifade('window.__yukle()'), iz2 = await ifade('window.__iz()');
        r.yukle = y; const es = (x, z) => require('node:util').isDeepStrictEqual(JSON.parse(x), JSON.parse(z));      /* hesap (jsonb) anahtar sırasını değiştirir; içerik eşitliği sınanır */
        r.koruma = { kaynak: es(iz1.kaynak, iz2.kaynak), iddia: es(iz1.iddia, iz2.iddia), src: es(iz1.src, iz2.src), foto: es(iz1.foto, iz2.foto), src0: es(iz0.src, iz2.src), kaynak0: es(iz0.kaynak, iz2.kaynak) };
        if (BUNDLE) { const p = await ifade('window.__pptxOl()'); r.pptx = { ms: p.ms, n: p.n, notlar: p.notlar, foto: p.foto, grafik: p.grafik, yapi: p.b64 ? pptxYapi(p.b64) : null }; }
        sonuc.push(r);
      }
      await ifade('window.__kur("kota-10", "metin", 10)'); sonuc.kota = await ifade('window.__kota()');
      return sonuc;
    });
  } finally { Hs.srv.close(); temizle(); }
  if (process.env.DOKUM) fs.writeFileSync(process.env.DOKUM, JSON.stringify({ ink: INK_YOL || 'js/acadex-ink.js', tekrar: TEKRAR, OUT, kota: OUT.kota }, null, 1));
  console.log('  ölçüm (ortanca, ms; ' + TEKRAR + ' tekrar; sentetik, bu makine):');
  OUT.forEach((r) => console.log('    ' + r.ad.padEnd(10) + ' n=' + r.n + ' ilk ' + r.ilk.toFixed(0) + ' çiz ' + r.ciz.toFixed(1) + ' geçiş ' + r.gecis.toFixed(2) + ' düzen ' + r.duzen.toFixed(1) + ' qa ' + r.qa.toFixed(1) + ' sohbet ' + r.sohbet.toFixed(1) +
    ' dom ' + r.dom + ' bellek ' + (r.bellek / 1048576).toFixed(1) + 'MB · gezinme hesap ' + r.gez.hesap + ' yerel ' + r.gez.yerel.deste + ' · kayıt ' + r.kayit.kayit.toFixed(1) + ' (' + (r.kayit.yerel / 1024).toFixed(0) + ' KB) · yükle ' + r.yukle.hesap.toFixed(0) + '/' + r.yukle.yerel.toFixed(0) +
    (r.pptx ? ' · pptx ' + r.pptx.ms.toFixed(0) + ' ms ' + (r.pptx.yapi ? (r.pptx.yapi.bayt / 1024).toFixed(0) + ' KB' : '-') : '')));
  console.log('  kota senaryosu: ' + JSON.stringify(OUT.kota));
  if (INK_YOL) return;

  test('A1 ölçüm: her deste kuruldu, süreler sonlu, küçük resim = asetat; görsel destede fotoğraf var', () => {
    assert.equal(OUT.length, SECILEN.length);
    OUT.forEach((r) => { ['ilk', 'ciz', 'gecis', 'duzen', 'qa', 'sohbet'].forEach((k) => assert.ok(Number.isFinite(r[k]) && r[k] >= 0, r.ad + ' ' + k + '=' + r[k])); assert.ok(r.n >= r.N - 1, r.ad + ' n=' + r.n); assert.ok(r.dom > r.n * 5, r.ad + ' dom');
      if (r.tur === 'gorsel') assert.ok(r.foto >= r.n - 3, r.ad + ' foto ' + r.foto); });
  });
  test('B1 gezinme (30 değişim): hesaba 0 istek, updated/bekleyen ilerlemez, geri al yığını değişmez, cur yerelde', () => {
    OUT.forEach((r) => { assert.equal(r.gez.hesap, 0, r.ad + ' gezinme hesaba yazdı: ' + r.gez.hesap); assert.equal(r.gez.bayt, 0, r.ad + ' gezinme baytı'); assert.equal(r.gez.updated, false, r.ad + ' updated ilerledi');
      assert.equal(r.gez.bekleyen[1], r.gez.bekleyen[0], r.ad + ' bekleyen'); assert.deepEqual(r.gez.undo[1], r.gez.undo[0], r.ad + ' geri al'); assert.equal(r.gez.cur[1], r.gez.cur[0], r.ad + ' yerel cur');
      assert.ok(r.gez.yerel.deste <= 2, r.ad + ' gezinmede yerel deste yazımı ' + r.gez.yerel.deste); });
  });
  test('B2 tek düzenleme hesaba bir kez gider (deste satırı + asetatlar tek seferde); kayıt/yükleme sid, kaynak, iddia, görsel kaybetmez', () => {
    OUT.forEach((r) => { assert.ok(r.duz.hesap >= 2 && r.duz.satir === 1, r.ad + ' düzenleme: ' + JSON.stringify(r.duz));
      Object.keys(r.koruma).forEach((k) => assert.ok(r.koruma[k], r.ad + ' kayıt-yükleme kaybı: ' + k));
      assert.equal(r.yukle.n, r.n, r.ad + ' yüklenen asetat'); if (r.kaynak) { assert.equal(r.yukle.kaynak, r.kaynak, r.ad + ' kaynak'); assert.ok(r.yukle.src > 0, r.ad + ' sl.src'); }
      if (r.foto) assert.equal(r.yukle.foto, r.foto, r.ad + ' fotoğraf'); });
  });
  test('B3 yerel alan dolu: deste yerelde yazılamayınca sonraki açılış hesaptaki son hâli gösterir (eski yerel kopya üstüne açılmaz)', () => {
    assert.ok(OUT.kota.yerelEski, 'senaryo kurulamadı: ' + JSON.stringify(OUT.kota)); assert.equal(OUT.kota.acilan, 'Kota sonrası metin');
  });
  if (!BUNDLE) { console.log('  ATLANDI  C (gerçek PPTX): PPTXGEN_BUNDLE yok. GEÇTİ SAYILMADI.'); return; }
  test('C1 PPTX ZIP yapısı (XML sayımı, görsel doğrulama değil): slayt = asetat, not, medya ≥ fotoğraf, yerli grafik, kaynakça bağlantısı', () => {
    OUT.forEach((r) => { const y = r.pptx.yapi; assert.ok(y, r.ad + ' PPTX yok'); assert.equal(y.slayt, r.pptx.n, r.ad + ' slayt'); assert.ok(y.not >= r.pptx.notlar, r.ad + ' not');
      assert.ok(y.medya >= r.pptx.foto, r.ad + ' medya ' + y.medya + ' < ' + r.pptx.foto); assert.equal(y.grafik, r.pptx.grafik, r.ad + ' grafik'); if (r.kaynak) assert.ok(y.baglanti >= r.kaynak, r.ad + ' bağlantı ' + y.baglanti); });
  });
};

/* ========================================================================== D/E: sunucu */
const ts = require('typescript');
const SRV_JS = ts.transpileModule(readSource(SRV_PATH), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import [^\n]+\n/m, '');
const isleyici = (o) => { let h = null; const Deno = { serve: (f) => { h = f; }, env: { get: (k) => ({ GROQ_API_KEY: 'test-groq-anahtar', TAVILY_API_KEY: o.tavily ? 'test-tavily' : '', GEMINI_API_KEY: '' })[k] || '' } };
  const kul = { ok: { id: 'u-ok' }, anon: { id: 'u-anon', is_anonymous: true } };
  const cc = (u, k, op) => { const tok = String(op.global.headers.Authorization || '').replace('Bearer ', ''); return { auth: { getUser: async () => ({ data: { user: kul[tok] || null }, error: null }) },
    from: (t) => { const q = { select: () => q, eq: (a, v) => { q.v = v; return q; }, maybeSingle: async () => ({ data: (o.kapi || []).includes(q.v) ? { value: { acik: true } } : null, error: null }), then: (a) => a({ data: [], error: null }) }; return q; } }; };
  new Function('createClient', 'Deno', 'fetch', SRV_JS)(cc, Deno, o.fetch); return h; };
const sahte = (f) => { const g = async (url, init) => { g.n++; g.url.push(String(url).split('?')[0].replace(/^https:\/\/([^/]+).*$/, '$1')); return f(url, init); }; g.n = 0; g.url = []; return g; };
const istek = async (h, tok, govde, ham) => { const L = []; const sak = ['log', 'warn', 'error', 'info'].map((k) => [k, console[k]]); sak.forEach(([k]) => { console[k] = (...a) => { L.push(a.map(String).join(' ')); }; });
  try { const r = await h(new Request('http://yerel/sunum-research', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}), body: ham != null ? ham : JSON.stringify(govde) })); return { status: r.status, j: await r.json(), L }; }
  finally { sak.forEach(([k, f]) => { console[k] = f; }); } };
const GIZLI = 'GIZLI-KONU-7Q';
const tavilyYanit = () => new Response(JSON.stringify({ results: [1, 2, 3].map((i) => ({ title: 'Kaynak ' + i + ' ' + GIZLI, url: 'https://ornek' + i + '.invalid/yol/' + GIZLI + '?k=1', content: ('Olgu ' + i + ' ' + GIZLI + ' ölçüm yüzde 12. ').repeat(40), raw_content: ('Paragraf ' + GIZLI + ' veri 2024 yılında yüzde 12 arttı. ').repeat(60), published_date: '2024-05-01' })) }), { status: 200 });

const sunucu = async () => {
  test('D1 bozuk JSON / boş konu: 400, model ve arama çağrısı yok', async () => {
    const f = sahte(() => new Response('{}', { status: 200 })), h = isleyici({ fetch: f });
    let r = await istek(h, 'ok', null, '{bozuk'); assert.equal(r.status, 400); r = await istek(h, 'ok', { action: 'research', topic: '' }); assert.equal(r.status, 400); assert.equal(f.n, 0);
  });
  test('D2 büyük gövde: Content-Length başlığı olmasa da 413, model çağrısından önce', async () => {
    const f = sahte(() => new Response('{}', { status: 200 })), h = isleyici({ fetch: f });
    const govde = JSON.stringify({ action: 'research', topic: 'x'.repeat(2_600_000) });
    const akis = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(govde)); c.close(); } });      /* akışlı gövde: Content-Length yok */
    const r = await h(new Request('http://yerel/sunum-research', { method: 'POST', headers: { Authorization: 'Bearer ok', 'Content-Type': 'application/json' }, body: akis, duplex: 'half' }));
    assert.equal(r.status, 413); assert.equal(f.n, 0, 'büyük gövdede ağ çağrısı');
  });
  test('D3 oturumsuz 401, misafir Phase 8–10 eylemlerinde 403, kapı satırı yoksa kapalı; hiçbirinde Groq yok', async () => {
    const f = sahte(() => new Response('{}', { status: 200 })), h = isleyici({ fetch: f });
    assert.equal((await istek(h, null, { action: 'iddia_dogrula' })).status, 401);
    for (const a of ['icerik_onar', 'sohbet_duzenle']) assert.equal((await istek(h, 'anon', { action: a })).status, 403, a);
    for (const a of ['iddia_dogrula', 'icerik_onar', 'sohbet_duzenle']) { const r = await istek(h, 'ok', { action: a, v: 1 }); assert.equal(r.j.durum, 'kapali', a); }
    assert.equal(f.n, 0);
  });
  test('D4 araştırma yolu: Groq 5xx → 502, iç hata gövdesi yanıta ve günlüğe girmez; yeniden deneme yok (çağrı sayısı mevcut yedek zinciriyle sınırlı)', async () => {
    const f = sahte((url) => (/tavily/.test(url) ? tavilyYanit() : new Response(JSON.stringify({ error: { message: 'ic ayrinti ' + GIZLI, type: 'server_error', code: 'internal' } }), { status: 500 }))), h = isleyici({ fetch: f, tavily: 1 });
    const r = await istek(h, 'ok', { action: 'research', topic: 'Kentsel ısı adası ' + GIZLI, slideCount: 8, language: 'tr' });
    assert.ok(r.status >= 500, 'durum ' + r.status); assert.ok(!JSON.stringify(r.j).includes(GIZLI), 'yanıtta iç ayrıntı');
    const groqN = f.url.filter((u) => /groq/.test(u)).length; assert.ok(groqN <= 4, 'groq çağrısı ' + groqN);
    r.L.forEach((l) => assert.ok(!l.includes(GIZLI), 'günlükte içerik: ' + l.slice(0, 120)));
  });
  test('D5 beklenmeyen istisna: 500 yanıtı genel ileti, istisna metni ve yığını günlüğe/yanıta girmez', async () => {
    const f = sahte((url) => { throw new Error('beklenmeyen ' + GIZLI + ' https://gizli.invalid/x?token=abc'); }), h = isleyici({ fetch: f, tavily: 1 });
    const r = await istek(h, 'ok', { action: 'research', topic: 'Konu ' + GIZLI, slideCount: 6 });
    assert.ok(!JSON.stringify(r.j).includes(GIZLI)); r.L.forEach((l) => { assert.ok(!l.includes(GIZLI), 'günlük: ' + l.slice(0, 120)); assert.ok(!/token=|gizli\.invalid/.test(l)); });
  });
  test('D6 Phase 8–10 tek istek: 429 → kota, 5xx → hata/yanit, bozuk JSON → yanit; hiçbirinde ikinci Groq yok', async () => {
    const K = ['iddia_dogrulama', 'icerik_onarim', 'akilli_editor'];
    for (const [st, gv] of [[429, '{}'], [503, '{}'], [200, '{"choices":[{"message":{"content":"{bozuk"}}]}']]) {
      const f = sahte(() => new Response(gv, { status: st })), h = isleyici({ fetch: f, kapi: K });
      const r = await istek(h, 'ok', { action: 'iddia_dogrula', v: 1, dil: 'tr', iddialar: [{ cid: 'c1', metin: 'Göç 2024 yılında yüzde 12 arttı.', parcalar: [{ sid: 's1', pid: 'p1', metin: 'Göç 2024 yılında yüzde 12 arttı.' }] }] });
      assert.ok(f.n <= 1, st + ': groq ' + f.n); assert.notEqual(r.status, 500, st + ' 500');
      r.L.forEach((l) => assert.ok(!/Göç 2024/.test(l), 'günlükte iddia metni'));
    }
  });

  test('E1 sıfır metrikleri (kaynak): günlükte anahtar/Authorization/içerik yok; araştırma özet satırı yalnız sayı', () => {
    const satir = srv.split('\n').filter((l) => /console\.(log|warn|error|info)\(/.test(l));
    satir.forEach((l) => { const c0 = l.slice(l.indexOf('console.')), c = c0.slice(0, (c0.indexOf(');') + 1) || c0.length); assert.doesNotMatch(c, /gKey|tKey|API_KEY|Authorization|Bearer/, 'anahtar: ' + c.slice(0, 80)); assert.doesNotMatch(c, /topic\.slice|q\.slice|JSON\.stringify\((queries|aspects|g\.data)\)|srcs\.map\(\(x\) => x\.site\)/, 'içerik: ' + c.slice(0, 100)); assert.doesNotMatch(c, /console\.error\("sunum-research", e\)/); });
    const ozet = srv.match(/console\.log\(`sunum arastirma: [^\n]+/)[0]; assert.doesNotMatch(ozet, /\$\{topic\.slice|JSON\.stringify\((queries|aspects)\)|x\.site/); assert.match(ozet, /konu \$\{topic\.length\}/);
    assert.match(cut(srv, '  } catch (e) {\n    console.error(', '\n});'), /J\(\{ error: "Sunucu hatasi", durum: "hata" \}, 500\)/);
  });
  test('E2 sıfır metrikleri (kaynak): Gemini yalnız plan/gorsel_qa; istemcide görsel QA, kanıt kontrolü, onarım, sohbet yalnız düğme/onayla; çift tıklama korumaları', () => {
    const gem = srv.split('\n').filter((l) => /generativelanguage\.googleapis\.com/.test(l)).length; assert.ok(gem <= 2, 'Gemini uç noktası ' + gem);
    const c = read('js/acadex-ink.js');
    assert.match(c, /if \(t\.hasAttribute\('data-gq-run'\)\) \{ gorselQA\(\); return; \}/); assert.match(cut(c, '  var gorselQA = async function', '\n'), /function \(\) \{/); assert.match(c, /var d = deck; if \(gorselKos \|\| !d \|\| !d\.slides\.length\) return;/);
    assert.match(c, /if \(t\.hasAttribute\('data-kk-run'\)\) \{ if \(idKos\) return true;/); assert.match(c, /if \(idKos\) return idKos\.p;/);
    assert.match(c, /if \(S\.durum !== 'confirming'\) return true;/); assert.match(c, /sdDeste\(\); if \(sdIsMesgul\(\)\) return false;/); assert.match(c, /if \(SH\.durum !== 'confirming' \|\| !SH\.I \|\| !SH\.A\) return null;/);
    assert.match(c, /if \(basiliyor\) return; basiliyor = true;/); assert.match(c, /var run = \+\+imRun; imLast = q;/); assert.match(c, /btn\.disabled = true; btn\.textContent = 'Acadia dinlediklerini okuyor…';/);
    assert.match(c, /planGorulen\[h\]\) return;/, 'plan aynı imzayla bir kez');
  });
};

(async () => {
  await sunucu();
  await tarayici();
  summary();
})().catch((e) => { console.error(e); process.exit(1); });
