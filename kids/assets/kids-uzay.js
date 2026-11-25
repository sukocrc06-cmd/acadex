/* ==========================================================================
   ACADEX KIDS · UZAY TEMASI (kids/assets/kids-uzay.js + kids-uzay.css), 19.11.2026
   Giriş akışı ve harita uzayda geçer (konu ekranlarının kendi tema sahneleri olduğu için oraya girmez):
     - arka plan: kat kat yıldızlar (kaydırınca farklı hızda kayar), ara ara kayan yıldız ve
       kuyruğu sarı-turuncu yanan, korkutmayan ateş topları
     - adalar gezegen: konunun renginde, kraterli, bazılarında halka; konunun resmi gezegenin
       üstünde durur. Çocuk ilerledikçe bayrak (1), dönen ay (2), altın halka (3) eklenir;
       kilitli gezegen sisli ve soluk
     - çocuk kendi hayvanıyla kasklı astronot: haritada son gittiği gezegenin yanında süzülür,
       gezegene dokununca jetpack'le oraya uçar, sonra konu açılır
   Hareketi azalt açıksa: yıldızlar durağan, kayan yıldız / ateş topu yok, astronot zıplamadan geçer.
   Telefonu yormasın diye: tuval en çok 2× piksel, sekme gizliyken durur, ~150 yıldız.
   W.KIDS_UZAY = { aktif, gezegen, uc, yerlestir }
   20.11.2026: nebula, sık kayan yıldız, kuyruklu yıldız, UFO; ateş topu ve UFO'ya dokunma;
   haritada dokunulabilir astronot arkadaşlar (dostlarKur); 3B'de gezegene dalış (kids-uzay3d)
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ;
  var SAKIN = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var M = '#23304D';
  /* hangi görünümde uzay: giriş + harita tam; konu/kitap sakin yıldızlar */
  var TAM = { giris: 1, harita: 1 }, SAKINGOR = {};   /* konu/kitap ekranlarının kendi tema sahnesi var; uzay oraya girmez */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var lsAl = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  var lsKoy = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

  /* ======================= gezegen ======================= */
  var uid = 0;
  /* renk açma/koyulaştırma (#rrggbb) */
  function karis(hex, hedef, o) {
    var a = String(hex || '#8E7CF0').replace('#', ''); if (a.length === 3) a = a.replace(/./g, '$&$&');
    var b = hedef.replace('#', ''), r = [0, 2, 4].map(function (i) { return Math.round(parseInt(a.substr(i, 2), 16) * (1 - o) + parseInt(b.substr(i, 2), 16) * o); });
    return '#' + r.map(function (v) { return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2); }).join('');
  }
  function simgeIc(ad) { return C ? C.simge(ad).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') : ''; }
  /* i: konunun sırası (halka/krater çeşitliliği), a: aşama (0-3) */
  function gezegen(renk, ic, kilitli, a, i) {
    var n = ++uid, g = 'kzg' + n, gl = 'kzl' + n, cx = 100, cy = 108, r = 56, halka = (i % 3) === 1, c = kilitli ? '#56628A' : renk;
    var ac = karis(c, '#ffffff', 0.45), ko = karis(c, '#0B1033', 0.45);
    var def = '<defs><radialGradient id="' + g + '" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="' + ac + '"/><stop offset=".55" stop-color="' + c + '"/><stop offset="1" stop-color="' + ko + '"/></radialGradient>' +
      '<radialGradient id="' + gl + '" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="' + c + '" stop-opacity=".55"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient></defs>';
    var hArka = halka ? '<path d="M' + (cx - 92) + ' ' + cy + ' a92 22 0 0 1 184 0" fill="none" stroke="' + (kilitli ? '#8A94B8' : '#FFE08A') + '" stroke-width="9" stroke-linecap="round" opacity=".9"/>' : '';
    var hOn = halka ? '<path d="M' + (cx - 92) + ' ' + cy + ' a92 22 0 0 0 184 0" fill="none" stroke="' + M + '" stroke-width="13" stroke-linecap="round"/><path d="M' + (cx - 92) + ' ' + cy + ' a92 22 0 0 0 184 0" fill="none" stroke="' + (kilitli ? '#8A94B8' : '#FFE08A') + '" stroke-width="8" stroke-linecap="round"/>' : '';
    var kr = [[-24, 14, 11], [20, 26, 7], [26, -8, 9], [-6, 34, 5]].map(function (k, j) {
      var x = cx + k[0] + ((i * 7 + j * 5) % 9) - 4, y = cy + k[1];
      return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + k[2] + '" ry="' + (k[2] * 0.72).toFixed(1) + '" fill="' + ko + '" opacity=".35"/><path d="M' + (x - k[2] * 0.7) + ' ' + (y - 1) + ' q' + (k[2] * 0.7) + ' ' + (-k[2] * 0.6) + ' ' + (k[2] * 1.4) + ' 0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".35"/>';
    }).join('');
    var ek = '';
    if (!kilitli && a >= 1) ek += '<g class="kz-bayrak"><path d="M150 70 v-30" stroke="' + M + '" stroke-width="3" stroke-linecap="round"/><path d="M151 40 q12 -4 22 3 q-10 7 -22 3 z" fill="#FF6B5B" stroke="' + M + '" stroke-width="2.4" stroke-linejoin="round"/></g>';
    if (!kilitli && a >= 2) ek += '<g class="kz-ay-y"><g class="kz-ay"><circle cx="' + (cx + 78) + '" cy="' + (cy - 4) + '" r="11" fill="#E9ECF6" stroke="' + M + '" stroke-width="2.6"/><circle cx="' + (cx + 75) + '" cy="' + (cy - 7) + '" r="3" fill="#C3C9DD"/></g></g>';
    if (!kilitli && a >= 3) ek += '<g class="kz-altin"><ellipse cx="' + cx + '" cy="' + cy + '" rx="74" ry="74" fill="none" stroke="#FFD23F" stroke-width="3" stroke-dasharray="4 9" opacity=".9"/>' +
      [[44, 52], [160, 150], [36, 150]].map(function (p) { return '<path d="M' + p[0] + ' ' + (p[1] - 8) + ' l2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4 -5.6 -5.6 -2.4 5.6 -2.4 z" fill="#FFD23F"/>'; }).join('') + '</g>';
    return '<svg class="kc kc-ada kz-gz' + (kilitli ? ' kz-kilit' : '') + '" viewBox="0 0 200 170" aria-hidden="true" focusable="false" overflow="visible">' + def +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 16) + '" fill="url(#' + gl + ')"/>' + hArka +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#' + g + ')" stroke="' + M + '" stroke-width="3.2"/>' + kr +
      '<path d="M' + (cx - 36) + ' ' + (cy - 30) + ' q16 -18 38 -18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/>' +
      (kilitli ? '<ellipse cx="' + cx + '" cy="' + (cy + 6) + '" rx="' + (r + 10) + '" ry="20" fill="#C9D3EE" opacity=".35"/><ellipse cx="' + (cx - 14) + '" cy="' + (cy - 18) + '" rx="40" ry="12" fill="#C9D3EE" opacity=".25"/>' : '') +
      hOn + ek +
      '<g class="kc-ada-ana" transform="translate(62 -6) scale(.76)"' + (kilitli ? ' opacity=".45"' : '') + '>' + simgeIc(ic) + '</g></svg>';
  }

  /* ======================= astronot ======================= */
  function astronotSvg() {
    return '<svg class="kz-ast-g" viewBox="0 0 100 140" aria-hidden="true" focusable="false">' +
      '<g class="kz-alev"><path d="M24 104 q6 26 9 30 q3 -4 9 -30 z" fill="#FFB020"/><path d="M28 104 q4 16 5 20 q1 -4 5 -20 z" fill="#FFF3B0"/><path d="M58 104 q6 26 9 30 q3 -4 9 -30 z" fill="#FFB020"/><path d="M62 104 q4 16 5 20 q1 -4 5 -20 z" fill="#FFF3B0"/></g>' +
      '<rect x="20" y="62" width="60" height="44" rx="10" fill="#8E9BBF" stroke="' + M + '" stroke-width="3"/>' +
      '<path d="M30 70 q-16 10 -12 30" fill="none" stroke="' + M + '" stroke-width="13" stroke-linecap="round"/><path d="M30 70 q-16 10 -12 30" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>' +
      '<g class="kz-kol"><path d="M70 70 q16 8 16 -4" fill="none" stroke="' + M + '" stroke-width="13" stroke-linecap="round"/><path d="M70 70 q16 8 16 -4" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/></g>' +
      '<path d="M38 104 v20 M62 104 v20" stroke="' + M + '" stroke-width="15" stroke-linecap="round"/><path d="M38 104 v20 M62 104 v20" stroke="#fff" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="M31 126 h14 M55 126 h14" stroke="#FF6B5B" stroke-width="7" stroke-linecap="round"/>' +
      '<rect x="27" y="60" width="46" height="50" rx="16" fill="#fff" stroke="' + M + '" stroke-width="3"/>' +
      '<rect x="38" y="76" width="24" height="14" rx="4" fill="#E9ECF6" stroke="' + M + '" stroke-width="2.2"/><circle cx="44" cy="83" r="2.6" fill="#FF6B5B"/><circle cx="50" cy="83" r="2.6" fill="#FFD23F"/><circle cx="56" cy="83" r="2.6" fill="#4CC38A"/>' +
      '<circle cx="50" cy="36" r="31" fill="#fff" stroke="' + M + '" stroke-width="3"/>' +
      '<circle cx="50" cy="36" r="25" fill="#BFE3FF" stroke="' + M + '" stroke-width="2.4"/>' +
      '<path d="M50 5 v-4" stroke="' + M + '" stroke-width="2.4"/><circle cx="50" cy="0" r="3.4" fill="#FF6B5B" stroke="' + M + '" stroke-width="2"/></svg>';
  }
  /* yüz kaskın camında (kendi hayvanı + rengi), cam parlaması üstte */
  function astronotHtml(hayvan, renk) {
    return '<span class="kz-ast" aria-hidden="true"><span class="kz-ast-ic">' + astronotSvg() + '<span class="kz-ast-yuz">' + (C ? C.avatar(hayvan, renk) : '') + '</span><i class="kz-ast-cam"></i></span></span>';
  }
  var AST = null;   /* { el, harita, anahtar, kid } */
  function adaBul(kok, kid) { return kok.querySelector('.ka-ada[data-konu="' + kid + '"]'); }
  function konum(harita, ada) {
    var h = harita.getBoundingClientRect(), r = (ada.querySelector('.kc-ada') || ada).getBoundingClientRect();
    return { x: r.left - h.left + r.width * 0.12, y: r.top - h.top + r.height * 0.18 };
  }
  /* ======================= 3B galaksi (kids-uzay3d.mjs, three.js) =======================
     Harita açılınca modül yüklenir. WebGL yoksa, cihaz çok zayıfsa ya da modül 7 sn'de gelmezse
     düz (2B) gezegen haritası kalır. kids.uzay3d = 0 (localStorage) 3B'yi kapatır. */
  var U3 = null, MOD = null;
  /* 22.11.2026: zayıf cihaz → 3B haritada hafif mod (kids-uzay3d: az parçacık, 1x çözünürlük). Kare hızı düşen
     cihazı harita kendisi işaretler (kids.hafif), sonraki açılışlar hafif başlar. */
  function hafifMi() {
    var n = W.navigator || {};
    return lsAl('kids.hafif', 0) === 1 || !!(n.hardwareConcurrency && n.hardwareConcurrency <= 4) || !!(n.deviceMemory && n.deviceMemory <= 4);
  }
  function uc3Uygun() {
    if (lsAl('kids.uzay3d', 1) === 0) return false;
    var n = W.navigator || {};
    if ((n.deviceMemory && n.deviceMemory < 2) || (n.hardwareConcurrency && n.hardwareConcurrency < 2)) return false;
    try { var c = D.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) return false; } catch (e) { return false; }
    return true;
  }
  function modulAl() {
    /* eski tarayıcıda sözdizimi hatası olmasın diye import() bir fonksiyonun içinde */
    if (!MOD) { try { MOD = new Function('u', 'return import(u)')('/kids/assets/kids-uzay3d.mjs'); } catch (e) { MOD = Promise.reject(e); } }
    return MOD;
  }
  function uc3Kur(kok, harita, o, yedek) {
    var lis = [].slice.call(harita.querySelectorAll('.ka-adalar > li'));
    if (!o.konular || lis.length !== o.konular.length) return false;
    var kap = D.createElement('div'); kap.className = 'kz3'; harita.insertBefore(kap, harita.firstChild);
    harita.classList.add('kz3-bekle');
    var bitti = false, vazgec = function () { if (bitti) return; bitti = true; kap.remove(); harita.classList.remove('kz3-bekle', 'kz3-acik'); lis.forEach(function (l) { l.style.transform = ''; l.style.visibility = ''; }); yedek(); };
    var sure = setTimeout(vazgec, 7000);
    modulAl().then(function (m) {
      if (bitti || !kap.isConnected) return;
      clearTimeout(sure); bitti = true;
      var yer = lsAl('kids.uzay.yer', {});
      U3 = m.kur({
        kap: kap, sakin: SAKIN, hafif: hafifMi(), yuz: C ? C.avatar(o.hayvan, o.renk) : '',
        baslangic: yer[o.anahtar] || o.bugun || (o.konular.filter(function (k) { return !k.kilit; })[0] || {}).id,
        konular: o.konular.map(function (k, i) { return { id: k.id, renk: k.renk, kilit: k.kilit, yeniAcik: !!k.yeniAcik, asama: k.asama, bugun: k.id === o.bugun, simge: C ? C.simge(k.simge) : '', el: lis[i] }; })
      });
      U3.anahtar = o.anahtar; U3.harita = harita;
      harita.classList.remove('kz3-bekle'); harita.classList.add('kz3-acik');
    }, function (e) { clearTimeout(sure); if (W.console) console.warn('3B harita açılamadı, düz harita:', e); vazgec(); });
    return true;
  }
  /* haritaya astronotu koy: son gidilen gezegen, yoksa bugünün, yoksa ilk açık gezegen */
  function yerlestir(kok, o) {
    /* konudan haritaya dönüşte uzay sınıfını hemen aç: MutationObserver bir an sonra çalışır ve
       o ana kadar 3B kurulmaz, düz harita kalırdı (20.11.2026 hatası) */
    var app = kok.id === 'kids-app' ? kok : D.getElementById('kids-app'); if (app) guncelle(app);
    var harita = kok.querySelector('.ka-harita'); if (!harita || !aktif()) return;
    U3 = null;
    dostlarKur(harita, o);
    if (o.konular && uc3Uygun() && uc3Kur(kok, harita, o, function () { yerlestir2(kok, o); })) return;
    yerlestir2(kok, o);
  }
  function yerlestir2(kok, o) {
    var harita = kok.querySelector('.ka-harita'); if (!harita) return;
    var yer = lsAl('kids.uzay.yer', {}), kid = yer[o.anahtar];
    var ada = (kid && adaBul(kok, kid)) || (o.bugun && adaBul(kok, o.bugun)) || kok.querySelector('.ka-ada[data-konu]');
    if (!ada) return;
    var el = D.createElement('div'); el.className = 'kz-ast-yer'; el.innerHTML = astronotHtml(o.hayvan, o.renk);
    harita.appendChild(el);
    AST = { el: el, harita: harita, anahtar: o.anahtar, kid: ada.getAttribute('data-konu') };
    var koy = function () { if (!el.isConnected) return; var p = konum(harita, adaBul(kok, AST.kid) || ada); el.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)'; };
    koy(); W.requestAnimationFrame(koy);
    if (W.ResizeObserver) new ResizeObserver(function () { if (!el.classList.contains('kz-ucuyor')) koy(); }).observe(harita);
  }
  /* gezegene uç: jetpack yanar, kavisle süzülür; bitince sonra() */
  /* ucarken: gerçekten bir yolculuk başlıyorsa (başka gezegene) bir kez çağrılır — sesli rehber için */
  function uc(kid, sonra, ucarken) {
    if (U3 && U3.harita && U3.harita.isConnected) {
      var y3 = lsAl('kids.uzay.yer', {}); y3[U3.anahtar] = kid; lsKoy('kids.uzay.yer', y3);
      return U3.uc(kid, sonra, ucarken);
    }
    var el = AST && AST.el;
    if (!el || !el.isConnected) return sonra();
    var kok = AST.harita.parentNode, ada = adaBul(kok, kid);
    if (!ada) return sonra();
    lsKoy('kids.uzay.yer', (function () { var y = lsAl('kids.uzay.yer', {}); y[AST.anahtar] = kid; return y; })());
    if (AST.kid !== kid && ucarken) ucarken();
    if (AST.kid === kid || SAKIN || !el.animate) {
      AST.kid = kid; var p0 = konum(AST.harita, ada); el.style.transform = 'translate(' + p0.x.toFixed(1) + 'px,' + p0.y.toFixed(1) + 'px)';
      return sonra();
    }
    var r = ada.getBoundingClientRect();
    if (r.bottom < 60 || r.top > W.innerHeight - 60) { try { ada.scrollIntoView({ block: 'center' }); } catch (e) { } }
    var m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform || '') || [0, 0, 0], a = { x: +m[1], y: +m[2] }, b = konum(AST.harita, ada);
    var yon = b.x < a.x ? -1 : 1, orta = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 90 - Math.abs(b.x - a.x) * 0.12 };
    el.classList.add('kz-ucuyor'); el.style.setProperty('--yon', yon);
    var t = function (p, d) { return 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) rotate(' + d + 'deg)'; };
    var bitti = false, bit = function () {
      if (bitti) return; bitti = true;
      el.style.transform = 'translate(' + b.x.toFixed(1) + 'px,' + b.y.toFixed(1) + 'px)'; el.classList.remove('kz-ucuyor'); AST.kid = kid; sonra();
    };
    var an = el.animate([{ transform: t(a, 0) }, { transform: t(orta, 14 * yon), offset: 0.5 }, { transform: t(b, 0) }], { duration: 820, easing: 'cubic-bezier(.45,0,.25,1)' });
    an.onfinish = bit; an.oncancel = bit; setTimeout(bit, 1400);
  }

  /* ======================= astronot arkadaşlar =======================
     Haritada 3 astronot (çocuğun kendi hayvanı dışındaki hayvanlar) yavaşça süzülür, kenara gelince
     döner. Dokununca sırayla el sallar, takla atar, zıplar ve balonla selam verir. Gerçek düğme:
     klavye ve ekran okuyucu da kullanabilir. Hareketi azalt: yerinde durur, yalnız balon çıkar. */
  var SELAM = ['Merhaba!', 'Hello!', 'Selam!', 'Hi!', 'Yaşasın!', 'Hadi uçalım!'], HAREKET = ['kz-selam', 'kz-takla', 'kz-zipla'];
  function dostlarKur(harita, o) {
    if (!C || !C.HAYVAN) return;
    var eski = harita.querySelector('.kz-dostlar'); if (eski) eski.remove();
    var kat = D.createElement('div'); kat.className = 'kz-dostlar';
    var adalar = harita.querySelector('.ka-adalar'); harita.insertBefore(kat, adalar || null);
    var hv = C.HAYVAN.filter(function (h) { return h !== o.hayvan; }), renk = C.YUZ_RENK || [];
    var L = [0, 1, 2].map(function (i) {
      var h = hv[(i * 3 + (Date.now() >> 16)) % hv.length], rk = renk.length ? (renk[(i * 2 + 1) % renk.length][1] || renk[(i * 2 + 1) % renk.length]) : '';
      var b = D.createElement('button'); b.type = 'button'; b.className = 'kz-dost';
      b.setAttribute('aria-label', 'Astronot arkadaş ' + ((C.HAYVAN_AD && C.HAYVAN_AD[h]) || '') + ': dokun, selam versin');
      b.innerHTML = '<span class="kz-dost-ic">' + astronotHtml(h, typeof rk === 'string' ? rk : '') + '</span><span class="kz-dost-balon" aria-hidden="true"></span>';
      kat.appendChild(b);
      var d = { el: b, x: 0.12 + i * 0.36 + Math.random() * 0.1, y: 0.15 + ((i * 0.31) % 0.7) + Math.random() * 0.1, vx: (Math.random() < 0.5 ? -1 : 1) * (0.012 + Math.random() * 0.01), vy: (Math.random() - 0.5) * 0.016, a: Math.random() * 360, va: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8), n: i };
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var c = HAREKET[d.n % HAREKET.length]; d.n++;
        HAREKET.forEach(function (x) { b.classList.remove(x); }); void b.offsetWidth; b.classList.add(c);
        var bl = b.lastChild; bl.textContent = SELAM[(d.n + i) % SELAM.length]; bl.classList.add('ac');
        clearTimeout(d.t); d.t = setTimeout(function () { bl.classList.remove('ac'); b.classList.remove(c); }, 1600);
        if (W.KIDS_SES) W.KIDS_SES.fx(c === 'kz-selam' ? 'dogru' : c === 'kz-takla' ? 'yildiz' : 'pat');
        d.vx *= -1;
      });
      return d;
    });
    var son = 0;
    function adim(now) {
      if (!kat.isConnected) return;
      var dt = son ? Math.min(0.05, (now - son) / 1000) : 0; son = now;
      var w = kat.clientWidth, h = kat.clientHeight;
      L.forEach(function (d) {
        if (!SAKIN) {
          d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt;
          if (d.x < 0.03 || d.x > 0.92) { d.vx *= -1; d.x = Math.max(0.03, Math.min(0.92, d.x)); }
          if (d.y < 0.08 || d.y > 0.8) { d.vy *= -1; d.y = Math.max(0.08, Math.min(0.8, d.y)); }
        }
        var ac = d.el.classList.contains('kz-selam') || d.el.classList.contains('kz-zipla') ? 0 : SAKIN ? -8 : Math.sin(d.a * Math.PI / 180) * 18;
        d.el.style.transform = 'translate(' + (d.x * w).toFixed(1) + 'px,' + (d.y * h).toFixed(1) + 'px) rotate(' + ac.toFixed(1) + 'deg)';
      });
      if (SAKIN) return;
      if (!D.hidden) W.requestAnimationFrame(adim); else D.addEventListener('visibilitychange', function f() { D.removeEventListener('visibilitychange', f); W.requestAnimationFrame(adim); });
    }
    W.requestAnimationFrame(adim);
  }

  /* ======================= arka plan: yıldızlar, nebula, kayan yıldız, kuyruklu yıldız, ateş topu, UFO =======================
     Ateş topuna dokun: hızlanır, parlak iz bırakır, yıldız patlamasıyla söner.
     UFO'ya dokun: ışık saçar, sonra yukarı kaçar. (Dokunma yalnız haritada; düğmelerin üstünde değil.) */
  var tuval = null, cx2 = null, Y = [], KAY = [], ATES = [], KUY = [], UFO = [], PAR = [], NEB = null, dpr = 1, gw = 0, gh = 0, raf = 0, mod = '', sonT = 0, sonrakiKayan = 0, sonrakiAtes = 0, sonrakiKuy = 0, sonrakiUfo = 0;
  function kur() {
    if (tuval) return;
    tuval = D.createElement('canvas'); tuval.className = 'kz-tuval'; tuval.setAttribute('aria-hidden', 'true');
    D.body.insertBefore(tuval, D.body.firstChild);
    cx2 = tuval.getContext('2d');
    boyut(); W.addEventListener('resize', boyut, { passive: true });
    W.addEventListener('pointerdown', dokunus, true);
    D.addEventListener('visibilitychange', function () { if (D.hidden) dur(); else basla(); });
  }
  function boyut() {
    dpr = Math.min(2, W.devicePixelRatio || 1); gw = W.innerWidth; gh = W.innerHeight;
    tuval.width = Math.round(gw * dpr); tuval.height = Math.round(gh * dpr); cx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(Math.min(170, Math.max(70, gw * gh / 7000))); Y = [];
    var R = ['#FFFFFF', '#FFFFFF', '#FFF3B0', '#BFE3FF', '#FFC9DE'];
    for (var i = 0; i < n; i++) {
      var k = i % 3;   /* 0 uzak, 1 orta, 2 yakın */
      Y.push({ x: Math.random() * gw, y: Math.random() * gh, r: [0.7, 1.1, 1.7][k] * (0.8 + Math.random() * 0.5), k: [0.04, 0.12, 0.25][k], v: [3, 7, 13][k], f: Math.random() * 6.28, c: R[i % 5] });
    }
    NEB = nebula();
    if (SAKIN || mod) ciz(performance.now(), true);
  }
  /* nebula: birkaç büyük, yumuşak renk bulutu; bir kez küçük tuvale çizilir, her karede büyütülerek basılır */
  function nebula() {
    try {
      var c = D.createElement('canvas'), w = Math.max(64, Math.round(gw / 4)), h = Math.max(64, Math.round(gh / 4)), x = c.getContext('2d');
      c.width = w; c.height = h; x.globalCompositeOperation = 'lighter';
      [[0.18, 0.3, 0.42, '142,124,240', 0.30], [0.82, 0.22, 0.36, '255,111,165', 0.20], [0.62, 0.78, 0.46, '74,168,255', 0.22], [0.3, 0.85, 0.3, '76,195,138', 0.10], [0.92, 0.6, 0.28, '255,210,63', 0.08]].forEach(function (b) {
        var g = x.createRadialGradient(b[0] * w, b[1] * h, 0, b[0] * w, b[1] * h, b[2] * Math.max(w, h));
        g.addColorStop(0, 'rgba(' + b[3] + ',' + b[4] + ')'); g.addColorStop(0.55, 'rgba(' + b[3] + ',' + (b[4] * 0.4) + ')'); g.addColorStop(1, 'rgba(' + b[3] + ',0)');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
      });
      return c;
    } catch (e) { return null; }
  }
  function kuyrukluEkle() {
    var sol = Math.random() < 0.5;
    KUY.push({ x: sol ? -80 : gw + 80, y: gh * (0.08 + Math.random() * 0.3), vx: (sol ? 1 : -1) * (70 + Math.random() * 40), vy: 12 + Math.random() * 18, t: 0, iz: [] });
  }
  function ufoEkle() {
    var sol = Math.random() < 0.5;
    UFO.push({ x: sol ? -60 : gw + 60, y0: gh * (0.18 + Math.random() * 0.3), y: 0, vx: (sol ? 1 : -1) * (90 + Math.random() * 40), t: 0, isin: 0, kac: false });
  }
  function patlat(x, y, n, renkler) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, v = 80 + Math.random() * 260;
      PAR.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, s: 0.6 + Math.random() * 0.5, r: 2 + Math.random() * 3.5, c: renkler[i % renkler.length], yildiz: i % 3 === 0 });
    }
  }
  function yildizCiz(x, y, r) {
    cx2.beginPath();
    for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; cx2.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    cx2.closePath(); cx2.fill();
  }
  /* dokunuş: ateş topu / UFO (yalnız haritada, düğmeye değilse; 3B tuvalin sürüklemesinden önce yakalanır) */
  function dokunus(e) {
    if (mod !== 'harita' || SAKIN) return;
    var t = e.target;
    if (!t || !t.closest || t.closest('button,a,input,select,textarea,label,[role="button"],.ka-dock,.ka-serit')) return;
    if (!(t.closest('.ka-harita') || t === D.body || t === D.documentElement || t.id === 'kids-app' || t.hasAttribute('data-gorunum'))) return;
    var x = e.clientX, y = e.clientY, i;
    for (i = 0; i < ATES.length; i++) {
      var f = ATES[i];
      if (!f.hiz && Math.hypot(f.x - x, f.y - y) < f.r * 3 + 18) {
        f.hiz = true; f.vx *= 3.4; f.vy *= 2.2; f.r *= 1.3; f.bit = f.t + 0.55;
        if (W.KIDS_SES) W.KIDS_SES.fx('cevir');
        e.stopPropagation(); e.preventDefault(); return;
      }
    }
    for (i = 0; i < UFO.length; i++) {
      var u = UFO[i];
      if (!u.kac && Math.abs(u.x - x) < 44 && Math.abs(u.y - y) < 30) {
        u.isin = 0.9; u.kac = true;
        patlat(u.x, u.y + 30, 14, ['#BFF7E8', '#FFD23F', '#ffffff']);
        if (W.KIDS_SES) W.KIDS_SES.fx('yildiz');
        e.stopPropagation(); e.preventDefault(); return;
      }
    }
  }
  function kayanEkle() {
    var sag = Math.random() < 0.5, x = sag ? gw * (0.4 + Math.random() * 0.6) : gw * Math.random() * 0.6, y = Math.random() * gh * 0.45;
    KAY.push({ x: x, y: y, vx: (sag ? -1 : 1) * (520 + Math.random() * 260), vy: 260 + Math.random() * 140, t: 0, s: 0.9 });
  }
  function atesEkle() {
    var sol = Math.random() < 0.5, y = gh * (0.05 + Math.random() * 0.4);
    ATES.push({ x: sol ? -60 : gw + 60, y: y, vx: (sol ? 1 : -1) * (150 + Math.random() * 70), vy: 50 + Math.random() * 50, r: 7 + Math.random() * 5, t: 0, iz: [] });
  }
  function ciz(now, tek) {
    var dt = Math.min(0.05, (now - (sonT || now)) / 1000); sonT = now;
    cx2.clearRect(0, 0, gw, gh);
    var sy = W.scrollY || 0, tam = TAM[mod], tsec = now / 1000;
    if (NEB && tam) {
      cx2.globalAlpha = SAKIN ? 0.8 : 0.72 + Math.sin(tsec * 0.25) * 0.12;
      var ox = SAKIN ? 0 : Math.sin(tsec * 0.03) * gw * 0.03, oy = -sy * 0.02;
      cx2.drawImage(NEB, ox - gw * 0.05, oy - gh * 0.05, gw * 1.1, gh * 1.1);
      cx2.globalAlpha = 1;
    }
    for (var i = 0; i < Y.length; i++) {
      var s = Y[i];
      if (!SAKIN && !tek) { s.y += s.v * dt; if (s.y > gh + 4) { s.y = -4; s.x = Math.random() * gw; } }
      var y = ((s.y - sy * s.k) % (gh + 8) + gh + 8) % (gh + 8) - 4;
      var p = SAKIN ? 0.85 : 0.55 + 0.45 * Math.sin(tsec * (1.2 + s.k * 4) + s.f);
      cx2.globalAlpha = p; cx2.fillStyle = s.c; cx2.beginPath(); cx2.arc(s.x, y, s.r, 0, 6.283); cx2.fill();
      if (s.r > 1.9 && p > 0.85) { cx2.globalAlpha = (p - 0.85) * 3; cx2.fillRect(s.x - s.r * 3, y - 0.5, s.r * 6, 1); cx2.fillRect(s.x - 0.5, y - s.r * 3, 1, s.r * 6); }
    }
    cx2.globalAlpha = 1;
    if (SAKIN || tek) return;
    /* kayan yıldızlar */
    if (tam && now > sonrakiKayan) { kayanEkle(); if (Math.random() < 0.25) kayanEkle(); sonrakiKayan = now + 1200 + Math.random() * 2400; }
    for (var j = KAY.length - 1; j >= 0; j--) {
      var k = KAY[j]; k.t += dt; k.x += k.vx * dt; k.y += k.vy * dt;
      var a = Math.max(0, 1 - k.t / k.s), uz = 0.16, g = cx2.createLinearGradient(k.x, k.y, k.x - k.vx * uz, k.y - k.vy * uz);
      g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
      cx2.strokeStyle = g; cx2.lineWidth = 2.2; cx2.lineCap = 'round'; cx2.beginPath(); cx2.moveTo(k.x, k.y); cx2.lineTo(k.x - k.vx * uz, k.y - k.vy * uz); cx2.stroke();
      if (k.t > k.s) KAY.splice(j, 1);
    }
    /* ateş topları: parlak baş, sarı-turuncu kıvılcımlı kuyruk */
    if (tam && now > sonrakiAtes) { atesEkle(); sonrakiAtes = now + 4500 + Math.random() * 4500; }
    for (var q = ATES.length - 1; q >= 0; q--) {
      var f = ATES[q]; f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt;
      f.iz.push({ x: f.x + (Math.random() - 0.5) * f.r, y: f.y + (Math.random() - 0.5) * f.r, o: 1, r: f.r * (0.5 + Math.random() * 0.5) });
      if (f.iz.length > 34) f.iz.shift();
      cx2.globalCompositeOperation = 'lighter';
      for (var z = 0; z < f.iz.length; z++) {
        var p2 = f.iz[z], o2 = z / f.iz.length; p2.r *= 0.985;
        cx2.globalAlpha = o2 * 0.55; cx2.fillStyle = o2 > 0.7 ? '#FFD23F' : o2 > 0.4 ? '#FF9F3A' : '#FF6B5B';
        cx2.beginPath(); cx2.arc(p2.x, p2.y, p2.r * (0.4 + o2 * 0.6), 0, 6.283); cx2.fill();
      }
      var hg = cx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 2.6);
      hg.addColorStop(0, 'rgba(255,255,230,1)'); hg.addColorStop(0.35, 'rgba(255,210,63,.95)'); hg.addColorStop(1, 'rgba(255,120,60,0)');
      cx2.globalAlpha = 1; cx2.fillStyle = hg; cx2.beginPath(); cx2.arc(f.x, f.y, f.r * 2.6, 0, 6.283); cx2.fill();
      cx2.globalCompositeOperation = 'source-over';
      if (f.hiz && f.t > f.bit) { patlat(f.x, f.y, 26, ['#FFD23F', '#FF9F3A', '#FFF3B0', '#FF6B5B', '#ffffff']); if (W.KIDS_SES) W.KIDS_SES.fx('pat'); ATES.splice(q, 1); continue; }
      if (f.x < -120 || f.x > gw + 120 || f.y > gh + 120) ATES.splice(q, 1);
    }
    cx2.globalAlpha = 1;
    /* kuyruklu yıldız: yavaş, uzun mavi-beyaz kuyruk */
    if (tam && now > sonrakiKuy) { if (sonrakiKuy) kuyrukluEkle(); sonrakiKuy = now + 16000 + Math.random() * 14000; }
    cx2.globalCompositeOperation = 'lighter';
    for (var c = KUY.length - 1; c >= 0; c--) {
      var m = KUY[c]; m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt;
      m.iz.push({ x: m.x, y: m.y }); if (m.iz.length > 70) m.iz.shift();
      for (var zz = 0; zz < m.iz.length; zz++) { var o3 = zz / m.iz.length; cx2.globalAlpha = o3 * o3 * 0.5; cx2.fillStyle = o3 > 0.8 ? '#ffffff' : '#9FD4FF'; cx2.beginPath(); cx2.arc(m.iz[zz].x, m.iz[zz].y, 1 + o3 * 4, 0, 6.283); cx2.fill(); }
      var kg = cx2.createRadialGradient(m.x, m.y, 0, m.x, m.y, 16); kg.addColorStop(0, 'rgba(255,255,255,1)'); kg.addColorStop(0.4, 'rgba(159,212,255,.8)'); kg.addColorStop(1, 'rgba(159,212,255,0)');
      cx2.globalAlpha = 1; cx2.fillStyle = kg; cx2.beginPath(); cx2.arc(m.x, m.y, 16, 0, 6.283); cx2.fill();
      if (m.x < -200 || m.x > gw + 200) KUY.splice(c, 1);
    }
    cx2.globalCompositeOperation = 'source-over'; cx2.globalAlpha = 1;
    /* UFO: sallanarak geçer; dokununca ışık saçar ve yukarı kaçar */
    if (tam && now > sonrakiUfo) { if (sonrakiUfo) ufoEkle(); sonrakiUfo = now + 14000 + Math.random() * 12000; }
    for (var w2 = UFO.length - 1; w2 >= 0; w2--) {
      var u = UFO[w2]; u.t += dt;
      if (u.kac) { u.vx *= 1 + dt * 2.5; u.y0 -= (120 + u.t * 40) * dt * (u.isin > 0 ? 0.2 : 4); }
      u.x += u.vx * dt; u.y = u.y0 + Math.sin(u.t * 2.2) * 10;
      if (u.isin > 0) {
        u.isin -= dt;
        var bg = cx2.createLinearGradient(u.x, u.y, u.x, u.y + 120); bg.addColorStop(0, 'rgba(191,247,232,.75)'); bg.addColorStop(1, 'rgba(191,247,232,0)');
        cx2.globalAlpha = Math.min(1, u.isin * 2); cx2.fillStyle = bg; cx2.beginPath(); cx2.moveTo(u.x - 10, u.y + 6); cx2.lineTo(u.x + 10, u.y + 6); cx2.lineTo(u.x + 46, u.y + 120); cx2.lineTo(u.x - 46, u.y + 120); cx2.closePath(); cx2.fill(); cx2.globalAlpha = 1;
      }
      cx2.save(); cx2.translate(u.x, u.y); cx2.rotate(Math.sin(u.t * 2.2 + 1) * 0.08);
      cx2.fillStyle = 'rgba(159,232,255,.85)'; cx2.beginPath(); cx2.ellipse(0, -6, 13, 12, 0, Math.PI, 0); cx2.fill();
      cx2.fillStyle = 'rgba(255,255,255,.7)'; cx2.beginPath(); cx2.ellipse(-4, -11, 3.5, 2.5, -0.5, 0, 6.283); cx2.fill();
      cx2.fillStyle = '#C3C9DD'; cx2.strokeStyle = '#23304D'; cx2.lineWidth = 2; cx2.beginPath(); cx2.ellipse(0, 0, 30, 9, 0, 0, 6.283); cx2.fill(); cx2.stroke();
      ['#FF6B5B', '#FFD23F', '#4CC38A', '#4AA8FF', '#FF7AA8'].forEach(function (rk, j) { cx2.globalAlpha = 0.5 + 0.5 * Math.sin(tsec * 6 + j * 1.3); cx2.fillStyle = rk; cx2.beginPath(); cx2.arc(-20 + j * 10, 1, 2.6, 0, 6.283); cx2.fill(); });
      cx2.globalAlpha = 1; cx2.restore();
      if (u.x < -120 || u.x > gw + 120 || u.y < -120) UFO.splice(w2, 1);
    }
    /* patlama parçacıkları (yıldızcıklar) */
    for (var pp = PAR.length - 1; pp >= 0; pp--) {
      var pr = PAR[pp]; pr.t += dt; pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.vx *= 1 - dt * 2.2; pr.vy = pr.vy * (1 - dt * 2.2) + 60 * dt;
      var al = Math.max(0, 1 - pr.t / pr.s); cx2.globalAlpha = al; cx2.fillStyle = pr.c;
      if (pr.yildiz) yildizCiz(pr.x, pr.y, pr.r * 1.8); else { cx2.beginPath(); cx2.arc(pr.x, pr.y, pr.r * (0.5 + al * 0.5), 0, 6.283); cx2.fill(); }
      if (pr.t > pr.s) PAR.splice(pp, 1);
    }
    cx2.globalAlpha = 1;
  }
  function dongu(now) { raf = 0; if (!mod || D.hidden) return; ciz(now); raf = W.requestAnimationFrame(dongu); }
  function basla() { if (SAKIN) { ciz(performance.now(), true); return; } if (!raf && mod) { sonT = 0; raf = W.requestAnimationFrame(dongu); } }
  function dur() { if (raf) W.cancelAnimationFrame(raf); raf = 0; }
  if (!SAKIN) W.addEventListener('scroll', function () { if (mod && !raf) ciz(performance.now(), true); }, { passive: true });

  /* ======================= görünüme göre aç/kapa ======================= */
  function aktif() { return D.documentElement.classList.contains('kz-uzay'); }
  function guncelle(app) {
    var g = app && app.isConnected && app.getClientRects().length ? app.dataset.gorunum || '' : '', yeni = TAM[g] ? g : SAKINGOR[g] ? g : '';
    var h = D.documentElement;
    h.classList.toggle('kz-uzay', !!TAM[yeni]); h.classList.toggle('kz-uzay-sakin', !!SAKINGOR[yeni]);
    if (yeni === mod) return;
    mod = yeni;
    if (mod) { kur(); if (!TAM[mod]) { KAY = []; ATES = []; KUY = []; UFO = []; PAR = []; } if (mod === 'harita') { var n0 = performance.now(); sonrakiUfo = n0 + 5000 + Math.random() * 5000; sonrakiKuy = n0 + 9000 + Math.random() * 6000; sonrakiAtes = Math.min(sonrakiAtes || Infinity, n0 + 2500); } basla(); } else { dur(); if (cx2) cx2.clearRect(0, 0, gw, gh); }
  }
  function izle() {
    var app = D.getElementById('kids-app'); if (!app) return;
    if (W.MutationObserver) new MutationObserver(function () { guncelle(app); }).observe(app, { attributes: true, attributeFilter: ['data-gorunum'] });
    guncelle(app);
    /* sayfa içi gezinme (#oyna ↔ tanıtım) app'i gizleyebilir */
    W.addEventListener('hashchange', function () { setTimeout(function () { guncelle(app); }, 0); });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', izle); else izle();

  W.KIDS_UZAY = { aktif: aktif, gezegen: gezegen, uc: uc, yerlestir: yerlestir, astronotHtml: astronotHtml, uc3Uygun: uc3Uygun, hafifMi: hafifMi, _test: { karis: karis, dokunus: dokunus, durum: function () { return { ATES: ATES, UFO: UFO, PAR: PAR, KUY: KUY, mod: mod }; } } };
})(window);
