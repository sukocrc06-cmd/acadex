/* Acadex Presentation Visual UX V8 — clear upload + AI actions (studio fix 5/6) */
(function () {
  'use strict';
  if (window.__acadexPresentationVisualUxV8) return;
  window.__acadexPresentationVisualUxV8 = true;

  function injectStyles() {
    if (document.getElementById('acadex-pres-visual-ux-v8-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-pres-visual-ux-v8-style';
    style.textContent = `
      .pres-visual-hub {
        display: grid; gap: .55rem;
      }
      .pres-visual-hub-title {
        font-size: .78rem; font-weight: 800; color: var(--color-navy, #16325c);
        margin: 0;
      }
      .pres-visual-hub-sub {
        font-size: .68rem; color: #64748b; line-height: 1.45; margin: 0;
      }
      .pres-visual-hub-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: .4rem;
      }
      .pres-visual-hub-grid .pres-btn {
        justify-content: center; width: 100%; font-size: .72rem; padding: .48rem .4rem;
        min-height: 40px;
      }
      .pres-visual-hub-grid .pres-btn.is-ai {
        background: linear-gradient(135deg, rgba(13,148,136,.12), rgba(22,50,92,.06));
        border-color: rgba(13,148,136,.35); color: #0f766e; font-weight: 800;
      }
      .pres-visual-hub-grid .pres-btn.is-ai:hover {
        background: linear-gradient(135deg, rgba(13,148,136,.18), rgba(22,50,92,.08));
      }
      #pres-upload-zone.pres-upload-zone {
        padding: .75rem .6rem !important;
      }
      #pres-upload-zone .pres-upload-main {
        font-size: .76rem; font-weight: 700; color: #16325c; margin: .15rem 0 0;
      }
      #pres-upload-zone .pres-upload-sub {
        font-size: .66rem; color: #64748b; margin: .15rem 0 0;
      }
      .pres-component-empty {
        gap: .55rem !important; padding: .85rem .7rem !important;
      }
      .pres-empty-cta-row {
        display: flex; flex-wrap: wrap; gap: .35rem; justify-content: center; margin-top: .25rem;
      }
      .pres-empty-cta-row .pres-btn {
        font-size: .7rem; padding: .35rem .55rem; border-radius: 999px;
      }
      .pres-empty-cta-row .pres-btn.is-ai {
        background: #0d9488; border-color: #0d9488; color: #fff; font-weight: 800;
      }
      .pres-empty-cta-row .pres-btn.is-ai:hover { filter: brightness(1.05); }
    `;
    document.head.appendChild(style);
  }

  function enhanceUploadCard() {
    const zone = document.getElementById('pres-upload-zone');
    const card = zone?.closest('.pres-tool-card');
    if (!zone || !card || card.dataset.visualHub === '1') return;
    card.dataset.visualHub = '1';

    // Rewrite heading area
    const h4 = card.querySelector('h4');
    if (h4) h4.textContent = 'Görsel ekle';

    // Clearer upload zone copy
    const p = zone.querySelector('p');
    if (p) {
      p.className = 'pres-upload-main';
      p.textContent = 'Görsel yükle';
    }
    if (!zone.querySelector('.pres-upload-sub')) {
      const sub = document.createElement('p');
      sub.className = 'pres-upload-sub';
      sub.textContent = 'JPG, PNG, WebP • sürükle-bırak veya seç';
      zone.appendChild(sub);
    }

    // Hub actions above upload zone
    if (!document.getElementById('pres-visual-hub')) {
      const hub = document.createElement('div');
      hub.id = 'pres-visual-hub';
      hub.className = 'pres-visual-hub';
      hub.innerHTML = `
        <p class="pres-visual-hub-sub">Slayt metninden otomatik üret veya kendi görselini yükle.</p>
        <div class="pres-visual-hub-grid">
          <button type="button" class="pres-btn is-ai" id="pres-ux-ai-table">📊 AI Tablo</button>
          <button type="button" class="pres-btn is-ai" id="pres-ux-ai-chart">📈 AI Grafik</button>
          <button type="button" class="pres-btn" id="pres-ux-manual-table">Tablo aracı</button>
          <button type="button" class="pres-btn" id="pres-ux-manual-chart">Grafik aracı</button>
        </div>
      `;
      zone.parentElement?.insertBefore(hub, zone);

      document.getElementById('pres-ux-ai-table')?.addEventListener('click', () => {
        if (window.AcadexPresentationVisualAiV8?.generateFromSlide) {
          window.AcadexPresentationVisualAiV8.generateFromSlide('table');
        } else {
          document.getElementById('pres-ai-make-table-btn')?.click();
        }
      });
      document.getElementById('pres-ux-ai-chart')?.addEventListener('click', () => {
        if (window.AcadexPresentationVisualAiV8?.generateFromSlide) {
          window.AcadexPresentationVisualAiV8.generateFromSlide('chart');
        } else {
          document.getElementById('pres-ai-make-chart-btn')?.click();
        }
      });
      document.getElementById('pres-ux-manual-table')?.addEventListener('click', () => {
        document.getElementById('pres-insert-table-btn')?.click();
      });
      document.getElementById('pres-ux-manual-chart')?.addEventListener('click', () => {
        document.getElementById('pres-insert-chart-btn')?.click();
      });
    }

    // Hide duplicate visual-ai buttons if hub exists (avoid double UI)
    const dup = document.getElementById('pres-visual-ai-actions');
    if (dup) dup.style.display = 'none';
  }

  function enhanceEmptyPlaceholder() {
    const empty = document.getElementById('pres-component-empty');
    if (!empty || empty.dataset.cta === '1') return;
    empty.dataset.cta = '1';

    if (!empty.querySelector('.pres-empty-cta-row')) {
      const row = document.createElement('div');
      row.className = 'pres-empty-cta-row';
      row.innerHTML = `
        <button type="button" class="pres-btn is-ai" data-empty-cta="ai-table">AI Tablo</button>
        <button type="button" class="pres-btn is-ai" data-empty-cta="ai-chart">AI Grafik</button>
        <button type="button" class="pres-btn" data-empty-cta="upload">Görsel yükle</button>
      `;
      empty.appendChild(row);
      row.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-empty-cta]');
        if (!btn) return;
        const act = btn.getAttribute('data-empty-cta');
        if (act === 'ai-table') {
          window.AcadexPresentationVisualAiV8?.generateFromSlide?.('table')
            || document.getElementById('pres-ai-make-table-btn')?.click()
            || document.getElementById('pres-ux-ai-table')?.click();
        } else if (act === 'ai-chart') {
          window.AcadexPresentationVisualAiV8?.generateFromSlide?.('chart')
            || document.getElementById('pres-ai-make-chart-btn')?.click()
            || document.getElementById('pres-ux-ai-chart')?.click();
        } else if (act === 'upload') {
          document.getElementById('pres-image-input')?.click()
            || document.getElementById('pres-upload-btn')?.click()
            || document.getElementById('pres-upload-zone')?.click();
        }
      });
    }

    // Richer default hint
    const hint = document.getElementById('pres-layout-placeholder-hint');
    if (hint && /Sağ panelden/.test(hint.textContent || '')) {
      hint.textContent = 'AI ile tablo/grafik üret veya görsel yükle.';
    }
  }

  function boot() {
    injectStyles();
    enhanceUploadCard();
    enhanceEmptyPlaceholder();
  }

  window.AcadexPresentationVisualUxV8 = { boot };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(boot, 700);
  setTimeout(boot, 1800);
})();
