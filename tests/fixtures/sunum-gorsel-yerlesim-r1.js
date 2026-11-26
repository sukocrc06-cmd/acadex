/* DONDURULMUŞ YERLEŞİM (Phase 2 öncesi, commit d5a73cc, js/acadex-ink.js fotoImg … placePhoto).
   tests/sunum-gorsel-yuva.js yeni YUVA tablolu yerleşimi bununla karşılaştırır: kapak, klasik liste ve klasik alıntı
   yerleşimleri birebir aynı kalmalı (yalnız öğeye eklenen kaynak bilgisi hariç). Elle değiştirme. */
  var fotoImg = function (p, x, y, w, h, alt, cr, kap) { var o = { src: p.large, alt: alt || p.alt || '', credit: p.photographer || '', creditUrl: p.page || '', creditId: cr.id }; if (kap) { o.kap = 1; o.oran = Math.round((p.w || 3) / (p.h || 2) * 100) / 100; } if (p.track) fn('sunum-research', { action: 'track', url: p.track }, 15000).catch(function () {}); return E('img', x, y, w, h, o); };
  var genisler = function (sl) { return sl.els.filter(function (e) { return (e.type === 'ul' || e.type === 't' || (sl.lay === 'quote' && e.type === 'h' && e.text.length > 1)) && e.x < 200 && e.w > 520 && e.y > 130 && !e.muted; }); };
  var placePair = function (sl, p1, p2) {
    var wide = genisler(sl); if (!wide.length || sl.lay !== 'list') return placePhoto(sl, p1, p1.alt);
    var w = 300, h = 150, x = W - 50 - w, ilk = null;
    wide.forEach(function (e) { e.w = Math.max(300, Math.min(e.w, x - e.x - 24)); });
    [p1, p2].forEach(function (p, k) { var y = 140 + k * 174, cr = E('t', x, y + h + 2, w, 18, { text: credText(p), size: 10, color: SOFT, align: 'right' }), im = fotoImg(p, x, y, w, h, p.alt, cr, 1); sl.els.push(im, cr); ilk = ilk || im; });
    return ilk;
  };
  var placeTam = function (sl, p, alt) {
    /* Kapak: fotoğraf tam sayfa, başlık koyu yarı saydam panoda (25.11.2026, "editoryal kapak").
       Dikey fotoğraf panoyu kapatır; o zaman yandaki kutuya düşülür. */
    if (sl.lay === 'cover') {
      if ((p.w || 3) < (p.h || 2) * 1.2) return null;
      var ch = sl.els.filter(function (e) { return e.type === 'h' && !e.muted; })[0], ct = sl.els.filter(function (e) { return e.type === 't' && !e.muted; })[0], cm = sl.els.filter(function (e) { return e.type === 'mark'; })[0]; if (!ch) return null;
      var ccr = E('t', 600, 512, 340, 18, { text: credText(p), size: 11, color: '#FFFFFF', align: 'right' }), cim = fotoImg(p, 0, 0, W, H, alt, ccr, 1);
      ch.x = 84; ch.y = 156; ch.w = 640; ch.h = 150; ch.size = Math.min(ch.size || 60, String(ch.text).length > 60 ? 40 : 50); ch.color = '#FFFFFF';
      if (cm) { cm.x = 84; cm.y = 316; cm.w = 160; cm.h = 14; }
      if (ct) { ct.x = 84; ct.y = 346; ct.w = 640; ct.h = 40; ct.size = 20; ct.color = '#D6DCEA'; }
      sl.els = [cim, E('rect', 56, 128, 700, 286, { fill: '#0B1220D9', dz: 1 }), E('rect', 596, 508, 348, 26, { fill: '#0B122099', dz: 1 })].concat(sl.els, [ccr]);
      return cim;
    }
    var hs = sl.els.filter(function (e) { return e.type === 'h' && !e.muted; }), qh = hs.filter(function (e) { return e.text.length > 1; })[0], qm = hs.filter(function (e) { return e.text.length <= 1; })[0];
    var at = sl.els.filter(function (e) { return e.type === 't' && !e.muted && e.text; })[0], mk = sl.els.filter(function (e) { return e.type === 'mark'; })[0];
    if (sl.lay !== 'quote' || sl.v || !qh || !at || qh.text.length > 220 || (p.w || 3) < (p.h || 2)) return null;
    /* pano '#EEF3FF': çizgili şablonlarda renkli kutular saydamlaşır, bu renk dolu kalır — yazı fotoğrafın üstünde okunur */
    var cr = E('t', 590, 474, 296, 20, { text: credText(p), size: 11, color: SOFT, align: 'right' }), im = fotoImg(p, 0, 0, W, H, alt, cr, 1);
    if (qm) { qm.x = 78; qm.y = 262; qm.w = 80; qm.h = 84; qm.size = 96; }
    qh.x = 160; qh.y = 290; qh.w = 710; qh.h = 130; qh.size = 28;
    if (mk) { mk.x = 160; mk.y = 432; mk.w = 120; mk.h = 12; }
    at.x = 160; at.y = 450; at.w = 420; at.h = 36; at.size = 18;
    sl.els = [im, E('rect', 60, 268, 840, 232, { fill: '#EEF3FF' })].concat(sl.els, [cr]);
    return im;
  };
  var placePhoto = function (sl, p, alt, bicim) {
    if (bicim === 'tam') { var tm = placeTam(sl, p, alt); if (tm) return tm; }
    var w = 480, h = Math.round(w * (p.h || 2) / (p.w || 3)); if (h > 330) { h = 330; w = Math.round(h * (p.w || 3) / (p.h || 2)); }
    var x = Math.round((W - w) / 2), y = Math.round((H - h) / 2) - 8;
    /* Alıntı düzeninde asıl geniş kutu büyük yazıdır (h); daralmazsa fotoğrafın altında kalır. */
    var wide = genisler(sl);
    if (sl.lay === 'cover') { var k = fotoKutu(p, 340, 400); w = k.w; h = k.h; x = W - 40 - w; y = 70 + Math.round((400 - h) / 2); wide = sl.els.filter(function (e) { return (e.type === 'h' || e.type === 't' || e.type === 'mark') && e.w > 420; }); }
    else if (wide.length) { w = 360; h = Math.round(w * (p.h || 2) / (p.w || 3)); if (h > 300) { h = 300; w = Math.round(h * (p.w || 3) / (p.h || 2)); } x = W - 50 - w; y = 160; }
    if (bicim === 'sol' && wide.length && sl.lay !== 'quote') { x = sl.lay === 'cover' ? 40 : 50; wide.forEach(function (e) { e.x = x + w + 34; e.w = Math.max(e.type === 'mark' ? 120 : 300, Math.min(e.w, W - 60 - e.x)); }); }
    else wide.forEach(function (e) { e.w = Math.max(e.type === 'mark' ? 120 : 300, Math.min(e.w, x - e.x - 24)); });
    var cr = E('t', x, y + h + 4, w, 22, { text: credText(p), size: 12, color: SOFT, align: bicim === 'sol' ? 'left' : 'right' });
    var im = fotoImg(p, x, y, w, h, alt, cr);
    sl.els.push(im, cr);
    return im;
  };
