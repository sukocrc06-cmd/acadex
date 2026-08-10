/* Acadex Presentation Chat V8.2 — sohbet, hafıza, komutlar; FAB/Focus arkaya */
(function () {
  'use strict';
  if (window.__acadexPresentationChatV8) {
    // allow upgrade reload
    try { delete window.__acadexPresentationChatV8; } catch (_) {}
  }
  window.__acadexPresentationChatV8 = true;

  const MEM_KEY = 'acadex_pres_chat_v8_mem';
  const CTX_KEY = 'acadex_pres_chat_v8_ctx';
  const MAX_MEMORY = 60;
  let memory = [];
  let ctx = { lastTopic: '', lastDetail: 'bullets', lastCount: 8, lastTheme: '', lastAction: '', preferMixed: true };
  let pendingCreate = null;
  let busy = false;

  function loadState() {
    try {
      const m = JSON.parse(sessionStorage.getItem(MEM_KEY) || '[]');
      if (Array.isArray(m)) memory = m.slice(-MAX_MEMORY);
    } catch (_) {}
    try {
      const c = JSON.parse(sessionStorage.getItem(CTX_KEY) || '{}');
      if (c && typeof c === 'object') ctx = { ...ctx, ...c };
    } catch (_) {}
  }
  function saveState() {
    try { sessionStorage.setItem(MEM_KEY, JSON.stringify(memory.slice(-MAX_MEMORY))); } catch (_) {}
    try { sessionStorage.setItem(CTX_KEY, JSON.stringify(ctx)); } catch (_) {}
  }

  function g() {
    const out = { slides: null, active: 0, currentId: null, presentation: null };
    try { if (typeof presSlides !== 'undefined' && Array.isArray(presSlides)) out.slides = presSlides; } catch (_) {}
    try { if (Array.isArray(window.presSlides)) out.slides = window.presSlides; } catch (_) {}
    try { if (typeof presActiveSlide !== 'undefined') out.active = Number(presActiveSlide) || 0; } catch (_) {}
    try { if (typeof window.presActiveSlide === 'number') out.active = window.presActiveSlide; } catch (_) {}
    try { if (typeof presCurrentId !== 'undefined' && presCurrentId) out.currentId = presCurrentId; } catch (_) {}
    try { if (window.presCurrentId) out.currentId = window.presCurrentId; } catch (_) {}
    try { if (typeof presCurrentPresentation !== 'undefined') out.presentation = presCurrentPresentation; } catch (_) {}
    try { if (window.presCurrentPresentation) out.presentation = window.presCurrentPresentation; } catch (_) {}
    return out;
  }


  function getSupabase() {
    try {
      // supabase-config.js: const supabaseClient (global lexical, not window)
      if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.functions) {
        return supabaseClient;
      }
    } catch (_) {}
    try {
      if (getSupabase() && getSupabase()?.functions) return getSupabase();
    } catch (_) {}
    try {
      if (window.supabase && window.__acadexSupabase) return window.__acadexSupabase;
    } catch (_) {}
    return null;
  }

  function injectStyles() {
    if (document.getElementById('acadex-pres-chat-v8-style')) {
      document.getElementById('acadex-pres-chat-v8-style').remove();
    }
    const s = document.createElement('style');
    s.id = 'acadex-pres-chat-v8-style';
    s.textContent = `
      /* Chat always above global FAB / Focus Mode (z-index 99999) */
      #pres-chat-overlay {
        position: fixed; inset: 0; z-index: 100050 !important;
        display: none; align-items: stretch; justify-content: flex-end;
        background: rgba(8,18,36,.52); backdrop-filter: blur(3px);
      }
      #pres-chat-overlay.is-open { display: flex; }
      /* Hide competing widgets while presentation chat is open */
      body.pres-chat-open #acadia-widget-container,
      body.pres-chat-open #btn-acadia-toggle,
      body.pres-chat-open .acadia-fab-wrap,
      body.pres-chat-open #btn-pomodoro-toggle,
      body.pres-chat-open #pomodoro-widget-container,
      body.pres-chat-open #pomodoro-panel,
      body.pres-chat-open #pomodoro-dim-overlay {
        opacity: 0 !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }
      #pres-chat-panel {
        width: min(440px, 100vw); height: 100%; background: #fff;
        box-shadow: -16px 0 48px rgba(15,23,42,.22);
        display: flex; flex-direction: column; font-family: inherit;
        position: relative; z-index: 100051;
      }
      #pres-chat-panel .pch-head {
        display:flex; align-items:center; justify-content:space-between; gap:.75rem;
        padding: .95rem 1rem; border-bottom: 1px solid rgba(22,50,92,.08);
        background: linear-gradient(135deg,#0f766e 0%,#16325c 100%); color:#fff;
      }
      #pres-chat-panel .pch-head h3 { margin:0; font-size:.98rem; font-weight:800; }
      #pres-chat-panel .pch-head p { margin:.2rem 0 0; font-size:.7rem; opacity:.88; }
      #pres-chat-panel .pch-close {
        border:none; background:rgba(255,255,255,.16); color:#fff; width:34px; height:34px;
        border-radius:10px; cursor:pointer; font-size:1.15rem; line-height:1;
      }
      #pres-chat-messages {
        flex:1; overflow:auto; padding:1rem; display:flex; flex-direction:column; gap:.7rem;
        background: linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);
      }
      .pch-msg {
        max-width: 92%; padding: .7rem .85rem; border-radius: 14px;
        font-size: .84rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
      }
      .pch-msg.is-user {
        align-self: flex-end; background: #0d9488; color: #fff;
        border-bottom-right-radius: 4px;
      }
      .pch-msg.is-assistant {
        align-self: flex-start; background: #fff; color: #16325c;
        border: 1px solid rgba(22,50,92,.08); border-bottom-left-radius: 4px;
        box-shadow: 0 1px 2px rgba(15,23,42,.04);
      }
      .pch-msg.is-system {
        align-self: center; background: transparent; color: #64748b;
        font-size: .72rem; text-align: center; max-width: 100%;
      }
      .pch-msg.is-error { border-color: #fecaca; background: #fef2f2; color: #991b1b; }
      #pres-chat-panel .pch-quick {
        display:flex; flex-wrap:wrap; gap:.35rem; padding: .55rem .75rem;
        border-top: 1px solid rgba(22,50,92,.06); background:#fff;
        max-height: 96px; overflow: auto;
      }
      #pres-chat-panel .pch-chip {
        border: 1px solid rgba(22,50,92,.12); background: #f8fafc; color: #16325c;
        border-radius: 999px; padding: .32rem .7rem; font-size: .7rem; font-weight: 700; cursor: pointer;
      }
      #pres-chat-panel .pch-chip:hover { border-color: #0d9488; color: #0f766e; background: #f0fdfa; }
      #pres-chat-panel .pch-form {
        display:flex; gap:.5rem; padding: .8rem; border-top: 1px solid rgba(22,50,92,.08); background:#fff;
      }
      #pres-chat-input {
        flex:1; border:1px solid rgba(22,50,92,.12); border-radius:12px;
        padding: .7rem .8rem; font-size: .86rem; resize: none; min-height: 46px; max-height: 130px;
        font-family: inherit;
      }
      #pres-chat-input:focus { outline:none; border-color:#0d9488; box-shadow:0 0 0 3px rgba(13,148,136,.12); }
      #pres-chat-send {
        border:none; background:#0d9488; color:#fff; border-radius:12px;
        padding: 0 1rem; font-weight:800; cursor:pointer; font-size:.84rem;
      }
      #pres-chat-send:disabled { opacity:.55; cursor:wait; }
      @media (max-width: 640px) { #pres-chat-panel { width: 100vw; } }
    `;
    document.head.appendChild(s);
  }

  function contextualChips() {
    const globals = g();
    const hasDeck = !!(globals.slides && globals.slides.length > 1);
    const chips = [];
    if (!hasDeck) {
      chips.push(['8 slaytlık akademik sunum oluştur: ', 'Sunum oluştur']);
      chips.push(['Konu: yapay zeka etiği, 10 slayt, detaylı', 'Örnek konu']);
      chips.push(['Özet ve Türkçe olsun', 'Özet + TR']);
    } else {
      chips.push(['Aktif slayta grafik ekle', 'Grafik']);
      chips.push(['Aktif slayta tablo ekle', 'Tablo']);
      chips.push(['Aktif slaytı daha akademik yaz', 'Akademikleştir']);
      chips.push(['Konuşma notlarını güçlendir', 'Notes']);
      const n = (globals.active || 0) + 1;
      chips.push([`${n}. slaytı kısalt ve netleştir`, `Slayt ${n}`]);
    }
    chips.push(['Arka planı siyah yap', 'Siyah']);
    chips.push(['Ocean tema yap', 'Ocean']);
    chips.push(['Violet tema', 'Violet']);
    chips.push(['Forest tema', 'Forest']);
    if (ctx.lastTopic) chips.unshift([`${ctx.lastTopic} konusunda yeni sunum oluştur`, 'Son konu']);
    return chips;
  }

  function refreshChips() {
    const box = document.getElementById('pres-chat-quick');
    if (!box) return;
    box.replaceChildren();
    contextualChips().forEach(([q, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pch-chip';
      b.dataset.q = q;
      b.textContent = label;
      box.appendChild(b);
    });
  }

  function ensureUi() {
    injectStyles();
    if (!document.getElementById('pres-chat-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'pres-chat-overlay';
      overlay.innerHTML = `
        <div id="pres-chat-panel" role="dialog" aria-modal="true" aria-label="Acadia sunum sohbeti">
          <div class="pch-head">
            <div>
              <h3>Acadia · Sunum Asistanı</h3>
              <p>Sohbet · üret · düzenle · tema · hafıza</p>
            </div>
            <button type="button" class="pch-close" id="pres-chat-close" aria-label="Kapat">×</button>
          </div>
          <div id="pres-chat-messages" aria-live="polite"></div>
          <div class="pch-quick" id="pres-chat-quick"></div>
          <form class="pch-form" id="pres-chat-form">
            <textarea id="pres-chat-input" rows="1" placeholder="Örn. Yapay zeka etiği, 10 slayt, detaylı sunum oluştur…"></textarea>
            <button type="submit" id="pres-chat-send">Gönder</button>
          </form>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      document.getElementById('pres-chat-close')?.addEventListener('click', close);
      document.getElementById('pres-chat-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('pres-chat-input');
        const text = String(input?.value || '').trim();
        if (!text) return;
        input.value = '';
        handleUser(text);
      });
      document.getElementById('pres-chat-quick')?.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-q]');
        if (!chip) return;
        const q = chip.getAttribute('data-q') || '';
        const input = document.getElementById('pres-chat-input');
        if (!input) return;
        if (q.endsWith(': ') || q.endsWith(':')) {
          input.value = q;
          input.focus();
        } else {
          handleUser(q);
        }
      });
      document.getElementById('pres-chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          document.getElementById('pres-chat-form')?.requestSubmit();
        }
      });
    }
    refreshChips();
  }

  function appendDom(role, text) {
    const box = document.getElementById('pres-chat-messages');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `pch-msg is-${role === 'user' ? 'user' : role === 'system' ? 'system' : role === 'error' ? 'error is-assistant' : 'assistant'}`;
    el.textContent = text;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  function renderMessages() {
    const box = document.getElementById('pres-chat-messages');
    if (!box) return;
    box.replaceChildren();
    if (!memory.length) {
      appendDom('assistant',
        'Merhaba — Acadia sunum asistanıyım. Bu oturumdaki sohbeti hatırlarım.\n\n' +
        '• "Dijital dönüşüm, 8 slayt, madde madde"\n' +
        '• "Arka planı siyah / ocean / violet yap"\n' +
        '• "4. slayta grafik ekle"\n' +
        '• "Aktif slaytı akademikleştir"\n\n' +
        (ctx.lastTopic ? `Son konu: ${ctx.lastTopic}` : 'Bir konu yazarak başlayabilirsin.'));
      return;
    }
    memory.forEach((m) => appendDom(m.role, m.text));
    box.scrollTop = box.scrollHeight;
  }

  function push(role, text) {
    memory.push({ role, text: String(text || '').slice(0, 4000), ts: Date.now() });
    if (memory.length > MAX_MEMORY) memory = memory.slice(-MAX_MEMORY);
    saveState();
    appendDom(role, text);
  }

  function open() {
    loadState();
    ensureUi();
    renderMessages();
    refreshChips();
    document.body.classList.add('pres-chat-open');
    document.getElementById('pres-chat-overlay')?.classList.add('is-open');
    // also hide acadia panel if open
    try {
      const panel = document.getElementById('acadia-panel');
      if (panel) panel.style.display = 'none';
    } catch (_) {}
    setTimeout(() => document.getElementById('pres-chat-input')?.focus(), 80);
  }

  function close() {
    document.body.classList.remove('pres-chat-open');
    document.getElementById('pres-chat-overlay')?.classList.remove('is-open');
  }

  function setBusy(v) {
    busy = v;
    const btn = document.getElementById('pres-chat-send');
    if (btn) btn.disabled = !!v;
  }

  function parseIntent(text) {
    const t = String(text || '').trim();
    const low = t.toLocaleLowerCase('tr-TR');

    if (pendingCreate && /^(evet|oluştur|tamam|başla|üret|yap|ok|yes)\b/i.test(low)) return { type: 'confirm_create' };
    if (pendingCreate && /^(hayır|iptal|vazgeç|no)\b/i.test(low)) return { type: 'cancel_create' };

    // themes expanded
    if (/(tema|arka\s*plan|background|theme|renk)/i.test(low)
      || (/(siyah|dark|ocean|violet|mor|rose|kırmızı|kirmizi|forest|yeşil|yesil|minimal|corporate|academic|mavi)/i.test(low)
        && /(yap|geç|olsun|ayarla|değiştir)/i.test(low))) {
      let theme = null;
      if (/siyah|dark|gece|black|night/i.test(low)) theme = 'dark';
      else if (/ocean|mavi|blue/i.test(low)) theme = 'ocean';
      else if (/violet|mor|purple/i.test(low)) theme = 'violet';
      else if (/rose|kırmızı|kirmizi|red/i.test(low)) theme = 'rose';
      else if (/forest|yeşil|yesil|green/i.test(low)) theme = 'forest';
      else if (/minimal/i.test(low)) theme = 'minimal';
      else if (/corporate|kurumsal/i.test(low)) theme = 'corporate';
      else if (/academic|akademik|teal/i.test(low)) theme = 'academic';
      if (theme) return { type: 'theme', theme };
    }

    const slideMatch = low.match(/(\d+)\.?\s*(slayt|slide)/i);
    const slideNum = slideMatch ? Number(slideMatch[1]) : null;
    if (/(grafik|chart)/i.test(low) && /(ekle|oluştur|üret|koy)/i.test(low)) return { type: 'visual', kind: 'chart', slide: slideNum };
    if (/(tablo|table)/i.test(low) && /(ekle|oluştur|üret|koy|yap)/i.test(low)) return { type: 'visual', kind: 'table', slide: slideNum };

    // content style shortcuts
    if (/(madde\s*madde|bullet)/i.test(low) && /(yaz|dönüştür|yap|olsun)/i.test(low)) {
      return { type: 'improve', slide: slideNum, instruction: 'Bu slaytın metnini net madde işaretli akademik maddelere dönüştür. Tablo/grafik varsa koru. Çift içerik üretme.' };
    }
    if (/(paragraf|düz\s*metin|prose)/i.test(low) && /(yaz|dönüştür|yap|olsun)/i.test(low)) {
      return { type: 'improve', slide: slideNum, instruction: 'Bu slaytı 2-3 cümmelik akıcı akademik paragraf yap. Madde listesini kaldır. Tablo/grafik varsa koru.' };
    }
    if (/(slayt|slide|notes|not)/i.test(low) && /(geliştir|düzelt|akademik|yeniden|kısalt|detaylandır|özetle|güçlendir|netleştir)/i.test(low)) {
      return { type: 'improve', slide: slideNum, instruction: t };
    }

    if (/(sunum|presentation|slayt)\s*(oluştur|hazırla|üret|yap)/i.test(low)
      || /(oluştur|hazırla|üret).*?(sunum|presentation)/i.test(low)
      || /slaytlık/.test(low)) {
      return { type: 'create', draft: extractCreateDraft(t) };
    }

    if (pendingCreate && /(özet|madde|detaylı|detailed|summary|bullets|\d+\s*slayt)/i.test(low)) {
      return { type: 'refine_create', text: t };
    }

    if (/(ne yapabilirsin|yardım|help|komut)/i.test(low)) return { type: 'help' };
    if (/(hafızayı sil|sohbeti temizle|clear)/i.test(low)) return { type: 'clear' };

    const globals = g();
    if (globals.slides && globals.slides.length) return { type: 'improve', slide: null, instruction: t };
    return { type: 'chat', text: t };
  }

  function extractCreateDraft(text) {
    const low = text.toLocaleLowerCase('tr-TR');
    let slideCount = ctx.lastCount || 8;
    const m = low.match(/(\d+)\s*slayt/);
    if (m) slideCount = Math.min(15, Math.max(5, Number(m[1])));
    let detailLevel = ctx.lastDetail || 'bullets';
    if (/özet|summary|kısa/.test(low)) detailLevel = 'summary';
    if (/detaylı|detailed|uzun|kapsamlı/.test(low)) detailLevel = 'detailed';
    if (/madde\s*madde|bullet/.test(low)) detailLevel = 'bullets';
    let language = 'tr';
    if (/\benglish\b|\bingilizce\b/.test(low)) language = 'en';
    let topic = text
      .replace(/\d+\s*slayt(lık|li)?/gi, ' ')
      .replace(/(lütfen|bana|bir|akademik)?\s*(sunum|presentation)?\s*(oluştur|hazırla|üret|yap)/gi, ' ')
      .replace(/(özet|madde madde|detaylı|türkçe|ingilizce)/gi, ' ')
      .replace(/\s+/g, ' ').trim();
    const about = text.match(/(.+?)\s+hakkında/i);
    if (about) topic = about[1].replace(/(lütfen|bana|bir)/gi, '').trim();
    const colon = text.match(/(?:sunum|oluştur|üret)\s*[:：]\s*(.+)$/i);
    if (colon) topic = colon[1].trim();
    if (topic.length < 3 && ctx.lastTopic) topic = ctx.lastTopic;
    if (topic.length < 3) topic = text.slice(0, 200);
    return { topic: topic.slice(0, 600), slideCount, detailLevel, language, courseTag: '' };
  }

  function summarizeDraft(d) {
    const dens = d.detailLevel === 'summary' ? 'Özet' : d.detailLevel === 'detailed' ? 'Detaylı' : 'Madde madde';
    return `Konu: ${d.topic}\nSlayt: ${d.slideCount}\nYoğunluk: ${dens}\nDil: ${d.language === 'en' ? 'English' : 'Türkçe'}`;
  }

  async function handleUser(text) {
    if (busy) return;
    push('user', text);
    const intent = parseIntent(text);
    try {
      setBusy(true);
      if (intent.type === 'clear') {
        memory = []; pendingCreate = null; saveState(); renderMessages();
        push('assistant', 'Sohbet hafızası temizlendi.');
        refreshChips();
        return;
      }
      if (intent.type === 'help') {
        push('assistant',
          'Komut ağı:\n' +
          '• Sunum: "X konusu, 10 slayt, detaylı"\n' +
          '• Tema: siyah, ocean, violet, rose, forest, minimal, corporate\n' +
          '• "3. slayta grafik/tablo ekle"\n' +
          '• "Slaytı akademikleştir / kısalt / notes güçlendir"\n' +
          '• "Hafızayı sil"\n' +
          'Hafıza: son konu, yoğunluk ve mesajlar bu oturumda saklanır.');
        return;
      }
      if (intent.type === 'theme') {
        ctx.lastTheme = intent.theme; ctx.lastAction = 'theme'; saveState();
        if (window.AcadexPresentationThemeV8?.setTheme) {
          window.AcadexPresentationThemeV8.setTheme(intent.theme, { dirty: true });
          const labels = {
            dark: 'Dark / Siyah', academic: 'Modern Academic', minimal: 'Minimal',
            corporate: 'Corporate', ocean: 'Ocean', violet: 'Violet', rose: 'Rose', forest: 'Forest'
          };
          push('assistant', `Tema: ${labels[intent.theme] || intent.theme}. Canvas renkleri güncellendi.`);
        } else push('assistant', 'Tema motoru yüklenemedi.');
        refreshChips();
        return;
      }
      if (intent.type === 'visual') {
        ctx.lastAction = 'visual'; saveState();
        await doVisual(intent.kind, intent.slide);
        refreshChips();
        return;
      }
      if (intent.type === 'improve') {
        ctx.lastAction = 'improve'; saveState();
        await doImprove(intent.slide, intent.instruction);
        refreshChips();
        return;
      }
      if (intent.type === 'create') {
        await doCreateFlow(intent.draft);
        return;
      }
      if (intent.type === 'confirm_create') {
        await runCreate(pendingCreate);
        pendingCreate = null;
        refreshChips();
        return;
      }
      if (intent.type === 'cancel_create') {
        pendingCreate = null;
        push('assistant', 'İptal. Yeni konu yazabilirsin.');
        return;
      }
      if (intent.type === 'refine_create') {
        const d = extractCreateDraft(intent.text);
        pendingCreate = { ...pendingCreate, ...d, topic: (d.topic && d.topic.length >= 3 ? d.topic : pendingCreate.topic) };
        push('assistant', summarizeDraft(pendingCreate) + '\n\nOnay: "Evet" / "Oluştur"');
        return;
      }
      if (intent.type === 'chat') {
        const draft = extractCreateDraft(intent.text);
        if (draft.topic && draft.topic.length >= 5) {
          pendingCreate = draft;
          push('assistant', 'Sunum taslağı:\n\n' + summarizeDraft(draft) + '\n\n"Evet" dersen üretirim.');
        } else {
          push('assistant', 'Konu + istek yaz.\nÖrn: "İklim değişikliği, 8 slayt, özet sunum oluştur"');
        }
      }
    } catch (e) {
      console.error(e);
      push('error', e?.message || 'Hata oluştu.');
    } finally {
      setBusy(false);
    }
  }

  async function doCreateFlow(draft) {
    if (!draft.topic || draft.topic.length < 3) {
      push('assistant', 'Konuyu bir cümleyle yazar mısın?');
      pendingCreate = draft;
      return;
    }
    pendingCreate = draft;
    ctx.lastTopic = draft.topic;
    ctx.lastDetail = draft.detailLevel;
    ctx.lastCount = draft.slideCount;
    saveState();
    push('assistant', 'Taslak:\n\n' + summarizeDraft(draft) + '\n\nKarışık stil: giriş kısa, kavramlar madde, süreç adımlı, özet net.\n\n"Evet" / "Oluştur" — veya "10 slayt, detaylı" diye güncelle.');
  }

  async function runCreate(draft) {
    if (!draft?.topic) { push('assistant', 'Konu eksik.'); return; }
    const sb = getSupabase();
    if (!sb || !sb.functions) throw new Error('Supabase bağlantısı hazır değil. Sayfayı yenileyip tekrar giriş yapın.');
    push('system', 'Acadia sunumu hazırlıyor…');
    ctx.lastTopic = draft.topic; ctx.lastDetail = draft.detailLevel; ctx.lastCount = draft.slideCount; ctx.lastAction = 'create';
    saveState();
    try { window.AcadexPresentationSettingsV8?.setDetailLevel?.(draft.detailLevel); } catch (_) {}

    const { data, error } = await sb.functions.invoke('generate-presentation', {
      body: {
        action: 'generate', sourceType: 'topic', topic: draft.topic,
        slideCount: draft.slideCount || 8, language: draft.language || 'tr',
        courseTag: draft.courseTag || '', detailLevel: draft.detailLevel || 'bullets',
      },
    });
    if (error || !data?.presentation?.slides?.length) {
      throw new Error(data?.error || error?.message || 'Sunum üretilemedi');
    }
    const generated = data.presentation;
    try { if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor(); } catch (_) {}
    try {
      if (typeof presSlides !== 'undefined' && Array.isArray(presSlides)) {
        const normalize = typeof normalizePresentationSlide === 'function' ? normalizePresentationSlide : (s) => s;
        while (presSlides.length) presSlides.pop();
        generated.slides.slice(0, 15).forEach((slide, index) => {
          presSlides.push(normalize({ ...slide }, index));
        });
        if (typeof presActiveSlide !== 'undefined') presActiveSlide = 0;
        if (typeof presCurrentPresentation !== 'undefined' && presCurrentPresentation) {
          presCurrentPresentation.title = (generated.title || draft.topic || 'Akademik Sunum').slice(0, 160);
          presCurrentPresentation.language = draft.language || 'tr';
        }
        const titleInput = document.getElementById('pres-title-input');
        if (titleInput) titleInput.value = generated.title || draft.topic;
        if (typeof reindexPresentationSlides === 'function') reindexPresentationSlides();
        if (typeof markPresentationDirty === 'function') markPresentationDirty();
        if (typeof renderPresentationSlidesList === 'function') renderPresentationSlidesList();
        if (typeof renderActivePresentationSlide === 'function') renderActivePresentationSlide();
      }
    } catch (e) {
      console.error(e);
      throw new Error('Üretildi ama stüdyoya aktarılamadı.');
    }
    try {
      if (data.quality && window.AcadexPresentationPolishV8?.setQuality) {
        window.AcadexPresentationPolishV8.setQuality(data.quality);
      }
    } catch (_) {}
    const q = data.quality?.score != null ? ` · Kalite ${Math.round(data.quality.score)}/100` : '';
    push('assistant', `Hazır: ${generated.slides.length} slayt${q}.\n\nÖnerilen akış:\n1) Metni gözden geçir\n2) "4. slayta temiz tablo ekle"\n3) Tema / madde-paragraf ayarı\n\nÖrn: "3. slaytı madde madde yaz"`);
    refreshChips();
  }

  async function doVisual(kind, slideNum) {
    const globals = g();
    if (!globals.slides?.length) { push('assistant', 'Önce sunum oluştur veya aç.'); return; }
    if (slideNum && slideNum >= 1 && slideNum <= globals.slides.length) {
      try {
        if (typeof presActiveSlide !== 'undefined') presActiveSlide = slideNum - 1;
        if (typeof renderPresentationSlidesList === 'function') renderPresentationSlidesList();
        if (typeof renderActivePresentationSlide === 'function') renderActivePresentationSlide();
      } catch (_) {}
    }
    if (window.AcadexPresentationVisualAiV8?.generateFromSlide) {
      push('system', kind === 'table' ? 'Tablo üretiliyor…' : 'Grafik üretiliyor…');
      await window.AcadexPresentationVisualAiV8.generateFromSlide(kind);
      push('assistant', kind === 'table' ? 'Tablo işlendi.' : 'Grafik/görsel işlendi.');
    } else push('assistant', 'Görsel AI modülü yok.');
  }

  async function doImprove(slideNum, instruction) {
    const globals = g();
    if (!globals.slides?.length) { push('assistant', 'Sunum yok.'); return; }
    if (!globals.currentId) { push('assistant', 'Düzenleme için önce Kaydet.'); return; }
    if (slideNum && slideNum >= 1 && slideNum <= globals.slides.length) {
      try { if (typeof presActiveSlide !== 'undefined') presActiveSlide = slideNum - 1; } catch (_) {}
    }
    if (typeof window.sendPresentationAcadiaMessage === 'function') {
      push('system', 'Slayt güncelleniyor…');
      await window.sendPresentationAcadiaMessage(instruction);
      push('assistant', 'Slayt güncellendi.');
      return;
    }
    try { if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor(); } catch (_) {}
    const slide = g().slides[g().active];
    if (!slide) throw new Error('Aktif slayt yok');
    push('system', 'Slayt güncelleniyor…');
    const { data, error } = await getSupabase()?.functions.invoke('generate-presentation', {
      body: {
        action: 'improve_slide',
        presentationId: g().currentId,
        language: g().presentation?.language || 'tr',
        instruction,
        slide: {
          title: slide.title,
          text: slide.content?.text || '',
          secondary_text: slide.content?.secondary_text || '',
          speaker_notes: slide.speaker_notes,
          layout_type: slide.layout_type,
        },
      },
    });
    if (error || !data?.slide) throw new Error(data?.error || error?.message || 'Güncellenemedi');
    const refined = data.slide;
    const rc = refined.content || refined;
    if (refined.title) slide.title = refined.title;
    slide.content = { ...(slide.content || {}), ...(typeof rc === 'object' ? rc : {}) };
    if (refined.speaker_notes) slide.speaker_notes = refined.speaker_notes;
    if (refined.layout_type) slide.layout_type = refined.layout_type;
    try {
      if (typeof markPresentationDirty === 'function') markPresentationDirty();
      if (typeof renderActivePresentationSlide === 'function') renderActivePresentationSlide();
      if (typeof renderPresentationSlidesList === 'function') renderPresentationSlidesList();
    } catch (_) {}
    push('assistant', 'Slayt güncellendi.');
  }

  function wireOpenButton() {
    const btn = document.getElementById('pres-ai-btn');
    if (!btn || btn.dataset.pchWired === '2') return;
    btn.dataset.pchWired = '2';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      open();
    }, true);
  }

  function boot() {
    loadState();
    ensureUi();
    wireOpenButton();
  }

  window.AcadexPresentationChatV8 = {
    open, close, handleUser,
    getMemory: () => memory.slice(),
    clearMemory: () => { memory = []; pendingCreate = null; saveState(); renderMessages(); },
    version: '8.3.0',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 500);
  setTimeout(boot, 1600);
})();
