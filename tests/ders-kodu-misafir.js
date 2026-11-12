/* ==========================================================================
   ACADEX — DERS KODUYLA MİSAFİR GİRİŞİ (tests/ders-kodu-misafir.js)

   NEDEN VAR (11.11.2026): hoca derste bir kod veriyor; öğrenciler hesap
   açmadan istatistik.html'den giriyor, dashboard'u GÖRÜYOR ama yalnız
   İstatistik ders yolunu kullanabiliyor. Mekanizma: Supabase anonim oturumu
   + is_anonymous bayrağıyla istemcide misafir kilidi + admin'den kod yönetimi.
   Bu dosya zincirin her halkasını kilitler: sunucu (migration), kapı sayfası,
   misafir modu, kenar çubuğu, lab kapısı ve masraflı fonksiyon reddi.

   Çalıştırma:  node tests/ders-kodu-misafir.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const sql = read('supabase/migrations/20261111b_ders_kodu_misafir.sql');
const giris = read('istatistik.html');
const ink = read('js/acadex-ink.js');
const fin = read('js/acadex-finans.js');
const html = read('dashboard.html');
const ts = read('supabase/functions/summarize-document/index.ts');

test('SUNUCU: anonim istisna, kapalı tablolar, kilit, 16 KB sınırı', () => {
  // Kapalı beta kapısı anonim kullanıcıya istisna tanır ama SADECE ona.
  assert.match(sql, /if coalesce\(new\.is_anonymous, false\) then\s*\n\s*return new;/,
    'anonim istisnası yok — misafir girişi beta dondurmasına takılır');
  assert.match(sql, /raise exception 'ACADEX_KAYIT_KAPALI'/, 'beta kapısının kendisi kalkmış');
  // Tablolar dışarıya kapalı (kids kalıbı): her şey security definer fonksiyonlardan.
  assert.match(sql, /revoke all on public\.ders_kodlari\s+from anon, authenticated/, 'kod tablosu dışarı açık');
  assert.match(sql, /revoke all on public\.ders_konuklari from anon, authenticated/, 'konuk tablosu dışarı açık');
  // Kaba kuvvet: var olan koda 20 denemede 10 dk kilit; UPDATE'te tek atama.
  assert.match(sql, /kilit_bitis = case when hata_sayi \+ 1 >= 20 then now\(\) \+ interval '10 minutes' else kilit_bitis end/,
    'kilit koşulu yok ya da bozulmuş');
  assert.ok(!/set hata_sayi = hata_sayi \+ 1,\s*\n\s*kilit_bitis[\s\S]{0,200}hata_sayi\s*=/.test(sql),
    'aynı UPDATE içinde hata_sayi iki kez atanıyor — Postgres reddeder');
  // İlerleme sınırı ve sahiplik.
  assert.match(sql, /length\(coalesce\(p_veri::text, ''\)\) > 16384/, '16 KB sınırı yok');
  assert.match(sql, /where user_id = auth\.uid\(\)/, 'konuk yalnız kendi satırını yazmıyor');
  // misafir_kaydet YALNIZ anonim oturumla çalışır (gerçek hesap kod tüketmesin).
  assert.match(sql, /if auth\.uid\(\) is null or not v_anon then return false; end if;/,
    'misafir_kaydet anonim olmayanı reddetmiyor');
  // Yönetici fonksiyonları admin kapılı.
  assert.equal(sql.split("if not public.current_is_admin() then raise exception 'yetki yok'").length - 1, 3,
    'üç yönetici fonksiyonunun hepsi admin kapılı değil');
  // Anonim profil e-postasızdır; NOT NULL varsa giriş hiç açılmaz.
  assert.match(sql, /alter table public\.profiles alter column email drop not null/, 'profil e-posta emniyeti yok');
});

test('KAPI SAYFASI: doğrula → anonim oturum → kaydet → panele', () => {
  assert.ok(giris.includes("rpc('ders_kodu_dogrula', { p_kod: kod })"), 'kod doğrulaması yok');
  assert.ok(giris.indexOf("ders_kodu_dogrula") < giris.indexOf('signInAnonymously'),
    'oturum koddan ÖNCE açılıyor — kodsuz anonim hesap üretir');
  assert.ok(giris.includes("rpc('misafir_kaydet', { p_kod: kod, p_rumuz: adEl.value.trim(), p_bolum: bolumEl.value })"), 'kod↔kullanıcı bağı kurulmuyor');
  assert.ok(giris.includes("sessionStorage.setItem('acadex.misafir.giris', '1')"), 'otomatik ders açma işareti yok');
  assert.ok(giris.includes('Misafir girişi sunucuda henüz açılmamış'), 'anonim kapalıyken anlaşılır mesaj yok');
  assert.ok(giris.includes('window.location.replace(\'dashboard.html\')'), 'panele yönlenmiyor');
});

test('MİSAFİR MODU: bekçi yalnız gezinme + İstatistik + çıkışa izin verir', () => {
  assert.ok(ink.includes('if (!u || !u.is_anonymous) return;'), 'misafir ölçütü is_anonymous değil');
  assert.ok(ink.includes("document.body.classList.add('ax-misafir')"), 'gövde sınıfı yok');
  // Bekçi yakalama evresinde; kenar çubuğunda yalnız # bağlantıları serbest
  // (Formulo ayrı sayfadır, vitrine girer).
  assert.ok(ink.includes("}, true);"), 'bekçi yakalama evresinde değil');
  /* Kenar çubuğunun TAMAMI serbest olmalı: grup başlıkları (.ax-grp-b) düğme,
     bağlantı değil — ilk sürüm yalnız #'li <a>'lara izin verince misafir
     grupları açamadı, "içeriklere bakamıyoruz" (11.11 canlı bulgu). Vitrin
     olan tek şey panel dışına götüren bağlantılar (href # ile başlamayan). */
  assert.ok(ink.includes("var side = t.closest('#nav-menu');"), 'bekçi kenar çubuğunu sarmalayıcıdan tanımıyor');
  assert.ok(ink.includes("if (ya && !/^#/.test(ya.getAttribute('href') || '')) { e.preventDefault(); e.stopPropagation(); uyar(); return; }"),
    'dışarı götüren kenar bağlantıları (Formulo/paketler) vitrine alınmıyor');
  const sideBlok = ink.slice(ink.indexOf("var side = t.closest('#nav-menu');"), ink.indexOf("var side = t.closest('#nav-menu');") + 700);
  assert.ok(/return;\n\s*\}/.test(sideBlok), 'kenar çubuğu içi serbest bırakılmıyor — gruplar yine açılmaz');
  assert.ok(ink.includes("if (k.indexOf('istat') === 0) return;"), 'İstatistik kartları bekçiye takılıyor');
  assert.ok(ink.includes("t.closest('[data-finans-run]')"), 'ders yolu katmanı bekçiye takılıyor');
  // Girişten gelince ders kendiliğinden açılır; ilerleme sunucuya yazılır.
  assert.ok(ink.includes("sessionStorage.getItem('acadex.misafir.giris') === '1'"), 'otomatik açılış yok');
  assert.ok(ink.includes("cl.rpc('misafir_ilerleme_koy', { p_veri: v })"), 'ilerleme sunucuya yazılmıyor');
  assert.ok(ink.includes("d.src !== 'axlab' || d.lab !== 'istat' || d.type !== 'progress'"),
    'ilerleme dinleyicisi lab mesajının biçimini doğrulamıyor');
});

test('KENAR ÇUBUĞU + LAB KAPISI: İstatistik Formulo\'nun altında, dışarıdan açılır', () => {
  assert.ok(html.indexOf('id="side-formulo"') < html.indexOf('id="side-istatistik"'),
    'İstatistik satırı Formulo\'nun altında değil');
  assert.ok(html.includes('if(window.axIstatAc){window.axIstatAc();return false;}'),
    'kenar çubuğu ders yolunu açmıyor');
  assert.ok(fin.includes("window.axIstatAc = function () { open('istat-yol'); };"),
    'acadex-finans dışarıya açma kapısı vermiyor');
});

test('MASRAFLI FONKSİYON: summarize-document misafiri reddeder', () => {
  assert.ok(ts.includes('(istekUser as any)?.is_anonymous'), 'anonim denetimi yok');
  assert.ok(ts.includes("'Misafir girişi özet çıkaramaz"), 'ret mesajı yok');
  assert.ok(ts.indexOf('is_anonymous') < ts.indexOf('DOC_LOOKUP_RETRY_MS'),
    'ret, belge aramasından SONRA — boşa sorgu ve bekleme yapar');
});

test('ADMİN: Ders kodları bölümü kayıtlı ve hafta sayımı ilerleme biçimini tanıyor', () => {
  const adm = read('js/admin-ders.js');
  const app = read('js/admin-app.js');
  const admHtml = read('admin.html');
  assert.ok(app.includes("{ k: 'derskod', t: 'Ders kodları' }"), 'NAV girdisi yok');
  /* go() başlığı TITLES'tan okur ve toLocaleUpperCase çağırır: girdi eksikse
     yönlendirme yarıda patlar, ESKİ görünüm ekranda kalır (11.11 canlı bulgu —
     "ders kodlarına basınca geçmiyor"). Menüye eklenen her anahtar TITLES'a da girmeli. */
  assert.ok(app.includes("derskod: 'Ders kodları',"), 'TITLES girdisi yok — tıklayınca görünüm değişmez');
  assert.ok(app.includes("derskod: '<rect"), 'ikon yok — menüde boş svg çıkar');
  assert.ok(admHtml.includes('js/admin-ders.js'), 'modül admin.html\'e bağlı değil');
  assert.ok(adm.includes('A.VIEWS.derskod = async function (m)'), 'görünüm AXADM\'e kayıtlı değil');
  // Oluşturma istemci tarafında da biçim denetler (sunucu check ile aynı kural).
  assert.ok(adm.includes("/^[A-Z0-9]{4,24}$/.test(kod)"), 'kod biçimi istemcide denetlenmiyor');
  // Hafta sayımı lab'ın gerçek biçimine bakar: gN anahtarları, a/g/s izleri.
  assert.ok(adm.includes("/^g\\d+$/.test(k)") && adm.includes('r.a || r.g || r.s != null'),
    'hafta sayımı acadex.istat.v1 biçimini tanımıyor');
  // Aç/kapat mevcut not ve tarihi KORUYARAK yazar (upsert hepsini güncelliyor).
  assert.ok(adm.includes("p_not: b.getAttribute('data-not')") && adm.includes("p_son_tarih: b.getAttribute('data-tarih') || null"),
    'kapat/aç kodun notunu ya da tarihini siliyor');
});

test('GENEL KİLİT: misafir veritabanında HİÇBİR tabloya yazamaz (11.11.2026)', () => {
  /* Berkay: "istatistik hariç hepsinde engellensin, diğerlerine bu işi
     bırakmayalım". Çözüm RLS'in KISITLAYICI politikaları: permissive
     politikalara dokunmadan VE'lenir; anonim JWT ile gelen her yazma —
     hangi sayfadan, hangi edge fonksiyonundan gelirse gelsin — veritabanında
     düşer. SECURITY DEFINER fonksiyonlar (misafir_ilerleme_koy dahil) tablo
     sahibiyle çalıştığı için İstatistik ilerlemesi çalışmaya devam eder. */
  const kilit = read('supabase/migrations/20261111c_misafir_yazamaz.sql');
  assert.match(kilit, /coalesce\(\(auth\.jwt\(\)->>'is_anonymous'\)::boolean, false\)/,
    'misafir_mi eski JWT\'de false dönmüyor — gerçek kullanıcı kilitlenebilir');
  // Üç işlem de kısıtlayıcı politikayla, RLS açık TÜM public tablolara.
  assert.match(kilit, /for r in select tablename from pg_tables\s*\n\s*where schemaname = 'public' and rowsecurity/,
    'döngü RLS açık public tabloları taramıyor');
  for (const ad of ['zz_misafir_ekleyemez', 'zz_misafir_degistiremez', 'zz_misafir_silemez']) {
    assert.ok(kilit.includes(ad), ad + ' politikası yok');
  }
  assert.equal(kilit.split('as restrictive').length - 1, 6,
    'kısıtlayıcı politika sayısı 6 değil (3 tablo döngüsü + 3 storage)');
  // SELECT'e dokunulmaz: "sadece görsünler".
  assert.ok(!/for select/.test(kilit), 'okuma da kilitlenmiş — misafir hiçbir şey göremez');
  // Depolama: misafir dosya yükleyemez.
  assert.match(kilit, /create policy zz_misafir_ekleyemez on storage\.objects/,
    'storage yazması açık — misafir dosya yükleyebilir');
  // İstemci: tıklamaya ek form + sürükle-bırak bekçisi (ders yolu muaf).
  assert.ok(ink.includes("document.addEventListener('submit', function (e) {\n      if (e.target.closest('[data-finans-run]')"),
    'form bekçisi yok — Enter ile gönderim vitrini deler');
  assert.ok(ink.includes("['drop', 'dragover'].forEach"), 'sürükle-bırak bekçisi yok');
});

test('KAPALI BETA KAPISI + SİHİRBAZ: misafiri kovmaz, sihirbaz açılmaz (11.11.2026)', () => {
  /* Canlı deneme bulgusu: anonim giriş açılınca misafir önce profil
     sihirbazına, sonra login.html?erisim=yok'a düştü. İki sebep:
     (a) js/acadex-erisim.js kapalı beta bekçisi access_allowed=false görüp
     oturumu kapatıyordu — misafir bu kapının konusu değil, yetkisi ayrı
     katmanda kısıtlı; (b) anonim profil onboarding_completed=false doğuyordu. */
  const erisim = read('js/acadex-erisim.js');
  const i = erisim.indexOf('if (isDash) {');
  assert.ok(i > -1, 'erişim bekçisinin dashboard dalı bulunamadı — öncül değişti');
  const dal = erisim.slice(i, i + 700);
  assert.ok(dal.includes('if (u.is_anonymous) return;'),
    'bekçide misafir istisnası yok — ders kodu girişi login\'e geri atılır');
  assert.ok(dal.indexOf('is_anonymous') < dal.indexOf('var r = await check(u.id)'),
    'istisna profil denetiminden SONRA — yine kovulur');
  /* "Profilini tamamla" penceresi (profile-complete.js) bölümü olmayan her
     hesaba açılır; misafirin bölümü OLMAZ — pencere ona hiç çıkmamalı
     (canlı bulgu: KVKK kutusu bekçiye takıldı, öğrenci kilitlendi). */
  const pcx = read('js/profile-complete.js');
  assert.ok(pcx.includes('if (u && u.is_anonymous) return;'),
    'profil tamamlama penceresi misafire de açılıyor — KVKK kutusu bekçiye takılır');
  assert.ok(pcx.indexOf('u.is_anonymous) return;') < pcx.indexOf('if (needs(p)) open(p, u)'),
    'istisna needs denetiminden SONRA — pencere yine açılır');
  const prof = read('supabase/migrations/20261111d_misafir_profil.sql');
  assert.match(prof, /new\.onboarding_completed := true;/, 'sihirbaz atlaması yok');
  assert.match(prof, /new\.access_allowed := false;/,
    'misafir access_allowed=true doğuyor — beta izin anlamı bulanır');
  assert.match(prof, /'Misafir'/, 'boş ad düzeltilmiyor');
  // Anonim olmayan dal eski davranışını AYNEN korur (beta kuralı bozulmasın).
  assert.match(prof, /\(not public\.registration_frozen\(\)\)\s*\n\s*or exists \(select 1 from access_invites/,
    'kapalı beta varsayılanı değişmiş');
});

test('ACADIA KAPANIR + RUMUZ GÖRÜNEN AD OLUR (11.11.2026)', () => {
  /* Canlı bulgu: ders yolundaki köprü Acadia panelini açabiliyor; kapatma
     düğmesi bekçiye takılınca panel ekranda kilitli kalıyordu. Kapatma artık
     her zaman serbest; panelin İÇİ vitrinde (AI çağrıları misafire kapalı). */
  assert.ok(ink.includes("if (t.closest('[data-close]') && t.closest('#axa-layer')) return;"),
    'Acadia kapatma düğmesi bekçiye takılıyor');
  // Rumuz: ders_konuklari + profiles.full_name — panel "Merhaba <rumuz>" der.
  const rmz = read('supabase/migrations/20261111e_misafir_rumuz.sql');
  assert.match(rmz, /update profiles set full_name = v_ad where id = auth\.uid\(\);/,
    'rumuz görünen ada yazılmıyor — panel "Misafir" demeye devam eder');
  assert.match(rmz, /if v_ad <> '' then/, 'boş rumuz adı silip boş bırakır');
  assert.match(rmz, /if auth\.uid\(\) is null or not v_anon then return false; end if;/,
    'anonim şartı düşmüş — gerçek hesabın adı kodla değiştirilebilir olur');
  assert.match(rmz, /rumuz = case when excluded\.rumuz <> '' then excluded\.rumuz else ders_konuklari\.rumuz end/,
    'tekrar girişte boş rumuz eskisini eziyor');
});

test('BÖLÜM SORULUR: girişte seçilir, konuk listesinde ve profilde görünür (11.11.2026)', () => {
  const g2 = read('istatistik.html');
  assert.ok(g2.includes('<select id="bolum">'), 'kapı sayfasında bölüm seçimi yok');
  assert.ok(g2.includes('Management Information Systems'), 'bölüm değerleri profil sihirbazındaki İngilizce anahtarlarla aynı değil');
  assert.ok(g2.includes('p_bolum: bolumEl.value'), 'bölüm sunucuya gönderilmiyor');
  const bm = read('supabase/migrations/20261111f_misafir_bolum.sql');
  // İmza değişti: eski 2 parametreli sürüm düşmezse PostgREST rpc belirsizliği doğar.
  assert.match(bm, /drop function if exists public\.misafir_kaydet\(text, text\);/,
    'eski imza düşürülmüyor — rpc çağrısı iki aşırı yüklemede belirsizlik hatası verir');
  assert.match(bm, /if v_bolum <> '' then update profiles set department = v_bolum/,
    'bölüm profile yazılmıyor — panel başlıkları bölümsüz kalır');
  assert.match(bm, /bolum = case when excluded\.bolum <> '' then excluded\.bolum else ders_konuklari\.bolum end/,
    'tekrar girişte boş bölüm eskisini eziyor');
  assert.match(bm, /'bolum', g\.bolum/, 'konuk özeti bölümü döndürmüyor');
  const adm2 = read('js/admin-ders.js');
  assert.ok(adm2.includes("(g.bolum ? ' · ' + X(g.bolum) : '')"), 'admin konuk listesi bölümü göstermiyor');
});

test('ÖNERİ PAKETİ: QR + yansıtma + dönüşüm + temizlik (12.11.2026)', () => {
  /* Berkay "hepsini yapalım" dedi: ders günü paketi. QR bağlantısı kodu
     kapı sayfasına taşır; yansıtma ekranı projektörde canlı sayım gösterir;
     misafir e-posta+şifreyle gerçek hesaba dönüşür (uid değişmediği için
     ilerleme kalır); eski anonim hesaplar onaylı temizlenir. */
  const kapi2 = read('istatistik.html');
  assert.ok(kapi2.includes("new URLSearchParams(location.search).get('kod')"),
    'kapı sayfası ?kod= bağlantısını doldurmuyor — QR işe yaramaz');
  const adm3 = read('js/admin-ders.js');
  assert.ok(adm3.includes("'/istatistik.html?kod=' + encodeURIComponent(kod)"),
    'QR bağlantısı giriş sayfasına kodu taşımıyor');
  assert.ok(adm3.includes('data-dk-yansit'), 'yansıtma ekranı düğmesi yok');
  assert.match(adm3, /admin_ders_konuk_ozet[\s\S]*?setTimeout\(tazele, 5000\)/,
    'yansıtma sayacı canlı tazelenmiyor');
  assert.match(adm3, /p_dene: true[\s\S]*?confirm[\s\S]*?p_dene: false/,
    'temizlik önce saymadan ya da onaysız silebilir');
  const mig = read('supabase/migrations/20261112_vitrin_takip_donusum.sql');
  assert.match(mig, /admin_misafir_temizle[\s\S]*?current_is_admin/, 'temizlikte yönetici kapısı yok');
  assert.match(mig, /if p_gun < 7 then/, 'temizlik 7 gün tabanı yok — kısa aralıkla ilerleme silinebilir');
  // Dönüşüm: yalnız ders konuğu otomatik davet alır; access_allowed ancak
  // işlem-yerel görevli bayrağıyla geçer (protect_profile_flags).
  assert.match(mig, /misafir_tamamla[\s\S]*?if not exists \(select 1 from ders_konuklari/,
    'dönüşümde ders konuğu şartı yok — kapalı beta kapısı delinir');
  assert.match(mig, /set_config\('acadex\.gorevli', '1', true\)/,
    'görevli bayrağı kurulmuyor — access_allowed güncellemesi tetikleyiciye takılır');
  assert.match(mig, /coalesce\(current_setting\('acadex\.gorevli', true\), ''\) = '1'/,
    'protect_profile_flags görevli bayrağını tanımıyor');
  assert.ok(ink.includes('data-msf-hesap'), 'misafir şeridinde "hesabını aç" yok');
  /* 12.11 tarama: Supabase anonim kullanıcıya şifreyi ancak e-posta
     doğrulandıktan sonra ekletir — tek çağrıda ikisi reddedilir. */
  assert.ok(!ink.includes('updateUser({ email: em.value.trim(), password: pw.value })'),
    'e-posta ve şifre tek çağrıda — Supabase anonim kullanıcıda reddeder');
  assert.match(ink, /updateUser\(\{ email: em\.value\.trim\(\) \}[\s\S]*?u2\.is_anonymous\) return 'onay'[\s\S]*?updateUser\(\{ password: pw\.value \}\)/,
    'dönüşüm iki adımlı değil (önce e-posta, doğrulanınca şifre)');
  const tg = read('supabase/migrations/20261112b_misafir_donusum_tetik.sql');
  assert.match(tg, /after update of is_anonymous, email on auth\.users/,
    'onay başka sekmede tıklanınca erişimi açacak tetikleyici yok — beta kapısı kullanıcıyı atar');
  assert.match(tg, /exists \(select 1 from ders_konuklari where user_id = new\.id\)/,
    'tetikleyicide ders konuğu şartı yok — kapalı beta delinir');
  assert.ok(ink.includes("cl.rpc('misafir_tamamla')"), 'dönüşüm sunucuda tamamlanmıyor');
  assert.ok(ink.includes("t.closest('.ax-msf-kayit')"),
    'hesap penceresi tıklama bekçisine takılır — form doldurulamaz');
  assert.ok(ink.includes("e.target.closest('.ax-msf-kayit')"),
    'hesap penceresi gönderim bekçisine takılır — Enter çalışmaz');
});

test('GÜVENLİK TARAMASI: definer yan kapılar + yarım giriş (12.11.2026)', () => {
  /* Tarama bulgusu 1: genel kilit RLS'tir, definer fonksiyonlar takılmaz.
     İç koruması olmayan iki definer yazıcı (push_subscribe, ing_icerik_al)
     misafire kapatıldı; gerçek kullanıcı için davranış aynı. */
  const g = read('supabase/migrations/20261111g_misafir_rpc_kapisi.sql');
  assert.match(g, /push_subscribe[\s\S]*?if public\.misafir_mi\(\) then raise exception 'PUSH_GIRIS'/,
    'misafir konsoldan push aboneliği açabilir');
  assert.match(g, /ing_icerik_al[\s\S]*?if public\.misafir_mi\(\) then return; end if;/,
    'misafir ing_gorulen tablosuna iz bırakabilir');
  assert.match(g, /alter function public\.misafir_mi\(\) set search_path to '';/,
    'misafir_mi search_path sabitlenmemiş (Supabase danışman uyarısı)');
  /* Tarama bulgusu 2: kod, doğrulama ile kayıt arasında kapanırsa misafir_kaydet
     false döner (hata değil) — eski kod bunu yutup bağsız anonim oturumla
     panele geçiyordu; admin o misafiri hiç göremezdi. Şimdi oturum kapatılır. */
  const kapi = read('istatistik.html');
  assert.ok(kapi.includes('if (m && m.data === false) {'),
    'misafir_kaydet=false yutulur — koda bağlı olmayan misafir panele düşer');
  assert.match(kapi, /m\.data === false\) \{[\s\S]*?signOut\(\)/,
    'kayıt düşünce anonim oturum kapatılmıyor');
});

test('KİLOMETRE TAŞI EKRANI (13.11.2026)', () => {
  /* Misafir ders yolunda ilerliyor ama hiçbir şey olmuyordu; hesap açmaya en
     yatkın an bir haftayı bitirdiği andır. Hafta "bitti" ölçütü lab ile
     birebir aynı olmalı (IST.parts: a && g && s >= 60), yoksa kutlama
     yanlış anda çıkar. */
  assert.match(ink, /if \(r\.a && r\.g && r\.s != null && r\.s >= 60\) n\+\+;/,
    'hafta bitti ölçütü lab ile aynı değil (IST.parts)');
  const lab = read('labs/istat/ist-core.js');
  assert.match(lab, /return \[!!r\.a, !!r\.g, r\.s != null && r\.s >= 60\]/,
    'lab ölçütü değişmiş — kutlama eşiği de güncellenmeli');
  assert.ok(ink.includes('var ESIK = 3;'), 'kutlama eşiği yok');
  assert.match(ink, /acadex\.misafir\.kutlama/, 'kutlama bir kez gösterilmiyor (her haftada tekrar çıkar)');
  assert.ok(ink.includes("t.closest('.ax-msf-kutlama')"),
    'kutlama penceresi tıklama bekçisine takılır — düğmeleri çalışmaz');
  assert.match(ink, /data-khesap[\s\S]{0,200}kayitAc\(\)/, 'kutlamadaki hesap düğmesi dönüşümü açmıyor');
});

summary();
