#!/usr/bin/env node
/* ==========================================================================
   ACADEX — DEPOLAMA ANAHTARI TESTLERI (tests/upload-key.js)

       node tests/upload-key.js

   NEDEN VAR:
   08.10.2026, canli hata:

     Failed to upload IPPT_Dummy test dosyamız.pdf: Invalid key:
     bf2630f0-.../1791459014821_IPPT_Dummy test dosyamız.pdf

   Supabase Storage nesne anahtarinda sinirli bir karakter kumesi kabul
   ediyor; kod ise dosya adini oldugu gibi anahtara koyuyordu. O adda iki
   sorun vardi: BOSLUK ve Turkce 'ı'. Yani Turkce adlandirilmis ya da
   adinda bosluk olan HER dosya yuklenemiyordu — bu uygulamanin
   kullanicilari (Turkce konusan ogrenciler) icin bu kural, istisna degil.

   Hicbir test dosya adina bakmadigi icin kimse gormemisti.
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sliceDeclaration, makeRunner } = require('./_ts-extract.js');

const DASH = fs.readFileSync(path.join(__dirname, '..', 'js', 'dashboard.js'), 'utf8');

/* YORUMSUZ KOPYA. "Su kalip artik KULLANILMIYOR" turu bir iddia yorumlar
   uzerinde kontrol edilemez: kaldirilan kalip, neden kaldirildigini anlatan
   yorumda adi gecerek kalir ve test kendi aciklamasina takilir. Burada tam
   oyle oldu — storageSafeName'in basligi eski kalibi ornek olarak tasiyor.
   (Ayni hata bu oturumda chat-retrieval.js'te de yapildi.) */
const DASH_KOD = DASH
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const { storageSafeName } = new Function(
  sliceDeclaration(DASH, 'replaceTurkishChars') + '\n' +
  sliceDeclaration(DASH, 'storageSafeName') + '\n' +
  'return { storageSafeName };'
)();

// Supabase Storage'in kabul ettigi kume (muhafazakar okuma): harf, rakam,
// nokta, alt cizgi, tire. Egik cizgi klasor ayraci oldugu icin ADDA olamaz.
const GUVENLI = /^[A-Za-z0-9._-]+$/;

const { test, summary } = makeRunner();

console.log('\nDEPOLAMA ANAHTARI TESTLERI\n');

test('HATAYI VEREN GERCEK AD artik guvenli', () => {
  // Birebir o dosya. Uydurma bir ornek bu hatayi kanitlamaz.
  const out = storageSafeName('IPPT_Dummy test dosyamız.pdf');
  assert.ok(GUVENLI.test(out), `hala gecersiz: "${out}"`);
  assert.ok(out.endsWith('.pdf'), 'uzanti korunmali');
  assert.ok(!/\s/.test(out), 'bosluk kalmamali');
  assert.ok(!/ı|İ|ş|Ş|ğ|Ğ|ü|Ü|ö|Ö|ç|Ç/.test(out), 'Turkce harf kalmamali');
});

test('Turkce harfler okunur karsiliga ceviriliyor', () => {
  // Sadece atmak degil CEVIRMEK onemli: "Ölçme değerlendirme.pdf" adindan
  // geriye "--.pdf" kalirsa kullanici depolamada dosyasini tanimaz.
  const out = storageSafeName('Ölçme değerlendirme çalışması.pdf');
  assert.equal(out, 'Olcme-degerlendirme-calismasi.pdf');
});

test('her tur bozucu karakter temizleniyor', () => {
  for (const ad of [
    'rapor (son hali).pdf',
    'ekonomi — 2. bölüm.pdf',
    'deneme/alt klasor.pdf',
    'a  b   c.pdf',
    '%100 başarı #1.pdf',
    "o'zel ka,rakter;ler.pdf",
  ]) {
    const out = storageSafeName(ad);
    assert.ok(GUVENLI.test(out), `"${ad}" → "${out}" hala gecersiz`);
  }
});

test('uzanti her durumda korunuyor', () => {
  assert.ok(storageSafeName('ödev.docx').endsWith('.docx'));
  assert.ok(storageSafeName('sunum.pptx').endsWith('.pptx'));
  assert.ok(storageSafeName('notlar.TXT').endsWith('.txt'), 'uzanti kucultulmeli');
});

test('adi tamamen elenen dosya BOS anahtar uretmiyor', () => {
  // Tamami Latin disi bir ad (ornegin Cince) temizlenince geriye hicbir sey
  // kalmaz. Bos govde, gecersiz bir anahtar demek.
  for (const ad of ['测试文档.pdf', '!!!.pdf', '   .pdf', '...pdf']) {
    const out = storageSafeName(ad);
    assert.ok(out.length > 0, `"${ad}" bos dondu`);
    assert.ok(GUVENLI.test(out), `"${ad}" → "${out}" gecersiz`);
  }
});

test('cok uzun ad kirpiliyor', () => {
  const out = storageSafeName('a'.repeat(400) + '.pdf');
  assert.ok(out.length <= 95, `${out.length} karakter — anahtar siniri asilabilir`);
  assert.ok(out.endsWith('.pdf'));
});

test('bos/tanimsiz girdi patlatmıyor', () => {
  for (const ad of ['', null, undefined]) {
    const out = storageSafeName(ad);
    assert.ok(typeof out === 'string' && out.length > 0, `"${ad}" bos dondu`);
  }
});

test('HER IKI yukleme yolu da temizleyiciden geciyor', () => {
  /* Iki ayri yerde ayni anahtar kuruluyor (tekli yukleme ve toplu yukleme).
     Birini duzeltip digerini unutmak, hatanin yarisini canli birakirdi. */
  const ham = (DASH_KOD.match(/\$\{Date\.now\(\)\}_\$\{file\.name\}/g) || []).length;
  assert.equal(ham, 0, 'bir yukleme yolu hala ham dosya adi kullaniyor');
  const temiz = (DASH_KOD.match(/\$\{Date\.now\(\)\}_\$\{storageSafeName\(file\.name\)\}/g) || []).length;
  assert.ok(temiz >= 2, `temizlenen yol sayisi ${temiz} — ikisi de olmali`);
});

test('ORIJINAL ad veritabaninda korunuyor', () => {
  // Ekranda gorunen ad degismemeli: yalnizca depolama anahtari temizlenir.
  // "file_name: storageSafeName(...)" yazilsaydi kullanici dosyasini
  // "Olcme-degerlendirme.pdf" diye gorurdu.
  assert.ok(/file_name: file\.name/.test(DASH_KOD),
    'orijinal dosya adi artik saklanmiyor — ekranda bozuk ad gorunur');
  assert.ok(!/file_name: storageSafeName/.test(DASH_KOD),
    'temizlenmis ad veritabanina yazilmamali');
});

test('yukleme hatasinda SUNUCUNUN mesaji gosteriliyor', () => {
  // "Please try again" demek, tekrar denemenin ise yaramayacagi bir hatada
  // (gecersiz anahtar gibi) kullaniciyi bos yere dondurur.
  assert.ok(!/File upload failed\. Please try again\./.test(DASH_KOD),
    'genel mesaj hala sebebi gizliyor');
  assert.ok(/Dosya yüklenemedi: \$\{sebep\}/.test(DASH_KOD),
    'sunucu mesaji gosterilmiyor');
});

summary().then(() => process.exit(process.exitCode || 0));
