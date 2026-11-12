/* ==========================================================================
   ACADEX KIDS · sunucu bağlantısı (kids/assets/kids-bulut.js), 10.11.2026
   Okulları, sınıfları ve öğrencileri Acadex yönetim paneli üretir (Supabase).
   Bu dosya acadex.com.tr/kids'in o kayıtlara bağlandığı tek yer:
     okulBul(kod) · giris(ogrenciId, [resim, resim]) · durum(anahtar) ·
     ilerlemeKoy(anahtar, veri) · cikis(anahtar) ·
     ogretmenGiris(kod, şifre) · ogretmenVeri(anahtar, baş, bit) · planKoy(...)
   Fonksiyonlar: supabase/migrations/20261110b_kids_giris.sql (anon çağrılır,
   yetki ve deneme sınırı sunucuda). Burada yalnız herkese açık (publishable)
   anahtar var; gizli anahtar asla bu dosyaya girmez.
   Örnek okul (ORNEK.kod) sunucuya hiç gitmez; tanıtım için tarayıcıda çalışır.
   W.KIDS_BULUT
   ========================================================================== */
(function (W) {
  'use strict';
  var URL = 'https://yrcdvcsowblzmkpbmkut.supabase.co', ANAHTAR = 'sb_publishable_W_DZnHPY-I51nioiWOTJmw_FCnyFjxm';
  var ORNEK_KOD = 'ORNEK-2026';
  var RENK = { minik: '#FFD23F', kasif: '#E5484D', yildiz: '#4AA8FF' };

  /* hata: {mesaj, tur} — tur: 'yok' (kod/öğrenci yok), 'lisans', 'kilit', 'oturum', 'ag' (bağlantı yok), 'sunucu' */
  function Hata(mesaj, tur) { this.message = mesaj; this.tur = tur; }
  async function rpc(fn, args) {
    var r;
    try {
      r = await W.fetch(URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { 'apikey': ANAHTAR, 'content-type': 'application/json', 'accept': 'application/json' }, body: JSON.stringify(args || {}) });
    } catch (e) { throw new Hata('İnternet bağlantısı yok gibi. Bağlanınca yeniden dene.', 'ag'); }
    var j = null; try { j = await r.json(); } catch (e) { }
    if (!r.ok) {
      var ipucu = j && j.hint, m = (j && j.message) || 'Sunucu yanıt vermedi.';
      if (ipucu === 'yok' || ipucu === 'lisans' || ipucu === 'kilit' || ipucu === 'oturum') throw new Hata(m, ipucu);
      if (j && (j.code === 'PGRST202' || j.code === '42883')) throw new Hata('Acadex Kids sunucusu henüz kurulmadı.', 'sunucu');
      throw new Hata(m, 'sunucu');
    }
    return j;
  }
  /* sunucu okulunu uygulamanın beklediği biçime çevirir: ogr = [ad, hayvan, id] */
  function okulBicim(o) {
    return { kod: o.kod, ad: o.ad, bulut: true, siniflar: (o.siniflar || []).map(function (s) {
      return { id: s.id, ad: s.ad, bant: s.bant, renk: RENK[s.bant] || '#4AA8FF', ogr: (s.ogr || []).map(function (g) { return [g.ad, g.hayvan, g.id, g.ilerleme || null]; }), plan: s.plan || {} };
    }) };
  }

  /* ilerleme yazımı: oyun sırasında sık değişir; 1,5 sn bekleyip son hâli gönderir, sayfa kapanırken hemen gönderir */
  var bekleyen = null, zaman = null;
  function gonder() {
    if (!bekleyen) return Promise.resolve(); var b = bekleyen; bekleyen = null; clearTimeout(zaman);
    return rpc('kids_ilerleme_koy', { p_token: b.t, p_veri: b.v }).catch(function () { if (!bekleyen) bekleyen = b; });
  }
  function ilerlemeKoy(token, veri) { bekleyen = { t: token, v: veri }; clearTimeout(zaman); zaman = setTimeout(gonder, 1500); }
  /* internet geri gelince bekleyen ilerlemeyi gönder (ana ekrandan çevrimdışı oynandıysa) */
  W.addEventListener('online', function () { gonder(); });
  W.addEventListener('pagehide', function () {
    if (!bekleyen) return;
    try { W.fetch(URL + '/rest/v1/rpc/kids_ilerleme_koy', { method: 'POST', keepalive: true, headers: { 'apikey': ANAHTAR, 'content-type': 'application/json' }, body: JSON.stringify({ p_token: bekleyen.t, p_veri: bekleyen.v }) }); bekleyen = null; } catch (e) { }
  });

  W.KIDS_BULUT = {
    ORNEK_KOD: ORNEK_KOD, RENK: RENK, Hata: Hata, rpc: rpc, okulBicim: okulBicim,
    /* 20261112c: kod taramasına karşı başarısız arama HATA FIRLATMAZ, {hata,mesaj} döner
       (fırlatsa deneme sayacı işlemle birlikte geri alınırdı) */
    okulBul: function (kod) { return rpc('kids_okul_bul', { p_kod: kod }).then(function (o) { if (o && o.hata) throw new Hata(o.mesaj || 'Bu kodu bulamadım.', o.hata === 'kilit' ? 'kilit' : 'yok'); return okulBicim(o); }); },
    giris: function (id, sifre) { return rpc('kids_giris', { p_ogrenci: id, p_sifre: sifre }); },
    durum: function (t) { return rpc('kids_durum', { p_token: t }); },
    ilerlemeKoy: ilerlemeKoy, ilerlemeGonder: gonder,
    cikis: function (t) { return gonder().then(function () { return rpc('kids_cikis', { p_token: t }); }).catch(function () { }); },
    ogretmenGiris: function (kod, sifre) { return rpc('kids_ogretmen_giris', { p_kod: kod, p_sifre: sifre }); },
    ogretmenVeri: function (t, bas, bit) { return rpc('kids_ogretmen_veri', { p_token: t, p_bas: bas, p_bit: bit }).then(function (v) { var o = okulBicim({ kod: v.okul.kod, ad: v.okul.ad, siniflar: v.siniflar }); o.bugun = v.bugun; return o; }); },
    planKoy: function (t, sinif, gun, konu) { return rpc('kids_plan_koy', { p_token: t, p_sinif: sinif, p_gun: gun, p_konu: konu }); },
    /* 20261112d: paylaşımlı tablette açık kalan çocuk oturumlarını kapatır (yalnız o sınıf) */
    sinifOturumKapat: function (t, sinif) { return rpc('kids_sinif_oturum_kapat', { p_token: t, p_sinif: sinif }); },
    ayar: function (url, anahtar) { URL = url; ANAHTAR = anahtar; }   /* yalnız test */
  };
})(window);
