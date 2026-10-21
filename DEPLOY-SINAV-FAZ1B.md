# Sınav Platformu — Faz 1b: soru motoru kitapçık salonunun altında

Faz 1'de yazılan soru motoru (`js/exam-engine.js`) üretimde hiç devreye girmiyordu. `js/acadex-ink.js` sınavı kendi kitapçık salonuyla çiziyor ve `startActiveExam`'in üzerine yazıyor. Bu yüzden otomatik kayıt ve "kaldığın yerden devam" çalışmıyordu; boş cevap hatası da (PR #35) buradan çıkmıştı.

Bu dilimde motor ink'in **altında, görünmeden** çalışıyor. Ekran, optik form, işaretleme ve teslim onayı tamamen ink'te kalıyor; motor şunları yapıyor:

- Cevapları ink'in kartlarından okuyor (`[data-qi="i"]`, `answer-q-<id>`).
- Her değişiklikte tarayıcıya, birkaç saniyede bir de `exam_drafts` tablosuna kaydediyor.
- Sayfa yenilenir ya da kapanırsa Sınav sekmesinde **"Yarım kalan bir sınavın var"** kutusu çıkıyor. **Devam et** kapağı atlıyor; kitapçığı cevaplar, işaretler ve kalınan soruyla açıyor.
- Yeni soru tipleri (ifade, grafik, geometri, essay…) motorun tip kaydına eklenince ink onları kendi bilmese de çiziyor ve okuyor. Faz 3–5 buna dayanacak.

Veritabanı ya da edge function değişikliği yok. Yalnızca ön yüz: `js/exam-engine.js`, `js/acadex-ink.js`, `js/dashboard.js`.

## Davranış değişiklikleri

| Durum | Önce | Şimdi |
| --- | --- | --- |
| Sayfa yenilendi / sekme kapandı | Cevaplar kayboluyordu | Kutudan devam ediliyor |
| **çık** | Cevaplar kaydedilmiyor | Aynı. Taslak da siliniyor, kutu çıkmıyor |
| Simülasyon sayacı | Kitapçık açılınca başlıyordu | Sınav hazırlandığı andan sayıyor (aşağıya bak) |
| Teslim | ink onayı + bazen ikinci bir onay | Yalnızca ink'in onayı |
| "Devam et" ile dönülen sınavı teslim | Hiçbir şey olmuyordu (`currentActiveExam` boştu) | Normal teslim |

**Simülasyon sayacı neden değişti:** Faz 0'dan beri sunucu süreyi sınavın oluşturulduğu andan (`started_at`) sayıyor ve 2 dakikalık paydan sonra gönderimi reddediyor. Ink'in sayacı ise kitapçık açılınca başlıyordu. Kapakta 2 dakikadan fazla bekleyen öğrenci son dakikalarda "süre doldu" hatası alacaktı. Sayaç artık sunucuyla aynı andan sayıyor ve kapaktan itibaren kalan süreyi gösteriyor. Kapak metni de buna göre güncellendi.

## Elle kontrol (canlıda)

- [ ] Karışık bir sınav oluştur, kitapçığı aç, 2–3 soruyu cevapla, birini işaretle.
- [ ] Sayfayı yenile → Sınav sekmesi → **Yarım kalan bir sınavın var** kutusu çıkmalı.
- [ ] **Devam et** → kitapçık doğrudan açılmalı, cevaplar, işaret ve kaldığın soru yerinde olmalı.
- [ ] Teslim et → tek onay → sonuçta cevapların görünmeli.
- [ ] Supabase → Table Editor → `exam_drafts`: teslimden sonra o sınavın satırı kalmamalı; `question_attempts`: her soru için bir satır olmalı.
- [ ] Yeni bir sınavda **çık** → Sınav sekmesinde kutu çıkmamalı.
- [ ] Simülasyonda kapaktaki saat geri saymalı; yenileyip devam edince süre baştan başlamamalı.

## Testler

```bash
node tests/exam-engine.js          # 15 test — motor, başsız mod dahil
node tests/exam-integrity.js       # 30 test
node tests/exam-submit-answers.js  # 8 test
```

Gerçek `dashboard.html` sahte bir Supabase ile Chromium'da açılarak şunlar denendi:

- Cevapla, yenile, kutudan devam et, teslim et.
- Simülasyonda kalan süre.
- Süresi dolmuş simülasyona dönüş: kitapçık açılıp mevcut cevaplarla teslim ediliyor.
- **çık** taslağı siliyor.
- Kayıtlı yeni bir tip çiziliyor, okunuyor ve geri yükleniyor.
