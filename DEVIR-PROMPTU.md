Acadex projesinde `summarize-document` (özet motoru) üzerinde çalışıyoruz. Önceki oturum bağlam dolduğu için kapandı; bu prompt onun devri. CLAUDE.md ve memory (MEMORY.md) otomatik yükleniyor — önce onları oku, kurallar orada. Aşağıdaki her sayı canlı logdan ölçüldü, tahmin değil.

# KAPSAM VE ÇALIŞMA KURALLARI

- YALNIZCA `supabase/functions/summarize-document/index.ts` ve onun çizim/test yolları (`js/acadex-ink.js`, `js/dashboard.js`'in özet kartı kısımları, `css/acadex-ink.css`, ilgili `tests/`). Sınav (`generate-exam`, `grade-exam`, `exam-*`), sunum, podcast kodları BAŞKA EKİBİN — dokunma.
- Büyük dosyaları (index.ts ~600 KB / 11.700 satır, acadex-ink.js 921 KB, dashboard.js 845 KB) asla baştan sona okuma: grep ile satırı bul, 50-150 satır oku.
- Deploy: `index.ts` → Supabase paneline ben elle yapıştırıyorum. `js/`, `css/` → GitHub Desktop push → Vercel. Push'u ben yapıyorum; sen commit/push yapma, sorarsam yap.
- Her düzeltmeyi teste bağla (bu repoda testler gerekçeleri tutar). `node tests/run-all.js` → şu an 32 dosya, 1096 test geçiyor; TEK kırmızı `exam-feedback.js` paritesi ("atif motoru generate-exam ve summarize-document te birebir ayni") — bilinçli, sınav ekibine bildirildi, generate-exam'a dokunma ve o testi zayıflatma.
- Paralel alt-ajan denetimi bu projede iyi sonuç verdi; geniş taramada kullanabilirsin ama ajanların iddialarını kodda/ölçümle DOĞRULA (önceki oturumda iki ajan iddiası yanlış çıktı).

# HEDEFLERİM

1. **Gemini her durumda çalışsın ve stabil olsun.** Groq'a YALNIZCA çok acil durumda (Gemini kotası bitti / bütün Gemini modelleri gerçekten erişilemez) düşülsün. Şu an Gemini'nin her başarısızlığı (503, ölü akış) doğrudan Groq'a düşürüyor — bunu "önce diğer Gemini modellerini dene, Groq son çare" mantığına çevir.
2. **Özet kalitesindeki başarısızlıkları incele ve çöz** (aşağıda ölçülü liste). Not: `tests/summary-quality.js` şu an yeşil; "başarısızlık"tan kastım KARTIN kalitesi.

# SON CANLI KOŞU (24.10.2026, koşu 37) — 109 sn

Belge: IPPT_Dummy test dosyamız (42 sayfa slayt, İngilizce ekonometri, textLen 14.465, görsel analiz açık, `gemini_mode=only`). Zaman çizelgesi (t=0 `Istek alindi`):

- t=1,5 Gemini çağrısı (tavan 105.000 ms, bütçe 143.504 ms)
- t=16,9 `Gemini baslik suresi: 15292ms (HTTP 200)` + `ilk byte icerigi: ": keep-alive"` → başlıklar sunucuda 15,3 sn bekletiliyor (bu GERÇEK sunucu maliyeti; Files API ile azalır mı henüz ölçülmedi)
- t=88,9 `gemini-3.8-flash: gecici hata 0 (akis olu: olay gelmedi)` — 72 sn hiç olay yok, 0 karakter
- t=91,4 `toplam tavandan geriye 15195ms kaldi — yeni deneme baslatilmiyor` → **3.7 HİÇ DENENMEDİ**, Groq'a düşüldü
- t=97,4 iki Groq penceresi: W1 [gpt-oss-120b] kapsama %67, W2 [gpt-oss-20b] %46
- t=99,4 compact synthesis ÜÇ kez reddedildi (aşağıda neden)
- t=108,6 görsel yama + birleşim (%67)
- t=108,7 `anlati yazari atlandi (pacer 46926ms)` ve `Review atlandi (pacer 46875ms)`
- t=109,1 kart: sayısal kapsama 26/39 (%67), yoğunluk 2/29, grounding %94 (3 uydurma terim atıldı: Reference category, Intercept shift, Slope difference), `summary_cache: yazilmadi` (doğru — zayıf kart kalıcılaşmadı)

Kartın PDF'i (15 sayfa): ÖZET bölümü iki pencere özetinin alt alta yapıştırılmış hali ("This part introduces…" + "This section explains…") — anlatı yazarı yok. Belge iskeleti 25 madde. Ekranda "kaynağa bağlı" / "kalite kontrolünden geçti" rozetleri yok (review atlandığı için `quality_gate` yok). Okuma ~2 dk; kullanıcının "iyiydi" dediği eski kart: ~4 dk, 4 bölüm, 19 kavram, iki yeşil rozet.

PDF metin çıktısında Türkçe karakterler eksik: "BELGE SKELET", "ANAHTAR TERMLER", "DYAGRAMLAR", "BOLUK DOLDURMA", "Oluturulma", "ngilizce". pdftotext artefaktı mı yoksa jsPDF font sorunu mu (görselde de eksik mi) DOĞRULANMADI — `appendStudyCardToDoc` / `PDF_TYPE` (dashboard.js) ve `tests/pdf-export.js`'e bak.

# KÖK NEDENLER (ölçülü)

**A. gemini-3.8-flash güvenilmez, ve ölü akış bütün Gemini bütçesini yiyor.**
- Bugünkü bütün loglar: 3.8 → 503, 503, ölü akış, ölü akış (0/4). 3.7 → 503 almadığı her denemede gerçek akış (290 / 392 / 517 olay, 25-40 KB, ilk olay 17-60 sn).
- Supabase'de `GEMINI_MODEL=gemini-3.8-flash` secret'i tanımlı (önceki oturumda ben önermiştim) → 3.8 ilk aday. Bu secret SİLİNMELİ ya da kod 3.8'i arkaya almalı.
- Ölü akış = ilk byte ~15,3 sn + `GEMINI_ILK_OLAY_MS` 72 sn ≈ 87 sn. Toplam tavan `geminiToplamTavan` = `GEMINI_ONLY_MAX_CALL_MS` 105 sn → ikinci modele 15 sn kalıyor, yetmiyor. Supabase sert sınırı ~150 sn.
- Ölçülen ilk-olay süreleri: 17.524 / 26.132 / 29.948 / 60.166 ms. 60 sn olanı çıktı bütçesi ve kapsam bandı küçültülmeden ÖNCEKİ koşu; sonrakiler 17-30 sn. Yani 72 sn eşiği muhtemelen artık fazla cömert — ama 4 veri noktasıyla kısmak canlı akışı kesme riski taşıyor; karar ölçümle verilmeli.
- Seçenekler (birleştirilebilir): (1) aday sırası/secret; (2) ilk-olay eşiğini ölçülen dağılıma göre kısıp ikinci Gemini modeline bütçe bırakmak; (3) model yarışı — kod HAZIR ama kapalı (`GEMINI_YARIS_GENISLIGI` secret'i, varsayılan 1; 2 yazınca açılır). Yarış her koşuda +1 RPD harcar ve "terminal olmayan durumda sonraki aday denenmez" korumasıyla çelişir (`tests/gemini-dayaniklilik.js`); kullanıcı kotayı korumak için kapalı istedi. (4) Groq'a düşme koşulunu "yalnızca kota/tüm modeller erişilemez" ile sınırlamak — `GEMINI_ONLY_FALLBACK_MIN_MS` ve `cik()`/`denemeSonucunuIsle` akışı.
- Gemini ücretsiz katman: model başına RPD 20, RPM 5 (CLAUDE.md §8). `GEMINI_MAX_REQUESTS_PER_RUN = 6`.

**B. Groq yolunda yazar ve review her koşuda atlanıyor (şerit kapasitesi).**
- Groq ücretsiz: model başına TPM 8000, `PACER_SAFETY 0.9` → şerit bütçesi 7200. İki şerit: `MODEL_HEAVY` gpt-oss-120b, `MODEL_EXTRACT` gpt-oss-20b. İki pencere ~5700 ve ~6100 token yiyor → boşluk 1100-1450. Yazar (~7000 est) ve review (~6850 est) sığmıyor, ~47-49 sn tam şerit dönüşü bekliyor; bütçe ~36-39 sn kaldığı için ikisi de atlanıyor.
- Talep ~18.800 token, iki şeridin dakikalık kapasitesi 14.400 → bir şerit dönüşü matematiksel olarak zorunlu. Pencereleri aynı şeride sıralamak YARAMIYOR (hesaplandı, 3 sn daha kötü).
- Çözüm adayları: üçüncü bir gpt-oss şeridi (önce `observeHeaders` ile ayrı TPM kovası aldığını teyit et; `MODEL_FAST` qwen OTPM 850 olduğu için pencereye uygun DEĞİL); ya da hedef 1 doğrultusunda yazar/review'u Gemini'ye almak (`GEMINI_MODE=parallel` / `groqViaGemini` mevcut, ama RPD 20 kotasını hızla yer).

**C. Compact synthesis her koşuda reddediliyor — iki düzeltmem çelişiyor.**
- Pacer beklemesini kaldırmak için `synCompletion` 2048 → 768 yapıldı. Ama sentezin kendi tabanını (`NARRATIVE_MIN_KEEP_RATIO` 0.75, içerik ölçüsü) geçmesi için ~1500 token gerekiyor. Koşu 37: `bolumleri (icerik) 688 < 2180×0.75`, `ozeti 803 < 1600×0.75`, `anahati 3 < 25×0.75` → boşa giden çağrı.
- 1500'e çıkarmak beklemeyi geri getirir (est ≈ 1466 > boşluk). Kapasite çözümüyle (B) birlikte ele alınmalı.
- Not: bölümler için ölçü bilinçli olarak SAYI değil İÇERİK (sentez 7 bölümü 4'e toplayabilmeli — kullanıcının iyi kartı 4 bölümdü).

**D. Sonraki kalite kalemleri (doğrulanmış, henüz düzeltilmedi)**
- `anchorTerms` sayı körlüğü: `w.length >= 4` filtresi `%9.3` → `9`,`3` → ikisi de düşüyor; atıf eşlemesi (`unanchored` 8-16) ve near-duplicate'i etkiliyor. Ayrıca `anchorClaimToPage` ile `bestQuoteForClaim` bilinmeyen terime farklı idf ağırlığı veriyor (`log(N+1)` vs `log(2)`). Eşik kalibrasyonu (`ANCHOR_MIN_SCORE` 0.42, `ANCHOR_MIN_TERMS` 3) gerektiriyor — önce/sonra ölçümle yap; dosyanın ilkesi "yanlış atıf, eksik atıftan kötüdür".
- Pencere 2 sistematik olarak zayıf 20b modeline düşüyor (W2 kapsaması hep %46 civarı).
- `compactWindowPrompt`: caption ve "worked cases" kuralları yalnızca `total === 1` iken prompta giriyor; 2+ pencerede gönderilmiyor (sayısal kapsamayı besleyen kural).
- Uzun-belge yolunda `document_type: 'Lecture Notes/Slides'` ve `suggested_course_tag: null` sabit.
- Çıktı bütçesi `GEMINI_CIKTI_BUTCESI_KRK = 30_000` canlıda hiç sınanmadı (Gemini o günden beri tamamlanmadı).

# KOD HARİTASI (index.ts güncel satırları, b7f325b)

`MODEL_HEAVY` 1064 · `MODEL_FAST` 1071 · `MODEL_EXTRACT` 1089 · `PACER_SAFETY` 1594 · `DEFAULT_TPM_LIMIT` 1620 · `GEMINI_MODEL_CANDIDATES` 5592 · `GEMINI_ONLY_FALLBACK_MIN_MS` 5979 · `GEMINI_MAX_REQUESTS_PER_RUN` 5988 · `geminiYarisGenisligi` 6032 · `GEMINI_ARDISIK_GECICI_MAX` 6055 · `GEMINI_ONLY_BUDGET_MS` / `GEMINI_ONLY_MAX_CALL_MS` 6084-6085 · `geminiModelCandidates` 6110 · `GEMINI_CIKTI_BUTCESI_KRK` 6248 · `geminiCoverageQuota` 6269 · `GEMINI_ILK_OLAY_MS` 6563 · `geminiDraft` 7217 · `geminiToplamTavan` 7349 · `denemeSonucunuIsle` (her denemenin sonucunu işleyen TEK yer, yarış da kullanıyor) 7377 · `oluAkis` 7623 · Groq'a düşüş logu 8799 · `synCompletion` 9864 · `writerCompletion` 10638 · `Review atlandi` 10777 · `onbellegeYazilabilir` 11648.

# ÖNCEKİ OTURUMDA ÖĞRENİLENLER (tekrar yaşama)

- Yeni modül-düzeyi sembol eklersen test sandbox'larının `loadFromSource` listelerine de ekle (`gemini-shadow.js`, `gemini-dayaniklilik.js`, `summary-quality.js`, `citation-anchoring.js`, `footnote-rendering.js`, `pdf-export.js`), yoksa "X is not defined". `summary-quality.js`'te YALNIZCA tek `loadFromSource` olmalı (dosyanın kendi kuralı).
- `tests/scope-check.js` tanımsız isimleri yakalar (ör. `arr` acadex-ink yardımcısı, index.ts'te YOK).
- Ters bölü içeren betikleri `node -e` ile değil scratchpad'e dosya olarak yazıp koştur (kabuk kaçışları bozuyor).
- Toplu `return null` değiştirmesi gibi işlemlerde yardımcının KENDİ gövdesini de değiştirme (önceki oturumda `cik()` kendini çağırdı).
- `index.ts` git blob'u LF; CRLF'e çevirme (bütün dosya diff'e düşer).
- "Push edilmemiş" demeden önce `git fetch` yap (yerel origin bilgisi eskiyebiliyor).
- Deploy sonrası panelde `tryOCR`'ın kapanış parantezinden sonra yapışmış log olmadığını kontrol et (bir kez 317 satır log yapışmıştı).
- Önbellek anahtarı `[içerikHash, dil, stil, uzunluk, v/nv, c1]`. Taze ölçüm için arayüzde uzunluk/stil değiştir ya da satırı sil. IPPT dosyasının `v` satırları:
  `231eb9e17d522b74e14775025dfab8af9f0a69a4e56590a0da57b620cf964e5a:en:standard:medium:v:c1` ve `tabfea1792b82fe9f04770be11eb02618a742c547aba6b1958f4c8c624ae3a6ff:en:standard:medium:v:c1`. 18 Ekim'deki `…:nv:c1` satırını (hit_count 8, görsel kapalı) SİLME.
- Sayıları ve iddiaları her zaman logla eşleştir; "düzelttim" demeden önce kodun gerçekten çizen/çalışan yol olduğunu doğrula (CLAUDE.md §4, §9).

# DURUM

- Çalışma ağacı temiz, `HEAD = origin/main = b7f325b`, push bekleyen yok. Canlıdaki `index.ts` bu sürüm (koşu 37'deki `gecici hata 0 (akis olu…)` ve `bolumleri (icerik)` satırları bunu doğruluyor). `js/`/`css/` değişiklikleri (XSS kaçırma, kalite uyarı rozetleri, LaTeX ayıraçları, sayı kutusu eksi işareti) GitHub'da; ekranda görünmüyorsa Vercel deploy'u ya da tarayıcı önbelleği kontrol edilmeli.

# İLK İŞ

1. Yukarıdakileri kodla doğrula (özellikle A ve B'deki sayılar ve satırlar).
2. Hedef 1 için bir tasarım öner: Gemini başarısızlıklarında Groq'tan önce diğer Gemini modellerini deneyecek, ölü akışı daha erken yakalayacak ve 150 sn sınırına sığacak akış — kota (RPD 20) ve süre aritmetiğiyle birlikte. Kota/takas içeren kararları bana sor, gerisini uygula.
3. Hedef 2 için B ve C'yi birlikte çöz; D'yi önem sırasına göre ele al.
4. Her değişikliği teste bağla, `node tests/run-all.js` koştur, sonunda Supabase'e gidecek `index.ts`'i ve push edilecek dosyaları söyle.
