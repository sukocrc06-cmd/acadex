# Sınav Platformu — Faz 7: sınavda adım adım yardım (29.10.2026)

Alıştırma sınavında (gerçek sınav provası değil) her soruda **adım adım çöz**. Soru 2–4 küçük adıma bölünür; her adımın cevabı sunucuda denetlenir. Yanlışta bir deneme daha ve ipucu, ikinci yanlışta doğrusu açıklamasıyla gösterilir.

## Örnek ve karar

- Pearson MyLab "Help Me Solve This": öğrenci kendi sorusunda adım adım ilerler, bazı adımlar cevap ister; yanlışta yeniden dener, birkaç denemeden sonra doğrusu görünür. Soruya dönünce **aynı yapıda, sayıları farklı yeni soru** gelir; böylece yardım bedava puan olmaz. Kaynak: [Get help on a question](https://help.pearsoncmg.com/mfdl/student/Content/get_question_help.htm).
- Kullanıcı kararı:
  - **Yeni sayılar, tam puan:** kodla doğrulanmış ve şablonlu hesap sorusu yardım bitince yeni sayılarla gelir. Yeni hali çözülürse tam puan.
  - **Öteki tipler:** soru aynı kalır, en çok 50 puan.
  - **Kapsam:** her soru tipinde yardım var.

## Nasıl çalışır

| | Hesap sorusu (formülü kodla doğrulanmış) | Öteki sorular |
|---|---|---|
| Adımlar | Model yalnızca ara büyüklüğün **ifadesini** yazar (`1 + r`, `(1+r)^n`); değeri `evaluateExpression` hesaplar. Son adım her zaman sorunun kendi cevabı. | Model 2–3 yönlendirici çoktan seçmeli soru yazar; son cevabı ele veren adım atılır. |
| Yanlış adımda ipucu | Adımın ifadesi | Modelin tek cümlelik ipucu |
| Yardımdan sonra | Şablon varsa yeni sayılar (tam puan); yoksa en çok 50 | En çok 50 |

- **Sunucu:** `generate-exam { help: { examId, questionId, action } }` — `info`, `start`, `check`, `finish`. Sınav üretimi ve sınırları devreye girmez.
- **Adım planı:** `exam_answer_keys.keys[id].help_plan`, yalnızca sunucuda; tarayıcıya adımın cevabı gitmez.
- **İz:** `exams.questions[i].help = { mode, status }`. `questions` alanı `exams_guard_grading_fields` ile kilitli, yani yalnızca sunucu yazar. **Migration yok.**
- **grade-exam → `applyHelp`:**
  - `cap` ve yeni sayıları yazılmamış `variant` en çok 50 alır; ham puan `help_raw_score`'da durur.
  - "Yanlış doğruyu götürür" netinde yardımla doğru 0,5 doğru sayılır.
- **exam-appeal:** tavana ulaşmış soru itiraz edilemez (`help_capped`); yeniden puan tavanı aşamaz.
- **Konu ustalığı:** yardımla gelen doğru, ipucu gibi zayıf kanıt (×0,5; iki kopya).
- **Yarıda bırakma:** "soruya dön" iki basışla yardımı kapatır; hesap sorusu yine yeni sayılarla gelir. Sayfa yenilenirse "adım adım · devam" kaldığı adımdan sürer.

## Test

- `tests/exam-help.js` (12): makeVariant eşliği, hesap ve yönlendirici adımlar, adım denetimi, ilerleme, yeni sayılar, puan, net, itiraz, ustalık.
- Tarayıcı (sahte Supabase, 1280 ve 390 px): giriş metni, yanlış → ipucu, doğru → kayıt, ikinci yanlış → doğrusu, yeni sayılarla soru ve boşalan cevap, telefonda taşma yok.

## Elle kontrol (canlı, ayrı sekmede)

- [ ] Hesaplama denemesi kur (alıştırma). Bir hesap sorusunda **adım adım çöz** → "yeni sayılarla gelir" yazmalı. Adımları bir yanlış, bir doğru dene. Sonunda soru metninin sayıları değişmeli, cevap kutusu boşalmalı.
- [ ] Çoktan seçmeli bir soruda yardım → "en çok 50 puan". Doğru cevapla teslim et: sonuçta o soru 50 ve "adım adım · en çok 50" etiketi.
- [ ] Gerçek sınav provasında düğme görünmemeli.
