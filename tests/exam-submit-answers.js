/* ==========================================================================
   ACADEX — SINAV CEVAP TOPLAMA TESTLERI (tests/exam-submit-answers.js)

   NEDEN VAR (21.10.2026):
   Sinav gonderiminde cevaplar bir sure SADECE soru motorundan (js/exam-engine.js)
   okundu. Ama js/acadex-ink.js dashboard.js'ten SONRA yukleniyor ve
   startActiveExam'in uzerine yazip sinavi kendi kitapcik ekraniyla ciziyor —
   yani motor hic mount edilmiyor. Sonuc: gonderilen cevap paketi bos ({})
   kaliyordu; ogrenci her soruyu isaretlese bile sonuc "bos biraktin / 0"
   cikiyordu. Uretimde iki deneme boyle kaydedildi (exams.answers = {}).

   Duzeltme: motor acik degilse cevaplar dogrudan sayfadan okunur. Bu testler
   o ikinci yolun sozlesmesini kilitler — alan adlari (answer-q-<id>), secili
   sik okuma (:checked) ve ink'in [data-flag] + aria-pressed isareti.

   Calistirma:  node tests/exam-submit-answers.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const F = loadFromSource('js/dashboard.js', ['readExamAnswersFromDom', 'readExamFlagsFromDom']);
const { test, summary } = makeRunner();

// ---------------------------------------------------------------------------
// Kucuk sahte DOM: yalnizca bu iki fonksiyonun kullandigi secicileri anlar.
//   input[name="answer-q-N"]:checked | [name="answer-q-N"] | [data-qi="N"]
// Boylece test, gercek ekranin isaretlerine (isim bicimi, :checked, data-flag)
// bagli kalir; bu isaretler degisirse test duser.
// ---------------------------------------------------------------------------
function makeDom(fields, sections = []) {
  const match = (sel) => {
    let m = /^input\[name="([^"]+)"\]:checked$/.exec(sel);
    if (m) return fields.filter(f => f.name === m[1] && f.checked)[0] || null;
    m = /^\[name="([^"]+)"\]$/.exec(sel);
    if (m) return fields.filter(f => f.name === m[1])[0] || null;
    m = /^\[data-qi="(\d+)"\]$/.exec(sel);
    if (m) return sections[Number(m[1])] || null;
    throw new Error('test DOM bu seciciyi bilmiyor: ' + sel);
  };
  return { querySelector: match };
}

const section = (flagged) => ({
  querySelector: (sel) => {
    if (sel !== '[data-flag]') throw new Error('beklenmeyen secici: ' + sel);
    if (flagged === null) return null;
    return { getAttribute: (a) => (a === 'aria-pressed' ? String(flagged) : null) };
  }
});

const withDom = (dom, fn) => {
  const prev = globalThis.document;
  globalThis.document = dom;
  try { return fn(); } finally { globalThis.document = prev; }
};

const EXAM = {
  questions: [
    { id: 1, type: 'multiple_choice' },
    { id: 2, type: 'true_false' },
    { id: 3, type: 'fill_blank' },
    { id: 4, type: 'calculation' },
    { id: 5, type: 'open_ended' }
  ]
};

test('coktan secmeli ve dogru-yanlis: secili sikkin degeri okunur', () => {
  const dom = makeDom([
    { name: 'answer-q-1', value: 'Azalır', checked: false },
    { name: 'answer-q-1', value: 'Artar', checked: true },
    { name: 'answer-q-2', value: 'Doğru', checked: false },
    { name: 'answer-q-2', value: 'Yanlış', checked: true }
  ]);
  const a = withDom(dom, () => F.readExamAnswersFromDom({ questions: EXAM.questions.slice(0, 2) }));
  assert.deepEqual(a, { 1: 'Artar', 2: 'Yanlış' });
});

test('secilmemis coktan secmeli bos string dondurur (null degil)', () => {
  const dom = makeDom([{ name: 'answer-q-1', value: 'Artar', checked: false }]);
  const a = withDom(dom, () => F.readExamAnswersFromDom({ questions: [{ id: 1, type: 'multiple_choice' }] }));
  assert.deepEqual(a, { 1: '' });
});

test('metin, sayi ve uzun cevap alanlari deger olarak okunur', () => {
  const dom = makeDom([
    { name: 'answer-q-3', value: 'yüzde' },
    { name: 'answer-q-4', value: '1000' },
    { name: 'answer-q-5', value: 'Fırsat maliyeti vazgeçilen en iyi alternatiftir.' }
  ]);
  const a = withDom(dom, () => F.readExamAnswersFromDom({ questions: EXAM.questions.slice(2) }));
  assert.deepEqual(a, { 3: 'yüzde', 4: '1000', 5: 'Fırsat maliyeti vazgeçilen en iyi alternatiftir.' });
});

test('HATA NOBETI: dolu bir kagit asla bos paket uretmez', () => {
  const dom = makeDom([
    { name: 'answer-q-1', value: 'Artar', checked: true },
    { name: 'answer-q-2', value: 'Yanlış', checked: true },
    { name: 'answer-q-3', value: 'yüzde' },
    { name: 'answer-q-4', value: '1000' },
    { name: 'answer-q-5', value: 'cevap' }
  ]);
  const a = withDom(dom, () => F.readExamAnswersFromDom(EXAM));
  assert.equal(Object.keys(a).length, 5);
  assert.equal(Object.values(a).filter(v => String(v).trim() !== '').length, 5, 'cevaplarin hepsi dolu gelmeliydi');
});

test('alani olmayan soru bos gelir, cagri patlamaz', () => {
  const a = withDom(makeDom([]), () => F.readExamAnswersFromDom(EXAM));
  assert.deepEqual(a, { 1: '', 2: '', 3: '', 4: '', 5: '' });
});

test('sinav yoksa ya da sorusuzsa bos nesne', () => {
  assert.deepEqual(withDom(makeDom([]), () => F.readExamAnswersFromDom(null)), {});
  assert.deepEqual(withDom(makeDom([]), () => F.readExamAnswersFromDom({})), {});
});

test('isaretli sorular: yalnizca aria-pressed="true" olanlar, soru id siyle', () => {
  const dom = makeDom([], [section(true), section(false), section(null), section(true), section(false)]);
  const f = withDom(dom, () => F.readExamFlagsFromDom(EXAM));
  assert.deepEqual(f, ['1', '4']);
});

test('isaret dugmesi hic yoksa (motor ekrani) bos dizi', () => {
  const dom = makeDom([], []);
  assert.deepEqual(withDom(dom, () => F.readExamFlagsFromDom(EXAM)), []);
});

summary();
