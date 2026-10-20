/* ==========================================================================
   ACADEX — SORU MOTORU TESTLERİ (tests/exam-engine.js)

   js/exam-engine.js içindeki saf yardımcıları tarayıcı olmadan test eder:
   cevap özeti, gönderim uyarısı, simülasyonda kalan süre, klavye
   kısayolu, taslak birleştirme. Ekranla ilgili davranış (soru haritası,
   işaretleme, klavye, taslaktan geri yükleme) Playwright ile ayrıca
   denendi; bkz. DEPLOY-SINAV-FAZ1.md.

   Çalıştırma:  node tests/exam-engine.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');

const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));
const { test, summary } = makeRunner();

const QS = [
  { id: 1, type: 'multiple_choice' },
  { id: 2, type: 'true_false' },
  { id: 3, type: 'fill_blank' },
  { id: 4, type: 'open_ended' }
];

test('computeSummary: bos, cevapli ve isaretli sorular (sira numarasiyla)', () => {
  const s = E.computeSummary(QS, { 1: 'Artar', 2: '', 3: '  ', 4: 'cevap' }, ['2', 4]);
  assert.equal(s.total, 4);
  assert.equal(s.answered, 2);
  assert.deepEqual(s.unanswered, [2, 3]);
  assert.deepEqual(s.flagged, [2, 4]);
});

test('computeSummary: bos girdiler', () => {
  assert.deepEqual(E.computeSummary([], {}, []), { total: 0, answered: 0, unanswered: [], flagged: [] });
  assert.equal(E.computeSummary(QS, null, null).answered, 0);
});

test('formatSubmitWarning: uyari yoksa null, varsa Turkce/Ingilizce metin', () => {
  assert.equal(E.formatSubmitWarning({ total: 2, answered: 2, unanswered: [], flagged: [] }, 'tr'), null);
  const tr = E.formatSubmitWarning({ total: 4, answered: 2, unanswered: [2, 3], flagged: [4] }, 'tr');
  assert.match(tr, /2 soru boş \(2, 3\)/);
  assert.match(tr, /1 soru işaretli \(4\)/);
  assert.match(E.formatSubmitWarning({ total: 1, answered: 0, unanswered: [1], flagged: [] }, 'en'), /1 unanswered/);
});

test('computeRemainingSeconds: simulasyon degilse null', () => {
  assert.equal(E.computeRemainingSeconds({ is_simulation: false, time_limit_seconds: 600 }, Date.now()), null);
  assert.equal(E.computeRemainingSeconds({ is_simulation: true, time_limit_seconds: null }, Date.now()), null);
});

test('computeRemainingSeconds: sunucudaki started_at e gore kalan sure, sifirin altina inmez', () => {
  const start = Date.parse('2026-10-14T10:00:00Z');
  const exam = { is_simulation: true, time_limit_seconds: 600, started_at: '2026-10-14T10:00:00Z' };
  assert.equal(E.computeRemainingSeconds(exam, start + 120_000), 480);
  assert.equal(E.computeRemainingSeconds(exam, start + 700_000), 0);
});

test('computeRemainingSeconds: started_at yoksa (eski sinav) tam sure', () => {
  assert.equal(E.computeRemainingSeconds({ is_simulation: true, time_limit_seconds: 300 }, Date.now()), 300);
});

test('choiceIndexFromKey: A-E ve 1-5', () => {
  assert.equal(E.choiceIndexFromKey('a'), 0);
  assert.equal(E.choiceIndexFromKey('E'), 4);
  assert.equal(E.choiceIndexFromKey('3'), 2);
  assert.equal(E.choiceIndexFromKey('f'), -1);
  assert.equal(E.choiceIndexFromKey('6'), -1);
});

test('pickNewerDraft: yeni olan kazanir, bos olan yok sayilir', () => {
  const a = { updatedAt: '2026-10-14T10:00:00Z', answers: { 1: 'x' } };
  const b = { updatedAt: '2026-10-14T10:05:00Z', answers: { 1: 'y' } };
  assert.equal(E.pickNewerDraft(a, b), b);
  assert.equal(E.pickNewerDraft(b, a), b);
  assert.equal(E.pickNewerDraft(null, a), a);
  assert.equal(E.pickNewerDraft(a, null), a);
});

test('draftFromRow: exam_drafts satirini motor taslagina cevirir', () => {
  const d = E.draftFromRow({ answers: { 1: 'A' }, flags: [2, '3'], current_index: 1, view_mode: 'single', updated_at: '2026-10-14T10:00:00Z' });
  assert.deepEqual(d, { answers: { 1: 'A' }, flags: ['2', '3'], current: 1, mode: 'single', updatedAt: '2026-10-14T10:00:00Z' });
  assert.equal(E.draftFromRow({ view_mode: 'bozuk' }).mode, null);
  assert.equal(E.draftFromRow(null), null);
});

test('tum mevcut soru tipleri kayitli', () => {
  for (const type of ['multiple_choice', 'true_false', 'fill_blank', 'calculation', 'open_ended']) {
    const def = E.getType(type);
    assert.equal(typeof def.renderInput, 'function', `${type}.renderInput`);
    assert.equal(typeof def.readAnswer, 'function', `${type}.readAnswer`);
    assert.equal(typeof def.writeAnswer, 'function', `${type}.writeAnswer`);
  }
  assert.equal(E.getType('bilinmeyen_tip'), E.getType('open_ended'), 'bilinmeyen tip acik uclu gibi cizilmeli');
});

test('secmeli tipin HTML i sik metnini kacisla basar (XSS)', () => {
  const html = E.getType('multiple_choice').renderInput(
    { id: 7, options: ['<img src=x onerror=alert(1)>', 'B "tirnak"'] },
    { esc: s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), math: s => s.replace(/</g, '&lt;'), lang: 'tr', name: 'answer-q-7' }
  );
  assert.ok(!html.includes('<img'), 'sik metni ham basildi');
  assert.ok(html.includes('value="B &quot;tirnak&quot;"'));
  assert.ok(html.includes('id="label-q-7-opt-0"'));
});

test('registerType: yeni bir tip eklenebilir', () => {
  E.registerType('deneme_tipi', { renderInput: () => '<x>', readAnswer: () => '1', writeAnswer: () => {} });
  assert.equal(E.getType('deneme_tipi').readAnswer(), '1');
});

summary();
