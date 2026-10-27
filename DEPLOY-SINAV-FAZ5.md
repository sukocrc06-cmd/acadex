# Sınav Platformu — Faz 5: uyarlanabilir çalışma

Kullanıcı isteği (27.10.2026): sınav platformunu "en uygun faz" ile geliştirmek. Seçilen yön uyarlanabilir çalışma (ALEKS benzeri).

## Araştırma (örnek platformlar ve kullanıcı şikâyetleri)

| Platform | Nasıl çalışıyor | Şikâyet | Acadex kararı |
|---|---|---|---|
| ALEKS | Mastered / Learned / Remaining; 20 konu ya da 5 saatte bir zorunlu bilgi kontrolü; kontrolde kaçırılan konu yeniden öğrenilecekler listesine döner | 20–25 soruluk kontrol işi kesiyor; tek kontrol 55 konuyu geri alabiliyor; yanlış ya da açıklamaya bakmak seriyi bozuyor | Engelleyen kontrol yok; tekrar sınavı kısa, yalnızca zamanı gelen konular (5.2) |
| Khan Academy | Attempted / Familiar / Proficient / Mastered; Mastered yalnızca birim testinde | Tek yanlış "mastered" beceriyi düşürüyor; tek beceri için ~30 soruluk test; yazım hatası 15–30 dk yeniden test | Bir sınavda en fazla bir seviye düşüş; kısmi puan kısmi kanıt |
| Pearson Dynamic Study Modules | Güven derecelendirmesi (emin / iki seçenek / bilmiyorum); kaçırılan soru sonraki setlerde döner | — | "emin değilim" işareti (5.3) |
| FSRS (aralıklı tekrar) | Unutma eğrisi R = (1 + 19/81 · t/S)^−0.5; S günde hatırlama %90 | — | Konu "hafızası" ve "tekrar zamanı" |

Kaynaklar:
- ALEKS SSS: <https://www.mheducation.com/support/aleks-support-center/knowledge/in-a-new-knowledge-check-why-must-i-review-a-topic-i-have-already-mastered.html>
- ALEKS öğretmen yorumu: <https://www.commonsense.org/education/reviews/aleks/teacher-reviews/5118207>
- ALEKS öğrenci yazısı: <https://huntleyvoice.com/21455/thevoice/math-program-aleks-is-frustrating-and-stressful/>
- Khan Academy mastery: <https://support.khanacademy.org/hc/fr/articles/360007253831-What-is-self-paced-Mastery>
- Khan Academy kullanıcı şikâyetleri: <https://support.khanacademy.org/hc/da/community/posts/9123270418701/comments/9177967526797>, <https://support.khanacademy.org/hc/es/community/posts/360019016771/comments/360001980652>
- Pearson DSM: <https://help.pearsoncmg.com/xl/student/bb/Content/do_dsm_work.htm>
- FSRS: <https://theorempath.com/topics/fsrs-spaced-repetition-scheduling>
- BKT: <https://metricgate.com/blogs/bayesian-knowledge-tracing-r/>

## Faz 5.1: konu ustalığı (ön yüz)

**Model** (`js/exam-engine.js` → `conceptMastery`, `masteryChanges`):
- **Ustalık (p):** Bayesçi bilgi izleme.
  - Önsel 0,3, dalgınlık 0,1, öğrenme 0,1, üst sınır 0,98.
  - Şans payı soru tipine göre: çoktan seçmeli 1/şık, D/Y 1/2, boşluk ve açık uçlu 0,1, hesap/ifade/çizim 0,05.
  - Kısmi puan kısmi kanıt. 50 altı (sonuç kâğıdında "yanlış") yarı ağırlıkla.
- **Seviyeler:** zayıf < 0,4 ≤ tanıdık < 0,7 ≤ yetkin < 0,9 ≤ usta.
  - yetkin için en az 3 soru.
  - usta için en az 5 soru ve iki ayrı günde başarı.
  - Bir sınavda en fazla bir seviye düşüş.
- **Hafıza:** FSRS eğrisi.
  - Kararlılık ilk sınavda 1–3 gün.
  - Başarıda büyür (ayrı günde 1,8 + 2·(1 − hafıza) kat), başarısızlıkta 0,4 katına iner.
  - yetkin ya da usta konuda hafıza %80'in altına inince **tekrar zamanı**.
- **Kavram adı:** büyük/küçük harf, boşluk ve sondaki kısa parantez ("Marjinal maliyet (MC)") önemsiz.

**Ekran** (`js/acadex-ink.js`, `dashboard.html`, `css/acadex-ink.css`):
- **Karne → ustalık haritası:**
  - Seçili ders ya da tümü; tekrar zamanı gelenler ve en zayıflar başta.
  - Her satırda seviye, çubuk, kanıt satırı ("son 3 denemede ort. 72 · 9 gün önce · 5 soru · hafıza %80 · az veri").
  - Ders masalarında zayıf ya da tekrar zamanı gelen konuya "bu konudan deneme".
  - "nasıl hesaplanır?" açıklaması.
- **Sonuç kâğıdı:** "ustalık" satırında bu sınavın konu seviyelerine etkisi ("Tüketici artığı: zayıf → yetkin ↑").

**Etkisi:** sunucu, migration ve puanlama değişmedi. Eski sınavlar da hesaba katılır.

**Test:**
- `tests/exam-mastery.js`: 9 test.
- Tarayıcı: 1280 ve 390 px'te ustalık haritası, ders sekmesi ve sonuç kâğıdı; yatay taşma yok.

## Faz 5.2: akıllı deneme

**İstek:** `generate-exam` gövdesinde `adaptive: { daysToExam }`.

**Masa:** aynı ders etiketi (kartın `course_tag`'i ya da dersin kodu), etiket yoksa aynı kart. Ekrandaki karne masasıyla aynı gruplama.

**Plan** (`buildAdaptivePlan`):
- Tekrar zamanı gelenler en çok üçte bir.
- Yeni konular (kaynağın henüz sorulmamış terimleri) en çok beşte bir. Sınava 7 gün ya da daha az kaldıysa yeni konu yok.
- 5 ve üstü soruda bir pekiştirme sorusu: tekrar zamanı gelmemiş güçlü konudan, zor.
- Kalanı zayıf ve tanıdık konular; en zayıflar ikinci soru alır. Konu başına en çok iki soru.
- Zorluk: zayıf kolay, tanıdık orta, yetkin ve usta zor. Tekrar sorusu, hafıza %60 altındaysa orta, değilse zor. Yeni konu orta.
- Sıra kolaydan zora; aynı konu yan yana gelmez.

**İstemde:** `ADAPTIVE PLAN` satırları. Her satırda konu adı birebir, zorluk ve neden. Takip isteklerine yalnızca karşılanmamış satırlar gider. Akıllı denemede odak konu kullanılmaz.

**Kayıt:**
- Soru başına zorluk plandan damgalanır.
- Plan `exams.scoring.adaptive` içinde saklanır (`plan`, `days_to_exam`); migration yok.

**Model:** sunucudaki `conceptMastery`, `exam-engine`'dekinin TypeScript kopyası. `tests/exam-adaptive.js` iki uygulamayı aynı girdilerde karşılaştırır.

**Ekran:**
- **Kurulum penceresi:** "akıllı deneme" kutusu odak konunun altında. Açıkken odak konu ve zorluk soluklaşır; kapakta `AKILLI: konular ustalığına göre · sınava N gün`, alt satırda "zorluk konuya göre". Sınava kalan gün, sınav takviminde masa adıyla eşleşen en yakın sınavdan gelir.
- **Ustalık haritası:**
  - "akıllı deneme kur" düğmesi seçili masa için; "tümü"nde en öncelikli konunun masası için.
  - "bu konudan deneme" artık belge masalarında da var (odak konu kartlı sınavda da gönderilir).
- **Sonuç kâğıdı ve deneme listesi:** "akıllı deneme" başlığı. Her sorunun yanında neden: zayıf konu, tekrar zamanı, yeni konu, pekiştirme.

**Test:**
- `tests/exam-adaptive.js`: 7 test.
- Tarayıcı (`run16`): kısayol, kapak, istek gövdesi, belge masası odak konusu, sonuç kâğıdı etiketleri.

**Deploy:** `generate-exam` otomatik (GitHub Actions); ön yüz Vercel.

## Faz 5.3: güven işareti ve tekrar takvimi

**"Emin değilim" işareti:** sınavdaki mevcut **"işaretle"** düğmesi kullanılır. Öğrenciye zaten "emin olmadığını işaretle, sonra dön" diye anlatılıyordu; ikinci bir düğme eklenmedi. Sınav girişindeki açıklamaya "işaretli doğrular konu ustalığına daha az katkı yapar" eklendi.
- `grade-exam` → `markConfidence`: sonuçlara `flagged` ve `hint_used` yazılır (yalnızca true olanlar). Eskiden yalnızca `question_attempts`'te duruyordu.
- **Ustalık modeli** (iki kopya):
  - İşaretli doğru ×0,6, ipucuyla gelen doğru ×0,5 kanıt (Pearson DSM; Khan Academy'de ipucu ustalık saymaz).
  - Yanlış cevapta işaret fark etmez.
  - İşaretli 3 doğru "yetkin" yapmaz.

**Tekrar takvimi** (`exam-engine` → `reviewSchedule`):
- Yetkin ve usta konularda hafızanın %80'e ineceği gün: t* = S · 81/19 · (0,8⁻² − 1).
- Geçmiş tarih bugüne çekilir; 60 günün ötesi gösterilmez.
- **Ustalık haritası:** "sıradaki tekrarlar" satırı (bugün, yarın, N gün sonra, tarih) ve **"planlayıcıya ekle"** düğmesi. En çok 12 "Tekrar zamanı: …" hedefi eklenir (`study_events`, `goal`); aynı başlıklı açık hedef varsa eklenmez. Düğme öğrenci isteğiyle çalışır, planlayıcı kendiliğinden dolmaz.
- **Bildirim çanı** (`gatherNotificationItems`): günü gelen "Tekrar zamanı" hedefi bir kez bildirim olur ("hafızan %80'in altına indi; kısa bir akıllı deneme yeter"); tıklayınca sınav salonu açılır.

**Sınav ekranından atılma bildirimi (27.10.2026):** çizim aracında hata yok.
- **Sebep:** canlı test, öğrencinin kullandığı sekmede sayfayı yenileyip yeni sınav kurdu.
- **Deneme:** test ortamında ve canlıda ayrı sekmede 14 düzenleme adımı (seç, sürükle, koordinat + Enter/Tab, etiket, kesikli, Delete/Backspace, geri al, sil, Esc) denendi; sınav kapanmadı.
- **Sonuç:** öğrencinin sınavı taslaktan "Yarım kalan bir sınavın var → Devam et" ile dönülebilir durumda.
- **Kural:** canlı testler artık ayrı sekmede yapılıyor.

**Test:**
- `tests/exam-mastery.js`: 12 test.
- `tests/exam-adaptive.js`: model eşliği işaretli ve ipuçlu verilerle de denetleniyor.
- Tarayıcı: `run17` (çizim düzenleme), `run18` (tekrar satırı ve planlayıcı).

**Deploy:** `grade-exam`, `generate-exam` otomatik; ön yüz Vercel.
