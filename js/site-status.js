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
document.addEventListener('DOMContentLoaded',async()=>{
  if(window.location.pathname.includes('login.html')) acadexApplyPortalLabel();
  const settings=await acadexGetSiteSettings(); acadexRenderBanner(settings.banner);
  if(window.location.pathname.includes('login.html')&&settings.maintenance?.enabled){const notice=acadexRenderMaintenanceNotice(settings.maintenance);const loginView=document.getElementById('login-view');if(notice&&loginView)loginView.insertBefore(notice,loginView.firstChild);}
  if(window.location.pathname.includes('dashboard.html')){
    const script=document.createElement('script'); script.src='js/presentation-renderer-v2.js?v=3'; script.defer=true; document.body.appendChild(script);
  }
});
