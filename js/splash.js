/**
 * Acadex Splash — Premium Animated Intro Controller
 *
 * Sequence (full animation, ~3.1 s total):
 *   0 ms   — icon wipe reveal begins (750 ms keyframe)
 *   200 ms — first letter starts; stagger +45 ms each → last letter ~425 ms
 *   820 ms — slogan fades in (550 ms transition)
 *   920 ms — progress bar appears + starts filling (1 580 ms duration)
 *   2 500 ms — exit begins (550 ms CSS transition)
 *   3 100 ms — splash hidden
 *
 * Skip button  : calls finishSplash() immediately.
 * Already seen : hidden instantly, no animation, no flicker.
 * prefers-reduced-motion : everything revealed in final state, short hold, hidden.
 */
(function () {
  'use strict';

  const splash        = document.getElementById('splash');
  if (!splash) return;

  const iconWrap      = document.getElementById('splash-icon-wrap');
  const wordmark      = document.getElementById('splash-wordmark');
  const letters       = wordmark ? Array.from(wordmark.querySelectorAll('.splash-letter')) : [];
  const slogan        = document.getElementById('splash-slogan');
  const progressTrack = document.getElementById('splash-progress-track');
  const progressFill  = document.getElementById('splash-progress-fill');
  const skipBtn       = document.getElementById('skip-intro');

  const alreadySeen          = sessionStorage.getItem('acadexSplashSeen') === 'true';
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── Already played — hide immediately, no flicker ─── */
  if (alreadySeen) {
    splash.style.display = 'none';
    return;
  }

  /* ─── Reduced motion — static instant reveal, short hold ─── */
  if (prefersReducedMotion) {
    if (iconWrap)       iconWrap.classList.add('reveal');
    letters.forEach(l => l.classList.add('reveal'));
    if (slogan)         slogan.classList.add('reveal');
    if (progressTrack)  progressTrack.classList.add('reveal');
    if (progressFill)   progressFill.classList.add('running');
    sessionStorage.setItem('acadexSplashSeen', 'true');
    if (skipBtn) skipBtn.addEventListener('click', () => {
      splash.style.transition = 'none';
      splash.style.display = 'none';
    });
    setTimeout(() => {
      splash.style.transition = 'none';
      splash.style.display = 'none';
    }, 1200);
    return;
  }

  /* ─── Timing constants ─── */
  const T_ICON_START      =    0;  // ms — icon wipe
  const T_LETTERS_START   = 1100;  // ms — first letter starts after icon is fully revealed (750ms + 350ms pause)
  const LETTER_STAGGER    =   45;  // ms between letters
  const T_SLOGAN_START    = 1500;  // ms — slogan fades in after wordmark
  const T_PROGRESS_START  = 1600;  // ms — progress bar starts filling
  const PROGRESS_DURATION = 1600;  // ms — duration for progress fill
  const T_EXIT_START      = T_PROGRESS_START + PROGRESS_DURATION;  // 3200 ms
  const EXIT_DURATION     =  550;  // ms — must match CSS transition

  let exitTriggered = false;

  /* ─── Exit ─── */
  function finishSplash() {
    if (exitTriggered) return;
    exitTriggered = true;
    sessionStorage.setItem('acadexSplashSeen', 'true');
    splash.classList.add('splash-exit');
    setTimeout(() => {
      splash.style.display = 'none';
    }, EXIT_DURATION + 100);
  }

  /* ─── Skip button ─── */
  if (skipBtn) {
    skipBtn.addEventListener('click', finishSplash);
  }

  /* ─── 1. Icon clip-path wipe reveal ─── */
  setTimeout(() => {
    if (iconWrap) iconWrap.classList.add('reveal');
  }, T_ICON_START);

  /* ─── 2. Wordmark staggered letter rise ─── */
  letters.forEach((letter, i) => {
    setTimeout(() => {
      letter.classList.add('reveal');
    }, T_LETTERS_START + i * LETTER_STAGGER);
  });

  /* ─── 3. Slogan slide-up ─── */
  setTimeout(() => {
    if (slogan) slogan.classList.add('reveal');
  }, T_SLOGAN_START);

  /* ─── 4. Progress bar fill ─── */
  setTimeout(() => {
    if (!progressTrack || !progressFill) return;
    // Sync CSS animation duration with our JS timing
    progressFill.style.animationDuration = PROGRESS_DURATION + 'ms';
    progressTrack.classList.add('reveal');
    // Double-rAF ensures the reveal opacity transition fires before running starts
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        progressFill.classList.add('running');
      });
    });
  }, T_PROGRESS_START);

  /* ─── 5. Auto exit ─── */
  setTimeout(finishSplash, T_EXIT_START);

})();
