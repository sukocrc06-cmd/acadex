/* ==========================================================================
   FORMULO · sınav modu, türetme tahtası, rozet ve seri, hata bildir
   (formulo/assets/formulo-plus.js), 08.11.2026. Önek fp-.
   - Sınav modu: ders sayfasında 10/20 soruluk, süreli, karışık seviyeli deneme.
     Sınav sırasında geri bildirim yok; bitince puan, konu dökümü ve adım adım çözüm.
     Yanlışlar hata defterine gider; sonuçlar formulo.sinavlar (son 30).
   - Nereden geliyor?: formulo-turet.js içindeki türetmeler tahtada adım adım açılır.
   - Rozet ve seri: 'formulo:dogru' olayını (soru havuzu, kendini dene, sınav) dinler.
     Seri bir gün atlanınca sıfırlanır. Sayaçlar formulo.istat, çalışılan formüller
     formulo.calisilan, kazanılan rozetler formulo.rozet. Hepsi hesaba eşitlenir.
   - Hata bildir: kartın ⚑ düğmesi. Canlı destek RPC'leri (support_open/support_send)
     ile yönetim panelindeki "Canlı destek" sekmesine düşer. Veritabanı değişikliği yok.
   formulo.js bu betikten sonra yüklenir ve W.FOPLUS'u çizimde kullanır.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, FO = W.FORMULO;
  var SAKIN = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function al(k, v) { try { var x = localStorage.getItem('formulo.' + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } }
  function koy(k, v) { try { localStorage.setItem('formulo.' + k, JSON.stringify(v)); } catch (e) { } if (W.FOBULUT) W.FOBULUT.degisti(k); }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function A() { return W.FORMULO_APP; }
  function S() { return W.FORMULO_SORU; }
  function dil() { return (A() && A().dil()) || al('dil', 'tr') || 'tr'; }
  function ad(o) { return dil() === 'en' ? (o.en || o.tr) : o.tr; }
  function bul(id) { for (var i = 0; i < FO.formuller.length; i++) if (FO.formuller[i].id === id) return FO.formuller[i]; return null; }
  function dersBul(id) { for (var i = 0; i < FO.dersler.length; i++) if (FO.dersler[i].id === id) return FO.dersler[i]; return null; }
  function acadia(mood, pose, size) { return W.FO_ACADIA ? W.FO_ACADIA({ mood: mood, pose: pose, size: size || 72 }) : ''; }

  var Y = {
    tr: {
      sinav: 'Sınav modu', sinavP: 'Süreli deneme: karışık seviyede sorular, sonunda puan ve çözümler.', basla: 'Sınavı başlat', konu: 'Konu', hepsi: 'Hepsi', soruSay: 'Soru sayısı', sure: 'Süre', suresiz: 'Süresiz', dk: 'dk',
      soru: 'Soru', onceki: '← Önceki', sonraki: 'Sonraki →', bitir: 'Sınavı bitir', bos: function (n) { return n + ' soru boş. Yine de bitirilsin mi?'; }, evet: 'Evet, bitir', devam: 'Devam et', cik: 'Sınavdan çık', cikS: 'Sınavdan çıkılsın mı? Cevapların kaydedilmez.',
      kapat: 'Kapat', cevap: 'Cevabın', sonuc: 'Sınav sonucu', sureG: 'Süre', konuD: 'Konu dökümü', inceleme: 'Soruları incele', cozum: 'Çözüm', dogruC: 'Doğrusu', bosC: 'boş', yeniden: 'Yeni sınav', gecmis: 'Son sınavların', uretilemedi: 'Bu konuda yeterli soru üretilemedi; başka bir konu seç.', hataNot: 'Yanlış cevapladığın sorular hata defterine eklendi.',
      kolay: 'Kolay', orta: 'Orta', zor: 'Zor', gen: 'Soru',
      sonucAcd: [[90, 'Kusursuza yakın! Bu konu sende.'], [70, 'Çok iyi. Kalan birkaç soruya çözümden bak.'], [50, 'Yarı yoldasın. Yanlışlar hata defterinde.'], [0, 'Olsun, çözümleri adım adım incele, sonra yeniden dene.']],
      turet: 'Nereden geliyor?', turetB: 'Formülün türetilişi', adimSon: 'Sonraki adım', hepsiniGoster: 'Hepsini göster', bitti: 'İşte formül! Artık nereden geldiğini biliyorsun.', adimN: function (i, n) { return 'Adım ' + i + ' / ' + n; },
      raf: 'Rozetler', seri: 'gün seri', seriYok: 'Bugün bir soru çöz, seri başlasın.', enUzun: 'en uzun', kazandin: 'Yeni rozet', calisilan: 'çalışıldı',
      bildir: 'Hata bildir', bildirB: 'Bu kartta hata mı var?', bildirP: 'Bildirimin Acadex ekibine ulaşır; düzeltince kart güncellenir.', tipler: ['Formül yanlış', 'Hesap ya da sonuç yanlış', 'Yazım ya da çeviri', 'Diğer'], not: 'Kısa not (isteğe bağlı)', notPh: 'Ne gördün? Hangi değerlerde?', gonder: 'Gönder', gonderiliyor: 'Gönderiliyor…', tesekkur: 'Teşekkürler! Bildirimin ekibe ulaştı.', hataG: 'Şu an gönderilemedi. Biraz sonra yeniden dene.', sinirG: 'Kısa sürede çok bildirim gönderildi. Biraz sonra yeniden dene.', tipSec: 'Bir hata türü seç.'
    },
    en: {
      sinav: 'Exam mode', sinavP: 'Timed practice: mixed-level questions, score and solutions at the end.', basla: 'Start exam', konu: 'Topic', hepsi: 'All', soruSay: 'Questions', sure: 'Time', suresiz: 'Untimed', dk: 'min',
      soru: 'Question', onceki: '← Previous', sonraki: 'Next →', bitir: 'Finish exam', bos: function (n) { return n + ' unanswered. Finish anyway?'; }, evet: 'Yes, finish', devam: 'Keep going', cik: 'Leave exam', cikS: 'Leave the exam? Your answers will not be saved.',
      kapat: 'Close', cevap: 'Your answer', sonuc: 'Exam result', sureG: 'Time', konuD: 'By topic', inceleme: 'Review questions', cozum: 'Solution', dogruC: 'Answer', bosC: 'blank', yeniden: 'New exam', gecmis: 'Recent exams', uretilemedi: 'Not enough questions for this topic; pick another.', hataNot: 'Questions you missed were added to your mistake log.',
      kolay: 'Easy', orta: 'Medium', zor: 'Hard', gen: 'Question',
      sonucAcd: [[90, 'Nearly perfect! You own this topic.'], [70, 'Very good. Check the solutions for the rest.'], [50, 'Halfway there. Misses are in your mistake log.'], [0, 'It happens. Go through the solutions, then try again.']],
      turet: 'Where does it come from?', turetB: 'Deriving the formula', adimSon: 'Next step', hepsiniGoster: 'Show all', bitti: 'There it is! Now you know where it comes from.', adimN: function (i, n) { return 'Step ' + i + ' / ' + n; },
      raf: 'Badges', seri: 'day streak', seriYok: 'Solve one question today to start a streak.', enUzun: 'best', kazandin: 'New badge', calisilan: 'practised',
      bildir: 'Report a mistake', bildirB: 'Something wrong on this card?', bildirP: 'Your report goes to the Acadex team; the card is updated once fixed.', tipler: ['Formula is wrong', 'Calculation or result is wrong', 'Typo or translation', 'Other'], not: 'Short note (optional)', notPh: 'What did you see? With which values?', gonder: 'Send', gonderiliyor: 'Sending…', tesekkur: 'Thanks! Your report reached the team.', hataG: 'Could not send right now. Try again shortly.', sinirG: 'Too many reports in a short time. Try again shortly.', tipSec: 'Pick a mistake type.'
    }
  };
  function T(k) { return Y[dil()][k]; }

  /* ======================= seri, sayaçlar, rozetler ======================= */
  function gunStr(d) { return d.toDateString(); }
  function bugunDun(simdi) { var b = simdi ? new Date(simdi) : new Date(), d = new Date(b.getFullYear(), b.getMonth(), b.getDate() - 1); return [gunStr(b), gunStr(d)]; }
  /* saf: bir doğru cevaptan sonra seri (gün atlanınca 1'den başlar) */
  function seriSonraki(s, bugun, dun) {
    s = s || {}; var en = s.en || s.n || 0, n;
    if (s.gun === bugun) return { n: s.n || 1, gun: bugun, en: Math.max(en, s.n || 1) };
    n = s.gun === dun ? (s.n || 0) + 1 : 1;
    return { n: n, gun: bugun, en: Math.max(en, n) };
  }
  /* saf: ekranda görünen seri (dün çözülmediyse kopmuştur) */
  function seriGor(s, bugun, dun) { return s && (s.gun === bugun || s.gun === dun) ? (s.n || 0) : 0; }

  var ROZET = [
    { id: 'ilk', i: '1', tr: 'İlk adım', en: 'First step', trA: 'İlk doğru cevap', enA: 'First correct answer', ol: function (x) { return [x.dogru, 1]; } },
    { id: 'on', i: '10', tr: 'Isınma', en: 'Warm-up', trA: '10 doğru cevap', enA: '10 correct answers', ol: function (x) { return [x.dogru, 10]; } },
    { id: 'elli', i: '50', tr: 'Çalışkan', en: 'Hard worker', trA: '50 doğru cevap', enA: '50 correct answers', ol: function (x) { return [x.dogru, 50]; } },
    { id: 'yuz', i: '100', tr: 'Formül ustası', en: 'Formula master', trA: '100 doğru cevap', enA: '100 correct answers', ol: function (x) { return [x.dogru, 100]; } },
    { id: 'zor5', i: 'Z', tr: 'Zincirci', en: 'Chain solver', trA: '5 zor soru', enA: '5 hard questions', ol: function (x) { return [x.zor, 5]; } },
    { id: 'seri3', i: '3g', tr: 'Üç gün', en: 'Three days', trA: '3 günlük seri', enA: '3-day streak', ol: function (x, s) { return [s.en || s.n || 0, 3]; } },
    { id: 'seri7', i: '7g', tr: 'Bir hafta', en: 'One week', trA: '7 günlük seri', enA: '7-day streak', ol: function (x, s) { return [s.en || s.n || 0, 7]; } },
    { id: 'turet3', i: '∂', tr: 'Meraklı', en: 'Curious', trA: '3 türetmeyi sonuna kadar izle', enA: 'Finish 3 derivations', ol: function (x) { return [x.turetme, 3]; } },
    { id: 'sinav1', i: 'S', tr: 'Sınav provası', en: 'Dry run', trA: 'İlk sınavını bitir', enA: 'Finish your first exam', ol: function (x) { return [x.sinav, 1]; } },
    { id: 'tam', i: '%', tr: 'Tam puan', en: 'Full marks', trA: '10+ soruluk sınavda tam puan', enA: 'Full marks on a 10+ question exam', ol: function (x) { return [x.tam, 1]; } },
    { id: 'kasif', i: '4D', tr: 'Kâşif', en: 'Explorer', trA: '4 farklı derste doğru cevap', enA: 'Correct answers in 4 courses', ol: function (x, s, c) { var d = {}; c.forEach(function (id) { var f = bul(id); if (f) d[f.d] = 1; }); return [Object.keys(d).length, 4]; } },
    { id: 'ogrendim5', i: '✓', tr: 'Hatadan ders', en: 'Learned from it', trA: 'Hata defterinden 5 kaydı “Öğrendim” yap', enA: 'Mark 5 mistakes as “Got it”', ol: function (x) { return [x.ogrendim, 5]; } }
  ];
  var ISTAT0 = { dogru: 0, zor: 0, turetme: 0, sinav: 0, tam: 0, ogrendim: 0 };
  function istat() { var x = al('istat', {}) || {}, r = {}; Object.keys(ISTAT0).forEach(function (k) { r[k] = +x[k] || 0; }); return r; }
  function istatArt(k, n) { var x = istat(); x[k] += n == null ? 1 : n; koy('istat', x); rozetBak(); return x; }
  function rozetDurum() {
    var x = istat(), s = al('seri', {}) || {}, c = al('calisilan', []) || [], k = al('rozet', {}) || {};
    return ROZET.map(function (r) { var o = r.ol(x, s, c); return { r: r, var: o[0], hedef: o[1], tamam: !!k[r.id] || o[0] >= o[1], ts: k[r.id] || 0 }; });
  }
  function rozetBak() {
    var k = al('rozet', {}) || {}, yeni = [];
    rozetDurum().forEach(function (d) { if (d.var >= d.hedef && !k[d.r.id]) { k[d.r.id] = Date.now(); yeni.push(d.r); } });
    if (yeni.length) { koy('rozet', k); yeni.forEach(function (r, i) { setTimeout(function () { tost(r); }, i * 1800); }); rafTazele(); }
    return yeni;
  }
  /* doğru cevap: {id, sev, kaynak} */
  function dogruKaydet(o) {
    if (!o || !o.id) return;
    var x = istat(); x.dogru++; if (o.sev === 'zor') x.zor++; koy('istat', x);
    var c = al('calisilan', []) || []; if (c.indexOf(o.id) < 0) { c.push(o.id); koy('calisilan', c); }
    var bd = bugunDun(), s = al('seri', null), ys = seriSonraki(s, bd[0], bd[1]);
    if (!s || s.gun !== ys.gun || s.n !== ys.n || s.en !== ys.en) koy('seri', ys);
    rozetBak(); rafTazele();
  }
  D.addEventListener('formulo:dogru', function (e) { dogruKaydet(e.detail); });
  /* hata defterinde "Öğrendim" */
  D.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-fq-sil]')) istatArt('ogrendim'); }, true);

  function tost(r) {
    var t = D.createElement('div'); t.className = 'fp-tost'; t.setAttribute('role', 'status');
    t.innerHTML = '<span class="fp-tost-acd">' + acadia('kutlama', 'zipla', 52) + '</span><span><small>' + esc(T('kazandin')) + '</small><b><i class="fp-madalya fp-on">' + esc(r.i) + '</i>' + esc(ad(r)) + '</b><em>' + esc(dil() === 'en' ? r.enA : r.trA) + '</em></span>';
    D.body.appendChild(t);
    setTimeout(function () { t.classList.add('fp-git'); setTimeout(function () { t.remove(); }, 500); }, 4200);
  }
  function rafHTML() {
    var bd = bugunDun(), s = al('seri', null), n = seriGor(s, bd[0], bd[1]), ds = rozetDurum(), kaz = ds.filter(function (d) { return d.tamam; }).length;
    return '<section class="fp-raf" data-fp-raf aria-label="' + esc(T('raf')) + '"><div class="fp-raf-bas"><div class="fp-seri' + (n ? ' fp-seri-on' : '') + '"><b>' + n + '</b><span>' + esc(T('seri')) + '</span>' + (s && s.en ? '<small>' + esc(T('enUzun')) + ': ' + s.en + '</small>' : '') + '</div>' +
      '<div class="fp-raf-yazi"><h2>' + esc(T('raf')) + ' <span>' + kaz + '/' + ROZET.length + '</span></h2>' + (n ? '' : '<p>' + esc(T('seriYok')) + '</p>') + '</div></div>' +
      '<ul class="fp-rozetler">' + ds.map(function (d) {
        var yuzde = Math.min(100, Math.round(100 * d.var / d.hedef));
        return '<li class="fp-rozet' + (d.tamam ? ' fp-on' : '') + '" data-fp-rozet="' + d.r.id + '" title="' + esc(dil() === 'en' ? d.r.enA : d.r.trA) + '"><i class="fp-madalya' + (d.tamam ? ' fp-on' : '') + '" aria-hidden="true">' + esc(d.r.i) + '</i><b>' + esc(ad(d.r)) + '</b><small>' + esc(dil() === 'en' ? d.r.enA : d.r.trA) + '</small>' +
          (d.tamam ? '' : '<span class="fp-cubuk" aria-hidden="true"><i style="width:' + yuzde + '%"></i></span><span class="fo-gizli">' + Math.min(d.var, d.hedef) + '/' + d.hedef + '</span>') + '</li>';
      }).join('') + '</ul></section>';
  }
  function paftaHTML(d) {
    var fs = FO.formuller.filter(function (f) { return f.d === d.id; }), c = al('calisilan', []) || [], n = fs.filter(function (f) { return c.indexOf(f.id) > -1; }).length, p = fs.length ? Math.round(100 * n / fs.length) : 0;
    return '<span class="fp-pafta" data-fp-pafta="' + d.id + '"><span class="fp-cubuk"><i style="width:' + p + '%"></i></span><small>' + n + '/' + fs.length + ' ' + esc(T('calisilan')) + '</small></span>';
  }
  function rafTazele() {
    var r = D.querySelector('[data-fp-raf]'); if (r) r.outerHTML = rafHTML();
    D.querySelectorAll('[data-fp-pafta]').forEach(function (p) { var d = dersBul(p.getAttribute('data-fp-pafta')); if (d) p.outerHTML = paftaHTML(d); });
  }
  D.addEventListener('formulo:bulut', rafTazele);

  /* ======================= katman (ortak) ======================= */
  var acikKatman = null;
  function katman(cls, etiket, ic, kapaninca) {
    kapat();
    var o = D.createElement('div'); o.className = 'fp-ort ' + cls;
    o.innerHTML = '<div class="fp-pen" role="dialog" aria-modal="true" aria-label="' + esc(etiket) + '" tabindex="-1">' + ic + '</div>';
    D.body.appendChild(o); D.body.classList.add('fp-kilit');
    var once = D.activeElement;
    acikKatman = { el: o, son: function () { if (kapaninca) kapaninca(); if (once && once.focus) try { once.focus({ preventScroll: true }); } catch (e) { } } };
    o.addEventListener('mousedown', function (e) { if (e.target === o && !o.__kilitli) kapat(); });
    var p = o.querySelector('.fp-pen'); setTimeout(function () { var f = p.querySelector('[autofocus]') || p; f.focus({ preventScroll: true }); }, 30);
    return o;
  }
  function kapat() { if (!acikKatman) return; var k = acikKatman; acikKatman = null; k.el.remove(); D.body.classList.remove('fp-kilit'); k.son(); }
  D.addEventListener('keydown', function (e) {
    if (!acikKatman) return;
    if (e.key === 'Escape') { e.preventDefault(); var x = acikKatman.el.querySelector('[data-fp-x]'); if (x) x.click(); else kapat(); return; }
    if (e.key === 'Tab') {   /* odak katmanın içinde kalır */
      var fs = [].slice.call(acikKatman.el.querySelectorAll('button:not([disabled]),input:not([disabled]),select,textarea,summary,[tabindex="0"]')).filter(function (x) { return x.offsetParent !== null; });
      if (!fs.length) return; var ilk = fs[0], son = fs[fs.length - 1];
      if (e.shiftKey && D.activeElement === ilk) { e.preventDefault(); son.focus(); } else if (!e.shiftKey && D.activeElement === son) { e.preventDefault(); ilk.focus(); }
    }
  });

  /* ======================= türetme ======================= */
  function turetVar(id) { return !!(W.FORMULO_TURET && W.FORMULO_TURET[id]); }
  function mSatir(m) { return esc(Array.isArray(m) ? (dil() === 'en' ? m[1] : m[0]) : m); }
  function turetAc(f) {
    var adim = W.FORMULO_TURET && W.FORMULO_TURET[f.id]; if (!adim) return;
    var d = dersBul(f.d), i = 0, sayildi = false;
    var o = katman('fp-turet', T('turetB') + ': ' + ad(f),
      '<div class="fp-tahta" style="--c:' + d.renk + '"><header class="fp-bas"><span class="fp-eyb">' + esc(d.kod) + ' · ' + esc(T('turet')) + '</span><h2>' + esc(ad(f)) + '</h2><button type="button" class="fp-x" data-fp-x aria-label="' + esc(T('kapat')) + '">×</button></header>' +
      '<div class="fp-turet-govde"><ol class="fp-adimlar" data-fp-adimlar aria-live="polite"></ol><div class="fp-hedef" data-fp-hedef hidden><div class="fo-f">' + (f.h || '') + '</div></div></div>' +
      '<footer class="fp-alt"><span class="fp-turet-acd" data-fp-acd>' + acadia('odakli', 'isaret', 64) + '</span><p class="fp-balon" data-fp-balon></p><span class="fp-sayac" data-fp-sayac></span>' +
      '<button type="button" class="fo-btn fo-btn-ince" data-fp-hepsi>' + esc(T('hepsiniGoster')) + '</button><button type="button" class="fo-btn" data-fp-ileri autofocus>' + esc(T('adimSon')) + ' →</button></footer></div>');
    var ol = o.querySelector('[data-fp-adimlar]'), balon = o.querySelector('[data-fp-balon]'), say = o.querySelector('[data-fp-sayac]'), ileri = o.querySelector('[data-fp-ileri]'), hepsi = o.querySelector('[data-fp-hepsi]');
    function yaz() {
      if (i >= adim.length) return;
      var a = adim[i]; i++;
      ol.insertAdjacentHTML('beforeend', '<li class="fp-adim' + (SAKIN ? '' : ' fp-yaz') + '"><span>' + esc(dil() === 'en' ? a.en : a.tr) + '</span><div class="fp-m">' + mSatir(a.m) + '</div></li>');
      balon.textContent = dil() === 'en' ? a.en : a.tr;
      say.textContent = T('adimN')(i, adim.length);
      ol.lastElementChild.scrollIntoView({ block: 'nearest' });
      if (i >= adim.length) bitti();
    }
    function bitti() {
      o.querySelector('[data-fp-hedef]').hidden = false; balon.textContent = T('bitti');
      o.querySelector('[data-fp-acd]').innerHTML = acadia('kutlama', 'zipla', 64);
      ileri.hidden = true; hepsi.hidden = true;
      var x = o.querySelector('[data-fp-x]'); if (x) x.focus({ preventScroll: true });
      if (!sayildi) { sayildi = true; istatArt('turetme'); }
    }
    ileri.addEventListener('click', yaz);
    hepsi.addEventListener('click', function () { while (i < adim.length) yaz(); });
    o.querySelector('[data-fp-x]').addEventListener('click', kapat);
    o.addEventListener('keydown', function (e) { if ((e.key === 'ArrowRight') && i < adim.length) { e.preventDefault(); yaz(); } });
    yaz();
  }

  /* ======================= hata bildir ======================= */
  function istemci() { try { return supabaseClient; } catch (e) { return null; } }   /* supabase-config.js */
  function jeton() { var a = new Uint8Array(24); (W.crypto || W.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  async function bildirGonder(f, tip, not) {
    var sb = istemci(); if (!sb) throw new Error('istemci');
    var u = null; try { var r = await sb.auth.getSession(); u = r && r.data && r.data.session && r.data.session.user; } catch (e) { }
    var md = (u && u.user_metadata) || {}, d = dersBul(f.d), tok = jeton();
    var sayfa = (location.pathname + '#/' + f.d + '?f=' + f.id).slice(0, 300);
    var govde = ('[Formulo hata bildirimi]\nTür: ' + tip + '\nFormül: ' + f.id + ' · ' + f.tr + ' (' + (d ? d.kod : f.d) + ')\nDil: ' + dil() + (not ? '\nNot: ' + not : '')).slice(0, 2000);
    var a = await sb.rpc('support_open', { p_token: tok, p_name: (md.full_name || md.name || '').slice(0, 80) || null, p_email: (u && u.email) || null, p_topic: 'Formulo hata', p_page: sayfa });
    if (a && a.error) throw a.error;
    var b = await sb.rpc('support_send', { p_token: tok, p_body: govde });
    if (b && b.error) throw b.error;
    return true;
  }
  function bildirAc(f) {
    var tipler = T('tipler');
    var o = katman('fp-bildir', T('bildir'),
      '<form class="fp-kutu" data-fp-form novalidate><header class="fp-bas"><span class="fp-eyb">⚑ ' + esc(T('bildir')) + '</span><h2>' + esc(T('bildirB')) + '</h2><button type="button" class="fp-x" data-fp-x aria-label="' + esc(T('kapat')) + '">×</button></header>' +
      '<p class="fp-kart-ad"><b>' + esc(ad(f)) + '</b> <small>' + esc(f.id) + '</small></p>' +
      '<fieldset class="fp-tipler"><legend class="fo-gizli">' + esc(T('bildir')) + '</legend>' + tipler.map(function (x, n) { return '<label><input type="radio" name="fp-tip" value="' + n + '"' + (n === 0 ? ' autofocus' : '') + '><span>' + esc(x) + '</span></label>'; }).join('') + '</fieldset>' +
      '<label class="fp-not"><span>' + esc(T('not')) + '</span><textarea maxlength="1000" rows="3" placeholder="' + esc(T('notPh')) + '"></textarea></label>' +
      '<p class="fp-bilgi">' + esc(T('bildirP')) + '</p><p class="fp-durum" data-fp-durum aria-live="polite"></p>' +
      '<footer class="fp-alt-k"><button type="button" class="fo-btn fo-btn-ince" data-fp-vazgec>' + esc(T('kapat')) + '</button><button type="submit" class="fo-btn" data-fp-gonder>' + esc(T('gonder')) + '</button></footer></form>');
    var form = o.querySelector('form'), durum = o.querySelector('[data-fp-durum]'), btn = o.querySelector('[data-fp-gonder]');
    o.querySelector('[data-fp-x]').addEventListener('click', kapat);
    o.querySelector('[data-fp-vazgec]').addEventListener('click', kapat);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var s = form.querySelector('input[name="fp-tip"]:checked');
      if (!s) { durum.className = 'fp-durum fo-no'; durum.textContent = T('tipSec'); return; }
      var tip = Y.tr.tipler[+s.value], not = form.querySelector('textarea').value.replace(/\s+/g, ' ').trim().slice(0, 1000);
      btn.disabled = true; btn.textContent = T('gonderiliyor'); durum.className = 'fp-durum'; durum.textContent = '';
      bildirGonder(f, tip, not).then(function () {
        form.innerHTML = '<div class="fp-tamam"><span>' + acadia('kutlama', 'selam', 72) + '</span><p>' + esc(T('tesekkur')) + '</p><button type="button" class="fo-btn" data-fp-x autofocus>' + esc(T('kapat')) + '</button></div>';
        form.querySelector('[data-fp-x]').addEventListener('click', kapat); form.querySelector('[data-fp-x]').focus();
      }).catch(function (err) {
        var m = String((err && (err.message || err.details)) || err || '');
        durum.className = 'fp-durum fo-no'; durum.textContent = /DESTEK_(SINIR|HIZ)/.test(m) ? T('sinirG') : T('hataG');
        btn.disabled = false; btn.textContent = T('gonder');
      });
    });
  }

  /* ======================= sınav modu ======================= */
  function sinavBarHTML(d) {
    return '<div class="fp-sinav-bar"><p><b>' + esc(T('sinav')) + '</b> ' + esc(T('sinavP')) + '</p><button type="button" class="fo-btn" data-fp-sinav="' + d.id + '">' + esc(T('basla')) + ' →</button></div>';
  }
  function sevSira(n) { var s = []; for (var i = 0; i < n; i++) { var r = i / n; s.push(r < .4 ? 'kolay' : r < .8 ? 'orta' : 'zor'); } return s; }
  function sorular(d, konu, n) {
    var M = S(), out = [], gor = {}, fk = {}, sira = sevSira(n);
    for (var i = 0; i < n; i++) {
      for (var t = 0; t < 30; t++) {
        var q = M.uret(d.id, konu, sira[i]); if (!q || q.yok) break;
        if (!q.f) q.f = FO.formuller.filter(function (x) { return x.d === d.id; })[0];
        var a = M.soruMetni(q) + '|' + M.verilenler(q), fid = q.f.id + '|' + (q.g ? q.g.g : '');
        if (gor[a] && t < 29) continue;               /* aynı soru iki kez gelmez */
        if (fk[fid] && t < 20) continue;              /* önce farklı formüller denenir */
        gor[a] = 1; fk[fid] = 1; q.__sev = q.sev || q.tip; out.push(q); break;
      }
    }
    return out;
  }
  function sureYaz(sn) { sn = Math.max(0, Math.round(sn)); return Math.floor(sn / 60) + ':' + ('0' + (sn % 60)).slice(-2); }
  function konuAd(d, id) { var k = d.konular.filter(function (x) { return x.id === id; })[0]; return k ? ad(k) : id; }
  function sinavAc(did) {
    var d = dersBul(did); if (!d || !S()) return;
    var M = S(), konular = d.konular.filter(function (k) { return FO.formuller.some(function (f) { return f.d === d.id && f.k === k.id && f.o; }) || (W.FORMULO_URET && W.FORMULO_URET.havuz(d.id, k.id).length); });
    var gecmis = (al('sinavlar', []) || []).filter(function (x) { return x.d === d.id; }).slice(0, 5);
    var o = katman('fp-sinav', T('sinav'),
      '<div class="fp-kutu fp-sinav-kutu" style="--c:' + d.renk + '"><header class="fp-bas"><span class="fp-eyb">' + esc(d.kod) + ' · ' + esc(T('sinav')) + '</span><h2>' + esc(ad(d)) + '</h2><button type="button" class="fp-x" data-fp-x aria-label="' + esc(T('kapat')) + '">×</button></header><div class="fp-sinav-ic" data-fp-ic></div></div>');
    var ic = o.querySelector('[data-fp-ic]'), durum = 'kur', zam = 0, x = o.querySelector('[data-fp-x]');
    x.addEventListener('click', function () {
      if (durum !== 'sinav') return kapat();
      var c = ic.querySelector('[data-fp-cik]'); if (c) { c.querySelector('[data-fp-evet]').focus(); return; }
      ic.insertAdjacentHTML('afterbegin', '<div class="fp-onay" data-fp-cik role="alert"><p>' + esc(T('cikS')) + '</p><button type="button" class="fo-btn" data-fp-evet>' + esc(T('cik')) + '</button><button type="button" class="fo-btn fo-btn-ince" data-fp-hayir>' + esc(T('devam')) + '</button></div>');
      var cc = ic.querySelector('[data-fp-cik]'); cc.querySelector('[data-fp-evet]').addEventListener('click', kapat); cc.querySelector('[data-fp-hayir]').addEventListener('click', function () { cc.remove(); }); cc.querySelector('[data-fp-evet]').focus();
    });
    acikKatman.son = (function (eski) { return function () { clearInterval(zam); eski(); }; })(acikKatman.son);

    function kurGor() {
      durum = 'kur'; o.__kilitli = false;
      ic.innerHTML = '<div class="fp-kur"><div class="fp-kur-acd">' + acadia('mutlu', 'selam', 84) + '</div><form data-fp-kur>' +
        '<label class="fp-alan"><span>' + esc(T('konu')) + '</span><select data-fp-konu><option value="">' + esc(T('hepsi')) + '</option>' + konular.map(function (k) { return '<option value="' + k.id + '">' + esc(ad(k)) + '</option>'; }).join('') + '</select></label>' +
        '<fieldset class="fp-alan"><legend>' + esc(T('soruSay')) + '</legend><div class="fp-secim">' + [10, 20].map(function (n, i) { return '<label><input type="radio" name="fp-n" value="' + n + '"' + (i === 0 ? ' checked' : '') + '><span>' + n + '</span></label>'; }).join('') + '</div></fieldset>' +
        '<fieldset class="fp-alan"><legend>' + esc(T('sure')) + '</legend><div class="fp-secim">' + [[15, '15 ' + T('dk')], [30, '30 ' + T('dk')], [0, T('suresiz')]].map(function (s, i) { return '<label><input type="radio" name="fp-sure" value="' + s[0] + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(s[1]) + '</span></label>'; }).join('') + '</div></fieldset>' +
        '<p class="fp-durum" data-fp-durum aria-live="polite"></p><button type="submit" class="fo-btn" autofocus>' + esc(T('basla')) + ' →</button></form>' +
        (gecmis.length ? '<div class="fp-gecmis"><b>' + esc(T('gecmis')) + '</b><ul>' + gecmis.map(function (g) { var t = new Date(g.ts); return '<li><span>' + ('0' + t.getDate()).slice(-2) + '.' + ('0' + (t.getMonth() + 1)).slice(-2) + '</span><span>' + esc(g.konu ? konuAd(d, g.konu) : T('hepsi')) + '</span><b>' + g.dogru + '/' + g.n + '</b></li>'; }).join('') + '</ul></div>' : '') + '</div>';
      var form = ic.querySelector('form');
      form.querySelector('[autofocus]').focus({ preventScroll: true });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var konu = form.querySelector('[data-fp-konu]').value, n = +form.querySelector('input[name="fp-n"]:checked').value, sure = +form.querySelector('input[name="fp-sure"]:checked').value;
        var qs = sorular(d, konu, n);
        if (qs.length < Math.min(5, n)) { var p = form.querySelector('[data-fp-durum]'); p.className = 'fp-durum fo-no'; p.textContent = T('uretilemedi'); return; }
        sinav(qs, konu, sure * 60);
      });
    }

    function sinav(qs, konu, sureSn) {
      durum = 'sinav'; o.__kilitli = true;
      var cvp = qs.map(function () { return null; }), i = 0, bas = Date.now();
      ic.innerHTML = '<div class="fp-sinav-ust"><span data-fp-no></span><span class="fp-saat" data-fp-saat' + (sureSn ? '' : ' hidden') + ' role="timer"></span></div>' +
        '<nav class="fp-numaralar" aria-label="' + esc(T('soru')) + '">' + qs.map(function (q, n) { return '<button type="button" data-fp-git="' + n + '" aria-label="' + esc(T('soru')) + ' ' + (n + 1) + '">' + (n + 1) + '</button>'; }).join('') + '</nav>' +
        '<div class="fp-soru" data-fp-soru></div><div data-fp-bitir-onay></div>' +
        '<footer class="fp-sinav-alt"><button type="button" class="fo-btn fo-btn-ince" data-fp-onceki>' + esc(T('onceki')) + '</button><button type="button" class="fo-btn fo-btn-ince" data-fp-sonraki>' + esc(T('sonraki')) + '</button><button type="button" class="fo-btn" data-fp-bitir>' + esc(T('bitir')) + '</button></footer>';
      var alan = ic.querySelector('[data-fp-soru]');
      function kaydet() { var inp = alan.querySelector('input[type="text"]'); if (inp) { var v = inp.value.trim(); cvp[i] = v ? v : null; } }
      function numara() { ic.querySelectorAll('[data-fp-git]').forEach(function (b, n) { b.classList.toggle('fp-dolu', cvp[n] != null); b.setAttribute('aria-current', n === i ? 'step' : 'false'); }); }
      function goster(n) {
        kaydet(); i = Math.max(0, Math.min(qs.length - 1, n)); var q = qs[i];
        ic.querySelector('[data-fp-no]').textContent = T('soru') + ' ' + (i + 1) + ' / ' + qs.length;
        alan.innerHTML = '<p class="fq-etiket"><span class="fq-sev-e fq-' + q.__sev + '">' + esc(T(q.__sev) || q.__sev) + '</span>' + esc(konuAd(d, q.f.k)) + '</p>' +
          '<p class="fq-metin">' + M.soruMetni(q) + '</p><p class="fq-ver">' + M.verilenler(q) + '</p>' +
          (q.mc ? '<div class="fq-siklar" role="radiogroup">' + q.mc.map(function (m, j) { return '<button type="button" role="radio" class="fq-sik" data-fp-sik="' + j + '" aria-checked="' + (cvp[i] === j) + '"><i>' + 'ABCD'[j] + '</i><span>' + m + '</span></button>'; }).join('') + '</div>'
            : '<form class="fq-form" data-fp-cf><label><span class="fq-s">' + q.s + ' =</span><input type="text" inputmode="decimal" autocomplete="off" aria-label="' + esc(T('cevap')) + '" value="' + esc(cvp[i] == null ? '' : cvp[i]) + '"><em>' + esc(q.birim) + '</em></label></form>');
        alan.querySelectorAll('[data-fp-sik]').forEach(function (b) { b.addEventListener('click', function () { cvp[i] = +b.getAttribute('data-fp-sik'); alan.querySelectorAll('[data-fp-sik]').forEach(function (x) { x.setAttribute('aria-checked', x === b); }); numara(); }); });
        var cf = alan.querySelector('[data-fp-cf]');
        if (cf) { var inp = cf.querySelector('input'); inp.addEventListener('input', function () { kaydet(); numara(); }); cf.addEventListener('submit', function (e) { e.preventDefault(); goster(i + 1); }); inp.focus({ preventScroll: true }); }
        ic.querySelector('[data-fp-onceki]').disabled = i === 0; ic.querySelector('[data-fp-sonraki]').disabled = i === qs.length - 1;
        ic.querySelector('[data-fp-bitir-onay]').innerHTML = '';
        numara();
      }
      ic.querySelectorAll('[data-fp-git]').forEach(function (b) { b.addEventListener('click', function () { goster(+b.getAttribute('data-fp-git')); }); });
      ic.querySelector('[data-fp-onceki]').addEventListener('click', function () { goster(i - 1); });
      ic.querySelector('[data-fp-sonraki]').addEventListener('click', function () { goster(i + 1); });
      ic.querySelector('[data-fp-bitir]').addEventListener('click', function () {
        kaydet(); numara(); var bos = cvp.filter(function (c) { return c == null; }).length;
        if (!bos) return bitir();
        var y = ic.querySelector('[data-fp-bitir-onay]');
        y.innerHTML = '<div class="fp-onay" role="alert"><p>' + esc(T('bos')(bos)) + '</p><button type="button" class="fo-btn" data-fp-evet>' + esc(T('evet')) + '</button><button type="button" class="fo-btn fo-btn-ince" data-fp-hayir>' + esc(T('devam')) + '</button></div>';
        y.querySelector('[data-fp-evet]').addEventListener('click', bitir); y.querySelector('[data-fp-hayir]').addEventListener('click', function () { y.innerHTML = ''; });
        y.querySelector('[data-fp-evet]').focus();
      });
      var saat = ic.querySelector('[data-fp-saat]');
      function tik() {
        var kalan = sureSn - (Date.now() - bas) / 1000;
        saat.textContent = sureYaz(kalan); saat.classList.toggle('fp-az', kalan <= 60);
        if (kalan <= 0) bitir();
      }
      if (sureSn) { tik(); zam = setInterval(tik, 1000); }
      var bitti = false;
      function bitir() {
        if (bitti) return; bitti = true; clearInterval(zam); kaydet();
        sonucGor(qs, cvp, konu, Math.round((Date.now() - bas) / 1000));
      }
      goster(0);
    }

    function sonucGor(qs, cvp, konu, gecen) {
      durum = 'sonuc'; o.__kilitli = false;
      var ok = qs.map(function (q, n) { var c = cvp[n]; if (c == null) return false; return q.mc ? c === q.dogruI : M.dogruMu(M.oku(c), q.dogru); });
      var dogru = ok.filter(Boolean).length, yuzde = Math.round(100 * dogru / qs.length), kd = {};
      qs.forEach(function (q, n) { var k = q.f.k; kd[k] = kd[k] || { d: 0, t: 0 }; kd[k].t++; if (ok[n]) kd[k].d++; });
      /* kayıtlar: hata defteri, sınav geçmişi, sayaçlar */
      var yanlisVar = false;
      qs.forEach(function (q, n) {
        if (ok[n]) D.dispatchEvent(new CustomEvent('formulo:dogru', { detail: { id: q.f.id, d: q.f.d, sev: q.__sev, kaynak: 'sinav' } }));
        else if (cvp[n] != null && M.hataEkle) { M.hataEkle(q, q.mc ? q.mc[cvp[n]] : cvp[n]); yanlisVar = true; }
      });
      var g = al('sinavlar', []) || []; g.unshift({ ts: Date.now(), d: d.id, konu: konu || '', n: qs.length, dogru: dogru, sure: gecen }); koy('sinavlar', g.slice(0, 30));
      var x = istat(); x.sinav++; if (qs.length >= 10 && dogru === qs.length) x.tam++; koy('istat', x); rozetBak(); rafTazele();
      var acdM = T('sonucAcd').filter(function (a) { return yuzde >= a[0]; })[0][1];
      ic.innerHTML = '<div class="fp-sonuc"><div class="fp-skor" style="--p:' + yuzde + '"><b>' + dogru + '<small>/' + qs.length + '</small></b><span>%' + yuzde + '</span></div>' +
        '<div class="fp-sonuc-yazi"><h3>' + esc(T('sonuc')) + '</h3><p class="fp-sonuc-acd"><span>' + acadia(yuzde >= 70 ? 'kutlama' : yuzde >= 50 ? 'mutlu' : 'dusunuyor', yuzde >= 70 ? 'zipla' : 'dusun', 60) + '</span>' + esc(acdM) + '</p>' +
        '<p class="fp-meta">' + esc(T('sureG')) + ': <b>' + sureYaz(gecen) + '</b>' + (yanlisVar ? ' · ' + esc(T('hataNot')) : '') + '</p></div></div>' +
        '<h4 class="fp-h4">' + esc(T('konuD')) + '</h4><ul class="fp-konu-d">' + Object.keys(kd).map(function (k) { var p = Math.round(100 * kd[k].d / kd[k].t); return '<li><span>' + esc(konuAd(d, k)) + '</span><span class="fp-cubuk"><i style="width:' + p + '%"></i></span><b>' + kd[k].d + '/' + kd[k].t + '</b></li>'; }).join('') + '</ul>' +
        '<h4 class="fp-h4">' + esc(T('inceleme')) + '</h4><ol class="fp-inceleme">' + qs.map(function (q, n) {
          var c = cvp[n], cH = c == null ? '<i>' + esc(T('bosC')) + '</i>' : q.mc ? q.mc[c] : esc(c + (q.birim ? ' ' + q.birim : ''));
          return '<li class="' + (ok[n] ? 'fp-iyi' : 'fp-kotu') + '"><details><summary><span class="fp-isaret">' + (ok[n] ? '✓' : '✗') + '</span><span class="fp-ozet">' + (n + 1) + '. ' + esc(konuAd(d, q.f.k)) + ' · ' + esc(T(q.__sev) || q.__sev) + '</span></summary>' +
            '<p class="fq-metin">' + M.soruMetni(q) + '</p><p class="fq-ver">' + M.verilenler(q) + '</p><p class="fp-cv">' + esc(T('cevap')) + ': ' + cH + ' · ' + esc(T('dogruC')) + ': <b>' + M.cevapHTML(q) + '</b></p>' +
            '<div class="fp-coz"><b>' + esc(T('cozum')) + '</b>' + M.cozum(q) + '</div></details></li>';
        }).join('') + '</ol>' +
        '<footer class="fp-sinav-alt"><button type="button" class="fo-btn fo-btn-ince" data-fp-kapat>' + esc(T('kapat')) + '</button><button type="button" class="fo-btn" data-fp-yeniden>' + esc(T('yeniden')) + ' ↻</button></footer>';
      ic.querySelector('[data-fp-kapat]').addEventListener('click', kapat);
      ic.querySelector('[data-fp-yeniden]').addEventListener('click', function () { gecmis = (al('sinavlar', []) || []).filter(function (x) { return x.d === d.id; }).slice(0, 5); kurGor(); });
      ic.querySelector('[data-fp-yeniden]').focus({ preventScroll: true });
      o.querySelector('.fp-pen').scrollTop = 0;
    }
    kurGor();
  }

  /* ders sayfası ve kart düğmeleri (formulo.js her çizimde yeniden kurar; olay tek yerden) */
  D.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-fp-sinav],[data-turet],[data-bildir]'); if (!b) return;
    if (b.hasAttribute('data-fp-sinav')) return sinavAc(b.getAttribute('data-fp-sinav'));
    var c = b.closest('[data-f]'), f = c && bul(c.getAttribute('data-f')); if (!f) return;
    if (b.hasAttribute('data-turet')) { turetAc(f); koy('son', { d: f.d, k: f.k, id: f.id, ts: Date.now() }); }
    else bildirAc(f);
  });

  W.FOPLUS = {
    T: T, turetVar: turetVar, turetAc: turetAc, bildirAc: bildirAc, bildirGonder: bildirGonder, sinavAc: sinavAc, sinavBarHTML: sinavBarHTML, sorular: sorular, sevSira: sevSira,
    rafHTML: rafHTML, paftaHTML: paftaHTML, ROZET: ROZET, rozetDurum: rozetDurum, rozetBak: rozetBak, istat: istat, dogruKaydet: dogruKaydet,
    seriSonraki: seriSonraki, seriGor: seriGor, bugunDun: bugunDun, kapat: kapat
  };
})(window);
