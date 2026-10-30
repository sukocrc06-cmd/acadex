# Acadex Proje Kuralları, Mimari Harita ve Token Optimizasyon Rehberi

## 1. Mimari & Stack
- **Yapı:** Next.js veya framework YOK — Vanilla HTML/CSS/JS + Supabase Edge Functions (Deno) + Vercel.
- **Ortam:** Windows (Node.js `D:\Program Files\nodejs` altında).

## 2. Token & Kota Tasarrufu Kuralları (Zorunlu)
- **Asla Tüm Dosyayı Yazma:** Açıkça istemediğim sürece hiçbir dosyanın tamamını baştan üretme. Sadece ilgili fonksiyonu/bloğu/satırı yerinde düzenle.
- **Doğrudan Kod Odaklı Ol:** Uzun açıklama yapma, temel programlama mantığını anlatma.
- **Klasör ve Büyük Dosya Tarama Sınırı:** Projenin tamamını tarama. 500 KB üstü devasa dosyalarda (`dashboard.js`, `acadex-ink.js`, `index.ts`) asla tam okuma yapma. Hedef fonksiyonu veya sınıfı bulup sadece ilgili 50-100 satırlık aralığı oku ve düzenle.
- **Windows Uyumluluğu:** Sistem Windows olduğu için doğrudan Linux `sed` komutu çalıştırıp hata alma; dosya içi aramalarda MCP `filesystem` araçlarını, Node.js tek satırlık scriptlerini veya PowerShell (`Select-String`) yapılarını kullan.
- **MCP Ajan Kullanımı:** Kütüphane/Supabase API'si eklerken ezbere gitme (`context7` kullan). Karmaşık mimari değişikliklerde önce `sequential-thinking` ile plan yap, öğrendiğin yeni kritik proje kurallarını `memory` ajanına kaydet.

## 3. Çalışma ve Güvenlik Prensibi
- Mevcut dosya yapısına, isimlendirmeye ve kod stiline birebir sadık kal. Ekstra soyutlama katmanı uydurma.
- **Ürün kuralı:** Platformda insan öğretmen yok; "hocaya sor" yalnızca Acadex'in kendi sistemidir. Öğretmen, sınıf, ödev ya da "öğretmene ilet" özelliği ekleme (`tests/sinav-kaydi-koruma.js` bunu denetler).
- **Git & Branch Güvenliği:** Benden habersiz `git push` yapma veya `main` branch'ini doğrudan tehlikeye atacak yıkıcı komutlar çalıştırma.

---

## 4. HANGİ DOSYA NEYİ ÇİZİYOR (UI Değişikliğinde Önce Buraya Bak)

> **Kritik Ders:** Formül kartı düzeltmesi `dashboard.js`'e yapıldı, ekranda hiçbir şey değişmedi — çünkü o kartı başka dosya çiziyor. UI düzeltmesi istendiğinde önce ekrandaki sınıf adını (`axr-vars`, `axr-tex` gibi) `js/` içinde ara, kartı üreten dosyayı **doğrula**, sonra yaz.

| Ne | Nerede |
|---|---|
| **Özet kartı ekran görünümü** (formül/tablo/örnek kartları, `axr-*` sınıfları) | `js/acadex-ink.js` → `formulaCard`, `exampleCard`, `tableCard` |
| **Eski kart tasarımı** (`.formula-card`, `.formula-vars-list`) | `js/dashboard.js` ~3040 — **ekranda görünmüyor**, dokunmadan önce iki kez düşün |
| **PDF indir** (tek kart) | `js/dashboard.js` → `appendStudyCardToDoc`; tipografi `PDF_TYPE` sabitinden |
| **Toplu PDF** ("Hepsini PDF yap") | `js/dashboard.js` → `exportAllFilteredCardsToPDF` |
| **Kapak + üst/alt şerit** | `buildPdfCoverPage`, `applyBrandedLayout` |
| **Özet üretimi** (Gemini/Groq, kapılar, atıflar) | `supabase/functions/summarize-document/index.ts` |
| **Haftalık Acadex önerisi** (sınav salonu, `sn-acx`, `[data-acx]`) | `js/acadex-ink.js` → `haftalık Acadex önerisi` bloğu (`acadexWeekly`, `paintAcx`) |
| **Adım adım yardım** (sınavda `sn-help*`, `[data-help]`) | ekran `js/acadex-ink.js` → `FAZ 7: adım adım yardım` bloğu; sunucu `generate-exam` → `handleExamHelp` (`{ help }`); puan tavanı `grade-exam` → `applyHelp` |
| **Hata defteri / ikinci şans** (`sn-eg`, `[data-second]`, `sn-mk`) | ekran `js/acadex-ink.js` → `paintErrs`; takvim `exam-engine` → `mistakeStates`; sınav `generate-exam` → `handleExamRetry` (`{ retry }`); grafik `retryChartVariant`, çizim/ifade modelle |
| **Süre ve strateji raporu** (sonuçta `sn-tim`) | kayıt `js/acadex-ink.js` → `FAZ 9: süre ve strateji` (`TIM`, `window.__examTiming`); sunucu `grade-exam` → `applyTiming`; rapor `exam-engine` → `timingReport` |
| **Hata defteri hatırlatması** (bildirim çanı) | `js/dashboard.js` → `gatherNotificationItems` (1c); `exam-engine` → `mistakeReminder` |
| **Sınav günü hazırlığı** (`sn-rdy`, `[data-rdy]`) | `js/acadex-ink.js` → `FAZ 10: sınav günü hazırlığı` (`paintRdy`); `exam-engine` → `examReadiness` |

---

## 5. DEPLOY — Ne Nereye Gider

| Değişen | Nasıl Yayına Girer |
|---|---|
| `supabase/functions/{generate-exam,grade-exam,extract-chart-items,exam-appeal,get-exam-hint}/index.ts` | **Otomatik:** main'e birleşince GitHub Actions (`.github/workflows/deploy-exam-functions.yml`); canlı kod panelden değiştirilmişse deploy etmez |
| Öteki `supabase/functions/**/index.ts` | **Elle:** Supabase panelinden kopyala-yapıştır |
| `supabase/migrations/*.sql` | **Elle:** Supabase SQL Editor |
| `js/`, `css/`, `*.html` | **Push:** GitHub Desktop üzerinden → Vercel otomatik |
| `tests/` | Hiçbir yere deploy edilmez, sadece yerelde koşar |

- Push işlemleri GitHub Desktop üzerinden kontrol edilerek yapılır.
- Büyük dosyalar (`index.ts` 523 KB, `dashboard.js` 845 KB) GitHub API ile **push edilemez** — yerel dosya sistemi (`filesystem`) üzerinden düzenlenmelidir.

---

## 6. DOSYA BOYUTLARI — Bütün Okuma Yasaktır!

```text
css/acadex-ink.css   974 KB
js/acadex-ink.js     921 KB  (9.018 satır)
js/dashboard.js      845 KB  (20.121 satır)
index.ts             523 KB  (10.308 satır)
css/style.css        136 KB
```

**Kural:** Bu dosyaların hiçbiri baştan sona okunmaz! Önce aranacak metnin/fonksiyonun satır numarasını tespit et, ardından sadece ilgili satır aralığını oku.

---

## 7. TESTLER

```bash
node tests/run-all.js          # tamamı (18 dosya, ~760 test)
node tests/<dosya>.js          # iterasyon sırasında SADECE ilgili dosya
```

- **devDependencies:** `typescript@^5` ve `jspdf`. TypeScript **7 kurulmaz** — JS API'si farklı (`ts.ScriptTarget` yok) ve kaynak okuyan 13 test dosyasını düşürür.
- `tests/pdf-export.js` gerçek jsPDF ile PDF üretir, metni `pdftotext` (poppler) ile geri okur.
- Testler kaynağı `tests/_ts-extract.js` üzerinden okur; o dosya **CRLF → LF normalize eder**. Repo blob'ları CRLF taşıyor, aksi halde çok satırlı regex kontrolleri kaynak doğruyken düşer.
- Bir düzeltme yaptıysan onu teste bağla; bu repoda testler "neyin neden böyle olduğunu" tutan yerdir.

---

## 8. GEMINI ÖZET YOLU — Bilinmesi Gerekenler

- `GEMINI_MODE` secret'i: `only` (canlıda bu), `shadow`, `parallel`. `parallel` ücretli katman varsayar.
- Ücretsiz katman: **RPD 20, RPM 5**. Hedef: koşu başına **tek POST**. `GEMINI_MAX_REQUESTS_PER_RUN` bunu koruyor.
- Yüzey `stream: true`'yu reddetmiyor ama **yok sayıyor**: yanıt tek parça, ölçülen 88–111 sn. Bu yüzden `GEMINI_FIRST_BYTE_MS` (ilk byte) ile `GEMINI_SILENCE_MS` (olaylar arası) **ayrı** sayaçlar.
- Her akışlı çağrı tek satır ölçüm basar:
  `Gemini akis [model]: ilk byte …ms, ilk olay …ms, N olay … — AKIS GERCEK/SOZDE/YOK`
- `summary_cache` isabeti ~2 sn ve **hiç model çağrısı yok**; aynı dosya + aynı ayarlar ikinci kez özetlenmez. Yeni ölçüm için farklı PDF gerekir.
- Bütçe sabitleri: `GEMINI_ONLY_BUDGET_MS`, `GEMINI_ONLY_MAX_CALL_MS`, `GEMINI_ONLY_FALLBACK_MIN_MS`. Supabase'in sert sınırı ~150 sn.

---

## 9. TEŞHİS YAPARKEN

- Log varsa **önce logu kodla eşleştir**, tahmin yürütme.
- Edge function logunda zaman damgaları mikrosaniyedir; ilk `Istek alindi` satırını sıfır kabul edip çıkarırsan gerçek süre çizelgesi çıkar.
- Bir UI hatasında "düzelttim" demeden önce o kodun **gerçekten ekrana çizen yol** olduğunu doğrula (bkz. Bölüm 4).