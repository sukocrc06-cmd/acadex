/* ==========================================================================
   ACADEX KIDS · akıllı tahta modu (kids/assets/kids-tahta.js), 12.11.2026
   Öğretmen panelinden açılır; sınıftaki akıllı tahtaya ya da projeksiyona yansıtılır.
   Dört bölüm, tek konu: Kartlar (büyük resim kartı, gizle-göster, otomatik geçiş),
   Şarkı (satır satır, söylenen satır büyür), Simon says (tahtadaki resimlere komut;
   "Simon says" demeden verilen komutta kimse kıpırdamaz) ve Çark (sınıftaki çocuklardan
   sırayla birini seçer, ona bir kelime kartı sorar; herkes bir kez seçilmeden tekrar etmez).
   Not, puan ya da kayıt yok; yalnız sınıf içi oyun. Klavye: ← → boşluk, Esc kapatır.
   Önek kh-. W.KIDS_TAHTA.ac({ sinif, konu })
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, V = W.KIDS_VERI, K = W.KIDS_KONU, SES = W.KIDS_SES;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var kok = null, S = null;
  var BOLUM = [['kart', 'Kartlar', 'album'], ['sarki', 'Şarkı', 'nota'], ['simon', 'Simon says', 'hands'], ['cark', 'Çark', 'yildiz']];

  function kar(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function paket() { return K.al(S.konu) || K.al('colours'); }
  function ogeler() { return paket().ogeler(V.BANT[S.sinif.bant] || V.BANT.kasif); }
  function gorsel(o) { return paket().gorsel(o); }

  function ac(o) {
    kapat();
    S = { sinif: o.sinif, konu: o.konu && K.al(o.konu) ? o.konu : 'colours', bolum: 'kart', i: 0, gizli: false, oto: null, secilen: [], komut: null, tr: true };
    kok = D.createElement('div'); kok.className = 'kh'; kok.setAttribute('role', 'dialog'); kok.setAttribute('aria-modal', 'true'); kok.setAttribute('aria-label', 'Akıllı tahta');
    D.body.appendChild(kok); D.addEventListener('keydown', tus); D.documentElement.classList.add('kh-acik');
    ciz();
  }
  function kapat() {
    if (!kok) return; durOto(); SES.sus(); D.removeEventListener('keydown', tus); D.documentElement.classList.remove('kh-acik');
    try { if (D.fullscreenElement) D.exitFullscreen(); } catch (e) { }
    kok.remove(); kok = null;
  }
  function durOto() { if (S && S.oto) { clearInterval(S.oto); S.oto = null; } }
  function tus(e) {
    if (!kok) return;
    if (e.key === 'Escape' && !D.fullscreenElement) { e.preventDefault(); return kapat(); }
    if (S.bolum !== 'kart' || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); git(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); git(-1); }
    else if (e.key === ' ' && e.target === D.body) { e.preventDefault(); goster(); }
  }

  function ciz() {
    durOto(); SES.sus();
    var konuK = V.konuBul(S.konu);
    kok.style.setProperty('--r', konuK.renk);
    kok.innerHTML = '<header class="kh-ust"><span class="kh-marka">' + C.acadia({ mood: 'mutlu' }) + '<b>Akıllı tahta</b><small>' + esc(S.sinif.ad) + '</small></span>' +
      '<label class="kh-konu"><span>Konu</span><select data-khkonu>' + V.KONU.filter(function (k) { return k.acik; }).map(function (k) { return '<option value="' + k.id + '"' + (k.id === S.konu ? ' selected' : '') + '>' + esc(k.en + ' · ' + k.tr) + '</option>'; }).join('') + '</select></label>' +
      '<nav class="kh-bolumler" aria-label="Bölüm">' + BOLUM.map(function (b) { return '<button type="button" data-khb="' + b[0] + '" aria-pressed="' + (b[0] === S.bolum) + '">' + C.simge(b[2]) + '<span>' + b[1] + '</span></button>'; }).join('') + '</nav>' +
      '<span class="kh-sag"><button type="button" class="kh-yuv" data-khtam aria-label="Tam ekran">⤢</button><button type="button" class="kh-yuv" data-khkapat aria-label="Kapat">×</button></span></header>' +
      '<main class="kh-sahne" data-khs></main>';
    kok.querySelector('[data-khkonu]').addEventListener('change', function () { S.konu = this.value; S.i = 0; S.komut = null; ciz(); });
    kok.querySelectorAll('[data-khb]').forEach(function (b) { b.addEventListener('click', function () { S.bolum = b.getAttribute('data-khb'); ciz(); }); });
    kok.querySelector('[data-khkapat]').addEventListener('click', kapat);
    kok.querySelector('[data-khtam]').addEventListener('click', function () { try { if (D.fullscreenElement) D.exitFullscreen(); else kok.requestFullscreen(); } catch (e) { } });
    ({ kart: kart, sarki: sarki, simon: simon, cark: cark })[S.bolum](kok.querySelector('[data-khs]'));
  }

  /* ---------- Kartlar ---------- */
  function kart(s) {
    var l = ogeler(), o = l[(S.i % l.length + l.length) % l.length];
    s.innerHTML = '<div class="kh-kart" style="--k:' + (o.hex || '#9AA7BD') + '"><button type="button" class="kh-ok" data-khgeri aria-label="Önceki">‹</button>' +
      '<figure class="kh-kartic" data-khgoster><span class="kh-res">' + gorsel(o) + '</span><figcaption' + (S.gizli ? ' class="kh-gizli"' : '') + '><b lang="en">' + esc(o.en) + '</b>' + (S.tr ? '<small>' + esc(o.tr) + '</small>' : '') + '</figcaption></figure>' +
      '<button type="button" class="kh-ok" data-khileri aria-label="Sonraki">›</button></div>' +
      '<div class="kh-alt"><span class="kh-sira">' + l.map(function (x, i) { return '<i class="' + (x === o ? 'kh-bu' : '') + '"></i>'; }).join('') + '</span>' +
      '<button type="button" class="kh-d" data-khdinle>' + C.simge('ses') + ' Dinle</button><button type="button" class="kh-d" data-khgizle aria-pressed="' + S.gizli + '">' + (S.gizli ? 'Kelimeyi göster' : 'Kelimeyi gizle') + '</button>' +
      '<button type="button" class="kh-d" data-khtr aria-pressed="' + S.tr + '">Türkçe ' + (S.tr ? 'açık' : 'kapalı') + '</button><button type="button" class="kh-d" data-khoto aria-pressed="' + !!S.oto + '">' + C.simge('oynat') + ' Otomatik</button></div>' +
      '<p class="kh-ipucu">Gizle: çocuklar resme bakıp kelimeyi söylesin, sonra karta dokunup gösterin. Klavye: ← → ve boşluk.</p>';
    s.querySelector('[data-khgeri]').addEventListener('click', function () { git(-1); });
    s.querySelector('[data-khileri]').addEventListener('click', function () { git(1); });
    s.querySelector('[data-khgoster]').addEventListener('click', goster);
    s.querySelector('[data-khdinle]').addEventListener('click', function () { SES.soyle(o.en, 'en'); });
    s.querySelector('[data-khgizle]').addEventListener('click', function () { S.gizli = !S.gizli; kart(s); });
    s.querySelector('[data-khtr]').addEventListener('click', function () { S.tr = !S.tr; kart(s); });
    var ob = s.querySelector('[data-khoto]');
    ob.addEventListener('click', function () {
      if (S.oto) { durOto(); ob.setAttribute('aria-pressed', 'false'); return; }
      ob.setAttribute('aria-pressed', 'true'); SES.soyle(o.en, 'en');
      /* kart() yeniden çizer; S.oto açıkken kendisi konuşmaz, burada söylenir */
      S.oto = setInterval(function () { if (!kok) return durOto(); S.i++; kart(s); SES.soyle(ogeler()[S.i % ogeler().length].en, 'en'); }, 4200);
    });
    if (!S.gizli && !S.oto) SES.soyle(o.en, 'en');
  }
  function git(d) { durOto(); S.i += d; kart(kok.querySelector('[data-khs]')); }
  function goster() { if (!S.gizli) return SES.soyle(ogeler()[(S.i % ogeler().length + ogeler().length) % ogeler().length].en, 'en'); var f = kok.querySelector('.kh-gizli'); if (f) { f.classList.remove('kh-gizli'); f.classList.add('kh-acildi'); SES.fx('dogru'); SES.soyle(ogeler()[(S.i % ogeler().length + ogeler().length) % ogeler().length].en, 'en'); } }

  /* ---------- Şarkı ---------- */
  function sarki(s) {
    var P = paket(), l = ogeler(), satirlar = K.sarkiSatir(P, l), cal = false;
    s.innerHTML = '<div class="kh-sarki"><ol>' + satirlar.map(function (x, i) { var o = x.kim && l.filter(function (y) { return y.id === x.kim; })[0]; return '<li data-khsat="' + i + '">' + (o ? '<span class="kh-sres">' + gorsel(o) + '</span>' : '<span class="kh-sres">' + C.simge('nota') + '</span>') + '<span lang="en">' + esc(x.soz) + '</span></li>'; }).join('') + '</ol>' +
      '<button type="button" class="kh-buyuk" data-khcal>' + C.simge('oynat') + ' <span>Şarkıyı çal</span></button></div>';
    var b = s.querySelector('[data-khcal]');
    function bitir() { cal = false; SES.sus(); b.querySelector('span').textContent = 'Şarkıyı çal'; s.querySelectorAll('.kh-calan').forEach(function (x) { x.classList.remove('kh-calan'); }); }
    b.addEventListener('click', async function () {
      if (cal) return bitir(); cal = true; b.querySelector('span').textContent = 'Durdur';
      for (var i = 0; i < satirlar.length && cal && kok; i++) {
        s.querySelectorAll('.kh-calan').forEach(function (x) { x.classList.remove('kh-calan'); });
        var li = s.querySelector('[data-khsat="' + i + '"]'); li.classList.add('kh-calan'); try { li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { }
        await SES.soyle(satirlar[i].soz, 'en', { hiz: 0.88 }); await new Promise(function (r) { setTimeout(r, 500); });
      }
      if (kok) bitir();
    });
    s.querySelectorAll('[data-khsat]').forEach(function (li) { li.addEventListener('click', function () { if (cal) return; SES.soyle(satirlar[+li.getAttribute('data-khsat')].soz, 'en', { hiz: 0.88 }); }); });
  }

  /* ---------- Simon says ---------- */
  function simon(s) {
    var P = paket(), l = ogeler();
    s.innerHTML = '<div class="kh-simon"><div class="kh-komut" data-khkomut aria-live="polite"><p>Hazır mısınız? <b>Yeni komut</b>’a basın.</p></div>' +
      '<ul class="kh-izgara">' + l.map(function (o) { return '<li><button type="button" data-khres="' + o.id + '" style="--k:' + (o.hex || '#9AA7BD') + '" aria-label="' + esc(o.en) + '">' + gorsel(o) + '<b lang="en">' + esc(o.en) + '</b></button></li>'; }).join('') + '</ul>' +
      '<div class="kh-alt"><button type="button" class="kh-buyuk" data-khyeni>' + C.simge('oynat') + ' Yeni komut</button><label class="kh-anahtar"><input type="checkbox" data-khhile checked> Bazen “Simon says” demesin (dikkat oyunu)</label></div>' +
      '<p class="kh-ipucu">Komutu duyan çocuk tahtaya gelip resme dokunur. “Simon says” denmediyse kimse kıpırdamaz; kıpırdayan bir tur izler. ' + (P.id === 'body' ? 'Bu konuda herkes kendi vücuduna dokunur.' : '') + '</p></div>';
    var kutu = s.querySelector('[data-khkomut]');
    s.querySelector('[data-khyeni]').addEventListener('click', function () {
      var o = kar(l.filter(function (x) { return !S.komut || x !== S.komut.o; }))[0], simonDer = !s.querySelector('[data-khhile]').checked || Math.random() > 0.25;
      S.komut = { o: o, s: simonDer }; s.querySelectorAll('.kh-dogru,.kh-yanlis').forEach(function (x) { x.classList.remove('kh-dogru', 'kh-yanlis'); });
      var k = K.komut(P, o);
      kutu.innerHTML = '<p class="kh-komut-y' + (simonDer ? '' : ' kh-hile') + '"><small>' + (simonDer ? 'Simon says…' : 'Dikkat! Simon demedi') + '</small><b lang="en">' + esc(k) + '</b></p>';
      (simonDer ? SES.soyle('Simon says!', 'en') : Promise.resolve()).then(function () { if (kok) SES.soyle(k, 'en'); });
    });
    s.querySelectorAll('[data-khres]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!S.komut) return SES.soyle(b.getAttribute('aria-label'), 'en');
        var ok = b.getAttribute('data-khres') === S.komut.o.id && S.komut.s;
        b.classList.remove('kh-dogru', 'kh-yanlis'); void b.offsetWidth; b.classList.add(ok ? 'kh-dogru' : 'kh-yanlis'); SES.fx(ok ? 'dogru' : 'yanlis');
      });
    });
  }

  /* ---------- Çark: sırayla bir çocuk ---------- */
  function cark(s) {
    var ogr = (S.sinif.ogr || []).map(function (o) { return { ad: o[0], hayvan: o[1] }; }), n = ogr.length;
    if (!n) { s.innerHTML = '<p class="kh-ipucu">Bu sınıfta henüz öğrenci yok.</p>'; return; }
    var dilim = 360 / n, renk = ['#FF9EB5', '#FFD23F', '#9BE0B4', '#A5DBFF', '#D9C2FF', '#FFB3B3', '#BDE8F2', '#FFE08A'], yol = '';
    ogr.forEach(function (o, i) {
      var a1 = (i * dilim - 90) * Math.PI / 180, a2 = ((i + 1) * dilim - 90) * Math.PI / 180, am = (a1 + a2) / 2, buyuk = dilim > 180 ? 1 : 0;
      yol += (n === 1 ? '<circle cx="100" cy="100" r="94" fill="' + renk[0] + '" stroke="#23304D" stroke-width="3"/>' : '<path d="M100 100 L' + (100 + 94 * Math.cos(a1)).toFixed(1) + ' ' + (100 + 94 * Math.sin(a1)).toFixed(1) + ' A94 94 0 ' + buyuk + ' 1 ' + (100 + 94 * Math.cos(a2)).toFixed(1) + ' ' + (100 + 94 * Math.sin(a2)).toFixed(1) + ' Z" fill="' + (S.secilen.indexOf(o.ad) > -1 ? '#E3E8F2' : renk[i % renk.length]) + '" stroke="#23304D" stroke-width="2.4"/>') +
        '<text x="' + (100 + 62 * Math.cos(am)).toFixed(1) + '" y="' + (100 + 62 * Math.sin(am)).toFixed(1) + '" transform="rotate(' + (i * dilim + dilim / 2) + ' ' + (100 + 62 * Math.cos(am)).toFixed(1) + ' ' + (100 + 62 * Math.sin(am)).toFixed(1) + ')" text-anchor="middle" dominant-baseline="middle" font-size="' + (n > 14 ? 9 : 12) + '" font-weight="800" fill="#23304D"' + (S.secilen.indexOf(o.ad) > -1 ? ' opacity=".4"' : '') + '>' + esc(o.ad) + '</text>';
    });
    s.innerHTML = '<div class="kh-cark"><div class="kh-cark-sol"><span class="kh-cark-ok" aria-hidden="true"></span><svg viewBox="0 0 200 200" class="kh-cark-r" data-khcark aria-hidden="true">' + yol + '<circle cx="100" cy="100" r="14" fill="#fff" stroke="#23304D" stroke-width="3"/></svg>' +
      '<button type="button" class="kh-buyuk" data-khcevir>' + C.simge('yildiz') + ' Çevir</button><p class="kh-ipucu">' + S.secilen.length + ' / ' + n + ' çocuk seçildi. Herkes bir kez seçilince çark baştan başlar.' + (S.secilen.length ? ' <button type="button" class="kh-bag" data-khsifirla>Baştan başlat</button>' : '') + '</p></div>' +
      '<div class="kh-cark-sag" data-khsonuc><p class="kh-ipucu">Çarkı çevirin; seçilen çocuğa bir kelime kartı gelir. Çocuk İngilizcesini söyler, sonra karta dokunup birlikte dinleyin.</p></div></div>';
    var aci = 0, svg = s.querySelector('[data-khcark]'), dug = s.querySelector('[data-khcevir]'), sonuc = s.querySelector('[data-khsonuc]');
    var sf = s.querySelector('[data-khsifirla]'); if (sf) sf.addEventListener('click', function () { S.secilen = []; cark(s); });
    dug.addEventListener('click', function () {
      var kalan = ogr.map(function (o, i) { return i; }).filter(function (i) { return S.secilen.indexOf(ogr[i].ad) < 0; });
      if (!kalan.length) { S.secilen = []; return cark(s); }
      var i = kalan[Math.floor(Math.random() * kalan.length)], hedefAci = 360 - (i * dilim + dilim / 2);
      aci = aci + 1440 + ((hedefAci - aci % 360) + 360) % 360; dug.disabled = true; SES.fx('cevir');
      svg.style.transform = 'rotate(' + aci + 'deg)';
      setTimeout(function () {
        if (!kok) return; S.secilen.push(ogr[i].ad); var o = kar(ogeler())[0];
        SES.fx('yildiz');
        sonuc.innerHTML = '<div class="kh-secilen"><span class="kh-av">' + C.avatar(ogr[i].hayvan) + '</span><b>' + esc(ogr[i].ad) + '</b></div>' +
          '<button type="button" class="kh-soru" data-khsor style="--k:' + (o.hex || '#9AA7BD') + '"><span class="kh-res">' + gorsel(o) + '</span><span class="kh-gizli"><b lang="en">' + esc(o.en) + '</b></span><small>What is it? · Dokun, cevabı göster</small></button>';
        SES.soyle('What is it?', 'en');
        sonuc.querySelector('[data-khsor]').addEventListener('click', function () { var g = this.querySelector('.kh-gizli'); if (g) { g.classList.remove('kh-gizli'); g.classList.add('kh-acildi'); } SES.fx('dogru'); SES.soyle(o.en, 'en'); });
        dug.disabled = false;
        var p = s.querySelector('.kh-cark-sol .kh-ipucu'); if (p) p.firstChild.textContent = S.secilen.length + ' / ' + n + ' çocuk seçildi. Herkes bir kez seçilince çark baştan başlar.';
        svg.querySelectorAll('text')[i].setAttribute('opacity', '.4');
      }, W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches ? 60 : 3200);
    });
  }

  W.KIDS_TAHTA = { ac: ac, kapat: kapat };
})(window);
