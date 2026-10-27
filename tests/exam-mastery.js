/* ==========================================================================
   ACADEX — KONU USTALIĞI TESTLERİ (tests/exam-mastery.js)

   Faz 5.1 (27.10.2026): exam-engine conceptMastery / masteryChanges.
     - BKT güncellemesi: kısmi puan, soru tipine göre şans payı
     - kanıt eşikleri: yetkin ≥ 3 soru, usta ≥ 5 soru + iki ayrı gün
     - bir sınavda en fazla bir seviye düşüş (Khan Academy şikâyeti)
     - hafıza (FSRS unutma eğrisi) ve "tekrar zamanı"
     - kavram adı varyantları tek konu
     - sonuç kâğıdındaki seviye değişimi

   Çalıştırma:  node tests/exam-mastery.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));

const { test, summary } = makeRunner();

const DAY = 86400000;
const T0 = Date.UTC(2026, 9, 1, 12);
const ex = (day, rows, extra = {}) => ({
  id: 'e' + day + '-' + rows.length,
  completed_at: new Date(T0 + day * DAY).toISOString(),
  question_results: rows.map(([concept, score, type]) => ({ concept, score, type: type || 'calculation' })),
  ...extra
});
const at = (exams, day) => E.conceptMastery(exams, { now: T0 + day * DAY });
const one = (exams, day) => at(exams, day)[0];
const right = (c, n, type) => Array.from({ length: n }, () => [c, 100, type]);
const wrong = (c, n, type) => Array.from({ length: n }, () => [c, 0, type]);
const MASTER = [ex(0, right('A', 3)), ex(3, right('A', 2))];

test('kanit esikleri: tek soru tanidik, 3 soru yetkin, 5 soru + iki gun usta', () => {
  assert.equal(one([ex(0, right('A', 1))], 0).levelName, 'tanıdık', 'tek soru yetkin yapmaz');
  assert.equal(one([ex(0, right('A', 3))], 0).levelName, 'yetkin');
  assert.equal(one([ex(0, right('A', 6))], 0).levelName, 'yetkin', 'tek gunde usta olunmaz');
  assert.equal(one(MASTER, 3).levelName, 'usta');
  assert.equal(one([ex(0, wrong('A', 2))], 0).levelName, 'zayıf');
});

test('sans payi: coktan secmeli ve D/Y dogrusu hesap dogrusundan az kanit', () => {
  const calc = one([ex(0, right('A', 3))], 0).mastery;
  const mc = one([ex(0, right('A', 3, 'multiple_choice'))], 0).mastery;
  const tf = one([ex(0, right('A', 3, 'true_false'))], 0).mastery;
  assert.ok(calc > mc && mc > tf, `${calc} > ${mc} > ${tf}`);
  assert.equal(E.guessRate('multiple_choice', 5), 0.2);
  assert.equal(E.guessRate('true_false'), 0.5);
  assert.equal(E.guessRate('graph'), 0.05);
});

test('kismi puan kismi kanit: 60 puanlar tam dogrudan az, yanlistan cok; 50 alti cogunlukla yanlis', () => {
  const full = one([ex(0, right('A', 3))], 0).mastery;
  const part = one([ex(0, [['A', 60], ['A', 60], ['A', 60]])], 0).mastery;
  const none = one([ex(0, wrong('A', 3))], 0).mastery;
  assert.ok(full > part && part > none, `${full} > ${part} > ${none}`);
  assert.equal(one([ex(0, [['A', 40]])], 0).levelName, 'zayıf', '40 puan sonuc kagidinda yanlis');
});

test('bir sinavda en fazla bir seviye dusus; ikinci kotu sinav bir seviye daha', () => {
  const after1 = one(MASTER.concat([ex(6, wrong('A', 3))]), 6);
  assert.equal(after1.levelName, 'yetkin', 'usta → en fazla yetkin');
  const after2 = one(MASTER.concat([ex(6, wrong('A', 3)), ex(7, wrong('A', 3))]), 7);
  assert.equal(after2.levelName, 'tanıdık');
  assert.equal(one(MASTER.concat([ex(6, wrong('A', 1))]), 6).levelName, 'yetkin', 'tek yanlis da bir seviye');
});

test('hafiza: zamanla azalir, yetkin konu %80 altinda tekrar zamani; aralikli basari kararliligi buyutur', () => {
  const fresh = one(MASTER, 3), later = one(MASTER, 63);
  assert.equal(fresh.retention, 100);
  assert.ok(later.retention < 80, String(later.retention));
  assert.equal(later.due, true);
  assert.equal(fresh.due, false);
  const sameDay = one([ex(0, right('A', 3)), ex(0.1, right('A', 2))], 0.1).stability;
  const spaced = one(MASTER, 3).stability;
  assert.ok(spaced > sameDay, `${spaced} > ${sameDay}`);
  assert.equal(one([ex(0, wrong('A', 3))], 60).due, false, 'zayif konu tekrar degil, ogrenme listesinde');
  assert.equal(E.retentionOf(5, 5), 0.9, 'S gununde %90 (FSRS tanimi)');
});

test('kavram adi varyantlari tek konu; en son yazilis gosterilir', () => {
  const m = at([ex(0, right('Marjinal maliyet (MC)', 2)), ex(1, right('marjinal  maliyet', 1))], 1);
  assert.equal(m.length, 1);
  assert.equal(m[0].n, 3);
  assert.equal(m[0].name, 'marjinal  maliyet'.trim());
  assert.equal(E.conceptKey('Esneklik (E)'), E.conceptKey('ESNEKLİK'));
  assert.notEqual(E.conceptKey('Talep'), E.conceptKey('Arz'));
});

test('siralama: once tekrar zamani gelenler, sonra en zayiflar; etiketsiz ve tamamlanmamis sinav sayilmaz', () => {
  const exams = [ex(0, right('Usta', 3).concat(right('Zayıf', 0), wrong('Zayıf', 2), right('Orta', 1))), ex(3, right('Usta', 2))];
  const m = at(exams, 80);
  assert.equal(m[0].name, 'Usta', 'tekrar zamani en ustte');
  assert.equal(m[1].name, 'Zayıf');
  const noise = [{ completed_at: null, question_results: right('X', 3).map(([c, s]) => ({ concept: c, score: s })) }, { completed_at: new Date(T0).toISOString(), question_results: [{ concept: '', score: 100 }, { score: 0 }] }];
  assert.deepEqual(at(noise, 0), []);
  assert.deepEqual(E.conceptMastery(null), []);
});

test('kanit satiri: son 3 deneme ortalamasi, gun, soru sayisi, az veri', () => {
  const c = one([ex(0, [['A', 40]]), ex(1, [['A', 80]]), ex(2, [['A', 100]]), ex(3, [['A', 60]])], 10);
  assert.equal(c.recentExams, 3);
  assert.equal(c.recentAvg, 80);
  assert.equal(c.daysAgo, 7);
  assert.equal(c.n, 4);
  assert.equal(c.fewData, false);
  assert.equal(one([ex(0, [['A', 100]])], 0).fewData, true);
});

test('masteryChanges: sinavin konu seviyelerine etkisi; yalniz o sinavdaki konular', () => {
  const prior = [ex(0, [['A', 40], ['B', 100]])];
  const now = ex(2, [['A', 100], ['A', 100], ['C', 0]]);
  const ch = E.masteryChanges(prior, now, { now: T0 + 2 * DAY });
  assert.deepEqual(ch.map(c => c.name), ['A', 'C']);
  assert.equal(ch[0].fromName, 'zayıf');
  assert.equal(ch[0].toName, 'yetkin');
  assert.ok(ch[0].delta > 0);
  assert.equal(ch[1].from, null, 'ilk kez gorulen konu');
  assert.equal(ch[1].toName, 'zayıf');
  assert.deepEqual(E.masteryChanges([], { question_results: [] }), []);
});

summary();
