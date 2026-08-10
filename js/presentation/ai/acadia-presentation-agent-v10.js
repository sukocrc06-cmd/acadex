/* Acadex Presentation Studio V10/V11 — unified Acadia presentation agent facade.
 * Structured tools sit above legacy chat/visual/theme modules and V11 Director.
 */
(function () {
  'use strict';
  if (window.AcadiaPresentationAgentV10) return;

  const S = () => window.AcadexPresentationServicesV10;
  const Schema = () => window.AcadexPresentationSchemaV10;
  const Quality = () => window.AcadexPresentationQualityV10;
  const Director = () => window.AcadiaPresentationDirectorV11;

  function requireDeck() {
    const state = S()?.state?.();
    if (!state?.slides?.length) throw new Error('Önce bir sunum oluşturun veya açın.');
    return state;
  }
  function requireDirector() {
    const director = Director();
    if (!director) throw new Error('Acadia V11 Director henüz yüklenmedi.');
    return director;
  }

  function slidePayload(slide) {
    const normalized = Schema()?.normalizeSlide?.(slide, 0) || slide;
    const c = normalized?.content || {};
    return {
      id: normalized?.id || null,
      title: normalized?.title || '',
      text: c.text || '',
      secondary_text: c.secondary_text || '',
      speaker_notes: normalized?.speaker_notes || '',
      layout_type: normalized?.layout_type || 'title-content',
      design_variant: c.design_variant || 'section',
      table: c.table || null,
      chart: c.chart || null,
      cards: c.cards || null,
      steps: c.steps || null,
      metric: c.metric || null,
      diagram: c.diagram || null,
      citations: c.citations || [],
      source_refs: c.source_refs || [],
    };
  }

  function applySlide(target, incoming, index) {
    if (!target || !incoming) return null;
    const next = Schema()?.normalizeSlide?.(incoming.slide || incoming, index || 0) || (incoming.slide || incoming);
    Object.keys(target).forEach((key) => delete target[key]);
    Object.assign(target, next);
    S()?.markDirty?.();
    S()?.render?.();
    S()?.emit?.('agent:slide-updated', { index: index || 0, slide: target });
    return target;
  }

  async function improveActiveSlide(instruction) {
    const state = requireDeck();
    if (!state.presentationId) throw new Error('Bu işlem için sunumu önce kaydedin.');
    const index = state.activeIndex;
    const target = state.slides[index];
    const language = state.presentation?.language === 'en' ? 'en' : 'tr';
    const data = await S().invoke('generate-presentation', {
      action: 'improve_slide',
      presentationId: state.presentationId,
      language,
      instruction: S().cleanText(instruction, 700),
      slide: slidePayload(target),
    });
    if (!data?.slide) throw new Error(data?.error || 'Acadia slayt yanıtı üretmedi.');
    return applySlide(target, data.slide, index);
  }

  async function createVisual(kind) {
    requireDeck();
    if (window.AcadexPresentationVisualAiV8?.generateFromSlide) {
      return window.AcadexPresentationVisualAiV8.generateFromSlide(kind === 'table' ? 'table' : 'chart');
    }
    return improveActiveSlide(
      kind === 'table'
        ? 'Bu slaytı akademik bir karşılaştırma tablosuna dönüştür. Uydurma veri üretme; kaynak anlamını koru.'
        : 'Bu slaytta gerçek sayısal veri varsa temiz bir grafik oluştur; sayı yoksa uygun tablo veya diyagram kullan. Uydurma istatistik üretme.'
    );
  }

  async function generateSpeakerNotes() {
    return improveActiveSlide('Bu slayt için 45-70 kelimelik, doğal konuşma dilinde fakat akademik doğruluğu koruyan konuşmacı notları oluştur. Slayttaki görünür metni tekrar etme; anlatımı tamamla.');
  }

  async function rewriteActive(mode) {
    const instructions = {
      academic: 'Bu slaytı daha akademik, net ve kanıta duyarlı biçimde yeniden yaz. Uydurma kaynak veya istatistik ekleme.',
      short: 'Bu slaytı kısalt. En fazla 3 kısa madde veya 2 kısa cümle kullan. Ana mesajı ve mevcut kaynak anlamını koru.',
      detailed: 'Bu slaytı neden/nasıl ilişkisiyle akademik olarak detaylandır. 4-5 net maddeyi geçme; uydurma kaynak ekleme.',
      bullets: 'Bu slaytı kısa ve paralel yapıda akademik madde işaretlerine dönüştür. Tablo/grafik gibi yapılandırılmış içeriği koru.',
    };
    return improveActiveSlide(instructions[mode] || instructions.academic);
  }

  function reviewDeck() {
    requireDeck();
    const result = Quality()?.reviewCurrent?.();
    if (!result) throw new Error('Quality Engine henüz hazır değil.');
    Quality()?.ensureCard?.();
    S()?.emit?.('agent:review', result);
    return result;
  }

  async function saveVersion(reason, createdByType) {
    const state = requireDeck();
    if (!state.presentationId) throw new Error('Versiyon kaydı için sunumu önce kaydedin.');
    const client = S()?.resolveSupabase?.();
    if (!client) throw new Error('Supabase bağlantısı bulunamadı.');

    const { data: lastRows, error: lastError } = await client
      .from('presentation_versions')
      .select('version_no')
      .eq('presentation_id', state.presentationId)
      .order('version_no', { ascending: false })
      .limit(1);
    if (lastError && !/does not exist|schema cache/i.test(lastError.message || '')) throw lastError;
    if (lastError) throw new Error('Presentation Intelligence migration henüz uygulanmamış.');

    const versionNo = Number(lastRows?.[0]?.version_no || 0) + 1;
    const snapshot = Schema()?.snapshot?.(state.presentation, state.slides, reason || 'manual_snapshot') || { slides: state.slides };
    const { data, error } = await client
      .from('presentation_versions')
      .insert({
        presentation_id: state.presentationId,
        version_no: versionNo,
        reason: S().cleanText(reason || 'manual_snapshot', 200),
        created_by_type: ['user', 'acadia', 'system'].includes(createdByType) ? createdByType : 'user',
        snapshot,
      })
      .select('id, version_no, created_at')
      .single();
    if (error) throw error;
    S()?.emit?.('agent:version-saved', data);
    return data;
  }

  function citationCheck() {
    const review = reviewDeck();
    const citationIssues = review.issues.filter((issue) => issue.type === 'citation');
    return {
      score: review.metrics.grounding,
      coverage: review.meta?.groundedSlides || 0,
      slideCount: review.meta?.slideCount || 0,
      issues: citationIssues,
      message: review.metrics.grounding >= 85
        ? 'Kaynak desteği güçlü görünüyor.'
        : 'Kaynak desteği geliştirilmeli; özellikle kaynak tabanlı sunumlarda slayt-level citation ekleyin.',
    };
  }

  function delegateToLegacy(message) {
    if (window.AcadexPresentationChatV8?.handleUser) {
      return window.AcadexPresentationChatV8.handleUser(message);
    }
    if (typeof window.sendPresentationAcadiaMessage === 'function') {
      return window.sendPresentationAcadiaMessage(message);
    }
    throw new Error('Acadia sohbet modülü hazır değil.');
  }

  async function execute(tool, args) {
    const input = args || {};
    const tools = {
      review_deck: () => reviewDeck(),
      citation_check: () => citationCheck(),
      rewrite_active_slide: () => rewriteActive(input.mode || 'academic'),
      generate_speaker_notes: () => generateSpeakerNotes(),
      create_chart: () => createVisual('chart'),
      create_table: () => createVisual('table'),
      save_version: () => saveVersion(input.reason || 'Acadia checkpoint', input.createdByType || 'acadia'),
      ask_acadia: () => delegateToLegacy(String(input.message || '').trim()),
      optimize_duration: () => delegateToLegacy(`Bu sunumu yaklaşık ${Math.max(1, Number(input.minutes) || 10)} dakikalık akademik sunuma optimize et. Gereksiz tekrarları azalt, anlatı akışını ve konuşmacı notlarını buna göre düzenle.`),
      change_theme: () => delegateToLegacy(`${String(input.theme || 'academic')} tema yap`),
      director_open: () => requireDirector().open(input),
      director_generate: () => requireDirector().generate(input),
      director_critique: () => requireDirector().critiqueCurrent(),
    };
    if (!tools[tool]) throw new Error(`Bilinmeyen Acadia aracı: ${tool}`);
    S()?.emit?.('agent:tool-start', { tool, args: input });
    try {
      const result = await tools[tool]();
      S()?.emit?.('agent:tool-success', { tool, result });
      return result;
    } catch (error) {
      S()?.emit?.('agent:tool-error', { tool, error });
      throw error;
    }
  }

  window.AcadiaPresentationAgentV10 = {
    version: '11.0.0',
    tools: [
      'review_deck', 'citation_check', 'rewrite_active_slide', 'generate_speaker_notes',
      'create_chart', 'create_table', 'save_version', 'ask_acadia', 'optimize_duration', 'change_theme',
      'director_open', 'director_generate', 'director_critique'
    ],
    execute,
    improveActiveSlide,
    rewriteActive,
    createVisual,
    generateSpeakerNotes,
    reviewDeck,
    citationCheck,
    saveVersion,
    delegateToLegacy,
  };
})();
