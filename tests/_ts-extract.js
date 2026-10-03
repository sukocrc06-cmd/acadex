/* ==========================================================================
   ACADEX — TEST YARDIMCISI: edge function'lardan fonksiyon cikarimi
   (tests/_ts-extract.js)

   Edge function'lar Deno dosyalari: tepe seviyede uzak import ve serve()
   cagrisi var, bu yuzden Node icinde butun halde yuklenemezler. Bu yardimci
   dosyayi TypeScript ile JS'e cevirip SADECE istenen tepe-seviye bildirimleri
   dengeli tarama ile kesip izole bir kapsamda degerlendirir.

   Neden kopyalamak yerine cikarim: prompt/fonksiyon kaynak dosyada
   degistiginde test ya yeni davranisi olcer ya ACIK HATA verir — sessizce
   eski bir kopyayi test etmeye devam etmez.

   Kullanim:
     const { loadFromSource } = require('./_ts-extract.js');
     const fns = loadFromSource('supabase/functions/x/index.ts', ['foo','BAR']);
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

let ts;
try {
  ts = require('typescript');
} catch (_e) {
  console.error(
    '\nBu test `typescript` paketine ihtiyac duyuyor (edge function u JS ye cevirmek icin).\n' +
    'Repo kokunde bir kez:\n\n' +
    '  npm init -y\n' +
    '  npm install --save-dev typescript\n' +
    '  echo "node_modules/" >> .gitignore\n\n' +
    'Bonus: ayni paket edge function larini tip kontrolunden gecirmeyi de saglar:\n' +
    '  npx tsc --noEmit --skipLibCheck --target es2022 --module esnext \\\n' +
    '      --moduleResolution bundler supabase/functions/summarize-document/index.ts\n'
  );
  process.exit(1);
}

/**
 * Kaynak tarayici: string/yorum iceriklerini atlayarak ilerler ve her konumda
 * parantez/brace/bracket derinligini bildirir. Bir `function f(a)` bildiriminde
 * parametre parantezi kapandiginda toplam derinlik sifira doner — gövde daha
 * baslamamistir — bu yuzden sayaclar TURE GORE ayri tutulur.
 */
// Bir '/' karakterinden ONCE gelen bu isaretlerden biri varsa, o '/' bolme
// degil REGEX LITERAL baslatiyor demektir. Gerekli: js/dashboard.js icindeki
// escapeHtml gibi fonksiyonlar `/"/g` ve `/'/g` regexleri tasiyor; naif bir
// tarayici o tirnagi string baslangici sanip parantez sayimini kaybediyor
// (gercekten oldu — bu testler ilk kosusta tam burada patladi).
const REGEX_PRECEDERS = new Set([
  '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';',
  '+', '-', '*', '%', '~', '^', '<', '>', null
]);
const REGEX_PRECEDING_KEYWORDS = /\b(return|typeof|instanceof|in|of|new|delete|void|do|else|case|yield|await)$/;

function scanFrom(js, start, onChar) {
  let i = start;
  let paren = 0, brace = 0, bracket = 0;
  let inStr = null, inLineComment = false, inBlockComment = false;
  let prevSignificant = null;   // son anlamli karakter (bosluk/yorum harici)

  while (i < js.length) {
    const c = js[i], n = js[i + 1];

    if (inLineComment) { if (c === '\n') inLineComment = false; i++; continue; }
    if (inBlockComment) { if (c === '*' && n === '/') { inBlockComment = false; i += 2; continue; } i++; continue; }
    if (inStr) {
      if (c === '\\') { i += 2; continue; }
      if (c === inStr) { inStr = null; prevSignificant = c; }
      i++; continue;
    }

    if (c === '/' && n === '/') { inLineComment = true; i += 2; continue; }
    if (c === '/' && n === '*') { inBlockComment = true; i += 2; continue; }

    if (c === '"' || c === "'" || c === '`') { inStr = c; prevSignificant = c; i++; continue; }

    // Regex literal mi?
    if (c === '/') {
      const before = js.slice(Math.max(0, i - 12), i).replace(/\s+$/, '');
      const isRegex = REGEX_PRECEDERS.has(prevSignificant) || REGEX_PRECEDING_KEYWORDS.test(before);
      if (isRegex) {
        i++;                                   // acilis '/' gecildi
        let inClass = false;
        while (i < js.length) {
          const r = js[i];
          if (r === '\\') { i += 2; continue; }
          if (r === '[') inClass = true;
          else if (r === ']') inClass = false;
          else if (r === '/' && !inClass) { i++; break; }
          else if (r === '\n') break;          // kapanmamis regex — vazgec
          i++;
        }
        while (i < js.length && /[a-z]/.test(js[i])) i++;   // bayraklar (g, i, u, ...)
        prevSignificant = '/';
        continue;
      }
    }

    if (c === '(') paren++; else if (c === ')') paren--;
    else if (c === '{') brace++; else if (c === '}') brace--;
    else if (c === '[') bracket++; else if (c === ']') bracket--;

    if (!/\s/.test(c)) prevSignificant = c;

    const stop = onChar(c, i, { paren, brace, bracket });
    if (stop !== undefined) return stop;
    i++;
  }
  return -1;
}

/** `function NAME(...) {...}` veya `const NAME = ...;` bildiriminin tamamini keser. */
function sliceDeclaration(js, name) {
  const fnM = js.match(new RegExp(`function\\s+${name}\\s*\\(`));
  const constM = js.match(new RegExp(`const\\s+${name}\\s*=`));

  if (fnM) {
    const bodyStart = scanFrom(js, fnM.index, (c, i, d) =>
      (c === '{' && d.paren === 0 && d.brace === 1) ? i : undefined);
    if (bodyStart === -1) throw new Error(`'${name}': fonksiyon gövdesi bulunamadi.`);
    const end = scanFrom(js, bodyStart, (c, i, d) =>
      (c === '}' && d.brace === 0) ? i + 1 : undefined);
    if (end === -1) throw new Error(`'${name}': fonksiyon gövdesi kapanmadi.`);
    return js.slice(fnM.index, end);
  }

  if (constM) {
    const end = scanFrom(js, constM.index, (c, i, d) =>
      (c === ';' && d.paren === 0 && d.brace === 0 && d.bracket === 0) ? i + 1 : undefined);
    if (end === -1) throw new Error(`'${name}': const bildirimi ';' ile bitmiyor.`);
    return js.slice(constM.index, end);
  }

  throw new Error(
    `'${name}' bildirimi bulunamadi.\n` +
    `Yeniden adlandirilmis veya tasinmis olabilir — bu test guncellenmeli.`
  );
}

/** Verilen .ts dosyasindan adi gecen bildirimleri cikarip bir nesne olarak doner. */
function loadFromSource(relativePath, names) {
  const abs = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(__dirname, '..', relativePath);
  if (!fs.existsSync(abs)) throw new Error(`Kaynak bulunamadi: ${abs}`);
  const js = ts.transpileModule(fs.readFileSync(abs, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  }).outputText;
  const body = names.map(n => sliceDeclaration(js, n)).join('\n\n');
  return new Function(`${body}\nreturn { ${names.join(', ')} };`)();
}

/** Kucuk test kosucusu — iki test dosyasi da bunu paylasiyor. */
function makeRunner() {
  const state = { passed: 0 };
  function test(name, fn) {
    try { fn(); state.passed++; console.log(`  ok    ${name}`); }
    catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; }
  }
  function summary() {
    console.log(`\n${state.passed} test gecti${process.exitCode ? ' (BASARISIZ olanlar var)' : ''}\n`);
  }
  return { test, summary, state };
}

module.exports = { loadFromSource, sliceDeclaration, scanFrom, makeRunner };
