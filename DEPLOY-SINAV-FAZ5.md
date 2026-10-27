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

## Sıradaki

- **5.2 akıllı deneme:** sınav kendiliğinden kurulur. Zayıf konular ağırlıklı, zamanı gelen tekrarlar ve konu başına zorluk; sınav takvimindeki yakın sınav önceliği etkiler. Belge masalarında da "bu konudan deneme".
- **5.3:** tekrar zamanı gelen konular planlayıcıya ve bildirimlere; sorularda "emin değilim" işareti.
