/* ==========================================================================
   Acadex · Yönetim paneli · Finans › Kids (js/admin-finans-kids.js) — 15.11.2026
   Acadex Kids gelir modeli: kontenjan paketleri (Mini 30 · Standart 60 · Büyük 100 · Kampüs özel),
   aylık / 6 aylık / yıllık dönem, erken kayıt ve referans indirimi, teklif → protokol → imza →
   taksitli tahsilat, satış hunisi ve 31 Aralık'a kadar yol haritası.
   Alt bölümler: Pano · Teklifler · Tahsilat · Yol haritası · Ayarlar.
   Veritabanı: supabase/migrations/20261115b_kids_gelir.sql (kids_* fonksiyonları, fin_ok()).
   Tutarlar kuruş ve KDV hariç tutulur; teklifte KDV ayrı gösterilir. Sunucu hesabı esastır;
   formdaki önizleme aynı formülle (hesap) tarayıcıda yapılır.
   Protokol metni TASLAKTIR: hukuk kontrolünden geçmeden imzaya açılmamalı (belgede yazar).
   ========================================================================== */
(function () {
  'use strict';
  var A = window.AXADM; if (!A) return;
  var X = A.X, NF = A.NF, DT = A.DT, $ = A.$, $$ = A.$$, rpc = A.rpc, sb = A.sb, toast = A.toast, errMsg = A.errMsg;
  var H = null, K = { alt: null, veri: null, tfil: 'acik', hfil: 'bekleyen' };
  var DONEM = { aylik: ['Aylık', 1], '6ay': ['6 aylık', 6], yil: ['Yıllık', 12] };
  var TDUR = { taslak: ['Taslak', ''], gonderildi: ['Gönderildi', 'blue'], imzalandi: ['İmzalandı', 'ok'], kaybedildi: ['Kaybedildi', 'bad'], iptal: ['İptal', ''] };
  var ALT = [['pano', 'Pano'], ['teklif', 'Teklifler'], ['tahsilat', 'Tahsilat'], ['yol', 'Yol haritası'], ['ayar', 'Ayarlar']];
  var bugunIso = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var gunFark = function (a, b) { return Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 864e5); };

  /* ---------- fiyat hesabı: kids_teklif_hesap ile aynı formül (önizleme) ---------- */
  function hesap(ayar, paketler, p) {
    var k = paketler.filter(function (x) { return x.kod === p.paket; })[0]; if (!k) return { hata: 'Paket seçin.' };
    var ay = (DONEM[p.donem] || [])[1]; if (!ay) return { hata: 'Dönem seçin.' };
    /* 20261115c: her dönemin kendi aylık fiyatı; fark "dönem avantajı" olarak düşer */
    var aylik = k.ozel ? Number(p.ozel_aylik_kurus || 0) : Number(k.aylik_kurus);
    if (!(aylik > 0)) return { hata: 'Kampüs paketi için aylık tutarı yazın.' };
    var donemAylik = k.ozel ? aylik : Number(ay === 6 ? k.alti_ay_kurus : ay === 12 ? k.yil_kurus : k.aylik_kurus) || aylik;
    var liste = aylik * ay, kalan = liste, ind = [], t, tarih = p.tarih || bugunIso();
    if (donemAylik < aylik) { t = (aylik - donemAylik) * ay; kalan -= t; ind.push({ ad: (ay === 6 ? '6 aylık plan (ayda ' : 'Yıllık plan (ayda ') + (donemAylik / 100).toLocaleString('tr-TR') + ' TL)', yuzde: Math.round((aylik - donemAylik) * 1000 / aylik) / 10, kurus: t }); }
    var erken = !!p.erken && tarih <= ayar.erken_bitis && Number(ayar.erken_yuzde) > 0;
    if (erken) { t = Math.round(kalan * ayar.erken_yuzde / 100); kalan -= t; ind.push({ ad: 'Erken kayıt (' + DT(ayar.erken_bitis) + '\'e kadar)', yuzde: Number(ayar.erken_yuzde), kurus: t }); }
    var ref = String(p.ref_kod || '').trim().toUpperCase();
    if (ref) { t = Math.round(kalan * ayar.referans_yuzde / 100); kalan -= t; ind.push({ ad: 'Referans (' + ref + ')', yuzde: Number(ayar.referans_yuzde), kurus: t }); }
    var ek = Number(p.ek_yuzde || 0);
    if (ek < 0 || ek > Number(ayar.ek_indirim_ust)) return { hata: 'Ek indirim en çok %' + ayar.ek_indirim_ust + ' olabilir.' };
    if (ek > 0) { t = Math.round(kalan * ek / 100); kalan -= t; ind.push({ ad: 'Ek indirim', yuzde: ek, kurus: t }); }
    var net = Math.round(kalan), kdv = Math.round(net * ayar.kdv / 100), tk = Math.min(Math.max(+p.taksit || 1, 1), ay === 12 ? 3 : 1);
    return { paket: k, ay: ay, aylik: aylik, donemAylik: donemAylik, liste: liste, ind: ind, net: net, kdv: kdv, toplam: net + kdv, taksit: tk, erken: erken, aylikEs: Math.round(net / ay), kota: k.ozel ? Math.max(+p.ogrenci || 0, k.kota) : k.kota };
  }
  /* taksit takvimi: kids_takvim_kur ile aynı (eşit parçalar, kalan sonuncuya; 2 taksit 6 ay, 3 taksit 4 ay arayla) */
  function takvim(toplam, taksit, bas) {
    var parca = Math.floor(toplam / taksit), aralik = taksit === 2 ? 6 : taksit === 3 ? 4 : 0, d = new Date(bas + 'T12:00:00'), r = [];
    for (var i = 0; i < taksit; i++) { var v = new Date(d); v.setMonth(d.getMonth() + aralik * i); r.push({ sira: i + 1, vade: v.toISOString().slice(0, 10), tutar: i === taksit - 1 ? toplam - parca * (taksit - 1) : parca }); }
    return r;
  }

  /* ---------- türetilen sayılar (pano) ---------- */
  function sayilar(v) {
    var bugun = v.bugun, imzali = v.teklifler.filter(function (x) { return x.t.durum === 'imzalandi'; });
    var aktif = imzali.filter(function (x) { return x.t.bitis >= bugun; });   /* sözleşmesi süren ya da başlayacak */
    var lisansli = imzali.filter(function (x) { return x.t.baslangic <= bugun && x.t.bitis >= bugun; }).length;
    var mrr = aktif.reduce(function (s, x) { return s + x.t.net_kurus / DONEM[x.t.donem][1]; }, 0);
    var tahsil = 0, bekleyen = 0, geciken = 0, gecikenN = 0, hedefeKadar = 0;
    imzali.forEach(function (x) { x.tahsilat.forEach(function (h) {
      if (h.odendi_at) { tahsil += h.tutar_kurus; if (h.odendi_at.slice(0, 10) <= v.ayar.hedef_tarih) hedefeKadar += h.tutar_kurus; }
      else { bekleyen += h.tutar_kurus; if (h.vade < bugun) { geciken += h.tutar_kurus; gecikenN++; } }
    }); });
    var tamOdendi = imzali.filter(function (x) { return x.tahsilat.length && x.tahsilat.every(function (h) { return h.odendi_at; }); }).length;
    var huni = [
      ['İstek', v.istekler.filter(function (b) { return b.durum === 'bekliyor'; }).length + v.istekler.filter(function (b) { return b.durum !== 'bekliyor'; }).length],
      ['Arandı', v.istekler.filter(function (b) { return b.durum !== 'bekliyor' && b.durum !== 'reddedildi'; }).length],
      ['Teklif gönderildi', v.teklifler.filter(function (x) { return x.t.durum === 'gonderildi' || x.t.durum === 'imzalandi' || x.t.durum === 'kaybedildi'; }).length],
      ['İmzalandı', imzali.length], ['Ödendi', tamOdendi]];
    var imzaHedefe = imzali.filter(function (x) { return (x.t.imza_at || '').slice(0, 10) <= v.ayar.hedef_tarih; }).length;
    return { imzali: imzali, aktif: aktif, lisansli: lisansli, mrr: mrr, tahsil: tahsil, bekleyen: bekleyen, geciken: geciken, gecikenN: gecikenN, huni: huni, imzaHedefe: imzaHedefe, hedefeKadar: hedefeKadar, tamOdendi: tamOdendi };
  }

  /* ---------- çerçeve ---------- */
  async function yukle() { K.veri = await rpc('kids_gelir_ozet'); return K.veri; }
  async function ciz(box) {
    if (!K.alt) K.alt = H.lsGet('kids.alt', 'pano');
    try { await yukle(); }
    catch (e) {
      if (/kids_gelir_ozet|PGRST202|42883|does not exist/i.test(String(e && (e.message + ' ' + e.code)))) { box.innerHTML = '<div class="card ink fin-setup"><span class="hand">kurulum</span><h2 class="disp">Kids gelir modeli henüz kurulmadı</h2><p class="sub">Supabase → SQL Editor\'de <b>supabase/migrations/20261115b_kids_gelir.sql</b> dosyasını çalıştır; bu sayfa kendiliğinden dolar.</p></div>'; return; }
      throw e;
    }
    box.innerHTML = '<div class="fkd-ust"><div class="fkd-alt" role="tablist" aria-label="Kids finans">' + ALT.map(function (a) { return '<button type="button" role="tab" data-fkalt="' + a[0] + '" aria-selected="' + (K.alt === a[0]) + '">' + a[1] + '</button>'; }).join('') + '</div>' +
      '<button type="button" class="btn blue sm" data-fk-yeni>+ Yeni teklif</button></div><div id="fkd-govde"></div>';
    box.querySelectorAll('[data-fkalt]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); K.alt = b.getAttribute('data-fkalt'); H.lsSet('kids.alt', K.alt); ciz(box); }; });
    box.querySelector('[data-fk-yeni]').onclick = function (e) { e.stopPropagation(); teklifForm(null, null, box); };
    var g = $('#fkd-govde', box);
    ({ pano: pano, teklif: teklifler, tahsilat: tahsilat, yol: yol, ayar: ayarlar })[K.alt](g, box);
  }

  /* ================= PANO ================= */
  function pano(g, box) {
    var v = K.veri, a = v.ayar, s = sayilar(v), kalanGun = gunFark(a.hedef_tarih, v.bugun);
    var cocuk = v.okullar.filter(function (o) { return o.aktif && o.kaynak === 'teklif'; }).reduce(function (t, o) { return t + o.ogrenci; }, 0);
    var pIm = a.hedef_kres ? Math.min(1, s.imzaHedefe / a.hedef_kres) : 0, pTa = a.hedef_tahsilat_kurus ? Math.min(1, s.hedefeKadar / a.hedef_tahsilat_kurus) : 0;
    /* aylık tahsilat: bu ay + 11 ay; tahsil edilen (mavi) ve vadesi gelen (sarı) */
    var bas = H.ym(new Date(v.bugun + 'T12:00:00')), aylar = [];
    for (var i = 0; i < 12; i++) aylar.push({ m: H.addMonth(bas, i), a: 0, b: 0 });
    s.imzali.forEach(function (x) { x.tahsilat.forEach(function (h) {
      var m = (h.odendi_at || h.vade).slice(0, 7), r = aylar.filter(function (z) { return z.m === m; })[0];
      if (r) { if (h.odendi_at) r.a += h.tutar_kurus / 100; else r.b += h.tutar_kurus / 100; }
    }); });
    var pd = {}; s.imzali.forEach(function (x) { var ad = (v.paketler.filter(function (p) { return p.kod === x.t.paket; })[0] || {}).ad || x.t.paket; pd[ad] = (pd[ad] || 0) + 1; });
    var hmax = Math.max.apply(null, [1].concat(s.huni.map(function (h) { return h[1]; })));
    g.innerHTML = '<div class="kpis fin-kpis">' +
      H.kpi('İmzalı kreş', NF(s.imzali.length), s.lisansli + ' kreş şu an lisanslı · ' + (s.aktif.length - s.lisansli) + ' başlayacak · ' + NF(cocuk) + ' çocuk') +
      H.kpi('Aylık tekrarlayan gelir', H.TL(s.mrr), 'süren ve başlayacak sözleşmeler · yıllık karşılığı ' + H.TL(s.mrr * 12) + ' · KDV hariç') +
      H.kpi('Tahsil edilen', H.TL(s.tahsil), 'KDV dahil · ' + s.tamOdendi + ' kreş tamamen ödedi') +
      H.kpi('Bekleyen tahsilat', H.TL(s.bekleyen), s.gecikenN ? '<b class="err">' + s.gecikenN + ' taksit gecikti · ' + H.TL(s.geciken) + '</b>' : 'geciken yok', s.gecikenN ? 'alert' : '') + '</div>' +
      '<div class="grid fkd-iki"><div class="card"><h2>' + DT(a.hedef_tarih) + ' hedefi <span class="pill ' + (kalanGun < 0 ? 'bad' : kalanGun <= 14 ? 'warn' : 'blue') + '">' + (kalanGun >= 0 ? kalanGun + ' gün kaldı' : 'süre doldu') + '</span></h2>' +
        hedefCubuk('İmza', s.imzaHedefe + ' / ' + a.hedef_kres + ' kreş', pIm) + hedefCubuk('Tahsilat', H.TL(s.hedefeKadar) + ' / ' + H.TL(a.hedef_tahsilat_kurus), pTa) +
        '<p class="sub">Hedefler Ayarlar\'dan değişir. Tahsilat KDV dahil, imza tarihine göre sayılır.</p></div>' +
      '<div class="card"><h2>Satış hunisi</h2><div class="fkd-huni">' + s.huni.map(function (h, i) {
        var once = i ? s.huni[i - 1][1] : 0;
        return '<div class="fkd-h"><span>' + h[0] + '</span><i style="--w:' + Math.max(4, Math.round(h[1] / hmax * 100)) + '%"><b>' + NF(h[1]) + '</b></i><em>' + (i && once && h[1] <= once ? '%' + Math.round(h[1] / once * 100) : '') + '</em></div>';
      }).join('') + '</div><p class="sub">İstekler Kids › İstekler\'den gelir; teklif gönderilince istek "teklif" aşamasına geçer.</p></div></div>' +
      '<div class="card"><h2>12 aylık tahsilat</h2><p class="sub"><i class="fkd-lej" style="background:#2F6BFF"></i>tahsil edilen <i class="fkd-lej" style="background:#E8B53A"></i>vadesi gelecek (imzalı tekliflerin takvimi)</p>' +
        H.barChart(aylar.map(function (z) { return { label: H.monthName(z.m), short: H.monthShort(z.m), a: z.a, b: z.b }; }), { two: true, fmt: function (n) { return H.TL(n * 100); }, aria: '12 aylık tahsilat', emptyText: 'ilk imzalı teklifle burada aylık tahsilat görünür' }) + '</div>' +
      '<div class="grid fkd-iki"><div class="card"><h2>Paket dağılımı</h2>' + (Object.keys(pd).length ? H.hbars(Object.keys(pd).map(function (k2) { return { label: k2, v: pd[k2] }; }), function (n) { return n + ' kreş'; }) : '<p class="sub">Henüz imzalı teklif yok.</p>') + '</div>' +
      '<div class="card"><h2>Fiyat listesi <span class="muted">(KDV hariç)</span></h2>' + fiyatTablo(v) + '</div></div>';
  }
  function hedefCubuk(ad, metin, p) { return '<div class="fkd-hedef"><div><b>' + ad + '</b><span>' + metin + '</span></div><i><em style="width:' + Math.round(p * 100) + '%"></em></i></div>'; }
  function fiyatTablo(v) {
    var a = v.ayar;
    return '<div class="tbl-w"><table class="fkd-fiyat"><thead><tr><th>Paket</th><th>Aylık plan</th><th>6 aylık plan</th><th>Yıllık plan</th></tr></thead><tbody>' +
      v.paketler.filter(function (p) { return p.aktif; }).map(function (p) {
        if (p.ozel) return '<tr><td><b>' + X(p.ad) + '</b><div class="muted">' + p.kota + '+ çocuk</div></td><td colspan="3" class="muted">Kreşe özel fiyat (teklifte yazılır)</td></tr>';
        var c = function (d) { var h = hesap(a, v.paketler, { paket: p.kod, donem: d }); return '<b>' + H.TL(h.donemAylik) + '</b>/ay<div class="muted">' + (h.ay > 1 ? h.ay + ' ay: ' + H.TL(h.net) : 'her ay') + '</div>'; };
        return '<tr><td><b>' + X(p.ad) + '</b><div class="muted">' + p.kota + ' çocuğa kadar</div></td><td>' + c('aylik') + '</td><td>' + c('6ay') + '</td><td>' + c('yil') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ================= TEKLİFLER ================= */
  function teklifler(g, box) {
    var v = K.veri, fil = K.tfil, acikIstek = v.istekler.filter(function (b) { return b.durum === 'bekliyor' || b.durum === 'arandi'; });
    var tekBasvuru = {}; v.teklifler.forEach(function (x) { if (x.t.basvuru_id) tekBasvuru[x.t.basvuru_id] = 1; });
    var L = v.teklifler.filter(function (x) { return fil === 'hepsi' || (fil === 'acik' ? (x.t.durum === 'taslak' || x.t.durum === 'gonderildi') : x.t.durum === fil); });
    g.innerHTML = (acikIstek.length ? '<div class="card fkd-istekler"><h2>Teklif bekleyen istekler <span class="pill warn">' + acikIstek.length + '</span></h2><div class="fkd-ist">' + acikIstek.slice(0, 12).map(function (b) {
      return '<div class="fkd-ist-k"><b>' + X(b.kres_ad) + '</b><span class="muted">' + X([b.yetkili_ad, b.ilce, b.ogrenci_sayi ? b.ogrenci_sayi + ' çocuk' : ''].filter(Boolean).join(' · ')) + '</span>' +
        (tekBasvuru[b.id] ? '<span class="pill blue">teklifi var</span>' : '<button type="button" class="btn sm" data-fk-ist="' + b.id + '">teklif hazırla</button>') + '</div>';
    }).join('') + '</div></div>' : '') +
      '<div class="fkd-filtre" role="group" aria-label="Teklif durumu">' + [['acik', 'Açık'], ['imzalandi', 'İmzalandı'], ['kaybedildi', 'Kaybedildi'], ['hepsi', 'Hepsi']].map(function (f) {
        return '<button type="button" class="chip' + (fil === f[0] ? ' on' : '') + '" data-fk-fil="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      (L.length ? '<div class="tbl-w"><table class="fkd-tablo"><thead><tr><th>No</th><th>Kreş</th><th>Paket · dönem</th><th>Tutar (KDV hariç)</th><th>Durum</th><th></th></tr></thead><tbody>' + L.map(function (x) {
        var t = x.t, d = TDUR[t.durum], pk = (v.paketler.filter(function (p) { return p.kod === t.paket; })[0] || {}).ad || t.paket, ac = t.durum === 'taslak' || t.durum === 'gonderildi';
        return '<tr><td class="mono">#' + t.no + '</td><td><b>' + X(t.kres_ad) + '</b><div class="muted">' + X([t.yetkili_ad, t.eposta].filter(Boolean).join(' · ')) + '</div></td>' +
          '<td>' + X(pk) + ' · ' + DONEM[t.donem][0] + (t.taksit > 1 ? ' · ' + t.taksit + ' taksit' : '') + '<div class="muted">' + DT(t.baslangic) + ' – ' + DT(t.bitis) + '</div></td>' +
          '<td><b>' + H.TL(t.net_kurus) + '</b><div class="muted">KDV dahil ' + H.TL(t.toplam_kurus) + '</div></td>' +
          '<td><span class="pill ' + d[1] + '">' + d[0] + (x.okul_kod ? ' · ' + X(x.okul_kod) : '') + '</span></td>' +
          '<td class="fkd-eylem"><button type="button" class="btn ghost sm" data-fk-yaz="teklif" data-id="' + t.id + '">teklif</button><button type="button" class="btn ghost sm" data-fk-yaz="protokol" data-id="' + t.id + '">protokol</button>' +
          (ac ? '<button type="button" class="btn ghost sm" data-fk-duz="' + t.id + '">düzenle</button>' + (t.durum === 'taslak' ? '<button type="button" class="btn ghost sm" data-fk-gon="' + t.id + '">gönderildi</button>' : '') +
            '<button type="button" class="btn sm" data-fk-imza="' + t.id + '">imzalandı</button><button type="button" class="btn ghost sm" data-fk-kay="' + t.id + '">kaybedildi</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="card empty"><span class="hand">teklif yok</span>Üstteki “+ Yeni teklif” ya da bir istekteki “teklif hazırla” ile başlayın.</div>');
    var bul = function (id) { return v.teklifler.filter(function (x) { return x.t.id === id; })[0]; };
    g.querySelectorAll('[data-fk-fil]').forEach(function (b) { b.onclick = function () { K.tfil = b.getAttribute('data-fk-fil'); teklifler(g, box); }; });
    g.querySelectorAll('[data-fk-ist]').forEach(function (b) { b.onclick = function () { teklifForm(null, v.istekler.filter(function (x) { return x.id === b.getAttribute('data-fk-ist'); })[0], box); }; });
    g.querySelectorAll('[data-fk-duz]').forEach(function (b) { b.onclick = function () { teklifForm(bul(b.getAttribute('data-fk-duz')).t, null, box); }; });
    g.querySelectorAll('[data-fk-yaz]').forEach(function (b) { b.onclick = function () { yazdir(b.getAttribute('data-fk-yaz'), bul(b.getAttribute('data-id'))); }; });
    g.querySelectorAll('[data-fk-gon]').forEach(function (b) { b.onclick = async function () { try { await rpc('kids_teklif_durum', { p_id: b.getAttribute('data-fk-gon'), p_durum: 'gonderildi' }); toast('Gönderildi olarak işaretlendi.'); ciz(box); } catch (e) { toast(errMsg(e), true); } }; });
    g.querySelectorAll('[data-fk-kay]').forEach(function (b) { b.onclick = async function () { if (!A.confirmBox('Teklif kaybedildi olarak işaretlensin mi?')) return; try { await rpc('kids_teklif_durum', { p_id: b.getAttribute('data-fk-kay'), p_durum: 'kaybedildi' }); toast('Kaybedildi.'); ciz(box); } catch (e) { toast(errMsg(e), true); } }; });
    g.querySelectorAll('[data-fk-imza]').forEach(function (b) { b.onclick = function () { imzaForm(bul(b.getAttribute('data-fk-imza')).t, box); }; });
  }

  /* teklif formu: canlı önizleme (fiyat dökümü + taksit takvimi) */
  function teklifForm(t, ist, box) {
    var v = K.veri, a = v.ayar, src = t || {}, i = ist || {};
    var f0 = { kres_ad: src.kres_ad || i.kres_ad || '', yetkili_ad: src.yetkili_ad || i.yetkili_ad || '', eposta: src.eposta || i.eposta || '', tel: src.tel || i.tel || '', il: src.il || i.il || '', ilce: src.ilce || i.ilce || '',
      ogrenci: src.ogrenci || i.ogrenci_sayi || '', paket: src.paket || paketOner(v.paketler, i.ogrenci_sayi), donem: src.donem || 'yil', taksit: src.taksit || 1, erken: t ? src.erken : v.bugun <= a.erken_bitis,
      ref_kod: src.ref_kod || '', ek_yuzde: src.ek_yuzde || 0, baslangic: src.baslangic || v.bugun, notlar: src.notlar || '', ozel: src.paket === 'kampus' ? src.aylik_kurus / 100 : '' };
    var alan = function (ad, etiket, deger, ek) { return '<label class="fld">' + etiket + '<input class="in" name="' + ad + '" value="' + X(deger == null ? '' : deger) + '"' + (ek || '') + '></label>'; };
    A.openDrawer(t ? 'Teklif #' + t.no + ' · düzenle' : 'Yeni teklif',
      '<form id="fkd-tf" class="fin-form fkd-form" novalidate>' +
      '<fieldset><legend>Kreş</legend>' + alan('kres_ad', 'Kreş adı', f0.kres_ad, ' required maxlength="120"') + '<div class="fkd-2">' + alan('yetkili_ad', 'Yetkili', f0.yetkili_ad, ' maxlength="80"') + alan('eposta', 'E-posta', f0.eposta, ' type="email" maxlength="120"') + '</div>' +
        '<div class="fkd-3">' + alan('tel', 'Telefon', f0.tel, ' maxlength="20"') + alan('il', 'İl', f0.il, ' maxlength="40"') + alan('ilce', 'İlçe', f0.ilce, ' maxlength="60"') + '</div></fieldset>' +
      '<fieldset><legend>Paket ve dönem</legend><div class="fkd-paketler">' + v.paketler.filter(function (p) { return p.aktif; }).map(function (p) {
        return '<label class="fkd-pk"><input type="radio" name="paket" value="' + p.kod + '"' + (f0.paket === p.kod ? ' checked' : '') + '><span><b>' + X(p.ad) + '</b><small>' + (p.ozel ? p.kota + '+ çocuk · özel' : p.kota + ' çocuk · ' + H.TL(p.yil_kurus) + '–' + H.TL(p.aylik_kurus) + '/ay') + '</small></span></label>'; }).join('') + '</div>' +
        '<div class="fkd-donem">' + Object.keys(DONEM).map(function (d) { return '<label class="fkd-dn"><input type="radio" name="donem" value="' + d + '"' + (f0.donem === d ? ' checked' : '') + '><span>' + DONEM[d][0] + ' <small data-fk-dn="' + d + '"></small>' + '</span></label>'; }).join('') + '</div>' +
        '<div class="fkd-3">' + alan('ogrenci', 'Çocuk sayısı', f0.ogrenci, ' inputmode="numeric" maxlength="4"') + '<label class="fld">Taksit<select class="in" name="taksit"><option value="1">Tek seferde</option><option value="2">2 taksit</option><option value="3">3 taksit</option></select></label>' +
        alan('ozel', 'Kampüs aylık tutarı (TL)', f0.ozel, ' inputmode="decimal"') + '</div>' + alan('baslangic', 'Başlangıç', f0.baslangic, ' type="date"') + '</fieldset>' +
      '<fieldset><legend>İndirimler</legend><label class="fkd-chk"><input type="checkbox" name="erken"' + (f0.erken ? ' checked' : '') + '> Erken kayıt (−%' + Number(a.erken_yuzde) + ', ' + DT(a.erken_bitis) + '\'e kadar)</label>' +
        '<div class="fkd-2">' + alan('ref_kod', 'Referans okul kodu', f0.ref_kod, ' maxlength="13" placeholder="AY-2026" style="text-transform:uppercase"') + alan('ek_yuzde', 'Ek indirim % (en çok ' + Number(a.ek_indirim_ust) + ')', f0.ek_yuzde, ' inputmode="decimal"') + '</div></fieldset>' +
      '<label class="fld">Not (teklifte görünür)<textarea class="in" name="notlar" rows="2" maxlength="1000">' + X(f0.notlar) + '</textarea></label>' +
      '<div class="fkd-onizle" id="fkd-oz" aria-live="polite"></div><p class="err" id="fkd-tf-h" role="alert"></p>' +
      '<div class="acts"><button type="submit" class="btn">' + (t ? 'kaydet' : 'teklifi oluştur') + '</button></div></form>');
    var f = $('#fkd-tf'); f.taksit.value = String(f0.taksit);
    var oku = function () {
      return { paket: (f.querySelector('[name=paket]:checked') || {}).value, donem: (f.querySelector('[name=donem]:checked') || {}).value, taksit: +f.taksit.value, ogrenci: f.ogrenci.value.trim(),
        ozel_aylik_kurus: f.ozel.value.trim() ? H.kurus(f.ozel.value) : '', erken: f.erken.checked, ref_kod: f.ref_kod.value.trim(), ek_yuzde: f.ek_yuzde.value.trim() ? String(f.ek_yuzde.value).replace(',', '.') : '0', baslangic: f.baslangic.value || v.bugun,
        tarih: t ? String(t.created_at).slice(0, 10) : v.bugun };
    };
    var goster = function () {
      var p = oku(), h = hesap(a, v.paketler, p), kampus = p.paket === 'kampus';
      f.querySelectorAll('[data-fk-dn]').forEach(function (s) { var hd = hesap(a, v.paketler, Object.assign({}, p, { donem: s.getAttribute('data-fk-dn'), erken: false, ref_kod: '', ek_yuzde: 0 })); s.textContent = hd.hata ? '' : 'ayda ' + H.TL(hd.donemAylik); });
      f.ozel.closest('.fld').hidden = !kampus; f.taksit.disabled = p.donem !== 'yil'; if (p.donem !== 'yil') f.taksit.value = '1';
      if (h.hata) { $('#fkd-oz').innerHTML = '<p class="muted">' + X(h.hata) + '</p>'; return; }
      var tk = takvim(h.toplam, h.taksit, p.baslangic), uyari = p.ogrenci && +p.ogrenci > h.kota ? '<p class="err">Çocuk sayısı paketin kontenjanını (' + h.kota + ') aşıyor; bir üst paketi seçin.</p>' : '';
      $('#fkd-oz').innerHTML = uyari + '<table class="fkd-dok"><tr><td>' + X(h.paket.ad) + ' · ' + DONEM[p.donem][0] + ' (' + H.TL(h.aylik) + ' × ' + h.ay + ' ay)</td><td>' + H.TL(h.liste) + '</td></tr>' +
        h.ind.map(function (x) { return '<tr class="fkd-ind"><td>' + X(x.ad) + ' −%' + x.yuzde + '</td><td>−' + H.TL(x.kurus) + '</td></tr>'; }).join('') +
        '<tr class="fkd-net"><td>Tutar (KDV hariç)</td><td>' + H.TL(h.net) + '</td></tr><tr><td>KDV %' + Number(a.kdv) + '</td><td>' + H.TL(h.kdv) + '</td></tr><tr class="fkd-top"><td>Toplam</td><td>' + H.TL(h.toplam) + '</td></tr></table>' +
        '<p class="muted">Aylık karşılığı ' + H.TL(h.aylikEs) + ' (KDV hariç)</p><div class="fkd-takvim">' + tk.map(function (x) { return '<span><b>' + x.sira + '. ödeme</b>' + DT(x.vade) + '<em>' + H.TL(x.tutar) + '</em></span>'; }).join('') + '</div>';
    };
    f.addEventListener('input', goster); f.addEventListener('change', goster); goster();
    f.onsubmit = async function (e) {
      e.preventDefault(); var p = oku();
      if (f.kres_ad.value.trim().length < 2) { $('#fkd-tf-h').textContent = 'Kreş adını yazın.'; return; }
      var gov = Object.assign({ id: t ? t.id : null, basvuru_id: t ? t.basvuru_id : (ist ? ist.id : null), kres_ad: f.kres_ad.value.trim(), yetkili_ad: f.yetkili_ad.value.trim(), eposta: f.eposta.value.trim(), tel: f.tel.value.trim(), il: f.il.value.trim(), ilce: f.ilce.value.trim(), notlar: f.notlar.value }, p);
      delete gov.tarih;
      try { var r = await rpc('kids_teklif_kaydet', { p: gov }); A.closeDrawer(); toast('Teklif #' + r.no + ' kaydedildi.'); K.alt = 'teklif'; K.tfil = 'acik'; H.lsSet('kids.alt', 'teklif'); ciz(box); }
      catch (er) { $('#fkd-tf-h').textContent = errMsg(er); }
    };
  }
  function paketOner(paketler, n) { n = +n || 0; var s = paketler.filter(function (p) { return p.aktif && !p.ozel && p.kota >= n; }).sort(function (x, y) { return x.kota - y.kota; })[0]; return s ? s.kod : (n ? 'kampus' : 'standart'); }
  function kodOner(ad) {
    var harf = { 'ç': 'C', 'ğ': 'G', 'ı': 'I', 'i': 'I', 'ö': 'O', 'ş': 'S', 'ü': 'U' };
    var k = String(ad || '').toLocaleLowerCase('tr').replace(/[çğıiöşü]/g, function (c) { return harf[c]; }).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w && !/^(KRES|KRESI|ANAOKULU|OKULU|COCUK|YUVASI|OZEL|VE)$/.test(w); })[0] || 'KRES';
    return k.slice(0, 6) + '-' + new Date().getFullYear();
  }
  function imzaForm(t, box) {
    A.openDrawer('İmzalandı · ' + t.kres_ad, '<form id="fkd-if" class="fin-form" novalidate><p>Protokol imzalandıysa okul <b>lisanslı</b> açılır: ' + DT(t.baslangic) + ' – ' + DT(t.bitis) + ', ' + t.kota + ' çocuk kontenjanı. Tahsilat takvimi Tahsilat bölümüne düşer.</p>' +
      '<label class="fld">Okul kodu<input class="in mono" name="kod" value="' + X(kodOner(t.kres_ad)) + '" required pattern="[A-Z0-9]{2,8}-[0-9]{4}"></label><p class="err" id="fkd-if-h" role="alert"></p><div class="acts"><button type="submit" class="btn">okulu aç ve şifreleri üret</button></div></form>');
    $('#fkd-if').onsubmit = async function (e) {
      e.preventDefault(); var kod = this.kod.value.trim().toUpperCase();
      try {
        var r = await rpc('kids_teklif_imzala', { p_id: t.id, p_kod: kod });
        var metin = 'Merhaba ' + (t.yetkili_ad || '') + ',\n\n' + t.kres_ad + ' için Acadex Kids hesabınız açıldı (' + DT(t.baslangic) + ' – ' + DT(t.bitis) + ').\n\nKreş yönetimi: acadex.com.tr/kids/#yonetim\nOkul kodu: ' + r.okul_kod + '\nYönetici şifresi: ' + r.yonetici_sifre + '\nÖğretmen ortak şifresi: ' + r.ogretmen_sifre + '\n\nİlk adımlar: sınıf açın, öğrenci listesini yapıştırın, kartları yazdırın.';
        A.openDrawer('Okul açıldı · ' + r.okul_kod, '<div class="kd-sifre-k"><span class="mono">Yönetici</span><b class="mono">' + X(r.yonetici_sifre) + '</b></div><div class="kd-sifre-k"><span class="mono">Öğretmen</span><b class="mono">' + X(r.ogretmen_sifre) + '</b></div>' +
          '<p class="err">Şifreler yalnız şimdi görünür. Aşağıdaki mesajı kreş yetkilisine iletin.</p><textarea class="in kd-mesaj" rows="10" readonly>' + X(metin) + '</textarea><div class="acts"><button type="button" class="btn" id="fkd-kopya">mesajı kopyala</button></div>');
        $('#fkd-kopya').onclick = function () { try { navigator.clipboard.writeText(metin).then(function () { toast('Kopyalandı.'); }); } catch (er) { toast('Kopyalanamadı; metni seçip kopyalayın.', true); } };
        ciz(box);
      } catch (er) { $('#fkd-if-h').textContent = errMsg(er); }
    };
  }

  /* ================= TAHSİLAT ================= */
  function tahsilat(g, box) {
    var v = K.veri, fil = K.hfil, bugun = v.bugun, satir = [];
    v.teklifler.filter(function (x) { return x.t.durum === 'imzalandi'; }).forEach(function (x) { x.tahsilat.forEach(function (h) { satir.push({ h: h, x: x }); }); });
    satir.sort(function (p, r) { return p.h.vade < r.h.vade ? -1 : p.h.vade > r.h.vade ? 1 : 0; });
    var ayBas = bugun.slice(0, 7);
    var L = satir.filter(function (s) { return fil === 'hepsi' || (fil === 'geciken' ? !s.h.odendi_at && s.h.vade < bugun : fil === 'bu_ay' ? s.h.vade.slice(0, 7) === ayBas : fil === 'odenen' ? !!s.h.odendi_at : !s.h.odendi_at); });
    var gec = satir.filter(function (s) { return !s.h.odendi_at && s.h.vade < bugun; }).length;
    g.innerHTML = '<div class="fkd-filtre" role="group" aria-label="Tahsilat">' + [['bekleyen', 'Bekleyen'], ['geciken', 'Geciken' + (gec ? ' (' + gec + ')' : '')], ['bu_ay', 'Bu ay'], ['odenen', 'Ödenen'], ['hepsi', 'Hepsi']].map(function (f) {
      return '<button type="button" class="chip' + (fil === f[0] ? ' on' : '') + '" data-fk-hfil="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      (L.length ? '<div class="tbl-w"><table class="fkd-tablo"><thead><tr><th>Vade</th><th>Kreş</th><th>Ödeme</th><th>Tutar (KDV dahil)</th><th>Durum</th><th></th></tr></thead><tbody>' + L.map(function (s) {
        var h = s.h, gecik = !h.odendi_at && h.vade < bugun, gun = gecik ? gunFark(bugun, h.vade) : 0;
        return '<tr class="' + (gecik ? 'fkd-gec' : '') + '"><td class="mono">' + DT(h.vade) + '</td><td><b>' + X(s.x.t.kres_ad) + '</b><div class="muted">#' + s.x.t.no + (s.x.okul_kod ? ' · ' + X(s.x.okul_kod) : '') + '</div></td>' +
          '<td>' + h.sira + ' / ' + s.x.t.taksit + '</td><td><b>' + H.TL(h.tutar_kurus) + '</b></td>' +
          '<td>' + (h.odendi_at ? '<span class="pill ok">ödendi · ' + DT(h.odendi_at.slice(0, 10)) + (h.yontem ? ' · ' + X(h.yontem) : '') + '</span>' : gecik ? '<span class="pill bad">' + gun + ' gün gecikti</span>' : '<span class="pill">bekliyor</span>') + '</td>' +
          '<td class="fkd-eylem">' + (h.odendi_at ? '<button type="button" class="btn ghost sm" data-fk-geri="' + h.id + '">geri al</button>' :
            '<select class="in sm" data-fk-yon="' + h.id + '" aria-label="Ödeme yöntemi"><option value="havale">Havale/EFT</option><option value="kart">Kart</option><option value="nakit">Nakit</option><option value="diger">Diğer</option></select><button type="button" class="btn sm" data-fk-ode="' + h.id + '">ödendi</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="card empty"><span class="hand">kayıt yok</span>İmzalanan tekliflerin ödeme takvimi burada görünür.</div>');
    g.querySelectorAll('[data-fk-hfil]').forEach(function (b) { b.onclick = function () { K.hfil = b.getAttribute('data-fk-hfil'); tahsilat(g, box); }; });
    g.querySelectorAll('[data-fk-ode]').forEach(function (b) { b.onclick = async function () { var id = b.getAttribute('data-fk-ode'); try { await rpc('kids_tahsilat_isaretle', { p_id: id, p_odendi: true, p_yontem: g.querySelector('[data-fk-yon="' + id + '"]').value }); toast('Ödendi olarak işaretlendi.'); ciz(box); } catch (e) { toast(errMsg(e), true); } }; });
    g.querySelectorAll('[data-fk-geri]').forEach(function (b) { b.onclick = async function () { if (!A.confirmBox('Ödeme geri alınsın mı?')) return; try { await rpc('kids_tahsilat_isaretle', { p_id: b.getAttribute('data-fk-geri'), p_odendi: false, p_yontem: '' }); toast('Geri alındı.'); ciz(box); } catch (e) { toast(errMsg(e), true); } }; });
  }

  /* ================= YOL HARİTASI ================= */
  function yol(g, box) {
    var v = K.veri, G = v.gorevler, bugun = v.bugun;
    if (!G.length) {
      g.innerHTML = '<div class="card"><h2>31 Aralık\'a kadar yol haritası</h2><p class="sub">Fiyat onayından ilk imzalara ve Aralık kapanış raporuna kadar 17 iş, tarih ve sorumluyla Finans › Görevler\'e eklenir (başlıkları “Kids · ” ile başlar). Sonra buradan ve Görevler sekmesinden takip edilir.</p><div class="acts"><button type="button" class="btn blue" data-fk-yolkur>yol haritasını ekle</button></div></div>';
      g.querySelector('[data-fk-yolkur]').onclick = async function () { try { var n = await rpc('kids_gelir_yol_kur'); toast(n + ' görev eklendi.'); ciz(box); } catch (e) { toast(errMsg(e), true); } };
      return;
    }
    var bitti = G.filter(function (x) { return x.status === 'bitti'; }).length, hafta = {};
    G.forEach(function (x) { var d = new Date((x.due_on || bugun) + 'T12:00:00'), pz = new Date(d); pz.setDate(d.getDate() - ((d.getDay() + 6) % 7)); var k2 = pz.toISOString().slice(0, 10); (hafta[k2] = hafta[k2] || []).push(x); });
    g.innerHTML = '<div class="card fkd-yol-ust"><h2>31 Aralık\'a kadar yol haritası</h2><div class="fkd-hedef"><div><b>İlerleme</b><span>' + bitti + ' / ' + G.length + ' iş bitti</span></div><i><em style="width:' + Math.round(bitti / G.length * 100) + '%"></em></i></div></div>' +
      Object.keys(hafta).sort().map(function (k2) {
        var son = new Date(k2 + 'T12:00:00'); son.setDate(son.getDate() + 6);
        return '<div class="card fkd-hafta"><h3>' + DT(k2) + ' – ' + DT(son.toISOString().slice(0, 10)) + '</h3><ul>' + hafta[k2].map(function (x) {
          var gec = x.status !== 'bitti' && x.due_on && x.due_on < bugun;
          return '<li class="' + (x.status === 'bitti' ? 'fkd-bitti' : '') + (gec ? ' fkd-gec' : '') + '"><label><input type="checkbox" data-fk-gor="' + x.id + '"' + (x.status === 'bitti' ? ' checked' : '') + '><span><b>' + X(x.title.replace(/^Kids · /, '')) + '</b><small>' + X(x.detail || '') + '</small></span></label>' +
            '<em>' + (x.due_on ? DT(x.due_on) : '') + (x.assignee ? ' · ' + X(x.assignee) : '') + (gec ? ' · gecikti' : '') + '</em></li>';
        }).join('') + '</ul></div>';
      }).join('');
    g.querySelectorAll('[data-fk-gor]').forEach(function (c) { c.onchange = async function () {
      var st = c.checked ? 'bitti' : 'yapilacak';
      try { await H.q(sb.from('fin_tasks').update({ status: st, done_at: c.checked ? new Date().toISOString() : null }).eq('id', c.getAttribute('data-fk-gor'))); ciz(box); } catch (e) { c.checked = !c.checked; toast(errMsg(e), true); }
    }; });
  }

  /* ================= AYARLAR ================= */
  function ayarlar(g, box) {
    var v = K.veri, a = v.ayar, sayi = function (ad, etiket, deger, ek) { return '<label class="fld">' + etiket + '<input class="in" name="' + ad + '" value="' + X(deger) + '"' + (ek || ' inputmode="decimal"') + '></label>'; };
    g.innerHTML = '<div class="grid fkd-iki"><div class="card"><h2>Paketler <span class="muted">(aylık, KDV hariç)</span></h2><div class="tbl-w"><table class="fkd-tablo"><thead><tr><th>Paket</th><th>Kontenjan</th><th>Aylık plan</th><th>6 aylık plan</th><th>Yıllık plan</th><th>Açık</th><th></th></tr></thead><tbody>' +
      v.paketler.map(function (p) { return '<tr data-pk="' + p.kod + '"><td><input class="in sm" name="ad" value="' + X(p.ad) + '" maxlength="40"></td><td><input class="in sm" name="kota" value="' + p.kota + '" inputmode="numeric"></td>' + (p.ozel ? '<td colspan="3"><span class="muted">teklifte yazılır</span></td>' : ['aylik_kurus', 'alti_ay_kurus', 'yil_kurus'].map(function (n) { return '<td><input class="in sm" name="' + n + '" value="' + p[n] / 100 + '" inputmode="decimal" aria-label="' + X(p.ad) + ' ' + n + '"></td>'; }).join('')) + '<td><input type="checkbox" name="ak"' + (p.aktif ? ' checked' : '') + '></td><td><button type="button" class="btn ghost sm" data-fk-pk>kaydet</button></td></tr>'; }).join('') +
      '</tbody></table></div><p class="sub">Tutarlar TL/ay, KDV hariç. Uzun dönemin aylık fiyatı kısa dönemden yüksek olamaz. Değişiklik yeni tekliflere uygulanır.</p></div>' +
      '<div class="card"><h2>İndirim, KDV ve hedef</h2><form id="fkd-af" class="fin-form fkd-ayar" novalidate>' +
      '<div class="fkd-2">' + sayi('erken_yuzde', 'Erken kayıt %', Number(a.erken_yuzde)) + sayi('erken_bitis', 'Erken kayıt bitişi', a.erken_bitis, ' type="date"') + '</div>' +
      '<div class="fkd-3">' + sayi('referans_yuzde', 'Referans %', Number(a.referans_yuzde)) + sayi('ek_indirim_ust', 'Ek indirim üst sınırı %', Number(a.ek_indirim_ust)) + sayi('kdv', 'KDV %', Number(a.kdv)) + '</div>' +
      '<div class="fkd-3">' + sayi('hedef_tarih', 'Hedef tarihi', a.hedef_tarih, ' type="date"') + sayi('hedef_kres', 'Hedef imza (kreş)', a.hedef_kres, ' inputmode="numeric"') + sayi('hedef_tl', 'Hedef tahsilat (TL)', a.hedef_tahsilat_kurus / 100) + '</div>' +
      '<p class="err" id="fkd-af-h" role="alert"></p><div class="acts"><button type="submit" class="btn">kaydet</button></div></form></div></div>';
    g.querySelectorAll('[data-fk-pk]').forEach(function (b) { b.onclick = async function () {
      var tr = b.closest('tr'), al = function (n) { var i = tr.querySelector('[name=' + n + ']'); return i ? H.kurus(i.value) : 0; };
      try { await rpc('kids_paket_kaydet', { p_kod: tr.getAttribute('data-pk'), p_ad: tr.querySelector('[name=ad]').value.trim(), p_kota: +tr.querySelector('[name=kota]').value, p_aylik_kurus: al('aylik_kurus'), p_alti_ay_kurus: al('alti_ay_kurus'), p_yil_kurus: al('yil_kurus'), p_aktif: tr.querySelector('[name=ak]').checked }); toast('Paket kaydedildi.'); ciz(box); } catch (e) { toast(errMsg(e), true); }
    }; });
    $('#fkd-af', g).onsubmit = async function (e) {
      e.preventDefault(); var f = this, n = function (x) { return String(f[x].value).replace(',', '.'); };
      try { await rpc('kids_gelir_ayar_kaydet', { p: { erken_yuzde: n('erken_yuzde'), erken_bitis: f.erken_bitis.value, referans_yuzde: n('referans_yuzde'), ek_indirim_ust: n('ek_indirim_ust'), kdv: n('kdv'), hedef_tarih: f.hedef_tarih.value, hedef_kres: f.hedef_kres.value, hedef_tahsilat_kurus: H.kurus(f.hedef_tl.value) } }); toast('Ayarlar kaydedildi.'); ciz(box); }
      catch (er) { $('#fkd-af-h').textContent = errMsg(er); }
    };
  }

  /* ================= YAZDIR: teklif ve protokol (A4) ================= */
  function belgeHtml(tur, x) {
    var t = x.t, v = K.veri, pk = (v.paketler.filter(function (p) { return p.kod === t.paket; })[0] || {}).ad || t.paket, tk = x.tahsilat.length ? x.tahsilat : takvim(t.toplam_kurus, t.taksit, t.baslangic).map(function (r) { return { sira: r.sira, vade: r.vade, tutar_kurus: r.tutar }; });
    var dok = '<table class="b-dok"><tr><td>' + X(pk) + ' paketi · ' + DONEM[t.donem][0] + ' (' + H.TL(t.aylik_kurus, true) + ' × ' + DONEM[t.donem][1] + ' ay)</td><td>' + H.TL(t.liste_kurus, true) + '</td></tr>' +
      (t.indirimler || []).map(function (i) { return '<tr><td>' + X(i.ad) + ' (−%' + i.yuzde + ')</td><td>−' + H.TL(i.kurus, true) + '</td></tr>'; }).join('') +
      '<tr class="b-k"><td>Tutar (KDV hariç)</td><td>' + H.TL(t.net_kurus, true) + '</td></tr><tr><td>KDV</td><td>' + H.TL(t.kdv_kurus, true) + '</td></tr><tr class="b-k"><td>Genel toplam</td><td>' + H.TL(t.toplam_kurus, true) + '</td></tr></table>';
    var odeme = '<table class="b-dok"><tr><th>Ödeme</th><th>Vade</th><th>Tutar (KDV dahil)</th></tr>' + tk.map(function (h) { return '<tr><td>' + h.sira + '. ödeme</td><td>' + DT(h.vade) + '</td><td>' + H.TL(h.tutar_kurus, true) + '</td></tr>'; }).join('') + '</table>';
    var kres = '<p><b>' + X(t.kres_ad) + '</b>' + (t.yetkili_ad ? '<br>Yetkili: ' + X(t.yetkili_ad) : '') + (t.eposta ? '<br>' + X(t.eposta) : '') + (t.tel ? ' · ' + X(t.tel) : '') + ([t.ilce, t.il].filter(Boolean).length ? '<br>' + X([t.ilce, t.il].filter(Boolean).join(' / ')) : '') + '</p>';
    var css = '@page{size:A4;margin:18mm 16mm}*{box-sizing:border-box}body{margin:0;font:11pt/1.5 Nunito,system-ui,sans-serif;color:#1B2440}h1{font:800 22pt/1.1 "Baloo 2",Nunito,sans-serif;margin:0 0 4pt}h2{font:800 12.5pt Nunito,sans-serif;margin:14pt 0 4pt;padding-bottom:3pt;border-bottom:1.5pt solid #1B2440}' +
      '.b-ust{display:flex;justify-content:space-between;align-items:flex-start;gap:12pt;margin-bottom:10pt}.b-marka{font:800 16pt "Baloo 2",sans-serif}.b-marka i{font-style:normal;color:#E5484D}.b-no{text-align:right;font-size:10pt;color:#4B5675}' +
      '.b-dok{width:100%;border-collapse:collapse;margin:4pt 0}.b-dok td,.b-dok th{padding:5pt 6pt;border-bottom:.6pt solid #CFC8B6;text-align:left}.b-dok td:last-child,.b-dok th:last-child{text-align:right;white-space:nowrap}.b-k td{font-weight:800}' +
      '.b-taslak{margin:0 0 10pt;padding:6pt 10pt;border:1.5pt dashed #C9483B;color:#C9483B;font-weight:800;font-size:10pt}ol.b-mad{padding-left:16pt}ol.b-mad li{margin:3pt 0}.b-imza{display:grid;grid-template-columns:1fr 1fr;gap:24pt;margin-top:26pt}.b-imza div{border-top:1pt solid #1B2440;padding-top:4pt;font-size:10pt}' +
      '.arac{position:sticky;top:0;display:flex;gap:10px;align-items:center;padding:8px 14px;background:#1B2440;color:#fff;font-size:13px}.arac button{margin-left:auto;padding:7px 16px;border:0;border-radius:99px;background:#FFD23F;font-weight:800;cursor:pointer}@media print{.arac{display:none}}main{max-width:178mm;margin:0 auto;padding:10pt 0}';
    var bas = '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' + (tur === 'teklif' ? 'Teklif' : 'Protokol') + ' #' + t.no + ' · ' + X(t.kres_ad) + '</title><style>' + css + '</style></head><body><div class="arac">' + (tur === 'teklif' ? 'Teklif' : 'Protokol taslağı') + ' #' + t.no + '<button onclick="print()">Yazdır / PDF</button></div><main>' +
      '<div class="b-ust"><div><div class="b-marka">Acadex <i>Kids</i></div><div style="font-size:9.5pt;color:#4B5675">acadex.com.tr/kids · destek@acadex.com.tr</div></div><div class="b-no">' + (tur === 'teklif' ? 'Teklif' : 'Protokol') + ' no: <b>' + t.no + '</b><br>Tarih: ' + DT(String(t.created_at).slice(0, 10)) + '</div></div>';
    if (tur === 'teklif') {
      var gecerli = new Date(String(t.created_at).slice(0, 10) + 'T12:00:00'); gecerli.setDate(gecerli.getDate() + 15);
      return bas + '<h1>Kreşinize özel teklif</h1>' + kres + '<h2>Kapsam</h2><p>' + X(pk) + ' paketi: ' + t.kota + ' çocuğa kadar kullanım. Bütün konular ve oyunlar, üç yaş dünyası (Minikler, Kâşifler, Yıldızlar), öğretmen paneli, kreş yönetim paneli, öğrenci giriş kartları ve “Bugün ne öğrendik?” veli kartları dahildir.</p>' +
        '<p>Süre: ' + DT(t.baslangic) + ' – ' + DT(t.bitis) + ' (' + DONEM[t.donem][0].toLocaleLowerCase('tr') + ').</p><h2>Fiyat</h2>' + dok + '<h2>Ödeme takvimi</h2>' + odeme +
        (t.notlar ? '<h2>Not</h2><p>' + X(t.notlar).replace(/\n/g, '<br>') + '</p>' : '') + '<p style="margin-top:14pt;font-size:10pt;color:#4B5675">Bu teklif ' + DT(gecerli.toISOString().slice(0, 10)) + ' tarihine kadar geçerlidir. Fiyatlar Türk lirasıdır.' + (t.erken ? ' Erken kayıt indirimi ' + DT(v.ayar.erken_bitis) + ' tarihine kadar imzalanan protokollerde geçerlidir.' : '') + '</p></main></body></html>';
    }
    return bas + '<p class="b-taslak">TASLAK — hukuk danışmanı kontrolünden geçmeden imzaya açmayın. Köşeli parantezli alanları doldurun.</p><h1>Acadex Kids hizmet protokolü</h1>' +
      '<h2>1. Taraflar</h2><p><b>Hizmet veren:</b> [Acadex şirket unvanı], [adres], [vergi dairesi / no] (“Acadex”).<br><b>Hizmet alan:</b> ' + X(t.kres_ad) + (t.yetkili_ad ? ', yetkili: ' + X(t.yetkili_ad) : '') + ', [adres], [vergi dairesi / no] (“Kreş”).</p>' +
      '<h2>2. Konu ve kapsam</h2><p>Bu protokol, Acadex Kids çevrim içi İngilizce oyun platformunun Kreş tarafından ' + X(pk) + ' paketiyle, en çok <b>' + t.kota + ' çocuk</b> için kullanımına ilişkindir. Kapsam: bütün konular ve oyunlar, üç yaş dünyası, öğretmen paneli, kreş yönetim paneli, öğrenci giriş kartları (QR dahil), veli kartları ve e-posta desteği.</p>' +
      '<h2>3. Süre</h2><p>' + DT(t.baslangic) + ' – ' + DT(t.bitis) + ' (' + DONEM[t.donem][0].toLocaleLowerCase('tr') + ' dönem). Dönem sonunda taraflar yeni dönem için yazılı olarak anlaşır.</p>' +
      '<h2>4. Ücret</h2>' + dok + '<h2>5. Ödeme takvimi</h2>' + odeme + '<p>Ödemeler [banka / IBAN] hesabına, açıklamaya protokol numarası yazılarak yapılır. Fatura [imza / ödeme] tarihinde düzenlenir. Vadesinde ödenmeyen taksit için Acadex yazılı hatırlatma yapar; ' + '[15]' + ' gün içinde ödenmezse hizmeti askıya alabilir.</p>' +
      '<h2>6. Kişisel verilerin korunması</h2><ol class="b-mad"><li>Çocuklara ilişkin kişisel veriler bakımından <b>Kreş veri sorumlusu</b>, Acadex <b>veri işleyen</b>dir; Acadex verileri yalnız hizmetin sunulması için ve Kreş’in talimatıyla işler.</li><li>İşlenen veriler en az düzeydedir: çocuğun adı ve soyadının baş harfi, sınıfı, platformdaki ilerlemesi. Fotoğraf istenmez; ses kayıtları cihazdan çıkmaz.</li><li>Velilerin aydınlatılması ve gerekli açık rızaların alınması Kreş’in sorumluluğundadır.</li><li>Protokol sona erdiğinde Kreş’in talebiyle veriler [30] gün içinde silinir ya da Kreş’e teslim edilir.</li><li>Acadex, verilere yetkisiz erişimi önlemek için uygun teknik ve idari tedbirleri alır; bir ihlal fark ettiğinde Kreş’i gecikmeksizin bilgilendirir.</li></ol>' +
      '<h2>7. Tarafların yükümlülükleri</h2><ol class="b-mad"><li>Acadex, platformu makul süreklilikle çalışır tutar, planlı bakımları önceden duyurur ve e-posta desteği verir.</li><li>Kreş, giriş bilgilerini (okul kodu, yönetici ve öğretmen şifreleri) korur ve yalnız kendi öğrencileri ve personeli için kullanır; kontenjanı aşan kullanım için paket yükseltilir.</li><li>Platformun içeriği, çizimleri ve sesleri Acadex’e aittir; çoğaltılamaz ve üçüncü kişilere sunulamaz.</li></ol>' +
      '<h2>8. Fesih</h2><p>Taraflardan biri yükümlülüklerini yerine getirmezse diğer taraf [15] gün süre vererek yazılı ihtarda bulunur; aykırılık giderilmezse protokolü feshedebilir. [Peşin ödenen kullanılmamış dönem için iade koşulları buraya yazılır.]</p>' +
      '<h2>9. Uyuşmazlık</h2><p>Bu protokolden doğan uyuşmazlıklarda [Ankara] mahkemeleri ve icra daireleri yetkilidir.</p>' +
      (t.notlar ? '<h2>10. Özel koşullar</h2><p>' + X(t.notlar).replace(/\n/g, '<br>') + '</p>' : '') +
      '<div class="b-imza"><div>Acadex adına<br>Ad soyad / imza / tarih</div><div>' + X(t.kres_ad) + ' adına<br>Ad soyad / imza / kaşe / tarih</div></div></main></body></html>';
  }
  function yazdir(tur, x) {
    var w = window.open('', '_blank'); if (!w) { toast('Yeni sekme açılamadı; açılır pencere engelini kaldırın.', true); return; }
    w.document.open(); w.document.write(belgeHtml(tur, x)); w.document.close();
  }

  window.AXFIN_KIDS = function (box, yardimci) { H = yardimci; return ciz(box); };
  window.AXFIN_KIDS_TEST = { hesap: hesap, takvim: takvim, sayilar: sayilar, kodOner: kodOner, paketOner: paketOner, belgeHtml: function (tur, x, veri) { K.veri = veri; return belgeHtml(tur, x); }, kur: function (h) { H = h; } };
})();
