# Sınav Platformu — Faz 2a: açıklama, kaynak sayfa, rubrikle puanlama

Bu dilimden sonra sonuç kâğıdında her sorunun altında şunlar var:

- **Neden:** doğru cevabın neden doğru olduğu, 1–2 cümle.
- **Seçtiğin şık neden yanlış:** yanlış şık seçildiyse, o şıktaki yanılgı. Açılır listede dört şıkkın tamamının açıklaması da var.
- **Madde madde:** klasik sorularda 3–5 maddelik rubrik. Her madde için "karşıladın / kısmen / eksik", kısa bir gerekçe ve maddenin puanı görünüyor.
- **Kaynak:** soru belgeden üretildiyse belgedeki sayfa ("s. 7" ya da birleşik sayfalarda "s. 3–5") ve o sayfadan birebir alıntılanmış cümle.

Bunlar sınav sırasında tarayıcıya gitmiyor. Cevap anahtarıyla birlikte `exam_answer_keys` tablosunda duruyorlar ve ancak puanlamadan sonra gösteriliyorlar.

**Veritabanı değişikliği yok.** Yeni alanlar mevcut JSON kolonlarına (`exam_answer_keys.keys`, `exams.question_results`) yazılıyor.

## Nasıl çalışıyor

| Parça | Nerede | Not |
| --- | --- | --- |
| Açıklama, şık gerekçeleri, rubrik | `generate-exam`, aynı üretim çağrısında | Ek çağrı yok. Eksik ya da bozuk gelirse soru atılmıyor, yalnızca o alan boş kalıyor |
| Rubrik puanları | `generate-exam` doğrulaması | 2–6 madde. Puanlar toplamı tam 100 olacak şekilde ölçekleniyor |
| Kaynak sayfa | `generate-exam` | Özet kartlarındaki atıflarla aynı deterministik motor (`document_chunks` + terim eşleşmesi). Yapay zekâ çağrısı yok. Eşik tutmazsa soru sayfasız kalıyor; yanlış sayfa gösterilmiyor |
| Rubrikle puanlama | `grade-exam` | Model yalnızca madde başına karar veriyor, puanı kod hesaplıyor. `temperature` 0.2'den 0'a indi |

Rubriği olmayan eski sınavlar ve sayfasız belgeler (DOCX, ders ağacından üretilen sınavlar) eskisi gibi çalışıyor.

## Deploy

1. Supabase → Edge Functions → `generate-exam` → kodu `supabase/functions/generate-exam/index.ts` ile değiştir → **Deploy**.
2. Aynısını `grade-exam` için yap (`supabase/functions/grade-exam/index.ts`).
3. Ön yüz (`js/acadex-ink.js`, `css/acadex-ink.css`) PR birleşince Vercel'den kendiliğinden çıkıyor.

Sıra önemli değil; her parça ötekinin eski sürümüyle de çalışıyor.

## Elle kontrol

- [ ] **Belgeden** (bir çalışma kartından) karışık bir sınav oluştur. Bir şıkkı bilerek yanlış işaretle, klasik soruya kısa ve eksik bir cevap yaz.
- [ ] Sonuç kâğıdında yanlış şıkta kırmızı "seçtiğin şık neden yanlış" kutusu görünmeli. Her soruda **neden** satırı olmalı.
- [ ] Klasik soruda **madde madde** tablosu olmalı; puan, maddelerin toplamına eşit olmalı.
- [ ] PDF'ten üretilen sınavda soruların çoğunda **kaynak · belgede s. N** satırı olmalı. Alıntı, o sayfada gerçekten geçmeli.
- [ ] Supabase → Logs → `generate-exam`: `N/M soru kaynak sayfaya baglandi` satırı. Yol haritasındaki hedef: uzun bir PDF'te en az %80.

## Testler

```bash
node tests/exam-feedback.js    # 20 test — Faz 2a
node tests/exam-integrity.js   # 30 test
node tests/run-all.js          # 22 dosya, 828 test
```

`tests/exam-feedback.js`, `generate-exam`'deki atıf motoru kopyasının `summarize-document`'takiyle birebir aynı kaldığını da denetliyor. Birini değiştirirsen test ötekini de değiştirmeni ister.

## Henüz yapılmadı (Faz 2b, 2c)

- İtiraz ve "bu soru hatalı" bildirimi.
- Tutarlılık ölçümü (aynı cevabın iki puanlaması arasındaki fark 10'u geçmemeli). İtiraz akışı ikinci puanlamayı doğal olarak üreteceği için orada ölçülecek.
- 4/5 şık ve net hesabı.
