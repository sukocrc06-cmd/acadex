# Sınav Platformu — Faz 1 (ilk dilim) deploy listesi

Faz 1'in bu dilimi mevcut sınav sekmesine "soru motoru"nu getiriyor. Eklenenler:

- **Soru haritası:** cevaplanan, işaretli ve şu anki soru farklı renkte; tıklayınca o soruya gidiliyor.
- **İşaretleme:** "sonra dönerim" için soru işaretlenebiliyor.
- **İki görünüm:** sorular tek tek ya da hepsi birden gösterilebiliyor. Telefonda varsayılan tek tek.
- **Klavye kısayolları:** ← → soru değiştirir, A–E veya 1–5 şık seçer, F işaretler.
- **Otomatik kayıt ve devam:** sayfa yenilenir ya da kapanırsa sınav kaldığı yerden açılıyor.
- **Gönderim öncesi uyarı:** boş ya da işaretli soru varsa sınav gönderilmeden önce soruluyor.
- **Soru bazında kayıt:** her tamamlanan sınavın her sorusu `question_attempts` tablosuna yazılıyor. Hata defteri ve konu ustalığı bunun üzerine kurulacak.

Faz 0 deploy edilmeden bu dilim deploy edilmemeli (bkz. `DEPLOY-SINAV-FAZ0.md`).

## Sıra

### 1. Migration

- [ ] SQL Editor → `supabase/migrations/20261014b_exam_engine.sql` → **Run**
- [ ] Kontrol: `select tablename, count(*) from pg_policies where tablename in ('question_attempts','exam_drafts') group by 1;` sorgusu `exam_drafts` için 4, `question_attempts` için 1 politika göstermeli.

### 2. Edge function

- [ ] `grade-exam` → `supabase/functions/grade-exam/index.ts` → **Deploy**. Bu dosya Faz 0 sürümünün üzerine eklemeli; Faz 0 deploy edildiyse yine bunu yapıştır.

### 3. Ön yüz (dördü birlikte gitmeli)

- [ ] `js/exam-engine.js` (yeni dosya)
- [ ] `js/dashboard.js`
- [ ] `dashboard.html` (`exam-engine.js` için bir `<script>` satırı eklendi)
- [ ] `css/style.css` (dosyanın sonuna sınav ekranı stilleri eklendi)

## Elle kontrol

- [ ] Karışık bir sınav oluştur. Soruların üstünde **Soru haritası** görünüyor mu?
- [ ] Bir şık seç: haritadaki numara doluyor mu? **İşaretle**'ye bas: numara sarı oluyor mu?
- [ ] Metin kutusunun dışındayken klavyeden **B** ve **→** tuşlarını dene.
- [ ] **Tek tek göster** düğmesine bas: tek soru ve altında Önceki / Sonraki düğmeleri gelmeli.
- [ ] Birkaç soruyu cevapla, sayfayı yenile ve Sınav sekmesine dön. **"Yarım kalan bir sınavın var"** kutusu çıkmalı. **Devam et** cevapları ve işaretleri geri getirmeli.
- [ ] Boş soru bırakıp gönder: "2 soru boş (4, 5)…" diye sormalı.
- [ ] Gönderdikten sonra Supabase → Table Editor → `question_attempts` tablosunda sınavın her sorusu için bir satır olmalı. `exam_drafts` tablosunda o sınav kalmamalı.
- [ ] Simülasyonda: sayfayı yenileyip devam edince sayaç baştan başlamamalı, kaldığı yerden saymalı.

## Davranış değişikliği

**"Sınavdan Çık" artık cevapları silmiyor.** Cevaplar kayıtlı kalıyor ve kurulum ekranındaki kutudan devam ediliyor; silmek için kutudaki **Vazgeç** kullanılıyor. Simülasyonda çıkılsa da süre işlemeye devam ediyor (süre sunucudaki başlangıç anına göre hesaplanıyor).

## Loglarda

| Satır | Anlamı |
| --- | --- |
| `question_attempts yazilamadi` | 20261014b migration'ı çalışmamış. Not yine kaydedildi, yalnızca soru bazında kayıt eksik |
| Tarayıcı konsolunda `exam_drafts yazilamadi` | Aynı neden. Otomatik kayıt yalnızca tarayıcıda tutuluyor |

## Testler

```bash
node tests/exam-engine.js      # 12 test — soru motoru
node tests/exam-integrity.js   # 30 test — puanlama ve soru bazında kayıt
```

Ekran davranışı (tıklama, klavye, işaretleme, taslaktan geri yükleme, tek tek görünüm, telefonda yatay taşma olmaması) Chromium'da otomatik olarak denendi.
