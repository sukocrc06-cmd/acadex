/* ==========================================================================
   ACADEX KIDS · "Kreşim için teklif al" (kids/assets/kids-teklif.js), 15.11.2026
   Tanıtım sayfasının üst barındaki parlayan buton (ve #teklif bağlantısı) bu pencereyi açar.
   Kreş adı, yetkili ve e-posta zorunlu; telefon, il/ilçe, öğrenci sayısı, mesaj isteğe bağlı.
   İstek kids_basvuru_yap ile gider ve yönetim paneli › Kids › İstekler'e düşer
   (supabase/migrations/20261115_kids_istek.sql). Çocuk verisi yoktur; yalnız kreş yetkilisi.
   Eski #basvuru ve #demo bağlantıları da bu pencereyi açar.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, katman = null, onceki = null, gonderiliyor = false;
  var HASH = /^#\/?(teklif|basvuru|demo)$/;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function acd(m) { try { return W.KIDS_CIZ.acadia({ mood: m }); } catch (e) { return ''; } }
  function alan(ad, etiket, ek, zorunlu, ipucu) {
    return '<label class="ktf-alan' + (ek.genis ? ' ktf-genis' : '') + '"><span>' + etiket + (zorunlu ? ' <i aria-hidden="true">*</i>' : ' <small>(isteğe bağlı)</small>') + '</span>' +
      (ek.tur === 'textarea' ? '<textarea name="' + ad + '" rows="3" maxlength="500"' + (ek.ph ? ' placeholder="' + esc(ek.ph) + '"' : '') + '></textarea>'
        : '<input name="' + ad + '" type="' + (ek.tur || 'text') + '"' + (zorunlu ? ' required aria-required="true"' : '') + (ek.ac ? ' autocomplete="' + ek.ac + '"' : '') + (ek.max ? ' maxlength="' + ek.max + '"' : '') +
          (ek.im ? ' inputmode="' + ek.im + '"' : '') + (ek.ph ? ' placeholder="' + esc(ek.ph) + '"' : '') + (ek.odak ? ' data-odak' : '') + '>') +
      (ipucu ? '<em class="ktf-ipucu">' + ipucu + '</em>' : '') + '<b class="ktf-hata" data-hata="' + ad + '" role="alert"></b></label>';
  }
  function formHtml() {
    return '<header class="kr-pen-bas ktf-bas"><span class="ktf-acd" aria-hidden="true">' + acd('mutlu') + '</span><div><h2 id="ktf-baslik">Kreşiniz için teklif alın</h2>' +
      '<p>Bilgilerinizi bırakın; <b>1 iş günü içinde</b> kreşinize özel fiyat teklifiyle size dönelim.</p></div>' +
      '<button type="button" class="kr-kapat" data-kapat aria-label="Kapat">×</button></header>' +
      '<form class="kr-govde ktf-form" novalidate>' +
      alan('kres_ad', 'Kreşin adı', { max: 120, ac: 'organization', ph: 'Papatya Anaokulu', odak: true, genis: true }, true) +
      alan('yetkili_ad', 'Yetkili kişi', { max: 80, ac: 'name', ph: 'Adınız soyadınız' }, true) +
      alan('eposta', 'E-posta', { tur: 'email', max: 120, ac: 'email', im: 'email', ph: 'ornek@kresiniz.com' }, true) +
      alan('tel', 'Telefon', { tur: 'tel', max: 20, ac: 'tel', im: 'tel', ph: '0 5xx xxx xx xx' }, false) +
      alan('ogrenci_sayi', 'Öğrenci sayısı', { im: 'numeric', max: 4, ph: '30' }, false) +
      alan('il', 'İl', { max: 40, ac: 'address-level1', ph: 'Ankara' }, false) +
      alan('ilce', 'İlçe', { max: 60, ac: 'address-level2', ph: 'Çankaya' }, false) +
      alan('mesaj', 'Notunuz', { tur: 'textarea', genis: true, ph: 'Ne zaman başlamak istersiniz, kaç sınıfınız var…' }, false) +
      '<label class="ktf-onay ktf-genis"><input type="checkbox" name="kvkk"> <span><a href="/kvkk.html" target="_blank" rel="noopener">Aydınlatma metnini</a> okudum; bu bilgilerle benimle iletişime geçilmesini kabul ediyorum.</span></label>' +
      '<b class="ktf-hata ktf-genis" data-hata="genel" role="alert"></b>' +
      '<div class="ktf-alt ktf-genis"><button type="submit" class="kl-dugme ktf-gonder">Teklif iste</button><span>Teklif istemek bağlayıcı değildir.</span></div></form>';
  }
  function tesekkur(ad) {
    return '<header class="kr-pen-bas ktf-bas ktf-bas-bos"><button type="button" class="kr-kapat" data-kapat aria-label="Kapat">×</button></header>' +
      '<div class="kr-govde ktf-tamam"><span class="ktf-acd-b" aria-hidden="true">' + acd('kutlama') + '</span><h2 id="ktf-baslik" tabindex="-1">Teşekkürler!</h2>' +
      '<p><b>' + esc(ad) + '</b> için isteğinizi aldık. En geç 1 iş günü içinde e-postayla size dönüyoruz.</p>' +
      '<p class="ktf-bu-arada">Bu arada bir oyunu deneyebilirsiniz.</p><div class="ktf-alt"><a class="kl-dugme kl-dugme-b" href="#dene" data-kapat>Bir oyunu deneyin</a></div></div>';
  }
  function hata(f, ad, metin) { var h = katman.querySelector('[data-hata="' + ad + '"]'); if (h) h.textContent = metin || ''; var i = f && f.elements[ad]; if (i && i.setAttribute) { if (metin) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); } }
  /* tarayıcıda ilk denetim (sunucu da aynı kuralları uygular) */
  function denetle(v) {
    var h = {};
    if (v.kres_ad.length < 2) h.kres_ad = 'Kreşinizin adını yazın.';
    if (v.yetkili_ad.length < 2) h.yetkili_ad = 'Yetkili kişinin adını yazın.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.eposta)) h.eposta = 'Geçerli bir e-posta adresi yazın.';
    if (v.tel && !/^[0-9 +()-]{10,20}$/.test(v.tel)) h.tel = 'Telefonu 0 5xx xxx xx xx biçiminde yazın ya da boş bırakın.';
    if (v.ogrenci_sayi && !/^[0-9]{1,4}$/.test(v.ogrenci_sayi)) h.ogrenci_sayi = 'Öğrenci sayısı rakam olmalı.';
    if (!v.kvkk) h.genel = 'Devam etmek için aydınlatma metnini onaylayın.';
    return h;
  }
  function bagla() {
    var f = katman.querySelector('form');
    katman.querySelectorAll('[data-kapat]').forEach(function (b) { b.addEventListener('click', function () { kapat(); }); });
    if (!f) return;
    var temizle = function (e) { var n = e.target.name; if (!n) return; hata(f, n === 'kvkk' ? 'genel' : n, ''); };
    f.addEventListener('input', temizle); f.addEventListener('change', temizle);
    f.addEventListener('submit', function (e) {
      e.preventDefault(); if (gonderiliyor) return;
      var v = {}; ['kres_ad', 'yetkili_ad', 'eposta', 'tel', 'ogrenci_sayi', 'il', 'ilce', 'mesaj'].forEach(function (k) { v[k] = (f.elements[k].value || '').trim(); });
      v.kvkk = f.elements.kvkk.checked;
      ['kres_ad', 'yetkili_ad', 'eposta', 'tel', 'ogrenci_sayi', 'genel'].forEach(function (k) { hata(f, k, ''); });
      var h = denetle(v), ilk = Object.keys(h)[0];
      if (ilk) { Object.keys(h).forEach(function (k) { hata(f, k, h[k]); }); var i = f.elements[ilk]; if (i && i.focus) i.focus(); return; }
      var btn = f.querySelector('[type=submit]'); gonderiliyor = true; btn.disabled = true; btn.textContent = 'Gönderiliyor…';
      W.KIDS_BULUT.teklif(v).then(function (r) {
        if (r && r.tamam) { katman.querySelector('.kr-pen').innerHTML = tesekkur(v.kres_ad); bagla(); var b = katman.querySelector('#ktf-baslik'); if (b) b.focus(); return; }
        hata(f, (r && r.alan) || 'genel', (r && r.mesaj) || 'Gönderilemedi. Lütfen yeniden deneyin.');
      }, function (er) { hata(f, 'genel', (er && er.message) || 'Bağlantı kurulamadı. İnternetinizi kontrol edip yeniden deneyin.'); })
        .then(function () { gonderiliyor = false; if (btn.isConnected) { btn.disabled = false; btn.textContent = 'Teklif iste'; } });
    });
  }
  function tus(e) {
    if (!katman) return;
    if (e.key === 'Escape') { e.preventDefault(); kapat(); return; }
    if (e.key !== 'Tab') return;   /* odak pencerede kalır */
    var o = [].slice.call(katman.querySelectorAll('a[href],button:not([disabled]),input,textarea,[tabindex="0"]')); if (!o.length) return;
    if (e.shiftKey && D.activeElement === o[0]) { e.preventDefault(); o[o.length - 1].focus(); } else if (!e.shiftKey && D.activeElement === o[o.length - 1]) { e.preventDefault(); o[0].focus(); }
  }
  function ac() {
    if (katman) return; onceki = D.activeElement;
    katman = D.createElement('div'); katman.className = 'kr-katman ktf';
    katman.innerHTML = '<div class="kr-pen ktf-pen" role="dialog" aria-modal="true" aria-labelledby="ktf-baslik">' + formHtml() + '</div>';
    katman.addEventListener('click', function (e) { if (e.target === katman) kapat(); });
    D.body.appendChild(katman); D.documentElement.classList.add('ktf-acik'); D.addEventListener('keydown', tus); bagla();
    var o = katman.querySelector('[data-odak]'); if (o) try { o.focus({ preventScroll: true }); } catch (e) { }
  }
  function kapat() {
    if (!katman) return; katman.remove(); katman = null; D.documentElement.classList.remove('ktf-acik'); D.removeEventListener('keydown', tus);
    if (HASH.test(location.hash)) try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
    if (onceki && onceki.focus && onceki.isConnected) try { onceki.focus({ preventScroll: true }); } catch (e) { }
  }
  function hashBak() { if (HASH.test(location.hash)) ac(); }
  D.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-teklif]'); if (!a) return; e.preventDefault(); ac(); });
  W.addEventListener('hashchange', hashBak);
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', hashBak); else hashBak();
  W.KIDS_TEKLIF = { ac: ac, kapat: kapat, denetle: denetle };
})(window);
