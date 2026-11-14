/* ==========================================================================
   ACADEX KIDS · kreşin kendi haftası (kids/assets/kids-kres.js), 14.11.2026
   Her kreşin kendine özgü etkinlikleri var ("Pazartesi bahçe günü", 23 Nisan…).
   Öğretmen yine içerik YAZMAZ, ödev vermez; hazır olandan seçer:
   - Etkinlik takvimi: haftalık kreş etkinlikleri (bahçe, meyve, spor…) ve belirli
     gün ve haftalar (Hayvanları Koruma Günü, 23 Nisan…). Her etkinliğin önerilen
     konusu var. Haftalık şablon her hafta tekrar eder; tek bir gün için ayrıca
     seçim yapılırsa o gün şablonun yerine geçer (sunucuda kids_gun_bilgi ile aynı).
   - Kreşin kelime seti: 510 hazır kelimeden 3-20 kelimelik set ("Sonbahar projemiz").
     O gün sete ayrılırsa çocuk seti ayrı bir ada gibi oynar (İzle, Dokun, Balon,
     Hafıza, Park, Söyle). Her kelime kendi konusunun çizimi ve cümleleriyle gelir.
   - Bugün ne öğrendik kartı: günün kelimeleri, evde sorulacak iki soru; çocuk adı
     ve sonucu YOK. Yazdırılır ya da WhatsApp'ta paylaşılır.
   Gerçek okul: kids-bulut.js (kids_gun_koy, kids_hafta_koy, kids_set_kaydet).
   Örnek okul: bu tarayıcıda (localStorage 'kids.kres.<kod>').
   W.KIDS_KRES. Önek kr-.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, V = W.KIDS_VERI, K = W.KIDS_KONU, SES = W.KIDS_SES;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var GUN = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
  var AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  /* ---------------------------- etkinlik kataloğu ---------------------------- */
  var HAFTALIK = [
    ['Bahçe günü', 'seasons'], ['Meyve günü', 'fruits'], ['Oyuncak günü', 'toys'], ['Spor günü', 'actions'], ['Kitap günü', 'school'],
    ['Müzik ve dans', 'actions'], ['Mutfak etkinliği', 'food'], ['Doğa yürüyüşü', 'animals'], ['Renk günü', 'colours'], ['Sanat etkinliği', 'shapes'],
    ['Deney günü', 'weather'], ['Drama günü', 'feelings'], ['Aile katılım günü', 'family'], ['Trafik eğitimi', 'transport'], ['Sağlık ve temizlik', 'body'],
    ['Su oyunları', 'sea'], ['Meslekler günü', 'jobs'], ['Kostüm günü', 'clothes'], ['Sayı oyunları', 'numbers'], ['Evcil hayvanlar', 'animals']
  ].map(function (x) { return { ad: x[0], konu: x[1] }; });
  /* Belirli gün ve haftalar (okul öncesi). Tarih önerilir; öğretmen başka güne de koyabilir.
     g: ayın günü · h: [kaçıncı, haftanın günü 0=Pazar, 1=Pazartesi] · son: ayın son Pazartesisi */
  var OZEL = [
    { ad: 'Hayvanları Koruma Günü', ay: 10, g: 4, konu: 'animals' },
    { ad: 'Cumhuriyet Bayramı', ay: 10, g: 29, konu: 'colours' },
    { ad: 'Dünya Çocuk Hakları Günü', ay: 11, g: 20, konu: 'family' },
    { ad: 'Ağız ve Diş Sağlığı Haftası', ay: 11, g: 21, konu: 'body' },
    { ad: 'Öğretmenler Günü', ay: 11, g: 24, konu: 'school' },
    { ad: 'Dünya Engelliler Günü', ay: 12, g: 3, konu: 'feelings' },
    { ad: 'Yerli Malları Haftası', ay: 12, g: 12, konu: 'fruits' },
    { ad: 'Yeni yıl', ay: 12, g: 31, konu: 'seasons' },
    { ad: 'Enerji Tasarrufu Haftası', ay: 1, h: [2, 1], konu: 'home' },
    { ad: 'Orman Haftası', ay: 3, g: 21, konu: 'seasons' },
    { ad: 'Dünya Su Günü', ay: 3, g: 22, konu: 'weather' },
    { ad: 'Kütüphaneler Haftası', ay: 3, son: 1, konu: 'school' },
    { ad: 'Dünya Sağlık Günü', ay: 4, g: 7, konu: 'body' },
    { ad: '23 Nisan Çocuk Bayramı', ay: 4, g: 23, konu: 'toys' },
    { ad: 'Trafik ve İlk Yardım Haftası', ay: 5, h: [1, 1], konu: 'transport' },
    { ad: 'Anneler Günü', ay: 5, h: [2, 0], konu: 'family' },
    { ad: '19 Mayıs Gençlik ve Spor Bayramı', ay: 5, g: 19, konu: 'actions' },
    { ad: 'Dünya Çevre Günü', ay: 6, g: 5, konu: 'seasons' },
    { ad: 'Babalar Günü', ay: 6, h: [3, 0], konu: 'family' }
  ];
  function ozelTarih(o, yil) {
    if (o.g) return new Date(yil, o.ay - 1, o.g);
    if (o.son) { var d = new Date(yil, o.ay, 0); while (d.getDay() !== o.son) d.setDate(d.getDate() - 1); return d; }
    var x = new Date(yil, o.ay - 1, 1), n = 0; while (true) { if (x.getDay() === o.h[1] && ++n === o.h[0]) return x; x.setDate(x.getDate() + 1); }
  }
  /* hafta sonuna denk gelen gün kreşte bir önceki Cuma kutlanır */
  function isGunu(d) { var x = new Date(d); while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() - 1); return x; }
  /* bugünden sonraki gün sayısı içinde yaklaşan özel günler */
  function yaklasan(bugun, gun) {
    bugun = bugun || new Date(); var b0 = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate()), son = new Date(b0.getTime() + (gun || 60) * 864e5), r = [];
    [b0.getFullYear(), b0.getFullYear() + 1].forEach(function (y) { OZEL.forEach(function (o) { var t = ozelTarih(o, y), k = isGunu(t); if (k >= b0 && k <= son) r.push({ o: o, tarih: t, gun: k }); }); });
    return r.sort(function (a, b) { return a.gun - b.gun; });
  }

  /* ---------------------------- veri: sunucu ya da bu tarayıcı ---------------------------- */
  function yerelAl(kod) { var s = V.al('kres.' + kod, null) || {}; s.setler = s.setler || []; s.gunler = s.gunler || {}; s.hafta = s.hafta || {}; return s; }
  function yerelKoy(kod, s) { V.koy('kres.' + kod, s); }
  function setBul(setler, id) { for (var i = 0; i < (setler || []).length; i++) if (setler[i].id === id) return setler[i]; return null; }
  function haftaGunu(d) { return (d.getDay() + 6) % 7 + 1; }   /* 1 Pazartesi … 7 Pazar */
  function bos() { return { konu: '', set: null, etkinlik: '', kaynak: null }; }
  /* günün geçerli bilgisi: açık plan > haftalık şablon. o = {bulut, setler, kod} */
  function gunBilgi(sinif, d, o) {
    d = d || new Date(); var g = V.gunAnahtar(d), hg = haftaGunu(d), setler = o.setler || [];
    var cevir = function (x, kaynak) { return { konu: x.konu || '', set: x.set ? (typeof x.set === 'object' ? x.set : setBul(setler, x.set)) : null, etkinlik: x.etkinlik || '', kaynak: kaynak }; };
    if (o.bulut) {
      if (sinif.gunler && sinif.gunler[g]) return cevir(sinif.gunler[g], 'plan');
      if (sinif.plan && g in sinif.plan) return { konu: sinif.plan[g], set: null, etkinlik: '', kaynak: 'plan' };
      if (hg <= 5 && sinif.hafta && sinif.hafta[hg]) return cevir(sinif.hafta[hg], 'hafta');
      return bos();
    }
    var s = yerelAl(o.kod || V.OKUL.kod), ek = (s.gunler[sinif.id] || {})[g];
    if (ek || (V.planVar && V.planVar(sinif.id, d))) return cevir({ konu: V.gunKonu(sinif.id, d), set: ek && ek.set, etkinlik: ek && ek.etkinlik }, 'plan');
    var h = hg <= 5 && (s.hafta[sinif.id] || {})[hg];
    if (h) return cevir(h, 'hafta');
    return { konu: V.gunKonu(sinif.id, d), set: null, etkinlik: '', kaynak: null };
  }

  /* ---------------------------- çocuk: kelime seti adası ---------------------------- */
  function setKimlik(set) { return 'set-' + String(set.id).replace(/[^0-9a-z]/gi, '').slice(0, 10).toLowerCase(); }
  function setKaydet(set) {
    var kid = setKimlik(set), liste = [], kon = {};
    (set.kelimeler || []).forEach(function (id) { var x = V.ogeBul(id), k = V.ogeKonu(id); if (x && k && K.al(k)) { liste.push(x); kon[x.id] = k; } });
    if (liste.length < 3) return null;
    var P0 = function (x) { return K.al(kon[x.id]); };
    var p = {
      id: kid, liste: liste, kaynak: kon, sinifSeti: true,
      ogeler: function () { return liste.slice(0, 20); },
      gorsel: function (x) { return P0(x).gorsel(x); },
      izleGiris: 'Let\'s learn our class words!',
      izleCumle: function (x) { return P0(x).izleCumle(x); },
      dokunYon: 'Kelimelere dokun ve dinle.',
      balon: {
        soz: function (x) { return P0(x).balon.soz(x); }, html: function (x) { return P0(x).balon.html(x); }, ciz: function (x) { return P0(x).balon.ciz(x); },
        yanlis: function (y, x) { var b = P0(x).balon; return b.yanlis ? b.yanlis(y, x) : [y.en + '.', b.soz(x)]; }
      },
      hafiza: { soz: 'Find the pairs!', a: function (x) { return P0(x).hafiza.a(x); }, b: function (x, bant) { return P0(x).hafiza.b(x, bant); } },
      oyun3: null, cikartma: [], sarki: null, ev: [], etkinlik: [], karisik: false,
      bitis: 'Great job! Our class words, done!'
    };
    K.gecici(kid, p);
    V.geciciKonu({ id: kid, en: 'Our class words', tr: set.ad, renk: '#C9B8FF', simge: 'book', acik: true, sinifSeti: true });
    return kid;
  }

  /* çocuk haritasındaki bant: bugünün etkinliği ve (varsa) sınıfın kelime seti */
  function cocukBant(S) {
    var b = S.okul && S.okul.bulut ? { etkinlik: S.etkinlik || '', set: S.set || null } : gunBilgi(S.sinif, new Date(), { bulut: false, setler: yerelAl(V.OKUL.kod).setler });
    if (!b.etkinlik && !b.set) return '';
    var kid = b.set ? setKaydet(b.set) : null;
    return '<section class="kr-cocuk">' + (b.etkinlik ? '<p class="kr-etkinlik">' + C.simge('yildiz') + '<span><small>Bugün okulda</small><b>' + esc(b.etkinlik) + '</b></span></p>' : '') +
      (kid ? '<button type="button" class="kr-set-b" data-setoyna="' + kid + '"><span class="kr-set-r">' + K.al(kid).liste.slice(0, 3).map(function (x) { return '<i>' + K.al(kid).gorsel(x) + '</i>'; }).join('') + '</span>' +
        '<span><small>Sınıfımızın kelimeleri</small><b>' + esc(b.set.ad) + '</b><em>' + K.al(kid).liste.length + ' kelime</em></span>' + C.simge('oynat') + '</button>' : '') + '</section>';
  }

  /* ---------------------------- öğretmen: kreş günü bölümü ---------------------------- */
  function kaynakO(ctx) { return { bulut: ctx.bulut, setler: ctx.setler(), kod: ctx.okul.kod }; }
  function konuAd(id) { var k = id && V.konuBul(id); return k ? k.en : ''; }
  function ozetHtml(b) {
    var p = [];
    if (b.etkinlik) p.push('<span class="kr-cip kr-cip-e">' + esc(b.etkinlik) + '</span>');
    if (b.konu) p.push('<span class="kr-cip" style="--r:' + V.konuBul(b.konu).renk + '">' + esc(konuAd(b.konu)) + '</span>');
    if (b.set) p.push('<span class="kr-cip kr-cip-s">' + C.simge('book') + esc(b.set.ad) + '</span>');
    return p.length ? p.join('') : '<span class="kr-bos">Seçim yok</span>';
  }
  function bolum(ctx) {
    var bugun = new Date(), b = gunBilgi(ctx.sinif, bugun, kaynakO(ctx)), yak = yaklasan(bugun, 21).slice(0, 3);
    return '<section class="kr-bolum" aria-labelledby="kr-b"><div class="kr-bolum-bas"><div><h2 id="kr-b">Kreşimizin günü</h2><p class="kt-alt">Kreşinizin kendi etkinlikleri ve kelime setleri. Çocuk o gün haritasında bunları görür.</p></div></div>' +
      '<div class="kr-izgara"><div class="kr-kutu kr-bugun"><small>Bugün' + (b.kaynak === 'hafta' ? ' · haftalık şablondan' : '') + '</small><div class="kr-ozet">' + ozetHtml(b) + '</div>' +
      '<div class="kr-dugmeler"><button type="button" class="kl-dugme kl-dugme-k" data-kr="bugun">Bugünü düzenle</button><button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-kr="kart">' + C.simge('veli') + ' Bugün ne öğrendik?</button></div></div>' +
      '<div class="kr-kutu"><small>Haftalık etkinlikler</small><ol class="kr-hafta-mini">' + GUN.map(function (g, i) { var h = (ctx.bulut ? (ctx.sinif.hafta || {})[i + 1] : (yerelAl(ctx.okul.kod).hafta[ctx.sinif.id] || {})[i + 1]); return '<li><b>' + g.slice(0, 3) + '</b><span>' + (h && (h.etkinlik || konuAd(h.konu)) ? esc(h.etkinlik || konuAd(h.konu)) : '—') + '</span></li>'; }).join('') + '</ol>' +
      '<button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-kr="hafta">Haftayı düzenle</button></div>' +
      '<div class="kr-kutu"><small>Kelime setlerimiz</small><p class="kr-set-say"><b>' + ctx.setler().length + '</b> set' + (ctx.setler().length ? ': ' + ctx.setler().slice(0, 3).map(function (s) { return esc(s.ad); }).join(', ') + (ctx.setler().length > 3 ? '…' : '') : '') + '</p>' +
      '<button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-kr="setler">Setleri yönet</button></div>' +
      '<div class="kr-kutu"><small>Yaklaşan belirli günler</small>' + (yak.length ? '<ul class="kr-yak">' + yak.map(function (y) { return '<li><b>' + y.tarih.getDate() + ' ' + AY[y.tarih.getMonth()] + '</b><span>' + esc(y.o.ad) + '</span></li>'; }).join('') + '</ul>' : '<p class="kr-bos">Önümüzdeki üç haftada yok.</p>') +
      '<button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-kr="ozel">Takvime ekle</button></div></div></section>';
  }
  function bagla(ctx) {
    var k = ctx.kok;
    k.querySelectorAll('[data-kr]').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = b.getAttribute('data-kr'), bugun = new Date();
        if (n === 'bugun') gunDuzenle(ctx, { baslik: 'Bugün · ' + tarihYaz(bugun), deger: gunBilgi(ctx.sinif, bugun, kaynakO(ctx)), kaydet: function (v) { return gunKoy(ctx, V.gunAnahtar(bugun), v, 'Bugün kaydedildi. Çocuklar haritada görecek.'); } });
        else if (n === 'hafta') haftaPanel(ctx);
        else if (n === 'setler') setPanel(ctx);
        else if (n === 'ozel') ozelPanel(ctx);
        else if (n === 'kart') gunKarti(ctx, bugun);
      });
    });
  }
  function tarihYaz(d) { return d.getDate() + ' ' + AY[d.getMonth()] + ' ' + ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][d.getDay()]; }

  /* sunucu ya da yerel kayıt; sonra panel yeniden çizilir */
  function hataGoster(ctx, er) { if (er && (er.tur === 'oturum' || er.tur === 'lisans')) return ctx.cikis(er); W.alert('Kaydedilemedi: ' + (er && er.message || er)); }
  function gunKoy(ctx, gun, v, mesaj) {
    if (ctx.bulut) return W.KIDS_BULUT.gunKoy(ctx.token, ctx.sinif.id, gun, v.konu || '', v.set ? v.set.id || v.set : null, v.etkinlik || '').then(function () { ctx.yenile(mesaj); }, function (er) { hataGoster(ctx, er); throw er; });
    var s = yerelAl(ctx.okul.kod); s.gunler[ctx.sinif.id] = s.gunler[ctx.sinif.id] || {};
    if (!v.konu && !v.set && !v.etkinlik) delete s.gunler[ctx.sinif.id][gun]; else s.gunler[ctx.sinif.id][gun] = { set: v.set ? v.set.id || v.set : null, etkinlik: v.etkinlik || '' };
    yerelKoy(ctx.okul.kod, s); V.planKoy(ctx.sinif.id, gun, v.konu || ''); ctx.yenile(mesaj); return Promise.resolve();
  }
  function haftaKoy(ctx, n, v, mesaj) {
    if (ctx.bulut) return W.KIDS_BULUT.haftaKoy(ctx.token, ctx.sinif.id, n, v.konu || '', v.set ? v.set.id || v.set : null, v.etkinlik || '').then(function () { ctx.yenile(mesaj); }, function (er) { hataGoster(ctx, er); throw er; });
    var s = yerelAl(ctx.okul.kod); s.hafta[ctx.sinif.id] = s.hafta[ctx.sinif.id] || {};
    if (!v.konu && !v.set && !v.etkinlik) delete s.hafta[ctx.sinif.id][n]; else s.hafta[ctx.sinif.id][n] = { konu: v.konu || '', set: v.set ? v.set.id || v.set : null, etkinlik: v.etkinlik || '' };
    yerelKoy(ctx.okul.kod, s); ctx.yenile(mesaj); return Promise.resolve();
  }
  /* yalnız konuyu değiştirir; o günün etkinliği ve seti korunur (öğretmen panelindeki eski konu düğmeleri) */
  function konuKoy(ctx, gun, konu, mesaj) {
    var d = new Date(gun + 'T12:00:00'), b = gunBilgi(ctx.sinif, d, kaynakO(ctx));
    return gunKoy(ctx, gun, { konu: konu, set: b.set, etkinlik: b.etkinlik }, mesaj);
  }
  function setKaydetSunucu(ctx, set) {
    if (ctx.bulut) return W.KIDS_BULUT.setKaydet(ctx.token, set.id || null, set.ad, set.kelimeler);
    var s = yerelAl(ctx.okul.kod), ad = set.ad.trim();
    if (s.setler.some(function (x) { return x.ad === ad && x.id !== set.id; })) return Promise.reject(new Error('Bu adla bir set zaten var.'));
    if (set.id) s.setler = s.setler.map(function (x) { return x.id === set.id ? { id: x.id, ad: ad, kelimeler: set.kelimeler } : x; });
    else s.setler.push({ id: 'y' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ad: ad, kelimeler: set.kelimeler });
    yerelKoy(ctx.okul.kod, s); return Promise.resolve();
  }
  function setSilSunucu(ctx, id) {
    if (ctx.bulut) return W.KIDS_BULUT.setSil(ctx.token, id);
    var s = yerelAl(ctx.okul.kod); s.setler = s.setler.filter(function (x) { return x.id !== id; });
    Object.keys(s.gunler).forEach(function (si) { Object.keys(s.gunler[si]).forEach(function (g) { if (s.gunler[si][g].set === id) s.gunler[si][g].set = null; }); });
    Object.keys(s.hafta).forEach(function (si) { Object.keys(s.hafta[si]).forEach(function (g) { if (s.hafta[si][g].set === id) s.hafta[si][g].set = null; }); });
    yerelKoy(ctx.okul.kod, s); return Promise.resolve();
  }

  /* ---------------------------- pencere ---------------------------- */
  function katman(ctx, html, cls) {
    var el = D.createElement('div'); el.className = 'kr-katman ' + (cls || ''); el.innerHTML = '<div class="kr-pen" role="dialog" aria-modal="true">' + html + '</div>';
    var once = D.activeElement; D.body.appendChild(el); D.body.classList.add('kr-acik');
    function kapat() { el.remove(); D.body.classList.remove('kr-acik'); D.removeEventListener('keydown', tus); try { once && once.focus(); } catch (e) { } }
    function tus(e) { if (e.key === 'Escape') kapat(); }
    D.addEventListener('keydown', tus);
    el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-krkapat]')) kapat(); });
    var f = el.querySelector('[data-odak]') || el.querySelector('button, input, select'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { }
    return { el: el, kapat: kapat };
  }
  function penBas(baslik, alt) { return '<header class="kr-pen-bas"><div><h2>' + baslik + '</h2>' + (alt ? '<p>' + alt + '</p>' : '') + '</div><button type="button" class="kr-kapat" data-krkapat aria-label="Kapat">×</button></header>'; }

  /* bir gün (ya da haftanın bir günü) için: etkinlik + konu + set */
  function gunDuzenle(ctx, o) {
    var v = { konu: o.deger.konu || '', set: o.deger.set || null, etkinlik: o.deger.etkinlik || '' }, setler = ctx.setler();
    var p = katman(ctx, penBas(esc(o.baslik), 'Bir etkinlik seçin; önerilen konu kendiliğinden gelir, isterseniz değiştirin.') +
      '<div class="kr-govde"><h3>Etkinlik</h3><div class="kr-etk" data-etk>' + HAFTALIK.map(function (h) { return '<button type="button" data-e="' + esc(h.ad) + '" data-k="' + h.konu + '" aria-pressed="' + (v.etkinlik === h.ad) + '">' + esc(h.ad) + '</button>'; }).join('') +
      '</div><label class="kr-kendi">Ya da kendi etkinliğiniz<input data-ekendi maxlength="40" placeholder="Örn. Sonbahar şenliği" value="' + esc(HAFTALIK.some(function (h) { return h.ad === v.etkinlik; }) ? '' : v.etkinlik) + '"></label>' +
      '<h3>Konu</h3><select data-konu><option value="">Konu yok</option>' + V.KONU.filter(function (k) { return k.acik; }).map(function (k) { return '<option value="' + k.id + '"' + (k.id === v.konu ? ' selected' : '') + '>' + esc(k.en + ' · ' + k.tr) + '</option>'; }).join('') + '</select>' +
      '<h3>Kelime seti <small>(isteğe bağlı)</small></h3>' + (setler.length ? '<select data-set><option value="">Set yok</option>' + setler.map(function (s) { return '<option value="' + esc(s.id) + '"' + (v.set && (v.set.id || v.set) === s.id ? ' selected' : '') + '>' + esc(s.ad) + ' (' + s.kelimeler.length + ' kelime)</option>'; }).join('') + '</select>' : '<p class="kr-bos">Henüz set yok. “Setleri yönet”ten oluşturabilirsiniz.</p>') +
      '</div><footer class="kr-pen-alt"><button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-temizle>Temizle</button><button type="button" class="kl-dugme kl-dugme-k" data-kaydet data-odak>Kaydet</button></footer>', 'kr-gunp');
    var el = p.el, kendi = el.querySelector('[data-ekendi]'), ks = el.querySelector('[data-konu]'), ss = el.querySelector('[data-set]');
    el.querySelectorAll('[data-e]').forEach(function (b) { b.addEventListener('click', function () { var sec = b.getAttribute('aria-pressed') !== 'true'; el.querySelectorAll('[data-e]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', String(sec)); if (sec) { kendi.value = ''; if (!ks.dataset.elle) ks.value = b.getAttribute('data-k'); } }); });   /* öğretmen bu pencerede konuyu kendisi seçmediyse önerilen konu gelir */
    kendi.addEventListener('input', function () { if (kendi.value.trim()) el.querySelectorAll('[data-e]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); });
    ks.addEventListener('change', function () { ks.dataset.elle = '1'; });
    function topla() { var e = el.querySelector('[data-e][aria-pressed="true"]'); return { etkinlik: kendi.value.trim() || (e ? e.getAttribute('data-e') : ''), konu: ks.value, set: ss && ss.value ? setBul(setler, ss.value) : null }; }
    function gonder(val, b) { b.disabled = true; o.kaydet(val).then(function () { p.kapat(); }, function () { b.disabled = false; }); }
    el.querySelector('[data-kaydet]').addEventListener('click', function () { gonder(topla(), this); });
    el.querySelector('[data-temizle]').addEventListener('click', function () { gonder({ konu: '', set: null, etkinlik: '' }, this); });
    return p;
  }

  function haftaPanel(ctx) {
    var hafta = ctx.bulut ? (ctx.sinif.hafta || {}) : (yerelAl(ctx.okul.kod).hafta[ctx.sinif.id] || {}), setler = ctx.setler();
    var p = katman(ctx, penBas('Haftalık etkinlikler · ' + esc(ctx.sinif.ad), 'Her hafta tekrar eder. Tek bir güne ayrıca seçim yaparsanız o gün şablonun yerine geçer.') +
      '<div class="kr-govde"><ol class="kr-hafta">' + GUN.map(function (g, i) {
        var h = hafta[i + 1] || {}, b = { konu: h.konu, etkinlik: h.etkinlik, set: h.set ? setBul(setler, h.set) || null : null };
        return '<li><b>' + g + '</b><div class="kr-ozet">' + ozetHtml(b) + '</div><button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-hg="' + (i + 1) + '">Düzenle</button></li>';
      }).join('') + '</ol></div>', 'kr-haftap');
    p.el.querySelectorAll('[data-hg]').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = +b.getAttribute('data-hg'), h = hafta[n] || {};
        p.kapat();
        gunDuzenle(ctx, { baslik: 'Her ' + GUN[n - 1], deger: { konu: h.konu, etkinlik: h.etkinlik, set: h.set ? setBul(setler, h.set) : null }, kaydet: function (v) { return haftaKoy(ctx, n, v, 'Haftalık etkinlik kaydedildi: her ' + GUN[n - 1] + '.'); } });
      });
    });
  }

  function ozelPanel(ctx) {
    var l = yaklasan(new Date(), 58);
    var p = katman(ctx, penBas('Belirli gün ve haftalar', 'Önümüzdeki iki ay. Hafta sonuna denk gelen gün bir önceki Cuma\'ya konur. Tarihler önerilir; isterseniz başka güne de koyabilirsiniz.') +
      '<div class="kr-govde">' + (l.length ? '<ul class="kr-ozel">' + l.map(function (y, i) {
        var k = V.konuBul(y.o.konu), b = gunBilgi(ctx.sinif, y.gun, kaynakO(ctx)), var_ = b.etkinlik === y.o.ad;
        return '<li style="--r:' + k.renk + '"><span class="kr-ozel-t"><b>' + y.tarih.getDate() + '</b>' + AY[y.tarih.getMonth()].slice(0, 3) + '</span><div><b>' + esc(y.o.ad) + '</b><small>' + esc(k.en + ' · ' + k.tr) + (y.gun.getTime() !== y.tarih.getTime() ? ' · ' + tarihYaz(y.gun) + ' kutlanır' : '') + '</small></div>' +
          (var_ ? '<span class="kr-eklendi">' + C.simge('tik') + ' Takvimde</span>' : '<button type="button" class="kl-dugme kl-dugme-k" data-oz="' + i + '">Ekle</button>') + '</li>';
      }).join('') + '</ul>' : '<p class="kr-bos">Önümüzdeki iki ayda listede belirli gün yok.</p>') + '</div>', 'kr-ozelp');
    p.el.querySelectorAll('[data-oz]').forEach(function (b) {
      b.addEventListener('click', function () {
        var y = l[+b.getAttribute('data-oz')], eski = gunBilgi(ctx.sinif, y.gun, kaynakO(ctx)); b.disabled = true;
        gunKoy(ctx, V.gunAnahtar(y.gun), { konu: y.o.konu, set: eski.set, etkinlik: y.o.ad }, y.o.ad + ' takvime eklendi (' + tarihYaz(y.gun) + ').').then(function () { p.kapat(); }, function () { b.disabled = false; });
      });
    });
  }

  /* kelime setleri: liste + yeni/düzenle (konu sekmeleri, resimli kelime ızgarası, arama) */
  function setPanel(ctx) {
    var setler = ctx.setler();
    var p = katman(ctx, penBas('Kelime setlerimiz', 'Kreşinizin projelerine göre 3-20 kelimelik setler. Bir güne ya da haftalık etkinliğe set ekleyince çocuk o seti ayrı bir ada gibi oynar.') +
      '<div class="kr-govde">' + (setler.length ? '<ul class="kr-setler">' + setler.map(function (s) {
        var l = s.kelimeler.map(V.ogeBul).filter(Boolean);
        return '<li><div class="kr-set-r">' + l.slice(0, 4).map(function (x) { var k = V.ogeKonu(x.id); return '<i>' + K.al(k).gorsel(x) + '</i>'; }).join('') + '</div><div><b>' + esc(s.ad) + '</b><small>' + l.map(function (x) { return x.en; }).slice(0, 8).join(', ') + (l.length > 8 ? '…' : '') + '</small></div>' +
          '<button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-sd="' + esc(s.id) + '">Düzenle</button><button type="button" class="kr-sil" data-ss="' + esc(s.id) + '" aria-label="' + esc(s.ad) + ' setini sil">Sil</button></li>';
      }).join('') + '</ul>' : '<p class="kr-bos">Henüz set yok.</p>') + '</div><footer class="kr-pen-alt"><button type="button" class="kl-dugme kl-dugme-k" data-yeni data-odak>+ Yeni set</button></footer>', 'kr-setp');
    p.el.querySelector('[data-yeni]').addEventListener('click', function () { p.kapat(); setDuzenle(ctx, null); });
    p.el.querySelectorAll('[data-sd]').forEach(function (b) { b.addEventListener('click', function () { p.kapat(); setDuzenle(ctx, setBul(setler, b.getAttribute('data-sd'))); }); });
    p.el.querySelectorAll('[data-ss]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = setBul(setler, b.getAttribute('data-ss')); if (!W.confirm('“' + s.ad + '” seti silinsin mi? Bu setin seçildiği günlerde set kalkar.')) return;
        setSilSunucu(ctx, s.id).then(function () { p.kapat(); ctx.yenile('“' + s.ad + '” seti silindi.'); }, function (er) { hataGoster(ctx, er); });
      });
    });
  }
  function setDuzenle(ctx, set) {
    var sec = set ? set.kelimeler.slice() : [], acik = V.KONU.filter(function (k) { return k.acik; }), sekme = acik[0].id, ara = '';
    var p = katman(ctx, penBas(set ? 'Seti düzenle' : 'Yeni kelime seti', 'Kelimelere dokunarak seçin (en az 3, en çok 20).') +
      '<div class="kr-govde"><label class="kr-kendi">Set adı<input data-ad maxlength="40" placeholder="Örn. Sonbahar projemiz" value="' + esc(set ? set.ad : '') + '" data-odak></label>' +
      '<div class="kr-secili" data-secili aria-live="polite"></div>' +
      '<div class="kr-ara"><input data-ara type="search" placeholder="Kelime ara (İngilizce ya da Türkçe)" aria-label="Kelime ara"></div>' +
      '<div class="kr-sekmeler" role="tablist">' + acik.map(function (k) { return '<button type="button" role="tab" data-sk="' + k.id + '" style="--r:' + k.renk + '">' + C.simge(k.simge) + '<span>' + esc(k.tr) + '</span></button>'; }).join('') + '</div>' +
      '<ul class="kr-kelimeler" data-kel></ul><p class="kt-uyari" data-uyari role="alert"></p></div>' +
      '<footer class="kr-pen-alt"><button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-krkapat>Vazgeç</button><button type="button" class="kl-dugme kl-dugme-k" data-kaydet>Kaydet</button></footer>', 'kr-setd');
    var el = p.el, kel = el.querySelector('[data-kel]'), secili = el.querySelector('[data-secili]');
    function resim(id) { var x = V.ogeBul(id), k = V.ogeKonu(id); return x && k ? K.al(k).gorsel(x) : ''; }
    function ciz() {
      secili.innerHTML = '<b>' + sec.length + ' / 20</b>' + sec.map(function (id) { var x = V.ogeBul(id); return x ? '<button type="button" data-cik="' + id + '" aria-label="' + esc(x.en) + ' çıkar"><i>' + resim(id) + '</i>' + esc(x.en) + ' ×</button>' : ''; }).join('');
      var q = ara.trim().toLocaleLowerCase('tr'), l = [];
      if (q) acik.forEach(function (k) { K.hepsi(k.id).forEach(function (x) { if ((x.en + ' ' + x.tr).toLocaleLowerCase('tr').indexOf(q) >= 0) l.push(x); }); });
      else l = K.hepsi(sekme);
      kel.innerHTML = l.slice(0, 80).map(function (x) { var s = sec.indexOf(x.id) >= 0; return '<li><button type="button" data-kx="' + x.id + '" aria-pressed="' + s + '"><i>' + resim(x.id) + '</i><b lang="en">' + esc(x.en) + '</b><small>' + esc(x.tr) + '</small></button></li>'; }).join('') || '<li class="kr-bos">Bulunamadı.</li>';
      el.querySelectorAll('[data-sk]').forEach(function (b) { b.setAttribute('aria-selected', String(!q && b.getAttribute('data-sk') === sekme)); });
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kx], [data-cik], [data-sk]'); if (!b) return;
      if (b.hasAttribute('data-sk')) { sekme = b.getAttribute('data-sk'); ara = ''; el.querySelector('[data-ara]').value = ''; return ciz(); }
      var id = b.getAttribute('data-kx') || b.getAttribute('data-cik'), i = sec.indexOf(id);
      if (i >= 0) sec.splice(i, 1); else if (sec.length < 20) { sec.push(id); var x = V.ogeBul(id); if (x && SES) SES.soyle(x.en, 'en'); } else { el.querySelector('[data-uyari]').textContent = 'Bir sette en çok 20 kelime olur.'; return; }
      el.querySelector('[data-uyari]').textContent = ''; ciz();
    });
    el.querySelector('[data-ara]').addEventListener('input', function () { ara = this.value; ciz(); });
    el.querySelector('[data-kaydet]').addEventListener('click', function () {
      var ad = el.querySelector('[data-ad]').value.trim(), u = el.querySelector('[data-uyari]'), b = this;
      if (!ad) { u.textContent = 'Sete bir ad verin.'; return; }
      if (sec.length < 3) { u.textContent = 'En az 3 kelime seçin.'; return; }
      b.disabled = true;
      setKaydetSunucu(ctx, { id: set && set.id, ad: ad, kelimeler: sec }).then(function () { p.kapat(); ctx.yenile('“' + ad + '” seti kaydedildi.'); }, function (er) { b.disabled = false; if (er && (er.tur === 'oturum' || er.tur === 'lisans')) return ctx.cikis(er); u.textContent = er.message || String(er); });
    });
    ciz();
  }

  /* ---------------------------- bugün ne öğrendik? (veli kartı) ---------------------------- */
  function gunKelimeleri(sinif, b) {
    if (b.set) return b.set.kelimeler.map(V.ogeBul).filter(Boolean).slice(0, 10);
    var P = b.konu && K.al(b.konu); if (!P) return [];
    var bant = V.BANT[sinif.bant] || V.BANT.kasif; return P.ogeler(bant).slice(0, 10);
  }
  function resimOf(x) { var k = V.ogeKonu(x.id); return k ? K.al(k).gorsel(x) : ''; }
  /* evde sorulacak iki soru: Türkçe sorulur, cevap İngilizce kelime */
  function sorular(l) {
    if (!l.length) return [];
    var a = l[0], b = l[Math.min(l.length - 1, Math.floor(l.length / 2))];
    var r = ['“' + a.tr + '” İngilizce nasıl söylenir? (' + a.en + ')'];
    if (b && b !== a) r.push('Evde bir “' + b.tr + '” gösterin; çocuğunuz İngilizcesini söylesin. (' + b.en + ')');
    else r.push('Bugün hangi kelimeyi en çok sevdin? İngilizce söyler misin?');
    return r;
  }
  function kartVeri(ctx, d) {
    var b = gunBilgi(ctx.sinif, d, kaynakO(ctx)), l = gunKelimeleri(ctx.sinif, b), k = b.konu && V.konuBul(b.konu);
    return { okul: ctx.okul.ad, sinif: ctx.sinif.ad, tarih: tarihYaz(d), etkinlik: b.etkinlik, konu: k ? k.en + ' · ' + k.tr : '', set: b.set ? b.set.ad : '', kelimeler: l, sorular: sorular(l) };
  }
  function kartMetin(v) {
    return v.okul + ' · ' + v.sinif + '\n' + v.tarih + '\n\n' + (v.etkinlik ? 'Bugün: ' + v.etkinlik + '\n' : '') + (v.konu ? 'İngilizce konumuz: ' + v.konu + '\n' : '') + (v.set ? 'Kelime setimiz: ' + v.set + '\n' : '') +
      (v.kelimeler.length ? '\nÖğrendiğimiz kelimeler:\n' + v.kelimeler.map(function (x) { return '• ' + x.en + ' (' + x.tr + ')'; }).join('\n') + '\n' : '') +
      (v.sorular.length ? '\nEvde sorun:\n' + v.sorular.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n') + '\n' : '') +
      '\nAcadex Kids\'te evde de tekrar edebilirsiniz: acadex.com.tr/kids';
  }
  function kartHtml(v) {
    return '<article class="kr-gkart"><header><span class="kr-gkart-acd">' + C.acadia({ mood: 'kutlama' }) + '</span><div><small>' + esc(v.okul) + ' · ' + esc(v.sinif) + '</small><h3>Bugün ne öğrendik?</h3><p>' + esc(v.tarih) + '</p></div></header>' +
      '<div class="kr-gkart-cip">' + (v.etkinlik ? '<span>' + esc(v.etkinlik) + '</span>' : '') + (v.konu ? '<span>' + esc(v.konu) + '</span>' : '') + (v.set ? '<span>' + esc(v.set) + '</span>' : '') + '</div>' +
      (v.kelimeler.length ? '<ul class="kr-gkart-k">' + v.kelimeler.map(function (x) { return '<li><i>' + resimOf(x) + '</i><b lang="en">' + esc(x.en) + '</b><small>' + esc(x.tr) + '</small></li>'; }).join('') + '</ul>' : '<p class="kr-bos">Bugün için konu ya da set seçilmemiş.</p>') +
      (v.sorular.length ? '<div class="kr-gkart-s"><b>Evde sorun</b><ol>' + v.sorular.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div>' : '') +
      '<footer>Acadex Kids · evde de tekrar edin: <b>acadex.com.tr/kids</b></footer></article>';
  }
  function gunKarti(ctx, d) {
    var v = kartVeri(ctx, d), metin = kartMetin(v);
    var p = katman(ctx, penBas('Bugün ne öğrendik?', 'Velilere gönderin ya da yazdırıp çantaya koyun. Kartta çocuk adı ve sonucu yer almaz.') +
      '<div class="kr-govde">' + kartHtml(v) + '</div><footer class="kr-pen-alt"><button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-kopya>Metni kopyala</button><button type="button" class="kl-dugme kl-dugme-k kl-dugme-b" data-yaz>Yazdır</button><button type="button" class="kl-dugme kl-dugme-k" data-paylas data-odak>Paylaş</button></footer>', 'kr-kartp');
    var el = p.el;
    el.querySelector('[data-paylas]').addEventListener('click', function () {
      if (W.navigator.share) { W.navigator.share({ title: 'Bugün ne öğrendik?', text: metin }).catch(function () { }); return; }
      W.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank', 'noopener');
    });
    el.querySelector('[data-kopya]').addEventListener('click', function () { var b = this; (W.navigator.clipboard ? W.navigator.clipboard.writeText(metin) : Promise.reject()).then(function () { b.textContent = 'Kopyalandı ✓'; }, function () { W.prompt('Metni kopyalayın:', metin); }); });
    el.querySelector('[data-yaz]').addEventListener('click', function () {
      var w = W.open('', '_blank'); if (!w) return W.alert('Yeni sekme açılamadı; açılır pencere engelini kaldırın.');
      var css = Array.prototype.map.call(D.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
      w.document.open(); w.document.write('<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Bugün ne öğrendik?</title><style>' + css + '@page{size:A5;margin:10mm}body{background:#fff}.kr-gkart{box-shadow:none;margin:0 auto}</style></head><body class="kl kt">' + kartHtml(v) + '<script>setTimeout(function(){print()},400)<\/script></body></html>'); w.document.close();
    });
    return { veri: v, metin: metin };
  }

  W.KIDS_KRES = { HAFTALIK: HAFTALIK, OZEL: OZEL, ozelTarih: ozelTarih, isGunu: isGunu, yaklasan: yaklasan, gunBilgi: gunBilgi, setKimlik: setKimlik, setKaydet: setKaydet,
    cocukBant: cocukBant, bolum: bolum, bagla: bagla, konuKoy: konuKoy, kartVeri: kartVeri, kartMetin: kartMetin, sorular: sorular, gunKelimeleri: gunKelimeleri, yerelAl: yerelAl };
})(window);
