/* Acadex Presentation Tools Panel V9 — redesigned right rail, keeps legacy IDs */
(function () {
  'use strict';
  if (window.__acadexPresentationToolsPanelV9) return;
  window.__acadexPresentationToolsPanelV9 = true;

  function injectStyles() {
    if (document.getElementById('acadex-pres-tools-v9-style')) return;
    const s = document.createElement('style');
    s.id = 'acadex-pres-tools-v9-style';
    s.textContent = `
      .pres-panel-right .pres-right-body.pres-v9 {
        display: flex; flex-direction: column; gap: .65rem; padding: .65rem .7rem 1rem;
      }
      .pres-v9 .v9-card {
        background: #fff; border: 1px solid rgba(22,50,92,.08); border-radius: 14px;
        padding: .7rem .75rem; box-shadow: 0 1px 2px rgba(15,23,42,.03);
      }
      .pres-v9 .v9-card h4 {
        margin: 0 0 .55rem; font-size: .72rem; font-weight: 800; letter-spacing: .04em;
        text-transform: uppercase; color: #64748b;
      }
      .pres-v9 .v9-row { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem; }
      .pres-v9 .v9-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .35rem; }
      .pres-v9 .pres-layout-btn, .pres-v9 .v9-btn {
        border: 1px solid rgba(22,50,92,.1); background: #f8fafc; color: #16325c;
        border-radius: 10px; padding: .48rem .4rem; font-size: .72rem; font-weight: 700;
        cursor: pointer; text-align: center; transition: .15s ease;
      }
      .pres-v9 .pres-layout-btn:hover, .pres-v9 .v9-btn:hover {
        border-color: #0d9488; color: #0f766e; background: #f0fdfa;
      }
      .pres-v9 .pres-layout-btn.active, .pres-v9 .v9-btn.is-active {
        background: #0d9488; border-color: #0d9488; color: #fff;
      }
      .pres-v9 .v9-btn.is-ai {
        background: linear-gradient(135deg, rgba(13,148,136,.14), rgba(22,50,92,.06));
        border-color: rgba(13,148,136,.35); color: #0f766e;
      }
      .pres-v9 .v9-hint {
        margin: .35rem 0 0; font-size: .66rem; color: #64748b; line-height: 1.4;
      }
      .pres-v9 #pres-upload-zone {
        border: 1.5px dashed rgba(22,50,92,.16); border-radius: 12px;
        padding: .75rem .5rem; text-align: center; cursor: pointer; background: #fafbfc;
      }
      .pres-v9 #pres-upload-zone:hover { border-color: #0d9488; background: #f0fdfa; }
      .pres-v9 .pres-acadia-box {
        border: none !important; background: transparent !important; min-height: 0 !important;
      }
      .pres-v9 .pres-acadia-messages {
        max-height: 110px; background: #f8fafc; border-radius: 10px; border: 1px solid rgba(22,50,92,.06);
      }
      .pres-v9 .v9-section-title {
        display: flex; align-items: center; justify-content: space-between; gap: .5rem;
      }
      .pres-v9 .v9-pill {
        font-size: .62rem; font-weight: 800; color: #0f766e; background: #f0fdfa;
        border-radius: 999px; padding: .15rem .45rem;
      }
      /* Cleaner canvas table */
      #pres-canvas .ap7-table-wrap {
        border-radius: 12px; overflow: hidden; border: 1px solid rgba(22,50,92,.1);
        box-shadow: 0 4px 14px rgba(15,23,42,.06);
      }
      #pres-canvas .ap7-table {
        width: 100%; border-collapse: collapse; font-size: .78rem !important;
      }
      #pres-canvas .ap7-table th {
        background: rgba(13,148,136,.12); color: #0f766e; font-weight: 800;
        padding: .55rem .6rem; text-align: left; border-bottom: 1px solid rgba(22,50,92,.08);
      }
      #pres-canvas .ap7-table td {
        padding: .5rem .6rem; border-bottom: 1px solid rgba(22,50,92,.06);
        color: #24364b; vertical-align: top;
      }
      #pres-canvas .ap7-table tr:last-child td { border-bottom: none; }
      #pres-canvas[data-variant="hero"] .ap7-table th { background: rgba(255,255,255,.16); color: #fff; }
      #pres-canvas[data-variant="hero"] .ap7-table td { color: rgba(255,255,255,.92); border-color: rgba(255,255,255,.12); }
    `;
    document.head.appendChild(s);
  }

  function rebuildPanel() {
    const body = document.querySelector('#pres-studio-mode .pres-right-body');
    if (!body || body.dataset.v9 === '1') return;
    body.dataset.v9 = '1';
    body.classList.add('pres-v9');

    // Preserve nodes we must keep for event listeners already bound
    const keepIds = [
      'pres-layout-grid', 'pres-upload-zone', 'pres-image-input', 'pres-upload-btn', 'pres-upload-status',
      'pres-insert-table-btn', 'pres-insert-chart-btn',
      'pres-acadia-messages', 'pres-acadia-input', 'pres-acadia-send'
    ];
    const saved = {};
    keepIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) saved[id] = el;
    });
    const layoutGrid = saved['pres-layout-grid'];
    const chips = Array.from(document.querySelectorAll('[data-pres-acadia-prompt]'));

    body.innerHTML = '';

    // 1 Layout
    const cardLayout = document.createElement('div');
    cardLayout.className = 'v9-card';
    cardLayout.innerHTML = `<div class="v9-section-title"><h4 style="margin:0">Düzen</h4><span class="v9-pill">Slayt</span></div>`;
    if (layoutGrid) {
      layoutGrid.className = 'pres-layout-grid v9-row';
      // ensure buttons look v9
      layoutGrid.querySelectorAll('.pres-layout-btn').forEach((b) => {
        b.style.width = '100%';
      });
      cardLayout.appendChild(layoutGrid);
    } else {
      const grid = document.createElement('div');
      grid.id = 'pres-layout-grid';
      grid.className = 'pres-layout-grid v9-row';
      [
        ['title-content', 'Başlık + İçerik'],
        ['two-column', 'İki Sütun'],
        ['image-left', 'Görsel Sol'],
        ['image-right', 'Görsel Sağ'],
        ['chart', 'Grafik'],
        ['table', 'Tablo'],
      ].forEach(([id, label], i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pres-layout-btn' + (i === 0 ? ' active' : '');
        btn.dataset.layout = id;
        btn.textContent = label;
        grid.appendChild(btn);
      });
      cardLayout.appendChild(grid);
    }
    body.appendChild(cardLayout);

    // 2 Style transform (new)
    const cardStyle = document.createElement('div');
    cardStyle.className = 'v9-card';
    cardStyle.innerHTML = `
      <h4>İçerik stili (aktif slayt)</h4>
      <div class="v9-row">
        <button type="button" class="v9-btn" data-v9-style="bullets">Madde madde</button>
        <button type="button" class="v9-btn" data-v9-style="paragraph">Paragraf</button>
        <button type="button" class="v9-btn" data-v9-style="short">Kısalt</button>
        <button type="button" class="v9-btn" data-v9-style="expand">Detaylandır</button>
      </div>
      <p class="v9-hint">Metni bozmadan stili değiştirir · AI Asistan ile de söyleyebilirsin</p>
    `;
    body.appendChild(cardStyle);
    cardStyle.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-v9-style]');
      if (!btn) return;
      applyStyle(btn.dataset.v9Style);
    });

    // 3 Visual
    const cardVisual = document.createElement('div');
    cardVisual.className = 'v9-card';
    cardVisual.innerHTML = `<h4>Görsel & veri</h4>`;
    const visRow = document.createElement('div');
    visRow.className = 'v9-row';
    const aiTable = document.createElement('button');
    aiTable.type = 'button';
    aiTable.className = 'v9-btn is-ai';
    aiTable.textContent = 'AI Tablo';
    aiTable.addEventListener('click', () => {
      window.AcadexPresentationVisualAiV8?.generateFromSlide?.('table')
        || window.AcadexPresentationChatV8?.handleUser?.('Aktif slayta temiz bir tablo ekle');
    });
    const aiChart = document.createElement('button');
    aiChart.type = 'button';
    aiChart.className = 'v9-btn is-ai';
    aiChart.textContent = 'AI Grafik';
    aiChart.addEventListener('click', () => {
      window.AcadexPresentationVisualAiV8?.generateFromSlide?.('chart')
        || window.AcadexPresentationChatV8?.handleUser?.('Aktif slayta grafik ekle');
    });
    visRow.appendChild(aiTable);
    visRow.appendChild(aiChart);
    cardVisual.appendChild(visRow);

    const manRow = document.createElement('div');
    manRow.className = 'v9-row';
    manRow.style.marginTop = '.4rem';
    if (saved['pres-insert-table-btn']) {
      const t = saved['pres-insert-table-btn'];
      t.className = 'v9-btn';
      t.style.width = '100%';
      t.textContent = 'Tablo aracı';
      manRow.appendChild(t);
    }
    if (saved['pres-insert-chart-btn']) {
      const c = saved['pres-insert-chart-btn'];
      c.className = 'v9-btn';
      c.style.width = '100%';
      c.textContent = 'Grafik aracı';
      manRow.appendChild(c);
    }
    cardVisual.appendChild(manRow);

    // upload
    const uploadWrap = document.createElement('div');
    uploadWrap.style.marginTop = '.55rem';
    if (saved['pres-upload-zone']) uploadWrap.appendChild(saved['pres-upload-zone']);
    if (saved['pres-image-input']) uploadWrap.appendChild(saved['pres-image-input']);
    if (saved['pres-upload-status']) uploadWrap.appendChild(saved['pres-upload-status']);
    if (saved['pres-upload-btn']) {
      saved['pres-upload-btn'].className = 'pres-btn';
      saved['pres-upload-btn'].style.width = '100%';
      saved['pres-upload-btn'].style.marginTop = '.4rem';
      saved['pres-upload-btn'].style.justifyContent = 'center';
      uploadWrap.appendChild(saved['pres-upload-btn']);
    }
    cardVisual.appendChild(uploadWrap);
    const hint = document.createElement('p');
    hint.className = 'v9-hint';
    hint.textContent = 'Öneri: önce metin, sonra AI Tablo/Grafik — çift içerik oluşmaz.';
    cardVisual.appendChild(hint);
    body.appendChild(cardVisual);

    // 4 Quick Acadia (compact)
    const cardAi = document.createElement('div');
    cardAi.className = 'v9-card';
    cardAi.innerHTML = `<div class="v9-section-title"><h4 style="margin:0">Slayt asistanı</h4><button type="button" class="v9-btn is-ai" id="v9-open-chat" style="padding:.25rem .55rem">Sohbet</button></div>`;
    const box = document.createElement('div');
    box.className = 'pres-acadia-box';
    if (saved['pres-acadia-messages']) box.appendChild(saved['pres-acadia-messages']);
    const quick = document.createElement('div');
    quick.className = 'pres-acadia-quick-actions';
    if (chips.length) {
      chips.forEach((ch) => quick.appendChild(ch));
    } else {
      [
        ['Bu slaytı madde madde yaz.', 'Madde'],
        ['Bu slaytı kısa paragraf yap.', 'Paragraf'],
        ['Bu slayt için konuşma notları oluştur.', 'Notes'],
      ].forEach(([p, label]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pres-acadia-chip';
        b.dataset.presAcadiaPrompt = p;
        b.textContent = label;
        quick.appendChild(b);
      });
    }
    box.appendChild(quick);
    const row = document.createElement('div');
    row.className = 'pres-acadia-input-row';
    if (saved['pres-acadia-input']) row.appendChild(saved['pres-acadia-input']);
    if (saved['pres-acadia-send']) row.appendChild(saved['pres-acadia-send']);
    box.appendChild(row);
    cardAi.appendChild(box);
    body.appendChild(cardAi);

    document.getElementById('v9-open-chat')?.addEventListener('click', () => {
      window.AcadexPresentationChatV8?.open?.();
    });
  }

  function applyStyle(style) {
    const map = {
      bullets: 'Bu slaytın metnini net madde işaretli akademik maddelere dönüştür. Tablo/grafik varsa koru. Başlığı koru.',
      paragraph: 'Bu slaytı 2-3 cümmelik akıcı akademik paragraf olarak yeniden yaz. Madde listesini kaldır. Tablo/grafik varsa koru.',
      short: 'Bu slaytı kısalt: en fazla 3 kısa madde veya 2 cümle. Ana fikri koru. Tablo/grafik varsa koru.',
      expand: 'Bu slaytı akademik olarak detaylandır: neden/ nasıl ekle, 4-5 madde veya daha dolu paragraf. Uydurma kaynak ekleme. Tablo/grafik varsa koru.',
    };
    const instruction = map[style];
    if (!instruction) return;
    if (typeof window.sendPresentationAcadiaMessage === 'function') {
      window.sendPresentationAcadiaMessage(instruction);
    } else if (window.AcadexPresentationChatV8?.handleUser) {
      window.AcadexPresentationChatV8.handleUser(instruction);
    } else {
      const input = document.getElementById('pres-acadia-input');
      if (input) input.value = instruction;
      document.getElementById('pres-acadia-send')?.click();
    }
  }

  function boot() {
    injectStyles();
    const studio = document.getElementById('pres-studio-mode');
    if (!studio) return;
    rebuildPanel();
    // when studio shown again
    const obs = new MutationObserver(() => {
      const body = document.querySelector('#pres-studio-mode .pres-right-body');
      if (body && body.dataset.v9 !== '1') rebuildPanel();
    });
    obs.observe(studio, { attributes: true, childList: true, subtree: true });
  }

  window.AcadexPresentationToolsPanelV9 = { rebuildPanel, applyStyle };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 400));
  else setTimeout(boot, 400);
  setTimeout(boot, 1200);
  setTimeout(boot, 2500);
})();
