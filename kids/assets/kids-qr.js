/* ==========================================================================
   ACADEX KIDS · QR kod üretici (kids/assets/kids-qr.js), 14.11.2026
   Evde devam kartlarındaki QR'ı tarayıcıda üretir. Dış servis KULLANILMAZ:
   QR içinde okul kodu ve öğrenci kimliği var; bunu üçüncü bir siteye göndermek
   KVKK açısından uygun değil (admin-ders.js'teki ders QR'ı dış servisle üretilir,
   orada çocuk verisi yoktur).
   Standart QR (ISO/IEC 18004): bayt kipi, hata düzeltme M (yüzde 15), sürüm 1-10
   (en çok 213 bayt), maske ceza puanına göre seçilir. Algoritma Nayuki'nin açık
   anlatımındaki adımları izler; tests/kids-kres.js çıktıyı çözerek doğrular.
   W.KIDS_QR.svg(metin, {boyut, renk}) → '<svg…>' · KIDS_QR.matris(metin) → [[bool]]
   ========================================================================== */
(function (W) {
  'use strict';
  /* sürüm 1-10, hata düzeltme M */
  var ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var BLOK = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  var M_BIT = 0;   /* format bitlerinde M = 00 */

  function hamModul(v) { var r = (16 * v + 128) * v + 64; if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; }
  function veriKelime(v) { return Math.floor(hamModul(v) / 8) - ECC[v] * BLOK[v]; }
  function utf8(s) { var b = [], e = unescape(encodeURIComponent(s)); for (var i = 0; i < e.length; i++) b.push(e.charCodeAt(i)); return b; }
  function bit(x, i) { return ((x >>> i) & 1) !== 0; }

  /* GF(256) çarpma ve Reed-Solomon */
  function carp(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function bolen(d) { var r = []; for (var i = 0; i < d - 1; i++) r.push(0); r.push(1); var kok = 1; for (i = 0; i < d; i++) { for (var j = 0; j < r.length; j++) { r[j] = carp(r[j], kok); if (j + 1 < r.length) r[j] ^= r[j + 1]; } kok = carp(kok, 2); } return r; }
  function kalan(veri, b) { var r = b.map(function () { return 0; }); veri.forEach(function (x) { var f = x ^ r.shift(); r.push(0); b.forEach(function (c, i) { r[i] ^= carp(c, f); }); }); return r; }

  function hizalama(v, boyut) { if (v === 1) return []; var n = Math.floor(v / 7) + 2, adim = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, r = [6]; for (var p = boyut - 7; r.length < n; p -= adim) r.splice(1, 0, p); return r; }

  function matris(metin) {
    var veri = utf8(String(metin)), v = 1;
    while (v <= 10 && 4 + (v < 10 ? 8 : 16) + veri.length * 8 > veriKelime(v) * 8) v++;
    if (v > 10) throw new Error('QR için metin çok uzun');
    var boyut = v * 4 + 17, M = [], F = [], x, y, i, j;
    for (y = 0; y < boyut; y++) { M.push([]); F.push([]); for (x = 0; x < boyut; x++) { M[y].push(false); F[y].push(false); } }
    function koy(x, y, k) { M[y][x] = k; F[y][x] = true; }
    /* sabit desenler: zamanlama, bulucular, hizalama */
    for (i = 0; i < boyut; i++) { koy(6, i, i % 2 === 0); koy(i, 6, i % 2 === 0); }
    [[3, 3], [boyut - 4, 3], [3, boyut - 4]].forEach(function (p) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = p[0] + dx, yy = p[1] + dy; if (xx >= 0 && xx < boyut && yy >= 0 && yy < boyut) koy(xx, yy, d !== 2 && d !== 4); } });
    var ap = hizalama(v, boyut), n = ap.length;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) { if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue; for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) koy(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    function format(maske) {
      var d = M_BIT << 3 | maske, r = d; for (var k = 0; k < 10; k++) r = (r << 1) ^ ((r >>> 9) * 0x537); var b = (d << 10 | r) ^ 0x5412;
      for (k = 0; k <= 5; k++) koy(8, k, bit(b, k)); koy(8, 7, bit(b, 6)); koy(8, 8, bit(b, 7)); koy(7, 8, bit(b, 8));
      for (k = 9; k < 15; k++) koy(14 - k, 8, bit(b, k));
      for (k = 0; k < 8; k++) koy(boyut - 1 - k, 8, bit(b, k));
      for (k = 8; k < 15; k++) koy(8, boyut - 15 + k, bit(b, k));
      koy(8, boyut - 8, true);
    }
    format(0);
    if (v >= 7) { var r = v; for (i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); var vb = v << 12 | r; for (i = 0; i < 18; i++) { var c = bit(vb, i), a = boyut - 11 + i % 3, b2 = Math.floor(i / 3); koy(a, b2, c); koy(b2, a, c); } }
    /* veri: kip 0100 + uzunluk + baytlar + sonlandırıcı + dolgu */
    var bits = [], ek = function (val, len) { for (var k = len - 1; k >= 0; k--) bits.push((val >>> k) & 1); };
    ek(4, 4); ek(veri.length, v < 10 ? 8 : 16); veri.forEach(function (b) { ek(b, 8); });
    var kap = veriKelime(v) * 8; ek(0, Math.min(4, kap - bits.length)); ek(0, (8 - bits.length % 8) % 8);
    for (var dolgu = 0xEC; bits.length < kap; dolgu ^= 0xEC ^ 0x11) ek(dolgu, 8);
    var kel = []; for (i = 0; i < bits.length; i += 8) { var t = 0; for (j = 0; j < 8; j++) t = t << 1 | bits[i + j]; kel.push(t); }
    /* bloklara böl, hata düzeltme ekle, iç içe geçir */
    var nb = BLOK[v], el = ECC[v], ham = Math.floor(hamModul(v) / 8), kisaN = nb - ham % nb, kisaL = Math.floor(ham / nb), bl = [], rs = bolen(el), son = [];
    for (i = 0, j = 0; i < nb; i++) { var d = kel.slice(j, j + kisaL - el + (i < kisaN ? 0 : 1)); j += d.length; var e = kalan(d, rs); if (i < kisaN) d.push(0); bl.push(d.concat(e)); }
    for (i = 0; i < bl[0].length; i++) bl.forEach(function (b, k) { if (i !== kisaL - el || k >= kisaN) son.push(b[i]); });
    /* zikzak yerleştirme */
    var s = 0;
    for (var sag = boyut - 1; sag >= 1; sag -= 2) {
      if (sag === 6) sag = 5;
      for (var dik = 0; dik < boyut; dik++) for (j = 0; j < 2; j++) {
        x = sag - j; var yukari = ((sag + 1) & 2) === 0; y = yukari ? boyut - 1 - dik : dik;
        if (!F[y][x] && s < son.length * 8) { M[y][x] = bit(son[s >>> 3], 7 - (s & 7)); s++; }
      }
    }
    function maskele(m) {
      for (var yy = 0; yy < boyut; yy++) for (var xx = 0; xx < boyut; xx++) {
        if (F[yy][xx]) continue; var t;
        switch (m) { case 0: t = (xx + yy) % 2 === 0; break; case 1: t = yy % 2 === 0; break; case 2: t = xx % 3 === 0; break; case 3: t = (xx + yy) % 3 === 0; break;
          case 4: t = (Math.floor(xx / 3) + Math.floor(yy / 2)) % 2 === 0; break; case 5: t = xx * yy % 2 + xx * yy % 3 === 0; break;
          case 6: t = (xx * yy % 2 + xx * yy % 3) % 2 === 0; break; default: t = ((xx + yy) % 2 + xx * yy % 3) % 2 === 0; }
        if (t) M[yy][xx] = !M[yy][xx];
      }
    }
    /* ceza: art arda aynı renk, 2x2 bloklar, bulucuya benzeyen dizi, siyah/beyaz dengesi */
    function ceza() {
      var p = 0, koyu = 0, k, run, yy, xx;
      for (var yon = 0; yon < 2; yon++) for (var a = 0; a < boyut; a++) {
        run = 1; var dizi = '';
        for (var b = 0; b < boyut; b++) {
          var c = yon ? M[b][a] : M[a][b]; dizi += c ? '1' : '0';
          if (b > 0 && c === (yon ? M[b - 1][a] : M[a][b - 1])) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
        }
        var re = /(?=(10111010000|00001011101))/g; while (re.exec(dizi)) { p += 40; re.lastIndex++; }
      }
      for (yy = 0; yy < boyut - 1; yy++) for (xx = 0; xx < boyut - 1; xx++) { k = M[yy][xx]; if (k === M[yy][xx + 1] && k === M[yy + 1][xx] && k === M[yy + 1][xx + 1]) p += 3; }
      for (yy = 0; yy < boyut; yy++) for (xx = 0; xx < boyut; xx++) if (M[yy][xx]) koyu++;
      var top = boyut * boyut; p += Math.max(0, Math.ceil(Math.abs(koyu * 20 - top * 10) / top) - 1) * 10;
      return p;
    }
    var enIyi = 0, enAz = Infinity;
    for (var m = 0; m < 8; m++) { maskele(m); format(m); var c = ceza(); if (c < enAz) { enAz = c; enIyi = m; } maskele(m); }
    maskele(enIyi); format(enIyi);
    return M;
  }

  function svg(metin, o) {
    o = o || {}; var M = matris(metin), n = M.length, kenar = 4, t = n + kenar * 2, d = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (M[y][x]) d += 'M' + (x + kenar) + ' ' + (y + kenar) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" class="kq" viewBox="0 0 ' + t + ' ' + t + '"' + (o.boyut ? ' width="' + o.boyut + '" height="' + o.boyut + '"' : '') + ' shape-rendering="crispEdges" role="img" aria-label="' + (o.etiket || 'QR kod') + '">' +
      '<rect width="' + t + '" height="' + t + '" fill="#fff"/><path d="' + d + '" fill="' + (o.renk || '#000') + '"/></svg>';
  }

  /* evde devam bağlantısı: okul kodu + öğrenci kimliği. Şifre YOK; çocuk yine resimli şifresini seçer */
  function evAdres(kod, ogrenciId, kok) { return (kok || 'https://acadex.com.tr/kids/') + '#ev=' + encodeURIComponent(kod) + '~' + ogrenciId; }
  function evCoz(hash) { var m = /^#?ev=([A-Za-z0-9-]{4,13})~([0-9a-f-]{36})$/i.exec(decodeURIComponent(hash || '')); return m ? { kod: m[1].toUpperCase(), ogr: m[2].toLowerCase() } : null; }

  W.KIDS_QR = { matris: matris, svg: svg, evAdres: evAdres, evCoz: evCoz };
})(typeof window !== 'undefined' ? window : globalThis);
