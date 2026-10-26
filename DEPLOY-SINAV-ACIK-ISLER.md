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
