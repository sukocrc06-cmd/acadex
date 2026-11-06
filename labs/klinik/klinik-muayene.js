/* ==========================================================================
   ACADEX KLİNİK · dokunarak fizik muayene (labs/klinik/klinik-muayene.js), 06.11.2026
   Muayene odasında "Elle muayene" açılır: hastanın gövde çiziminde steteskobu gezdirirsin,
   kalp odakları (aort, pulmoner, triküspit, mitral), akciğer zonları ve karın dinlenir;
   palpasyonda karın kadranlarına bastırırsın. Sesler tarayıcıda Web Audio ile üretilir
   (kayıt dosyası yok): S1–S2 hastanın anlık nabzıyla, solunum sesi anlık solunum sayısıyla atar;
   üfürüm, düzensiz ritim, wheezing, ral, azalmış ses ve barsak sesleri bulguya göre çalınır.
   Bulgular labs/klinik/klinik-fizyoloji.js (AXFIZ.bulgular / dinle / palpe) içinden gelir.
   Klavyeyle: bölge düğmeleri. Hareket azaltmada görsel efektler durur, ses çalışır.
   Kullanım: AXMUAYENE.ac(sahneKutusu, { bulgu, hr(), rr(), ritim(), onDinle(z, r), onPalpe(z, r), onKapat() })
   ========================================================================== */
(function () {
  'use strict';
  if (window.AXMUAYENE) return;
  var W = window, D = document, F = W.AXFIZ;
  var RM = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* bölgeler: hastanın sağı çizimde solda (karşıdan bakış) */
  var Z = [
    ['aort', 134, 132, 'kalp'], ['pulmoner', 166, 132, 'kalp'], ['trikuspit', 147, 184, 'kalp'], ['mitral', 190, 196, 'kalp'],
    ['akc-sag-ust', 100, 128, 'akc'], ['akc-sol-ust', 202, 128, 'akc'], ['akc-sag-alt', 96, 212, 'akc'], ['akc-sol-alt', 206, 222, 'akc'],
    ['epigastrium', 150, 252, 'karin'], ['sag-ust', 110, 272, 'karin'], ['sol-ust', 190, 272, 'karin'], ['sag-alt', 114, 334, 'karin'], ['sol-alt', 186, 334, 'karin']
  ];
  var CSS = [
    '.axm2{position:absolute;inset:0;z-index:6;display:flex;align-items:stretch;justify-content:center;background:rgba(13,24,56,.55);backdrop-filter:blur(2px);animation:axm2-in .3s ease both}',
    '@keyframes axm2-in{from{opacity:0}}',
    '.axm2-k{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,300px);align-content:start;gap:14px;width:min(860px,100%);margin:10px;padding:14px;border-radius:18px;background:#FFFDF8;border:2px solid #0D1838;box-shadow:0 24px 50px -24px rgba(0,0,0,.6);overflow:auto}',
    '.axm2-h{grid-column:1/-1;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '.axm2-h b{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:18px}.axm2-h small{color:#6A7593;font-size:12.5px}',
    '.axm2-h .sp{flex:1}',
    '.axm2-mod{display:inline-flex;gap:2px;padding:3px;border-radius:999px;background:#EEF1F6}',
    '.axm2-mod button,.axm2-x{min-height:36px;padding:0 14px;border:0;border-radius:999px;background:none;font:700 13px "Instrument Sans",system-ui,sans-serif;color:#46506A;cursor:pointer}',
    '.axm2-mod button[aria-pressed="true"]{background:#0D1838;color:#fff}',
    '.axm2-x{border:1.5px solid #0D1838;color:#0D1838;background:#fff}',
    '.axm2-g{position:relative;background:linear-gradient(180deg,#EAF3F8,#DCE8F0);border-radius:14px;min-height:300px;touch-action:none}',
    '.axm2-g svg{display:block;width:100%;height:100%;max-height:62vh}',
    '.axm2-g.st svg{cursor:none}.axm2-g.pa svg{cursor:pointer}',
    '.axm2-z{fill:rgba(255,255,255,.18);stroke:#FFFFFF;stroke-width:2;stroke-dasharray:3 4;opacity:0;transition:opacity .2s,fill .2s}.axm2-g.st .axm2-z.k-kalp,.axm2-g.st .axm2-z.k-akc,.axm2-g.st .axm2-z.k-karin,.axm2-g.pa .axm2-z.k-karin{opacity:.75}',
    '.axm2-z.on{opacity:1!important;fill:rgba(232,181,58,.45);stroke:#B9821F;stroke-dasharray:none}.axm2-z.dun{fill:rgba(46,156,134,.28);stroke-dasharray:none}',
    '.axm2-st{pointer-events:none;transition:opacity .15s}',
    '.axm2-dalga{fill:none;stroke:#2E9C86;stroke-width:2;opacity:0}.axm2-dalga.on{animation:axm2-d .9s ease-out}',
    '@keyframes axm2-d{0%{opacity:.8;r:6}100%{opacity:0;r:34}}',
    '.axm2-i{display:flex;flex-direction:column;gap:10px;font-family:"Instrument Sans",system-ui,sans-serif;color:#0D1838}',
    '.axm2-bul{min-height:84px;padding:12px;border-radius:12px;background:#F3F7F9;font-size:14.5px;line-height:1.45}',
    '.axm2-bul b{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6A7593;margin-bottom:4px}',
    '.axm2-ses{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#46506A}.axm2-ses i{display:inline-flex;gap:2px;align-items:flex-end;height:16px}',
    '.axm2-ses i span{width:3px;background:#2E9C86;border-radius:2px;height:4px}.axm2-ses.on i span{animation:axm2-eq .6s ease-in-out infinite alternate}.axm2-ses.on i span:nth-child(2){animation-delay:-.2s}.axm2-ses.on i span:nth-child(3){animation-delay:-.4s}',
    '@keyframes axm2-eq{to{height:16px}}',
    '.axm2-lst{display:flex;flex-wrap:wrap;gap:6px}.axm2-lst button{min-height:32px;padding:0 10px;border:1.5px solid #CDD6E2;border-radius:999px;background:#fff;font:600 12.5px "Instrument Sans",system-ui,sans-serif;color:#0D1838;cursor:pointer}',
    '.axm2-lst button.dun{border-color:#2E9C86;background:#E2F4EF}.axm2-lst button:focus-visible{outline:3px solid #2F6BFF;outline-offset:2px}',
    '.axm2-not{font-size:12px;color:#6A7593;margin:0}',
    '.axm2-yuz{display:flex;align-items:center;gap:10px;font-size:12.5px;color:#46506A}.axm2-yuz svg{width:58px;height:58px;flex:none}',
    '.axm2-yuz [data-y="agri"]{display:none}.axm2-yuz.agri [data-y="agri"]{display:inline}.axm2-yuz.agri [data-y="normal"]{display:none}.axm2-yuz.agri svg{animation:axm2-ir .35s ease 2}',
    '@keyframes axm2-ir{50%{transform:translateX(-3px) rotate(-4deg)}}',
    '@media (max-width:700px){.axm2-k{grid-template-columns:1fr;margin:6px;padding:10px}.axm2-g svg{max-height:44vh}}',
    '@media (prefers-reduced-motion:reduce){.axm2,.axm2 *{animation:none!important;transition:none!important}}'
  ].join('\n');

  /* ---------------- ses motoru ---------------- */
  var A = null;
  var ses = function () {
    if (A) return A;
    var C = W.AudioContext || W.webkitAudioContext; if (!C) return null;
    var c = new C(), master = c.createGain(); master.gain.value = 0.9; master.connect(c.destination);
    var buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A = { c: c, m: master, nb: buf };
    return A;
  };
  var gurultu = function (t, sure, filtre, kazanc, atak) {
    var c = A.c, s = c.createBufferSource(); s.buffer = A.nb; s.loop = true;
    var g = c.createGain(), son = s; g.gain.setValueAtTime(0.0001, t);
    filtre.forEach(function (f) { var b = c.createBiquadFilter(); b.type = f[0]; b.frequency.value = f[1]; if (f[2]) b.Q.value = f[2]; son.connect(b); son = b; });
    son.connect(g); g.connect(A.m);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, kazanc), t + (atak || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    s.start(t, Math.random()); s.stop(t + sure + 0.05);
    return g;
  };
  var vurus = function (t, frek, kazanc, sure) {
    var c = A.c, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(frek, t); o.frequency.exponentialRampToValueAtTime(frek * 0.6, t + sure);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(kazanc, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(g); g.connect(A.m); o.start(t); o.stop(t + sure + 0.02);
    gurultu(t, sure * 0.8, [['lowpass', frek * 2.2]], kazanc * 0.7);
  };
  /* döngü: 60 ms'de bir ileriye olay yerleştirir */
  var Dongu = function (o) {
    var self = { aktif: null, t: { kalp: 0, nefes: 0, barsak: 0 }, iv: null };
    self.cal = function (r) {
      if (!ses()) return; if (A.c.state === 'suspended') A.c.resume();
      if (!self.aktif || self.aktif.ses !== r.ses || self.aktif.z !== r.z) { var now = A.c.currentTime + 0.05; self.t = { kalp: now, nefes: now, barsak: now + 0.6 }; }
      self.aktif = r;
      if (!self.iv) self.iv = setInterval(self.planla, 60);
    };
    self.dur = function () { self.aktif = null; clearInterval(self.iv); self.iv = null; };
    self.planla = function () {
      var r = self.aktif; if (!r || !A) return;
      var ufuk = A.c.currentTime + 0.25;
      if (r.ses === 'kalp') {
        while (self.t.kalp < ufuk) {
          var hr = Math.max(35, o.hr() || 80), per = 60 / hr; if (r.tip === 'duzensiz') per *= 0.6 + Math.random() * 0.8;
          var t = self.t.kalp, s2 = t + Math.min(0.34, per * 0.36), ust = /aort|pulmoner/.test(r.z);
          vurus(t, 62, ust ? 0.45 : 0.9, 0.11); vurus(s2, 86, ust ? 0.8 : 0.45, 0.09);
          if (r.ufurum) { var g = gurultu(t + 0.05, (s2 - t) - 0.08, [['bandpass', 360, 1.3], ['lowpass', 900]], 0.32 * r.ufurum, (s2 - t) * 0.45); }
          self.t.kalp = t + per;
        }
      } else if (r.ses === 'akciger') {
        while (self.t.nefes < ufuk) {
          var rr = Math.max(8, o.rr() || 16), cyc = 60 / rr, ins = cyc * 0.38, t0 = self.t.nefes, k = r.tip === 'azalmis' ? 0.12 : 0.5;
          gurultu(t0, ins, [['bandpass', 480, 0.7], ['lowpass', 1100]], k, ins * 0.7);
          gurultu(t0 + ins, cyc * 0.5, [['bandpass', 380, 0.7], ['lowpass', 800]], k * (r.tip === 'wheezing' ? 0.35 : 0.3), cyc * 0.1);
          if (r.tip === 'wheezing') { var c = A.c, os = c.createOscillator(), og = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(); os.type = 'triangle'; os.frequency.value = 410; lfo.frequency.value = 7; lg.gain.value = 18; lfo.connect(lg); lg.connect(os.frequency); og.gain.setValueAtTime(0.0001, t0 + ins); og.gain.exponentialRampToValueAtTime(0.07, t0 + ins + 0.15); og.gain.exponentialRampToValueAtTime(0.0001, t0 + ins + cyc * 0.55); os.connect(og); og.connect(A.m); os.start(t0 + ins); lfo.start(t0 + ins); os.stop(t0 + ins + cyc * 0.6); lfo.stop(t0 + ins + cyc * 0.6); }
          if (r.tip === 'ral') for (var q = 0; q < 9; q++) gurultu(t0 + ins * (0.55 + Math.random() * 0.45), 0.012, [['highpass', 900]], 0.5);
          self.t.nefes = t0 + cyc;
        }
      } else if (r.ses === 'karin') {
        while (self.t.barsak < ufuk) {
          var tb = self.t.barsak, ara = r.tip === 'azalmis' ? 6 + Math.random() * 6 : r.tip === 'artmis' ? 0.5 + Math.random() * 1 : 1.6 + Math.random() * 2.8;
          var cc = A.c, sb = cc.createBufferSource(), bp = cc.createBiquadFilter(), gb = cc.createGain(); sb.buffer = A.nb; bp.type = 'bandpass'; bp.Q.value = 6;
          bp.frequency.setValueAtTime(180 + Math.random() * 120, tb); bp.frequency.exponentialRampToValueAtTime(520 + Math.random() * 300, tb + 0.35);
          gb.gain.setValueAtTime(0.0001, tb); gb.gain.exponentialRampToValueAtTime(0.5, tb + 0.05); gb.gain.exponentialRampToValueAtTime(0.0001, tb + 0.4);
          sb.connect(bp); bp.connect(gb); gb.connect(A.m); sb.start(tb, Math.random()); sb.stop(tb + 0.45);
          self.t.barsak = tb + ara;
        }
      }
    };
    return self;
  };

  /* ---------------- gövde çizimi ---------------- */
  var govde = function (ten) {
    return '<svg viewBox="0 0 300 400" role="img" aria-label="Hastanın gövdesi, önden görünüm">' +
      '<path d="M120 70 h60 v20 c34 4 64 14 76 34 c10 18 12 60 12 100 v40 h-30 l-6 -70 l-4 150 h-180 l-4 -150 l-6 70 h-30 v-40 c0 -40 2 -82 12 -100 c12 -20 42 -30 76 -34z" fill="' + ten + '" stroke="#C99A7C" stroke-width="2"/>' +
      '<ellipse cx="150" cy="40" rx="30" ry="34" fill="' + ten + '" stroke="#C99A7C" stroke-width="2"/>' +
      '<g fill="none" stroke="#C99A7C" stroke-width="1.6" opacity=".55"><path d="M150 96 v130"/><path d="M90 120 q60 18 120 0 M84 150 q66 20 132 0 M82 180 q68 22 136 0 M86 210 q64 22 128 0"/></g>' +
      '<g fill="none" stroke="#9AA6B8" stroke-width="1.4" stroke-dasharray="4 5" opacity=".7"><path d="M150 236 v130 M86 300 h128"/></g><circle cx="150" cy="300" r="3.5" fill="#C99A7C"/>' +
      '<text x="58" y="390" font-family="JetBrains Mono,monospace" font-size="10" fill="#6A7593">hastanın sağı</text><text x="242" y="390" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="10" fill="#6A7593">solu</text>' +
      Z.map(function (z) { return '<circle class="axm2-z k-' + z[3] + '" data-z="' + z[0] + '" cx="' + z[1] + '" cy="' + z[2] + '" r="12"/>'; }).join('') +
      '<circle class="axm2-dalga" cx="0" cy="0" r="6"/>' +
      '<g class="axm2-st" opacity="0"><path d="M0 0 C-30 -40 -60 -60 -70 -120" stroke="#0D1838" stroke-width="4" fill="none"/><circle r="15" fill="#C9D1DC" stroke="#0D1838" stroke-width="3.5"/><circle r="9" fill="#E8EDF3"/></g>' +
      '</svg>';
  };

  var ac = function (host, o) {
    F = F || W.AXFIZ;
    if (!F || !host) return null;
    if (!D.getElementById('axm2-css')) { var st = D.createElement('style'); st.id = 'axm2-css'; st.textContent = CSS; D.head.appendChild(st); }
    var b = o.bulgu || F.bulgular({}), mod = 'st', dun = {}, sesAcik = true;
    var el = D.createElement('div'); el.className = 'axm2'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Elle fizik muayene');
    el.innerHTML = '<div class="axm2-k"><div class="axm2-h"><b>Elle muayene</b><small>Kulaklık takarsan sesleri daha iyi ayırırsın.</small><span class="sp"></span>' +
      '<div class="axm2-mod" role="group" aria-label="Muayene yöntemi"><button type="button" data-m="st" aria-pressed="true">Steteskop</button><button type="button" data-m="pa" aria-pressed="false">Palpasyon</button></div>' +
      '<button type="button" class="axm2-x" data-k="ses" aria-pressed="true">Ses açık</button><button type="button" class="axm2-x" data-k="kapat">Bitir</button></div>' +
      '<div class="axm2-g st">' + govde(o.ten || '#F1D3BC') + '</div>' +
      '<div class="axm2-i"><div class="axm2-yuz"><svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="24" fill="' + (o.ten || '#F1D3BC') + '" stroke="#0D1838" stroke-width="2.5"/><g data-y="normal"><circle cx="22" cy="27" r="2.6" fill="#0D1838"/><circle cx="38" cy="27" r="2.6" fill="#0D1838"/><path d="M22 39 q8 4 16 0" stroke="#7A2E22" stroke-width="2.4" fill="none" stroke-linecap="round"/></g><g data-y="agri"><path d="M18 24 l7 4 M42 24 l-7 4 M18 30 l7 -1 M42 30 l-7 -1" stroke="#0D1838" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="30" cy="41" rx="6" ry="4.5" fill="#7A2E22"/><path d="M47 16 q3 5 0 8 q-3 -3 0 -8z" fill="#7CC4F0"/></g></svg><span data-yuzt>Hastanın yüzünü izle: ağrı varsa buruşturur.</span></div><div class="axm2-bul" aria-live="polite"><b>bulgu</b>Steteskobu gövdede gezdir: kalp odakları, akciğer zonları ve karın.</div>' +
      '<div class="axm2-ses"><i aria-hidden="true"><span></span><span></span><span></span></i><span data-ses>sessiz</span></div>' +
      '<div class="axm2-lst" data-lst></div><p class="axm2-not">Dinlediğin ve bastırdığın her bölge hasta dosyasına yazılır. Sesler eğitim amaçlı sentezdir.</p></div></div>';
    host.appendChild(el);
    var g = el.querySelector('.axm2-g'), svg = g.querySelector('svg'), stH = svg.querySelector('.axm2-st'), dalga = svg.querySelector('.axm2-dalga');
    var bul = el.querySelector('.axm2-bul'), sesEl = el.querySelector('.axm2-ses'), lst = el.querySelector('[data-lst]');
    var L = Dongu({ hr: o.hr || function () { return 80; }, rr: o.rr || function () { return 16; } }), aktif = null, sayac = null;
    var listeCiz = function () {
      lst.innerHTML = Z.filter(function (z) { return mod === 'st' || z[3] === 'karin'; }).map(function (z) { return '<button type="button" data-zb="' + z[0] + '" class="' + (dun[mod + z[0]] ? 'dun' : '') + '">' + X(F.BOLGE[z[0]]) + '</button>'; }).join('');
    };
    var yaz = function (bas, t) { bul.innerHTML = '<b>' + X(bas) + '</b>' + X(t); };
    var sesYaz = function (on, t) { sesEl.classList.toggle('on', !!on); sesEl.querySelector('[data-ses]').textContent = t; };
    var sec = function (z) {
      Array.prototype.forEach.call(svg.querySelectorAll('.axm2-z'), function (c) { c.classList.toggle('on', c.getAttribute('data-z') === z); });
      if (mod === 'st') {
        if (aktif === z) return; aktif = z; clearTimeout(sayac);
        if (!z) { L.dur(); sesYaz(false, 'sessiz'); return; }
        var r = F.dinle(b, z); r.z = z; if (sesAcik) L.cal(r);
        sesYaz(sesAcik, sesAcik ? (r.ses === 'kalp' ? 'kalp sesleri · ' + Math.round(o.hr ? o.hr() : 80) + '/dk' : r.ses === 'akciger' ? 'solunum sesleri · ' + Math.round(o.rr ? o.rr() : 16) + '/dk' : 'barsak sesleri') : 'ses kapalı');
        yaz(F.BOLGE[z], r.metin);
        /* 1,2 sn dinleyince bulgu dosyaya düşer (bir kez) */
        sayac = setTimeout(function () { if (!dun['st' + z]) { dun['st' + z] = 1; var c = svg.querySelector('[data-z="' + z + '"]'); if (c) c.classList.add('dun'); listeCiz(); if (o.onDinle) o.onDinle(z, r); } }, 1200);
      }
    };
    var palpe = function (z, x, y) {
      var r = F.palpe(b, z);
      if (!RM && dalga) { dalga.setAttribute('cx', x); dalga.setAttribute('cy', y); dalga.classList.remove('on'); void dalga.getBoundingClientRect(); dalga.classList.add('on'); }
      yaz(F.BOLGE[z] || 'Palpasyon', r.metin);
      var yz = el.querySelector('.axm2-yuz'); clearTimeout(palpe.t); yz.classList.toggle('agri', !!r.agri); yz.querySelector('[data-yuzt]').textContent = r.agri ? '“Ah! Orası çok acıyor.”' : 'Hasta rahat.'; if (r.agri) palpe.t = setTimeout(function () { yz.classList.remove('agri'); }, 2600);
      if (!dun['pa' + z]) { dun['pa' + z] = 1; listeCiz(); }
      if (o.onPalpe) o.onPalpe(z, r);
    };
    var yakin = function (e, esik) {
      var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; var m = svg.getScreenCTM(); if (!m) return null; p = p.matrixTransform(m.inverse());
      var en = null, ed = esik || 30;
      Z.forEach(function (z) { if (mod === 'pa' && z[3] !== 'karin') return; var dx = z[1] - p.x, dy = z[2] - p.y, d = Math.sqrt(dx * dx + dy * dy); if (d < ed) { ed = d; en = z; } });
      return { z: en, x: p.x, y: p.y };
    };
    svg.addEventListener('pointermove', function (e) {
      if (mod !== 'st') return; var r = yakin(e, 30); if (!r) return;
      stH.setAttribute('transform', 'translate(' + r.x.toFixed(1) + ' ' + r.y.toFixed(1) + ')'); stH.setAttribute('opacity', '1');
      sec(r.z ? r.z[0] : null);
    });
    svg.addEventListener('pointerleave', function () { if (mod === 'st') { stH.setAttribute('opacity', '0'); sec(null); } });
    svg.addEventListener('pointerdown', function (e) {
      var r = yakin(e, mod === 'pa' ? 34 : 30); if (!r) return;
      if (mod === 'pa') { if (r.z) palpe(r.z[0], r.z[1], r.z[2]); else yaz('Palpasyon', 'Karın kadranlarından birine bastır.'); return; }
      stH.setAttribute('transform', 'translate(' + r.x.toFixed(1) + ' ' + r.y.toFixed(1) + ')'); stH.setAttribute('opacity', '1'); sec(r.z ? r.z[0] : null);
    });
    el.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-m]'))) {
        mod = t.getAttribute('data-m'); g.className = 'axm2-g ' + mod; sec(null); aktif = null; stH.setAttribute('opacity', '0');
        Array.prototype.forEach.call(el.querySelectorAll('[data-m]'), function (x) { x.setAttribute('aria-pressed', String(x === t)); });
        yaz('bulgu', mod === 'st' ? 'Steteskobu gövdede gezdir: kalp odakları, akciğer zonları ve karın.' : 'Karın kadranlarına bastır; hastanın yüzünü izle.'); listeCiz(); return;
      }
      if ((t = e.target.closest('[data-zb]'))) {
        var z = t.getAttribute('data-zb'), zz = Z.filter(function (q) { return q[0] === z; })[0];
        if (mod === 'pa') palpe(z, zz[1], zz[2]); else { stH.setAttribute('transform', 'translate(' + zz[1] + ' ' + zz[2] + ')'); stH.setAttribute('opacity', '1'); aktif = null; sec(z); }
        return;
      }
      if ((t = e.target.closest('[data-k="ses"]'))) { sesAcik = !sesAcik; t.setAttribute('aria-pressed', String(sesAcik)); t.textContent = sesAcik ? 'Ses açık' : 'Ses kapalı'; var a = aktif; aktif = null; L.dur(); if (a) sec(a); else sesYaz(false, sesAcik ? 'sessiz' : 'ses kapalı'); return; }
      if (e.target.closest('[data-k="kapat"]')) kapat();
    });
    var kapat = function () { L.dur(); clearTimeout(sayac); if (el.parentNode) el.parentNode.removeChild(el); if (o.onKapat) o.onKapat(); };
    listeCiz();
    setTimeout(function () { var f = el.querySelector('[data-m="st"]'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }, 40);
    return { kapat: kapat, el: el };
  };
  W.AXMUAYENE = { ac: ac, BOLGELER: Z };
})();
