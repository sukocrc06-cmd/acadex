/* ==========================================================================
   ACADEX — STUDY LAB POMODORO BİLDİRİMİ (tests/studylab-pomodoro.js)

   NEDEN VAR (29.10.2026, kullanıcı raporu): "Study Lab'de pomodoro yapınca
   25 dk bitince bildirim gelmiyor."

   Teşhis: pomComplete() biterken yalnızca üç sinyal vardı ve üçü de
   öğrenci sayfaya BAKMIYORSA işe yaramıyor:

     beep()       Web Audio; sekme gizliyken tarayıcı kısabiliyor
     say()        sayfa içi bildirim; Study Lab ekranda değilse hiç görünmez
     flashTitle() yalnızca sekme başlığı, üstelik başında
                  `if (!document.hidden) return` var

   İşletim sistemi bildirimi hiç yoktu: js/acadex-ink.js'in 8000-8600
   aralığında tek bir window.axNotify çağrısı geçmiyordu. Planlayıcı aynı
   işi axNotify ile doğru yapıyor (bkz. axRemind), Study Lab o yolu hiç
   kullanmıyordu. 25 dakikalık odağın tam amacı başka bir sekmede çalışmak
   olduğu için hata tam orada görünüyor.

   Çalıştırma:  node tests/studylab-pomodoro.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js/acadex-ink.js'), 'utf8').replace(/\r\n/g, '\n');

/* Yardımcılar kapalı (closure) fonksiyonlar: kaynaktan kesilip GERÇEKTEN
   koşturuluyor. Yalnızca window.axNotify ve Notification'a dokunuyorlar,
   yani DOM'a ihtiyaç yok — iddialar grep değil davranış ölçüyor. */
function yardimcilariYukle(sahteWindow, sahteNotification) {
  const bas = SRC.indexOf('var pomNotify = function (title, body) {');
  const son = SRC.indexOf('var pomStart = function (phase) {');
  assert.ok(bas > 0, 'pomNotify kaynakta yok');
  assert.ok(son > bas, 'pomIzinIste ile pomStart sırası bozulmuş');
  const kod = SRC.slice(bas, son);
  /* Tarayicida window.Notification ile ciplak Notification AYNI nesnedir;
     pomIzinIste once `'Notification' in window` bakiyor sonra ciplak adi
     kullaniyor. Sahte de oyle kurulmali, yoksa test gercegi olcmez. */
  if (sahteNotification !== undefined) sahteWindow.Notification = sahteNotification;
  const kutu = { window: sahteWindow, Notification: sahteNotification };
  kutu.globalThis = kutu;
  vm.createContext(kutu);
  vm.runInContext(kod + '\n;({ pomNotify: pomNotify, pomIzinIste: pomIzinIste });', kutu);
  return vm.runInContext('({ pomNotify: pomNotify, pomIzinIste: pomIzinIste })', kutu);
}

test('pomNotify OS bildirimini axNotify ile gonderiyor', () => {
  const cagrilar = [];
  const w = { axNotify: (t, o) => { cagrilar.push([t, o]); return Promise.resolve(true); } };
  const { pomNotify } = yardimcilariYukle(w, { permission: 'granted' });
  pomNotify('3. tur bitti · Acadex', '5 dk mola; bitkini sula.');
  assert.equal(cagrilar.length, 1, 'axNotify cagrilmadi');
  const [baslik, opt] = cagrilar[0];
  assert.equal(baslik, '3. tur bitti · Acadex');
  assert.equal(opt.body, '5 dk mola; bitkini sula.');
  /* Ayni etiket + renotify: ust uste turlar bildirim yigmiyor, sonuncusu
     oncekini degistiriyor. renotify olmadan sessiz degisirdi. */
  assert.equal(opt.tag, 'acadex-pomodoro');
  assert.equal(opt.renotify, true);
  /* sw.js notificationclick bu adresi kullaniyor; studylab'e gitmeli. */
  assert.match(String(opt.data && opt.data.url), /#studylab$/);
});

test('axNotify YOKSA sessizce geciyor (ozet akisi gibi dusmemeli)', () => {
  const { pomNotify } = yardimcilariYukle({}, { permission: 'granted' });
  assert.doesNotThrow(() => pomNotify('bir', 'iki'));
  // axNotify patlasa bile tur akisi kesilmemeli.
  const { pomNotify: p2 } = yardimcilariYukle({ axNotify: () => { throw new Error('patladi'); } }, { permission: 'granted' });
  assert.doesNotThrow(() => p2('bir', 'iki'));
});

test('izin YALNIZCA default iken isteniyor', () => {
  /* Taraýicilar kullanici hareketi olmadan sormayi reddediyor; istek
     "odagi baslat" tiklamasinda. Zaten verilmis ya da reddedilmis izni
     tekrar sormak kullaniciyi rahatsiz eder ve hicbir sey degistirmez. */
  for (const [izin, beklenen] of [['default', 1], ['granted', 0], ['denied', 0]]) {
    let sayac = 0;
    const N = { permission: izin, requestPermission: () => { sayac++; return Promise.resolve(izin); } };
    const { pomIzinIste } = yardimcilariYukle({}, N);
    pomIzinIste();
    assert.equal(sayac, beklenen, `izin=${izin} iken istek sayisi`);
  }
});

test('Notification API yoksa izin istegi patlamiyor', () => {
  const { pomIzinIste } = yardimcilariYukle({}, undefined);
  assert.doesNotThrow(() => pomIzinIste());
});

test('ODAK BITISI bildirim gonderiyor (sira degismezi)', () => {
  /* Bildirim pomStart("break") CAGRILMADAN once gitmeli: round ve mola
     suresi o anda hala bitmis turun degerleri. */
  const i = SRC.indexOf("flashTitle('\u{1F33C} Tur bitti · Acadex')");
  const j = SRC.indexOf("pomNotify(POM.round + '. tur bitti");
  const k = SRC.indexOf("pomStart('break')");
  assert.ok(i > 0 && j > 0 && k > 0, 'odak bitisi dali bulunamadi');
  assert.ok(i < j && j < k, 'bildirim flashTitle ile pomStart arasinda olmali');
});

test('MOLA BITISI de bildirim gonderiyor', () => {
  const blok = SRC.slice(SRC.indexOf("say('Mola bitti."), SRC.indexOf("say('Mola bitti.") + 400);
  assert.match(blok, /pomNotify\('Mola bitti/, 'mola bitisinde OS bildirimi yok');
});

test('ODAGI BASLAT dugmesi izin istiyor', () => {
  const blok = SRC.slice(SRC.indexOf("Q('[data-pgo]', st).addEventListener"), SRC.indexOf("Q('[data-pskip]', st).addEventListener"));
  /* YAN YANA OLMA SARTI KALKTI (30.10.2026): 25843fb commit'i iPad icin
     arasina pomIosIpucu() ekledi — mesru bir degisiklik. Onemli olan
     komsuluk degil SIRA: izin, odak baslatilmadan once istenmeli. */
  const i = blok.indexOf('pomIzinIste()');
  const j = blok.indexOf("pomStart('focus')");
  assert.ok(i > -1, 'izin istegi odagi baslat tiklamasinda yok');
  assert.ok(j > -1 && i < j, 'izin istegi pomStart tan ONCE olmali');
});

test('ESKI SINYALLER KORUNDU: beep, sayfa ici bildirim, sekme basligi', () => {
  /* Bildirim EKLENDI, hicbiri KALDIRILMADI: izin reddedilirse eski
     davranis aynen devam etmeli. */
  const blok = SRC.slice(SRC.indexOf('var pomComplete = function'), SRC.indexOf('var pomWilt = function'));
  assert.ok(/beep\(\)/.test(blok), 'beep kaldirilmis');
  assert.ok(/say\(/.test(blok), 'sayfa ici bildirim kaldirilmis');
  assert.ok((blok.match(/flashTitle\(/g) || []).length === 2, 'iki dalda da sekme basligi olmali');
  assert.ok((blok.match(/pomNotify\(/g) || []).length === 2, 'iki dalda da OS bildirimi olmali');
});

test('flashTitle TEK BASINA yetmezdi (hatanin sebebi kayitli)', () => {
  /* Bu iddia duzeltmeyi degil TESHISI kilitliyor: flashTitle sayfaya
     bakarken hic calismiyor, yani "bildirim geldi" sanilamaz. */
  const f = SRC.slice(SRC.indexOf('var flashTitle = function'), SRC.indexOf('var pomNotify = function'));
  assert.match(f, /if \(!document\.hidden\) return/,
    'flashTitle davranisi degismis — teshis notu guncellenmeli');
});

/* #95 (30.10.2026, test paneli, iPad · Safari): "sure bitiminde bildirim
   vermedi". iPad Safari sekmesinde Notification yok, ses motoru kilit
   ekrandan sonra askida kaliyor, say() yalnizca Study Lab acikken gorunuyor.
   Duzeltme: her iki dalda kalici "tur bitti" penceresi + ses motorunu
   dokunusta uyandirma + iPad'e bir kerelik "Ana Ekrana ekle" ipucu. */
test('#95 iki dalda da kalici uyari penceresi aciliyor', () => {
  const blok = SRC.slice(SRC.indexOf('var pomComplete = function'), SRC.indexOf('var pomWilt = function'));
  assert.equal((blok.match(/pomAlert\(/g) || []).length, 2, 'tur ve mola bitisinde pomAlert olmali');
  const f = SRC.slice(SRC.indexOf('var pomAlert = function'), SRC.indexOf('var pomIosIpucu = function'));
  assert.match(f, /role', 'alertdialog'/);
  assert.match(f, /addEventListener\('click', function \(\) \{ beep\(\); d\.remove\(\); \}\)/, 'Tamam dokunusu sesi calmali (iOS kullanici hareketi)');
});

test('#95 askiya alinmis ses motoru uyandiriliyor', () => {
  const b = SRC.slice(SRC.indexOf('var beep = function'), SRC.indexOf('var titleOrig'));
  assert.match(b, /if \(ac\.state !== 'running' && ac\.resume\) ac\.resume\(\)/);
  assert.match(SRC, /document\.addEventListener\('pointerdown', function \(\) \{\n\s+if \(POM\.phase === 'idle' \|\| !beep\.ac/);
});

test('#95 yeni kod pomNotify..pomStart araliginin DISINDA (bu dosyanin vm testi DOMsuz)', () => {
  const a = SRC.indexOf('var pomNotify = function'), z = SRC.indexOf('var pomStart = function');
  const ara = SRC.slice(a, z);
  assert.ok(!/pomAlert|pomIosIpucu|document\.addEventListener/.test(ara));
  assert.match(SRC, /pomIzinIste\(\); pomIosIpucu\(\); pomStart\('focus'\)/, 'ipucu odak baslatilirken gosterilmeli');
});

summary();
