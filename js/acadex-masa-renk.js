/* ==========================================================================
   ACADEX · MASANIN DEVAMI (js/acadex-masa-renk.js + css/acadex-masa-renk.css), 27.11.2026
   "Bugün" sayfasının alt kısmı: ders renkleri, bugünün hedefi (3 küçük adım + halka),
   seri alevi, sınav geri sayımı ve Acadia anları.
   acadex-ink.js her çizimden sonra 'acx:home' olayını aynı veriyle (D) yayar; bu dosya
   veriyi yeniden çekmez, yalnız yaklaşan sınavları (study_events, event_type='exam') sorar.
   Hareketler prefers-reduced-motion'da ve Ayarlar > "Hareketi azalt" açıkken durur.
   ========================================================================== */
(function () {
  'use strict';
  var D0 = document, W = window;
  var home = D0.getElementById('home-view'); if (!home) return;
  var $ = function (s, r) { return (r || D0).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D0).querySelectorAll(s)); };
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var calm = function () { return (W.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || D0.documentElement.classList.contains('axa-rm'); };
  var store = { get: function (k) { return lsafe(function () { return localStorage.getItem('acadex.mr.' + k); }, null); }, set: function (k, v) { lsafe(function () { localStorage.setItem('acadex.mr.' + k, v); }); } };
  var ymd = function (d) { d = new Date(d); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'], GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  var go = function (v) { if (typeof W.switchDashboardView === 'function') W.switchDashboardView(v); };
  var prof = function () { return lsafe(function () { return W.currentUserProfile || (typeof currentUserProfile !== 'undefined' ? currentUserProfile : null); }, null) || {}; }; // eslint-disable-line no-undef
  var me = function () { return lsafe(function () { return W.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null); }, null); }; // eslint-disable-line no-undef
  var baseName = function (n) {
    if (W.axDocTitle) return W.axDocTitle(n);
    n = String(n || '').replace(/\.[a-z0-9]{2,5}$/i, ''); var m = n.match(/^\d{10,}_(?:\d{10,}_)?(.+)$/); if (m) n = m[1];
    return n.replace(/_+/g, ' ').trim() || 'İsimsiz belge';
  };

  /* ---------------- ders renkleri ---------------- */
  /* Aynı ders her yerde aynı renkte: belge, kart destesi, son yaptıkların, hafta ve saatler.
     Anahtar: belgenin course_tag'i; yoksa addaki ders kodu (ITB 311, MUH 201); o da yoksa belgenin adı. */
  var PAL = [
    { c: '#2F6BFF', l: '#E3ECFF' }, { c: '#E5544A', l: '#FDE6E3' }, { c: '#1E8A55', l: '#DCF2E6' }, { c: '#D9900F', l: '#FFF0CC' },
    { c: '#8A5CC8', l: '#EFE6FB' }, { c: '#0E8C9B', l: '#DAF1F3' }, { c: '#D6478E', l: '#FBE3EF' }, { c: '#B8612A', l: '#F7E5D6' }
  ];
  var kodOf = function (s) { var m = String(s || '').toLocaleUpperCase('tr').match(/(?:^|[^A-ZÇĞİÖŞÜ])([A-ZÇĞİÖŞÜ]{2,5})[\s\-_]?(\d{3})(?!\d)/); return m ? m[1] + ' ' + m[2] : ''; };
  /* anahtar büyük harf ve noktasız: 'itb 311', 'İTB 311' ve dosya adındaki 'ITB 311' aynı derstir */
  var norm = function (t) { return String(t || '').trim().toLocaleUpperCase('tr').replace(/İ/g, 'I').replace(/\s+/g, ' '); };
  var keyOf = function (name, tag) { if (tag && String(tag).trim()) return norm(kodOf(tag) || tag); var k = kodOf(baseName(name)); return k ? norm(k) : baseName(name).toLocaleLowerCase('tr'); };
  var hash = function (s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return Math.abs(h); };
  var renk = function (key) { return key ? PAL[hash(key) % PAL.length] : PAL[0]; };
  var api = W.AXMASA = W.AXMASA || {};
  api.renk = renk; api.keyOf = keyOf; api.kodOf = kodOf; api.norm = norm; api.PAL = PAL;
  var paint = function (el, k) { if (!el || !k) return; var r = renk(k); el.style.setProperty('--dc', r.c); el.style.setProperty('--dl', r.l); el.setAttribute('data-ders', k); };

  var dersler = {}, docKey = {}, nameKey = {};
  var indexle = function (D) {
    dersler = {}; docKey = {}; nameKey = {};
    (D.allDocs || D.docs || []).forEach(function (d) {
      var k = keyOf(d.file_name, d.course_tag); docKey[d.id] = k; nameKey[baseName(d.file_name)] = k;
      if (!dersler[k]) dersler[k] = { k: k, ad: kodOf(d.course_tag || '') || (d.course_tag ? String(d.course_tag).trim() : '') || kodOf(baseName(d.file_name)) || baseName(d.file_name), n: 0, son: d.uploaded_at };
      dersler[k].n++;
    });
  };
  var keyFromText = function (t) {
    t = String(t || '').trim(); if (!t) return '';
    if (nameKey[t]) return nameKey[t];
    var kod = kodOf(t) ? norm(kodOf(t)) : ''; if (kod && dersler[kod]) return kod;
    for (var n in nameKey) if (n && t.indexOf(n) >= 0) return nameKey[n];
    return kod;
  };

  var renklendir = function (D) {
    /* son yaptıkların: tür + ders */
    $$('[data-log] li').forEach(function (li) {
      var tx = li.textContent, tur = /yüklendi/.test(tx) ? 'doc' : /Kart destesi/.test(tx) ? 'card' : /Deneme/.test(tx) ? 'exam' : /Study Lab/.test(tx) ? 'lab' : 'doc';
      li.setAttribute('data-tur', tur);
      var em = $('em', li), b = $('b', li), k = '';
      if (tur === 'doc' && b) k = keyFromText(b.textContent);
      else if (tur === 'card' && em) k = keyFromText(em.textContent.split(' · ')[0]);
      if (k) paint(li, k);
    });
    /* belge pasaportu ve raf */
    var d0 = (D.docs || [])[0];
    if (d0) { paint($('[data-passport] .doc-th'), docKey[d0.id]); paint($('[data-shelf] .sh:first-child .book'), docKey[d0.id]); }
    var c0 = (D.cards || [])[0]; if (c0) paint($('[data-shelf] .cards'), docKey[c0.document_id] || keyFromText(c0.documents && baseName(c0.documents.file_name)));
    /* hafta ve saatler: başlıktaki ders koduna göre */
    $$('[data-week] .plan, [data-hours] .h-ev').forEach(function (p) { var k = keyFromText(p.textContent); if (k) paint(p, k); });
    klasorler(D);
  };

  /* belgelerin kartında ders klasörleri: renkli sekmeler */
  var klasorler = function () {
    var kart = $('#home-view .grid > .card[aria-labelledby="t-docs"]'); if (!kart) return;
    var box = $('[data-mr-klasor]', kart);
    if (!box) { box = D0.createElement('div'); box.className = 'mr-klasor'; box.setAttribute('data-mr-klasor', ''); var add = $('.add-doc', kart); kart.insertBefore(box, add); }
    var L = Object.keys(dersler).map(function (k) { return dersler[k]; }).sort(function (a, b) { return b.n - a.n || String(b.son).localeCompare(String(a.son)); }).slice(0, 6);
    if (!L.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<span class="mr-k-b hand">derslerine göre klasörler</span><ul>' + L.map(function (d, i) {
      var r = renk(d.k);
      return '<li style="--dc:' + r.c + ';--dl:' + r.l + ';--i:' + i + '"><a href="#docs" data-go="docs" data-mr-ders="' + esc(d.k) + '" aria-label="' + esc(d.ad) + ': ' + d.n + ' belge"><i class="mr-k-tab" aria-hidden="true"></i><b>' + esc(d.ad) + '</b><small>' + d.n + ' belge</small></a></li>';
    }).join('') + '</ul>';
  };
  home.addEventListener('click', function (e) {
    var a = e.target.closest('[data-mr-ders]'); if (!a) return;
    var k = a.getAttribute('data-mr-ders'); setTimeout(function () { var s = $('#docs-view input[type="search"], #docs-search, [data-docs-search]'); if (s && /^[A-ZÇĞİÖŞÜ]{2,5} \d{3}$/.test(k)) { s.value = k; s.dispatchEvent(new Event('input', { bubbles: true })); } }, 400);
  });

  /* ---------------- bugünün hedefi ---------------- */
  var gun = $('[data-mr-gun]');
  var hedefDk = function () { var v = +store.get('dk'); return [15, 25, 45, 60].indexOf(v) >= 0 ? v : 25; };
  var bugunOf = function (D) {
    var t = ymd(new Date()), now = new Date();
    var labDk = (D.lab || []).filter(function (l) { return ymd(l.created_at) === t; }).reduce(function (a, l) { return a + (Number(l.minutes) || 0); }, 0);
    var due = (D.conf || []).filter(function (c) { return c.next_review_at && new Date(c.next_review_at) <= now; }).length;
    var adim = (D.allDocs || []).some(function (d) { return ymd(d.uploaded_at) === t; }) || (D.cards || []).some(function (c) { return ymd(c.created_at) === t; }) || (D.exams || []).some(function (e) { return e.completed_at && ymd(e.completed_at) === t; });
    var dk = hedefDk(), kart = (D.cards || []).length;
    return [
      { id: 'tekrar', renk: '#2F6BFF', ok: kart > 0 && due === 0, ad: !kart ? 'ilk kart desteni çıkar' : due ? due + ' kartın tekrarı bekliyor' : 'tekrarların bitti', alt: !kart ? 'bir belgeyi özetle, kartlar kendiliğinden çıkar' : due ? 'aralıklı tekrar: unutmadan önce bir bakış' : 'yarın yenileri gelecek', btn: !kart ? 'belge seç' : due ? 'tekrara başla' : '', act: !kart ? 'docs' : 'review' },
      { id: 'lab', renk: '#1E8A55', ok: labDk >= dk, ad: 'Study Lab’de ' + dk + ' dk', alt: labDk ? 'bugün ' + Math.round(labDk) + ' dk çalıştın' : 'Pomodoro, Feynman ya da Active Recall', btn: labDk >= dk ? '' : 'laboratuvara git', act: 'studylab', pct: Math.min(1, labDk / dk) },
      { id: 'adim', renk: '#E8822F', ok: adim, ad: 'bir adım ileri', alt: adim ? 'bugün yeni bir şey ekledin' : 'yeni belge, yeni deste ya da bir deneme', btn: adim ? '' : 'deneme çöz', act: 'exams' }
    ];
  };
  var halka = function (G) {
    var n = G.length, cx = 46, cy = 46, r = 38, gap = 0.28, step = Math.PI * 2 / n, s = '';
    G.forEach(function (g, i) {
      var a0 = -Math.PI / 2 + i * step + gap / 2, a1 = a0 + step - gap;
      var p = function (a) { return (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2); };
      var d = 'M' + p(a0) + ' A' + r + ' ' + r + ' 0 0 1 ' + p(a1);
      s += '<path class="mr-h-bg" d="' + d + '"/>';
      var pct = g.ok ? 1 : (g.pct || 0);
      if (pct > 0) s += '<path class="mr-h-on" pathLength="1" style="--c:' + g.renk + ';--p:' + pct.toFixed(3) + ';--i:' + i + '" d="' + d + '"/>';
    });
    var ok = G.filter(function (g) { return g.ok; }).length;
    return '<svg class="mr-halka" viewBox="0 0 92 92" role="img" aria-label="Bugünün hedefi: ' + n + ' adımdan ' + ok + ' tanesi tamam">' + s + '<text x="46" y="44" text-anchor="middle" class="mr-h-n">' + ok + '/' + n + '</text><text x="46" y="60" text-anchor="middle" class="mr-h-s">' + (ok === n ? 'tamam' : 'bugün') + '</text></svg>';
  };
  var ICO = {
    tekrar: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="9" width="17" height="13" rx="2.5" fill="#E3ECFF" stroke="#1A2A5C" stroke-width="1.8"/><rect x="10" y="5" width="17" height="13" rx="2.5" fill="#fff" stroke="#1A2A5C" stroke-width="1.8"/><path d="M14 11.5h9M14 14.5h6" stroke="#2F6BFF" stroke-width="1.8" stroke-linecap="round"/><path d="M8 27c3 1.6 7 1.6 10 0" fill="none" stroke="#2F6BFF" stroke-width="1.8" stroke-linecap="round"/></svg>',
    lab: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 4h8M13 4v8L6.5 24c-.8 1.6.2 3 1.9 3h15.2c1.7 0 2.7-1.4 1.9-3L19 12V4" fill="#fff" stroke="#1A2A5C" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 20.5h14l1.6 3.4c.4.9-.2 1.6-1.1 1.6H8.5c-.9 0-1.5-.7-1.1-1.6Z" fill="#7FD3A8"/><circle cx="14" cy="22.5" r="1.2" fill="#1E8A55"/><circle cx="18.5" cy="21.6" r=".9" fill="#1E8A55"/></svg>',
    adim: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 26V6" stroke="#1A2A5C" stroke-width="1.8" stroke-linecap="round"/><path d="M7.6 6.5c4-1.6 7 1.6 11 0 1.8-.7 3.6-.8 5.4-.3l-2.4 6.2 2.4 6.1c-1.8-.4-3.6-.3-5.4.4-4 1.6-7-1.6-11 0Z" fill="#FFB27A" stroke="#1A2A5C" stroke-width="1.8" stroke-linejoin="round"/></svg>'
  };
  var tikSvg = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5 8 14.5 16 5.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var seriOf = function () {
    var p = prof(), s = Number(p.current_streak) || 0, last = p.last_active_date ? String(p.last_active_date).slice(0, 10) : '';
    var t = ymd(new Date()), y = ymd(new Date(Date.now() - 864e5));
    return last === t || last === y ? s : 0;
  };
  var alev = function (s) {
    return '<svg class="mr-alev" viewBox="0 0 64 80" aria-hidden="true"><defs><linearGradient id="mr-ag" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#E5544A"/><stop offset=".55" stop-color="#F58B3A"/><stop offset="1" stop-color="#FFC94D"/></linearGradient></defs>' +
      '<g class="mr-a-g' + (s ? '' : ' off') + '"><path class="mr-a-d" d="M32 4c4 12 18 20 18 40a18 18 0 0 1-36 0c0-10 5-16 9-21 1 6 4 9 7 10-1-11 0-20 2-29Z" fill="url(#mr-ag)" stroke="#1A2A5C" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path class="mr-a-i" d="M32 40c3 5 9 8 9 15a9 9 0 0 1-18 0c0-5 3-8 5-10 1 3 2 4 4 5 0-4 0-7 0-10Z" fill="#FFE7A3"/></g>' +
      '<text x="32" y="64" text-anchor="middle">' + s + '</text></svg>';
  };

  var sinavlar = null, sinavYuk = false;
  var sinavCek = async function () {
    var u = me(); if (!u || typeof supabaseClient === 'undefined') return []; // eslint-disable-line no-undef
    var r = await lsafe(function () {
      return supabaseClient.from('study_events').select('id, title, event_date, event_type, is_done').eq('user_id', u.id).eq('event_type', 'exam').gte('event_date', ymd(new Date())).order('event_date', { ascending: true }).limit(6); // eslint-disable-line no-undef
    }, Promise.resolve({ data: [] }));
    return ((r && r.data) || []).filter(function (e) { return !e.is_done; }).slice(0, 3);
  };
  var kalanGun = function (d) { var a = new Date(); a.setHours(0, 0, 0, 0); var b = new Date(String(d).slice(0, 10) + 'T00:00:00'); return Math.round((b - a) / 864e5); };
  var biletler = function (L) {
    if (!L.length) return '<div class="mr-s-bos"><p class="hand">sınav tarihini ekle,<br>geri sayımı ben tutayım.</p><button type="button" class="mr-btn" data-mr-sinav-ekle>+ sınav ekle</button></div>';
    return '<ol class="mr-bilet">' + L.map(function (e, i) {
      var k = keyFromText(e.title) || String(e.title).toLocaleLowerCase('tr'), r = renk(k), g = kalanGun(e.event_date), dt = new Date(String(e.event_date).slice(0, 10) + 'T12:00:00');
      var saat = (String(e.event_date).match(/T(\d\d:\d\d)/) || [])[1];
      var acil = g <= 3 ? ' acil' : g <= 7 ? ' yakin' : '';
      return '<li class="mr-b' + acil + '" style="--dc:' + r.c + ';--dl:' + r.l + ';--i:' + i + '"><button type="button" data-mr-sinav="' + esc(String(e.id)) + '" aria-label="' + esc(e.title) + ': ' + (g === 0 ? 'bugün' : g === 1 ? 'yarın' : g + ' gün kaldı') + ', düzenle">' +
        '<span class="mr-b-ay">' + MON[dt.getMonth()] + ' · ' + GUN[dt.getDay()] + '</span>' +
        '<span class="mr-b-n">' + (g === 0 ? '<b>bugün</b>' : g === 1 ? '<b>yarın</b>' : '<b>' + g + '</b><small>gün</small>') + '</span>' +
        '<span class="mr-b-t">' + esc(e.title) + '</span><span class="mr-b-s">' + dt.getDate() + ' ' + MON[dt.getMonth()] + (saat && saat !== '00:00' ? ' · ' + saat : '') + '</span></button></li>';
    }).join('') + '</ol>';
  };

  var son = null;
  var cizGun = function (D) {
    if (!gun) return;
    var G = bugunOf(D), ok = G.filter(function (g) { return g.ok; }).length, s = seriOf(), dk = hedefDk();
    $('[data-mr-hedef]', gun).innerHTML = halka(G) + '<ul class="mr-gorev">' + G.map(function (g) {
      return '<li class="' + (g.ok ? 'ok' : '') + '" style="--c:' + g.renk + '"><span class="mr-g-ic">' + ICO[g.id] + (g.ok ? '<i class="mr-g-tik">' + tikSvg + '</i>' : '') + '</span><span class="mr-g-t"><b>' + esc(g.ad) + '</b><small>' + esc(g.alt) + '</small></span>' +
        (g.btn ? '<button type="button" class="mr-g-btn" data-mr-act="' + g.act + '">' + esc(g.btn) + ' →</button>' : '') + '</li>';
    }).join('') + '</ul>' +
      '<div class="mr-dk" role="group" aria-label="Study Lab günlük dakika hedefi"><span class="hand">günlük Study Lab hedefi:</span>' + [15, 25, 45, 60].map(function (v) { return '<button type="button" data-mr-dk="' + v + '" aria-pressed="' + (v === dk) + '">' + v + ' dk</button>'; }).join('') + '</div>';
    $('[data-mr-seri]', gun).innerHTML = alev(s) + '<p><b>' + (s ? s + ' gün' : 'seri yok') + '</b><span class="hand">' + (s > 1 ? 'yarın da gel, ' + (s + 1) + ' olsun' : s === 1 ? 'seri başladı, yarın iki' : 'bugün başlat') + '</span></p>';
    if (sinavlar) $('[data-mr-sinav-l]', gun).innerHTML = biletler(sinavlar);
    var ac = $('.mr-acadia', gun);
    if (ac) {
      var msg = ok === G.length ? 'bugünkü hedef tamam, harikasın!' : sinavlar && sinavlar[0] && kalanGun(sinavlar[0].event_date) <= 3 ? 'sınav yaklaşıyor; önce tekrarlar.' : ok ? 'güzel başladın, ' + (G.length - ok) + ' adım kaldı.' : 'üç küçük adım; ilkiyle başlayalım mı?';
      ac.dataset.mood = ok === G.length ? 'kutlama' : ok ? 'mutlu' : 'odakli';
      ac.dataset.pose = ok === G.length ? 'zipla' : 'isaret';
      if (ok === G.length) ac.dataset.costume = 'kutlama'; else delete ac.dataset.costume;
      if (W.AcadiaKit) { ac.__acdV = -1; W.AcadiaKit.mount(gun); }
      var sy = $('[data-mr-say]', gun); if (sy && son !== msg) { sy.textContent = msg; sy.classList.remove('on'); void sy.offsetWidth; sy.classList.add('on'); }
      son = msg;
    }
    if (ok === G.length && store.get('kutlama') !== ymd(new Date())) { store.set('kutlama', ymd(new Date())); konfeti(gun); }
  };
  var konfeti = function (host) {
    if (calm()) return;
    var k = D0.createElement('div'); k.className = 'mr-konfeti'; k.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 26; i++) { var p = D0.createElement('i'); p.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%'); p.style.setProperty('--d', (Math.random() * .5).toFixed(2) + 's'); p.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg'); p.style.background = PAL[i % PAL.length].c; k.appendChild(p); }
    host.appendChild(k); setTimeout(function () { k.remove(); }, 2600);
  };

  if (gun) gun.addEventListener('click', function (e) {
    var a = e.target.closest('[data-mr-act]'), dkb = e.target.closest('[data-mr-dk]'), se = e.target.closest('[data-mr-sinav]'), sy = e.target.closest('[data-mr-sinav-ekle]');
    if (a) { var v = a.getAttribute('data-mr-act'); if (v === 'review') { var r = $('[data-review]'); if (r) r.click(); } else go(v); return; }
    if (dkb) { store.set('dk', dkb.getAttribute('data-mr-dk')); if (DATA) cizGun(DATA); var f = $('[data-mr-dk="' + dkb.getAttribute('data-mr-dk') + '"]', gun); if (f) f.focus(); return; }
    if (se) { go('planner'); var id = se.getAttribute('data-mr-sinav'); setTimeout(function () { if (!(W.acxPlanEdit && W.acxPlanEdit(id)) && W.acxPlanOpen) W.acxPlanOpen({ type: 'sinav' }); }, 350); return; }
    if (sy) { go('planner'); setTimeout(function () { if (W.acxPlanOpen) W.acxPlanOpen({ type: 'sinav' }); }, 350); }
  });

  /* hafta şeridindeki sınavlara kalan gün rozeti */
  var haftaSinav = function () {
    $$('[data-week] li').forEach(function (li) {
      var a = $('[data-add]', li); if (!a) return; var g = kalanGun(a.getAttribute('data-add'));
      $$('.plan.sinav', li).forEach(function (p) { if (g >= 0 && !$('.mr-kalan', p)) p.insertAdjacentHTML('beforeend', '<i class="mr-kalan">' + (g === 0 ? 'bugün' : g === 1 ? 'yarın' : g + ' gün') + '</i>'); });
    });
  };

  /* boş durumlarda Acadia */
  var bosAcadia = function (D) {
    var lg = $('[data-log]'); if (lg && !$('li', lg) && !$('[data-acadia]', lg)) lg.insertAdjacentHTML('afterbegin', '<span class="mr-bos-a" data-acadia data-mood="mutlu" data-pose="isaret" data-size="64"></span>');
    var pp = $('[data-passport]'); if (pp && !(D.docs || []).length && !$('[data-acadia]', pp)) pp.insertAdjacentHTML('afterbegin', '<span class="mr-bos-a" data-acadia data-mood="dusunuyor" data-pose="oku" data-size="64"></span>');
  };

  var DATA = null;
  D0.addEventListener('acx:home', async function (e) {
    var D = e.detail || {}; DATA = D;
    indexle(D); renklendir(D); haftaSinav(); bosAcadia(D); cizGun(D);
    if (!sinavYuk) { sinavYuk = true; try { sinavlar = await sinavCek(); } catch (er) { sinavlar = []; } sinavYuk = false; cizGun(D); }
  });
  /* etkinlik eklenince/silinince yeniden say */
  W.addEventListener('focus', function () { if (DATA && !sinavYuk) { sinavYuk = true; sinavCek().then(function (L) { sinavlar = L; sinavYuk = false; cizGun(DATA); }, function () { sinavYuk = false; }); } });
})();
