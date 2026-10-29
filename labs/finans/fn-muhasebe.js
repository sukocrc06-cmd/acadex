/* ==========================================================================
   ACADEX FİNANS · MUHASEBE RIHTIMI (labs/finans/fn-muhasebe.js), 29.10.2026
   Kurgusal "Mavi Liman Ticaret A.Ş."nin bir ayı: 13 işlem.
   Fiş → doğru yevmiye kaydını seç → tutarlar büyük deftere (T hesaplar) uçar
   → mizan → dönem sonu KDV mahsubu → gelir tablosu ve bilanço → karne.
   Hesap kodları Tekdüzen Hesap Planı'ndan (MSUGT).
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf, tl = C.tl;
  var H = {}; V.HESAP.forEach(function (h) { H[h[0]] = { k: h[0], ad: h[1], g: h[2], nb: h[3] }; });
  var S = C.ls.get('mh', null) || { i: 0, res: [], tr: 0 };
  var save = function () { C.ls.set('mh', S); };
  var sec, opts = [];

  /* ---------- çeldiriciler: yön ters / karıştırılan hesap ---------- */
  var key = function (s) { return s.map(function (l) { return l.join(':'); }).sort().join('|'); };
  var options = function (is) {
    var ok = is.s.map(function (l) { return l.slice(); }), out = [{ s: ok, ok: true, why: is.n }];
    out.push({ s: ok.map(function (l) { return [l[0], l[1], l[2] === 'B' ? 'A' : 'B']; }), why: 'Yön ters: varlık ve gider artışı borca, kaynak ve gelir artışı alacağa yazılır. Bu kayıtta hepsi tersine dönmüş.' });
    for (var j = 0; j < ok.length; j++) {
      var q = (is.id + j) % ok.length, l = ok[q], alt = V.KARIS[l[0]];
      if (!alt || ok.some(function (x) { return x[0] === alt; })) continue;
      var s2 = ok.map(function (x, n) { return n === q ? [alt, x[1], x[2]] : x.slice(); });
      out.push({ s: s2, why: 'Hesap seçimi: ' + l[0] + ' ' + H[l[0]].ad + ' yerine ' + alt + ' ' + H[alt].ad + ' kullanılmış. ' + is.n });
      break;
    }
    if (out.length < 3) { /* KDV satırını düşür ya da tutar hatası */
      var s3 = ok.map(function (x) { return x.slice(); }); s3[0][1] = Math.round(s3[0][1] * 1.2); s3[s3.length - 1][1] = Math.round(s3[s3.length - 1][1] * 1.2);
      out.push({ s: s3, why: 'Tutar hatası: işlemde KDV yok, tutarlar olduğu gibi yazılır.' });
    }
    var seen = {}; out = out.filter(function (o) { var k = key(o.s); if (seen[k]) return false; seen[k] = 1; return true; });
    return C.shuffle(out);
  };
  var lineHtml = function (s) {
    var b = s.filter(function (l) { return l[2] === 'B'; }), a = s.filter(function (l) { return l[2] === 'A'; });
    return b.concat(a).map(function (l) { return '<span class="ln2' + (l[2] === 'A' ? ' a' : '') + '"><span>' + l[0] + ' ' + X(H[l[0]].ad) + '</span><span>' + (l[2] === 'B' ? 'B ' : 'A ') + nf(l[1]) + '</span></span>'; }).join('');
  };

  /* ---------- defter hesapları ---------- */
  var posted = function (n) { var all = []; V.ISLEM.slice(0, n).forEach(function (is) { is.s.forEach(function (l) { all.push([l[0], l[1], l[2], is.id]); }); }); return all; };
  var ledger = function (lines) {
    var L = {}; lines.forEach(function (l) { var a = L[l[0]] || (L[l[0]] = { B: [], A: [] }); a[l[2]].push([l[1], l[3]]); });
    Object.keys(L).forEach(function (k) { var a = L[k]; a.b = a.B.reduce(function (s, x) { return s + x[0]; }, 0); a.a = a.A.reduce(function (s, x) { return s + x[0]; }, 0); });
    return L;
  };
  /* dönem sonu: KDV mahsubu */
  var kdvClose = function (L) {
    var hes = L['391'] ? L['391'].a - L['391'].b : 0, ind = L['191'] ? L['191'].b - L['191'].a : 0, s = [];
    if (hes > 0) s.push(['391', hes, 'B']);
    if (ind >= hes) { if (ind - hes > 0) s.push(['190', ind - hes, 'B']); if (ind > 0) s.push(['191', ind, 'A']); }
    else { if (ind > 0) s.push(['191', ind, 'A']); s.push(['360', hes - ind, 'A']); }
    return s;
  };
  var finals = function () {
    var lines = posted(V.ISLEM.length), L0 = ledger(lines), k = kdvClose(L0);
    k.forEach(function (l) { lines.push([l[0], l[1], l[2], 'K']); });
    var L = ledger(lines), bal = function (c) { var a = L[c]; if (!a) return 0; return H[c].nb === 'B' ? a.b - a.a : a.a - a.b; };
    var gt = { sat: bal('600') + bal('601'), smm: bal('621'), fg: bal('760') + bal('770'), fin: bal('780') };
    gt.brut = gt.sat - gt.smm; gt.fk = gt.brut - gt.fg; gt.net = gt.fk - gt.fin;
    var akt = [['100', bal('100')], ['102', bal('102')], ['120', bal('120')], ['153', bal('153')], ['190', bal('190')], ['191', bal('191')]].filter(function (x) { return Math.abs(x[1]) > 0.5; });
    var dur = [['255', bal('255')]];
    var kv = [['300', bal('300')], ['320', bal('320')], ['360', bal('360')]].filter(function (x) { return Math.abs(x[1]) > 0.5; });
    var oz = [['500', bal('500')], ['590', gt.net]];
    var sum = function (a) { return a.reduce(function (s, x) { return s + x[1]; }, 0); };
    return { kdv: k, L: L, gt: gt, akt: akt, dur: dur, kv: kv, oz: oz, A: sum(akt) + sum(dur), P: sum(kv) + sum(oz) };
  };
  FN.muhasebe = { options: options, posted: posted, ledger: ledger, kdvClose: kdvClose, finals: finals };

  /* ---------- çizim ---------- */
  var html = function () {
    return '<div class="card box" style="--cc:var(--rust)"><span class="k">istasyon · muhasebe rıhtımı</span><h2>' + X(V.SIRKET) + ': bir ayın kayıtları</h2><p class="sub">Her fişin doğru yevmiye kaydını seç. Tutarlar büyük deftere taşınır, ay sonunda mizan, gelir tablosu ve bilanço kendiliğinden çıkar.</p>' +
      '<div class="mh"><div><div class="prog"><i data-prog></i></div><div data-fis></div>' +
      '<details style="margin-top:14px"><summary class="k" style="cursor:pointer">hesap planı (seçki)</summary><div class="tbl-w"><table class="t" style="margin-top:6px"><tbody>' + V.HESAP.map(function (h) { return '<tr><td class="mono">' + h[0] + '</td><td>' + X(h[1]) + '</td><td>' + ({ A: 'aktif', P: 'yabancı kaynak', O: 'özkaynak', G: 'gelir', M: 'gider/maliyet' })[h[2]] + '</td><td>' + (h[3] === 'B' ? 'borç' : 'alacak') + ' bakiye</td></tr>'; }).join('') + '</tbody></table></div></details></div>' +
      '<div><h3>Büyük defter</h3><div class="tacc" data-led></div><div class="row" style="margin-top:12px"><button type="button" class="btn sm" data-miz>Mizanı göster</button></div><div data-mizb></div></div></div>' +
      '<div data-end></div></div>';
  };
  var paintLedger = function (n, hit, extra) {
    var lines = posted(n); if (extra) extra.forEach(function (l) { lines.push([l[0], 0, l[2], 'x']); });
    var L = ledger(lines), codes = Object.keys(L).sort();
    var box = $('[data-led]', sec);
    if (!codes.length) { box.innerHTML = '<div class="sub">Henüz kayıt yok. İlk fişi işle.</div>'; return; }
    box.innerHTML = codes.map(function (c) {
      var a = L[c], d = a.b - a.a, side = d >= 0 ? 'B' : 'A';
      var col = function (arr) { return arr.filter(function (x) { return x[0]; }).map(function (x) { return '<i' + (hit && hit.indexOf(x[1]) > -1 ? '' : ' style="animation:none"') + '>' + nf(x[0]) + '<sub>' + x[1] + '</sub></i>'; }).join(''); };
      return '<div class="ta' + (hit && extra && extra.some(function (l) { return l[0] === c; }) ? ' hit' : '') + '" data-acc="' + c + '"><h4><span class="mono">' + c + '</span>' + X(H[c].ad) + '</h4><div class="cols"><div>' + col(a.B) + '</div><div>' + col(a.A) + '</div></div><div class="bk">' + (Math.abs(d) < 0.5 ? 'bakiye yok' : (side === 'B' ? 'borç' : 'alacak') + ' bakiyesi ' + nf(Math.abs(d))) + '</div></div>';
    }).join('');
  };
  var mizan = function (n) {
    var L = ledger(posted(n)), codes = Object.keys(L).sort(), tb = 0, ta = 0, bb = 0, ba = 0;
    var rows = codes.map(function (c) { var a = L[c], d = a.b - a.a; tb += a.b; ta += a.a; if (d > 0) bb += d; else ba -= d; return '<tr><td class="mono">' + c + '</td><td>' + X(H[c].ad) + '</td><td class="n">' + nf(a.b) + '</td><td class="n">' + nf(a.a) + '</td><td class="n">' + (d > 0 ? nf(d) : '') + '</td><td class="n">' + (d < 0 ? nf(-d) : '') + '</td></tr>'; }).join('');
    return '<div class="tbl-w" style="margin-top:10px"><table class="t"><thead><tr><th>Kod</th><th>Hesap</th><th class="n">Borç</th><th class="n">Alacak</th><th class="n">B. bakiye</th><th class="n">A. bakiye</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td></td><td>Toplam</td><td class="n">' + nf(tb) + '</td><td class="n">' + nf(ta) + '</td><td class="n">' + nf(bb) + '</td><td class="n">' + nf(ba) + '</td></tr></tfoot></table></div><p class="sub" style="margin-top:6px">' + (Math.abs(tb - ta) < 0.5 ? '✓ Borç ve alacak toplamları eşit: çift taraflı kayıt kuralı tuttu.' : 'Toplamlar eşit değil.') + '</p>';
  };
  var paintFis = function () {
    var n = V.ISLEM.length;
    $('[data-prog]', sec).style.width = (S.i / n * 100) + '%';
    if (S.i >= n) { $('[data-fis]', sec).innerHTML = '<div class="fis"><span class="no">ay sonu</span><p class="t">Bütün fişler işlendi. Aşağıda dönem sonu kaydı, gelir tablosu ve bilanço var.</p><button type="button" class="btn" data-again>Baştan çöz</button></div>'; paintEnd(); return; }
    var is = V.ISLEM[S.i]; opts = options(is);
    $('[data-fis]', sec).innerHTML = '<div class="fis"><span class="no">FİŞ ' + is.id + ' / ' + n + '</span><span class="k">işlem</span><p class="t">' + X(is.t) + '</p><span class="k">doğru yevmiye kaydı hangisi?</span><div class="yev" style="margin-top:8px">' +
      opts.map(function (o, i) { return '<button type="button" data-o="' + i + '">' + lineHtml(o.s) + '</button>'; }).join('') + '</div><div class="fb" data-fb></div></div>';
    $('[data-end]', sec).innerHTML = '';
  };
  var fly = function (from, to, txt, delay) {
    if (C.RM || !from || !to) return;
    var a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), f = document.createElement('div');
    f.className = 'fly'; f.textContent = txt; f.style.left = (a.left + a.width / 2 - 30) + 'px'; f.style.top = (a.top + a.height / 2 - 10) + 'px';
    document.body.appendChild(f);
    setTimeout(function () { f.style.transform = 'translate(' + (b.left + b.width / 2 - a.left - a.width / 2) + 'px,' + (b.top + 20 - a.top - a.height / 2) + 'px) scale(.8)'; f.style.opacity = '.2'; }, 30 + delay);
    setTimeout(function () { f.remove(); }, 800 + delay);
  };
  var pick = function (i, btn) {
    var o = opts[i], is = V.ISLEM[S.i], fb = $('[data-fb]', sec);
    if (!o || btn.disabled) return;
    if (!o.ok) {
      S.tr++; save(); btn.classList.add('no'); btn.disabled = true;
      fb.innerHTML = '<b style="color:var(--bad)">Olmadı.</b> ' + X(o.why); C.live('Yanlış kayıt. ' + o.why); FN.bridgeSend(); return;
    }
    btn.classList.add('ok'); $$('.yev button', sec).forEach(function (b) { b.disabled = true; });
    fb.innerHTML = '<b style="color:var(--ok)">Doğru.</b> ' + X(is.n);
    S.res.push({ id: is.id, ok: S.tr === 0 }); S.tr = 0;
    /* tutarlar deftere uçar */
    paintLedger(S.i, null, is.s);
    is.s.forEach(function (l, k) { fly(btn, $('[data-acc="' + l[0] + '"]', sec), (l[2] === 'B' ? 'B ' : 'A ') + nf(l[1]), k * 110); });
    var done = S.i + 1;
    setTimeout(function () { paintLedger(done, [is.id], is.s); if ($('[data-mizb]', sec).innerHTML) $('[data-mizb]', sec).innerHTML = mizan(done); }, C.RM ? 0 : 760 + is.s.length * 110);
    setTimeout(function () { S.i = done; save(); paintFis(); FN.bridgeSend(); }, C.RM ? 300 : 2100);
    C.live('Doğru. Kayıt deftere işlendi.');
  };
  var paintEnd = function () {
    var f = finals(), g = f.gt, ok = S.res.filter(function (r) { return r.ok; }).length, n = V.ISLEM.length, p = ok / n * 100;
    var r = function (c, v) { return '<div class="r"><span>' + (c ? '<span class="mono">' + c + '</span> ' + X(H[c].ad) : '') + '</span><b>' + nf(v) + '</b></div>'; };
    var gr = function (t) { return '<div class="r g"><span>' + t + '</span></div>'; };
    var h = '<div class="grid g2" style="margin-top:18px">';
    h += '<div class="card box" style="--cc:var(--must)"><span class="k">dönem sonu kaydı</span><h3>KDV mahsubu</h3><p class="sub">Ay sonunda satışta hesaplanan KDV, alışta ödenen KDV’den düşülür. İndirilecek KDV fazlaysa kalan devreden KDV olur (190); azsa fark ödenecek vergidir (360).</p><div class="yev"><button type="button" disabled>' + lineHtml(f.kdv) + '</button></div>' +
      '<h3 style="margin-top:16px">Gelir tablosu</h3><div class="bil" style="grid-template-columns:1fr"><div>' +
      '<div class="r"><span>Brüt satışlar (600 + 601)</span><b>' + nf(g.sat) + '</b></div><div class="r"><span>Satışların maliyeti (621)</span><b>(' + nf(g.smm) + ')</b></div><div class="r t"><span>Brüt satış kârı</span><b>' + nf(g.brut) + '</b></div>' +
      '<div class="r"><span>Faaliyet giderleri (760 + 770)</span><b>(' + nf(g.fg) + ')</b></div><div class="r t"><span>Faaliyet kârı</span><b>' + nf(g.fk) + '</b></div><div class="r"><span>Finansman giderleri (780)</span><b>(' + nf(g.fin) + ')</b></div><div class="r t"><span>Dönem kârı (vergi yok sayıldı)</span><b>' + nf(g.net) + '</b></div></div></div></div>';
    h += '<div class="card box" style="--cc:var(--sea)"><span class="k">ay sonu</span><h3>Bilanço</h3><div class="bil"><div><h4>AKTİF</h4>' + gr('dönen varlıklar') + f.akt.map(function (x) { return r(x[0], x[1]); }).join('') + gr('duran varlıklar') + f.dur.map(function (x) { return r(x[0], x[1]); }).join('') + '<div class="r t"><span>Toplam</span><b>' + nf(f.A) + '</b></div></div>' +
      '<div><h4>PASİF</h4>' + gr('kısa vadeli yabancı kaynaklar') + f.kv.map(function (x) { return r(x[0], x[1]); }).join('') + gr('özkaynaklar') + f.oz.map(function (x) { return r(x[0], x[1]); }).join('') + '<div class="r t"><span>Toplam</span><b>' + nf(f.P) + '</b></div></div></div>' +
      '<p class="sub" style="margin-top:8px">' + (Math.abs(f.A - f.P) < 0.5 ? '✓ Aktif = Pasif. Dönem kârı özkaynağa (590) eklenince bilanço denkleşti.' : 'Bilanço denk değil.') + '</p>' +
      C.karne(p, 'Muhasebe rıhtımı karnesi', [[ok === n, 'İlk denemede doğru: ' + ok + ' / ' + n + ' fiş'], [true, 'Mizan borç ve alacak toplamı eşit'], [Math.abs(f.A - f.P) < 0.5, 'Bilanço denk: ' + tl(f.A)]], S.res.filter(function (x) { return !x.ok; }).length ? '<b>Tekrar et:</b> ' + S.res.filter(function (x) { return !x.ok; }).map(function (x) { return 'fiş ' + x.id; }).join(', ') + '. Bu işlemlerde hangi hesabın arttığını, hangisinin azaldığını önce söze dök.' : 'Hepsi ilk denemede doğru. Sırada sürekli envanter yerine aralıklı envanterle aynı ayı kaydetmek var.') + '</div></div>';
    $('[data-end]', sec).innerHTML = h;
  };

  FN.st.muhasebe = {
    init: function () {
      sec = $('#muhasebe'); sec.innerHTML = html(); paintLedger(Math.min(S.i, V.ISLEM.length)); paintFis();
      sec.addEventListener('click', function (e) {
        var b = e.target.closest('.yev [data-o]'); if (b) { pick(+b.getAttribute('data-o'), b); return; }
        if (e.target.closest('[data-miz]')) { var mb = $('[data-mizb]', sec); mb.innerHTML = mb.innerHTML ? '' : mizan(Math.min(S.i, V.ISLEM.length)); e.target.closest('[data-miz]').textContent = mb.innerHTML ? 'Mizanı gizle' : 'Mizanı göster'; return; }
        if (e.target.closest('[data-again]')) { S = { i: 0, res: [], tr: 0 }; save(); paintLedger(0); $('[data-mizb]', sec).innerHTML = ''; paintFis(); FN.bridgeSend(); }
      });
    },
    ctx: function () {
      var n = V.ISLEM.length, is = V.ISLEM[Math.min(S.i, n - 1)];
      return { sel: { key: 'finans.muhasebe.' + S.i, title: S.i >= n ? 'ay sonu tabloları' : 'fiş ' + is.id + '/' + n, la: 'Muhasebe',
          rows: S.i >= n ? [['Durum', 'Bütün fişler işlendi; gelir tablosu ve bilanço açık'], ['Dönem kârı', tl(finals().gt.net)]] : [['Fiş', is.t], ['Deneme', S.tr ? S.tr + ' yanlış deneme' : 'ilk deneme']],
          about: 'öğrenci Acadex Finans muhasebe istasyonunda kurgusal bir şirketin işlemleri için doğru yevmiye kaydını seçiyor (Tekdüzen Hesap Planı). Doğru kaydı doğrudan söyleme; hangi hesabın arttığını/azaldığını sorarak düşündür.' },
        chips: S.i >= n ? [['bilanco', 'Dönem kârı bilançoya nasıl girdi?'], ['kdv', 'KDV mahsubunu açıkla']] : [['ipucu', 'Bu fiş için ipucu ver'], ['kural', 'Borç-alacak kuralını hatırlat'], ['kdv', '191 ile 391 farkı ne?']] };
    },
    classify: function (q) { if (/ipucu/.test(q)) return 'ipucu'; if (/kural|borç|alacak/.test(q)) return 'kural'; if (/kdv|191|391/.test(q)) return 'kdv'; if (/bilanço|kâr|kar/.test(q)) return 'bilanco'; return null; },
    answer: function (k) {
      var is = V.ISLEM[S.i];
      if (k === 'ipucu' && is) {
        var gr = is.s.map(function (l) { return H[l[0]].g; }), names = { A: 'bir varlık', P: 'bir borç', O: 'özkaynak', G: 'bir gelir', M: 'bir gider ya da maliyet' };
        var u = gr.filter(function (g, i) { return gr.indexOf(g) === i; });
        return 'Bu işlemde ' + u.map(function (g) { return names[g]; }).join(', ') + ' etkileniyor (' + is.s.length + ' satır). Önce “ne arttı, ne azaldı?” diye sor. Para hangi hesaba girdi, hangisinden çıktı? KDV var mı, yoksa istisna mı?';
      }
      if (k === 'kural') return 'Varlıklar ve giderler borç tarafında artar, alacakta azalır. Borçlar, özkaynak ve gelirler alacakta artar, borçta azalır. Her kayıtta borç toplamı alacak toplamına eşittir.';
      if (k === 'kdv') return '191 İndirilecek KDV, mal ve hizmet alırken ödediğin KDV’dir; devletten alacağın gibidir (aktif). 391 Hesaplanan KDV, satışta müşteriden tahsil ettiğin KDV’dir; devlete borcundur (pasif). Ay sonunda 391’den 191 düşülür: fark borçsa 360 Ödenecek Vergi ve Fonlar, alacaksa 190 Devreden KDV olur. Bu ayda: ' + lineHtmlTxt(finals().kdv) + '.';
      if (k === 'bilanco') { var f = finals(); return 'Gelirler (' + nf(f.gt.sat) + ') eksi maliyet ve giderler dönem kârını verir: ' + nf(f.gt.net) + ' TL. Bu kâr ortaklara aittir, bu yüzden özkaynakta 590 Dönem Net Kârı olarak görünür. Böylece aktif toplamı (' + nf(f.A) + ') pasif toplamına eşitlenir.'; }
      return null;
    }
  };
  var lineHtmlTxt = function (s) { return s.map(function (l) { return l[0] + ' ' + (l[2] === 'B' ? 'borç ' : 'alacak ') + nf(l[1]); }).join(', '); };
})();
