/* Acadex Presentation Studio V11 — Acadia multi-pass academic director.
 * Plan -> Evidence Map -> Compose -> Critic -> Save/Citations.
 * Gracefully falls back to the legacy generator until the V11 Edge Function is deployed.
 */
(function () {
  'use strict';
  if (window.AcadiaPresentationDirectorV11) return;

  const S = () => window.AcadexPresentationServicesV10;
  const Agent = () => window.AcadiaPresentationAgentV10;
  const Quality = () => window.AcadexPresentationQualityV10;
  const EDGE = 'acadia-presentation-director';
  const MODES = [
    ['academic', 'Akademik', 'Dengeli akademik anlatı'],
    ['thesis_defense', 'Tez / Jüri', 'Problem, yöntem, bulgu, sınırlılık, savunma'],
    ['research', 'Araştırma', 'Araştırma sorusu, yöntem, analiz ve bulgular'],
    ['lecture', 'Ders Anlatımı', 'Kavram öğretimi, örnek ve kısa tekrar'],
    ['business', 'İş / Analiz', 'Kanıt, seçenek, öneri ve aksiyon'],
  ];
  const STAGES = [
    ['source', 'Kaynak analizi'],
    ['plan', 'Brief + anlatı planı'],
    ['evidence', 'Evidence map'],
    ['compose', 'Slide Writer + Visual Planner'],
    ['critic', 'Academic Critic'],
    ['save', 'Kaydet + citation bağla'],
  ];
  let busy = false;
  let edgeAvailable = null;
  let lastRun = null;

  function clean(value, max) {
    const text = String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, '').trim();
    return Number.isFinite(max) ? text.slice(0, max) : text;
  }
  function currentState() { return S()?.state?.() || { slides: [], activeIndex: 0, presentationId: null, presentation: null }; }
  function currentPresentation() { return currentState().presentation || {}; }
  function notify(message, type) { S()?.notify?.(message, type || 'success'); }

  async function health(force) {
    if (edgeAvailable !== null && !force) return edgeAvailable;
    try {
      const data = await S().invoke(EDGE, { action: 'health' });
      edgeAvailable = data?.version === 11;
    } catch (_) {
      edgeAvailable = false;
    }
    updateEngineBadge();
    return edgeAvailable;
  }

  function injectStyles() {
    if (document.getElementById('acadex-director-v11-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-director-v11-style';
    style.textContent = `
      #acadia-director-v11{position:fixed;inset:0;z-index:430000;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(8,18,36,.58);backdrop-filter:blur(5px)}
      #acadia-director-v11.is-open{display:flex}
      #acadia-director-v11 .ad11-shell{width:min(940px,96vw);max-height:92vh;background:#fff;border:1px solid rgba(22,50,92,.1);border-radius:22px;box-shadow:0 28px 90px rgba(15,23,42,.34);overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) 280px}
      #acadia-director-v11 .ad11-main{padding:1.1rem 1.15rem;overflow:auto}
      #acadia-director-v11 .ad11-side{background:#f8fafc;border-left:1px solid rgba(22,50,92,.08);padding:1rem;overflow:auto}
      #acadia-director-v11 .ad11-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1rem}
      #acadia-director-v11 .ad11-brand{display:flex;align-items:center;gap:.7rem}.ad11-logo{width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,#0d9488,#16325c);color:#fff;display:grid;place-items:center;font-weight:900;box-shadow:0 8px 20px rgba(13,148,136,.22)}
      #acadia-director-v11 h2{margin:0;color:#16325c;font-size:1.08rem}.ad11-sub{margin:.18rem 0 0;color:#64748b;font-size:.72rem;line-height:1.45}
      #acadia-director-v11 .ad11-close{border:none;background:#f1f5f9;color:#64748b;width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:1.1rem}
      #acadia-director-v11 .ad11-grid{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}.ad11-field{display:flex;flex-direction:column;gap:.28rem}.ad11-field.full{grid-column:1/-1}.ad11-field label{font-size:.66rem;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.04em}
      #acadia-director-v11 input,#acadia-director-v11 select,#acadia-director-v11 textarea{width:100%;box-sizing:border-box;border:1px solid #dbe4ee;border-radius:10px;padding:.58rem .65rem;font:inherit;font-size:.76rem;color:#16325c;background:#fff;outline:none}
      #acadia-director-v11 textarea{min-height:78px;resize:vertical}#acadia-director-v11 input:focus,#acadia-director-v11 select:focus,#acadia-director-v11 textarea:focus{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,.08)}
      #acadia-director-v11 .ad11-actions{display:flex;align-items:center;justify-content:space-between;gap:.7rem;margin-top:1rem;padding-top:.9rem;border-top:1px solid #edf2f7}.ad11-run{border:none;border-radius:11px;padding:.65rem .9rem;background:linear-gradient(135deg,#0d9488,#16325c);color:#fff;font-weight:800;cursor:pointer}.ad11-run:disabled{opacity:.55;cursor:wait}.ad11-secondary{border:1px solid #dbe4ee;border-radius:10px;padding:.58rem .75rem;background:#fff;color:#16325c;font-weight:700;cursor:pointer}
      #acadia-director-v11 .ad11-stage{display:grid;grid-template-columns:26px 1fr;gap:.55rem;align-items:center;padding:.45rem .25rem;border-radius:9px}.ad11-dot{width:24px;height:24px;border-radius:8px;background:#e2e8f0;color:#64748b;display:grid;place-items:center;font-size:.62rem;font-weight:900}.ad11-stage strong{font-size:.68rem;color:#475569}.ad11-stage.is-active{background:#ecfeff}.ad11-stage.is-active .ad11-dot{background:#0d9488;color:#fff}.ad11-stage.is-done .ad11-dot{background:#dcfce7;color:#15803d}.ad11-stage.is-done strong{color:#166534}
      #acadia-director-v11 .ad11-engine{display:inline-flex;align-items:center;gap:.32rem;font-size:.62rem;font-weight:800;border-radius:999px;padding:.22rem .48rem;background:#f1f5f9;color:#64748b}.ad11-engine.is-online{background:#dcfce7;color:#166534}.ad11-engine.is-fallback{background:#fff7ed;color:#9a3412}
      #acadia-director-v11 .ad11-report{margin-top:.8rem;padding:.7rem;border-radius:11px;background:#fff;border:1px solid #e8eef5;font-size:.67rem;color:#64748b;line-height:1.5}.ad11-score{font-size:1.55rem;font-weight:900;color:#16325c;line-height:1}.ad11-report ul{margin:.45rem 0 0;padding-left:1.1rem}
      .pres-v11-card{border:1px solid rgba(13,148,136,.2)!important;background:linear-gradient(145deg,#f0fdfa,#fff)!important}.pres-v11-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem}.pres-v11-badge{font-size:.58rem;font-weight:900;color:#0f766e;background:#ccfbf1;border-radius:999px;padding:.16rem .42rem}.pres-v11-actions{display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-top:.55rem}.pres-v11-btn{border:1px solid rgba(13,148,136,.25);background:#fff;color:#0f766e;border-radius:9px;padding:.46rem .4rem;font-size:.67rem;font-weight:800;cursor:pointer}.pres-v11-btn.primary{grid-column:1/-1;background:linear-gradient(135deg,#0d9488,#16325c);color:#fff;border:none}.pres-v11-note{font-size:.61rem;color:#64748b;line-height:1.4;margin:.45rem 0 0}
      @media(max-width:760px){#acadia-director-v11 .ad11-shell{grid-template-columns:1fr;max-height:95vh}#acadia-director-v11 .ad11-side{border-left:none;border-top:1px solid #e8eef5}.ad11-grid{grid-template-columns:1fr!important}.ad11-field.full{grid-column:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    injectStyles();
    let overlay = document.getElementById('acadia-director-v11');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'acadia-director-v11';
    overlay.innerHTML = `
      <div class="ad11-shell" role="dialog" aria-modal="true" aria-labelledby="ad11-title">
        <div class="ad11-main">
          <div class="ad11-head"><div class="ad11-brand"><div class="ad11-logo">A11</div><div><h2 id="ad11-title">Acadia Presentation Director V11</h2><p class="ad11-sub">Brief → Evidence Map → Slide Writer → Visual Planner → Academic Critic</p></div></div><button class="ad11-close" id="ad11-close" type="button">×</button></div>
          <form id="ad11-form">
            <div class="ad11-grid">
              <div class="ad11-field"><label>Sunum modu</label><select id="ad11-mode">${MODES.map(x => `<option value="${x[0]}">${x[1]} — ${x[2]}</option>`).join('')}</select></div>
              <div class="ad11-field"><label>Kaynak</label><select id="ad11-source-type"><option value="topic">Konu</option><option value="study_card">Study Card</option><option value="document">Belge / PDF</option></select></div>
              <div class="ad11-field full" id="ad11-topic-wrap"><label>Konu / yönlendirme</label><textarea id="ad11-topic" placeholder="Örn. Yapay zekânın uluslararası tedarik zinciri risk yönetimine etkisi"></textarea></div>
              <div class="ad11-field full" id="ad11-source-wrap" style="display:none"><label>Kaynak seç</label><select id="ad11-source-id"><option value="">Kaynaklar yükleniyor…</option></select></div>
              <div class="ad11-field"><label>Dil</label><select id="ad11-language"><option value="tr">Türkçe</option><option value="en">English</option></select></div>
              <div class="ad11-field"><label>Detay</label><select id="ad11-detail"><option value="summary">Özet</option><option value="bullets" selected>Dengeli</option><option value="detailed">Detaylı</option></select></div>
              <div class="ad11-field"><label>Slayt sayısı</label><input id="ad11-count" type="number" min="5" max="15" value="8"></div>
              <div class="ad11-field"><label>Hedef süre (dk)</label><input id="ad11-minutes" type="number" min="3" max="30" value="10"></div>
            </div>
            <div class="ad11-actions"><button type="button" class="ad11-secondary" id="ad11-critic">Mevcut deck'i denetle</button><button class="ad11-run" id="ad11-run" type="submit">✨ V11 ile üret</button></div>
          </form>
        </div>
        <aside class="ad11-side">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.65rem"><strong style="font-size:.72rem;color:#16325c">Director Pipeline</strong><span class="ad11-engine" id="ad11-engine">Kontrol…</span></div>
          <div id="ad11-stages">${STAGES.map((stage, i) => `<div class="ad11-stage" data-stage="${stage[0]}"><span class="ad11-dot">${i + 1}</span><strong>${stage[1]}</strong></div>`).join('')}</div>
          <div class="ad11-report" id="ad11-report">V11, önce sunumun stratejik planını çıkarır; sonra kaynak kanıtlarını slaytlara bağlayıp akademik kalite kontrolünden geçirir.</div>
        </aside>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay && !busy) close(); });
    overlay.querySelector('#ad11-close').addEventListener('click', () => { if (!busy) close(); });
    overlay.querySelector('#ad11-source-type').addEventListener('change', async () => { updateSourceUi(); await loadSources(); });
    overlay.querySelector('#ad11-form').addEventListener('submit', async event => { event.preventDefault(); await runFromForm(); });
    overlay.querySelector('#ad11-critic').addEventListener('click', critiqueCurrent);
    return overlay;
  }

  function setStage(name, state) {
    document.querySelectorAll('#ad11-stages .ad11-stage').forEach(row => {
      if (state === 'reset') row.classList.remove('is-active', 'is-done');
      if (row.dataset.stage === name) {
        row.classList.remove('is-active', 'is-done');
        if (state === 'active') row.classList.add('is-active');
        if (state === 'done') row.classList.add('is-done');
      }
    });
  }
  function resetStages() { STAGES.forEach(x => setStage(x[0], 'reset')); }
  function report(html) { const el = document.getElementById('ad11-report'); if (el) el.innerHTML = html; }
  function updateEngineBadge() {
    const badge = document.getElementById('ad11-engine');
    if (!badge) return;
    badge.className = 'ad11-engine';
    if (edgeAvailable === true) { badge.textContent = 'V11 ONLINE'; badge.classList.add('is-online'); }
    else if (edgeAvailable === false) { badge.textContent = 'LEGACY FALLBACK'; badge.classList.add('is-fallback'); }
    else badge.textContent = 'Kontrol…';
  }

  function updateSourceUi() {
    const type = document.getElementById('ad11-source-type')?.value || 'topic';
    const topicWrap = document.getElementById('ad11-topic-wrap');
    const sourceWrap = document.getElementById('ad11-source-wrap');
    if (topicWrap) topicWrap.style.display = type === 'topic' ? '' : 'none';
    if (sourceWrap) sourceWrap.style.display = type === 'topic' ? 'none' : '';
  }

  async function loadSources() {
    const client = S()?.resolveSupabase?.();
    const type = document.getElementById('ad11-source-type')?.value || 'topic';
    const select = document.getElementById('ad11-source-id');
    if (!client || !select || type === 'topic') return;
    select.innerHTML = '<option value="">Yükleniyor…</option>';
    try {
      if (type === 'document') {
        const { data, error } = await client.from('documents').select('id,file_name,uploaded_at').order('uploaded_at', { ascending: false }).limit(80);
        if (error) throw error;
        select.innerHTML = '<option value="">Belge seçin</option>' + (data || []).map(doc => `<option value="${doc.id}">${escapeOption(doc.file_name || 'Belge')}</option>`).join('');
      } else {
        const { data, error } = await client.from('study_cards').select('id,course_tag,created_at,document_id').order('created_at', { ascending: false }).limit(80);
        if (error) throw error;
        select.innerHTML = '<option value="">Study Card seçin</option>' + (data || []).map((card, i) => `<option value="${card.id}">${escapeOption(card.course_tag || `Study Card ${i + 1}`)}</option>`).join('');
      }
    } catch (error) {
      select.innerHTML = '<option value="">Kaynaklar yüklenemedi</option>';
      console.warn('V11 source list failed:', error);
    }
  }
  function escapeOption(value) { return clean(value, 180).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function readForm() {
    return {
      mode: document.getElementById('ad11-mode')?.value || 'academic',
      sourceType: document.getElementById('ad11-source-type')?.value || 'topic',
      sourceId: document.getElementById('ad11-source-id')?.value || '',
      topic: clean(document.getElementById('ad11-topic')?.value || '', 700),
      language: document.getElementById('ad11-language')?.value === 'en' ? 'en' : 'tr',
      detailLevel: document.getElementById('ad11-detail')?.value || 'bullets',
      slideCount: Math.max(5, Math.min(15, Number(document.getElementById('ad11-count')?.value) || 8)),
      targetMinutes: Math.max(3, Math.min(30, Number(document.getElementById('ad11-minutes')?.value) || 10)),
      presentationId: currentState().presentationId,
      courseTag: currentPresentation()?.course_tag || '',
    };
  }

  async function runFromForm() {
    const options = readForm();
    if (!options.presentationId) return notify('Önce bir sunum oluşturun veya açın.', 'error');
    if (options.sourceType === 'topic' && options.topic.length < 3) return notify('Sunum konusunu yazın.', 'error');
    if (options.sourceType !== 'topic' && !options.sourceId) return notify('Bir kaynak seçin.', 'error');
    await generate(options);
  }

  async function generate(options) {
    if (busy) return null;
    const state = currentState();
    if (!state.presentationId) throw new Error('Önce bir sunum oluşturun veya açın.');
    busy = true;
    const runButton = document.getElementById('ad11-run');
    if (runButton) { runButton.disabled = true; runButton.textContent = 'Director çalışıyor…'; }
    resetStages();
    report('Kaynak hazırlanıyor…');
    S()?.emit?.('director:v11-start', options);

    let checkpoint = null;
    try {
      setStage('source', 'active');
      if (state.slides?.some(slide => slide?.id) && Agent()?.saveVersion) {
        try { checkpoint = await Agent().saveVersion('Before V11 Director generation', 'system'); } catch (_) {}
      }
      setStage('source', 'done');

      const online = await health(true);
      let result;
      if (online) {
        setStage('plan', 'active');
        const planned = await S().invoke(EDGE, { action: 'plan', ...options });
        if (!planned?.plan) throw new Error('V11 plan oluşturulamadı.');
        setStage('plan', 'done');
        setStage('evidence', 'active');
        report(`<strong>Brief hazır.</strong><br>${escapeHtml(planned.plan?.brief?.main_message || '')}`);
        setStage('evidence', 'done');

        setStage('compose', 'active');
        const composed = await S().invoke(EDGE, {
          action: 'compose', ...options,
          plan: planned.plan,
          evidence_chunks: planned.evidence_chunks || [],
        });
        if (!composed?.presentation?.slides?.length) throw new Error('V11 sunum üretmedi.');
        setStage('compose', 'done');
        setStage('critic', 'active');
        result = { ...composed, plan: composed.plan || planned.plan, source: composed.source || planned.source, fallback: false };
        setStage('critic', 'done');
      } else {
        result = await legacyFallback(options);
        setStage('plan', 'done'); setStage('evidence', 'done'); setStage('compose', 'done'); setStage('critic', 'done');
      }

      setStage('save', 'active');
      await applyGeneratedDeck(result, options);
      setStage('save', 'done');
      lastRun = { ...result, checkpoint, at: new Date().toISOString() };
      const quality = result.quality || Quality()?.reviewCurrent?.();
      reportQuality(quality, result.fallback, result.plan);
      notify(result.fallback ? 'Sunum üretildi. V11 Edge Function deploy edilince tam Director pipeline kullanılacak.' : 'Acadia V11 Director sunumu tamamladı.', 'success');
      S()?.emit?.('director:v11-success', lastRun);
      return lastRun;
    } catch (error) {
      console.error('V11 Director failed:', error);
      report(`<strong style="color:#b91c1c">Director durdu.</strong><br>${escapeHtml(error?.message || 'Bilinmeyen hata')}`);
      notify(error?.message || 'Acadia V11 işlemi başarısız.', 'error');
      S()?.emit?.('director:v11-error', error);
      throw error;
    } finally {
      busy = false;
      if (runButton) { runButton.disabled = false; runButton.textContent = '✨ V11 ile üret'; }
    }
  }

  async function legacyFallback(options) {
    report('<strong>V11 backend henüz deploy edilmemiş.</strong><br>Mevcut güvenli generator ile fallback çalışıyor.');
    const data = await S().invoke('generate-presentation', {
      action: 'generate',
      presentationId: options.presentationId,
      sourceType: options.sourceType,
      sourceId: options.sourceId || null,
      topic: options.topic,
      slideCount: options.slideCount,
      language: options.language,
      courseTag: options.courseTag,
      detailLevel: options.detailLevel,
    });
    if (!data?.presentation?.slides?.length) throw new Error(data?.error || 'Legacy generator yanıt vermedi.');
    const outline = data.presentation.slides.map((slide, index) => ({ index: index + 1, title: slide.title || `Slayt ${index + 1}`, purpose: '', message: '', visual_strategy: slide.content?.design_variant || 'section', evidence_ids: [] }));
    return {
      version: 11,
      fallback: true,
      presentation: data.presentation,
      quality: data.quality || null,
      plan: { version: 11, brief: { mode: options.mode, target_minutes: options.targetMinutes, main_message: data.presentation.title || options.topic }, narrative_arc: '', outline, evidence_map: [], risks: ['V11 Edge Function not deployed'] },
      source: { type: options.sourceType, id: options.sourceId || null, title: options.topic || '' },
      evidence_chunks: [],
    };
  }

  function normalizeForEditor(slide, index, presentationId) {
    try {
      if (typeof normalizePresentationSlide === 'function') {
        return normalizePresentationSlide({ ...slide, id: null, presentation_id: presentationId, order_index: index, _isNew: true, _localKey: null }, index);
      }
    } catch (_) {}
    const normalized = window.AcadexPresentationSchemaV10?.normalizeSlide?.(slide, index) || slide;
    return { ...normalized, id: null, presentation_id: presentationId, order_index: index, _isNew: true, _localKey: `v11-${Date.now()}-${index}` };
  }

  async function applyGeneratedDeck(result, options) {
    const state = currentState();
    const slides = state.slides;
    const generated = result.presentation;
    if (!Array.isArray(slides) || !generated?.slides?.length) throw new Error('Editör sunum durumu bulunamadı.');

    try { if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor(); } catch (_) {}
    slides.forEach(slide => {
      try {
        if (slide?.id && typeof presDeletedSlideIds !== 'undefined' && !presDeletedSlideIds.includes(slide.id)) presDeletedSlideIds.push(slide.id);
        if (typeof queuePresentationImageDelete === 'function') queuePresentationImageDelete(slide?.content?.image?.storage_path || slide?.image_url || '');
      } catch (_) {}
    });
    const next = generated.slides.slice(0, 15).map((slide, index) => normalizeForEditor(slide, index, state.presentationId));
    slides.splice(0, slides.length, ...next);
    try { if (typeof presActiveSlide !== 'undefined') presActiveSlide = 0; } catch (_) {}

    const title = clean(generated.title || result.plan?.brief?.main_message || 'Akademik Sunum', 160) || 'Akademik Sunum';
    const titleInput = document.getElementById('pres-title-input');
    if (titleInput) titleInput.value = title;
    try {
      if (typeof presCurrentPresentation !== 'undefined' && presCurrentPresentation) {
        Object.assign(presCurrentPresentation, {
          title,
          source_type: options.sourceType,
          source_id: options.sourceId || null,
          language: options.language,
          presentation_mode: options.mode,
          target_duration_seconds: options.targetMinutes * 60,
          schema_version: 11,
          quality_score: result.quality?.score ?? null,
          quality_report: result.quality || {},
        });
      }
    } catch (_) {}
    S()?.markDirty?.();
    S()?.render?.();

    let saved = true;
    try {
      if (typeof savePresentation === 'function') saved = await savePresentation({ silent: true });
    } catch (error) { saved = false; console.warn('V11 savePresentation failed:', error); }
    if (!saved) throw new Error('V11 deck üretildi ancak slaytlar kaydedilemedi.');

    await persistMetaAndCitations(result, options, title);
    try { if (Agent()?.saveVersion) await Agent().saveVersion('Acadia V11 Director result', 'acadia'); } catch (_) {}
    try { Quality()?.reviewCurrent?.(); Quality()?.ensureCard?.(); } catch (_) {}
  }

  async function persistMetaAndCitations(result, options, title) {
    const client = S()?.resolveSupabase?.();
    const state = currentState();
    if (!client || !state.presentationId) return;
    try {
      await client.from('presentations').update({
        title,
        schema_version: 11,
        presentation_mode: options.mode,
        target_duration_seconds: options.targetMinutes * 60,
        quality_score: result.quality?.score ?? null,
        quality_report: result.quality || {},
        source_type: options.sourceType,
        source_id: options.sourceId || null,
        language: options.language,
      }).eq('id', state.presentationId);
    } catch (error) { console.warn('V11 presentation metadata save skipped:', error); }

    if (result.fallback) return;
    try {
      let sourceQuery = client.from('presentation_sources').select('id').eq('presentation_id', state.presentationId).eq('source_type', options.sourceType);
      sourceQuery = options.sourceId ? sourceQuery.eq('source_id', options.sourceId) : sourceQuery.is('source_id', null);
      const { data: existing } = await sourceQuery.limit(1).maybeSingle();
      let sourceRowId = existing?.id || null;
      if (!sourceRowId) {
        const { data: inserted, error } = await client.from('presentation_sources').insert({
          presentation_id: state.presentationId,
          source_type: options.sourceType,
          source_id: options.sourceId || null,
          title: clean(result.source?.title || options.topic || 'Kaynak', 180),
          metadata: {
            director_version: 11,
            mode: options.mode,
            evidence_chunks: (result.evidence_chunks || []).map(chunk => ({ id: chunk.id, locator: chunk.locator || {} })),
          },
        }).select('id').single();
        if (error) throw error;
        sourceRowId = inserted?.id;
      }
      if (!sourceRowId) return;

      const persistedSlides = currentState().slides.filter(slide => slide?.id);
      if (persistedSlides.length) await client.from('presentation_slide_citations').delete().in('slide_id', persistedSlides.map(slide => slide.id));
      const rows = [];
      persistedSlides.forEach(slide => {
        const claims = Array.isArray(slide?.content?.claims) ? slide.content.claims : [];
        claims.forEach(claim => {
          const text = clean(claim?.text || claim?.claim, 360);
          if (!text) return;
          rows.push({
            slide_id: slide.id,
            source_id: sourceRowId,
            claim: text,
            locator: { chunk_ids: Array.isArray(claim?.evidence_ids) ? claim.evidence_ids.slice(0, 6) : [], director_version: 11 },
            confidence: Math.max(0, Math.min(1, Number(claim?.confidence ?? 0.8) || 0.8)),
          });
        });
      });
      if (rows.length) {
        const { error } = await client.from('presentation_slide_citations').insert(rows.slice(0, 100));
        if (error) throw error;
      }
    } catch (error) {
      console.warn('V11 citation persistence skipped:', error);
    }
  }

  async function critiqueCurrent() {
    const state = currentState();
    if (!state.slides?.length) return notify('Denetlenecek sunum bulunamadı.', 'error');
    let quality = null;
    if (await health(false)) {
      try {
        const response = await S().invoke(EDGE, {
          action: 'critique',
          sourceType: state.presentation?.source_type || 'topic',
          slideCount: state.slides.length,
          presentation: { title: state.presentation?.title || 'Deck', slides: state.slides },
        });
        quality = response?.quality || null;
      } catch (_) {}
    }
    quality = quality || Quality()?.reviewCurrent?.();
    reportQuality(quality, false, lastRun?.plan);
    if (quality?.score != null) notify(`Academic Critic: ${quality.score}/100`, quality.score >= 70 ? 'success' : 'error');
    return quality;
  }

  function reportQuality(quality, fallback, plan) {
    if (!quality) return report(fallback ? '<strong>Fallback üretim tamamlandı.</strong>' : '<strong>V11 tamamlandı.</strong>');
    const issues = Array.isArray(quality.issues) ? quality.issues : [];
    const main = plan?.brief?.main_message ? `<div style="margin:.45rem 0;color:#334155">${escapeHtml(plan.brief.main_message)}</div>` : '';
    report(`<div class="ad11-score">${Number(quality.score || 0)}/100</div><strong>Academic Critic</strong>${main}${fallback ? '<div style="color:#9a3412;margin-top:.35rem">Legacy fallback kullanıldı; V11 backend deploy edilince evidence-map pipeline aktif olacak.</div>' : ''}${issues.length ? `<ul>${issues.slice(0, 7).map(x => `<li>${escapeHtml(typeof x === 'string' ? x : x.type || 'issue')}</li>`).join('')}</ul>` : '<div style="margin-top:.35rem;color:#166534">Kritik kalite sorunu tespit edilmedi.</div>'}`);
  }

  function escapeHtml(value) { return clean(value, 1000).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  async function open(prefill) {
    const state = currentState();
    if (!state.presentationId) return notify('V11 Director için önce bir sunum oluşturun veya açın.', 'error');
    const overlay = ensureModal();
    const p = state.presentation || {};
    const sourceType = ['topic','study_card','document'].includes(prefill?.sourceType || p.source_type) ? (prefill?.sourceType || p.source_type) : 'topic';
    document.getElementById('ad11-source-type').value = sourceType;
    document.getElementById('ad11-language').value = prefill?.language || (p.language === 'en' ? 'en' : 'tr');
    document.getElementById('ad11-mode').value = prefill?.mode || p.presentation_mode || 'academic';
    document.getElementById('ad11-count').value = String(prefill?.slideCount || Math.max(5, Math.min(15, state.slides?.length || 8)));
    document.getElementById('ad11-minutes').value = String(prefill?.targetMinutes || Math.max(3, Math.round(Number(p.target_duration_seconds || 600) / 60)));
    document.getElementById('ad11-topic').value = prefill?.topic || (sourceType === 'topic' ? (p.title && p.title !== 'Adsız Sunum' ? p.title : '') : '');
    updateSourceUi();
    overlay.classList.add('is-open');
    resetStages();
    report('V11, önce sunumun stratejik planını çıkarır; sonra kaynak kanıtlarını slaytlara bağlayıp akademik kalite kontrolünden geçirir.');
    await Promise.all([health(true), loadSources()]);
    if (p.source_id && sourceType !== 'topic') {
      const select = document.getElementById('ad11-source-id');
      if (select && [...select.options].some(option => option.value === p.source_id)) select.value = p.source_id;
    }
  }
  function close() { document.getElementById('acadia-director-v11')?.classList.remove('is-open'); }

  function ensureStudioCard() {
    const body = document.querySelector('#pres-studio-mode .pres-right-body');
    if (!body || document.getElementById('pres-v11-director-card')) return;
    const card = document.createElement('div');
    card.id = 'pres-v11-director-card';
    card.className = 'v9-card pres-v11-card';
    card.innerHTML = `<div class="pres-v11-head"><h4 style="margin:0">Acadia Director</h4><span class="pres-v11-badge">V11</span></div><div class="pres-v11-actions"><button type="button" class="pres-v11-btn primary" id="pres-v11-open">✨ Profesyonel sunum üret</button><button type="button" class="pres-v11-btn" id="pres-v11-critic">Academic Critic</button><button type="button" class="pres-v11-btn" id="pres-v11-command">Ctrl+K</button></div><p class="pres-v11-note">Brief → evidence map → writer → visual planner → critic → citation.</p>`;
    body.prepend(card);
    card.querySelector('#pres-v11-open').addEventListener('click', () => open());
    card.querySelector('#pres-v11-critic').addEventListener('click', critiqueCurrent);
    card.querySelector('#pres-v11-command').addEventListener('click', () => window.AcadiaPresentationCommandBarV10?.open?.());
  }

  function boot() {
    injectStyles();
    ensureStudioCard();
    const studio = document.getElementById('pres-studio-mode');
    if (studio && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => ensureStudioCard());
      observer.observe(studio, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AcadiaPresentationDirectorV11 = {
    version: '11.0.0',
    edgeFunction: EDGE,
    open,
    close,
    generate,
    critiqueCurrent,
    health,
    loadSources,
    applyGeneratedDeck,
    get lastRun() { return lastRun; },
    get busy() { return busy; },
  };
})();
