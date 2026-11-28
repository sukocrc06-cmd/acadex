/* ================= ACADEX MEDLAB · ORTAK PROFİL VE UNVAN (js/acadex-medlab-profil.js), 28.11.2026 =================
   Bütün MedLab laboratuvarları için tek XP ve tek unvan. Ayrı bir kayıt tutmaz: XP, her lab'ın kendi
   localStorage ilerlemesinden HER SEFERİNDE yeniden hesaplanır (geriye dönük çalışır, lab'lar arası çakışmaz).
   Kaynaklar (anahtar → puan):
     Anatomi + Fizyo  axAnat2.seen ×2 (en çok 600 yapı) · ok ×5 · caseDone ×25 · fzOsce ×15 · fzPrac ×5
     Medica           acadex.medica.gorulen: hasta başına 20 + puan/5 · defter: nöbet başına 40 + ort/2,
                      triyajda doğru başına 5, başarılı kod (≥70) 30
     Cihaz Deposu     acadex.depo.gor ×2 · sim ×10
     Diyet Lab        acadex.diyet.gdone / antroDone / epDone ×10
     Odyoloji Lab     acadex.odyo.kabinDone ×10 · vakaDone ×20
   DKT, Eczacılık ve Hemşirelik vakaları Medica üzerinden açıldığında Medica'ya sayılır.
   Kullanım: AXPROFIL.hesap() → { xp, unvan, sonraki, oran, lab: {anatomi, medica, ...} }
   Dashboard'da #medlab-view içindeki [data-medlab-profil] kartını da çizer (varsa).
   ================================================================================================= */
(function (W) {
  'use strict';
  var D = W.document;
  var oku = function (k, d) { try { var v = W.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  var yaz = function (k, v) { try { W.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  var say = function (x) { return Array.isArray(x) ? x.length : x && typeof x === 'object' ? Object.keys(x).length : 0; };

  /* unvan basamakları (en az XP) */
  var UNVAN = [
    { id: 'stajyer', ad: 'Stajyer', xp: 0, renk: '#7C8AA5' },
    { id: 'intorn', ad: 'İntörn', xp: 300, renk: '#2E8C82' },
    { id: 'asistan', ad: 'Asistan', xp: 1000, renk: '#2F6BFF' },
    { id: 'uzman', ad: 'Uzman', xp: 2500, renk: '#7A4FA8' },
    { id: 'docent', ad: 'Doçent', xp: 5000, renk: '#C9483B' },
    { id: 'profesor', ad: 'Profesör', xp: 9000, renk: '#C99A2E' }
  ];
  var LAB_AD = { anatomi: 'Anatomi ve Fizyo', medica: 'Medica hastanesi', depo: 'Cihaz Deposu', diyet: 'Diyet Lab', odyo: 'Odyoloji Lab' };

  function unvanOf(xp) { var u = UNVAN[0]; for (var i = 0; i < UNVAN.length; i++) if (xp >= UNVAN[i].xp) u = UNVAN[i]; return u; }
  function sira(id) { for (var i = 0; i < UNVAN.length; i++) if (UNVAN[i].id === id) return i; return -1; }
  /* hasta puanı: medica-veri.js V.hastaPuan ile aynı kural */
  function hastaPuan(r) { if (!r || r.sahne == null) return null; return r.lab == null ? r.sahne : Math.round((r.sahne + r.lab) / 2); }
  function nobetOrt(n) {
    var g = (n && n.hastalar || []).filter(function (h) { return h.sahne != null; });
    return g.length ? Math.round(g.reduce(function (a, h) { return a + hastaPuan(h); }, 0) / g.length) : 0;
  }

  /* lab başına XP; kaynak verilirse (test) localStorage yerine ondan okunur */
  function labXP(o) {
    var g = o ? function (k, d) { return k in o ? o[k] : d; } : oku;
    var x = {};
    x.anatomi = Math.min(600, say(g('axAnat2.seen', []))) * 2 + say(g('axAnat2.ok', [])) * 5 + say(g('axAnat2.caseDone', [])) * 25 + say(g('axAnat2.fzOsce', [])) * 15 + say(g('axAnat2.fzPrac', {})) * 5;
    var gor = g('acadex.medica.gorulen', {}) || {}, def = g('acadex.medica.defter', []) || [], m = 0;
    Object.keys(gor).forEach(function (id) { var p = hastaPuan(gor[id]); m += 20 + (p == null ? 0 : Math.round(p / 5)); });
    def.forEach(function (n) { m += 40 + Math.round(nobetOrt(n) / 2); if (n.triyaj && !n.triyaj.atlandi) m += 5 * (n.triyaj.dogru || 0); if (n.kod && n.kod.puan != null && n.kod.puan >= 70) m += 30; });
    x.medica = m;
    x.depo = say(g('acadex.depo.gor', [])) * 2 + say(g('acadex.depo.sim', {})) * 10;
    x.diyet = (say(g('acadex.diyet.gdone', {})) + say(g('acadex.diyet.antroDone', {})) + say(g('acadex.diyet.epDone', {}))) * 10;
    x.odyo = say(g('acadex.odyo.kabinDone', {})) * 10 + say(g('acadex.odyo.vakaDone', {})) * 20;
    return x;
  }
  function hesap(o) {
    var lab = labXP(o), xp = 0; Object.keys(lab).forEach(function (k) { xp += lab[k]; });
    var u = unvanOf(xp), i = sira(u.id), s = UNVAN[i + 1] || null;
    return { xp: xp, unvan: u, sonraki: s, oran: s ? (xp - u.xp) / (s.xp - u.xp) : 1, lab: lab, sira: i };
  }
  /* unvan en az şu basamakta mı? */
  function enAz(id, p) { return (p || hesap()).sira >= sira(id); }

  /* ---------------- dashboard kartı ---------------- */
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var nf = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  function kartHtml(p, yeni) {
    var labs = Object.keys(p.lab).filter(function (k) { return p.lab[k] > 0; }).sort(function (a, b) { return p.lab[b] - p.lab[a]; });
    return '<div class="axp-kart' + (yeni ? ' axp-yeni' : '') + '" style="--uc:' + p.unvan.renk + '">' +
      '<div class="axp-yaka" aria-hidden="true"><i class="axp-ip"></i><span class="axp-foto"><svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="7"/><path d="M7 36c1-8 6-12 13-12s12 4 13 12"/></svg></span><b>' + X(p.unvan.ad.toLocaleUpperCase('tr')) + '</b><small>ACADEX MEDLAB</small></div>' +
      '<div class="axp-g"><span class="hand axp-e">MedLab profilin</span><h2 class="disp">' + X(p.unvan.ad) + (yeni ? ' <em class="axp-rozet">yeni unvan</em>' : '') + '</h2>' +
      '<p class="axp-s"><b class="mono">' + nf(p.xp) + ' XP</b>' + (p.sonraki ? ' · ' + X(p.sonraki.ad) + ' için ' + nf(p.sonraki.xp - p.xp) + ' XP' : ' · en üst basamak') + '</p>' +
      '<div class="axp-bar" role="progressbar" aria-label="Sonraki unvana ilerleme" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(p.oran * 100) + '"><i style="width:' + Math.round(p.oran * 100) + '%"></i></div>' +
      '<ol class="axp-merd" aria-label="Unvan basamakları">' + UNVAN.map(function (u, i) { return '<li class="' + (i < p.sira ? 'gecti' : i === p.sira ? 'simdi' : '') + '" style="--c:' + u.renk + '"><i></i><span>' + X(u.ad) + '</span></li>'; }).join('') + '</ol>' +
      (labs.length ? '<ul class="axp-lab" aria-label="XP kaynakları">' + labs.map(function (k) { return '<li><span>' + X(LAB_AD[k]) + '</span><b class="mono">' + nf(p.lab[k]) + '</b></li>'; }).join('') + '</ul>'
        : '<p class="axp-bos">Bir laboratuvara gir, hasta gör, yapı incele: XP buradan birikir.</p>') +
      '</div></div>';
  }
  function ciz() {
    var el = D.querySelector('[data-medlab-profil]'); if (!el) return;
    var p = hesap(), eski = oku('acadex.medlab.unvanGor', null), yeni = eski != null && sira(eski) < p.sira;
    el.innerHTML = kartHtml(p, yeni);
    if (eski !== p.unvan.id) yaz('acadex.medlab.unvanGor', p.unvan.id);
  }
  W.AXPROFIL = { UNVAN: UNVAN, LAB_AD: LAB_AD, hesap: hesap, labXP: labXP, unvanOf: unvanOf, sira: sira, enAz: enAz, hastaPuan: hastaPuan, nobetOrt: nobetOrt, ciz: ciz, kartHtml: kartHtml };
  if (D && D.querySelector) {
    var t = null, sonra = function () { clearTimeout(t); t = setTimeout(ciz, 150); };
    if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', ciz); else ciz();
    W.addEventListener('storage', function (e) { if (!e.key || /^(axAnat2|acadex\.(medica|depo|diyet|odyo))\./.test(e.key)) sonra(); });
    W.addEventListener('focus', sonra);
    D.addEventListener('visibilitychange', function () { if (!D.hidden) sonra(); });
    W.addEventListener('acadex:medlab-kapandi', sonra);
  }
})(window);
