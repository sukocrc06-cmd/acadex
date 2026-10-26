# Sınav Platformu — Faz 4b.2: dosyadaki grafik ve çizim soruları kendiliğinden

Öğrencinin yüklediği belgede grafik ya da çizim soruları varsa, benzerleri sınava **sorulmadan** karışır. İstemeyen "grafik sorusu olmasın" kutusunu işaretler.

## Öğrencinin gördüğü

- **Kart seçilince** belge arka planda taranır. Öğrenci bir şey yapmaz, beklemez.
- **Sınav, tarama bitmeden kurulursa** pencerede ilerleme yazar ("… taranıyor: 2/3 sayfa"). En çok 3 dk beklenir; bitmezse sınav taramasız kurulur, tarama arkada sürer ve sonraki sınavda hazırdır.
- **Grafik sorusu bulunduysa:** sınavın yaklaşık dörtte biri, belgedeki grafiklerin benzerleriyle (sayılar farklı) kodla kurulur ve sınava eşit aralıklarla dağılır.
- **Çizim sorusu bulunduysa** ("doğruları çiziniz", "dengeyi işaretleyiniz", "bölgeyi tarayınız"…): model çizim sorularını o örneklerin üslubunda ve konusunda, yeni sayılarla yazar. Karışık ve hesaplama sınavlarında çizim sorusu zorunlu olur.
- **"Grafik sorusu olmasın" işaretliyse:** tarama yapılmaz, hiçbiri gelmez.
- **"Tamamı dosyadaki grafik sorularından"** (eski adı "dosyadaki grafik sorularına göre", Faz 4c): bütün sınav yine yalnızca taranmış grafiklerden kurulur. Çizim örnekleri bu kipte kullanılmaz.

## Sınav türüne uyum (`chartItemForExam`)

| Sınav | Dosyadaki grafik sorusunun biçimi |
|---|---|
| Test | Yalnızca çoktan seçmeli: hangisi söylenebilir/söylenemez, öncüllü; değer sorusu şıklı |
| Klasik | Yorum (açık uçlu) |
| Hesaplama | Değer (hesap sorusu, kodla doğrulanmış) |
| Karışık | Örneğin biçimi; sayısal olmayan kaynakta değer sorusu şıklı |

Kurulan soru sınavın izinli tipinde değilse atılır (testte denetleniyor).

## Tarama (`extract-chart-items`, `auto: true`)

- **Hangi sayfalar:** yalnızca grafik + soru izi ya da çizim sorusu izi taşıyanlar (`selectCandidatePages(..., strict)`). Boş sayfalara ve ilk sayfalara geri dönüş yok.
- **İz yoksa:** model hiç çağrılmaz; `status: 'done'`, `error: 'auto_no_cues'` kaydedilir.
- **Sonradan istenen tarama:** öğrenci "tamamı dosyadaki grafik sorularından" derse `auto_no_cues` kaydı yeniden başlar (boş sayfalara da bakan tam tarama).
- **PDF ya da görüntü değilse:** hata değil, "yok" kaydedilir.
- **Çizim soruları:** grafiksiz kaydedilir (`chart: {}`, `example.format: 'draw'`, `example.draw`: istenen nesne türleri).
- **Eşzamanlılık:** aynı kart için tek tarama sürer; 4c taraması başlamadan önce arka plandaki tarama beklenir.

## Üretim (`generate-exam`)

- `document_chart_items` normal kart sınavlarında da okunur (öğrencinin RLS istemcisiyle).
- `k = min(grafik × 2, soru ≥ 3 ? max(1, round(soru / 4)) : soru = 2 ? 1 : 0)` soru kodla kurulur; model kalanını yazar.
- Çizim örnekleri (en çok 4, 300 karakter) prompt'a eklenir. Kaynak metni çizim konusu öğretmese de `graphSource` açılır.
- Zorunlu çizim sorusu sonradan eklenirken kodla kurulan grafik soruları değiştirilmez.
- Log: `belgede N grafik, M cizim ornegi; K grafik sorusu kodla karisti`.

## Mevcut işleyişe etkisi

- **Taranmamış ya da grafiksiz belgeler:** değişiklik yok; tarama iz bulamazsa model çağrılmaz.
- **Ders (katalog) sınavları:** değişiklik yok.
- **Migration:** yok (`document_chart_items` ve `document_chart_scans` Faz 4c'den var).
- **Grade-exam:** değişmedi.

## Deploy (sıra önemli)

1. **`extract-chart-items`:** `auto` ve çizim sorusu tanıma.
2. **`generate-exam`.**
3. **Ön yüz:** PR birleşince Vercel'den kendiliğinden çıkar.

Ön yüz önce çıkarsa eski tarayıcı `auto`yu bilmez ve iz olmayan belgede de ilk sayfalara bakar (zararsız ama gereksiz model çağrısı).

## Elle kontrol

- [ ] Grafikli soru içeren bir PDF'le karışık sınav kur. "Tamamı…" kutusu işaretsiz olmalı. Soruların yaklaşık dörtte biri grafikli olmalı.
- [ ] Çizim sorusu içeren bir PDF'le ("doğruları çiziniz") karışık sınav kur. En az bir çizim sorusu gelmeli.
- [ ] Grafiksiz bir belgeyle sınav kur. Tarama hızlı bitmeli; Groq'a görsel çağrı yapılmamalı (log: `iz yok (model cagrilmadi)`).
- [ ] "Grafik sorusu olmasın" işaretliyken tarama isteği gitmemeli; grafik ve çizim sorusu gelmemeli.

## Canlı test düzeltmesi (25.10.2026)

Çizim sorulu örnek PDF'le (`tests/fixtures/cizim-sorulari-ornek.pdf`, dal `test-grafik-pdf`) canlı test:
- **Tarama:** yalnızca 2. sayfa tarandı (konu özeti sayfası atlandı); 4 çizim sorusu doğru türleriyle tanındı (doğru/nokta, kaydırma, bölge).
- **Sınav:** 8 soruluk karışık sınavda 2 çizim sorusu geldi. İki sorun görüldü ve düzeltildi:
  1. **Cevap sızıntısı:** model öğrencinin çizeceği doğruları "given"a da koydu; doğrular ekranda hazır çizili geliyordu. `verifyGraph` artık cevaptaki bir doğruyla çakışan verilen nesneyi kaldırıyor (kaydırma sorusunun baz doğrusu hariç; kaydırma referansları yeniden sıralanıyor). Prompt'a da kural eklendi.
  2. **Kopya:** model dosyadaki denklemleri aynen kullandı (P = 10 − Q, y = 2x − 2). Dosyadaki denklemlerden birini taşıyan çizim sorusu artık atılıyor (`graph_copied_from_file`); prompt "farklı denklem ve sayılar" diyor.

Deploy: yalnızca `generate-exam`.

## İkinci canlı test düzeltmesi (26.10.2026)

- **Kopya düzeltmesi çalıştı:** yeni sınavda çizim sorusu farklı denklemlerle geldi (P = 12 − 2Q, P = 3 + Q).
- **Yeni sızıntı biçimi:** model D ve S'yi yalnızca "given"a koydu, cevapta yalnızca E vardı; soru ise "Talep (D) ve arz (S) doğrularını çizin" diyordu. Çakışma kuralı yakalamadı çünkü cevapta doğru yoktu.
- **Düzeltme:** sorunun çizim istenen cümlesinde (çiz / draw; "verilmiştir" geçmeyen) parantez içinde etiketi geçen verilen doğru cevaba taşınır (`graphDrawLabels`). Kaydırma sorusunun baz doğrusu ve "D ve S verilmiştir, dengeyi işaretleyin" türü sorular etkilenmez.

Deploy: yalnızca `generate-exam`.
