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
    const s=document.createElement('script'); s.src=src; s.async=false; s.onload=resolve; s.onerror=reject; document.body.appendChild(s);
  });
}
document.addEventListener('DOMContentLoaded',async()=>{
  if(window.location.pathname.includes('login.html')) acadexApplyPortalLabel();
  const settings=await acadexGetSiteSettings(); acadexRenderBanner(settings.banner);
  if(window.location.pathname.includes('login.html')&&settings.maintenance?.enabled){const notice=acadexRenderMaintenanceNotice(settings.maintenance);const loginView=document.getElementById('login-view');if(notice&&loginView)loginView.insertBefore(notice,loginView.firstChild);}
  /* SUNUM MODULLERININ YUKLENMESI DURDURULDU — 06.10.2026.
     ========================================================================
     Burada 13 betik, HER dashboard acilisinda, sirayla yukleniyordu:
     model-v7, renderer-v7, studio-v73, controls-v7, modal-scroll-v7,
     export-v8, theme-v8, settings-v8, dedupe-v8, visual-ai-v8,
     visual-ux-v8, polish-v8, hd-v9. Toplam 161 KB, ve vercel.json
     /js/* icin "no-cache, must-revalidate" diyor — yani her acilista
     yeniden dogrulanan 13 ayri istek.

     Hepsi dashboard.html'deki #presentation-view gorunumunu zenginlestirmek
     icin yazilmis. O GORUNUME GIDILEMIYOR:
       - kenar cubugunda 13 gorunum var, 'presentation' onlardan biri degil
       - derin baglanti yalnizca ?course= ve ?examCourse= (baska bolumlere)
       - ACADIA_VALID_TABS ve deepLinkTabWhitelist icinde de yok
     Ustelik zenginlestirecekleri sey de yok: sardiklari
     renderActivePresentationSlide fonksiyonu repoda HICBIR YERDE tanimli
     degil, yalnizca sarmalayicilari var. theme ve dedupe onu 250 ms arayla
     40 kez ariyor ve ~10 saniye sonra vazgeciyor. loadPresentationStudio
     (dashboard.js:6101) iki div'i gosterip gizlemekten ibaret; kaydet/AI/
     disa aktar dugmelerinde dinleyici yok ve kodun kendi yorumu "Step 4
     will create a real DB row" diyor — o adim hic gelmemis.

     Sunumun CALISAN hali bambaska bir yerde: acadex-sunum.html iframe'i
     (Acadex Sunum sekmesi), kendi icinde, bu 13 modulun hicbirini
     yuklemeden.

     DOSYALAR SILINMEDI, yalnizca yuklenmiyorlar. Kazancin tamami bu
     satirlardan geliyor; dosyalari tutmak hem baska bir gelistiricinin
     emegini korur hem de geri almayi tek satirlik is yapar.

     Kaldirmadan once dogrulandi (bkz. tests/presentation-loader.js):
       - hd-v9'un switchDashboardView sarmalayicisi SAF GECIS: origSwitch
         kosulsuz ve ilk calisiyor, sunum dali yalnizca arkadan setTimeout
         ekliyor; diger 12 gorunum icin davranis birebir ayni
       - 13 modulun tanimladigi globallerin hicbirini sunum disi kod
         cagirmiyor
       - enjekte ettikleri CSS'in tamami sunum seçicileri kapsaminda
         (#pres- , .pres- , .ap7- , .phd- onekleri); body, :root veya
         genel bir seciciye dokunan yok

     GORUNUM ERISILEBILIR HALE GELIRSE bu satirlar geri gelmeli — testi o
     durumu yakalayip soyluyor.
     ======================================================================== */
});
