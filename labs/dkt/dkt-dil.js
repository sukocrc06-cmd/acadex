/* ==========================================================================
   ACADEX DKT LAB · DİL GELİŞİMİ VE AFAZİ (labs/dkt/dkt-dil.js), 29.10.2026
   0–6 yaş gelişim basamakları (büyüyen çocuk), OSU (biçimbirim) hesaplayıcı,
   Boston sınıflamasıyla afazi ağacı ve hasta örneği alıştırması.
   ========================================================================== */
(function () {
  'use strict';
  var DK = window.DK, C = DK.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X, tr = C.tr;
  var S = { gi: C.ls.get('d.gi', 4), osu: C.ls.get('d.osu', ['', '', '']), ak: true, an: true, te: true, q: null, pool: [], sc: [] };
  var SOZ = ['ıııı', 'ba-ba-ba', 'su!', 'top… mama… hav', 'anne gel', 'kedi uyuyor', 'dün parka gittik, kaydıraktan kaydım', 'önce yemek yedik, sonra oyun oynadık çünkü yağmur yağıyordu', 'neden gökyüzü mavi?'];
  var AF = {}; V.AFAZI.forEach(function (a) { AF[a.k] = a; });

  /* ---------- gelişim zaman çizelgesi ---------- */
  var yasStr = function (ay) { if (ay < 24) return ay + ' ay'; var y = Math.floor(ay / 12), m = ay % 12; return y + ' yaş' + (m ? ' ' + m + ' ay' : ''); };
  var kidSVG = function () {
    return '<svg viewBox="0 0 150 170" aria-hidden="true"><ellipse cx="75" cy="160" rx="48" ry="7" fill="#0D1838" opacity=".08"/><g class="kid">' +
      '<path d="M52 104 h46 l6 40 h-58z" fill="#C9DDF6" stroke="#0D1838" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<path d="M60 144 v14 M90 144 v14" stroke="#0D1838" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M52 110 l-14 22 M98 110 l14 22" stroke="#0D1838" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="75" cy="72" r="32" fill="#F4C9A8" stroke="#0D1838" stroke-width="2.6"/>' +
      '<path d="M46 62 C50 38 100 38 104 62 C94 52 60 50 46 62 Z" fill="#7A5230"/>' +
      '<g class="dudi"><ellipse class="eye" cx="64" cy="72" rx="3" ry="3.6" fill="#0D1838"/><ellipse class="eye" cx="86" cy="72" rx="3" ry="3.6" fill="#0D1838"/><g class="mouth"><path d="M66 86 C70 82 80 82 84 86 C80 93 70 93 66 86 Z" fill="#E0705A" stroke="#0D1838" stroke-width="1.8"/></g></g>' +
      '</g></svg>';
  };
  var paintTL = function () {
    var g = V.GELISIM[S.gi], sc = 0.55 + S.gi / (V.GELISIM.length - 1) * 0.45;
    $('#tl-age').textContent = yasStr(g.ay);
    $('#tl-bub').textContent = SOZ[S.gi];
    $('#tl-an').textContent = g.anl; $('#tl-if').textContent = g.ifd;
    var u = $('#tl-uy'); u.hidden = !g.uy; u.innerHTML = g.uy ? '<b>Uyarı işareti:</b> ' + X(g.uy) : '';
    var k = $('#tl .kid'); if (k) k.style.transform = 'scale(' + sc.toFixed(3) + ')';
    $('#tl-r').value = S.gi; C.ls.set('d.gi', S.gi); DK.bridgeSend();
  };

  /* ---------- OSU ---------- */
  var morf = function (s) { return String(s || '').trim().split(/\s+/).filter(Boolean).reduce(function (a, w) { return a + w.split('-').filter(Boolean).length; }, 0); };
  var paintOSU = function () {
    $('#osu-l').innerHTML = S.osu.map(function (u, i) { return '<div class="osu-r"><label class="vh" for="osu-' + i + '">Sözce ' + (i + 1) + '</label><input id="osu-' + i + '" data-oi="' + i + '" value="' + X(u) + '" placeholder="örn. top-u ver" autocomplete="off" spellcheck="false"><span class="n" data-on="' + i + '">' + (morf(u) || '—') + '</span><button type="button" class="x" data-ox="' + i + '" aria-label="Sözceyi sil">×</button></div>'; }).join('');
    paintOSURes();
  };
  var paintOSURes = function () {
    var us = S.osu.filter(function (u) { return morf(u) > 0; }), tot = us.reduce(function (a, u) { return a + morf(u); }, 0);
    $('#osu-res').innerHTML = us.length ? '<b>' + tr(tot / us.length, 2) + '</b><span class="sub" style="margin:0">' + tot + ' biçimbirim ÷ ' + us.length + ' sözce. Güvenilir bir OSU için genellikle 50–100 sözcelik kendiliğinden konuşma örneği alınır; Türkçe için yaşa göre karşılaştırmayı yerel norm çalışmalarına göre yap.</span>' : '<span class="sub" style="margin:0">Sözceleri yaz; OSU burada hesaplanır.</span>';
    C.ls.set('d.osu', S.osu);
  };

  /* ---------- afazi ağacı ---------- */
  var LZ = { broca: [[70, 62, 16, 12]], wernicke: [[132, 72, 16, 11]], iletim: [[106, 60, 22, 9]], global: [[100, 64, 54, 22]], mikst: [[54, 48, 12, 10], [150, 60, 12, 12], [100, 36, 14, 8]], tkm: [[58, 44, 14, 10]], tkd: [[150, 60, 13, 12]], anomik: [[138, 50, 13, 10]] };
  var brain = function (k) {
    var z = (LZ[k] || []).map(function (e) { return '<ellipse class="lz" cx="' + e[0] + '" cy="' + e[1] + '" rx="' + e[2] + '" ry="' + e[3] + '"/>'; }).join('');
    return '<svg class="brain" viewBox="0 0 190 120" aria-hidden="true"><path d="M30 70 C20 40 50 12 96 12 C142 12 176 34 176 64 C176 84 164 96 148 98 C142 110 120 112 112 102 C96 108 80 106 74 96 C52 100 34 92 30 70 Z" fill="#FCE9DB" stroke="#0D1838" stroke-width="2.6"/>' +
      '<path d="M60 70 C80 60 110 58 140 66" fill="none" stroke="#B4602F" stroke-width="2"/><path d="M96 14 C92 34 94 50 100 62" fill="none" stroke="#B4602F" stroke-width="2"/>' + z +
      '<text x="20" y="116" font-family="JetBrains Mono" font-size="9" fill="#6A7593">ön</text><text x="160" y="116" font-family="JetBrains Mono" font-size="9" fill="#6A7593">arka</text></svg>';
  };
  var paintTree = function () {
    var q = function (key, t, s, a, b) { return '<div class="tq"><span>' + t + '<small>' + s + '</small></span><div class="seg" role="group" aria-label="' + t + '"><button type="button" data-tq="' + key + '" data-v="1" aria-pressed="' + (S[key] === true) + '">' + a + '</button><button type="button" data-tq="' + key + '" data-v="0" aria-pressed="' + (S[key] === false) + '">' + b + '</button></div></div>'; };
    var a = V.AFAZI.filter(function (x) { return x.ak === S.ak && x.an === S.an && x.te === S.te; })[0];
    $('#tree').innerHTML = q('ak', 'Konuşma akıcı mı?', 'cümle uzunluğu, zahmet, prozodi', 'akıcı', 'akıcı değil') + q('an', 'İşitsel anlama?', 'yönerge, evet/hayır soruları', 'iyi', 'bozuk') + q('te', 'Tekrar?', 'sözcük ve cümle tekrarı', 'iyi', 'bozuk') +
      '<div class="tres">' + brain(a.k) + '<div><b>' + X(a.t) + '</b><p>' + X(a.d) + '</p><p class="sub" style="margin:0">Olası lezyon: ' + X(a.l) + '</p></div></div>';
    DK.bridgeSend();
  };

  /* ---------- hasta örneği alıştırması ---------- */
  var nextVg = function () {
    if (!S.pool.length) S.pool = C.shuffle(V.AFAZI_SORU);
    S.q = S.pool.pop(); S.qa = false;
    $('#vg-s').textContent = S.q.s;
    $('#vg-o').innerHTML = V.AFAZI.map(function (a) { return '<button type="button" data-vk="' + a.k + '">' + X(a.t) + '</button>'; }).join('');
    $('#vg-fb').innerHTML = '';
  };
  var ansVg = function (k) {
    if (!S.q || S.qa) return;
    var ok = k === S.q.k, a = AF[S.q.k]; S.qa = true; S.sc.push(ok);
    $$('#vg-o [data-vk]').forEach(function (b) { var v = b.getAttribute('data-vk'); if (v === S.q.k) b.classList.add('ok'); else if (v === k) b.classList.add('no'); });
    $('#vg-fb').innerHTML = '<div class="rule"><b>' + (ok ? 'Doğru: ' : 'Doğrusu: ') + X(a.t) + '.</b> Akıcılık ' + (a.ak ? 'var' : 'yok') + ', anlama ' + (a.an ? 'iyi' : 'bozuk') + ', tekrar ' + (a.te ? 'iyi' : 'bozuk') + '. ' + X(a.d) + '</div><div class="row" style="margin-top:10px"><button type="button" class="btn sm pri" id="vg-n">Sıradaki hasta</button></div>';
    var n = S.sc.filter(Boolean).length;
    $('#vg-sc').innerHTML = '<span class="dots">' + S.sc.slice(-10).map(function (v) { return '<i class="' + (v ? 'ok' : 'no') + '"></i>'; }).join('') + '</span><span>' + n + '/' + S.sc.length + '</span>';
    DK.bridgeSend();
  };

  DK.st.dil = {
    init: function () {
      $('#tl').innerHTML = '<div class="tl-kid">' + kidSVG() + '<div><div class="tl-age" id="tl-age"></div><div class="det-q" style="margin-top:6px;background:#fff"><div class="bub" id="tl-bub" style="font-size:24px"></div></div></div></div>' +
        '<div class="tl-cols"><div class="an"><b>anlama</b><span id="tl-an"></span></div><div class="if"><b>ifade</b><span id="tl-if"></span></div></div><div class="tl-uy" id="tl-uy" hidden></div>' +
        '<label class="vh" for="tl-r">Yaş</label><input class="tl-rng" type="range" id="tl-r" min="0" max="' + (V.GELISIM.length - 1) + '" step="1" value="' + S.gi + '">' +
        '<div class="tl-ticks">' + V.GELISIM.map(function (g) { return '<span>' + (g.ay < 24 ? g.ay + 'a' : g.ay / 12 + 'y') + '</span>'; }).join('') + '</div>';
      $('#tl-r').addEventListener('input', function () { S.gi = +this.value; paintTL(); });
      paintTL();
      paintOSU();
      $('#osu-l').addEventListener('input', function (e) { var i = e.target.getAttribute('data-oi'); if (i == null) return; S.osu[+i] = e.target.value; var n = $('[data-on="' + i + '"]'); if (n) n.textContent = morf(e.target.value) || '—'; paintOSURes(); });
      $('#osu-l').addEventListener('click', function (e) { var b = e.target.closest('[data-ox]'); if (!b) return; S.osu.splice(+b.getAttribute('data-ox'), 1); if (!S.osu.length) S.osu = ['']; paintOSU(); });
      $('#osu-add').addEventListener('click', function () { S.osu.push(''); paintOSU(); var ins = $$('#osu-l input'); ins[ins.length - 1].focus(); });
      $('#osu-ex').addEventListener('click', function () { S.osu = V.OSU.slice(); paintOSU(); DK.bridgeSend(); });
      paintTree();
      $('#tree').addEventListener('click', function (e) { var b = e.target.closest('[data-tq]'); if (!b) return; S[b.getAttribute('data-tq')] = b.getAttribute('data-v') === '1'; paintTree(); });
      nextVg();
      $('#dil').addEventListener('click', function (e) { var b = e.target.closest('#vg-o [data-vk]'); if (b) { ansVg(b.getAttribute('data-vk')); return; } if (e.target.closest('#vg-n')) nextVg(); });
    },
    ctx: function () {
      var g = V.GELISIM[S.gi], a = V.AFAZI.filter(function (x) { return x.ak === S.ak && x.an === S.an && x.te === S.te; })[0];
      return { sel: { key: 'dkt.dil.' + g.ay, title: 'Dil gelişimi · ' + yasStr(g.ay), la: 'Dil gelişimi ve afazi', rows: [['Yaş', yasStr(g.ay)], ['Anlama', g.anl], ['İfade', g.ifd], ['Afazi ağacı', a.t], ['Alıştırma', S.q ? S.q.s : '']],
          about: 'öğrenci DKT Lab\'de çocuk dil gelişimi basamaklarına, OSU hesabına ve afazi sınıflamasına çalışıyor. Bireysel çocuk için tanı koyma; gelişimdeki bireysel farkı vurgula.' },
        chips: [['osu', 'OSU Türkçede neden biçimbirimle sayılır?'], ['broca', 'Broca ile Wernicke farkı ne?'], ['uyari', 'Bu yaşta hangi durumda yönlendirilir?']] };
    },
    classify: function (q) { if (/osu|biçimbirim/.test(q)) return 'osu'; if (/broca|wernicke/.test(q)) return 'broca'; if (/yönlendir|uyarı/.test(q)) return 'uyari'; return null; },
    answer: function (k) {
      if (k === 'osu') return 'Türkçe eklemeli bir dildir: tek sözcükte birçok dilbilgisel bilgi eklerle taşınır ("gel-ebil-ecek-ler-miş"). Sözcük saymak çocuğun dilbilgisel gelişimini gizler; biçimbirim saymak eklerin edinimini de yansıtır. Biçimbirim ayırma kuralları (örn. ses değişimleri, birleşik sözcükler) analizden önce sabitlenmelidir.';
      if (k === 'broca') return 'Broca afazisinde konuşma akıcı değildir (zahmetli, kısa, telgraf tarzı), anlama görece iyidir, tekrar bozuktur; hasta çoğunlukla güçlüğünün farkındadır. Wernicke afazisinde konuşma akıcı ama içi boştur, parafaziler ve neolojizmler olur; anlama ve tekrar bozuktur, farkındalık azdır.';
      if (k === 'uyari') { var g = V.GELISIM[S.gi]; return (g.uy ? yasStr(g.ay) + ' için uyarı işareti: ' + g.uy + ' ' : '') + 'Herhangi bir yaşta daha önce kazanılmış dil ya da sosyal becerilerin kaybı her zaman değerlendirmeye yönlendirme nedenidir. İşitme her dil gecikmesinde ilk kontrol edilecek şeydir.'; }
      return null;
    }
  };
})();
