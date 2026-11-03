/* ==========================================================================
   ACADEX — GELİŞTİRİCİ SANDBOX DENETİMİ (tests/sandbox-denetim.js)

   NEDEN VAR (03.11.2026): sandbox tarayıcıda 55 adımlık bir denetimden geçti (yeni proje,
   5 şablon, düzenleme, dosya ekle / çoğalt / yeniden adlandır / sil + geri al, bul-değiştir,
   çalıştır + konsol, durak + fark, zip ve tek HTML dışa aktarma, ders / teslim, kart zip /
   sil + geri al, veri setleri, Python onayı ve Pyodide inmezse hata, dosya / zip yükleme,
   Acadia düğmeleri, teslim, yenileyince kalıcılık, telefonda taşma). Bulunan üç sorun
   düzeltildi; bu test onların geri gelmemesi için:
     1. Yeni dosyada "yeni.js" yazınca "yeni.js.js" oluyordu (yalnızca ad seçiliydi).
        Uzantısız ad yazılırsa .js eklenir.
     2. 2 MB'ı aşan bir metin dosyası "okunabilir dosya bulamadım" diyordu; artık sınırı söyler.
     3. Etkileşim panelinde canlı bağlantı Acadex'in kendi adresiyse önizlenmez
        (allow-same-origin + allow-scripts aynı kökende kum havuzunu etkisiz bırakırdı).
     Ayrıca: proje önizlemesi allow-same-origin almadan çalışır.
   Çalıştırma:  node tests/sandbox-denetim.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const ink = read('js/acadex-ink.js'), html = read('dashboard.html');

test('yeni dosya: uzantıyı öğrenci seçer, uzantısız ada .js eklenir', () => {
  assert.match(ink, /inp\.setSelectionRange\(0, \(p && inp\.value\.lastIndexOf\('\.'\) > 0 \? inp\.value\.lastIndexOf\('\.'\) : inp\.value\.length\)\);/);
  assert.match(ink, /renameInline\(null, function \(v\) \{ if \(!\/\\\.\[a-z0-9\]\+\$\/i\.test\(base\(v\)\)\) v \+= '\.js';/);
});

test('2 MB sınırı ayrıca söylenir', () => {
  assert.match(ink, /big\.push\(it\.path\.split\('\/'\)\.pop\(\)\)/);
  assert.match(ink, /'Dosya çok büyük: bir projede toplam 2 MB\\'a kadar kod ve metin olabilir\.'/);
});

test('önizleme kum havuzunda; canlı bağlantı Acadex\'in kendi adresi olamaz', () => {
  assert.match(html, /<iframe class="dv-frame" data-frame="" title="Proje önizlemesi" sandbox="allow-scripts allow-modals"><\/iframe>/);
  assert.doesNotMatch(html.match(/<iframe class="dv-frame"[^>]*>/)[0], /allow-same-origin/);
  assert.match(ink, /return lu\.origin === location\.origin \? '' : lu\.href;/);
});

summary();
