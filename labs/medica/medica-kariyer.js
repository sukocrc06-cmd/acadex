/* ==========================================================================
   ACADEX MEDICA · HASTANE KARİYERİ VE BAŞARIM VİTRİNİ (labs/medica/medica-kariyer.js), 28.11.2026
   Unvan ve XP ortak MedLab profilinden gelir (js/acadex-medlab-profil.js → AXPROFIL; bütün lab'lar).
   Unvanla açılanlar:
     Stajyer  kendi katın + giriş holü + konsültasyonla gidilen katlar · gündüz nöbeti
     İntörn   bütün katlar (asansörden) ve anatomi ara katları · gece nöbeti
     Asistan  yoğun gün nöbeti (kat dolu, 7 hasta)
     Uzman ve üstü: yaka kartının rengi ve unvanı
   Bölüm seçilmemişse hiçbir kat kilitli değildir. Tıp öğrencisine anatomi ara katları baştan açıktır.
   Başarımlar medica kaydından (gorulen, defter, sevk) hesaplanır; görülenler acadex.medica.basarim'da.
   medica.js bu dosyayı W.AXKARIYER olarak kullanır; dosya yoksa medica.js eskisi gibi çalışır.
   ========================================================================== */
(function (W) {
  'use strict';
  var PR = function () { return W.AXPROFIL ? W.AXPROFIL.hesap() : { xp: 0, sira: 0, unvan: { id: 'stajyer', ad: 'Stajyer', xp: 0, renk: '#7C8AA5' }, sonraki: null, oran: 0, lab: {} }; };
  var enAz = function (id, p) { return W.AXPROFIL ? W.AXPROFIL.enAz(id, p) : id === 'stajyer'; };
  var unvanAd = function (id) { var L = W.AXPROFIL ? W.AXPROFIL.UNVAN : []; for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i].ad; return id; };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var nf = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem('acadex.medica.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('acadex.medica.' + k, JSON.stringify(v)); } catch (e) { } }
  };

  /* ---------------- nöbet türleri ---------------- */
  var NOBET = [
    { id: 'gunduz', ad: 'Gündüz nöbeti', hasta: 4, basla: 8 * 60, unvan: 'stajyer', t: '08:00 · 4 hasta, triyaj masası ve bir acil kod.' },
    { id: 'gece', ad: 'Gece nöbeti', hasta: 5, basla: 20 * 60, unvan: 'intorn', t: '20:00 · 5 hasta. Gece ekip az, karar senin.' },
    { id: 'yogun', ad: 'Yoğun gün', hasta: 7, basla: 8 * 60, unvan: 'asistan', t: '08:00 · bekleme salonu dolu, 7 hasta. Triyaj daha da önemli.' }
  ];
  var nobetTur = function (id) { for (var i = 0; i < NOBET.length; i++) if (NOBET[i].id === id) return NOBET[i]; return NOBET[0]; };

  /* ---------------- kat kilidi (yalnız asansör seçimi; konsültasyon yolu açık kalır) ---------------- */
  var katAcik = function (kat, bolum, p) {
    if (!kat || !bolum || kat.id === bolum) return true;
    if (kat.ara && bolum === 'tip') return true;
    return enAz('intorn', p);
  };

  /* ---------------- başarımlar ---------------- */
  /* c: { S, V, hastalar(kat), p (profil) } */
  var gorulenL = function (c) { return Object.keys(c.S.gorulen || {}).map(function (id) { return c.S.gorulen[id]; }); };
  var puanL = function (c) { return gorulenL(c).map(c.V.hastaPuan).filter(function (x) { return x != null; }); };
  var def = function (c) { return c.S.defter || []; };
  var BASARIM = [
    { id: 'ilk-hasta', ad: 'İlk hasta', t: 'Bir hastayı odaya çağırıp görüşmeyi bitir.', s: 'H', k: function (c) { return gorulenL(c).length >= 1; } },
    { id: 'on-hasta', ad: 'Poliklinik ritmi', t: '10 hasta gör.', s: '10', k: function (c) { return gorulenL(c).length >= 10; } },
    { id: 'elli-hasta', ad: 'Hastanenin yükü', t: '50 hasta gör.', s: '50', k: function (c) { return gorulenL(c).length >= 50; } },
    { id: 'lab-devir', ad: 'Lab’a devir', t: 'Bir hastayı lab’a devredip lab puanı al.', s: 'L', k: function (c) { return gorulenL(c).some(function (g) { return g && g.lab != null; }); } },
    { id: 'ornek', ad: 'Örnek görüşme', t: 'Bir hastadan 90 ve üstü puan al.', s: '90', k: function (c) { return puanL(c).some(function (x) { return x >= 90; }); } },
    { id: 'ilk-nobet', ad: 'İlk nöbet', t: 'Bir nöbeti bitir ve karneni al.', s: 'N', k: function (c) { return def(c).length >= 1; } },
    { id: 'on-nobet', ad: 'Nöbet kurdu', t: '10 nöbet tamamla.', s: '10N', k: function (c) { return def(c).length >= 10; } },
    { id: 'nobet-85', ad: 'Çok iyi nöbet', t: 'Bir nöbeti 85 ve üstü ortalamayla bitir.', s: '85', k: function (c) { return def(c).some(function (n) { var o = c.V.nobetOzet(n); return o.gorulen >= 2 && o.ort >= 85; }); } },
    { id: 'triyaj', ad: 'Hatasız triyaj', t: 'Triyaj masasında bütün hastaları doğru renge koy (en az 3 hasta).', s: 'T', k: function (c) { return def(c).some(function (n) { return n.triyaj && !n.triyaj.atlandi && n.triyaj.toplam >= 3 && n.triyaj.dogru === n.triyaj.toplam; }); } },
    { id: 'kod', ad: 'Kodu yönettin', t: 'Acil kod olayını 70 ve üstü puanla bitir.', s: 'K', k: function (c) { return def(c).some(function (n) { return n.kod && n.kod.puan != null && n.kod.puan >= 70; }); } },
    { id: 'kod-100', ad: 'Kusursuz kod', t: 'Acil kodu hiç yanlış adım atmadan, süresinde bitir.', s: 'K+', k: function (c) { return def(c).some(function (n) { return n.kod && n.kod.puan === 100; }); } },
    { id: 'gece', ad: 'Gece kuşu', t: 'Bir gece nöbetini bitir (İntörn).', s: 'G', k: function (c) { return def(c).some(function (n) { return n.tur === 'gece'; }); } },
    { id: 'yogun', ad: 'Kalabalık salon', t: 'Bir yoğun gün nöbetini bitir (Asistan).', s: 'Y', k: function (c) { return def(c).some(function (n) { return n.tur === 'yogun'; }); } },
    { id: 'katim', ad: 'Katın hekimi', t: 'Kendi bölümünün katındaki bütün hastaları gör.', s: 'B', k: function (c) { var k = c.S.bolum && c.V.katBul(c.S.bolum); if (!k) return false; var L = c.hastalar(k); return L.length > 0 && L.every(function (s) { return c.S.gorulen[s.id]; }); } },
    { id: 'tur', ad: 'Hastane turu', t: '7 ana katın her birinde en az bir hasta gör.', s: '7', k: function (c) { return c.V.KAT.every(function (k) { return c.hastalar(k).some(function (s) { return c.S.gorulen[s.id]; }); }); } },
    { id: 'konsult', ad: 'Konsültasyon', t: 'Bir hastayı doğru bölüme sevk et.', s: 'S', k: function (c) { var s = c.S.sevk || {}; return Object.keys(s).some(function (z) { return s[z] && s[z].acik > 0; }); } },
    { id: 'gezgin', ad: 'MedLab gezgini', t: 'En az üç farklı lab’da XP kazan.', s: '3L', k: function (c) { var l = c.p.lab || {}; return Object.keys(l).filter(function (k) { return l[k] > 0; }).length >= 3; } },
    { id: 'u-intorn', ad: 'İntörn', t: '300 XP ile İntörn ol.', s: 'İ', k: function (c) { return enAz('intorn', c.p); } },
    { id: 'u-asistan', ad: 'Asistan', t: '1.000 XP ile Asistan ol.', s: 'A', k: function (c) { return enAz('asistan', c.p); } },
    { id: 'u-uzman', ad: 'Uzman', t: '2.500 XP ile Uzman ol.', s: 'U', k: function (c) { return enAz('uzman', c.p); } }
  ];
  /* kazanılanlar; yeni kazanılanları döndürür ve kaydeder */
  var kontrol = function (c) {
    c.p = c.p || PR();
    var kayit = ls.get('basarim', {}), yeni = [], ilk = !Object.keys(kayit).length && !ls.get('basarimIlk', false);
    BASARIM.forEach(function (b) { var ok = false; try { ok = !!b.k(c); } catch (e) { } if (ok && !kayit[b.id]) { kayit[b.id] = Date.now(); yeni.push(b); } });
    if (yeni.length) ls.set('basarim', kayit);
    if (ilk) ls.set('basarimIlk', true);
    return ilk ? [] : yeni;   /* ilk açılışta geçmişten gelenler için bildirim yağmuru olmasın */
  };
  var kazanilan = function () { return ls.get('basarim', {}); };
  /* unvan yükseldi mi (Medica içinde bir kez söyler) */
  var unvanDegisti = function (p) { p = p || PR(); var e = ls.get('unvanGor', null); ls.set('unvanGor', p.unvan.id); return e != null && W.AXPROFIL && W.AXPROFIL.sira(e) < p.sira ? p.unvan : null; };

  /* ---------------- çizim ---------------- */
  var foto = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7"/><path d="M7 36c1-8 6-12 13-12s12 4 13 12"/></svg>';
  /* lobide asılı küçük yaka kartı */
  var yakaHtml = function (p, bolumAd) {
    p = p || PR();
    return '<button type="button" class="mk-yaka" data-kariyer style="--uc:' + p.unvan.renk + '" aria-label="Kariyerin: ' + X(p.unvan.ad) + ', ' + p.xp + ' XP. Başarım vitrinini aç">' +
      '<i class="mk-ip" aria-hidden="true"></i><span class="mk-foto">' + foto + '</span><b>' + X(p.unvan.ad.toLocaleUpperCase('tr')) + '</b>' +
      '<small>' + X(bolumAd || 'Acadex Medica') + '</small><span class="mk-xp"><i style="width:' + Math.round(p.oran * 100) + '%"></i></span><em>' + nf(p.xp) + ' XP</em></button>';
  };
  var acilan = function (p) {
    var L = [
      ['stajyer', 'Kendi katın, giriş holü ve gündüz nöbeti'],
      ['intorn', 'Asansörle bütün katlar, anatomi ara katları ve gece nöbeti'],
      ['asistan', 'Yoğun gün nöbeti: bekleme salonu dolu, 7 hasta'],
      ['uzman', 'Mor yaka kartı'], ['docent', 'Kırmızı yaka kartı'], ['profesor', 'Altın yaka kartı']
    ];
    return '<ol class="mk-ac">' + L.map(function (x) { var ok = enAz(x[0], p); return '<li class="' + (ok ? 'ok' : '') + '"><b>' + X(unvanAd(x[0])) + '</b><span>' + X(x[1]) + '</span>' + (ok ? '' : '<i aria-label="kilitli">' + kilit + '</i>') + '</li>'; }).join('') + '</ol>';
  };
  var kilit = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  var madalya = function (b, ok) {
    return '<li class="mk-m' + (ok ? ' ok' : '') + '"><span class="mk-mi" aria-hidden="true"><svg viewBox="0 0 48 48"><path class="kurdele" d="M14 2h8l4 14h-8zM34 2h-8l-4 14h8z"/><circle cx="24" cy="30" r="15"/><circle class="ic" cx="24" cy="30" r="11"/></svg><b>' + X(b.s) + '</b></span>' +
      '<span class="mk-mt"><b>' + X(b.ad) + '</b><small>' + (ok ? new Date(ok).toLocaleDateString('tr-TR') : X(b.t)) + '</small></span></li>';
  };
  /* kariyer penceresi (medica.js modal() içine) */
  var pencereHtml = function (o) {
    var p = o.p || PR(), kz = kazanilan(), n = BASARIM.filter(function (b) { return kz[b.id]; }).length;
    return '<div class="mk-pen" style="--uc:' + p.unvan.renk + '"><span class="k">hastane kariyeri</span><h2 id="md-mt">' + X(p.unvan.ad) + '</h2>' +
      '<div class="mk-ust"><div class="mk-yaka mk-buyuk" aria-hidden="true"><i class="mk-ip"></i><span class="mk-foto">' + foto + '</span><b>' + X(p.unvan.ad.toLocaleUpperCase('tr')) + '</b><small>' + X(o.bolumAd || 'Acadex Medica') + '</small></div>' +
      '<div class="mk-xpk"><p><b class="mono">' + nf(p.xp) + ' XP</b>' + (p.sonraki ? ' · ' + X(p.sonraki.ad) + ' için ' + nf(p.sonraki.xp - p.xp) + ' XP daha' : ' · en üst unvan') + '</p>' +
      '<div class="mk-bar"><i style="width:' + Math.round(p.oran * 100) + '%"></i></div>' +
      '<p class="sub">XP bütün MedLab’den gelir: hasta görüşmeleri, nöbetler, Anatomi ve Fizyo’da incelediğin yapılar, depo, Diyet ve Odyoloji vakaları.</p>' + acilan(p) + '</div></div>' +
      '<h3 class="mk-vt">Başarım vitrini <small>' + n + ' / ' + BASARIM.length + '</small></h3>' +
      '<ul class="mk-vitrin">' + BASARIM.map(function (b) { return madalya(b, kz[b.id]); }).join('') + '</ul>' +
      '<div class="md-row"><button type="button" class="md-btn pri" data-kapat>Kapat</button></div></div>';
  };
  /* nöbet türü seçimi */
  var nobetSecHtml = function (o) {
    var p = o.p || PR();
    return '<div class="mk-pen"><span class="k">nöbet · ' + X(o.katAd) + '</span><h2 id="md-mt">Hangi nöbet?</h2><div class="mk-nb">' +
      NOBET.map(function (t) { var ok = enAz(t.unvan, p), n = Math.min(t.hasta, o.hastaSay); return '<button type="button" class="mk-nbt" data-nobet-tur="' + t.id + '"' + (ok ? '' : ' disabled aria-disabled="true"') + '><b>' + X(t.ad) + '</b><span>' + X(t.t.replace(/\d+ hasta/, n + ' hasta')) + '</span>' + (ok ? '' : '<em>' + kilit + X(unvanAd(t.unvan)) + ' olunca</em>') + '</button>'; }).join('') +
      '</div></div>';
  };

  W.AXKARIYER = { NOBET: NOBET, nobetTur: nobetTur, BASARIM: BASARIM, katAcik: katAcik, kontrol: kontrol, kazanilan: kazanilan, unvanDegisti: unvanDegisti, profil: PR, enAz: enAz, unvanAd: unvanAd, yakaHtml: yakaHtml, pencereHtml: pencereHtml, nobetSecHtml: nobetSecHtml, kilit: kilit };
})(window);
