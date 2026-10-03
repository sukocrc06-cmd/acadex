# Bekleyen deploy — kontrol listesi

Repoda deploy edilmemiş **5 iş paketi** var. Hepsi offline doğrulandı (89 test,
tip kontrolü temiz, migration'lar PostgreSQL grameriyle sınandı) ama hiçbiri
gerçek bir belgeyle çalışmadı.

Toplamda deploy edilecek: **2 migration + 2 edge function.**

> Bu dosya geçicidir. Deploy bitip loglar doğrulandıktan sonra silebilirsin.

---

## Sıra önemli

Migration'lar fonksiyonlardan **önce**. İkinci migration birincisine bağımlı.

### 1. Migration: `document_chunks` tablosu

- [ ] Supabase Studio → SQL Editor → yeni sorgu
- [ ] `supabase/migrations/20261003_add_document_chunks.sql` içeriğini yapıştır → **Run**
- [ ] Hata yoksa: Table Editor'de `document_chunks` tablosu görünüyor

### 2. Migration: tam metin arama

- [ ] `supabase/migrations/20261003b_document_chunks_fulltext.sql` içeriğini yapıştır → **Run**
- [ ] Hata yoksa: `document_chunks` tablosunda `tsv` kolonu var

> Bu migration 1. adımı gerektirir. Atlarsan şu hatayı verir:
> `document_chunks tablosu yok. Once 20261003_add_document_chunks.sql migration ini calistirin.`
>
> Ayrıca PostgreSQL'in `turkish` arama konfigürasyonunu gerektirir. Yoksa
> ayrı ve anlaşılır bir hata verir — o durumda bana söyle, `simple`
> konfigürasyonuna düşen bir sürüm yazarım.

### 3. Edge function: `summarize-document`

- [ ] Supabase Dashboard → Edge Functions → `summarize-document`
- [ ] GitHub'daki `supabase/functions/summarize-document/index.ts` dosyasının tamamını kopyala ("Copy raw file")
- [ ] Mevcut kodun yerine yapıştır → **Deploy**

### 4. Edge function: `chat-with-document`

- [ ] `supabase/functions/chat-with-document/index.ts` → kopyala → yapıştır → **Deploy**

---

## Test

### A. Uzun belge özeti

- [ ] Siteye gir, **en az 15-20 sayfalık** bir PDF yükle ve özetle

Kısa belgeler (3 sayfadan az) farklı bir koddan geçer, değişikliklerin çoğunu
göstermez — mutlaka uzun bir belge kullan.

- [ ] Özet çıkınca **Ana Noktalar**'da satır sonlarında `[1]` `[2]` işaretçileri var
- [ ] Bir işaretçinin üstüne gel: sayfa başlığı değil, **kaynaktaki gerçek cümle** görünüyor
- [ ] İşaretçiye tıkla: orijinal belge görüntüleyici o sayfaya gidiyor
- [ ] **Kaynakça** bölümünde maddeler gerçek cümleler + `📄 Sayfa N` etiketi

Eskiden uzun belgelerde bu işaretçiler **hiç çıkmıyordu.** Çıkıyorsa iş tamam.

### B. Chat

- [ ] Aynı belgeye chat'ten bir soru sor
- [ ] Cevap geliyor ve kaynağa dayanıyor

---

## Loglardan bana atman gerekenler

Supabase Dashboard → Edge Functions → fonksiyon → **Logs**

### `summarize-document` (yüklediğin belgenin logunda)

```
document_chunks: ... chunk yazildi (... tanesi sayfa numarali, ort. ... krk)
Formula validation: ... kept, ... repaired, ... dropped
Grounding gate: score=...% terms ... kept / ... dropped, points ... kept / ... dropped
Near-duplicate merge: terms ...→..., points ...→..., quiz ...→...
Citation anchoring: pages=... kept=... demoted=... added=... quoted=... unanchored=...
Long-doc compact: ... window(s), totalChars=..., windowedChars=... (...% of document reachable)
```

### `chat-with-document`

```
chat-with-document strategy=..., sourceText=... chars
```
büyük belgede ek olarak:
```
chat-with-document: retrieval — ... chunk matched, ... ranked, ... chars sent (document total ...), pages=[...]
```

### Bu satırlar neyi söylüyor

| Satır | Ne anlama geliyor |
|---|---|
| `added=` 0'dan büyük | atıflar çalışıyor |
| `quoted=` / `added=` oranı | alıntı eşiği iyi mi; çok düşükse eşiği gevşetiriz |
| `score=` | modelin uydurma oranı; düşükse prompt'a bakmak gerekir |
| `% of document reachable` | **sıradaki işin boyutunu bu belirliyor** |
| `strategy=retrieval` | chat artık 100k'da kesmiyor |
| `Grounding gate ABORTED` | **görürsen bana söyle** — kapının kendisinde sorun var demektir |

---

## Ters giderse

Her değişiklik en iyi gayret mantığıyla yazıldı: bir adım başarısız olursa
hat eski davranışına düşer, öğrencinin özeti yine üretilir.

| Belirti | Olası sebep |
|---|---|
| Logda `document_chunks: ... delete failed` / `insert failed` | 1. migration çalışmamış |
| Logda `search_document_chunks unavailable` | 2. migration çalışmamış (chat eski yoldan devam eder, kırılma yok) |
| Özet hiç çıkmıyor | fonksiyon deploy'u yarım kalmış olabilir; Logs'ta kırmızı satırı bana at |
| Atıf işaretçileri yok | belge 3 sayfadan kısa olabilir (fast path), ya da PDF değil (DOCX'te sayfa kavramı yok) |
| `Grounding gate ABORTED` | kapı güvenlik valfini tetikledi, hiçbir şey atılmadı — bana söyle |

Herhangi bir adımda tıkanırsan logdaki satırı aynen bana at, oradan bakarız.

---

## Deploy sonrası sırada ne var

`% of document reachable` oranı sıradaki büyük işin tasarımını belirliyor:
uzun belgelerde özetin ~42.000 karakterden sonrasını görmemesi sorunu.
Düzeltmesi pencere işlemeyi birden fazla çağrıya yaymak — bu desen admin
"Kitap Tarama" sisteminde zaten var, oradan uyarlanacak.

İsteğe bağlı: `GROQ_API_KEY`'e erişimin olduğunda

```bash
node tests/map-model-compare.js --input ders-notu.pdf --windows 3 --runs 2
```

Bu, hesabın **gerçek** TPM limitini Groq yanıt başlıklarından okur. Kaynaktaki
"8.000 TPM" eski bir denetimden kalma olabilir; tasarımı tahmine değil o rapora
dayandırmak daha doğru olur.
