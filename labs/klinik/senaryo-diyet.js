/* ==========================================================================
   ACADEX KLİNİK · Diyet Lab senaryoları (labs/klinik/senaryo-diyet.js), 31.10.2026
   Diyet Lab vaka masasındaki 14 vaka ve enteral/parenteral'deki 4 vaka için sahne akışı.
   Klinik veriler (öykü, biyokimya, ağırlık) diyet-model.js'teki vakalarla aynıdır; sahnede
   yalnızca görüşme dili, muayene ve mentor geri bildirimi eklenir. Reçete puanı yine
   vakaPuan / epPuan ile Diyet Lab formunda verilir (devir hedefi: 'recete' | 'ep').
   EĞİTİM AMAÇLIDIR. Vakalar kurgusaldır.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else if (root.AXKLINIK && root.AXDIYET) root.AXKLINIK.ekle(factory(root.AXDIYET));
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';
  var vk = function (id) { return M.VK.filter(function (v) { return v.id === id; })[0]; };
  var ep = function (id) { return M.EP.filter(function (v) { return v.id === id; })[0]; };
  var vr = function (n) { return String(n).replace('.', ','); };
  /* biyokimya fişi: modeldeki değerlerden, anormaller işaretli */
  var fis = function (lab) {
    return lab.map(function (l) { var d = M.labDurum(l); return l[0] + ' ' + vr(l[1]) + (l[2] ? ' ' + l[2] : '') + (d === 'H' ? ' ↑' : d === 'L' ? ' ↓' : ''); }).join(' · ');
  };
  var DYT = { ad: 'Deniz', unvan: 'Uzm. Dyt.', cins: 'K' };
  var DR = { ad: 'Deniz', unvan: 'Dr.', cins: 'K' };

  /* ortak anamnez soruları: [id, soru]; vaka cevabı ve puanı vakada verilir */
  var Q = {
    sikayet: 'Sizi bugün buraya getiren nedir, ne zamandan beri?',
    ilac: 'Düzenli kullandığınız ilaçlar var mı?',
    besin: 'Dün sabahtan akşama neler yiyip içtiğinizi anlatır mısınız?',
    kilo: 'Son aylarda kilonuzda değişiklik oldu mu?',
    aktivite: 'Gün içinde ne kadar hareket ediyorsunuz?',
    aile: 'Ailede benzer hastalığı olan var mı?',
    istah: 'İştahınız nasıl, öğünlerinizi bitirebiliyor musunuz?',
    sindirim: 'Bağırsak alışkanlığınızda değişiklik var mı?',
    alkol: 'Alkol ya da sigara kullanıyor musunuz?',
    sivi: 'Günde ne kadar sıvı içiyorsunuz, idrarınızda değişiklik var mı?',
    beklenti: 'Bu görüşmeden beklentiniz ne?'
  };
  /* satır: [id, cevap, puan, not ('başlık|metin'), geri, kim, soru (yoksa Q[id])] */
  var sor = function (liste, hak, kotu) {
    var s = liste.map(function (x) { return { id: x[0], t: x[6] || Q[x[0]], cevap: x[1], puan: x[2], not: x[3] || null, geri: x[4] || null, kim: x[5] || null }; });
    if (kotu) s.push({ id: 'yargi', t: kotu[0], cevap: kotu[1], puan: -2, geri: kotu[2] || null });
    return { tip: 'sor', baslik: 'Anamnez', hak: hak || 4, yonerge: 'en önemli soruları seç', secenek: s };
  };
  var muayene = function (v, ekstra, yonerge) {
    var b = M.bki(v.kg, v.cm);
    var list = [
      { id: 'tarti', t: 'Tartıya çıkar', anim: 'tarti', deger: vr(v.kg) + ' kg', sonuc: 'Tartı ' + vr(v.kg) + ' kg gösteriyor.', puan: 2 },
      { id: 'boy', t: 'Boyunu ölç', anim: 'boy', deger: v.cm + ' cm', sonuc: 'Boy ' + v.cm + ' cm. BKİ ≈ ' + vr(Math.round(b * 10) / 10) + ' kg/m².', puan: 2 },
      { id: 'fis', t: 'Biyokimya fişini incele', anim: 'mentor', sonuc: fis(v.lab), puan: 3, geri: 'Anormal değerleri reçete formunda da işaretlemen gerekecek.' }
    ];
    return { tip: 'eylem', baslik: 'Ölçüm ve muayene', yonerge: yonerge || 'gerekenleri yap', secenek: list.concat(ekstra || []) };
  };
  var karar = function (soru, dogru, yanlislar) {
    var s = [{ t: dogru[0], dogru: true, geri: dogru[1] }].concat(yanlislar.map(function (y) { return { t: y[0], dogru: false, geri: y[1] }; }));
    /* sabit ama doğruyu başa koymayan sıra */
    var n = s.length, k = (soru.length % n); var out = s.slice(k).concat(s.slice(0, k));
    return { tip: 'karar', baslik: 'Klinik akıl yürütme', soru: soru, secenek: out };
  };
  var devir = function (metin, ep) { return { tip: 'devir', metin: metin, dugme: ep ? 'Beslenme planını hesapla' : 'Reçeteyi yaz', hedef: ep ? 'ep' : 'recete' }; };
  var hasta = function (v, ek) { return Object.assign({ ad: v.ad, yas: v.yas, cins: v.cins, gorunum: v.yas < 12 ? 'cocuk' : v.yas >= 65 ? 'yasli' : 'yetiskin' }, ek); };

  var L = [];
  /* ------------------------------ 1. Kemal Bey ------------------------------ */
  (function () { var v = vk('v-dm'); L.push({ id: 'dyt-v-dm', vaka: v.id, lab: 'diyet', oda: 'diyet', odaAd: 'Diyet polikliniği', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Kemal Bey', kiyafet: '#4E7AA8', sac: '#3A3A3A' }), mentor: DYT,
    adimlar: [
      { tip: 'konus', kim: 'anlatici', metin: 'Kemal Bey dahiliye polikliniğinden yönlendirilmiş. Elinde son tahlil sonuçları var.' },
      { tip: 'konus', kim: 'hasta', metin: 'Merhaba. Doktorum şekerim yüksek çıkınca sizinle görüşmemi istedi. Kilo vermem gerekiyormuş ama bir türlü olmuyor.' },
      { tip: 'konus', kim: 'mentor', metin: 'Görüşmeyi sen yürüt. Zamanımız kısıtlı: en çok dört soru sorabilirsin. Reçeteyi değiştirecek bilgileri öncele.' },
      sor([
        ['ilac', 'Üç yıldır şeker için metformin kullanıyorum, sabah ve akşam.', 3, 'İlaç|Metformin, 3 yıldır (tip 2 diyabet).'],
        ['besin', 'Sabah simit, öğlen iş yerinde ne çıkarsa. Akşam sofrada ekmeği çok yerim, yemekten sonra da tatlısız duramam.', 3, 'Beslenme|Akşam bol ekmek ve tatlı; öğün düzeni dağınık.'],
        ['aktivite', 'Muhasebeciyim, bütün gün masa başındayım. Yürüyüşe pek vaktim olmuyor.', 2, 'Aktivite|Hareketsiz, masa başı iş.'],
        ['beklenti', 'Kilo vermek istiyorum, bir de ilaç dozum artmasın.', 2, 'Hedef|Kilo kaybı; ilaç artışından kaçınmak.'],
        ['aile', 'Annemde de şeker vardı.', 0],
        ['alkol', 'Sigarayı beş yıl önce bıraktım, alkol nadiren.', 1, 'Alışkanlık|Sigarayı bırakmış, alkol nadir.']
      ], 4, ['Bu kiloya nasıl geldiniz, hiç mi dikkat etmediniz?', 'Ne bileyim… herkes bana bunu söylüyor zaten.', 'Suçlayıcı soru hastanın açıklığını azaltır. “Bir gününüzü anlatır mısınız?” gibi açık uçlu sor.']),
      muayene(v, [{ id: 'bel', t: 'Bel çevresini ölç', anim: 'hasta', deger: '108 cm', sonuc: 'Bel çevresi 108 cm (erkekte ≥102 cm çok artmış risk).', puan: 2 }, { id: 'odem', t: 'Bacaklarda ödem var mı bak', anim: 'hasta', sonuc: 'Ödem yok.', puan: 0 }]),
      karar('eGFR 88, potasyum 4,4. Bu hastada protein ya da potasyum kısıtlaması gerekir mi?',
        ['Hayır; böbrek işlevi ve potasyum normal, öncelik enerji açığı ve KH dağılımı', 'Doğru. Kısıtlama gereksiz yere besin çeşitliliğini azaltır; hedef ≈500 kcal açık ve %5–10 kilo kaybı.'],
        [['Evet; diyabetli her hastada protein kısıtlanır', 'Hayır. Protein kısıtlaması böbrek hastalığında düşünülür; burada eGFR 88.'], ['Yalnızca potasyum kısıtlanmalı', 'Potasyum 4,4 normal; kısıtlama gerekmez.']]),
      devir('Görüşme tamam. Şimdi bulguları reçeteye dök: hesap ağırlığı, enerji, protein, kısıtlamalar ve öneriler.')
    ] }); })();

  /* ------------------------------ 2. Nermin Hanım ------------------------------ */
  (function () { var v = vk('v-kbh'); L.push({ id: 'dyt-v-kbh', vaka: v.id, lab: 'diyet', oda: 'diyet', odaAd: 'Diyet polikliniği', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Nermin Hanım', kiyafet: '#7A4FA8' }), mentor: DYT,
    adimlar: [
      { tip: 'konus', kim: 'anlatici', metin: 'Nermin Hanım nefroloji polikliniğinden geliyor. Diyalize girmiyor.' },
      { tip: 'konus', kim: 'hasta', metin: 'Böbreklerim yavaş yavaş kötüleşiyormuş. Ne yiyip ne yemeyeceğimi bilmiyorum, kızım da her şeyi yasakladı.' },
      sor([
        ['ilac', 'Tansiyon ilacı kullanıyorum, yıllardır. Şekerim yok.', 3, 'Öykü|Hipertansiyon; diyabet yok.'],
        ['besin', 'Kahvaltıda peynir, zeytin; öğlen sebze yemeği, akşam bazen kuru fasulye. Meyveyi çok severim, muz ve portakal hiç eksik olmaz.', 3, 'Beslenme|Potasyumdan zengin meyveleri sık tüketiyor.'],
        ['sivi', 'Günde altı yedi bardak su içerim. İdrarım normal, şişlik olmadı.', 3, 'Sıvı|İdrar normal, ödem yok.'],
        ['istah', 'İştahım yerinde, biraz yorgunum o kadar.', 2, 'İştah|Korunmuş; hafif yorgunluk.'],
        ['kilo', 'Değişmedi, hep 60 kilo civarındayım.', 1],
        ['aile', 'Bilmiyorum, annemler köyde yaşardı.', 0]
      ], 4, ['Böbreğiniz bozulmuş, artık tuzlu hiçbir şey yemeyeceksiniz, tamam mı?', 'Peki… ama ben zaten az tuz yiyorum.', 'Bu bir soru değil, bilgi almadan verilmiş bir yasak. Önce dinle, sonra birlikte plan yap.']),
      muayene(v, [{ id: 'odem', t: 'Bacaklarda ödem var mı bak', anim: 'hasta', sonuc: 'Ödem yok; tansiyon 138/84 mmHg.', puan: 2 }]),
      karar('Potasyum 5,6, fosfor 5,2. Diyette öncelikle neyi düzenlersin?',
        ['Potasyumdan zengin besinleri ve fosfat katkılı işlenmiş ürünleri sınırlamayı', 'Doğru. Meyve-sebzeyi tamamen kesmek yerine düşük potasyumlu seçenekler ve haşlama gibi yöntemler; işlenmiş ürünlerdeki fosfat katkıları en kolay emilen fosfordur.'],
        [['Tüm meyve ve sebzeleri kesmeyi', 'Gereksiz kısıtlama lif, vitamin ve yaşam kalitesini düşürür; seçim ve hazırlama yöntemi değişir.'], ['Sıvıyı günde 1 litreyle sınırlamayı', 'Ödem yok, idrar normal: sıvı kısıtlaması bu evrede gerekmez.']]),
      devir('KDOQI 2020\'yi hatırla: diyaliz öncesi evre 3–5\'te protein ve enerji hedefleri neydi? Reçeteyi yaz.')
    ] }); })();

  /* ------------------------------ 3. Cem Bey ------------------------------ */
  (function () { var v = vk('v-hd'); L.push({ id: 'dyt-v-hd', vaka: v.id, lab: 'diyet', oda: 'diyet', odaAd: 'Diyaliz ünitesi diyet odası', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Cem Bey', kiyafet: '#2E8E7E' }), mentor: DYT,
    adimlar: [
      { tip: 'konus', kim: 'hasta', metin: 'Duydum ki böbrek hastası protein yememeliymiş. Ben de eti tamamen bıraktım. Ama son zamanlarda çok halsizim.' },
      sor([
        ['sikayet', 'Haftada üç gün diyalize giriyorum. Diyalizler arasında üç kilo kadar alıyorum, hemşireler kızıyor.', 3, 'Diyaliz|3×/hafta HD; diyalizler arası ≈3 kg.'],
        ['besin', 'Et yok. Ekmek, makarna, biraz sebze. Akşamları çerez yerim, kuruyemiş, cips.', 3, 'Beslenme|Protein düşük; tuzlu atıştırmalık.'],
        ['sivi', 'Susadıkça içiyorum, çay çok içerim. İdrarım çok az artık.', 3, 'Sıvı|Kontrolsüz sıvı; idrar çıkışı az.'],
        ['ilac', 'Fosfor ilacı verdiler ama bazen unutuyorum.', 2, 'İlaç|Fosfor bağlayıcı düzensiz.'],
        ['kilo', 'Kuru kilom 70 diyorlar.', 2, 'Ağırlık|Kuru ağırlık 70 kg.'],
        ['aile', 'Babam tansiyon hastasıydı.', 0]
      ], 4),
      muayene(v, [{ id: 'odem', t: 'Ödem ve tansiyonu değerlendir', anim: 'hasta', sonuc: 'Ayak bileklerinde hafif ödem; tansiyon 148/88 mmHg (diyaliz öncesi).', puan: 2 }]),
      karar('Cem Bey\'in “protein yememeliyim” düşüncesine ne dersin?',
        ['Diyalizde protein kaybı olur; gereksinim artar (1,0–1,2 g/kg). Fosforu kaynak seçimi ve bağlayıcıyla yönetiriz', 'Doğru. Albümin 3,3: protein-enerji yetersizliği riski. Kuru ağırlık 70 kg üzerinden hesapla.'],
        [['Haklı; protein böbreği yorar', 'Bu, diyaliz öncesi evre için geçerli bir yaklaşım; diyalizde protein kısıtlaması zararlıdır.'], ['Yalnızca bitkisel protein yesin, miktar önemli değil', 'Miktar önemli: 1,0–1,2 g/kg hedeflenir.']]),
      devir('Sıvı, potasyum, fosfor ve sodyum kontrolünü unutma. Reçeteyi yaz.')
    ] }); })();

  /* ------------------------------ 4. Elif Hanım ------------------------------ */
  (function () { var v = vk('v-colyak'); L.push({ id: 'dyt-v-colyak', vaka: v.id, lab: 'diyet', oda: 'diyet', odaAd: 'Diyet polikliniği', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Elif Hanım', kiyafet: '#D9472B', sac: '#7A4A22' }), mentor: DYT,
    adimlar: [
      { tip: 'konus', kim: 'hasta', metin: 'Çölyak tanısı aldım. Gastroenteroloğum glutensiz beslenmem gerektiğini söyledi ama nereden başlayacağımı bilmiyorum.' },
      sor([
        ['sikayet', 'Bir yıldır şişkinlik, ishal ve halsizlik vardı. Biyopsiyle tanı konuldu.', 3, 'Öykü|Şişkinlik, ishal, halsizlik; biyopsiyle çölyak.'],
        ['kilo', 'Son bir yılda dört kilo verdim.', 3, 'Ağırlık|1 yılda 4 kg kayıp.'],
        ['besin', 'Kahvaltıda simit, öğlen makarna ya da sandviç, akşam ev yemeği ve bulgur pilavı.', 3, 'Beslenme|Buğday ve bulgur ağırlıklı.'],
        ['sindirim', 'Glutensiz denediğim birkaç gün şişkinlik azaldı.', 1],
        ['istah', 'İştahım iyi ama yemekten sonra rahatsız oluyorum.', 1],
        ['aile', 'Teyzemde de çölyak var.', 1, 'Aile|Teyzede çölyak.']
      ], 4),
      muayene(v),
      karar('Elif Hanım soruyor: “Arada biraz ekmek yesem olur mu, az yersem bir şey olmaz değil mi?”',
        ['Hayır; az miktar gluten de bağırsak hasarını sürdürür, tedavi ömür boyu sıkı glutensiz diyettir', 'Doğru. Buğday, arpa, çavdar; yulaf yalnızca glutensiz sertifikalıysa.'],
        [['Haftada bir sorun olmaz', 'Belirti olmasa bile mukoza hasarı sürer.'], ['Sadece buğdayı kesmen yeterli', 'Arpa ve çavdar da gluten içerir.']]),
      devir('Demir, folat ve D vitamini değerlerine dikkat. BKİ ≈18: enerji hedefi kilo kazanımını desteklemeli. Reçeteyi yaz.')
    ] }); })();

  /* ------------------------------ 5. Hasan Bey ------------------------------ */
  (function () { var v = vk('v-siroz'); L.push({ id: 'dyt-v-siroz', vaka: v.id, lab: 'diyet', oda: 'acil', odaAd: 'Gastroenteroloji servisi', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Hasan Bey', ten: '#E6C890', sac: '#4A4A4A' }), mentor: DYT, vital: { nabiz: 92, ta: '104/66', spo2: 96 },
    adimlar: [
      { tip: 'konus', kim: 'anlatici', metin: 'Serviste yatan Hasan Bey\'in karnı asit nedeniyle şiş. Kolları ve bacakları incelmiş.' },
      { tip: 'konus', kim: 'hasta', metin: 'Karaciğerim için proteini kestim hocam. Et, yumurta yemiyorum. Ama günden güne zayıflıyorum.' },
      sor([
        ['alkol', 'Yıllarca içtim… Üç aydır ağzıma sürmedim.', 3, 'Alkol|Uzun süre kullanım, 3 aydır yok (tiamin!).'],
        ['besin', 'Sabah çay ve ekmek, öğlen çorba. Akşam erken yer yatarım, sabaha kadar bir şey yemem.', 3, 'Beslenme|Uzun gece açlığı; protein düşük.'],
        ['kilo', 'Tartıda kilom aynı ama kollarım eridi, karnım şişti.', 3, 'Ağırlık|Tartı yanıltıcı: asit + kas kaybı.'],
        ['ilac', 'İdrar söktürücü kullanıyorum.', 2, 'İlaç|Diüretik.'],
        ['istah', 'Karnım şiş olunca çabuk doyuyorum.', 2, 'İştah|Erken doyma (asit).'],
        ['aile', 'Kardeşim de karaciğerden rahatsız.', 0]
      ], 4, ['Bu hale içki yüzünden geldiniz, değil mi?', '…', 'Damgalayıcı dil güveni bozar. Alkol öyküsünü tarafsız sor: “Alkol kullanıyor musunuz, ne kadar?”']),
      muayene(v, [{ id: 'kas', t: 'Kas kitlesini değerlendir (kol çevresi, kavrama)', anim: 'hasta', sonuc: 'Üst kol çevresi düşük, el kavrama gücü zayıf: sarkopeni bulguları.', puan: 2 }, { id: 'asit', t: 'Asit derecesini doktordan öğren', anim: 'mentor', sonuc: 'Orta derecede asit; tahmini kuru ağırlık ≈73 kg.', puan: 3 }]),
      karar('Hasan Bey ensefalopati riskini düşünüp proteini kesmiş. Ne dersin?',
        ['Protein kısıtlanmaz; 1,2–1,5 g/kg, sık öğün ve gece geç ara öğün', 'Doğru. ESPEN 2019: kısıtlama sarkopeniyi kötüleştirir; ensefalopatide bile önerilmez.'],
        [['Protein 0,6 g/kg ile sınırlanmalı', 'Eski bir yaklaşım; malnütrisyonu ağırlaştırır.'], ['Önce sıvıyı 1 litreyle kısıtla', 'Sodyum 133: sıvı kısıtlaması yalnızca belirgin hiponatremide (<125) düşünülür.']]),
      devir('Asitli hastada hesabı hangi ağırlıkla yaparsın? Reçeteyi yaz.')
    ] }); })();

  /* ------------------------------ 6. Fatma Hanım ------------------------------ */
  (function () { var v = vk('v-yasli'); L.push({ id: 'dyt-v-yasli', vaka: v.id, lab: 'diyet', oda: 'acil', odaAd: 'Ortopedi servisi', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Fatma Hanım', gorunum: 'yasli' }), refakat: { ad: 'Kızı Ayşe Hanım', cins: 'K', gorunum: 'yetiskin', kiyafet: '#2E8E7E' }, mentor: DYT, vital: { nabiz: 84, ta: '126/72', spo2: 95 },
    adimlar: [
      { tip: 'konus', kim: 'anlatici', metin: 'Kalça kırığı ameliyatından sonra 3. gün. Fatma Hanım\'ın tepsisindeki yemeğin yarısı duruyor.' },
      { tip: 'konus', kim: 'refakat', metin: 'Annem eskiden böyle değildi. Son iki ayda çok zayıfladı, şimdi de hiçbir şey yemiyor.' },
      sor([
        ['kilo', '55 kiloydu, şimdi 50.', 3, 'Ağırlık|2 ayda 55 → 50 kg (≈%9).', null, 'refakat'],
        ['istah', 'Bir haftadır tabağının yarısını ancak yiyor.', 3, 'Alım|Son 1 hafta gereksinimin ≈yarısı.', null, 'refakat'],
        ['besin', 'Çorba içerim, biraz yoğurt. Et çiğneyemiyorum, dişlerim ağrıyor.', 2, 'Beslenme|Çiğneme güçlüğü; protein düşük.'],
        ['ilac', 'Tansiyon ilacı, bir de ağrı kesici.', 1],
        ['sivi', 'Pek su içmez, tuvalete kalkamadığı için.', 2, 'Sıvı|Az sıvı alımı.', null, 'refakat'],
        ['aile', 'Bilmem kızım, eskilerde kimse doktora gitmezdi.', 0]
      ], 4),
      muayene(v, [{ id: 'kas', t: 'El kavrama gücü ve baldır çevresi', anim: 'hasta', sonuc: 'Kavrama gücü düşük; baldır çevresi 29 cm.', puan: 2 }]),
      karar('Albümin 3,1 g/dL, CRP 18 mg/L. Albümin beslenme durumunu tek başına gösterir mi?',
        ['Hayır; akut fazda (ameliyat, CRP yüksek) düşer. Kilo kaybı ve alımın azalması daha değerli', 'Doğru. NRS-2002 bileşenlerini ayrı ayrı puanla.'],
        [['Evet; albümin düşükse malnütrisyon kesindir', 'Albümin inflamasyonda düşer; tek başına tanı koydurmaz.'], ['Albümin düzelene kadar beklenir', 'Beklemek malnütrisyonu derinleştirir; ONS hemen başlanabilir.']]),
      devir('NRS-2002 taramasını yap ve reçeteyi yaz: enerji, protein, ONS.')
    ] }); })();

  /* ------------------------------ 7. Zeynep Hanım ------------------------------ */
  (function () { var v = vk('v-gdm'); L.push({ id: 'dyt-v-gdm', vaka: v.id, lab: 'diyet', oda: 'diyet', odaAd: 'Gebe diyet polikliniği', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Zeynep Hanım', gebe: true, kiyafet: '#E7B14A', sac: '#2E241C' }), mentor: DYT,
    adimlar: [
      { tip: 'konus', kim: 'hasta', metin: 'Gebelik şekeri çıktı. Bebeğe zarar vermesin diye ekmeği, pilavı tamamen bırakmayı düşünüyorum.' },
      sor([
        ['kilo', 'Gebelikten önce 60 kiloydum, şimdi 68.', 3, 'Ağırlık|Gebelik öncesi 60 kg, şimdi 68 kg (28. hafta).'],
        ['besin', 'Sabah bol çaylı kahvaltı, öğlen geçiştiriyorum, akşam büyük bir öğün. Gece de meyve yiyorum.', 3, 'Öğün düzeni|Öğle atlanıyor, akşam büyük öğün.'],
        ['sikayet', '28. haftadayım. Yükleme testinde üç değerden ikisi yüksek çıktı.', 3, 'Tanı|OGTT (24–28. hafta) ile GDM.'],
        ['aktivite', 'Doktorum yürüyebilirsin dedi, akşamları yarım saat yürüyorum.', 2, 'Aktivite|Akşam 30 dk yürüyüş.'],
        ['ilac', 'Demir ve folik asit.', 1],
        ['aile', 'Annemde diyabet var.', 1, 'Aile|Annede diyabet.']
      ], 4),
      muayene(v),
      karar('Zeynep Hanım karbonhidratı tamamen kesmek istiyor. Ne önerirsin?',
        ['Kesmeden en az 175 g/gün KH; 3 ana + 2–3 ara öğüne dağıt, posalı kaynak seç', 'Doğru. KH\'nin tamamen kesilmesi ketoz ve yetersiz enerji riski taşır.'],
        [['Haklı; KH ne kadar azsa o kadar iyi', 'Gebelikte KH için alt sınır vardır.'], ['Kilo vermesi için enerjiyi azalt', 'Gebelikte kilo verme hedeflenmez.']]),
      devir('Gebelikte enerji ve protein gereksinimini düşün. Reçeteyi yaz.')
    ] }); })();

  /* ------------------------------ 8. Ece (pediatri) ------------------------------ */
  (function () { var v = vk('v-ped-obez'); L.push({ id: 'dyt-v-ped-obez', vaka: v.id, lab: 'diyet', oda: 'diyet', odaAd: 'Çocuk diyet polikliniği', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Ece', kiyafet: '#E86FA0', sac: '#5A3A22', yas: 10 }), refakat: { ad: 'Annesi', cins: 'K', gorunum: 'yetiskin', kiyafet: '#4E7AA8' }, mentor: DYT,
    adimlar: [
      { tip: 'konus', kim: 'refakat', metin: 'Okul hemşiresi gönderdi. Kızım çok kilo aldı, hemen on kilo vermesi lazım bence.' },
      { tip: 'konus', kim: 'mentor', metin: 'Çocukla da, aileyle de konuş. Soruları Ece\'nin anlayacağı dille sormayı unutma.' },
      sor([
        ['besin', 'Teneffüste kantinden simit ya da poğaça alıyorum. Akşam televizyon izlerken cips yiyorum, kola da içiyorum.', 3, 'Beslenme|Kantin hamur işi; ekran başında cips ve gazlı içecek.', null, 'hasta', 'Ece, okulda ve evde neler yiyip içiyorsun?'],
        ['aktivite', 'Beden eğitimi dersi var, başka spor yapmıyorum. Akşamları tablette oyun oynuyorum.', 3, 'Aktivite|Haftada 1 ders; ekran süresi uzun.', null, 'hasta', 'Okul dışında hangi oyunları oynuyorsun?'],
        ['aile', 'Ben de fazla kiloluyum. Babası da öyle.', 2, 'Aile|Anne ve baba fazla kilolu.', null, 'refakat', 'Evde başka kilo sorunu olan var mı?'],
        ['sikayet', 'Son iki yılda çok kilo aldı. Arkadaşları dalga geçiyor, okula gitmek istemediği günler oluyor.', 3, 'Psikososyal|Akran zorbalığı, okul isteksizliği.', null, 'refakat', 'Kilo artışı ne zamandan beri, Ece\'yi nasıl etkiliyor?'],
        ['ilac', 'Hayır, sürekli ilacı yok.', 0, null, null, 'refakat'],
        ['kilo', 'Büyüme eğrisinde hep üstteydi diyorlar.', 1, null, null, 'refakat']
      ], 4, ['Ece, bu kadar yemek yemesen kilo almazdın, değil mi?', '(Ece başını önüne eğiyor.)', 'Çocuğu suçlamak utanç ve gizli yemeyi artırır. Yargısız, aileyi kapsayan bir dil kullan.']),
      muayene(v, [{ id: 'persentil', t: 'WHO yaşa göre BKİ eğrisine işaretle', anim: 'mentor', sonuc: 'BKİ 25,1 · 10 yaş kız için WHO 2007 z ≈ +2,5 (≈99. persentil): obez.', puan: 3, geri: 'Çocukta BKİ yaşa ve cinsiyete göre z-skoru ya da persentille yorumlanır.' }, { id: 'tansiyon', t: 'Tansiyonu ölç', anim: 'hasta', sonuc: 'Tansiyon 112/70 mmHg; yaşına göre normal.', puan: 1 }]),
      karar('Annesi “hemen on kilo versin” diyor. Ne önerirsin?',
        ['Büyüme sürerken kiloyu korumak ya da yavaş azaltmak; bütün aile birlikte yaşam tarzını değiştirir', 'Doğru. Boy uzadıkça BKİ z-skoru düşer; sıkı diyet büyümeyi ve ilişkiyi olumsuz etkiler (AAP 2023).'],
        [['Günde 1000 kcal\'lik sıkı diyet', 'Çocukta sıkı kısıtlama büyüme ve beslenme yetersizliği riskidir.'], ['Sadece Ece\'ye ayrı yemek pişirilsin', 'Çocuğu ayrıştırmak yerine bütün ailenin alışkanlığı değişmeli.']]),
      devir('Pediatride Schofield ile BMH\'yi hesapla, WHO z-skorunu forma yaz ve reçeteyi tamamla.')
    ] }); })();

  /* ------------------------------ 9. Ada (osteomiyelit) ------------------------------ */
  (function () { var v = vk('v-ped-osteo'); L.push({ id: 'dyt-v-ped-osteo', vaka: v.id, lab: 'diyet', oda: 'acil', odaAd: 'Çocuk servisi', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Ada', yas: 5, sac: '#7A4A22', ifade: 'uzgun' }), refakat: { ad: 'Annesi', cins: 'K', gorunum: 'yetiskin', kiyafet: '#C8573A', ifade: 'uzgun' }, mentor: DYT, vital: { nabiz: 118, ta: '98/60', spo2: 98 },
    adimlar: [
      { tip: 'konus', kim: 'anlatici', metin: 'Ada sol bacağındaki osteomiyelit için damar yolundan antibiyotik alıyor. Ateşi 38 °C.' },
      { tip: 'konus', kim: 'refakat', metin: 'Hiçbir şey yemiyor. Ateşi olunca hiç iştahı kalmıyor.' },
      sor([
        ['istah', 'Kahvaltıda iki lokma, öğlen birkaç kaşık çorba. Sütü seviyor ama o da yarım kalıyor.', 3, 'Alım|Belirgin azalmış.', null, 'refakat'],
        ['sivi', 'Su içiyor ama az, idrarı koyu.', 3, 'Sıvı|Az alım, idrar koyu: ateşle kayıp artmış.', null, 'refakat'],
        ['kilo', 'Hastaneye yatmadan önce 15,5 kiloydu.', 2, 'Ağırlık|Yatıştan beri ≈0,5 kg kayıp.', null, 'refakat'],
        ['yutma', 'Hayır, rahat yutuyor, boğulma olmadı.', 2, 'Yutma|Sorun yok; oral beslenme uygun.', null, 'refakat', 'Yutarken öksürme ya da boğulma oluyor mu?'],
        ['alerji', 'Bildiğimiz bir alerjisi yok.', 1, null, null, 'refakat', 'Dokunan bir besin ya da alerji var mı?'],
        ['aile', 'Hayır.', 0, null, null, 'refakat']
      ], 4),
      muayene(v, [{ id: 'monitor', t: 'Monitördeki vital bulgulara bak', anim: 'monitor', sonuc: 'Nabız 118/dk, ateş 38 °C; tansiyon ve SpO₂ normal.', puan: 2 }, { id: 'persentil', t: 'WHO yaşa göre BKİ eğrisine işaretle', anim: 'mentor', sonuc: 'BKİ 12,9 · 5 yaş kız için z ≈ −1,9: normal sınırın alt ucu, zayıflığa çok yakın.', puan: 3 }]),
      karar('Ateş 38 °C. Enerji hesabına etkisi ne?',
        ['BMH her 1 °C için ≈ %13 artar; Schofield × 1,13 × aktivite/hastalık katsayısı', 'Doğru: 790 × 1,13 ≈ 895 kcal; yatakta ≈1,2–1,4 ile ≈1070–1250 kcal.'],
        [['Ateş enerji ihtiyacını değiştirmez', 'Ateş metabolik hızı artırır (DuBois).'], ['İştahsız olduğu için enerjiyi yarıya indir', 'Gereksinim artmışken alım düşükse açık büyür; az ve sık, enerji yoğun öğünler gerekir.']]),
      devir('Sıvıyı kısıtlama, artır. Protein gereksinimini enfeksiyona göre belirle ve reçeteyi yaz.')
    ] }); })();

  /* ------------------------------ 10. Murat Bey (nefrotik) ------------------------------ */
  (function () { var v = vk('v-nefrotik'); L.push({ id: 'dyt-v-nefrotik', vaka: v.id, lab: 'diyet', oda: 'diyet', odaAd: 'Nefroloji diyet polikliniği', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Murat Bey', kiyafet: '#5A6E3A' }), mentor: DYT,
    adimlar: [
      { tip: 'konus', kim: 'hasta', metin: 'İdrarla çok protein kaybediyormuşum. Ben de bol et, bol yumurta yiyeyim dedim, doğru mu yapıyorum?' },
      sor([
        ['sikayet', 'İki aydır göz kapaklarım ve bacaklarım şişiyor. 24 saatlik idrarda 6 gram protein çıktı.', 3, 'Öykü|2 aydır ödem; proteinüri 6,2 g/gün.'],
        ['besin', 'Sabah üç yumurta, öğlen döner, akşam kırmızı et. Tuzu da severim, turşu her sofrada.', 3, 'Beslenme|Yüksek protein ve tuz.'],
        ['ilac', 'Nefrolog ilaç başladı, idrar söktürücü de veriyor.', 2, 'İlaç|Diüretik + nefroloji tedavisi.'],
        ['kilo', 'Normalde 71 kiloyum, şişlikle 75\'e çıktım.', 3, 'Ağırlık|Ödemsiz ≈71 kg, şimdi 75 kg.'],
        ['aktivite', 'Masa başı çalışıyorum, pek hareketim yok.', 1],
        ['aile', 'Bildiğim kadarıyla yok.', 0]
      ], 4),
      muayene(v, [{ id: 'odem', t: 'Bacaklarda ödemi değerlendir', anim: 'hasta', sonuc: 'Pretibial bölgede gode bırakan ödem (+2).', puan: 2 }]),
      karar('“Kaybettiğim proteini yerine koymak için bol et yiyeyim” diyor. Doğru mu?',
        ['Hayır; yüksek protein proteinüriyi artırır. 0,8–1,0 g/kg, sodyum <2 g/gün, doymuş yağ azaltılır', 'Doğru (KDIGO 2021). Albümini diyetle yükseltmek mümkün değil; altta yatan hastalığın tedavisi belirleyicidir.'],
        [['Evet; 1,5–2 g/kg protein gerekir', 'Yüksek protein glomerüler yükü ve proteinüriyi artırır.'], ['Proteini 0,6 g/kg\'a indir', 'Bu kadar düşük protein malnütrisyon riskidir; 0,8–1,0 g/kg yeterli.']]),
      devir('Ödemli hastada hesap ağırlığını doğru seç ve reçeteyi yaz.')
    ] }); })();

  /* ------------------------------ 11. Selin Hanım (gut + DM) ------------------------------ */
  (function () { var v = vk('v-gut-dm'); L.push({ id: 'dyt-v-gut-dm', vaka: v.id, lab: 'diyet', oda: 'diyet', odaAd: 'Diyet polikliniği', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Selin Hanım', kiyafet: '#2F6BFF', sac: '#2E241C' }), mentor: DYT,
    adimlar: [
      { tip: 'konus', kim: 'hasta', metin: 'Ayak başparmağım iki kez şişip çok ağrıdı, gut dediler. Şekerim de çıktı. Hızlıca kilo vermek istiyorum, aç kalsam olur mu?' },
      sor([
        ['besin', 'Haftada birkaç kez ciğer, böbrek gibi sakatat ve kırmızı et yerim. Her gün meyve suyu ve gazlı içecek içerim.', 3, 'Beslenme|Sakatat, kırmızı et; her gün meyve suyu ve gazlı içecek.'],
        ['alkol', 'Hafta sonları bira içiyorum.', 3, 'Alkol|Hafta sonu bira.'],
        ['aktivite', 'Hafif aktifim, haftada birkaç gün yürüyorum.', 2, 'Aktivite|Hafif aktif.'],
        ['ilac', 'Atak için ilaç verdiler; şeker için yeni ilaç başlanacak.', 2, 'İlaç|Gut atak tedavisi; diyabet tedavisi yeni.'],
        ['sivi', 'Su pek içmem, gazlı içecek içerim.', 2, 'Sıvı|Su az.'],
        ['aile', 'Babamda gut var.', 1, 'Aile|Babada gut.']
      ], 4),
      muayene(v, [{ id: 'bel', t: 'Bel çevresini ölç', anim: 'hasta', deger: '86 cm', sonuc: 'Bel çevresi 86 cm (kadında ≥80 artmış, ≥88 çok artmış risk).', puan: 2 }]),
      karar('“Aç kalarak hızlıca kilo vereyim” diyor. Ne dersin?',
        ['Hayır; açlık ve hızlı kilo kaybı ürik asidi yükseltip atağı tetikleyebilir. Günlük ≈500 kcal açık yeterli', 'Doğru. Pürin, fruktoz ve alkol sınırlanır; KH öğünlere dağıtılır (ACR 2020).'],
        [['Evet; ne kadar hızlı o kadar iyi', 'Hızlı kayıp gutta atak riskini artırır.'], ['Proteini tamamen kes', 'Protein kesilmez; sakatat ve kırmızı et yerine süt ürünleri, yumurta ve baklagil.']]),
      devir('Harris-Benedict ile BMH × PAL − 500 kcal hesabını yap ve reçeteyi yaz.')
    ] }); })();

  /* =========================== enteral / parenteral (yoğun bakım, servis) =========================== */
  (function () { var c = ep('e-inme'); L.push({ id: 'dyt-e-inme', vaka: c.id, lab: 'diyet', oda: 'acil', odaAd: 'Nöroloji yoğun bakım', baslik: c.baslik,
    hasta: { ad: c.ad, hitap: 'Osman Bey', yas: c.yas, cins: c.cins, gorunum: 'yasli', ng: true, konusamaz: true, sac: '#C9C4BA' }, refakat: { ad: 'Kızı Elif Hanım', cins: 'K', gorunum: 'yetiskin', kiyafet: '#7A4FA8', ifade: 'uzgun' }, mentor: DR, vital: { nabiz: 86, ta: '150/85', spo2: 96 },
    adimlar: [
      { tip: 'konus', kim: 'anlatici', metin: 'İskemik inme sonrası 2. gün. Osman Bey yutamıyor; nazogastrik tüp takılmış. Hemodinamisi stabil.' },
      { tip: 'konus', kim: 'refakat', metin: 'Babam konuşamıyor, yutamıyor. Ne zaman yemek yiyebilecek?' },
      sor([
        ['kilo', 'İnmeden önce 80 kiloydu, boyu 1,75.', 3, 'Ağırlık|80 kg, 175 cm.', null, 'refakat', 'İnmeden önceki kilosunu ve boyunu biliyor musunuz?'],
        ['ilac', 'Şekeri yok, böbreği de iyiydi. Sadece tansiyon ilacı.', 3, 'Öykü|Diyabet ve böbrek sorunu yok.', null, 'refakat', 'Şeker ya da böbrek hastalığı var mıydı?'],
        ['besin', 'Son haftalarda iştahı iyiydi, normal yiyordu.', 2, 'Önceki alım|Normal; uzun açlık yok.', null, 'refakat', 'İnmeden önce beslenmesi nasıldı, iştahı var mıydı?'],
        ['alerji', 'Bildiğimiz bir şey yok.', 1, null, null, 'refakat', 'Besin alerjisi var mı?'],
        ['aile', 'Annesi de inme geçirmişti.', 0, null, null, 'refakat']
      ], 3),
      { tip: 'eylem', baslik: 'Başucu kontrolleri', yonerge: 'beslemeye başlamadan', secenek: [
        { id: 'ngyer', t: 'NG tüpün yerini doğrula', anim: 'hasta', sonuc: 'Tüpün yeri radyografi ile midede doğrulanmış; işaret burun girişinde 60 cm.', puan: 3, geri: 'Beslenmeden önce tüp yeri mutlaka doğrulanır; yanlış yerleşim aspirasyon ve pnömoni nedenidir.' },
        { id: 'yatak', t: 'Yatak başını 30–45° kaldır', anim: 'hasta', sonuc: 'Yatak başı 35° kaldırıldı.', puan: 3, geri: 'Aspirasyon riskini azaltır.' },
        { id: 'monitor', t: 'Monitörü kontrol et', anim: 'monitor', sonuc: 'Nabız 86, TA 150/85, SpO₂ %96: stabil.', puan: 2 },
        { id: 'bolus', t: 'Hemen 400 ml bolus ver', anim: 'monitor', sonuc: 'Monitör alarm veriyor: hasta öğürüyor, SpO₂ düşüyor.', puan: -3, vital: { spo2: 91, nabiz: 104 }, alarm: { spo2: true, nabiz: true }, geri: 'Yoğun bakımda hızlı bolus aspirasyon riskidir; sürekli pompa ile düşük hızdan başlanır.' }
      ] },
      karar('Enteral beslenmeye nasıl başlarsın?',
        ['Sürekli pompa, 10–20 ml/saat ile başla; 3–7 günde hedefe çık', 'Doğru (ESPEN 2019, yoğun bakım). Hedef ≈20–25 kcal/kg, protein ≈1,3 g/kg.'],
        [['İlk gün tam hedef hızla başla', 'Akut evrede kademeli artış önerilir.'], ['Yutması düzelene kadar beslemeyi ertele', 'Erken enteral beslenme (24–48 saat) önerilir.']]),
      devir('Hedef enerji ve proteini hesapla, ürünü seç ve pompa hızını belirle.', true)
    ] }); })();

  (function () { var c = ep('e-kbs'); L.push({ id: 'dyt-e-kbs', vaka: c.id, lab: 'diyet', oda: 'acil', odaAd: 'Genel cerrahi servisi', baslik: c.baslik,
    hasta: { ad: c.ad, hitap: 'Leyla Hanım', yas: c.yas, cins: c.cins, gorunum: 'yetiskin', sac: '#5A3A22' }, mentor: DR, vital: { nabiz: 80, ta: '118/74', spo2: 98 },
    adimlar: [
      { tip: 'konus', kim: 'hasta', metin: 'Ameliyattan sonra ağızdan yediğim her şey ishal yapıyor. Doktorlar damardan besleneceğimi söyledi.' },
      sor([
        ['sikayet', 'İnce bağırsağımın büyük kısmı alındı. Yemekten hemen sonra ishal oluyor.', 3, 'Öykü|Geniş ince bağırsak rezeksiyonu; malabsorpsiyon.'],
        ['kilo', '60 kiloyum ama giderek düşüyorum.', 3, 'Ağırlık|60 kg, düşüş eğilimi.'],
        ['sivi', 'Çok su kaybediyorum, sürekli susuyorum.', 2, 'Sıvı|Kayıp fazla.'],
        ['ilac', 'İshal için ilaç veriyorlar.', 1],
        ['aile', 'Yok.', 0]
      ], 3),
      { tip: 'eylem', baslik: 'TPN öncesi kontroller', yonerge: 'gerekenleri yap', secenek: [
        { id: 'kateter', t: 'Santral kateteri kontrol et', anim: 'hasta', sonuc: 'Santral venöz kateter yerinde; giriş yeri temiz.', puan: 3, geri: 'Santral yolda ozmolarite sınırı yoktur; periferik yolda ≈900 mOsm/L aşılmaz.' },
        { id: 'lab', t: 'Kan şekeri, trigliserit ve elektrolitlere bak', anim: 'mentor', sonuc: 'Kan şekeri 112 mg/dL, trigliserit 140 mg/dL; elektrolitler normal sınırda.', puan: 3 },
        { id: 'monitor', t: 'Vital bulgular', anim: 'monitor', sonuc: 'Stabil.', puan: 1 },
        { id: 'oral', t: 'Ağızdan yemeyi tamamen yasakla', anim: 'mentor', sonuc: 'Mentor itiraz ediyor.', puan: -1, geri: 'Tolere edilebildiği kadar oral/enteral alım bağırsak adaptasyonunu destekler.' }
      ] },
      karar('Leyla Hanım\'ın TPN torbasında hangi iki sınırı gözetirsin?',
        ['Lipid ≤1 g/kg/gün ve glukoz infüzyon hızı ≤4 mg/kg/dk', 'Doğru. Yüksek GIR hiperglisemi ve karaciğer yağlanması riskidir.'],
        [['Yalnızca toplam hacmi 1 litre tut', 'Hacimden önce enerji, protein, lipid ve GIR sınırları belirleyicidir.'], ['Lipidi hiç verme', 'Lipid hem enerji hem esansiyel yağ asidi kaynağıdır.']]),
      devir('Dekstroz, amino asit ve lipid hacimlerini hesapla.', true)
    ] }); })();

  (function () { var c = ep('e-refeed'); L.push({ id: 'dyt-e-refeed', vaka: c.id, lab: 'diyet', oda: 'acil', odaAd: 'Yeme bozuklukları servisi', baslik: c.baslik,
    hasta: { ad: c.ad, hitap: 'Defne', yas: c.yas, cins: c.cins, gorunum: 'genc', sac: '#7A4A22', ifade: 'uzgun' }, mentor: DR, vital: { nabiz: 52, ta: '88/56', spo2: 98 },
    adimlar: [
      { tip: 'konus', kim: 'hasta', metin: 'Yemek yemek istemiyorum… Herkes yemem gerektiğini söylüyor.' },
      { tip: 'konus', kim: 'mentor', metin: 'Sakin ve yargısız konuş. Bu hastada en büyük tehlike yeniden beslenme sendromu.' },
      sor([
        ['besin', 'Son yirmi gündür neredeyse hiçbir şey yemedim. Biraz su, bazen bir elma.', 3, 'Alım|≈20 gündür çok az alım.'],
        ['kilo', 'Otuz yedi kiloyum.', 3, 'Ağırlık|37 kg, BKİ 13,6.'],
        ['sikayet', 'Başım dönüyor, çabuk yoruluyorum.', 2, 'Belirti|Baş dönmesi, halsizlik.'],
        ['ilac', 'Bir şey kullanmıyorum.', 1],
        ['duygu', 'Sağlıklı olmak istiyorum ama korkuyorum.', 2, 'Motivasyon|Korku; iş birliğine açık.', null, null, 'Bize yardım etmemize izin verirsen nasıl hissedersin?']
      ], 3, ['Neden kendine bunu yapıyorsun?', '(Defne susuyor, gözleri doluyor.)', 'Suçlayıcı soru iş birliğini bozar. Duyguyu kabul eden açık uçlu sorular kullan.']),
      { tip: 'eylem', baslik: 'Risk değerlendirmesi', yonerge: 'beslemeye başlamadan', secenek: [
        { id: 'lab', t: 'Potasyum, fosfor ve magnezyuma bak', anim: 'mentor', sonuc: fis(c.lab), puan: 3, geri: 'Üçü de düşük: yüksek risk.' },
        { id: 'monitor', t: 'Monitör ve EKG', anim: 'monitor', sonuc: 'Nabız 52 (bradikardi), TA 88/56.', puan: 2 },
        { id: 'tarti', t: 'Tartı ve boy', anim: 'hasta', deger: vr(c.kg) + ' kg', sonuc: vr(c.kg) + ' kg, ' + c.cm + ' cm · BKİ 13,6.', puan: 2 }
      ] },
      karar('Beslenmeye hangi enerjiyle başlarsın?',
        ['En çok 10 kcal/kg (aşırı riskte ≈5); tiamin, elektrolit replasmanı ve günlük izlem', 'Doğru (NICE CG32). Enerji 4–7 günde kademeli artırılır.'],
        [['Hemen 30 kcal/kg ile tam gereksinim', 'Hipofosfatemi, aritmi ve kalp yetmezliği riski.'], ['Elektrolitler düzelene kadar hiç besleme', 'Beslenme ertelenmez; düşük enerjiyle, replasmanla birlikte başlanır.']]),
      devir('Başlangıç enerjisini ve önlemleri seç.', true)
    ] }); })();


  /* ============ 31.10.2026: Acadex Medica yeni hastaları (Nurten Hanım: Odyoloji'den konsültasyon) ============ */
  /* ------------------------------ Ahmet Bey · DASH ------------------------------ */
  (function () { var v = vk('v-dash'); L.push({ id: 'dyt-v-dash', vaka: v.id, lab: 'diyet', oda: 'diyet', odaAd: 'Kardiyoloji diyet polikliniği', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Ahmet Bey', kiyafet: '#4E7AA8' }), mentor: DYT, vital: { nabiz: 82, ta: '152/96', spo2: 98 },
    adimlar: [
      { tip: 'konus', kim: 'hasta', metin: 'Tansiyon ilacımı içiyorum ama yine 150’lerde. Doktor “tuzu kes” dedi; ben zaten tuzluğu sofradan kaldırdım.' },
      sor([
        ['besin', 'Sabah simit ve peynir, öğlen dışarıda döner ya da pide, akşam turşulu yemek. Hazır çorbayı da severim.', 3, 'Gizli tuz|Simit, peynir, turşu, hazır çorba, dışarıda yemek.'],
        ['ilac', 'Tansiyon ilacı ve kolesterol için yeni bir hap.', 2, 'İlaç|Antihipertansif + statin.'],
        ['aktivite', 'Masa başındayım, akşamları biraz yürürüm.', 2, 'Aktivite|Hafif aktif.'],
        ['kilo', 'Beş yılda on kilo aldım.', 2, 'Ağırlık|5 yılda +10 kg.'],
        ['sebze', 'Pek yemem; meyveyi de unutuyorum.', 3, 'Sebze-meyve|Çok az.', null, null, 'Günde kaç porsiyon sebze ve meyve yiyorsunuz?'],
        ['aile', 'Babam da tansiyondan felç geçirdi.', 1]
      ], 4, ['Tuzu kesmediğiniz için mi tansiyonunuz düşmüyor?', 'Ama ben tuzluğu kaldırdım…', 'Suçlamak yerine gizli tuz kaynaklarını birlikte bulmak davranışı değiştirir.']),
      muayene(v, [{ id: 'bel', t: 'Bel çevresini ölç', anim: 'hasta', sonuc: 'Bel çevresi 108 cm.', deger: '108 cm', puan: 2 }, { id: 'ta', t: 'Kan basıncını ölç', anim: 'monitor', sonuc: 'TA 152/96 mmHg.', deger: '152/96', puan: 1 }]),
      karar('Tuzluğu kaldırmasına rağmen tansiyonu neden düşmüyor olabilir, ilk öneri ne olmalı?',
        ['Tuzun çoğu ekmek, peynir, turşu ve hazır gıdalardan gelir: DASH tipi beslenme, sodyum <2 g/gün (≈5 g tuz) ve kilo kaybı', 'Doğru. Gizli tuz kaynakları ve sebze-meyve-süt ürünlerinden zengin DASH, kan basıncını belirgin düşürür.'],
        [['Potasyumu kısıtlamak', 'Böbrek işlevi normal; potasyumdan zengin besinler DASH’ın bir parçasıdır.'], ['Yalnızca ilaç dozunu artırmak, beslenme değişmez', 'Beslenme değişikliği ilacın etkisini artırır.']]),
      devir('Reçeteyi yaz: enerji açığı, kısıtlamalar ve öneriler.')
    ] }); })();

  /* ------------------------------ Nurten Hanım · kemoterapi ------------------------------ */
  (function () { var v = vk('v-onko'); L.push({ id: 'dyt-v-onko', vaka: v.id, lab: 'diyet', oda: 'diyet', odaAd: 'Onkoloji diyet polikliniği', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Nurten Hanım', kiyafet: '#9E5B7A', ifade: 'uzgun' }), mentor: DYT, vital: { nabiz: 92, ta: '108/68', spo2: 97 },
    adimlar: [
      { tip: 'konus', kim: 'anlatici', metin: 'Odyoloji polikliniğinden konsültasyon: “Sisplatin alıyor, iştahı çok azalmış, kilo kaybı var.”' },
      { tip: 'konus', kim: 'hasta', metin: 'Yemeklerin tadı metal gibi geliyor. Eti görünce midem bulanıyor. Bir de şekerin kanseri büyüttüğünü okudum.' },
      sor([
        ['kilo', 'Bir ay önce 58 kiloydum, şimdi 54.', 3, 'Ağırlık|1 ayda 58 → 54 kg (≈%7).'],
        ['istah', 'Tabağımın yarısını ancak bitiriyorum.', 3, 'Alım|Gereksinimin ≈yarısı.'],
        ['besin', 'Sabah biraz ekmek, öğlen yoğurt, akşam çorba. Et hiç yiyemiyorum.', 2, 'Beslenme|Protein düşük.'],
        ['bulanti', 'Kürden sonraki üç gün çok kötü, sonra biraz düzeliyor.', 2, 'Bulantı|Kür sonrası 3 gün yoğun.', null, null, 'Bulantı ne zaman artıyor, ne zaman azalıyor?'],
        ['aile', 'Annemde de şeker vardı.', 0]
      ], 3, ['Kemoterapide kilo vermek normal, neden dert ediyorsunuz?', 'Bilmiyorum, normal sanıyordum…', 'Kilo kaybı “normal” sayılmaz; tedavinin başarısını ve dayanıklılığı etkiler.']),
      muayene(v, [{ id: 'kas', t: 'El kavrama gücü ve kol çevresi', anim: 'hasta', sonuc: 'Kavrama gücü düşük; üst orta kol çevresi 23 cm.', puan: 2 }]),
      karar('“Şeker kanseri besler, enerjiyi keselim mi?” sorusuna yanıtın ne olur?',
        ['Hayır; kilo kaybını durdurmak öncelik: 25–30 kcal/kg, 1,0–1,5 g/kg protein, az ve sık öğün ve ONS', 'Doğru (ESPEN 2021). Enerji kısıtlaması kaşeksiyi hızlandırır; tat değişikliğine göre protein kaynağı (yumurta, süt ürünü, baklagil) seçilir.'],
        [['Evet, şeker ve karbonhidrat tamamen kesilsin', 'Kanıta dayanmaz; enerji açığı kas kaybını hızlandırır.'], ['İştahı açılana kadar beklenir', 'Bekleme malnütrisyonu derinleştirir.']]),
      devir('NRS-2002’yi puanla ve reçeteyi yaz: enerji, protein, ONS ve öğün düzeni.')
    ] }); })();

  /* ------------------------------ Gülay Hanım · osteoporoz ------------------------------ */
  (function () { var v = vk('v-osteo'); L.push({ id: 'dyt-v-osteo', vaka: v.id, lab: 'diyet', oda: 'diyet', odaAd: 'Diyet polikliniği', baslik: v.baslik,
    hasta: hasta(v, { hitap: 'Gülay Hanım', kiyafet: '#5E8F4A', gozluk: true }), mentor: DYT,
    adimlar: [
      { tip: 'konus', kim: 'hasta', metin: 'Kemik erimesi çıktı. Komşum “et yeme, kemiği eritir” dedi; sütü zaten şişkinlik yaptığı için bıraktım.' },
      sor([
        ['besin', 'Kahvaltıda zeytin ve çay, öğlen sebze yemeği, akşam çorba. Süt ve yoğurt yok.', 3, 'Kalsiyum|Süt ürünü yok.'],
        ['gunes', 'Pek dışarı çıkmam; çıkınca da kapalıyım.', 3, 'D vitamini|Güneş teması az.', null, null, 'Güneşe ne kadar çıkıyorsunuz?'],
        ['dusme', 'Geçen kış buzda düştüm; kırık yoktu.', 2, 'Düşme|Geçen kış düşme.', null, null, 'Son bir yılda düştünüz mü?'],
        ['ilac', 'Doktor haftada bir içilen bir kemik ilacı başladı.', 2, 'İlaç|Osteoporoz tedavisi başlanmış.'],
        ['aile', 'Annemin de kalçası kırılmıştı.', 1],
        ['tv', 'Akşamları dizi izlerim.', 0, null, null, null, 'Akşamları neler yaparsınız?']
      ], 4, ['Süt içmezseniz kemikleriniz nasıl iyileşsin?', 'Ama dokunuyor…', 'Laktoz yakınmasında seçenekleri birlikte bulmak, azarlamaktan etkilidir.']),
      muayene(v),
      karar('“Et yemek kemiği eritir mi, proteini kısalım mı?”',
        ['Hayır; 1,0–1,2 g/kg protein, ≈1000–1200 mg/gün kalsiyum ve D vitamini kemiği ve kası korur', 'Doğru (IOF/ESCEO). Yoğurt, kefir, peynir ya da laktozsuz süt kalsiyum açığını kapatır.'],
        [['Evet, protein kemikten kalsiyum çeker; kısalım', 'Yeterli protein kemik ve kas sağlığı için gereklidir.'], ['Kalsiyum tableti yeterli, beslenme değişmez', 'Öncelik besin kaynaklarıdır; D vitamini eksikliği de düzeltilmelidir.']]),
      devir('Reçeteyi yaz: enerji, protein ve öneriler (kalsiyum, D vitamini).')
    ] }); })();

  /* ------------------------------ Kadir Bey · PEG ------------------------------ */
  (function () { var c = ep('e-peg'); L.push({ id: 'dyt-e-peg', vaka: c.id, lab: 'diyet', oda: 'diyet', odaAd: 'Evde beslenme polikliniği', baslik: c.baslik,
    hasta: { ad: c.ad, hitap: 'Kadir Bey', yas: c.yas, cins: c.cins, gorunum: 'yetiskin', konusamaz: true, kiyafet: '#6E5236', ifade: 'uzgun' }, refakat: { ad: 'Eşi Hülya Hanım', cins: 'K', gorunum: 'yetiskin', kiyafet: '#C8573A' }, mentor: DYT,
    adimlar: [
      { tip: 'konus', kim: 'anlatici', metin: 'Radyoterapi sürüyor. Kadir Bey’in yutması çok ağrılı; karnındaki PEG ile evde beslenecek.' },
      { tip: 'konus', kim: 'refakat', metin: 'Doktor makineyle 20 saat vereceğiz dedi. Ne kadar, hangi mamayı vereceğimizi bilmiyoruz.' },
      sor([
        ['kilo', 'İki ay önce 66 kiloydu, şimdi 58. Boyu 1,72.', 3, 'Ağırlık|2 ayda 66 → 58 kg (≈%12).', null, 'refakat', 'Kilosu ne kadar değişti, boyu kaç?'],
        ['ilac', 'Şekeri, böbreği yok. Ağrı kesici ve mide koruyucu kullanıyor.', 3, 'Öykü|Diyabet ve böbrek sorunu yok.', null, 'refakat', 'Şeker ya da böbrek hastalığı var mı?'],
        ['bagirsak', 'İki gündür kabız.', 2, 'Bağırsak|Kabızlık.', null, 'refakat', 'Bağırsak alışkanlığı nasıl?'],
        ['ev', 'Gece makinenin sesinden uyuyamıyoruz, 4 saat ara veriyoruz.', 1, null, null, 'refakat', 'Evde düzeniniz nasıl, ne zaman ara veriyorsunuz?'],
        ['aile', 'Babası da sigara içerdi.', 0, null, null, 'refakat']
      ], 3),
      { tip: 'eylem', baslik: 'PEG ve hazırlık', yonerge: 'beslemeye başlamadan', secenek: [
        { id: 'peg', t: 'PEG çevresini ve tüp işaretini kontrol et', anim: 'hasta', sonuc: 'Stoma temiz, kızarıklık yok; tüp işareti 3 cm’de.', puan: 3, geri: 'Her beslenmeden önce stoma ve tüp konumu kontrol edilir.' },
        { id: 'yatak', t: 'Beslenme sırasında başın yüksek tutulmasını anlat', anim: 'mentor', sonuc: 'Eşi gece yatağın baş tarafını kaldıracak.', puan: 2 },
        { id: 'yika', t: 'Tüpün su ile yıkanmasını göster', anim: 'mentor', sonuc: 'Her beslenme ve ilaçtan sonra 30 ml su ile yıkama gösterildi.', puan: 2 },
        { id: 'ilac', t: 'Bütün ilaçları ezip mamaya karıştırmalarını söyle', anim: 'mentor', sonuc: 'Mamaya karışan ilaçlar tüpü tıkayabilir ve etkileşir.', puan: -3, geri: 'İlaçlar mamaya karıştırılmaz; ayrı verilip tüp yıkanır.' }
      ] },
      karar('Standart 1,0 kcal/ml ürünle hedef enerjiye ulaşınca protein yeterli olur mu?',
        ['Hayır; ≈1600 ml standart ürün ≈64 g protein verir, hedef 70–87 g: yüksek proteinli ürün ya da protein modülü gerekir', 'Doğru. Radyoterapide kilo kaybını durdurmak için protein hedefin üst kısmına yakın tutulur.'],
        [['Evet, enerji yeterliyse protein de yeterlidir', 'Enerji ve protein ayrı hedeflerdir.'], ['Protein kısıtlanmalı, böbreği yormasın', 'Böbrek işlevi normal; kısıtlama gerekmez.']]),
      devir('Hedef enerji ve proteini hesapla, ürünü seç ve 20 saatlik pompa hızını belirle.', true)
    ] }); })();

  return L;
});
