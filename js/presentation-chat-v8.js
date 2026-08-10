/* Acadex Presentation Chat V8 — conversational Acadia with memory + commands */
(function () {
  'use strict';
  if (window.__acadexPresentationChatV8) return;
  window.__acadexPresentationChatV8 = true;

  const STORAGE_KEY = 'acadex_pres_chat_v8';
  const MAX_MEMORY = 40;

  /** @type {{role:string, text:string, ts:number}[]} */
  let memory = [];
  /** pending create draft before confirmation */
  let pendingCreate = null;
  let busy = false;

  function loadMemory() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) memory = parsed.slice(-MAX_MEMORY);
    } catch (_) {}
  }
  function saveMemory() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory.slice(-MAX_MEMORY))); } catch (_) {}
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

  function injectStyles() {
    if (document.getElementById('acadex-pres-chat-v8-style')) return;
    const s = document.createElement('style');
    s.id = 'acadex-pres-chat-v8-style';
    s.textContent = `
      #pres-chat-overlay {
        position: fixed; inset: 0; z-index: 10080; display: none;
        align-items: stretch; justify-content: flex-end;
        background: rgba(10,24,45,.45); backdrop-filter: blur(2px);
      }
      #pres-chat-overlay.is-open { display: flex; }
      #pres-chat-panel {
        width: min(420px, 100vw); height: 100%; background: #fff;
        box-shadow: -12px 0 40px rgba(15,23,42,.18);
        display: flex; flex-direction: column; font-family: inherit;
      }
      #pres-chat-panel .pch-head {
        display:flex; align-items:center; justify-content:space-between; gap:.75rem;
        padding: .9rem 1rem; border-bottom: 1px solid rgba(22,50,92,.08);
        background: linear-gradient(135deg,#0f766e,#16325c); color:#fff;
      }
      #pres-chat-panel .pch-head h3 { margin:0; font-size:.95rem; font-weight:800; }
      #pres-chat-panel .pch-head p { margin:.15rem 0 0; font-size:.68rem; opacity:.85; }
      #pres-chat-panel .pch-close {
        border:none; background:rgba(255,255,255,.15); color:#fff; width:32px; height:32px;
        border-radius:8px; cursor:pointer; font-size:1.1rem; line-height:1;
      }
      #pres-chat-messages {
        flex:1; overflow:auto; padding:1rem; display:flex; flex-direction:column; gap:.65rem;
        background: #f8fafc;
      }
      .pch-msg {
        max-width: 92%; padding: .65rem .8rem; border-radius: 12px;
        font-size: .82rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
      }
      .pch-msg.is-user {
        align-self: flex-end; background: #0d9488; color: #fff;
        border-bottom-right-radius: 4px;
      }
      .pch-msg.is-assistant {
        align-self: flex-start; background: #fff; color: #16325c;
        border: 1px solid rgba(22,50,92,.08); border-bottom-left-radius: 4px;
      }
      .pch-msg.is-system {
        align-self: center; background: transparent; color: #64748b;
        font-size: .72rem; text-align: center; max-width: 100%;
      }
      .pch-msg.is-error { border-color: #fecaca; background: #fef2f2; color: #991b1b; }
      #pres-chat-panel .pch-quick {
        display:flex; flex-wrap:wrap; gap:.35rem; padding: .5rem .75rem;
        border-top: 1px solid rgba(22,50,92,.06); background:#fff;
      }
      #pres-chat-panel .pch-chip {
        border: 1px solid rgba(22,50,92,.12); background: #f8fafc; color: #16325c;
        border-radius: 999px; padding: .3rem .65rem; font-size: .7rem; font-weight: 700; cursor: pointer;
      }
      #pres-chat-panel .pch-chip:hover { border-color: #0d9488; color: #0f766e; }
      #pres-chat-panel .pch-form {
        display:flex; gap:.5rem; padding: .75rem; border-top: 1px solid rgba(22,50,92,.08); background:#fff;
      }
      #pres-chat-input {
        flex:1; border:1px solid rgba(22,50,92,.12); border-radius:12px;
        padding: .65rem .75rem; font-size: .85rem; resize: none; min-height: 44px; max-height: 120px;
        font-family: inherit;
      }
      #pres-chat-input:focus { outline:none; border-color:#0d9488; box-shadow:0 0 0 3px rgba(13,148,136,.12); }
      #pres-chat-send {
        border:none; background:#0d9488; color:#fff; border-radius:12px;
        padding: 0 .95rem; font-weight:800; cursor:pointer; font-size:.82rem;
      }
      #pres-chat-send:disabled { opacity:.55; cursor:wait; }
      @media (max-width: 640px) {
        #pres-chat-panel { width: 100vw; }
      }
    `;
    document.head.appendChild(s);
  }

  function ensureUi() {
    injectStyles();
    if (document.getElementById('pres-chat-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'pres-chat-overlay';
    overlay.innerHTML = `
      <div id="pres-chat-panel" role="dialog" aria-modal="true" aria-label="Acadia sunum sohbeti">
        <div class="pch-head">
          <div>
            <h3>Acadia · Sunum Asistanı</h3>
            <p>Sohbet et · üret · düzenle · tema değiştir</p>
          </div>
          <button type="button" class="pch-close" id="pres-chat-close" aria-label="Kapat">×</button>
        </div>
        <div id="pres-chat-messages" aria-live="polite"></div>
        <div class="pch-quick" id="pres-chat-quick">
          <button type="button" class="pch-chip" data-q="8 slaytlık akademik sunum oluştur: ">Sunum oluştur</button>
          <button type="button" class="pch-chip" data-q="Temayı siyah / dark yap">Siyah tema</button>
          <button type="button" class="pch-chip" data-q="Aktif slayta grafik ekle">Grafik ekle</button>
          <button type="button" class="pch-chip" data-q="Aktif slayta tablo ekle">Tablo ekle</button>
          <button type="button" class="pch-chip" data-q="4. slaytı daha akademik yaz">Slayt geliştir</button>
        </div>
        <form class="pch-form" id="pres-chat-form">
          <textarea id="pres-chat-input" rows="1" placeholder="Örn. Yapay zeka etiği üzerine 10 slaytlık detaylı sunum oluştur…"></textarea>
          <button type="submit" id="pres-chat-send">Gönder</button>
        </form>
      </div>
    `;
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
      if (input) {
        input.value = q;
        input.focus();
        if (!q.endsWith(' ')) handleUser(q);
      }
    });
    const ta = document.getElementById('pres-chat-input');
    ta?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('pres-chat-form')?.requestSubmit();
      }
    });
  }

  function renderMessages() {
    const box = document.getElementById('pres-chat-messages');
    if (!box) return;
    box.replaceChildren();
    if (!memory.length) {
      appendDom('assistant', 'Merhaba — Acadia sunum asistanıyım.\n\nÖrnekler:\n• "Dijital dönüşüm hakkında 8 slaytlık sunum oluştur"\n• "Özet ve Türkçe olsun"\n• "4. slayta grafik ekle"\n• "Arka planı siyah yap"\n• "Aktif slaytı daha akademik yaz"');
      return;
    }
    memory.forEach((m) => appendDom(m.role, m.text, false));
    box.scrollTop = box.scrollHeight;
  }

  function appendDom(role, text, scroll = true) {
    const box = document.getElementById('pres-chat-messages');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `pch-msg is-${role === 'user' ? 'user' : role === 'system' ? 'system' : role === 'error' ? 'error is-assistant' : 'assistant'}`;
    el.textContent = text;
    box.appendChild(el);
    if (scroll) box.scrollTop = box.scrollHeight;
  }

  function push(role, text) {
    memory.push({ role, text: String(text || '').slice(0, 4000), ts: Date.now() });
    if (memory.length > MAX_MEMORY) memory = memory.slice(-MAX_MEMORY);
    saveMemory();
    appendDom(role, text);
  }

  function open() {
    ensureUi();
    loadMemory();
    renderMessages();
    document.getElementById('pres-chat-overlay')?.classList.add('is-open');
    setTimeout(() => document.getElementById('pres-chat-input')?.focus(), 100);
  }

  function close() {
    document.getElementById('pres-chat-overlay')?.classList.remove('is-open');
  }

  function setBusy(v) {
    busy = v;
    const btn = document.getElementById('pres-chat-send');
    if (btn) btn.disabled = !!v;
  }

  // ---------- Intent parsing ----------
  function parseIntent(text) {
    const t = String(text || '').trim();
    const low = t.toLocaleLowerCase('tr-TR');

    // confirm pending
    if (pendingCreate && /^(evet|oluştur|tamam|başla|üret|yap|ok|yes)\b/i.test(low)) {
      return { type: 'confirm_create' };
    }
    if (pendingCreate && /^(hayır|iptal|vazgeç|no)\b/i.test(low)) {
      return { type: 'cancel_create' };
    }

    // theme
    if (/(tema|arka\s*plan|background|theme|renk)/i.test(low) || /(siyah|dark|gece|minimal|corporate|academic|beyaz)/i.test(low) && /(yap|geç|olsun|ayarla|değiştir)/i.test(low)) {
      let theme = null;
      if (/siyah|dark|gece|night|black/i.test(low)) theme = 'dark';
      else if (/minimal/i.test(low)) theme = 'minimal';
      else if (/corporate|kurumsal/i.test(low)) theme = 'corporate';
      else if (/academic|akademik|teal|yeşil/i.test(low)) theme = 'academic';
      else if (/beyaz|açık|light|white/i.test(low)) theme = 'academic';
      if (theme) return { type: 'theme', theme };
    }

    // slide visual
    const slideMatch = low.match(/(\d+)\.?\s*(slayt|slide)/i);
    const slideNum = slideMatch ? Number(slideMatch[1]) : null;
    if (/(grafik|chart|diyagram)/i.test(low) && /(ekle|oluştur|üret|koy)/i.test(low)) {
      return { type: 'visual', kind: 'chart', slide: slideNum };
    }
    if (/(tablo|table)/i.test(low) && /(ekle|oluştur|üret|koy)/i.test(low)) {
      return { type: 'visual', kind: 'table', slide: slideNum };
    }

    // improve slide
    if (/(slayt|slide)/i.test(low) && /(geliştir|düzelt|akademik|yeniden yaz|kısalt|detaylandır|özetle)/i.test(low)) {
      return { type: 'improve', slide: slideNum, instruction: t };
    }

    // create presentation
    if (/(sunum|presentation|slayt)\s*(oluştur|hazırla|üret|yap)/i.test(low)
      || /(oluştur|hazırla|üret).*?(sunum|presentation)/i.test(low)
      || /^(sunum\s*:)/i.test(low)) {
      const draft = extractCreateDraft(t);
      return { type: 'create', draft };
    }

    // density only while pending
    if (pendingCreate && /(özet|madde|detaylı|detailed|summary|bullets)/i.test(low)) {
      return { type: 'refine_create', text: t };
    }

    // generic improve active / help
    if (/(ne yapabilirsin|yardım|help|komut)/i.test(low)) {
      return { type: 'help' };
    }

    // default: if we have open presentation, treat as improve active; else create intent soft
    const globals = g();
    if (globals.slides && globals.slides.length) {
      return { type: 'improve', slide: null, instruction: t };
    }
    return { type: 'chat', text: t };
  }

  function extractCreateDraft(text) {
    const low = text.toLocaleLowerCase('tr-TR');
    let slideCount = 8;
    const m = low.match(/(\d+)\s*slayt/);
    if (m) slideCount = Math.min(15, Math.max(5, Number(m[1])));

    let detailLevel = 'bullets';
    if (/özet|summary|kısa/.test(low)) detailLevel = 'summary';
    if (/detaylı|detailed|uzun|kapsamlı/.test(low)) detailLevel = 'detailed';
    if (/madde\s*madde|bullet/.test(low)) detailLevel = 'bullets';

    let language = 'tr';
    if (/\benglish\b|\bingilizce\b|\ben\b/.test(low)) language = 'en';

    // strip command words to get topic
    let topic = text
      .replace(/\d+\s*slayt(lık|li)?/gi, ' ')
      .replace(/(lütfen|bana|bir|akademik)?\s*(sunum|presentation)?\s*(oluştur|hazırla|üret|yap)/gi, ' ')
      .replace(/(özet|madde madde|detaylı|türkçe|ingilizce)/gi, ' ')
      .replace(/^(hakkında|konu[su:]*)\s*/i, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // patterns: "X hakkında sunum", "sunum oluştur: X"
    const about = text.match(/(.+?)\s+hakkında/i);
    if (about) topic = about[1].replace(/(lütfen|bana|bir)/gi, '').trim();
    const colon = text.match(/(?:sunum|oluştur|üret)\s*[:：]\s*(.+)$/i);
    if (colon) topic = colon[1].trim();

    if (topic.length < 3) topic = text.slice(0, 200);

    return { topic: topic.slice(0, 600), slideCount, detailLevel, language, courseTag: '' };
  }

  // ---------- Actions ----------
  async function handleUser(text) {
    if (busy) return;
    push('user', text);
    const intent = parseIntent(text);

    try {
      setBusy(true);
      if (intent.type === 'help') {
        push('assistant', 'Komut örnekleri:\n• Sunum oluştur: "İklim değişikliği, 10 slayt, detaylı"\n• Tema: "Arka planı siyah yap" / "Minimal tema"\n• "3. slayta grafik ekle"\n• "Aktif slayta tablo ekle"\n• "5. slaytı daha akademik yaz"\n\nSohbet hafızası bu oturumda tutulur.');
        return;
      }
      if (intent.type === 'theme') {
        await doTheme(intent.theme);
        return;
      }
      if (intent.type === 'visual') {
        await doVisual(intent.kind, intent.slide);
        return;
      }
      if (intent.type === 'improve') {
        await doImprove(intent.slide, intent.instruction);
        return;
      }
      if (intent.type === 'create') {
        await doCreateFlow(intent.draft);
        return;
      }
      if (intent.type === 'confirm_create') {
        await runCreate(pendingCreate);
        pendingCreate = null;
        return;
      }
      if (intent.type === 'cancel_create') {
        pendingCreate = null;
        push('assistant', 'Tamam, oluşturmayı iptal ettim. Yeni bir konu yazabilirsin.');
        return;
      }
      if (intent.type === 'refine_create') {
        const d = extractCreateDraft(intent.text);
        pendingCreate = { ...pendingCreate, ...d, topic: pendingCreate.topic || d.topic };
        push('assistant', summarizeDraft(pendingCreate) + '\n\nOnaylıyor musun? "Evet" veya "Oluştur" yaz.');
        return;
      }
      // soft chat
      if (intent.type === 'chat') {
        const draft = extractCreateDraft(intent.text);
        if (draft.topic && draft.topic.length >= 5 && /(sunum|slayt|anlat|konu)/i.test(intent.text)) {
          pendingCreate = draft;
          push('assistant', 'Bunu bir sunum taslağı olarak alıyorum.\n\n' + summarizeDraft(draft) + '\n\n"Evet" dersen üretirim; yoğunluk veya slayt sayısını de değiştirebilirsin.');
        } else {
          push('assistant', 'Anladım. Sunum üretmem için konu + istek yazman yeterli.\nÖrn: "Yapay zeka etiği hakkında 8 slaytlık madde madde sunum oluştur"');
        }
      }
    } catch (e) {
      console.error(e);
      push('error', e?.message || 'Bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  }

  function summarizeDraft(d) {
    const dens = d.detailLevel === 'summary' ? 'Özet' : d.detailLevel === 'detailed' ? 'Detaylı' : 'Madde madde';
    return `Konu: ${d.topic}\nSlayt: ${d.slideCount}\nYoğunluk: ${dens}\nDil: ${d.language === 'en' ? 'English' : 'Türkçe'}`;
  }

  async function doCreateFlow(draft) {
    if (!draft.topic || draft.topic.length < 3) {
      push('assistant', 'Hangi konuda sunum hazırlayayım? Konuyu bir cümleyle yazar mısın?');
      pendingCreate = draft;
      return;
    }
    // If message already looks complete, generate immediately; else confirm
    pendingCreate = draft;
    push('assistant', 'Taslak hazır:\n\n' + summarizeDraft(draft) + '\n\nÜretmemi ister misin? "Evet" / "Oluştur" yaz — veya "10 slayt, özet" diye güncelle.');
  }

  async function runCreate(draft) {
    if (!draft?.topic) {
      push('assistant', 'Konu eksik.');
      return;
    }
    if (!window.supabaseClient) throw new Error('Bağlantı yok.');
    push('system', 'Acadia sunumu hazırlıyor…');

    try {
      if (typeof window.AcadexPresentationSettingsV8?.setDetailLevel === 'function') {
        window.AcadexPresentationSettingsV8.setDetailLevel(draft.detailLevel);
      }
    } catch (_) {}

    const { data, error } = await window.supabaseClient.functions.invoke('generate-presentation', {
      body: {
        action: 'generate',
        sourceType: 'topic',
        topic: draft.topic,
        slideCount: draft.slideCount || 8,
        language: draft.language || 'tr',
        courseTag: draft.courseTag || '',
        detailLevel: draft.detailLevel || 'bullets',
      },
    });
    if (error || !data?.presentation?.slides?.length) {
      throw new Error(data?.error || error?.message || 'Sunum üretilemedi');
    }

    // Apply into studio — reuse dashboard globals
    const generated = data.presentation;
    try {
      if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor();
    } catch (_) {}

    try {
      // mirror generatePresentationWithAcadia apply path
      if (typeof presSlides !== 'undefined' && Array.isArray(presSlides)) {
        const normalize = typeof normalizePresentationSlide === 'function'
          ? normalizePresentationSlide
          : (s) => s;
        // clear old
        while (presSlides.length) presSlides.pop();
        generated.slides.slice(0, 15).forEach((slide, index) => {
          presSlides.push(normalize({
            ...slide,
            title: slide.title,
            content: slide.content,
            speaker_notes: slide.speaker_notes,
            layout_type: slide.layout_type,
          }, index));
        });
        if (typeof presActiveSlide !== 'undefined') presActiveSlide = 0;
        if (typeof presCurrentPresentation !== 'undefined' && presCurrentPresentation) {
          presCurrentPresentation.title = (generated.title || draft.topic || 'Akademik Sunum').slice(0, 160);
          presCurrentPresentation.language = draft.language || 'tr';
          presCurrentPresentation.theme = presCurrentPresentation.theme || 'academic';
        }
        const titleInput = document.getElementById('pres-title-input');
        if (titleInput) titleInput.value = generated.title || draft.topic;
        if (typeof reindexPresentationSlides === 'function') reindexPresentationSlides();
        if (typeof markPresentationDirty === 'function') markPresentationDirty();
        if (typeof renderPresentationSlidesList === 'function') renderPresentationSlidesList();
        if (typeof renderActivePresentationSlide === 'function') renderActivePresentationSlide();
      }
    } catch (e) {
      console.error('Apply slides failed', e);
      throw new Error('Sunum üretildi ama stüdyoya aktarılamadı. Formdan tekrar deneyin.');
    }

    try {
      if (data.quality && window.AcadexPresentationPolishV8?.setQuality) {
        window.AcadexPresentationPolishV8.setQuality(data.quality);
      }
    } catch (_) {}

    const q = data.quality?.score != null ? ` · Kalite ${Math.round(data.quality.score)}/100` : '';
    push('assistant', `Hazır: ${generated.slides.length} slayt${q}.\n\nŞimdi sohbete devam edebilirsin:\n• "3. slayta grafik ekle"\n• "Temayı siyah yap"\n• "Özet slaytı güçlendir"`);
    try {
      if (typeof showDashboardAlert === 'function') {
        showDashboardAlert('success', `${generated.slides.length} slayt üretildi.`);
      }
    } catch (_) {}
  }

  async function doTheme(themeId) {
    if (window.AcadexPresentationThemeV8?.setTheme) {
      window.AcadexPresentationThemeV8.setTheme(themeId, { dirty: true });
      const labels = { dark: 'Dark / Siyah', academic: 'Modern Academic', minimal: 'Minimal', corporate: 'Corporate' };
      push('assistant', `Tema güncellendi: ${labels[themeId] || themeId}. Canvas ve export renkleri buna göre ayarlanır.`);
    } else {
      push('assistant', 'Tema motoru yüklenemedi. Sayfayı yenileyip tekrar dene.');
    }
  }

  async function doVisual(kind, slideNum) {
    const globals = g();
    if (!globals.slides?.length) {
      push('assistant', 'Önce bir sunum oluştur veya aç.');
      return;
    }
    // switch active slide if specified
    if (slideNum && slideNum >= 1 && slideNum <= globals.slides.length) {
      try {
        if (typeof presActiveSlide !== 'undefined') presActiveSlide = slideNum - 1;
        if (typeof renderPresentationSlidesList === 'function') renderPresentationSlidesList();
        if (typeof renderActivePresentationSlide === 'function') renderActivePresentationSlide();
      } catch (_) {}
    }
    if (window.AcadexPresentationVisualAiV8?.generateFromSlide) {
      push('system', kind === 'table' ? 'Tablo üretiliyor…' : 'Grafik / görsel üretiliyor…');
      await window.AcadexPresentationVisualAiV8.generateFromSlide(kind);
      push('assistant', kind === 'table'
        ? 'Tablo isteği işlendi. Beğenmezsen “daha sade tablo yap” diyebilirsin.'
        : 'Görsel isteği işlendi. Sayı yoksa güvenli tablo önerilmiş olabilir.');
    } else {
      push('assistant', 'Görsel AI modülü yüklü değil. Sağ panelden “Acadia ile tablo/grafik” dene.');
    }
  }

  async function doImprove(slideNum, instruction) {
    const globals = g();
    if (!globals.slides?.length) {
      push('assistant', 'Düzenlenecek sunum yok. Önce sunum oluştur.');
      return;
    }
    if (!globals.currentId) {
      push('assistant', 'Düzenleme için sunumu bir kez Kaydetmen gerekiyor.');
      return;
    }
    if (slideNum && slideNum >= 1 && slideNum <= globals.slides.length) {
      try {
        if (typeof presActiveSlide !== 'undefined') presActiveSlide = slideNum - 1;
      } catch (_) {}
    }
    // Prefer existing Acadia improve path
    const input = document.getElementById('pres-acadia-input');
    if (input) input.value = instruction;
    if (typeof window.sendPresentationAcadiaMessage === 'function') {
      push('system', 'Slayt güncelleniyor…');
      await window.sendPresentationAcadiaMessage(instruction);
      push('assistant', 'Slayt güncellendi. Canvas’tan kontrol edebilirsin.');
      return;
    }
    // Fallback direct invoke
    try {
      if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor();
    } catch (_) {}
    const slide = g().slides[g().active];
    if (!slide) throw new Error('Aktif slayt yok');
    push('system', 'Slayt güncelleniyor…');
    const { data, error } = await window.supabaseClient.functions.invoke('generate-presentation', {
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
          table: slide.content?.table,
          chart: slide.content?.chart,
          cards: slide.content?.cards,
        },
      },
    });
    if (error || !data?.slide) throw new Error(data?.error || error?.message || 'Güncellenemedi');
    // minimal apply
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
    if (!btn || btn.dataset.pchWired) return;
    btn.dataset.pchWired = '1';
    btn.addEventListener('click', (e) => {
      // Prefer chat over form
      e.preventDefault();
      e.stopImmediatePropagation();
      open();
    }, true);
  }

  function boot() {
    loadMemory();
    ensureUi();
    wireOpenButton();
  }

  window.AcadexPresentationChatV8 = {
    open,
    close,
    handleUser,
    getMemory: () => memory.slice(),
    clearMemory: () => { memory = []; pendingCreate = null; saveMemory(); renderMessages(); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 600);
  setTimeout(boot, 1800);
})();
