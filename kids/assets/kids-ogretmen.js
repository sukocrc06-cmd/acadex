/* ==========================================================================
   ACADEX KIDS · öğretmen paneli (kids/assets/kids-ogretmen.js), 10.11.2026
   Öğretmenin tek işi: günün konusunu seçmek. İsterse haftayı önceden planlar ve
   sınıfın ilerlemesine bakar. Ödev vermek, not girmek, içerik hazırlamak yok.
   - Günün konusu / haftalık plan: KIDS_VERI.planKoy ile saklanır; çocuk giriş
     yaptığında haritanın üstünde o konu çıkar ('' = serbest gün).
   - Sınıf ilerleme tablosu: bu tarayıcıda oynayan çocukların gerçek kaydı
     (kids.il.<okul>.<sinif>.<ad>) + etiketli örnek veri (kapatılabilir).
   Gerçek okul: okul kodu + yönetim panelinin ürettiği şifre (kids-bulut.js → Supabase);
   plan ve ilerleme sunucudan gelir. Örnek okul (ORNEK-2026 / 1234) yalnız tanıtım
   içindir ve bu tarayıcıda çalışır. Önek kt-. W.KIDS_OGRETMEN
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, V = W.KIDS_VERI, B = W.KIDS_BULUT, kok, sinifI = 0, ornekGoster = true, BU = null, TOK = null;
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
    return { ornek: true, yildiz: { colours: yl }, bitti: y ? { colours: 1 } : {}, zor: zor, cikartma: y ? ['gokkusagi'] : [], son: Date.now() - (h % 4) * 864e5 - (h % 9) * 36e5 };
  }
  function kayit(sinif, og) {
    var ad = og[0];
    if (BU) { var u = og[3] || {}; return { yildiz: u.yildiz || {}, bitti: u.bitti || {}, zor: u.zor || {}, cikartma: u.cikartma || [], son: u.son || 0 }; }
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
  function renkBul(id) { return V.RENK.filter(function (r) { return r.id === id; })[0]; }
  function ozet(sinif) {
    var ks = sinif.ogr.map(function (o) { return kayit(sinif, o); }), hafta0 = V.hafta()[0].getTime();
    var oynayan = ks.filter(function (k) { return k.son >= hafta0; }).length, giren = ks.filter(function (k) { return k.son; });
    var top = giren.reduce(function (t, k) { return t + yildizSay(k, 'colours'); }, 0), zor = {};
    ks.forEach(function (k) { Object.keys(k.zor).forEach(function (r) { zor[r] = (zor[r] || 0) + k.zor[r]; }); });
    return { n: ks.length, oynayan: oynayan, ort: giren.length ? top / giren.length : 0, biten: ks.filter(function (k) { return k.bitti.colours; }).length, zor: enZor(zor), girmeyen: sinif.ogr.filter(function (o, i) { return !ks[i].son; }).map(function (o) { return o[0]; }) };
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
    var okul = okul_(), sinif = okul.siniflar[sinifI], bugun = new Date(), bk = V.konuBul(gunKonu(sinif, bugun)), hafta = V.hafta(), bugunA = V.gunAnahtar(), o = ozet(sinif), zr = o.zor && renkBul(o.zor);
    var h = '<header class="kt-ust"><a class="kl-marka" href="#" aria-label="Acadex Kids tanıtım sayfası"><span>' + C.acadia({ mood: 'mutlu' }) + '</span><b>Acadex <i>Kids</i></b></a><span class="kt-okul"><b>' + esc(okul.ad) + '</b><small>Öğretmen paneli</small></span>' +
      '<a class="kt-bag" href="#oyna">Çocuk ekranını aç</a><button type="button" class="kt-cikis" data-cikis>Çıkış</button></header>' +
      '<main class="kt-govde"><div class="kt-sekmeler" role="tablist" aria-label="Sınıflar">' + okul.siniflar.map(function (s, i) { return '<button type="button" role="tab" aria-selected="' + (i === sinifI) + '" data-sinif="' + i + '" style="--r:' + s.renk + '"><b>' + esc(s.ad) + '</b><small>' + esc(V.BANT[s.bant].ad + ' · ' + V.BANT[s.bant].yas) + '</small></button>'; }).join('') + '</div>' +
      '<p class="kt-bildirim' + (bildirim ? ' kt-var' : '') + '" role="status" data-bildirim>' + (bildirim ? '✓ ' + esc(bildirim) : '') + '</p>' +

      /* bugün */
      '<section class="kt-bugun" aria-labelledby="kt-b"><div class="kt-bugun-sol"><small>' + esc(tarihUzun(bugun)) + '</small><h2 id="kt-b">Bugünün konusu</h2>' +
      '<div class="kt-simdi" style="--r:' + (bk ? bk.renk : '#E3E8F2') + '"><span>' + (bk ? C.ada(bk.renk, bk.simge, false) : C.acadia({ mood: 'mutlu' })) + '</span><div>' + (bk ? '<b lang="en">' + esc(bk.en) + '</b><em>' + esc(bk.tr) + '</em>' : '<b>Serbest gün</b><em>Çocuk istediği adayı seçer</em>') + '</div></div>' +
      (bk ? '<blockquote class="kt-soz"><small>Sınıfta söylemeniz yeter</small>“Çocuklar, bugün öğrendiğimiz <b>' + esc(kucuk(bk.tr)) + '</b> konusunu Acadex Kids’te oynayarak tekrar etmeyi unutmayın!”</blockquote>' : '') + '</div>' +
      '<div class="kt-bugun-sag"><h3>Konuyu değiştir</h3><div class="kt-konular" data-gun="' + bugunA + '">' + V.KONU.map(function (k) { return konuDugme(k, bk && bk.id === k.id); }).join('') +
      '<button type="button" class="kt-konu kt-serbest' + (bk ? '' : ' kt-secili') + '" data-konu="" aria-pressed="' + !bk + '"><span>' + C.acadia({ mood: 'mutlu' }) + '</span><b>Serbest gün</b><small>Konu yok</small></button></div>' +
      '<p class="kt-not">Şu an oynanabilen konu: Colours. Diğer konular içerikleri hazır olduğunda açılır.</p></div></section>' +

      /* haftalık plan */
      '<section class="kt-bolum" aria-labelledby="kt-h"><h2 id="kt-h">Haftalık plan</h2><p class="kt-alt">İsterseniz haftayı önceden planlayın; her sabah yeniden seçmeniz gerekmez.</p><div class="kt-hafta">' +
      hafta.map(function (d, i) {
        var a = V.gunAnahtar(d), kid = gunKonu(sinif, d), k = V.konuBul(kid);
        return '<label class="kt-gun' + (a === bugunA ? ' kt-gun-bugun' : '') + '" style="--r:' + (k ? k.renk : '#EEF2F8') + '"><span class="kt-gun-ad">' + GUN[i] + '<small>' + ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + (a === bugunA ? ' · bugün' : '') + '</small></span><span class="kt-gun-r">' + (k ? C.simge(k.simge) : '') + '</span>' +
          '<select data-plan="' + a + '" aria-label="' + GUN[i] + ' konusu"><option value=""' + (k ? '' : ' selected') + '>Serbest gün</option>' + V.KONU.map(function (x) { return '<option value="' + x.id + '"' + (x.id === kid ? ' selected' : '') + (x.acik ? '' : ' disabled') + '>' + esc(x.en + ' · ' + x.tr) + (x.acik ? '' : ' (yakında)') + '</option>'; }).join('') + '</select></label>';
      }).join('') + '</div></section>' +

      /* ilerleme */
      '<section class="kt-bolum" aria-labelledby="kt-i"><div class="kt-bolum-bas"><div><h2 id="kt-i">Sınıf ilerlemesi</h2><p class="kt-alt">' + esc(sinif.ad) + ' · Colours konusu</p></div>' +
      (BU ? '' : '<label class="kt-anahtar"><input type="checkbox" data-ornek' + (ornekGoster ? ' checked' : '') + '><span>Örnek veriyi göster</span></label>') + '</div>' +
      '<ul class="kt-ozet"><li><b>' + o.oynayan + '<small>/' + o.n + '</small></b><span>bu hafta oynadı</span></li><li><b>' + (Math.round(o.ort * 10) / 10).toString().replace('.', ',') + '<small>/9 ★</small></b><span>ortalama yıldız</span></li><li><b>' + o.biten + '<small>/' + o.n + '</small></b><span>konuyu bitirdi</span></li>' +
      '<li' + (zr ? ' style="--r:' + zr.hex + '"' : '') + ' class="kt-ozet-zor"><b>' + (zr ? '<i></i><span lang="en">' + zr.en + '</span>' : '—') + '</b><span>en çok zorlanılan kelime</span></li></ul>' +
      (o.girmeyen.length ? '<p class="kt-girmeyen"><b>Henüz girmeyenler:</b> ' + o.girmeyen.map(esc).join(', ') + '</p>' : '') +
      '<div class="kt-tablo-sar"><table class="kt-tablo"><thead><tr><th scope="col">Öğrenci</th><th scope="col">Son giriş</th><th scope="col">Yıldız</th><th scope="col">Oyunlar</th><th scope="col">Zorlandığı kelime</th><th scope="col">Çıkartma</th></tr></thead><tbody>' +
      sinif.ogr.map(function (og) {
        var k = kayit(sinif, og), y = yildizSay(k, 'colours'), z = enZor(k.zor), zrk = z && renkBul(z);
        return '<tr' + (k.son ? '' : ' class="kt-pasif"') + '><th scope="row"><span class="kt-ogr">' + C.avatar(og[1]) + '<b>' + esc(og[0]) + '</b>' + (k.ornek ? '<i class="kt-ornek-e">örnek</i>' : '') + '</span></th><td>' + sonYazi(k.son) + '</td>' +
          '<td><span class="kt-cubuk" role="img" aria-label="' + y + ' / 9 yıldız"><i style="width:' + Math.round(100 * y / 9) + '%"></i></span><span class="kt-sayi">' + y + '/9</span></td>' +
          '<td>' + oyunSay(k, 'colours') + '/3' + (k.bitti.colours ? ' <span class="kt-tamam">bitirdi</span>' : '') + '</td>' +
          '<td>' + (zrk ? '<span class="kt-kelime" style="--r:' + zrk.hex + '"><i></i><span lang="en">' + zrk.en + '</span> <small>' + k.zor[z] + ' yanlış</small></span>' : '<span class="kt-yok">—</span>') + '</td><td>' + k.cikartma.length + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (BU ? '<p class="kt-not">Kayıtlar çocukların kendi oturumlarından gelir; sayfayı yenileyince güncellenir.</p>' : '<p class="kt-not">Örnek okul: gerçek kayıtlar bu tarayıcıda oynanan oturumlardan gelir; “örnek” etiketli satırlar tasarımı göstermek için üretilmiştir.</p>') + '</section></main>';
    kok.innerHTML = h;
    kok.querySelectorAll('[data-sinif]').forEach(function (b) { b.addEventListener('click', function () { sinifI = +b.getAttribute('data-sinif'); panel(); }); });
    kok.querySelectorAll('.kt-konular [data-konu]').forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-konu'), k = V.konuBul(id); planKoy(sinif, bugunA, id, k ? 'Bugünün konusu ' + k.en + ' olarak kaydedildi. Çocuklar giriş yaptığında bu konuyu görecek.' : 'Bugün serbest gün olarak kaydedildi.'); }); });
    kok.querySelectorAll('[data-plan]').forEach(function (s) { s.addEventListener('change', function () { planKoy(sinif, s.getAttribute('data-plan'), s.value, 'Haftalık plan kaydedildi.'); }); });
    var oc = kok.querySelector('[data-ornek]'); if (oc) oc.addEventListener('change', function () { ornekGoster = this.checked; panel(); });
    kok.querySelector('[data-cikis]').addEventListener('click', function () { if (TOK) B.cikis(TOK); BU = null; TOK = null; V.koy('ogrOturum', null); giris(); });
    if (bildirim) { var bl = kok.querySelector('[data-bildirim]'); try { bl.scrollIntoView({ block: 'nearest' }); } catch (e) { } }
  }

  function okul_() { return okul(); }
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
  W.KIDS_OGRETMEN = { ac: ac, kapat: kapat, ornekKayit: ornekKayit, ozet: ozet };
})(window);
