/* ==========================================================================
   Acadex · Yönetim paneli · ACADIA GERİ BİLDİRİM (js/admin-acadia.js) — 18.11.2026
   Kaynakla çalış sohbetinde öğrencilerin 👍 / 👎 verdiği cevaplar ve Acadia'nın
   cevaplayamadığı sorular. Amaç: neyi cevaplayamadığını görüp düzeltmek
   (talimat, arama, model). Öğrenci tarafı: js/acadex-acadia-geri.js.
   Veri: supabase/migrations/20261118c_acadia_geri_bildirim.sql (okuma: admin_ok()).
   ========================================================================== */
(function () {
  'use strict';
  var A = window.AXADM; if (!A) return;
  var X = A.X, NF = A.NF, $ = A.$, sb = A.sb, toast = A.toast, errMsg = A.errMsg;
  var Z = { l: [], kisi: {}, f: 'sorun', q: '' };

  /* ---------- saf yardımcılar (tests/acadia-geri-bildirim.js da kullanır) ---------- */
  var tur = function (r) { return r.hata ? 'hata' : r.puan === -1 ? 'olumsuz' : r.puan === 1 ? 'olumlu' : 'diger'; };
  var suz = function (l, f, q) {
    q = String(q || '').toLocaleLowerCase('tr').trim();
    return l.filter(function (r) {
      var t = tur(r);
      if (f === 'sorun' && t !== 'hata' && t !== 'olumsuz') return false;
      if (f && f !== 'sorun' && f !== 'hepsi' && t !== f) return false;
      if (q && (String(r.soru || '') + ' ' + String(r.cevap || '') + ' ' + String(r.hata || '')).toLocaleLowerCase('tr').indexOf(q) < 0) return false;
      return true;
    });
  };
  var ozet = function (l) {
    var o = { n: l.length, olumlu: 0, olumsuz: 0, hata: 0, model: {} };
    l.forEach(function (r) { var t = tur(r); if (o[t] !== undefined) o[t]++; if (r.model) o.model[r.model] = (o.model[r.model] || 0) + 1; });
    var oy = o.olumlu + o.olumsuz; o.memnun = oy ? Math.round(o.olumlu / oy * 100) : null;
    return o;
  };
  var kes = function (t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

  var yukle = async function () {
    var r = await sb.from('acadia_geri_bildirim').select('id,user_id,study_card_id,soru,cevap,puan,hata,model,yol,created_at').order('created_at', { ascending: false }).limit(500);
    if (r.error) throw r.error;
    Z.l = r.data || [];
    var ids = Z.l.map(function (x) { return x.user_id; }).filter(function (v, i, a) { return v && a.indexOf(v) === i && !Z.kisi[v]; });
    if (ids.length) {
      var p = await sb.from('profiles').select('id,full_name,email').in('id', ids.slice(0, 300));
      (p.data || []).forEach(function (x) { Z.kisi[x.id] = x.full_name || x.email || 'öğrenci'; });
    }
  };
  var ETIKET = { hata: ['cevap veremedi', 'pill warn'], olumsuz: ['👎 işe yaramadı', 'pill warn'], olumlu: ['👍 işe yaradı', 'pill ok'], diger: ['—', 'pill'] };
  var listeHtml = function () {
    var l = suz(Z.l, Z.f, Z.q);
    if (!l.length) return '<div class="card"><p class="muted" style="margin:0">' + (Z.l.length ? 'Bu süzgece uyan kayıt yok.' : 'Henüz geri bildirim yok. Öğrenciler Kaynakla çalış\'ta 👍 / 👎 verdikçe ve Acadia bir soruyu cevaplayamadıkça burada görünür.') + '</p></div>';
    return '<div class="tbl-w"><table><thead><tr><th>Zaman</th><th>Durum</th><th>Soru</th><th class="hide-sm">Cevap / hata</th><th class="hide-sm">Model · yol</th><th class="hide-sm">Öğrenci</th><th></th></tr></thead><tbody>' +
      l.map(function (r) {
        var e = ETIKET[tur(r)];
        return '<tr data-agr="' + X(r.id) + '" tabindex="0"><td>' + X(A.AGO ? A.AGO(r.created_at) : r.created_at) + '</td><td><span class="' + e[1] + '">' + e[0] + '</span></td>' +
          '<td>' + X(kes(r.soru, 140)) + '</td><td class="hide-sm">' + X(kes(r.hata || r.cevap, 140)) + '</td>' +
          '<td class="hide-sm"><small class="muted">' + X(r.model || '—') + (r.yol ? ' · ' + X(r.yol) : '') + '</small></td><td class="hide-sm">' + X(Z.kisi[r.user_id] || '—') + '</td>' +
          '<td><button type="button" class="btn ghost sm" data-agsil="' + X(r.id) + '" aria-label="Kaydı sil">sil</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  };
  var ciz = function (m) {
    var o = ozet(Z.l), mod = Object.keys(o.model).sort(function (a, b) { return o.model[b] - o.model[a]; });
    var sel = '<select class="in" id="ag-f">' + [['sorun', 'sorunlu (👎 + cevap veremedi)'], ['hata', 'cevap veremedi'], ['olumsuz', '👎 işe yaramadı'], ['olumlu', '👍 işe yaradı'], ['hepsi', 'hepsi']].map(function (x) { return '<option value="' + x[0] + '"' + (Z.f === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>';
    m.innerHTML = '<div class="sz-kpi"><div class="card"><small class="muted">Kayıt (son 500)</small><b>' + NF(o.n) + '</b></div>' +
      '<div class="card"><small class="muted">Memnuniyet (👍 / oy)</small><b>' + (o.memnun == null ? '—' : '%' + o.memnun) + '</b></div>' +
      '<div class="card"><small class="muted">👎 işe yaramadı</small><b>' + NF(o.olumsuz) + '</b></div>' +
      '<div class="card"><small class="muted">Cevap veremedi</small><b>' + NF(o.hata) + '</b></div></div>' +
      (mod.length ? '<p class="muted" style="margin:0 0 12px">Cevap veren modeller: ' + mod.map(function (k) { return X(k) + ' (' + NF(o.model[k]) + ')'; }).join(' · ') + '</p>' : '') +
      '<div class="tools"><label class="fld grow">Ara<input class="in" id="ag-q" value="' + X(Z.q) + '" placeholder="soru, cevap ya da hata"></label><label class="fld">Göster' + sel + '</label>' +
      '<button type="button" class="btn ghost sm" id="ag-csv">CSV indir</button><button type="button" class="btn ghost sm" id="ag-temiz">180 günden eskileri sil</button></div>' +
      '<div id="ag-liste">' + listeHtml() + '</div>' +
      '<p class="muted" style="margin-top:12px">Sorular öğrencilerin kendi yazdıklarıdır; yalnız Acadia\'yı iyileştirmek için kullanın ve dışarı paylaşmayın.</p>';
    var t0 = 0, yenile = function () { $('#ag-liste', m).innerHTML = listeHtml(); };
    $('#ag-q', m).addEventListener('input', function () { var v = this.value; clearTimeout(t0); t0 = setTimeout(function () { Z.q = v; yenile(); }, 200); });
    $('#ag-f', m).addEventListener('change', function () { Z.f = this.value; yenile(); });
    $('#ag-csv', m).addEventListener('click', function () {
      A.csv('acadia-geri-bildirim.csv', ['Zaman', 'Durum', 'Soru', 'Cevap', 'Hata', 'Model', 'Yol', 'Öğrenci'], suz(Z.l, Z.f, Z.q).map(function (r) { return [r.created_at, ETIKET[tur(r)][0], r.soru, r.cevap || '', r.hata || '', r.model || '', r.yol || '', Z.kisi[r.user_id] || '']; }));
    });
    $('#ag-temiz', m).addEventListener('click', async function () {
      if (!A.confirmBox('180 günden eski geri bildirimler kalıcı olarak silinsin mi?')) return;
      try { var r = await sb.rpc('acadia_geri_bildirim_temizle'); if (r.error) throw r.error; toast(NF(r.data || 0) + ' eski kayıt silindi.'); await yukle(); ciz(m); } catch (e) { toast(errMsg(e), true); }
    });
    var liste = $('#ag-liste', m);
    liste.addEventListener('click', async function (e) {
      var s = e.target.closest('[data-agsil]');
      if (s) {
        e.stopPropagation();
        if (!A.confirmBox('Bu kayıt kalıcı olarak silinsin mi?')) return;
        try { var r = await sb.from('acadia_geri_bildirim').delete().eq('id', s.getAttribute('data-agsil')); if (r.error) throw r.error; Z.l = Z.l.filter(function (x) { return x.id !== s.getAttribute('data-agsil'); }); ciz(m); toast('Silindi.'); } catch (er) { toast(errMsg(er), true); }
        return;
      }
      var tr = e.target.closest('tr[data-agr]'); if (tr) ayrinti(tr.getAttribute('data-agr'));
    });
    liste.addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-agr]'); if (tr && e.target === tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ayrinti(tr.getAttribute('data-agr')); } });
  };
  var ayrinti = function (id) {
    var r = Z.l.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var e = ETIKET[tur(r)];
    A.openDrawer('Acadia · ' + e[0],
      '<div style="display:flex;flex-direction:column;gap:12px">' +
      '<p class="muted" style="margin:0">' + X(r.created_at ? new Date(r.created_at).toLocaleString('tr-TR') : '') + ' · ' + X(Z.kisi[r.user_id] || 'öğrenci') + (r.model ? ' · ' + X(r.model) : '') + (r.yol ? ' · ' + X(r.yol) : '') + '</p>' +
      '<div class="card"><small class="muted">Soru</small><p style="white-space:pre-wrap;margin:6px 0 0">' + X(r.soru) + '</p></div>' +
      (r.hata ? '<div class="card"><small class="muted">Hata</small><p class="err" style="white-space:pre-wrap;margin:6px 0 0">' + X(r.hata) + '</p></div>' : '') +
      (r.cevap ? '<div class="card"><small class="muted">Acadia\'nın cevabı</small><p style="white-space:pre-wrap;margin:6px 0 0">' + X(r.cevap) + '</p></div>' : '') +
      '<p class="muted" style="margin:0">Supabase kayıtlarında aynı dakikadaki <b>chat-with-document</b> satırları hangi modelin, kaç karakter kaynakla cevap verdiğini gösterir.</p></div>');
  };
  A.VIEWS.acadia = async function (m) {
    try { await yukle(); }
    catch (e) {
      if (/acadia_geri_bildirim|does not exist|PGRST20|42P01/i.test(String((e && (e.message || e.code)) || ''))) {
        m.innerHTML = '<div class="card"><h2>Geri bildirim henüz kurulmadı</h2><p class="sub">Supabase → SQL Editor\'de <b>20261118c_acadia_geri_bildirim.sql</b> dosyasını çalıştır; bu sayfa kendiliğinden dolar.</p></div>';
        return;
      }
      throw e;
    }
    ciz(m);
  };
  window.AXACADIA_ADMIN_TEST = { tur: tur, suz: suz, ozet: ozet };
})();
