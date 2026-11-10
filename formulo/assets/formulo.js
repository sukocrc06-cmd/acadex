/* ==========================================================================
   FORMULO · uygulama (formulo/assets/formulo.js), 08.11.2026
   Görünümler: #/ masa (8 pafta) · #/<ders> ders sayfası · #/deste kayıtlı kartlar.
   Canlı formül kartı: değişkene dokun → anlamı ve birimi; kaydırıcı → sonuç;
   "kendini dene" → rastgele değerle soru; yıldız → desteye ekle; lab → yan panel.
   Dil TR/EN (localStorage formulo.dil), deste (formulo.deste), son çalışılan (formulo.son).
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, FO = W.FORMULO, LAB = W.FOLAB;
  var SAKIN = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function al(k, v) { try { var x = localStorage.getItem('formulo.' + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } }
  function koy(k, v) { try { localStorage.setItem('formulo.' + k, JSON.stringify(v)); } catch (e) { } if (W.FOBULUT) W.FOBULUT.degisti(k); }   /* hesaba kayıt: formulo-bulut.js */
  var dil = al('dil', 'tr'), deste = al('deste', []);
  var Y = {
    tr: { anlat: 'Acadia anlatsın', sekF: 'Formüller', sekS: 'Soru havuzu', sekA: 'Acadia’ya sor', masa: 'Masa', deste: 'Deste', formul: 'formül', lab: 'lab', geri: '← Masa', kitap: 'Kaynak kitaplar', konular: 'Konular', hepsi: 'Hepsi', labAc: 'Labda aç', dene: 'Kendini dene', kontrol: 'Kontrol et', yeni: 'Yeni soru', vazgec: 'Kapat', dogru: 'Doğru!', yanlis: 'Olmadı. Doğrusu', cevap: 'Cevabın', ekle: 'Desteye ekle', cikar: 'Desteden çıkar', bos: 'Destende henüz kart yok. Bir formülün yıldızına dokun.', labBos: 'Bir formülde "Labda aç"a dokun ya da aşağıdan bir lab seç.', lablar: 'Lablar', degisken: 'değişkene dokun: anlamı ve birimi', sonuc: 'sonuç', tablo: 'tablo', kapat: 'Kapat',
      bas1: 'Mühendislik formül atölyesi', bas2: 'Formüller,', bas3: 'canlı.', basP: 'Calculus’tan sayısal yöntemlere sekiz ortak ders. Her formülün harfine dokun, değeri kaydır, sonucu ve grafiği anında gör.', ders: 'ders', ac: 'Paftayı aç', antet: ['PROJE', 'ÇİZEN', 'ÖLÇEK', 'TARİH', 'PAFTA'] },
    en: { anlat: 'Acadia explains', sekF: 'Formulas', sekS: 'Question pool', sekA: 'Ask Acadia', masa: 'Desk', deste: 'Deck', formul: 'formulas', lab: 'labs', geri: '← Desk', kitap: 'Textbooks', konular: 'Topics', hepsi: 'All', labAc: 'Open in lab', dene: 'Test yourself', kontrol: 'Check', yeni: 'New question', vazgec: 'Close', dogru: 'Correct!', yanlis: 'Not quite. Answer', cevap: 'Your answer', ekle: 'Add to deck', cikar: 'Remove from deck', bos: 'Your deck is empty. Tap a formula’s star.', labBos: 'Tap "Open in lab" on a formula, or pick a lab below.', lablar: 'Labs', degisken: 'tap a variable: meaning and unit', sonuc: 'result', tablo: 'table', kapat: 'Close',
      bas1: 'Engineering formula workshop', bas2: 'Formulas,', bas3: 'alive.', basP: 'Eight shared courses, from Calculus to numerical methods. Tap any symbol, slide a value, and watch the result and the graph update.', ders: 'courses', ac: 'Open sheet', antet: ['PROJECT', 'DRAWN BY', 'SCALE', 'DATE', 'SHEET'] }
  };
  var t = function (k) { return Y[dil][k]; };
  var ad = function (o) { return dil === 'en' ? (o.en || o.tr) : o.tr; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function sayi(n, sig) {
    if (n == null || !isFinite(n)) return '—';
    var a = Math.abs(n), s;
    if (a !== 0 && (a >= 1e6 || a < 1e-3)) {
      var e = Math.floor(Math.log10(a)), m = n / Math.pow(10, e), sup = String(e).replace(/-/g, '⁻').replace(/\d/g, function (d) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]; });
      s = (+m.toFixed(3)) + ' × 10' + sup;
    } else s = String(+n.toPrecision(sig || 4));
    return dil === 'en' ? s : s.replace('.', ',');
  }
  function dersBul(id) { for (var i = 0; i < FO.dersler.length; i++) if (FO.dersler[i].id === id) return FO.dersler[i]; return null; }
  function formulBul(id) { for (var i = 0; i < FO.formuller.length; i++) if (FO.formuller[i].id === id) return FO.formuller[i]; return null; }

  /* ---------- mini şemalar (paftalar için, animasyonlu SVG) ---------- */
  var SEMA = {
    calc1: '<path class="sm-e" d="M10 92 C 50 92, 70 20, 110 30 S 170 70, 190 20"/><line class="sm-t sm-turev" x1="40" y1="86" x2="150" y2="10"/><circle class="sm-n sm-turev-n" cx="96" cy="44" r="5"/>',
    calc2: '<path class="sm-e" d="M10 60 C 30 20, 50 20, 70 60 S 110 100, 130 60 S 170 20, 190 60"/><path class="sm-t sm-taylor" d="M40 100 Q 100 -30 160 100"/><g class="sm-bar"><rect x="20" y="96" width="10" height="0"/><rect x="36" y="96" width="10" height="0"/><rect x="52" y="96" width="10" height="0"/></g>',
    fiz1: '<path class="sm-e sm-yay" d="M14 96 Q 100 -20 186 96"/><line class="sm-z" x1="6" y1="98" x2="196" y2="98"/><circle class="sm-n" r="6" cx="0" cy="0">' + (SAKIN ? '' : '<animateMotion dur="2.8s" repeatCount="2" fill="freeze" path="M14 96 Q 100 -20 186 96" keyPoints="0;1;1" keyTimes="0;.8;1" calcMode="linear"/>') + '</circle>',
    fiz2: '<path class="sm-e sm-dalga" d="M0 60 Q 12.5 20 25 60 T 50 60 T 75 60 T 100 60 T 125 60 T 150 60 T 175 60 T 200 60 T 225 60 T 250 60"/><circle class="sm-n" cx="40" cy="60" r="7"/><circle class="sm-n sm-n2" cx="160" cy="60" r="7"/>',
    lin: '<g class="sm-izg"><path class="sm-e" d="M30 20 L30 100 M60 20 L60 100 M90 20 L90 100 M120 20 L120 100 M150 20 L150 100 M20 40 L170 40 M20 70 L170 70 M20 95 L170 95"/></g><path class="sm-t sm-kare" d="M60 70 L90 70 L90 40 L60 40 Z"/>',
    dif: '<g class="sm-alan"><path d="M20 30 l10 -6 M50 30 l10 -4 M80 30 l10 0 M110 30 l10 4 M140 30 l10 6 M20 60 l10 -3 M50 60 l10 -1 M80 60 l10 2 M110 60 l10 5 M140 60 l10 8 M20 90 l10 0 M50 90 l10 2 M80 90 l10 5 M110 90 l10 8 M140 90 l10 10"/></g><path class="sm-e sm-coz" d="M14 70 C 60 66, 110 60, 186 20"/>',
    ist: '<path class="sm-e" d="M10 96 C 60 96, 70 14, 100 14 S 140 96, 190 96"/><path class="sm-dolu" d="M70 96 C 78 60, 86 14, 100 14 S 122 60, 130 96 Z"/>',
    say: '<path class="sm-e" d="M10 100 C 70 98, 120 70, 190 10"/><line class="sm-z" x1="6" y1="80" x2="196" y2="80"/><path class="sm-t sm-nr" d="M170 24 L118 80 M118 58 L96 80"/><circle class="sm-n" cx="96" cy="80" r="5"/>'
  };

  /* ---------- üst çubuk ---------- */
  function ust() {
    var u = D.getElementById('fo-ust'); if (!u) return;
    u.querySelector('[data-fo-dil="tr"]').setAttribute('aria-pressed', dil === 'tr');
    u.querySelector('[data-fo-dil="en"]').setAttribute('aria-pressed', dil === 'en');
    u.querySelector('[data-fo-deste] b').textContent = deste.length;
    u.querySelector('[data-fo-deste] span').textContent = t('deste');
    u.querySelector('[data-fo-masa]').textContent = t('masa');
    D.documentElement.lang = dil;
  }

  /* ---------- MASA ---------- */
  function masa() {
    var labSay = Object.keys(FO.lablar).length, bugun = new Date();
    var tarih = ('0' + bugun.getDate()).slice(-2) + '.' + ('0' + (bugun.getMonth() + 1)).slice(-2) + '.' + bugun.getFullYear();
    var h = '<section class="fo-bas"><div class="fo-bas-yazi"><span class="fo-eyb">' + t('bas1') + ' · by Acadex</span>' +
      '<h1 class="fo-h1">' + t('bas2') + ' <em>' + t('bas3') + '</em></h1><p class="fo-p">' + t('basP') + '</p>' +
      '<ul class="fo-sayac"><li><b>' + FO.dersler.length + '</b> ' + t('ders') + '</li><li><b>' + FO.formuller.length + '</b> ' + t('formul') + '</li><li><b>' + labSay + '</b> ' + t('lab') + '</li></ul></div>' +
      '<div class="fo-tanitim">' + (W.FORMULO_TANITIM ? W.FORMULO_TANITIM.html() : '') + '</div></section>';
    h += '<section class="fo-paftalar" aria-label="' + (dil === 'en' ? 'Courses' : 'Dersler') + '">';
    FO.dersler.forEach(function (d, i) {
      var fs = FO.formuller.filter(function (f) { return f.d === d.id; }), ls = {}; fs.forEach(function (f) { if (f.lab) ls[f.lab] = 1; });
      h += '<a class="fo-pafta" href="#/' + d.id + '" style="--c:' + d.renk + ';--i:' + i + '">' +
        '<span class="fo-pafta-kod">' + d.kod + ' · ' + esc(d.sinif) + '</span>' +
        '<b class="fo-pafta-ad">' + esc(ad(d)) + '</b><span class="fo-pafta-alt">' + esc(dil === 'en' ? (d.tr === d.en ? d.alt : d.tr) : d.alt) + '</span>' +
        '<svg class="fo-sema fo-sema-' + d.id + '" viewBox="0 0 200 110" aria-hidden="true">' + SEMA[d.id] + '</svg>' +
        '<span class="fo-pafta-say">' + fs.length + ' ' + t('formul') + ' · ' + Object.keys(ls).length + ' ' + t('lab') + '</span>' +
        (W.FOPLUS ? W.FOPLUS.paftaHTML(d) : '') +
        '<span class="fo-pafta-kitap">' + esc(d.kitap[0]) + '</span>' +
        '<span class="fo-pafta-no">' + ('0' + (i + 1)).slice(-2) + '/08</span></a>';
    });
    h += '</section>';
    if (W.FOPLUS) h += W.FOPLUS.rafHTML();   /* rozetler ve seri: formulo-plus.js */
    h += '<section class="fo-antet" aria-hidden="true"><span><small>' + t('antet')[0] + '</small>Formulo</span><span><small>' + t('antet')[1] + '</small>Acadia</span><span><small>' + t('antet')[2] + '</small>1:1</span><span><small>' + t('antet')[3] + '</small>' + tarih + '</span><span><small>' + t('antet')[4] + '</small>A0 · 8</span></section>';
    return h;
  }
  /* ---------- FORMÜL KARTI ---------- */
  function kart(f) {
    var d = dersBul(f.d), k = d.konular.filter(function (x) { return x.id === f.k; })[0], kayitli = deste.indexOf(f.id) > -1;
    var h = '<article class="fo-kart" id="f-' + f.id + '" data-f="' + f.id + '" style="--c:' + d.renk + '">' +
      '<header class="fo-kart-bas"><span class="fo-konu">' + esc(ad(k)) + '</span>' +
      (W.FOPLUS ? '<button type="button" class="fo-bildir" data-bildir aria-label="' + W.FOPLUS.T('bildir') + '" title="' + W.FOPLUS.T('bildir') + '">⚑</button>' : '') +
      '<button type="button" class="fo-yildiz" data-yildiz aria-pressed="' + kayitli + '" aria-label="' + t(kayitli ? 'cikar' : 'ekle') + '" title="' + t(kayitli ? 'cikar' : 'ekle') + '">★</button></header>' +
      '<h3 class="fo-kart-ad">' + esc(ad(f)) + '<small>' + esc(dil === 'en' ? f.tr : f.en) + '</small></h3>';
    if (f.h) h += '<div class="fo-f" data-fo-f>' + f.h + '</div>';
    if (f.v) h += '<p class="fo-ipucu">' + t('degisken') + '</p><div class="fo-tanim" data-tanim hidden></div>';
    if (f.tablo) h += '<div class="fo-tablo">' + f.tablo.map(function (r) { return '<div class="fo-tr"><span class="fo-f fo-f-s">' + r[0] + '</span><span>' + esc(dil === 'en' ? r[2] : r[1]) + '</span></div>'; }).join('') + '</div>';
    if (f.v) {
      h += '<div class="fo-kay">';
      Object.keys(f.v).forEach(function (key) {
        var v = f.v[key];
        h += '<label class="fo-k" data-k="' + key + '"><span class="fo-k-ad"><b>' + sembol(f, key) + '</b> ' + esc(ad(v)) + '</span>' +
          '<input type="range" min="' + v.min + '" max="' + v.max + '" step="' + v.st + '" value="' + v.val + '" aria-label="' + esc(ad(v)) + '">' +
          '<span class="fo-k-deg"><output>' + sayi(v.val) + '</output> ' + esc(v.u) + '</span></label>';
      });
      h += '</div><div class="fo-sonuc" data-sonuc><span class="fo-sonuc-ad">' + FO.os(f.o.s) + ' <small>' + esc(ad(f.o)) + '</small></span><b>—</b><span class="fo-sonuc-u">' + esc(f.o.u) + '</span></div>';
      h += '<div class="fo-dene" data-dene hidden></div>';
    }
    if (f.not) h += '<p class="fo-not">' + esc(ad(f.not)) + '</p>';
    h += '<footer class="fo-kart-alt"><button type="button" class="fo-btn fo-btn-acd" data-anlat>' + t('anlat') + '</button>';
    if (f.v) h += '<button type="button" class="fo-btn" data-dene-ac>' + t('dene') + '</button>';
    if (W.FOPLUS && W.FOPLUS.turetVar(f.id)) h += '<button type="button" class="fo-btn fo-btn-ince fo-btn-turet" data-turet>∂ ' + W.FOPLUS.T('turet') + '</button>';
    if (f.lab) h += '<button type="button" class="fo-btn fo-btn-lab" data-lab="' + f.lab + '">' + t('labAc') + ' · ' + esc(ad(FO.lablar[f.lab])) + '</button>';
    h += '</footer></article>';
    return h;
  }
  function sembol(f, key) {
    var tmp = D.createElement('div'); tmp.innerHTML = f.h || ''; var el = tmp.querySelector('[data-v="' + key + '"]');
    return el ? el.innerHTML : esc(key);
  }
  function kartKur(el) {
    var f = formulBul(el.getAttribute('data-f')); if (!f) return;
    var deg = {}; if (f.v) Object.keys(f.v).forEach(function (k) { deg[k] = f.v[k].val; });
    var sonucB = el.querySelector('[data-sonuc] b');
    function hesap(anim) {
      if (!f.o) return;
      var r = f.o.f(deg); sonucB.textContent = sayi(r);
      if (anim && !SAKIN) { sonucB.classList.remove('fo-tik'); void sonucB.offsetWidth; sonucB.classList.add('fo-tik'); }
    }
    el.querySelectorAll('.fo-k').forEach(function (l) {
      var key = l.getAttribute('data-k'), r = l.querySelector('input'), o = l.querySelector('output');
      r.addEventListener('input', function () { deg[key] = +r.value; o.textContent = sayi(+r.value); hesap(true); isaretle(key); sonKaydet(f); });
    });
    hesap(false);
    /* değişkene dokun */
    var tanim = el.querySelector('[data-tanim]');
    function isaretle(key) {
      el.querySelectorAll('.fv').forEach(function (v) { v.classList.toggle('fo-acik', v.getAttribute('data-v') === key); });
      el.querySelectorAll('.fo-k').forEach(function (l) { l.classList.toggle('fo-acik', l.getAttribute('data-k') === key); });
      if (!tanim) return;
      var v = f.v && f.v[key];
      if (v) tanim.innerHTML = '<b>' + sembol(f, key) + '</b> ' + esc(ad(v)) + (v.u ? ' <span>[' + esc(v.u) + ']</span>' : '');
      else if (f.o) tanim.innerHTML = '<b>' + sembol(f, key) + '</b> ' + esc(ad(f.o)) + (f.o.u ? ' <span>[' + esc(f.o.u) + ']</span>' : '') + ' · ' + t('sonuc');
      tanim.hidden = false;
    }
    el.querySelectorAll('.fv').forEach(function (v) {
      v.setAttribute('tabindex', '0'); v.setAttribute('role', 'button');
      var bas = function () { isaretle(v.getAttribute('data-v')); var l = el.querySelector('.fo-k[data-k="' + v.getAttribute('data-v') + '"] input'); if (l) l.focus({ preventScroll: true }); };
      v.addEventListener('click', bas); v.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bas(); } });
    });
    /* yıldız */
    var y = el.querySelector('[data-yildiz]');
    y.addEventListener('click', function () {
      var i = deste.indexOf(f.id); if (i > -1) deste.splice(i, 1); else deste.push(f.id); koy('deste', deste);
      var on = deste.indexOf(f.id) > -1; y.setAttribute('aria-pressed', on); y.title = y.getAttribute('aria-label') ? t(on ? 'cikar' : 'ekle') : ''; y.setAttribute('aria-label', t(on ? 'cikar' : 'ekle'));
      if (on && !SAKIN) { y.classList.remove('fo-pop'); void y.offsetWidth; y.classList.add('fo-pop'); }
      ust();
    });
    /* kendini dene */
    var ac = el.querySelector('[data-dene-ac]'), kutu = el.querySelector('[data-dene]');
    if (ac) ac.addEventListener('click', function () { soru(); });
    function soru() {
      var v = {}; Object.keys(f.v).forEach(function (k) {
        var q = f.v[k], n = q.min + Math.round(Math.random() * 20) * (q.max - q.min) / 20; n = Math.round(n / q.st) * q.st; n = +n.toPrecision(2); if (q.min > 0 && n <= 0) n = q.st; v[k] = Math.min(q.max, Math.max(q.min, n)); /* yuvarlak, okunur değerler */
      });
      var dogru = f.o.f(v), sayildi = false; if (!isFinite(dogru)) return soru();
      kutu.hidden = false;
      kutu.innerHTML = '<p class="fo-dene-s">' + Object.keys(v).map(function (k) { return '<span><b>' + sembol(f, k) + '</b> = ' + sayi(v[k]) + (f.v[k].u ? ' ' + esc(f.v[k].u) : '') + '</span>'; }).join('') + '</p>' +
        '<form class="fo-dene-f"><label><span>' + FO.os(f.o.s) + ' = ?</span><input type="text" inputmode="decimal" autocomplete="off" aria-label="' + t('cevap') + '"><em>' + esc(f.o.u) + '</em></label>' +
        '<button type="submit" class="fo-btn">' + t('kontrol') + '</button><button type="button" class="fo-btn fo-btn-ince" data-yeni>' + t('yeni') + '</button><button type="button" class="fo-btn fo-btn-ince" data-kapat>' + t('vazgec') + '</button></form><p class="fo-dene-c" aria-live="polite"></p>';
      var form = kutu.querySelector('form'), inp = form.querySelector('input'), c = kutu.querySelector('.fo-dene-c');
      inp.focus({ preventScroll: true });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var x = parseFloat(String(inp.value).replace(',', '.').replace(/\s/g, ''));
        var ok = isFinite(x) && Math.abs(x - dogru) <= Math.max(Math.abs(dogru) * 0.02, 1e-9);
        c.className = 'fo-dene-c ' + (ok ? 'fo-ok' : 'fo-no');
        if (ok && !sayildi) { sayildi = true; D.dispatchEvent(new CustomEvent('formulo:dogru', { detail: { id: f.id, d: f.d, sev: 'kolay', kaynak: 'dene' } })); }   /* rozet ve seri: formulo-plus.js */
        c.innerHTML = ok ? '✓ ' + t('dogru') : '✗ ' + t('yanlis') + ': <b>' + sayi(dogru) + ' ' + esc(f.o.u) + '</b>';
        sonKaydet(f);
      });
      kutu.querySelector('[data-yeni]').addEventListener('click', soru);
      kutu.querySelector('[data-kapat]').addEventListener('click', function () { kutu.hidden = true; kutu.innerHTML = ''; });
    }
    var an = el.querySelector('[data-anlat]');
    if (an) an.addEventListener('click', function () { if (W.FORMULO_SAHNE) W.FORMULO_SAHNE.ac(f, deg); sonKaydet(f); });
    var lb = el.querySelector('[data-lab]');
    if (lb) lb.addEventListener('click', function () { labAc(lb.getAttribute('data-lab'), true); sonKaydet(f); });
  }
  function sonKaydet(f) { koy('son', { d: f.d, k: f.k, id: f.id, ts: Date.now() }); }

  /* ---------- DERS ---------- */
  var aktifLab = null, labId = null;
  function ders(d) {
    var fs = FO.formuller.filter(function (f) { return f.d === d.id; }), ls = []; fs.forEach(function (f) { if (f.lab && ls.indexOf(f.lab) < 0) ls.push(f.lab); });
    var h = '<nav class="fo-yol"><a href="#/">' + t('geri') + '</a><span>' + d.kod + '</span></nav>' +
      '<header class="fo-ders-bas" style="--c:' + d.renk + '"><div><span class="fo-eyb">' + esc(d.sinif) + ' · ' + fs.length + ' ' + t('formul') + '</span><h1 class="fo-h1 fo-h1-k">' + esc(ad(d)) + ' <span>' + esc(dil === 'en' ? (d.tr === d.en ? d.alt : d.tr) : d.alt) + '</span></h1></div>' +
      '<div class="fo-kitap"><small>' + t('kitap') + '</small>' + d.kitap.map(function (k) { return '<span>' + esc(k) + '</span>'; }).join('') + '</div></header>' +
      '<div class="fo-ders" style="--c:' + d.renk + '"><aside class="fo-konular" aria-label="' + t('konular') + '"><b>' + t('konular') + '</b><button type="button" class="fo-kn" data-kn="" aria-pressed="true">' + t('hepsi') + ' <i>' + fs.length + '</i></button>' +
      d.konular.map(function (k) { var n = fs.filter(function (f) { return f.k === k.id; }).length; return '<button type="button" class="fo-kn" data-kn="' + k.id + '" aria-pressed="false">' + esc(ad(k)) + ' <i>' + n + '</i></button>'; }).join('') + '</aside>' +
      '<div class="fo-orta"><div class="fo-sekmeler" role="tablist">' + [['F', 'sekF'], ['S', 'sekS'], ['A', 'sekA']].map(function (x, n) { return '<button type="button" role="tab" id="sek-' + x[0] + '" aria-controls="pan-' + x[0] + '" aria-selected="' + (n === 0) + '" data-sekme="' + x[0] + '">' + t(x[1]) + '</button>'; }).join('') + '</div>' + (W.FOPLUS && W.FORMULO_SORU ? W.FOPLUS.sinavBarHTML(d) : '') +
      '<div class="fo-kartlar" role="tabpanel" id="pan-F" aria-labelledby="sek-F">' + fs.map(kart).join('') + '</div>' +
      '<div class="fo-panel" role="tabpanel" id="pan-S" aria-labelledby="sek-S" data-pan-s hidden></div><div class="fo-panel" role="tabpanel" id="pan-A" aria-labelledby="sek-A" data-pan-a hidden></div></div>' +
      '<aside class="fo-lab" data-fo-lab aria-label="' + t('lablar') + '"><div class="fo-lab-bas"><b data-lab-ad>' + t('lablar') + '</b><button type="button" class="fo-lab-kapat" data-lab-kapat aria-label="' + t('kapat') + '">×</button></div>' +
      '<div class="fo-lab-sec">' + ls.map(function (l) { return '<button type="button" data-lab-sec="' + l + '" aria-pressed="false">' + esc(ad(FO.lablar[l])) + '</button>'; }).join('') + '</div>' +
      '<div class="fo-lab-alan" data-lab-alan><p class="fo-lab-bos">' + t('labBos') + '</p></div></aside></div>';
    return { html: h, lablar: ls };
  }
  function labAc(id, kullanici) {
    var p = D.querySelector('[data-fo-lab]'); if (!p) return;
    if (aktifLab) { aktifLab.dur(); aktifLab = null; }
    labId = id;
    p.querySelector('[data-lab-ad]').textContent = ad(FO.lablar[id]);
    p.querySelectorAll('[data-lab-sec]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lab-sec') === id); });
    aktifLab = LAB[id](p.querySelector('[data-lab-alan]'), dil);
    p.classList.add('fo-lab-acik');
    if (kullanici && W.matchMedia('(max-width:1099px)').matches) D.body.classList.add('fo-sheet');
  }

  /* ---------- DESTE ---------- */
  function desteGor() {
    var fs = deste.map(formulBul).filter(Boolean);
    return '<nav class="fo-yol"><a href="#/">' + t('geri') + '</a><span>' + t('deste') + '</span></nav><header class="fo-ders-bas"><h1 class="fo-h1 fo-h1-k">' + t('deste') + ' <span>' + fs.length + ' ' + t('formul') + '</span></h1></header>' +
      (fs.length ? '<div class="fo-kartlar fo-kartlar-tek">' + fs.map(kart).join('') + '</div>' : '<p class="fo-bos">' + t('bos') + '</p>') +
      (W.FORMULO_SORU ? '<div class="fo-kartlar-tek">' + W.FORMULO_SORU.hataHTML() + '</div>' : '');
  }

  /* ---------- yönlendirme ---------- */
  var io = null;
  function goster() {
    if (aktifLab) { aktifLab.dur(); aktifLab = null; }
    D.body.classList.remove('fo-sheet');
    var app = D.getElementById('fo-app'), yol = (location.hash || '#/').replace(/^#\/?/, '');
    var d = dersBul(yol), lablar = [];
    if (d) { var r = ders(d); app.innerHTML = r.html; lablar = r.lablar; app.dataset.gorunum = 'ders'; koy('sonDers', d.id); }
    else if (yol === 'deste') { app.innerHTML = desteGor(); app.dataset.gorunum = 'deste'; }
    else { app.innerHTML = masa(); app.dataset.gorunum = 'masa'; }
    if (W.FORMULO_TANITIM) { W.FORMULO_TANITIM.dur(); if (app.dataset.gorunum === 'masa') W.FORMULO_TANITIM.kur(app); }
    app.querySelectorAll('.fo-kart').forEach(kartKur);
    /* görünür olunca tebeşirle yazılır */
    if (io) io.disconnect();
    if (!SAKIN && 'IntersectionObserver' in W) {
      io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('fo-gor'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
      app.querySelectorAll('.fo-kart, .fo-pafta').forEach(function (k) { io.observe(k); });
    } else app.querySelectorAll('.fo-kart, .fo-pafta').forEach(function (k) { k.classList.add('fo-gor'); });
    /* konu süzgeci */
    app.querySelectorAll('[data-kn]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-kn');
        app.querySelectorAll('[data-kn]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        app.querySelectorAll('.fo-kart').forEach(function (c) { var f = formulBul(c.getAttribute('data-f')); c.hidden = !!k && f.k !== k; if (!c.hidden) c.classList.add('fo-gor'); });
        var sel = app.querySelector('[data-fq-konu]'); if (sel) { sel.value = k; if (sel.value !== k) sel.value = ''; if (!app.querySelector('[data-pan-s]').hidden) sel.dispatchEvent(new Event('change')); }
      });
    });
    app.querySelectorAll('[data-lab-sec]').forEach(function (b) { b.addEventListener('click', function () { labAc(b.getAttribute('data-lab-sec'), true); }); });
    /* sekmeler: soru havuzu ve Acadia'ya sor ilk açılışta kurulur */
    function sekmeAc(id) {
      app.querySelectorAll('[data-sekme]').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-sekme') === id); });
      app.querySelector('#pan-F').hidden = id !== 'F'; app.querySelector('[data-pan-s]').hidden = id !== 'S'; app.querySelector('[data-pan-a]').hidden = id !== 'A';
      app.querySelector('.fo-konular').classList.toggle('fo-soluk', id === 'A');
      var p = id === 'S' ? app.querySelector('[data-pan-s]') : id === 'A' ? app.querySelector('[data-pan-a]') : null, M = id === 'S' ? W.FORMULO_SORU : W.FORMULO_SOR;
      if (p && M && !p.__kuruldu) { p.__kuruldu = true; p.innerHTML = M.panelHTML(d); M.panelKur(p, d); }
    }
    if (d) {
      app.querySelectorAll('[data-sekme]').forEach(function (b) { b.addEventListener('click', function () { sekmeAc(b.getAttribute('data-sekme')); }); });
      if (al('tekrar', null)) sekmeAc('S');
    }
    if (yol === 'deste' && W.FORMULO_SORU) W.FORMULO_SORU.hataKur(app);
    var kp = app.querySelector('[data-lab-kapat]'); if (kp) kp.addEventListener('click', function () { D.body.classList.remove('fo-sheet'); });
    /* geniş ekranda ilk labı kendiliğinden aç */
    if (d && lablar.length && W.matchMedia('(min-width:1100px)').matches) labAc(lablar[0], false);
    /* hedef karta kaydır */
    var hedef = (location.search.match(/[?&]f=([\w-]+)/) || [])[1];
    if (hedef && d) { var el = D.getElementById('f-' + hedef); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('fo-vurgu'); } }
    else W.scrollTo(0, 0);
    ust();
  }

  function kur() {
    deste = al('deste', []);   /* hesaptaki kayıt bu betik yüklenirken birleşmiş olabilir */
    D.querySelectorAll('[data-fo-dil]').forEach(function (b) { b.addEventListener('click', function () { dil = b.getAttribute('data-fo-dil'); koy('dil', dil); goster(); }); });
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape') D.body.classList.remove('fo-sheet'); });
    D.addEventListener('pointerdown', function (e) { if (D.body.classList.contains('fo-sheet') && !e.target.closest('[data-fo-lab],[data-lab]')) D.body.classList.remove('fo-sheet'); });
    W.addEventListener('hashchange', goster);
    /* hesaptaki kayıt yerelle birleşince (formulo-bulut.js) deste sayacı ve açık görünüm tazelenir */
    D.addEventListener('formulo:bulut', function () {
      deste = al('deste', []); ust();
      D.querySelectorAll('.fo-kart[data-f]').forEach(function (c) { var y = c.querySelector('[data-yildiz]'); if (!y) return; var on = deste.indexOf(c.getAttribute('data-f')) > -1; y.setAttribute('aria-pressed', on); y.setAttribute('aria-label', t(on ? 'cikar' : 'ekle')); y.title = t(on ? 'cikar' : 'ekle'); });
      if ((location.hash || '').replace(/^#\/?/, '') === 'deste') goster();   /* deste görünümü baştan çizilir; ders sayfası yerinde kalır */
    });
    goster();
  }
  W.FORMULO_APP = { sayi: sayi, dil: function () { return dil; }, esc: esc, ad: ad, sembol: sembol, formulBul: formulBul, dersBul: dersBul };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', kur); else kur();
})(window);
