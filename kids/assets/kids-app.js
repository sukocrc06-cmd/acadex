/* ==========================================================================
   ACADEX KIDS · çocuk uygulaması (kids/assets/kids-app.js), 10.11.2026
   Akış: okul kodu → sınıf → "sen hangisisin?" → resimli şifre → gökyüzü haritası → konu.
   Konu (Colours) altı duraktan oluşur: İzle, Dokun, Balon, Hafıza, Boyama, Söyle.
   Gerçek okullar Acadex yönetim panelinden gelir (kids-bulut.js → Supabase): giriş sunucuda
   doğrulanır, ilerleme hem bu tarayıcıda hem çocuğun kaydında tutulur, günün konusunu
   öğretmen seçer. Örnek okul (ORNEK-2026) tanıtım içindir; sunucuya gitmez.
   Ses kaydı cihazdan çıkmaz; çocuk kendi sesini dinler, puanlanmaz.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, V = W.KIDS_VERI, SES = W.KIDS_SES, OYUN = W.KIDS_OYUN, B = W.KIDS_BULUT;
  var app, S = { okul: null, sinif: null, ogr: null, token: null, bugun: undefined }, aktif = null, basla = Date.now(), molaVerildi = false;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function al(k, v) { try { var x = localStorage.getItem('kids.' + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } }
  function koy(k, v) { if (v && k.indexOf('il.') === 0) v.guncel = Date.now(); try { localStorage.setItem('kids.' + k, JSON.stringify(v)); } catch (e) { } if (S.token && v && k.indexOf('il.') === 0) B.ilerlemeKoy(S.token, v); }
  function bulutMu() { return !!(S.okul && S.okul.bulut); }
  function yukleniyor(metin) { ciz('<section class="ka-giris"><div class="ka-kart">' + balon(metin || 'Bir saniye…') + '<div class="ka-yukle" aria-hidden="true"><i></i><i></i><i></i></div></div></section>', 'giris'); }
  function ilAnahtar() { return 'il.' + S.okul.kod + '.' + S.sinif.id + '.' + (S.ogr[2] || S.ogr[0]); }
  function ilerleme() { var x = al(ilAnahtar(), null) || {}; x.yildiz = x.yildiz || {}; x.cikartma = x.cikartma || []; x.bitti = x.bitti || {}; x.zor = x.zor || {}; return x; }
  function toplamYildiz(il) { var n = 0; Object.keys(il.yildiz).forEach(function (k) { Object.keys(il.yildiz[k]).forEach(function (o) { n += il.yildiz[k][o]; }); }); return n; }
  function bant() { return V.BANT[S.sinif.bant]; }
  function renkler() { return V.RENK.slice(0, bant().renkSay); }
  function dur() { if (aktif && aktif.dur) aktif.dur(); aktif = null; SES.sus(); }
  function ciz(html, gorunum) { dur(); app.dataset.gorunum = gorunum; app.innerHTML = html; W.scrollTo(0, 0); var o = app.querySelector('[data-odak]'); if (o) try { o.focus({ preventScroll: true }); } catch (e) { } }
  function acd(mood, pose) { return C.acadia({ mood: mood, pose: pose }); }
  function balon(metin) { return '<div class="ka-acd">' + acd('mutlu') + '<p class="ka-balon">' + metin + '</p></div>'; }
  function ustGeri(h) { return '<button type="button" class="ka-yuvarlak" data-geri aria-label="Geri">' + C.simge('geri') + '</button>' + (h || ''); }

  /* ======================= giriş ======================= */
  function girisKod(hata) {
    ciz('<section class="ka-giris"><div class="ka-kart">' + balon('Merhaba! Ben <b>Acadia</b>. Okul kodunu yazar mısın?') +
      '<form data-f novalidate><label class="ka-gizli" for="ka-kod">Okul kodu</label><input id="ka-kod" class="ka-girdi" data-odak autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="AY-2026" value="' + esc(al('sonKod', '')) + '">' +
      '<p class="ka-uyari" role="alert">' + (hata || '') + '</p><button type="submit" class="ka-buyuk">Devam ' + C.simge('oynat') + '</button></form>' +
      '<p class="ka-ornek">Okul kodu, okulunun verdiği kartın altında yazar. Denemek için örnek okul: <button type="button" data-ornek>' + B.ORNEK_KOD + '</button></p><p class="ka-donus"><a href="#">← Tanıtım sayfası</a> · <a href="#ogretmen">Öğretmen girişi</a></p></div></section>', 'giris');
    var f = app.querySelector('[data-f]'), inp = f.querySelector('input');
    app.querySelector('[data-ornek]').addEventListener('click', function () { inp.value = V.OKUL.kod; SES.fx('dokun'); inp.focus(); });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var k = inp.value.trim().toLocaleUpperCase('tr').replace(/\s+/g, '').replace(/İ/g, 'I');
      if (!k) return girisKod('Okul kodunu yazar mısın?');
      if (k === V.OKUL.kod) { S.okul = V.OKUL; koy('sonKod', k); SES.fx('dogru'); return girisSinif(); }
      yukleniyor('Okulunu arıyorum…');
      B.okulBul(k).then(function (o) {
        if (!o.siniflar.length) return girisKod('Okulunda henüz sınıf yok. Öğretmenine haber verir misin?');
        S.okul = o; koy('sonKod', k); SES.fx('dogru'); girisSinif();
      }, function (er) { SES.fx('yanlis'); girisKod(er.tur === 'yok' ? 'Bu kodu bulamadım. Okulun verdiği karttaki koda bakar mısın?' : er.message); });
    });
  }
  function girisSinif() {
    ciz('<section class="ka-giris"><div class="ka-kart ka-genis"><div class="ka-ust">' + ustGeri('<span class="ka-okul">' + esc(S.okul.ad) + '</span>') + '</div>' + balon('Hangi sınıftasın?') +
      '<div class="ka-siniflar">' + S.okul.siniflar.map(function (s, i) { var b = V.BANT[s.bant]; return '<button type="button" class="ka-sinif" data-sinif="' + i + '" style="--r:' + s.renk + '"' + (i === 0 ? ' data-odak' : '') + '><b>' + esc(s.ad) + '</b><span>' + esc(b.ad) + ' · ' + esc(b.yas) + '</span></button>'; }).join('') + '</div></div></section>', 'giris');
    app.querySelector('[data-geri]').addEventListener('click', function () { girisKod(); });
    app.querySelectorAll('[data-sinif]').forEach(function (b) { b.addEventListener('click', function () { S.sinif = S.okul.siniflar[+b.getAttribute('data-sinif')]; SES.fx('dokun'); girisKim(); }); });
    SES.soyle('Hangi sınıftasın?', 'tr');
  }
  function girisKim() {
    if (!S.sinif.ogr.length) { ciz('<section class="ka-giris"><div class="ka-kart">' + '<div class="ka-ust">' + ustGeri('<span class="ka-okul">' + esc(S.sinif.ad) + '</span>') + '</div>' + balon('Bu sınıfta henüz kimse yok. Öğretmenine haber verir misin?') + '</div></section>', 'giris'); app.querySelector('[data-geri]').addEventListener('click', girisSinif); return; }
    ciz('<section class="ka-giris"><div class="ka-kart ka-genis"><div class="ka-ust">' + ustGeri('<span class="ka-okul">' + esc(S.sinif.ad) + '</span>') + '</div>' + balon('Sen hangisisin? Resmine dokun.') +
      '<div class="ka-kimler">' + S.sinif.ogr.map(function (o, i) { return '<button type="button" class="ka-kim" data-ogr="' + i + '"' + (i === 0 ? ' data-odak' : '') + '>' + C.avatar(o[1]) + '<b>' + esc(o[0]) + '</b></button>'; }).join('') + '</div></div></section>', 'giris');
    app.querySelector('[data-geri]').addEventListener('click', girisSinif);
    app.querySelectorAll('[data-ogr]').forEach(function (b) { b.addEventListener('click', function () { S.ogr = S.sinif.ogr[+b.getAttribute('data-ogr')]; SES.fx('dokun'); girisSifre(); }); });
    SES.soyle('Sen hangisisin? Resmine dokun.', 'tr');
  }
  function girisSifre() {
    var sec = [];
    ciz('<section class="ka-giris"><div class="ka-kart ka-genis"><div class="ka-ust">' + ustGeri('<span class="ka-okul ka-ben">' + C.avatar(S.ogr[1]) + esc(S.ogr[0]) + '</span>') + '</div>' + balon('Gizli iki resmine sırayla dokun.') +
      '<div class="ka-yuva" data-yuva aria-live="polite"><span></span><span></span></div>' +
      '<div class="ka-sifre">' + V.SIFRE_RESIM.map(function (r, i) { return '<button type="button" data-res="' + r + '" aria-label="' + r + '"' + (i === 0 ? ' data-odak' : '') + '>' + C.simge(r) + '</button>'; }).join('') + '</div>' +
      '<p class="ka-uyari" data-uyari role="alert"></p>' + (bulutMu() ? '<p class="ka-ornek">Gizli resimlerin, okulunun verdiği kartta yazar.</p>' : '<p class="ka-ornek">Örnek okulda herkesin gizli resimleri: önce <b>kedi</b>, sonra <b>elma</b>.</p>') + '</div></section>', 'giris');
    var yuva = app.querySelector('[data-yuva]');
    app.querySelector('[data-geri]').addEventListener('click', girisKim);
    app.querySelectorAll('[data-res]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (sec.length >= 2) return; sec.push(b.getAttribute('data-res')); SES.fx('dokun');
        yuva.children[sec.length - 1].innerHTML = C.simge(sec[sec.length - 1]); yuva.children[sec.length - 1].classList.add('ka-dolu');
        if (sec.length < 2) return;
        var yanlis = function (mesaj) { SES.fx('yanlis'); yuva.classList.add('ko-salla'); if (mesaj) { app.querySelector('[data-uyari]').textContent = mesaj; SES.soyle(mesaj, 'tr'); } setTimeout(function () { sec = []; yuva.classList.remove('ko-salla'); yuva.innerHTML = '<span></span><span></span>'; }, 700); };
        if (!bulutMu()) {
          if (sec[0] === S.okul.sifre[0] && sec[1] === S.okul.sifre[1]) { SES.fx('yildiz'); koy('oturum', { kod: S.okul.kod, sinif: S.sinif.id, ogr: S.ogr[0] }); setTimeout(panel, 500); }
          else yanlis();
          return;
        }
        var deneme = sec.slice();
        B.giris(S.ogr[2], deneme).then(function (r) {
          if (!r.tamam) return yanlis(r.kilit ? 'Biraz dinlenelim; birkaç dakika sonra yeniden dene.' : '');
          S.token = r.token; koy('oturum', { kod: S.okul.kod, token: r.token }); SES.fx('yildiz');
          setTimeout(function () { bulutAc(r.token); }, 400);
        }, function (er) { yanlis(er.message); });
      });
    });
    SES.soyle('Gizli iki resmine sırayla dokun.', 'tr');
  }

  /* ======================= harita (çocuk paneli) ======================= */
  function ustCubuk(il) {
    return '<header class="ka-cubuk"><span class="ka-ben">' + C.avatar(S.ogr[1]) + '<b>' + esc(S.ogr[0]) + '</b><small>' + esc(S.sinif.ad) + '</small></span>' +
      '<span class="ka-sayac" aria-label="' + toplamYildiz(il) + ' yıldız">' + C.simge('yildiz') + '<b>' + toplamYildiz(il) + '</b></span>' +
      '<button type="button" class="ka-yuvarlak" data-album aria-label="Çıkartma albümü">' + C.simge('album') + '</button>' +
      '<button type="button" class="ka-yuvarlak" data-ses aria-pressed="' + SES.acikMi() + '" aria-label="Ses">' + C.simge('ses') + '</button>' +
      '<button type="button" class="ka-cikis" data-cikis>Çıkış</button></header>';
  }
  function panel() {
    var il = ilerleme(), bk = V.konuBul(bulutMu() ? (S.bugun || '') : V.gunKonu(S.sinif.id)), bugun = bk && bk.acik ? bk : null, bid = bugun ? bugun.id : '';
    il.son = Date.now(); koy(ilAnahtar(), il);   /* öğretmen panelindeki "son giriş" */
    ciz(ustCubuk(il) +
      (bugun ? '<section class="ka-bugun"><div class="ka-bugun-acd">' + acd('kutlama') + '</div><div class="ka-bugun-yazi"><small>Bugünün konusu</small><h1><span lang="en">' + esc(bugun.en) + '</span> <em>' + esc(bugun.tr) + '</em></h1><p>Bugün okulda bunu öğrendin! Hadi oynayarak tekrar edelim.</p></div>' +
        '<button type="button" class="ka-buyuk ka-oyna" data-konu="' + bugun.id + '" data-odak>Oyna ' + C.simge('oynat') + '</button></section>'
        : '<section class="ka-bugun ka-serbest"><div class="ka-bugun-acd">' + acd('mutlu') + '</div><div class="ka-bugun-yazi"><small>Serbest gün</small><h1>İstediğin adaya uç!</h1><p>Bugün için seçilmiş bir konu yok. Açık adalardan birine dokun.</p></div></section>') +
      '<section class="ka-harita" aria-label="Konular"><div class="ka-bulutlar" aria-hidden="true">' + C.bulut('ka-b1') + C.bulut('ka-b2') + C.bulut('ka-b3') + '</div><ol class="ka-adalar">' +
      V.KONU.map(function (k, i) {
        var y = il.yildiz[k.id] || {}, n = Object.keys(y).reduce(function (t, o) { return t + y[o]; }, 0), bitti = !!il.bitti[k.id];
        return '<li style="--i:' + i + '"><button type="button" class="ka-ada' + (k.acik ? '' : ' ka-kilitli') + (k.id === bid ? ' ka-ada-bugun' : '') + '" ' + (k.acik ? 'data-konu="' + k.id + '"' : 'data-yakinda') + ' aria-label="' + esc(k.en + ', ' + k.tr + (k.acik ? '' : ', yakında')) + '">' +
          C.ada(k.renk, k.simge, !k.acik) + '<span class="ka-ada-ad"><b lang="en">' + esc(k.en) + '</b><small>' + esc(k.tr) + '</small></span>' +
          (k.acik ? '<span class="ka-ada-y">' + (bitti ? '✓ ' : '') + n + '/9 ★</span>' : '<span class="ka-ada-y ka-yakinda">Yakında</span>') + '</button></li>';
      }).join('') + '</ol></section>', 'harita');
    app.querySelectorAll('[data-konu]').forEach(function (b) { b.addEventListener('click', function () { SES.fx('dokun'); konuAc(b.getAttribute('data-konu'), 0); }); });
    app.querySelectorAll('[data-yakinda]').forEach(function (b) { b.addEventListener('click', function () { SES.fx('yanlis'); b.classList.remove('ko-salla'); void b.offsetWidth; b.classList.add('ko-salla'); SES.soyle('Bu ada yakında açılacak.', 'tr'); }); });
    cubukKur(panel);
    SES.soyle(bugun ? 'Bugünün konusu ' + bugun.tr.toLocaleLowerCase('tr') + '. Hadi oynayalım!' : 'Bugün serbest gün. İstediğin adaya dokun.', 'tr');
  }
  function cubukKur(yeniden) {
    var s = app.querySelector('[data-ses]'); if (s) s.addEventListener('click', function () { var a = SES.ayar(!SES.acikMi()); s.setAttribute('aria-pressed', a); if (a) SES.fx('dogru'); });
    var a = app.querySelector('[data-album]'); if (a) a.addEventListener('click', album);
    var c = app.querySelector('[data-cikis]'); if (c) c.addEventListener('click', function () { veliKapisi(function () { if (S.token) B.cikis(S.token); koy('oturum', null); S.sinif = null; S.ogr = null; S.token = null; girisKod(); }); });
  }

  /* ---------- katmanlar: albüm, veli kapısı, mola ---------- */
  function katman(ic, cls) {
    var o = D.createElement('div'); o.className = 'ka-ort ' + (cls || ''); o.innerHTML = '<div class="ka-pen" role="dialog" aria-modal="true" tabindex="-1">' + ic + '</div>'; D.body.appendChild(o);
    var once = D.activeElement, kapa = function () { o.remove(); D.removeEventListener('keydown', esc2); if (once && once.focus) try { once.focus(); } catch (e) { } };
    function esc2(e) { if (e.key === 'Escape') kapa(); }
    D.addEventListener('keydown', esc2); o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('[data-kapat]')) kapa(); });
    setTimeout(function () { var f = o.querySelector('[data-odak]') || o.querySelector('.ka-pen'); f.focus(); }, 30);
    return { el: o, kapat: kapa };
  }
  var CIKARTMA = { colours: ['gokkusagi', 'firca', 'yildiz'] };
  function album() {
    var il = ilerleme(), tum = []; V.KONU.forEach(function (k) { (CIKARTMA[k.id] || [null, null, null]).forEach(function (c) { tum.push({ k: k, c: c }); }); });
    SES.fx('dokun');
    katman('<header class="ka-pen-bas"><h2>Çıkartma albümüm</h2><button type="button" class="ka-yuvarlak" data-kapat data-odak aria-label="Kapat">×</button></header>' +
      '<p class="ka-pen-alt">' + il.cikartma.length + ' çıkartma topladın. Her konuyu bitirince yenileri gelir.</p><ul class="ka-album">' +
      tum.slice(0, 18).map(function (x) { var var_ = x.c && il.cikartma.indexOf(x.c) > -1; return '<li class="' + (var_ ? 'ka-var' : '') + '" style="--r:' + x.k.renk + '">' + (var_ ? C.simge(x.c) : '<i>?</i>') + '</li>'; }).join('') + '</ul>', 'ka-albumk');
  }
  function veliKapisi(tamam) {
    var a = 3 + Math.floor(Math.random() * 5), b = 2 + Math.floor(Math.random() * 5);
    var k = katman('<header class="ka-pen-bas"><h2>Büyükler için</h2><button type="button" class="ka-yuvarlak" data-kapat aria-label="Kapat">×</button></header>' +
      '<form data-vf><p class="ka-pen-alt">Çıkış yapmak için işlemi çöz: <b>' + a + ' + ' + b + ' = ?</b></p><label class="ka-gizli" for="ka-vk">Cevap</label><input id="ka-vk" class="ka-girdi" inputmode="numeric" maxlength="2" data-odak autocomplete="off"><p class="ka-uyari" role="alert"></p><button type="submit" class="ka-buyuk">Çıkış yap</button></form>');
    k.el.querySelector('[data-vf]').addEventListener('submit', function (e) { e.preventDefault(); if (+k.el.querySelector('input').value === a + b) { k.kapat(); tamam(); } else k.el.querySelector('.ka-uyari').textContent = 'Olmadı, yeniden dene.'; });
  }
  function molaBak() {
    if (molaVerildi || Date.now() - basla < 15 * 60 * 1000) return false;
    molaVerildi = true;
    katman('<div class="ka-mola"><div class="ka-mola-acd">' + acd('uyku') + '</div><h2>Mola zamanı!</h2><p>Bugün çok güzel çalıştın. Gözlerini dinlendir, biraz su iç. Yarın yine buradayım.</p><button type="button" class="ka-buyuk" data-kapat data-odak>Tamam</button></div>');
    SES.soyle('Mola zamanı! Bugün çok güzel çalıştın.', 'tr'); return true;
  }

  /* ======================= konu: Colours ======================= */
  var DURAK = [
    { id: 'izle', ad: 'İzle', simge: 'oynat' }, { id: 'dokun', ad: 'Dokun', simge: 'ses' }, { id: 'balon', ad: 'Balon', simge: 'top', oyun: 1 },
    { id: 'hafiza', ad: 'Hafıza', simge: 'yildiz', oyun: 1 }, { id: 'boyama', ad: 'Boyama', simge: 'firca', oyun: 1 }, { id: 'soyle', ad: 'Söyle', simge: 'mikrofon' }
  ];
  function konuUst(n) {
    return '<header class="ka-konu-ust"><button type="button" class="ka-yuvarlak" data-eve aria-label="Haritaya dön">' + C.simge('ev') + '</button>' +
      '<ol class="ka-duraklar">' + DURAK.map(function (d, i) { return '<li class="' + (i < n ? 'ka-gecti' : i === n ? 'ka-simdi' : '') + '"' + (i === n ? ' aria-current="step"' : '') + '><span>' + C.simge(i < n ? 'tik' : d.simge) + '</span><small>' + d.ad + '</small></li>'; }).join('') + '</ol>' +
      '<button type="button" class="ka-yuvarlak" data-ses aria-pressed="' + SES.acikMi() + '" aria-label="Ses">' + C.simge('ses') + '</button></header>';
  }
  function konuAc(kid, n) {
    if (n >= DURAK.length) return konuBitti(kid);
    var d = DURAK[n];
    ciz(konuUst(n) + '<main class="ka-sahne ka-s-' + d.id + '" data-sahne></main>', 'konu');
    app.querySelector('[data-eve]').addEventListener('click', function () { SES.fx('dokun'); panel(); });
    cubukKur();
    var sahne = app.querySelector('[data-sahne]'), ileri = function () { konuAc(kid, n + 1); molaBak(); };
    if (d.id === 'izle') aktif = izle(sahne, ileri);
    else if (d.id === 'dokun') aktif = dokunDinle(sahne, ileri);
    else if (d.id === 'soyle') aktif = soyle(sahne, ileri);
    else aktif = OYUN[d.id](sahne, { renkler: renkler(), bant: bant(), bitti: function (y) { araEkran(kid, d, y, ileri); }, yanlis: function (kelime) { var il = ilerleme(); il.zor[kelime] = (il.zor[kelime] || 0) + 1; koy(ilAnahtar(), il); } });
  }
  function ileriDugme(etiket) { return '<button type="button" class="ka-buyuk ka-ileri" data-ileri>' + (etiket || 'Devam') + ' ' + C.simge('oynat') + '</button>'; }

  /* 1. İzle: Acadia renkleri tek tek tanıtır */
  function izle(sahne, ileri) {
    var rs = renklerIzle(), iptal = false;
    sahne.innerHTML = '<div class="ka-izle"><div class="ka-izle-acd" data-acd>' + acd('mutlu', 'isaret') + '</div><div class="ka-izle-tuval"><div class="ka-izle-leke" data-leke></div><p class="ka-kelime" data-kelime lang="en"></p></div>' +
      '<div class="ka-izle-sira" data-sira>' + rs.map(function (r) { return '<i style="--r:' + r.hex + '"></i>'; }).join('') + '</div><div class="ka-izle-alt" data-alt hidden><button type="button" class="ka-orta" data-yeniden>Bir daha izle</button>' + ileriDugme('Dokunmaya geç') + '</div></div>';
    var leke = sahne.querySelector('[data-leke]'), kel = sahne.querySelector('[data-kelime]'), sira = sahne.querySelector('[data-sira]'), alt = sahne.querySelector('[data-alt]');
    function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    async function oyna() {
      alt.hidden = true; [].forEach.call(sira.children, function (x) { x.classList.remove('ka-yandi'); });
      await SES.soyle('Let\'s learn colours!', 'en');
      for (var i = 0; i < rs.length; i++) {
        if (iptal) return; var r = rs[i];
        leke.innerHTML = C.leke(r.hex); leke.classList.remove('ka-sicra'); void leke.offsetWidth; leke.classList.add('ka-sicra');
        kel.textContent = bant().yazi ? r.en : ''; kel.style.setProperty('--r', r.hex); sira.children[i].classList.add('ka-yandi'); SES.fx('pat');
        await SES.soyle(r.en + '.', 'en'); if (iptal) return; await bekle(350);
        await SES.soyle('It\'s ' + r.en + '!', 'en'); if (iptal) return; await bekle(500);
      }
      sahne.querySelector('[data-acd]').innerHTML = acd('kutlama'); alt.hidden = false; SES.fx('dogru');
      var b = alt.querySelector('[data-ileri]'); if (b) b.focus({ preventScroll: true });
    }
    sahne.querySelector('[data-yeniden]').addEventListener('click', function () { sahne.querySelector('[data-acd]').innerHTML = acd('mutlu', 'isaret'); oyna(); });
    sahne.querySelector('[data-ileri]').addEventListener('click', function () { SES.fx('dokun'); ileri(); });
    oyna();
    return { dur: function () { iptal = true; SES.sus(); } };
  }
  function renklerIzle() { return renkler(); }

  /* 2. Dokun: her lekeye dokun, adını dinle */
  function dokunDinle(sahne, ileri) {
    var rs = renkler(), gor = {};
    sahne.innerHTML = '<div class="ka-dokun"><p class="ka-yon">' + C.simge('ses') + ' Renklere dokun ve dinle.</p><div class="ka-lekeler ka-l' + rs.length + '">' +
      rs.map(function (r) { return '<button type="button" class="ka-lekeb" data-r="' + r.id + '" aria-label="' + r.en + '">' + C.leke(r.hex) + (bant().yazi ? '<b lang="en">' + r.en + '</b>' : '') + '<i class="ka-tik">' + C.simge('tik') + '</i></button>'; }).join('') + '</div>' +
      '<div class="ka-izle-alt" data-alt hidden>' + ileriDugme('Oyuna geç') + '</div></div>';
    sahne.querySelectorAll('[data-r]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = rs.filter(function (x) { return x.id === b.getAttribute('data-r'); })[0];
        SES.fx('dokun'); b.classList.remove('ka-zipla'); void b.offsetWidth; b.classList.add('ka-zipla', 'ka-duyuldu'); SES.soyle(r.en, 'en'); gor[r.id] = 1;
        if (Object.keys(gor).length === rs.length) { sahne.querySelector('[data-alt]').hidden = false; }
      });
    });
    sahne.querySelector('[data-ileri]').addEventListener('click', function () { SES.fx('dokun'); ileri(); });
    SES.soyle('Renklere dokun ve dinle.', 'tr');
    return { dur: function () { SES.sus(); } };
  }

  /* oyun sonrası ara ekran: yıldızlar */
  function araEkran(kid, d, y, ileri) {
    var il = ilerleme(); il.yildiz[kid] = il.yildiz[kid] || {}; il.yildiz[kid][d.id] = Math.max(il.yildiz[kid][d.id] || 0, y); koy(ilAnahtar(), il);
    var sahne = app.querySelector('[data-sahne]'); dur();
    sahne.innerHTML = '<div class="ka-ara"><div class="ka-ara-acd">' + acd('kutlama') + '</div><h2 lang="en">' + ['Good try!', 'Well done!', 'Super!'][y - 1] + '</h2>' +
      '<div class="ka-yildizlar" role="img" aria-label="' + y + ' yıldız">' + [1, 2, 3].map(function (i) { return '<span class="' + (i <= y ? 'ka-kazan' : '') + '" style="--i:' + i + '">' + C.simge('yildiz') + '</span>'; }).join('') + '</div>' +
      '<div class="ka-izle-alt"><button type="button" class="ka-orta" data-tekrar>Bir daha oyna</button>' + ileriDugme() + '</div></div>';
    SES.fx('yildiz'); SES.soyle(['Good try!', 'Well done!', 'Super!'][y - 1], 'en');
    sahne.querySelector('[data-tekrar]').addEventListener('click', function () { SES.fx('dokun'); konuAc(kid, DURAK.indexOf(d)); });
    var b = sahne.querySelector('[data-ileri]'); b.addEventListener('click', function () { SES.fx('dokun'); ileri(); }); b.focus({ preventScroll: true });
  }

  /* 6. Söyle: çocuk söyler, kendi sesini dinler (kayıt cihazda kalır, puan yok) */
  function soyle(sahne, ileri) {
    var rs = OYUN.kar(renkler()).slice(0, 3), i = 0, kayit = null, akis = null, url = null, iptal = false;
    function temizle() { try { if (kayit && kayit.state !== 'inactive') kayit.stop(); } catch (e) { } try { if (akis) akis.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { } akis = null; if (url) { URL.revokeObjectURL(url); url = null; } }
    function goster() {
      if (i >= rs.length) { temizle(); return ileri(); }
      var r = rs[i];
      sahne.innerHTML = '<div class="ka-soyle"><p class="ka-yon">' + C.simge('mikrofon') + ' Dinle, sonra sen söyle.</p><div class="ka-soyle-leke">' + C.leke(r.hex) + '</div>' + (bant().yazi ? '<p class="ka-kelime" lang="en" style="--r:' + r.hex + '">' + r.en + '</p>' : '') +
        '<div class="ka-soyle-dugme"><button type="button" class="ka-yuvarlak ka-iri" data-dinle aria-label="Dinle">' + C.simge('ses') + '</button><button type="button" class="ka-yuvarlak ka-iri ka-mik" data-mik aria-label="Söyle (mikrofon)">' + C.simge('mikrofon') + '</button></div>' +
        '<p class="ka-durum" data-durum aria-live="polite"></p><div class="ka-izle-alt"><button type="button" class="ka-buyuk" data-soyledim>Söyledim! ' + C.simge('oynat') + '</button></div>' +
        '<p class="ka-gizlilik">Ses kaydı yalnız bu cihazda çalınır, hiçbir yere gönderilmez.</p></div>';
      var durum = sahne.querySelector('[data-durum]'), mik = sahne.querySelector('[data-mik]');
      sahne.querySelector('[data-dinle]').addEventListener('click', function () { SES.fx('dokun'); SES.soyle(r.en, 'en'); });
      sahne.querySelector('[data-soyledim]').addEventListener('click', function () { SES.fx('dogru'); i++; goster(); });
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && W.MediaRecorder)) mik.hidden = true;
      mik.addEventListener('click', async function () {
        if (mik.disabled) return; mik.disabled = true; SES.sus();
        try {
          akis = akis || await navigator.mediaDevices.getUserMedia({ audio: true }); if (iptal) return temizle();
          var parca = []; kayit = new W.MediaRecorder(akis); kayit.ondataavailable = function (e) { if (e.data && e.data.size) parca.push(e.data); };
          kayit.onstop = function () {
            if (iptal) return; mik.classList.remove('ka-kayit'); mik.disabled = false; if (url) URL.revokeObjectURL(url);
            url = URL.createObjectURL(new Blob(parca, { type: kayit.mimeType || 'audio/webm' })); durum.textContent = 'İşte senin sesin!';
            var a = new Audio(url); a.play().catch(function () { });
          };
          mik.classList.add('ka-kayit'); durum.textContent = 'Şimdi söyle…'; kayit.start(); setTimeout(function () { try { if (kayit.state !== 'inactive') kayit.stop(); } catch (e) { } }, 2600);
        } catch (e) { mik.hidden = true; durum.textContent = 'Mikrofon açılamadı. Sesli söyle, sonra “Söyledim!”e dokun.'; }
      });
      SES.soyle('Say: ' + r.en, 'en');
    }
    goster();
    return { dur: function () { iptal = true; temizle(); SES.sus(); } };
  }

  /* konu bitti: çıkartma */
  function konuBitti(kid) {
    var il = ilerleme(), yeni = (CIKARTMA[kid] || []).filter(function (c) { return il.cikartma.indexOf(c) < 0; }), y = il.yildiz[kid] || {}, n = Object.keys(y).reduce(function (t, o) { return t + y[o]; }, 0);
    var odul = yeni.slice(0, n >= 8 ? 3 : n >= 5 ? 2 : 1); il.cikartma = il.cikartma.concat(odul); il.bitti[kid] = Date.now(); koy(ilAnahtar(), il);
    var k = V.KONU.filter(function (x) { return x.id === kid; })[0];
    ciz('<main class="ka-sahne ka-bitis"><div class="ka-konfeti" aria-hidden="true">' + new Array(24).join('<i></i>') + '</div><div class="ka-ara-acd">' + acd('kutlama') + '</div><h1><span lang="en">' + esc(k.en) + '</span> tamam!</h1>' +
      '<p class="ka-bitis-y">' + C.simge('yildiz') + ' <b>' + n + '</b> / 9 yıldız</p>' +
      (odul.length ? '<p>Yeni çıkartmaların:</p><div class="ka-oduller">' + odul.map(function (c, i) { return '<span style="--i:' + i + '">' + C.simge(c) + '</span>'; }).join('') + '</div>' : '<p>Bütün çıkartmaları topladın. Daha çok yıldız için yeniden oynayabilirsin.</p>') +
      '<div class="ka-izle-alt"><button type="button" class="ka-orta" data-yine>Yeniden oyna</button><button type="button" class="ka-buyuk" data-harita data-odak>Haritaya dön ' + C.simge('ev') + '</button></div></main>', 'konu');
    SES.fx('yildiz'); SES.soyle('Great job! Colours, done!', 'en');
    app.querySelector('[data-harita]').addEventListener('click', function () { SES.fx('dokun'); panel(); });
    app.querySelector('[data-yine]').addEventListener('click', function () { SES.fx('dokun'); konuAc(kid, 0); });
  }

  function kur() {
    app = D.getElementById('kids-app'); if (!app) return;
    basla = Date.now(); molaVerildi = false;
    var o = al('oturum', null);
    if (o && o.token) return bulutAc(o.token);
    if (o && o.kod === V.OKUL.kod) {
      S.okul = V.OKUL; S.sinif = S.okul.siniflar.filter(function (s) { return s.id === o.sinif; })[0];
      S.ogr = S.sinif && S.sinif.ogr.filter(function (x) { return x[0] === o.ogr; })[0];
      if (S.sinif && S.ogr) return panel();
    }
    girisKod();
  }
  /* sunucudaki oturumla aç: çocuğun bilgisi, günün konusu, kayıtlı ilerleme */
  function bulutAc(token) {
    yukleniyor('Haritanı hazırlıyorum…');
    B.durum(token).then(function (d) {
      S.token = token; S.okul = { kod: d.okul.kod, ad: d.okul.ad, bulut: true };
      S.sinif = { id: d.sinif.id, ad: d.sinif.ad, bant: d.sinif.bant }; S.ogr = [d.ogr.ad, d.ogr.hayvan, d.ogr.id]; S.bugun = d.bugun;
      /* bu tarayıcıdaki kayıtla sunucudakini birleştir: hangisi daha yeniyse */
      var yerel = al(ilAnahtar(), null), uzak = d.ilerleme;
      if (uzak && (!yerel || (uzak.guncel || 0) > (yerel.guncel || 0))) { try { localStorage.setItem('kids.' + ilAnahtar(), JSON.stringify(uzak)); } catch (e) { } }
      else if (yerel && (!uzak || (yerel.guncel || 0) > (uzak.guncel || 0))) B.ilerlemeKoy(token, yerel);
      panel();
    }, function (er) {
      if (er.tur === 'ag') { ciz('<section class="ka-giris"><div class="ka-kart">' + balon(esc(er.message)) + '<button type="button" class="ka-buyuk" data-yine data-odak>Yeniden dene</button></div></section>', 'giris'); app.querySelector('[data-yine]').addEventListener('click', function () { bulutAc(token); }); return; }
      koy('oturum', null); S.token = null; girisKod(er.tur === 'lisans' ? er.message : '');
    });
  }
  /* tek sayfa: kids-yon.js #oyna'da ac(), başka görünüme geçerken kapat() çağırır */
  function kapatApp() { dur(); D.querySelectorAll('.ka-ort').forEach(function (o) { o.remove(); }); if (app) app.innerHTML = ''; }
  W.KIDS_APP = { ac: kur, kapat: kapatApp, panel: panel, konuAc: konuAc, durum: function () { return S; }, DURAK: DURAK };
})(window);
