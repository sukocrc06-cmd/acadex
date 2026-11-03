/* ==========================================================================
   ACADEX · KAYNAKLA ÇALIŞ — OKUMA MASASI (js/acadex-kaynak-masa.js + css/acadex-kaynak-masa.css), 03.11.2026
   Belge, özet ve Acadia sohbeti bir okuma masasında:
     - masa: ahşap yüzey, lamba ışığı, belgede panoya kıskaç, kenarda kalem ve fosforlu kalem
     - Acadia köşesi: gece göğü şeridinde yıldızlar parlar, başlıkta Acadia'nın kendisi oturur
       (kullanıcının stüdyoda seçtiği renk ve aksesuarlarla)
     - Acadia düşünürken: düşünen yüz, etrafında dönen yıldızlar, "düşünüyor" noktaları yıldız olur
     - cevap gelince: Acadia göz kırpar, balonun yanında küçük ışıltı; balonlar Acadia'nın rengiyle
   Sohbetin, özetin ve belgenin mantığı dashboard.js / acadex-ink.js'te; burada yalnızca sahne.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.getElementById('sourcehub-view');
  if (!root || !root.classList.contains('axy')) return;
  var D = document, W = window;
  var RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var K = function () { return W.AcadiaKit || null; };

  /* --- Acadia'nın rengi bütün sahneye --- */
  var paintColor = function () {
    var k = K(); if (!k) return;
    var st = k.style || {}, c = k.COLORS[st.renk] || k.COLORS.sari;
    root.style.setProperty('--ac', c.f); root.style.setProperty('--ac-ck', c.ck);
    root.classList.toggle('ky-ac-dark', !!c.glow);
  };
  paintColor();
  D.addEventListener('acadia:style', paintColor);

  /* --- masa ve nesneler --- */
  var desk = root.querySelector('[data-desk]'), chat = root.querySelector('.chat'), head = chat && chat.querySelector('.chat-h');
  if (desk) {
    desk.classList.add('ky-masa');
    var props = D.createElement('div'); props.className = 'ky-props'; props.setAttribute('aria-hidden', 'true');
    props.innerHTML = '<svg class="ky-pencil" viewBox="0 0 160 20"><path d="M10 4 H128 V16 H10 Z" fill="#FFC53D" stroke="#1A2A5C" stroke-width="1.4"/><path d="M128 4 L150 10 L128 16 Z" fill="#E9D9BE" stroke="#1A2A5C" stroke-width="1.4" stroke-linejoin="round"/><path d="M144 8.4 L150 10 L144 11.6 Z" fill="#1A2A5C"/><path d="M2 4 H10 V16 H2 Z" fill="#F4A7B9" stroke="#1A2A5C" stroke-width="1.4"/><path d="M10 10 H128" stroke="#E0A92A" stroke-width="1"/></svg>' +
      '<svg class="ky-marker" viewBox="0 0 120 26"><rect x="4" y="5" width="86" height="16" rx="4" fill="#2F6BFF" stroke="#1A2A5C" stroke-width="1.4"/><path d="M90 7 H104 L116 11 V15 L104 19 H90 Z" fill="#FFE27A" stroke="#1A2A5C" stroke-width="1.4" stroke-linejoin="round"/><rect x="14" y="9" width="40" height="3" rx="1.5" fill="rgba(255,255,255,.5)"/></svg>';
    desk.appendChild(props);
  }
  var pane = root.querySelector('#sourcehub-pdf-pane');
  if (pane && pane.parentNode) { var clip = D.createElement('i'); clip.className = 'ky-clip'; clip.setAttribute('aria-hidden', 'true'); pane.parentNode.insertBefore(clip, pane); }

  /* --- Acadia köşesi --- */
  var host = null;
  if (chat && head) {
    chat.classList.add('ky-acadia');
    var sky = D.createElement('div'); sky.className = 'ky-sky'; sky.setAttribute('aria-hidden', 'true');
    var s = ''; for (var i = 0; i < 14; i++) s += '<i style="left:' + ((i * 37) % 97 + 1) + '%;top:' + ((i * 53) % 70 + 10) + '%;--d:' + ((i * 0.37) % 3).toFixed(2) + 's;--z:' + (i % 3 ? 1 : 1.8) + '"></i>';
    sky.innerHTML = s;
    chat.insertBefore(sky, chat.firstChild);
    host = D.createElement('span'); host.className = 'ky-gz'; host.setAttribute('data-acadia', ''); host.setAttribute('aria-hidden', 'true');
    host.dataset.mood = 'mutlu'; host.dataset.pose = 'dur'; host.dataset.size = '58';
    var orbit = D.createElement('span'); orbit.className = 'ky-orbit'; orbit.setAttribute('aria-hidden', 'true'); orbit.innerHTML = '<i></i><i></i><i></i>';
    var wrap = D.createElement('span'); wrap.className = 'ky-gzw'; wrap.appendChild(host); wrap.appendChild(orbit);
    head.insertBefore(wrap, head.firstChild);
    if (K()) K().mount(head);
  }
  var think = root.querySelector('#sourcehub-chat-typing-indicator');
  if (think && !think.querySelector('.ky-stars')) think.insertAdjacentHTML('afterbegin', '<span class="ky-stars" aria-hidden="true"><i>★</i><i>★</i><i>★</i></span>');
  var thinking = false;
  var setThinking = function (on) {
    if (on === thinking || !host) return; thinking = on;
    chat.classList.toggle('ky-thinking', on);
    var k = K();
    if (on) { host.dataset.pose = 'dusun'; if (k) { host.__acdV = -1; k.setMood(host, 'dusunuyor'); } }
    else { host.dataset.pose = 'dur'; if (k) { host.__acdV = -1; k.setMood(host, null); k.react(host, 'kirp', 1200); } }
  };
  if (think && 'MutationObserver' in W) new MutationObserver(function () { setThinking(think.style.display !== 'none' && !think.hidden); }).observe(think, { attributes: true, attributeFilter: ['style', 'hidden'] });

  /* --- yeni Acadia cevabına küçük ışıltı --- */
  var feed = root.querySelector('[data-feed]');
  var sparkle = function (msg) {
    if (RM || !msg) return;
    var sp = D.createElement('span'); sp.className = 'ky-spark'; sp.setAttribute('aria-hidden', 'true'); sp.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
    msg.appendChild(sp); setTimeout(function () { sp.remove(); }, 1200);
  };
  if (feed && 'MutationObserver' in W) new MutationObserver(function (ms) {
    ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && n.classList.contains('msg') && n.classList.contains('ac')) { sparkle(n); if (host && !thinking && K()) K().react(host, 'mutlu', 1000); } }); });
  }).observe(feed, { childList: true });
  W.AXKaynakMasa = { setThinking: setThinking, paintColor: paintColor };
})();
