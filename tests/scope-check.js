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

// TS2554: "Expected N arguments, but got M." Added 2026-10-04 alongside the
// per-model TokenPacer refactor, which gave acquire/record/observeHeaders/
// safeConcurrency a new required `model` parameter. A call site left behind
// would compile under the old shape and fail at runtime (or, worse, pace the
// wrong lane silently). noResolve means anything imported is `any`, so this
// only ever fires on functions declared in the file itself — which is the
// only place we can fix it anyway.
const ARITY_CODE = 2554;

const FILES = [
  'supabase/functions/summarize-document/index.ts',
  'supabase/functions/chat-with-document/index.ts'
].filter(f => fs.existsSync(path.join(__dirname, '..', f)));

function diagnose(relPath) {
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
  const names = new Map();
  const arity = [];
  for (const d of ts.getPreEmitDiagnostics(program)) {
    const line = d.file && typeof d.start === 'number'
      ? d.file.getLineAndCharacterOfPosition(d.start).line + 1
      : 0;
    const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');

    if (d.code === 2304) {                  // "Cannot find name"
      const name = (msg.match(/Cannot find name '([^']+)'/) || [])[1];
      if (!name || EXPECTED_UNRESOLVED.has(name)) continue;
      if (!names.has(name)) names.set(name, line);
    } else if (d.code === ARITY_CODE) {     // "Expected N arguments, but got M"
      arity.push({ line, msg });
    }
  }
  return { names, arity };
}

function unresolvedNames(relPath) {
  return diagnose(relPath).names;
}

for (const relPath of FILES) {
  test(`${relPath}: tanimsiz isim yok`, () => {
    const { names } = diagnose(relPath);
    const detail = [...names.entries()].map(([n, line]) => `satir ${line}: ${n}`).join('\n  ');
    assert.equal(
      names.size, 0,
      `kapsamda olmayan isim(ler) var — canlida ReferenceError olur:\n  ${detail}`
    );
  });

  test(`${relPath}: eksik/fazla argumanli cagri yok`, () => {
    const { arity } = diagnose(relPath);
    const detail = arity.map(a => `satir ${a.line}: ${a.msg}`).join('\n  ');
    assert.equal(
      arity.length, 0,
      `arguman sayisi tutmayan cagri(lar) var:\n  ${detail}`
    );
  });
}

test('kontrol gercekten eksik argumani yakaliyor', () => {
  // Kendini dogrulayan test. Pacer artik model basina calistigi icin
  // acquire(est, model) imzasi zorunlu; model'i unutan bir cagri sessizce
  // YANLIS seridi odeyeceginden derleme asamasinda yakalanmali.
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'),
    'utf8'
  );
  const broken = src.replace(
    'await tokenPacer.acquire(estTokens, model)',
    'await tokenPacer.acquire(estTokens)'
  );
  assert.notEqual(broken, src, 'fixture hedefi bulunamadi — test guncel degil');
  const tmp = path.join(__dirname, '.arity-check-fixture.ts');
  fs.writeFileSync(tmp, broken, 'utf8');
  try {
    const { arity } = diagnose(path.relative(path.join(__dirname, '..'), tmp));
    assert.ok(arity.length > 0, 'eksik argumanli cagri yakalanmaliydi');
  } finally {
    fs.unlinkSync(tmp);
  }
});

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

summary().then(() => process.exit(process.exitCode || 0));
