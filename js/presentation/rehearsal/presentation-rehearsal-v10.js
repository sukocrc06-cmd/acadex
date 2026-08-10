/* Acadex Presentation Studio V10 — rehearsal timer and slide timing analytics. */
(function () {
  'use strict';
  if (window.AcadexPresentationRehearsalV10) return;

  const S = () => window.AcadexPresentationServicesV10;
  let session = null;
  let ticker = null;

  function now() { return Date.now(); }
  function seconds(ms) { return Math.max(0, Math.round(ms / 1000)); }
  function format(totalSeconds) {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const min = Math.floor(safe / 60);
    const sec = Math.floor(safe % 60);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function studioVisible() {
    const studio = document.getElementById('pres-studio-mode');
    if (!studio) return false;
    const style = getComputedStyle(studio);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function injectStyles() {
    if (document.getElementById('acadex-rehearsal-v10-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-rehearsal-v10-style';
    style.textContent = `
      .pres-r10-launch{border:1px solid rgba(13,148,136,.28)!important;background:#f0fdfa!important;color:#0f766e!important;border-radius:10px!important;padding:.4rem .62rem!important;font-size:.7rem!important;font-weight:800!important;cursor:pointer!important}
      #pres-rehearsal-v10{position:fixed;right:18px;bottom:18px;z-index:350000;width:min(330px,calc(100vw - 28px));background:#fff;border:1px solid rgba(22,50,92,.1);border-radius:16px;box-shadow:0 18px 48px rgba(15,23,42,.22);padding:.8rem;display:none}
      #pres-rehearsal-v10.is-open{display:block}
      #pres-rehearsal-v10 .r10-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
      #pres-rehearsal-v10 h4{margin:0;color:#16325c;font-size:.82rem}
      #pres-rehearsal-v10 .r10-clock{font-size:1.75rem;font-weight:900;color:#0f766e;letter-spacing:.02em;margin:.6rem 0 .2rem}
      #pres-rehearsal-v10 .r10-meta{font-size:.66rem;color:#64748b;line-height:1.45}
      #pres-rehearsal-v10 .r10-progress{height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin:.55rem 0}
      #pres-rehearsal-v10 .r10-progress b{display:block;height:100%;width:0;background:linear-gradient(90deg,#0d9488,#16325c);transition:width .3s ease}
      #pres-rehearsal-v10 .r10-actions{display:flex;gap:.38rem;margin-top:.65rem}
      #pres-rehearsal-v10 button{border:1px solid rgba(22,50,92,.1);background:#f8fafc;color:#16325c;border-radius:9px;padding:.42rem .55rem;font-size:.68rem;font-weight:800;cursor:pointer}
      #pres-rehearsal-v10 button.is-primary{background:#0d9488;color:#fff;border-color:#0d9488;flex:1}
      #pres-rehearsal-v10 .r10-result{margin-top:.6rem;padding:.55rem;background:#f8fafc;border-radius:10px;font-size:.68rem;color:#475569;line-height:1.5;display:none}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    injectStyles();
    let panel = document.getElementById('pres-rehearsal-v10');
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'pres-rehearsal-v10';
      panel.innerHTML = `
        <div class="r10-head"><h4>🎤 Sunum Provası</h4><button type="button" id="r10-close" aria-label="Kapat">×</button></div>
        <div class="r10-clock" id="r10-clock">00:00</div>
        <div class="r10-meta" id="r10-meta">Hedef: 10:00 · Prova hazır</div>
        <div class="r10-progress"><b id="r10-progress-fill"></b></div>
        <div class="r10-actions">
          <button type="button" class="is-primary" id="r10-start">Başlat</button>
          <button type="button" id="r10-pause">Duraklat</button>
          <button type="button" id="r10-finish">Bitir</button>
        </div>
        <div class="r10-result" id="r10-result"></div>`;
      document.body.appendChild(panel);
      panel.querySelector('#r10-close').addEventListener('click', close);
      panel.querySelector('#r10-start').addEventListener('click', startOrResume);
      panel.querySelector('#r10-pause').addEventListener('click', pause);
      panel.querySelector('#r10-finish').addEventListener('click', finish);
    }
    ensureLaunchButton();
    return panel;
  }

  function ensureLaunchButton() {
    if (!studioVisible() || document.getElementById('pres-rehearsal-launch-v10')) return;
    const toolbar = document.querySelector('#pres-studio-mode .pres-toolbar');
    if (!toolbar) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'pres-rehearsal-launch-v10';
    button.className = 'pres-r10-launch';
    button.textContent = '🎤 Prova';
    button.addEventListener('click', open);
    toolbar.appendChild(button);
  }

  function targetSeconds() {
    const state = S()?.state?.();
    const fromPresentation = Number(state?.presentation?.target_duration_seconds || state?.presentation?.targetDurationSeconds);
    return Number.isFinite(fromPresentation) && fromPresentation > 30 ? fromPresentation : 600;
  }

  function newSession() {
    const state = S()?.state?.();
    if (!state?.slides?.length) throw new Error('Prova için önce bir sunum açın.');
    return {
      presentationId: state.presentationId,
      target: targetSeconds(),
      startedAt: null,
      elapsedBeforeResume: 0,
      runningSince: null,
      activeIndex: state.activeIndex,
      slideEnteredAt: null,
      timings: Array.from({ length: state.slides.length }, (_, index) => ({ slide_index: index, seconds: 0 })),
      finished: false,
    };
  }

  function elapsedMs() {
    if (!session) return 0;
    return session.elapsedBeforeResume + (session.runningSince ? now() - session.runningSince : 0);
  }

  function commitSlideTime(timestamp) {
    if (!session?.slideEnteredAt || session.activeIndex == null) return;
    const delta = Math.max(0, timestamp - session.slideEnteredAt);
    const row = session.timings[session.activeIndex];
    if (row) row.seconds += seconds(delta);
    session.slideEnteredAt = timestamp;
  }

  function watchSlide(timestamp) {
    if (!session?.runningSince) return;
    const state = S()?.state?.();
    const nextIndex = state?.activeIndex ?? session.activeIndex;
    if (nextIndex !== session.activeIndex) {
      commitSlideTime(timestamp);
      session.activeIndex = nextIndex;
      session.slideEnteredAt = timestamp;
    }
  }

  function tick() {
    if (!session) return;
    const timestamp = now();
    watchSlide(timestamp);
    const elapsed = seconds(elapsedMs());
    const clock = document.getElementById('r10-clock');
    const meta = document.getElementById('r10-meta');
    const fill = document.getElementById('r10-progress-fill');
    if (clock) clock.textContent = format(elapsed);
    if (meta) meta.textContent = `Hedef: ${format(session.target)} · Slayt ${(session.activeIndex || 0) + 1}/${session.timings.length}`;
    if (fill) fill.style.width = `${Math.min(100, (elapsed / session.target) * 100)}%`;
  }

  function startOrResume() {
    try {
      if (!session || session.finished) session = newSession();
      if (session.runningSince) return;
      const timestamp = now();
      if (!session.startedAt) session.startedAt = timestamp;
      session.runningSince = timestamp;
      session.slideEnteredAt = timestamp;
      ticker = ticker || setInterval(tick, 500);
      document.getElementById('r10-result').style.display = 'none';
      tick();
    } catch (error) {
      S()?.notify?.(error?.message || 'Prova başlatılamadı.', 'error');
    }
  }

  function pause() {
    if (!session?.runningSince) return;
    const timestamp = now();
    commitSlideTime(timestamp);
    session.elapsedBeforeResume += timestamp - session.runningSince;
    session.runningSince = null;
    session.slideEnteredAt = null;
    tick();
  }

  function buildFeedback(actual) {
    const diff = actual - session.target;
    const longest = [...session.timings].sort((a, b) => b.seconds - a.seconds)[0];
    const feedback = [];
    if (Math.abs(diff) <= Math.max(30, session.target * 0.08)) feedback.push('Hedef süreye oldukça yakınsınız.');
    else if (diff > 0) feedback.push(`Hedef sürenin ${format(diff)} üzerindesiniz; yoğun slaytları kısaltın.`);
    else feedback.push(`Hedef süreden ${format(Math.abs(diff))} kısasınız; kritik analiz veya örnekleri güçlendirebilirsiniz.`);
    if (longest?.seconds > Math.max(75, session.target * 0.18)) feedback.push(`En uzun anlatım Slayt ${longest.slide_index + 1}: ${format(longest.seconds)}.`);
    return feedback;
  }

  async function persist(actual, feedback) {
    if (!session?.presentationId) return null;
    const client = S()?.resolveSupabase?.();
    if (!client) return null;
    const userResult = await client.auth.getUser();
    const userId = userResult?.data?.user?.id;
    if (!userId) return null;
    const { data, error } = await client.from('presentation_rehearsals').insert({
      presentation_id: session.presentationId,
      user_id: userId,
      target_duration_seconds: session.target,
      actual_duration_seconds: actual,
      slide_timings: session.timings,
      feedback: { messages: feedback },
    }).select('id, created_at').single();
    if (error) {
      if (/does not exist|schema cache/i.test(error.message || '')) return null;
      throw error;
    }
    return data;
  }

  async function finish() {
    if (!session || session.finished) return;
    pause();
    session.finished = true;
    if (ticker) { clearInterval(ticker); ticker = null; }
    const actual = seconds(elapsedMs());
    const feedback = buildFeedback(actual);
    const result = document.getElementById('r10-result');
    if (result) {
      result.style.display = 'block';
      result.textContent = `Gerçek süre ${format(actual)} · ${feedback.join(' ')}`;
    }
    try {
      const saved = await persist(actual, feedback);
      S()?.emit?.('rehearsal:finished', { actual, target: session.target, timings: session.timings, feedback, saved });
      S()?.notify?.(saved ? 'Sunum provası kaydedildi.' : 'Prova tamamlandı. Migration uygulanınca sonuçlar hesaba kaydedilecek.', 'success');
    } catch (error) {
      console.error('Rehearsal persistence failed:', error);
      S()?.notify?.('Prova tamamlandı fakat buluta kaydedilemedi.', 'error');
    }
  }

  function open() {
    if (!studioVisible()) return;
    ensureUi().classList.add('is-open');
    if (!session || session.finished) session = newSession();
    tick();
  }

  function close() {
    document.getElementById('pres-rehearsal-v10')?.classList.remove('is-open');
  }

  function boot() {
    ensureUi();
    const studio = document.getElementById('pres-studio-mode');
    if (!studio) return;
    new MutationObserver(() => ensureLaunchButton()).observe(studio, { childList: true, subtree: true, attributes: true });
  }

  window.AcadexPresentationRehearsalV10 = { version: '10.0.0', open, close, start: startOrResume, pause, finish };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 1100);
})();
