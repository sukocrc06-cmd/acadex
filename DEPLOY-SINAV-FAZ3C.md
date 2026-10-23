# Sınav Platformu — Faz 3c: adım adım kontrol ve şık tekrarı denetimi

## 1. Adım adım çöz (doğrusal denklem, NBD, faiz)

Sonuç kâğıdında, kodla doğrulanmış hesap sorularının altında **adım adım çöz** düğmesi çıkar. Koşul: sorunun türü doğrusal denklem, net bugünkü değer (NBD) ya da faiz/kredi/gelecek değer olmalı.

- Öğrenci her satıra bir adım yazar; **adımları kontrol et** satır satır sonuç verir. Kontrol tarayıcıda yapılır: LLM yok, sınav puanı değişmez.
- **Doğrusal denklem:** her satır bir denklemdir. Her satırın çözümü bir öncekiyle karşılaştırılır.
  - **Yanlış geçiş:** çözümün değiştiği ilk satır işaretlenir ("Bu satır çözümü değiştiriyor…"). Doğru cevap söylenmez.
  - **Sonraki satırlar:** önceki hatayı taşıyan satırlar ayrıca belirtilir.
  - **Öteki hatalar:** doğrusal olmayan satır, katsayısı sıfırlanan bilinmeyen, okunamayan satır.
  - **Bitiş:** bilinmeyen yalnız kalmamışsa "x'i yalnız bırakarak bitir" denir.
- **NBD / faiz:** her satır `ifade = sonuç` zinciridir (`PV1 = 500/1,1 = 454,55`). Baştaki etiketler (PV1, NBD, Taksit) atlanır; Türkçe sayı yazımı okunur (`1.000.000`, `454,55`).
  - **İşlem hatası:** hatalı satırda doğru değer gösterilir.
  - **Doğru ara sonuç:** formülün ara sonuçlarından birine uyan satır ✓ ile işaretlenir.
  - **Yuvarlama payı:** yuvarlanmış girdiyle üs alınca oluşan küçük fark hata sayılmaz.
  - **Sonuç farklıysa:** işlemler doğru ama sonuç tutmuyorsa yöntem hatası denir; tipik hatayla eşleşirse "Olası hata: …" eklenir.
- **"Farklı sayılarla tekrar dene" ile birlikte:** açık bir varyant varsa adım alanı o soruya geçer ve varyantın kendi çözümüyle kontrol eder.

**Üretim (`generate-exam`):** model hesap sorusuna şu alanları ekler:
- `step_kind`: `linear` / `npv` / `interest`
- doğrusal denklemde `equation` (değişken adlarıyla, örn. `a*x + b = c*x - d`) ve `unknown`

Denklem kodla çözülür ve formülün sonucuyla aynı olmalıdır. Tutmazsa yalnızca adım türü düşer, soru kalır.

Ek: metinde "2x - 7" yazan ve değişkeni -7 olan sabit artık kabul edilir. Bu durumda "farklı sayılarla" şablonu kapanır, böylece "- -5" gibi bozuk metin oluşmaz.

## 2. Şık tekrarı denetimi

Canlı testte "5.368,00 / 5.368 / 5.368,5" gibi aynı cevabı gösteren şıklar görülmüştü. Çoktan seçmeli soru artık şu durumlarda `mc_ambiguous_options` nedeniyle atılır ve yeniden üretilir:

- **Sayısal şıklar:** sayı dışındaki kısmı aynı olan iki şıktan (ör. ikisi de "… TL") biri öbürüne eşitse ya da (ikisi de tam sayı değilse) %0,5 içindeyse. "1990 / 1991" gibi ardışık tam sayılar ayrı kalır.
- **Öteki şıklar:** sayılar ortak biçime, yüzdeler kesre (%8 → 0.08) çevrilip boşluk ve noktalama atıldıktan sonra aynıysa.

Bu denetim anlamca aynı ama farklı yazılmış ifadeleri yakalamaz (ör. aynı tarihin iki farklı yazımı); bunlar için "soru hatalı" bildirimi duruyor.

## Mevcut işleyişe etkisi

- Sınav puanlaması değişmedi; adım kontrolü yalnızca sonuç kâğıdında alıştırma.
- Eski sonuçlarda `steps` alanı yok: düğme çıkmaz, sonuç kâğıdı eskisi gibi.
- `practice` verisi aynı; yeni `steps` alanı eski istemcide yok sayılır.
- Migration yok.

## Deploy (sıra önemli)

1. **`grade-exam`** önce (sonuca `steps` ekler).
2. **`generate-exam`** sonra (step_kind üretir, şık tekrarını denetler).
3. **Ön yüz:** PR birleşince Vercel'den kendiliğinden çıkar.

## Elle kontrol

- [ ] Faiz/kredi ya da NBD içeren bir belgeyle hesaplama sınavı kur, bitir.
- [ ] Sonuç kâğıdında **adım adım çöz**: doğru adımlar ✓, bilerek yapılan işlem hatası doğru değerle işaretlenir.
- [ ] **farklı sayılarla tekrar dene** açıkken adım alanı yeni soruya geçer.
- [ ] Test sınavında aynı cevabı gösteren şık çıkmaz. Edge function loglarında görülürse neden `mc_ambiguous_options`.
