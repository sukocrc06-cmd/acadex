/* ==========================================================================
   ACADEX SITE STATUS (js/site-status.js)
   Shared site settings helper.
   ========================================================================== */
let __acadexSiteSettingsPromise = null;
function acadexGetSiteSettings() {
  if (__acadexSiteSettingsPromise) return __acadexSiteSettingsPromise;
  __acadexSiteSettingsPromise = (async () => {
    try {
      const { data, error } = await supabaseClient.from('site_settings').select('*');
      if (error || !data) return { maintenance: { enabled: false }, banner: { enabled: false } };
      const maintenance = data.find(s => s.key === 'maintenance_mode')?.value || { enabled: false };
      const banner = data.find(s => s.key === 'site_banner')?.value || { enabled: false };
      return { maintenance, banner };
    } catch (e) {
      console.error('acadexGetSiteSettings error:', e);
      return { maintenance: { enabled: false }, banner: { enabled: false } };
    }
  })();
  return __acadexSiteSettingsPromise;
}
window.acadexGetSiteSettings = acadexGetSiteSettings;
const ACADEX_BANNER_DISMISS_KEY = 'acadexBannerDismissedText';
function acadexRenderBanner(banner) {
  if (!banner || !banner.enabled || !banner.message) return;
  if (sessionStorage.getItem(ACADEX_BANNER_DISMISS_KEY) === banner.message) return;
  const bar = document.createElement('div');
  bar.id = 'acadex-site-banner';
  bar.style.cssText = 'position:relative;width:100%;background:var(--color-teal,#0D9488);color:#fff;font-size:.85rem;font-weight:600;text-align:center;padding:.6rem 2.5rem;z-index:10000;box-shadow:0 1px 4px rgba(0,0,0,.1)';
  const span = document.createElement('span'); span.textContent = banner.message;
  const button = document.createElement('button'); button.setAttribute('aria-label','Kapat'); button.textContent='×'; button.style.cssText='position:absolute;right:.75rem;top:50%;transform:translateY(-50%);background:none;border:none;color:#fff;font-size:1.1rem;cursor:pointer;line-height:1';
  button.addEventListener('click',()=>{sessionStorage.setItem(ACADEX_BANNER_DISMISS_KEY,banner.message);bar.remove();});
  bar.append(span,button); document.body.insertBefore(bar,document.body.firstChild);
}
function acadexRenderMaintenanceNotice(maintenance) {
  if (!maintenance || !maintenance.enabled) return null;
  const notice=document.createElement('div'); notice.id='acadex-maintenance-notice'; notice.className='alert alert-error'; notice.style.cssText='max-width:480px;margin:0 auto 1.5rem;text-align:left;'; notice.textContent=maintenance.message||'Acadex şu anda bakımda. Lütfen daha sonra tekrar deneyin.'; return notice;
}
window.acadexRenderMaintenanceNotice=acadexRenderMaintenanceNotice;
function acadexApplyPortalLabel(){
  const portal=new URLSearchParams(window.location.search).get('portal'); if(!portal)return;
  const copy={teacher:{title:'Hoca Girişi',subtitle:'Akademik panelinize erişmek için giriş yapın'},admin:{title:'Yönetim Girişi',subtitle:'Admin panelinize erişmek için giriş yapın'}}[portal]; if(!copy)return;
  const titleEl=document.querySelector('#login-view .auth-title'); const subtitleEl=document.querySelector('#login-view .auth-subtitle');
  if(titleEl){titleEl.removeAttribute('data-i18n');titleEl.textContent=copy.title;} if(subtitleEl){subtitleEl.removeAttribute('data-i18n');subtitleEl.textContent=copy.subtitle;}
}
function acadexLoadScript(src){
  return new Promise((resolve,reject)=>{
    const existing = Array.from(document.scripts).find((script) => script.src && script.src.includes(src.split('?')[0]));
    if (existing) return resolve();
    const s=document.createElement('script'); s.src=src; s.async=false; s.onload=resolve; s.onerror=reject; document.body.appendChild(s);
  });
}
document.addEventListener('DOMContentLoaded',async()=>{
  if(window.location.pathname.includes('login.html')) acadexApplyPortalLabel();
  const settings=await acadexGetSiteSettings(); acadexRenderBanner(settings.banner);
  if(window.location.pathname.includes('login.html')&&settings.maintenance?.enabled){const notice=acadexRenderMaintenanceNotice(settings.maintenance);const loginView=document.getElementById('login-view');if(notice&&loginView)loginView.insertBefore(notice,loginView.firstChild);}
  if(window.location.pathname.includes('dashboard.html')){
    // V10 shared runtime: stable services/schema used by V10 and V11.
    try { await acadexLoadScript('js/presentation/core/presentation-services-v10.js?v=10.0.0'); } catch (e) { console.error('Presentation services V10 failed:', e); }
    try { await acadexLoadScript('js/presentation/core/presentation-schema-v10.js?v=10.0.0'); } catch (e) { console.error('Presentation schema V10 failed:', e); }

    // Core editor stack
    try { await acadexLoadScript('js/presentation-model-v7.js?v=7.0.0'); } catch (e) { console.error('Presentation model V7 failed:', e); }
    try { await acadexLoadScript('js/presentation-renderer-v7.js?v=7.0.0'); } catch (e) { console.error('Presentation renderer V7 failed:', e); }
    try { await acadexLoadScript('js/presentation-studio-v73.js?v=7.3.0'); } catch (e) { console.error('Presentation studio V7.3 failed:', e); }
    try { await acadexLoadScript('js/presentation-controls-v7.js?v=7.0.0'); } catch (e) { console.error('Presentation controls V7 failed:', e); }
    try { await acadexLoadScript('js/presentation-modal-scroll-v7.js?v=7.2.0'); } catch (e) { console.error('Presentation modal scroll V7.2 failed:', e); }
    try { await acadexLoadScript('js/presentation-export-v8.js?v=8.0.0'); } catch (e) { console.error('Presentation export V8 failed:', e); }

    // Premium academic layer (existing V8/V9 capabilities)
    try { await acadexLoadScript('js/presentation-theme-v8.js?v=8.2.0'); } catch (e) { console.error('Presentation theme V8 failed:', e); }
    try { await acadexLoadScript('js/presentation-settings-v8.js?v=8.1.1'); } catch (e) { console.error('Presentation settings V8 failed:', e); }
    try { await acadexLoadScript('js/presentation-dedupe-v8.js?v=8.1.1'); } catch (e) { console.error('Presentation dedupe V8 failed:', e); }
    try { await acadexLoadScript('js/presentation-visual-ai-v8.js?v=8.3.0'); } catch (e) { console.error('Presentation visual AI V8 failed:', e); }
    try { await acadexLoadScript('js/presentation-visual-ux-v8.js?v=8.1.1'); } catch (e) { console.error('Presentation visual UX V8 failed:', e); }
    try { await acadexLoadScript('js/presentation-polish-v8.js?v=8.1.1'); } catch (e) { console.error('Presentation polish V8 failed:', e); }
    try { await acadexLoadScript('js/presentation-chat-v8.js?v=8.3.1'); } catch (e) { console.error('Presentation chat V8 failed:', e); }
    try { await acadexLoadScript('js/presentation-tools-panel-v9.js?v=9.0.0'); } catch (e) { console.error('Presentation tools panel V9 failed:', e); }

    // V10/V11 intelligence: deterministic critic -> stable agent -> V11 Director -> command surface -> rehearsal.
    try { await acadexLoadScript('js/presentation/quality/presentation-quality-v10.js?v=10.0.0'); } catch (e) { console.error('Presentation quality V10 failed:', e); }
    try { await acadexLoadScript('js/presentation/ai/acadia-presentation-agent-v10.js?v=10.0.0'); } catch (e) { console.error('Acadia presentation agent V10 failed:', e); }
    try { await acadexLoadScript('js/presentation/ai/acadia-presentation-director-v11.js?v=11.0.0'); } catch (e) { console.error('Acadia presentation director V11 failed:', e); }
    try { await acadexLoadScript('js/presentation/ai/acadia-command-bar-v10.js?v=11.0.1'); } catch (e) { console.error('Acadia command bar V11 bridge failed:', e); }
    try { await acadexLoadScript('js/presentation/rehearsal/presentation-rehearsal-v10.js?v=10.0.0'); } catch (e) { console.error('Presentation rehearsal V10 failed:', e); }
  }
});
