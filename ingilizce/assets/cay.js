/* ==========================================================================
   ACADEX ENGLISH · “Çay soğumadan dört tur” (assets/cay.js), 07.11.2026
   Her gün yeni dört tur. Tarih + günün seviyesi tohum olur; aynı gün sayfa yenilense de
   set aynı kalır, ertesi gün tamamen değişir.
     aileler   telaffuz (vurgu, ses çifti, bağlı konuşma, tonlama)
               akıcılık (“um” yerine, 30 sn hızlı cevap, cümleyi uzat, tekerleme)
               dinle-tekrarla (gölge okuma, cümle hafızası, hız artırma)
               kelime ve kalıp (günün 3 ifadesi, kalıbı tamamla)
     sıra      aileler her gün karışık sırada; her ailenin tur türü günden güne döner
   Otomatik seviye: ls 'cay' { sev: 0–5,99 (A1–C2), gunler: { 'YYYY-AA-GG': { sev, puan } } }.
   Günün seviyesi gün başında sabitlenir; her turun ilk denemesi sev değerini
   (puan − 0,6) × 0,35 kadar oynatır, yeni seviye ertesi gün devreye girer.
   İçerik: CAY_BANKA (cay-banka.js); hızlı cevap soruları KONUSMA_BANKA’dan.
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window, A = W.ACX, B = W.CAY_BANKA, KB = W.KONUSMA_BANKA, S = W.SINAV, esc = A.esc, P = 'speaking';
  var SR = W.SpeechRecognition || W.webkitSpeechRecognition;
  var SIRA = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], ADI = { A1: 'Başlangıç', A2: 'Temel', B1: 'Orta', B2: 'Orta üstü', C1: 'İleri', C2: 'Ustalık' };
  var sevNo = function (s) { return Math.max(0, SIRA.indexOf(s)); };
  var norm = function (t) { return HOCA.norm(t); };
  var kelimeSay = function (t) { var n = norm(t).trim(); return n ? n.split(' ').length : 0; };
  var ikiHane = function (n) { return ('0' + n).slice(-2); };
  var gunAnahtar = function (d) { return d.getFullYear() + '-' + ikiHane(d.getMonth() + 1) + '-' + ikiHane(d.getDate()); };

  /* tohumlu rastgele: aynı gün aynı set */
  function tohum(str) { var h = 1779033703 ^ str.length; for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return function () { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; var t = (h >>> 0) / 4294967296; h = Math.imul(h ^ 0x9e3779b9, 1597334677); return t; }; }
  function karistir(a, r) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  var GECER = .4;   /* turu “tamam” saydıran en düşük puan */
  var AILE = [
    { id: 'telaffuz', ad: 'Telaffuz', turler: ['vurgu', 'cift', 'baglanti', 'tonlama'] },
    { id: 'akicilik', ad: 'Akıcılık', turler: ['gecis', 'hizli', 'uzat', 'tekerleme'] },
    { id: 'dinle', ad: 'Dinle-tekrarla', turler: ['golge', 'hafiza', 'hiz'] },
    { id: 'kalip', ad: 'Kelime ve kalıp', turler: ['ifade', 'kalip'] }
  ];
  var TUR = {
    vurgu: ['Vurgu nerede?', 'Kelimeyi dinle, vurgulu heceyi seç. Anlaşılmayan çoğu kelime yanlış heceden.'],
    cift: ['Hangisini duydun?', 'Birbirine çok benzeyen iki kelimeden hangisi söylendi?'],
    baglanti: ['Bağlı konuşma', 'İngilizcede kelimeler birbirine akar (‿). Dinle, aynı akışla tekrarla.'],
    tonlama: ['Ses yükselir mi, düşer mi?', 'Cümlenin sonunda ses ↗ mı ↘ mı gider? Seç, sonra sesli söyle.'],
    gecis: ['“Um” yerine ne?', 'Takıldığın anlar için doğal kalıplar.'],
    hizli: ['30 saniye, hızlı cevap', 'Düşünmeden başla; 30 saniye boyunca durma.'],
    uzat: ['Cümleyi uzat', 'Kısa cümleyi bir neden, zaman ya da ayrıntıyla uzatarak söyle.'],
    tekerleme: ['Tekerleme', 'Önce yavaş dinle, sonra takılmadan söyle.'],
    golge: ['Gölge okuma', 'Cümleyi gör, dinle, aynı ritimle tekrarla.'],
    hafiza: ['Cümle hafızası', 'Cümle gizli: dinle (en çok iki kez), aklında tut, tekrar et.'],
    hiz: ['Hız artırma', 'Aynı cümle üç hızda: yavaş, normal, hızlı. Her seferinde tekrar et.'],
    ifade: ['Günün 3 ifadesi', 'İfadeyi öğren, sonra kendi cümlende sesli kullan.'],
    kalip: ['Kalıbı tamamla', 'Cümle başını kendi fikrinle tamamla.']
  };

  /* ---------- gün ve otomatik seviye ---------- */
  function baslangicSev() {
    var a = A.ls.al('akSev', null); if (a && SIRA.indexOf(a) > -1) return SIRA.indexOf(a);
    var s = A.ls.al('spSeviye', null); return { kolay: 1, orta: 2, zor: 3 }[s] != null ? { kolay: 1, orta: 2, zor: 3 }[s] : 2;
  }
  function veriAl(simdi) {
    var v = A.ls.al('cay', null); if (!v || typeof v.sev !== 'number') v = { sev: baslangicSev() + .3, gunler: {} };
    var an = gunAnahtar(simdi);
    if (!v.gunler[an]) { v.gunler[an] = { sev: SIRA[Math.max(0, Math.min(5, Math.floor(v.sev)))], puan: {} }; var ks = Object.keys(v.gunler).sort(); while (ks.length > 30) delete v.gunler[ks.shift()]; A.ls.yaz('cay', v); }
    return v;
  }
  function seviyeGuncelle(v, puan) { v.sev = Math.max(0, Math.min(5.99, v.sev + (puan - .6) * .35)); return v.sev; }
  function gunPlani(an, sev) {
    var r = tohum(an + '|' + sev), gunNo = Math.round(new Date(an + 'T12:00:00').getTime() / 864e5);
    return karistir(AILE, r).map(function (a, i) { return { aile: a, tur: a.turler[(gunNo + i * 7) % a.turler.length], tohum: an + '|' + sev + '|' + i }; });
  }

  /* ---------- ortak parçalar ---------- */
  var dinle = function (t, hiz) { if (A.ses) A.ses(String(t).replace(/‿/g, ' '), hiz || .9); };
  function dogruluk(soylenen, hedef) { var d = HOCA.dikteDegerlendir(soylenen || '-', String(hedef).replace(/‿/g, ' ')), n = norm(String(hedef).replace(/‿/g, ' ')).trim().split(' ').length; return { oran: Math.max(0, 1 - d.kacan.length / n), fark: d.geri.fark }; }
  /* konuşmayı al: tanıma varsa ● Söyle / Bitti, yoksa yaz-gönder */
  function soyleAl(el, o) {
    o = o || {};
    return new Promise(function (bitti) {
      el.innerHTML = (SR ? '<button type="button" class="btn sm ana" data-s>● Söyle</button> <button type="button" class="btn sm" data-y>Yazarak</button>' : '') +
        '<div class="cay-yaz"' + (SR ? ' hidden' : '') + '><textarea rows="2" lang="en" placeholder="' + esc(o.yer || 'cevabını yaz…') + '"></textarea><button type="button" class="btn sm ana" data-g>Gönder</button></div><p class="cay-canli" lang="en"></p>';
      var ta = el.querySelector('textarea'), canli = el.querySelector('.cay-canli');
      el.querySelector('[data-g]').onclick = function () { if (ta.value.trim()) bitti(ta.value.trim()); };
      var y = el.querySelector('[data-y]'); if (y) y.onclick = function () { el.querySelector('.cay-yaz').hidden = false; ta.focus(); };
      var s = el.querySelector('[data-s]'); if (!s) return;
      s.onclick = function () {
        var dn = S.dinle(function (m) { if (m === null) { canli.textContent = 'Mikrofon izni yok; yazarak devam et.'; el.querySelector('.cay-yaz').hidden = false; return; } canli.textContent = m; });
        if (!dn) { el.querySelector('.cay-yaz').hidden = false; return; }
        s.textContent = '■ Bitti'; s.classList.add('kayitta'); var t0 = Date.now(), iv = setInterval(function () { var k = Math.ceil((o.sure || 20) - (Date.now() - t0) / 1000); s.textContent = '■ Bitti · ' + Math.max(0, k); if (k <= 0) dur(); }, 250);
        var dur = function () { clearInterval(iv); s.disabled = true; dn.dur().then(function (r) { bitti((r.metin || '').trim() || ta.value.trim()); }); };
        s.onclick = dur;
      };
    });
  }
  function secimli(el, soru, secenekler, dogru, neden) {   /* tek seçimlik: { secildi, dogru } */
    return new Promise(function (ok) {
      el.innerHTML = soru + '<div class="cay-sec">' + secenekler.map(function (s, i) { return '<button type="button" data-i="' + i + '" lang="en">' + s + '</button>'; }).join('') + '</div><div class="cay-not"></div>';
      el.querySelectorAll('[data-i]').forEach(function (b) {
        b.onclick = function () {
          var i = +b.dataset.i, d = i === dogru;
          el.querySelectorAll('[data-i]').forEach(function (x) { x.disabled = true; if (+x.dataset.i === dogru) x.classList.add('ok'); });
          if (!d) b.classList.add('yok');
          el.querySelector('.cay-not').innerHTML = (d ? '<b class="ok">✓</b> ' : '<b class="yok">✗</b> ') + (neden || '');
          if (A.sesCal) A.sesCal(d ? 'dogru' : 'yanlis');
          setTimeout(function () { ok(d); }, d ? 900 : 1700);
        };
      });
    });
  }
  var ilerleme = function (el, i, n) { el.innerHTML = '<span class="cay-adim">' + (i + 1) + ' / ' + n + '</span>'; };

  /* ---------- tur türleri: her biri (govde, sev, r) → { puan 0–1, ozet } ---------- */
  var KOS = {
    vurgu: async function (g, sev, r) {
      var ks = karistir(B.sev[sev].vurgu, r).slice(0, 4), d = 0;
      for (var i = 0; i < ks.length; i++) {
        var k = ks[i], hece = k[1], ops = hece.map(function (_, j) { return j; });
        if (ops.length > 4) ops = karistir(ops.filter(function (j) { return j !== k[2]; }), r).slice(0, 3).concat([k[2]]).sort(function (a, b) { return a - b; });
        var yaz = function (vi) { return hece.map(function (h, j) { return j === vi ? h.toUpperCase() : h.toLowerCase(); }).join('-'); };
        g.innerHTML = '<div class="cay-ust2"></div><div class="cay-soru"></div>'; ilerleme(g.firstChild, i, ks.length);
        var soru = g.querySelector('.cay-soru');
        soru.addEventListener('click', function (e) { if (e.target.closest('[data-dinle]')) dinle(k[0], .85); });
        if (await secimli(soru, '<p class="cay-kelime" lang="en"><b>' + esc(k[0]) + '</b> <button type="button" class="btn sm" data-dinle>▶ Dinle</button></p>', ops.map(yaz), ops.indexOf(k[2]), 'Doğrusu: <b lang="en">' + esc(yaz(k[2])) + '</b>')) d++;
      }
      return { puan: d / ks.length, ozet: d + '/' + ks.length + ' doğru vurgu' };
    },
    cift: async function (g, sev, r) {
      var n = sevNo(sev), ls = karistir(B.ciftler.filter(function (c) { return sevNo(c[3]) <= n && sevNo(c[3]) >= n - 2; }), r).slice(0, 5), d = 0;
      if (ls.length < 5) ls = ls.concat(karistir(B.ciftler, r)).slice(0, 5);
      for (var i = 0; i < ls.length; i++) {
        var c = ls[i], hangi = r() < .5 ? 0 : 1;
        g.innerHTML = '<div class="cay-ust2"></div><div class="cay-soru"></div>'; ilerleme(g.firstChild, i, ls.length);
        var soru = g.querySelector('.cay-soru');
        var kel = c[hangi];
        soru.addEventListener('click', function (e) { if (e.target.closest('[data-dinle]')) dinle(kel, .85); });
        setTimeout(function () { dinle(kel, .85); }, 250);
        if (await secimli(soru, '<p><button type="button" class="btn sm" data-dinle>▶ Tekrar dinle</button></p>', [esc(c[0]), esc(c[1])], hangi, esc(c[2]))) d++;
      }
      return { puan: d / ls.length, ozet: d + '/' + ls.length + ' doğru ses' };
    },
    tonlama: async function (g, sev, r) {
      var ls = karistir(B.tonlama, r).slice(0, 5), d = 0;
      for (var i = 0; i < ls.length; i++) {
        var t = ls[i];
        g.innerHTML = '<div class="cay-ust2"></div><div class="cay-soru"></div>'; ilerleme(g.firstChild, i, ls.length);
        var soru = g.querySelector('.cay-soru');
        soru.addEventListener('click', function (e) { if (e.target.closest('[data-dinle]')) dinle(this.t, .9); }.bind({ t: t[0] }));
        if (await secimli(soru, '<p class="cay-kelime" lang="en"><b>' + esc(t[0]) + '</b> <button type="button" class="btn sm" data-dinle>▶</button></p>', ['↗ yükselir', '↘ düşer'], t[1] === 'yuk' ? 0 : 1, esc(t[2]))) d++;
      }
      return { puan: d / ls.length, ozet: d + '/' + ls.length + ' doğru tonlama' };
    },
    gecis: async function (g, sev, r) {
      var n = sevNo(sev), ls = karistir(B.gecis.filter(function (x) { return sevNo(x[4]) <= n; }), r).slice(0, 4), d = 0;
      for (var i = 0; i < ls.length; i++) {
        var x = ls[i], ops = karistir([x[1]].concat(x[2]), r);
        g.innerHTML = '<div class="cay-ust2"></div><div class="cay-soru"></div>'; ilerleme(g.firstChild, i, ls.length);
        if (await secimli(g.querySelector('.cay-soru'), '<p class="cay-durum">' + esc(x[0]) + '</p>', ops.map(esc), ops.indexOf(x[1]), esc(x[3]))) d++;
      }
      return { puan: d / ls.length, ozet: d + '/' + ls.length + ' doğal kalıp' };
    },
    hizli: async function (g, sev, r) {
      var konular = [].concat.apply([], KB.kategoriler.map(function (k) { return k.seviye[sev].konular; })), k = konular[Math.floor(r() * konular.length)];
      var hedef = { A1: 15, A2: 25, B1: 35, B2: 45, C1: 55, C2: 60 }[sev];
      g.innerHTML = '<p class="cay-kelime" lang="en"><b>' + esc(k[2]) + '</b></p><p class="say">' + esc(k[1]) + ' · hedef: en az ' + hedef + ' kelime</p><div class="cay-al"></div>';
      dinle(k[2], .95);
      var t = await soyleAl(g.querySelector('.cay-al'), { sure: 30, yer: '30 saniyede ne kadar yazabilirsen…' });
      var n = kelimeSay(t), dolgu = (t.match(new RegExp(S.DOLGU.source, 'gi')) || []).length, puan = Math.max(0, Math.min(1, n / hedef) - dolgu * .05);
      g.innerHTML = '<p class="cay-metin" lang="en">' + (t ? S.renkle(t, HOCA.gramer(t)) : '<span class="say">(cevap yok)</span>') + '</p><div class="sv-cip"><span>' + n + ' / ' + hedef + ' kelime</span>' + (dolgu ? '<span>“um” × ' + dolgu + '</span>' : '') + '</div>';
      return { puan: puan, ozet: n + ' kelime', kalsin: true };
    },
    uzat: async function (g, sev, r) {
      var ls = karistir(B.sev[sev].uzat, r).slice(0, 3), top = 0, BAG = /\b(because|when|which|who|although|but|so|if|while|that|since|whereas|unless|after|before)\b/i;
      for (var i = 0; i < ls.length; i++) {
        g.innerHTML = '<div class="cay-ust2"></div><p class="cay-kelime" lang="en"><b>' + esc(ls[i]) + '</b></p><p class="say">Bir neden, zaman ya da ayrıntı ekle (because, when, which…).</p><div class="cay-al"></div><div class="cay-not"></div>'; ilerleme(g.firstChild, i, ls.length);
        var t = await soyleAl(g.querySelector('.cay-al'), { sure: 20 }), uzun = kelimeSay(t) >= kelimeSay(ls[i]) + 5, bag = BAG.test(t), p = (uzun ? .5 : 0) + (bag ? .5 : 0); top += p;
        g.querySelector('.cay-al').innerHTML = '<p class="cay-metin" lang="en">' + S.renkle(t || '-', HOCA.gramer(t)) + '</p>';
        g.querySelector('.cay-not').innerHTML = (uzun ? '✓ uzattın' : '✗ biraz daha uzat') + ' · ' + (bag ? '✓ bağlaç' : '✗ bağlaç yok (because, which…)');
        await new Promise(function (ok) { setTimeout(ok, 1600); });
      }
      return { puan: top / ls.length, ozet: Math.round(top / ls.length * 100) + '% uzatma' };
    },
    tekerleme: async function (g, sev, r) {
      var n = sevNo(sev), ls = karistir(B.tekerleme.filter(function (x) { return sevNo(x[1]) <= n && sevNo(x[1]) >= n - 2; }), r).slice(0, 2), top = 0;
      if (!ls.length) ls = karistir(B.tekerleme, r).slice(0, 2);
      for (var i = 0; i < ls.length; i++) {
        var t0 = ls[i][0];
        g.innerHTML = '<div class="cay-ust2"></div><p class="cay-kelime" lang="en"><b>' + esc(t0) + '</b></p><p><button type="button" class="btn sm" data-yavas>▶ Yavaş</button> <button type="button" class="btn sm" data-hizli>▶ Hızlı</button></p><div class="cay-al"></div><div class="cay-not"></div>'; ilerleme(g.firstChild, i, ls.length);
        g.querySelector('[data-yavas]').onclick = function () { dinle(this.t, .7); }.bind({ t: t0 }); g.querySelector('[data-hizli]').onclick = function () { dinle(this.t, 1.15); }.bind({ t: t0 });
        var s = await soyleAl(g.querySelector('.cay-al'), { sure: 15 }), d = dogruluk(s, t0); top += d.oran;
        g.querySelector('.cay-not').innerHTML = '<div class="fark" lang="en">' + d.fark + '</div><span class="say">%' + Math.round(d.oran * 100) + ' doğru</span>';
        await new Promise(function (ok) { setTimeout(ok, 1800); });
      }
      return { puan: top / ls.length, ozet: '%' + Math.round(top / ls.length * 100) + ' tekerleme' };
    },
    golge: function (g, sev, r) { return tekrarTuru(g, karistir(B.sev[sev].golge, r).slice(0, 3), { gizli: false }); },
    hafiza: function (g, sev, r) { return tekrarTuru(g, karistir(B.sev[sev].golge, r).slice(3, 6), { gizli: true }); },
    baglanti: function (g, sev, r) { return tekrarTuru(g, karistir(B.sev[sev].baglanti, r).slice(0, 3), { gizli: false, bag: true }); },
    hiz: async function (g, sev, r) {
      var c = B.sev[sev].golge[Math.floor(r() * B.sev[sev].golge.length)], hizlar = [[.8, 'yavaş'], [1, 'normal'], [1.2, 'hızlı']], top = 0;
      for (var i = 0; i < 3; i++) {
        g.innerHTML = '<div class="cay-ust2"></div><p class="cay-kelime" lang="en"><b>' + esc(c) + '</b></p><p><button type="button" class="btn sm" data-d>▶ ' + hizlar[i][1] + '</button></p><div class="cay-al"></div><div class="cay-not"></div>'; ilerleme(g.firstChild, i, 3);
        g.querySelector('[data-d]').onclick = function () { dinle(c, this.h); }.bind({ h: hizlar[i][0] }); dinle(c, hizlar[i][0]);
        var s = await soyleAl(g.querySelector('.cay-al'), { sure: 15 }), d = dogruluk(s, c); top += d.oran;
        g.querySelector('.cay-not').innerHTML = '<div class="fark" lang="en">' + d.fark + '</div>';
        await new Promise(function (ok) { setTimeout(ok, 1400); });
      }
      return { puan: top / 3, ozet: '%' + Math.round(top / 3 * 100) + ' isabet, üç hızda' };
    },
    ifade: async function (g, sev, r) {
      var ls = karistir(B.sev[sev].ifade, r).slice(0, 3), top = 0;
      for (var i = 0; i < ls.length; i++) {
        var f = ls[i], cek = norm(f[0].replace(/…|\.\.\./g, ' ').replace(/\+.*$/, '')).trim().split(' ').filter(function (w) { return w && w.length > 1 && !/^(the|a|to|of|i|you|my|something|-ing)$/.test(w); });
        g.innerHTML = '<div class="cay-ust2"></div><div class="cay-ifade"><b lang="en">' + esc(f[0]) + '</b><span>' + esc(f[1]) + '</span><p lang="en"><i>' + esc(f[2]) + '</i> <button type="button" class="btn sm" data-d>▶</button></p></div><p class="say">Şimdi kendi cümleni kur ve sesli söyle.</p><div class="cay-al"></div><div class="cay-not"></div>'; ilerleme(g.firstChild, i, ls.length);
        g.querySelector('[data-d]').onclick = function () { dinle(this.t, .9); }.bind({ t: f[2] });
        var t = await soyleAl(g.querySelector('.cay-al'), { sure: 20, yer: 'ifadeyi kullanarak bir cümle…' });
        var tut = cek.filter(function (w) { return norm(t).indexOf(' ' + w + ' ') > -1; }).length / Math.max(1, cek.length), kopya = norm(t).trim() === norm(f[2]).trim();
        var p = kopya ? .3 : (tut >= .6 ? .7 : tut * .7) + (kelimeSay(t) >= 6 ? .3 : 0); top += Math.min(1, p);
        g.querySelector('.cay-not').innerHTML = '<p class="cay-metin" lang="en">' + S.renkle(t || '-', HOCA.gramer(t)) + '</p>' + (kopya ? 'Örneği tekrarladın; kendi cümleni kur.' : tut >= .6 ? '✓ ifadeyi kullandın' : '✗ ifade cümlede görünmüyor');
        await new Promise(function (ok) { setTimeout(ok, 1700); });
      }
      return { puan: top / ls.length, ozet: '3 ifade · %' + Math.round(top / ls.length * 100) };
    },
    kalip: async function (g, sev, r) {
      var ls = karistir(B.sev[sev].kalip, r).slice(0, 3), top = 0;
      for (var i = 0; i < ls.length; i++) {
        g.innerHTML = '<div class="cay-ust2"></div><p class="cay-kelime" lang="en"><b>' + esc(ls[i]) + '</b></p><p class="say">Cümle başını söyle ve kendi fikrinle tamamla.</p><div class="cay-al"></div><div class="cay-not"></div>'; ilerleme(g.firstChild, i, ls.length);
        var t = await soyleAl(g.querySelector('.cay-al'), { sure: 25 }), gr = HOCA.gramer(t), uzun = kelimeSay(t) >= kelimeSay(ls[i].replace(/…/g, ' ')) + 4, p = (uzun ? .7 : .3) + (gr.length ? 0 : .3); top += Math.min(1, p);
        g.querySelector('.cay-not').innerHTML = '<p class="cay-metin" lang="en">' + S.renkle(t || '-', gr) + '</p>' + (uzun ? '✓ yeterince tamamladın' : '✗ fikrini biraz daha aç') + (gr.length ? ' · düzeltme: <span lang="en">' + esc(gr[0].parca) + ' → ' + esc(gr[0].oneri) + '</span>' : '');
        await new Promise(function (ok) { setTimeout(ok, 1700); });
      }
      return { puan: top / ls.length, ozet: '%' + Math.round(top / ls.length * 100) + ' kalıp' };
    }
  };
  async function tekrarTuru(g, cumleler, o) {
    var top = 0;
    for (var i = 0; i < cumleler.length; i++) {
      var c = cumleler[i], kalanDinle = o.gizli ? 2 : 9;
      g.innerHTML = '<div class="cay-ust2"></div><p class="cay-kelime" lang="en">' + (o.gizli ? '<span class="say">🎧 cümle gizli</span>' : '<b>' + (o.bag ? esc(c).replace(/‿/g, '<span class="bag">‿</span>') : esc(c)) + '</b>') + '</p><p><button type="button" class="btn sm" data-d>▶ Dinle</button></p><div class="cay-al"></div><div class="cay-not"></div>'; ilerleme(g.firstChild, i, cumleler.length);
      var db = g.querySelector('[data-d]');
      db.onclick = function () { if (kalanDinle-- > 0) dinle(c, .9); if (kalanDinle <= 0 && o.gizli) { db.disabled = true; db.textContent = 'dinleme hakkı bitti'; } };
      db.click();
      var s = await soyleAl(g.querySelector('.cay-al'), { sure: 15 }), d = dogruluk(s, c); top += d.oran;
      g.querySelector('.cay-not').innerHTML = (o.gizli ? '<p class="say" lang="en">' + esc(c) + '</p>' : '') + '<div class="fark" lang="en">' + d.fark + '</div><span class="say">%' + Math.round(d.oran * 100) + ' doğru</span>';
      if (A.sesCal) A.sesCal(d.oran >= .85 ? 'dogru' : d.oran >= .5 ? 'kismen' : 'yanlis');
      await new Promise(function (ok) { setTimeout(ok, 1800); });
    }
    return { puan: top / cumleler.length, ozet: '%' + Math.round(top / cumleler.length * 100) + ' isabet' };
  }

  /* ---------- arayüz ---------- */
  var kok, v, an, plan, gun;
  function kur(el) {
    kok = el; var simdi = new Date(); an = gunAnahtar(simdi); v = veriAl(simdi); gun = v.gunler[an]; plan = gunPlani(an, gun.sev);
    ciz();
  }
  function yarinSev() { return SIRA[Math.max(0, Math.min(5, Math.floor(v.sev)))]; }
  function ustCiz() {
    var ust = kok.querySelector('.cay-gun'), en = gun.en || {}, biten = Object.keys(en).filter(function (k) { return en[k] >= GECER; }).length, denenen = Object.keys(en), ort = denenen.length ? denenen.reduce(function (s, k) { return s + en[k]; }, 0) / denenen.length : 0;
    var ic = Math.max(0, Math.min(1, v.sev - sevNo(gun.sev))), ys = yarinSev(), fark = sevNo(ys) - sevNo(gun.sev);
    var tarih = new Date(an + 'T12:00:00').toLocaleDateString('tr', { weekday: 'long', day: 'numeric', month: 'long' });
    ust.innerHTML = '<div class="cay-tarih"><span class="etiket">bugünün turları</span><b>' + esc(tarih) + '</b><small>Yarın bambaşka dört tur gelir.</small></div>' +
      '<div class="cay-seviye"><span class="etiket">otomatik seviye</span><div class="cay-sv"><b>' + gun.sev + '</b><span>' + ADI[gun.sev] + '</span></div><div class="cay-sv-bar" title="bir üst seviyeye ilerleme"><i style="--w:' + Math.round(ic * 100) + '%"></i></div><small>' +
      (biten === 4 ? (fark > 0 ? '↑ Yarın ' + ys + ' seviyesine çıkıyorsun.' : fark < 0 ? '↓ Yarın ' + ys + ' ile pekiştireceğiz.' : 'Yarın da ' + ys + '; ilerleme çubuğu dolunca çıkarsın.') : 'Turlardaki başarına göre yarın ayarlanır.') + '</small></div>' +
      '<div class="cay-bardak' + (biten === 4 ? ' bitti' : '') + '" style="--d:' + (biten / 4) + '" aria-label="' + biten + ' / 4 tur"><svg viewBox="0 0 60 70" aria-hidden="true"><path class="tabak" d="M6 64 h48"/><path class="cam" d="M14 10 h32 l-4 48 h-24 z"/><path class="cay" d="M15.2 ' + (58 - 46 * (1 - biten / 4)).toFixed(1) + ' L44.8 ' + (58 - 46 * (1 - biten / 4)).toFixed(1) + ' L42 58 H18 Z"/><path class="buhar" d="M24 6 q-3 -4 0 -6 M32 6 q-3 -4 0 -6"/></svg><b>' + biten + ' / 4</b>' + (biten ? '<small>ort. %' + Math.round(ort * 100) + '</small>' : '') + '</div>';
  }
  function ciz() {
    kok.innerHTML = '<div class="cay-gun kagit"></div><div class="cay-turlar"></div>';
    ustCiz();
    kok.querySelector('.cay-turlar').innerHTML = plan.map(function (p, i) {
      var t = TUR[p.tur], pn = (gun.en || {})[i];
      return '<article class="kagit alis cay-tur" data-id="cay-' + an + '-' + i + '" data-i="' + i + '"><span class="bant"></span>' +
        '<div class="alis-u"><div><span class="etiket">tur ' + (i + 1) + ' · ' + esc(p.aile.ad) + ' · ' + gun.sev + '</span><h3>' + esc(t[0]) + '</h3><p>' + esc(t[1]) + '</p></div><span class="tik" aria-label="tamamlandı">✓</span></div>' +
        '<div class="cay-govde">' + (pn != null ? sonucHtml(pn, gun['oz' + i]) : '<button type="button" class="btn ana" data-basla>Başla</button>') + '</div></article>';
    }).join('');
    kok.querySelectorAll('[data-basla]').forEach(function (b) { b.onclick = function () { calistir(+b.closest('[data-i]').dataset.i); }; });
    if (A.sayac) A.sayac();
  }
  function sonucHtml(p, oz) { return '<div class="cay-sonuc"><b>%' + Math.round(p * 100) + '</b><span>' + esc(oz || '') + '</span><button type="button" class="btn sm" data-yeniden>Bir daha dene</button></div>'; }
  async function calistir(i) {
    var art = kok.querySelector('[data-i="' + i + '"]'), g = art.querySelector('.cay-govde'), p = plan[i];
    var ilk = gun.puan[i] == null, r = tohum(p.tohum + (ilk ? '' : '|' + Date.now()));
    g.innerHTML = '<p class="say">hazırlanıyor…</p>';
    var s = null; try { s = await KOS[p.tur](g, gun.sev, r); } catch (e) { console.error(e); }
    if (!s) { g.innerHTML = '<button type="button" class="btn ana" data-basla>Başla</button>'; g.querySelector('[data-basla]').onclick = function () { calistir(i); }; return; }
    var puan = Math.max(0, Math.min(1, s.puan));
    gun.en = gun.en || {}; var onceki = gun.en[i];
    if (ilk) { gun.puan[i] = puan; seviyeGuncelle(v, puan); }
    if (onceki == null || puan >= onceki) { gun.en[i] = puan; gun['oz' + i] = s.ozet; }
    A.ls.yaz('cay', v);
    var once = s.kalsin ? g.innerHTML : '';
    g.innerHTML = once + sonucHtml(puan, s.ozet) + (puan < GECER ? '<p class="say">Turu tamamlamak için en az %' + GECER * 100 + ' gerekiyor; bir daha dene.</p>' : '') + (ilk ? '' : '<p class="say">Tekrar denemeler seviyeni değiştirmez.</p>');
    g.querySelector('[data-yeniden]').onclick = function () { calistir(i); };
    if (gun.en[i] >= GECER) A.bitir(P, 'cay-' + an + '-' + i);
    if (puan >= .75 && A.sevin) A.sevin(); else if (puan < .45 && A.uz) A.uz();
    ustCiz();
    if (Object.keys(gun.en).filter(function (k) { return gun.en[k] >= GECER; }).length === 4 && puan >= GECER && A.soyle) A.soyle('Dört tur tamam, çay hâlâ sıcak! Yarın yeni turlar ' + yarinSev() + ' seviyesinde.', 5000);
  }
  W.CAY = { kur: kur, gunPlani: gunPlani, tohum: tohum, veriAl: veriAl, seviyeGuncelle: seviyeGuncelle, AILE: AILE, KOS: KOS, gunAnahtar: gunAnahtar };
})();
