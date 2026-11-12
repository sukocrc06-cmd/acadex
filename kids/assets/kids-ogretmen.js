/* ==========================================================================
   ACADEX KIDS · öğretmen paneli (kids/assets/kids-ogretmen.js), 12.11.2026
   Öğretmenin tek işi: günün konusunu seçmek. İsterse haftayı önceden planlar ve
   sınıfın ilerlemesine bakar. Ödev vermek, not girmek, içerik hazırlamak yok.
   - Günün konusu / haftalık plan: KIDS_VERI.planKoy ile saklanır; çocuk giriş
     yaptığında haritanın üstünde o konu çıkar ('' = serbest gün).
   - Sınıf ilerleme tablosu: bu tarayıcıda oynayan çocukların gerçek kaydı
     (kids.il.<okul>.<sinif>.<ad>) + etiketli örnek veri (kapatılabilir).
   - Sınıf raporu: konu tamamlama tablosu, kelime ısı haritası (hangi çocuk hangi
     kelimede zorlanıyor) ve yazdırılabilir haftalık veli bülteni (kişisel veri içermez).
   - Akıllı tahta: sınıfta yansıtmak için kartlar, şarkı, Simon says, çocuk seçen çark (kids-tahta.js).
   Gerçek okul: okul kodu + yönetim panelinin ürettiği şifre (kids-bulut.js → Supabase);
   plan ve ilerleme sunucudan gelir. Örnek okul (ORNEK-2026 / 1234) yalnız tanıtım
   içindir ve bu tarayıcıda çalışır. Önek kt-. W.KIDS_OGRETMEN
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, V = W.KIDS_VERI, B = W.KIDS_BULUT, kok, sinifI = 0, ornekGoster = true, BU = null, TOK = null, konuSec = null;
  function okul() { return BU || V.OKUL; }
  function gunKonu(sinif, d) { if (!BU) return V.gunKonu(sinif.id, d); var g = V.gunAnahtar(d); return sinif.plan && g in sinif.plan ? sinif.plan[g] : ''; }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var GUN = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
  function tarihUzun(d) { try { return d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return V.gunAnahtar(d); } }
  function kucuk(s) { return s.toLocaleLowerCase('tr'); }

  /* ---------- veri ---------- */
  function tohum(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h; }
  /* örnek kayıt: ada göre hep aynı çıkar; her sınıfta bir iki çocuk "henüz girmedi" */
  function ornekKayit(sinif, ad) {
    var h = tohum(sinif.id + ad), renkler = V.RENK.slice(0, V.BANT[sinif.bant].renkSay);
    if (h % 5 === 0) return { ornek: true, yildiz: {}, bitti: {}, zor: {}, cikartma: [], son: 0 };
    var b = 1 + h % 3, f = 1 + (h >> 2) % 3, y = h % 4 === 1 ? 0 : 1 + (h >> 4) % 3, zor = {};
    zor[renkler[h % renkler.length].id] = 1 + h % 3; if (h % 3 === 0) zor[renkler[(h + 2) % renkler.length].id] = 1;
    var yl = { balon: b, hafiza: f }; if (y) yl.boyama = y;
    var yil = { colours: yl }, bit = y ? { colours: 1 } : {}, cik = y ? ['gokkusagi'] : [], bant = V.BANT[sinif.bant];
    /* örnek sınıf birkaç temayı da oynamış olsun: rapor ve ısı haritası boş görünmesin */
    ['numbers', 'animals', 'food', 'family'].forEach(function (kid, j) {
      var t = tohum(sinif.id + ad + kid); if (t % 3 === 0 && j > 0) return;
      var p = W.KIDS_KONU && W.KIDS_KONU.al(kid); if (!p) return;
      var ol = p.ogeler(bant), o3 = p.oyun3.id, yy = {}; yy.balon = 1 + t % 3; yy.hafiza = 1 + (t >> 3) % 3; if (t % 4) yy[o3] = 1 + (t >> 5) % 3;
      yil[kid] = yy; if (t % 4 && yy.balon + yy.hafiza + yy[o3] >= 6) { bit[kid] = 1; cik.push(p.cikartma[0]); }
      zor[ol[t % ol.length].id] = 1 + t % 3; if (t % 5 === 1) zor[ol[(t + 3) % ol.length].id] = 1;
    });
    return { ornek: true, yildiz: yil, bitti: bit, zor: zor, cikartma: cik, son: Date.now() - (h % 4) * 864e5 - (h % 9) * 36e5 };
  }
  /* İlerlemeyi çocuk oturumu yazar, bu ekran onu HTML'e basar. Çocuk anahtarı
     ele geçerse (resimli şifre dar bir havuzdur) sayı yerine HTML yazılıp
     ÖĞRETMENİN tarayıcısında çalıştırılabilirdi (12.11 taraması). Sunucudan
     gelen her alan burada biçimine zorlanır: sayılar sayı, anahtarlar düz kimlik. */
  function sayi(v) { v = Number(v); return isFinite(v) && v > 0 ? Math.min(v, 1e6) : 0; }
  function kimlik(k) { return /^[a-z0-9@_-]{1,40}$/i.test(k); }
  function sayiHarita(m) { var r = {}; if (m && typeof m === 'object') Object.keys(m).forEach(function (k) { if (kimlik(k)) r[k] = sayi(m[k]); }); return r; }
  function temizKayit(u) {
    u = u && typeof u === 'object' ? u : {};
    var yildiz = {}, bitti = {};
    if (u.yildiz && typeof u.yildiz === 'object') Object.keys(u.yildiz).forEach(function (k) { if (kimlik(k)) yildiz[k] = sayiHarita(u.yildiz[k]); });
    if (u.bitti && typeof u.bitti === 'object') Object.keys(u.bitti).forEach(function (k) { if (kimlik(k) && u.bitti[k]) bitti[k] = 1; });
    return { yildiz: yildiz, bitti: bitti, zor: sayiHarita(u.zor), usta: sayiHarita(u.usta),
      seviye: sayiHarita(u.seviye), kitap: sayiHarita(u.kitap), gunler: sayiHarita(u.gunler),
      cikartma: Array.isArray(u.cikartma) ? u.cikartma.filter(function (c) { return typeof c === 'string' && kimlik(c); }) : [], son: sayi(u.son) };
  }
  function kayit(sinif, og) {
    var ad = og[0];
    if (BU) return temizKayit(og[3]);
    var g = V.al('il.' + V.OKUL.kod + '.' + sinif.id + '.' + ad, null);
    if (g && (g.son || (g.yildiz && Object.keys(g.yildiz).length))) { g.yildiz = g.yildiz || {}; g.bitti = g.bitti || {}; g.zor = g.zor || {}; g.cikartma = g.cikartma || []; return g; }
    return ornekGoster ? ornekKayit(sinif, ad) : { yildiz: {}, bitti: {}, zor: {}, cikartma: [], son: 0 };
  }
  function yildizSay(k, konu) { var y = (k.yildiz || {})[konu] || {}; return Object.keys(y).reduce(function (t, o) { return t + y[o]; }, 0); }
  function oyunSay(k, konu) { return Object.keys((k.yildiz || {})[konu] || {}).length; }
  function enZor(z) { var e = null; Object.keys(z || {}).forEach(function (r) { if (!e || z[r] > z[e]) e = r; }); return e; }
  function sonYazi(ts) {
    if (!ts) return '<span class="kt-yok">Henüz girmedi</span>';
    var b = new Date(), g = new Date(ts), fark = Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(g.getFullYear(), g.getMonth(), g.getDate())) / 864e5);
    return fark <= 0 ? 'Bugün' : fark === 1 ? 'Dün' : fark + ' gün önce';
  }
  function renkBul(id) { return V.ogeBul(id); }
  /* zorlanılan kelimelerden yalnız seçili konununkiler */
  function konuZor(z, konu) { var p = W.KIDS_KONU && W.KIDS_KONU.al(konu), ids = {}; if (!p) return z || {}; p.ogeler(V.BANT.yildiz).forEach(function (o) { ids[o.id] = 1; }); var r = {}; Object.keys(z || {}).forEach(function (k) { if (ids[k]) r[k] = z[k]; }); return r; }
  function ozet(sinif, konu) {
    konu = konu || 'colours';
    var ks = sinif.ogr.map(function (o) { return kayit(sinif, o); }), hafta0 = V.hafta()[0].getTime();
    var oynayan = ks.filter(function (k) { return k.son >= hafta0; }).length, giren = ks.filter(function (k) { return k.son; });
    var top = giren.reduce(function (t, k) { return t + yildizSay(k, konu); }, 0), zor = {};
    ks.forEach(function (k) { var kz = konuZor(k.zor, konu); Object.keys(kz).forEach(function (r) { zor[r] = (zor[r] || 0) + kz[r]; }); });
    return { n: ks.length, oynayan: oynayan, ort: giren.length ? top / giren.length : 0, biten: ks.filter(function (k) { return k.bitti[konu]; }).length, zor: enZor(zor), girmeyen: sinif.ogr.filter(function (o, i) { return !ks[i].son; }).map(function (o) { return o[0]; }) };
  }

  /* ---------- giriş ---------- */
  function giris(hata) {
    kok.innerHTML = '<section class="kt-giris"><form class="kt-kart" data-f novalidate><div class="kt-giris-bas"><span>' + C.acadia({ mood: 'mutlu' }) + '</span><div><small>Acadex Kids</small><h1>Öğretmen girişi</h1></div></div>' +
      '<label>Okul kodu<input name="kod" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" value="' + esc(V.al('sonKod', '')) + '"></label>' +
      '<label>Şifre<input name="sifre" type="password" autocomplete="current-password" maxlength="40"></label>' +
      '<p class="kt-uyari" role="alert">' + (hata || '') + '</p><button type="submit" class="kl-dugme">Giriş yap</button>' +
      '<p class="kt-ornek">Şifrenizi okulunuzun yöneticisi Acadex’ten alır. Denemek için örnek okul: <b>' + V.OKUL.kod + '</b>, şifre <b>' + V.OKUL.ogretmenSifre + '</b>. <button type="button" data-doldur>Doldur</button></p><p class="kt-donus"><a href="#">← Tanıtım sayfası</a> · <a href="#oyna">Çocuk girişi</a></p></form></section>';
    var f = kok.querySelector('[data-f]');
    kok.querySelector('[data-doldur]').addEventListener('click', function () { f.elements.kod.value = V.OKUL.kod; f.elements.sifre.value = V.OKUL.ogretmenSifre; f.querySelector('[type=submit]').focus(); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var kod = f.elements.kod.value.trim().toLocaleUpperCase('tr').replace(/İ/g, 'I').replace(/\s+/g, ''), sifre = f.elements.sifre.value.trim();
      if (!kod || !sifre) return giris('Okul kodunu ve şifreyi yazın.');
      if (kod === V.OKUL.kod) {
        if (sifre !== V.OKUL.ogretmenSifre) return giris('Okul kodu ya da şifre hatalı.');
        BU = null; TOK = null; V.koy('ogrOturum', { kod: V.OKUL.kod }); return panel();
      }
      var b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Giriş yapılıyor…';
      B.ogretmenGiris(kod, sifre).then(function (r) {
        if (!r.tamam) return giris('Okul kodu ya da şifre hatalı.');
        V.koy('sonKod', kod); V.koy('ogrOturum', { kod: kod, token: r.token }); yukle(r.token);
      }, function (er) { giris(er.message); });
    });
    try { (f.elements.kod.value ? f.elements.sifre : f.elements.kod).focus({ preventScroll: true }); } catch (e) { }
  }

  /* ---------- panel ---------- */
  function konuDugme(k, secili) {
    return '<button type="button" class="kt-konu' + (secili ? ' kt-secili' : '') + '" data-konu="' + k.id + '" aria-pressed="' + secili + '"' + (k.acik ? '' : ' disabled') + ' style="--r:' + k.renk + '"><span>' + C.simge(k.simge) + '</span><b lang="en">' + esc(k.en) + '</b><small>' + (k.acik ? esc(k.tr) : 'Yakında') + '</small></button>';
  }
  function panel(bildirim) {
    var okul = okul_(), sinif = okul.siniflar[sinifI], bugun = new Date(), bk = V.konuBul(gunKonu(sinif, bugun)), hafta = V.hafta(), bugunA = V.gunAnahtar(), acikK = V.KONU.filter(function (x) { return x.acik; }),
      kz = konuSec || (bk && bk.acik ? bk.id : 'colours'), kzK = V.konuBul(kz), o = ozet(sinif, kz), zr = o.zor && renkBul(o.zor);
    var h = '<header class="kt-ust"><a class="kl-marka" href="#" aria-label="Acadex Kids tanıtım sayfası"><span>' + C.acadia({ mood: 'mutlu' }) + '</span><b>Acadex <i>Kids</i></b></a><span class="kt-okul"><b>' + esc(okul.ad) + '</b><small>Öğretmen paneli</small></span>' +
      '<button type="button" class="kt-tahta-b" data-tahta>' + C.simge('yildiz') + ' Akıllı tahta</button><button type="button" class="kt-tahta-b kt-mat-b" data-materyal>' + C.simge('album') + ' Materyaller</button>' + (BU ? '<button type="button" class="kt-tahta-b" data-otkapat>' + C.simge('kilit') + ' Oturumları kapat</button>' : '') + '<a class="kt-bag" href="#oyna">Çocuk ekranını aç</a><button type="button" class="kt-cikis" data-cikis>Çıkış</button></header>' +
      '<main class="kt-govde"><div class="kt-sekmeler" role="tablist" aria-label="Sınıflar">' + okul.siniflar.map(function (s, i) { return '<button type="button" role="tab" aria-selected="' + (i === sinifI) + '" data-sinif="' + i + '" style="--r:' + s.renk + '"><b>' + esc(s.ad) + '</b><small>' + esc(V.BANT[s.bant].ad + ' · ' + V.BANT[s.bant].yas) + '</small></button>'; }).join('') + '</div>' +
      '<p class="kt-bildirim' + (bildirim ? ' kt-var' : '') + '" role="status" data-bildirim>' + (bildirim ? '✓ ' + esc(bildirim) : '') + '</p>' +

      /* bugün */
      '<section class="kt-bugun" aria-labelledby="kt-b"><div class="kt-bugun-sol"><small>' + esc(tarihUzun(bugun)) + '</small><h2 id="kt-b">Bugünün konusu</h2>' +
      '<div class="kt-simdi" style="--r:' + (bk ? bk.renk : '#E3E8F2') + '"><span>' + (bk ? C.ada(bk.renk, bk.simge, false) : C.acadia({ mood: 'mutlu' })) + '</span><div>' + (bk ? '<b lang="en">' + esc(bk.en) + '</b><em>' + esc(bk.tr) + '</em>' : '<b>Serbest gün</b><em>Çocuk istediği adayı seçer</em>') + '</div></div>' +
      (bk ? '<blockquote class="kt-soz"><small>Sınıfta söylemeniz yeter</small>“Çocuklar, bugün öğrendiğimiz <b>' + esc(kucuk(bk.tr)) + '</b> konusunu Acadex Kids’te oynayarak tekrar etmeyi unutmayın!”</blockquote>' : '') + '</div>' +
      '<div class="kt-bugun-sag"><h3>Konuyu değiştir</h3><div class="kt-konular" data-gun="' + bugunA + '">' + V.KONU.map(function (k) { return konuDugme(k, bk && bk.id === k.id); }).join('') +
      '<button type="button" class="kt-konu kt-serbest' + (bk ? '' : ' kt-secili') + '" data-konu="" aria-pressed="' + !bk + '"><span>' + C.acadia({ mood: 'mutlu' }) + '</span><b>Serbest gün</b><small>Konu yok</small></button></div>' +
      (V.KONU.every(function (x) { return x.acik; }) ? '<p class="kt-not">12 konunun hepsi oynanabilir; her konuda 7 durak ve konuya özel bir oyun var.</p>' : '<p class="kt-not">Şu an oynanabilen konular: ' + V.KONU.filter(function (x) { return x.acik; }).map(function (x) { return x.en; }).join(', ') + '. Diğer konular içerikleri hazır olduğunda açılır.</p>') + '</div></section>' +

      /* haftalık plan */
      '<section class="kt-bolum" aria-labelledby="kt-h"><h2 id="kt-h">Haftalık plan</h2><p class="kt-alt">İsterseniz haftayı önceden planlayın; her sabah yeniden seçmeniz gerekmez.</p><div class="kt-hafta">' +
      hafta.map(function (d, i) {
        var a = V.gunAnahtar(d), kid = gunKonu(sinif, d), k = V.konuBul(kid);
        return '<label class="kt-gun' + (a === bugunA ? ' kt-gun-bugun' : '') + '" style="--r:' + (k ? k.renk : '#EEF2F8') + '"><span class="kt-gun-ad">' + GUN[i] + '<small>' + ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + (a === bugunA ? ' · bugün' : '') + '</small></span><span class="kt-gun-r">' + (k ? C.simge(k.simge) : '') + '</span>' +
          '<select data-plan="' + a + '" aria-label="' + GUN[i] + ' konusu"><option value=""' + (k ? '' : ' selected') + '>Serbest gün</option>' + V.KONU.map(function (x) { return '<option value="' + x.id + '"' + (x.id === kid ? ' selected' : '') + (x.acik ? '' : ' disabled') + '>' + esc(x.en + ' · ' + x.tr) + (x.acik ? '' : ' (yakında)') + '</option>'; }).join('') + '</select></label>';
      }).join('') + '</div></section>' +

      /* ilerleme */
      '<section class="kt-bolum" aria-labelledby="kt-i"><div class="kt-bolum-bas"><div><h2 id="kt-i">Sınıf ilerlemesi</h2><p class="kt-alt">' + esc(sinif.ad) + ' · ' + esc(kzK.en) + ' konusu</p><div class="kt-konu-sec" role="group" aria-label="İlerlemesi gösterilen konu">' + acikK.map(function (x) { return '<button type="button" data-ksec="' + x.id + '" aria-pressed="' + (x.id === kz) + '" style="--r:' + x.renk + '"><span>' + C.simge(x.simge) + '</span>' + esc(x.en) + '</button>'; }).join('') + '</div></div>' +
      (BU ? '' : '<label class="kt-anahtar"><input type="checkbox" data-ornek' + (ornekGoster ? ' checked' : '') + '><span>Örnek veriyi göster</span></label>') + '</div>' +
      '<ul class="kt-ozet"><li><b>' + o.oynayan + '<small>/' + o.n + '</small></b><span>bu hafta oynadı</span></li><li><b>' + (Math.round(o.ort * 10) / 10).toString().replace('.', ',') + '<small>/' + W.KIDS_KONU.yildizMax(kz) + ' ★</small></b><span>ortalama yıldız</span></li><li><b>' + o.biten + '<small>/' + o.n + '</small></b><span>konuyu bitirdi</span></li>' +
      '<li' + (zr ? ' style="--r:' + zr.hex + '"' : '') + ' class="kt-ozet-zor"><b>' + (zr ? '<i></i><span lang="en">' + zr.en + '</span>' : '—') + '</b><span>en çok zorlanılan kelime</span></li></ul>' +
      (o.girmeyen.length ? '<p class="kt-girmeyen"><b>Henüz girmeyenler:</b> ' + o.girmeyen.map(esc).join(', ') + '</p>' : '') +
      '<div class="kt-tablo-sar"><table class="kt-tablo"><thead><tr><th scope="col">Öğrenci</th><th scope="col">Son giriş</th><th scope="col">Yıldız</th><th scope="col">Oyunlar</th><th scope="col">Zorlandığı kelime</th><th scope="col">Çıkartma</th></tr></thead><tbody>' +
      sinif.ogr.map(function (og) {
        var k = kayit(sinif, og), y = yildizSay(k, kz), kzor = konuZor(k.zor, kz), z = enZor(kzor), zrk = z && renkBul(z);
        return '<tr' + (k.son ? '' : ' class="kt-pasif"') + '><th scope="row"><span class="kt-ogr">' + C.avatar(og[1]) + '<b>' + esc(og[0]) + '</b>' + (k.ornek ? '<i class="kt-ornek-e">örnek</i>' : '') + '</span></th><td>' + sonYazi(k.son) + '</td>' +
          '<td><span class="kt-cubuk" role="img" aria-label="' + y + ' / ' + W.KIDS_KONU.yildizMax(kz) + ' yıldız"><i style="width:' + Math.round(100 * y / W.KIDS_KONU.yildizMax(kz)) + '%"></i></span><span class="kt-sayi">' + y + '/' + W.KIDS_KONU.yildizMax(kz) + '</span></td>' +
          '<td>' + oyunSay(k, kz) + '/' + W.KIDS_KONU.oyunSay(kz) + (k.bitti[kz] ? ' <span class="kt-tamam">bitirdi</span>' : '') + '</td>' +
          '<td>' + (zrk ? '<span class="kt-kelime" style="--r:' + zrk.hex + '"><i></i><span lang="en">' + zrk.en + '</span> <small>' + kzor[z] + ' yanlış</small></span>' : '<span class="kt-yok">—</span>') + '</td><td>' + k.cikartma.length + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (BU ? '<p class="kt-not">Kayıtlar çocukların kendi oturumlarından gelir; sayfayı yenileyince güncellenir.</p>' : '<p class="kt-not">Örnek okul: gerçek kayıtlar bu tarayıcıda oynanan oturumlardan gelir; “örnek” etiketli satırlar tasarımı göstermek için üretilmiştir.</p>') + '</section>' +
      rapor(sinif, kz) + '</main>';
    kok.innerHTML = h;
    kok.querySelector('[data-tahta]').addEventListener('click', function () { if (W.KIDS_TAHTA) W.KIDS_TAHTA.ac({ sinif: sinif, konu: bk && bk.acik ? bk.id : kz }); });
    kok.querySelector('[data-bulten]').addEventListener('click', function () { bulten(sinif, kz); });
    /* Paylaşımlı tablet: sınıfın açık çocuk oturumlarını kapatır. Veri silinmez,
       çocuk resimli şifresiyle yeniden girer (20261112d). */
    var otk = kok.querySelector('[data-otkapat]');
    if (otk) otk.addEventListener('click', function () {
      var b = this;
      if (!W.confirm(sinif.ad + ' sınıfındaki açık girişler kapatılsın mı? Çocuklar resimli şifresiyle yeniden girer, ilerlemeleri durur.')) return;
      b.disabled = true;
      B.sinifOturumKapat(TOK, sinif.id).then(function (n) {
        b.disabled = false; W.alert(n ? n + ' açık giriş kapatıldı.' : 'Bu sınıfta açık giriş yoktu.');
      }, function (er) { b.disabled = false; if (er.tur === 'oturum') return cikisZorla(er); W.alert('Kapatılamadı: ' + er.message); });
    });
    kok.querySelectorAll('[data-materyal]').forEach(function (b) { b.addEventListener('click', function () { if (W.KIDS_YAZDIR) W.KIDS_YAZDIR.panel({ konu: bk && bk.acik ? bk.id : kz, bant: sinif.bant }); }); });
    kok.querySelectorAll('[data-ksec]').forEach(function (b) { b.addEventListener('click', function () { konuSec = b.getAttribute('data-ksec'); panel(); }); });
    kok.querySelectorAll('[data-sinif]').forEach(function (b) { b.addEventListener('click', function () { sinifI = +b.getAttribute('data-sinif'); panel(); }); });
    kok.querySelectorAll('.kt-konular [data-konu]').forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-konu'), k = V.konuBul(id); planKoy(sinif, bugunA, id, k ? 'Bugünün konusu ' + k.en + ' olarak kaydedildi. Çocuklar giriş yaptığında bu konuyu görecek.' : 'Bugün serbest gün olarak kaydedildi.'); }); });
    kok.querySelectorAll('[data-plan]').forEach(function (s) { s.addEventListener('change', function () { planKoy(sinif, s.getAttribute('data-plan'), s.value, 'Haftalık plan kaydedildi.'); }); });
    var oc = kok.querySelector('[data-ornek]'); if (oc) oc.addEventListener('change', function () { ornekGoster = this.checked; panel(); });
    kok.querySelector('[data-cikis]').addEventListener('click', function () { if (TOK) B.cikis(TOK); BU = null; TOK = null; V.koy('ogrOturum', null); giris(); });
    if (bildirim) { var bl = kok.querySelector('[data-bildirim]'); try { bl.scrollIntoView({ block: 'nearest' }); } catch (e) { } }
  }

  function okul_() { return okul(); }

  /* ---------- sınıf raporu ---------- */
  function seviye(n) { return n >= 3 ? 3 : n; }
  function rapor(sinif, kz) {
    var acik = V.KONU.filter(function (x) { return x.acik; }), ks = sinif.ogr.map(function (og) { return { og: og, k: kayit(sinif, og) }; });
    var p = W.KIDS_KONU.al(kz), kel = p ? p.ogeler(V.BANT[sinif.bant]) : [], kzK = V.konuBul(kz), top = {};
    kel.forEach(function (o) { top[o.id] = 0; }); ks.forEach(function (x) { kel.forEach(function (o) { top[o.id] += (x.k.zor || {})[o.id] || 0; }); });
    var biten = acik.map(function (t) { return ks.filter(function (x) { return x.k.bitti[t.id]; }).length; });
    return '<section class="kt-bolum kt-rapor" aria-labelledby="kt-r"><div class="kt-bolum-bas"><div><h2 id="kt-r">Sınıf raporu</h2><p class="kt-alt">' + esc(sinif.ad) + ' · not ve sıralama yok; hangi konuyu yeniden işlemek gerektiğini gösterir.</p></div>' +
      '<span class="kt-r-dug"><button type="button" class="kl-dugme kl-dugme-b kt-bulten-b" data-materyal>Materyal yazdır</button><button type="button" class="kl-dugme kt-bulten-b" data-bulten>Haftalık veli bültenini yazdır</button></span></div>' +
      /* konu tamamlama */
      '<h3 class="kt-r-bas">Konu tamamlama</h3><div class="kt-tablo-sar"><table class="kt-tablo kt-tamam-t"><thead><tr><th scope="col">Öğrenci</th>' + acik.map(function (t) { return '<th scope="col" title="' + esc(t.tr) + '"><span class="kt-th-r" style="--r:' + t.renk + '">' + C.simge(t.simge) + '</span><small lang="en">' + esc(t.en) + '</small></th>'; }).join('') + '</tr></thead><tbody>' +
      ks.map(function (x) {
        return '<tr' + (x.k.son ? '' : ' class="kt-pasif"') + '><th scope="row"><span class="kt-ogr">' + C.avatar(x.og[1]) + '<b>' + esc(x.og[0]) + '</b></span></th>' + acik.map(function (t) {
          var y = yildizSay(x.k, t.id), b = !!x.k.bitti[t.id];
          return '<td class="kt-hucre kt-y' + (b ? 'b' : y ? Math.min(3, Math.ceil(y / W.KIDS_KONU.yildizMax(t.id) * 3)) : 0) + '" style="--r:' + t.renk + '" title="' + esc(x.og[0] + ' · ' + t.en + ': ' + y + '/' + W.KIDS_KONU.yildizMax(t.id) + ' yıldız' + (b ? ', bitirdi' : '')) + '">' + (b ? '✓' : y ? y : '·') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody><tfoot><tr><th scope="row">Bitiren</th>' + biten.map(function (n) { return '<td class="kt-hucre-t">' + n + '/' + ks.length + '</td>'; }).join('') + '</tr></tfoot></table></div>' +
      '<p class="kt-lejant"><span class="kt-hucre kt-yb">✓</span> bitirdi <span class="kt-hucre kt-y3">7</span> 7-9 yıldız <span class="kt-hucre kt-y1">2</span> başladı <span class="kt-hucre kt-y0">·</span> henüz oynamadı</p>' +
      /* kelime ısı haritası */
      '<h3 class="kt-r-bas">Kelime ısı haritası <small lang="en">' + esc(kzK.en) + '</small></h3><p class="kt-alt">Hücredeki sayı, çocuğun o kelimede kaç kez yanıldığıdır. Kırmızılaşan sütun sınıfça yeniden işlenecek kelimedir. Konuyu yukarıdaki “Sınıf ilerlemesi”nden değiştirin.</p>' +
      '<div class="kt-tablo-sar"><table class="kt-tablo kt-isi"><thead><tr><th scope="col">Öğrenci</th>' + kel.map(function (o) { return '<th scope="col"><span class="kt-isi-r">' + p.gorsel(o) + '</span><small lang="en">' + esc(o.en) + '</small></th>'; }).join('') + '</tr></thead><tbody>' +
      ks.map(function (x) {
        var oynadi = oyunSay(x.k, kz) > 0;
        return '<tr><th scope="row"><span class="kt-ogr">' + C.avatar(x.og[1]) + '<b>' + esc(x.og[0]) + '</b></span></th>' + kel.map(function (o) { var z = (x.k.zor || {})[o.id] || 0; return '<td class="kt-isi-h kt-i' + (oynadi ? seviye(z) : 'x') + '" title="' + esc(x.og[0] + ' · ' + o.en + ': ' + (oynadi ? z + ' yanlış' : 'oynamadı')) + '">' + (oynadi ? (z || '') : '–') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody><tfoot><tr><th scope="row">Sınıf</th>' + kel.map(function (o) { return '<td class="kt-isi-h kt-i' + seviye(Math.ceil(top[o.id] / 2)) + '">' + top[o.id] + '</td>'; }).join('') + '</tr></tfoot></table></div>' +
      '<p class="kt-lejant"><span class="kt-isi-h kt-i0"></span> sorun yok <span class="kt-isi-h kt-i1">1</span> bir yanlış <span class="kt-isi-h kt-i2">2</span> iki <span class="kt-isi-h kt-i3">3+</span> zorlanıyor <span class="kt-isi-h kt-ix">–</span> konuyu oynamadı</p></section>';
  }

  /* ---------- haftalık veli bülteni (yazdır) ---------- */
  function bulten(sinif, kz) {
    var hafta = V.hafta(), gunler = hafta.map(function (d, i) { return { gun: GUN[i], d: d, k: V.konuBul(gunKonu(sinif, d)) }; }), konular = [];
    gunler.forEach(function (g) { if (g.k && konular.indexOf(g.k.id) < 0) konular.push(g.k.id); });
    if (!konular.length) konular.push(kz);
    var o = ozet(sinif, konular[0]), bant = V.BANT[sinif.bant], tarih = function (d) { return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2); };
    var h = '<article class="kt-bul"><header><span class="kt-bul-m">' + C.acadia({ mood: 'kutlama' }) + '</span><div><small>Acadex Kids · haftalık veli bülteni</small><h1>' + esc(okul().ad) + ' · ' + esc(sinif.ad) + '</h1><p>' + tarih(hafta[0]) + ' – ' + tarih(hafta[4]) + ' haftası · ' + esc(bant.ad + ' (' + bant.yas + ')') + '</p></div></header>' +
      '<p class="kt-bul-giris">Sevgili veliler, bu hafta sınıfta aşağıdaki konuları işledik. Çocuğunuz aynı konuları Acadex Kids’te oyunlarla tekrar edebilir. Evde günde 5–10 dakika yeter; Türkçe konuşun, İngilizce kelimeyi oyunun içinde söyleyin.</p>' +
      '<table class="kt-bul-plan"><tbody>' + gunler.map(function (g) { return '<tr><th>' + g.gun + ' <small>' + tarih(g.d) + '</small></th><td>' + (g.k ? '<b lang="en">' + esc(g.k.en) + '</b> · ' + esc(g.k.tr) : 'Serbest gün') + '</td></tr>'; }).join('') + '</tbody></table>' +
      konular.map(function (id) {
        var p = W.KIDS_KONU.al(id), k = V.konuBul(id); if (!p) return '';
        return '<section class="kt-bul-k"><h2><span style="--r:' + k.renk + '">' + C.simge(k.simge) + '</span><span lang="en">' + esc(k.en) + '</span> · ' + esc(k.tr) + '</h2>' +
          '<h3>Kelimeler</h3><ul class="kt-bul-kel">' + p.ogeler(bant).map(function (x) { return '<li><span>' + p.gorsel(x) + '</span><b lang="en">' + esc(x.en) + '</b><small>' + esc(x.tr) + '</small></li>'; }).join('') + '</ul>' +
          '<h3>Evde birlikte söyleyin</h3><ul class="kt-bul-ev">' + p.ev.map(function (c) { return '<li><b lang="en">' + esc(c[0]) + '</b> — ' + esc(c[1]) + '</li>'; }).join('') + '</ul>' +
          (p.etkinlik && p.etkinlik[0] ? '<h3>Evde 5 dakika: ' + esc(p.etkinlik[0].ad) + '</h3><p>' + esc(p.etkinlik[0].adim) + '</p>' : '') + '</section>';
      }).join('') +
      '<footer><p><b>Sınıfımız bu hafta:</b> ' + o.oynayan + ' / ' + o.n + ' çocuk Acadex Kids’te oynadı.' + (o.zor && V.ogeBul(o.zor) ? ' En çok tekrar edeceğimiz kelime: <b lang="en">' + esc(V.ogeBul(o.zor).en) + '</b>.' : '') + '</p>' +
      '<p class="kt-bul-k2">Çocuğunuzun kişisel ilerlemesini Acadex Kids’te <b>Veli</b> düğmesinin arkasındaki veli köşesinde görebilirsiniz. Bu bültende çocuklara ait kişisel bilgi yoktur.</p></footer></article>';
    var b = D.getElementById('kt-bulten'); if (!b) { b = D.createElement('div'); b.id = 'kt-bulten'; D.body.appendChild(b); }
    b.innerHTML = h; D.documentElement.classList.add('kt-yazdir');
    var bitir = function () { D.documentElement.classList.remove('kt-yazdir'); W.removeEventListener('afterprint', bitir); };
    W.addEventListener('afterprint', bitir);
    setTimeout(function () { try { W.print(); } catch (e) { } setTimeout(bitir, 1500); }, 60);
  }
  function planKoy(sinif, gun, konu, mesaj) {
    if (!BU) { V.planKoy(sinif.id, gun, konu); return panel(mesaj); }
    kok.querySelectorAll('.kt-konular button, [data-plan]').forEach(function (x) { x.disabled = true; });
    B.planKoy(TOK, sinif.id, gun, konu).then(function () { sinif.plan[gun] = konu; panel(mesaj); }, function (er) { if (er.tur === 'oturum' || er.tur === 'lisans') return cikisZorla(er); panel(); var bl = kok.querySelector('[data-bildirim]'); bl.textContent = '✗ ' + er.message; bl.classList.add('kt-var', 'kt-hata'); });
  }
  function cikisZorla(er) { BU = null; TOK = null; V.koy('ogrOturum', null); giris(er.tur === 'lisans' ? er.message : 'Oturumunuz kapandı; yeniden giriş yapın.'); }
  /* sunucudan okul, sınıflar, bu haftanın planı ve ilerleme */
  function yukle(token, mesaj) {
    TOK = token; kok.innerHTML = '<section class="kt-giris"><div class="kt-kart kt-yukle"><span>' + C.acadia({ mood: 'dusun' }) + '</span><p>Sınıflarınız yükleniyor…</p></div></section>';
    var h = V.hafta();
    B.ogretmenVeri(token, V.gunAnahtar(h[0]), V.gunAnahtar(h[4])).then(function (o) {
      if (!o.siniflar.length) { BU = null; kok.innerHTML = '<section class="kt-giris"><div class="kt-kart"><h1>' + esc(o.ad) + '</h1><p>Okulunuzda henüz sınıf tanımlı değil. Sınıflar ve öğrenci kartları Acadex tarafından hazırlanır; lütfen Acadex ile iletişime geçin.</p><button type="button" class="kl-dugme" data-cikis>Çıkış</button></div></section>'; kok.querySelector('[data-cikis]').addEventListener('click', function () { B.cikis(token); V.koy('ogrOturum', null); TOK = null; giris(); }); return; }
      BU = o; if (sinifI >= o.siniflar.length) sinifI = 0; panel(mesaj);
    }, function (er) {
      if (er.tur === 'ag') { kok.innerHTML = '<section class="kt-giris"><div class="kt-kart"><p>' + esc(er.message) + '</p><button type="button" class="kl-dugme" data-yine>Yeniden dene</button></div></section>'; kok.querySelector('[data-yine]').addEventListener('click', function () { yukle(token, mesaj); }); return; }
      cikisZorla(er);
    });
  }
  function ac() { kok = D.getElementById('kids-ogretmen'); if (!kok) return; var o = V.al('ogrOturum', null); BU = null; if (o && o.token) yukle(o.token); else if (o && o.kod === V.OKUL.kod) panel(); else giris(); }
  function kapat() { if (kok) kok.innerHTML = ''; }
  W.KIDS_OGRETMEN = { ac: ac, kapat: kapat, ornekKayit: ornekKayit, ozet: ozet, rapor: rapor, bulten: bulten };
})(window);
