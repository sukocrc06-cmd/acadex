/* ==========================================================================
   ACADEX KIDS · MASKOT TEPKİLERİ (kids/assets/kids-maskot.js + kids-maskot.css), 26.11.2026
   Konu ekranında çocuğun kendi astronotu (kaskın camında kendi hayvanı) sol altta durur ve oyuna
   tepki verir. Oyunlara dokunmadan çalışır: oyunlar zaten SES.fx('dogru' | 'yanlis' | 'seri' | 'yildiz')
   çalıyor, maskot bunları dinler (KIDS_SES.fxDinle).
     doğru  → zıplar, balonda "Yaşasın!"        seri ≥ 3 → takla atar
     yanlış → kaskını kaşır, "Bir daha dene!"   yıldız   → dans eder (oyun bitti)
   Uzun süre dokunulmazsa (ipucu):
     konu ekranı: 14 sn → el sallar, "Dinle!" der gibi balon açar ve yönergeyi ("Tekrar dinle") bir
       kez yeniden çaldırır; bir durakta en çok 2 kez. Yönergesi olmayan duraklarda (izle, şarkı)
       çocuk zaten izliyordur: ipucu yok.
     harita: 22 sn → bugünün gezegeni zıplar, astronot el sallar (kids-uzay ipucu); en çok 3 kez.
   Maskot ekran okuyucuya kapalı (aria-hidden), dokunuşu engellemez (pointer-events:none).
   Hareketi azalt: zıplama/takla yok, yalnız balon. W.KIDS_MASKOT
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, SES = W.KIDS_SES, C = W.KIDS_CIZ;
  var SAKIN = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var YASASIN = ['Yaşasın!', 'Süper!', 'Great!', 'Yes!', 'Harika!', 'Well done!'], TEKRAR = ['Bir daha dene!', 'Hmm…', 'Try again!'], DANS = ['Bravo!', 'Hooray!', 'Yaşasın!'];
  var HAL = ['kms-zipla', 'kms-takla', 'kms-hmm', 'kms-dans', 'kms-el'];
  var app = null, el = null, balonT = 0, halT = 0, sira = 0, sonDokunus = Date.now(), ipucuSay = 0, sonIpucu = 0, haritaSay = 0, haritaSon = 0, gorunumOnce = '';
  var AYAR = { konu: 14000, konuAra: 20000, konuEnCok: 2, harita: 22000, haritaAra: 30000, haritaEnCok: 3 };

  function durum() { return W.KIDS_APP && W.KIDS_APP.durum ? W.KIDS_APP.durum() : null; }
  function ortuAcik() { return !!D.querySelector('.ka-ort, .ka-uyku, .ka-ucus'); }
  function gorunur(x) { return !!(x && x.isConnected && x.getClientRects().length); }

  function maskotHtml() {
    var s = durum(), hv = s && s.ogr ? s.ogr[1] : 'kedi', rk = s && s.ogr ? s.ogr[4] : null;
    var govde = W.KIDS_UZAY && W.KIDS_UZAY.astronotHtml ? W.KIDS_UZAY.astronotHtml(hv, rk) : (C ? C.avatar(hv, rk) : '');
    return '<span class="kms-ic">' + govde + '</span><span class="kms-balon"></span>';
  }
  /* konu ekranı her durakta yeniden çizilir (app.innerHTML): maskot her seferinde yeniden eklenir */
  function bagla() {
    if (!app) return;
    var g = app.dataset.gorunum || '';
    if (g !== gorunumOnce) { gorunumOnce = g; haritaSay = 0; }
    if (g !== 'konu') { el = null; return; }
    if (app.querySelector('.kms')) { el = app.querySelector('.kms'); return; }
    el = D.createElement('div'); el.className = 'kms'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = maskotHtml();
    app.appendChild(el);
    ipucuSay = 0; sonDokunus = Date.now();
  }
  function balon(metin, sure) {
    if (!el) return; var b = el.querySelector('.kms-balon'); if (!b) return;
    b.textContent = metin; b.classList.add('ac'); clearTimeout(balonT);
    balonT = setTimeout(function () { b.classList.remove('ac'); }, sure || 1500);
  }
  function hal(c, sure) {
    if (!el) return;
    HAL.forEach(function (x) { el.classList.remove(x); }); void el.offsetWidth;
    if (!SAKIN) el.classList.add(c);
    clearTimeout(halT); halT = setTimeout(function () { if (el) el.classList.remove(c); }, sure || 900);
  }
  function tepki(ad, x) {
    if (!el || !el.isConnected || (app && app.dataset.gorunum !== 'konu')) return;
    if (ad === 'dogru') { sonDokunus = Date.now(); ipucuSay = 0; hal('kms-zipla', 700); balon(YASASIN[sira++ % YASASIN.length], 1100); }
    else if (ad === 'seri' && (x || 0) >= 3) { hal('kms-takla', 900); }
    else if (ad === 'yanlis') { sonDokunus = Date.now(); hal('kms-hmm', 1300); balon(TEKRAR[sira++ % TEKRAR.length], 1400); }
    else if (ad === 'yildiz') { hal('kms-dans', 1600); balon(DANS[sira++ % DANS.length], 1600); }
  }
  /* uzun süre dokunulmadı mı? her saniye bakılır */
  function bak() {
    if (!app || D.hidden || ortuAcik()) return;
    var g = app.dataset.gorunum, simdi = Date.now(), bos = simdi - sonDokunus;
    if (g === 'konu') {
      var dn = app.querySelector('[data-ko-dinle]');
      if (!el || !gorunur(dn) || ipucuSay >= AYAR.konuEnCok || bos < AYAR.konu || simdi - sonIpucu < AYAR.konuAra) return;
      ipucuSay++; sonIpucu = simdi;
      hal('kms-el', 1700); balon('Dinle!', 1800);
      dn.classList.remove('kms-nabiz'); void dn.offsetWidth; dn.classList.add('kms-nabiz');
      setTimeout(function () { dn.classList.remove('kms-nabiz'); }, 2400);
      setTimeout(function () { if (dn.isConnected && !ortuAcik()) dn.click(); }, 700);
    } else if (g === 'harita') {
      if (haritaSay >= AYAR.haritaEnCok || bos < AYAR.harita || simdi - haritaSon < AYAR.haritaAra) return;
      if (!W.KIDS_UZAY || !W.KIDS_UZAY.ipucu || (W.KIDS_UZAY.kalkiyor && W.KIDS_UZAY.kalkiyor())) return;
      var s = durum(); haritaSay++; haritaSon = simdi;
      W.KIDS_UZAY.ipucu((s && (s.bugunId || (s.konu))) || null);
    }
  }
  function kur() {
    app = D.getElementById('kids-app'); if (!app) return;
    if (W.MutationObserver) new MutationObserver(bagla).observe(app, { childList: true, attributes: true, attributeFilter: ['data-gorunum'] });
    D.addEventListener('pointerdown', function () { sonDokunus = Date.now(); ipucuSay = 0; }, true);
    D.addEventListener('keydown', function () { sonDokunus = Date.now(); }, true);
    if (SES && SES.fxDinle) SES.fxDinle(tepki);
    setInterval(bak, 1000);
    bagla();
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', kur); else kur();
  W.KIDS_MASKOT = { tepki: tepki, AYAR: AYAR, _test: { bak: bak, bagla: bagla, durum: function () { return { el: el, ipucuSay: ipucuSay, haritaSay: haritaSay }; }, dokundu: function (t) { sonDokunus = t; } } };
})(window);
