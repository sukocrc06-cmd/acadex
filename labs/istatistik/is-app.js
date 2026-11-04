/* ==========================================================================
   ACADEX İSTATİSTİK · ortak parçalar (labs/istatistik/is-app.js), 03.11.2026
   Çekirdek Acadex Finans'ınki (../finans/fn-app.js: sekmeler, grafik, karne, Hesi,
   Acadia köprüsü, liman defteri). Burada istatistik istasyonlarının ortakları:
     - takımyıldızlı bölüm başlığı ve "hangi hafta" çipleri
     - Excel / R kutusu (Türkçe Excel formülü ↔ R kodu, kopyala)
     - çoktan seçmeli mini sınav (bitince karne → liman defterine işlenir)
     - SVG içinde imleç → veri koordinatı (sürükleme)
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, X = C.X, nf = C.nf;
  var IS = FN.is = FN.is || {};
  IS.M = window.ISM;
  IS.f = function (v, n) { return nf(v, n == null ? 2 : n); };
  IS.p = function (v) { return v < 0.0001 ? '< 0,0001' : nf(v, 4); };

  /* takımyıldız: başlığa göre sabit, her açılışta aynı */
  var cons = function (seed) {
    var r = IS.M.seeded(seed), pts = [], s = '';
    for (var i = 0; i < 6; i++) pts.push([14 + i * 34 + r() * 14, 14 + r() * 68]);
    for (var j = 0; j < pts.length - 1; j++) s += '<line x1="' + pts[j][0].toFixed(1) + '" y1="' + pts[j][1].toFixed(1) + '" x2="' + pts[j + 1][0].toFixed(1) + '" y2="' + pts[j + 1][1].toFixed(1) + '" style="animation-delay:' + (j * 0.2) + 's"/>';
    pts.forEach(function (p, k) { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (k % 3 ? 2.4 : 3.4) + '" style="--d:' + (k * 0.4) + 's"/>'; });
    return '<svg class="ob-cons" viewBox="0 0 200 96" aria-hidden="true">' + s + '</svg>';
  };
  /* başlık: o.key verilirse haftalar AYBÜ BUS201/202 planından (is-terim.js), İngilizce ad,
     formül kartı düğmesi ve İngilizce terim sözlüğü eklenir */
  IS.head = function (o) {
    var seed = 0; for (var i = 0; i < o.title.length; i++) seed = seed * 31 + o.title.charCodeAt(i) | 0;
    var wk = o.key && IS.WEEKS ? IS.WEEKS.filter(function (w) { return w.s === o.key; }).map(function (w) { return w.c + ' · ' + w.w + '. hafta: ' + w.tr.toLocaleLowerCase('tr'); }) : [];
    if (!wk.length) wk = o.weeks || [];
    var gl = o.key && IS.GLOSS && IS.GLOSS[o.key], en = o.key && IS.EN && IS.EN[o.key];
    return '<header class="ob-head"><div><span class="k">' + X(o.k) + '</span><h1>' + X(o.title) + (en ? ' <span class="ob-en">' + X(en) + '</span>' : '') + '</h1><p>' + o.sub + '</p>' +
      '<div class="ob-wk">' + wk.map(function (w) { return '<span>' + X(w) + '</span>'; }).join('') + '</div>' +
      (o.key ? '<div class="ob-tools">' + (IS.SHEET && IS.SHEET[o.key] ? '<button type="button" class="ob-tb" data-sheet="' + o.key + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/></svg>formül kartı</button>' : '') +
        (gl ? '<details class="ob-gl"><summary>İngilizce terimler · ' + gl.length + '</summary><dl>' + gl.map(function (g) { return '<div><dt>' + X(g[0]) + '</dt><dd>' + X(g[1]) + (g[2] ? '<small>' + X(g[2]) + '</small>' : '') + '</dd></div>'; }).join('') + '</dl></details>' : '') + '</div>' : '') +
      '</div>' + cons(seed) + '</header>';
  };
  /* terim çifti: "medyan (median)" */
  IS.en = function (tr, en) { return X(tr) + ' <span class="en">' + X(en) + '</span>'; };
  /* soru bankası: istasyonlar yüklenirken sorularını bırakır; sınav provası buradan çeker */
  IS.bank = {};

  /* ---------- adım adım çözüm ----------
     steps = [{ t: 'adım adı', f: 'formül (html, sayılar <b>…</b> içinde)', r: 'sonuç' }]
     "sonraki adım" bir satır açar; sayılar sırayla yerine oturur. */
  IS.steps = function (box, steps, title) {
    /* ilerleme kutuda saklanır: sürgü oynayınca çözüm yeniden çizilir ama kaldığın adım korunur */
    steps = steps.map(function (s) { return { t: s.t, r: s.r, f: s.f != null ? s.f : X(s.x).replace(/(−?\d[\d.,]*)/g, '<b>$1</b>') }; });
    var n = Math.min(box.__stp || 0, steps.length);
    var draw = function (anim) {
      box.__stp = n;
      box.innerHTML = '<div class="stp"><div class="stp-h"><b>' + X(title || 'adım adım çözüm') + '</b><span class="lbl">' + n + ' / ' + steps.length + '</span></div><ol>' +
        steps.slice(0, n).map(function (s, i) { return '<li class="' + (anim && i === n - 1 ? 'in' : '') + '"><span class="stp-t">' + X(s.t) + '</span><span class="stp-f">' + s.f.replace(/<b>/g, '<b class="stp-n" style="--k:VAR">').replace(/VAR/g, function () { return (Math.random() * 0.3 + 0.15).toFixed(2) + 's'; }) + '</span>' + (s.r ? '<span class="stp-r">= ' + s.r + '</span>' : '') + '</li>'; }).join('') + '</ol>' +
        '<div class="row"><button type="button" class="btn sm pri" data-sn' + (n >= steps.length ? ' disabled' : '') + '>' + (n ? 'sonraki adım' : 'çözüme başla') + '</button><button type="button" class="btn sm" data-sa' + (n >= steps.length ? ' disabled' : '') + '>hepsini göster</button>' + (n ? '<button type="button" class="btn sm" data-s0>baştan</button>' : '') + '</div></div>';
      var b = box.querySelector('[data-sn]'); b.onclick = function () { n++; draw(true); var nb = box.querySelector('[data-sn]'); if (nb && !nb.disabled) nb.focus(); };
      box.querySelector('[data-sa]').onclick = function () { n = steps.length; draw(false); };
      var z = box.querySelector('[data-s0]'); if (z) z.onclick = function () { n = 0; draw(false); };
    };
    draw(false);
  };

  /* ---------- formül kartı yazdırma ---------- */
  IS.print = function (keys) {
    var old = document.querySelector('.sheet-print'); if (old) old.remove();
    var el = document.createElement('div'); el.className = 'sheet-print';
    el.innerHTML = '<h1>Acadex İstatistik · formül kartı</h1><p class="sp-sub">AYBÜ BUS201 / BUS202 · Excel (Türkçe) ve R karşılıklarıyla</p>' + keys.map(function (k) {
      var rows = (IS.SHEET || {})[k] || []; if (!rows.length) return '';
      return '<section><h2>' + X((FN.NAMES || {})[k] || k) + ' <small>' + X((IS.EN || {})[k] || '') + '</small></h2><table><thead><tr><th>ölçü</th><th>formül</th><th>Excel</th><th>R</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td>' + X(r[0]) + '</td><td class="m">' + X(r[1]) + '</td><td class="m">' + X(r[2]) + '</td><td class="m">' + X(r[3]) + '</td></tr>'; }).join('') + '</tbody></table></section>';
    }).join('');
    document.body.appendChild(el); document.body.classList.add('printing');
    var done = function () { document.body.classList.remove('printing'); el.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    try { window.print(); } catch (e) { done(); }
  };
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-sheet]'); if (b) IS.print(b.getAttribute('data-sheet').split(',')); });
  IS.tip = function (txt, ekran) { return C.tip(txt, ekran || 'σ'); };

  /* Excel / R kutusu: rows = { x: [[formül, not]], r: [[kod, not]] } */
  IS.code = function (rows, title) {
    var li = function (a, k) { return '<ul data-cl="' + k + '"' + (k === 'r' ? ' hidden' : '') + '>' + a.map(function (q) { return '<li><code>' + X(String(q[0]).replace(/−/g, '-')) + '</code><button type="button" class="cp" data-cp>kopyala</button>' + (q[1] ? '<small>' + X(q[1]) + '</small>' : '') + '</li>'; }).join('') + '</ul>'; };
    return '<div class="code"><div class="code-h"><b>' + X(title || 'bilgisayarda') + '</b><button type="button" data-cx="x" aria-pressed="true">Excel</button><button type="button" data-cx="r" aria-pressed="false">R</button></div>' + li(rows.x, 'x') + li(rows.r, 'r') + '</div>';
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-cx],[data-cp]'); if (!t) return;
    var box = t.closest('.code'); if (!box) return;
    if (t.hasAttribute('data-cx')) {
      var k = t.getAttribute('data-cx');
      C.$$('[data-cx]', box).forEach(function (b) { b.setAttribute('aria-pressed', String(b === t)); });
      C.$$('[data-cl]', box).forEach(function (u) { u.hidden = u.getAttribute('data-cl') !== k; });
      return;
    }
    var txt = t.parentNode.querySelector('code').textContent, done = function () { C.toast('kopyalandı: ' + txt.slice(0, 40)); };
    try { navigator.clipboard.writeText(txt).then(done, done); } catch (er) { done(); }
  });

  /* mini sınav: qs = [{ q, o:[...], a: doğru indeks, n: açıklama }] */
  IS.quiz = function (box, qs, title) {
    var i = 0, ok = 0, res = [];
    var draw = function () {
      if (i >= qs.length) {
        var p = ok / qs.length * 100;
        box.innerHTML = C.karne(p, title + ': ' + ok + ' / ' + qs.length, res.map(function (r) { return [r[0], X(r[1])]; }), p >= 85 ? 'Gökyüzü berrak; konuyu oturtmuşsun.' : 'Yanlışlarının açıklamalarını oku, istasyonda bir kez daha oyna, sonra yeniden dene.') +
          '<div class="row" style="margin-top:10px"><button type="button" class="btn sm" data-qz-re>baştan</button></div>';
        box.querySelector('[data-qz-re]').onclick = function () { i = 0; ok = 0; res = []; draw(); };
        return;
      }
      var q0 = qs[i], n = q0.o.length, sh = (i * 2 + 1) % n, ord = q0.o.map(function (_, k) { return (k + sh) % n; });
      var q = { q: q0.q, n: q0.n, o: ord.map(function (k) { return q0.o[k]; }), a: ord.indexOf(q0.a) };
      box.innerHTML = '<div class="prog"><i style="width:' + (i / qs.length * 100) + '%"></i></div><div class="q"><p>' + (i + 1) + '. ' + q.q + '</p><div class="opts">' +
        q.o.map(function (o, k) { return '<button type="button" data-k="' + k + '">' + X(o) + '</button>'; }).join('') + '</div><div class="fb" aria-live="polite"></div></div>';
      C.$$('[data-k]', box).forEach(function (b) {
        b.onclick = function () {
          var k = +b.getAttribute('data-k'), good = k === q.a;
          C.$$('[data-k]', box).forEach(function (x) { x.disabled = true; if (+x.getAttribute('data-k') === q.a) x.classList.add('ok'); });
          if (!good) b.classList.add('no');
          if (good) ok++; res.push([good, q.q.replace(/<[^>]+>/g, '')]);
          C.$('.fb', box).innerHTML = (good ? '<b style="color:var(--ok)">Doğru.</b> ' : '<b style="color:var(--bad)">Olmadı.</b> ') + q.n +
            ' <button type="button" class="btn sm" data-nx style="margin-left:6px">' + (i + 1 < qs.length ? 'sonraki' : 'karneyi gör') + '</button>';
          C.$('[data-nx]', box).onclick = function () { i++; draw(); };
          C.$('[data-nx]', box).focus();
        };
      });
    };
    draw();
  };
  IS.quizCard = function (title) { return '<div class="card box" style="--cc:var(--star)"><h2>Kısa sınav</h2><p class="sub">Kısa sorular; %85 ve üstü karne liman defterinde onaylanır ve yol haritasında yıldızı yakar.</p><div data-quiz></div></div>'; };
  IS.seg = function (box, items, cur, on) {
    box.innerHTML = items.map(function (it) { return '<button type="button" data-sg="' + it[0] + '" aria-pressed="' + (it[0] === cur) + '">' + X(it[1]) + '</button>'; }).join('');
    C.$$('[data-sg]', box).forEach(function (b) { b.onclick = function () { C.$$('[data-sg]', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); on(b.getAttribute('data-sg')); }; });
  };
  /* SVG içinde imleç konumu (viewBox birimi) */
  IS.pt = function (svg, e) {
    var p = svg.createSVGPoint(), t = e.touches ? e.touches[0] : e; p.x = t.clientX; p.y = t.clientY;
    var m = svg.getScreenCTM(); return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };
  /* sürükleme: el = SVG, pick(e) → hedef ya da null, move(hedef, nokta), end() */
  IS.drag = function (svg, pick, move, end) {
    var cur = null;
    svg.addEventListener('pointerdown', function (e) { cur = pick(e); if (!cur) return; e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch (er) {} });
    svg.addEventListener('pointermove', function (e) { if (!cur) return; move(cur, IS.pt(svg, e)); });
    var up = function () { if (!cur) return; cur = null; if (end) end(); };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  };
  /* düz SVG yolu: fonksiyonu [a,b] aralığında örnekle */
  IS.curve = function (f, a, b, n) { var p = []; n = n || 160; for (var i = 0; i <= n; i++) { var x = a + (b - a) * i / n; p.push([x, f(x)]); } return p; };
  /* ölçek: veri → piksel */
  IS.scale = function (d0, d1, r0, r1) { var f = function (v) { return r0 + (v - d0) / (d1 - d0 || 1) * (r1 - r0); }; f.inv = function (p) { return d0 + (p - r0) / (r1 - r0 || 1) * (d1 - d0); }; return f; };
  /* basit Acadia bağlamı */
  IS.ctx = function (key, title, rows, about, chips) { return { sel: { key: 'istat.' + key, title: title, la: 'Acadex İstatistik', rows: rows, about: about }, chips: chips || [] }; };
})();
