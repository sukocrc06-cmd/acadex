/* Acadex Presentation Theme Engine V8 — Premium themes + design_variant compositions (no API) */
(function () {
  'use strict';
  if (window.__acadexPresentationThemeV8) return;
  window.__acadexPresentationThemeV8 = true;

  const THEMES = {
    academic: {
      id: 'academic',
      label: 'Modern Academic',
      accent: '#0d9488',
      accentDeep: '#0f766e',
      navy: '#16325c',
      text: '#24364b',
      muted: '#64748b',
      surface: '#ffffff',
      soft: '#f0fdfa',
      border: '#ccfbf1',
      canvasBg: '#f1f5f9',
      heroGrad: 'linear-gradient(145deg,#0f766e 0%,#16325c 100%)',
      pptx: { accent: '0D9488', navy: '16325C', text: '24364B', soft: 'F0FDFA', border: '99F6E4' }
    },
    minimal: {
      id: 'minimal',
      label: 'Minimal',
      accent: '#334155',
      accentDeep: '#0f172a',
      navy: '#0f172a',
      text: '#1e293b',
      muted: '#64748b',
      surface: '#ffffff',
      soft: '#f8fafc',
      border: '#e2e8f0',
      canvasBg: '#f8fafc',
      heroGrad: 'linear-gradient(145deg,#1e293b 0%,#0f172a 100%)',
      pptx: { accent: '334155', navy: '0F172A', text: '1E293B', soft: 'F8FAFC', border: 'E2E8F0' }
    },
    corporate: {
      id: 'corporate',
      label: 'Corporate',
      accent: '#b45309',
      accentDeep: '#92400e',
      navy: '#1e3a5f',
      text: '#1e293b',
      muted: '#64748b',
      surface: '#ffffff',
      soft: '#fffbeb',
      border: '#fde68a',
      canvasBg: '#f8fafc',
      heroGrad: 'linear-gradient(145deg,#1e3a5f 0%,#0f2744 100%)',
      pptx: { accent: 'B45309', navy: '1E3A5F', text: '1E293B', soft: 'FFFBEB', border: 'FDE68A' }
    }
  };

  function normalizeThemeId(value) {
    const raw = String(value || 'academic').toLowerCase().trim();
    if (raw === 'modern' || raw === 'modern-academic' || raw === 'modern_academic') return 'academic';
    if (THEMES[raw]) return raw;
    return 'academic';
  }

  function currentThemeId() {
    try {
      return normalizeThemeId(presCurrentPresentation?.theme || 'academic');
    } catch (_) {
      return 'academic';
    }
  }

  function currentTheme() {
    return THEMES[currentThemeId()] || THEMES.academic;
  }

  function injectStyles() {
    if (document.getElementById('acadex-presentation-theme-v8-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-presentation-theme-v8-style';
    style.textContent = `
      /* Theme variables on studio canvas */
      #pres-canvas.ap-theme {
        --ap-accent: #0d9488;
        --ap-accent-deep: #0f766e;
        --ap-navy: #16325c;
        --ap-text: #24364b;
        --ap-muted: #64748b;
        --ap-surface: #ffffff;
        --ap-soft: #f0fdfa;
        --ap-border: #ccfbf1;
        transition: box-shadow .2s ease, border-color .2s ease;
      }
      #pres-studio-mode.ap-theme-root .pres-canvas-wrap {
        background: var(--ap-canvas-bg, #f1f5f9) !important;
      }

      /* design_variant compositions */
      #pres-canvas.ap-theme[data-variant="hero"] {
        background: var(--ap-hero-grad) !important;
        color: #fff !important;
        border: none !important;
        box-shadow: 0 18px 40px rgba(15,23,42,.18) !important;
      }
      #pres-canvas.ap-theme[data-variant="hero"] .pres-slide-title,
      #pres-canvas.ap-theme[data-variant="hero"] .pres-slide-title::placeholder {
        color: #fff !important;
        border-bottom-color: rgba(255,255,255,.35) !important;
      }
      #pres-canvas.ap-theme[data-variant="hero"] .pres-slide-content,
      #pres-canvas.ap-theme[data-variant="hero"] .pres-slide-content::placeholder,
      #pres-canvas.ap-theme[data-variant="hero"] .pres-speaker-notes label,
      #pres-canvas.ap-theme[data-variant="hero"] .pres-speaker-notes textarea {
        color: rgba(255,255,255,.92) !important;
      }
      #pres-canvas.ap-theme[data-variant="hero"] .pres-speaker-notes {
        border-top-color: rgba(255,255,255,.25) !important;
      }
      #pres-canvas.ap-theme[data-variant="hero"] .pres-speaker-notes textarea {
        background: rgba(255,255,255,.12) !important;
        border-color: rgba(255,255,255,.2) !important;
      }
      #pres-canvas.ap-theme[data-variant="hero"] .ap7-bullets,
      #pres-canvas.ap-theme[data-variant="hero"] .ap7-bullets p { color: rgba(255,255,255,.95) !important; }
      #pres-canvas.ap-theme[data-variant="hero"] .ap7-bullets span { color: #99f6e4 !important; }

      #pres-canvas.ap-theme[data-variant="section"] {
        border-left: 5px solid var(--ap-accent) !important;
        background: var(--ap-surface) !important;
      }
      #pres-canvas.ap-theme[data-variant="summary"] {
        background:
          linear-gradient(180deg, var(--ap-soft) 0%, var(--ap-surface) 48%) !important;
        border: 1px solid var(--ap-border) !important;
        box-shadow: 0 12px 28px rgba(15,23,42,.08) !important;
      }
      #pres-canvas.ap-theme[data-variant="summary"]::before {
        content: "ÖZET / KARAR";
        display: inline-block;
        font-size: .65rem;
        font-weight: 800;
        letter-spacing: .08em;
        color: var(--ap-accent-deep);
        background: var(--ap-soft);
        border: 1px solid var(--ap-border);
        border-radius: 999px;
        padding: .2rem .55rem;
        margin-bottom: .55rem;
      }
      #pres-canvas.ap-theme[data-variant="comparison"] {
        background: var(--ap-surface) !important;
        box-shadow: inset 0 0 0 1px var(--ap-border) !important;
      }
      #pres-canvas.ap-theme[data-variant="cards"],
      #pres-canvas.ap-theme[data-variant="process"],
      #pres-canvas.ap-theme[data-variant="timeline"] {
        background: linear-gradient(160deg, var(--ap-surface), var(--ap-soft)) !important;
      }
      #pres-canvas.ap-theme[data-variant="big-number"] {
        background: radial-gradient(circle at top right, var(--ap-soft), var(--ap-surface) 55%) !important;
        border: 1px solid var(--ap-border) !important;
      }
      #pres-canvas.ap-theme[data-variant="data"] {
        border-top: 4px solid var(--ap-accent) !important;
      }

      /* Retheme existing ap7 components under active theme */
      #pres-canvas.ap-theme .ap7-bullets { color: var(--ap-text) !important; }
      #pres-canvas.ap-theme .ap7-bullets span { color: var(--ap-accent) !important; }
      #pres-canvas.ap-theme .ap7-cols > div {
        background: var(--ap-soft) !important;
        border-color: var(--ap-border) !important;
      }
      #pres-canvas.ap-theme .ap7-cols span { color: var(--ap-accent) !important; }
      #pres-canvas.ap-theme .ap7-table th {
        background: var(--ap-soft) !important;
        color: var(--ap-accent-deep) !important;
      }
      #pres-canvas.ap-theme .ap7-bar b {
        background: linear-gradient(90deg, var(--ap-accent-deep), var(--ap-accent)) !important;
      }
      #pres-canvas.ap-theme .ap7-cards article {
        border-color: var(--ap-border) !important;
        background: linear-gradient(145deg, #fff, var(--ap-soft)) !important;
      }
      #pres-canvas.ap-theme .ap7-cards small {
        background: var(--ap-soft) !important;
        color: var(--ap-accent-deep) !important;
      }
      #pres-canvas.ap-theme .ap7-cards strong,
      #pres-canvas.ap-theme .ap7-steps strong,
      #pres-canvas.ap-theme .ap7-diagram strong { color: var(--ap-navy) !important; }
      #pres-canvas.ap-theme .ap7-steps article,
      #pres-canvas.ap-theme .ap7-diagram article {
        border-color: var(--ap-border) !important;
        background: var(--ap-soft) !important;
      }
      #pres-canvas.ap-theme .ap7-steps article span,
      #pres-canvas.ap-theme .ap7-diagram article span {
        background: var(--ap-accent-deep) !important;
      }
      #pres-canvas.ap-theme .ap7-metric {
        border-color: var(--ap-border) !important;
        background: radial-gradient(circle at top right, var(--ap-soft), transparent 42%), linear-gradient(145deg, #f8fafc, #fff) !important;
      }
      #pres-canvas.ap-theme .ap7-metric b { color: var(--ap-accent-deep) !important; }
      #pres-canvas.ap-theme .ap7-metric strong { color: var(--ap-navy) !important; }

      /* Theme picker UI */
      .ap-theme-picker {
        display: flex; flex-wrap: wrap; gap: .4rem; align-items: center;
      }
      .ap-theme-picker-label {
        font-size: .72rem; font-weight: 800; color: var(--color-navy, #16325c);
        text-transform: uppercase; letter-spacing: .04em; margin-right: .25rem;
      }
      .ap-theme-btn {
        border: 1px solid rgba(22,50,92,.12); background: #fff; color: #16325c;
        border-radius: 999px; padding: .32rem .7rem; font-size: .72rem; font-weight: 700;
        cursor: pointer; transition: all .15s;
      }
      .ap-theme-btn:hover { border-color: #0d9488; color: #0d9488; }
      .ap-theme-btn.is-active {
        background: #0d9488; border-color: #0d9488; color: #fff;
      }
      .ap-theme-btn[data-theme="minimal"].is-active { background: #334155; border-color: #334155; }
      .ap-theme-btn[data-theme="corporate"].is-active { background: #1e3a5f; border-color: #1e3a5f; }
    `;
    document.head.appendChild(style);
  }

  function applyThemeVars(root, theme) {
    if (!root) return;
    root.style.setProperty('--ap-accent', theme.accent);
    root.style.setProperty('--ap-accent-deep', theme.accentDeep);
    root.style.setProperty('--ap-navy', theme.navy);
    root.style.setProperty('--ap-text', theme.text);
    root.style.setProperty('--ap-muted', theme.muted);
    root.style.setProperty('--ap-surface', theme.surface);
    root.style.setProperty('--ap-soft', theme.soft);
    root.style.setProperty('--ap-border', theme.border);
    root.style.setProperty('--ap-canvas-bg', theme.canvasBg);
    root.style.setProperty('--ap-hero-grad', theme.heroGrad);
  }

  function slideVariant(slide) {
    const c = slide?.content && typeof slide.content === 'object' ? slide.content : {};
    let variant = String(c.design_variant || c.visual_purpose || '').toLowerCase();
    const allowed = new Set(['hero', 'section', 'cards', 'process', 'timeline', 'big-number', 'comparison', 'data', 'summary']);
    if (!allowed.has(variant)) {
      if (String(slide?.layout_type || '') === 'table') variant = 'comparison';
      else if (String(slide?.layout_type || '') === 'chart') variant = 'data';
      else variant = 'section';
    }
    return variant;
  }

  function applyToCanvas(slide) {
    injectStyles();
    const canvas = document.getElementById('pres-canvas');
    const studio = document.getElementById('pres-studio-mode');
    const theme = currentTheme();
    if (studio) {
      studio.classList.add('ap-theme-root');
      applyThemeVars(studio, theme);
    }
    if (!canvas) return;
    canvas.classList.add('ap-theme');
    applyThemeVars(canvas, theme);
    canvas.dataset.theme = theme.id;
    canvas.dataset.variant = slideVariant(slide || {});
  }

  function setTheme(themeId, { dirty = true } = {}) {
    const id = normalizeThemeId(themeId);
    try {
      if (typeof presCurrentPresentation === 'object' && presCurrentPresentation) {
        presCurrentPresentation.theme = id;
      }
      if (dirty && typeof markPresentationDirty === 'function') markPresentationDirty();
      else if (dirty) {
        try { presIsDirty = true; } catch (_) {}
      }
    } catch (_) {}
    syncPicker();
    try {
      if (typeof renderActivePresentationSlide === 'function') renderActivePresentationSlide();
      else applyToCanvas(typeof presSlides !== 'undefined' ? presSlides[presActiveSlide] : null);
    } catch (_) {
      applyToCanvas(null);
    }
  }

  function ensurePicker() {
    if (document.getElementById('ap-theme-picker')) return;
    const footer = document.querySelector('#pres-studio-mode .pres-footer');
    if (!footer) return;
    const wrap = document.createElement('div');
    wrap.id = 'ap-theme-picker';
    wrap.className = 'ap-theme-picker';
    wrap.innerHTML = `
      <span class="ap-theme-picker-label">Tema</span>
      <button type="button" class="ap-theme-btn" data-theme="academic">Modern Academic</button>
      <button type="button" class="ap-theme-btn" data-theme="minimal">Minimal</button>
      <button type="button" class="ap-theme-btn" data-theme="corporate">Corporate</button>
    `;
    // insert after settings button if present
    const settings = document.getElementById('pres-settings-btn');
    if (settings && settings.parentElement === footer) {
      settings.insertAdjacentElement('afterend', wrap);
    } else {
      footer.insertBefore(wrap, footer.firstChild);
    }
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.ap-theme-btn');
      if (!btn) return;
      setTheme(btn.dataset.theme);
    });
    syncPicker();
  }

  function syncPicker() {
    const id = currentThemeId();
    document.querySelectorAll('.ap-theme-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.theme === id);
    });
  }

  // Hook renderActivePresentationSlide without editing dashboard.js heavily
  function hookRenderer() {
    if (window.__apThemeHooked) return;
    const tryHook = () => {
      if (typeof window.renderActivePresentationSlide !== 'function') return false;
      if (window.renderActivePresentationSlide.__apThemeWrapped) return true;
      const original = window.renderActivePresentationSlide;
      window.renderActivePresentationSlide = function wrappedRenderActivePresentationSlide() {
        const result = original.apply(this, arguments);
        try {
          ensurePicker();
          const slide = (typeof presSlides !== 'undefined' && Array.isArray(presSlides))
            ? presSlides[presActiveSlide]
            : null;
          applyToCanvas(slide);
          syncPicker();
        } catch (e) {
          console.warn('Theme engine apply failed:', e);
        }
        return result;
      };
      window.renderActivePresentationSlide.__apThemeWrapped = true;
      window.__apThemeHooked = true;
      return true;
    };
    if (!tryHook()) {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (tryHook() || attempts > 40) clearInterval(timer);
      }, 250);
    }
  }

  // Export helper for PPTX/PDF color palette
  function exportPalette() {
    return currentTheme().pptx;
  }

  window.AcadexPresentationThemeV8 = {
    THEMES,
    normalizeThemeId,
    currentThemeId,
    currentTheme,
    setTheme,
    applyToCanvas,
    exportPalette,
    slideVariant,
    ensurePicker
  };

  injectStyles();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      hookRenderer();
      ensurePicker();
    });
  } else {
    hookRenderer();
    ensurePicker();
  }
})();
