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
  var D = W.document, C = W.KIDS_CIZ, V = W.KIDS_VERI, SES = W.KIDS_SES, OYUN = W.KIDS_OYUN, B = W.KIDS_BULUT, K = W.KIDS_KONU;
  var SAKIN = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var app, S = { okul: null, sinif: null, ogr: null, token: null, bugun: undefined, konu: 'colours', duraklar: null }, aktif = null, basla = Date.now(), molaVerildi = false;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function al(k, v) { try { var x = localStorage.getItem('kids.' + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } }
  function koy(k, v) { if (v && k.indexOf('il.') === 0) v.guncel = Date.now(); try { localStorage.setItem('kids.' + k, JSON.stringify(v)); } catch (e) { } if (S.token && v && k.indexOf('il.') === 0) B.ilerlemeKoy(S.token, v); }
  function bulutMu() { return !!(S.okul && S.okul.bulut); }
  function yukleniyor(metin) { ciz('<section class="ka-giris"><div class="ka-kart">' + balon(metin || 'Bir saniye…') + '<div class="ka-yukle" aria-hidden="true"><i></i><i></i><i></i></div></div></section>', 'giris'); }
  function ilAnahtar() { return 'il.' + S.okul.kod + '.' + S.sinif.id + '.' + (S.ogr[2] || S.ogr[0]); }
  function ilerleme() { var x = al(ilAnahtar(), null) || {}; x.yildiz = x.yildiz || {}; x.cikartma = x.cikartma || []; x.bitti = x.bitti || {}; x.zor = x.zor || {}; return x; }
  function toplamYildiz(il) { var n = 0; Object.keys(il.yildiz).forEach(function (k) { Object.keys(il.yildiz[k]).forEach(function (o) { n += il.yildiz[k][o]; }); }); return n; }
  function bant() { return V.BANT[S.sinif.bant]; }
  function paket() { return K.al(S.konu) || K.al('colours'); }
  function renkler() { return paket().ogeler(bant()); }
  function ben(il) { return C.avatarGiy(S.ogr[1], (il || ilerleme()).giysi); }
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
    return '<header class="ka-cubuk"><span class="ka-ben"><span class="ka-ben-av">' + ben(il) + '</span><b>' + esc(S.ogr[0]) + '</b><small>' + esc(S.sinif.ad) + '</small></span>' +
      '<span class="ka-sayac" aria-label="' + toplamYildiz(il) + ' yıldız">' + C.simge('yildiz') + '<b>' + toplamYildiz(il) + '</b></span>' +
      '<button type="button" class="ka-yuvarlak" data-album aria-label="Çıkartma albümü">' + C.simge('album') + '</button>' +
      '<button type="button" class="ka-yuvarlak" data-dolap aria-label="Dolabım">' + C.simge('dolap') + '</button>' +
      '<button type="button" class="ka-yuvarlak" data-ses aria-pressed="' + SES.acikMi() + '" aria-label="Ses">' + C.simge('ses') + '</button>' +
      '<button type="button" class="ka-cikis" data-veli aria-label="Veli köşesi">' + C.simge('veli') + '<span>Veli</span></button></header>';
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
    app.querySelectorAll('[data-konu]').forEach(function (b) { b.addEventListener('click', function () { var kid = b.getAttribute('data-konu'); SES.fx('dokun'); ucus(kid, function () { konuAc(kid, 0); }); }); });
    app.querySelectorAll('[data-yakinda]').forEach(function (b) { b.addEventListener('click', function () { SES.fx('yanlis'); b.classList.remove('ko-salla'); void b.offsetWidth; b.classList.add('ko-salla'); SES.soyle('Bu ada yakında açılacak.', 'tr'); }); });
    cubukKur(panel);
    SES.soyle(bugun ? 'Bugünün konusu ' + bugun.tr.toLocaleLowerCase('tr') + '. Hadi oynayalım!' : 'Bugün serbest gün. İstediğin adaya dokun.', 'tr');
  }
  function cubukKur(yeniden) {
    var s = app.querySelector('[data-ses]'); if (s) s.addEventListener('click', function () { var a = SES.ayar(!SES.acikMi()); s.setAttribute('aria-pressed', a); if (a) SES.fx('dogru'); });
    var a = app.querySelector('[data-album]'); if (a) a.addEventListener('click', album);
    var dl = app.querySelector('[data-dolap]'); if (dl) dl.addEventListener('click', dolap);
    var c = app.querySelector('[data-veli]'); if (c) c.addEventListener('click', function () { SES.fx('dokun'); veliKapisi(veliKosesi); });
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
  function cikartmalar(kid) { var p = K.al(kid); return p ? p.cikartma : null; }
  function album() {
    var il = ilerleme(), tum = []; V.KONU.forEach(function (k) { (cikartmalar(k.id) || [null, null, null]).forEach(function (c) { tum.push({ k: k, c: c }); }); });
    SES.fx('dokun');
    katman('<header class="ka-pen-bas"><h2>Çıkartma albümüm</h2><button type="button" class="ka-yuvarlak" data-kapat data-odak aria-label="Kapat">×</button></header>' +
      '<p class="ka-pen-alt">' + il.cikartma.length + ' çıkartma topladın. Her konuyu bitirince yenileri gelir.</p><ul class="ka-album">' +
      tum.slice(0, 18).map(function (x) { var var_ = x.c && il.cikartma.indexOf(x.c) > -1; return '<li class="' + (var_ ? 'ka-var' : '') + '" style="--r:' + x.k.renk + '">' + (var_ ? C.simge(x.c) : '<i>?</i>') + '</li>'; }).join('') + '</ul>', 'ka-albumk');
  }
  function veliKapisi(tamam) {
    var a = 3 + Math.floor(Math.random() * 5), b = 2 + Math.floor(Math.random() * 5);
    var k = katman('<header class="ka-pen-bas"><h2>Büyükler için</h2><button type="button" class="ka-yuvarlak" data-kapat aria-label="Kapat">×</button></header>' +
      '<form data-vf><p class="ka-pen-alt">Bu bölüm büyükler için. Devam etmek için işlemi çöz: <b>' + a + ' + ' + b + ' = ?</b></p><label class="ka-gizli" for="ka-vk">Cevap</label><input id="ka-vk" class="ka-girdi" inputmode="numeric" maxlength="2" data-odak autocomplete="off"><p class="ka-uyari" role="alert"></p><button type="submit" class="ka-buyuk">Devam</button></form>');
    k.el.querySelector('[data-vf]').addEventListener('submit', function (e) { e.preventDefault(); if (+k.el.querySelector('input').value === a + b) { k.kapat(); tamam(); } else k.el.querySelector('.ka-uyari').textContent = 'Olmadı, yeniden dene.'; });
  }
  function molaBak() {
    if (molaVerildi || Date.now() - basla < (+al('mola', 15) || 15) * 60 * 1000) return false;
    molaVerildi = true;
    katman('<div class="ka-mola"><div class="ka-mola-acd">' + acd('uyku') + '</div><h2>Mola zamanı!</h2><p>Bugün çok güzel çalıştın. Gözlerini dinlendir, biraz su iç. Yarın yine buradayım.</p><button type="button" class="ka-buyuk" data-kapat data-odak>Tamam</button></div>');
    SES.soyle('Mola zamanı! Bugün çok güzel çalıştın.', 'tr'); return true;
  }

  /* ======================= konu: Colours ======================= */
  /* her konu yedi durak: İzle, Şarkı, Dokun, iki ortak oyun, konuya özel üçüncü oyun, Söyle */
  function duraklar(kid) {
    var o3 = (K.al(kid) || K.al('colours')).oyun3;
    return [{ id: 'izle', ad: 'İzle', simge: 'oynat' }, { id: 'sarki', ad: 'Şarkı', simge: 'nota' }, { id: 'dokun', ad: 'Dokun', simge: 'ses' }, { id: 'balon', ad: 'Balon', simge: 'top', oyun: 1 },
      { id: 'hafiza', ad: 'Hafıza', simge: 'yildiz', oyun: 1 }, { id: o3.id, ad: o3.ad, simge: o3.simge, oyun: 1 }, { id: 'soyle', ad: 'Söyle', simge: 'mikrofon' }];
  }
  var DURAK = duraklar('colours');
  function konuUst(n) {
    return '<header class="ka-konu-ust"><button type="button" class="ka-yuvarlak" data-eve aria-label="Haritaya dön">' + C.simge('ev') + '</button>' +
      '<ol class="ka-duraklar">' + S.duraklar.map(function (d, i) { return '<li class="' + (i < n ? 'ka-gecti' : i === n ? 'ka-simdi' : '') + '"' + (i === n ? ' aria-current="step"' : '') + '><span>' + C.simge(i < n ? 'tik' : d.simge) + '</span><small>' + d.ad + '</small></li>'; }).join('') + '</ol>' +
      '<button type="button" class="ka-yuvarlak" data-ses aria-pressed="' + SES.acikMi() + '" aria-label="Ses">' + C.simge('ses') + '</button></header>';
  }
  function konuAc(kid, n) {
    S.konu = kid; S.duraklar = duraklar(kid);
    if (n >= S.duraklar.length) return konuBitti(kid);
    var d = S.duraklar[n];
    if (n === 0) { var il0 = ilerleme(); il0.gunler = il0.gunler || {}; il0.gunler[V.gunAnahtar()] = 1; il0.sonKonu = kid; var gk = Object.keys(il0.gunler).sort(); if (gk.length > 60) delete il0.gunler[gk[0]]; koy(ilAnahtar(), il0); }
    ciz(konuUst(n) + '<main class="ka-sahne ka-s-' + d.id + '" data-sahne></main>', 'konu');
    app.querySelector('[data-eve]').addEventListener('click', function () { SES.fx('dokun'); panel(); donus(kid); });
    cubukKur();
    var sahne = app.querySelector('[data-sahne]'), ileri = function () { konuAc(kid, n + 1); molaBak(); };
    if (d.id === 'izle') aktif = izle(sahne, ileri);
    else if (d.id === 'dokun') aktif = dokunDinle(sahne, ileri);
    else if (d.id === 'sarki') aktif = sarki(sahne, ileri);
    else if (d.id === 'soyle') aktif = soyle(sahne, ileri);
    else aktif = OYUN[d.id](sahne, { renkler: renkler(), bant: bant(), paket: paket(), bitti: function (y) { araEkran(kid, d, y, ileri); }, yanlis: function (kelime) { var il = ilerleme(); il.zor[kelime] = (il.zor[kelime] || 0) + 1; koy(ilAnahtar(), il); } });
  }
  function ileriDugme(etiket) { return '<button type="button" class="ka-buyuk ka-ileri" data-ileri>' + (etiket || 'Devam') + ' ' + C.simge('oynat') + '</button>'; }

  /* 1. İzle: Acadia renkleri tek tek tanıtır */
  function izle(sahne, ileri) {
    var rs = renklerIzle(), iptal = false, P = paket();
    sahne.innerHTML = '<div class="ka-izle"><div class="ka-izle-acd" data-acd>' + acd('mutlu', 'isaret') + '</div><div class="ka-izle-tuval"><div class="ka-izle-leke" data-leke></div><p class="ka-kelime" data-kelime lang="en"></p></div>' +
      '<div class="ka-izle-sira" data-sira>' + rs.map(function (r) { return '<i style="--r:' + r.hex + '"></i>'; }).join('') + '</div><div class="ka-izle-alt" data-alt hidden><button type="button" class="ka-orta" data-yeniden>Bir daha izle</button>' + ileriDugme('Şarkıya geç') + '</div></div>';
    var leke = sahne.querySelector('[data-leke]'), kel = sahne.querySelector('[data-kelime]'), sira = sahne.querySelector('[data-sira]'), alt = sahne.querySelector('[data-alt]');
    function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    async function oyna() {
      alt.hidden = true; [].forEach.call(sira.children, function (x) { x.classList.remove('ka-yandi'); });
      await SES.soyle(P.izleGiris, 'en');
      for (var i = 0; i < rs.length; i++) {
        if (iptal) return; var r = rs[i];
        leke.innerHTML = P.gorsel(r); leke.classList.remove('ka-sicra'); void leke.offsetWidth; leke.classList.add('ka-sicra');
        kel.textContent = bant().yazi ? r.en : ''; kel.style.setProperty('--r', r.hex); sira.children[i].classList.add('ka-yandi'); SES.fx('pat');
        await SES.soyle(r.en + '.', 'en'); if (iptal) return; await bekle(350);
        await SES.soyle(P.izleCumle(r), 'en'); if (iptal) return; await bekle(500);
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
    var rs = renkler(), gor = {}, P = paket();
    sahne.innerHTML = '<div class="ka-dokun"><p class="ka-yon">' + C.simge('ses') + ' ' + P.dokunYon + '</p><div class="ka-lekeler ka-l' + rs.length + '">' +
      rs.map(function (r) { return '<button type="button" class="ka-lekeb" data-r="' + r.id + '" aria-label="' + r.en + '">' + P.gorsel(r) + (bant().yazi ? '<b lang="en">' + r.en + '</b>' : '') + '<i class="ka-tik">' + C.simge('tik') + '</i></button>'; }).join('') + '</div>' +
      '<div class="ka-izle-alt" data-alt hidden>' + ileriDugme('Oyuna geç') + '</div></div>';
    sahne.querySelectorAll('[data-r]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = rs.filter(function (x) { return x.id === b.getAttribute('data-r'); })[0];
        SES.fx('dokun'); b.classList.remove('ka-zipla'); void b.offsetWidth; b.classList.add('ka-zipla', 'ka-duyuldu'); SES.soyle(r.en, 'en'); gor[r.id] = 1;
        if (Object.keys(gor).length === rs.length) { sahne.querySelector('[data-alt]').hidden = false; }
      });
    });
    sahne.querySelector('[data-ileri]').addEventListener('click', function () { SES.fx('dokun'); ileri(); });
    SES.soyle(P.dokunYon, 'tr');
    return { dur: function () { SES.sus(); } };
  }

  /* oyun sonrası ara ekran: yıldızlar */
  function araEkran(kid, d, y, ileri) {
    var il = ilerleme(), once = toplamYildiz(il); il.yildiz[kid] = il.yildiz[kid] || {}; il.yildiz[kid][d.id] = Math.max(il.yildiz[kid][d.id] || 0, y); koy(ilAnahtar(), il);
    var sonra = toplamYildiz(il), yeniG = V.GIYSI.filter(function (g) { return once < g.yildiz && sonra >= g.yildiz; })[0];
    var sahne = app.querySelector('[data-sahne]'); dur();
    sahne.innerHTML = '<div class="ka-ara"><div class="ka-ara-acd">' + acd('kutlama') + '</div><h2 lang="en">' + ['Good try!', 'Well done!', 'Super!'][y - 1] + '</h2>' +
      '<div class="ka-yildizlar" role="img" aria-label="' + y + ' yıldız">' + [1, 2, 3].map(function (i) { return '<span class="' + (i <= y ? 'ka-kazan' : '') + '" style="--i:' + i + '">' + C.simge('yildiz') + '</span>'; }).join('') + '</div>' +
      (yeniG ? '<p class="ka-yeni-esya"><span>' + C.avatarGiy(S.ogr[1], yeniG.yuva === 'bas' ? { bas: yeniG.id } : { yuz: yeniG.id }) + '</span><b>Dolabına yeni bir şey geldi: ' + esc(yeniG.ad) + '!</b></p>' : '') +
      '<div class="ka-izle-alt"><button type="button" class="ka-orta" data-tekrar>Bir daha oyna</button>' + ileriDugme() + '</div></div>';
    SES.fx('yildiz'); SES.soyle(['Good try!', 'Well done!', 'Super!'][y - 1], 'en').then(function () { if (yeniG) SES.soyle('Dolabına yeni bir şey geldi!', 'tr'); });
    sahne.querySelector('[data-tekrar]').addEventListener('click', function () { SES.fx('dokun'); konuAc(kid, S.duraklar.indexOf(d)); });
    var b = sahne.querySelector('[data-ileri]'); b.addEventListener('click', function () { SES.fx('dokun'); ileri(); }); b.focus({ preventScroll: true });
  }

  /* 6. Söyle: çocuk söyler, kendi sesini dinler (kayıt cihazda kalır, puan yok) */
  function soyle(sahne, ileri) {
    var rs = OYUN.kar(renkler()).slice(0, 3), i = 0, kayit = null, akis = null, url = null, iptal = false;
    function temizle() { try { if (kayit && kayit.state !== 'inactive') kayit.stop(); } catch (e) { } try { if (akis) akis.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { } akis = null; if (url) { URL.revokeObjectURL(url); url = null; } }
    function goster() {
      if (i >= rs.length) { temizle(); return ileri(); }
      var r = rs[i];
      sahne.innerHTML = '<div class="ka-soyle"><p class="ka-yon">' + C.simge('mikrofon') + ' Dinle, sonra sen söyle.</p><div class="ka-soyle-leke">' + paket().gorsel(r) + '</div>' + (bant().yazi ? '<p class="ka-kelime" lang="en" style="--r:' + r.hex + '">' + r.en + '</p>' : '') +
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

  /* 2. Şarkı: sözler karaoke gibi yanar, Acadia dans eder, her kelimeye dokunulup dinlenir */
  function sarki(sahne, ileri) {
    var P = paket(), ogeler = renkler(), satirlar = K.sarkiSatir(P, ogeler), iptal = false, caliyor = false, es = {};
    ogeler.forEach(function (o) { es[o.en.toLowerCase()] = o; });
    function kelimeler(soz) {
      var poz = 0;
      return soz.split(' ').map(function (w) {
        var bas = soz.indexOf(w, poz); poz = bas + w.length;
        var temiz = w.toLowerCase().replace(/[^a-z']/g, ''), o = es[temiz];
        return '<button type="button" class="ka-soz' + (o ? ' ka-soz-renk' : '') + '" data-k="' + esc(temiz) + '" data-bas="' + bas + '"' + (o ? ' style="--r:' + o.hex + '"' : '') + ' lang="en">' + esc(w) + '</button>';
      }).join(' ');
    }
    sahne.innerHTML = '<div class="ka-sarki"><div class="ka-sarki-sahne"><div class="ka-sarki-acd" data-acd>' + acd('mutlu') + '</div><div class="ka-notalar" aria-hidden="true"><i>' + C.simge('nota') + '</i><i>' + C.simge('nota') + '</i><i>' + C.simge('nota') + '</i></div></div>' +
      '<ol class="ka-sozler">' + satirlar.map(function (s, i) { var o = s.kim && ogeler.filter(function (x) { return x.id === s.kim; })[0]; return '<li data-satir="' + i + '"><span class="ka-soz-r" aria-hidden="true">' + (o ? P.gorsel(o) : acd('kutlama')) + '</span><span>' + kelimeler(s.soz) + '</span></li>'; }).join('') + '</ol>' +
      '<div class="ka-izle-alt"><button type="button" class="ka-orta" data-cal>' + C.simge('nota') + ' <span>Şarkıyı çal</span></button>' + ileriDugme('Dokunmaya geç') + '</div></div>';
    var cal = sahne.querySelector('[data-cal]'), kok = sahne.querySelector('.ka-sarki');
    function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function durdur() { caliyor = false; SES.sus(); kok.classList.remove('ka-caliyor'); cal.querySelector('span').textContent = 'Bir daha çal'; sahne.querySelectorAll('.ka-calan,.ka-yanan').forEach(function (x) { x.classList.remove('ka-calan', 'ka-yanan'); }); }
    async function oyna() {
      caliyor = true; kok.classList.add('ka-caliyor'); cal.querySelector('span').textContent = 'Durdur'; SES.muzik(true);
      for (var i = 0; i < satirlar.length; i++) {
        if (!caliyor || iptal) return;
        var li = sahne.querySelector('[data-satir="' + i + '"]'), ks = [].slice.call(li.querySelectorAll('[data-bas]')), sinirGeldi = false, j = 0, zaman = null;
        sahne.querySelectorAll('.ka-calan').forEach(function (x) { x.classList.remove('ka-calan'); }); li.classList.add('ka-calan');
        try { li.scrollIntoView({ block: 'nearest', behavior: SAKIN ? 'auto' : 'smooth' }); } catch (e) { }
        var yak = function (n) { ks.forEach(function (k, m) { k.classList.toggle('ka-yanan', m <= n); }); };
        /* tarayıcı kelime sınırı bildirmezse kelimeler sabit hızla yanar */
        zaman = setInterval(function () { if (!sinirGeldi && j < ks.length) yak(j++); }, 380);
        await SES.soyle(satirlar[i].soz, 'en', { hiz: 0.88, sinir: function (ci) { sinirGeldi = true; var n = 0; ks.forEach(function (k, m) { if (+k.getAttribute('data-bas') <= ci) n = m; }); yak(n); } });
        clearInterval(zaman); yak(ks.length - 1);
        if (!caliyor || iptal) return; await bekle(280);
      }
      durdur(); sahne.querySelector('[data-acd]').innerHTML = acd('kutlama'); SES.fx('yildiz');
      var b = sahne.querySelector('[data-ileri]'); if (b) b.focus({ preventScroll: true });
    }
    cal.addEventListener('click', function () { SES.fx('dokun'); if (caliyor) durdur(); else oyna(); });
    sahne.querySelectorAll('[data-k]').forEach(function (b) { b.addEventListener('click', function () { if (caliyor) return; SES.fx('dokun'); b.classList.remove('ka-zipla'); void b.offsetWidth; b.classList.add('ka-zipla'); SES.soyle(b.getAttribute('data-k'), 'en'); }); });
    sahne.querySelector('[data-ileri]').addEventListener('click', function () { SES.fx('dokun'); durdur(); ileri(); });
    SES.soyle('Hadi birlikte şarkı söyleyelim!', 'tr').then(function () { if (!iptal && !caliyor) oyna(); });
    return { dur: function () { iptal = true; caliyor = false; SES.sus(); } };
  }

  /* ---------- haritadan konuya: Acadia adaya uçar, ada ekranı kaplar ---------- */
  function adaBul(kid) { return app.querySelector('.ka-ada[data-konu="' + kid + '"]'); }
  function merkez(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.45, r: r }; }
  function ucus(kid, sonra) {
    var ada = adaBul(kid), cikis = app.querySelector('.ka-bugun-acd') || app.querySelector('.ka-ben-av');
    if (SAKIN || !ada || !cikis || !W.Element.prototype.animate) return sonra();
    var k = V.konuBul(kid), a = merkez(cikis), h = merkez(ada), o = D.createElement('div');
    if (h.r.bottom < 0 || h.r.top > W.innerHeight) { try { ada.scrollIntoView({ block: 'center' }); } catch (e) { } h = merkez(ada); }
    o.className = 'ka-ucus'; o.innerHTML = '<span class="ka-ucus-acd" style="left:' + a.x + 'px;top:' + a.y + 'px">' + acd('kutlama') + '</span><i class="ka-ucus-perde" style="--r:' + k.renk + '"></i>';
    D.body.appendChild(o); SES.fx('cevir');
    var ac_ = o.firstChild, dx = h.x - a.x, dy = h.y - a.y - 30;
    ac_.animate([{ transform: 'translate(-50%,-50%) rotate(0) scale(1)' }, { transform: 'translate(calc(-50% + ' + dx / 2 + 'px),calc(-50% + ' + (dy / 2 - 140) + 'px)) rotate(-14deg) scale(1.15)', offset: .5 }, { transform: 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) rotate(6deg) scale(.8)' }],
      { duration: 780, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' }).finished.then(function () {
      SES.fx('yildiz'); ada.classList.add('ka-ada-kon');
      var p = o.lastChild, cr = 'circle(0px at ' + h.x + 'px ' + h.y + 'px)', ck = 'circle(' + Math.hypot(W.innerWidth, W.innerHeight) + 'px at ' + h.x + 'px ' + h.y + 'px)';
      return p.animate([{ clipPath: cr }, { clipPath: ck }], { duration: 480, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' }).finished;
    }).then(function () {
      sonra(); ac_.remove();
      o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).finished.then(function () { o.remove(); });
    }, function () { o.remove(); sonra(); });
  }
  /* konudan haritaya: konunun rengi adasına doğru küçülür */
  function donus(kid) {
    var ada = adaBul(kid); if (SAKIN || !ada || !W.Element.prototype.animate) return;
    try { ada.scrollIntoView({ block: 'center' }); } catch (e) { }
    var k = V.konuBul(kid), h = merkez(ada), o = D.createElement('div');
    o.className = 'ka-ucus'; o.innerHTML = '<i class="ka-ucus-perde" style="--r:' + k.renk + '"></i>'; D.body.appendChild(o);
    o.firstChild.animate([{ clipPath: 'circle(' + Math.hypot(W.innerWidth, W.innerHeight) + 'px at ' + h.x + 'px ' + h.y + 'px)' }, { clipPath: 'circle(0px at ' + h.x + 'px ' + h.y + 'px)' }], { duration: 460, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' })
      .finished.then(function () { o.remove(); ada.classList.add('ka-ada-kon'); }, function () { o.remove(); });
  }

  /* ---------- dolap: yıldızlarla açılan giysiler ---------- */
  function dolap() {
    SES.fx('dokun');
    var il = ilerleme(), top = toplamYildiz(il);
    il.giysi = il.giysi || {};
    var k = katman('<header class="ka-pen-bas"><h2>Dolabım</h2><button type="button" class="ka-yuvarlak" data-kapat data-odak aria-label="Kapat">×</button></header><div class="ka-dolap"><div class="ka-dolap-on" data-on></div><div><p class="ka-pen-alt" data-dolap-alt></p><ul class="ka-giysiler" data-giysiler></ul></div></div>', 'ka-dolapk');
    function ciz_() {
      k.el.querySelector('[data-on]').innerHTML = ben(il);
      k.el.querySelector('[data-dolap-alt]').innerHTML = C.simge('yildiz') + ' <b>' + top + '</b> yıldızın var. Giymek için dokun, çıkarmak için yine dokun.';
      k.el.querySelector('[data-giysiler]').innerHTML = V.GIYSI.map(function (g) {
        var acik = top >= g.yildiz, giyili = il.giysi[g.yuva] === g.id, deneme = {}; deneme[g.yuva] = g.id;
        return '<li><button type="button" class="ka-giysi' + (acik ? '' : ' ka-kapali') + '" data-giy="' + g.id + '" aria-pressed="' + giyili + '"' + (acik ? '' : ' aria-disabled="true"') + ' aria-label="' + esc(g.ad + (acik ? '' : ', ' + g.yildiz + ' yıldızla açılır')) + '">' +
          C.avatarGiy(S.ogr[1], deneme) + '<b>' + esc(g.ad) + '</b>' + (acik ? (giyili ? '<i class="ka-tik">' + C.simge('tik') + '</i>' : '') : '<span class="ka-kilit">' + C.simge('kilit') + g.yildiz + '★</span>') + '</button></li>';
      }).join('');
      var bv = app.querySelector('.ka-ben-av'); if (bv) bv.innerHTML = ben(il);
    }
    k.el.querySelector('[data-giysiler]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-giy]'); if (!b) return; var g = V.GIYSI.filter(function (x) { return x.id === b.getAttribute('data-giy'); })[0];
      if (top < g.yildiz) { SES.fx('yanlis'); SES.soyle(g.yildiz + ' yıldız toplayınca açılacak.', 'tr'); return; }
      if (il.giysi[g.yuva] === g.id) delete il.giysi[g.yuva]; else il.giysi[g.yuva] = g.id;
      SES.fx('dogru'); koy(ilAnahtar(), il); ciz_();
      var on = k.el.querySelector('[data-on]'); on.classList.remove('ka-zipla'); void on.offsetWidth; on.classList.add('ka-zipla');
    });
    ciz_();
    SES.soyle('Dolabına hoş geldin! Yıldız topladıkça yeni şeyler açılır.', 'tr');
  }

  /* ---------- veli köşesi (matematik kapısının arkasında) ---------- */
  function veliKosesi() {
    var il = ilerleme(), gecen = V.gunAnahtar(new Date(Date.now() - 6 * 864e5)), gun = Object.keys(il.gunler || {}).filter(function (g) { return g >= gecen; }).length;
    var acik = V.KONU.filter(function (x) { return x.acik; }), zor = Object.keys(il.zor || {}).sort(function (a, b) { return il.zor[b] - il.zor[a]; }).slice(0, 3).map(V.ogeBul).filter(Boolean);
    var ek = K.al(il.sonKonu || (bulutMu() ? S.bugun : V.gunKonu(S.sinif.id)) || 'colours') || K.al('colours'), kz = V.konuBul(ek.id), pwa = W.KIDS_PWA ? W.KIDS_PWA.durum() : 'yok';
    var mola = +al('mola', 15) || 15, dinle = function (en) { return '<button type="button" class="ka-dinle-k" data-en="' + esc(en) + '" aria-label="Dinle: ' + esc(en) + '">' + C.simge('ses') + '</button>'; };
    var k = katman('<header class="ka-pen-bas"><h2>Veli köşesi</h2><button type="button" class="ka-yuvarlak" data-kapat data-odak aria-label="Kapat">×</button></header><div class="ka-veli">' +
      '<section><h3>' + esc(S.ogr[0]) + ' bu hafta</h3><ul class="ka-veli-ozet"><li><b>' + gun + '</b><span>gün oynadı (son 7 gün)</span></li><li><b>' + toplamYildiz(il) + '</b><span>yıldız topladı</span></li><li><b>' + Object.keys(il.bitti || {}).length + '</b><span>konu bitirdi</span></li></ul>' +
      '<ul class="ka-veli-konu">' + acik.map(function (x) { var y = (il.yildiz || {})[x.id] || {}, n = Object.keys(y).reduce(function (t, o) { return t + y[o]; }, 0); return '<li style="--r:' + x.renk + '"><span>' + C.simge(x.simge) + '</span><b lang="en">' + esc(x.en) + '</b><i><em style="width:' + Math.round(n / 9 * 100) + '%"></em></i><small>' + n + '/9 ★' + (il.bitti && il.bitti[x.id] ? ' · bitirdi' : '') + '</small></li>'; }).join('') + '</ul></section>' +
      '<section><h3>Zorlandığı kelimeler</h3>' + (zor.length ? '<ul class="ka-veli-kel">' + zor.map(function (o) { return '<li style="--r:' + o.hex + '">' + dinle(o.en) + '<b lang="en">' + esc(o.en) + '</b><small>' + esc(o.tr) + '</small></li>'; }).join('') + '</ul><p class="ka-pen-alt">Dinleyip birlikte tekrar edin; günlük hayatta gösterip sorun.</p>' : '<p class="ka-pen-alt">Henüz zorlandığı bir kelime yok.</p>') + '</section>' +
      '<section><h3>Evde birlikte söyleyin <small lang="en">' + esc(kz.en) + '</small></h3><ul class="ka-veli-ev">' + ek.ev.map(function (c) { return '<li>' + dinle(c[0]) + '<b lang="en">' + esc(c[0]) + '</b><small>' + esc(c[1]) + '</small></li>'; }).join('') + '</ul></section>' +
      '<section><h3>Ayarlar</h3><label class="ka-veli-ayar">Mola hatırlatması<select data-mola>' + [10, 15, 20, 30].map(function (m) { return '<option value="' + m + '"' + (m === mola ? ' selected' : '') + '>' + m + ' dakikada bir</option>'; }).join('') + '</select></label>' +
      '<label class="ka-veli-ayar">Ses<button type="button" class="ka-orta" data-vses aria-pressed="' + SES.acikMi() + '">' + (SES.acikMi() ? 'Açık' : 'Kapalı') + '</button></label>' +
      (pwa === 'kurulu' ? '<p class="ka-veli-pwa">✓ Acadex Kids bu cihazda uygulama olarak açık.</p>' : pwa === 'kur' ? '<div class="ka-veli-pwa"><p>Acadex Kids’i ana ekrana ekleyin: çocuğunuz tek dokunuşla açar, internet kesilse de oynar.</p><button type="button" class="ka-orta" data-kur>Ana ekrana ekle</button></div>'
        : pwa === 'ios' ? '<div class="ka-veli-pwa"><p>Ana ekrana eklemek için: Safari’de <b>Paylaş</b> düğmesine, sonra <b>Ana Ekrana Ekle</b>’ye dokunun.</p></div>' : '') +
      '</section><button type="button" class="ka-cikis-b" data-vcikis>Çocuğun oturumunu kapat</button></div>', 'ka-velik');
    k.el.querySelectorAll('[data-en]').forEach(function (b) { b.addEventListener('click', function () { SES.fx('dokun'); SES.soyle(b.getAttribute('data-en'), 'en'); }); });
    k.el.querySelector('[data-mola]').addEventListener('change', function () { koy('mola', +this.value); });
    k.el.querySelector('[data-vses]').addEventListener('click', function () { var a = SES.ayar(!SES.acikMi()); this.setAttribute('aria-pressed', a); this.textContent = a ? 'Açık' : 'Kapalı'; var s = app.querySelector('[data-ses]'); if (s) s.setAttribute('aria-pressed', a); });
    var kb = k.el.querySelector('[data-kur]'); if (kb) kb.addEventListener('click', function () { W.KIDS_PWA.kur().then(function (ok) { if (ok) kb.parentNode.innerHTML = '<p>✓ Ana ekrana eklendi.</p>'; }); });
    k.el.querySelector('[data-vcikis]').addEventListener('click', function () { k.kapat(); if (S.token) B.cikis(S.token); koy('oturum', null); koy('sonDurum', null); S.sinif = null; S.ogr = null; S.token = null; girisKod(); });
  }

  /* konu bitti: çıkartma */
  function konuBitti(kid) {
    var il = ilerleme(), yeni = (cikartmalar(kid) || []).filter(function (c) { return il.cikartma.indexOf(c) < 0; }), y = il.yildiz[kid] || {}, n = Object.keys(y).reduce(function (t, o) { return t + y[o]; }, 0);
    var odul = yeni.slice(0, n >= 8 ? 3 : n >= 5 ? 2 : 1); il.cikartma = il.cikartma.concat(odul); il.bitti[kid] = Date.now(); koy(ilAnahtar(), il);
    var k = V.KONU.filter(function (x) { return x.id === kid; })[0];
    ciz('<main class="ka-sahne ka-bitis"><div class="ka-konfeti" aria-hidden="true">' + new Array(24).join('<i></i>') + '</div><div class="ka-ara-acd">' + acd('kutlama') + '</div><h1><span lang="en">' + esc(k.en) + '</span> tamam!</h1>' +
      '<p class="ka-bitis-y">' + C.simge('yildiz') + ' <b>' + n + '</b> / 9 yıldız</p>' +
      (odul.length ? '<p>Yeni çıkartmaların:</p><div class="ka-oduller">' + odul.map(function (c, i) { return '<span style="--i:' + i + '">' + C.simge(c) + '</span>'; }).join('') + '</div>' : '<p>Bütün çıkartmaları topladın. Daha çok yıldız için yeniden oynayabilirsin.</p>') +
      '<div class="ka-izle-alt"><button type="button" class="ka-orta" data-yine>Yeniden oyna</button><button type="button" class="ka-buyuk" data-harita data-odak>Haritaya dön ' + C.simge('ev') + '</button></div></main>', 'konu');
    SES.fx('yildiz'); SES.soyle(paket().bitis, 'en');
    app.querySelector('[data-harita]').addEventListener('click', function () { SES.fx('dokun'); panel(); donus(kid); });
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
      if (d.ilerleme !== undefined) { var kd = JSON.parse(JSON.stringify(d)); delete kd.ilerleme; koy('sonDurum', { token: token, d: kd }); }
      S.token = token; S.okul = { kod: d.okul.kod, ad: d.okul.ad, bulut: true };
      S.sinif = { id: d.sinif.id, ad: d.sinif.ad, bant: d.sinif.bant }; S.ogr = [d.ogr.ad, d.ogr.hayvan, d.ogr.id]; S.bugun = d.bugun;
      /* bu tarayıcıdaki kayıtla sunucudakini birleştir: hangisi daha yeniyse */
      var yerel = al(ilAnahtar(), null), uzak = d.ilerleme;
      if (uzak && (!yerel || (uzak.guncel || 0) > (yerel.guncel || 0))) { try { localStorage.setItem('kids.' + ilAnahtar(), JSON.stringify(uzak)); } catch (e) { } }
      else if (yerel && (!uzak || (yerel.guncel || 0) > (uzak.guncel || 0))) B.ilerlemeKoy(token, yerel);
      panel();
    }, function (er) {
      var sd = al('sonDurum', null);
      if (er.tur === 'ag' && sd && sd.token === token) { var d2 = sd.d; S.token = token; S.okul = { kod: d2.okul.kod, ad: d2.okul.ad, bulut: true }; S.sinif = { id: d2.sinif.id, ad: d2.sinif.ad, bant: d2.sinif.bant }; S.ogr = [d2.ogr.ad, d2.ogr.hayvan, d2.ogr.id]; S.bugun = d2.bugun; return panel(); }   /* internet yok: son bilinen hâlle oyna, ilerleme bağlanınca gider */
      if (er.tur === 'ag') { ciz('<section class="ka-giris"><div class="ka-kart">' + balon(esc(er.message)) + '<button type="button" class="ka-buyuk" data-yine data-odak>Yeniden dene</button></div></section>', 'giris'); app.querySelector('[data-yine]').addEventListener('click', function () { bulutAc(token); }); return; }
      koy('oturum', null); koy('sonDurum', null); S.token = null; girisKod(er.tur === 'lisans' ? er.message : '');
    });
  }
  /* tek sayfa: kids-yon.js #oyna'da ac(), başka görünüme geçerken kapat() çağırır */
  function kapatApp() { dur(); D.querySelectorAll('.ka-ort').forEach(function (o) { o.remove(); }); if (app) app.innerHTML = ''; }
  W.KIDS_APP = { ac: kur, kapat: kapatApp, panel: panel, konuAc: konuAc, durum: function () { return S; }, DURAK: DURAK };
})(window);
