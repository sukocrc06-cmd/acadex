/* ==========================================================================
   ACADEX İSTATİSTİK · 28 YILDIZLI YOL VE SINAV PROVASI (labs/istatistik/is-yol.js), 03.11.2026
   AYBÜ BUS201 + BUS202'nin 28 haftası iki takımyıldız: her hafta bir yıldız.
     - yıldız sönük: o haftanın istasyonu hiç açılmadı · yarı parlak: açıldı ·
       parlak: istasyonun kısa sınav karnesi %85 ve üstü · vize/final elmasları: provası %85 ve üstü
     - yıldıza tıkla: haftanın konusu (TR + EN), istasyona git
     - vize / final provası: kapsadığı istasyonların soru bankasından karışık, süreli sınav;
       cevaplar sonda açılır, istasyon istasyon karne ve tekrar önerisi
   Kayıt bu tarayıcıda (acadex.finans.log ve acadex.finans.istat.sinav); ağ isteği yok.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, X = C.X, f = IS.f;
  var root, sel = null, EXq = null;
  var exams = function () { return C.ls.get('istat.sinav', {}) || {}; };
  var state = function (w) {
    if (w.exam) { var e = exams()[w.exam], fin = exams()[w.exam.replace('v', 'f')]; return e && e.best >= 85 ? 'ok' : e ? 'seen' : 'off'; }
    var r = (C.ls.get('log', { tabs: {} }).tabs || {})['istat.' + w.s];
    return r && r.best != null && r.best >= 85 ? 'ok' : r && r.v ? 'seen' : 'off';
  };
  var finState = function (k) { var e = exams()[k]; return e && e.best >= 85 ? 'ok' : e ? 'seen' : 'off'; };
  /* iki dalgalı takımyıldız: üstte BUS201, altta BUS202 */
  var pos = function (i) { var row = i < 14 ? 0 : 1, j = i % 14, x = 60 + j * 62, y = (row ? 300 : 110) + Math.sin(j / 13 * Math.PI * 2 + row * 1.4) * 42; return [x, y]; };
  var star = function (x, y, r) { var p = ''; for (var k = 0; k < 10; k++) { var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; p += (k ? 'L' : 'M') + (x + rr * Math.cos(a)).toFixed(1) + ' ' + (y + rr * Math.sin(a)).toFixed(1); } return p + 'Z'; };
  var mapDraw = function () {
    var W = IS.WEEKS, st = W.map(state), g = '', lit = st.filter(function (s) { return s === 'ok'; }).length;
    for (var i = 0; i < W.length; i++) {
      if (i === 13 || i === 27) continue; var a = pos(i), b = pos(i + 1), on = st[i] === 'ok' && st[i + 1] === 'ok';
      g += '<line class="yl-ln' + (on ? ' on' : '') + '" x1="' + a[0] + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0] + '" y2="' + b[1].toFixed(1) + '"/>';
    }
    g += '<text class="yl-c" x="30" y="40">BUS201 · Statistics for Business I</text><text class="yl-c" x="30" y="230">BUS202 · Statistics for Business II</text>';
    W.forEach(function (w, i) {
      var p = pos(i), s = st[i], cur = sel === i;
      g += '<g class="yl-s ' + s + (cur ? ' cur' : '') + (w.exam ? ' ex' : '') + '" data-i="' + i + '" tabindex="0" role="button" aria-label="' + X(w.c + ' ' + w.w + '. hafta: ' + w.tr) + '" style="--d:' + (i * 0.04).toFixed(2) + 's">' +
        '<circle class="yl-h" cx="' + p[0] + '" cy="' + p[1].toFixed(1) + '" r="20"/>' + (w.exam ? '<path class="yl-st" d="M' + p[0] + ' ' + (p[1] - 13).toFixed(1) + 'l13 13-13 13-13-13z"/>' : '<path class="yl-st" d="' + star(p[0], p[1], 12) + '"/>') +
        '<text class="yl-w" x="' + p[0] + '" y="' + (p[1] + 34).toFixed(1) + '" text-anchor="middle">' + (w.exam ? 'vize' : w.w) + '</text></g>';
    });
    [['b201f', 13], ['b202f', 27]].forEach(function (q) { var p = pos(q[1]), s = finState(q[0]); g += '<g class="yl-s fin ' + s + '" data-f="' + q[0] + '" tabindex="0" role="button" aria-label="' + X(IS.EXAMS[q[0]].t) + '"><circle class="yl-h" cx="' + (p[0] + 52) + '" cy="' + p[1].toFixed(1) + '" r="24"/><path class="yl-st" d="' + star(p[0] + 52, p[1], 19) + '"/><text class="yl-w" x="' + (p[0] + 52) + '" y="' + (p[1] + 40).toFixed(1) + '" text-anchor="middle">final</text></g>'; });
    C.$('[data-map]', root).innerHTML = '<svg class="yl-svg" viewBox="0 0 990 400" role="img" aria-label="28 haftalık yol haritası">' + g + '</svg>';
    var c201 = st.slice(0, 14).filter(function (s) { return s === 'ok'; }).length, c202 = st.slice(14).filter(function (s) { return s === 'ok'; }).length;
    C.$('[data-yk]', root).innerHTML = '<div class="kpi hl"><small>yanan yıldız</small><b>' + lit + ' / 28</b></div><div class="kpi"><small>BUS201</small><b>' + c201 + ' / 14</b></div><div class="kpi"><small>BUS202</small><b>' + c202 + ' / 14</b></div><div class="kpi"><small>açılan istasyon</small><b>' + st.filter(function (s) { return s !== 'off'; }).length + ' hafta</b></div>';
    C.$$('.yl-s', root).forEach(function (el) {
      var go = function () { if (el.hasAttribute('data-f')) { startExam(el.getAttribute('data-f')); return; } sel = +el.getAttribute('data-i'); mapDraw(); detail(); };
      el.addEventListener('click', go); el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  };
  var detail = function () {
    var box = C.$('[data-det]', root); if (sel == null) { box.innerHTML = '<p class="sub">Bir yıldıza tıkla: o haftanın konusu ve çalışacağın istasyon burada açılır.</p>'; return; }
    var w = IS.WEEKS[sel], s = state(w), r = (C.ls.get('log', { tabs: {} }).tabs || {})['istat.' + w.s];
    box.innerHTML = '<span class="k">' + X(w.c) + ' · ' + w.w + '. hafta</span><h3 style="margin:4px 0 2px">' + X(w.tr) + '</h3><p class="en" style="margin:0 0 10px">' + X(w.en) + '</p>' +
      (w.exam ? '<p class="sub">Vize haftası: ilk 8 haftanın karışık provası.</p><button type="button" class="btn pri" data-ex="' + w.exam + '">' + X(IS.EXAMS[w.exam].t) + ' başlat</button>'
        : '<p class="sub">İstasyon: <b>' + X(FN.NAMES[w.s]) + '</b> · durum: ' + (s === 'ok' ? '<span class="pill ok">yıldız yandı · %' + r.best + '</span>' : s === 'seen' ? '<span class="pill warn">açıldı' + (r && r.best != null ? ' · en iyi %' + r.best : '') + '</span>' : '<span class="pill">henüz açılmadı</span>') + '</p><button type="button" class="btn pri" data-go="' + w.s + '">istasyona git →</button>' + (s !== 'ok' ? '<p class="lbl" style="margin-top:8px">Yıldızı yakmak için istasyonun kısa sınavından %85 ve üstü al.</p>' : ''));
    var g = box.querySelector('[data-go]'); if (g) g.onclick = function () { C.setTab(g.getAttribute('data-go')); try { window.scrollTo({ top: 0 }); } catch (e) {} };
    var x = box.querySelector('[data-ex]'); if (x) x.onclick = function () { startExam(x.getAttribute('data-ex')); };
  };

  /* ---------- sınav provası ---------- */
  var startExam = function (k) {
    var E = IS.EXAMS[k], pool = [];
    E.s.forEach(function (s) { (IS.bank[s] || []).forEach(function (q) { pool.push({ q: q, s: s }); }); });
    pool = C.shuffle(pool).slice(0, Math.min(15, pool.length));
    EXq = { k: k, list: pool.map(function (it) { var ord = C.shuffle(it.q.o.map(function (_, i) { return i; })); return { s: it.s, q: it.q.q, n: it.q.n, o: ord.map(function (i) { return it.q.o[i]; }), a: ord.indexOf(it.q.a), pick: null }; }), i: 0, t0: Date.now(), lim: pool.length * 75, timer: 0 };
    clearInterval(EXq.timer); EXq.timer = setInterval(tick, 1000);
    exDraw(); var card = C.$('[data-exam]', root); if (card && card.scrollIntoView) try { card.scrollIntoView({ behavior: C.RM ? 'auto' : 'smooth', block: 'start' }); } catch (e) {}
    FN.bridgeSend();
  };
  var tick = function () {
    if (!EXq || EXq.done) return; var left = EXq.lim - Math.floor((Date.now() - EXq.t0) / 1000), el = C.$('[data-tm]', root);
    if (el) { el.textContent = Math.floor(Math.max(0, left) / 60) + ':' + ('0' + Math.max(0, left) % 60).slice(-2); var bar = C.$('[data-tmb]', root); if (bar) bar.style.width = Math.max(0, left / EXq.lim * 100) + '%'; }
    if (left <= 0) { C.toast('süre doldu'); finish(); }
  };
  var exDraw = function () {
    var box = C.$('[data-exam]', root), e = EXq, q = e.list[e.i];
    box.innerHTML = '<div class="ex-h"><b>' + X(IS.EXAMS[e.k].t) + '</b><span class="lbl">soru ' + (e.i + 1) + ' / ' + e.list.length + '</span><span class="ex-tm mono" data-tm></span></div><div class="ex-bar"><i data-tmb></i></div>' +
      '<div class="ex-nav">' + e.list.map(function (x, i) { return '<button type="button" data-qi="' + i + '" class="' + (i === e.i ? 'cur' : '') + (x.pick != null ? ' done' : '') + '" aria-label="soru ' + (i + 1) + '">' + (i + 1) + '</button>'; }).join('') + '</div>' +
      '<div class="q ex-q"><span class="pill">' + X(FN.NAMES[q.s]) + '</span><p>' + q.q + '</p><div class="opts">' + q.o.map(function (o, i) { return '<button type="button" data-o="' + i + '"' + (q.pick === i ? ' class="sel"' : '') + '>' + X(o) + '</button>'; }).join('') + '</div></div>' +
      '<div class="row" style="margin-top:12px"><button type="button" class="btn sm" data-prev' + (e.i ? '' : ' disabled') + '>önceki</button><button type="button" class="btn sm" data-next' + (e.i < e.list.length - 1 ? '' : ' disabled') + '>sonraki</button><button type="button" class="btn sm pri" data-fin>sınavı bitir</button><button type="button" class="btn sm" data-quit>vazgeç</button></div>';
    tick();
    C.$$('[data-o]', box).forEach(function (b) { b.onclick = function () { q.pick = +b.getAttribute('data-o'); if (e.i < e.list.length - 1) { e.i++; } exDraw(); }; });
    C.$$('[data-qi]', box).forEach(function (b) { b.onclick = function () { e.i = +b.getAttribute('data-qi'); exDraw(); }; });
    box.querySelector('[data-prev]').onclick = function () { e.i--; exDraw(); };
    box.querySelector('[data-next]').onclick = function () { e.i++; exDraw(); };
    box.querySelector('[data-fin]').onclick = function () { var empty = e.list.filter(function (x) { return x.pick == null; }).length; if (empty && !box.querySelector('[data-fin]').dataset.sure) { box.querySelector('[data-fin]').dataset.sure = 1; box.querySelector('[data-fin]').textContent = empty + ' boş soru var · yine de bitir'; return; } finish(); };
    box.querySelector('[data-quit]').onclick = function () { clearInterval(e.timer); EXq = null; examIdle(); };
  };
  var finish = function () {
    var e = EXq; if (!e || e.done) return; e.done = true; clearInterval(e.timer);
    var ok = e.list.filter(function (x) { return x.pick === x.a; }).length, p = ok / e.list.length * 100, by = {};
    e.list.forEach(function (x) { var b = by[x.s] = by[x.s] || [0, 0]; b[1]++; if (x.pick === x.a) b[0]++; });
    var all = exams(), r = all[e.k] || { best: 0, n: 0 }; r.best = Math.max(r.best || 0, Math.round(p)); r.last = Math.round(p); r.n = (r.n || 0) + 1; r.at = Date.now(); all[e.k] = r; C.ls.set('istat.sinav', all);
    var sec = Math.round((Date.now() - e.t0) / 1000), weak = Object.keys(by).filter(function (s) { return by[s][0] / by[s][1] < 0.7; });
    C.$('[data-exam]', root).innerHTML = C.karne(p, IS.EXAMS[e.k].t + ': ' + ok + ' / ' + e.list.length, Object.keys(by).map(function (s) { return [by[s][0] / by[s][1] >= 0.7, X(FN.NAMES[s]) + ': ' + by[s][0] + ' / ' + by[s][1]]; }), 'Süre: ' + Math.floor(sec / 60) + ' dk ' + (sec % 60) + ' sn. ' + (weak.length ? 'Tekrar önerisi: ' + weak.map(function (s) { return '<button type="button" class="btn sm" data-go="' + s + '">' + X(FN.NAMES[s]) + ' →</button>'; }).join(' ') : 'Bütün konularda sağlamsın.')) +
      '<details class="ex-rev"><summary>cevapları ve açıklamaları gör</summary><ol>' + e.list.map(function (x) { return '<li class="' + (x.pick === x.a ? 'ok' : 'no') + '"><p>' + x.q + '</p><p class="lbl">doğru: <b>' + X(x.o[x.a]) + '</b>' + (x.pick != null && x.pick !== x.a ? ' · senin cevabın: ' + X(x.o[x.pick]) : x.pick == null ? ' · boş' : '') + '</p><p class="lbl">' + x.n + '</p></li>'; }).join('') + '</ol></details>' +
      '<div class="row" style="margin-top:10px"><button type="button" class="btn sm pri" data-again>yeni sorularla tekrar</button><button type="button" class="btn sm" data-back>sınav listesine dön</button></div>';
    var box = C.$('[data-exam]', root);
    C.$$('[data-go]', box).forEach(function (b) { b.onclick = function () { C.setTab(b.getAttribute('data-go')); try { window.scrollTo({ top: 0 }); } catch (er) {} }; });
    box.querySelector('[data-again]').onclick = function () { startExam(e.k); };
    box.querySelector('[data-back]').onclick = function () { EXq = null; examIdle(); };
    mapDraw(); FN.bridgeSend();
  };
  var examIdle = function () {
    var all = exams();
    C.$('[data-exam]', root).innerHTML = '<h2>Vize / final provası</h2><p class="sub">Kapsadığı istasyonların sorularından karışık, en fazla 15 soru; soru başına 75 saniye. Cevaplar sınav bitince açılır.</p><div class="ex-list">' + Object.keys(IS.EXAMS).map(function (k) {
      var E = IS.EXAMS[k], r = all[k], n = E.s.reduce(function (a, s) { return a + (IS.bank[s] || []).length; }, 0);
      return '<button type="button" class="ex-card" data-ex="' + k + '"><b>' + X(E.t) + '</b><small>' + E.s.map(function (s) { return X(FN.NAMES[s]); }).join(' · ') + '</small><span class="lbl">' + Math.min(15, n) + ' soru · ~' + Math.ceil(Math.min(15, n) * 75 / 60) + ' dk' + (r ? ' · en iyi %' + r.best : '') + '</span></button>';
    }).join('') + '</div>';
    C.$$('[data-ex]', root).forEach(function (b) { if (b.closest('[data-exam]')) b.onclick = function () { startExam(b.getAttribute('data-ex')); }; });
  };

  FN.st.yol = {
    init: function () {
      root = C.$('#yol');
      root.innerHTML = IS.head({ key: 'yol', k: 'AYBÜ BUS201 + BUS202 · temelden zirveye', title: 'Yol haritası', sub: 'İki dönemlik istatistik, 28 haftalık bir gece yolculuğu. Her hafta bir yıldız: istasyonun kısa sınavından %85 ve üstü alınca yanar. Vize ve final elmaslarını sınav provası yakar.' }) +
        '<div class="grid gside"><div class="card box" style="--cc:#FFD86B"><div data-det></div><div class="kpis" data-yk></div><button type="button" class="btn sm" data-sheet="' + ['grafik', 'betimsel', 'indeks', 'olasilik', 'dagilim', 'galton', 'guven', 'hipotez', 'ikili', 'kikare', 'regresyon', 'coklu', 'bolum'].join(',') + '">bütün formül kartlarını yazdır</button></div>' +
        '<div class="card box" style="--cc:#FFD86B"><div class="stage" data-map></div><div class="leg"><span><i style="background:#3A4C86"></i>henüz açılmadı</span><span><i style="background:#9DB8FF"></i>istasyon açıldı</span><span><i style="background:#FFD86B"></i>karne %85+, yıldız yandı</span><span><i style="background:#FF8A7A;transform:rotate(45deg)"></i>vize / final</span></div></div></div>' +
        '<div class="card box" style="--cc:#FF8A7A;margin-top:18px" data-exam></div>';
      mapDraw(); detail(); examIdle();
    },
    show: function () { if (root && !EXq) { mapDraw(); detail(); } },
    hide: function () { },
    ctx: function () {
      var st = IS.WEEKS.map(state);
      return IS.ctx('yol', 'yol haritası', [['yanan yıldız', st.filter(function (s) { return s === 'ok'; }).length + ' / 28'], ['sınav', EXq ? IS.EXAMS[EXq.k].t : 'yok']], 'öğrenci AYBÜ BUS201/BUS202 haftalık yol haritasına bakıyor' + (EXq && !EXq.done ? '; şu an sınav provasında, cevap verme' : '') + '.', ['Bu hafta neye çalışmalıyım?', 'Vizeye nasıl hazırlanayım?']);
    }
  };
})();
