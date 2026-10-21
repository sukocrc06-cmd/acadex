/* ================= ACADEX · PAKETİM (panel) =================
   - Sol menünün altında "Paketim" köşesi: menü kenarına oturmuş, kitap okuyan öğrenci.
     Tıklayınca kitap açılır, paketler kitabın içinden çıkar.
   - Hak dolunca: window.acxQuotaHit({ feature: 'özet', used: 4, limit: 4 })
     ya da document.dispatchEvent(new CustomEvent('acx:quota', { detail: {...} }))
     → öğrenci yukarıdan tabelayla iner.
   Kendi stilini kendisi ekler; acadex-ink derlemesine dokunmaz. */
(function () {
  if (window.__acxPaket) return; window.__acxPaket = true;
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var X = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var css = [
    ':root{--pkd-side:#FBFBF8;--pkd-navy:#0D1838;--pkd-blue:#2F6BFF;--pkd-gold:#E8B53A;--pkd-soft:#6A7593;--pkd-ink:#1F2533;--pkd-paper:#FFFFFF;--pkd-cork:#EEF1F6;--pkd-line:#DCE2EE;--pkd-ease:cubic-bezier(.2,.7,.2,1)}',
    /* menü köşesi */
    '.pkd{position:sticky;bottom:-30px;z-index:3;margin:26px -14px -30px -16px;padding:46px 14px 14px 16px;background:linear-gradient(to bottom,rgba(251,251,248,0),var(--pkd-side) 38%)}',
    '.pkd-kid{position:absolute;right:20px;top:0;z-index:2;width:72px;height:76px;padding:0;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.pkd-kid:focus-visible{outline:2px solid var(--pkd-blue);outline-offset:3px;border-radius:12px}',
    '.pkd-kid svg{display:block;width:100%;height:100%;overflow:visible}',
    '.pkd-kid .leg{transform-box:fill-box;transform-origin:50% 0;animation:pkdLeg 2.2s ease-in-out infinite}',
    '.pkd-kid .leg.r{animation-delay:-1.1s}',
    '@keyframes pkdLeg{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(16deg)}}',
    '.pkd-kid .book{transition:transform .45s var(--pkd-ease)}',
    '.pkd-kid .pg{transform-box:fill-box;transform-origin:0 50%;animation:pkdPage 6s ease-in-out infinite}',
    '@keyframes pkdPage{0%,80%,100%{transform:scaleX(1)}88%{transform:scaleX(-1)}}',
    '.pkd-kid .wave{opacity:0;transform-box:fill-box;transform-origin:20% 90%;transition:opacity .2s}',
    '.pkd-kid:hover .book,.pkd-kid:focus-visible .book{transform:translateY(16px)}',
    '.pkd-kid:hover .wave,.pkd-kid:focus-visible .wave{opacity:1;animation:pkdWave .6s ease-in-out 2}',
    '@keyframes pkdWave{0%,100%{transform:rotate(0)}50%{transform:rotate(-24deg)}}',
    '.pkd-kid .lid{transform-box:fill-box;transform-origin:center;animation:pkdBlink 5s infinite}',
    '@keyframes pkdBlink{0%,93%,100%{transform:scaleY(0)}96%{transform:scaleY(1)}}',
    '.pkd-card{position:relative;padding:12px 12px 8px;border-radius:4px 6px 5px 4px;background:var(--pkd-paper);border:1.4px solid var(--pkd-line);box-shadow:0 10px 22px -16px rgba(13,24,56,.55);color:var(--pkd-ink)}',
    '.pkd-card h5{margin:0 0 6px;font-family:var(--hand,"Caveat",cursive);font-size:24px;font-weight:600;line-height:1;color:var(--pkd-ink)}',
    '.pkd-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;background:var(--pkd-navy);color:#F1F4FA;font-size:12.5px;font-weight:600}',
    '.pkd-badge i{width:7px;height:7px;border-radius:50%;background:var(--pkd-gold);box-shadow:0 0 0 3px rgba(232,181,58,.25)}',
    '.pkd-note{margin:6px 0 4px;font-size:12.5px;line-height:1.4;color:var(--pkd-soft)}',
    '.pkd-go{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0;border:0;background:none;color:var(--pkd-blue);font:inherit;font-size:14px;font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px}',
    '.pkd-go:focus-visible{outline:2px solid var(--pkd-blue);outline-offset:2px;border-radius:3px}',
    '.pkd-mini{display:none}',
    'html.ax-dark .pkd-kid svg,html.ax-dark .pkd-mini svg,html.ax-dark .pkq-kid{filter:invert(1) hue-rotate(180deg)}',
    'html.nav-c .pkd{margin:24px -10px -30px;padding:10px 0 14px}',
    'html.nav-c .pkd-kid,html.nav-c .pkd-card{display:none}',
    'html.nav-c .pkd-mini{display:flex;align-items:center;justify-content:center;width:48px;height:48px;margin:0 auto;padding:0;border:1.4px solid var(--pkd-line);border-radius:50%;background:var(--pkd-paper);cursor:pointer}',
    'html.nav-c .pkd-mini svg{width:36px;height:36px}',
    /* kitap → pano */
    '.pkd-veil{position:fixed;inset:0;z-index:2147483000;background:rgba(13,24,56,.5);opacity:0;visibility:hidden;transition:opacity .35s,visibility 0s linear .35s}',
    '.pkd-veil.on{opacity:1;visibility:visible;transition:opacity .35s}',
    '.pkd-book{position:fixed;left:50%;top:50%;z-index:2147483001;width:min(960px,calc(100vw - 24px));transform:translate(-50%,-50%);perspective:1800px;visibility:hidden}',
    '.pkd-book.on{visibility:visible}',
    '.pkd-sheet{position:relative;max-height:calc(100vh - 40px);max-height:calc(100dvh - 40px);overflow:auto;padding:22px 22px 18px;border-radius:4px 10px 10px 4px;background:var(--pkd-cork);color:var(--pkd-ink);box-shadow:0 40px 70px -24px rgba(0,0,0,.6),inset 14px 0 18px -14px rgba(13,24,56,.35);border-left:6px solid #16244F;overscroll-behavior:contain;opacity:0;transform:scale(.96);transition:opacity .35s .35s,transform .45s .3s var(--pkd-ease)}',
    '.pkd-book.on .pkd-sheet{opacity:1;transform:none}',
    '.pkd-cover{position:absolute;inset:0;z-index:3;border-radius:4px 10px 10px 4px;background:linear-gradient(135deg,#16244F,#0D1838);box-shadow:0 30px 60px -20px rgba(0,0,0,.6);transform-origin:0 50%;backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#F1F4FA;pointer-events:none}',
    '.pkd-cover b{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:clamp(28px,4vw,44px);letter-spacing:-.02em}',
    '.pkd-cover span{font-family:var(--hand,"Caveat",cursive);font-size:24px;color:var(--pkd-gold)}',
    '.pkd-cover::after{content:"";position:absolute;inset:14px;border:1.5px solid rgba(232,181,58,.45);border-radius:3px 8px 8px 3px}',
    '.pkd-book.on .pkd-cover{animation:pkdOpen 1.05s .1s var(--pkd-ease) both}',
    '.pkd-book.off{visibility:visible}.pkd-book.off .pkd-sheet{opacity:0;transform:scale(.96);transition:opacity .25s,transform .25s}',
    '.pkd-book.off .pkd-cover{animation:pkdShut .55s var(--pkd-ease) both}',
    '@keyframes pkdOpen{0%{transform:rotateY(0)}100%{transform:rotateY(-172deg);opacity:0}}',
    '@keyframes pkdShut{0%{transform:rotateY(-172deg);opacity:0}40%{opacity:1}100%{transform:rotateY(0);opacity:0}}',
    '.pkd-x{position:absolute;right:10px;top:8px;width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:var(--pkd-ink);font-size:28px;line-height:1;cursor:pointer}',
    '.pkd-x:hover{background:rgba(13,24,56,.08)}',
    '.pkd-x:focus-visible{outline:2px solid var(--pkd-blue);outline-offset:1px}',
    '.pkd-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:6px 16px;margin:0 46px 14px 0}',
    '.pkd-head h2{margin:0;font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:clamp(24px,3vw,32px);letter-spacing:-.02em;color:var(--pkd-ink)}',
    '.pkd-head p{margin:0;font-family:var(--hand,"Caveat",cursive);font-size:22px;color:var(--pkd-soft)}',
    '.pkd-beta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:0 0 16px;padding:10px 14px;border-radius:4px;background:var(--pkd-navy);color:#F1F4FA;font-size:14.5px;line-height:1.4}',
    '.pkd-beta b{color:var(--pkd-gold)}',
    '.pkd-beta .tag{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.12em;padding:3px 8px;border-radius:3px;background:var(--pkd-gold);color:var(--pkd-navy)}',
    '.pkd-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}',
    '.pkd-c{position:relative;padding:20px 18px 16px;background:var(--pkd-paper);border-radius:3px;box-shadow:0 14px 26px -18px rgba(13,24,56,.6);transform:rotate(var(--r,0deg))}',
    '.pkd-c::before{content:"";position:absolute;left:50%;top:-9px;width:74px;height:18px;margin-left:-37px;background:rgba(232,181,58,.55);transform:rotate(-2deg)}',
    '.pkd-c:nth-child(1){--r:-.6deg}.pkd-c:nth-child(2){--r:.4deg}.pkd-c:nth-child(3){--r:-.3deg}',
    '.pkd-c.cur{outline:2.5px solid var(--pkd-blue);outline-offset:-2.5px}',
    '.pkd-c .rib{position:absolute;right:12px;top:12px;font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:.1em;padding:3px 7px;border-radius:3px;background:var(--pkd-blue);color:#fff}',
    '.pkd-c h3{margin:0 0 2px;font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:22px;color:var(--pkd-ink)}',
    '.pkd-c .who{margin:0 0 10px;font-size:13.5px;color:var(--pkd-soft)}',
    '.pkd-price{display:flex;align-items:baseline;gap:6px;margin:0 0 2px}',
    '.pkd-price b{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:32px;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--pkd-ink)}',
    '.pkd-price span{font-size:14px;color:var(--pkd-soft)}',
    '.pkd-alt{margin:0 0 12px;min-height:18px;font-size:12.5px;color:var(--pkd-soft)}',
    '.pkd-c ul{list-style:none;margin:0;padding:12px 0 0;border-top:1px dashed var(--pkd-line);display:grid;gap:7px}',
    '.pkd-c li{position:relative;padding-left:22px;font-size:14px;line-height:1.35}',
    '.pkd-c li::before{content:"";position:absolute;left:2px;top:4px;width:11px;height:6px;border-left:2.5px solid var(--pkd-blue);border-bottom:2.5px solid var(--pkd-blue);transform:rotate(-45deg)}',
    '.pkd-c li.no{color:#9AA3B8}',
    '.pkd-c li.no::before{width:10px;height:0;top:8px;border-left:0;border-bottom:2px solid #C3CADB;transform:none}',
    '.pkd-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-top:18px}',
    '.pkd-foot small{font-size:12.5px;color:var(--pkd-soft);max-width:540px}',
    '.pkd-ok{display:inline-flex;align-items:center;min-height:46px;padding:0 22px;border:0;border-radius:999px;background:var(--pkd-navy);color:#fff;font:inherit;font-weight:600;font-size:15px;cursor:pointer}',
    '.pkd-ok:focus-visible{outline:2px solid var(--pkd-blue);outline-offset:3px}',
    /* hak doldu: tabelayla inen öğrenci */
    '.pkq{position:fixed;left:50%;top:0;z-index:2147482990;width:min(420px,calc(100vw - 24px));transform:translate(-50%,-110%);visibility:hidden}',
    '.pkq.on{visibility:visible;animation:pkqDrop 1s var(--pkd-ease) both}',
    '.pkq.off{visibility:visible;animation:pkqUp .45s cubic-bezier(.6,0,.8,.4) both}',
    '@keyframes pkqDrop{0%{transform:translate(-50%,-110%) rotate(0)}55%{transform:translate(-50%,0) rotate(-2.4deg)}72%{transform:translate(-50%,0) rotate(1.4deg)}86%{transform:translate(-50%,0) rotate(-.6deg)}100%{transform:translate(-50%,0)}}',
    '@keyframes pkqUp{0%{transform:translate(-50%,0)}100%{transform:translate(-50%,-115%)}}',
    '.pkq::before,.pkq::after{content:"";position:absolute;top:-100vh;width:3px;height:calc(100vh + 96px);background:repeating-linear-gradient(170deg,#C9A36A 0 4px,#9C7A45 4px 7px)}',
    '.pkq::before{left:22%}.pkq::after{right:22%}',
    '.pkq-kid{display:block;width:104px;height:92px;margin:56px auto -14px;position:relative;z-index:2}',
    '.pkq-sign{position:relative;padding:18px 18px 14px;border-radius:6px;background:var(--pkd-paper);color:var(--pkd-ink);border-top:6px solid var(--pkd-gold);box-shadow:0 30px 50px -20px rgba(0,0,0,.55);text-align:center}',
    '.pkq-sign h3{margin:0 0 6px;font-family:var(--hand,"Caveat",cursive);font-size:28px;font-weight:600;line-height:1.05}',
    '.pkq-sign p{margin:0 0 14px;font-size:14px;line-height:1.45;color:var(--pkd-soft)}',
    '.pkq-btns{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}',
    '.pkq-btns button{min-height:42px;padding:0 16px;border-radius:999px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;border:1.5px solid var(--pkd-line);background:transparent;color:var(--pkd-ink)}',
    '.pkq-btns .pri{border-color:transparent;background:var(--pkd-blue);color:#fff}',
    '.pkq-btns button:disabled{opacity:.55;cursor:not-allowed}',
    '.pkq-btns button:focus-visible{outline:2px solid var(--pkd-blue);outline-offset:2px}',
    '@media (max-width:760px){.pkd-cards{grid-template-columns:1fr}.pkd-c{transform:none}.pkd-sheet{padding:18px 16px 16px}}',
    '@media (prefers-reduced-motion:reduce){.pkd-kid .leg,.pkd-kid .pg,.pkd-kid .lid,.pkd-kid:hover .wave{animation:none}.pkd-book.on .pkd-cover,.pkd-book.off .pkd-cover{animation:none;opacity:0}.pkq.on,.pkq.off{animation:none;transform:translate(-50%,0)}.pkq.off{visibility:hidden}.pkd-sheet{transition:opacity .15s}}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'pkd-css'; st.textContent = css; document.head.appendChild(st);

  /* oturan, kitap okuyan öğrenci */
  var KID = '<svg viewBox="0 0 92 96" aria-hidden="true">' +
    '<g class="leg l"><path d="M34 70 L30 92" stroke="#16244F" stroke-width="9" stroke-linecap="round"/><ellipse cx="29" cy="94" rx="8" ry="4.5" fill="#E8B53A"/></g>' +
    '<g class="leg r"><path d="M52 70 L56 92" stroke="#16244F" stroke-width="9" stroke-linecap="round"/><ellipse cx="57" cy="94" rx="8" ry="4.5" fill="#E8B53A"/></g>' +
    '<path d="M24 72 C22 56 32 46 44 46 C56 46 66 56 64 72 Z" fill="#2F6BFF"/>' +
    '<path d="M36 47 L44 56 L52 47" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"/>' +
    '<ellipse cx="44" cy="28" rx="19" ry="18" fill="#F2C7A1"/>' +
    '<path d="M25 27 C24 15 33 10 44 10 C55 10 63 15 63 25 C58 20 52 19 46 21 C38 24 31 23 25 27 Z" fill="#2A2F45"/>' +
    '<path d="M18 13 L44 4 L70 13 L44 21 Z" fill="#0D1838"/><path d="M28 16 L28 21 C35 24 53 24 60 21 L60 16 L44 21 Z" fill="#16244F"/>' +
    '<circle cx="44" cy="12.5" r="2.2" fill="#E8B53A"/><path d="M44 12.5 C54 13 62 15 66 18 L66 30" fill="none" stroke="#E8B53A" stroke-width="1.8" stroke-linecap="round"/>' +
    '<ellipse cx="37" cy="30" rx="4.6" ry="5.2" fill="#FFFFFF"/><ellipse cx="51" cy="30" rx="4.6" ry="5.2" fill="#FFFFFF"/>' +
    '<circle cx="37.6" cy="32" r="2.5" fill="#1F2533"/><circle cx="51.6" cy="32" r="2.5" fill="#1F2533"/>' +
    '<ellipse class="lid" cx="37" cy="30" rx="5" ry="5.6" fill="#E3B48C"/><ellipse class="lid" cx="51" cy="30" rx="5" ry="5.6" fill="#E3B48C"/>' +
    '<path d="M39 38 q5 4 10 0" fill="none" stroke="#7A3B2E" stroke-width="2" stroke-linecap="round"/>' +
    '<g class="wave"><path d="M64 52 C72 44 76 36 78 28" stroke="#2F6BFF" stroke-width="8" stroke-linecap="round" fill="none"/><circle cx="78" cy="25" r="5.5" fill="#F2C7A1"/></g>' +
    '<g class="book"><path d="M22 44 L44 48 L66 44 L66 64 L44 68 L22 64 Z" fill="#E8B53A"/><path d="M24 45.5 L43 49 L43 66 L24 62.5 Z" fill="#FFFDF5"/><path class="pg" d="M45 49 L64 45.5 L64 62.5 L45 66 Z" fill="#FFFFFF"/>' +
    '<path d="M27 50 l13 2.4 M27 54 l13 2.4 M27 58 l10 1.8" stroke="#C9D3E8" stroke-width="1.3" stroke-linecap="round"/>' +
    '<ellipse cx="24" cy="56" rx="5" ry="4.5" fill="#F2C7A1"/><ellipse cx="64" cy="56" rx="5" ry="4.5" fill="#F2C7A1"/></g>' +
    '</svg>';

  var CARDS = '<div class="pkd-cards">' +
    '<article class="pkd-c"><h3>Ücretsiz</h3><p class="who">denemek ve ara sıra çalışmak için</p><p class="pkd-price"><b>0 TL</b><span>her zaman</span></p><p class="pkd-alt">kredi kartı gerekmez</p><ul>' +
      '<li>Ayda <b>4</b> belge özeti (25 sayfaya kadar)</li><li>Ayda <b>150</b> Acadia mesajı (günde en fazla 10)</li><li>Ayda <b>3</b> sunum, 1’i web araştırmalı</li><li>Ayda <b>4</b> sınav</li><li>Kaynak gösterme ve doğrulama</li><li>Bilgi kartları, planlayıcı, defter: sınırsız</li><li class="no">Prova koçunun Acadia yorumu</li></ul></article>' +
    '<article class="pkd-c"><h3>Lite</h3><p class="who">düzenli ders çalışanlar için</p><p class="pkd-price"><b>119 TL</b><span>/ ay</span></p><p class="pkd-alt">dönemlik 419 TL · yıllık 1.069 TL</p><ul>' +
      '<li>Ayda <b>20</b> belge özeti (60 sayfaya kadar)</li><li>Ayda <b>600</b> Acadia mesajı</li><li>Ayda <b>15</b> sunum, 10’u web araştırmalı</li><li>Ayda <b>20</b> sınav</li><li>Prova koçu + ayda 5 Acadia yorumu</li><li>Notsuz PDF ve PowerPoint, sınırsız paylaşım</li><li><b>2 GB</b> dosya alanı</li></ul></article>' +
    '<article class="pkd-c cur"><span class="rib">ŞU AN SENDE</span><h3>Premium</h3><p class="who">yoğun dönem, proje ve tez için</p><p class="pkd-price"><b>229 TL</b><span>/ ay</span></p><p class="pkd-alt">dönemlik 799 TL · yıllık 2.049 TL</p><ul>' +
      '<li>Ayda <b>50</b> belge özeti (150 sayfaya kadar)</li><li>Ayda <b>900</b> Acadia mesajı</li><li>Ayda <b>40</b> sunum, 25’i web araştırmalı</li><li>Ayda <b>60</b> sınav</li><li>Ayda <b>30</b> prova yorumu</li><li>Sınav haftasında <b>öncelikli sıra</b></li><li><b>10 GB</b> dosya alanı</li></ul></article>' +
    '</div>';

  var veil = document.createElement('div'); veil.className = 'pkd-veil';
  var book = document.createElement('div'); book.className = 'pkd-book'; book.setAttribute('role', 'dialog'); book.setAttribute('aria-modal', 'true'); book.setAttribute('aria-labelledby', 'pkd-t'); book.hidden = true;
  book.innerHTML = '<div class="pkd-cover" aria-hidden="true"><b>Acadex paketleri</b><span>sayfayı aç, sana uyanı gör</span></div>' +
    '<div class="pkd-sheet"><button type="button" class="pkd-x" aria-label="Paketleri kapat">×</button>' +
    '<div class="pkd-head"><h2 id="pkd-t">Acadex paketleri</h2><p>beta boyunca hepsi sende</p></div>' +
    '<p class="pkd-beta"><span class="tag">BETA</span><span>Beta boyunca <b>Premium’u ücretsiz</b> kullanıyorsun. Beta’da olan kurucu üyelere lansmanda <b>%50 indirim</b>.</span></p>' +
    CARDS +
    '<div class="pkd-foot"><small>Fiyatlar KDV dahildir ve lansmanda kesinleşir. Sınav haftası için 7 günlük Premium: 59 TL.</small><button type="button" class="pkd-ok">Tamam</button></div></div>';

  var open = false, lastFocus = null;
  var focusables = function (root) { return Array.prototype.slice.call(root.querySelectorAll('a[href],button:not([disabled])')).filter(function (x) { return x.offsetParent !== null; }); };
  var openBook = function () {
    if (open) return; closeQuota(true); open = true; lastFocus = document.activeElement;
    book.hidden = false; book.classList.remove('off'); void book.offsetWidth; book.classList.add('on'); veil.classList.add('on');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(function () { var x = book.querySelector('.pkd-x'); if (x) x.focus({ preventScroll: true }); }, calm ? 0 : 500);
  };
  var closeBook = function () {
    if (!open) return; open = false; veil.classList.remove('on'); book.classList.remove('on'); book.classList.add('off');
    document.documentElement.style.overflow = '';
    setTimeout(function () { if (!open) { book.hidden = true; book.classList.remove('off'); } }, calm ? 0 : 560);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  };
  window.acxOpenPlans = openBook;

  /* hak doldu */
  var q = document.createElement('div'); q.className = 'pkq'; q.setAttribute('role', 'alertdialog'); q.setAttribute('aria-labelledby', 'pkq-t'); q.setAttribute('aria-describedby', 'pkq-d'); q.hidden = true;
  var qOpen = false, qFocus = null;
  var closeQuota = function (fast) {
    if (!qOpen) return; qOpen = false; q.classList.remove('on');
    if (fast || calm) { q.hidden = true; q.classList.remove('off'); }
    else { q.classList.add('off'); setTimeout(function () { if (!qOpen) { q.hidden = true; q.classList.remove('off'); } }, 470); }
    if (!fast && qFocus && document.contains(qFocus)) qFocus.focus({ preventScroll: true });
  };
  window.acxQuotaHit = function (o) {
    o = o || {}; var f = o.feature || 'bu özellik', lim = o.limit, used = o.used;
    q.innerHTML = '<svg class="pkq-kid" viewBox="0 0 92 80" aria-hidden="true">' +
      '<path d="M24 72 C22 56 32 46 44 46 C56 46 66 56 64 72 Z" fill="#2F6BFF"/><ellipse cx="44" cy="28" rx="19" ry="18" fill="#F2C7A1"/>' +
      '<path d="M25 27 C24 15 33 10 44 10 C55 10 63 15 63 25 C58 20 52 19 46 21 C38 24 31 23 25 27 Z" fill="#2A2F45"/><path d="M18 13 L44 4 L70 13 L44 21 Z" fill="#0D1838"/><path d="M28 16 L28 21 C35 24 53 24 60 21 L60 16 L44 21 Z" fill="#16244F"/>' +
      '<ellipse cx="37" cy="30" rx="4.6" ry="5.2" fill="#FFFFFF"/><ellipse cx="51" cy="30" rx="4.6" ry="5.2" fill="#FFFFFF"/><circle cx="37" cy="31" r="2.5" fill="#1F2533"/><circle cx="51" cy="31" r="2.5" fill="#1F2533"/>' +
      '<path d="M32 22 l8 3 M56 22 l-8 3" stroke="#2A2F45" stroke-width="2" stroke-linecap="round"/><path d="M39 40 q5 -3 10 0" fill="none" stroke="#7A3B2E" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M24 62 C14 58 10 66 12 76 M64 62 C74 58 78 66 76 76" stroke="#2F6BFF" stroke-width="8" stroke-linecap="round" fill="none"/>' +
      '</svg><div class="pkq-sign"><h3 id="pkq-t">Bu ayki ' + X(f) + ' hakkın doldu' + (lim ? ' (' + X(used != null ? used : lim) + '/' + X(lim) + ')' : '') + '</h3>' +
      '<p id="pkq-d">' + X(o.message || 'Ay başında hakların yenilenir. Hemen devam etmek istersen bir üst pakete geçebilir ya da sınav haftası için 7 günlük Premium alabilirsin.') + '</p>' +
      '<div class="pkq-btns"><button type="button" class="pri" data-pkq-plans="">Paketleri gör</button><button type="button" data-pkq-week="" disabled title="Ödeme sistemi yakında açılıyor">7 günlük Premium · 59 TL (yakında)</button><button type="button" data-pkq-x="">Tamam</button></div></div>';
    qFocus = document.activeElement; q.hidden = false; q.classList.remove('off'); void q.offsetWidth; q.classList.add('on'); qOpen = true;
    setTimeout(function () { var b = q.querySelector('[data-pkq-plans]'); if (b) b.focus({ preventScroll: true }); }, calm ? 0 : 600);
  };
  document.addEventListener('acx:quota', function (e) { window.acxQuotaHit(e.detail || {}); });
  q.addEventListener('click', function (e) {
    if (e.target.closest('[data-pkq-plans]')) { closeQuota(true); openBook(); }
    else if (e.target.closest('[data-pkq-x]')) closeQuota();
  });

  /* menü köşesi */
  var mount = function () {
    var side = document.getElementById('nav-menu'); if (!side || side.querySelector('.pkd')) return;
    var box = document.createElement('div'); box.className = 'pkd';
    box.innerHTML = '<button type="button" class="pkd-kid" aria-label="Paketleri aç" title="Paketleri aç">' + KID + '</button>' +
      '<div class="pkd-card"><h5>Paketim</h5><span class="pkd-badge"><i aria-hidden="true"></i>Beta · Premium</span>' +
      '<p class="pkd-note">Beta’da her şey açık · kurucu üyelere %50</p>' +
      '<button type="button" class="pkd-go">paketleri gör <span aria-hidden="true">→</span></button></div>' +
      '<button type="button" class="pkd-mini" aria-label="Paketim: Beta · Premium. Paketleri aç" title="Paketim · Beta Premium">' + KID + '</button>';
    (side.querySelector('nav') || side).appendChild(box);
    box.addEventListener('click', function (e) { if (e.target.closest('.pkd-kid,.pkd-go,.pkd-mini')) openBook(); });
  };

  var start = function () {
    document.body.appendChild(veil); document.body.appendChild(book); document.body.appendChild(q);
    mount();
    veil.addEventListener('click', closeBook);
    book.addEventListener('click', function (e) { if (e.target.closest('.pkd-x,.pkd-ok')) closeBook(); });
    document.addEventListener('keydown', function (e) {
      var root = open ? book : qOpen ? q : null; if (!root) return;
      if (e.key === 'Escape') { e.preventDefault(); open ? closeBook() : closeQuota(); return; }
      if (e.key === 'Tab') { var f = focusables(root), a = f.indexOf(document.activeElement); if (!f.length) return; if (e.shiftKey && a <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && a === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    });
    if (location.hash === '#paketler') setTimeout(openBook, 600);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
