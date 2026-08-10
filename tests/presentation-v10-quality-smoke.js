/* Run with: node tests/presentation-v10-quality-smoke.js */
const assert = require('node:assert/strict');

global.window = global;
global.document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  head: { appendChild() {} },
  createElement() { return { style: {}, appendChild() {}, addEventListener() {}, querySelector() { return null; } }; },
};
global.MutationObserver = class { observe() {} disconnect() {} };

require('../js/presentation/core/presentation-services-v10.js');
require('../js/presentation/core/presentation-schema-v10.js');
require('../js/presentation/quality/presentation-quality-v10.js');

const Services = global.AcadexPresentationServicesV10;
const Schema = global.AcadexPresentationSchemaV10;
const Quality = global.AcadexPresentationQualityV10;

assert.ok(Services, 'V10 services must load');
assert.ok(Schema, 'V10 schema must load');
assert.ok(Quality, 'V10 quality engine must load');
assert.equal(Services.resolveSupabase(), null, 'missing Supabase must safely return null without recursion');

const normalized = Schema.normalizeSlide({
  title: 'Test',
  layout: 'chart',
  content: {
    text: 'Ana mesaj',
    designVariant: 'data',
    citations: [{ claim: 'Gerçek iddia', sourceId: 'source-1', page: 4, confidence: 0.9 }],
  },
}, 0);
assert.equal(normalized.schema_version, 10);
assert.equal(normalized.layout_type, 'chart');
assert.equal(normalized.content.design_variant, 'data');
assert.equal(normalized.content.citations[0].locator.page, 4);

const goodDeck = [
  { title: 'Yapay Zekâ ve Tedarik Zinciri', content: { design_variant: 'hero', text: 'Araştırmanın amacı ve kapsamı açıklanır.' }, speaker_notes: 'Bu sunumda yapay zekânın tedarik zinciri kararlarına etkisini, fırsatlarını ve risklerini kaynaklara dayalı biçimde ele alacağım.' },
  { title: 'Problem ve Bağlam', content: { text: 'Tedarik zincirlerinde belirsizlik artmaktadır.\nTahmin, stok ve rota kararları veri yoğun hale gelmiştir.', citations: [{ claim: 'Belirsizlik', source_id: 's1', page: 2 }] }, speaker_notes: 'Önce problemin neden önemli olduğunu açıklayın ve sonraki slaytta kavramsal çerçeveye geçiş yapın.' },
  { title: 'Temel Uygulamalar', content: { design_variant: 'cards', text: 'Talep tahmini\nStok optimizasyonu\nRota planlama', cards: [{ title: 'Tahmin', body: 'Talep sinyallerinin analizi' }, { title: 'Stok', body: 'Stok seviyelerinin optimizasyonu' }], citations: [{ claim: 'Uygulamalar', source_id: 's1', page: 5 }] }, speaker_notes: 'Üç uygulamayı kısa örneklerle açıklayın; slayttaki metni kelimesi kelimesine okumayın.' },
  { title: 'Süreç Etkisi', content: { design_variant: 'process', text: 'Veri toplanır\nModel tahmin üretir\nKarar desteklenir', steps: [{ title: 'Veri', body: 'Sinyaller toplanır' }, { title: 'Model', body: 'Tahmin üretilir' }, { title: 'Karar', body: 'Operasyon yönlendirilir' }], citations: [{ claim: 'Süreç', source_id: 's1', page: 7 }] }, speaker_notes: 'Süreci uçtan uca anlatın ve her adımın karar kalitesi üzerindeki rolünü vurgulayın.' },
  { title: 'Riskler', content: { text: 'Veri kalitesi zayıfsa çıktı güvenilirliği düşer.\nModel yanlılığı kararları etkileyebilir.', citations: [{ claim: 'Riskler', source_id: 's1', page: 9 }] }, speaker_notes: 'Teknolojinin tek başına çözüm olmadığını, veri yönetişimi ve insan kontrolünün önemini açıklayın.' },
  { title: 'Sonuç ve Öneriler', content: { design_variant: 'summary', text: 'AI karar hızını artırabilir.\nKaynak kalitesi ve yönetişim kritik önemdedir.', citations: [{ claim: 'Sonuç', source_id: 's1', page: 11 }] }, speaker_notes: 'Kapanışta ana mesajı özetleyin ve uygulanabilir iki öneriyle sunumu tamamlayın.' },
];

const goodReview = Quality.reviewDeck(goodDeck, { source_type: 'document' });
assert.ok(goodReview.score >= 70, `good deck should score reasonably high, got ${goodReview.score}`);
assert.ok(goodReview.metrics.grounding >= 80, 'cited source deck should have strong grounding');
assert.equal(goodReview.meta.slideCount, 6);

const repeatedDeck = [
  { title: 'Aynı Konu', content: { text: 'Aynı açıklama aynı kavram aynı yaklaşım ve aynı sonuç burada tekrar edilmektedir.' } },
  { title: 'Aynı Konu', content: { text: 'Aynı açıklama aynı kavram aynı yaklaşım ve aynı sonuç burada tekrar edilmektedir.' } },
  { title: 'Sonuç', content: { text: 'Kısa sonuç.' } },
];
const repeatedReview = Quality.reviewDeck(repeatedDeck, { source_type: 'topic' });
assert.ok(repeatedReview.metrics.repetition < 100, 'duplicate slides must reduce repetition score');
assert.ok(repeatedReview.issues.some((issue) => issue.type === 'repetition'), 'duplicate slides must create repetition issue');

const uncitedDeck = goodDeck.map((slide) => ({ ...slide, content: { ...slide.content, citations: [], source_refs: [] } }));
const uncitedReview = Quality.reviewDeck(uncitedDeck, { source_type: 'document' });
assert.ok(uncitedReview.metrics.grounding < goodReview.metrics.grounding, 'uncited document deck must score lower on grounding');
assert.ok(uncitedReview.suggestions.some((x) => /Citation Engine/i.test(x)), 'uncited source deck should suggest citation engine');

console.log('Presentation V10 quality smoke tests passed.');
