/* Acadex Presentation Studio V10 — deterministic quality critic.
 * Gives an explainable local score before/after Acadia edits; no AI call required.
 */
(function () {
  'use strict';
  if (window.AcadexPresentationQualityV10) return;

  const S = () => window.AcadexPresentationServicesV10;
  const Schema = () => window.AcadexPresentationSchemaV10;

  function words(value) {
    return String(value || '').toLocaleLowerCase('tr-TR')
      .replace(/[^a-z0-9çğıöşü\s]/gi, ' ')
      .split(/\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length > 2);
  }

  function clamp(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  function slideText(slide) {
    const c = slide?.content || {};
    return [slide?.title, c.text, c.secondary_text].filter(Boolean).join(' ');
  }

  function hasVisual(slide) {
    const c = slide?.content || {};
    return !!(
      slide?.image_url || c.table || c.chart || c.cards || c.steps || c.metric || c.diagram
    );
  }

  function citationCount(slide) {
    const c = slide?.content || {};
    const direct = Array.isArray(c.citations) ? c.citations.length : 0;
    const refs = Array.isArray(c.source_refs) ? c.source_refs.length : 0;
    return Math.max(direct, refs);
  }

  function similarity(a, b) {
    const aa = new Set(words(a));
    const bb = new Set(words(b));
    if (!aa.size || !bb.size) return 0;
    let intersection = 0;
    aa.forEach((item) => { if (bb.has(item)) intersection += 1; });
    const union = new Set([...aa, ...bb]).size;
    return union ? intersection / union : 0;
  }

  function reviewDeck(rawSlides, presentation) {
    const slides = Schema()?.normalizeDeck?.(rawSlides) || (Array.isArray(rawSlides) ? rawSlides : []);
    const pres = presentation || {};
    if (!slides.length) {
      return {
        score: 0,
        metrics: { story: 0, readability: 0, visualBalance: 0, grounding: 0, repetition: 0, speakerReadiness: 0 },
        suggestions: ['Önce en az bir slayt oluşturun.'],
        issues: [],
      };
    }

    const issues = [];
    const suggestions = [];

    // Story / narrative
    let story = 78;
    if (slides.length >= 6 && slides.length <= 14) story += 8;
    if (String(slides[0]?.content?.design_variant || '').toLowerCase() === 'hero') story += 6;
    if (/özet|sonuç|conclusion|summary|çıkarım|öneri/i.test(slides[slides.length - 1]?.title || '')) story += 8;
    const untitled = slides.filter((x) => /^slayt\s+\d+$/i.test(x.title || '')).length;
    story -= untitled * 7;
    if (untitled) suggestions.push(`${untitled} slaytın başlığını daha anlamlı hale getirin.`);

    // Readability / density
    const bodyCounts = slides.map((slide) => words([slide?.content?.text, slide?.content?.secondary_text].filter(Boolean).join(' ')).length);
    const tooDense = bodyCounts.map((count, i) => ({ count, i })).filter((x) => x.count > 90);
    const tooThin = bodyCounts.map((count, i) => ({ count, i })).filter((x) => x.count < 8 && i > 0);
    let readability = 94 - (tooDense.length * 10) - (tooThin.length * 4);
    tooDense.forEach((x) => issues.push({ type: 'density', slide: x.i + 1, message: `Slayt ${x.i + 1} çok yoğun (${x.count} kelime).` }));
    if (tooDense.length) suggestions.push(`${tooDense.length} yoğun slaytı kısaltın veya iki slayta bölün.`);
    if (tooThin.length >= 2) suggestions.push(`${tooThin.length} slaytta açıklama çok kısa; ana mesajı güçlendirin.`);

    // Visual balance
    const visualSlides = slides.filter(hasVisual).length;
    const visualRatio = visualSlides / slides.length;
    let visualBalance = 55 + Math.min(38, visualRatio * 55);
    if (visualRatio < 0.3 && slides.length >= 6) {
      suggestions.push('Sunum metin ağırlıklı; 2-3 slaytı tablo, süreç, karşılaştırma veya veri görseline dönüştürün.');
    }
    const consecutiveVisuals = slides.reduce((max, slide, i) => {
      if (!hasVisual(slide)) return max;
      let run = 1;
      for (let j = i - 1; j >= 0 && hasVisual(slides[j]); j -= 1) run += 1;
      return Math.max(max, run);
    }, 0);
    if (consecutiveVisuals > 5) visualBalance -= 6;

    // Grounding / citations
    const sourceType = String(pres.source_type || pres.sourceType || 'topic');
    const sourceBacked = sourceType === 'document' || sourceType === 'study_card';
    const groundedSlides = slides.filter((slide) => citationCount(slide) > 0).length;
    let grounding = sourceBacked
      ? (slides.length ? 35 + (groundedSlides / slides.length) * 65 : 0)
      : 90;
    if (sourceBacked && groundedSlides === 0) {
      suggestions.push('Kaynak tabanlı sunumda slayt seviyesinde kaynak işaretleri henüz yok; Citation Engine ile iddiaları sayfa/section bazında bağlayın.');
      issues.push({ type: 'citation', slide: null, message: 'Kaynaklı sunumda citation coverage %0.' });
    }

    // Repetition
    let duplicatePairs = 0;
    for (let i = 0; i < slides.length; i += 1) {
      for (let j = i + 1; j < slides.length; j += 1) {
        const sim = similarity(slideText(slides[i]), slideText(slides[j]));
        if (sim >= 0.72) {
          duplicatePairs += 1;
          issues.push({ type: 'repetition', slide: j + 1, message: `Slayt ${i + 1} ve ${j + 1} içerik olarak fazla benzer.` });
        }
      }
    }
    const repetition = clamp(100 - duplicatePairs * 14);
    if (duplicatePairs) suggestions.push(`${duplicatePairs} tekrar çifti bulundu; benzer slaytları birleştirin veya farklılaştırın.`);

    // Speaker readiness
    const notesReady = slides.filter((slide) => words(slide?.speaker_notes).length >= 18).length;
    const speakerReadiness = clamp(45 + (notesReady / slides.length) * 55);
    if (notesReady < Math.ceil(slides.length * 0.6)) suggestions.push('Konuşmacı notlarını en az slaytların %60’ında güçlendirin.');

    story = clamp(story);
    readability = clamp(readability);
    visualBalance = clamp(visualBalance);
    grounding = clamp(grounding);

    const score = clamp(
      story * 0.22 +
      readability * 0.18 +
      visualBalance * 0.16 +
      grounding * 0.20 +
      repetition * 0.12 +
      speakerReadiness * 0.12
    );

    if (!suggestions.length) suggestions.push('Sunum dengeli görünüyor. Son adım olarak prova modunda süre ve anlatım akışını kontrol edin.');

    return {
      score,
      metrics: { story, readability, visualBalance, grounding, repetition, speakerReadiness },
      suggestions: suggestions.slice(0, 6),
      issues: issues.slice(0, 20),
      meta: { slideCount: slides.length, visualSlides, groundedSlides, sourceType },
    };
  }

  function reviewCurrent() {
    const state = S()?.state?.() || { slides: [], presentation: null };
    return reviewDeck(state.slides, state.presentation);
  }

  function metricLabel(key) {
    return ({
      story: 'Hikâye',
      readability: 'Okunabilirlik',
      visualBalance: 'Görsel denge',
      grounding: 'Kaynak desteği',
      repetition: 'Tekrarsızlık',
      speakerReadiness: 'Sunum hazırlığı',
    })[key] || key;
  }

  function injectStyles() {
    if (document.getElementById('acadex-presentation-quality-v10-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-presentation-quality-v10-style';
    style.textContent = `
      .pres-q10-card{background:#fff;border:1px solid rgba(22,50,92,.09);border-radius:14px;padding:.75rem;box-shadow:0 1px 2px rgba(15,23,42,.03)}
      .pres-q10-head{display:flex;align-items:center;justify-content:space-between;gap:.6rem}
      .pres-q10-head h4{margin:0!important;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
      .pres-q10-score{display:inline-flex;align-items:center;justify-content:center;min-width:54px;padding:.28rem .5rem;border-radius:999px;background:#f0fdfa;color:#0f766e;font-weight:900;font-size:.78rem;border:1px solid #ccfbf1}
      .pres-q10-grid{display:grid;grid-template-columns:1fr 1fr;gap:.32rem;margin:.6rem 0}
      .pres-q10-metric{background:#f8fafc;border-radius:9px;padding:.38rem .45rem;font-size:.64rem;color:#64748b;display:flex;justify-content:space-between;gap:.35rem}
      .pres-q10-metric b{color:#16325c}
      .pres-q10-list{margin:.5rem 0 0;padding-left:1.1rem;color:#475569;font-size:.68rem;line-height:1.45}
      .pres-q10-btn{width:100%;border:1px solid rgba(13,148,136,.3);background:linear-gradient(135deg,#f0fdfa,#f8fafc);color:#0f766e;border-radius:10px;padding:.48rem .55rem;font-weight:800;font-size:.7rem;cursor:pointer}
      .pres-q10-btn:hover{border-color:#0d9488;background:#ecfdf5}
    `;
    document.head.appendChild(style);
  }

  function renderCard(card, result) {
    card.querySelector('.pres-q10-score').textContent = `${result.score}/100`;
    const grid = card.querySelector('.pres-q10-grid');
    grid.replaceChildren();
    Object.entries(result.metrics).forEach(([key, value]) => {
      const item = document.createElement('div');
      item.className = 'pres-q10-metric';
      const label = document.createElement('span');
      label.textContent = metricLabel(key);
      const score = document.createElement('b');
      score.textContent = String(value);
      item.append(label, score);
      grid.appendChild(item);
    });
    const list = card.querySelector('.pres-q10-list');
    list.replaceChildren();
    result.suggestions.slice(0, 4).forEach((suggestion) => {
      const li = document.createElement('li');
      li.textContent = suggestion;
      list.appendChild(li);
    });
    card.dataset.score = String(result.score);
    S()?.emit?.('quality', result);
  }

  function ensureCard() {
    injectStyles();
    const body = document.querySelector('#pres-studio-mode .pres-right-body');
    if (!body || document.getElementById('pres-quality-v10-card')) return;
    const card = document.createElement('section');
    card.id = 'pres-quality-v10-card';
    card.className = 'pres-q10-card';
    card.innerHTML = `
      <div class="pres-q10-head"><h4>Academic Quality</h4><span class="pres-q10-score">—/100</span></div>
      <div class="pres-q10-grid"></div>
      <button type="button" class="pres-q10-btn">✨ Acadia ile sunumu denetle</button>
      <ul class="pres-q10-list"><li>Skoru görmek için sunumu denetleyin.</li></ul>
    `;
    card.querySelector('.pres-q10-btn').addEventListener('click', () => renderCard(card, reviewCurrent()));
    const acadiaCard = Array.from(body.children).find((el) => el.querySelector?.('#v9-open-chat'));
    if (acadiaCard) body.insertBefore(card, acadiaCard);
    else body.appendChild(card);
  }

  function boot() {
    ensureCard();
    const studio = document.getElementById('pres-studio-mode');
    if (!studio) return;
    const observer = new MutationObserver(() => ensureCard());
    observer.observe(studio, { childList: true, subtree: true, attributes: true });
  }

  window.AcadexPresentationQualityV10 = { version: '10.0.0', reviewDeck, reviewCurrent, ensureCard };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 900);
  setTimeout(boot, 2200);
})();
