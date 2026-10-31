/* ==========================================================================
   ACADEX DİYET LAB · klinik modüller (labs/diyet/diyet-klinik.js), 29.10.2026
   ANTROPOMETRİ (ölçüm odası, BKİ/BMH/TEE), VAKA MASASI (biyokimya fişi, NRS-2002, diyet reçetesi),
   ENTERAL & PARENTERAL (pompa, TPN torbası, yeniden beslenme). Çekirdek: diyet-app.js (DL.core).
   ========================================================================== */
(function () {
  'use strict';
  var DL = window.DL, C = DL && DL.core; if (!C) return;
  var M = C.M, $ = C.$, $$ = C.$$, X = C.X, ls = C.ls, tr = C.tr, toast = C.toast, RM = C.RM, D = document, W = window;
  var NS = 'http://www.w3.org/2000/svg';
  var karne = function (title, puan, rows, not) {
    var col = puan >= 80 ? 'var(--ok)' : puan >= 50 ? 'var(--warn)' : 'var(--bad)';
    return '<div class="karne"><div class="stamp" style="color:' + col + '"><b>' + puan + '</b><small>PUAN</small></div><h3>' + X(title) + '</h3><ul>' +
      rows.map(function (r) { return '<li class="' + (r.ok ? 'ok' : 'no') + '"><b>' + X(r.t) + ':</b> ' + (r.ok ? '<span style="color:var(--ok)">doğru</span>' : 'doğrusu ' + X(r.dogru || '—')) + '</li>'; }).join('') +
      '</ul>' + (not ? '<p class="not"><b>Öğretici not:</b> ' + X(not) + '</p>' : '') + '</div>';
  };
  /* vaka başına sabit karıştırma (doğru seçenek hep ilk sırada görünmesin) */
  var perm = function (n, seed) { var a = []; for (var i = 0; i < n; i++) a.push(i); var h = 0; for (var j = 0; j < seed.length; j++) h = (h * 31 + seed.charCodeAt(j)) >>> 0; for (var k = n - 1; k > 0; k--) { h = (h * 1103515245 + 12345) >>> 0; var r = h % (k + 1), t = a[k]; a[k] = a[r]; a[r] = t; } return a; };

  /* =========================== ANTROPOMETRİ =========================== */
  var A = { id: ls.get('aid', M.AH[0].id), st: {} };
  var ah = function () { return M.AH.filter(function (h) { return h.id === A.id; })[0] || M.AH[0]; };
  var aload = function () { A.st = ls.get('antro.' + A.id, { olc: {}, f: {} }); };
  var asave = function () { ls.set('antro.' + A.id, A.st); };
  var adone = ls.get('antroDone', {});
  var NOTE_A = {
    'a-ali': 'BKİ pre-obez sınırda, ama bel çevresi 104 cm (erkekte ≥102 çok artmış risk) ve bel/kalça 0,98: yağ karın bölgesinde toplanmış. Kardiyometabolik risk BKİ\'nin düşündürdüğünden yüksektir.',
    'a-ayse': 'Tüm ölçümler normal sınırlarda. Bel çevresini göbek hizasından ölçmek değeri birkaç santim büyütür; protokolde ölçüm noktası sabit tutulmalıdır.',
    'a-mert': 'BKİ 27,8 "pre-obez" çıkar ama bel çevresi ve bel/kalça oranı normal: fazlalık kas kütlesidir. BKİ vücut bileşimini ayırt etmez; sporcuda biyoimpedans ya da deri kıvrımı gerekir.',
    'a-zehra': 'BKİ 17,0 (zayıf) ve son 6 ayda belirgin kayıp: malnütrisyon taraması (ör. MUST, NRS-2002) yapılmalı ve enerji alımı artırılmalıdır.',
    'a-hakan': 'BKİ yalnızca pre-obez, ama bel 103 cm ve bel/kalça 1,04: santral (abdominal) obezite. Hipertansiyonla birlikte metabolik risk yüksektir.',
    'a-fatma': 'Bel 95 cm (kadında ≥88 çok artmış) ve bel/kalça 0,88: santral obezite. Yaşlıda kas kaybı (sarkopeni) eşlik edebileceği için kilo kaybı kas korunarak planlanır.'
  };
  var personSVG = function (h) {
    var floor = 372, k = 1.72, H = h.cm * k, top = floor - 14 - H, cx = 330, b = M.bki(h.kg, h.cm), wf = 0.82 + (b - 21) * 0.045, sh = (h.cins === 'E' ? 34 : 29) * wf * (h.id === 'a-mert' ? 1.25 : 1), wa = (h.bel / 75) * 22, hi = (h.kalca / 95) * 30;
    var y = function (fr) { return floor - 14 - H * fr; };
    var skin = '#F2C7A1', top1 = h.cins === 'E' ? '#4E7AA8' : '#C8573A', pant = '#2E3A5C';
    var s = '<g class="person">';
    var lw = Math.max(13, hi * 0.78);                                              /* bacaklar: kalçadan zemine iki sütun */
    s += '<path d="M' + (cx - hi * 0.92) + ' ' + y(0.48) + 'C' + (cx - hi * 0.95) + ' ' + y(0.30) + ' ' + (cx - lw - 2) + ' ' + y(0.15) + ' ' + (cx - lw) + ' ' + y(0.02) + 'H' + (cx - 3) + 'L' + (cx - 1) + ' ' + y(0.40) + 'H' + (cx + 1) + 'L' + (cx + 3) + ' ' + y(0.02) + 'H' + (cx + lw) + 'C' + (cx + lw + 2) + ' ' + y(0.15) + ' ' + (cx + hi * 0.95) + ' ' + y(0.30) + ' ' + (cx + hi * 0.92) + ' ' + y(0.48) + 'Z" fill="' + pant + '"/>';
    s += '<ellipse cx="' + (cx - lw / 2 - 2) + '" cy="' + (y(0.0) - 3) + '" rx="' + (lw / 2 + 4) + '" ry="5" fill="#1A1F2E"/><ellipse cx="' + (cx + lw / 2 + 2) + '" cy="' + (y(0.0) - 3) + '" rx="' + (lw / 2 + 4) + '" ry="5" fill="#1A1F2E"/>';
    s += '<path d="M' + (cx - sh) + ' ' + y(0.81) + 'C' + (cx - sh - 4) + ' ' + y(0.70) + ' ' + (cx - wa - 2) + ' ' + y(0.66) + ' ' + (cx - wa) + ' ' + y(0.6) + 'C' + (cx - wa - 4) + ' ' + y(0.54) + ' ' + (cx - hi) + ' ' + y(0.52) + ' ' + (cx - hi) + ' ' + y(0.46) +
      'L' + (cx + hi) + ' ' + y(0.46) + 'C' + (cx + hi) + ' ' + y(0.52) + ' ' + (cx + wa + 4) + ' ' + y(0.54) + ' ' + (cx + wa) + ' ' + y(0.6) + 'C' + (cx + wa + 2) + ' ' + y(0.66) + ' ' + (cx + sh + 4) + ' ' + y(0.70) + ' ' + (cx + sh) + ' ' + y(0.81) + 'Q' + cx + ' ' + y(0.84) + ' ' + (cx - sh) + ' ' + y(0.81) + 'Z" fill="' + top1 + '"/>';
    var aw = 11 * Math.min(1.35, Math.max(0.85, wf));                              /* kollar: omuzdan bileğe, gövdenin dışında */
    s += '<path d="M' + (cx - sh + 2) + ' ' + y(0.80) + 'C' + (cx - sh - 10) + ' ' + y(0.70) + ' ' + (cx - Math.max(sh, hi) - 12) + ' ' + y(0.58) + ' ' + (cx - Math.max(sh, hi) - 9) + ' ' + y(0.47) + 'M' + (cx + sh - 2) + ' ' + y(0.80) + 'C' + (cx + sh + 10) + ' ' + y(0.70) + ' ' + (cx + Math.max(sh, hi) + 12) + ' ' + y(0.58) + ' ' + (cx + Math.max(sh, hi) + 9) + ' ' + y(0.47) + '" stroke="' + top1 + '" stroke-width="' + aw + '" stroke-linecap="round" fill="none"/>';
    s += '<circle cx="' + (cx - Math.max(sh, hi) - 9) + '" cy="' + (y(0.47) + 4) + '" r="' + (aw * 0.48) + '" fill="' + skin + '"/><circle cx="' + (cx + Math.max(sh, hi) + 9) + '" cy="' + (y(0.47) + 4) + '" r="' + (aw * 0.48) + '" fill="' + skin + '"/>';
    s += '<rect x="' + (cx - 6) + '" y="' + y(0.86) + '" width="12" height="' + (H * 0.05) + '" fill="' + skin + '"/>';
    var hr = H * 0.065; s += '<circle cx="' + cx + '" cy="' + (top + hr) + '" r="' + hr + '" fill="' + skin + '"/>';
    s += h.cins === 'K' ? '<path d="M' + (cx - hr - 2) + ' ' + (top + hr * 1.6) + 'C' + (cx - hr - 4) + ' ' + (top - 2) + ' ' + (cx + hr + 4) + ' ' + (top - 2) + ' ' + (cx + hr + 2) + ' ' + (top + hr * 1.6) + 'C' + (cx + hr) + ' ' + (top + hr * 0.6) + ' ' + (cx - hr) + ' ' + (top + hr * 0.6) + ' ' + (cx - hr - 2) + ' ' + (top + hr * 1.6) + 'Z" fill="#3A2A1F"/>'
      : '<path d="M' + (cx - hr) + ' ' + (top + hr * 0.8) + 'C' + (cx - hr) + ' ' + (top - 2) + ' ' + (cx + hr) + ' ' + (top - 2) + ' ' + (cx + hr) + ' ' + (top + hr * 0.8) + 'C' + (cx + hr * 0.4) + ' ' + (top + hr * 0.4) + ' ' + (cx - hr * 0.4) + ' ' + (top + hr * 0.4) + ' ' + (cx - hr) + ' ' + (top + hr * 0.8) + 'Z" fill="' + (h.yas > 55 ? '#B9B4AA' : '#3A2A1F') + '"/>';
    s += '<circle cx="' + (cx - hr * 0.35) + '" cy="' + (top + hr * 1.05) + '" r="2" fill="#1A1F2E"/><circle cx="' + (cx + hr * 0.35) + '" cy="' + (top + hr * 1.05) + '" r="2" fill="#1A1F2E"/><path d="M' + (cx - 5) + ' ' + (top + hr * 1.45) + 'q5 4 10 0" stroke="#1A1F2E" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    s += '</g>';
    return { s: s, top: top, y: y, cx: cx, wa: wa, hi: hi, H: H, floor: floor };
  };
  var paintRoom = function (anim) {
    var h = ah(), o = A.st.olc || {}, P = personSVG(h), floor = P.floor;
    var s = '<svg viewBox="0 0 600 420" role="img" aria-label="Ölçüm odası: ' + X(h.ad) + '">';
    s += '<rect x="0" y="0" width="600" height="' + floor + '" fill="url(#wall)"/><defs><linearGradient id="wall" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#F1F5EA"/><stop offset="1" stop-color="#E2EAD6"/></linearGradient></defs>';
    s += '<rect x="0" y="' + floor + '" width="600" height="48" fill="#C9B38E"/><path d="M0 ' + floor + 'H600" stroke="#A88E66" stroke-width="3"/>';
    for (var i = 0; i < 6; i++) s += '<path d="M' + (i * 110 + 20) + ' ' + floor + 'l-30 48" stroke="#B89E76" stroke-width="2"/>';
    /* boy ölçer */
    var sx = 236; s += '<rect x="' + (sx - 6) + '" y="22" width="12" height="' + (floor - 22) + '" rx="3" fill="#FFFDF7" stroke="#0D1838" stroke-width="2"/>';
    for (var c = 100; c <= 200; c += 10) { var yy = floor - 14 - c * 1.72; s += '<path d="M' + (sx - 6) + ' ' + yy + 'h' + (c % 50 ? 6 : 10) + '" stroke="#0D1838" stroke-width="1.4"/>' + (c % 50 ? '' : '<text x="' + (sx - 12) + '" y="' + (yy + 4) + '" text-anchor="end" font-family="JetBrains Mono" font-size="10" fill="#46506A">' + c + '</text>'); }
    var hy = o.cm ? P.top : 30;
    s += '<g class="hp" id="hp" style="transform:translateY(' + (anim === 'cm' && !RM ? 0 : hy - 30) + 'px)"><rect x="' + (sx - 8) + '" y="22" width="16" height="16" rx="3" fill="#2B3A1E"/><rect x="' + sx + '" y="27" width="' + (P.cx - sx + 18) + '" height="6" rx="3" fill="#2B3A1E"/></g>';
    /* tartı */
    s += '<rect x="' + (P.cx - 46) + '" y="' + (floor - 14) + '" width="92" height="14" rx="5" fill="#E8EDF3" stroke="#0D1838" stroke-width="2"/>';
    s += P.s;
    /* tartı ekranı (duvarda) */
    s += '<g transform="translate(450 70)"><rect width="128" height="62" rx="10" fill="#151A10" stroke="#0D1838" stroke-width="2"/><text x="10" y="16" font-family="JetBrains Mono" font-size="9" fill="#8C7A4E" letter-spacing="1.2">TARTI</text><text id="kgv" x="118" y="48" text-anchor="end" font-family="JetBrains Mono" font-size="26" font-weight="600" fill="#FFB547">' + (o.kg ? tr(o.kg, 1) : '—') + '</text><text x="118" y="58" text-anchor="end" font-family="JetBrains Mono" font-size="8" fill="#B9821F">kg</text></g>';
    s += '<g transform="translate(450 142)"><rect width="128" height="62" rx="10" fill="#FFFDF7" stroke="#0D1838" stroke-width="2"/><text x="10" y="16" font-family="JetBrains Mono" font-size="9" fill="#6A7593" letter-spacing="1.2">BOY</text><text x="118" y="48" text-anchor="end" font-family="Caveat,cursive" font-size="30" fill="#0D1838">' + (o.cm ? o.cm + ' cm' : '—') + '</text></g>';
    /* mezura */
    var tape = function (id, yy, w, val, on) { return '<g class="tape' + (on ? ' on' : '') + '" id="' + id + '"><ellipse cx="' + P.cx + '" cy="' + yy + '" rx="' + (w + 6) + '" ry="7" fill="none" stroke="#F2B233" stroke-width="5"/><ellipse cx="' + P.cx + '" cy="' + yy + '" rx="' + (w + 6) + '" ry="7" fill="none" stroke="#0D1838" stroke-width="1" stroke-dasharray="2 4"/>' + (on ? '<g transform="translate(' + (P.cx + w + 14) + ' ' + (yy - 12) + ')"><rect width="64" height="24" rx="6" fill="#FFF2D2" stroke="#B9821F"/><text x="32" y="17" text-anchor="middle" font-family="JetBrains Mono" font-size="12" font-weight="600" fill="#7A5200">' + val + ' cm</text></g>' : '') + '</g>'; };
    var belY = o.belYer === 'gobek' ? P.y(0.585) : P.y(0.62);
    s += tape('tp-bel', belY, P.wa, o.bel, !!o.bel) + tape('tp-kal', P.y(0.48), P.hi, o.kalca, !!o.kalca);
    s += '</svg>';
    $('#room').innerHTML = s;
    if (anim === 'cm' && !RM) requestAnimationFrame(function () { requestAnimationFrame(function () { var g = $('#hp'); if (g) g.style.transform = 'translateY(' + (hy - 30) + 'px)'; }); });
    if (anim === 'kg' && !RM) { var el = $('#kgv'), t0 = performance.now(), to = o.kg; (function step(t) { var u = Math.min(1, (t - t0) / 900); u = 1 - Math.pow(1 - u, 3); if (el) el.textContent = tr(to * u, 1); if (u < 1) requestAnimationFrame(step); })(t0); }
  };
  var paintAList = function () {
    $('#a-list').innerHTML = M.AH.map(function (h) { return '<button type="button" class="pc" data-a="' + h.id + '" aria-pressed="' + (h.id === A.id) + '"><span class="av">' + X(h.ad.charAt(0)) + '</span><span><b>' + X(h.ad) + ', ' + h.yas + (h.cins === 'E' ? ' · E' : ' · K') + '</b><small>' + X(h.oz) + '</small></span>' + (adone[h.id] != null ? '<span class="pill ' + (adone[h.id] >= 80 ? 'ok' : 'warn') + ' done">%' + adone[h.id] + '</span>' : '') + '</button>'; }).join('');
  };
  $('#a-list').addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (!b) return; A.id = b.getAttribute('data-a'); ls.set('aid', A.id); aload(); $('#a-karne').innerHTML = ''; paintAntro(); DL.bridgeSend(); });
  var FK = ['bki', 'bkiS', 'belS', 'bko', 'bmh', 'tee'];
  var paintAForm = function () {
    var h = ah(), o = A.st.olc || {}, f = A.st.f || {};
    $('#a-t').textContent = h.ad + ', ' + h.yas + ' · ölçüm formu';
    var cell = function (l, v, u) { return '<div><span>' + l + '</span><b>' + (v != null ? tr(v, l === 'KİLO' ? 1 : 0) + '<small style="font-size:14px"> ' + u + '</small>' : '—') + '</b></div>'; };
    $('#a-olc').innerHTML = cell('KİLO', o.kg, 'kg') + cell('BOY', o.cm, 'cm') + cell('BEL', o.bel, 'cm') + cell('KALÇA', o.kalca, 'cm');
    $('#f-bkiS').innerHTML = '<option value="">seç…</option>' + M.BKI.map(function (b) { return '<option value="' + b.k + '">' + X(b.t) + '</option>'; }).join('');
    FK.forEach(function (k) { var el = $('#f-' + k); el.value = f[k] != null ? f[k] : ''; });
    var fm = f.formul === 'harris' ? 'harris' : 'mifflin'; $('#f-formul').value = fm; $('#f-bmh-l').textContent = 'BMH, ' + M.FORMUL[fm] + ' (kcal)';
    $('#f-pal').textContent = 'PAL ' + tr(h.pal, 1) + ' · ' + (M.PAL.filter(function (p) { return p.k === h.pal; })[0] || {}).t;
    $('#a-rule').innerHTML = '<b>Formüller:</b> BKİ = kg / boy² (m) · bel/kalça = bel ÷ kalça · ' + (fm === 'harris' ? '<b>Harris-Benedict</b>: ' + (h.cins === 'E' ? '66,5 + 13,75×kg + 5,003×cm − 6,755×yaş (erkek)' : '655,1 + 9,563×kg + 1,850×cm − 4,676×yaş (kadın)') : '<b>Mifflin-St Jeor</b>: 10×kg + 6,25×cm − 5×yaş ' + (h.cins === 'E' ? '<b>+ 5</b> (erkek)' : '<b>− 161</b> (kadın)')) + ' · günlük enerji = BMH × PAL.<br><b>WHO bel çevresi:</b> erkekte ≥94 cm artmış, ≥102 cm çok artmış risk; kadında ≥80 ve ≥88 cm. Bel/kalça: erkekte ≥0,90, kadında ≥0,85 yüksek.';
    $$('.tool').forEach(function (t) { t.classList.remove('done'); });
    if (o.kg) $('#o-kg').classList.add('done'); if (o.cm) $('#o-cm').classList.add('done'); if (o.bel) $('#o-bel').classList.add('done'); if (o.kalca) $('#o-kalca').classList.add('done');
  };
  $('#a-clip').addEventListener('input', function (e) {
    var el = e.target; if (!el.id || el.id.indexOf('f-') !== 0) return; var k = el.id.slice(2);
    A.st.f = A.st.f || {}; A.st.f[k] = el.tagName === 'SELECT' ? el.value : (el.value === '' ? null : +el.value); asave(); DL.bridgeSend();
    if (k === 'formul') { $('#a-karne').innerHTML = ''; paintAForm(); }
  });
  var olcSet = function (k, v, anim) { A.st.olc = A.st.olc || {}; A.st.olc[k] = v; asave(); paintRoom(anim); paintAForm(); DL.bridgeSend(); };
  $('#o-kg').onclick = function () { olcSet('kg', ah().kg, 'kg'); C.live('Tartı: ' + ah().kg + ' kg'); };
  $('#o-cm').onclick = function () { olcSet('cm', ah().cm, 'cm'); C.live('Boy: ' + ah().cm + ' cm'); };
  $('#o-bel').onclick = function () { $('#belq').classList.add('on'); };
  $('#belq').addEventListener('click', function (e) { var b = e.target.closest('[data-bel]'); if (!b) return; var w = b.getAttribute('data-bel'), h = ah(); A.st.olc = A.st.olc || {}; A.st.olc.belYer = w; olcSet('bel', w === 'who' ? h.bel : h.gobek); $('#belq').classList.remove('on'); });
  $('#o-kalca').onclick = function () { olcSet('kalca', ah().kalca); };
  $('#a-eval').onclick = function () {
    var h = ah(), o = A.st.olc || {}, f = A.st.f || {};
    if (!o.kg || !o.cm) { toast('Önce tartı ve boy ölçümünü yap.'); return; }
    var g = M.antroPuan(h, o, f); adone[h.id] = g.puan; ls.set('antroDone', adone); paintAList();
    var BS = {}; M.BKI.forEach(function (b) { BS[b.k] = b.t; }); var RS = { yok: 'risk yok', artmis: 'artmış risk', cok: 'çok artmış risk' };
    g.rows.forEach(function (r) { if (r.k === 'bkiS') r.dogru = BS[r.dogru]; if (r.k === 'belS') r.dogru = RS[r.dogru]; });
    $('#a-karne').innerHTML = karne(h.ad + ' · antropometri karnesi', g.puan, g.rows, NOTE_A[h.id] + ' (Mifflin-St Jeor ile BMH ≈ ' + g.T.mifflin + ' kcal, Harris-Benedict ile ≈ ' + g.T.harris + ' kcal; Harris-Benedict güncel yetişkinlerde genellikle biraz yüksek tahmin eder.)');
    DL.bridgeSend();
  };
  $('#a-hedef').onclick = function () {
    var h = ah(), T = M.antroTruth(h), hb = (A.st.f || {}).formul === 'harris', E = hb ? T.teeH : T.tee;
    DL.setHedef({ ad: h.ad, d: h.ad + ', ' + h.yas + ' (antropometri) · ' + M.FORMUL[hb ? 'harris' : 'mifflin'] + ' × PAL', cins: h.cins, yas: h.yas, kg: h.kg, kcal: E });
    toast(h.ad + ' için hedef ' + E + ' kcal; tabakta menü planlayabilirsin.'); C.setTab('tabak');
  };
  var paintAntro = function () { paintAList(); paintRoom(); paintAForm(); };

  /* =========================== VAKA MASASI =========================== */
  /* Acadex Medica: hastanın dosyası ?vaka=<id> ile gelir; puan hastaneye bildirilir */
  var MV = C.MEDICA ? new URLSearchParams(location.search).get('vaka') : null;
  var medica = function (id, puan) { if (!C.MEDICA || W.parent === W) return; try { W.parent.postMessage({ src: 'axmedica', type: 'sonuc', lab: 'diyet', vaka: id, puan: puan, tamam: true }, location.origin); } catch (e) {} };
  var V = { id: MV && M.VK.some(function (v) { return v.id === MV; }) ? MV : ls.get('vid', null), st: {} };
  var vdone = ls.get('vakaDone', {});
  var vk = function () { return M.VK.filter(function (v) { return v.id === V.id; })[0]; };
  var vload = function () { V.st = V.id ? ls.get('vaka.' + V.id, { flags: {}, nrs: {}, kisit: {}, oneri: {} }) : {}; V.res = null; };
  var vsave = function () { if (V.id) ls.set('vaka.' + V.id, V.st); };
  /* klinik sahne (labs/klinik): hastayı odada karşıla → görüşme → reçete formuna devir */
  var sahneDone = ls.get('sahneDone', {});
  var sahneVar = function (id) { return !!(W.AXKLINIK && W.AXKLINIK.SEN['dyt-' + id]); };
  var sahneBtn = function (id) {
    if (C.MEDICA || !sahneVar(id)) return '';                                      /* hastanede görüşme zaten yapıldı */
    var p = sahneDone[id];
    return '<div class="sahne-cta"><button type="button" class="btn tom" data-sahne="' + id + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V6l8-3 8 3v14"/><path d="M9 20v-6h6v6M12 7v4M10 9h4"/></svg>' + (p != null ? 'Görüşmeyi yeniden oyna' : 'Hastayı odada karşıla') + '</button>' +
      '<span class="sub">' + (p != null ? 'Klinik görüşme puanın: <b>' + p + '</b> / 100' : 'Animasyonlu odada anamnez al, muayene et, mentorla tartış; sonra reçeteyi burada yaz.') + '</span></div>';
  };
  var sahneAc = function (id) {
    W.AXKLINIK.open('dyt-' + id, {
      onSonuc: function (R) { sahneDone[id] = R.puan; ls.set('sahneDone', sahneDone); },
      onDevir: function (R, hedef) {
        if (hedef === 'ep') { paintEP(); var f = $('#e-form'); if (f && f.scrollIntoView) f.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); var i = f && f.querySelector('input,select'); if (i) i.focus({ preventScroll: true }); }
        else { paintCase(); var rc = $('#v-main .recete'); if (rc && rc.scrollIntoView) rc.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }
        DL.bridgeSend();
      },
      onKapat: function () { if (C.tab() === 'ep') paintEP(); else paintCase(); }
    });
  };
  D.addEventListener('click', function (e) { var b = e.target.closest('[data-sahne]'); if (b) sahneAc(b.getAttribute('data-sahne')); });
  var IPUCU = {
    'v-dm': 'Böbrek işlevi ve potasyum normal mi? Obez tip 2 diyabette ilk hedef nedir: kısıtlama mı, enerji dengesi mi?',
    'v-kbh': 'Hasta diyalize girmiyor. KDOQI 2020 diyaliz öncesi evre 3–5 için protein hakkında ne diyor? Hangi elektrolitler yüksek?',
    'v-hd': 'Diyaliz tedavisi protein gereksinimini nasıl değiştirir? Hangi ağırlık kullanılır?',
    'v-colyak': 'Tedavinin temeli nedir ve ömür boyu mu? Fişteki hangi değerler emilim bozukluğunu düşündürüyor?',
    'v-siroz': 'Asitli hastada hangi ağırlık kullanılır? ESPEN sirozda proteini kısıtlamayı öneriyor mu?',
    'v-yasli': 'NRS-2002\'nin üç bileşenini ayrı ayrı puanla. Albümin akut fazda neden düşer?',
    'v-gdm': 'Gebelikte KH için alt sınır var mı? Öğün düzeni kan şekerini nasıl etkiler?',
    'v-ped-obez': 'Çocukta BKİ tek başına yorumlanmaz: WHO 2007 yaşa göre BKİ z-skorunu hesapla. Büyüme sürerken hedef kilo kaybı mı, kiloyu korumak mı? Çocukta hangi BMH eşitliği kullanılır?',
    'v-ped-osteo': 'Ateş BMH\'yi her 1 °C için ne kadar artırır? Yatakta yatan çocukta aktivite katsayısı ne olmalı? Enfeksiyonda protein ve sıvı gereksinimi nasıl değişir?',
    'v-nefrotik': 'KDIGO 2021 nefrotik sendromda proteini artırmayı mı öneriyor? Ödemli hastada hangi ağırlık kullanılır? Lipid profili ne söylüyor?',
    'v-gut-dm': 'Ürik asidi yükselten beslenme etkenleri neler? Hızlı kilo kaybı gutta neden sakıncalı? −500 kcal açığı hangi eşitlikle hesaplanacak?'
  };
  var paintVList = function () {
    $('#v-list').innerHTML = M.VK.map(function (v, i) { return '<button type="button" data-v="' + v.id + '" aria-pressed="' + (v.id === V.id) + '" class="' + (vdone[v.id] != null ? 'done' : '') + '"><b>' + X(v.baslik) + '</b><small>Vaka ' + (i + 1) + ' · ' + X(v.ad) + ', ' + v.yas + (vdone[v.id] != null ? ' · puan ' + vdone[v.id] : '') + '</small></button>'; }).join('');
  };
  $('#v-list').addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (!b) return; V.id = b.getAttribute('data-v'); ls.set('vid', V.id); vload(); paintCase(); DL.bridgeSend(); });
  /* BMH hesapçısının sonucu (ateş kutusuna yazarken yalnızca bu satır güncellenir) */
  var bmhText = function (v, s) {
    var w = s.ag ? M.agirlik(v, s.ag) : v.kg, ates = s.ates != null ? +s.ates : 0, pal = s.pal ? +s.pal : 0;
    if (!s.esit) return 'Eşitliği seç; hesap ağırlığı, ateş ve katsayıyla günlük enerjiyi gösteririm. Sonucu aşağıdaki enerji kutusuna kendin yaz.';
    var bm = M.bmhHesap(s.esit, { kg: w, cm: v.cm, yas: v.yas, cins: v.cins }, 0), bmA = bm * M.atesKat(ates);
    return 'BMH ≈ ' + Math.round(bm) + ' kcal' + (ates > 0 ? ' × ' + tr(M.atesKat(ates), 2) + ' (ateş) ≈ ' + Math.round(bmA) + ' kcal' : '') + (pal ? ' × ' + tr(pal, 1) + ' ≈ <b>' + Math.round(bmA * pal) + ' kcal/gün</b>' : '') +
      ' · ağırlık ' + tr(w, 1) + ' kg' + (s.ag ? '' : ' (hesap ağırlığını seçmedin; mevcut ağırlık kullanıldı)');
  };
  var paintCase = function () {
    paintVList();
    var v = vk(), m = $('#v-main');
    if (!v) { m.innerHTML = '<div class="folder" data-tab="DİYET POLİKLİNİĞİ"><h2>Bir dosya aç</h2><p class="oyku">Soldan bir vaka seç. Biyokimya fişinde anormal değerleri işaretle, gerekiyorsa tarama yap, sonra diyet reçetesini yaz: hangi ağırlık, kaç kcal, kaç gram protein, hangi kısıtlamalar ve öneriler. Değerlendir ile karneni al.</p></div>'; return; }
    var s = V.st, r = V.res, b = M.bki(v.kg, v.cm), ideal = M.idealOf(v), duz = M.duzKg(v), abn = r ? r.abn : null;
    var h = '<div class="folder" data-tab="DİYET POLİKLİNİĞİ · ' + (M.VK.indexOf(v) + 1) + '"><h2>' + X(v.ad) + ', ' + v.yas + ' · ' + X(v.baslik) + '</h2><p class="oyku">' + X(v.oyku) + '</p>' + sahneBtn(v.id);
    h += '<p class="sub" style="margin:-6px 0 12px;color:#5A4A2A">Boy ' + v.cm + ' cm · Kilo ' + v.kg + ' kg · BKİ ' + tr(b, 1) + ' · İdeal ağırlık (' + (v.ped ? 'yaşa göre medyan BKİ' : 'BKİ 22') + ') ' + tr(ideal, 1) + ' kg' + (v.kuru ? ' · Ödemsiz ağırlık ' + v.kuru + ' kg' : '') + ' · Düzeltilmiş ağırlık ' + tr(duz, 1) + ' kg</p>';
    h += '<div class="vk-grid"><div><div class="fis" role="group" aria-label="Biyokimya fişi"><h4>BİYOKİMYA</h4><p>' + X(v.ad.toLocaleUpperCase('tr')) + ' · anormal değerleri işaretle</p>' +
      v.lab.map(function (l, i) {
        var on = !!(s.flags && s.flags[i]), st = M.labDurum(l), cls = st === 'H' ? 'tH' : st === 'L' ? 'tL' : '', res = '';
        if (abn) res = (abn.indexOf(i) >= 0) === on ? (on ? ' hit' : '') : ' miss';
        return '<button type="button" data-flag="' + i + '" aria-pressed="' + on + '" class="' + (abn ? cls : '') + res + '"><span>' + X(l[0]) + '<small>ref ' + (l[3] === 0 ? '<' + l[4] : l[4] >= 999 ? '>' + l[3] : l[3] + '–' + l[4]) + ' ' + X(l[2]) + '</small></span><b>' + String(l[1]).replace('.', ',') + '</b><span class="m"></span></button>';
      }).join('') + '</div>';
    h += '<p class="sub" style="margin:10px 0 0">İpucu: ' + X(IPUCU[v.id] || '') + '</p></div>';
    /* reçete */
    var opt = function (o, cur) { return '<option value="">seç…</option>' + Object.keys(o).map(function (k) { return '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + X(o[k]) + '</option>'; }).join(''); };
    var w = s.ag ? M.agirlik(v, s.ag) : null;
    h += '<div class="recete">';
    if (v.nrs) h += '<div class="sec" style="margin-top:0"><span class="k">NRS-2002 taraması</span><div class="grid3" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
      ['durum', 'siddet', 'yas'].map(function (k) { return '<label class="fld">' + ({ durum: 'Beslenme durumu', siddet: 'Hastalık şiddeti', yas: 'Yaş' })[k] + '<select data-nrs="' + k + '"><option value="">seç…</option>' + M.NRS[k].map(function (t, i) { return '<option value="' + i + '"' + (s.nrs && String(s.nrs[k]) === String(i) ? ' selected' : '') + '>' + X(t) + '</option>'; }).join('') + '</select></label>'; }).join('') +
      '</div><p class="calc" id="nrs-t">Toplam: ' + (s.nrs && s.nrs.durum !== '' && s.nrs.siddet !== '' && s.nrs.yas !== '' && s.nrs.durum != null && s.nrs.siddet != null && s.nrs.yas != null ? (+s.nrs.durum + +s.nrs.siddet + +s.nrs.yas) + (+s.nrs.durum + +s.nrs.siddet + +s.nrs.yas >= 3 ? ' → beslenme riski var' : ' → haftalık yeniden tarama') : '—') + '</p></div>';
    if (v.ped) {
      var L = M.lmsAt(v.yas, v.cins);
      h += '<div class="sec" style="margin-top:0"><span class="k">WHO 2007 · yaşa göre BKİ</span><p class="calc" style="margin:2px 0 8px">' + v.yas + ' yaş ' + (v.cins === 'E' ? 'erkek' : 'kız') + ': L ' + tr(L[0], 4) + ' · M ' + tr(L[1], 2) + ' · S ' + tr(L[2], 4) + '<br>z = ((BKİ ÷ M)<sup>L</sup> − 1) ÷ (L × S)</p><div class="grid3" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
        '<label class="fld">BKİ z-skoru<input data-p="pedZ" type="number" step="0.01" inputmode="decimal" value="' + (s.pedZ != null ? s.pedZ : '') + '"></label>' +
        '<label class="fld">Sınıf<select data-p="pedS"><option value="">seç…</option>' + M.PED.map(function (x) { return '<option value="' + x.k + '"' + (s.pedS === x.k ? ' selected' : '') + '>' + X(x.t) + '</option>'; }).join('') + '</select></label></div></div>';
    }
    /* BMH hesapçısı: eşitlik + ateş + aktivite */
    var esit = s.esit || '', pal = s.pal || '';
    var PALS = [[1.2, 'Yatak istirahati (1,2)'], [1.3, 'Yatakta, hafif hareketli (1,3)']].concat(M.PAL.map(function (p) { return [p.k, p.t]; }));
    h += '<div class="sec"' + (v.ped ? '' : ' style="margin-top:0"') + '><span class="k">BMH hesapçısı</span><div class="grid3">' +
      '<label class="fld">BMH eşitliği<select data-p="esit"><option value="">seç…</option>' + Object.keys(M.FORMUL).map(function (k) { return '<option value="' + k + '"' + (esit === k ? ' selected' : '') + '>' + X(M.FORMUL[k]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld">Ateş (37 °C üstü, °C)<input data-p="ates" type="number" min="0" max="4" step="0.5" inputmode="decimal" value="' + (s.ates != null ? s.ates : '') + '"></label>' +
      '<label class="fld">Aktivite / hastalık katsayısı<select data-p="pal"><option value="">seç…</option>' + PALS.map(function (p) { return '<option value="' + p[0] + '"' + (String(pal) === String(p[0]) ? ' selected' : '') + '>' + X(p[1]) + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="calc" id="r-bmh">' + bmhText(v, s) + '</p></div>';
    h += '<h3' + (v.nrs || v.ped ? ' style="margin-top:14px"' : '') + '>Diyet reçetesi</h3><div class="grid3">' +
      '<label class="fld">Hesap ağırlığı<select data-r="ag">' + opt(M.AGIRLIK, s.ag) + '</select><small>' + (w ? tr(w, 1) + ' kg' : '') + '</small></label>' +
      '<label class="fld">Enerji (kcal/gün)<input data-r="kcal" type="number" step="10" inputmode="numeric" value="' + (s.kcal || '') + '"><small id="r-kk">' + (w && s.kcal ? tr(s.kcal / w, 1) + ' kcal/kg' : '') + '</small></label>' +
      '<label class="fld">Protein (g/gün)<input data-r="pro" type="number" step="1" inputmode="numeric" value="' + (s.pro || '') + '"><small id="r-pk">' + (w && s.pro ? tr(s.pro / w, 2) + ' g/kg' : '') + '</small></label></div>';
    h += '<div class="sec"><span class="k">kısıtlamalar ve düzenlemeler</span><div class="chk">' + Object.keys(M.KISIT).map(function (k) { return '<label><input type="checkbox" data-kisit="' + k + '"' + (s.kisit && s.kisit[k] ? ' checked' : '') + '>' + X(M.KISIT[k]) + '</label>'; }).join('') + '</div></div>';
    h += '<div class="sec"><span class="k">öneriler</span><div class="chk">' + Object.keys(M.ONERI).map(function (k) { return '<label><input type="checkbox" data-oneri="' + k + '"' + (s.oneri && s.oneri[k] ? ' checked' : '') + '>' + X(M.ONERI[k]) + '</label>'; }).join('') + '</div></div>';
    var pr = perm(v.oncelik.length, v.id);
    h += '<div class="sec"><span class="k">öncelikli hedef</span><div class="radio">' + pr.map(function (i) { return '<label><input type="radio" name="onc" value="' + i + '"' + (s.oncelik === i ? ' checked' : '') + '>' + X(v.oncelik[i]) + '</label>'; }).join('') + '</div></div>';
    h += '<div class="row" style="margin-top:14px"><button type="button" class="btn pri" id="v-eval">Değerlendir</button><button type="button" class="btn" id="v-tabak">Bu reçeteyle menü planla</button></div>';
    h += r ? karne(v.ad + ' · vaka karnesi', r.puan, r.rows, v.not) : '';
    h += '</div></div></div>';
    m.innerHTML = h;
  };
  $('#v-main').addEventListener('click', function (e) {
    var f = e.target.closest('[data-flag]');
    if (f) { V.st.flags = V.st.flags || {}; var i = f.getAttribute('data-flag'); V.st.flags[i] = !V.st.flags[i]; f.setAttribute('aria-pressed', String(V.st.flags[i])); vsave(); return; }
    if (e.target.closest('#v-eval')) {
      var v = vk(), s = V.st;
      if (!s.ag || !s.kcal || !s.pro) { toast('Ağırlık, enerji ve proteini doldur.'); return; }
      if (s.oncelik == null) { toast('Öncelikli hedefi seç.'); return; }
      if (v.esit && !s.esit) { toast('BMH hesapçısında eşitliği seç.'); return; }
      if (v.ped && (s.pedZ == null || !s.pedS)) { toast('WHO yaşa göre BKİ z-skorunu ve sınıfını doldur.'); return; }
      V.res = M.vakaPuan(v, { flags: s.flags, nrs: s.nrs, ag: s.ag, kcal: +s.kcal, pro: +s.pro, kisit: s.kisit, oneri: s.oneri, oncelik: s.oncelik, esit: s.esit, pedZ: s.pedZ, pedS: s.pedS });
      vdone[v.id] = V.res.puan; ls.set('vakaDone', vdone); paintCase(); DL.bridgeSend(); medica(v.id, V.res.puan);
      var k = $('#v-main .karne'); if (k && k.scrollIntoView) k.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    if (e.target.closest('#v-tabak')) {
      var vv = vk(), ss = V.st; if (!ss.kcal) { toast('Önce enerjiyi yaz.'); return; }
      DL.setHedef({ ad: vv.ad, d: vv.ad + ' · ' + vv.baslik + ' (senin reçeten)', cins: vv.cins, yas: vv.yas, kg: ss.ag ? M.agirlik(vv, ss.ag) : vv.kg, kcal: +ss.kcal });
      toast('Hedef ' + ss.kcal + ' kcal; tabakta menüyü kur.'); C.setTab('tabak');
    }
  });
  $('#v-main').addEventListener('change', function (e) {
    var t = e.target, s = V.st;
    if (t.hasAttribute('data-kisit')) { s.kisit = s.kisit || {}; s.kisit[t.getAttribute('data-kisit')] = t.checked; }
    else if (t.hasAttribute('data-oneri')) { s.oneri = s.oneri || {}; s.oneri[t.getAttribute('data-oneri')] = t.checked; }
    else if (t.name === 'onc') s.oncelik = +t.value;
    else if (t.hasAttribute('data-nrs')) { s.nrs = s.nrs || {}; s.nrs[t.getAttribute('data-nrs')] = t.value; vsave(); paintCase(); return; }
    else if (t.getAttribute('data-r') === 'ag') { s.ag = t.value; vsave(); paintCase(); return; }
    else if (t.hasAttribute('data-p')) {
      var pk = t.getAttribute('data-p'); if (t.tagName !== 'SELECT') return;           /* sayı kutuları 'input' olayında işlenir */
      s[pk] = t.value === '' ? null : (pk === 'pal' ? +t.value : t.value); vsave(); $('#r-bmh').innerHTML = bmhText(vk(), s); DL.bridgeSend(); return;
    }
    vsave(); DL.bridgeSend();
  });
  $('#v-main').addEventListener('input', function (e) {
    var t = e.target, pk = t.getAttribute('data-p');
    if (pk === 'ates' || pk === 'pedZ') { V.st[pk] = t.value === '' ? null : +t.value; vsave(); if (pk === 'ates') $('#r-bmh').innerHTML = bmhText(vk(), V.st); return; }
    var k = t.getAttribute('data-r'); if (k !== 'kcal' && k !== 'pro') return;
    V.st[k] = t.value === '' ? null : +t.value; vsave();
    var v = vk(), w = V.st.ag ? M.agirlik(v, V.st.ag) : null;
    if (k === 'kcal') $('#r-kk').textContent = w && V.st.kcal ? tr(V.st.kcal / w, 1) + ' kcal/kg' : '';
    if (k === 'pro') $('#r-pk').textContent = w && V.st.pro ? tr(V.st.pro / w, 2) + ' g/kg' : '';
  });

  /* =========================== ENTERAL & PARENTERAL =========================== */
  var E = { id: MV && M.EP.some(function (c) { return c.id === MV; }) ? MV : ls.get('eid', M.EP[0].id), st: {} };
  var edone = ls.get('epDone', {});
  var ec = function () { return M.EP.filter(function (c) { return c.id === E.id; })[0] || M.EP[0]; };
  var eload = function () { E.st = ls.get('ep.' + E.id, {}); E.res = null; };
  var esave = function () { ls.set('ep.' + E.id, E.st); };
  var paintEList = function () {
    $('#e-list').innerHTML = M.EP.map(function (c) { return '<button type="button" class="pc" data-e="' + c.id + '" aria-pressed="' + (c.id === E.id) + '"><span class="av">' + ({ enteral: 'EN', tpn: 'PN', refeed: 'RB' })[c.tip] + '</span><span><b>' + X(c.ad) + ', ' + c.yas + '</b><small>' + X(c.baslik) + '</small></span>' + (edone[c.id] != null ? '<span class="pill ' + (edone[c.id] >= 80 ? 'ok' : 'warn') + ' done">%' + edone[c.id] + '</span>' : '') + '</button>'; }).join('');
  };
  $('#e-list').addEventListener('click', function (e) { var b = e.target.closest('[data-e]'); if (!b) return; E.id = b.getAttribute('data-e'); ls.set('eid', E.id); eload(); paintEP(); DL.bridgeSend(); });
  var pumpSVG = function (st) {
    var u = M.URUN.filter(function (x) { return x.id === st.urun; })[0], ml = +st.ml || 0, hiz = +st.hiz || 0, fill = Math.max(0.08, Math.min(1, ml / 2000));
    var bagH = 150, fy = 40 + bagH * (1 - fill);
    return '<svg viewBox="0 0 360 330" role="img" aria-label="Enteral beslenme pompası">' +
      '<rect x="172" y="10" width="6" height="310" rx="3" fill="#9AA3B5"/><path d="M120 22h110" stroke="#9AA3B5" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M128 30h64l8 12v148c0 10-8 16-18 16h-44c-10 0-18-6-18-16V42z" fill="#F7F9FC" stroke="#0D1838" stroke-width="2.2"/>' +
      '<clipPath id="bagc"><path d="M128 30h64l8 12v148c0 10-8 16-18 16h-44c-10 0-18-6-18-16V42z"/></clipPath>' +
      '<rect class="bagfill" clip-path="url(#bagc)" x="118" y="' + fy.toFixed(1) + '" width="90" height="' + (210 - fy).toFixed(1) + '" fill="#F2E3C6"/>' +
      '<text x="164" y="120" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#46506A">' + (u ? X(u.t.split(' (')[0]) : 'ürün seç') + '</text>' +
      '<text x="164" y="136" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#46506A">' + (u ? tr(u.kcal, 2) + ' kcal/ml · ' + u.pro + ' g/L' : '') + '</text>' +
      '<path d="M164 206v20" stroke="#0D1838" stroke-width="2"/><rect x="156" y="226" width="16" height="30" rx="4" fill="#E5F1FB" stroke="#0D1838" stroke-width="2"/>' +
      (hiz > 0 && !RM ? '<circle class="drip" cx="164" cy="232" r="2.6" fill="#E3B66A" style="animation-duration:' + Math.max(0.4, Math.min(3, 60 / hiz)).toFixed(2) + 's"/>' : '') +
      '<path d="M164 256c0 30 40 20 60 40s-10 30 40 30" fill="none" stroke="#0D1838" stroke-width="2"/>' +
      '<g transform="translate(206 196)"><rect width="140" height="96" rx="14" fill="#E9EEF3" stroke="#0D1838" stroke-width="2.2"/><rect x="12" y="12" width="116" height="44" rx="6" fill="#151A10"/>' +
      '<text x="120" y="38" text-anchor="end" font-family="JetBrains Mono" font-size="20" font-weight="600" fill="#FFB547">' + (hiz ? tr(hiz, 1) : '—') + '</text><text x="120" y="50" text-anchor="end" font-family="JetBrains Mono" font-size="8" fill="#B9821F">ml/saat</text>' +
      '<text x="20" y="24" font-family="JetBrains Mono" font-size="8" fill="#8C7A4E">HIZ</text><text x="14" y="76" font-family="JetBrains Mono" font-size="10" fill="#46506A">' + (ml ? ml + ' ml/gün' : 'hacim —') + '</text>' +
      '<circle cx="118" cy="74" r="8" fill="' + (hiz ? '#3BC27B' : '#C9CED8') + '"/></g></svg>';
  };
  var tpnSVG = function (st, h) {
    var mx = 2000, part = function (ml) { return Math.max(0, Math.min(1, (+ml || 0) / mx)) * 180; };
    var dH = part(st.dexMl), aH = part(st.aaMl), lH = part(st.lipMl), base = 230;
    return '<svg viewBox="0 0 360 300" role="img" aria-label="Parenteral beslenme torbası">' +
      '<path d="M60 30h240a14 14 0 0 1 14 14v186a20 20 0 0 1-20 20H66a20 20 0 0 1-20-20V44a14 14 0 0 1 14-14z" fill="#F7F9FC" stroke="#0D1838" stroke-width="2.2"/>' +
      '<path d="M140 34v212M220 34v212" stroke="#C9CED8" stroke-width="2" stroke-dasharray="5 4"/>' +
      '<rect class="bagfill" x="52" y="' + (base - dH + 16) + '" width="84" height="' + dH + '" rx="6" fill="#FFF0B8"/><rect class="bagfill" x="144" y="' + (base - aH + 16) + '" width="72" height="' + aH + '" rx="6" fill="#DDEBFF"/><rect class="bagfill" x="224" y="' + (base - lH + 16) + '" width="84" height="' + lH + '" rx="6" fill="#FFFFFF" stroke="#E1E5EE"/>' +
      '<text x="94" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#46506A">DEKSTROZ %' + (st.dexPct || '—') + '</text><text x="180" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#46506A">AMİNO A. %' + (st.aaPct || '—') + '</text><text x="266" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#46506A">LİPİD %20</text>' +
      '<text x="94" y="80" text-anchor="middle" font-family="Caveat,cursive" font-size="22" fill="#0D1838">' + (+st.dexMl || 0) + ' ml</text><text x="180" y="80" text-anchor="middle" font-family="Caveat,cursive" font-size="22" fill="#0D1838">' + (+st.aaMl || 0) + ' ml</text><text x="266" y="80" text-anchor="middle" font-family="Caveat,cursive" font-size="22" fill="#0D1838">' + (+st.lipMl || 0) + ' ml</text>' +
      '<path d="M180 250v30" stroke="#0D1838" stroke-width="2"/><rect x="120" y="270" width="120" height="26" rx="8" fill="#0D1838"/><text x="180" y="288" text-anchor="middle" font-family="JetBrains Mono" font-size="12" fill="#FFB547">' + h.vol + ' ml · ' + h.kcal + ' kcal</text></svg>';
  };
  var refeedSVG = function (c, st) {
    var start = +st.kcal || 0, hedef = c.kg * 30, W2 = 340, s = '<svg viewBox="0 0 360 230" role="img" aria-label="Kademeli beslenme planı"><text x="14" y="20" font-family="JetBrains Mono" font-size="10" fill="#46506A">ÖRNEK ARTIŞ PLANI (kcal/gün) · hedef ≈ ' + Math.round(hedef) + '</text>';
    for (var d = 0; d < 7; d++) { var v = start ? Math.min(hedef, start + (hedef - start) * d / 6) : 0, hh = v / hedef * 150; s += '<rect x="' + (24 + d * 46) + '" y="' + (190 - hh) + '" width="32" height="' + hh + '" rx="5" fill="' + (d === 0 ? '#D9472B' : '#8DBF5A') + '" style="transition:all .6s"/><text x="' + (40 + d * 46) + '" y="206" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#46506A">' + (d + 1) + '. gün</text>' + (v ? '<text x="' + (40 + d * 46) + '" y="' + (184 - hh) + '" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#0D1838">' + Math.round(v) + '</text>' : ''); }
    s += '<path d="M14 190H' + W2 + '" stroke="#0D1838" stroke-width="1.6"/></svg>';
    return s;
  };
  var paintEP = function () {
    paintEList();
    var c = ec(), st = E.st, dev = $('#e-dev'), form = $('#e-form'), r = E.res;
    var head = '<div class="card" style="margin-bottom:14px"><span class="k">' + ({ enteral: 'enteral beslenme', tpn: 'parenteral beslenme', refeed: 'yeniden beslenme riski' })[c.tip] + '</span><h2>' + X(c.ad) + ', ' + c.yas + ' · ' + X(c.baslik) + '</h2><p class="sub" style="margin:0">' + X(c.oyku) + ' Boy ' + c.cm + ' cm, ağırlık ' + c.kg + ' kg.</p>' + sahneBtn(c.id) + '</div>';
    if (c.tip === 'enteral') {
      dev.innerHTML = head + '<div class="device">' + pumpSVG(st) + '</div><div class="rule"><b>Hesap:</b> günlük hacim (ml) = hedef enerji ÷ ürünün kcal/ml değeri · pompa hızı = hacim ÷ ' + c.saat + ' saat · üründen gelen protein = hacim (L) × g/L. Eksik protein, protein modülüyle tamamlanabilir.</div>';
      form.innerHTML = '<div class="card"><span class="k">beslenme planı</span><h2>Hedef ve ürün</h2><div class="form-g">' +
        '<label class="fld">Hedef enerji (kcal/gün)<input data-e="kcal" type="number" step="10" value="' + (st.kcal || '') + '"></label><label class="fld">Hedef protein (g/gün)<input data-e="pro" type="number" step="1" value="' + (st.pro || '') + '"></label></div>' +
        '<div class="sec"><span class="k">ürün tipi</span><div class="urunler">' + M.URUN.map(function (u) { return '<label><input type="radio" name="urun" value="' + u.id + '"' + (st.urun === u.id ? ' checked' : '') + '><b>' + X(u.t) + '</b><small>' + u.pro + ' g protein/L · ' + X(u.d) + '</small></label>'; }).join('') + '</div></div>' +
        '<div class="form-g sec"><label class="fld">Günlük hacim (ml)<input data-e="ml" type="number" step="10" value="' + (st.ml || '') + '"></label><label class="fld">Pompa hızı (ml/saat)<input data-e="hiz" type="number" step="0.5" value="' + (st.hiz || '') + '"></label><label class="fld full">Protein modülü (g/gün, gerekirse)<input data-e="modul" type="number" step="1" value="' + (st.modul || '') + '"></label></div>' +
        '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" id="e-eval">Değerlendir</button></div>' + (r ? karne(c.ad + ' · enteral karnesi', r.puan, r.rows, c.not) : '') + '</div>';
    } else if (c.tip === 'tpn') {
      var hx = M.tpnHesap({ dexPct: +st.dexPct || 0, dexMl: +st.dexMl || 0, aaPct: +st.aaPct || 0, aaMl: +st.aaMl || 0, lipMl: +st.lipMl || 0, kg: c.kg });
      var cell = function (l, v, ok) { return '<div class="' + (ok == null ? '' : ok ? 'ok' : 'bad') + '"><span>' + l + '</span><b>' + v + '</b></div>'; };
      dev.innerHTML = head + '<div class="device">' + tpnSVG(st, hx) + '<div class="live">' + cell('TOPLAM ENERJİ', hx.kcal + ' kcal') + cell('PROTEİN DIŞI', hx.npk + ' kcal') + cell('DEKSTROZ', tr(hx.dexG, 0) + ' g') + cell('AMİNO ASİT', tr(hx.aaG, 0) + ' g') + cell('LİPİD', tr(hx.lipKg, 2) + ' g/kg', hx.lipG ? hx.lipKg <= c.lipMax : null) + cell('GLUKOZ HIZI', tr(hx.gir, 1) + ' mg/kg/dk', hx.dexG ? hx.gir <= c.girMax : null) + cell('HACİM', hx.vol + ' ml') + cell('OZMOLARİTE', hx.osm + ' mOsm/L') + '</div></div>' +
        '<div class="rule"><b>Enerji:</b> dekstroz 3,4 kcal/g · amino asit 4 kcal/g · %20 lipid 2,0 kcal/ml (0,2 g/ml). <b>Glukoz hızı</b> = dekstroz g × 1000 ÷ (kg × 1440). Periferik yolda ozmolarite ≈900 mOsm/L\'yi geçmemeli; bu hastada santral kateter var.</div>';
      var sel = function (k, arr, cur) { return '<select data-e="' + k + '"><option value="">seç…</option>' + arr.map(function (x) { return '<option value="' + x + '"' + (String(cur) === String(x) ? ' selected' : '') + '>%' + x + '</option>'; }).join('') + '</select>'; };
      form.innerHTML = '<div class="card"><span class="k">TPN reçetesi (24 saat)</span><h2>Torbayı hazırla</h2><div class="form-g">' +
        '<label class="fld">Dekstroz konsantrasyonu' + sel('dexPct', [10, 20, 50, 70], st.dexPct) + '</label><label class="fld">Dekstroz (ml)<input data-e="dexMl" type="number" step="10" value="' + (st.dexMl || '') + '"></label>' +
        '<label class="fld">Amino asit konsantrasyonu' + sel('aaPct', [10, 15], st.aaPct) + '</label><label class="fld">Amino asit (ml)<input data-e="aaMl" type="number" step="10" value="' + (st.aaMl || '') + '"></label>' +
        '<label class="fld">%20 lipid emülsiyonu (ml)<input data-e="lipMl" type="number" step="10" value="' + (st.lipMl || '') + '"></label><label class="fld">İnfüzyon hızı (ml/saat)<input data-e="hiz" type="number" step="0.5" value="' + (st.hiz || '') + '"></label></div>' +
        '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" id="e-eval">Değerlendir</button></div>' + (r ? karne(c.ad + ' · TPN karnesi', r.puan, r.rows, c.not) : '') + '</div>';
    } else {
      dev.innerHTML = head + '<div class="device">' + refeedSVG(c, st) + '</div><div class="fis" style="margin-top:14px;max-width:340px"><h4>BİYOKİMYA</h4><p>' + X(c.ad.toLocaleUpperCase('tr')) + '</p>' + c.lab.map(function (l) { var s2 = M.labDurum(l); return '<button type="button" disabled class="' + (s2 === 'H' ? 'tH' : s2 === 'L' ? 'tL' : '') + '" aria-pressed="' + (s2 !== 'N') + '"><span>' + X(l[0]) + '<small>ref ' + l[3] + '–' + l[4] + ' ' + X(l[2]) + '</small></span><b>' + String(l[1]).replace('.', ',') + '</b><span class="m"></span></button>'; }).join('') + '</div>';
      form.innerHTML = '<div class="card"><span class="k">beslenmeye başlarken</span><h2>Yeniden beslenme planı</h2>' +
        '<div class="rule" style="margin-top:0"><b>NICE CG32 yüksek risk:</b> BKİ &lt;16 · 3–6 ayda &gt;%15 istemsiz kilo kaybı · &gt;10 gün çok az alım · beslenme öncesi düşük K, P ya da Mg. (Ya da ikisi: BKİ &lt;18,5 · &gt;%10 kayıp · &gt;5 gün az alım · alkol/ilaç öyküsü.)</div>' +
        '<label class="fld sec">1. gün enerji (kcal/gün)<input data-e="kcal" type="number" step="10" value="' + (st.kcal || '') + '"><small>' + (st.kcal ? tr(st.kcal / c.kg, 1) + ' kcal/kg' : '') + '</small></label>' +
        '<div class="sec"><span class="k">önlemler</span><div class="chk">' + Object.keys(M.REFEED).map(function (k) { return '<label><input type="checkbox" data-g="' + k + '"' + (st.gerek && st.gerek[k] ? ' checked' : '') + '>' + X(M.REFEED[k]) + '</label>'; }).join('') + '</div></div>' +
        '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" id="e-eval">Değerlendir</button></div>' + (r ? karne(c.ad + ' · yeniden beslenme karnesi', r.puan, r.rows, c.not) : '') + '</div>';
    }
  };
  var eInput = function (e) {
    var t = e.target, k = t.getAttribute('data-e');
    if (k) E.st[k] = t.value === '' ? null : (t.tagName === 'SELECT' ? +t.value : +t.value);
    else if (t.name === 'urun') E.st.urun = t.value;
    else if (t.hasAttribute('data-g')) { E.st.gerek = E.st.gerek || {}; E.st.gerek[t.getAttribute('data-g')] = t.checked; }
    else return;
    esave();
    var c = ec(), focusId = t.getAttribute('data-e'), pos = t.selectionStart;
    if (e.type === 'change' || c.tip !== 'refeed') { /* cihazı canlı güncelle, formu yeniden çizme (odak kaybolmasın) */
      var dev = $('#e-dev .device');
      if (c.tip === 'enteral' && dev) dev.innerHTML = pumpSVG(E.st);
      else if (c.tip === 'tpn') { var keep = E.res; E.res = keep; paintEPDev(); }
    }
    if (c.tip === 'refeed') { var d2 = $('#e-dev .device'); if (d2) d2.innerHTML = refeedSVG(c, E.st); var sm = t.parentNode.querySelector('small'); if (sm && focusId === 'kcal') sm.textContent = E.st.kcal ? tr(E.st.kcal / c.kg, 1) + ' kcal/kg' : ''; }
    DL.bridgeSend();
    void pos;
  };
  var paintEPDev = function () { /* yalnız TPN cihaz panelini tazele */
    var c = ec(), st = E.st, hx = M.tpnHesap({ dexPct: +st.dexPct || 0, dexMl: +st.dexMl || 0, aaPct: +st.aaPct || 0, aaMl: +st.aaMl || 0, lipMl: +st.lipMl || 0, kg: c.kg });
    var dev = $('#e-dev .device'); if (!dev) return;
    var cell = function (l, v, ok) { return '<div class="' + (ok == null ? '' : ok ? 'ok' : 'bad') + '"><span>' + l + '</span><b>' + v + '</b></div>'; };
    dev.innerHTML = tpnSVG(st, hx) + '<div class="live">' + cell('TOPLAM ENERJİ', hx.kcal + ' kcal') + cell('PROTEİN DIŞI', hx.npk + ' kcal') + cell('DEKSTROZ', tr(hx.dexG, 0) + ' g') + cell('AMİNO ASİT', tr(hx.aaG, 0) + ' g') + cell('LİPİD', tr(hx.lipKg, 2) + ' g/kg', hx.lipG ? hx.lipKg <= c.lipMax : null) + cell('GLUKOZ HIZI', tr(hx.gir, 1) + ' mg/kg/dk', hx.dexG ? hx.gir <= c.girMax : null) + cell('HACİM', hx.vol + ' ml') + cell('OZMOLARİTE', hx.osm + ' mOsm/L') + '</div>';
  };
  $('#e-form').addEventListener('input', eInput); $('#e-form').addEventListener('change', eInput);
  $('#e-form').addEventListener('click', function (e) {
    if (!e.target.closest('#e-eval')) return;
    var c = ec(), st = E.st;
    if (c.tip === 'enteral' && (!st.kcal || !st.pro || !st.urun || !st.ml || !st.hiz)) { toast('Enerji, protein, ürün, hacim ve hızı doldur.'); return; }
    if (c.tip === 'tpn' && (!st.dexPct || !st.dexMl || !st.aaPct || !st.aaMl || !st.lipMl || !st.hiz)) { toast('Torbanın bütün bileşenlerini ve hızı doldur.'); return; }
    if (c.tip === 'refeed' && !st.kcal) { toast('1. gün enerjisini yaz.'); return; }
    E.res = M.epPuan(c, { kcal: +st.kcal, pro: +st.pro, urun: st.urun, ml: +st.ml, hiz: +st.hiz, modul: +st.modul || 0, dexPct: +st.dexPct, dexMl: +st.dexMl, aaPct: +st.aaPct, aaMl: +st.aaMl, lipMl: +st.lipMl, gerek: st.gerek });
    edone[c.id] = E.res.puan; ls.set('epDone', edone); paintEP(); DL.bridgeSend(); medica(c.id, E.res.puan);
    var k = $('#e-form .karne'); if (k && k.scrollIntoView) k.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
  });

  /* =========================== köprü (Acadia) =========================== */
  var ANS = {
    bki: 'BKİ yalnızca ağırlık ve boyu kullanır; yağ ile kası ayırmaz ve yağın nerede toplandığını göstermez. Sporcuda kas kütlesi BKİ\'yi şişirir; yaşlıda kas kaybı varken BKİ normal görünebilir. Bu yüzden bel çevresi, bel/kalça oranı ve gerekirse vücut bileşimi ölçümüyle birlikte yorumlanır.',
    bel: 'WHO protokolü: hasta ayakta, kollar yanda, normal soluk verme sonunda; mezura son kaburganın alt kenarı ile iliak tepenin üst kenarı arasındaki orta noktadan, yere paralel geçirilir. Göbek hizası farklı bir noktadır ve genellikle daha büyük değer verir; izlemde hep aynı nokta kullanılmalıdır.',
    bmh: 'Mifflin-St Jeor (1990) güncel yetişkin popülasyonda bazal metabolizmayı Harris-Benedict\'ten (1919) daha isabetli tahmin eder; Harris-Benedict çoğunlukla biraz yüksek verir. Erkek: 10×kg + 6,25×cm − 5×yaş + 5; kadın: aynı eşitlik − 161. Günlük enerji için BMH, fiziksel aktivite düzeyi (PAL) ile çarpılır.',
    agirlik: 'Normal ağırlıkta mevcut ağırlık kullanılır. Obezitede enerji ve protein için düzeltilmiş ağırlık (ideal + 0,25 × fazlalık) tercih edilebilir. Ödem ya da asitte kuru ağırlık, diyalizde diyaliz sonrası kuru ağırlık kullanılır.',
    lab: 'Fişte önce referans aralığın dışındakileri ayır, sonra grupla: glukoz/lipid (metabolik), kreatinin-üre-eGFR-K-P (böbrek), albümin-bilirubin-INR (karaciğer), hemoglobin-ferritin-folat-B12 (anemi/emilim), CRP (inflamasyon). Albümin akut fazda düşer; tek başına beslenme göstergesi değildir.',
    hiz: 'Pompa hızı = günlük hacim ÷ beslenme süresi (saat). Günlük hacim = hedef enerji ÷ ürünün kcal/ml değeri. Örneğin 1800 kcal ve 1,5 kcal/ml ürün → 1200 ml; 24 saatte 50 ml/saat. Üründen gelen protein = hacim (L) × protein g/L.',
    gir: 'Glukoz infüzyon hızı (GIR) = dekstroz (g) × 1000 ÷ (kg × 1440) mg/kg/dk. Yetişkinde genellikle ≤4–5 mg/kg/dk tutulur; aşılması hiperglisemi, CO₂ üretimi ve karaciğer yağlanması riskini artırır.',
    refeed: 'Yeniden beslenme sendromu: uzun açlıktan sonra beslenmeye başlanınca insülin artışıyla fosfor, potasyum ve magnezyum hücre içine kayar; hipofosfatemi, aritmi, kalp yetmezliği ve ödem görülebilir. Riskli hastada düşük enerjiyle başlanır, tiamin verilir, elektrolitler izlenip yerine konur ve enerji günler içinde artırılır.'
  };
  DL.klinik = {
    onTab: function (k) { if (k === 'antro') paintAntro(); if (k === 'vaka') paintCase(); if (k === 'ep') paintEP(); },
    ctx: function (tab) {
      if (tab === 'antro') { var h = ah(), o = A.st.olc || {}; return { sel: { key: 'antro.' + h.id, title: 'Antropometri · ' + h.ad + ', ' + h.yas, la: 'Antropometrik değerlendirme', rows: [['Hasta', h.oz], ['Ölçümler', ['kg', 'cm', 'bel', 'kalca'].map(function (k) { return k + ' ' + (o[k] || '—'); }).join(', ')]], about: 'öğrenci Diyet Lab\'de ' + h.ad + ' adlı kurgusal hastanın antropometrik ölçümlerini yapıp BKİ, bel riski, BMH ve günlük enerjiyi hesaplıyor. Sonuçları doğrudan söyleme; formülü ve yorumu anlat.' }, chips: [['bki', 'BKİ neden yanıltabilir?'], ['bel', 'Bel çevresi nasıl ölçülür?'], ['bmh', 'Mifflin mi, Harris-Benedict mi?']] }; }
      if (tab === 'vaka') { var v = vk(); if (!v) return null; return { sel: { key: 'vaka.' + v.id, title: 'Vaka · ' + v.baslik, la: 'Klinik beslenme vakası', rows: [['Öykü', v.oyku], ['Biyokimya', v.lab.map(function (l) { return l[0] + ' ' + l[1] + ' ' + l[2]; }).join('; ')]], about: 'öğrenci kurgusal bir klinik beslenme vakası çözüyor: "' + v.baslik + '". Reçeteyi (enerji, protein, kısıtlamalar) doğrudan verme; ilgili kılavuz ilkesini ve düşünme yolunu anlat.' }, chips: [['lab', 'Fişte neye dikkat etmeliyim?'], ['agirlik', 'Hangi ağırlığı kullanmalıyım?'], ['ipucu', 'Bir ipucu ver']] }; }
      if (tab === 'ep') { var c = ec(); return { sel: { key: 'ep.' + c.id, title: 'Enteral/parenteral · ' + c.baslik, la: ({ enteral: 'Enteral beslenme', tpn: 'Parenteral beslenme', refeed: 'Yeniden beslenme' })[c.tip], rows: [['Öykü', c.oyku], ['Ağırlık', c.kg + ' kg']], about: 'öğrenci kurgusal bir hastada ' + ({ enteral: 'enteral beslenme planı', tpn: 'TPN torbası', refeed: 'yeniden beslenme başlangıcı' })[c.tip] + ' hazırlıyor. Sayıları doğrudan verme; hesap yöntemini anlat.' }, chips: c.tip === 'refeed' ? [['refeed', 'Yeniden beslenme sendromu nedir?']] : c.tip === 'tpn' ? [['gir', 'Glukoz infüzyon hızı nedir?'], ['hiz', 'Saatlik hızı nasıl bulurum?']] : [['hiz', 'Pompa hızını nasıl hesaplarım?']] }; }
      return null;
    },
    answer: function (kind, tab) { if (kind === 'ipucu') { var v = vk(); return v ? IPUCU[v.id] : null; } return ANS[kind] || null; },
    classify: function (q, tab) {
      if (/bki|beden kitle/.test(q)) return 'bki'; if (/bel/.test(q)) return 'bel'; if (/mifflin|harris|bmh|bazal/.test(q)) return 'bmh';
      if (/ağırlı|kuru ağır|düzeltilmiş/.test(q)) return 'agirlik'; if (/fiş|lab|biyokimya|albümin/.test(q)) return 'lab'; if (/ipucu/.test(q)) return 'ipucu';
      if (/glukoz infüzyon|gir\b/.test(q)) return 'gir'; if (/pompa|hız|ml\/saat/.test(q)) return 'hiz'; if (/yeniden beslenme|refeeding/.test(q)) return 'refeed';
      return null;
    }
  };

  /* ---------------- başlat ---------------- */
  aload(); vload(); eload();
  DL.klinik.onTab(C.tab());
})();
