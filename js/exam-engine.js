/* ==========================================================================
   ACADEX — SINAV SORU MOTORU (js/exam-engine.js)

   Faz 1 (14.10.2026). Sınav ekranının soru tarafını dashboard.js'ten ayırır.
   Her soru tipi buraya bir KAYIT olarak eklenir (registerType); yeni bir tip
   (ifade, grafik, essay, geometri...) eklemek dashboard.js'e dokunmadan bir
   kayıt + bir giriş bileşeni yazmak demektir.

   Motorun yaptıkları:
     - Soruları tip kaydına göre çizer (giriş bileşeni, cevabı okuma/geri
       yazma, "cevaplandı mı").
     - Soru haritası: numaralı düğmeler; cevaplanan, işaretli ve şu anki
       soru ayrı görünür. Tıklayınca o soruya gider.
     - "Tek tek" ve "hepsi" görünümü (tercih tarayıcıda hatırlanır).
     - İşaretleme ("sonra dönerim").
     - Klavye: ← → soru değiştirir, A–E veya 1–5 şık seçer, F işaretler.
       Metin kutusundayken kısayollar devre dışı.
     - Otomatik kayıt: her değişiklik anında tarayıcıya, birkaç saniyede bir
       de sunucuya (exam_drafts) yazılır; sayfa yenilense de sınav kaldığı
       yerden devam eder.
     - Gönderim öncesi özet: kaç soru boş, kaç soru işaretli.

   İki çalışma biçimi var:
     - mount(exam, opts): motor soruları ve soru haritasını KENDİSİ çizer.
     - attach(exam, opts): "başsız" mod (21.10.2026). Soruları başka bir
       ekran çizer — bugün js/acadex-ink.js'in kitapçık salonu — motor o
       ekranın kartlarına ([data-qi="i"]) bağlanır; cevap okuma/geri yazma,
       otomatik kayıt ve kaldığın yerden devam motordan gelir. Ink'in
       bilmediği yeni bir soru tipi gelirse ink giriş alanını yine buradaki
       kayıttan (getType(tip).renderInput) çizer.

   Saf yardımcılar (computeSummary, computeRemainingSeconds, ...) tarayıcı
   olmadan tests/exam-engine.js tarafından test edilir.
   ========================================================================== */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AcadexExamEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E'];
  const LOCAL_DRAFT_PREFIX = 'acadex_exam_draft_v1:';
  const VIEW_MODE_KEY = 'acadex_exam_view_mode';
  const REMOTE_SAVE_DELAY_MS = 1500;

  // ------------------------------------------------------------------------
  // Saf yardımcılar
  // ------------------------------------------------------------------------

  function defaultEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isAnswerFilled(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
  }

  /** Cevaplanan / boş / işaretli soru özeti. flags: soru id dizisi. */
  function computeSummary(questions, answers, flags) {
    const flagSet = new Set((flags || []).map(String));
    const unanswered = [];
    const flagged = [];
    let answered = 0;
    (questions || []).forEach((q, index) => {
      const key = String(q.id);
      if (isAnswerFilled((answers || {})[key])) answered += 1;
      else unanswered.push(index + 1);
      if (flagSet.has(key)) flagged.push(index + 1);
    });
    return { total: (questions || []).length, answered, unanswered, flagged };
  }

  /** Gönderim öncesi uyarı metni; uyarılacak bir şey yoksa null. */
  function formatSubmitWarning(summary, lang) {
    const tr = lang !== 'en';
    const parts = [];
    if (summary.unanswered.length > 0) {
      parts.push(tr
        ? `${summary.unanswered.length} soru boş (${summary.unanswered.join(', ')})`
        : `${summary.unanswered.length} unanswered (${summary.unanswered.join(', ')})`);
    }
    if (summary.flagged.length > 0) {
      parts.push(tr
        ? `${summary.flagged.length} soru işaretli (${summary.flagged.join(', ')})`
        : `${summary.flagged.length} flagged (${summary.flagged.join(', ')})`);
    }
    if (parts.length === 0) return null;
    return tr
      ? `${parts.join(', ')}. Yine de sınavı göndermek istiyor musun?`
      : `${parts.join(', ')}. Submit the exam anyway?`;
  }

  /** Simülasyonda kalan saniye (sunucudaki started_at'e göre). Süre yoksa null. */
  function computeRemainingSeconds(exam, nowMs) {
    const limit = Number(exam && exam.time_limit_seconds);
    if (!exam || !exam.is_simulation || !(limit > 0)) return null;
    const started = Date.parse(exam.started_at || '');
    if (!Number.isFinite(started)) return Math.floor(limit);
    return Math.max(0, Math.floor((started + limit * 1000 - nowMs) / 1000));
  }

  /** Klavye tuşundan şık sırası: a–e veya 1–5. Değilse -1. */
  function choiceIndexFromKey(key) {
    const k = String(key || '').toLowerCase();
    const letter = ['a', 'b', 'c', 'd', 'e'].indexOf(k);
    if (letter >= 0) return letter;
    if (/^[1-5]$/.test(k)) return Number(k) - 1;
    return -1;
  }

  /** İki taslaktan yenisini seçer (updatedAt ISO). */
  function pickNewerDraft(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const ta = Date.parse(a.updatedAt || '') || 0;
    const tb = Date.parse(b.updatedAt || '') || 0;
    return tb > ta ? b : a;
  }

  /** exam_drafts satırını motorun taslak biçimine çevirir. */
  function draftFromRow(row) {
    if (!row) return null;
    return {
      answers: row.answers && typeof row.answers === 'object' ? row.answers : {},
      flags: Array.isArray(row.flags) ? row.flags.map(String) : [],
      current: Number.isInteger(row.current_index) ? row.current_index : 0,
      mode: row.view_mode === 'single' || row.view_mode === 'all' ? row.view_mode : null,
      updatedAt: row.updated_at || null
    };
  }

  function localDraftKey(userId, examId) {
    return `${LOCAL_DRAFT_PREFIX}${userId || 'anon'}:${examId}`;
  }

  function readLocalDraft(userId, examId) {
    try {
      const raw = localStorage.getItem(localDraftKey(userId, examId));
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  }

  function removeLocalDraft(userId, examId) {
    try { localStorage.removeItem(localDraftKey(userId, examId)); } catch (_e) { /* yok say */ }
  }

  /** Bu kullanıcının tarayıcıdaki taslakları: [{ examId, draft }]. */
  function listLocalDrafts(userId) {
    const out = [];
    try {
      const prefix = `${LOCAL_DRAFT_PREFIX}${userId || 'anon'}:`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(prefix)) continue;
        try {
          out.push({ examId: key.slice(prefix.length), draft: JSON.parse(localStorage.getItem(key)) });
        } catch (_e) { /* bozuk kayıt: atla */ }
      }
    } catch (_e) { /* localStorage yok */ }
    return out;
  }

  // ------------------------------------------------------------------------
  // Soru tipi kayıtları
  // ------------------------------------------------------------------------
  // Her kayıt:
  //   renderInput(q, ctx)       -> HTML (ctx: { esc, math, lang, name })
  //   readAnswer(card, q)       -> string
  //   writeAnswer(card, q, val) -> taslaktan geri yükleme
  //   choiceInputs(card)        -> (isteğe bağlı) klavyeyle seçilebilir şıklar

  const types = {};

  function registerType(name, def) {
    types[name] = def;
  }

  function getType(name) {
    return types[name] || types.open_ended;
  }

  /** Tip gerçekten kayıtlı mı (getType bilinmeyende open_ended'a düşer). */
  function hasType(name) {
    return Object.prototype.hasOwnProperty.call(types, name);
  }

  const choiceType = {
    renderInput(q, ctx) {
      const options = Array.isArray(q.options) ? q.options : [];
      const items = options.map((opt, i) => {
        const id = `q-${q.id}-opt-${i}`;
        const letter = CHOICE_LETTERS[i] || String(i + 1);
        return `
          <label class="exam-choice-label" id="label-${id}">
            <input type="radio" name="${ctx.name}" value="${ctx.esc(String(opt))}">
            <span class="exam-choice-letter" aria-hidden="true">${letter}</span>
            <span>${ctx.math(String(opt))}</span>
          </label>`;
      }).join('');
      return `<div class="exam-choice-list" role="radiogroup">${items}</div>`;
    },
    readAnswer(card, q) {
      const checked = card.querySelector(`input[name="answer-q-${q.id}"]:checked`);
      return checked ? checked.value : '';
    },
    writeAnswer(card, q, value) {
      card.querySelectorAll(`input[name="answer-q-${q.id}"]`).forEach(input => {
        input.checked = input.value === String(value ?? '');
      });
      syncChoiceHighlight(card);
    },
    choiceInputs(card) {
      return Array.from(card.querySelectorAll('input[type="radio"]'));
    }
  };

  function syncChoiceHighlight(card) {
    card.querySelectorAll('.exam-choice-label').forEach(label => {
      const input = label.querySelector('input[type="radio"]');
      label.classList.toggle('selected', !!(input && input.checked));
    });
  }

  const textValue = {
    readAnswer(card, q) {
      const input = card.querySelector(`[name="answer-q-${q.id}"]`);
      return input ? input.value : '';
    },
    writeAnswer(card, q, value) {
      const input = card.querySelector(`[name="answer-q-${q.id}"]`);
      if (input) input.value = value == null ? '' : String(value);
    }
  };

  registerType('multiple_choice', choiceType);
  registerType('true_false', choiceType);

  registerType('fill_blank', {
    ...textValue,
    renderInput(q, ctx) {
      const ph = ctx.lang === 'tr' ? 'Cevabınızı girin...' : 'Enter your answer...';
      return `<div class="exam-input-row"><input type="text" name="${ctx.name}" class="search-input exam-text-input" autocomplete="off" placeholder="${ph}"></div>`;
    }
  });

  registerType('calculation', {
    ...textValue,
    renderInput(q, ctx) {
      const units = q.units ? String(q.units) : '';
      const isPrefix = units === '$' || units === '€' || units === '₺';
      const ph = ctx.lang === 'tr' ? 'Sayısal cevabınız...' : 'Your numeric answer...';
      return `
        <div class="calculation-input-wrapper">
          ${isPrefix ? `<span class="calculation-unit">${ctx.esc(units)}</span>` : ''}
          <input type="number" step="any" name="${ctx.name}" class="calculation-input" placeholder="${ph}">
          ${!isPrefix && units ? `<span class="calculation-unit">${ctx.esc(units)}</span>` : ''}
        </div>`;
    }
  });

  // FAZ 3b: cebirsel ifade. Metin alanı + sembol tuşları + KaTeX önizleme;
  // cevap öğrencinin yazdığı metin (sunucu aynı kuralla açar ve denkliğe bakar).
  registerType('expression', {
    ...textValue,
    renderInput(q, ctx) {
      const tr = ctx.lang !== 'en';
      const vars = exprVarsOf(q);
      const fnKey = k => (k === '√' ? '√(' : ['sin', 'cos', 'ln'].includes(k) ? k + '(' : k);
      const keys = [...vars, '^', '√', 'π', '(', ')', '/', 'sin', 'cos', 'ln'];
      const forms = tr
        ? { factored: 'çarpanlarına ayrılmış biçimde yaz', expanded: 'parantezleri açarak yaz', simplified: 'en sade biçimde yaz' }
        : { factored: 'write it in factored form', expanded: 'write it expanded (no brackets)', simplified: 'write it in simplest form' };
      const note = forms[q.form] || '';
      return `
        <div class="axe-expr" data-expr-vars="${ctx.esc(vars.join(','))}" data-lang="${tr ? 'tr' : 'en'}">
          <input type="text" name="${ctx.name}" class="axe-expr-in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="${MATH_INPUT_MAX}" placeholder="${tr ? 'ör. 2x(x+1)' : 'e.g. 2x(x+1)'}" aria-label="${tr ? 'İfade cevabı' : 'Expression answer'}">
          <div class="axe-expr-keys" role="group" aria-label="${tr ? 'Sembol ekle' : 'Insert symbol'}">${keys.map(k => `<button type="button" data-expr-key="${ctx.esc(fnKey(k))}">${ctx.esc(k)}</button>`).join('')}</div>
          <div class="axe-expr-pv" aria-live="polite">${tr ? 'yazdıkça burada matematik olarak görünür' : 'your expression appears here as you type'}</div>
          ${note ? `<p class="axe-expr-note">${note}</p>` : ''}
        </div>`;
    },
    writeAnswer(card, q, value) {
      textValue.writeAnswer(card, q, value);
      const box = card.querySelector('.axe-expr');
      if (box) exprRefresh(box);
    }
  });

  registerType('open_ended', {
    ...textValue,
    renderInput(q, ctx) {
      const ph = ctx.lang === 'tr' ? 'Cevabınızı buraya yazın...' : 'Write your answer here...';
      return `<div class="exam-input-row"><textarea name="${ctx.name}" class="search-input exam-textarea" rows="4" placeholder="${ph}"></textarea></div>`;
    }
  });

  // ------------------------------------------------------------------------
  // Aktif sınav (aynı anda tek sınav)
  // ------------------------------------------------------------------------

  let active = null;

  function t(key) {
    const tr = !active || active.lang !== 'en';
    const dict = {
      question: tr ? 'Soru' : 'Question',
      flag: tr ? 'İşaretle' : 'Flag',
      unflag: tr ? 'İşareti kaldır' : 'Unflag',
      prev: tr ? '← Önceki' : '← Previous',
      next: tr ? 'Sonraki →' : 'Next →',
      single: tr ? 'Tek tek göster' : 'One at a time',
      all: tr ? 'Hepsini göster' : 'Show all',
      map: tr ? 'Soru haritası' : 'Question map',
      answered: tr ? 'cevaplandı' : 'answered',
      legend: tr ? 'Dolu: cevaplandı · Sarı: işaretli' : 'Filled: answered · Amber: flagged',
      keys: tr ? 'Kısayollar: ← → soru, A–E şık, F işaret' : 'Keys: ← → question, A–E option, F flag',
      saved: tr ? 'Kaydedildi' : 'Saved'
    };
    return dict[key] || key;
  }

  function preferredMode() {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === 'single' || saved === 'all') return saved;
    } catch (_e) { /* yok say */ }
    return (typeof window !== 'undefined' && window.innerWidth < 720) ? 'single' : 'all';
  }

  function cardFor(index) {
    if (!active) return null;
    if (active.headless) return active.container.querySelector(active.cardSelector(index));
    return active.container.querySelector(`.exam-question-card[data-index="${index}"]`);
  }

  /** Başsız modda işaretler ekranın kendi düğmelerinden okunur
   *  ([data-flag][aria-pressed="true"]); motor ayrıca tutmaz. */
  function currentFlags() {
    if (!active) return [];
    if (!active.headless) return Array.from(active.flags);
    const out = [];
    active.questions.forEach((q, i) => {
      const card = cardFor(i);
      const btn = card && card.querySelector(active.flagSelector);
      if (btn && btn.getAttribute('aria-pressed') === 'true') out.push(String(q.id));
    });
    return out;
  }

  function currentIndex() {
    if (active && active.headless && typeof active.getCurrent === 'function') {
      const i = Number(active.getCurrent());
      return Number.isInteger(i) && i >= 0 ? i : 0;
    }
    return active ? active.current : 0;
  }

  function readAll() {
    const answers = {};
    active.questions.forEach((q, i) => {
      const card = cardFor(i);
      answers[String(q.id)] = card ? getType(q.type).readAnswer(card, q) : (active.answers[String(q.id)] || '');
    });
    return answers;
  }

  function snapshot() {
    return {
      answers: readAll(),
      flags: currentFlags(),
      current: currentIndex(),
      mode: active.mode,
      updatedAt: new Date().toISOString()
    };
  }

  function saveLocal() {
    if (!active) return;
    try {
      localStorage.setItem(localDraftKey(active.userId, active.exam.id), JSON.stringify(snapshot()));
    } catch (_e) { /* localStorage dolu ya da yok: sunucu kaydı yeter */ }
  }

  function scheduleRemoteSave() {
    if (!active || typeof active.saveRemote !== 'function') return;
    clearTimeout(active.saveTimer);
    active.saveTimer = setTimeout(flushRemote, REMOTE_SAVE_DELAY_MS);
  }

  async function flushRemote() {
    if (!active || typeof active.saveRemote !== 'function') return;
    clearTimeout(active.saveTimer);
    const snap = snapshot();
    try {
      await active.saveRemote(snap);
      if (active) setSaveStatus(t('saved'));
    } catch (e) {
      console.warn('exam-engine: taslak sunucuya yazilamadi (yerel kayit duruyor):', e);
    }
  }

  function setSaveStatus(text) {
    const el = active && active.nav ? active.nav.querySelector('.exam-nav-save') : null;
    if (el) el.textContent = text;
  }

  function onAnswerChanged(index) {
    const q = active.questions[index];
    const card = cardFor(index);
    if (!q || !card) return;
    active.answers[String(q.id)] = getType(q.type).readAnswer(card, q);
    if (getType(q.type).choiceInputs) syncChoiceHighlight(card);
    renderNav();
    saveLocal();
    scheduleRemoteSave();
  }

  function setCurrent(index, opts = {}) {
    if (!active) return;
    const max = active.questions.length - 1;
    active.current = Math.max(0, Math.min(max, index));
    applyMode();
    renderNav();
    saveLocal();
    if (opts.scroll) {
      const card = cardFor(active.current);
      if (card && typeof card.scrollIntoView === 'function') card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (opts.focus) {
      const card = cardFor(active.current);
      const first = card && card.querySelector('input, textarea');
      if (first && first.type !== 'radio') first.focus({ preventScroll: true });
    }
  }

  function toggleFlag(index) {
    const q = active.questions[index];
    if (!q) return;
    const key = String(q.id);
    if (active.flags.has(key)) active.flags.delete(key);
    else active.flags.add(key);
    const card = cardFor(index);
    const btn = card && card.querySelector('[data-exam-action="flag"]');
    if (btn) {
      const on = active.flags.has(key);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? t('unflag') : t('flag');
      card.classList.toggle('is-flagged', on);
    }
    renderNav();
    saveLocal();
    scheduleRemoteSave();
  }

  function setMode(mode) {
    active.mode = mode === 'single' ? 'single' : 'all';
    try { localStorage.setItem(VIEW_MODE_KEY, active.mode); } catch (_e) { /* yok say */ }
    applyMode();
    renderNav();
    saveLocal();
  }

  function applyMode() {
    const single = active.mode === 'single';
    active.container.classList.toggle('exam-mode-single', single);
    active.questions.forEach((_q, i) => {
      const card = cardFor(i);
      if (!card) return;
      card.hidden = single && i !== active.current;
      card.classList.toggle('is-current', i === active.current);
    });
  }

  function renderNav() {
    if (!active || !active.nav) return;
    const answers = active.answers;
    const summary = computeSummary(active.questions, answers, Array.from(active.flags));
    const buttons = active.questions.map((q, i) => {
      const key = String(q.id);
      const cls = [
        'exam-nav-btn',
        isAnswerFilled(answers[key]) ? 'is-answered' : '',
        active.flags.has(key) ? 'is-flagged' : '',
        i === active.current ? 'is-current' : ''
      ].filter(Boolean).join(' ');
      const label = `${t('question')} ${i + 1}`;
      return `<button type="button" class="${cls}" data-exam-action="jump" data-index="${i}" aria-label="${label}"${i === active.current ? ' aria-current="true"' : ''}>${i + 1}</button>`;
    }).join('');
    const modeLabel = active.mode === 'single' ? t('all') : t('single');
    const prevSave = active.nav.querySelector('.exam-nav-save');
    const saveText = prevSave ? prevSave.textContent : '';
    active.nav.innerHTML = `
      <div class="exam-navigator" role="navigation" aria-label="${t('map')}">
        <div class="exam-nav-head">
          <strong class="exam-nav-title">${t('map')}</strong>
          <span class="exam-nav-count">${summary.answered} / ${summary.total} ${t('answered')}</span>
          <span class="exam-nav-save" aria-live="polite">${saveText}</span>
          <button type="button" class="btn btn-outline exam-nav-mode" data-exam-action="mode">${modeLabel}</button>
        </div>
        <div class="exam-nav-grid">${buttons}</div>
        <div class="exam-nav-legend">${t('legend')} · ${t('keys')}</div>
      </div>`;
  }

  function buildCards() {
    const ctxBase = { esc: active.esc, math: active.math, lang: active.lang };
    const total = active.questions.length;
    active.container.innerHTML = active.questions.map((q, i) => {
      const type = getType(q.type);
      const input = type.renderInput(q, { ...ctxBase, name: `answer-q-${q.id}` });
      const hintBtn = active.renderHintButton ? active.renderHintButton(q) : '';
      return `
        <div class="exam-question-card" id="question-card-${q.id}" data-index="${i}" data-qid="${active.esc(String(q.id))}">
          <div class="exam-q-head">
            <span class="exam-question-text">${t('question')} ${i + 1}: ${active.math(String(q.question || ''))}</span>
            <div class="exam-q-actions">
              ${hintBtn}
              <button type="button" class="btn btn-outline exam-flag-btn" data-exam-action="flag" aria-pressed="false">${t('flag')}</button>
            </div>
          </div>
          <div id="hint-box-${q.id}" class="exam-hint-box" style="display: none;"></div>
          ${input}
          <div class="exam-single-nav">
            <button type="button" class="btn btn-outline" data-exam-action="prev" ${i === 0 ? 'disabled' : ''}>${t('prev')}</button>
            <span class="exam-single-pos">${i + 1} / ${total}</span>
            <button type="button" class="btn btn-outline" data-exam-action="next" ${i === total - 1 ? 'disabled' : ''}>${t('next')}</button>
          </div>
        </div>`;
    }).join('');
  }

  function indexOfCard(el) {
    const card = el && el.closest ? el.closest('.exam-question-card') : null;
    return card ? Number(card.dataset.index) : -1;
  }

  function onClick(e) {
    const target = e.target.closest ? e.target.closest('[data-exam-action]') : null;
    if (!target) {
      const idx = indexOfCard(e.target);
      if (idx >= 0 && idx !== active.current && active.mode === 'all') { active.current = idx; applyMode(); renderNav(); }
      return;
    }
    const action = target.dataset.examAction;
    if (action === 'jump') setCurrent(Number(target.dataset.index), { scroll: active.mode === 'all', focus: true });
    else if (action === 'mode') setMode(active.mode === 'single' ? 'all' : 'single');
    else if (action === 'flag') toggleFlag(indexOfCard(target));
    else if (action === 'prev') setCurrent(active.current - 1, { focus: true });
    else if (action === 'next') setCurrent(active.current + 1, { focus: true });
  }

  function onInput(e) {
    if (active.headless) {
      const hIdx = headlessIndexOf(e.target);
      if (hIdx >= 0) onAnswerChanged(hIdx);
      return;
    }
    const idx = indexOfCard(e.target);
    if (idx < 0) return;
    if (idx !== active.current) { active.current = idx; applyMode(); }
    onAnswerChanged(idx);
  }

  function onKeyDown(e) {
    if (!active || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target;
    const tag = el && el.tagName ? el.tagName.toLowerCase() : '';
    const typing = tag === 'textarea' || tag === 'select' || (el && el.isContentEditable) ||
      (tag === 'input' && el.type !== 'radio' && el.type !== 'checkbox');
    if (typing) return;
    // Bir onay penceresi açıkken kısayolları devre dışı bırak.
    if (document.querySelector('.modal.active, .modal-overlay.active')) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (tag === 'input') return; // radyo düğmesinde ok tuşu tarayıcının kendi seçim davranışı
      e.preventDefault();
      setCurrent(active.current + (e.key === 'ArrowRight' ? 1 : -1), { scroll: active.mode === 'all' });
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFlag(active.current);
      return;
    }
    const choice = choiceIndexFromKey(e.key);
    if (choice >= 0) {
      const q = active.questions[active.current];
      const type = getType(q && q.type);
      const card = cardFor(active.current);
      if (!type.choiceInputs || !card) return;
      const inputs = type.choiceInputs(card);
      if (!inputs[choice]) return;
      e.preventDefault();
      inputs[choice].checked = true;
      onAnswerChanged(active.current);
    }
  }

  function headlessIndexOf(el) {
    for (let i = 0; i < active.questions.length; i++) {
      const card = cardFor(i);
      if (card && card.contains(el)) return i;
    }
    return -1;
  }

  // Başsız mod: işaret düğmesini ekran kendisi çeviriyor; motor yalnızca
  // tıklamadan sonra (ekranın dinleyicisi çalıştıktan sonra) kaydeder.
  function onHeadlessClick(e) {
    const btn = e.target && e.target.closest ? e.target.closest(active.flagSelector) : null;
    if (!btn || !active.container.contains(btn)) return;
    setTimeout(save, 0);
  }

  /** Taslağı hemen tarayıcıya, kısa bir gecikmeyle sunucuya yazar. */
  function save() {
    if (!active) return;
    saveLocal();
    scheduleRemoteSave();
  }

  function onPageHide() {
    saveLocal();
    flushRemote();
  }

  /**
   * Sınavı çizer.
   * opts: { container, navContainer, userId, lang, draft, escape, renderMath,
   *         renderHintButton(q), saveRemote(snapshot) }
   */
  function mount(exam, opts) {
    destroy();
    const esc = typeof opts.escape === 'function' ? opts.escape : defaultEscape;
    active = {
      exam,
      questions: Array.isArray(exam.questions) ? exam.questions : [],
      container: opts.container,
      nav: opts.navContainer || null,
      userId: opts.userId || null,
      lang: opts.lang || exam.language || 'tr',
      esc,
      math: typeof opts.renderMath === 'function' ? opts.renderMath : esc,
      renderHintButton: opts.renderHintButton || null,
      saveRemote: opts.saveRemote || null,
      answers: {},
      flags: new Set(),
      current: 0,
      mode: preferredMode(),
      saveTimer: null
    };

    buildCards();

    const draft = opts.draft || null;
    if (draft) {
      active.questions.forEach((q, i) => {
        const value = draft.answers ? draft.answers[String(q.id)] : undefined;
        if (value !== undefined) getType(q.type).writeAnswer(cardFor(i), q, value);
      });
      (draft.flags || []).forEach(id => {
        const index = active.questions.findIndex(q => String(q.id) === String(id));
        if (index >= 0) toggleFlag(index);
      });
      if (draft.mode === 'single' || draft.mode === 'all') active.mode = draft.mode;
      if (Number.isInteger(draft.current)) active.current = Math.max(0, Math.min(active.questions.length - 1, draft.current));
    }
    active.answers = readAll();

    active.container.addEventListener('click', onClick);
    active.container.addEventListener('change', onInput);
    active.container.addEventListener('input', onInput);
    if (active.nav) active.nav.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);

    applyMode();
    renderNav();
    return api;
  }

  /**
   * Başsız mod: soruları başka bir ekran çizer (ör. js/acadex-ink.js
   * kitapçığı); motor yalnızca cevap okuma/yazma, otomatik kayıt ve
   * taslaktan geri yükleme yapar. Soru haritası, klavye ve görünüm o ekranın.
   *
   * opts: { root, userId, lang, draft, saveRemote(snapshot),
   *         cardSelector(i) -> CSS seçici (varsayılan [data-qi="i"]),
   *         flagSelector (varsayılan [data-flag]),
   *         getCurrent() -> o an açık sorunun sırası,
   *         writeFlag(button, on) -> taslaktan işaret geri yüklenince
   *                                  düğmenin yazısını ekran günceller }
   */
  function attach(exam, opts) {
    destroy();
    active = {
      headless: true,
      exam,
      questions: Array.isArray(exam.questions) ? exam.questions : [],
      container: opts.root,
      nav: null,
      userId: opts.userId || null,
      lang: opts.lang || exam.language || 'tr',
      esc: defaultEscape,
      math: defaultEscape,
      renderHintButton: null,
      saveRemote: opts.saveRemote || null,
      answers: {},
      flags: new Set(),
      current: 0,
      mode: null,
      saveTimer: null,
      cardSelector: typeof opts.cardSelector === 'function' ? opts.cardSelector : (i => `[data-qi="${i}"]`),
      flagSelector: opts.flagSelector || '[data-flag]',
      getCurrent: opts.getCurrent || null,
      writeFlag: typeof opts.writeFlag === 'function' ? opts.writeFlag : null
    };

    const draft = opts.draft || null;
    if (draft) {
      active.questions.forEach((q, i) => {
        const value = draft.answers ? draft.answers[String(q.id)] : undefined;
        const card = cardFor(i);
        if (value !== undefined && card) getType(q.type).writeAnswer(card, q, value);
      });
      const flagged = new Set((draft.flags || []).map(String));
      active.questions.forEach((q, i) => {
        if (!flagged.has(String(q.id))) return;
        const card = cardFor(i);
        const btn = card && card.querySelector(active.flagSelector);
        if (!btn) return;
        btn.setAttribute('aria-pressed', 'true');
        if (active.writeFlag) active.writeFlag(btn, true);
      });
    }
    active.answers = readAll();

    active.container.addEventListener('change', onInput);
    active.container.addEventListener('input', onInput);
    active.container.addEventListener('click', onHeadlessClick);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return api;
  }

  function isHeadless() {
    return !!(active && active.headless);
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') onPageHide();
  }

  function destroy() {
    if (!active) return;
    clearTimeout(active.saveTimer);
    active.container.removeEventListener('click', onHeadlessClick);
    active.container.removeEventListener('click', onClick);
    active.container.removeEventListener('change', onInput);
    active.container.removeEventListener('input', onInput);
    if (active.nav) {
      active.nav.removeEventListener('click', onClick);
      active.nav.innerHTML = '';
    }
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibility);
    active = null;
  }

  /** Sınavın taslağını (yerel) siler ve motoru kapatır. Sunucu taslağını
   *  silmek çağıranın işi (grade-exam puanlarken zaten siliyor). */
  function discardDraft(userId, examId) {
    removeLocalDraft(userId, examId);
    if (active && String(active.exam.id) === String(examId)) {
      clearTimeout(active.saveTimer);
      active.saveRemote = null;
    }
  }

  function collectAnswers() {
    return active ? readAll() : {};
  }

  function getSummary() {
    if (!active) return computeSummary([], {}, []);
    return computeSummary(active.questions, readAll(), currentFlags());
  }

  function getFlags() {
    return currentFlags();
  }

  function isActive() {
    return !!active;
  }

  // ------------------------------------------------------------------------
  // FAZ 3a: kodla doğrulanmış hesap sorusunda "farklı sayılarla tekrar dene".
  // evaluateExpression / sanitizeVariables, supabase/functions/grade-exam
  // ve generate-exam'deki TypeScript kopyasından derlendi;
  // tests/exam-calc.js iki tarafı aynı test vektörleriyle denetler.
  // ------------------------------------------------------------------------
  "use strict";
  // ==========================================================================
  // FAZ 3a — KODLA DOĞRULANAN HESAP: güvenli ifade hesaplayıcı (22.10.2026)
  //
  // Model hesap sorusu için değişkenleri ve formülü yazar, cevabı burada kod
  // hesaplar. eval YOK: yalnızca sayılar, değişken adları, + - * / ^ (ya da
  // **), parantez ve aşağıdaki fonksiyonlar. Herhangi bir hata NaN döner.
  // generate-exam ve grade-exam'de BİREBİR aynı (tests/exam-calc.js denetler);
  // tarayıcı kopyası js/exam-engine.js'te, aynı test vektörleriyle denetlenir.
  // ==========================================================================
  const EXPR_MAX_LENGTH = 400;
  const EXPR_MAX_DEPTH = 40;
  const EXPR_CONSTS = { pi: Math.PI, e: Math.E };
  const EXPR_FUNCS = {
      sqrt: { min: 1, max: 1, fn: Math.sqrt },
      abs: { min: 1, max: 1, fn: Math.abs },
      ln: { min: 1, max: 1, fn: Math.log },
      log: { min: 1, max: 1, fn: Math.log10 },
      log10: { min: 1, max: 1, fn: Math.log10 },
      exp: { min: 1, max: 1, fn: Math.exp },
      floor: { min: 1, max: 1, fn: Math.floor },
      ceil: { min: 1, max: 1, fn: Math.ceil },
      min: { min: 1, max: 12, fn: Math.min },
      max: { min: 1, max: 12, fn: Math.max },
      pow: { min: 2, max: 2, fn: Math.pow },
      round: { min: 1, max: 2, fn: (x, d = 0) => { const f = Math.pow(10, Math.round(d)); return Math.round(x * f) / f; } },
      // Finans (Excel adları, işaretsiz: tutarlar pozitif döner). rate dönem faizi
      // (0.005 gibi), nper dönem sayısı. npv Excel gibi ilk akışı 1. dönem sayar.
      pmt: { min: 3, max: 3, fn: (r, n, p) => Math.abs(r === 0 ? p / n : p * r / (1 - Math.pow(1 + r, -n))) },
      pv: { min: 3, max: 3, fn: (r, n, a) => Math.abs(r === 0 ? a * n : a * (1 - Math.pow(1 + r, -n)) / r) },
      fv: { min: 3, max: 4, fn: (r, n, a, p = 0) => r === 0 ? Math.abs(a) * n + Math.abs(p) : Math.abs(a) * (Math.pow(1 + r, n) - 1) / r + Math.abs(p) * Math.pow(1 + r, n) },
      npv: { min: 2, max: 13, fn: (r, ...cf) => cf.reduce((s, c, i) => s + c / Math.pow(1 + r, i + 1), 0) },
      // Faz 3b: cebirsel ifadeler için trigonometri (radyan).
      sin: { min: 1, max: 1, fn: Math.sin },
      cos: { min: 1, max: 1, fn: Math.cos },
      tan: { min: 1, max: 1, fn: Math.tan },
      asin: { min: 1, max: 1, fn: Math.asin },
      acos: { min: 1, max: 1, fn: Math.acos },
      atan: { min: 1, max: 1, fn: Math.atan }
  };
  /** Formülü değişkenlerle hesaplar. Geçersiz ifade, bilinmeyen ad, sonsuz
   *  ya da tanımsız sonuç → NaN. */
  function evaluateExpression(src, vars) {
      const text = String(src ?? '');
      if (!text.trim() || text.length > EXPR_MAX_LENGTH)
          return NaN;
      const tokens = [];
      const re = /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|[-+*/^(),]))/y;
      let pos = 0;
      while (pos < text.length) {
          if (/^\s*$/.test(text.slice(pos)))
              break;
          re.lastIndex = pos;
          const m = re.exec(text);
          if (!m)
              return NaN;
          if (m[1] !== undefined)
              tokens.push({ t: 'num', v: m[1] });
          else if (m[2] !== undefined)
              tokens.push({ t: 'id', v: m[2] });
          else
              tokens.push({ t: 'op', v: m[3] === '**' ? '^' : m[3] });
          pos = re.lastIndex;
      }
      let i = 0;
      const peek = () => tokens[i];
      const isOp = (v) => !!tokens[i] && tokens[i].t === 'op' && tokens[i].v === v;
      const fail = () => { throw new Error('expr'); };
      const expr = (d) => {
          if (d > EXPR_MAX_DEPTH)
              fail();
          let v = term(d + 1);
          while (isOp('+') || isOp('-')) {
              const op = tokens[i++].v;
              const r = term(d + 1);
              v = op === '+' ? v + r : v - r;
          }
          return v;
      };
      const term = (d) => {
          let v = unary(d + 1);
          while (isOp('*') || isOp('/')) {
              const op = tokens[i++].v;
              const r = unary(d + 1);
              v = op === '*' ? v * r : v / r;
          }
          return v;
      };
      const unary = (d) => {
          if (d > EXPR_MAX_DEPTH)
              fail();
          if (isOp('-')) {
              i++;
              return -unary(d + 1);
          }
          if (isOp('+')) {
              i++;
              return unary(d + 1);
          }
          return power(d + 1);
      };
      const power = (d) => {
          const base = primary(d + 1);
          if (isOp('^')) {
              i++;
              return Math.pow(base, unary(d + 1));
          }
          return base;
      };
      const primary = (d) => {
          if (d > EXPR_MAX_DEPTH)
              fail();
          const tk = peek();
          if (!tk)
              return fail();
          if (tk.t === 'num') {
              i++;
              return Number(tk.v);
          }
          if (tk.t === 'op' && tk.v === '(') {
              i++;
              const v = expr(d + 1);
              if (!isOp(')'))
                  fail();
              i++;
              return v;
          }
          if (tk.t === 'id') {
              i++;
              if (isOp('(')) {
                  const fname = tk.v.toLowerCase();
                  const f = Object.prototype.hasOwnProperty.call(EXPR_FUNCS, fname) ? EXPR_FUNCS[fname] : null;
                  if (!f)
                      fail();
                  i++;
                  const args = [];
                  if (!isOp(')')) {
                      args.push(expr(d + 1));
                      while (isOp(',')) {
                          i++;
                          args.push(expr(d + 1));
                      }
                  }
                  if (!isOp(')'))
                      fail();
                  i++;
                  if (args.length < f.min || args.length > f.max)
                      fail();
                  return f.fn(...args);
              }
              if (Object.prototype.hasOwnProperty.call(vars, tk.v))
                  return Number(vars[tk.v]);
              if (Object.prototype.hasOwnProperty.call(EXPR_CONSTS, tk.v))
                  return EXPR_CONSTS[tk.v];
              return fail();
          }
          return fail();
      };
      try {
          const v = expr(0);
          if (i !== tokens.length)
              return NaN;
          return Number.isFinite(v) ? v : NaN;
      }
      catch (_e) {
          return NaN;
      }
  }
  /** Modelin verdiği değişkenler: ad → sonlu sayı. Geçersiz ad ya da değer
   *  atılır; sabit adları (pi, e) değişken olamaz. Fonksiyon adı değişken
   *  olabilir (PV gibi): ayrıştırıcı "ad(" ile "ad"ı ayırır. En fazla 10. */
  function sanitizeVariables(raw) {
      const out = {};
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
          return out;
      for (const [k, v] of Object.entries(raw)) {
          if (!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(k))
              continue;
          if (Object.prototype.hasOwnProperty.call(EXPR_CONSTS, k))
              continue;
          const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
          if (!Number.isFinite(n))
              continue;
          out[k] = n;
          if (Object.keys(out).length >= 10)
              break;
      }
      return out;
  }

  // FAZ 3b: öğrenci ifade yazımı — grade-exam'deki normalizeMathInput'un
  // TypeScript'ten çevrilmiş birebir kopyası (tests/exam-expression.js).
  const MATH_INPUT_MAX = 200;
  function normalizeMathInput(src, varNames) {
      let s = String(src ?? '').trim();
      if (!s || s.length > MATH_INPUT_MAX)
          return '';
      s = s.replace(/[·×∙⋅]/g, '*').replace(/÷/g, '/').replace(/[−–—]/g, '-')
          .replace(/π/g, ' pi ').replace(/√/g, ' sqrt ').replace(/²/g, '^2').replace(/³/g, '^3')
          .replace(/[[{]/g, '(').replace(/[\]}]/g, ')').replace(/(\d),(\d)/g, '$1.$2');
      const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
      const vars = (Array.isArray(varNames) ? varNames : []).filter(v => typeof v === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v));
      const words = [...vars, ...Object.keys(EXPR_FUNCS), ...Object.keys(EXPR_CONSTS)].sort((a, b) => b.length - a.length);
      const raw = [];
      const re = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|[-+*/^(),]))/y;
      let pos = 0;
      while (pos < s.length) {
          if (/^\s*$/.test(s.slice(pos)))
              break;
          re.lastIndex = pos;
          const m = re.exec(s);
          if (!m)
              return '';
          pos = re.lastIndex;
          if (m[1] !== undefined) {
              raw.push({ k: 'num', v: m[1] });
              continue;
          }
          if (m[3] !== undefined) {
              const o = m[3] === '**' ? '^' : m[3];
              raw.push({ k: o === '(' ? 'lp' : o === ')' ? 'rp' : o === ',' ? 'comma' : 'op', v: o });
              continue;
          }
          // Ad: değişken, fonksiyon ya da sabit; bitişik yazılmışsa ("xsinx",
          // "2pix") en uzun eşleşmeyle parçalanır. Parçalanamayan ad okunamaz.
          let id = m[2];
          while (id) {
              const low = id.toLowerCase();
              const w = words.find(x => (has(EXPR_FUNCS, x) && !vars.includes(x)) ? low.startsWith(x) : id.startsWith(x));
              if (!w)
                  return '';
              raw.push(has(EXPR_FUNCS, w) && !vars.includes(w) ? { k: 'fn', v: w } : { k: 'var', v: w });
              id = id.slice(w.length);
          }
      }
      const out = [];
      const push = (t) => {
          const p = out[out.length - 1];
          const endsAtom = !!p && (p.k === 'num' || p.k === 'var' || p.k === 'rp');
          const startsAtom = t.k === 'var' || t.k === 'fn' || t.k === 'lp' || (t.k === 'num' && !!p && p.k !== 'num');
          if (endsAtom && startsAtom)
              out.push({ k: 'op', v: '*' });
          out.push(t);
      };
      for (let i = 0; i < raw.length; i++) {
          const t = raw[i];
          const nx = raw[i + 1];
          // Üslü fonksiyon: "sin²x", "cos^2(x)" → sin(x)^2.
          if (t.k === 'fn' && nx && nx.k === 'op' && nx.v === '^' && raw[i + 2] && raw[i + 2].k === 'num' && raw[i + 3]) {
              const ex = raw[i + 2];
              let j = i + 3;
              let arg;
              if (raw[j].k === 'lp') {
                  let depth = 0;
                  let e = j;
                  for (; e < raw.length; e++) {
                      if (raw[e].k === 'lp')
                          depth++;
                      else if (raw[e].k === 'rp' && --depth === 0)
                          break;
                  }
                  if (e >= raw.length)
                      return '';
                  arg = raw.slice(j + 1, e);
                  j = e;
              }
              else if (raw[j].k === 'num' || raw[j].k === 'var') {
                  arg = [raw[j]];
              }
              else
                  return '';
              push(t);
              push({ k: 'lp', v: '(' });
              for (const a of arg)
                  push(a);
              push({ k: 'rp', v: ')' });
              push(nx);
              push(ex);
              i = j;
              continue;
          }
          // Parantezsiz fonksiyon: "sin x", "ln2" → sin(x), ln(2) (yalnızca tek terim).
          if (t.k === 'fn' && nx && nx.k !== 'lp') {
              if (nx.k !== 'num' && nx.k !== 'var')
                  return '';
              push(t);
              push({ k: 'lp', v: '(' });
              push(nx);
              push({ k: 'rp', v: ')' });
              i++;
              continue;
          }
          push(t);
      }
      return out.map((t, i) => (i > 0 && t.k === 'num' && out[i - 1].k === 'num' ? ' ' : '') + t.v).join('');
  }

  /** FAZ 3b: açık ifadeyi (normalizeMathInput çıktısı) KaTeX için TeX'e
   *  çevirir; yalnızca önizleme ve sonuç kâğıdı için. Olmazsa ''. */
  function exprToTex(src) {
    const text = String(src || '');
    if (!text) return '';
    const tokens = [];
    const re = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|[-+*/^(),]))/y;
    let pos = 0;
    while (pos < text.length) {
      if (/^\s*$/.test(text.slice(pos))) break;
      re.lastIndex = pos;
      const m = re.exec(text);
      if (!m) return '';
      tokens.push(m[1] !== undefined ? { t: 'num', v: m[1] } : m[2] !== undefined ? { t: 'id', v: m[2] } : { t: 'op', v: m[3] === '**' ? '^' : m[3] });
      pos = re.lastIndex;
    }
    let i = 0;
    const isOp = v => !!tokens[i] && tokens[i].t === 'op' && tokens[i].v === v;
    const fail = () => { throw new Error('tex'); };
    const expr = () => { let a = term(); while (isOp('+') || isOp('-')) { const op = tokens[i++].v; a = { k: 'bin', op, a, b: term() }; } return a; };
    const term = () => { let a = unary(); while (isOp('*') || isOp('/')) { const op = tokens[i++].v; a = { k: 'bin', op, a, b: unary() }; } return a; };
    const unary = () => { if (isOp('-')) { i++; return { k: 'neg', a: unary() }; } if (isOp('+')) { i++; return unary(); } return power(); };
    const power = () => { const b = primary(); if (isOp('^')) { i++; return { k: 'bin', op: '^', a: b, b: unary() }; } return b; };
    const primary = () => {
      const tk = tokens[i];
      if (!tk) fail();
      if (tk.t === 'num') { i++; return { k: 'num', v: tk.v }; }
      if (isOp('(')) { i++; const v = expr(); if (!isOp(')')) fail(); i++; return { k: 'par', a: v }; }
      if (tk.t === 'id') {
        i++;
        if (!isOp('(')) return { k: 'id', v: tk.v };
        i++;
        const args = [];
        if (!isOp(')')) { args.push(expr()); while (isOp(',')) { i++; args.push(expr()); } }
        if (!isOp(')')) fail();
        i++;
        return { k: 'fn', f: tk.v.toLowerCase(), args };
      }
      return fail();
    };
    const FN = { sin: '\\sin', cos: '\\cos', tan: '\\tan', ln: '\\ln', log: '\\log', log10: '\\log_{10}', exp: '\\exp', asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan' };
    const strip = n => (n.k === 'par' ? n.a : n);
    const leftLeaf = n => (n.k === 'bin' ? leftLeaf(n.a) : n);
    const tex = n => {
      if (n.k === 'num') return n.v;
      if (n.k === 'id') return n.v === 'pi' ? '\\pi' : n.v.length > 1 ? '\\mathrm{' + n.v.replace(/_/g, '\\_') + '}' : n.v;
      if (n.k === 'par') return '\\left(' + tex(n.a) + '\\right)';
      if (n.k === 'neg') return '-' + tex(n.a);
      if (n.k === 'fn') {
        if (n.f === 'sqrt' && n.args.length === 1) return '\\sqrt{' + tex(strip(n.args[0])) + '}';
        if (n.f === 'abs' && n.args.length === 1) return '\\left|' + tex(strip(n.args[0])) + '\\right|';
        return (FN[n.f] || '\\operatorname{' + n.f + '}') + '\\left(' + n.args.map(a => tex(strip(a))).join(', ') + '\\right)';
      }
      if (n.op === '/') return '\\frac{' + tex(strip(n.a)) + '}{' + tex(strip(n.b)) + '}';
      if (n.op === '^') {
        const base = n.a.k === 'bin' || n.a.k === 'neg' ? '\\left(' + tex(n.a) + '\\right)' : '{' + tex(n.a) + '}';
        return base + '^{' + tex(strip(n.b)) + '}';
      }
      if (n.op === '*') {
        const r = leftLeaf(n.b);
        return tex(n.a) + (r.k === 'num' || r.k === 'neg' ? ' \\cdot ' : ' ') + tex(n.b);
      }
      return tex(n.a) + ' ' + n.op + ' ' + tex(n.b);
    };
    try {
      const ast = expr();
      if (i !== tokens.length) return '';
      return tex(ast);
    } catch (_e) {
      return '';
    }
  }

  /** Sorunun ifade değişkenleri (generate-exam expr_vars yazar). */
  function exprVarsOf(q) {
    const v = q && Array.isArray(q.expr_vars) ? q.expr_vars : [];
    return v.filter(x => typeof x === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(x)).slice(0, 4);
  }

  /** Öğrenci yazımını KaTeX HTML'ine çevirir; okunamazsa null. */
  function exprPreviewHtml(raw, vars) {
    const norm = normalizeMathInput(raw, vars);
    const tex = norm ? exprToTex(norm) : '';
    if (!tex) return null;
    if (typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function') {
      try { return window.katex.renderToString(tex, { throwOnError: false, displayMode: false }); } catch (_e) { /* düz metne düş */ }
    }
    return String(norm).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function exprRefresh(box) {
    const inp = box.querySelector('.axe-expr-in');
    const pv = box.querySelector('.axe-expr-pv');
    if (!inp || !pv) return;
    const tr = box.getAttribute('data-lang') !== 'en';
    const vars = (box.getAttribute('data-expr-vars') || '').split(',').filter(Boolean);
    if (!String(inp.value).trim()) {
      pv.className = 'axe-expr-pv';
      pv.textContent = tr ? 'yazdıkça burada matematik olarak görünür' : 'your expression appears here as you type';
      return;
    }
    const html = exprPreviewHtml(inp.value, vars);
    if (html) { pv.className = 'axe-expr-pv ok'; pv.innerHTML = html; }
    else {
      pv.className = 'axe-expr-pv bad';
      pv.textContent = tr ? 'okunamadı: çarpma için * ya da yan yana yaz (2x), üs için ^, bölme için / kullan' : 'could not read it: use * or juxtaposition (2x), ^ for powers, / for division';
    }
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('input', e => {
      const t = e.target;
      if (t && t.classList && t.classList.contains('axe-expr-in')) { const box = t.closest('.axe-expr'); if (box) exprRefresh(box); }
    });
    document.addEventListener('click', e => {
      const b = e.target && e.target.closest ? e.target.closest('[data-expr-key]') : null;
      if (!b) return;
      const box = b.closest('.axe-expr');
      const inp = box && box.querySelector('.axe-expr-in');
      if (!inp) return;
      const k = b.getAttribute('data-expr-key') || '';
      const s = typeof inp.selectionStart === 'number' ? inp.selectionStart : inp.value.length;
      const en = typeof inp.selectionEnd === 'number' ? inp.selectionEnd : s;
      inp.value = inp.value.slice(0, s) + k + inp.value.slice(en);
      inp.focus();
      try { inp.setSelectionRange(s + k.length, s + k.length); } catch (_e) { /* yok say */ }
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  /** grade-exam'deki parseLooseNumber ile aynı kural: "1.432,50", "1,432.50", "%12". */
  function parseLooseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    let s = String(value == null ? '' : value).trim().replace(/\s+/g, '');
    s = s.replace(/[^0-9.,\-+eE]/g, '');
    if (!s || !/\d/.test(s)) return NaN;
    const hasComma = s.includes(','), hasDot = s.includes('.');
    if (hasComma && hasDot) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (hasComma) {
      s = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (hasDot && (s.match(/\./g) || []).length > 1) {
      s = s.replace(/\./g, '');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function formatNumber(n, lang) {
    return Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 6 });
  }

  /** Şablondaki {ad} yer tutucularını sayılarla doldurur. */
  function renderTemplate(template, vars, lang) {
    return String(template || '').replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k) =>
      Object.prototype.hasOwnProperty.call(vars, k) ? formatNumber(vars[k], lang) : m);
  }

  function decimalsOf(n) {
    const str = String(n);
    if (/e/i.test(str)) return 6;
    const i = str.indexOf('.');
    return i < 0 ? 0 : Math.min(6, str.length - i - 1);
  }

  function significantDigits(n) {
    const digits = String(Math.abs(n)).replace(/e.*$/i, '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '');
    return Math.max(1, digits.length);
  }

  /** Aynı formülle yeni sayılar: her değişken %60–%140 arasında, ondalık
   *  basamağı ve işareti korunarak değişir; cevap formülden hesaplanır.
   *  Üretilemezse null. rand testte sabitlenebilsin diye parametre. */
  function makeVariant(practice, lang, rand) {
    const rnd = typeof rand === 'function' ? rand : Math.random;
    if (!practice || typeof practice.template !== 'string' || !practice.formula) return null;
    const base = sanitizeVariables(practice.variables);
    const names = Object.keys(base);
    if (!names.length) return null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const vars = {};
      names.forEach(k => {
        const v = base[k], d = decimalsOf(v), f = Math.pow(10, d);
        // Asıl sayı kadar "yuvarlak" kalsın: 1.000.000 → 790.000 (en az 2
        // anlamlı basamak), ondalık basamak ve tamsayılık korunur.
        let nv = v === 0 ? 0 : Number((v * (0.6 + rnd() * 0.8)).toPrecision(Math.max(2, significantDigits(v))));
        nv = Math.round(nv * f) / f;
        if (v !== 0 && nv === 0) nv = d > 0 ? Math.sign(v) / f : Math.sign(v);
        vars[k] = nv;
      });
      if (names.every(k => vars[k] === base[k])) continue;
      const answer = evaluateExpression(practice.formula, vars);
      if (!Number.isFinite(answer)) continue;
      return { text: renderTemplate(practice.template, vars, lang), variables: vars, answer: Math.round(answer * 1e4) / 1e4 };
    }
    return null;
  }

  /** Öğrencinin sayısını toleransla kontrol eder. */
  function checkNumericAnswer(input, answer, tolerancePercent) {
    const n = parseLooseNumber(input);
    if (!Number.isFinite(n)) return { ok: false, filled: false, value: NaN };
    const tol = Number(tolerancePercent) > 0 ? Number(tolerancePercent) : 2;
    const margin = answer !== 0 ? Math.abs(answer) * tol / 100 : tol / 100;
    return { ok: Math.abs(n - answer) <= margin, filled: true, value: n };
  }

  const api = {
    // tip kaydı
    registerType,
    getType,
    hasType,
    // yaşam döngüsü
    mount,
    attach,
    destroy,
    isActive,
    isHeadless,
    save,
    collectAnswers,
    getSummary,
    getFlags,
    flush: flushRemote,
    discardDraft,
    // taslak yardımcıları
    readLocalDraft,
    removeLocalDraft,
    listLocalDrafts,
    draftFromRow,
    pickNewerDraft,
    // saf yardımcılar
    computeSummary,
    formatSubmitWarning,
    computeRemainingSeconds,
    choiceIndexFromKey,
    isAnswerFilled,
    // FAZ 3a: hesap pratiği
    evaluateExpression,
    sanitizeVariables,
    parseLooseNumber,
    renderTemplate,
    makeVariant,
    checkNumericAnswer,
    // FAZ 3b: cebirsel ifade
    normalizeMathInput,
    exprToTex,
    exprPreviewHtml
  };
  return api;
});
