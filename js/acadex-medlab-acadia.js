/* ================= ACADEX MEDLAB × ACADIA: tek Acadia, lab köprüsü (27.10.2026) ================= */
/* Sorun: MedLab'de Anatomi/Fizyo Lab iframe'de açılınca labın kendi Acadia'sı ile sitenin
   Acadia'sı (dashboard.html → #acadia-widget-container) aynı anda görünüyordu.
   Çözüm:
     - Lab ?medlab=1 ile açılır ve kendi Acadia'sını gizler (labs/<ad>/index.html → "MedLab köprüsü").
     - Lab seçili yapıyı, kart satırlarını, hazır soruları ve spot durumunu postMessage ile yollar.
     - Sitenin Acadia'sı bağlam etiketinde "Anatomi Lab · <yapı>" gösterir, hazır soruları çip olarak sunar.
       Kart bilgisinden cevaplanabilen soru labda cevaplanır (model de ışıklanır); gerisi yapay zekâya
       kart bilgisi bağlam olarak eklenerek gider (window.axAcadiaPrefix → dashboard.js sendAcadiaMessage).
     - Spot sınav sürerken Acadia susar (düğme ve panel gizlenir); bitince karne yorumlanır.
     - Lab sohbeti her lab için ayrı saklanır (localStorage), panelin genel sohbeti lab kapanınca geri gelir.
   Lab mesajları yalnızca aynı kaynaktan ve MedLab iframe'inden kabul edilir. */
(function () {
  'use strict';
  var W = window, D = document;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var NAMES = { anatomi: 'Anatomi Lab', fizyo: 'Fizyo Lab', odyoloji: 'Odyoloji Lab', diyet: 'Diyet Lab', dkt: 'DKT Lab', finans: 'Acadex Finans', sirket: 'Acadex Şirket' };
  var KITLE = { odyoloji: 'odyoloji/sağlık bilimleri öğrencisine', diyet: 'beslenme ve diyetetik öğrencisine', dkt: 'dil ve konuşma terapisi öğrencisine', finans: 'işletme, iktisat, muhasebe ve uluslararası ticaret öğrencisine', sirket: 'işletme ve yönetim öğrencisine' };   /* about yollayan lablar */
  var KEY = function (k) { return 'acadex.labchat.' + k; };
  var MAX = 40;
  var $ = function (id) { return D.getElementById(id); };

  var lab = null, frame = null, ctx = null, saved = null, wait = {}, acks = {}, seq = 0, spotOn = false;

  /* dashboard.js'teki küresel sohbet durumu (let ile tanımlı; aynı küresel kapsamda erişilir) */
  var hist = function (v) { if (v !== undefined) { lsafe(function () { acadiaChatHistory = v; }); } return lsafe(function () { return acadiaChatHistory; }, []); };
  var greeted = function (v) { if (v !== undefined) { lsafe(function () { acadiaHasGreeted = v; }); } return lsafe(function () { return acadiaHasGreeted; }, false); };

  var store = {
    get: function (k) { return lsafe(function () { var a = JSON.parse(localStorage.getItem(KEY(k)) || '[]'); return Array.isArray(a) ? a : []; }, []); },
    set: function (k, a) { lsafe(function () { localStorage.setItem(KEY(k), JSON.stringify(a.slice(-MAX))); }); },
    del: function (k) { lsafe(function () { localStorage.removeItem(KEY(k)); }); }
  };
  /* sohbetin lab kaydı: {role, content, show?, spot?} — show/spot lab çiplerini geri kurmak için */
  var log = [];
  var save = function () { if (lab) store.set(lab, log); };

  var post = function (m) { if (!frame || !frame.contentWindow) return; m.src = 'axhost'; lsafe(function () { frame.contentWindow.postMessage(m, location.origin); }); };

  /* ---------- görünüm ---------- */
  var chipsBox = function () {
    var b = $('acadia-lab-chips'); if (b) return b;
    var pick = $('acadia-card-picker'); if (!pick || !pick.parentNode) return null;
    b = D.createElement('div'); b.id = 'acadia-lab-chips'; b.className = 'axl-chips'; b.hidden = true;
    pick.parentNode.insertBefore(b, pick.nextSibling);
    b.addEventListener('click', function (e) {
      var c = e.target.closest && e.target.closest('[data-axl-q]'); if (!c) return;
      askChip(c.getAttribute('data-axl-q'), c.textContent);
    });
    return b;
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var labelOrig = null, pickBtnWas = null;
  var setLabel = function () {
    var l = $('acadia-context-label'), btn = $('btn-acadia-select-card'); if (!l) return;
    if (!lab) {
      if (labelOrig !== null) l.textContent = labelOrig; labelOrig = null;
      if (btn && pickBtnWas !== null) { btn.disabled = pickBtnWas; btn.classList.remove('axl-ctx'); } pickBtnWas = null;
      return;
    }
    if (labelOrig === null) labelOrig = l.textContent;
    if (btn && pickBtnWas === null) { pickBtnWas = !!btn.disabled; btn.disabled = true; btn.classList.add('axl-ctx'); }
    var t = NAMES[lab] + ' · ';
    l.textContent = '🧪 ' + t + (spotOn ? 'spot sınav sürüyor' : ctx && ctx.sel ? ctx.sel.title : 'modelden bir yapı seç');
  };
  var renderChips = function () {
    var b = chipsBox(); if (!b) return;
    var list = lab && !spotOn && ctx && ctx.chips ? ctx.chips : [];
    b.hidden = !list.length;
    b.innerHTML = list.map(function (c) { return '<button type="button" data-axl-q="' + esc(c[0]) + '"' + (c[0] === 'tour' ? ' class="axl-tour"' : '') + '>' + esc(c[1]) + '</button>'; }).join('');
  };
  var setSpot = function (on) {
    spotOn = !!on;
    D.body.classList.toggle('axl-spot', spotOn);
    if (spotOn) lsafe(function () { toggleAcadiaPanel(false); });
  };
  /* lab cevabının altına modelde göster / spot çipleri */
  var addLabChips = function (m) {
    var box = $('acadia-messages'); if (!box || !box.lastElementChild) return;
    var show = m.show || [], items = show.map(function (s) { return '<button type="button" data-axl-show="' + esc(s.n) + '">' + esc(s.t) + '</button>'; });
    if (m.spot) items.push('<button type="button" data-axl-spot="' + esc(m.spot) + '">Bu bölgeden spot çöz →</button>');
    if (!items.length) return;
    var d = D.createElement('div'); d.className = 'axl-mchips'; d.innerHTML = items.join('');
    box.lastElementChild.appendChild(d);
  };
  var say = function (role, text, extra) {
    lsafe(function () { renderAcadiaMessage(role, text); });
    var m = { role: role, content: text };
    if (extra) { if (extra.show && extra.show.length) m.show = extra.show; if (extra.spot) m.spot = extra.spot; addLabChips(m); }
    log.push(m); hist().push({ role: role, content: text }); save();
  };
  var greet = function () {
    say('assistant', lab === 'sirket' ? 'Acadex Şirket’teyim. Hangi kattaysan (terazi, tablolar, başabaş, yatırım, strateji, simülasyon…) ekrandaki rakamları görüyorum. Senin yerine karar vermem; tablolardan birlikte okuruz.'
      : lab === 'finans' ? 'Acadex Finans’tayım. Hangi istasyondaysan (faiz, muhasebe, portföy, dış ticaret…) ekrandaki rakamlarını görüyorum; soruları onlara göre cevaplarım. Sınav ya da fiş çözerken cevabı söylemem, düşünme yolunu birlikte kurarız.'
      : lab === 'diyet' ? 'Diyet Lab’deyim. Tabağını, ölçümlerini ya da vakanı görüyorum; sorularımı ona göre hazırlarım. Hazır menü ya da cevap yazmam, düşünme yolunu birlikte kurarız.'
      : NAMES[lab] + '’deyim. Modelden bir yapı seç; sorularımı ona göre hazırlarım. Kart bilgisinden cevaplayabildiğimi modelde de gösteririm, gerisini yapay zekâyla cevaplarım.');
  };

  /* ---------- lab aç / kapat: panel sohbetini değiştir ---------- */
  var swapIn = function (k) {
    var box = $('acadia-messages');
    if (!saved) saved = { hist: hist().slice(), greeted: greeted(), html: box ? box.innerHTML : '' };
    lab = k; ctx = null; log = store.get(k);
    hist(log.map(function (m) { return { role: m.role, content: m.content }; })); greeted(true);
    if (box) { box.innerHTML = ''; log.forEach(function (m) { lsafe(function () { renderAcadiaMessage(m.role, m.content); }); if (m.show || m.spot) addLabChips(m); }); }
    if (!log.length) greet();
    setLabel(); renderChips();
  };
  var swapOut = function () {
    save();
    var box = $('acadia-messages');
    if (saved) { hist(saved.hist); greeted(saved.greeted); if (box) box.innerHTML = saved.html; }
    saved = null; lab = null; ctx = null; log = []; setSpot(false); setLabel(); renderChips();
    Object.keys(wait).forEach(function (id) { wait[id]({ miss: true }); });
  };
  W.axMedLabHook = function (k, fr) {
    frame = fr || frame;
    if (k && lab === k) return;
    if (lab) swapOut();
    if (k && NAMES[k]) { swapIn(k); post({ type: 'hello' }); }
  };

  /* ---------- lab'dan gelen mesajlar ---------- */
  var spotReport = function (res) {
    var n = res.filter(function (r) { return r.ok; }).length, bad = res.filter(function (r) { return !r.ok; });
    var t = 'Spot bitti: ' + res.length + ' istasyondan ' + n + ' doğru.';
    if (!bad.length) t += ' Hepsi doğru, eline sağlık! Bir sonraki turda zorluk seviyesini artırabilirsin.';
    else {
      t += ' Kaçırdıkların: ' + bad.slice(0, 6).map(function (r) { return r.tr + ' (' + r.la + (r.ans ? '; senin cevabın: ' + r.ans : '; boş') + ')'; }).join(', ') + (bad.length > 6 ? ' ve ' + (bad.length - 6) + ' yapı daha' : '') + '.';
      t += ' Bunlar tekrar destene eklendi. İstersen birini modelde seç, birlikte üzerinden geçelim.';
    }
    say('assistant', t);
    var fab = $('btn-acadia-toggle'); if (fab) { fab.classList.add('axl-ping'); setTimeout(function () { fab.classList.remove('axl-ping'); }, 4000); }
  };
  if (W.addEventListener) W.addEventListener('message', function (e) {
    if (!frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    var d = e.data; if (!d || d.src !== 'axlab' || d.lab !== lab) return;
    if (d.type === 'ctx') {
      ctx = d;
      if (!!d.spot !== spotOn) setSpot(d.spot);
      if (d.spotRes && d.spotRes.length) spotReport(d.spotRes);
      setLabel(); renderChips();
    } else if (d.type === 'ack' && acks[d.id]) acks[d.id]();
    else if (d.type === 'reply' && wait[d.id]) wait[d.id](d);
  });

  /* ---------- soru: önce lab kartı, olmazsa yapay zekâ (bağlamlı) ---------- */
  /* lab önce "ack" (soru kart bilgisinden cevaplanacak) yollar, sonra cevabı; veri yükleme sürebilir.
     ack 2 sn'de gelmezse yapay zekâya geçilir; ack geldiyse cevap için 30 sn beklenir. */
  var askLab = function (m, onAck) {
    return new Promise(function (res) {
      var id = 'q' + (++seq), done = function (r) { clearTimeout(t); delete wait[id]; delete acks[id]; res(r); };
      var t = setTimeout(function () { done({ miss: true }); }, 2000);
      acks[id] = function () { delete acks[id]; clearTimeout(t); t = setTimeout(function () { done({ miss: true, late: true }); }, 30000); if (onAck) onAck(); };
      wait[id] = done;
      m.type = 'ask'; m.id = id; post(m);
    });
  };
  var typing = function (on) { var t = $('acadia-typing-indicator'); if (t) t.style.display = on ? 'block' : 'none'; };
  var origSend = W.sendAcadiaMessage;
  var viaAI = async function (text) {
    if (typeof origSend !== 'function') return;
    var n = hist().length;
    await origSend(text);
    /* dashboard.js geçmişe yazdı; lab kaydına da al (yalnızca bu çağrının ekledikleri) */
    var h = hist();
    if (lab) { h.slice(n).forEach(function (x) { log.push({ role: x.role, content: x.content }); }); save(); }
  };
  var busy = false;
  var handle = async function (q, kind, label) {
    if (busy) return; busy = true;
    try {
      if (!ctx || !ctx.sel) { await viaAI(q); return; }
      var shown = false;
      var r = await askLab(kind ? { kind: kind, label: label } : { q: q }, function () { shown = true; say('user', label || q); typing(true); });
      typing(false);
      if (r && !r.miss && r.text) { if (!shown) say('user', label || q); say('assistant', r.text, { show: r.show, spot: r.spot }); }
      else if (shown) say('assistant', 'Bunu modelden gösteremedim; yeniden dener misin?');
      else await viaAI(label || q);
    } finally { busy = false; }
  };
  var askChip = function (kind, label) { lsafe(function () { toggleAcadiaPanel(true); }); handle(label, kind, label); };

  if (typeof origSend === 'function') {
    var wrapped = function (text) { if (lab && !spotOn) return handle(text); return origSend.apply(this, arguments); };
    lsafe(function () { sendAcadiaMessage = wrapped; });
    W.sendAcadiaMessage = wrapped;
  }
  var origClear = W.clearAcadiaChat;
  if (typeof origClear === 'function') {
    var clr = function () {
      if (!lab) return origClear.apply(this, arguments);
      store.del(lab); log = []; hist([]); greeted(true);
      var box = $('acadia-messages'); if (box) box.innerHTML = '';
      greet();
    };
    lsafe(function () { clearAcadiaChat = clr; });
    W.clearAcadiaChat = clr;
  }

  /* yapay zekâya giden soruya lab bağlamı: seçili yapı + kart satırları (kısaltılmış) */
  W.axAcadiaPrefix = function () {
    if (!lab || !ctx || !ctx.sel) return '';
    var s = ctx.sel, rows = (s.rows || []).map(function (r) { return r[0] + ': ' + r[1]; }).join(' | ');
    /* Odyoloji ve Diyet Lab bağlamı kendi cümlesini (about) yollar */
    var p = s.about ? (/^Acadex /.test(NAMES[lab]) ? '[' : '[Acadex ') + NAMES[lab] + ' bağlamı: ' + s.about + (rows ? ' Bilgi: ' + rows : '') + ' Cevabı kısa ve ' + (KITLE[lab] || 'sağlık bilimleri öğrencisine') + ' uygun ver.]\n'
      : '[Acadex ' + NAMES[lab] + ' bağlamı: öğrenci 3B modelde "' + s.title + '" (' + s.la + ') yapısına bakıyor.' + (rows ? ' Kart bilgisi: ' + rows : '') + ' Cevabı bu yapıya göre, kısa ve tıp öğrencisine uygun ver.]\n';
    return p.length > 2400 ? p.slice(0, 2399) + '…]\n' : p;
  };

  /* panel içindeki lab çipleri: modelde göster / spot */
  var msgs = $('acadia-messages');
  if (msgs) msgs.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('[data-axl-show]'); if (s) { post({ type: 'show', n: s.getAttribute('data-axl-show') }); return; }
    var sp = e.target.closest && e.target.closest('[data-axl-spot]'); if (sp) post({ type: 'spot', sid: sp.getAttribute('data-axl-spot') });
  });

  W.axMedLabAcadia = { state: function () { return { lab: lab, ctx: ctx, spot: spotOn, log: log.slice() }; }, prefix: W.axAcadiaPrefix };
})();
