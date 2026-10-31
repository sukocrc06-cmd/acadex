/* ==========================================================================
   ACADEX MEDICA · rehber cerrah ipucu (labs/medica/medica-cerrah.js), 31.10.2026
   Anatomi ve Fizyo Lab, Acadex Medica içinde (?medica=1) açıldığında yüklenir.
   Ameliyata hazır, maskeli rehber cerrah (Op. Dr. Kaan Arslan) köşede belirir ve üç
   kademede yardım eder: 1) sözel ipucu, 2) bölgeyi gösterir, 3) yapıyı gösterip adını söyler.
   Her kademe puandan düşer (5 / 10 / 20; labs/medica/medica-veri.js → IPUCU_CEZA ile aynı);
   kullanılan kademe hastaneye {src:'axmedica', type:'ipucu'} iletisiyle bildirilir.
   Platformda insan öğretmen yoktur: cerrah Acadex'in kendi kurgusal rehberidir.

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

  /* maskeli cerrah: bone, cerrahi maske (ağız kapalı), yeşil forma, steril eldivenli işaret eden el */
  var cerrahSVG = function () {
    return '<svg viewBox="0 0 120 132" aria-hidden="true">' +
      '<path d="M14 132 C16 104 34 92 60 92 C86 92 104 104 106 132 Z" fill="#3E9A86"/><path d="M48 92 L60 112 L72 92" fill="#2F7F6E"/>' +
      '<rect x="52" y="78" width="16" height="16" rx="5" fill="#E8B48A"/>' +
      '<ellipse cx="60" cy="56" rx="27" ry="30" fill="#E8B48A"/>' +
      '<path d="M32 50 C32 22 88 22 88 50 C80 40 40 40 32 50 Z" fill="#3E9A86"/><g fill="#2F7F6E" opacity=".55"><circle cx="46" cy="36" r="2.4"/><circle cx="60" cy="31" r="2.4"/><circle cx="74" cy="36" r="2.4"/><circle cx="53" cy="43" r="2"/><circle cx="67" cy="43" r="2"/></g>' +
      '<g class="axc-goz"><ellipse cx="50" cy="55" rx="3" ry="3.6" fill="#0D1838"/><ellipse cx="70" cy="55" rx="3" ry="3.6" fill="#0D1838"/></g>' +
      '<path d="M44 48 q6 -3 11 0 M65 48 q6 -3 11 0" stroke="#3A2A1E" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<g class="axc-maske"><path d="M35 62 h50 v12 c0 13 -50 13 -50 0 z" fill="#9FD8D0"/><path d="M38 67 h44 M38 72 h44 M40 77 h40" stroke="#7CC2B8" stroke-width="1.4"/><path d="M35 64 L30 58 M85 64 L90 58" stroke="#7CC2B8" stroke-width="1.6"/></g>' +
      '<g class="axc-el"><path d="M96 132 L102 98" stroke="#3E9A86" stroke-width="13" stroke-linecap="round"/><path d="M96 98 c-2 -8 4 -12 8 -10 c2 -6 9 -4 9 2 c0 6 -2 10 -6 12 z" fill="#8FC3EE"/><path d="M103 88 L104 72" stroke="#8FC3EE" stroke-width="5.5" stroke-linecap="round"/></g>' +
      '</svg>';
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
    '.axc-p.konus .axc-maske{animation:axc-m .3s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 0}',
    '@keyframes axc-m{to{transform:scaleY(1.08)}}',
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
    b.innerHTML = '<i>' + cerrahSVG() + '</i><span>Rehber cerraha sor</span>';
    var p = D.createElement('div'); p.className = 'axc-p'; p.id = 'axc-p'; p.hidden = true; p.setAttribute('role', 'region'); p.setAttribute('aria-label', 'Rehber cerrah ipucu');
    p.innerHTML = '<div class="axc-u"><div class="axc-yz">' + cerrahSVG() + '</div><div><b>Op. Dr. Kaan Arslan</b><small>rehber cerrah · her ipucu puandan düşer</small><div class="axc-k" aria-hidden="true"><span></span><span></span><span></span></div></div></div><p class="axc-t" aria-live="polite"></p><div class="axc-r"></div>';
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
