/* ==========================================================================
   ACADEX ŞİRKET · ortak yardımcılar (labs/sirket/sk-app.js), 29.10.2026
   Çekirdek Acadex Finans'ınki (../finans/fn-app.js; sekmeler, grafik, karne,
   Hesi, Acadia köprüsü). Burada şirket istasyonlarının ortak parçaları:
   kısa sayı biçimleri, çoktan seçmeli mini sınav, CEO Hesi.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, X = C.X, nf = C.nf;
  var SK = FN.sk = {};
  SK.V = window.AXSK; SK.M = window.SKM;
  /* milyon / bin biçimi */
  SK.mn = function (v, n) { return nf(v / 1e6, n == null ? 1 : n) + ' mn'; };
  SK.bin = function (v) { return nf(v, 0); };
  SK.sgn = function (v, f) { f = f || nf; return (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v)); };
  SK.KISA = { kasa: 'Kasa', alacak: 'Alacak', stok: 'Stok', makine: 'Makine', satici: 'Satıcı borcu', kredi: 'Kredi', sermaye: 'Sermaye', kar: 'Dönem kârı' };
  /* CEO Hesi: hesap makinesine kravat */
  SK.ceo = function (sz, ekran) {
    return C.hesi(sz, ekran).replace('</svg>', '<path d="M30 40l2 2 2-2-1 9-1 2-1-2z" fill="#C8553D" stroke="#0D1838" stroke-width="1.2" stroke-linejoin="round"/><path d="M27 39.5l5 2.5 5-2.5" fill="none" stroke="#0D1838" stroke-width="1.4"/></svg>');
  };
  SK.tip = function (txt, ekran) { return '<div class="tipbox">' + SK.ceo(52, ekran || 'CEO') + '<p>' + txt + '</p></div>'; };

  /* mini sınav: qs = [{ q, o:[...], a: doğru indeks, n: açıklama }] ; bitince karne */
  SK.quiz = function (box, qs, title, onEnd) {
    var i = 0, ok = 0, res = [];
    var draw = function () {
      if (i >= qs.length) {
        var p = ok / qs.length * 100;
        box.innerHTML = C.karne(p, title + ': ' + ok + ' / ' + qs.length, res.map(function (r) { return [r[0], X(r[1])]; }), p >= 85 ? 'Eline sağlık; konuyu oturtmuşsun.' : 'Yanlışlarını açıklamalarla tekrar oku, sonra yeniden dene.') +
          '<div class="row" style="margin-top:10px"><button type="button" class="btn sm" data-qz-re>baştan</button></div>';
        box.querySelector('[data-qz-re]').onclick = function () { i = 0; ok = 0; res = []; draw(); };
        if (onEnd) onEnd(p);
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
  /* sekme içi alt bölüm seçici (seg) */
  SK.seg = function (box, items, cur, on) {
    box.innerHTML = items.map(function (it) { return '<button type="button" data-sg="' + it[0] + '" aria-pressed="' + (it[0] === cur) + '">' + X(it[1]) + '</button>'; }).join('');
    C.$$('[data-sg]', box).forEach(function (b) { b.onclick = function () { C.$$('[data-sg]', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); on(b.getAttribute('data-sg')); }; });
  };
})();
