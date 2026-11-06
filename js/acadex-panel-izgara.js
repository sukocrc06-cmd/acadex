/* ==========================================================================
   ACADEX · SADE MENÜ + PANEL IZGARASI (06.11.2026)

   Neden: sol menü 15 satır + paket kartıyla kalabalıktı. Hiçbir panel kalkmadı:
   1) Menü: Bugün + Çalış · Laboratuvarlar · Belgeler · Ölç (+ Proje) grupları
      (dashboard.html → .ax-grp). Açık görünümün grubu kendiliğinden açılır, aynı anda
      tek grup açık; tek elemanlı grup (Ölç) doğrudan o paneli açar. Dar menüde (nav-c,
      geniş ekran) ve tanıtım turunda her şey eskisi gibi düz listelenir.
   2) Bugün sayfası: "bugünün tek işi" kartı kalktı (aynı iş üstteki karşılama
      alanında "Tekrara başla" olarak duruyor); yerinde logolu, üzerine gelince
      canlanan panel kartları. Kart menüdeki bağlantıyı tıklar: rol/görünürlük
      kuralları (gizli menü elemanı = gizli kart) ve dil çevirisi aynen geçerli.
   Stil: css/acadex-panel-izgara.css · Test: tests/panel-izgara.js
   ========================================================================== */
(function () {
  'use strict';
  if (window.__axPanelIzgara) return; window.__axPanelIzgara = true;
  var D = document, H = D.documentElement;
  var $ = function (s, r) { return (r || D).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };

  /* ---------------- 1 · menü grupları ---------------- */
  var gizli = function (li) { return !li || li.hidden || li.style.display === 'none'; };
  var gruplar = function () { return $$('.ax-side .ax-grp'); };
  var elemanlar = function (g) { return $$('.sidebar-item', g).filter(function (li) { return !li.classList.contains('ax-lab-more') && !gizli(li); }); };
  var ac = function (g, on) {
    g.classList.toggle('acik', !!on);
    var b = $('.ax-grp-b', g); if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
  };
  var sayac = function () {
    gruplar().forEach(function (g) {
      var n = elemanlar(g).length, s = $('.ax-grp-n', g);
      if (s) s.textContent = n ? String(n) : '';
      g.hidden = n === 0; g.classList.toggle('tek', n === 1);
    });
  };
  var sonAktif = null;
  var esitle = function () {
    var a = null;
    gruplar().forEach(function (g) { var on = !!$('.sidebar-item.active', g); g.classList.toggle('aktif', on); if (on) a = g; });
    /* görünüm değişince onun grubu açılır; kullanıcının açtığı başka grup, görünüm değişmedikçe açık kalır */
    if (a && a !== sonAktif) gruplar().forEach(function (g) { ac(g, g === a); });
    sonAktif = a;
  };
  var kurMenu = function () {
    if (!gruplar().length) return false;
    H.classList.add('ax-grp-on');
    gruplar().forEach(function (g) {
      var b = $('.ax-grp-b', g); if (!b || b.__ax) return; b.__ax = true;
      b.addEventListener('click', function () {
        var ls = elemanlar(g);
        if (ls.length === 1) { var a = $('a', ls[0]); if (a) a.click(); return; }
        var on = !g.classList.contains('acik');
        gruplar().forEach(function (x) { ac(x, x === g ? on : false); });
      });
    });
    sayac(); esitle();
    var nav = $('.ax-side nav') || $('.ax-side');
    var bekle = 0;
    new MutationObserver(function (ms) {
      if (!ms.some(function (m) { return m.type === 'childList' || (m.target.classList && m.target.classList.contains('sidebar-item')); })) return;
      clearTimeout(bekle); bekle = setTimeout(function () { sayac(); esitle(); }, 30);
    }).observe(nav, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    /* tanıtım turu menü elemanlarını tek tek gösterir: tur açıkken gruplar düz listelenir */
    var tur = function () { var o = D.getElementById('tour-overlay'); H.classList.toggle('ax-grp-hepsi', !!(o && o.classList.contains('active'))); };
    var izle = function () { var o = D.getElementById('tour-overlay'); if (o && !o.__axGrp) { o.__axGrp = true; new MutationObserver(tur).observe(o, { attributes: true, attributeFilter: ['class'] }); } tur(); };
    new MutationObserver(izle).observe(D.body, { childList: true }); izle();
    return true;
  };

  /* ---------------- 2 · Bugün: panel ızgarası ---------------- */
  var SVG = function (cls, body) { return '<svg class="' + cls + '" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' + body + '</svg>'; };
  var IKON = {
    planner: SVG('ic-plan', '<rect x="8" y="11" width="32" height="29" rx="4" fill="#fff"/><path d="M8 19 V15 C8 12.8 9.8 11 12 11 H36 C38.2 11 40 12.8 40 15 V19 Z" fill="#E5544A"/><g class="p hal"><path d="M16 7.5 V14 M32 7.5 V14"/></g><path class="chk" d="M17 29.5 L22 34.5 L32 24" stroke="#2F6BFF" stroke-width="2.6"/>'),
    notebook: SVG('ic-defter', '<rect x="10" y="7" width="25" height="34" rx="3" fill="#FFF7E0"/><path d="M10 13 H7.5 M10 20 H7.5 M10 27 H7.5 M10 34 H7.5"/><path d="M16 16 H29 M16 22 H29" stroke="#9AA6C4"/><path class="p sat" d="M16 28 H26" stroke="#2F6BFF"/><g class="p kalem"><path d="M33 33 L41 17 L44.5 18.8 L36.6 34.8 L32.6 36.6 Z" fill="#E8B53A"/><path d="M39.8 19.4 L43.2 21.2"/></g>'),
    cards: SVG('ic-kart', '<g class="p arka"><rect x="6" y="12" width="26" height="19" rx="3" fill="#E8EFFF" transform="rotate(-10 19 21.5)"/></g><g class="p on"><rect x="15" y="17" width="27" height="20" rx="3" fill="#fff"/><path d="M25.5 24.5 C25.5 22.6 27 21.5 28.6 21.5 C30.3 21.5 31.6 22.7 31.6 24.2 C31.6 26.6 28.6 26.6 28.6 29" stroke="#2F6BFF"/><circle cx="28.6" cy="32.3" r=".6" fill="#2F6BFF" stroke="#2F6BFF"/></g>'),
    sourcehub: SVG('ic-kaynak', '<path d="M24 14 C19 10.5 12.5 10 7 11.5 V36 C12.5 34.5 19 35 24 38.5 Z" fill="#fff"/><path d="M24 14 C29 10.5 35.5 10 41 11.5 V36 C35.5 34.5 29 35 24 38.5 Z" fill="#fff"/><path d="M11 17.5 C14.5 17 18 17.4 20.5 18.6 M11 23 C14.5 22.5 18 22.9 20.5 24.1" stroke="#9AA6C4"/><g class="p sayfa"><path d="M24 14 C28 11.6 32.5 11.2 36.5 12 V35 C32.5 34.4 28 34.9 24 37.5 Z" fill="#EEF3FF"/></g>'),
    acadia: SVG('ic-acadia', '<g class="p yil"><path d="M22 6 C23.4 15 26 17.6 35 19 C26 20.4 23.4 23 22 32 C20.6 23 18 20.4 9 19 C18 17.6 20.6 15 22 6 Z" fill="#E8B53A"/></g><g class="p kck"><path d="M36 28 C36.6 32 37.9 33.4 42 34 C37.9 34.6 36.6 36 36 40 C35.4 36 34.1 34.6 30 34 C34.1 33.4 35.4 32 36 28 Z" fill="#2F6BFF"/></g>'),
    studylab: SVG('ic-study', '<path d="M19 6 H29 M20.5 6 V17.5 L10 36.5 C8.9 38.6 10.4 41 12.8 41 H35.2 C37.6 41 39.1 38.6 38 36.5 L27.5 17.5 V6" fill="#fff"/><path d="M14.6 29 H33.4 L37.4 36.6 C38.2 38.2 37.1 39.6 35.4 39.6 H12.6 C10.9 39.6 9.8 38.2 10.6 36.6 Z" fill="#7FE0C2" stroke="none"/><circle class="p kab" cx="21" cy="30" r="1.8" fill="#fff"/><circle class="p kab k2" cx="27" cy="33" r="1.4" fill="#fff"/><circle class="p kab k3" cx="24" cy="31" r="1.1" fill="#fff"/>'),
    medlab: SVG('ic-med', '<g class="p kalp"><path d="M24 39 C14 32 7.5 26 7.5 18.5 C7.5 13.6 11.3 10 15.8 10 C19.4 10 22.2 12 24 15 C25.8 12 28.6 10 32.2 10 C36.7 10 40.5 13.6 40.5 18.5 C40.5 26 34 32 24 39 Z" fill="#FFE3E0" stroke="#E5544A"/></g><path class="ekg" d="M5 24 H15 L18 18 L22 30 L25.5 21 L28 24 H43" stroke="#1A2A5C" stroke-width="2.2"/>'),
    finans: SVG('ic-fin', '<path d="M7 40 H41"/><rect class="p bar" x="10" y="26" width="7" height="14" rx="1.5" fill="#BFD3FF"/><rect class="p bar b2" x="20.5" y="19" width="7" height="21" rx="1.5" fill="#2F6BFF"/><rect class="p bar b3" x="31" y="11" width="7" height="29" rx="1.5" fill="#E8B53A"/><path d="M9 20 L19 13 L26 16 L38 6.5 M33 6.5 H38 V11.5" stroke="#E5544A"/>'),
    docs: SVG('ic-belge', '<path d="M12 6 H28 L37 15 V42 H12 Z" fill="#fff"/><path d="M28 6 V15 H37" fill="#FFF4DC"/><path d="M17 22 H32 M17 27.5 H32 M17 33 H27" stroke="#9AA6C4"/><rect class="p tara" x="14" y="19" width="21" height="4" rx="2" fill="#2F6BFF" stroke="none" opacity=".0"/>'),
    feed: SVG('ic-akis', '<g class="p ks"><circle cx="13" cy="19" r="5" fill="#FFE3E0"/><path d="M5 36 C5 30.5 8.6 27 13 27 C15.4 27 17.4 28 18.8 29.6"/></g><g class="p ks s2"><circle cx="24" cy="15" r="6" fill="#E8EFFF"/><path d="M14.5 36 C14.5 29 18.8 24.5 24 24.5 C29.2 24.5 33.5 29 33.5 36"/></g><g class="p ks s3"><circle cx="35" cy="19" r="5" fill="#E7F8F1"/><path d="M29.2 29.6 C30.6 28 32.6 27 35 27 C39.4 27 43 30.5 43 36"/></g>'),
    acadexsunum: SVG('ic-sunum', '<rect x="6" y="8" width="36" height="24" rx="2.5" fill="#fff"/><path d="M24 32 V39 M17 42 L24 38.5 L31 42"/><rect class="p sb" x="13" y="20" width="5" height="8" rx="1" fill="#2F6BFF" stroke="none"/><rect class="p sb s2" x="21.5" y="14" width="5" height="14" rx="1" fill="#E8B53A" stroke="none"/><rect class="p sb" x="30" y="17" width="5" height="11" rx="1" fill="#E5544A" stroke="none"/>'),
    exams: SVG('ic-sinav', '<g class="p pano"><rect x="10" y="9" width="28" height="33" rx="3" fill="#fff"/><rect x="18" y="6" width="12" height="6" rx="2" fill="#FDE9E6"/><path class="chk" d="M15 21 L18 24 L23 18.5" stroke="#2F6BFF" stroke-width="2.4"/><path d="M26 21.5 H33" stroke="#9AA6C4"/><path class="chk c2" d="M15 31 L18 34 L23 28.5" stroke="#2F6BFF" stroke-width="2.4"/><path d="M26 31.5 H33" stroke="#9AA6C4"/></g>')
  };
  var PANEL = [
    { id: 'planner', g: 'calis', d: 'sınav ve hedef takvimin' },
    { id: 'notebook', g: 'calis', d: 'çiz, yaz, şablonla not al' },
    { id: 'cards', g: 'calis', d: 'aralıklı tekrarla çalış' },
    { id: 'sourcehub', g: 'calis', d: 'belgeyle yan yana çalış' },
    { id: 'acadia', g: 'calis', d: 'yapay zekâ çalışma asistanın' },
    { id: 'studylab', g: 'lab', d: 'etkileşimli laboratuvarlar' },
    { id: 'medlab', g: 'lab', d: 'eğitim hastanesi ve vakalar' },
    { id: 'finans', g: 'lab', d: 'şirket ve finans laboratuvarı' },
    { id: 'docs', g: 'belge', d: 'yükle, özetle, kartlaştır' },
    { id: 'feed', g: 'belge', d: 'bölümünün paylaştıkları' },
    { id: 'acadexsunum', g: 'belge', d: 'belgeden sunum hazırla' },
    { id: 'exams', g: 'olc', d: 'deneme sınavı ve puanlama' }
  ];
  var X = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ad = function (id) { var l = $('#side-' + id + ' .lbl'); return l ? l.textContent.trim() : id; };

  var izgara = null;
  var tazele = function () {
    if (!izgara) return;
    $$('.ax-pg-t', izgara).forEach(function (b) {
      var id = b.getAttribute('data-p'), li = D.getElementById('side-' + id), t = ad(id);
      if (b.__ad !== t) { $('b', b).textContent = t; b.__ad = t; }
      b.parentNode.hidden = !li || gizli(li);
    });
  };
  var kurIzgara = function () {
    var home = D.getElementById('home-view'), grid = home && $('.grid', home);
    if (!grid) return false;
    if (izgara && D.contains(izgara)) { tazele(); return true; }
    izgara = D.createElement('section'); izgara.className = 'ax-pg giris'; izgara.id = 'ax-pg'; izgara.setAttribute('aria-labelledby', 'ax-pg-k');
    izgara.innerHTML = '<div class="ax-pg-h"><h2 class="ax-pg-k" id="ax-pg-k">panellerin</h2><p class="ax-pg-s">hepsi burada; menüde gruplar hâlinde de duruyor</p></div>' +
      '<ul class="ax-pg-l">' + PANEL.map(function (p, i) {
        return '<li style="--i:' + i + '"><button type="button" class="ax-pg-t" data-p="' + p.id + '" data-g="' + p.g + '">' +
          '<span class="ax-pg-i">' + IKON[p.id] + '</span><b>' + X(ad(p.id)) + '</b><small>' + X(p.d) + '</small></button></li>';
      }).join('') + '</ul>';
    grid.parentNode.insertBefore(izgara, grid);
    izgara.addEventListener('click', function (e) {
      var b = e.target.closest('.ax-pg-t'); if (!b) return;
      var a = $('#side-' + b.getAttribute('data-p') + ' a'); if (a) a.click();
    });
    /* giriş animasyonu yalnız ilk görünüşte */
    setTimeout(function () { if (izgara) izgara.classList.remove('giris'); }, 1200);
    tazele();
    return true;
  };

  /* ---------------- başlat ---------------- */
  var bas = function () {
    kurMenu();
    var n = 0, dene = function () { if (!kurIzgara() && ++n < 40) setTimeout(dene, 250); };
    dene();
    /* menü elemanları sonradan gizlenip açılabilir (rol, bölüm): kartlar onu izler */
    var nav = $('.ax-side nav');
    if (nav) new MutationObserver(function () { tazele(); }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['style', 'hidden'], characterData: true, childList: true });
  };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', bas); else bas();
  window.AX_PANEL = { PANEL: PANEL, IKON: IKON, esitle: esitle, sayac: sayac, tazele: tazele };
})();
