# Sınav Platformu — Faz 2b: itiraz ve "bu soru hatalı" bildirimi

Sonuç kâğıdında her sorunun altında iki yeni bağlantı var:

- **puana itiraz et** (yalnızca klasik ve boşluk doldurma, tam puan değilse): öğrenci neden puanının yanlış olduğunu yazar.
  - Soru daha yüksek düşünme payıyla yeniden puanlanır. İtiraz notu yeniden puanlamaya gösterilir ama kanıt sayılmaz; yalnızca cevaba bakılır.
  - Klasikte rubrik maddeleri yeniden değerlendirilir. Boşlukta cevabın eşdeğer olup olmadığına (eşanlamlı, kısaltma, öteki dildeki karşılığı) karar verilir.
  - **Puan asla düşmez.** Yeni puan eskisinden yüksekse kabul edilir ve sınav notu yeniden hesaplanır; değilse eski puan kalır.
  - Reddedilen itiraz **öğretmene ilet** ile öğretmene taşınabilir (durum `escalated`). Öğretmen ekranı Faz 8'de.
- **soru hatalı**: cevap anahtarı yanlış / soru belirsiz / kaynakta yok / yazım hatası / diğer. Puanı değiştirmez, soru kalitesini izlemek için kaydedilir.

Çoktan seçmeli, doğru-yanlış ve hesap soruları kodla birebir puanlandığı için onlarda itiraz yok; hata varsa sorun sorudadır ve "soru hatalı" ile bildirilir.

Her soruya en fazla bir itiraz ve bir bildirim yapılabilir. Günlük sınır: 10 itiraz, 30 bildirim.

## Mevcut işleyişe etkisi

Yok. `generate-exam` ve `grade-exam` değişmedi. Bu dilimdeki her şey ekleme:

- `supabase/migrations/20261022_exam_question_feedback.sql`: yeni tablo
- `supabase/functions/exam-appeal/index.ts`: yeni edge function
- `js/acadex-ink.js` ve `css/acadex-ink.css`: sonuç kâğıdına bağlantılar ve küçük formlar

Fonksiyon ya da tablo henüz kurulmamışsa bağlantılar yalnızca "İtiraz sistemi henüz kurulmadı" der; sonuç kâğıdının geri kalanı etkilenmez.

## Deploy (sıra önemli)

1. **Migration:** SQL Editor → `supabase/migrations/20261022_exam_question_feedback.sql` → **Run**.
   Kontrol: `select count(*) from pg_policies where tablename = 'exam_question_feedback';` sorgusu **1** dönmeli.
2. **Edge function:** Edge Functions → **Deploy a new function** → adı `exam-appeal` → `supabase/functions/exam-appeal/index.ts` → **Deploy**.
   Ortam değişkenleri (`GROQ_API_KEY` ve Supabase anahtarları) öteki fonksiyonlarla ortak; ek ayar gerekmiyor.
3. **Ön yüz:** PR birleşince Vercel'den kendiliğinden çıkar.

## Elle kontrol

- [ ] Klasik bir soruda bilerek eksik cevap ver, teslim et. Sonuç kâğıdında **puana itiraz et** → cevabında olan bir şeyi göster → gönder. Puan yükselirse "itiraz kabul edildi · 45 → 70" etiketi çıkmalı, sınav notu güncellenmeli. Yükselmezse "puan değişmedi" ve **öğretmene ilet** çıkmalı.
- [ ] Çoktan seçmeli bir soruda yalnızca **soru hatalı** görünmeli. Bildir → "bildirildi · …" etiketi çıkmalı.
- [ ] Aynı soruya ikinci itiraz yapılamamalı; bağlantı kaybolmalı.
- [ ] Supabase → Table Editor → `exam_question_feedback`: kayıtlar ve `old_score` / `new_score` görünmeli.
- [ ] Supabase → Logs → `exam-appeal`: `ilk=45 yeniden=70 fark=25 sonuc=kabul` satırı. Yol haritasındaki tutarlılık ölçümü bu satırlardan izlenebilir.

## Testler

```bash
node tests/exam-appeal.js   # 15 test — Faz 2b
node tests/run-all.js       # 23 dosya, 888 test
```

`tests/exam-appeal.js`, `exam-appeal`'deki ortak yardımcıların `grade-exam`'dekilerle birebir aynı kaldığını da denetliyor.

Ekran tarafı gerçek `dashboard.html`'de, sahte Supabase ile Chromium'da denendi:

- **İtiraz:** kısa gerekçe uyarısı, kabul, ret ve ardından öğretmene iletme.
- **Bildirim** ve fonksiyonun kurulu olmadığı durum.
- **Telefon genişliği:** 390 px'te yatay taşma yok.

Önceki akışlar (çözme, yenileyip devam etme, teslim, simülasyon, çık, sonuç kâğıdı) yeniden denendi ve değişmedi.

Migration yerel Postgres 16'da denendi:

- İki kez çalıştırılabiliyor.
- Öğrenci yalnızca kendi kaydını okuyabiliyor ve yazamıyor; anon hiç erişemiyor.
- Aynı soruya ikinci kayıt engelleniyor.
- Sınav silinince kayıtlar da siliniyor.

## Sonra (Faz 2c)

4/5 şık ve yanlışın doğruyu götürdüğü net hesabı.
