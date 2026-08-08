/* Acadex Presentation Controls V5 — full-canvas editor + deterministic media + speaker notes preview */
(function () {
  'use strict';
  if (window.__acadexPresentationControlsV5) return;
  window.__acadexPresentationControlsV5 = true;

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const lineItems = (v) => String(v || '').split(/\r?\n/).map(x => x.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
  const slides = () => { try { return Array.isArray(presSlides) ? presSlides : []; } catch (_) { return []; } };
  const active = () => { try { return slides()[Number.isInteger(presActiveSlide) ? presActiveSlide : 0] || null; } catch (_) { return null; } };

  const style = document.createElement('style');
  style.id = 'acadex-presentation-v5-style';
  style.textContent = `
    #presentation-view{padding-bottom:0!important}
    #pres-studio-mode.pres-studio{height:calc(100vh - 104px)!important;min-height:680px!important;gap:.65rem!important}
    #pres-studio-mode .pres-body{grid-template-columns:190px minmax(620px,1fr) 300px!important;gap:.8rem!important;min-height:0!important;flex:1!important}
    #pres-studio-mode .pres-panel{min-height:0!important}
    #pres-studio-mode #pres-canvas{min-height:430px!important;height:100%!important}
    #pres-studio-mode .pres-layout-placeholder{min-height:245px!important}
    #pres-component-empty[hidden],#pres-media-loading[hidden]{display:none!important}
    #pres-component-preview:not([hidden]){display:block!important;width:100%!important;height:100%!important}
    #pres-component-preview:not([hidden]) + #pres-component-actions{z-index:3}
    #pres-layout-placeholder.has-rich-component #pres-component-empty{display:none!important}
    #pres-layout-placeholder.has-rich-component{padding:0!important;border:0!important;background:transparent!important}
    #pres-layout-placeholder.has-rich-component #pres-component-preview{min-height:245px!important}
    #pres-media-loading.acadex-force-hidden{display:none!important}
    .acadex-preview-v5{position:fixed;inset:0;z-index:250000;background:#071827f3;color:#fff;font-family:Inter,Arial,sans-serif;display:grid;grid-template-rows:56px minmax(0,1fr)}
    .ap5-top{display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:#0b2238;border-bottom:1px solid #ffffff18}.ap5-top strong{font-size:14px}.ap5-top button{border:1px solid #ffffff35;background:#ffffff12;color:#fff;border-radius:9px;padding:8px 12px;cursor:pointer;font-weight:800}
    .ap5-stage{display:grid;grid-template-columns:56px minmax(0,1fr) 56px;gap:14px;align-items:center;padding:18px;min-height:0}.ap5-nav{height:48px;border:0;border-radius:50%;background:#ffffff18;color:white;font-size:24px;cursor:pointer}.ap5-nav:disabled{opacity:.25}
    .ap5-center{height:100%;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;overflow:auto;padding:4px}
    .ap5-slide{aspect-ratio:16/9;width:min(1260px,calc(100vw - 180px),calc((100vh - 220px)*1.777));background:white;color:#16325c;border-radius:16px;box-shadow:0 28px 75px #0008;padding:4.8% 5.5%;overflow:hidden;position:relative;flex:none}
    .ap5-slide h1{font-size:clamp(24px,2.7vw,42px);line-height:1.08;margin:0 0 16px;letter-spacing:-.03em}.ap5-rule{height:4px;width:72px;border-radius:99px;background:#0d9488;margin-bottom:18px}.ap5-bullets{display:grid;gap:9px;font-size:clamp(13px,1.3vw,21px);line-height:1.35}.ap5-bullets p{margin:0}.ap5-cols{display:grid;grid-template-columns:1fr 1fr;gap:24px}.ap5-cols>div{padding:16px;border:1px solid #e2e8f0;border-radius:13px;background:#f8fafc;font-size:clamp(12px,1.1vw,18px);line-height:1.4}.ap5-cols p{margin:0 0 8px}
    .ap5-table{width:100%;border-collapse:collapse;font-size:clamp(10px,1vw,16px)}.ap5-table th{background:#e6f7f5;color:#0f5f59}.ap5-table th,.ap5-table td{border:1px solid #cbd5e1;padding:9px;text-align:left}.ap5-chart{display:grid;gap:10px}.ap5-bar{display:grid;grid-template-columns:150px 1fr 65px;gap:10px;align-items:center;font-size:clamp(10px,.95vw,16px)}.ap5-bar i{height:18px;background:#e2e8f0;border-radius:99px;overflow:hidden}.ap5-bar b{display:block;height:100%;background:#0d9488;border-radius:99px}.ap5-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.ap5-cards article{padding:15px;border:1px solid #ccfbf1;border-radius:13px;background:linear-gradient(145deg,#fff,#f0fdfa)}.ap5-cards strong{display:block;margin-bottom:6px;font-size:clamp(11px,1vw,17px)}.ap5-cards p{margin:0;color:#475569;font-size:clamp(9px,.85vw,14px);line-height:1.35}.ap5-image{position:absolute;right:5%;bottom:7%;max-width:36%;max-height:44%;object-fit:contain;border-radius:12px}.ap5-count{position:absolute;right:4%;bottom:3%;color:#94a3b8;font-size:11px}
    .ap5-notes{width:min(1260px,calc(100vw - 180px));background:#102a43;border:1px solid #ffffff20;border-radius:12px;padding:11px 15px;box-shadow:0 10px 26px #0004;flex:none}.ap5-notes strong{display:block;color:#5eead4;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}.ap5-notes p{margin:0;color:#e5edf5;font-size:13px;line-height:1.45;max-height:74px;overflow:auto}
    @media(max-width:1200px){#pres-studio-mode .pres-body{grid-template-columns:165px minmax(500px,1fr) 260px!important}.ap5-cards{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  function enrichSlideFromNotes(slide) {
    if (!slide) return false;
    slide.content = slide.content && typeof slide.content === 'object' ? slide.content : {};
    const visible = String(slide.content.text || '').trim();
    const notes = String(slide.speaker_notes || '').trim();
    if (visible.length >= 260 || notes.length < 140) return false;
    const sentences = notes.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 45 && !visible.includes(s.slice(0, 35)));
    if (!sentences.length) return false;
    const additions = sentences.slice(0, visible.length < 120 ? 2 : 1).map(s => `• Detay: ${s}`);
    if (!additions.length) return false;
    slide.content.text = [visible, ...additions].filter(Boolean).join('\n');
    return true;
  }

  function enrichDeck() {
    let changed = false;
    slides().forEach(s => { if (enrichSlideFromNotes(s)) changed = true; });
    if (changed) {
      try { if (typeof markPresentationDirty === 'function') markPresentationDirty(); } catch (_) {}
      try { if (typeof renderPresentationSlidesList === 'function') renderPresentationSlidesList(); } catch (_) {}
    }
    return changed;
  }

  function syncStructuredPlaceholder() {
    const slide = active();
    const holder = document.getElementById('pres-layout-placeholder');
    const empty = document.getElementById('pres-component-empty');
    const preview = document.getElementById('pres-component-preview');
    if (!holder || !empty || !preview || !slide) return;
    const hasRich = !!(slide.content?.table?.rows?.length || slide.content?.chart?.labels?.length);
    holder.classList.toggle('has-rich-component', hasRich);
    if (hasRich) {
      empty.hidden = true;
      preview.hidden = false;
      document.getElementById('pres-layout-placeholder-title')?.setAttribute('aria-hidden','true');
      document.getElementById('pres-layout-placeholder-hint')?.setAttribute('aria-hidden','true');
    } else {
      empty.hidden = false;
    }
  }

  function forceMediaSettled() {
    const loading = document.getElementById('pres-media-loading');
    const image = document.getElementById('pres-slide-image');
    const empty = document.getElementById('pres-media-empty');
    if (!loading) return;
    const slide = active();
    let path = '';
    try { path = typeof getPresentationImagePath === 'function' ? getPresentationImagePath(slide) : ''; } catch (_) {}
    if (!path) {
      loading.hidden = true;
      loading.classList.add('acadex-force-hidden');
      if (empty) empty.hidden = false;
      return;
    }
    if (image?.getAttribute('src')) {
      loading.hidden = true;
      loading.classList.add('acadex-force-hidden');
      image.hidden = false;
      if (empty) empty.hidden = true;
      return;
    }
    const token = String(Date.now());
    loading.dataset.acadexToken = token;
    setTimeout(() => {
      if (loading.dataset.acadexToken !== token) return;
      loading.hidden = true;
      loading.classList.add('acadex-force-hidden');
      if (image?.getAttribute('src')) {
        image.hidden = false;
        if (empty) empty.hidden = true;
      } else if (empty) {
        empty.hidden = false;
      }
    }, 3200);
  }

  function afterRender() {
    enrichSlideFromNotes(active());
    setTimeout(syncStructuredPlaceholder, 0);
    setTimeout(forceMediaSettled, 20);
  }

  function patchRenderers() {
    if (!window.__acadexV5RenderPatched && typeof window.renderActivePresentationSlide === 'function') {
      const original = window.renderActivePresentationSlide;
      window.renderActivePresentationSlide = function () {
        const result = original.apply(this, arguments);
        afterRender();
        return result;
      };
      window.__acadexV5RenderPatched = true;
    }
    if (!window.__acadexV5RichPatched && typeof window.renderPresentationRichContent === 'function') {
      const original = window.renderPresentationRichContent;
      window.renderPresentationRichContent = function () {
        const result = original.apply(this, arguments);
        setTimeout(syncStructuredPlaceholder, 0);
        return result;
      };
      window.__acadexV5RichPatched = true;
    }
  }

  function bodyHtml(slide) {
    const c = slide?.content || {};
    if (c.table?.headers?.length && c.table?.rows?.length) return `<table class="ap5-table"><thead><tr>${c.table.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${c.table.rows.map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    if (c.chart?.labels?.length && c.chart?.data?.length) {
      const vals = c.chart.data.map(Number); const max = Math.max(1, ...vals.map(v=>Math.abs(v)));
      return `<div class="ap5-chart">${c.chart.labels.map((l,i)=>`<div class="ap5-bar"><span>${esc(l)}</span><i><b style="width:${Math.max(4,Math.abs(vals[i]||0)/max*100)}%"></b></i><strong>${esc(c.chart.data[i])}</strong></div>`).join('')}</div>`;
    }
    if (Array.isArray(c.cards) && c.cards.length) return `<div class="ap5-cards">${c.cards.slice(0,6).map(x=>`<article><strong>${esc(x.title)}</strong><p>${esc(x.body||'')}</p></article>`).join('')}</div>`;
    const primary = lineItems(c.text); const secondary = lineItems(c.secondary_text);
    if (secondary.length) return `<div class="ap5-cols"><div>${primary.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div><div>${secondary.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div></div>`;
    return `<div class="ap5-bullets">${primary.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div>`;
  }

  async function hydrateImage(root, slide) {
    let path=''; try { path = typeof getPresentationImagePath === 'function' ? getPresentationImagePath(slide) : ''; } catch (_) {}
    if (!path) return;
    const img = root.querySelector('.ap5-image'); if (!img) return;
    try {
      const url = await Promise.race([getPresentationImageUrl(path), new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),5000))]);
      if (url) { img.src=url; img.hidden=false; }
    } catch (_) { img.remove(); }
  }

  function openPreviewV5() {
    try { if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor(); } catch (_) {}
    enrichDeck();
    const deck = slides(); if (!deck.length) return;
    document.querySelector('.acadex-preview-v5')?.remove();
    document.getElementById('acadex-presentation-preview')?.remove();
    const overlay=document.createElement('div'); overlay.className='acadex-preview-v5';
    overlay.innerHTML=`<div class="ap5-top"><strong>${esc((typeof presCurrentPresentation!=='undefined'&&presCurrentPresentation?.title)||'Acadex Sunum')}</strong><div><span id="ap5-index"></span> &nbsp; <button id="ap5-close" type="button">Kapat ✕</button></div></div><div class="ap5-stage"><button class="ap5-nav" id="ap5-prev">‹</button><div class="ap5-center"><div id="ap5-slide-host"></div><div class="ap5-notes"><strong>Konuşma Notları</strong><p id="ap5-notes-text"></p></div></div><button class="ap5-nav" id="ap5-next">›</button></div>`;
    document.body.appendChild(overlay);
    let index=0;
    const draw=()=>{
      const s=deck[index]; const host=overlay.querySelector('#ap5-slide-host');
      host.innerHTML=`<section class="ap5-slide"><h1>${esc(s.title||`Slayt ${index+1}`)}</h1><div class="ap5-rule"></div>${bodyHtml(s)}<img class="ap5-image" hidden alt=""><span class="ap5-count">${index+1} / ${deck.length}</span></section>`;
      overlay.querySelector('#ap5-index').textContent=`${index+1} / ${deck.length}`;
      overlay.querySelector('#ap5-notes-text').textContent=String(s.speaker_notes||'Bu slayt için konuşma notu eklenmemiş.');
      overlay.querySelector('#ap5-prev').disabled=index===0; overlay.querySelector('#ap5-next').disabled=index===deck.length-1;
      hydrateImage(host,s);
    };
    overlay.querySelector('#ap5-prev').onclick=()=>{if(index>0){index--;draw();}};
    overlay.querySelector('#ap5-next').onclick=()=>{if(index<deck.length-1){index++;draw();}};
    overlay.querySelector('#ap5-close').onclick=()=>overlay.remove();
    const key=e=>{if(!document.body.contains(overlay)){document.removeEventListener('keydown',key,true);return;}if(e.key==='Escape')overlay.remove();if(e.key==='ArrowRight'&&index<deck.length-1){index++;draw();}if(e.key==='ArrowLeft'&&index>0){index--;draw();}};
    document.addEventListener('keydown',key,true); draw();
  }

  document.addEventListener('click', (e) => {
    const preview = e.target.closest('#pres-preview-btn');
    if (preview) {
      e.preventDefault(); e.stopImmediatePropagation(); openPreviewV5(); return;
    }
    const layout = e.target.closest('.pres-layout-btn');
    if (layout) setTimeout(afterRender, 10);
  }, true);

  const observer=new MutationObserver(()=>{ syncStructuredPlaceholder(); forceMediaSettled(); });
  const start=()=>{
    patchRenderers(); enrichDeck(); afterRender();
    const root=document.getElementById('pres-studio-mode'); if(root) observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','src','data-layout']});
    let tries=0; const t=setInterval(()=>{patchRenderers();if(++tries>20)clearInterval(t);},500);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.AcadexPresentationControlsV5={openPreview:openPreviewV5,enrich:enrichDeck,settleMedia:forceMediaSettled,syncStructured:syncStructuredPlaceholder};
})();