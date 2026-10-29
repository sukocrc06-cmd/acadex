# Sınav Platformu — Faz 8: hata defteri, ikinci şans (30.10.2026)

Hata defterindeki yanlışlar (puanı 50 altı) aralıklı tekrarla geri gelir. Gelen, aynı soru değil **benzeridir**: aynı tip, aynı konu ve beceri, farklı ayrıntı. Kullanıcı seçimi.

## Kurallar

- **Takvim:**
  - Hiç denenmemiş yanlış hemen hazırdır.
  - Son ikinci şans denemesi yanlışsa (80 altı) 1 gün, doğruysa 3 gün sonra yeniden gelir.
- **Kazanma:** art arda **iki doğru** (80 ve üstü) yanlışı kazandırır, defterden çıkar. Başlıkta "N kazanıldı" yazar.
- **Ders başına "ikinci şans · N soru":** zamanı gelen en çok 10 yanlış.
- **Desteklenen tipler:** çoktan seçmeli, doğru-yanlış, boşluk, açık uçlu, hesap. Grafik ve çizim soruları defterde kalır, eskisi gibi "öğrendim" ile silinir.
- **Hesap sorusu:** şablonu olan hesap sorusu yeni sayılarla gelir (makeVariant, model çağrısı yok). Ötekiler tek model çağrısıyla yazılır.
  - Sınavla aynı şemayı kullanır ve `validateQuestion`'dan geçer.
  - Kaynakla birebir aynı soru atılır; eksik kalanlar bir kez yeniden istenir.
- **İkinci şans normal bir alıştırma sınavıdır** (süresiz, ipucu ve adım adım yardım açık).
  - `scoring.retry[i]` i+1 numaralı sorunun hangi yanlıştan geldiğini tutar.
  - Kendi yanlışları defterde yeni satır olmaz, kaynak yanlışın denemesi sayılır.
  - Sonuçları konu ustalığına normal katılır.
  - Saatlik ve günlük sınav sınırına sayılır.

## Kod

- `generate-exam { retry: { items: [{ examId, questionId }] } }` → `handleExamRetry`.
- Takvim ve durumlar: `js/exam-engine.js` → `mistakeStates` (tarayıcıda, sınav kayıtlarından). Migration yok.
- Ekran: `js/acadex-ink.js` → `paintErrs` ("ikinci şans · N soru" düğmesi, yanlış başına durum etiketi). Sınav başlığı "ikinci şans", sonuç kâğıdında "hata defterinden" etiketi.

## Test

- `tests/exam-retry.js` (6): takvim, kazanma, seri bozulması, hesapta yeni sayılar, model sorusunun denetimi.
- Tarayıcı (sahte Supabase, 1280 ve 390 px): defter, durum etiketleri, istek gövdesi, sınav başlığı.

## Elle kontrol (canlı, ayrı sekmede)

- [ ] Yanlışı olan bir sınavdan sonra hata defterinde "ikinci şans · N soru" görünmeli; yanlışların altında "ikinci şansa hazır".
- [ ] Düğme → "ikinci şans" sınavı açılmalı; sorular kaynaktan farklı olmalı, hesap sorusu yeni sayılarla.
- [ ] Doğru cevaplanan yanlış "1/2 doğru · 3 gün sonra tekrar" olmalı; yanlış cevaplanan "1 gün sonra".
