/* ==========================================================================
   ACADEX — KAPSAM / TANIMSIZ ISIM KONTROLU (tests/scope-check.js)

   Edge function dosyalarini TypeScript derleyicisine verip SADECE TS2304
   ("Cannot find name") hatalarina bakar.

   NEDEN VAR:
   Diger test dosyalari fonksiyonlari kaynaktan tek tek cikarip calistiriyor
   (tests/_ts-extract.js). Bu yaklasim fonksiyon govdelerini cok iyi test
   ediyor ama serve() icindeki KAPSAM hatalarini goremiyor — cunku o kodu hic
   calistirmiyor.

   2026-10-04'te tam bu acik bir kartı kaybettirdi: visionGroundedClaims
   chunked pipeline blogunun icinde tanimlanmisti, applyGroundingGate ise iki
   pipeline'in paylastigi yolda cagriliyordu. 185 test gecti, deploy edildi, ve
   canlida ~3 dakikalik tamamlanmis isin ardindan soyle patladi:

       ReferenceError: visionGroundedClaims is not defined

   Bu kontrol o hatayi, dosyaya hic dokunmadan, saniyeler icinde yakalar.

   NOT: TypeScript'in Deno URL importlarini cozemedigi icin noResolve aciktir;
   bu yuzden TIP hatalarina degil, sadece "bu isim hicbir kapsamda yok"
   sinifina bakiyoruz. Deno global'i beklenen tek istisna.

   Calistirma:  node tests/scope-check.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { makeRunner } = require('./_ts-extract.js');

const { test, summary } = makeRunner();

let ts;
try {
  ts = require('typescript');
} catch (_err) {
  console.log('typescript bulunamadi — kapsam kontrolu atlandi (npm i -D typescript)');
  process.exit(0);
}

// Cozulemeyecegi bilinen, beklenen global'ler. Deno runtime tarafindan
// saglaniyor ve TypeScript'in standart kutuphanelerinde yok.
const EXPECTED_UNRESOLVED = new Set(['Deno']);

const FILES = [
  'supabase/functions/summarize-document/index.ts',
  'supabase/functions/chat-with-document/index.ts'
].filter(f => fs.existsSync(path.join(__dirname, '..', f)));

function unresolvedNames(relPath) {
  const file = path.join(__dirname, '..', relPath);
  const opts = {
    noResolve: true,            // Deno'nun https:// importlari cozulemez
    allowNonTsExtensions: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts']
  };
  const program = ts.createProgram([file], opts, ts.createCompilerHost(opts));
  const found = new Map();
  for (const d of ts.getPreEmitDiagnostics(program)) {
    if (d.code !== 2304) continue;          // sadece "Cannot find name"
    const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    const name = (msg.match(/Cannot find name '([^']+)'/) || [])[1];
    if (!name || EXPECTED_UNRESOLVED.has(name)) continue;
    if (!found.has(name) && d.file && typeof d.start === 'number') {
      found.set(name, d.file.getLineAndCharacterOfPosition(d.start).line + 1);
    }
  }
  return found;
}

for (const relPath of FILES) {
  test(`${relPath}: tanimsiz isim yok`, () => {
    const found = unresolvedNames(relPath);
    const detail = [...found.entries()].map(([n, line]) => `satir ${line}: ${n}`).join('\n  ');
    assert.equal(
      found.size, 0,
      `kapsamda olmayan isim(ler) var — canlida ReferenceError olur:\n  ${detail}`
    );
  });
}

test('kontrol gercekten bir kapsam hatasi yakaliyor', () => {
  // Kendini dogrulayan test: kasten bozulmus bir kopyada hatayi bulamazsa
  // yukaridaki yesil sonuclar bir sey ifade etmez.
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'),
    'utf8'
  );
  const broken = src.replace(
    'const useChunkedPipeline =',
    'const sadeceIcerideTanimli = kapsamDisiBirIsim\n    const useChunkedPipeline ='
  );
  const tmp = path.join(__dirname, '.scope-check-fixture.ts');
  fs.writeFileSync(tmp, broken, 'utf8');
  try {
    const found = unresolvedNames(path.relative(path.join(__dirname, '..'), tmp));
    assert.ok(found.has('kapsamDisiBirIsim'), 'bozuk kopyada hata yakalanmaliydi');
  } finally {
    fs.unlinkSync(tmp);
  }
});

summary();
process.exit(process.exitCode || 0);
