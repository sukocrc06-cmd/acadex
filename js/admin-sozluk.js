/* ==========================================================================
   Acadex · Yönetim paneli · SÖZLÜK (js/admin-sozluk.js) — 18.11.2026
   Akademik İçerik Kurulu'nun sözlük masası: terim ekler, üç anlatımı yazar (Sade · Akademik ·
   Örnekle), onaylar. Wikidata (CC0) ile terim terim eşleştirir: yalnız yöneticinin tarayıcısı
   wikidata.org'a terimin kendisini sorar; öğrenci verisi gitmez.
   Öğrenci tarafı: js/acadex-sozluk.js. Veri: supabase/migrations/20261118b_sozluk.sql
   (yazma yetkisi veritabanında: admin_ok()).
   ========================================================================== */
(function () {
  'use strict';
  var A = window.AXADM; if (!A) return;
  var X = A.X, NF = A.NF, $ = A.$, $$ = A.$$, sb = A.sb, toast = A.toast, errMsg = A.errMsg;
  var ALAN = { genel: 'Genel', istatistik: 'İstatistik', finans: 'Finans', isletme: 'İşletme', muhasebe: 'Muhasebe', ekonomi: 'Ekonomi', ticaret: 'Uluslararası ticaret', ybs: 'Yönetim bilişim', saglik: 'Sağlık', anatomi: 'Anatomi', eczacilik: 'Eczacılık', hemsirelik: 'Hemşirelik', diyetetik: 'Beslenme ve diyetetik', fizyoterapi: 'Fizyoterapi', odyoloji: 'Odyoloji', dkt: 'Dil ve konuşma terapisi', ingilizce: 'İngilizce' };
  var SV = [['sade', 'Sade', 'S'], ['akademik', 'Akademik', 'A'], ['ornek', 'Örnekle', 'Ö']];
  var Z = { l: [], q: '', alan: '', durum: '', eksik: '' };

  /* ---------- saf yardımcılar (tests/sozluk.js da kullanır) ---------- */
  /* toplu ekleme: her satır "türkçe ; english ; alan" (alan isteğe bağlı, virgülle birden çok) */
  var topluCoz = function (metin) {
    var gor = {}, out = [], hata = [];
    String(metin || '').split(/\r?\n/).forEach(function (s, i) {
      if (!s.trim()) return;
      var p = s.split(/\s*[;\t]\s*/), tr = (p[0] || '').trim(), en = (p[1] || '').trim();
      var al = (p[2] || '').split(/\s*,\s*/).map(function (a) { return a.trim().toLocaleLowerCase('tr'); }).filter(Boolean);
      var bil = al.filter(function (a) { return !ALAN[a]; });
      if (tr.length < 2 || tr.length > 120) { hata.push((i + 1) + '. satır: terim 2-120 harf olmalı'); return; }
      if (bil.length) { hata.push((i + 1) + '. satır: bilinmeyen alan "' + bil.join(', ') + '"'); return; }
      var k = tr.toLocaleLowerCase('tr'); if (gor[k]) return; gor[k] = 1;
      out.push({ tr: tr, en: en.slice(0, 160), alan: al.slice(0, 8), kaynak: 'acadex', durum: 'taslak' });
    });
    return { satir: out, hata: hata };
  };
  var eksikler = function (t) { return SV.filter(function (s) { return !String(t[s[0]] || '').trim(); }).map(function (s) { return s[0]; }); };
  var suz = function (l, f) {
    var q = String(f.q || '').toLocaleLowerCase('tr').trim();
    return l.filter(function (t) {
      if (f.alan && (t.alan || []).indexOf(f.alan) < 0) return false;
      if (f.durum && t.durum !== f.durum) return false;
      if (f.eksik === 'herhangi' && !eksikler(t).length) return false;
      if (f.eksik && f.eksik !== 'herhangi' && eksikler(t).indexOf(f.eksik) < 0) return false;
      if (q && (t.tr + ' ' + t.en + ' ' + (t.es || []).join(' ')).toLocaleLowerCase('tr').indexOf(q) < 0) return false;
      return true;
    });
  };
  /* Wikidata yanıtından kart için alanlar (Türkçe varsa Türkçe açıklama) */
  var wdOzet = function (ent) {
    var lb = ent.labels || {}, ds = ent.descriptions || {};
    return { id: ent.id, tr: (lb.tr || {}).value || '', en: (lb.en || {}).value || '', aciklama: (ds.tr || {}).value || (ds.en || {}).value || '', dil: ds.tr ? 'tr' : ds.en ? 'en' : '' };
  };
  var WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*&';
  var wdAra = async function (q, dil) {
    var r = await fetch(WD + 'action=wbsearchentities&type=item&limit=6&language=' + dil + '&uselang=tr&search=' + encodeURIComponent(q));
    if (!r.ok) throw new Error('Wikidata yanıt vermedi.');
    return ((await r.json()).search || []).map(function (s) { return { id: s.id, ad: s.label || '', aciklama: s.description || '' }; });
  };
  var wdAl = async function (id) {
    if (!/^Q\d{1,12}$/.test(id)) throw new Error('Geçersiz Wikidata kimliği.');
    var r = await fetch(WD + 'action=wbgetentities&props=labels|descriptions&languages=tr|en&ids=' + id);
    if (!r.ok) throw new Error('Wikidata yanıt vermedi.');
    var e = ((await r.json()).entities || {})[id]; if (!e) throw new Error('Kayıt bulunamadı.');
    return wdOzet(e);
  };

  var yukle = async function () {
    var l = [];
    for (var off = 0; off < 20000; off += 1000) {
      var r = await sb.from('sozluk_terim').select('*').order('tr').range(off, off + 999);
      if (r.error) throw r.error; l = l.concat(r.data || []); if ((r.data || []).length < 1000) break;
    }
    Z.l = l;
  };
  var noktalar = function (t) { var e = eksikler(t); return '<span class="sz-nok" title="' + X(SV.map(function (s) { return s[1] + (e.indexOf(s[0]) > -1 ? ': yok' : ': var'); }).join(' · ')) + '">' + SV.map(function (s) { return '<i class="' + (e.indexOf(s[0]) > -1 ? '' : 'on') + '">' + s[2] + '</i>'; }).join('') + '</span>'; };
  var listeHtml = function () {
    var l = suz(Z.l, Z);
    return '<p class="muted sz-say">' + NF(l.length) + ' terim' + (l.length > 300 ? ' · ilk 300 gösteriliyor, aramayı daraltın' : '') + '</p>' +
      (l.length ? '<div class="tbl-w"><table class="sz-t"><thead><tr><th>Terim</th><th>Alan</th><th>Anlatım</th><th>Durum</th><th>Kaynak</th></tr></thead><tbody>' +
        l.slice(0, 300).map(function (t) {
          return '<tr data-szt="' + X(t.id) + '" tabindex="0"><td><b>' + X(t.tr) + '</b>' + (t.en ? '<div class="psh-s" lang="en">' + X(t.en) + '</div>' : '') + '</td><td>' + (t.alan || []).map(function (a) { return '<span class="pill">' + X(ALAN[a] || a) + '</span>'; }).join(' ') + '</td>' +
            '<td>' + noktalar(t) + '</td><td>' + (t.durum === 'onayli' ? '<span class="pill ok">onaylı</span>' : '<span class="pill warn">taslak</span>') + '</td><td class="psh-s">' + X(t.kaynak === 'lab' ? 'lab' : 'Acadex') + (t.wikidata ? ' · ' + X(t.wikidata) : '') + (t.isaretle ? '' : ' · işaretsiz') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="card"><p class="muted" style="margin:0">Bu süzgeçle terim yok.</p></div>');
  };
  var ciz = function (m) {
    var on = Z.l.filter(function (t) { return t.durum === 'onayli'; }).length, ek = Z.l.filter(function (t) { return eksikler(t).length; }).length, wd = Z.l.filter(function (t) { return t.wikidata; }).length;
    var sel = function (id, cur, ops) { return '<select class="in" id="' + id + '">' + ops.map(function (o) { return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + X(o[1]) + '</option>'; }).join('') + '</select>'; };
    m.innerHTML = '<div class="sz-kpi"><div class="card"><small class="muted">Terim</small><b>' + NF(Z.l.length) + '</b></div><div class="card"><small class="muted">Onaylı</small><b>' + NF(on) + '</b></div>' +
      '<div class="card"><small class="muted">Anlatımı eksik</small><b>' + NF(ek) + '</b></div><div class="card"><small class="muted">Wikidata eşleşmesi</small><b>' + NF(wd) + '</b></div></div>' +
      '<div class="tools"><label class="fld grow">Ara<input class="in" id="sz-q" value="' + X(Z.q) + '" placeholder="Türkçe ya da İngilizce"></label>' +
      '<label class="fld">Alan' + sel('sz-alan', Z.alan, [['', 'hepsi']].concat(Object.keys(ALAN).map(function (k) { return [k, ALAN[k]]; }))) + '</label>' +
      '<label class="fld">Durum' + sel('sz-durum', Z.durum, [['', 'hepsi'], ['taslak', 'taslak'], ['onayli', 'onaylı']]) + '</label>' +
      '<label class="fld">Anlatım' + sel('sz-eksik', Z.eksik, [['', 'hepsi'], ['herhangi', 'bir anlatımı eksik'], ['sade', 'sade eksik'], ['akademik', 'akademik eksik'], ['ornek', 'örnek eksik']]) + '</label>' +
      '<button type="button" class="btn ghost sm" id="sz-csv">CSV indir</button><button type="button" class="btn ghost sm" id="sz-toplu">Toplu ekle</button><button type="button" class="btn blue sm" id="sz-yeni">+ Terim</button></div>' +
      '<div id="sz-liste">' + listeHtml() + '</div>';
    var t0 = 0, yenile = function () { $('#sz-liste', m).innerHTML = listeHtml(); };
    $('#sz-q', m).addEventListener('input', function () { var v = this.value; clearTimeout(t0); t0 = setTimeout(function () { Z.q = v; yenile(); }, 200); });
    [['#sz-alan', 'alan'], ['#sz-durum', 'durum'], ['#sz-eksik', 'eksik']].forEach(function (p) { $(p[0], m).addEventListener('change', function () { Z[p[1]] = this.value; yenile(); }); });
    $('#sz-yeni', m).addEventListener('click', function () { form(m, null); });
    $('#sz-toplu', m).addEventListener('click', function () { toplu(m); });
    $('#sz-csv', m).addEventListener('click', function () { A.csv('acadex-sozluk.csv', ['Türkçe', 'İngilizce', 'Diğer yazımlar', 'Alan', 'Sade', 'Akademik', 'Örnekle', 'Durum', 'Wikidata'], suz(Z.l, Z).map(function (t) { return [t.tr, t.en, (t.es || []).join(', '), (t.alan || []).join(', '), t.sade, t.akademik, t.ornek, t.durum, t.wikidata]; })); });
    var ac = function (tr) { form(m, Z.l.filter(function (t) { return t.id === tr.getAttribute('data-szt'); })[0]); };
    $('#sz-liste', m).addEventListener('click', function (e) { var tr = e.target.closest('tr[data-szt]'); if (tr) ac(tr); });
    $('#sz-liste', m).addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-szt]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ac(tr); } });
  };
  var form = function (m, t) {
    var yeni = !t; t = t || { tr: '', en: '', es: [], alan: [], sade: '', akademik: '', ornek: '', durum: 'taslak', isaretle: true, wikidata: '', kaynak: 'acadex' };
    A.openDrawer(yeni ? 'Yeni terim' : t.tr,
      '<form id="sz-f" novalidate style="display:flex;flex-direction:column;gap:12px">' +
      '<div class="grid g2" style="gap:10px"><label class="fld">Türkçe terim<input class="in" name="tr" maxlength="120" required value="' + X(t.tr) + '"></label><label class="fld">İngilizce karşılık<input class="in" name="en" maxlength="160" lang="en" value="' + X(t.en) + '"></label></div>' +
      '<label class="fld">Diğer yazımlar <small>virgülle; kısaltma, eş anlamlı (ör. SD, std. sapma)</small><input class="in" name="es" maxlength="400" value="' + X((t.es || []).join(', ')) + '"></label>' +
      '<fieldset class="sz-alanlar"><legend>Alan</legend>' + Object.keys(ALAN).map(function (k) { return '<label><input type="checkbox" name="alan" value="' + k + '"' + ((t.alan || []).indexOf(k) > -1 ? ' checked' : '') + '>' + X(ALAN[k]) + '</label>'; }).join('') + '</fieldset>' +
      '<div class="card sz-wd"><div class="sz-wdb"><b>Wikidata</b><span class="muted">' + (t.wikidata ? 'eşleşme: ' + X(t.wikidata) : 'eşleşme yok') + '</span><button type="button" class="btn ghost sm" id="sz-wd-ara">Wikidata\'da ara</button></div><div id="sz-wd-sonuc" aria-live="polite"></div>' +
      '<p class="muted" style="margin:6px 0 0;font-size:12.5px">CC0: serbestçe kullanılır. Açıklama boşsa Akademik anlatıma yazılır; her zaman gözden geçirin.</p></div>' +
      SV.map(function (s) { return '<label class="fld">' + s[1] + ' anlatım <small>' + (s[0] === 'sade' ? 'lise diliyle, 1-3 cümle' : s[0] === 'akademik' ? 'ders kitabı tanımı' : 'günlük hayattan ya da dersten bir örnek') + '</small><textarea class="in" name="' + s[0] + '" maxlength="1500" rows="' + (s[0] === 'akademik' ? 4 : 3) + '">' + X(t[s[0]] || '') + '</textarea></label>'; }).join('') +
      '<div class="grid g2" style="gap:10px"><label class="fld">Durum<select class="in" name="durum"><option value="taslak"' + (t.durum !== 'onayli' ? ' selected' : '') + '>taslak</option><option value="onayli"' + (t.durum === 'onayli' ? ' selected' : '') + '>onaylı (kurul)</option></select></label>' +
      '<div style="display:flex;align-items:flex-end"><label class="switch"><input type="checkbox" name="isaretle"' + (t.isaretle !== false ? ' checked' : '') + '><i></i>metinlerde altı noktalı göster</label></div></div>' +
      '<input type="hidden" name="wikidata" value="' + X(t.wikidata || '') + '">' +
      '<div class="acts"><button class="btn blue" type="submit">' + (yeni ? 'Terimi ekle' : 'Kaydet') + '</button>' + (yeni ? '' : '<button class="btn red" type="button" id="sz-sil">terimi sil</button>') + '</div></form>');
    var f = $('#sz-f');
    $('#sz-wd-ara').addEventListener('click', async function () {
      var kutu = $('#sz-wd-sonuc'), b = this, q = (f.en.value.trim() || f.tr.value.trim()), dil = f.en.value.trim() ? 'en' : 'tr';
      if (!q) { toast('Önce terimi yazın.', true); return; }
      b.disabled = true; kutu.innerHTML = '<p class="muted">aranıyor…</p>';
      try {
        var l = await wdAra(q, dil);
        kutu.innerHTML = l.length ? '<ul class="sz-wdl">' + l.map(function (x) { return '<li><button type="button" class="lnk" data-wd="' + X(x.id) + '"><b>' + X(x.ad) + '</b> <span class="muted">' + X(x.id) + '</span></button><div class="psh-s">' + X(x.aciklama || 'açıklama yok') + '</div></li>'; }).join('') + '</ul>' : '<p class="muted">Wikidata\'da bulunamadı.</p>';
      } catch (er) { kutu.innerHTML = '<p class="err">' + X(errMsg(er)) + '</p>'; }
      b.disabled = false;
    });
    $('#sz-wd-sonuc').addEventListener('click', async function (e) {
      var b = e.target.closest('[data-wd]'); if (!b) return;
      try {
        var o = await wdAl(b.getAttribute('data-wd'));
        f.wikidata.value = o.id;
        if (!f.en.value.trim() && o.en) f.en.value = o.en;
        if (!f.akademik.value.trim() && o.aciklama) f.akademik.value = o.aciklama.charAt(0).toLocaleUpperCase(o.dil || 'tr') + o.aciklama.slice(1) + '.';
        $('.sz-wdb .muted').textContent = 'eşleşme: ' + o.id + (o.tr ? ' · ' + o.tr : '');
        $('#sz-wd-sonuc').innerHTML = '<p class="muted">' + X(o.id) + ' seçildi' + (o.aciklama ? ' (' + (o.dil === 'tr' ? 'Türkçe' : 'İngilizce') + ' açıklama)' : '') + '. Kaydetmeyi unutmayın.</p>';
      } catch (er) { toast(errMsg(er), true); }
    });
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var tr = f.tr.value.trim(); if (tr.length < 2) { toast('Türkçe terimi yazın.', true); f.tr.focus(); return; }
      var row = { tr: tr, en: f.en.value.trim(), es: f.es.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12),
        alan: $$('input[name=alan]:checked', f).map(function (x) { return x.value; }).slice(0, 8), sade: f.sade.value.trim(), akademik: f.akademik.value.trim(), ornek: f.ornek.value.trim(),
        durum: f.durum.value, isaretle: f.isaretle.checked, wikidata: f.wikidata.value };
      if (yeni) row.kaynak = 'acadex';
      var b = $('button[type=submit]', f); b.disabled = true;
      try {
        var r = yeni ? await sb.from('sozluk_terim').insert(row) : await sb.from('sozluk_terim').update(row).eq('id', t.id);
        if (r.error) throw r.error;
        toast(yeni ? 'Terim eklendi.' : 'Kaydedildi.'); A.closeDrawer(); await yukle(); ciz(m);
      } catch (er) { b.disabled = false; toast(/duplicate|unique/i.test(er.message || '') ? 'Bu terim sözlükte zaten var.' : errMsg(er), true); }
    });
    var sil = $('#sz-sil'); if (sil) sil.addEventListener('click', async function () {
      if (!A.confirmBox('"' + t.tr + '" sözlükten silinsin mi?')) return;
      try { var r = await sb.from('sozluk_terim').delete().eq('id', t.id); if (r.error) throw r.error; toast('Terim silindi.'); A.closeDrawer(); await yukle(); ciz(m); } catch (er) { toast(errMsg(er), true); }
    });
  };
  var toplu = function (m) {
    A.openDrawer('Toplu terim ekle',
      '<form id="sz-tf" style="display:flex;flex-direction:column;gap:12px"><p class="muted" style="margin:0">Her satıra bir terim: <b>Türkçe ; İngilizce ; alan</b>. Alan isteğe bağlı (virgülle birden çok): ' + X(Object.keys(ALAN).join(', ')) + '. Sözlükte olan terimler atlanır; yeniler taslak olarak eklenir.</p>' +
      '<label class="fld">Terimler<textarea class="in" name="t" rows="12" placeholder="amortisman ; depreciation ; muhasebe&#10;likidite ; liquidity ; finans"></textarea></label><div id="sz-tf-n" class="muted" aria-live="polite"></div>' +
      '<div class="acts"><button class="btn blue" type="submit">Ekle</button></div></form>');
    var f = $('#sz-tf'), n = $('#sz-tf-n');
    f.t.addEventListener('input', function () { var c = topluCoz(f.t.value); n.innerHTML = c.satir.length + ' terim' + (c.hata.length ? ' · <span class="err">' + X(c.hata.slice(0, 3).join(' · ')) + '</span>' : ''); });
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var c = topluCoz(f.t.value); if (c.hata.length) { toast(c.hata[0], true); return; } if (!c.satir.length) { toast('Terim yazın.', true); return; }
      var b = $('button[type=submit]', f); b.disabled = true;
      try {
        var r = await sb.from('sozluk_terim').upsert(c.satir, { onConflict: 'anahtar', ignoreDuplicates: true }); if (r.error) throw r.error;
        toast(c.satir.length + ' satır işlendi; sözlükte olanlar atlandı.'); A.closeDrawer(); await yukle(); ciz(m);
      } catch (er) { b.disabled = false; toast(errMsg(er), true); }
    });
  };
  A.VIEWS.sozluk = async function (m) {
    try { await yukle(); }
    catch (e) {
      if (/sozluk_terim|does not exist|PGRST20/i.test(String((e && (e.message || e.code)) || ''))) {
        m.innerHTML = '<div class="card"><h2>Sözlük henüz kurulmadı</h2><p class="sub">Supabase → SQL Editor\'de <b>20261118b_sozluk.sql</b> dosyasını çalıştır; bu sayfa kendiliğinden dolar.</p></div>';
        return;
      }
      throw e;
    }
    ciz(m);
  };
  window.AXSOZ_ADMIN_TEST = { topluCoz: topluCoz, eksikler: eksikler, suz: suz, wdOzet: wdOzet };
})();
