/* ==========================================================================
   ACADEX · İNGİLİZCE ARAYÜZ ÇEVİRİCİSİ (js/acadex-i18n.js), 30.10.2026
   Üstteki TR/EN seçici (i18n.js → applyLanguage) "en" olunca sayfadaki
   ARAYÜZ yazılarını (metin düğümleri, placeholder, title, aria-label, alt)
   js/i18n-en.js sözlüğüyle anında İngilizceye çevirir; JS'in sonradan
   çizdiği paneller MutationObserver ile yakalanır. "tr" seçilince her şey
   aslına döner (sayfa yenilenmez).

   ÇEVRİLMEYENLER (öğrencinin içeriği; hangi dilde üretildiyse öyle kalır):
   belge özetleri ve okuma ekranı içeriği, bilgi kartları, çalışma defteri,
   sınav soruları / sonuç kâğıdı / hata defteri maddeleri, Acadia sohbeti,
   bölüm akışı paylaşımları, belge adları. Bunlar CONTENT seçicileriyle ya da
   işaretlenmiş öğelerde [data-no-i18n] ile dışarıda bırakılır.

   Sözlük: AX_EN.t = { "türkçe": "english" }; sayılar {#} ile genellenir
   ("{#} gün kaldı" → "{#} days left"). AX_EN.h = biçim etiketli (b, i, em,
   strong, small, br, code, u) cümleler için innerHTML eşlemesi.
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = document;
  var DICT = W.AX_EN || { t: {}, h: {} };
  var T = DICT.t || {}, H = DICT.h || {};
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var cur = function () { return lsafe(function () { return localStorage.getItem('acadexUILang'); }, 'tr') === 'en' ? 'en' : 'tr'; };

  /* öğrencinin içeriği: çevrilmez */
  var CONTENT = [
    '[data-no-i18n]', '[contenteditable="true"]', '.katex', 'code', 'pre',
    /* belge okuma / özet */
    '.axr-prose', '.axr-pull blockquote', '.axr-kps', '.axr-term', '.axr-quiz', '.axr-sheet > h2', '.axr-figp', '.axr-fig figcaption b', '.axr-prob', '.axr-netbox', '.axr-netinfo', '.axr-toc-t', '#study-card-title',
    '.axr-md', '.ax-md', '.markdown-body', '#study-card-left-pane .section-content', '.sum-body', '#sourcehub-summary-text', '#sourcehub-points-container',
    /* bilgi kartları ve defter */
    '.kx-face', '.kx-q', '.kx-a', '.fc-q', '.fc-a', '.fc-front', '.fc-back', '.f-back .sm', '#flashcard-modal .flashcard', '.nb-page', '.nb-canvas', '#notebook-editor', '#notebook-overlay-container',
    /* sınav: soru, cevap, sonuç kâğıdı, hata defteri */
    '.sn-qtext', '.sn-opts', '.sn-dy', '.sn-paper .sn-ri .q', '.sn-eg .q', '.sn-eg .a b', '.sn-eg .a s', '.sn-eg h3', '.sn-mrow .nm b', '.sn-dname', '.sn-tk-b b',
    /* Acadia sohbeti ve akış */
    '#acadia-messages', '.axa-m', '.bp-lines', '.bp-fold', '.bp-note', '.axb-post-body', '.feed-post-content', '.post-content',
    /* belge adları */
    '.doc-name', '.file-name'
  ].join(',');
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, IFRAME: 1, CANVAS: 1, TEMPLATE: 1 };
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var INLINE = /^(B|I|EM|STRONG|SMALL|BR|CODE|U|S|SUB|SUP)$/;
  var NUM = /\d+(?:[.,:]\d+)*/g;
  var HAS_TR = /[A-Za-zÇĞİÖŞÜçğıöşü]/;

  var excluded = function (el) { return !!(el && el.closest && el.closest(CONTENT)); };

  /* {*} içeren anahtarlar düzenli ifadeye çevrilir (en uzun sabit kısım önce) */
  var esc = function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  var PAT = Object.keys(T).filter(function (k) { return k.indexOf('{*}') > -1; }).map(function (k) {
    var re = '^' + k.split(/(\{[#*]\})/).map(function (p) { return p === '{*}' ? '(.+?)' : p === '{#}' ? '(\\d+(?:[.,:]\\d+)*)' : esc(p); }).join('') + '$';
    return { re: new RegExp(re), v: T[k], n: k.replace(/\{[#*]\}/g, '').length };
  }).sort(function (a, b) { return b.n - a.n; });
  /* değerdeki {#}/{*} sırayla, {1}{2}… numarasıyla dolar; yakalanan parça sözlükteyse o da çevrilir */
  var fill = function (v, caps) {
    var i = 0;
    return v.replace(/\{(\d)\}|\{[#*]\}/g, function (m, d) { var c = d ? caps[+d - 1] : caps[i++]; c = c == null ? '' : c; return T[c] != null ? T[c] : c; });
  };
  /* "1 documents" → "1 document" */
  var SING = { documents: 'document', cards: 'card', questions: 'question', days: 'day', 'practice exams': 'practice exam', summaries: 'summary', slips: 'slip', weeks: 'week', months: 'month', hours: 'hour', concepts: 'concept', sections: 'section', mistakes: 'mistake', decks: 'deck', topics: 'topic', 'card decks': 'card deck', slides: 'slide', items: 'item', files: 'file', minutes: 'minute', seconds: 'second', points: 'point', notes: 'note', stops: 'stop', rounds: 'round', sessions: 'session', exams: 'exam', presentations: 'presentation' };
  var sing = function (s) { return s.replace(/(^|[^\d.,])1 (card decks|practice exams|[a-z]+)\b/g, function (m, a, w) { return SING[w] ? a + '1 ' + SING[w] : m; }); };
  /* metin → İngilizce (bulunamazsa null) */
  var look = function (k) {
    if (T[k] != null) return T[k];
    var nums = []; var tk = k.replace(NUM, function (m) { nums.push(m); return '{#}'; });
    if (nums.length && T[tk] != null) return fill(T[tk], nums);
    /* "a · b · c" parçaları ayrı ayrı */
    if (k.indexOf(' · ') > 0) {
      var ps = k.split(' · '), ok = true;
      var hit = 0, out = ps.map(function (p) { if (!HAS_TR.test(p) || /^[A-Z0-9 .,:%#+\-\/()&]+$/.test(p)) return p; var r = look(p); if (r != null) { hit++; return r; } if (!/[çğıöşüÇĞİÖŞÜ]/.test(p)) return p; ok = false; return p; });
      if (ok && hit) return out.join(' · ');
    }
    for (var i = 0; i < PAT.length; i++) { var m = PAT[i].re.exec(k); if (m) return fill(PAT[i].v, m.slice(1)); }
    /* kesme işareti biçimi: ’ ↔ ' */
    if (/[’']/.test(k)) { var k2 = k.indexOf('’') > -1 ? k.replace(/’/g, "'") : k.replace(/'/g, '’'); if (T[k2] != null) return T[k2]; }
    /* sondaki iki nokta / üç nokta / ünlem */
    var mm = k.match(/^(.*?)(\s*[:…!?.]+)$/);
    if (mm && mm[1] && T[mm[1]] != null) return T[mm[1]] + mm[2];
    return null;
  };
  var tr = function (s) {
    if (!s) return null;
    var k = s.replace(/\s+/g, ' ').trim();
    if (!k || !HAS_TR.test(k)) return null;
    var r = look(k); if (r == null) return null;
    r = sing(r);
    var a = s.match(/^\s*/)[0], b = s.match(/\s*$/)[0];
    return a + r + b;
  };
  W.axT = function (s) { return cur() === 'en' ? (tr(s) || s) : s; };   /* JS'ten kısa yol */

  /* değişiklik kaydı: TR'ye dönünce geri al */
  var log = [];
  var touch = function (rec) { log.push(rec); if (log.length > 20000) log = log.filter(function (r) { return r.n.isConnected; }); };

  var doText = function (n) {
    var p = n.parentNode; if (!p || p.nodeType !== 1 || SKIP[p.nodeName] || excluded(p)) return;
    if (n.__axEn != null && n.data === n.__axEn) return;
    var r = tr(n.data); if (r == null || r === n.data) return;
    touch({ n: n, v: n.data }); n.__axEn = r; n.data = r;
  };
  var doAttrs = function (el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a); if (!v) continue;
      var mk = '__axA_' + a; if (el[mk] === v) continue;
      var r = tr(v); if (r == null || r === v) continue;
      touch({ n: el, a: a, v: v }); el[mk] = r; el.setAttribute(a, r);
    }
  };
  /* biçim etiketli cümle: <p>… <b>…</b> …</p> (iç öğelerde öznitelik yoksa) */
  var doHtml = function (el) {
    if (el.__axH && el.innerHTML === el.__axH) return true;
    var kids = el.children; if (!kids.length) return false;
    for (var i = 0; i < kids.length; i++) if (!INLINE.test(kids[i].nodeName) || kids[i].attributes.length) return false;
    var k = el.innerHTML.replace(/\s+/g, ' ').trim(), r = H[k];
    if (r == null) { var nums = []; var tk = k.replace(NUM, function (m) { nums.push(m); return '{#}'; }); if (nums.length && H[tk] != null) r = fill(H[tk], nums); }
    if (r == null) return false;
    touch({ n: el, h: el.innerHTML }); el.innerHTML = r; el.__axH = el.innerHTML;
    return true;
  };
  var walk = function (root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    if (excluded(root)) return;
    if (root.nodeName === 'TEXTAREA') { doAttrs(root); return; }
    if (SKIP[root.nodeName]) return;
    doAttrs(root);
    if (doHtml(root)) return;
    var tw = D.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) { if ((SKIP[n.nodeName] && n.nodeName !== 'TEXTAREA') || n.matches(CONTENT)) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n, els = [], txt = [];
    while ((n = tw.nextNode())) { if (n.nodeType === 1) els.push(n); else txt.push(n); }
    var htmlDone = [];
    els.forEach(function (el) { doAttrs(el); if (Object.keys(H).length && doHtml(el)) htmlDone.push(el); });
    txt.forEach(function (t) { if (htmlDone.length && htmlDone.some(function (h) { return h.contains(t); })) return; doText(t); });
  };

  /* dinamik içerik */
  var queue = new Set(), raf = 0, obs = null;
  var flush = function () {
    raf = 0; var items = Array.from(queue); queue.clear();
    items.forEach(function (n) { if (!n.isConnected) return; try { walk(n); } catch (e) { if (!flush.err) { flush.err = 1; try { console.warn('acadex-i18n', e); } catch (x) {} } } });
    if (obs) obs.takeRecords();
    if (D.title) { var tt = tr(D.title); if (tt) { if (!D.__axTitle) D.__axTitle = D.title; D.title = tt; } }
  };
  var push = function (n) { queue.add(n); if (!raf) raf = requestAnimationFrame(flush); };
  var start = function () {
    walk(D.body); flush();
    if (obs) return;
    obs = new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') push(m.target);
        else if (m.type === 'attributes') push(m.target);
        else m.addedNodes.forEach(function (x) { push(x); });
      });
    });
    obs.observe(D.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  var stop = function () {
    if (obs) { obs.disconnect(); obs = null; }
    queue.clear();
    for (var i = log.length - 1; i >= 0; i--) {
      var r = log[i]; if (!r.n.isConnected) continue;
      if (r.h != null) { if (r.n.__axH === r.n.innerHTML) r.n.innerHTML = r.h; r.n.__axH = null; }
      else if (r.a) { if (r.n['__axA_' + r.a] === r.n.getAttribute(r.a)) r.n.setAttribute(r.a, r.v); r.n['__axA_' + r.a] = null; }
      else if (r.n.data === r.n.__axEn) { r.n.data = r.v; r.n.__axEn = null; }
    }
    log = [];
    if (D.__axTitle) { D.title = D.__axTitle; D.__axTitle = null; }
  };
  var sync = function () { if (cur() === 'en') start(); else stop(); };
  W.axI18nSync = sync;

  /* applyLanguage (i18n.js) her dil değişiminde bizi de çağırsın */
  var hook = function () {
    if (typeof W.applyLanguage !== 'function' || W.applyLanguage.__axI18n) return;
    var o = W.applyLanguage, w = function () { var r = o.apply(this, arguments); sync(); return r; };
    w.__axI18n = true; W.applyLanguage = w;
  };
  hook();
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', function () { hook(); sync(); });
  else sync();
  W.addEventListener('load', function () { hook(); });
  W.addEventListener('storage', function (e) { if (e.key === 'acadexUILang') sync(); });
})();
