/* ==========================================================================
   ACADEX DKT LAB · SESLETİM ATÖLYESİ (labs/dkt/dkt-sesletim.js), 29.10.2026
   Ağız kesiti (çıkış yeri, ötümlülük, genizsillik, hava akışı), Türkçe ünsüz
   tablosu, minimal çiftler ve fonolojik süreç dedektifi.
   ========================================================================== */
(function () {
  'use strict';
  var DK = window.DK, C = DK.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X;
  var S = { h: C.ls.get('ses.h', 'k'), q: null, sc: [], pool: [] };
  var byH = {}; V.UNSUZ.forEach(function (u) { byH[u.h] = u; });
  var YER = {}; V.YER.forEach(function (y) { YER[y[0]] = y; });
  var BIC = {}; V.BICIM.forEach(function (b) { BIC[b[0]] = b; });
  var SUR = {}; V.SUREC.forEach(function (s) { SUR[s[0]] = s; });

  /* sesli okuma (cihazda Türkçe ses varsa) */
  var canSay = 'speechSynthesis' in window;
  var say = function (w) {
    if (!canSay) return;
    try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(w); u.lang = 'tr-TR'; u.rate = 0.8; speechSynthesis.speak(u); } catch (e) {}
  };

  /* ---------- ağız kesiti (sagittal) ---------- */
  var CONTACT = { dudak: [74, 186], dudakdis: [86, 191], dis: [116, 160], damakdis: [136, 150], damak: [172, 136], artdamak: [214, 148], girtlak: [262, 318] };
  var TONGUE = { dis: 'rotate(-5 240 262)', damakdis: 'rotate(-4 240 262) translate(2 -2)', damak: 'translate(0 -7)', artdamak: 'rotate(3 240 262) translate(0 -9)' };
  var vtSVG = function () {
    return '<svg class="vt" id="vt" viewBox="0 0 400 360" role="img" aria-label="Ağız ve gırtlak kesiti">' +
      /* yüz çizgisi */
      '<path d="M60 40 C90 30 120 40 120 70 L118 96 C96 104 70 108 54 116 C46 122 50 132 60 134 L66 150 C58 160 58 170 66 176 C56 182 56 196 66 202 C62 220 72 240 96 246 L150 252" fill="#FCE9DB" stroke="#0D1838" stroke-width="3" stroke-linejoin="round"/>' +
      /* burun boşluğu */
      '<path d="M66 118 C110 96 190 94 232 112 L240 128 C200 118 140 118 118 132 Z" fill="#EAF2FC" stroke="#9DB8E8" stroke-width="2"/>' +
      '<text x="150" y="112" font-family="JetBrains Mono" font-size="10" fill="#6A7593" text-anchor="middle">burun boşluğu</text>' +
      /* sert damak + dişeti sırtı + damak-dişeti bölgesi */
      '<path class="art" id="a-damak" d="M150 140 C165 132 185 128 202 128 L203 135 C186 135 168 139 152 146 Z" fill="#E8D8C4" stroke="#7A5230" stroke-width="2"/>' +
      '<path class="art" id="a-damakdis" d="M126 150 C134 144 142 141 150 140 L152 146 C144 148 136 151 130 156 Z" fill="#E8D8C4" stroke="#7A5230" stroke-width="2"/>' +
      '<path class="art" id="a-dis" d="M104 158 C110 152 118 150 126 150 L130 156 C122 158 114 162 108 166 Z" fill="#F2C7C0" stroke="#A8412B" stroke-width="2"/>' +
      /* yumuşak damak (velum) + küçük dil */
      '<g class="velum"><path class="art" id="a-artdamak" d="M202 128 C216 128 228 136 236 150 C240 158 238 166 232 168 C226 160 216 148 203 135 Z" fill="#F4B6AE" stroke="#A8412B" stroke-width="2"/></g>' +
      /* dişler */
      '<path class="art" id="a-ustdis" d="M96 158 L108 158 L106 176 L98 176 Z" fill="#fff" stroke="#0D1838" stroke-width="2"/>' +
      '<path d="M98 196 L106 196 L108 212 L96 212 Z" fill="#fff" stroke="#0D1838" stroke-width="2"/>' +
      /* dudaklar */
      '<path class="art" id="a-ustdudak" d="M66 176 C74 170 86 168 96 172 L94 182 C86 182 76 184 66 184 Z" fill="#E88E7E" stroke="#0D1838" stroke-width="2"/>' +
      '<path class="art" id="a-altdudak" d="M66 190 C76 189 86 190 94 192 L96 204 C86 208 74 206 66 202 Z" fill="#E88E7E" stroke="#0D1838" stroke-width="2"/>' +
      /* yutak arka duvarı ve gırtlak */
      '<path d="M244 120 C262 150 266 200 266 250 L268 340" fill="none" stroke="#0D1838" stroke-width="3"/>' +
      '<path d="M150 252 C190 262 214 272 222 300 L226 340" fill="none" stroke="#0D1838" stroke-width="3"/>' +
      '<path d="M232 272 C238 262 244 258 246 250" fill="none" stroke="#7A5230" stroke-width="4" stroke-linecap="round"/>' +
      '<text x="300" y="214" font-family="JetBrains Mono" font-size="10" fill="#6A7593">yutak</text>' +
      /* ses telleri */
      '<g class="vf" style="transform-origin:246px 318px"><path class="art" id="a-girtlak" d="M228 314 L246 320 L264 314" fill="none" stroke="#A8412B" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<text x="276" y="324" font-family="JetBrains Mono" font-size="10" fill="#6A7593">ses telleri</text>' +
      /* dil */
      '<g class="tongue" style="transition:transform .5s cubic-bezier(.3,1.5,.5,1)"><path id="a-dil" d="M106 196 C112 182 130 176 156 174 C186 172 214 172 228 186 C240 198 242 226 240 262 C220 262 190 258 150 252 C124 246 108 230 106 214 Z" fill="#F08A80" stroke="#0D1838" stroke-width="2.6"/><path d="M130 196 C160 190 196 190 222 204" fill="none" stroke="#C9483B" stroke-width="1.6" opacity=".5"/></g>' +
      /* hava akışı */
      '<path class="air" id="air-o" d="M246 336 C250 280 252 214 236 182 C214 164 150 164 60 188"/>' +
      '<path class="air" id="air-n" d="M246 336 C252 260 250 200 238 160 C224 120 150 108 50 122"/>' +
      '<circle class="contact" id="vt-c" cx="0" cy="0" r="9" fill="none" stroke="#E0705A" stroke-width="3"/>' +
      '</svg>';
  };
  var paintVT = function () {
    var u = byH[S.h]; if (!u) return;
    var vt = $('#vt'); if (!vt) return;
    $$('.art', vt).forEach(function (a) { a.classList.remove('hl'); });
    var hl = { dudak: ['a-ustdudak', 'a-altdudak'], dudakdis: ['a-altdudak', 'a-ustdis'], dis: ['a-dis'], damakdis: ['a-damakdis'], damak: ['a-damak'], artdamak: ['a-artdamak'], girtlak: ['a-girtlak'] }[u.yer] || [];
    hl.forEach(function (id) { var e = vt.getElementById ? vt.getElementById(id) : $('#' + id); if (!e) e = $('#' + id); if (e) e.classList.add('hl'); });
    var c = CONTACT[u.yer], dot = $('#vt-c');
    dot.setAttribute('cx', c[0]); dot.setAttribute('cy', c[1]); dot.classList.remove('on'); void dot.getBoundingClientRect(); dot.classList.add('on');
    vt.classList.toggle('voiced', !!u.ot);
    vt.classList.toggle('nasal', u.bicim === 'genizsil');
    $('#air-o').classList.toggle('on', u.bicim !== 'genizsil');
    $('#air-n').classList.toggle('on', u.bicim === 'genizsil');
    $('.tongue', vt).style.transform = '';
    $('.tongue', vt).setAttribute('transform', TONGUE[u.yer] || '');
  };
  var paintInfo = function () {
    var u = byH[S.h]; if (!u) return;
    var y = YER[u.yer], b = BIC[u.bicim];
    $('#vt-info').innerHTML = '<div class="vt-big"><b>' + X(u.h) + '</b><span class="mono">/' + X(u.ipa) + '/</span>' +
      (canSay ? '<button type="button" class="btn sm" data-say="' + X(u.ornek.split(',')[0]) + '" style="margin-left:auto">dinle</button>' : '') + '</div>' +
      '<div class="vt-tags"><span class="pill">' + X(y[1]) + '</span><span class="pill">' + X(b[1]) + '</span><span class="pill ' + (u.ot ? 'warn' : '') + '">' + (u.ot ? 'ötümlü · ses telleri titrer' : 'ötümsüz') + '</span>' + (u.bicim === 'genizsil' ? '<span class="pill ok">yumuşak damak iner</span>' : '') + '</div>' +
      '<p class="sub" style="margin:10px 0 4px"><b style="color:var(--ink)">Yer:</b> ' + X(y[2]) + '. <b style="color:var(--ink)">Biçim:</b> ' + X(b[2]) + '.</p>' +
      '<p class="sub" style="margin:0 0 4px"><b style="color:var(--ink)">Örnek:</b> ' + X(u.ornek) + (u.cift ? ' · <b style="color:var(--ink)">eşi:</b> ' + X(u.cift) : '') + '</p>' +
      (u.not ? '<p class="sub" style="margin:0">' + X(u.not) + '</p>' : '');
  };

  /* ---------- ünsüz tablosu ---------- */
  var paintTab = function () {
    var h = '<thead><tr><th></th>' + V.YER.map(function (y) { return '<th>' + X(y[1]) + '<small>' + X(y[2]) + '</small></th>'; }).join('') + '</tr></thead><tbody>';
    V.BICIM.forEach(function (b) {
      h += '<tr><th>' + X(b[1]) + '</th>';
      V.YER.forEach(function (y) {
        var us = V.UNSUZ.filter(function (u) { return u.yer === y[0] && u.bicim === b[0]; });
        h += '<td' + (us.length ? '' : ' class="x"') + '>' + us.map(function (u) {
          return '<button type="button" class="cb' + (u.ot ? ' ot' : '') + '" data-h="' + X(u.h) + '" aria-pressed="' + (u.h === S.h) + '" aria-label="' + X(u.h + ', ' + y[1] + ', ' + b[1] + ', ' + (u.ot ? 'ötümlü' : 'ötümsüz')) + '">' + X(u.h) + '<small>' + X(u.ipa) + '</small></button>';
        }).join('') + '</td>';
      });
      h += '</tr>';
    });
    $('#ctab').innerHTML = h + '</tbody>';
  };
  var pick = function (hh) {
    if (!byH[hh]) return;
    S.h = hh; C.ls.set('ses.h', hh);
    $$('#ctab [data-h]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-h') === hh)); });
    paintVT(); paintInfo(); paintMP(); DK.bridgeSend();
  };

  /* ---------- minimal çift ---------- */
  var paintMP = function () {
    var m = V.MINIMAL.filter(function (p) { return p[0] === S.h || p[1] === S.h; })[0] || V.MINIMAL[0];
    $('#mp-t').textContent = m[0] + ' / ' + m[1] + ': tek ses, iki anlam';
    var card = function (s, w) { return '<div class="mpc"><em>' + X(s) + '</em><b>' + X(w) + '</b>' + (canSay ? '<button type="button" class="btn sm" data-say="' + X(w) + '">dinle</button>' : '<span>/' + X(w) + '/</span>') + '</div>'; };
    $('#mp').innerHTML = card(m[0], m[2]) + '<span class="vs">ya da</span>' + card(m[1], m[3]);
  };

  /* ---------- fonolojik süreç dedektifi ---------- */
  var nextQ = function () {
    if (!S.pool.length) S.pool = C.shuffle(V.SUREC_SORU);
    S.q = S.pool.pop(); S.ans = false;
    $('#det-q').innerHTML = '<div><div class="tg">hedef</div><b class="disp" style="font-size:24px">' + X(S.q.h) + '</b></div><span style="font-size:22px">→</span>' + C.dudi(52) + '<div class="bub">' + X(S.q.c) + '</div>';
    $('#det-o').innerHTML = V.SUREC.map(function (s) { return '<button type="button" data-s="' + s[0] + '">' + X(s[1]) + '</button>'; }).join('');
    $('#det-fb').innerHTML = '';
  };
  var paintSc = function () {
    var ok = S.sc.filter(Boolean).length;
    $('#det-sc').innerHTML = '<span class="dots">' + S.sc.slice(-10).map(function (v) { return '<i class="' + (v ? 'ok' : 'no') + '"></i>'; }).join('') + '</span><span>' + ok + '/' + S.sc.length + '</span>';
  };
  var answerQ = function (k) {
    if (!S.q || S.ans) return;
    var ok = k === S.q.s; S.ans = true; S.sc.push(ok); paintSc();
    $$('#det-o [data-s]').forEach(function (b) { var s = b.getAttribute('data-s'); if (s === S.q.s) b.classList.add('ok'); else if (s === k) b.classList.add('no'); });
    var d = SUR[S.q.s];
    $('#det-fb').innerHTML = '<div class="rule"><b>' + (ok ? 'Doğru: ' : 'Bu bir ') + X(d[1]) + (ok ? '' : ' örneği') + '.</b> ' + X(d[2]) + ' <span class="mono">' + X(S.q.h) + ' → ' + X(S.q.c) + '</span></div><div class="row" style="margin-top:10px"><button type="button" class="btn sm pri" id="det-n">Sıradaki</button></div>';
    C.live(ok ? 'Doğru' : 'Yanlış, doğru cevap ' + d[1]);
    DK.bridgeSend();
  };

  DK.st.sesletim = {
    init: function () {
      $('#vt-host').innerHTML = vtSVG();
      paintTab(); pick(byH[S.h] ? S.h : 'k'); nextQ(); paintSc();
      $('#ctab').addEventListener('click', function (e) { var b = e.target.closest('[data-h]'); if (b) pick(b.getAttribute('data-h')); });
      $('#sesletim').addEventListener('click', function (e) {
        var s = e.target.closest('[data-say]'); if (s) { say(s.getAttribute('data-say')); return; }
        var o = e.target.closest('#det-o [data-s]'); if (o) { answerQ(o.getAttribute('data-s')); return; }
        if (e.target.closest('#det-n')) nextQ();
      });
    },
    ctx: function () {
      var u = byH[S.h], y = YER[u.yer], b = BIC[u.bicim];
      return {
        sel: { key: 'dkt.ses.' + u.h, title: 'Ünsüz ' + u.h + ' /' + u.ipa + '/', la: 'Sesletim', rows: [['Yer', y[1]], ['Biçim', b[1]], ['Ötümlülük', u.ot ? 'ötümlü' : 'ötümsüz'], ['Örnek', u.ornek]].concat(S.q ? [['Dedektif sorusu', S.q.h + ' → ' + S.q.c]] : []),
          about: 'öğrenci DKT Lab sesletim atölyesinde Türkçe "' + u.h + '" ünsüzünün üretimine bakıyor' + (S.q ? ' ve "' + S.q.h + ' → ' + S.q.c + '" örneğinde fonolojik süreci bulmaya çalışıyor' : '') + '.' },
        chips: [['uret', '"' + u.h + '" sesi nasıl üretilir?'], ['cift', 'Minimal çift örneği ver'], ['ipucu', 'Dedektif için ipucu ver']]
      };
    },
    classify: function (q) { if (/nasıl üretilir|nerede üretilir/.test(q)) return 'uret'; if (/minimal/.test(q)) return 'cift'; if (/ipucu/.test(q)) return 'ipucu'; return null; },
    answer: function (k) {
      var u = byH[S.h], y = YER[u.yer], b = BIC[u.bicim];
      if (k === 'uret') return '"' + u.h + '" /' + u.ipa + '/: ' + y[1].toLocaleLowerCase('tr') + ' ünsüzü (' + y[2] + '), ' + b[1].toLocaleLowerCase('tr') + ': ' + b[2] + '. ' + (u.ot ? 'Ötümlüdür, ses telleri titrer.' : 'Ötümsüzdür, ses telleri titremez.') + (u.cift ? ' Ötümlülük eşi "' + u.cift + '".' : '') + (u.not ? ' ' + u.not : '');
      if (k === 'cift') { var m = V.MINIMAL.filter(function (p) { return p[0] === S.h || p[1] === S.h; })[0]; return m ? 'Örnek: "' + m[2] + '" – "' + m[3] + '" (' + m[0] + ' / ' + m[1] + '). Yalnızca bir ses değişir, anlam değişir. Terapide çocuk önce farkı duymayı, sonra üretmeyi çalışır.' : '"' + S.h + '" için listede hazır çift yok; aynı konumda yalnızca bu sesi değiştirerek sen bir çift bulmayı dene.'; }
      if (k === 'ipucu' && S.q) { var t = S.q.h, c = S.q.c; return 'İpucu: "' + t + '" ile "' + c + '" arasında ' + (t.length !== c.length ? 'harf sayısı değişmiş; hangi ses ya da hece düşmüş?' : 'aynı yerde farklı bir ses var; o sesin üretim yeri mi, biçimi mi değişmiş?'); }
      return null;
    }
  };
})();
