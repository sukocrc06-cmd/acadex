/* ==========================================================================
   ACADEX — FOTOĞRAF YUVASI DÜZENEĞİ (tests/_gorsel-duzenek.js, yardımcı; run-all bunu test saymaz)

   Phase 2 (26.11.2026): js/acadex-ink.js'in ÜRETİM kodunu (Revision 5 düzen seçici, fitSlide, P1 yazı doğrulaması,
   YUVA tablosu, yuva motoru, illustrate) değiştirmeden başsız Chrome sayfasına koyar. Sunucu (sunum-research)
   taklit edilir: her istenen asetat için üç yatay aday döner (alaka 0,8 / 0,7 / 0,6); 'eski' senaryoda yalnız eski
   biçim (photos). Dış ağ yalnız şablon yazı tipi içindir; model çağrısı yok.

   Senaryolar (tek sayfada sırayla):
     ana     — ipuçlu destelerin hepsi basılır, illustrate koşar; her asetatın önce/sonra ölçümü döner
     tekrar  — 'ana'nın aynısı yeniden (belirlenimcilik)
     eski    — sunucu yalnız eski biçimi (photos) döndürür
     yaris   — istek uçuştayken istenen asetatlar grafiğe çevrilir; yanıt gelince bakılır
     ekleme  — destenin üstüne ikinci basım (ekleme); sunucu destede olan fotoğrafları da aday gösterir
   Kullanım: const { sayfaKur, kos, kosCdp, CHROME } = require('./_gorsel-duzenek.js');
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const CHROME = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });

const kaynakOku = (repo) => fs.readFileSync(path.join(repo || ROOT, 'js/acadex-ink.js'), 'utf8').replace(/\r\n/g, '\n');

const sayfaKur = (o) => {
  o = o || {};
  const ink = kaynakOku(o.repo);
  const line = (start) => { const i = ink.indexOf('\n' + start); if (i < 0) throw new Error('bulunamadı: ' + start); return ink.slice(i + 1, ink.indexOf('\n', i + 1)); };
  const block = (start, end) => { const i = ink.indexOf('\n' + start); if (i < 0) throw new Error('bulunamadı: ' + start); const j = ink.indexOf(end, i + 1); if (j < 0) throw new Error('son bulunamadı: ' + end); return ink.slice(i + 1, j); };
  const SLICE = ink.slice(ink.indexOf("  var root = document.getElementById('sunum'); if (!root) return;"), ink.indexOf("  /* ---------- .pptx'ten şablon çıkarma"));
  const EXTRA = block('  var measureH = function (e, sl) {', '  var overflows = function') + '\n' + line('  var capOf = function (e) {');
  const VS = ink.slice(ink.indexOf('var vSay = {}, vSec'), ink.indexOf('push(); var made = strips.map'));
  const FOTO = [
    block('  var titleOf = function (s) {', '  var fitThumbs'),
    line('  var GORSEL_EL = '), line('  var gorselVar = '), line('  var yerTutucu = '), line('  var bodyOf = '),
    block('  var credText = function', '  imGrid.addEventListener'),
    block('  var illustrate = function (made, topic) {', '  /* BOŞ ŞERİT').replace(/\bfn\('sunum-research'/g, "__fn('sunum-research'"),
  ].join('\n');
  const desteler = o.desteler;
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>gorsel</title><link rel="stylesheet" href="${pathToFileURL(path.join(o.repo || ROOT, 'css/acadex-ink.css')).href}">
<style>html,body{margin:0;padding:0;background:#fff}#sunum{display:none!important}</style></head><body>
<div id="sunum"></div><section id="acadexsunum-view" class="axu"><div id="cells"></div></section><div id="axu-layer"><div class="axu-l"></div></div><pre id="diag"></pre>
<script>
document.getElementById('sunum').innerHTML = '<div data-toast hidden><span data-toast-t></span><button data-toast-b></button><a data-toast-a></a></div><span data-saved></span>';
(function () {
${SLICE}
${EXTRA}
  var renderStage = function () {}, renderThumbs = function () {}, renderAll = function () {};
  dirty = function () {}; push = function () {};
  var curLang = function () { return 'en'; }, SAY = [];
  say = function (t) { SAY.push(String(t)); };
  var AUTO = 0, autoPhotos = function () { AUTO++; }, photoQuery = function () { return ''; };
  var ISTEK = [], SUNUCU = { kip: 'yeni', ertele: false, ekstra: [] };
  var __fn = function (name, body) {
    ISTEK.push(JSON.parse(JSON.stringify(body)));
    var photos = [], cands = [];
    var mk = function (x, k, sk) { return { i: x.i, id: 'p' + x.i + k + (SUNUCU.tur || ''), alt: 'subject photo ' + x.i, w: 1200, h: 800, thumb: 'https://img.invalid/t' + x.i + k + (SUNUCU.tur || '') + '.jpg', large: 'https://img.invalid/' + x.i + k + (SUNUCU.tur || '') + '.jpg', photographer: 'Fotografci ' + k, page: 'https://img.invalid/p' + x.i + k + (SUNUCU.tur || ''), source: 'Unsplash', license: 'Unsplash License', license_url: 'https://unsplash.com/license', skor: sk }; };
    (body.slides || []).forEach(function (x) { photos.push(mk(x, 'a')); if (x.iki) photos.push(mk(x, 'b')); ['a', 'b', 'c'].forEach(function (k, n) { cands.push(mk(x, k, Math.round((0.8 - n * 0.1) * 100) / 100)); }); SUNUCU.ekstra.forEach(function (p) { cands.push(Object.assign({}, p, { i: x.i, skor: 0.95 })); }); });
    photos.forEach(function (p) { delete p.skor; });
    var yanit = SUNUCU.kip === 'eski' ? { photos: photos } : { photos: photos, cands: cands };
    return SUNUCU.ertele ? new Promise(function (res) { SUNUCU.coz = function () { res(yanit); }; }) : Promise.resolve(yanit);
  };
${FOTO}
  var olcH = function (e, sl) { return measureH(e, sl); };
  /* bağımsız kelime ölçümü: öğenin en uzun kelimesi, öğenin yazı tipiyle tek satır çizilince içerik kutusuna sığmalı */
  var kelimeKirik = function (e, sl) {
    fitKutu(sl); fitBox.innerHTML = elHTML(e, false); var n = fitBox.firstChild; if (!n) { fitBox.innerHTML = ''; return false; }
    var hedef = n.querySelector('li') || n, cs = getComputedStyle(hedef), ic = hedef.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0), en = 0;
    String(e.text || '').split(String.fromCharCode(10)).join(' ').split(' ').filter(Boolean).forEach(function (w) { var sp = document.createElement('span'); sp.textContent = w; sp.style.whiteSpace = 'nowrap'; hedef.appendChild(sp); en = Math.max(en, sp.getBoundingClientRect().width); hedef.removeChild(sp); });
    fitBox.innerHTML = ''; return ic > 0 && en > ic + 1;
  };
  var olc = function (sl) {
    var els = sl.els, px = 99, oEl = 0, oSlide = 0, cak = 0, kirik = [], kun = {}, imgs = els.filter(function (e) { return e.type === 'img' && e.src; });
    imgs.forEach(function (e) { if (e.creditId) kun[e.creditId] = 1; });
    var engel = imgs.filter(function (e) { return !(e.x === 0 && e.y === 0 && e.w === W && e.h === H); }).concat(els.filter(function (e) { return kun[e.id]; }));
    els.forEach(function (e) {
      if (!((e.type === 't' || e.type === 'ul' || e.type === 'h') && e.text && !e.muted && !e.dz) || kun[e.id]) return;
      var hd = olcH(e, sl); if (e.type !== 'h') px = Math.min(px, e.size || 24); if (kelimeKirik(e, sl)) kirik.push(e.id);
      if (hd > e.h + 3) oEl++; if (e.y + hd > H - 2 || e.x + e.w > W + 1) oSlide++;
      engel.forEach(function (g) { if (e.x < g.x + g.w - 1 && e.x + e.w > g.x + 1 && e.y < g.y + g.h - 1 && e.y + hd > g.y + 1) cak++; });
    });
    return { px: px, oEl: oEl, oSlide: oSlide, cakisma: cak, kirik: kirik };
  };
  var yeniKosu = function () {
${VS}
    var qn = 0, son = null;
    return { bas: function (s) {
      var kind = s.k; if (kind === 'quote' && (son === 'quote' || qn >= 2)) kind = 'list'; if (kind === 'quote') qn++; son = kind;
      var cx = { heads: s.heads, split: s.split, data: s.data };
      if (kind === 'cover') { var cs = newSlide('cover', s.t, s.b, cx); cs.bg = 'navy'; if (s.img) cs.imgq = s.img; return cs; }
      cx.v = vSec(s, kind); cx.yedek = vSay.yedek; vSay.yedek = null; cx.aile = vSay.aile || ''; cx.tek = vSay.tek;
      var sl = newSlide(kind, s.t, s.b, cx); DZ.duzelt(kind, sl.v || 0, false); if (kind === 'list') vSay.aile = LAILE[sl.v || 0] || '';
      if (/^(cover|end)$/.test(kind) || (kind === 'quote' && sl.v === 2)) sl.bg = 'navy';
      if (s.img) sl.imgq = s.img;
      return sl;
    } };
  };
  var imzaTam = function (sl) { return JSON.stringify({ lay: sl.lay, v: sl.v || 0, els: sl.els }); };
  var bekle = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  var basDeste = function (deste) { var run = yeniKosu(); var made = deste.map(function (s) { return run.bas(s); }); made.forEach(function (sl) { fitSlide(sl); }); return made; };
  var rapor = function (made, once, onceImza, deste) { return made.map(function (sl, i) {
    var imgs = sl.els.filter(function (e) { return e.type === 'img' && e.src; }), kun = imgs.map(function (e) { return sl.els.filter(function (x) { return x.id === e.creditId; })[0]; });
    return { i: i, k: deste[i].k, lay: sl.lay, v: sl.v || 0, ipucu: deste[i].img ? (deste[i].img.entity ? 'entity' : 'q') : '', veri: /^(stat|chart|table)$/.test(sl.lay || '') || sl.els.some(function (e) { return /^(chart|table|mmd|math|viz)$/.test(e.type); }),
      foto: imgs.length, src: imgs.map(function (e) { return e.src; }), kaynak: imgs.map(function (e) { return e.kaynak || null; }), kunye: kun.map(function (c) { return c ? c.text : null; }),
      gorsel: sl.gorsel || null, once: once[i], sonra: olc(sl), degismedi: imzaTam(sl) === onceImza[i] };
  }); };
  var senaryo = async function (ad, desteler, ayar) {
    var out = [];
    for (var d = 0; d < desteler.length; d++) {
      var deste = desteler[d], made = basDeste(deste); deck.slides = made;
      var once = made.map(olc), onceImza = made.map(imzaTam), n0 = ISTEK.length;
      SUNUCU.kip = ayar.kip || 'yeni'; SUNUCU.ertele = !!ayar.yaris; SUNUCU.tur = ''; SUNUCU.ekstra = [];
      illustrate(made, 'topic ' + d); await bekle();
      var degisen = [];
      if (ayar.yaris) {
        var rq = ISTEK[ISTEK.length - 1] ? ISTEK[ISTEK.length - 1].slides : [];
        rq.forEach(function (x, k) { var sl = made[x.i]; if (!sl || sl.lay === 'cover' || k % 2) return; var ch = newSlide('chart', 'Chart', ['A 10', 'B 20'], { data: { type: 'bar', labels: ['A', 'B'], data: [10, 20] } }); sl.els = ch.els; sl.lay = 'chart'; sl.v = 0; degisen.push(x.i); });
        SUNUCU.coz(); await bekle(); await bekle();
      }
      var r = { deste: d, slaytlar: rapor(made, once, onceImza, deste), istek: ISTEK.slice(n0), degisen: degisen };
      if (ayar.ekleme) {
        /* ikinci basım: aynı şeritler destenin sonuna eklenir; sunucu destede zaten olan fotoğrafları da aday gösterir */
        var var0 = []; made.forEach(function (sl) { sl.els.forEach(function (e) { if (e.type === 'img' && e.src) var0.push({ id: e.kaynak && e.kaynak.id, alt: 'subject photo', w: 1200, h: 800, large: e.src, thumb: e.src, photographer: e.credit, page: e.creditUrl, source: e.kaynak && e.kaynak.saglayici }); }); });
        var made2 = basDeste(deste.filter(function (s) { return s.k !== 'cover'; })); deck.slides = made.concat(made2);
        SUNUCU.ekstra = var0; SUNUCU.tur = 'x'; var n1 = ISTEK.length;
        illustrate(made2, 'topic ' + d + ' ek'); await bekle();
        r.ekleme = { var0: var0.map(function (p) { return p.large; }), haric: ISTEK[n1] ? ISTEK[n1].haric || [] : null, ikinci: made2.map(function (sl) { return sl.els.filter(function (e) { return e.type === 'img' && e.src; }).map(function (e) { return e.src; }); }) };
      }
      out.push(r);
    }
    return out;
  };
  /* #21 görsel inceleme: numaralı satırlar (v2) + yan yuva — "03" bölünmemeli */
  var numara = function () {
    var out = [], B = [['Kentsel ısı adaları gece sıcaklığını belirgin biçimde artırır', 'Ağaç gölgesi kaldırım sıcaklığını 10 dereceye kadar düşürür', 'Açık renkli çatılar güneş ışığını geri yansıtır'], ['Bir', 'İki', 'Üç', 'Dört'], ['Kısa madde bir', 'Kısa madde iki', 'Kısa madde üç', 'Kısa madde dört', 'Kısa madde beş']];
    [2, 1, 7, 11, 12, 4, 5].forEach(function (v) { B.forEach(function (b) {
      var sl = newSlide('list', 'Serinletme yolları', b, { v: v, zorla: 1 }); if ((sl.v || 0) !== v) return; fitSlide(sl); deck.slides = [sl];
      var once = olc(sl), p = { i: 0, id: 'n' + v, alt: 'x', w: 1200, h: 800, large: 'https://img.invalid/n' + v + '.jpg', photographer: 'F', page: 'https://img.invalid/pn' + v, source: 'Unsplash' };
      var r = gorselSec(sl, [p], '', 'x'); if (r) gorselUygula(sl, r, []);
      out.push({ v: v, n: b.length, form: r ? r.form : 'kapandi', once: once.kirik.length, sonra: olc(sl).kirik.length });
    }); });
    return out;
  };
  /* ölçünün kendisi: 38 px kalın "03" 30 px kutuya sığmaz, 60 px kutuya sığar */
  var olcuDogru = function () { var sl = { lay: 'list', bg: 'clear', els: [] }, e = E('h', 70, 160, 30, 103, { text: '03', size: 38, color: BLUE }); var dar = kelimeKirik(e, sl); e.w = 60; return dar && !kelimeKirik(e, sl); };
  window.__G = { olcuDogru: olcuDogru, numara: numara, senaryo: senaryo, deck: deck, TEMALAR: TEMALAR, temaKur: temaKur, temaHazir: temaHazir, SAY: SAY, auto: function () { return AUTO; } };
})();
</script>
<script>
(function () {
  var G = window.__G, D = ${JSON.stringify(desteler)}, SEN = ${JSON.stringify(o.senaryolar || ['ana'])}, OUT = { tema: ${JSON.stringify(o.tema || 'ax-pitch')}, hata: [], sonuc: {} };
  var TP = G.TEMALAR.filter(function (t) { return t.id === OUT.tema; })[0]; G.deck.tema = G.temaKur(TP.def);
  G.temaHazir(G.deck.tema).then(async function (r) {
    if (!r.ok) { OUT.hata.push('YAZI DOĞRULANMADI'); document.getElementById('diag').textContent = JSON.stringify(OUT); return; }
    var AYAR = { ana: {}, tekrar: {}, eski: { kip: 'eski' }, yaris: { yaris: 1 }, ekleme: { ekleme: 1 } };
    for (var k = 0; k < SEN.length; k++) OUT.sonuc[SEN[k]] = await G.senaryo(SEN[k], D, AYAR[SEN[k]] || {});
    OUT.auto = G.auto(); OUT.numara = G.numara(); OUT.olcuDogru = G.olcuDogru();
    document.getElementById('diag').textContent = JSON.stringify(OUT);
  }).catch(function (e) { OUT.hata.push(String(e && e.stack || e)); document.getElementById('diag').textContent = JSON.stringify(OUT); });
})();
</script></body></html>`;
  return html;
};

const coz = (dom) => { const m = String(dom).match(/<pre id="diag">([\s\S]*?)<\/pre>/); if (!m || !m[1]) return null; return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&')); };

/* Sayfayı başsız Chrome'da koşar; sonucu döner (Promise). */
const kos = (html, etiket) => new Promise((res, rej) => {
  const W = fs.mkdtempSync(path.join(os.tmpdir(), 'acx-gorsel-')), dosya = path.join(W, (etiket || 'g') + '.html');
  fs.writeFileSync(dosya, html);
  cp.execFile(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + path.join(W, 'prof'), '--allow-file-access-from-files', '--virtual-time-budget=120000', '--dump-dom', pathToFileURL(dosya).href], { maxBuffer: 256 << 20, timeout: 300000 }, (e, out) => {
    const r = coz(out); try { fs.rmSync(W, { recursive: true, force: true }); } catch (x) {}
    if (!r) return rej(new Error('sayfa sonuç vermedi' + (e ? ': ' + e.message : ''))); res(r);
  });
});

/* Aynı sayfayı DevTools protokolüyle CPU yavaşlatılmış koşar (belirlenimcilik). Node ≥ 22 (global WebSocket). */
const kosCdp = (html, oran, etiket) => new Promise((res, rej) => {
  const W = fs.mkdtempSync(path.join(os.tmpdir(), 'acx-gorsel-cdp-')), dosya = path.join(W, (etiket || 'g') + '.html');
  fs.writeFileSync(dosya, html);
  const port = 9600 + Math.floor(Math.random() * 300);
  const ch = cp.spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + path.join(W, 'prof'), '--allow-file-access-from-files', '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });
  const bitir = (hata, v) => { try { ch.kill(); } catch (e) {} setTimeout(() => { try { fs.rmSync(W, { recursive: true, force: true }); } catch (e) {} }, 500); if (hata) rej(hata); else res(v); };
  const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
  (async () => {
    let tgt = null;
    for (let k = 0; k < 60 && !tgt; k++) { await bekle(200); try { const l = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); tgt = l.find((x) => x.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('CDP hedefi yok');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); let id = 0; const pend = {};
    const send = (method, params) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m.result || m); delete pend[m.id]; } };
    await new Promise((r) => { ws.onopen = r; });
    await send('Emulation.setCPUThrottlingRate', { rate: oran });
    await send('Page.navigate', { url: pathToFileURL(dosya).href });
    let txt = '';
    for (let k = 0; k < 1200 && !txt; k++) { await bekle(500); const r = await send('Runtime.evaluate', { expression: 'document.getElementById("diag") ? document.getElementById("diag").textContent : ""', returnByValue: true }); txt = r.result && r.result.value; }
    ws.close();
    if (!txt) throw new Error('CDP sayfası sonuç vermedi');
    bitir(null, JSON.parse(txt));
  })().catch((e) => bitir(e));
});

/* Senaryo sonucundan ölçüler (kabul ölçütleri) */
const olcut = (desteler) => {
  const M = { deste: 0, icerik: 0, ipuclu: 0, fotoAsetat: 0, ipucluFoto: 0, kapak: 0, kapakFoto: 0, veriFoto: 0, tasma: 0, cakisma: 0, govdeMin: 99, dusus: [], tekrar: 0, sifirDeste: 0, sifirUygunDeste: 0, durum: {}, yuva: {}, dokunulmamis: 0, missDegisen: 0, kunyesiz: 0, kaynaksiz: 0, kirik: 0 };
  desteler.forEach((D) => {
    M.deste++; let fc = 0, uygun = false; const gor = {};
    D.slaytlar.forEach((s) => {
      const d = s.gorsel ? s.gorsel.durum : '-'; M.durum[d] = (M.durum[d] || 0) + 1;
      s.src.forEach((u) => { if (gor[u]) M.tekrar++; gor[u] = 1; });
      if (s.k === 'cover') { M.kapak++; if (s.foto) M.kapakFoto++; return; }
      M.icerik++; if (s.ipucu) M.ipuclu++;
      if (s.gorsel && /^(hit|miss:(butce|atanmadi|alaka|aday-yok))$/.test(s.gorsel.durum)) uygun = true;
      if (s.foto) {
        fc++; M.fotoAsetat++; if (s.ipucu) M.ipucluFoto++; if (s.veri) M.veriFoto++;
        M.yuva[s.lay + ':' + (s.gorsel && s.gorsel.yuva)] = (M.yuva[s.lay + ':' + (s.gorsel && s.gorsel.yuva)] || 0) + 1;
        if (s.sonra.oEl > s.once.oEl || s.sonra.oSlide > s.once.oSlide) M.tasma++;
        M.kirik += s.sonra.kirik.filter((id) => s.once.kirik.indexOf(id) < 0).length;
        M.cakisma += s.sonra.cakisma; M.govdeMin = Math.min(M.govdeMin, s.sonra.px); M.dusus.push(Math.max(0, s.once.px - s.sonra.px));
        if (s.kunye.some((k) => !k)) M.kunyesiz++; if (s.kaynak.some((k) => !k || !k.saglayici)) M.kaynaksiz++;
      } else if (s.degismedi) M.dokunulmamis++;
    });
    if (!fc) { M.sifirDeste++; if (uygun) M.sifirUygunDeste++; }
  });
  M.fotoPay = M.icerik ? M.fotoAsetat / M.icerik : 0;
  M.ortDusus = M.dusus.length ? M.dusus.reduce((a, b) => a + b, 0) / M.dusus.length : 0;
  return M;
};

module.exports = { ROOT, CHROME, sayfaKur, kos, kosCdp, olcut };
