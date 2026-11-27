/* ==========================================================================
   ACADEX KIDS · ZAMAN MAKİNESİ KASABASI (kids/assets/kids-gramer.js + kids-gramer.css), 27.11.2026
   İlkokul İngilizce dil bilgisi: 30 konu, üç seviye (Kolay 2. sınıf · Orta 3. sınıf · Zor 4. sınıf).
   Kasabada her konu bir bina; binalar sırayla açılır. Zaman konularında Zaman Treni dün / her gün /
   şimdi / yarın istasyonlarına gider. Kelimeler Cümle Galaksisi'nin renkleriyle canlı karakterlerdir:
   mavi kim, kırmızı ne yapar, yeşil ne / nerede, mor soru, gri diğer; ekler turuncu.
   Her konu üç adım: İZLE (animasyonlu anlatım, sesli) → DENE (bloğu boşluğa koy) → OYNA (6 soru, 1-3 yıldız).
   Veri: kids-gramer2.js (KIDS_GRAMER_VERI).
   Kayıt: il.gramer[konu] = { izle: 1, dene: yıldız, oyna: yıldız } · il.gramerSon · il.gramerSv · il.gramerLog (son 60)
   W.KIDS_GRAMER = { ac(oz), parca, yildiz, konuAcik, seviyeAcik, bittiMi, rapor(il), cumleler() }
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, SES = null, R = null, M = '#23304D';
  var SAKIN = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function V() { return W.KIDS_GRAMER_VERI || { KONU: [], SEVIYE: {} }; }
  function liste(sv) { return V().KONU.filter(function (k) { return k.sv === sv; }); }
  var ROL = { s: 'kim', v: 'ne yapar', o: 'ne / nerede', q: 'soru', x: 'diğer' };

  /* ---------------- saf yardımcılar (tests/kids-gramer.js) ---------------- */
  /* "She/s play+s/v go>went/v ." → bloklar: { m: görünen, kok, ek, eski, r } */
  function parca(s) {
    s = String(s || '').trim(); var son = s.slice(-1), ic = /[.?!]/.test(son) && / [.?!]$/.test(s) ? s.slice(0, -1).trim() : s;
    if (!/[.?!]/.test(son) || !/ [.?!]$/.test(s)) son = '';
    return { son: son, bloklar: ic.split(/\s+/).filter(Boolean).map(function (p) {
      var i = p.lastIndexOf('/'), m = i > 0 ? p.slice(0, i) : p, r = i > 0 ? p.slice(i + 1) : 'x', b = { r: ROL[r] ? r : 'x' };
      m = m.replace(/_/g, ' ');
      if (m.indexOf('+') > 0) { var a = m.split('+'); b.kok = a[0]; b.ek = a.slice(1).join(''); b.m = b.kok + b.ek; }
      else if (m.indexOf('>') > 0) { var g = m.split('>'); b.eski = g[0]; b.m = g[1]; }
      else b.m = m;
      return b;
    }) };
  }
  function metin(s) { var p = parca(s); return p.bloklar.map(function (b) { return b.m; }).join(' ').replace(/ ([,'])/g, '$1') + p.son; }
  function yildiz(hata) { return hata <= 1 ? 3 : hata <= 3 ? 2 : 1; }
  function karistir(a) { var b = a.slice(); for (var i = b.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = b[i]; b[i] = b[j]; b[j] = x; } return b; }
  function kd(i, id) { return ((i.gramer || {})[id]) || {}; }
  function bittiMi(i, id) { return kd(i, id).oyna > 0; }
  function konuAcik(i, L, k) { return k === 0 || bittiMi(i, L[k - 1].id) || Object.keys(kd(i, L[k].id)).length > 0; }
  function sinifOf(i) { var s = i && i.ilkSinif; return s === 2 || s === 3 || s === 4 ? s : (oz && (oz.sinifAd === 2 || oz.sinifAd === 3 || oz.sinifAd === 4) ? oz.sinifAd : 2); }
  /* seviye: kendi sınıfı ve altı açık; üstü, bir alt seviyenin bütün binaları bitince açılır */
  function seviyeAcik(i, sv) { return sv <= sinifOf(i) || liste(sv - 1).every(function (x) { return bittiMi(i, x.id); }); }
  function adimAcik(d, a) { return a === 'izle' || (a === 'dene' && d.izle > 0) || (a === 'oyna' && d.dene > 0); }
  function oyCoz(o) { var p = o.split('|'); return p[0] === 's' ? { t: 's', c: p[1], d: p[2], y: p[3].split(','), tr: p[4] } : p[0] === 'y' ? { t: 'y', c: p[1], ok: p[2] === '1', dz: p[3], tr: p[4] } : { t: 'd', s: p[1], tr: p[2] }; }

  /* ---------------- çizimler ---------------- */
  function acd(m, poz) { return C && C.acadia ? C.acadia({ mood: m || 'mutlu', pose: poz }) : ''; }
  function resim(id) { return id && R && R.var && R.var(id) && R.ciz ? R.ciz(id) : ''; }
  function ev(renk, kilit, bitti, i) {
    var c = kilit ? '#9AA3BE' : renk, cati = kilit ? '#7C86A6' : ['#E5484D', '#8E7CF0', '#2FB7B0', '#FF9E57'][i % 4];
    return '<svg class="kzm-ev-s" viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
      '<rect x="18" y="52" width="84" height="60" rx="6" fill="' + c + '" stroke="' + M + '" stroke-width="3.5"/>' +
      '<path d="M8 56 L60 14 L112 56 Z" fill="' + cati + '" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<rect x="80" y="20" width="12" height="22" rx="2" fill="' + cati + '" stroke="' + M + '" stroke-width="3"/>' +
      (kilit ? '' : '<g class="kzm-duman"><circle cx="86" cy="12" r="5" fill="#fff" opacity=".8"/><circle cx="92" cy="4" r="4" fill="#fff" opacity=".6"/></g>') +
      '<rect x="48" y="78" width="24" height="34" rx="4" fill="' + (kilit ? '#6B7392' : '#FFF8E7') + '" stroke="' + M + '" stroke-width="3"/>' +
      '<circle cx="66" cy="96" r="2.4" fill="' + M + '"/>' +
      '<rect x="26" y="64" width="16" height="16" rx="3" fill="' + (kilit ? '#C9CFE2' : '#BFE3FF') + '" stroke="' + M + '" stroke-width="2.6"/>' +
      '<rect x="78" y="64" width="16" height="16" rx="3" fill="' + (kilit ? '#C9CFE2' : '#BFE3FF') + '" stroke="' + M + '" stroke-width="2.6"/>' +
      (kilit ? '<path d="M44 82 L76 104 M76 82 L44 104" stroke="#8B5E34" stroke-width="6" stroke-linecap="round"/>' : '') +
      (bitti ? '<g class="kzm-bayrak"><path d="M60 14 V-6" stroke="' + M + '" stroke-width="3" stroke-linecap="round"/><path d="M61 -6 q12 -4 22 3 q-10 7 -22 3z" fill="#FFD23F" stroke="' + M + '" stroke-width="2.4" stroke-linejoin="round"/></g>' : '') + '</svg>';
  }
  var TREN = '<svg viewBox="0 0 96 48" aria-hidden="true" focusable="false"><rect x="4" y="14" width="40" height="24" rx="6" fill="#FF6B5B" stroke="' + M + '" stroke-width="3"/><rect x="32" y="4" width="18" height="34" rx="4" fill="#FFD23F" stroke="' + M + '" stroke-width="3"/><rect x="36" y="9" width="10" height="9" rx="2" fill="#BFE3FF" stroke="' + M + '" stroke-width="2"/><path d="M50 30 h14 l5 8 h-19z" fill="#7FC4FF" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/><rect x="10" y="4" width="8" height="12" rx="2" fill="' + M + '"/><circle cx="16" cy="40" r="6" fill="#fff" stroke="' + M + '" stroke-width="3"/><circle cx="38" cy="40" r="6" fill="#fff" stroke="' + M + '" stroke-width="3"/><circle cx="72" cy="22" r="10" fill="#fff" stroke="' + M + '" stroke-width="3"/><path d="M72 15 v7 l5 3" stroke="' + M + '" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>';
  var SAAT = '<svg class="kzm-kule" viewBox="0 0 120 200" aria-hidden="true" focusable="false"><path d="M30 70 L60 22 L90 70Z" fill="#8E7CF0" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><rect x="34" y="66" width="52" height="128" rx="4" fill="#FFE7B8" stroke="' + M + '" stroke-width="4"/>' +
    '<circle cx="60" cy="102" r="22" fill="#fff" stroke="' + M + '" stroke-width="4"/><g class="kzm-akrep"><path d="M60 102 V88" stroke="' + M + '" stroke-width="4" stroke-linecap="round"/></g><g class="kzm-yelkovan"><path d="M60 102 H76" stroke="#E5484D" stroke-width="3" stroke-linecap="round"/></g><circle cx="60" cy="102" r="3" fill="' + M + '"/>' +
    '<rect x="50" y="150" width="20" height="44" rx="10" fill="#8B5E34" stroke="' + M + '" stroke-width="3"/><path d="M60 22 V6" stroke="' + M + '" stroke-width="3"/><path d="M61 6 q10 -3 18 2 q-8 6 -18 2z" fill="#FF6B5B" stroke="' + M + '" stroke-width="2"/></svg>';

  var oz = null, durum = null;
  function il() { return oz.il(); }
  function kaydet(i) { oz.kaydet(i); }
  function dur() { durum = null; if (SES && SES.sus) SES.sus(); }
  function bekle(ms) { return new Promise(function (r) { setTimeout(r, SAKIN ? Math.min(ms, 200) : ms); }); }
  function soyle(t, dil) { return SES ? Promise.resolve(SES.soyle(t, dil)).catch(function () { }) : Promise.resolve(); }
  function ust(geriEt, bas, alt, ek) {
    return '<header class="ka-konu-ust kzm-ust"><button type="button" class="ka-yuvarlak" data-kzmgeri aria-label="' + geriEt + '">' + (C ? C.simge('ev') : '←') + '</button><h1 class="kk-bas">' + bas + (alt ? ' <small>' + alt + '</small>' : '') + '</h1>' + (ek || '<span></span>') + '</header>';
  }
  function yildizHtml(y, cls) { return '<i class="' + (cls || 'kzm-y') + '" aria-label="' + y + ' yıldız">' + [1, 2, 3].map(function (q) { return '<em' + (q <= y ? ' class="on"' : '') + '>★</em>'; }).join('') + '</i>'; }

  /* ---------------- kasaba ---------------- */
  var YER_G = [[8, 74], [20, 52], [31, 76], [42, 50], [53, 78], [64, 52], [74, 78], [84, 54], [92, 80], [96, 46]],
    YER_T = [[28, 19], [72, 27], [28, 35], [72, 43], [28, 51], [72, 59], [28, 67], [72, 75], [28, 83], [72, 91]];
  function kasaba() {
    dur();
    var i = il(), sv = i.gramerSv && seviyeAcik(i, i.gramerSv) ? i.gramerSv : sinifOf(i), L = liste(sv), S = V().SEVIYE[sv] || {};
    var dar = W.matchMedia && W.matchMedia('(max-width: 700px)').matches, Y = dar ? YER_T : YER_G;
    var sira = L.findIndex(function (x, k) { return konuAcik(i, L, k) && !bittiMi(i, x.id); }), biten = L.filter(function (x) { return bittiMi(i, x.id); }).length;
    var son = L.findIndex(function (x) { return x.id === i.gramerSon; }); if (son < 0) son = Math.max(0, sira);
    var yol = 'M' + Y.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L');
    var toplam = L.reduce(function (n, x) { var d = kd(i, x.id); return n + (d.oyna || 0); }, 0);
    oz.kok.innerHTML = '<div class="kzm kzm-sv' + sv + '">' + ust('Haritaya dön', 'Zaman Makinesi Kasabası', 'Grammar Town',
      '<div class="kzm-sv-sec" role="group" aria-label="Seviye">' + [2, 3, 4].map(function (n) { var a = seviyeAcik(i, n), s_ = V().SEVIYE[n]; return '<button type="button" data-kzmsv="' + n + '" aria-pressed="' + (n === sv) + '"' + (a ? '' : ' aria-disabled="true"') + '><b>' + s_.ad + '</b><small>' + (a ? s_.sinif : '🔒') + '</small></button>'; }).join('') + '</div>') +
      '<main class="kzm-kasaba' + (dar ? ' kzm-dar' : '') + '"><div class="kzm-gok" aria-hidden="true"><span class="kzm-gunes"></span><span class="kzm-bulut kzm-b1"></span><span class="kzm-bulut kzm-b2"></span><span class="kzm-tepe"></span></div>' +
      '<div class="kzm-ray" aria-hidden="true"><span class="kzm-tren">' + TREN + '</span></div>' +
      '<div class="kzm-kule-y" aria-hidden="true">' + SAAT + '</div>' +
      '<p class="kzm-tabela"><b>' + esc(S.mahalle || '') + '</b><span>' + biten + ' / ' + L.length + ' bina · ★ ' + toplam + '</span></p>' +
      '<svg class="kzm-yol" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="' + yol + '"/></svg>' +
      '<ol class="kzm-evler">' + L.map(function (x, k) {
        var acik = konuAcik(i, L, k), d = kd(i, x.id), bitti = bittiMi(i, x.id);
        return '<li style="left:' + Y[k][0] + '%;top:' + Y[k][1] + '%;--r:' + x.renk + ';--i:' + k + '" class="' + (acik ? '' : 'kzm-kilit') + (k === sira ? ' kzm-sira' : '') + '"><button type="button" class="kzm-ev" data-kzmk="' + x.id + '"' + (acik ? '' : ' aria-disabled="true"') +
          ' aria-label="' + esc(x.en + ', ' + x.tr + (acik ? (bitti ? ', bitti, ' + d.oyna + ' yıldız' : '') : ', kilitli')) + '">' + ev(x.renk, !acik, bitti, k) + (x.zaman ? '<span class="kzm-saat-r" aria-hidden="true">⏰</span>' : '') +
          '<span class="kzm-ad"><b lang="en">' + esc(x.en) + '</b><small>' + esc(x.tr) + '</small>' + (acik ? (bitti ? yildizHtml(d.oyna) : '<i class="kzm-adim">' + ['izle', 'dene', 'oyna'].map(function (a) { return '<u' + (d[a] > 0 ? ' class="on"' : '') + '></u>'; }).join('') + '</i>') : '<i>🔒</i>') + '</span></button></li>';
      }).join('') + '</ol><span class="kzm-yuruyen" aria-hidden="true" style="left:' + Y[son][0] + '%;top:' + Y[son][1] + '%">' + acd('mutlu', 'el') + '</span></main></div>';
    oz.kok.dataset.gorunum = 'gramer';
    oz.kok.querySelector('[data-kzmgeri]').addEventListener('click', function () { if (SES) SES.fx('dokun'); dur(); oz.geri(); });
    oz.kok.querySelectorAll('[data-kzmsv]').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = +b.getAttribute('data-kzmsv'), i2 = il();
        if (!seviyeAcik(i2, n)) { if (SES) { SES.fx('yanlis'); SES.soyle('Bu seviye için önce bir önceki mahalledeki bütün binaları bitir.', 'tr'); } return; }
        i2.gramerSv = n; kaydet(i2); if (SES) SES.fx('dokun'); kasaba();
      });
    });
    var yr = oz.kok.querySelector('.kzm-yuruyen'), gidiyor = false;
    oz.kok.querySelectorAll('[data-kzmk]').forEach(function (b, k) {
      b.addEventListener('click', function () {
        if (gidiyor) return; var x = L[k];
        if (!konuAcik(il(), L, k)) { if (SES) { SES.fx('yanlis'); SES.soyle('Önce ' + L[k - 1].tr + ' binasını bitir.', 'tr'); } b.classList.remove('kzm-salla'); void b.offsetWidth; b.classList.add('kzm-salla'); return; }
        if (SES) SES.fx('dokun'); var i2 = il(); i2.gramerSon = x.id; kaydet(i2);
        if (k === son || SAKIN || !yr.animate) return konu(x);
        gidiyor = true; var a = Y[son], h = Y[k];
        yr.animate([{ left: a[0] + '%', top: a[1] + '%' }, { left: h[0] + '%', top: h[1] + '%' }], { duration: 900, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }).finished.then(function () { konu(x); }, function () { konu(x); });
      });
    });
    if (SES && sira >= 0) SES.soyle((S.mahalle || '') + '! Sıradaki bina: ' + L[sira].tr + '.', 'tr');
  }

  /* ---------------- bina: üç adım ---------------- */
  var ADIM = [['izle', 'İzle', 'Watch', 'oynat'], ['dene', 'Dene', 'Try', 'firca'], ['oyna', 'Oyna', 'Play', 'yildiz']];
  function konu(x, yeni) {
    dur();
    var i = il(), d = kd(i, x.id), sira = ADIM.findIndex(function (a) { return adimAcik(d, a[0]) && !(d[a[0]] > 0); });
    oz.kok.innerHTML = '<div class="kzm kzm-konu kzm-sv' + x.sv + '" style="--r:' + x.renk + '">' + ust('Kasabaya dön', esc(x.en), esc(x.tr)) +
      '<main class="kzm-konu-alan"><div class="kzm-ev-buyuk" aria-hidden="true">' + ev(x.renk, false, bittiMi(i, x.id), 0) + '</div>' +
      '<ol class="kzm-adimlar">' + ADIM.map(function (a, j) {
        var ac = adimAcik(d, a[0]), y = d[a[0]] || 0, bitti = y > 0;
        return '<li style="--j:' + j + '"><button type="button" class="kzm-adim-b' + (bitti ? ' kzm-a-bitti' : '') + (j === sira ? ' kzm-a-simdi' : '') + '" data-kzma="' + a[0] + '"' + (ac ? '' : ' aria-disabled="true"') + ' aria-label="' + esc((j + 1) + '. adım: ' + a[1] + (bitti ? ', bitti' : ac ? '' : ', kilitli')) + '">' +
          '<span class="kzm-a-no">' + (ac ? (C ? C.simge(a[3]) : j + 1) : '🔒') + '</span><b>' + (j + 1) + '. ' + a[1] + '</b><small lang="en">' + a[2] + '</small>' + (bitti ? (a[0] === 'izle' ? '<i class="kzm-y">✓</i>' : yildizHtml(y)) : '') + '</button></li>';
      }).join('') + '</ol>' + (yeni ? '<div class="kzm-yeni" role="status"><span aria-hidden="true">🏠</span><b>Bina tamam!</b><small>' + (yeni === 'sonuncu' ? 'Mahallenin bütün binalarını bitirdin!' : 'Sıradaki bina açıldı.') + '</small></div>' : '') + '</main></div>';
    oz.kok.dataset.gorunum = 'gramer';
    oz.kok.querySelector('[data-kzmgeri]').addEventListener('click', function () { if (SES) SES.fx('dokun'); kasaba(); });
    if (yeni && SES) { SES.fx('yildiz'); SES.soyle('Tebrikler! ' + x.tr + ' binası tamam!', 'tr'); }
    else if (SES && sira >= 0) SES.soyle(x.tr + '. Sıradaki adım: ' + ADIM[sira][1] + '.', 'tr');
    oz.kok.querySelectorAll('[data-kzma]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-kzma');
        if (!adimAcik(kd(il(), x.id), a)) { if (SES) { SES.fx('yanlis'); SES.soyle('Önce bir önceki adımı bitir.', 'tr'); } return; }
        if (SES) SES.fx('dokun'); ({ izle: izle, dene: dene, oyna: oyna })[a](x);
      });
    });
  }
  function adimBitti(x, a, y, hata, n) {
    var i = il(); i.gramer = i.gramer || {}; var d = i.gramer[x.id] = i.gramer[x.id] || {}, once = bittiMi(i, x.id);
    if (!(d[a] >= y)) d[a] = y;
    i.gramerLog = (i.gramerLog || []).concat([{ t: Date.now(), id: x.id, a: a, y: y, h: hata || 0, n: n || 0 }]).slice(-60);
    kaydet(i);
    if (!once && bittiMi(i, x.id)) { var L = liste(x.sv); return L[L.length - 1].id === x.id ? 'sonuncu' : 'yeni'; }
    return '';
  }
  function sahne(x, n, baslik) {
    oz.kok.innerHTML = '<div class="kzm kzm-oyun kzm-sv' + x.sv + '" style="--r:' + x.renk + '">' + ust('Binaya dön', esc(baslik), esc(x.en),
      n ? '<ol class="kzm-noktalar" aria-label="İlerleme">' + new Array(n + 1).join('<li></li>') + '</ol>' : '<span></span>') + '<main class="kzm-kart" data-kzmkart></main></div>';
    oz.kok.dataset.gorunum = 'gramer';
    oz.kok.querySelector('[data-kzmgeri]').addEventListener('click', function () { if (SES) SES.fx('dokun'); konu(x); });
    var nk = [].slice.call(oz.kok.querySelectorAll('.kzm-noktalar li')); if (nk[0]) nk[0].className = 'simdi';
    return { kart: oz.kok.querySelector('[data-kzmkart]'), nokta: function (k) { if (nk[k]) nk[k].className = 'tamam'; if (nk[k + 1]) nk[k + 1].className = 'simdi'; } };
  }
  function bitis(x, a, y, hata, n, baslik) {
    var yeni = adimBitti(x, a, y, hata, n), j = ADIM.findIndex(function (z) { return z[0] === a; }), sonraki = ADIM[j + 1];
    var kart = oz.kok.querySelector('[data-kzmkart]');
    kart.innerHTML = '<div class="kzm-bitis"><div class="ka-konfeti" aria-hidden="true">' + new Array(20).join('<i></i>') + '</div><span class="kzm-acd" aria-hidden="true">' + acd('kutlama') + '</span><h2>' + esc(baslik || 'Harika!') + '</h2>' +
      (a === 'izle' ? '' : '<p class="kzm-yildizlar">' + yildizHtml(y, 'kzm-yb') + '</p><p>' + n + ' soru' + (hata ? ' · ' + hata + ' yanlış deneme' : ' · hiç yanlış yok!') + '</p>') +
      '<div class="kzm-bitis-d"><button type="button" class="ka-orta" data-kzmtekrar>Tekrar</button><button type="button" class="ka-buyuk" data-kzmdevam>' + (sonraki && !yeni ? 'Sıradaki: ' + sonraki[1] : 'Binaya dön') + '</button></div></div>';
    if (SES) { SES.fx('yildiz'); if (a !== 'izle') SES.soyle(y === 3 ? 'Mükemmel! Üç yıldız!' : 'Aferin! Adımı bitirdin!', 'tr'); }
    kart.querySelector('[data-kzmtekrar]').addEventListener('click', function () { ({ izle: izle, dene: dene, oyna: oyna })[a](x); });
    kart.querySelector('[data-kzmdevam]').addEventListener('click', function () { if (sonraki && !yeni) ({ izle: izle, dene: dene, oyna: oyna })[sonraki[0]](x); else konu(x, yeni); });
  }

  /* ---------------- canlı kelime karakterleri ---------------- */
  function blokHtml(b, j) {
    var ic = b.kok != null ? '<span class="kzm-kok">' + esc(b.kok) + '</span><span class="kzm-ek">' + esc(b.ek) + '</span>'
      : b.eski != null ? '<span class="kzm-don"><span class="kzm-eski">' + esc(b.eski) + '</span><span class="kzm-yeni-k">' + esc(b.m) + '</span></span>' : esc(b.m);
    return '<span class="kzm-b kzm-r-' + b.r + (b.kok != null ? ' kzm-ekli' : '') + (b.eski != null ? ' kzm-donen' : '') + '" style="--j:' + j + '" title="' + ROL[b.r] + '"><i class="kzm-goz" aria-hidden="true"></i>' + ic + '</span>';
  }
  function cumleHtml(s) { var p = parca(s); return '<p class="kzm-cumle" lang="en" aria-label="' + esc(metin(s)) + '">' + p.bloklar.map(blokHtml).join('') + (p.son ? '<span class="kzm-son">' + p.son + '</span>' : '') + '</p>'; }
  var ISTASYON = [['dun', 'dün', 'yesterday', 12], ['her', 'her gün', 'every day', 37], ['simdi', 'şimdi', 'now', 62], ['yarin', 'yarın', 'tomorrow', 88]];
  function zamanHtml(z) {
    var p = (ISTASYON.filter(function (s) { return s[0] === z; })[0] || ISTASYON[2])[3];
    return '<div class="kzm-zaman" style="--p:' + p + '%" aria-label="Zaman treni: ' + esc((ISTASYON.filter(function (s) { return s[0] === z; })[0] || [])[1] || '') + '"><span class="kzm-z-ray"></span>' +
      ISTASYON.map(function (s) { return '<span class="kzm-ist' + (s[0] === z ? ' on' : '') + '" style="left:' + s[3] + '%"><b>' + s[1] + '</b><small lang="en">' + s[2] + '</small></span>'; }).join('') + '<span class="kzm-z-tren">' + TREN + '</span></div>';
  }

  /* ---------------- 1) İZLE ---------------- */
  function izle(x) {
    dur(); durum = {}; var ben = durum, F = x.iz, n = 0, sc = sahne(x, F.length, 'İzle'), sonZ = '';
    function kare() {
      if (ben !== durum) return; var f = F[n];
      var zt = f.z ? zamanHtml(f.z) : '';
      sc.kart.innerHTML = '<div class="kzm-izle">' + zt + '<div class="kzm-sahne">' + (f.r && resim(f.r) ? '<span class="kzm-res" aria-hidden="true">' + resim(f.r) + '</span>' : '') +
        (f.b ? '<div class="kzm-boy" aria-hidden="true">' + f.b.map(function (w, q) { return '<span style="--q:' + q + '"><i></i><b lang="en">' + esc(w) + '</b></span>'; }).join('') + '</div>' : '') +
        cumleHtml(f.s) + '</div><p class="kzm-anlat">' + esc(f.t) + '</p>' +
        (f.tab ? '<table class="kzm-tablo"><tbody>' + f.tab.map(function (r, q) { return '<tr style="--q:' + q + '"><th>' + esc(r[0]) + '</th><td lang="en">' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
        '<div class="kzm-izle-d"><button type="button" class="ka-orta" data-kzmonce' + (n ? '' : ' disabled') + ' aria-label="Önceki">◀</button><button type="button" class="kzm-dinle" data-kzmdinle aria-label="Tekrar dinle">' + (C ? C.simge('ses') : '♪') + '</button>' +
        '<button type="button" class="ka-buyuk" data-kzmileri>' + (n === F.length - 1 ? 'Bitti!' : 'İleri ▶') + '</button></div></div>';
      var zz = sc.kart.querySelector('.kzm-zaman');
      if (zz && sonZ && sonZ !== f.z && !SAKIN) { var eskiP = (ISTASYON.filter(function (s) { return s[0] === sonZ; })[0] || [])[3]; if (eskiP != null) { zz.style.setProperty('--p0', eskiP + '%'); zz.classList.add('kzm-z-git'); } }
      sonZ = f.z || sonZ;
      var konus = function () { return soyle(f.t, 'tr').then(function () { return bekle(250); }).then(function () { if (ben === durum) return soyle(metin(f.s), 'en'); }).then(function () { if (ben === durum) { var b = sc.kart.querySelector('[data-kzmileri]'); if (b) b.classList.add('kzm-hazir'); } }); };
      konus();
      sc.kart.querySelector('[data-kzmdinle]').addEventListener('click', function () { if (SES) SES.sus(); konus(); });
      sc.kart.querySelector('[data-kzmonce]').addEventListener('click', function () { if (n > 0) { if (SES) SES.sus(); n--; kare(); } });
      sc.kart.querySelector('[data-kzmileri]').addEventListener('click', function () { if (SES) { SES.sus(); SES.fx('dokun'); } sc.nokta(n); n++; if (n >= F.length) bitis(x, 'izle', 1, 0, F.length, 'Kuralı öğrendin!'); else kare(); });
    }
    kare();
  }

  /* ---------------- 2) DENE: bloğu boşluğa koy ---------------- */
  function dene(x) {
    dur(); durum = {}; var ben = durum, L = x.de, n = 0, hataT = 0, sc = sahne(x, L.length, 'Dene');
    function tur() {
      if (ben !== durum) return; var q = L[n], yanlis = 0, secenek = karistir([q[1]].concat(q[2]));
      var p = q[0].split('___');
      sc.kart.innerHTML = '<div class="kzm-dene"><p class="kzm-d-tr">' + esc(q[3]) + '</p><p class="kzm-d-cumle" lang="en">' + esc(p[0]) + '<span class="kzm-bosluk" data-kzmbos aria-label="boşluk">?</span>' + esc(p[1] || '') + '</p>' +
        '<p class="kzm-d-ip">Doğru bloğu boşluğa sürükle ya da dokun.</p><div class="kzm-d-bloklar">' + secenek.map(function (s, j) { return '<button type="button" class="kzm-b kzm-r-o kzm-surukle" data-kzms="' + esc(s) + '" style="--j:' + j + '"><i class="kzm-goz" aria-hidden="true"></i>' + esc(s) + '</button>'; }).join('') + '</div></div>';
      var bos = sc.kart.querySelector('[data-kzmbos]'), bitti = false;
      function dene_(b) {
        if (bitti || ben !== durum) return; var s = b.getAttribute('data-kzms');
        if (s === q[1]) {
          bitti = true; if (SES) SES.fx('dogru'); bos.textContent = s; bos.classList.add('kzm-dolu'); b.classList.add('kzm-gitti'); sc.nokta(n);
          soyle(q[0].replace('___', q[1]).replace(/ \((.*?)\)$/, ''), 'en').then(function () { return bekle(450); }).then(function () { if (ben !== durum) return; n++; if (n >= L.length) bitis(x, 'dene', yildiz(hataT), hataT, L.length, 'Denedin, başardın!'); else tur(); });
        } else {
          hataT++; yanlis++; if (SES) SES.fx('yanlis'); b.classList.remove('kzm-salla'); void b.offsetWidth; b.classList.add('kzm-salla');
          if (yanlis >= 2) { var d = sc.kart.querySelector('[data-kzms="' + q[1].replace(/"/g, '\\"') + '"]'); if (d) d.classList.add('kzm-ipucu'); }
        }
      }
      sc.kart.querySelectorAll('[data-kzms]').forEach(function (b) {
        b.addEventListener('click', function (e) { if (b.__suruklendi) { b.__suruklendi = false; return; } dene_(b); });
        /* sürükle-bırak: işaretçiyle; boşluğun üstüne bırakılırsa dener, değilse yerine döner */
        b.addEventListener('pointerdown', function (e) {
          if (bitti || e.button !== 0) return; var x0 = e.clientX, y0 = e.clientY, oynadi = false;
          var hareket = function (ev) { var dx = ev.clientX - x0, dy = ev.clientY - y0; if (!oynadi && Math.abs(dx) + Math.abs(dy) < 8) return; oynadi = true; b.classList.add('kzm-tutuldu'); b.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(-4deg)'; var r = bos.getBoundingClientRect(); bos.classList.toggle('kzm-hedef', ev.clientX > r.left - 20 && ev.clientX < r.right + 20 && ev.clientY > r.top - 30 && ev.clientY < r.bottom + 30); };
          var birak = function (ev) {
            W.removeEventListener('pointermove', hareket); W.removeEventListener('pointerup', birak); W.removeEventListener('pointercancel', birak);
            if (!oynadi) return; b.__suruklendi = true; var ustte = bos.classList.contains('kzm-hedef'); bos.classList.remove('kzm-hedef'); b.classList.remove('kzm-tutuldu'); b.style.transform = '';
            if (ustte) dene_(b);
          };
          W.addEventListener('pointermove', hareket); W.addEventListener('pointerup', birak); W.addEventListener('pointercancel', birak);
        });
      });
      soyle(q[3], 'tr');
    }
    tur();
  }

  /* ---------------- 3) OYNA: seç · doğru mu · sırala ---------------- */
  function oyna(x) {
    dur(); durum = {}; var ben = durum, L = karistir(x.oy.map(oyCoz)), n = 0, hataT = 0, sc = sahne(x, L.length, 'Oyna');
    function sonraki() { sc.nokta(n); return bekle(650).then(function () { if (ben !== durum) return; n++; if (n >= L.length) bitis(x, 'oyna', yildiz(hataT), hataT, L.length, 'Binayı bitirdin!'); else tur(); }); }
    function tur() {
      if (ben !== durum) return; var q = L[n];
      if (q.t === 's') {
        var p = q.c.split('___');
        sc.kart.innerHTML = '<div class="kzm-oy"><span class="kzm-oy-tip">Boşluğa hangisi gelir?</span><p class="kzm-d-cumle" lang="en">' + esc(p[0]) + '<span class="kzm-bosluk">?</span>' + esc(p[1] || '') + '</p><p class="kzm-d-tr">' + esc(q.tr) + '</p><div class="kzm-secler">' +
          karistir([q.d].concat(q.y)).map(function (s) { return '<button type="button" class="kzm-sec" data-kzmo="' + esc(s) + '" lang="en">' + esc(s) + '</button>'; }).join('') + '</div></div>';
        var cozdu = false;
        sc.kart.querySelector('.kzm-secler').addEventListener('click', function (e) {
          var b = e.target.closest('[data-kzmo]'); if (!b || b.disabled || cozdu) return;
          if (b.getAttribute('data-kzmo') === q.d) { cozdu = true; if (SES) SES.fx('dogru'); b.classList.add('kzm-s-dogru'); sc.kart.querySelector('.kzm-bosluk').textContent = q.d; sc.kart.querySelector('.kzm-bosluk').classList.add('kzm-dolu'); soyle(q.c.replace('___', q.d).replace(/ \((.*?)\)$/, ''), 'en').then(sonraki); }
          else { hataT++; b.disabled = true; b.classList.add('kzm-s-yanlis', 'kzm-salla'); if (SES) SES.fx('yanlis'); }
        });
      } else if (q.t === 'y') {
        sc.kart.innerHTML = '<div class="kzm-oy"><span class="kzm-oy-tip">Bu cümle doğru mu?</span><p class="kzm-y-tabela" lang="en">' + esc(q.c) + '</p><p class="kzm-d-tr">' + esc(q.tr) + '</p>' +
          '<div class="kzm-dy"><button type="button" class="kzm-dy-b kzm-dy-e" data-kzmy="1"><span aria-hidden="true">✓</span>Doğru</button><button type="button" class="kzm-dy-b kzm-dy-h" data-kzmy="0"><span aria-hidden="true">✗</span>Yanlış</button></div><p class="kzm-duzelt" aria-live="polite"></p></div>';
        var bitti = false;
        sc.kart.querySelector('.kzm-dy').addEventListener('click', function (e) {
          var b = e.target.closest('[data-kzmy]'); if (!b || bitti) return; bitti = true;
          var dogru = (b.getAttribute('data-kzmy') === '1') === q.ok, dz = sc.kart.querySelector('.kzm-duzelt'), tab = sc.kart.querySelector('.kzm-y-tabela');
          if (dogru) { if (SES) SES.fx('dogru'); b.classList.add('kzm-s-dogru'); } else { hataT++; if (SES) SES.fx('yanlis'); b.classList.add('kzm-s-yanlis', 'kzm-salla'); }
          if (!q.ok) { tab.classList.add('kzm-ciz'); dz.innerHTML = '<span>Doğrusu:</span> <b lang="en">' + esc(q.dz) + '</b>'; soyle(q.dz, 'en').then(function () { return bekle(500); }).then(sonraki); }
          else { dz.innerHTML = '<span>Bu cümle doğru!</span>'; soyle(q.c, 'en').then(sonraki); }
        });
      } else {
        var P = parca(q.s), sira = P.bloklar.map(function (b) { return b.m; }), kar = karistir(sira.map(function (m, j) { return j; })), k = 0;
        if (kar.every(function (v, j) { return v === j; }) && kar.length > 1) kar.reverse();
        sc.kart.innerHTML = '<div class="kzm-oy"><span class="kzm-oy-tip">Kelimeleri sırayla diz.</span><p class="kzm-d-tr">' + esc(q.tr) + '</p><p class="kzm-dizi" lang="en" aria-live="polite"></p><div class="kzm-d-bloklar">' +
          kar.map(function (j) { var b = P.bloklar[j]; return '<button type="button" class="kzm-b kzm-r-' + b.r + '" data-kzmd="' + j + '"><i class="kzm-goz" aria-hidden="true"></i>' + esc(b.m) + '</button>'; }).join('') + '</div></div>';
        var dizi = sc.kart.querySelector('.kzm-dizi'), yanlis = 0;
        sc.kart.querySelector('.kzm-d-bloklar').addEventListener('click', function (e) {
          var b = e.target.closest('[data-kzmd]'); if (!b || b.disabled) return;
          if (b.textContent === sira[k]) {
            if (SES) SES.fx('dokun'); b.disabled = true; b.classList.add('kzm-gitti'); dizi.insertAdjacentHTML('beforeend', blokHtml(P.bloklar[k], k)); k++; yanlis = 0;
            sc.kart.querySelectorAll('.kzm-ipucu').forEach(function (z) { z.classList.remove('kzm-ipucu'); });
            if (k >= sira.length) { if (P.son) dizi.insertAdjacentHTML('beforeend', '<span class="kzm-son">' + P.son + '</span>'); if (SES) SES.fx('dogru'); soyle(metin(q.s), 'en').then(sonraki); }
          } else {
            hataT++; yanlis++; if (SES) SES.fx('yanlis'); b.classList.remove('kzm-salla'); void b.offsetWidth; b.classList.add('kzm-salla');
            if (yanlis >= 2) sc.kart.querySelectorAll('[data-kzmd]').forEach(function (z) { if (!z.disabled && z.textContent === sira[k]) z.classList.add('kzm-ipucu'); });
          }
        });
      }
      if (SES) SES.soyle(q.t === 's' ? 'Boşluğa hangisi gelir?' : q.t === 'y' ? 'Bu cümle doğru mu?' : 'Kelimeleri sırayla diz.', 'tr');
    }
    tur();
  }

  /* ---------------- veli raporu ---------------- */
  function rapor(i) {
    var g = i.gramer || {}; if (!Object.keys(g).length) return '';
    var hafta = Date.now() - 7 * 864e5, log = (i.gramerLog || []).filter(function (z) { return z.t >= hafta; });
    var zayif = V().KONU.filter(function (x) { return g[x.id] && g[x.id].oyna > 0 && g[x.id].oyna < 2; }).slice(0, 3);
    return '<section class="kzm-rapor"><h3>İlkokul · Zaman Makinesi Kasabası <small>dil bilgisi</small></h3><ul class="kzm-r-sv">' + [2, 3, 4].map(function (sv) {
      var L = liste(sv), b = L.filter(function (x) { return bittiMi(i, x.id); }).length, S = V().SEVIYE[sv];
      return '<li><b>' + S.ad + ' <small>' + S.sinif + '</small></b><span><i style="width:' + Math.round(b / L.length * 100) + '%"></i></span><em>' + b + ' / ' + L.length + '</em></li>';
    }).join('') + '</ul><p class="ka-pen-alt">Bu hafta ' + log.length + ' adım tamamladı.</p>' +
      (zayif.length ? '<h4>Biraz daha tekrar</h4><ul>' + zayif.map(function (x) { return '<li>⚠️ <span lang="en">' + esc(x.en) + '</span> · ' + esc(x.tr) + '</li>'; }).join('') + '</ul>' : '') + '</section>';
  }

  /* seslendirme kataloğu: kasabanın söylediği bütün cümleler */
  function cumleler() {
    var tr = ['Bu seviye için önce bir önceki mahalledeki bütün binaları bitir.', 'Önce bir önceki adımı bitir.', 'Boşluğa hangisi gelir?', 'Bu cümle doğru mu?', 'Kelimeleri sırayla diz.', 'Mükemmel! Üç yıldız!', 'Aferin! Adımı bitirdin!', 'Zaman Makinesi Kasabasına hoş geldin!'], en = [];
    [2, 3, 4].forEach(function (sv) {
      var L = liste(sv), S = V().SEVIYE[sv];
      L.forEach(function (x, k) {
        tr.push(S.mahalle + '! Sıradaki bina: ' + x.tr + '.', 'Tebrikler! ' + x.tr + ' binası tamam!'); if (k) tr.push('Önce ' + L[k - 1].tr + ' binasını bitir.');
        ADIM.forEach(function (a) { tr.push(x.tr + '. Sıradaki adım: ' + a[1] + '.'); });
        x.iz.forEach(function (f) { tr.push(f.t); en.push(metin(f.s)); });
        x.de.forEach(function (q) { tr.push(q[3]); en.push(q[0].replace('___', q[1]).replace(/ \((.*?)\)$/, '')); });
        x.oy.map(oyCoz).forEach(function (q) { if (q.t === 's') en.push(q.c.replace('___', q.d).replace(/ \((.*?)\)$/, '')); else if (q.t === 'y') en.push(q.ok ? q.c : q.dz); else en.push(metin(q.s)); });
      });
    });
    var u = function (a) { return a.filter(function (v, j) { return a.indexOf(v) === j; }); };
    return { tr: u(tr), en: u(en) };
  }

  function ac(o) {
    C = W.KIDS_CIZ; SES = W.KIDS_SES; R = W.KIDS_RESIM; oz = o; if (o.dur) o.dur();
    kasaba();
    return { dur: dur };
  }
  W.KIDS_GRAMER = { ac: ac, parca: parca, metin: metin, yildiz: yildiz, konuAcik: konuAcik, seviyeAcik: seviyeAcik, bittiMi: bittiMi, adimAcik: adimAcik, oyCoz: oyCoz, rapor: rapor, cumleler: cumleler, _oz: function (x) { oz = x; } };
})(window);
