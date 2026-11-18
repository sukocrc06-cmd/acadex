/* ==========================================================================
   ACADEX · KAYNAKLA ÇALIŞ — ÇALIŞMA ARAÇLARI (js/acadex-kaynak-calis.js + css/acadex-kaynak-calis.css), 18.11.2026
   Okuma masasına (acadex-ink.js + acadex-kaynak-masa.js) eklenenler; kartın mevcut verisiyle,
   yeni yapay zekâ isteği ya da veritabanı değişikliği olmadan çalışır:
     1) Okuma ilerlemesi: okunan bölümler, ✓ ve ? işaretleri; “? işaretlerim” listesi
        (özette göster, Acadia’ya sor).
     2) Kavram haritası: kartın concept_graph'ı (en az 3 kavram) ya da bölümler → önemli noktalar
        → anahtar terimlerden dallanan harita; kavrama dokununca özetteki bölümü ve belgedeki
        sayfayı açar. Telefonda harita yerine açılır kapanır liste.
     3) Kendini sına: kartın boşluk doldurma (cloze_cards) ve açık uçlu sorularından (quiz_questions)
        bölüm seçerek 6 soruluk test ya da çevrilen kartlar. Her cevabın altında “kaynakta gör · s. X”
        (dipnot alıntısıyla kelime eşleşmesi) ya da “özette: Bölüm k”.
     4) Telefonda (≤ 820px) Özet · Belge · Acadia sekmeleri; dipnota dokununca Belge sekmesine,
        “Acadia’ya sor” ile Acadia sekmesine geçer; Acadia cevap verince sekmede nokta yanar.
   Kalıcı bilgi yalnızca bu tarayıcıda (localStorage): son test puanı, kart ilerlemesi.
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window;
  var root = D.getElementById('sourcehub-view');
  if (!root || !root.classList.contains('axy')) return;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var g = function (n) { try { return (0, eval)(n); } catch (e) { return undefined; } };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var get = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* özel pencere */ } };
  var RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var dar = function () { return W.matchMedia ? W.matchMedia('(max-width: 820px)').matches : W.innerWidth <= 820; };
  var aktifId = function () { return g('sourceHubActiveCardId') || null; };
  var aktif = function () { var id = aktifId(); return (g('sourceHubCards') || []).filter(function (c) { return c.id === id; })[0] || null; };

  /* =====================================================================
     METİN EŞLEŞTİRME: soruyu dipnota ve bölüme bağlamak için kök eşleşmesi
     ===================================================================== */
  var DUR = ' ile için olan gibi daha veya ancak çünkü kadar sonra önce arasında üzerinde olarak olduğu olduğunu olması nedir nelerdir hangi nasıl neden şekilde tarafından this that with from which what when where their there these those have been into about also than then they them were will would could should ';
  var katla = function (t) { return String(t || '').toLocaleLowerCase('tr').replace(/[̀-ͯ]/g, ''); };
  var kokler = function (t) {
    var out = {}, L = katla(t).replace(/<[^>]+>/g, ' ').match(/[a-zçğıöşü0-9]{4,}/g) || [];
    L.forEach(function (w) { if (DUR.indexOf(' ' + w + ' ') > -1) return; out[w.slice(0, 5)] = 1; });
    return out;
  };
  var ortak = function (a, b) { var n = 0; for (var k in a) if (b[k]) n++; return n; };
  var dipnotBul = function (card, metin) {
    var fn = Array.isArray(card.footnotes) ? card.footnotes : [], A = kokler(metin), en = null, eb = 0;
    fn.forEach(function (f) {
      if (!f) return; var s = ortak(A, f._k || (f._k = kokler((f.quote || '') + ' ' + (f.reference || ''))));
      if (s > eb) { eb = s; en = f; }
    });
    return eb >= 2 ? en : null;
  };
  var bolumler = function (card) { return Array.isArray(card.sections) ? card.sections.filter(function (s) { return s && (s.heading || s.summary); }) : []; };
  var bolumKok = function (card) { return bolumler(card).map(function (s) { return kokler((s.heading || '') + ' ' + (s.heading || '') + ' ' + (s.summary || '') + ' ' + (s.key_points || []).join(' ')); }); };
  var bolumBul = function (card, metin, BK) {
    var A = kokler(metin), en = -1, eb = 1; BK = BK || bolumKok(card);
    BK.forEach(function (K, i) { var s = ortak(A, K); if (s > eb) { eb = s; en = i; } });
    return en;
  };
  /* bölüm özetindeki [n] işaretlerinden sayfalar */
  var bolumSayfa = function (card, i) {
    var s = bolumler(card)[i], fn = Array.isArray(card.footnotes) ? card.footnotes : [], ids = {}, m, re = /\[(\d+)\]/g, t = s ? (s.summary || '') + ' ' + (s.key_points || []).join(' ') : '';
    while ((m = re.exec(t))) ids[+m[1]] = 1;
    return fn.filter(function (f) { return f && ids[f.id] && typeof f.page === 'number'; });
  };

  /* =====================================================================
     ORTAK EYLEMLER
     ===================================================================== */
  var mtSec;   /* telefon sekmesi seç (aşağıda tanımlanır) */
  var belgedeGor = function (f) {
    if (!f) return;
    var desk = $('[data-desk]'), ac = $('[data-doc-open]');
    if (desk && desk.classList.contains('no-doc') && ac) ac.click();
    if (mtSec) mtSec('belge');
    var j = W.jumpToFootnote || g('jumpToFootnote'); if (typeof j === 'function') j(f.id, f.reference || '', f.page);
  };
  var ozetteAc = function (i) {
    if (mtSec) mtSec('ozet');
    var b = $('[data-tab="' + i + '"]') || $('[data-sec="' + i + '"]');
    var sb = $('.sec-b[data-sec="' + i + '"]');
    if (sb && sb.getAttribute('aria-expanded') === 'true') { sb.scrollIntoView({ block: 'center', behavior: RM ? 'auto' : 'smooth' }); return; }
    if (b) b.click();
    var li = $('#axy-sec-' + i); if (li) { li.scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' }); parla(li); }
  };
  var parla = function (el) { el.classList.remove('kc-parla'); void el.offsetWidth; el.classList.add('kc-parla'); };
  var acadiayaSor = function (metin, soru) {
    var q = $('#sourcehub-chat-input'); if (!q) return;
    if (mtSec) mtSec('acadia');
    q.value = (metin ? '“' + metin.slice(0, 400) + '”\n\n' : '') + (soru || 'Bu kısmı açıklar mısın?');
    q.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(function () { try { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } catch (e) { } }, 60);
  };

  /* =====================================================================
     DİYALOG (harita ve test için tek pencere)
     ===================================================================== */
  /* body'ye eklenir: panel bölümü kendi katmanını kurduğu için alt menünün altında kalmasın */
  var dlg = D.createElement('div'); dlg.id = 'kc-katman'; dlg.className = 'kc-ort'; dlg.hidden = true;
  dlg.innerHTML = '<div class="kc-dlg" role="dialog" aria-modal="true" aria-labelledby="kc-bas"><div class="kc-dh"><h2 id="kc-bas" class="kc-bas"></h2><button type="button" class="kc-x" data-kc-kapat aria-label="Kapat">×</button></div><div class="kc-di" data-kc-ic></div></div>';
  D.body.appendChild(dlg);
  var dIc = $('[data-kc-ic]', dlg), oncekiOdak = null;
  var dAc = function (baslik, html) {
    oncekiOdak = D.activeElement; $('#kc-bas', dlg).textContent = baslik; dIc.innerHTML = html; dlg.hidden = false; D.body.classList.add('kc-acik');
    setTimeout(function () { var f = $('[data-kc-ilk]', dlg) || $('.kc-x', dlg); if (f) f.focus(); }, 40);
  };
  var dKapat = function () { if (dlg.hidden) return; dlg.hidden = true; dIc.innerHTML = ''; D.body.classList.remove('kc-acik'); if (oncekiOdak && oncekiOdak.focus) try { oncekiOdak.focus(); } catch (e) { } };
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-kc-kapat]')) dKapat(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); dKapat(); return; }
    if (e.key !== 'Tab') return;
    var f = $$('button, input, textarea, select, [tabindex="0"]', dlg).filter(function (x) { return !x.closest('[hidden]') && !x.disabled && x.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && D.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && D.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  /* =====================================================================
     1) OKUMA İLERLEMESİ
     ===================================================================== */
  var bar = null;
  var guncelle = function () {
    var card = aktif(); if (!bar || !card) return;
    var secs = bolumler(card), rd = get('acadex.kaynak.read.' + card.id, []).filter(function (i) { return i < secs.length; });
    var sn = $$('#sourcehub-summary-text .sn'), ok = sn.filter(function (s) { return s.getAttribute('data-m') === 'ok'; }).length, qq = sn.filter(function (s) { return s.getAttribute('data-m') === 'q'; }).length;
    var oran = secs.length ? rd.length / secs.length : (sn.length ? (ok + qq) / sn.length : 0), son = get('acadex.kaynak.sina.' + card.id, null);
    var h = '<span class="kc-ilr-t hand">okuma</span><span class="kc-ilr-c" role="progressbar" aria-label="Okuma ilerlemesi" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(oran * 100) + '"><i style="width:' + Math.round(oran * 100) + '%"></i></span>' +
      '<span class="kc-ilr-s">' + (secs.length ? '<b>' + rd.length + '/' + secs.length + '</b> bölüm' : '<b>%' + Math.round(oran * 100) + '</b> işaretli') + '</span>' +
      '<span class="kc-ilr-m"><span class="kc-ok" title="anladım">✓ ' + ok + '</span><button type="button" class="kc-qb" data-kc-sorular' + (qq ? '' : ' disabled') + ' aria-label="Soru işaretli cümleler: ' + qq + '">? ' + qq + '</button></span>' +
      (son ? '<span class="kc-son">son test <b>' + son.d + '/' + son.n + '</b></span>' : '');
    var el = $('[data-kc-ilr]', bar); if (el.getAttribute('data-h') !== h) { el.innerHTML = h; el.setAttribute('data-h', h); }
  };
  var sorularAc = function () {
    var L = $$('#sourcehub-summary-text .sn[data-m="q"]');
    if (!L.length) return;
    dAc('Soru işaretlerin', '<p class="kc-not">Okurken “? sorum var” dediğin cümleler. Özette yerini gör ya da Acadia’ya sor.</p><ol class="kc-ql">' + L.map(function (s) {
      return '<li><p>' + esc(s.textContent.trim()) + '</p><div class="kc-ql-b"><button type="button" class="hbtn sm" data-kc-goster="' + s.getAttribute('data-s') + '">özette göster</button><button type="button" class="hbtn sm kc-pri" data-kc-sor="' + s.getAttribute('data-s') + '">Acadia’ya sor</button></div></li>';
    }).join('') + '</ol>');
    var b = $('button', dIc); if (b) b.setAttribute('data-kc-ilk', '');
  };
  dIc.addEventListener('click', function (e) {
    var b = e.target.closest('[data-kc-goster], [data-kc-sor]'); if (!b) return;
    var k = b.getAttribute('data-kc-goster') || b.getAttribute('data-kc-sor'), s = $('#sourcehub-summary-text .sn[data-s="' + k + '"]'); if (!s) return;
    dKapat();
    if (b.hasAttribute('data-kc-sor')) { acadiayaSor(s.textContent.trim()); return; }
    if (mtSec) mtSec('ozet');
    s.scrollIntoView({ block: 'center', behavior: RM ? 'auto' : 'smooth' }); parla(s); setTimeout(function () { s.focus(); }, RM ? 0 : 400);
  });

  /* =====================================================================
     2) KAVRAM HARİTASI
     ===================================================================== */
  var kisalt = function (t, n) { t = String(t || '').replace(/\s*\[\d+\]/g, '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
  var terimAd = function (t) { return typeof t === 'string' ? t : (t && (t.term || t.name)) || ''; };
  var terimTanim = function (t) { return t && typeof t === 'object' ? (t.definition || t.term_definition || '') : ''; };
  /* ağaç: { ad, alt:[...], bolum, tanim, iliski } */
  var haritaVeri = haritaVerisiKur;
  function haritaVerisiKur(card) {
    var ad = (W.axDocTitle ? W.axDocTitle(card.documents && card.documents.file_name) : '') || 'Bu belge', BK = bolumKok(card);
    var cg = card.concept_graph, N = cg && Array.isArray(cg.nodes) ? cg.nodes.filter(function (n) { return n && n.id != null && n.label; }) : [];
    if (N.length >= 3) {
      var E = Array.isArray(cg.edges) ? cg.edges.filter(function (e) { return e && e.from != null && e.to != null; }) : [], der = {}, kom = {};
      E.forEach(function (e) { der[e.from] = (der[e.from] || 0) + 1; der[e.to] = (der[e.to] || 0) + 1; (kom[e.from] = kom[e.from] || []).push([e.to, e.relation]); (kom[e.to] = kom[e.to] || []).push([e.from, e.relation]); });
      var byId = {}; N.forEach(function (n) { byId[n.id] = n; });
      var kok = N.slice().sort(function (a, b) { return (der[b.id] || 0) - (der[a.id] || 0); })[0], yer = {}; yer[kok.id] = 1;
      var dugum = function (n, il) { return { ad: n.label, tur: n.type || '', iliski: il || '', bolum: bolumBul(card, n.label, BK), alt: [] }; };
      var R = dugum(kok); R.kok = 1;
      (kom[kok.id] || []).forEach(function (k) { if (yer[k[0]] || !byId[k[0]] || R.alt.length >= 8) return; yer[k[0]] = 1; R.alt.push(Object.assign(dugum(byId[k[0]], k[1]), { _id: k[0] })); });
      R.alt.forEach(function (c) { (kom[c._id] || []).forEach(function (k) { if (yer[k[0]] || !byId[k[0]] || c.alt.length >= 3) return; yer[k[0]] = 1; c.alt.push(dugum(byId[k[0]], k[1])); }); });
      var kalan = N.filter(function (n) { return !yer[n.id]; });
      kalan.forEach(function (n) { if (R.alt.length < 8) { yer[n.id] = 1; R.alt.push(dugum(n)); } });
      return R;
    }
    var secs = bolumler(card), terimler = (Array.isArray(card.key_terms) ? card.key_terms : []).filter(function (t) { return terimAd(t); });
    var R2 = { ad: kisalt(ad, 40), kok: 1, alt: [] };
    if (secs.length) {
      var kul = {};
      secs.slice(0, 8).forEach(function (s, i) {
        var d = { ad: kisalt(s.heading || ('Bölüm ' + (i + 1)), 44), bolum: i, tanim: kisalt(s.summary, 220), alt: [] };
        terimler.forEach(function (t) { if (d.alt.length >= 2 || kul[terimAd(t)]) return; if (bolumBul(card, terimAd(t) + ' ' + terimTanim(t), BK) === i) { kul[terimAd(t)] = 1; d.alt.push({ ad: kisalt(terimAd(t), 30), tanim: terimTanim(t), bolum: i, tur: 'terim', alt: [] }); } });
        (s.key_points || []).filter(Boolean).slice(0, 3 - d.alt.length).forEach(function (p) { d.alt.push({ ad: kisalt(p, 40), tanim: String(p).replace(/\s*\[\d+\]/g, ''), bolum: i, alt: [] }); });
        R2.alt.push(d);
      });
    } else if (terimler.length) {
      terimler.slice(0, 8).forEach(function (t) { R2.alt.push({ ad: kisalt(terimAd(t), 30), tanim: terimTanim(t), bolum: -1, tur: 'terim', alt: [] }); });
      (card.key_points || []).slice(0, 8).forEach(function (p, i) { var c = R2.alt[i % Math.max(1, R2.alt.length)]; if (c && c.alt.length < 2) c.alt.push({ ad: kisalt(p, 40), tanim: p, bolum: -1, alt: [] }); });
    } else {
      (card.key_points || []).filter(Boolean).slice(0, 8).forEach(function (p) { R2.alt.push({ ad: kisalt(p, 40), tanim: p, bolum: -1, alt: [] }); });
    }
    return R2;
  }
  var satirla = function (t, n) { var w = String(t).split(' '), L = [''], i; for (i = 0; i < w.length; i++) { if ((L[L.length - 1] + ' ' + w[i]).trim().length > n && L[L.length - 1]) { if (L.length === 3) { L[2] += '…'; break; } L.push(w[i]); } else L[L.length - 1] = (L[L.length - 1] + ' ' + w[i]).trim(); } return L; };
  var RENK = ['#2F6BFF', '#C9483B', '#1E8A55', '#B4511F', '#7A4FD0', '#1A8A9A', '#C2417E', '#4A6FD8'];
  var haritaSvg = function (R) {
    var Wd = 1200, H = 760, cx = Wd / 2, cy = H / 2, n = R.alt.length || 1, s = '', d = [], say = 0, gec = function () { return RM ? 0 : (say++ * 0.07).toFixed(2); };
    var yer = function (a, rx, ry) { return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; };
    var kutu = function (x, y, metin, sinif, renk, id, n2) {
      var lh = sinif === 'k2' ? 20 : 23, L = satirla(metin, n2), w = Math.min(270, Math.max.apply(null, L.map(function (l) { return l.length; })) * (sinif === 'k2' ? 9 : 10.6) + 26), h = L.length * lh + 14;
      x = Math.max(w / 2 + 6, Math.min(Wd - w / 2 - 6, x)); y = Math.max(h / 2 + 6, Math.min(H - h / 2 - 6, y));
      return '<g class="kc-n ' + sinif + '" data-kc-n="' + id + '" tabindex="0" role="button" aria-label="' + esc(metin) + '" style="--d:' + (sinif === 'k0' ? 0 : gec()) + 's;--c:' + renk + '"><rect x="' + (x - w / 2).toFixed(1) + '" y="' + (y - h / 2).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h + '" rx="' + (sinif === 'k0' ? 16 : 10) + '"/>' +
        L.map(function (l, i) { return '<text x="' + x.toFixed(1) + '" y="' + (y - h / 2 + 7 + (i + 0.78) * lh).toFixed(1) + '" text-anchor="middle">' + esc(l) + '</text>'; }).join('') + '</g>';
    };
    var cizgi = function (x1, y1, x2, y2, renk, kal, cls) { var mx = (x1 + x2) / 2, my = (y1 + y2) / 2; return '<path class="kc-e ' + (cls || '') + '" pathLength="1" style="--d:' + gec() + 's" d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'Q' + ((mx + cx) / 2).toFixed(1) + ' ' + ((my + cy) / 2).toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + '" stroke="' + renk + '" stroke-width="' + kal + '"/>'; };
    var ust = '', alt = '';
    R.alt.forEach(function (c, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n, p = yer(a, n <= 4 ? 255 : 310, n <= 4 ? 190 : 215), renk = RENK[i % RENK.length];
      ust += cizgi(cx, cy, p[0], p[1], renk, 3.2);
      var m = c.alt.length, ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
      c.alt.forEach(function (k, j) {
        /* alt kavramlar ebeveynin dışına: dışa doğru D kadar, dik yönde S aralıkla dizilir
           (yandaki ebeveynde alt alta, üstteki/alttakinde yan yana) */
        var Dd = 120 + 165 * ca, S = 54 + 200 * sa, o = (j - (m - 1) / 2) * S;
        var q = [p[0] + Math.cos(a) * Dd - Math.sin(a) * o, p[1] + Math.sin(a) * Dd * 0.75 + Math.cos(a) * o];
        alt += cizgi(p[0], p[1], q[0], q[1], renk, 1.6, 'k2e') + kutu(q[0], q[1], k.ad, 'k2', renk, i + '.' + j, 20);
      });
      ust += kutu(p[0], p[1], c.ad, 'k1', renk, String(i), 22);
    });
    return '<svg class="kc-svg" viewBox="0 0 ' + Wd + ' ' + H + '" role="group" aria-label="Kavram haritası">' + alt + ust + kutu(cx, cy, R.ad, 'k0', '#0D1838', 'kok', 20) + '</svg>';
  };
  var haritaListe = function (R) {
    return '<ul class="kc-hl">' + R.alt.map(function (c, i) {
      return '<li style="--c:' + RENK[i % RENK.length] + '"><button type="button" class="kc-hl-b" data-kc-n="' + i + '">' + esc(c.ad) + '</button>' + (c.alt.length ? '<ul>' + c.alt.map(function (k, j) { return '<li><button type="button" class="kc-hl-b k2" data-kc-n="' + i + '.' + j + '">' + esc(k.ad) + '</button></li>'; }).join('') + '</ul>' : '') + '</li>';
    }).join('') + '</ul>';
  };
  var harita = null;
  var haritaAc = function () {
    var card = aktif(); if (!card) return;
    var R = harita = haritaVeri(card);
    if (!R.alt.length) { dAc('Kavram haritası', '<p class="kc-not">Bu özette haritaya dökülecek bölüm, terim ya da önemli nokta yok.</p>'); return; }
    dAc('Kavram haritası', '<p class="kc-not">' + (card.concept_graph && card.concept_graph.nodes && card.concept_graph.nodes.length >= 3 ? 'Belgedeki kavramlar ve aralarındaki ilişkiler.' : 'Bölümler, önemli noktalar ve terimler.') + ' Bir kavrama dokun: özetteki yerini ve belgedeki sayfasını aç.</p>' +
      '<div class="kc-hw"><div class="kc-hs">' + haritaSvg(R) + '</div>' + haritaListe(R) + '<aside class="kc-hd" data-kc-hd aria-live="polite"><p class="kc-not">Bir kavram seç.</p></aside></div>');
    var ilk = $('.kc-n.k1', dIc) || $('.kc-hl-b', dIc); if (ilk) ilk.setAttribute('data-kc-ilk', '');
  };
  var dugumBul = function (id) { if (!harita) return null; if (id === 'kok') return harita; var p = id.split('.'), c = harita.alt[+p[0]]; return p.length > 1 && c ? c.alt[+p[1]] : c; };
  var dugumSec = function (id) {
    var n = dugumBul(id), card = aktif(); if (!n || !card) return;
    $$('[data-kc-n]', dIc).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-kc-n') === id); });
    var f = dipnotBul(card, n.ad + ' ' + (n.tanim || '')), bi = n.bolum != null && n.bolum > -1 ? n.bolum : bolumBul(card, n.ad + ' ' + (n.tanim || '')), sec = bolumler(card)[bi];
    if (!f && bi > -1) f = bolumSayfa(card, bi)[0] || null;
    var t = n.tanim && kisalt(n.tanim, 400) !== n.ad && n.tanim.replace(/\s*\[\d+\]/g, '').trim() !== n.ad ? n.tanim : (sec ? kisalt(sec.summary, 240) : '');
    var hd = $('[data-kc-hd]', dIc);
    hd.innerHTML = '<h3>' + esc(n.ad) + '</h3>' + (n.iliski ? '<p class="kc-il">ilişki: <b>' + esc(n.iliski) + '</b></p>' : '') + (n.tur ? '<p class="kc-il">' + esc(n.tur) + '</p>' : '') + (t ? '<p>' + esc(String(t).replace(/\s*\[\d+\]/g, '')) + '</p>' : '') +
      '<div class="kc-hd-b">' + (bi > -1 ? '<button type="button" class="hbtn sm" data-kc-ozet="' + bi + '">özette aç · Bölüm ' + (bi + 1) + '</button>' : '') +
      (f ? '<button type="button" class="hbtn sm" data-kc-fn="' + esc(f.id) + '">belgede gör' + (typeof f.page === 'number' ? ' · s. ' + f.page : '') + '</button>' : '') +
      '<button type="button" class="hbtn sm kc-pri" data-kc-acsor="' + esc(id) + '">Acadia’ya sor</button></div>';
    if (dar()) hd.scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' });
  };
  dIc.addEventListener('click', function (e) {
    var n = e.target.closest('[data-kc-n]'); if (n) { dugumSec(n.getAttribute('data-kc-n')); return; }
    var o = e.target.closest('[data-kc-ozet]'); if (o) { dKapat(); ozetteAc(+o.getAttribute('data-kc-ozet')); return; }
    var f = e.target.closest('[data-kc-fn]'); if (f) { var card = aktif(), id = f.getAttribute('data-kc-fn'), F = (card.footnotes || []).filter(function (x) { return String(x.id) === id; })[0]; dKapat(); belgedeGor(F); return; }
    var a = e.target.closest('[data-kc-acsor]'); if (a) { var d = dugumBul(a.getAttribute('data-kc-acsor')); dKapat(); acadiayaSor('', '“' + d.ad + '” kavramını bu belgeye göre açıklar mısın? Hangi kavramlarla ilişkili?'); }
  });
  dIc.addEventListener('keydown', function (e) { var n = e.target.closest && e.target.closest('g[data-kc-n]'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); dugumSec(n.getAttribute('data-kc-n')); } });

  /* =====================================================================
     3) KENDİNİ SINA: test ve kartlar
     ===================================================================== */
  /* Türkçe harfler katlanır: klavyesinde ı/ş olmayan da doğru sayılsın */
  var TRK = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
  var duz = function (t) { return katla(t).replace(/[çğıöşüâîû]/g, function (c) { return TRK[c]; }).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); };
  var lev = function (a, b) { var m = a.length, n = b.length, d = [], i, j; for (i = 0; i <= m; i++) d[i] = [i]; for (j = 0; j <= n; j++) d[0][j] = j; for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
  var bosDogru = function (yaz, cevap) {
    var a = duz(yaz), b = duz(cevap); if (!a) return false; if (a === b) return true;
    if (b.length > 3 && lev(a, b) <= Math.max(1, Math.floor(b.length / 6))) return true;
    var bw = b.split(' ').filter(function (w) { return w.length > 2; }), aw = a.split(' ');
    if (bw.length > 1) { var t = bw.filter(function (w) { return aw.some(function (x) { return x === w || (w.length > 3 && x.indexOf(w) === 0 && x.length - w.length <= 4) || (x.length > 3 && lev(x, w) <= 1); }); }).length; if (t / bw.length >= 0.75) return true; }
    return false;
  };
  var sorular = soruListesi;
  function soruListesi(card) {
    var BK = bolumKok(card), L = [];
    (Array.isArray(card.cloze_cards) ? card.cloze_cards : []).forEach(function (c, i) { if (c && c.prompt && c.answer && /_{2,}/.test(c.prompt)) L.push({ k: 'c' + i, tip: 'bosluk', soru: c.prompt, cevap: c.answer, tam: c.full_text || '' }); });
    (Array.isArray(card.quiz_questions) ? card.quiz_questions : []).forEach(function (q, i) { if (q && q.question && q.answer) L.push({ k: 'q' + i, tip: 'acik', soru: q.question, cevap: q.answer }); });
    L.forEach(function (s) { var m = s.soru + ' ' + s.cevap + ' ' + (s.tam || ''); s.bolum = bolumBul(card, m, BK); s.fn = dipnotBul(card, (s.tam || s.soru) + ' ' + s.cevap); });
    return L;
  }
  var karis = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  var T = null;   /* { L, i, mod, sonuc:[], kapsam } */
  var kaynakHtml = function (s) {
    var card = aktif(), f = s.fn || (s.bolum > -1 ? bolumSayfa(card, s.bolum)[0] : null);
    return '<p class="kc-kyn">' + (f ? '<button type="button" class="kc-link" data-kc-fn="' + esc(f.id) + '">kaynakta gör' + (typeof f.page === 'number' ? ' · s. ' + f.page : '') + '</button>' : '') +
      (s.bolum > -1 ? '<button type="button" class="kc-link" data-kc-ozet="' + s.bolum + '">özette: Bölüm ' + (s.bolum + 1) + '</button>' : '') + '</p>';
  };
  var sinaAc = function (kapsam, mod) {
    var card = aktif(); if (!card) return;
    var hepsi = sorular(card), secs = bolumler(card);
    if (!hepsi.length) { dAc('Kendini sına', '<p class="kc-not">Bu kartta soru yok. Belgeyi yeniden özetlediğinde test ve kartlar da hazırlanır.</p>'); return; }
    kapsam = kapsam == null ? -1 : kapsam; mod = mod || 'test';
    var say = function (i) { return hepsi.filter(function (s) { return i < 0 || s.bolum === i; }).length; };
    var L = hepsi.filter(function (s) { return kapsam < 0 || s.bolum === kapsam; });
    T = { L: karis(L).slice(0, mod === 'test' ? 6 : 20), i: 0, mod: mod, sonuc: [], kapsam: kapsam };
    var ust = '<div class="kc-su"><label class="kc-sel"><span>kapsam</span><select data-kc-kapsam><option value="-1">Bütün belge (' + hepsi.length + ')</option>' +
      secs.map(function (s, i) { var n = say(i); return n ? '<option value="' + i + '"' + (i === kapsam ? ' selected' : '') + '>' + (i + 1) + '. ' + esc(kisalt(s.heading || ('Bölüm ' + (i + 1)), 38)) + ' (' + n + ')</option>' : ''; }).join('') + '</select></label>' +
      '<div class="kc-mod" role="tablist" aria-label="Çalışma biçimi"><button type="button" role="tab" data-kc-mod="test" aria-selected="' + (mod === 'test') + '">test</button><button type="button" role="tab" data-kc-mod="kart" aria-selected="' + (mod === 'kart') + '">kartlar</button></div></div>';
    dAc('Kendini sına', ust + '<div class="kc-alan" data-kc-alan></div>');
    $('[data-kc-mod="' + mod + '"]', dIc).setAttribute('data-kc-ilk', '');
    adimCiz();
  };
  var adimCiz = function () {
    var A = $('[data-kc-alan]', dIc); if (!A || !T) return;
    if (!T.L.length) { A.innerHTML = '<p class="kc-not">Bu bölümde soru yok.</p>'; return; }
    if (T.i >= T.L.length) { return T.mod === 'test' ? karne(A) : kartSon(A); }
    var s = T.L[T.i], ilr = '<div class="kc-adim"><span>' + (T.i + 1) + ' / ' + T.L.length + '</span><span class="kc-adim-c"><i style="width:' + Math.round(T.i / T.L.length * 100) + '%"></i></span></div>';
    if (T.mod === 'kart') {
      A.innerHTML = ilr + '<div class="kc-kart" data-kc-kart tabindex="0" role="button" aria-label="Kartı çevir"><div class="kc-ky on"><span class="kc-tip">' + (s.tip === 'bosluk' ? 'boşluğu doldur' : 'soru') + '</span><p>' + esc(s.soru) + '</p><small>çevirmek için dokun</small></div><div class="kc-ky arka"><span class="kc-tip">cevap</span><p><b>' + esc(s.cevap) + '</b></p>' + (s.tam ? '<p class="kc-tam">' + esc(s.tam) + '</p>' : '') + kaynakHtml(s) + '</div></div>' +
        '<div class="kc-kb" data-kc-kb hidden><button type="button" class="hbtn" data-kc-not="0">tekrar et</button><button type="button" class="hbtn kc-pri" data-kc-not="1">bildim</button></div>';
      return;
    }
    if (s.tip === 'bosluk') {
      var p = esc(s.soru).replace(/_{2,}/, '<input type="text" class="kc-bi" data-kc-in autocomplete="off" spellcheck="false" aria-label="boşluğa gelecek cevap" style="width:' + Math.max(7, Math.min(22, s.cevap.length + 2)) + 'ch">');
      A.innerHTML = ilr + '<div class="kc-s"><span class="kc-tip">boşluğu doldur</span><p class="kc-sm">' + p + '</p><div class="kc-sb"><button type="button" class="hbtn sm" data-kc-ipucu>ipucu</button><button type="button" class="hbtn kc-pri" data-kc-kontrol>kontrol et</button></div><div class="kc-geri" data-kc-geri hidden></div></div>';
    } else {
      A.innerHTML = ilr + '<div class="kc-s"><span class="kc-tip">açık uçlu</span><p class="kc-sm">' + esc(s.soru) + '</p><label class="kc-ta"><span>önce kendi cevabını yaz (isteğe bağlı)</span><textarea rows="3" data-kc-in></textarea></label><div class="kc-sb"><button type="button" class="hbtn kc-pri" data-kc-goster-c>cevabı göster</button></div><div class="kc-geri" data-kc-geri hidden></div></div>';
    }
    setTimeout(function () { var i = $('[data-kc-in]', A); if (i && !dar()) i.focus(); }, 60);
  };
  var sonraki = '<button type="button" class="hbtn kc-pri" data-kc-sonraki>' + 'sonraki →' + '</button>';
  var kaydet = function (dogru) { var s = T.L[T.i]; T.sonuc[T.i] = { s: s, d: dogru }; };
  var kontrol = function () {
    var A = $('[data-kc-alan]', dIc), s = T.L[T.i], inp = $('[data-kc-in]', A), gb = $('[data-kc-geri]', A); if (!gb.hidden) return;
    var ok = bosDogru(inp.value, s.cevap); kaydet(ok); inp.readOnly = true; inp.classList.add(ok ? 'iyi' : 'kotu');
    $('.kc-sb', A).hidden = true; gb.hidden = false;
    gb.innerHTML = '<p class="kc-sn ' + (ok ? 'iyi' : 'kotu') + '">' + (ok ? '✓ doğru' : '✗ doğrusu: <b>' + esc(s.cevap) + '</b>') + '</p>' + (s.tam ? '<p class="kc-tam">' + esc(s.tam) + '</p>' : '') + kaynakHtml(s) +
      '<div class="kc-sb">' + (ok ? '' : '<button type="button" class="hbtn sm" data-kc-acsor-s>Acadia’ya sor</button>') + sonraki + '</div>';
    $('[data-kc-sonraki]', gb).focus();
  };
  var cevapGoster = function () {
    var A = $('[data-kc-alan]', dIc), s = T.L[T.i], gb = $('[data-kc-geri]', A); if (!gb.hidden) return;
    $('.kc-sb', A).hidden = true; gb.hidden = false; var ta = $('[data-kc-in]', A); ta.readOnly = true;
    gb.innerHTML = '<p class="kc-cev"><span class="kc-tip">kaynağa göre cevap</span>' + esc(s.cevap) + '</p>' + kaynakHtml(s) +
      '<p class="kc-not">Kendi cevabını karşılaştır:</p><div class="kc-sb kc-oz"><button type="button" class="hbtn sm" data-kc-oz="0">bilemedim</button><button type="button" class="hbtn sm" data-kc-oz="0.5">kısmen</button><button type="button" class="hbtn sm kc-pri" data-kc-oz="1">bildim</button></div>';
    $('[data-kc-oz="1"]', gb).focus();
  };
  var karne = function (A) {
    var n = T.sonuc.length, d = T.sonuc.reduce(function (a, r) { return a + (r ? r.d : 0); }, 0), card = aktif(), yan = T.sonuc.filter(function (r) { return r && r.d < 1; });
    var dd = Math.round(d * 2) / 2; put('acadex.kaynak.sina.' + card.id, { d: dd, n: n, t: Date.now() }); guncelle();
    A.innerHTML = '<div class="kc-karne"><div class="kc-puan" style="--p:' + (n ? d / n : 0) + '"><b>' + String(dd).replace('.', ',') + '</b><span>/ ' + n + '</span></div><p class="kc-kt">' + (d / n >= 0.8 ? 'Bu kısım oturmuş.' : d / n >= 0.5 ? 'İyi gidiyor; eksik kalanlara kaynaktan bak.' : 'Bu kısmı bir daha okuyalım; aşağıdaki yerlerden başla.') + '</p>' +
      (yan.length ? '<h3>tekrar bakılacaklar</h3><ol class="kc-yl">' + yan.map(function (r) { return '<li><p>' + esc(r.s.soru) + '</p><p class="kc-tam">cevap: <b>' + esc(r.s.cevap) + '</b></p>' + kaynakHtml(r.s) + '</li>'; }).join('') + '</ol>' : '') +
      '<div class="kc-sb">' + (yan.length ? '<button type="button" class="hbtn" data-kc-yantekrar>yanlışları tekrar sor</button>' : '') + '<button type="button" class="hbtn kc-pri" data-kc-yeni>yeni test</button></div></div>';
    $('[data-kc-yeni]', A).focus();
  };
  var kartSon = function (A) {
    var bil = T.sonuc.filter(function (r) { return r && r.d; }).length, tek = T.sonuc.filter(function (r) { return r && !r.d; });
    A.innerHTML = '<div class="kc-karne"><div class="kc-puan" style="--p:' + (T.L.length ? bil / T.L.length : 0) + '"><b>' + bil + '</b><span>/ ' + T.L.length + '</span></div><p class="kc-kt">' + (tek.length ? tek.length + ' kartı tekrar etmek istedin.' : 'Bütün kartları bildin.') + '</p><div class="kc-sb">' +
      (tek.length ? '<button type="button" class="hbtn" data-kc-kartek>tekrar edilecekleri çalış</button>' : '') + '<button type="button" class="hbtn kc-pri" data-kc-yeni>baştan</button></div></div>';
    $('[data-kc-yeni]', A).focus();
  };
  dIc.addEventListener('change', function (e) { if (e.target.matches('[data-kc-kapsam]')) sinaAc(+e.target.value, T ? T.mod : 'test'); });
  dIc.addEventListener('click', function (e) {
    if (!T) return; var t = e.target;
    var md = t.closest('[data-kc-mod]'); if (md) { sinaAc(T.kapsam, md.getAttribute('data-kc-mod')); return; }
    if (t.closest('[data-kc-kontrol]')) return kontrol();
    if (t.closest('[data-kc-ipucu]')) { var s0 = T.L[T.i], inp = $('[data-kc-in]', dIc); if (inp && !inp.value) { inp.value = s0.cevap.charAt(0); inp.focus(); } t.closest('[data-kc-ipucu]').disabled = true; return; }
    if (t.closest('[data-kc-goster-c]')) return cevapGoster();
    var oz = t.closest('[data-kc-oz]'); if (oz) { kaydet(+oz.getAttribute('data-kc-oz')); T.i++; adimCiz(); return; }
    if (t.closest('[data-kc-sonraki]')) { T.i++; adimCiz(); return; }
    if (t.closest('[data-kc-acsor-s]')) { var s1 = T.L[T.i]; dKapat(); acadiayaSor(s1.tam || '', 'Bu soruda yanıldım: “' + s1.soru.replace(/_{2,}/, '…') + '” Doğru cevap “' + s1.cevap + '”. Belgeye göre bunu açıklar mısın?'); return; }
    var kt = t.closest('[data-kc-kart]'); if (kt) { kt.classList.add('cevrik'); var kb = $('[data-kc-kb]', dIc); if (kb) { kb.hidden = false; } return; }
    var kn = t.closest('[data-kc-not]'); if (kn) { kaydet(+kn.getAttribute('data-kc-not')); T.i++; adimCiz(); var k2 = $('[data-kc-kart]', dIc); if (k2) k2.focus(); return; }
    if (t.closest('[data-kc-yeni]')) { sinaAc(T.kapsam, T.mod); return; }
    if (t.closest('[data-kc-yantekrar]') || t.closest('[data-kc-kartek]')) { var Y = T.sonuc.filter(function (r) { return r && r.d < 1; }).map(function (r) { return r.s; }); T.L = karis(Y); T.i = 0; T.sonuc = []; adimCiz(); }
  });
  dIc.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches && e.target.matches('input[data-kc-in]')) { e.preventDefault(); kontrol(); }
    var kt = e.target.closest && e.target.closest('[data-kc-kart]'); if (kt && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); kt.click(); }
  });

  /* =====================================================================
     4) TELEFONDA SEKMELER: Özet · Belge · Acadia
     ===================================================================== */
  var desk = $('[data-desk]'), mt = null;
  if (desk) {
    mt = D.createElement('div'); mt.className = 'kc-mt'; mt.setAttribute('role', 'tablist'); mt.setAttribute('aria-label', 'Masa');
    mt.innerHTML = [['ozet', 'Özet'], ['belge', 'Belge'], ['acadia', 'Acadia']].map(function (x, i) { return '<button type="button" role="tab" id="kc-mt-' + x[0] + '" data-kc-mt="' + x[0] + '" aria-selected="' + (i === 0) + '">' + x[1] + '<i class="kc-nokta" hidden></i></button>'; }).join('');
    desk.parentNode.insertBefore(mt, desk);
    var bolge = { ozet: $('.sumf', desk), belge: $('.doc', desk), acadia: $('.chat', desk) };
    Object.keys(bolge).forEach(function (k) { if (bolge[k]) { bolge[k].setAttribute('data-kc-bolge', k); } });
    var simdiki = get('acadex.kaynak.mt', 'ozet');
    mtSec = function (k) {
      if (!bolge[k]) return; simdiki = k; put('acadex.kaynak.mt', k); desk.setAttribute('data-kc-gor', k);
      $$('[data-kc-mt]', mt).forEach(function (b) { var on = b.getAttribute('data-kc-mt') === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on) $('.kc-nokta', b).hidden = true; });
      if (k === 'belge') { var dsk = $('[data-desk]'), ac = $('[data-doc-open]'); if (dsk.classList.contains('no-doc') && ac) ac.click(); }
      if (dar()) { var y = mt.getBoundingClientRect().top; if (y < 0 || y > W.innerHeight * 0.4) mt.scrollIntoView({ block: 'start', behavior: 'auto' }); }
    };
    mt.addEventListener('click', function (e) { var b = e.target.closest('[data-kc-mt]'); if (b) mtSec(b.getAttribute('data-kc-mt')); });
    mt.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; var L = ['ozet', 'belge', 'acadia'], i = L.indexOf(simdiki), j = (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
      mtSec(L[j]); $('[data-kc-mt="' + L[j] + '"]', mt).focus();
    });
    desk.setAttribute('data-kc-gor', simdiki); mtSec(simdiki);
    var nokta = function (k) { if (!dar() || simdiki === k) return; var b = $('[data-kc-mt="' + k + '"] .kc-nokta', mt); if (b) b.hidden = false; };
    /* dipnot → Belge */
    D.addEventListener('click', function (e) { if (dar() && e.target.closest && e.target.closest('#sourcehub-view .footnote-marker')) mtSec('belge'); }, true);
    /* alıntı iliştirildi ya da Acadia cevap verdi → Acadia sekmesinde nokta */
    var att = $('[data-att]'), feed = $('#sourcehub-chat-messages');
    if (att && W.MutationObserver) new MutationObserver(function () { if (!att.hidden) nokta('acadia'); }).observe(att, { attributes: true, attributeFilter: ['hidden'] });
    if (feed && W.MutationObserver) new MutationObserver(function (ml) { if (ml.some(function (m) { return m.addedNodes.length; })) nokta('acadia'); }).observe(feed, { childList: true });
  }

  /* =====================================================================
     KURULUM: özet her çizildiğinde (renderSourceHubSummary)
     ===================================================================== */
  var kur = function () {
    var paper = $('.sumf-paper'); if (!paper) return;
    if (!bar) {
      bar = D.createElement('div'); bar.className = 'kc-bar';
      bar.innerHTML = '<div class="kc-ilr" data-kc-ilr></div><div class="kc-arac"><button type="button" class="hbtn sm" data-kc-harita><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="5" r="2"/><circle cx="19.5" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M9.8 10 6 6.4M14.2 10 18 6.4M9.7 14 6.4 17.6M14.3 14l3.3 3.6"/></svg>kavram haritası</button>' +
        '<button type="button" class="hbtn sm" data-kc-sina><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="m8 9 1.5 1.5L12 8M8 15l1.5 1.5L12 14M14 9.5h3M14 15.5h3"/></svg>kendini sına</button></div>';
      var h = $('.sumf-h', paper); if (h && h.nextSibling) paper.insertBefore(bar, h.nextSibling); else paper.appendChild(bar);
      bar.addEventListener('click', function (e) {
        if (e.target.closest('[data-kc-harita]')) haritaAc();
        else if (e.target.closest('[data-kc-sina]')) sinaAc(-1, 'test');
        else if (e.target.closest('[data-kc-sorular]')) sorularAc();
      });
      var t = 0;
      if (W.MutationObserver) new MutationObserver(function (ml) {
        if (ml.every(function (m) { return bar.contains(m.target); })) return;
        clearTimeout(t); t = setTimeout(guncelle, 120);
      }).observe(paper, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-m', 'aria-expanded'] });
    }
    guncelle();
  };
  var asil = g('renderSourceHubSummary');
  if (typeof asil === 'function') {
    var yeni = function () { var r = asil.apply(this, arguments); try { kur(); } catch (e) { if (W.console) console.error('kaynak-calis', e); } return r; };
    W.__kcRSS = yeni; try { (0, eval)('renderSourceHubSummary = window.__kcRSS'); } catch (e) { /* yok */ }
    W.renderSourceHubSummary = yeni;
  }
  if (aktif()) kur();

  W.AXKAYNAK = { haritaAc: haritaAc, sinaAc: sinaAc, _test: { kokler: kokler, dipnotBul: dipnotBul, bolumBul: bolumBul, haritaVeri: haritaVeri, sorular: sorular, bosDogru: bosDogru, haritaSvg: haritaSvg } };
})();
