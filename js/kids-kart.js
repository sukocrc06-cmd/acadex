/* ==========================================================================
   KOPYA: kids/assets/kids-kart.js (yönetim paneli için; ilk iki satır dışında aynı, tests/kids-kres.js denetler)
   A4'e 8 kart, kesme çizgili. Önceden yalnız yönetim panelindeydi (js/admin-kids.js);
   kreş yöneticisi de kendi kartlarını bastığı için ortak dosyaya taşındı.
   Yönetim paneli bu dosyanın kopyasını kullanır: js/kids-kart.js (ilk iki satır dışında aynı).
   Kartta: çocuğun adı (yalnız ad + soyadın baş harfi), hayvanı, iki gizli resmi,
   okul kodu, kimlik ve "Evde oyna" QR'ı. QR'da şifre YOK: veli okutunca site doğrudan
   o çocuğun resim seçme adımına açılır (kids-qr.js evAdres). QR tarayıcıda üretilir.
   W.KIDS_KART.sayfa(okul, öğrenciler, sınıflar, {kok}) → HTML · KIDS_KART.ac(...) → yeni sekme
   ========================================================================== */
(function (W) {
  'use strict';
  var HAYVAN = { tavsan: 'Tavşan', ayi: 'Ayı', kedi: 'Kedi', civciv: 'Civciv', panda: 'Panda', kurbaga: 'Kurbağa', tilki: 'Tilki', kopek: 'Köpek' };
  var SITE = 'acadex.com.tr/kids';
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function ciz(fn, ad, ek) { var C = W.KIDS_CIZ; try { return C ? C[fn](ad, ek) : ''; } catch (e) { return ''; } }
  function yuzAd(g) { var C = W.KIDS_CIZ; return (C && C.yuzAd && C.yuzAd(g.hayvan, g.renk)) || HAYVAN[g.hayvan] || ''; }
  function qr(o, g, kok) { var Q = W.KIDS_QR; if (!Q || !g.id) return ''; try { return Q.svg(Q.evAdres(o.kod, g.id, kok), { etiket: 'Evde oyna' }); } catch (e) { return ''; } }

  function kart(o, g, sinifAd, kok) {
    var q = qr(o, g, kok);
    return '<div class="kart"><div class="k-ust"><span class="k-acd">' + (W.KIDS_CIZ ? W.KIDS_CIZ.acadia({ mood: 'mutlu' }) : '') + '</span><b>Acadex <i>Kids</i></b><span class="k-sinif">' + X(sinifAd || '') + '</span></div>' +
      '<div class="k-orta' + (q ? ' k-qrli' : '') + '"><span class="k-av">' + ciz('avatar', g.hayvan, g.renk) + '</span><div class="k-kim"><span class="k-ad">' + X(g.ad) + '</span><span class="k-not">Resmin: <b>' + X(yuzAd(g)) + '</b></span>' +
      '<span class="k-gizli">Gizli resimlerin</span><span class="k-sf">' + (g.sifre || []).map(function (r, i) { return '<span><i>' + (i + 1) + '</i>' + ciz('simge', r) + '</span>'; }).join('') + '</span></div>' +
      (q ? '<span class="k-qr">' + q + '<small>Evde oyna</small></span>' : '') + '</div>' +
      '<div class="k-alt"><span><b>' + SITE + '</b></span><span>Okul kodu <b>' + X(o.kod) + '</b></span><span class="k-no">' + X(g.kimlik || '') + '</span></div></div>';
  }
  var CSS = '@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#E9E6DD;font-family:Nunito,system-ui,sans-serif;color:#23304D;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.arac{position:sticky;top:0;display:flex;gap:12px;align-items:center;padding:10px 16px;background:#23304D;color:#fff;font-size:14px}.arac button{margin-left:auto;padding:8px 18px;border:0;border-radius:999px;background:#FFD23F;font:800 15px Nunito,sans-serif;cursor:pointer}' +
    '.sayfa{width:210mm;height:297mm;margin:10mm auto;display:grid;grid-template-columns:repeat(2,105mm);grid-template-rows:repeat(4,74.25mm);background:#fff;page-break-after:always;break-after:page}' +
    '.kart{position:relative;display:grid;grid-template-rows:auto 1fr auto;padding:4.5mm 5.5mm;border:.3mm dashed #B8B2A2;overflow:hidden}' +
    '.k-ust{display:flex;align-items:center;gap:2mm;padding-bottom:2mm;border-bottom:.5mm solid #FFE79A}.k-acd{width:8mm;height:8mm}.k-acd svg,.k-av svg,.k-sf svg{display:block;width:100%;height:100%}' +
    '.k-ust b{font:800 13pt/1 "Baloo 2",sans-serif}.k-ust i{font-style:normal;padding:0 1.5mm;border-radius:2mm;background:#FFB3A9}.k-sinif{margin-left:auto;padding:.6mm 2.5mm;border-radius:9mm;background:#E8F4FF;font-weight:800;font-size:9pt}' +
    '.k-orta{display:grid;grid-template-columns:30mm 1fr;gap:4mm;align-items:center;padding:2mm 0}.k-orta.k-qrli{grid-template-columns:26mm 1fr 20mm;gap:3mm}' +
    '.k-av{display:block;width:30mm;height:30mm;padding:1.5mm;border:.6mm solid #23304D;border-radius:7mm;background:#FFF6D6}.k-qrli .k-av{width:26mm;height:26mm}' +
    '.k-kim{display:grid;gap:.8mm;min-width:0}.k-ad{font:800 17pt/1.05 "Baloo 2",sans-serif;overflow-wrap:anywhere}.k-qrli .k-ad{font-size:15pt}.k-not{font-size:8.5pt}.k-gizli{margin-top:1.2mm;font-weight:800;font-size:8.5pt}' +
    '.k-sf{display:flex;gap:2.5mm}.k-sf>span{position:relative;width:15mm;height:15mm;padding:1.4mm;border:.5mm dashed #23304D;border-radius:3.5mm;background:#fff}.k-qrli .k-sf>span{width:13.5mm;height:13.5mm}' +
    '.k-sf i{position:absolute;left:-1.8mm;top:-1.8mm;width:5mm;height:5mm;border-radius:50%;background:#23304D;color:#fff;font:800 7pt/5mm Nunito,sans-serif;text-align:center;font-style:normal}' +
    '.k-qr{display:grid;justify-items:center;gap:.6mm}.k-qr svg{display:block;width:20mm;height:20mm}.k-qr small{font-weight:800;font-size:7pt}' +
    '.k-alt{display:flex;gap:3mm;align-items:center;padding-top:1.8mm;border-top:.3mm solid #E3DECF;font-size:7.5pt}.k-alt b{font-weight:800}.k-no{margin-left:auto;font-family:ui-monospace,Menlo,monospace;font-size:7.5pt}' +
    '.ev-not{width:210mm;margin:0 auto 10mm;padding:5mm 8mm;background:#fff;font-size:10pt;line-height:1.45}.ev-not b{font-weight:800}' +
    '@media print{body{background:#fff}.arac,.ev-not{display:none}.sayfa{margin:0}}';
  function sayfa(o, liste, siniflar, ek) {
    ek = ek || {}; var ad = {}; (siniflar || []).forEach(function (s) { ad[s.id] = s.ad; });
    var sayfalar = []; for (var i = 0; i < liste.length; i += 8) sayfalar.push(liste.slice(i, i + 8));
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' + X(o.kod) + ' · Acadex Kids giriş kartları</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@600;800&display=swap" rel="stylesheet">' +
      '<style>' + CSS + '</style></head><body><div class="arac"><b>' + X(o.ad) + '</b> · ' + liste.length + ' kart, ' + sayfalar.length + ' sayfa A4. Yazdırırken “Gerçek boyut / %100” ve “Arka plan grafikleri” seçili olsun.' +
      '<button type="button" onclick="print()">Yazdır</button></div>' +
      '<p class="ev-not"><b>Evde oyna:</b> Veli kartın köşesindeki QR\'ı telefonun kamerasıyla okutur; Acadex Kids doğrudan çocuğun resim seçme ekranında açılır. Çocuk iki gizli resmini seçer ve okulda kaldığı yerden devam eder. QR\'da şifre yoktur; kartı yalnız çocuğun ailesine verin.</p>' +
      sayfalar.map(function (p) { return '<section class="sayfa">' + p.map(function (g) { return kart(o, g, ad[g.sinif_id], ek.kok); }).join('') + '</section>'; }).join('') +
      '<script>document.fonts&&document.fonts.ready.then(function(){setTimeout(function(){print()},300)});<\/script></body></html>';
  }
  /* yeni sekmede açar; açılır pencere engellenirse false döner */
  function ac(o, liste, siniflar, ek) {
    if (!liste.length) return false;
    var w = W.open('', '_blank'); if (!w) return false;
    w.document.open(); w.document.write(sayfa(o, liste, siniflar, ek)); w.document.close(); return true;
  }
  W.KIDS_KART = { sayfa: sayfa, ac: ac, kart: kart, CSS: CSS, HAYVAN: HAYVAN };
})(typeof window !== 'undefined' ? window : globalThis);
