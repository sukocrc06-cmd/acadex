# Sınav Platformu — Faz 4a: grafik okuma soruları

Sınav soruları artık kaynak belgedeki grafiklere bağlanabiliyor. Grafik sınav kâğıdında SVG olarak çiziliyor; öğrenci okuyup yorumluyor: eğilim, en yüksek/en düşük, fark, değişim, pay.

## Grafikler nereden geliyor

Yalnızca kaynaktan; model hiçbir sayıyı uyduramaz.

- **Kartın `charts` verisi:** summarize-document bunu belgede yazan sayılarla doğruluyor (`sanitizeCharts`).
- **Kartın `tables` verisindeki sayısal sütunlar** (`tableToCharts`):
  - Etiketler yıl ya da çeyrekse çizgi, değilse sütun grafiği.
  - Ölçekleri 10 kattan fazla farklı sütunlar ayrı grafiğe ayrılıyor (TL ile %).
  - "900.000" gibi Türkçe binlik yazım doğru okunuyor.
- **Ders sınavı:** ortak kartların grafik ve tabloları kullanılıyor.

En çok 6 grafik, numaralanarak modele metin olarak veriliyor. Model grafikli soruya yalnızca `chart_ref` (grafik numarası) yazıyor; **grafiği sunucu ekliyor**. Modelin kendi yazdığı bir `chart` alanı her zaman atılıyor.

## Soru kuralları

- Grafik varsa soruların yaklaşık dörtte biri (en az biri) grafik okuma sorusu. Soru metni grafikteki sayıları tekrar etmiyor.
- **Grafikli hesap sorusu:** değişkenler grafikteki değerlerden alınıyor ve kodla doğrulanıyor. Grafikte olmayan bir değer yine gizli girdi sayılıp soruyu düşürüyor. "Farklı sayılarla" şablonu kapalı, çünkü grafik sabit.
- **Grafikli açık uçlu soru:** puanlayıcı model ve itiraz yeniden puanlaması grafiği göremez; grafiğin verileri soruya metin olarak ekleniyor (`chartAsText`, grade-exam ve exam-appeal'de birebir aynı).

## Ekranda

- **Salon, eski sınav ekranı ve sonuç kâğıdı:** başlıklı grafik kutusu.
  - Değerler etiketli: amaç piksel okumak değil, yorumlamak.
  - Eksen aralıkları okunur adımlara yuvarlanıyor; büyük sayılar "1,2 Mn", "800 bin"; yüzdeler "%12", negatifte "-%2".
  - İki ya da üç seride gösterge var.
- **Telefon** (560 px altı): ayrı dar düzen; yazılar büyük kalıyor, pasta göstergesi altta.
- **Erişilebilirlik:** SVG `role="img"` ve başlık; ekran okuyucular için gizli veri tablosu.

## Mevcut işleyişe etkisi

- Grafiği ya da sayısal tablosu olmayan kartlarda hiçbir şey değişmez: prompt'a CHARTS eklenmez, grafikli soru üretilmez.
- `GROQ_RETRY_MAX_WAIT_MS` dahil başka bir davranış değişmedi.
- Migration yok.

## Deploy (sıra önemli)

1. **`grade-exam`:** sonuçta grafik, açık uçlu puanlamada grafik metni.
2. **`exam-appeal`:** itiraz yeniden puanlamasında grafik metni.
3. **`generate-exam`.**
4. **Ön yüz:** PR birleşince Vercel'den kendiliğinden çıkar.

## Elle kontrol

- [ ] Tablo (yıllara göre satış gibi) ya da grafik içeren bir belgeyle kart oluştur, sonra karışık ya da test sınavı kur.
- [ ] En az bir soruda grafik görünür; değerler grafikte, soru metninde değil.
- [ ] Telefonda grafik yazıları okunur.
- [ ] Sonuç kâğıdında grafik yeniden görünür.
- [ ] Edge function logu: `generate-exam: N grafik kaynagi, M grafikli soru`.
