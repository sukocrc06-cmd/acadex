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
  assert.ok(giris.includes("rpc('misafir_kaydet', { p_kod: kod, p_rumuz: adEl.value.trim() })"), 'kod↔kullanıcı bağı kurulmuyor');
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
  assert.ok(ink.includes("if (/^#/.test(yan.getAttribute('href') || '')) return;"),
    'kenar çubuğu gezinmesi serbest değil ya da Formulo da serbest kalmış');
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

summary();
