/* ==========================================================================
   ACADEX ODYOLOJİ LAB · konuşma odyometrisi ve immitansmetri (labs/odyoloji/odyo-kabin2.js), 29.10.2026
   Kabin cihazının KONUŞMA ve İMMİTANS modları. Saf ses modu odyo-app.js'de kalır.
   Bağlantı: OL.core (odyo-app.js) ↔ OL.k2 (bu dosya). Model: odyo-model.js (AXODY).
     - Konuşma: iki heceli kelimelerle SRT, tek heceli kelimelerle SD. Hasta kelimeyi tekrar eder
       (yazıyla; ses açıksa tarayıcının konuşma sentezi), öğrenci doğru/yanlış diye karar verir.
     - İmmitans: otoskopi → prob ucu (sızdırmazlık) → basınç taraması (+200 → −400 daPa) →
       tepe işaretleme ve Jerger tipi → isteğe bağlı akustik refleks eşikleri.
   Vaka masasında konuşma / timpanometri / refleks istenirse ölçümü öğrenci burada yapar.
   ========================================================================== */
(function () {
  'use strict';
  var C = window.OL && window.OL.core; if (!C) return;
  var OL = window.OL, A = C.A, K = C.K, $ = C.$, $$ = C.$$, X = C.X, ls = C.ls, EAR = C.EAR, W = window, D = document;
  var dec = function (v, n) { return v == null ? '—' : Number(v).toFixed(n == null ? 2 : n).replace('.', ','); };
  var shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  var KADIN = { normal: 1, ome: 1, otoskleroz: 1, meniere: 1, ani: 1 };

  var S = {
    km: 'ton', caseFor: null,
    k: { ear: 'R', list: 'srt', L: 40, mask: false, M: 50, wait: null, busy: false, block: 1, deck: { srt: [], sd: [] } },
    kon: { rec: {}, yor: {}, trials: [] },
    i: { ear: 'R', tip: null, run: false, rmode: 'ipsi', rfi: 1, rL: 80, last: null, anim: null },
    imm: { R: {}, L: {}, refl: {} }
  };
  var p = function () { return C.cur(); };
  var load = function () {
    var id = K.pid;
    S.kon = id ? ls.get('kon.' + id, { rec: {}, yor: {}, trials: [] }) : { rec: {}, yor: {}, trials: [] };
    S.imm = id ? ls.get('imm.' + id, { R: {}, L: {}, refl: {} }) : { R: {}, L: {}, refl: {} };
    S.k.wait = null; S.k.block = (S.kon.trials.reduce(function (m, t) { return Math.max(m, t.b || 0); }, 0)) + 1;
    S.i.tip = null; S.i.last = null;
  };
  var saveKon = function () { if (K.pid) ls.set('kon.' + K.pid, S.kon); };
  var saveImm = function () { if (K.pid) ls.set('imm.' + K.pid, S.imm); };

  /* =========================== mod seçimi =========================== */
  var setMode = function (m) {
    if (['ton', 'konusma', 'imm'].indexOf(m) < 0) m = 'ton';
    S.km = m; ls.set('km', m);
    $$('.dmodes [data-km]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-km') === m)); });
    $('#dm-ton').hidden = m !== 'ton'; $('#dm-kon').hidden = m !== 'konusma'; $('#dm-imm').hidden = m !== 'imm';
    $('#dmr-ton').hidden = m !== 'ton'; $('#dmr-kon').hidden = m !== 'konusma'; $('#dmr-imm').hidden = m !== 'imm';
    C.say(''); paintAll(); C.bridgeSend();
  };
  $$('.dmodes [data-km]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-km')); }); });

  /* =========================== ses yardımcıları =========================== */
  var trVoice = null;
  var pickVoice = function () { try { var v = W.speechSynthesis.getVoices(); trVoice = v.filter(function (x) { return /^tr/i.test(x.lang); })[0] || null; } catch (e) {} };
  if (W.speechSynthesis) { pickVoice(); try { W.speechSynthesis.onvoiceschanged = pickVoice; } catch (e) {} }
  var speak = function (text, o) {
    if (!text || !C.snd.on || !C.snd.ok || !W.speechSynthesis || !W.SpeechSynthesisUtterance) return;
    try {
      var u = new SpeechSynthesisUtterance(text); u.lang = 'tr-TR'; if (trVoice) u.voice = trVoice;
      u.rate = o.rate || 0.95; u.pitch = o.pitch || 1; u.volume = Math.max(0.03, Math.min(1, o.vol)) * C.snd.vol / 100;
      W.speechSynthesis.speak(u);
    } catch (e) {}
  };
  var noise = function (ear, M, dur, lp) { /* karşı kulağa gürültü (konuşma gürültüsü: alçak geçiren) */
    if (!C.snd.on || !C.snd.ok) return; var c = C.ac(); if (!c) return;
    var t0 = c.currentTime + 0.02, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), pan = c.createStereoPanner ? c.createStereoPanner() : null;
    n.buffer = C.noiseBuf(c); f.type = 'lowpass'; f.frequency.value = lp || 1200;
    var a = C.amp(Math.min(M, 95)) * C.snd.vol / 100 * 0.35 * 1.3;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + 0.08); g.gain.setValueAtTime(a, t0 + dur - 0.1); g.gain.linearRampToValueAtTime(0, t0 + dur);
    n.connect(f); f.connect(g); if (pan) { pan.pan.value = ear === 'R' ? 1 : -1; g.connect(pan); pan.connect(c.destination); } else g.connect(c.destination);
    n.start(t0); n.stop(t0 + dur + 0.05);
  };
  var tone = function (ear, f, hl, dur, quiet) {
    if (!C.snd.on || !C.snd.ok) return; var c = C.ac(); if (!c) return;
    var t0 = c.currentTime + 0.02, o = c.createOscillator(), g = c.createGain(), pan = c.createStereoPanner ? c.createStereoPanner() : null;
    o.type = 'sine'; o.frequency.value = f;
    var a = (quiet ? 0.035 : C.amp(Math.min(hl, 90))) * C.snd.vol / 100 * 0.35;                    /* güvenlik: refleks uyaranı 90 dB HL karşılığında kırpılır */
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + 0.04); g.gain.setValueAtTime(a, t0 + dur - 0.05); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g); if (pan) { pan.pan.value = ear === 'R' ? 1 : -1; g.connect(pan); pan.connect(c.destination); } else g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  };
  var voiceOf = function (pt) { return pt.yas < 12 ? { pitch: 1.5, rate: 1.05 } : KADIN[pt.id] ? { pitch: 1.2 } : { pitch: 0.75, rate: 0.9 }; };

  /* =========================== KONUŞMA =========================== */
  var kk = S.k;
  var LMAX = 110, LMIN = -10;
  var newBlock = function () { kk.block++; };
  var paintKonDev = function () {
    var e = $('#lk-ear'); e.className = 'lcd ' + kk.ear; e.querySelector('b').textContent = kk.ear === 'R' ? 'SAĞ' : 'SOL';
    $('#lk-list b').textContent = kk.list === 'srt' ? 'SRT' : 'SD';
    $('#lk-db b').innerHTML = kk.L + '<small>dB HL</small>';
    var m = $('#lk-m'); m.classList.toggle('off', !kk.mask); m.querySelector('b').innerHTML = kk.mask ? kk.M + '<small>EM</small>' : 'KAPALI';
    var m2 = $('#lk-m2'); m2.classList.toggle('off', !kk.mask); m2.querySelector('b').innerHTML = kk.mask ? kk.M + '<small>dB EM → ' + (kk.ear === 'R' ? 'SOL' : 'SAĞ') + '</small>' : 'KAPALI';
    $('#k2-R').setAttribute('aria-pressed', String(kk.ear === 'R')); $('#k2-L').setAttribute('aria-pressed', String(kk.ear === 'L'));
    $('#k2-srt').setAttribute('aria-pressed', String(kk.list === 'srt')); $('#k2-sd').setAttribute('aria-pressed', String(kk.list === 'sd'));
    $('#k2-m').setAttribute('aria-pressed', String(kk.mask));
    $('#k2-go').disabled = !K.pid || !!kk.wait || kk.busy;
    $('#k2-ok').disabled = !kk.wait; $('#k2-no').disabled = !kk.wait;
    $('#k2-wl').textContent = 'kelime kartı · ' + (kk.list === 'srt' ? 'iki heceli (SRT)' : 'tek heceli (SD)');
    if (!kk.wait && !kk.busy) { $('#k2-w').textContent = '—'; $('#k2-wn').textContent = K.pid ? 'KELİME ile sıradaki kelimeyi ver. Hasta tekrar eder; doğru mu yanlış mı sen karar ver.' : 'Önce bir hasta seç.'; }
  };
  var setK = function (o) {
    var ch = false; Object.keys(o).forEach(function (k) { if (kk[k] !== o[k]) { kk[k] = o[k]; ch = true; } });
    if (ch) newBlock(); paintKon(); C.bridgeSend();
  };
  var clampL = function (v) { return Math.max(LMIN, Math.min(LMAX, v)); };
  $('#k2-R').onclick = function () { setK({ ear: 'R' }); }; $('#k2-L').onclick = function () { setK({ ear: 'L' }); };
  $('#k2-srt').onclick = function () { setK({ list: 'srt' }); }; $('#k2-sd').onclick = function () { setK({ list: 'sd' }); };
  $('#k2-dn').onclick = function () { setK({ L: clampL(kk.L - 5) }); }; $('#k2-up').onclick = function () { setK({ L: clampL(kk.L + 5) }); };
  $('#k2-dn10').onclick = function () { setK({ L: clampL(kk.L - 10) }); }; $('#k2-up10').onclick = function () { setK({ L: clampL(kk.L + 10) }); };
  $('#k2-m').onclick = function () { setK({ mask: !kk.mask }); };
  $('#k2-mdn').onclick = function () { setK({ M: Math.max(0, kk.M - 5), mask: true }); }; $('#k2-mup').onclick = function () { setK({ M: Math.min(110, kk.M + 5), mask: true }); };

  var nextWord = function () {
    var d = kk.deck[kk.list]; if (!d.length) d = kk.deck[kk.list] = shuffle(kk.list === 'srt' ? A.SPONDEE : A.MONO);
    return d.shift();
  };
  var present = function () {
    if (!K.pid) { C.toast('Önce bir hasta seç.'); return; }
    if (kk.wait) { C.toast('Önce son kelimeye karar ver: Doğru (D) ya da Yanlış (Y).'); return; }
    if (kk.busy) return;
    C.askSound(function () {
      var pt = p(), w = nextWord(), st = { ear: kk.ear, list: kk.list, L: kk.L, mask: { on: kk.mask, M: kk.M } };
      var r = A.speechRespond(pt, st, w);
      kk.busy = true; C.say('');
      $('#k2-w').textContent = w[0]; $('#k2-wn').textContent = EAR[kk.ear] + ' kulak · ' + kk.L + ' dB HL' + (kk.mask ? ' · maske ' + kk.M + ' dB EM' : '') + ' · hasta dinliyor…';
      var b = $('#k2-go'); b.classList.remove('play'); void b.offsetWidth; b.classList.add('play');
      speak(w[0], { vol: Math.pow(10, (kk.L - 80) / 40), rate: 0.9, pitch: 1 });
      if (kk.mask) noise(A.other(kk.ear), kk.M, 1.6);
      paintKonDev();
      setTimeout(function () {
        kk.busy = false; kk.wait = { w: w, r: r, st: st };
        var line = r.said ? '«' + r.said + '»' : '(sessiz kaldı)';
        if (r.ok && r.via === 'cross' && Math.random() < 0.35) line += ' …ama öbür kulağımda duydum galiba.';
        else if (r.overmask && Math.random() < 0.5) line += ' Bu hışırtı çok yüksek…';
        C.say(line); C.live('Hasta: ' + (r.said || 'yanıt yok'));
        if (r.said) speak(r.said === 'anlamadım' ? 'Anlamadım.' : r.said, Object.assign({ vol: 0.9 }, voiceOf(pt)));
        $('#k2-wn').innerHTML = 'Hasta: <b>' + X(r.said ? '«' + r.said + '»' : '(sessiz)') + '</b> · hedef kelimeyle aynı mı?';
        paintKonDev();
      }, 950 + Math.random() * 300);
    });
  };
  var judge = function (yes) {
    if (!kk.wait) return;
    var w = kk.wait;
    S.kon.trials.push({ e: w.st.ear, li: w.st.list, L: w.st.L, m: w.st.mask.on ? w.st.mask.M : null, ok: w.r.ok, j: !!yes, b: kk.block });
    if (S.kon.trials.length > 600) S.kon.trials = S.kon.trials.slice(-600);
    kk.wait = null; saveKon(); paintKon(); C.bridgeSend();
  };
  $('#k2-go').addEventListener('click', present);
  $('#k2-ok').onclick = function () { judge(true); }; $('#k2-no').onclick = function () { judge(false); };

  var tKey = function (t) { return t.L + '|' + (t.m == null ? '' : t.m); };
  var paintTally = function () {
    var rows = {}, cur = tKey({ L: kk.L, m: kk.mask ? kk.M : null });
    S.kon.trials.filter(function (t) { return t.e === kk.ear && t.li === kk.list; }).forEach(function (t) { var k = tKey(t); var r = rows[k] = rows[k] || { L: t.L, m: t.m, n: 0, y: 0 }; r.n++; if (t.j) r.y++; });
    var ks = Object.keys(rows).sort(function (a, b) { return rows[b].L - rows[a].L || ((rows[a].m || 0) - (rows[b].m || 0)); });
    var head = '<tr><th>SEVİYE</th><th>MASKE</th><th>DOĞRU / VERİLEN</th><th>%</th></tr>';
    if (!ks.length) { $('#k2-tally').innerHTML = head + '<tr><td colspan="4" style="color:var(--muted)">' + (K.pid ? 'Bu kulak ve listede henüz kelime vermedin. Kararların burada seviye seviye toplanır.' : 'Hasta seç.') + '</td></tr>'; return; }
    $('#k2-tally').innerHTML = head + ks.map(function (k) {
      var r = rows[k], pc = Math.round(r.y / r.n * 100), h50 = kk.list === 'srt' && r.n >= 2 && pc >= 50;
      return '<tr class="' + (k === cur ? 'cur' : '') + '"><td><b>' + r.L + '</b> dB HL</td><td>' + (r.m == null ? '—' : r.m + ' EM') + '</td><td><span class="bar" style="width:' + Math.max(2, pc * 0.6) + 'px"></span>' + r.y + ' / ' + r.n + '</td><td class="' + (h50 ? 'h50' : '') + '">%' + pc + '</td></tr>';
    }).join('');
  };
  var marksOf = function () { return K.marks || {}; };
  var ssoMine = function (e) { var m = marksOf(), v = [500, 1000, 2000].map(function (f) { var x = m[e + '.ac.' + f]; return x && !x.nr ? x.L : null; }); return v.indexOf(null) >= 0 ? null : Math.round((v[0] + v[1] + v[2]) / 3 * 10) / 10; };
  var bcBestMine = function (e) { var m = marksOf(), v = [500, 1000, 2000, 4000].map(function (f) { var x = m[e + '.bc.' + f]; return x && !x.nr ? x.L : null; }).filter(function (x) { return x != null; }); return v.length ? Math.min.apply(null, v) : null; };
  var paintKonRule = function () {
    var el = $('#k2-rule'); if (!K.pid) { el.innerHTML = '<b>Başlamak için</b> soldan bir hasta seç.'; return; }
    var e = kk.ear, n = A.other(e), s = ssoMine(e), bb = bcBestMine(n), h;
    if (kk.list === 'srt') {
      h = '<b>SRT (konuşmayı alma eşiği):</b> iki heceli kelimelerin yarısını doğru tekrarladığı en düşük seviye. Kelimeleri önce rahat duyacağı seviyede tanıt (SSO + 30 dB), sonra 10 dB in; kaçırmaya başlayınca 5 dB adımlarla çalış. Her seviyede en az 2–4 kelime ver; %50 ve üstü yeşil yanar.';
      h += s != null ? '<br>Senin odyogramında ' + EAR[e] + ' SSO ≈ <b>' + String(s).replace('.', ',') + ' dB</b> → başlangıç ≈ ' + Math.round((s + 30) / 5) * 5 + ' dB HL.' : '<br>Önce saf ses modunda bu kulağın 500–1000–2000 Hz eşiklerini bulursan başlangıç seviyesini SSO\'dan hesaplarsın.';
    } else {
      h = '<b>SD (konuşmayı ayırt etme):</b> tek heceli kelimelerle SRT + 30–40 dB\'de ya da rahat dinleme seviyesinde ölç. Aynı seviyede en az 10 kelime ver (klinikte 25 ya da 50), sonra "SD\'yi kaydet". Skor, doğru tekrar yüzdesidir. Retrokoklear şüphede daha yüksek bir seviyede tekrarla: skor düşüyorsa (rollover) önemlidir.';
      var sr = S.kon.rec[e] && S.kon.rec[e].srt; if (sr) h += '<br>Kaydettiğin SRT ' + sr.L + ' dB → SD için ≈ ' + (sr.L + 30) + '–' + (sr.L + 40) + ' dB HL.';
    }
    h += '<br><b>Maskeleme:</b> konuşmada kulaklar arası azalma ≈ 40 dB. Sunum seviyesi − 40 ≥ öbür kulağın en iyi kemik eşiği ise karşı kulağa gürültü ver (başlangıç: sunum seviyesi − 20 dB EM).';
    if (bb != null) h += '<br>Şu an: ' + kk.L + ' − 40 = ' + (kk.L - 40) + (kk.L - 40 >= bb ? ' ≥ ' : ' < ') + bb + ' (' + EAR[n] + ' en iyi kemik, senin ölçümün) → <b>' + (kk.L - 40 >= bb ? 'maskeleme gerekli' : 'maskeleme gerekmez') + '</b>' + (kk.L - 40 >= bb && !kk.mask ? '; önerilen ≈ ' + (kk.L - 20) + ' dB EM' : '') + '.';
    else h += '<br>' + EAR[n] + ' kulağın kemik eşiklerini saf ses modunda ölçmediğin için kural hesaplanamıyor.';
    el.innerHTML = h;
  };
  var paintKonForm = function () {
    var r = S.kon.rec, row = function (e) {
      var s = r[e] && r[e].srt, d = r[e] && r[e].sd, so = ssoMine(e);
      return '<tr><td><span class="pill ' + e + '">' + EAR[e] + '</span></td><td' + (s ? '' : ' class="mute"') + '>' + (s ? '<b>' + s.L + '</b> dB HL' + (s.masked ? ' · maskeli (' + s.M + ' EM)' : '') : 'kaydedilmedi') + '</td>' +
        '<td' + (d ? '' : ' class="mute"') + '>' + (d ? '<b>%' + d.pct + '</b> @ ' + d.L + ' dB · ' + d.n + ' kelime' + (d.masked ? ' · maskeli' : '') : 'kaydedilmedi') + '</td><td' + (so == null ? ' class="mute"' : '') + '>' + (so == null ? '—' : String(so).replace('.', ',')) + '</td></tr>';
    };
    $('#k2-form').innerHTML = '<tr><th>Kulak</th><th>SRT</th><th>SD</th><th>SSO (senin)</th></tr>' + row('R') + row('L');
  };
  var paintKonYor = function () {
    var y = S.kon.yor || {}, opt = function (list, cur) { return '<option value="">seç…</option>' + list.map(function (o) { return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + X(o[1]) + '</option>'; }).join(''); };
    var U = [['uyumlu', 'Uyumlu (±10 dB içinde)'], ['uyumsuz', 'Uyumsuz (>10 dB fark)']], SD = A.SDS.map(function (s) { return [s.k, s.t]; });
    $('#k2-yor').innerHTML = ['R', 'L'].map(function (e) {
      var v = y[e] || {};
      return '<fieldset><legend><span class="pill ' + e + '">' + EAR[e] + ' kulak</span></legend><label>SRT–SSO uyumu<select data-k2y="' + e + '.uyum">' + opt(U, v.uyum) + '</select></label><label>SD sınıfı<select data-k2y="' + e + '.sinif">' + opt(SD, v.sinif) + '</select></label></fieldset>';
    }).join('');
  };
  $('#k2-yor').addEventListener('change', function (e) {
    var s = e.target.closest('[data-k2y]'); if (!s || !K.pid) return; var k = s.getAttribute('data-k2y').split('.');
    S.kon.yor = S.kon.yor || {}; S.kon.yor[k[0]] = S.kon.yor[k[0]] || {}; S.kon.yor[k[0]][k[1]] = s.value; saveKon();
  });
  $('#k2-save-srt').onclick = function () {
    if (!K.pid) { C.toast('Önce bir hasta seç.'); return; }
    if (kk.list !== 'srt') { C.toast('SRT iki heceli listeyle bulunur: önce listeyi SRT yap.'); return; }
    var n = S.kon.trials.filter(function (t) { return t.e === kk.ear && t.li === 'srt' && t.L === kk.L && (t.m == null) === !kk.mask; }).length;
    if (n < 2) { C.toast('Bu seviyede en az 2 kelime vermeden SRT kaydedilmez.'); return; }
    S.kon.rec[kk.ear] = S.kon.rec[kk.ear] || {}; S.kon.rec[kk.ear].srt = { L: kk.L, masked: kk.mask, M: kk.mask ? kk.M : null };
    saveKon(); paintKon(); C.toast(EAR[kk.ear] + ' SRT: ' + kk.L + ' dB HL kaydedildi' + (kk.mask ? ' (maskeli)' : '')); C.bridgeSend();
  };
  $('#k2-save-sd').onclick = function () {
    if (!K.pid) { C.toast('Önce bir hasta seç.'); return; }
    if (kk.list !== 'sd') { C.toast('SD tek heceli listeyle ölçülür: önce listeyi SD yap.'); return; }
    var bl = S.kon.trials.filter(function (t) { return t.b === kk.block && t.li === 'sd'; });
    if (bl.length < 10) { C.toast('Bu seviyede en az 10 kelime ver (şu an ' + bl.length + ').'); return; }
    var y = bl.filter(function (t) { return t.j; }).length, okj = bl.filter(function (t) { return t.j === t.ok; }).length;
    S.kon.rec[kk.ear] = S.kon.rec[kk.ear] || {};
    S.kon.rec[kk.ear].sd = { L: kk.L, pct: Math.round(y / bl.length * 100), n: bl.length, masked: kk.mask, M: kk.mask ? kk.M : null, judge: { ok: okj, total: bl.length } };
    newBlock(); kk.deck.sd = []; saveKon(); paintKon(); C.toast(EAR[kk.ear] + ' SD: %' + S.kon.rec[kk.ear].sd.pct + ' kaydedildi'); C.bridgeSend();
  };
  $('#k2-new').onclick = function () { newBlock(); kk.deck[kk.list] = []; paintKon(); C.toast('Yeni liste: sayım bu seviyeden yeniden başlar.'); };

  var K2RES = { dogru: 'doğru', golge: 'gölge: maskesiz ölçtün, kelimeleri öbür kulak tekrar ettirdi', maskesiz: 'değer doğru ama maskeleme gerekiyordu', yanlis: 'SRT 5 dB\'den fazla farklı', eksik: 'kaydedilmedi' };
  var NOTE_K = {
    yalanci: 'SRT, saf ses ortalamasından 40 dB\'den fazla iyi. Organik bir kayıpta bu olmaz: yalancı (fonksiyonel) işitme kaybı şüphesi. Akustik refleksler de iddia edilen eşiklere çok yakın ya da altında çıkar; Stenger testi ve ABR ile doğrulanır.',
    noroma: 'Sağda SD, eşiklere göre orantısız düşük; yüksek seviyede daha da düşüyorsa (rollover) retrokoklear patolojiyi düşündürür.',
    ani: 'Sol kulakta konuşma ölçerken sağ kulak maskelenmezse kelimeleri iyi duyan sağ kulak tekrar ettirir (gölge SRT ≈ 50 dB).',
    kom: 'Sol kulakta SRT ve SD için sağ kulak maskelenmeli; sunum seviyesi − 40 dB, sağ kemik eşiğini aşıyor.',
    ome: 'İki taraflı iletim kaybında SD yüksektir (koklea sağlam); yeterli seviyede sunulunca kelimeler net anlaşılır.',
    presbi: 'Yaşa bağlı kayıpta SD eşiklere göre beklenenden düşük olabilir; cihaz danışmanlığında beklentiyi bu belirler.'
  };
  $('#k2-eval').onclick = function () {
    var pt = p(); if (!pt) { C.toast('Önce bir hasta seç.'); return; }
    var r = S.kon.rec; if (!r.R && !r.L) { C.toast('Değerlendirmek için en az bir SRT ya da SD kaydet.'); return; }
    var g = A.gradeSpeech(pt, r, S.kon.yor), col = g.puan >= 80 ? 'var(--ok)' : g.puan >= 55 ? 'var(--warn)' : 'var(--bad)';
    var done = ls.get('konDone', {}); done[pt.id] = g.puan; ls.set('konDone', done);
    var SDT = {}; A.SDS.forEach(function (s) { SDT[s.k] = s.t; });
    $('#k2-karne').innerHTML = '<div class="karne"><div class="stamp" style="color:' + col + '"><b>' + g.puan + '</b><small>PUAN</small></div><h3>' + X(pt.ad) + ' · konuşma karnesi</h3><ul>' +
      g.rows.map(function (w) {
        return '<li><b>' + EAR[w.ear] + ' SRT:</b> ' + K2RES[w.srt] + ' (doğrusu ' + pt.srt[w.ear] + ' dB HL' + (A.needMaskSpeech(pt, w.ear, pt.srt[w.ear]) ? ', maskeli' : '') + ')</li>' +
          '<li><b>' + EAR[w.ear] + ' SD:</b> ' + (w.sd === 'eksik' ? 'kaydedilmedi' : (w.sdLv ? 'seviye uygun' : 'seviye düşük ya da kelime az') + ' · ' + (w.sdMask ? 'maskeleme doğru' : 'maskeleme gerekiyordu') + ' · ' + (w.sdJudge ? 'kararların doğru' : 'bazı kelimelere yanlış karar verdin')) + ' (beklenen en iyi skor ≈ %' + pt.sd[w.ear] + ')</li>' +
          '<li><b>' + EAR[w.ear] + ' yorum:</b> uyum ' + (w.uyum ? '<b style="color:var(--ok)">doğru</b>' : 'doğrusu <b>' + (w.uyumT === 'uyumlu' ? 'uyumlu' : 'uyumsuz') + '</b>') + ' · SD sınıfı ' + (w.sinif ? '<b style="color:var(--ok)">doğru</b>' : 'doğrusu <b>' + X(SDT[w.sinifT]) + '</b>') + '</li>';
      }).join('') + '</ul>' + (NOTE_K[pt.id] ? '<p style="margin:10px 0 0;font-size:14px;line-height:1.55"><b>Öğretici not:</b> ' + X(NOTE_K[pt.id]) + '</p>' : '') + '</div>';
    $('#k2-eval-n').textContent = 'Son puan: ' + g.puan; C.bridgeSend();
  };
  var paintKon = function () {
    paintKonDev(); paintTally(); paintKonRule(); paintKonForm(); paintKonYor();
    var pt = p(); $('#k2-t').textContent = pt ? pt.ad + ', ' + pt.yas + ' · konuşma formu' : 'Konuşma formu';
    $('#k2-c').textContent = EAR[kk.ear] + ' · ' + (kk.list === 'srt' ? 'SRT' : 'SD');
  };

  /* =========================== İMMİTANS =========================== */
  var ii = S.i;
  var TW = 560, TH = 300, CMAX = 1.8;
  var tx = function (pr) { return 52 + (pr + 400) / 600 * (TW - 72); };
  var ty = function (c) { return TH - 36 - c / CMAX * (TH - 58); };
  var jit = function (pr, e) { return 0.006 * Math.sin(pr * 0.37 + (e === 'R' ? 1.3 : 4.1)) + 0.004 * Math.sin(pr * 0.11 + 2); };
  var measC = function (pt, e, pr) { return Math.max(0, A.tympY(pt.imm[e], pr) + jit(pr, e)); };
  var curvePath = function (pt, e, to) {
    var d = ''; for (var pr = 200; pr >= Math.max(-400, to); pr -= 5) d += (pr === 200 ? 'M' : 'L') + tx(pr).toFixed(1) + ' ' + ty(measC(pt, e, pr)).toFixed(1);
    return d;
  };
  var paintGraph = function () {
    var pt = p(), s = '';
    s += '<rect class="nb" x="' + tx(-100) + '" y="' + ty(1.4) + '" width="' + (tx(50) - tx(-100)) + '" height="' + (ty(0.3) - ty(1.4)) + '"/>';
    s += '<text class="ax" x="' + (tx(-100) + 4) + '" y="' + (ty(1.4) + 13) + '" style="font-size:10px">normal (yetişkin)</text>';
    for (var c = 0; c <= CMAX + 0.001; c += 0.3) s += '<line class="gl" x1="52" x2="' + (TW - 20) + '" y1="' + ty(c) + '" y2="' + ty(c) + '"/><text class="ax" x="44" y="' + (ty(c) + 4) + '" text-anchor="end">' + dec(c, 1) + '</text>';
    [-400, -300, -200, -100, 0, 100, 200].forEach(function (pr) { s += '<line class="gl" x1="' + tx(pr) + '" x2="' + tx(pr) + '" y1="' + ty(CMAX) + '" y2="' + ty(0) + '"' + (pr === 0 ? ' style="stroke:var(--grid-2)"' : '') + '/><text class="ax" x="' + tx(pr) + '" y="' + (TH - 16) + '" text-anchor="middle">' + (pr > 0 ? '+' : '') + pr + '</text>'; });
    s += '<text class="ax" x="6" y="11">ml</text><text class="ax" x="' + (TW - 20) + '" y="16" text-anchor="end">daPa →</text>';
    if (pt) ['R', 'L'].forEach(function (e) {
      var t = S.imm[e].tymp, running = ii.anim && ii.anim.ear === e;
      if (running) s += '<path class="c' + e + '" d="' + curvePath(pt, e, ii.anim.pr) + '"/>';
      else if (t && t.done) s += '<path class="c' + e + '" d="' + curvePath(pt, e, -400) + '"' + (e !== ii.ear ? ' opacity=".45"' : '') + '/>';
      if (t && t.peak && !running) s += '<circle class="pk pk' + e + '" cx="' + tx(t.peak.p) + '" cy="' + ty(t.peak.c) + '" r="7"/>';
    });
    $('#ki-g').innerHTML = s;
  };
  $('#ki-g').addEventListener('click', function (ev) {
    var pt = p(); if (!pt) return; var t = S.imm[ii.ear].tymp;
    if (!t || !t.done) { C.toast('Önce ' + EAR[ii.ear].toLocaleLowerCase('tr') + ' kulakta basıncı tara.'); return; }
    var svg = ev.currentTarget, q = svg.createSVGPoint(); q.x = ev.clientX; q.y = ev.clientY; q = q.matrixTransform(svg.getScreenCTM().inverse());
    var pr = Math.round(((q.x - 52) / (TW - 72) * 600 - 400) / 5) * 5, c = (TH - 36 - q.y) / (TH - 58) * CMAX;
    pr = Math.max(-400, Math.min(200, pr)); c = Math.max(0, Math.min(CMAX, Math.round(c * 100) / 100));
    t.peak = { p: pr, c: c }; t.nopeak = false; saveImm(); paintImm(); C.bridgeSend();
    C.toast(EAR[ii.ear] + ' tepe: ' + (pr > 0 ? '+' : '') + pr + ' daPa, ' + dec(c) + ' ml');
  });
  $('#ki-nopeak').onclick = function () {
    var t = S.imm[ii.ear].tymp; if (!t || !t.done) { C.toast('Önce bu kulakta basıncı tara.'); return; }
    t.nopeak = true; t.peak = null; saveImm(); paintImm(); C.bridgeSend();
  };
  var otoSVG = function (g, e) {
    var flip = e === 'L' ? ' transform="translate(150 0) scale(-1 1)"' : '';
    var s = '<defs><radialGradient id="otd" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#E6DFD7"/><stop offset="1" stop-color="#B9ADA2"/></radialGradient>' +
      '<radialGradient id="otf" cx="50%" cy="55%" r="55%"><stop offset="0" stop-color="#E7C27A"/><stop offset="1" stop-color="#B98A3E"/></radialGradient>' +
      '<radialGradient id="ots" cx="62%" cy="60%" r="35%"><stop offset="0" stop-color="#F08C8C" stop-opacity=".8"/><stop offset="1" stop-color="#F08C8C" stop-opacity="0"/></radialGradient></defs>';
    s += '<circle cx="75" cy="75" r="68" fill="#2B1612"/><circle cx="75" cy="75" r="60" fill="#D99C83"/><g' + flip + '>';
    if (g === 'sivi') s += '<ellipse cx="75" cy="76" rx="44" ry="40" fill="url(#otf)"/><path d="M38 86 Q75 78 112 86" fill="none" stroke="#8A6526" stroke-width="2"/><circle cx="60" cy="96" r="4" fill="none" stroke="#FFF0C8" stroke-width="1.5"/><circle cx="88" cy="100" r="3" fill="none" stroke="#FFF0C8" stroke-width="1.5"/><path d="M80 44 L72 72" stroke="#F4E3B8" stroke-width="5" stroke-linecap="round"/>';
    else {
      s += '<ellipse cx="75" cy="76" rx="44" ry="40" fill="url(#otd)"/>';
      if (g === 'schwartze') s += '<ellipse cx="75" cy="76" rx="44" ry="40" fill="url(#ots)"/>';
      if (g === 'perfor') s += '<ellipse cx="76" cy="80" rx="24" ry="20" fill="#7A2E2A"/><ellipse cx="76" cy="82" rx="16" ry="12" fill="#B4544B" opacity=".8"/><path d="M80 44 L76 60" stroke="#F3EDE6" stroke-width="4" stroke-linecap="round"/>';
      else s += '<path d="M80 44 L72 74" stroke="#F3EDE6" stroke-width="4" stroke-linecap="round"/><path d="M74 80 L98 110 L86 112 Z" fill="#FFFFFF" opacity=".85"/>';
    }
    s += '</g><circle cx="75" cy="75" r="68" fill="none" stroke="#0D1838" stroke-width="6"/><text x="75" y="142" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#FFD86B">' + (e === 'R' ? 'SAĞ' : 'SOL') + '</text>';
    return s;
  };
  var paintOto = function () {
    var pt = p(), r = pt && S.imm[ii.ear].oto;
    if (!pt || !r) { $('#ki-oto-v').innerHTML = '<circle cx="75" cy="75" r="68" fill="#1A1410"/><circle cx="75" cy="75" r="68" fill="none" stroke="#2A2F45" stroke-width="6"/><text x="75" y="80" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="#8C7A4E">otoskop</text>'; $('#ki-oto-t').innerHTML = '<b>Otoskopi</b>Prob takmadan önce kulak yoluna ve zara bak: buşon, perforasyon ya da akıntı ölçümü değiştirir.'; return; }
    var o = pt.oto[ii.ear]; $('#ki-oto-v').innerHTML = otoSVG(o.g, ii.ear); $('#ki-oto-t').innerHTML = '<b>' + EAR[ii.ear] + ' kulak · otoskopi</b>' + X(o.t);
  };
  $('#ki-oto').onclick = function () {
    if (!K.pid) { C.toast('Önce bir hasta seç.'); return; }
    S.imm[ii.ear].oto = true; saveImm(); paintImm(); C.bridgeSend();
  };
  var setTip = function (sz) {
    if (!K.pid) { C.toast('Önce bir hasta seç.'); return; }
    ii.tip = sz; var ok = A.probeOk(p(), sz), pt = p();
    if (!S.imm[ii.ear].oto) C.toast('Otoskopi yapmadan prob taktın; karnede not edilir.');
    else C.toast(ok ? 'Prob yerleşti: sızdırmazlık tamam.' : 'Kaçak var: bu prob ucu ' + (pt.yas <= 12 ? 'çocuğun kulak yoluna büyük' : 'kulak yolunu kapatmıyor') + '.');
    if (!ok && pt.yas <= 12) C.say('Ayy, kulağım!');
    paintImm();
  };
  $$('#dm-imm [data-tip]').forEach(function (b) { b.addEventListener('click', function () { setTip(b.getAttribute('data-tip')); }); });
  var sealed = function () { return !!ii.tip && !!K.pid && A.probeOk(p(), ii.tip); };
  var setIEar = function (e) { if (ii.run) return; ii.ear = e; ii.last = null; paintImm(); C.bridgeSend(); };
  $('#ki-R').onclick = function () { setIEar('R'); }; $('#ki-L').onclick = function () { setIEar('L'); };
  var sweep = function () {
    if (!K.pid) { C.toast('Önce bir hasta seç.'); return; }
    if (ii.run) return;
    if (!ii.tip) { C.toast('Önce prob ucunu seç ve tak.'); return; }
    if (!sealed()) { $('#li-p b').innerHTML = 'KAÇAK'; C.toast('Basınç tutulamıyor: kaçak var. Hastaya uygun prob ucunu seç.'); return; }
    C.askSound(function () {
      var pt = p(), e = ii.ear, t0 = performance.now(), DUR = 2600;
      ii.run = true; ii.anim = { ear: e, pr: 200 }; C.say('');
      tone(e, 226, 0, DUR / 1000 + 0.2, true);
      var b = $('#ki-run'); b.classList.add('down');
      if (Math.random() < 0.4) setTimeout(function () { C.say('Kulağımda bir basınç var…'); }, 900);
      var step = function (now) {
        var u = Math.min(1, (now - t0) / DUR), pr = Math.round((200 - 600 * u) / 5) * 5;
        ii.anim.pr = pr; $('#li-p b').innerHTML = (pr > 0 ? '+' : '') + pr + '<small>daPa</small>'; $('#li-c b').innerHTML = dec(measC(pt, e, pr)) + '<small>ml</small>';
        if (u === 1 || pr === 200) $('#li-v b').innerHTML = dec(pt.imm[e].ecv) + '<small>ml</small>';
        paintGraph();
        if (u < 1) { requestAnimationFrame(step); return; }
        ii.run = false; ii.anim = null; b.classList.remove('down');
        var t = S.imm[e].tymp = S.imm[e].tymp || {}; t.done = true; t.ecv = pt.imm[e].ecv; t.oto = !!S.imm[e].oto;
        saveImm(); paintImm(); C.live('Tarama bitti'); C.bridgeSend();
        C.toast('Tarama bitti. Tepeyi işaretle (ya da "Tepe yok"), sonra tipini seç.');
      };
      requestAnimationFrame(step);
    });
  };
  $('#ki-run').addEventListener('click', sweep);

  /* akustik refleks */
  var RF = A.REFL_F;
  var rKey = function () { return ii.ear + '.' + ii.rmode + '.' + RF[ii.rfi]; };
  var rMax = function () { return A.REFL_MAX[ii.rmode]; };
  $('#ki-ipsi').onclick = function () { ii.rmode = 'ipsi'; ii.rL = Math.min(ii.rL, rMax()); paintImm(); };
  $('#ki-con').onclick = function () { ii.rmode = 'contra'; paintImm(); };
  $('#ki-fdn').onclick = function () { ii.rfi = Math.max(0, ii.rfi - 1); paintImm(); }; $('#ki-fup').onclick = function () { ii.rfi = Math.min(RF.length - 1, ii.rfi + 1); paintImm(); };
  $('#ki-rdn').onclick = function () { ii.rL = Math.max(70, ii.rL - 5); paintImm(); }; $('#ki-rup').onclick = function () { ii.rL = Math.min(rMax(), ii.rL + 5); paintImm(); };
  var drawTrace = function (d) {
    var y0 = 16, k = 170, y1 = y0 + Math.min(50, d * k), path = 'M0 ' + y0 + 'H90 C110 ' + y0 + ' 112 ' + y1 + ' 130 ' + y1 + ' H210 C228 ' + y1 + ' 232 ' + y0 + ' 250 ' + y0 + ' H300';
    $('#ki-rtr').innerHTML = '<line x1="0" x2="300" y1="' + (y0 + 0.02 * k) + '" y2="' + (y0 + 0.02 * k) + '" stroke="#E8C77A" stroke-dasharray="4 4"/><path d="' + path + '"/>';
  };
  $('#ki-rgo').onclick = function () {
    if (!K.pid) { C.toast('Önce bir hasta seç.'); return; }
    var t = S.imm[ii.ear].tymp; if (!t || !t.done) { C.toast('Önce bu kulakta timpanometri yap: refleks prob kulağının tepe basıncında ölçülür.'); return; }
    if (!sealed()) { C.toast('Prob yerinde değil: uygun prob ucunu tak.'); return; }
    C.askSound(function () {
      var pt = p(), f = RF[ii.rfi], stim = ii.rmode === 'ipsi' ? ii.ear : A.other(ii.ear), rt = A.reflex(pt, ii.ear, ii.rmode, f);
      var d = rt != null && ii.rL >= rt ? Math.min(0.3, 0.025 + (ii.rL - rt) * 0.012) : 0.002 + Math.random() * 0.007;
      tone(stim, f, ii.rL, 1);
      ii.last = { key: rKey(), L: ii.rL, d: d }; drawTrace(d);
      $('#ki-rv').innerHTML = 'Uyaran: ' + EAR[stim] + ' kulak · ' + (f >= 1000 ? f / 1000 + ' kHz' : f + ' Hz') + ' · ' + ii.rL + ' dB HL → uyum değişimi <b>' + dec(d, 3) + ' ml</b> (ölçüt 0,02 ml)';
      if (ii.rL >= 105 && Math.random() < 0.4) C.say('Bu ses çok yüksek!');
    });
  };
  var rMark = function (nr) {
    if (!K.pid) return; var t = S.imm[ii.ear].tymp; if (!t || !t.done) { C.toast('Önce bu kulakta timpanometri yap.'); return; }
    S.imm.refl[rKey()] = nr ? { L: null, nr: true } : { L: ii.rL, nr: false }; saveImm(); paintImm(); C.bridgeSend();
    C.toast('Prob ' + EAR[ii.ear].toLocaleLowerCase('tr') + ' · ' + (ii.rmode === 'ipsi' ? 'ipsi' : 'kontra') + ' · ' + RF[ii.rfi] + ' Hz: ' + (nr ? 'refleks yok' : ii.rL + ' dB HL'));
  };
  $('#ki-rmark').onclick = function () { rMark(false); }; $('#ki-rnr').onclick = function () { rMark(true); };

  var paintImmDev = function () {
    var e = $('#li-ear'); e.className = 'lcd ' + ii.ear; e.querySelector('b').textContent = ii.ear === 'R' ? 'SAĞ' : 'SOL';
    var t = K.pid && S.imm[ii.ear].tymp;
    if (!ii.run) {
      $('#li-p b').innerHTML = (t && t.done && t.peak ? (t.peak.p > 0 ? '+' : '') + t.peak.p : '+200') + '<small>daPa</small>';
      $('#li-c b').innerHTML = (t && t.done && t.peak ? dec(t.peak.c) : '0,00') + '<small>ml</small>';
      $('#li-v b').innerHTML = (t && t.done ? dec(t.ecv) : '—') + '<small>ml</small>';
    }
    $('#ki-R').setAttribute('aria-pressed', String(ii.ear === 'R')); $('#ki-L').setAttribute('aria-pressed', String(ii.ear === 'L'));
    $$('#dm-imm [data-tip]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tip') === ii.tip)); });
    var lamp = $('#ki-seal'); lamp.classList.toggle('seal', sealed()); lamp.classList.toggle('leak', !!ii.tip && !sealed());
    $('#ki-ipsi').setAttribute('aria-pressed', String(ii.rmode === 'ipsi')); $('#ki-con').setAttribute('aria-pressed', String(ii.rmode === 'contra'));
    var f = RF[ii.rfi]; $('#li-rf b').innerHTML = (f >= 1000 ? f / 1000 + '<small>kHz</small>' : f + '<small>Hz</small>');
    $('#li-rl b').innerHTML = ii.rL + '<small>dB HL</small>';
    $('#ki-run').disabled = !K.pid || ii.run;
    var st = { oto: !!(K.pid && S.imm[ii.ear].oto), prob: sealed(), tara: !!(t && t.done), refl: !!(K.pid && Object.keys(S.imm.refl).some(function (k) { return k.charAt(0) === ii.ear; })) }, nx = null;
    $$('#isteps li').forEach(function (li) { var k = li.getAttribute('data-st'); li.className = st[k] ? 'ok' : ''; if (!st[k] && !nx && K.pid) { nx = k; li.className = 'on'; } });
  };
  var paintImmForm = function () {
    var pt = p(), opt = function (cur) { return '<option value="">seç…</option>' + Object.keys(A.TIPK).map(function (k) { return '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + X(A.TIPK[k]) + '</option>'; }).join(''); };
    var row = function (e) {
      var t = (pt && S.imm[e].tymp) || {};
      return '<tr><td><span class="pill ' + e + '">' + EAR[e] + '</span></td>' +
        '<td' + (t.done ? '' : ' class="mute"') + '>' + (!t.done ? 'taranmadı' : t.nopeak ? 'tepe yok' : t.peak ? (t.peak.p > 0 ? '+' : '') + t.peak.p + ' daPa' : 'işaretlenmedi') + '</td>' +
        '<td' + (t.peak ? '' : ' class="mute"') + '>' + (t.peak ? dec(t.peak.c) + ' ml' : '—') + '</td><td' + (t.done ? '' : ' class="mute"') + '>' + (t.done ? dec(t.ecv) + ' ml' : '—') + '</td>' +
        '<td><select class="imm-sel" data-kit="' + e + '"' + (t.done ? '' : ' disabled') + ' aria-label="' + EAR[e] + ' kulak timpanogram tipi">' + opt(t.tip) + '</select></td></tr>';
    };
    $('#ki-form').innerHTML = '<tr><th>Kulak</th><th>Tepe basınç</th><th>Uyum</th><th>Hacim</th><th>Tip</th></tr>' + row('R') + row('L');
    var n = pt ? A.ecvNorm(pt) : A.ecvNorm({ yas: 30 });
    $('#ki-rule').innerHTML = '<b>Normal değerler (226 Hz):</b> tepe basınç −100 ile +50 daPa, uyum (statik kompliyans) 0,3–1,4 ml, kulak yolu hacmi ' + (pt && pt.yas <= 10 ? 'çocukta 0,4–1,0 ml' : 'yetişkinde 0,6–1,5 ml') + '.' +
      '<br><b>Jerger:</b> A normal · As sığ (uyum düşük: otoskleroz) · Ad derin (uyum yüksek: kemikçik kopukluğu) · C tepe −100 daPa\'dan negatif (östaki) · B düz.' +
      '<br><b>B\'de hacme bak:</b> normal hacim → orta kulakta sıvı; yüksek (' + (pt && pt.yas <= 10 ? '>' + dec(n.hi, 1) : '>2,0') + ' ml) → perforasyon ya da açık tüp; düşük → buşon ya da prob kulak yolu duvarına dayalı.';
  };
  $('#ki-form').addEventListener('change', function (e) {
    var s = e.target.closest('[data-kit]'); if (!s || !K.pid) return; var t = S.imm[s.getAttribute('data-kit')].tymp; if (!t) return;
    t.tip = s.value; saveImm(); C.bridgeSend();
  });
  var paintRGrid = function (graded) {
    var refl = (K.pid && S.imm.refl) || {}, cur = rKey(), gmap = {};
    if (graded) graded.forEach(function (r) { gmap[r.key] = r.ok; });
    var h = '<tr><th>Prob · mod</th>' + RF.map(function (f) { return '<th>' + (f >= 1000 ? f / 1000 + ' kHz' : f + ' Hz') + '</th>'; }).join('') + '</tr>';
    ['R', 'L'].forEach(function (e) { ['ipsi', 'contra'].forEach(function (m) {
      h += '<tr><th><span class="pill ' + e + '">' + EAR[e] + '</span> ' + (m === 'ipsi' ? 'ipsi' : 'kontra') + '</th>' + RF.map(function (f) {
        var k = e + '.' + m + '.' + f, v = refl[k], cls = (k === cur ? 'cur ' : '') + (k in gmap ? (gmap[k] ? 'okc' : 'bad') : '');
        return '<td class="' + cls + '">' + (v ? (v.nr ? 'yok' : v.L) : '·') + '</td>';
      }).join('') + '</tr>';
    }); });
    $('#ki-rgrid').innerHTML = h;
  };
  var NOTE_I = {
    ome: 'İki kulakta tip B ve normal kulak yolu hacmi: orta kulakta sıvı. Prob kulağında orta kulak sorunu olduğu için refleksler alınamaz.',
    otoskleroz: 'Tip As (uyum düşük, tepe normal basınçta) ve kaybolmuş refleksler otosklerozun tipik birlikteliğidir.',
    kom: 'Solda düz eğri ama kulak yolu hacmi çok yüksek (4,2 ml): ölçülen hacme orta kulak da katılıyor, yani zar delik. Otoskopi bunu doğrular.',
    noroma: 'Timpanogram normal; ama sağ kulaktan uyaran verilince (sağ ipsi ve sol kontra) refleks yok: uyaran tarafında retrokoklear yol şüphesi.',
    yalanci: 'Refleksler 85–90 dB HL\'de alınıyor; hasta 60 dB\'de bile "duymuyorum" diyor. Refleks eşiği, iddia edilen eşiğin bu kadar yakınında olamaz: organik olmayan kayıp şüphesi.',
    ani: 'Orta kulak normal (tip A). Sol uyaranla refleksler yükselmiş seviyede: koklear kayıpta rekrütman nedeniyle refleks eşiğe yakın kalabilir.',
    meniere: 'Timpanogram normal; sağda eşik ile refleks arasındaki aralığın daralması rekrütmanı (koklear kayıp) düşündürür.'
  };
  $('#ki-eval').onclick = function () {
    var pt = p(); if (!pt) { C.toast('Önce bir hasta seç.'); return; }
    if (!(S.imm.R.tymp && S.imm.R.tymp.done) && !(S.imm.L.tymp && S.imm.L.tymp.done)) { C.toast('Değerlendirmek için en az bir kulakta basıncı tara.'); return; }
    var g = A.gradeImm(pt, S.imm), col = g.puan >= 80 ? 'var(--ok)' : g.puan >= 55 ? 'var(--warn)' : 'var(--bad)';
    var done = ls.get('immDone', {}); done[pt.id] = g.puan; ls.set('immDone', done);
    var rok = g.refl.filter(function (r) { return r.ok; }).length;
    $('#ki-karne').innerHTML = '<div class="karne"><div class="stamp" style="color:' + col + '"><b>' + g.puan + '</b><small>PUAN</small></div><h3>' + X(pt.ad) + ' · immitans karnesi</h3><ul>' +
      g.rows.map(function (r) {
        var T = pt.imm[r.ear];
        return '<li><b>' + EAR[r.ear] + ':</b> ' + (r.oto ? 'otoskopi yapıldı' : '<span style="color:var(--bad)">otoskopi yapılmadı</span>') + ' · tepe ' + ({ dogru: 'doğru', kismi: 'kısmen doğru', yanlis: 'yanlış', eksik: 'işaretlenmedi' })[r.peak] +
          (T.tip === 'B' ? ' (eğri düz, tepe yok)' : ' (' + T.tepe + ' daPa, ' + dec(T.uyum) + ' ml)') + ' · tip ' + (r.tip ? '<b style="color:var(--ok)">doğru</b>' : 'doğrusu <b>' + X(A.TIPK[r.tipT]) + '</b>') + '</li>';
      }).join('') +
      (g.refl.length ? '<li><b>Refleks:</b> ' + rok + ' / ' + g.refl.length + ' hücre doğru (±5 dB ya da "yok").</li>' : '<li>Refleks ölçmedin (isteğe bağlı): puan yalnız timpanometriden.</li>') + '</ul>' +
      (NOTE_I[pt.id] ? '<p style="margin:10px 0 0;font-size:14px;line-height:1.55"><b>Öğretici not:</b> ' + X(NOTE_I[pt.id]) + '</p>' : '') + '</div>';
    paintRGrid(g.refl); $('#ki-eval-n').textContent = 'Son puan: ' + g.puan; C.bridgeSend();
  };
  var paintImm = function () {
    paintImmDev(); paintOto(); paintGraph(); paintImmForm(); paintRGrid();
    var pt = p(); $('#ki-t').textContent = pt ? pt.ad + ', ' + pt.yas + ' · timpanogram' : 'Timpanogram'; $('#ki-c').textContent = 'Prob: ' + EAR[ii.ear].toLocaleLowerCase('tr');
    if (!ii.last) { drawTrace(0); $('#ki-rv').textContent = K.pid ? 'Henüz uyaran verilmedi.' : 'Hasta seç.'; }
  };

  var paintAll = function () { if (S.km === 'konusma') paintKon(); else if (S.km === 'imm') paintImm(); paintCaseBar(); };

  /* =========================== vaka masası bağlantısı =========================== */
  var paintCaseBar = function () {
    var el = $('#kb-case'), cf = S.caseFor;
    if (!cf || !K.pid || cf.pid !== K.pid) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = '<span class="pill warn">VAKA ' + cf.n + '</span><span><b>' + X(cf.title) + '</b> için ölçüyorsun. Kaydettiğin sonuçlar dosyaya geçer.</span><button type="button" class="btn pri" id="kb-back">Vaka dosyasına dön</button>';
    $('#kb-back').onclick = function () { var id = cf.id; S.caseFor = null; paintCaseBar(); C.setTab('vaka'); C.openCase(id); };
  };
  var go = function (pid, mode, caseId) {
    var c = C.caseOf(caseId), pt = A.P[pid]; if (!pt) return;
    C.setTab('kabin');
    if (K.pid !== pid) { K.lv = pt.seviye; C.pick(pid); }
    S.caseFor = c ? { id: c.id, pid: pid, title: c.baslik, n: A.CASES.indexOf(c) + 1 } : null;
    setMode(mode); W.scrollTo(0, 0);
  };
  $('#vk-main').addEventListener('click', function (e) {
    var b = e.target.closest('[data-k2go]'); if (!b) return; var c = C.caseOf(C.caseId()); if (!c || !c.hasta) return;
    go(c.hasta, b.getAttribute('data-k2go'), c.id);
  });
  var tympSummary = function (pid) {
    var im = ls.get('imm.' + pid, { R: {}, L: {}, refl: {} }), any = false;
    var rows = ['R', 'L'].map(function (e) {
      var t = im[e].tymp || {}; if (t.done) any = true;
      return '<tr><td><span class="pill ' + e + '">' + EAR[e] + '</span></td><td>' + (!t.done ? '—' : t.tip ? X(A.TIPK[t.tip]) : 'tip seçilmedi') + '</td><td>' + (!t.done ? '—' : t.nopeak ? 'tepe yok' : t.peak ? (t.peak.p > 0 ? '+' : '') + t.peak.p + ' daPa · ' + dec(t.peak.c) + ' ml' : '—') + '</td><td>' + (t.done ? dec(t.ecv) + ' ml' : '—') + '</td></tr>';
    }).join('');
    return { any: any, html: '<table><tr><th></th><th>Tip</th><th>Tepe</th><th>Hacim</th></tr>' + rows + '</table>', refl: im.refl };
  };
  OL.k2 = {
    mode: function () { return S.km; },
    onPick: function () { load(); if (S.caseFor && S.caseFor.pid !== K.pid) S.caseFor = null; S.k.L = 40; S.k.mask = false; ii.ear = 'R'; $('#k2-karne').innerHTML = ''; $('#ki-karne').innerHTML = ''; $('#k2-eval-n').textContent = ''; $('#ki-eval-n').textContent = ''; paintAll(); },
    key: function (e) {
      var k = e.key;
      if (S.km === 'konusma') {
        if (k === ' ') { e.preventDefault(); $('#k2-go').classList.add('down'); present(); }
        else if (k === 'd' || k === 'D') judge(true); else if (k === 'y' || k === 'Y') judge(false);
        else if (k === 'ArrowUp') { e.preventDefault(); setK({ L: clampL(kk.L + 5) }); } else if (k === 'ArrowDown') { e.preventDefault(); setK({ L: clampL(kk.L - 5) }); }
        else if (k === 's' || k === 'S') setK({ ear: 'R' }); else if (k === 'l' || k === 'L') setK({ ear: 'L' }); else if (k === 'm' || k === 'M') setK({ mask: !kk.mask });
      } else if (S.km === 'imm') { if (k === ' ') { e.preventDefault(); sweep(); } }
    },
    /* vaka raporu: ölçülebilen testlerde öğrencinin kendi ölçümü */
    caseRep: function (c, t, closed) {
      var pid = c.hasta, h = '<h3>' + X(A.TESTS[t].t) + ' · senin ölçümün</h3>', btn = function (m, has) { return closed ? '' : '<div class="vk-act" style="margin-top:8px"><button type="button" class="btn pri" data-k2go="' + m + '">' + (has ? 'Kabinde yeniden ölç' : 'Kabinde ölç') + '</button></div>'; };
      if (t === 'konusma') {
        var kon = ls.get('kon.' + pid, { rec: {} }), r = kon.rec || {}, has = !!(r.R || r.L);
        return h + (has ? '<table><tr><th></th><th>SRT</th><th>SD</th></tr>' + ['R', 'L'].map(function (e) { var s = r[e] && r[e].srt, d = r[e] && r[e].sd; return '<tr><td><span class="pill ' + e + '">' + EAR[e] + '</span></td><td>' + (s ? s.L + ' dB HL' + (s.masked ? ' (M)' : '') : '—') + '</td><td>' + (d ? '%' + d.pct + ' @ ' + d.L + ' dB' + (d.masked ? ' (M)' : '') : '—') + '</td></tr>'; }).join('') + '</table>' : '<p>Bu testi kabinde sen yapacaksın: iki heceli kelimelerle SRT, tek heceli kelimelerle SD.</p>') + btn('konusma', has);
      }
      if (t === 'timpanometri') { var ts = tympSummary(pid); return h + (ts.any ? ts.html : '<p>Otoskopi, prob, basınç taraması: timpanogramı kabinde sen çıkaracaksın.</p>') + btn('imm', ts.any); }
      if (t === 'refleks') {
        var rf = ls.get('imm.' + pid, { refl: {} }).refl || {}, ks = Object.keys(rf);
        return h + (ks.length ? '<table><tr><th>Prob · mod · frekans</th><th>Eşik</th></tr>' + ks.sort().map(function (k) { var a = k.split('.'); return '<tr><td><span class="pill ' + a[0] + '">' + EAR[a[0]] + '</span> ' + (a[1] === 'ipsi' ? 'ipsi' : 'kontra') + ' · ' + a[2] + ' Hz</td><td>' + (rf[k].nr ? 'yok' : rf[k].L + ' dB HL') + '</td></tr>'; }).join('') + '</table>' : '<p>Refleks eşiklerini kabinde, immitans modunda sen ölçeceksin (önce timpanometri).</p>') + btn('imm', ks.length > 0);
      }
      return null;
    },
    olcum: function (c, req) {
      var pt = A.P[c.hasta], o = {}, n = 0; if (!pt) return null;
      req.forEach(function (t) {
        if (A.MEASURABLE.indexOf(t) < 0) return; n++;
        if (t === 'konusma') o[t] = A.gradeSpeech(pt, ls.get('kon.' + pt.id, { rec: {} }).rec, {}).olcum;
        else {
          var im = ls.get('imm.' + pt.id, { R: {}, L: {}, refl: {} });
          if (t === 'timpanometri') o[t] = (im.R.tymp && im.R.tymp.done) || (im.L.tymp && im.L.tymp.done) ? A.gradeImm(pt, { R: im.R, L: im.L }).puan / 100 : 0;
          else { var g = A.gradeImm(pt, im); o[t] = g.refl.length ? g.refl.filter(function (r) { return r.ok; }).length / g.refl.length : 0; }
        }
      });
      return n ? o : null;
    },
    ctx: function () {
      var pt = p(), o = { sel: null, chips: [] }; if (!pt) return o;
      if (S.km === 'konusma') {
        var r = S.kon.rec;
        o.sel = { key: 'kabin.kon.' + pt.id, title: 'Kabin · ' + pt.ad + ', ' + pt.yas + ' · konuşma', la: 'Konuşma odyometrisi', rows: [['Hasta', pt.ozet], ['Kanal', EAR[kk.ear] + ' · ' + (kk.list === 'srt' ? 'iki heceli (SRT)' : 'tek heceli (SD)')], ['Seviye', kk.L + ' dB HL'], ['Maske', kk.mask ? kk.M + ' dB EM (karşı kulak)' : 'kapalı'], ['Kaydedilen', ['R', 'L'].map(function (e) { var x = r[e] || {}; return EAR[e] + ': ' + (x.srt ? 'SRT ' + x.srt.L : 'SRT —') + (x.sd ? ', SD %' + x.sd.pct : ''); }).join(' · ')]],
          about: 'öğrenci konuşma odyometrisinde ' + pt.ad + ' (' + pt.yas + ') adlı kurgusal hastanın ' + (kk.list === 'srt' ? 'konuşmayı alma eşiğini (SRT)' : 'konuşmayı ayırt etme skorunu (SD)') + ' ölçüyor; şu an ' + EAR[kk.ear] + ' kulak, ' + kk.L + ' dB HL. Gerçek değerleri söyleme; yöntemi ve maskeleme kuralını anlat.' };
        o.chips = [['srt', 'SRT nasıl bulunur?'], ['kmask', 'Konuşmada maskeleme gerekir mi?'], ['sd', 'SD skoru nasıl yorumlanır?']];
      } else if (S.km === 'imm') {
        var t = S.imm[ii.ear].tymp || {};
        o.sel = { key: 'kabin.imm.' + pt.id, title: 'Kabin · ' + pt.ad + ', ' + pt.yas + ' · immitans', la: 'Timpanometri ve akustik refleks', rows: [['Hasta', pt.ozet], ['Prob', EAR[ii.ear] + ' kulak'], ['Otoskopi', S.imm[ii.ear].oto ? pt.oto[ii.ear].t : 'yapılmadı'], ['Tarama', t.done ? 'yapıldı, hacim ' + dec(t.ecv) + ' ml' : 'yapılmadı']],
          about: 'öğrenci immitansmetride ' + pt.ad + ' (' + pt.yas + ') adlı kurgusal hastanın ' + EAR[ii.ear] + ' kulağında timpanogram ve akustik refleks ölçüyor. Tipi ve tanıyı doğrudan söyleme; eğriyi nasıl okuyacağını anlat.' };
        o.chips = [['timp', 'Timpanogramı nasıl yorumlarım?'], ['ecv', 'Kulak yolu hacmi neden önemli?'], ['refleks', 'Akustik refleks neyi gösterir?']];
      }
      return o;
    },
    answer: function (kind) {
      var T = {
        srt: 'SRT (konuşmayı alma eşiği): iki heceli, eşit vurgulu kelimelerin %50\'sinin doğru tekrarlandığı en düşük seviye. Kelimeleri önce rahat bir seviyede (SSO + 30 dB) tanıt, 10 dB adımlarla in, kaçırmaya başlayınca 5 dB adımlarla çalış; her seviyede 2–4 kelime ver. SRT, saf ses ortalamasıyla ±10 dB uyumlu olmalı: değilse ya ölçümde hata vardır ya da yalancı (fonksiyonel) kayıp şüphelenilir.',
        sd: 'SD (konuşmayı ayırt etme): tek heceli kelimelerle SRT + 30–40 dB\'de ya da rahat dinleme seviyesinde ölçülen doğru tekrar yüzdesi. 90–100 mükemmel, 78–89 iyi, 66–77 orta, 54–65 zayıf, 54 altı çok zayıf. İletim kaybında yüksek kalır; koklear kayıpta eşiğe göre düşer; eşiklere göre orantısız düşükse ya da seviye artınca düşüyorsa (rollover) retrokoklear patolojiyi düşün.',
        ecv: 'Kulak yolu hacmi (+200 daPa\'da ölçülür) düz (B) bir timpanogramın nedenini ayırır: normal hacim (yetişkinde 0,6–1,5 ml, çocukta 0,4–1,0 ml) orta kulakta sıvı; çok yüksek hacim perforasyon ya da açık ventilasyon tüpü (ölçüme orta kulak boşluğu da katılır); düşük hacim buşon ya da prob ucunun kulak yolu duvarına dayanması. Bu yüzden prob takmadan önce otoskopi yapılır.',
        refleks: 'Akustik (stapes) refleks: yüksek sesle stapedius kası kasılır, uyum azalır (≥0,02 ml). Normal eşik ≈ 70–100 dB HL. Prob kulağında orta kulak sorunu refleksi yok eder; uyaran kulağındaki iletim kaybı eşiği yükseltir; ~50 dB\'ye kadar koklear kayıpta eşik normal kalır (rekrütman); uyaran tarafında retrokoklear patolojide refleks yok ya da çok yüksektir. İpsi = uyaran ve prob aynı kulak, kontra = uyaran öbür kulak.'
      };
      if (T[kind]) return T[kind];
      if (kind === 'kmask' && K.pid) {
        var n = A.other(kk.ear), bb = bcBestMine(n);
        if (bb == null) return 'Konuşmada kulaklar arası azalma ≈ 40 dB. Kural: sunum seviyesi − 40 ≥ öbür kulağın en iyi kemik eşiği ise karşı kulağa gürültü ver. Bunun için önce ' + EAR[n] + ' kulağın kemik eşiklerini saf ses modunda ölç.';
        var need = kk.L - 40 >= bb;
        return 'Şu an ' + kk.L + ' − 40 = ' + (kk.L - 40) + (need ? ' ≥ ' : ' < ') + bb + ' (' + EAR[n] + ' kulağın en iyi kemik eşiği, senin ölçümün). ' + (need ? 'Maskeleme gerekli: karşı kulağa yaklaşık ' + (kk.L - 20) + ' dB EM konuşma gürültüsü ver; yoksa kelimeleri öbür kulak tekrar ettirebilir.' : 'Bu seviyede maskeleme gerekmez.');
      }
      return null;
    },
    classify: function (q) {
      if (S.km === 'konusma') { if (/mask/.test(q)) return 'kmask'; if (/\bsrt\b|alma eşi/.test(q)) return 'srt'; if (/\bsd\b|ayırt|skor|tek heceli|rollover/.test(q)) return 'sd'; }
      if (S.km === 'imm') { if (/hacim|ecv|perfor/.test(q)) return 'ecv'; if (/refleks|stapes/.test(q)) return 'refleks'; if (/timpan|tip [abc]|jerger/.test(q)) return 'timp'; }
      return null;
    },
    _S: S, _go: go
  };

  /* ---------------- başlat ---------------- */
  load();
  var km0 = new URLSearchParams(location.search).get('km');
  setMode(km0 || ls.get('km', 'ton'));
})();
