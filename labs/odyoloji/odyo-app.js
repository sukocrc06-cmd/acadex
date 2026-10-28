/* ==========================================================================
   ACADEX ODYOLOJİ LAB · uygulama (labs/odyoloji/odyo-app.js), 29.10.2026
   Sekmeler, ses motoru, KABİN (sanal odyometre), VAKA MASASI ve MedLab köprüsü.
   3B kulak ayrı modülde (odyo-kulak.js) ve window.OL.kulak üzerinden bağlanır.
   Model ve klinik kurallar: odyo-model.js (window.AXODY).
   ========================================================================== */
(function () {
  'use strict';
  var A = window.AXODY, D = document, W = window;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ls = { get: function (k, d) { try { var v = localStorage.getItem('acadex.odyo.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('acadex.odyo.' + k, JSON.stringify(v)); } catch (e) {} } };
  var OL = W.OL = W.OL || {};
  var EAR = { R: 'Sağ', L: 'Sol' };
  var toast = function (t) { var el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2600); };
  var live = function (t) { $('#live').textContent = t; };

  /* ---------------- sekmeler ---------------- */
  var tab = 'kabin';
  var setTab = function (k) {
    tab = k;
    $$('.ol-tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === k)); });
    $$('.ol-view').forEach(function (v) { v.classList.toggle('on', v.id === k); });
    if (k === 'kulak' && OL.kulak && OL.kulak.start) OL.kulak.start();
    if (k === 'kulak' && !OL.kulak) OL.kulakWanted = true;
    ls.set('tab', k); bridgeSend();
  };
  $$('.ol-tabs [data-tab]').forEach(function (b) { b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); }); });
  OL.setTab = setTab;

  /* ---------------- ses motoru ---------------- */
  /* Kalibre değil: dB HL, sıkıştırılmış bir ölçekle genliğe çevrilir (100 dB HL ≈ tam ölçek × düzey,
     40 dB HL ≈ -30 dB). Üst sınır: ana kazanç ≤ 0,35. */
  var snd = { on: ls.get('snd', true), vol: ls.get('vol', 35), ok: ls.get('sndOk', false), ctx: null, noise: null };
  var sndBtn = $('#snd'), volEl = $('#vol');
  var paintSnd = function () { sndBtn.setAttribute('aria-pressed', String(snd.on)); sndBtn.setAttribute('aria-label', snd.on ? 'Sesi kapat' : 'Sesi aç'); volEl.value = snd.vol; volEl.disabled = !snd.on; };
  paintSnd();
  sndBtn.addEventListener('click', function () { snd.on = !snd.on; ls.set('snd', snd.on); paintSnd(); toast(snd.on ? 'Ses açık (kalibre değil).' : 'Sessiz çalışıyorsun; hasta yine yanıt verir.'); });
  volEl.addEventListener('input', function () { snd.vol = +volEl.value; ls.set('vol', snd.vol); });
  var ac = function () {
    if (!snd.ctx) { var C = W.AudioContext || W.webkitAudioContext; if (!C) return null; snd.ctx = new C(); }
    if (snd.ctx.state === 'suspended') snd.ctx.resume();
    return snd.ctx;
  };
  var amp = function (hl) { return Math.min(1, Math.pow(10, (hl - 100) / 40)); };
  var noiseBuf = function (c) {
    if (snd.noise) return snd.noise;
    var b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return snd.noise = b;
  };
  var play = function (o) { /* {f, ear, hl, bc, mask:{on,M}} */
    if (!snd.on || !snd.ok) return;
    var c = ac(); if (!c) return;
    var t0 = c.currentTime + 0.02, dur = 1, master = snd.vol / 100 * 0.35;
    var osc = c.createOscillator(), g = c.createGain(), pan = c.createStereoPanner ? c.createStereoPanner() : null;
    osc.type = 'sine'; osc.frequency.value = o.f;
    var a = amp(o.hl) * master * (o.bc ? 0.7 : 1);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + 0.03); g.gain.setValueAtTime(a, t0 + dur - 0.03); g.gain.linearRampToValueAtTime(0, t0 + dur);
    if (pan) { pan.pan.value = o.ear === 'R' ? 1 : -1; osc.connect(g); g.connect(pan); pan.connect(c.destination); } else { osc.connect(g); g.connect(c.destination); }
    osc.start(t0); osc.stop(t0 + dur + 0.05);
    if (o.mask && o.mask.on) {
      var n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain(), np = c.createStereoPanner ? c.createStereoPanner() : null;
      n.buffer = noiseBuf(c); bp.type = 'bandpass'; bp.frequency.value = o.f; bp.Q.value = 3.5;
      var na = amp(o.mask.M) * master * 1.6;
      ng.gain.setValueAtTime(0, t0 - 0.01); ng.gain.linearRampToValueAtTime(na, t0 + 0.05); ng.gain.setValueAtTime(na, t0 + dur + 0.1); ng.gain.linearRampToValueAtTime(0, t0 + dur + 0.2);
      n.connect(bp); bp.connect(ng); if (np) { np.pan.value = o.ear === 'R' ? -1 : 1; ng.connect(np); np.connect(c.destination); } else ng.connect(c.destination);
      n.start(t0 - 0.01); n.stop(t0 + dur + 0.25);
    }
  };
  var modal = $('#snd-modal');
  var askSound = function (then) {
    if (snd.ok || !snd.on) { then(); return; }
    modal.hidden = false; $('#snd-ok').focus();
    $('#snd-ok').onclick = function () { snd.ok = true; ls.set('sndOk', true); modal.hidden = true; ac(); then(); };
    $('#snd-off').onclick = function () { snd.ok = true; snd.on = false; ls.set('sndOk', true); ls.set('snd', false); paintSnd(); modal.hidden = true; then(); };
  };

  /* =========================== KABİN =========================== */
  var F = A.FREQS, K = { ear: 'R', mode: 'ac', fi: 2, L: 40, mask: false, M: 50, pid: null, lv: 1, marks: {}, tape: [], busy: false, showT: false, graded: false };
  var pts = function (lv) { return Object.keys(A.P).map(function (k) { return A.P[k]; }).filter(function (p) { return p.kabin && p.seviye === lv; }); };
  var done = ls.get('kabinDone', {});
  var paintPts = function () {
    $$('.pt-lv [data-lv]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-lv') === K.lv)); });
    $('#pt-list').innerHTML = pts(K.lv).map(function (p) {
      return '<button type="button" class="pt" data-pid="' + p.id + '" aria-pressed="' + (p.id === K.pid) + '"><span class="av" aria-hidden="true">' + X(p.ad.charAt(0)) + '</span><span><b>' + X(p.ad) + ', ' + p.yas + '</b><small>' + X(p.ozet) + '</small></span>' +
        (done[p.id] != null ? '<span class="pill ok done">%' + done[p.id] + '</span>' : '') + '</button>';
    }).join('');
  };
  $$('.pt-lv [data-lv]').forEach(function (b) { b.addEventListener('click', function () { K.lv = +b.getAttribute('data-lv'); paintPts(); }); });
  $('#pt-list').addEventListener('click', function (e) { var b = e.target.closest('[data-pid]'); if (b) pick(b.getAttribute('data-pid')); });
  var pick = function (id) {
    var p = A.P[id]; if (!p) return;
    K.pid = id; K.marks = ls.get('marks.' + id, {}); K.tape = []; K.graded = false; K.showT = false; K.ear = 'R'; K.mode = 'ac'; K.fi = 2; K.L = 40; K.mask = false; K.M = 50;
    $('#karne').innerHTML = ''; $('#show-t').disabled = true; $('#show-t').setAttribute('aria-pressed', 'false');
    paintPts(); paintDev(); paintAg(); paintTape(); paintYor(); say(''); ls.set('pid', id); bridgeSend();
  };
  var cur = function () { return A.P[K.pid]; };
  var fq = function () { return F[K.fi]; };
  var key = function (ear, mode, f) { return ear + '.' + mode + '.' + f; };
  var validF = function () { return K.mode === 'ac' || A.BC_FREQS.indexOf(fq()) >= 0; };
  var maxL = function () { return (A.MAX[K.mode] || {})[fq()] || 0; };

  var paintDev = function () {
    var e = $('#lc-ear'); e.className = 'lcd ' + K.ear; e.querySelector('b').textContent = K.ear === 'R' ? 'SAĞ' : 'SOL';
    $('#lc-mode b').textContent = K.mode === 'ac' ? 'HAVA' : 'KEMİK';
    $('#lc-f b').innerHTML = (fq() >= 1000 ? (fq() / 1000) + '<small>kHz</small>' : fq() + '<small>Hz</small>');
    $('#lc-db b').innerHTML = K.L + '<small>dB HL</small>';
    var m = $('#lc-m'); m.classList.toggle('off', !K.mask); m.querySelector('b').innerHTML = K.mask ? K.M + '<small>dB EM → ' + (K.ear === 'R' ? 'SOL' : 'SAĞ') + '</small>' : 'KAPALI';
    $('#k-R').setAttribute('aria-pressed', String(K.ear === 'R')); $('#k-L').setAttribute('aria-pressed', String(K.ear === 'L'));
    $('#k-ac').setAttribute('aria-pressed', String(K.mode === 'ac')); $('#k-bc').setAttribute('aria-pressed', String(K.mode === 'bc'));
    $('#m-on').setAttribute('aria-pressed', String(K.mask));
    $('#f-1k').textContent = fq() >= 1000 ? (fq() / 1000) + ' kHz' : fq() + ' Hz';
    var ok = !!K.pid && validF();
    $('#ton').disabled = !ok; $('#mark').disabled = !ok; $('#nr').disabled = !ok;
    paintRule(); paintCursor();
  };
  var clampL = function () { K.L = Math.max(A.MIN, Math.min(maxL() || 120, K.L)); };
  var setF = function (d) {
    var i = K.fi + d;
    while (i >= 0 && i < F.length && K.mode === 'bc' && A.BC_FREQS.indexOf(F[i]) < 0) i += d;
    if (i < 0 || i >= F.length) return; K.fi = i; clampL(); paintDev(); bridgeSend();
  };
  var setL = function (d) { K.L += d; clampL(); paintDev(); };
  var setEar = function (e) { K.ear = e; paintDev(); bridgeSend(); };
  var setMode = function (m) { K.mode = m; if (m === 'bc' && A.BC_FREQS.indexOf(fq()) < 0) K.fi = F.indexOf(4000); clampL(); paintDev(); bridgeSend(); };
  var setMask = function (on) { K.mask = on; paintDev(); bridgeSend(); };
  var setM = function (d) { K.M = Math.max(0, Math.min(110, K.M + d)); if (!K.mask) K.mask = true; paintDev(); };
  $('#k-R').onclick = function () { setEar('R'); }; $('#k-L').onclick = function () { setEar('L'); };
  $('#k-ac').onclick = function () { setMode('ac'); }; $('#k-bc').onclick = function () { setMode('bc'); };
  $('#f-dn').onclick = function () { setF(-1); }; $('#f-up').onclick = function () { setF(1); }; $('#f-1k').onclick = function () { K.fi = 2; clampL(); paintDev(); };
  $('#l-dn').onclick = function () { setL(-5); }; $('#l-up').onclick = function () { setL(5); }; $('#l-dn10').onclick = function () { setL(-10); }; $('#l-up10').onclick = function () { setL(10); };
  $('#m-on').onclick = function () { setMask(!K.mask); }; $('#m-dn').onclick = function () { setM(-5); }; $('#m-up').onclick = function () { setM(5); };

  /* ton ver: hasta yanıtı modelden */
  var win = $('#win'), lamp = $('#lamp');
  var say = function (t) { var s = $('#say'); s.textContent = t; s.classList.toggle('on', !!t); };
  var tone = function () {
    if (!K.pid || K.busy || !validF()) return;
    askSound(function () {
      K.busy = true;
      var p = cur(), st = { ear: K.ear, mode: K.mode, f: fq(), L: K.L, mask: { on: K.mask, M: K.M } };
      var r = A.respond(p, st);
      play({ f: fq(), ear: K.ear, hl: K.L, bc: K.mode === 'bc', mask: st.mask });
      var b = $('#ton'); b.classList.remove('play'); void b.offsetWidth; b.classList.add('play');
      K.tape.push({ ear: K.ear, mode: K.mode, f: fq(), L: K.L, y: r.heard, m: K.mask ? K.M : null }); if (K.tape.length > 12) K.tape.shift(); paintTape();
      say('');
      setTimeout(function () {
        if (r.heard) {
          lamp.classList.add('on'); win.classList.add('heard'); live('Hasta yanıt verdi');
          if (r.via === 'cross' && K.mode === 'ac' && Math.random() < 0.5) say('Duydum… galiba diğer kulağımda?');
          else if (r.overmask && Math.random() < 0.5) say('Bu hışırtı çok yüksek…');
          setTimeout(function () { lamp.classList.remove('on'); win.classList.remove('heard'); }, 900);
        } else live('Yanıt yok');
        K.busy = false;
      }, r.heard ? 420 + Math.random() * 300 : 650);
    });
  };
  $('#ton').addEventListener('click', tone);

  /* işaretle */
  var mark = function (nr) {
    if (!K.pid || !validF()) return;
    var k = key(K.ear, K.mode, fq());
    K.marks[k] = { L: nr ? maxL() : K.L, masked: !!K.mask, nr: !!nr, M: K.mask ? K.M : null };
    ls.set('marks.' + K.pid, K.marks); K.lastKey = k; paintAg(); paintRule(); bridgeSend();
    toast(EAR[K.ear] + ' · ' + (K.mode === 'ac' ? 'hava' : 'kemik') + ' · ' + fq() + ' Hz: ' + (nr ? 'yanıt yok' : K.L + ' dB HL') + (K.mask ? ' (maskeli)' : '') + ' işaretlendi');
  };
  $('#mark').onclick = function () { mark(false); }; $('#nr').onclick = function () { mark(true); };
  $('#undo').onclick = function () { if (K.lastKey && K.marks[K.lastKey]) { delete K.marks[K.lastKey]; ls.set('marks.' + K.pid, K.marks); K.lastKey = null; paintAg(); paintRule(); toast('Son işaret geri alındı.'); } };
  $('#clr').onclick = function () { if (!K.pid || !confirm('Bu hastanın odyogramı temizlensin mi?')) return; K.marks = {}; ls.set('marks.' + K.pid, {}); K.graded = false; $('#karne').innerHTML = ''; paintAg(); paintRule(); };

  /* klavye (kabin açıkken; yazı alanlarında değil) */
  D.addEventListener('keydown', function (e) {
    if (tab !== 'kabin' || !modal.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target; if (t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable)) return;
    var k = e.key;
    if (k === ' ') { e.preventDefault(); $('#ton').classList.add('down'); tone(); }
    else if (k === 'ArrowUp') { e.preventDefault(); setL(5); } else if (k === 'ArrowDown') { e.preventDefault(); setL(-5); }
    else if (k === 'ArrowLeft') { e.preventDefault(); setF(-1); } else if (k === 'ArrowRight') { e.preventDefault(); setF(1); }
    else if (k === 's' || k === 'S') setEar('R'); else if (k === 'l' || k === 'L') setEar('L');
    else if (k === 'm' || k === 'M') setMask(!K.mask); else if (k === 'Enter' && t === D.body) mark(false);
  });
  D.addEventListener('keyup', function (e) { if (e.key === ' ') $('#ton').classList.remove('down'); });

  var paintTape = function () {
    $('#tape').innerHTML = K.tape.slice().reverse().map(function (x) {
      return '<span class="' + x.ear + ' ' + (x.y ? 'y' : 'n') + '" title="' + EAR[x.ear] + ' ' + (x.mode === 'ac' ? 'hava' : 'kemik') + (x.m != null ? ', maske ' + x.m + ' dB' : '') + '"><b>' + x.L + '</b>' + (x.f >= 1000 ? x.f / 1000 + 'k' : x.f) + (x.mode === 'bc' ? ' K' : '') + ' ' + (x.y ? '✓' : '·') + '</span>';
    }).join('');
  };

  /* ---------------- odyogram çizimi ---------------- */
  var G = { L: 58, R: 22, T: 44, B: 22, W: 640, H: 470 };
  var idxOf = function (f) { return Math.log2(f / 250); };
  var gx = function (f) { var w = G.W - G.L - G.R; return G.L + (idxOf(f) + 0.35) / 5.7 * w; };
  var gy = function (db) { var h = G.H - G.T - G.B; return G.T + (db + 10) / 130 * h; };
  var sym = function (ear, mode, masked, x, y, cls) {
    var c = ear === 'R' ? 'sR' : 'sL', o = mode === 'bc' ? (ear === 'R' ? -14 : 14) : 0, s = '';
    x += o;
    if (mode === 'ac') {
      if (ear === 'R') s = masked ? '<path class="' + c + '" d="M' + x + ' ' + (y - 8) + 'L' + (x + 8) + ' ' + (y + 6) + 'H' + (x - 8) + 'Z"/>' : '<circle class="' + c + '" cx="' + x + '" cy="' + y + '" r="7"/>';
      else s = masked ? '<rect class="' + c + '" x="' + (x - 7) + '" y="' + (y - 7) + '" width="14" height="14"/>' : '<path class="' + c + '" d="M' + (x - 7) + ' ' + (y - 7) + 'L' + (x + 7) + ' ' + (y + 7) + 'M' + (x + 7) + ' ' + (y - 7) + 'L' + (x - 7) + ' ' + (y + 7) + '"/>';
    } else {
      if (ear === 'R') s = masked ? '<path class="' + c + '" d="M' + (x + 4) + ' ' + (y - 8) + 'H' + (x - 3) + 'V' + (y + 8) + 'H' + (x + 4) + '"/>' : '<path class="' + c + '" d="M' + (x + 5) + ' ' + (y - 8) + 'L' + (x - 5) + ' ' + y + 'L' + (x + 5) + ' ' + (y + 8) + '"/>';
      else s = masked ? '<path class="' + c + '" d="M' + (x - 4) + ' ' + (y - 8) + 'H' + (x + 3) + 'V' + (y + 8) + 'H' + (x - 4) + '"/>' : '<path class="' + c + '" d="M' + (x - 5) + ' ' + (y - 8) + 'L' + (x + 5) + ' ' + y + 'L' + (x - 5) + ' ' + (y + 8) + '"/>';
    }
    return cls ? '<g class="' + cls + '">' + s + '</g>' : s;
  };
  var nrArrow = function (ear, x, y) { var c = ear === 'R' ? 'sR' : 'sL', d = ear === 'R' ? -1 : 1; return '<path class="' + c + '" d="M' + x + ' ' + (y + 8) + 'l' + (d * 10) + ' 12m' + (-d * 6) + ' 0h' + (d * 6) + 'v-6"/>'; };
  var agBase = function () {
    var s = '<rect x="' + G.L + '" y="' + gy(-10) + '" width="' + (G.W - G.L - G.R) + '" height="' + (gy(25) - gy(-10)) + '" class="band"/>';
    for (var db = -10; db <= 120; db += 10) s += '<line class="gl' + (db % 20 === 0 ? ' o' : '') + '" x1="' + G.L + '" x2="' + (G.W - G.R) + '" y1="' + gy(db) + '" y2="' + gy(db) + '"/><text class="ax" x="' + (G.L - 8) + '" y="' + (gy(db) + 4) + '" text-anchor="end">' + db + '</text>';
    F.forEach(function (f) { var x = gx(f); s += '<line class="gl' + ([3000, 6000].indexOf(f) >= 0 ? '' : ' o') + '" x1="' + x + '" x2="' + x + '" y1="' + G.T + '" y2="' + (G.H - G.B) + '"' + ([3000, 6000].indexOf(f) >= 0 ? ' stroke-dasharray="3 3"' : '') + '/><text class="ax" x="' + x + '" y="' + (G.T - 14) + '" text-anchor="middle">' + (f >= 1000 ? f / 1000 + 'k' : f) + '</text>'; });
    s += '<text class="ax" x="' + (G.L - 46) + '" y="' + (G.T - 14) + '">Hz</text><text class="ax" x="12" y="' + (gy(55)) + '" transform="rotate(-90 12 ' + gy(55) + ')" text-anchor="middle">İşitme seviyesi (dB HL)</text>';
    return s;
  };
  var drawMarks = function (marks, cls) {
    var s = '';
    ['R', 'L'].forEach(function (e) {
      var pts = F.map(function (f) { var m = marks[key(e, 'ac', f)]; return m && !m.nr ? [gx(f), gy(m.L)] : null; });
      var d = '', on = false; pts.forEach(function (p) { if (!p) { on = false; return; } d += (on ? 'L' : 'M') + p[0] + ' ' + p[1]; on = true; });
      if (d) s += '<path class="' + (e === 'R' ? 'lnR' : 'lnL') + '" d="' + d + '"/>';
      ['ac', 'bc'].forEach(function (mo) { F.forEach(function (f) { var m = marks[key(e, mo, f)]; if (!m) return; var x = gx(f), y = gy(m.L); s += sym(e, mo, m.masked, x, y); if (m.nr) s += nrArrow(e, x + (mo === 'bc' ? (e === 'R' ? -14 : 14) : 0), y); }); });
    });
    return cls ? '<g class="' + cls + '">' + s + '</g>' : s;
  };
  var truthMarks = function (p) {
    var m = {};
    ['R', 'L'].forEach(function (e) { F.forEach(function (f) { m[key(e, 'ac', f)] = { L: p.ac[e][f], masked: A.needMask(p, e, 'ac', f) }; }); [500, 1000, 2000, 4000].forEach(function (f) { m[key(e, 'bc', f)] = { L: A.bcAt(p, e, f), masked: A.needMask(p, e, 'bc', f) }; }); });
    return m;
  };
  OL.audiogramSVG = function (p) { return '<svg class="ag" viewBox="0 0 ' + G.W + ' ' + G.H + '" role="img" aria-label="' + X(p.ad) + ' odyogramı">' + agBase() + drawMarks(truthMarks(p)) + '</svg>'; };
  var paintCursor = function () {
    var c = $('#ag .cur'); if (!c) return;
    c.setAttribute('cx', gx(fq()) + (K.mode === 'bc' ? (K.ear === 'R' ? -14 : 14) : 0)); c.setAttribute('cy', gy(K.L));
  };
  var paintAg = function () {
    var p = cur(), s = agBase();
    if (p && K.showT) s += drawMarks(truthMarks(p), 'tru');
    s += drawMarks(K.marks || {});
    if (p && K.graded && K.graded.rows) K.graded.rows.forEach(function (r) { if (r.mark && r.res !== 'dogru') { var x = gx(r.f) + (r.mode === 'bc' ? (r.ear === 'R' ? -14 : 14) : 0); s += '<circle class="bad" cx="' + x + '" cy="' + gy(r.mark.L) + '" r="12"/>'; } });
    s += '<circle class="cur" r="11" cx="0" cy="0"/>';
    $('#ag').innerHTML = s; paintCursor();
    $('#ag-t').textContent = p ? p.ad + ', ' + p.yas + ' · odyogram' : 'Hasta seç';
    var n = Object.keys(K.marks || {}).length; $('#ag-c').textContent = n + ' / ' + A.SCOPE.length + ' nokta';
  };
  /* odyograma tıklayınca frekans ve seviye oraya gelir */
  $('#ag').addEventListener('click', function (e) {
    if (!K.pid) return; var svg = e.currentTarget, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    var q = pt.matrixTransform(svg.getScreenCTM().inverse()), best = 0, bd = 1e9;
    F.forEach(function (f, i) { var d = Math.abs(gx(f) - q.x); if (d < bd) { bd = d; best = i; } });
    if (K.mode === 'bc' && A.BC_FREQS.indexOf(F[best]) < 0) return;
    K.fi = best; K.L = Math.round(((q.y - G.T) / (G.H - G.T - G.B) * 130 - 10) / 5) * 5; clampL(); paintDev();
  });
  var legend = function () {
    var it = [['R', 'ac', false, 'Sağ hava'], ['R', 'ac', true, 'Sağ hava, maskeli'], ['L', 'ac', false, 'Sol hava'], ['L', 'ac', true, 'Sol hava, maskeli'], ['R', 'bc', false, 'Sağ kemik'], ['R', 'bc', true, 'Sağ kemik, maskeli'], ['L', 'bc', false, 'Sol kemik'], ['L', 'bc', true, 'Sol kemik, maskeli']];
    $('#legend').innerHTML = it.map(function (x) { return '<span><svg viewBox="-12 -12 24 24" style="overflow:visible">' + sym(x[0], x[1], x[2], x[1] === 'bc' ? (x[0] === 'R' ? 14 : -14) : 0, 0).replace(/class="s([RL])"/g, 'fill="none" stroke-width="2.2" stroke="' + (x[0] === 'R' ? '#D64545' : '#2F6BFF') + '"') + '</svg>' + x[3] + '</span>'; }).join('');
  };
  legend();

  /* maskeleme kural kutusu: öğrencinin KENDİ ölçümleriyle kuralı uygular, gerçek eşiği söylemez */
  var paintRule = function () {
    var el = $('#rule'); if (!K.pid) { el.innerHTML = '<b>Başlamak için</b> soldan bir hasta seç. Önce iyi duyan kulakta 1000 Hz hava yolundan başla: 40 dB ile ton ver, yanıt varsa 10 dB in, yoksa 5 dB çık.'; return; }
    var f = fq(), n = A.other(K.ear), mk = K.marks;
    var acT = mk[key(K.ear, 'ac', f)], bcN = mk[key(n, 'bc', f)] || mk[key(n, 'bc', 1000)], acN = mk[key(n, 'ac', f)], bcT = mk[key(K.ear, 'bc', f)];
    var h = '';
    if (K.mode === 'ac') {
      h = '<b>Hava yolu kuralı:</b> test kulağının hava eşiği − 40 dB (kulaklıkta kulaklar arası azalma) ≥ öbür kulağın kemik eşiği ise maskele.';
      if (acT && !acT.nr) {
        var ref = bcN ? bcN.L : acN ? acN.L : null;
        if (ref != null) h += '<br>Senin ölçümlerinle: ' + acT.L + ' − 40 = ' + (acT.L - 40) + (acT.L - 40 >= ref ? ' ≥ ' : ' < ') + ref + ' (' + EAR[n] + ' ' + (bcN ? 'kemik' : 'hava') + ') → <b>' + (acT.L - 40 >= ref ? 'maskeleme gerekli' : 'maskeleme gerekmez') + '</b>.';
      }
    } else {
      h = '<b>Kemik yolu kuralı:</b> kemik yolu iki kokleayı birden uyarır (azalma ≈ 0 dB). Test kulağında hava-kemik aralığı 10 dB\'den büyükse maskele.';
      if (acT && bcT && !acT.nr) h += '<br>Senin ölçümlerinle aralık: ' + acT.L + ' − ' + bcT.L + ' = ' + (acT.L - bcT.L) + ' dB → <b>' + (acT.L - bcT.L > 10 ? (bcT.masked ? 'maskeli ölçtün' : 'maskeleme gerekli') : 'maskeleme gerekmez') + '</b>.';
    }
    if (K.mask) {
      var start = acN ? acN.L + 10 : null;
      h += '<br><b>Plato yöntemi:</b> maskeyi öbür kulağın hava eşiğinin 10 dB üstünden başlat' + (start != null ? ' (≈ ' + start + ' dB EM)' : '') + '; hasta yanıt verdikçe maskeyi 5 dB artır. Maske 3 adım arttığı hâlde eşik değişmiyorsa platodasın: gerçek eşik budur. "Hışırtı çok yüksek" diyorsa aşırı maskeleme olabilir.';
    }
    el.innerHTML = h;
  };

  /* ---------------- yorum + karne ---------------- */
  var opt = function (map, cur, ph) { return '<option value="">' + ph + '</option>' + Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + map[k] + '</option>'; }).join(''); };
  var DMAP = {}; A.DERECE.forEach(function (d) { DMAP[d.k] = d.t + (d.max < 999 ? ' (≤' + d.max + ')' : ' (>90)'); });
  var paintYor = function () {
    var y = ls.get('yor.' + K.pid, { R: {}, L: {} });
    $('#yor').innerHTML = ['R', 'L'].map(function (e) {
      return '<fieldset><legend><span class="pill ' + e + '">' + EAR[e] + ' kulak</span></legend>' +
        '<label>Tip<select data-y="' + e + '.tip">' + opt(A.TIP, y[e].tip, 'seç…') + '</select></label>' +
        '<label>Derece (SSO)<select data-y="' + e + '.derece">' + opt(DMAP, y[e].derece, 'seç…') + '</select></label>' +
        '<label>Konfigürasyon<select data-y="' + e + '.konf">' + opt(A.KONF, y[e].konf, 'seç…') + '</select></label></fieldset>';
    }).join('');
  };
  $('#yor').addEventListener('change', function (e) {
    var s = e.target.closest('[data-y]'); if (!s || !K.pid) return; var y = ls.get('yor.' + K.pid, { R: {}, L: {} }), k = s.getAttribute('data-y').split('.');
    y[k[0]][k[1]] = s.value; ls.set('yor.' + K.pid, y);
  });
  var RES = { golge: 'gölge eğri (maskesiz ölçüldü, cevabı öbür kulak verdi)', maskesiz: 'değer doğru ama maskeleme gerekiyordu', yanlis: 'eşik 5 dB\'den fazla farklı', eksik: 'ölçülmedi' };
  $('#eval').onclick = function () {
    var p = cur(); if (!p) { toast('Önce bir hasta seç.'); return; }
    var n = Object.keys(K.marks).length; if (n < 6) { toast('Değerlendirmek için en az 6 nokta işaretle.'); return; }
    var g = A.grade(p, K.marks), y = ls.get('yor.' + K.pid, { R: {}, L: {} }), yo = 0, ytot = 0, ylist = [];
    ['R', 'L'].forEach(function (e) { ['tip', 'derece', 'konf'].forEach(function (f) { ytot++; var ok = y[e][f] === p.ans[e][f]; if (ok) yo++; else ylist.push(EAR[e] + ' ' + (f === 'konf' ? 'konfigürasyon' : f) + ': doğrusu <b>' + X((f === 'tip' ? A.TIP : f === 'konf' ? A.KONF : DMAP)[p.ans[e][f]]) + '</b>' + (y[e][f] ? '' : ' (boş bıraktın)')); }); });
    var score = Math.round(g.pct * 0.6 + yo / ytot * 40);
    K.graded = g; K.showT = false; $('#show-t').disabled = false; paintAg();
    done[p.id] = score; ls.set('kabinDone', done); paintPts();
    var errs = g.rows.filter(function (r) { return r.res !== 'dogru'; });
    var byRes = {}; errs.forEach(function (r) { (byRes[r.res] = byRes[r.res] || []).push(r); });
    var col = score >= 80 ? 'var(--ok)' : score >= 55 ? 'var(--warn)' : 'var(--bad)';
    $('#karne').innerHTML = '<div class="karne"><div class="stamp" style="color:' + col + '"><b>' + score + '</b><small>PUAN</small></div>' +
      '<h3>' + X(p.ad) + ' · kabin karnesi</h3><p class="sub" style="margin:0 0 6px">Odyogram doğruluğu %' + g.pct + ' (' + g.ok + '/' + g.total + ' nokta) · yorum ' + yo + '/' + ytot + '</p>' +
      (byRes.golge ? '<p><b style="color:var(--bad)">Gölge eğri:</b> ' + byRes.golge.map(function (r) { return EAR[r.ear] + ' ' + (r.mode === 'ac' ? 'hava' : 'kemik') + ' ' + r.f + ' Hz'; }).join(', ') + '. Bu noktalarda maskelemeden ölçtün; yanıtı iyi duyan öbür kulak verdi.</p>' : '') +
      '<ul>' + ['maskesiz', 'yanlis', 'eksik'].filter(function (k) { return byRes[k]; }).map(function (k) { var rs = byRes[k]; return '<li><b>' + RES[k] + ':</b> ' + rs.slice(0, 8).map(function (r) { return EAR[r.ear] + ' ' + (r.mode === 'ac' ? 'H' : 'K') + ' ' + (r.f >= 1000 ? r.f / 1000 + 'k' : r.f); }).join(', ') + (rs.length > 8 ? ' +' + (rs.length - 8) : '') + '</li>'; }).join('') +
      ylist.map(function (t) { return '<li>' + t + '</li>'; }).join('') + (errs.length || ylist.length ? '' : '<li>Kusursuz. Bir üst seviyeye geç.</li>') + '</ul>' +
      '<p class="sub" style="margin:8px 0 0">Kırmızı halkalar hatalı noktaları gösterir. "Gerçek eşikleri göster" ile kesikli çizgide doğrularını görebilirsin.</p></div>';
    $('#eval-n').textContent = 'Son puan: ' + score;
    bridgeSend();
  };
  $('#show-t').onclick = function () { K.showT = !K.showT; this.setAttribute('aria-pressed', String(K.showT)); paintAg(); };

  /* =========================== VAKA MASASI =========================== */
  var V = { id: null, req: [], tani: null, yon: null, res: null };
  var vdone = ls.get('vakaDone', {});
  var paintVList = function () {
    $('#vk-list').innerHTML = A.CASES.map(function (c, i) {
      return '<button type="button" data-vid="' + c.id + '" aria-pressed="' + (c.id === V.id) + '" class="' + (vdone[c.id] != null ? 'done' : '') + '"><b>' + X(c.baslik) + '</b><small>Vaka ' + (i + 1) + (vdone[c.id] != null ? ' · puan ' + vdone[c.id] : '') + '</small></button>';
    }).join('');
  };
  $('#vk-list').addEventListener('click', function (e) { var b = e.target.closest('[data-vid]'); if (b) openCase(b.getAttribute('data-vid')); });
  var caseOf = function (id) { return A.CASES.filter(function (c) { return c.id === id; })[0]; };
  var timpSVG = function (t) {
    var W2 = 300, H2 = 150, x = function (p) { return 30 + (p + 400) / 600 * (W2 - 40); }, y = function (c) { return H2 - 22 - c / 2.5 * (H2 - 40); };
    var g = '<line x1="30" x2="' + (W2 - 10) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#C6CEDF"/><line x1="' + x(0) + '" x2="' + x(0) + '" y1="12" y2="' + y(0) + '" stroke="#DCE2EE" stroke-dasharray="3 3"/>';
    [-400, -200, 0, 200].forEach(function (p) { g += '<text x="' + x(p) + '" y="' + (H2 - 6) + '" font-size="10" text-anchor="middle" fill="#6A7593" font-family="JetBrains Mono">' + p + '</text>'; });
    g += '<text x="4" y="14" font-size="10" fill="#6A7593" font-family="JetBrains Mono">ml</text><text x="' + (W2 - 10) + '" y="' + (H2 - 6) + '" font-size="10" text-anchor="end" fill="#6A7593" font-family="JetBrains Mono">daPa</text>';
    ['R', 'L'].forEach(function (e) {
      var T = A.TIMP[t[e]], d = '';
      for (var p = -400; p <= 200; p += 10) { var c = T.tepe == null ? 0.08 + (p + 400) / 600 * 0.05 : T.uyum * Math.exp(-Math.pow((p - T.tepe) / 70, 2)) + 0.05; d += (p === -400 ? 'M' : 'L') + x(p).toFixed(1) + ' ' + y(c).toFixed(1); }
      g += '<path d="' + d + '" fill="none" stroke="' + (e === 'R' ? '#D64545' : '#2F6BFF') + '" stroke-width="2.2"/>';
    });
    return '<svg class="tp" viewBox="0 0 ' + W2 + ' ' + H2 + '" role="img" aria-label="Timpanogram">' + g + '</svg>';
  };
  var report = function (c, t) {
    var r = c.sonuc[t], p = c.hasta ? A.P[c.hasta] : null, h = '<h3>' + X(A.TESTS[t].t) + '</h3>';
    if (t === 'odyometri' && p) return h + OL.audiogramSVG(p) + '<p class="sub" style="margin:4px 0 0">Kırmızı: sağ, mavi: sol. △ □ [ ]: maskeli ölçüm.</p>';
    if (t === 'konusma' && p) return h + '<table><tr><th></th><th>SRT (dB HL)</th><th>SD (%)</th></tr><tr><td><span class="pill R">Sağ</span></td><td>' + p.srt.R + '</td><td>' + p.sd.R + '</td></tr><tr><td><span class="pill L">Sol</span></td><td>' + p.srt.L + '</td><td>' + p.sd.L + '</td></tr></table><p class="sub" style="margin:6px 0 0">SRT, saf ses ortalamasıyla ±10 dB uyumlu olmalı.</p>';
    if (t === 'timpanometri' && r && r.R) return h + timpSVG(r) + '<table><tr><th></th><th>Tip</th><th>Tepe basınç</th><th>Uyum</th><th>Kulak yolu hacmi</th></tr>' + ['R', 'L'].map(function (e) { var T = A.TIMP[r[e]]; return '<tr><td><span class="pill ' + e + '">' + EAR[e] + '</span></td><td>' + T.t + '</td><td>' + (T.tepe == null ? 'tepe yok' : T.tepe + ' daPa') + '</td><td>' + (T.tepe == null ? '—' : String(T.uyum).replace('.', ',') + ' ml') + '</td><td>' + String(r.ecv[e]).replace('.', ',') + ' ml</td></tr>'; }).join('') + '</table>';
    return h + '<p>' + X(r || 'Bu vakada sonuç yok.') + '</p>';
  };
  var openCase = function (id) {
    var c = caseOf(id); if (!c) return;
    var saved = ls.get('vaka.' + id, null);
    V = { id: id, req: saved ? saved.req : [], tani: saved ? saved.tani : null, yon: saved ? saved.yon : null, res: saved ? saved.res : null };
    paintVList(); paintCase(); bridgeSend();
  };
  var saveCase = function () { ls.set('vaka.' + V.id, { req: V.req, tani: V.tani, yon: V.yon, res: V.res }); };
  var paintCase = function () {
    var c = caseOf(V.id), m = $('#vk-main');
    if (!c) { m.innerHTML = '<div class="folder" data-tab="VAKA MASASI"><h2>Bir dosya aç</h2><p class="oyku">Soldan bir vaka seç. Öyküyü oku, gerekli gördüğün testleri iste, sonuçları yorumla; sonra tanı ve yönlendirmeyi seçip dosyayı kapat. Gereksiz test istemek puandan düşer.</p></div>'; return; }
    var closed = !!V.res;
    m.innerHTML = '<div class="folder" data-tab="HASTA DOSYASI · ' + (A.CASES.indexOf(c) + 1) + '"><h2>' + X(c.baslik) + '</h2><p class="oyku">' + X(c.oyku) + '</p>' +
      '<span class="k">test iste</span><div class="tests">' + Object.keys(A.TESTS).map(function (t) { var on = V.req.indexOf(t) >= 0; return '<button type="button" data-test="' + t + '" aria-pressed="' + on + '"' + (on || closed ? ' disabled' : '') + '><b>' + X(A.TESTS[t].t) + '</b><small>' + X(A.TESTS[t].d) + '</small></button>'; }).join('') + '</div>' +
      (V.req.length ? '<div class="reps">' + V.req.map(function (t) { return '<div class="rep">' + report(c, t) + '</div>'; }).join('') + '</div>' : '') +
      '<div class="dx"><fieldset><legend>Ön tanı</legend>' + c.tani.map(function (t, i) { return '<label><input type="radio" name="tani" value="' + i + '"' + (V.tani === i ? ' checked' : '') + (closed ? ' disabled' : '') + '>' + X(t) + '</label>'; }).join('') + '</fieldset>' +
      '<fieldset><legend>Yönlendirme</legend>' + c.yon.map(function (t, i) { return '<label><input type="radio" name="yon" value="' + i + '"' + (V.yon === i ? ' checked' : '') + (closed ? ' disabled' : '') + '>' + X(t) + '</label>'; }).join('') + '</fieldset></div>' +
      '<div class="vk-act">' + (closed ? '<button type="button" class="btn" id="vk-again">Vakayı yeniden çöz</button>' : '<button type="button" class="btn pri" id="vk-close">Dosyayı kapat</button><span class="sub" style="margin:0">' + V.req.length + ' test istendi</span>') + '</div>' +
      (closed ? caseKarne(c, V.res) : '') + '</div>';
  };
  var caseKarne = function (c, r) {
    var col = r.puan >= 80 ? 'var(--ok)' : r.puan >= 55 ? 'var(--warn)' : 'var(--bad)';
    return '<div class="karne"><div class="stamp" style="color:' + col + '"><b>' + r.puan + '</b><small>PUAN</small></div><h3>Dosya kapandı</h3><ul>' +
      '<li>Ön tanı: ' + (r.taniOk ? '<b style="color:var(--ok)">doğru</b>' : 'doğrusu <b>' + X(c.tani[c.dogru]) + '</b>') + '</li>' +
      '<li>Yönlendirme: ' + (r.yonOk ? '<b style="color:var(--ok)">doğru</b>' : 'doğrusu <b>' + X(c.yon[c.dyon]) + '</b>') + '</li>' +
      (r.missing.length ? '<li>İstemediğin gerekli testler: ' + r.missing.map(function (t) { return X(A.TESTS[t].t); }).join(', ') + '</li>' : '<li>Gerekli testlerin hepsini istedin.</li>') +
      (r.wasted.length ? '<li>Bu vakada gereksizdi: ' + r.wasted.map(function (t) { return X(A.TESTS[t].t); }).join(', ') + '</li>' : '') +
      '</ul><p style="margin:10px 0 0;font-size:14px;line-height:1.55"><b>Öğretici not:</b> ' + X(c.not) + '</p></div>';
  };
  $('#vk-main').addEventListener('click', function (e) {
    var t = e.target.closest('[data-test]'); if (t && !t.disabled) { V.req.push(t.getAttribute('data-test')); saveCase(); paintCase(); bridgeSend(); return; }
    if (e.target.closest('#vk-close')) {
      var c = caseOf(V.id); if (V.tani == null || V.yon == null) { toast('Ön tanı ve yönlendirmeyi seç.'); return; }
      V.res = A.gradeCase(c, V.req, V.tani, V.yon); vdone[c.id] = V.res.puan; ls.set('vakaDone', vdone); saveCase(); paintVList(); paintCase(); bridgeSend(); return;
    }
    if (e.target.closest('#vk-again')) { V.req = []; V.tani = null; V.yon = null; V.res = null; saveCase(); paintCase(); bridgeSend(); }
  });
  $('#vk-main').addEventListener('change', function (e) {
    if (e.target.name === 'tani') V.tani = +e.target.value; if (e.target.name === 'yon') V.yon = +e.target.value; saveCase();
  });

  /* =========================== MedLab köprüsü =========================== */
  /* Anatomi/Fizyo Lab ile aynı protokol (js/acadex-medlab-acadia.js): lab bağlamı ve hazır sorular
     üst sayfaya gider; üst sayfa soru (ask), göster (show) ve spot komutu yollar. */
  var EMB = W.parent !== W && /(?:\?|&)medlab=1(?:&|$)/.test(location.search), ORG = location.origin;
  var post = function (m) { if (!EMB) return; m.src = 'axlab'; m.lab = 'odyoloji'; try { W.parent.postMessage(m, ORG); } catch (e) {} };
  var clip = function (s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  var ctx = function () {
    var o = { type: 'ctx', mode: tab, spot: false, sel: null, chips: [] };
    if (tab === 'kabin' && K.pid) {
      var p = cur();
      o.sel = { key: 'kabin.' + p.id, title: 'Kabin · ' + p.ad + ', ' + p.yas, la: 'Saf ses odyometri', rows: [['Hasta', clip(p.ozet, 200)], ['Kanal', EAR[K.ear] + ' · ' + (K.mode === 'ac' ? 'hava yolu' : 'kemik yolu')], ['Frekans', fq() + ' Hz'], ['Seviye', K.L + ' dB HL'], ['Maske', K.mask ? K.M + ' dB EM (karşı kulak)' : 'kapalı'], ['İşaretlenen', Object.keys(K.marks).length + ' nokta']],
        about: 'öğrenci sanal odyometride ' + p.ad + ' (' + p.yas + ') adlı kurgusal hastanın eşiklerini ölçüyor; şu an ' + EAR[K.ear] + ' kulak, ' + (K.mode === 'ac' ? 'hava' : 'kemik') + ' yolu, ' + fq() + ' Hz. Gerçek eşikleri ve tanıyı söyleme; yöntemi ve kuralları anlat.' };
      o.chips = [['mask', 'Bu noktada maskeleme gerekir mi?'], ['hw', 'Eşiği nasıl bulurum?'], ['plato', 'Plato yöntemi nedir?'], ['yorum', 'Odyogramı nasıl yorumlarım?']];
    } else if (tab === 'kulak' && OL.kulak && OL.kulak.ctx) { var kc = OL.kulak.ctx(); o.sel = kc.sel; o.chips = kc.chips; o.spot = kc.spot; if (kc.spotRes) o.spotRes = kc.spotRes; }
    else if (tab === 'vaka' && V.id) {
      var c = caseOf(V.id);
      o.sel = { key: 'vaka.' + c.id, title: 'Vaka · ' + c.baslik, la: 'Klinik vaka', rows: [['Öykü', clip(c.oyku, 400)], ['İstenen testler', V.req.map(function (t) { return A.TESTS[t].t; }).join(', ') || 'henüz yok']],
        about: 'öğrenci kurgusal bir odyoloji vakası çözüyor: "' + c.baslik + '". Dosyayı kapatmadan kesin tanıyı söyleme; düşünme yolunu ve testlerin ne anlattığını anlat.' };
      o.chips = [['ipucu', 'Hangi testlere bakmalıyım?'], ['timp', 'Timpanogramı nasıl yorumlarım?'], ['abr', 'ABR ve OAE neyi ayırt eder?']];
    }
    return o;
  };
  var bridgeSend = OL.bridgeSend = function () { if (!EMB) return; clearTimeout(bridgeSend.t); bridgeSend.t = setTimeout(function () { post(ctx()); }, 40); };
  var ANS = {
    hw: 'Hughson-Westlake (aşağı 10, yukarı 5): 1000 Hz\'de 30–40 dB ile başla. Hasta yanıt verirse 10 dB in, vermezse 5 dB çık. Çıkışta 3 denemenin en az 2\'sinde yanıt alınan en düşük seviye eşiktir. Sıra genelde 1k → 2k → 3k → 4k → 6k → 8k → 1k (tekrar) → 500 → 250.',
    plato: 'Plato yöntemi: maskeyi öbür kulağın hava eşiğinin 10 dB üstünden başlat. Hasta test tonunu duyarsa maskeyi 5 dB artır; duymazsa test tonunu 5 dB artır. Maske arka arkaya 3 adım (15 dB) arttığı hâlde test kulağı aynı seviyede yanıt veriyorsa platoya ulaştın: o seviye gerçek eşiktir. Maske çok yükselirse test kulağına geçip aşırı maskelemeye yol açar.',
    yorum: 'Önce tip: kemik yolu normal (≤15 dB) ve hava-kemik aralığı ≥15 dB ise iletim; aralık yoksa sensörinöral; kemik yolu da düşük ve aralık varsa mikst. Sonra derece: 500-1000-2000 Hz hava yolu ortalamasını al (SSO) ve Clark ölçeğine bak. En son konfigürasyon: eğrinin şekli (düz, düşen, yükselen, 4 kHz\'de çentik).',
    timp: 'Tip A: normal tepe ve uyum. As: sert sistem, uyum düşük (otoskleroz). Ad: aşırı esnek, uyum yüksek (kemikçik kopukluğu, atrofik zar). B: düz; kulak yolu hacmi normalse orta kulakta sıvı, çok yüksekse perforasyon ya da tüp, çok düşükse buşon. C: tepe belirgin negatif basınçta (östaki disfonksiyonu).',
    abr: 'OAE dış tüy hücrelerini (koklea) yoklar; ABR sinirsel yolu (VIII. sinir ve beyin sapı). OAE var ama ABR yoksa: işitsel nöropati. İkisi de yoksa ve orta kulak normalse: koklear (ya da daha ağır) kayıp. ABR\'de I–V interpik uzaması veya kulaklar arası dalga V farkı: retrokoklear patoloji.'
  };
  var answer = function (kind) {
    if (ANS[kind]) return ANS[kind];
    if (kind === 'mask' && K.pid) {
      var f = fq(), n = A.other(K.ear), a = K.marks[key(K.ear, 'ac', f)], b = K.marks[key(n, 'bc', f)] || K.marks[key(n, 'bc', 1000)], ta = K.marks[key(K.ear, 'bc', f)];
      if (K.mode === 'ac') {
        if (!a) return 'Önce bu noktada maskesiz hava eşiğini bul. Sonra kuralı uygula: test kulağının hava eşiği − 40 dB ≥ öbür kulağın kemik eşiği ise maskele. Öbür kulağın kemik eşiğini henüz ölçmediysen onu da ölç.';
        if (!b) return 'Bu noktada hava eşiğini ' + a.L + ' dB buldun. Karar için ' + EAR[n] + ' kulağın kemik yolu eşiğine ihtiyacın var (en azından 1000 Hz). Onu ölç, sonra ' + a.L + ' − 40 = ' + (a.L - 40) + ' değerini onunla karşılaştır.';
        return a.L + ' − 40 = ' + (a.L - 40) + (a.L - 40 >= b.L ? ' ≥ ' : ' < ') + b.L + ' (' + EAR[n] + ' kemik). ' + (a.L - 40 >= b.L ? 'Maskeleme gerekli: karşı kulağa gürültü ver ve plato yöntemiyle eşiği yeniden bul.' : 'Maskeleme gerekmez; bu eşik güvenilir.');
      }
      if (!a || !ta) return 'Kemik yolunda karar için bu frekansta hem hava hem maskesiz kemik eşiğini ölç. Aralık (hava − kemik) 10 dB\'den büyükse maskele: kemik yolu iki kokleayı birden uyarır.';
      return 'Hava-kemik aralığı ' + (a.L - ta.L) + ' dB. ' + (a.L - ta.L > 10 ? 'Maskeleme gerekli: hangi koklea yanıt veriyor, ancak öbür kulağı maskeleyerek anlarsın.' : 'Maskeleme gerekmez.');
    }
    if (kind === 'ipucu' && V.id) {
      var c = caseOf(V.id), miss = (c.gerekli || []).filter(function (t) { return V.req.indexOf(t) < 0; });
      return miss.length ? 'Öyküye göre şunlara bakmadan karar verme: ' + miss.map(function (t) { return A.TESTS[t].t; }).join(', ') + '. Her testin hangi soruyu cevapladığını düşün: orta kulak mı, koklea mı, sinir yolu mu?' : 'Gerekli testlerin hepsi elinde. Sonuçları birlikte oku: tip, timpanogram ve öyküdeki zaman seyri tanıyı daraltır.';
    }
    if (OL.kulak && OL.kulak.answer) return OL.kulak.answer(kind);
    return null;
  };
  var classify = function (q) {
    q = q.toLocaleLowerCase('tr');
    if (/mask/.test(q)) return /plato/.test(q) ? 'plato' : 'mask';
    if (/plato/.test(q)) return 'plato';
    if (/hughson|westlake|eşi[ğk]i? (nasıl|bul)/.test(q)) return 'hw';
    if (/timpanogram|timpanometri/.test(q)) return 'timp';
    if (/\babr\b|\boae\b|emisyon|beyin sap/.test(q)) return 'abr';
    if (/yorumla|derece|konfig|tip/.test(q) && tab === 'kabin') return 'yorum';
    if (/ipucu|hangi test/.test(q)) return 'ipucu';
    if (OL.kulak && OL.kulak.classify && tab === 'kulak') return OL.kulak.classify(q);
    return null;
  };
  if (EMB) {
    D.documentElement.classList.add('axm-embed');
    W.addEventListener('message', function (e) {
      if (e.origin !== ORG || e.source !== W.parent) return;
      var d = e.data; if (!d || d.src !== 'axhost') return;
      if (d.type === 'hello') { bridgeSend(); return; }
      if (d.type === 'show') { if (OL.kulak && OL.kulak.show) { setTab('kulak'); OL.kulak.show(d.n); } return; }
      if (d.type === 'spot') { setTab('kulak'); if (OL.kulak && OL.kulak.spot) OL.kulak.spot(); return; }
      if (d.type !== 'ask') return;
      var kind = d.kind || classify(String(d.q || ''));
      var text = kind ? answer(kind) : null;
      if (!text) { post({ type: 'reply', id: d.id, miss: true }); return; }
      post({ type: 'ack', id: d.id });
      var rep = { type: 'reply', id: d.id, text: text };
      if (kind === 'yol' && OL.kulak && OL.kulak.tour) { setTab('kulak'); OL.kulak.tour(); }
      post(rep);
    });
  }

  /* ---------------- başlat ---------------- */
  paintPts(); paintDev(); paintAg(); paintRule(); paintVList(); paintCase();
  var last = ls.get('pid', null); if (last && A.P[last]) { K.lv = A.P[last].seviye; pick(last); }
  var t0 = new URLSearchParams(location.search).get('tab') || ls.get('tab', 'kabin');
  if (['kabin', 'kulak', 'vaka'].indexOf(t0) >= 0) setTab(t0);
  bridgeSend();
})();
