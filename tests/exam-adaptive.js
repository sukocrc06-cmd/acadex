/* ==========================================================================
   ACADEX — AKILLI DENEME TESTLERİ (tests/exam-adaptive.js)

   Faz 5.2 (27.10.2026): generate-exam akıllı deneme planı.
     - sunucudaki conceptMastery tarayıcıdakiyle (exam-engine) aynı sonucu verir
     - plan karışımı: zayıf ağırlıklı, tekrar ≤ 1/3, yeni ≤ 1/5, pekiştirme
     - sınav yakınsa yeni konu yok
     - konu başına zorluk, konu başına en çok iki soru, kolaydan zora sıra
     - terim listesi ve istek metni

   Çalıştırma:  node tests/exam-adaptive.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));

const G = loadFromSource('supabase/functions/generate-exam/index.ts', [
  'MASTERY_LEVELS', 'MASTERY_MIN', 'MASTERY_PARAMS', 'MASTERY_DAY_MS', 'conceptKey', 'guessRate', 'masteryLevelOf', 'retentionOf',
  'conceptMastery', 'buildAdaptivePlan', 'termNames', 'adaptivePlanText'
]);

const { test, summary } = makeRunner();

const DAY = 86400000;
const T0 = Date.UTC(2026, 9, 1, 12);
const ex = (day, rows, extra = {}) => ({
  id: 'e' + day,
  completed_at: new Date(T0 + day * DAY).toISOString(),
  question_results: rows.map(([concept, score, type]) => ({ concept, score, type: type || 'calculation' })),
  ...extra
});
const R = (c, n, s, t) => Array.from({ length: n }, () => [c, s, t]);

// Karışık geçmiş: zayıf, tanıdık, yetkin, usta (eski: tekrar zamanı) konular.
const HISTORY = [
  ex(0, [].concat(R('Usta konu', 3, 100), R('Zayıf A', 2, 0), R('Tanıdık B', 1, 60), R('Yetkin C', 3, 100, 'multiple_choice'))),
  ex(4, [].concat(R('Usta konu', 2, 100), R('Zayıf A', 1, 30), R('Zayıf D', 2, 0, 'true_false'), R('Tanıdık B', 2, 70))),
  ex(5, [].concat(R('Yetkin C', 2, 100), R('Zayıf E', 2, 40, 'fill_blank')), { scoring: { option_count: 5 } })
];

test('sunucu ve tarayici ustalik modeli ayni sonucu verir', () => {
  const fixtures = [
    HISTORY,
    [ex(0, R('A', 3, 100)), ex(3, R('A', 2, 100)), ex(6, R('A', 3, 0)), ex(7, R('A', 3, 0))],
    [ex(0, [['Marjinal maliyet (MC)', 100], ['marjinal maliyet', 40], ['Esneklik', 60, 'multiple_choice']]), ex(2, [['ESNEKLİK', 100, 'true_false']])],
    [], [{ completed_at: null, question_results: [] }]
  ];
  for (const f of fixtures) {
    for (const day of [0, 7, 90]) {
      const opts = { now: T0 + day * DAY };
      assert.deepEqual(G.conceptMastery(f, opts), E.conceptMastery(f, opts));
    }
  }
  assert.deepEqual(G.MASTERY_LEVELS, E.MASTERY_LEVELS);
});

const masteryAt = (day) => G.conceptMastery(HISTORY, { now: T0 + day * DAY });

test('plan karisimi: zayif agirlikli, tekrar en cok ucte bir, yeni en cok beste bir, pekistirme yalniz tekrar zamani gelmemis guclu konudan', () => {
  const m = masteryAt(60);
  assert.ok(m.some(c => c.due), 'fixture: tekrar zamani gelen konu var');
  const plan = G.buildAdaptivePlan(m, ['Yeni terim 1', 'Yeni terim 2', 'Usta konu'], 10);
  assert.equal(plan.length, 10);
  const by = r => plan.filter(x => x.reason === r).length;
  assert.ok(by('review') >= 1 && by('review') <= Math.ceil(10 / 3), 'tekrar ' + by('review'));
  assert.ok(by('new') >= 1 && by('new') <= 2, 'yeni ' + by('new'));
  assert.equal(by('stretch'), 0, 'gun 60: guclu konularin hepsi tekrar zamaninda, pekistirme adayi yok');
  const early = G.buildAdaptivePlan(masteryAt(6), [], 8);
  assert.ok(early.filter(x => x.reason === 'stretch').length >= 1, 'gun 6: pekistirme sorusu var');
  assert.ok(early.filter(x => x.reason === 'weak').length >= early.length / 2, 'gun 6: yine zayif agirlikli');
  assert.ok(by('weak') >= by('review') && by('weak') >= 4, 'zayif ' + by('weak'));
  assert.ok(!plan.some(x => x.reason === 'new' && x.concept === 'Usta konu'), 'daha once sorulan terim yeni sayilmaz');
  const counts = {};
  plan.forEach(x => { counts[x.key] = (counts[x.key] || 0) + 1; });
  assert.ok(Object.values(counts).every(n => n <= 2), 'konu basina en cok iki soru');
});

test('zorluk: zayif kolay, tanidik orta, yetkin/pekistirme zor, yeni orta; siralama kolaydan zora', () => {
  const m = masteryAt(6);
  const plan = G.buildAdaptivePlan(m, ['Yeni terim'], 8);
  for (const x of plan) {
    if (x.reason === 'weak') assert.equal(x.difficulty, x.level === 0 ? 'easy' : 'medium', x.concept);
    if (x.reason === 'stretch') assert.equal(x.difficulty, 'hard');
    if (x.reason === 'new') assert.equal(x.difficulty, 'medium');
  }
  const rank = { easy: 0, medium: 1, hard: 2 };
  for (let i = 1; i < plan.length; i++) assert.ok(rank[plan[i].difficulty] >= rank[plan[i - 1].difficulty] || plan[i].key !== plan[i - 1].key, 'kolaydan zora');
});

test('sinava 7 gun ya da daha az kaldiysa yeni konu yok', () => {
  const m = masteryAt(60);
  const soon = G.buildAdaptivePlan(m, ['Yeni terim 1', 'Yeni terim 2'], 8, { daysToExam: 3 });
  assert.equal(soon.filter(x => x.reason === 'new').length, 0);
  const far = G.buildAdaptivePlan(m, ['Yeni terim 1', 'Yeni terim 2'], 8, { daysToExam: 30 });
  assert.ok(far.filter(x => x.reason === 'new').length >= 1);
});

test('gecmis yoksa plan kaynak terimlerinden; hicbir sey yoksa bos; konu azsa plan kisa', () => {
  const fresh = G.buildAdaptivePlan([], ['Arz', 'Talep', 'Denge'], 4);
  assert.equal(fresh.length, 4, 'uc terim dort soru: bir terim ikinci kez');
  assert.ok(fresh.every(x => x.reason === 'new'));
  assert.deepEqual([...new Set(fresh.map(x => x.concept))].sort(), ['Arz', 'Denge', 'Talep']);
  assert.deepEqual(G.buildAdaptivePlan([], [], 5), []);
  const one = G.buildAdaptivePlan(G.conceptMastery([ex(0, R('Tek', 2, 0))], { now: T0 }), [], 5);
  assert.equal(one.length, 2, 'tek konu en cok iki soru');
  assert.deepEqual(G.buildAdaptivePlan(masteryAt(6), [], 0), []);
});

test('aynı konu mumkunse yan yana gelmez', () => {
  const plan = G.buildAdaptivePlan(masteryAt(6), [], 8);
  let adjacent = 0;
  for (let i = 1; i < plan.length; i++) if (plan[i].key === plan[i - 1].key) adjacent++;
  assert.equal(adjacent, 0, plan.map(x => x.concept).join(' | '));
});

test('termNames ve istek metni', () => {
  assert.deepEqual(G.termNames(['Esneklik', { term: 'GSYH', definition: '...' }, { definition: 'x' }, '  ', null]), ['Esneklik', 'GSYH']);
  const plan = G.buildAdaptivePlan(masteryAt(6), ['Yeni terim'], 4);
  const txt = G.adaptivePlanText(plan);
  assert.match(txt, /^ADAPTIVE PLAN/);
  plan.forEach((x, i) => assert.ok(txt.includes(`${i + 1}. "${x.concept}" — ${x.difficulty}`), x.concept));
});

summary();
