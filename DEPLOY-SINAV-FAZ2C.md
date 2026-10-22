# Sınav Platformu — Faz 2c: şık sayısı ve "yanlış doğruyu götürür"

Sınav kurulum penceresine yeni bir **puanlama** bölümü eklendi:

- **Şık sayısı:** 4 şık (A–D) ya da 5 şık (A–E, ÖSYM tarzı). Çoktan seçmeli sorular seçilen sayıda şıkla üretilir.
- **Yanlış doğruyu götürür:** isteğe bağlı, varsayılan **kapalı**. Açılınca oran seçilir: 3 ya da 4 yanlış 1 doğruyu götürür. Oran, elle değiştirilmedikçe şık sayısını izler (4 şık → 3, 5 şık → 4).
- Klasik ve hesaplama sınavlarında çoktan seçmeli soru olmadığı için bölüm pasifleşir ve bunu söyleyen bir not çıkar.

Kural:

- Ceza **yalnızca çoktan seçmeli** sorularda uygulanır. Doğru-yanlış, boşluk, klasik ve hesap soruları etkilenmez.
- **Boş bırakılan götürmez.**
- Test neti: `doğru − yanlış / oran`. Çoktan seçmeli kısmın nota katkısı `max(0, net) × 100`; net eksiye düşse de öteki soru tiplerinin puanını silmez. Not, puanlanan tüm sorulara bölünür.
- Ayar sınavla birlikte sunucuda saklanır (`exams.scoring`). Öğrenci sınav sırasında tarayıcıdan kapatamaz: not koruma tetikleyicisine eklendi.

Ekranda:

- **Önizleme kapağı:** ŞIK ve NET satırları.
- **Sınav kitapçığının kapağı:** "yanlış doğruyu götürür: 4 yanlış 1 doğruyu siler … emin değilsen boş bırak".
- **Sonuç kâğıdı:** "test neti 5,25 · 6 doğru · 3 yanlış · 1 boş · 4 yanlış 1 doğruyu götürür".

## Mevcut işleyişe etkisi

Ayar seçilmezse (varsayılan) her şey bugünkü gibi: 4 şık, ceza yok, not aynı formülle (`computeExamGrade` ayar kapalıyken `computeFinalGrade` ile birebir aynı sonucu verir; testte denetleniyor). Eski sınavların `scoring` alanı boş; onlar da etkilenmez.

İtiraz (`exam-appeal`) notu yeniden hesaplarken sınavın ayarını korur.

## Deploy (sıra önemli)

1. **Migration:** SQL Editor → `supabase/migrations/20261022b_exam_scoring.sql` → **Run**.
   - `exams.scoring` sütununu ekler.
   - `exams_guard_grading_fields` fonksiyonuna yalnızca `scoring` satırlarını ekler; geri kalanı 20261014'teki ile birebir aynı.
   - Kontrol: `select count(*) from information_schema.columns where table_name = 'exams' and column_name = 'scoring';` → **1**.
2. **Edge function'lar:** `grade-exam`, `exam-appeal`, `generate-exam` → kodu repodakiyle değiştir → **Deploy**.
   - Migration'dan önce deploy edilirse `generate-exam` `scoring` olmadan kaydeder; ceza uygulanmaz ama sınav yine üretilir.
3. **Ön yüz:** PR birleşince Vercel'den kendiliğinden çıkar.

## Elle kontrol

- [ ] Kurulumda **klasik** seç: puanlama bölümü soluk, "çoktan seçmeli soru yok" notu görünür.
- [ ] **Test** seç → **5 şık** → **yanlış doğruyu götürür**: oran "4 yanlış 1 doğru" olur; kapakta ŞIK 5, NET 4:1.
- [ ] Sınavda sorular A–E şıklı; kitapçık kapağında kural yazar.
- [ ] Bilerek birkaç yanlış, bir boş bırakıp teslim et: sonuç kâğıdında test neti; not = net × 100 / soru sayısı.
- [ ] Aynı ayarlarla **ceza kapalı** bir sınav: not, doğru sayısının yüzdesi (eskisi gibi).

## Testler

```bash
node tests/exam-scoring.js    # 12 test — Faz 2c
node tests/run-all.js         # 24 dosya, 901 test
```

Ekran tarafı gerçek `dashboard.html`'de, sahte Supabase ile Chromium'da denendi. Denenenler:

- Bölümün sınav türüne göre açılıp kapanması.
- Oranın şık sayısını izlemesi; elle seçilince korunması.
- `generate-exam`'e giden istek: testte `optionCount: 5, negativeMarking: 3`; klasikte `4, 0`.
- Kitapçık kapağındaki kural ve sonuçtaki net.
- Eski sınavda net satırının çıkmaması.

Önceki akışlar (çözme, devam etme, teslim, simülasyon, çık, sonuç kâğıdı, itiraz) yeniden denendi ve değişmedi. Migration yerel Postgres'te denendi:

- İki kez çalıştırılabiliyor.
- Öğrenci `scoring`'i değiştiremiyor, silemiyor; `scoring`'li sınav ekleyemiyor.
- Eski korumalar sürüyor.
- Öğrencinin öteki alanlara erişimi değişmedi.
