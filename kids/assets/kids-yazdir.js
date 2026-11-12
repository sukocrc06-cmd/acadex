/* ==========================================================================
   ACADEX KIDS · yazdırılabilir materyal (kids/assets/kids-yazdir.js), 12.11.2026
   Öğretmen panelinden ve veli köşesinden: seçilen konu ve yaş dünyası için
   - Boyama sayfası (çizimlerin kontur hâli, altında üstünden geçilecek kelime)
   - Kelime kartları (kesip oynamak için; resim + kelime)
   - Bingo (her kart farklı; öğretmenin çağırma listesi ayrı sayfada)
   - Tebrik sertifikası (konu rozeti; isim satırı boş, elle yazılır)
   Ödev değildir; sınıf içi ve evde oyun içindir. Kişisel veri basılmaz.
   Yazdırma #kt-bulten + .kt-yazdir ile yapılır (kids-tahta.css). W.KIDS_YAZDIR
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, R = W.KIDS_RESIM, V = W.KIDS_VERI, K = W.KIDS_KONU;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var TUR = [['boyama', 'Boyama sayfası', 'firca'], ['kart', 'Kelime kartları', 'album'], ['bingo', 'Bingo', 'yildiz'], ['sertifika', 'Tebrik sertifikası', 'tik']];

  function yazdir(html) {
    var b = D.getElementById('kt-bulten'); if (!b) { b = D.createElement('div'); b.id = 'kt-bulten'; D.body.appendChild(b); }
    b.innerHTML = html; D.documentElement.classList.add('kt-yazdir');
    var bitir = function () { D.documentElement.classList.remove('kt-yazdir'); W.removeEventListener('afterprint', bitir); };
    W.addEventListener('afterprint', bitir);
    setTimeout(function () { try { W.print(); } catch (e) { } setTimeout(bitir, 1500); }, 80);
  }
  /* boyama için kontur: dolgular beyaz, kontur kalır */
  function beyaz(svg) { return String(svg).replace(/fill="#(?!23304D)[0-9A-Fa-f]{3,6}"/gi, 'fill="#fff"').replace(/stroke="#(?!23304D)[0-9A-Fa-f]{3,6}"/gi, 'stroke="#23304D"').replace(/ opacity="[^"]*"/g, ''); }
  function parcala(l, n) { var r = []; for (var i = 0; i < l.length; i += n) r.push(l.slice(i, i + n)); return r; }
  function kar(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function bas(k, alt) { return '<header class="ky-bas"><span>' + C.acadia({ mood: 'mutlu' }) + '</span><div><small>Acadex Kids · ' + esc(alt) + '</small><b lang="en">' + esc(k.en) + '</b> · ' + esc(k.tr) + '</div></header>'; }

  function uret(tur, konu, bantId, n) {
    var P = K.al(konu), k = V.konuBul(konu), bant = V.BANT[bantId] || V.BANT.kasif, l = P.ogeler(bant);
    if (tur === 'boyama') return parcala(l, 4).map(function (s) { return '<section class="ky-sayfa">' + bas(k, 'boyama sayfası') + '<p class="ky-ad">Adım: ______________________</p><ul class="ky-boya">' + s.map(function (o) { return '<li><span>' + beyaz(P.gorsel(o)) + '</span><b lang="en">' + esc(o.en) + '</b></li>'; }).join('') + '</ul></section>'; }).join('');
    if (tur === 'kart') return parcala(l, 8).map(function (s) { return '<section class="ky-sayfa">' + bas(k, 'kelime kartları · kesip oynayın') + '<ul class="ky-kart">' + s.map(function (o) { return '<li style="--r:' + (o.hex || '#9AA7BD') + '"><span>' + P.gorsel(o) + '</span><b lang="en">' + esc(o.en) + '</b><small>' + esc(o.tr) + '</small></li>'; }).join('') + '</ul></section>'; }).join('');
    if (tur === 'bingo') {
      var boy = 3, hucre = l.length >= 9 ? 9 : Math.min(6, l.length), kartlar = [];
      for (var i = 0; i < n; i++) kartlar.push(kar(l).slice(0, hucre));
      return parcala(kartlar, 2).map(function (s, sf) { return '<section class="ky-sayfa">' + bas(k, 'bingo') + s.map(function (kk, j) { return '<div class="ky-bingo"><p>BINGO · ' + (sf * 2 + j + 1) + '</p><ul class="ky-b' + boy + '">' + kk.map(function (o) { return '<li><span>' + P.gorsel(o) + '</span><b lang="en">' + esc(o.en) + '</b></li>'; }).join('') + '</ul></div>'; }).join('') + '</section>'; }).join('') +
        '<section class="ky-sayfa">' + bas(k, 'bingo · öğretmenin çağırma listesi') + '<p>Kelimeleri karışık sırayla söyleyin; çocuk kartında varsa işaretler. Bir sıra (yatay, dikey ya da çapraz) dolunca “Bingo!” der.</p><ul class="ky-liste">' + l.map(function (o) { return '<li><span>' + P.gorsel(o) + '</span><b lang="en">' + esc(o.en) + '</b> <small>' + esc(o.tr) + '</small></li>'; }).join('') + '</ul></section>';
    }
    var rz = R.rozet(k.renk, C.simge(k.simge).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''), false);
    return '<section class="ky-sayfa ky-sert" style="--r:' + k.renk + '"><div class="ky-sert-ic"><span class="ky-sert-acd">' + C.acadia({ mood: 'kutlama' }) + '</span><h1 lang="en">Well done!</h1><p class="ky-sert-ad">______________________________</p>' +
      '<p><b lang="en">' + esc(k.en) + '</b> (' + esc(k.tr) + ') konusunu Acadex Kids’te bitirdi ve şu rozeti kazandı:</p><div class="ky-sert-rz">' + rz + '<b>' + esc(k.rozet || k.tr) + '</b></div><p class="ky-sert-alt">Tarih: ____________ &nbsp;&nbsp; İmza: ____________</p></div></section>';
  }

  /* seçim penceresi: konu, yaş dünyası, tür */
  function panel(o) {
    o = o || {}; var konu = o.konu && K.al(o.konu) ? o.konu : 'colours', bant = o.bant || 'kasif', tur = 'boyama', adet = 6;
    var ort = D.createElement('div'); ort.className = 'ky-ort'; D.body.appendChild(ort);
    function kapat() { ort.remove(); D.removeEventListener('keydown', esc2); }
    function esc2(e) { if (e.key === 'Escape') kapat(); }
    D.addEventListener('keydown', esc2);
    function ciz() {
      ort.innerHTML = '<div class="ky-pen" role="dialog" aria-modal="true" aria-label="Yazdırılabilir materyal"><header><h2>Yazdırılabilir materyal</h2><button type="button" class="ky-x" data-ykapat aria-label="Kapat">×</button></header>' +
        '<p class="ky-not">Sınıf içi ve evde oyun için. Ödev değil; isim satırları boş basılır.</p>' +
        '<label class="ky-alan">Konu<select data-ykonu>' + V.KONU.filter(function (x) { return x.acik; }).map(function (x) { return '<option value="' + x.id + '"' + (x.id === konu ? ' selected' : '') + '>' + esc(x.en + ' · ' + x.tr) + '</option>'; }).join('') + '</select></label>' +
        (o.bantSabit ? '' : '<label class="ky-alan">Yaş dünyası<select data-ybant>' + Object.keys(V.BANT).map(function (b) { return '<option value="' + b + '"' + (b === bant ? ' selected' : '') + '>' + esc(V.BANT[b].ad + ' (' + V.BANT[b].yas + ')') + '</option>'; }).join('') + '</select></label>') +
        '<div class="ky-turler" role="radiogroup" aria-label="Materyal">' + TUR.map(function (t) { return '<button type="button" role="radio" aria-checked="' + (t[0] === tur) + '" data-ytur="' + t[0] + '">' + C.simge(t[2]) + '<span>' + t[1] + '</span></button>'; }).join('') + '</div>' +
        (tur === 'bingo' ? '<label class="ky-alan">Kaç kart?<input type="number" min="2" max="30" value="' + adet + '" data-yadet></label>' : '') +
        '<div class="ky-onizle" aria-label="Önizleme">' + uret(tur, konu, bant, Math.min(adet, 2)).split('</section>')[0] + '</section></div>' +
        '<button type="button" class="kl-dugme ky-yaz" data-yyaz>Yazdır</button></div>';
      ort.querySelector('[data-ykapat]').addEventListener('click', kapat);
      ort.addEventListener('click', function (e) { if (e.target === ort) kapat(); });
      ort.querySelector('[data-ykonu]').addEventListener('change', function () { konu = this.value; ciz(); });
      var b = ort.querySelector('[data-ybant]'); if (b) b.addEventListener('change', function () { bant = this.value; ciz(); });
      ort.querySelectorAll('[data-ytur]').forEach(function (x) { x.addEventListener('click', function () { tur = x.getAttribute('data-ytur'); ciz(); }); });
      var ad = ort.querySelector('[data-yadet]'); if (ad) ad.addEventListener('change', function () { adet = Math.max(2, Math.min(30, +this.value || 6)); });
      ort.querySelector('[data-yyaz]').addEventListener('click', function () { yazdir('<div class="ky-baski">' + uret(tur, konu, bant, adet) + '</div>'); });
      var f = ort.querySelector('[data-ykapat]'); try { f.focus(); } catch (e) { }
    }
    ciz();
    return { kapat: kapat };
  }
  W.KIDS_YAZDIR = { panel: panel, uret: uret, yazdir: yazdir, TUR: TUR };
})(window);
