/* Acadex Presentation Studio V10 — Acadia command bar (Ctrl/Cmd + K). */
(function () {
  'use strict';
  if (window.AcadiaPresentationCommandBarV10) return;

  const Agent = () => window.AcadiaPresentationAgentV10;
  const Services = () => window.AcadexPresentationServicesV10;
  let busy = false;

  const commands = [
    { id: 'review', label: 'Sunumu akademik olarak denetle', hint: 'Quality score + iyileştirmeler', run: () => Agent().execute('review_deck') },
    { id: 'short', label: 'Aktif slaytı kısalt', hint: 'Ana mesajı korur', run: () => Agent().execute('rewrite_active_slide', { mode: 'short' }) },
    { id: 'academic', label: 'Aktif slaytı akademikleştir', hint: 'Net ve kanıta duyarlı', run: () => Agent().execute('rewrite_active_slide', { mode: 'academic' }) },
    { id: 'notes', label: 'Konuşmacı notlarını güçlendir', hint: '45–70 kelimelik anlatım', run: () => Agent().execute('generate_speaker_notes') },
    { id: 'chart', label: 'Akıllı grafik / görsel oluştur', hint: 'Sayı varsa grafik, yoksa uygun yapı', run: () => Agent().execute('create_chart') },
    { id: 'citation', label: 'Kaynak desteğini kontrol et', hint: 'Citation coverage denetimi', run: () => Agent().execute('citation_check') },
    { id: 'duration', label: '10 dakikalık sunuma optimize et', hint: 'Akış + yoğunluk + notes', run: () => Agent().execute('optimize_duration', { minutes: 10 }) },
    { id: 'version', label: 'Güvenli versiyon kaydı oluştur', hint: 'Geri dönebilmek için snapshot', run: () => Agent().execute('save_version', { reason: 'Command bar checkpoint', createdByType: 'user' }) },
  ];

  function studioVisible() {
    const studio = document.getElementById('pres-studio-mode');
    if (!studio) return false;
    const style = getComputedStyle(studio);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function injectStyles() {
    if (document.getElementById('acadex-acadia-command-v10-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-acadia-command-v10-style';
    style.textContent = `
      #acadia-command-v10{position:fixed;inset:0;z-index:410000;display:none;align-items:flex-start;justify-content:center;padding-top:min(16vh,140px);background:rgba(15,23,42,.46);backdrop-filter:blur(4px)}
      #acadia-command-v10.is-open{display:flex}
      #acadia-command-v10 .ac10-box{width:min(680px,calc(100vw - 28px));max-height:min(620px,76vh);background:#fff;border:1px solid rgba(22,50,92,.1);border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.28);overflow:hidden;display:flex;flex-direction:column}
      #acadia-command-v10 .ac10-head{display:flex;align-items:center;gap:.65rem;padding:.8rem .9rem;border-bottom:1px solid rgba(22,50,92,.08)}
      #acadia-command-v10 .ac10-mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#0d9488,#16325c);color:#fff;display:grid;place-items:center;font-weight:900}
      #acadia-command-v10 input{flex:1;border:none;outline:none;font:inherit;font-size:.92rem;color:#16325c;min-width:0}
      #acadia-command-v10 kbd{font-size:.62rem;color:#64748b;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:.18rem .35rem}
      #acadia-command-v10 .ac10-list{padding:.55rem;overflow:auto;display:flex;flex-direction:column;gap:.25rem}
      #acadia-command-v10 .ac10-item{border:none;background:#fff;text-align:left;border-radius:11px;padding:.62rem .7rem;cursor:pointer;display:flex;justify-content:space-between;gap:1rem;align-items:center;color:#16325c}
      #acadia-command-v10 .ac10-item:hover,#acadia-command-v10 .ac10-item.is-active{background:#f0fdfa;color:#0f766e}
      #acadia-command-v10 .ac10-item strong{display:block;font-size:.78rem}
      #acadia-command-v10 .ac10-item small{display:block;font-size:.65rem;color:#64748b;margin-top:.12rem}
      #acadia-command-v10 .ac10-status{padding:.5rem .85rem;border-top:1px solid rgba(22,50,92,.07);font-size:.68rem;color:#64748b;background:#f8fafc;min-height:30px}
      #acadia-command-v10 .ac10-status.is-error{color:#b91c1c;background:#fef2f2}
      #acadia-command-v10 .ac10-status.is-ok{color:#0f766e;background:#f0fdfa}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    injectStyles();
    let overlay = document.getElementById('acadia-command-v10');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'acadia-command-v10';
    overlay.innerHTML = `
      <div class="ac10-box" role="dialog" aria-modal="true" aria-label="Acadia sunum komut çubuğu">
        <div class="ac10-head">
          <div class="ac10-mark">A</div>
          <input id="acadia-command-v10-input" type="text" autocomplete="off" placeholder="Acadia'ya söyle… örn. Bu sunumu jüri sunumuna dönüştür">
          <kbd>ESC</kbd>
        </div>
        <div class="ac10-list" id="acadia-command-v10-list"></div>
        <div class="ac10-status" id="acadia-command-v10-status">Hazır · Enter ile serbest komut gönder veya bir araç seç.</div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    const input = overlay.querySelector('#acadia-command-v10-input');
    input.addEventListener('input', renderList);
    input.addEventListener('keydown', async (event) => {
      if (event.key === 'Escape') return close();
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      await runFreePrompt(value);
    });
    renderList();
    return overlay;
  }

  function setStatus(message, kind) {
    const el = document.getElementById('acadia-command-v10-status');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('is-error', 'is-ok');
    if (kind) el.classList.add(kind);
  }

  function renderList() {
    const list = document.getElementById('acadia-command-v10-list');
    const input = document.getElementById('acadia-command-v10-input');
    if (!list) return;
    const query = String(input?.value || '').toLocaleLowerCase('tr-TR').trim();
    const filtered = commands.filter((command) => !query || `${command.label} ${command.hint}`.toLocaleLowerCase('tr-TR').includes(query));
    list.replaceChildren();
    filtered.forEach((command) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ac10-item';
      button.innerHTML = `<span><strong></strong><small></small></span><span>→</span>`;
      button.querySelector('strong').textContent = command.label;
      button.querySelector('small').textContent = command.hint;
      button.addEventListener('click', () => runCommand(command));
      list.appendChild(button);
    });
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:.8rem;color:#64748b;font-size:.72rem;text-align:center';
      empty.textContent = 'Hazır komut bulunamadı. Enter’a basarak bunu Acadia’ya serbest komut olarak gönderebilirsin.';
      list.appendChild(empty);
    }
  }

  async function runCommand(command) {
    if (busy || !Agent()) return;
    busy = true;
    setStatus(`${command.label} çalışıyor…`);
    try {
      const result = await command.run();
      if (command.id === 'review' && result?.score != null) setStatus(`Denetim tamamlandı · Academic Quality ${result.score}/100`, 'is-ok');
      else if (command.id === 'citation' && result?.score != null) setStatus(`Kaynak kontrolü tamamlandı · ${result.score}/100`, 'is-ok');
      else if (command.id === 'version' && result?.version_no) setStatus(`Versiyon v${result.version_no} kaydedildi.`, 'is-ok');
      else setStatus('İşlem tamamlandı.', 'is-ok');
      Services()?.notify?.('Acadia işlemi tamamladı.', 'success');
    } catch (error) {
      setStatus(error?.message || 'İşlem başarısız.', 'is-error');
      Services()?.notify?.(error?.message || 'Acadia işlemi başarısız.', 'error');
    } finally {
      busy = false;
    }
  }

  async function runFreePrompt(message) {
    if (busy || !Agent()) return;
    busy = true;
    setStatus('Acadia komutu işliyor…');
    try {
      await Agent().execute('ask_acadia', { message });
      setStatus('Komut Acadia sunum asistanına gönderildi.', 'is-ok');
      close();
    } catch (error) {
      setStatus(error?.message || 'Komut gönderilemedi.', 'is-error');
    } finally {
      busy = false;
    }
  }

  function open() {
    if (!studioVisible()) return;
    const overlay = ensureUi();
    overlay.classList.add('is-open');
    const input = overlay.querySelector('#acadia-command-v10-input');
    input.value = '';
    renderList();
    setStatus('Hazır · Enter ile serbest komut gönder veya bir araç seç.');
    setTimeout(() => input.focus(), 30);
  }

  function close() {
    document.getElementById('acadia-command-v10')?.classList.remove('is-open');
  }

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && studioVisible()) {
      event.preventDefault();
      open();
    }
    if (event.key === 'Escape' && document.getElementById('acadia-command-v10')?.classList.contains('is-open')) close();
  });

  window.AcadiaPresentationCommandBarV10 = { version: '10.0.0', open, close, runCommand, commands };
})();
