# Sınav Platformu — Faz 6: öğretmen sınavı ve ödev

Kullanıcı isteği (27.10.2026): "Öğretmen sınavı / ödev". Kararlar:
- **İkisi birden:** sınıfı olan öğrenci ödevi öğretmenden alır; sınıfı olmayan öğrenciye sistem ödev verir. Sistem ödevi "öğretmen" adıyla sunulmaz.
- **Gizlilik:** öğretmen, sınıfındaki öğrencinin ödev sonuçlarını görür. O dersteki konu ustalığını yalnızca öğrenci izin verirse görür.

Hoca paneli (teacher.html) 19.10.2026'da kaldırılmıştı (`20261019_yonetim_paneli.sql`). Faz 6 öğretmeni ayrı bir sayfayla değil, çalışma masasının sınav salonunda ve dar yetkiyle geri getirir.

## Dilimler

| Dilim | İçerik |
|---|---|
| **6.1** | Öğretmen yetkisi (yönetim paneli), sınıf, katılım kodu, öğrencinin ustalık paylaşım onayı |
| 6.2 | Ödev hazırlama: yapay zekâ taslağı, öğretmenin soru soru düzenlemesi ve onayı, yayın ayarları |
| 6.3 | Öğrenci tarafı: ödev listesi, çözme, son tarih, geç teslim, bildirim; sınıfsız öğrenciye sistem ödevi |
| 6.4 | Sonuçlar, soru analizi, not düzeltme, "öğretmene ilet" itiraz kutusu, CSV |

## Faz 6.1: öğretmen yetkisi, sınıflar, katılım kodu

### Veritabanı (`supabase/migrations/20261027_sinav_faz6_siniflar.sql`)

**Eski geniş politikalar kaldırılır.** 27.10.2026'da canlıda hâlâ duruyorlardı:
- `study_cards_teacher_select_dept`: her öğretmen bütün öğrencilerin kartlarını okuyabiliyordu.
- `exams_teacher_select_dept`, `exams_teacher_update_dept`, `documents_teacher_select_dept`: aynı bölümdeki sınavlar ve belgeler.
- `teacher_materials_teacher_manage_own`.

Öğretmen sayısı 0 olduğu için zararsızdı, ama yetki yeniden verilmeden kapanması gerekiyordu.

**Tablolar:**
- `classes`: sınıfın adı, ders kodu, katılım kodu, katılım açık/kapalı, arşiv.
- `class_members`: kim hangi sınıfta; `share_mastery` öğrencinin ustalık paylaşım onayı (varsayılan kapalı).
- `class_join_fails`: yanlış kod denemeleri.

**Yetki:**
- RLS yalnızca okumaya izin verir: öğretmen kendi sınıflarını, öğrenci üyesi olduğu sınıfları görür.
- Tablolara doğrudan yazma hiçbir rolde yok; bütün yazmalar aşağıdaki fonksiyonlarla.

**Fonksiyonlar:**

| Kim | Fonksiyon | Ne yapar |
|---|---|---|
| Öğretmen | `class_create` | sınıf açar; en çok 30 açık sınıf |
| Öğretmen | `class_update` | ad, ders kodu, katılım aç/kapat, arşiv |
| Öğretmen | `class_new_code` | katılım kodunu yeniler; eski kod çalışmaz, üyeler etkilenmez |
| Öğretmen | `class_roster` | sınıf listesi: ad, numara, bölüm, katılış tarihi, ustalık onayı. E-posta yok; `oauth-…` yer tutucu numara gizli |
| Öğretmen | `class_remove_member` | öğrenciyi sınıftan çıkarır |
| Öğrenci | `class_join` | kodla katılır |
| Öğrenci | `class_leave` | sınıftan ayrılır |
| Öğrenci | `class_set_share` | ustalık paylaşım onayını açar ya da kapatır |
| İkisi | `my_classes` | öğretmenin verdiği ve öğrencinin katıldığı sınıflar |
| Yönetici | `admin_set_teacher` | öğretmen yetkisi verir ya da kaldırır; denetim kaydına `set_is_teacher` yazar. Yetki kalkınca sınıflar yeni öğrenci almaz, kayıtlar silinmez |
| Yönetici | `admin_teacher_status` | öğretmenin yetkisi, sınıf ve öğrenci sayısı |

"Etkin öğretmen" = `is_teacher` açık, askıda değil, erişimi açık. Kullanıcı kendi `is_teacher` alanını değiştiremez; bunu `protect_profile_flags` tetikleyicisi engelliyor.

**Katılım kodu:**
- 6 karakter, 32 harflik alfabe; karışan harfler yok (I, O, 0, 1).
- Rastgele `gen_random_uuid` baytlarından üretilir.
- Öğrenci küçük harf, boşluk ya da tire yazsa da çalışır.

**Kaba kuvvet sınırı:** saatte 20 yanlış kod. Yanlış kodda fonksiyon hata **döndürür**, fırlatmaz; fırlatılsaydı deneme kaydı da geri alınır ve sınır hiç dolmazdı.

### Ekran

**Sınav salonu → "sınıflarım"** (`js/acadex-ink.js`: FAZ 6.1 bloğu, `dashboard.html`, `css/acadex-ink.css`):
- `my_classes` yanıt vermezse (SQL henüz uygulanmamışsa) bölüm gizli kalır. Ön yüz SQL'den önce yayına girse de bir şey bozulmaz.
- **Öğrenci:**
  - Katılım kodu kutusu.
  - Sınıf kartı: ders, öğretmen, katılış tarihi.
  - "öğretmenim bu dersteki konu ustalığımı görebilsin" onayı, varsayılan kapalı.
  - "sınıftan ayrıl": iki kez basınca ayrılır.
- **Öğretmen:**
  - "+ sınıf aç": ad ve ders kodu; ders kodu katalogdan önerilir.
  - Kartta büyük katılım kodu ve "kopyala".
  - Öğrenci sayısı ve ustalık paylaşan sayısı.
  - Öğrenci listesi, katılımı aç/kapat, kodu yenile, düzenle, arşivle (arşiv ayrı bölümde).
  - Katılım kutusu öğretmende listenin altına iner.

**Yönetim paneli** (`js/admin-app.js`): kullanıcı ayrıntısında "Öğretmen yetkisi ver / kaldır". `admin_user_detail` `is_teacher` döndürmediği için ayrı bir RPC kullanılıyor; mevcut fonksiyona dokunulmadı.

### Kurulum (elle)

1. Supabase → SQL Editor → `supabase/migrations/20261027_sinav_faz6_siniflar.sql` dosyasının içeriğini yapıştır → Run. İki kez çalıştırmak zarar vermez.
2. Yönetim paneli → Kullanıcılar → hesap → "Öğretmen yap".
3. Ön yüz: main'e birleşince Vercel kendiliğinden yayınlar.

### Test

- `tests/exam-classes.js`: 13 test. 12'si statik: politikalar, yetkiler, ön yüz ile SQL parametre eşliği.
- **Davranış testi** (`tests/sql/faz6-siniflar.sql`): gerçek Postgres'te RLS ile.
  - öğrenci sınıf açamaz ve kendine yetki veremez
  - doğrudan yazma reddedilir
  - kadroda e-posta yok
  - öğretmen öğrencinin sınav, belge ve kartını göremez
  - başka öğretmen sınıfı göremez ve yönetemez
  - kapalı ya da arşivli sınıfa katılınamaz
  - öğretmen kendi sınıfına katılamaz
  - kaba kuvvet sınırı çalışıyor
  - yetki kalkınca sınıf kapanıyor
  - anon hiçbir şey çağıramıyor
  - migration iki kez çalıştırılabiliyor

  `ACADEX_PG` verilirse koşar.
- **Tarayıcı** (`run19`): öğrenci ve öğretmen akışı; 1280 ve 390 px; yatay taşma yok; liste açılıp kapanınca klavye odağı korunuyor.
