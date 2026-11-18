/* ==========================================================================
   ACADEX İSTATİSTİK · klasik sınav sözel soru bankası (labs/istat/ist-klasik-banka.js), 18.11.2026
   Her hafta için:
     t:  boşluk doldurma / tanım  [cümle (boşluk ____), [kabul edilen cevaplar (Türkçe ve İngilizce)]]
     dy: doğru / yanlış            [ifade, doğru mu, açıklama]
   Ayrıca sahnelerdeki Türkçe–İngilizce terim çiftlerinden terim soruları üretilir (ist-klasik.js).
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST; if (!IST) return;
  IST.KLASIK = {
    g1: {
      t: [['Veri toplama, düzenleme, özetleme, analiz ve yorumlama bilimine ____ denir.', ['istatistik', 'statistics']],
        ['Bir veri setinde satırlar ____, sütunlar değişkenlerdir.', ['eleman', 'elemanlar', 'element', 'elements', 'birim', 'birimler']],
        ['Değerleri yalnızca etiket olan, aralarında sıra bulunmayan ölçeğe ____ ölçek denir.', ['sınıflama', 'nominal', 'sınıflayıcı']]],
      dy: [['Sıralama (ordinal) ölçeğinde iki değer arasındaki fark anlamlı olarak ölçülebilir.', false, 'Sıra vardır ama farklar ölçülemez; fark anlamlıysa en az aralık ölçeğidir.'],
        ['Oran ölçeğinde gerçek bir sıfır noktası vardır.', true, 'Ağırlık, gelir gibi; 0 “hiç yok” demektir ve oranlar anlamlıdır.'],
        ['Sıcaklık (°C) aralık ölçeğiyle ölçülür.', true, '0 °C “sıcaklık yok” demek değildir; sıfır keyfîdir.']]
    },
    g2: {
      t: [['İlgilenilen bütün elemanların oluşturduğu topluluğa ____ denir.', ['anakütle', 'ana kütle', 'evren', 'population']],
        ['Tek bir zamanda birçok elemandan toplanan veriye ____ verisi denir.', ['kesit', 'cross-sectional', 'cross sectional']],
        ['Sayılarak elde edilen, ara değer almayan nicel veriye ____ veri denir.', ['kesikli', 'discrete']]],
      dy: [['Örneklemden hesaplanan sayısal özete istatistik, anakütleninkine parametre denir.', true, 'x̄ bir istatistik, μ bir parametredir.'],
        ['Zaman serisi verisi, aynı anda birçok elemandan toplanan veridir.', false, 'Zaman serisi tek bir elemanın birçok dönemdeki değerleridir; tarif edilen kesit verisidir.'],
        ['Posta kodu sayılardan oluştuğu için nicel bir veridir.', false, 'Sayıyla yazılsa da yalnız etikettir; nitel (kategorik) veridir.']]
    },
    g3: {
      t: [['Bir sınıfın frekansının toplam gözlem sayısına oranına ____ frekans denir.', ['göreli', 'goreli', 'relative']],
        ['Araştırmacının kendi topladığı veriye ____ veri denir.', ['birincil', 'primary']],
        ['Bir sınıfa kadar olan bütün frekansların toplamına ____ frekans denir.', ['birikimli', 'kümülatif', 'cumulative']]],
      dy: [['Göreli frekansların toplamı 1’dir.', true, 'Her sınıf f/n; toplamları n/n = 1.'],
        ['İkincil veri, araştırmacının anketle kendisinin topladığı veridir.', false, 'Bu birincil veridir; ikincil veri hazır kaynaktan alınır.'],
        ['Son sınıfın birikimli frekansı toplam gözlem sayısına eşittir.', true, 'Bütün frekanslar toplanmış olur: F son = n.']]
    },
    g4: {
      t: [['Sürekli bir değişkenin sınıflarını bitişik sütunlarla gösteren grafiğe ____ denir.', ['histogram']],
        ['Pasta grafiğinde bir dilimin açısı, göreli frekans × ____ derece ile bulunur.', ['360']],
        ['Zaman içindeki değişimi göstermek için en uygun grafik ____ grafiğidir.', ['çizgi', 'cizgi', 'line', 'zaman serisi']]],
      dy: [['Histogramda sütunlar arasında boşluk bırakılır.', false, 'Sınıflar bitişik olduğundan histogram sütunları bitişiktir; boşluk sütun grafiğinde olur.'],
        ['Nitel bir değişken için sütun ya da pasta grafiği uygundur.', true, 'Kategoriler için bu iki grafik kullanılır.'],
        ['Frekans poligonu, sınıf orta noktalarındaki frekansları birleştiren çizgidir.', true, 'Histogramdaki sütun tepelerinin orta noktaları birleştirilir.']]
    },
    g5: {
      t: [['Bir veri setinde en sık tekrarlanan değere ____ denir.', ['mod', 'tepe değer', 'mode']],
        ['Sıralanmış verinin tam ortasındaki değere ____ denir.', ['medyan', 'ortanca', 'median']],
        ['İki ayrı tepe değeri olan dağılıma ____ dağılım denir.', ['iki modlu', 'bimodal', 'çift modlu']]],
      dy: [['Nominal veride kullanılabilen tek merkezî eğilim ölçüsü moddur.', true, 'Etiketlerin ortalaması ya da ortası anlamsızdır; yalnız en sık olan söylenebilir.'],
        ['Medyan, uç değerlerden aritmetik ortalamadan daha çok etkilenir.', false, 'Medyan yalnız sıraya bakar; uç değerlere karşı dirençlidir.'],
        ['n = 10 gözlemde medyan 5. ve 6. sıradaki değerlerin ortalamasıdır.', true, 'Konum (n + 1)/2 = 5,5.']]
    },
    g6: {
      t: [['Değerlerin önemleri farklıysa ____ ortalama kullanılır.', ['ağırlıklı', 'agirlikli', 'weighted']],
        ['Yıllık büyüme oranlarının ortalaması için ____ ortalama kullanılır.', ['geometrik', 'geometric']],
        ['Aritmetik ortalamadan sapmaların toplamı her zaman ____’dır.', ['sıfır', 'sifir', '0', 'zero']]],
      dy: [['Aritmetik ortalama aykırı değerlerden etkilenmez.', false, 'Her değer toplama girdiği için uç değer ortalamayı çeker.'],
        ['Sağa çarpık bir dağılımda genellikle ortalama medyandan büyüktür.', true, 'Uzun sağ kuyruk ortalamayı sağa çeker.'],
        ['Geometrik ortalama, aritmetik ortalamadan büyük olamaz.', true, 'Pozitif değerler için G ≤ x̄; eşitlik ancak bütün değerler aynıysa.']]
    },
    g7: {
      t: [['Bir deneyin bütün olası sonuçlarının kümesine ____ denir.', ['örnek uzay', 'ornek uzay', 'sample space']],
        ['Birlikte gerçekleşemeyen olaylara ____ olaylar denir.', ['ayrık', 'ayrik', 'mutually exclusive', 'karşılıklı dışlayan']],
        ['B olduğu bilindiğinde A’nın olasılığına ____ olasılık denir ve P(A|B) ile gösterilir.', ['koşullu', 'kosullu', 'conditional']]],
      dy: [['Ayrık iki olay (olasılıkları pozitifse) aynı zamanda bağımsızdır.', false, 'Biri olunca öteki kesin olmaz: P(A|B) = 0 ≠ P(A); bağımlıdırlar.'],
        ['Bağımsız A ve B için P(A ∩ B) = P(A)·P(B) olur.', true, 'Bağımsızlığın tanımı budur.'],
        ['P(A|B) ile P(B|A) her zaman eşittir.', false, 'Paydaları farklıdır: P(A∩B)/P(B) ile P(A∩B)/P(A). Bayes ikisini bağlar.']]
    },
    g9: {
      t: [['En büyük değer ile en küçük değer arasındaki farka ____ denir.', ['açıklık', 'aciklik', 'range', 'değişim aralığı']],
        ['Varyansın kareköküne ____ denir.', ['standart sapma', 'standard deviation']],
        ['Q3 − Q1 farkına ____ denir.', ['çeyrekler arası açıklık', 'ceyrekler arasi aciklik', 'iqr', 'interquartile range']]],
      dy: [['Örneklem varyansında kareler toplamı n − 1’e bölünür.', true, 'Serbestlik derecesi n − 1; x̄ verinin kendisinden hesaplandığı için.'],
        ['Açıklık, aykırı değerlerden etkilenmez.', false, 'Yalnız iki uç değere bakar; aykırı değere en duyarlı ölçüdür.'],
        ['Standart sapma negatif olabilir.', false, 'Kareköktür; en az 0’dır.']]
    },
    g10: {
      t: [['Bir deneyin her sonucuna bir sayı atayan fonksiyona ____ denir.', ['rastgele değişken', 'rastgele degisken', 'random variable', 'tesadüfi değişken']],
        ['Kesikli bir rastgele değişkenin olasılıkları toplamı ____’dir.', ['1', 'bir', 'one']],
        ['Σx·P(x) ile bulunan değere ____ denir.', ['beklenen değer', 'beklenen deger', 'expected value', 'ortalama']]],
      dy: [['Bir olasılık fonksiyonunda P(x) negatif olabilir.', false, 'Her P(x) 0 ile 1 arasındadır.'],
        ['Beklenen değer, rastgele değişkenin alabileceği değerlerden biri olmak zorundadır.', false, 'Örneğin zarın beklenen değeri 3,5’tir; zar 3,5 gelmez.'],
        ['Var(X) = E(X²) − [E(X)]² eşitliği her zaman geçerlidir.', true, 'Varyansın kısa yol formülü.']]
    },
    g11: {
      t: [['Yalnız iki sonucu olan (başarı / başarısızlık) tek denemeye ____ denemesi denir.', ['bernoulli']],
        ['Binom dağılımının ortalaması ____ formülüyle bulunur.', ['np', 'n·p', 'n*p', 'n.p']],
        ['Poisson dağılımında ortalama ile ____ eşittir.', ['varyans', 'variance']]],
      dy: [['Binom deneyinde denemeler birbirinden bağımsızdır ve başarı olasılığı sabittir.', true, 'Binomun iki temel koşulu.'],
        ['Poisson dağılımı, sabit sayıda denemedeki başarı sayısını modeller.', false, 'Bu binomdur; Poisson bir aralıktaki olay sayısını modeller (deneme sayısı yok).'],
        ['“En az bir” olasılığı 1 − P(X = 0) ile bulunabilir.', true, '“En az bir”in tümleyeni “hiç”tir.']]
    },
    g12: {
      t: [['Yerine koymadan seçimde başarı sayısı ____ dağılıma uyar.', ['hipergeometrik', 'hypergeometric']],
        ['Hipergeometrik varyanstaki (N − n)/(N − 1) çarpanına ____ düzeltmesi denir.', ['sonlu anakütle', 'sonlu ana kütle', 'finite population']]],
      dy: [['Örneklem anakütleye göre çok küçükse hipergeometrik yerine binom yaklaşımı kullanılabilir.', true, 'n/N küçükse çekilişler neredeyse bağımsızdır.'],
        ['Hipergeometrik dağılımda başarı olasılığı her çekilişte sabittir.', false, 'Yerine koyma olmadığı için her çekilişten sonra değişir.']]
    },
    g13: {
      t: [['Sürekli bir rastgele değişkende olasılık, yoğunluk eğrisinin altındaki ____ ile bulunur.', ['alan', 'area']],
        ['Yoğunluk eğrisinin altındaki toplam alan ____’dir.', ['1', 'bir', 'one']]],
      dy: [['Sürekli bir rastgele değişken için P(X = a) = 0’dır.', true, 'Tek bir noktanın alanı yoktur.'],
        ['Olasılık yoğunluk fonksiyonu f(x) hiçbir zaman 1’den büyük olamaz.', false, 'f(x) bir olasılık değil yoğunluktur; dar aralıkta 1’i aşabilir (ör. U(0; 0,5) için f = 2).']]
    },
    g14: {
      t: [['[a, b] aralığında her değerin eşit yoğunlukta olduğu dağılıma ____ dağılım denir.', ['düzgün', 'duzgun', 'uniform', 'tekdüze']],
        ['Olaylar arası geçen süreyi modelleyen sürekli dağılıma ____ dağılım denir.', ['üstel', 'ustel', 'exponential']]],
      dy: [['Düzgün dağılımın ortalaması (a + b)/2’dir.', true, 'Aralığın tam ortası.'],
        ['Üstel dağılım sola çarpıktır.', false, 'Sağa çarpıktır; küçük süreler daha olasıdır.']]
    },
    g15: {
      t: [['Normal dağılımda ortalama ± 1 standart sapma aralığında verinin yaklaşık yüzde ____’i bulunur.', ['68', '%68', '68,26', '68.26']],
        ['Bir değerin ortalamadan kaç standart sapma uzak olduğunu gösteren değere ____ denir.', ['z puanı', 'z değeri', 'z skoru', 'z-score', 'z score', 'standart puan']]],
      dy: [['Normal dağılımda ortalama, medyan ve mod eşittir.', true, 'Simetrik ve tek tepelidir.'],
        ['Standart normal dağılımın ortalaması 1, standart sapması 0’dır.', false, 'Ortalama 0, standart sapma 1.']]
    },
    b1: {
      t: [['Anakütlenin her elemanının incelenmesine ____ denir.', ['sayım', 'tam sayım', 'census']],
        ['Anakütle alt gruplara bölünüp her gruptan örneklem alınmasına ____ örnekleme denir.', ['tabakalı', 'tabakali', 'stratified']]],
      dy: [['Sistematik örneklemede her k’ıncı eleman seçilir.', true, 'k = N/n adımıyla.'],
        ['Kolayda (convenience) örnekleme olasılığa dayalı bir yöntemdir.', false, 'Olasılığa dayalı değildir; seçilme olasılıkları bilinmez.']]
    },
    b2: {
      t: [['Örneklem ortalamasının standart sapmasına ____ denir.', ['standart hata', 'standard error']],
        ['Anakütle parametresini tek bir sayıyla tahmin etmeye ____ tahmini denir.', ['nokta', 'point']]],
      dy: [['Örneklem büyüdükçe standart hata küçülür.', true, 'σ/√n; n arttıkça payda büyür.'],
        ['Merkezî limit teoremi, anakütle normal değilse geçerli değildir.', false, 'Tam tersine, n yeterince büyükse (genelde ≥ 30) x̄ yaklaşık normal olur.']]
    },
    b3: {
      t: [['%95 güven düzeyinde iki yönlü kritik z değeri ____’dır.', ['1,96', '1.96']],
        ['Güven aralığının yarı genişliğine ____ denir.', ['hata payı', 'margin of error']]],
      dy: [['Güven düzeyi artarsa (diğerleri sabitken) güven aralığı daralır.', false, 'Kritik değer büyür, aralık genişler.'],
        ['σ bilinmiyor ve örneklem küçükse t dağılımı kullanılır.', true, 's ile tahmin edilen belirsizlik t’nin kalın kuyruklarıyla karşılanır.']]
    },
    b4: {
      t: [['Doğru olan H₀’ı reddetmeye ____ tür hata denir.', ['1', 'I', 'birinci', 'type i', 'tip 1', '1.']],
        ['Yanlış olan H₀’ı reddetmemeye ____ tür hata denir.', ['2', 'II', 'ikinci', 'type ii', 'tip 2', '2.']]],
      dy: [['p-değeri anlamlılık düzeyi α’dan küçükse H₀ reddedilir.', true, 'Gözlenen sonuç H₀ altında yeterince olağandışı.'],
        ['“H₀ reddedilmedi” sonucu H₀’ın doğru olduğunu kanıtlar.', false, 'Yalnız aleyhine yeterli kanıt bulunamadığını gösterir.']]
    },
    b5: {
      t: [['σ bilinmeyen tek örneklem ortalama testinde serbestlik derecesi ____’dir.', ['n − 1', 'n-1', 'n - 1', 'n−1']],
        ['Anakütle varyansı hakkındaki testte kullanılan dağılım ____ dağılımıdır.', ['ki-kare', 'ki kare', 'kikare', 'chi-square', 'chi square', 'χ²']]],
      dy: [['Tek yönlü testte %5 anlamlılık için kritik z değeri 1,645’tir.', true, 'Bütün α tek kuyrukta.'],
        ['Oran testinde standart hata, örneklem oranı p̂ ile hesaplanır.', false, 'Testte H₀ altındaki p₀ kullanılır: √(p₀(1 − p₀)/n).']]
    },
    b6: {
      t: [['Aynı kişilerden önce/sonra alınan ölçümlere ____ örneklem denir.', ['eşleştirilmiş', 'eslestirilmis', 'bağımlı', 'paired', 'matched']],
        ['Eşit varyans varsayımında iki örneklemin varyansları birleştirilerek ____ varyans bulunur.', ['havuzlanmış', 'havuzlanmis', 'birleştirilmiş', 'pooled']]],
      dy: [['Eşleştirilmiş t testinde farkların ortalaması test edilir.', true, 'Her çift için d = önce − sonra.'],
        ['Bağımsız iki örneklem t testinde serbestlik derecesi (eşit varyans) n₁ + n₂ − 1’dir.', false, 'n₁ + n₂ − 2.']]
    },
    b7: {
      t: [['Üç ya da daha fazla grubun ortalamasını karşılaştıran yönteme ____ denir.', ['varyans analizi', 'anova']],
        ['ANOVA’da F oranı, gruplar arası kareler ortalamasının ____ kareler ortalamasına oranıdır.', ['grup içi', 'grupiçi', 'within', 'hata']]],
      dy: [['Üç grubu ikişer ikişer t testleriyle karşılaştırmak birinci tür hata riskini artırır.', true, 'Aile hata oranı büyür; ANOVA bu yüzden kullanılır.'],
        ['F oranı negatif olabilir.', false, 'Kareler ortalamalarının oranıdır; en az 0.']]
    },
    b9: {
      t: [['Pearson korelasyon katsayısı r, ____ ile +1 arasında değer alır.', ['-1', '−1', 'eksi bir', 'eksi 1']],
        ['r²’ye ____ katsayısı denir.', ['belirlilik', 'belirleme', 'determination']]],
      dy: [['r = 0 ise iki değişken arasında hiçbir ilişki yoktur.', false, 'Yalnız doğrusal ilişki yoktur; eğrisel bir ilişki olabilir.'],
        ['Yüksek korelasyon nedensellik kanıtlar.', false, 'Korelasyon nedensellik değildir; üçüncü bir değişken etkili olabilir.']]
    },
    b10: {
      t: [['ŷ = a + bx denkleminde b’ye ____ denir.', ['eğim', 'egim', 'slope', 'regresyon katsayısı']],
        ['Gözlenen y ile tahmin edilen ŷ arasındaki farka ____ denir.', ['artık', 'artik', 'kalıntı', 'hata', 'residual']]],
      dy: [['En küçük kareler yöntemi artıkların karelerinin toplamını en küçük yapar.', true, 'Yöntemin adı buradan gelir.'],
        ['Regresyon doğrusu her zaman (x̄, ȳ) noktasından geçer.', true, 'a = ȳ − b·x̄ olduğu için.']]
    },
    b11: {
      t: [['Anakütle dağılımı hakkında varsayım gerektirmeyen testlere ____ testler denir.', ['parametrik olmayan', 'nonparametrik', 'non-parametric', 'nonparametric', 'dağılımdan bağımsız']],
        ['Ki-kare uyum iyiliği testinde serbestlik derecesi ____’dir (k: kategori sayısı).', ['k − 1', 'k-1', 'k - 1', 'k−1']]],
      dy: [['Ki-kare testinde beklenen frekansların her biri genellikle en az 5 olmalıdır.', true, 'Aksi hâlde yaklaşım güvenilmez; kategoriler birleştirilir.'],
        ['Ki-kare istatistiği negatif olabilir.', false, 'Kareler toplamıdır; en az 0.']]
    },
    b12: {
      t: [['Bağımsız iki örneklemin sıralarına dayalı teste ____ testi denir.', ['mann–whitney u', 'mann-whitney u', 'mann whitney u', 'mann-whitney', 'wilcoxon sıra toplamı', 'wilcoxon rank sum']],
        ['Üç ya da daha fazla bağımsız grubun sıralarla karşılaştırılmasına ____ testi denir.', ['kruskal–wallis', 'kruskal-wallis', 'kruskal wallis']]],
      dy: [['Sıra testlerinde eşit değerlere (ties) ortalama sıra verilir.', true, 'Ör. 4. ve 5. sıradaki iki eşit değere 4,5.'],
        ['Spearman sıra korelasyonu yalnız doğrusal ilişkileri ölçer.', false, 'Monoton ilişkileri ölçer; doğrusal olması gerekmez.']]
    },
    b13: {
      t: [['Karşılaştırma için 100 kabul edilen döneme ____ dönem denir.', ['baz', 'temel', 'base']],
        ['Ağırlık olarak baz dönem miktarlarını kullanan indekse ____ indeksi denir.', ['laspeyres']]],
      dy: [['Paasche indeksi ağırlık olarak cari dönem miktarlarını kullanır.', true, 'Σpₜqₜ / Σp₀qₜ.'],
        ['Fisher indeksi, Laspeyres ve Paasche indekslerinin aritmetik ortalamasıdır.', false, 'Geometrik ortalamasıdır: √(L·P).']]
    },
    b14: {
      t: [['Her seçeneğin en kötü getirisine bakıp bunların en iyisini seçen kurala ____ denir.', ['maximin', 'maksimin', 'karamsar', 'wald']],
        ['Mükemmel bilginin beklenen değerinin kısaltması ____’dir.', ['evpi']]],
      dy: [['Maximax kuralı iyimser karar vericinin kuralıdır.', true, 'Her seçeneğin en iyisine bakıp en büyüğünü seçer.'],
        ['EVPI negatif olabilir.', false, 'Mükemmel bilgi en az bilgisiz durum kadar iyidir; EVPI ≥ 0.']]
    }
  };
})();
