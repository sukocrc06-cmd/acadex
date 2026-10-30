/* ==========================================================================
   ACADEX — SINAV GÜNÜ HAZIRLIĞI TESTLERİ (tests/exam-readiness.js)

   Faz 10 (30.10.2026): exam-engine examReadiness
     - hazırlık yüzdesi = yetkin/usta ve tekrar zamanı gelmemiş konu ÷ görülen
       konu (Khan Academy'deki gibi)
     - açık yanlışlar yalnızca bu dersin sınavlarından; kazanılan sayılmaz
     - bugünün işleri: ikinci şans (zamanı gelen yanlış), akıllı deneme (zayıf
       ya da tekrar), son 3 günde gerçek sınav provası; tempo önerisi

   Çalıştırma:  node tests/exam-readiness.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { readSource, makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));

const D = 86400000, NOW = Date.parse('2026-10-30T10:00:00Z');
const iso = (d) => new Date(NOW + d * D).toISOString();
const q = (id, concept, score) => ({ question_id: id, type: 'multiple_choice', concept, score, student_answer: 'x' });
const exam = (id, day, rs) => ({ id, completed_at: iso(day), scoring: { option_count: 4 }, question_results: rs });

const desk = [
  exam('a', -6, [q(1, 'Faiz', 100), q(2, 'Faiz', 100), q(3, 'NBD', 0), q(4, 'CAPM', 100)]),
  exam('b', -3, [q(1, 'Faiz', 100), q(2, 'Faiz', 100), q(3, 'NBD', 20), q(4, 'CAPM', 0)]),
  exam('c', -1, [q(1, 'Faiz', 100), q(2, 'NBD', 0)])
];
const other = exam('z', -2, [q(1, 'Pazarlama', 0)]);

test('yüzde: hazır konu ÷ görülen konu (ustalık modeliyle aynı)', () => {
  const R = E.examReadiness(desk, desk.concat([other]), 10, { now: NOW });
  const ms = E.conceptMastery(desk, { now: NOW });
  const ready = ms.filter(c => c.level >= 2 && !c.due).length;
  assert.equal(R.total, ms.length);
  assert.equal(R.ready, ready);
  assert.equal(R.pct, Math.round(ready * 100 / ms.length));
  assert.ok(R.weak >= 1, 'NBD zayıf');
  assert.equal(R.enough, true);
});

test('açık yanlışlar yalnızca bu dersten; kazanılan düşer', () => {
  let R = E.examReadiness(desk, desk.concat([other]), 10, { now: NOW });
  assert.equal(R.mistakes, 4, 'a:3, b:3, b:4, c:2; başka dersin yanlışı sayılmaz');
  const won = (id, d) => ({ id, completed_at: iso(d), scoring: { retry: [{ exam_id: 'a', question_id: 3 }] }, question_results: [q(1, 'NBD', 100)] });
  R = E.examReadiness(desk, desk.concat([other, won('r1', -0.9), won('r2', -0.5)]), 10, { now: NOW });
  assert.equal(R.mistakes, 3, 'a:3 art arda iki doğruyla kazanıldı');
});

test('bugünün işleri ve tempo sınava kalan güne göre', () => {
  let R = E.examReadiness(desk, desk, 10, { now: NOW });
  assert.deepEqual(R.tasks.map(t => t.kind), ['second', 'adaptive']);
  assert.equal(R.cadence, 'twice_weekly');
  R = E.examReadiness(desk, desk, 2, { now: NOW });
  assert.deepEqual(R.tasks.map(t => t.kind), ['second', 'adaptive', 'sim']);
  assert.equal(R.cadence, 'daily');
  assert.equal(E.examReadiness(desk, desk, 40, { now: NOW }).cadence, 'weekly');
  const clean = [exam('k', -1, [q(1, 'Faiz', 100)])];
  R = E.examReadiness(clean, clean, 20, { now: NOW });
  assert.equal(R.enough, false, 'tek konu az veri');
  assert.equal(R.tasks.some(t => t.kind === 'second'), false);
});

test('ekran: en yakın 30 gün içindeki sınav, sırasıyla eşleşen', () => {
  const ink = readSource('js/acadex-ink.js'), html = readSource('dashboard.html');
  assert.match(ink, /return n >= 0 && n <= 30 && deskForEvent\(e\);/);
  assert.match(ink, /var paintAll = function \(\) \{ paintCal\(\); paintDesks\(\); paintReport\(\); paintErrs\(\); paintAcx\(\); paintRdy\(\); \};/);
  assert.match(html, /<section class="sn-rdy" aria-label="Sınav hazırlığı" data-rdy="" hidden><\/section>/);
});

summary();
