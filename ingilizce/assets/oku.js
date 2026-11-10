/* ==========================================================================
   ACADEX ENGLISH · okuma masası (assets/oku.js), 07.11.2026
   Akıllı okuyucu (kelimeye dokun → anlam, fosfor kalemi + kenar notu, öğrendiğin ve
   seviyenin üstündeki kelimeler işaretli), kategori + seviye kütüphanesi (banka → havuz),
   günün makalesi (Kampüs Gazetesi), IELTS Academic soru tipleri, süreli göz gezdirme ve
   tarama, hız antrenmanı (tek kelime / öbek / kılavuz / kendi hızını ölç),
   okuma ilerleme çizgisi ve paragraf yapı haritası.
   Depo: ACX.ls 'oku' { v, sev, kat, gor{id}, gazete{gün:{id,ok}}, fos{id:[{p,a,b,not}]}, hiz:[{t,wpm,anlama,mod}], wpm },
         'okuEk' (havuzdan gelen makaleler, en çok 30)
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = W.document;
  var P = 'reading';
  var SEV = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  var TFNG = { T: 'TRUE', F: 'FALSE', NG: 'NOT GIVEN' };
  var ROMA = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'];
  var HARF = 'ABCDEFGH';

  /* ------------------------------------------------------------ saf yardımcılar (testli) */
  function norm(s) { return String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[–—]/g, '-').replace(/[^a-z0-9'\- ]/g, ' ').split(/\s+/).filter(Boolean).map(function (w) { return w.replace(/'s$/, '').replace(/^[-']+|[-']+$/g, ''); }).filter(Boolean); }   /* FitzGerald's = fitzgerald */
  function kelimeler(s) { return String(s || '').split(/\s+/).filter(Boolean); }
  function sayKelime(m) { return m.p.reduce(function (t, p) { return t + kelimeler(p).length; }, 0); }
  function sure(m, wpm) { return Math.max(1, Math.round(sayKelime(m) / (wpm || 180))); }
  function tamamDogru(q, girdi) { var g = norm(girdi).join(' '); return !!g && q.c.some(function (c) { return norm(c).join(' ') === g; }); }
  /* tarama: dokunulan kelime cevabın bir parçası mı */
  function taraDogru(t, kelime) { var k = norm(kelime)[0]; return !!k && t.c.some(function (c) { return norm(c).indexOf(k) >= 0; }); }
  function wpmHesap(kelime, ms) { return ms > 0 ? Math.round(kelime / (ms / 60000)) : 0; }
  /* RSVP: göz odak harfi (kelime uzunluğunun ~%35'i) */
  function odak(w) { var t = w.replace(/[^A-Za-z0-9]/g, ''); return Math.max(0, Math.min(t.length - 1, Math.floor(t.length * .35))); }
  function obekle(ws, n) { var o = []; for (var i = 0; i < ws.length; i += n) o.push(ws.slice(i, i + n).join(' ')); return o; }
  function yakin(sev, varolan) { var i = SEV.indexOf(sev); if (i < 0) i = 2; var en = null, f = 99; varolan.forEach(function (s) { var d = Math.abs(SEV.indexOf(s) - i) + (SEV.indexOf(s) > i ? .1 : 0); if (d < f) { f = d; en = s; } }); return en; }
  function tohum(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function gunSec(gun, sev, liste, gor) {
    var hedef = yakin(sev, liste.map(function (b) { return b.sev; }).filter(function (s, i, a) { return a.indexOf(s) === i; }));
    var aday = liste.filter(function (b) { return b.sev === hedef; }), yeni = aday.filter(function (b) { return !(gor || {})[b.id]; }); if (yeni.length) aday = yeni;
    return aday[tohum('oku:' + gun + ':' + sev) % aday.length];
  }
  function seri(g, bugun) {
    var n = 0, c = new Date(bugun); c.setHours(12, 0, 0, 0);
    var k = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
    if (!(g[k(c)] && g[k(c)].ok)) c.setDate(c.getDate() - 1);
    while (g[k(c)] && g[k(c)].ok) { n++; c.setDate(c.getDate() - 1); }
    return n;
  }
  /* fosfor aralıkları: aynı paragrafta çakışanlar birleşir */
  function fosEkle(liste, yeni) {
    var a = Math.min(yeni.a, yeni.b), b = Math.max(yeni.a, yeni.b), not = yeni.not || '', out = [];
    (liste || []).forEach(function (f) { if (f.p === yeni.p && f.a <= b + 1 && f.b >= a - 1) { a = Math.min(a, f.a); b = Math.max(b, f.b); if (f.not && !not) not = f.not; } else out.push(f); });
    out.push({ p: yeni.p, a: a, b: b, not: not });
    return out.sort(function (x, y) { return x.p - y.p || x.a - y.a; });
  }
  var ROLLER = ['giris', 'arka', 'iddia', 'ornek', 'veri', 'karsi', 'sonuc'];
  /* havuzdan gelen makale doğrulaması (sunucudaki DOGRULA.oku ile aynı kurallar) */
  function dogrula(m) {
    var metin = function (x, n) { return typeof x === 'string' && x.trim().length > 0 && x.length <= n; };
    if (!m || !metin(m.b, 100) || !Array.isArray(m.p) || m.p.length < 3 || m.p.length > 6 || !m.p.every(function (p) { return metin(p, 900); })) return false;
    if (!Array.isArray(m.g) || m.g.length !== m.p.length || !m.g.every(function (r) { return ROLLER.indexOf(r) >= 0; })) return false;
    var tum = ' ' + norm(m.p.join(' ')).join(' ') + ' ', gecer = function (c) { return tum.indexOf(' ' + norm(c).join(' ') + ' ') >= 0; };
    if (!m.ana || !Array.isArray(m.ana.sec) || m.ana.sec.length < 3 || !Number.isInteger(m.ana.d) || m.ana.d >= m.ana.sec.length) return false;
    if (!Array.isArray(m.tara) || m.tara.length < 1 || !m.tara.every(function (t) { return metin(t.soru, 200) && Array.isArray(t.c) && t.c.length && t.c.every(function (c) { return metin(c, 40); }) && t.c.some(gecer); })) return false;
    return Array.isArray(m.q) && m.q.length >= 3 && m.q.length <= 7 && m.q.every(function (q) {
      if (q.t === 'tfng') return metin(q.m, 240) && (q.d === 'T' || q.d === 'F' || q.d === 'NG') && (q.d === 'NG' ? q.p == null : Number.isInteger(q.p) && q.p < m.p.length);
      if (q.t === 'baslik') return Array.isArray(q.basliklar) && q.basliklar.length > m.p.length && q.basliklar.every(function (b) { return metin(b, 120); }) && Array.isArray(q.d) && q.d.length === m.p.length && q.d.every(function (x) { return Number.isInteger(x) && x < q.basliklar.length; }) && new Set(q.d).size === q.d.length;
      if (q.t === 'paragraf') return metin(q.m, 200) && Number.isInteger(q.d) && q.d < m.p.length;
      if (q.t === 'tamam') return metin(q.on, 200) && typeof (q.son || '') === 'string' && Array.isArray(q.c) && q.c.length && q.c.every(function (c) { return metin(c, 30) && norm(c).length <= 2; }) && q.c.some(gecer);   /* en az bir kabul metinde aynen geçer (60 = sixty gibi varyant serbest) */
      if (q.t === 'sec') return metin(q.soru, 240) && Array.isArray(q.sec) && q.sec.length >= 3 && q.sec.length <= 5 && Number.isInteger(q.d) && q.d < q.sec.length;
      return false;
    });
  }

  /* günün küpürleri: seviyeye en yakın makalelerden, her biri ayrı kategoriden; görülmemişler önce.
     tur (Başka küpürler sayacı) değişince aynı gün başka konular gelir; aynı gün + aynı tur hep aynı set. */
  function kupurSec(gun, sev, liste, gor, tur, n) {
    n = n || 4; gor = gor || {};
    var kats = liste.map(function (m) { return m.kat; }).filter(function (k, i, a) { return a.indexOf(k) === i; });
    var t = tohum('kupur:' + gun + ':' + sev), sira = kats.slice().sort(function (a, b) { return tohum(a + t) - tohum(b + t); });
    var bas = ((tur || 0) * n) % Math.max(1, sira.length), secilen = [];
    for (var i = 0; i < sira.length && secilen.length < n; i++) {
      var kat = sira[(bas + i) % sira.length], ad = liste.filter(function (m) { return m.kat === kat; });
      var hedef = yakin(sev, ad.map(function (m) { return m.sev; })), uy = ad.filter(function (m) { return m.sev === hedef; });
      var yeni = uy.filter(function (m) { return !gor[m.id]; }); if (yeni.length) uy = yeni;
      if (uy.length) secilen.push(uy[tohum(gun + kat + (tur || 0)) % uy.length]);
    }
    return secilen;
  }
  var OKU = { kupurSec: kupurSec, norm: norm, sayKelime: sayKelime, sure: sure, tamamDogru: tamamDogru, taraDogru: taraDogru, wpmHesap: wpmHesap, odak: odak, obekle: obekle, yakin: yakin, gunSec: gunSec, seri: seri, fosEkle: fosEkle, dogrula: dogrula };
  W.OKU = OKU;

  /* ====================================================================== ekran */
  OKU.kur = function (kok) {
    var A = W.ACX, esc = A.esc, BK = W.OKU_BANKA, KB = W.KELIME_BANKA;
    var st = A.ls.al('oku', null);
    if (!st || st.v !== 1) { var kel0 = A.ls.al('kelime', null); st = { v: 1, sev: kel0 && kel0.sev || 'B1', kat: 'kampus', gor: {}, gazete: {}, fos: {}, hiz: [], wpm: 0 }; }
    var ekler = (A.ls.al('okuEk', []) || []).filter(dogrula);
    var kaydet = function () { A.ls.yaz('oku', st); };
    var bugun = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
    var tum = function () { return BK.MAKALE.concat(ekler); };
    var katAd = function (id) { var k = BK.KAT.filter(function (x) { return x.id === id; })[0]; return k ? k.ad : id; };

    /* öğrendiğin ve seviyenin üstündeki kelimeler */
    var kelSt = A.ls.al('kelime', null), ogren = {}, zor = {};
    if (kelSt && kelSt.kart) Object.keys(kelSt.kart).forEach(function (w) { ogren[w] = 1; });
    if (KB && KB.sev) {
      var si = SEV.indexOf(st.sev), sozluk = [];
      SEV.forEach(function (s, i) { (KB.sev[s] || []).forEach(function (sat) { var x = sat.split('|'); if (i > si) zor[x[0]] = s; sozluk.push({ kelime: x[0], tur: x[1], anlam_tr: x[2], ornek: x[3] }); }); });
      if (A.sozlukEkle) A.sozlukEkle(sozluk);
    }

    var o = { m: null, sekme: 'soru', fosfor: false, iskelet: false, isaret: true, fosBas: null, gazete: false };

    kok.innerHTML =
      '<div class="ok-ust"><div class="ok-gazete" id="ok-gazete"></div>' +
        '<div class="kagit ok-kitaplik"><div class="dn-sev" role="group" aria-label="Seviye">' + SEV.map(function (s) { return '<button type="button" data-sev="' + s + '">' + s + '</button>'; }).join('') + '</div>' +
        '<div class="dn-raf" role="group" aria-label="Kategori">' + BK.KAT.map(function (k) { return '<button type="button" data-kat="' + k.id + '"><span aria-hidden="true">' + k.ik + '</span>' + k.ad + '</button>'; }).join('') + '</div>' +
        '<div class="dn-liste" id="ok-liste"></div></div></div>' +
      '<div class="kagit ok-masa" id="ok-masa">' +
        '<header class="ok-bas"></header>' +
        '<div class="ok-arac">' +
          '<button type="button" class="btn sm" data-a="fosfor" aria-pressed="false">🖍 Fosfor</button>' +
          '<button type="button" class="btn sm" data-a="iskelet" aria-pressed="false">▦ İskelet</button>' +
          '<button type="button" class="btn sm" data-a="isaret" aria-pressed="true">● Kelime işaretleri</button>' +
          '<span class="ok-lejant"><i class="l-ogren"></i>destende <i class="l-zor"></i>seviyenin üstü</span>' +
        '</div>' +
        '<p class="ok-fos-ipucu say" hidden>Fosfor açık: ilk kelimeye, sonra son kelimeye dokun. İşaretli yere dokununca not ekleyebilirsin.</p>' +
        '<div class="ok-govde"><aside class="ok-ray" aria-label="Okuma ilerlemesi"><div class="ok-ray-ic"><div class="ok-cizgi"><i></i></div><ol class="ok-harita"></ol><span class="mono ok-kalan"></span></div></aside>' +
          '<article class="ok-sayfa" lang="en"></article><aside class="ok-kenar" aria-label="Kenar notları"></aside></div>' +
        '<nav class="dn-sekme" role="tablist">' + [['soru', 'Sorular'], ['tara', 'Göz gezdir + tara'], ['hiz', 'Hız antrenmanı']].map(function (s) { return '<button type="button" role="tab" data-sekme="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</nav>' +
        '<div class="dn-panel ok-panel" role="tabpanel"></div>' +
      '</div>' +
      '<div class="dn-gorev">' + [['makale', 'Bir makalenin sorularında %60'], ['tara', 'İki süreli tarama'], ['hiz', 'Hız antrenmanında %50 anlama'], ['gazete', 'Günün makalesi']].map(function (g, i) {
        return '<article class="kagit alis dn-g" data-id="' + g[0] + '"><span class="etiket">görev ' + (i + 1) + '</span><b>' + g[1] + '</b><span class="tik" aria-label="tamamlandı">✓</span></article>';
      }).join('') + '</div>' +
      '<div class="ok-tarabar" hidden><span class="mono" data-tb-n></span><b data-tb-s></b><span class="ok-tb-sure"><i></i></span><button type="button" class="btn sm" data-tb-x>Bırak</button></div>';

    var $ = function (s) { return kok.querySelector(s); };
    var masa = $('#ok-masa'), sayfa = $('.ok-sayfa'), panel = $('.ok-panel'), kenar = $('.ok-kenar');

    /* ---------- makale yükle ---------- */
    function yukle(m, gazete) {
      hizDur(); taraBitir(); o.m = m; o.gazete = !!gazete; masaC.fosBas = null; st.gor[m.id] = 1; kaydet();
      var dk = sure(m, st.wpm);
      $('.ok-bas').innerHTML = (gazete ? '<div class="ok-bas-gz"><span>Vol. 1</span><b>The Campus Gazette</b><span>' + esc(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })) + '</span></div>' : '') + '<div><span class="etiket">' + (gazete ? 'kampüs gazetesi · ' : '') + esc(katAd(m.kat)) + ' · ' + m.sev + ' · ' + sayKelime(m) + ' kelime · ~' + dk + ' dk</span><h3 lang="en">' + esc(m.b) + '</h3><span class="el">' + esc(m.tr || '') + '</span></div>';
      sayfa.innerHTML = paragrafHtml(m);
      $('.ok-harita').innerHTML = m.p.map(function (_, i) { return '<li data-rol="' + (m.g[i] || '') + '"><button type="button" data-git="' + i + '"><b>' + HARF[i] + '</b><span>' + esc(BK.ROL[m.g[i]] || '') + '</span></button></li>'; }).join('');
      sayfa.classList.toggle('gazete-mod', o.gazete); masa.classList.toggle('gazete-mod', o.gazete);
      fosCiz(); aracCiz(); sekmeCiz(); listeCiz(); ilerle();
      masa.classList.remove('gir'); void masa.offsetWidth; masa.classList.add('gir');
    }
    function paragrafHtml(m) {
      return m.p.map(function (p, i) {
        return '<section class="ok-p" data-p="' + i + '" data-rol="' + (m.g[i] || '') + '"><span class="ok-harf">' + HARF[i] + '</span><span class="ok-rol">' + esc(BK.ROL[m.g[i]] || '') + '</span><p>' +
          kelimeler(p).map(function (w, j) { var k = norm(w)[0] || '', c = ogren[k] ? ' ogren' : zor[k] ? ' zor' : ''; return '<span class="k' + c + '" data-j="' + j + '"' + (zor[k] ? ' title="' + zor[k] + '"' : '') + '>' + esc(w) + '</span>'; }).join(' ') + '</p></section>';
      }).join('');
    }
    function aracCiz() {
      $('[data-a=fosfor]').setAttribute('aria-pressed', o.fosfor); $('[data-a=iskelet]').setAttribute('aria-pressed', o.iskelet); $('[data-a=isaret]').setAttribute('aria-pressed', o.isaret);
      sayfa.classList.toggle('fos-mod', o.fosfor); sayfa.classList.toggle('iskelet', o.iskelet); sayfa.classList.toggle('isaretli', o.isaret); masa.classList.toggle('iskelet', o.iskelet);
      $('.ok-fos-ipucu').hidden = !o.fosfor;
    }

    /* ---------- fosfor + kenar notu ---------- */
    /* masa ve gazete okuyucusu aynı fosfor kaydını paylaşır (st.fos[makale]) */
    var masaC = { kok: kok, get sayfa() { return sayfa; }, get kenar() { return kenar; }, get m() { return o.m; }, get fosfor() { return o.fosfor; }, fosBas: null };
    function fosCiz(c) {
      c = c || masaC; var sayfa = c.sayfa, kenar = c.kenar;
      var liste = st.fos[c.m.id] || [];
      sayfa.querySelectorAll('.k.fos').forEach(function (k) { k.classList.remove('fos', 'fos-bas', 'fos-son', 'notlu'); delete k.dataset.f; });
      liste.forEach(function (f, i) {
        for (var j = f.a; j <= f.b; j++) { var k = c.sayfa.querySelector('.ok-p[data-p="' + f.p + '"] .k[data-j="' + j + '"]'); if (k) { k.classList.add('fos'); k.dataset.f = i; if (j === f.a) k.classList.add('fos-bas'); if (j === f.b) k.classList.add('fos-son'); if (f.not) k.classList.add('notlu'); } }
      });
      var notlar = liste.map(function (f, i) { return { f: f, i: i }; }).filter(function (x) { return x.f.not; });
      kenar.innerHTML = notlar.length ? notlar.map(function (x) { return '<div class="postit ok-not" data-f="' + x.i + '" style="--r:' + ((x.i % 2 ? 1 : -1) * 1.5) + 'deg"><b>¶' + HARF[x.f.p] + '</b> ' + esc(x.f.not) + '</div>'; }).join('') : '<p class="say ok-bos">Fosforla işaretlediğin yere not eklersen burada post-it olur.</p>';
    }
    function fosPop(i, el, c) {
      c = c || masaC; var eski = c.kok.querySelector('.ok-pop'); if (eski) eski.remove();
      var f = (st.fos[c.m.id] || [])[i]; if (!f) return;
      var pop = D.createElement('div'); pop.className = 'kagit ok-pop';
      pop.innerHTML = '<label class="gizli" for="ok-not">Kenar notu</label><input id="ok-not" type="text" maxlength="120" placeholder="kenar notu (Türkçe olabilir)" value="' + esc(f.not || '') + '"><div class="dugmeler"><button type="button" class="btn sm ana" data-pop="kaydet">Not kaydet</button><button type="button" class="btn sm" data-pop="sil">Fosforu sil</button></div>';
      var p = el.closest('.ok-p'); p.appendChild(pop); pop.dataset.f = i; pop.querySelector('input').focus({ preventScroll: true });
    }

    /* ---------- ilerleme çizgisi + paragraf haritası ---------- */
    function ilerle() {
      if (!o.m) return; var r = sayfa.getBoundingClientRect(), vh = W.innerHeight;
      var v = Math.max(0, Math.min(1, (vh * .6 - r.top) / Math.max(1, r.height)));
      masa.style.setProperty('--okp', v.toFixed(3));
      var kalan = Math.max(0, Math.round(sayKelime(o.m) * (1 - v) / (st.wpm || 180) * 10) / 10);
      $('.ok-kalan').textContent = v >= .99 ? 'okundu ✓' : '~' + (kalan < 1 ? '<1' : Math.round(kalan)) + ' dk kaldı';
      var ps = sayfa.querySelectorAll('.ok-p'), aktif = 0;
      ps.forEach(function (p, i) { if (p.getBoundingClientRect().top < vh * .55) aktif = i; });
      $('.ok-harita').querySelectorAll('li').forEach(function (li, i) { li.classList.toggle('aktif', i === aktif); li.classList.toggle('gecti', i < aktif || v >= .99); });
    }
    var bekle = false; W.addEventListener('scroll', function () { if (!bekle) { bekle = true; W.requestAnimationFrame(function () { bekle = false; ilerle(); }); } }, { passive: true });

    /* ---------- kütüphane, gazete ---------- */
    function gazeteCiz(karistir) {
      var g = st.gazete[bugun()], n = seri(st.gazete, Date.now());
      var m = g && tum().filter(function (x) { return x.id === g.id; })[0];
      var kup = kupurSec(bugun(), st.sev, tum(), st.gor, st.kupur && st.kupur.gun === bugun() ? st.kupur.tur : 0);
      if (m && !kup.some(function (x) { return x.id === m.id; })) kup = [m].concat(kup.slice(0, 3));   /* seçtiğin küpür panoda kalır */
      var acik = $('#ok-gazete').classList.contains('acik');
      var tarih = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      /* katlı gazete: üst yarıda manşet (seçilen küpür) ya da "küpürünü seç"; açınca alt yarıda küpür panosu */
      $('#ok-gazete').innerHTML = '<div class="ok-gz-kagit">' +
        '<div class="ok-gz-yari gy-ust"><div class="ok-gz-ust"><span>No. ' + Math.max(1, Object.keys(st.gazete).length) + '</span><b>The Campus Gazette</b><span>' + (m ? esc(katAd(m.kat)) + ' · ' + m.sev : 'seviye ' + st.sev) + '</span></div>' +
          '<div class="ok-gz-tarih"><span>' + tarih + '</span><span>günün makalesi</span><span>' + (n ? n + ' günlük seri' : 'seri bugün başlar') + '</span></div>' +
          (m ? '<h4 lang="en">' + esc(m.b) + '</h4><p class="ok-gz-alt-b" lang="en">' + esc(m.tr || '') + '</p>' : '<h4>Bugünün haberini sen seç ✂</h4><p class="ok-gz-alt-b">Gazeteyi aç, bir küpür kes; o konu bugünün sayısı olur.</p>') + '</div>' +
        '<div class="ok-gz-sar"><div class="ok-gz-yari gy-alt"><div class="ok-pano-bas"><b>Today’s clippings</b><span>' + kup.length + ' konu · ' + esc(st.sev) + '</span></div>' +
          '<div class="ok-pano' + (karistir ? ' karis' : '') + '">' + kup.map(function (x, i) {
            var sec = m && m.id === x.id;
            return '<button type="button" class="ok-kupur' + (sec ? ' secili' : '') + (st.gor[x.id] && !sec ? ' gordu' : '') + '" data-kupur="' + esc(x.id) + '" style="--r:' + [-2.5, 1.8, 2.2, -1.6][i % 4] + 'deg;--kd:' + (i * 70) + 'ms">' +
              '<span class="bant" aria-hidden="true"></span><small>' + (BK.KAT.filter(function (k) { return k.id === x.kat; })[0] || {}).ik + ' ' + esc(katAd(x.kat)) + ' · ' + x.sev + '</small><b lang="en">' + esc(x.b) + '</b><span lang="en">' + esc(x.p[0].split(' ').slice(0, 14).join(' ')) + '…</span>' +
              (sec ? '<i class="damga">' + (g.ok ? 'OKUNDU' : 'SEÇİLDİ') + '</i>' : '') + '<span class="makas" aria-hidden="true">✂</span></button>';
          }).join('') + '</div>' +
          '<div class="alt-satir"><button type="button" class="btn sm" data-kupur-yeni>✂ Başka küpürler</button>' + (m ? '<button type="button" class="btn ana sm" data-gazete="' + esc(m.id) + '" data-gun="' + bugun() + '">' + (g.ok ? '✓ okundu · gazeteyi aç' : '📰 Gazeteyi oku') + '</button><button type="button" class="btn sm" data-masa="' + esc(m.id) + '">masada aç</button>' : '') + '</div></div></div>' +
        '</div><button type="button" class="ok-gz-ac" data-gz-ac aria-expanded="' + acik + '">' + (acik ? 'Gazeteyi katla ⤴' : m ? 'Gazeteyi aç ⤵' : 'Küpürleri gör ⤵') + '</button>' + arsivHtml();
    }
    /* küpür kes: makas kenarda gezer, küpür kalkar, manşet döner, gazete açılır */
    function kupurKes(b) {
      var m = tum().filter(function (x) { return x.id === b.dataset.kupur; })[0]; if (!m) return;
      var g = st.gazete[bugun()];
      if (!g || g.id !== m.id) { st.gazete[bugun()] = { id: m.id, ok: g && g.ok ? 1 : 0 };   /* bugün bir sayıyı bitirdiysen seri ve görev korunur */ kaydet(); }
      var ac = function () { gazeteCiz(); manset(m, function () { gazeteAc(m, bugun()); }); };
      if (A.sakin) { ac(); return; }
      b.classList.add('kesiliyor'); A.sesCal('tebesir'); setTimeout(ac, 750);
    }
    /* arşiv: önceki günlerin sayıları yığın halinde; okunanlar damgalı */
    function arsivHtml() {
      var gunler = Object.keys(st.gazete).filter(function (k) { return k !== bugun() && tum().some(function (x) { return x.id === st.gazete[k].id; }); }).sort().reverse().slice(0, 6);
      if (!gunler.length) return '';
      return '<div class="ok-gz-arsiv"><span class="etiket">arşiv · önceki sayılar</span><div class="ok-yigin">' + gunler.map(function (k, i) {
        var m = tum().filter(function (x) { return x.id === st.gazete[k].id; })[0], d = new Date(k + 'T12:00:00');
        return '<button type="button" class="ok-arsiv-g" data-gazete="' + esc(m.id) + '" data-gun="' + k + '" style="--r:' + ((i % 2 ? 1 : -1) * (1 + i % 3)) + 'deg"><small>' + d.toLocaleDateString('tr', { day: 'numeric', month: 'short' }) + '</small><b lang="en">' + esc(m.b) + '</b>' + (st.gazete[k].ok ? '<i class="damga">OKUNDU</i>' : '') + '</button>';
      }).join('') + '</div></div>';
    }
    /* dönen manşet: eski filmlerdeki gibi gazete dönerek gelir, durur, masaya iner */
    function manset(m, bitti) {
      if (A.sakin) { bitti(); return; }
      var o2 = D.createElement('div'); o2.className = 'gz-spin'; o2.setAttribute('aria-hidden', 'true');
      o2.innerHTML = '<div class="gz-sayfa"><div class="gz-ust"><span>EXTRA · EXTRA</span><b>The Campus Gazette</b><span>' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + '</span></div>' +
        '<h2>' + esc(m.b) + '</h2><p class="gz-alt">' + esc(katAd(m.kat)) + ' · ' + m.sev + ' · ' + sayKelime(m) + ' words</p>' +
        '<div class="gz-sutunlar">' + [0, 1, 2].map(function (k) { return '<div>' + Array.from({ length: 9 }, function (_, r) { return '<i style="width:' + (62 + (k * 7 + r * 13) % 38) + '%"></i>'; }).join('') + '</div>'; }).join('') + '</div></div>';
      D.body.appendChild(o2); A.sesCal('sayfa');
      var bitir = function () { if (o2._b) return; o2._b = 1; o2.classList.add('in'); setTimeout(function () { o2.remove(); }, 520); bitti(); };
      o2.addEventListener('click', bitir); setTimeout(function () { A.sesCal('tebesir'); }, 1250); setTimeout(bitir, 2700);
    }
    function listeCiz() {
      kok.querySelectorAll('[data-sev]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.sev === st.sev); });
      kok.querySelectorAll('[data-kat]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.kat === st.kat); });
      var liste = tum().filter(function (b) { return b.kat === st.kat; }).sort(function (a, b) { return SEV.indexOf(a.sev) - SEV.indexOf(b.sev); });
      var hedef = yakin(st.sev, liste.map(function (b) { return b.sev; }));
      $('#ok-liste').innerHTML = liste.map(function (b) {
        return '<button type="button" class="dn-ep' + (b.sev === hedef ? ' uygun' : '') + (o.m && o.m.id === b.id ? ' acik' : '') + (st.gor[b.id] ? ' gordu' : '') + '" data-mk="' + esc(b.id) + '"><span class="mono">' + b.sev + '</span><b lang="en">' + esc(b.b) + '</b><small>' + sayKelime(b) + ' kelime · ' + b.q.length + ' soru</small></button>';
      }).join('') + '<button type="button" class="dn-ep yeni" data-yeni><span class="mono">+</span><b>Yeni makale getir</b><small>' + esc(katAd(st.kat)) + ' · ' + st.sev + ' · havuzdan</small></button>';
    }
    async function yeniGetir(b) {
      b.disabled = true; b.querySelector('small').textContent = 'getiriliyor…';
      var v = await A.icerik('oku', st.kat + ':' + st.sev);
      if (v && dogrula(v)) {
        var m = Object.assign({}, v, { id: 'ek-' + st.kat + '-' + st.sev + '-' + tohum(v.p.join('')), kat: st.kat, sev: st.sev });
        if (!ekler.some(function (e) { return e.id === m.id; })) { ekler.push(m); ekler = ekler.slice(-30); A.ls.yaz('okuEk', ekler); }
        yukle(m); A.sevin();
      } else { A.soyle('Şu an yeni makale getiremedim; bankadaki makaleler duruyor.', 4000); listeCiz(); }
    }

    /* ---------- sekmeler ---------- */
    function sekmeCiz() { hizDur(); taraBitir(); kok.querySelectorAll('[data-sekme]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.sekme === o.sekme); }); ({ soru: soruCiz, tara: taraCiz, hiz: hizCiz })[o.sekme](); }

    /* sorular */
    function soruCiz() { panel.innerHTML = soruHtml(o.m); }
    function soruHtml(m) {
      return '<div class="dn-soru-ust"><span class="mono">IELTS Academic soru tipleri · cevabı metinde bul</span></div><ol class="dn-sorular ok-sorular">' + m.q.map(function (q, i) {
        if (q.t === 'tfng') return '<li data-q="' + i + '"><span class="tip">true / false / not given</span><p lang="en">' + esc(q.m) + '</p><div class="sec yan">' + ['T', 'F', 'NG'].map(function (k) { return '<button type="button" data-s="' + k + '">' + TFNG[k] + '</button>'; }).join('') + '</div></li>';
        if (q.t === 'baslik') return '<li data-q="' + i + '"><span class="tip">başlık eşleştirme</span><p>Her paragrafa bir başlık seç; fazladan başlıklar var.</p><ul class="sag" lang="en">' + q.basliklar.map(function (b, k) { return '<li><b>' + ROMA[k] + '</b> ' + esc(b) + '</li>'; }).join('') + '</ul>' +
          m.p.map(function (_, k) { return '<label class="sol"><span>Paragraf ' + HARF[k] + '</span><select data-b="' + k + '"><option value="">—</option>' + q.basliklar.map(function (_, r) { return '<option value="' + r + '">' + ROMA[r] + '</option>'; }).join('') + '</select></label>'; }).join('') + '</li>';
        if (q.t === 'paragraf') return '<li data-q="' + i + '"><span class="tip">bilgiyi eşleştirme</span><p lang="en">' + esc(q.m) + '</p><div class="sec yan">' + m.p.map(function (_, k) { return '<button type="button" data-s="' + k + '">' + HARF[k] + '</button>'; }).join('') + '</div></li>';
        if (q.t === 'tamam') return '<li class="q-not" data-q="' + i + '"><span class="tip">cümle tamamlama</span><label lang="en">' + esc(q.on) + ' <input type="text" autocomplete="off" spellcheck="false" autocapitalize="off" aria-label="Boşluk ' + (i + 1) + '"> ' + esc(q.son || '') + '</label><small>metinden en çok iki kelime</small></li>';
        if (q.t === 'sec') return '<li data-q="' + i + '"><span class="tip">çoktan seçmeli</span><p lang="en">' + esc(q.soru) + '</p><div class="sec">' + q.sec.map(function (s, k) { return '<button type="button" data-s="' + k + '" lang="en">' + HARF[k] + ' · ' + esc(s) + '</button>'; }).join('') + '</div></li>';
        return '';
      }).join('') + '</ol><div class="alt-satir"><span class="mono" data-skor></span><button type="button" class="btn ana" data-kontrol>Kontrol et</button></div>';
    }
    function soruKontrol(kap, sayfaEl, gun) {
      kap = kap || panel; sayfaEl = sayfaEl || sayfa; if (gun === undefined) gun = o.gazete ? (st.gazete[bugun()] && st.gazete[bugun()].id === o.m.id ? bugun() : null) : null;
      var m = kap === panel ? o.m : gz.m, dogru = 0, toplam = 0, panel_ = kap;
      sayfaEl.querySelectorAll('.ok-p.kanit').forEach(function (p) { p.classList.remove('kanit'); });
      m.q.forEach(function (q, i) {
        var li = panel_.querySelector('[data-q="' + i + '"]'); if (!li) return;
        var isle = function (ok) { toplam++; if (ok) dogru++; li.classList.toggle('dogru', ok); li.classList.toggle('yanlis', !ok); };
        if (q.t === 'tfng' || q.t === 'paragraf' || q.t === 'sec') {
          var s = li.querySelector('.sec .on'), cev = q.t === 'tfng' ? q.d : q.d, ok = !!s && String(s.dataset.s) === String(cev); isle(ok);
          li.querySelectorAll('.sec button').forEach(function (b) { b.classList.toggle('dogru', String(b.dataset.s) === String(cev)); b.classList.toggle('yanlis', b.classList.contains('on') && !ok); });
          var kp = q.t === 'tfng' ? q.p : q.t === 'paragraf' ? q.d : null;
          var ac = li.querySelector('.ok-kanit'); if (ac) ac.remove();
          if (!ok && kp != null) { var bt = D.createElement('button'); bt.type = 'button'; bt.className = 'btn sm ok-kanit'; bt.dataset.kanit = kp; bt.textContent = 'Kanıtı göster: ¶' + HARF[kp]; li.appendChild(bt); }
          if (!ok && q.t === 'tfng' && q.d === 'NG') { var nn = D.createElement('small'); nn.className = 'ok-kanit say'; nn.textContent = 'Metinde ne doğrulayan ne yalanlayan bilgi var: NOT GIVEN.'; li.appendChild(nn); }
        }
        if (q.t === 'tamam') { var inp = li.querySelector('input'), ok2 = tamamDogru(q, inp.value); isle(ok2); var c = li.querySelector('.cevap'); if (!c) { c = D.createElement('span'); c.className = 'cevap mono'; li.appendChild(c); } c.textContent = ok2 ? '' : 'doğrusu: ' + q.c[0]; }
        if (q.t === 'baslik') li.querySelectorAll('select').forEach(function (s) { var ok3 = s.value !== '' && +s.value === q.d[+s.dataset.b]; toplam++; if (ok3) dogru++; s.parentNode.classList.toggle('dogru', ok3); s.parentNode.classList.toggle('yanlis', !ok3); s.parentNode.dataset.cevap = ROMA[q.d[+s.dataset.b]]; });
      });
      var oran = toplam ? dogru / toplam : 0;
      panel_.querySelector('[data-skor]').textContent = dogru + ' / ' + toplam + ' doğru · %' + Math.round(oran * 100);
      if (oran >= .6) { if (A.bitir(P, 'makale')) A.soyle('Makale tamam. Kanıtı bulmak, cevabı bilmekten önemli.', 3500); if (gun) { st.gazete[gun] = { id: m.id, ok: 1 }; kaydet(); gazeteCiz(); if (gun === bugun()) A.bitir(P, 'gazete'); } A.sevin(); A.sesCal(oran === 1 ? 'bitti' : 'dogru'); }
      else A.uz();
    }
    function kanitGoster(p) {
      var el = sayfa.querySelector('.ok-p[data-p="' + p + '"]'); if (!el) return;
      el.classList.remove('kanit'); void el.offsetWidth; el.classList.add('kanit');
      el.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'center' });
    }

    /* göz gezdirme + tarama */
    var tr = { aktif: null, zaman: null, bas: 0, ok: {} };
    function taraCiz() {
      var m = o.m, sn = m.sev[0] === 'A' ? 30 : m.sev[0] === 'B' ? 45 : 60;
      panel.innerHTML = '<div class="ok-tara"><div class="ok-tara-k"><h4>Göz gezdir · ' + sn + ' sn</h4><p class="say">Yalnız başlığa, paragrafların ilk cümlelerine ve sayılara bak. Süre bitince metin bulanıklaşır; ana fikri seç.</p>' +
        '<div class="dugmeler"><button type="button" class="btn ana sm" data-skim="' + sn + '">▶ Başlat</button></div><div class="ok-skim"></div></div>' +
        '<div class="ok-tara-k"><h4>Tara · 20 sn</h4><p class="say">Soru alt şeritte çıkar; cevabı metinde bul ve kelimeye dokun. Okuma, ara.</p><ol class="ok-tara-l">' +
        m.tara.map(function (t, i) { return '<li data-t="' + i + '"><span lang="en">' + esc(t.soru) + '</span><button type="button" class="btn sm" data-scan="' + i + '">' + (tr.ok[m.id + i] ? '✓ bulundu' : 'Başla') + '</button><span class="mono" data-ts="' + i + '"></span></li>'; }).join('') + '</ol></div></div>';
    }
    function skimBasla(sn) {
      var m = o.m, kutu = panel.querySelector('.ok-skim'), bitis = Date.now() + sn * 1000;
      masa.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' }); sayfa.classList.add('skim');
      var t = W.setInterval(function () {
        var k = Math.max(0, bitis - Date.now()); masa.style.setProperty('--skim', (k / (sn * 1000)).toFixed(3));
        kutu.innerHTML = '<span class="ok-sayac mono">' + Math.ceil(k / 1000) + ' sn</span>';
        if (k <= 0) {
          W.clearInterval(t); sayfa.classList.remove('skim'); sayfa.classList.add('bulanik');
          kutu.innerHTML = '<p lang="en"><b>What is the main idea?</b></p><div class="sec">' + m.ana.sec.map(function (s, i) { return '<button type="button" data-ana="' + i + '" lang="en">' + esc(s) + '</button>'; }).join('') + '</div>';
          panel.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' });
        }
      }, 200);
      tr.skim = t;
    }
    function taraBasla(i) {
      taraBitir(); var t = o.m.tara[i], bar = $('.ok-tarabar');
      tr.aktif = i; tr.bas = Date.now(); bar.hidden = false; sayfa.classList.add('tarama');
      bar.querySelector('[data-tb-n]').textContent = 'TARA ' + (i + 1) + '/' + o.m.tara.length; bar.querySelector('[data-tb-s]').textContent = t.soru;
      masa.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' });
      tr.zaman = W.setInterval(function () {
        var k = Math.max(0, 20000 - (Date.now() - tr.bas)); bar.style.setProperty('--tb', (k / 20000).toFixed(3));
        if (k <= 0) { var x = tr.aktif; taraBitir(); var s = panel.querySelector('[data-ts="' + x + '"]'); if (s) s.textContent = 'süre bitti · cevap: ' + o.m.tara[x].c[0]; A.uz(); }
      }, 100);
    }
    function taraBitir() { if (tr.skim) { W.clearInterval(tr.skim); tr.skim = null; } W.clearInterval(tr.zaman); tr.aktif = null; var bar = $('.ok-tarabar'); if (bar) bar.hidden = true; sayfa.classList.remove('tarama', 'skim', 'bulanik'); }
    function taraDokun(k) {
      var i = tr.aktif, t = o.m.tara[i], ok = taraDogru(t, k.textContent), sn = ((Date.now() - tr.bas) / 1000).toFixed(1);
      k.classList.remove('bulundu', 'iska'); void k.offsetWidth; k.classList.add(ok ? 'bulundu' : 'iska');
      if (!ok) { A.uz(); return; }
      taraBitir(); tr.ok[o.m.id + i] = 1; A.sevin(); A.sesCal('dogru');
      var s = panel.querySelector('[data-ts="' + i + '"]'); if (s) s.textContent = sn + ' sn'; var b = panel.querySelector('[data-scan="' + i + '"]'); if (b) b.textContent = '✓ bulundu';
      var n = Object.keys(tr.ok).length; if (n >= 2 && A.bitir(P, 'tara')) A.soyle('Tarama görevi tamam: okumadan aramak bir beceri.', 3500);
    }

    /* hız antrenmanı */
    var hz = { mod: 'rsvp', wpm: 250, zaman: null };
    function hizCiz() {
      var son = (st.hiz || []).slice(-8);
      panel.innerHTML = '<div class="ok-hiz"><div class="ok-hiz-ust"><span class="dn-mod" role="group" aria-label="Mod">' + [['rsvp', 'tek kelime'], ['obek', 'öbek'], ['kilavuz', 'kılavuz'], ['olc', 'hızını ölç']].map(function (x) { return '<button type="button" data-hm="' + x[0] + '" aria-pressed="' + (hz.mod === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</span>' +
        '<label class="ok-wpm"' + (hz.mod === 'olc' ? ' hidden' : '') + '>hız <input type="range" min="120" max="600" step="10" value="' + hz.wpm + '" data-wpm> <b data-wpm-y>' + hz.wpm + '</b> kelime/dk</label></div>' +
        '<div class="ok-ekran" aria-live="off">' + (hz.mod === 'olc' ? '<p class="say">Başlat\'a bas, yukarıdaki makaleyi normal hızında oku, bitince Bitti\'ye bas. Hızın kalan süre tahminlerinde kullanılır.</p>' : '<p class="say">' + ({ rsvp: 'Kelimeler tek tek, aynı noktada çıkar; göz hareket etmez. Kırmızı harf odak noktası.', obek: 'Kelimeler üçerli öbeklerle gelir; anlamı öbek öbek yakala.', kilavuz: 'Metin durur, vurgu satır boyunca ilerler; geri dönme, vurguyu izle.' })[hz.mod] + '</p>') + '</div>' +
        '<div class="alt-satir"><span class="mono">' + (st.wpm ? 'normal hızın: ' + st.wpm + ' kelime/dk' : 'normal hızını henüz ölçmedin') + '</span><button type="button" class="btn ana" data-hbas>' + (hz.mod === 'olc' ? '▶ Başlat' : '▶ Başlat') + '</button></div>' +
        (son.length ? '<div class="ok-hiz-gecmis"><span class="etiket">son denemeler</span><div class="ok-bar">' + son.map(function (x) { return '<i style="--h:' + Math.min(1, x.wpm / 600) + ';--a:' + (x.anlama == null ? .5 : x.anlama) + '" title="' + x.wpm + ' kelime/dk · anlama ' + (x.anlama == null ? '—' : '%' + Math.round(x.anlama * 100)) + '"><b>' + x.wpm + '</b></i>'; }).join('') + '</div><small class="say">çubuk boyu hız, rengi anlama (yeşil iyi)</small></div>' : '') + '</div>';
    }
    function hizDur() { W.clearInterval(hz.zaman); hz.zaman = null; }
    function hizBasla() {
      var m = o.m, ekran = panel.querySelector('.ok-ekran'), ws = kelimeler(m.p.join(' ')), ms = 60000 / hz.wpm, i = 0, bas = Date.now();
      hizDur(); var bitti = function () { hizDur(); anlamaSor(hz.mod, hz.wpm); };
      if (hz.mod === 'olc') {
        masa.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' });
        ekran.innerHTML = '<p class="ok-sayac mono">okuyorsun…</p>'; var b = panel.querySelector('[data-hbas]'); b.textContent = '■ Bitti'; b.dataset.olc = bas; return;
      }
      if (hz.mod === 'rsvp') {
        ekran.innerHTML = '<div class="ok-rsvp"><span class="ok-rsvp-w"></span></div><span class="ok-hiz-cubuk"><i></i></span>';
        var wEl = ekran.querySelector('.ok-rsvp-w'), cb = ekran.querySelector('.ok-hiz-cubuk i');
        hz.zaman = W.setInterval(function () {
          if (i >= ws.length) return bitti(); var w = ws[i], f = odak(w), t = 0, h = '';
          for (var c = 0; c < w.length; c++) { var harf = esc(w[c]); if (/[A-Za-z0-9]/.test(w[c])) { h += t === f ? '<b>' + harf + '</b>' : harf; t++; } else h += harf; }
          wEl.innerHTML = h; cb.style.width = (i / ws.length * 100) + '%'; i++;
        }, ms * (/[.!?]$/.test(ws[Math.max(0, i - 1)]) ? 1.6 : 1));
        return;
      }
      if (hz.mod === 'obek') {
        var ob = obekle(ws, 3); ekran.innerHTML = '<div class="ok-rsvp obek"><span class="ok-rsvp-w"></span></div><span class="ok-hiz-cubuk"><i></i></span>';
        var oEl = ekran.querySelector('.ok-rsvp-w'), cb2 = ekran.querySelector('.ok-hiz-cubuk i');
        hz.zaman = W.setInterval(function () { if (i >= ob.length) return bitti(); oEl.textContent = ob[i]; cb2.style.width = (i / ob.length * 100) + '%'; i++; }, ms * 3);
        return;
      }
      ekran.innerHTML = '<div class="ok-kilavuz" lang="en">' + ws.map(function (w, j) { return '<span data-w="' + j + '">' + esc(w) + '</span>'; }).join(' ') + '</div>';
      var sp = ekran.querySelectorAll('[data-w]'), kutu = ekran.querySelector('.ok-kilavuz');
      hz.zaman = W.setInterval(function () {
        if (i >= ws.length) return bitti();
        if (sp[i - 1]) sp[i - 1].classList.remove('pace'); sp[i].classList.add('pace', 'gecti');
        if (sp[i].offsetTop - kutu.scrollTop > kutu.clientHeight - 40) kutu.scrollTop = sp[i].offsetTop - 30;
        i++;
      }, ms);
    }
    function olcBitir(b) {
      var ms = Date.now() - +b.dataset.olc, wpm = wpmHesap(sayKelime(o.m), ms); delete b.dataset.olc;
      if (ms < 8000) { A.soyle('Çok hızlı bitti; makaleyi gerçekten okuyup tekrar dene.', 3500); hizCiz(); return; }
      st.wpm = Math.max(60, Math.min(800, wpm)); kaydet(); anlamaSor('olc', st.wpm);
    }
    function anlamaSor(mod, wpm) {
      var ekran = panel.querySelector('.ok-ekran'), sor = o.m.q.filter(function (q) { return q.t === 'tfng'; }).slice(0, 2);
      ekran.innerHTML = '<p class="el">' + wpm + ' kelime/dk. Şimdi iki hızlı anlama sorusu:</p>' + sor.map(function (q, i) { return '<div class="ok-anl" data-an="' + i + '"><p lang="en">' + esc(q.m) + '</p><div class="sec yan">' + ['T', 'F', 'NG'].map(function (k) { return '<button type="button" data-ans="' + k + '">' + TFNG[k] + '</button>'; }).join('') + '</div></div>'; }).join('');
      var cev = {}, kayit = { t: Date.now(), wpm: wpm, anlama: null, mod: mod };
      ekran.onclick = function (e) {
        var b = e.target.closest('[data-ans]'); if (!b) return; var k = +b.closest('[data-an]').dataset.an; if (cev[k] != null) return;
        cev[k] = b.dataset.ans === sor[k].d; b.parentNode.querySelectorAll('button').forEach(function (x) { x.disabled = true; x.classList.toggle('dogru', x.dataset.ans === sor[k].d); x.classList.toggle('yanlis', x === b && !cev[k]); });
        if (Object.keys(cev).length === sor.length) {
          kayit.anlama = Object.keys(cev).filter(function (x) { return cev[x]; }).length / sor.length; st.hiz = (st.hiz || []).concat([kayit]).slice(-30); kaydet();
          ekran.onclick = null;
          var not = D.createElement('p'); not.className = 'el'; not.textContent = 'Anlama %' + Math.round(kayit.anlama * 100) + (kayit.anlama >= .5 ? ' — hız anlamayı bozmadı.' : ' — biraz yavaşla; anlamadan hız sayılmaz.'); ekran.appendChild(not);
          if (kayit.anlama >= .5 && mod !== 'olc' && A.bitir(P, 'hiz')) A.soyle('Hız görevi tamam.', 3000);
          W.setTimeout(function () { if (o.sekme !== 'hiz') return; hizCiz(); var yeni = panel.querySelector('.ok-ekran'); if (yeni) { yeni.innerHTML = ''; yeni.appendChild(not); } }, 1600);   /* geçmiş çubuğu yenilenir */
          var bb = $('.ok-bas .etiket'); if (bb && mod === 'olc') bb.textContent = bb.textContent.replace(/~\d+ dk/, '~' + sure(o.m, st.wpm) + ' dk');
        }
      };
    }

    function kelimeTik(k, c) {
      var pEl = k.closest('.ok-p'), p = +pEl.dataset.p, j = +k.dataset.j;
      if (c.fosfor) {
        if (k.dataset.f != null && !c.fosBas) { fosPop(+k.dataset.f, k, c); return; }
        if (!c.fosBas) { c.fosBas = { p: p, j: j }; k.classList.add('fos-secili'); return; }
        c.sayfa.querySelectorAll('.fos-secili').forEach(function (x) { x.classList.remove('fos-secili'); });
        if (c.fosBas.p !== p) { c.fosBas = { p: p, j: j }; k.classList.add('fos-secili'); return; }
        st.fos[c.m.id] = fosEkle(st.fos[c.m.id], { p: p, a: c.fosBas.j, b: j }); c.fosBas = null; kaydet(); fosCiz(c); A.sesCal('tebesir');
        var yeni = c.sayfa.querySelector('.ok-p[data-p="' + p + '"] .k[data-j="' + j + '"]'); if (yeni && yeni.dataset.f != null) fosPop(+yeni.dataset.f, yeni, c);
        return;
      }
      if (k.dataset.f != null) { fosPop(+k.dataset.f, k, c); return; }
      if (A.kelimeAc && !c.sayfa.classList.contains('bulanik')) A.kelimeAc(k.textContent.replace(/[.,!?;:"“”()]/g, ''), k.getBoundingClientRect());
    }
    function popTik(b, c) {
      var pop = b.closest('.ok-pop'), fi = +pop.dataset.f, liste = st.fos[c.m.id] || [];
      if (b.dataset.pop === 'kaydet' && liste[fi]) liste[fi].not = pop.querySelector('input').value.trim().slice(0, 120);
      if (b.dataset.pop === 'sil') liste.splice(fi, 1);
      st.fos[c.m.id] = liste; kaydet(); pop.remove(); fosCiz(c); if (c !== masaC && o.m && o.m.id === c.m.id) fosCiz(masaC);
    }

    /* ====================================================================== tam sayfa gazete okuyucusu
       Manşetten sonra ekrana gelir: 1. sayfa manşet + makale + köşeler, 2. sayfa bulmaca köşesi (sorular),
       3. sayfa kelimeler ve notlar. Köşeden çevrilir; fosfor ve kelime kartı masadakiyle aynı kaydı kullanır. */
    var gz = { m: null, gun: null, s: 0, el: null, geri: null };
    var gzC = { kok: null, sayfa: null, kenar: null, get m() { return gz.m; }, fosfor: false, fosBas: null };
    function mevsimAd(ay) { return ay === 11 || ay < 2 ? 'kis' : ay < 5 ? 'ilkbahar' : ay < 8 ? 'yaz' : 'sonbahar'; }
    function gununKelimesi(gun) {
      if (!KB || !KB.sev) return null; var sev = SEV.indexOf(st.sev) >= 0 ? st.sev : 'B1', l = KB.sev[sev] || []; if (!l.length) return null;
      var x = l[tohum('kelime:' + gun) % l.length].split('|'); return { w: x[0], t: x[1], tr: x[2], ex: x[3] };
    }
    function gazeteHtml(m, gun) {
      var d = new Date(gun + 'T12:00:00'), t = tohum(gun), ms = BK.MEVSIM[mevsimAd(d.getMonth())], dy = BK.DEYIM[t % BK.DEYIM.length], gk = gununKelimesi(gun), kr = BK.KARIKATUR[t % BK.KARIKATUR.length];
      var ilan = [0, 1, 2].map(function (k) { return BK.ILAN[(t + k * 5) % BK.ILAN.length]; });
      var no = Object.keys(st.gazete).sort().indexOf(gun) + 1 || 1, tarih = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      var zorlar = []; m.p.join(' ').split(/\s+/).forEach(function (w) { var k = norm(w)[0]; if (k && (zor[k] || ogren[k]) && zorlar.indexOf(k) < 0) zorlar.push(k); });
      var sozluk = {}; if (KB && KB.sev) SEV.forEach(function (sv) { (KB.sev[sv] || []).forEach(function (sat) { var x = sat.split('|'); sozluk[x[0]] = { sv: sv, tr: x[2], ex: x[3] }; }); });
      var kose = '<span class="gz-kose" data-gz="ileri" aria-hidden="true"></span>';
      return '<div class="gz-kitap">' +
        '<section class="gz-s aktif" data-s="0"><i class="gz-leke" aria-hidden="true"></i>' +
          '<header class="gz-mast"><div class="gz-kulak sol"><b>' + ms[2] + ' ' + ms[0] + ' on campus</b><span>' + esc(ms[1]) + '</span></div>' +
            '<div class="gz-ad"><b>The Campus Gazette</b><span>“All the English that’s fit to read.”</span></div>' +
            '<div class="gz-kulak sag">' + (gk ? '<b>Word of the day</b><span><i lang="en">' + esc(gk.w) + '</i> (' + esc(gk.t) + ') · ' + esc(gk.tr) + '</span>' : '<b>Word of the day</b><span>—</span>') + '</div></header>' +
          '<div class="gz-serit"><span>Vol. I · No. ' + no + '</span><span>' + tarih + '</span><span>' + esc(katAd(m.kat)) + ' · ' + m.sev + '</span><span>Free for students</span></div>' +
          '<div class="gz-on"><article class="gz-ana"><h1 lang="en">' + esc(m.b) + '</h1><p class="gz-tr">' + esc(m.tr || '') + '</p><p class="gz-imza">By the Acadex Desk · ' + sayKelime(m) + ' words · ~' + sure(m, st.wpm) + ' min read</p>' +
            '<div class="gz-metin ok-sayfa gazete-mod isaretli" lang="en">' + paragrafHtml(m) + '</div></article>' +
            '<aside class="gz-yan"><div class="gz-kutu"><b class="gz-kb">Idiom of the day</b><p lang="en"><i>' + esc(dy[0]) + '</i></p><p class="gz-k-tr">' + esc(dy[1]) + '</p><p lang="en" class="gz-k-ex">' + esc(dy[2]) + '</p></div>' +
              '<figure class="gz-kutu gz-karikatur"><svg viewBox="0 0 200 120" aria-hidden="true"><rect x="0" y="0" width="200" height="120" fill="#fff"/><path d="M10 104 h180" stroke="#1F2A44" stroke-width="2"/><rect x="40" y="84" width="120" height="8" fill="#1F2A44"/>' +
                '<g transform="translate(62 54) scale(.5)"><path d="M0 -52 C7 -19 19 -7 52 0 C19 7 7 19 0 52 C-7 19 -19 7 -52 0 C-19 -7 -7 -19 0 -52 Z" fill="#fff" stroke="#1F2A44" stroke-width="5"/><circle cx="-9" cy="-3" r="4" fill="#1F2A44"/><circle cx="11" cy="-3" r="4" fill="#1F2A44"/><path d="M-6 12 Q0 18 6 12" fill="none" stroke="#1F2A44" stroke-width="4"/></g>' +
                '<g transform="translate(140 50)"><circle r="18" fill="#fff" stroke="#1F2A44" stroke-width="2.5"/><circle cx="-6" cy="-3" r="2.2" fill="#1F2A44"/><circle cx="6" cy="-3" r="2.2" fill="#1F2A44"/><path d="M-6 7 h12" stroke="#1F2A44" stroke-width="2.5"/><path d="M-14 34 h28 l4 -14 h-36z" fill="#fff" stroke="#1F2A44" stroke-width="2.5"/></g>' +
                '<path d="M84 26 l18 -8 l2 22 l-20 6z" fill="#F7F1E3" stroke="#1F2A44" stroke-width="2"/></svg><figcaption lang="en"><span>' + esc(kr[0]) + '</span><span>' + esc(kr[1]) + '</span></figcaption></figure>' +
              '<div class="gz-kutu gz-ilanlar"><b class="gz-kb">Campus classifieds</b>' + ilan.map(function (x) { return '<p lang="en"><b>' + esc(x[0]) + '.</b> ' + esc(x[1]) + '</p>'; }).join('') + '</div></aside></div>' + kose + '</section>' +
        '<section class="gz-s" data-s="1"><header class="gz-ic-bas"><b>The Campus Gazette</b><span>Page 2 · Puzzle Corner</span></header><p class="gz-giris">Answer from the front page only. Wrong answers come with a link back to the paragraph that proves it.</p>' + soruHtml(m) + kose + '</section>' +
        '<section class="gz-s" data-s="2"><header class="gz-ic-bas"><b>The Campus Gazette</b><span>Page 3 · Words &amp; Notes</span></header>' +
          '<div class="gz-uc"><div><h3 class="gz-kb">Words from this issue</h3>' + (zorlar.length ? '<ul class="gz-sozluk">' + zorlar.map(function (k) { var x = sozluk[k]; return '<li><button type="button" class="gz-w" data-w="' + esc(k) + '" lang="en">' + esc(k) + '</button>' + (x ? ' <span class="mono">' + x.sv + '</span> — ' + esc(x.tr) : '') + (ogren[k] ? ' <em>destende</em>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="say">Bu sayıda seviyenin üstünde işaretli kelime yok. Herhangi bir kelimeye dokunarak anlamına bakabilirsin.</p>') +
            (gk ? '<div class="gz-kutu"><b class="gz-kb">Word of the day</b><p lang="en"><button type="button" class="gz-w" data-w="' + esc(gk.w) + '">' + esc(gk.w) + '</button> · ' + esc(gk.tr) + '</p><p lang="en" class="gz-k-ex">' + esc(gk.ex) + '</p></div>' : '') + '</div>' +
            '<div><h3 class="gz-kb">Your highlights &amp; notes</h3><div class="gz-notlar"></div></div></div></section>' +
        '</div>';
    }
    function gazeteAc(m, gun) {
      if (gz.el) gazeteKapat(true);
      gz.m = m; gz.gun = gun; gz.s = 0; gz.geri = D.activeElement; st.gor[m.id] = 1; kaydet();
      var el = D.createElement('div'); el.className = 'gz-okur'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'The Campus Gazette: ' + m.b);
      el.innerHTML = '<div class="gz-cerceve">' + gazeteHtml(m, gun) + '</div>' +
        '<nav class="gz-nav" aria-label="Gazete"><button type="button" class="btn sm" data-gz="geri" aria-label="Önceki sayfa">◀</button><span class="mono" data-gz-no>Sayfa 1 / 3</span><button type="button" class="btn sm" data-gz="ileri" aria-label="Sonraki sayfa">▶</button>' +
        '<button type="button" class="btn sm" data-gz="fosfor" aria-pressed="false">🖍 Fosfor</button><button type="button" class="btn sm ana" data-gz="kapat">✕ Gazeteyi kapat</button></nav>';
      D.body.appendChild(el); gz.el = el; D.documentElement.classList.add('gz-acik');
      gzC.kok = el; gzC.sayfa = el.querySelector('.gz-metin'); gzC.kenar = el.querySelector('.gz-notlar'); gzC.fosfor = false; gzC.fosBas = null;
      fosCiz(gzC);
      el.addEventListener('click', gzTik); D.addEventListener('keydown', gzTus);   /* odak nerede olursa olsun Esc ve oklar çalışır */
      if (!A.sakin && W.matchMedia('(pointer:fine)').matches) el.addEventListener('pointermove', function (e) { var k = el.querySelector('.gz-kitap'); if (!k) return; k.style.setProperty('--ry', ((e.clientX / W.innerWidth - .5) * 2.2).toFixed(2) + 'deg'); k.style.setProperty('--rx', ((.5 - e.clientY / W.innerHeight) * 1.6).toFixed(2) + 'deg'); });
      var sx = null; el.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') sx = e.clientX; });
      el.addEventListener('pointerup', function (e) { if (sx == null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 70 && !e.target.closest('input,select,textarea')) sayfaGit(gz.s + (dx < 0 ? 1 : -1)); });
      setTimeout(function () { var k = el.querySelector('[data-gz=kapat]'); if (k) k.focus({ preventScroll: true }); }, 60);
    }
    function gazeteKapat(hemen) {
      var el = gz.el; if (!el) return; gz.el = null; D.removeEventListener('keydown', gzTus);
      var bit = function () { el.remove(); D.documentElement.classList.remove('gz-acik'); if (o.m && gz.m && o.m.id === gz.m.id) fosCiz(masaC); if (gz.geri && gz.geri.focus) gz.geri.focus({ preventScroll: true }); };
      if (hemen || A.sakin) bit(); else { el.classList.add('kapan'); A.sesCal('sayfa'); setTimeout(bit, 420); }
    }
    function sayfaGit(n) {
      var el = gz.el; if (!el || n < 0 || n > 2 || n === gz.s) return;
      var ss = el.querySelectorAll('.gz-s'), eski = ss[gz.s], yeni = ss[n], ileri = n > gz.s;
      ss.forEach(function (x) { x.classList.remove('cevir-ileri', 'cevir-geri'); });
      yeni.classList.add('aktif'); if (!A.sakin) { if (ileri) eski.classList.add('cevir-ileri'); else yeni.classList.add('cevir-geri'); A.sesCal('sayfa'); }
      setTimeout(function () { eski.classList.remove('aktif', 'cevir-ileri'); yeni.classList.remove('cevir-geri'); }, A.sakin ? 0 : 720);
      gz.s = n; el.querySelector('[data-gz-no]').textContent = 'Sayfa ' + (n + 1) + ' / 3';
      el.querySelector('.gz-cerceve').scrollTo({ top: 0, behavior: A.sakin ? 'auto' : 'smooth' });
    }
    function gzTik(e) {
      var t = e.target, b = t.closest('button'), k = t.closest('.gz-metin .k'), kose = t.closest('.gz-kose');
      if (k && !b) { kelimeTik(k, gzC); return; }
      if (kose) { sayfaGit(gz.s + 1 > 2 ? 0 : gz.s + 1); return; }
      if (!b) { if (t === gz.el) gazeteKapat(); return; }
      if (b.dataset.pop) { popTik(b, gzC); return; }
      var g = b.dataset.gz;
      if (g === 'kapat') { gazeteKapat(); return; }
      if (g === 'ileri') { sayfaGit(gz.s + 1); return; }
      if (g === 'geri') { sayfaGit(gz.s - 1); return; }
      if (g === 'fosfor') { gzC.fosfor = !gzC.fosfor; gzC.fosBas = null; b.setAttribute('aria-pressed', gzC.fosfor); gzC.sayfa.classList.toggle('fos-mod', gzC.fosfor); if (gzC.fosfor && gz.s !== 0) sayfaGit(0); return; }
      if (b.dataset.w) { if (A.kelimeAc) A.kelimeAc(b.dataset.w, b.getBoundingClientRect()); return; }
      if (b.dataset.s != null && b.closest('.ok-sorular')) { b.parentNode.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); return; }
      if (b.hasAttribute('data-kontrol')) { soruKontrol(gz.el.querySelector('.gz-s[data-s="1"]'), gzC.sayfa, gz.gun); return; }
      if (b.dataset.kanit != null) { var pi = +b.dataset.kanit; sayfaGit(0); setTimeout(function () { var pe = gzC.sayfa.querySelector('.ok-p[data-p="' + pi + '"]'); if (pe) { pe.classList.remove('kanit'); void pe.offsetWidth; pe.classList.add('kanit'); pe.scrollIntoView({ block: 'center', behavior: A.sakin ? 'auto' : 'smooth' }); } }, A.sakin ? 0 : 500); return; }
    }
    function gzTus(e) {
      if (!gz.el) return;
      if (e.key === 'Escape') { e.preventDefault(); gazeteKapat(); return; }
      if (e.target.closest && e.target.closest('input,select,textarea')) { if (e.key === 'Enter' && e.target.id === 'ok-not') { e.preventDefault(); var b = gz.el.querySelector('[data-pop=kaydet]'); if (b) b.click(); } return; }
      if (e.key === 'ArrowRight') sayfaGit(gz.s + 1); if (e.key === 'ArrowLeft') sayfaGit(gz.s - 1);
    }

    /* ---------- olaylar ---------- */
    kok.addEventListener('click', function (e) {
      var t = e.target, b = t.closest('button'), k = t.closest('.ok-sayfa .k');
      if (k && !b) {
        if (tr.aktif != null) { taraDokun(k); return; }
        kelimeTik(k, masaC); return;
      }
      if (!b) return;
      if (b.dataset.pop) { popTik(b, masaC); return; }
      if (b.dataset.sev) { st.sev = b.dataset.sev; kaydet(); listeCiz(); return; }
      if (b.dataset.kat) { st.kat = b.dataset.kat; kaydet(); listeCiz(); return; }
      if (b.dataset.mk) { var mk = tum().filter(function (x) { return x.id === b.dataset.mk; })[0]; if (mk) { yukle(mk); masa.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' }); } return; }
      if (b.hasAttribute('data-yeni')) { yeniGetir(b); return; }
      if (b.dataset.kupur) { kupurKes(b); return; }
      if (b.hasAttribute('data-kupur-yeni')) { var ku = st.kupur && st.kupur.gun === bugun() ? st.kupur.tur : 0; st.kupur = { gun: bugun(), tur: ku + 1 }; kaydet(); gazeteCiz(true); A.sesCal('sayfa'); return; }
      if (b.hasAttribute('data-gz-ac')) { var gk = $('#ok-gazete'), ac2 = !gk.classList.contains('acik'); gk.classList.toggle('acik', ac2); b.setAttribute('aria-expanded', ac2); b.textContent = ac2 ? 'Gazeteyi katla ⤴' : 'Gazeteyi aç ⤵'; A.sesCal('sayfa'); return; }
      if (b.dataset.gazete) { var gm = tum().filter(function (x) { return x.id === b.dataset.gazete; })[0]; if (gm) manset(gm, function () { gazeteAc(gm, b.dataset.gun || bugun()); }); return; }
      if (b.dataset.masa) { var mm = tum().filter(function (x) { return x.id === b.dataset.masa; })[0]; if (mm) { yukle(mm, true); masa.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' }); } return; }
      if (b.dataset.a) { o[b.dataset.a] = !o[b.dataset.a]; if (b.dataset.a === 'fosfor') { masaC.fosBas = null; sayfa.querySelectorAll('.fos-secili').forEach(function (x) { x.classList.remove('fos-secili'); }); } aracCiz(); return; }
      if (b.dataset.git != null) { kanitGoster(+b.dataset.git); return; }
      if (b.dataset.sekme) { o.sekme = b.dataset.sekme; sekmeCiz(); return; }
      if (b.dataset.s != null && b.closest('.ok-sorular')) { b.parentNode.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); return; }
      if (b.hasAttribute('data-kontrol')) { soruKontrol(); return; }
      if (b.dataset.kanit != null) { kanitGoster(+b.dataset.kanit); return; }
      if (b.dataset.skim) { skimBasla(+b.dataset.skim); return; }
      if (b.dataset.ana != null) {
        var dogru = +b.dataset.ana === o.m.ana.d; b.parentNode.querySelectorAll('button').forEach(function (x) { x.disabled = true; x.classList.toggle('dogru', +x.dataset.ana === o.m.ana.d); x.classList.toggle('yanlis', x === b && !dogru); });
        sayfa.classList.remove('bulanik'); if (dogru) A.sevin(); else A.uz(); return;
      }
      if (b.dataset.scan != null) { taraBasla(+b.dataset.scan); return; }
      if (b.hasAttribute('data-tb-x')) { taraBitir(); return; }
      if (b.dataset.hm) { hizDur(); hz.mod = b.dataset.hm; hizCiz(); return; }
      if (b.hasAttribute('data-hbas')) { if (b.dataset.olc) olcBitir(b); else hizBasla(); return; }
    });
    kok.addEventListener('input', function (e) { if (e.target.matches('[data-wpm]')) { hz.wpm = +e.target.value; var y = panel.querySelector('[data-wpm-y]'); if (y) y.textContent = hz.wpm; } });
    kok.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'ok-not') { e.preventDefault(); var b = kok.querySelector('[data-pop=kaydet]'); if (b) b.click(); } });

    gazeteCiz();
    var ilk = gunSec(bugun(), st.sev, tum().filter(function (b) { return b.kat === st.kat; }), st.gor) || BK.MAKALE[0];
    yukle(ilk);
    A.sayac();
    return { yukle: yukle, durum: o };
  };
})();
