/* ==========================================================================
   ACADEX ENGLISH · Kişisel deste (assets/kelime.js), 07.11.2026
   Her öğrenciye kendi kelimeleri:
     seviye testi   40 kelime (her seviyeden 5 gerçek + 10 uydurma); “biliyorum” oranı
                    uydurmalara verilen “biliyorum”la düzeltilir → tahmini kelime sayısı ve seviye.
                    Bildiğin kelimeler desteye hiç girmez, bilmediklerin ilk kartların olur.
     kişisel havuz  seviyen ve bir üstü; sıra öğrenciye özel tohumla karışır (iki kişi aynı
                    sırayla görmez). Yerel havuz bitince ingilizce-hoca 'deste' havuzundan
                    görülmemiş kelimeler gelir. Acadia’nın “desteye ekle”si de buraya düşer.
     aralıklı tekrar SM-2 benzeri: Tekrar 10 dk, Zor ×1,2, İyi 1→3→aralık×kolaylık, Kolay ×1,3.
                    Günde en çok 10 yeni kart; vadesi gelenler her zaman önce.
     3B kart        dokun ya da boşlukla çevir; sağa kaydır biliyorum, sola tekrar.
     oyunlar        eşleştirme yarışı, harf karıştırma, boşluk doldurma, dinle-yaz (deste kelimeleriyle).
     bahçe          her kart bir bitki: tohum → filiz → yaprak → çiçek (aralık 21 gün ve üstü).
   Kayıt: ls 'kelime' (bu tarayıcı). Eski 'deste' ve 'desteEk' kayıtları ilk açılışta taşınır.
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window, A = W.ACX, KB = W.KELIME_BANKA, esc = A.esc, P = 'vocab';
  var SIRA = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], GUN = 864e5, YENI_GUNLUK = 10;
  var sevNo = function (s) { return Math.max(0, SIRA.indexOf(s)); };
  var ikiHane = function (n) { return ('0' + n).slice(-2); };
  var gunAn = function (d) { d = d || new Date(); return d.getFullYear() + '-' + ikiHane(d.getMonth() + 1) + '-' + ikiHane(d.getDate()); };
  var gunBasi = function (t) { var d = new Date(t == null ? Date.now() : t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  var TUR = { n: 'noun', v: 'verb', adj: 'adj', adv: 'adv', phr: 'phrase' };
  function tohumlu(seed) { var h = seed >>> 0 || 1; return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; }; }
  function karistir(a, r) { r = r || Math.random; a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------- havuz ---------- */
  var BANKA = {};
  SIRA.forEach(function (sv) { KB.sev[sv].forEach(function (s) { var p = s.split('|'); BANKA[p[0]] = { k: p[0], tur: TUR[p[1]] || p[1], tr: p[2], ornek: p[3], sev: sv }; }); });

  /* ---------- durum ---------- */
  var st;
  function yukle() {
    st = A.ls.al('kelime', null);
    if (!st || st.v !== 1) {
      st = { v: 1, tohum: Math.floor(Math.random() * 4294967295) || 7, sev: null, tahmin: null, testTarih: null, bilinen: {}, kart: {}, ek: {}, gun: {} };
      /* eski deste: kelimeler ve kutuları taşınır */
      var eski = A.ls.al('deste', {}) || {}, ekler = A.ls.al('desteEk', []) || [];
      ekler.forEach(function (k) { if (Array.isArray(k) && k[0]) { var o = String(k[1] || '').split(' · '); st.ek[String(k[0]).toLowerCase()] = { k: String(k[0]).toLowerCase(), okunus: o[0] || '', tur: o[1] || '', tr: String(k[2] || ''), ornek: String(k[3] || ''), sev: '' }; } });
      Object.keys(eski).forEach(function (w) { if (!bilgi(w)) return; var e = eski[w] || {}; st.kart[w] = yeniKart(); if (e.kutu >= 1) { st.kart[w].son = Date.now(); st.kart[w].n = e.kutu; st.kart[w].iv = [0, 1, 3, 7, 14][Math.min(4, e.kutu)]; st.kart[w].d = e.vade || Date.now(); } });
      kaydet();
    }
  }
  var kaydet = function () { A.ls.yaz('kelime', st); };
  var yeniKart = function (onc) { return { n: 0, iv: 0, ef: 2.5, d: 0, hata: 0, son: 0, ek: Date.now(), onc: onc ? 1 : 0 }; };
  function bilgi(w) { return BANKA[w] || st && st.ek[w] || null; }
  function gunKaydi() { var an = gunAn(); st.gun[an] = st.gun[an] || { yeni: 0, tekrar: 0 }; var ks = Object.keys(st.gun).sort(); while (ks.length > 60) delete st.gun[ks.shift()]; return st.gun[an]; }
  /* Acadia'nın "desteye ekle"si ve havuzdan gelenler */
  function ekleriAl() {
    var n = 0;
    (A.ls.al('desteEk', []) || []).forEach(function (k) {
      if (!Array.isArray(k) || !k[0]) return; var w = String(k[0]).toLowerCase(), o = String(k[1] || '').split(' · ');
      if (!bilgi(w)) st.ek[w] = { k: w, okunus: o[0] || '', tur: o[1] || '', tr: String(k[2] || ''), ornek: String(k[3] || ''), sev: '' };
      if (!st.kart[w] && !st.bilinen[w]) { st.kart[w] = yeniKart(true); n++; }
    });
    if (n) kaydet(); return n;
  }

  /* ---------- aralıklı tekrar ---------- */
  function hesapla(c, r, simdi) {
    c = Object.assign({}, c); simdi = simdi || Date.now();
    if (r === 0) { c.n = 0; c.iv = 0; c.ef = Math.max(1.3, c.ef - .2); if (c.son) c.hata++; c.d = simdi + 10 * 60e3; }
    else {
      if (r === 1) { c.iv = Math.max(1, Math.round(Math.max(c.iv, 1) * 1.2)); c.ef = Math.max(1.3, c.ef - .15); }
      else if (r === 2) c.iv = c.n === 0 ? 1 : c.n === 1 ? 3 : Math.max(c.iv + 1, Math.round(c.iv * c.ef));
      else { c.iv = c.n === 0 ? 4 : Math.max(c.iv + 2, Math.round(Math.max(c.iv, 1) * c.ef * 1.3)); c.ef = Math.min(3.2, c.ef + .15); }
      c.n++; c.d = gunBasi(simdi) + c.iv * GUN + 4 * 3600e3;
    }
    c.son = simdi; return c;
  }
  var aralikYazi = function (c) { return c.iv === 0 ? '10 dk' : c.iv === 1 ? '1 gün' : c.iv < 30 ? c.iv + ' gün' : Math.round(c.iv / 30) + ' ay'; };
  var evre = function (c) { return !c.son ? 'tohum' : c.iv < 3 ? 'filiz' : c.iv < 21 ? 'yaprak' : 'cicek'; };

  /* ---------- kişisel aday sırası ---------- */
  function adaylar() {
    var n = sevNo(st.sev || 'B1'), r = tohumlu(st.tohum), sirali = [];
    [n, n + 1, n - 1, n + 2].forEach(function (i) { if (i < 0 || i > 5) return; sirali = sirali.concat(karistir(KB.sev[SIRA[i]].map(function (s) { return s.split('|')[0]; }), r)); });
    return sirali.filter(function (w) { return !st.kart[w] && !st.bilinen[w]; });
  }
  async function havuzdanAl() {
    var v = await A.icerik('deste', st.sev || 'B1'), n = 0;
    if (v && Array.isArray(v.kelimeler)) v.kelimeler.forEach(function (k) {
      var w = String(k && k.kelime || '').toLowerCase().trim(); if (!/^[a-z][a-z' -]{1,30}$/.test(w) || st.kart[w] || st.bilinen[w]) return;
      if (!BANKA[w]) st.ek[w] = { k: w, okunus: String(k.okunus || '').slice(0, 40), tur: String(k.tur || '').slice(0, 12), tr: String(k.anlam_tr || '').slice(0, 80), ornek: String(k.ornek || '').slice(0, 200), sev: st.sev || '' };
      st.kart[w] = yeniKart(); n++;
    });
    if (n) kaydet(); return n;
  }
  /* bugünün sırası: vadesi gelenler, sonra kotadan kalan yeni kartlar (öncelikliler başta) */
  function kuyruk() {
    var simdi = Date.now(), g = gunKaydi();
    var vade = Object.keys(st.kart).filter(function (w) { var c = st.kart[w]; return c.son && c.d <= simdi; }).sort(function (a, b) { return st.kart[a].d - st.kart[b].d; });
    var kalanYeni = Math.max(0, YENI_GUNLUK - g.yeni);
    var yeni = Object.keys(st.kart).filter(function (w) { return !st.kart[w].son; }).sort(function (a, b) { return (st.kart[b].onc - st.kart[a].onc) || (st.kart[a].ek - st.kart[b].ek); });
    if (yeni.length < kalanYeni) { adaylar().slice(0, kalanYeni - yeni.length).forEach(function (w) { st.kart[w] = yeniKart(); yeni.push(w); }); kaydet(); }
    return { vade: vade, yeni: yeni.slice(0, kalanYeni), kalanYeni: kalanYeni };
  }

  /* ---------- arayüz ---------- */
  var kok, sekme = 'bugun', buyuyen = {};
  function kur(el) {
    kok = el; yukle(); ekleriAl();
    el.innerHTML = '<div class="kel-ust"></div><div class="kel-sekme" role="tablist"><button type="button" role="tab" data-sekme="bugun">Bugün</button><button type="button" role="tab" data-sekme="oyun">Oyunlar</button><button type="button" role="tab" data-sekme="bahce">Bahçe</button></div><div class="kel-govde"></div>';
    el.querySelector('.kel-sekme').addEventListener('click', function (e) { var b = e.target.closest('[data-sekme]'); if (b) { sekme = b.dataset.sekme; ciz(); } });
    if (A.sozlukEkle) A.sozlukEkle(Object.keys(st.kart).slice(0, 300).map(function (w) { var b = bilgi(w) || {}; return { kelime: w, okunus: b.okunus || '', tur: b.tur || '', anlam_tr: b.tr || '', ornek: b.ornek || '' }; }));
    W.ACX_DESTE_YENILE = function () { if (ekleriAl()) ciz(); };
    ciz();
  }
  function ustCiz() {
    var ks = Object.keys(st.kart), cicek = ks.filter(function (w) { return evre(st.kart[w]) === 'cicek'; }).length, q = kuyruk();
    kok.querySelector('.kel-ust').innerHTML =
      '<div class="kel-stat"><span class="etiket">seviyen</span><b>' + (st.sev || '?') + '</b><small>' + (st.sev ? 'teste göre' : 'testi yap') + '</small></div>' +
      '<div class="kel-stat"><span class="etiket">tahmini kelime</span><b>' + (st.tahmin ? (st.tahmin + cicek).toLocaleString('tr') : '—') + '</b><small>' + (st.tahmin ? '+ ustalaştıkların' : 'test sonrası') + '</small></div>' +
      '<div class="kel-stat"><span class="etiket">bugün</span><b>' + (q.vade.length + q.yeni.length) + '</b><small>' + q.vade.length + ' tekrar · ' + q.yeni.length + ' yeni</small></div>' +
      '<div class="kel-stat"><span class="etiket">desten</span><b>' + ks.length + '</b><small>' + cicek + ' çiçek açtı</small></div>' +
      '<button type="button" class="btn sm" data-test>' + (st.sev ? 'Testi yenile' : 'Seviye testi') + '</button>';
    kok.querySelector('[data-test]').onclick = function () { sekme = 'test'; ciz(); };
  }
  function ciz() {
    if (!st.sev && sekme !== 'test' && sekme !== 'testsiz') sekme = 'giris';
    ustCiz();
    kok.querySelectorAll('[data-sekme]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.sekme === sekme); });
    kok.querySelector('.kel-sekme').hidden = !st.sev;
    var g = kok.querySelector('.kel-govde');
    ({ giris: girisCiz, test: testCiz, bugun: bugunCiz, oyun: oyunCiz, bahce: bahceCiz }[sekme] || bugunCiz)(g);
  }

  /* ---------- seviye testi ---------- */
  function girisCiz(g) {
    g.innerHTML = '<div class="kel-giris"><span class="etiket">önce seni tanıyalım</span><h4>İki dakikalık seviye testi</h4><p>40 kelime göreceksin. Anlamını biliyorsan <b>Biliyorum</b>, emin değilsen <b>Bilmiyorum</b>. Bazıları uydurma; onlara “biliyorum” dersen sonuç düzeltilir, dürüst ol.</p><p class="say">Sonra desten senin seviyene ve bilmediğin kelimelere göre kurulur. Bildiğin kelimeler hiç gelmez.</p>' +
      '<div class="alt-satir"><button type="button" class="btn sm" data-testsiz>Testsiz başla (B1)</button><button type="button" class="btn ana" data-basla>Teste başla</button></div></div>';
    g.querySelector('[data-basla]').onclick = function () { sekme = 'test'; ciz(); };
    g.querySelector('[data-testsiz]').onclick = function () { st.sev = 'B1'; kaydet(); sekme = 'bugun'; ciz(); };
  }
  function testCiz(g) {
    var r = Math.random, ogeler = [];
    SIRA.forEach(function (sv) { karistir(KB.sev[sv], r).slice(0, 5).forEach(function (s) { ogeler.push({ k: s.split('|')[0], sev: sv }); }); });
    karistir(KB.sahte, r).slice(0, 10).forEach(function (w) { ogeler.push({ k: w, sahte: true }); });
    ogeler = karistir(ogeler, r);
    var i = 0, cevap = [];
    g.innerHTML = '<div class="kel-test"><div class="kel-ilerle"><i></i></div><p class="say kel-tsay"></p><div class="kel-yigin test"></div><div class="kel-dug2"><button type="button" class="btn" data-c="0">← Bilmiyorum</button><button type="button" class="btn ana" data-c="1">Biliyorum →</button></div></div>';
    var yig = g.querySelector('.kel-yigin'), bar = g.querySelector('.kel-ilerle i'), say = g.querySelector('.kel-tsay');
    function goster() {
      bar.style.width = (i / ogeler.length * 100) + '%'; say.textContent = (i + 1) + ' / ' + ogeler.length;
      yig.innerHTML = '<div class="kel-kart giris"><div class="kel-ic"><div class="kel-on"><b lang="en">' + esc(ogeler[i].k) + '</b><small>anlamını biliyor musun?</small></div></div></div>';
      kaydirBagla(yig.firstChild, function (yon) { sec(yon > 0 ? 1 : 0); });
    }
    function sec(c) {
      if (i >= ogeler.length) return;
      cevap.push(c); var k = yig.firstChild; k.classList.add(c ? 'uc-sag' : 'uc-sol');
      i++; setTimeout(function () { if (i < ogeler.length) goster(); else bitir(); }, A.sakin ? 0 : 260);
    }
    g.querySelectorAll('[data-c]').forEach(function (b) { b.onclick = function () { sec(+b.dataset.c); }; });
    klavye = function (e) { if (e.key === 'ArrowRight') sec(1); else if (e.key === 'ArrowLeft') sec(0); };
    function bitir() {
      klavye = null;
      var s = testSonuc(ogeler, cevap);
      st.sev = s.sev; st.tahmin = s.tahmin; st.testTarih = Date.now();
      if (s.guvenilir) ogeler.forEach(function (o, j) { if (o.sahte) return; if (cevap[j]) { st.bilinen[o.k] = 1; delete st.kart[o.k]; } else if (!st.kart[o.k]) st.kart[o.k] = yeniKart(true); });
      kaydet();
      g.innerHTML = '<div class="kel-sonuc"><span class="etiket">sonucun</span><div class="kel-buyuk"><b>' + s.sev + '</b><span>tahmini <b>' + s.tahmin.toLocaleString('tr') + '</b> kelime</span></div>' +
        '<div class="kel-bant">' + SIRA.map(function (sv) { return '<div><span>' + sv + '</span><i style="--w:' + Math.round(s.bant[sv] * 100) + '%"></i></div>'; }).join('') + '</div>' +
        (s.guvenilir ? '' : '<p class="kel-uyari">Uydurma kelimelerin ' + s.sahteBil + '’ine “biliyorum” dedin; tahmini düşürdüm. Bir dahaki sefere emin olmadığında “bilmiyorum” de.</p>') +
        '<p class="say">Desten şimdi ' + s.sev + ' ve bir üst seviyeden, bilmediğin kelimelerle kuruldu. Bildiğin ' + Object.keys(st.bilinen).length + ' kelime hiç gelmeyecek.</p><div class="alt-satir"><span></span><button type="button" class="btn ana" data-git>Desteme git</button></div></div>';
      g.querySelector('[data-git]').onclick = function () { sekme = 'bugun'; ciz(); };
      if (A.sevin) A.sevin(); ustCiz(); kok.querySelector('.kel-sekme').hidden = false;
    }
    goster();
  }
  function testSonuc(ogeler, cevap) {
    var bant = {}, sahte = 0, sahteBil = 0;
    SIRA.forEach(function (sv) { bant[sv] = [0, 0]; });
    ogeler.forEach(function (o, j) { if (o.sahte) { sahte++; if (cevap[j]) sahteBil++; } else { bant[o.sev][1]++; if (cevap[j]) bant[o.sev][0]++; } });
    var f = sahte ? sahteBil / sahte : 0, oran = {}, tahmin = 0, sev = 'C2';
    SIRA.forEach(function (sv) { var h = bant[sv][1] ? bant[sv][0] / bant[sv][1] : 0; oran[sv] = f >= 1 ? 0 : Math.max(0, (h - f) / (1 - f)); tahmin += oran[sv] * KB.bant[sv]; });
    for (var i = 0; i < SIRA.length; i++) if (oran[SIRA[i]] < .7) { sev = SIRA[i]; break; }
    return { bant: oran, tahmin: Math.round(tahmin / 50) * 50, sev: sev, guvenilir: f <= .25, sahteBil: sahteBil };
  }

  /* ---------- kaydırma (işaretçi + dokunma) ---------- */
  var klavye = null;
  D.addEventListener('keydown', function (e) { if (klavye && !/input|textarea/i.test((e.target.tagName || ''))) { if (e.key === ' ' || e.key.indexOf('Arrow') === 0) e.preventDefault(); klavye(e); } });
  function kaydirBagla(kart, bitti, tik) {
    var x0 = null, dx = 0, id = null;
    kart.addEventListener('pointerdown', function (e) { x0 = e.clientX; dx = 0; id = e.pointerId; try { kart.setPointerCapture(id); } catch (x) {} kart.classList.add('surukle'); });
    kart.addEventListener('pointermove', function (e) { if (x0 == null) return; dx = e.clientX - x0; kart.style.setProperty('--dx', dx + 'px'); kart.dataset.yon = dx > 40 ? 'sag' : dx < -40 ? 'sol' : ''; });
    var birak = function () { if (x0 == null) return; kart.classList.remove('surukle'); var d = dx; x0 = null; kart.style.removeProperty('--dx'); kart.dataset.yon = ''; if (Math.abs(d) > 90) bitti(d > 0 ? 1 : -1); else if (Math.abs(d) < 6 && tik) tik(); };
    kart.addEventListener('pointerup', birak); kart.addEventListener('pointercancel', function () { x0 = null; kart.classList.remove('surukle'); kart.style.removeProperty('--dx'); });
  }

  /* ---------- bugün: 3B kart oturumu ---------- */
  function bugunCiz(g) {
    var q = kuyruk(), sira = q.vade.concat(q.yeni), i = 0, bugunSay = 0, gk = gunKaydi();
    g.innerHTML = '<div class="kel-oturum"><div class="kel-yigin"></div><div class="kel-dug4" hidden>' +
      ['Tekrar', 'Zor', 'İyi', 'Kolay'].map(function (t, r) { return '<button type="button" class="btn sm r' + r + '" data-r="' + r + '">' + t + '<small></small></button>'; }).join('') + '</div>' +
      '<p class="say kel-ipucu">Dokun ya da boşluk: çevir · sağa kaydır: biliyorum · sola: tekrar</p><div class="kel-yan"><button type="button" class="btn sm" data-dinle>▶ Dinle</button><button type="button" class="btn sm" data-havuz>+ Havuzdan 10 kelime</button></div></div>';
    var yig = g.querySelector('.kel-yigin'), dug = g.querySelector('.kel-dug4'), cur = null, don = false;
    g.querySelector('[data-dinle]').onclick = function () { if (cur && A.ses) A.ses(don ? (bilgi(cur) || {}).ornek || cur : cur, .9); };
    g.querySelector('[data-havuz]').onclick = async function () {
      var b = this; b.disabled = true; b.textContent = 'getiriliyor…';
      var n = await havuzdanAl(); if (!n) { var ek = adaylar().slice(0, 10); ek.forEach(function (w) { st.kart[w] = yeniKart(true); }); n = ek.length; kaydet(); }
      gk.yeni = Math.max(0, gk.yeni - n); kaydet();
      if (A.soyle) A.soyle(n ? n + ' yeni kelime desteye girdi.' : 'Şu an yeni kelime yok; yarın tekrar dene.', 3500);
      ciz();
    };
    function kartHtml(w, arka) {
      var b = bilgi(w) || { k: w, tr: '', ornek: '' }, c = st.kart[w], yeni = !c.son;
      var ornek = esc(b.ornek || '').replace(new RegExp('\\b(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*)', 'i'), '<b>$1</b>');
      return '<div class="kel-kart' + (arka ? ' arkada' : '') + '" data-w="' + esc(w) + '" tabindex="0" role="button" aria-label="Kartı çevir"><div class="kel-ic"><div class="kel-on">' + (yeni ? '<span class="kel-rozet">yeni</span>' : '') + '<b lang="en">' + esc(b.k) + '</b><small>' + esc([b.okunus, b.tur].filter(Boolean).join(' · ')) + (b.sev ? ' · ' + b.sev : '') + '</small><span class="kel-cevir">dokun, çevir</span></div>' +
        '<div class="kel-arka"><span class="kel-tr">' + esc(b.tr || '—') + '</span><p lang="en">' + ornek + '</p><small>' + (c.son ? 'son aralık: ' + aralikYazi(c) + (c.hata ? ' · ' + c.hata + ' kez unutuldu' : '') : 'ilk kez görüyorsun') + '</small></div></div><span class="kel-isaret sag">biliyorum</span><span class="kel-isaret sol">tekrar</span></div>';
    }
    function goster() {
      don = false; dug.hidden = true;
      if (i >= sira.length) {
        cur = null; klavye = null;
        yig.innerHTML = '<div class="kel-bos"><b>' + (bugunSay ? 'Bugünlük bitti.' : 'Şu an vadesi gelen kart yok.') + '</b><span>' + sonrakiYazi() + '</span></div>';
        if (bugunSay) { A.bitir(P, 'deste'); if (A.sevin) A.sevin(); }
        ustCiz(); return;
      }
      cur = sira[i];
      yig.innerHTML = (sira[i + 1] ? kartHtml(sira[i + 1], true) : '') + kartHtml(cur);
      var k = yig.querySelector('.kel-kart:not(.arkada)');
      kaydirBagla(k, function (yon) { puan(yon > 0 ? (don ? 2 : 3) : 0); }, cevir);
      k.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); cevir(); } });
      klavye = function (e) { if (e.key === ' ') cevir(); else if (e.key === 'ArrowRight') puan(don ? 2 : 3); else if (e.key === 'ArrowLeft') puan(0); else if (don && /^[1-4]$/.test(e.key)) puan(+e.key - 1); };
    }
    function cevir() {
      if (!cur) return; don = !don; yig.querySelector('.kel-kart:not(.arkada)').classList.toggle('don', don);
      if (don) { var c = st.kart[cur]; dug.hidden = false; dug.querySelectorAll('[data-r]').forEach(function (b) { b.querySelector('small').textContent = aralikYazi(hesapla(c, +b.dataset.r)); }); }
    }
    function puan(r) {
      if (!cur) return;
      var w = cur, c = st.kart[w], once = evre(c), yeni = !c.son;
      st.kart[w] = hesapla(c, r); if (yeni) gk.yeni++; else gk.tekrar++;
      if (evre(st.kart[w]) !== once) buyuyen[w] = 1;
      kaydet(); bugunSay++;
      if (A.sesCal) A.sesCal(r === 0 ? 'yanlis' : 'dogru');
      var k = yig.querySelector('.kel-kart:not(.arkada)'); k.classList.add(r === 0 ? 'uc-sol' : 'uc-sag');
      if (r === 0) sira.push(w);   /* aynı oturumda bir kez daha */
      cur = null; i++;
      setTimeout(goster, A.sakin ? 0 : 280); ustCiz();
    }
    dug.addEventListener('click', function (e) { var b = e.target.closest('[data-r]'); if (b) puan(+b.dataset.r); });
    goster();
  }
  function sonrakiYazi() {
    var simdi = Date.now(), gelecek = Object.keys(st.kart).map(function (w) { return st.kart[w]; }).filter(function (c) { return c.son && c.d > simdi; }).map(function (c) { return c.d; }).sort(function (a, b) { return a - b; })[0];
    if (!gelecek) return 'Yeni kelimeler yarın gelir.';
    var dk = Math.round((gelecek - simdi) / 60e3); return 'Sıradaki kart ' + (dk < 60 ? dk + ' dakika' : dk < 1440 ? Math.round(dk / 60) + ' saat' : Math.round(dk / 1440) + ' gün') + ' sonra.';
  }

  /* ---------- oyunlar ---------- */
  function oyunKelimeleri(n) {
    var ks = Object.keys(st.kart).filter(function (w) { return st.kart[w].son && bilgi(w) && bilgi(w).tr; });
    ks.sort(function (a, b) { var A1 = st.kart[a], B1 = st.kart[b]; return (A1.iv - B1.iv) || (B1.son - A1.son); });   /* önce yeni öğrenilenler ve zorlar */
    if (ks.length < n) ks = ks.concat(karistir(Object.keys(st.kart).filter(function (w) { return ks.indexOf(w) < 0 && bilgi(w) && bilgi(w).tr; })));
    if (ks.length < n) ks = ks.concat(adaylar().filter(function (w) { return ks.indexOf(w) < 0; }));
    return karistir(ks.slice(0, Math.max(n, 8))).slice(0, n);
  }
  function oyunYanlis(w) { var c = st.kart[w]; if (c && c.son && c.d > Date.now()) { c.d = Date.now(); kaydet(); } }   /* oyunda kaçırılan kelime hemen tekrar sırasına */
  var OYUN = [
    ['esle', 'Eşleştirme yarışı', 'Kelimeyi anlamıyla eşleştir; saat işliyor.'],
    ['harf', 'Harf karıştırma', 'Türkçe ipucundan kelimeyi harflerle kur.'],
    ['bosluk', 'Boşluk doldurma', 'Cümledeki boşluğa doğru kelimeyi seç.'],
    ['dinleyaz', 'Dinle-yaz', 'Kelimeyi dinle, doğru yaz.']
  ];
  function oyunCiz(g) {
    klavye = null;
    var bugun = OYUN[Math.round(gunBasi() / GUN) % OYUN.length][0];
    g.innerHTML = '<div class="kel-oyunlar">' + OYUN.map(function (o) { return '<button type="button" class="kel-oyun" data-oyun="' + o[0] + '">' + (o[0] === bugun ? '<span class="kel-rozet">günün oyunu</span>' : '') + '<b>' + o[1] + '</b><span>' + o[2] + '</span></button>'; }).join('') + '</div><div class="kel-sahne"></div>';
    g.querySelectorAll('[data-oyun]').forEach(function (b) { b.onclick = function () { oyunBaslat(b.dataset.oyun, g.querySelector('.kel-sahne')); }; });
  }
  function oyunSonu(s, dogru, top, ek) {
    var o = dogru / top;
    s.innerHTML = '<div class="kel-oyun-son"><b>' + dogru + ' / ' + top + '</b><span>' + (ek || '') + '</span><button type="button" class="btn sm ana" data-yine>Bir daha</button></div>';
    if (o >= .8 && A.sevin) A.sevin(); else if (o < .5 && A.uz) A.uz();
    return s.querySelector('[data-yine]');
  }
  function oyunBaslat(id, s) {
    var ws = oyunKelimeleri(id === 'esle' ? 6 : 5);
    if (ws.length < 4) { s.innerHTML = '<p class="say">Oyun için desten en az 4 kelime olmalı; önce Bugün sekmesinde birkaç kart çalış.</p>'; return; }
    s.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'nearest' });
    ({ esle: esle, harf: harf, bosluk: bosluk, dinleyaz: dinleyaz })[id](s, ws, function () { oyunBaslat(id, s); });
  }
  function esle(s, ws, yine) {
    var t0 = Date.now(), hata = 0, kalan = ws.length, secili = null;
    var sol = karistir(ws), sag = karistir(ws);
    s.innerHTML = '<div class="kel-esle"><div>' + sol.map(function (w) { return '<button type="button" data-en="' + esc(w) + '" lang="en">' + esc(w) + '</button>'; }).join('') + '</div><div>' + sag.map(function (w) { return '<button type="button" data-tr="' + esc(w) + '">' + esc(bilgi(w).tr) + '</button>'; }).join('') + '</div></div><p class="say kel-saat">0 sn</p>';
    var iv = setInterval(function () { var e = s.querySelector('.kel-saat'); if (!e) return clearInterval(iv); e.textContent = Math.round((Date.now() - t0) / 1000) + ' sn · hata ' + hata; }, 250);
    s.querySelector('.kel-esle').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.en != null) { s.querySelectorAll('[data-en]').forEach(function (x) { x.classList.remove('secili'); }); secili = b; b.classList.add('secili'); if (A.ses) A.ses(b.dataset.en, .95); return; }
      if (!secili) return;
      if (secili.dataset.en === b.dataset.tr) { secili.disabled = b.disabled = true; secili.classList.add('ok'); b.classList.add('ok'); secili = null; if (A.sesCal) A.sesCal('dogru'); if (--kalan === 0) { clearInterval(iv); oyunSonu(s, ws.length - Math.min(ws.length, hata), ws.length, Math.round((Date.now() - t0) / 1000) + ' saniye · ' + hata + ' hata').onclick = yine; } }
      else { hata++; oyunYanlis(secili.dataset.en); b.classList.add('yok'); setTimeout(function () { b.classList.remove('yok'); }, 500); if (A.sesCal) A.sesCal('yanlis'); }
    });
  }
  function harf(s, ws, yine) {
    var i = 0, dogru = 0;
    function goster() {
      if (i >= ws.length) { oyunSonu(s, dogru, ws.length, 'harf karıştırma').onclick = yine; return; }
      var w = ws[i], harfler = w.split(''), k = karistir(harfler); if (k.join('') === w && w.length > 1) k = k.slice(1).concat(k[0]);
      var yazilan = [];
      s.innerHTML = '<div class="kel-harf"><p class="say">' + (i + 1) + ' / ' + ws.length + '</p><p class="kel-ipucu2">' + esc(bilgi(w).tr) + '</p><div class="kel-cevap" lang="en"></div><div class="kel-harfler">' + k.map(function (h, j) { return '<button type="button" data-j="' + j + '">' + esc(h) + '</button>'; }).join('') + '</div><div class="alt-satir"><button type="button" class="btn sm" data-sil>Sil</button><button type="button" class="btn sm" data-pas>Pas</button></div><div class="cay-not"></div></div>';
      var cev = s.querySelector('.kel-cevap');
      var ciz2 = function () { cev.textContent = yazilan.map(function (j) { return k[j]; }).join('') || '·'; };
      ciz2();
      var kontrol = function (pas) {
        var sonuc = yazilan.map(function (j) { return k[j]; }).join(''), ok = !pas && sonuc === w; if (ok) dogru++; else oyunYanlis(w);
        s.querySelector('.cay-not').innerHTML = (ok ? '<b class="ok">✓</b> ' : '<b class="yok">✗</b> ') + '<span lang="en">' + esc(w) + '</span>';
        if (A.sesCal) A.sesCal(ok ? 'dogru' : 'yanlis'); i++; setTimeout(goster, 1100);
      };
      s.querySelector('.kel-harfler').addEventListener('click', function (e) { var b = e.target.closest('[data-j]'); if (!b || b.disabled) return; yazilan.push(+b.dataset.j); b.disabled = true; ciz2(); if (yazilan.length === k.length) kontrol(false); });
      s.querySelector('[data-sil]').onclick = function () { var j = yazilan.pop(); if (j != null) s.querySelector('[data-j="' + j + '"]').disabled = false; ciz2(); };
      s.querySelector('[data-pas]').onclick = function () { kontrol(true); };
    }
    goster();
  }
  function bosluk(s, ws, yine) {
    var i = 0, dogru = 0, liste = ws.filter(function (w) { var o = bilgi(w).ornek || ''; return new RegExp('\\b' + w, 'i').test(o); });
    if (liste.length < 3) liste = ws;
    function goster() {
      if (i >= liste.length) { oyunSonu(s, dogru, liste.length, 'boşluk doldurma').onclick = yine; return; }
      var w = liste[i], o = bilgi(w).ornek || ('… ' + w + ' …'), cumle = esc(o).replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*', 'i'), '<span class="kel-bos2">_____</span>');
      var yanlis = karistir(oyunKelimeleri(8).filter(function (x) { return x !== w; })).slice(0, 3), ops = karistir([w].concat(yanlis));
      s.innerHTML = '<div class="kel-bosluk"><p class="say">' + (i + 1) + ' / ' + liste.length + '</p><p class="kel-cumle" lang="en">' + cumle + '</p><div class="cay-sec">' + ops.map(function (x) { return '<button type="button" data-x="' + esc(x) + '" lang="en">' + esc(x) + '</button>'; }).join('') + '</div><div class="cay-not"></div></div>';
      s.querySelectorAll('[data-x]').forEach(function (b) {
        b.onclick = function () {
          var ok = b.dataset.x === w; if (ok) dogru++; else oyunYanlis(w);
          s.querySelectorAll('[data-x]').forEach(function (x) { x.disabled = true; if (x.dataset.x === w) x.classList.add('ok'); }); if (!ok) b.classList.add('yok');
          s.querySelector('.cay-not').innerHTML = esc(bilgi(w).tr); if (A.sesCal) A.sesCal(ok ? 'dogru' : 'yanlis');
          i++; setTimeout(goster, ok ? 900 : 1600);
        };
      });
    }
    goster();
  }
  function dinleyaz(s, ws, yine) {
    var i = 0, dogru = 0;
    function goster() {
      if (i >= ws.length) { oyunSonu(s, dogru, ws.length, 'dinle-yaz').onclick = yine; return; }
      var w = ws[i];
      s.innerHTML = '<div class="kel-dinleyaz"><p class="say">' + (i + 1) + ' / ' + ws.length + '</p><button type="button" class="btn" data-d>▶ Dinle</button><form class="cay-yaz"><input type="text" lang="en" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="duyduğunu yaz"><button type="submit" class="btn sm ana">Kontrol</button></form><div class="cay-not"></div></div>';
      var d = function () { if (A.ses) A.ses(w, .85); }; s.querySelector('[data-d]').onclick = d; d();
      var inp = s.querySelector('input'); inp.focus({ preventScroll: true });
      s.querySelector('form').onsubmit = function (e) {
        e.preventDefault(); var ok = inp.value.trim().toLowerCase() === w; if (ok) dogru++; else oyunYanlis(w); inp.disabled = true;
        s.querySelector('.cay-not').innerHTML = (ok ? '<b class="ok">✓</b> ' : '<b class="yok">✗</b> ') + '<span lang="en">' + esc(w) + '</span> · ' + esc(bilgi(w).tr); if (A.sesCal) A.sesCal(ok ? 'dogru' : 'yanlis');
        i++; setTimeout(goster, 1300);
      };
    }
    goster();
  }

  /* ---------- kelime bahçesi ---------- */
  var BITKI = {
    tohum: '<ellipse cx="0" cy="-3" rx="4" ry="2.6" fill="#8A5F36"/>',
    filiz: '<path d="M0 0 V-12" stroke="#2C7A4B" stroke-width="2.2"/><path d="M0 -9 q-7 -2 -7 -8 q6 1 7 8 M0 -11 q6 -3 7 -8 q-6 0 -7 8" fill="#5FB36B" stroke="#2C7A4B" stroke-width="1"/>',
    yaprak: '<path d="M0 0 V-20" stroke="#2C7A4B" stroke-width="2.4"/><path d="M0 -8 q-10 -1 -11 -9 q9 0 11 9 M0 -13 q10 -2 11 -10 q-9 0 -11 10 M0 -19 q-6 -4 -5 -10 q5 3 5 10" fill="#3E9A55" stroke="#22603B" stroke-width="1"/>',
    cicek: '<path d="M0 0 V-20" stroke="#2C7A4B" stroke-width="2.4"/><path d="M0 -8 q-9 -1 -10 -8 q8 0 10 8" fill="#3E9A55" stroke="#22603B" stroke-width="1"/><g transform="translate(0 -24)">' + [0, 72, 144, 216, 288].map(function (a) { return '<ellipse rx="3.6" ry="6" transform="rotate(' + a + ') translate(0 -5)" fill="var(--ck)" stroke="#1A2A5C" stroke-width=".8"/>'; }).join('') + '<circle r="3" fill="#FFD86B" stroke="#1A2A5C" stroke-width=".8"/></g>'
  };
  var RENK = { A1: '#FFB3A8', A2: '#FFD0C2', B1: '#C9B6FF', B2: '#8EC5FF', C1: '#F7A6D8', C2: '#FFE57A', '': '#FFFFFF' };
  function bahceCiz(g) {
    klavye = null;
    var ks = Object.keys(st.kart).sort(function (a, b) { return st.kart[a].ek - st.kart[b].ek; }), say = { tohum: 0, filiz: 0, yaprak: 0, cicek: 0 };
    ks.forEach(function (w) { say[evre(st.kart[w])]++; });
    var son = ks.slice(-160), sut = 16, satir = Math.max(3, Math.ceil(son.length / sut)), Wd = sut * 34 + 20, Hd = satir * 40 + 26;
    var bitkiler = son.map(function (w, j) {
      var x = 20 + (j % sut) * 34 + (Math.floor(j / sut) % 2) * 10, y = 40 + Math.floor(j / sut) * 40, e = evre(st.kart[w]), b = bilgi(w) || {};
      return '<g transform="translate(' + x + ' ' + y + ')"><g class="bitki ' + e + (buyuyen[w] ? ' buyudu' : '') + '" style="--ck:' + (RENK[b.sev || ''] || '#fff') + ';--i:' + (j % 24) + '"><title>' + esc(w) + ' — ' + esc(b.tr || '') + ' (' + ({ tohum: 'tohum', filiz: 'filiz', yaprak: 'yaprak', cicek: 'çiçek' })[e] + ')</title>' + BITKI[e] + '</g></g>';
    }).join('');
    var sira = [];
    for (var r = 0; r < satir; r++) sira.push('<path d="M6 ' + (42 + r * 40) + ' H' + (Wd - 6) + '" stroke="#8A5F36" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>');
    g.innerHTML = '<div class="kel-bahce"><div class="kel-sayac">' + [['tohum', 'tohum', 'henüz başlamadın'], ['filiz', 'filiz', 'öğreniyorsun'], ['yaprak', 'yaprak', 'oturuyor'], ['cicek', 'çiçek', '3 hafta ve üstü']].map(function (x) { return '<div class="' + x[0] + '"><svg viewBox="-12 -32 24 34" aria-hidden="true">' + BITKI[x[0]].replace(/var\(--ck\)/g, '#C9B6FF') + '</svg><b>' + say[x[0]] + '</b><span>' + x[1] + '</span><small>' + x[2] + '</small></div>'; }).join('') + '</div>' +
      (ks.length ? '<svg class="kel-tarla" viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Kelime bahçesi: ' + ks.length + ' kelime">' + sira.join('') + bitkiler + '</svg><p class="say">Her bitki bir kelime; üstüne gel, adını gör. Çiçeklerin rengi seviyesini gösterir.</p>' : '<p class="say">Bahçe boş. Bugün sekmesinde ilk kartlarını çalış; her kelime bir tohum olarak düşer.</p>') + '</div>';
  }

  W.KELIME = { kur: kur, hesapla: hesapla, testSonuc: testSonuc, evre: evre, BANKA: BANKA, aralikYazi: aralikYazi };
})();
