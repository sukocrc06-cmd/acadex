/* ==========================================================================
   ACADEX — LANDING PAKETLER PENCERESİ TESTLERİ (tests/landing-paketler.js)

   NEDEN VAR (29.10.2026): paketler penceresi telefonda ve tablette üç sütun
   sıkışıyordu. Sebep: tablet kurallarından sonra kalmış fazladan bir "}".
   CSS ayrıştırıcısı bu artık parantezi bir sonraki kuralın başı sayıp telefon
   @media bloğunu bütünüyle yok sayıyordu.
     - index.html'deki her <style> bloğunda { ve } dengeli olmalı (yorumlar ve
       metinler hariç)
     - telefonda (≤600px) tek sütun, tablet dikeyde (601–900px) tek sütun yatay kart
   Çalıştırma:  node tests/landing-paketler.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const clean = (c) => c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');

test('index.html: her <style> bloğunda süslü parantezler dengeli ve hiç eksiye düşmüyor', () => {
  assert.ok(styles.length > 0);
  styles.forEach((c, i) => {
    let d = 0, line = 1;
    for (const ch of clean(c)) {
      if (ch === '\n') line++;
      if (ch === '{') d++;
      if (ch === '}') { d--; assert.ok(d >= 0, (i + 1) + '. <style> bloğunda ' + line + '. satırda fazladan "}"'); }
    }
    assert.equal(d, 0, (i + 1) + '. <style> bloğunda kapanmayan "{"');
  });
});
test('paketler: telefonda tek sütun, tablet dikeyde yatay kart, "Beta\'ya katıl" altta sabit', () => {
  const css = clean(styles.find((c) => c.includes('.pkt-cards')));
  const block = (q) => { const i = css.indexOf(q); assert.ok(i >= 0, q + ' yok'); let d = 0, j = css.indexOf('{', i); const s = j; for (; j < css.length; j++) { if (css[j] === '{') d++; if (css[j] === '}' && --d === 0) break; } return css.slice(s, j + 1); };
  const phone = block('@media (max-width:600px)'), tab = block('@media (min-width:601px) and (max-width:900px)');
  assert.match(phone, /\.pkt-cards\{grid-template-columns:1fr/);
  assert.match(phone, /\.pkt-foot\{position:sticky;bottom:0/);
  assert.match(tab, /\.pkt-cards\{grid-template-columns:1fr/);
  assert.match(tab, /\.pkt-card>ul\{grid-column:2/);
});
summary();
