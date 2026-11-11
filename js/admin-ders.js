/* ==========================================================================
   Acadex · Yönetim paneli · DERS KODLARI (js/admin-ders.js) — 11.11.2026
   Hocanın derste vereceği misafir giriş kodları:
     1) Kod oluştur/kapat (not + isteğe bağlı son tarih).
     2) Canlı sayım: kaç kişi girdi, en son ne zaman.
     3) Konuk listesi: rumuz, giriş sayısı, kaçıncı haftada (lab ilerlemesinden).
   Giriş akışı istatistik.html → anonim oturum → misafir modu (acadex-ink.js).
   Yetki veritabanında: admin_ders_* fonksiyonları current_is_admin ile kapılı
   (supabase/migrations/20261111b_ders_kodu_misafir.sql).
   ========================================================================== */
(function () {
  'use strict';
  var A = window.AXADM; if (!A) return;
  var X = A.X, rpc = A.rpc, toast = A.toast, errMsg = A.errMsg, AGO = A.AGO;

  /* lab ilerlemesi 'acadex.istat.v1' biçiminde: { g1:{a,g,s}, g2:…, last }.
     Bir haftada herhangi bir iz (anlatım/görev/sınav) varsa o hafta sayılır. */
  var haftaSay = function (il) {
    if (!il || typeof il !== 'object') return 0;
    var n = 0;
    Object.keys(il).forEach(function (k) {
      if (!/^g\d+$/.test(k)) return;
      var r = il[k] || {};
      if (r.a || r.g || r.s != null) n++;
    });
    return n;
  };

  A.VIEWS.derskod = async function (m) {
    m.innerHTML = '<div class="tools"><form id="dk-f" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      '<input id="dk-kod" required maxlength="24" placeholder="KOD (ör. ISTAT2026)" style="text-transform:uppercase;font-family:ui-monospace,monospace" autocomplete="off">' +
      '<input id="dk-not" maxlength="80" placeholder="not (ör. Çarşamba 09:00 şubesi)" autocomplete="off">' +
      '<input id="dk-tarih" type="date" title="son geçerlilik (boş = süresiz)">' +
      '<button type="submit" class="btn">kod oluştur</button></form></div>' +
      '<div id="dk-list" class="list"><div class="card empty"><span class="hand">yükleniyor…</span></div></div>';
    var box = document.getElementById('dk-list');
    var yukle = async function () {
      try {
        var rows = await rpc('admin_ders_kodlari');
        if (!rows.length) { box.innerHTML = '<div class="card empty"><span class="hand">henüz kod yok</span>İlk kodu yukarıdan oluştur; öğrenciler <b>istatistik.html</b> sayfasından o kodla girer.</div>'; return; }
        box.innerHTML = rows.map(function (r) {
          var dolu = r.son_tarih && r.son_tarih < new Date().toISOString().slice(0, 10);
          return '<div class="item" data-dkid="' + X(r.id) + '"><div class="item-h">' +
            '<span class="pill ' + (r.aktif && !dolu ? 'ok' : 'warn') + '">' + (dolu ? 'süresi doldu' : r.aktif ? 'açık' : 'kapalı') + '</span>' +
            '<b style="font-family:ui-monospace,monospace;font-size:16px;letter-spacing:.08em">' + X(r.kod) + '</b>' +
            (r['not'] ? '<span class="muted">' + X(r['not']) + '</span>' : '') + '</div>' +
            '<p class="muted" style="font-size:13px"><b>' + (r.giris || 0) + '</b> giriş' +
            (r.son_giris ? ' · son: ' + AGO(r.son_giris) : '') +
            (r.son_tarih ? ' · son tarih: ' + X(r.son_tarih) : ' · süresiz') + '</p>' +
            '<div class="acts">' +
            '<button type="button" class="btn ghost sm" data-dk-tgl="' + X(r.kod) + '" data-aktif="' + r.aktif + '" data-not="' + X(r['not'] || '') + '" data-tarih="' + X(r.son_tarih || '') + '">' + (r.aktif ? 'kapat' : 'aç') + '</button>' +
            ((r.giris || 0) ? '<button type="button" class="btn ghost sm" data-dk-kim="' + X(r.id) + '">konuklar</button>' : '') +
            '</div><div class="dk-kim" hidden></div></div>';
        }).join('');
      } catch (e) { box.innerHTML = '<div class="card empty"><span class="hand">yüklenemedi</span>' + X(errMsg(e)) + '</div>'; }
    };
    document.getElementById('dk-f').addEventListener('submit', async function (e) {
      e.preventDefault();
      var kod = document.getElementById('dk-kod').value.trim().toUpperCase();
      if (!/^[A-Z0-9]{4,24}$/.test(kod)) { toast('Kod 4-24 harf/rakam olmalı (ör. ISTAT2026).', true); return; }
      try {
        await rpc('admin_ders_kodu_koy', { p_kod: kod, p_not: document.getElementById('dk-not').value.trim(), p_aktif: true, p_son_tarih: document.getElementById('dk-tarih').value || null });
        toast('“' + kod + '” hazır; tahtaya yaz: acadex.com.tr/istatistik.html');
        e.target.reset(); yukle();
      } catch (er) { toast(errMsg(er), true); }
    });
    box.addEventListener('click', async function (e) {
      var b;
      if ((b = e.target.closest('[data-dk-tgl]'))) {
        b.disabled = true;
        try {
          await rpc('admin_ders_kodu_koy', { p_kod: b.getAttribute('data-dk-tgl'), p_not: b.getAttribute('data-not'), p_aktif: b.getAttribute('data-aktif') !== 'true', p_son_tarih: b.getAttribute('data-tarih') || null });
          yukle();
        } catch (er) { b.disabled = false; toast(errMsg(er), true); }
        return;
      }
      if ((b = e.target.closest('[data-dk-kim]'))) {
        var kutu = b.closest('.item').querySelector('.dk-kim');
        if (!kutu.hidden) { kutu.hidden = true; return; }
        kutu.hidden = false; kutu.innerHTML = '<p class="muted">yükleniyor…</p>';
        try {
          var ks = await rpc('admin_ders_konuk_ozet', { p_kod_id: b.getAttribute('data-dk-kim') });
          kutu.innerHTML = ks.length ? '<ul style="margin:6px 0 0;padding-left:18px;font-size:13px">' + ks.map(function (g) {
            return '<li><b>' + X(g.rumuz || '(rumuzsuz)') + '</b>' + (g.bolum ? ' · ' + X(g.bolum) : '') + ' · ' + haftaSay(g.ilerleme) + ' haftada iz · ' + (g.giris_sayi || 1) + ' giriş · son: ' + AGO(g.son_giris) + '</li>';
          }).join('') + '</ul>' : '<p class="muted">henüz konuk yok.</p>';
        } catch (er) { kutu.innerHTML = '<p class="muted">' + X(errMsg(er)) + '</p>'; }
      }
    });
    yukle();
  };
})();
