/* ==========================================================================
   ACADEX İSTATİSTİK · “Tahmin et, sonra gör” soruları (labs/istat/ist-tahmin.js), 13.11.2026
   IST.TAHMIN[hafta][sahne] = [soru, [seçenekler], doğru indeks, açıklama]
   Kart, sahne metninin ilk yarısından sonra çıkar; cevaplanınca (ya da “geç”) metnin ve
   görselin kalanı açılır. null olan sahnede kart yok.
   ========================================================================== */
(function () {
  'use strict';
  window.IST.TAHMIN = {
    g1: [
      ['İstatistiğin asıl amacı sence hangisi?', ['Veriyi saklamak', 'Belirsizlik altında karar vermek', 'Grafik çizmek'], 1, 'Topla, özetle, yorumla: hepsi daha iyi bir karar için.'],
      ['Site sana hangi ürünü önerir?', ['Rastgele bir ürün', 'En pahalı ürün', 'Sana benzeyen müşterilerin aldığı ürün'], 2, 'Benzer demografik profildeki müşterilerle eşleştirilirsin.'],
      ['4 şirket ve 3 değişken varsa tabloda kaç veri değeri olur?', ['7', '12', '4'], 1, '4 × 3 = 12 veri değeri.'],
      ['Sınıf düzeyi (1. sınıf, 2. sınıf…) hangi ölçekte?', ['Sınıflama', 'Sıralama', 'Oran'], 1, 'Sıra anlamlı, ama aradaki farkın büyüklüğü ölçülemez.'],
      ['“New York 30°C, Londra 20°C; New York 1,5 kat sıcak” demek doğru mu?', ['Doğru', 'Yanlış'], 1, '°C’de gerçek sıfır yok; yalnızca “10°C daha sıcak” diyebiliriz.'],
      ['Ortalama alabilmek için en az hangi ölçek gerekir?', ['Sıralama', 'Aralık', 'Sınıflama'], 1, 'Toplama-çıkarma aralık ölçeğinde anlamlı olur.']
    ],
    g2: [
      ['“Bir saatte gelen müşteri sayısı” nasıl bir veri?', ['Nitel', 'Nicel · kesikli', 'Nicel · sürekli'], 1, 'Sayılarak elde edilir: 0, 1, 2…'],
      ['“Haziranda her ilçenin ruhsat sayısı” hangi tür veri?', ['Kesit verisi', 'Zaman serisi'], 0, 'Aynı zaman noktası, farklı elemanlar.'],
      ['Araştırmacı ilaç dozunu kendisi belirliyorsa çalışma…', ['Deneysel', 'Gözlemsel'], 0, 'Değişken kontrol ediliyor.'],
      ['50 faturanın maliyetleri en çok hangi aralıkta toplanmıştır sence?', ['50–59 $', '70–79 $', '100–109 $'], 1, 'Histogramda en yüksek sütun 70–79 $; ortalama ≈ 79 $.'],
      ['Örneklemden hesaplanan x̄’e ne ad verilir?', ['Parametre', 'İstatistik'], 1, 'Anakütleyi betimleyen sayı parametre (μ), örneklemden hesaplanan istatistik (x̄).'],
      ['50 faturadan “tüm bakımların ortalaması ≈ 79 $” demek…', ['Betimsel', 'Çıkarımsal'], 1, 'Örneklemden anakütleye genelleme yapılıyor.']
    ],
    g3: [
      ['Tabloda Hasan’ın yaşı (56) neyin örneği?', ['Değişken', 'Gözlem', 'Birim'], 1, 'Bir hücredeki değer bir gözlemdir.'],
      ['TÜİK’ten indirilen nüfus verisi nasıl bir veri?', ['Birincil', 'İkincil'], 1, 'Başkasının toplayıp yayımladığı veri.'],
      ['Hep 50 g fazla gösteren terazinin hatası…', ['Rastgele', 'Sistematik'], 1, 'Hep aynı yöne kayıyor; ölçüm sayısını artırmak düzeltmez.'],
      ['52 kişiden 17’si “katılıyorum” dediyse yüzde kaç?', ['%17', '%32,7', '%52'], 1, '17 / 52 = 0,327 → %32,7.'],
      ['İlk dört sınıfın birikimli frekansı (2 + 21 + 8 + 26) kaçtır?', ['26', '57', '90'], 1, 'Birikimli frekans önceki tüm frekansların toplamı: 57.'],
      ['Kadın ve erkekleri adil karşılaştırmak için hangisini kullanırız?', ['Ham sayılar', 'Satır yüzdeleri'], 1, 'Gruplar farklı büyüklükte (175 ve 225); yüzdeye çevirmek gerekir.']
    ],
    g4: [
      ['30 günlük şikâyet sayısı için hangi grafik en sade?', ['Pasta', 'Nokta grafiği', 'Çizgi'], 1, 'Küçük veri setinde her gözlem bir nokta.'],
      ['Alt grupları yan yana karşılaştırmak için hangisi?', ['Yığılmış sütun', 'Gruplanmış sütun'], 1, 'Gruplanmış sütun alt grupları yan yana koyar.'],
      ['Histogramda sütunlar neden bitişiktir?', ['Güzel göründüğü için', 'Sınıflar kesintisiz bir sayı doğrusunu böldüğü için'], 1, 'Sürekli veride sınıflar arasında boşluk yoktur.'],
      ['15 kişiden 5’i Avrupa’yı seçtiyse dilim kaç derece?', ['60°', '120°', '90°'], 1, '5/15 × 360° = 120°.'],
      ['Dondurma satışlarının zirvesi hangi aylarda olur?', ['Ocak–Şubat', 'Temmuz–Ağustos', 'Ekim–Kasım'], 1, 'Çizgi grafiği mevsimselliği gösterir.'],
      ['Noktalar sağa doğru yükseliyorsa ilişki…', ['Pozitif', 'Negatif', 'Yok'], 0, 'x arttıkça y de artıyor.']
    ],
    g5: [
      ['Merkezî eğilim ölçüsü neyi anlatır?', ['Verinin yayılımını', 'Verinin tipik (orta) değerini'], 1, 'Tek bir sayıyla “ortayı” özetler.'],
      ['(3, 1, 3, 2, 10, 9, 3, 10, 3, 4) verisinin modu?', ['3', '10', '4,8'], 0, '3 dört kez geçiyor.'],
      ['24 yarışmacıda en sık görülen yaş?', ['15', '16', '17'], 1, '16 yaş 4 kez geçiyor.'],
      ['Modal sınıf hangisi (f: 4, 10, 6, 4)?', ['10–15', '15–20', '20–25'], 1, 'En yüksek frekans 10: 15–20 sınıfı.'],
      ['9 sıralı değerde medyan kaçıncı gözlemdir?', ['4.', '5.', '4,5.'], 1, '(9 + 1)/2 = 5.'],
      ['En büyük değer 29 → 290 olursa medyan ne olur?', ['Artar', 'Değişmez', 'Azalır'], 1, 'Medyan dirençlidir; yalnızca sıradaki konuma bakar.']
    ],
    g6: [
      ['2, 4, 4, 7, 13 tahtada; destek nereye konursa denge olur?', ['4’te', '6’da', '7’de'], 1, 'Denge noktası ortalamadır: 30/5 = 6.'],
      ['Gruplanmış veride her sınıfı hangi değer temsil eder?', ['Alt sınır', 'Orta nokta', 'Üst sınır'], 1, 'Gerçek değerleri bilmeyiz; orta noktayı kullanırız.'],
      ['Vize 70, ödev 90, final 60 (final %50). Not 73,3’ten…', ['Yüksek çıkar', 'Düşük çıkar'], 1, 'Final ağırlıklı olduğu için 69’a iner.'],
      ['Her değere 5 eklenirse ortalama?', ['Değişmez', '5 artar', '5 katına çıkar'], 1, 'ort(x + a) = x̄ + a.'],
      ['+%10, +%50, −%20 getirinin ortalaması %13,3 mü?', ['Evet', 'Hayır, daha az'], 1, 'Oranlar çarpılır: geometrik ortalama %9,7.'],
      ['Aykırı değere en duyarlı ölçü hangisi?', ['Medyan', 'Orta değer', 'Kırpılmış ortalama'], 1, 'Orta değer yalnızca iki uca bakar.']
    ],
    g7: [
      ['Zarda “çift sayı” olayının olasılığı?', ['1/6', '1/2', '1/3'], 1, '{2, 4, 6}: 3/6 = 0,5.'],
      ['Zarı 600 kez atınca “3”ün oranı nereye yaklaşır?', ['0,5', '1/6 ≈ 0,167', '0'], 1, 'Büyük sayılar yasası: deneysel oran klasik değere yaklaşır.'],
      ['5 kişiden 2 kişilik kaç komite kurulur?', ['10', '20', '25'], 0, 'Sıra önemsiz: C(5, 2) = 10.'],
      ['0,07 + 0,05 − 0,03 = ? (en az biri geç kalır)', ['0,12', '0,09', '0,03'], 1, 'Kesişim iki kez sayılmasın diye çıkarılır.'],
      ['Dört telefonun hepsinin sorunsuz çalışma olasılığı 0,95’ten…', ['Büyük', 'Küçük'], 1, '0,95⁴ = 0,8145.'],
      ['Bakım gereken aracın B’den olma olasılığı 0,30’dan…', ['Büyük', 'Küçük', 'Aynı'], 0, 'B’nin bakım oranı yüksek; olasılık 0,43’e çıkar.']
    ],
    g9: [
      ['100 şişe 470, 100 şişe 530 ml. Ortalama kaç?', ['470', '500', '530'], 1, 'Ortalama 500 ama hiçbir şişe 500 değil!'],
      ['Üç setin açıklığı aynı (20). Yayılımları da aynı mı?', ['Evet', 'Hayır'], 1, 'Açıklık yalnızca iki uca bakar.'],
      ['Örneklem varyansında paydaya ne yazılır?', ['n', 'n − 1', 'n + 1'], 1, 'n − 1 ile s², σ²’nin yansız tahmincisi olur.'],
      ['B şehrinin s’si neden yüksek?', ['Ortalaması büyük', 'İki aykırı değer var'], 1, '18 ve 19 değerleri yayılımı şişiriyor.'],
      ['n = 11 için Q1 kaçıncı gözlem?', ['2.', '3.', '4.'], 1, '0,25 × 12 = 3.'],
      ['Medyan Q1’e yakın, sağ bıyık uzun: dağılım…', ['Simetrik', 'Sağa çarpık', 'Sola çarpık'], 1, 'Uzun kuyruk sağda.']
    ],
    g10: [
      ['Üç para atışında X = yazı sayısı hangi değerleri alır?', ['1, 2, 3', '0, 1, 2, 3', '0–8'], 1, 'Hiç yazı (HHH) da mümkün.'],
      ['“Bir çağrının süresi” nasıl bir rastgele değişken?', ['Kesikli', 'Sürekli'], 1, 'Ölçülür; bir aralıktaki her değeri alabilir.'],
      ['Olasılıkların toplamı kaç olmalı?', ['0', '1', 'n'], 1, 'Σ P(X = x) = 1.'],
      ['2/9 + 3/9 + 4/9 = ?', ['1', '9/27', '0,9'], 0, 'Toplam 1: geçerli bir olasılık fonksiyonu.'],
      ['P(X = 1) üç parada kaç?', ['1/8', '3/8', '1/2'], 1, 'Tek yazılı üç sonuç var: THH, HTH, HHT.'],
      ['Üç parada beklenen yazı sayısı?', ['1', '1,5', '2'], 1, 'Simetrik dağılımın ortası: 1,5.']
    ],
    g11: [
      ['Hangisi Bernoulli denemesi DEĞİLDİR?', ['Yazı-tura', 'Zarın kaç geldiği', 'Ürün kusurlu mu?'], 1, 'Zarın 6 sonucu var; Bernoulli’de yalnızca iki sonuç olur.'],
      ['Üç parada en az bir yazı olasılığı?', ['3/8', '7/8', '1/2'], 1, '1 − P(hiç yazı yok) = 1 − 1/8.'],
      ['%90 isabetli oyuncunun 4 atışta ortalama kaç atışı kaçar?', ['0,1', '0,4', '1'], 1, 'μ = np = 4 × 0,1.'],
      ['Saatte ortalama 6 çağrı. En olası çağrı sayısı yaklaşık?', ['1', '5–6', '12'], 1, 'Poisson’un tepesi λ civarındadır.'],
      ['10 dakikalık aralıkta λ kaç olur?', ['6', '1', '0,6'], 1, '6 × 10/60 = 1.']
    ],
    g12: [
      ['Saatte 2,5 hasta. Hiç hasta gelmeme olasılığı?', ['%8', '%25', '%50'], 0, 'e^(−2,5) = 0,0821.'],
      ['Torbadan yerine koymadan çekince olasılık…', ['Her çekilişte aynı', 'Her çekilişte değişir'], 1, 'Bu yüzden binom değil hipergeometrik.'],
      ['60 iktisat, 40 işletme; 4 kişi seçilince en olası iktisatçı sayısı?', ['1', '2', '4'], 1, 'Beklenen 4 × 0,6 = 2,4.'],
      ['Yerine koymadan seçim varyansı binomla kıyasla…', ['Daha büyük', 'Daha küçük'], 1, '(N − n)/(N − 1) çarpanı varyansı küçültür.'],
      ['20/400 kusurlu kolide 5 parçanın hepsinin sağlam çıkma olasılığı?', ['%23', '%77', '%95'], 1, 'Yaklaşık 0,7728; red olasılığı %23.'],
      ['n/N = 5/400 iken binom ile hipergeometrik…', ['Çok farklı', 'Neredeyse aynı'], 1, 'n/N ≤ 0,05: fark yalnızca 0,001.']
    ],
    g13: [
      ['Sürekli değişkende P(X = 5) kaçtır?', ['f(5)', '0', '1/∞ değil, 0,1'], 1, 'Tek bir noktanın altında alan yoktur.'],
      ['f(x) = kx, 0 ≤ x ≤ 2 için k?', ['1', '1/2', '2'], 1, 'Üçgen alanı 2k = 1.'],
      ['P(0,5 ≤ X ≤ 1,5) [0; 1] aralığından…', ['Küçük', 'Büyük', 'Eşit'], 1, 'Eğri yükseldikçe alan büyür: 0,5 ve 0,25.'],
      ['F(x) hangi değerle biter?', ['0', '1', 'f(2)'], 1, 'Toplam alan 1.'],
      ['f(x) = x/2’nin ortalaması 1’den…', ['Küçük', 'Büyük'], 1, 'Yoğunluk sağda yüksek: μ = 4/3.'],
      ['Y = 50 + 200X ise Var(Y) içinde 50 ne yapar?', ['Ekler', 'Hiçbir şey'], 1, 'Sabit eklemek yayılımı değiştirmez.']
    ],
    g14: [
      ['U(5, 10) dağılımında f(x) kaç?', ['0,1', '0,2', '0,5'], 1, '1/(10 − 5).'],
      ['P(6 ≤ X ≤ 8) kaç?', ['0,2', '0,4', '0,6'], 1, '2 × 0,2.'],
      ['U(3; 5,5) ortalaması?', ['4', '4,25', '4,5'], 1, '(3 + 5,5)/2.'],
      ['Ortalama 5 dk görüşmenin 7 dk’yı aşma olasılığı?', ['~%25', '~%50', '~%75'], 0, 'e^(−7/5) = 0,2466.'],
      ['10 dakikadır müşteri gelmedi. Sonraki 5 dk’da gelme olasılığı…', ['Arttı', 'Azaldı', 'Değişmedi'], 2, 'Üstel dağılım hafızasızdır.']
    ],
    g15: [
      ['σ büyüyünce eğri…', ['Daralır, sivrileşir', 'Yayılır, basıklaşır'], 1, 'Toplam alan hep 1 olduğu için yayılınca tepe alçalır.'],
      ['P(X < μ) kaçtır?', ['0,5', '0,68', '1'], 0, 'Simetri: iki yarı eşit.'],
      ['μ ± 2σ aralığı yaklaşık yüzde kaçı kapsar?', ['%68', '%95', '%99,7'], 1, '%95,4.'],
      ['μ = 500, σ = 10 için x = 515’in z’si?', ['1,5', '15', '0,15'], 0, '(515 − 500)/10.'],
      ['P(0 < Z < 1,25) yaklaşık?', ['0,39', '0,89', '0,11'], 0, 'Tablodan 0,3944.'],
      ['485 g’dan hafif paket oranı?', ['~%7', '~%25', '~%43'], 0, 'z = −1,5 → 0,0668.']
    ],
    b1: [
      ['Gölün pH’ını ölçmek için neden örneklem şart?', ['Ucuz olduğu için', 'Anakütle sonsuz/ölçülemez olduğu için'], 1, 'Gölün tamamını alamayız.'],
      ['200 kişilik temsili örneklemde kaç erkek beklenir (%70)?', ['70', '140', '200'], 1, '200 × 0,70.'],
      ['5 şehirden 2 şehirlik kaç örneklem var?', ['10', '20', '25'], 0, 'C(5, 2) = 10; her biri 0,10.'],
      ['Çerçevede 001–750 var. Tablodan 919 okunursa?', ['Seçilir', 'Atlanır'], 1, '750’den büyük numara çerçevede yok.'],
      ['N = 200, n = 20 sistematik örneklemde adım k?', ['5', '10', '20'], 1, 'k = N/n.'],
      ['AVM girişindeki ilk 50 kişiyle anket hangi yöntem?', ['Basit rastgele', 'Kolayda', 'Küme'], 1, 'Ulaşması kolay olanlar; olasılıksız yöntem.']
    ],
    b2: [
      ['2000 kişiden 750’si yoksulluk sınırında: p̂?', ['0,375', '0,75', '0,25'], 0, '750/2000.'],
      ['7 kişiden 2’li kaç farklı örneklem çekilir?', ['14', '21', '49'], 1, 'C(7, 2) = 21.'],
      ['Örneklem ortalamalarının ortalaması μ’ye göre…', ['Hep büyük', 'Tam eşit', 'Hep küçük'], 1, 'x̄ yansızdır: μ<sub>x̄</sub> = μ.'],
      ['Atışlar merkez etrafında ama dağınık: tahmin edici…', ['Yanlı', 'Yansız ama etkin değil'], 1, 'Ortalamada isabetli, ama varyansı büyük.'],
      ['U biçimli anakütleden n = 30’luk ortalamalar nasıl dağılır?', ['U biçimli', 'Çan biçimli', 'Düz'], 1, 'Merkezî limit teoremi.'],
      ['p = 0,10, n = 20 iken p̂’nin dağılımı…', ['Simetrik', 'Sağa çarpık'], 1, 'np = 2 < 5: normal yaklaşım zayıf.']
    ],
    b3: [
      ['%95 güven için z kaç?', ['1,645', '1,96', '2,576'], 1, 'Her kuyrukta %2,5.'],
      ['n = 100, σ = 0,6 ise standart hata?', ['0,6', '0,06', '0,006'], 1, '0,6/√100.'],
      ['σ bilinmezse z yerine hangi dağılım?', ['t', 'Ki-kare', 'F'], 0, 's kullanınca t dağılımı.'],
      ['sd = 8, %99 için t, 2,576’dan…', ['Küçük', 'Büyük'], 1, 't kalın kuyruklu: 3,355.'],
      ['p̂ = 0,375, n = 2000 için hata payı yaklaşık?', ['±0,02', '±0,2', '±0,002'], 0, '1,96 × 0,0108 = 0,0212.'],
      ['100 tane %95 aralığın kaçı μ’yü kaçırır?', ['~5', '~50', '0'], 0, 'Yaklaşık %5’i.']
    ],
    b4: [
      ['Mühendisin kanıtlamak istediği iddia nereye yazılır?', ['H₀', 'H₁'], 1, 'Eşitlik H₀’da, iddia H₁’de.'],
      ['Çapın 25 mm’den BÜYÜK olması sorunsa test…', ['Çift yönlü', 'Sağ kuyruk', 'Sol kuyruk'], 1, 'H₁: μ > 25.'],
      ['Masum birini mahkûm etmek hangi hata?', ['I. tür', 'II. tür'], 0, 'H₀ (masum) doğruyken reddedilmiş.'],
      ['α = 0,05 çift yönlü kritik değer?', ['±1,645', '±1,96', '±2,576'], 1, 'Her kuyrukta 0,025.'],
      ['Beş adımın sonuncusu?', ['α seçmek', 'Kararı bağlamda yorumlamak'], 1, 'Sayı değil, iş kararı.'],
      ['z = −1,33 için p (çift yönlü) 0,05’ten…', ['Küçük', 'Büyük'], 1, 'p = 0,1836 → H₀ reddedilmez.']
    ],
    b5: [
      ['σ bilinmiyor, n = 12: hangi test?', ['z', 't', 'ki-kare'], 1, 's ile standartlaştırınca t.'],
      ['x̄ = 460, μ₀ = 450, σ = 25, n = 40: z yaklaşık?', ['0,4', '2,5', '10'], 1, '10 / 3,953 = 2,53.'],
      ['448 g için z = −0,45. H₀ reddedilir mi (kritik −1,645)?', ['Evet', 'Hayır'], 1, '−0,45 > −1,645.'],
      ['t<sub>0,05; 11</sub> = 1,796; t = 2,31 ise?', ['H₀ red', 'H₀ reddedilmez'], 0, '2,31 > 1,796.'],
      ['Oran testinde standart hata hangi p ile?', ['p̂', 'p₀'], 1, 'H₀ altındaki p₀ ile.'],
      ['χ² = 22,75, kritik 23,685: karar?', ['H₀ red', 'H₀ reddedilmez'], 1, 'Sınırda ama kritik değerin altında.']
    ],
    b6: [
      ['62 ile 65 ortalamaları, 140 ve 120 öğrenci: fark anlamlı mı?', ['Evet', 'Hayır'], 0, 'z = −6,67; çok büyük örneklemde 3 puan çok fark.'],
      ['Havuzlanmış t için hangi varsayım gerekir?', ['Eşit varyans', 'Eşit ortalama'], 0, 'Varyanslar eşit varsayılınca birleştirilir.'],
      ['Varyanslar çok farklıysa hangi test?', ['Havuzlanmış t', 'Welch t'], 1, 'Havuzlama yapılmaz.'],
      ['Aynı kişiler önce ve sonra ölçülürse örneklemler…', ['Bağımsız', 'Bağımlı (eşleştirilmiş)'], 1, 'Farklar üzerinden tek örneklem gibi test edilir.'],
      ['%60 ile %65 kış lastiği oranı farkı anlamlı mı?', ['Evet', 'Hayır'], 1, 'z = −0,77 → H₀ reddedilmez.'],
      ['F testinde hangi varyans paya yazılır?', ['Küçük', 'Büyük'], 1, 'Böylece F ≥ 1 olur.']
    ],
    b7: [
      ['5 grubu ikişer karşılaştırmak kaç t testi ister?', ['5', '10', '25'], 1, 'C(5, 2) = 10.'],
      ['Hangi sopa en uzağa gönderiyor gibi?', ['Sopa 1', 'Sopa 2', 'Sopa 3'], 0, 'Ortalama 249,2 m.'],
      ['Değişkenliğin büyük kısmı nereden geliyor sence?', ['Sopalar arası', 'Atışlar arası'], 0, 'SSB = 4716,4; SSW = 1119,6.'],
      ['Grup içi serbestlik derecesi (15 gözlem, 3 grup)?', ['2', '12', '14'], 1, 'n − c = 12.'],
      ['F = 25,28, kritik 3,89: karar?', ['H₀ red', 'H₀ reddedilmez'], 0, 'En az bir sopanın ortalaması farklı.'],
      ['Varsayımlar bozulursa hangi test?', ['Kruskal–Wallis', 'Ki-kare uyum'], 0, 'Parametrik olmayan karşılığı.']
    ],
    b9: [
      ['Çalışma süresi arttıkça not…', ['Artıyor', 'Azalıyor', 'Değişmiyor'], 0, 'Pozitif ilişki.'],
      ['Sağ-üst bölgedeki noktanın çarpım katkısı?', ['Pozitif', 'Negatif'], 0, '(+)(+) = +.'],
      ['r’nin alabileceği değerler?', ['0 ile 1', '−1 ile 1', 'Her değer'], 1, 'Birimsizdir ve −1 ≤ r ≤ 1.'],
      ['r = 0,75 ise açıklanan oran?', ['%75', '%56,25', '%25'], 1, 'r² = 0,5625.'],
      ['t = r√(n − 2)/√(1 − r²) hangi dağılıma uyar?', ['z', 't (sd = n − 2)'], 1, 'n − 2 serbestlik dereceli t.'],
      ['Dondurma–boğulma ilişkisinin nedeni?', ['Dondurma', 'Sıcak hava'], 1, 'Karıştırıcı değişken.']
    ],
    b10: [
      ['Elektrik tüketimi modelinde bağımlı değişken?', ['Ev büyüklüğü', 'Tüketim'], 1, 'Tahmin edilen y.'],
      ['Eğim yaklaşık?', ['~0,5', '~2', '~20'], 1, 'b = 1,987 kWh/m².'],
      ['120 m² için tahmin yaklaşık?', ['~240', '~301', '~400'], 1, 'ŷ = 62,95 + 1,987 × 120.'],
      ['r² = 0,99 ise model…', ['Çok iyi açıklıyor', 'Zayıf'], 0, 'Değişkenliğin %99’u açıklanıyor.'],
      ['Eğim testinde serbestlik derecesi (n = 10)?', ['9', '8', '10'], 1, 'n − 2.'],
      ['330 kWh için x yaklaşık?', ['~100', '~134', '~170'], 1, '(330 − 62,95)/1,987.']
    ],
    b11: [
      ['Veri sıralama ölçeğindeyse hangi tür test?', ['Parametrik', 'Parametrik olmayan'], 1, 'Varsayım istemez.'],
      ['20’de 15 başarı, p₀ = 0,5. p-değeri yaklaşık?', ['0,02', '0,20', '0,50'], 0, 'P(X ≥ 15) = 0,0207.'],
      ['İşaret testinde sıfır farklar ne olur?', ['+ sayılır', 'Atılır'], 1, 'n azalır.'],
      ['120 şikâyet 4 mevsime eşit dağılsa her mevsim?', ['25', '30', '40'], 1, 'E = 120/4.'],
      ['2 × 2 tabloda serbestlik derecesi?', ['1', '2', '4'], 0, '(2 − 1)(2 − 1).']
    ],
    b12: [
      ['10, 10, 10 üçüncü, dördüncü ve beşinci sırada; her biri hangi sırayı alır?', ['3', '4', '5'], 1, '(3 + 4 + 5)/3.'],
      ['A grubu hep alt sıralardaysa R₁…', ['Küçük', 'Büyük'], 0, 'Sıra toplamı uç değerde çıkar.'],
      ['10 çalışandan kaçında stres azaldı?', ['2', '5', '8'], 2, 'Yalnızca D ve I’da arttı.'],
      ['Golf verisinde Sopa 1’in tüm atışları en üst sıralarda mı?', ['Evet', 'Hayır'], 0, 'R₁ = 65 (11–15. sıralar).'],
      ['Jüriler aynı sırayı verse r<sub>s</sub>?', ['0', '1', '−1'], 1, 'Σd² = 0.']
    ],
    b13: [
      ['Süt 18 → 24 TL. İndeks?', ['124', '133,3', '75'], 1, '24/18 × 100.'],
      ['%33,3 ve %66,7 artış: toplam artış %100 mü?', ['Evet', 'Hayır, %122'], 1, 'Halkalar çarpılır: 1,333 × 1,667.'],
      ['Basit toplam indekste en çok hangi ürün etkili?', ['Ekmek', 'Peynir'], 1, 'En pahalı ürün toplamı domine eder.'],
      ['Laspeyres hangi miktarları kullanır?', ['Baz dönem', 'Cari dönem'], 0, 'q₀.'],
      ['Tüketiciler pahalı üründen kaçınca hangisi küçük?', ['Laspeyres', 'Paasche'], 1, 'Paasche ≤ Fisher ≤ Laspeyres.'],
      ['Maaş 3.000 → 6.000, fiyatlar 2,22 katı. Alım gücü?', ['Arttı', 'Azaldı'], 1, 'Reel maaş 2.700 TL.']
    ],
    b14: [
      ['Olasılıklar biliniyorsa karar ortamı…', ['Belirsizlik', 'Risk'], 1, 'Risk altında EMV kullanılır.'],
      ['İyimser karar verici hangi firmayı seçer?', ['Firma 1', 'Firma 2', 'Firma 3'], 1, 'En iyi sonuç 19.000.'],
      ['Firma 1’in en büyük pişmanlığı?', ['0', '1.500', '1.960'], 1, '19.000 − 17.500.'],
      ['α = 1 olursa Hurwicz neye dönüşür?', ['Maximin', 'Maximax'], 1, 'Yalnızca en iyi sonuca bakılır.'],
      ['P(uzun) = 0,4 iken en yüksek EMV hangi firmada?', ['Firma 1', 'Firma 2', 'Firma 3'], 1, '16.416 TL.'],
      ['Karar ağacı hangi yönden çözülür?', ['Soldan sağa', 'Sağdan sola'], 1, 'Önce şans düğümlerinin EMV’si.']
    ]
  };
})();
