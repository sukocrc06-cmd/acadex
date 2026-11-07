/* ==========================================================================
   ACADINGO · masa kartı (dashboard.html #home-view, .acg-kart), 07.11.2026
   "Şu anki durak": saate göre sıradaki panel (ingilizce/assets/ing.js → simdi ile aynı dilimler),
   bugün biten paneller (acx.ing.bitti / acx.ing.gunluk, ing.js → gunluk ile aynı türetme) ve seri.
   ========================================================================== */
(function () {
  'use strict';
  var D = document;
  var PANEL = [
    { id: 'vocab', ad: 'Vocab', yer: 'kahvaltı', saat: '07:40', c: '#E3A80F' },
    { id: 'listening', ad: 'Listening', yer: 'otobüs', saat: '08:15', c: '#0F8582' },
    { id: 'reading', ad: 'Reading', yer: 'kütüphane', saat: '10:00', c: '#2C7A4B' },
    { id: 'speaking', ad: 'Speaking', yer: 'kafe', saat: '17:00', c: '#DD5A36' },
    { id: 'writing', ad: 'Writing', yer: 'yurt odası', saat: '21:40', c: '#C93B2B' }
  ];
  function al(k, v) { try { var x = localStorage.getItem('acx.ing.' + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } }
  function gunAnahtar(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function gunluk() {
    var g = al('gunluk', {}) || {}, b = al('bitti', {}) || {};
    Object.keys(b).forEach(function (p) { Object.keys(b[p] || {}).forEach(function (id) { var k = gunAnahtar(new Date(b[p][id])); g[k] = g[k] || {}; g[k][p] = 1; }); });
    return g;
  }
  /* saat dilimi → panel sırası (ing.js simdi) */
  function dilim(dk) { return dk < 510 ? 0 : dk < 600 ? 1 : dk < 840 ? 2 : dk < 1140 ? 3 : 4; }
  function seri(g, bugun) {
    var n = 0, d = new Date(bugun);
    if (!g[gunAnahtar(d)]) d.setDate(d.getDate() - 1);
    while (g[gunAnahtar(d)] && n < 400) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function ciz() {
    var el = D.querySelector('[data-acg-kart]'); if (!el) return;
    var simdi = new Date(), dk = simdi.getHours() * 60 + simdi.getMinutes(), g = gunluk(), bugunK = gunAnahtar(simdi), bugun = g[bugunK] || {};
    var i = dilim(dk), n = 0; while (bugun[PANEL[i].id] && n < 5) { i = (i + 1) % 5; n++; }
    var p = PANEL[i], hepsi = n === 5, biten = PANEL.filter(function (x) { return bugun[x.id]; }).length, s = seri(g, simdi);
    var saat = ('0' + simdi.getHours()).slice(-2) + ':' + ('0' + simdi.getMinutes()).slice(-2);
    el.style.setProperty('--ac', p.c);
    el.querySelector('[data-acg-simdi]').innerHTML = hepsi
      ? '<span class="acg-k-mono">şu an ' + saat + '</span><b class="acg-k-ad">Bugünün beş durağı tamam.</b>'
      : '<span class="acg-k-mono">şu an ' + saat + '</span><b class="acg-k-ad">' + p.ad + ' <span>· ' + p.yer + '</span></b>';
    el.querySelector('[data-acg-sekmeler]').innerHTML = PANEL.map(function (x, j) {
      var ok = !!bugun[x.id];
      return '<a class="acg-k-sek' + (ok ? ' ok' : '') + (j === i && !hepsi ? ' sira' : '') + '" href="ingilizce/' + x.id + '.html" style="--c:' + x.c + '" title="' + x.ad + ' · ' + x.yer + (ok ? ' · bugün bitti' : '') + '"><small>' + x.saat + '</small><b>' + x.ad + '</b><i aria-hidden="true">' + (ok ? '✓' : '') + '</i></a>';
    }).join('');
    el.querySelector('[data-acg-ozet]').textContent = biten + '/5 durak bugün' + (s > 1 ? ' · ' + s + ' gün seri' : '');
    var git = el.querySelector('[data-acg-git]'); git.href = hepsi ? 'ingilizce/' : 'ingilizce/' + p.id + '.html';
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', ciz); else ciz();
  D.addEventListener('visibilitychange', function () { if (!D.hidden) ciz(); });
  setInterval(ciz, 60000);
})();
