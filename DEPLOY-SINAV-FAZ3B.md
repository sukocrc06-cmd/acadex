# Sınav Platformu — Faz 3b: cebirsel ifade sorusu

Hesaplama sınavına yeni bir soru tipi geldi: **ifade** (`expression`). Cevap bir sayı değil, cebirsel bir ifade. Örnekler: çarpanlara ayır, parantezleri aç, sadeleştir, türev al, belirsiz integral.

## Nasıl çalışır

- **Üretim (`generate-exam`):** model ifade sorusunu yalnızca kaynak belge sembolik cebir ya da analiz öğretiyorsa yazar; finans, istatistik ve tablo fonksiyonlarında yazmaz. Her soru için verdiği alanlar:
  - `correct_answer`: ASCII ifade
  - `expr_vars`: değişkenler
  - `form`: istenen biçim (`factored` / `expanded` / `simplified` / `any`)
  - `given`: dönüştürülecek ifade
  - `up_to_constant`: belirsiz integralde `true`

  Referans ifade kodla açılır ve örnek noktalarda hesaplanabilmeli. İstenen biçime kendisi uymalı ve verilen ifadenin aynısı olmamalı; değilse soru atılır (`expr_*` nedenleri).
- **Öğrenci girişi:**
  - Metin alanı ve sembol tuşları (değişkenler, `^ √ π ( ) / sin cos ln`).
  - Yazdıkça KaTeX önizleme; okunamayan yazımda ne yapılacağını söyleyen uyarı.
  - Doğal yazım kabul edilir: `2x(x+1)`, `sinx`, `sin²x`, `√x`, `x²`, `0,5x`, `xy`.
  - MathLive kullanılmadı: yaklaşık 1 MB ek yük getirirdi, KaTeX zaten yüklü.
- **Notlama (`grade-exam`):** LLM yok, rastgelelik yok. Öğrencinin ifadesi açılır ve 10 sabit örnek noktada referansla karşılaştırılır.

  | Durum | Puan |
  |---|---|
  | Denk ve istenen biçimde | 100 |
  | Denk ama biçim yanlış (ör. "çarpanlarına ayır"da açık hâli yazmak) | 50 |
  | Verilen ifadeyi aynen yazmak, denk olmayan ya da okunamayan cevap | 0 |
  | Belirsiz integral | Herhangi bir sabit farkı ve "+ C" kabul |
  | Referans hesaplanamazsa | Soru nota katılmaz |

- **Sonuç kâğıdı:** öğrencinin cevabı ve doğrusu matematik olarak gösterilir; çözüm adımları da gösterilir.

## Mevcut işleyişe etkisi

- **Var olan tipler değişmedi:** çoktan seçmeli, doğru-yanlış, boşluk, klasik ve hesap.
- **Hesaplayıcıya trigonometri eklendi:** `sin cos tan asin acos atan`. Hesap formülleri için yalnızca ek bir olanak.
- **Hesap içermeyen belgeler:** hesaplama sınavı eskisi gibi; model bu belgelerde ifade sorusu yazmaz, yazarsa doğrulamada elenir.
- **Karışık ve test sınavları:** ifade sorusuna izin yok.
- **İtiraz:** ifade sorusunda itiraz yok (notlama kodla), "soru hatalı" bildirimi var.
- **Migration yok.**

## Deploy (sıra önemli)

1. **`grade-exam`** önce. İfade sorusunu notlayabilmesi için gerekli.
2. **`generate-exam`** sonra.
   - Ters sırada deploy edilirse ifade sorusu olan bir sınav notlanırken o soru sonuçta görünmez.
3. **Ön yüz:** PR birleşince Vercel'den kendiliğinden çıkar.

## Elle kontrol

- [ ] Cebir ya da türev içeren bir belgeyle hesaplama sınavı kur; sorulardan bazıları "ifade" tipinde gelmeli. Finans belgesinde hiç gelmemeli.
- [ ] Salonda sembol tuşları ve klavye birlikte çalışır; önizleme yazdıkça güncellenir; eksik parantezde uyarı çıkar.
- [ ] Bir soruyu denk ama farklı yazımla (ör. `2x sinx + x²cosx`), birini biçim hatasıyla, birini yanlış cevapla.
  - Sonuçta sırasıyla 100, 50 ve 0 puan.
  - Cevaplar ve doğrusu matematik olarak görünür.
