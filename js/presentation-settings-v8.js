/* Acadex Presentation Settings V8 — working settings modal (item 1/6) */
(function () {
  'use strict';
  if (window.__acadexPresentationSettingsV8) return;
  window.__acadexPresentationSettingsV8 = true;

  const DETAIL_LEVELS = [
    { id: 'summary', label: 'Özet', hint: 'Kısa, az madde, hızlı anlatım' },
    { id: 'bullets', label: 'Madde madde', hint: 'Dengeli akademik slayt (önerilen)' },
    { id: 'detailed', label: 'Detaylı', hint: 'Daha uzun metin ve açıklama' },
  ];

  function prefs() {
    try {
      if (!window.presPresentationPrefs || typeof window.presPresentationPrefs !== 'object') {
        window.presPresentationPrefs = { detailLevel: 'bullets' };
      }
      return window.presPresentationPrefs;
    } catch (_) {
      return { detailLevel: 'bullets' };
    }
  }

  function injectStyles() {
    if (document.getElementById('acadex-pres-settings-v8-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-pres-settings-v8-style';
    style.textContent = `
      #pres-settings-overlay.pres-builder-overlay { z-index: 10060; }
      #pres-settings-overlay .pres-builder-modal { width: min(520px, 96vw); }
      .pres-settings-grid { display: grid; gap: 0.85rem; padding: 1rem 1.1rem; }
      .pres-settings-field label { display:block; font-size:0.72rem; font-weight:800; color:#16325c; margin-bottom:0.35rem; text-transform:uppercase; letter-spacing:.03em; }
      .pres-settings-field input,
      .pres-settings-field select {
        width:100%; border:1px solid rgba(22,50,92,.12); border-radius:10px; padding:.55rem .7rem;
        font-size:.88rem; color:#16325c; background:#fff;
      }
      .pres-settings-field input:focus,
      .pres-settings-field select:focus { outline:none; border-color:#0d9488; box-shadow:0 0 0 3px rgba(13,148,136,.12); }
      .pres-settings-hint { font-size:.72rem; color:#64748b; margin-top:.35rem; line-height:1.4; }
      .pres-settings-chips { display:flex; flex-wrap:wrap; gap:.4rem; }
      .pres-settings-chip {
        border:1px solid rgba(22,50,92,.12); background:#fff; color:#16325c;
        border-radius:999px; padding:.4rem .75rem; font-size:.78rem; font-weight:700; cursor:pointer;
      }
      .pres-settings-chip.is-active { background:#0d9488; border-color:#0d9488; color:#fff; }
      .pres-settings-chip[data-theme="minimal"].is-active { background:#334155; border-color:#334155; }
      .pres-settings-chip[data-theme="corporate"].is-active { background:#1e3a5f; border-color:#1e3a5f; }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (document.getElementById('pres-settings-overlay')) return;
    injectStyles();
    const overlay = document.createElement('div');
    overlay.id = 'pres-settings-overlay';
    overlay.className = 'pres-builder-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'pres-settings-title');
    overlay.innerHTML = `
      <div class="pres-builder-modal" id="pres-settings-modal">
        <div class="pres-builder-header">
          <h3 id="pres-settings-title">Sunum Ayarları</h3>
          <button type="button" class="pres-builder-close" id="pres-settings-close" aria-label="Kapat">×</button>
        </div>
        <div class="pres-settings-grid">
          <div class="pres-settings-field">
            <label for="pres-settings-title-input">Sunum başlığı</label>
            <input type="text" id="pres-settings-title-input" maxlength="160" placeholder="Örn. Yapay Zekânın İnsan Hayatına Önemi" />
          </div>
          <div class="pres-settings-field">
            <label for="pres-settings-language">Dil</label>
            <select id="pres-settings-language">
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
          </div>
          <div class="pres-settings-field">
            <label for="pres-settings-course">Ders / etiket</label>
            <input type="text" id="pres-settings-course" maxlength="80" placeholder="Örn. Yönetim Bilişim Sistemleri" />
          </div>
          <div class="pres-settings-field">
            <label>Tema</label>
            <div class="pres-settings-chips" id="pres-settings-theme-chips">
              <button type="button" class="pres-settings-chip" data-theme="academic">Modern Academic</button>
              <button type="button" class="pres-settings-chip" data-theme="minimal">Minimal</button>
              <button type="button" class="pres-settings-chip" data-theme="corporate">Corporate</button>
            </div>
          </div>
          <div class="pres-settings-field">
            <label>İçerik yoğunluğu (Acadia)</label>
            <div class="pres-settings-chips" id="pres-settings-detail-chips">
              <button type="button" class="pres-settings-chip" data-detail="summary">Özet</button>
              <button type="button" class="pres-settings-chip" data-detail="bullets">Madde madde</button>
              <button type="button" class="pres-settings-chip" data-detail="detailed">Detaylı</button>
            </div>
            <p class="pres-settings-hint" id="pres-settings-detail-hint">Yeni AI üretimlerinde metin uzunluğunu etkiler.</p>
          </div>
        </div>
        <div class="pres-builder-footer">
          <button type="button" class="pres-btn" id="pres-settings-cancel">İptal</button>
          <button type="button" class="pres-btn pres-btn-primary" id="pres-settings-save">Kaydet</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('#pres-settings-close')?.addEventListener('click', close);
    overlay.querySelector('#pres-settings-cancel')?.addEventListener('click', close);
    overlay.querySelector('#pres-settings-save')?.addEventListener('click', save);

    overlay.querySelector('#pres-settings-theme-chips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme]');
      if (!btn) return;
      overlay.querySelectorAll('#pres-settings-theme-chips .pres-settings-chip').forEach((el) => {
        el.classList.toggle('is-active', el === btn);
      });
    });
    overlay.querySelector('#pres-settings-detail-chips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-detail]');
      if (!btn) return;
      overlay.querySelectorAll('#pres-settings-detail-chips .pres-settings-chip').forEach((el) => {
        el.classList.toggle('is-active', el === btn);
      });
      const meta = DETAIL_LEVELS.find((d) => d.id === btn.dataset.detail);
      const hint = overlay.querySelector('#pres-settings-detail-hint');
      if (hint && meta) hint.textContent = meta.hint + ' — Yeni AI üretimlerinde metin uzunluğunu etkiler.';
    });
  }

  function currentTheme() {
    try {
      return window.AcadexPresentationThemeV8?.currentThemeId?.()
        || window.presCurrentPresentation?.theme
        || 'academic';
    } catch (_) {
      return 'academic';
    }
  }

  function fill() {
    const title = document.getElementById('pres-settings-title-input');
    const language = document.getElementById('pres-settings-language');
    const course = document.getElementById('pres-settings-course');
    try {
      const p = window.presCurrentPresentation || {};
      const titleInput = document.getElementById('pres-title-input');
      if (title) title.value = titleInput?.value || p.title || '';
      if (language) language.value = p.language === 'en' ? 'en' : 'tr';
      if (course) course.value = p.course_tag || '';
    } catch (_) {}

    const themeId = currentTheme();
    document.querySelectorAll('#pres-settings-theme-chips .pres-settings-chip').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.theme === themeId);
    });

    const detail = prefs().detailLevel || 'bullets';
    document.querySelectorAll('#pres-settings-detail-chips .pres-settings-chip').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.detail === detail);
    });
    const meta = DETAIL_LEVELS.find((d) => d.id === detail);
    const hint = document.getElementById('pres-settings-detail-hint');
    if (hint && meta) hint.textContent = meta.hint + ' — Yeni AI üretimlerinde metin uzunluğunu etkiler.';
  }

  function open() {
    ensureModal();
    fill();
    const overlay = document.getElementById('pres-settings-overlay');
    if (!overlay) return;
    overlay.classList.add('is-open');
    document.getElementById('pres-settings-title-input')?.focus();
  }

  function close() {
    document.getElementById('pres-settings-overlay')?.classList.remove('is-open');
  }

  function save() {
    const title = document.getElementById('pres-settings-title-input')?.value?.trim() || 'Adsız Sunum';
    const language = document.getElementById('pres-settings-language')?.value === 'en' ? 'en' : 'tr';
    const course = document.getElementById('pres-settings-course')?.value?.trim() || '';
    const themeBtn = document.querySelector('#pres-settings-theme-chips .pres-settings-chip.is-active');
    const detailBtn = document.querySelector('#pres-settings-detail-chips .pres-settings-chip.is-active');
    const theme = themeBtn?.dataset.theme || 'academic';
    const detailLevel = detailBtn?.dataset.detail || 'bullets';

    try {
      const titleInput = document.getElementById('pres-title-input');
      if (titleInput) titleInput.value = title;

      if (window.presCurrentPresentation && typeof window.presCurrentPresentation === 'object') {
        window.presCurrentPresentation.title = title;
        window.presCurrentPresentation.language = language;
        window.presCurrentPresentation.course_tag = course || null;
        window.presCurrentPresentation.theme = theme;
      }

      prefs().detailLevel = detailLevel;
      try { sessionStorage.setItem('acadex_pres_detail_level', detailLevel); } catch (_) {}

      if (window.AcadexPresentationThemeV8?.setTheme) {
        window.AcadexPresentationThemeV8.setTheme(theme, { dirty: true });
      }

      if (typeof markPresentationDirty === 'function') markPresentationDirty();
      else {
        try { window.presIsDirty = true; } catch (_) {}
      }

      if (typeof showDashboardAlert === 'function') {
        showDashboardAlert('success', 'Sunum ayarları güncellendi.');
      }
    } catch (e) {
      console.error('Presentation settings save failed:', e);
    }
    close();
  }

  function wireButton() {
    const btn = document.getElementById('pres-settings-btn');
    if (!btn || btn.dataset.apSettingsWired) return;
    btn.dataset.apSettingsWired = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    });
  }

  // Restore detail level preference
  try {
    const saved = sessionStorage.getItem('acadex_pres_detail_level');
    if (saved && ['summary', 'bullets', 'detailed'].includes(saved)) {
      prefs().detailLevel = saved;
    }
  } catch (_) {}

  function boot() {
    wireButton();
    // Re-wire when studio becomes visible
    const studio = document.getElementById('pres-studio-mode');
    if (studio && !studio.dataset.apSettingsObs) {
      studio.dataset.apSettingsObs = '1';
      const obs = new MutationObserver(() => wireButton());
      obs.observe(studio, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
    }
  }

  window.AcadexPresentationSettingsV8 = {
    open,
    close,
    getDetailLevel: () => prefs().detailLevel || 'bullets',
    setDetailLevel: (value) => {
      if (['summary', 'bullets', 'detailed'].includes(value)) {
        prefs().detailLevel = value;
        try { sessionStorage.setItem('acadex_pres_detail_level', value); } catch (_) {}
      }
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  // late bind if dashboard mounts later
  setTimeout(boot, 800);
  setTimeout(boot, 2000);
})();
