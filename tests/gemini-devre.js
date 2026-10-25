/* ==========================================================================
   ACADEX — GEMINI DEVRE KESICI + ISCI NOBETCISI (tests/gemini-devre.js)

   NEDEN VAR (25.10.2026, BF415 Week01 Ch01 "isleniyor %25"te kaldi):
     23.10'dan beri Gemini her kosuda olu akis veriyordu (ilk byte 15 sn,
     sonra 72 sn olay yok, 87 sn'de dusus). Groq yedek yolu ancak ondan sonra
     basliyor, 49 sayfalik belgede TokenPacer 57 sn bekledi ve isci 150 sn'de
     546 ile kapatildi; belge 'processing' kaldi.
       - Gemini olu akis/gecici hata verince 30 dk devre kesici acilir,
         bu surede Gemini denenmez, Groq butun butceyle baslar.
       - Devre acikken uretilen kart onbellege kalici yazilmaz.
       - 141. saniyede belge hala 'processing' ise 'failed' isaretlenir.
       - Istemci 546/504 alirsa belgeyi 'failed' yapar (tekrar dene).

   Calistirma:  node tests/gemini-devre.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const src = read('supabase/functions/summarize-document/index.ts');
const { test, summary } = makeRunner();

test('devre kesici sabitleri ve site_settings anahtari', () => {
  assert.match(src, /const GEMINI_DEVRE_MS = 30 \* 60_000/);
  assert.match(src, /const GEMINI_DEVRE_ANAHTAR = 'gemini_devre'/);
  assert.match(src, /async function geminiDevreOku\(/);
  assert.match(src, /async function geminiDevreAc\(/);
});

test('devre acikken Gemini denenmez ve kart onbellege kalici yazilmaz', () => {
  const kapi = src.indexOf('} else if (devre && devre.acik) {');
  const cagri = src.indexOf('geminiResult = await geminiDraft(');
  assert.ok(kapi > 0 && cagri > kapi, 'devre kapisi geminiDraft cagrisindan once olmali');
  const dal = src.slice(kapi, src.indexOf('} else if (!geminiMime)', kapi));
  assert.match(dal, /geminiTani\.geciciDustu = true/);
});

test('olu akis/gecici hatada devre acilir', () => {
  const cagri = src.indexOf('geminiResult = await geminiDraft(');
  const sonra = src.slice(cagri, cagri + 6000);
  assert.match(sonra, /if \(!geminiResult && geminiTani\.geciciDustu\) \{\n\s*await geminiDevreAc\(serviceClient/);
});

test('isci nobetcisi 150 sn sinirindan once failed yazar', () => {
  const m = src.match(/const ISCI_NOBET_MS = (\d+)_(\d+)/);
  assert.ok(m, 'ISCI_NOBET_MS tanimli olmali');
  const ms = Number(m[1] + m[2]);
  assert.ok(ms < 150000 && ms > 120000, 'nobet 120-150 sn arasinda olmali: ' + ms);
  const i = src.indexOf("// Isci nobetcisi");
  assert.ok(i > src.indexOf(".update({ status: 'processing' })"), 'nobetci processing yazildiktan sonra kurulmali');
  const blok = src.slice(i, i + 1200);
  assert.match(blok, /durumSatiri\.status === 'processing'/);
  assert.match(blok, /await markFailed\(serviceClient, documentId\)/);
  assert.match(blok, /unrefTimer/);
});

test('istemci 546/504 de belgeyi failed yapar', () => {
  const d = read('js/dashboard.js');
  assert.match(d, /if \(httpDurum === 546 \|\| httpDurum === 504\) \{\n\s*await supabaseClient\.from\('documents'\)\.update\(\{ status: 'failed' \}\)\.eq\('id', docId\)\.eq\('status', 'processing'\);/);
});

summary();
