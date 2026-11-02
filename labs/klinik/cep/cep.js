/* ==========================================================================
   ACADEX MEDICA · ÇEP vaka bankası çekirdeği (labs/klinik/cep/cep.js), 01.11.2026
   Ulusal Çekirdek Eğitim Programı (ÇEP) mantığıyla sisteme göre hastalık kataloğu ve
   parametrik hasta üretici. Her hastalık bir şablondur; üretici tohumdan
   (ziyaret/nöbet) her seferinde farklı bir hasta çıkarır: yaş, cinsiyet, eşlik eden
   hastalıklar, vital bulgular ve tetkik değerleri, tipik ya da atipik başvuru,
   ÇEP öğrenme düzeyine göre görev (Acil, Ön tanı, Tanı, Tanı-tedavi, İzlem, Korunma).
   Üretilen vaka labs/klinik/klinik.js sahne biçimindedir; sonunda Anatomi Lab'e
   "3B modelde yapıları bul" devri vardır (vaka: 'cep:<hastalık>').

   Veri dosyaları: cep/<sistem>.js → AXCEP.ekle('<sistem>', [ ...hastalıklar ]).
   Hastalık şablonu:
     { id, ad, yak (bekleme salonunda görünen yakınma), d: 'A T K' (ÇEP düzeyleri), yas: [alt, üst],
       e: erkek olasılığı, oda, if (yüz ifadesi), v: { n: nabız, s/d: tansiyon, o: SpO2, a: ateş } aralıkları,
       risk: 'ht dm hl sigara …' (+ön ek: her zaman), kim: 'refakat' (çocukta öyküyü yakını anlatır),
       sik: [yakınma], atip: [koşul, olasılık, atipik yakınma, mentor notu],
       oyku: [[id, soru, cevap, puan, not]], muay: [[id, iş, bulgu, puan, (monitor)]],
       tet: [[id, tetkik, sonuç, puan]], gor: [id, görüntüleme, bulgu, puan],
       ayr: [[ayırıcı tanı, neden değil]], ozet: tanının dayanağı,
       g: { DÜZEY: [soru, [doğru, açıklama], [[yanlış, neden], …]] },
       ana: [görev metni, [[3B yapı adı, görev, ipucu], …], açıklama] }
   Sonuç metinlerinde {12-40} tam sayı, {1,2-3,4} ondalık rastgele değer üretir.
   EĞİTİM AMAÇLIDIR; vakalar kurgusaldır, tedavi kararı için kaynak değildir.
   ========================================================================== */
(function (root, factory) {
  var C = factory();
  if (typeof module === 'object' && module.exports) module.exports = C; else root.AXCEP = C;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var C = {};

  /* ÇEP öğrenme düzeyleri (Ulusal ÇEP, mezuniyet öncesi tıp eğitimi) */
  C.DUZEY = {
    A: { ad: 'Acil', t: 'Acil durumu tanımlar, acil tedavisini yapar, gerekirse uzmana yönlendirir.' },
    OnT: { ad: 'Ön tanı', t: 'Ön tanı koyar, gerekli ön işlemleri yaparak uzmana yönlendirir.' },
    T: { ad: 'Tanı', t: 'Tanı koyar, tedavi hakkında bilgi sahibidir, ön işlemleri yaparak uzmana yönlendirir.' },
    TT: { ad: 'Tanı-tedavi', t: 'Tanı koyar ve tedaviyi kendisi yapar.' },
    I: { ad: 'İzlem', t: 'Birinci basamakta uzun süreli izlem ve kontrolünü yapar.' },
    K: { ad: 'Korunma', t: 'Birincil, ikincil ve üçüncül korunma önlemlerini uygular.' }
  };

  /* sistemler: Medica'da 1. katın üstündeki anatomi ara katları (A1–A8) */
  var M = function (ad, unvan, cins) { return { ad: ad, unvan: unvan || 'Dr.', cins: cins || 'E' }; };
  C.SISTEM = [
    { id: 'kv', ad: 'Kalp ve damar', etiket: 'A1', renk: '#C42232', acik: '#FBE5E7', mentor: M('Arda'), oda: 'Kardiyoloji polikliniği',
      kars: 'Kalp ve damar ara katı. Göğüs ağrısından bacak şişliğine kadar dolaşım sistemi hastaları burada. Görüşmeden sonra 3B modelde damarı ve kalbin bölümlerini bulacaksın.' },
    { id: 'noro', ad: 'Beyin ve sinir', etiket: 'A2', renk: '#B8862B', acik: '#FBF1DC', mentor: M('Nil', 'Dr.', 'K'), oda: 'Nöroloji polikliniği',
      kars: 'Beyin ve sinir ara katı. Nörolojik yakınmayı bir yere bağla: korteks mi, beyin sapı mı, omurilik mi, periferik sinir mi? Sonra 3B modelde lezyonun yerini bul.' },
    { id: 'sol', ad: 'Solunum', etiket: 'A3', renk: '#2F7FB8', acik: '#E2EFF8', mentor: M('Cem'), oda: 'Göğüs hastalıkları polikliniği',
      kars: 'Solunum ara katı. Nefes darlığı, öksürük, göğüs ağrısı. Satürasyonu ve solunum sayısını hep aklında tut; sonra 3B modelde akciğer lobunu ve ilgili yapıları bul.' },
    { id: 'sind', ad: 'Sindirim', etiket: 'A4', renk: '#C9711E', acik: '#FCEBD9', mentor: M('Ece', 'Dr.', 'K'), oda: 'Genel cerrahi ve gastroenteroloji polikliniği',
      kars: 'Sindirim ara katı. Karın ağrısının yeri, yayılımı ve zamanlaması tanının yarısıdır. Sonra 3B modelde organı ve kanlanmasını bul.' },
    { id: 'uro', ad: 'Böbrek, idrar yolu ve üreme', etiket: 'A5', renk: '#7A4FA8', acik: '#EFE8F9', mentor: M('Kaan'), oda: 'Üroloji ve nefroloji polikliniği',
      kars: 'Ürogenital ara kat. Yan ağrısı, idrar yakınmaları, skrotal ağrı. Bazı tablolar dakikalarla yarışır; sonra 3B modelde böbrek, mesane ve genital yapıları bul.' },
    { id: 'kas', ad: 'Kas ve iskelet', etiket: 'A6', renk: '#1E8A55', acik: '#E3F4EA', mentor: M('Mert'), oda: 'Ortopedi polikliniği',
      kars: 'Kas-iskelet ara katı. Ağrıyı, gücü, duyuyu ve refleksi birlikte değerlendir; sinir kökünü ya da tendonu bul. Sonra 3B modelde kası, siniri ve kemiği göster.' },
    { id: 'end', ad: 'Endokrin', etiket: 'A7', renk: '#D6457A', acik: '#FBE4EE', mentor: M('Selin', 'Dr.', 'K'), oda: 'Endokrinoloji polikliniği',
      kars: 'Endokrin ara katı. Belirtiler sinsi, laboratuvar konuşur. Hormon eksenini düşün: hipotalamus, hipofiz, hedef bez. Sonra 3B modelde bezi bul.' },
    { id: 'bb', ad: 'Baş-boyun ve duyu', etiket: 'A8', renk: '#2E9C86', acik: '#E1F3EF', mentor: M('Defne', 'Dr.', 'K'), oda: 'KBB ve göz polikliniği',
      kars: 'Baş-boyun ve duyu ara katı. Boğaz, burun, kulak ve göz. Havayolunu tehdit eden tabloyu kaçırma; sonra 3B modelde yapıyı bul.' }
  ];
  C.sistem = function (id) { return C.SISTEM.filter(function (s) { return s.id === id; })[0] || null; };

  /* ortak dikkat dağıtıcı seçenekler: kararı değiştirmeyen soru, gereksiz ya da zararlı tetkik */
  var HAVUZ = {
    oyku: [
      ['hobi', 'Boş zamanlarınızda ne yapmayı seversiniz?', 'Bahçeyle uğraşırım, kitap okurum.'],
      ['tatil', 'En son ne zaman tatile çıktınız?', 'Geçen yaz memlekete gittik.'],
      ['kan', 'Kan grubunuzu biliyor musunuz?', 'A Rh pozitif diye hatırlıyorum.'],
      ['asi', 'Çocukluk aşıları tam mıydı?', 'Annem tam yaptırdığını söylerdi.'],
      ['dogum', 'Normal doğumla mı doğdunuz?', 'Bilmiyorum, hiç sormadım.'],
      ['ev', 'Evde evcil hayvan var mı?', 'Bir kedimiz var.'],
      ['meslek2', 'İş yerinizde vardiyalı mı çalışıyorsunuz?', 'Hayır, gündüz çalışıyorum.'],
      ['ayakkabi', 'Ayakkabı numaranız kaç?', '42 giyiyorum.']
    ],
    yargi: [
      ['yargi', 'Neden bu kadar geç geldiniz?', 'İşten çıkamadım, geçer sandım…', 'Suçlayıcı soru hastayı savunmaya iter ve bilgi getirmez. Gecikmenin nedenini tarafsız sor.'],
      ['yargi', 'İnternette okuyup kendinize tanı koymadınız umarım?', 'Biraz baktım ama korktum…', 'Küçümseyici yorum güveni sarsar; hastanın kaygısını açık uçlu soruyla öğren.'],
      ['yargi', 'Kendinize hiç dikkat etmiyorsunuz, değil mi?', 'Elimden geleni yapıyorum…', 'Yargılayıcı yorum bilgi akışını keser. Yaşam tarzını tarafsız sorularla öğren.']
    ],
    muay: [
      ['boy', 'Boy ve kilo ölç', 'Ölçüldü; bu vakada acil kararını değiştirmiyor.', 0],
      ['gorme', 'Göz eşeli ile görme keskinliğine bak', 'İki gözde 10/10. Bu yakınmayla ilişkisi yok.', 0],
      ['patella', 'Patella refleksine bak', 'Normoaktif. Bu vakada kararını değiştirmez.', 0],
      ['dis', 'Ağız içi ve dişleri muayene et', 'Doğal görünümde; bu yakınmayla ilişkili değil.', 0]
    ],
    tet: [
      ['tumbt', 'Tüm vücut BT çek', 'Ek bir şey göstermedi; hasta gereksiz radyasyon aldı ve süre kaybedildi.', -2],
      ['vitd', 'D vitamini düzeyi iste', 'Sonuç günler sonra gelir; bugünkü kararını değiştirmez.', 0],
      ['tmark', 'Tümör belirteçleri paneli iste', 'Tarama amaçlı panel önerilmez; yanlış pozitifler gereksiz kaygı ve girişim doğurur.', -1],
      ['alerjipanel', 'Geniş alerji paneli iste', 'Bu tabloda yeri yok; maliyet ve zaman kaybı.', 0]
    ]
  };
  C.HAVUZ = HAVUZ;

  /* eşlik eden hastalıklar: öykü, ilaç ve alışkanlık yanıtları üreticiden gelir */
  var KOMORB = {
    ht: { ad: 'yüksek tansiyon', ilac: 'tansiyon ilacı (amlodipin)' },
    dm: { ad: 'tip 2 şeker hastalığı', ilac: 'şeker ilacı (metformin)' },
    dm1: { ad: 'tip 1 şeker hastalığı', ilac: 'insülin (günde dört kez)' },
    hl: { ad: 'yüksek kolesterol', ilac: 'kolesterol ilacı (atorvastatin)' },
    koah: { ad: 'KOAH', ilac: 'nefes açıcı inhaler (tiotropium)' },
    astim: { ad: 'astım', ilac: 'gerektikçe mavi kurtarıcı sprey ve koruyucu inhaler' },
    hipo: { ad: 'tiroit tembelliği', ilac: 'tiroit hapı (levotiroksin)' },
    af: { ad: 'ritim bozukluğu (atriyal fibrilasyon)', ilac: 'ritim ilacı; kan sulandırıcıyı kanama olur diye bıraktım' },
    kah: { ad: 'kalp damar hastalığı (stent takıldı)', ilac: 'aspirin ve kolesterol ilacı' },
    siroz: { ad: 'karaciğer sirozu (hepatit B)', ilac: 'idrar söktürücü (spironolakton)' },
    bph: { ad: 'prostat büyümesi', ilac: 'prostat ilacı (tamsulosin)' },
    osteo: { ad: 'kemik erimesi', ilac: 'kalsiyum ve D vitamini' },
    epi: { ad: 'epilepsi', ilac: 'sara ilacı (levetirasetam), son günlerde aksattım' },
    steroid: { ad: 'romatoid artrit', ilac: 'uzun süredir kortizon (prednizolon)' },
    kbh: { ad: 'böbrek yetmezliğinin erken evresi', ilac: 'tansiyon ilacı (ramipril)' }
  };
  C.KOMORB = KOMORB;
  /* triyajda her zaman kırmızı: dakikalarla yarışılan tanılar */
  var KIRMIZI = ['kv-stemi', 'kv-diseksiyon', 'kv-aaa', 'no-inme', 'no-sak', 'no-menenjit', 'no-status', 'so-pe', 'so-yabanci', 'si-ulser', 'si-siroz', 'si-mezenter', 'ur-torsiyon', 'ka-kompartman', 'en-dka', 'en-hipoglisemi', 'en-addison', 'bb-epiglottit', 'bb-glokom'];

  /* ---------------- kayıt ---------------- */
  C.H = {};
  C.liste = function (sis) { return Object.keys(C.H).map(function (k) { return C.H[k]; }).filter(function (h) { return !sis || h.sis === sis; }); };
  C.ekle = function (sis, list) { (list || []).forEach(function (h) { h.sis = sis; C.H[h.id] = h; }); };
  C.duzeyler = function (h) { return String(h.d || '').split(/\s+/).filter(function (x) { return C.DUZEY[x]; }); };
  C.anatomi = function (hid) { var h = C.H[hid]; if (!h || !h.ana) return null; return { metin: h.ana[0], yapilar: h.ana[1].map(function (y) { return { ad: y[0], gorev: y[1], ipucu: y[2] }; }), ex: h.ana[2], ad: h.ad, sis: h.sis }; };

  /* ---------------- rastgelelik ---------------- */
  C.hash = function (t) { var h = 2166136261; t = String(t); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  C.rng = function (seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  var karistir = function (a, r) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  var aralik = function (x, r, ond) { var lo = x[0], hi = x[1], v = lo + r() * (hi - lo); return ond ? Math.round(v * Math.pow(10, ond)) / Math.pow(10, ond) : Math.round(v); };
  var trSayi = function (v, ond) { return ond ? v.toFixed(ond).replace('.', ',') : String(v); };
  /* "{12-40}" → tam sayı, "{1,2-3,4}" → ondalık; yer tutucular: {ad} hitap, {yas} */
  C.doldur = function (t, r, kisi) {
    return String(t).replace(/\{(\d+(?:,\d+)?)-(\d+(?:,\d+)?)\}/g, function (m, a, b) {
      var ond = Math.max((a.split(',')[1] || '').length, (b.split(',')[1] || '').length);
      return trSayi(aralik([parseFloat(a.replace(',', '.')), parseFloat(b.replace(',', '.'))], r, ond), ond);
    }).replace(/\{ad\}/g, kisi ? kisi.hitap : '').replace(/\{yas\}/g, kisi ? String(kisi.yas) : '');
  };

  var VARSAYILAN_AD = { E: ['Murat', 'Kemal', 'Hakan', 'Osman', 'Burak', 'Emre', 'Efe', 'Kerem'], K: ['Aslı', 'Derya', 'Fatma', 'Ayşe', 'Merve', 'Selin', 'Ela', 'Zeynep'] };
  var KIYAFET = ['#3E6E9E', '#C8573A', '#2E8E7E', '#7A4FA8', '#E0A526', '#4E9A6A', '#9E5B7A', '#2F6BFF', '#6E5236', '#5E8F4A'];

  /* ---------------- üretici ----------------
     o: { onek (sahne kimliği öneki), sira (aynı hastalıktan ikinci hasta), adSec(cins, yas, r) → ad, duzey (zorla) } */
  C.uret = function (hid, tohum, o) {
    o = o || {}; var h = C.H[hid]; if (!h) return null;
    var S = C.sistem(h.sis), r = C.rng(C.hash(String(tohum) + '|' + hid + '|' + (o.sira || 0)));
    /* kişi */
    var yas = aralik(h.yas || [30, 70], r), cins = r() < (h.e == null ? 0.5 : h.e) ? 'E' : 'K';
    var gor = yas < 13 ? 'cocuk' : yas < 30 ? 'genc' : yas < 65 ? 'yetiskin' : 'yasli';
    var ad = (o.adSec && o.adSec(cins, yas, r)) || VARSAYILAN_AD[cins][Math.floor(r() * VARSAYILAN_AD[cins].length)];
    var hitap = yas < 18 ? ad : ad + (cins === 'E' ? ' Bey' : ' Hanım');
    var kisi = { ad: ad, hitap: hitap, yas: yas, cins: cins };
    var cocuk = gor === 'cocuk' || h.kim === 'refakat';
    var refakat = cocuk ? { ad: r() < 0.6 ? 'Annesi' : 'Babası', cins: 'K', gorunum: 'yetiskin', kiyafet: KIYAFET[Math.floor(r() * KIYAFET.length)], ifade: 'endise' } : null;
    if (refakat && refakat.ad === 'Babası') refakat.cins = 'E';
    /* eşlik eden hastalıklar ve alışkanlık */
    var risk = String(h.risk || '').split(/\s+/).filter(Boolean), kom = [], sigara = false;
    risk.forEach(function (k) {
      var zorunlu = k.charAt(0) === '+', id = zorunlu ? k.slice(1) : k;
      if (id === 'sigara') { if (zorunlu || (yas >= 18 && r() < 0.6)) sigara = true; return; }
      if (KOMORB[id] && (zorunlu || (yas >= 35 && r() < 0.5))) kom.push(id);
    });
    if (!cocuk && yas >= 50 && r() < 0.35) { var ek = ['ht', 'hl', 'hipo'][Math.floor(r() * 3)]; if (kom.indexOf(ek) < 0 && !(ek === 'hipo' && h.sis === 'end')) kom.push(ek); }
    var profil = cocuk ? null : {
      oz: kom.length ? 'Bende ' + kom.map(function (k) { return KOMORB[k].ad; }).join(', ') + ' var.' : 'Bilinen bir hastalığım yok, ameliyat da olmadım.',
      ilac: kom.length ? 'Düzenli ' + kom.map(function (k) { return KOMORB[k].ilac; }).join(', ') + ' kullanıyorum.' : 'Düzenli kullandığım bir ilaç yok.',
      alis: sigara ? 'Günde ' + (r() < 0.5 ? 'bir' : 'bir buçuk') + ' paket sigara içiyorum, ' + Math.max(5, Math.min(yas - 15, aralik([10, 40], r))) + ' yıldır.' : 'Sigara da alkol de kullanmıyorum.'
    };
    /* atipik başvuru */
    var atipik = false;
    if (h.atip) {
      var kos = String(h.atip[0]).split('|'), uygun = kos.some(function (k) { return (k === 'yasli' && yas >= 65) || (k === 'dm' && (kom.indexOf('dm') >= 0 || kom.indexOf('dm1') >= 0)) || (k === 'K' && cins === 'K') || (k === 'cocuk' && cocuk) || k === 'hep'; });
      atipik = uygun && r() < h.atip[1];
    }
    /* vital bulgular */
    var v = h.v, vital = null;
    if (v) {
      vital = {};
      if (v.n) vital.nabiz = aralik(v.n, r);
      if (v.s) vital.ta = aralik(v.s, r) + '/' + aralik(v.d || [70, 90], r);
      if (v.o) vital.spo2 = aralik(v.o, r);
      if (v.a) vital.ates = trSayi(aralik(v.a, r, 1), 1);
    }
    /* triyaj: zamana duyarlı tanılar ve bozuk vital bulgular kırmızı; acile gelen diğerleri sarı; poliklinik yeşil */
    var sist = vital && vital.ta ? parseInt(vital.ta, 10) : 200, tri;
    if (KIRMIZI.indexOf(hid) >= 0 || (vital && ((vital.spo2 != null && vital.spo2 < 92) || sist < 95 || vital.nabiz >= 125))) tri = ['kirmizi', h.yak + ': zamanla yarışılan bir tablo olabilir ya da vital bulgular bozuk; hemen değerlendir.'];
    else if (h.oda === 'acil') tri = ['sari', h.yak + ', vital bulgular şu an stabil: kısa sürede değerlendir.'];
    else tri = ['yesil', 'Genel durumu iyi, vital bulguları stabil: planlı poliklinik başvurusu.'];
    /* "erkek metni||kadın metni": cinsiyete göre yanıt */
    var dol = function (t) { t = String(t); if (t.indexOf('||') >= 0) t = t.split('||')[cins === 'K' ? 1 : 0]; return C.doldur(t, r, kisi); };
    var kimOf = function () { return cocuk ? 'refakat' : null; };
    var A = [];
    /* 1) yakınma */
    var sik = atipik ? h.atip[2] : h.sik[Math.floor(r() * h.sik.length)];
    A.push({ tip: 'konus', kim: cocuk ? 'refakat' : 'hasta', metin: dol(sik) });
    A.push({ tip: 'konus', kim: 'mentor', metin: ['Yakınmayı dinledin. Şimdi tanıyı daraltacak soruları seç.', 'Önce öykü: en çok bilgi getirecek soruları seç.', 'Hastayı dinledin; şimdi hedefe yönelik sor. Her sorunun bir gerekçesi olsun.'][Math.floor(r() * 3)] });
    /* 2) anamnez */
    var yg = HAVUZ.yargi[Math.floor(r() * HAVUZ.yargi.length)];
    var dis = karistir(HAVUZ.oyku, r).slice(0, 2).map(function (x) { return { id: 'h-' + x[0], t: x[1], cevap: x[2], puan: 0, kim: kimOf() }; });
    var oy = h.oyku.map(function (x) { return { id: x[0], t: x[1], cevap: dol(x[2]), puan: x[3], not: x[4] ? dol(x[4]) : null, kim: kimOf() }; });
    var pozitif = oy.filter(function (x) { return x.puan > 0; }).length;
    A.push({ tip: 'sor', baslik: 'Anamnez', hak: pozitif >= 4 ? 3 : pozitif, yonerge: 'tanıyı daraltan soruları seç', secenek: karistir(oy.concat(dis, [{ id: 'yargi', t: yg[1], cevap: yg[2], puan: -2, kim: kimOf(), geri: yg[3] }]), r) });
    /* 3) muayene */
    var mu = h.muay.map(function (x) { var e = { id: x[0], t: x[1], sonuc: dol(x[2]), puan: x[3] }; if (x[4] === 'monitor') e.anim = 'monitor'; if (x[4] && x[4] !== 'monitor') e.geri = x[4]; return e; });
    var md = HAVUZ.muay[Math.floor(r() * HAVUZ.muay.length)];
    A.push({ tip: 'eylem', baslik: 'Fizik muayene', yonerge: 'gerekenleri yap', secenek: karistir(mu.concat([{ id: 'h-' + md[0], t: md[1], sonuc: md[2], puan: md[3] }]), r) });
    /* 4) tetkik ve görüntüleme */
    var te = (h.tet || []).map(function (x) { var e = { id: x[0], t: x[1], sonuc: dol(x[2]), puan: x[3] }; if (x[4]) e.geri = x[4]; return e; });
    if (h.gor) te.push({ id: h.gor[0], t: h.gor[1], sonuc: dol(h.gor[2]), puan: h.gor[3], goruntu: true });
    var td = karistir(HAVUZ.tet, r).slice(0, 2).map(function (x) { return { id: 'h-' + x[0], t: x[1], sonuc: x[2], puan: x[3] }; });
    A.push({ tip: 'eylem', baslik: 'Tetkik ve görüntüleme', yonerge: 'gerekli olanları iste', secenek: karistir(te.concat(td), r) });
    /* 5) ayırıcı tanı */
    var tani = [{ t: h.ad, dogru: true, geri: h.ozet || 'Öykü, muayene ve tetkik bu tanıyı destekliyor.' }].concat(h.ayr.map(function (x) { return { t: x[0], dogru: false, geri: x[1] }; }));
    A.push({ tip: 'karar', baslik: 'Ayırıcı tanı', soru: 'Bulgular en çok hangi tanıyı destekliyor?', secenek: karistir(tani, r) });
    /* 6) ÇEP düzeyine göre görev */
    var Ds = C.duzeyler(h).filter(function (k) { return h.g && h.g[k]; }), dz = o.duzey && h.g && h.g[o.duzey] ? o.duzey : Ds[Math.floor(r() * Ds.length)];
    var g = h.g[dz], DZ = C.DUZEY[dz];
    A.push({ tip: 'konus', kim: 'mentor', metin: (atipik && h.atip[3] ? 'Dikkat: ' + dol(h.atip[3]) + ' ' : '') + 'Bu hastalık ÇEP’te «' + DZ.ad + '» düzeyinde: ' + DZ.t.charAt(0).toLocaleLowerCase('tr') + DZ.t.slice(1) + ' Şimdi buna göre karar ver.' });
    A.push({ tip: 'karar', baslik: 'ÇEP görevi · ' + DZ.ad, soru: dol(g[0]), secenek: karistir([{ t: dol(g[1][0]), dogru: true, geri: dol(g[1][1]) }].concat(g[2].map(function (x) { return { t: dol(x[0]), dogru: false, geri: dol(x[1]) }; })), r) });
    /* 7) Anatomi Lab devri */
    A.push({ tip: 'devir', metin: h.ana ? h.ana[0] : 'Vaka tamamlandı.', dugme: '3B modelde yapıları bul', hedef: 'model' });
    var id = (o.onek || 'cep-') + hid + (o.sira ? '-' + o.sira : '');
    return {
      id: id, vaka: 'cep:' + hid, lab: 'anatomi', oda: h.oda || 'poliklinik', odaAd: h.oda === 'acil' ? 'Acil servis' : (S ? S.oda : 'Poliklinik'),
      baslik: h.yak || h.ad, tani: h.ad,
      hasta: { ad: ad, hitap: hitap, yas: yas, cins: cins, gorunum: gor, kiyafet: KIYAFET[Math.floor(r() * KIYAFET.length)], ifade: h.if || 'agri', poz: h.oda === 'acil' ? 'yat' : 'otur', gebe: false },
      refakat: refakat, mentor: S ? S.mentor : M('Deniz', 'Dr.', 'K'), vital: vital, adimlar: A, profil: profil,
      triyaj: tri, cep: { hid: hid, sis: h.sis, duzey: dz, atipik: atipik, kom: kom, sigara: sigara }
    };
  };

  /* bir ziyaretin hastaları: her sistemden n hastalık (tohumlu seçim) */
  C.ziyaret = function (sis, tohum, n, o) {
    var L = C.liste(sis), r = C.rng(C.hash('cep-ziyaret|' + sis + '|' + tohum));
    return karistir(L, r).slice(0, Math.min(n || 6, L.length)).map(function (h) { return C.uret(h.id, tohum, o); });
  };

  /* ---------------- denetim (testler için) ---------------- */
  C.denetle = function (h) {
    var e = [], k = function (m) { e.push(h.id + ': ' + m); };
    if (!h.id || !h.ad || !h.sis) k('kimlik eksik');
    if (!h.sik || !h.sik.length) k('yakınma yok');
    var Ds = C.duzeyler(h); if (!Ds.length) k('düzey yok');
    Ds.forEach(function (d) { if (!h.g || !h.g[d]) k('görev yok: ' + d); });
    Object.keys(h.g || {}).forEach(function (d) { if (!C.DUZEY[d]) k('geçersiz düzey ' + d); var g = h.g[d]; if (!g || !g[1] || !g[2] || g[2].length < 2) k('görev seçenekleri eksik: ' + d); });
    var poz = (h.oyku || []).filter(function (x) { return x[3] > 0; }).length; if (poz < 3) k('anamnezde en az 3 değerli soru olmalı');
    if ((h.muay || []).filter(function (x) { return x[3] > 0; }).length < 2) k('muayenede en az 2 değerli iş olmalı');
    if (!h.gor && !(h.tet || []).some(function (x) { return x[3] > 0; })) k('tetkik/görüntüleme yok');
    if (!h.ayr || h.ayr.length !== 3) k('üç ayırıcı tanı olmalı');
    if (!h.ana || !h.ana[1] || h.ana[1].length < 2) k('3B görevde en az 2 yapı olmalı');
    var ids = {}; (h.oyku || []).concat(h.muay || [], h.tet || [], h.gor ? [h.gor] : []).forEach(function (x) { if (ids[x[0]]) k('yinelenen id ' + x[0]); ids[x[0]] = 1; });
    if (!C.sistem(h.sis)) k('sistem yok');
    if (['poliklinik', 'acil', 'servis'].indexOf(h.oda || 'poliklinik') < 0) k('oda geçersiz');
    return e;
  };
  return C;
});
