/* ==========================================================================
   ACADEX SÖZLÜK (js/acadex-sozluk.js), 18.11.2026
   Her panelden erişilen terim sözlüğü. Tek dosya; stilini kendisi ekler (lab sayfalarında da çalışsın).
     - Sol altta "Sözlük" düğmesi; lab sayfalarında Ctrl+K (Cmd+K). Dashboard'da Ctrl+K zaten genel
       arama: orada arama sonuçlarının başına sözlük eşleşmeleri eklenir.
     - Her terimde Türkçe + İngilizce karşılık, İngilizce okunuş (tarayıcının kendi sesi) ve üç anlatım:
       Sade · Akademik · Örnekle. Öğrencinin seçtiği düzey hatırlanır (acadex.sozluk.seviye).
     - Özet kartlarındaki ve lab metinlerindeki terimlerin altı noktalı: dokununca küçük kart açılır.
       Sınav salonu açıkken (body.axs-hall-on) ve sınav sorularında işaretleme yapılmaz.
   Veri: supabase/migrations/20261118b_sozluk.sql (sozluk_terim; herkes okur, yalnız yönetici yazar).
   Liste tarayıcıda saklanır (acadex.sozluk.v1); her açılışta yalnız sayı + son güncelleme sorulur.
   Dışarıya istek yok: yalnız Acadex'in kendi Supabase'i. Önek: asz-
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document; if (!D || W.AXSOZ) return;
  /* yayımlanabilir (publishable) anahtar: tarayıcıda zaten açık; lab sayfalarında supabase-config.js yok */
  var URL_ = (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) || 'https://yrcdvcsowblzmkpbmkut.supabase.co';
  var KEY = (typeof SUPABASE_ANON_KEY !== 'undefined' && SUPABASE_ANON_KEY) || 'sb_publishable_W_DZnHPY-I51nioiWOTJmw_FCnyFjxm';
  var CK = 'acadex.sozluk.v1', SK = 'acadex.sozluk.seviye';
  var SEV = [['sade', 'Sade'], ['akademik', 'Akademik'], ['ornek', 'Örnekle']];
  var ALAN = { genel: 'Genel', istatistik: 'İstatistik', finans: 'Finans', isletme: 'İşletme', muhasebe: 'Muhasebe', ekonomi: 'Ekonomi', ticaret: 'Uluslararası ticaret', ybs: 'Yönetim bilişim', saglik: 'Sağlık', anatomi: 'Anatomi', eczacilik: 'Eczacılık', hemsirelik: 'Hemşirelik', diyetetik: 'Beslenme ve diyetetik', fizyoterapi: 'Fizyoterapi', odyoloji: 'Odyoloji', dkt: 'Dil ve konuşma terapisi', ingilizce: 'İngilizce' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var lsAl = function (k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  var lsKoy = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  var kucuk = function (s) { return String(s || '').toLocaleLowerCase('tr'); };
  var sade = function (s) { return kucuk(s).replace(/[()₀₁²]/g, ' ').replace(/\s+/g, ' ').trim(); };

  /* ---------------------------------------------------------------- veri */
  var S = { liste: [], byId: {}, harita: {}, re: null, hazir: false, bekleyen: [] };
  /* bir terimin metinde aranacak yazımları: "nitel / nicel veri" → iki yazım; parantez içi atılır */
  function yazimlar(t) {
    var out = [];
    var ekle = function (s, dil) {
      String(s || '').split(/\s*\/\s*/).forEach(function (p) {
        p = sade(p.replace(/\([^)]*\)/g, ' '));
        if (!p) return;
        /* Türkçe: en az 4 harf; İngilizce: en az 6 harf ya da çok kelimeli (mean, mode gibi fiillerle karışmasın) */
        if (dil === 'tr' ? p.length >= 4 : (p.length >= 6 || p.indexOf(' ') > 0)) out.push({ v: p, dil: dil });
      });
    };
    ekle(t.tr, 'tr'); ekle(t.en, 'en'); (t.es || []).forEach(function (e) { ekle(e, 'tr'); });
    return out;
  }
  function kur(l) {
    S.liste = (l || []).filter(function (t) { return t && t.tr; });
    S.byId = {}; S.harita = {};
    var alt = [];
    S.liste.forEach(function (t) {
      S.byId[t.id] = t;
      if (t.isaretle === false) return;
      yazimlar(t).forEach(function (y) { if (!S.harita[y.v]) { S.harita[y.v] = { id: t.id, dil: y.dil }; alt.push(y.v); } });
    });
    alt.sort(function (a, b) { return b.length - a.length; });
    var kac = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    try { S.re = alt.length ? new RegExp('(?<![\\p{L}\\p{N}])(' + alt.map(kac).join('|') + ')(\\p{L}{0,6})(?![\\p{L}\\p{N}])', 'gu') : null; } catch (e) { S.re = null; }
    S.hazir = true;
    var b = S.bekleyen; S.bekleyen = []; b.forEach(function (f) { try { f(); } catch (e) { } });
    planla();
  }
  /* metindeki terimler: [{i, n, id}] — i başlangıç, n uzunluk (ek hariç). Kurallar:
     Türkçe terim 5+ harfse ek alabilir ("varyansı", "ortalamanın"); daha kısaysa tam kelime.
     İngilizce terim yalnız çoğul eki alabilir (-s, -es). "model" içinde "mod" bulunmaz. */
  function eslesmeler(metin) {
    var out = []; if (!S.re || !metin) return out;
    var k = kucuk(metin); if (k.length !== metin.length) return out;
    S.re.lastIndex = 0; var m;
    while ((m = S.re.exec(k))) {
      var v = m[1], ek = m[2] || '', h = S.harita[v]; if (!h) continue;
      if (ek && (h.dil === 'en' ? !/^(s|es)$/.test(ek) : v.length < 5)) continue;
      out.push({ i: m.index, n: v.length, id: h.id });
    }
    return out;
  }
  function ara(q, alan) {
    q = sade(q); var l = S.liste;
    if (alan) l = l.filter(function (t) { return (t.alan || []).indexOf(alan) > -1; });
    if (!q) return l.slice(0, 60);
    var puan = function (t) {
      var tr = sade(t.tr), en = sade(t.en), es = (t.es || []).map(sade);
      if (tr === q || en === q || es.indexOf(q) > -1) return 0;
      if (tr.indexOf(q) === 0 || en.indexOf(q) === 0) return 1;
      if (tr.indexOf(q) > -1 || en.indexOf(q) > -1 || es.some(function (e) { return e.indexOf(q) > -1; })) return 2;
      if (q.length >= 3 && kucuk([t.sade, t.akademik, t.ornek].join(' ')).indexOf(q) > -1) return 3;
      return 9;
    };
    return l.map(function (t) { return { t: t, p: puan(t) }; }).filter(function (x) { return x.p < 9; })
      .sort(function (a, b) { return (a.p - b.p) || a.t.tr.localeCompare(b.t.tr, 'tr'); }).slice(0, 40).map(function (x) { return x.t; });
  }
  var REST = function (yol, ust) { return fetch(URL_ + '/rest/v1/' + yol, { headers: Object.assign({ apikey: KEY }, ust || {}) }); };
  var ALANLAR = 'id,tr,en,es,alan,sade,akademik,ornek,kaynak,wikidata,durum,isaretle';
  async function yukle() {
    var c = lsAl(CK);
    if (c && Array.isArray(c.l)) kur(c.l);
    try {
      var r = await REST('sozluk_terim?select=updated_at&order=updated_at.desc&limit=1', { Prefer: 'count=exact' });
      if (!r.ok) return;
      var j = await r.json(), n = +String(r.headers.get('content-range') || '').split('/')[1] || 0;
      var imza = n + '|' + ((j[0] && j[0].updated_at) || '');
      if (c && c.imza === imza && Array.isArray(c.l)) return;
      var l = [];
      for (var off = 0; off < 20000; off += 1000) {
        var rr = await REST('sozluk_terim?select=' + ALANLAR + '&order=tr&limit=1000&offset=' + off);
        if (!rr.ok) return;
        var p = await rr.json(); l = l.concat(p); if (p.length < 1000) break;
      }
      lsKoy(CK, { imza: imza, l: l }); kur(l);
    } catch (e) { if (!S.hazir) kur([]); }
  }

  /* ---------------------------------------------------------------- görünüm */
  var CSS = [
    '.asz-fab{position:fixed;left:16px;bottom:16px;z-index:9990;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px 0 12px;border:1.6px solid #0D1838;border-radius:999px;background:#FFFEFB;color:#0D1838;font:700 14px/1 "Instrument Sans",system-ui,sans-serif;box-shadow:0 10px 24px -14px rgba(13,24,56,.6);cursor:pointer}',
    '.asz-fab svg{width:20px;height:20px}.asz-fab kbd{font:600 11px/1 ui-monospace,monospace;padding:3px 5px;border:1px solid #C9D1E1;border-radius:4px;color:#4B5675}',
    '.asz-fab:focus-visible,.asz-p button:focus-visible,.asz-p input:focus-visible,.asz-p select:focus-visible,.asz-t:focus-visible,.asz-pop button:focus-visible{outline:2px solid #2F6BFF;outline-offset:2px}',
    'body.axs-hall-on .asz-fab,body.axs-hall-on .asz-pop,html.axf-embed .asz-fab{display:none!important}',
    '.asz-t{display:inline;margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;line-height:inherit;letter-spacing:inherit;text-align:inherit;text-decoration:underline dotted 1.5px;text-decoration-color:#2F6BFF;text-underline-offset:3px;cursor:help;border-radius:2px}',
    '.asz-t:hover{background:rgba(47,107,255,.10)}',
    '.asz-ort[hidden],.asz-p[hidden],.asz-p [hidden],.asz-pop[hidden]{display:none!important}',
    '.asz-ort{position:fixed;inset:0;z-index:9995;background:rgba(13,24,56,.45)}',
    '.asz-p{position:fixed;top:0;right:0;bottom:0;z-index:9996;display:flex;flex-direction:column;width:min(440px,100%);background:#FFFEFB;color:#0D1838;box-shadow:-24px 0 60px -30px rgba(13,24,56,.7);font:15px/1.5 "Instrument Sans",system-ui,sans-serif}',
    '.asz-ph{display:flex;align-items:center;gap:10px;padding:16px 16px 10px}',
    '.asz-ph h2{flex:1;margin:0;font:800 22px/1.1 "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.01em}',
    '.asz-x{display:grid;place-items:center;width:44px;height:44px;border:1.4px solid #C9D1E1;border-radius:10px;background:#fff;color:#0D1838;font-size:22px;cursor:pointer}',
    '.asz-ara{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:0 16px 10px}',
    '.asz-ara label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
    '.asz-ara input,.asz-ara select{min-height:44px;padding:8px 12px;border:1.6px solid #C9D1E1;border-radius:10px;background:#fff;color:#0D1838;font:inherit}',
    '.asz-ara select{max-width:150px}',
    '.asz-not{margin:0 16px 8px;font-size:13px;color:#4B5675}',
    '.asz-l{flex:1;overflow:auto;margin:0;padding:0 16px 16px;list-style:none}',
    '.asz-l li+li{margin-top:6px}',
    '.asz-l button{display:grid;width:100%;gap:2px;min-height:48px;padding:10px 12px;border:1.4px solid #E3E8F1;border-radius:10px;background:#fff;color:#0D1838;text-align:left;font:inherit;cursor:pointer}',
    '.asz-l button:hover{border-color:#2F6BFF}',
    '.asz-l b{font-weight:700}.asz-l small{color:#4B5675;font-size:13px}',
    '.asz-d{flex:1;overflow:auto;padding:0 16px 20px}',
    '.asz-geri{min-height:44px;margin:0 0 8px;padding:0 12px;border:0;background:none;color:#1F5FD6;font:inherit;font-weight:700;cursor:pointer}',
    '.asz-k{display:grid;gap:10px}',
    '.asz-kb{display:flex;align-items:flex-start;gap:10px}',
    '.asz-kb h3{flex:1;margin:0;font:800 24px/1.15 "Bricolage Grotesque",system-ui,sans-serif}',
    '.asz-kb h3 span{display:block;margin-top:4px;font:600 16px/1.3 "Instrument Sans",system-ui,sans-serif;color:#33405F}',
    '.asz-ses{display:grid;place-items:center;flex:none;width:44px;height:44px;border:1.4px solid #C9D1E1;border-radius:50%;background:#fff;color:#0D1838;cursor:pointer}',
    '.asz-ses svg{width:20px;height:20px}',
    '.asz-ek{display:flex;flex-wrap:wrap;gap:6px}',
    '.asz-ek span{padding:3px 9px;border-radius:999px;background:#EEF2FA;color:#33405F;font-size:12.5px;font-weight:600}',
    '.asz-ek .asz-taslak{background:#FFF4D6;color:#7A5200}',
    '.asz-sv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px;border-radius:12px;background:#EEF2FA}',
    '.asz-sv button{min-height:40px;border:0;border-radius:9px;background:transparent;color:#33405F;font:inherit;font-weight:700;font-size:14px;cursor:pointer}',
    '.asz-sv button[aria-selected="true"]{background:#fff;color:#0D1838;box-shadow:0 2px 6px -3px rgba(13,24,56,.5)}',
    '.asz-m{margin:0;white-space:pre-line}',
    '.asz-bos{margin:0;color:#4B5675;font-size:14px}',
    '.asz-kay{color:#4B5675;font-size:12.5px}',
    '.asz-pop{position:absolute;z-index:9994;width:min(340px,calc(100vw - 24px));padding:14px;border:1.4px solid #C9D1E1;border-radius:14px;background:#FFFEFB;color:#0D1838;box-shadow:0 24px 50px -24px rgba(13,24,56,.7);font:15px/1.5 "Instrument Sans",system-ui,sans-serif}',
    '.asz-pop .asz-kb h3{font-size:19px}',
    '.asz-pop .asz-ac{min-height:40px;padding:0;border:0;background:none;color:#1F5FD6;font:inherit;font-weight:700;cursor:pointer;justify-self:start}',
    '.asz-gs{margin:0 0 12px;padding:10px;border:1.4px solid #E3E8F1;border-radius:12px;background:#FFFEFB}',
    '.asz-gs h4{margin:0 0 6px;font:700 12px/1 ui-monospace,monospace;letter-spacing:.06em;color:#4B5675}',
    '.asz-gs button{display:block;width:100%;min-height:40px;padding:6px 8px;border:0;border-radius:8px;background:none;color:#0D1838;text-align:left;font:inherit;cursor:pointer}',
    '.asz-gs button:hover{background:#EEF2FA}',
    'html.ax-dark .asz-fab,html.ax-dark .asz-p,html.ax-dark .asz-pop,html.ax-dark .asz-gs{background:#141B33;color:#EEF2FA;border-color:#3A4566}',
    'html.ax-dark .asz-l button,html.ax-dark .asz-x,html.ax-dark .asz-ses,html.ax-dark .asz-ara input,html.ax-dark .asz-ara select{background:#1B2442;color:#EEF2FA;border-color:#3A4566}',
    'html.ax-dark .asz-sv{background:#1B2442}html.ax-dark .asz-sv button{color:#C9D1E1}html.ax-dark .asz-sv button[aria-selected="true"]{background:#2A3557;color:#fff}',
    'html.ax-dark .asz-kb h3 span,html.ax-dark .asz-l small,html.ax-dark .asz-not,html.ax-dark .asz-bos,html.ax-dark .asz-kay{color:#B8C2D9}',
    'html.ax-dark .asz-ek span{background:#2A3557;color:#DDE3F0}html.ax-dark .asz-gs button{color:#EEF2FA}html.ax-dark .asz-gs button:hover{background:#2A3557}',
    '@media (max-width:640px){.asz-fab{left:12px;bottom:12px;padding:0 14px 0 10px}.asz-fab kbd{display:none}}',
    '@media print{.asz-fab,.asz-p,.asz-ort,.asz-pop{display:none!important}.asz-t{text-decoration:none}}'
  ].join('\n');
  var IC = {
    kitap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/></svg>',
    ses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>'
  };
  var seviye = function () { var s = lsAl(SK); return s === 'akademik' || s === 'ornek' ? s : 'sade'; };
  function kartHtml(t, kisa) {
    var sv = seviye(), dolu = SEV.filter(function (x) { return (t[x[0]] || '').trim(); }), goster = (t[sv] || '').trim() ? sv : (dolu[0] ? dolu[0][0] : sv);
    var ad = function (k) { return SEV.filter(function (x) { return x[0] === k; })[0][1]; };
    var kay = [t.kaynak === 'lab' ? 'Acadex lab terimi' : 'Acadex', t.wikidata ? 'Wikidata ' + t.wikidata + ' (CC0)' : ''].filter(Boolean).join(' · ');
    return '<div class="asz-k" data-asz-id="' + esc(t.id) + '"><div class="asz-kb"><h3>' + esc(t.tr) + (t.en ? '<span lang="en">' + esc(t.en) + '</span>' : '') + '</h3>' +
      (t.en && W.speechSynthesis ? '<button type="button" class="asz-ses" data-asz-ses aria-label="İngilizce okunuşunu dinle: ' + esc(t.en) + '">' + IC.ses + '</button>' : '') + '</div>' +
      '<div class="asz-ek">' + (t.alan || []).map(function (a) { return '<span>' + esc(ALAN[a] || a) + '</span>'; }).join('') + (t.durum !== 'onayli' ? '<span class="asz-taslak">taslak · kurul onayı bekliyor</span>' : '') + '</div>' +
      '<div class="asz-sv" role="tablist" aria-label="Anlatım düzeyi">' + SEV.map(function (x) { return '<button type="button" role="tab" data-asz-sv="' + x[0] + '" aria-selected="' + (x[0] === goster) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div role="tabpanel" data-asz-metin>' + metinHtml(t, goster, goster !== sv ? ad(sv) : '') + '</div>' +
      (kisa ? '<button type="button" class="asz-ac" data-asz-ac>Sözlükte aç →</button>' : '<small class="asz-kay">Kaynak: ' + esc(kay) + '</small>') + '</div>';
  }
  function metinHtml(t, sv, yerine) {
    var m = (t[sv] || '').trim();
    if (!m) return '<p class="asz-bos">' + (sv === 'sade' ? 'Sade' : sv === 'ornek' ? 'Örnekli' : 'Akademik') + ' anlatım henüz yazılmadı. Akademik İçerik Kurulu ekliyor.</p>';
    return (yerine ? '<p class="asz-bos">' + esc(yerine) + ' anlatım henüz yok; bunu gösteriyorum.</p>' : '') + '<p class="asz-m">' + esc(m) + '</p>';
  }
  /* bir kart kutusundaki düğmeler (seviye sekmeleri, ses) */
  function kartBagla(kok, t) {
    kok.addEventListener('click', function (e) {
      var b = e.target.closest('[data-asz-sv]');
      if (b) {
        var sv = b.getAttribute('data-asz-sv'); lsKoy(SK, sv);
        kok.querySelectorAll('[data-asz-sv]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        kok.querySelector('[data-asz-metin]').innerHTML = metinHtml(t, sv, '');
        return;
      }
      if (e.target.closest('[data-asz-ses]') && W.speechSynthesis && W.SpeechSynthesisUtterance) {
        try { W.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(String(t.en).replace(/\([^)]*\)/g, '')); u.lang = 'en-US'; u.rate = 0.9; W.speechSynthesis.speak(u); } catch (er) { }
      }
    });
  }

  /* --- panel --- */
  var P = null, oncekiOdak = null;
  function panelAc(q, id) {
    if (D.body.classList.contains('axs-hall-on')) return;
    popKapat();
    if (!P) {
      var ort = D.createElement('div'); ort.className = 'asz-ort'; ort.hidden = true;
      var p = D.createElement('div'); p.className = 'asz-p'; p.hidden = true;
      p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-labelledby', 'asz-bas');
      p.innerHTML = '<div class="asz-ph"><h2 id="asz-bas">Acadex Sözlük</h2><button type="button" class="asz-x" data-asz-kapat aria-label="Sözlüğü kapat">×</button></div>' +
        '<div class="asz-ara"><label for="asz-q">Terim ara</label><input id="asz-q" type="search" autocomplete="off" placeholder="Türkçe ya da İngilizce terim…"><label for="asz-alan">Alan</label><select id="asz-alan"><option value="">Bütün alanlar</option>' +
        Object.keys(ALAN).map(function (k) { return '<option value="' + k + '">' + esc(ALAN[k]) + '</option>'; }).join('') + '</select></div>' +
        '<p class="asz-not" data-asz-not aria-live="polite"></p><ul class="asz-l" data-asz-l></ul><div class="asz-d" data-asz-d hidden></div>';
      D.body.appendChild(ort); D.body.appendChild(p);
      P = { ort: ort, p: p, q: p.querySelector('#asz-q'), alan: p.querySelector('#asz-alan'), l: p.querySelector('[data-asz-l]'), d: p.querySelector('[data-asz-d]'), not: p.querySelector('[data-asz-not]') };
      var t0 = 0;
      P.q.addEventListener('input', function () { clearTimeout(t0); t0 = setTimeout(listeCiz, 120); });
      P.alan.addEventListener('change', listeCiz);
      ort.addEventListener('click', panelKapat);
      p.addEventListener('click', function (e) {
        if (e.target.closest('[data-asz-kapat]')) return panelKapat();
        if (e.target.closest('[data-asz-geri]')) { P.d.hidden = true; P.l.hidden = false; P.q.focus(); return; }
        var b = e.target.closest('[data-asz-git]'); if (b) detay(b.getAttribute('data-asz-git'));
      });
      p.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); panelKapat(); return; }
        if (e.key !== 'Tab') return;
        var f = [].slice.call(p.querySelectorAll('button,input,select')).filter(function (x) { return !x.closest('[hidden]') && !x.disabled; });
        if (!f.length) return;
        if (e.shiftKey && D.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && D.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      });
    }
    oncekiOdak = D.activeElement;
    P.ort.hidden = false; P.p.hidden = false;
    P.q.value = q || ''; P.d.hidden = true; P.l.hidden = false;
    if (!S.hazir) { P.not.textContent = 'Sözlük yükleniyor…'; S.bekleyen.push(function () { if (P && !P.p.hidden) { if (id) detay(id); else listeCiz(); } }); }
    else if (id) detay(id); else listeCiz();
    setTimeout(function () { (id ? P.d.querySelector('button') : P.q) && (id ? P.d.querySelector('button') : P.q).focus(); }, 30);
  }
  function panelKapat() {
    if (!P || P.p.hidden) return;
    P.ort.hidden = true; P.p.hidden = true;
    if (oncekiOdak && oncekiOdak.focus) try { oncekiOdak.focus(); } catch (e) { }
  }
  function listeCiz() {
    if (!P) return;
    var l = ara(P.q.value, P.alan.value);
    P.not.textContent = S.liste.length ? (P.q.value.trim() ? l.length + ' sonuç' : S.liste.length + ' terim · aramak için yazın') : 'Sözlükte henüz terim yok.';
    P.l.innerHTML = l.map(function (t) { return '<li><button type="button" data-asz-git="' + esc(t.id) + '"><b>' + esc(t.tr) + '</b>' + (t.en ? '<small lang="en">' + esc(t.en) + '</small>' : '') + '</button></li>'; }).join('') ||
      (P.q.value.trim() ? '<li class="asz-bos">Bu terim sözlükte yok. Akademik İçerik Kurulu yeni terimleri ekliyor.</li>' : '');
  }
  function detay(id) {
    var t = S.byId[id]; if (!t || !P) return;
    P.l.hidden = true; P.d.hidden = false;
    P.d.innerHTML = '<button type="button" class="asz-geri" data-asz-geri>← Listeye dön</button>' + kartHtml(t, false);
    kartBagla(P.d.querySelector('.asz-k'), t);
    P.not.textContent = '';
  }

  /* --- metindeki terime dokununca küçük kart --- */
  var POP = null;
  function popAc(btn) {
    var t = S.byId[btn.getAttribute('data-asz-t')]; if (!t) return;
    popKapat();
    var p = D.createElement('div'); p.className = 'asz-pop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', t.tr + ' · sözlük');
    p.innerHTML = kartHtml(t, true);
    D.body.appendChild(p);
    var r = btn.getBoundingClientRect(), w = p.offsetWidth, x = Math.max(12, Math.min(r.left + W.scrollX, W.scrollX + D.documentElement.clientWidth - w - 12));
    var y = r.bottom + W.scrollY + 8; if (r.bottom + p.offsetHeight + 16 > W.innerHeight && r.top > p.offsetHeight + 16) y = r.top + W.scrollY - p.offsetHeight - 8;
    p.style.left = x + 'px'; p.style.top = y + 'px';
    kartBagla(p.querySelector('.asz-k'), t);
    p.addEventListener('click', function (e) { if (e.target.closest('[data-asz-ac]')) { popKapat(); panelAc('', t.id); } });
    POP = { el: p, btn: btn }; btn.setAttribute('aria-expanded', 'true');
    var ilk = p.querySelector('[data-asz-sv][aria-selected="true"]'); if (ilk) ilk.focus();
  }
  function popKapat(odak) {
    if (!POP) return; var b = POP.btn; POP.el.remove(); POP = null; b.setAttribute('aria-expanded', 'false');
    if (odak && b.isConnected) b.focus();
  }

  /* --- metinlerde terimleri işaretle --- */
  var HEDEF = '#study-card-modal .axr-prose, #study-card-modal .axr-pull blockquote, #study-card-modal .axr-kps, main p, main li, main dd, main dt, main td, main figcaption, main blockquote';
  var ATLA = 'button, a, input, textarea, select, label, code, pre, kbd, svg, canvas, script, style, nav, header, footer, [contenteditable=""], [contenteditable="true"], .katex, .asz-t, .asz-p, .asz-pop, .asz-gs, #exam-active-screen, #exam-questions-container, .sn-room, [data-sozluk="kapali"], [aria-hidden="true"]';
  var gorulen = new WeakMap();
  function kapali() { return D.body.classList.contains('axs-hall-on') || D.documentElement.getAttribute('data-sozluk') === 'kapali'; }
  function isaretle(kok) {
    if (!S.re || kapali()) return 0;
    var n = 0;
    (kok || D).querySelectorAll(HEDEF).forEach(function (el) {
      if (el.closest(ATLA)) return;
      var kutu = el.closest('section, article, .axr-sheet, [class*="card"], [class*="kart"]') || el;
      var set = gorulen.get(kutu); if (!set) { set = {}; gorulen.set(kutu, set); }
      var tw = D.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: function (x) { return x.nodeValue.length > 3 && !(x.parentElement && x.parentElement.closest(ATLA)) ? 1 : 2; } });
      var dugum = [], x; while ((x = tw.nextNode())) dugum.push(x);
      dugum.forEach(function (tn) {
        var e = eslesmeler(tn.nodeValue).filter(function (m) { if (set[m.id]) return false; set[m.id] = 1; return true; });
        if (!e.length) return;
        var f = D.createDocumentFragment(), s = tn.nodeValue, i0 = 0;
        e.forEach(function (m) {
          if (m.i > i0) f.appendChild(D.createTextNode(s.slice(i0, m.i)));
          var b = D.createElement('button'); b.type = 'button'; b.className = 'asz-t'; b.setAttribute('data-asz-t', m.id); b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
          b.textContent = s.substr(m.i, m.n); b.title = 'Sözlük: ' + S.byId[m.id].tr; f.appendChild(b); i0 = m.i + m.n; n++;
        });
        if (i0 < s.length) f.appendChild(D.createTextNode(s.slice(i0)));
        tn.parentNode.replaceChild(f, tn);
      });
    });
    return n;
  }
  var zaman = 0;
  function planla() { clearTimeout(zaman); zaman = setTimeout(function () { try { isaretle(); } catch (e) { } }, 450); }

  /* --- dashboard genel araması (Ctrl+K): sonuçların başına sözlük eşleşmeleri --- */
  function genelAramaKur() {
    var giris = D.getElementById('global-search-input'), kutu = D.getElementById('global-search-results');
    if (!giris || !kutu) return false;
    var ekle = function () {
      var q = giris.value.trim(); var eski = kutu.querySelector('.asz-gs');
      var l = q.length >= 2 ? ara(q).slice(0, 4) : [];
      if (!l.length) { if (eski) eski.remove(); return; }
      var h = '<h4>SÖZLÜK</h4>' + l.map(function (t) { return '<button type="button" data-asz-git="' + esc(t.id) + '"><b>' + esc(t.tr) + '</b>' + (t.en ? ' · <span lang="en">' + esc(t.en) + '</span>' : '') + '</button>'; }).join('');
      if (eski && eski.getAttribute('data-q') === q) return;
      var d = eski || D.createElement('div'); d.className = 'asz-gs'; d.setAttribute('data-q', q); d.innerHTML = h;
      if (!eski) kutu.insertBefore(d, kutu.firstChild);
    };
    new MutationObserver(function () { if (!kutu.querySelector('.asz-gs')) ekle(); }).observe(kutu, { childList: true });
    giris.addEventListener('input', function () { setTimeout(ekle, 0); });
    kutu.addEventListener('click', function (e) {
      var b = e.target.closest('.asz-gs [data-asz-git]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      var ov = D.getElementById('global-search-overlay'); if (ov) ov.classList.remove('active');
      panelAc('', b.getAttribute('data-asz-git'));
    }, true);
    return true;
  }

  function basla() {
    if (!D.getElementById('asz-stil')) { var st = D.createElement('style'); st.id = 'asz-stil'; st.textContent = CSS; D.head.appendChild(st); }
    var fab = D.createElement('button'); fab.type = 'button'; fab.className = 'asz-fab'; fab.setAttribute('aria-label', 'Acadex Sözlük');
    var genel = genelAramaKur();
    fab.innerHTML = IC.kitap + '<span>Sözlük</span>' + (genel ? '' : '<kbd>Ctrl K</kbd>');
    fab.addEventListener('click', function () { panelAc(''); });
    D.body.appendChild(fab);
    /* lab sayfalarında Ctrl+K sözlüğü açar; dashboard'da Ctrl+K genel arama (sözlük orada da çıkar) */
    D.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && POP) { popKapat(true); return; }
      if (!genel && (e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === 'k') { e.preventDefault(); if (P && !P.p.hidden) panelKapat(); else panelAc(''); }
    });
    D.addEventListener('click', function (e) {
      var b = e.target.closest('.asz-t');
      if (b) { e.preventDefault(); e.stopPropagation(); if (POP && POP.btn === b) popKapat(); else popAc(b); return; }
      if (POP && !e.target.closest('.asz-pop')) popKapat();
    }, true);
    W.addEventListener('resize', function () { popKapat(); });
    new MutationObserver(function (ml) {
      for (var i = 0; i < ml.length; i++) {
        var t = ml[i].target; if (t.nodeType === 1 && t.closest && t.closest('.asz-p, .asz-pop, .asz-gs')) continue;
        planla(); return;
      }
    }).observe(D.body, { childList: true, subtree: true });
    yukle();
  }

  W.AXSOZ = { ac: panelAc, kapat: panelKapat, isaretle: isaretle, _test: { kur: kur, eslesmeler: eslesmeler, ara: ara, yazimlar: yazimlar, kartHtml: kartHtml, S: S } };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', basla); else basla();
})(window);
