/* ==========================================================================
   ACADEX — GRAFİK TARAMASI TESTLERİ (tests/exam-chart-scan.js)

   Faz 4c (23.10.2026): extract-chart-items edge function'ın saf parçaları.
     - generate-exam'den kopyalanan grafik doğrulama bloğu birebir aynı
     - aday sayfa seçimi (grafik + soru izi; yoksa boş sayfalar)
     - örnek sorunun biçimi (model söylemezse metinden)
     - görsel model çıktısının doğrulanması

   Çalıştırma:  node tests/exam-chart-scan.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, sliceDeclaration, makeRunner } = require('./_ts-extract.js');

const SCAN_PATH = 'supabase/functions/extract-chart-items/index.ts';
const GEN_PATH = 'supabase/functions/generate-exam/index.ts';
const SHARED = ['parseLooseNumber', 'CHART_MAX_SOURCES', 'CHART_MAX_POINTS', 'CHART_MAX_SERIES', 'chartLabel', 'normalizeChartSpec'];

const S = loadFromSource(SCAN_PATH, [...SHARED, 'SCAN_MAX_PAGES', 'GROQ_WAIT_CAP_MS', 'CHART_FORMATS', 'CHART_SKILLS', 'DRAW_KINDS', 'pageTexts', 'CHART_CUE', 'QUESTION_CUE', 'DRAW_CUE',
  'selectCandidatePages', 'inferFormat', 'normalizeScanItem', 'groqWaitMs']);
const G = loadFromSource(GEN_PATH, ['CHART_FORMATS', 'CHART_SKILLS']);

const { test, summary } = makeRunner();

test('grafik dogrulama blogu generate-exam ile birebir ayni; bicim ve beceri listeleri ayni', () => {
  const toJs = p => require('typescript').transpileModule(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'), { compilerOptions: { target: 99, module: 99 } }).outputText;
  const a = toJs(SCAN_PATH), b = toJs(GEN_PATH);
  for (const n of SHARED) assert.equal(sliceDeclaration(a, n), sliceDeclaration(b, n), n);
  assert.deepEqual(S.CHART_FORMATS, G.CHART_FORMATS);
  assert.deepEqual(S.CHART_SKILLS, G.CHART_SKILLS);
});

test('aday sayfalar: grafik ve soru izi tasiyanlar, en cok 8, artan sirada', () => {
  const texts = new Map([
    [1, 'Kapak sayfası, ders adı ve öğretim üyesi bilgileri burada yer alıyor. '.repeat(4)],
    [2, 'Aşağıdaki grafik 2019-2023 ihracatını göstermektedir. Grafiğe göre aşağıdakilerden hangisi söylenebilir? A) ... B) ... C) ... D) ...'],
    [3, 'Arz ve talep kavramları uzun bir metin olarak anlatılıyor. '.repeat(10)],
    [4, 'Şekil 3'],
    [5, 'Grafikteki verilere göre I. ... II. ... III. ... ifadelerinden hangileri doğrudur?']
  ]);
  assert.deepEqual(S.selectCandidatePages(texts, 5), [2, 4, 5]);
  const many = new Map([...Array(20)].map((_, i) => [i + 1, 'Grafiğe göre hangisi söylenebilir? A) B) C)']));
  assert.equal(S.selectCandidatePages(many, 20).length, 8);
});

test('aday sayfalar: iz yoksa neredeyse bos sayfalar, o da yoksa ilk uc sayfa', () => {
  const blank = new Map([[1, 'Uzun bir metin. '.repeat(20)], [2, ''], [3, 'x'], [4, 'Uzun bir metin. '.repeat(20)]]);
  assert.deepEqual(S.selectCandidatePages(blank, 4), [2, 3]);
  const full = new Map([[1, 'Uzun bir metin. '.repeat(20)], [2, 'Uzun bir metin. '.repeat(20)], [3, 'a'.repeat(400)], [4, 'b'.repeat(400)]]);
  assert.deepEqual(S.selectCandidatePages(full, 4), [1, 2, 3]);
});

test('pageTexts: birden cok sayfali parca sayfalarina bolunur (canli test 24.10.2026)', () => {
  const p2 = 'Yıllara göre ihracat\nGrafiğe göre aşağıdaki ifadelerden hangileri doğrudur?\nI. 2020 yılında ihracat azalmıştır.\nA) Yalnız I\nB) Yalnız II\nC) I ve II';
  const p3 = 'Bir firmanın satış ve maliyetleri\nGrafiğe göre aşağıdakilerden hangisi söylenemez?\nA) Satışlar azalmıştır.\nB) Maliyetler artmıştır.';
  const p4 = 'Bölgelere göre pazar payı (%)\nGrafiğe göre aşağıdakilerden hangisi söylenebilir?\nA) En düşük pay Ege\'dedir.\nB) Marmara en yüksektir.';
  const rows = [
    { page_start: 1, page_end: 1, text: 'Konu özeti. '.repeat(30) },
    { page_start: 2, page_end: 4, text: [p2, p3, p4].join('\n\n') },
    { page_start: 5, page_end: 5, text: 'Grafiğe göre 2. çeyrekten 3. çeyreğe satış yüzde kaç artmıştır?\nA) %15\nB) %20' }
  ];
  const t = S.pageTexts(rows);
  assert.match(t.get(3), /söylenemez/);
  assert.match(t.get(4), /söylenebilir/);
  assert.doesNotMatch(t.get(2), /söylenemez/);
  assert.deepEqual(S.selectCandidatePages(t, 5), [2, 3, 4, 5]);
  // bos satir sayisi tutmazsa karakter payina gore bolunur; her sayfaya metin duser
  const t2 = S.pageTexts([{ page_start: 2, page_end: 4, text: [p2, p3, p4].join('\n') }]);
  for (const p of [2, 3, 4]) assert.ok((t2.get(p) || '').length > 20, 'sayfa ' + p);
  assert.match(t2.get(4), /söylenebilir/);
});

test('kendiliginden tarama (strict): yalnizca grafik+soru ya da cizim izi; geri donus yok (FAZ 4b.2)', () => {
  const texts = new Map([
    [1, 'Ekonomik veriler grafiklerle sunulur. Sütun grafiği kategorileri karşılaştırır. '.repeat(3)],
    [2, 'Aşağıdaki grafiğe göre hangisi söylenebilir? A) B) C) D)'],
    [3, 'Talep P = 12 - 2Q ve arz P = 3 + Q doğrularını çiziniz ve dengeyi E ile işaretleyiniz.'],
    [4, ''],
    [5, 'Konu anlatımı devam ediyor, soru yok. '.repeat(8)]
  ]);
  assert.deepEqual(S.selectCandidatePages(texts, 5, 8, true), [2, 3], 'konu anlatimi ve bos sayfa alinmaz');
  assert.deepEqual(S.selectCandidatePages(new Map([[1, 'Uzun bir metin. '.repeat(20)], [2, '']]), 2, 8, true), [], 'iz yoksa hic sayfa yok');
  assert.ok(S.selectCandidatePages(texts, 5).includes(3), 'istenen taramada cizim sorusu sayfasi da aday');
});

test('normalizeScanItem: cizim sorusu (grafik gerekmez) kaydedilir', () => {
  const d = S.normalizeScanItem({ kind: 'draw', chart: null, example: { stem: 'Talep P = 12 - 2Q ve arz P = 3 + Q doğrularını çiziniz, dengeyi E ile işaretleyiniz.', format: 'draw', draw: ['line', 'point', 'uydurma'] } });
  assert.deepEqual(d.chart, {});
  assert.equal(d.example.format, 'draw');
  assert.deepEqual(d.example.draw, ['line', 'point']);
  assert.equal(S.normalizeScanItem({ kind: 'draw', example: { stem: 'çiz', format: 'draw' } }), null, 'kok cok kisa');
});

test('inferFormat: model bicimi gecerliyse o; degilse metinden', () => {
  assert.equal(S.inferFormat('premises', '', [], []), 'premises');
  assert.equal(S.inferFormat('', 'Grafiğe göre aşağıdakilerden hangisi söylenemez?', ['a', 'b', 'c', 'd'], []), 'which_false');
  assert.equal(S.inferFormat('x', 'Grafiğe göre aşağıdaki ifadelerden hangileri doğrudur?', [], ['I', 'II', 'III']), 'premises');
  assert.equal(S.inferFormat(null, 'Grafiğe göre 2021 yılındaki satış kaç TL\'dir? Kaçtır', [], []), 'value');
  assert.equal(S.inferFormat(null, 'Grafiği yorumlayınız.', [], []), 'open');
  assert.equal(S.inferFormat(null, 'En yüksek değer ______ yılındadır.', [], []), 'fill');
  assert.equal(S.inferFormat(null, 'Aşağıdaki ifade doğru mudur?', [], []), 'true_false');
  assert.equal(S.inferFormat(null, 'Grafiğe göre aşağıdakilerden hangisine ulaşılabilir?', ['a', 'b', 'c', 'd', 'e'], []), 'which_true');
});

test('normalizeScanItem: model ciktisi grafik + ornek bicimine donusur', () => {
  const it = S.normalizeScanItem({
    chart: { type: 'column', title: 'Yıllara göre ihracat', x_title: 'Yıl', y_title: 'Milyar $', unit: '$', categories: [2019, 2020, '2021'], series: [{ name: 'İhracat', values: [180, '169,5', 225] }], values_printed: true },
    example: { stem: 'Grafiğe göre aşağıdakilerden hangisi söylenemez?', format: 'which_false', options: ['a', 'b', 'c', 'd', 'e'], skills: ['trend', 'change', 'uydurma'] }
  });
  assert.equal(it.chart.type, 'bar');
  assert.deepEqual(it.chart.labels, ['2019', '2020', '2021']);
  assert.deepEqual(it.chart.series[0].data, [180, 169.5, 225]);
  assert.equal(it.chart.values_printed, true);
  assert.equal(it.chart.y_title, 'Milyar $');
  assert.equal(it.example.format, 'which_false');
  assert.deepEqual(it.example.skills, ['trend', 'change']);
  assert.equal(it.example.options_count, 5);
  assert.equal(it.example.has_question, true);
});

test('normalizeScanItem: desteklenmeyen tur, eksik veri ve sorusuz grafik', () => {
  assert.equal(S.normalizeScanItem({ chart: { type: 'scatter', categories: ['a', 'b'], series: [{ values: [1, 2] }] } }), null);
  assert.equal(S.normalizeScanItem({ chart: { type: 'bar', categories: ['a'], series: [{ values: [1] }] } }), null);
  assert.equal(S.normalizeScanItem({ chart: { type: 'bar', categories: ['a', 'b'], series: [{ values: [1] }] } }), null);
  assert.equal(S.normalizeScanItem(null), null);
  const noQ = S.normalizeScanItem({ chart: { type: 'pasta', categories: ['a', 'b'], series: [{ values: [60, 40] }] }, example: null });
  assert.equal(noQ.chart.type, 'pie');
  assert.equal(noQ.example.has_question, false);
  assert.equal(noQ.example.format, 'which_true', 'sorusuz grafik varsayilan bicim');
  assert.equal(S.normalizeScanItem({ chart: { type: 'Line chart', categories: ['Q1', 'Q2'], series: [{ values: [1, 2] }] } }).chart.type, 'line');
});

test('groqWaitMs: 429 mesajindan bekleme, ust sinir 60 sn', () => {
  assert.equal(S.groqWaitMs(429, null, 'Please try again in 37.65s.'), 38150);
  assert.equal(S.groqWaitMs(429, '5', ''), 5500);
  assert.equal(S.groqWaitMs(429, null, 'Please try again in 2m.'), 60000);
  assert.equal(S.groqWaitMs(429, null, 'bilinmiyor'), 20000);
  assert.equal(S.groqWaitMs(500, null, ''), null);
});

summary();
