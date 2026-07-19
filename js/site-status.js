/* ==========================================================================
   ACADEX SITE STATUS (js/site-status.js)
   Shared, page-agnostic helper for the two admin-editable site_settings
   rows (maintenance_mode, site_banner). Include this script on any page
   that should react to them:
     - index.html / login.html: shows the dismissible top banner and (on
       login.html) blocks non-admin sign-in when maintenance mode is on.
     - dashboard.html: shows the banner so logged-in students see it too.

   Everything fails open: if site_settings can't be reached (table missing,
   network error, RLS not yet migrated), the site behaves exactly as before
   this file existed — no banner, no blocking.
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

  // Don't re-show a banner the visitor already dismissed this session,
  // unless the admin changed the message text.
  if (sessionStorage.getItem(ACADEX_BANNER_DISMISS_KEY) === banner.message) return;

  const bar = document.createElement('div');
  bar.id = 'acadex-site-banner';
  bar.style.cssText = `
    position: relative; width: 100%; background: var(--color-teal, #0D9488);
    color: #fff; font-size: 0.85rem; font-weight: 600; text-align: center;
    padding: 0.6rem 2.5rem; z-index: 10000; box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  `;
  bar.innerHTML = `
    <span>${banner.message.replace(/</g, '&lt;')}</span>
    <button aria-label="Kapat" style="position:absolute; right:0.75rem; top:50%; transform:translateY(-50%); background:none; border:none; color:#fff; font-size:1.1rem; cursor:pointer; line-height:1;">×</button>
  `;
  bar.querySelector('button').addEventListener('click', () => {
    sessionStorage.setItem(ACADEX_BANNER_DISMISS_KEY, banner.message);
    bar.remove();
  });
  document.body.insertBefore(bar, document.body.firstChild);
}

function acadexRenderMaintenanceNotice(maintenance) {
  if (!maintenance || !maintenance.enabled) return null;

  const notice = document.createElement('div');
  notice.id = 'acadex-maintenance-notice';
  notice.className = 'alert alert-error';
  notice.style.cssText = 'max-width: 480px; margin: 0 auto 1.5rem; text-align: left;';
  notice.textContent = maintenance.message || 'Acadex şu anda bakımda. Lütfen daha sonra tekrar deneyin.';
  return notice;
}
window.acadexRenderMaintenanceNotice = acadexRenderMaintenanceNotice;

// ==========================================
// login.html: adjust heading/subtitle when arriving via a labeled portal
// link (?portal=teacher / ?portal=admin). Purely cosmetic — the actual
// login form and post-login redirect are unchanged, so this can never
// grant access beyond what the account's real profile flags allow.
// ==========================================
function acadexApplyPortalLabel() {
  const params = new URLSearchParams(window.location.search);
  const portal = params.get('portal');
  if (!portal) return;

  const titleEl = document.querySelector('#login-view .auth-title');
  const subtitleEl = document.querySelector('#login-view .auth-subtitle');

  const copy = {
    teacher: {
      title: 'Hoca Girişi',
      subtitle: 'Akademik panelinize erişmek için giriş yapın'
    },
    admin: {
      title: 'Yönetim Girişi',
      subtitle: 'Admin panelinize erişmek için giriş yapın'
    }
  }[portal];

  if (!copy) return;

  if (titleEl) {
    titleEl.removeAttribute('data-i18n');
    titleEl.textContent = copy.title;
  }
  if (subtitleEl) {
    subtitleEl.removeAttribute('data-i18n');
    subtitleEl.textContent = copy.subtitle;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.pathname.includes('login.html')) {
    acadexApplyPortalLabel();
  }

  const settings = await acadexGetSiteSettings();
  acadexRenderBanner(settings.banner);

  // On the login page, also surface a maintenance notice above the form
  // (actual sign-in blocking for non-admins happens in js/auth.js).
  if (window.location.pathname.includes('login.html') && settings.maintenance?.enabled) {
    const notice = acadexRenderMaintenanceNotice(settings.maintenance);
    const loginView = document.getElementById('login-view');
    if (notice && loginView) loginView.insertBefore(notice, loginView.firstChild);
  }
});
