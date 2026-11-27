/* ==========================================================================
   ACADEX MEDLAB · CİHAZ DEPOSU · kullanım simülasyonları (labs/depo/depo-sim.js), 27.11.2026
   DEPOSIM[ad] = { ozet, baslat(kap, kaydet) → durdurma fonksiyonu }
     defib  defibrilatör: ped yeri, ritim kararı, enerji, şarj, "herkes çekilsin", şok
     vent   ventilatör: ideal vücut ağırlığı, VT/kg, PEEP, FiO₂, solunum sayısı, plato
     enj    enjektör: doz hesabı, enjektör seçimi, çekme, hava, uygulama açısı
     pompa  infüzyon pompası / gravite seti: mL/saat, VTBI, klemp, damla/dk
     gluko  glukometre: işlem sırası ve sonucu yorumlama
     gonyo  gonyometre: referans noktaları ve açı okuma
     odyo   odyometre: Hughson-Westlake ile eşik bulma ve odyogram
   Saf hesaplar (DEPOSIM.hesap) testlerde doğrulanır. Puan 0–100; kaydet(puan) en iyiyi saklar.
   ========================================================================== */
(function (root) {
  'use strict';
  var W = typeof window !== 'undefined' ? window : root, D = W.document;
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sec = function (L) { return L[Math.floor(Math.random() * L.length)]; };
  var karistir = function (L) { L = L.slice(); for (var i = L.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = L[i]; L[i] = L[j]; L[j] = t; } return L; };
  var tr = function (n, d) { return Number(n).toLocaleString('tr-TR', { maximumFractionDigits: d == null ? 1 : d }); };
  var sayi = function (v) { return parseFloat(String(v).replace(',', '.')); };

  /* ---------------- saf hesaplar ---------------- */
  var H = {
    /* ideal vücut ağırlığı (Devine): erkek 50, kadın 45,5 + 0,91 × (boy cm − 152,4) */
    iva: function (cins, boy) { return Math.round(((cins === 'E' ? 50 : 45.5) + 0.91 * (boy - 152.4)) * 10) / 10; },
    hiz: function (ml, saat) { return Math.round(ml / saat * 10) / 10; },                                 /* mL/saat */
    damla: function (ml, dk, faktor) { return Math.round(ml * faktor / dk); },                            /* damla/dk */
    hacim: function (doz, kons) { return Math.round(doz / kons * 100) / 100; },                           /* mL = doz ÷ (birim/mL) */
    /* diz fleksiyonu: uyluk (diz→kalça) ile bacak (diz→ayak bileği) arasındaki açının 180’den farkı */
    fleksiyon: function (kalca, diz, bilek) {
      var a = [kalca[0] - diz[0], kalca[1] - diz[1]], b = [bilek[0] - diz[0], bilek[1] - diz[1]];
      var c = (a[0] * b[0] + a[1] * b[1]) / Math.hypot(a[0], a[1]) / Math.hypot(b[0], b[1]);
      return Math.round(180 - Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI);
    },
    /* enjektör seçimi: hacmi alan en küçük enjektör */
    enjektor: function (ml) { return [1, 3, 5, 10, 20].filter(function (s) { return s >= ml; })[0] || 20; }
  };

  /* ---------------- ortak çatı ---------------- */
  var cati = function (kap, o) {
    kap.innerHTML = '<div class="sm"><div class="sm-sahne">' + o.sahne + '</div><div class="sm-p"><h3>' + X(o.baslik) + '</h3><p class="sm-gorev">' + o.gorev + '</p>' +
      (o.adimlar ? '<ol class="sm-adim">' + o.adimlar.map(function (a) { return '<li>' + X(a) + '</li>'; }).join('') + '</ol>' : '') +
      '<div class="sm-ic"></div><p class="sm-geri" aria-live="polite"></p><div class="sm-son"></div></div></div>';
    var q = function (s) { return kap.querySelector(s); };
    var U = {
      q: q, ic: q('.sm-ic'), svg: q('.sm-sahne svg'),
      adim: function (i) { Array.prototype.forEach.call(kap.querySelectorAll('.sm-adim li'), function (li, j) { li.className = j < i ? 'ok' : j === i ? 'on' : ''; }); },
      geri: function (t, k) { var g = q('.sm-geri'); g.className = 'sm-geri' + (k ? ' ' + k : ''); g.innerHTML = t || ''; },
      bitir: function (puan, kaydet, ozet, yeniden) {
        var en = kaydet(puan);
        q('.sm-son').innerHTML = '<div class="sm-puan"><b>' + Math.round(puan) + '</b><span>/ 100 puan · en iyi ' + en + '<br>' + X(ozet || '') + '</span></div><div class="sm-k"><button type="button" data-yeni>Yeniden dene</button></div>';
        q('[data-yeni]').onclick = yeniden;
      }
    };
    return U;
  };
  var M = {};

  /* =========================== 1. DEFİBRİLATÖR =========================== */
  M.defib = { ozet: 'Ritmi tanı, pedleri yerleştir, enerjiyi seç ve güvenli şok ver.', baslat: function (kap, kaydet) {
    var RIT = { vf: { ad: 'ventrikül fibrilasyonu', sok: true }, vt: { ad: 'nabızsız ventrikül taşikardisi', sok: true }, asis: { ad: 'asistoli', sok: false } };
    var r = sec(['vf', 'vf', 'vt', 'asis']), puan = 100, iv = null, t = 0;
    var st = { ped: [], karar: null, enerji: null, sarj: false, cekil: false, bitti: false };
    var noktalar = [['sagust', 120, 98, 'sağ köprücük kemiği altı', true], ['solalt', 214, 178, 'sol meme altı, koltuk altı hattı', true], ['solust', 206, 98, 'sol köprücük kemiği altı', false], ['karin', 166, 236, 'karın ortası', false]];
    var sahne = '<svg viewBox="0 0 520 320" role="img" aria-label="Hasta göğsü ve defibrilatör ekranı">' +
      '<rect width="520" height="320" fill="#EEF2F7"/><path d="M70 320 C70 200 90 60 166 50 C242 60 262 200 262 320 Z" fill="#E8B48A" stroke="#B98A64" stroke-width="3"/><ellipse cx="166" cy="40" rx="40" ry="34" fill="#E8B48A" stroke="#B98A64" stroke-width="3"/>' +
      '<path d="M120 84 C140 90 150 92 166 92 C182 92 192 90 212 84" stroke="#B98A64" stroke-width="2" fill="none"/><path d="M166 96 V200" stroke="#B98A64" stroke-width="2" fill="none" opacity=".6"/>' +
      '<g data-pedler></g>' + noktalar.map(function (n) { return '<g class="sm-tik" data-n="' + n[0] + '" role="button" tabindex="0" aria-label="Ped: ' + n[3] + '"><circle cx="' + n[1] + '" cy="' + n[2] + '" r="20" fill="#fff" fill-opacity=".35" stroke="#2F6BFF" stroke-width="2.5" stroke-dasharray="5 4"/></g>'; }).join('') +
      '<g transform="translate(300 40)"><rect width="200" height="240" rx="14" fill="#F2F4F8" stroke="#6E7A90" stroke-width="3"/><rect x="12" y="12" width="176" height="96" rx="5" fill="#0B1222"/><path data-ekg d="" stroke="#4BE08A" stroke-width="2" fill="none"/>' +
      '<text data-en x="180" y="100" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="13" font-weight="700" fill="#FFD45A">— J</text><text data-dur x="20" y="30" font-family="JetBrains Mono,monospace" font-size="10" fill="#9AA6BC">RİTİM</text>' +
      '<rect data-sarjg x="12" y="120" width="176" height="10" rx="5" fill="#DDE3EA"/><rect data-sarjc x="12" y="120" width="0" height="10" rx="5" fill="#F2C94C"/>' +
      '<circle data-sokd cx="100" cy="186" r="34" fill="#C9D1DC" stroke="#0D1838" stroke-width="3"/><text x="100" y="191" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="14" font-weight="700" fill="#fff">ŞOK</text></g></svg>';
    var U = cati(kap, { sahne: sahne, baslik: 'Defibrilatör', gorev: '<b>Hastane koridoru:</b> Hasta yanıtsız, solumuyor, nabız yok. Ekibin göğüs basısı yapıyor. Defibrilatörü kullan.', adimlar: ['Pedleri yerleştir (2 nokta)', 'Ritmi değerlendir', 'Enerjiyi seç', 'Şarj et (basılar sürer)', 'Herkesi uzaklaştır', 'Şoku ver'] });
    var ekg = U.q('[data-ekg]');
    var ciz = function () {
      t += 1; var d = 'M24 60', x;
      for (x = 0; x <= 160; x += 4) {
        var y = 60;
        if (st.bitti && st.sonuc === 'sinus') { var k = (x + t * 3) % 60; y = k > 20 && k < 24 ? 30 : k >= 24 && k < 28 ? 76 : 60; }
        else if (r === 'vf') y = 60 + Math.sin((x + t * 7) * 0.31) * 14 + Math.sin((x + t * 5) * 0.73) * 9;
        else if (r === 'vt') y = 60 + Math.sin((x + t * 6) * 0.2) * 30;
        else y = 60 + Math.sin((x + t) * 0.5) * 1.2;
        d += ' L' + (24 + x) + ' ' + y.toFixed(1);
      }
      ekg.setAttribute('d', d); ekg.setAttribute('transform', 'translate(0 0)');
    };
    iv = setInterval(ciz, 90); ciz();
    var adimNo = 0, ilerle = function (n) { adimNo = n; U.adim(n); panel(); };
    var hata = function (t2, eksi) { puan -= eksi; U.geri(t2, 'no'); };
    var panel = function () {
      var h = '';
      if (adimNo === 0) h = '<p>Göğüste iki ped yerine dokun.</p>';
      else if (adimNo === 1) h = '<div class="sm-k"><button data-k="sok">Şoklanabilir ritim</button><button data-k="soksuz">Şoklanamaz ritim</button></div>';
      else if (adimNo === 2) h = '<div class="sm-k">' + [120, 150, 200, 360].map(function (e) { return '<button data-e="' + e + '">' + e + ' J</button>'; }).join('') + '</div><p class="k">Cihaz bifazik</p>';
      else if (adimNo === 3) h = '<div class="sm-k"><button data-k="sarj">Şarj et</button></div>';
      else if (adimNo === 4) h = '<div class="sm-k"><button data-k="cekil">"Herkes çekilsin, oksijen uzak!"</button><button data-k="sokbas">Şok ver</button></div>';
      else if (adimNo === 5) h = '<div class="sm-k"><button data-k="sokbas">Şok ver</button></div>';
      U.ic.innerHTML = h;
    };
    var yerles = function (id) {
      if (adimNo !== 0 || st.ped.indexOf(id) >= 0) return;
      var n = noktalar.filter(function (x) { return x[0] === id; })[0];
      U.q('[data-pedler]').insertAdjacentHTML('beforeend', '<rect x="' + (n[1] - 22) + '" y="' + (n[2] - 16) + '" width="44" height="32" rx="6" fill="' + (n[4] ? '#F2F4F8' : '#FBE9E6') + '" stroke="' + (n[4] ? '#0D1838' : '#C9483B') + '" stroke-width="2.5"/>');
      if (!n[4]) { hata('Bu nokta (' + n[3] + ') doğru değil: akım kalbin üzerinden geçmez. Doğrusu sağ köprücük kemiği altı ve sol koltuk altı hattında meme altı.', 15); return; }
      st.ped.push(id); U.geri('Doğru: ' + n[3] + '.', 'ok');
      if (st.ped.length === 2) { U.q('[data-dur]').textContent = 'RİTİM ANALİZİ'; ilerle(1); }
    };
    Array.prototype.forEach.call(kap.querySelectorAll('[data-n]'), function (g) { g.addEventListener('click', function () { yerles(g.getAttribute('data-n')); }); g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); yerles(g.getAttribute('data-n')); } }); });
    var son = function (ozet) { st.bitti = true; U.adim(6); U.ic.innerHTML = ''; U.bitir(Math.max(0, puan), kaydet, ozet, function () { durdur(); kap.__dur = M.defib.baslat(kap, kaydet); }); };
    U.ic.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var k = b.getAttribute('data-k'), en = b.getAttribute('data-e');
      if (adimNo === 1 && k) {
        var dogru = RIT[r].sok === (k === 'sok');
        if (!dogru) hata(RIT[r].sok ? 'Bu bir ' + RIT[r].ad + ': şoklanabilir ritim.' : 'Bu bir asistoli: şok verilmez.', r === 'asis' ? 40 : 30);
        else U.geri('Doğru: ' + RIT[r].ad + '.', 'ok');
        if (!RIT[r].sok) { U.geri((dogru ? 'Doğru: asistoli şoklanamaz. ' : 'Asistoli şoklanamaz. ') + 'Göğüs basısına kesintisiz devam edilir, en kısa sürede adrenalin verilir ve geri döndürülebilir nedenler (4H-4T) aranır.', dogru ? 'ok' : 'no'); son('Asistoli: şok yok, KPR + adrenalin.'); return; }
        ilerle(2);
      } else if (adimNo === 2 && en) {
        en = +en; st.enerji = en; U.q('[data-en]').textContent = en + ' J';
        if (en === 360) hata('360 J tek fazlı (monofazik) cihazların dozudur; bifazikte üretici önerisi (çoğu cihazda 120–200 J) seçilir.', 10);
        else U.geri(en + ' J bifazik için uygun (üretici önerisine göre 120–200 J).', 'ok');
        ilerle(3);
      } else if (adimNo === 3 && k === 'sarj') {
        U.geri('Şarj oluyor… Göğüs basısı sürüyor.', 'w'); var c = U.q('[data-sarjc]'), n2 = 0; U.ic.innerHTML = '';
        var si = setInterval(function () { n2++; c.setAttribute('width', Math.min(176, n2 * 18)); if (n2 >= 10) { clearInterval(si); st.sarj = true; U.q('[data-sokd]').setAttribute('fill', '#E5544A'); U.geri('Şarj tamam. Şimdi güvenliği sağla.', 'ok'); ilerle(4); } }, 120);
        st.si = si;
      } else if ((adimNo === 4 || adimNo === 5) && k === 'cekil') {
        st.cekil = true; U.geri('Basılar durdu, kimse hastaya dokunmuyor, oksijen uzakta.', 'ok'); ilerle(5);
      } else if ((adimNo === 4 || adimNo === 5) && k === 'sokbas') {
        if (!st.cekil) { hata('Önce "Herkes çekilsin!" demeden şok vermek ekibe akım geçirebilir.', 25); return; }
        U.q('[data-sokd]').setAttribute('fill', '#C9D1DC'); U.q('[data-sarjc]').setAttribute('width', 0);
        st.sonuc = Math.random() < 0.6 ? 'sinus' : 'devam'; st.bitti = st.sonuc === 'sinus';
        U.geri('Şok verildi. <b>Hemen nabız aramadan 2 dakika KPR</b>; ardından ritmi yeniden değerlendir.' + (st.sonuc === 'sinus' ? ' Monitörde düzenli ritim görünüyor; 2 dakika sonunda nabız kontrol edilir.' : ' Ritim sürerse ikinci şok ve adrenalin/amiodaron algoritmaya göre planlanır.'), 'ok');
        son(st.sonuc === 'sinus' ? 'Şok sonrası düzenli ritim.' : 'Şoklanabilir ritim sürüyor: KPR ve algoritma.');
      }
    });
    U.adim(0); panel();
    var durdur = function () { clearInterval(iv); clearInterval(st.si); };
    return durdur;
  } };

  /* =========================== 2. VENTİLATÖR =========================== */
  M.vent = { ozet: 'İdeal vücut ağırlığına göre koruyucu ventilasyon ayarı yap.', baslat: function (kap, kaydet) {
    var cins = sec(['E', 'K']), boy = cins === 'E' ? sec([168, 172, 176, 180, 185]) : sec([155, 160, 164, 168, 172]), kilo = Math.round(H.iva(cins, boy) * sec([1.1, 1.3, 1.6]));
    var ards = Math.random() < 0.65, iva = H.iva(cins, boy), C = ards ? 28 : 50, iv = null, t = 0;
    var sahne = '<svg viewBox="0 0 520 300" role="img" aria-label="Ventilatör ekranı"><rect width="520" height="300" rx="14" fill="#0B1222"/>' +
      '<text x="20" y="28" font-family="JetBrains Mono,monospace" font-size="11" fill="#9AA6BC">BASINÇ cmH₂O</text><path data-p d="" stroke="#FFD45A" stroke-width="2" fill="none"/>' +
      '<text x="20" y="150" font-family="JetBrains Mono,monospace" font-size="11" fill="#9AA6BC">AKIM</text><path data-a d="" stroke="#66C7FF" stroke-width="2" fill="none"/>' +
      '<g font-family="JetBrains Mono,monospace" font-weight="700"><text x="20" y="276" font-size="12" fill="#FFD45A" data-ppl>Plato —</text><text x="170" y="276" font-size="12" fill="#7FE0C2" data-mv>VE —</text><text x="320" y="276" font-size="12" fill="#66C7FF" data-spo>SpO₂ —</text></g></svg>';
    var U = cati(kap, { sahne: sahne, baslik: 'Mekanik ventilatör', gorev: '<b>' + (cins === 'E' ? 'Erkek' : 'Kadın') + ', boy ' + boy + ' cm, kilo ' + kilo + ' kg.</b> ' + (ards ? 'Tanı: ARDS. Akciğer koruyucu ventilasyon: VT 6 mL/kg İVA, plato < 30 cmH₂O, SpO₂ hedefi %88–95.' : 'Ameliyat sonrası, akciğer sağlıklı. VT 6–8 mL/kg İVA, SpO₂ hedefi %92–96.'), adimlar: ['İdeal vücut ağırlığını hesapla', 'Ayarları yap', 'Kontrol et'] });
    U.ic.innerHTML = '<div class="sm-in"><label for="vi">İVA (kg)</label><input id="vi" inputmode="decimal" placeholder="örn. 70"><button class="dp-b" data-k="iva">Hesapla</button></div><p class="k">Devine: erkek 50, kadın 45,5 + 0,91 × (boy − 152,4)</p>';
    U.adim(0);
    var puan = 100, ayar = { vt: 500, rr: 14, peep: 5, fio2: 50 };
    var hesap = function () {
      var vtkg = ayar.vt / iva, ppl = ayar.peep + ayar.vt / C, mv = ayar.vt * ayar.rr / 1000;
      var spo = Math.min(100, Math.round((ards ? 74 : 88) + (ayar.fio2 - 21) * (ards ? 0.22 : 0.2) + ayar.peep * (ards ? 1.1 : 0.4)));
      return { vtkg: vtkg, ppl: ppl, mv: mv, spo: spo };
    };
    var goster = function () {
      var h = hesap();
      U.q('[data-ppl]').textContent = 'Plato ' + tr(h.ppl, 0); U.q('[data-mv]').textContent = 'VE ' + tr(h.mv) + ' L/dk'; U.q('[data-spo]').textContent = 'SpO₂ %' + h.spo;
      var o = U.q('[data-vtkg]'); if (o) o.textContent = tr(h.vtkg) + ' mL/kg';
    };
    var dalga = function () {
      t++; var per = 60 / ayar.rr * 10, h = hesap(), dp = 'M20 120', da = 'M20 200', x;
      for (x = 0; x <= 480; x += 4) {
        var f = ((x / 4 + t) % per) / per, ins = f < 0.33;
        var p = ins ? ayar.peep + (h.ppl - ayar.peep) * Math.min(1, f / 0.25) : ayar.peep + (h.ppl - ayar.peep) * Math.max(0, 1 - (f - 0.33) / 0.08);
        var a = ins ? 30 : -40 * Math.exp(-(f - 0.33) * 14);
        dp += ' L' + (20 + x) + ' ' + (120 - p * 2.4).toFixed(1); da += ' L' + (20 + x) + ' ' + (200 - a).toFixed(1);
      }
      U.q('[data-p]').setAttribute('d', dp); U.q('[data-a]').setAttribute('d', da);
    };
    iv = setInterval(dalga, 100); dalga();
    var ayarCiz = function () {
      U.ic.innerHTML = '<div class="sm-al">' + [['vt', 'Tidal volüm (mL)', 250, 800, 10], ['rr', 'Solunum sayısı (/dk)', 8, 35, 1], ['peep', 'PEEP (cmH₂O)', 0, 20, 1], ['fio2', 'FiO₂ (%)', 21, 100, 1]].map(function (a) {
        return '<label><span>' + a[1] + '</span><input type="range" data-a="' + a[0] + '" min="' + a[2] + '" max="' + a[3] + '" step="' + a[4] + '" value="' + ayar[a[0]] + '"><output data-o="' + a[0] + '">' + ayar[a[0]] + '</output></label>';
      }).join('') + '</div><p class="k">VT / İVA: <b data-vtkg></b></p><div class="sm-k"><button data-k="kontrol">Kontrol et</button></div>';
      goster();
    };
    U.ic.addEventListener('input', function (e) { var a = e.target.getAttribute('data-a'); if (!a) return; ayar[a] = +e.target.value; U.q('[data-o="' + a + '"]').textContent = ayar[a]; goster(); });
    U.ic.addEventListener('click', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-k');
      if (k === 'iva') {
        var v = sayi(U.q('#vi').value); if (isNaN(v)) return;
        if (Math.abs(v - iva) <= 2) U.geri('Doğru: İVA ≈ ' + tr(iva) + ' kg. Gerçek kilo (' + kilo + ' kg) değil, İVA kullanılır.', 'ok');
        else { puan -= 15; U.geri('İVA ≈ ' + tr(iva) + ' kg olmalı (' + (cins === 'E' ? '50' : '45,5') + ' + 0,91 × (' + boy + ' − 152,4)). Gerçek kiloya göre ayar obez hastada aşırı hacim verir.', 'no'); }
        U.adim(1); ayarCiz();
      } else if (k === 'kontrol') {
        var h = hesap(), L = [], ceza = 0, hedef = ards ? [5.5, 6.5] : [6, 8];
        if (h.vtkg < hedef[0] || h.vtkg > hedef[1]) { ceza += 25; L.push('VT ' + tr(h.vtkg) + ' mL/kg; hedef ' + tr(hedef[0]) + '–' + tr(hedef[1]) + ' mL/kg (≈ ' + Math.round(iva * (ards ? 6 : 7)) + ' mL).'); }
        if (h.ppl >= 30) { ceza += 20; L.push('Plato ' + tr(h.ppl, 0) + ' cmH₂O: 30’un altına indir (VT’yi azalt).'); }
        if (ayar.peep < 5) { ceza += 10; L.push('PEEP en az 5 cmH₂O olmalı.'); }
        var spoH = ards ? [88, 95] : [92, 96];
        if (h.spo < spoH[0]) { ceza += 15; L.push('SpO₂ %' + h.spo + ' düşük: FiO₂ ya da PEEP’i artır.'); }
        else if (h.spo > spoH[1] && ayar.fio2 > 40) { ceza += 10; L.push('SpO₂ %' + h.spo + ' hedefin üstünde: gereksiz yüksek FiO₂’yi azalt.'); }
        if (h.mv < 5 || h.mv > 12) { ceza += 10; L.push('Dakika ventilasyonu ' + tr(h.mv) + ' L/dk: küçük VT ile solunum sayısını artırarak 5–12 L/dk aralığında tut.'); }
        if (!L.length) { U.geri('Ayarlar hedefte: VT ' + tr(h.vtkg) + ' mL/kg, plato ' + tr(h.ppl, 0) + ', SpO₂ %' + h.spo + '. Kan gazıyla takip edilir.', 'ok'); U.adim(3); U.bitir(puan, kaydet, 'Koruyucu ventilasyon ayarı tamam.', function () { clearInterval(iv); kap.__dur = M.vent.baslat(kap, kaydet); }); }
        else { puan -= Math.min(30, ceza / 2); U.geri(L.join('<br>'), 'no'); }
        U.adim(2);
      }
    });
    return function () { clearInterval(iv); };
  } };

  /* =========================== 3. ENJEKTÖR =========================== */
  M.enj = { ozet: 'Order’dan hacmi hesapla, doğru enjektörü seç ve dozu çek.', baslat: function (kap, kaydet) {
    var G = sec([
      { o: 'Seftriakson 750 mg IM. Flakon sulandırıldıktan sonra 250 mg/mL.', doz: 750, kons: 250, yol: 'IM' },
      { o: 'Heparin 5000 IU SC. Flakon 25 000 IU / 5 mL.', doz: 5000, kons: 5000, yol: 'SC' },
      { o: 'Morfin 4 mg IV, yavaş. Ampul 10 mg/mL.', doz: 4, kons: 10, yol: 'IV' },
      { o: 'Parasetamol şurup 15 mg/kg, çocuk 20 kg. Şurup 120 mg / 5 mL (oral enjektör).', doz: 300, kons: 24, yol: 'oral' },
      { o: 'Metoklopramid 10 mg IM. Ampul 10 mg / 2 mL.', doz: 10, kons: 5, yol: 'IM' }
    ]);
    var ml = H.hacim(G.doz, G.kons), dogruE = H.enjektor(ml), enj = null, puan = 100, cekilen = 0, hava = true;
    var sahne = '<svg viewBox="0 0 520 220" role="img" aria-label="Enjektör"><rect width="520" height="220" fill="#F5F8FB"/><g data-enj></g></svg>';
    var U = cati(kap, { sahne: sahne, baslik: 'Enjektörle doz hazırlama', gorev: '<b>Order:</b> ' + X(G.o), adimlar: ['Çekilecek hacmi hesapla', 'Enjektörü seç', 'Dozu çek', 'Havayı çıkar', 'Uygulama yolu'] });
    var cizEnj = function () {
      if (!enj) { U.q('[data-enj]').innerHTML = '<text x="260" y="116" text-anchor="middle" font-family="Instrument Sans,sans-serif" font-size="16" fill="#6A7593">Önce hacmi hesapla, sonra enjektör seç</text>'; return; }
      var x0 = 90, L = 300, cizgi = '', adet = enj <= 1 ? 10 : enj <= 3 ? 15 : enj <= 5 ? 25 : enj <= 10 ? 20 : 20, adimMl = enj / adet;
      for (var i = 0; i <= adet; i++) { var x = x0 + L * i / adet, uz = i % 5 === 0; cizgi += '<path d="M' + x + ' 80 v' + (uz ? 16 : 9) + '" stroke="#4C6BA0" stroke-width="' + (uz ? 1.6 : 1) + '"/>' + (uz ? '<text x="' + x + '" y="72" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#0D1838">' + tr(i * adimMl, 2) + '</text>' : ''); }
      var px = x0 + L * cekilen / enj;
      U.q('[data-enj]').innerHTML = '<rect x="' + x0 + '" y="80" width="' + L + '" height="52" rx="6" fill="#EAF6FF" stroke="#7FA6C8" stroke-width="2.5"/>' +
        '<rect x="' + x0 + '" y="84" width="' + Math.max(0, px - x0) + '" height="44" fill="' + (G.yol === 'oral' ? '#F7C98B' : '#BFE0F5') + '"/>' + (hava && cekilen > 0 ? '<circle cx="' + (x0 + 14) + '" cy="96" r="5" fill="#fff" stroke="#7FA6C8"/>' : '') + cizgi +
        '<rect x="' + (px - 5) + '" y="82" width="10" height="48" rx="2" fill="#2E3A5C"/><rect x="' + px + '" y="100" width="' + (x0 + L + 60 - px) + '" height="12" fill="#C9D1DC"/><rect x="' + (x0 + L + 56) + '" y="80" width="10" height="52" rx="3" fill="#C9D1DC" stroke="#6E7A90"/>' +
        (G.yol !== 'oral' ? '<rect x="' + (x0 - 22) + '" y="98" width="22" height="16" rx="3" fill="#3B7DD8"/><path d="M' + (x0 - 22) + ' 106 h-50" stroke="#9AA6BC" stroke-width="2.5"/>' : '<rect x="' + (x0 - 18) + '" y="98" width="18" height="16" rx="3" fill="#F2C94C"/>') +
        '<text x="260" y="170" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="15" font-weight="700" fill="#0D1838">' + enj + ' mL enjektör · ' + tr(cekilen, 2) + ' mL</text>';
    };
    cizEnj();
    U.ic.innerHTML = '<div class="sm-in"><label for="eh">Hacim (mL)</label><input id="eh" inputmode="decimal" placeholder="örn. 2,5"><button class="dp-b" data-k="h">Hesapla</button></div><p class="k">mL = istenen doz ÷ konsantrasyon (doz/mL)</p>';
    U.adim(0);
    U.ic.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; var k = b.getAttribute('data-k');
      if (k === 'h') {
        var v = sayi(U.q('#eh').value); if (isNaN(v)) return;
        if (Math.abs(v - ml) <= Math.max(0.02, ml * 0.02)) U.geri('Doğru: ' + tr(G.doz, 0) + ' ÷ ' + tr(G.kons, 0) + ' = <b>' + tr(ml, 2) + ' mL</b>.', 'ok');
        else { puan -= 30; U.geri('Hacim ' + tr(ml, 2) + ' mL olmalı: ' + tr(G.doz, 0) + ' ÷ ' + tr(G.kons, 0) + '. Hesap hatası doğrudan doz hatasıdır.', 'no'); }
        U.adim(1); U.ic.innerHTML = '<p>Hangi enjektör?</p><div class="sm-k">' + [1, 3, 5, 10, 20].map(function (s) { return '<button data-s="' + s + '">' + s + ' mL</button>'; }).join('') + '</div>';
      } else if (b.hasAttribute('data-s')) {
        enj = +b.getAttribute('data-s');
        if (enj < ml) { puan -= 15; U.geri(enj + ' mL enjektör bu hacmi almaz.', 'no'); return; }
        if (enj !== dogruE) { puan -= 10; U.geri('Çekilebilir ama ' + dogruE + ' mL enjektör daha hassas ölçer: hacmi alan en küçük enjektör seçilir.', 'w'); }
        else U.geri('Doğru seçim: ' + enj + ' mL.', 'ok');
        cekilen = 0; cizEnj(); U.adim(2);
        U.ic.innerHTML = '<div class="sm-al"><label><span>Pistonu çek</span><input type="range" data-cek min="0" max="' + enj + '" step="' + (enj <= 1 ? 0.01 : enj <= 5 ? 0.1 : 0.2) + '" value="0"><output data-co>0</output></label></div><div class="sm-k"><button data-k="cek">Tamam, çektim</button></div><p class="k">Pistonun ön (siyah) halkasını ölçek çizgisine getir.</p>';
      } else if (k === 'cek') {
        var hata = Math.abs(cekilen - ml), tol = enj <= 1 ? 0.02 : enj <= 5 ? 0.1 : 0.2;
        if (hata <= tol + 1e-9) U.geri('Doğru miktar: ' + tr(cekilen, 2) + ' mL.', 'ok'); else { puan -= hata > ml * 0.2 ? 25 : 10; U.geri('Çekilen ' + tr(cekilen, 2) + ' mL, istenen ' + tr(ml, 2) + ' mL.', 'no'); }
        U.adim(3); U.ic.innerHTML = '<div class="sm-k"><button data-k="hava">Enjektöre hafifçe vur, havayı çıkar</button><button data-k="havasiz">Doğrudan uygula</button></div>';
      } else if (k === 'hava' || k === 'havasiz') {
        if (k === 'havasiz') { puan -= 10; U.geri('Önce hava kabarcığı üste toplanıp çıkarılır; aksi halde doz eksik kalır.', 'no'); } else { hava = false; cizEnj(); U.geri('Hava çıkarıldı.', 'ok'); }
        U.adim(4);
        var sec2 = G.yol === 'IM' ? ['90°', '45°', '15°'] : G.yol === 'SC' ? ['45–90° (cilt kaldırılarak)', '15°', 'IV'] : G.yol === 'IV' ? ['IV, yavaş, damar yolundan', 'IM 90°', 'SC 45°'] : ['Ağızdan, yanak içine yavaşça', 'IM 90°', 'Burundan'];
        U.ic.innerHTML = '<p>Nasıl uygularsın?</p><div class="sm-k">' + karistir(sec2).map(function (s) { return '<button data-y="' + X(s) + '">' + X(s) + '</button>'; }).join('') + '</div>';
        U.ic.dataset.dogru = sec2[0];
      } else if (b.hasAttribute('data-y')) {
        var ok = b.getAttribute('data-y') === U.ic.dataset.dogru; if (!ok) puan -= 15;
        U.geri((ok ? 'Doğru. ' : 'Doğrusu: ' + X(U.ic.dataset.dogru) + '. ') + 'Uygulamadan sonra iğne kapağına geri takılmaz, doğrudan kesici-delici kutusuna atılır.', ok ? 'ok' : 'no');
        U.adim(5); U.ic.innerHTML = ''; U.bitir(Math.max(0, puan), kaydet, tr(ml, 2) + ' mL · ' + enj + ' mL enjektör', function () { kap.__dur = M.enj.baslat(kap, kaydet); });
      }
    });
    U.ic.addEventListener('input', function (e) { if (!e.target.hasAttribute('data-cek')) return; cekilen = +e.target.value; U.q('[data-co]').textContent = tr(cekilen, 2); cizEnj(); });
    return null;
  } };

  /* =========================== 4. İNFÜZYON POMPASI / GRAVİTE =========================== */
  M.pompa = { ozet: 'Hızı hesapla, pompaya gir ya da gravite setinde damla sayısını ayarla.', baslat: function (kap, kaydet) {
    var G = sec([
      { t: 'p', o: '1000 mL serum fizyolojik 8 saatte.', ml: 1000, sa: 8 },
      { t: 'p', o: '500 mL Ringer laktat 4 saatte.', ml: 500, sa: 4 },
      { t: 'p', o: '100 mL antibiyotik 30 dakikada.', ml: 100, sa: 0.5 },
      { t: 'p', o: '250 mL dekstroz 6 saatte.', ml: 250, sa: 6 },
      { t: 'g', o: '1000 mL serum fizyolojik 8 saatte, makro set (20 damla/mL), pompa yok.', ml: 1000, sa: 8, f: 20 },
      { t: 'g', o: '500 mL 6 saatte, mikro set (60 damla/mL).', ml: 500, sa: 6, f: 60 }
    ]);
    var puan = 100, iv = null, klemp = false, damlaT = 0;
    var dogru = G.t === 'p' ? H.hiz(G.ml, G.sa) : H.damla(G.ml, G.sa * 60, G.f);
    var sahne = '<svg viewBox="0 0 520 300" role="img" aria-label="' + (G.t === 'p' ? 'İnfüzyon pompası' : 'Serum seti') + '"><rect width="520" height="300" fill="#F5F8FB"/>' +
      '<rect x="60" y="14" width="70" height="80" rx="12" fill="#E8F4FF" stroke="#7FA6C8" stroke-width="2.5"/><text x="95" y="58" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" font-weight="700" fill="#0D1838">' + G.ml + '</text><text x="95" y="74" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#46506A">mL</text>' +
      '<rect x="85" y="94" width="20" height="16" rx="3" fill="#fff" stroke="#9AA6BC"/><rect x="83" y="110" width="24" height="44" rx="8" fill="#EAF6FF" stroke="#7FA6C8" stroke-width="2"/><circle data-dr cx="95" cy="118" r="3" fill="#7DB7E8"/>' +
      '<path d="M95 154 V190 C95 230 150 250 220 250" stroke="#9AB8D4" stroke-width="4" fill="none"/>' +
      '<g data-kl class="sm-tik" role="button" tabindex="0" aria-label="Makara klemp"><rect x="80" y="172" width="30" height="20" rx="5" fill="#C9483B"/><text x="128" y="186" font-family="JetBrains Mono,monospace" font-size="10" fill="#0D1838" data-klt>klemp kapalı</text></g>' +
      (G.t === 'p' ? '<rect x="230" y="60" width="250" height="200" rx="16" fill="#F2F4F8" stroke="#6E7A90" stroke-width="3"/><rect x="250" y="80" width="210" height="80" rx="6" fill="#0B1222"/><text data-ek x="355" y="118" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="20" font-weight="700" fill="#7FE0C2">— mL/sa</text><text data-ev x="355" y="144" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="12" fill="#9AA6BC">VTBI —</text><text data-al x="355" y="200" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="14" font-weight="700" fill="#C9483B"></text>'
        : '<text x="300" y="120" font-family="Instrument Sans,sans-serif" font-size="15" fill="#46506A">Damla odasını izle:</text><text data-ek x="300" y="150" font-family="JetBrains Mono,monospace" font-size="22" font-weight="700" fill="#0D1838">— damla/dk</text>') + '</svg>';
    var U = cati(kap, { sahne: sahne, baslik: G.t === 'p' ? 'İnfüzyon pompası' : 'Gravite seti', gorev: '<b>Order:</b> ' + X(G.o), adimlar: G.t === 'p' ? ['Hızı hesapla ve gir (mL/saat)', 'VTBI gir', 'Klempi aç', 'Başlat'] : ['Damla hızını hesapla', 'Klempi aç ve ayarla', 'Bir dakika damla say'] });
    var kl = U.q('[data-kl]'), klAc = function () { klemp = !klemp; kl.querySelector('rect').setAttribute('fill', klemp ? '#2E8E5B' : '#C9483B'); U.q('[data-klt]').textContent = klemp ? 'klemp açık' : 'klemp kapalı'; };
    kl.addEventListener('click', klAc); kl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); klAc(); } });
    var dr = U.q('[data-dr]'), akis = function (hiz) { clearInterval(iv); var ms = Math.max(120, 60000 / Math.max(1, hiz) / 3); iv = setInterval(function () { damlaT = (damlaT + 1) % 10; dr.setAttribute('cy', 118 + damlaT * 3); }, ms); };
    if (G.t === 'p') {
      U.ic.innerHTML = '<div class="sm-in"><label for="ph">Hız</label><input id="ph" inputmode="decimal" placeholder="mL/saat"><label for="pv">VTBI</label><input id="pv" inputmode="decimal" placeholder="mL"></div><div class="sm-k"><button data-k="bas">Başlat</button></div><p class="k">Hız = hacim ÷ süre (saat) · Klempe (serum hattındaki kırmızı makara) dokunarak aç.</p>';
      U.adim(0);
      U.ic.addEventListener('click', function (e) {
        if (!e.target.closest('[data-k="bas"]')) return;
        var h = sayi(U.q('#ph').value), v = sayi(U.q('#pv').value); if (isNaN(h) || isNaN(v)) { U.geri('Hızı ve VTBI’yi gir.', 'w'); return; }
        U.q('[data-ek]').textContent = tr(h) + ' mL/sa'; U.q('[data-ev]').textContent = 'VTBI ' + tr(v, 0) + ' mL';
        var L = [], ceza = 0;
        if (Math.abs(h - dogru) > Math.max(1, dogru * 0.02)) { ceza += 40; L.push('Hız ' + tr(dogru) + ' mL/saat olmalı (' + G.ml + ' ÷ ' + tr(G.sa) + ').'); }
        if (Math.abs(v - G.ml) > 1) { ceza += 20; L.push('VTBI verilecek toplam hacimdir: ' + G.ml + ' mL.' + (Math.abs(v - dogru) < 1 ? ' Hız ile VTBI’yi karıştırdın.' : '')); }
        if (!klemp) { U.q('[data-al]').textContent = '⚠ OKLÜZYON'; puan -= 10; U.geri('Oklüzyon alarmı: klemp kapalı. Hattı kontrol et, klempi aç ve yeniden başlat.', 'no'); U.adim(2); return; }
        U.q('[data-al]').textContent = '';
        if (L.length) { puan -= Math.min(50, ceza); U.geri(L.join('<br>'), 'no'); U.adim(1); return; }
        akis(h); U.adim(4); U.geri('Pompa çalışıyor: ' + tr(h) + ' mL/saat, ' + G.ml + ' mL. Damar yolunu ve hastayı düzenli izle.', 'ok');
        U.bitir(Math.max(0, puan), kaydet, tr(dogru) + ' mL/saat', function () { clearInterval(iv); kap.__dur = M.pompa.baslat(kap, kaydet); });
      });
    } else {
      U.ic.innerHTML = '<div class="sm-in"><label for="gd">Damla/dk</label><input id="gd" inputmode="numeric" placeholder="örn. 30"><button class="dp-b" data-k="ayar">Ayarla</button></div><p class="k">Damla/dk = hacim (mL) × damla faktörü ÷ süre (dk). Klempe dokunarak aç.</p>';
      U.adim(0);
      U.ic.addEventListener('click', function (e) {
        if (!e.target.closest('[data-k="ayar"]')) return;
        var d = sayi(U.q('#gd').value); if (isNaN(d)) return;
        if (!klemp) { U.geri('Klemp kapalı: önce makara klempi aç.', 'w'); U.adim(1); return; }
        U.q('[data-ek]').textContent = tr(d, 0) + ' damla/dk'; akis(d * 3);
        if (Math.abs(d - dogru) <= 1) U.geri('Doğru: ' + G.ml + ' × ' + G.f + ' ÷ ' + (G.sa * 60) + ' ≈ <b>' + dogru + ' damla/dk</b>. Bir dakika sayarak doğrula; kolun pozisyonu ve torba yüksekliği hızı değiştirir.', 'ok');
        else { puan -= 40; U.geri('Hız ' + dogru + ' damla/dk olmalı: ' + G.ml + ' × ' + G.f + ' ÷ ' + (G.sa * 60) + '.', 'no'); }
        U.adim(3); U.bitir(Math.max(0, puan), kaydet, dogru + ' damla/dk', function () { clearInterval(iv); kap.__dur = M.pompa.baslat(kap, kaydet); });
      });
    }
    return function () { clearInterval(iv); };
  } };

  /* =========================== 5. GLUKOMETRE =========================== */
  M.gluko = { ozet: 'Kapiller kan şekeri ölçümünü doğru sırayla yap ve sonucu yorumla.', baslat: function (kap, kaydet) {
    var SIRA = ['Ellerini yıka, hastanın ellerini yıkatıp kurulat', 'Eldiven giy, malzemeyi hazırla', 'Şeridi cihaza tak, kodu ve son kullanma tarihini kontrol et', 'Parmak ucunun yan tarafını lansetle del', 'İlk damlayı sil', 'İkinci damlayı şeride değdir', 'Sonucu oku ve kaydet', 'Lanseti kesici-delici kutusuna at'];
    var deger = sec([54, 62, 98, 124, 286, 318]), puan = 100, sira = 0;
    var sahne = '<svg viewBox="0 0 520 260" role="img" aria-label="Glukometre"><rect width="520" height="260" fill="#F5F8FB"/><rect x="180" y="40" width="160" height="190" rx="26" fill="#3B7DD8" stroke="#24569E" stroke-width="3"/><rect x="200" y="62" width="120" height="72" rx="10" fill="#E8F4FF"/><text data-d x="260" y="110" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="30" font-weight="700" fill="#0D1838">---</text><text x="260" y="126" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#46506A">mg/dL</text><circle cx="260" cy="178" r="18" fill="#24569E"/><rect data-s x="248" y="6" width="24" height="40" rx="3" fill="#F2F4F8" stroke="#6E7A90" opacity=".25"/><circle data-k cx="260" cy="12" r="0" fill="#C9483B"/></svg>';
    var U = cati(kap, { sahne: sahne, baslik: 'Glukometre', gorev: 'Diyabetli hasta öğle yemeğinden önce. Kan şekerini ölç. Adımları <b>doğru sırayla</b> seç.', adimlar: ['İşlem sırası', 'Sonucu yorumla'] });
    var ciz = function () {
      U.ic.innerHTML = '<p class="k">Sıradaki adım (' + (sira + 1) + ' / ' + SIRA.length + ')</p><div class="sm-k" style="flex-direction:column;align-items:stretch">' + karistir(SIRA.slice(sira).concat([]).slice(0, 4)).map(function (s) { return '<button data-s="' + X(s) + '" style="text-align:left">' + X(s) + '</button>'; }).join('') + '</div>';
    };
    U.adim(0); ciz();
    U.ic.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-s')) {
        var s = b.getAttribute('data-s');
        if (s !== SIRA[sira]) { puan -= 6; b.classList.add('no'); U.geri('Önce: "' + X(SIRA[sira]) + '" gelmeli.' + (sira === 4 ? ' İlk damla doku sıvısı ve kalıntı içerebilir.' : ''), 'no'); return; }
        sira++; U.geri('Doğru.', 'ok');
        if (sira === 3) U.q('[data-s]').setAttribute('opacity', '1');
        if (sira === 6) { U.q('[data-k]').setAttribute('r', 6); var n = 0, it = setInterval(function () { n++; U.q('[data-d]').textContent = n % 2 ? '· · ·' : '···'; if (n > 5) { clearInterval(it); U.q('[data-d]').textContent = deger; } }, 220); }
        if (sira < SIRA.length) ciz();
        else {
          U.adim(1);
          U.ic.innerHTML = '<p>Sonuç <b>' + deger + ' mg/dL</b>. Ne yaparsın?</p><div class="sm-k" style="flex-direction:column;align-items:stretch">' + karistir(['hipo', 'normal', 'hiper']).map(function (k) {
            return '<button data-y="' + k + '" style="text-align:left">' + { hipo: 'Hipoglisemi: protokolü başlat (bilinci yerindeyse ~15 g hızlı emilen karbonhidrat, 15 dk sonra yeniden ölç), hekime bildir', normal: 'Hedef aralıkta: kaydet, planlanan tedaviye devam et', hiper: 'Yüksek: belirtileri sorgula, ölçümü kaydet ve order’a göre insülin/hekime bildir; çok yüksekse keton bak' }[k] + '</button>';
          }).join('') + '</div>';
        }
      } else if (b.hasAttribute('data-y')) {
        var dogru = deger < 70 ? 'hipo' : deger > 180 ? 'hiper' : 'normal', ok = b.getAttribute('data-y') === dogru;
        if (!ok) puan -= 25;
        U.geri((ok ? 'Doğru yorum. ' : 'Doğru yorum: ' + { hipo: 'hipoglisemi', normal: 'hedef aralık', hiper: 'hiperglisemi' }[dogru] + '. ') + 'Erişkinde 70 mg/dL altı hipoglisemidir; hedefler hastaya göre belirlenir.', ok ? 'ok' : 'no');
        U.adim(2); U.ic.innerHTML = ''; U.bitir(Math.max(0, puan), kaydet, deger + ' mg/dL', function () { kap.__dur = M.gluko.baslat(kap, kaydet); });
      }
    });
    return null;
  } };

  /* =========================== 6. GONYOMETRE =========================== */
  M.gonyo = { ozet: 'Referans noktalarını bul, gonyometreyi hizala ve diz fleksiyonunu oku.', baslat: function (kap, kaydet) {
    var fl = sec([40, 55, 70, 85, 100, 115, 125]), puan = 100;
    var diz = [250, 150], kalca = [80, 150], aci = (180 - fl) * Math.PI / 180;
    /* bacak dizden aşağı-sola doğru döner (hasta yan yatar, uyluk yatay) */
    var bilek = [Math.round(diz[0] - Math.cos(aci) * 160), Math.round(diz[1] + Math.sin(aci) * 160)];
    var NOK = [['trokanter', kalca[0] + 6, kalca[1] - 22, 'büyük trokanter'], ['epikondil', diz[0], diz[1] - 6, 'femur lateral epikondili'], ['fibula', Math.round(diz[0] - Math.cos(aci) * 26), Math.round(diz[1] + Math.sin(aci) * 26) - 4, 'fibula başı'], ['patella', diz[0] + 22, diz[1] - 16, 'patella'], ['malleol', bilek[0], bilek[1], 'lateral malleol']];
    var bacak = '<path d="M' + kalca[0] + ' ' + (kalca[1] - 22) + ' L' + diz[0] + ' ' + (diz[1] - 20) + ' L' + diz[0] + ' ' + (diz[1] + 20) + ' L' + kalca[0] + ' ' + (kalca[1] + 22) + ' Z" fill="#E8B48A" stroke="#B98A64" stroke-width="3"/>' +
      '<path d="M' + diz[0] + ' ' + diz[1] + ' L' + bilek[0] + ' ' + bilek[1] + '" stroke="#E8B48A" stroke-width="34" stroke-linecap="round"/><circle cx="' + diz[0] + '" cy="' + diz[1] + '" r="22" fill="#E8B48A"/>' +
      '<path d="M' + bilek[0] + ' ' + bilek[1] + ' l' + (-Math.sin(aci) * 40).toFixed(0) + ' ' + (-Math.cos(aci) * 40).toFixed(0) + '" stroke="#E8B48A" stroke-width="22" stroke-linecap="round"/>' +
      '<rect x="0" y="' + (kalca[1] - 60) + '" width="90" height="120" rx="20" fill="#7FA6C8" opacity=".5"/>';
    var sahne = '<svg viewBox="0 0 440 340" role="img" aria-label="Diz fleksiyonu: yan görünüm"><rect width="440" height="340" fill="#F5F8FB"/>' + bacak + '<g data-g></g>' + NOK.map(function (n) { return '<g class="sm-tik" data-n="' + n[0] + '" role="button" tabindex="0" aria-label="' + n[3] + '"><circle cx="' + n[1] + '" cy="' + n[2] + '" r="9" fill="#fff" stroke="#2F6BFF" stroke-width="2.5"/></g>'; }).join('') + '</svg>';
    var U = cati(kap, { sahne: sahne, baslik: 'Gonyometre: diz fleksiyonu', gorev: 'Hasta yan yatıyor, dizini büktü. Gonyometreyi yerleştir ve açıyı oku.', adimlar: ['Pivotu yerleştir (eklem ekseni)', 'Sabit kolu hizala (proksimal referans)', 'Hareketli kolu hizala (distal referans)', 'Açıyı oku'] });
    var IS = ['epikondil', 'trokanter', 'malleol'], ad = 0;
    var sor = ['Pivot hangi noktaya konur?', 'Sabit kol hangi noktaya hizalanır?', 'Hareketli kol hangi noktaya hizalanır?'];
    U.ic.innerHTML = '<p data-s>' + sor[0] + ' Çizimde noktaya dokun.</p>'; U.adim(0);
    var gonyo = function () {
      var g = '<circle cx="' + diz[0] + '" cy="' + diz[1] + '" r="40" fill="rgba(238,242,247,.85)" stroke="#6E7A90" stroke-width="2"/>';
      /* ölçek: 0° uyluğun devamı (düz diz), fleksiyon arttıkça aşağı ve geriye döner */
      for (var d = 0; d <= 180; d += 10) { var a = d * Math.PI / 180, r1 = 40, r2 = d % 30 === 0 ? 30 : 34; g += '<path d="M' + (diz[0] + Math.cos(a) * r1).toFixed(1) + ' ' + (diz[1] + Math.sin(a) * r1).toFixed(1) + ' L' + (diz[0] + Math.cos(a) * r2).toFixed(1) + ' ' + (diz[1] + Math.sin(a) * r2).toFixed(1) + '" stroke="#2E3A5C" stroke-width="' + (d % 30 === 0 ? 1.8 : 1) + '"/>' + (d % 30 === 0 ? '<text x="' + (diz[0] + Math.cos(a) * 22).toFixed(1) + '" y="' + (diz[1] + Math.sin(a) * 22 + 3).toFixed(1) + '" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="7" fill="#0D1838">' + d + '</text>' : ''); }
      g += '<path d="M' + diz[0] + ' ' + diz[1] + ' L' + kalca[0] + ' ' + kalca[1] + '" stroke="#2E3A5C" stroke-width="6" opacity=".75"/>';
      if (ad >= 3) g += '<path d="M' + diz[0] + ' ' + diz[1] + ' L' + bilek[0] + ' ' + bilek[1] + '" stroke="#C9483B" stroke-width="6" opacity=".8"/>';
      g += '<circle cx="' + diz[0] + '" cy="' + diz[1] + '" r="5" fill="#0D1838"/>';
      U.q('[data-g]').innerHTML = g;
    };
    var tikla = function (id) {
      if (ad > 2) return;
      var n = NOK.filter(function (x) { return x[0] === id; })[0];
      if (id !== IS[ad]) { puan -= 12; U.geri('Bu nokta ' + n[3] + '. ' + ['Pivot femur lateral epikondiline konur.', 'Sabit kol uyluk boyunca büyük trokantere hizalanır.', 'Hareketli kol bacak boyunca lateral malleole hizalanır.'][ad], 'no'); return; }
      U.geri('Doğru: ' + n[3] + '.', 'ok'); ad++; U.adim(ad); if (ad >= 1) gonyo();
      if (ad < 3) U.q('[data-s]').textContent = sor[ad] + ' Çizimde noktaya dokun.';
      else U.ic.innerHTML = '<p>Gonyometrenin ölçeğinden fleksiyon açısını oku (eklem tam düzken 0°).</p><div class="sm-in"><input id="ga" inputmode="numeric" placeholder="derece"><button class="dp-b" data-k="oku">Kaydet</button></div>';
    };
    Array.prototype.forEach.call(kap.querySelectorAll('[data-n]'), function (g) { g.addEventListener('click', function () { tikla(g.getAttribute('data-n')); }); g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tikla(g.getAttribute('data-n')); } }); });
    U.ic.addEventListener('click', function (e) {
      if (!e.target.closest('[data-k="oku"]')) return;
      var v = sayi(U.q('#ga').value); if (isNaN(v)) return; var gercek = H.fleksiyon(kalca, diz, bilek), fark = Math.abs(v - gercek);
      if (fark <= 5) U.geri('Doğru: diz fleksiyonu yaklaşık <b>' + gercek + '°</b> (normal hareket açıklığı yaklaşık 0–135°).', 'ok');
      else { puan -= fark > 30 ? 35 : 20; U.geri('Açı yaklaşık ' + gercek + '°. ' + (Math.abs(v - (180 - gercek)) <= 5 ? 'Eklemin iç açısını okudun; fleksiyon 180’den farktır (düz diz 0°).' : 'Ölçekte sabit kol ile hareketli kol arasındaki yayı say.'), 'no'); }
      U.adim(4); U.ic.innerHTML = ''; U.bitir(Math.max(0, puan), kaydet, 'Diz fleksiyonu ' + gercek + '°', function () { kap.__dur = M.gonyo.baslat(kap, kaydet); });
    });
    return null;
  } };

  /* =========================== 7. ODYOMETRE =========================== */
  M.odyo = { ozet: 'Sağ kulakta Hughson-Westlake yöntemiyle eşikleri bul ve odyogramı yorumla.', baslat: function (kap, kaydet) {
    var FR = [250, 500, 1000, 2000, 4000, 8000];
    var PROF = {
      normal: { ad: 'Normal işitme', e: [10, 10, 5, 10, 15, 10] },
      presbi: { ad: 'Yüksek frekanslarda eğimli sensörinöral kayıp (presbiakuzi ile uyumlu)', e: [15, 20, 25, 35, 50, 65] },
      gurultu: { ad: '4000 Hz’te çentik (gürültüye bağlı kayıpla uyumlu)', e: [10, 10, 15, 25, 55, 30] },
      iletim: { ad: 'Tüm frekanslarda düz hafif kayıp (iletim tipi olabilir; kemik yolu ile doğrulanır)', e: [35, 35, 30, 30, 30, 35] }
    };
    var pk = sec(Object.keys(PROF)), P = PROF[pk], fi = 2, db = 30, kayit = {}, puan = 100, tonSay = 0;
    var gx = function (i) { return 60 + i * 80; }, gy = function (d) { return 30 + (d + 10) * 2.2; };
    var sahne = '<svg viewBox="0 0 520 300" role="img" aria-label="Odyogram, sağ kulak"><rect width="520" height="300" fill="#fff"/>' +
      [-10, 0, 20, 40, 60, 80, 100].map(function (d) { return '<path d="M50 ' + gy(d) + ' H470" stroke="#E2E7EC"/><text x="44" y="' + (gy(d) + 4) + '" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="9" fill="#46506A">' + d + '</text>'; }).join('') +
      FR.map(function (f, i) { return '<path d="M' + gx(i) + ' 30 V' + gy(100) + '" stroke="#E2E7EC"/><text x="' + gx(i) + '" y="22" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#46506A">' + (f >= 1000 ? f / 1000 + 'k' : f) + '</text>'; }).join('') +
      '<rect x="50" y="' + gy(-10) + '" width="420" height="' + (gy(25) - gy(-10)) + '" fill="#2E8E5B" opacity=".06"/><g data-od></g><g data-im></g>' +
      '<g data-el transform="translate(470 250)" opacity=".2"><circle r="16" fill="#E8B48A"/><path d="M-6 -16 v-18 M0 -16 v-22 M6 -16 v-18" stroke="#E8B48A" stroke-width="5" stroke-linecap="round"/></g><text x="56" y="290" font-family="JetBrains Mono,monospace" font-size="9" fill="#46506A">dB HL · sağ kulak (O)</text></svg>';
    var U = cati(kap, { sahne: sahne, baslik: 'Saf ses odyometrisi', gorev: 'Hasta yanıt düğmesini tutuyor. Sağ kulakta 250–8000 Hz eşiklerini bul. <b>Kural:</b> duydukça 10 dB in, duymazsa 5 dB çık; aynı düzeyde tekrar tekrar duyuyorsa eşik odur.', adimlar: ['Eşikleri bul (6 frekans)', 'Odyogramı yorumla'] });
    var od = function () {
      var s = '', pts = FR.map(function (f, i) { return kayit[f] != null ? [gx(i), gy(kayit[f])] : null; }).filter(Boolean);
      if (pts.length > 1) s += '<path d="M' + pts.map(function (p) { return p.join(' '); }).join(' L') + '" stroke="#C9483B" stroke-width="2" fill="none"/>';
      pts.forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="7" fill="#fff" stroke="#C9483B" stroke-width="2.5"/>'; });
      U.q('[data-od]').innerHTML = s;
      U.q('[data-im]').innerHTML = '<circle cx="' + gx(fi) + '" cy="' + gy(db) + '" r="5" fill="#2F6BFF" opacity=".7"/>';
    };
    var panel = function () {
      U.ic.innerHTML = '<div class="sm-k">' + FR.map(function (f, i) { return '<button data-f="' + i + '" aria-pressed="' + (i === fi) + '">' + (f >= 1000 ? f / 1000 + ' kHz' : f + ' Hz') + (kayit[f] != null ? ' ✓' : '') + '</button>'; }).join('') + '</div>' +
        '<div class="sm-k"><button data-d="-10">−10 dB</button><button data-d="-5">−5</button><span class="mono" style="align-self:center;font-weight:700;min-width:70px;text-align:center">' + db + ' dB</span><button data-d="5">+5</button><button data-d="10">+10 dB</button></div>' +
        '<div class="sm-k"><button data-k="ton" style="background:#0D1838;color:#fff">♪ Ton ver</button><button data-k="kaydet">Eşiği kaydet</button></div>';
      od();
    };
    U.adim(0); panel();
    U.ic.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-f')) { fi = +b.getAttribute('data-f'); db = 30; panel(); U.geri(''); return; }
      if (b.hasAttribute('data-d')) { db = Math.max(-10, Math.min(100, db + +b.getAttribute('data-d'))); panel(); return; }
      var k = b.getAttribute('data-k');
      if (k === 'ton') {
        tonSay++; var duydu = db >= P.e[fi], el = U.q('[data-el]');
        el.setAttribute('opacity', duydu ? '1' : '.2'); setTimeout(function () { el.setAttribute('opacity', '.2'); }, 700);
        U.geri(duydu ? 'Hasta düğmeye bastı (duydu). Şimdi 10 dB in.' : 'Yanıt yok. 5 dB çık.', duydu ? 'ok' : 'w');
      } else if (k === 'kaydet') {
        kayit[FR[fi]] = db; var nxt = FR.findIndex(function (f) { return kayit[f] == null; });
        if (nxt >= 0) { fi = nxt; db = 30; panel(); U.geri('Kaydedildi. Sıradaki frekans: ' + FR[fi] + ' Hz.', ''); return; }
        panel(); U.adim(1);
        var hata = FR.filter(function (f, i) { return Math.abs(kayit[f] - P.e[i]) > 5; });
        puan -= hata.length * 10;
        U.geri(hata.length ? 'Eşikten 5 dB’den fazla sapan frekanslar: ' + hata.join(', ') + ' Hz. Gerçek eşikler: ' + FR.map(function (f, i) { return f + ' Hz ' + P.e[i]; }).join(' · ') + ' dB.' : 'Bütün eşikler ±5 dB içinde.', hata.length ? 'w' : 'ok');
        U.ic.innerHTML = '<p>Odyogram neyle uyumlu?</p><div class="sm-k" style="flex-direction:column;align-items:stretch">' + karistir(Object.keys(PROF)).map(function (p) { return '<button data-y="' + p + '" style="text-align:left">' + X(PROF[p].ad) + '</button>'; }).join('') + '</div>';
      }
      if (b.hasAttribute('data-y')) {
        var ok = b.getAttribute('data-y') === pk; if (!ok) puan -= 25;
        U.geri((ok ? 'Doğru: ' : 'Doğrusu: ') + X(P.ad) + '. Tanı için kemik yolu, konuşma testleri ve timpanometri birlikte değerlendirilir.', ok ? 'ok' : 'no');
        U.ic.innerHTML = ''; U.adim(2); U.bitir(Math.max(0, puan - Math.max(0, tonSay - 60)), kaydet, P.ad, function () { kap.__dur = M.odyo.baslat(kap, kaydet); });
      }
    });
    return null;
  } };

  M.hesap = H;
  root.DEPOSIM = M;
})(typeof window !== 'undefined' ? window : globalThis);
