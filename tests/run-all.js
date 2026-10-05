#!/usr/bin/env node
/* ==========================================================================
   ACADEX — TEST KOSUCUSU (tests/run-all.js)

       node tests/run-all.js

   NEDEN VAR:
   Bu klasorde "her .js bir testtir" diye kosturulunca 05.10.2026'da 7 dosya
   basarisiz gorundu ve bu yanlis bir alarmdi. Gercekte uc AYRI sey vardi ve
   hicbiri "test patladi" degildi:

     - 5 dosya TEST DEGIL. tests/ icine dusmus tarayici kaynak kopyalari
       (presentation-theme-v8, -tools-panel-v9, -visual-ai-v8 js/ ile birebir
       ayni; presentation-chat-v8 ve site-status ise js/'den FARKLI, yani
       bayat). Node onlari calistirinca "window is not defined" diyor —
       dogal, cunku tarayici kodu.
     - 1 dosya CLI araci (map-model-compare, --input istiyor).
     - 2 test, repoda HIC VAR OLMAMIS modulleri cagiriyor
       (js/presentation/core/... — git gecmisinde tek commit bile yok).

   Hepsini "FAIL" diye raporlamak, gercek bir hatayi bu gurultunun icinde
   gorunmez yapiyordu. Bu kosucu ucunu ayirir ve cikis kodunu SADECE gercek
   basarisizlikta sifirdan farkli yapar.
   ========================================================================== */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const TESTS_DIR = __dirname;

/** Dosyanin ne oldugunu icerigine bakarak soyler — isme gore degil. */
function classify(file) {
  const name = path.basename(file);
  if (name.startsWith('_')) return { kind: 'helper', why: 'yardimci modul' };
  if (name === path.basename(__filename)) return { kind: 'self', why: '' };

  const src = fs.readFileSync(file, 'utf8');
  const asserts = (src.match(/assert\./g) || []).length;
  if (asserts === 0) {
    // Tarayici kaynagi mi, komut satiri araci mi? Ayrimi DOGRU yapmak
    // onemli: yanlis etiketli bir rapor, hic rapor olmamasindan daha kotu.
    // Ilk surumde site-status.js "komut satiri araci" diye etiketlendi —
    // oysa tarayici kodu; IIFE ile baslamadigi icin kacmisti.
    const browserish =
      /window\.__acadex/.test(src) ||                 // modul bayragi
      /^\(function\s*\(\)\s*\{/m.test(src) ||         // IIFE sarmalayici
      /\bdocument\.(getElementById|querySelector|createElement)\b/.test(src) ||
      /\bwindow\.[A-Za-z_]/.test(src);                // global'e yazan tarayici kodu
    const cliish = /process\.argv|require\('node:(fs|path)'\).*--/s.test(src) ||
      /\-\-input|\-\-help/.test(src);
    if (browserish && !cliish) {
      // Ayni dosya js/ altinda da varsa bunu soyle: kopya mi, bayat kopya mi?
      const ikiz = path.join(TESTS_DIR, '..', 'js', name);
      let not = 'tarayici kaynak dosyasi — tests/ icinde yeri yok';
      if (fs.existsSync(ikiz)) {
        const ayni = fs.readFileSync(ikiz, 'utf8') === src;
        not = ayni
          ? `js/${name} ile birebir ayni kopya — silinebilir`
          : `js/${name} ile FARKLI: BAYAT kopya, okuyani yaniltir`;
      }
      return { kind: 'not-a-test', why: not };
    }
    return { kind: 'not-a-test', why: 'komut satiri araci, test degil' };
  }
  return { kind: 'test', why: '' };
}

const files = fs.readdirSync(TESTS_DIR)
  .filter(f => f.endsWith('.js'))
  .sort()
  .map(f => path.join(TESTS_DIR, f));

const sonuc = { gecti: [], kaldi: [], eksikModul: [], testDegil: [], yardimci: [] };

for (const file of files) {
  const { kind, why } = classify(file);
  const name = path.basename(file);
  if (kind === 'self') continue;
  if (kind === 'helper') { sonuc.yardimci.push(name); continue; }
  if (kind === 'not-a-test') { sonuc.testDegil.push({ name, why }); continue; }

  try {
    const out = execFileSync(process.execPath, [file], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000
    });
    const m = out.match(/(\d+) test gecti/);
    sonuc.gecti.push({ name, sayi: m ? Number(m[1]) : null });
  } catch (err) {
    const ciktI = `${err.stdout || ''}${err.stderr || ''}`;
    // Eksik bir BAGIMLILIK ile basarisiz bir ASSERT ayni sey degil: biri
    // "kod yok", digeri "kod yanlis". Ikisini ayni kefeye koymak, 05.10'da
    // oldugu gibi, gercek hatayi gormeyi zorlastiriyor.
    const eksik = ciktI.match(/Cannot find module '([^']+)'/);
    if (eksik) sonuc.eksikModul.push({ name, modul: eksik[1] });
    else sonuc.kaldi.push({ name, ozet: (ciktI.match(/^\s*FAIL.*$/m) || [''])[0].trim() || ciktI.trim().split('\n').pop() });
  }
}

const topla = (a) => a.reduce((n, x) => n + (x.sayi || 0), 0);
const satir = '─'.repeat(64);

console.log(`\n${satir}`);
console.log(`GECTI   ${sonuc.gecti.length} dosya, ${topla(sonuc.gecti)} test`);
for (const t of sonuc.gecti) console.log(`  ok    ${t.name}${t.sayi ? `  (${t.sayi})` : ''}`);

if (sonuc.kaldi.length) {
  console.log(`\nBASARISIZ   ${sonuc.kaldi.length} dosya`);
  for (const t of sonuc.kaldi) console.log(`  FAIL  ${t.name}\n        ${t.ozet}`);
}

if (sonuc.eksikModul.length) {
  console.log(`\nKODU OLMAYAN TEST   ${sonuc.eksikModul.length} dosya`);
  console.log('  Bu testler repoda bulunmayan modulleri cagiriyor. Test bozuk');
  console.log('  degil — test ettigi kod repoda yok (git gecmisinde de yok).');
  for (const t of sonuc.eksikModul) console.log(`  --    ${t.name}\n        eksik: ${t.modul}`);
}

if (sonuc.testDegil.length) {
  console.log(`\nTEST DEGIL   ${sonuc.testDegil.length} dosya`);
  for (const t of sonuc.testDegil) console.log(`  --    ${t.name}  (${t.why})`);
}

console.log(satir);
// Sadece GERCEK basarisizlik kirmizi yakar. Eksik modul ve test-olmayan
// dosyalar raporlanir ama kosuyu dusurmez — yoksa bu kosucu da her seferinde
// kirmizi doner ve kimse bakmaz, ki zaten dert tam olarak buydu.
if (sonuc.kaldi.length) {
  console.log(`SONUC: ${sonuc.kaldi.length} gercek basarisizlik\n`);
  process.exit(1);
}
console.log('SONUC: gercek basarisizlik yok\n');
