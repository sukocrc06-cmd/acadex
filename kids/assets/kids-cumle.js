/* ==========================================================================
   ACADEX KIDS · CÜMLE GALAKSİSİ (kids/assets/kids-cumle.js), 22.11.2026
   İlkokul (2-3-4. sınıf) için ayrı bir galaksi. Gezegenler MEB Türkiye Yüzyılı Maarif Modeli
   İngilizce programının altı temasıdır (School Life, Classroom Life, Personal Life, Family Life,
   Homes & Neighbourhood, Life in the City & the World); cümleler o temaların "Target Language
   Chunks" kalıplarından (tymm.meb.gov.tr, 2026).
   Oyun: CÜMLE BLOKLARI. Türkçesi yazılı, İngilizcesi sesli verilen cümlenin karışık blokları
   doğru sıraya dizilir. Renk = görev: mavi kim (özne), kırmızı ne yapar (fiil), yeşil ne/nerede
   (tamamlayıcı), mor soru kelimesi, gri diğer. Doğru cümle tren olup yola çıkar; yanlış bloklar
   sallanıp geri döner, doğru yerdekiler kalır; iki yanlıştan sonra sıradaki blok parlar.
   Veri biçimi: "What/q is/v it/s ?"  · kelime/görev, alt çizgi = tek blokta boşluk, son işaret sabit.
   Her gezegende beş durak (22.11.2026): Kelimeler, Kural, Cümle kur, Boşluk, Konuşalım (veri: kids-cumle2.js).
   W.KIDS_CUMLE = { ac(oz), VERI, DURAK, parcala, dogruMu, yildiz, rapor(il) }
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, SES = null;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var SAKIN = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function t(id, en, tr, renk, simge, c) { return { id: id, en: en, tr: tr, renk: renk, simge: simge, c: c }; }
  var VERI = {
    2: [
      t('2-okul', 'School Life', 'Okul Hayatı', '#FFB5C8', 'bag', [
        ['My_name/s is/v Can/o .', 'Benim adım Can.'], ['Where/q is/v she/s ?', 'O nerede?'], ['She/s is/v in_the_garden/o .', 'O bahçede.'],
        ['Who/q is/v he/s ?', 'O kim?'], ['He/s is/v my/o teacher/o .', 'O benim öğretmenim.'], ['What_day/q is/v it/s today/o ?', 'Bugün günlerden ne?'],
        ['It/s is/v Monday/o today/o .', 'Bugün pazartesi.'], ['Come/v here,/o please/x !', 'Buraya gel lütfen!']]),
      t('2-sinif', 'Classroom Life', 'Sınıf Hayatı', '#9BE0B4', 'pencil', [
        ['What_colour/q is/v it/s ?', 'O ne renk?'], ['The_chair/s is/v blue/o .', 'Sandalye mavi.'], ['It/s is/v a/o chair/o .', 'Bu bir sandalye.'],
        ['How/q many/q chairs/o ?', 'Kaç sandalye?'], ['Can/q I/s go/v to_the_bathroom/o ?', 'Tuvalete gidebilir miyim?'], ['Yes,/x you/s can/v .', 'Evet, gidebilirsin.'],
        ['It/s is/v my/o turn/o !', 'Sıra bende!']]),
      t('2-kisisel', 'Personal Life', 'Kişisel Hayat', '#FFD98A', 'tshirt', [
        ['How_old/q are/v you/s ?', 'Kaç yaşındasın?'], ['I/s am/v seven/o .', 'Yedi yaşındayım.'], ['I/s have_got/v blue/o eyes/o .', 'Mavi gözlerim var.'],
        ['How/q is/v the_weather/s ?', 'Hava nasıl?'], ['It/s is/v cold/o .', 'Hava soğuk.'], ['Is/q it/s your_birthday/o today/o ?', 'Bugün senin doğum günün mü?'],
        ['I/s have_got/v a/o red/o hat/o .', 'Kırmızı bir şapkam var.']]),
      t('2-aile', 'Family Life', 'Aile Hayatı', '#B9C7FF', 'family', [
        ['Who/q is/v she/s ?', 'O kim?'], ['She/s is/v my/o mother/o .', 'O benim annem.'], ['He/s is/v my/o father/o .', 'O benim babam.'],
        ['My_mother/s has_got/v blue/o eyes/o .', 'Annemin mavi gözleri var.'], ['My_brother/s has_got/v short/o hair/o .', 'Erkek kardeşimin saçı kısa.'],
        ['I/s am/v hungry/o !', 'Acıktım!'], ['You/s look/v great/o !', 'Harika görünüyorsun!']]),
      t('2-ev', 'Homes & Neighbourhood', 'Evler ve Mahalle', '#FFC2A1', 'sofa', [
        ['We/s have_got/v two/o pets/o .', 'İki evcil hayvanımız var.'], ['Where/q is/v the_cat/s ?', 'Kedi nerede?'], ['The_cat/s is/v in/o the_kitchen/o .', 'Kedi mutfakta.'],
        ['The_bed/s is/v in/o the_bedroom/o .', 'Yatak yatak odasında.'], ['There_are/v five/o cats/o in_the_garden/o .', 'Bahçede beş kedi var.'],
        ['We/s have_got/v a/o big/o house/o .', 'Büyük bir evimiz var.']]),
      t('2-sehir', 'Life in the City', 'Şehir ve Dünya', '#FF9EB5', 'apple', [
        ['Do/q you/s like/v bread/o ?', 'Ekmek sever misin?'], ['Yes,/x I/s do/v .', 'Evet, severim.'], ['No,/x I/s don\'t/v .', 'Hayır, sevmem.'],
        ['I/s like/v apples/o .', 'Elmaları severim.'], ['Is_there/q a/o banana/o in_the_kitchen/o ?', 'Mutfakta muz var mı?'],
        ['Can/q I/s have/v some/o bread/o ?', 'Biraz ekmek alabilir miyim?'], ['It/s is/v delicious/o !', 'Çok lezzetli!']])
    ],
    3: [
      t('3-okul', 'School Life', 'Okul Hayatı', '#FFB5C8', 'bag', [
        ['Where/q is/v Daphne/s ?', 'Daphne nerede?'], ['She/s is/v in/o the_library/o .', 'O kütüphanede.'], ['What_month/q is/v it/s now/o ?', 'Şimdi hangi aydayız?'],
        ['It/s is/v September/o .', 'Eylül.'], ['I/s am/v eight/o years_old/o .', 'Sekiz yaşındayım.'], ['You/s must/v follow/v the_rules/o .', 'Kurallara uymalısın.'],
        ['You/s mustn\'t/v run/v in_the_corridor/o .', 'Koridorda koşmamalısın.'], ['Is_there/q a/o nurse/o at_school/o ?', 'Okulda hemşire var mı?']]),
      t('3-sinif', 'Classroom Life', 'Sınıf Hayatı', '#9BE0B4', 'clock', [
        ['What_time/q is/v it/s ?', 'Saat kaç?'], ['It/s is/v five/o o\'clock/o .', 'Saat beş.'], ['What_lesson/q is/v it/s now/o ?', 'Şimdi hangi ders?'],
        ['It/s is/v raining/o today/o .', 'Bugün yağmur yağıyor.'], ['There_are/v two/o rulers/o on_the_table/o .', 'Masada iki cetvel var.'],
        ['How_many/q pencils/o have/v you/s got/v ?', 'Kaç kalemin var?'], ['I/s have_got/v two/o pencils/o .', 'İki kalemim var.']]),
      t('3-kisisel', 'Personal Life', 'Kişisel Hayat', '#FFD98A', 'hat', [
        ['She/s is/v tall/o and/x beautiful/o .', 'O uzun boylu ve güzel.'], ['I/s have_got/v a/o small/o nose/o .', 'Küçük bir burnum var.'],
        ['I/s love/v big/o sunglasses/o .', 'Büyük güneş gözlüklerini severim.'], ['Whose/q dress/o is/v this/s ?', 'Bu kimin elbisesi?'],
        ['This/s is/v Jasmine\'s/o dress/o .', 'Bu Jasmine\'in elbisesi.'], ['What/q are/v you/s wearing/v today/o ?', 'Bugün ne giyiyorsun?'],
        ['I/s am/v wearing/v a/o T-shirt/o .', 'Tişört giyiyorum.']]),
      t('3-aile', 'Family Life', 'Aile Hayatı', '#B9C7FF', 'family', [
        ['How_old/q is/v your_mother/s ?', 'Annen kaç yaşında?'], ['She/s is/v thirty-five/o .', 'O otuz beş yaşında.'],
        ['She/s prepares/v breakfast/o every_morning/o .', 'Her sabah kahvaltı hazırlar.'], ['My_father/s can/v cook/v .', 'Babam yemek yapabilir.'],
        ['My_sister/s can\'t/v swim/v .', 'Kız kardeşim yüzemez.'], ['Could/q you/s help/v me,/o please/x ?', 'Bana yardım eder misin lütfen?'],
        ['He/s always/x reads/v books/o .', 'O her zaman kitap okur.']]),
      t('3-ciftlik', 'Countryside & Farm', 'Kırsal ve Çiftlik', '#C6EDCF', 'cow', [
        ['There_is/v a/o farmhouse/o on_our_farm/o .', 'Çiftliğimizde bir çiftlik evi var.'], ['There_are/v five/o cows/o on_our_farm/o .', 'Çiftliğimizde beş inek var.'],
        ['I/s milk/v our_cows/o every_day/o .', 'Her gün ineklerimizi sağarım.'], ['What/q is/v the_farmer/s doing/v now/o ?', 'Çiftçi şimdi ne yapıyor?'],
        ['He/s is/v watering/v the_vegetables/o .', 'Sebzeleri suluyor.'], ['The_hens/s are/v eating/v corn/o .', 'Tavuklar mısır yiyor.']]),
      t('3-sehir', 'Food & Eating Out', 'Yemek ve Lokanta', '#FF9EB5', 'cake', [
        ['What/q do/v you/s want/v ?', 'Ne istersin?'], ['I/s want/v some/o salad,/o please/x .', 'Biraz salata istiyorum lütfen.'],
        ['I\'ll/s take/v some/o fruit/o .', 'Biraz meyve alacağım.'], ['Can/q I/s have/v some/o soup/o ?', 'Biraz çorba alabilir miyim?'],
        ['Have/q you/s got/v any/o olives/o ?', 'Hiç zeytinin var mı?'], ['Pass/v me/o the_salt,/o please/x .', 'Tuzu uzatır mısın lütfen.'],
        ['Enjoy/v your/o meal/o !', 'Afiyet olsun!']])
    ],
    4: [
      t('4-okul', 'School Life', 'Okul Hayatı', '#FFB5C8', 'book', [
        ['I/s always/x read/v books/o in_the_morning/o .', 'Sabahları hep kitap okurum.'], ['I/s am/v listening/v to_music/o today/o .', 'Bugün müzik dinliyorum.'],
        ['This/s is/v the_smartest/o group/o .', 'Bu en zeki grup.'], ['My_favourite_month/s is/v June/o .', 'En sevdiğim ay haziran.'],
        ['See/v you/o next_week/o !', 'Haftaya görüşürüz!'], ['I/s can\'t/v wait/v !', 'Sabırsızlanıyorum!']]),
      t('4-sinif', 'Classroom Life', 'Sınıf Hayatı', '#9BE0B4', 'globe', [
        ['What/q was/v your_favourite_lesson/s last_year/o ?', 'Geçen yıl en sevdiğin ders neydi?'], ['My_favourite_lesson/s was/v Maths/o .', 'En sevdiğim ders matematikti.'],
        ['I/s like/v learning/v new/o words/o .', 'Yeni kelimeler öğrenmeyi severim.'], ['It/s is/v ten_past/o five/o .', 'Saat beşi on geçiyor.'],
        ['There_is/v some/o glue/o on_the_paper/o .', 'Kağıtta biraz yapıştırıcı var.'], ['Whose/q pens/o are/v they/s ?', 'Bunlar kimin kalemleri?'],
        ['They/s are/v my/o pens/o .', 'Onlar benim kalemlerim.']]),
      t('4-kisisel', 'Personal Life', 'Kişisel Hayat', '#FFD98A', 'tshirt', [
        ['I/s played/v games/o yesterday/o .', 'Dün oyun oynadım.'], ['What/q did/v you/s do/v yesterday/o ?', 'Dün ne yaptın?'],
        ['I/s could/v play/v the_piano/o when_I_was_six/o .', 'Altı yaşındayken piyano çalabiliyordum.'], ['My_sister/s is/v taller/o than/x me/o .', 'Kız kardeşim benden uzun.'],
        ['I/s am/v wearing/v a/o blue/o cardigan/o .', 'Mavi bir hırka giyiyorum.'], ['It/s fits/v like_a_glove/o !', 'Tam üstüme oldu!']]),
      t('4-aile', 'Family Life', 'Aile Hayatı', '#B9C7FF', 'teacher', [
        ['What/q does/v your_mother/s do/v ?', 'Annen ne iş yapar?'], ['She/s is/v a/o teacher/o .', 'O bir öğretmen.'],
        ['My_brother/s is/v the_kindest/o person/o .', 'Erkek kardeşim en nazik kişi.'], ['She/s loves/v reading/v books/o .', 'Kitap okumayı çok sever.'],
        ['I/s read/v a/o new/o book/o last_night/o .', 'Dün gece yeni bir kitap okudum.'], ['My_dad/s went/v to_the_bakery/o .', 'Babam fırına gitti.']]),
      t('4-deniz', 'Life by the Sea', 'Deniz Kenarında', '#8FD3F5', 'dolphin', [
        ['I/s think/v it/s will_be/v sunny/o .', 'Bence hava güneşli olacak.'], ['We/s should_not/v throw/v plastic/o in_the_ocean/o .', 'Okyanusa plastik atmamalıyız.'],
        ['You/s mustn\'t/v throw/v rubbish/o into_the_sea/o .', 'Denize çöp atmamalısın.'], ['There_were/v a_lot_of/o seals/o on_the_beach/o .', 'Plajda çok fok vardı.'],
        ['My_sister/s is/v the_best/o cook/o .', 'Kız kardeşim en iyi aşçı.'], ['Dolphins/s live/v in_the_sea/o .', 'Yunuslar denizde yaşar.']]),
      t('4-sehir', 'Life in the World', 'Dünyada Hayat', '#FF9EB5', 'plane', [
        ['We/s are_going_to/v go/v to_Italy/o .', 'İtalya\'ya gideceğiz.'], ['Where/q are/v you/s going_to/v go/v ?', 'Nereye gideceksin?'],
        ['Pasta/s is/v the_most_delicious/o food/o .', 'Makarna en lezzetli yemek.'], ['It/s tastes/v good/o !', 'Tadı güzel!'],
        ['I/s am/v starving/o !', 'Çok açım!'], ['We/s are_going_to/v buy/v a_few/o cucumbers/o .', 'Birkaç salatalık alacağız.']])
    ]
  };
  var ROL = { s: 'kim', v: 'ne yapar', o: 'ne / nerede', q: 'soru', x: 'diğer' };

  /* ---------------- saf yardımcılar (tests/kids-cumle.js) ---------------- */
  function parcala(s) {
    var son = s.trim().slice(-1), ic = /[.?!]/.test(son) ? s.trim().slice(0, -1).trim() : s.trim();
    return { son: /[.?!]/.test(son) ? son : '', bloklar: ic.split(/\s+/).map(function (p) { var i = p.lastIndexOf('/'), m = i > 0 ? p.slice(0, i) : p, r = i > 0 ? p.slice(i + 1) : 'x'; return { m: m.replace(/_/g, ' '), r: ROL[r] ? r : 'x' }; }) };
  }
  function metin(s) { var p = parcala(s); return p.bloklar.map(function (b) { return b.m; }).join(' ') + p.son; }
  function dogruMu(dizilen, s) { var p = parcala(s); return dizilen.length === p.bloklar.length && dizilen.every(function (m, i) { return m === p.bloklar[i].m; }); }
  function yildiz(hata) { return hata <= 1 ? 3 : hata <= 4 ? 2 : 1; }
  function karistir(a, tohum) {
    var b = a.slice(), r = tohum || Math.random;
    for (var i = b.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var x = b[i]; b[i] = b[j]; b[j] = x; }
    return b;
  }
  /* karışık hâl doğru sıranın aynısı olmasın */
  function karisik(bl) { var k, n = 0; do { k = karistir(bl.map(function (b, i) { return i; })); n++; } while (n < 8 && bl.length > 1 && k.every(function (v, i) { return bl[v].m === bl[i].m; })); return k; }

  /* ---------------- çizimler ---------------- */
  var M = '#23304D';
  var ROKET = '<svg viewBox="0 0 40 56" aria-hidden="true" focusable="false"><path d="M20 3c8 6 11 16 9 30H11C9 19 12 9 20 3z" fill="#fff" stroke="' + M + '" stroke-width="2.6" stroke-linejoin="round"/><circle cx="20" cy="18" r="5" fill="#7FC4FF" stroke="' + M + '" stroke-width="2.2"/><path d="M11 26l-7 9 7 2M29 26l7 9-7 2" fill="#FF6B5B" stroke="' + M + '" stroke-width="2.2" stroke-linejoin="round"/><path class="kc2-alev" d="M15 34q5 18 10 0" fill="#FFB020" stroke="' + M + '" stroke-width="2"/></svg>';
  var LOKO = '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><rect x="4" y="14" width="38" height="24" rx="5" fill="#FF6B5B" stroke="' + M + '" stroke-width="3"/><rect x="30" y="4" width="16" height="34" rx="4" fill="#FFD23F" stroke="' + M + '" stroke-width="3"/><rect x="34" y="9" width="8" height="8" rx="2" fill="#BFE3FF" stroke="' + M + '" stroke-width="2"/><path d="M42 30 h14 l4 8 h-18z" fill="#7FC4FF" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/><rect x="10" y="4" width="8" height="12" rx="2" fill="' + M + '"/><circle cx="16" cy="40" r="6" fill="#fff" stroke="' + M + '" stroke-width="3"/><circle cx="38" cy="40" r="6" fill="#fff" stroke="' + M + '" stroke-width="3"/></svg>';
  function acd(m) { return C && C.acadia ? C.acadia({ mood: m || 'mutlu' }) : ''; }

  var oz = null, durum = null;
  function il() { return oz.il(); }
  /* sınıf: velinin / çocuğun seçtiği; seçilmemişse sınıf adından ("2-A" → 2) */
  function sinif(i) { var s = i.ilkSinif; if (s === 2 || s === 3 || s === 4) return s; return oz && (oz.sinifAd === 2 || oz.sinifAd === 3 || oz.sinifAd === 4) ? oz.sinifAd : 0; }
  function kaydet(i) { oz.kaydet(i); }

  /* ---------------- galaksiler arası geçiş ---------------- */
  function warp(sonra, geri) {
    if (SAKIN || !W.Element.prototype.animate) return sonra();
    var o = D.createElement('div'); o.className = 'kc2-warp' + (geri ? ' kc2-warp-geri' : ''); o.innerHTML = '<i class="kc2-warp-c"></i><span class="kc2-warp-r">' + ROKET + '</span>';
    D.body.appendChild(o); if (SES) SES.fx('cevir');
    var r = o.lastChild;
    o.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1 }], { duration: 1000, fill: 'forwards' });
    r.animate([{ transform: 'translate(-50%,40vh) scale(.6)' }, { transform: 'translate(-50%,-50%) scale(1.3)', offset: 0.55 }, { transform: 'translate(-50%,-90vh) scale(.5)' }], { duration: 1000, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
    setTimeout(function () { sonra(); o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, fill: 'forwards' }).finished.then(function () { o.remove(); }, function () { o.remove(); }); }, 900);
  }

  /* ---------------- ilerleme (22.11.2026) ----------------
     Her gezegende beş durak sırayla açılır: Kelimeler → Kural → Cümle kur → Boşluk → Konuşalım.
     Kural dışındakiler 1-3 yıldız verir. Beşi bitince gezegen tamam (yıldızı = puanlı dört durağın
     ortalaması), tema rozeti gelir ve sıradaki gezegen (MEB sırası) açılır.
     Kayıt: il.cumleD[tema][durak] = en iyi yıldız (kural 1) · il.cumle[tema] = gezegen yıldızı ·
     il.cumleRozet[tema] · il.cumleKalip[kalıp] = {d, y} · il.cumleLog (son 60) · il.cumleKurdu (son 20) */
  var DURAK = [['kelime', 'Kelimeler', 'Words', 'album'], ['kural', 'Kural', 'Rule', 'yildiz'], ['blok', 'Cümle kur', 'Build', 'oynat'], ['bosluk', 'Boşluğu doldur', 'Fill in', 'firca'], ['diyalog', 'Konuşalım', 'Talk', 'ses']];
  function ek(id) { var E = W.KIDS_CUMLE_EK; return E && E.EK[id] ? E.EK[id] : null; }
  function durakD(i, id) { return ((i.cumleD || {})[id]) || {}; }
  function tamamMi(i, id) { var d = durakD(i, id); return DURAK.every(function (x) { return d[x[0]] > 0; }); }
  function gezegenYildiz(d) { var n = ['kelime', 'blok', 'bosluk', 'diyalog'].map(function (k) { return d[k] || 0; }); if (n.some(function (v) { return !v; }) || !d.kural) return 0; return Math.round(n.reduce(function (a, b) { return a + b; }, 0) / n.length); }
  function gezegenAcik(i, L, k) { return k === 0 || tamamMi(i, L[k - 1].id) || !!(i.cumle || {})[L[k].id] || Object.keys(durakD(i, L[k].id)).length > 0; }
  function durakAcik(d, j) { return j === 0 || d[DURAK[j - 1][0]] > 0; }
  function kalipYaz(i, kalip, ilkte) { if (!kalip) return; i.cumleKalip = i.cumleKalip || {}; var k = i.cumleKalip[kalip] = i.cumleKalip[kalip] || { d: 0, y: 0 }; if (ilkte) k.d++; else k.y++; }
  function durakBitti(x, durak, y, hata, n) {
    var i = il(), id = x.id; i.cumleD = i.cumleD || {}; var d = i.cumleD[id] = i.cumleD[id] || {}, ilkTamam = !tamamMi(i, id);
    if (!(d[durak] >= y)) d[durak] = y;
    i.cumleLog = (i.cumleLog || []).concat([{ t: Date.now(), id: id, d: durak, y: y, h: hata || 0, n: n || 0 }]).slice(-60);
    var gy = gezegenYildiz(d); i.cumle = i.cumle || {}; if (gy > (i.cumle[id] || 0)) i.cumle[id] = gy;
    var rozet = false; if (ilkTamam && tamamMi(i, id)) { i.cumleRozet = i.cumleRozet || {}; if (!i.cumleRozet[id]) { i.cumleRozet[id] = Date.now(); rozet = true; } }
    kaydet(i); return rozet;
  }

  /* ---------------- galaksi ---------------- */
  function ust(geriEt, bas, alt, ek_) {
    return '<header class="ka-konu-ust kc2-ust"><button type="button" class="ka-yuvarlak" data-c2geri aria-label="' + geriEt + '">' + (C ? C.simge('ev') : '←') + '</button><h1 class="kk-bas">' + bas + (alt ? ' <small lang="en">' + alt + '</small>' : '') + '</h1>' + (ek_ || '<span></span>') + '</header>';
  }
  function sinifSec() {
    oz.kok.innerHTML = '<div class="kc2 kc2-sec">' + ust('Haritaya dön', 'Cümle Galaksisi', 'Sentence Galaxy') +
      '<main class="kc2-secim"><div class="kc2-secim-acd">' + acd('mutlu') + '</div><h2>Kaçıncı sınıftasın?</h2><div class="kc2-sinifler">' +
      [2, 3, 4].map(function (n) { return '<button type="button" class="kc2-sinif-b" data-c2s="' + n + '"><b>' + n + '</b><small>. sınıf</small></button>'; }).join('') + '</div><p>Sınıfını sonra da değiştirebilirsin.</p></main></div>';
    oz.kok.dataset.gorunum = 'cumle';
    if (SES) SES.soyle('Cümle galaksisine hoş geldin! Kaçıncı sınıftasın?', 'tr');
    oz.kok.querySelector('[data-c2geri]').addEventListener('click', geriHarita);
    oz.kok.querySelectorAll('[data-c2s]').forEach(function (b) { b.addEventListener('click', function () { var i = il(); i.ilkSinif = +b.getAttribute('data-c2s'); kaydet(i); if (SES) SES.fx('dogru'); galaksi(); }); });
  }
  var YER_G = [[12, 66], [27, 30], [44, 64], [60, 28], [76, 62], [89, 26]], YER_T = [[28, 9], [72, 23], [28, 39], [72, 55], [28, 71], [72, 87]];
  function galaksi() {
    dur();
    var i = il(), s = sinif(i); if (!s) return sinifSec();
    var L = VERI[s], dar = W.matchMedia && W.matchMedia('(max-width: 700px)').matches, Y = dar ? YER_T : YER_G, cs = i.cumle || {}, rz = i.cumleRozet || {};
    var son = L.filter(function (x) { return x.id === i.cumleSon; })[0] ? i.cumleSon : L[0].id, si = 0;
    L.forEach(function (x, k) { if (x.id === son) si = k; });
    var yol = 'M' + Y.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L');
    var toplam = L.reduce(function (n, x) { return n + (cs[x.id] || 0); }, 0), biten = L.filter(function (x) { return tamamMi(i, x.id); }).length;
    oz.kok.innerHTML = '<div class="kc2">' + ust('Haritaya dön', 'Cümle Galaksisi', 'Sentence Galaxy',
      '<div class="kc2-sinif-sec" role="group" aria-label="Sınıf">' + [2, 3, 4].map(function (n) { return '<button type="button" data-c2s="' + n + '" aria-pressed="' + (n === s) + '">' + n + '. sınıf</button>'; }).join('') + '</div>') +
      '<main class="kc2-uzay' + (dar ? ' kc2-dar' : '') + '"><div class="kc2-nebula" aria-hidden="true"></div>' +
      '<svg class="kc2-yol" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="' + yol + '"/></svg>' +
      '<p class="kc2-sayac" aria-label="' + biten + ' / ' + L.length + ' gezegen bitti, ' + toplam + ' yıldız">🏅 ' + biten + ' / ' + L.length + ' · ★ ' + toplam + '</p>' +
      '<ol class="kc2-gezegenler">' + L.map(function (x, k) {
        var y = cs[x.id] || 0, acik = gezegenAcik(i, L, k), d = durakD(i, x.id), yapilan = DURAK.filter(function (z) { return d[z[0]] > 0; }).length;
        var gz = W.KIDS_UZAY && W.KIDS_UZAY.gezegen ? W.KIDS_UZAY.gezegen(x.renk, x.simge, !acik, acik ? y : 0, k + 1) : '';
        return '<li style="left:' + Y[k][0] + '%;top:' + Y[k][1] + '%;--r:' + x.renk + ';--i:' + k + '"' + (acik ? '' : ' class="kc2-kilit"') + '><button type="button" class="kc2-gz" data-c2t="' + x.id + '"' + (acik ? '' : ' aria-disabled="true"') +
          ' aria-label="' + esc(x.en + ', ' + x.tr + (acik ? ', ' + yapilan + ' / 5 durak' + (rz[x.id] ? ', rozet kazanıldı' : '') : ', kilitli')) + '">' + gz + (rz[x.id] ? '<span class="kc2-rozet" aria-hidden="true">🏅</span>' : '') +
          '<span class="kc2-ad"><b lang="en">' + esc(x.en) + '</b><i aria-hidden="true">' + (acik ? (tamamMi(i, x.id) ? [1, 2, 3].map(function (j) { return '<em' + (j <= y ? ' class="on"' : '') + '>★</em>'; }).join('') : DURAK.map(function (z) { return '<u' + (d[z[0]] > 0 ? ' class="on"' : '') + '></u>'; }).join('')) : '🔒') + '</i></span></button></li>';
      }).join('') + '</ol><span class="kc2-roket" aria-hidden="true" style="left:' + Y[si][0] + '%;top:' + Y[si][1] + '%">' + ROKET + '</span></main></div>';
    oz.kok.dataset.gorunum = 'cumle';
    oz.kok.querySelector('[data-c2geri]').addEventListener('click', geriHarita);
    oz.kok.querySelectorAll('[data-c2s]').forEach(function (b) { b.addEventListener('click', function () { var i2 = il(); i2.ilkSinif = +b.getAttribute('data-c2s'); kaydet(i2); if (SES) SES.fx('dokun'); galaksi(); }); });
    var rk = oz.kok.querySelector('.kc2-roket'), ucuyor = false;
    oz.kok.querySelectorAll('[data-c2t]').forEach(function (b, k) {
      b.addEventListener('click', function () {
        if (ucuyor) return; var x = L[k];
        if (!gezegenAcik(il(), L, k)) { if (SES) { SES.fx('yanlis'); SES.soyle('Önce ' + L[k - 1].tr + ' gezegenini bitir.', 'tr'); } b.classList.remove('kc2-salla'); void b.offsetWidth; b.classList.add('kc2-salla'); return; }
        if (SES) SES.fx('dokun');
        var i2 = il(); i2.cumleSon = x.id; kaydet(i2);
        if (k === si || SAKIN || !rk.animate) return gezegen(s, x);
        ucuyor = true;
        if (SES) Promise.resolve(SES.soyle(x.tr + ' gezegenine yolculuk başlıyor!', 'tr')).then(function () { return SES.soyle('Let\'s go to ' + x.en + '!', 'en'); }, function () { });
        var a = Y[si], h = Y[k], ort = [(a[0] + h[0]) / 2, Math.min(a[1], h[1]) - 14], aci = Math.atan2(h[1] - a[1], h[0] - a[0]) * 180 / Math.PI + 90;
        rk.classList.add('kc2-ucuyor');
        rk.animate([{ left: a[0] + '%', top: a[1] + '%', transform: 'translate(-50%,-50%) rotate(0deg)' }, { left: ort[0] + '%', top: ort[1] + '%', transform: 'translate(-50%,-50%) rotate(' + aci + 'deg) scale(1.15)', offset: 0.5 }, { left: h[0] + '%', top: h[1] + '%', transform: 'translate(-50%,-50%) rotate(0deg)' }],
          { duration: 1400, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }).finished.then(function () { rk.classList.remove('kc2-ucuyor'); gezegen(s, x); }, function () { gezegen(s, x); });
      });
    });
  }
  function geriHarita() { if (SES) SES.fx('dokun'); dur(); warp(function () { oz.geri(); }, true); }

  /* ---------------- gezegen: beş durak ---------------- */
  function gezegen(s, x, rozet) {
    dur();
    var i = il(), d = durakD(i, x.id), sira = DURAK.findIndex(function (z, j) { return durakAcik(d, j) && !(d[z[0]] > 0); });
    var gz = W.KIDS_UZAY && W.KIDS_UZAY.gezegen ? W.KIDS_UZAY.gezegen(x.renk, x.simge, false, i.cumle && i.cumle[x.id] || 0, 2) : '';
    oz.kok.innerHTML = '<div class="kc2 kc2-gezegen" style="--r:' + x.renk + '">' + ust('Galaksiye dön', esc(x.en), esc(x.tr)) +
      '<main class="kc2-duraklar-alan"><div class="kc2-gz-buyuk" aria-hidden="true">' + gz + '</div>' +
      '<ol class="kc2-duraklar">' + DURAK.map(function (z, j) {
        var acik = durakAcik(d, j), y = d[z[0]] || 0, bitti = y > 0;
        return '<li style="--j:' + j + '"><button type="button" class="kc2-durak' + (bitti ? ' kc2-d-bitti' : '') + (j === sira ? ' kc2-d-simdi' : '') + '" data-c2d="' + z[0] + '"' + (acik ? '' : ' aria-disabled="true"') +
          ' aria-label="' + esc(z[1] + (bitti ? ', bitti' : acik ? '' : ', kilitli')) + '"><span class="kc2-d-no">' + (acik ? (C ? C.simge(z[3]) : j + 1) : '🔒') + '</span><b>' + z[1] + '</b><small lang="en">' + z[2] + '</small>' +
          (bitti && z[0] !== 'kural' ? '<i>' + [1, 2, 3].map(function (q) { return '<em' + (q <= y ? ' class="on"' : '') + '>★</em>'; }).join('') + '</i>' : bitti ? '<i>✓</i>' : '') + '</button></li>';
      }).join('') + '</ol>' + (rozet ? '<div class="kc2-rozet-k" role="status"><span aria-hidden="true">🏅</span><b>Tema rozeti!</b><small>' + esc(x.en) + ' gezegenini bitirdin. Sıradaki gezegen açıldı.</small></div>' : '') + '</main></div>';
    oz.kok.dataset.gorunum = 'cumle';
    oz.kok.querySelector('[data-c2geri]').addEventListener('click', function () { if (SES) SES.fx('dokun'); galaksi(); });
    if (rozet && SES) { SES.fx('yildiz'); SES.soyle('Tebrikler! ' + x.tr + ' rozetini kazandın!', 'tr'); }
    else if (SES && sira >= 0) SES.soyle(x.tr + ' gezegeni. Sıradaki durak: ' + DURAK[sira][1] + '.', 'tr');
    oz.kok.querySelectorAll('[data-c2d]').forEach(function (b, j) {
      b.addEventListener('click', function () {
        if (!durakAcik(durakD(il(), x.id), j)) { if (SES) { SES.fx('yanlis'); SES.soyle('Önce ' + DURAK[j - 1][1] + ' durağını bitir.', 'tr'); } return; }
        if (SES) SES.fx('dokun');
        var f = { kelime: kelimeOyun, kural: kuralKart, blok: blokOyun, bosluk: boslukOyun, diyalog: diyalogOyun }[DURAK[j][0]];
        f(s, x);
      });
    });
  }
  /* durak ekranı iskeleti: üst çubuk, ilerleme noktaları, kart */
  function sahne(s, x, n, baslik) {
    oz.kok.innerHTML = '<div class="kc2 kc2-oyun" style="--r:' + x.renk + '">' + ust('Gezegene dön', esc(baslik), esc(x.en),
      n ? '<ol class="kc2-noktalar" aria-label="İlerleme">' + new Array(n + 1).join('<li></li>') + '</ol>' : '<span></span>') + '<main class="kc2-kart" data-c2kart></main></div>';
    oz.kok.dataset.gorunum = 'cumle';
    oz.kok.querySelector('[data-c2geri]').addEventListener('click', function () { if (SES) SES.fx('dokun'); gezegen(s, x); });
    var nk = [].slice.call(oz.kok.querySelectorAll('.kc2-noktalar li')); if (nk[0]) nk[0].className = 'simdi';
    return { kart: oz.kok.querySelector('[data-c2kart]'), nokta: function (k) { if (nk[k]) nk[k].className = 'tamam'; if (nk[k + 1]) nk[k + 1].className = 'simdi'; } };
  }
  function bekle(ms) { return new Promise(function (r) { setTimeout(r, SAKIN ? Math.min(ms, 200) : ms); }); }
  function bitirEkran(s, x, durak, y, hata, n, metin_) {
    var rozet = durakBitti(x, durak, y, hata, n);
    var j = DURAK.findIndex(function (z) { return z[0] === durak; }), sonraki = DURAK[j + 1];
    var kart = oz.kok.querySelector('[data-c2kart]');
    kart.innerHTML = '<div class="kc2-bitis"><div class="ka-konfeti" aria-hidden="true">' + new Array(20).join('<i></i>') + '</div><span class="kc2-acd" aria-hidden="true">' + acd('kutlama') + '</span><h2>' + (metin_ || 'Harika!') + '</h2>' +
      (durak === 'kural' ? '' : '<p class="kc2-yildizlar" aria-label="' + y + ' yıldız">' + [1, 2, 3].map(function (q) { return '<em' + (q <= y ? ' class="on"' : '') + ' style="--j:' + q + '">★</em>'; }).join('') + '</p><p>' + n + ' soru' + (hata ? ' · ' + hata + ' yanlış deneme' : ' · hiç yanlış yok!') + '</p>') +
      '<div class="kc2-bitis-d"><button type="button" class="ka-orta" data-c2tekrar>Tekrar</button><button type="button" class="ka-buyuk" data-c2devam>' + (sonraki && !rozet ? 'Sıradaki: ' + sonraki[1] : 'Gezegene dön') + '</button></div></div>';
    if (SES) { SES.fx('yildiz'); if (durak !== 'kural') SES.soyle(y === 3 ? 'Mükemmel! Üç yıldız!' : 'Aferin! Durağı bitirdin!', 'tr'); }
    kart.querySelector('[data-c2tekrar]').addEventListener('click', function () { ({ kelime: kelimeOyun, kural: kuralKart, blok: blokOyun, bosluk: boslukOyun, diyalog: diyalogOyun })[durak](s, x); });
    kart.querySelector('[data-c2devam]').addEventListener('click', function () {
      if (sonraki && !rozet) ({ kelime: kelimeOyun, kural: kuralKart, blok: blokOyun, bosluk: boslukOyun, diyalog: diyalogOyun })[sonraki[0]](s, x); else gezegen(s, x, rozet);
    });
  }
  /* üç seçenekli soru (kelime, boşluk, diyalog ortak): sec(seçenekler, doğru, ilkte) */
  function secenekler(kutu, sec, dogru, sonra) {
    var ilk = true, hata = 0;
    kutu.innerHTML = karistir(sec).map(function (t_) { return '<button type="button" class="kc2-sec">' + esc(t_) + '</button>'; }).join('');
    kutu.onclick = function (e) {
      var b = e.target.closest('.kc2-sec'); if (!b || b.disabled) return;
      if (b.textContent === dogru) { if (SES) SES.fx('dogru'); b.classList.add('kc2-sec-dogru'); kutu.querySelectorAll('.kc2-sec').forEach(function (z) { z.disabled = true; }); sonra(ilk, hata); }
      else { if (SES) SES.fx('yanlis'); hata++; ilk = false; b.classList.add('kc2-salla', 'kc2-sec-yanlis'); b.disabled = true; }
    };
  }

  /* ---------------- 1) kelime bankası: Türkçesi (ve resmi) → İngilizcesini seç ---------------- */
  function kelimeOyun(s, x) {
    dur(); durum = {}; var ben = durum, E = ek(x.id); if (!E) return gezegen(s, x);
    var R = W.KIDS_RESIM, L = karistir(E.k), n = 0, hataT = 0, sc = sahne(s, x, L.length, 'Kelimeler');
    function resim(en) { var id = en.toLowerCase().replace(/[^a-z]/g, ''); return R && R.var && R.var(id) ? R.ciz ? R.ciz(id) : '' : ''; }
    function tur() {
      if (ben !== durum) return; var w = L[n], digerleri = karistir(E.k.filter(function (z) { return z[0] !== w[0]; })).slice(0, 2).map(function (z) { return z[0]; }), rs = resim(w[0]);
      sc.kart.innerHTML = '<div class="kc2-kelime">' + (rs ? '<span class="kc2-k-res" aria-hidden="true">' + rs + '</span>' : '<span class="kc2-k-res kc2-k-yok" aria-hidden="true">' + acd('dusun') + '</span>') +
        '<p class="kc2-k-tr"><small>İngilizcesi hangisi?</small><b>' + esc(w[1]) + '</b></p></div><div class="kc2-secler" data-c2sec></div>';
      secenekler(sc.kart.querySelector('[data-c2sec]'), [w[0]].concat(digerleri), w[0], function (ilk, h) {
        hataT += h; sc.nokta(n);
        Promise.resolve(SES ? SES.soyle(w[0], 'en') : 0).then(function () { return bekle(500); }).then(function () { if (ben !== durum) return; n++; if (n >= L.length) bitirEkran(s, x, 'kelime', yildiz(hataT), hataT, L.length, 'Kelimeleri öğrendin!'); else tur(); });
      });
    }
    if (SES) SES.soyle('Türkçesine bak, İngilizcesini seç.', 'tr');
    tur();
  }

  /* ---------------- 2) kural kartı: satırlar sırayla canlanır ---------------- */
  function kuralKart(s, x) {
    dur(); durum = {}; var ben = durum, E = ek(x.id); if (!E) return gezegen(s, x);
    var r = E.r, sc = sahne(s, x, 0, 'Kural');
    sc.kart.innerHTML = '<div class="kc2-kural"><div class="kc2-soru"><span class="kc2-acd" aria-hidden="true">' + acd('dusun') + '</span><div class="kc2-balon"><small>Bugünün kuralı</small><b lang="en">' + esc(r.ad) + '</b></div></div>' +
      '<p class="kc2-kural-tr">' + esc(r.tr) + '</p><ol class="kc2-kural-s">' + r.s.map(function (z, j) { return '<li style="--j:' + j + '"><span class="kc2-ks-sol">' + esc(z[0]) + '</span><i aria-hidden="true">→</i><span class="kc2-ks-sag" lang="en">' + esc(z[1]) + '</span></li>'; }).join('') + '</ol>' +
      '<div class="kc2-kural-o"><button type="button" class="kc2-dinle" data-c2o aria-label="Örneği dinle">' + (C ? C.simge('ses') : '♪') + '<span>Dinle</span></button><p><b lang="en">' + esc(r.o) + '</b><small>' + esc(r.ot) + '</small></p></div>' +
      '<div class="kc2-bitis-d"><button type="button" class="ka-buyuk" data-c2anladim>Anladım ✓</button></div></div>';
    var satir = [].slice.call(sc.kart.querySelectorAll('.kc2-kural-s li'));
    sc.kart.querySelector('[data-c2o]').addEventListener('click', function () { if (SES) SES.soyle(r.o, 'en'); });
    sc.kart.querySelector('[data-c2anladim]').addEventListener('click', function () { if (SES) SES.fx('dogru'); bitirEkran(s, x, 'kural', 1, 0, 0, 'Kuralı öğrendin!'); });
    /* anlatım: Türkçe açıklama, sonra her satır yanıp İngilizcesi söylenir, en son örnek */
    var p = SES ? Promise.resolve(SES.soyle(r.tr, 'tr')) : Promise.resolve();
    satir.forEach(function (li, j) { p = p.then(function () { if (ben !== durum) return; li.classList.add('kc2-ks-on'); return SES ? SES.soyle(r.s[j][1], 'en') : bekle(600); }).then(function () { return bekle(250); }); });
    p.then(function () { if (ben !== durum) return; sc.kart.querySelector('.kc2-kural-o').classList.add('kc2-ks-on'); if (SES) SES.soyle(r.o, 'en'); }, function () { satir.forEach(function (li) { li.classList.add('kc2-ks-on'); }); });
    if (SAKIN || !SES) satir.forEach(function (li) { li.classList.add('kc2-ks-on'); });
  }

  /* ---------------- 3) cümle blokları ---------------- */
  function blokOyun(s, x) {
    dur();
    var sorular = karistir(x.c).slice(0, 6), n = 0, hataT = 0;
    durum = {}; var ben = durum, sc = sahne(s, x, sorular.length, 'Cümle kur'), kart = sc.kart;
    function tur() {
      if (ben !== durum) return;
      var q = sorular[n], p = parcala(q[0]), sira = karisik(p.bloklar), hata = 0;
      kart.innerHTML = '<div class="kc2-soru"><span class="kc2-acd" aria-hidden="true">' + acd('mutlu') + '</span><div class="kc2-balon"><small>Türkçesi</small><b>' + esc(q[1]) + '</b></div>' +
        '<button type="button" class="kc2-dinle" data-c2dinle aria-label="İngilizcesini dinle">' + (C ? C.simge('ses') : '♪') + '<span>Dinle</span></button></div>' +
        '<div class="kc2-hat" data-c2hat>' + p.bloklar.map(function (b, i) { return '<span class="kc2-yuva" data-y="' + i + '"></span>'; }).join('') + (p.son ? '<span class="kc2-son">' + p.son + '</span>' : '') + '</div>' +
        '<div class="kc2-havuz" data-c2havuz>' + sira.map(function (k) { var b = p.bloklar[k]; return '<button type="button" class="kc2-b kc2-r-' + b.r + '" data-b="' + k + '">' + esc(b.m) + '</button>'; }).join('') + '</div>' +
        '<p class="kc2-renkler" aria-hidden="true"><span class="kc2-r-s">kim?</span><span class="kc2-r-v">ne yapar?</span><span class="kc2-r-o">ne / nerede?</span><span class="kc2-r-q">soru</span></p>';
      var hat = kart.querySelector('[data-c2hat]'), havuz = kart.querySelector('[data-c2havuz]'), yuvalar = [].slice.call(hat.querySelectorAll('.kc2-yuva'));
      function dinle() { if (SES) SES.soyle(metin(q[0]), 'en'); }
      kart.querySelector('[data-c2dinle]').addEventListener('click', function () { if (SES) SES.fx('dokun'); dinle(); });
      if (n === 0 && !oz.il().cumleAnlatildi) { var i3 = il(); i3.cumleAnlatildi = 1; kaydet(i3); if (SES) Promise.resolve(SES.soyle('Dinle, sonra blokları doğru sıraya diz!', 'tr')).then(dinle, function () { }); } else setTimeout(dinle, 350);
      function ipucu() { kart.querySelectorAll('.kc2-ipucu').forEach(function (e) { e.classList.remove('kc2-ipucu'); }); if (hata < 2) return; var bos = yuvalar.findIndex(function (y) { return !y.firstChild; }); if (bos < 0) return; var hedef = p.bloklar[bos].m, b = [].slice.call(havuz.children).filter(function (e) { return e.textContent === hedef; })[0]; if (b) b.classList.add('kc2-ipucu'); }
      function yerlesik() { return yuvalar.map(function (y) { return y.firstChild ? y.firstChild.textContent : null; }); }
      function bak() {
        var dz = yerlesik(); if (dz.indexOf(null) >= 0) return ipucu();
        if (dogruMu(dz, q[0])) {
          if (SES) SES.fx('dogru'); hat.classList.add('kc2-tren'); hat.insertAdjacentHTML('afterbegin', '<span class="kc2-loko" aria-hidden="true">' + LOKO + '</span>');
          kart.querySelectorAll('.kc2-b').forEach(function (b) { b.disabled = true; });
          sc.nokta(n);
          var i4 = il(); i4.cumleKurdu = (i4.cumleKurdu || []).filter(function (z) { return z !== metin(q[0]); }).concat([metin(q[0])]).slice(-20); kaydet(i4);
          Promise.resolve(SES ? SES.soyle(metin(q[0]), 'en') : 0).then(function () { return bekle(700); }).then(function () {
            if (ben !== durum) return; hataT += hata; n++;
            if (n >= sorular.length) bitirEkran(s, x, 'blok', yildiz(hataT), hataT, sorular.length, 'Harika cümleler!'); else tur();
          });
          return;
        }
        if (SES) SES.fx('yanlis'); hata++;
        yuvalar.forEach(function (y, k) { var b = y.firstChild; if (b && b.textContent !== p.bloklar[k].m) { b.classList.add('kc2-salla'); setTimeout(function () { b.classList.remove('kc2-salla'); havuz.appendChild(b); ipucu(); }, 480); } });
      }
      kart.onclick = function (e) {
        var b = e.target.closest('.kc2-b'); if (!b || b.disabled) return;
        if (SES) SES.fx('dokun');
        if (b.parentNode === havuz) { var y = yuvalar.filter(function (y2) { return !y2.firstChild; })[0]; if (!y) return; y.appendChild(b); b.classList.remove('kc2-ipucu'); b.classList.add('kc2-otur'); setTimeout(function () { b.classList.remove('kc2-otur'); }, 300); bak(); }
        else { havuz.appendChild(b); ipucu(); }
      };
    }
    tur();
  }

  /* ---------------- 4) boşluk doldurma ---------------- */
  function boslukOyun(s, x) {
    dur(); durum = {}; var ben = durum, E = ek(x.id); if (!E) return gezegen(s, x);
    var L = karistir(E.b), n = 0, hataT = 0, sc = sahne(s, x, L.length, 'Boşluğu doldur');
    function tur() {
      if (ben !== durum) return; var q = L[n], parca = q[0].split('___');
      sc.kart.innerHTML = '<div class="kc2-soru"><span class="kc2-acd" aria-hidden="true">' + acd('mutlu') + '</span><div class="kc2-balon"><small>Türkçesi</small><b>' + esc(q[3]) + '</b></div></div>' +
        '<p class="kc2-bosluk" lang="en">' + esc(parca[0]) + '<span class="kc2-gap" data-c2gap>?</span>' + esc(parca[1] || '') + '</p><div class="kc2-secler" data-c2sec></div>';
      secenekler(sc.kart.querySelector('[data-c2sec]'), [q[1]].concat(q[2]), q[1], function (ilk, h) {
        hataT += h; var g = sc.kart.querySelector('[data-c2gap]'); g.textContent = q[1]; g.classList.add('kc2-gap-dolu'); sc.nokta(n);
        var i5 = il(); kalipYaz(i5, q[4], ilk); kaydet(i5);
        Promise.resolve(SES ? SES.soyle(q[0].replace('___', q[1]), 'en') : 0).then(function () { return bekle(600); }).then(function () { if (ben !== durum) return; n++; if (n >= L.length) bitirEkran(s, x, 'bosluk', yildiz(hataT), hataT, L.length, 'Boşlukları doldurdun!'); else tur(); });
      });
    }
    if (SES) SES.soyle('Cümleye uyan kelimeyi seç.', 'tr');
    tur();
  }

  /* ---------------- 5) diyalog: Acadia sorar, çocuk cevabı seçer ---------------- */
  function diyalogOyun(s, x) {
    dur(); durum = {}; var ben = durum, E = ek(x.id); if (!E) return gezegen(s, x);
    var L = karistir(E.d), n = 0, hataT = 0, sc = sahne(s, x, L.length, 'Konuşalım');
    function tur() {
      if (ben !== durum) return; var q = L[n];
      sc.kart.innerHTML = '<div class="kc2-diyalog"><div class="kc2-dy-acd"><span class="kc2-acd" aria-hidden="true">' + acd('mutlu') + '</span><div class="kc2-balon"><b lang="en">' + esc(q[0]) + '</b><small>' + esc(q[3]) + '</small></div>' +
        '<button type="button" class="kc2-dinle" data-c2dinle aria-label="Soruyu dinle">' + (C ? C.simge('ses') : '♪') + '<span>Dinle</span></button></div>' +
        '<div class="kc2-dy-sen" data-c2sen><span class="kc2-dy-bos">Senin cevabın…</span></div></div><div class="kc2-secler kc2-secler-dy" data-c2sec></div>';
      sc.kart.querySelector('[data-c2dinle]').addEventListener('click', function () { if (SES) SES.soyle(q[0], 'en'); });
      if (SES) setTimeout(function () { if (ben === durum) SES.soyle(q[0], 'en'); }, 300);
      secenekler(sc.kart.querySelector('[data-c2sec]'), [q[1]].concat(q[2]), q[1], function (ilk, h) {
        hataT += h; sc.kart.querySelector('[data-c2sen]').innerHTML = '<span class="kc2-dy-cevap" lang="en">' + esc(q[1]) + '</span>'; sc.nokta(n);
        var i6 = il(); kalipYaz(i6, q[4], ilk); kaydet(i6);
        Promise.resolve(SES ? SES.soyle(q[1], 'en') : 0).then(function () { return bekle(700); }).then(function () { if (ben !== durum) return; n++; if (n >= L.length) bitirEkran(s, x, 'diyalog', yildiz(hataT), hataT, L.length, 'Güzel konuştun!'); else tur(); });
      });
    }
    if (SES) SES.soyle('Acadia soruyor. Doğru cevabı seç.', 'tr');
    tur();
  }

  function dur() { durum = null; if (SES && SES.sus) SES.sus(); }

  /* ---------------- veli raporu (Veli köşesi → Özet) ---------------- */
  function rapor(i) {
    var s = sinif(i) || (i.cumleD ? +(Object.keys(i.cumleD)[0] || '0').charAt(0) : 0);
    if (!i.cumleD || !Object.keys(i.cumleD).length) return '';
    var L = VERI[s] || [], KAL = (W.KIDS_CUMLE_EK || {}).KALIP || {}, kk = i.cumleKalip || {};
    var hafta = Date.now() - 7 * 864e5, log = (i.cumleLog || []).filter(function (z) { return z.t >= hafta; });
    var kal = Object.keys(kk).filter(function (k) { return kk[k].d + kk[k].y >= 2; }).map(function (k) { var t_ = kk[k].d + kk[k].y; return { k: k, ad: KAL[k] || k, o: kk[k].d / t_, t: t_ }; }).sort(function (a, b) { return b.o - a.o; });
    var guclu = kal.filter(function (z) { return z.o >= 0.75; }).slice(0, 3), zayif = kal.filter(function (z) { return z.o < 0.6; }).slice(-3).reverse();
    /* evde tekrar: zayıf kalıplardaki boşluk cümleleri, yoksa son kurulan cümleler */
    var ev = [];
    zayif.forEach(function (z) { L.forEach(function (x) { var E = ek(x.id); (E ? E.b : []).forEach(function (b) { if (b[4] === z.k && ev.length < 3 && durakD(i, x.id).bosluk) ev.push([b[0].replace('___', b[1]), b[3]]); }); }); });
    (i.cumleKurdu || []).slice().reverse().forEach(function (m) { if (ev.length < 3) ev.push([m, '']); });
    return '<section class="kc2-rapor"><h3>İlkokul · Cümle Galaksisi <small>' + (s ? s + '. sınıf' : '') + '</small></h3>' +
      '<ul class="kc2-r-tema">' + L.map(function (x) { var d = durakD(i, x.id), yap = DURAK.filter(function (z) { return d[z[0]] > 0; }).length; return '<li><b lang="en">' + esc(x.en) + '</b><span><i style="width:' + (yap * 20) + '%"></i></span><small>' + (tamamMi(i, x.id) ? '🏅 ' + (i.cumle[x.id] || 0) + '★' : yap + ' / 5') + '</small></li>'; }).join('') + '</ul>' +
      '<p class="ka-pen-alt">Bu hafta ' + log.length + ' durak oynadı' + (log.length ? ', ' + log.reduce(function (a, z) { return a + (z.n || 0); }, 0) + ' soru çözdü.' : '.') + '</p>' +
      (guclu.length || zayif.length ? '<div class="kc2-r-kalip">' + (guclu.length ? '<div><h4>Güçlü olduğu kalıplar</h4><ul>' + guclu.map(function (z) { return '<li>✅ ' + esc(z.ad) + '</li>'; }).join('') + '</ul></div>' : '') +
        (zayif.length ? '<div><h4>Biraz daha çalışılacak</h4><ul>' + zayif.map(function (z) { return '<li>⚠️ ' + esc(z.ad) + '</li>'; }).join('') + '</ul></div>' : '') + '</div>' : '') +
      (ev.length ? '<h4>Evde birlikte söyleyin</h4><ul class="ka-veli-ev">' + ev.map(function (c) { return '<li><button type="button" class="ka-dinle-k" data-en="' + esc(c[0]) + '" aria-label="Dinle">' + (C ? C.simge('ses') : '♪') + '</button><b lang="en">' + esc(c[0]) + '</b>' + (c[1] ? '<small>' + esc(c[1]) + '</small>' : '') + '</li>'; }).join('') + '</ul>' : '') + '</section>';
  }

  /* seslendirme kataloğu için: galaksinin söylediği bütün cümleler (kids/ses/katalog.js) */
  function cumleler() {
    var tr = [], en = [];
    [2, 3, 4].forEach(function (s) { (VERI[s] || []).forEach(function (x, k) {
      tr.push(x.tr + ' gezegenine yolculuk başlıyor!', 'Tebrikler! ' + x.tr + ' rozetini kazandın!'); en.push('Let\'s go to ' + x.en + '!');
      if (k) tr.push('Önce ' + VERI[s][k - 1].tr + ' gezegenini bitir.');
      DURAK.forEach(function (d, j) { tr.push(x.tr + ' gezegeni. Sıradaki durak: ' + d[1] + '.'); if (j) tr.push('Önce ' + DURAK[j - 1][1] + ' durağını bitir.'); });
      x.c.forEach(function (c) { en.push(metin(c[0])); });
      var e = ek(x.id); if (!e) return;
      e.k.forEach(function (w) { en.push(w[0]); });
      tr.push(e.r.tr); e.r.s.forEach(function (r) { en.push(r[1]); }); en.push(e.r.o);
      e.b.forEach(function (q) { en.push(q[0].replace('___', q[1])); });
      e.d.forEach(function (q) { en.push(q[0], q[1]); });
    }); });
    return { tr: tr, en: en };
  }

  function ac(o) { C = W.KIDS_CIZ; SES = W.KIDS_SES; oz = o; if (o.dur) o.dur(); warp(galaksi); return { dur: dur }; }
  W.KIDS_CUMLE = { ac: ac, VERI: VERI, DURAK: DURAK, parcala: parcala, metin: metin, dogruMu: dogruMu, yildiz: yildiz, karisik: karisik, gezegenYildiz: gezegenYildiz, gezegenAcik: gezegenAcik, durakAcik: durakAcik, tamamMi: tamamMi, cumleler: cumleler,
    rapor: function (i) { C = C || W.KIDS_CIZ; return rapor(i); }, _oz: function (o) { oz = o; } };
})(window);
