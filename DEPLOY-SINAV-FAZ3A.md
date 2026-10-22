# Sınav Platformu — Faz 3a: kodla doğrulanan hesap

Hesaplama sorularının cevabını artık **model değil kod** hesaplar.

- **Üretim (`generate-exam`):** model her hesap sorusu için şunları yazar:
  - `variables`: metindeki sayılar, metinde yazıldığı gibi
  - `formula`: izinli işlemler ve fonksiyonlarla bir formül
  - `template`: sorunun `{ad}` yer tutuculu hâli
  - `common_errors`: tipik hatalar ve o hatanın vereceği sonuç
- **Doğrulama:** formül, güvenli bir ifade hesaplayıcısıyla (`evaluateExpression`; `eval` yok, yalnızca sayı, değişken, `+ - * / ^`, parantez ve `sqrt/ln/log/exp/min/max/round…`) hesaplanır. Bulunan sonuç doğru cevap olarak yazılır. Şu sorular **atılır**:
  - formülü yok ya da formülü geçersiz (`calc_no_formula`, `calc_formula_invalid`)
  - değişkenleri metinde geçmiyor (`calc_var_not_in_text`)
  - modelin kendi cevabıyla kodun sonucu %1'den fazla ayrışıyor (`calc_mismatch`)
- **Değerlendirme (`grade-exam`):** öğrencinin yanlış cevabı tipik hatalardan birinin sonucuna uyuyorsa geri bildirime "Olası hata: …" eklenir.
- **Sonuç kâğıdı:**
  - doğrulanan sorularda "cevap, sorunun formülünden kodla hesaplandı" notu
  - **farklı sayılarla tekrar dene:** aynı soru yeni sayılarla tarayıcıda üretilir (LLM çağrısı yok). Cevap anında kontrol edilir; istendiği kadar yeni sayı alınabilir.

## Mevcut işleyişe etkisi

- **Hesap dışı soru tipleri:** dokunulmadı.
- **Eski hesap soruları:** `formula` alanı olmadığı için eskisi gibi değerlendirilir. "Olası hata" ve pratik bloğu çıkmaz.
- **Migration yok:** yeni alanlar `exams.questions` jsonb içinde.
- **Ek token:** hesaplama sınavında soru başına +150 çıktı tokenı (`GEN_TOKENS_CALC_EXTRA`).

## Deploy (sıra önemli)

1. **`grade-exam`** önce. Yeni alanları okur ama eski sınavlarda da çalışır.
2. **`generate-exam`** sonra.
   - Önce `generate-exam` çıkarsa yeni sınavlar yine doğru notlanır; yalnızca "Olası hata" ve pratik bloğu eksik kalır.
3. **Ön yüz:** PR birleşince Vercel'den kendiliğinden çıkar.

## Elle kontrol

- [ ] Hesaplama türünde (ör. faiz/kredi içeren bir belgeyle) 4–6 soruluk sınav kur.
  - Sorular gelmeli.
  - Edge function loglarında atılan soru varsa nedeni `calc_*`.
- [ ] Bir soruyu bilerek yanlış cevapla, birini doğru. Sonuç kâğıdında:
  - "kodla hesaplandı" notu
  - yanlışta varsa "Olası hata"
  - **farklı sayılarla tekrar dene**: yeni soru gelir, yanlış cevap "Olmadı. Doğrusu …", doğru cevap "Doğru!" der
- [ ] Çoktan seçmeli / klasik bir sınav: davranış değişmemeli.
