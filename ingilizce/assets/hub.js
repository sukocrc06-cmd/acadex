/* ==========================================================================
   ACADEX ENGLISH · hub (assets/hub.js), 07.11.2026
   Defter açılış sahnesi + beceri ağacı, beceri radarı, kişisel masa (şu an kartı),
   kampüs haritası, yatay hafta şeridi, kalem ilerleme çizgisi.
   Veri yalnız bu tarayıcıdaki kayıtlardan gelir (ACX.ls): uydurma puan yok.
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = W.document;
  var BECERI = [
    { id: 'vocab', ad: 'Vocab', tr: 'kelime', yer: 'kahvaltı', saat: '07:40', not: 'çay demlenene kadar on kelime', t: 'var(--vocab)' },
    { id: 'listening', ad: 'Listening', tr: 'dinleme', yer: 'kampüs otobüsü', saat: '08:15', not: 'kulaklık takılı, yol yirmi dakika', t: 'var(--listening)' },
    { id: 'reading', ad: 'Reading', tr: 'okuma', yer: 'kütüphane', saat: '10:00', not: 'on sayfa PDF, hepsini çevirme', t: 'var(--reading)' },
    { id: 'speaking', ad: 'Speaking', tr: 'konuşma', yer: 'kampüs kafesi', saat: '17:00', not: 'bir dakika hazırlık, iki dakika konuşma', t: 'var(--speaking)' },
    { id: 'writing', ad: 'Writing', tr: 'yazma', yer: 'yurt odası', saat: '21:40', not: 'kırmızı kalem, açıklamalı', t: 'var(--writing)' }
  ];
  var SEV = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  var GMAX = { kolay: 20, orta: 9, zor: 6 };
  var gunAnahtar = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };

  /* panelin etkin olduğu günler (gunluk kaydı) */
  function gunleri(gunluk, id) { return Object.keys(gunluk || {}).filter(function (k) { return gunluk[k] && gunluk[k][id]; }); }
  function son14(gunler, simdi) {
    var sinir = new Date(simdi); sinir.setHours(0, 0, 0, 0); sinir.setDate(sinir.getDate() - 13); var s = gunAnahtar(sinir);
    return gunler.filter(function (k) { return k >= s; }).length;
  }
  function kelimeSay(k) {
    var kart = (k && k.kart) || {}, cicek = 0, yaprak = 0;
    Object.keys(kart).forEach(function (w) { var c = kart[w]; if (!c || !c.son) return; if (c.iv >= 21) cicek++; else if (c.iv >= 3) yaprak++; });
    return { cicek: cicek, yaprak: yaprak, deste: Object.keys(kart).length };
  }

  /* beceri puanı 0–100: ortak 60 (alıştırma 25, hoca 10, hoca turu 5, son 14 günde etkin gün 20) + panele özel 40.
     Panele özel veri yoksa (listening/reading/writing) ortak kısım 100'e ölçeklenir. */
  function beceriler(v, simdi) {
    v = v || {}; simdi = simdi || Date.now();
    var out = {};
    BECERI.forEach(function (b) {
      var bit = Object.keys((v.bitti || {})[b.id] || {}).length, hoca = !!(v.hoca || {})[b.id], tur = +((v.hocaTur || {})[b.id] || 0);
      var gunler = gunleri(v.gunluk, b.id), etkin = son14(gunler, simdi);
      var ortak = Math.min(4, bit) / 4 * 25 + (hoca ? 10 : 0) + Math.min(3, tur) / 3 * 5 + Math.min(7, etkin) / 7 * 20;
      var ozel = null, kaynak = ['alıştırmalar', 'Defne Hoca', 'etkin günler'], ek = {};
      if (b.id === 'vocab') {
        var k = v.kelime || {}, s = kelimeSay(k), si = SEV.indexOf(k.sev);
        ozel = (si >= 0 ? (si + 1) / 6 * 20 : 0) + Math.min(30, s.cicek + s.yaprak * .5) / 30 * 20;
        ek = { sev: si >= 0 ? k.sev : null, cicek: s.cicek, deste: s.deste }; kaynak.push('seviye testi', 'kelime bahçesi');
      } else if (b.id === 'speaking') {
        var g = (v.spGecmis || []).filter(function (x) { return x && !x.kismi && GMAX[x.lv]; }).slice(-5);
        var en = g.reduce(function (m, x) { return Math.max(m, x.genel / GMAX[x.lv]); }, 0);
        var cay = v.cay || {}, cg = Object.keys(cay.gunler || {}).filter(function (d) { return cay.gunler[d] && cay.gunler[d].puan > 0; }).length;
        var ak = Object.keys(v.akGor || {}).reduce(function (n, a) { return n + ((v.akGor[a] || []).length || 0); }, 0);
        ozel = Math.min(1, en) * 20 + (typeof cay.sev === 'number' && cg ? Math.min(6, cay.sev) / 6 * 10 : 0) + Math.min(10, ak) / 10 * 10;
        ek = { sinav: g.length, caySev: cg ? SEV[Math.max(0, Math.min(5, Math.floor(cay.sev)))] : null, cayGun: cg, atolye: ak }; kaynak.push('deneme sınavı', 'çay turları', 'atölye');
      }
      var puan = ozel == null ? ortak / 60 * 100 : ortak + ozel;
      out[b.id] = Object.assign({ puan: Math.round(Math.max(0, Math.min(100, puan))), bit: bit, hoca: hoca, tur: tur, gun: gunler.length, etkin: etkin, kaynak: kaynak }, ek);
    });
    return out;
  }

  /* beceri ağacı: her becerinin beş basamağı; ilk üçü ortak, son ikisi panele özel */
  function agac(id, s) {
    var ortak = [
      { ad: 'İlk alıştırma', acik: s.bit >= 1 },
      { ad: 'Defne Hoca ile tanış', acik: s.hoca },
      { ad: 'Sayfa tamam', acik: s.bit >= 4 }
    ];
    var ozel = id === 'vocab' ? [{ ad: 'Seviye testi', acik: !!s.sev }, { ad: 'İlk çiçek', acik: s.cicek >= 1 }]
      : id === 'speaking' ? [{ ad: 'İlk deneme sınavı', acik: s.sinav >= 1 }, { ad: 'Üç gün çay turu', acik: s.cayGun >= 3 }]
      : [{ ad: 'Üç ayrı gün', acik: s.gun >= 3 }, { ad: 'Yedi ayrı gün', acik: s.gun >= 7 }];
    return ortak.concat(ozel);
  }
  function rozet(dallar) { var n = dallar.filter(function (d) { return d.acik; }).length; return n === 5 ? 'usta' : n >= 3 ? 'gelişiyor' : n >= 1 ? 'filiz' : 'tohum'; }

  /* radar köşeleri: 5 eksen, üstten saat yönünde */
  function radarNokta(puanlar, r, cx, cy) {
    return puanlar.map(function (p, i) { var a = -Math.PI / 2 + i * 2 * Math.PI / puanlar.length, k = r * Math.max(.04, p / 100); return [+(cx + Math.cos(a) * k).toFixed(1), +(cy + Math.sin(a) * k).toFixed(1)]; });
  }

  W.HUB = { BECERI: BECERI, beceriler: beceriler, agac: agac, rozet: rozet, radarNokta: radarNokta, gunAnahtar: gunAnahtar };
  if (!D || !D.getElementById || !D.getElementById('ac')) return;

  /* ====================================================================== ekran */
  var A = W.ACX, esc = A.esc, sakin = A.sakin;
  var dar = function () { return W.innerWidth < 760; };
  function veri() {
    var l = A.ls;
    return { bitti: l.al('bitti', {}), hoca: l.al('hoca', {}), hocaTur: l.al('hocaTur', {}), gunluk: A.gunluk(), kelime: l.al('kelime', null), spGecmis: l.al('spGecmis', []), cay: l.al('cay', null), akGor: l.al('akGor', {}) };
  }
  var V, S;

  /* ---------- defter açılış sahnesi ---------- */
  function agacSvg(d, renk) {
    var y = function (i) { return 196 - i * 44; };
    return '<svg class="agac" viewBox="0 0 120 220" aria-hidden="true"><path class="govde" pathLength="1" d="M60 216 C 58 170, 64 120, 60 20" />' +
      d.map(function (x, i) { var sag = i % 2, yy = y(i); return '<path class="dal' + (x.acik ? ' acik' : '') + '" pathLength="1" d="M60 ' + yy + ' q ' + (sag ? 22 : -22) + ' -4 ' + (sag ? 38 : -38) + ' -16"/><g class="yaprak' + (x.acik ? ' acik' : '') + '" transform="translate(' + (sag ? 98 : 22) + ' ' + (yy - 16) + ')" style="--yd:' + (i * .09) + 's"><path d="M0 -11 C 9 -7 9 7 0 11 C -9 7 -9 -7 0 -11 Z" fill="' + (x.acik ? renk : '#fff') + '"/></g>'; }).join('') + '</svg>';
  }
  function sayfaHtml(b, i) {
    var s = S[b.id], d = agac(b.id, s), r = rozet(d), n = d.filter(function (x) { return x.acik; }).length;
    var alt = b.id === 'vocab' ? (s.sev ? 'seviye ' + s.sev + ' · ' + s.deste + ' kart · ' + s.cicek + ' çiçek' : 'seviye testi bekliyor')
      : b.id === 'speaking' ? (s.sinav ? s.sinav + ' deneme sınavı' : 'deneme sınavı yok') + (s.cayGun ? ' · çay ' + s.cayGun + ' gün' : '')
      : s.gun ? s.gun + ' farklı gün çalıştın' : 'henüz açılmadı';
    return '<article class="ac-sayfa" data-i="' + i + '" style="--t:' + b.t + '">' +
      '<header><span class="mono">' + b.saat + ' · ' + b.yer + '</span><b>' + b.ad + '</b><span class="el">' + b.tr + ' · ' + esc(alt) + '</span></header>' +
      '<div class="ac-govde">' + agacSvg(d, b.t) +
      '<ol class="ac-dal">' + d.map(function (x) { return '<li class="' + (x.acik ? 'acik' : '') + '"><i aria-hidden="true"></i>' + x.ad + '<span class="sr">' + (x.acik ? ' (açıldı)' : ' (kilitli)') + '</span></li>'; }).join('') + '</ol></div>' +
      '<footer><span class="rz rz-' + (r === 'gelişiyor' ? 'gelisiyor' : r) + '" title="rozet"><b>' + r + '</b><small>' + n + '/5</small></span><span class="puan"><b>' + s.puan + '</b><small>beceri puanı</small></span><a class="btn sm ana" href="' + b.id + '.html" style="background:' + b.t + ';color:' + (b.id === 'vocab' ? 'var(--ink)' : '#fff') + '">Aç →</a></footer></article>';
  }
  function acKur() {
    var el = D.getElementById('ac'), sol = el.querySelector('.ac-ici'), sag = el.querySelector('.ac-sag');
    sol.innerHTML = BECERI.map(function (b, i) { return '<li style="--t:' + b.t + '" data-i="' + i + '"><button type="button"><b>' + b.ad + '</b><span>' + S[b.id].puan + '</span><i style="--d:' + S[b.id].puan / 100 + '"></i></button></li>'; }).join('');
    sag.innerHTML = BECERI.map(sayfaHtml).join('');
    var ciz = function (a) {
      var i = a - 1; el.dataset.sayfa = i;
      sag.querySelectorAll('.ac-sayfa').forEach(function (p, k) { p.classList.toggle('on', k === i); p.classList.toggle('gecti', k < i); });
      sol.querySelectorAll('li').forEach(function (li, k) { li.classList.toggle('on', k === i); });
    };
    el.addEventListener('adim', function (e) { ciz(e.detail); });
    ciz(+(el.dataset.a || 0));
    sol.addEventListener('click', function (e) {
      var li = e.target.closest('li'); if (!li) return;
      var n = 6, top = el.getBoundingClientRect().top + W.scrollY, boy = el.offsetHeight - W.innerHeight * .9;
      W.scrollTo({ top: top + boy * (+li.dataset.i + 1.5) / n, behavior: sakin ? 'auto' : 'smooth' });
    });
  }

  /* ---------- beceri radarı ---------- */
  function radarKur() {
    var el = D.getElementById('radar'); if (!el) return;
    var cx = 160, cy = 150, r = 112, p = BECERI.map(function (b) { return S[b.id].puan; });
    var halka = [.25, .5, .75, 1].map(function (k) { return '<polygon class="halka" points="' + radarNokta([100, 100, 100, 100, 100], r * k, cx, cy).map(function (x) { return x.join(','); }).join(' ') + '"/>'; }).join('');
    var eksen = radarNokta([100, 100, 100, 100, 100], r, cx, cy).map(function (x, i) {
      var b = BECERI[i], lx = cx + (x[0] - cx) * 1.2, ly = cy + (x[1] - cy) * 1.2 + 5;
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + x[0] + '" y2="' + x[1] + '"/><text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + (Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end') + '">' + b.ad + '</text>';
    }).join('');
    var n = radarNokta(p, r, cx, cy);
    el.querySelector('.radar-svg').innerHTML = '<svg viewBox="-46 0 412 300" role="img" aria-label="Beceri radarı: ' + BECERI.map(function (b, i) { return b.ad + ' ' + p[i]; }).join(', ') + '">' + halka + eksen +
      '<g class="alan" style="transform-origin:' + cx + 'px ' + cy + 'px"><polygon points="' + n.map(function (x) { return x.join(','); }).join(' ') + '"/>' +
      n.map(function (x, i) { return '<circle cx="' + x[0] + '" cy="' + x[1] + '" r="6" style="fill:' + BECERI[i].t + '"/>'; }).join('') + '</g></svg>';
    el.querySelector('.radar-liste').innerHTML = BECERI.map(function (b) {
      var s = S[b.id];
      return '<li style="--t:' + b.t + '"><div><b>' + b.ad + '</b><small>' + esc(s.kaynak.join(' · ')) + '</small></div><span class="mono">' + s.puan + '</span><i style="--d:' + s.puan / 100 + '"></i></li>';
    }).join('');
  }

  /* ---------- kişisel masa: şu an kartına seviye, seri, bugün ---------- */
  function masaKur() {
    var el = D.getElementById('simdi'); if (!el || !el.innerHTML || el.querySelector('.masa')) return;
    var bugun = gunAnahtar(new Date()), g = V.gunluk, bugunP = Object.keys(g[bugun] || {}).filter(function (p) { return BECERI.some(function (b) { return b.id === p; }); });
    var seri = 0, c = new Date(); c.setHours(0, 0, 0, 0); if (!g[gunAnahtar(c)]) c.setDate(c.getDate() - 1);
    while (g[gunAnahtar(c)]) { seri++; c.setDate(c.getDate() - 1); }
    var sev = S.vocab.sev || S.speaking.caySev;
    var m = D.createElement('div'); m.className = 'masa';
    m.innerHTML = '<div><small>seviye</small><b>' + (sev || '—') + '</b><span>' + (S.vocab.sev ? 'kelime testi' : S.speaking.caySev ? 'çay turları' : 'test bekliyor') + '</span></div>' +
      '<div><small>seri</small><b>' + seri + '</b><span>gün</span></div>' +
      '<div><small>bugün</small><b>' + bugunP.length + '/5</b><span class="nokta">' + BECERI.map(function (b) { return '<i style="--t:' + b.t + '" class="' + (bugunP.indexOf(b.id) >= 0 ? 'on' : '') + '" title="' + b.ad + '"></i>'; }).join('') + '</span></div>';
    el.appendChild(m);
  }

  /* ---------- kampüs haritası: işaret yol üstünde ilerler ---------- */
  var DURAK = [[70, 300], [190, 210], [330, 250], [450, 140], [540, 70]];
  function haritaKur() {
    var el = D.getElementById('rota'), gok = el && el.querySelector('.gok'); if (!gok) return;
    var yol = 'M70 300 C 110 300, 150 230, 190 210 S 290 270, 330 250 S 410 160, 450 140 S 520 90, 540 70';
    var bina = [
      [36, 312, 'kahvaltı', '<rect x="-24" y="-30" width="48" height="30" rx="3"/><path d="M-28 -30 L0 -46 L28 -30 Z"/>'],
      [196, 192, 'otobüs', '<rect x="-22" y="-20" width="44" height="22" rx="6"/><circle cx="-12" cy="3" r="5"/><circle cx="12" cy="3" r="5"/>'],
      [362, 236, 'kütüphane', '<rect x="-30" y="-34" width="60" height="34"/><path d="M-34 -34 L0 -52 L34 -34 Z M-20 -28 v24 M-6 -28 v24 M8 -28 v24 M22 -28 v24"/>'],
      [450, 120, 'kafe', '<rect x="-24" y="-26" width="48" height="26" rx="2"/><path d="M-28 -26 h56 l-6 -10 h-44 Z"/>'],
      [548, 50, 'yurt', '<rect x="-20" y="-44" width="40" height="44"/><path d="M-12 -36 h8 v8 h-8z M4 -36 h8 v8 h-8z M-12 -20 h8 v8 h-8z M4 -20 h8 v8 h-8z"/>']
    ];
    var h = D.createElement('div'); h.className = 'harita'; h.setAttribute('aria-hidden', 'true');
    h.innerHTML = '<svg viewBox="0 0 600 375" preserveAspectRatio="xMidYMid meet">' +
      '<path class="cimen" d="M0 0 H600 V375 H0 Z"/><path class="gol" d="M240 60 q50 -30 96 0 q30 26 -10 46 q-52 20 -90 -6 q-20 -20 4 -40 Z"/>' +
      [[120, 90], [520, 300], [280, 330], [40, 150], [600, 210]].map(function (a) { return '<g class="agacik" transform="translate(' + a[0] + ' ' + a[1] + ')"><circle r="14"/><circle cx="12" cy="6" r="10"/></g>'; }).join('') +
      '<path class="yol-taban" d="' + yol + '"/><path class="yol" d="' + yol + '"/><path class="yol-iz" pathLength="1" d="' + yol + '"/>' +
      bina.map(function (x, i) { return '<g class="bina b' + i + '" transform="translate(' + x[0] + ' ' + x[1] + ')">' + x[3] + '<text y="16" text-anchor="middle">' + x[2] + '</text></g>'; }).join('') +
      DURAK.map(function (x, i) { return '<g class="durak d' + i + '" transform="translate(' + x[0] + ' ' + x[1] + ')"><circle r="11" style="fill:' + BECERI[i].t + '"/><text y="4" text-anchor="middle">' + (i + 1) + '</text></g>'; }).join('') +
      '<g class="isaret"><circle r="9"/><path d="M0 -24 C7 -12 12 -8 12 0 A12 12 0 0 1 -12 0 C-12 -8 -7 -12 0 -24 Z"/></g></svg>';
    gok.insertBefore(h, gok.firstChild);
    var p = h.querySelector('.yol-iz'), isaret = h.querySelector('.isaret'), uzun = p.getTotalLength ? p.getTotalLength() : 0, son = -1;
    var tik = function () {
      var v = parseFloat(el.style.getPropertyValue('--p')) || 0; if (Math.abs(v - son) < .001) return; son = v;
      if (uzun) { var q = p.getPointAtLength(uzun * v); isaret.setAttribute('transform', 'translate(' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + ')'); }
      p.style.strokeDashoffset = (1 - v).toFixed(4);
    };
    var bekle = false; W.addEventListener('scroll', function () { if (!bekle) { bekle = true; requestAnimationFrame(function () { bekle = false; tik(); }); } }, { passive: true });
    tik();
  }

  /* ---------- yatay hafta şeridi: son 4 hafta + bu haftanın kalanı ---------- */
  var GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'], AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  function seritKur() {
    var el = D.getElementById('hafta'), iz = el && el.querySelector('.serit-iz'); if (!iz) return;
    var g = V.gunluk, bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    var pzt = new Date(bugun); pzt.setDate(bugun.getDate() - ((bugun.getDay() + 6) % 7) - 21);
    var h = '', toplam = 0;
    for (var i = 0; i < 28; i++) {
      var d = new Date(pzt); d.setDate(pzt.getDate() + i); var k = gunAnahtar(d), pan = BECERI.filter(function (b) { return g[k] && g[k][b.id]; }), gelecek = d > bugun;
      if (!gelecek && pan.length) toplam++;
      h += (d.getDay() === 1 ? '<span class="hafta-etk">' + d.getDate() + ' ' + AY[d.getMonth()] + ' haftası</span>' : '') +
        '<div class="sg' + (+d === +bugun ? ' bugun' : '') + (gelecek ? ' gelecek' : '') + (pan.length ? ' dolu' : '') + '"><small>' + GUN[d.getDay()] + '</small><b>' + d.getDate() + '</b><span class="lekeler">' +
        pan.map(function (b, j) { return '<i class="leke" style="--lc:' + b.t + ';--lr:' + (j * 67 % 360) + 'deg" title="' + b.ad + '"></i>'; }).join('') + '</span>' + (+d === +bugun ? '<em class="el">bugün</em>' : '') + '</div>';
    }
    iz.innerHTML = h;
    var t = el.querySelector('[data-toplam]'); if (t) t.textContent = toplam + ' / 28 gün mürekkepli';
    var ic = el.querySelector('.serit-ic');
    var tik = function () {
      var r = el.getBoundingClientRect(), boy = el.offsetHeight - W.innerHeight, v = Math.min(1, Math.max(0, -r.top / Math.max(1, boy)));
      var fazla = Math.max(0, iz.scrollWidth - ic.clientWidth);
      iz.style.transform = 'translate3d(' + (-fazla * v).toFixed(1) + 'px,0,0)';
      el.style.setProperty('--sp', v.toFixed(4));
    };
    var bekle = false, iste = function () { if (!bekle) { bekle = true; requestAnimationFrame(function () { bekle = false; tik(); }); } };
    W.addEventListener('scroll', iste, { passive: true }); W.addEventListener('resize', iste); tik();
  }

  /* ---------- kalem ilerleme çizgisi: masaüstünde sol kenar, telefonda üst kenar ---------- */
  function kalemKur() {
    var k = D.createElement('div'); k.className = 'kalem-iz'; k.setAttribute('aria-hidden', 'true'); D.body.appendChild(k);
    var yol, kalem, uzun = 0, yon = null;
    var kur = function () {
      var ust = D.querySelector('.ust'); if (ust) k.style.setProperty('--ust-h', ust.offsetHeight + 'px');
      var y = W.innerWidth < 1200 ? 'yatay' : 'dikey';   /* dar kenar boşluğunda çizgi metne binmesin */ if (y === yon) return; yon = y; k.dataset.yon = y;
      var d = y === 'dikey' ? 'M14 0 C 4 60, 24 120, 14 180 S 4 300, 14 360 S 24 480, 14 540 S 4 660, 14 720 S 24 840, 14 900 S 4 960, 14 1000'
        : 'M0 7 C 60 1, 120 13, 180 7 S 300 1, 360 7 S 480 13, 540 7 S 660 1, 720 7 S 840 13, 900 7 S 960 1, 1000 7';
      k.innerHTML = '<svg viewBox="' + (y === 'dikey' ? '0 0 28 1000' : '0 0 1000 14') + '" preserveAspectRatio="none"><path class="iz-taban" d="' + d + '"/><path class="iz" d="' + d + '"/></svg>' +
        '<span class="kalem"><svg viewBox="-6 -40 12 44"><path d="M-5 -38 h10 v30 l-5 10 l-5 -10 Z" fill="#FFD86B" stroke="#1A2A5C" stroke-width="2" stroke-linejoin="round"/><path d="M-5 -8 l5 10 l5 -10" fill="#F5D7B0" stroke="#1A2A5C" stroke-width="2" stroke-linejoin="round"/><path d="M-1.6 -1 l1.6 3.2 l1.6 -3.2z" fill="#1A2A5C"/><path d="M-5 -38 h10 v5 h-10z" fill="#F29C94" stroke="#1A2A5C" stroke-width="2"/></svg></span>';
      yol = k.querySelector('.iz'); kalem = k.querySelector('.kalem'); uzun = yol.getTotalLength ? yol.getTotalLength() : 1000;
      yol.style.strokeDasharray = uzun; tik();
    };
    var tik = function () {
      var m = D.documentElement.scrollHeight - W.innerHeight, v = m > 0 ? Math.min(1, Math.max(0, W.scrollY / m)) : 0;
      yol.style.strokeDashoffset = (uzun * (1 - v)).toFixed(1);
      var q = yol.getPointAtLength ? yol.getPointAtLength(uzun * v) : { x: 0, y: 0 };
      if (yon === 'dikey') kalem.style.transform = 'translate(-50%,' + (q.y / 1000 * k.clientHeight - 50).toFixed(1) + 'px)';   /* uç çizginin ucunda */
      else kalem.style.transform = 'translate(' + (q.x / 1000 * k.clientWidth - 32).toFixed(1) + 'px,-50%) rotate(-90deg)';
      k.classList.toggle('bitti', v > .995);
    };
    var bekle = false, iste = function () { if (!bekle) { bekle = true; requestAnimationFrame(function () { bekle = false; tik(); }); } };
    W.addEventListener('scroll', iste, { passive: true }); W.addEventListener('resize', function () { kur(); iste(); }); kur();
  }

  /* ---------- ışık katmanı: saate göre pencere ışığı (data-isik) ---------- */
  function isikKur() { var l = D.createElement('div'); l.className = 'isik-katman'; l.setAttribute('aria-hidden', 'true'); l.innerHTML = '<i></i><i></i><i></i>'; D.body.insertBefore(l, D.body.firstChild); }

  function basla() {
    V = veri(); S = beceriler(V);
    isikKur(); acKur(); radarKur(); masaKur(); haritaKur(); seritKur(); kalemKur();
    A.girisler();
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', basla); else basla();
})();
