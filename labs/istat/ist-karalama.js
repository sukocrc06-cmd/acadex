/* ==========================================================================
   ACADEX İSTATİSTİK · karalama kağıdı ve tablo okuma animasyonu (labs/istat/ist-karalama.js), 18.11.2026
   1) Karalama kağıdı: dersteki her soru kartına (haftalık sorular, sınav provası, klasik sınav)
      “✏️ karalama kağıdı” düğmesi eklenir. Kareli kağıt; kalem (3 renk, 2 kalınlık), silgi, geri al,
      temizle, büyüt. Parmak, fare ve kalemle (basınç duyarlı) çizilir; kalem kullanılınca avuç içi
      dokunuşları çizmez. Karalamalar sayfa açık kaldıkça kartın içinde durur (sunucuya gitmez).
   2) IST.tabloOku(kutu, { tip: 'z'|'t'|'c2', z | sd + a }): tablonun ilgili kesiti çizilir; satır ve
      sütun ışığı kayarak kesişen hücreyi bulur.
   3) IST.egriOnizle(kutu, { tur: 'z'|'t', deger, sd, kuyruk: 'sag'|'iki' }): yazılan z / t değerini
      eğride işaretler, kuyruk alanını boyar.
   Önek: kr- (karalama), to- (tablo okuma)
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST; if (!IST || !IST.V) return;
  var V = IST.V, M = IST.M, nf = IST.nf, X = IST.X, W = window, D = W.document || document;
  var SAKIN = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var RENK = [['#0D1838', 'lacivert'], ['#C8553D', 'kırmızı'], ['#2F6FB0', 'mavi']];

  /* =====================================================================
     KARALAMA KAĞIDI
     ===================================================================== */
  var kur = IST.karalama = function (kart) {
    if (!kart || kart.querySelector('.kr')) return;
    var kutu = D.createElement('div'); kutu.className = 'kr';
    kutu.innerHTML = '<button type="button" class="btn sm ghost kr-ac" aria-expanded="false">✏️ karalama kağıdı</button>' +
      '<div class="kr-k" hidden><div class="kr-arac" role="toolbar" aria-label="Karalama araçları">' +
      RENK.map(function (r, i) { return '<button type="button" class="kr-r" data-renk="' + r[0] + '" style="--r:' + r[0] + '" aria-pressed="' + (i === 0) + '" aria-label="' + r[1] + ' kalem"></button>'; }).join('') +
      '<button type="button" class="kr-b" data-kal="2.2" aria-pressed="true" aria-label="ince uç">ince</button><button type="button" class="kr-b" data-kal="5" aria-pressed="false" aria-label="kalın uç">kalın</button>' +
      '<button type="button" class="kr-b" data-sil aria-pressed="false">silgi</button><span class="kr-ara"></span>' +
      '<button type="button" class="kr-b" data-geri aria-label="geri al">↶ geri al</button><button type="button" class="kr-b" data-temiz>temizle</button><button type="button" class="kr-b" data-buyut aria-pressed="false">⤢ büyüt</button></div>' +
      '<canvas class="kr-c" role="img" aria-label="Karalama alanı: parmak, fare ya da kalemle çiz"></canvas><p class="kr-not">Karalamalar puanlanmaz; sayfa açık kaldıkça burada durur.</p></div>';
    kart.appendChild(kutu);
    var ac = kutu.querySelector('.kr-ac'), k = kutu.querySelector('.kr-k'), cv = kutu.querySelector('canvas'), cx = cv.getContext('2d');
    var S = { cizgi: [], renk: RENK[0][0], kal: 2.2, sil: false, kalemVar: false, cur: null, h: 240 };
    var boyut = function () {
      var w = Math.max(200, cv.parentNode.clientWidth), dpr = Math.min(3, W.devicePixelRatio || 1);
      cv.style.height = S.h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(S.h * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0); ciz();
    };
    var cizgiCiz = function (c) {
      if (c.p.length < 1) return;
      cx.globalCompositeOperation = c.sil ? 'destination-out' : 'source-over';
      cx.strokeStyle = c.renk; cx.lineCap = 'round'; cx.lineJoin = 'round';
      var p = c.p;
      if (p.length === 1) { cx.beginPath(); cx.fillStyle = c.renk; cx.arc(p[0][0], p[0][1], c.kal * (c.sil ? 3 : 0.6) * (p[0][2] || 1), 0, 7); cx.fill(); return; }
      for (var i = 1; i < p.length; i++) {
        var a = p[i - 1], b = p[i], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        cx.lineWidth = c.kal * (c.sil ? 4 : 1) * (0.55 + 0.9 * ((a[2] + b[2]) / 2 || 0.5));
        cx.beginPath(); cx.moveTo(i === 1 ? a[0] : (p[i - 2][0] + a[0]) / 2, i === 1 ? a[1] : (p[i - 2][1] + a[1]) / 2); cx.quadraticCurveTo(a[0], a[1], m[0], m[1]); cx.stroke();
      }
    };
    var ciz = function () { cx.clearRect(0, 0, cv.width, cv.height); S.cizgi.forEach(cizgiCiz); cx.globalCompositeOperation = 'source-over'; };
    var nokta = function (e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5]; };
    cv.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'pen') S.kalemVar = true;
      if (e.pointerType === 'touch' && S.kalemVar) return;   /* avuç içi */
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (er) { }
      S.cur = { renk: S.renk, kal: S.kal, sil: S.sil, p: [nokta(e)], id: e.pointerId }; S.cizgi.push(S.cur); cizgiCiz(S.cur);
    });
    cv.addEventListener('pointermove', function (e) {
      if (!S.cur || e.pointerId !== S.cur.id) return;
      var ev = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!ev.length) ev = [e];
      ev.forEach(function (x) { S.cur.p.push(nokta(x)); });
      ciz();
    });
    var bitir = function (e) { if (S.cur && (!e || e.pointerId === S.cur.id)) { S.cur = null; ciz(); } };
    cv.addEventListener('pointerup', bitir); cv.addEventListener('pointercancel', bitir);
    ac.onclick = function () {
      var acik = k.hidden; k.hidden = !acik; ac.setAttribute('aria-expanded', String(acik)); ac.textContent = acik ? '✏️ karalama kağıdını gizle' : '✏️ karalama kağıdı';
      if (acik) boyut();
    };
    kutu.querySelector('.kr-arac').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-renk')) { S.renk = b.getAttribute('data-renk'); S.sil = false; kutu.querySelectorAll('[data-renk]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); kutu.querySelector('[data-sil]').setAttribute('aria-pressed', 'false'); }
      else if (b.hasAttribute('data-kal')) { S.kal = +b.getAttribute('data-kal'); kutu.querySelectorAll('[data-kal]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }
      else if (b.hasAttribute('data-sil')) { S.sil = !S.sil; b.setAttribute('aria-pressed', String(S.sil)); }
      else if (b.hasAttribute('data-geri')) { S.cizgi.pop(); ciz(); }
      else if (b.hasAttribute('data-temiz')) { if (S.cizgi.length && !lsafe(function () { return W.confirm('Karalama kağıdı temizlensin mi?'); }, true)) return; S.cizgi = []; ciz(); }
      else if (b.hasAttribute('data-buyut')) { var on = S.h < 400; S.h = on ? 480 : 240; b.setAttribute('aria-pressed', String(on)); boyut(); }
    });
    if (W.ResizeObserver) new ResizeObserver(function () { if (!k.hidden) boyut(); }).observe(kutu);
    kart.karalama = S;
  };
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  /* her soru kartına otomatik: haftalık sorular (.q), sınav provası (.q), klasik sınav (.ks-q) */
  var tara = function (kok) { (kok || D).querySelectorAll('.is-sor .q, .is-prova .q, .ks-q').forEach(function (el) { if (!el.querySelector('.kr')) kur(el); }); };
  if (D && D.addEventListener) {
    var basla = function () {
      var main = D.getElementById('main'); if (!main) return;
      var t = 0; new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { tara(main); }, 60); }).observe(main, { childList: true, subtree: true });
      tara(main);
    };
    if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', basla); else basla();
  }

  /* =====================================================================
     TABLO OKUMA ANİMASYONU
     ===================================================================== */
  var sutA = { t: [0.10, 0.05, 0.025, 0.01, 0.005], c2: [0.10, 0.05, 0.025, 0.01] };
  IST.tabloOku = function (kutu, o) {
    var satir = [], sutun = [], hedef = null, bas, deger, not;
    if (o.tip === 'z') {
      var z = Math.round(Math.abs(o.z) * 100) / 100, r = Math.floor(z * 10 + 1e-9) / 10, c = Math.round((z - r) * 100);
      for (var i = Math.max(0, r - 0.2); i <= Math.min(3.4, r + 0.2) + 1e-9; i += 0.1) satir.push(Math.round(i * 10) / 10);
      sutun = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; hedef = [satir.indexOf(r), c]; bas = ['z', sutun.map(function (x) { return ',0' + x; })];
      deger = function (ri, ci) { return nf(M.ztab(satir[ri] + sutun[ci] / 100), 4, false); };
      not = 'z = ' + nf(z, 2) + ' → satır ' + nf(r, 1) + ' (ilk ondalık), sütun ,0' + c + ' (ikinci ondalık) → P(0 < Z < ' + nf(z, 2) + ') = ' + nf(M.ztab(z), 4, false);
    } else {
      var L = sutA[o.tip], sd = o.sd, ai = L.indexOf(o.a); if (ai < 0) ai = 1;
      for (var s = Math.max(1, sd - 2); s <= Math.min(30, sd + 2); s++) satir.push(s);
      sutun = L; hedef = [satir.indexOf(sd), ai]; bas = ['sd', L.map(function (a) { return (o.tip === 't' ? 't' : 'χ²') + ' ' + nf(a, 3); })];
      var kr = o.tip === 't' ? M.tkr : M.c2kr;
      deger = function (ri, ci) { return nf(kr(sutun[ci], satir[ri]), 3, false); };
      not = 'sd = ' + sd + ' satırı, α = ' + nf(L[ai], 3) + ' sütunu → ' + (o.tip === 't' ? 't' : 'χ²') + ' = ' + nf(kr(L[ai], sd), 3, false);
    }
    kutu.innerHTML = '<div class="to"><table class="tb to-t"><thead><tr><th>' + bas[0] + '</th>' + bas[1].map(function (b, j) { return '<th data-c="' + j + '">' + b + '</th>'; }).join('') + '</tr></thead><tbody>' +
      satir.map(function (r, ri) { return '<tr data-r="' + ri + '"><th>' + (o.tip === 'z' ? nf(r, 1, false) : r) + '</th>' + sutun.map(function (_, ci) { return '<td data-c="' + ci + '">' + deger(ri, ci) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table><p class="to-n" aria-live="polite"></p></div>';
    var t = kutu.querySelector('table'), n = kutu.querySelector('.to-n'), adim = function (k) {
      if (k >= 1) t.querySelector('tr[data-r="' + hedef[0] + '"]').classList.add('to-s');
      if (k >= 2) t.querySelectorAll('[data-c="' + hedef[1] + '"]').forEach(function (x) { x.classList.add('to-k'); });
      if (k >= 3) { t.querySelector('tr[data-r="' + hedef[0] + '"] td[data-c="' + hedef[1] + '"]').classList.add('to-h'); n.textContent = not; }
    };
    if (SAKIN || o.hemen) { adim(3); return; }
    [0, 1, 2, 3].forEach(function (k) { setTimeout(function () { if (kutu.contains(t)) adim(k); }, 200 + k * 700); });
  };

  /* =====================================================================
     EĞRİ ÖNİZLEMESİ: yazılan z / t değeri
     ===================================================================== */
  IST.egriOnizle = function (kutu, o) {
    var v = o.deger;
    if (v == null || !isFinite(v)) { kutu.innerHTML = '<p class="to-n">' + (o.tur === 't' ? 't' : 'z') + ' değerini yazınca eğride gösterilir.</p>'; return; }
    var f = o.tur === 't' ? function (x) { return M.tpdf(x, o.sd); } : function (x) { return M.npdf(x, 0, 1); };
    var x = Math.max(-4, Math.min(4, v)), sh = o.kuyruk === 'iki' ? [[-4.2, -Math.abs(x)], [Math.abs(x), 4.2]] : [[x, 4.2]];
    var alan = o.tur === 't' ? (o.kuyruk === 'iki' ? 2 * (1 - M.tcdf(Math.abs(x), o.sd)) : 1 - M.tcdf(x, o.sd)) : (o.kuyruk === 'iki' ? 2 * (1 - M.Phi(Math.abs(x))) : 1 - M.Phi(x));
    kutu.innerHTML = V.curve({ f: f, a: -4.2, b: 4.2, ymax: 0.45, sh: sh, h: 150, d: -3, extra: function (xs, ys, y0) { var px = Math.round(xs(x) * 10) / 10; return '<line x1="' + px + '" x2="' + px + '" y1="' + y0 + '" y2="' + Math.round(ys(f(x)) - 8) + '" stroke="#C8553D" stroke-width="2.5" stroke-dasharray="4 3"/><text x="' + px + '" y="' + Math.round(ys(f(x)) - 12) + '" text-anchor="middle" class="lbb">' + nf(v, 2) + '</text>'; }, xt: [-3, -2, -1, 0, 1, 2, 3].map(function (t) { return [t, String(t)]; }) }) +
      '<p class="to-n">' + (o.tur === 't' ? 't' : 'z') + ' = ' + nf(v, 2) + ' · boyalı alan ' + (o.kuyruk === 'iki' ? '(iki kuyruk)' : '(sağ kuyruk)') + ' ≈ ' + nf(alan, 4) + '</p>';
  };
})();
