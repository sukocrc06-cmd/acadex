/* ==========================================================================
   ACADEX — GERI TUSU VE YENILEME (tests/geri-tusu.js)

   NEDEN VAR (25.10.2026, test raporu R33, R75):
     R33  Yenileyince ya da ozetten geri donunce hep ana sayfa aciliyordu.
          Sekme gecmise yazilmiyordu; ustelik Ayarlar acilista adresi
          #settings yapiyordu.
     R75  Telefonda geri tusu panelden cikip giris sayfasina donuyordu;
          tarayici o sayfayi onbellekten (bfcache) getirdigi icin oturum
          kontrolu calismiyor, kullanici "oturumdan atildim" saniyordu.
       - Her sekme #sekme olarak gecmise yazilir, popstate sekmeyi acar.
       - Yenilemede adresteki #sekme acilir.
       - Ozet penceresi acikken geri tusu once pencereyi kapatir.
       - Giris -> panel gecisi location.replace ile (giris gecmiste kalmaz).
       - Giris/kayit sayfasi onbellekten donunce oturum yeniden kontrol edilir.

   Calistirma:  node tests/geri-tusu.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const dash = read('js/dashboard.js');
const ink = read('js/acadex-ink.js');
const auth = read('js/auth.js');
const login = read('login.html');
const { test, summary } = makeRunner();

function body(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, head + ' bulunamadi');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  throw new Error(head + ' kapanmadi');
}

test('R33 sekme degisimi gecmise #sekme olarak yazilir', () => {
  const b = body(dash, 'function axNavInstall(');
  assert.match(b, /history\.pushState\(\{ axv: v \}, '', '#' \+ v\)/);
  assert.match(b, /addEventListener\('popstate'/);
  assert.match(b, /axNavFromPop = true/);
});

test('R33 yenilemede adresteki sekme acilir, kurulum ilk acilistan sonra', () => {
  const b = body(dash, 'async function checkSessionAndLoadProfile(');
  const h = b.indexOf('axNavHashView()');
  const sw = b.indexOf('switchDashboardView(currentActiveTab)');
  const ins = b.indexOf('axNavInstall(currentActiveTab)');
  assert.ok(h > 0 && h < sw && sw < ins);
});

test('R33 ozet penceresi acikken geri tusu pencereyi kapatir', () => {
  const b = body(dash, 'function axNavInstall(');
  assert.match(b, /if \(axNavModalOpen\(\)\)[\s\S]*closeStudyCardModal\(\)/);
  assert.match(b, /axm: 1/);
  assert.match(b, /history\.back\(\)/);
});

test('R33 Ayarlar acilista adresi #settings yapmaz', () => {
  assert.doesNotMatch(ink, /history\.replaceState\(null, '', '#settings'\)/);
  assert.match(ink, /=== 'settings'\) \{ try \{ history\.replaceState\(\{ axv: 'settings' \}/);
});

test('R75 giris sonrasi panele replace ile gidilir', () => {
  assert.doesNotMatch(auth, /window\.location\.href = await getPostLoginDestination/);
  assert.doesNotMatch(auth, /window\.location\.href = destination/);
  assert.doesNotMatch(auth, /window\.location\.href = "dashboard\.html"/);
  assert.match(login, /go\.done = true; window\.location\.replace\(destination\)/);
});

test('R75 giris sayfasi onbellekten donunce oturum yeniden kontrol edilir', () => {
  assert.match(auth, /addEventListener\('pageshow'[\s\S]{0,200}if \(!e\.persisted\) return;/);
  assert.match(auth, /if \(session\) window\.location\.replace\(await getPostLoginDestination/);
});

summary();
