/* ==========================================================================
   ACADEX — DOSYADAKİ GRAFİK SORULARINA GÖRE SINAV: YORUM MOTORU
   (tests/exam-chartq.js)

   Faz 4c (23.10.2026): benzer grafik (aynı yapı, yeni değerler), koddan
   iddia üretimi ve doğrulaması, örnekle aynı biçimde soru. Cevap
   anahtarının her zaman doğru olduğu burada denetlenir.

   Çalıştırma:  node tests/exam-chartq.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const G = loadFromSource('supabase/functions/generate-exam/index.ts', [
  'EXPR_MAX_LENGTH', 'EXPR_MAX_DEPTH', 'EXPR_CONSTS', 'EXPR_FUNCS', 'evaluateExpression',
  'CHART_FORMATS', 'CHART_SKILLS', 'seededRandom', 'TR_DIGIT_WORD', 'TR_TEN_WORD', 'TR_LETTER_NAME', 'trSpokenTail', 'trSuffix',
  'decimalsIn', 'chartVariant', 'pctChange', 'claimTruth', 'seriesWord', 'fmtPct', 'fmtNum', 'claimText', 'claimEvidence',
  'thresholdsAround', 'TR_MONTHS', 'isTimeAxis', 'claimCandidates', 'claimSubject', 'pickClaims', 'ROMAN', 'PREMISE_COMBOS', 'comboLabel',
  'buildChartQuestion', 'CHART_MAX_SOURCES', 'CHART_MAX_POINTS', 'CHART_MAX_SERIES', 'chartLabel', 'parseLooseNumber', 'normalizeChartSpec',
  'buildChartExamQuestions'
]);

const { test, summary } = makeRunner();

const LINE = { title: 'Satışlar', type: 'line', labels: ['2020', '2021', '2022', '2023'], series: [{ name: '', data: [1250000, 1480000, 1390000, 1610000] }], unit: '' };
const BAR = { title: 'Pazar payı', type: 'bar', labels: ['Marmara', 'Ege', 'İç Anadolu', 'Akdeniz'], series: [{ name: 'Pazar payı', data: [38, 17, 15, 12] }], unit: '%' };
const TWO = { title: 'Satış ve maliyet', type: 'line', labels: ['2021', '2022', '2023'], series: [{ name: 'Satış', data: [120, 150, 140] }, { name: 'Maliyet', data: [90, 100, 110] }], unit: '' };
const PIE = { title: 'Gider', type: 'pie', labels: ['Personel', 'Kira', 'Pazarlama', 'Diğer'], series: [{ name: '', data: [45, 25, 20, 10] }], unit: '%' };
const ALL = [LINE, BAR, TWO, PIE];

test('Turkce ekler: unlu uyumu, sert unsuz, sayilarin okunusu, kisaltma', () => {
  const cases = [
    ['2021', "2021'den", "2021'e", "2021'de"], ['2020', "2020'den", "2020'ye", "2020'de"], ['2010', "2010'dan", "2010'a", "2010'da"],
    ['2023', "2023'ten", "2023'e", "2023'te"], ['Ege', "Ege'den", "Ege'ye", "Ege'de"], ['Marmara', "Marmara'dan", "Marmara'ya", "Marmara'da"],
    ['İç Anadolu', "İç Anadolu'dan", "İç Anadolu'ya", "İç Anadolu'da"], ['%15', "%15'ten", "%15'e", "%15'te"], ['%40', "%40'tan", "%40'a", "%40'ta"],
    ['%12,5', "%12,5'ten", "%12,5'e", "%12,5'te"], ['1.250.000', "1.250.000'den", "1.250.000'e", "1.250.000'de"], ['ABD', "ABD'den", "ABD'ye", "ABD'de"],
    ['6', "6'dan", "6'ya", "6'da"], ['100', "100'den", "100'e", "100'de"], ['Q3', "Q3'ten", "Q3'e", "Q3'te"]
  ];
  for (const [w, abl, dat, loc] of cases) {
    assert.equal(G.trSuffix(w, 'abl'), abl, w);
    assert.equal(G.trSuffix(w, 'dat'), dat, w);
    assert.equal(G.trSuffix(w, 'loc'), loc, w);
  }
  assert.equal(G.trSuffix('maliyet', 'abl', false), 'maliyetten', 'cins isim: kesmesiz');
});

test('chartVariant: ayni yapi, yeni ve birbirinden farkli degerler, %22 icinde; tohum ayni → ayni sonuc', () => {
  for (const ch of ALL) {
    for (let i = 0; i < 50; i++) {
      const v = G.chartVariant(ch, G.seededRandom('v' + i));
      assert.ok(v, ch.title);
      assert.deepEqual(v.labels, ch.labels);
      assert.equal(v.type, ch.type);
      assert.equal(v.series.length, ch.series.length);
      v.series.forEach((sr, k) => {
        assert.equal(new Set(sr.data).size, sr.data.length, 'esit deger yok');
        // %22 değişim + bir yuvarlama birimi (tam sayıda 1): 17 × 0,78 = 13,26 → 13.
        // Yuvarlaklık korunur (120 → 2 anlamlı basamak, adım 10): pay = bir adım.
        if (ch.type !== 'pie') sr.data.forEach((x, j) => { const o = ch.series[k].data[j]; const step = Math.pow(10, Math.floor(Math.log10(Math.abs(o))) - 1); assert.ok(Math.abs(x - o) <= 0.22 * Math.abs(o) + step, `${ch.title} ${x} ~ ${o}`); });
      });
      assert.ok(v.series.some((sr, k) => sr.data.some((x, j) => x !== ch.series[k].data[j])), 'degismis');
    }
  }
  const p = G.chartVariant(PIE, G.seededRandom('p'));
  assert.equal(p.series[0].data.reduce((a, b) => a + b, 0), 100, 'toplami 100 olan dagilim yine 100');
  assert.deepEqual(G.chartVariant(LINE, G.seededRandom('ayni')), G.chartVariant(LINE, G.seededRandom('ayni')));
});

test('claimTruth: her iddia turu elle hesaplanmis veriyle', () => {
  const t = (c, ch = LINE) => G.claimTruth(c, ch);
  assert.equal(t({ kind: 'rise', s: 0, a: 0, b: 1 }), true);
  assert.equal(t({ kind: 'fall', s: 0, a: 1, b: 2 }), true);
  assert.equal(t({ kind: 'steady_rise', s: 0, a: 0, b: 3 }), false, '2022 dususu');
  assert.equal(t({ kind: 'steady_rise', s: 0, a: 2, b: 3 }), true);
  assert.equal(t({ kind: 'max', s: 0, a: 3 }), true);
  assert.equal(t({ kind: 'min', s: 0, a: 0 }), true);
  assert.equal(t({ kind: 'inc_gt', s: 0, a: 0, b: 3, v: 25 }), true, '%28,8');
  assert.equal(t({ kind: 'inc_gt', s: 0, a: 0, b: 3, v: 30 }), false);
  assert.equal(t({ kind: 'inc_lt', s: 0, a: 0, b: 3, v: 30 }), true);
  assert.equal(t({ kind: 'dec_gt', s: 0, a: 1, b: 2, v: 5 }), true, '%6,1 dusus');
  assert.equal(t({ kind: 'share_gt', s: 0, a: 0, v: 40 }, PIE), true);
  assert.equal(t({ kind: 'share_lt', s: 0, a: 3, v: 15 }, PIE), true);
  assert.equal(t({ kind: 'avg_gt', s: 0, v: 20 }, BAR), true, 'ortalama 20,5');
  assert.equal(t({ kind: 'rank', s: 0, a: 1, n: 2 }, BAR), true);
  assert.equal(t({ kind: 'above', s: 0, s2: 1, a: 0 }, TWO), true);
  assert.equal(t({ kind: 'gap_widen', s: 0, s2: 1, a: 0, b: 2 }, TWO), false, '30 → 30');
  assert.equal(t({ kind: 'greater', s: 0, a: 0, b: 1 }, BAR), true);
});

test('isTimeAxis: cizgi ve yil/ceyrek/ay etiketli sutun zaman; kategori ve pasta degil', () => {
  assert.equal(G.isTimeAxis(LINE), true);
  assert.equal(G.isTimeAxis({ ...BAR, labels: ['2019', '2020', '2021'] }), true);
  assert.equal(G.isTimeAxis({ ...BAR, labels: ['Q1', 'Q2', 'Q3'] }), true);
  assert.equal(G.isTimeAxis({ ...BAR, labels: ['Ocak', 'Şubat', 'Mart'] }), true);
  assert.equal(G.isTimeAxis(BAR), false);
  assert.equal(G.isTimeAxis(PIE), false);
});

const truthOf = (q, opt) => q.option_rationales && q.option_rationales[opt] ? q.option_rationales[opt].startsWith('Doğru') : null;

test('hangisi soylenebilir / soylenemez: tam olarak bir secenek farkli, gerekcelerle tutarli', () => {
  for (let i = 0; i < 200; i++) {
    for (const ch of ALL) {
      const rand = G.seededRandom('w' + i);
      const v = G.chartVariant(ch, rand);
      for (const f of ['which_true', 'which_false']) {
        const q = G.buildChartQuestion({ stem: '', format: f, skills: [] }, v, 'tr', rand, 5);
        assert.ok(q, `${f} kurulamadi`);
        assert.equal(q.options.length, 5);
        assert.equal(new Set(q.options).size, 5);
        const truths = q.options.map(o => truthOf(q, o));
        const want = f === 'which_true';
        assert.equal(truths.filter(x => x === want).length, 1, JSON.stringify(q.options));
        assert.equal(truthOf(q, q.correct_answer), want);
      }
    }
  }
});

test('oncullu: dogru kombinasyon aciklamayla tutarli, siklar standart sirada', () => {
  const order = ['Yalnız I', 'Yalnız II', 'Yalnız III', 'I ve II', 'I ve III', 'II ve III', 'I, II ve III'];
  for (let i = 0; i < 200; i++) {
    for (const ch of ALL) {
      const rand = G.seededRandom('p' + i);
      const q = G.buildChartQuestion({ stem: '', format: 'premises', skills: [] }, G.chartVariant(ch, rand), 'tr', rand, 5);
      assert.ok(q);
      assert.equal(q.keep_order, true);
      assert.equal(q.premises.length, 3);
      assert.ok(q.options.includes(q.correct_answer));
      const idx = q.options.map(o => order.indexOf(o));
      assert.deepEqual([...idx].sort((a, b) => a - b), idx, 'standart sira');
      const trueOnes = ['I', 'II', 'III'].filter(r => new RegExp(`(^|; )${r} doğru`).test(q.explanation));
      const label = trueOnes.length === 1 ? `Yalnız ${trueOnes[0]}` : trueOnes.length === 2 ? `${trueOnes[0]} ve ${trueOnes[1]}` : 'I, II ve III';
      assert.equal(q.correct_answer, label, q.explanation);
      // aynı konudan iki ifade yok
      assert.equal(new Set(q.premises.map(p => p.replace(/^[IV]+\. /, ''))).size, 3);
    }
  }
});

test('dogru-yanlis, deger, bosluk ve yorum sorulari', () => {
  const rand = G.seededRandom('d');
  const tf = G.buildChartQuestion({ stem: '', format: 'true_false', skills: [] }, LINE, 'tr', rand);
  assert.equal(tf.type, 'true_false');
  assert.deepEqual(tf.options, ['Doğru', 'Yanlış']);
  const val = G.buildChartQuestion({ stem: '', format: 'value', skills: ['change'] }, LINE, 'tr', G.seededRandom('val'));
  assert.equal(val.type, 'calculation');
  assert.equal(val.verified, true);
  assert.equal(Math.round(G.evaluateExpression(val.formula, val.variables) * 1e4) / 1e4, val.correct_answer);
  assert.ok(val.correct_answer > 0, 'yuzde degisim pozitif sorulur');
  assert.match(val.question, /yüzde kaç (artmıştır|azalmıştır)\?$/);
  const share = G.buildChartQuestion({ stem: '', format: 'value', skills: ['share'] }, PIE, 'tr', G.seededRandom('sh'));
  assert.match(share.question, /toplamın yüzde kaçını oluşturur\?$/);
  const fill = G.buildChartQuestion({ stem: '', format: 'fill', skills: [] }, BAR, 'tr', G.seededRandom('f'));
  assert.ok(['Marmara', 'Akdeniz'].includes(fill.correct_answer), 'en yuksek ya da en dusuk');
  const open = G.buildChartQuestion({ stem: 'Grafiği yorumlayınız.', format: 'open', skills: [] }, TWO, 'tr', G.seededRandom('o'));
  assert.equal(open.type, 'open_ended');
  assert.equal(open.question, 'Grafiği yorumlayınız.', 'ornegin koku korunur');
  assert.equal(open.rubric.reduce((a, r) => a + r.points, 0), 100);
});

test('ornegin koku: sayi icermiyorsa ve bicim ayniysa korunur', () => {
  const q = G.buildChartQuestion({ stem: 'Grafikteki verilere göre aşağıdakilerden hangisine ulaşılabilir?', format: 'which_true', skills: [] }, BAR, 'tr', G.seededRandom('k'));
  assert.equal(q.question, 'Grafikteki verilere göre aşağıdakilerden hangisine ulaşılabilir?');
  const q2 = G.buildChartQuestion({ stem: '2019 yılında hangisi en yüksektir?', format: 'which_true', skills: [] }, BAR, 'tr', G.seededRandom('k'));
  assert.equal(q2.question, 'Grafiğe göre aşağıdakilerden hangisi söylenebilir?', 'sayili kok genel kokle degisir');
});

test('kategori ve pasta grafiginde degisim ifadesi uretilmez', () => {
  for (let i = 0; i < 100; i++) for (const ch of [BAR, PIE]) {
    const rand = G.seededRandom('c' + i);
    const q = G.buildChartQuestion({ stem: '', format: 'which_true', skills: ['change', 'compare'] }, G.chartVariant(ch, rand), 'tr', rand, 5);
    assert.ok(!/artmıştır|azalmıştır/.test(q.options.join(' ')), q.options.join(' | '));
  }
});

test('Ingilizce', () => {
  const q = G.buildChartQuestion({ stem: '', format: 'which_false', skills: [] }, TWO, 'en', G.seededRandom('en'), 4);
  assert.equal(q.question, 'According to the chart, which of the following is NOT true?');
  assert.ok(q.options.every(o => !/'/.test(o) || /\w'\w/.test(o)));
});

test('buildChartExamQuestions: taranmis ogelerden istenen sayida, bicim korunur, kaynak sayfa, eksen basliklari', () => {
  const items = [
    { page: 3, chart: { ...LINE, x_title: 'Yıl', y_title: 'TL' }, example: { stem: 'Grafiğe göre aşağıdakilerden hangisi söylenemez?', format: 'which_false', skills: ['trend'], options_count: 5 } },
    { page: 7, chart: PIE, example: { stem: '', format: 'premises', skills: ['share'] } },
    { page: 9, chart: { type: 'scatter' }, example: {} }
  ];
  const qs = G.buildChartExamQuestions(items, 6, 'tr', 4, 'seed-1');
  assert.equal(qs.length, 6);
  for (const q of qs) {
    assert.ok([3, 7].includes(q.source.page));
    if (q.source.page === 3) {
      assert.equal(q.question, 'Grafiğe göre aşağıdakilerden hangisi söylenemez?');
      assert.equal(q.options.length, 5, 'ornegin sik sayisi');
      assert.equal(q.chart.y_title, 'TL');
      assert.notDeepEqual(q.chart.series[0].data, LINE.series[0].data, 'yeni degerler');
    } else {
      assert.match(q.question, /hangileri doğrudur\?/);
      assert.equal(q.keep_order, true);
    }
  }
  assert.equal(new Set(qs.map(q => q.question + JSON.stringify(q.options))).size, 6, 'tekrar yok');
  assert.deepEqual(G.buildChartExamQuestions([], 5, 'tr', 4, 's'), []);
  assert.deepEqual(G.buildChartExamQuestions(items, 4, 'tr', 4, 'ayni').map(q => q.question + q.correct_answer), G.buildChartExamQuestions(items, 4, 'tr', 4, 'ayni').map(q => q.question + q.correct_answer), 'tohum ayni → ayni sinav');
});

summary();
