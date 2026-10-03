# Acadex — Academic Development Portal

İşletme fakültesi öğrencileri için AI destekli çalışma platformu. Doküman
yükle → özet, bilgi kartı, sınav, sunum, podcast üret; yüklediğin kaynakla
sohbet et.

---

## Teknoloji

| Katman | Ne kullanılıyor |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — **framework yok, build adımı yok** |
| Backend | Supabase Edge Functions (Deno/TypeScript), 26 fonksiyon |
| Veritabanı | Supabase Postgres + RLS |
| Hosting | Vercel (statik) |
| Dil | TR/EN (`js/i18n.js`) |

Build adımı olmadığı için `js/` ve `css/` dosyaları doğrudan servis edilir.
`vercel.json` bu iki klasöre `no-cache` başlığı koyar, böylece deploy sonrası
tarayıcı eski JS'i tutmaz.

---

## Repo yapısı

```
*.html                      sayfalar (index, dashboard, admin, teacher, login, ...)
js/                         33 modül; dashboard.js tek başına 18.347 satır
css/style.css               tek stil dosyası
supabase/functions/<ad>/    her edge function kendi klasöründe (index.ts)
supabase/migrations/*.sql   şema değişiklikleri — OTOMATIK UYGULANMAZ (aşağıya bak)
tests/                      Node ile çalışan testler (tarayıcı gerekmez)
assets/                     logo, promo video, örnek veri setleri
```

---

## Ortam değişkenleri

Supabase **otomatik sağlar**, elle girmene gerek yok:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Elle girmen gerekenler** (Supabase Dashboard → Edge Functions → Secrets):

| Değişken | Kullanan fonksiyonlar | Ne için |
|---|---|---|
| `GROQ_API_KEY` | 17 fonksiyon (özet, sınav, sohbet, sunum, podcast script…) | Tüm metin üretimi |
| `PDFCO_API_KEY` | `summarize-document` | PDF sayfalarını PNG'ye çevirip görsel analiz (diyagram/şema sayfaları) |
| `OCR_SPACE_API_KEY` | `summarize-document`, `chat-with-document`, `merge-summarize` | Taranmış (metinsiz) PDF'lerde OCR |
| `OPENAI_API_KEY` | `generate-study-image` | Görsel üretimi (`gpt-image-1`) |
| `ELEVENLABS_API_KEY` | `generate-podcast-audio` | Podcast sesi (TTS) |
| `RESEND_API_KEY` | `notify-role-change`, `send-contact-notification` | E-posta bildirimi |
| `ADMIN_NOTIFICATION_EMAIL` | `send-contact-notification` | İletişim formunun gideceği adres |
| `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD` | `send-study-reminders` | Çalışma hatırlatma e-postaları |
| `CAMPUSO_SSO_SECRET`, `ACADEX_APP_URL` | `campuso-sso` | Campuso tek-oturum entegrasyonu |
| `GROQ_PRESENTATION_MODEL` | `acadia-presentation-director` | Sunum motoru için model adı (opsiyonel override) |

Frontend'in Supabase bağlantısı `js/supabase-config.js` içinde **açıkça**
duruyor (URL + publishable anon key). Bu normaldir — güvenlik RLS
politikalarıyla sağlanır, anon key gizli değildir. `SUPABASE_SERVICE_ROLE_KEY`
ise asla frontend'e girmemeli, sadece edge function'larda kullanılır.

### Dış servisler

`api.groq.com` · `api.pdf.co` · `api.ocr.space` · `api.openai.com` ·
`api.elevenlabs.io` · `api.resend.com`

---

## Storage bucket'ları

| Bucket | İçerik | Tanımlandığı yer |
|---|---|---|
| `documents` | öğrencilerin yüklediği ders dosyaları | Dashboard'dan elle oluşturulmuş |
| `avatars` | profil fotoğrafı ve kapak görseli | `20260830d_avatars_storage_bucket.sql` |
| `presentation-images` | sunum görselleri | `20260807_add_academic_presentations.sql` |
| `podcast-audio` | üretilen podcast sesleri | `20260826b_create_podcast_audio_bucket.sql` |
| `course-knowledge-pdfs` | admin kitap tarama PDF'leri (admin-only) | `20260829_add_course_knowledge_base.sql` |

---

## Migration'lar

> **Migration'lar otomatik uygulanmaz.** Her `.sql` dosyasını kendin
> çalıştırmalısın: Supabase Studio → SQL Editor → içeriği yapıştır → Run.
> (CLI kullanıyorsan `supabase db push`.)

Dosyalar **isim sırasına göre** uygulanır — tarih öneki bunun içindir. Harf
sonekli olanlar (`20261003b`) aynı günün ikinci migration'ıdır ve genellikle
bir öncekine bağımlıdır.

Bağımlılık zinciri olan önemli yerler:

- `20261003_add_document_chunks.sql` → `documents` tablosunu gerektirir
- `20261003b_document_chunks_fulltext.sql` → **`20261003`'ü gerektirir**, yoksa
  anlaşılır bir hata verip durur
- `20260810_presentation_intelligence_v10.sql` → `20260807`'yi gerektirir
- `20260829_add_course_knowledge_base.sql` → `courses` tablosunu gerektirir
  (`20260721`)

Migration'ı çalıştırmadan fonksiyonu deploy edersen iş patlamaz ama logda
uyarı görürsün (ilgili kod en iyi gayret mantığıyla yazılmıştır).

---

## Edge function deploy

**Dashboard'dan:** Supabase Dashboard → Edge Functions → fonksiyonu seç →
kodu yapıştır → Deploy.

**CLI ile:**
```bash
supabase functions deploy <fonksiyon-adi>
```

Repo `supabase/.temp/linked-project.json` içinde proje referansını taşıyor
(`ACADEX portal`). CLI kullanacaksan önce `supabase link` gerekebilir.

---

## Testler

Testler Node ile çalışır, tarayıcı veya Supabase bağlantısı gerektirmez.
Edge function'lardaki saf fonksiyonları kaynaktan **çalışma anında çıkarıp**
test ederler — bu dosyalara kopyalanmazlar, yani kaynak değişirse test ya yeni
davranışı ölçer ya açık hata verir.

Tek seferlik kurulum (repoda `package.json` yok):

```bash
printf 'node_modules/\n' > .gitignore     # npm'den ÖNCE
npm init -y
npm install --save-dev typescript
```

Çalıştırma:

```bash
node tests/citation-anchoring.js    # atıf motoru        (38 test)
node tests/chat-retrieval.js        # chat retrieval     (19 test)
node tests/summary-quality.js       # kalite kapıları    (32 test)
```

Edge function'ları tip kontrolünden geçirmek:

```bash
npx tsc --noEmit --skipLibCheck --target es2022 --module esnext \
    --moduleResolution bundler supabase/functions/summarize-document/index.ts
```

Beklenen çıktı: **19 hata, hepsi Deno kaynaklı** (`Cannot find module
'https://deno.land/...'`, `Cannot find name 'Deno'`). Bunlar normaldir —
`tsc` Deno'ya özgü şeyleri bilmez. Sayı 19'dan fazlaysa gerçek bir sorun var.

Groq'a çıkan tek test (API anahtarı ve ücret gerektirir, isteğe bağlı):

```bash
export GROQ_API_KEY=gsk_...
node tests/map-model-compare.js --input ders-notu.pdf --windows 3 --runs 2
node tests/map-model-compare.js --input x.txt --dry-run   # anahtarsız kuru çalıştırma
```

`tests/presentation-*.js` dosyaları repoda **bulunmayan**
`js/presentation/core/*` ve `js/presentation/quality/*` dosyalarını arıyor, bu
yüzden çalışmıyorlar. Bilinen ve eski bir durum.

---

## Bilinen sınırlar

| Sınır | Değer | Nerede |
|---|---|---|
| Yükleme boyutu | 20 MB | `js/dashboard.js` |
| Edge function süresi | ~150 sn (hat kendine 110 sn bütçe ayırır) | `PIPELINE_BUDGET_MS` |
| Groq TPM | bu hesapta **8.000 gözlendi** | kaynak yorumları (`draftTiers`) |
| Özet kapsama | uzun belgede ~42.000 karakter | `MAX_CHUNKS`, pencere döngüsü |

Son satır açık bir sorundur: 150.000 karakterlik bir belgenin yalnızca ~%28'i
modele ulaşır. Düzeltmesi pencere işlemenin birden fazla çağrıya yayılmasını
gerektirir (bu desen admin "Kitap Tarama" sisteminde zaten mevcut).

---

## Özet hattı nasıl çalışıyor

`summarize-document` belge boyutuna göre iki yoldan birini seçer
(`CHUNK_THRESHOLD = 6000` karakter, ~3 sayfa):

**Kısa belge (fast path):** tek Groq çağrısı, isteğe bağlı görsel analiz.

**Uzun belge (long-doc path):** metin 7.000 karakterlik pencerelere bölünür,
her pencere bağımsız analiz edilir, sonuçlar birleştirilir, ardından bir sentez
çağrısı özetleri tek anlatıya dönüştürür.

Her iki yol, kart kaydedilmeden önce aynı kalite adımlarında buluşur:

1. **Formül doğrulama** — render edilemeyecek LaTeX atılır, fazla sarılmış olan onarılır
2. **Temellendirme kapısı** — kaynağın desteklemediği terim/nokta atılır (doğruluk skoru loglanır)
3. **Yakın-kopya birleştirme** — iki pencerenin aynı fikri farklı kelimelerle yazması temizlenir
4. **Atıf bağlama** — her iddia `--- SAYFA N ---` indeksinden hesaplanan sayfaya ve o sayfadaki **birebir cümleye** bağlanır

4. adım modele sorulmaz, hesaplanır: ek token maliyeti yoktur ve uydurma sayfa
numarası üretilemez.

`chat-with-document` ise belge boyutuna göre ya tüm metni ya da soruyla
alakalı pasajları gönderir (PostgreSQL tam metin arama, Türkçe `tsvector`).

> `summarize-document/index.ts` içinde `buildChunkSystemPrompt` ve
> `buildSynthesisSystemPrompt` **bağlı değildir** — eski bir tasarımdan
> kalmışlardır ve `tests/map-model-compare.js` onları kıyas kolu olarak
> kullandığı için saklanıyorlar. Hangi kodun gerçekten çalıştığını dosyanın
> başındaki "WHICH LONG-DOC CODE ACTUALLY RUNS" yorumu anlatır.
