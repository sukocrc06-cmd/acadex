/* ==========================================================================
   FORMULO · hesaba kayıt (formulo/assets/formulo-bulut.js), 08.11.2026
   Deste, hata defteri, soru havuzu skoru, seri ve "kaldığın yer" artık yalnız
   tarayıcıda değil, öğrencinin hesabında da durur (tablo: formulo_ilerleme,
   supabase/migrations/20261108_formulo_ilerleme.sql). Telefonda yıldızlanan
   formül bilgisayarda da destede görünür.
   - Açılışta hesaptaki kayıt okunur ve yerelle birleştirilir:
       · bir anahtar iki tarafta da daha önce eşitlendiyse: son değişen kazanır
         (silinen hata defteri kaydı geri gelmez)
       · ilk eşitlemede: deste birleşir, hata defteri tarih sırasıyla birleşir,
         skorda çok çözülen, seride uzun olan, "kaldığın yer"de yeni olan kalır
   - Yerelde değişen anahtar 1,5 sn sonra (sekme gizlenince hemen) yazılır.
   - Tablo yoksa ya da oturum yoksa sessizce yerelde çalışmaya devam eder.
   Diğer betikler koy() içinde W.FOBULUT.degisti(k) çağırır; birleşme sonrası
   'formulo:bulut' olayı yayınlanır (deste sayacı, kart yeniden çizilir).
   ========================================================================== */
(function (W) {
  'use strict';
  if (W.FOBULUT) return;
  var D = W.document;
  var ANAH = ['deste', 'hata', 'skor', 'seri', 'son'];
  var TABLO = 'formulo_ilerleme';
  function al(k, v) { try { var x = localStorage.getItem('formulo.' + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } }
  function yaz(k, v) { try { if (v == null) localStorage.removeItem('formulo.' + k); else localStorage.setItem('formulo.' + k, JSON.stringify(v)); } catch (e) { } }
  function istemci() { try { return supabaseClient; } catch (e) { return null; } }   /* supabase-config.js tanımlar; yoksa yerel */
  var uid = null, hazir = false, kapali = false, bekle = 0, yaziyor = false, yeniden = false;

  /* ---------- birleştirme (saf işlevler; tests/formulo-bulut.js sınar) ---------- */
  var ILK = {
    deste: function (y, u) { y = Array.isArray(y) ? y : []; u = Array.isArray(u) ? u : []; var s = y.slice(); u.forEach(function (x) { if (s.indexOf(x) < 0) s.push(x); }); return s; },
    hata: function (y, u) {
      var gor = {}, s = [];
      (Array.isArray(y) ? y : []).concat(Array.isArray(u) ? u : []).forEach(function (x) { if (!x) return; var a = x.id + '|' + x.tip + '|' + x.ts; if (gor[a]) return; gor[a] = 1; s.push(x); });
      return s.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).slice(0, 60);
    },
    skor: function (y, u) { var s = {}; [u || {}, y || {}].forEach(function (o) { Object.keys(o).forEach(function (d) { if (!s[d] || (o[d] && o[d].t > s[d].t)) s[d] = o[d]; }); }); return s; },
    seri: function (y, u) { if (!y) return u || null; if (!u) return y; return (u.n || 0) > (y.n || 0) ? u : y; },
    son: function (y, u) { if (!y) return u || null; if (!u) return y; return (u.ts || 0) > (y.ts || 0) ? u : y; }
  };
  /* yerel: {veri, zaman}, uzak: {veri, zaman}; zaman[k] = o anahtarın son değişim anı (ms) */
  function birlestir(yerel, uzak) {
    var v = {}, z = {}, yv = yerel.veri || {}, yz = yerel.zaman || {}, uv = uzak.veri || {}, uz = uzak.zaman || {};
    ANAH.forEach(function (k) {
      var yVar = yv[k] != null, uVar = uv[k] != null;
      if (!uVar && !uz[k]) { v[k] = yv[k]; z[k] = yz[k] || 0; return; }
      if (!yVar && !yz[k]) { v[k] = uv[k]; z[k] = uz[k] || 0; return; }
      if (yz[k] && uz[k]) { var ys = yz[k] >= uz[k]; v[k] = ys ? yv[k] : uv[k]; z[k] = ys ? yz[k] : uz[k]; return; }
      v[k] = ILK[k](yv[k], uv[k]); z[k] = Math.max(yz[k] || 0, uz[k] || 0) || Date.now();
    });
    return { veri: v, zaman: z };
  }
  function yerelOku() { var v = {}; ANAH.forEach(function (k) { v[k] = al(k, null); }); return { veri: v, zaman: al('bulutZaman', {}) || {} }; }
  function dolu(o) { var r = {}; Object.keys(o || {}).forEach(function (k) { if (o[k] != null) r[k] = o[k]; }); return r; }
  function esit(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  /* ---------- hesapla konuşma ---------- */
  async function oturum() {
    var sb = istemci(); if (!sb) return null;
    try { var r = await sb.auth.getSession(); return (r && r.data && r.data.session && r.data.session.user) || null; } catch (e) { return null; }
  }
  async function yukle() {
    var sb = istemci(), u = await oturum(); if (!sb || !u) return;
    uid = u.id;
    try {
      var r = await sb.from(TABLO).select('veri').eq('user_id', uid).maybeSingle();
      if (r && r.error) { kapali = true; return; }              /* tablo yok / izin yok: yerelde kal */
      var uzak = (r && r.data && r.data.veri) || {}, yerel = yerelOku();
      var m = birlestir(yerel, { veri: uzak.veri || {}, zaman: uzak.zaman || {} });
      var degisti = false;
      ANAH.forEach(function (k) { if (!esit(m.veri[k], yerel.veri[k])) { yaz(k, m.veri[k]); degisti = true; } });
      yaz('bulutZaman', m.zaman); hazir = true;
      if (degisti) D.dispatchEvent(new CustomEvent('formulo:bulut'));
      if (!esit(dolu(m.veri), dolu(uzak.veri))) planla(0);   /* boş kayıt yazılmaz */
    } catch (e) { kapali = true; }
  }
  async function gonder() {
    var sb = istemci(); if (!sb || !uid || kapali) return;
    if (yaziyor) { yeniden = true; return; }
    yaziyor = true;
    try {
      var y = yerelOku();
      var r = await sb.from(TABLO).upsert({ user_id: uid, veri: { veri: y.veri, zaman: y.zaman, surum: 1 }, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (r && r.error) kapali = true;
    } catch (e) { /* ağ hatası: bir sonraki değişiklikte yeniden denenir */ }
    yaziyor = false;
    if (yeniden) { yeniden = false; planla(800); }
  }
  function planla(ms) { clearTimeout(bekle); bekle = setTimeout(gonder, ms == null ? 1500 : ms); }
  function degisti(k) {
    if (ANAH.indexOf(k) < 0) return;
    var z = al('bulutZaman', {}) || {}; z[k] = Date.now(); yaz('bulutZaman', z);
    if (hazir && !kapali) planla();
  }
  D.addEventListener('visibilitychange', function () { if (D.visibilityState === 'hidden' && bekle && hazir && !kapali) { clearTimeout(bekle); bekle = 0; gonder(); } });

  W.FOBULUT = { degisti: degisti, birlestir: birlestir, ILK: ILK, ANAH: ANAH, yukle: yukle, durum: function () { return { hazir: hazir, kapali: kapali, uid: uid }; } };
  function basla() { yukle(); }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', basla); else basla();
  D.addEventListener('acx:acik', function () { if (!hazir) yukle(); });
})(window);
