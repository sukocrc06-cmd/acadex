/* ==========================================================================
   Acadex · Yönetim paneli · ACADEX GÖREV (js/admin-gorev.js) — 21.11.2026
   Birimlere iş görevleri: Test, Tasarım, Pazarlama, Digital Marketing, Finans ve İş Modeli,
   Ürün ve Yazılım. Her görev bir birime ait; kişi isteğe bağlı (Acadex ekibi listesinden).
   Durum: yapılacak → sürüyor → incelemede → bitti. Teslimi geçen ve bitmeyen kırmızı görünür.
   Veri: supabase/migrations/20261121_acadex_gorev.sql (ax_gorev). Yetki veritabanında:
   yönetici her şeyi; finans rolü hepsini okur, yalnız Finans görevlerinde durum/not/bağlantı.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.AXADM; if (!A) return;
  var X = A.X, $ = A.$, $$ = A.$$, sb = A.sb, toast = A.toast, errMsg = A.errMsg;

  var DURUM = { yapilacak: 'Yapılacak', suruyor: 'Sürüyor', incelemede: 'İncelemede', bitti: 'Bitti' };
  var ONCELIK = { yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük' };
  var PROJE = { kids: 'Acadex Kids', acadex: 'Acadex', genel: 'Genel' };
  var FINANS = 'Finans ve İş Modeli';
  var HEDEF = '2026-12-10';
  var G = { l: [], teams: [], people: [], birim: '', durum: '', proje: 'kids', kisi: '' };
  try { G.birim = localStorage.getItem('acadex.adm.gorevBirim') || ''; } catch (e) { }

  /* ---------- saf yardımcılar (tests/acadex-gorev.js da kullanır) ---------- */
  var bugun = function (d) { d = d || new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  var gunFark = function (tarih, simdi) { if (!tarih) return null; var p = String(tarih).split('-'); return Math.round((new Date(+p[0], +p[1] - 1, +p[2]) - bugun(simdi)) / 86400000); };
  var gecikti = function (g, simdi) { var f = gunFark(g.teslim, simdi); return g.durum !== 'bitti' && f !== null && f < 0; };
  var teslimYazi = function (g, simdi) {
    if (!g.teslim) return 'tarih yok';
    var f = gunFark(g.teslim, simdi), p = String(g.teslim).split('-'), t = new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    if (g.durum === 'bitti') return t;
    return f < 0 ? t + ' · ' + (-f) + ' gün gecikti' : f === 0 ? t + ' · bugün' : f === 1 ? t + ' · yarın' : t + ' · ' + f + ' gün';
  };
  var ozet = function (l, simdi) {
    var o = { toplam: l.length, bitti: 0, gecikti: 0, suruyor: 0 };
    l.forEach(function (g) { if (g.durum === 'bitti') o.bitti++; else if (g.durum === 'suruyor' || g.durum === 'incelemede') o.suruyor++; if (gecikti(g, simdi)) o.gecikti++; });
    o.yuzde = o.toplam ? Math.round(o.bitti * 100 / o.toplam) : 0; return o;
  };
  var sirala = function (l) {
    return l.slice().sort(function (a, b) {
      var da = a.durum === 'bitti' ? 1 : 0, db = b.durum === 'bitti' ? 1 : 0; if (da !== db) return da - db;
      var ta = a.teslim || '9999', tb = b.teslim || '9999'; if (ta !== tb) return ta < tb ? -1 : 1;
      return (a.sira || 0) - (b.sira || 0);
    });
  };
  var suz = function (l, f) {
    return l.filter(function (g) {
      if (f.proje && g.proje !== f.proje) return false;
      if (f.birim && g.team_id !== f.birim) return false;
      if (f.kisi && g.kisi_id !== f.kisi) return false;
      if (f.durum === 'acik' && g.durum === 'bitti') return false;
      if (f.durum === 'gecikti' && !gecikti(g)) return false;
      if (f.durum && f.durum !== 'acik' && f.durum !== 'gecikti' && g.durum !== f.durum) return false;
      return true;
    });
  };
  var guvenliLink = function (u) { u = String(u || '').trim(); return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; };
  window.AX_GOREV = { gunFark: gunFark, gecikti: gecikti, teslimYazi: teslimYazi, ozet: ozet, sirala: sirala, suz: suz, guvenliLink: guvenliLink, DURUM: DURUM };

  /* ---------- veri ---------- */
  var takim = function (id) { return G.teams.filter(function (t) { return t.id === id; })[0] || null; };
  var kisi = function (id) { return G.people.filter(function (p) { return p.id === id; })[0] || null; };
  var finOnly = function () { return !!(A.finOnly && A.finOnly()); };
  var yazabilir = function (g) { if (!finOnly()) return true; var t = takim(g.team_id); return !!(t && t.name === FINANS); };
  var yukle = async function () {
    var r = await Promise.all([
      sb.from('ax_gorev').select('*').order('teslim', { ascending: true, nullsFirst: false }),
      sb.from('ax_teams').select('id,name,color,parent_id,sort').order('sort'),
      sb.from('ax_people').select('id,full_name,team_id,status').order('sort')
    ]);
    if (r[0].error) throw r[0].error;
    G.l = r[0].data || []; G.teams = (r[1].data || []); G.people = (r[2].data || []).filter(function (p) { return p.status !== 'ayrildi'; });
  };
  /* görevi olan birimler, şemadaki sıraya göre */
  var birimler = function (l) { var var_ = {}; l.forEach(function (g) { var_[g.team_id || ''] = 1; }); return G.teams.filter(function (t) { return var_[t.id]; }).concat(var_[''] ? [{ id: '', name: 'Birimi yok', color: '#6A7593' }] : []); };

  /* ---------- görünüm ---------- */
  var durumSec = function (g) {
    return '<select class="in gv-durum gv-d-' + X(g.durum) + '" data-gvd="' + X(g.id) + '" aria-label="Durum: ' + X(g.baslik) + '"' + (yazabilir(g) ? '' : ' disabled') + '>' +
      Object.keys(DURUM).map(function (k) { return '<option value="' + k + '"' + (g.durum === k ? ' selected' : '') + '>' + DURUM[k] + '</option>'; }).join('') + '</select>';
  };
  var satir = function (g) {
    var k = kisi(g.kisi_id), gc = gecikti(g), ln = guvenliLink(g.baglanti);
    return '<li class="gv-is' + (g.durum === 'bitti' ? ' gv-bitti' : '') + (gc ? ' gv-gec' : '') + '">' +
      '<button type="button" class="gv-ac" data-gvo="' + X(g.id) + '"><b>' + X(g.baslik) + '</b>' +
      '<span class="gv-alt">' + (g.oncelik === 'yuksek' ? '<span class="pill bad">öncelikli</span>' : '') + '<span class="gv-tar' + (gc ? ' bad' : '') + '">' + X(teslimYazi(g)) + '</span>' +
      (k ? '<span class="gv-kisi">' + X(k.full_name) + '</span>' : '') + (g.notlar ? '<span class="gv-not" title="not var">not</span>' : '') + '</span></button>' +
      (ln ? '<a class="gv-link" href="' + X(ln) + '" target="_blank" rel="noopener noreferrer" title="Bağlantıyı aç">bağlantı ↗</a>' : '') + durumSec(g) + '</li>';
  };
  var birimKart = function (t, l) {
    var o = ozet(l);
    return '<section class="card gv-birim" style="--tc:' + X(t.color || '#2F6BFF') + '"><header><h2>' + X(t.name) + '</h2><span class="muted">' + o.bitti + '/' + o.toplam + (o.gecikti ? ' · <b class="gv-kirmizi">' + o.gecikti + ' gecikti</b>' : '') + '</span>' +
      (finOnly() ? '' : '<button type="button" class="btn ghost sm" data-gvn="' + X(t.id) + '">+ görev</button>') + '</header>' +
      '<div class="gv-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + o.yuzde + '" aria-label="' + X(t.name) + ' ilerleme"><i style="width:' + o.yuzde + '%"></i></div>' +
      '<ul class="gv-liste">' + sirala(l).map(satir).join('') + '</ul></section>';
  };

  A.VIEWS.gorev = async function (m) {
    try { await yukle(); }
    catch (e) {
      if (/ax_gorev|does not exist|PGRST20|42P01/i.test(String((e && (e.message || e.code)) || ''))) {
        m.innerHTML = '<div class="card"><h2>Görev bölümü henüz kurulmadı</h2><p class="sub">Supabase → SQL Editor\'de <b>supabase/migrations/20261121_acadex_gorev.sql</b> dosyasını çalıştır. Acadex Kids görevleri (Test, Tasarım, Pazarlama, Digital Marketing, Finans, Ürün ve Yazılım) hazır gelir.</p></div>';
        return;
      }
      throw e;
    }
    if (A.sayac) A.sayac('gorev_gecikti', ozet(G.l).gecikti);
    var proj = suz(G.l, { proje: G.proje }), o = ozet(proj), kalan = gunFark(HEDEF);
    if (G.birim && !birimler(proj).some(function (t) { return t.id === G.birim; })) G.birim = '';
    var gor = suz(G.l, G), bs = birimler(gor);
    m.innerHTML =
      '<div class="gv-kpi">' +
        '<div class="card"><span class="muted">Toplam görev</span><b>' + o.toplam + '</b></div>' +
        '<div class="card"><span class="muted">Biten</span><b>' + o.bitti + ' <small>%' + o.yuzde + '</small></b></div>' +
        '<div class="card' + (o.gecikti ? ' gv-k-gec' : '') + '"><span class="muted">Geciken</span><b>' + o.gecikti + '</b></div>' +
        '<div class="card"><span class="muted">10 Aralık\'a</span><b>' + (kalan > 0 ? kalan + ' gün' : kalan === 0 ? 'bugün' : 'geçti') + '</b></div>' +
      '</div>' +
      '<div class="gv-sekme" role="group" aria-label="Birim"><button type="button" data-gvb="" aria-pressed="' + (!G.birim) + '">Hepsi</button>' +
        birimler(proj).map(function (t) { var s = ozet(suz(proj, { birim: t.id })); return '<button type="button" data-gvb="' + X(t.id) + '" aria-pressed="' + (G.birim === t.id) + '" style="--tc:' + X(t.color || '#2F6BFF') + '"><i></i>' + X(t.name) + ' <small>' + s.bitti + '/' + s.toplam + '</small></button>'; }).join('') + '</div>' +
      '<div class="tools gv-tools">' +
        '<label class="fld">Proje<select class="in" id="gv-p">' + Object.keys(PROJE).map(function (k) { return '<option value="' + k + '"' + (G.proje === k ? ' selected' : '') + '>' + PROJE[k] + '</option>'; }).join('') + '</select></label>' +
        '<label class="fld">Durum<select class="in" id="gv-s"><option value="">hepsi</option><option value="acik"' + (G.durum === 'acik' ? ' selected' : '') + '>bitmeyenler</option><option value="gecikti"' + (G.durum === 'gecikti' ? ' selected' : '') + '>gecikenler</option>' + Object.keys(DURUM).map(function (k) { return '<option value="' + k + '"' + (G.durum === k ? ' selected' : '') + '>' + DURUM[k] + '</option>'; }).join('') + '</select></label>' +
        '<label class="fld">Kişi<select class="in" id="gv-k"><option value="">herkes</option>' + G.people.map(function (p) { return '<option value="' + X(p.id) + '"' + (G.kisi === p.id ? ' selected' : '') + '>' + X(p.full_name) + '</option>'; }).join('') + '</select></label>' +
        '<div class="acts"><button type="button" class="btn ghost sm" id="gv-csv">Excel (CSV) indir</button>' + (finOnly() ? '' : '<button type="button" class="btn blue sm" id="gv-yeni">+ Görev</button>') + '</div>' +
      '</div>' +
      (finOnly() ? '<p class="muted gv-bilgi">Finans rolüyle tüm görevleri görürsün; yalnız Finans ve İş Modeli görevlerinde durum, not ve bağlantı değiştirebilirsin.</p>' : '') +
      (gor.length ? '<div class="gv-grid">' + bs.map(function (t) { return birimKart(t, gor.filter(function (g) { return (g.team_id || '') === t.id; })); }).join('') + '</div>'
        : '<div class="card"><p class="muted" style="margin:0">Bu filtrede görev yok.</p></div>');

    m.onclick = function (e) {
      var b;
      if ((b = e.target.closest('[data-gvb]'))) { G.birim = b.getAttribute('data-gvb'); try { localStorage.setItem('acadex.adm.gorevBirim', G.birim); } catch (er) { } A.VIEWS.gorev(m); return; }
      if ((b = e.target.closest('[data-gvo]'))) { kart(m, G.l.filter(function (g) { return g.id === b.getAttribute('data-gvo'); })[0]); return; }
      if ((b = e.target.closest('[data-gvn]'))) { form(m, null, b.getAttribute('data-gvn')); return; }
      if (e.target.closest('#gv-yeni')) { form(m, null, G.birim); return; }
      if (e.target.closest('#gv-csv')) { disari(gor); }
    };
    m.onchange = async function (e) {
      var t = e.target;
      if (t.id === 'gv-p') { G.proje = t.value; G.birim = ''; A.VIEWS.gorev(m); return; }
      if (t.id === 'gv-s') { G.durum = t.value; A.VIEWS.gorev(m); return; }
      if (t.id === 'gv-k') { G.kisi = t.value; A.VIEWS.gorev(m); return; }
      if (t.matches('[data-gvd]')) {
        t.disabled = true;
        try { var r = await sb.from('ax_gorev').update({ durum: t.value }).eq('id', t.getAttribute('data-gvd')); if (r.error) throw r.error; toast(t.value === 'bitti' ? 'Görev bitti olarak işaretlendi.' : 'Durum: ' + DURUM[t.value]); A.VIEWS.gorev(m); }
        catch (er) { t.disabled = false; toast(errMsg(er), true); }
      }
    };
  };

  /* ---------- görev kartı ---------- */
  var kart = function (m, g) {
    if (!g) return; var t = takim(g.team_id), k = kisi(g.kisi_id), ln = guvenliLink(g.baglanti);
    A.openDrawer(g.baslik,
      '<div class="gv-kart" style="--tc:' + X(t ? t.color : '#6A7593') + '"><div class="ek-pills">' + (t ? '<span class="pill" style="background:' + X(t.color) + ';color:#fff">' + X(t.name) + '</span>' : '') +
      '<span class="pill' + (g.durum === 'bitti' ? ' ok' : gecikti(g) ? ' bad' : '') + '">' + X(DURUM[g.durum]) + '</span><span class="pill">' + X(ONCELIK[g.oncelik]) + ' öncelik</span><span class="pill">' + X(PROJE[g.proje]) + '</span></div>' +
      '<dl class="kv"><dt>Teslim</dt><dd' + (gecikti(g) ? ' class="gv-kirmizi"' : '') + '>' + X(teslimYazi(g)) + '</dd><dt>Kişi</dt><dd>' + (k ? X(k.full_name) : '<span class="muted">birim içinde paylaşılır</span>') + '</dd>' +
      (ln ? '<dt>Bağlantı</dt><dd><a href="' + X(ln) + '" target="_blank" rel="noopener noreferrer">' + X(ln.length > 60 ? ln.slice(0, 57) + '…' : ln) + '</a></dd>' : '') +
      (g.bitti_at ? '<dt>Bitti</dt><dd>' + A.DT(g.bitti_at, true) + '</dd>' : '') + '<dt>Güncellendi</dt><dd>' + A.AGO(g.updated_at) + '</dd></dl>' +
      (g.aciklama ? '<section class="ek-sec"><h3>Ne yapılacak</h3><p class="gv-pre">' + X(g.aciklama) + '</p></section>' : '') +
      (g.notlar ? '<section class="ek-sec"><h3>Notlar</h3><p class="gv-pre">' + X(g.notlar) + '</p></section>' : '') +
      (yazabilir(g) ? '<div class="acts"><button type="button" class="btn blue" id="gvk-d">Düzenle</button></div>' : '') + '</div>');
    var d = $('#gvk-d'); if (d) d.addEventListener('click', function () { form(m, g); });
  };

  var form = function (m, g, teamId) {
    var yeni = !g, sinirli = finOnly();
    g = g || { baslik: '', aciklama: '', team_id: teamId || '', kisi_id: '', teslim: HEDEF, durum: 'yapilacak', oncelik: 'orta', proje: G.proje || 'kids', baglanti: '', notlar: '', sira: 100 };
    var dis = sinirli ? ' disabled' : '';
    var kisiSec = function (tid) { return '<option value="">kişi seçilmedi (birim)</option>' + G.people.filter(function (p) { return !tid || p.team_id === tid || p.id === g.kisi_id; }).map(function (p) { return '<option value="' + X(p.id) + '"' + (p.id === g.kisi_id ? ' selected' : '') + '>' + X(p.full_name) + '</option>'; }).join(''); };
    A.openDrawer(yeni ? 'Yeni görev' : g.baslik,
      '<form id="gv-f" novalidate style="display:flex;flex-direction:column;gap:12px">' +
      '<label class="fld">Başlık<input class="in" name="b" maxlength="160" required value="' + X(g.baslik) + '"' + dis + '></label>' +
      '<label class="fld">Ne yapılacak <small>adımlar, teslim edilecek dosya</small><textarea class="in" name="a" rows="5" maxlength="3000"' + dis + '>' + X(g.aciklama) + '</textarea></label>' +
      '<div class="grid g2" style="gap:10px"><label class="fld">Birim<select class="in" name="t"' + dis + '><option value="">birimi yok</option>' + G.teams.map(function (t) { return '<option value="' + X(t.id) + '"' + (t.id === g.team_id ? ' selected' : '') + '>' + X(t.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld">Kişi <small>isteğe bağlı</small><select class="in" name="k"' + dis + '>' + kisiSec(g.team_id) + '</select></label></div>' +
      '<div class="grid g2" style="gap:10px"><label class="fld">Teslim<input class="in" type="date" name="d" value="' + X(g.teslim || '') + '"' + dis + '></label>' +
      '<label class="fld">Durum<select class="in" name="s">' + Object.keys(DURUM).map(function (k) { return '<option value="' + k + '"' + (g.durum === k ? ' selected' : '') + '>' + DURUM[k] + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="grid g2" style="gap:10px"><label class="fld">Öncelik<select class="in" name="o"' + dis + '>' + Object.keys(ONCELIK).map(function (k) { return '<option value="' + k + '"' + (g.oncelik === k ? ' selected' : '') + '>' + ONCELIK[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld">Proje<select class="in" name="p"' + dis + '>' + Object.keys(PROJE).map(function (k) { return '<option value="' + k + '"' + (g.proje === k ? ' selected' : '') + '>' + PROJE[k] + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="fld">Bağlantı <small>Excel, Drive, Canva… https:// ile başlamalı</small><input class="in" type="url" name="l" maxlength="500" placeholder="https://" value="' + X(g.baglanti) + '"></label>' +
      '<label class="fld">Notlar<textarea class="in" name="n" rows="3" maxlength="3000">' + X(g.notlar) + '</textarea></label>' +
      '<div class="acts"><button type="submit" class="btn blue">' + (yeni ? 'Görevi ekle' : 'Kaydet') + '</button>' + (yeni || sinirli ? '' : '<button type="button" class="btn ghost" id="gv-sil">Sil</button>') + '</div></form>');
    var f = $('#gv-f');
    f.t.addEventListener('change', function () { g.kisi_id = ''; f.k.innerHTML = kisiSec(f.t.value); });
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var ln = f.l.value.trim(); if (ln && !guvenliLink(ln)) { toast('Bağlantı https:// ile başlamalı.', true); f.l.focus(); return; }
      var row = sinirli ? { durum: f.s.value, baglanti: ln, notlar: f.n.value.trim() } : {
        baslik: f.b.value.trim(), aciklama: f.a.value.trim(), team_id: f.t.value || null, kisi_id: f.k.value || null, teslim: f.d.value || null,
        durum: f.s.value, oncelik: f.o.value, proje: f.p.value, baglanti: ln, notlar: f.n.value.trim()
      };
      if (!sinirli && row.baslik.length < 3) { toast('Başlık en az 3 harf olmalı.', true); f.b.focus(); return; }
      var btn = $('button[type=submit]', f); btn.disabled = true;
      try {
        var r = yeni ? await sb.from('ax_gorev').insert(row) : await sb.from('ax_gorev').update(row).eq('id', g.id);
        if (r.error) throw r.error; toast(yeni ? 'Görev eklendi.' : 'Kaydedildi.'); A.closeDrawer(); A.VIEWS.gorev(m);
      } catch (er) { btn.disabled = false; toast(errMsg(er), true); }
    });
    var sil = $('#gv-sil'); if (sil) sil.addEventListener('click', async function () {
      if (!A.confirmBox('"' + g.baslik + '" görevi silinsin mi? Bu geri alınamaz.')) return;
      try { var r = await sb.from('ax_gorev').delete().eq('id', g.id); if (r.error) throw r.error; toast('Görev silindi.'); A.closeDrawer(); A.VIEWS.gorev(m); } catch (er) { toast(errMsg(er), true); }
    });
  };

  var disari = function (l) {
    A.csv('acadex-gorevler.csv', ['Proje', 'Birim', 'Görev', 'Ne yapılacak', 'Kişi', 'Teslim', 'Durum', 'Öncelik', 'Gecikti', 'Bağlantı', 'Notlar'],
      sirala(l).map(function (g) { var t = takim(g.team_id), k = kisi(g.kisi_id); return [PROJE[g.proje], t ? t.name : '', g.baslik, g.aciklama, k ? k.full_name : '', g.teslim || '', DURUM[g.durum], ONCELIK[g.oncelik], gecikti(g) ? 'evet' : '', g.baglanti, g.notlar]; }));
  };
})();
