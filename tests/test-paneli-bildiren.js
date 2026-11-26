/* ==========================================================================
   tests/test-paneli-bildiren.js · 27.11.2026 Test Paneli "Bildir": bildiren seçimi ve kayıp olmayan gönderim
   Sorun (Şevval, Kids testi): "new row violates row-level security policy". Görüntü, sayfa açılırken
   alınan kullanıcının klasörüne yükleniyordu; tarayıcıda hesap değişince depo reddediyor, görüntü
   yüklenemeyince bütün kayıt kayboluyordu. Kayıt da o tarayıcıdaki hesabın adına düşüyordu.
     - gönderirken o anki oturum okunur/tazelenir; görüntü klasörü O oturumun kullanıcısı
     - görüntü yüklenemezse kayıt görüntüsüz gider; satır gidemezse kayıt cihazda bekler
     - "Kim bildiriyor?" → reporter_email; sunucu yalnız ekip üyesini kabul eder
     - panel kaydı bildirenin adıyla gösterir, gönderen hesap ayrıca not edilir
   Çalıştırma:  node tests/test-paneli-bildiren.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const js = read('js/acadex-test.js'), panel = read('panel.html'), sql = read('supabase/migrations/20261127_tp_bildiren.sql');

test('görüntü o anki oturumun klasörüne gider (sayfa açılışındaki kullanıcıya değil)', () => {
  assert.match(js, /async function oturum\(c\)/);
  assert.match(js, /var s1 = await oturum\(c\); if \(!s1\) throw new Error\('JWT oturum yok'\);/);
  assert.match(js, /path = s1\.user\.id \+ '\/'/);
  assert.doesNotMatch(js, /path = USER\.id/, 'eski: önbellekteki kullanıcı');
  assert.match(js, /c\.auth\.refreshSession\(\)/, 'süresi dolmak üzereyse tazelenir');
});

test('kayıt kaybolmaz: görüntüsüz gider ya da cihazda bekler, sonra kendiliğinden gönderilir', () => {
  assert.match(js, /catch \(e\) \{ eksik\+\+;/, 'yüklenemeyen görüntü kaydı düşürmez');
  assert.match(js, /' görüntü yüklenemedi; kayıt görüntüsüz gönderildi/);
  assert.match(js, /var neden = turkce\(e\), ok = await beklet\(kayit, st\.shots\);/);
  assert.match(js, /window\.addEventListener\('online', bosalt\);/);
  assert.match(js, /LS_KUYRUK = 'axt-kuyruk'/);
  assert.match(js, /if \(!lsKoy\(LS_KUYRUK, k\)\) \{ k\[k\.length - 1\]\.gorsel = \[\];/, 'yer yoksa görüntüsüz saklanır');
});

test('Türkçe hatalar: RLS ve bağlantı hataları ne yapılacağını söyler', () => {
  assert.match(js, /row-level security\|violates row/);
  assert.match(js, /acadex\.com\.tr\\'de yeniden giriş yapınca kendiliğinden gönderilecek/);
  assert.match(js, /İnternet bağlantısı yok gibi görünüyor/);
});

test('Kim bildiriyor: ekip listesi, cihaz hatırlar; eski şemada detaya yazılır', () => {
  assert.match(js, /data-axt-kim="/); assert.match(js, /lsKoy\(LS_BILDIREN, st\.bildiren\)/);
  assert.match(js, /reporter_email: bk \? bk\.email : null/);
  assert.match(js, /if \(res\.error && \/reporter_email\/\.test\(res\.error\.message \|\| ''\)\) \{ delete row\.reporter_email; row\.detail = Object\.assign\(\{\}, row\.detail, \{ bildiren: kayit\.reporter_email \}\);/);
  assert.match(js, /' adına' \+ \(bk && ME && bk\.email !== ME\.email \? ' · ' \+ esc\(ME\.name\) \+ ' hesabından'/);
});

test('sunucu: bildiren yalnız ekipten; yazar hesabı değişmez; bildiren kendi kaydını düzenler/siler', () => {
  assert.match(sql, /add column if not exists reporter_email text/);
  assert.match(sql, /if new\.reporter_email = '' or not exists \(select 1 from tp_members m where m\.email = new\.reporter_email\) then\s+new\.reporter_email := me;/);
  assert.match(sql, /new\.author_email := me; new\.author_id := auth\.uid\(\);/, 'gönderen hesap sunucuda yazılır');
  assert.match(sql, /new\.reporter_email := old\.reporter_email;/, 'sonradan değiştirilemez');
  assert.match(sql, /coalesce\(old\.reporter_email, ''\) <> me/);
  assert.match(sql, /reporter_email = public\.tp_my_email\(\) or public\.tp_is_owner\(\)/);
});

test('panel: kayıt bildirenin adıyla; gönderen hesap ayrı not', () => {
  assert.match(panel, /var kimin = function \(it\) \{ return String\(it\.reporter_email \|\| \(it\.detail && it\.detail\.bildiren\) \|\| it\.author_email \|\| ''\)\.toLowerCase\(\); \};/);
  assert.doesNotMatch(panel, /memberOf\(it\.author_email\)\.name, d\.olan/);
  assert.match(panel, /if \(f\.mine && kimin\(it\) !== S\.me\.email\) return false;/);
  assert.match(panel, /' hesabından\)<\/small>'/);
});

summary();
