/* ==========================================================================
   ACADEX ENGLISH · dinleme stüdyosu (assets/dinle.js), 07.11.2026
   Akıllı oynatıcı (karaoke / bulanık / kör metin, cümle döngüsü, 0.65–1.25 hız,
   kelimeye dokun), konuşmacıya göre ses, canlı dalga, otobüs ilerlemesi;
   kategori + seviye kütüphanesi (banka → havuz), günün bölümü (Kampüs Radyosu);
   IELTS/TOEFL soruları (not, seçmeli, eşleştirme, harita), cümle cümle dikte,
   gölge okuma + ton/niyet; kulak haritası (en çok kaçan ses ve kelime türleri).
   Depo: ACX.ls 'dinle' { v, sev, kat, gor{id}, radyo{gün:{id,ok}}, kulak{tür:[doğru,toplam]}, kacan{kelime:n} },
         'dinleEk' (havuzdan gelen bölümler, en çok 30)
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = W.document;
  var P = 'listening';
  var SEV = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  var HIZ = [.65, .75, .9, 1, 1.25];
  var RENK = ['#0F8582', '#DD5A36', '#2D5BD3', '#8A5CC2'];
  var SAYI = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million'.split(' ');
  var SIRA = ' first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth twentieth'.split(' ');
  var ISLEV = 'a an the of to in on at for from by with and or but so if as is are was were be been am do does did has have had it its this that these those there their they them he she we you i me my your our his her not no can could will would shall should may might must than then into onto up out about over just'.split(' ');
  var KULAK = [
    { id: 'sayi', ad: 'Sayılar', alt: 'saat, fiyat, tarih' },
    { id: 'ozel', ad: 'Özel isimler', alt: 'kişi, yer, kurum' },
    { id: 'islev', ad: 'Küçük kelimeler', alt: 'a, the, of, to' },
    { id: 'kisalt', ad: 'Kısaltmalar', alt: '’s, n’t, ’ll, ’d' },
    { id: 'ek', ad: 'Sondaki ekler', alt: '-ed, -s, -ing' },
    { id: 'uzun', ad: 'Uzun kelimeler', alt: '9+ harf' },
    { id: 'icerik', ad: 'Diğer kelimeler', alt: 'isim, fiil, sıfat' }
  ];

  /* ------------------------------------------------------------ saf yardımcılar (testli) */
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9'.\- ]/g, ' ').replace(/(^|\s)[.\-']+|[.\-']+(?=\s|$)/g, ' ')
      .split(/\s+/).filter(Boolean).map(function (w) {
        w = w.replace(/'/g, '');   /* havent = haven't */
        var k = SAYI.indexOf(w); if (k >= 0 && k <= 20) return String(k);
        k = SIRA.indexOf(w); if (k > 0) return String(k);
        return /^\d+(st|nd|rd|th)$/.test(w) ? w.replace(/\D+$/, '') : w;   /* 14th = fourteenth = 14 */
      });
  }
  function kelimeler(s) { return String(s || '').split(/\s+/).filter(Boolean); }
  /* beklenen ↔ yazılan: en uzun ortak alt dizi ile hizalama */
  function karsilastir(beklenen, yazilan) {
    var ham = kelimeler(beklenen), a = ham.map(function (w) { return norm(w)[0] || ''; }), b = norm(yazilan);
    var n = a.length, m = b.length, T = [];
    for (var i = 0; i <= n; i++) { T.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) T[i][j] = a[i] && a[i] === b[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
    var parca = [], kacan = [], ek = [], isabet = 0; i = 0; j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[i] && a[i] === b[j]) { parca.push({ w: ham[i], ok: true, i: i }); isabet++; i++; j++; }
      else if (j < m && (i >= n || T[i][j + 1] >= T[i + 1][j])) { parca.push({ w: b[j], ek: true }); ek.push(b[j]); j++; }
      else { if (a[i]) { parca.push({ w: ham[i], ok: false, i: i }); kacan.push({ w: ham[i], i: i }); } i++; }
    }
    var toplam = a.filter(Boolean).length;
    return { isabet: isabet, toplam: toplam, oran: toplam ? isabet / toplam : 0, parca: parca, kacan: kacan, ek: ek };
  }
  function kategori(ham, ilk) {
    var w = String(ham).replace(/[.,!?;:"“”()]/g, ''), k = w.toLowerCase().replace(/[’‘]/g, "'");
    if (/^\d/.test(k) || SAYI.indexOf(k) >= 0 || SIRA.indexOf(k) > 0 || /^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-/.test(k)) return 'sayi';
    if (/'/.test(k)) return 'kisalt';
    if (!ilk && /^[A-Z]/.test(w) && k !== 'i') return 'ozel';
    if (ISLEV.indexOf(k) >= 0) return 'islev';
    if (k.length >= 9) return 'uzun';
    if (k.length > 4 && /(ed|ing|s)$/.test(k)) return 'ek';
    return 'icerik';
  }
  function cevapDogru(q, girdi) {
    if (q.t === 'not') { var g = norm(girdi).join(' ').replace(/,/g, ''); return !!g && q.c.some(function (c) { return norm(c).join(' ').replace(/,/g, '') === g; }); }
    if (q.t === 'sec') return +girdi === q.d;
    return false;
  }
  function yakin(sev, varolan) {   /* en yakın seviye; eşitse alttaki */
    var i = SEV.indexOf(sev); if (i < 0) i = 2; var en = null, f = 99;
    varolan.forEach(function (s) { var d = Math.abs(SEV.indexOf(s) - i) + (SEV.indexOf(s) > i ? .1 : 0); if (d < f) { f = d; en = s; } });
    return en;
  }
  function tohum(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  /* günün bölümü: seviyeye en yakın bölümlerden, görülmemiş öncelikli; aynı gün hep aynı */
  function gunSec(gun, sev, bolumler, gor) {
    var sevs = bolumler.map(function (b) { return b.sev; }).filter(function (s, i, a) { return a.indexOf(s) === i; });
    var hedef = yakin(sev, sevs), aday = bolumler.filter(function (b) { return b.sev === hedef; });
    var yeni = aday.filter(function (b) { return !(gor || {})[b.id]; }); if (yeni.length) aday = yeni;
    return aday[tohum(gun + ':' + sev) % aday.length];
  }
  function seri(radyo, bugun) {
    var n = 0, c = new Date(bugun); c.setHours(12, 0, 0, 0);
    var k = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
    if (!(radyo[k(c)] && radyo[k(c)].ok)) c.setDate(c.getDate() - 1);
    while (radyo[k(c)] && radyo[k(c)].ok) { n++; c.setDate(c.getDate() - 1); }
    return n;
  }
  /* havuzdan gelen bölüm doğrulaması (sunucudaki DOGRULA.dinle ile aynı kurallar) */
  function dogrula(b) {
    var metin = function (x, n) { return typeof x === 'string' && x.trim().length > 0 && x.length <= n; };
    if (!b || !Array.isArray(b.k) || b.k.length < 1 || b.k.length > 4 || !b.k.every(function (k) { return Array.isArray(k) && metin(k[0], 30) && (k[1] === 'k' || k[1] === 'e'); })) return false;
    if (!Array.isArray(b.s) || b.s.length < 4 || b.s.length > 14 || !b.s.every(function (x) { return Array.isArray(x) && Number.isInteger(x[0]) && x[0] >= 0 && x[0] < b.k.length && metin(x[1], 300) && metin(x[2], 300); })) return false;
    if (!metin(b.b, 80) || !Array.isArray(b.q) || b.q.length < 2 || b.q.length > 6) return false;
    return b.q.every(function (q) {
      if (q.t === 'not') return metin(q.on, 80) && typeof (q.son || '') === 'string' && Array.isArray(q.c) && q.c.length >= 1 && q.c.every(function (c) { return metin(c, 30) && norm(c).length <= 3; });
      if (q.t === 'sec') return metin(q.soru, 200) && Array.isArray(q.sec) && q.sec.length >= 3 && q.sec.length <= 4 && q.sec.every(function (s) { return metin(s, 120); }) && Number.isInteger(q.d) && q.d >= 0 && q.d < q.sec.length;
      if (q.t === 'esle') return metin(q.soru, 200) && Array.isArray(q.sol) && Array.isArray(q.sag) && Array.isArray(q.d) && q.d.length === q.sol.length && q.sag.length >= q.sol.length && q.d.every(function (x) { return Number.isInteger(x) && x >= 0 && x < q.sag.length; });
      return false;   /* harita yalnız bankada */
    }) && (!b.n || Array.isArray(b.n) && b.n.every(function (x) { return Number.isInteger(x.s) && x.s < b.s.length && metin(x.soru, 200) && Array.isArray(x.sec) && Number.isInteger(x.d) && x.d < x.sec.length; }));
  }

  var DINLE = { norm: norm, karsilastir: karsilastir, kategori: kategori, cevapDogru: cevapDogru, yakin: yakin, gunSec: gunSec, seri: seri, dogrula: dogrula, KULAK: KULAK, HIZ: HIZ };
  W.DINLE = DINLE;

  /* ====================================================================== ekran */
  DINLE.kur = function (kok) {
    var A = W.ACX, esc = A.esc, BK = W.DINLE_BANKA;
    var st = A.ls.al('dinle', null);
    if (!st || st.v !== 1) { var kel = A.ls.al('kelime', null); st = { v: 1, sev: kel && kel.sev || 'B1', kat: 'kampus', gor: {}, radyo: {}, kulak: {}, kacan: {} }; }
    var ekler = (A.ls.al('dinleEk', []) || []).filter(dogrula);
    var kaydet = function () { A.ls.yaz('dinle', st); };
    var bugun = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
    var tum = function () { return BK.BOLUM.concat(ekler); };
    var katAd = function (id) { var k = BK.KAT.filter(function (x) { return x.id === id; })[0]; return k ? k.ad : id; };

    var o = { ep: null, i: 0, calisiyor: false, hiz: 1, mod: 'bulanik', dongu: false, ceviri: false, sinav: false, sinavBitti: false, duyuldu: {}, durak: 0, sekme: 'soru', radyo: false };

    kok.innerHTML =
      '<div class="dn-ust">' +
        '<div class="kagit dn-radyo" id="dn-radyo"></div>' +
        '<div class="kagit dn-kitaplik"><div class="dn-sev" role="group" aria-label="Seviye">' + SEV.map(function (s) { return '<button type="button" data-sev="' + s + '">' + s + '</button>'; }).join('') + '</div>' +
          '<div class="dn-raf" role="group" aria-label="Kategori">' + BK.KAT.map(function (k) { return '<button type="button" data-kat="' + k.id + '"><span aria-hidden="true">' + k.ik + '</span>' + k.ad + '</button>'; }).join('') + '</div>' +
          '<div class="dn-liste" id="dn-liste"></div></div>' +
      '</div>' +
      '<div class="kagit dn-oyna" id="dn-oyna">' +
        '<header class="dn-bas"></header>' +
        '<div class="dn-yol" aria-hidden="true"></div>' +
        '<canvas class="dn-dalga" aria-hidden="true"></canvas>' +
        '<div class="dn-kontrol">' +
          '<button type="button" class="btn ana dn-oynat" data-k="oynat">▶ Dinle</button>' +
          '<button type="button" class="btn sm" data-k="geri" aria-label="Önceki cümle">⏮</button>' +
          '<button type="button" class="btn sm" data-k="tekrar" aria-label="Cümleyi tekrarla">⟲ cümle</button>' +
          '<button type="button" class="btn sm" data-k="ileri" aria-label="Sonraki cümle">⏭</button>' +
          '<button type="button" class="btn sm dn-dongu" data-k="dongu" aria-pressed="false">∞ döngü</button>' +
          '<span class="dn-hiz" role="group" aria-label="Hız">' + HIZ.map(function (h) { return '<button type="button" data-hiz="' + h + '">' + h + '×</button>'; }).join('') + '</span>' +
          '<span class="dn-mod" role="group" aria-label="Metin">' + [['kor', 'kör'], ['bulanik', 'bulanık'], ['acik', 'açık']].map(function (m) { return '<button type="button" data-mod="' + m[0] + '">' + m[1] + '</button>'; }).join('') + '</span>' +
          '<button type="button" class="btn sm" data-k="ceviri" aria-pressed="false">TR</button>' +
        '</div>' +
        '<ol class="dn-metin" aria-live="off"></ol>' +
        '<nav class="dn-sekme" role="tablist">' + [['soru', 'Sorular'], ['dikte', 'Dikte'], ['golge', 'Gölge + niyet']].map(function (s) { return '<button type="button" role="tab" data-sekme="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</nav>' +
        '<div class="dn-panel" role="tabpanel"></div>' +
      '</div>' +
      '<div class="kagit dn-kulak" id="dn-kulak"></div>' +
      '<div class="dn-gorev">' + [['bolum', 'Bir bölümün sorularında %60'], ['dikte', 'Üç cümlelik dikte'], ['golge', 'Gölge ve niyet'], ['radyo', 'Günün bölümü']].map(function (g, i) {
        return '<article class="kagit alis dn-g" data-id="' + g[0] + '"><span class="etiket">görev ' + (i + 1) + '</span><b>' + g[1] + '</b><span class="tik" aria-label="tamamlandı">✓</span></article>';
      }).join('') + '</div>';

    var $ = function (s) { return kok.querySelector(s); };
    var oyna = $('#dn-oyna'), metin = $('.dn-metin'), panel = $('.dn-panel');

    /* ---------- sesler: konuşmacıya göre ---------- */
    var KADIN = /female|samantha|karen|serena|victoria|zira|susan|hazel|libby|sonia|aria|jenny|emma|moira|tessa|fiona|kate/i, ERKEK = /\bmale|daniel|alex|fred|david|george|ryan|guy|arthur|oliver|thomas|rishi|james|mark/i;
    var sesListe = function () { try { return speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); }); } catch (e) { return []; } };
    function sesSec(ki) {
      var kisi = o.ep.k[ki] || ['', 'k'], vs = sesListe(), g = kisi[1] === 'k' ? vs.filter(function (v) { return KADIN.test(v.name) && !/male/i.test(v.name.replace(/female/i, '')); }) : vs.filter(function (v) { return ERKEK.test(v.name); });
      var ayni = o.ep.k.slice(0, ki).filter(function (x) { return x[1] === kisi[1]; }).length;
      if (g.length) return { v: g[ayni % g.length], perde: 1 + (g.length > ayni ? 0 : ayni * .12) };
      return { v: vs[0] || null, perde: (kisi[1] === 'k' ? 1.18 : .82) + ayni * .1 };
    }

    /* ---------- dalga ---------- */
    var cv = $('.dn-dalga'), cx = cv.getContext && cv.getContext('2d'), cubuk = [], darbe = 0, renk = RENK[0];
    function dalgaBoyut() { if (!cx) return; var r = W.devicePixelRatio || 1; cv.width = cv.clientWidth * r; cv.height = cv.clientHeight * r; cx.setTransform(r, 0, 0, r, 0, 0); }
    function dalgaCiz() {
      if (!cx) return; var w = cv.clientWidth, h = cv.clientHeight, adim = 6, n = Math.ceil(w / adim);
      if (o.calisiyor) { darbe *= .9; cubuk.push({ a: .18 + Math.random() * .3 + darbe, c: renk }); } else cubuk.push({ a: .04, c: '#B9AE96' });
      while (cubuk.length > n) cubuk.shift();
      cx.clearRect(0, 0, w, h);
      cubuk.forEach(function (b, i) { var y = Math.min(.95, b.a) * h * .5; cx.fillStyle = b.c; if (b.sinir) { cx.fillStyle = '#1A2A5C'; cx.fillRect(i * adim + 1, 0, 2, h); return; } cx.fillRect(i * adim + 1, h / 2 - y, 3.5, y * 2); });
      W.requestAnimationFrame(dalgaCiz);
    }
    if (cx) { W.addEventListener('resize', dalgaBoyut); dalgaBoyut(); if (!A.sakin) W.requestAnimationFrame(dalgaCiz); }

    /* ---------- otobüs yolu ---------- */
    function yolCiz() {
      var n = o.ep.q.reduce(function (t, q) { return t + (q.t === 'esle' ? q.sol.length : q.t === 'harita' ? q.yer.length : 1); }, 0), d = Math.min(o.durak, n);
      var y = $('.dn-yol');
      y.innerHTML = '<div class="hat"></div>' + Array.from({ length: n + 1 }, function (_, i) { return '<i class="dur' + (i <= d ? ' gecti' : '') + '" style="left:' + (i / n * 100) + '%"></i>'; }).join('') +
        '<span class="dinlenen" style="width:' + (o.i / o.ep.s.length * 100).toFixed(1) + '%"></span>' +
        '<span class="otobus' + (o.calisiyor ? ' yuruyor' : '') + '" style="left:' + (d / n * 100) + '%"><svg viewBox="0 0 64 34"><rect x="2" y="2" width="58" height="24" rx="6" fill="#FFD86B" stroke="#1A2A5C" stroke-width="3"/><rect x="8" y="7" width="12" height="9" rx="2" fill="#BFE0EA" stroke="#1A2A5C" stroke-width="2"/><rect x="24" y="7" width="12" height="9" rx="2" fill="#BFE0EA" stroke="#1A2A5C" stroke-width="2"/><rect x="40" y="7" width="14" height="9" rx="2" fill="#BFE0EA" stroke="#1A2A5C" stroke-width="2"/><g class="teker"><circle cx="16" cy="27" r="5.5" fill="#1A2A5C"/><circle cx="16" cy="27" r="2" fill="#fff"/></g><g class="teker"><circle cx="48" cy="27" r="5.5" fill="#1A2A5C"/><circle cx="48" cy="27" r="2" fill="#fff"/></g></svg></span>' +
        '<span class="dn-yol-not mono">' + d + ' / ' + n + ' durak</span>';
    }

    /* ---------- bölüm yükle ---------- */
    function yukle(ep, radyo) {
      dur(); o.ep = ep; o.i = 0; o.duyuldu = {}; o.durak = 0; o.radyo = !!radyo; o.sinav = false; o.sinavBitti = false;
      st.gor[ep.id] = 1; kaydet();
      var tags = ep.k.map(function (k, i) { return '<span class="dn-kisi" style="--kr:' + RENK[i % RENK.length] + '">' + esc(k[0]) + '</span>'; }).join('');
      $('.dn-bas').innerHTML = '<div><span class="etiket">' + (radyo ? '<span class="dn-canli">● yayında</span> kampüs radyosu · ' : '') + esc(katAd(ep.kat)) + ' · ' + ep.sev + '</span><h3>' + esc(ep.b) + '</h3><span class="el">' + esc(ep.tr || '') + '</span></div><div class="dn-kisiler">' + tags + '</div>';
      metin.innerHTML = ep.s.map(function (x, i) {
        var ilk = true;
        return '<li data-i="' + i + '" style="--kr:' + RENK[x[0] % RENK.length] + ';--li:' + i + '"><button type="button" class="dn-tek" data-tek="' + i + '" aria-label="Bu cümleyi dinle">▶</button><span class="dn-ad">' + esc(ep.k[x[0]][0]) + '</span><p lang="en">' +
          kelimeler(x[1]).map(function (w, j) { var s = '<span class="w" data-j="' + j + '">' + esc(w) + '</span>'; ilk = false; return s; }).join(' ') + '</p><p class="dn-tr">' + esc(x[2]) + '</p></li>';
      }).join('');
      modUygula(); yolCiz(); sekmeCiz(); listeCiz();
      oyna.classList.remove('gir'); void oyna.offsetWidth; oyna.classList.add('gir');
    }
    function modUygula() {
      var gizle = o.sinav && o.sinavBitti !== true || o.sekme === 'dikte';   /* dikte ve sınavda metin görünmez */
      metin.className = 'dn-metin ' + (gizle ? 'kor' : o.mod) + (o.ceviri ? ' ceviri' : '');
      kok.querySelectorAll('[data-mod]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.mod === o.mod); b.disabled = gizle; });
      kok.querySelectorAll('[data-hiz]').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.hiz === o.hiz); });
      $('[data-k=dongu]').setAttribute('aria-pressed', o.dongu); $('[data-k=ceviri]').setAttribute('aria-pressed', o.ceviri);
      Object.keys(o.duyuldu).forEach(function (k) { var p = k.split(':'), w = metin.querySelector('li[data-i="' + p[0] + '"] .w[data-j="' + p[1] + '"]'); if (w) w.classList.add('duyuldu'); });
    }

    /* ---------- oynatma ---------- */
    var zaman = null, nesil = 0;
    function dur() { nesil++; clearTimeout(zaman); try { speechSynthesis.cancel(); } catch (e) {} o.calisiyor = false; durumCiz(); }
    function durumCiz() {
      var b = $('[data-k=oynat]'); if (!b) return;
      var kilit = o.sinav && o.sinavBitti === 'dinlendi';
      b.textContent = o.calisiyor ? '⏸ Durdur' : kilit ? 'Sınavda tek dinleme' : '▶ Dinle'; b.disabled = kilit;
      kok.querySelectorAll('[data-k=geri],[data-k=tekrar],[data-k=ileri],.dn-tek').forEach(function (x) { x.disabled = o.sinav && !o.sinavBitti || kilit; });
      metin.querySelectorAll('li').forEach(function (li) { li.classList.toggle('simdi', o.calisiyor && +li.dataset.i === o.i); });
      if (o.ep) yolCiz();
    }
    function satir(i, bitti) {
      var x = o.ep.s[i], ham = x[1], kel = kelimeler(ham), my = nesil, li = metin.querySelector('li[data-i="' + i + '"]');
      var ws = li ? li.querySelectorAll('.w') : [], son = -1;
      var isaretle = function (j) { if (my !== nesil) return; for (var k = son + 1; k <= j && k < ws.length; k++) { ws[k].classList.add('duyuldu', 'kw-gecti'); o.duyuldu[i + ':' + k] = 1; } ws.forEach(function (w, k) { w.classList.toggle('kw-simdi', k === j); }); son = Math.max(son, j); darbe = .55; };
      var bas = [], p = 0; kel.forEach(function (w) { var k = ham.indexOf(w, p); bas.push(k); p = k + w.length; });
      renk = RENK[x[0] % RENK.length]; cubuk.push({ sinir: true });
      li && li.scrollIntoView && !A.sakin && W.innerWidth > 760 && li.getBoundingClientRect().top > W.innerHeight - 120 && li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      var bitir = function () { if (my !== nesil) return; clearTimeout(zaman); isaretle(kel.length - 1); ws.forEach(function (w) { w.classList.remove('kw-simdi'); }); bitti(); };
      if (!A.sesVar) { isaretle(kel.length - 1); zaman = setTimeout(bitir, 400); return; }
      var u = new SpeechSynthesisUtterance(ham), s = sesSec(x[0]); u.lang = 'en-GB'; if (s.v) u.voice = s.v; u.rate = o.hiz; u.pitch = Math.max(.5, Math.min(1.6, s.perde));
      var sinirVar = false, tahmin = function (j) { if (sinirVar || my !== nesil || j >= kel.length) return; isaretle(j); zaman = setTimeout(function () { tahmin(j + 1); }, Math.max(160, kel[j].length * 62) / o.hiz); };
      u.onboundary = function (e) { if (e.name && e.name !== 'word') return; sinirVar = true; clearTimeout(zaman); var j = 0; while (j + 1 < bas.length && bas[j + 1] <= e.charIndex) j++; isaretle(j); };
      u.onstart = function () { zaman = setTimeout(function () { tahmin(0); }, 600); };
      u.onend = bitir; u.onerror = bitir;
      try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { bitir(); }
    }
    function calis(tek) {
      if (!o.ep) return; o.calisiyor = true; durumCiz(); var my = ++nesil;
      if (o.radyo && o.i === 0 && !tek) A.sesCal('sayfa');
      var sonraki = function () {
        if (my !== nesil) return;
        if (o.dongu) { satir(o.i, sonraki); return; }
        if (tek) { o.calisiyor = false; durumCiz(); return; }
        o.i++; if (o.i >= o.ep.s.length) { o.i = o.ep.s.length; o.calisiyor = false; if (o.sinav && !o.sinavBitti) { o.sinavBitti = 'dinlendi'; A.soyle('Sınavda olduğu gibi tek dinleme bitti. Cevaplarını kontrol et.', 4500); } else o.i = 0; durumCiz(); return; }
        durumCiz(); satir(o.i, sonraki);
      };
      satir(o.i, sonraki);
    }

    /* ---------- kütüphane, radyo ---------- */
    function radyoCiz() {
      var r = st.radyo[bugun()], n = seri(st.radyo, Date.now());   /* günün bölümü bir kez seçilince gün boyu sabit */
      var ep = r && tum().filter(function (b) { return b.id === r.id; })[0] || gunSec(bugun(), st.sev, tum(), st.gor);
      if (!r) { st.radyo[bugun()] = { id: ep.id, ok: 0 }; kaydet(); }
      $('#dn-radyo').innerHTML = '<div class="dn-anten" aria-hidden="true"><i></i><i></i><i></i></div><span class="etiket">günün bölümü · ' + new Date().toLocaleDateString('tr', { day: 'numeric', month: 'long', weekday: 'long' }) + '</span>' +
        '<b>Kampüs Radyosu</b><p><span lang="en">' + esc(ep.b) + '</span> <span class="el">' + esc(katAd(ep.kat)) + ' · ' + ep.sev + '</span></p>' +
        '<div class="alt-satir"><button type="button" class="btn ana sm" data-radyo="' + esc(ep.id) + '">' + (r && r.ok ? '✓ dinlendi · tekrar aç' : '▶ yayını aç') + '</button><span class="mono">' + (n ? n + ' günlük radyo serisi' : 'seri bugün başlar') + '</span></div>';
    }
    function listeCiz() {
      kok.querySelectorAll('[data-sev]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.sev === st.sev); });
      kok.querySelectorAll('[data-kat]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.kat === st.kat); });
      var liste = tum().filter(function (b) { return b.kat === st.kat; }).sort(function (a, b) { return SEV.indexOf(a.sev) - SEV.indexOf(b.sev); });
      var hedef = yakin(st.sev, liste.map(function (b) { return b.sev; }));
      $('#dn-liste').innerHTML = liste.map(function (b) {
        return '<button type="button" class="dn-ep' + (b.sev === hedef ? ' uygun' : '') + (o.ep && o.ep.id === b.id ? ' acik' : '') + (st.gor[b.id] ? ' gordu' : '') + '" data-ep="' + esc(b.id) + '"><span class="mono">' + b.sev + '</span><b lang="en">' + esc(b.b) + '</b><small>' + b.s.length + ' cümle · ' + b.q.length + ' soru' + (st.gor[b.id] ? ' · dinlendi' : '') + '</small></button>';
      }).join('') + '<button type="button" class="dn-ep yeni" data-yeni><span class="mono">+</span><b>Yeni bölüm getir</b><small>' + esc(katAd(st.kat)) + ' · ' + st.sev + ' · havuzdan</small></button>';
    }
    async function yeniGetir(b) {
      b.disabled = true; b.querySelector('small').textContent = 'getiriliyor…';
      var v = await A.icerik('dinle', st.kat + ':' + st.sev);
      if (v && dogrula(v)) {
        var ep = Object.assign({}, v, { id: 'ek-' + st.kat + '-' + st.sev + '-' + tohum(JSON.stringify(v.s)), kat: st.kat, sev: st.sev, harita: null });
        if (!ekler.some(function (e) { return e.id === ep.id; })) { ekler.push(ep); ekler = ekler.slice(-30); A.ls.yaz('dinleEk', ekler); }
        yukle(ep); A.sevin();
      } else { A.soyle('Şu an yeni bölüm getiremedim; bankadaki bölümler duruyor.', 4000); listeCiz(); }
    }

    /* ---------- sekmeler ---------- */
    function sekmeCiz() {
      kok.querySelectorAll('[data-sekme]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.sekme === o.sekme); });
      ({ soru: soruCiz, dikte: dikteCiz, golge: golgeCiz })[o.sekme](); if (o.ep) modUygula();
    }

    /* sorular: IELTS/TOEFL tipleri */
    function haritaSvg(h) {
      return '<svg class="dn-harita" viewBox="0 0 100 100" role="img" aria-label="Harita"><rect x="1" y="1" width="98" height="98" rx="4" class="zemin"/>' +
        '<path class="patika" d="M50 96 V60 M50 60 H20 M50 60 H82 M50 60 V18 M50 30 H24 M50 30 H86"/>' +
        h.sabit.map(function (s) { return '<g class="sabit"><rect x="' + (s[1] - 13) + '" y="' + (s[2] - 4) + '" width="26" height="8" rx="2"/><text x="' + s[1] + '" y="' + (s[2] + 1.6) + '">' + esc(s[0]) + '</text></g>'; }).join('') +
        Object.keys(h.harf).map(function (k) { var p = h.harf[k]; return '<g class="harf"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="5.2"/><text x="' + p[0] + '" y="' + (p[1] + 2) + '">' + k + '</text></g>'; }).join('') + '</svg>';
    }
    function soruCiz() {
      var ep = o.ep, harfler = 'ABCDEFGH';
      panel.innerHTML = '<div class="dn-soru-ust"><label class="dn-sinav"><input type="checkbox"' + (o.sinav ? ' checked' : '') + ' data-sinav> Sınav gibi: metin gizli, tek dinleme, 1× hız</label><span class="mono">IELTS / TOEFL soru tipleri</span></div>' +
        '<ol class="dn-sorular">' + ep.q.map(function (q, i) {
          if (q.t === 'not') return '<li class="q-not" data-q="' + i + '"><span class="tip">not tamamlama</span><label>' + esc(q.on) + ' <input type="text" autocomplete="off" spellcheck="false" autocapitalize="off" aria-label="Boşluk ' + (i + 1) + '"> ' + esc(q.son || '') + '</label><small>en çok iki kelime ve/veya bir sayı</small></li>';
          if (q.t === 'sec') return '<li class="q-sec" data-q="' + i + '"><span class="tip">çoktan seçmeli</span><p lang="en">' + esc(q.soru) + '</p><div class="sec">' + q.sec.map(function (s, k) { return '<button type="button" data-s="' + k + '" lang="en">' + harfler[k] + ' · ' + esc(s) + '</button>'; }).join('') + '</div></li>';
          if (q.t === 'esle') return '<li class="q-esle" data-q="' + i + '"><span class="tip">eşleştirme</span><p lang="en">' + esc(q.soru) + '</p><ul class="sag" lang="en">' + q.sag.map(function (s, k) { return '<li><b>' + harfler[k] + '</b> ' + esc(s) + '</li>'; }).join('') + '</ul>' +
            q.sol.map(function (s, k) { return '<label class="sol"><span lang="en">' + esc(s) + '</span><select data-e="' + k + '"><option value="">—</option>' + q.sag.map(function (_, m) { return '<option value="' + m + '">' + harfler[m] + '</option>'; }).join('') + '</select></label>'; }).join('') + '</li>';
          if (q.t === 'harita' && ep.harita) return '<li class="q-harita" data-q="' + i + '"><span class="tip">harita etiketleme</span><div class="dn-harita-k">' + haritaSvg(ep.harita) + '<div>' + q.yer.map(function (y, k) { return '<label class="sol"><span lang="en">' + esc(y[0]) + '</span><select data-h="' + k + '"><option value="">—</option>' + Object.keys(ep.harita.harf).map(function (h) { return '<option>' + h + '</option>'; }).join('') + '</select></label>'; }).join('') + '</div></div></li>';
          return '';
        }).join('') + '</ol><div class="alt-satir"><span class="mono" data-skor></span><button type="button" class="btn ana" data-kontrol>Kontrol et</button></div>';
    }
    function soruKontrol() {
      var ep = o.ep, dogru = 0, toplam = 0;
      ep.q.forEach(function (q, i) {
        var li = panel.querySelector('[data-q="' + i + '"]'); if (!li) return;
        if (q.t === 'not') { var inp = li.querySelector('input'), ok = cevapDogru(q, inp.value); toplam++; if (ok) dogru++; li.classList.toggle('dogru', ok); li.classList.toggle('yanlis', !ok); kulakEkle([{ w: q.c[0], ok: ok }]); cevapGoster(li, ok ? '' : q.c[0]); }
        if (q.t === 'sec') { var sec = li.querySelector('.sec .on'), ok2 = sec && cevapDogru(q, sec.dataset.s); toplam++; if (ok2) dogru++; li.querySelectorAll('.sec button').forEach(function (b) { b.classList.toggle('dogru', +b.dataset.s === q.d); b.classList.toggle('yanlis', b.classList.contains('on') && +b.dataset.s !== q.d); }); }
        if (q.t === 'esle') li.querySelectorAll('select').forEach(function (s) { var ok3 = s.value !== '' && +s.value === q.d[+s.dataset.e]; toplam++; if (ok3) dogru++; s.parentNode.classList.toggle('dogru', ok3); s.parentNode.classList.toggle('yanlis', !ok3); s.parentNode.dataset.cevap = 'ABCDEFGH'[q.d[+s.dataset.e]]; });
        if (q.t === 'harita') li.querySelectorAll('select').forEach(function (s) { var ok4 = s.value === q.yer[+s.dataset.h][1]; toplam++; if (ok4) dogru++; s.parentNode.classList.toggle('dogru', ok4); s.parentNode.classList.toggle('yanlis', !ok4); s.parentNode.dataset.cevap = q.yer[+s.dataset.h][1]; });
      });
      var once = o.durak; o.durak = dogru; yolCiz();
      if (dogru > once) { var bus = $('.otobus'); if (bus) { bus.classList.remove('zipla'); void bus.offsetWidth; bus.classList.add('zipla'); } A.sesCal(dogru === toplam ? 'bitti' : 'dogru'); }
      var oran = toplam ? dogru / toplam : 0;
      panel.querySelector('[data-skor]').textContent = dogru + ' / ' + toplam + ' doğru · %' + Math.round(oran * 100);
      if (o.sinav) { o.sinavBitti = true; o.i = 0; modUygula(); durumCiz(); }
      if (oran >= .6) { if (A.bitir(P, 'bolum')) A.soyle('Bölüm tamam; otobüs son durağa yaklaştı.', 3500); if (o.radyo) { st.radyo[bugun()] = { id: ep.id, ok: 1 }; kaydet(); radyoCiz(); A.bitir(P, 'radyo'); } A.sevin(); }
      else A.uz();
    }
    function cevapGoster(li, c) { var s = li.querySelector('.cevap'); if (!s) { s = D.createElement('span'); s.className = 'cevap mono'; li.appendChild(s); } s.textContent = c ? 'doğrusu: ' + c : ''; }

    /* dikte: bölümün cümleleri tek tek */
    var dk = { i: 0, ipucu: 0, ok: {} };
    function dikteSatirlar() { return o.ep.s.map(function (x, i) { return i; }).filter(function (i) { var n = kelimeler(o.ep.s[i][1]).length; return n >= 4 && n <= 20; }).slice(0, 5); }
    function dikteCiz() {
      var sat = dikteSatirlar(); if (dk.ep !== o.ep.id) { dk = { ep: o.ep.id, i: 0, ipucu: 0, ok: {} }; }
      var i = sat[dk.i], cumle = o.ep.s[i][1], k = kelimeler(cumle);
      var ipucu = dk.ipucu ? '<p class="dn-ipucu mono" lang="en">' + k.map(function (w) { var t = w.replace(/[.,!?;:"“”]/g, ''); return esc(t.slice(0, dk.ipucu) + t.slice(dk.ipucu).replace(/[A-Za-z0-9]/g, '_')); }).join(' ') + '</p>' : '';
      panel.innerHTML = '<div class="dn-dikte"><div class="dn-dk-ust"><span class="mono">cümle ' + (dk.i + 1) + ' / ' + sat.length + ' · ' + esc(o.ep.k[o.ep.s[i][0]][0]) + '</span><span class="dn-dk-nok">' + sat.map(function (_, j) { return '<i class="' + (dk.ok[j] ? 'ok' : j === dk.i ? 'on' : '') + '"></i>'; }).join('') + '</span></div>' +
        '<div class="dugmeler"><button type="button" class="btn sm" data-dk="dinle">▶ Dinle</button><button type="button" class="btn sm" data-dk="yavas">🐢 Yavaş</button><button type="button" class="btn sm" data-dk="ipucu">İpucu</button></div>' + ipucu +
        '<label class="gizli" for="dn-dk">Duyduğun cümle</label><textarea id="dn-dk" rows="2" spellcheck="false" autocapitalize="off" placeholder="Duyduğunu yaz…"></textarea>' +
        '<div class="dn-dk-sonuc"></div><div class="alt-satir"><button type="button" class="btn" data-dk="sonraki">Sonraki cümle →</button><button type="button" class="btn ana" data-dk="kontrol">Kontrol et</button></div></div>';
    }
    function dikteKontrol() {
      var sat = dikteSatirlar(), i = sat[dk.i], k = karsilastir(o.ep.s[i][1], panel.querySelector('#dn-dk').value);
      panel.querySelector('.dn-dk-sonuc').innerHTML = '<p class="dn-fark" lang="en">' + k.parca.map(function (p) { return '<span class="' + (p.ek ? 'ek' : p.ok ? 'ok' : 'kac') + '">' + esc(p.w) + '</span>'; }).join(' ') + '</p>' +
        '<p class="el">%' + Math.round(k.oran * 100) + (k.oran === 1 ? ' — kusursuz.' : k.oran >= .8 ? ' — çok yakın.' : ' — bir daha dinle; kırmızılar kaçanlar.') + '</p>';
      var tam = kelimeler(o.ep.s[i][1]);
      kulakEkle(tam.map(function (w, j) { return { w: w, ilk: j === 0, ok: !k.kacan.some(function (x) { return x.i === j; }) }; }));
      if (k.oran >= .8 && !dk.ok[dk.i]) { dk.ok[dk.i] = 1; A.sevin(); if (Object.keys(dk.ok).length >= 3 && A.bitir(P, 'dikte')) A.soyle('Dikte görevi tamam.', 3000); }
      else if (k.oran < .8) A.uz();
      panel.querySelectorAll('.dn-dk-nok i').forEach(function (x, j) { x.className = dk.ok[j] ? 'ok' : j === dk.i ? 'on' : ''; });
    }

    /* gölge okuma + ton/niyet */
    var gl = { ep: null, ok: {}, niyet: {} };
    var tanima = W.SpeechRecognition || W.webkitSpeechRecognition;
    function niyetler() {
      var ep = o.ep, ek = BK.NIYET.slice(), t = tohum(ep.id), sec = [];
      for (var k = 0; k < 3 && ek.length; k++) sec.push(ek.splice((t + k * 7) % ek.length, 1)[0]);
      return (ep.n || []).map(function (n) { return { en: ep.s[n.s][1], ki: ep.s[n.s][0], soru: n.soru, sec: n.sec, d: n.d, neden: n.neden }; }).concat(sec);
    }
    function golgeCiz() {
      if (gl.ep !== o.ep.id) gl = { ep: o.ep.id, ok: {}, niyet: {} };
      var sat = o.ep.s.slice(0, 6), ny = niyetler();
      panel.innerHTML = '<div class="dn-golge"><div><h4>Gölge okuma</h4><p class="say">Dinle, hemen ardından aynı ritimle söyle' + (tanima ? '' : ' (tarayıcın mikrofonu tanımıyor; yazarak da olur)') + '.</p><ol class="dn-g-liste">' +
        sat.map(function (x, i) { return '<li data-g="' + i + '"><p lang="en">' + esc(x[1]) + '</p><div class="dugmeler"><button type="button" class="btn sm" data-gd="' + i + '">▶</button>' + (tanima ? '<button type="button" class="btn sm ana" data-gm="' + i + '">🎙 Tekrarla</button>' : '<input type="text" data-gy="' + i + '" placeholder="söylediğini yaz" aria-label="Söylediğin"><button type="button" class="btn sm" data-gk="' + i + '">✓</button>') + '<span class="mono" data-gs="' + i + '"></span></div></li>'; }).join('') +
        '</ol></div><div><h4>Ton ve niyet</h4><p class="say">TOEFL “function / attitude” soruları: kim ne demek istiyor?</p><ol class="dn-n-liste">' +
        ny.map(function (n, i) { return '<li data-n="' + i + '"><button type="button" class="btn sm" data-nd="' + i + '">▶ dinle</button><p lang="en">' + esc(n.soru) + '</p><div class="sec">' + n.sec.map(function (s, k) { return '<button type="button" data-ns="' + k + '" lang="en">' + esc(s) + '</button>'; }).join('') + '</div><p class="neden" hidden></p></li>'; }).join('') + '</ol></div></div>';
      panel._ny = ny;
    }
    function golgePuan(i, soz) {
      var k = karsilastir(o.ep.s[i][1], soz), el = panel.querySelector('[data-gs="' + i + '"]');
      if (el) el.textContent = '%' + Math.round(k.oran * 100) + (k.kacan.length ? ' · kaçan: ' + k.kacan.slice(0, 3).map(function (x) { return x.w.replace(/[.,!?]/g, ''); }).join(', ') : '');
      if (k.oran >= .6) gl.ok[i] = 1; golgeBitti();
    }
    function golgeBitti() { if (Object.keys(gl.ok).length >= 2 && Object.keys(gl.niyet).filter(function (k) { return gl.niyet[k]; }).length >= 2 && A.bitir(P, 'golge')) A.soyle('Gölge ve niyet görevi tamam.', 3000); }
    function mikrofon(i, b) {
      var r = new tanima(); r.lang = 'en-GB'; r.interimResults = false; r.maxAlternatives = 1;
      b.disabled = true; b.textContent = '● dinliyorum';
      r.onresult = function (e) { golgePuan(i, e.results[0][0].transcript); };
      r.onend = function () { b.disabled = false; b.textContent = '🎙 Tekrarla'; };
      r.onerror = function () { b.disabled = false; b.textContent = '🎙 Tekrarla'; A.soyle('Mikrofona ulaşamadım; izin verdiğinden emin ol.', 3500); };
      try { r.start(); } catch (e) { r.onerror(); }
    }
    function sesle(t, ki, hiz, perde) {
      if (!A.sesVar) return; dur(); var u = new SpeechSynthesisUtterance(t), s = ki == null ? { v: null, perde: 1 } : sesSec(ki);
      u.lang = 'en-GB'; if (s.v) u.voice = s.v; u.rate = hiz || o.hiz; u.pitch = perde || s.perde; try { speechSynthesis.speak(u); } catch (e) {}
    }

    /* ---------- kulak haritası ---------- */
    function kulakEkle(liste) {
      liste.forEach(function (x) {
        var c = kategori(x.w, x.ilk), k = st.kulak[c] || [0, 0]; k[1]++; if (x.ok) k[0]++; st.kulak[c] = k;
        if (!x.ok) { var w = String(x.w).toLowerCase().replace(/[.,!?;:"“”()]/g, '').replace(/’/g, "'"); if (w) st.kacan[w] = (st.kacan[w] || 0) + 1; }
      });
      var ks = Object.keys(st.kacan).sort(function (a, b) { return st.kacan[b] - st.kacan[a]; }); if (ks.length > 80) ks.slice(80).forEach(function (w) { delete st.kacan[w]; });
      kaydet(); kulakCiz();
    }
    function kulakCiz() {
      var top = Object.keys(st.kacan).sort(function (a, b) { return st.kacan[b] - st.kacan[a]; }).slice(0, 8);
      $('#dn-kulak').innerHTML = '<div class="dn-k-bas"><div><span class="etiket">kulak haritası</span><h3>Kulağın en çok neyi kaçırıyor?</h3><p class="say">Dikte ve not sorularından birikir. Kırmızı kaçanlar çok, yeşil sağlam.</p></div></div>' +
        '<div class="dn-k-izgara">' + KULAK.map(function (k, i) {
          var v = st.kulak[k.id], oran = v && v[1] ? v[0] / v[1] : null;
          return '<div class="dn-k-hucre' + (oran == null ? ' bos' : '') + '" style="--h:' + (oran == null ? 0 : Math.round(8 + oran * 130)) + ';--oran:' + (oran == null ? 0 : oran.toFixed(2)) + ';--gd:' + (i * .06) + 's"><b>' + k.ad + '</b><small>' + k.alt + '</small><span class="mono">' + (oran == null ? 'veri yok' : '%' + Math.round(oran * 100) + ' · ' + v[1] + ' kelime') + '</span><i aria-hidden="true"></i></div>';
        }).join('') + '</div>' +
        (top.length ? '<div class="dn-k-kacan"><span class="etiket">en çok kaçanlar</span>' + top.map(function (w) { return '<button type="button" class="dn-k-w" data-kw="' + esc(w) + '" lang="en">▶ ' + esc(w) + ' <small>×' + st.kacan[w] + '</small></button>'; }).join('') + '</div>' : '');
    }

    /* ---------- olaylar ---------- */
    kok.addEventListener('click', function (e) {
      var t = e.target, b = t.closest('button');
      var w = t.closest('.dn-metin .w');
      if (w && !b && (metin.classList.contains('acik') || w.classList.contains('duyuldu')) && A.kelimeAc) { A.kelimeAc(w.textContent.replace(/[.,!?;:"“”()]/g, ''), w.getBoundingClientRect()); return; }
      if (!b) return;
      if (b.dataset.sev) { st.sev = b.dataset.sev; kaydet(); listeCiz(); radyoCiz(); return; }
      if (b.dataset.kat) { st.kat = b.dataset.kat; kaydet(); listeCiz(); return; }
      if (b.dataset.ep) { var ep = tum().filter(function (x) { return x.id === b.dataset.ep; })[0]; if (ep) { yukle(ep); oyna.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' }); } return; }
      if (b.hasAttribute('data-yeni')) { yeniGetir(b); return; }
      if (b.dataset.radyo) { var r = tum().filter(function (x) { return x.id === b.dataset.radyo; })[0]; if (r) { yukle(r, true); oyna.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' }); } return; }
      if (b.dataset.hiz) { o.hiz = +b.dataset.hiz; modUygula(); return; }
      if (b.dataset.mod) { o.mod = b.dataset.mod; modUygula(); return; }
      if (b.dataset.sekme) { o.sekme = b.dataset.sekme; sekmeCiz(); return; }
      if (b.dataset.tek != null) { dur(); o.i = +b.dataset.tek; calis(true); return; }
      var k = b.dataset.k;
      if (k === 'oynat') { if (o.calisiyor) dur(); else { if (o.sinav) { o.i = 0; o.hiz = 1; modUygula(); } calis(false); } return; }
      if (k === 'geri' || k === 'ileri' || k === 'tekrar') { dur(); o.i = Math.max(0, Math.min(o.ep.s.length - 1, o.i + (k === 'geri' ? -1 : k === 'ileri' ? 1 : 0))); calis(true); return; }
      if (k === 'dongu') { o.dongu = !o.dongu; modUygula(); return; }
      if (k === 'ceviri') { o.ceviri = !o.ceviri; modUygula(); return; }
      /* sorular */
      if (b.dataset.s != null && b.closest('.q-sec')) { b.parentNode.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); return; }
      if (b.hasAttribute('data-kontrol')) { soruKontrol(); return; }
      /* dikte */
      if (b.dataset.dk) {
        var di = dikteSatirlar()[dk.i];
        if (b.dataset.dk === 'dinle') { o.i = di; calis(true); }
        if (b.dataset.dk === 'yavas') { var h = o.hiz; o.hiz = .65; o.i = di; calis(true); o.hiz = h; }
        if (b.dataset.dk === 'ipucu') { dk.ipucu = Math.min(dk.ipucu + 1, 6); var deger = panel.querySelector('#dn-dk').value; dikteCiz(); panel.querySelector('#dn-dk').value = deger; }
        if (b.dataset.dk === 'kontrol') dikteKontrol();
        if (b.dataset.dk === 'sonraki') { dk.i = (dk.i + 1) % dikteSatirlar().length; dk.ipucu = 0; dikteCiz(); }
        return;
      }
      /* gölge + niyet */
      if (b.dataset.gd != null) { sesle(o.ep.s[+b.dataset.gd][1], o.ep.s[+b.dataset.gd][0]); return; }
      if (b.dataset.gm != null) { dur(); mikrofon(+b.dataset.gm, b); return; }
      if (b.dataset.gk != null) { golgePuan(+b.dataset.gk, panel.querySelector('[data-gy="' + b.dataset.gk + '"]').value); return; }
      if (b.dataset.nd != null) { var n = panel._ny[+b.dataset.nd]; sesle(n.en, n.ki, n.hiz, n.perde); return; }
      if (b.dataset.ns != null) {
        var li = b.closest('[data-n]'), ni = +li.dataset.n, nn = panel._ny[ni], dogru = +b.dataset.ns === nn.d; if (li.classList.contains('cevap')) return;
        li.classList.add('cevap'); li.querySelectorAll('.sec button').forEach(function (x) { x.classList.toggle('dogru', +x.dataset.ns === nn.d); x.classList.toggle('yanlis', x === b && !dogru); });
        var ne = li.querySelector('.neden'); ne.hidden = false; ne.innerHTML = '<span lang="en">“' + esc(nn.en) + '”</span> — ' + esc(nn.neden);
        gl.niyet[ni] = dogru; if (dogru) A.sevin(); else A.uz(); golgeBitti(); return;
      }
      if (b.dataset.kw) { sesle(b.dataset.kw, null, .85); return; }
    });
    kok.addEventListener('change', function (e) {
      if (e.target.matches('[data-sinav]')) { o.sinav = e.target.checked; o.sinavBitti = false; dur(); o.i = 0; if (o.sinav) o.hiz = 1; modUygula(); durumCiz(); }
    });

    radyoCiz(); kulakCiz();
    var ilk = gunSec(bugun(), st.sev, tum().filter(function (b) { return b.kat === st.kat; }), st.gor) || BK.BOLUM[0];
    yukle(ilk);
    A.sayac();
    return { yukle: yukle, durum: o };
  };
})();
