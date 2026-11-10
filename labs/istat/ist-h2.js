/* ==========================================================================
   ACADEX İSTATİSTİK · 5–7. haftalar (labs/istat/ist-h2.js), 11.11.2026
   5 CTM I (mod, medyan) · 6 CTM II (ortalamalar) · 7 Olasılık
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST, V = IST.V, M = IST.M, nf = IST.nf, X = IST.X, PAL = V.PAL, d = V.d;
  var YAS = [12, 13, 14, 14, 15, 15, 16, 16, 16, 16, 17, 17, 18, 19, 20, 21, 21, 22, 23, 24, 25, 26, 28, 29];
  var YASG = [['10–15', 10, 4], ['15–20', 15, 10], ['20–25', 20, 6], ['25–30', 25, 4]];
  var arrow = function (id, c) { return '<defs><marker id="' + id + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="' + (c || '#0D1838') + '"/></marker></defs>'; };

  /* ======================= 5. HAFTA ======================= */
  IST.hafta({
    id: 'g5', no: 5, renk: '#6B4FB3', tr: 'Merkezî eğilim I: mod ve medyan', en: 'Central Tendency Measures I',
    sahneler: [
      {
        b: 'Verinin “ortası” nerede?', terim: [['merkezî eğilim ölçüsü', 'measure of central tendency'], ['tipik değer', 'typical value']],
        t: '<p>Bir veri setini tek bir sayıyla özetlemek istediğimizde “tipik” değeri ararız. Bunu yapan ölçülere <b>merkezî eğilim ölçüleri</b> denir.</p><p>Bu hafta ikisini öğreniyoruz: <b>mod</b> (en sık görülen değer) ve <b>medyan</b> (sıralı verinin tam ortası). Gelecek hafta: ortalamalar.</p>',
        v: function () { return V.dots({ v: YAS, min: 10, max: 30, h: 260, step: 2, mark: [[16, 'mod 16', PAL[1]], [17.5, 'medyan 17,5', PAL[2]]], xlab: 'yetenek yarışmasındaki 24 yarışmacının yaşı' }); }
      },
      {
        b: 'Mod: en sık görülen değer', terim: [['mod', 'mode'], ['tek modlu', 'unimodal'], ['iki modlu', 'bimodal']],
        t: '<p>(3, 1, 3, 2, 10, 9, 3, 10, 3, 4) verisinde <b>3</b> dört kez geçiyor → <b>mod = 3</b>.</p><p>Bir veride hiç mod olmayabilir (her değer bir kez), bir mod (<b>tek modlu</b>) ya da iki mod (<b>iki modlu</b>) olabilir. Mod, <b>nominal veride</b> de kullanılabilen tek merkezî eğilim ölçüsüdür.</p>',
        v: function () { return V.dots({ v: [3, 1, 3, 2, 10, 9, 3, 10, 3, 4], min: 0, max: 11, h: 240, r: 10, hi: function (v) { return v === 3; }, mark: [[3, 'mod = 3', PAL[1]]] }); }
      },
      {
        b: 'Frekans tablosundan mod', terim: [['frekans dağılımı', 'frequency distribution']],
        t: '<p>24 yarışmacının yaşları sıralanıp her yaşın kaç kez geçtiği sayılır. Sütun grafiğinde en uzun sütun <b>16 yaş</b> (4 kez).</p><p>Başka hiçbir yaş 4 kez geçmediği için dağılım <b>tek modlu</b>: modal yaş <b>16</b>.</p>',
        v: function () {
          var u = M.sort(YAS).filter(function (v, i, a) { return a.indexOf(v) === i; });
          return V.bars({ x: u.map(String), y: u.map(function (v) { return YAS.filter(function (w) { return w === v; }).length; }), h: 270, max: 5, ticks: 5, fmt: function (v) { return nf(v, 0); }, hi: [u.indexOf(16)], xlab: 'yaş', ylab: 'frekans' });
        }
      },
      {
        b: 'Gruplanmış veride mod', terim: [['modal sınıf', 'modal class'], ['interpolasyon', 'interpolation']],
        t: '<p>Veri yalnızca sınıflar hâlinde verilmişse: 1) en yüksek frekanslı <b>modal sınıfı</b> bul (15–20, f = 10); 2) formülü uygula:</p><p class="mono" style="font-size:15px">Mo = L + d₁ / (d₁ + d₂) × h</p><p>L: modal sınıfın alt sınırı, d₁: önceki sınıfla fark, d₂: sonraki sınıfla fark, h: genişlik. Sonuç 18; gerçek mod 16’ya yakın bir <b>tahmin</b>.</p>',
        v: function () {
          return V.ust(V.hist({ edges: [10, 15, 20, 25, 30], y: [4, 10, 6, 4], h: 200, hi: [1], xlab: 'yaş sınıfı' }),
            V.fx([{ s: 'd₁ = 10 − 4, d₂ = 10 − 6', h: 'd₁ = <b>6</b>, d₂ = <b>4</b>, h = <b>5</b>, L = <b>15</b>' }, { s: 'gruplanmış mod', h: 'Mo = 15 + 6 / (6 + 4) × 5 = <b>18</b>', son: true }], 0.8));
        }
      },
      {
        b: 'Medyan: sıralı verinin ortası', terim: [['medyan', 'median'], ['konum', 'position']],
        t: '<p>1) Veriyi küçükten büyüğe sırala. 2) Konumu bul: <b>(n + 1) / 2</b>.</p><ul><li>n tek: tam ortadaki gözlem. 9 günlük mesaj sayısında konum (9 + 1)/2 = 5 → medyan 5. değer.</li><li>n çift: iki ortadakinin ortalaması. 24 yaşta konum 12,5 → 12. ve 13. değerlerin ortalaması: (17 + 18) / 2 = <b>17,5</b>.</li></ul>',
        v: function () {
          var a = [3, 4, 5, 6, 7, 8, 9, 10, 12], s = '';
          a.forEach(function (v, i) { var mid = i === 4; s += '<g class="dp" ' + d(i * 0.12) + '><rect x="' + (14 + i * 58) + '" y="' + (mid ? 50 : 70) + '" width="50" height="50" rx="10" fill="' + (mid ? PAL[2] : '#fff') + '" stroke="#0D1838" stroke-width="2"/><text x="' + (39 + i * 58) + '" y="' + (mid ? 82 : 102) + '" text-anchor="middle" font-weight="800" font-size="18" fill="' + (mid ? '#fff' : '#0D1838') + '">' + v + '</text></g><text class="lbm" x="' + (39 + i * 58) + '" y="140" text-anchor="middle">' + (i + 1) + '.</text>'; });
          s += '<g class="an" ' + d(1.3) + '><path d="M39 160 H 271" stroke="#6A7593" stroke-width="2" marker-end="url(#m5)"/><path d="M503 160 H 271" stroke="#6A7593" stroke-width="2" marker-end="url(#m5)"/><text class="lbb" x="271" y="190" text-anchor="middle">konum (9 + 1) / 2 = 5 → medyan = 7</text></g>';
          s += '<text class="lbl" x="14" y="30">n = 9 (tek): son 9 günde gelen mesaj sayısı, sıralı</text>';
          return V.svg(540, 210, arrow('m5', '#6A7593') + s, 'medyan konumu');
        }
      },
      {
        b: 'Gruplanmış medyan ve dirençli ölçüler', terim: [['medyan sınıfı', 'median class'], ['dirençli ölçü', 'resistant measure'], ['aykırı değer', 'outlier']],
        t: '<p>Gruplanmış veride: n/2 = 12. gözlemi içeren sınıf medyan sınıfıdır (birikimli frekans 4 → 14: <b>15–20</b>).</p><p class="mono" style="font-size:15px">Me = L + (n/2 − F) / f × h</p><p>Medyan ve mod <b>dirençli</b> ölçülerdir: en büyük değeri 29’dan 290’a çıkarsak medyan değişmez, ortalama ise fırlar.</p>',
        v: function () {
          return V.fx([{ s: 'F: medyan sınıfından önceki birikimli frekans', h: 'L = <b>15</b>, n/2 = <b>12</b>, F = <b>4</b>, f = <b>10</b>, h = <b>5</b>' }, { s: 'gruplanmış medyan', h: 'Me = 15 + (12 − 4) / 10 × 5 = <b>19</b>', son: true },
            { s: 'aykırı değer testi: 29 → 290', h: 'ortalama: 19,1 → <b>30,0</b> · medyan: 17,5 → <b>17,5</b>' }], 0.2, 0.7);
        }
      }
    ],
    gorsel: {
      b: 'Medyan ve mod avcısı', t: 'Sayı doğrusuna tıklayarak değer ekle, bir noktaya tıklayarak sil. Sürgüyle en büyük değeri uzaklaştır: ortalama kayarken medyan ve modun yerinde durduğunu izle.',
      kur: function (el) {
        var v = [4, 6, 7, 7, 8, 9, 10, 12], out = 0;
        el.innerHTML = '<div class="at-g"><div class="at-k"><label><span>en büyük değere ekle (aykırı değer) <output data-oo>+0</output></span><input type="range" min="0" max="25" value="0" data-o></label><div class="row"><button type="button" class="btn sm" data-r>örnek veri</button><button type="button" class="btn sm ghost" data-z>temizle</button></div><div class="at-out" style="margin:0"><div><small>n</small><b data-n></b></div><div><small>mod</small><b data-mo style="color:' + PAL[1] + '"></b></div><div><small>medyan</small><b data-me style="color:' + PAL[2] + '"></b></div><div><small>ortalama</small><b data-mn style="color:' + PAL[4] + '"></b></div></div></div><div class="at-v"><div data-s></div><div class="at-not" data-not></div></div></div>';
        var MAX = 45, svgw = 560, L = 24, R = 24, xs = V.sc(0, MAX, L, svgw - R);
        var draw = function () {
          var w = v.slice(); if (w.length && out) { var mi = w.indexOf(Math.max.apply(null, w)); w[mi] = Math.min(MAX, w[mi] + out); }
          var s = '<rect x="0" y="0" width="' + svgw + '" height="230" fill="transparent" data-bg/>', c = {};
          s += '<line x1="' + L + '" x2="' + (svgw - R) + '" y1="190" y2="190" stroke="#0D1838" stroke-width="2"/>';
          for (var t = 0; t <= MAX; t += 5) s += '<text class="lbm" x="' + xs(t) + '" y="210" text-anchor="middle">' + t + '</text><line x1="' + xs(t) + '" x2="' + xs(t) + '" y1="190" y2="196" stroke="#0D1838"/>';
          M.sort(w).forEach(function (x) { c[x] = (c[x] || 0) + 1; s += '<circle data-x="' + x + '" cx="' + xs(x) + '" cy="' + (180 - (c[x] - 1) * 18) + '" r="8" fill="' + PAL[0] + '" stroke="#0D1838" style="cursor:pointer"/>'; });
          var mk = function (x, lab, col, y) { return '<line x1="' + xs(x) + '" x2="' + xs(x) + '" y1="' + y + '" y2="190" stroke="' + col + '" stroke-width="2.5" stroke-dasharray="5 4" pointer-events="none"/><text class="lbb" x="' + xs(x) + '" y="' + (y - 4) + '" text-anchor="middle" style="fill:' + col + '" pointer-events="none">' + lab + '</text>'; };
          var mo = w.length ? M.modes(w) : [], me = w.length ? M.median(w) : null, mn = w.length ? M.mean(w) : null;
          if (w.length) { s += mk(mn, 'x̄', PAL[4], 24) + mk(me, 'Me', PAL[2], 50); mo.forEach(function (m) { s += mk(m, 'Mo', PAL[1], 76); }); }
          el.querySelector('[data-s]').innerHTML = V.svg(svgw, 230, s, 'sayı doğrusu: tıkla ekle, noktaya tıkla sil');
          el.querySelector('[data-n]').textContent = w.length;
          el.querySelector('[data-mo]').textContent = mo.length ? mo.join(' ve ') : 'yok';
          el.querySelector('[data-me]').textContent = me == null ? '–' : nf(me, 1);
          el.querySelector('[data-mn]').textContent = mn == null ? '–' : nf(mn, 2);
          el.querySelector('[data-not]').innerHTML = w.length ? 'Sıralı veri: <span class="mono">' + M.sort(w).join(', ') + '</span>. Medyan konumu (n + 1) / 2 = ' + nf((w.length + 1) / 2, 1) + '. ' + (mo.length > 1 ? 'Birden çok mod var: veri <b>çok modlu</b>.' : mo.length ? '' : 'Hiçbir değer tekrar etmiyor: <b>mod yok</b>.') + (out ? ' Aykırı değer ortalamayı ' + nf(mn - M.mean(v), 2) + ' birim kaydırdı; medyan ' + (Math.abs(me - M.median(v)) < 1e-9 ? 'hiç değişmedi.' : nf(me - M.median(v), 2) + ' birim değişti.') : '') : 'Sayı doğrusuna tıklayarak değer ekle.';
          var svg = el.querySelector('[data-s] svg');
          svg.onclick = function (e) {
            var t = e.target.closest('[data-x]');
            if (t) { var x = +t.getAttribute('data-x'), idx = v.indexOf(x); if (idx < 0) { out = 0; el.querySelector('[data-o]').value = 0; el.querySelector('[data-oo]').textContent = '+0'; idx = v.indexOf(Math.max.apply(null, v)); } v.splice(idx, 1); draw(); return; }
            var p = IST.svgPt(svg, e), val = Math.round((p.x - L) / (svgw - L - R) * MAX); if (val < 0 || val > MAX || v.length >= 24) return; v.push(val); draw();
          };
        };
        el.querySelector('[data-o]').oninput = function () { out = +this.value; el.querySelector('[data-oo]').textContent = '+' + out; draw(); };
        el.querySelector('[data-r]').onclick = function () { v = [4, 6, 7, 7, 8, 9, 10, 12]; draw(); };
        el.querySelector('[data-z]').onclick = function () { v = []; out = 0; el.querySelector('[data-o]').value = 0; el.querySelector('[data-oo]').textContent = '+0'; draw(); };
        draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var base = []; for (var i = 0; i < 9; i++) base.push(r.int(1, 15));
      var mo = r.int(2, 14); base = base.filter(function (v) { return v !== mo; }); var uniq = {}; base = base.filter(function (v) { if (uniq[v]) return false; uniq[v] = 1; return true; });
      var dat = r.shuf(base.slice(0, 6).concat([mo, mo, mo]));
      out.push({ vizOnly: true, viz: function (ka) { var s = M.sort(dat), pos = []; s.forEach(function (v, i) { if (v === mo) pos.push(i + 1); }); return IST.S.siralar(dat, pos, ka + 1, { not: mo + ' üç kez geçiyor → mod' }); }, tag: 'hesap', q: '<p>Bir mağazada 9 günde iade edilen ürün sayıları:</p><p class="mono" style="font-size:17px">' + dat.join(', ') + '</p><p>Modu kaçtır?</p>', say: mo, goster: String(mo), tol: 0.01, ornek: '3',
        ip: 'Her değerin kaç kez geçtiğini say.', cz: ['Sırala: ' + M.sort(dat).join(', ') + '.', mo + ' değeri 3 kez geçiyor; diğerleri birer kez.', 'Mod = <b>' + mo + '</b>.'] });
      var n2 = r.pick([8, 10, 12]), ev = []; for (i = 0; i < n2; i++) ev.push(r.int(10, 60));
      var med = M.median(ev), s2 = M.sort(ev);
      out.push({ vizOnly: true, viz: function (ka) { return IST.S.siralar(ev, [n2 / 2, n2 / 2 + 1], ka, { not: 'ortadaki iki değer → medyan ' + nf(med, 1), notk: 3 }); }, tag: 'hesap', q: '<p>Bir kafede ' + n2 + ' müşterinin bekleme süreleri (dakika · 10):</p><p class="mono" style="font-size:17px">' + ev.join(', ') + '</p><p>Medyan kaçtır?</p>', say: med, goster: nf(med, 1), tol: 0.01, ornek: '27,5',
        ip: 'Önce sırala. n çift: konum (n + 1)/2 iki gözlemin arasına düşer.', cz: ['Sıralı: ' + s2.join(', ') + '.', 'Konum (' + n2 + ' + 1)/2 = ' + nf((n2 + 1) / 2, 1) + ' → ' + (n2 / 2) + '. ve ' + (n2 / 2 + 1) + '. değerler: ' + s2[n2 / 2 - 1] + ' ve ' + s2[n2 / 2] + '.', 'Medyan = (' + s2[n2 / 2 - 1] + ' + ' + s2[n2 / 2] + ') / 2 = <b>' + nf(med, 1) + '</b>.'] });
      var h = r.pick([5, 10, 20]), lo = r.pick([0, 10, 20, 40]), fs; do { fs = [r.int(2, 9), r.int(4, 14), r.int(6, 18), r.int(4, 14), r.int(1, 8)]; } while (M.sum(fs) % 2);
      var N = M.sum(fs), half = N / 2, cum = 0, mc = 0; for (i = 0; i < fs.length; i++) { if (cum + fs[i] >= half) { mc = i; break; } cum += fs[i]; }
      var Lm = lo + mc * h, me3 = Lm + (half - cum) / fs[mc] * h;
      var tb = V.tablo(['Sınıf', 'f'], fs.map(function (f, j) { return ['[' + (lo + j * h) + ', ' + (lo + (j + 1) * h) + ')', String(f)]; }), { n: [1], st: 0 });
      out.push({ tag: 'tablo', q: '<p>Bir çağrı merkezinde ' + N + ' görüşmenin süresi (saniye) gruplanmış.</p><p>Gruplanmış veriden <b>medyanı</b> hesaplayın (iki ondalık).</p>', g: tb, say: me3, goster: nf(me3, 2), tol: 0.011, ornek: '19',
        ip: 'n/2. gözlemi içeren sınıfı birikimli frekansla bul; Me = L + (n/2 − F)/f × h.', cz: ['n/2 = ' + half + '.', 'Birikimli frekanslar: ' + fs.map(function (f, j) { return M.sum(fs.slice(0, j + 1)); }).join(', ') + ' → medyan sınıfı [' + Lm + ', ' + (Lm + h) + ').', 'L = ' + Lm + ', F = ' + cum + ', f = ' + fs[mc] + ', h = ' + h + '.', 'Me = ' + Lm + ' + (' + half + ' − ' + cum + ') / ' + fs[mc] + ' × ' + h + ' = <b>' + nf(me3, 2) + '</b>.'] });
      var gf; do { gf = [r.int(2, 8), r.int(6, 12), r.int(14, 22), r.int(6, 13), r.int(1, 6)]; } while (gf[2] <= gf[1] || gf[2] <= gf[3]);
      var gh = r.pick([4, 5, 10]), gl = r.pick([0, 20, 50]), d1 = gf[2] - gf[1], d2 = gf[2] - gf[3], mo4 = gl + 2 * gh + d1 / (d1 + d2) * gh;
      out.push({ tag: 'tablo', q: '<p>Bir e-ticaret sitesinde sepet başına ürün fiyatları (TL · 10) gruplanmış.</p><p>Gruplanmış veriden <b>modu</b> hesaplayın (iki ondalık).</p>', g: V.tablo(['Sınıf', 'f'], gf.map(function (f, j) { return ['[' + (gl + j * gh) + ', ' + (gl + (j + 1) * gh) + ')', String(f)]; }), { n: [1], st: 0 }), say: mo4, goster: nf(mo4, 2), tol: 0.011, ornek: '18',
        ip: 'Modal sınıf en yüksek frekanslı sınıftır; Mo = L + d₁/(d₁ + d₂) × h.', cz: ['Modal sınıf: [' + (gl + 2 * gh) + ', ' + (gl + 3 * gh) + '), f = ' + gf[2] + '.', 'd₁ = ' + gf[2] + ' − ' + gf[1] + ' = ' + d1 + ', d₂ = ' + gf[2] + ' − ' + gf[3] + ' = ' + d2 + '.', 'Mo = ' + (gl + 2 * gh) + ' + ' + d1 + ' / (' + d1 + ' + ' + d2 + ') × ' + gh + ' = <b>' + nf(mo4, 2) + '</b>.'] });
      if (r() < 0.5) out.push({ tag: 'senaryo', q: '<p>Bir mahalledeki 15 evin fiyatları arasına çok lüks bir villa eklendi. Emlakçı mahalledeki “tipik” ev fiyatını raporlamak istiyor.</p><p>Hangi ölçüyü kullanmalı?</p>', o: ['Medyan', 'Aritmetik ortalama', 'Açıklık (en büyük − en küçük)', 'En büyük değer'], a: 0, n: 'Medyan aykırı değerlere karşı dirençlidir; villa ortalamayı yukarı çeker.',
        ip: 'Hangi ölçü uç değerlerden etkilenmez?', cz: ['Aykırı değer ortalamayı kendine doğru çeker.', 'Medyan yalnızca sıradaki konuma bakar → dirençli.', 'Cevap: <b>medyan</b>.'] });
      else { var nm = r.pick(['en çok tercih edilen telefon markası', 'en sık seçilen ödeme yöntemi', 'en çok satılan tişört rengi']); out.push({ tag: 'kavram', q: '<p>Bir anket ' + nm + 'nı belirlemek istiyor. Veri sınıflama (nominal) ölçeğinde.</p><p>Hangi merkezî eğilim ölçüsü kullanılabilir?</p>', o: ['Mod', 'Medyan', 'Aritmetik ortalama', 'Geometrik ortalama'], a: 0, n: 'Nominal veride sıra yoktur; medyan için sıralama, ortalama için toplama gerekir.',
        ip: 'Nominal veride hangi işlemi yapabiliyoruz: sayma mı, sıralama mı, toplama mı?', cz: ['Nominal: yalnızca = ≠ (sayma).', 'Saymayla bulunan ölçü: <b>mod</b>.'] }); }
      return out;
    }
  });

  /* ======================= 6. HAFTA ======================= */
  IST.hafta({
    id: 'g6', no: 6, renk: '#B84A6B', tr: 'Merkezî eğilim II: ortalamalar', en: 'Central Tendency Measures II',
    sahneler: [
      {
        b: 'Aritmetik ortalama: denge noktası', terim: [['aritmetik ortalama', 'arithmetic mean'], ['örneklem ortalaması', 'sample mean x̄'], ['anakütle ortalaması', 'population mean μ']],
        t: '<p>Tüm değerleri topla, sayıya böl: <b>x̄ = Σx / n</b> (örneklem), <b>μ = Σx / N</b> (anakütle).</p><p>Ortalama bir tahterevallinin <b>denge noktasıdır</b>: değerler bir tahta üzerinde ağırlık olsaydı, tahta tam ortalamanın üstünde dengede kalırdı.</p>',
        v: function () {
          var a = [2, 4, 4, 7, 13], m = M.mean(a), xs = V.sc(0, 15, 40, 500), s = '', c = {};
          s += '<rect class="fd" x="30" y="150" width="480" height="10" rx="5" fill="#8A6D3B" stroke="#0D1838" stroke-width="1.5"/>';
          a.forEach(function (v, i) { c[v] = (c[v] || 0) + 1; s += '<rect class="dp" ' + d(0.2 + i * 0.18) + ' x="' + (xs(v) - 14) + '" y="' + (122 - (c[v] - 1) * 30) + '" width="28" height="28" rx="5" fill="' + PAL[i] + '" stroke="#0D1838" stroke-width="1.5"/><text class="lbb fd" ' + d(0.3 + i * 0.18) + ' x="' + xs(v) + '" y="' + (141 - (c[v] - 1) * 30) + '" text-anchor="middle" style="fill:#fff">' + v + '</text>'; });
          s += '<path class="pop" ' + d(1.3) + ' d="M' + xs(m) + ' 160l-24 44h48z" fill="#E0A526" stroke="#0D1838" stroke-width="2"/><text class="lbb fd" ' + d(1.5) + ' x="' + xs(m) + '" y="226" text-anchor="middle">x̄ = 30 / 5 = 6</text>';
          for (var t = 0; t <= 15; t += 3) s += '<text class="lbm" x="' + xs(t) + '" y="176" text-anchor="middle">' + t + '</text>';
          return V.svg(540, 240, s, 'tahterevalli: ortalama denge noktası');
        }
      },
      {
        b: 'Frekans tablosundan ve gruplanmış veriden ortalama', terim: [['sınıf orta noktası', 'class midpoint'], ['gruplanmış ortalama', 'grouped mean']],
        t: '<p>Frekans tablosunda her değer frekansı kadar sayılır: <b>x̄ = Σf·x / Σf</b>.</p><p>Gruplanmış veride gerçek değerleri bilmeyiz; her sınıfı <b>orta noktasıyla</b> (m) temsil ederiz: <b>x̄ ≈ Σf·m / n</b>. Yarışmacı yaşlarında: 470 / 24 ≈ <b>19,58</b> (gerçek ortalama 19,13).</p>',
        v: function () {
          return V.ust(V.tablo(['Sınıf', 'm', 'f', 'f·m'], YASG.map(function (g) { var m = g[1] + 2.5; return [g[0], nf(m, 1), String(g[2]), nf(m * g[2], 1)]; }).concat([['<b>Toplam</b>', '', '<b>24</b>', '<b>470</b>']]), { n: [1, 2, 3], st: 0.2 }),
            V.fx([{ s: 'gruplanmış ortalama', h: 'x̄ ≈ 470 / 24 = <b>19,58</b>', son: true }], 1.2));
        }
      },
      {
        b: 'Ağırlıklı ortalama', terim: [['ağırlıklı ortalama', 'weighted mean'], ['ağırlık', 'weight']],
        t: '<p>Değerlerin önemi eşit değilse her değer bir <b>ağırlıkla</b> (w) çarpılır: <b>x̄w = Σw·x / Σw</b>.</p><p>Ders notu: vize %30, ödev %20, final %50. Puanlar 70, 90, 60 → 0,3·70 + 0,2·90 + 0,5·60 = <b>69</b>. Basit ortalama (73,3) finalin ağırlığını yok sayar.</p><p>Kumaş alımında da metre başı ortalama maliyet, <b>alınan miktarla</b> ağırlıklandırılır.</p>',
        v: function () {
          var it = [['Vize', 30, 70, PAL[0]], ['Ödev', 20, 90, PAL[2]], ['Final', 50, 60, PAL[1]]], s = '', x = 30;
          it.forEach(function (t, i) { var w = t[1] * 4.6; s += '<rect class="gx" ' + d(i * 0.3) + ' x="' + x + '" y="40" width="' + w + '" height="56" fill="' + t[3] + '" stroke="#0D1838" stroke-width="2"/><text class="lbb fd" ' + d(0.3 + i * 0.3) + ' x="' + (x + w / 2) + '" y="66" text-anchor="middle" style="fill:#fff">' + t[0] + ' %' + t[1] + '</text><text class="fd" ' + d(0.3 + i * 0.3) + ' x="' + (x + w / 2) + '" y="86" text-anchor="middle" fill="#fff" font-size="12">puan ' + t[2] + '</text>'; x += w; });
          s += '<text class="lbl" x="30" y="28">ağırlık = sütunun genişliği</text>';
          return V.svg(540, 110, s, 'ağırlıklar') + V.fx([{ s: 'Σw·x', h: '0,30·70 + 0,20·90 + 0,50·60 = 21 + 18 + 30' }, { s: 'ağırlıklı ortalama', h: 'x̄w = 69 / 1 = <b>69</b>', son: true }], 1);
        }
      },
      {
        b: 'Ortalamanın özellikleri', terim: [['sapma', 'deviation'], ['doğrusal dönüşüm', 'linear transformation']],
        t: '<ul><li>Sapmaların toplamı sıfırdır: <b>Σ(x − x̄) = 0</b>.</li><li>Her değere a eklenirse ortalama da a artar; her değer b ile çarpılırsa ortalama da b ile çarpılır: <b>ort(bx + a) = b·x̄ + a</b>.</li><li>Tüm değerleri kullanır, bu yüzden <b>aykırı değerlere duyarlıdır</b> (dirençli değildir).</li></ul>',
        v: function () {
          var a = [3, 5, 6, 8, 13], m = 7, s = '', ys = V.sc(-7, 7, 230, 30);
          s += '<line x1="40" x2="520" y1="' + ys(0) + '" y2="' + ys(0) + '" stroke="#0D1838" stroke-width="2"/><text class="lbb" x="524" y="' + (ys(0) + 4) + '">x̄=7</text>';
          a.forEach(function (v, i) { var dv = v - m, y = ys(Math.max(dv, 0)), h = Math.abs(ys(dv) - ys(0)); s += '<rect class="gy" ' + d(i * 0.2) + ' style="transform-origin:50% ' + (dv > 0 ? '100%' : '0') + ';--d:' + (i * 0.2) + 's" x="' + (70 + i * 88) + '" y="' + y + '" width="50" height="' + h + '" fill="' + (dv >= 0 ? PAL[2] : PAL[1]) + '" stroke="#0D1838"/><text class="lbm" x="' + (95 + i * 88) + '" y="' + (dv >= 0 ? y - 6 : y + h + 16) + '" text-anchor="middle">' + (dv > 0 ? '+' : '') + nf(dv, 0) + '</text><text class="lbl" x="' + (95 + i * 88) + '" y="250" text-anchor="middle">x = ' + v + '</text>'; });
          s += '<text class="lbb fd" ' + d(1.3) + ' x="280" y="22" text-anchor="middle">(−4) + (−2) + (−1) + (+1) + (+6) = 0</text>';
          return V.svg(560, 260, s, 'ortalamadan sapmalar');
        }
      },
      {
        b: 'Geometrik ortalama: büyüme oranları', terim: [['geometrik ortalama', 'geometric mean'], ['büyüme oranı', 'growth rate']],
        t: '<p>Oranlar <b>çarpılarak</b> birikir. Bir yatırım üç yılda %10, %50 ve −%20 getirdiyse ortalama yıllık getiri aritmetik ortalama (%13,3) <b>değildir</b>.</p><p class="mono">G = (1,10 × 1,50 × 0,80)^(1/3) − 1 ≈ <b>%9,7</b></p><p>Sağlama: 100 TL → 110 → 165 → 132. 100 × 1,097³ ≈ 132 ✓. Geometrik ortalama yalnızca pozitif değerlerle ve oran ölçeğinde kullanılır.</p>',
        v: function () {
          return V.ust(V.bars({ x: ['başlangıç', '1. yıl +%10', '2. yıl +%50', '3. yıl −%20'], y: [100, 110, 165, 132], h: 200, max: 180, fmt: function (v) { return nf(v, 0); }, renk: [PAL[7], PAL[2], PAL[2], PAL[1]] }),
            V.fx([{ s: 'aritmetik (yanlış)', h: '(10 + 50 − 20) / 3 = %13,3 → 100 × 1,133³ = 145 ✗' }, { s: 'geometrik (doğru)', h: '(1,1 · 1,5 · 0,8)^(1/3) − 1 = <b>%9,7</b> → 132 ✓', son: true }], 1));
        }
      },
      {
        b: 'Kırpılmış ortalama, orta değer ve doğru ölçüyü seçmek', terim: [['kırpılmış ortalama', 'trimmed mean'], ['orta değer', 'midrange']],
        t: '<p><b>Kırpılmış ortalama:</b> sıralı verinin iki ucundan aynı oranda (ör. %10) değer atılır, kalanların ortalaması alınır; aykırı değerin etkisini azaltır.</p><p><b>Orta değer:</b> (en küçük + en büyük) / 2; hızlıdır ama aykırı değere çok duyarlıdır.</p>',
        v: function () {
          return V.tablo(['Ölçek', 'Mod', 'Medyan', 'Ortalama', 'Geometrik'], [['Nominal', '✓', '–', '–', '–'], ['Ordinal', '✓', '✓', '–', '–'], ['Aralık', '✓', '✓', '✓', '–'], ['Oran', '✓', '✓', '✓', '✓']], { st: 0.25, hi: { '0,1': 'ht', '1,2': 'ht', '2,3': 'ht', '3,4': 'ht' }, cap: 'Yeşil: o ölçekte eklenen yeni ölçü' });
        }
      }
    ],
    gorsel: {
      b: 'Tahterevalli: ortalamayı dengele', t: 'Ağırlıkları tahta üzerinde sürükle. Tahta, destek noktası ortalamaya oturduğunda dengeye gelir. “Desteği ortalamaya taşı”ya basarak kontrol et; yanda tüm ortalama türleri canlı hesaplanır.',
      kur: function (el) {
        var v = [3, 5, 6, 9, 14], f = 10, W = 560, xs = V.sc(0, 20, 40, W - 40), inv = function (x) { return (x - 40) / (W - 80) * 20; };
        el.innerHTML = '<div class="at-g"><div class="at-k"><label><span>destek noktası <output data-fo>10</output></span><input type="range" min="0" max="20" step="0.1" value="10" data-f></label><div class="row"><button type="button" class="btn sm pri" data-au>desteği ortalamaya taşı</button><button type="button" class="btn sm ghost" data-ad>+ ağırlık</button></div><div class="at-out" style="margin:0"><div><small>aritmetik x̄</small><b data-m1></b></div><div><small>medyan</small><b data-m2></b></div><div><small>geometrik</small><b data-m3></b></div><div><small>kırpılmış (1’er uç)</small><b data-m4></b></div><div><small>orta değer</small><b data-m5></b></div></div></div><div class="at-v"><div data-s></div><div class="at-not" data-not></div></div></div>';
        var sEl = el.querySelector('[data-s]');
        var draw = function () {
          var m = M.mean(v), tq = M.sum(v.map(function (x) { return x - f; })), ang = Math.max(-14, Math.min(14, tq * 1.2)), bal = Math.abs(m - f) < 0.05;
          var s = '<g transform="rotate(' + ang.toFixed(2) + ' ' + xs(f) + ' 170)" style="transition:transform .4s">';
          s += '<rect x="30" y="165" width="' + (W - 60) + '" height="10" rx="5" fill="#8A6D3B" stroke="#0D1838" stroke-width="1.5"/>';
          for (var t = 0; t <= 20; t += 2) s += '<text class="lbm" x="' + xs(t) + '" y="192" text-anchor="middle">' + t + '</text>';
          var c = {}; v.forEach(function (x, i) { var k = Math.round(x * 2) / 2; c[k] = (c[k] || 0) + 1; s += '<g class="drag" data-i="' + i + '"><rect x="' + (xs(x) - 15) + '" y="' + (135 - (c[k] - 1) * 32) + '" width="30" height="30" rx="6" fill="' + PAL[i % PAL.length] + '" stroke="#0D1838" stroke-width="1.5"/><text class="lbb" x="' + xs(x) + '" y="' + (155 - (c[k] - 1) * 32) + '" text-anchor="middle" style="fill:#fff;pointer-events:none">' + nf(x, 1) + '</text></g>'; });
          s += '</g><path d="M' + xs(f) + ' 176l-22 40h44z" fill="' + (bal ? '#3E8E5B' : '#E0A526') + '" stroke="#0D1838" stroke-width="2"/><text class="lbb" x="' + xs(f) + '" y="236" text-anchor="middle">' + (bal ? 'DENGEDE ✓' : 'destek ' + nf(f, 1)) + '</text>';
          sEl.innerHTML = V.svg(W, 245, s, 'tahterevalli');
          var srt = M.sort(v);
          el.querySelector('[data-m1]').textContent = nf(m, 2); el.querySelector('[data-m2]').textContent = nf(M.median(v), 2);
          el.querySelector('[data-m3]').textContent = v.every(function (x) { return x > 0; }) ? nf(Math.exp(M.mean(v.map(Math.log))), 2) : '0 var';
          el.querySelector('[data-m4]').textContent = v.length > 2 ? nf(M.mean(srt.slice(1, -1)), 2) : '–';
          el.querySelector('[data-m5]').textContent = nf((srt[0] + srt[srt.length - 1]) / 2, 2);
          el.querySelector('[data-not]').innerHTML = bal ? 'Destek tam ortalamada: sağdaki sapmaların toplamı soldakileri götürüyor, <b>Σ(x − x̄) = 0</b>.' : 'Sapmaların toplamı Σ(x − destek) = <b>' + nf(tq, 2) + '</b>; ' + (tq > 0 ? 'sağ taraf ağır, tahta sağa yatıyor.' : 'sol taraf ağır, tahta sola yatıyor.') + ' Geometrik ortalama her zaman aritmetikten küçük ya da eşittir.';
          var svg = sEl.querySelector('svg');
          IST.drag(svg, '[data-i]', function (g, p, end) {
            var i = +g.getAttribute('data-i'); v[i] = Math.max(0.5, Math.min(20, Math.round(inv(p.x) * 2) / 2));
            if (end) { draw(); return; }
            var rc = g.querySelector('rect'), tx = g.querySelector('text'); rc.setAttribute('x', xs(v[i]) - 15); tx.setAttribute('x', xs(v[i])); tx.textContent = nf(v[i], 1);
          });
        };
        el.querySelector('[data-f]').oninput = function () { f = +this.value; el.querySelector('[data-fo]').textContent = nf(f, 1); draw(); };
        el.querySelector('[data-au]').onclick = function () { f = Math.round(M.mean(v) * 10) / 10; f = M.mean(v); el.querySelector('[data-f]').value = f; el.querySelector('[data-fo]').textContent = nf(f, 2); draw(); };
        el.querySelector('[data-ad]').onclick = function () { if (v.length < 8) { v.push(Math.round(Math.random() * 18 + 1)); draw(); } };
        draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var w = r.pick([[30, 20, 50], [40, 60], [25, 25, 50], [20, 30, 50], [35, 15, 50]]), ad = w.length === 2 ? ['Vize', 'Final'] : ['Vize', 'Ödev', 'Final'], sc = w.map(function () { return r.int(40, 100); });
      var wm = M.sum(w.map(function (x, i) { return x * sc[i]; })) / 100;
      out.push({ tag: 'senaryo', q: '<p>İstatistik dersinde değerlendirme ağırlıkları ve bir öğrencinin puanları yanda.</p><p>Öğrencinin <b>ağırlıklı ortalaması</b> kaçtır? (iki ondalık)</p>', g: V.tablo(['Görev', 'Ağırlık', 'Puan'], w.map(function (x, i) { return [ad[i], '%' + x, String(sc[i])]; }), { n: [1, 2], st: 0 }), say: wm, goster: nf(wm, 2), tol: 0.011, ornek: '69',
        yanlis: function (v) { return Math.abs(v - M.mean(sc)) < 0.02 ? 'Bu basit ortalama; ağırlıkları kullanmadın.' : 'Her puanı ağırlığıyla çarpıp topla, ağırlıkların toplamına (%100) böl.'; },
        ip: 'x̄w = Σ(w·x) / Σw.', cz: [w.map(function (x, i) { return '0,' + (x < 10 ? '0' : '') + x + '·' + sc[i]; }).join(' + ') + '.', '= ' + w.map(function (x, i) { return nf(x * sc[i] / 100, 2); }).join(' + ') + ' = <b>' + nf(wm, 2) + '</b>.'] });
      var lo = r.pick([0, 10, 20]), h = r.pick([10, 20]), fs = [r.int(2, 9), r.int(5, 15), r.int(8, 20), r.int(4, 12)], n = M.sum(fs), mids = fs.map(function (_, j) { return lo + j * h + h / 2; }), gm = M.sum(fs.map(function (f, j) { return f * mids[j]; })) / n;
      out.push({ tag: 'tablo', q: '<p>Bir spor salonunda ' + n + ' üyenin haftalık antrenman süresi (saat · ' + (h === 10 ? 'dakika/10' : 'dakika/10') + ' cinsinden sınıflar) yanda.</p><p>Gruplanmış veriden <b>ortalamayı</b> hesaplayın (iki ondalık).</p>', g: V.tablo(['Sınıf', 'f'], fs.map(function (f, j) { return ['[' + (lo + j * h) + ', ' + (lo + (j + 1) * h) + ')', String(f)]; }), { n: [1], st: 0 }), say: gm, goster: nf(gm, 2), tol: 0.011, ornek: '19,58',
        ip: 'Her sınıfın orta noktasını bul: m = (alt + üst) / 2; x̄ ≈ Σf·m / n.', cz: ['Orta noktalar: ' + mids.join(', ') + '.', 'Σf·m = ' + fs.map(function (f, j) { return f + '·' + mids[j]; }).join(' + ') + ' = ' + nf(M.sum(fs.map(function (f, j) { return f * mids[j]; })), 1) + '.', 'x̄ ≈ ' + nf(M.sum(fs.map(function (f, j) { return f * mids[j]; })), 1) + ' / ' + n + ' = <b>' + nf(gm, 2) + '</b>.'] });
      var g = [r.int(-15, 35), r.int(-15, 35), r.int(-15, 35)], gg = (Math.pow(g.reduce(function (p, x) { return p * (1 + x / 100); }, 1), 1 / 3) - 1) * 100;
      out.push({ viz: function (ka) { var v = [100]; g.forEach(function (x) { v.push(v[v.length - 1] * (1 + x / 100)); }); var gv = [100, 100 * (1 + gg / 100), 100 * Math.pow(1 + gg / 100, 2), 100 * Math.pow(1 + gg / 100, 3)]; return IST.S.cift(['başlangıç', '1. yıl', '2. yıl', '3. yıl'], ka >= 3 ? gv : v, 9, { fmt: function (x) { return nf(x, 1); }, renk: ka >= 3 ? [PAL[7], PAL[2], PAL[2], PAL[2]] : [PAL[7], PAL[0], PAL[0], PAL[0]] }) + (ka >= 3 ? '<p class="lbl" style="margin:4px 0 0">yeşil: her yıl sabit %' + nf(gg, 2) + ' büyüme aynı sona varır</p>' : ''); }, tag: 'senaryo', q: '<p>Bir girişimin yıllık ciro büyümeleri: <b>' + g.map(function (x) { return (x > 0 ? '+' : '') + x + '%'; }).join(', ') + '</b>.</p><p>Ortalama yıllık büyüme oranı (geometrik ortalama) yüzde kaçtır? (iki ondalık)</p>', say: gg, goster: '%' + nf(gg, 2), tol: 0.02, ornek: '9,7',
        yanlis: function (v) { return Math.abs(v - M.mean(g)) < 0.02 ? 'Bu aritmetik ortalama; büyüme oranları çarpılarak birikir.' : 'Büyüme çarpanlarını (1 + oran) çarp, küp kökünü al, 1 çıkar.'; },
        ip: 'Oranları çarpana çevir: +10% → 1,10, −20% → 0,80. G = (çarpım)^(1/3) − 1.', cz: ['Çarpanlar: ' + g.map(function (x) { return nf(1 + x / 100, 2); }).join(' × ') + ' = ' + nf(g.reduce(function (p, x) { return p * (1 + x / 100); }, 1), 4) + '.', 'Küp kök: ' + nf(1 + gg / 100, 4) + '.', 'G = <b>%' + nf(gg, 2) + '</b>.'] });
      var tv = []; for (var i = 0; i < 10; i++) tv.push(r.int(20, 60)); tv[r.int(0, 9)] = r.int(140, 260);
      var st = M.sort(tv), tm = M.mean(st.slice(1, 9));
      out.push({ tag: 'hesap', q: '<p>Bir kurye 10 teslimatın sürelerini (dakika) kaydetti:</p><p class="mono" style="font-size:16px">' + tv.join(', ') + '</p><p><b>%10 kırpılmış ortalama</b> kaçtır? (iki ondalık)</p>', say: tm, goster: nf(tm, 2), tol: 0.011, ornek: '38,5',
        ip: 'n = 10 için %10 kırpma: sıralı verinin her iki ucundan 1’er değer at.', cz: ['Sıralı: ' + st.join(', ') + '.', 'En küçük (' + st[0] + ') ve en büyük (' + st[9] + ') atılır.', 'Kalan 8 değerin ortalaması: ' + M.sum(st.slice(1, 9)) + ' / 8 = <b>' + nf(tm, 2) + '</b>. (Normal ortalama ' + nf(M.mean(tv), 2) + ' olurdu.)'] });
      var m0 = r.int(18, 40) * 1000, b = r.pick([1.05, 1.1, 1.2]), a = r.pick([500, 1000, 1500]), nm = m0 * b + a;
      out.push({ tag: 'özellik', q: '<p>Bir şirkette çalışanların ortalama maaşı <b>' + nf(m0, 0) + ' TL</b>. Yönetim herkesin maaşını önce <b>%' + Math.round((b - 1) * 100) + '</b> artırıp ardından herkese <b>' + nf(a, 0) + ' TL</b> ek ödeme yapacak.</p><p>Yeni ortalama maaş kaç TL olur?</p>', say: nm, goster: nf(nm, 0) + ' TL', tol: 0.6, ornek: '35.200',
        ip: 'ort(b·x + a) = b·x̄ + a. Tüm maaşları bilmene gerek yok.', cz: ['Dönüşüm: y = ' + nf(b, 2) + '·x + ' + nf(a, 0) + '.', 'ȳ = ' + nf(b, 2) + ' × ' + nf(m0, 0) + ' + ' + nf(a, 0) + ' = <b>' + nf(nm, 0) + ' TL</b>.'] });
      return out;
    }
  });

  /* ======================= 7. HAFTA ======================= */
  var venn = function (pa, pb, pab, o) {
    o = o || {}; var W = o.w || 520, H = o.h || 250, ra = 60 + pa * 160, rb = 60 + pb * 160, ov = Math.min(ra, rb) * 2 * (pab / Math.max(0.0001, Math.min(pa, pb))) * 0.9, cx = W / 2, dist = ra + rb - ov, ax = cx - dist / 2, bx = cx + dist / 2, s = '';
    s += '<rect x="6" y="6" width="' + (W - 12) + '" height="' + (H - 12) + '" rx="14" fill="#fff" stroke="#0D1838" stroke-width="2"/><text class="lbb" x="20" y="28">S</text>';
    s += '<circle class="pop" ' + d(0.1) + ' cx="' + ax + '" cy="' + (H / 2) + '" r="' + ra + '" fill="' + PAL[0] + '" fill-opacity=".35" stroke="' + PAL[0] + '" stroke-width="2.5"/>';
    s += '<circle class="pop" ' + d(0.3) + ' cx="' + bx + '" cy="' + (H / 2) + '" r="' + rb + '" fill="' + PAL[1] + '" fill-opacity=".35" stroke="' + PAL[1] + '" stroke-width="2.5"/>';
    s += '<text class="lbb" x="' + (ax - ra * 0.45) + '" y="' + (H / 2 + 4) + '" text-anchor="middle">' + (o.la || 'A') + '</text><text class="lbb" x="' + (bx + rb * 0.45) + '" y="' + (H / 2 + 4) + '" text-anchor="middle">' + (o.lb || 'B') + '</text>';
    s += '<text class="lbm fd" ' + d(0.7) + ' x="' + ((ax + ra + bx - rb) / 2) + '" y="' + (H / 2 + 4) + '" text-anchor="middle" font-weight="700">' + (o.t ? o.t[1] : nf(pab, 2)) + '</text>';
    s += '<text class="lbm fd" ' + d(0.7) + ' x="' + (ax - ra * 0.45) + '" y="' + (H / 2 + 22) + '" text-anchor="middle">' + (o.t ? o.t[0] : nf(pa - pab, 2)) + '</text><text class="lbm fd" ' + d(0.7) + ' x="' + (bx + rb * 0.45) + '" y="' + (H / 2 + 22) + '" text-anchor="middle">' + (o.t ? o.t[2] : nf(pb - pab, 2)) + '</text>';
    return V.svg(W, H, s, 'Venn şeması');
  };
  IST.hafta({
    id: 'g7', no: 7, renk: '#0D5C8C', tr: 'Olasılık', en: 'Probability',
    sahneler: [
      {
        b: 'Rastgele deney, örnek uzay, olay', terim: [['rastgele deney', 'random experiment'], ['örnek uzay', 'sample space S'], ['olay', 'event'], ['sonuç', 'outcome']],
        t: '<p><b>Rastgele deney:</b> sonucu önceden kesin bilinmeyen süreç (zar atmak). <b>Örnek uzay</b> S tüm olası sonuçların kümesidir: S = {1, 2, 3, 4, 5, 6}.</p><p><b>Olay</b>, örnek uzayın bir alt kümesidir. “Çift sayı gelmesi” olayı: A = {2, 4, 6}.</p>',
        v: function () {
          var pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }, s = '';
          for (var k = 1; k <= 6; k++) {
            var x = 30 + (k - 1) * 84, ev = k % 2 === 0;
            s += '<g class="pop" ' + d(k * 0.12) + '><rect x="' + x + '" y="70" width="64" height="64" rx="12" fill="' + (ev ? '#FFF1C2' : '#fff') + '" stroke="#0D1838" stroke-width="2.5"/>';
            pips[k].forEach(function (p) { s += '<circle cx="' + (x + 32 + p[0] * 17) + '" cy="' + (102 + p[1] * 17) + '" r="5.5" fill="#0D1838"/>'; });
            s += '</g>';
          }
          s += '<text class="lbb" x="20" y="40">S = {1, 2, 3, 4, 5, 6}</text>';
          s += '<g class="an" ' + d(1.1) + '><path d="M114 150 q 84 50 168 0 q 84 50 168 0" fill="none" stroke="#E0A526" stroke-width="3"/><text class="lbb" x="282" y="210" text-anchor="middle">A = “çift” = {2, 4, 6} → P(A) = 3/6 = 0,5</text></g>';
          return V.svg(540, 230, s, 'zarın örnek uzayı ve çift sayı olayı');
        }
      },
      {
        b: 'Olasılığa üç yaklaşım', terim: [['klasik', 'classical'], ['deneysel (göreli frekans)', 'empirical / relative frequency'], ['öznel', 'subjective']],
        t: '<ul><li><b>Klasik:</b> sonuçlar eşit olasılıklıysa P(A) = (A’daki sonuç sayısı) / (toplam sonuç sayısı). Hilesiz zarda P(3) = 1/6.</li><li><b>Deneysel:</b> deneyi çok kez tekrarla, göreli frekansı al. Deneme sayısı arttıkça 1/6’ya yaklaşır.</li><li><b>Öznel:</b> veri yoksa uzman görüşüne dayanan inanç derecesi (“yeni ürünün tutma olasılığı %70”).</li></ul>',
        v: function () {
          var r = IST.rng(17), xs = [], ys = [], c = 0;
          for (var i = 1; i <= 600; i++) { if (r.int(1, 6) === 3) c++; if (i % 15 === 0) { xs.push(i); ys.push(c / i); } }
          return V.xy({ x: xs, y: ys, line: true, h: 270, ymax: 0.4, ymin: 0, xt: [[15, '15'], [150, '150'], [300, '300'], [450, '450'], [600, '600']], xlab: 'atış sayısı', ylab: '“3” gelme oranı', renk: PAL[7] }).replace('</svg>', '<line x1="46" x2="506" y1="' + (226 - 1 / 6 / 0.4 * 208).toFixed(1) + '" y2="' + (226 - 1 / 6 / 0.4 * 208).toFixed(1) + '" stroke="#C8553D" stroke-width="2" stroke-dasharray="6 5"/><text class="lbb" x="500" y="' + (220 - 1 / 6 / 0.4 * 208).toFixed(1) + '" text-anchor="end" style="fill:#C8553D">klasik: 1/6 ≈ 0,167</text></svg>');
        }
      },
      {
        b: 'Sayma kuralları', terim: [['çarpma kuralı', 'multiplication rule'], ['permütasyon', 'permutation'], ['kombinasyon', 'combination']],
        t: '<p><b>Çarpma kuralı:</b> k adımda n₁, n₂… seçenek varsa toplam n₁·n₂·… sonuç.</p><p><b>Permütasyon</b> (sıra önemli): P(n, k) = n! / (n − k)!. 5 adaydan başkan ve yardımcı: 5·4 = 20.</p><p><b>Kombinasyon</b> (sıra önemsiz): C(n, k) = n! / (k!(n − k)!). 5 adaydan 2 kişilik komite: <b>10</b>.</p>',
        v: function () {
          var s = '', P = [], ad = ['A', 'B', 'C', 'D', 'E'];
          for (var i = 0; i < 5; i++) for (var j = i + 1; j < 5; j++) P.push([i, j]);
          P.forEach(function (p, k) { var x = 30 + (k % 5) * 100, y = 40 + Math.floor(k / 5) * 80; s += '<g class="pop" ' + d(k * 0.12) + '><rect x="' + x + '" y="' + y + '" width="86" height="58" rx="12" fill="#fff" stroke="#0D1838" stroke-width="2"/>' + p.map(function (q, t) { return '<circle cx="' + (x + 26 + t * 34) + '" cy="' + (y + 29) + '" r="15" fill="' + PAL[q] + '" stroke="#0D1838"/><text x="' + (x + 26 + t * 34) + '" y="' + (y + 34) + '" text-anchor="middle" fill="#fff" font-weight="800">' + ad[q] + '</text>'; }).join('') + '</g>'; });
          s += '<text class="lbb fd" ' + d(1.4) + ' x="270" y="226" text-anchor="middle">C(5, 2) = 5! / (2!·3!) = 10 komite</text>';
          return V.svg(540, 240, s, '5 kişiden 2 kişilik tüm komiteler');
        }
      },
      {
        b: 'Aksiyomlar ve toplama kuralı', terim: [['Kolmogorov aksiyomları', 'axioms of probability'], ['birleşim', 'union A∪B'], ['kesişim', 'intersection A∩B']],
        t: '<p>1) 0 ≤ P(A) ≤ 1 · 2) P(S) = 1 · 3) Ayrık olaylar için P(A∪B) = P(A) + P(B).</p><p>Genel <b>toplama kuralı</b>: P(A∪B) = P(A) + P(B) − P(A∩B).</p><p>Müdür yardımcılarından kıdemlinin geç kalma olasılığı 0,07, gencin 0,05, ikisinin birden 0,03. En az birinin geç kalma olasılığı: 0,07 + 0,05 − 0,03 = <b>0,09</b>.</p>',
        v: function () { return V.ust(venn(0.28, 0.2, 0.12, { la: 'Kıdemli', lb: 'Genç', t: ['0,04', '0,03', '0,02'] }), V.fx([{ s: 'toplama kuralı', h: 'P(K∪G) = 0,07 + 0,05 − 0,03 = <b>0,09</b>', son: true }], 1)); }
      },
      {
        b: 'Bağımsız olaylar: çarpma kuralı', terim: [['bağımsız olaylar', 'independent events'], ['çarpma kuralı', 'multiplication rule']],
        t: '<p>A’nın gerçekleşmesi B’nin olasılığını değiştirmiyorsa A ve B <b>bağımsızdır</b>: <b>P(A∩B) = P(A)·P(B)</b>.</p><p>Bir mağaza aynı modelden 4 telefon alıyor; her birinin 2 yıl sorunsuz çalışma olasılığı 0,95 ve arızalar bağımsız. Dördünün de sorunsuz çalışma olasılığı: 0,95⁴ = <b>0,8145</b>.</p>',
        v: function () {
          var s = '', p = 1;
          for (var i = 0; i < 4; i++) { p *= 0.95; s += '<g class="pop" ' + d(i * 0.3) + '><rect x="' + (30 + i * 125) + '" y="40" width="58" height="96" rx="10" fill="#0D1838"/><rect x="' + (36 + i * 125) + '" y="50" width="46" height="70" rx="4" fill="#DDEBFA"/><text x="' + (59 + i * 125) + '" y="92" text-anchor="middle" font-size="22">✓</text></g><text class="lbm fd" ' + d(0.15 + i * 0.3) + ' x="' + (59 + i * 125) + '" y="160" text-anchor="middle">0,95</text>'; if (i < 3) s += '<text class="lbb fd" ' + d(0.2 + i * 0.3) + ' x="' + (121 + i * 125) + '" y="92" text-anchor="middle">×</text>'; s += '<text class="lbm fd" ' + d(0.3 + i * 0.3) + ' x="' + (59 + i * 125) + '" y="182" text-anchor="middle" style="fill:#C8553D">= ' + nf(p, 4) + '</text>'; }
          s += '<text class="lbb fd" ' + d(1.5) + ' x="270" y="220" text-anchor="middle">0,95 × 0,95 × 0,95 × 0,95 = 0,8145</text>';
          return V.svg(540, 236, s, 'dört bağımsız telefon');
        }
      },
      {
        b: 'Koşullu olasılık ve Bayes teoremi', terim: [['koşullu olasılık', 'conditional probability P(A|B)'], ['Bayes teoremi', 'Bayes’ theorem'], ['ön / son olasılık', 'prior / posterior']],
        t: '<p><b>P(A|B) = P(A∩B) / P(B)</b>: B olduğu bilindiğinde A’nın olasılığı.</p><p>Havalimanındaki araçların %50’si A, %30’u B, %20’si C firmasından. Bakım gerektirme oranları sırasıyla %10, %15, %5. Bakım gereken bir aracın <b>B’den</b> olma olasılığı:</p><p class="mono">0,30·0,15 / (0,05 + 0,045 + 0,01) = <b>0,4286</b></p><p>Ön olasılık 0,30 idi; bakım bilgisi onu 0,43’e çıkardı.</p>',
        v: function () {
          var br = [['A', 0.5, 0.10], ['B', 0.3, 0.15], ['C', 0.2, 0.05]], s = '<circle cx="40" cy="140" r="8" fill="#0D1838"/>';
          br.forEach(function (b, i) {
            var y = 50 + i * 90;
            s += '<path class="dr" style="--len:200;--d:' + (i * 0.2) + 's" d="M40 140L190 ' + y + '" stroke="#0D1838" stroke-width="2"/><text class="lbm fd" ' + d(0.2 + i * 0.2) + ' x="' + (115) + '" y="' + ((140 + y) / 2 - 6) + '" text-anchor="middle">' + nf(b[1], 2) + '</text>';
            s += '<g class="pop" ' + d(0.4 + i * 0.2) + '><circle cx="206" cy="' + y + '" r="16" fill="' + PAL[i] + '" stroke="#0D1838"/><text x="206" y="' + (y + 5) + '" text-anchor="middle" fill="#fff" font-weight="800">' + b[0] + '</text></g>';
            s += '<path class="dr" style="--len:200;--d:' + (0.8 + i * 0.2) + 's" d="M222 ' + y + 'L360 ' + (y - 18) + '" stroke="' + PAL[1] + '" stroke-width="' + (i === 1 ? 3.5 : 2) + '"/><text class="lbm fd" ' + d(1 + i * 0.2) + ' x="296" y="' + (y - 16) + '" text-anchor="middle">' + nf(b[2], 2) + '</text>';
            s += '<text class="lbb fd" ' + d(1.1 + i * 0.2) + ' x="368" y="' + (y - 13) + '"' + (i === 1 ? ' style="fill:#C8553D"' : '') + '>bakım: ' + nf(b[1] * b[2], 3) + '</text>';
          });
          s += '<text class="lbb fd" ' + d(1.9) + ' x="20" y="290">P(bakım) = 0,050 + 0,045 + 0,010 = 0,105 → P(B | bakım) = 0,045 / 0,105 = 0,4286</text>';
          return V.svg(560, 300, s, 'Bayes ağaç diyagramı');
        }
      }
    ],
    gorsel: {
      b: 'Olasılık atölyesi', t: '“Venn” sekmesinde P(A), P(B) ve P(A∩B)’yi değiştir: birleşim, koşullu olasılıklar ve bağımsızlık anında hesaplanır. “Zar” sekmesinde zarı yüzlerce kez at, deneysel olasılığın klasik 1/6’ya yaklaşmasını izle.',
      kur: function (el) {
        var mod = 'venn', pa = 0.4, pb = 0.3, pab = 0.12, rolls = [0, 0, 0, 0, 0, 0];
        el.innerHTML = '<div class="seg" data-m style="margin-bottom:12px"><button type="button" data-k="venn" aria-pressed="true">Venn ve koşullu olasılık</button><button type="button" data-k="zar" aria-pressed="false">Zar deneyi</button></div><div data-b></div>';
        var b = el.querySelector('[data-b]');
        var vennUI = function () {
          b.innerHTML = '<div class="at-g"><div class="at-k"><label><span>P(A) <output data-ao></output></span><input type="range" min="0.05" max="0.9" step="0.01" value="' + pa + '" data-a></label><label><span>P(B) <output data-bo></output></span><input type="range" min="0.05" max="0.9" step="0.01" value="' + pb + '" data-bb></label><label><span>P(A∩B) <output data-co></output></span><input type="range" min="0" max="0.9" step="0.01" value="' + pab + '" data-c></label></div><div class="at-v"><div data-s></div><div class="at-out"><div><small>P(A∪B)</small><b data-u></b></div><div><small>P(A|B)</small><b data-ab></b></div><div><small>P(B|A)</small><b data-ba></b></div><div><small>P(A)·P(B)</small><b data-pp></b></div></div><div class="at-not" data-n></div></div></div>';
          var up = function () {
            pab = Math.min(pab, pa, pb); if (pa + pb - pab > 1) pab = pa + pb - 1;
            b.querySelector('[data-c]').value = pab;
            b.querySelector('[data-ao]').textContent = nf(pa, 2); b.querySelector('[data-bo]').textContent = nf(pb, 2); b.querySelector('[data-co]').textContent = nf(pab, 2);
            b.querySelector('[data-s]').innerHTML = venn(pa, pb, pab);
            b.querySelector('[data-u]').textContent = nf(pa + pb - pab, 2); b.querySelector('[data-ab]').textContent = nf(pab / pb, 3); b.querySelector('[data-ba]').textContent = nf(pab / pa, 3); b.querySelector('[data-pp]').textContent = nf(pa * pb, 3);
            var ind = Math.abs(pab - pa * pb) < 0.006;
            b.querySelector('[data-n]').innerHTML = (ind ? '✅ <b>Bağımsız:</b> P(A∩B) ≈ P(A)·P(B); B’yi bilmek A’nın olasılığını değiştirmiyor (P(A|B) ≈ P(A)).' : pab === 0 ? '⛔ <b>Ayrık olaylar:</b> ikisi birlikte olamaz. Ayrık olaylar (olasılıkları pozitifse) bağımsız <b>değildir</b>.' : 'B bilindiğinde A’nın olasılığı ' + nf(pa, 2) + ' → ' + nf(pab / pb, 3) + ' oluyor: olaylar <b>bağımlı</b>.') + ' Toplama kuralı: ' + nf(pa, 2) + ' + ' + nf(pb, 2) + ' − ' + nf(pab, 2) + ' = ' + nf(pa + pb - pab, 2) + '.';
          };
          b.querySelector('[data-a]').oninput = function () { pa = +this.value; up(); };
          b.querySelector('[data-bb]').oninput = function () { pb = +this.value; up(); };
          b.querySelector('[data-c]').oninput = function () { pab = +this.value; up(); };
          up();
        };
        var zarUI = function () {
          b.innerHTML = '<div class="at-g"><div class="at-k"><div class="row"><button type="button" class="btn sm pri" data-z="1">1 at</button><button type="button" class="btn sm" data-z="10">10 at</button><button type="button" class="btn sm" data-z="100">100 at</button><button type="button" class="btn sm" data-z="1000">1000 at</button><button type="button" class="btn sm ghost" data-z="0">sıfırla</button></div><div class="at-out" style="margin:0"><div><small>toplam atış</small><b data-t></b></div><div><small>en büyük sapma</small><b data-sp></b></div></div></div><div class="at-v"><div data-s></div><div class="at-not" data-n></div></div></div>';
          var draw = function () {
            var n = M.sum(rolls), y = rolls.map(function (c) { return n ? c / n : 0; });
            b.querySelector('[data-s]').innerHTML = V.bars({ x: ['1', '2', '3', '4', '5', '6'], y: y, max: 0.4, h: 260, fmt: function (v) { return nf(v, 3); }, renk: PAL.slice(0, 6), label: 'göreli frekanslar' }).replace('</svg>', '<line x1="46" x2="508" y1="' + (236 - (1 / 6) / 0.4 * 218).toFixed(1) + '" y2="' + (236 - (1 / 6) / 0.4 * 218).toFixed(1) + '" stroke="#C8553D" stroke-width="2" stroke-dasharray="6 5"/></svg>');
            b.querySelector('[data-t]').textContent = n;
            b.querySelector('[data-sp]').textContent = n ? nf(Math.max.apply(null, y.map(function (v) { return Math.abs(v - 1 / 6); })), 3) : '–';
            b.querySelector('[data-n]').innerHTML = n < 30 ? 'Az atışta göreli frekanslar 1/6 ≈ 0,167 çizgisinden çok sapar.' : 'Atış sayısı arttıkça deneysel olasılıklar klasik değere (kesikli çizgi) yaklaşır: <b>büyük sayılar yasası</b>.';
          };
          [].forEach.call(b.querySelectorAll('[data-z]'), function (x) { x.onclick = function () { var k = +x.getAttribute('data-z'); if (!k) rolls = [0, 0, 0, 0, 0, 0]; for (var i = 0; i < k; i++) rolls[Math.floor(Math.random() * 6)]++; draw(); }; });
          draw();
        };
        [].forEach.call(el.querySelectorAll('[data-m] [data-k]'), function (x) { x.onclick = function () { mod = x.getAttribute('data-k'); [].forEach.call(el.querySelectorAll('[data-m] [data-k]'), function (y) { y.setAttribute('aria-pressed', String(y === x)); }); (mod === 'venn' ? vennUI : zarUI)(); }; });
        vennUI();
      }
    },
    sorular: function (r) {
      var out = [];
      var pa = r.int(10, 45) / 100, pb = r.int(10, 45) / 100, pab = r.int(2, Math.floor(Math.min(pa, pb) * 100) - 1) / 100, un = pa + pb - pab;
      var ctx = r.pick([['bir müşterinin kredi kartı', 'aynı müşterinin bireysel emeklilik'], ['bir ziyaretçinin bülten aboneliği', 'aynı ziyaretçinin uygulamayı indirmesi'], ['bir çalışanın İngilizce', 'aynı çalışanın Almanca sertifikası']]);
      out.push({ tag: 'senaryo', q: '<p>Bir bankada ' + ctx[0] + ' olasılığı <b>' + nf(pa, 2) + '</b>, ' + ctx[1] + ' olasılığı <b>' + nf(pb, 2) + '</b>, ikisinin birlikte olma olasılığı <b>' + nf(pab, 2) + '</b>.</p><p><b>En az birinin</b> olma olasılığı kaçtır?</p>', g: venn(pa, pb, pab, { h: 200 }), say: un, goster: nf(un, 2), tol: 0.0051, ornek: '0,09',
        yanlis: function (v) { return Math.abs(v - (pa + pb)) < 0.006 ? 'Kesişimi iki kez saydın; P(A∩B)’yi çıkarman gerekiyor.' : 'Toplama kuralını kullan.'; },
        ip: '“En az biri” = birleşim. P(A∪B) = P(A) + P(B) − P(A∩B).', cz: ['P(A∪B) = ' + nf(pa, 2) + ' + ' + nf(pb, 2) + ' − ' + nf(pab, 2) + '.', '= <b>' + nf(un, 2) + '</b>.'] });
      var p = r.pick([0.9, 0.92, 0.95, 0.97, 0.98]), k = r.int(3, 6), all = r() < 0.5, pr = all ? Math.pow(p, k) : 1 - Math.pow(p, k);
      out.push({ viz: function (ka) { return IST.S.izgara(k, k, '📡', ka, { k: 1, lab: ka >= 1 ? nf(p, 2) + '^' + k + ' = ' + nf(Math.pow(p, k), 4) : k + ' sensör' }); }, tag: 'senaryo', q: '<p>Bir fabrikada ' + k + ' bağımsız sensörün her biri bir vardiya boyunca <b>' + nf(p, 2) + '</b> olasılıkla hatasız çalışıyor.</p><p>' + (all ? '<b>Hepsinin</b> hatasız çalışma' : '<b>En az birinin</b> arıza verme') + ' olasılığı kaçtır? (dört ondalık)</p>', say: pr, goster: nf(pr, 4), tol: 0.0006, ornek: '0,8145',
        ip: all ? 'Bağımsız olaylarda “hepsi” → olasılıkları çarp.' : '“En az biri arızalı” = 1 − P(hepsi sağlam).', cz: ['P(hepsi sağlam) = ' + nf(p, 2) + '^' + k + ' = ' + nf(Math.pow(p, k), 4) + '.', all ? 'Cevap: <b>' + nf(pr, 4) + '</b>.' : '1 − ' + nf(Math.pow(p, k), 4) + ' = <b>' + nf(pr, 4) + '</b>.'] });
      var a = r.int(20, 80), b = r.int(20, 80), c = r.int(20, 80), e = r.int(20, 80), sor = r.int(0, 1);
      var ct = V.tablo(['', 'Mobil', 'Web', 'Toplam'], [['Yeni müşteri', String(a), String(b), String(a + b)], ['Eski müşteri', String(c), String(e), String(c + e)], ['<b>Toplam</b>', String(a + c), String(b + e), String(a + b + c + e)]], { n: [1, 2, 3], st: 0 });
      var cp = sor ? a / (a + c) : c / (c + e);
      out.push({ tag: 'tablo', q: '<p>Bir e-ticaret sitesinde siparişlerin müşteri türüne ve kanala göre dağılımı yanda.</p><p>Rastgele seçilen sipariş ' + (sor ? '<b>mobilden</b> verilmişse, <b>yeni müşteriden</b>' : '<b>eski müşteriden</b> ise, <b>mobilden</b>') + ' gelme olasılığı kaçtır? (dört ondalık)</p>', g: ct, say: cp, goster: nf(cp, 4), tol: 0.0006, ornek: '0,4286',
        ip: 'Koşul verilen satır ya da sütunu yeni “evren” say: P(A|B) = n(A∩B) / n(B).', yanlis: function (v) { var all2 = a + b + c + e; return Math.abs(v - (sor ? a : c) / all2) < 0.001 ? 'Genel toplama böldün; koşula göre payda yalnızca ' + (sor ? 'mobil sütunu' : 'eski müşteri satırı') + ' olmalı.' : 'Paydaya dikkat et.'; },
        cz: [sor ? 'Koşul: mobil → mobil sütunu toplamı ' + (a + c) + '.' : 'Koşul: eski müşteri → satır toplamı ' + (c + e) + '.', sor ? 'Mobil ve yeni: ' + a + '.' : 'Eski ve mobil: ' + c + '.', 'P = ' + (sor ? a + ' / ' + (a + c) : c + ' / ' + (c + e)) + ' = <b>' + nf(cp, 4) + '</b>.'] });
      var n = r.int(6, 12), kk = r.int(2, 4), cc = M.C(n, kk);
      out.push({ tag: 'sayma', q: '<p>Bir şirkette ' + n + ' çalışan arasından ' + kk + ' kişilik bir <b>proje komitesi</b> seçilecek (görev ayrımı yok).</p><p>Kaç farklı komite kurulabilir?</p>', say: cc, goster: String(cc), tol: 0.01, ornek: '10',
        yanlis: function (v) { return Math.abs(v - M.P(n, kk)) < 0.5 ? 'Bu permütasyon; komitede sıra önemli değil, k!’ye bölmelisin.' : 'Sıra önemsiz → kombinasyon.'; },
        ip: 'Sıra önemli değil → kombinasyon: C(n, k) = n! / (k!(n − k)!).', cz: ['C(' + n + ', ' + kk + ') = ' + n + '! / (' + kk + '!·' + (n - kk) + '!).', '= ' + M.P(n, kk) + ' / ' + M.fact(kk) + ' = <b>' + cc + '</b>.'] });
      var sh = r.pick([[0.5, 0.3, 0.2], [0.6, 0.25, 0.15], [0.45, 0.35, 0.2], [0.4, 0.4, 0.2]]), rt = [r.int(2, 12) / 100, r.int(2, 12) / 100, r.int(2, 12) / 100], ti = r.int(0, 2);
      var tot = M.sum(sh.map(function (s, i) { return s * rt[i]; })), post = sh[ti] * rt[ti] / tot, fr = ['A', 'B', 'C'];
      var tr = '<text class="lbb" x="10" y="20">tedarikçi → kusurlu</text>';
      sh.forEach(function (s, i) { var y = 50 + i * 60; tr += '<path d="M20 110L110 ' + y + '" stroke="#0D1838" stroke-width="1.5"/><text class="lbm" x="58" y="' + ((110 + y) / 2 - 4) + '">' + nf(s, 2) + '</text><circle cx="124" cy="' + y + '" r="13" fill="' + PAL[i] + '"/><text x="124" y="' + (y + 5) + '" text-anchor="middle" fill="#fff" font-weight="800">' + fr[i] + '</text><path d="M137 ' + y + 'L220 ' + y + '" stroke="#C8553D" stroke-width="1.5"/><text class="lbm" x="178" y="' + (y - 5) + '" text-anchor="middle">' + nf(rt[i], 2) + '</text>'; });
      out.push({ tag: 'ağaç diyagramı', q: '<p>Bir montaj fabrikası parçaları üç tedarikçiden alıyor: payları ve kusur oranları ağaçta.</p><p>Rastgele seçilen parça <b>kusurlu</b> çıktı. Bu parçanın <b>' + fr[ti] + '</b> tedarikçisinden gelme olasılığı kaçtır? (dört ondalık)</p>', g: V.svg(280, 210, '<circle cx="20" cy="110" r="6" fill="#0D1838"/>' + tr, 'tedarikçi ağaç diyagramı'), say: post, goster: nf(post, 4), tol: 0.0006, ornek: '0,4286',
        ip: 'Bayes: P(' + fr[ti] + '|K) = P(' + fr[ti] + ')·P(K|' + fr[ti] + ') / P(K). Önce P(K)’yi tüm dallardan topla.', cz: ['P(K) = ' + sh.map(function (s, i) { return nf(s, 2) + '·' + nf(rt[i], 2); }).join(' + ') + ' = ' + nf(tot, 4) + '.', 'P(' + fr[ti] + ' ∩ K) = ' + nf(sh[ti], 2) + '·' + nf(rt[ti], 2) + ' = ' + nf(sh[ti] * rt[ti], 4) + '.', 'P(' + fr[ti] + '|K) = ' + nf(sh[ti] * rt[ti], 4) + ' / ' + nf(tot, 4) + ' = <b>' + nf(post, 4) + '</b>.'] });
      return out;
    }
  });
})();
