/* Run with: node tests/presentation-v7-model-smoke.js */
const assert = require('node:assert/strict');
global.window = global;
require('../js/presentation-model-v7.js');

const M = global.AcadexPresentationModelV7;
assert.ok(M, 'V7 presentation model must load');

const summary = {
  title: 'Özet ve Anahtar Çıkarımlar',
  layout_type: 'title-content',
  content: {
    design_variant: 'summary',
    text: '1. Kalori dengesi önemlidir.\n2. Sürdürülebilir alışkanlıklar önceliklidir.\n3. Planlama ve izleme gerekir.',
    chart: { type: 'bar', labels: ['Değer 1', 'Değer 2', 'Değer 3'], data: [1, 2, 3] }
  },
  speaker_notes: 'Kapanışta ana fikirleri pekiştirin.'
};
assert.equal(M.visualKind(summary), null, 'summary must not become a fake generic chart');
assert.match(M.renderBody(summary), /Kalori dengesi/);
assert.doesNotMatch(M.renderBody(summary), /ap7-chart/);

const realData = {
  title: 'Büyüme Oranları',
  layout_type: 'chart',
  content: {
    design_variant: 'data',
    text: '• Dönemler arasında belirgin değişim görülür.\n• En yüksek değer üçüncü dönemdedir.',
    chart: { type: 'bar', labels: ['2024', '2025', '2026'], data: [12, 17, 23] }
  }
};
assert.equal(M.visualKind(realData), 'chart');
const realDataHtml = M.renderBody(realData);
assert.match(realDataHtml, /Dönemler arasında/);
assert.match(realDataHtml, /ap7-chart/);
assert.match(realDataHtml, /ap7-combo/);

const comparison = {
  title: 'Temel ve Teknik Analiz',
  layout_type: 'table',
  content: {
    design_variant: 'comparison',
    text: '• Temel analiz şirket ve ekonomi verilerine odaklanır.\n• Teknik analiz fiyat ve hacim davranışına odaklanır.',
    table: { headers: ['Yaklaşım', 'Odak'], rows: [['Temel', 'Şirket ve ekonomi'], ['Teknik', 'Fiyat ve hacim']] }
  }
};
assert.equal(M.visualKind(comparison), 'table');
const comparisonHtml = M.renderBody(comparison);
assert.match(comparisonHtml, /Temel analiz şirket/);
assert.match(comparisonHtml, /Şirket ve ekonomi/);

const diagram = {
  title: 'Planlama Döngüsü',
  content: {
    design_variant: 'process',
    text: '• Hedef belirle.\n• Plan oluştur.\n• Sonuçları izle.',
    diagram: { type: 'cycle', nodes: [{ label: 'Hedef', body: 'Amaç belirlenir.' }, { label: 'Plan', body: 'Adımlar oluşturulur.' }, { label: 'İzle', body: 'Sonuçlar değerlendirilir.' }] }
  }
};
assert.equal(M.visualKind(diagram), 'diagram');
assert.match(M.renderBody(diagram), /ap7-diagram/);
assert.match(M.renderBody(diagram), /Hedef belirle/);

console.log('Presentation V7 model smoke tests passed.');
