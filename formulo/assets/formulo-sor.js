/* ==========================================================================
   FORMULO · "Acadia'ya sor" (formulo/assets/formulo-sor.js), 08.11.2026
   Kesin işler yerelde: "v0=20 th=45 için menzil" hesabı, örnek soru, ipucu modunda
   sonucu kontrol (anahtar sözcük puanı + niyet: nedir / hesapla / örnek).
   Serbest sorular (kavram, neden, nasıl) 08.11.2026'dan beri Acadex yapay zekâsına
   gider: supabase/functions/formulo-hoca, bağlam = ders + en yakın formüller + son
   formül ve değerler + ipucu modu + son 6 mesaj. 9 sn'de cevap yoksa ya da fonksiyon
   yoksa yerel cevaba düşer. Önek fa-.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, FO = W.FORMULO;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function A() { return W.FORMULO_APP; }
  function dil() { return (A() && A().dil()) || 'tr'; }
  function sayi(n) { return A() ? A().sayi(n) : String(+(+n).toPrecision(4)); }
  function ad(o) { return dil() === 'en' ? (o.en || o.tr) : o.tr; }
  function sembol(f, key) { var t = D.createElement('div'); t.innerHTML = f.h || ''; var e = t.querySelector('[data-v="' + key + '"]'); return e ? e.innerHTML : esc(key); }
  function sembolMetin(f, key) { var t = D.createElement('div'); t.innerHTML = f.h || ''; var e = t.querySelector('[data-v="' + key + '"]'); return e ? e.textContent : key; }
  var Y = {
    tr: { bant: 'Profesör Acadia bu dersin formül defterini biliyor. Hesapları Formulo kesin yapar; yapay zekâ yanıtları yanlış olabilir, kartla karşılaştır.', ai: 'yapay zekâ', yedek: 'Bağlantı yavaş; formül defterinden cevaplıyorum.', yer: 'Acadia’ya sor: “menzil nedir?”, “v0=20 th=45 için menzil”…', gonder: 'Gönder', ipucuMod: 'İpucu modu', ipucuAcik: 'Sonucu söylemem, yol gösteririm.',
      selam: 'Merhaba! Bu dersin formüllerini biliyorum. Bir formülü sor, değer ver hesaplayayım ya da örnek soru iste.', bulamadim: 'Bunu formül defterinde bulamadım. Şunlardan birini dene:',
      nedir: 'Bu formül şunu verir:', degiskenler: 'Değişkenler', hesap: 'Verdiğin değerlerle:', eksik: 'Şu değerler eksikti, kartın varsayılanlarını kullandım:', ipYol: 'Önce değerleri yerine koy. İlk satır şöyle olur:', ipSon: 'Sonucu bulunca bana yaz, kontrol edeyim.', kontrolOk: 'Doğru! Sonuç gerçekten', kontrolNo: 'Tam olmadı. İpucu: birimleri ve işlem sırasını kontrol et. Beklenen büyüklük',
      ornek: 'Sana bir soru:', cevapGor: 'Cevabı göster', anlat: 'Acadia anlatsın', karta: 'Karta git', baska: 'Benzer formüller:',
      oneri: function (f1, f2) { return [f1 ? ad(f1) + ' nedir?' : null, f2 ? ad(f2) + ' nasıl hesaplanır?' : null, 'Bana örnek bir soru ver', f2 ? ornekDeger(f2) : null].filter(Boolean); } },
    en: { bant: 'Professor Acadia knows this course’s formula notes. Formulo does the exact math; AI answers can be wrong, so check against the card.', ai: 'AI', yedek: 'Slow connection; answering from the formula notes.', yer: 'Ask Acadia: “what is range?”, “range for v0=20 th=45”…', gonder: 'Send', ipucuMod: 'Hint mode', ipucuAcik: 'I won’t give the answer, I’ll guide you.',
      selam: 'Hi! I know this course’s formulas. Ask about one, give values to compute, or ask for a practice question.', bulamadim: 'I couldn’t find that in the formula notes. Try one of these:',
      nedir: 'This formula gives:', degiskenler: 'Variables', hesap: 'With your values:', eksik: 'These were missing, so I used the card defaults:', ipYol: 'First substitute the values. The first line looks like:', ipSon: 'Tell me your result and I’ll check it.', kontrolOk: 'Correct! The result is indeed', kontrolNo: 'Not quite. Hint: check units and order of operations. Expected size',
      ornek: 'Here’s one for you:', cevapGor: 'Show answer', anlat: 'Let Acadia explain', karta: 'Go to card', baska: 'Related formulas:',
      oneri: function (f1, f2) { return [f1 ? 'What is ' + ad(f1) + '?' : null, f2 ? 'How do I compute ' + ad(f2) + '?' : null, 'Give me a practice question', f2 ? ornekDeger(f2) : null].filter(Boolean); } }
  };
  function T(k) { return Y[dil()][k]; }
  function ornekDeger(f) { var ks = Object.keys(f.v).slice(0, 2); return ks.map(function (k) { return k + '=' + f.v[k].val; }).join(' ') + (dil() === 'en' ? ' for ' : ' için ') + ad(f).toLocaleLowerCase(dil() === 'en' ? 'en' : 'tr'); }

  /* ---------- metin eşleme ---------- */
  function sade(s) { return String(s).toLocaleLowerCase('tr').replace(/[çğıöşüâî]/g, function (c) { return { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i' }[c]; }).replace(/[^a-z0-9θωλμσρ ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  var DUR = ' nedir ne demek nasil hesaplanir hesapla bul formul formulu formulunu icin ile bir bu su ve veya mi mu midir kac kactir olan the what is how do i compute find for of a an to give me formula with ';
  function kelimeler(s) { return sade(s).split(' ').filter(function (w) { return w.length > 1 && DUR.indexOf(' ' + w + ' ') < 0; }); }
  var dizin = null;
  function dizinKur() {
    dizin = FO.formuller.map(function (f) {
      var d = FO.dersler.filter(function (x) { return x.id === f.d; })[0], k = d.konular.filter(function (x) { return x.id === f.k; })[0];
      var ad1 = sade(f.tr + ' ' + f.en), yan = sade((f.v ? Object.keys(f.v).map(function (key) { return f.v[key].tr + ' ' + f.v[key].en; }).join(' ') : '') + ' ' + (f.o ? f.o.tr + ' ' + f.o.en : '') + ' ' + (k ? k.tr + ' ' + (k.en || '') : '') + ' ' + f.id.replace(/-/g, ' '));
      return { f: f, ad: ad1, yan: yan };
    });
  }
  function ara(soru, ders) {
    if (!dizin) dizinKur();
    soru = soru.replace(/[A-Za-zθωλμσρ₀-₉′]+[0-9]?\s*[=:]\s*-?[0-9.,e]+/g, ' ');
    var ws = kelimeler(soru); if (!ws.length) return [];
    return dizin.map(function (x) {
      var p = 0; ws.forEach(function (w) { var kok = w.length > 5 ? w.slice(0, w.length - 2) : w; if (x.ad.indexOf(kok) > -1) p += 3; else if (x.yan.indexOf(kok) > -1) p += 1; });
      if (sade(x.ad).indexOf(sade(soru)) > -1) p += 4; if (x.f.d === ders) p *= 1.5; return { f: x.f, p: p };
    }).filter(function (x) { return x.p >= 2; }).sort(function (a, b) { return b.p - a.p; }).slice(0, 4);
  }
  function niyet(s) {
    var t = sade(s);
    if (/\b(ornek|soru ver|soru sor|practice|question|quiz)\b/.test(t)) return 'ornek';
    if (/[=]/.test(s) || /\b(hesapla|hesaplanir|kac|compute|calculate)\b/.test(t)) return 'hesap';
    return 'nedir';
  }
  function degerOku(s, f) {
    var v = {}, keys = f.v ? Object.keys(f.v) : [];
    var re = /([A-Za-zθωλμσρα-ω₀-₉′]+[0-9]?)\s*[=:]\s*(-?[0-9]+(?:[.,][0-9]+)?(?:e-?[0-9]+)?)/g, m;
    while ((m = re.exec(s))) {
      var ad1 = m[1], deger = parseFloat(m[2].replace(',', '.'));
      var key = keys.filter(function (k) { return k.toLowerCase() === ad1.toLowerCase() || sembolMetin(f, k).replace(/\s/g, '').toLowerCase() === ad1.toLowerCase() || (ad1 === 'θ' && k === 'th') || (ad1 === 'μ' && k === 'mk'); })[0];
      if (key) v[key] = deger;
    }
    return v;
  }

  /* ---------- yanıtlar ---------- */
  function formulKutusu(f) { return '<div class="fo-f fa-f">' + (f.h || '') + '</div>'; }
  function eylemler(f) { return '<div class="fa-eylem"><button type="button" class="fo-btn fo-btn-ince" data-fa-anlat="' + f.id + '">' + esc(T('anlat')) + '</button><a class="fo-btn fo-btn-ince" href="?f=' + f.id + '#/' + f.d + '" data-fa-karta="' + f.id + '">' + esc(T('karta')) + '</a></div>'; }
  function nedirYanit(f, yanlar) {
    var h = '<p><b>' + esc(ad(f)) + '</b></p>' + formulKutusu(f);
    if (f.o) h += '<p>' + esc(T('nedir')) + ' <b>' + esc(ad(f.o)) + '</b>' + (f.o.u ? ' [' + esc(f.o.u) + ']' : '') + '.</p>';
    if (f.v) h += '<p class="fa-k">' + esc(T('degiskenler')) + '</p><ul class="fa-v">' + Object.keys(f.v).map(function (k) { return '<li><i>' + sembol(f, k) + '</i> ' + esc(ad(f.v[k])) + (f.v[k].u ? ' <small>[' + esc(f.v[k].u) + ']</small>' : '') + '</li>'; }).join('') + '</ul>';
    (f.anl || []).forEach(function (x) { h += '<p>' + esc(ad(x)) + '</p>'; });
    if (f.not) h += '<p class="fa-not">' + esc(ad(f.not)) + '</p>';
    if (f.tablo) h += '<div class="fa-tablo">' + f.tablo.map(function (r) { return '<div><span class="fo-f fo-f-s fa-f">' + r[0] + '</span><span>' + esc(dil() === 'en' ? r[2] : r[1]) + '</span></div>'; }).join('') + '</div>';
    if (yanlar && yanlar.length) h += '<p class="fa-k">' + esc(T('baska')) + '</p><div class="fa-oneri">' + yanlar.map(function (y) { return '<button type="button" data-fa-oneri="' + esc(ad(y.f)) + '">' + esc(ad(y.f)) + '</button>'; }).join('') + '</div>';
    return h + eylemler(f);
  }
  function yerine(f, v) { return FO.yerine(f, v, sayi, 'fa-d'); }
  function hesapYanit(f, verilen, ipucu, durum) {
    if (!f.o) return nedirYanit(f);
    var v = {}, eksik = []; Object.keys(f.v).forEach(function (k) { if (verilen[k] != null) v[k] = verilen[k]; else { v[k] = f.v[k].val; eksik.push(k); } });
    var r = f.o.f(v), h = '<p><b>' + esc(ad(f)) + '</b></p>' + formulKutusu(f);
    if (eksik.length && Object.keys(verilen).length) h += '<p class="fa-not">' + esc(T('eksik')) + ' ' + eksik.map(function (k) { return '<i>' + sembol(f, k) + '</i> = ' + esc(sayi(v[k]) + ' ' + f.v[k].u); }).join(', ') + '</p>';
    if (ipucu) { h += '<p>' + esc(T('ipYol')) + '</p><div class="fo-f fa-f">' + yerine(f, v) + '</div><p>' + esc(T('ipSon')) + '</p>'; durum.bekleyen = { f: f, r: r }; }
    else h += '<p>' + esc(T('hesap')) + '</p><div class="fo-f fa-f">' + yerine(f, v) + '</div><p class="fa-son">' + FO.os(f.o.s) + ' = <b>' + esc(sayi(r)) + '</b> ' + esc(f.o.u) + '</p>';
    durum.son = { f: f, v: v };
    return h + eylemler(f);
  }
  function ornekYanit(ders, konuF) {
    var S = W.FORMULO_SORU; if (!S) return '';
    var q = konuF && konuF.o ? (function () { for (var i = 0; i < 20; i++) { var x = S.uret(konuF.d, konuF.k, 'kolay'); if (x.f && x.f.id === konuF.id) return x; } return S.uret(konuF.d, konuF.k, 'kolay'); })() : S.uret(ders, '', Math.random() < .5 ? 'kolay' : 'orta');
    if (!q || q.yok) return '<p>' + esc(T('bulamadim')) + '</p>';
    return '<p>' + esc(T('ornek')) + '</p><p class="fa-soru">' + S.soruMetni(q) + '</p><details class="fa-cevap"><summary>' + esc(T('cevapGor')) + '</summary>' + S.cozum(q) + '</details>' + eylemler(q.f);
  }
  function yanitla(soru, ders, ipucu, durum) {
    var s = soru.trim(); if (!s) return null;
    /* ipucu modunda bekleyen sonucu kontrol et */
    var sayiYalniz = /^-?[0-9]+(?:[.,][0-9]+)?\s*\S*$/.test(s);
    if (durum.bekleyen && sayiYalniz) { var x = parseFloat(s.replace(',', '.')), b = durum.bekleyen, ok = Math.abs(x - b.r) <= Math.max(Math.abs(b.r) * 0.02, 1e-9); if (ok) durum.bekleyen = null; return ok ? '<p>✓ ' + esc(T('kontrolOk')) + ' <b>' + esc(sayi(b.r) + ' ' + b.f.o.u) + '</b>.</p>' : '<p>✗ ' + esc(T('kontrolNo')) + ': ~10<sup>' + Math.floor(Math.log10(Math.abs(b.r) || 1)) + '</sup>.</p>'; }
    var n = niyet(s), bul = ara(s, ders);
    if (n === 'ornek') return ornekYanit(ders, bul[0] && bul[0].p >= 3 ? bul[0].f : null);
    if (!bul.length && n === 'hesap' && durum.son) { var v0 = degerOku(s, durum.son.f); if (Object.keys(v0).length) return hesapYanit(durum.son.f, Object.assign({}, durum.son.v, v0), ipucu, durum); }
    if (!bul.length) { var hs = FO.formuller.filter(function (f) { return f.d === ders; }); return '<p>' + esc(T('bulamadim')) + '</p><div class="fa-oneri">' + T('oneri')(hs[0], hs.filter(function (f) { return f.o; })[0]).map(function (o) { return '<button type="button" data-fa-oneri="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>'; }
    var f = bul[0].f;
    if (n === 'hesap' && f.o) return hesapYanit(f, degerOku(s, f), ipucu, durum);
    return nedirYanit(f, bul.slice(1, 3));
  }

  /* ---------- yapay zekâ (formulo-hoca) ---------- */
  /* kesin cevabı olan sorular yerelde kalır: sonuç kontrolü, örnek soru, değerli hesap */
  function yerelMi(soru, ders, durum) {
    var s = soru.trim();
    if (durum.bekleyen && /^-?[0-9]+(?:[.,][0-9]+)?\s*\S*$/.test(s)) return true;
    var n = niyet(s); if (n === 'ornek') return true;
    if (n === 'hesap') { var bul = ara(s, ders); if (bul.length && bul[0].f.o) return true; if (!bul.length && durum.son && Object.keys(degerOku(s, durum.son.f)).length) return true; }
    return false;
  }
  function duzMetin(html) { var t = D.createElement('div'); t.innerHTML = html || ''; return t.textContent.replace(/\s+/g, ' ').trim(); }
  function baglam(f) {
    return { id: f.id, ad: ad(f), formul: duzMetin(f.h),
      aciklama: ((f.anl || []).map(ad).join(' ') + (f.not ? ' ' + ad(f.not) : '')).slice(0, 380),
      cikti: f.o ? ad(f.o) + (f.o.u ? ' [' + f.o.u + ']' : '') : '',
      degiskenler: f.v ? Object.keys(f.v).map(function (k) { return sembolMetin(f, k) + ' = ' + ad(f.v[k]) + (f.v[k].u ? ' [' + f.v[k].u + ']' : ''); }) : [] };
  }
  function istemci() { try { return supabaseClient; } catch (e) { return null; } }
  function aiSor(soru, d, ipucu, durum) {
    var sb = istemci(); if (!sb || !sb.functions || W.FORMULO_AI === false) return Promise.resolve(null);
    var fs = ara(soru, d.id).map(function (x) { return x.f; });
    if (durum.son && fs.indexOf(durum.son.f) < 0) fs.push(durum.son.f);
    var body = { soru: soru, dil: dil(), ipucu: !!ipucu, ders: { id: d.id, kod: d.kod, ad: ad(d) }, formuller: fs.slice(0, 5).map(baglam),
      son: durum.son ? { id: durum.son.f.id, degerler: durum.son.v || {} } : null, gecmis: (durum.gecmis || []).slice(-6) };
    var zaman = new Promise(function (r) { setTimeout(function () { r(null); }, 9000); });
    var cagri = sb.functions.invoke('formulo-hoca', { body: body }).then(function (r) { return r && !r.error && r.data && r.data.cevap ? r.data : null; }, function () { return null; });
    return Promise.race([cagri, zaman]);
  }
  function aiHTML(o, durum) {
    var satir = String(o.cevap).split(/\n+/), h = '', liste = [];
    function bol(x) { return esc(x).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }
    function bosalt() { if (liste.length) { h += '<ul class="fa-v">' + liste.map(function (x) { return '<li>' + bol(x) + '</li>'; }).join('') + '</ul>'; liste = []; } }
    satir.forEach(function (x) { x = x.trim(); if (!x) return; var m = x.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/); if (m) liste.push(m[1]); else { bosalt(); h += '<p>' + bol(x) + '</p>'; } });
    bosalt();
    var f = o.formul_id && FO.formuller.filter(function (x) { return x.id === o.formul_id; })[0];
    if (f) { h += formulKutusu(f); if (!durum.son || durum.son.f !== f) { var v = {}; if (f.v) Object.keys(f.v).forEach(function (k) { v[k] = f.v[k].val; }); durum.son = { f: f, v: v }; } }
    if (o.oneriler && o.oneriler.length) h += '<div class="fa-oneri">' + o.oneriler.map(function (x) { return '<button type="button" data-fa-oneri="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>';
    if (f) h += eylemler(f);
    return h + '<p class="fa-kaynak">' + esc(T('ai')) + '</p>';
  }

  /* ---------- panel ---------- */
  function panelHTML(d) {
    var hs = FO.formuller.filter(function (f) { return f.d === d.id; }), cal = hs.filter(function (f) { return f.o && f.bag; });
    var on = T('oneri')(hs[Math.floor(Math.random() * Math.min(6, hs.length))], cal[Math.floor(Math.random() * cal.length)] || hs.filter(function (f) { return f.o; })[0]);
    return '<div class="fa" data-fa><p class="fa-bant">' + esc(T('bant')) + '</p>' +
      '<div class="fa-akis" data-fa-akis aria-live="polite"><div class="fa-m fa-ac"><span class="fa-acd">' + W.FO_ACADIA({ mood: 'mutlu', pose: 'selam', size: 44 }) + '</span><div class="fa-b"><p>' + esc(T('selam')) + '</p><div class="fa-oneri">' + on.map(function (o) { return '<button type="button" data-fa-oneri="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div></div></div></div>' +
      '<form class="fa-form" data-fa-form><label class="fa-ip"><input type="checkbox" data-fa-ipucu><span>' + esc(T('ipucuMod')) + '</span></label><input type="text" data-fa-girdi autocomplete="off" placeholder="' + esc(T('yer')) + '" aria-label="' + esc(T('yer')) + '"><button type="submit" class="fo-btn">' + esc(T('gonder')) + '</button></form></div>';
  }
  function panelKur(kok, d) {
    var akis = kok.querySelector('[data-fa-akis]'), form = kok.querySelector('[data-fa-form]'), inp = form.querySelector('[data-fa-girdi]'), ip = form.querySelector('[data-fa-ipucu]'), durum = {};
    function ekle(sinif, html) { var m = D.createElement('div'); m.className = 'fa-m ' + sinif; m.innerHTML = sinif === 'fa-ac' ? '<span class="fa-acd">' + W.FO_ACADIA({ mood: 'odakli', pose: 'isaret', size: 44 }) + '</span><div class="fa-b">' + html + '</div>' : '<div class="fa-b">' + html + '</div>'; akis.appendChild(m); m.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return m; }
    function sor(metin) {
      ekle('fa-sen', '<p>' + esc(metin) + '</p>');
      var yaz = ekle('fa-ac fa-yaziyor', '<p class="fa-nokta"><i></i><i></i><i></i></p>');
      var bitir = function (html) { yaz.classList.remove('fa-yaziyor'); yaz.querySelector('.fa-b').innerHTML = html || ''; yaz.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
      durum.gecmis = durum.gecmis || [];
      if (yerelMi(metin, d.id, durum)) { setTimeout(function () { bitir(yanitla(metin, d.id, ip.checked, durum)); }, 380); return; }
      var ipucu = ip.checked;
      aiSor(metin, d, ipucu, durum).then(function (o) {
        if (o) { durum.gecmis.push({ rol: 'ogrenci', metin: metin }, { rol: 'acadia', metin: String(o.cevap).slice(0, 500) }); bitir(aiHTML(o, durum)); }
        else bitir(yanitla(metin, d.id, ipucu, durum));
      });
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); var s = inp.value.trim(); if (!s) return; inp.value = ''; sor(s); });
    ip.addEventListener('change', function () { if (ip.checked) ekle('fa-ac', '<p>' + esc(T('ipucuAcik')) + '</p>'); });
    akis.addEventListener('click', function (e) {
      var o = e.target.closest('[data-fa-oneri]'); if (o) { sor(o.getAttribute('data-fa-oneri')); return; }
      var a = e.target.closest('[data-fa-anlat]'); if (a && W.FORMULO_SAHNE) { var f = FO.formuller.filter(function (x) { return x.id === a.getAttribute('data-fa-anlat'); })[0]; W.FORMULO_SAHNE.ac(f, durum.son && durum.son.f === f ? durum.son.v : null); }
    });
  }
  W.FORMULO_SOR = { panelHTML: panelHTML, panelKur: panelKur, yanitla: yanitla, ara: ara, yerelMi: yerelMi, aiHTML: aiHTML, baglam: baglam };
})(window);
