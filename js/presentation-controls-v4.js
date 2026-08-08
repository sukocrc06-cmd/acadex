/* Acadex Presentation Controls V4 — reliability layer for preview/export/media/editor */
(function () {
  'use strict';

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lines = (v) => String(v || '').split(/\r?\n/).map(x => x.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);

  function getSlides() {
    try { return typeof presSlides !== 'undefined' && Array.isArray(presSlides) ? presSlides : []; }
    catch (_) { return []; }
  }
  function activeSlide() {
    try { return getSlides()[typeof presActiveSlide === 'number' ? presActiveSlide : 0] || null; }
    catch (_) { return null; }
  }

  function structuredText(slide) {
    const content = slide?.content && typeof slide.content === 'object' ? slide.content : {};
    if (String(content.text || '').trim()) return String(content.text).trim();
    if (Array.isArray(content.cards) && content.cards.length) {
      return content.cards.slice(0, 6).map(x => `• ${x?.title || ''}${x?.body ? ` — ${x.body}` : ''}`.trim()).join('\n');
    }
    if (Array.isArray(content.steps) && content.steps.length) {
      return content.steps.slice(0, 7).map((x, i) => `• ${x?.label || i + 1}. ${x?.title || ''}${x?.body ? ` — ${x.body}` : ''}`.trim()).join('\n');
    }
    if (content.metric?.value) return `• ${content.metric.value} — ${content.metric.label || ''}${content.metric.context ? `: ${content.metric.context}` : ''}`;
    if (content.table?.headers?.length && content.table?.rows?.length) {
      const h = content.table.headers.join(' | ');
      return [h, ...content.table.rows.slice(0, 5).map(r => (Array.isArray(r) ? r.join(' | ') : ''))].filter(Boolean).map(x => `• ${x}`).join('\n');
    }
    if (content.chart?.labels?.length && content.chart?.data?.length) {
      return content.chart.labels.slice(0, 10).map((x, i) => `• ${x}: ${content.chart.data[i] ?? ''}`).join('\n');
    }
    if (String(content.secondary_text || '').trim()) return String(content.secondary_text).trim();
    const note = String(slide?.speaker_notes || '').trim();
    if (note) {
      return note.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ').slice(0, 650);
    }
    return '';
  }

  function repairSlide(slide) {
    if (!slide) return false;
    slide.content = slide.content && typeof slide.content === 'object' ? slide.content : {};
    if (String(slide.content.text || '').trim()) return false;
    const fallback = structuredText(slide);
    if (!fallback) return false;
    slide.content.text = fallback;
    return true;
  }

  function repairAllSlides() {
    let changed = false;
    getSlides().forEach(slide => { if (repairSlide(slide)) changed = true; });
    if (changed) {
      try { if (typeof markPresentationDirty === 'function') markPresentationDirty(); } catch (_) {}
      try { if (typeof renderPresentationSlidesList === 'function') renderPresentationSlidesList(); } catch (_) {}
    }
    return changed;
  }

  // Keep rich AI slides from falling back to the editor placeholder.
  const originalRenderActive = window.renderActivePresentationSlide;
  if (typeof originalRenderActive === 'function') {
    window.renderActivePresentationSlide = function () {
      repairSlide(activeSlide());
      return originalRenderActive.apply(this, arguments);
    };
  }

  // Storage requests must never leave the UI in an endless loading state.
  window.renderPresentationMedia = async function (slide) {
    let requestId;
    try { requestId = ++presImageRenderRequestId; } catch (_) { requestId = Date.now(); }
    const slideKey = slide?._localKey;
    const image = document.getElementById('pres-slide-image');
    const empty = document.getElementById('pres-media-empty');
    const actions = document.getElementById('pres-media-actions');
    const loading = document.getElementById('pres-media-loading');
    if (!image || !empty || !actions || !loading) return;

    image.hidden = true;
    actions.hidden = true;
    loading.hidden = true;
    empty.hidden = false;
    image.removeAttribute('src');

    let path = '';
    try { path = typeof getPresentationImagePath === 'function' ? getPresentationImagePath(slide) : ''; } catch (_) {}
    if (!path) return; // image-left/right is a layout choice, not an endless AI-generation state.

    loading.hidden = false;
    empty.hidden = true;
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('PRESENTATION_IMAGE_TIMEOUT')), 9000);
      });
      const url = await Promise.race([getPresentationImageUrl(path), timeout]);
      let current = null;
      try { current = activeSlide(); } catch (_) {}
      if (current?._localKey !== slideKey) return;
      if (!url) throw new Error('PRESENTATION_IMAGE_URL_EMPTY');
      image.src = url;
      image.alt = slide?.content?.image?.alt || slide?.title || 'Sunum görseli';
      image.hidden = false;
      actions.hidden = false;
      empty.hidden = true;
    } catch (error) {
      console.error('Presentation image render failed safely:', error);
      empty.hidden = false;
      try { if (typeof showPresentationUploadMessage === 'function') showPresentationUploadMessage('Görsel yüklenemedi. Tekrar seçebilir veya görseli değiştirebilirsiniz.', true); } catch (_) {}
    } finally {
      clearTimeout(timer);
      loading.hidden = true;
    }
  };

  // Upload busy state is allowed only during a real file upload.
  const originalSetImageBusy = window.setPresentationImageBusy;
  if (typeof originalSetImageBusy === 'function') {
    window.setPresentationImageBusy = function (busy) {
      const result = originalSetImageBusy.apply(this, arguments);
      if (!busy) {
        const loading = document.getElementById('pres-media-loading');
        if (loading) loading.hidden = true;
      }
      return result;
    };
  }

  function slideBodyHtml(slide) {
    const content = slide?.content || {};
    const table = content.table;
    const chart = content.chart;
    const cards = Array.isArray(content.cards) ? content.cards : [];
    const steps = Array.isArray(content.steps) ? content.steps : [];
    if (table?.headers?.length && table?.rows?.length) {
      return `<table class="apv-table"><thead><tr>${table.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    if (chart?.labels?.length && chart?.data?.length) {
      const vals = chart.data.map(Number).filter(Number.isFinite);
      const max = Math.max(1, ...vals.map(v => Math.abs(v)));
      return `<div class="apv-chart">${chart.labels.map((label,i)=>{const v=Number(chart.data[i])||0;const w=Math.max(5,Math.round(Math.abs(v)/max*100));return `<div class="apv-bar-row"><span>${esc(label)}</span><div><i style="width:${w}%"></i></div><b>${esc(chart.data[i])}</b></div>`;}).join('')}</div>`;
    }
    if (cards.length) {
      return `<div class="apv-cards">${cards.slice(0,6).map((c,i)=>`<article><small>${String(i+1).padStart(2,'0')}</small><strong>${esc(c.title)}</strong><p>${esc(c.body||'')}</p></article>`).join('')}</div>`;
    }
    if (steps.length) {
      return `<div class="apv-steps">${steps.slice(0,7).map((s,i)=>`<article><span>${esc(s.label||i+1)}</span><strong>${esc(s.title)}</strong><p>${esc(s.body||'')}</p></article>`).join('<em>→</em>')}</div>`;
    }
    const primary = lines(structuredText(slide));
    const secondary = lines(content.secondary_text);
    if (secondary.length) {
      return `<div class="apv-cols"><div>${primary.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div><div>${secondary.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div></div>`;
    }
    return `<div class="apv-bullets">${primary.map(x=>`<p><span>•</span>${esc(x)}</p>`).join('')}</div>`;
  }

  async function hydratePreviewImages(root) {
    const nodes = [...root.querySelectorAll('[data-preview-image-path]')];
    await Promise.all(nodes.map(async node => {
      const path = node.dataset.previewImagePath;
      try {
        const url = await Promise.race([
          getPresentationImageUrl(path),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000))
        ]);
        if (url) { node.src = url; node.hidden = false; }
      } catch (_) { node.remove(); }
    }));
  }

  function openPreview() {
    try { if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor(); } catch (_) {}
    repairAllSlides();
    const slides = getSlides();
    if (!slides.length) return;
    document.getElementById('acadex-presentation-preview')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'acadex-presentation-preview';
    overlay.innerHTML = `<style>
      #acadex-presentation-preview{position:fixed;inset:0;z-index:200000;background:#071827eF;display:grid;grid-template-rows:auto 1fr;color:#fff;font-family:Inter,Arial,sans-serif}
      .apv-top{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:#0b2238;border-bottom:1px solid #ffffff18}.apv-top strong{font-size:14px}.apv-top button{border:1px solid #ffffff35;background:#ffffff12;color:white;border-radius:9px;padding:8px 12px;cursor:pointer;font-weight:700}
      .apv-stage{display:grid;grid-template-columns:62px minmax(0,1fr) 62px;align-items:center;gap:12px;padding:24px;min-height:0}.apv-nav{height:48px;border:0;border-radius:50%;font-size:24px;cursor:pointer;background:#ffffff18;color:#fff}.apv-nav:disabled{opacity:.25;cursor:default}
      .apv-slide{aspect-ratio:16/9;width:min(1180px,calc(100vw - 190px),calc((100vh - 120px)*1.777));margin:auto;background:#fff;color:#16325c;border-radius:18px;box-shadow:0 30px 80px #0008;padding:5.5% 6%;overflow:hidden;position:relative}.apv-slide h1{margin:0 0 22px;font-size:clamp(24px,3vw,44px);line-height:1.1;letter-spacing:-.03em}.apv-rule{height:4px;width:72px;background:#0d9488;border-radius:99px;margin-bottom:24px}
      .apv-bullets{display:grid;gap:11px;font-size:clamp(14px,1.45vw,24px);line-height:1.35}.apv-bullets p{margin:0;display:flex;gap:12px}.apv-bullets span{color:#0d9488;font-weight:900}.apv-cols{display:grid;grid-template-columns:1fr 1fr;gap:34px;font-size:clamp(13px,1.25vw,21px);line-height:1.4}.apv-cols>div{padding:18px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0}.apv-cols p{margin:0 0 10px}
      .apv-table{width:100%;border-collapse:collapse;font-size:clamp(11px,1.1vw,18px)}.apv-table th{background:#e6f7f5;color:#0f5f59;text-align:left;padding:11px;border:1px solid #cbd5e1}.apv-table td{padding:10px;border:1px solid #dbe3eb}.apv-chart{display:grid;gap:12px}.apv-bar-row{display:grid;grid-template-columns:160px 1fr 70px;align-items:center;gap:12px;font-size:clamp(11px,1vw,17px)}.apv-bar-row>div{height:20px;background:#e8eef4;border-radius:99px;overflow:hidden}.apv-bar-row i{display:block;height:100%;background:linear-gradient(90deg,#0f766e,#2dd4bf);border-radius:99px}.apv-bar-row b{text-align:right}
      .apv-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.apv-cards article{padding:18px;border-radius:14px;background:linear-gradient(145deg,#fff,#f0fdfa);border:1px solid #ccfbf1;box-shadow:0 6px 20px #0f172a0d}.apv-cards small{display:block;color:#0f766e;font-weight:900;margin-bottom:10px}.apv-cards strong{display:block;font-size:clamp(12px,1.15vw,19px);margin-bottom:7px}.apv-cards p{margin:0;color:#475569;font-size:clamp(10px,.95vw,16px);line-height:1.4}
      .apv-steps{display:flex;align-items:stretch;gap:8px}.apv-steps article{flex:1;padding:15px;border-radius:13px;background:#f0fdfa;border:1px solid #ccfbf1}.apv-steps article span{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:#0f766e;color:white;font-weight:900;margin-bottom:10px}.apv-steps strong{display:block;font-size:clamp(11px,1vw,17px)}.apv-steps p{font-size:clamp(9px,.85vw,14px);color:#64748b}.apv-steps em{align-self:center;color:#0d9488;font-size:22px;font-style:normal;font-weight:900}.apv-img{position:absolute;right:5%;bottom:5%;max-width:35%;max-height:42%;border-radius:14px;object-fit:contain}.apv-count{position:absolute;right:4%;bottom:3%;font-size:11px;color:#94a3b8}
      @media(max-width:800px){.apv-stage{grid-template-columns:44px 1fr 44px;padding:8px}.apv-slide{width:calc(100vw - 110px);padding:6%}.apv-cards{grid-template-columns:1fr 1fr}.apv-bar-row{grid-template-columns:90px 1fr 45px}}
    </style><div class="apv-top"><strong>${esc((typeof presCurrentPresentation!=='undefined' && presCurrentPresentation?.title) || 'Acadex Sunum')}</strong><div><span id="apv-index"></span> &nbsp; <button type="button" id="apv-close">Kapat ✕</button></div></div><div class="apv-stage"><button class="apv-nav" id="apv-prev">‹</button><div id="apv-slide-host"></div><button class="apv-nav" id="apv-next">›</button></div>`;
    document.body.appendChild(overlay);
    let index = 0;
    const host = overlay.querySelector('#apv-slide-host');
    const counter = overlay.querySelector('#apv-index');
    const draw = () => {
      const s = slides[index];
      let imagePath = '';
      try { imagePath = typeof getPresentationImagePath === 'function' ? getPresentationImagePath(s) : ''; } catch (_) {}
      host.innerHTML = `<section class="apv-slide"><h1>${esc(s.title || `Slayt ${index+1}`)}</h1><div class="apv-rule"></div>${slideBodyHtml(s)}${imagePath?`<img class="apv-img" hidden data-preview-image-path="${esc(imagePath)}">`:''}<span class="apv-count">${index+1} / ${slides.length}</span></section>`;
      counter.textContent = `${index + 1} / ${slides.length}`;
      overlay.querySelector('#apv-prev').disabled = index === 0;
      overlay.querySelector('#apv-next').disabled = index === slides.length - 1;
      void hydratePreviewImages(host);
    };
    overlay.querySelector('#apv-close').onclick = () => overlay.remove();
    overlay.querySelector('#apv-prev').onclick = () => { if(index>0){index--;draw();} };
    overlay.querySelector('#apv-next').onclick = () => { if(index<slides.length-1){index++;draw();} };
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    const keyHandler = e => {
      if (!document.getElementById('acadex-presentation-preview')) { document.removeEventListener('keydown', keyHandler); return; }
      if (e.key === 'Escape') overlay.remove();
      if (e.key === 'ArrowLeft' && index>0) { index--; draw(); }
      if (e.key === 'ArrowRight' && index<slides.length-1) { index++; draw(); }
    };
    document.addEventListener('keydown', keyHandler);
    draw();
  }

  function loadExportEngine() {
    if (window.AcadexPresentationExport) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-acadex-presentation-export]');
      if (existing) {
        if (window.AcadexPresentationExport) return resolve();
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'js/presentation-export.js?v=4';
      script.dataset.acadexPresentationExport = '1';
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function bindControls() {
    repairAllSlides();
    const preview = document.getElementById('pres-preview-btn');
    if (preview && preview.dataset.previewV4 !== '1') {
      preview.dataset.previewV4 = '1';
      preview.addEventListener('click', e => { e.preventDefault(); openPreview(); });
    }
    void loadExportEngine().catch(error => console.error('Presentation export engine could not load:', error));

    // If a visual layout is selected with no image, present the picker immediately and never fake an AI-loading state.
    document.querySelectorAll('.pres-layout-btn[data-layout="image-left"],.pres-layout-btn[data-layout="image-right"]').forEach(btn => {
      if (btn.dataset.mediaV4 === '1') return;
      btn.dataset.mediaV4 = '1';
      btn.addEventListener('click', () => {
        setTimeout(() => {
          const slide = activeSlide();
          let path = '';
          try { path = typeof getPresentationImagePath === 'function' ? getPresentationImagePath(slide) : ''; } catch (_) {}
          if (!path) {
            const loading = document.getElementById('pres-media-loading');
            const empty = document.getElementById('pres-media-empty');
            if (loading) loading.hidden = true;
            if (empty) empty.hidden = false;
          }
        }, 0);
      });
    });
  }

  window.AcadexPresentationControls = { preview: openPreview, repair: repairAllSlides };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindControls, { once:true });
  else bindControls();
  // AI generation can replace all slide objects after this script has loaded; repair on the next UI paint as well.
  const observer = new MutationObserver(() => {
    if (!document.getElementById('pres-studio-mode')) return;
    clearTimeout(observer._timer);
    observer._timer = setTimeout(() => { repairAllSlides(); }, 120);
  });
  const list = document.getElementById('pres-slides-list');
  if (list) observer.observe(list, { childList:true, subtree:true });
})();