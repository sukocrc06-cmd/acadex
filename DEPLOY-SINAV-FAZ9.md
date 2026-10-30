# Sınav Platformu — Faz 9: süre ve strateji raporu, hata defteri hatırlatması (30.10.2026)

Kullanıcı isteğiyle önce örnek platformlar incelendi, sonra öncelik sırası çıkarıldı:
1. Zamanı gelen yanlış bildirimi
2. Süre ve strateji raporu
3. Sınav günü hazırlığı
4. İkinci şansa grafik ve çizim

## Örnekler

- **UWorld:** soru başına ortalama süre, sınav temposuyla karşılaştırılır (USMLE 90 sn). Cevap değiştirme üçe ayrılır: doğrudan yanlışa (en önemlisi; kendinden şüphe), yanlıştan doğruya, yanlıştan yanlışa. Boş bırakılan da izlenir. [Elite Medical Prep](https://elitemedicalprep.com/how-i-counsel-students-based-on-their-uworld-step-1-and-step-2-qbank-performance-analysis/)
- **Blueprint:** soru başına ve toplam süre, cevap değişiklikleri. [Blueprint](https://help.blueprintprep.com/en/articles/8487374-qbank-score-report)
- **BoardVitals:** ortalama yanıt süresi, sınav günündeki süreyle karşılaştırma. [BoardVitals](https://info.boardvitals.com/knowledge/how-to-analyze-your-performance)
- **Hatırlatma:** Duolingo "Mistakes" bölümü yanlışları 10'luk setlerle tekrarlatır; Quizlet Learn sınav tarihine göre oturum kurar ve hatırlatma gönderir; Anki'de yerleşik hatırlatma yok, kullanıcılar eklentiyle çözüyor. [Duolingo](https://blog.duolingo.com/guide-to-duolingo-practice-hub/), [EdSurge](https://edsurge.com/news/2017-03-09-quizlet-adds-new-study-plan-feature-to-help-students-study-smarter)

## 1. Hata defteri hatırlatması

- Bildirim çanında tek, toplu bir bildirim: "🔁 Hata defterinde N yanlış tekrar zamanında". Tıklayınca hata defterine gider.
- **Zamanı gelme anı:**
  - Denenmiş yanlışta bir sonraki tekrar günü.
  - Hiç denenmemiş yanlışta sınavdan 1 gün sonra, yani sınavdan hemen sonra çalmaz.
  - Grafik ve çizim soruları sayılmaz.
- Son kontrolden sonra zamanı gelen yoksa bildirim gelmez.
- **Kod:** `exam-engine` → `mistakeReminder`; `dashboard.js` → `gatherNotificationItems` (1c).

## 2. Süre ve strateji raporu

- **Kayıt** (`acadex-ink`):
  - Soru başına geçen süre; sekme gizliyken sayılmaz.
  - Ziyaret sayısı.
  - Çoktan seçmeli ve D/Y'de seçilen şıkların sırası.
  - Sayfa yenilense de sürer (tarayıcıda saklanır); sonuç gelince silinir.
- **Sunucu** (`grade-exam` → `applyTiming`): `time_ms`, `visits`; şık değiştirildiyse ilk seçim ile son cevaba göre `answer_change`. Puana etkisi yok.
- **Rapor** (`exam-engine` → `timingReport`, sonuç kâğıdında):
  - Soru başına ortalama; gerçek sınav provasında hedefle (süre ÷ soru sayısı).
  - Doğrularda ve yanlışlarda ortalama süre.
  - Şık değiştirme dökümü ve en uzun 3 soru.
  - **Öneriler:**
    - tempo hedefin %10 üstündeyse
    - aceleyle yanlış: ortancanın %40'ından (en az 8 sn) kısa
    - takılma: ortancanın 2 katından ve 60 sn'den uzun süren yanlış
    - cevap değiştirmek kaybettirdiyse "ilk cevabında kal", kazandırdıysa "gözden geçirme payı bırak"; başabaşta öneri yok
  - Soru satırında süre ve "doğrudan yanlışa / yanlıştan doğruya" etiketi.
  - Süresi kayıtlı olmayan eski sınavlarda rapor çıkmaz.
- Migration yok.

## 3. Sınav günü hazırlığı (Faz 10)

- **Örnekler:**
  - Khan Academy hazırlık yüzdesi = yetkin ya da usta beceri ÷ toplam beceri. [Khan Academy](https://support.khanacademy.org/hc/en-us/articles/48411237993357-How-is-my-mastery-percentage-calculated)
  - Quizlet Learn sınav tarihine göre oturum kurar. ALEKS düzenli bilgi kontrolüyle eski konuları yeniden yoklar.
- **Sınav salonunda başlığın altında:** takvimdeki en yakın (30 gün içi) sınav, sırasıyla eşleşirse gösterilir.
  - Hazırlık yüzdesi: yetkin ya da usta olup tekrar zamanı gelmemiş konu ÷ görülen konu.
  - Hazır, zayıf ve tekrar zamanı gelen konu sayıları; açık yanlış sayısı.
  - Tempo: 7 gün ve altı her gün, 21 güne kadar haftada iki, sonrası haftada bir.
  - Bugünün işleri: zamanı gelen yanlış varsa ikinci şans; zayıf ya da tekrar konusu varsa akıllı deneme; son 3 günde gerçek sınav provası.
  - Az veri (3'ten az konu) uyarısı.
- **Kod:** `exam-engine` → `examReadiness`; `acadex-ink` → `paintRdy`; `dashboard.html` → `[data-rdy]`. Migration yok.
- **Test:** `tests/exam-readiness.js` (4); tarayıcı 1280 ve 390 px.

## Test

- `tests/exam-timing.js` (5) ve `tests/exam-retry.js` (hatırlatma).
- Tarayıcı (sahte Supabase, 1280 ve 390 px): süre kaydı, teslim gövdesi, rapor, etiketler; teslimden sonra kayıt silinir.

## Elle kontrol (canlı, ayrı sekmede)

- [ ] Gerçek sınav provası çöz; bir soruda şıkkı değiştir. Sonuç kâğıdında "süre ve strateji" ve soru satırlarında süre görünmeli.
- [ ] Bir gün önce yanlış yapılmış sınav varsa bildirim çanında "Hata defterinde N yanlış tekrar zamanında" görünmeli.
