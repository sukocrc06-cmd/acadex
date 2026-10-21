# Sınav Platformu — Faz 0 deploy listesi

Faz 0'ın amacı sınav puanının güvenilir olması. Bu turda 1 migration, 3 edge function ve `js/dashboard.js` değişti. Hepsi yerelde test edildi: 28 birim testi, tip kontrolü ve PostgreSQL 16 üzerinde migration denemesi. Gerçek bir Supabase projesinde henüz çalıştırılmadı.

> Bu dosya geçicidir. Deploy bitip aşağıdaki kontroller geçince silebilirsin.

## Sıra önemli

### 1. Migration

- [ ] Supabase Studio → SQL Editor → `supabase/migrations/20261014_exam_integrity.sql` içeriğini yapıştır → **Run**
- [ ] Dosyanın sonundaki kontrol sorgularını çalıştır:
  - `exam_answer_keys` için RLS açık (`true`) ve politika sayısı `0` olmalı.
  - `exams` politikalarının listesini bana at: öğrencinin kendi satırını güncelleyebildiği bir politika varsa bilmek istiyorum (yeni tetikleyici zaten puan alanlarını koruyor, ama haberimiz olsun).

### 2. Edge function'lar (migration'dan sonra)

- [ ] `generate-exam` → `supabase/functions/generate-exam/index.ts` → yapıştır → **Deploy**
- [ ] `grade-exam` → `supabase/functions/grade-exam/index.ts` → yapıştır → **Deploy**
- [ ] `get-exam-hint` → `supabase/functions/get-exam-hint/index.ts` → yapıştır → **Deploy**

### 3. Ön yüz

- [ ] `js/dashboard.js` değişikliğini Vercel'e gönder (her zamanki yolla). `vercel.json` `js/` klasörüne `no-cache` koyduğu için tarayıcı yeni dosyayı hemen alır.

## Elle kontrol

- [ ] **Anahtar gizli mi?** Bir test sınavı oluştur. Tarayıcıda Geliştirici araçları → Network → `generate-exam` yanıtını aç. Sorularda `correct_answer`, `solution_steps` ve `hint` olmamalı.
- [ ] **Puanlama çalışıyor mu?** Sınavı çöz ve gönder. Sonuç ekranında doğru cevaplar ve çözüm adımları görünmeli.
- [ ] **Tek gönderim:** Aynı sınav için `grade-exam`'e ikinci kez istek gidince 409 dönmeli. Arayüz "zaten tamamlanmış" uyarısı verip kurulum ekranına dönmeli.
- [ ] **Türkçe karşılaştırma:** Karışık sınavda boşluk doldurma sorusuna cevabı Türkçe karakter kullanmadan yaz (ör. "kırılma" yerine "kirilma"). Doğru sayılmalı.
- [ ] **Simülasyonda ipucu:** Simülasyon sınavında `get-exam-hint` isteği 403 dönmeli.
- [ ] **Eski sınavlar:** Deploy'dan önce oluşturulup tamamlanmamış bir sınav varsa, onu gönder. Eskisi gibi puanlanmalı (geriye dönük uyumlu).
- [ ] **Üretim limiti:** Saatte 12, günde 40 sınav. Ayar `generate-exam/index.ts` içinde `EXAM_RATE_LIMIT_PER_HOUR` / `_PER_DAY`.

## Loglarda görmek istediklerim

| Log satırı | Anlamı |
| --- | --- |
| `exam_answer_keys yazilamadi — cevap anahtari GIZLENEMIYOR` | Migration çalışmamış; sınav eski düzende üretildi |
| `started_at kolonu yok` | Migration çalışmamış; simülasyon süresi sunucuda kontrol edilemiyor |
| `... soru dogrulamadan gecmedi (mc_answer_not_in_options, ...)` | Model bozuk soru üretti, atıldı ve yerine yenisi istendi. Hangi nedenin sık görüldüğünü bana at |
| `acik uclu soru puanlanmadi, yeniden isteniyor` | Puanlayıcı bir soruyu atladı, yeniden istendi |
| `rate limit sayimi yapilamadi` | `created_at` sayımı başarısız; limit atlandı |

## Ters giderse

Her değişiklik migration'sız da çalışacak şekilde yazıldı: migration yoksa sınav eski düzene düşer, yalnızca anahtar gizlenemez. Bir sorun çıkarsa ilgili fonksiyonun eski `index.ts` dosyasını GitHub'daki önceki sürümden geri yapıştırman yeterli. Migration geri alınmak zorunda değil; eski fonksiyonlar yeni kolonları görmezden gelir.

## Testler

```bash
node tests/exam-integrity.js
```

28 test. Bu test de diğerleri gibi `typescript` paketine ihtiyaç duyuyor; kurulum README'de.
