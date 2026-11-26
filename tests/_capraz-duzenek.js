/* ==========================================================================
   ÇAPRAZ CİHAZ DÜZENEĞİ (yardımcı modül; run-all bunu test saymaz)
   Kullananlar: tests/sunum-capraz-cihaz.js (18B), tests/sunum-yerel-koruma.js (18C).

   Her "cihaz" AYRI bir başsız Chrome profili; gerçek sunum modülü (dashboard.html işaretlemesi + acadex-ink.js).
   Hesap: 127.0.0.1'de durumlu sahte sunucu — presentations / presentation_slides; presentations_set_updated_at
   tetikleyicisi (her UPDATE'te updated_at = now()), jsonb anahtar sıralaması, alias:col->>key seçimi, eq ile koşullu
   UPDATE + select, get_shared_presentation (20261019c ile aynı: fonts yok). Dış ağ ve model çağrısı yok.
   Seçenekler (18C):
     senkron      sunucu saati gördüğü en ileri cihaz saatinin önünde tutulur (başsız Chrome'un sanal saati gerçek
                  saatin önüne geçer; açıkken cihaz saatleri uyumlu bir dünyayı taklit eder, kapalıyken eski davranış)
     AYAR.pushHata sunucu deste kaydını (asetat silme) reddeder
     sayfada window.__cevrimdisi  istemci hiçbir isteği gönderemez (ağ hatası)
     sayfada window.__casOnce     koşullu görüntü yazımı gönderilmeden hemen önce bir kez çalışır (söz döndürebilir)
     sayfada window.__pushOnce    deste kaydının satır güncellemesi gönderilmeden hemen önce bir kez çalışır
     sayfada window.__sonraCevrimdisi  bundan sonraki ilk yanıttan itibaren istemci çevrimdışı olur
   ========================================================================== */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const CHROME = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });

/* ---------------- durumlu sahte hesap ---------------- */
const yeniSunucu = (secenek) => {
  const SEC = secenek || {};
  const DB = { presentations: [], presentation_slides: [] }, LOG = [], YAZIM = [], AYAR = { hata: false, araya: null, pushHata: false };
  let saat = Date.now(), gorulen = 0;
  const simdi = () => { saat = Math.max(saat + (SEC.senkron ? 3000 : 1), Date.now(), SEC.senkron ? gorulen + 3000 : 0); return new Date(saat).toISOString().replace('Z', '000+00:00'); };      /* timestamptz metni (mikrosaniye) */
  const sirala = (x) => (Array.isArray(x) ? x.map(sirala) : x && typeof x === 'object' ? Object.keys(x).sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).reduce((o, k) => { o[k] = sirala(x[k]); return o; }, {}) : x);      /* jsonb anahtar sırası */
  const kopya = (x) => JSON.parse(JSON.stringify(x));
  const uygun = (r, f) => f.every(([k, v]) => r[k] === v);
  const icerikSurum = (pid) => { const r0 = DB.presentation_slides.filter((r) => r.presentation_id === pid).sort((a, b) => a.order_index - b.order_index)[0]; return r0 && r0.content ? r0.content.surum || null : null; };
  const takma = (sel, r) => { String(sel || '').split(',').forEach((p) => { const m = p.trim().match(/^(\w+):(\w+)->>(\w+)$/); if (m) r[m[1]] = r[m[2]] && r[m[2]][m[3]] != null ? String(r[m[2]][m[3]]) : null; }); return r; };
  const isle = (q) => {
    if (q.saat) gorulen = Math.max(gorulen, q.saat);
    if (q.rpc) {
      LOG.push({ rpc: q.rpc });
      const t = q.a && q.a.p_token, p = /^[A-Za-z0-9_-]{24,64}$/.test(t || '') ? DB.presentations.find((r) => r.share_token === t && r.share_snapshot) : null;
      return { data: p ? { title: p.title, language: p.language, shared_at: p.shared_at, slides: (p.share_snapshot && p.share_snapshot.slides) || [] } : null, error: null };
    }
    const T = DB[q.t]; if (!T) return { data: null, error: { message: 'tablo yok ' + q.t } };
    const keys = q.x && !Array.isArray(q.x) ? Object.keys(q.x) : null;
    LOG.push({ t: q.t, op: q.op, keys, f: q.f.map((x) => x[0]) });
    if (AYAR.pushHata && q.t === 'presentation_slides' && q.op !== 'select') return { data: null, error: { message: 'test: kayıt reddedildi' } };
    if (q.op === 'insert') {
      const xs = (Array.isArray(q.x) ? q.x : [q.x]).map((x) => sirala(Object.assign({ id: crypto.randomUUID() }, kopya(x), q.t === 'presentations' && !x.updated_at ? { updated_at: simdi() } : {})));
      T.push(...xs); return { data: q.tek ? xs[0] : xs, error: null };
    }
    if (q.op === 'update') {
      if (q.t === 'presentations' && keys && keys.includes('share_snapshot')) {
        if (AYAR.hata && keys.length === 1) return { data: null, error: { message: 'test: sunucu hatası' } };
        if (AYAR.araya && keys.length === 1) { const f = AYAR.araya; AYAR.araya = null; f(); }      /* koşullu yazım gelirken başka cihaz kaydeder */
      }
      const hedef = T.filter((r) => uygun(r, q.f));
      hedef.forEach((r) => {
        if (q.t === 'presentations' && q.x.share_snapshot) YAZIM.push({ kaynak: keys.length === 1 ? 'yalniz' : keys.includes('share_token') ? 'baglanti' : 'push', surum: q.x.share_snapshot.surum || null, icerik: icerikSurum(r.id), metin: JSON.stringify(q.x.share_snapshot) });
        Object.assign(r, sirala(kopya(q.x))); if (q.t === 'presentations') r.updated_at = simdi();      /* presentations_set_updated_at */
      });
      return { data: kopya(hedef).map((r) => takma(q.sel, r)), error: null };
    }
    if (q.op === 'delete') { DB[q.t] = T.filter((r) => !uygun(r, q.f)); return { data: [], error: null }; }
    let rows = T.filter((r) => uygun(r, q.f));
    if (q.ord) { const [k, asc] = q.ord; rows = rows.slice().sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (asc ? 1 : -1)); }
    rows = kopya(rows).map((r) => takma(q.sel, r));
    return { data: q.tek ? rows[0] || null : rows, error: null };
  };
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => {
      res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*');
      if (req.method === 'OPTIONS') { res.end(); return; }
      let out; try { out = isle(JSON.parse(b)); } catch (e) { out = { data: null, error: { message: String(e) } }; }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(out));
    });
  });
  /* başka bir cihazın (C) yedek yazıyla kaydı: asetatlar önce, satır sonra (push sırası), görüntü yok, işaret var */
  const cKaydet = (ek) => {
    const p = DB.presentations[0], rs = DB.presentation_slides.filter((r) => r.presentation_id === p.id).sort((a, b) => a.order_index - b.order_index);
    const r1 = rs[1], e = r1.content.els.filter((x) => (x.type === 'ul' || x.type === 't') && x.text && !x.muted && !x.dz).sort((a, b) => b.text.length - a.text.length)[0];
    e.text += '\n' + ek; const K = 'c-' + crypto.randomUUID(); rs[0].content = sirala(Object.assign({}, rs[0].content, { surum: K, snapBekle: 1 })); r1.content = sirala(r1.content);
    p.updated_at = simdi();
  };
  const P = () => DB.presentations[0] || {};
  const dokun = () => { P().updated_at = simdi(); };      /* yalnız updated_at ilerler (ör. başka cihazın görüntü yenilemesi) */
  const slayt = () => JSON.stringify(DB.presentation_slides.filter((r) => r.presentation_id === P().id).sort((a, b) => a.order_index - b.order_index).map((r) => r.content));
  return { DB, LOG, YAZIM, AYAR, srv, cKaydet, P, slayt, dokun };
};

/* ---------------- sayfalar ---------------- */
const fontUrl = (n) => pathToFileURL(path.join(ROOT, 'assets/landing/fonts', n)).href;
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATEXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const yuz = (fam, dosya) => ['400', '700'].map((w) => `@font-face{font-family:"${fam}";font-weight:${w};src:url("${fontUrl(dosya + '-latin.woff2')}") format("woff2");unicode-range:${LATIN}}@font-face{font-family:"${fam}";font-weight:${w};src:url("${fontUrl(dosya + '-latin-ext.woff2')}") format("woff2");unicode-range:${LATEXT}}`).join('');
const KANCA = `  window.__S = { set: function (st, pm) { strips = st; plotMeta = pm; }, bas: bas, deck: function () { return deck; }, temaSec: temaSec, TEMALAR: TEMALAR, store: store,
    yedek: function () { return fontYedek; }, basiliyor: function () { return basiliyor; }, kuyruk: function () { return yaziKuyruk.length; }, hazirMi: function () { return yaziHazirMi(); }, dirty: function () { dirty(); }, ucus: function () { return snapUcus; },
    saveNow: saveNow, syncList: syncList };\n`;
const ORTAK = `
  var S = window.__S, R = {}, d = document, bekle = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var sakin = async function () { for (var k = 0; k < 160 && (!S.deck() || S.kuyruk() || !S.hazirMi() || S.basiliyor()); k++) await bekle(50); await bekle(120); };
  var dur = async function (ms) { await sakin(); await bekle(ms); for (var k = 0; k < 100 && S.ucus(); k++) { try { await S.ucus(); } catch (e) {} await bekle(100); } await sakin(); };
  var AX = S.TEMALAR.filter(function (t) { return t.id === 'ax-pitch'; })[0].def, TEMA = { def: Object.assign({}, AX, { id: 'dz-kayip', hf: 'Dz Kayip', bf: 'Dz Kayip' }) };
  var yazi = function () { var s = S.deck().slides[1]; return s && s.els.filter(function (e) { return (e.type === 'ul' || e.type === 't') && e.text && !e.muted && !e.dz; }).sort(function (a, b) { return b.text.length - a.text.length; })[0]; };
  var durum = function () { var D = S.deck(), x = D.id ? localStorage.getItem(S.store.k('d.' + D.id)) : null, m = D.id ? S.store.meta(D.id) : null;
    return { id: D.id, dbId: D.dbId || null, share: !!D.share, snapBekle: D.snapBekle || null, yedek: S.yedek(), metin: JSON.stringify(D.slides), yerelBekle: x ? JSON.parse(x).snapBekle || null : null,
      yerelMetin: x || '', bekleyen: m ? m.bekleyen || null : null, not: (d.querySelector('[data-toast-t]') || {}).textContent || '',
      ekran: D.slides.map(function (s) { return s.els.filter(function (e) { return (e.type === 't' || e.type === 'ul' || e.type === 'h') && e.text && !e.dz; }).map(function (e) { return [e.id, e.size]; }); }) }; };
`;
const istemci = (port, gecik) => `<script>
(function () { var SRV = 'http://127.0.0.1:${port}/';
  var istek = function (body) { body.saat = Date.now(); if (window.__cevrimdisi) return Promise.resolve({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    return new Promise(function (res) { var x = new XMLHttpRequest(); x.open('POST', SRV); x.setRequestHeader('Content-Type', 'text/plain'); x.onload = function () { res(JSON.parse(x.responseText)); }; x.onerror = function () { res({ data: null, error: { message: 'ag' } }); }; x.send(JSON.stringify(body)); }); };
  window.supabaseClient = { functions: { invoke: function () { return Promise.reject(new Error('test: model yok')); } },
    rpc: function (n, a) { return istek({ rpc: n, a: a }); },
    from: function (t) { var q = { t: t, op: 'select', f: [], ord: null, tek: 0, sel: '' }, o = {
      select: function (c) { q.sel = c || ''; return o; }, eq: function (k, v) { q.f.push([k, v]); return o; }, order: function (k, op) { q.ord = [k, !op || op.ascending !== false]; return o; }, limit: function () { return o; },
      single: function () { q.tek = 1; return o; }, maybeSingle: function () { q.tek = 2; return o; }, insert: function (x) { q.op = 'insert'; q.x = x; return o; }, update: function (x) { q.op = 'update'; q.x = x; return o; }, delete: function () { q.op = 'delete'; return o; },
      then: function (a, b) { var g = ${gecik || 0} && q.t === 'presentations' && q.f.some(function (f) { return f[0] === 'user_id'; }) ? ${gecik || 0} : 0;      /* yavaş ağ: hesap listesi (syncList) geç gelir */
        var cas = q.op === 'update' && q.f.some(function (f) { return f[0] === 'updated_at'; }) && window.__casOnce, h = cas ? window.__casOnce : null; if (cas) window.__casOnce = null;
        var ps = !h && q.op === 'update' && q.t === 'presentations' && q.x && 'slide_count' in q.x && window.__pushOnce; if (ps) { h = window.__pushOnce; window.__pushOnce = null; }      /* deste kaydının son adımı (satır) gönderilmeden hemen önce */
        return (g ? new Promise(function (r) { setTimeout(r, g); }) : Promise.resolve()).then(function () { return h && h(); }).then(function () { return istek(q); })
          .then(function (x) { if (window.__sonraCevrimdisi) window.__cevrimdisi = true; return x; }).then(a, b); } }; return o; } };
})();
</script>`;

const duzenek = () => {
  const ink = read('js/acadex-ink.js'), html = read('dashboard.html').split('\n'), izle = read('izle.html');
  const i0 = html.findIndex((l) => l.includes('<section id="acadexsunum-view"')), i1 = html.findIndex((l, i) => i > i0 && l.includes('<div id="axu-layer">'));
  const ma = ink.indexOf("  (function () {\n  var root = document.getElementById('sunum'); if (!root) return;"), son = '  if (me()) boot();\n\n  })();', mb = ink.indexOf(son, ma);
  if (i0 < 0 || i1 < 0 || ma < 0 || mb < 0) throw new Error('düzenek: dilim sınırları bulunamadı');
  const W = fs.mkdtempSync(path.join(os.tmpdir(), 'acadex-capraz-'));
  fs.writeFileSync(path.join(W, 'ok-dz-kayip.css'), yuz('Dz Kayip', 'instrument'));
  const BASE = pathToFileURL(W).href + '/';
  const kesici = (font) => `<script>
window.__ag = [];
(function () { var ap = document.head.appendChild.bind(document.head);
  document.head.appendChild = function (n) {
    if (!(n && n.tagName === 'LINK' && /fonts\\.bunny\\.net/.test(n.href))) return ap(n);
    var slug = decodeURIComponent(n.href.split('family=')[1].split(':')[0]);
    n.href = ${JSON.stringify(BASE)} + (${JSON.stringify(font)} === 'ok' ? 'ok-' : 'yok-') + slug + '.css'; return ap(n);
  }; })();
window.fetch = function (u) { window.__ag.push(String(u)); return Promise.reject(new Error('test: ağ kapalı')); };
</script>`;
  const sayfa = (font, port, gecik, govde) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(ROOT, 'css/acadex-ink.css')).href}"></head><body>
${kesici(font)}${istemci(port, gecik)}
<script>window.currentUser = { id: 'u-capraz' };</script>
${html.slice(i0, i1 + 2).join('\n')}
<pre id="diag"></pre>
<script>
${ink.slice(ma, mb).replace('FONT_SURE = 8000', 'FONT_SURE = 700') + '  if (me()) boot();\n' + KANCA + '\n  })();'}
</script>
<script>
(async function () {
${ORTAK}
  try {
${govde}
  } catch (e) { R.hata = String(e && e.stack || e); }
  R.ag = window.__ag; d.getElementById('diag').textContent = JSON.stringify(R);
})();
</script></body></html>`;
  const sayfaV = (port, tok) => {
    let h = izle; const r = (a, b) => { if (h.split(a).length !== 2) throw new Error('izle.html değişmiş: ' + a); h = h.replace(a, b); };
    r('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">', '');
    r('href="css/acadex-ink.css"', 'href="' + pathToFileURL(path.join(ROOT, 'css/acadex-ink.css')).href + '"');
    r('<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js"></script>', '<script src="' + pathToFileURL(path.join(ROOT, 'node_modules/dompurify/dist/purify.min.js')).href + '"></script>');
    r('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>', kesici('ok') + istemci(port, 0));
    r('<script src="js/supabase-config.js"></script>', '');
    r("new URLSearchParams(location.search).get('k') || ''", JSON.stringify(tok || 'yokyokyokyokyokyokyokyok'));
    h = h.replace(/<link rel="(icon|apple-touch-icon)"[^>]*>\n/g, '').replace('<img src="assets/logo-icon-only.png" alt="">', '');
    return h.replace('</body>', `<pre id="diag"></pre><script>
(async function () { var R = {}, bekle = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  for (var k = 0; k < 100 && !document.querySelector('#vw-stage .sx-slide, #vw-stage .vw-msg b'); k++) await bekle(50); await bekle(300);
  var n = +(document.getElementById('vw-pos').textContent.split('/')[1] || 0), t = []; for (var i = 0; i < n; i++) { t.push(document.getElementById('vw-stage').textContent); document.getElementById('vw-next').click(); await bekle(60); }
  R.n = n; R.metin = t.join(' | '); R.ag = window.__ag; document.getElementById('diag').textContent = JSON.stringify(R); })();
</script>\n</body>`);
  };
  const kos = (dosya, prof, icerik) => new Promise((res, rej) => {
    fs.writeFileSync(path.join(W, dosya), icerik);
    execFile(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + path.join(W, 'prof-' + prof), '--allow-file-access-from-files', '--virtual-time-budget=60000', '--dump-dom', pathToFileURL(path.join(W, dosya)).href], { maxBuffer: 64 << 20, timeout: 180000 }, (e, out) => {
      if (e) return rej(e); const m = String(out).match(/<pre id="diag">([\s\S]*?)<\/pre>/); if (!m) return rej(new Error(dosya + ': diag yok'));
      res(JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&')));
    });
  });
  const temizle = () => { try { fs.rmSync(W, { recursive: true, force: true }); } catch (e) { /* geçici klasör */ } };
  return { W, sayfa, sayfaV, kos, temizle };
};

module.exports = { ROOT, read, CHROME, yeniSunucu, duzenek };
