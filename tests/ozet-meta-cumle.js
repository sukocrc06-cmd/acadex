/* ==========================================================================
   ACADEX — OZETTEN MODEL ACIKLAMALARI (tests/ozet-meta-cumle.js)

   NEDEN VAR (30.10.2026, test raporu R42 / R63): ozetlerde ders icerigi
   olmayan cumleler kaliyordu: "The visible text does not explicitly detail
   specific reasoning methods...". Kural iki yerde:
     supabase/functions/summarize-document/index.ts  yeni ozet kaydedilmeden
     js/dashboard.js (formatSummaryText, PDF)         kayitli eski ozetler
   Iki kopya ayrisirsa yeni ve eski ozetler farkli temizlenir; bu dosya
   ikisinin AYNI girdide AYNI ciktiyi verdigini kilitliyor.

   Calistirma:  node tests/ozet-meta-cumle.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const SUNUCU = loadFromSource('supabase/functions/summarize-document/index.ts', ['AI_META_SENTENCE_RE', 'stripAiMetaSentences']);
const ISTEMCI = loadFromSource('js/dashboard.js', ['AI_META_SENTENCE_RE', 'stripAiMetaSentences']);
const { test, summary } = makeRunner();

const ORNEKLER = [
  ['Regression shows a 9.3% effect. The visible text does not explicitly detail specific reasoning methods used. OLS is BLUE.',
   'Regression shows a 9.3% effect. OLS is BLUE.'],
  ['The provided slides only cover chapter 2. OLS is BLUE.', 'OLS is BLUE.'],
  ['Sağlanan metinde bu yöntem açıkça belirtilmemiş. Varyans sabittir.', 'Varyans sabittir.'],
  ['As an AI, I cannot verify the dataset. Inflation rose.', 'Inflation rose.'],
  // Onceki cumlenin atfi ([1]) meta cumleyle birlikte silinmemeli.
  ['Inflation rose. [1] The visible text does not explicitly detail methods. OLS is BLUE.',
   'Inflation rose. [1] OLS is BLUE.'],
];
// Icerik cumleleri ve girintiler: eslesme yoksa metin BIREBIR ayni kalir.
const DOKUNMA = [
  'The text explains that firms do not invest.',
  'This document does not cover X.',
  '- Ana madde\n  - Alt madde (iki bosluk girinti)\n',
  'Satir sonu  \nkorunur.',
];

test('sunucu ve istemci ayni cumleleri atiyor', () => {
  for (const [girdi, beklenen] of ORNEKLER) {
    assert.equal(SUNUCU.stripAiMetaSentences(girdi), beklenen, 'sunucu: ' + girdi);
    assert.equal(ISTEMCI.stripAiMetaSentences(girdi), beklenen, 'istemci: ' + girdi);
  }
});

test('eslesme yoksa metne hic dokunulmuyor (girinti ve satir sonu korunur)', () => {
  for (const t of DOKUNMA) {
    assert.equal(SUNUCU.stripAiMetaSentences(t), t);
    assert.equal(ISTEMCI.stripAiMetaSentences(t), t);
  }
});

test('iki kopyanin deseni birebir ayni', () => {
  assert.equal(SUNUCU.AI_META_SENTENCE_RE.source, ISTEMCI.AI_META_SENTENCE_RE.source);
  assert.equal(SUNUCU.AI_META_SENTENCE_RE.flags, ISTEMCI.AI_META_SENTENCE_RE.flags);
});

test('global bayrakli desen ard arda cagrida sasirmiyor (lastIndex)', () => {
  const t = ORNEKLER[0][0];
  assert.equal(ISTEMCI.stripAiMetaSentences(t), ISTEMCI.stripAiMetaSentences(t));
});

summary();
