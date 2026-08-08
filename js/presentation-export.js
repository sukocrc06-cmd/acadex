/* Acadex Academic Presentation — Step 8 export engine */
(function () {
  'use strict';

  const CDN = {
    pptxgen: 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'
  };

  function text(value) { return String(value == null ? '' : value); }
  function safeName(value) {
    return (text(value).trim() || 'Acadex-Sunum').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 100);
  }
  function slides() { return Array.isArray(presSlides) ? presSlides : []; }
  function presentationTitle() { return presCurrentPresentation?.title || document.getElementById('pres-title-input')?.value || 'Acadex Sunum'; }
  function slideText(slide) {
    if (typeof getPresentationSlideText === 'function') return getPresentationSlideText(slide);
    return text(slide?.content?.text);
  }
  function secondaryText(slide) {
    if (typeof getPresentationSlideSecondaryText === 'function') return getPresentationSlideSecondaryText(slide);
    return text(slide?.content?.secondary_text);
  }
  function bullets(value) {
    return text(value).split(/\r?\n/).map(v => v.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
  }
  function loadScript(src, globalName) {
    if (window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-acadex-export="${globalName}"]`);
      if (existing) { existing.addEventListener('load', resolve, { once:true }); existing.addEventListener('error', reject, { once:true }); return; }
      const script = document.createElement('script');
      script.src = src; script.async = true; script.dataset.acadexExport = globalName;
      script.onload = resolve; script.onerror = () => reject(new Error(`${globalName} yüklenemedi`));
      document.head.appendChild(script);
    });
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function notify(message, type='success') {
    if (typeof showDashboardAlert === 'function') showDashboardAlert(type, message); else window.alert(message);
  }
  async function ensureSaved() {
    if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor();
    if (presIsDirty && typeof savePresentation === 'function') {
      const ok = await savePresentation({ silent: true });
      if (!ok) throw new Error('Sunum kaydedilemedi. Dışa aktarma iptal edildi.');
    }
  }
  async function imageData(path) {
    if (!path || !window.supabaseClient) return null;
    try {
      const { data, error } = await supabaseClient.storage.from('presentation-images').createSignedUrl(path, 120);
      if (error || !data?.signedUrl) return null;
      const response = await fetch(data.signedUrl); if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => resolve(null); r.readAsDataURL(blob); });
    } catch (_) { return null; }
  }
  function imagePath(slide) {
    if (typeof getPresentationImagePath === 'function') return getPresentationImagePath(slide);
    return slide?.image_path || slide?.content?.image_path || null;
  }

  async function exportPptx() {
    await ensureSaved();
    await loadScript(CDN.pptxgen, 'PptxGenJS');
    if (!window.PptxGenJS) throw new Error('PowerPoint motoru yüklenemedi.');
    const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'Acadex'; pptx.subject = presentationTitle(); pptx.title = presentationTitle(); pptx.company = 'Acadex'; pptx.lang = presCurrentPresentation?.language === 'en' ? 'en-US' : 'tr-TR';
    pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: pptx.lang };
    for (let i=0; i<slides().length; i++) {
      const source = slides()[i]; const s = pptx.addSlide(); s.background = { color: 'F8FAFC' };
      s.addText(text(source.title) || `Slayt ${i+1}`, { x:0.65, y:0.45, w:12.0, h:0.55, fontFace:'Aptos Display', fontSize:26, bold:true, color:'16325C', margin:0 });
      s.addShape(pptx.ShapeType.line, { x:0.65, y:1.15, w:12.0, h:0, line:{ color:'2A9D8F', width:1.5 } });
      const primary = bullets(slideText(source)); const secondary = bullets(secondaryText(source)); const hasImage = !!imagePath(source);
      const bodyW = hasImage ? 7.0 : (secondary.length ? 5.7 : 12.0);
      if (primary.length) s.addText(primary.map(t => ({ text:t, options:{ bullet:{ indent:18 }, hanging:4, breakLine:true } })), { x:0.75, y:1.45, w:bodyW, h:5.25, fontSize:18, color:'24364B', breakLine:true, valign:'top', margin:0.08, paraSpaceAfterPt:9, fit:'shrink' });
      if (secondary.length) s.addText(secondary.map(t => ({ text:t, options:{ bullet:{ indent:18 }, hanging:4, breakLine:true } })), { x:6.9, y:1.45, w:5.7, h:5.25, fontSize:17, color:'24364B', valign:'top', margin:0.08, paraSpaceAfterPt:9, fit:'shrink' });
      if (hasImage) { const data = await imageData(imagePath(source)); if (data) s.addImage({ data, x:8.05, y:1.55, w:4.55, h:4.8, sizing:'contain' }); }
      s.addText(`${i+1} / ${slides().length}`, { x:11.65, y:7.05, w:1.0, h:0.2, fontSize:8, color:'64748B', align:'right', margin:0 });
      if (source.speaker_notes && typeof s.addNotes === 'function') s.addNotes(text(source.speaker_notes));
    }
    await pptx.writeFile({ fileName: `${safeName(presentationTitle())}.pptx` });
    notify('PowerPoint (.pptx) hazırlandı.');
  }

  async function exportWord() {
    await ensureSaved();
    const esc = v => text(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const body = slides().map((s,i) => `<section style="page-break-after:always"><h1>${esc(s.title || `Slayt ${i+1}`)}</h1>${bullets(slideText(s)).map(x=>`<p>• ${esc(x)}</p>`).join('')}${secondaryText(s)?`<h2>Ek İçerik</h2>${bullets(secondaryText(s)).map(x=>`<p>• ${esc(x)}</p>`).join('')}`:''}${s.speaker_notes?`<h3>Konuşmacı Notları</h3><p>${esc(s.speaker_notes)}</p>`:''}</section>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(presentationTitle())}</title><style>body{font-family:Arial,sans-serif;color:#16325c;margin:36pt}h1{font-size:26pt}h2{font-size:18pt}p{font-size:14pt;line-height:1.5}</style></head><body><h1>${esc(presentationTitle())}</h1>${body}</body></html>`;
    downloadBlob(new Blob(['\ufeff', html], { type:'application/msword;charset=utf-8' }), `${safeName(presentationTitle())}.doc`);
    notify('Word belgesi hazırlandı.');
  }

  async function exportPdf() {
    await ensureSaved();
    const esc = v => text(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const pages = slides().map((s,i)=>`<section class="slide"><h1>${esc(s.title || `Slayt ${i+1}`)}</h1><div class="rule"></div><div class="body">${bullets(slideText(s)).map(x=>`<p>• ${esc(x)}</p>`).join('')}${secondaryText(s)?`<div class="secondary">${bullets(secondaryText(s)).map(x=>`<p>• ${esc(x)}</p>`).join('')}</div>`:''}</div><footer>${i+1} / ${slides().length}</footer></section>`).join('');
    const win = window.open('', '_blank', 'noopener,noreferrer'); if (!win) throw new Error('PDF penceresi tarayıcı tarafından engellendi.');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(presentationTitle())}</title><style>@page{size:13.333in 7.5in;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#fff;color:#16325c}.slide{width:13.333in;height:7.5in;padding:.55in .7in;position:relative;page-break-after:always;overflow:hidden}.slide:last-child{page-break-after:auto}h1{font-size:28pt;margin:0 0 .18in}.rule{height:2px;background:#2a9d8f;margin-bottom:.25in}.body{font-size:18pt;line-height:1.35;color:#24364b}.body p{margin:.10in 0}.secondary{columns:2;column-gap:.35in}footer{position:absolute;right:.65in;bottom:.28in;font-size:9pt;color:#64748b}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${pages}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`); win.document.close();
    notify('16:9 PDF önizlemesi açıldı. Yazdır penceresinden “PDF olarak kaydet” seçin.');
  }

  function openMenu(anchor) {
    document.getElementById('acadex-pres-export-menu')?.remove();
    const menu = document.createElement('div'); menu.id='acadex-pres-export-menu'; menu.setAttribute('role','menu');
    Object.assign(menu.style,{position:'fixed',zIndex:'100000',background:'#fff',border:'1px solid rgba(22,50,92,.14)',borderRadius:'10px',boxShadow:'0 14px 35px rgba(15,23,42,.18)',padding:'6px',minWidth:'220px'});
    const items=[['PowerPoint (.pptx)',exportPptx],['PDF (16:9)',exportPdf],['Word (.doc)',exportWord]];
    items.forEach(([label,fn])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=label; b.setAttribute('role','menuitem'); Object.assign(b.style,{display:'block',width:'100%',padding:'10px 12px',border:'0',background:'transparent',textAlign:'left',cursor:'pointer',borderRadius:'7px',fontWeight:'600',color:'#16325c'}); b.onmouseenter=()=>b.style.background='#f1f5f9'; b.onmouseleave=()=>b.style.background='transparent'; b.onclick=async()=>{menu.remove(); try{await fn();}catch(e){console.error('Presentation export failed:',e);notify(e.message||'Dışa aktarma başarısız oldu.','error');}}; menu.appendChild(b); });
    document.body.appendChild(menu); const r=anchor.getBoundingClientRect(); menu.style.top=`${Math.min(window.innerHeight-menu.offsetHeight-8,r.bottom+6)}px`; menu.style.left=`${Math.max(8,Math.min(window.innerWidth-menu.offsetWidth-8,r.right-menu.offsetWidth))}px`;
    setTimeout(()=>document.addEventListener('click',function close(e){if(!menu.contains(e.target)&&e.target!==anchor){menu.remove();document.removeEventListener('click',close);}},true),0);
  }
  function bind() {
    const button=document.getElementById('pres-export-btn'); if(!button || button.dataset.exportBound==='1') return;
    button.dataset.exportBound='1'; button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openMenu(button);});
  }
  document.addEventListener('DOMContentLoaded',bind); if(document.readyState!=='loading') bind();
  window.AcadexPresentationExport={pptx:exportPptx,pdf:exportPdf,word:exportWord};
})();
