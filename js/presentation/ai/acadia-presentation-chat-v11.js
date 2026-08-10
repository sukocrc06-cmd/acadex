/* Acadex Presentation Studio V11.1.1 — chat-first bridge, loop-safe. */
(function () {
  'use strict';

  if (window.AcadiaPresentationChatV11?.version === '11.1.1') return;

  const MEM_KEY = 'acadex_pres_chat_v8_mem';
  const Director = () => window.AcadiaPresentationDirectorV11;
  const Agent = () => window.AcadiaPresentationAgentV10;
  const Services = () => window.AcadexPresentationServicesV10;
  let busy = false;

  function presentationContext() {
    try {
      if (typeof currentActiveTab !== 'undefined' && currentActiveTab === 'presentation') return true;
    } catch (_) {}
    const view = document.getElementById('presentation-view');
    if (view?.classList.contains('active')) return true;
    const side = document.getElementById('side-presentation');
    return !!side?.classList.contains('active');
  }

  function currentState() {
    return Services()?.state?.() || { slides: [], activeIndex: 0, presentationId: null, presentation: null };
  }

  function persistMessage(role, text) {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(MEM_KEY) || '[]');
      const memory = Array.isArray(parsed) ? parsed : [];
      memory.push({ role, text: String(text || '').slice(0, 4000), ts: Date.now() });
      sessionStorage.setItem(MEM_KEY, JSON.stringify(memory.slice(-60)));
    } catch (_) {}
  }

  function append(role, text) {
    const value = String(text || '');
    persistMessage(role, value);
    const box = document.getElementById('pres-chat-messages');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `pch-msg is-${role === 'user' ? 'user' : role === 'system' ? 'system' : role === 'error' ? 'error is-assistant' : 'assistant'}`;
    el.textContent = value;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  function setBusy(value) {
    busy = !!value;
    const send = document.getElementById('pres-chat-send');
    const input = document.getElementById('pres-chat-input');
    if (send) send.disabled = busy;
    if (input) input.disabled = busy;
  }

  function closeGlobalSearch() {
    document.querySelectorAll('.global-search-overlay,.search-modal-overlay,#global-search-modal,#global-search-overlay').forEach((el) => {
      try {
        el.classList.remove('active', 'is-open');
        el.style.display = 'none';
      } catch (_) {}
    });
  }

  function decorateChat() {
    const panel = document.getElementById('pres-chat-panel');
    if (!panel || panel.dataset.v11Decorated === '1') return;
    panel.dataset.v11Decorated = '1';

    const title = panel.querySelector('.pch-head h3');
    const sub = panel.querySelector('.pch-head p');
    const input = document.getElementById('pres-chat-input');
    if (title) {
      title.textContent = 'Acadia V11 · Sunum Asistanı';
      const badge = document.createElement('span');
      badge.className = 'pch-v11-badge';
      badge.textContent = 'V11';
      badge.style.cssText = 'margin-left:.45rem;font-size:.58rem;font-weight:900;padding:.16rem .42rem;border-radius:999px;background:#dcfce7;color:#166534;vertical-align:middle';
      title.appendChild(badge);
    }
    if (sub) sub.textContent = 'Sohbet et · üret · düzenle · kaynaklandır · prova et';
    if (input) input.placeholder = 'Örn. 8 slaytlık tez savunması hazırla veya 3. slaytı daha akademik yap…';

    const quick = document.getElementById('pres-chat-quick');
    if (quick && quick.dataset.v11Quick !== '1') {
      quick.dataset.v11Quick = '1';
      quick.replaceChildren();
      [
        ['8 slaytlık akademik sunum oluştur: ', '✨ Sunum üret'],
        ['Bu sunumu akademik olarak denetle', '🎓 Denetle'],
        ['Aktif slaytı daha akademik ve kısa yap', '✍️ Akademikleştir'],
        ['Aktif slayta uygun grafik ekle', '📊 Görselleştir'],
        ['Konuşmacı notlarını güçlendir', '🎤 Notes'],
        ['Kaynak desteğini kontrol et', '📚 Kaynak'],
      ].forEach(([q, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pch-chip';
        button.dataset.q = q;
        button.textContent = label;
        quick.appendChild(button);
      });
    }
  }

  function upgradeStudioCard() {
    const open = document.getElementById('pres-v11-open');
    const command = document.getElementById('pres-v11-command');
    const note = document.querySelector('#pres-v11-director-card .pres-v11-note');
    if (open && open.dataset.chatV11 !== '1') {
      open.dataset.chatV11 = '1';
      open.textContent = '💬 Acadia ile sohbet';
    }
    if (command && command.dataset.chatV11 !== '1') {
      command.dataset.chatV11 = '1';
      command.textContent = '💬 Sohbet';
    }
    if (note && note.dataset.chatV11 !== '1') {
      note.dataset.chatV11 = '1';
      note.textContent = 'Sen sohbet et; Acadia arkada V11 Director, Writer, Visual Planner ve Academic Critic araçlarını kullanır.';
    }
  }

  function openChat() {
    if (!presentationContext()) return;
    closeGlobalSearch();
    window.AcadexPresentationCommandBarV10?.close?.();
    window.AcadiaPresentationDirectorV11?.close?.();
    window.AcadexPresentationChatV8?.open?.();
    decorateChat();
    interceptForm();
    upgradeStudioCard();
    setTimeout(() => document.getElementById('pres-chat-input')?.focus(), 40);
  }

  function numberFrom(text, regex, fallback, min, max) {
    const match = String(text).match(regex);
    const n = match ? Number(match[1]) : fallback;
    return Math.max(min, Math.min(max, Number.isFinite(n) ? n : fallback));
  }

  function createOptions(text) {
    const state = currentState();
    const p = state.presentation || {};
    const low = String(text).toLocaleLowerCase('tr-TR');
    const slideCount = numberFrom(low, /(\d+)\s*(?:slayt|slide)/i, Math.max(5, Math.min(15, state.slides?.length || 8)), 5, 15);
    const targetMinutes = numberFrom(low, /(\d+)\s*(?:dakika|dk|minute|min)/i, Math.max(3, Math.round(Number(p.target_duration_seconds || 600) / 60)), 3, 30);
    let mode = 'academic';
    if (/tez|jüri|savunma|thesis|defense/i.test(low)) mode = 'thesis_defense';
    else if (/araştırma|research|makale|paper/i.test(low)) mode = 'research';
    else if (/ders anlat|lecture|öğret/i.test(low)) mode = 'lecture';
    else if (/business|iş sunumu|yönetici|executive/i.test(low)) mode = 'business';
    let detailLevel = 'bullets';
    if (/detaylı|detailed|kapsamlı/i.test(low)) detailLevel = 'detailed';
    else if (/özet|summary|kısa/i.test(low)) detailLevel = 'summary';
    const language = /ingilizce|english/i.test(low) ? 'en' : 'tr';

    let topic = String(text)
      .replace(/\b\d+\s*(?:slayt|slide)(?:lık|lik|li|lı)?\b/gi, ' ')
      .replace(/\b\d+\s*(?:dakika|dk|minute|min)(?:lık|lik|li|lı)?\b/gi, ' ')
      .replace(/\b(?:bana|lütfen|bir|akademik|profesyonel|detaylı|özet|türkçe|ingilizce|tez|jüri|savunma)\b/gi, ' ')
      .replace(/\b(?:sunum|presentation|deck)\b/gi, ' ')
      .replace(/\b(?:oluştur|hazırla|üret|tasarla|yap|create|generate|build)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const about = String(text).match(/(.+?)\s+hakkında/i);
    if (about?.[1]) topic = about[1].replace(/^(bana|lütfen)\s+/i, '').trim();
    if (topic.length < 3 && p.title && p.title !== 'Adsız Sunum') topic = p.title;

    let sourceType = 'topic';
    let sourceId = '';
    if (p.source_id && ['document', 'study_card'].includes(p.source_type) && /bu\s+(?:belge|pdf|kaynak|study card|kart)|mevcut\s+kaynak/i.test(low)) {
      sourceType = p.source_type;
      sourceId = p.source_id;
    }

    return {
      presentationId: state.presentationId,
      topic: topic.slice(0, 700),
      slideCount,
      targetMinutes,
      mode,
      detailLevel,
      language,
      sourceType,
      sourceId,
      courseTag: p.course_tag || '',
    };
  }

  function isCreateRequest(low) {
    return /(?:sunum|presentation|deck|slaytlık).*(?:oluştur|hazırla|üret|tasarla|yap|create|generate|build)|(?:oluştur|hazırla|üret|tasarla|create|generate|build).*(?:sunum|presentation|deck)|\d+\s*slaytlık/i.test(low);
  }

  async function route(text) {
    const raw = String(text || '').trim();
    if (!raw) return;
    const low = raw.toLocaleLowerCase('tr-TR');
    const state = currentState();
    const agent = Agent();
    const director = Director();

    if (isCreateRequest(low)) {
      if (!state.presentationId) throw new Error('Önce Akademik Sunum bölümünde yeni bir sunum oluştur veya mevcut sunumu aç.');
      if (!director?.generate) throw new Error('Acadia V11 Director henüz yüklenmedi.');
      const options = createOptions(raw);
      if (options.sourceType === 'topic' && options.topic.length < 3) throw new Error('Sunum konusunu biraz daha açık yazar mısın?');
      append('system', 'Acadia V11 çalışıyor: brief → evidence map → slide writer → visual planner → academic critic…');
      const result = await director.generate(options);
      const count = result?.presentation?.slides?.length || currentState().slides?.length || options.slideCount;
      const score = result?.quality?.score;
      return append('assistant', `Sunumu hazırladım: ${count} slayt${score != null ? ` · Academic Quality ${Math.round(score)}/100` : ''}. Sohbetten istediğin değişikliği söyleyebilirsin.`);
    }

    if (/denetle|critic|kalite|quality|sunumu incele/i.test(low)) {
      const quality = await director?.critiqueCurrent?.();
      if (!quality) throw new Error('Academic Critic sonucu alınamadı.');
      return append('assistant', `Sunumu denetledim. Academic Quality: ${Math.round(Number(quality.score || 0))}/100.`);
    }
    if (/kaynak|citation|atıf|referans/i.test(low) && /kontrol|denetle|bak|coverage|destek/i.test(low)) {
      const result = await agent?.execute?.('citation_check');
      return append('assistant', `${result?.message || 'Kaynak kontrolü tamamlandı.'}${result?.score != null ? ` Grounding: ${Math.round(result.score)}/100.` : ''}`);
    }
    if (/konuşmacı\s*not|speaker\s*note|notes/i.test(low)) {
      append('system', 'Konuşmacı notları hazırlanıyor…');
      await agent?.execute?.('generate_speaker_notes');
      return append('assistant', 'Aktif slaydın konuşmacı notlarını güçlendirdim.');
    }
    if (/grafik|chart|görselleştir/i.test(low)) {
      append('system', 'Uygun görsel yapı hazırlanıyor…');
      await agent?.execute?.('create_chart');
      return append('assistant', 'Aktif slaytı görselleştirdim.');
    }
    if (/tablo|table|karşılaştırma/i.test(low) && /ekle|oluştur|yap|dönüştür|görselleştir/i.test(low)) {
      append('system', 'Akademik tablo hazırlanıyor…');
      await agent?.execute?.('create_table');
      return append('assistant', 'Aktif slayta uygun akademik tabloyu oluşturdum.');
    }
    if (/kısalt|daha kısa|short/i.test(low)) {
      append('system', 'Aktif slayt kısaltılıyor…');
      await agent?.execute?.('rewrite_active_slide', { mode: 'short' });
      return append('assistant', 'Aktif slaytı kısalttım; ana mesajı korudum.');
    }
    if (/detaylandır|detailed|genişlet/i.test(low)) {
      append('system', 'Aktif slayt detaylandırılıyor…');
      await agent?.execute?.('rewrite_active_slide', { mode: 'detailed' });
      return append('assistant', 'Aktif slaytı akademik olarak detaylandırdım.');
    }
    if (/tema|arka\s*plan|background|dark|ocean|violet|forest|minimal|corporate/i.test(low)) {
      let theme = null;
      if (/dark|siyah|gece/i.test(low)) theme = 'dark';
      else if (/ocean|mavi/i.test(low)) theme = 'ocean';
      else if (/violet|mor/i.test(low)) theme = 'violet';
      else if (/forest|yeşil|yesil/i.test(low)) theme = 'forest';
      else if (/minimal/i.test(low)) theme = 'minimal';
      else if (/corporate|kurumsal/i.test(low)) theme = 'corporate';
      else if (/academic|akademik/i.test(low)) theme = 'academic';
      if (theme && window.AcadexPresentationThemeV8?.setTheme) {
        window.AcadexPresentationThemeV8.setTheme(theme, { dirty: true });
        return append('assistant', `${theme} temasını uyguladım.`);
      }
    }
    if (/ne yapabilirsin|yardım|help|neler yaparsın/i.test(low)) {
      return append('assistant', 'Sunum oluşturabilir, slaytları düzenleyebilir, grafik/tablo üretebilir, kaynak ve kalite kontrolü yapabilir, konuşmacı notları hazırlayabilirim. Bana normal şekilde ne istediğini yazman yeterli.');
    }
    if (state.slides?.length) {
      append('system', 'İsteğini aktif slayta uyguluyorum…');
      await agent?.improveActiveSlide?.(raw);
      return append('assistant', 'İsteğini aktif slayta uyguladım.');
    }
    append('assistant', 'Sunum üzerinde çalışmaya hazırım. Örneğin “Yapay zekâ etiği hakkında 8 slaytlık akademik sunum oluştur” diyebilirsin.');
  }

  async function handleUser(text) {
    if (busy) return;
    append('user', text);
    setBusy(true);
    try {
      await route(text);
    } catch (error) {
      console.error('Acadia V11 chat error:', error);
      append('error', error?.message || 'Acadia işlemi tamamlayamadı.');
    } finally {
      setBusy(false);
    }
  }

  function interceptForm() {
    const form = document.getElementById('pres-chat-form');
    if (form && form.dataset.v11Bridge !== '1') {
      form.dataset.v11Bridge = '1';
      form.addEventListener('submit', (event) => {
        if (!presentationContext()) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const input = document.getElementById('pres-chat-input');
        const text = String(input?.value || '').trim();
        if (!text) return;
        input.value = '';
        void handleUser(text);
      }, true);
    }

    const quick = document.getElementById('pres-chat-quick');
    if (quick && quick.dataset.v11Bridge !== '1') {
      quick.dataset.v11Bridge = '1';
      quick.addEventListener('click', (event) => {
        if (!presentationContext()) return;
        const chip = event.target.closest('[data-q]');
        if (!chip) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const q = chip.dataset.q || '';
        const input = document.getElementById('pres-chat-input');
        if (q.endsWith(': ') || q.endsWith(':')) {
          if (input) { input.value = q; input.focus(); }
        } else {
          void handleUser(q);
        }
      }, true);
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('#pres-v11-open,#pres-v11-command');
    if (!button || !presentationContext()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openChat();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k' || !presentationContext()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openChat();
  }, true);

  function boot() {
    if (!document.getElementById('presentation-view')) return;
    if (window.AcadexPresentationChatV8) {
      window.AcadexPresentationChatV8.handleUser = handleUser;
      window.AcadexPresentationChatV8.version = '11.1.1-chat';
    }
    interceptForm();
    decorateChat();
    upgradeStudioCard();
  }

  window.AcadiaPresentationChatV11 = {
    version: '11.1.1',
    open: openChat,
    handleUser,
    route,
    presentationContext,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  // Finite retries only. Never observe the whole document: that caused a self-triggering DOM loop.
  [350, 900, 1800, 3200].forEach((ms) => setTimeout(boot, ms));
})();
