/* ==========================================================================
   ACADEX — ACADEX KIDS SİTESİ VE GİRİŞİ (tests/kids-giris.js), 10.11.2026

   NEDEN VAR: acadex.com.tr/kids (kids/index.html, tek dosya) yönetim panelinin
   ürettiği okullara bağlandı (kids/assets/kids-bulut.js →
   supabase/migrations/20261110b_kids_giris.sql). Bu dosya şunları korur:
     - siteye yalnız herkese açık (publishable) anahtar girer, gizli anahtar asla
     - örnek okul (ORNEK-2026) sunucuya gitmez; gerçek okul kodu her zaman sunucuya sorulur
     - kids/index.html kaynak dosyalarla güncel (node kids/assets/birlestir.js)
     - /kids → /kids/ yönlendirmesi, sw.js önbelleksiz ve yönetim panelindeki bağlantı
     - davranış (gerçek Postgres, ACADEX_PG verilirse): resimli şifre, deneme
       kilidi, oturum anahtarının özeti, lisans, başka okulun sınıfı, anon yetkisi
       → tests/sql/kids-giris.sql
   Tarayıcı ucu (yönetimden okul → çocuk girişi → öğretmenin günün konusu →
   çocuğun haritası, lisans kapanınca giriş yok) Playwright ile denendi.
   Çalıştırma:  node tests/kids-giris.js
                ACADEX_PG="-h /tmp/pg -p 5499 -U postgres" node tests/kids-giris.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const SQL = 'supabase/migrations/20261110b_kids_giris.sql';

test('anahtar: yalnız publishable, ana siteyle aynı proje', () => {
  const b = read('kids/assets/kids-bulut.js'), cfg = read('js/supabase-config.js');
  const url = cfg.match(/SUPABASE_URL = "([^"]+)"/)[1], key = cfg.match(/SUPABASE_ANON_KEY = "([^"]+)"/)[1];
  assert.ok(b.includes("'" + url + "'") && b.includes("'" + key + "'"));
  assert.match(key, /^sb_publishable_/);
  for (const f of ['kids/index.html', 'kids/assets/kids-bulut.js']) assert.doesNotMatch(read(f), /service_role|sb_secret_/, f);
});

test('kids/index.html kaynaklarla güncel ve bütün parçaları içerir', () => {
  const html = read('kids/index.html');
  for (const f of ['kids-bulut.js', 'kids-gun.js', 'kids-app.js', 'kids-ogretmen.js', 'kids-yon.js']) assert.ok(html.includes('/* ---- ' + f + ' ---- */'), f);
  for (const f of ['kids-bulut.js', 'kids-app.js', 'kids-ogretmen.js', 'kids-veri.js']) assert.ok(html.includes(read('kids/assets/' + f).trim().slice(0, 4000)), f + ' eski: node kids/assets/birlestir.js');
  assert.doesNotMatch(html, /<!--(CSS|JS)-->/);
});

test('örnek okul sunucuya gitmez; başka her kod sunucuya sorulur', () => {
  const v = read('kids/assets/kids-veri.js'), app = read('kids/assets/kids-app.js'), og = read('kids/assets/kids-ogretmen.js'), b = read('kids/assets/kids-bulut.js');
  assert.match(v, /kod: 'ORNEK-2026'/);
  assert.match(b, /ORNEK_KOD = 'ORNEK-2026'/);
  assert.match(app, /if \(k === V\.OKUL\.kod\) \{[^}]*return girisSinif\(\); \}\s*yukleniyor[\s\S]{0,80}B\.okulBul\(k\)/);
  assert.match(og, /if \(kod === V\.OKUL\.kod\) \{[\s\S]{0,200}\}\s*var b = [\s\S]{0,200}B\.ogretmenGiris\(kod, sifre\)/);
  assert.doesNotMatch(v, /AY-2026/);   // gerçek bir müşterinin koduyla çakışmasın
});

test('çocuk resimli şifresi istemcide denetlenmez (gerçek okulda)', () => {
  const app = read('kids/assets/kids-app.js');
  assert.match(app, /if \(!bulutMu\(\)\) \{\s*if \(sec\[0\] === S\.okul\.sifre\[0\]/);
  assert.match(app, /B\.giris\(S\.ogr\[2\], deneme\)/);
  const sql = read(SQL);
  assert.doesNotMatch(sql.slice(sql.indexOf('function public.kids_okul_bul'), sql.indexOf('function public.kids_giris')), /'sifre'|g\.sifre/);
});

test('yönlendirme ve yönetim bağlantısı', () => {
  const v = JSON.parse(read('vercel.json'));
  assert.ok(v.redirects.some((r) => r.source === '/kids' && r.destination === '/kids/'));   // SW kapsamı /kids/ olduğu için sondaki bölü şart
  assert.ok(v.headers.some((h) => h.source === '/kids/sw.js' && /no-cache/.test(JSON.stringify(h.headers))));
  assert.match(read('js/admin-kids.js'), /href="\/kids\/"/);
  assert.equal(fs.existsSync(path.join(ROOT, 'kids/oyna.html')), true);
});

test('güvenlik: anon yalnız giriş fonksiyonlarını çağırır, yardımcılar ve tablolar kapalı', () => {
  const sql = read(SQL);
  assert.match(sql, /revoke all on public\.%I from anon, authenticated/);
  for (const f of ['kids_ozet(text)', 'kids_okul_acik(uuid)', 'kids_oturum_ac(text, uuid, uuid, integer)', 'kids_oturum(text, text)'])
    assert.ok(sql.includes("'" + f + "'") && /from public, anon, authenticated'/.test(sql), f);
  assert.match(sql, /insert into kids_oturumlar \(ozet, [^)]*\) values \(public\.kids_ozet\(a\)/);   // anahtarın yalnız özeti
  for (const f of ['kids_durum', 'kids_ilerleme_koy', 'kids_ogretmen_veri', 'kids_plan_koy'])
    assert.match(sql, new RegExp('function public\\.' + f + '\\([\\s\\S]{0,260}public\\.kids_oturum\\(p_token'), f + ' oturum denetlemeli');
});

test('davranış (gerçek Postgres): şifre, kilit, oturum, plan, lisans, anon', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1', q = (f) => JSON.stringify(path.join(ROOT, f));
  execSync(P + ' -d postgres -c "drop database if exists ax_kidsg" -c "create database ax_kidsg"', { stdio: 'pipe' });
  try {
    for (const f of ['tests/sql/kids-yonetim-stub.sql', 'supabase/migrations/20261110_kids_yonetim.sql', SQL, SQL]) execSync(P + ' -d ax_kidsg -f ' + q(f), { stdio: 'pipe' });
    const out = execSync(P + ' -d ax_kidsg -f ' + q('tests/sql/kids-giris.sql') + ' 2>&1').toString();
    assert.match(out, /NOTICE:  GIRIS GECTI/); assert.match(out, /ANON GIRIS GECTI/);
  } finally { execSync(P + ' -d postgres -c "drop database if exists ax_kidsg"', { stdio: 'pipe' }); }
});

test('22 TEMA + SERTLEŞTİRME: plan kuralı, kod taraması, katlanan kilit, temiz ilerleme (12.11.2026)', () => {
  const sq = read('supabase/migrations/20261112c_kids_temalar_ve_sertlestirme.sql');
  /* Tema sayısı 12→22 çıktı ama kids_plan kuralı eskide kalmıştı: öğretmen
     Fruits seçince kayıt düşüyordu. Kural istemcideki V.KONU ile eşit olmalı. */
  const veri = read('kids/assets/kids-veri.js');
  const konular = (veri.match(/\{ id: '([a-z]+)', en: '[^']+', tr: '[^']+', renk:/g) || [])
    .map((m) => m.match(/id: '([a-z]+)'/)[1]);
  assert.ok(konular.length >= 22, 'tema listesi okunamadı (' + konular.length + ')');
  for (const k of konular) assert.ok(sq.includes("'" + k + "'"), k + ' teması kids_plan kuralında yok — öğretmen o günü planlayamaz');
  /* Okul kodu tahmin edilebilir (addan türer); arama sınırsızsa çocuk adları dökülür. */
  assert.match(sq, /d\.sayi >= 30 then\s*return json_build_object\('hata', 'kilit'/, 'kod araması IP başına sınırlı değil');
  assert.match(sq, /if o\.id is null then\s*insert into kids_kod_deneme[\s\S]*?return json_build_object\('hata', 'yok'/,
    'başarısız arama hata fırlatıyor — sayaç işlemle geri alınır, sınır hiç dolmaz');
  /* Resimli şifre 72 ihtimal: kilit sıfırlanırsa havuz ~1 saatte taranır. */
  assert.match(sq, /least\(5 \* power\(2, kilit_say\)::int, 1440\)/, 'çocuk kilidi katlanmıyor');
  assert.match(sq, /kilit_say = 0 where id = g\.id/, 'doğru girişte katlanan kilit sıfırlanmıyor');
  const bl = read('kids/assets/kids-bulut.js');
  assert.match(bl, /if \(o && o\.hata\) throw new Hata\(/, 'istemci yeni JSON hata biçimini tanımıyor — kod yokken boş okul çizer');
  /* Çocuğun yazdığı ilerleme öğretmen ekranında HTML olarak çalışabiliyordu. */
  const og = read('kids/assets/kids-ogretmen.js');
  assert.ok(og.includes('if (BU) return temizKayit(og[3]);'), 'sunucu ilerlemesi temizlenmeden öğretmen ekranına basılıyor');
  assert.match(og, /function sayi\(v\) \{ v = Number\(v\);/, 'ilerleme sayıları sayıya zorlanmıyor');
  const html = read('kids/index.html');
  assert.ok(html.includes('temizKayit') && html.includes("o.hata === 'kilit'"),
    'kids/index.html yeniden üretilmemiş (node kids/assets/birlestir.js)');
});

summary();
