/* ==========================================================================
   Acadex · Yönetim paneli · ACADEX KIDS (js/admin-kids.js) — 10.11.2026
   Kids'i satın alan okulların yönetimi:
     1) Okul + lisans: kod (AY-2026), lisans tarihleri, 100 öğrenci kotası,
        34.900 TL + KDV ücret, ödeme durumu, okulun öğretmen şifresi.
     2) Toplu sınıf ve öğrenci: ad listesi yapıştırılır; her çocuğa kimlik
        (AY-2026-007), hayvan resmi ve iki resimli şifre verilir.
     3) Giriş kartı: A4'e 8 kart, kesme çizgili, yazdırılır.
   KVKK: çocuğun yalnız adı ve soyadının baş harfi tutulur ("Defne K.");
   sunucu da kısaltır. Yetki veritabanında (supabase/migrations/20261110_kids_yonetim.sql):
   bütün kids_* fonksiyonları admin_guard() ile yöneticiye açıktır.
   Çizimler js/kids-ciz.js (Acadex Kids çocuk uygulamasıyla aynı dosya).
   ========================================================================== */
(function () {
  'use strict';
  var A = window.AXADM; if (!A) return;
  var X = A.X, NF = A.NF, DT = A.DT, $ = A.$, $$ = A.$$, rpc = A.rpc, toast = A.toast, errMsg = A.errMsg;
  var C = window.KIDS_CIZ;

  var BANT = { minik: 'Minikler · 3-4 yaş', kasif: 'Kâşifler · 5-6 yaş', yildiz: 'Yıldızlar · 7-10 yaş' };
  var HAYVAN = { tavsan: 'Tavşan', ayi: 'Ayı', kedi: 'Kedi', civciv: 'Civciv', panda: 'Panda', kurbaga: 'Kurbağa', tilki: 'Tilki', kopek: 'Köpek' };
  var RESIM = { kedi: 'Kedi', elma: 'Elma', top: 'Top', balik: 'Balık', cicek: 'Çiçek', ay: 'Ay', araba: 'Araba', kus: 'Kuş', cilek: 'Çilek' };
  var ODEME = { bekliyor: ['Ödeme bekliyor', 'warn'], odendi: ['Ödendi', 'ok'], deneme: ['Deneme', 'blue'] };
  var SITE = 'acadex.com.tr/kids';

  /* ---------- saf yardımcılar (tests/admin-kids.js de kullanır) ---------- */
  var KATLA = { 'ç': 'C', 'Ç': 'C', 'ğ': 'G', 'Ğ': 'G', 'ı': 'I', 'İ': 'I', 'i': 'I', 'ö': 'O', 'Ö': 'O', 'ş': 'S', 'Ş': 'S', 'ü': 'U', 'Ü': 'U', 'â': 'A', 'Â': 'A', 'î': 'I', 'û': 'U' };
  var katla = function (s) { return String(s || '').replace(/[çÇğĞıİiöÖşŞüÜâÂîû]/g, function (c) { return KATLA[c]; }).toUpperCase().replace(/[^A-Z0-9 ]/g, ' '); };
  var GENEL = /^(KRES|KRESI|ANAOKULU|ANAOKUL|ILKOKULU|ILKOKUL|OKULU|OKUL|OKULLARI|KOLEJI|KOLEJ|VE|COCUK|YUVASI|EGITIM|KURUMLARI|OZEL|GUNDUZ|BAKIMEVI|MERKEZI)$/;
  /* "Ay Kreşi ve Anaokulu" → AY-2026; "Mavi Bulut Anaokulu" → MB-2026; "Papatya" → PAP-2026 */
  var kodOner = function (ad, yil) {
    var w = katla(ad).split(/\s+/).filter(function (x) { return x && !GENEL.test(x); });
    var k = w.length === 0 ? 'OK' : w.length === 1 ? w[0].slice(0, 3) : w.slice(0, 3).map(function (x) { return x[0]; }).join('');
    if (w.length === 1 && w[0].length <= 2) k = w[0];
    if (k.length < 2) k = (k + 'K').slice(0, 2);
    return k.slice(0, 8) + '-' + (yil || new Date().getFullYear());
  };
  /* sunucudaki kids_ad_kisalt ile aynı: "Ayşe Nur Kaya" → "Ayşe Nur K." */
  var adKisalt = function (s) {
    var w = String(s || '').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '';
    var r = w.length === 1 ? w[0] : w.slice(0, -1).join(' ') + ' ' + w[w.length - 1].charAt(0).toLocaleUpperCase('tr') + '.';
    return r.slice(0, 40);
  };
  var adlariAyikla = function (metin) { return String(metin || '').split(/[\n;]+/).map(function (x) { return x.replace(/^\s*\d+[.)\-\s]+/, '').replace(/\t.*/, ''); }).map(adKisalt).filter(Boolean); };
  var gunKaldi = function (bit, bugun) { var b = new Date(bit + 'T00:00:00'), t = bugun ? new Date(bugun) : new Date(); t.setHours(0, 0, 0, 0); return Math.round((b - t) / 864e5); };
  var isoGun = function (d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var birYilSonra = function (iso) { var p = iso.split('-'); return isoGun(new Date(+p[0] + 1, +p[1] - 1, +p[2] - 1)); };
  var TL = function (k) { return (Number(k || 0) / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }); };
  window.AXKIDS_TEST = { kodOner: kodOner, adKisalt: adKisalt, adlariAyikla: adlariAyikla, gunKaldi: gunKaldi, birYilSonra: birYilSonra };

  var K = { okul: null, sinif: null, ara: '', liste: null, d: null, secili: {} };
  var notReady = function (e) { return /kids_|PGRST202|PGRST205|42883|42P01|does not exist/i.test(String((e && (e.message + ' ' + e.code)) || '')); };
  var kurulum = function () {
    return '<div class="card ink kd-kurulum"><span class="hand">kurulum</span><h2 class="disp">Acadex Kids bölümü henüz kurulmadı</h2>' +
      '<p class="sub">Supabase → SQL Editor\'de <b>supabase/migrations/20261110_kids_yonetim.sql</b> dosyasını çalıştır; bu sayfa kendiliğinden dolar.</p></div>';
  };
  var lisansPill = function (o) {
    var g = gunKaldi(o.lisans_bit);
    if (!o.aktif) return '<span class="pill">kapalı</span>';
    if (g < 0) return '<span class="pill bad">süresi doldu</span>';
    if (g <= 30) return '<span class="pill warn">' + g + ' gün kaldı</span>';
    return '<span class="pill ok">etkin</span>';
  };
  var kotaCubuk = function (n, kota) {
    var p = Math.min(100, Math.round(n / Math.max(1, kota) * 100));
    return '<span class="kd-kota' + (p >= 100 ? ' dolu' : p >= 90 ? ' az' : '') + '"><i style="width:' + p + '%"></i></span><span class="kd-kota-t">' + NF(n) + ' / ' + NF(kota) + '</span>';
  };
  var ciz = function (fn, ad) { try { return C ? C[fn](ad) : ''; } catch (e) { return ''; } };

  /* =========================== okul listesi =========================== */
  var liste = async function (m) {
    K.liste = await rpc('kids_okul_liste');
    var L = K.liste, aktif = L.filter(function (o) { return o.aktif; });
    var ogr = aktif.reduce(function (s, o) { return s + o.ogrenci; }, 0), kota = aktif.reduce(function (s, o) { return s + o.kota; }, 0);
    var gelir = L.filter(function (o) { return o.odeme === 'odendi'; }).reduce(function (s, o) { return s + Number(o.ucret_kurus); }, 0);
    var bitecek = aktif.filter(function (o) { var g = gunKaldi(o.lisans_bit); return g <= 30; }).length;
    var q = katla(K.ara).trim(), goster = L.filter(function (o) { return !q || katla(o.ad + ' ' + o.kod + ' ' + o.ilce).indexOf(q) >= 0; });
    m.innerHTML = '<div class="kpis">' +
      '<div class="kpi"><div class="k">okul</div><div class="v">' + NF(aktif.length) + '</div><div class="s">etkin lisans' + (L.length > aktif.length ? ' · ' + NF(L.length - aktif.length) + ' kapalı' : '') + '</div></div>' +
      '<div class="kpi" style="--w:' + (kota ? Math.round(ogr / kota * 100) : 0) + '%"><div class="k">öğrenci</div><div class="v">' + NF(ogr) + '</div><div class="s">' + NF(kota) + ' kotanın kullanılan kısmı</div></div>' +
      '<div class="kpi"><div class="k">tahsil edilen</div><div class="v">' + TL(gelir) + '</div><div class="s">ödendi işaretli lisanslar, KDV hariç</div></div>' +
      '<div class="kpi' + (bitecek ? ' alert' : '') + '"><div class="k">30 gün içinde</div><div class="v">' + NF(bitecek) + '</div><div class="s">süresi dolan ya da dolacak</div></div></div>' +
      '<div class="tools"><label class="fld grow">Ara<input class="in" id="kd-ara" type="search" placeholder="okul adı, kod ya da ilçe" value="' + X(K.ara) + '"></label>' +
      '<a class="btn ghost" href="/kids/" target="_blank" rel="noopener">Kids sitesini aç ↗</a><button type="button" class="btn" id="kd-yeni">+ okul ekle</button></div>' +
      (goster.length ? '<div class="tbl-w"><table class="kd-tbl"><thead><tr><th>Okul</th><th>Kod</th><th>Öğrenci</th><th>Lisans bitişi</th><th class="hide-sm">Ödeme</th><th></th></tr></thead><tbody>' +
        goster.map(function (o) {
          return '<tr data-okul="' + o.id + '" tabindex="0"><td><b>' + X(o.ad) + '</b><div class="muted kd-k">' + X([o.ilce, o.il].filter(Boolean).join(', ')) + ' · ' + NF(o.sinif) + ' sınıf</div></td>' +
            '<td class="mono">' + X(o.kod) + '</td><td class="kd-kota-h">' + kotaCubuk(o.ogrenci, o.kota) + '</td>' +
            '<td>' + DT(o.lisans_bit) + ' ' + lisansPill(o) + '</td><td class="hide-sm"><span class="pill ' + ODEME[o.odeme][1] + '">' + ODEME[o.odeme][0] + '</span></td>' +
            '<td><button type="button" class="btn ghost sm" data-okul="' + o.id + '">aç</button></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="card empty"><span class="hand">' + (L.length ? 'eşleşen okul yok' : 'henüz okul yok') + '</span>' + (L.length ? '' : 'Kids lisansı satılan ilk okulu “okul ekle” ile kaydedin.') + '</div>');
    $('#kd-ara', m).addEventListener('input', function () { var v = this.value, pos = this.selectionStart; K.ara = v; liste(m).then(function () { var i = $('#kd-ara', m); i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} }); });
    $('#kd-yeni', m).addEventListener('click', function () { okulForm(null, m); });
    $$('tr[data-okul]', m).forEach(function (tr) {
      var ac = function () { K.okul = tr.getAttribute('data-okul'); K.sinif = null; K.secili = {}; A.VIEWS.kids(m); };
      tr.addEventListener('click', ac); tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') ac(); });
    });
  };

  /* =========================== okul formu (çekmece) =========================== */
  var okulForm = function (o, m) {
    var yeni = !o, bas = o ? o.lisans_bas : isoGun();
    o = o || { kod: '', ad: '', ilce: '', il: 'Ankara', yetkili_ad: '', yetkili_tel: '', lisans_bas: bas, lisans_bit: birYilSonra(bas), kota: 100, ucret_kurus: 3490000, odeme: 'bekliyor', notlar: '', aktif: true };
    var f = function (ad, lbl, v, ek) { return '<label class="fld">' + lbl + '<input class="in" name="' + ad + '" value="' + X(v == null ? '' : v) + '"' + (ek || '') + '></label>'; };
    A.openDrawer(yeni ? 'Yeni Kids okulu' : o.ad,
      '<form id="kd-of" class="kd-form" novalidate>' +
      f('ad', 'Okulun adı', o.ad, ' required maxlength="120" autocomplete="off"') +
      '<div class="kd-2">' + f('kod', 'Okul kodu <small>velinin bir kez yazacağı kod</small>', o.kod, ' required maxlength="13" class="in mono" autocomplete="off" spellcheck="false"') + f('ilce', 'İlçe', o.ilce) + '</div>' +
      '<div class="kd-2">' + f('yetkili_ad', 'Yetkili kişi', o.yetkili_ad) + f('yetkili_tel', 'Yetkili telefonu', o.yetkili_tel, ' type="tel" inputmode="tel"') + '</div>' +
      '<div class="kd-2">' + f('lisans_bas', 'Lisans başlangıcı', o.lisans_bas, ' type="date" required') + f('lisans_bit', 'Lisans bitişi', o.lisans_bit, ' type="date" required') + '</div>' +
      '<div class="kd-2">' + f('kota', 'Öğrenci kotası', o.kota, ' type="number" min="1" max="5000" required') + f('ucret', 'Ücret (TL, KDV hariç)', Number(o.ucret_kurus) / 100, ' type="number" min="0" step="100"') + '</div>' +
      '<label class="fld">Ödeme<select class="in" name="odeme">' + Object.keys(ODEME).map(function (k) { return '<option value="' + k + '"' + (k === o.odeme ? ' selected' : '') + '>' + ODEME[k][0] + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld">Not <small>yalnız Acadex ekibi görür</small><textarea class="in" name="notlar" rows="3" maxlength="1000">' + X(o.notlar) + '</textarea></label>' +
      (yeni ? '' : '<label class="kd-cb"><input type="checkbox" name="aktif"' + (o.aktif ? ' checked' : '') + '> Lisans açık (kapatılırsa okul listede “kapalı” görünür)</label>') +
      '<p class="err" id="kd-of-h" role="alert"></p><div class="acts"><button type="submit" class="btn">' + (yeni ? 'okulu kaydet' : 'değişiklikleri kaydet') + '</button><button type="button" class="btn ghost" id="kd-of-v">vazgeç</button></div></form>');
    var F = $('#kd-of'), elle = !yeni;
    var oner = function () { if (!elle) F.elements.kod.value = kodOner(F.elements.ad.value, (F.elements.lisans_bas.value || isoGun()).slice(0, 4)); };
    F.elements.ad.addEventListener('input', oner);
    F.elements.kod.addEventListener('input', function () { elle = true; this.value = this.value.toUpperCase(); });
    F.elements.lisans_bas.addEventListener('change', function () { if (yeni && this.value) F.elements.lisans_bit.value = birYilSonra(this.value); oner(); });
    $('#kd-of-v').addEventListener('click', A.closeDrawer);
    F.addEventListener('submit', async function (e) {
      e.preventDefault(); var h = $('#kd-of-h'), v = function (n) { return F.elements[n].value.trim(); };
      if (v('ad').length < 2) { h.textContent = 'Okulun adını yazın.'; F.elements.ad.focus(); return; }
      if (!/^[A-Z0-9]{2,8}-[0-9]{4}$/.test(v('kod'))) { h.textContent = 'Okul kodu AY-2026 biçiminde olmalı (2-8 harf ya da rakam, tire, 4 rakam).'; F.elements.kod.focus(); return; }
      if (!v('lisans_bas') || !v('lisans_bit') || v('lisans_bit') < v('lisans_bas')) { h.textContent = 'Lisans bitişi başlangıçtan önce olamaz.'; return; }
      var b = F.querySelector('[type=submit]'); b.disabled = true; h.textContent = '';
      var p = { kod: v('kod'), ad: v('ad'), ilce: v('ilce'), il: o.il || 'Ankara', yetkili_ad: v('yetkili_ad'), yetkili_tel: v('yetkili_tel'), lisans_bas: v('lisans_bas'), lisans_bit: v('lisans_bit'),
        kota: parseInt(v('kota'), 10) || 100, ucret_kurus: Math.round(parseFloat(v('ucret').replace(',', '.') || '0') * 100), odeme: v('odeme'), notlar: F.elements.notlar.value };
      if (!yeni) { p.id = o.id; p.aktif = F.elements.aktif.checked; }
      try {
        var r = await rpc('kids_okul_kaydet', { p: p });
        A.closeDrawer(); toast(yeni ? r.ad + ' eklendi. Şimdi sınıfları ekleyin.' : 'Kaydedildi.');
        K.okul = r.id; if (yeni) { K.sinif = null; K.secili = {}; } A.VIEWS.kids(m);
      } catch (er) { h.textContent = errMsg(er); b.disabled = false; }
    });
    setTimeout(function () { F.elements.ad.focus(); }, 60);
  };

  /* =========================== okul ayrıntısı =========================== */
  var detay = async function (m) {
    K.d = await rpc('kids_okul_detay', { p_okul: K.okul });
    var o = K.d.okul, S = K.d.siniflar, G = K.d.ogrenciler;
    if (!K.sinif || !S.some(function (s) { return s.id === K.sinif; })) K.sinif = S.length ? S[0].id : null;
    var s = S.filter(function (x) { return x.id === K.sinif; })[0], ogr = G.filter(function (g) { return g.sinif_id === K.sinif; });
    var kalan = o.kota - o.ogrenci, gk = gunKaldi(o.lisans_bit);
    m.innerHTML = '<button type="button" class="lnk kd-geri" id="kd-geri">← bütün okullar</button>' +
      '<div class="card ink kd-bas"><div class="kd-bas-sol"><span class="mono kd-kod">' + X(o.kod) + '</span><h2 class="disp">' + X(o.ad) + '</h2>' +
        '<p class="muted">' + X([o.ilce, o.il].filter(Boolean).join(', ')) + (o.yetkili_ad ? ' · ' + X(o.yetkili_ad) : '') + (o.yetkili_tel ? ' · ' + X(o.yetkili_tel) : '') + '</p>' +
        '<div class="kd-etiket">' + lisansPill(o) + ' <span class="pill ' + ODEME[o.odeme][1] + '">' + ODEME[o.odeme][0] + ' · ' + TL(o.ucret_kurus) + '</span> <span class="pill">' + DT(o.lisans_bas) + ' → ' + DT(o.lisans_bit) + (gk >= 0 ? ' (' + NF(gk) + ' gün)' : '') + '</span></div></div>' +
        '<div class="kd-bas-sag"><div class="kd-kota-b">' + kotaCubuk(o.ogrenci, o.kota) + '<small>' + (kalan > 0 ? NF(kalan) + ' öğrenci daha eklenebilir' : 'kota dolu') + '</small></div>' +
        '<div class="acts"><button type="button" class="btn ghost sm" id="kd-duz">okulu düzenle</button><button type="button" class="btn ghost sm" id="kd-sifre">' + (o.sifre_var ? 'öğretmen şifresini yenile' : 'öğretmen şifresi oluştur') + '</button>' +
        '<button type="button" class="btn sm" id="kd-tum"' + (G.some(function (g) { return g.aktif; }) ? '' : ' disabled') + '>bütün kartları yazdır</button></div></div></div>' +
      '<div class="kd-siniflar" role="tablist" aria-label="Sınıflar">' + S.map(function (x) {
        return '<button type="button" role="tab" aria-selected="' + (x.id === K.sinif) + '" data-sinif="' + x.id + '"><b>' + X(x.ad) + '</b><small>' + X(BANT[x.bant].split(' · ')[0]) + ' · ' + NF(x.ogrenci) + '</small></button>';
      }).join('') + '<button type="button" class="kd-sinif-ekle" id="kd-sekle">+ sınıf ekle</button></div>' +
      (s ? sinifHTML(o, s, ogr, kalan) : '<div class="card empty"><span class="hand">önce bir sınıf ekleyin</span>Sınıfın adını ve yaş dünyasını seçin; öğrencileri sonra ad listesiyle eklersiniz.</div>');

    $('#kd-geri', m).addEventListener('click', function () { K.okul = null; A.VIEWS.kids(m); });
    $('#kd-duz', m).addEventListener('click', function () { okulForm(o, m); });
    $('#kd-sifre', m).addEventListener('click', function () { sifreYenile(o, m); });
    $('#kd-tum', m).addEventListener('click', function () { kartBas(o, G.filter(function (g) { return g.aktif; }), S); });
    $('#kd-sekle', m).addEventListener('click', function () { sinifForm(o, null, m); });
    $$('[data-sinif]', m).forEach(function (b) { b.addEventListener('click', function () { K.sinif = b.getAttribute('data-sinif'); K.secili = {}; detay(m); }); });
    if (s) sinifBagla(m, o, s, ogr, kalan);
  };

  var sinifHTML = function (o, s, ogr, kalan) {
    return '<div class="kd-sinif"><div class="kd-sinif-ust"><div><h3 class="disp">' + X(s.ad) + '</h3><span class="muted">' + X(BANT[s.bant]) + ' · ' + NF(ogr.length) + ' öğrenci</span></div>' +
      '<div class="acts"><button type="button" class="btn ghost sm" id="kd-sduz">sınıfı düzenle</button><button type="button" class="btn ghost sm" id="kd-ssil">sınıfı sil</button>' +
      '<button type="button" class="btn sm" id="kd-sbas"' + (ogr.some(function (g) { return g.aktif; }) ? '' : ' disabled') + '>bu sınıfın kartlarını yazdır</button></div></div>' +
      '<div class="grid kd-g">' +
      '<div class="card kd-ekle"><h3>Öğrenci ekle</h3><p class="sub">Okulun listesini yapıştırın; her satıra bir çocuk. Yalnız ad ve soyadın baş harfi kaydedilir.</p>' +
        '<textarea class="in" id="kd-adlar" rows="7" placeholder="Defne Kaya&#10;Ali Yılmaz&#10;Zeynep Ak" spellcheck="false"' + (kalan > 0 ? '' : ' disabled') + '></textarea>' +
        '<div class="kd-onizle" id="kd-onizle" aria-live="polite"></div>' +
        '<button type="button" class="btn" id="kd-ekle" disabled>öğrencileri ekle</button></div>' +
      '<div class="kd-liste">' + (ogr.length ? ogrTablo(ogr) : '<div class="card empty"><span class="hand">bu sınıfta öğrenci yok</span>Soldaki kutuya ad listesini yapıştırın.</div>') + '</div></div></div>';
  };
  var ogrTablo = function (ogr) {
    return '<div class="kd-toplu" id="kd-toplu" hidden><b id="kd-ssay">0</b> seçili <button type="button" class="btn ghost sm" data-toplu="bas">kart yazdır</button><button type="button" class="btn ghost sm" data-toplu="sifre">resimli şifreyi yenile</button><button type="button" class="btn ghost sm red-t" data-toplu="sil">sil</button></div>' +
      '<div class="tbl-w"><table class="kd-tbl"><thead><tr><th><input type="checkbox" id="kd-hepsi" aria-label="Hepsini seç"></th><th>Kimlik</th><th>Ad</th><th>Resmi</th><th>Gizli resimler</th><th></th></tr></thead><tbody>' +
      ogr.map(function (g) {
        return '<tr class="' + (g.aktif ? '' : 'kd-pasif') + '"><td><input type="checkbox" data-sec="' + g.id + '"' + (K.secili[g.id] ? ' checked' : '') + ' aria-label="' + X(g.ad) + ' seç"></td>' +
          '<td class="mono">' + X(g.kimlik) + '</td><td><b>' + X(g.ad) + '</b>' + (g.aktif ? '' : ' <span class="pill">pasif</span>') + '</td>' +
          '<td><span class="kd-av" title="' + X(HAYVAN[g.hayvan]) + '">' + ciz('avatar', g.hayvan) + '</span></td>' +
          '<td><span class="kd-sf">' + g.sifre.map(function (r) { return '<span title="' + X(RESIM[r]) + '">' + ciz('simge', r) + '</span>'; }).join('') + '</span></td>' +
          '<td class="kd-r"><button type="button" class="btn ghost sm" data-ogr="' + g.id + '">düzenle</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  };

  var sinifBagla = function (m, o, s, ogr, kalan) {
    $('#kd-sduz', m).addEventListener('click', function () { sinifForm(o, s, m); });
    $('#kd-ssil', m).addEventListener('click', async function () {
      if (!A.confirmBox(s.ad + ' sınıfı ve içindeki ' + ogr.length + ' öğrenci kalıcı olarak silinsin mi? Basılmış kartlar geçersiz olur. Bu geri alınamaz.')) return;
      try { await rpc('kids_sinif_sil', { p_id: s.id }); toast(s.ad + ' silindi.'); K.sinif = null; detay(m); } catch (e) { toast(errMsg(e), true); }
    });
    $('#kd-sbas', m).addEventListener('click', function () { kartBas(o, ogr.filter(function (g) { return g.aktif; }), K.d.siniflar); });
    /* toplu ekleme */
    var ta = $('#kd-adlar', m), on = $('#kd-onizle', m), eb = $('#kd-ekle', m), adlar = [];
    var guncelle = function () {
      adlar = adlariAyikla(ta.value);
      var fazla = adlar.length > kalan;
      on.innerHTML = adlar.length ? '<p><b>' + NF(adlar.length) + '</b> öğrenci · kotada <b>' + NF(Math.max(0, kalan)) + '</b> yer var' + (fazla ? ' <span class="pill bad">' + NF(adlar.length - kalan) + ' fazla</span>' : '') + '</p><div class="kd-cips">' +
        adlar.slice(0, 60).map(function (a) { return '<span>' + X(a) + '</span>'; }).join('') + (adlar.length > 60 ? '<span>+' + NF(adlar.length - 60) + '</span>' : '') + '</div>' : (kalan > 0 ? '' : '<p class="err">Kota dolu. Okulu düzenleyip kotayı artırın ya da pasif öğrenci çıkarın.</p>');
      eb.disabled = !adlar.length || fazla || adlar.length > 200;
      eb.textContent = adlar.length ? NF(adlar.length) + ' öğrenciyi ekle' : 'öğrencileri ekle';
    };
    ta.addEventListener('input', guncelle); guncelle();
    eb.addEventListener('click', async function () {
      eb.disabled = true;
      try { var r = await rpc('kids_ogrenci_ekle', { p_sinif: s.id, p_adlar: adlar }); toast(NF(r.adet) + ' öğrenci eklendi; kimlik ve resimli şifreleri hazır.'); K.secili = {}; detay(m); }
      catch (e) { toast(errMsg(e), true); eb.disabled = false; }
    });
    /* seçim ve toplu işler */
    var tb = $('#kd-toplu', m);
    var secim = function () { var ids = Object.keys(K.secili).filter(function (k) { return K.secili[k]; }); if (tb) { tb.hidden = !ids.length; $('#kd-ssay', m).textContent = ids.length; } return ids; };
    $$('[data-sec]', m).forEach(function (c) { c.addEventListener('change', function () { K.secili[c.getAttribute('data-sec')] = c.checked; secim(); }); });
    var hepsi = $('#kd-hepsi', m);
    if (hepsi) hepsi.addEventListener('change', function () { var v = this.checked; $$('[data-sec]', m).forEach(function (c) { c.checked = v; K.secili[c.getAttribute('data-sec')] = v; }); secim(); });
    secim();
    $$('[data-toplu]', m).forEach(function (b) { b.addEventListener('click', async function () {
      var ids = secim(), is = b.getAttribute('data-toplu'); if (!ids.length) return;
      if (is === 'bas') return kartBas(o, ogr.filter(function (g) { return K.secili[g.id] && g.aktif; }), K.d.siniflar);
      if (is === 'sifre' && !A.confirmBox(ids.length + ' öğrencinin resimli şifresi değişsin mi? Eski kartları geçersiz olur; yeni kart basmanız gerekir.')) return;
      if (is === 'sil' && !A.confirmBox(ids.length + ' öğrenci kalıcı olarak silinsin mi? Kimlik numaraları bir daha verilmez. Bu geri alınamaz.')) return;
      try {
        var n = await rpc(is === 'sil' ? 'kids_ogrenci_sil' : 'kids_ogrenci_sifre_yenile', { p_ids: ids });
        toast(is === 'sil' ? NF(n) + ' öğrenci silindi.' : NF(n) + ' öğrencinin resimli şifresi yenilendi. Kartlarını yeniden basın.');
        if (is === 'sil') K.secili = {}; detay(m);
      } catch (e) { toast(errMsg(e), true); }
    }); });
    $$('[data-ogr]', m).forEach(function (b) { b.addEventListener('click', function () { ogrForm(ogr.filter(function (g) { return g.id === b.getAttribute('data-ogr'); })[0], m); }); });
  };

  var sinifForm = function (o, s, m) {
    A.openDrawer(s ? s.ad + ' sınıfı' : 'Yeni sınıf',
      '<form id="kd-sf" class="kd-form" novalidate><label class="fld">Sınıfın adı<input class="in" name="ad" maxlength="60" required value="' + X(s ? s.ad : '') + '" placeholder="Papatyalar, 2-A…"></label>' +
      '<fieldset class="kd-bant"><legend>Yaş dünyası <small>zorluk ve yazı miktarı buna göre değişir</small></legend>' + Object.keys(BANT).map(function (k, i) {
        return '<label><input type="radio" name="bant" value="' + k + '"' + ((s ? s.bant === k : i === 1) ? ' checked' : '') + '><span><b>' + BANT[k].split(' · ')[0] + '</b>' + BANT[k].split(' · ')[1] + '</span></label>';
      }).join('') + '</fieldset><p class="err" id="kd-sf-h" role="alert"></p><div class="acts"><button type="submit" class="btn">' + (s ? 'kaydet' : 'sınıfı ekle') + '</button></div></form>');
    var F = $('#kd-sf');
    F.addEventListener('submit', async function (e) {
      e.preventDefault(); var ad = F.elements.ad.value.trim(), b = F.querySelector('[type=submit]');
      if (!ad) { $('#kd-sf-h').textContent = 'Sınıfın adını yazın.'; return; }
      b.disabled = true;
      try { var id = await rpc('kids_sinif_kaydet', { p_okul: o.id, p_id: s ? s.id : null, p_ad: ad, p_bant: F.elements.bant.value }); A.closeDrawer(); toast(s ? 'Kaydedildi.' : ad + ' eklendi.'); K.sinif = id; K.secili = {}; detay(m); }
      catch (er) { $('#kd-sf-h').textContent = errMsg(er); b.disabled = false; }
    });
    setTimeout(function () { F.elements.ad.focus(); }, 60);
  };

  var ogrForm = function (g, m) {
    var S = K.d.siniflar;
    A.openDrawer(g.kimlik,
      '<div class="kd-ogr-bas"><span class="kd-av kd-av-b">' + ciz('avatar', g.hayvan) + '</span><div><b>' + X(g.ad) + '</b><span class="muted">' + X(HAYVAN[g.hayvan]) + ' · gizli resimler: ' + g.sifre.map(function (r) { return X(RESIM[r]); }).join(', ') + '</span></div></div>' +
      '<form id="kd-ogf" class="kd-form" novalidate><label class="fld">Ad <small>soyadın yalnız baş harfi kaydedilir</small><input class="in" name="ad" maxlength="80" value="' + X(g.ad) + '"></label>' +
      '<label class="fld">Sınıf<select class="in" name="sinif">' + S.map(function (s) { return '<option value="' + s.id + '"' + (s.id === g.sinif_id ? ' selected' : '') + '>' + X(s.ad) + '</option>'; }).join('') + '</select></label>' +
      '<label class="kd-cb"><input type="checkbox" name="aktif"' + (g.aktif ? ' checked' : '') + '> Etkin (pasif öğrenci giriş yapamaz ve kotadan düşer)</label>' +
      '<p class="err" id="kd-ogf-h" role="alert"></p><div class="acts"><button type="submit" class="btn">kaydet</button><button type="button" class="btn ghost" id="kd-og-sf">resimli şifreyi yenile</button><button type="button" class="btn ghost" id="kd-og-k">kartını yazdır</button></div></form>');
    var F = $('#kd-ogf');
    F.addEventListener('submit', async function (e) {
      e.preventDefault(); var p = {};
      if (F.elements.ad.value.trim() && adKisalt(F.elements.ad.value) !== g.ad) p.ad = F.elements.ad.value;
      if (F.elements.sinif.value !== g.sinif_id) p.sinif_id = F.elements.sinif.value;
      if (F.elements.aktif.checked !== g.aktif) p.aktif = F.elements.aktif.checked;
      if (!Object.keys(p).length) { A.closeDrawer(); return; }
      try { await rpc('kids_ogrenci_guncelle', { p_id: g.id, p: p }); A.closeDrawer(); toast('Kaydedildi.'); detay(m); } catch (er) { $('#kd-ogf-h').textContent = errMsg(er); }
    });
    $('#kd-og-sf').addEventListener('click', async function () {
      if (!A.confirmBox(g.ad + ' için yeni resimli şifre üretilsin mi? Eski kartı geçersiz olur.')) return;
      try { await rpc('kids_ogrenci_sifre_yenile', { p_ids: [g.id] }); A.closeDrawer(); toast('Yeni resimli şifre hazır; kartını yeniden basın.'); detay(m); } catch (er) { $('#kd-ogf-h').textContent = errMsg(er); }
    });
    $('#kd-og-k').addEventListener('click', function () { kartBas(K.d.okul, [g], S); });
  };

  var sifreYenile = async function (o, m) {
    if (o.sifre_var && !A.confirmBox(o.ad + ' için yeni öğretmen şifresi üretilsin mi? Eski şifre hemen geçersiz olur.')) return;
    try {
      var s = await rpc('kids_okul_sifre_yenile', { p_okul: o.id });
      A.openDrawer('Öğretmen şifresi',
        '<div class="kd-sifre-k"><span class="mono">' + X(o.kod) + '</span><b class="mono" id="kd-sif">' + X(s) + '</b></div>' +
        '<p>Öğretmenler bu şifreyle <b>' + SITE + '</b> adresinde “Öğretmen girişi”nden okul kodu <b class="mono">' + X(o.kod) + '</b> ile girer.</p>' +
        '<p class="err">Bu şifre yalnız şimdi görünür; Acadex onu düz hâliyle saklamaz. Okul yetkilisine iletin. Unutulursa yenisini üretirsiniz.</p>' +
        '<div class="acts"><button type="button" class="btn" id="kd-kopya">kopyala</button></div>');
      $('#kd-kopya').addEventListener('click', function () { try { navigator.clipboard.writeText(o.kod + ' · ' + s).then(function () { toast('Kopyalandı.'); }); } catch (e) { toast('Kopyalanamadı; şifreyi elle yazın.', true); } });
      o.sifre_var = true; var b = $('#kd-sifre', m); if (b) b.textContent = 'öğretmen şifresini yenile';
    } catch (e) { toast(errMsg(e), true); }
  };

  /* =========================== giriş kartı: A4'e 8 kart =========================== */
  var kartHTML = function (o, g, sinifAd) {
    return '<div class="kart"><div class="k-ust"><span class="k-acd">' + (C ? C.acadia({ mood: 'mutlu' }) : '') + '</span><b>Acadex <i>Kids</i></b><span class="k-sinif">' + X(sinifAd || '') + '</span></div>' +
      '<div class="k-orta"><span class="k-av">' + ciz('avatar', g.hayvan) + '</span><div class="k-kim"><span class="k-ad">' + X(g.ad) + '</span><span class="k-not">Resmin: <b>' + X(HAYVAN[g.hayvan]) + '</b></span>' +
      '<span class="k-gizli">Gizli resimlerin</span><span class="k-sf">' + g.sifre.map(function (r, i) { return '<span><i>' + (i + 1) + '</i>' + ciz('simge', r) + '</span>'; }).join('') + '</span></div></div>' +
      '<div class="k-alt"><span><b>' + SITE + '</b></span><span>Okul kodu <b>' + X(o.kod) + '</b></span><span class="k-no">' + X(g.kimlik) + '</span></div></div>';
  };
  var kartSayfa = function (o, liste, siniflar) {
    var ad = {}; (siniflar || []).forEach(function (s) { ad[s.id] = s.ad; });
    var sayfalar = []; for (var i = 0; i < liste.length; i += 8) sayfalar.push(liste.slice(i, i + 8));
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' + X(o.kod) + ' · Acadex Kids giriş kartları</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@600;800&display=swap" rel="stylesheet">' +
      '<style>' + KART_CSS + '</style></head><body><div class="arac"><b>' + X(o.ad) + '</b> · ' + NF(liste.length) + ' kart, ' + NF(sayfalar.length) + ' sayfa A4. Yazdırırken “Gerçek boyut / %100” ve “Arka plan grafikleri” seçili olsun.' +
      '<button type="button" onclick="print()">Yazdır</button></div>' +
      sayfalar.map(function (p) { return '<section class="sayfa">' + p.map(function (g) { return kartHTML(o, g, ad[g.sinif_id]); }).join('') + '</section>'; }).join('') +
      '<script>document.fonts&&document.fonts.ready.then(function(){setTimeout(function(){print()},300)});<\/script></body></html>';
  };
  var KART_CSS = '@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#E9E6DD;font-family:Nunito,system-ui,sans-serif;color:#23304D;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.arac{position:sticky;top:0;display:flex;gap:12px;align-items:center;padding:10px 16px;background:#23304D;color:#fff;font-size:14px}.arac button{margin-left:auto;padding:8px 18px;border:0;border-radius:999px;background:#FFD23F;font:800 15px Nunito,sans-serif;cursor:pointer}' +
    '.sayfa{width:210mm;height:297mm;margin:10mm auto;display:grid;grid-template-columns:repeat(2,105mm);grid-template-rows:repeat(4,74.25mm);background:#fff;page-break-after:always;break-after:page}' +
    '.kart{position:relative;display:grid;grid-template-rows:auto 1fr auto;padding:4.5mm 5.5mm;border:.3mm dashed #B8B2A2;overflow:hidden}' +
    '.k-ust{display:flex;align-items:center;gap:2mm;padding-bottom:2mm;border-bottom:.5mm solid #FFE79A}.k-acd{width:8mm;height:8mm}.k-acd svg,.k-av svg,.k-sf svg{display:block;width:100%;height:100%}' +
    '.k-ust b{font:800 13pt/1 "Baloo 2",sans-serif}.k-ust i{font-style:normal;padding:0 1.5mm;border-radius:2mm;background:#FFB3A9}.k-sinif{margin-left:auto;padding:.6mm 2.5mm;border-radius:9mm;background:#E8F4FF;font-weight:800;font-size:9pt}' +
    '.k-orta{display:grid;grid-template-columns:30mm 1fr;gap:4mm;align-items:center;padding:2mm 0}.k-av{display:block;width:30mm;height:30mm;padding:1.5mm;border:.6mm solid #23304D;border-radius:7mm;background:#FFF6D6}' +
    '.k-kim{display:grid;gap:.8mm}.k-ad{font:800 17pt/1.05 "Baloo 2",sans-serif}.k-not{font-size:8.5pt}.k-gizli{margin-top:1.2mm;font-weight:800;font-size:8.5pt}' +
    '.k-sf{display:flex;gap:2.5mm}.k-sf>span{position:relative;width:15mm;height:15mm;padding:1.4mm;border:.5mm dashed #23304D;border-radius:3.5mm;background:#fff}' +
    '.k-sf i{position:absolute;left:-1.8mm;top:-1.8mm;width:5mm;height:5mm;border-radius:50%;background:#23304D;color:#fff;font:800 7pt/5mm Nunito,sans-serif;text-align:center;font-style:normal}' +
    '.k-alt{display:flex;gap:3mm;align-items:center;padding-top:1.8mm;border-top:.3mm solid #E3DECF;font-size:7.5pt}.k-alt b{font-weight:800}.k-no{margin-left:auto;font-family:ui-monospace,Menlo,monospace;font-size:7.5pt}' +
    '@media print{body{background:#fff}.arac{display:none}.sayfa{margin:0}}';
  var kartBas = function (o, liste, siniflar) {
    if (!liste.length) { toast('Yazdırılacak etkin öğrenci yok.', true); return; }
    var w = window.open('', '_blank');
    if (!w) { toast('Yeni sekme açılamadı; tarayıcının açılır pencere engelini bu site için kaldırın.', true); return; }
    w.document.open(); w.document.write(kartSayfa(o, liste, siniflar)); w.document.close();
  };
  window.AXKIDS_TEST.kartSayfa = kartSayfa;

  /* =========================== çerçeve =========================== */
  A.VIEWS.kids = async function (m) {
    try { if (K.okul) await detay(m); else await liste(m); }
    catch (e) {
      if (notReady(e)) { m.innerHTML = kurulum(); return; }
      if (K.okul && /bulunamadı/i.test(errMsg(e))) { K.okul = null; return liste(m); }
      throw e;
    }
  };
})();
