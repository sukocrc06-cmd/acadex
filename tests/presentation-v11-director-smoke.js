/* Run with: node tests/presentation-v11-director-smoke.js */
const assert = require('node:assert/strict');

global.window = global;
global.document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  head: { appendChild() {} },
  body: { appendChild() {} },
  createElement() {
    return {
      id: '', className: '', style: {}, dataset: {}, innerHTML: '',
      appendChild() {}, prepend() {}, addEventListener() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
    };
  },
};
global.MutationObserver = class { observe() {} disconnect() {} };

global.presSlides = [
  { id: 's1', title: 'Giriş', content: { text: 'Bağlam', design_variant: 'hero' }, speaker_notes: 'Konuya giriş yapan yeterli uzunlukta konuşmacı notu burada yer alır.' },
  { id: 's2', title: 'Analiz', content: { text: 'Temel analiz', design_variant: 'section' }, speaker_notes: 'Analiz slaytını açıklayan yeterli uzunlukta konuşmacı notu burada yer alır.' },
  { id: 's3', title: 'Sonuç', content: { text: 'Sonuç', design_variant: 'summary' }, speaker_notes: 'Sonuçları ve önerileri özetleyen yeterli uzunlukta konuşmacı notu burada yer alır.' },
];
global.presActiveSlide = 0;
global.presCurrentId = 'p1';
global.presCurrentPresentation = { id: 'p1', title: 'Test Deck', source_type: 'topic', language: 'tr' };
global.presIsDirty = false;

require('../js/presentation/core/presentation-services-v10.js');
require('../js/presentation/core/presentation-schema-v10.js');
require('../js/presentation/quality/presentation-quality-v10.js');
require('../js/presentation/ai/acadia-presentation-director-v11.js');

const Services = global.AcadexPresentationServicesV10;
const Director = global.AcadiaPresentationDirectorV11;
assert.ok(Services, 'V10 service layer should load');
assert.ok(Director, 'V11 director should load');
assert.equal(Director.version, '11.0.0');
assert.equal(Director.edgeFunction, 'acadia-presentation-director');
assert.equal(Director.busy, false);

const originalInvoke = Services.invoke;
Services.invoke = async (name, body) => {
  assert.equal(name, 'acadia-presentation-director');
  assert.equal(body.action, 'health');
  return { ok: true, version: 11 };
};

(async () => {
  const online = await Director.health(true);
  assert.equal(online, true, 'health should detect V11 backend');

  Services.invoke = async () => { throw new Error('Function not found'); };
  const offline = await Director.health(true);
  assert.equal(offline, false, 'health should gracefully switch to fallback mode');

  Services.invoke = originalInvoke;
  console.log('Presentation V11 director smoke tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
