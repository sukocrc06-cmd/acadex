# Sınav Platformu — Faz 4c: dosyadaki grafik sorularına göre sınav

Kullanıcı grafikli soru içeren bir dosya yüklediğinde, sınav bu örnek sorulardan yola çıkarak kurulabiliyor:

- **Grafik:** aynı türde, aynı kategorilerle ve aynı birimle çiziliyor; sayılar farklı.
- **Soru:** aynı biçimde, yeni ve yorum bazlı.
- **Cevap anahtarı:** kodla hesaplanıyor; yapay zekâ cevap uydurmuyor.

## Akış

1. **Kurulum:** öğrenci "dosyadaki grafik sorularına göre" kutusunu işaretler. Kutu yalnızca kaynak "belgem" olduğunda görünür.
2. **Tarama:** `extract-chart-items` belge başına **bir kez** çalışır. Daha önce bitmiş bir tarama varsa hemen döner.
   - **PDF:**
     - Aday sayfalar seçilir: en çok 8 sayfa. Ölçüt, sayfa metninde grafik ya da soru izi olmasıdır ("grafiğe göre", "hangileri", A) B) …). İz yoksa neredeyse boş sayfalar (görsel ağırlıklı) seçilir, o da yoksa ilk 3 sayfa.
     - Bu sayfalar PDF.co ile PNG'ye çevrilir.
   - **Görsel dosya:** tek sayfa olarak taranır.
   - **Sayfa sayfa okuma:** her istekte bir sayfa görsel modelle (`qwen/qwen3.8-27b`) okunur. Kaydedilen iki şey var:
     - Grafiğin **yapısı:** tür, kategoriler, seriler, değerler, birim, eksen başlıkları.
     - Yanındaki örnek sorunun **biçimi** ve sorduğu **beceriler.**
   - **İlerleme:** ön yüz adımları döngüyle ilerletir ve "Belgedeki grafikler taranıyor: 2/5 sayfa · 3 grafik" gibi gösterir.
   - **Hız sınırı:** Groq 429 verirse ön yüz bekleyip sürer (en çok 60 sn).
   - **Süresi dolmuş görsel:** tarama baştan başlar.
3. **Soru üretimi:** `generate-exam` `chartExamples: true` ile çağrılır. Sınav türü `mixed` olur. Taranmış grafiklerden kodla soru üretilir; model çağrısı yapılmaz.
   - **Grafik varyantı** (`chartVariant`):
     - Her değer en çok ±%22 değişir; ondalık hassasiyeti korunur.
     - Pasta grafikte toplam 100'de kalır.
     - Değerler birbirinden farklı tutulur, böylece "en yüksek" sorusu tek cevaplı olur.
   - **Desteklenen biçimler:**

     | Biçim | Örnek |
     |---|---|
     | `which_true` | Grafiğe göre hangisi söylenebilir? |
     | `which_false` | Hangisi söylenemez? |
     | `premises` | I / II / III, hangileri doğrudur? (şıklar standart sırada) |
     | `true_false` | Doğru/Yanlış |
     | `value` | Hesap; formülü ve doğrulanmış sonucuyla |
     | `open` | Yorum; puan anahtarı doğru iddialardan |
     | `fill` | Boşluk doldurma |

   - **Beceriler:** eğilim, en yüksek/en düşük, karşılaştırma, değişim (yalnızca zaman ekseninde), pay (pasta ve birimi % olmayan sütun), eşik.
   - **Türkçe ekler:** ünlü uyumu, sert ünsüz, sayıların okunuşu ve kısaltmalar dikkate alınarak üretilir: "2021'den", "Ege'de", "%15'ten".
   - **Soru sayısı:** istenen soru sayısı grafik sayısından fazlaysa, aynı grafik farklı sayılarla ve farklı bir iddia setiyle tekrar gelir.
   - **Kaynak:** her soruda örneğin bulunduğu sayfa yazar.

## Ekranda

- Kurulum kapağında `GRAFİK: dosyadaki örneklere göre` satırı.
- Öncüllü sorularda I, II ve III ayrı satırlarda (`white-space: pre-line`). Salon, eski ekran ve sonuç kâğıdında aynı.
- Grafikte eksen başlıkları (örneğin "Yıl", "Milyar $"), yalnızca örnekte varsa.

## Veritabanı

Migration: `supabase/migrations/20261023_document_chart_items.sql`. İki kez çalıştırmak güvenli.

- **`document_chart_scans`:** belge başına tarama durumu, sayfalar, geçici görsel adresleri ve ilerleme.
- **`document_chart_items`:** bulunan grafikler (`chart` jsonb) ve örnek biçimleri (`example` jsonb).
- **Erişim (RLS):** öğrenci yalnızca kendi kayıtlarını okur. Yazma yalnızca service role ile yapılır.
- **Silme:** belge silinince kayıtlar da silinir (cascade).

## Mevcut işleyişe etkisi

- **Kutu işaretli değilse:** hiçbir şey değişmez. İstek gövdesi, prompt, yeniden deneme ve karıştırma eskisi gibi.
- **Kaynak "ders ağacı" ise:** kutu gizli ve devre dışı.
- **Grafik bulunmazsa:** tarama "Belgede grafik bulunamadı; bu belgeyle grafik sınavı kurulamıyor." uyarısıyla durur ve sınav kurulmaz. generate-exam bu durumda 409 `no_chart_items` döner.
- **Tek ortak değişiklik:** kaynağı önceden atanmış sorular yeniden atanmaz, `keep_order` taşıyan sorularda şıklar karıştırılmaz. Bu ikisi şu an yalnızca grafik sorularında görülür.

## Deploy (sıra önemli)

1. **Migration:** SQL Editor'de `20261023_document_chart_items.sql`.
2. **Yeni function `extract-chart-items`:** Dashboard → Edge Functions → New.
   - Verify JWT **açık**.
   - Kullandığı env değişkenleri: `PDFCO_API_KEY`, `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Hepsi projede diğer function'lar için zaten tanımlı.
3. **`generate-exam`.**
4. **Ön yüz:** PR birleşince Vercel'den kendiliğinden çıkar.

## Elle kontrol

- [ ] Grafikli soru içeren bir PDF yükle, özetle, sonra "belgem" kaynağıyla kutuyu işaretleyip sınav kur.
- [ ] Tarama ilerlemesi notta görünür; ikinci sınavda tarama tekrarlanmaz.
- [ ] Grafikler orijinale benzer: aynı tür, aynı kategoriler, farklı sayılar.
- [ ] Soru biçimi örnekle aynı: öncüllü örnekten öncüllü soru, "söylenemez" örneğinden "söylenemez" sorusu.
- [ ] Teslimden sonra cevap anahtarı grafikle tutarlı.
- [ ] Logda `extract-chart-items: sayfa N (i/k) → m grafik` ve `generate-exam: X taranmis grafikten Y soru (kodla)` satırları görünür.
