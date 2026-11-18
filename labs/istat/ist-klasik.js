/* ==========================================================================
   ACADEX İSTATİSTİK · klasik sınav ve formül kağıdı (labs/istat/ist-klasik.js), 18.11.2026
   1) Formül kağıdı: bütün haftaların formülleri (IST.OZET) + z, t, χ² tabloları; aranabilir,
      yazdırılabilir. Her sayfada üstteki “formül kağıdı” düğmesiyle sağdan açılır; ipuçları
      ilgili satıra götürüp vurgular. Ayrı sayfa: ?tab=formul
   2) Klasik sınav (15 soru, süreli; vize / final kapsamları): boşluk doldurma (tanım),
      doğru / yanlış, terim (Türkçe ↔ İngilizce), tablo tamamlama, adım adım sayısal
      (formülü seç → yerine koy → sonuç; z / t / χ² tablosundan okuma), olasılık ağacı kurucu.
      Teslimde puan anahtarı ve kısmi puan; ipucu soru puanının dörtte birine mal olur.
   Sözel soru bankası: ist-klasik-banka.js. Önek: ks-
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST; if (!IST || !IST.V) return;
  var V = IST.V, M = IST.M, nf = IST.nf, X = IST.X, W = window, D = W.document || document;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var r4 = function (v) { return nf(v, 4); };
  /* sayı okuma: Türkçe biçim (IST.parse: 1.234,5) ve noktalı ondalık (0.105) ikisi de denenir */
  var adaylar = IST.sayiAday = function (v) { var a = IST.parse(v), b = parseFloat(String(v == null ? '' : v).trim().replace(/\s/g, '').replace(/^−/, '-').replace(',', '.')), out = []; if (!isNaN(a)) out.push(a); if (!isNaN(b) && /^[−-]?\d*([.,]\d+)?$/.test(String(v).trim())) out.push(b); return out; };
  var yakin = function (v, d, tol) { return adaylar(v).some(function (x) { return Math.abs(x - d) <= tol; }); };
  var duz = function (h) { return String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'); };

  /* =====================================================================
     FORMÜL KAĞIDI
     ===================================================================== */
  var formuller = function () {
    var out = [];
    IST.H.forEach(function (H) { var O = (IST.OZET || {})[H.id]; if (!O) return; O.f.forEach(function (f, i) { out.push({ id: 'f-' + H.id + '-' + i, H: H, ad: f[0], f: f[1], not: f[2] || '' }); }); });
    return out;
  };
  IST.formulBul = function (hafta, ad) { var f = formuller().filter(function (x) { return x.H.id === hafta && x.ad === ad; })[0]; return f ? f.id : null; };
  var ZS = []; for (var zi = 0; zi <= 34; zi++) ZS.push(zi / 10);
  var TSD = []; for (var ti = 1; ti <= 30; ti++) TSD.push(ti); TSD.push(40, 60, 120);
  var CSD = []; for (var ci = 1; ci <= 30; ci++) CSD.push(ci);
  var kagit = function (kok, o) {
    o = o || {};
    var L = formuller(), sek = o.odak === 'z' || o.odak === 't' || o.odak === 'c2' ? o.odak : 'f';
    kok.innerHTML = '<div class="ks-fk"><div class="ks-fk-ust"><div class="seg" data-fs role="tablist"><button type="button" data-k="f">Formüller · ' + L.length + '</button><button type="button" data-k="z">z tablosu</button><button type="button" data-k="t">t tablosu</button><button type="button" data-k="c2">χ² tablosu</button></div>' +
      '<label class="vh" for="ks-ara' + (o.pre || '') + '">formül ara</label><input id="ks-ara' + (o.pre || '') + '" class="ks-ara" type="search" placeholder="formül ara: binom, z testi, varyans…" data-ara autocomplete="off">' +
      (o.yazdir ? '<button type="button" class="btn sm" data-fyaz>yazdır</button>' : '') + '</div><div data-fb></div></div>';
    var b = kok.querySelector('[data-fb]'), ara = kok.querySelector('[data-ara]');
    var ciz = function () {
      kok.querySelectorAll('[data-fs] [data-k]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-k') === sek)); });
      ara.hidden = sek !== 'f';
      if (sek === 'z') b.innerHTML = '<p class="ks-tn">P(0 &lt; Z &lt; z): satır z’nin ilk ondalığı, sütun ikinci ondalığı. Sağ kuyruk = 0,5 − tablo değeri.</p>' + IST.ztab(ZS, { hi: false });
      else if (sek === 't') b.innerHTML = '<p class="ks-tn">Sağ kuyrukta α alanını bırakan t değeri. Çift yönlü testte α/2 sütununa bak.</p>' + IST.ttab(TSD);
      else if (sek === 'c2') b.innerHTML = '<p class="ks-tn">Sağ kuyruk alanı α olan χ² değeri.</p>' + IST.c2tab(CSD);
      else {
        var q = String(ara.value || '').toLocaleLowerCase('tr').trim(), son = null, h = '';
        L.forEach(function (f) {
          var metin = (f.ad + ' ' + duz(f.f) + ' ' + f.H.tr + ' ' + f.H.en + ' ' + f.H.no).toLocaleLowerCase('tr');
          if (q && metin.indexOf(q) < 0) return;
          if (son !== f.H) { h += (son ? '</tbody></table></section>' : '') + '<section class="ks-fh"><h3>' + (f.H.donem === 'bahar' ? 'Bahar' : 'Güz') + ' · ' + f.H.no + '. hafta <small>' + X(f.H.tr) + '</small></h3><table class="tb ks-ft"><tbody>'; son = f.H; }
          h += '<tr id="' + (o.pre || '') + f.id + '"' + (o.odak === f.id ? ' class="ks-odak"' : '') + '><td>' + X(f.ad) + (f.not ? '<small>' + f.not + '</small>' : '') + '</td><td class="mono">' + f.f + '</td></tr>';
        });
        b.innerHTML = h ? h + '</tbody></table></section>' : '<p class="ks-tn">Bu aramayla formül yok.</p>';
      }
      if (o.odak && sek === 'f') { var t = b.querySelector('#' + (o.pre || '') + o.odak); if (t) lsafe(function () { t.scrollIntoView({ block: 'center' }); }); }
    };
    kok.querySelector('[data-fs]').addEventListener('click', function (e) { var x = e.target.closest('[data-k]'); if (x) { sek = x.getAttribute('data-k'); ciz(); } });
    ara.addEventListener('input', function () { o.odak = null; ciz(); });
    var yz = kok.querySelector('[data-fyaz]'); if (yz) yz.onclick = function () { D.body.classList.add('ks-yazdir'); var bit = function () { D.body.classList.remove('ks-yazdir'); W.removeEventListener('afterprint', bit); }; W.addEventListener('afterprint', bit); sek = 'f'; ara.value = ''; ciz(); lsafe(function () { W.print(); }); setTimeout(bit, 1500); };
    ciz();
  };
  /* sağdan açılan çekmece */
  var cek = null, cekOnce = null;
  var cekmece = function (baslik, kur) {
    if (!cek) {
      cek = D.createElement('aside'); cek.className = 'ks-cek'; cek.setAttribute('role', 'dialog'); cek.setAttribute('aria-modal', 'false'); cek.setAttribute('aria-labelledby', 'ks-cek-b'); cek.hidden = true;
      cek.innerHTML = '<div class="ks-cek-h"><b id="ks-cek-b"></b><button type="button" class="btn sm ghost" data-kapat aria-label="Kapat">✕</button></div><div class="ks-cek-i" data-ic></div>';
      D.body.appendChild(cek);
      cek.querySelector('[data-kapat]').onclick = function () { cekKapat(); };
      cek.addEventListener('keydown', function (e) { if (e.key === 'Escape') cekKapat(); });
    }
    cekOnce = D.activeElement;
    cek.querySelector('#ks-cek-b').textContent = baslik; kur(cek.querySelector('[data-ic]'));
    cek.hidden = false; D.body.classList.add('ks-cek-acik');
    setTimeout(function () { var f = cek.querySelector('[data-kapat]'); if (f) f.focus(); }, 30);
  };
  var cekKapat = function () { if (!cek || cek.hidden) return; cek.hidden = true; D.body.classList.remove('ks-cek-acik'); if (cekOnce && cekOnce.focus) lsafe(function () { cekOnce.focus(); }); };
  IST.formul = {
    ac: function (odak) { cekmece('Formül kağıdı', function (el) { kagit(el, { odak: odak, pre: 'c' }); }); },
    ozet: function (hafta) {
      var H = IST.by[hafta], O = (IST.OZET || {})[hafta]; if (!H || !O) return;
      cekmece(H.no + '. hafta özeti', function (el) { el.innerHTML = '<div class="ks-oz"><h3>' + X(H.tr) + ' <small>' + X(H.en) + '</small></h3><ul>' + O.m.map(function (m) { return '<li>' + m + '</li>'; }).join('') + '</ul></div>'; });
    },
    kapat: cekKapat
  };
  D.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-formul]');
    if (b) { e.preventDefault(); IST.formul.ac(b.getAttribute('data-formul') || null); }
  });

  /* =====================================================================
     CEVAP KARŞILAŞTIRMA
     ===================================================================== */
  var KAT = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u', '−': '-', '–': '-', '—': '-', '·': '.', '’': '', "'": '' };
  var katla = IST.katla = function (s) { return String(s || '').toLocaleLowerCase('tr').replace(/[çğıöşüâîû−–—·’']/g, function (c) { return KAT[c]; }).replace(/[^a-z0-9.,%/+\-² ]/g, ' ').replace(/\s*([-/])\s*/g, '$1').replace(/\s+/g, ' ').trim(); };
  var metinDogru = IST.metinDogru = function (v, kabul) { var k = katla(v); if (!k) return false; return kabul.some(function (a) { return katla(a) === k; }); };

  /* =====================================================================
     SORU ŞABLONLARI
     ===================================================================== */
  /* terim soruları: sahnelerdeki [Türkçe, İngilizce] çiftleri */
  /* İngilizce terimden formül parçasını at: "binomial distribution X ~ B(n, p)" → "binomial distribution"; "Student’s t distribution" korunur */
  var enTemiz = function (s) { var w = []; String(s).split(/\s+/).some(function (t) { if (!/^[A-Za-z’'\-–]+$/.test(t) || (t.length === 1 && /[A-Z]/.test(t))) return w.length > 0; w.push(t); return false; }); return w.join(' '); };
  var enKabul = function (en) { var L = [en], k = en.replace(/\s+[a-z]$/, ''); if (k !== en && k.length >= 3) L.push(k); return L; };
  var trSecenek = function (s) { return String(s).split(/\s*\/\s*/).map(function (p) { return p.replace(/\([^)]*\)/g, '').trim(); }).filter(Boolean).concat([String(s).replace(/\([^)]*\)/g, '').trim()]); };
  var terimler = function (hafta) {
    var H = IST.by[hafta], out = []; if (!H) return out;
    H.sahneler.forEach(function (s) { (s.terim || []).forEach(function (t) { var en = enTemiz(t[1]); if (en.length >= 3 && !/[=~√]/.test(t[0]) && t[0].length <= 40) out.push({ tr: t[0], en: en }); }); });
    return out;
  };

  /* sayısal şablonlar: f = formül adı (IST.OZET’teki ad), adim: [{ t, say, tol?, tablo? }], karar?: { t, o, a } */
  var SAYISAL = {
    g5: function (r) {
      var n = r.pick([7, 8, 9, 10]), v = []; for (var i = 0; i < n; i++) v.push(r.int(12, 48)); var s = v.slice().sort(function (a, b) { return a - b; }), k = (n + 1) / 2, md = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
      return { f: 'Medyan konumu', soru: '<p>Bir kafede ' + n + ' günde satılan tatlı sayıları: <b class="mono">' + v.join(', ') + '</b>.</p><p>Medyanı bulunuz.</p>', adim: [{ t: 'Medyanın konumu', say: k, yk: '(' + n + ' + 1) / 2' }, { t: 'Medyan', say: md, yk: 'sıralı veri: ' + s.join(', ') + ' → ' + (n % 2 ? k + '. değer' : '(' + s[n / 2 - 1] + ' + ' + s[n / 2] + ') / 2') }] };
    },
    g6: function (r) {
      var dersler = r.shuf([['İstatistik', 6], ['İktisat', 5], ['Muhasebe', 4], ['Hukuk', 3], ['İngilizce', 2]]).slice(0, 4), notlar = dersler.map(function () { return r.pick([1, 1.5, 2, 2.5, 3, 3.5, 4]); });
      var sw = dersler.reduce(function (a, d) { return a + d[1]; }, 0), swx = dersler.reduce(function (a, d, i) { return a + d[1] * notlar[i]; }, 0);
      return { f: 'Ağırlıklı ortalama', soru: '<p>Bir öğrencinin dönem dersleri, kredileri ve harf notu karşılıkları (4’lük) yanda.</p><p>Dönem not ortalamasını (GNO) bulunuz.</p>',
        g: V.tablo(['Ders', 'Kredi (w)', 'Not (x)'], dersler.map(function (d, i) { return [d[0], String(d[1]), nf(notlar[i], 1)]; }), { n: [1, 2], st: 0 }),
        adim: [{ t: 'Σ w·x', say: swx, yk: dersler.map(function (d, i) { return d[1] + '·' + nf(notlar[i], 1); }).join(' + ') }, { t: 'Σ w', say: sw, yk: dersler.map(function (d) { return d[1]; }).join(' + ') }, { t: 'Ağırlıklı ortalama x̄w (iki ondalık)', say: swx / sw, tol: 0.006, yk: nf(swx, 1) + ' / ' + sw }] };
    },
    g9: function (r) {
      var v = []; for (var i = 0; i < 5; i++) v.push(r.int(2, 20)); var m = M.mean ? M.mean(v) : v.reduce(function (a, b) { return a + b; }, 0) / 5, ss = v.reduce(function (a, x) { return a + (x - m) * (x - m); }, 0);
      return { f: 'Örneklem varyansı', soru: '<p>Bir mağazada 5 günün iade sayıları: <b class="mono">' + v.join(', ') + '</b>.</p><p>Örneklem varyansını bulunuz.</p>',
        adim: [{ t: 'Ortalama x̄', say: m, tol: 0.006, yk: '(' + v.join(' + ') + ') / 5' }, { t: 'Σ(x − x̄)²', say: ss, tol: 0.06, yk: v.map(function (x) { return '(' + x + ' − ' + nf(m, 1) + ')²'; }).join(' + ') }, { t: 'Örneklem varyansı s² (iki ondalık)', say: ss / 4, tol: 0.02, yk: nf(ss, 2) + ' / (5 − 1)' }] };
    },
    g10: function (r) {
      var xs = [0, 1, 2, 3], ps = r.pick([[0.1, 0.3, 0.4, 0.2], [0.2, 0.4, 0.3, 0.1], [0.15, 0.35, 0.3, 0.2], [0.3, 0.3, 0.25, 0.15]]), E = 0, E2 = 0;
      xs.forEach(function (x, i) { E += x * ps[i]; E2 += x * x * ps[i]; });
      return { f: 'Beklenen değer', soru: '<p>Bir sigorta şirketinde bir poliçe sahibinin yıllık hasar bildirimi sayısı X’in dağılımı yanda.</p><p>E(X) ve Var(X)’i bulunuz.</p>',
        g: V.tablo(['x', '0', '1', '2', '3'], [['P(x)'].concat(ps.map(function (p) { return nf(p, 2); }))], { n: [1, 2, 3, 4], st: 0 }),
        adim: [{ t: 'E(X) = Σx·P(x)', say: E, tol: 0.006, yk: xs.map(function (x, i) { return x + '·' + nf(ps[i], 2); }).join(' + ') }, { t: 'E(X²) = Σx²·P(x)', say: E2, tol: 0.006, yk: xs.map(function (x, i) { return x * x + '·' + nf(ps[i], 2); }).join(' + ') }, { t: 'Var(X) = E(X²) − μ² (dört ondalık)', say: E2 - E * E, tol: 0.0006, yk: nf(E2, 2) + ' − ' + nf(E, 2) + '²' }] };
    },
    g11: function (r) {
      var n = r.int(5, 9), p = r.pick([0.1, 0.2, 0.25, 0.3, 0.4]), x = r.int(1, 3), c = M.C(n, x), t = Math.pow(p, x) * Math.pow(1 - p, n - x);
      return { f: 'Binom', soru: '<p>Bir çağrı merkezinde aramaların %' + Math.round(p * 100) + ' oranında satışla sonuçlandığı biliniyor. Rastgele ' + n + ' arama seçiliyor.</p><p>Tam ' + x + ' aramanın satışla sonuçlanma olasılığını bulunuz.</p>',
        adim: [{ t: 'C(' + n + ', ' + x + ')', say: c, tol: 0.5, yk: n + '! / (' + x + '!·' + (n - x) + '!)' }, { t: 'pˣ·qⁿ⁻ˣ (dört ondalık)', say: t, tol: 0.0006, yk: nf(p, 2) + '^' + x + '·' + nf(1 - p, 2) + '^' + (n - x) }, { t: 'P(X = ' + x + ') (dört ondalık)', say: c * t, tol: 0.0006, yk: c + '·' + nf(t, 4) }] };
    },
    g12: function (r) {
      var N = r.int(12, 20), K = r.int(3, 6), n = r.int(3, 5), x = r.int(1, Math.min(2, K, n)), a = M.C(K, x), b = M.C(N - K, n - x), c = M.C(N, n);
      return { f: 'Hipergeometrik', soru: '<p>Bir kolide ' + N + ' parçanın ' + K + ' tanesi kusurlu. Denetçi yerine koymadan ' + n + ' parça seçiyor.</p><p>Tam ' + x + ' kusurlu parça seçilme olasılığını bulunuz.</p>',
        adim: [{ t: 'C(K, x) = C(' + K + ', ' + x + ')', say: a, tol: 0.5, yk: K + '! / (' + x + '!·' + (K - x) + '!)' }, { t: 'C(N − K, n − x) = C(' + (N - K) + ', ' + (n - x) + ')', say: b, tol: 0.5, yk: (N - K) + '! / (' + (n - x) + '!·' + (N - K - n + x) + '!)' }, { t: 'C(N, n) = C(' + N + ', ' + n + ')', say: c, tol: 0.5, yk: N + '! / (' + n + '!·' + (N - n) + '!)' }, { t: 'P(X = ' + x + ') (dört ondalık)', say: a * b / c, tol: 0.0006, yk: a + '·' + b + ' / ' + c }] };
    },
    g14: function (r) {
      var mu = r.pick([4, 5, 8, 10]), x = r.pick([2, 3, 5, 6]), l = 1 / mu;
      return { f: 'Üstel', soru: '<p>Bir bankada müşterilerin gelişleri arasında geçen süre üstel dağılıyor; ortalama ' + mu + ' dakika.</p><p>Bir sonraki müşterinin ' + x + ' dakika içinde gelme olasılığını bulunuz.</p>',
        adim: [{ t: 'λ = 1/μ (dört ondalık)', say: l, tol: 0.0006, yk: '1 / ' + mu }, { t: 'λx (dört ondalık)', say: l * x, tol: 0.0006, yk: nf(l, 4) + '·' + x }, { t: 'P(X ≤ ' + x + ') = 1 − e^(−λx) (dört ondalık)', say: 1 - Math.exp(-l * x), tol: 0.0006, yk: '1 − e^(−' + nf(l * x, 4) + ')' }] };
    },
    g15: function (r) {
      var mu = r.pick([60, 65, 70, 500]), s = mu > 100 ? r.pick([80, 100]) : r.pick([8, 10, 12]), z = r.pick([0.5, 0.75, 1, 1.25, 1.5, 1.8, 2]), x = mu + z * s, tb = M.ztab(z);
      return { f: 'z puanı', soru: '<p>Bir sınavın puanları normal dağılıyor: μ = ' + mu + ', σ = ' + s + '.</p><p>Rastgele seçilen bir öğrencinin <b>' + nf(x, 1) + '</b> puandan yüksek alma olasılığını bulunuz. (z tablosunu kullanınız)</p>',
        adim: [{ t: 'z = (x − μ)/σ', say: z, tol: 0.006, yk: '(' + nf(x, 1) + ' − ' + mu + ') / ' + s }, { t: 'Tablodan P(0 < Z < z)', say: tb, tol: 0.0006, tablo: 'z', tz: z, yk: 'z = ' + nf(z, 2) + ' satır/sütunu' }, { t: 'P(X > ' + nf(x, 1) + ') = 0,5 − tablo değeri (dört ondalık)', say: 0.5 - tb, tol: 0.0006, yk: '0,5 − ' + nf(tb, 4) }], egri: { adim: 0, tur: 'z', kuyruk: 'sag' } };
    },
    b2: function (r) {
      var mu = r.pick([200, 250, 500]), s = r.pick([20, 30, 40]), n = r.pick([25, 36, 64, 100]), se = s / Math.sqrt(n), z = r.pick([1, 1.5, 2]), xb = mu + z * se, tb = M.ztab(z);
      return { f: 'Standart hata', soru: '<p>Bir dolum makinesinde şişe hacmi μ = ' + mu + ' ml, σ = ' + s + ' ml. Rastgele ' + n + ' şişe alınıyor.</p><p>Örneklem ortalamasının <b>' + nf(xb, 2) + '</b> ml’den büyük olma olasılığını bulunuz.</p>',
        adim: [{ t: 'σx̄ = σ/√n', say: se, tol: 0.006, yk: s + ' / √' + n }, { t: 'z = (x̄ − μ)/σx̄', say: z, tol: 0.006, yk: '(' + nf(xb, 2) + ' − ' + mu + ') / ' + nf(se, 2) }, { t: 'Tablodan P(0 < Z < z)', say: tb, tol: 0.0006, tablo: 'z', tz: z, yk: 'z = ' + nf(z, 2) + ' satır/sütunu' }, { t: 'P(x̄ > ' + nf(xb, 2) + ') (dört ondalık)', say: 0.5 - tb, tol: 0.0006, yk: '0,5 − ' + nf(tb, 4) }], egri: { adim: 1, tur: 'z', kuyruk: 'sag' } };
    },
    b3: function (r) {
      var gd = r.pick([[90, 1.645], [95, 1.96], [99, 2.576]]), xb = r.pick([48, 52, 120, 75]), s = r.pick([6, 8, 10, 12]), n = r.pick([36, 49, 64, 100]), e = gd[1] * s / Math.sqrt(n);
      return { f: 'z aralığı', soru: '<p>Bir kargo şubesinde ' + n + ' gönderinin ortalama teslim süresi x̄ = ' + xb + ' saat; σ = ' + s + ' saat biliniyor.</p><p>Anakütle ortalaması için %' + gd[0] + ' güven aralığını bulunuz.</p>',
        adim: [{ t: 'z<sub>α/2</sub> (tablodan)', say: gd[1], tol: 0.012, tablo: 'z', tz: gd[1], yk: 'tabloda ' + nf((1 - (100 - gd[0]) / 100) / 2, 4) + ' alanını veren z' }, { t: 'Hata payı E = z·σ/√n (dört ondalık)', say: e, tol: 0.006, yk: nf(gd[1], 3) + '·' + s + ' / √' + n }, { t: 'Alt sınır', say: xb - e, tol: 0.012, yk: xb + ' − ' + nf(e, 4) }, { t: 'Üst sınır', say: xb + e, tol: 0.012, yk: xb + ' + ' + nf(e, 4) }] };
    },
    b5: function (r) {
      var n = r.pick([9, 12, 16, 20, 25]), mu0 = r.pick([50, 100, 200]), s = r.pick([6, 8, 10, 12]), a = r.pick([0.05, 0.01]), tk = M.tkr(a, n - 1), se = s / Math.sqrt(n), t = r.pick([-1, 1]) * r.pick([1.2, 1.9, 2.4, 3.1]), xb = mu0 + t * se, cift = r() < 0.5, kr = cift ? M.tkr(a / 2, n - 1) : tk, red = cift ? Math.abs(t) > kr : t > kr;
      if (!cift && t < 0) { t = -t; xb = mu0 + t * se; red = t > kr; }
      return { f: 't testi', soru: '<p>Bir fabrikada bir parçanın ortalama işleme süresinin ' + mu0 + ' saniye olduğu iddia ediliyor. ' + n + ' ölçümde x̄ = ' + nf(xb, 2) + ', s = ' + s + ' bulundu.</p><p>H₀: μ = ' + mu0 + ', H₁: μ ' + (cift ? '≠' : '>') + ' ' + mu0 + ' hipotezlerini α = ' + nf(a, 2) + ' ile test ediniz. (t tablosunu kullanınız)</p>',
        adim: [{ t: 's/√n (dört ondalık)', say: se, tol: 0.0006, yk: s + ' / √' + n }, { t: 't = (x̄ − μ₀)/(s/√n)', say: t, tol: 0.012, yk: '(' + nf(xb, 2) + ' − ' + mu0 + ') / ' + nf(se, 4) }, { t: 'Kritik t (sd = ' + (n - 1) + ', ' + (cift ? 'α/2 = ' + nf(a / 2, 3) : 'α = ' + nf(a, 2)) + ')', say: kr, tol: 0.006, tablo: 't', sd: n - 1, ta: cift ? a / 2 : a, yk: 'sd = ' + (n - 1) + ' satırı' }], egri: { adim: 1, tur: 't', sd: n - 1, kuyruk: cift ? 'iki' : 'sag' },
        karar: { t: 'Karar', o: ['H₀ reddedilir', 'H₀ reddedilmez'], a: red ? 0 : 1 } };
    },
    b7: function (r) {
      var c = 3, nj = r.pick([5, 6, 8]), n = c * nj, ssb = r.int(40, 140), ssw = r.int(90, 260), msb = ssb / (c - 1), msw = ssw / (n - c), F = msb / msw, fk = { 15: 3.885, 18: 3.682, 24: 3.467 }[n];
      return { f: 'F oranı', soru: '<p>Üç reklam kampanyasının satışa etkisi için her kampanyadan ' + nj + ' mağaza incelendi. SSB = ' + ssb + ', SSW = ' + ssw + '.</p><p>α = 0,05 ile kampanyaların ortalama satışları arasında fark var mı? (F<sub>kritik</sub>(' + (c - 1) + ', ' + (n - c) + ') = ' + nf(fk, 3) + ')</p>',
        adim: [{ t: 'MSB = SSB/(c − 1)', say: msb, tol: 0.012, yk: ssb + ' / ' + (c - 1) }, { t: 'MSW = SSW/(n − c) (dört ondalık)', say: msw, tol: 0.006, yk: ssw + ' / ' + (n - c) }, { t: 'F = MSB/MSW (dört ondalık)', say: F, tol: 0.006, yk: nf(msb, 2) + ' / ' + nf(msw, 4) }],
        karar: { t: 'Karar', o: ['H₀ reddedilir: en az bir ortalama farklı', 'H₀ reddedilmez: fark yok denebilir'], a: F > fk ? 0 : 1 } };
    },
    b9: function (r) {
      var sxx = r.int(80, 300), syy = r.int(80, 300), rr = r.pick([-0.85, -0.6, 0.4, 0.7, 0.9]), sxy = Math.round(rr * Math.sqrt(sxx * syy)), rv = sxy / Math.sqrt(sxx * syy);
      return { f: 'Pearson r', soru: '<p>Bir şirkette reklam harcaması (x) ile satış (y) için: Σ(x − x̄)² = ' + sxx + ', Σ(y − ȳ)² = ' + syy + ', Σ(x − x̄)(y − ȳ) = ' + sxy + '.</p><p>Pearson korelasyon katsayısını ve belirlilik katsayısını bulunuz.</p>',
        adim: [{ t: '√(Σ(x − x̄)²·Σ(y − ȳ)²) (iki ondalık)', say: Math.sqrt(sxx * syy), tol: 0.02, yk: '√(' + sxx + '·' + syy + ')' }, { t: 'r (dört ondalık)', say: rv, tol: 0.0006, yk: sxy + ' / ' + nf(Math.sqrt(sxx * syy), 2) }, { t: 'r² (dört ondalık)', say: rv * rv, tol: 0.0012, yk: nf(rv, 4) + '²' }] };
    },
    b10: function (r) {
      var xb = r.pick([10, 20, 25]), yb = r.pick([50, 80, 120]), sxx = r.pick([100, 200, 250]), b = r.pick([1.2, 1.5, 2, 2.4, 3]), sxy = b * sxx, a = yb - b * xb, x0 = xb + r.pick([2, 5, 8]);
      return { f: 'Eğim', soru: '<p>Bir kafede sıcaklık (x, °C) ile soğuk içecek satışı (y) için: x̄ = ' + xb + ', ȳ = ' + yb + ', Σ(x − x̄)² = ' + sxx + ', Σ(x − x̄)(y − ȳ) = ' + nf(sxy, 1) + '.</p><p>Regresyon doğrusunu kurup x = ' + x0 + ' için satışı tahmin ediniz.</p>',
        adim: [{ t: 'Eğim b', say: b, tol: 0.006, yk: nf(sxy, 1) + ' / ' + sxx }, { t: 'Kesişim a = ȳ − b·x̄', say: a, tol: 0.012, yk: yb + ' − ' + nf(b, 2) + '·' + xb }, { t: 'ŷ(' + x0 + ') = a + b·' + x0, say: a + b * x0, tol: 0.012, yk: nf(a, 2) + ' + ' + nf(b, 2) + '·' + x0 }] };
    },
    b11: function (r) {
      var k = r.pick([3, 4]), n = k * r.pick([20, 25, 30]), E = n / k, O = [], kalan = n; for (var i = 0; i < k - 1; i++) { var o = Math.round(E + r.int(-9, 9)); O.push(o); kalan -= o; } O.push(kalan);
      var c2 = O.reduce(function (s, o) { return s + (o - E) * (o - E) / E; }, 0), kr = M.c2kr(0.05, k - 1), ad = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe'].slice(0, k);
      return { f: 'Ki-kare', soru: '<p>Bir mağaza yöneticisi müşterilerin günlere eşit dağıldığını iddia ediyor. ' + n + ' müşterinin gelişi yanda.</p><p>α = 0,05 ile iddiayı test ediniz. (χ² tablosunu kullanınız)</p>',
        g: V.tablo(['Gün'].concat(ad), [['Gözlenen (O)'].concat(O.map(String))], { n: ad.map(function (_, j) { return j + 1; }), st: 0 }),
        adim: [{ t: 'Beklenen frekans E (her gün)', say: E, tol: 0.006, yk: n + ' / ' + k }, { t: 'χ² = Σ(O − E)²/E (dört ondalık)', say: c2, tol: 0.006, yk: O.map(function (o) { return '(' + o + ' − ' + nf(E, 1) + ')²/' + nf(E, 1); }).join(' + ') }, { t: 'Kritik χ² (sd = ' + (k - 1) + ', α = 0,05)', say: kr, tol: 0.006, tablo: 'c2', sd: k - 1, ta: 0.05, yk: 'sd = ' + (k - 1) + ' satırı' }],
        karar: { t: 'Karar', o: ['H₀ reddedilir: dağılım eşit değil', 'H₀ reddedilmez: eşit dağılım reddedilemez'], a: c2 > kr ? 0 : 1 } };
    },
    b13: function (r) {
      var urun = [['Ekmek', r.pick([5, 6, 8]), r.pick([7, 9, 10]), r.pick([30, 40])], ['Süt', r.pick([20, 25]), r.pick([28, 32, 35]), r.pick([10, 12])], ['Peynir', r.pick([90, 120]), r.pick([140, 160, 180]), r.pick([2, 3])]];
      var ust = urun.reduce(function (s, u) { return s + u[2] * u[3]; }, 0), alt = urun.reduce(function (s, u) { return s + u[1] * u[3]; }, 0);
      return { f: 'Laspeyres', soru: '<p>Bir ailenin aylık sepetinde üç ürünün baz yıl fiyatı (p₀), cari yıl fiyatı (pₜ) ve baz yıl miktarı (q₀) yanda.</p><p>Laspeyres fiyat indeksini bulunuz.</p>',
        g: V.tablo(['Ürün', 'p₀', 'pₜ', 'q₀'], urun.map(function (u) { return [u[0], String(u[1]), String(u[2]), String(u[3])]; }), { n: [1, 2, 3], st: 0 }),
        adim: [{ t: 'Σ pₜ·q₀', say: ust, yk: urun.map(function (u) { return u[2] + '·' + u[3]; }).join(' + ') }, { t: 'Σ p₀·q₀', say: alt, yk: urun.map(function (u) { return u[1] + '·' + u[3]; }).join(' + ') }, { t: 'L = Σpₜq₀/Σp₀q₀ × 100 (iki ondalık)', say: ust / alt * 100, tol: 0.012, yk: ust + ' / ' + alt + ' × 100' }] };
    },
    b14: function (r) {
      var p = r.pick([0.3, 0.4, 0.6, 0.7]), A = [r.int(80, 160), r.int(-40, 20)], B = [r.int(40, 90), r.int(20, 60)];
      if (Math.abs((A[0] * p + A[1] * (1 - p)) - (B[0] * p + B[1] * (1 - p))) < 1) A[0] += 7;
      var ea = A[0] * p + A[1] * (1 - p), eb = B[0] * p + B[1] * (1 - p);
      return { f: 'EMV', soru: '<p>Bir girişim iki yatırım arasında karar verecek. Pazar <b>iyi</b> olursa (olasılık ' + nf(p, 1) + ') ya da <b>kötü</b> olursa getiriler (bin TL) yanda.</p><p>Beklenen parasal değer ölçütüne göre hangi yatırım seçilmelidir?</p>',
        g: V.tablo(['', 'İyi pazar', 'Kötü pazar'], [['A yatırımı', String(A[0]), String(A[1])], ['B yatırımı', String(B[0]), String(B[1])]], { n: [1, 2], st: 0 }),
        adim: [{ t: 'EMV(A)', say: ea, tol: 0.012, yk: A[0] + '·' + nf(p, 1) + ' + ' + A[1] + '·' + nf(1 - p, 1) }, { t: 'EMV(B)', say: eb, tol: 0.012, yk: B[0] + '·' + nf(p, 1) + ' + ' + B[1] + '·' + nf(1 - p, 1) }],
        karar: { t: 'Karar', o: ['A yatırımı', 'B yatırımı'], a: ea > eb ? 0 : 1 } };
    }
  };
  IST.KLASIK_SAYISAL = SAYISAL;

  /* tablo tamamlama: frekans tablosunda boşluklar (3. ve 4. hafta) */
  var tabloSoru = function (r) {
    var sinif = ['0–10', '10–20', '20–30', '30–40', '40–50'], f = sinif.map(function () { return r.int(3, 14); }), n = f.reduce(function (a, b) { return a + b; }, 0), F = [], s = 0;
    f.forEach(function (x) { s += x; F.push(s); });
    var hucre = []; sinif.forEach(function (_, i) { hucre.push({ i: i, k: 'g', say: f[i] / n }); hucre.push({ i: i, k: 'F', say: F[i] }); });
    var bos = r.shuf(hucre).slice(0, 4);
    return { tip: 'tablo', hafta: 'g3', puan: 8, f: 'Göreli frekans', n: n, sinif: sinif, fr: f, F: F, bos: bos,
      soru: '<p>Bir kargo şubesinde 1 günde teslim edilen ' + n + ' paketin teslim süreleri (dakika) gruplanmış. Tablodaki boşlukları doldurunuz. (Göreli frekansı dört ondalık yazınız.)</p>' };
  };

  /* olasılık ağacı (Bayes): tedarikçi / şube / kanal senaryoları */
  var agacSoru = function (r) {
    var sc = r.pick([
      { kok: 'tedarikçi', olay: 'kusurlu', olayD: 'kusursuz', ad: ['A', 'B', 'C'], ne: 'Bir montaj fabrikası parçaları üç tedarikçiden alıyor' },
      { kok: 'kanal', olay: 'iade', olayD: 'iade yok', ad: ['Mobil', 'Web', 'Mağaza'], ne: 'Bir perakendecinin siparişleri üç kanaldan geliyor' },
      { kok: 'vardiya', olay: 'hatalı', olayD: 'hatasız', ad: ['Sabah', 'Akşam'], ne: 'Bir fabrikada üretim iki vardiyada yapılıyor' }
    ]);
    var k = sc.ad.length, pay = k === 3 ? r.pick([[0.5, 0.3, 0.2], [0.4, 0.35, 0.25], [0.45, 0.35, 0.2]]) : r.pick([[0.6, 0.4], [0.55, 0.45], [0.7, 0.3]]);
    var oran = sc.ad.map(function () { return r.int(2, 12) / 100; }), hedef = r.int(0, k - 1);
    var pk = pay.reduce(function (s, p, i) { return s + p * oran[i]; }, 0);
    return { tip: 'agac', hafta: 'g7', puan: 12, f: 'Bayes', sc: sc, pay: pay, oran: oran, hedef: hedef, pk: pk, post: pay[hedef] * oran[hedef] / pk,
      soru: '<p>' + sc.ne + ': ' + sc.ad.map(function (a, i) { return a + ' %' + Math.round(pay[i] * 100); }).join(', ') + '. ' + X(sc.olay.charAt(0).toLocaleUpperCase('tr') + sc.olay.slice(1)) + ' oranları sırasıyla ' + sc.ad.map(function (a, i) { return a + ' %' + Math.round(oran[i] * 100); }).join(', ') + '.</p>' +
        '<p>Olasılık ağacını çizerek rastgele seçilen ve <b>' + X(sc.olay) + '</b> olduğu görülen bir birimin <b>' + X(sc.ad[hedef]) + '</b> kaynaklı olma olasılığını bulunuz.</p>' };
  };

  /* =====================================================================
     SINAV KURMA: 15 soru (bölümler: A boşluk, B doğru/yanlış, C terim, D problemler)
     ===================================================================== */
  var KSAV = [
    { id: 'ks-gv', ad: 'Güz · vize · klasik', hf: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'] },
    { id: 'ks-gf', ad: 'Güz · final · klasik', hf: ['g9', 'g10', 'g11', 'g12', 'g13', 'g14', 'g15'] },
    { id: 'ks-bv', ad: 'Bahar · vize · klasik', hf: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'] },
    { id: 'ks-bf', ad: 'Bahar · final · klasik', hf: ['b9', 'b10', 'b11', 'b12', 'b13', 'b14'] }
  ];
  IST.KLASIK_SINAV = KSAV;
  var sinavKur = IST.sinavKur = function (hf, r) {
    var B = IST.KLASIK || {}, hes = [];
    hf.forEach(function (h) { if (SAYISAL[h]) hes.push({ tip: 'sayisal', hafta: h, gen: SAYISAL[h] }); });
    if (hf.indexOf('g7') > -1) hes.push({ tip: 'agac', hafta: 'g7' });
    if (hf.indexOf('g3') > -1 || hf.indexOf('g4') > -1) hes.push({ tip: 'tablo', hafta: 'g3' });
    hes = r.shuf(hes);
    var ag = hes.filter(function (h) { return h.tip === 'agac'; }), digr = hes.filter(function (h) { return h.tip !== 'agac'; }), nh = Math.min(6, hes.length);
    var secH = ag.concat(digr).slice(0, nh);
    var kalan = 15 - secH.length, nt = Math.round(kalan * 4 / 9), nd = Math.round(kalan * 3 / 9), nm = kalan - nt - nd;
    var havT = [], havD = [], havM = [];
    hf.forEach(function (h) {
      ((B[h] || {}).t || []).forEach(function (q) { havT.push({ tip: 'bosluk', hafta: h, metin: q[0], kabul: q[1], puan: 5 }); });
      ((B[h] || {}).dy || []).forEach(function (q) { havD.push({ tip: 'dy', hafta: h, metin: q[0], dogru: q[1], neden: q[2], puan: 4 }); });
      terimler(h).forEach(function (t) { havM.push({ tip: 'terim', hafta: h, t: t, puan: 4 }); });
    });
    /* haftaları dengeli dağıt: önce her haftadan birer, sonra kalanlar */
    var dengeli = function (hav, n) { var by = {}, out = []; r.shuf(hav).forEach(function (q) { (by[q.hafta] = by[q.hafta] || []).push(q); }); var ks = r.shuf(Object.keys(by)); while (out.length < n && ks.some(function (k) { return by[k].length; })) ks.forEach(function (k) { if (out.length < n && by[k].length) out.push(by[k].shift()); }); return out; };
    var A = dengeli(havT, nt), Bq = dengeli(havD, nd), Cq = dengeli(havM, nm).map(function (q) { q.yon = r() < 0.5 ? 'en' : 'tr'; return q; });
    var Dq = secH.map(function (h) {
      if (h.tip === 'agac') return agacSoru(r);
      if (h.tip === 'tablo') return tabloSoru(r);
      var s = h.gen(r); s.tip = 'sayisal'; s.hafta = h.hafta; s.puan = 10; return s;
    });
    /* eksik kalırsa sözelle tamamla */
    var hepsi = A.concat(Bq, Cq, Dq);
    if (hepsi.length < 15) { var ek = dengeli(havT.concat(havD).filter(function (q) { return hepsi.indexOf(q) < 0; }), 15 - hepsi.length); hepsi = hepsi.concat(ek); }
    var sira = { bosluk: 0, dy: 1, terim: 2, tablo: 3, sayisal: 4, agac: 5 };
    return hepsi.slice(0, 15).sort(function (a, b) { return sira[a.tip] - sira[b.tip]; });
  };

  /* =====================================================================
     SORU KARTLARI (sınav modunda geri bildirim yok; teslimde puan anahtarı)
     ===================================================================== */
  var BOLUM = { bosluk: 'A · Tanım ve boşluk doldurma', dy: 'B · Doğru / yanlış', terim: 'C · Terimler (Türkçe ↔ İngilizce)', tablo: 'D · Problemler', sayisal: 'D · Problemler', agac: 'D · Problemler' };
  var fId = function (Q) { return Q.f ? IST.formulBul(Q.hafta, Q.f) : null; };
  var formulSecenek = function (Q, r) {
    var O = ((IST.OZET || {})[Q.hafta] || { f: [] }).f.map(function (f) { return f[0]; }), d = O.indexOf(Q.f) > -1 ? O.slice() : [Q.f].concat(O);
    var dis = []; IST.H.forEach(function (H) { if (H.id !== Q.hafta) ((IST.OZET || {})[H.id] || { f: [] }).f.forEach(function (f) { dis.push(f[0]); }); });
    d = r.shuf(d.filter(function (x) { return x !== Q.f; })).slice(0, 3).concat([Q.f]);
    while (d.length < 4) { var x = r.pick(dis); if (d.indexOf(x) < 0) d.push(x); }
    return r.shuf(d);
  };
  var kart = function (Q, i, r) {
    var el = D.createElement('section'); el.className = 'ks-q ks-' + Q.tip; el.setAttribute('aria-labelledby', 'ksq' + i + 'b');
    var H = IST.by[Q.hafta], bas = '<header class="ks-qh"><b id="ksq' + i + 'b">Soru ' + (i + 1) + '</b><span class="ks-hf" style="--cc:' + (H ? H.renk : '#0D1838') + '">' + (H ? H.no + '. hafta' : '') + '</span><span class="ks-pt">' + Q.puan + ' puan</span><span class="ks-sonuc" data-sonuc></span></header>';
    var ip = '<div class="ks-ip"><button type="button" class="btn sm ghost" data-ipucu>💡 ipucu (−' + nf(Q.puan / 4, 2) + ' puan)</button><div data-ipb></div></div>';
    var g = '';
    if (Q.tip === 'bosluk') {
      var parca = Q.metin.split('____');
      g = '<p class="ks-cum">' + X(parca[0]) + '<label class="vh" for="ks' + i + '">boşluk</label><input id="ks' + i + '" class="ks-bos" autocomplete="off" data-c>' + X(parca.slice(1).join('____')) + '</p>';
    } else if (Q.tip === 'dy') {
      g = '<p class="ks-cum">' + X(Q.metin) + '</p><div class="ks-dy" role="radiogroup" aria-label="Doğru mu yanlış mı"><label><input type="radio" name="ksdy' + i + '" value="1" data-c> Doğru</label><label><input type="radio" name="ksdy' + i + '" value="0" data-c> Yanlış</label></div>';
    } else if (Q.tip === 'terim') {
      g = '<p class="ks-cum">' + (Q.yon === 'en' ? '“<b>' + X(Q.t.tr) + '</b>” teriminin İngilizcesi nedir?' : '“<b lang="en">' + X(Q.t.en) + '</b>” teriminin Türkçesi nedir?') + '</p><label class="vh" for="ks' + i + '">cevap</label><input id="ks' + i + '" class="ks-bos ks-gen" autocomplete="off" data-c' + (Q.yon === 'en' ? ' lang="en"' : '') + '>';
    } else if (Q.tip === 'tablo') {
      var bosMu = function (ii, k) { return Q.bos.filter(function (b) { return b.i === ii && b.k === k; })[0]; };
      g = Q.soru + '<div class="ks-tw"><table class="tb ks-tt"><thead><tr><th>Süre (dk)</th><th>Frekans f</th><th>Göreli frekans f/n</th><th>Birikimli frekans F</th></tr></thead><tbody>' +
        Q.sinif.map(function (s, ii) {
          var h = function (k, deger) { var bb = bosMu(ii, k); return bb ? '<td><label class="vh" for="ks' + i + '_' + ii + k + '">' + s + ' ' + (k === 'g' ? 'göreli frekans' : 'birikimli frekans') + '</label><input id="ks' + i + '_' + ii + k + '" class="ks-hc" inputmode="decimal" autocomplete="off" data-hc="' + ii + k + '"></td>' : '<td class="n">' + deger + '</td>'; };
          return '<tr><td>' + s + '</td><td class="n">' + Q.fr[ii] + '</td>' + h('g', r4(Q.fr[ii] / Q.n)) + h('F', Q.F[ii]) + '</tr>';
        }).join('') + '<tr><th>Toplam</th><td class="n"><b>' + Q.n + '</b></td><td class="n">1</td><td></td></tr></tbody></table></div>';
    } else if (Q.tip === 'sayisal') {
      Q.fsec = formulSecenek(Q, r);
      g = Q.soru + (Q.g ? '<div class="fig ks-fig">' + Q.g + '</div>' : '') + '<ol class="ks-ad">' +
        '<li><span class="ks-at">Kullanacağınız formül</span><select class="ks-sel" data-fs aria-label="formül seçimi"><option value="">— seçiniz —</option>' + Q.fsec.map(function (x) { return '<option>' + X(x) + '</option>'; }).join('') + '</select></li>' +
        Q.adim.map(function (a, j) { return '<li><span class="ks-at">' + a.t + (a.tablo ? ' <button type="button" class="ks-tl" data-formul="' + a.tablo + '">' + (a.tablo === 'c2' ? 'χ²' : a.tablo) + ' tablosu ↗</button>' : '') + '</span><label class="vh" for="ks' + i + '_' + j + '">' + duz(a.t) + '</label><input id="ks' + i + '_' + j + '" class="ks-sy" inputmode="decimal" autocomplete="off" data-ad="' + j + '"></li>'; }).join('') +
        (Q.karar ? '<li><span class="ks-at">' + Q.karar.t + '</span><select class="ks-sel" data-kr aria-label="karar"><option value="">— seçiniz —</option>' + Q.karar.o.map(function (x, k) { return '<option value="' + k + '">' + X(x) + '</option>'; }).join('') + '</select></li>' : '') + '</ol>' + (Q.egri ? '<div class="ks-egri" data-egri aria-live="polite"></div>' : '');
    } else if (Q.tip === 'agac') {
      g = Q.soru + '<div class="ks-ag-w"><div class="ks-ag" data-ag></div><div class="ks-ag-svg" data-agsvg aria-hidden="true"></div></div>';
    }
    el.innerHTML = bas + '<div class="ks-qg">' + g + '</div>' + ip + '<div class="ks-anahtar" data-anahtar hidden></div>';
    el.Q = Q; el.ipucu = false;
    if (Q.tip === 'agac') agacKur(el.querySelector('[data-ag]'), Q, i, el.querySelector('[data-agsvg]'));
    /* eğri önizlemesi: yazdığın z / t değeri eğride (IST.egriOnizle, ist-karalama.js) */
    if (Q.egri && IST.egriOnizle) {
      var eg = el.querySelector('[data-egri]'), ein = el.querySelector('[data-ad="' + Q.egri.adim + '"]'), egc = function () { var v = adaylar(ein.value)[0]; IST.egriOnizle(eg, { tur: Q.egri.tur, deger: v, sd: Q.egri.sd, kuyruk: Q.egri.kuyruk }); };
      ein.addEventListener('input', egc); egc();
    }
    el.querySelector('[data-ipucu]').onclick = function () {
      el.ipucu = true; this.disabled = true;
      var f = fId(Q), h = '';
      if (Q.tip === 'bosluk' || Q.tip === 'terim') { var c = Q.tip === 'bosluk' ? Q.kabul[0] : (Q.yon === 'en' ? Q.t.en : trSecenek(Q.t.tr)[0]); h = 'Cevap <b>' + X(c.charAt(0).toLocaleUpperCase('tr')) + '</b> harfiyle başlıyor ve ' + c.replace(/\s/g, '').length + ' harf. <button type="button" class="ks-tl" data-ozet="' + Q.hafta + '">' + (H ? H.no + '. hafta özeti' : 'özet') + ' ↗</button>'; }
      else if (Q.tip === 'dy') h = 'Bu konu ' + (H ? H.no + '. haftada' : '') + '. <button type="button" class="ks-tl" data-ozet="' + Q.hafta + '">haftanın özetine bak ↗</button>';
      else h = 'Bu soruda <b>' + X(Q.f) + '</b> formülünü kullan. ' + (f ? '<button type="button" class="ks-tl" data-formul="' + f + '">formül kağıdında aç ↗</button>' : '') + (Q.adim && Q.adim.some(function (a) { return a.tablo; }) ? ' Tablo değerini formül kağıdının tablo sekmesinden oku.' : '') + (Q.tip === 'agac' ? ' Önce kökten kaynaklara dallan, sonra her daldan “' + X(Q.sc.olay) + '” ve “' + X(Q.sc.olayD) + '” dalları çık; yapraklar dal olasılıklarının çarpımıdır.' : '');
      el.querySelector('[data-ipb]').innerHTML = '<p class="ks-ipm">' + h + '</p>';
    };
    el.addEventListener('click', function (e) { var o = e.target.closest('[data-ozet]'); if (o) IST.formul.ozet(o.getAttribute('data-ozet')); });
    return el;
  };

  /* ---------- olasılık ağacı kurucu ---------- */
  /* ağaç çizimi: dal kalınlığı olasılığa göre; anim: dallar sırayla çizilir */
  var agacSvg = IST.agacSvg = function (dal, sc, anim) {
    var n = Math.max(1, dal.length), H = 40 + n * 96, s = '', kal = function (p) { return isFinite(p) && p > 0 ? 1.5 + Math.min(1, p) * 9 : 1.2; }, dd = function (k) { return anim ? ' class="dr" style="--len:300;--d:' + (k * 0.35).toFixed(2) + 's"' : ''; }, fd = function (k) { return anim ? ' class="fd" style="--d:' + (k * 0.35 + 0.3).toFixed(2) + 's"' : ''; };
    var ry = H / 2;
    dal.forEach(function (d, j) {
      var y = 40 + j * 96 + 28, ok = d.ad ? X(d.ad) : '?', p = d.p, k = d.k;
      s += '<path' + dd(j) + ' d="M24 ' + ry + 'C80 ' + ry + ' 80 ' + y + ' 140 ' + y + '" fill="none" stroke="#0D1838" stroke-width="' + kal(p).toFixed(1) + '" stroke-linecap="round"/>';
      s += '<g' + fd(j) + '><circle cx="150" cy="' + y + '" r="12" fill="' + IST.V.PAL[j % 9] + '" stroke="#0D1838"/><text x="150" y="' + (y - 18) + '" text-anchor="middle" class="lbb">' + ok + '</text><text x="96" y="' + ((ry + y) / 2 - 6) + '" text-anchor="middle" class="lbm" style="paint-order:stroke;stroke:#fff;stroke-width:4px">' + (isFinite(p) ? nf(p, 3) : '') + '</text></g>';
      [[y - 24, k, sc.olay, '#C8553D'], [y + 24, 'kd' in d ? d.kd : isFinite(k) ? 1 - k : NaN, sc.olayD, '#5B6B8C']].forEach(function (L, m) {
        s += '<path' + dd(j + 0.5 + m * 0.2) + ' d="M162 ' + y + 'L262 ' + L[0] + '" stroke="' + L[3] + '" stroke-width="' + kal(L[1]).toFixed(1) + '" stroke-linecap="round" fill="none"/>' +
          '<g' + fd(j + 0.6 + m * 0.2) + '><text x="268" y="' + (L[0] + 4) + '" class="lbm">' + X(L[2]) + (isFinite(L[1]) ? ' ' + nf(L[1], 2) : '') + (isFinite(p) && isFinite(L[1]) ? ' → ' + nf(p * L[1], 4) : '') + '</text></g>';
      });
    });
    s = '<circle cx="20" cy="' + ry + '" r="7" fill="#0D1838"/>' + s;
    return V.svg(420, H, s, 'olasılık ağacı');
  };
  var agacKur = function (kok, Q, qi, svgEl) {
    var S = { dal: [] };
    var onizle = function () { if (svgEl) svgEl.innerHTML = S.dal.length ? agacSvg(S.dal.map(function (d) { var kd = adaylar(d.kd)[0]; return { ad: d.ad, p: adaylar(d.p)[0], k: adaylar(d.k)[0], kd: kd == null ? NaN : kd }; }), Q.sc, false) : '<p class="to-n">Dal ekledikçe ağacın burada büyür; kalınlık olasılığı gösterir.</p>'; };
    var ciz = function () {
      var top = S.dal.reduce(function (a, d) { return a + (adaylar(d.p).pop() || 0); }, 0);
      kok.innerHTML = '<div class="ks-ag-kok"><span class="ks-ag-nokta" aria-hidden="true"></span><b>Kök</b><small data-top>dal toplamı: ' + (S.dal.length ? nf(top, 3) : '–') + '</small></div><ul class="ks-ag-l">' +
        S.dal.map(function (d, j) {
          var ad = Q.sc.ad.map(function (a) { return '<option' + (d.ad === a ? ' selected' : '') + '>' + X(a) + '</option>'; }).join('');
          var alt = (adaylar(d.k).pop() || 0) + (adaylar(d.kd).pop() || 0);
          return '<li class="ks-ag-d" data-j="' + j + '"><div class="ks-ag-r"><label class="vh" for="ag' + qi + '_' + j + 'a">dal ' + (j + 1) + ' adı</label><select id="ag' + qi + '_' + j + 'a" data-f="ad"><option value="">' + X(Q.sc.kok) + ' seç</option>' + ad + '</select>' +
            '<label class="ks-ag-in">P = <input inputmode="decimal" autocomplete="off" data-f="p" value="' + X(d.p) + '" aria-label="dal ' + (j + 1) + ' olasılığı"></label><button type="button" class="btn sm ghost" data-sil aria-label="dalı sil">✕</button><span class="ks-ag-m" data-m="d' + j + '"></span></div>' +
            '<ul class="ks-ag-l2"><li><span>' + X(Q.sc.olay) + '</span><label class="ks-ag-in">P(·|dal) = <input inputmode="decimal" autocomplete="off" data-f="k" value="' + X(d.k) + '" aria-label="dal ' + (j + 1) + ' ' + X(Q.sc.olay) + ' koşullu olasılığı"></label><label class="ks-ag-in">yaprak = <input inputmode="decimal" autocomplete="off" data-f="y" value="' + X(d.y) + '" aria-label="dal ' + (j + 1) + ' yaprak olasılığı"></label><span class="ks-ag-m" data-m="k' + j + '"></span></li>' +
            '<li><span>' + X(Q.sc.olayD) + '</span><label class="ks-ag-in">P(·|dal) = <input inputmode="decimal" autocomplete="off" data-f="kd" value="' + X(d.kd) + '" aria-label="dal ' + (j + 1) + ' ' + X(Q.sc.olayD) + ' koşullu olasılığı"></label><small data-alt>alt dallar: ' + (d.k || d.kd ? nf(alt, 3) : '–') + '</small><span class="ks-ag-m" data-m="kd' + j + '"></span></li></ul></li>';
        }).join('') + '</ul>' +
        (S.dal.length < 4 ? '<button type="button" class="btn sm" data-ekle>+ dal ekle</button>' : '') +
        '<div class="ks-ag-son"><label>P(' + X(Q.sc.olay) + ') = <input inputmode="decimal" autocomplete="off" data-son="pk" value="' + X(S.pk || '') + '"></label><span class="ks-ag-m" data-m="pk"></span>' +
        '<label>P(' + X(Q.sc.ad[Q.hedef]) + ' | ' + X(Q.sc.olay) + ') = <input inputmode="decimal" autocomplete="off" data-son="post" value="' + X(S.post || '') + '"></label><span class="ks-ag-m" data-m="post"></span></div>';
      onizle();
    };
    kok.addEventListener('click', function (e) {
      if (kok.classList.contains('kilit')) return;
      if (e.target.closest('[data-ekle]')) { S.dal.push({ ad: '', p: '', k: '', kd: '', y: '' }); ciz(); var s = kok.querySelectorAll('select[data-f="ad"]'); if (s.length) s[s.length - 1].focus(); return; }
      var sil = e.target.closest('[data-sil]'); if (sil) { S.dal.splice(+sil.closest('[data-j]').getAttribute('data-j'), 1); ciz(); }
    });
    var degis = function (e) {
      var t = e.target, li = t.closest('[data-j]');
      if (t.hasAttribute('data-son')) { S[t.getAttribute('data-son')] = t.value; return; }
      if (!li || !t.getAttribute('data-f')) return;
      var d = S.dal[+li.getAttribute('data-j')]; d[t.getAttribute('data-f')] = t.value;
      /* toplamlar yerinde güncellenir (yeniden çizim yok: odak ve imleç kaybolmaz) */
      var top = S.dal.reduce(function (a, x) { return a + (adaylar(x.p).pop() || 0); }, 0);
      kok.querySelector('[data-top]').textContent = 'dal toplamı: ' + nf(top, 3);
      li.querySelector('[data-alt]').textContent = 'alt dallar: ' + (d.k || d.kd ? nf((adaylar(d.k).pop() || 0) + (adaylar(d.kd).pop() || 0), 3) : '–');
      onizle();
    };
    kok.addEventListener('input', degis); kok.addEventListener('change', degis);
    kok.durum = S;
    ciz();
  };
  /* ağaç puanlama: yapı 2, dallar 2, koşullu dallar 3, yapraklar 2, P(olay) 1,5, sonuç 1,5 (toplam 12) */
  var agacPuan = IST.agacPuan = function (Q, S) {
    var k = Q.sc.ad.length, yak = function (v, d, tol) { return yakin(v, d, tol || 0.0051); };
    var adlar = S.dal.map(function (d) { return d.ad; }), yapi = S.dal.length === k && Q.sc.ad.every(function (a) { return adlar.indexOf(a) > -1; });
    var isaret = {}, dalOk = 0, kOk = 0, yOk = 0;
    S.dal.forEach(function (d, j) {
      var i = Q.sc.ad.indexOf(d.ad); if (i < 0) { isaret['d' + j] = false; return; }
      var a = yak(d.p, Q.pay[i]), b = yak(d.k, Q.oran[i]) && yak(d.kd, 1 - Q.oran[i]), c = yak(d.y, Q.pay[i] * Q.oran[i], 0.0006);
      isaret['d' + j] = a; isaret['k' + j] = b && c; isaret['kd' + j] = yak(d.kd, 1 - Q.oran[i]);
      if (a) dalOk++; if (b) kOk++; if (c) yOk++;
    });
    var pk = yak(S.pk, Q.pk, 0.0006), po = yak(S.post, Q.post, 0.0006);
    isaret.pk = pk; isaret.post = po;
    var p = (yapi ? 2 : 0) + 2 * Math.min(dalOk, k) / k + 3 * Math.min(kOk, k) / k + 2 * Math.min(yOk, k) / k + (pk ? 1.5 : 0) + (po ? 1.5 : 0);
    return { puan: Math.round(p * 100) / 100, isaret: isaret, yapi: yapi };
  };

  /* teslimde: kartı puanla, kilitle, anahtarı göster */
  var puanla = function (el) {
    var Q = el.Q, kazan = 0, anahtar = '', ok = null, yak = function (v, d, tol) { return yakin(v, d, tol != null ? tol : Math.max(Math.abs(d) * 0.005, 0.0051)); };
    if (Q.tip === 'bosluk') { var v = el.querySelector('[data-c]').value; ok = metinDogru(v, Q.kabul); kazan = ok ? Q.puan : 0; anahtar = 'Cevap: <b>' + X(Q.kabul[0]) + '</b>' + (Q.kabul.length > 1 ? ' <small>(kabul: ' + X(Q.kabul.slice(1).join(', ')) + ')</small>' : ''); }
    else if (Q.tip === 'dy') { var s = el.querySelector('[data-c]:checked'); ok = !!s && (s.value === '1') === Q.dogru; kazan = ok ? Q.puan : 0; anahtar = '<b>' + (Q.dogru ? 'Doğru' : 'Yanlış') + '.</b> ' + X(Q.neden); }
    else if (Q.tip === 'terim') { var kab = Q.yon === 'en' ? enKabul(Q.t.en) : trSecenek(Q.t.tr); ok = metinDogru(el.querySelector('[data-c]').value, kab); kazan = ok ? Q.puan : 0; anahtar = 'Cevap: <b>' + X(Q.yon === 'en' ? Q.t.en : Q.t.tr) + '</b>'; }
    else if (Q.tip === 'tablo') {
      var d = 0; Q.bos.forEach(function (b) { var inp = el.querySelector('[data-hc="' + b.i + b.k + '"]'), g = yak(inp.value, b.say, b.k === 'g' ? 0.0006 : 0.5); inp.classList.add(g ? 'ok' : 'no'); if (g) d++; else inp.insertAdjacentHTML('afterend', '<small class="ks-dg">' + (b.k === 'g' ? r4(b.say) : b.say) + '</small>'); });
      kazan = Q.puan * d / Q.bos.length; ok = d === Q.bos.length; anahtar = d + ' / ' + Q.bos.length + ' hücre doğru. Göreli frekans = f / n, birikimli frekans = o sınıfa kadarki f’lerin toplamı.';
    } else if (Q.tip === 'sayisal') {
      var parca = 1 + Q.adim.length + (Q.karar ? 1 : 0), w = Q.puan / (parca + 1), dog = 0;
      var fs = el.querySelector('[data-fs]'), fOk = fs.value === Q.f; fs.classList.add(fOk ? 'ok' : 'no'); if (fOk) dog += 2;
      Q.adim.forEach(function (a, j) { var inp = el.querySelector('[data-ad="' + j + '"]'), g = yak(inp.value, a.say, a.tol); inp.classList.add(g ? 'ok' : 'no'); if (g) dog++; else inp.insertAdjacentHTML('afterend', '<small class="ks-dg">' + nf(a.say, Math.abs(a.say) >= 100 ? 2 : 4) + '</small>'); });
      if (Q.karar) { var kr = el.querySelector('[data-kr]'), kg = kr.value !== '' && +kr.value === Q.karar.a; kr.classList.add(kg ? 'ok' : 'no'); if (kg) dog++; }
      kazan = Math.min(Q.puan, w * dog); ok = dog === parca + 1;
      var f = fId(Q); anahtar = 'Formül: <b>' + X(Q.f) + '</b>' + (f ? ' <button type="button" class="ks-tl" data-formul="' + f + '">kağıtta gör ↗</button>' : '') + ' · ' + Q.adim.map(function (a) { return duz(a.t) + ' = ' + nf(a.say, Math.abs(a.say) >= 100 ? 2 : 4); }).join(' · ') + (Q.karar ? ' · ' + X(Q.karar.o[Q.karar.a]) : '') + '. <small>Puanlama: formül 2 pay, her adım 1 pay.</small>';
    } else if (Q.tip === 'agac') {
      var kok = el.querySelector('[data-ag]'), R = agacPuan(Q, kok.durum); kok.classList.add('kilit');
      Object.keys(R.isaret).forEach(function (k) { var m = kok.querySelector('[data-m="' + k + '"]'); if (m) { m.textContent = R.isaret[k] ? '✓' : '✗'; m.className = 'ks-ag-m ' + (R.isaret[k] ? 'ok' : 'no'); } });
      kazan = R.puan; ok = kazan >= Q.puan - 0.01;
      anahtar = 'Doğru ağaç: kök → ' + Q.sc.ad.map(function (a, i) { return a + ' (' + nf(Q.pay[i], 2) + ') → ' + Q.sc.olay + ' ' + nf(Q.oran[i], 2) + ', yaprak ' + r4(Q.pay[i] * Q.oran[i]); }).join('; ') + '. P(' + X(Q.sc.olay) + ') = ' + r4(Q.pk) + ', P(' + X(Q.sc.ad[Q.hedef]) + ' | ' + X(Q.sc.olay) + ') = <b>' + r4(Q.post) + '</b>.' + (R.yapi ? '' : ' <small>Yapı: her kaynak için bir dal gerekiyordu.</small>');
    }
    if (el.ipucu) kazan = Math.max(0, kazan - Q.puan / 4);
    kazan = Math.round(kazan * 100) / 100;
    el.querySelectorAll('input,select,button[data-ipucu],[data-ekle],[data-sil]').forEach(function (x) { x.disabled = true; });
    var so = el.querySelector('[data-sonuc]'); so.textContent = nf(kazan, 2) + ' / ' + Q.puan; so.className = 'ks-sonuc ' + (ok ? 'ok' : kazan > 0 ? 'yari' : 'no');
    var an = el.querySelector('[data-anahtar]'); an.innerHTML = anahtar + (el.ipucu ? ' <small>(ipucu: −' + nf(Q.puan / 4, 2) + ')</small>' : '') +
      (Q.tip === 'sayisal' ? '<div class="ks-czd"><button type="button" class="btn sm" data-oyn>▶ çözümü oynat</button></div><div data-cz></div>' : Q.tip === 'agac' ? '<div class="ks-czd"><button type="button" class="btn sm" data-agoyn>▶ doğru ağacı çiz</button></div><div data-cz></div>' : ''); an.hidden = false;
    var ob = an.querySelector('[data-oyn]'); if (ob) ob.onclick = function () { ob.disabled = true; cozum(el, an.querySelector('[data-cz]')); };
    var ab = an.querySelector('[data-agoyn]'); if (ab) ab.onclick = function () { an.querySelector('[data-cz]').innerHTML = '<div class="ks-ag-svg ks-ag-dogru">' + agacSvg(Q.sc.ad.map(function (a, i) { return { ad: a, p: Q.pay[i], k: Q.oran[i] }; }), Q.sc, true) + '</div>'; };
    return { kazan: kazan, max: Q.puan, hafta: Q.hafta };
  };

  /* ---------- çözüm animasyonu: formül → yerine koy → sonuç; kullanılan sayılar soruda parlar ---------- */
  var isaretKaldir = function (kok) { kok.querySelectorAll('mark.ks-uc').forEach(function (m) { m.replaceWith(D.createTextNode(m.textContent)); }); kok.normalize(); };
  var isaretle = function (kok, yk) {
    var say = (String(yk || '').match(/\d+(?:,\d+)?/g) || []).filter(function (x) { return x.length > 1 || +x > 1; }), bulundu = {};
    if (!say.length) return;
    /* her sayı için metin düğümleri baştan taranır: önceki işaret düğümleri böldüğü için */
    say.forEach(function (x) {
      if (bulundu[x]) return;
      var tw = D.createTreeWalker(kok, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.parentElement && n.parentElement.closest('.ks-ad, .ks-anahtar, select, label, .ks-ip, .ks-qh, mark') ? 2 : 1; } }), t;
      var re = new RegExp('(^|[^\\d,])(' + x.replace(',', '\\,') + ')(?![\\d,]\\d)');
      while (!bulundu[x] && (t = tw.nextNode())) {
        var m = re.exec(t.nodeValue); if (!m) continue;
        var son = t.splitText(m.index + m[1].length); son.splitText(x.length);
        var mk = D.createElement('mark'); mk.className = 'ks-uc'; mk.textContent = son.nodeValue; son.replaceWith(mk); bulundu[x] = 1;
      }
    });
  };
  var sayac = function (b, hedef) {
    var dg = Math.abs(hedef) >= 100 ? 2 : 4;
    if (SAKIN_K) { b.textContent = nf(hedef, dg); return; }
    var t0 = null; var adim = function (t) { if (!t0) t0 = t; var u = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - u, 3); b.textContent = nf(hedef * e, dg); if (u < 1 && b.isConnected) W.requestAnimationFrame(adim); else b.textContent = nf(hedef, dg); }; W.requestAnimationFrame(adim);
  };
  var SAKIN_K = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var cozum = function (el, kutu) {
    var Q = el.Q, f = formuller().filter(function (x) { return x.H.id === Q.hafta && x.ad === Q.f; })[0], k = 0, oyn = 0, son = 1 + Q.adim.length + (Q.karar ? 1 : 0), soru = el.querySelector('.ks-qg');
    var senin = function (j) { var inp = el.querySelector('[data-ad="' + j + '"]'); return inp ? inp.value : ''; };
    kutu.innerHTML = '<div class="ks-cz"><div class="ks-cz-h"><b>Çözüm</b><span data-n></span><button type="button" class="btn sm ghost" data-g aria-label="önceki adım">◀</button><button type="button" class="btn sm" data-o>⏸ durdur</button><button type="button" class="btn sm ghost" data-i aria-label="sonraki adım">▶</button></div><ol data-l></ol></div>';
    var L = kutu.querySelector('[data-l]');
    var satir = function (j) {
      if (j === 0) return '<li class="ks-cz-li"><span class="ks-cz-t">Formül · ' + X(Q.f) + '</span><span class="ks-cz-f mono">' + (f ? f.f : '') + '</span></li>';
      if (j <= Q.adim.length) {
        var a = Q.adim[j - 1], sv = senin(j - 1);
        return '<li class="ks-cz-li"><span class="ks-cz-t">' + a.t + '</span>' + (a.yk ? '<span class="ks-cz-yk mono">= ' + X(a.yk) + '</span>' : '') + '<span class="ks-cz-s mono">= <b data-say>0</b></span>' +
          '<span class="ks-cz-o">senin cevabın: ' + (sv ? X(sv) : '—') + '</span>' + (a.tablo ? '<div class="ks-cz-tb" data-tb></div>' : '') + '</li>';
      }
      return '<li class="ks-cz-li"><span class="ks-cz-t">' + X(Q.karar.t) + '</span><span class="ks-cz-s"><b>' + X(Q.karar.o[Q.karar.a]) + '</b></span></li>';
    };
    var ciz = function () {
      isaretKaldir(soru);
      var h = ''; for (var j = 0; j < k; j++) h += satir(j); L.innerHTML = h;
      kutu.querySelector('[data-n]').textContent = k + ' / ' + son;
      var li = L.lastElementChild; if (!li) return; li.classList.add('yeni');
      if (k >= 2 && k <= Q.adim.length + 1) {
        var a = Q.adim[k - 2], b = li.querySelector('[data-say]'); if (b) sayac(b, a.say);
        isaretle(soru, a.yk);
      }
      /* tablo okuma: yeni adımda animasyonlu, öncekilerde hazır */
      if (IST.tabloOku) L.querySelectorAll('[data-tb]').forEach(function (tb) {
        var ai = [].indexOf.call(L.children, tb.closest('li')) - 1, a = Q.adim[ai];
        IST.tabloOku(tb, a.tablo === 'z' ? { tip: 'z', z: a.tz != null ? a.tz : a.say, hemen: tb.closest('li') !== li } : { tip: a.tablo, sd: a.sd, a: a.ta, hemen: tb.closest('li') !== li });
      });
      L.querySelectorAll('[data-say]').forEach(function (b, i) { if (b !== (li && li.querySelector('[data-say]'))) b.textContent = nf(Q.adim[i].say, Math.abs(Q.adim[i].say) >= 100 ? 2 : 4); });
    };
    var dur = function () { clearTimeout(oyn); oyn = 0; kutu.querySelector('[data-o]').textContent = '▶ oynat'; };
    var oynat = function () { kutu.querySelector('[data-o]').textContent = '⏸ durdur'; var t = function () { if (!kutu.isConnected) return; if (k >= son) { dur(); return; } k++; ciz(); var a = Q.adim[k - 2]; oyn = setTimeout(t, a && a.tablo ? 3600 : SAKIN_K ? 1200 : 2200); }; t(); };
    kutu.querySelector('[data-g]').onclick = function () { dur(); k = Math.max(1, k - 1); ciz(); };
    kutu.querySelector('[data-i]').onclick = function () { dur(); k = Math.min(son, k + 1); ciz(); };
    kutu.querySelector('[data-o]').onclick = function () { if (oyn) dur(); else { if (k >= son) k = 0; oynat(); } };
    oynat();
  };

  /* =====================================================================
     SAYFALAR
     ===================================================================== */
  var saat = null;
  var sinavSayfa = function (P) {
    return function (main, crumb) {
      clearInterval(saat);
      var r = IST.rng((Date.now() / 1000 | 0) + Math.floor(Math.random() * 1e5)), L = sinavKur(P.hf, r), sure = 90 * 60, kal = sure, bitti = false;
      main.innerHTML = '<div class="is-ders ks-sinav"><div class="is-dh"><div><span class="k">Klasik sınav</span><h1 class="disp">' + X(P.ad) + '<small>15 soru · 90 dakika · ' + P.hf.map(function (h) { return IST.by[h] ? IST.by[h].no : ''; }).join(', ') + '. haftalar · ipucu soru puanının dörtte birine mal olur</small></h1></div>' +
        '<div class="ks-ust-sag"><button type="button" class="btn sm" data-formul>📐 formül kağıdı</button><div class="is-saat" data-saat><b data-kal></b><small>kalan süre</small></div></div></div>' +
        '<p class="ks-yon">Cevaplarını yaz; sınav sırasında doğru/yanlış gösterilmez. Sayısal sorularda önce kullanacağın formülü seç, ara sonuçları sırayla yaz: her adım ayrı puanlanır. Ondalıkta virgül ya da nokta kullanabilirsin.</p><div data-qs></div>' +
        '<div class="is-sonraki"><button type="button" class="btn pri" data-teslim>sınavı teslim et</button></div><div data-karne></div></div>';
      crumb.textContent = P.ad;
      var qs = main.querySelector('[data-qs]'), kartlar = [], son = null;
      L.forEach(function (Q, i) { if (BOLUM[Q.tip] !== son) { son = BOLUM[Q.tip]; var h = D.createElement('h2'); h.className = 'ks-bolum disp'; h.textContent = son; qs.appendChild(h); } var el = kart(Q, i, r); kartlar.push(el); qs.appendChild(el); });
      var kalEl = main.querySelector('[data-kal]');
      var yaz = function () { var m = Math.floor(kal / 60), s = kal % 60; kalEl.textContent = m + ':' + (s < 10 ? '0' : '') + s; main.querySelector('[data-saat]').classList.toggle('az', kal <= 300); };
      var teslim = function () {
        if (bitti) return; bitti = true; clearInterval(saat);
        var top = 0, max = 0, hf = {};
        kartlar.forEach(function (el) { var p = puanla(el); top += p.kazan; max += p.max; hf[p.hafta] = hf[p.hafta] || [0, 0]; hf[p.hafta][0] += p.kazan; hf[p.hafta][1] += p.max; });
        var puan = Math.round(top / max * 100);
        IST.put(P.id, { s: puan });
        main.querySelector('[data-teslim]').disabled = true;
        main.querySelector('[data-karne]').innerHTML = '<div class="is-karne" style="margin-top:14px"><b>' + puan + '</b><div><p>100 üzerinden ' + puan + ' · ham puan ' + nf(top, 2) + ' / ' + max + ' · süre ' + Math.round((sure - kal) / 60) + ' dk. ' + (puan >= 70 ? 'Klasik sınava hazırsın gibi görünüyor.' : puan >= 50 ? 'Geçer not bölgesindesin; eksik adımlarını puan anahtarından oku.' : 'Zayıf haftaları tekrar et, sonra yeni bir klasik sınav dene.') + '</p>' +
          '<div class="is-pvk">' + Object.keys(hf).map(function (k) { var v = hf[k], H = IST.by[k]; return '<button type="button" class="btn sm' + (v[0] < v[1] * 0.6 ? '' : ' ghost') + '" data-go="' + k + '">' + (H ? H.no + '. hafta' : k) + ' ' + nf(v[0], 1) + '/' + v[1] + '</button>'; }).join('') + '</div>' +
          '<p style="margin-top:8px">Her sorunun altında puan anahtarı açıldı. <button type="button" class="btn sm" data-yeni>yeni klasik sınav</button></p></div></div>';
        main.querySelector('[data-yeni]').onclick = function () { IST.go(P.id); };
        main.querySelector('[data-karne]').scrollIntoView({ block: 'center' });
      };
      main.querySelector('[data-teslim]').onclick = function () {
        var bos = kartlar.filter(function (el) { return ![].some.call(el.querySelectorAll('input:not([type=radio]),select'), function (x) { return x.value; }) && !el.querySelector('input[type=radio]:checked') && !(el.Q.tip === 'agac' && el.querySelector('[data-ag]').durum.dal.length); }).length;
        if (bos && !lsafe(function () { return W.confirm(bos + ' soru boş. Yine de teslim edilsin mi?'); }, true)) return;
        teslim();
      };
      yaz();
      saat = setInterval(function () { if (!main.contains(kalEl)) { clearInterval(saat); return; } kal--; yaz(); if (kal <= 0) { IST.toast('Süre doldu, sınav teslim edildi'); teslim(); } }, 1000);
    };
  };
  IST.KLASIK_TEST = { enTemiz: enTemiz, enKabul: enKabul, trSecenek: trSecenek, formulSecenek: formulSecenek, agacSoru: agacSoru, tabloSoru: tabloSoru, terimler: terimler };
  IST.SAYFA = IST.SAYFA || {};
  KSAV.forEach(function (P) { IST.SAYFA[P.id] = sinavSayfa(P); });
  IST.SAYFA.formul = function (main, crumb) {
    clearInterval(saat);
    main.innerHTML = '<div class="is-ders ks-fsayfa"><div class="is-dh"><div><span class="k">Statistics for Business I · II</span><h1 class="disp">Formül kağıdı<small>bütün haftaların formülleri ve z, t, χ² tabloları</small></h1></div></div><div data-fk></div></div>';
    crumb.textContent = 'Formül kağıdı';
    kagit(main.querySelector('[data-fk]'), { yazdir: true });
  };
  /* ders yolunda: klasik sınavlar ve formül kağıdı */
  IST.yolEk = function (d) {
    var p = IST.prog();
    return '<div class="is-pv ks-pv">' + KSAV.filter(function (P) { return P.id.charAt(3) === d; }).map(function (P) {
      var s = (p[P.id] || {}).s;
      return '<button type="button" class="is-pvb" data-go="' + P.id + '"><span class="ic" aria-hidden="true">📝</span><span><b class="disp">' + X(P.ad) + '</b><small>15 soru · 90 dakika · tanım, doğru/yanlış, terim, adım adım problem' + (d === 'b' ? ', tablo okuma' : P.hf.indexOf('g7') > -1 ? ', ağaç çizimi' : '') + '</small></span><span class="sc">' + (s != null ? 'en iyi ' + s : '') + '</span></button>';
    }).join('') + '<button type="button" class="is-pvb" data-go="formul"><span class="ic" aria-hidden="true">📐</span><span><b class="disp">Formül kağıdı</b><small>' + formuller().length + ' formül · z, t, χ² tabloları · yazdırılabilir</small></span><span class="sc"></span></button></div>';
  };
})();
