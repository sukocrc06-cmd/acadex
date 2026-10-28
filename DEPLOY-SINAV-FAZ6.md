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

## Faz 6.2: ödev hazırlama (taslak, düzenleme, yayın)

### Akış
1. Öğretmen sınıf kartındaki "ödevler" bölümünde **"+ ödev hazırla"** der.
2. Sınav kurulum penceresi **taslak kipinde** açılır:
   - Üstte "ödev taslağı · sınıf adı" şeridi görünür.
   - "Akıllı deneme" ve "gerçek sınav provası" gizlenir.
   - Düğmenin adı "taslağı hazırla" olur.
   - "Soruları kendim yazacağım" seçeneği boş bir taslak açar.
3. `generate-exam` `{ assignmentDraft: true }` ile çağrılır:
   - Sorular **cevaplarıyla** öğretmene döner.
   - Sınav kaydı açılmaz ve öğrencinin saatlik sınav sınırına sayılmaz.
   - Yalnızca etkin öğretmene açıktır; saatte 20 taslak sınırı var (`assignment_gen_take`).
4. **Düzenleyici** (`[data-asgdlg]`):
   - Ödev adı ve öğrenciye not.
   - Takvim: açılış, son teslim.
   - Kurallar: süre, deneme hakkı (en yüksek not sayılır), cevapların ne zaman görüneceği, geç teslim (kabul yok ya da günlük % kesinti ve en çok gün), soru/şık sırasını karıştırma, hesap sorularında öğrenciye özel sayılar (yalnızca şablonlu hesap sorusu varsa görünür).
   - Puanlama satırı: şık sayısı, yanlış doğruyu götürür, basamak. Kurulumdan gelir, salt okunur.
   - Sorular:
     - Çoktan seçmeli, D/Y, boşluk ve açık uçlu sorular düzenlenir. Çoktan seçmelide şık eklenir, silinir ve doğru şık işaretlenir. Boşlukta diğer kabul edilen yazımlar girilir. Açık uçluda beklenen cevap ve rubrik ("puan | ölçüt" satırları, 100'e ölçeklenir) yazılır.
     - **Hesap, ifade, çizim ve grafikli sorular elle düzenlenmez:** cevabı kod hesapladı; metin değişirse cevap bozulur. Bu sorular yalnızca **yeniden üretilir** (aynı kavramla, 1 soru).
     - Her soruda: yukarı/aşağı taşıma, silme (geri alınabilir), "YZ / YZ · düzenlendi / senin sorun" etiketi.
     - "+ yapay zekâ ile 1 soru" ve dört türde boş soru eklenebilir.
   - Kaydetme: "taslağı kaydet"; düzenleyici kapanınca kaydedilmemiş değişiklik sessizce kaydedilir.
5. **Yayınla** (`assignment_publish`):
   - Sunucu denetler: her sorunun metni ve doğru cevabı var, çoktan seçmelide doğru şık şıklardan biri, aynı şık iki kez yok, son teslim en az 10 dk sonra.
   - Sorular kilitlenir. Sonra yalnızca son teslim değişir (`assignment_set_dates`; yayındaki ödevin açılışı ileri alınamaz) ya da ödev kapanır (`assignment_close`; son teslim ileri alınınca yeniden yayına girer).

### Veritabanı (`20261027b_sinav_faz6_odevler.sql`)
- **`assignments`:** soruları cevap anahtarıyla tutar.
  - **Öğrenci bu tabloyu hiç okuyamaz**; RLS yalnızca sınıfın öğretmenine ve yöneticiye okuma verir.
  - Yazma yalnızca fonksiyonlarla.
  - Öğrenci tarafı 6.3'te: ödevden öğrenciye özel sınav kaydı ve ayrı cevap anahtarı (`exam_answer_keys`).
- **`assignment_gen_log`:** taslak sınırı.
- **Ayarlar sunucuda temizlenir:** bilinmeyen anahtar atılır, değerler sınırlara çekilir.
  - deneme 1-3
  - süre 5-300 dk
  - kesinti %1-50, en çok 1-7 gün
  - şık 4/5, oran 3/4, basamak 2-4
- **Taslakta boş soru metni serbest:** öğretmen soruyu ekleyip sonra doldurur. Yayında denetlenir.
- Bir ödevde en çok 40 soru; sınıf başına en çok 20 taslak; arşivdeki sınıfa ödev verilemez.

### Test
- `tests/exam-assignments.js`: 10 test.
  - taslak kipinin sınav kaydı açmaması
  - tablo yetkileri
  - yayın denetimleri
  - ayar sınırları
  - ön yüz ile SQL parametre eşliği
  - rubrik ölçekleme
- **Davranış testi** (`tests/sql/faz6-odevler.sql`, Postgres ve RLS ile):
  - öğrenci taslak alamaz, ödev açamaz, ödev satırı göremez
  - başka öğretmen göremez ve yönetemez
  - saatte 20 taslak sınırı
  - ayarlar temizleniyor
  - yayın denetimleri tek tek
  - yayın sonrası kilit
  - tarih uzatma ve yeniden açma
  - taslak silme
  - arşiv
  - yetki kalkınca erişim kapanıyor
- **Tarayıcı** (`run20`): kurulum penceresinin taslak kipi, istek gövdesi, düzenleme, geri alma, taşıma, yeniden üretme, kaydetme yükü, yayın, tarih, kapatma, boş taslak; 390 px'te taşma yok. Normal sınav akışı (`run16`) değişmedi.

### Deploy
- `generate-exam` otomatik (GitHub Actions).
- SQL elle (SQL Editor). SQL'den önce ön yüzde "ödevler" bölümü görünmez.

## Faz 6.3: öğrenci tarafı (ödev listesi, çözme, geç teslim, gizli cevaplar)

### Öğrenci
- **Liste:** "Sınıflarım" kartında her ödev bir satır (`my_assignments`; soru ve cevap içermez). Satır durumları:
  - **açık:** son teslim ve kalan süre, soru sayısı, süre, deneme hakkı
  - **geç teslim:** "günde %X kesintiyle … tarihine kadar"
  - **yakında:** açılış tarihi
  - **yarım kaldı:** "devam et"
  - **teslim edildi:** not ("sonuç")
  - **kapandı**
- **Başla:**
  - Önce bir onay sorulur: soru sayısı, süre, ipucu olmadığı, deneme sırası, geç teslim kesintisi, öğretmenin notu.
  - Sonra `generate-exam { assignmentStart }` çağrılır.
  - Ödev sınavı süreli ve ipuçsuz (`is_simulation`). Süre, ödevin kendi süresi ile teslim penceresinin sonundan hangisi kısaysa o; süre dolunca kâğıt kendiliğinden toplanır.
  - Yarım deneme varsa ona dönülür; taslak cevaplar geri gelir.
  - Kapakta "ödev · başlık", öğretmenin notu ve son teslim yazar. Sayaç 1 saati geçince s:dd:ss gösterir.
- **Sonuç kâğıdı:**
  - Başlık "ödev · başlık"; deneme sırası, geç teslim kesintisi (kesintisiz not da yazar), öğrenciye özel sayılar notu.
  - Cevaplar gizliyse yalnızca puan ve doğru/yanlış görünür; "doğru cevaplar … sonrasında" ya da "öğretmen göstermiyor" yazar.
  - Açıklanınca tam sonuç `exam_hidden_results`'tan birleştirilir. Bu sırada itiraz sonucu (yeni puan) korunur.
- **Bildirim çanı:**
  - Yeni ödev ("📝 Yeni ödev: …").
  - Teslim edilmemiş ödevde son teslime 24 saatten az kaldıysa "⏰ …".
- **Sınıfı olmayan öğrenci ("ikisi birden" kararı):** "acadex önerisi · bu hafta" kartı çıkar.
  - Karneye göre tekrar zamanı gelen ve zayıf konusu en çok olan masa için pazar 23:59'a kadar kısa bir akıllı deneme önerir.
  - Bu hafta bir akıllı deneme çözüldüyse "tamamladın ✓" yazar.
  - Kartta açıkça "bir öğretmenin ödevi değildir" yazar.

### Sunucu
- **`generate-exam` (`startAssignmentExam`):** model çağrılmaz, sınav sınırına sayılmaz.
  - Kurallar SQL'de: `assignment_begin` yalnızca service_role'e açık.
  - Öğrenciye özel kopya: soru ve şık sırası karışır (`keep_order` olan şıklara dokunulmaz). "Öğrenciye özel sayılar" açıksa şablonlu hesap sorusunda `makeVariant` çalışır.
    - `makeVariant` exam-engine'den birebir kopya; testte iki kopya aynı rastgele sayılarla karşılaştırılır.
    - Cevap formülden yeniden hesaplanır; eski sayılara bağlı çözüm adımları, tipik hatalar ve açıklama atılır.
  - Kayıt: genel sorular `exams`'e, anahtar `exam_answer_keys`'e. `exams.assignment_id` ve `attempt_no` doldurulur; `scoring.assignment` başlık, son teslim, pencere ve kuralları taşır.
  - Masa: sınıfın ders kodu (yoksa sınıf adı).
  - Aynı anda iki "başla" gelirse benzersiz indeks ikinciyi durdurur ve var olan denemeye dönülür.
- **`grade-exam`:**
  - **Geç teslim:** son teslimden sonra her başlamış gün için %pct kesinti (2 dk tolerans); `scoring.assignment.late_applied` kesintisiz notu da tutar.
  - **Gizli cevaplar ("son teslimden sonra" / "hiç"):** `exams.question_results`'a yalnızca puan, doğru/yanlış ve nötr geri bildirim yazılır. Tam sonuç `exam_hidden_results`'a gider (`reveal_at` = pencere sonu ya da null). `question_attempts`'in anahtar alanı boş kalır.
- **`exam-appeal`:**
  - Cevaplar gizliyken yapay zekâ itirazı yok (`answers_hidden`).
  - İtirazla yeniden hesaplanan nota da geç teslim kesintisi uygulanır.

### Veritabanı (`20261028b_sinav_faz6_ogrenci.sql`)
- `exams.assignment_id`, `exams.attempt_no`. Bir öğrencinin bir ödevde aynı anda yalnızca bir yarım denemesi olabilir (benzersiz indeks).
- `exam_hidden_results`: öğrenci yalnızca kendi satırını, `reveal_at` geçince okur. Yazma yalnızca sunucu.
- `assignment_window_end`, `assignment_begin` (service_role), `my_assignments`.

### Test
- `tests/exam-assignment-student.js`: 10 test.
  - `makeVariant` sunucu ve tarayıcı eşliği
  - kopya kurma
  - kesinti
  - gizleme
  - itiraz
  - başlatma yolu
  - ön yüz
- **Davranış testi** (`tests/sql/faz6-ogrenci.sql`, Postgres ve RLS ile):
  - taslak listede yok
  - listede soru ve cevap sızmıyor
  - öğrenci `assignment_begin`'i çağıramıyor
  - sınıf dışı öğrenci görmüyor
  - yarım denemeye dönülüyor, ikinci yarım deneme engelleniyor
  - deneme hakkı ve en yüksek not
  - geç gün sayısı, pencere sonu, kesintisiz ödevde son teslimde kapanma
  - yakında ve kapalı ödev
  - gizli sonuç yalnızca açılınca ve yalnızca sahibine
- **Tarayıcı** (`run21`): liste durumları, onay metni, kapak ve sayaç, gizli ve açıklanmış sonuç, sınıfsız öğrenciye öneri ve akıllı deneme kısayolu; 390 px'te taşma yok. 6.1 ve 6.2 tarayıcı testleri (`run19`, `run20`) ile normal sınav akışı (`run16`) yeniden geçti.

### Deploy
- `generate-exam`, `grade-exam`, `exam-appeal` otomatik (GitHub Actions).
- SQL elle; sıra: 6.2 → 6.3.

### 6.3b: cevapların açılma zamanı (`20261028c_sinav_faz6_cevap_acilisi.sql`)
- **Sorun:** canlı teste hazırlanırken fark edildi. `reveal_at` teslim anında yazılıyordu; öğretmen son teslimi uzatırsa erken teslim eden öğrenci cevapları, diğerleri hâlâ çözerken görebilirdi.
- **Düzeltme:** `exam_hidden_results` okuma izni artık ödevin **güncel** durumuna bakar (`exam_hidden_revealed`):
  - "son teslimden sonra": teslim penceresi bitince ya da öğretmen ödevi kapatınca açılır
  - "hiç": asla açılmaz
  - Son teslim uzatılırsa cevaplar yeniden gizlenir.
  - Ödev silinmişse kayıttaki eski açılış zamanı geçerli.
- Ön yüz ve `exam-appeal` aynı kararı kullanır: satır okunabiliyorsa cevaplar açılmıştır.
- **Test:** `tests/sql/faz6-ogrenci.sql` bu durumları tek tek dener.

### 6.3c: sınav satırı koruması (`20261028d_sinav_faz6_koruma.sql`)
- **Açık:** "Users can update own exams" politikası öğrenciye kendi `exams` satırını güncelleme izni veriyor; tetikleyici yalnızca puanlama alanlarını kilitliyordu. Bu yüzden öğrenci:
  - `assignment_id`'yi boşaltıp ödevin deneme hakkını sıfırlayabilirdi,
  - `is_simulation` ya da `time_limit_seconds` ile süre sınırını ve ipucu yasağını kaldırabilirdi. Bu yalnızca ödevlerde değil, her "gerçek sınav provası"nda mümkündü (eski bir açık).
  - `teacher_note` yazabilirdi.
- **Düzeltme:** `exams_guard_grading_fields` bu alanları da kilitler. Öğrenci INSERT'inde ödev alanları ve öğretmen notu boş olmalı. Ön yüz bu alanları hiç güncellemiyor; sunucu (service_role) serbest.
- **Test:** `tests/sql/faz6-koruma.sql` (Postgres).
