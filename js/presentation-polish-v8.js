/* Acadex Presentation Polish V8 — card/grid breathing + quality badge (studio fix 6/6) */
(function () {
  'use strict';
  if (window.__acadexPresentationPolishV8) return;
  window.__acadexPresentationPolishV8 = true;

  function injectStyles() {
    if (document.getElementById('acadex-pres-polish-v8-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-pres-polish-v8-style';
    style.textContent = `
      /* Card / grid breathing */
      #pres-canvas .ap7-cards {
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
        gap: .7rem !important;
        align-content: start;
      }
      #pres-canvas .ap7-cards article {
        min-height: 0;
        overflow: hidden;
        padding: .75rem .7rem !important;
        display: flex;
        flex-direction: column;
        gap: .2rem;
      }
      #pres-canvas .ap7-cards strong {
        font-size: .74rem !important;
        line-height: 1.35 !important;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      #pres-canvas .ap7-cards p {
        font-size: .64rem !important;
        line-height: 1.45 !important;
        overflow-wrap: anywhere;
        display: -webkit-box;
        -webkit-line-clamp: 5;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      #pres-canvas .ap7-steps,
      #pres-canvas .ap7-diagram {
        flex-wrap: wrap !important;
        gap: .5rem !important;
      }
      #pres-canvas .ap7-steps article,
      #pres-canvas .ap7-diagram article {
        min-width: 120px !important;
        max-width: 100%;
        flex: 1 1 140px !important;
        overflow: hidden;
      }
      #pres-canvas .ap7-steps strong,
      #pres-canvas .ap7-diagram strong {
        overflow-wrap: anywhere;
        word-break: break-word;
        font-size: .7rem !important;
        line-height: 1.35 !important;
      }
      #pres-canvas .ap7-steps p,
      #pres-canvas .ap7-diagram p {
        overflow-wrap: anywhere;
        font-size: .6rem !important;
        line-height: 1.4 !important;
      }
      #pres-canvas .ap7-steps em,
      #pres-canvas .ap7-diagram em {
        display: none; /* wrap layout: arrows cause overflow */
      }
      #pres-canvas .ap7-table-wrap {
        max-width: 100%;
        overflow: auto;
      }
      #pres-canvas .ap7-table {
        font-size: .7rem !important;
      }
      #pres-canvas .ap7-combo {
        gap: 1rem !important;
        align-items: start !important;
      }
      #pres-canvas .ap7-copy,
      #pres-canvas .ap7-visual {
        overflow: auto;
        max-width: 100%;
      }
      #pres-component-preview.ap7-direct {
        overflow: auto !important;
      }

      /* Quality badge */
      #pres-quality-badge {
        display: inline-flex;
        align-items: center;
        gap: .35rem;
        border-radius: 999px;
        padding: .28rem .65rem;
        font-size: .72rem;
        font-weight: 800;
        border: 1px solid rgba(22,50,92,.12);
        background: #fff;
        color: #16325c;
        white-space: nowrap;
        cursor: default;
        user-select: none;
      }
      #pres-quality-badge[data-grade="A"] { background: #ecfdf5; border-color: #6ee7b7; color: #065f46; }
      #pres-quality-badge[data-grade="B"] { background: #f0fdfa; border-color: #99f6e4; color: #0f766e; }
      #pres-quality-badge[data-grade="C"] { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
      #pres-quality-badge[data-grade="D"],
      #pres-quality-badge[data-grade="F"] { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
      #pres-quality-badge.is-empty { display: none; }
      #pres-quality-badge .pres-q-score { font-variant-numeric: tabular-nums; }
      #pres-quality-badge .pres-q-label { opacity: .85; font-weight: 700; font-size: .66rem; }
    `;
    document.head.appendChild(style);
  }

  function ensureBadge() {
    if (document.getElementById('pres-quality-badge')) return;
    const toolbar = document.querySelector('#pres-studio-mode .pres-toolbar')
      || document.querySelector('#pres-studio-mode .pres-footer');
    if (!toolbar) return;

    const badge = document.createElement('span');
    badge.id = 'pres-quality-badge';
    badge.className = 'is-empty';
    badge.title = 'Acadia kalite skoru (üretim sonrası)';
    badge.innerHTML = `<span class="pres-q-label">Kalite</span><span class="pres-q-score">—</span>`;

    // Prefer near title / actions
    const actions = toolbar.querySelector('.pres-toolbar-actions')
      || toolbar.querySelector('[style*="display:flex"]')
      || toolbar;
    actions.appendChild(badge);
  }

  function setQuality(quality) {
    ensureBadge();
    const badge = document.getElementById('pres-quality-badge');
    if (!badge) return;

    if (!quality || typeof quality.score !== 'number') {
      badge.classList.add('is-empty');
      badge.removeAttribute('data-grade');
      return;
    }

    const score = Math.max(0, Math.min(100, Math.round(quality.score)));
    const grade = String(quality.grade || (score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'));
    const pass = quality.pass !== false && score >= 70;
    const issues = Array.isArray(quality.issues) ? quality.issues.slice(0, 6).join(', ') : '';

    badge.classList.remove('is-empty');
    badge.dataset.grade = grade;
    badge.querySelector('.pres-q-score').textContent = `${score}/100 · ${grade}${pass ? '' : ' · düşük'}`;
    badge.title = issues
      ? `Kalite ${score}/100 (${grade})\nSorunlar: ${issues}`
      : `Kalite ${score}/100 (${grade})`;

    try {
      window.presLastQuality = quality;
      if (window.presCurrentPresentation && typeof window.presCurrentPresentation === 'object') {
        window.presCurrentPresentation.quality = quality;
      }
    } catch (_) {}
  }

  function boot() {
    injectStyles();
    ensureBadge();
    try {
      if (window.presLastQuality) setQuality(window.presLastQuality);
      else if (window.presCurrentPresentation?.quality) setQuality(window.presCurrentPresentation.quality);
    } catch (_) {}
  }

  window.AcadexPresentationPolishV8 = {
    setQuality,
    ensureBadge,
    boot,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(boot, 700);
  setTimeout(boot, 1800);
})();
