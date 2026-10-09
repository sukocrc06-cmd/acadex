#!/usr/bin/env node
/* ==========================================================================
   ACADEX — SUNUM YUKLEYICI TESTLERI (tests/presentation-loader.js)

       node tests/presentation-loader.js

   NEDEN VAR:
   06.10.2026'da js/site-status.js, HER dashboard acilisinda 13 sunum
   betigini (161 KB) yukluyordu. Hepsi #presentation-view gorunumu icin
   yazilmisti ve o gorunume GIDILEMIYOR: kenar cubugunda yok, derin
   baglantisi yok, gecerli sekme listelerinde yok. Ustelik sardiklari
   renderActivePresentationSlide fonksiyonu repoda hic tanimli degil.

   Yukleme durduruldu, DOSYALAR SILINMEDI.

   Bu dosya IKI YONLU bir mandal:
     - yukleme sessizce geri gelirse test duser
     - gorunum ERISILEBILIR hale gelirse de test duser ve yuklemenin geri
       gelmesi gerektigini soyler

   Ikinci yon, birincisi kadar onemli: biri sunum sekmesini kenar cubuguna
   ekleyip modullerin yuklenmedigini fark etmezse, calismayan bir ozellik
   yayina cikar.
   ========================================================================== */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');

const KOK = path.join(__dirname, '..');
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');

const LOADER = oku('js/site-status.js');
const DASH_HTML = oku('dashboard.html');

// Yorumsuz kopya: bu dosyadaki iddialarin cogu "su satir ARTIK YOK"
// seklinde, ve kaldirilan sey nedenini anlatan yorumda adi gecerek kalir.
// (Ayni tuzaga chat-retrieval.js'te bir kez dusuldu.)
const LOADER_KOD = LOADER
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const MODULLER = [
  'presentation-model-v7', 'presentation-renderer-v7', 'presentation-studio-v73',
  'presentation-controls-v7', 'presentation-modal-scroll-v7', 'presentation-export-v8',
  'presentation-theme-v8', 'presentation-settings-v8', 'presentation-dedupe-v8',
  'presentation-visual-ai-v8', 'presentation-visual-ux-v8', 'presentation-polish-v8',
  'presentation-hd-v9',
];

const { test, summary } = makeRunner();

console.log('\nSUNUM YUKLEYICI TESTLERI\n');

test('13 sunum modulu her acilista YUKLENMIYOR', () => {
  const yuklenen = MODULLER.filter(m => LOADER_KOD.includes(m));
  assert.deepEqual(yuklenen, [],
    'su modul(ler) yine her dashboard acilisinda yukleniyor: ' + yuklenen.join(', ') +
    '\n  Erisilemeyen bir gorunum icin 161 KB ve 13 istek.');
});

test('dosyalarin kendisi DURUYOR — silinmediler', () => {
  // Kazancin tamami yukleyiciden geliyor. Dosyalari tutmak hem baska bir
  // gelistiricinin emegini korur hem de geri almayi tek satirlik is yapar.
  for (const m of MODULLER) {
    assert.ok(fs.existsSync(path.join(KOK, 'js', `${m}.js`)),
      `js/${m}.js silinmis — yukleyiciyi geri almak artik mumkun degil`);
  }
});

test('MANDALIN DIGER YONU: gorunum hala erisilemez', () => {
  /* Bu test "sunum gorunumu calismiyor" demiyor; "yuklemeyi kaldirma
     gerekcesi hala gecerli mi" diye soruyor. Biri sekmeyi kenar cubuguna
     eklerse gerekce coker ve moduller geri gelmeli. */
  const cagrilar = [...DASH_HTML.matchAll(/switchDashboardView\('([a-z-]+)'\)/g)]
    .map(m => m[1]);
  assert.ok(cagrilar.length >= 10, `kenar cubugu taramasi bozuk (${cagrilar.length} gorunum)`);
  assert.ok(!cagrilar.includes('presentation'),
    'presentation gorunumu artik ERISILEBILIR — 13 modulun yuklenmesi ' +
    'js/site-status.js icinde geri getirilmeli, yoksa sekme bos acilir');
});

test('sardiklari fonksiyon hala tanimsiz', () => {
  /* Moduller renderActivePresentationSlide'i sarmaliyor ama o fonksiyon
     repoda hic tanimli degil — sadece sarmalayicilar var. Biri gercek
     fonksiyonu yazarsa, modulleri geri yuklemek anlamli hale gelir. */
  const dash = oku('js/dashboard.js');
  const tanim = /function renderActivePresentationSlide\s*\(|renderActivePresentationSlide\s*=\s*(async\s*)?(function|\()/
    .test(dash);
  assert.ok(!tanim,
    'renderActivePresentationSlide artik dashboard.js icinde TANIMLI — ' +
    'sunum katmani canlanmis olabilir, yukleyici gozden gecirilmeli');
});

test('sunum disi kod bu modullerin globallerini cagirmiyor', () => {
  /* Kaldirmanin guvenli oldugu iddiasinin temeli. Biri yarin dashboard.js
     icinden AcadexPresentationThemeV8 cagirirsa, modul yuklenmedigi icin
     sessizce undefined olur — bu test onu once yakalar. */
  const semboller = [];
  for (const m of MODULLER) {
    const src = oku(path.join('js', `${m}.js`));
    for (const mm of src.matchAll(/window\.(Acadex[A-Za-z0-9_]+)\s*=/g)) {
      if (!semboller.includes(mm[1])) semboller.push(mm[1]);
    }
  }
  assert.ok(semboller.length >= 10, `sembol taramasi bozuk (${semboller.length})`);

  const disaridakiler = ['js/dashboard.js', 'js/main.js', 'js/i18n.js',
    'js/achievements.js', 'js/site-status.js', 'dashboard.html', 'acadex-sunum.html'];
  const ihlaller = [];
  for (const dosya of disaridakiler) {
    const src = oku(dosya);
    for (const s of semboller) {
      if (new RegExp(`\\b${s}\\b`).test(src)) ihlaller.push(`${dosya} → ${s}`);
    }
  }
  assert.deepEqual(ihlaller, [],
    'sunum disi kod, artik yuklenmeyen bir modulun globalini cagiriyor:\n  ' +
    ihlaller.join('\n  '));
});

test('yukleyici hala gecerli JavaScript', () => {
  // Blok silinirken bir parantez eksik kalirsa site-status.js tamamen
  // calismaz — ve o dosya bakim banneri ile site ayarlarini da yukluyor,
  // yani sunumla ilgisi olmayan seyler de dusser.
  assert.doesNotThrow(() => new Function(LOADER), 'site-status.js ayristirilamiyor');
  assert.ok(/acadexGetSiteSettings/.test(LOADER_KOD), 'site ayarlari yuklemesi kaybolmus');
  assert.ok(/acadexRenderBanner/.test(LOADER_KOD), 'banner yuklemesi kaybolmus');
});

summary().then(() => process.exit(process.exitCode || 0));
