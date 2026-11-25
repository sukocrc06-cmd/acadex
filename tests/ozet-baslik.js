/* ==========================================================================
   ACADEX — ÖZET EKRANININ BAŞLIK BÖLÜMÜ (tests/ozet-baslik.js), 24.11.2026
   NEDEN VAR: Başlıkta 8 rozet yan yana diziliyordu; "yeniden özetle" düğmesindeki
   simgenin (ICON.redo) boyu yoktu, tarayıcı onu kocaman siyah daire çizdi ve flex satırı
   bütün rozetleri onun boyuna uzattı. Başlık da hep dosya adıydı ("Chapter 1").
   Bu dosya şunları korur:
     - rozet içindeki svg'nin boyu var; tür bilgisi tek satır, güven tek yeşil rozet
     - başlık sırası: outline.document_title_guess → slayt destesi → dosya adı
     - sunucu başlığı "Chapter 1: ..." diye verirse etiket ayrılır; "Course Introduction" başlık olmaz
     - kapak: yalnız PDF'in 1. sayfası, pdf.js cdnjs'ten sabit sürüm, belge başına bir kez
   Tarayıcıda (Playwright, masaüstü + telefon) başlık bölümü çizildi; rozetler 25px.
   Çalıştırma:  node tests/ozet-baslik.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner, loadFromSource, sliceDeclaration } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const { test, summary } = makeRunner();
const ink = read('js/acadex-ink.js'), css = read('css/acadex-ink.css'), fn = read('supabase/functions/ozet-slayt/index.ts');
const S = loadFromSource('supabase/functions/ozet-slayt/index.ts', ['str', 'baslikTemizle', 'BASLIK_TALIMATI']);
const axrBaslikBilgi = new Function(sliceDeclaration(ink, 'axrBaslikBilgi') + '\nreturn axrBaslikBilgi;')();

test('rozet içindeki simgenin boyu var, rozetler uzamıyor', () => {
  assert.match(css, /#study-card-modal\.axr \.axr-chip svg\{width:13px;height:13px;flex:none;fill:none;stroke:currentColor/);
  assert.match(css, /#study-card-modal\.axr \.axr-chips\{align-items:center\}/);
  assert.match(css, /\.axr-trust svg\{width:13px;height:13px/);
});
test('tür bilgisi tek satır, güven tek rozet; uyarı ve yeniden özetle rozet kalır', () => {
  assert.match(ink, /'<div class="axr-tagrow"><p class="axr-tags">'/);
  assert.match(ink, /var guven = qm\.grounded \? \(qm\.pass !== false && !uyarilar\.length \? 'kaynağa bağlı · kalite kontrollü' : 'kaynağa bağlı'\) : '';/);
  assert.ok(!/chip\('kalite kontrolünden geçti', 'ok'\)/.test(ink), 'eski iki yeşil rozet gitti');
  assert.match(ink, /\(uyariChip \? '<div class="axr-chips">' \+ uyariChip \+ '<\/div>' : ''\)/);
  assert.match(read('js/i18n-en.js'), /"kaynağa bağlı · kalite kontrollü": "grounded · quality-checked"/);
});
test('başlık sırası: outline tahmini → slayt destesi → dosya adı', () => {
  assert.deepEqual(axrBaslikBilgi({ outline: { document_title_guess: 'Defining Marketing', course_guess: 'Marketing Management', bolum_guess: 'Chapter 1' } }), { baslik: 'Defining Marketing', ust: 'Marketing Management · Chapter 1' });
  assert.deepEqual(axrBaslikBilgi({ outline: { items: [] }, slayt: { deste: { baslik: 'From Deck', ders: 'MM · Ch 1' } } }), { baslik: 'From Deck', ust: 'MM · Ch 1' });
  assert.deepEqual(axrBaslikBilgi({ outline: null }), { baslik: '', ust: '' });
  assert.match(ink, /if \(!BB\.baslik && own\) axrBaslikIste\(mast, c\);/, 'yalnız kendi kartında sorulur');
  assert.match(ink, /sessionStorage\.setItem\(anah, '1'\)/, 'oturumda bir kez denenir');
});
test('sunucu: başlık temizliği ve kart başına bir kez', () => {
  assert.deepEqual(S.baslikTemizle({ baslik: 'Chapter 1: Defining Marketing for the New Realities', ders: 'Marketing Management' }), { baslik: 'Defining Marketing for the New Realities', ders: 'Marketing Management', bolum: 'Chapter 1' });
  assert.deepEqual(S.baslikTemizle({ baslik: '"Hafta 3 — Kan Hücreleri"' }), { baslik: 'Kan Hücreleri', ders: '', bolum: 'Hafta 3' });
  assert.equal(S.baslikTemizle({ baslik: 'Course Introduction' }).baslik, '');
  assert.match(S.BASLIK_TALIMATI, /Never return a semester, date, university, instructor/);
  assert.match(fn, /if \(str\(o\.document_title_guess\)\) return json/);
  assert.match(fn, /if \(card\.user_id !== kullanici\.id\) return json\(\{ baslik: '' \}\)/);
  assert.match(fn, /update\(\{ outline: \{ \.\.\.o, document_title_guess: bilgi\.baslik, course_guess: bilgi\.ders, bolum_guess: bilgi\.bolum \} \}\)/);
});
test('kapak: yalnız PDF, sabit pdf.js sürümü, belge başına bir kez', () => {
  assert.match(ink, /var AXR_PDFJS = 'https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/3\.11\.174\/';/);
  assert.match(ink, /if \(!\(\/\\\.pdf\$\/i\.test\(d\.file_name \|\| ''\) \|\| d\.mime_type === 'application\/pdf'\)\) \{ yaz\('-'\); return null; \}/);
  assert.match(ink, /if \(hazir === '-'\) return;/);
  assert.match(ink, /getViewport\(\{ scale: 320 \/ v0\.width \}\)/);
  assert.match(ink, /kok\.getAttribute\('data-kart'\) !== String\(kartId\)/, 'başka karta geçildiyse eski kapak konmaz');
  assert.match(css, /#study-card-modal\.axr \.axr-kapak\{position:relative;float:right;width:136px/);
});
summary();
