/* ==========================================================================
   ACADEX ENGLISH · Konuşma atölyesi (assets/konusma.js), 07.11.2026
   Konu kütüphanesi: 14 kategori rafı × A1–C2 seviye × 7 etkinlik.
     dakika    Tek dakika (Just a Minute): susmadan, “um”suz, tekrar etmeden, konuda kal
     munazara  Görüş savun: öğrenci bir taraf seçer, Defne Hoca karşı tarafı savunur (3 tur)
     taboo     Anlat-buldur: yasaklı kelimeleri kullanmadan anlat, hoca tahmin eder
     rol       Rol yapma: hoca karşı rolde, görev kartındaki hedefleri tamamla
     grafik    Grafik anlatma: kategoriye uygun veri her seferinde yeniden üretilir
     hikaye    Hikâye zinciri: hoca başlatır, her turda verilen kelimeyle devam edersin
     roportaj  Röportaj: hoca uzman rolünde, soruları sen sorarsın
   İçerik: KONUSMA_BANKA (assets/konusma-banka.js) + havuz (ingilizce-hoca, tur 'konusma',
   alt 'etkinlik:kategori:seviye'). Bir kombinasyonun yerel seti görülünce sıradaki havuzdan
   gelir; havuz yoksa yerel set baştan döner. Hocanın tur içi cevapları yayındaysa
   ingilizce-hoca 'etkinlik' modundan, değilse yerel kurallardan gelir.
   Kayıt araçları SINAV'dan (assets/sinav.js): konuşma tanıma, ses kaydı, seviye ölçer.
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window, A = W.ACX, KB = W.KONUSMA_BANKA, S = W.SINAV, esc = A.esc;
  var SR = W.SpeechRecognition || W.webkitSpeechRecognition;
  var SIRA = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  var sevNo = function (s) { return Math.max(0, SIRA.indexOf(s)); };
  var rasgele = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var karistir = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  var bekle = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var norm = function (t) { return HOCA.norm(t); };            /* ' kelime kelime ' biçiminde */
  var icerir = function (metin, k) { return norm(metin).indexOf(' ' + norm(k).trim() + ' ') > -1 || (k.length >= 5 && norm(metin).indexOf(' ' + norm(k).trim().slice(0, Math.max(4, k.length - 2))) > -1); };
  var kelimeSay = function (t) { var n = norm(t).trim(); return n ? n.split(' ').length : 0; };
  var HIZ = { A1: .8, A2: .86, B1: .92, B2: .97, C1: 1, C2: 1.05 };
  var BOS = /^(the|a|an|and|or|but|to|of|in|on|at|is|are|was|were|i|you|it|he|she|we|they|do|does|did|my|your|me|be|for|with|this|that|can|would|like|about|so|very|really|have|has|had|there|then|just|also|because|think|yes|no|not|its|it's|i'm|im|will|what|when|how|why|who)$/;

  var ETK = [
    { id: 'dakika', ad: 'Tek dakika', en: 'Just a Minute', min: 'A1', tr: 'Konudan sapmadan, susmadan, “um” demeden ve aynı kelimeyi tekrarlamadan konuş.', ikon: '<circle cx="16" cy="17" r="11"/><path d="M16 10v7l5 3M12 3h8"/>' },
    { id: 'munazara', ad: 'Görüş savun', en: 'Debate', min: 'A2', tr: 'Bir iddiada taraf seç; Defne Hoca karşı tarafı savunur. Açılış, cevap, kapanış.', ikon: '<path d="M4 8h12v8H9l-5 4zM16 12h12v8h-3v4l-5-4h-4z"/>' },
    { id: 'taboo', ad: 'Anlat-buldur', en: 'Taboo', min: 'A1', tr: 'Kelimeyi, yasaklı kelimeleri kullanmadan anlat; hoca tahmin etsin.', ikon: '<rect x="6" y="4" width="20" height="24" rx="3"/><path d="M10 11h12M10 16h8M9 24l14-8"/>' },
    { id: 'rol', ad: 'Rol yapma', en: 'Role-play', min: 'A1', tr: 'Gerçek bir durum: hoca karşı rolde, sen görev kartındaki hedefleri tamamla.', ikon: '<circle cx="11" cy="11" r="5"/><circle cx="22" cy="11" r="5"/><path d="M3 27c1-6 5-8 8-8s7 2 8 8M17 21c1-1.5 3-2 5-2 3 0 7 2 8 8"/>' },
    { id: 'grafik', ad: 'Grafik anlat', en: 'Describe a chart', min: 'A2', tr: 'Her seferinde yeni veri: eğilimi, en yükseği ve karşılaştırmayı anlat.', ikon: '<path d="M4 27h24M8 23v-6M14 23V10M20 23v-9M26 23V6"/>' },
    { id: 'hikaye', ad: 'Hikâye zinciri', en: 'Story chain', min: 'A1', tr: 'Hoca başlatır, sırayla devam edersiniz; her turda verilen kelimeyi kullan.', ikon: '<path d="M6 5h14l6 6v16H6z"/><path d="M20 5v6h6M10 16h12M10 21h9"/>' },
    { id: 'roportaj', ad: 'Röportaj', en: 'Interview', min: 'A1', tr: 'Hoca bir uzman rolünde; soruları sen sorarsın. Soru kalıpların değerlendirilir.', ikon: '<rect x="11" y="3" width="10" height="16" rx="5"/><path d="M7 15a9 9 0 0 0 18 0M16 24v5M11 29h10"/>' }
  ];
  var etkBul = function (id) { return ETK.filter(function (e) { return e.id === id; })[0]; };

  var kok, h = null, oda, panel;
  var durum = { kat: A.ls.al('akKat', 'spor'), sev: A.ls.al('akSev', 'B1'), konu: 0, calisiyor: false, iptal: false, konuEk: null };
  var katBul = function (id) { return KB.kategoriler.filter(function (k) { return k.id === id; })[0] || KB.kategoriler[0]; };
  var hucre = function () { return katBul(durum.kat).seviye[durum.sev]; };
  var trGoster = function () { return sevNo(durum.sev) <= 2; };

  /* ---------- içerik seçimi: önce görülmemiş yerel; yerel set bitince havuz ---------- */
  var gor = A.ls.al('akGor', {});
  function yerelSec(anahtar, liste) {
    var g = gor[anahtar] || [], aday = liste.map(function (_, i) { return i; }).filter(function (i) { return g.indexOf(i) < 0; });
    var bitti = !aday.length; if (bitti) { g = []; aday = liste.map(function (_, i) { return i; }); }
    var i = rasgele(aday); g.push(i); gor[anahtar] = g; A.ls.yaz('akGor', gor); return { veri: liste[i], ilkTur: !bitti && g.length === 1, tukendi: bitti };
  }
  async function havuz(etk) {
    if (!A.icerik) return null;
    return Promise.race([A.icerik('konusma', etk + ':' + durum.kat + ':' + durum.sev), bekle(6000).then(function () { return null; })]).catch(function () { return null; });
  }
  async function icerikAl(etk, liste, dogrula) {
    var anahtar = etk + ':' + durum.kat + ':' + durum.sev, g = gor[anahtar] || [];
    if (liste.length && g.length < liste.length) return yerelSec(anahtar, liste).veri;
    var v = await havuz(etk); if (v && dogrula(v)) return v;
    return liste.length ? yerelSec(anahtar, liste).veri : null;
  }
  var yakinSev = function (liste, f) {   /* seviyesi en yakın (önce altı) öğeler */
    var n = sevNo(durum.sev), uy = liste.filter(function (x) { return sevNo(f(x)) <= n; });
    if (!uy.length) { var alt = Math.min.apply(null, liste.map(function (x) { return sevNo(f(x)); })); return liste.filter(function (x) { return sevNo(f(x)) <= alt + 1; }); }   /* altı yoksa en yakın üst */
    var en = Math.max.apply(null, uy.map(function (x) { return sevNo(f(x)); }));
    return uy.filter(function (x) { return sevNo(f(x)) >= en - 1; });
  };

  /* ---------- konuşma al: halka, dalga, tanıma, kayıt, yazarak cevap ---------- */
  async function konus(kutu, o) {
    o = o || {};
    kutu.innerHTML = '<div class="sv-orta"><div class="sv-saat" style="--k:1"><b>–</b><small>' + esc(o.etiket || 'konuşma') + '</small></div><div class="sv-sag"><div class="sv-dalga yok" aria-hidden="true">' + new Array(25).join('<i></i>') + '<span class="sv-dur">duraksama</span></div><div class="sv-canli" aria-live="off"></div></div></div>' +
      '<textarea class="sv-yaz" rows="2" lang="en" placeholder="' + (SR ? 'mikrofon yoksa buraya yaz…' : 'cevabını yaz…') + '"' + (SR ? ' hidden' : '') + '></textarea>' +
      '<div class="alt-satir sv-dug">' + (SR ? '<button type="button" class="btn sm" data-yazla>Yazarak cevapla</button>' : '') + '<button type="button" class="btn sm ana" data-bitti>' + esc(o.dugme || 'Bitirdim') + '</button></div>';
    var saat = kutu.querySelector('.sv-saat'), canli = kutu.querySelector('.sv-canli'), yaz = kutu.querySelector('.sv-yaz'), dalga = kutu.querySelector('.sv-dalga'), cubuk = dalga.querySelectorAll('i'), bd = kutu.querySelector('[data-bitti]');
    var yb = kutu.querySelector('[data-yazla]'); if (yb) yb.onclick = function () { yaz.hidden = false; yaz.focus(); yb.remove(); };
    var halka = function (kalan, top) { saat.style.setProperty('--k', Math.max(0, Math.min(1, kalan / top))); saat.querySelector('b').textContent = Math.floor(Math.max(0, kalan) / 60) + ':' + ('0' + Math.max(0, Math.ceil(kalan) % 60)).slice(-2); };
    if (o.hazirlik) {
      saat.querySelector('small').textContent = 'hazırlık'; bd.textContent = 'Hazırım';
      await new Promise(function (ok) { var t0 = Date.now(), iv = setInterval(function () { var k = o.hazirlik - (Date.now() - t0) / 1000; halka(k, o.hazirlik); if (k <= 0 || durum.iptal) son(); }, 200); var son = function () { clearInterval(iv); ok(); }; bd.onclick = son; });
      if (durum.iptal) return null;
      saat.querySelector('small').textContent = o.etiket || 'konuşma'; bd.textContent = o.dugme || 'Bitirdim';
    }
    if (W.speechSynthesis) speechSynthesis.cancel();
    oda.classList.add('kayitta');
    var anlik = '', sonSes = 0, ilkSes = 0, sessizBas = Date.now(), duraks = 0, t0 = Date.now(), raf = 0, gecmis = [];
    var dinleyici = SR ? S.dinle(function (m) { if (m === null) { yaz.hidden = false; canli.textContent = 'Mikrofon izni yok; yazarak devam et.'; return; } anlik = m; canli.textContent = m; }) : null;
    if (!dinleyici) yaz.hidden = false;
    var kayit = S.kaydet(), olcer = S.seviyeOlcer();
    if (olcer) dalga.classList.remove('yok');
    yaz.addEventListener('input', function () { sonSes = Date.now(); if (!ilkSes) ilkSes = sonSes; });
    var ciz = function () {
      var now = Date.now();
      if (olcer) {
        var l = olcer.oku(); gecmis.push(l); if (gecmis.length > cubuk.length) gecmis.shift();
        for (var j = 0; j < cubuk.length; j++) cubuk[j].style.setProperty('--h', (gecmis[gecmis.length - cubuk.length + j] || 0).toFixed(3));
        saat.style.setProperty('--ses', l.toFixed(3));
        if (l > .07) { if (!ilkSes) ilkSes = now; if (now - sessizBas > 3000 && sonSes) duraks++; sonSes = now; sessizBas = now; }
        dalga.classList.toggle('duruyor', sonSes > 0 && now - sonSes > 3000);
      }
      raf = requestAnimationFrame(ciz);
    };
    raf = requestAnimationFrame(ciz);
    await new Promise(function (ok) {
      var iv = setInterval(function () { var k = o.sure - (Date.now() - t0) / 1000; halka(k, o.sure); if (k <= 0 || durum.iptal) son(); }, 200);
      var son = function () { clearInterval(iv); ok(); }; bd.onclick = son;
    });
    cancelAnimationFrame(raf); if (olcer) olcer.kapat(); oda.classList.remove('kayitta'); bd.disabled = true;
    var sn = (Date.now() - t0) / 1000, sonuc = dinleyici ? await dinleyici.dur() : { metin: '' }, ses = await kayit.dur();
    var metin = (sonuc.metin || '').trim(); if (yaz.value.trim() && (!metin || !yaz.hidden)) metin = yaz.value.trim();
    kutu.innerHTML = '';
    if (durum.iptal) return null;
    return { metin: metin, sn: sn, ses: ses, duraks: olcer ? duraks : null, gecikme: ilkSes ? (ilkSes - t0) / 1000 : null };
  }

  /* ---------- yapay zekâ ile tur içi cevap (yoksa yerel) ---------- */
  async function yzTur(tip, veri, yerel) {
    var v = A.yz ? await A.yz('etkinlik', Object.assign({ tip: tip, seviye: durum.sev, kategori: katBul(durum.kat).en }, veri), 12000) : null;
    return v && typeof v.yanit_en === 'string' && v.yanit_en.trim() ? v : { yanit_en: yerel, yerel: true };
  }

  /* ---------- arayüz ---------- */
  var IKON = function (yol) { return '<svg viewBox="0 0 32 32" aria-hidden="true">' + yol + '</svg>'; };
  function kur(el) {
    kok = el;
    var kats = KB.kategoriler;
    el.innerHTML = '<div class="ak-raf-dis"><div class="ak-raf" role="tablist" aria-label="Konu kategorileri">' + kats.map(function (k, i) {
      return '<button type="button" class="kitap' + (k.ad.length > 13 ? ' uzun' : '') + '" role="tab" data-kat="' + k.id + '" style="--kc:' + k.renk + ';--kh:' + Math.min(99, Math.max(76 + (i * 37 % 20), 34 + k.ad.length * 3.2)) + '%;--kw:' + (44 + (i * 13 % 14)) + 'px"><span>' + esc(k.ad) + '</span><small lang="en">' + esc(k.en) + '</small></button>';
    }).join('') + '</div><div class="raf-tahta" aria-hidden="true"></div></div>' +
      '<div class="ak-masa kagit"><div class="ak-ust"><div><span class="etiket">rafından aldığın kitap</span><h3 class="ak-kat-ad"></h3></div>' +
      '<div class="ak-sev" role="radiogroup" aria-label="Seviye">' + KB.seviyeler.map(function (s) { return '<button type="button" role="radio" data-sev="' + s[0] + '"><b>' + s[0] + '</b><small>' + esc(s[1]) + '</small></button>'; }).join('') + '</div></div>' +
      '<p class="say ak-sev-not"></p><div class="ak-konular"></div><div class="ak-kelime"></div><h4 class="ak-b">Etkinlik seç</h4><div class="ak-etk"></div></div>' +
      '<div class="ak-oda" hidden><div class="ak-hoca"></div><div class="ak-panel kagit" aria-live="polite"></div></div>';
    oda = el.querySelector('.ak-oda'); panel = el.querySelector('.ak-panel');
    el.addEventListener('click', function (e) {
      if (durum.calisiyor) return;
      var k = e.target.closest('[data-kat]'), s = e.target.closest('[data-sev]'), t = e.target.closest('[data-konu]'), x = e.target.closest('[data-etk]'), y = e.target.closest('[data-yenikonu]');
      if (k) { durum.kat = k.dataset.kat; durum.konu = 0; durum.konuEk = null; A.ls.yaz('akKat', durum.kat); ciz(); }
      else if (s) { durum.sev = s.dataset.sev; durum.konu = 0; durum.konuEk = null; A.ls.yaz('akSev', durum.sev); ciz(); }
      else if (t) { durum.konu = +t.dataset.konu; ciz(); }
      else if (y) yeniKonu(y);
      else if (x && !x.disabled) baslat(x.dataset.etk);
    });
    ciz();
  }
  function konular() { var c = hucre(), l = c.konular.slice(); if (durum.konuEk) l = l.concat(durum.konuEk); return l; }
  function ciz() {
    var kat = katBul(durum.kat), c = hucre(), sv = KB.seviyeler[sevNo(durum.sev)];
    kok.style.setProperty('--kc', kat.renk);
    kok.querySelectorAll('[data-kat]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.kat === durum.kat); });
    var raf = kok.querySelector('.ak-raf'), sec = raf.querySelector('[aria-selected=true]');
    if (sec && raf.scrollWidth > raf.clientWidth) { try { raf.scrollTo({ left: sec.offsetLeft - raf.offsetLeft - raf.clientWidth / 2 + sec.offsetWidth / 2, behavior: A.sakin ? 'auto' : 'smooth' }); } catch (e) { raf.scrollLeft = sec.offsetLeft - raf.clientWidth / 2; } }
    kok.querySelectorAll('[data-sev]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.sev === durum.sev); });
    kok.querySelector('.ak-kat-ad').innerHTML = esc(kat.ad) + ' <small lang="en">' + esc(kat.en) + '</small>';
    kok.querySelector('.ak-sev-not').textContent = durum.sev + ' · ' + sv[1] + ': ' + sv[2];
    var ks = konular();
    kok.querySelector('.ak-konular').innerHTML = ks.map(function (k, i) {
      return '<button type="button" class="ak-konu" data-konu="' + i + '" aria-pressed="' + (i === durum.konu) + '"><span class="etiket">konu ' + (i + 1) + '</span><b lang="en">' + esc(k[0]) + '</b><small>' + esc(k[1]) + '</small><span class="soru" lang="en">' + esc(k[2]) + '</span></button>';
    }).join('') + '<button type="button" class="ak-konu yeni" data-yenikonu><span class="etiket">derya deniz</span><b>Yeni konu ↻</b><small>Bu kategori ve seviyede, daha önce görmediğin bir konu</small></button>';
    kok.querySelector('.ak-kelime').innerHTML = '<span class="etiket">bu seviyenin kelimeleri</span> ' + c.kelimeler.map(function (w) { return '<span class="ak-cip" lang="en">' + esc(w) + '</span>'; }).join('');
    kok.querySelector('.ak-etk').innerHTML = ETK.map(function (e) {
      var kapali = sevNo(durum.sev) < sevNo(e.min);
      return '<button type="button" class="ak-kart" data-etk="' + e.id + '"' + (kapali ? ' disabled' : '') + '>' + IKON(e.ikon) + '<b>' + esc(e.ad) + '</b><small lang="en">' + esc(e.en) + '</small><span>' + (kapali ? e.min + ' ve üstü' : esc(e.tr)) + '</span></button>';
    }).join('');
  }
  async function yeniKonu(b) {
    b.disabled = true; b.querySelector('b').textContent = 'Defne Hoca arıyor…';
    var v = await havuz('dakika');
    if (v && v.baslik && v.soru) { durum.konuEk = (durum.konuEk || []).concat([[String(v.baslik), String(v.tr || ''), String(v.soru), Array.isArray(v.kelimeler) ? v.kelimeler.map(String).slice(0, 8) : []]]).slice(-4); durum.konu = konular().length - 1; }
    else { var ks = konular(); durum.konu = (durum.konu + 1) % ks.length; A.soyle && A.soyle('Şu an yeni konu üretilemedi; bu seviyenin öteki konusuna geçtim.'); }
    ciz();
  }

  /* ---------- oda: başlat / bitir ---------- */
  async function baslat(id) {
    if (durum.calisiyor) return;
    var e = etkBul(id), kat = katBul(durum.kat);
    durum.calisiyor = true; durum.iptal = false;
    oda.hidden = false; kok.classList.add('calisiyor');
    if (!h) { h = HOCA.sahne(oda.querySelector('.ak-hoca')); }
    panel.innerHTML = '<p class="el" style="font-size:22px">Defne Hoca hazırlanıyor…</p>';
    oda.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' });
    if (SR || W.MediaRecorder) await S.mikrofon();
    var ust = function (alt) { return '<div class="ak-pu"><span class="etiket">' + esc(e.ad) + ' · ' + esc(kat.ad) + ' · ' + durum.sev + (alt ? ' · ' + esc(alt) : '') + '</span><button type="button" class="btn sm" data-kapat>Kapat</button></div>'; };
    var calis = { dakika: dakika, munazara: munazara, taboo: taboo, rol: rol, grafik: grafik, hikaye: hikaye, roportaj: roportaj }[id];
    var sonuc = null;
    try { sonuc = await calis(ust); } catch (err) { console.error(err); }
    durum.calisiyor = false; kok.classList.remove('calisiyor');
    if (durum.iptal || !sonuc) { oda.hidden = true; return; }
    A.gunlukEkle('speaking');
    panel.querySelectorAll('[data-tekrar]').forEach(function (b) { b.onclick = function () { baslat(id); }; });
    panel.querySelectorAll('[data-baska]').forEach(function (b) { b.onclick = function () { oda.hidden = true; kok.querySelector('.ak-etk').scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'center' }); }; });
    panel.querySelectorAll('[data-oku]').forEach(function (b) { b.onclick = function () { h.soyle(b.dataset.oku, '', { hiz: HIZ[durum.sev] }); }; });
  }
  function kapatBagla() { var b = panel.querySelector('[data-kapat]'); if (b) b.onclick = function () { durum.iptal = true; if (W.speechSynthesis) speechSynthesis.cancel(); oda.hidden = true; }; }
  var sonDugmeler = '<div class="alt-satir"><button type="button" class="btn sm" data-baska>Başka etkinlik</button><button type="button" class="btn sm ana" data-tekrar>Yeni tur</button></div>';
  var soyle = function (en, tr) { return h.soyle(en, trGoster() ? (tr || '') : '', { hiz: HIZ[durum.sev] }); };
  var msj = function (log, kim, metin, sinif) { var d = D.createElement('div'); d.className = 'msj ' + (kim === 'hoca' ? 'hoca' : 'ogr') + (sinif ? ' ' + sinif : ''); d.innerHTML = '<span class="kim">' + (kim === 'hoca' ? 'Defne Hoca' : 'sen') + '</span><p lang="en">' + (kim === 'hoca' ? esc(metin) : (metin ? S.renkle(metin, HOCA.gramer(metin)) : '<span class="say">(cevap yok)</span>')) + '</p>'; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
  var kontrol = function (liste) { return '<ul class="ak-kontrol">' + liste.map(function (x) { return '<li class="' + (x[1] ? 'ok' : '') + '"><span>' + (x[1] ? '✓' : '○') + '</span>' + x[0] + (x[2] && !x[1] ? '<small lang="en">' + esc(x[2]) + '</small>' : '') + '</li>'; }).join('') + '</ul>'; };
  var sonucTepki = function (oran, iyi, orta) { h.tepki(oran >= .75 ? 'dogru' : oran >= .45 ? 'kismen' : 'yanlis'); return soyle(oran >= .75 ? iyi : oran >= .45 ? orta : 'Good try. Look at the notes and try again.', oran >= .75 ? 'Çok iyi!' : oran >= .45 ? 'Fena değil; notlara bak.' : 'Notlara bakıp bir kez daha dene.'); };

  /* 1. Tek dakika */
  async function dakika(ust) {
    var c = hucre(), k = konular()[durum.konu] || c.konular[0], kel = (k[3] && k[3].length ? k[3] : c.kelimeler);
    var sure = { A1: 30, A2: 45, B1: 60, B2: 60, C1: 90, C2: 90 }[durum.sev];
    panel.innerHTML = ust(sure + ' saniye') + '<div class="ak-kartcik"><span class="etiket">konu</span><b lang="en">' + esc(k[0]) + '</b><p lang="en">' + esc(k[2]) + '</p>' + (trGoster() ? '<small>' + esc(k[1]) + '</small>' : '') + '</div>' +
      '<p class="say">Kurallar: 3 saniyeden uzun susma ✗ · “um/uh” ✗ · aynı kelimeyi üç kez kullanma ✗ · konudan sapma ✗</p><div class="ak-cipler">' + kel.map(function (w) { return '<span class="ak-cip" lang="en">' + esc(w) + '</span>'; }).join('') + '</div><div class="ak-kayit"></div>';
    kapatBagla();
    await soyle('You have ' + sure + ' seconds. Your topic is: ' + k[0] + '. Try not to stop, repeat or go off topic.', 'Konun: ' + k[1] + '. Hazırlanınca başla.');
    var r = await konus(panel.querySelector('.ak-kayit'), { sure: sure, hazirlik: 15 }); if (!r) return null;
    var t = r.metin, n = kelimeSay(t), dolgu = (t.match(new RegExp(S.DOLGU.source, 'gi')) || []).length;
    var say = {}; norm(t).trim().split(' ').forEach(function (w) { if (w.length >= 4 && !BOS.test(w)) say[w] = (say[w] || 0) + 1; });
    var tekrar = Object.keys(say).filter(function (w) { return say[w] >= 3; });
    var konuK = norm(k[0] + ' ' + k[2]).trim().split(' ').filter(function (w) { return w.length > 3 && !BOS.test(w); }).concat(kel.map(function (w) { return norm(w).trim(); }));
    var ilgi = konuK.filter(function (w) { return icerir(t, w); }).length, kullan = kel.filter(function (w) { return icerir(t, w); });
    var hedefK = sure * { A1: 1.1, A2: 1.4, B1: 1.7, B2: 1.9, C1: 2, C2: 2.1 }[durum.sev];
    var puan = 100 - dolgu * 8 - (r.duraks || 0) * 10 - tekrar.length * 6 - (ilgi < 2 ? 15 : 0) - (n < hedefK * .6 ? 15 : 0); puan = Math.max(0, Math.min(100, Math.round(puan)));
    var ihlal = [];
    if (dolgu) ihlal.push('“um/uh” × ' + dolgu); if (r.duraks) ihlal.push('3 sn+ duraksama × ' + r.duraks); if (tekrar.length) ihlal.push('tekrar: ' + tekrar.join(', ')); if (ilgi < 2) ihlal.push('konudan uzaklaştın'); if (n < hedefK * .6) ihlal.push('çok kısa kaldı (' + n + ' kelime)');
    panel.innerHTML = ust('sonuç') + '<div class="ak-puan"><b>' + puan + '</b><small>/ 100</small></div><p class="ak-metin" lang="en">' + (t ? S.renkle(t, HOCA.gramer(t)) : '<span class="say">(konuşma algılanmadı)</span>') + '</p>' +
      '<div class="sv-cip"><span>' + n + ' kelime</span><span>' + Math.round(r.sn) + ' sn</span><span>' + (r.sn > 5 ? Math.round(n / (r.sn / 60)) + ' kelime/dk' : '–') + '</span></div>' +
      '<p>' + (ihlal.length ? '<b>Kesintiler:</b> ' + esc(ihlal.join(' · ')) : '<b>Temiz bir dakika!</b> Kural ihlali yok.') + '</p>' +
      '<p class="say">Kelimelerden kullandıkların: ' + (kullan.length ? kullan.map(function (w) { return '<span class="ak-cip ok" lang="en">' + esc(w) + '</span>'; }).join(' ') : 'hiçbiri; bir dahakine en az ikisini dene.') + '</p>' +
      (r.ses ? '<audio controls src="' + r.ses + '"></audio>' : '') + sonDugmeler;
    await sonucTepki(puan / 100, 'Excellent! A clean minute.', 'Nice. Fewer pauses next time.');
    return true;
  }

  /* 2. Görüş savun + münazara */
  var ARGUMAN = { gerekce: /\b(because|since|as a result|the reason|that'?s why|so)\b/i, ornek: /\b(for example|for instance|such as|like when|in my experience|research|studies|statistics)\b/i, karsi: /\b(i see your point|that may be true|i understand|you have a point|however|but|on the other hand|although|even if|i disagree)\b/i, sonuc: /\b(to sum up|in conclusion|overall|all in all|that'?s why|so in the end|for these reasons|to conclude)\b/i };
  async function munazara(ust) {
    var kat = katBul(durum.kat), aday = yakinSev(kat.munazara, function (x) { return x.sev; });
    var m = await icerikAl('munazara', aday, function (v) { return v.iddia && Array.isArray(v.lehte) && Array.isArray(v.aleyhte); });
    panel.innerHTML = ust('iddia') + '<div class="ak-kartcik"><span class="etiket">iddia</span><b lang="en">' + esc(m.iddia) + '</b>' + (trGoster() && m.tr ? '<small>' + esc(m.tr) + '</small>' : '') + '</div><p>Hangi taraftasın? Defne Hoca karşı tarafı savunacak.</p>' +
      '<div class="alt-satir"><button type="button" class="btn" data-taraf="lehte">Katılıyorum</button><button type="button" class="btn" data-taraf="aleyhte">Katılmıyorum</button></div>';
    kapatBagla();
    await soyle('Here is the statement: ' + m.iddia + ' Do you agree or disagree?', 'Bir taraf seç.');
    var taraf = await new Promise(function (ok) { panel.querySelectorAll('[data-taraf]').forEach(function (b) { b.onclick = function () { ok(b.dataset.taraf); }; }); });
    if (durum.iptal) return null;
    var benim = m[taraf] || [], onun = karistir(m[taraf === 'lehte' ? 'aleyhte' : 'lehte'] || []);
    var turlar = [['Açılış', 'Give your opinion and at least one reason.', { A2: 40, B1: 50 }[durum.sev] || 60], ['Cevap', 'Respond to my argument.', 45], ['Kapanış', 'Sum up your position.', 30]];
    panel.innerHTML = ust(taraf === 'lehte' ? 'sen: katılıyorum' : 'sen: katılmıyorum') + '<div class="ak-kartcik kucuk"><b lang="en">' + esc(m.iddia) + '</b></div>' +
      '<details class="ak-ipucu"' + (sevNo(durum.sev) <= 2 ? ' open' : '') + '><summary>Acadia: senin tarafına fikirler</summary><ul lang="en">' + benim.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p class="say" lang="en">Useful: Firstly… · For example… · I see your point, but… · To sum up…</p></details>' +
      '<div class="ak-log"></div><p class="ak-tur say"></p><div class="ak-kayit"></div>';
    kapatBagla();
    var log = panel.querySelector('.ak-log'), turEl = panel.querySelector('.ak-tur'), gecmis = [], ogr = [];
    await soyle(taraf === 'lehte' ? 'Great, you agree. I will argue against you. You start.' : 'Great, you disagree. I will argue for it. You start.', 'Sen başla; açılışta fikrini ve bir nedenini söyle.');
    for (var i = 0; i < turlar.length; i++) {
      turEl.textContent = (i + 1) + '/3 · ' + turlar[i][0] + ' — ' + turlar[i][1];
      var r = await konus(panel.querySelector('.ak-kayit'), { sure: turlar[i][2], etiket: turlar[i][0].toLowerCase() }); if (!r) return null;
      ogr.push(r.metin); msj(log, 'ogr', r.metin); gecmis.push({ rol: 'ogrenci', metin: r.metin });
      if (i < 2) {
        var yerel = (i === 0 ? 'I see your point, but ' : 'That may be true. However, ') + (onun[i] || onun[0] || 'I still think the opposite is true.').replace(/^./, function (c) { return c.toLowerCase(); });
        h.dusun(true);
        var y = await yzTur('munazara', { iddia: m.iddia, hoca_taraf: taraf === 'lehte' ? 'against' : 'for', gecmis: gecmis }, yerel);
        h.dusun(false); if (durum.iptal) return null;
        msj(log, 'hoca', y.yanit_en); gecmis.push({ rol: 'hoca', metin: y.yanit_en });
        await h.soyle(y.yanit_en, '', { hiz: HIZ[durum.sev] });
      }
    }
    var hepsi = ogr.join(' '), hocaSon = gecmis.filter(function (g) { return g.rol === 'hoca'; }).map(function (g) { return g.metin; }).join(' ');
    var hocaK = norm(hocaSon).trim().split(' ').filter(function (w) { return w.length > 4 && !BOS.test(w); });
    var cevapladi = ARGUMAN.karsi.test(ogr[1] || '') && hocaK.some(function (w) { return norm(ogr[1] || '').indexOf(' ' + w.slice(0, 5)) > -1; });
    var lst = [['Gerekçe verdin (because, since…)', ARGUMAN.gerekce.test(hepsi), 'One reason is that…'], ['Örnekle destekledin', ARGUMAN.ornek.test(hepsi), 'For example, in my city…'], ['Hocanın argümanına doğrudan cevap verdin', cevapladi, 'I see your point about …, but…'], ['Net bir kapanış yaptın', ARGUMAN.sonuc.test(ogr[2] || ''), 'To sum up, I still believe…']];
    var oran = lst.filter(function (x) { return x[1]; }).length / lst.length;
    panel.innerHTML = ust('sonuç') + '<div class="ak-kartcik kucuk"><b lang="en">' + esc(m.iddia) + '</b></div>' + kontrol(lst) + '<div class="ak-log son"></div>' + sonDugmeler;
    var log2 = panel.querySelector('.ak-log'); gecmis.forEach(function (g) { msj(log2, g.rol === 'hoca' ? 'hoca' : 'ogr', g.metin); });
    await sonucTepki(oran, 'Strong arguments! You really defended your side.', 'Good debate. Use more examples and answer my points directly.');
    return true;
  }

  /* 3. Anlat-buldur (Taboo) */
  var TABOO_KALIP = /\b(it'?s a (kind|type|sort) of|you (can )?use it|people use it|you can find (it|them)|it'?s the opposite of|it'?s (similar|like)|you do (it|this) when|it'?s something|it'?s a place|it'?s a person|someone who|a place where|when you)\b/i;
  async function taboo(ust) {
    var kat = katBul(durum.kat), aday = yakinSev(kat.taboo, function (x) { return x[2]; }).map(function (x) { return { kelime: x[0], yasak: x[1] }; });
    var ek = await (async function () { var g = gor['taboo:' + durum.kat + ':' + durum.sev] || []; if (g.length < 1) return null; var v = await havuz('taboo'); return v && Array.isArray(v.kartlar) ? v.kartlar.filter(function (k) { return k && k.kelime && Array.isArray(k.yasak); }) : null; })();
    gor['taboo:' + durum.kat + ':' + durum.sev] = [1]; A.ls.yaz('akGor', gor);
    var kartlar = (ek && ek.length >= 3 ? ek : karistir(aday)).slice(0, 4);
    if (kartlar.length < 4) kartlar = kartlar.concat(karistir([].concat.apply([], KB.kategoriler.map(function (k) { return k.taboo; })).filter(function (x) { return sevNo(x[2]) <= sevNo(durum.sev) && !kartlar.some(function (y) { return y.kelime === x[0]; }); })).slice(0, 4 - kartlar.length).map(function (x) { return { kelime: x[0], yasak: x[1] }; }));
    var sure = sevNo(durum.sev) <= 1 ? 60 : 45, puan = 0, satir = [];
    for (var i = 0; i < kartlar.length; i++) {
      var kart = kartlar[i];
      panel.innerHTML = ust('kart ' + (i + 1) + '/' + kartlar.length + ' · puan ' + puan) + '<div class="ak-taboo"><span class="etiket">anlat</span><b lang="en">' + esc(kart.kelime) + '</b><span class="etiket yasak">yasak</span><ul lang="en">' + kart.yasak.map(function (y) { return '<li>' + esc(y) + '</li>'; }).join('') + '</ul></div><div class="ak-tahmin"></div><div class="ak-kayit"></div>';
      kapatBagla();
      if (!i) await soyle('Describe each word without saying it, and without the taboo words. I will guess!', 'Kelimeyi ve yasaklı kelimeleri söylemeden anlat; ben tahmin edeceğim.');
      var tahminEl = panel.querySelector('.ak-tahmin'), aciklama = '', dogru = false, faul = '', deneme = 0, yerelPuan = -1;
      while (deneme < 2 && !dogru && !faul) {
        var r = await konus(panel.querySelector('.ak-kayit'), { sure: deneme ? 25 : sure, etiket: deneme ? 'ek ipucu' : 'anlat', dugme: 'Tahmin et!' }); if (!r) return null;
        aciklama += ' ' + r.metin;
        var yas = kart.yasak.concat([kart.kelime]).filter(function (y) { return icerir(r.metin, y); });
        if (yas.length) { faul = yas[0]; break; }
        h.dusun(true);
        var tah = null, v = A.yz ? await A.yz('etkinlik', { tip: 'taboo', seviye: durum.sev, kategori: kat.en, aciklama: aciklama.trim() }, 10000) : null;
        h.dusun(false); if (durum.iptal) return null;
        if (v && typeof v.tahmin === 'string' && v.tahmin.trim()) {
          tah = v.tahmin.trim();
          dogru = norm(tah).trim().replace(/s$/, '') === norm(kart.kelime).trim().replace(/s$/, '');
          tahminEl.innerHTML = '<p class="msj hoca"><span class="kim">Defne Hoca</span>Is it… <b lang="en">“' + esc(tah) + '”</b>?' + (dogru ? ' ✓' : '') + '</p>';
          await h.soyle(dogru ? 'Is it ' + tah + '? Yes!' : 'Hmm, is it ' + tah + '? No? Give me another clue!', '', { hiz: HIZ[durum.sev] });
        } else {
          /* yapay zekâ yokken hoca tahmin etmiş gibi yapmaz: açıklamanın kalitesine bakar */
          var uzun = kelimeSay(aciklama) >= ({ A1: 6, A2: 8 }[durum.sev] || 11), kalip = TABOO_KALIP.test(aciklama);
          dogru = uzun && kalip; yerelPuan = (uzun ? 1 : 0) + (kalip ? 1 : 0);
          tahminEl.innerHTML = '<p class="msj hoca"><span class="kim">Defne Hoca</span>' + (dogru ? 'Clear clue! I’d get it.' : !uzun ? 'Give me a bit more detail.' : 'Try a pattern like “It’s a kind of…” or “You use it to…”.') + ' <small>(yapay zekâ bağlı değil: açıklaman puanlanıyor)</small></p>';
          await h.soyle(dogru ? 'Clear clue! I would get it.' : 'Give me another clue!', '', { hiz: HIZ[durum.sev] });
          if (!dogru && deneme) dogru = yerelPuan >= 1;
        }
        deneme++;
      }
      var p = faul ? 0 : dogru ? (deneme === 1 && yerelPuan !== 1 ? 2 : 1) : 0; puan += p;
      satir.push({ k: kart.kelime, p: p, faul: faul, metin: aciklama.trim() });
      h.tepki(p === 2 ? 'dogru' : p === 1 ? 'kismen' : 'yanlis');
      if (faul) await soyle('Oh no, you said “' + faul + '”. That’s taboo!', 'Yasaklı kelime: ' + faul);
      await bekle(600);
    }
    var mx = kartlar.length * 2;
    panel.innerHTML = ust('sonuç') + '<div class="ak-puan"><b>' + puan + '</b><small>/ ' + mx + '</small></div><ol class="ak-taboo-son">' + satir.map(function (s) { return '<li><b lang="en">' + esc(s.k) + '</b> <span class="damga' + (s.p ? ' gecti' : '') + '">' + (s.faul ? 'faul: ' + esc(s.faul) : s.p === 2 ? '+2' : s.p === 1 ? '+1' : '0') + '</span><p lang="en">' + (s.metin ? S.renkle(s.metin, []) : '<span class="say">(açıklama yok)</span>') + '</p></li>'; }).join('') + '</ol>' +
      '<p class="say" lang="en">Useful: It’s a kind of… · You use it when… · It’s the opposite of… · You can find it in…</p>' + sonDugmeler;
    await sonucTepki(puan / mx, 'Brilliant clues!', 'Nice! Try “It’s a kind of…” and “You use it to…”.');
    return true;
  }

  /* 4. Rol yapma */
  async function rol(ust) {
    var kat = katBul(durum.kat);
    var sc = await icerikAl('rol', [kat.rol], function (v) { return v.sen && v.acilis && Array.isArray(v.hedefler) && v.hedefler.length && Array.isArray(v.replikler); });
    var hedef = sc.hedefler.map(function (x) { return { tr: x[0], k: x[1], ok: false }; });
    var ciz2 = function () { return kontrol(hedef.map(function (x) { return [esc(x.tr), x.ok]; })); };
    panel.innerHTML = ust(sc.baslik) + '<div class="ak-rol"><div><span class="etiket">senin rolün</span><p lang="en">' + esc(sc.sen) + '</p>' + (sc.sen_tr ? '<small>' + esc(sc.sen_tr) + '</small>' : '') + '</div><div><span class="etiket">Defne Hoca</span><p lang="en">' + esc(sc.hoca) + '</p></div></div>' +
      '<div class="ak-hedef"><span class="etiket">görevler</span>' + ciz2() + '</div><details class="ak-ipucu"' + (sevNo(durum.sev) <= 1 ? ' open' : '') + '><summary>Acadia: işine yarayacak kalıplar</summary><ul lang="en">' + (sc.kaliplar || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>' +
      '<div class="ak-log"></div><div class="ak-kayit"></div><div class="alt-satir"><span></span><button type="button" class="btn sm" data-rolbitir>Sahneyi bitir</button></div>';
    kapatBagla();
    var log = panel.querySelector('.ak-log'), hedefEl = panel.querySelector('.ak-hedef'), gecmis = [], bitir = false;
    panel.querySelector('[data-rolbitir]').onclick = function () { bitir = true; };
    var soz = sc.acilis;
    for (var tur = 0; tur < 7 && !bitir; tur++) {
      msj(log, 'hoca', soz); gecmis.push({ rol: 'hoca', metin: soz });
      await h.soyle(soz, '', { hiz: HIZ[durum.sev] }); if (durum.iptal) return null;
      var r = await konus(panel.querySelector('.ak-kayit'), { sure: 40, etiket: 'senin sıran' }); if (!r) return null;
      msj(log, 'ogr', r.metin); gecmis.push({ rol: 'ogrenci', metin: r.metin });
      var yeni = hedef.filter(function (x) { return !x.ok && x.k.some(function (k) { return icerir(r.metin, k); }); });
      yeni.forEach(function (x) { x.ok = true; }); hedefEl.innerHTML = '<span class="etiket">görevler</span>' + ciz2();
      if (yeni.length) { h.tepki('dogru'); }
      if (hedef.every(function (x) { return x.ok; })) { soz = 'Perfect, I think that’s everything. Thank you!'; msj(log, 'hoca', soz); await h.soyle(soz, '', { hiz: HIZ[durum.sev] }); break; }
      h.dusun(true);
      var y = await yzTur('rol', { senaryo: { baslik: sc.baslik, sen: sc.sen, hoca: sc.hoca }, hedefler_kalan: hedef.filter(function (x) { return !x.ok; }).map(function (x) { return x.tr; }), gecmis: gecmis }, sc.replikler[Math.min(tur, sc.replikler.length - 1)]);
      h.dusun(false); soz = y.yanit_en;
      if (tur >= sc.replikler.length - 1 && y.yerel) break;
    }
    var oran = hedef.filter(function (x) { return x.ok; }).length / hedef.length;
    var kullanilmadi = (sc.kaliplar || []).filter(function (k) { return !gecmis.some(function (g) { return g.rol === 'ogrenci' && icerir(g.metin, k.split(/[ .…?]/).slice(0, 3).join(' ')); }); });
    panel.innerHTML = ust('sonuç') + '<div class="ak-hedef"><span class="etiket">görevler · ' + hedef.filter(function (x) { return x.ok; }).length + '/' + hedef.length + '</span>' + ciz2() + '</div>' +
      (kullanilmadi.length ? '<p class="say">Bir dahaki sefere dene:</p><ul class="ak-kalip" lang="en">' + kullanilmadi.map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('') + '</ul>' : '') + '<div class="ak-log son"></div>' + sonDugmeler;
    var log2 = panel.querySelector('.ak-log'); gecmis.forEach(function (g) { msj(log2, g.rol === 'hoca' ? 'hoca' : 'ogr', g.metin); });
    await sonucTepki(oran, 'Mission complete! Very natural.', 'Good. A few tasks are still open; try again.');
    return true;
  }

  /* 5. Grafik anlatma: veri her seferinde yeniden üretilir */
  function veriUret(g) {
    var n = g.etiketler.length, mn = g.aralik[0], mx = g.aralik[1], v = [], i;
    var r = function () { return Math.random(); };
    if (g.egilim === 'artis') for (i = 0; i < n; i++) v.push(mn + (mx - mn) * (i / (n - 1)) * (.75 + r() * .25) + (mx - mn) * r() * .08);
    else if (g.egilim === 'azalis') for (i = 0; i < n; i++) v.push(mx - (mx - mn) * (i / (n - 1)) * (.75 + r() * .25) - (mx - mn) * r() * .08);
    else { var tepe = Math.floor(r() * n); for (i = 0; i < n; i++) v.push(mn + (mx - mn) * (1 - Math.abs(i - tepe) / n) * (.55 + r() * .45)); }
    var ond = mx < 10 ? 1 : 0, kat = mx > 2000 ? 10 : 1;
    return v.map(function (x) { x = Math.max(mn * .9, Math.min(mx, x)); return ond ? Math.round(x * 10) / 10 : Math.round(x / kat) * kat; });
  }
  function grafikSvg(g, v) {
    var Wd = 520, Hd = 240, pl = 44, pr = 12, pt = 22, pb = 38, mx = Math.max.apply(null, v) * 1.12, n = v.length, cw = (Wd - pl - pr) / n;
    var y = function (x) { return pt + (Hd - pt - pb) * (1 - x / mx); }, x = function (i) { return pl + cw * i + cw / 2; };
    var izgara = [0, .25, .5, .75, 1].map(function (f) { var yy = y(mx * f); return '<path d="M' + pl + ' ' + yy.toFixed(1) + ' H' + (Wd - pr) + '" stroke="var(--cizgi)" stroke-dasharray="3 4"/><text x="' + (pl - 6) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end">' + (mx * f >= 100 ? Math.round(mx * f) : (mx * f).toFixed(mx < 10 ? 1 : 0)) + '</text>'; }).join('');
    var govde = g.tip === 'cizgi'
      ? '<path class="gr-cizgi" pathLength="1" d="' + v.map(function (d, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d).toFixed(1); }).join(' ') + '"/>' + v.map(function (d, i) { return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(d).toFixed(1) + '" r="5"/><text class="deger" x="' + x(i).toFixed(1) + '" y="' + (y(d) - 10).toFixed(1) + '" text-anchor="middle">' + d + '</text>'; }).join('')
      : v.map(function (d, i) { var bw = cw * .62; return '<rect style="--i:' + i + '" x="' + (x(i) - bw / 2).toFixed(1) + '" y="' + y(d).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (Hd - pb - y(d)).toFixed(1) + '" rx="3"/><text class="deger" x="' + x(i).toFixed(1) + '" y="' + (y(d) - 6).toFixed(1) + '" text-anchor="middle">' + d + '</text>'; }).join('');
    return '<svg class="ak-grafik ' + g.tip + '" viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="' + esc(g.baslik) + '">' + izgara + govde + g.etiketler.map(function (e, i) { return '<text class="et" x="' + x(i).toFixed(1) + '" y="' + (Hd - pb + 18) + '" text-anchor="middle">' + esc(e) + '</text>'; }).join('') + '<text class="birim" x="' + pl + '" y="12">' + esc(g.birim) + '</text></svg>';
  }
  function modelAnlatim(g, v) {
    var mxI = v.indexOf(Math.max.apply(null, v)), mnI = v.indexOf(Math.min.apply(null, v)), ilk = v[0], son = v[v.length - 1], fark = (son - ilk) / (Math.abs(ilk) || 1);
    var genel = g.tip === 'cizgi' ? (fark > .15 ? 'Overall, the figures rose from ' + ilk + ' to ' + son + ' ' + g.birim + '.' : fark < -.15 ? 'Overall, the figures fell from ' + ilk + ' to ' + son + ' ' + g.birim + '.' : 'Overall, the figures went up and down but ended close to where they started.') : 'Overall, there are clear differences between the groups.';
    return 'The chart shows ' + g.baslik.charAt(0).toLowerCase() + g.baslik.slice(1) + '. ' + genel + ' The highest figure was for ' + g.etiketler[mxI] + ', at ' + v[mxI] + ' ' + g.birim + ', while the lowest was ' + g.etiketler[mnI] + ', with only ' + v[mnI] + '. In other words, ' + g.etiketler[mxI] + ' was roughly ' + (v[mnI] ? (v[mxI] / v[mnI]).toFixed(1) : 'many') + ' times higher than ' + g.etiketler[mnI] + '.';
  }
  async function grafik(ust) {
    var kat = katBul(durum.kat);
    var g = await icerikAl('grafik', kat.grafik, function (v) { return v.baslik && Array.isArray(v.etiketler) && v.etiketler.length >= 3 && v.etiketler.length <= 8 && Array.isArray(v.aralik) && v.aralik.length === 2 && isFinite(+v.aralik[0]) && isFinite(+v.aralik[1]); });
    g = Object.assign({}, g, { aralik: [+g.aralik[0], +g.aralik[1]], tip: g.tip === 'cizgi' ? 'cizgi' : 'sutun', egilim: /^(artis|azalis|karisik)$/.test(g.egilim) ? g.egilim : 'karisik' });
    var v = veriUret(g), sure = { A2: 45, B1: 60 }[durum.sev] || 75;
    panel.innerHTML = ust('veri yeni üretildi') + '<div class="ak-grafik-kap"><b lang="en">' + esc(g.baslik) + '</b>' + grafikSvg(g, v) + '</div>' +
      '<details class="ak-ipucu"' + (sevNo(durum.sev) <= 2 ? ' open' : '') + '><summary>Acadia: grafik dili</summary><p lang="en">The chart shows… · Overall, … · rose / fell / peaked at · the highest / the lowest · compared to · roughly / about</p></details><div class="ak-kayit"></div>';
    kapatBagla();
    await soyle('Look at the chart carefully. Then describe the main trend, the highest and lowest figures, and make a comparison.', 'Grafiği incele; genel eğilimi, en yüksek ve en düşük değeri anlat, bir karşılaştırma yap.');
    var r = await konus(panel.querySelector('.ak-kayit'), { sure: sure, hazirlik: 20 }); if (!r) return null;
    var t = r.metin, nt = norm(t);
    var sayilar = (t.match(/\d+(?:[.,]\d+)?/g) || []).map(function (x) { return parseFloat(x.replace(',', '.')); });
    var dogruSayi = sayilar.filter(function (s) { return v.some(function (d) { return Math.abs(d - s) <= Math.max(.15 * Math.abs(d), .2); }); }).length;
    var mxI = v.indexOf(Math.max.apply(null, v)), mnI = v.indexOf(Math.min.apply(null, v));
    var etk = function (i) { return icerir(t, g.etiketler[i]) || nt.indexOf(' ' + norm(g.etiketler[i]).trim().split(' ')[0]) > -1; };
    var lst = [['Genel eğilimi söyledin', /\b(overall|in general|generally|increase|increased|rise|rose|grew|grow|went up|decrease|decreased|fell|fall|drop|dropped|declin\w*|went down|stable|steady)\b/i.test(t), 'Overall, the number rose steadily.'],
      ['En yükseği doğru gösterdin (' + esc(g.etiketler[mxI]) + ')', etk(mxI) && /\b(highest|most|peak\w*|largest|biggest|top|maximum)\b/i.test(t), 'The highest figure was for …'],
      ['En düşüğü doğru gösterdin (' + esc(g.etiketler[mnI]) + ')', etk(mnI) && /\b(lowest|least|smallest|fewest|bottom|minimum)\b/i.test(t), 'The lowest was …'],
      ['Sayılarla destekledin (' + dogruSayi + ' doğru değer)', dogruSayi >= 2, 'It reached about 40 percent.'],
      ['Karşılaştırma yaptın', /\b(than|compared|whereas|while|twice|times|in contrast|similar)\b/i.test(t), 'Cycling was twice as popular as…']];
    var oran = lst.filter(function (x) { return x[1]; }).length / lst.length, model = modelAnlatim(g, v);
    panel.innerHTML = ust('sonuç') + '<div class="ak-grafik-kap kucuk">' + grafikSvg(g, v) + '</div>' + kontrol(lst) +
      '<div class="rp-yanyana"><div><span class="etiket">senin anlatımın</span><p lang="en">' + (t ? S.renkle(t, HOCA.gramer(t)) : '<span class="say">(algılanmadı)</span>') + '</p></div><div class="rp-ornek"><span class="etiket">örnek anlatım (bu veriden)</span><p lang="en">' + S.renkle(model, []) + '</p></div></div>' +
      (r.ses ? '<audio controls src="' + r.ses + '"></audio>' : '') + '<div class="alt-satir"><button type="button" class="btn sm" data-oku="' + esc(model) + '">🔊 Örneği hoca okusun</button><span></span></div>' + sonDugmeler;
    await sonucTepki(oran, 'Very clear description!', 'Good. Add numbers and a comparison.');
    return true;
  }

  /* 6. Hikâye zinciri */
  async function hikaye(ust) {
    var kat = katBul(durum.kat), aday = yakinSev(kat.hikaye, function (x) { return x[0]; }).map(function (x) { return { bas: x[1] }; });
    var hk = await icerikAl('hikaye', aday, function (v) { return typeof v.bas === 'string' && v.bas.length > 10; });
    var kel = karistir(hucre().kelimeler).slice(0, 4), turSure = { A1: 25, A2: 30, B1: 35 }[durum.sev] || 40, parcalar = [{ kim: 'hoca', t: hk.bas }], kullandi = [];
    var devamlar = karistir(KB.hikayeDevam);
    var hikayeHtml = function () { return parcalar.map(function (p) { return '<span class="hk-' + p.kim + '">' + (p.kim === 'ogr' ? S.renkle(p.t, []) : esc(p.t)) + '</span>'; }).join(' '); };
    panel.innerHTML = ust('4 tur') + '<div class="ak-hikaye" lang="en"></div><p class="ak-tur"></p><div class="ak-kayit"></div>';
    kapatBagla();
    var hEl = panel.querySelector('.ak-hikaye'), turEl = panel.querySelector('.ak-tur');
    hEl.innerHTML = hikayeHtml();
    await soyle('Let’s write a story together. I’ll start. ' + hk.bas, 'Birlikte hikâye yazıyoruz; her turda verdiğim kelimeyi kullan.');
    for (var i = 0; i < kel.length; i++) {
      turEl.innerHTML = 'Tur ' + (i + 1) + '/4 · bu kelimeyi kullan: <b class="ak-cip" lang="en">' + esc(kel[i]) + '</b>';
      var r = await konus(panel.querySelector('.ak-kayit'), { sure: turSure, etiket: 'devam et' }); if (!r) return null;
      var ok = icerir(r.metin, kel[i]); kullandi.push(ok);
      parcalar.push({ kim: 'ogr', t: r.metin || '…' }); hEl.innerHTML = hikayeHtml(); hEl.scrollTop = hEl.scrollHeight;
      h.tepki(ok ? 'dogru' : 'kismen');
      if (i < kel.length - 1) {
        h.dusun(true);
        var y = await yzTur('hikaye', { hikaye: parcalar.map(function (p) { return p.t; }).join(' '), sonraki_kelime: kel[i + 1] }, devamlar[i] || 'And then something unexpected happened.');
        h.dusun(false); if (durum.iptal) return null;
        parcalar.push({ kim: 'hoca', t: y.yanit_en }); hEl.innerHTML = hikayeHtml();
        await h.soyle(y.yanit_en, '', { hiz: HIZ[durum.sev] });
      }
    }
    var ogrMetin = parcalar.filter(function (p) { return p.kim === 'ogr'; }).map(function (p) { return p.t; }).join(' '), gr = HOCA.gramer(ogrMetin);
    var gecmisZaman = /\b(was|were|had|went|said|saw|found|\w+ed)\b/i.test(hk.bas), simdiki = (ogrMetin.match(/\b(is|are|go|goes|say|says|see|sees|find|finds)\b/gi) || []).length, gecmisSay = (ogrMetin.match(/\b(was|were|had|went|said|saw|found|\w+ed)\b/gi) || []).length;
    var lst = kel.map(function (w, i) { return ['“' + esc(w) + '” kelimesini kullandın', kullandi[i]]; });
    if (gecmisZaman) lst.push(['Hikâyeyi geçmiş zamanda sürdürdün', gecmisSay >= simdiki, 'Then she opened the door and saw…']);
    var oran = lst.filter(function (x) { return x[1]; }).length / lst.length;
    panel.innerHTML = ust('sonuç') + '<div class="ak-hikaye son" lang="en">' + hikayeHtml() + '</div>' + kontrol(lst) +
      (gr.length ? '<p class="say">Düzeltmeler: ' + gr.slice(0, 3).map(function (g) { return '<span lang="en">' + esc(g.parca) + ' → ' + esc(g.oneri) + '</span>'; }).join(' · ') + '</p>' : '') +
      '<div class="alt-satir"><button type="button" class="btn sm" data-oku="' + esc(parcalar.map(function (p) { return p.t; }).join(' ')) + '">🔊 Hikâyeyi hoca okusun</button><span></span></div>' + sonDugmeler;
    await sonucTepki(oran, 'What a story! I loved your ideas.', 'Nice story. Remember to use every word.');
    return true;
  }

  /* 7. Röportaj: soruları öğrenci sorar */
  var SORU = { wh: /^\s*(what|where|when|why|how|who|which|whose)\b/i, yn: /^\s*(do|does|did|is|are|was|were|have|has|had|can|could|will|would|should|may)\b/i, dolayli: /\b(could you tell me|can you tell me|do you know|i was wondering|would you mind telling|i'?d like to know)\b/i };
  function soruTuru(t) { var s = String(t).trim(); if (SORU.dolayli.test(s)) return 'dolayli'; if (SORU.wh.test(s)) return 'wh'; if (SORU.yn.test(s)) return 'yn'; return /\?\s*$/.test(s) ? 'diger' : ''; }
  function soruHatasi(t) {
    var s = String(t).trim().toLowerCase();
    if (/^(what|where|when|why|how|who|which)\s+(you|he|she|they|we|it|your)\b/.test(s)) return ['Yardımcı fiil eksik', s.replace(/^(\w+)\s+/, '$1 do ')];
    if (/^(do|does|did)\s+(you|he|she|they)\s+(can|could|will|is|are)\b/.test(s)) return ['“do” ile “can/will/be” birlikte kullanılmaz', ''];
    if (/^(does|did)\s+\w+\s+\w+(s|ed)\b/.test(s)) return ['does/did’den sonra fiil yalın olur', ''];
    return null;
  }
  async function roportaj(ust) {
    var kat = katBul(durum.kat);
    var p = await icerikAl('roportaj', [kat.roportaj], function (v) { return v.kim && v.giris && Array.isArray(v.cevaplar) && v.cevaplar.length >= 3; });
    var hedef = { A1: 3, A2: 4 }[durum.sev] || 5, sorular = [], kullanilan = [], gecmis = [];
    panel.innerHTML = ust(p.kim) + '<div class="ak-rol"><div><span class="etiket">konuğun</span><p lang="en">' + esc(p.kim) + '</p>' + (p.kim_tr ? '<small>' + esc(p.kim_tr) + '</small>' : '') + '</div><div><span class="etiket">görev</span><p>' + hedef + ' soru sor; en az bir takip sorusu ve iki farklı soru tipi kullan.</p></div></div>' +
      '<details class="ak-ipucu"' + (sevNo(durum.sev) <= 2 ? ' open' : '') + '><summary>Acadia: soru kalıpları</summary><ul lang="en"><li>What / Why / How … do you …?</li><li>Have you ever …?</li><li>Could you tell me …?</li><li>Takip: Why was that? · What happened next?</li></ul></details>' +
      '<div class="ak-log"></div><p class="ak-tur say"></p><div class="ak-kayit"></div>';
    kapatBagla();
    var log = panel.querySelector('.ak-log'), turEl = panel.querySelector('.ak-tur');
    msj(log, 'hoca', p.giris); await h.soyle(p.giris, '', { hiz: HIZ[durum.sev] });
    for (var i = 0; i < hedef; i++) {
      turEl.textContent = 'Soru ' + (i + 1) + '/' + hedef;
      var r = await konus(panel.querySelector('.ak-kayit'), { sure: 25, etiket: 'soru sor', dugme: 'Sor' }); if (!r) return null;
      var q = r.metin, tur = soruTuru(q), hata = soruHatasi(q), onceki = gecmis.length ? gecmis[gecmis.length - 1].metin : '';
      var takip = !!onceki && norm(onceki).trim().split(' ').filter(function (w) { return w.length > 4 && !BOS.test(w); }).some(function (w) { return norm(q).indexOf(' ' + w.slice(0, 5)) > -1; });
      sorular.push({ q: q, tur: tur, hata: hata, takip: takip });
      var el = msj(log, 'ogr', q, tur ? '' : 'yanlis');
      if (hata) el.insertAdjacentHTML('beforeend', '<small class="hoca-not"><span>' + esc(hata[0]) + '</span>' + (hata[1] ? ' <span lang="en">→ ' + esc(hata[1]) + '…</span>' : '') + '</small>');
      gecmis.push({ rol: 'ogrenci', metin: q });
      var yerel = p.genel;
      for (var j = 0; j < p.cevaplar.length; j++) { if (kullanilan.indexOf(j) < 0 && p.cevaplar[j][0].some(function (k) { return icerir(q, k); })) { yerel = p.cevaplar[j][1]; kullanilan.push(j); break; } }
      h.dusun(true);
      var y = await yzTur('roportaj', { persona: { kim: p.kim, giris: p.giris }, soru: q, gecmis: gecmis }, tur ? yerel : 'Sorry, was that a question? Could you ask me again?');
      h.dusun(false); if (durum.iptal) return null;
      msj(log, 'hoca', y.yanit_en); gecmis.push({ rol: 'hoca', metin: y.yanit_en });
      await h.soyle(y.yanit_en, '', { hiz: HIZ[durum.sev] });
    }
    var turler = sorular.map(function (s) { return s.tur; }).filter(Boolean), cesit = turler.filter(function (t, i) { return turler.indexOf(t) === i; }).length;
    var lst = [['Hepsi gerçek soruydu (' + turler.length + '/' + sorular.length + ')', turler.length === sorular.length, 'What made you choose this job?'], ['En az iki soru tipi kullandın', cesit >= 2, 'Could you tell me how you started?'], ['Takip sorusu sordun', sorular.some(function (s) { return s.takip; }), 'Why was that so difficult?'], ['Soru dilbilgisi doğru', !sorular.some(function (s) { return s.hata; }), 'Why did you start…?']];
    var oran = lst.filter(function (x) { return x[1]; }).length / lst.length, TUR = { wh: 'wh-sorusu', yn: 'evet/hayır', dolayli: 'dolaylı', diger: 'soru' };
    panel.innerHTML = ust('sonuç') + kontrol(lst) + '<ul class="ak-sorular">' + sorular.map(function (s) { return '<li><span class="ak-cip' + (s.tur ? ' ok' : '') + '">' + (TUR[s.tur] || 'soru değil') + (s.takip ? ' · takip' : '') + '</span> <span lang="en">' + esc(s.q || '(algılanmadı)') + '</span></li>'; }).join('') + '</ul><div class="ak-log son"></div>' + sonDugmeler;
    var log2 = panel.querySelector('.ak-log'); gecmis.forEach(function (g) { msj(log2, g.rol === 'hoca' ? 'hoca' : 'ogr', g.metin); });
    await sonucTepki(oran, 'Great interviewer! Natural questions.', 'Good. Try a follow-up question next time.');
    return true;
  }

  W.KONUSMA = { kur: kur, ETK: ETK, soruTuru: soruTuru, soruHatasi: soruHatasi, veriUret: veriUret, modelAnlatim: modelAnlatim, yakinSev: function (l, f, s) { var e = durum.sev; durum.sev = s; var r = yakinSev(l, f); durum.sev = e; return r; }, icerir: icerir };
})();
