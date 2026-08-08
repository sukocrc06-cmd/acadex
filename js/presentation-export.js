/* Acadex Academic Presentation — reliable export engine V4 */
(function () {
  'use strict';

  const CDN = { pptxgen: 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js' };
  function text(value) { return String(value == null ? '' : value); }
  function safeName(value) { return (text(value).trim() || 'Acadex-Sunum').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 100); }
  function slides() { try { return Array.isArray(presSlides) ? presSlides : []; } catch (_) { return []; } }
  function presentationTitle() { try { return presCurrentPresentation?.title || document.getElementById('pres-title-input')?.value || 'Acadex Sunum'; } catch (_) { return 'Acadex Sunum'; } }
  function slideText(slide) {
    const content = slide?.content || {};
    let value = '';
    try { value = typeof getPresentationSlideText === 'function' ? getPresentationSlideText(slide) : text(content.text); } catch (_) { value = text(content.text); }
    if (value.trim()) return value;
    if (Array.isArray(content.cards)) return content.cards.map(x=>`• ${x.title}${x.body?` — ${x.body}`:''}`).join('\n');
    if (Array.isArray(content.steps)) return content.steps.map((x,i)=>`• ${x.label||i+1}. ${x.title}${x.body?` — ${x.body}`:''}`).join('\n');
    if (content.metric?.value) return `• ${content.metric.value} — ${content.metric.label || ''}${content.metric.context?`: ${content.metric.context}`:''}`;
    if (content.table?.rows?.length) return content.table.rows.map(r=>`• ${r.join(' — ')}`).join('\n');
    if (content.chart?.labels?.length) return content.chart.labels.map((x,i)=>`• ${x}: ${content.chart.data?.[i]??''}`).join('\n');
    return text(slide?.speaker_notes).slice(0, 900);
  }
  function secondaryText(slide) { try { return typeof getPresentationSlideSecondaryText === 'function' ? getPresentationSlideSecondaryText(slide) : text(slide?.content?.secondary_text); } catch (_) { return text(slide?.content?.secondary_text); } }
  function bullets(value) { return text(value).split(/\r?\n/).map(v => v.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean); }
  function loadScript(src, globalName) {
    if (window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-acadex-export="${globalName}"]`);
      if (existing) { existing.addEventListener('load', resolve, { once:true }); existing.addEventListener('error', reject, { once:true }); return; }
      const script = document.createElement('script'); script.src = src; script.async = true; script.dataset.acadexExport = globalName;
      script.onload = resolve; script.onerror = () => reject(new Error(`${globalName} yüklenemedi`)); document.head.appendChild(script);
    });
  }
  function downloadBlob(blob, filename) { const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function notify(message, type='success') { if (typeof showDashboardAlert === 'function') showDashboardAlert(type, message); else window.alert(message); }
  async function ensureSaved() {
    try { if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor(); } catch (_) {}
    try { if (window.AcadexPresentationControls?.repair) window.AcadexPresentationControls.repair(); } catch (_) {}
    try { if (presIsDirty && typeof savePresentation === 'function') { const ok=await savePresentation({silent:true}); if(!ok) throw new Error('Sunum kaydedilemedi. Dışa aktarma iptal edildi.'); } } catch (e) { if(e?.message) throw e; }
  }
  async function imageData(path) {
    if (!path || !window.supabaseClient) return null;
    if (/^data:image\//i.test(path)) return path;
    try {
      let url = path;
      if (!/^https?:\/\//i.test(path)) {
        const {data,error}=await supabaseClient.storage.from('presentation-images').createSignedUrl(path.replace(/^storage:/,''),120);
        if(error||!data?.signedUrl)return null; url=data.signedUrl;
      }
      const response=await Promise.race([fetch(url),new Promise((_,reject)=>setTimeout(()=>reject(new Error('image timeout')),8000))]); if(!response.ok)return null;
      const blob=await response.blob(); return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>resolve(null);r.readAsDataURL(blob);});
    } catch (_) { return null; }
  }
  function imagePath(slide) { try { return typeof getPresentationImagePath === 'function' ? getPresentationImagePath(slide) : slide?.image_url || slide?.content?.image?.storage_path || null; } catch (_) { return null; } }

  function addTableToPptx(pptx, s, table) {
    if (!table?.headers?.length || !table?.rows?.length || typeof s.addTable !== 'function') return false;
    const rows=[table.headers.map(h=>({text:text(h),options:{bold:true,color:'0F5F59',fill:'E6F7F5'}})),...table.rows.map(r=>r.map(c=>text(c)))];
    s.addTable(rows,{x:.75,y:1.55,w:11.85,h:4.8,border:{type:'solid',pt:1,color:'CBD5E1'},fontFace:'Aptos',fontSize:13,color:'24364B',margin:.06,autoFit:false});
    return true;
  }
  function addChartToPptx(pptx, s, chart) {
    if (!chart?.labels?.length || !chart?.data?.length || typeof s.addChart !== 'function') return false;
    const typeMap={bar:pptx.ChartType?.bar,line:pptx.ChartType?.line,pie:pptx.ChartType?.pie}; const chartType=typeMap[chart.type]||pptx.ChartType?.bar;
    if (!chartType) return false;
    s.addChart(chartType,[{name:chart.series_label||'Değer',labels:chart.labels,values:chart.data.map(Number)}],{x:.85,y:1.5,w:11.5,h:4.9,showLegend:chart.type==='pie',showTitle:!!chart.title,title:chart.title||'',showValue:true,catAxisLabelFontSize:12,valAxisLabelFontSize:11,chartColors:['0D9488','16325C','14B8A6','64748B','F59E0B']});
    return true;
  }

  async function exportPptx() {
    await ensureSaved(); await loadScript(CDN.pptxgen,'PptxGenJS'); if(!window.PptxGenJS)throw new Error('PowerPoint motoru yüklenemedi.');
    const pptx=new PptxGenJS(); pptx.layout='LAYOUT_WIDE'; pptx.author='Acadex'; pptx.subject=presentationTitle(); pptx.title=presentationTitle(); pptx.company='Acadex';
    try { pptx.lang=presCurrentPresentation?.language==='en'?'en-US':'tr-TR'; } catch (_) { pptx.lang='tr-TR'; }
    pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:pptx.lang};
    for(let i=0;i<slides().length;i++){
      const source=slides()[i], content=source?.content||{}, s=pptx.addSlide(); s.background={color:'F8FAFC'};
      s.addText(text(source.title)||`Slayt ${i+1}`,{x:.65,y:.45,w:12,h:.55,fontFace:'Aptos Display',fontSize:26,bold:true,color:'16325C',margin:0});
      s.addShape(pptx.ShapeType.line,{x:.65,y:1.15,w:12,h:0,line:{color:'2A9D8F',width:1.5}});
      let rich=false; if(content.table)rich=addTableToPptx(pptx,s,content.table); else if(content.chart)rich=addChartToPptx(pptx,s,content.chart);
      if(!rich){
        const primary=bullets(slideText(source)), secondary=bullets(secondaryText(source)), hasImage=!!imagePath(source), bodyW=hasImage?7:(secondary.length?5.7:12);
        if(primary.length)s.addText(primary.map(t=>({text:t,options:{bullet:{indent:18},hanging:4,breakLine:true}})),{x:.75,y:1.45,w:bodyW,h:5.25,fontSize:18,color:'24364B',valign:'top',margin:.08,paraSpaceAfterPt:9,fit:'shrink'});
        if(secondary.length)s.addText(secondary.map(t=>({text:t,options:{bullet:{indent:18},hanging:4,breakLine:true}})),{x:6.9,y:1.45,w:5.7,h:5.25,fontSize:17,color:'24364B',valign:'top',margin:.08,paraSpaceAfterPt:9,fit:'shrink'});
        if(hasImage){const data=await imageData(imagePath(source));if(data)s.addImage({data,x:8.05,y:1.55,w:4.55,h:4.8,sizing:'contain'});}
      }
      s.addText(`${i+1} / ${slides().length}`,{x:11.65,y:7.05,w:1,h:.2,fontSize:8,color:'64748B',align:'right',margin:0});
      if(source.speaker_notes&&typeof s.addNotes==='function')s.addNotes(text(source.speaker_notes));
    }
    await pptx.writeFile({fileName:`${safeName(presentationTitle())}.pptx`}); notify('PowerPoint (.pptx) hazırlandı.');
  }

  function printableBody(s) {
    const content=s?.content||{}, e=v=>esc(v);
    if(content.table?.headers?.length&&content.table?.rows?.length)return `<table><thead><tr>${content.table.headers.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${content.table.rows.map(r=>`<tr>${r.map(c=>`<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    if(content.chart?.labels?.length&&content.chart?.data?.length){const vals=content.chart.data.map(Number);const max=Math.max(1,...vals.map(v=>Math.abs(v)));return `<div class="chart">${content.chart.labels.map((l,i)=>`<div class="barrow"><span>${e(l)}</span><i><b style="width:${Math.max(4,Math.abs(vals[i]||0)/max*100)}%"></b></i><strong>${e(content.chart.data[i])}</strong></div>`).join('')}</div>`;}
    const p=bullets(slideText(s)), sec=bullets(secondaryText(s)); return `<div class="body${sec.length?' cols':''}"><div>${p.map(x=>`<p>• ${e(x)}</p>`).join('')}</div>${sec.length?`<div>${sec.map(x=>`<p>• ${e(x)}</p>`).join('')}</div>`:''}</div>`;
  }
  function esc(v){return text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  async function exportPdf(){
    await ensureSaved(); const pages=slides().map((s,i)=>`<section class="slide"><h1>${esc(s.title||`Slayt ${i+1}`)}</h1><div class="rule"></div>${printableBody(s)}<footer>${i+1} / ${slides().length}</footer></section>`).join('');
    const win=window.open('','_blank'); if(!win)throw new Error('PDF penceresi tarayıcı tarafından engellendi. Açılır pencerelere izin verin.');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(presentationTitle())}</title><style>@page{size:13.333in 7.5in;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#16325c}.slide{width:13.333in;height:7.5in;padding:.55in .7in;position:relative;page-break-after:always;overflow:hidden}.slide:last-child{page-break-after:auto}h1{font-size:28pt;margin:0 0 .15in}.rule{height:3px;width:.8in;background:#0d9488;margin-bottom:.28in}.body{font-size:17pt;line-height:1.35;color:#24364b}.body p{margin:.10in 0}.cols{display:grid;grid-template-columns:1fr 1fr;gap:.35in}table{width:100%;border-collapse:collapse;font-size:13pt}th{background:#e6f7f5;color:#0f5f59}th,td{border:1px solid #cbd5e1;padding:8pt}.chart{display:grid;gap:10pt}.barrow{display:grid;grid-template-columns:1.6in 1fr .7in;gap:10pt;align-items:center;font-size:13pt}.barrow i{height:18pt;background:#e2e8f0;border-radius:20pt;overflow:hidden}.barrow b{display:block;height:100%;background:#0d9488;border-radius:20pt}footer{position:absolute;right:.65in;bottom:.28in;font-size:9pt;color:#64748b}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${pages}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`); win.document.close(); notify('PDF önizlemesi açıldı. Yazdır menüsünden “PDF olarak kaydet” seçin.');
  }
  async function exportWord(){await ensureSaved();const body=slides().map((s,i)=>`<section style="page-break-after:always"><h1>${esc(s.title||`Slayt ${i+1}`)}</h1>${printableBody(s)}${s.speaker_notes?`<h3>Konuşmacı Notları</h3><p>${esc(s.speaker_notes)}</p>`:''}</section>`).join('');const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial;color:#16325c;margin:36pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6pt}</style></head><body><h1>${esc(presentationTitle())}</h1>${body}</body></html>`;downloadBlob(new Blob(['\ufeff',html],{type:'application/msword;charset=utf-8'}),`${safeName(presentationTitle())}.doc`);notify('Word belgesi hazırlandı.');}

  function openMenu(anchor){
    document.getElementById('acadex-pres-export-menu')?.remove(); const menu=document.createElement('div');menu.id='acadex-pres-export-menu';menu.setAttribute('role','menu');Object.assign(menu.style,{position:'fixed',zIndex:'210000',background:'#fff',border:'1px solid rgba(22,50,92,.14)',borderRadius:'10px',boxShadow:'0 14px 35px rgba(15,23,42,.18)',padding:'6px',minWidth:'220px'});
    [['PowerPoint (.pptx)',exportPptx],['PDF (16:9)',exportPdf],['Word (.doc)',exportWord]].forEach(([label,fn])=>{const b=document.createElement('button');b.type='button';b.textContent=label;Object.assign(b.style,{display:'block',width:'100%',padding:'10px 12px',border:'0',background:'transparent',textAlign:'left',cursor:'pointer',borderRadius:'7px',fontWeight:'700',color:'#16325c'});b.onclick=async()=>{menu.remove();try{await fn();}catch(e){console.error('Presentation export failed:',e);notify(e.message||'Dışa aktarma başarısız oldu.','error');}};menu.appendChild(b);});
    document.body.appendChild(menu);const r=anchor.getBoundingClientRect();menu.style.top=`${Math.min(window.innerHeight-menu.offsetHeight-8,r.bottom+6)}px`;menu.style.left=`${Math.max(8,Math.min(window.innerWidth-menu.offsetWidth-8,r.right-menu.offsetWidth))}px`;
    setTimeout(()=>document.addEventListener('click',function close(e){if(!menu.contains(e.target)&&e.target!==anchor){menu.remove();document.removeEventListener('click',close);}},true),0);
  }
  function bind(){const button=document.getElementById('pres-export-btn');if(!button||button.dataset.exportBound==='1')return;button.dataset.exportBound='1';button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openMenu(button);});}
  document.addEventListener('DOMContentLoaded',bind);if(document.readyState!=='loading')bind();window.AcadexPresentationExport={pptx:exportPptx,pdf:exportPdf,word:exportWord};
})();