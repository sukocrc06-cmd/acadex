/* ==========================================================================
   ACADEX İSTATİSTİK · ders planı, terimler, formül kartları (labs/istatistik/is-terim.js), 03.11.2026
   Kaynak: AYBÜ Uluslararası Ticaret ve İşletmecilik (İng) BUS201 Statistics for Business I ve
   BUS202 Statistics for Business II ders bilgi paketleri (haftalık konular). Ders İngilizce
   okutulduğu için her terim Türkçe + İngilizce verilir (Anderson–Sweeney–Williams, Newbold,
   Barrow kitaplarındaki adlarla).
     WEEKS : 28 hafta (iki ders × 14; 9. hafta vize), her hafta hangi istasyonda çalışılır
     EN    : istasyonların İngilizce adı
     GLOSS : istasyon başına terim sözlüğü [tr, en, kısa açıklama]
     SHEET : formül kartı satırları [ad, formül, Excel, R]
   ========================================================================== */
(function () {
  'use strict';
  var IS = window.FN.is = window.FN.is || {};
  IS.WEEKS = [
    { c: 'BUS201', w: 1, s: 'grafik', tr: 'İstatistiğin tanımı, temel kavramlar', en: 'Definition of statistics, basic concepts' },
    { c: 'BUS201', w: 2, s: 'grafik', tr: 'Veri türleri ve kaynakları', en: 'Types and sources of data' },
    { c: 'BUS201', w: 3, s: 'grafik', tr: 'Veri sunumu: tablolar (Excel)', en: 'Tabular presentation of data' },
    { c: 'BUS201', w: 4, s: 'grafik', tr: 'Veri sunumu: grafikler (Excel)', en: 'Graphical presentation of data' },
    { c: 'BUS201', w: 5, s: 'betimsel', tr: 'Betimsel istatistik: sayısal ölçüler', en: 'Descriptive statistics: numerical measures' },
    { c: 'BUS201', w: 6, s: 'grafik', tr: 'Aritmetik, geometrik, kareli ve harmonik ortalama', en: 'Arithmetic, geometric, quadratic and harmonic mean' },
    { c: 'BUS201', w: 7, s: 'betimsel', tr: 'Mod, medyan, kantiller', en: 'Mode, median, quantiles' },
    { c: 'BUS201', w: 8, s: 'betimsel', tr: 'Dağılım ölçüleri: çarpıklık, basıklık', en: 'Shape: skewness, kurtosis' },
    { c: 'BUS201', w: 9, exam: 'b201v', tr: 'Vize', en: 'Midterm exam' },
    { c: 'BUS201', w: 10, s: 'indeks', tr: 'Oranlar ve indeksler', en: 'Ratios and index numbers' },
    { c: 'BUS201', w: 11, s: 'dagilim', tr: 'Kesikli olasılık dağılımları', en: 'Discrete probability distributions' },
    { c: 'BUS201', w: 12, s: 'dagilim', tr: 'Sürekli olasılık dağılımları', en: 'Continuous probability distributions' },
    { c: 'BUS201', w: 13, s: 'galton', tr: 'Örnekleme ve örnekleme dağılımları', en: 'Sampling and sampling distributions' },
    { c: 'BUS201', w: 14, s: 'guven', tr: 'Aralık tahmini ve hipotez testlerine giriş', en: 'Interval estimation and hypothesis tests' },
    { c: 'BUS202', w: 1, s: 'olasilik', tr: 'Temel kavramlar, olasılık tekrarı', en: 'Basic concepts, probability review' },
    { c: 'BUS202', w: 2, s: 'kikare', tr: 'Ki-kare dağılımı', en: 'Chi-square distribution' },
    { c: 'BUS202', w: 3, s: 'ikili', tr: 'Tahmin: iki anakütlenin karşılaştırılması', en: 'Estimation: comparing two populations' },
    { c: 'BUS202', w: 4, s: 'hipotez', tr: 'Hipotez testi: tek anakütle', en: 'Hypothesis testing: one population' },
    { c: 'BUS202', w: 5, s: 'ikili', tr: 'Hipotez testi: iki anakütle', en: 'Hypothesis testing: two populations' },
    { c: 'BUS202', w: 6, s: 'hipotez', tr: 'İstatistiksel çıkarım, hata türleri ve güç', en: 'Statistical inference, errors and power' },
    { c: 'BUS202', w: 7, s: 'kikare', tr: 'Varyans analizi', en: 'Analysis of variance (ANOVA)' },
    { c: 'BUS202', w: 8, s: 'bolum', tr: 'Bilgisayar uygulamaları: Excel ve R ile vakalar', en: 'Computer applications' },
    { c: 'BUS202', w: 9, exam: 'b202v', tr: 'Vize', en: 'Midterm exam' },
    { c: 'BUS202', w: 10, s: 'regresyon', tr: 'Korelasyon', en: 'Correlation' },
    { c: 'BUS202', w: 11, s: 'coklu', tr: 'Doğrusal regresyon: eğim için çıkarım', en: 'Simple linear regression: inference on the slope' },
    { c: 'BUS202', w: 12, s: 'coklu', tr: 'Çoklu regresyon', en: 'Multiple regression' },
    { c: 'BUS202', w: 13, s: 'coklu', tr: 'Zaman serisi analizi ve öngörü', en: 'Time series analysis and forecasting' },
    { c: 'BUS202', w: 14, s: 'ikili', tr: 'Parametrik olmayan istatistik', en: 'Nonparametric statistics' }
  ];
  /* sınav provaları: kapsadığı istasyonlar */
  IS.EXAMS = {
    b201v: { t: 'BUS201 vize provası', s: ['grafik', 'betimsel'] },
    b201f: { t: 'BUS201 final provası', s: ['grafik', 'betimsel', 'indeks', 'dagilim', 'galton', 'guven'] },
    b202v: { t: 'BUS202 vize provası', s: ['olasilik', 'kikare', 'ikili', 'hipotez'] },
    b202f: { t: 'BUS202 final provası', s: ['kikare', 'ikili', 'hipotez', 'regresyon', 'coklu'] }
  };
  IS.EN = { yol: 'Learning path', grafik: 'Data and graphs', betimsel: 'Descriptive statistics', indeks: 'Ratios and index numbers', olasilik: 'Probability', dagilim: 'Probability distributions', galton: 'Sampling distributions and the CLT', guven: 'Confidence intervals', hipotez: 'Hypothesis testing', ikili: 'Two populations and nonparametric tests', kikare: 'Chi-square tests and ANOVA', regresyon: 'Correlation and regression', coklu: 'Multiple regression and forecasting', bolum: 'Applications by department' };
  IS.GLOSS = {
    grafik: [['değişken', 'variable', 'gözlemden gözleme değişen özellik'], ['nitel / nicel veri', 'qualitative / quantitative data', ''], ['sınıflayıcı ölçek', 'nominal scale', 'yalnız ad: cinsiyet, il'], ['sıralı ölçek', 'ordinal scale', 'sıra var, aralık anlamsız'], ['aralık ölçeği', 'interval scale', 'fark anlamlı, sıfır keyfî (°C)'], ['oran ölçeği', 'ratio scale', 'gerçek sıfır var (TL, kg)'], ['birincil / ikincil veri', 'primary / secondary data', 'kendin topladın / hazır kaynak'], ['frekans tablosu', 'frequency distribution', ''], ['pasta grafiği', 'pie chart', ''], ['sütun grafiği', 'bar chart', ''], ['birikimli frekans eğrisi', 'ogive', ''], ['dal-yaprak', 'stem-and-leaf display', ''], ['geometrik ortalama', 'geometric mean', 'büyüme oranlarında'], ['harmonik ortalama', 'harmonic mean', 'oranların ortalamasında (hız)'], ['kareli ortalama', 'quadratic mean (RMS)', '']],
    betimsel: [['ortalama', 'mean', ''], ['medyan', 'median', ''], ['mod', 'mode', ''], ['aralık', 'range', ''], ['varyans', 'variance', ''], ['standart sapma', 'standard deviation', ''], ['değişim katsayısı', 'coefficient of variation', ''], ['çeyrek', 'quartile', ''], ['yüzdelik', 'percentile', ''], ['çeyrekler açıklığı', 'interquartile range (IQR)', ''], ['kutu grafiği', 'box plot', ''], ['aykırı değer', 'outlier', ''], ['çarpıklık', 'skewness', ''], ['basıklık', 'kurtosis', '']],
    indeks: [['oran', 'ratio', ''], ['yüzde değişim', 'percentage change', ''], ['yüzde puan', 'percentage point', ''], ['basit endeks', 'simple index', ''], ['bileşik endeks', 'aggregate index', ''], ['ağırlıklı endeks', 'weighted index', ''], ['baz dönem', 'base period', ''], ['zincirleme endeks', 'chain index', ''], ['Laspeyres / Paasche', 'Laspeyres / Paasche index', ''], ['reel değer', 'real value (deflated)', ''], ['fiyat deflatörü', 'price deflator', ''], ['TÜFE', 'consumer price index (CPI)', '']],
    olasilik: [['deney', 'experiment', ''], ['örnek uzay', 'sample space', ''], ['olay', 'event', ''], ['koşullu olasılık', 'conditional probability', ''], ['bağımsız olaylar', 'independent events', ''], ['ayrık olaylar', 'mutually exclusive events', ''], ['Bayes teoremi', "Bayes' theorem", ''], ['kombinasyon / permütasyon', 'combination / permutation', ''], ['büyük sayılar yasası', 'law of large numbers', '']],
    dagilim: [['rastlantı değişkeni', 'random variable', ''], ['beklenen değer', 'expected value', ''], ['olasılık fonksiyonu', 'probability (mass) function', ''], ['yoğunluk fonksiyonu', 'probability density function', ''], ['birikimli dağılım', 'cumulative distribution', ''], ['binom', 'binomial', ''], ['Poisson', 'Poisson', ''], ['normal / standart normal', 'normal / standard normal', ''], ['z puanı', 'z-score', ''], ['serbestlik derecesi', 'degrees of freedom', '']],
    galton: [['ana kütle', 'population', ''], ['örneklem', 'sample', ''], ['parametre / istatistik', 'parameter / statistic', ''], ['örnekleme dağılımı', 'sampling distribution', ''], ['standart hata', 'standard error', ''], ['merkezî limit teoremi', 'central limit theorem', ''], ['basit rastgele örneklem', 'simple random sample', '']],
    guven: [['nokta tahmini', 'point estimate', ''], ['güven aralığı', 'confidence interval', ''], ['güven düzeyi', 'confidence level', ''], ['hata payı', 'margin of error', ''], ['kritik değer', 'critical value', ''], ['örneklem büyüklüğü', 'sample size', '']],
    hipotez: [['sıfır hipotezi', 'null hypothesis (H₀)', ''], ['alternatif hipotez', 'alternative hypothesis (H₁)', ''], ['anlamlılık düzeyi', 'level of significance (α)', ''], ['test istatistiği', 'test statistic', ''], ['p-değeri', 'p-value', ''], ['ret bölgesi', 'rejection region', ''], ['tek / çift yönlü', 'one-tailed / two-tailed', ''], ['I. tip hata', 'Type I error', ''], ['II. tip hata', 'Type II error', ''], ['testin gücü', 'power of the test', '']],
    ikili: [['bağımsız örneklemler', 'independent samples', ''], ['eşleştirilmiş örneklemler', 'matched (paired) samples', ''], ['ortak varyans', 'pooled variance', ''], ['Welch testi', "Welch's t test", ''], ['iki oran farkı', 'difference of two proportions', ''], ['parametrik olmayan', 'nonparametric', ''], ['sıra', 'rank', ''], ['işaret testi', 'sign test', ''], ['Wilcoxon işaretli sıralar', 'Wilcoxon signed-rank test', ''], ['Mann-Whitney U', 'Mann-Whitney U (Wilcoxon rank-sum)', ''], ['Spearman sıra korelasyonu', "Spearman's rank correlation", ''], ['Kruskal-Wallis', 'Kruskal-Wallis test', '']],
    kikare: [['gözlenen frekans', 'observed frequency', ''], ['beklenen frekans', 'expected frequency', ''], ['uyum iyiliği', 'goodness of fit', ''], ['bağımsızlık testi', 'test of independence', ''], ['çapraz tablo', 'contingency table', ''], ['varyans analizi', 'analysis of variance', ''], ['kareler toplamı', 'sum of squares', ''], ['kareler ortalaması', 'mean square', ''], ['F oranı', 'F ratio', '']],
    regresyon: [['serpilme diyagramı', 'scatter diagram', ''], ['korelasyon katsayısı', 'correlation coefficient', ''], ['bağımlı / bağımsız değişken', 'dependent / independent variable', ''], ['en küçük kareler', 'least squares', ''], ['eğim / kesişim', 'slope / intercept', ''], ['kalıntı', 'residual', ''], ['belirlilik katsayısı', 'coefficient of determination (R²)', '']],
    coklu: [['eğimin standart hatası', 'standard error of the slope', ''], ['çoklu regresyon', 'multiple regression', ''], ['düzeltilmiş R²', 'adjusted R²', ''], ['çoklu doğrusallık', 'multicollinearity', ''], ['zaman serisi', 'time series', ''], ['trend / mevsimsellik', 'trend / seasonality', ''], ['üstel düzeltme', 'exponential smoothing', ''], ['hareketli ortalama', 'moving average', ''], ['öngörü hatası', 'forecast error', ''], ['ortalama mutlak sapma', 'mean absolute deviation (MAD)', ''], ['ortalama mutlak yüzde hata', 'mean absolute percentage error (MAPE)', '']],
    bolum: [['fiyat endeksi', 'price index', ''], ['kontrol kartı', 'control chart', ''], ['tabakalı örnekleme', 'stratified sampling', ''], ['küme örneklemesi', 'cluster sampling', ''], ['duyarlılık / özgüllük', 'sensitivity / specificity', ''], ['ROC eğrisi', 'ROC curve', '']]
  };
  IS.SHEET = {
    grafik: [['aritmetik ortalama (mean)', 'x̄ = Σx / n', '=ORTALAMA(A:A)', 'mean(x)'], ['geometrik ortalama', 'G = (x₁·x₂·…·xₙ)^(1/n)', '=GEOORT(A:A)', 'exp(mean(log(x)))'], ['harmonik ortalama', 'H = n / Σ(1/x)', '=HARORT(A:A)', '1/mean(1/x)'], ['kareli ortalama (RMS)', 'Q = √(Σx² / n)', '=KAREKÖK(TOPKARE(A:A)/SAY(A:A))', 'sqrt(mean(x^2))'], ['sıralama', 'H ≤ G ≤ x̄ ≤ Q', '', ''], ['büyüme oranlarının ortalaması', 'ḡ = G(1 + rᵢ) − 1', '', '']],
    betimsel: [['örneklem varyansı', 's² = Σ(x − x̄)² / (n − 1)', '=VAR.S(A:A)', 'var(x)'], ['standart sapma', 's = √s²', '=STDSAPMA.S(A:A)', 'sd(x)'], ['değişim katsayısı', 'DK = s / x̄ · 100', '', 'sd(x)/mean(x)*100'], ['p. yüzdelik konumu', 'L = (n − 1)·p + 1', '=YÜZDEBİRLİK.DHL(A:A;0,9)', 'quantile(x, .9)'], ['IQR', 'Q₃ − Q₁', '', 'IQR(x)'], ['aykırı sınırları', 'Q₁ − 1,5·IQR ; Q₃ + 1,5·IQR', '', ''], ['z puanı', 'z = (x − x̄) / s', '=STANDARTLAŞTIRMA(x;ort;s)', 'scale(x)'], ['çarpıklık / basıklık', 'g₁ ≈ Σz³ / n ;  g₂ ≈ Σz⁴ / n − 3', '=ÇARPIKLIK(A:A) ; =BASIKLIK(A:A)', 'e1071::skewness(x)']],
    indeks: [['yüzde değişim', '(yeni − eski) / eski · 100', '', ''], ['basit endeks', 'Iₜ = pₜ / p₀ · 100', '', ''], ['zincirleme endeks', 'Cₜ = pₜ / pₜ₋₁ · 100', '', ''], ['basit bileşik endeks', 'Σpₜ / Σp₀ · 100', '', ''], ['Laspeyres', 'Σpₜq₀ / Σp₀q₀ · 100', '=TOPLA.ÇARPIM(C:C;B:B)/TOPLA.ÇARPIM(A:A;B:B)*100', 'sum(pt*q0)/sum(p0*q0)*100'], ['Paasche', 'Σpₜqₜ / Σp₀qₜ · 100', '', 'sum(pt*qt)/sum(p0*qt)*100'], ['Fisher', '√(L · P)', '', ''], ['reel değer', 'nominal / fiyat endeksi · 100', '', '']],
    olasilik: [['toplama kuralı', 'P(A ∪ B) = P(A) + P(B) − P(A ∩ B)', '', ''], ['koşullu olasılık', 'P(A | B) = P(A ∩ B) / P(B)', '', ''], ['çarpma kuralı', 'P(A ∩ B) = P(A)·P(B | A)', '', ''], ['Bayes', 'P(A | B) = P(B | A)·P(A) / P(B)', '', ''], ['kombinasyon', 'C(n,k) = n! / (k!(n − k)!)', '=KOMBİNASYON(n;k)', 'choose(n,k)'], ['permütasyon', 'P(n,k) = n! / (n − k)!', '=PERMÜTASYON(n;k)', 'factorial(n)/factorial(n-k)']],
    dagilim: [['binom', 'P(X=k) = C(n,k)pᵏ(1−p)ⁿ⁻ᵏ ; E = np ; Var = np(1−p)', '=BİNOM.DAĞ(k;n;p;YANLIŞ)', 'dbinom(k,n,p)'], ['Poisson', 'P(X=k) = e^(−λ)λᵏ / k! ; E = Var = λ', '=POISSON.DAĞ(k;λ;YANLIŞ)', 'dpois(k,λ)'], ['z dönüşümü', 'z = (x − μ) / σ', '=NORM.S.DAĞ(z;DOĞRU)', 'pnorm(z)'], ['normal ters', 'x = μ + z·σ', '=NORM.TERS(p;μ;σ)', 'qnorm(p,μ,σ)'], ['68–95–99,7', 'μ ± σ, 2σ, 3σ', '', '']],
    galton: [['ortalamanın standart hatası', 'σx̄ = σ / √n', '', 'sd(x)/sqrt(length(x))'], ['oranın standart hatası', 'σp̂ = √(p(1−p)/n)', '', ''], ['MLT', 'x̄ ≈ N(μ, σ²/n), n ≥ 30', '', '']],
    guven: [['σ biliniyor', 'x̄ ± z·σ/√n', '=GÜVENİLİRLİK.NORM(α;σ;n)', ''], ['σ bilinmiyor', 'x̄ ± t(n−1)·s/√n', '=GÜVENİLİRLİK.T(α;s;n)', 't.test(x)$conf.int'], ['oran', 'p̂ ± z·√(p̂(1−p̂)/n)', '', 'prop.test(x,n)'], ['gerekli n (ortalama)', 'n = (z·σ / E)²', '', ''], ['gerekli n (oran)', 'n = z²·p(1−p) / E²', '', '']],
    hipotez: [['tek örneklem t', 't = (x̄ − μ₀) / (s/√n), sd = n − 1', '=T.DAĞ(t;sd;DOĞRU)', 't.test(x, mu=μ0)'], ['oran z', 'z = (p̂ − p₀) / √(p₀(1−p₀)/n)', '=1-NORM.S.DAĞ(z;DOĞRU)', 'prop.test(x,n,p=p0)'], ['karar', 'p < α → H₀ reddedilir', '', ''], ['güç', '1 − β', '', 'power.t.test(...)']],
    ikili: [['ortak varyans', 'sₚ² = ((n₁−1)s₁² + (n₂−1)s₂²) / (n₁+n₂−2)', '', ''], ['iki ortalama t', 't = (x̄₁ − x̄₂) / (sₚ√(1/n₁ + 1/n₂))', '=T.TEST(A:A;B:B;2;2)', 't.test(a,b,var.equal=TRUE)'], ['fark için aralık', '(x̄₁ − x̄₂) ± t·SH', '', ''], ['eşleştirilmiş t', 't = d̄ / (s_d/√n)', '=T.TEST(A:A;B:B;2;1)', 't.test(a,b,paired=TRUE)'], ['iki oran z', 'z = (p̂₁ − p̂₂) / √(p̄(1−p̄)(1/n₁+1/n₂))', '', 'prop.test(c(x1,x2),c(n1,n2))'], ['Mann-Whitney', 'U = R₁ − n₁(n₁+1)/2', '=SIRA.ORT(x;aralık;1)', 'wilcox.test(a,b)'], ['Spearman', 'rₛ = 1 − 6Σd² / (n(n²−1))', '', 'cor(x,y,method="spearman")'], ['Kruskal-Wallis', 'H = 12/(N(N+1)) Σ Rⱼ²/nⱼ − 3(N+1)', '', 'kruskal.test(y~g)']],
    kikare: [['ki-kare', 'χ² = Σ (G − B)² / B', '=KİKARE.TEST(G;B)', 'chisq.test(tablo)'], ['beklenen', 'B = satır top. · sütun top. / N', '', ''], ['sd (bağımsızlık)', '(r − 1)(c − 1)', '', ''], ['ANOVA', 'F = KO_arası / KO_içi', '=F.DAĞ.SAĞK(F;k−1;N−k)', 'summary(aov(y~g))']],
    regresyon: [['eğim', 'b₁ = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)²', '=EĞİM(y;x)', 'coef(lm(y~x))'], ['kesişim', 'b₀ = ȳ − b₁x̄', '=KESMENOKTASI(y;x)', ''], ['korelasyon', 'r = Sxy / √(Sxx·Syy)', '=KORELASYON(x;y)', 'cor(x,y)'], ['R²', '1 − KT_hata / KT_toplam', '=RKARE(y;x)', 'summary(m)$r.squared']],
    coklu: [['tahminin standart hatası', 's = √(KT_hata / (n − k − 1))', '', 'sigma(m)'], ['eğimin standart hatası', 'SH(b₁) = s / √Sxx', '', ''], ['eğim testi', 't = b₁ / SH(b₁), sd = n − 2', '', 'summary(m)'], ['düzeltilmiş R²', '1 − (1 − R²)(n − 1)/(n − k − 1)', '', ''], ['F testi', 'F = (KT_reg/k) / (KT_hata/(n−k−1))', '', ''], ['üstel düzeltme', 'Fₜ₊₁ = αyₜ + (1 − α)Fₜ', '', 'HoltWinters(x, beta=FALSE, gamma=FALSE)'], ['MAD / MAPE', 'Σ|e| / n ; Σ|e/y| / n · 100', '', '']],
    bolum: [['x̄ kontrol sınırları', 'μ ± 3σ/√n', '', 'qcc::qcc(...)'], ['PPV', 'DP / (DP + YP)', '', ''], ['duyarlılık / özgüllük', 'DP/(DP+YN) ; DN/(DN+YP)', '', '']]
  };
})();
