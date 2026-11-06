/* ==========================================================================
   ACADEX MEDICA · rehber hekim ipucu (labs/medica/medica-cerrah.js), 31.10.2026 · 06.11.2026 Dr. Ela
   Anatomi ve Fizyo Lab, Acadex Medica içinde (?medica=1) açıldığında yüklenir.
   Rehber hekim Uzm. Dr. Ela Altındağ köşede belirir ve üç
   kademede yardım eder: 1) sözel ipucu, 2) bölgeyi gösterir, 3) yapıyı gösterip adını söyler.
   Her kademe puandan düşer (5 / 10 / 20; labs/medica/medica-veri.js → IPUCU_CEZA ile aynı);
   kullanılan kademe hastaneye {src:'axmedica', type:'ipucu'} iletisiyle bildirilir.
   Platformda insan öğretmen yoktur: Dr. Ela Acadex'in kendi kurgusal rehberidir.

   Kullanım: AXCERRAH.kur({ lab, anahtar: () => adım anahtarı | null, kademe: n => metin | Promise<metin>, etiket?: [3 düğme adı] })
   ========================================================================== */
(function () {
  'use strict';
  if (window.AXCERRAH) return;
  var D = document, W = window;
  var RM = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CEZA = [5, 10, 20];
  var ETIKET = ['İpucu ver', 'Bölgeyi göster', 'Yapıyı göster'];
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* rehber hekim Uzm. Dr. Ela Altındağ (06.11.2026), omuz hizasından: beyaz önlük, steteskop, at kuyruğu,
     gülümseyen yüz, işaret eden el. Çizim hastane holündeki tam boy figürle aynı (labs/medica/medica.js → ela). */
  var elaSVG = function () {
    var ten = '#EDBB98', sac = '#3A2418', mur = '#0D1838';
    return '<svg viewBox="0 0 120 132" aria-hidden="true"><g transform="translate(60 348)">' +
      '<path d="M-42 -240 C-44 -252 44 -252 42 -240 L44 -200 L-44 -200 Z" fill="#3E9A86"/><path d="M-14 -250 L0 -226 L14 -250" fill="#2F7F6E"/>' +
      '<path d="M-46 -244 C-53 -246 -60 -238 -62 -226 L-64 -200 L-14 -200 L-12 -214 L-22 -249 Z M46 -244 C53 -246 60 -238 62 -226 L64 -200 L14 -200 L12 -214 L22 -249 Z" fill="#fff" stroke="#CDD6E2" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M-22 -249 L-12 -214 M22 -249 L12 -214" stroke="#CDD6E2" stroke-width="2.5"/><rect x="-46" y="-218" width="20" height="18" rx="2" fill="#fff" stroke="#CDD6E2" stroke-width="2"/><rect x="-46" y="-218" width="20" height="6" rx="2" fill="#2E9C86"/>' +
      '<path d="M-19 -252 C-28 -226 -20 -208 -6 -203 M19 -252 C28 -226 20 -208 6 -203" stroke="' + mur + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
      '<rect x="-9" y="-266" width="18" height="20" rx="4" fill="' + ten + '"/>' +
      '<g transform="translate(24 -318)"><path class="axc-at" d="M0 0 C22 6 27 34 15 63 C11 73 2 75 -2 67 C10 45 8 19 -6 7 Z" fill="' + sac + '"/></g>' +
      '<ellipse cx="0" cy="-298" rx="36" ry="39" fill="' + sac + '"/><ellipse cx="-31" cy="-291" rx="5.5" ry="8" fill="' + ten + '"/><ellipse cx="31" cy="-291" rx="5.5" ry="8" fill="' + ten + '"/><circle cx="-31" cy="-281" r="2.6" fill="#E8B53A"/><circle cx="31" cy="-281" r="2.6" fill="#E8B53A"/>' +
      '<ellipse cx="0" cy="-292" rx="30" ry="34" fill="' + ten + '"/>' +
      '<path d="M-34 -294 C-39 -337 34 -343 35 -300 C30 -318 14 -327 -4 -323 C-16 -320 -26 -310 -34 -294 Z" fill="' + sac + '"/><path d="M-31 -302 C-37 -284 -35 -268 -27 -258 C-30 -274 -28 -290 -23 -300 Z M31 -304 C36 -288 35 -274 29 -264 C31 -278 29 -292 25 -302 Z" fill="' + sac + '"/><rect x="20" y="-325" width="9" height="11" rx="3" fill="#E5544A" transform="rotate(22 24 -319)"/>' +
      '<path d="M-19 -304 q8 -5 15 -1 M19 -304 q-8 -5 -15 -1" stroke="' + sac + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<g class="axc-goz"><ellipse cx="-11" cy="-292" rx="5.2" ry="5.8" fill="#fff"/><ellipse cx="11" cy="-292" rx="5.2" ry="5.8" fill="#fff"/><circle cx="-11" cy="-291.5" r="3.5" fill="' + mur + '"/><circle cx="11" cy="-291.5" r="3.5" fill="' + mur + '"/><circle cx="-9.8" cy="-293" r="1.2" fill="#fff"/><circle cx="12.2" cy="-293" r="1.2" fill="#fff"/><path d="M-16.6 -294.6 Q-11 -299.6 -5.6 -294.6 M16.6 -294.6 Q11 -299.6 5.6 -294.6" stroke="' + mur + '" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M-16.4 -295 l-3 -1.6 M16.4 -295 l3 -1.6" stroke="' + mur + '" stroke-width="1.8" stroke-linecap="round"/></g>' +
      '<ellipse cx="-19" cy="-278" rx="6" ry="3.5" fill="#F08A8A" opacity=".42"/><ellipse cx="19" cy="-278" rx="6" ry="3.5" fill="#F08A8A" opacity=".42"/><path d="M0 -287 q-3 7 1 9" stroke="#D39A76" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<g class="axc-agiz"><path d="M-9.5 -271 Q0 -259.5 9.5 -271 Q4 -268.5 0 -269.4 Q-4 -268.5 -9.5 -271 Z" fill="#C24E5A"/><path d="M-6 -269.6 Q0 -267.4 6 -269.6" stroke="#fff" stroke-width="1.6" fill="none"/></g>' +
      '<g class="axc-el"><path d="M40 -200 L44 -230" stroke="#CDD6E2" stroke-width="15" stroke-linecap="round"/><path d="M40 -200 L44 -230" stroke="#fff" stroke-width="11" stroke-linecap="round"/><ellipse cx="45" cy="-238" rx="7" ry="8" fill="' + ten + '"/><path d="M46 -244 L47 -258" stroke="' + ten + '" stroke-width="5" stroke-linecap="round"/></g>' +
      '</g></svg>';
  };
  var CSS = [
    '.axc-b{position:fixed;left:16px;bottom:16px;z-index:9400;display:flex;align-items:center;gap:8px;padding:4px 14px 4px 4px;border:2px solid #0D1838;border-radius:999px;background:#fff;color:#0D1838;font:700 14px "Instrument Sans",system-ui,sans-serif;box-shadow:3px 3px 0 #0D1838;cursor:pointer}',
    '.axc-b:hover{transform:translateY(-1px)}.axc-b[aria-expanded="true"]{background:#E2F4EF}',
    '.axc-b i{display:block;width:40px;height:40px;border-radius:50%;background:#E2F4EF;overflow:hidden}.axc-b i svg{width:100%;height:100%}',
    '.axc-p{position:fixed;left:16px;bottom:72px;z-index:9400;width:min(380px,calc(100vw - 32px));padding:14px;border-radius:18px;background:#fff;border:2px solid #0D1838;box-shadow:0 22px 40px -18px rgba(13,24,56,.55);font-family:"Instrument Sans",system-ui,sans-serif;color:#0D1838;animation:axc-in .3s cubic-bezier(.2,.8,.2,1) both}',
    '.axc-p[hidden]{display:none}',
    '@keyframes axc-in{from{opacity:0;transform:translateY(12px) scale(.96)}}',
    '.axc-u{display:flex;gap:12px;align-items:flex-start}',
    '.axc-u .axc-yz{flex:none;width:86px;height:94px;border-radius:14px;background:linear-gradient(180deg,#E2F4EF,#C9E9E1);overflow:hidden}.axc-yz svg{width:100%;height:100%}',
    '.axc-u b{display:block;font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:15px}.axc-u small{display:block;color:#6A7593;font-size:12px}',
    '.axc-t{margin:8px 0 0;padding:10px 12px;border-radius:12px;background:#F3F7F9;font-size:14.5px;line-height:1.5;min-height:3em}',
    '.axc-t .cur{display:inline-block;width:7px;height:1em;background:#0D1838;vertical-align:-2px;margin-left:2px;animation:axc-bl .8s steps(2) infinite}',
    '@keyframes axc-bl{50%{opacity:0}}',
    '.axc-k{display:flex;gap:4px;margin-top:10px}.axc-k span{flex:1;height:6px;border-radius:3px;background:#DCE2EA}.axc-k span.on{background:#2E9C86}',
    '.axc-r{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
    '.axc-r button{min-height:40px;padding:0 14px;border:1.5px solid #0D1838;border-radius:999px;background:#fff;color:#0D1838;font:700 13.5px "Instrument Sans",system-ui,sans-serif;cursor:pointer}',
    '.axc-r button.pri{background:#0D1838;color:#fff}.axc-r button:disabled{opacity:.45;cursor:default}',
    '.axc-p.konus .axc-agiz{animation:axc-m .26s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 0}',
    '@keyframes axc-m{to{transform:scaleY(1.6)}}',
    '.axc-at{animation:axc-at 3.2s ease-in-out infinite;transform-box:view-box;transform-origin:0 0}',
    '@keyframes axc-at{50%{transform:rotate(6deg)}}',
    '.axc-goz{animation:axc-g 4.6s infinite;transform-box:fill-box;transform-origin:center}',
    '@keyframes axc-g{0%,93%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}',
    '.axc-p.konus .axc-el{animation:axc-e .9s ease-in-out 2 alternate;transform-box:fill-box;transform-origin:50% 100%}',
    '@keyframes axc-e{to{transform:rotate(-8deg) translateY(-3px)}}',
    '@media (max-width:700px){.axc-b span{display:none}.axc-b{padding:4px}.axc-p{bottom:68px}}',
    '@media (prefers-reduced-motion:reduce){.axc-b,.axc-p,.axc-p *{animation:none!important;transition:none!important}}'
  ].join('\n');

  var kur = function (o) {
    if (!o || D.querySelector('.axc-b')) return;
    var st = D.createElement('style'); st.textContent = CSS; D.head.appendChild(st);
    var b = D.createElement('button'); b.type = 'button'; b.className = 'axc-b'; b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'axc-p');
    b.innerHTML = '<i>' + elaSVG() + '</i><span>Dr. Ela’ya sor</span>';
    var p = D.createElement('div'); p.className = 'axc-p'; p.id = 'axc-p'; p.hidden = true; p.setAttribute('role', 'region'); p.setAttribute('aria-label', 'Rehber hekim ipucu');
    p.innerHTML = '<div class="axc-u"><div class="axc-yz">' + elaSVG() + '</div><div><b>Uzm. Dr. Ela Altındağ</b><small>rehber hekim · her ipucu puandan düşer</small><div class="axc-k" aria-hidden="true"><span></span><span></span><span></span></div></div></div><p class="axc-t" aria-live="polite"></p><div class="axc-r"></div>';
    D.body.appendChild(b); D.body.appendChild(p);
    var S = { anahtar: null, kademe: 0, yaz: null };
    var t = p.querySelector('.axc-t'), r = p.querySelector('.axc-r');
    var soyle = function (metin) {
      clearInterval(S.yaz); p.classList.add('konus');
      var i = 0, bit = function () { clearInterval(S.yaz); t.textContent = metin; p.classList.remove('konus'); };
      if (RM) { bit(); return; }
      S.yaz = setInterval(function () { i += 2; t.innerHTML = X(metin.slice(0, i)) + '<span class="cur"></span>'; if (i >= metin.length) bit(); }, 18);
      t.onclick = bit;
    };
    var bildir = function (n) { try { W.parent.postMessage({ src: 'axmedica', type: 'ipucu', lab: o.lab, kademe: n, ceza: CEZA[n - 1] }, location.origin); } catch (e) {} };
    var dugmeler = function () {
      var k = S.kademe, ak = o.anahtar();
      Array.prototype.forEach.call(p.querySelectorAll('.axc-k span'), function (s, i) { s.classList.toggle('on', i < k); });
      r.innerHTML = (ak && k < 3 ? '<button type="button" class="pri" data-axc="ver">' + (o.etiket || ETIKET)[k] + ' (−' + CEZA[k] + ')</button>' : '') + '<button type="button" data-axc="kapat">' + (k ? 'Tamam, deneyeyim' : 'Kendim bulacağım') + '</button>';
    };
    var ac = function () {
      var ak = o.anahtar();
      if (ak !== S.anahtar) { S.anahtar = ak; S.kademe = 0; }
      p.hidden = false; b.setAttribute('aria-expanded', 'true');
      soyle(!ak ? 'Şu an çözmen gereken bir adım yok. Vakaya devam ettiğinde yanındayım.' : S.kademe ? 'Hâlâ takıldın mı? Bir kademe daha açabilirim.' : 'Ellerim steril, dokunamam ama yol gösterebilirim. Önce küçük bir ipucu vereyim mi? Her kademe puandan biraz düşer.');
      dugmeler();
      setTimeout(function () { var f = r.querySelector('button'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }, 40);
    };
    var kapat = function () { p.hidden = true; b.setAttribute('aria-expanded', 'false'); clearInterval(S.yaz); p.classList.remove('konus'); try { b.focus({ preventScroll: true }); } catch (e) {} };
    b.addEventListener('click', function () { if (p.hidden) ac(); else kapat(); });
    r.addEventListener('click', function (e) {
      var x = e.target.closest('[data-axc]'); if (!x) return;
      if (x.getAttribute('data-axc') === 'kapat') { kapat(); return; }
      if (o.anahtar() !== S.anahtar) { ac(); return; }
      var n = S.kademe + 1; x.disabled = true;
      Promise.resolve(o.kademe(n)).then(function (metin) { if (!metin) { dugmeler(); return; } S.kademe = n; bildir(n); soyle(metin); dugmeler(); });
    });
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !p.hidden) kapat(); });
    return { ac: ac, kapat: kapat, durum: S };
  };
  window.AXCERRAH = { kur: kur, CEZA: CEZA };
})();
