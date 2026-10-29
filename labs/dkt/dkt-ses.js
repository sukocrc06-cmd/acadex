/* ==========================================================================
   ACADEX DKT LAB · SES LABORATUVARI (labs/dkt/dkt-ses.js), 29.10.2026
   Mikrofon (ya da tarayıcıda üretilen örnek ses) → canlı spektrogram, dalga,
   perde (F0, otokorelasyon), göreli şiddet (dBFS); görevler: serbest, maksimum
   fonasyon süresi (MPT), s/z oranı; GRBAS öz-derecelendirme (5 sn kayıt).
   Ses cihazdan çıkmaz; hiçbir yere yüklenmez.
   ========================================================================== */
(function () {
  'use strict';
  var DK = window.DK, C = DK.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X, tr = C.tr;
  var AC = window.AudioContext || window.webkitAudioContext;
  var S = { mode: C.ls.get('v.mode', 'serbest'), ac: null, an: null, src: null, stream: null, demo: null, raf: 0, run: false,
    f0: [], db: -100, act: false, actT: 0, lastAct: 0, voiced: 0, task: null, res: C.ls.get('v.res', {}), grb: C.ls.get('v.grb', {}), rec: null, url: null };
  var TH = -48;            /* sesli kabul eşiği (dBFS) */
  var GAP = 350;           /* bu kadar ms sessizlik = ses bitti */

  /* ---------- perde: otokorelasyon ---------- */
  var pitch = function (buf, sr) {
    var n = buf.length, r0 = 0, i, L;
    for (i = 0; i < n; i++) r0 += buf[i] * buf[i];
    if (Math.sqrt(r0 / n) < 0.01) return -1;
    var minL = Math.floor(sr / 650), maxL = Math.min(Math.ceil(sr / 60), Math.floor(n / 2));
    var best = 0, bl = -1, c = new Float32Array(maxL + 2);
    for (L = minL - 1; L <= maxL + 1; L++) { var s = 0; for (i = 0; i < n - L; i++) s += buf[i] * buf[i + L]; c[L - minL + 1] = s; }
    for (L = minL; L <= maxL; L++) { var v = c[L - minL + 1]; if (v > best && v >= c[L - minL] && v >= c[L - minL + 2]) { best = v; bl = L; } }
    if (bl < 0 || best / r0 < 0.5) return -1;
    /* aynı güçteki daha kısa periyodu yeğle (oktav hatasını azalt) */
    for (L = minL; L < bl; L++) { var w = c[L - minL + 1]; if (w > best * 0.9 && w >= c[L - minL] && w >= c[L - minL + 2]) { bl = L; best = w; break; } }
    var x1 = c[bl - minL], x2 = c[bl - minL + 1], x3 = c[bl - minL + 2], aa = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
    var T = aa ? bl - bb / (2 * aa) : bl, f = sr / T;
    return f >= 60 && f <= 650 ? f : -1;
  };

  /* ---------- çizim ---------- */
  var spec = null, wave = null, ptrk = null;
  var col = function (v) { /* 0..255 → koyu laciverten nane-tereyağına */
    var t = v / 255; if (t < 0.25) return 'rgb(' + Math.round(15 + t * 80) + ',' + Math.round(21 + t * 60) + ',' + Math.round(48 + t * 200) + ')';
    if (t < 0.6) { var u = (t - 0.25) / 0.35; return 'rgb(' + Math.round(35 + u * 60) + ',' + Math.round(36 + u * 170) + ',' + Math.round(98 + u * 40) + ')'; }
    var w = (t - 0.6) / 0.4; return 'rgb(' + Math.round(95 + w * 154) + ',' + Math.round(206 + w * 16) + ',' + Math.round(138 - w * 0) + ')';
  };
  var fbuf = null, tbuf = null;
  var drawFrame = function () {
    var an = S.an, sr = S.ac.sampleRate;
    an.getByteFrequencyData(fbuf); an.getFloatTimeDomainData(tbuf);
    /* spektrogram: sola kaydır, sağa yeni sütun */
    var g = spec.getContext('2d'), W = spec.width, H = spec.height;
    g.drawImage(spec, -2, 0); var maxBin = Math.min(fbuf.length, Math.round(5000 / (sr / 2) * fbuf.length));
    for (var y = 0; y < H; y++) { var bin = Math.floor((1 - y / H) * maxBin); g.fillStyle = col(fbuf[bin]); g.fillRect(W - 2, y, 2, 1); }
    /* dalga */
    var w2 = wave.getContext('2d'); w2.clearRect(0, 0, wave.width, wave.height); w2.strokeStyle = '#9FE1CB'; w2.lineWidth = 2; w2.beginPath();
    for (var i = 0; i < tbuf.length; i += 4) { var xx = i / tbuf.length * wave.width, yy = wave.height / 2 + tbuf[i] * wave.height * 0.9; if (i) w2.lineTo(xx, yy); else w2.moveTo(xx, yy); }
    w2.stroke();
    /* şiddet ve perde */
    var rms = 0; for (i = 0; i < tbuf.length; i++) rms += tbuf[i] * tbuf[i]; rms = Math.sqrt(rms / tbuf.length);
    S.db = rms > 0 ? 20 * Math.log10(rms) : -100;
    S.fr = (S.fr || 0) + 1;
    var f = S.db > TH ? (S.fr % 2 ? pitch(tbuf, sr) : (S.f0.length ? S.f0[S.f0.length - 1] : -1)) : -1;
    S.f0.push(f); if (S.f0.length > 300) S.f0.shift();
    /* ses etkinliği */
    var now = performance.now(), act = S.db > TH;
    if (act) { if (!S.act) { S.act = true; S.actT = now; } S.lastAct = now; }
    else if (S.act && now - S.lastAct > GAP) { S.act = false; onSegment((S.lastAct - S.actT) / 1000); }
    paintGauges(f, now);
    drawPitch();
  };
  var drawPitch = function () {
    var g = ptrk.getContext('2d'), W = ptrk.width, H = ptrk.height;
    g.clearRect(0, 0, W, H);
    var y = function (f) { return H - (Math.log(f / 60) / Math.log(500 / 60)) * H; };
    /* norm bantları */
    var bands = [['#5DCAA5', V.F0[0]], ['#F09595', V.F0[1]], ['#FAC775', V.F0[2]]];
    bands.forEach(function (b) { g.fillStyle = b[0]; g.globalAlpha = 0.13; g.fillRect(0, y(b[1][2]), W, y(b[1][1]) - y(b[1][2])); });
    g.globalAlpha = 1; g.fillStyle = '#8D98C4'; g.font = '11px JetBrains Mono, monospace';
    [100, 200, 300, 400].forEach(function (f) { g.fillRect(0, y(f), 6, 1); g.fillText(f + ' Hz', 8, y(f) + 4); });
    g.strokeStyle = '#F9DE8F'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath(); var on = false;
    S.f0.forEach(function (f, i) { var x = i / 300 * W; if (f > 0) { if (on) g.lineTo(x, y(f)); else g.moveTo(x, y(f)); on = true; } else on = false; });
    g.stroke();
  };
  var paintGauges = function (f, now) {
    $('#g-f0').textContent = f > 0 ? Math.round(f) : '—';
    var nm = ''; if (f > 0) V.F0.forEach(function (b) { if (f >= b[1] && f <= b[2]) nm = nm ? nm + ' / ' + b[0].toLocaleLowerCase('tr') : b[0].toLocaleLowerCase('tr'); });
    $('#g-f0n').textContent = f > 0 ? 'Hz' + (nm ? ' · ' + nm + ' aralığı' : '') : 'Hz';
    $('#g-db').textContent = S.db > -99 ? Math.round(S.db) : '—';
    $('#g-dbm').style.width = Math.max(0, Math.min(100, (S.db + 70) / 70 * 100)) + '%';
    var t = S.act ? (now - S.actT) / 1000 : 0; $('#g-t').textContent = tr(t, 1);
    if (S.task && S.task.wait && S.act) paintTimer((now - S.actT) / 1000);
  };

  /* ---------- kaynaklar: mikrofon ya da örnek ses ---------- */
  var ensureAC = function () { if (!S.ac) { S.ac = new AC(); } if (S.ac.state === 'suspended') S.ac.resume(); return S.ac; };
  var connect = function (node) {
    ensureAC();
    if (!S.an) { S.an = S.ac.createAnalyser(); S.an.fftSize = 2048; S.an.smoothingTimeConstant = 0.2; fbuf = new Uint8Array(S.an.frequencyBinCount); tbuf = new Float32Array(S.an.fftSize); }
    if (S.src) try { S.src.disconnect(); } catch (e) {}
    S.src = node; node.connect(S.an);
    if (!S.run) { S.run = true; var loop = function () { if (!S.run) return; drawFrame(); S.raf = requestAnimationFrame(loop); }; loop(); }
    $('#v-stop').disabled = false; $('#v-dot').classList.add('on');
  };
  var micStart = function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !AC) { C.toast('Bu tarayıcı mikrofonu desteklemiyor; örnek sesle deneyebilirsin.'); return Promise.resolve(false); }
    if (S.stream) { connect(S.ac.createMediaStreamSource(S.stream)); return Promise.resolve(true); }
    $('#v-st').textContent = 'izin bekleniyor…';
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (st) {
      S.stream = st; stopDemo(); connect(S.ac ? S.ac.createMediaStreamSource(st) : (ensureAC(), S.ac.createMediaStreamSource(st)));
      $('#v-st').textContent = 'mikrofon açık'; $('#r-rec').disabled = false; return true;
    }, function () {
      $('#v-st').textContent = 'izin verilmedi'; C.toast('Mikrofon izni verilmedi. Tarayıcı ayarlarından açabilir ya da örnek sesle deneyebilirsin.'); return false;
    });
  };
  /* örnek ses: /a/ (testere dişi + iki formant), /s/ (süzülmüş gürültü), /z/ (ikisi birlikte) */
  var stopDemo = function () { if (S.demo) { try { S.demo.stop(); } catch (e) {} S.demo = null; } };
  var demo = function (kind, sec) {
    ensureAC(); stopDemo();
    var ac = S.ac, t0 = ac.currentTime + 0.05, out = ac.createGain(); out.gain.value = 0;
    var parts = [];
    if (kind !== 's') {
      var o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = kind === 'z' ? 125 : 210;
      var lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5; lg.gain.value = 3; lfo.connect(lg); lg.connect(o.frequency);
      var f1 = ac.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = 750; f1.Q.value = 4; f1.gain.value = 18;
      var f2 = ac.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 1200; f2.Q.value = 5; f2.gain.value = 14;
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
      var vg = ac.createGain(); vg.gain.value = kind === 'z' ? 0.25 : 0.35;
      o.connect(f1); f1.connect(f2); f2.connect(lp); lp.connect(vg); vg.connect(out); parts.push(o, lfo);
    }
    if (kind === 's' || kind === 'z') {
      var len = ac.sampleRate * 2, nb = ac.createBuffer(1, len, ac.sampleRate), d = nb.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true;
      var hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 6000; hp.Q.value = 0.7;
      var ng = ac.createGain(); ng.gain.value = kind === 's' ? 0.5 : 0.25;
      ns.connect(hp); hp.connect(ng); ng.connect(out); parts.push(ns);
    }
    out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(1, t0 + 0.08); out.gain.setValueAtTime(1, t0 + sec); out.gain.linearRampToValueAtTime(0, t0 + sec + 0.1);
    parts.forEach(function (p) { p.start(t0); p.stop(t0 + sec + 0.15); });
    S.demo = { stop: function () { parts.forEach(function (p) { try { p.stop(); } catch (e) {} }); } };
    connect(out);
    var mon = ac.createGain(); mon.gain.value = 0.18; out.connect(mon); mon.connect(ac.destination); /* hafifçe duyulsun */
    $('#v-st').textContent = 'örnek ses: /' + (kind === 'a' ? 'a' : kind) + '/';
  };
  var stopAll = function () {
    S.run = false; cancelAnimationFrame(S.raf); stopDemo();
    if (S.stream) { S.stream.getTracks().forEach(function (t) { t.stop(); }); S.stream = null; }
    if (S.src) try { S.src.disconnect(); } catch (e) {}
    S.src = null; S.act = false; $('#v-dot').classList.remove('on'); $('#v-st').textContent = 'kapalı'; $('#v-stop').disabled = true;
  };

  /* ---------- görevler ---------- */
  var MODES = [['serbest', 'Serbest'], ['mpt', 'MPT'], ['sz', 's/z oranı']];
  var ring = function (p) { var L = 2 * Math.PI * 38; return '<svg viewBox="0 0 88 88"><circle class="ring-bg" cx="44" cy="44" r="38"/><circle class="ring-fg" id="tm-r" cx="44" cy="44" r="38" stroke-dasharray="' + L + '" stroke-dashoffset="' + L * (1 - p) + '"/></svg>'; };
  var paintTimer = function (t) { var r = $('#tm-r'), b = $('#tm-b'); if (!r || !b) return; var L = 2 * Math.PI * 38; r.setAttribute('stroke-dashoffset', L * (1 - Math.min(1, t / 25))); b.textContent = tr(t, 1) + ' sn'; };
  var paintTask = function () {
    var h = '', R = S.res;
    if (S.mode === 'serbest') {
      h = '<span class="k">serbest</span><h2>Perde ve şiddet</h2><p class="sub">Uzun bir "aaa" söyle, sonra perdeni yavaşça yükselt ve alçalt (glissando). Sarı çizgi perdeni (F0) gösterir; renkli bantlar tipik konuşma perdesi aralıklarıdır.</p>' +
        '<div class="res">' + V.F0.map(function (b) { return '<div>' + X(b[0]) + '<b>' + b[1] + '–' + b[2] + ' Hz</b></div>'; }).join('') + '<div>Spektrogramda<b style="font-size:13px">yatay çizgiler = harmonikler</b></div></div>';
    } else if (S.mode === 'mpt') {
      h = '<span class="k">maksimum fonasyon süresi</span><h2>Ne kadar uzun "aaa"?</h2><p class="sub">Derin nefes al, rahat bir perde ve şiddette "aaa"yı olabildiğince uzun sürdür. Genellikle üç deneme yapılır, en uzunu alınır.</p>' +
        '<div class="timer">' + ring(0) + '<div><b id="tm-b">0,0 sn</b><div class="sub" id="tm-s" style="margin:4px 0 0">' + (S.task && S.task.wait ? 'Başlayınca süre işler.' : '"Denemeyi başlat"a bas.') + '</div></div></div>' +
        '<div class="row"><button type="button" class="btn sm cor" id="tk-go">Denemeyi başlat</button><button type="button" class="btn sm" id="tk-dm">Örnekle göster</button></div>' +
        '<div class="res">' + ['1', '2', '3'].map(function (k) { var v = (R.mpt || [])[k - 1]; return '<div>' + k + '. deneme<b>' + (v ? tr(v, 1) + ' sn' : '—') + '</b></div>'; }).join('') + '<div>En uzun<b>' + ((R.mpt || []).length ? tr(Math.max.apply(null, R.mpt), 1) + ' sn' : '—') + '</b></div></div>' +
        '<p class="sub" style="margin:0">Yetişkinlerde 15 saniyenin üzeri olağandır; 10 saniyenin altı ses tellerinin kapanmasında ya da solunum desteğinde sorunu düşündürebilir. Çocuklarda yaşa göre daha kısadır.</p>';
    } else {
      var s = R.s, z = R.z, ratio = s && z ? s / z : null;
      h = '<span class="k">s/z oranı</span><h2>"sss" ve "zzz"</h2><p class="sub">Önce "sss", sonra "zzz" sesini olabildiğince uzun sürdür. /s/ ötümsüzdür (yalnızca hava), /z/ ötümlüdür (ses telleri titrer). Eckel ve Boone, 1981.</p>' +
        '<div class="timer">' + ring(0) + '<div><b id="tm-b">0,0 sn</b><div class="sub" id="tm-s" style="margin:4px 0 0">' + (S.task && S.task.wait ? 'Şimdi: /' + S.task.k + '/' : 'Önce /s/, sonra /z/.') + '</div></div></div>' +
        '<div class="row"><button type="button" class="btn sm cor" id="tk-s">/s/ ölç</button><button type="button" class="btn sm cor" id="tk-z">/z/ ölç</button><button type="button" class="btn sm" id="tk-dm">Örnekle göster</button></div>' +
        '<div class="res"><div>/s/<b>' + (s ? tr(s, 1) + ' sn' : '—') + '</b></div><div>/z/<b>' + (z ? tr(z, 1) + ' sn' : '—') + '</b></div><div style="grid-column:1/-1">s/z oranı<b>' + (ratio ? tr(ratio, 2) : '—') + '</b>' +
        (ratio ? '<span class="pill ' + (ratio > 1.4 ? 'bad' : 'ok') + '" style="margin-top:4px">' + (ratio > 1.4 ? '1,4 üstü: ses tellerinde kapanma sorunu düşündürebilir' : 'olağan aralıkta (≈1)') + '</span>' : '') + '</div></div>' +
        '<p class="sub" style="margin:0">Oran yaklaşık 1\'dir. /z/ belirgin kısalırsa (oran 1,4\'ün üstü) ses tellerinde nodül gibi kitle ya da kapanma eksikliği düşünülür; /s/ de kısaysa sorun solunum desteğindedir.</p>';
    }
    $('#v-task').innerHTML = h;
  };
  var startTask = function (k, useDemo) {
    S.task = { k: k, wait: true };
    S.act = false;
    if (useDemo) { demo(k === 'mpt' ? 'a' : k, k === 'mpt' ? 7 : k === 's' ? 4 : 3); }
    else if (!S.stream) { micStart().then(function (ok) { if (!ok) S.task = null; paintTask(); }); }
    paintTask();
  };
  var onSegment = function (sec) {
    if (!S.task || !S.task.wait || sec < 0.6) return;
    var k = S.task.k; S.task = null;
    if (k === 'mpt') { S.res.mpt = (S.res.mpt || []).concat([sec]).slice(-3); }
    else S.res[k] = sec;
    C.ls.set('v.res', S.res); paintTask(); C.toast('Ölçüldü: ' + tr(sec, 1) + ' sn'); DK.bridgeSend();
  };

  /* ---------- GRBAS ---------- */
  var paintGrb = function () {
    $('#grb').innerHTML = V.GRBAS.map(function (g) {
      return '<div class="grb-r"><b>' + g[0] + '</b><span>' + X(g[1]) + '<small>' + X(g[2]) + '</small></span><div class="seg" role="group" aria-label="' + X(g[1]) + '">' + [0, 1, 2, 3].map(function (n) { return '<button type="button" data-g="' + g[0] + '" data-n="' + n + '" aria-pressed="' + (S.grb[g[0]] === n) + '">' + n + '</button>'; }).join('') + '</div></div>';
    }).join('');
    var all = V.GRBAS.every(function (g) { return S.grb[g[0]] != null; });
    $('#grb-s').textContent = all ? 'Senin derecelendirmen: ' + V.GRBAS.map(function (g) { return g[0] + S.grb[g[0]]; }).join(' ') + '. Kaydı birkaç gün sonra tekrar dinleyip derecelendirmen ne kadar tutarlı, karşılaştır.' : 'Derece: 0 normal, 1 hafif, 2 orta, 3 ağır.';
  };
  var record = function () {
    var go = function () {
      if (!window.MediaRecorder || !S.stream) { C.toast('Bu tarayıcıda kayıt desteklenmiyor.'); return; }
      var ch = [], mr; try { mr = new MediaRecorder(S.stream); } catch (e) { C.toast('Kayıt başlatılamadı.'); return; }
      mr.ondataavailable = function (e) { if (e.data && e.data.size) ch.push(e.data); };
      mr.onstop = function () { if (S.url) URL.revokeObjectURL(S.url); S.url = URL.createObjectURL(new Blob(ch, { type: mr.mimeType || 'audio/webm' })); $('#r-play').disabled = false; $('#r-st').textContent = 'kayıt hazır (yalnızca bu sekmede)'; $('#r-rec').disabled = false; };
      mr.start(); $('#r-rec').disabled = true; var n = 5; $('#r-st').textContent = 'kaydediliyor… ' + n;
      var iv = setInterval(function () { n--; if (n <= 0) { clearInterval(iv); try { mr.stop(); } catch (e) {} } else $('#r-st').textContent = 'kaydediliyor… ' + n; }, 1000);
    };
    if (S.stream) go(); else micStart().then(function (ok) { if (ok) go(); });
  };

  DK.st.ses = {
    init: function () {
      spec = $('#v-spec'); wave = $('#v-wave'); ptrk = $('#v-ptrk');
      var g = spec.getContext('2d'); g.fillStyle = '#0F1530'; g.fillRect(0, 0, spec.width, spec.height);
      $('#v-mode').innerHTML = MODES.map(function (m) { return '<button type="button" data-m="' + m[0] + '" aria-pressed="' + (m[0] === S.mode) + '" style="color:#C9D2F5">' + m[1] + '</button>'; }).join('');
      $('#v-mode').addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (!b) return; S.mode = b.getAttribute('data-m'); S.task = null; C.ls.set('v.mode', S.mode); $$('#v-mode [data-m]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); x.style.color = x === b ? '' : '#C9D2F5'; }); paintTask(); DK.bridgeSend(); });
      $$('#v-mode [data-m]').forEach(function (x) { if (x.getAttribute('aria-pressed') === 'true') x.style.color = ''; });
      $('#v-mic').addEventListener('click', function () { micStart(); });
      $('#v-demo').addEventListener('click', function () { demo('a', 6); });
      $('#v-stop').addEventListener('click', stopAll);
      $('#v-task').addEventListener('click', function (e) {
        var t = e.target;
        if (t.closest('#tk-go')) startTask('mpt', false);
        else if (t.closest('#tk-s')) startTask('s', false);
        else if (t.closest('#tk-z')) startTask('z', false);
        else if (t.closest('#tk-dm')) { if (S.mode === 'mpt') startTask('mpt', true); else { startTask('s', true); setTimeout(function () { if (!S.run) return; startTask('z', true); }, 5200); } }
      });
      $('#grb').addEventListener('click', function (e) { var b = e.target.closest('[data-g]'); if (!b) return; S.grb[b.getAttribute('data-g')] = +b.getAttribute('data-n'); C.ls.set('v.grb', S.grb); paintGrb(); DK.bridgeSend(); });
      $('#r-rec').addEventListener('click', record);
      $('#r-play').addEventListener('click', function () { if (S.url) { var a = new Audio(S.url); a.play(); } });
      paintTask(); paintGrb(); drawPitch();
    },
    hide: function () { if (S.run) stopAll(); },
    ctx: function () {
      var R = S.res, f = S.f0.filter(function (x) { return x > 0; }), mf = f.length ? f.reduce(function (a, b) { return a + b; }, 0) / f.length : null;
      var rows = [['Görev', MODES.filter(function (m) { return m[0] === S.mode; })[0][1]]];
      if (mf) rows.push(['Son ortalama F0', Math.round(mf) + ' Hz']);
      if ((R.mpt || []).length) rows.push(['MPT en uzun', tr(Math.max.apply(null, R.mpt), 1) + ' sn']);
      if (R.s && R.z) rows.push(['s/z', tr(R.s, 1) + ' / ' + tr(R.z, 1) + ' sn = ' + tr(R.s / R.z, 2)]);
      if (Object.keys(S.grb).length) rows.push(['GRBAS (öz)', V.GRBAS.map(function (g) { return g[0] + (S.grb[g[0]] != null ? S.grb[g[0]] : '?'); }).join(' ')]);
      return { sel: { key: 'dkt.voice.' + S.mode, title: 'Ses laboratuvarı', la: 'Ses', rows: rows, about: 'öğrenci DKT Lab ses laboratuvarında kendi sesini (kalibre olmayan mikrofonla) ölçüyor; tanı koyma, ölçümlerin anlamını ve sınırlılığını açıkla.' },
        chips: [['sz', 's/z oranı neyi gösterir?'], ['mpt', 'MPT neden kısa çıkar?'], ['grbas', 'GRBAS nasıl puanlanır?']] };
    },
    classify: function (q) { if (/s\/z|s-z/.test(q)) return 'sz'; if (/mpt|fonasyon/.test(q)) return 'mpt'; if (/grbas/.test(q)) return 'grbas'; return null; },
    answer: function (k) {
      var R = S.res;
      if (k === 'sz') return 's/z oranı /s/ süresinin /z/ süresine bölümüdür; olağanda yaklaşık 1\'dir. /z/ ses telleri titreşimi ister: tellerde nodül, polip ya da kapanma eksikliği varsa hava kaçar ve /z/ kısalır, oran 1,4\'ü aşar. /s/ de kısaysa sorun daha çok solunum desteğindedir.' + (R.s && R.z ? ' Senin ölçümün: ' + tr(R.s / R.z, 2) + '.' : '');
      if (k === 'mpt') return 'Maksimum fonasyon süresi solunum desteği ile ses tellerinin kapanma verimini birlikte yansıtır. Kapanma eksik (nodül, felç, presbifoni) ya da solunum kapasitesi düşükse kısalır; yetişkinde 10 sn altı dikkat çeker. Deneme sayısı, yönerge ve motivasyon sonucu çok etkiler; en az üç deneme alınır.' + ((R.mpt || []).length ? ' Senin en uzun denemen: ' + tr(Math.max.apply(null, R.mpt), 1) + ' sn.' : '');
      if (k === 'grbas') return 'GRBAS beş ölçütü (G genel bozukluk, R pürüzlülük, B nefeslilik, A güçsüzlük, S zorlanma) 0–3 arasında puanlar: 0 normal, 1 hafif, 2 orta, 3 ağır. Genellikle sürdürülmüş ünlü ve okuma parçası dinlenerek yapılır; güvenilirlik için birden çok dinleyici ve referans kayıtlarla eğitim önerilir.';
      return null;
    }
  };
})();
