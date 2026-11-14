/* ==========================================================================
   ACADEX KIDS · kreş yönetici paneli (kids/assets/kids-yonetici.js), 14.11.2026
   acadex.com.tr/kids/#yonetim · Kreş müdürü okul kodu + yönetici şifresiyle girer.
   Binlerce kreşi tek tek yönetim panelinden kurmak yerine her kreş kendini yönetir:
   - Sınıflar ve öğrenciler: sınıf aç, ad listesini Excel'den yapıştırarak toplu ekle
     (yalnız ad + soyadın baş harfi tutulur), resimli şifre yenile, sınıf değiştir, kapat.
   - Kart yazdır: A4'e 8 kart, "Evde oyna" QR'lı (kids-kart.js).
   - Öğretmenler: kişisel 6 haneli PIN (yalnız bir kez gösterilir), sınıf atama; okulun
     ortak öğretmen şifresi.
   - Lisans/deneme durumu: süre bitince kayıtlar görünür ama değiştirilemez.
   Sunucu: supabase/migrations/20261114_kids_kres.sql (kids_yonetici_*, kids_yon_*). Önek km-.
   W.KIDS_YONETICI
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, V = W.KIDS_VERI, B = W.KIDS_BULUT, kok, TOK = null, VERI = null, sekme = 'siniflar', sinifId = null, secili = {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var BANT = { minik: 'Minikler · 3-4 yaş', kasif: 'Kâşifler · 5-6 yaş', yildiz: 'Yıldızlar · 7-10 yaş' };
  var HAYVAN = { tavsan: 'Tavşan', ayi: 'Ayı', kedi: 'Kedi', civciv: 'Civciv', panda: 'Panda', kurbaga: 'Kurbağa', tilki: 'Tilki', kopek: 'Köpek' };
  var ODEME = { bekliyor: 'Ödeme bekliyor', odendi: 'Lisanslı', deneme: 'Deneme' };

  /* ---------- saf yardımcılar (tests/kids-kres.js) ---------- */
  /* sunucudaki kids_ad_kisalt ile aynı: "Ayşe Nur Kaya" → "Ayşe Nur K." */
  function adKisalt(s) { var w = String(s || '').trim().split(/\s+/).filter(Boolean); if (!w.length) return ''; if (w.length === 1) return w[0].slice(0, 40); return (w.slice(0, -1).join(' ') + ' ' + w[w.length - 1].charAt(0).toLocaleUpperCase('tr') + '.').slice(0, 40); }
  /* Excel'den yapıştırılan liste: her satır bir çocuk; "1. Ada Kaya", "Ada<TAB>Kaya", "Ada Kaya;5 yaş" */
  function adlariAyikla(metin) {
    return String(metin || '').split(/\r?\n/).map(function (l) {
      var p = l.split('\t').map(function (x) { return x.trim(); }).filter(Boolean);
      var s = (p.length >= 2 && !/\d/.test(p[1]) ? p[0] + ' ' + p[1] : (p[0] || '')).split(/[;,]/)[0];
      return s.replace(/^\s*\d+\s*[.)\-]?\s*/, '').replace(/\s+/g, ' ').trim();
    }).filter(function (s) { return s.length >= 2 && /\p{L}/u.test(s); }).slice(0, 100);
  }
  function kalanYazi(o) {
    if (!o.acik) return o.odeme === 'deneme' ? 'Deneme süreniz bitti' : 'Lisans süreniz bitti';
    return o.kalan_gun <= 0 ? 'Bugün son gün' : o.kalan_gun + ' gün kaldı';
  }

  /* ---------- giriş ---------- */
  function giris(hata, kodYaz) {
    kok.innerHTML = '<section class="kt-giris"><form class="kt-kart" data-f novalidate><div class="kt-giris-bas"><span>' + C.acadia({ mood: 'mutlu' }) + '</span><div><small>Acadex Kids</small><h1>Kreş yönetimi</h1></div></div>' +
      '<label>Okul kodu<input name="kod" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="13" value="' + esc(kodYaz || V.al('sonKod', '')) + '"></label>' +
      '<label>Yönetici şifresi<input name="sifre" type="password" autocomplete="current-password" maxlength="60"></label>' +
      '<p class="kt-uyari" role="alert">' + esc(hata || '') + '</p><button type="submit" class="kl-dugme">Giriş yap</button>' +
      '<p class="kt-ornek">Yönetici şifresini Acadex size iletir. Kreşiniz henüz kayıtlı değilse <a href="mailto:destek@acadex.com.tr">destek@acadex.com.tr</a> adresine yazın.</p>' +
      '<p class="kt-donus"><a href="#giris">← Giriş seçenekleri</a> · <a href="#ogretmen">Öğretmen girişi</a></p></form></section>';
    var f = kok.querySelector('[data-f]');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var kod = f.elements.kod.value.trim().toLocaleUpperCase('tr').replace(/İ/g, 'I').replace(/\s+/g, ''), sifre = f.elements.sifre.value;
      if (!kod || !sifre) return giris('Okul kodunu ve yönetici şifresini yazın.', kod);
      var b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Giriş yapılıyor…';
      B.yoneticiGiris(kod, sifre).then(function (r) {
        if (!r || !r.tamam) return giris('Okul kodu ya da yönetici şifresi hatalı.', kod);
        V.koy('sonKod', kod); V.koy('yonOturum', { kod: kod, token: r.token }); yukle(r.token);
      }, function (er) { giris(er.message, kod); });
    });
    try { (f.elements.kod.value ? f.elements.sifre : f.elements.kod).focus({ preventScroll: true }); } catch (e) { }
  }
  function cikisZorla(er) { TOK = null; VERI = null; V.koy('yonOturum', null); giris(er && er.tur !== 'oturum' ? er.message : 'Oturumunuz kapandı; yeniden giriş yapın.'); }
  function yukle(token, mesaj) {
    TOK = token;
    if (!VERI) kok.innerHTML = '<section class="kt-giris"><div class="kt-kart kt-yukle"><span>' + C.acadia({ mood: 'dusun' }) + '</span><p>Kreşiniz yükleniyor…</p></div></section>';
    B.yoneticiVeri(token).then(function (v) {
      VERI = v; if (!sinifId || !v.siniflar.some(function (s) { return s.id === sinifId; })) sinifId = v.siniflar[0] ? v.siniflar[0].id : null;
      panel(mesaj);
    }, function (er) {
      if (er.tur === 'ag') { kok.innerHTML = '<section class="kt-giris"><div class="kt-kart"><p>' + esc(er.message) + '</p><button type="button" class="kl-dugme" data-yine>Yeniden dene</button></div></section>'; kok.querySelector('[data-yine]').addEventListener('click', function () { yukle(token, mesaj); }); return; }
      cikisZorla(er);
    });
  }
  /* yazma çağrısı: hata olursa bildirimde gösterir, oturum/lisans sorununda girişe döner */
  function yaz(fn, args, mesaj) {
    kok.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
    return B.yon(fn, TOK, args).then(function (r) { yukle(TOK, mesaj); return r; }, function (er) {
      if (er.tur === 'oturum') { cikisZorla(er); throw er; }
      panel(); bildir('✗ ' + er.message, true); throw er;
    });
  }
  function bildir(m, hata) { var b = kok.querySelector('[data-bildirim]'); if (!b) return; b.textContent = m; b.className = 'kt-bildirim kt-var' + (hata ? ' kt-hata' : ''); try { b.scrollIntoView({ block: 'nearest' }); } catch (e) { } }

  /* ---------- panel ---------- */
  function panel(mesaj) {
    var o = VERI.okul, salt = !o.acik, kullan = Math.min(100, Math.round(100 * o.ogrenci / Math.max(1, o.kota)));
    var h = '<header class="kt-ust"><a class="kl-marka" href="#" aria-label="Acadex Kids tanıtım sayfası"><span>' + C.acadia({ mood: 'mutlu' }) + '</span><b>Acadex <i>Kids</i></b></a><span class="kt-okul"><b>' + esc(o.ad) + '</b><small>Kreş yönetimi · ' + esc(o.kod) + '</small></span>' +
      '<a class="kt-bag" href="#ogretmen">Öğretmen paneli</a><button type="button" class="kt-cikis" data-cikis>Çıkış</button></header>' +
      '<main class="kt-govde km-govde"><p class="kt-bildirim' + (mesaj ? ' kt-var' : '') + '" role="status" data-bildirim>' + (mesaj ? '✓ ' + esc(mesaj) : '') + '</p>' +
      '<section class="km-lisans' + (salt ? ' km-bitti' : o.odeme === 'deneme' ? ' km-deneme' : '') + '"><div><small>' + esc(ODEME[o.odeme] || o.odeme) + '</small><b>' + esc(kalanYazi(o)) + '</b><span>Bitiş: ' + esc(String(o.lisans_bit).split('-').reverse().join('.')) + '</span></div>' +
      '<div class="km-kota"><small>Öğrenci</small><b>' + o.ogrenci + ' <i>/ ' + o.kota + '</i></b><span class="km-cubuk"><i style="width:' + kullan + '%"></i></span></div>' +
      (salt ? '<p class="km-uyari">Kayıtlarınız duruyor ama değiştirilemez; çocuklar ve öğretmenler giriş yapamaz. Devam etmek için Acadex ile iletişime geçin.</p>' : o.odeme === 'deneme' ? '<p class="km-uyari">Deneme süresince her şey açık. Beğendiyseniz lisans için Acadex ile iletişime geçin; kayıtlarınız aynen devam eder.</p>' : '') + '</section>' +
      '<div class="kt-sekmeler km-sekmeler" role="tablist">' + [['siniflar', 'Sınıflar ve öğrenciler'], ['ogretmenler', 'Öğretmenler'], ['ayarlar', 'Ayarlar']].map(function (t) { return '<button type="button" role="tab" data-sekme="' + t[0] + '" aria-selected="' + (sekme === t[0]) + '"><b>' + t[1] + '</b></button>'; }).join('') + '</div>' +
      (sekme === 'siniflar' ? siniflarHtml(salt) : sekme === 'ogretmenler' ? ogretmenlerHtml(salt) : ayarlarHtml(salt)) + '</main>';
    kok.innerHTML = h;
    kok.querySelector('[data-cikis]').addEventListener('click', function () { V.koy('yonOturum', null); TOK = null; VERI = null; giris(); });
    kok.querySelectorAll('[data-sekme]').forEach(function (b) { b.addEventListener('click', function () { sekme = b.getAttribute('data-sekme'); panel(); }); });
    if (sekme === 'siniflar') siniflarBagla(salt); else if (sekme === 'ogretmenler') ogretmenlerBagla(salt); else ayarlarBagla(salt);
  }

  /* ---------- sınıflar ve öğrenciler ---------- */
  function sinifBul(id) { return VERI.siniflar.filter(function (s) { return s.id === id; })[0] || null; }
  function siniflarHtml(salt) {
    var S = sinifBul(sinifId), ogr = S ? S.ogr : [];
    return '<section class="km-bolum"><div class="km-siniflar">' + VERI.siniflar.map(function (s) { var n = s.ogr.filter(function (g) { return g.aktif; }).length; return '<button type="button" class="km-sinif" data-sinif="' + s.id + '" aria-pressed="' + (s.id === sinifId) + '"><b>' + esc(s.ad) + '</b><small>' + esc(BANT[s.bant]) + '</small><span>' + n + ' öğrenci</span></button>'; }).join('') +
      (salt ? '' : '<button type="button" class="km-sinif km-yeni" data-yenisinif>+ Sınıf aç</button>') + '</div>' +
      (!S ? '<p class="km-bos">Henüz sınıf yok. “Sınıf aç” ile başlayın: örneğin “Papatyalar”, Kâşifler (5-6 yaş).</p>' :
        '<div class="km-sinif-bas"><div><h2>' + esc(S.ad) + '</h2><p class="kt-alt">' + esc(BANT[S.bant]) + ' · ' + ogr.filter(function (g) { return g.aktif; }).length + ' etkin öğrenci</p></div><div class="km-arac">' +
        (salt ? '' : '<button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-sinifduz>Sınıfı düzenle</button>') +
        '<button type="button" class="kl-dugme kl-dugme-k" data-kartlar' + (ogr.some(function (g) { return g.aktif; }) ? '' : ' disabled') + '>Kartları yazdır</button></div></div>' +
        (salt ? '' : '<details class="km-ekle"' + (ogr.length ? '' : ' open') + '><summary>+ Öğrenci ekle</summary><div class="km-form"><label>Her satıra bir çocuk. Excel\'den ad ve soyad sütunlarını kopyalayıp yapıştırabilirsiniz.<textarea data-adlar rows="6" placeholder="Ada Kaya&#10;Mert Yılmaz&#10;Elif Sarı"></textarea></label>' +
          '<p class="km-onizle" data-onizle aria-live="polite"></p><p class="km-kvkk">KVKK: yalnız ad ve soyadın baş harfi kaydedilir (“Ada K.”). Her çocuğa bir hayvan resmi ve iki gizli resim verilir.</p><button type="button" class="kl-dugme kl-dugme-k" data-ekle disabled>Ekle</button></div></details>') +
        (ogr.length ? '<div class="km-toplu" data-toplu hidden><b data-ssay>0</b> seçili <button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-t="kart">Kart yazdır</button>' + (salt ? '' : '<button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-t="sifre">Gizli resimleri yenile</button><button type="button" class="kr-sil" data-t="sil">Sil</button>') + '</div>' +
          '<div class="kt-tablo-sar"><table class="kt-tablo km-tablo"><thead><tr><th scope="col"><input type="checkbox" data-hepsi aria-label="Hepsini seç"></th><th scope="col">Öğrenci</th><th scope="col">Gizli resimler</th><th scope="col">Kimlik</th><th scope="col">Durum</th><th scope="col"><span class="ka-gizli">İşlem</span></th></tr></thead><tbody>' +
          ogr.map(function (g) {
            return '<tr' + (g.aktif ? '' : ' class="kt-pasif"') + '><td><input type="checkbox" data-sec="' + g.id + '"' + (secili[g.id] ? ' checked' : '') + ' aria-label="' + esc(g.ad) + ' seç"></td><th scope="row"><span class="kt-ogr">' + C.avatar(g.hayvan) + '<b>' + esc(g.ad) + '</b></span></th>' +
              '<td><span class="km-sf">' + g.sifre.map(function (r) { return '<i title="' + esc(r) + '">' + C.simge(r) + '</i>'; }).join('') + '</span></td><td class="km-mono">' + esc(g.kimlik) + '</td>' +
              '<td>' + (salt ? (g.aktif ? 'Etkin' : 'Kapalı') : '<label class="km-anahtar"><input type="checkbox" data-aktif="' + g.id + '"' + (g.aktif ? ' checked' : '') + '><span>' + (g.aktif ? 'Etkin' : 'Kapalı') + '</span></label>') + '</td>' +
              '<td>' + (salt ? '' : '<button type="button" class="km-kucuk" data-ogrduz="' + g.id + '">Düzenle</button>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '')) + '</section>';
  }
  function siniflarBagla(salt) {
    var S = sinifBul(sinifId);
    kok.querySelectorAll('[data-sinif]').forEach(function (b) { b.addEventListener('click', function () { sinifId = b.getAttribute('data-sinif'); secili = {}; panel(); }); });
    var ys = kok.querySelector('[data-yenisinif]'); if (ys) ys.addEventListener('click', function () { sinifDuzenle(null); });
    var sd = kok.querySelector('[data-sinifduz]'); if (sd) sd.addEventListener('click', function () { sinifDuzenle(S); });
    var kb = kok.querySelector('[data-kartlar]'); if (kb) kb.addEventListener('click', function () { kartlar(S.ogr.filter(function (g) { return g.aktif; })); });
    var ta = kok.querySelector('[data-adlar]');
    if (ta) {
      var on = kok.querySelector('[data-onizle]'), eb = kok.querySelector('[data-ekle]');
      var guncelle = function () { var l = adlariAyikla(ta.value); eb.disabled = !l.length; on.innerHTML = l.length ? '<b>' + l.length + ' çocuk:</b> ' + l.map(function (x) { return esc(adKisalt(x)); }).join(', ') + (l.length + VERI.okul.ogrenci > VERI.okul.kota ? '<br><span class="km-hata">Kota yetmiyor: ' + VERI.okul.ogrenci + ' / ' + VERI.okul.kota + '</span>' : '') : ''; };
      ta.addEventListener('input', guncelle);
      eb.addEventListener('click', function () { var l = adlariAyikla(ta.value); yaz('ogrenci_ekle', { p_sinif: S.id, p_adlar: l }, l.length + ' öğrenci eklendi. Kartlarını yazdırabilirsiniz.').catch(function () { }); });
    }
    var toplu = kok.querySelector('[data-toplu]');
    function seciliGuncelle() { var ids = Object.keys(secili).filter(function (k) { return secili[k]; }); if (toplu) { toplu.hidden = !ids.length; toplu.querySelector('[data-ssay]').textContent = ids.length; } return ids; }
    kok.querySelectorAll('[data-sec]').forEach(function (c) { c.addEventListener('change', function () { secili[c.getAttribute('data-sec')] = c.checked; seciliGuncelle(); }); });
    var hp = kok.querySelector('[data-hepsi]'); if (hp) hp.addEventListener('change', function () { kok.querySelectorAll('[data-sec]').forEach(function (c) { c.checked = hp.checked; secili[c.getAttribute('data-sec')] = hp.checked; }); seciliGuncelle(); });
    seciliGuncelle();
    kok.querySelectorAll('[data-t]').forEach(function (b) {
      b.addEventListener('click', function () {
        var ids = seciliGuncelle(), t = b.getAttribute('data-t'), l = S.ogr.filter(function (g) { return secili[g.id]; });
        if (t === 'kart') return kartlar(l.filter(function (g) { return g.aktif; }));
        if (t === 'sifre' && W.confirm(ids.length + ' öğrencinin gizli resimleri değişsin mi? Eski kartları geçersiz olur; yeni kart basmanız gerekir.')) { secili = {}; yaz('ogrenci_sifre_yenile', { p_ids: ids }, 'Gizli resimler yenilendi; yeni kartları yazdırın.').catch(function () { }); }
        if (t === 'sil' && W.confirm(ids.length + ' öğrenci ve ilerlemeleri kalıcı olarak silinsin mi? Bu geri alınamaz. Yalnız ayrılan çocuklar için kullanın; geçici olarak kapatmak için “Durum”u kapatın.')) { secili = {}; yaz('ogrenci_sil', { p_ids: ids }, ids.length + ' öğrenci silindi.').catch(function () { }); }
      });
    });
    kok.querySelectorAll('[data-aktif]').forEach(function (c) { c.addEventListener('change', function () { yaz('ogrenci_guncelle', { p_id: c.getAttribute('data-aktif'), p: { aktif: c.checked } }, c.checked ? 'Öğrenci etkinleştirildi.' : 'Öğrenci kapatıldı; giriş yapamaz, kaydı durur.').catch(function () { }); }); });
    kok.querySelectorAll('[data-ogrduz]').forEach(function (b) { b.addEventListener('click', function () { ogrenciDuzenle(S.ogr.filter(function (g) { return g.id === b.getAttribute('data-ogrduz'); })[0], S); }); });
  }
  function kartlar(l) {
    if (!l.length) return bildir('Yazdırılacak etkin öğrenci yok.', true);
    var o = VERI.okul, liste = l.map(function (g) { var s = VERI.siniflar.filter(function (x) { return x.ogr.indexOf(g) >= 0; })[0]; var c = {}; for (var k in g) c[k] = g[k]; c.sinif_id = s ? s.id : null; return c; });
    if (!W.KIDS_KART.ac(o, liste, VERI.siniflar, { kok: location.origin + location.pathname })) bildir('Yeni sekme açılamadı; tarayıcının açılır pencere engelini bu site için kaldırın.', true);
  }
  /* küçük form penceresi (kids-kres.css .kr-katman) */
  function pencere(baslik, govde, dugme) {
    var el = D.createElement('div'); el.className = 'kr-katman';
    el.innerHTML = '<form class="kr-pen" role="dialog" aria-modal="true" novalidate><header class="kr-pen-bas"><div><h2>' + baslik + '</h2></div><button type="button" class="kr-kapat" data-kapat aria-label="Kapat">×</button></header><div class="kr-govde km-form">' + govde + '<p class="kt-uyari" data-uyari role="alert"></p></div>' +
      '<footer class="kr-pen-alt"><button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-kapat>Vazgeç</button>' + (dugme ? '<button type="submit" class="kl-dugme kl-dugme-k">' + dugme + '</button>' : '') + '</footer></form>';
    D.body.appendChild(el); D.body.classList.add('kr-acik');
    var kapat = function () { el.remove(); D.body.classList.remove('kr-acik'); D.removeEventListener('keydown', tus); };
    var tus = function (e) { if (e.key === 'Escape') kapat(); };
    D.addEventListener('keydown', tus);
    el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-kapat]')) kapat(); });
    var f = el.querySelector('input, select, textarea, [type=submit]'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { }
    return { el: el, form: el.querySelector('form'), kapat: kapat, uyari: function (m) { el.querySelector('[data-uyari]').textContent = m; } };
  }
  function sinifDuzenle(S) {
    var p = pencere(S ? 'Sınıfı düzenle' : 'Yeni sınıf', '<label>Sınıf adı<input name="ad" maxlength="60" value="' + esc(S ? S.ad : '') + '" placeholder="Örn. Papatyalar"></label>' +
      '<label>Yaş grubu<select name="bant">' + Object.keys(BANT).map(function (k) { return '<option value="' + k + '"' + ((S ? S.bant : 'kasif') === k ? ' selected' : '') + '>' + BANT[k] + '</option>'; }).join('') + '</select></label>' +
      '<p class="km-kvkk">Yaş grubu kelime sayısını, oyunların zorluğunu ve hikâye kitaplarını belirler.</p>' + (S ? '<button type="button" class="kr-sil" data-sinifsil>Sınıfı sil</button>' : ''), S ? 'Kaydet' : 'Sınıfı aç');
    p.form.addEventListener('submit', function (e) {
      e.preventDefault(); var ad = p.form.elements.ad.value.trim(); if (!ad) return p.uyari('Sınıfa bir ad verin.');
      p.kapat(); yaz('sinif_kaydet', { p_id: S ? S.id : null, p_ad: ad, p_bant: p.form.elements.bant.value }, S ? 'Sınıf kaydedildi.' : ad + ' sınıfı açıldı. Şimdi öğrencileri ekleyin.').then(function (id) { if (!S && id) sinifId = id; }, function () { });
    });
    var sil = p.el.querySelector('[data-sinifsil]');
    if (sil) sil.addEventListener('click', function () { if (!W.confirm(S.ad + ' sınıfı ve içindeki ' + S.ogr.length + ' öğrenci kalıcı olarak silinsin mi? Basılmış kartlar geçersiz olur. Bu geri alınamaz.')) return; p.kapat(); sinifId = null; yaz('sinif_sil', { p_id: S.id }, 'Sınıf silindi.').catch(function () { }); });
  }
  function ogrenciDuzenle(g, S) {
    var p = pencere(esc(g.ad), '<label>Ad<input name="ad" maxlength="60" value="' + esc(g.ad) + '"></label>' +
      '<label>Sınıf<select name="sinif">' + VERI.siniflar.map(function (s) { return '<option value="' + s.id + '"' + (s.id === S.id ? ' selected' : '') + '>' + esc(s.ad) + '</option>'; }).join('') + '</select></label>' +
      '<p class="km-kvkk">Hayvan resmi: <b>' + esc(HAYVAN[g.hayvan] || g.hayvan) + '</b> · Kimlik: <b class="km-mono">' + esc(g.kimlik) + '</b></p>' +
      '<div class="km-arac"><button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-kart>Kartını yazdır</button><button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-sifre>Gizli resimleri yenile</button></div>', 'Kaydet');
    p.form.addEventListener('submit', function (e) {
      e.preventDefault(); var ad = p.form.elements.ad.value.trim(), s = p.form.elements.sinif.value, d = {};
      if (ad && ad !== g.ad) d.ad = ad; if (s !== S.id) d.sinif_id = s;
      p.kapat(); if (!Object.keys(d).length) return;
      yaz('ogrenci_guncelle', { p_id: g.id, p: d }, 'Öğrenci kaydedildi.').catch(function () { });
    });
    p.el.querySelector('[data-kart]').addEventListener('click', function () { kartlar([g]); });
    p.el.querySelector('[data-sifre]').addEventListener('click', function () { if (!W.confirm(g.ad + ' için yeni gizli resimler üretilsin mi? Eski kartı geçersiz olur.')) return; p.kapat(); yaz('ogrenci_sifre_yenile', { p_ids: [g.id] }, 'Yeni gizli resimler hazır; kartını yeniden yazdırın.').catch(function () { }); });
  }

  /* ---------- öğretmenler ---------- */
  function ogretmenlerHtml(salt) {
    var o = VERI.okul, sad = {}; VERI.siniflar.forEach(function (s) { sad[s.id] = s.ad; });
    return '<section class="km-bolum"><div class="km-sinif-bas"><div><h2>Öğretmenler</h2><p class="kt-alt">Her öğretmene kişisel bir PIN verin. PIN\'le giren öğretmen yalnız kendi sınıflarını görür ve planlar.</p></div>' +
      (salt ? '' : '<div class="km-arac"><button type="button" class="kl-dugme kl-dugme-k" data-yeniogt>+ Öğretmen ekle</button></div>') + '</div>' +
      (VERI.ogretmenler.length ? '<ul class="km-ogretmenler">' + VERI.ogretmenler.map(function (t) {
        return '<li' + (t.aktif ? '' : ' class="kt-pasif"') + '><div><b>' + esc(t.ad) + '</b><small>' + (t.siniflar.length ? t.siniflar.map(function (id) { return esc(sad[id] || '?'); }).join(', ') : 'Bütün sınıflar') + (t.aktif ? '' : ' · kapalı') + '</small></div>' +
          (salt ? '' : '<button type="button" class="km-kucuk" data-ogtduz="' + t.id + '">Düzenle</button><button type="button" class="km-kucuk" data-ogtpin="' + t.id + '">Yeni PIN</button>') + '</li>';
      }).join('') + '</ul>' : '<p class="km-bos">Henüz öğretmen eklenmedi. Öğretmenler şimdilik okulun ortak şifresiyle girebilir.</p>') +
      '<div class="km-kutu"><h3>Okulun ortak öğretmen şifresi</h3><p>' + (o.ogretmen_sifre_var ? 'Tanımlı. Bu şifreyle giren her öğretmen bütün sınıfları görür.' : 'Tanımlı değil.') + ' Kişisel PIN daha güvenlidir; ortak şifreyi yalnız gerekirse kullanın.</p>' +
      (salt ? '' : '<button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-okulsifre>' + (o.ogretmen_sifre_var ? 'Ortak şifreyi yenile' : 'Ortak şifre oluştur') + '</button>') + '</div>' +
      '<p class="kt-not">Öğretmenler <b>acadex.com.tr/kids</b> adresinde “Öğretmen girişi”nden okul kodu <b>' + esc(o.kod) + '</b> ve PIN\'leriyle girer.</p></section>';
  }
  function gizliGoster(baslik, deger, aciklama) {
    var p = pencere(baslik, '<p class="km-gizli-d" aria-live="polite">' + esc(deger) + '</p><p>' + aciklama + '</p><p class="km-kvkk">Bu değer yalnız şimdi gösterilir; kaydedilmez. Unutulursa yenisini üretirsiniz.</p>', null);
    return p;
  }
  function ogretmenDuzenle(t) {
    var p = pencere(t ? 'Öğretmeni düzenle' : 'Yeni öğretmen', '<label>Ad<input name="ad" maxlength="40" value="' + esc(t ? t.ad : '') + '" placeholder="Örn. Ayşe Öğretmen"></label>' +
      '<fieldset class="km-siniflar-sec"><legend>Sınıfları <small>(hiçbiri seçilmezse bütün sınıfları görür)</small></legend>' + VERI.siniflar.map(function (s) { return '<label><input type="checkbox" name="sinif" value="' + s.id + '"' + (t && t.siniflar.indexOf(s.id) >= 0 ? ' checked' : '') + '> ' + esc(s.ad) + '</label>'; }).join('') + '</fieldset>' +
      (t ? '<label class="km-anahtar"><input type="checkbox" name="aktif"' + (t.aktif ? ' checked' : '') + '><span>Etkin (kapatılırsa giriş yapamaz)</span></label><button type="button" class="kr-sil" data-ogtsil>Öğretmeni sil</button>' : ''), t ? 'Kaydet' : 'Ekle ve PIN üret');
    p.form.addEventListener('submit', function (e) {
      e.preventDefault(); var ad = p.form.elements.ad.value.trim(); if (ad.length < 2) return p.uyari('Öğretmenin adını yazın.');
      var sn = Array.prototype.filter.call(p.form.querySelectorAll('[name=sinif]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
      p.kapat();
      yaz('ogretmen_kaydet', { p_id: t ? t.id : null, p_ad: ad, p_siniflar: sn, p_aktif: t ? p.form.elements.aktif.checked : null }, t ? 'Öğretmen kaydedildi.' : ad + ' eklendi.').then(function (r) {
        if (r && r.pin) gizliGoster(esc(ad) + ' için PIN', r.pin, 'Öğretmen, okul kodu <b>' + esc(VERI.okul.kod) + '</b> ve bu PIN ile “Öğretmen girişi”nden girer.');
      }, function () { });
    });
    var sil = p.el.querySelector('[data-ogtsil]');
    if (sil) sil.addEventListener('click', function () { if (!W.confirm(t.ad + ' silinsin mi? PIN\'i hemen geçersiz olur.')) return; p.kapat(); yaz('ogretmen_sil', { p_id: t.id }, 'Öğretmen silindi.').catch(function () { }); });
  }
  function ogretmenlerBagla() {
    var y = kok.querySelector('[data-yeniogt]'); if (y) y.addEventListener('click', function () { ogretmenDuzenle(null); });
    kok.querySelectorAll('[data-ogtduz]').forEach(function (b) { b.addEventListener('click', function () { ogretmenDuzenle(VERI.ogretmenler.filter(function (t) { return t.id === b.getAttribute('data-ogtduz'); })[0]); }); });
    kok.querySelectorAll('[data-ogtpin]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = VERI.ogretmenler.filter(function (x) { return x.id === b.getAttribute('data-ogtpin'); })[0];
        if (!W.confirm(t.ad + ' için yeni PIN üretilsin mi? Eski PIN hemen geçersiz olur.')) return;
        yaz('ogretmen_pin', { p_id: t.id }, 'Yeni PIN üretildi.').then(function (pin) { gizliGoster(esc(t.ad) + ' için yeni PIN', pin, 'Eski PIN artık çalışmaz.'); }, function () { });
      });
    });
    var os = kok.querySelector('[data-okulsifre]');
    if (os) os.addEventListener('click', function () {
      if (VERI.okul.ogretmen_sifre_var && !W.confirm('Ortak şifre yenilensin mi? Eski şifreyle açık öğretmen oturumları kapanır.')) return;
      yaz('okul_sifre', {}, 'Ortak öğretmen şifresi hazır.').then(function (s) { gizliGoster('Okulun ortak öğretmen şifresi', s, 'Bu şifreyle giren her öğretmen bütün sınıfları görür.'); }, function () { });
    });
  }

  /* ---------- ayarlar ---------- */
  function ayarlarHtml() {
    var o = VERI.okul;
    return '<section class="km-bolum"><div class="km-kutu"><h3>Kreş bilgileri</h3><dl class="km-dl"><dt>Kreş</dt><dd>' + esc(o.ad) + '</dd><dt>Okul kodu</dt><dd class="km-mono">' + esc(o.kod) + '</dd><dt>İl / ilçe</dt><dd>' + esc([o.il, o.ilce].filter(Boolean).join(' / ')) + '</dd><dt>Yetkili</dt><dd>' + esc(o.yetkili_ad) + '</dd></dl><p class="km-kvkk">Bilgilerde değişiklik için Acadex ile iletişime geçin.</p></div>' +
      '<div class="km-kutu"><h3>Yönetici şifresini değiştir</h3><form class="km-form" data-sf novalidate><label>Mevcut şifre<input name="eski" type="password" autocomplete="current-password"></label><label>Yeni şifre (en az 8 karakter)<input name="yeni" type="password" autocomplete="new-password" minlength="8"></label><p class="kt-uyari" data-sfu role="alert"></p><button type="submit" class="kl-dugme kl-dugme-k">Şifreyi değiştir</button></form></div>' +
      '<div class="km-kutu"><h3>Evde oyna kartları</h3><p>Her çocuğun kartında bir QR var. Veli telefonla okutunca Acadex Kids doğrudan çocuğun gizli resim ekranında açılır; çocuk evde kaldığı yerden devam eder. QR\'da şifre yoktur ve tarayıcıda üretilir, başka bir siteye gönderilmez.</p></div></section>';
  }
  function ayarlarBagla() {
    var f = kok.querySelector('[data-sf]'); if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var u = kok.querySelector('[data-sfu]'), y = f.elements.yeni.value;
      if (y.length < 8) { u.textContent = 'Yeni şifre en az 8 karakter olmalı.'; return; }
      B.yon('sifre_degistir', TOK, { p_eski: f.elements.eski.value, p_yeni: y }).then(function () { f.reset(); bildir('✓ Yönetici şifresi değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.'); }, function (er) { if (er.tur === 'oturum') return cikisZorla(er); u.textContent = er.message; });
    });
  }

  function ac() { kok = D.getElementById('kids-yonetim'); if (!kok) return; var o = V.al('yonOturum', null); if (o && o.token) yukle(o.token); else giris(); }
  function kapat() { if (kok) kok.innerHTML = ''; VERI = null; }
  W.KIDS_YONETICI = { ac: ac, kapat: kapat, adKisalt: adKisalt, adlariAyikla: adlariAyikla, kalanYazi: kalanYazi };
})(window);
