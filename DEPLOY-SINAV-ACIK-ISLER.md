# Sınav platformu: açık küçük işler (26.10.2026)

Faz 4b.2 canlı testinden ve yol haritasından kalan üç iş.

## 1. Sınav eksik soruyla gelmesin

- **Görülen:** 8 soru istendi, 7 geldi. Log:
  - ilk üretimde bir çizim sorusu `graph_point_not_intersection` ile atıldı;
  - eksik için gelen tek soru `graph_copied_from_file` ile atıldı. Bu soruda yeni bir talep doğrusu vardı; yalnızca arz doğrusu (P = 2 + Q) dosyadakiyle aynıydı.
- **Kopya kuralı:** artık bir çizim sorusu ancak denklemlerinin **hepsi** dosyadan geliyorsa kopya sayılıyor (`graphCopiesFile`).
- **Son istek:** eksik hâlâ sürüyorsa ve istek 60 sn'den önceyse bir kez daha isteniyor (`THIRD_CALL_DEADLINE_MS`). Groq beklemesi en çok 45 sn, Supabase sınırı 150 sn.
- **Son çare:** hâlâ eksikse, kopya diye atılan çizim sorusu alınıyor.

## 2. Bozuk LaTeX

- **Görülen:** bir soruda "$2x + y le 8$" yazıyordu (`\le` ters eğik çizgisini kaybetmiş).
- **JSON kaçışları** (`fixJsonEscapes`): `\le`, `\sqrt`, `\underline` gibi geçersiz kaçışlar yüzünden bozulan JSON artık ters eğik çizgi korunarak ayrıştırılıyor. Hem normal yolda hem kesik çıktı kurtarmada.
- **Metin onarımı** (`repairLatex`): soru, şık, cevap, açıklama, ipucu ve çözüm adımlarında:
  - JSON kaçışına dönüşmüş komutlar onarılıyor: form feed + "rac" → `\frac`, sekme + "imes" → `\times`, …
  - `$…$` içinde ters eğik çizgisini kaybetmiş `le`, `ge`, `leq`, `geq`, `neq`, `cdot`, `times`, `infty` onarılıyor.
  - Matematik dışındaki metne dokunulmuyor.

## 3. "Farklı sayılarla" alıştırması türetilmiş değerde de çalışsın

- **Önce:** metinde "%4" yazıp değişken 0,04 olduğunda (ya da "25 yıl" → 300 ay, "− 7" → −7) şablon kapanıyordu. Bu yüzden alıştırma düğmesi çıkmıyordu.
- **Sunucu (`verifyCalculation`):** türetilmiş değişken şablonda gösterim çarpanıyla yazılıyor: `{rate*100}`, `{n/12}`, `{d*-1}` (`TEMPLATE_DISPLAY_OPS`).
- **Tarayıcı (`exam-engine`):**
  - `renderTemplate` çarpanı uyguluyor.
  - `makeVariant` metindeki sayıyı değiştirip (%4 → %3, 25 yıl → 20 yıl) değişkene çeviriyor. Böylece metin yuvarlak kalıyor.
- **Eski sınavlar:** şablonlarında çarpan yok; davranış aynı.
- **İstisna:** 360 gibi standart bir sabit formüle gömüldüyse şablon yine kapalı kalır (`{n}` karşılıksız).

## Deploy (sıra önemli)

1. **Ön yüz:** PR birleşince Vercel'den çıkar. Önce bu olmalı; yoksa eski tarayıcı yeni şablondaki `{rate*100}` yer tutucusunu çözemez ve metinde aynen gösterir.
2. **`generate-exam`.**

`grade-exam` değişmedi (şablonu olduğu gibi iletir). Migration yok.

## 4. Faz 3b canlı testi: ifade sorusu gelmedi (PR #62)

- **Test:** cebir ve türev öğreten örnek PDF (`tests/fixtures/turev-cebir-ornek.pdf`, dal `test-grafik-pdf`) ile 5 soruluk hesaplama sınavı.
- **Görülen:** 4 hesap sorusu geldi, hiç ifade sorusu yoktu. Prompt "kaynak cebir öğretiyorsa yaklaşık yarısı ifade sorusu" diyor ama model uymadı. Faz 4b.1'deki çizim sorusu sorununun aynısı.
- **Kaynak denetimi:** `sourceTeachesAlgebra`, en az iki iz arıyor (türev, sadeleştir, çarpanlara ayır, zincir/çarpım/bölüm/kuvvet kuralı, integral…).
- **Zorunluluk:** kaynak uygunsa hesaplama sınavı isteğinde `EXPRESSION QUESTIONS: required (at least N)` satırı çıkıyor (ilk istekte yaklaşık üçte bir).
- **Son çare:** ifade sorusu yine gelmezse bir kez yalnızca ifade sorusu isteniyor; gelen soru son hesap sorusunun yerine geçiyor.

Deploy: `generate-exam` (bu PR, #61'in sunucu değişikliklerini de içerir; tek deploy yeter).

## 5. Eşitlikli cevap yanlış okunuyordu (27.10.2026)

- **Görülen:** türev kaynağından 4 soruluk hesaplama sınavında 3 soru `calc_mismatch` ile atıldı; sınav 2 soruyla geldi.
- **Neden:** model cevabı "f'(2) = 76", "MR(8) = 18 TL" biçiminde yazıyor. `parseLooseNumber` rakam dışını silip bunları 276 ve 818 okuyordu; formülle tutmayınca doğru soru atılıyordu.
- **Öğrenci tarafı:** aynı sorun vardı. "MR(8) = 18" yazan öğrenci 0 alırdı.
- **Düzeltme:** `answerNumber`, son "=" ya da "≈" işaretinin sağındaki sayıyı okur; eşittir yoksa eskisi gibi. Kullanıldığı yerler:
  - `generate-exam`: modelin cevabı
  - `grade-exam`: öğrenci cevabı (hesap, hassas hesap, tipik hata eşleşmesi)
  - `exam-engine`: "farklı sayılarla" alıştırması
  - Üç kopya testte birebir aynı tutuluyor.

Deploy: `generate-exam` ve `grade-exam` otomatik (GitHub Actions); ön yüz Vercel.
