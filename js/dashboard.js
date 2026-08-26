/* ==========================================================================
   ACADEX DASHBOARD CONTROLLER (js/dashboard.js)
   Handles session checking, profile loads, Supabase document uploads/lists,
   signed-URL downloads, custom confirm delete modals, and logouts.
   ========================================================================== */

let currentUser = null;
let currentUserProfile = null;
let activeDocuments = [];
let activeStudyCards = [];
let documentToDelete = null;
let pollingInterval = null;
let previousFocusedElement = null;
let currentActiveTab = 'home';
let activeModalCardId = null;
let isBulkSummarize = false;
let isMergeSummarize = false;
let pendingMergeDocIds = [];
let activeBulkSummarizingDocIds = [];
let currentActiveStudyCard = null;
let departmentFeedLimit = 30;
let feedVoteCounts = {}; // card_id -> number of "helpful" votes
let feedUserVotedSet = new Set(); // card_ids the current user has voted for
let sandboxProjectsLimit = 20;
let notebookHasUnsavedChanges = false;
let docChatHistory = []; // [{ role: 'user' | 'assistant', content: string }] — reset per modal open, never persisted
let isDocChatPaneActive = false;
let docChatHasGreeted = false;
let docChatRequestInFlight = false;
let pendingDocChatImageDataUrl = null; // base64 data URL of an attached screenshot, cleared after each send

// Helper to get YYYY-MM-DD in local time (prevents timezone bugs)
function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

window.addEventListener('beforeunload', (e) => {
  if (notebookHasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes in your notebook — are you sure you want to leave?';
    return e.returnValue;
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify Active Session & Fetch Profile details
  await checkSessionAndLoadProfile();

  // 2. Drag & Drop File Upload Listeners
  initUploadZone();

  // 3. Modal Confirm Action Listeners
  initDeleteModal();

  // 4. Logout Action Listener
  initLogout();

  // 5. Study Card Modal Listeners
  initStudyCardModal();

  // 6. Event Delegation for View Summary Buttons (resilient across views and dynamic content)
  document.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('.btn-view-summary');
    if (viewBtn) {
      e.preventDefault();
      const docId = viewBtn.dataset.docId;
      const docName = viewBtn.dataset.docName;
      const cardId = viewBtn.dataset.cardId;
      const readOnly = viewBtn.dataset.readOnly === 'true';
      console.log("Delegated View Summary clicked: docId =", docId, "docName =", docName, "cardId =", cardId, "readOnly =", readOnly);
      await viewStudyCard(docId, docName, readOnly, cardId);
    }
  });

  // 7. Global Search Listener (Phase 9)
  initGlobalSearch();

  // 8. Pomodoro Floating Widget (Phase 10)
  initPomodoroWidget();

  // 9. Phase 11 General Listeners
  initPhase11Listeners();

  // 10. Acadia AI Study Assistant Widget
  initAcadiaWidget();

  // 11. Chat With Source (NotebookLM-style grounded document Q&A)
  initDocChatForm();
  initSourceHubChatForm();

  // 12. Mermaid.js — free client-side rendering of AI-reconstructed diagrams
  if (window.mermaid) {
    try {
      window.mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
    } catch (e) {
      console.warn('Mermaid initialize failed:', e);
    }
  }
});

// ==========================================
// 1. Session Redirect Guard & Profile Loader
// ==========================================
async function checkSessionAndLoadProfile() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      // Redirect back to login if unauthenticated
      window.location.replace('login.html');
      return;
    }

    currentUser = session.user;
    // Mirror onto window: currentUser/currentUserProfile are top-level `let`
    // bindings, which do NOT become window properties on their own. Other
    // scripts (i18n.js) read window.currentUser / window.currentUserProfile
    // to know whether it's safe to call functions that depend on them —
    // without this mirror those checks always see `undefined` and either
    // silently no-op or (for loadRecentActivity, before this fix) crash on
    // a null reference during the page's very first language-apply pass.
    window.currentUser = currentUser;

    // Fetch profile data from the profiles table
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    currentUserProfile = profile;
    window.currentUserProfile = currentUserProfile;

    // Admin Panel display check (Phase 16B part B)
    if (profile && profile.is_admin) {
      const sideAdmin = document.getElementById('side-admin');
      if (sideAdmin) {
        sideAdmin.style.display = 'block';
      }
      await updateAdminInboxBadge();
    }

    // Streak tracking (Phase 12)
    if (profile) {
      const today = getLocalDateString(); // 'YYYY-MM-DD'
      const lastActive = profile.last_active_date;
      let newStreak = profile.current_streak || 0;
      if (lastActive !== today) {
        const yesterday = getLocalDateString(new Date(Date.now() - 86400000));
        newStreak = (lastActive === yesterday) ? (profile.current_streak || 0) + 1 : 1;
        
        await supabaseClient
          .from('profiles')
          .update({ last_active_date: today, current_streak: newStreak })
          .eq('id', currentUser.id);
          
        profile.last_active_date = today;
        profile.current_streak = newStreak;
        
        if (newStreak === 7) await awardAchievement('streak_7');
        if (newStreak === 30) await awardAchievement('streak_30');
      }
    }

    const nameEl = document.getElementById('user-name');
    const deptEl = document.getElementById('user-dept');
    const welcomeGreeting = document.getElementById('welcome-greeting');
    const welcomeSub = document.getElementById('welcome-sub');

    if (profile) {
      // Display full name or fallback
      const displayName = profile.full_name || currentUser.email.split('@')[0];
      nameEl.textContent = displayName;

      // Display user avatar in top bar
      const topBarAvatar = document.getElementById('topbar-user-avatar');
      if (topBarAvatar) {
        topBarAvatar.innerHTML = renderUserAvatarHtml(profile, 32);
      }
      
      const badgeClass = getDepartmentColorClass(profile.department);
      const shortName = getDepartmentShortName(profile.department);
      deptEl.innerHTML = `${translateDepartment(profile.department)} <span class="dept-badge ${badgeClass}">${shortName}</span>`;

      // Welcome greeting
      const firstName = displayName.split(' ')[0];
      if (welcomeGreeting) {
        welcomeGreeting.textContent = `Welcome back, ${firstName}!`;
      }
      if (welcomeSub) {
        const currentLang = localStorage.getItem('acadexUILang') || 'en';
        const translatedDept = translateDepartment(profile.department);
        if (currentLang === 'tr') {
          welcomeSub.textContent = `Fakülte programında neler olup bittiğine göz at: ${translatedDept || 'Bölümün'}`;
        } else {
          welcomeSub.textContent = `Here's what's happening in ${translatedDept || 'your faculty'}.`;
        }
      }
    } else {
      nameEl.textContent = currentUser.email;
      deptEl.textContent = "Student Program Member";
    }

    // Deep-link from ders-agaci.html: ?course=CODE lands on the Department
    // Feed pre-filtered to that course. The actual filter application happens
    // inside loadDepartmentFeed() via feed-filter-course's dataset.pendingFilter
    // (set here, read+cleared there) since that dropdown's options are only
    // populated once the feed's cards are fetched.
    const deepLinkParams = new URLSearchParams(window.location.search);
    const deepLinkCourse = deepLinkParams.get('course');
    if (deepLinkCourse) {
      currentActiveTab = 'feed';
      const feedFilterCourseEl = document.getElementById('feed-filter-course');
      if (feedFilterCourseEl) feedFilterCourseEl.dataset.pendingFilter = deepLinkCourse.toUpperCase();
    }

    // Load default tab view content
    switchDashboardView(currentActiveTab);
    await updateDepotCountBadge();
    await checkNotifications();

    // Check upcoming exams & trigger notifications (Part E)
    if (!window.examNotificationIntervalWired) {
      window.examNotificationIntervalWired = true;
      checkAndTriggerExamNotifications();
      setInterval(checkAndTriggerExamNotifications, 3600000);
    }

    // Bind notebook search input listener
    const searchInput = document.getElementById('notebook-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        filterNotebookCards();
      });
    }

    // Bind cards search input listener
    const cardsSearchInput = document.getElementById('cards-search');
    if (cardsSearchInput) {
      cardsSearchInput.addEventListener('input', () => {
        filterLibraryCards();
      });
    }

    const cardsFilterStyle = document.getElementById('cards-filter-style');
    const cardsFilterLang = document.getElementById('cards-filter-lang');
    const cardsFilterCourse = document.getElementById('cards-filter-course');
    const btnClearFilters = document.getElementById('btn-clear-filters');

    if (cardsFilterStyle) {
      cardsFilterStyle.addEventListener('change', () => {
        filterLibraryCards();
      });
    }
    if (cardsFilterLang) {
      cardsFilterLang.addEventListener('change', () => {
        filterLibraryCards();
      });
    }
    if (cardsFilterCourse) {
      cardsFilterCourse.addEventListener('change', () => {
        filterLibraryCards();
      });
    }
    if (btnClearFilters) {
      btnClearFilters.addEventListener('click', (e) => {
        e.preventDefault();
        if (cardsSearchInput) cardsSearchInput.value = '';
        if (cardsFilterStyle) cardsFilterStyle.value = 'all';
        if (cardsFilterLang) cardsFilterLang.value = 'all';
        if (cardsFilterCourse) cardsFilterCourse.value = 'all';
        filterLibraryCards();
      });
    }

    const btnExportAllPdf = document.getElementById('btn-export-all-pdf');
    if (btnExportAllPdf) {
      btnExportAllPdf.addEventListener('click', (e) => {
        e.preventDefault();
        exportAllFilteredCardsToPDF();
      });
    }


    // Start Guided Tour automatically if not completed
    if (currentUserProfile && currentUserProfile.onboarding_completed === false) {
      setTimeout(() => {
        startOnboardingTour();
      }, 1500);
    }

  } catch (err) {
    console.error("Failed to load session/profile info: ", err);
    window.location.replace('login.html');
  }
}

// ==========================================
// 2. Documents List Fetch & Render
// ==========================================
async function loadDocuments(isPolling = false) {
  const docsGrid = document.getElementById('docs-grid');
  if (!docsGrid) return;

  try {
    const [docsRes, cardsRes] = await Promise.all([
      supabaseClient
        .from('documents')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('uploaded_at', { ascending: false }),
      supabaseClient
        .from('study_cards')
        .select('id, document_id, summary_style, summary_language, created_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
    ]);

    if (docsRes.error) {
      console.error("Error fetching documents: ", docsRes.error);
      if (!isPolling) {
        showDashboardAlert('error', 'Could not load your documents. Please refresh the page.');
      }
      return;
    }

    activeDocuments = docsRes.data || [];
    activeStudyCards = cardsRes.data || [];
    renderDocumentsList();

    if (activeStudyCards.length > 0) {
      checkAndAwardFirstSummary();
    }

    // Polling setup: re-fetch if any document is in the 'processing' state
    const hasProcessing = activeDocuments.some(doc => doc.status === 'processing');
    if (hasProcessing) {
      if (!pollingInterval) {
        // 1.5s (was 2s) — snappier-feeling live progress without meaningfully
        // increasing load (this is a lightweight status query, not the AI call).
        pollingInterval = setInterval(() => loadDocuments(true), 1500);
      }
    } else {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    }

  } catch (err) {
    console.error("Exception loading documents: ", err);
    if (!isPolling) {
      showDashboardAlert('error', 'Could not load your documents. Please refresh the page.');
    }
  }
}

function renderDocumentsList() {
  const docsSection = document.getElementById('docs-list-section');
  if (!docsSection) return;

  if (activeDocuments.length === 0) {
    // Render Empty State
    docsSection.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="12" y2="12"></line>
          <line x1="15" y1="15" x2="12" y2="12"></line>
        </svg>
        <h3 class="empty-state-title">No documents uploaded</h3>
        <p class="empty-state-text">You haven't uploaded any documents yet. Drag a lecture slide, syllabus, or article above to get started!</p>
      </div>
    `;
    return;
  }

  // Create grid container
  docsSection.innerHTML = `<div class="docs-grid" id="docs-grid"></div>`;
  const grid = document.getElementById('docs-grid');

  activeDocuments.forEach(doc => {
    // Format variables
    const formattedDate = new Date(doc.uploaded_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    const sizeInKB = doc.file_size / 1024;
    const formattedSize = sizeInKB > 1024 
      ? `${(sizeInKB / 1024).toFixed(2)} MB` 
      : `${sizeInKB.toFixed(1)} KB`;

    // Map extensions to icons and styles
    const fileExt = doc.file_name.split('.').pop().toLowerCase();
    let fileClass = 'text';
    let iconSvg = '';

    if (fileExt === 'pdf') {
      fileClass = 'pdf';
      iconSvg = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>';
    } else if (fileExt === 'docx' || fileExt === 'doc') {
      fileClass = 'word';
      iconSvg = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15v-4h3"></path><path d="M12 15V11h3"></path><line x1="9" y1="13" x2="15" y2="13"></line>';
    } else if (fileExt === 'pptx' || fileExt === 'ppt') {
      fileClass = 'powerpoint';
      iconSvg = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><circle cx="12" cy="14" r="3"></circle>';
    } else {
      fileClass = 'text';
      iconSvg = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="12" y1="17" x2="8" y2="17"></line>';
    }

    // Determine status badge layouts and primary actions
    let statusBadgeHtml = '';
    let actionBtnHtml = '';
    let failureNoteHtml = '';

    if (doc.status === 'processing') {
      const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
      let progressMsg = isTr ? 'İşleniyor...' : 'Processing...';
      let progressIcon = '📄';
      // Madde 6 stages: extracting → analyzing/chunking → synthesizing →
      // draft_ready → reviewing → saving (mapped to progress bar %).
      let progressPercent = 8;
      if (doc.processing_stage === 'extracting') {
        progressMsg = isTr ? 'Metin çıkarılıyor...' : 'Extracting text...';
        progressIcon = '📄';
        progressPercent = 18;
      } else if (doc.processing_stage === 'analyzing') {
        progressMsg = isTr ? 'Özet oluşturuluyor...' : 'Analyzing content...';
        progressIcon = '🧠';
        progressPercent = 40;
      } else if (doc.processing_stage === 'chunking' || (typeof doc.processing_stage === 'string' && doc.processing_stage.startsWith('chunking'))) {
        const m = String(doc.processing_stage || '').match(/chunking:(\d+)\/(\d+)/);
        progressIcon = '🧩';
        if (m) {
          progressMsg = isTr ? `Bölümler işleniyor... (${m[1]}/${m[2]})` : `Processing sections... (${m[1]}/${m[2]})`;
          const a = parseInt(m[1], 10), b = parseInt(m[2], 10) || 1;
          progressPercent = 40 + Math.min(25, Math.round((a / b) * 25));
        } else {
          progressMsg = isTr ? 'Bölümler işleniyor...' : 'Processing sections...';
          progressPercent = 45;
        }
      } else if (doc.processing_stage === 'synthesizing') {
        progressMsg = isTr ? 'Birleştiriliyor...' : 'Synthesizing summary...';
        progressIcon = '🧠';
        progressPercent = 58;
      } else if (doc.processing_stage === 'sectioning') {
        progressMsg = isTr ? 'Bölüm özetleri derinleştiriliyor...' : 'Deepening section summaries...';
        progressIcon = '📚';
        progressPercent = 62;
      } else if (doc.processing_stage === 'writing') {
        progressMsg = isTr ? 'Profesyonel anlatı yazılıyor...' : 'Writing professional narrative...';
        progressIcon = '✍️';
        progressPercent = 70;
      } else if (doc.processing_stage === 'draft_ready') {
        progressMsg = isTr ? 'Taslak hazır, kontrol ediliyor...' : 'Draft ready, reviewing...';
        progressIcon = '🔍';
        progressPercent = 76;
      } else if (doc.processing_stage === 'reviewing') {
        progressMsg = isTr ? 'Doğruluk kontrol ediliyor...' : 'Reviewing for accuracy...';
        progressIcon = '🔍';
        progressPercent = 86;
      } else if (doc.processing_stage === 'critic') {
        progressMsg = isTr ? 'Kalite kapısı: düzeltiliyor...' : 'Quality gate: fixing issues...';
        progressIcon = '✨';
        progressPercent = 92;
      } else if (doc.processing_stage === 'saving') {
        progressMsg = isTr ? 'Kart kaydediliyor...' : 'Saving study card...';
        progressIcon = '💾';
        progressPercent = 96;
      }

      const badgeText = isTr ? 'İşleniyor' : 'Processing';
      statusBadgeHtml = `<span class="doc-status-badge" style="background-color: #FEF3C7; color: #D97706; font-weight: 700;">${badgeText}</span>`;
      // HOTFIX: if processing > 3.5 min, offer reset (Edge timeout can leave docs stuck)
      const updatedMs = doc.updated_at ? new Date(doc.updated_at).getTime() : (doc.created_at ? new Date(doc.created_at).getTime() : Date.now());
      const stuckTooLong = (Date.now() - updatedMs) > 210000;
      actionBtnHtml = `
        <div class="doc-progress-wrap" style="margin-top: 0.5rem;">
          <div class="doc-progress-label">
            <span class="doc-progress-stage-icon" style="font-size: 0.9rem; line-height: 1;">${progressIcon}</span>
            <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 12px; height: 12px; flex-shrink: 0;">
              <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
            </svg>
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${progressMsg}</span>
          </div>
          <div class="doc-progress-track">
            <div class="doc-progress-fill" style="width: ${progressPercent}%;"></div>
          </div>
          ${stuckTooLong ? `<button type="button" class="btn btn-outline" onclick="resetStuckDocument('${doc.id}')" style="margin-top:0.45rem; width:100%; font-size:0.75rem; padding:0.35rem 0.5rem; color:#b45309; border-color:#f59e0b;">${isTr ? 'Takıldı — sıfırla ve tekrar dene' : 'Stuck — reset & retry'}</button>` : ''}
        </div>
      `;
    } else if (doc.status === 'summarized') {
      statusBadgeHtml = `<span class="doc-status-badge" style="background-color: #D1FAE5; color: #059669; font-weight: 700;">Summarized</span>`;
      
      const docCards = activeStudyCards.filter(c => c.document_id === doc.id);
      if (docCards.length > 1) {
        actionBtnHtml = `
          <div class="dropdown" style="position: relative; width: 100%; margin-top: 0.5rem;">
            <button class="btn btn-outline dropdown-toggle" onclick="toggleDocDropdown(event, '${doc.id}')" style="width: 100%; padding: 0.5rem 1rem; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
              <span>View Summary</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div id="dropdown-menu-${doc.id}" class="dropdown-menu" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--color-white); border: 1px solid rgba(22, 50, 92, 0.15); border-radius: var(--radius-sm); box-shadow: var(--shadow-md); z-index: 100; margin-top: 0.25rem; overflow: hidden; max-height: 200px; overflow-y: auto;">
              ${docCards.map(c => {
                const styleName = getStyleLabel(c.summary_style);
                const langName = c.summary_language === 'tr' ? 'Türkçe' : 'English';
                const formattedTime = new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `
                  <a href="#" class="dropdown-item" onclick="viewStudyCardWrapper(event, '${doc.id}', '${doc.file_name.replace(/'/g, "\\'")}', '${c.id}')" style="display: block; padding: 0.5rem 0.75rem; font-size: 0.75rem; color: var(--color-navy); text-decoration: none; border-bottom: 1px solid rgba(22, 50, 92, 0.05); text-align: left; transition: background-color 0.2s;">
                    <strong>${styleName}</strong> — ${langName} <span style="color: var(--color-text-muted); font-size: 0.65rem; display: block; margin-top: 0.1rem;">${formattedTime}</span>
                  </a>
                `;
              }).join('')}
            </div>
          </div>
          <button class="btn-resummarize" onclick="openResummarizeModal('${doc.id}')" style="width: 100%; margin-top: 0.35rem; font-size: 0.75rem; color: var(--color-teal); background: none; border: none; cursor: pointer; text-decoration: underline; text-align: center; font-weight: 600;">Re-summarize with different style</button>
        `;
      } else {
        const cardId = docCards.length === 1 ? docCards[0].id : '';
        actionBtnHtml = `
          <button class="btn btn-outline btn-view-summary" data-doc-id="${doc.id}" data-doc-name="${doc.file_name.replace(/'/g, "\\'")}" data-card-id="${cardId}" style="width: 100%; padding: 0.5rem 1rem; font-size: 0.85rem; margin-top: 0.5rem;">View Summary</button>
          <button class="btn-resummarize" onclick="openResummarizeModal('${doc.id}')" style="width: 100%; margin-top: 0.35rem; font-size: 0.75rem; color: var(--color-teal); background: none; border: none; cursor: pointer; text-decoration: underline; text-align: center; font-weight: 600;">Re-summarize with different style</button>
        `;
      }
    } else {
      // 'uploaded' or 'failed'
      if (doc.status === 'failed') {
        statusBadgeHtml = `<span class="doc-status-badge" style="background-color: #FEE2E2; color: #DC2626; font-weight: 700;">Failed</span>`;
        failureNoteHtml = `
          <div class="card-failure-note">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Summarization failed, try again.</span>
          </div>
        `;
      } else {
        statusBadgeHtml = `<span class="doc-status-badge">Uploaded</span>`;
      }

      actionBtnHtml = `
        <button class="btn btn-primary" id="btn-sum-${doc.id}" onclick="summarizeDocument('${doc.id}')" style="width: 100%; border: none; padding: 0.5rem 1rem; font-size: 0.85rem; margin-top: 0.5rem;">Summarize</button>
      `;
    }

    const card = document.createElement('div');
    card.className = 'doc-card';
    card.id = `doc-card-${doc.id}`;
    card.innerHTML = `
      <input type="checkbox" class="doc-bulk-select-checkbox" data-doc-id="${doc.id}" onclick="handleDocCheckboxClick(event)" style="position: absolute; top: 0.5rem; left: 0.5rem; width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-teal); z-index: 10;">
      <div class="doc-header" style="padding-left: 0.75rem;">
        <div class="doc-file-icon ${fileClass}">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${iconSvg}
          </svg>
        </div>
        <div class="doc-info">
          <h4 class="doc-name" title="${doc.file_name}">${doc.file_name}</h4>
          <div class="doc-meta">
            <span>${formattedSize}</span>
            <span>&bull;</span>
            <span>${formattedDate}</span>
          </div>
        </div>
      </div>
      
      ${failureNoteHtml}
      ${actionBtnHtml}

      <!-- Course Tag Pill (Phase 17) -->
      <div class="doc-course-tag-wrapper" style="margin-top: 0.5rem;" data-doc-id="${doc.id}">
        ${doc.course_tag
          ? `<span class="course-tag-pill" onclick="startEditCourseTag('${doc.id}', this)" title="Click to edit course tag" style="display: inline-flex; align-items: center; gap: 0.3rem; background: var(--color-teal-light); color: var(--color-teal); font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 20px; cursor: pointer; transition: background 0.2s;">
              🏷️ ${doc.course_tag}
            </span>`
          : `<button class="add-course-tag-btn" onclick="startEditCourseTag('${doc.id}', this)" style="display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.7rem; color: var(--color-text-muted); background: none; border: 1px dashed rgba(22,50,92,0.2); border-radius: 20px; padding: 0.2rem 0.55rem; cursor: pointer; transition: all 0.2s;">
              + Add course tag
            </button>`
        }
      </div>

      <div class="doc-footer" style="margin-top: 0.25rem;">
        ${statusBadgeHtml}
        <div class="doc-actions">
          <button class="btn-icon btn-download" title="Download File" onclick="downloadDocument('${doc.storage_path}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
          <button class="btn-icon btn-delete" title="Delete File" onclick="confirmDeleteDocument('${doc.id}', '${doc.storage_path}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ==========================================
// 3. Document Download Handler (Signed URL)
// ==========================================
async function downloadDocument(storagePath) {
  try {
    const { data, error } = await supabaseClient.storage
      .from('documents')
      .createSignedUrl(storagePath, 60); // link valid for 60 seconds

    if (error) {
      console.error("Signed URL creation failed: ", error);
      showDashboardAlert('error', 'Download link generation failed. Please try again.');
      return;
    }

    if (data && data.signedUrl) {
      // Open in a new tab or trigger an direct download
      const tempLink = document.createElement('a');
      tempLink.href = data.signedUrl;
      tempLink.target = '_blank';
      tempLink.setAttribute('download', ''); // hint browser to download
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
    }
  } catch (err) {
    console.error("Exception during download: ", err);
    showDashboardAlert('error', 'Download failed. Please try again.');
  }
}

// ==========================================
// 4. Drag & Drop Upload Zone Setup
// ==========================================
function initUploadZone() {
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');

  if (!uploadZone || !fileInput) return;

  // Open file selector when clicking the drop zone
  uploadZone.addEventListener('click', () => {
    fileInput.click();
  });

  // Space/Enter click trigger for keyboard users
  uploadZone.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // Handle selected files
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleMultipleFilesUpload(files);
    }
  });

  // Drag over effects
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleMultipleFilesUpload(files);
    }
  });
}

async function handleFileUpload(file) {
  const uploadZone = document.getElementById('upload-zone');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  
  if (!file) return;

  // File size validation (max 20MB)
  const maxSize = 20 * 1024 * 1024;
  if (file.size > maxSize) {
    showDashboardAlert('error', 'File size exceeds the 20MB limit.');
    return;
  }

  // File type validation (.pdf, .docx, .pptx, .txt)
  const allowedExtensions = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'txt'];
  const fileExt = file.name.split('.').pop().toLowerCase();
  if (!allowedExtensions.includes(fileExt)) {
    showDashboardAlert('error', 'Unsupported format. Please upload PDF, Word, PowerPoint, or TXT files.');
    return;
  }

  // Duplicate Check (Part C)
  const { shouldUpload, fileHash } = await checkFileHashDuplicate(file);
  if (!shouldUpload) {
    return;
  }

  // Set visual upload state
  uploadZone.style.pointerEvents = 'none';
  progressContainer.style.display = 'block';
  progressBar.style.width = '10%';

  // Slow mock progress animation to look responsive (standard Supabase JS doesn't expose standard progress hook)
  let progressInterval = setInterval(() => {
    let currentWidth = parseFloat(progressBar.style.width);
    if (currentWidth < 85) {
      progressBar.style.width = `${currentWidth + 10}%`;
    }
  }, 100);

  const storagePath = `${currentUser.id}/${Date.now()}_${file.name}`;

  try {
    // 1. Upload to Supabase Storage private bucket
    const { data, error } = await supabaseClient.storage
      .from('documents')
      .upload(storagePath, file);

    if (error) {
      console.error("Storage upload failed: ", error);
      clearInterval(progressInterval);
      showDashboardAlert('error', 'File upload failed. Please try again.');
      resetUploadUI();
      return;
    }

    // 2. Insert metadata row into public.documents table
    const { data: insertedDoc, error: dbError } = await supabaseClient
      .from('documents')
      .insert({
        user_id: currentUser.id,
        file_name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type || getMimeTypeFromExtension(file.name),
        status: 'uploaded',
        file_hash: fileHash,
        department: currentUserProfile ? currentUserProfile.department : null
      })
      .select()
      .single();

    clearInterval(progressInterval);

    if (dbError) {
      console.error("Document DB insert failed: ", dbError);
      // clean up orphaned storage file
      await supabaseClient.storage.from('documents').remove([storagePath]);
      showDashboardAlert('error', 'Failed to register document in portal. Please try again.');
      resetUploadUI();
      return;
    }

    if (insertedDoc) {
      activeDocuments.unshift(insertedDoc);
      renderDocumentsList();
    }

    // Finish progress bar
    progressBar.style.width = '100%';
    setTimeout(async () => {
      showDashboardAlert('success', 'Document uploaded successfully!');
      resetUploadUI();
      await loadDocuments(); // Reload list to ensure fully in-sync
    }, 400);

  } catch (err) {
    console.error("Exception during upload flow: ", err);
    clearInterval(progressInterval);
    showDashboardAlert('error', 'An unexpected error occurred. Please try again.');
    resetUploadUI();
  }
}

function resetUploadUI() {
  const uploadZone = document.getElementById('upload-zone');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const fileInput = document.getElementById('file-input');

  uploadZone.style.pointerEvents = '';
  progressContainer.style.display = 'none';
  progressBar.style.width = '0%';
  fileInput.value = ''; // clear input selection
}

function getMimeTypeFromExtension(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (ext === 'ppt') return 'application/vnd.ms-powerpoint';
  if (ext === 'txt') return 'text/plain';
  return 'application/octet-stream';
}

// ==========================================
// 5. Custom Modal Confirm Delete Setup
// ==========================================
function initDeleteModal() {
  const modal = document.getElementById('delete-modal');
  const cancelBtn = document.getElementById('btn-delete-cancel');
  const confirmBtn = document.getElementById('btn-delete-confirm');

  if (!modal || !cancelBtn || !confirmBtn) return;

  // Cancel closes the modal
  cancelBtn.addEventListener('click', () => {
    closeDeleteModal();
  });

  // Confirm triggers delete transactions
  confirmBtn.addEventListener('click', async () => {
    if (!documentToDelete) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';

    try {
      // 1. Delete object from storage bucket
      const { error: storageError } = await supabaseClient.storage
        .from('documents')
        .remove([documentToDelete.storagePath]);

      if (storageError) {
        console.error("Storage delete failed: ", storageError);
        showDashboardAlert('error', 'Could not delete the file from storage. Please try again.');
        closeDeleteModal();
        return;
      }

      // 2. Delete metadata row from DB
      const { error: dbError } = await supabaseClient
        .from('documents')
        .delete()
        .eq('id', documentToDelete.docId);

      if (dbError) {
        console.error("DB row delete failed: ", dbError);
        showDashboardAlert('error', 'Could not delete document records. Please try again.');
        closeDeleteModal();
        return;
      }

      // Success
      showDashboardAlert('success', 'Document deleted successfully.');
      closeDeleteModal();
      await loadDocuments(); // Reload list

    } catch (err) {
      console.error("Exception during document deletion: ", err);
      showDashboardAlert('error', 'An error occurred during deletion. Please try again.');
      closeDeleteModal();
    }
  });
}

function confirmDeleteDocument(docId, storagePath) {
  documentToDelete = { docId, storagePath };
  if (window.openModalWithFocus) {
    window.openModalWithFocus('delete-modal');
  } else {
    const modal = document.getElementById('delete-modal');
    if (modal) modal.classList.add('active');
  }
}

function closeDeleteModal() {
  const confirmBtn = document.getElementById('btn-delete-confirm');
  
  if (window.closeModalWithFocus) {
    window.closeModalWithFocus('delete-modal');
  } else {
    const modal = document.getElementById('delete-modal');
    if (modal) modal.classList.remove('active');
  }
  
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Delete';
  }
  
  documentToDelete = null;
}

// ==========================================
// 6. Log Out Controller
// ==========================================
function initLogout() {
  const logoutBtn = document.getElementById('btn-logout');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        console.error("Signout error: ", error);
        showDashboardAlert('error', 'Log out failed. Please try again.');
        return;
      }
      
      // Clean sessionStorage to trigger splash on next entry
      sessionStorage.removeItem('acadexSplashSeen');
      window.location.replace('index.html');
    } catch (err) {
      console.error("Exception during signout: ", err);
      window.location.replace('index.html');
    }
  });
}

// ==========================================
// 7. General Alert Notification Helper
// ==========================================
function showDashboardAlert(type, message) {
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    const container = document.getElementById('dashboard-alert-container');
    if (!container) return;
    container.innerHTML = '';
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.style.marginTop = '1rem';
    alertEl.style.marginBottom = '1rem';
    alertEl.setAttribute('role', type === 'error' ? 'alert' : 'status');
    alertEl.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;">
        ${type === 'error' 
          ? '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>' 
          : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'}
      </svg>
      <span>${message}</span>
    `;
    container.appendChild(alertEl);
  }
}

// ==========================================
// 8. AI Summarization Invoker
// ==========================================
let activeSummarizingDocId = null;

function openSummaryStyleModal() {
  const standardRadio = document.querySelector('input[name="summary-style-choice"][value="standard"]');
  if (standardRadio) standardRadio.checked = true;
  const enRadio = document.querySelector('input[name="summary-language-choice"][value="en"]');
  if (enRadio) enRadio.checked = true;

  // Visual check
  const visualContainer = document.getElementById('visual-analysis-container');
  const visualCheckbox = document.getElementById('chk-analyze-visuals');
  if (visualCheckbox) visualCheckbox.checked = false; // Reset to false by default

  let isVisualSupported = false;
  if (activeSummarizingDocId) {
    const doc = activeDocuments.find(d => d.id === activeSummarizingDocId);
    if (doc) {
      const fileName = (doc.file_name || '').toLowerCase();
      const mime = (doc.mime_type || '').toLowerCase();
      isVisualSupported = fileName.endsWith('.pdf') || mime === 'application/pdf' ||
                          fileName.endsWith('.pptx') || mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                          fileName.endsWith('.docx') || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
  }

  if (visualContainer) {
    visualContainer.style.display = isVisualSupported ? 'block' : 'none';
  }

  if (window.openModalWithFocus) {
    window.openModalWithFocus('summary-style-modal');
  } else {
    const modal = document.getElementById('summary-style-modal');
    if (modal) modal.classList.add('active');
  }
}
window.openSummaryStyleModal = openSummaryStyleModal;

function closeSummaryStyleModal() {
  if (window.closeModalWithFocus) {
    window.closeModalWithFocus('summary-style-modal');
  } else {
    const modal = document.getElementById('summary-style-modal');
    if (modal) modal.classList.remove('active');
  }
  activeSummarizingDocId = null;
}
window.closeSummaryStyleModal = closeSummaryStyleModal;

function summarizeDocument(docId) {
  activeSummarizingDocId = docId;
  openSummaryStyleModal();
}
window.summarizeDocument = summarizeDocument;

function openResummarizeModal(docId) {
  activeSummarizingDocId = docId;
  openSummaryStyleModal();
}
window.openResummarizeModal = openResummarizeModal;

/** HOTFIX: Edge timeout can leave status=processing forever */
async function resetStuckDocument(docId) {
  try {
    await supabaseClient.from('documents').update({
      status: 'uploaded',
      processing_stage: null
    }).eq('id', docId);
    showDashboardAlert('info', 'Belge sıfırlandı. Tekrar «Özetle» ile deneyin. / Document reset — try Summarize again.');
    if (typeof loadDocuments === 'function') loadDocuments(true);
  } catch (e) {
    console.error(e);
    showDashboardAlert('error', 'Sıfırlama başarısız / Reset failed');
  }
}
window.resetStuckDocument = resetStuckDocument;

async function proceedWithSummarization() {
  const styleSelect = document.querySelector('input[name="summary-style-choice"]:checked');
  let summaryStyle = styleSelect ? styleSelect.value : 'standard';
  const langSelect = document.querySelector('input[name="summary-language-choice"]:checked');
  const language = langSelect ? langSelect.value : 'en';
  const lengthSelect = document.querySelector('input[name="summary-length-choice"]:checked');
  let summaryLength = lengthSelect ? lengthSelect.value : 'medium';
  const depthSelect = document.querySelector('input[name="summary-depth-choice"]:checked');
  const summaryDepth = depthSelect ? depthSelect.value : 'standard';
  // Depth can nudge length/style for better defaults
  if (summaryDepth === 'brief' && summaryLength === 'medium') summaryLength = 'short';
  if (summaryDepth === 'deep' && summaryLength !== 'detailed') summaryLength = 'detailed';
  if (summaryDepth === 'exam' && summaryStyle === 'standard') summaryStyle = 'exam_focused';

  if (isMergeSummarize) {
    closeSummaryStyleModal();
    await triggerMergeSummarize(pendingMergeDocIds, summaryStyle, language, summaryLength, undefined, summaryDepth);
    isMergeSummarize = false;
    pendingMergeDocIds = [];
    return;
  }

  if (isBulkSummarize) {
    closeSummaryStyleModal();
    await proceedWithBulkSummarization(summaryStyle, language, summaryLength, summaryDepth);
    return;
  }

  if (!activeSummarizingDocId) return;
  const docId = activeSummarizingDocId;

  closeSummaryStyleModal();

  const card = document.getElementById(`doc-card-${docId}`);
  const btn = document.getElementById(`btn-sum-${docId}`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 14px; height: 14px; margin-right: 8px;">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
      </svg>
      Summarizing & reviewing...
    `;
  }

  const visualCheckbox = document.getElementById('chk-analyze-visuals');
  const analyzeVisuals = (visualCheckbox && visualCheckbox.checked && visualCheckbox.closest('#visual-analysis-container')?.style.display !== 'none') || false;

  try {
    // Show the live "processing" UI INSTANTLY — no network round trip on the
    // critical path. The previous version of this fix awaited the DB update
    // and then awaited loadDocuments(true) to read it back before rendering
    // progress. That still raced: if the update's round trip was slow (or
    // its result just hadn't propagated back to a read yet), loadDocuments
    // would re-render using the OLD 'uploaded' status and the progress UI
    // would never appear for that run — only a later manual page reload
    // (which reads the server's by-then-updated true state) ever showed it,
    // which is exactly the "only works after F5" symptom. Mutating the
    // local activeDocuments cache directly and re-rendering synchronously
    // removes the server round trip from the critical path entirely, so
    // this can no longer race.
    const localDoc = activeDocuments.find(d => d.id === docId);
    if (localDoc) {
      localDoc.status = 'processing';
      localDoc.processing_stage = null;
    }
    renderDocumentsList();
    if (!pollingInterval) {
      pollingInterval = setInterval(() => loadDocuments(true), 1500);
    }

    // Persist to the database too, for multi-device sync and so a page
    // reload mid-run picks up the true state — but its outcome no longer
    // gates whether the progress UI appears.
    const { error: statusUpdateError } = await supabaseClient
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', docId);
    if (statusUpdateError) {
      console.error('Failed to persist "processing" status to the database (UI already shows progress locally):', statusUpdateError);
    }

    const { data, error } = await supabaseClient.functions.invoke('summarize-document', {
      body: { documentId: docId, summaryStyle: summaryStyle, language: language, summaryLength: summaryLength, analyzeVisuals: analyzeVisuals, depth: summaryDepth }
    });

    if (error) {
      console.error("AI invocation returned error details: ", error);
      let errorMsg = 'Summarization failed. Please check your connection and try again.';
      try {
        if (error.context) {
          const bodyText = await error.context.text();
          const parsed = JSON.parse(bodyText);
          if (parsed && parsed.error) {
            errorMsg = parsed.error;
          }
        }
      } catch (parseErr) {
        console.error("Failed to parse HTTP error body:", parseErr);
      }
      showDashboardAlert('error', errorMsg);
      await loadDocuments(); // Reload to reset card state
      return;
    }

    if (data && data.success) {
      const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
      showDashboardAlert('success', isTr ? 'Özet hazır!' : 'Summary ready!');
      await loadDocuments();
      // Auto-deliver: open the finished summary immediately instead of
      // leaving the student to notice the card flipped to "Summarized" and
      // click "View Summary" themselves — the whole point of watching the
      // progress bar is to get the summary the moment it's done.
      if (data.studyCardId) {
        const doc = activeDocuments.find(d => d.id === docId);
        viewStudyCard(docId, doc ? doc.file_name : '', false, data.studyCardId);
      }
    }
  } catch (err) {
    console.error("Exception invoking summarize-document: ", err);
    showDashboardAlert('error', 'Edge function invocation failed. Please try again.');
    await loadDocuments();
  }
}
window.proceedWithSummarization = proceedWithSummarization;

// ==========================================
// 9. Study Card Modal Renderer & Populator
// ==========================================
function initStudyCardModal() {
  const modal = document.getElementById('study-card-modal');
  const closeBtn = document.getElementById('btn-close-study-card');

  if (!modal || !closeBtn) return;

  closeBtn.addEventListener('click', () => {
    closeStudyCardModal();
  });

  // Close modal when clicking on overlay background
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeStudyCardModal();
    }
  });
}

function getStyleLabel(style) {
  switch (style) {
    case 'bullet': return 'Bullet Points';
    case 'outline': return 'Structured Outline';
    case 'simplified': return 'Simplified';
    case 'exam_focused': return 'Exam-Focused';
    default: return 'Standard';
  }
}
window.getStyleLabel = getStyleLabel;

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

const ACADEX_CHART_COLORS = [
  '#16325C', // Navy
  '#14B8A6', // Teal
  '#F59E0B', // Amber
  '#F43F5E', // Rose
  '#6366F1', // Indigo
  '#10B981'  // Emerald
];

function renderChartJs(canvasEl, chartObj) {
  if (!canvasEl || !chartObj) return null;
  
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js library is not loaded.');
    return null;
  }

  // Destroy existing chart on canvas if any
  if (canvasEl.__chartInstance) {
    try { canvasEl.__chartInstance.destroy(); } catch(e){}
    canvasEl.__chartInstance = null;
  }
  
  const ctx = canvasEl.getContext('2d');
  const type = (chartObj.type || 'bar').toLowerCase();
  const validTypes = ['bar', 'pie', 'line', 'doughnut'];
  const chartType = validTypes.includes(type) ? type : 'bar';
  
  const labels = chartObj.labels || [];
  const dataValues = chartObj.data || [];
  
  const bgColors = labels.map((_, i) => ACADEX_CHART_COLORS[i % ACADEX_CHART_COLORS.length]);
  
  const config = {
    type: chartType,
    data: {
      labels: labels,
      datasets: [{
        label: chartObj.title || 'Data',
        data: dataValues,
        backgroundColor: chartType === 'line' ? 'rgba(20, 184, 166, 0.15)' : bgColors,
        borderColor: chartType === 'line' ? '#14B8A6' : bgColors,
        borderWidth: 2,
        fill: chartType === 'line',
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: chartType === 'pie' || chartType === 'doughnut',
          position: 'bottom',
          labels: { font: { family: 'Inter', size: 10 } }
        },
        title: { display: false }
      },
      scales: (chartType === 'pie' || chartType === 'doughnut') ? {} : {
        y: { beginAtZero: true, grid: { color: 'rgba(22,50,92,0.06)' }, ticks: { font: { family: 'Inter', size: 10 } } },
        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } }
      }
    }
  };
  
  try {
    const chart = new Chart(ctx, config);
    canvasEl.__chartInstance = chart;
    return chart;
  } catch (err) {
    console.error('Failed to create Chart.js instance:', err);
    return null;
  }
}
window.renderChartJs = renderChartJs;


function formatFootnoteMarkers(text, footnotesArray) {
  if (!text) return "";
  const footnotesMap = {};
  if (Array.isArray(footnotesArray)) {
    footnotesArray.forEach(fn => {
      if (fn && fn.id != null) {
        const page = (typeof fn.page === 'number' && Number.isFinite(fn.page)) ? fn.page : null;
        footnotesMap[fn.id] = { reference: fn.reference || `Reference ${fn.id}`, page };
      }
    });
  }

  return text.replace(/\[(\d+)\]/g, (match, fnId) => {
    const entry = footnotesMap[fnId] || { reference: `Reference ${fnId}`, page: null };
    const escapedRef = escapeHtml(entry.reference).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const pageAttr = entry.page != null ? entry.page : 'null';
    const title = entry.page != null ? `${escapedRef} (Sayfa ${entry.page})` : escapedRef;
    return `<sup class="footnote-marker" title="${title}" onclick="event.stopPropagation(); jumpToFootnote(${fnId}, '${escapedRef}', ${pageAttr})">[${fnId}]</sup>`;
  });
}
window.formatFootnoteMarkers = formatFootnoteMarkers;

function renderFootnotesSectionHtml(footnotesArray) {
  if (!Array.isArray(footnotesArray) || footnotesArray.length === 0) return "";

  let itemsHtml = footnotesArray.map(fn => {
    const page = (typeof fn.page === 'number' && Number.isFinite(fn.page)) ? fn.page : null;
    const pageBadge = page != null ? ` <span class="footnote-page-badge">📄 Sayfa ${page}</span>` : '';
    return `
    <li id="fn-ref-${fn.id}">
      <strong>[${fn.id}]</strong> ${escapeHtml(fn.reference || '')}${pageBadge}
    </li>
  `;
  }).join('');

  return `
    <div class="footnotes-section">
      <div class="footnotes-title">📎 References / Kaynakça</div>
      <ol class="footnotes-list">
        ${itemsHtml}
      </ol>
    </div>
  `;
}
window.renderFootnotesSectionHtml = renderFootnotesSectionHtml;

// Hierarchical/structural summaries: the AI now optionally breaks a
// substantial document into 2-6 major topic SECTIONS (card.sections), each
// with its own short heading + blurb — a NotebookLM-style navigable outline
// so a student can jump straight to the topic they need instead of reading
// one long undifferentiated summary. Rendered as a collapsible accordion
// placed just above the main summary text. Short/single-topic documents
// legitimately have fewer than 2 sections, in which case this renders
// nothing and the plain summary below is unaffected — no forced structure.
function renderSectionsOutlineHtml(sectionsArray, footnotesArray) {
  // Madde 2: deep sections — show even with 1 section; hide only if empty
  if (!Array.isArray(sectionsArray) || sectionsArray.length < 1) return "";

  const itemsHtml = sectionsArray.map((sec, idx) => {
    const kps = Array.isArray(sec?.key_points) ? sec.key_points.filter(Boolean) : [];
    const kpHtml = kps.length
      ? `<ul style="margin:0.5rem 0 0; padding-left:1.1rem; font-size:0.85rem; color:var(--color-navy);">${kps.map(p => `<li style="margin-bottom:0.25rem;">${escapeHtml(String(p))}</li>`).join('')}</ul>`
      : '';
    return `
    <div class="summary-section-item">
      <button type="button" class="summary-section-toggle" onclick="toggleSummarySection(this)">
        <span class="summary-section-num">${idx + 1}</span>
        <span class="summary-section-heading">${escapeHtml(sec?.heading || '')}</span>
        <span class="summary-section-chevron">▾</span>
      </button>
      <div class="summary-section-body">
        ${formatSummaryText(sec?.summary || '', footnotesArray)}
        ${kpHtml ? `<div style="margin-top:0.6rem; padding:0.5rem 0.65rem; background:rgba(31,138,147,0.06); border-radius:8px;"><div style="font-size:0.75rem; font-weight:800; color:var(--color-teal); margin-bottom:0.25rem;">Önemli noktalar</div>${kpHtml}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `
    <div class="summary-sections-outline">
      <div class="summary-sections-title">📖 Bölüm Özetleri (Derin)</div>
      ${itemsHtml}
    </div>
  `;
}
window.renderSectionsOutlineHtml = renderSectionsOutlineHtml;

function toggleSummarySection(btn) {
  const item = btn.closest('.summary-section-item');
  if (item) item.classList.toggle('expanded');
}
window.toggleSummarySection = toggleSummarySection;

/** NotebookLM Madde 1 — render hierarchical document outline TOC */
function populateStudyCardOutline(card) {
  const section = document.getElementById('study-card-outline-section');
  const list = document.getElementById('study-card-outline-list');
  const titleEl = document.getElementById('study-card-outline-title');
  if (!section || !list) return;

  let items = [];
  const outline = card?.outline;
  if (outline && Array.isArray(outline.items) && outline.items.length > 0) {
    items = outline.items.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  } else if (Array.isArray(card?.sections) && card.sections.length > 0) {
    // Fallback for older cards without outline column
    items = card.sections.map((s, idx) => ({
      id: `o${idx + 1}`,
      heading: s.heading || '',
      blurb: s.summary || '',
      level: 1,
      order: idx + 1
    }));
  }

  if (items.length === 0) {
    section.style.display = 'none';
    list.innerHTML = '';
    if (titleEl) { titleEl.style.display = 'none'; titleEl.textContent = ''; }
    return;
  }

  section.style.display = 'block';
  if (titleEl) {
    const guess = (outline && outline.document_title_guess) ? String(outline.document_title_guess).trim() : '';
    if (guess) {
      titleEl.style.display = 'block';
      titleEl.textContent = guess;
    } else {
      titleEl.style.display = 'none';
      titleEl.textContent = '';
    }
  }

  list.innerHTML = items.map((it, idx) => {
    const level = Math.min(3, Math.max(1, Number(it.level) || 1));
    const pad = (level - 1) * 12;
    const blurb = (it.blurb || '').trim();
    const jumpId = it.id || `sec-${idx}`;
    return `
      <li style="list-style: none; margin-left: ${pad}px;">
        <button type="button" onclick="jumpToDeepSection('${String(jumpId).replace(/'/g, "\\'")}', ${idx})"
          style="width:100%; text-align:left; cursor:pointer; padding: 0.45rem 0.55rem; border-radius: 8px; background: ${level === 1 ? 'rgba(22,50,92,0.04)' : 'transparent'}; border: 1px solid rgba(22,50,92,0.06); display:flex; gap:0.5rem; align-items:flex-start;">
          <span style="flex-shrink:0; width:22px; height:22px; border-radius:50%; background:var(--color-teal); color:#fff; font-size:0.7rem; font-weight:800; display:flex; align-items:center; justify-content:center;">${idx + 1}</span>
          <div style="min-width:0;">
            <div style="font-weight:700; color:var(--color-navy); font-size:0.9rem;">${escapeHtml(it.heading || '')}</div>
            ${blurb ? `<div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:0.15rem; line-height:1.4;">${escapeHtml(blurb.slice(0, 220))}${blurb.length > 220 ? '…' : ''}</div>` : ''}
          </div>
        </button>
      </li>
    `;
  }).join('');
}
window.populateStudyCardOutline = populateStudyCardOutline;

/** Madde 5 — deep sections in reading pane */
function populateDeepSectionsReading(card) {
  const section = document.getElementById('study-card-deep-sections-section');
  const container = document.getElementById('study-card-deep-sections-container');
  if (!section || !container) return;

  const sections = Array.isArray(card?.sections) ? card.sections : [];
  if (sections.length === 0) {
    section.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = sections.map((sec, idx) => {
    const kps = Array.isArray(sec?.key_points) ? sec.key_points.filter(Boolean) : [];
    const kpHtml = kps.length
      ? `<ul style="margin:0.5rem 0 0; padding-left:1.1rem; font-size:0.85rem;">${kps.map(p => `<li style="margin-bottom:0.25rem;">${escapeHtml(String(p))}</li>`).join('')}</ul>`
      : '';
    const oid = sec.outline_id || `sec-${idx}`;
    return `
      <div class="summary-section-item" id="deep-section-${escapeHtml(String(oid))}" data-section-idx="${idx}" style="margin-bottom:0.5rem;">
        <button type="button" class="summary-section-toggle" onclick="toggleSummarySection(this)" style="width:100%;">
          <span class="summary-section-num">${idx + 1}</span>
          <span class="summary-section-heading">${escapeHtml(sec?.heading || '')}</span>
          <span class="summary-section-chevron">▾</span>
        </button>
        <div class="summary-section-body">
          ${formatSummaryText(sec?.summary || '', card.footnotes)}
          ${kpHtml ? `<div style="margin-top:0.6rem; padding:0.5rem 0.65rem; background:rgba(31,138,147,0.06); border-radius:8px;"><div style="font-size:0.75rem; font-weight:800; color:var(--color-teal); margin-bottom:0.25rem;">Önemli noktalar</div>${kpHtml}</div>` : ''}
          <div class="section-visual-actions" style="margin-top:0.65rem; display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
            <span style="font-size:0.72rem; color:var(--color-text-muted); font-weight:700;">🎨 Görsel oluştur:</span>
            <button type="button" class="btn-section-visual" data-section-idx="${idx}" data-visual-type="diagram" onclick="generateSectionVisual(event, ${idx}, 'diagram')">📊 Diyagram</button>
            <button type="button" class="btn-section-visual" data-section-idx="${idx}" data-visual-type="table" onclick="generateSectionVisual(event, ${idx}, 'table')">📋 Tablo</button>
            <button type="button" class="btn-section-visual" data-section-idx="${idx}" data-visual-type="chart" onclick="generateSectionVisual(event, ${idx}, 'chart')">📈 Grafik</button>
          </div>
          <div class="section-visual-result" id="section-visual-result-${idx}"></div>
        </div>
      </div>`;
  }).join('');
}
window.populateDeepSectionsReading = populateDeepSectionsReading;

// On-demand per-section visual generation (🎨 button inside a deep section).
// Free/text-based by design (Mermaid diagram, markdown table, or Chart.js
// chart via the existing Groq pipeline) — never a billed image API. Appends
// the new artifact to the card's diagrams/tables/charts array and re-renders
// just that section, then scrolls the student to it.
async function generateSectionVisual(event, sectionIdx, visualType) {
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const btn = event?.currentTarget || document.querySelector(`.btn-section-visual[data-section-idx="${sectionIdx}"][data-visual-type="${visualType}"]`);
  const resultBox = document.getElementById(`section-visual-result-${sectionIdx}`);

  if (!activeModalCardId || !currentActiveStudyCard) {
    showDashboardAlert('error', isTr ? 'Aktif bir çalışma kartı bulunamadı.' : 'No active study card found.');
    return;
  }
  const sections = Array.isArray(currentActiveStudyCard.sections) ? currentActiveStudyCard.sections : [];
  const sec = sections[sectionIdx];
  if (!sec) return;

  const actionsRow = btn ? btn.closest('.section-visual-actions') : null;
  const allBtns = actionsRow ? actionsRow.querySelectorAll('.btn-section-visual') : (btn ? [btn] : []);
  const originalHtml = btn ? btn.innerHTML : '';
  allBtns.forEach(b => { b.disabled = true; });
  if (btn) {
    btn.innerHTML = isTr ? '⏳ Oluşturuluyor…' : '⏳ Generating…';
  }

  try {
    const { data, error } = await supabaseClient.functions.invoke('generate-section-visual', {
      body: {
        studyCardId: activeModalCardId,
        sectionHeading: sec.heading || '',
        sectionSummary: sec.summary || '',
        sectionKeyPoints: Array.isArray(sec.key_points) ? sec.key_points : [],
        visualType: visualType
      }
    });

    if (error || !data || !data.success) {
      const msg = (data && data.error) || (error && error.message) || (isTr ? 'Görsel oluşturulamadı. Lütfen tekrar deneyin.' : 'Could not generate the visual. Please try again.');
      showDashboardAlert('error', msg);
      return;
    }

    // Append to the in-memory card and re-render just that visual type
    const col = data.targetColumn; // 'diagrams' | 'tables' | 'charts'
    if (!Array.isArray(currentActiveStudyCard[col])) currentActiveStudyCard[col] = [];
    currentActiveStudyCard[col].push(data.artifact);

    if (col === 'diagrams') renderStudyCardDiagrams(currentActiveStudyCard);
    else if (col === 'tables') renderStudyCardTables(currentActiveStudyCard);
    else if (col === 'charts') renderStudyCardCharts(currentActiveStudyCard);

    if (resultBox) {
      resultBox.innerHTML = `<div style="margin-top:0.5rem; font-size:0.78rem; color:var(--color-teal); font-weight:700;">✅ ${isTr ? 'Oluşturuldu — aşağıdaki bölümde görebilirsiniz' : 'Generated — see it below'}: "${escapeHtml(data.artifact.title || '')}"</div>`;
    }

    const targetSectionId = col === 'diagrams' ? 'study-card-diagrams-section' : (col === 'tables' ? 'study-card-tables-section' : 'study-card-charts-section');
    setTimeout(() => scrollStudyCardTo(targetSectionId), 150);
  } catch (err) {
    console.error('generateSectionVisual failed:', err);
    showDashboardAlert('error', isTr ? 'Beklenmeyen bir hata oluştu.' : 'An unexpected error occurred.');
  } finally {
    allBtns.forEach(b => { b.disabled = false; });
    if (btn) btn.innerHTML = originalHtml;
  }
}
window.generateSectionVisual = generateSectionVisual;

// ==========================================================================
// Sesli Özet (AI Podcast) — reads a cached two-host script aloud using the
// free browser Web Speech API (window.speechSynthesis). No TTS API cost:
// the script text itself is the only thing generated server-side
// (generate-podcast-script), cached on study_cards.podcast_script.
// ==========================================================================
const podcastState = {
  script: [],
  hostNames: ['A', 'B'],
  lang: 'en',
  currentIndex: -1,
  isPlaying: false,
  voiceA: null,
  voiceB: null,
  sameVoice: false,
  voicesConfirmedGenderPair: false,
  // Real server-generated neural voice audio (Azure TTS), one MP3 URL per
  // script line — populated lazily on first play via generate-podcast-audio
  // and cached on study_cards.podcast_script.audio so it's a one-time cost.
  // When present, playback uses these instead of the free browser voice.
  audioUrls: [],
  audioFetchAttempted: false,
  audioEl: null
};

function resetPodcastPlayerUI() {
  const caption = document.getElementById('podcast-caption');
  if (caption) caption.textContent = '';
  const fill = document.getElementById('podcast-progress-fill');
  if (fill) fill.style.width = '0%';
  const counter = document.getElementById('podcast-line-counter');
  if (counter) counter.textContent = '';
  updatePodcastPlayPauseIcon();
  clearActivePodcastHostChip();
}

function renderPodcastSection(card) {
  const cta = document.getElementById('study-card-podcast-cta');
  const player = document.getElementById('study-card-podcast-player');
  if (!cta || !player) return;

  // Switching cards mid-playback would keep reading the old script over the
  // new card's content — always stop first (populateStudyCardModalDetails
  // also calls stopPodcast() directly, this is a safety net for other callers).
  if (podcastState.isPlaying) stopPodcast();

  podcastState.lang = (card && card.summary_language) || 'en';

  const podcast = card && card.podcast_script;
  const hasScript = podcast && Array.isArray(podcast.script) && podcast.script.length > 0;

  resetPodcastPlayerUI();

  // Reset per-card audio state — real audio (if any) is picked back up from
  // this card's own cache below; it must never leak into a different card.
  podcastState.audioFetchAttempted = false;
  podcastState.audioUrls = [];

  if (hasScript) {
    podcastState.script = podcast.script;
    podcastState.hostNames = (Array.isArray(podcast.hostNames) && podcast.hostNames.length === 2)
      ? podcast.hostNames
      : (podcastState.lang === 'tr' ? ['Ela', 'Kaan'] : ['Alex', 'Sam']);
    cta.style.display = 'none';
    player.style.display = 'block';
    const nameA = document.getElementById('podcast-host-name-a');
    const nameB = document.getElementById('podcast-host-name-b');
    if (nameA) nameA.textContent = podcastState.hostNames[0];
    if (nameB) nameB.textContent = podcastState.hostNames[1];
    updatePodcastLineCounter();
    // Real neural audio already generated for this card in a previous
    // session — pick it straight back up, no re-generation needed.
    if (podcast.audio && Array.isArray(podcast.audio.urls) && podcast.audio.urls.length === podcast.script.length) {
      podcastState.audioUrls = podcast.audio.urls;
      podcastState.audioFetchAttempted = true;
    }
  } else {
    podcastState.script = [];
    cta.style.display = 'flex';
    player.style.display = 'none';
  }
}
window.renderPodcastSection = renderPodcastSection;

async function generatePodcastScript() {
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  if (!activeModalCardId) return;

  const genBtn = document.getElementById('btn-generate-podcast');
  const originalHtml = genBtn ? genBtn.innerHTML : '';
  if (genBtn) {
    genBtn.disabled = true;
    genBtn.innerHTML = isTr ? '⏳ Oluşturuluyor…' : '⏳ Generating…';
  }

  try {
    const { data, error } = await supabaseClient.functions.invoke('generate-podcast-script', {
      body: { studyCardId: activeModalCardId }
    });

    if (error || !data || !data.success) {
      const msg = (data && data.error) || (error && error.message) || (isTr ? 'Sesli özet oluşturulamadı. Lütfen tekrar deneyin.' : 'Could not generate the podcast. Please try again.');
      showDashboardAlert('error', msg);
      return;
    }

    if (currentActiveStudyCard) currentActiveStudyCard.podcast_script = data.podcast;
    renderPodcastSection(currentActiveStudyCard);
  } catch (err) {
    console.error('generatePodcastScript failed:', err);
    showDashboardAlert('error', isTr ? 'Beklenmeyen bir hata oluştu.' : 'An unexpected error occurred.');
  } finally {
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.innerHTML = originalHtml;
    }
  }
}
window.generatePodcastScript = generatePodcastScript;

// Fetches (and, the very first time, generates) real neural TTS audio for the
// current card's podcast script via the generate-podcast-audio edge function
// (Azure Speech — genuine "Emel"/"Ahmet" Turkish neural voices, not a browser
// voice approximation). Cached forever on study_cards.podcast_script.audio,
// same one-time-cost pattern as the script itself. Never throws — on any
// failure (no Azure credentials configured yet, quota exhausted, network
// error) it just leaves podcastState.audioUrls empty so playback silently
// falls back to the free browser voice instead of blocking the student.
async function generatePodcastAudio() {
  if (!activeModalCardId) return;
  try {
    const { data, error } = await supabaseClient.functions.invoke('generate-podcast-audio', {
      body: { studyCardId: activeModalCardId }
    });
    if (error || !data || !data.success) {
      console.warn('generate-podcast-audio unavailable, using browser voice fallback:', (data && data.error) || (error && error.message));
      podcastState.audioUrls = [];
      return;
    }
    podcastState.audioUrls = Array.isArray(data.audio && data.audio.urls) ? data.audio.urls : [];
    if (currentActiveStudyCard && currentActiveStudyCard.podcast_script) {
      currentActiveStudyCard.podcast_script = { ...currentActiveStudyCard.podcast_script, audio: data.audio };
    }
  } catch (err) {
    console.warn('generatePodcastAudio failed, using browser voice fallback:', err);
    podcastState.audioUrls = [];
  }
}

// Voices load asynchronously in most browsers — resolves once populated,
// with a timeout fallback in case 'voiceschanged' never fires (some browsers).
function ensurePodcastVoicesLoaded() {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing && existing.length > 0) return resolve(existing);
    const onReady = () => resolve(window.speechSynthesis.getVoices() || []);
    window.speechSynthesis.onvoiceschanged = onReady;
    setTimeout(() => resolve(window.speechSynthesis.getVoices() || []), 800);
  });
}

// Known first-name / label fragments that browsers and operating systems use
// inside SpeechSynthesisVoice.name to hint a voice's gender — the Web Speech
// API itself has no gender field, so name-sniffing is the only cross-browser
// way to tell them apart. Covers Microsoft/Edge (incl. Turkish "Emel"/"Ahmet"
// neural voices), Google/Chrome, and Apple/Safari (incl. Turkish "Yelda")
// voice names actually seen in the wild.
const PODCAST_FEMALE_VOICE_HINTS = [
  'female', 'emel', 'yelda', 'zira', 'hazel', 'susan', 'aria', 'jenny', 'michelle',
  'emma', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'kate',
  'serena', 'ava', 'allison', 'zoe', 'nicky', 'salli', 'joanna', 'kimberly',
  'amy', 'sabina', 'elif', 'seda', 'catherine', 'linda', 'heather'
];
const PODCAST_MALE_VOICE_HINTS = [
  'male', 'ahmet', 'tolga', 'david', 'mark', 'james', 'guy', 'ryan', 'christopher',
  'eric', 'roger', 'alex', 'daniel', 'fred', 'oliver', 'thomas', 'arthur', 'george',
  'lee', 'rishi', 'brian', 'justin', 'matthew', 'joey', 'russell', 'tom'
];
// Prefer higher-quality neural/cloud voices over older robotic "Desktop"
// engines when a browser exposes both (this is most of what makes a free
// browser voice sound "akıcı" — fluent — rather than choppy/robotic).
const PODCAST_QUALITY_HINTS = ['neural', 'online', 'natural', 'wavenet', 'enhanced', 'premium'];

function detectPodcastVoiceGender(voice) {
  const name = String(voice?.name || '').toLowerCase();
  if (PODCAST_FEMALE_VOICE_HINTS.some(h => name.includes(h))) return 'female';
  if (PODCAST_MALE_VOICE_HINTS.some(h => name.includes(h))) return 'male';
  return 'unknown';
}

function podcastVoiceQualityScore(voice) {
  const name = String(voice?.name || '').toLowerCase();
  return PODCAST_QUALITY_HINTS.some(h => name.includes(h)) ? 1 : 0;
}

// Two hosts, one free voice engine: actively look for a real male + female
// pair among ALL voices this browser/OS exposes (not just the first two),
// preferring same-language matches and higher-quality "neural/online" voices
// when there's a choice. Browsers vary a lot here — Edge on Windows usually
// ships proper Turkish male+female neural voices out of the box, Chrome
// often exposes only one. If no gender-distinguishable pair is available in
// the target language, we fall back to the best two distinct voices we can
// find, and finally to pitch/rate differentiation on a single voice — same
// safety net as before, just tried only after the smarter match fails.
function pickPodcastVoices(voices, lang) {
  const langPrefix = lang === 'tr' ? 'tr' : 'en';
  const list = Array.isArray(voices) ? voices : [];
  const langPool = list.filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
  const pool = langPool.length > 0 ? langPool : list;

  const byQualityDesc = (a, b) => podcastVoiceQualityScore(b) - podcastVoiceQualityScore(a);
  const females = pool.filter(v => detectPodcastVoiceGender(v) === 'female').sort(byQualityDesc);
  const males = pool.filter(v => detectPodcastVoiceGender(v) === 'male').sort(byQualityDesc);

  let voiceA = null;
  let voiceB = null;

  if (females.length > 0 && males.length > 0) {
    // Real gender pair found in-language — the ideal case (e.g. Edge's
    // Turkish "Emel"/"Ahmet" neural voices, or Chrome's English Female/Male).
    voiceA = females[0];
    voiceB = males[0];
  } else {
    // No confidently-gendered pair — fall back to the two best-quality
    // distinct voices available, still preferring in-language ones.
    const sorted = [...pool].sort(byQualityDesc);
    voiceA = sorted[0] || null;
    voiceB = sorted.find(v => v.name !== (voiceA && voiceA.name)) || voiceA;
  }

  podcastState.voiceA = voiceA;
  podcastState.voiceB = voiceB;
  podcastState.sameVoice = !voiceA || !voiceB || voiceA.name === voiceB.name;
  // True ONLY when we found two independently-gendered system voices — then
  // the voice engines themselves already sound male/female and pitch is left
  // alone. In every other case (one shared voice, or two distinct voices we
  // couldn't confidently gender) we simulate the difference with pitch/rate
  // in speakPodcastLine(), and that simulation must always point host A
  // ("Ela"/"Alex", always the backend's first/female-coded host) HIGHER and
  // host B ("Kaan"/"Sam", always male-coded) LOWER — never the reverse.
  podcastState.voicesConfirmedGenderPair = females.length > 0 && males.length > 0;
}

function updatePodcastPlayPauseIcon() {
  const btn = document.getElementById('btn-podcast-playpause');
  if (!btn) return;
  btn.textContent = podcastState.isPlaying ? '⏸️' : '▶️';
}

function updatePodcastProgress() {
  const fill = document.getElementById('podcast-progress-fill');
  if (!fill) return;
  const total = podcastState.script.length || 1;
  const pos = Math.max(0, podcastState.currentIndex);
  const pct = Math.min(100, Math.round(((pos + 1) / total) * 100));
  fill.style.width = `${pct}%`;
}

function updatePodcastLineCounter() {
  const counter = document.getElementById('podcast-line-counter');
  if (!counter) return;
  const total = podcastState.script.length;
  if (!total) { counter.textContent = ''; return; }
  const pos = podcastState.currentIndex >= 0 ? podcastState.currentIndex + 1 : 0;
  counter.textContent = `${pos} / ${total}`;
}

function updatePodcastCaption(line) {
  const caption = document.getElementById('podcast-caption');
  if (!caption || !line) return;
  const speakerName = line.speaker === 'B' ? podcastState.hostNames[1] : podcastState.hostNames[0];
  caption.innerHTML = `<strong>${escapeHtml(speakerName)}:</strong> ${escapeHtml(line.text)}`;
}

function highlightActivePodcastHostChip(speaker) {
  const chipA = document.getElementById('podcast-host-chip-a');
  const chipB = document.getElementById('podcast-host-chip-b');
  if (chipA) chipA.classList.toggle('active', speaker === 'A');
  if (chipB) chipB.classList.toggle('active', speaker === 'B');
}

function clearActivePodcastHostChip() {
  const chipA = document.getElementById('podcast-host-chip-a');
  const chipB = document.getElementById('podcast-host-chip-b');
  if (chipA) chipA.classList.remove('active');
  if (chipB) chipB.classList.remove('active');
}

function speakPodcastLine() {
  if (!podcastState.isPlaying) return;

  podcastState.currentIndex++;
  if (podcastState.currentIndex >= podcastState.script.length) {
    stopPodcast();
    return;
  }

  const line = podcastState.script[podcastState.currentIndex];
  updatePodcastCaption(line);
  updatePodcastProgress();
  updatePodcastLineCounter();
  highlightActivePodcastHostChip(line.speaker);

  // Real neural voice audio for this line, if generate-podcast-audio has
  // produced it — genuinely distinct, genuinely fluent male/female voices,
  // no browser-dependent guesswork needed.
  const audioUrl = podcastState.audioUrls[podcastState.currentIndex];
  if (audioUrl) {
    playPodcastLineViaAudio(audioUrl, line);
    return;
  }

  if (!window.speechSynthesis) { stopPodcast(); return; }
  speakPodcastLineWithBrowserVoice(line);
}

// One shared <audio> element reused across lines — real MP3 playback is far
// more reliable to pause/resume than the Web Speech API, as a bonus.
function playPodcastLineViaAudio(url, line) {
  if (!podcastState.audioEl) {
    podcastState.audioEl = new Audio();
    podcastState.audioEl.addEventListener('ended', () => {
      if (!podcastState.isPlaying) return;
      // Same short breathing-room pause as the browser-voice fallback below.
      setTimeout(() => { if (podcastState.isPlaying) speakPodcastLine(); }, 380);
    });
  }
  const audioEl = podcastState.audioEl;
  audioEl.onerror = () => {
    console.warn('Podcast audio file failed to play, falling back to browser voice for this line.');
    speakPodcastLineWithBrowserVoice(line);
  };
  audioEl.src = url;
  audioEl.play().catch((err) => {
    console.warn('Podcast audio play() was rejected, falling back to browser voice for this line:', err);
    speakPodcastLineWithBrowserVoice(line);
  });
}

function speakPodcastLineWithBrowserVoice(line) {
  if (!window.speechSynthesis) { stopPodcast(); return; }

  const utter = new SpeechSynthesisUtterance(line.text);
  const isHostB = line.speaker === 'B';
  const voice = isHostB ? podcastState.voiceB : podcastState.voiceA;
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else {
    utter.lang = podcastState.lang === 'tr' ? 'tr-TR' : 'en-US';
  }
  // Host A ("Ela"/"Alex") is always the backend's female-coded host and host
  // B ("Kaan"/"Sam") is always male-coded (see generate-podcast-script) — so
  // any artificial pitch/rate difference must always read A higher/brighter
  // and B lower/steadier, never the reverse. A small per-line random jitter
  // is added on top so consecutive lines don't sound like a metronome, which
  // is most of what makes a free browser voice sound flat/robotic instead of
  // "samimi" (warm) and "akıcı" (fluent).
  const jitter = (Math.random() - 0.5) * 0.05;
  if (podcastState.voicesConfirmedGenderPair) {
    // Real distinct male/female system voices already carry the gender cue —
    // just add gentle conversational pacing, no artificial pitch shift.
    utter.rate = (isHostB ? 0.99 : 1.05) + jitter;
    utter.pitch = 1.0;
  } else {
    // One shared voice (or two same-sounding voices) for both hosts —
    // simulate the gender difference ourselves.
    utter.rate = (isHostB ? 0.94 : 1.08) + jitter;
    utter.pitch = (isHostB ? 0.82 : 1.35) + jitter;
  }

  // A brief natural pause between turns — real conversation has breathing
  // room; firing the next line the instant one ends is what made it sound
  // rushed/robotic rather than like two people actually talking.
  utter.onend = () => {
    if (!podcastState.isPlaying) return;
    setTimeout(() => { if (podcastState.isPlaying) speakPodcastLine(); }, 380);
  };
  utter.onerror = (e) => {
    console.warn('Podcast TTS error, skipping line:', e);
    if (podcastState.isPlaying) speakPodcastLine();
  };

  window.speechSynthesis.speak(utter);
}

async function togglePodcastPlayback() {
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  if (!window.speechSynthesis && !podcastState.audioUrls.length) {
    showDashboardAlert('error', isTr ? 'Tarayıcınız sesli okumayı desteklemiyor.' : 'Your browser does not support text-to-speech.');
    return;
  }
  if (!podcastState.script.length) return;

  const usingAudioEl = !!(podcastState.audioEl && podcastState.audioEl.src && podcastState.audioUrls[podcastState.currentIndex]);

  // Currently speaking → pause in place
  if (podcastState.isPlaying) {
    podcastState.isPlaying = false;
    if (usingAudioEl) {
      podcastState.audioEl.pause();
    } else if (window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    updatePodcastPlayPauseIcon();
    return;
  }

  // Paused mid-line → resume in place
  if (podcastState.currentIndex >= 0) {
    podcastState.isPlaying = true;
    updatePodcastPlayPauseIcon();
    if (usingAudioEl) {
      podcastState.audioEl.play().catch(() => speakPodcastLine());
    } else if (window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    } else {
      speakPodcastLine();
    }
    return;
  }

  // Fresh start (or restart after it finished/was stopped). The very first
  // time this card is played, try once to fetch/generate real neural voice
  // audio — worth a short wait since it's cached forever afterward. Any
  // failure here is silent (see generatePodcastAudio) and just leaves the
  // free browser voice as the experience for this card.
  if (!podcastState.audioFetchAttempted) {
    podcastState.audioFetchAttempted = true;
    const btn = document.getElementById('btn-podcast-playpause');
    const prevHtml = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
    await generatePodcastAudio();
    if (btn) { btn.disabled = false; btn.textContent = prevHtml; }
  }

  if (!podcastState.audioUrls.length) {
    const voices = await ensurePodcastVoicesLoaded();
    pickPodcastVoices(voices, podcastState.lang);
  }
  podcastState.currentIndex = -1;
  podcastState.isPlaying = true;
  updatePodcastPlayPauseIcon();
  speakPodcastLine();
}
window.togglePodcastPlayback = togglePodcastPlayback;

function stopPodcast() {
  if (podcastState.audioEl) {
    try { podcastState.audioEl.pause(); podcastState.audioEl.currentTime = 0; podcastState.audioEl.src = ''; } catch (e) { /* ignore */ }
  }
  if (window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  }
  podcastState.isPlaying = false;
  podcastState.currentIndex = -1;
  updatePodcastPlayPauseIcon();
  const fill = document.getElementById('podcast-progress-fill');
  if (fill) fill.style.width = '0%';
  updatePodcastLineCounter();
  const caption = document.getElementById('podcast-caption');
  if (caption) caption.textContent = '';
  clearActivePodcastHostChip();
}
window.stopPodcast = stopPodcast;

function scrollStudyCardTo(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // brief highlight
  el.style.transition = 'box-shadow 0.3s ease';
  el.style.boxShadow = '0 0 0 2px rgba(31,138,147,0.35)';
  setTimeout(() => { el.style.boxShadow = ''; }, 900);
}
window.scrollStudyCardTo = scrollStudyCardTo;

function jumpToDeepSection(outlineId, idx) {
  scrollStudyCardTo('study-card-deep-sections-section');
  const byId = document.getElementById('deep-section-' + outlineId);
  const byIdx = document.querySelector(`[data-section-idx="${idx}"]`);
  const target = byId || byIdx;
  if (target) {
    target.classList.add('expanded');
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }
}
window.jumpToDeepSection = jumpToDeepSection;

function showFootnoteToast(refText) {
  showDashboardAlert('info', `📎 ${refText}`);
}
window.showFootnoteToast = showFootnoteToast;

// Precise page/slide citation linking: when a footnote carries a real "page"
// number (set by the summarize-document/merge-summarize edge functions from
// the "--- SAYFA N ---" / "--- SLAYT N ---" markers inserted at extraction
// time), clicking it jumps the currently-visible original-document viewer
// (either the Study Card modal's split pane or the Source Hub's PDF column)
// to that exact page via the "#page=N" URL fragment most browsers' built-in
// PDF viewers honor — opening the viewer first if it isn't already open.
// Falls back to the old plain reference toast when no page number is known
// (DOCX has no reliable page concept; PPTX-without-viewer, etc.).
async function jumpToFootnote(fnId, refText, page) {
  const hasPage = typeof page === 'number' && Number.isFinite(page);
  if (!hasPage) {
    showFootnoteToast(refText);
    return;
  }

  const applyPageToIframe = () => {
    const containerIds = ['original-doc-viewer-pane', 'sourcehub-pdf-pane'];
    for (const id of containerIds) {
      const container = document.getElementById(id);
      const iframe = container && container.querySelector('iframe');
      if (iframe && iframe.src) {
        const baseSrc = iframe.src.split('#')[0];
        iframe.src = `${baseSrc}#page=${page}`;
        return true;
      }
    }
    return false;
  };

  let jumped = applyPageToIframe();

  // Study Card modal context: the original-document pane may not be open
  // yet — open it (this awaits its own render), then try again.
  if (!jumped && typeof isOriginalDocSplitActive !== 'undefined' && !isOriginalDocSplitActive &&
      typeof toggleOriginalDocumentViewer === 'function' && currentActiveStudyCard) {
    await toggleOriginalDocumentViewer();
    jumped = applyPageToIframe();
  }

  showDashboardAlert('info', jumped
    ? `📎 Sayfa ${page}'e gidildi — ${refText}`
    : `📎 Sayfa ${page} — ${refText} (orijinal belge görüntüleyici şu an açık değil)`);
}
window.jumpToFootnote = jumpToFootnote;

function formatSummaryText(summary, footnotes) {
  if (!summary) return "";
  const withFootnotes = formatFootnoteMarkers(summary, footnotes);
  
  // Split on raw or escaped newline
  const lines = withFootnotes.split(/\n|\\n/);
  
  let html = "";
  let insideList = false;

  lines.forEach(line => {
    let trimmed = line.trim();
    if (!trimmed) {
      if (insideList) {
        html += "</ul>";
        insideList = false;
      }
      html += "<br>";
      return;
    }

    // Check if line is a markdown heading (starts with ## )
    if (trimmed.startsWith("## ")) {
      if (insideList) {
        html += "</ul>";
        insideList = false;
      }
      const headingText = trimmed.replace(/^##\s*/, "");
      html += `<h4 style="font-size: 0.95rem; font-weight: 700; color: var(--color-teal); margin-top: 0.75rem; margin-bottom: 0.35rem; font-family: 'Outfit', sans-serif;">${headingText}</h4>`;
      return;
    }

    // Check if line is a bullet item
    const bulletMatch = trimmed.match(/^([-\*•])\s*(.*)$/);
    if (bulletMatch) {
      if (!insideList) {
        html += '<ul style="margin: 0.5rem 0; padding-left: 1.5rem; list-style-type: disc;">';
        insideList = true;
      }
      html += `<li style="margin-bottom: 0.25rem; font-size: 0.85rem; color: var(--color-navy); line-height: 1.4;">${bulletMatch[2]}</li>`;
    } else {
      if (insideList) {
        html += "</ul>";
        insideList = false;
      }

      // Check if line is a heading (starts with a number like "1." or "A." or is capitalized/short < 50 chars)
      const isNumberHeading = /^\d+\.\s+/.test(trimmed) || /^[A-Z]\.\s+/.test(trimmed);
      const isShortTitleCase = trimmed.length < 50 && (/^[A-Z]/.test(trimmed) && trimmed === trimmed.toUpperCase());
      const isSyllabusHeading = trimmed.startsWith("Anahtar ") || trimmed.startsWith("Önemli ") || trimmed.startsWith("Sınav ") || trimmed.startsWith("Key ") || trimmed.startsWith("Summary ");

      if (isNumberHeading || isShortTitleCase || isSyllabusHeading) {
        html += `<h4 style="font-size: 0.95rem; font-weight: 700; color: var(--color-teal); margin-top: 0.75rem; margin-bottom: 0.35rem; font-family: 'Outfit', sans-serif;">${trimmed}</h4>`;
      } else {
        html += `<p style="margin: 0.35rem 0; font-size: 0.85rem; color: var(--color-navy); line-height: 1.5;">${trimmed}</p>`;
      }
    }
  });

  if (insideList) {
    html += "</ul>";
  }

  return html;
}
window.formatSummaryText = formatSummaryText;

// Standalone renderers for tables/charts/diagrams — extracted from
// populateStudyCardModalDetails so the same rendering logic can also be
// called after a single new visual is appended by generate-section-visual
// (the per-section "🎨 Görsel Oluştur" button), without re-running the
// whole modal populate pipeline.
function renderStudyCardTables(card) {
  const tablesSection = document.getElementById('study-card-tables-section');
  const tablesContainer = document.getElementById('study-card-tables-container');
  if (!tablesSection || !tablesContainer) return;
  tablesContainer.innerHTML = '';
  const tables = card.tables || [];
  if (Array.isArray(tables) && tables.length > 0) {
    tablesSection.style.display = 'block';
    tables.forEach((t, idx) => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'ai-section-card';

      let headersHtml = (t.headers || []).map(h => `<th>${escapeHtml(String(h))}</th>`).join('');
      let rowsHtml = (t.rows || []).map(row => {
        const cells = (row || []).map(c => `<td>${escapeHtml(String(c))}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      const tableJson = JSON.stringify(t);
      const escapedTitle = escapeHtml(t.title || `Table ${idx + 1}`);

      cardDiv.innerHTML = `
        <div class="ai-section-header">
          <h5 class="ai-section-title">${escapedTitle}</h5>
          <button class="btn btn-outline" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; font-weight: 700; border-color: var(--color-teal); color: var(--color-teal);" onclick="sendSectionToDepot(event, this, '${card.id}', 'table', '${(t.title || 'Table').replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${tableJson.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">
            📥 Deftere Gönder
          </button>
        </div>
        <div class="ai-table-container">
          <table class="ai-extracted-table">
            <thead><tr>${headersHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
      tablesContainer.appendChild(cardDiv);
    });
  } else {
    tablesSection.style.display = 'none';
  }
}
window.renderStudyCardTables = renderStudyCardTables;

function renderStudyCardCharts(card) {
  const chartsSection = document.getElementById('study-card-charts-section');
  const chartsContainer = document.getElementById('study-card-charts-container');
  if (!chartsSection || !chartsContainer) return;
  chartsContainer.innerHTML = '';
  const charts = card.charts || [];
  if (Array.isArray(charts) && charts.length > 0) {
    chartsSection.style.display = 'block';
    charts.forEach((c, idx) => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'ai-section-card';

      const chartJson = JSON.stringify(c);
      const escapedTitle = escapeHtml(c.title || `Chart ${idx + 1}`);
      const canvasId = `modal-chart-canvas-${card.id}-${idx}`;

      cardDiv.innerHTML = `
        <div class="ai-section-header">
          <h5 class="ai-section-title">${escapedTitle} (${c.type || 'bar'})</h5>
          <button class="btn btn-outline" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; font-weight: 700; border-color: var(--color-teal); color: var(--color-teal);" onclick="sendSectionToDepot(event, this, '${card.id}', 'chart', '${(c.title || 'Chart').replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${chartJson.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">
            📥 Deftere Gönder
          </button>
        </div>
        <div class="ai-chart-container" style="height: 250px;">
          <canvas id="${canvasId}"></canvas>
        </div>
      `;
      chartsContainer.appendChild(cardDiv);

      setTimeout(() => {
        const canvasEl = document.getElementById(canvasId);
        if (canvasEl) renderChartJs(canvasEl, c);
      }, 60);
    });
  } else {
    chartsSection.style.display = 'none';
  }
}
window.renderStudyCardCharts = renderStudyCardCharts;

function renderStudyCardDiagrams(card) {
  const diagramsSection = document.getElementById('study-card-diagrams-section');
  const diagramsContainer = document.getElementById('study-card-diagrams-container');
  if (!diagramsSection || !diagramsContainer) return;
  diagramsContainer.innerHTML = '';
  const diagrams = card.diagrams || [];
  if (Array.isArray(diagrams) && diagrams.length > 0) {
    diagramsSection.style.display = 'block';
    diagrams.forEach((d, idx) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'diagram-card';
      cardEl.style.cssText = 'background: var(--color-surface-elevated, #fff); border: 1px solid rgba(22,50,92,0.08); border-radius: 12px; padding: 1rem 1.1rem;';

      const mermaidId = `study-card-mermaid-${card.id || 'preview'}-${idx}`;
      cardEl.innerHTML = `
        <h5 class="diagram-card-title" style="margin: 0 0 0.5rem 0; font-size: 0.95rem; color: var(--color-navy);">${escapeHtml(d.title || 'Diagram')}</h5>
        ${d.description ? `<p class="diagram-card-desc" style="margin: 0 0 0.75rem 0; font-size: 0.85rem; color: var(--color-text-muted); line-height: 1.45;">${escapeHtml(d.description)}</p>` : ''}
        <div id="${mermaidId}" class="diagram-mermaid-box" style="overflow-x: auto; background: #f8fafc; border-radius: 8px; padding: 0.75rem;"></div>
      `;
      diagramsContainer.appendChild(cardEl);

      // Render Mermaid asynchronously (same engine already used in Kaynakla Sohbet)
      setTimeout(async () => {
        const target = document.getElementById(mermaidId);
        if (!target || !d.mermaid || !window.mermaid) {
          if (target) target.textContent = d.mermaid || '';
          return;
        }
        try {
          const renderId = `mmd-sc-${Date.now()}-${idx}`;
          const { svg } = await window.mermaid.render(renderId, String(d.mermaid).trim());
          target.innerHTML = svg;
        } catch (err) {
          console.warn('Study card Mermaid render failed:', err);
          target.innerHTML = `<pre style="font-size:0.75rem;white-space:pre-wrap;color:#64748b;margin:0;">${escapeHtml(d.mermaid)}</pre>`;
        }
      }, 50 + idx * 30);
    });
  } else {
    diagramsSection.style.display = 'none';
  }
}
window.renderStudyCardDiagrams = renderStudyCardDiagrams;

async function populateStudyCardModalDetails(card, docName, readOnly) {
  currentActiveStudyCard = { ...card, documentFileName: docName };

  // Sesli Özet (AI Podcast): stop any playback from the previously-open card
  // and reset the panel to match this card's cached podcast_script (if any).
  if (window.stopPodcast) window.stopPodcast();
  if (window.renderPodcastSection) window.renderPodcastSection(currentActiveStudyCard);

  // Populate Modal Title
  const titleEl = document.getElementById('study-card-title');
  if (titleEl) titleEl.textContent = `Study Card: ${docName}`;

  // Populate Style Badge
  const badgeEl = document.getElementById('study-card-modal-style-badge');
  if (badgeEl) {
    const style = card.summary_style || 'standard';
    badgeEl.textContent = getStyleLabel(style);
    // Remove old classes and add new one
    badgeEl.className = 'style-badge';
    badgeEl.classList.add(`style-${style}`);
  }

  // Populate Language Badge
  const langBadgeEl = document.getElementById('study-card-modal-lang-badge');
  if (langBadgeEl) {
    const langCode = card.summary_language || 'en';
    langBadgeEl.textContent = langCode === 'tr' ? 'Türkçe' : 'English';
  }

  // Populate Type Badge (Part A)
  const typeBadgeEl = document.getElementById('study-card-modal-type-badge');
  if (typeBadgeEl) {
    typeBadgeEl.innerHTML = getDocumentTypeBadgeHtml(card.document_type);
  }

  // Populate Length Badge (Part B)
  const lengthBadgeEl = document.getElementById('study-card-modal-length-badge');
  if (lengthBadgeEl) {
    lengthBadgeEl.innerHTML = getLengthBadgeHtml(card.summary_length);
  }

  // Populate Visual Analysis Badge (Part E)
  const visualBadgeEl = document.getElementById('study-card-modal-visual-badge');
  if (visualBadgeEl) {
    visualBadgeEl.innerHTML = getVisualAnalysisBadgeHtml(card.visual_analysis);
  }

  // Fetch feedback rating (Part D)
  highlightFeedbackButtons(null); // Clear first
  if (currentUser && card.id) {
    try {
      const { data: voteData, error: voteError } = await supabaseClient
        .from('summary_feedback')
        .select('rating')
        .eq('study_card_id', card.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (!voteError && voteData) {
        highlightFeedbackButtons(voteData.rating);
      }
    } catch (err) {
      console.error("Error fetching vote rating: ", err);
    }
  }

  // Sharing switch container control
  const shareContainer = document.getElementById('modal-share-container');
  const shareToggle = document.getElementById('modal-share-toggle');
  
  const regenButtons = document.querySelectorAll('.btn-regenerate-section');
  if (readOnly) {
    if (shareContainer) shareContainer.style.display = 'none';
    activeModalCardId = null;
    regenButtons.forEach(btn => btn.style.display = 'none');
  } else {
    if (shareContainer) shareContainer.style.display = 'flex';
    activeModalCardId = card.id;
    regenButtons.forEach(btn => btn.style.display = 'inline-flex');
    if (shareToggle) {
      shareToggle.checked = card.is_shared || false;
      shareToggle.onchange = async (e) => {
        await toggleShareStudyCard(card.id, e.target.checked);
      };
    }
  }

  // Populate Executive Summary (30-second overview)
  const executiveSection = document.getElementById('study-card-executive-section');
  const executiveText = document.getElementById('study-card-executive-text');
  if (executiveSection && executiveText) {
    const exec = (card.summary_executive || '').trim();
    if (exec) {
      executiveSection.style.display = 'block';
      executiveText.innerHTML = formatSummaryText(exec, card.footnotes);
    } else {
      executiveSection.style.display = 'none';
      executiveText.innerHTML = '';
    }
  }

  // Populate Document Outline (NotebookLM Madde 1)
  populateStudyCardOutline(card);

  // Populate narrative only (Madde 5: deep sections in separate block)
  const summaryText = document.getElementById('study-card-summary-text');
  if (summaryText) {
    const qm = card.quality_meta || {};
    const grounded = !!qm.grounded;
    const passed = qm.pass !== false;
    let badge = '';
    if (grounded) {
      badge += `<span style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.7rem;font-weight:800;color:#0f766e;background:rgba(20,184,166,0.12);padding:0.2rem 0.55rem;border-radius:999px;margin-right:0.35rem;">🔗 Kaynaklı özet</span>`;
    }
    if (qm.critic_retry) {
      badge += `<span style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.7rem;font-weight:800;color:#a16207;background:rgba(234,179,8,0.15);padding:0.2rem 0.55rem;border-radius:999px;margin-right:0.35rem;">✓ Kalite düzeltmesi</span>`;
    } else if (passed && grounded) {
      badge += `<span style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.7rem;font-weight:800;color:#166534;background:rgba(22,163,74,0.12);padding:0.2rem 0.55rem;border-radius:999px;">✓ Kalite kapısı</span>`;
    }
    const badgeRow = badge ? `<div style="margin-bottom:0.65rem;display:flex;flex-wrap:wrap;gap:0.25rem;">${badge}</div>` : '';
    summaryText.innerHTML = badgeRow + (formatSummaryText(card.summary, card.footnotes) || "No summary generated for this document.");
  }

  populateDeepSectionsReading(card);

  // Populate Key Points
  const pointsContainer = document.getElementById('study-card-points-container');
  if (pointsContainer) {
    pointsContainer.innerHTML = '';
    const keyPoints = card.key_points || [];
    if (keyPoints.length === 0) {
      pointsContainer.innerHTML = '<li class="study-card-point-item">No key points generated.</li>';
    } else {
      keyPoints.forEach(pt => {
        const li = document.createElement('li');
        li.className = 'study-card-point-item';
        li.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>${formatFootnoteMarkers(pt, card.footnotes)}</span>
        `;
        pointsContainer.appendChild(li);
      });
    }
  }

  // Populate Key Terms
  const termsContainer = document.getElementById('study-card-terms-container');
  if (termsContainer) {
    termsContainer.innerHTML = '';
    const keyTerms = card.key_terms || [];
    if (keyTerms.length === 0) {
      termsContainer.innerHTML = '<div style="color: var(--color-text-muted); font-size: 0.9rem;">No key terms generated.</div>';
    } else {
      keyTerms.forEach(t => {
        const div = document.createElement('div');
        div.className = 'key-term-card';
        div.innerHTML = `
          <div class="key-term-word">${t.term}</div>
          <div class="key-term-def">${t.definition}</div>
        `;
        termsContainer.appendChild(div);
      });
    }
  }

  // Populate Concept Graph
  const conceptSection = document.getElementById('study-card-concept-graph-section');
  const conceptContainer = document.getElementById('study-card-concept-graph-container');
  if (conceptSection && conceptContainer) {
    conceptContainer.innerHTML = '';
    const graph = card.concept_graph || {};
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph.edges) ? graph.edges : [];
    if (nodes.length === 0) {
      conceptSection.style.display = 'none';
    } else {
      conceptSection.style.display = 'block';
      // Build Mermaid graph LR from nodes/edges
      const idMap = {};
      nodes.forEach((n, i) => {
        const safeId = 'N' + i;
        idMap[n.id] = safeId;
      });
      let mmd = 'graph LR\n';
      nodes.forEach((n, i) => {
        const safeId = 'N' + i;
        const label = String(n.label || n.id || '').replace(/"/g, "'").slice(0, 40);
        mmd += `  ${safeId}["${label}"]\n`;
      });
      edges.forEach(e => {
        const from = idMap[e.from];
        const to = idMap[e.to];
        if (from && to) {
          const rel = String(e.relation || 'related_to').replace(/"/g, "'");
          mmd += `  ${from} -->|"${rel}"| ${to}\n`;
        }
      });
      const mermaidBoxId = `concept-mmd-${card.id || 'preview'}`;
      const relList = edges.length
        ? '<ul style="margin:0.75rem 0 0;padding-left:1.2rem;font-size:0.85rem;color:var(--color-text-muted);">' +
          edges.slice(0, 20).map(e => {
            const fromLabel = (nodes.find(n => n.id === e.from) || {}).label || e.from;
            const toLabel = (nodes.find(n => n.id === e.to) || {}).label || e.to;
            return `<li><strong>${escapeHtml(fromLabel)}</strong> → <em>${escapeHtml(e.relation || 'related_to')}</em> → <strong>${escapeHtml(toLabel)}</strong></li>`;
          }).join('') + '</ul>'
        : '';
      conceptContainer.innerHTML = `
        <div id="${mermaidBoxId}" style="overflow-x:auto;background:#f8fafc;border-radius:10px;padding:0.85rem;"></div>
        ${relList}
      `;
      setTimeout(async () => {
        const target = document.getElementById(mermaidBoxId);
        if (!target || !window.mermaid) {
          if (target) target.textContent = mmd;
          return;
        }
        try {
          const renderId = `cg-${Date.now()}`;
          const { svg } = await window.mermaid.render(renderId, mmd);
          target.innerHTML = svg;
        } catch (err) {
          console.warn('Concept graph Mermaid render failed:', err);
          target.innerHTML = `<pre style="font-size:0.75rem;white-space:pre-wrap;margin:0;">${escapeHtml(mmd)}</pre>`;
        }
      }, 60);
    }
  }

  // Cross-document related cards (Madde 4)
  if (card && card.id) {
    try { populateRelatedCardsSection(card.id); } catch (e) { console.warn('Related cards:', e); }
  }

  // Populate Self-Test Questions (Quiz)
  const quizContainer = document.getElementById('study-card-quiz-container');
  if (quizContainer) {
    quizContainer.innerHTML = '';
    const quizQuestions = card.quiz_questions || [];
    if (quizQuestions.length === 0) {
      quizContainer.innerHTML = '<div style="color: var(--color-text-muted); font-size: 0.9rem;">No quiz questions generated.</div>';
    } else {
      quizQuestions.forEach((q, idx) => {
        const div = document.createElement('div');
        div.className = 'quiz-item';
        div.id = `quiz-item-${idx}`;
        div.innerHTML = `
          <div class="quiz-question-header" onclick="toggleQuizAnswer(${idx})">
            <span>Q${idx + 1}: ${q.question}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="quiz-answer-body" id="quiz-answer-${idx}">
            <strong style="color: var(--color-teal);">Answer:</strong> ${q.answer}
          </div>
        `;
        quizContainer.appendChild(div);
      });
    }
  }

  // Populate Tables
  renderStudyCardTables(card);

  // Populate Charts
  renderStudyCardCharts(card);

  // Populate Attached Images (photos/diagrams saved from Kaynakla Sohbet)
  renderStudyCardImagesGallery(card.chat_attachments || [], card.id);

  // Populate Quantitative Badge
  const quantBadgeEl = document.getElementById('study-card-modal-quantitative-badge');
  if (quantBadgeEl) {
    quantBadgeEl.style.display = card.is_quantitative ? 'inline-block' : 'none';
  }

  // Populate Footnotes / References
  const fnContainer = document.getElementById('study-card-footnotes-container');
  if (fnContainer) {
    fnContainer.innerHTML = renderFootnotesSectionHtml(card.footnotes || []);
  }

  // Populate Formulas Section
  const formulasSection = document.getElementById('study-card-formulas-section');
  const formulasContainer = document.getElementById('study-card-formulas-container');
  if (formulasSection && formulasContainer) {
    formulasContainer.innerHTML = '';
    const formulas = card.formulas || [];
    if (Array.isArray(formulas) && formulas.length > 0) {
      formulasSection.style.display = 'block';
      formulas.forEach((f, idx) => {
        const cardEl = document.createElement('div');
        cardEl.className = 'formula-card';
        
        let varsHtml = '';
        if (Array.isArray(f.variables) && f.variables.length > 0) {
          varsHtml = '<ul class="formula-vars-list">' + f.variables.map(v => `<li><strong>${escapeHtml(v.symbol || '')}:</strong> ${escapeHtml(v.meaning || '')}</li>`).join('') + '</ul>';
        }
        
        const latexId = `formula-latex-${card.id || 'preview'}-${idx}`;
        cardEl.innerHTML = `
          <h5 class="formula-card-title">${escapeHtml(f.name || 'Formula')}</h5>
          <div class="formula-latex-box" id="${latexId}"></div>
          ${varsHtml}
        `;
        formulasContainer.appendChild(cardEl);

        setTimeout(() => {
          const latexTarget = document.getElementById(latexId);
          if (latexTarget && window.katex && f.latex) {
            try {
              window.katex.render(f.latex, latexTarget, { throwOnError: false, displayMode: true });
            } catch (e) {
              latexTarget.textContent = f.latex;
            }
          } else if (latexTarget) {
            latexTarget.textContent = f.latex || '';
          }
        }, 40);
      });
    } else {
      formulasSection.style.display = 'none';
    }
  }

  // Populate Diagrams Section (AI-reconstructed Mermaid)
  renderStudyCardDiagrams(card);

  // Populate Worked Examples Section
  const examplesSection = document.getElementById('study-card-examples-section');
  const examplesContainer = document.getElementById('study-card-examples-container');
  if (examplesSection && examplesContainer) {
    examplesContainer.innerHTML = '';
    const examples = card.worked_examples || [];
    if (Array.isArray(examples) && examples.length > 0) {
      examplesSection.style.display = 'block';
      examples.forEach(ex => {
        const cardEl = document.createElement('div');
        cardEl.className = 'worked-example-card';
        
        let stepsHtml = '';
        if (Array.isArray(ex.steps) && ex.steps.length > 0) {
          stepsHtml = '<ol class="worked-example-steps">' + ex.steps.map(step => `<li>${renderMathInText(step)}</li>`).join('') + '</ol>';
        }
        
        cardEl.innerHTML = `
          <h5 class="worked-example-title">${escapeHtml(ex.title || 'Worked Example')}</h5>
          <div class="worked-example-problem">${renderMathInText(ex.problem_statement || '')}</div>
          ${stepsHtml}
          ${ex.final_answer ? `<div class="worked-example-final"><strong>Sonuç / Final Answer:</strong> ${renderMathInText(ex.final_answer)}</div>` : ''}
        `;
        examplesContainer.appendChild(cardEl);
      });
    } else {
      examplesSection.style.display = 'none';
    }
  }
}
window.populateStudyCardModalDetails = populateStudyCardModalDetails;

function renderMathInText(text) {
  if (!text) return '';
  const escaped = escapeHtml(String(text));
  if (!window.katex) return escaped;
  return escaped.replace(/\$(.*?)\$/g, (match, latex) => {
    try {
      return window.katex.renderToString(latex, { displayMode: false, throwOnError: false });
    } catch (e) {
      return match;
    }
  });
}
window.renderMathInText = renderMathInText;

async function viewStudyCard(docId, docName, readOnly = false, selectedCardId = null) {
  console.log("viewStudyCard fired for docId:", docId, "docName:", docName, "selectedCardId:", selectedCardId);
  resetDocChatState(); // fresh chat for each newly opened study card
  try {
    let cards = [];
    
    // First query by document_id
    const { data: docCards, error: docError } = await supabaseClient
      .from('study_cards')
      .select('*')
      .eq('document_id', docId)
      .order('created_at', { ascending: false });

    if (!docError && docCards && docCards.length > 0) {
      cards = docCards;
    } else {
      // Fallback: query by card ID directly (if cardId was passed as docId)
      const { data: directCards, error: directError } = await supabaseClient
        .from('study_cards')
        .select('*')
        .eq('id', docId);

      if (!directError && directCards && directCards.length > 0) {
        cards = directCards;
      }
    }

    if (cards.length === 0) {
      console.warn("No study cards found for docId / cardId:", docId);
      showDashboardAlert('error', 'This study card has been deleted.');
      return;
    }

    console.log("Fetched study cards successfully: ", cards);

    // Determine initial selected index
    let selectedIndex = 0;
    if (selectedCardId) {
      const idx = cards.findIndex(c => c.id === selectedCardId);
      if (idx !== -1) {
        selectedIndex = idx;
      }
    }

    // Initial population with the selected card
    populateStudyCardModalDetails(cards[selectedIndex], docName, readOnly);

    // Handle multiple study cards dropdown
    const selectContainer = document.getElementById('modal-style-selector-container');
    if (selectContainer) {
      if (cards.length > 1) {
        selectContainer.style.display = 'block';
        selectContainer.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--color-bg-alt); padding: 0.5rem; border-radius: var(--radius-sm); border: 1px solid rgba(22, 50, 92, 0.08); margin-bottom: 0.75rem;">
            <label style="font-size: 0.8rem; font-weight: 700; color: var(--color-navy); margin-right: 0.5rem;">Select Summary Style:</label>
            <select id="modal-card-selector" class="font-size-select" style="padding: 0.35rem 0.5rem; font-size: 0.8rem; border-radius: var(--radius-sm); border: 1px solid rgba(22, 50, 92, 0.15); background: white; cursor: pointer;">
              ${cards.map((c, index) => {
                const formattedTime = new Date(c.created_at || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const styleName = getStyleLabel(c.summary_style);
                const isSelected = index === selectedIndex ? 'selected' : '';
                return `<option value="${index}" ${isSelected}>${styleName} (Generated on ${formattedTime})</option>`;
              }).join('')}
            </select>
          </div>
        `;
        const selectorEl = document.getElementById('modal-card-selector');
        selectorEl.onchange = (e) => {
          populateStudyCardModalDetails(cards[parseInt(e.target.value, 10)], docName, readOnly);
        };
      } else {
        selectContainer.style.display = 'none';
      }
    }

    // Open Modal
    openStudyCardModal();

  } catch (err) {
    console.error("Exception loading study card: ", err);
    showDashboardAlert('error', 'An error occurred loading the study card.');
  }
}

function toggleQuizAnswer(idx) {
  const quizItem = document.getElementById(`quiz-item-${idx}`);
  if (quizItem) {
    quizItem.classList.toggle('active');
  }
}

// ==========================================
// 10. Study Card Modal Accessibility Controls
// ==========================================
function openStudyCardModal() {
  if (window.openModalWithFocus) {
    window.openModalWithFocus('study-card-modal');
  } else {
    const modal = document.getElementById('study-card-modal');
    if (modal) modal.classList.add('active');
  }
}

function closeStudyCardModal() {
  if (window.closeModalWithFocus) {
    window.closeModalWithFocus('study-card-modal');
  } else {
    const modal = document.getElementById('study-card-modal');
    if (modal) modal.classList.remove('active');
  }
  resetDocChatState();
  // Sesli Özet: never let a podcast keep talking after the card is closed
  if (window.stopPodcast) window.stopPodcast();
}

// ==========================================================================
// ACADEX PHASE 5 VIEWS CONTROLLER (switch views, load feed, load notebooks)
// ==========================================================================

async function toggleShareStudyCard(cardId, isChecked) {
  try {
    const { error } = await supabaseClient
      .from('study_cards')
      .update({
        is_shared: isChecked,
        shared_at: isChecked ? new Date().toISOString() : null,
        department: currentUserProfile ? currentUserProfile.department : null
      })
      .eq('id', cardId);

    if (error) {
      console.error("Sharing update failed: ", error);
      showDashboardAlert('error', 'Failed to update sharing settings. Please try again.');
      
      // Revert checkboxes on failure
      const switches = [`share-switch-${cardId}`, `share-switch-lib-${cardId}`, 'modal-share-toggle'];
      switches.forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = !isChecked;
      });
    } else {
      showDashboardAlert('success', isChecked ? 'Shared with your department!' : 'Removed from shared feed.');
      if (isChecked) {
        awardAchievement('first_share');
      }
      
      // Sync memory & DOM checkboxes
      if (notebookCards) {
        const c = notebookCards.find(card => card.id === cardId);
        if (c) c.is_shared = isChecked;
        const cb = document.getElementById(`share-switch-${cardId}`);
        if (cb) cb.checked = isChecked;
      }

      if (libraryCards) {
        const c = libraryCards.find(card => card.id === cardId);
        if (c) c.is_shared = isChecked;
        const cb = document.getElementById(`share-switch-lib-${cardId}`);
        if (cb) cb.checked = isChecked;
      }

      // Sync modal toggle
      const modalToggle = document.getElementById('modal-share-toggle');
      if (modalToggle && activeModalCardId === cardId) {
        modalToggle.checked = isChecked;
      }
    }
  } catch (err) {
    console.error("Sharing update exception: ", err);
    showDashboardAlert('error', 'An error occurred updating the sharing state.');
  }
}
window.toggleShareStudyCard = toggleShareStudyCard;
let currentViewTransitionTimeout = null;

function switchDashboardView(viewId) {
  // Clear any active transition timeout
  if (currentViewTransitionTimeout) {
    clearTimeout(currentViewTransitionTimeout);
    currentViewTransitionTimeout = null;
  }

  // Update sidebar active classes immediately for responsiveness
  const tabs = ['home', 'planner', 'docs', 'feed', 'notebook', 'cards', 'sourcehub', 'glossary', 'exams', 'presentation', 'acadexsunum', 'settings', 'sandbox', 'admin'];
  tabs.forEach(tab => {
    const el = document.getElementById(`side-${tab}`);
    if (el) {
      if (tab === viewId) el.classList.add('active');
      else el.classList.remove('active');
    }
  });

  // Acadex Sunum takes over the full viewport (z-index: 5000) and has its
  // own bottom-right tools panel — the floating Acadia and Focus Mode
  // widgets (z-index: 99999) would otherwise render on top of it and
  // collide with that panel. Hide them while Sunum is open, restore them
  // (in their normal flex layout) on any other tab.
  const acadiaWidget = document.getElementById('acadia-widget-container');
  const pomodoroWidget = document.getElementById('pomodoro-widget-container');
  const hideFloatingWidgets = (viewId === 'acadexsunum');
  if (acadiaWidget) acadiaWidget.style.display = hideFloatingWidgets ? 'none' : 'flex';
  if (pomodoroWidget) pomodoroWidget.style.display = hideFloatingWidgets ? 'none' : 'flex';

  const targetSection = document.getElementById(`${viewId}-view`);
  if (!targetSection) {
    currentActiveTab = viewId;
    return;
  }

  const currentActiveSection = document.querySelector('.dashboard-view-section.active');

  // If there's an existing active section that is different, do the transitions
  if (currentActiveSection && currentActiveSection !== targetSection) {
    currentActiveSection.classList.add('animating-out');
    
    currentViewTransitionTimeout = setTimeout(() => {
      currentActiveSection.classList.remove('active', 'animating-out');
      targetSection.classList.add('active', 'animating-in');
      currentActiveTab = viewId;
      
      // Load view content at start of fade-in
      loadViewContent(viewId);
      
      currentViewTransitionTimeout = setTimeout(() => {
        targetSection.classList.remove('animating-in');
        currentViewTransitionTimeout = null;
      }, 150);
    }, 150);
  } else {
    // Immediate activation for initial load or same tab
    tabs.forEach(tab => {
      const section = document.getElementById(`${tab}-view`);
      if (section) {
        if (tab === viewId) {
          section.classList.add('active');
          section.classList.remove('animating-in', 'animating-out');
        } else {
          section.classList.remove('active', 'animating-in', 'animating-out');
        }
      }
    });
    currentActiveTab = viewId;
    loadViewContent(viewId);
  }
}

function loadViewContent(viewId) {
  if (viewId === 'home') {
    loadDashboardHome();
  } else if (viewId === 'planner') {
    loadPlannerEvents();
    updateRemindersStatusText();
  } else if (viewId === 'docs') {
    loadDocuments();
  } else if (viewId === 'feed') {
    departmentFeedLimit = 30;
    loadDepartmentFeed();
  } else if (viewId === 'notebook') {
    loadStudyNotebook();
  } else if (viewId === 'cards') {
    loadCardsLibrary();
  } else if (viewId === 'sourcehub') {
    loadSourceHubView();
  } else if (viewId === 'glossary') {
    loadGlossaryView();
  } else if (viewId === 'exams') {
    loadExamsPlatform();
  } else if (viewId === 'presentation') {
    loadPresentationStudio();
  } else if (viewId === 'acadexsunum') {
    loadAcadexSunum();
  } else if (viewId === 'settings') {
    loadSettingsView();
  } else if (viewId === 'sandbox') {
    sandboxProjectsLimit = 20;
    loadDeveloperSandbox();
  } else if (viewId === 'admin') {
    loadAdminPanel();
  }
}
window.switchDashboardView = switchDashboardView;

function loadAcadexSunum() {
  const iframe = document.getElementById('acadexsunum-iframe');
  if (iframe && !iframe.dataset.loaded) {
    iframe.src = 'acadex-sunum.html';
    iframe.dataset.loaded = 'true';
  }
}
function closeAcadexSunum() {
  switchDashboardView('home');
}
window.closeAcadexSunum = closeAcadexSunum;

let notebookCards = [];
let isDrawing = false;
let currentPenColor = '#000000';
let currentBrushSize = 4;
let notebookMode = 'pen'; // 'pen', 'eraser', 'text'
let canvasCtx = null;
let canvasElement = null;
let isNotebookInitialized = false;

async function loadStudyNotebook() {
  const sidebarList = document.getElementById('notebook-sidebar-list');
  if (!sidebarList) return;

  sidebarList.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 2rem;">
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 24px; height: 24px; color: var(--color-teal);">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
      </svg>
    </div>
  `;

  try {
    // 1. Fetch user's study cards for left sidebar
    const { data: cards, error } = await supabaseClient
      .from('study_cards')
      .select('*, documents(file_name)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching study cards: ", error);
      sidebarList.innerHTML = `<p style="color: var(--color-text-muted); font-size: 0.8rem;">Failed to load cards.</p>`;
      return;
    }

    notebookCards = cards || [];
    filterNotebookCards();
    
    // 2. Initialize whiteboard canvas once
    if (!isNotebookInitialized) {
      initWhiteboard();
      isNotebookInitialized = true;
    } else {
      // Re-trigger viewport resize context bindings
      resizeCanvasToDisplaySize();
    }
    
    // 3. Load saved whiteboard layout & elements
    await loadNotebookData();

    // 4. Load staging depot items (Phase 11)
    await loadDepotItems();
    initDepotModalListeners();

  } catch (err) {
    console.error("Exception loading notebook panel: ", err);
    sidebarList.innerHTML = `<p style="color: var(--color-text-muted); font-size: 0.8rem;">Failed to load cards.</p>`;
  }
}

function filterNotebookCards() {
  const searchInput = document.getElementById('notebook-search');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filtered = notebookCards.filter(card => {
    const fileName = (card.documents?.file_name || '').toLowerCase();
    const summary = (card.summary || '').toLowerCase();
    return fileName.includes(query) || summary.includes(query);
  });

  renderNotebookSidebarList(filtered);
}

function renderNotebookSidebarList(cards) {
  const sidebarList = document.getElementById('notebook-sidebar-list');
  if (!sidebarList) return;

  if (cards.length === 0) {
    sidebarList.innerHTML = `<p style="color: var(--color-text-muted); font-size: 0.8rem; text-align: center; padding: 1rem;">No cards found.</p>`;
    return;
  }

  sidebarList.innerHTML = '';

  // Group cards by document ID
  const grouped = {};
  cards.forEach(card => {
    const docId = card.document_id || 'unknown';
    if (!grouped[docId]) {
      grouped[docId] = [];
    }
    grouped[docId].push(card);
  });

  Object.keys(grouped).forEach(docId => {
    const groupCards = grouped[docId];
    const firstCard = groupCards[0];
    const docName = firstCard.documents?.file_name || 'Unnamed Document';

    if (groupCards.length > 1) {
      const headerDiv = document.createElement('div');
      headerDiv.className = 'notebook-doc-group-header';
      headerDiv.style.margin = '0.75rem 0 0.25rem 0';
      headerDiv.style.padding = '0.25rem 0.5rem';
      headerDiv.style.background = 'var(--color-bg-alt)';
      headerDiv.style.borderRadius = 'var(--radius-sm)';
      headerDiv.style.borderLeft = '3px solid var(--color-teal)';
      headerDiv.innerHTML = `<h5 style="font-size: 0.75rem; color: var(--color-navy); font-weight: 800; margin:0; word-break: break-all;">${docName} <span style="font-size: 0.65rem; color: var(--color-text-muted); font-weight: 500;">(${groupCards.length} versiyon)</span></h5>`;
      sidebarList.appendChild(headerDiv);
    }

    groupCards.forEach(card => {
      const formattedDate = new Date(card.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const fullSummary = card.summary || 'No summary generated.';
      const escapedSummary = fullSummary.replace(/'/g, "\\'").replace(/"/g, '&quot;');

      const cardDiv = document.createElement('div');
      cardDiv.className = 'doc-card';
      cardDiv.style.padding = '0.75rem';
      cardDiv.style.fontSize = '0.8rem';
      cardDiv.style.position = 'relative';
      cardDiv.innerHTML = `
        <div class="doc-header" style="gap: 0.5rem; margin-bottom: 0.25rem; position: relative;">
          <div class="doc-file-icon text" style="background-color: var(--color-teal-light); color: var(--color-teal); width: 28px; height: 28px; flex-shrink:0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
          <div class="doc-info" style="width: calc(100% - 50px);">
            <h4 class="doc-name" style="font-size: 0.8rem; line-height: 1.2; padding-right: 0.5rem;" title="${docName}">${docName}</h4>
            <span style="font-size: 0.65rem; color: var(--color-text-muted);">${formattedDate}</span>
            <div style="display: flex; gap: 0.25rem; margin-top: 0.15rem; flex-wrap: wrap;">
              <span class="style-badge style-${card.summary_style || 'standard'}" style="margin: 0; font-size: 0.55rem; padding: 0.05rem 0.25rem;">${getStyleLabel(card.summary_style)}</span>
              <span class="style-badge" style="margin: 0; font-size: 0.55rem; padding: 0.05rem 0.25rem; background-color: var(--color-teal-light); color: var(--color-teal); border: 1px solid rgba(22, 50, 92, 0.08); font-weight: 700;">${card.summary_language === 'tr' ? 'TR' : 'EN'}</span>
              ${getDocumentTypeBadgeHtml(card.document_type)}
              ${getLengthBadgeHtml(card.summary_length)}
              ${getVisualAnalysisBadgeHtml(card.visual_analysis)}
              ${getQuantitativeBadgeHtml(card.is_quantitative)}
            </div>
          </div>
          <button onclick="deleteStudyCard(event, '${card.id}', '${card.document_id}')" style="background: none; border: none; cursor: pointer; color: #EF4444; position: absolute; right: 0; top: 0.15rem; padding: 0.15rem; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); transition: background-color 0.2s;" title="Delete this study card">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
        
        <div class="sidebar-summary-box" style="margin-top: 0.5rem;">
          <strong style="color: var(--color-navy); font-size: 0.78rem;">Özet:</strong>
          <div style="margin-top: 0.25rem;">${formatSummaryText(card.summary, card.footnotes) || 'No summary generated.'}</div>
        </div>
        
        <div class="share-toggle-container" style="margin: 0.25rem 0; padding: 0.25rem 0.5rem; font-size: 0.75rem;">
          <span>Share</span>
          <label class="switch" style="width: 32px; height: 16px;">
            <input type="checkbox" id="share-switch-${card.id}" ${card.is_shared ? 'checked' : ''} onchange="toggleShareStudyCard('${card.id}', this.checked)" style="width:0;height:0;">
            <span class="slider" style="border-radius: 16px;"></span>
          </label>
        </div>

        <div style="display: flex; gap: 0.25rem; margin-top: 0.5rem;">
          <button class="btn btn-outline btn-view-summary" data-doc-id="${card.document_id}" data-doc-name="${docName.replace(/'/g, "\\'")}" data-card-id="${card.id}" style="flex: 1; padding: 0.25rem; font-size: 0.7rem; min-height: 24px;">View</button>
          <button class="btn btn-primary btn-add-to-board" onclick="addStickyNoteToNotebook('${card.id}', '${docName.replace(/'/g, "\\'")}', '${escapedSummary}')" style="flex: 1; padding: 0.25rem; font-size: 0.7rem; border: none; min-height: 24px;">Add to Board</button>
        </div>
      `;
      sidebarList.appendChild(cardDiv);
    });
  });
}

function initWhiteboard() {
  canvasElement = document.getElementById('notebook-canvas');
  if (!canvasElement) return;

  canvasCtx = canvasElement.getContext('2d');
  
  // Set dimensions
  resizeCanvasToDisplaySize();

  // Initialize whiteboard swatches (permanently styled for light canvas)
  if (typeof updateWhiteboardSwatches === 'function') {
    updateWhiteboardSwatches();
  }

  // Draw event bindings
  canvasElement.addEventListener('mousedown', startDrawing);
  canvasElement.addEventListener('mousemove', draw);
  canvasElement.addEventListener('mouseup', stopDrawing);
  canvasElement.addEventListener('mouseleave', stopDrawing);

  // Toolbar toggles
  const btnPen = document.getElementById('tool-pen');
  const btnEraser = document.getElementById('tool-eraser');
  const btnText = document.getElementById('tool-text');
  const btnTable = document.getElementById('tool-table');
  const btnClear = document.getElementById('btn-clear-canvas');
  const btnDownload = document.getElementById('btn-download-notebook');
  const btnSave = document.getElementById('btn-save-notebook');
  const sizeSlider = document.getElementById('brush-size');
  const sizeVal = document.getElementById('brush-size-val');
  const swatches = document.querySelectorAll('.color-swatch');
  const fontSizeSelect = document.getElementById('text-font-size');

  btnPen.addEventListener('click', () => setNotebookMode('pen'));
  btnEraser.addEventListener('click', () => setNotebookMode('eraser'));
  btnText.addEventListener('click', () => setNotebookMode('text'));
  btnTable.addEventListener('click', openTablePickerModal);

  // Wire up Voice notes tool (Part D)
  const btnMic = document.getElementById('tool-mic');
  if (btnMic) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      btnMic.disabled = true;
      btnMic.style.opacity = '0.5';
      btnMic.style.cursor = 'not-allowed';
      btnMic.title = "Voice input isn't supported in this browser — try Chrome or Edge.";
    } else {
      btnMic.addEventListener('click', toggleVoiceTranscription);
    }
  }

  btnClear.addEventListener('click', () => {
    const isTr = localStorage.getItem('acadexUILang') === 'tr';
    const title = isTr ? "Çizimleri Temizle" : "Erase Drawings";
    const text = isTr 
      ? "Bu sayfadaki tüm kalem çizimleri silinecektir. Devam etmek istiyor musunuz?" 
      : "This will erase all pen drawings on this page. Continue?";
    showConfirmModal(title, text, () => {
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      notebookHasUnsavedChanges = true;
    });
  });

  if (btnDownload) btnDownload.addEventListener('click', downloadNotebook);
  btnSave.addEventListener('click', saveNotebookData);

  sizeSlider.addEventListener('input', (e) => {
    currentBrushSize = e.target.value;
    sizeVal.textContent = `${currentBrushSize}px`;
  });

  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      currentPenColor = swatch.getAttribute('data-color');
      
      // Update color of currently active editing text box
      if (activeEditingTextBox) {
        activeEditingTextBox.style.color = currentPenColor;
        activeEditingTextBox.setAttribute('data-color', currentPenColor);
      }
    });
  });

  const customColorPicker = document.getElementById('tool-color-picker');
  if (customColorPicker) {
    customColorPicker.addEventListener('input', (e) => {
      swatches.forEach(s => s.classList.remove('active'));
      currentPenColor = e.target.value;
      
      if (activeEditingTextBox) {
        activeEditingTextBox.style.color = currentPenColor;
        activeEditingTextBox.setAttribute('data-color', currentPenColor);
      }
    });
  }

  if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', (e) => {
      // Update font size of currently active editing text box
      if (activeEditingTextBox) {
        activeEditingTextBox.style.fontSize = e.target.value;
        activeEditingTextBox.setAttribute('data-font-size', e.target.value);
      }
    });
  }

  // Table modal confirmations
  const btnTableCancel = document.getElementById('btn-table-cancel');
  const btnTableConfirm = document.getElementById('btn-table-confirm');
  if (btnTableCancel) btnTableCancel.addEventListener('click', closeTablePickerModal);
  if (btnTableConfirm) btnTableConfirm.addEventListener('click', confirmInsertTable);

  // Floating text formatting selectionchange listener
  document.addEventListener('selectionchange', handleTextSelectionChange);
}

function resizeCanvasToDisplaySize() {
  if (!canvasElement) return;
  const rect = canvasElement.getBoundingClientRect();
  if (canvasElement.width !== rect.width || canvasElement.height !== rect.height) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasElement.width;
    tempCanvas.height = canvasElement.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvasElement, 0, 0);

    canvasElement.width = rect.width;
    canvasElement.height = rect.height;

    canvasCtx.drawImage(tempCanvas, 0, 0);
  }
}

function setNotebookMode(mode) {
  notebookMode = mode;
  const tools = ['pen', 'eraser', 'text'];
  tools.forEach(t => {
    const btn = document.getElementById(`tool-${t}`);
    if (btn) {
      if (t === mode) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  const contextualPanel = document.getElementById('notebook-contextual-panel');
  const fontSizeGroup = document.getElementById('contextual-font-size-group');
  const brushSizeGroup = document.getElementById('contextual-brush-size-group');

  if (contextualPanel) {
    if (mode === 'pen' || mode === 'text') {
      contextualPanel.style.display = 'flex';
      if (fontSizeGroup) fontSizeGroup.style.display = (mode === 'text') ? 'inline-flex' : 'none';
      if (brushSizeGroup) brushSizeGroup.style.display = (mode === 'pen') ? 'inline-flex' : 'none';
    } else {
      contextualPanel.style.display = 'none';
    }
  }

  if (mode === 'pen') {
    canvasElement.style.cursor = 'crosshair';
  } else if (mode === 'eraser') {
    canvasElement.style.cursor = 'cell';
  } else if (mode === 'text') {
    canvasElement.style.cursor = 'text';
  }
}

function startDrawing(e) {
  if (notebookMode === 'text') {
    e.preventDefault(); // Prevent default focus stealing by canvas mousedown
    insertTextBox(e);
    return;
  }
  if (notebookMode === 'shape') {
    e.preventDefault();
    startDrawingShape(e);
    return;
  }
  if (notebookMode !== 'pen' && notebookMode !== 'eraser') return;

  isDrawing = true;
  canvasCtx.beginPath();
  
  const rect = canvasElement.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  canvasCtx.moveTo(x, y);
  
  if (notebookMode === 'eraser') {
    canvasCtx.globalCompositeOperation = 'destination-out';
    canvasCtx.lineWidth = currentBrushSize * 2.5;
  } else {
    canvasCtx.globalCompositeOperation = 'source-over';
    canvasCtx.strokeStyle = currentPenColor;
    canvasCtx.lineWidth = currentBrushSize;
  }
  
  canvasCtx.lineCap = 'round';
  canvasCtx.lineJoin = 'round';
  
  // Draw dot immediately on click
  canvasCtx.lineTo(x, y);
  canvasCtx.stroke();
}

function draw(e) {
  if (isDrawingShape && activeShapeElement) {
    updateDrawingShape(e);
    return;
  }
  if (!isDrawing) return;

  const rect = canvasElement.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  canvasCtx.lineTo(x, y);
  canvasCtx.stroke();
  notebookHasUnsavedChanges = true;
}

function stopDrawing() {
  if (isDrawingShape && activeShapeElement) {
    isDrawingShape = false;
    
    const el = activeShapeElement;
    activeShapeElement = null;

    // Add resizer handle
    const resizer = document.createElement('div');
    resizer.className = 'table-resizer';
    resizer.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 10 10" style="position: absolute; bottom: 1px; right: 1px; pointer-events: none;">
        <path d="M10 0 L0 10 M10 4 L4 10 M10 8 L8 10" stroke="#94A3B8" stroke-width="1.5"/>
      </svg>
    `;
    el.appendChild(resizer);
    
    makeElementDraggable(el, el.querySelector('.drag-handle-bar') || el);
    makeElementResizable(el, resizer);
    
    if (el.offsetWidth < 5 && el.offsetHeight < 5) {
      el.remove();
    } else {
      notebookHasUnsavedChanges = true;
    }
    return;
  }
  if (!isDrawing) return;
  isDrawing = false;
  canvasCtx.closePath();
}

let activeEditingTextBox = null;

function addStickyNoteToNotebook(cardId, fileName, excerpt) {
  if (currentActiveTab !== 'notebook') {
    switchDashboardView('notebook');
  }

  // Allow workspace layout viewport transitions to complete
  setTimeout(() => {
    const overlay = document.getElementById('notebook-overlay-container');
    if (!overlay) return;

    const id = 'note-' + Date.now();
    const rotation = Math.floor(Math.random() * 7) - 3; // -3 to +3 deg
    
    // Default position: Center of visible canvas viewport with cascading offset
    const rect = overlay.getBoundingClientRect();
    const noteWidth = 220;
    const noteHeight = 150;
    const centerX = (rect.width > noteWidth) ? (rect.width - noteWidth) / 2 : 50;
    const centerY = (rect.height > noteHeight) ? (rect.height - noteHeight) / 2 : 50;
    
    const offset = (overlay.children.length * 20) % 200;
    const x = centerX + offset;
    const y = centerY + offset;

    const note = document.createElement('div');
    note.className = 'draggable-element draggable-note';
    note.id = id;
    note.style.left = `${x}px`;
    note.style.top = `${y}px`;
    note.style.transform = `rotate(${rotation}deg)`;
    note.setAttribute('data-type', 'sticky');
    note.setAttribute('data-card-id', cardId);
    note.setAttribute('data-rotation', rotation);

    note.innerHTML = `
      <button class="delete-overlay-btn" title="Remove Sticky Note" onclick="removeOverlayElement('${id}')">×</button>
      <div class="draggable-note-title">${fileName}</div>
      <div class="draggable-note-text">${excerpt}</div>
      <div class="draggable-note-footer">Acadex Card</div>
    `;

    note.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-overlay-btn') || e.target.closest('.delete-overlay-btn')) return;
      const card = notebookCards.find(c => c.id === cardId) || libraryCards.find(c => c.id === cardId);
      if (card) {
        viewStudyCard(card.document_id, fileName, false, cardId);
      } else {
        showDashboardAlert('error', 'This study card has been deleted.');
      }
    });

    overlay.appendChild(note);
    makeElementDraggable(note);
    notebookHasUnsavedChanges = true;
  }, 100);
}
window.addStickyNoteToNotebook = addStickyNoteToNotebook;

function insertTextBox(e) {
  const overlay = document.getElementById('notebook-overlay-container');
  if (!overlay) return;

  const rect = canvasElement.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const id = 'text-' + Date.now();
  const fontSize = document.getElementById('text-font-size').value;

  const textBox = document.createElement('div');
  textBox.className = 'draggable-element draggable-text-box editing';
  textBox.id = id;
  textBox.style.left = `${x}px`;
  textBox.style.top = `${y}px`;
  textBox.style.color = currentPenColor;
  textBox.style.fontSize = fontSize;
  textBox.setAttribute('data-type', 'text');
  textBox.setAttribute('data-color', currentPenColor);
  textBox.setAttribute('data-font-size', fontSize);

  // Borderless input growing naturally: min-width: 150px, pre-wrap, break-word
  textBox.innerHTML = `
    <button class="delete-overlay-btn" title="Delete Text" onclick="removeOverlayElement('${id}')" style="top: -6px; right: -6px;">×</button>
    <div contenteditable="true" style="outline:none; min-width: 150px; white-space: pre-wrap; overflow-wrap: break-word; font-family: inherit; font-size: inherit;" onblur="handleTextBlur('${id}')"></div>
  `;

  overlay.appendChild(textBox);
  makeElementDraggable(textBox);

  const editable = textBox.querySelector('[contenteditable="true"]');
  activeEditingTextBox = textBox;
  requestAnimationFrame(() => {
    editable.focus();
  });

  // Bind double-click handler to re-enter editing mode
  textBox.addEventListener('dblclick', (evt) => {
    if (evt.target.classList.contains('delete-overlay-btn')) return;
    const ed = textBox.querySelector('[contenteditable]');
    if (ed) {
      ed.contentEditable = "true";
      textBox.classList.add('editing');
      activeEditingTextBox = textBox;
      ed.focus();
    }
  });
}

function handleTextBlur(id) {
  const textBox = document.getElementById(id);
  if (!textBox) return;
  const editable = textBox.querySelector('[contenteditable]');
  if (!editable) return;

  const text = editable.textContent.trim();
  if (!text) {
    textBox.remove();
  } else {
    editable.contentEditable = "false";
    textBox.classList.remove('editing');
    notebookHasUnsavedChanges = true;
  }
  activeEditingTextBox = null;
}
window.handleTextBlur = handleTextBlur;

function openTablePickerModal() {
  if (window.openModalWithFocus) {
    window.openModalWithFocus('table-picker-modal');
  } else {
    const modal = document.getElementById('table-picker-modal');
    if (modal) modal.classList.add('active');
  }
}

function closeTablePickerModal() {
  if (window.closeModalWithFocus) {
    window.closeModalWithFocus('table-picker-modal');
  } else {
    const modal = document.getElementById('table-picker-modal');
    if (modal) modal.classList.remove('active');
  }
}

function confirmInsertTable() {
  const rowsInput = document.getElementById('table-rows-input');
  const colsInput = document.getElementById('table-cols-input');
  const overlay = document.getElementById('notebook-overlay-container');
  
  const rows = Math.min(10, Math.max(1, parseInt(rowsInput.value) || 3));
  const cols = Math.min(10, Math.max(1, parseInt(colsInput.value) || 3));
  
  closeTablePickerModal();
  
  if (!overlay) return;
  
  const id = 'table-' + Date.now();
  
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'draggable-element draggable-table-wrapper';
  tableWrapper.id = id;
  tableWrapper.style.left = '100px';
  tableWrapper.style.top = '150px';
  tableWrapper.setAttribute('data-type', 'table');
  tableWrapper.setAttribute('data-rows', rows);
  tableWrapper.setAttribute('data-cols', cols);

  let tableHtml = `
    <div class="drag-handle-bar"></div>
    <div class="table-actions-bar">
      <button class="table-btn" onclick="addTableRow(this)" title="Add Row">+ Row</button>
      <button class="table-btn" onclick="deleteTableRow(this)" title="Remove Row">− Row</button>
      <button class="table-btn" onclick="addTableCol(this)" title="Add Column">+ Col</button>
      <button class="table-btn" onclick="deleteTableCol(this)" title="Remove Column">− Col</button>
    </div>
    <button class="delete-overlay-btn" title="Delete Table" onclick="removeOverlayElement('${id}')" style="top: -6px; right: -6px;">×</button>
    <table>
      <tbody>
  `;
  
  for (let r = 0; r < rows; r++) {
    tableHtml += `<tr>`;
    for (let c = 0; c < cols; c++) {
      tableHtml += `<td contenteditable="true"></td>`;
    }
    tableHtml += `</tr>`;
  }
  
  tableHtml += `
      </tbody>
    </table>
  `;
  
  tableWrapper.innerHTML = tableHtml;
  overlay.appendChild(tableWrapper);
  makeElementDraggable(tableWrapper, tableWrapper.querySelector('.drag-handle-bar'));

  // Append resizer
  const resizer = document.createElement('div');
  resizer.className = 'table-resizer';
  resizer.innerHTML = `
    <svg width="10" height="10" viewBox="0 0 10 10" style="position: absolute; bottom: 1px; right: 1px; pointer-events: none;">
      <path d="M10 0 L0 10 M10 4 L4 10 M10 8 L8 10" stroke="#94A3B8" stroke-width="1.5"/>
    </svg>
  `;
  tableWrapper.appendChild(resizer);
  makeElementResizable(tableWrapper, resizer);

  notebookHasUnsavedChanges = true;

  // Track table cell typing changes
  tableWrapper.addEventListener('input', () => {
    notebookHasUnsavedChanges = true;
  });
}

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  canvasCtx.closePath();
  if (typeof recordNotebookState === 'function') recordNotebookState();
}

function removeOverlayElement(id) {
  const el = document.getElementById(id);
  if (el) {
    el.remove();
    notebookHasUnsavedChanges = true;
    if (typeof recordNotebookState === 'function') recordNotebookState();
  }
}
window.removeOverlayElement = removeOverlayElement;

function makeElementDraggable(el, handle = el) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let startX = 0, startY = 0;
  
  handle.onmousedown = dragMouseDown;

  // Intercept click events in the capture phase to cancel them if a drag occurred
  el.addEventListener('click', (e) => {
    if (el.getAttribute('data-dragged') === 'true') {
      e.preventDefault();
      e.stopPropagation();
      el.setAttribute('data-dragged', 'false'); // reset for future clicks
      return false;
    }
  }, true);

  function dragMouseDown(e) {
    isDrawing = false;
    if (e.target.classList.contains('delete-overlay-btn')) return;
    if (e.target.tagName === 'TD' || e.target.closest('td') || e.target.closest('[contenteditable="true"]')) return;
    
    e = e || window.event;
    e.preventDefault();
    
    startX = e.clientX;
    startY = e.clientY;
    el.setAttribute('data-dragged', 'false');
    
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    
    const dist = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));
    if (dist > 5) {
      el.setAttribute('data-dragged', 'true');
    }
    
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    const overlay = document.getElementById('notebook-overlay-container');
    const containerRect = overlay.getBoundingClientRect();
    
    let newTop = el.offsetTop - pos2;
    let newLeft = el.offsetLeft - pos1;
    
    newTop = Math.max(0, Math.min(newTop, containerRect.height - el.offsetHeight));
    newLeft = Math.max(0, Math.min(newLeft, containerRect.width - el.offsetWidth));
    
    el.style.top = `${newTop}px`;
    el.style.left = `${newLeft}px`;
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    if (el.getAttribute('data-dragged') === 'true') {
      notebookHasUnsavedChanges = true;
      if (typeof recordNotebookState === 'function') recordNotebookState();
    }
  }
}

async function saveNotebookData() {
  const btnSave = document.getElementById('btn-save-notebook');
  if (!btnSave) return;

  const originalText = btnSave.textContent;
  btnSave.disabled = true;
  btnSave.textContent = 'Saving...';

  try {
    const canvasData = canvasElement.toDataURL('image/png');
    const overlay = document.getElementById('notebook-overlay-container');
    const elementsArray = [];
    
    if (overlay) {
      Array.from(overlay.children).forEach(el => {
        const type = el.getAttribute('data-type');
        const id = el.id;
        const left = parseFloat(el.style.left) || 0;
        const top = parseFloat(el.style.top) || 0;
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        
        if (type === 'sticky') {
          const cardId = el.getAttribute('data-card-id');
          const fileName = el.querySelector('.draggable-note-title')?.textContent || '';
          const excerpt = el.querySelector('.draggable-note-text')?.textContent || '';
          const rotation = el.getAttribute('data-rotation');
          elementsArray.push({
            type, id, left, top, width, height, rotation,
            content: { cardId, fileName, excerpt }
          });
        } 
        else if (type === 'text') {
          const color = el.getAttribute('data-color');
          const fontSize = el.getAttribute('data-font-size');
          const textContent = el.querySelector('[contenteditable]')?.innerHTML || '';
          elementsArray.push({
            type, id, left, top, width, height, color, fontSize,
            content: textContent
          });
        }
        else if (type === 'table') {
          const rows = el.getAttribute('data-rows');
          const cols = el.getAttribute('data-cols');
          const cells = [];
          el.querySelectorAll('td').forEach(td => {
            cells.push(td.innerHTML);
          });
          
          elementsArray.push({
            type, id, left, top, width, height,
            content: { rows, cols, cells }
          });
        }
        else if (type === 'image') {
          const src = el.getAttribute('data-src');
          elementsArray.push({
            type, id, left, top, width, height,
            content: src
          });
        }
        else if (type === 'shape') {
          const shapeType = el.getAttribute('data-shape-type');
          const color = el.getAttribute('data-color');
          const flippedX = el.getAttribute('data-flipped-x');
          const flippedY = el.getAttribute('data-flipped-y');
          elementsArray.push({
            type, id, left, top, width, height, color,
            content: { shapeType, flippedX, flippedY }
          });
        }
        else if (type === 'ai_table') {
          const title = el.getAttribute('data-table-title');
          const tableJson = el.getAttribute('data-table-json');
          elementsArray.push({
            type, id, left, top, width, height, title,
            content: tableJson
          });
        }
        else if (type === 'ai_chart') {
          const title = el.getAttribute('data-chart-title');
          const chartJson = el.getAttribute('data-chart-json');
          elementsArray.push({
            type, id, left, top, width, height, title,
            content: chartJson
          });
        }
      });
    }

    const activePage = notebookPages.find(p => p.page_number === currentNotebookPageNumber);
    const targetUserId = (activePage && activePage.is_shared) ? activePage.owner_id : currentUser.id;

    const { error } = await supabaseClient
      .from('notebooks')
      .upsert({
        user_id: targetUserId,
        page_number: currentNotebookPageNumber,
        canvas_data: canvasData,
        elements: elementsArray,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,page_number' });

    if (error) {
      console.error("Notebook upsert failed: ", error);
      showDashboardAlert('error', 'Failed to save notebook. Please try again.');
    } else {
      showDashboardAlert('success', 'Notebook saved!');
      notebookHasUnsavedChanges = false;
      
      // Update local state in memory
      const existingIdx = notebookPages.findIndex(p => p.page_number === currentNotebookPageNumber);
      const pageData = {
        user_id: targetUserId,
        page_number: currentNotebookPageNumber,
        canvas_data: canvasData,
        elements: elementsArray,
        updated_at: new Date().toISOString(),
        is_shared: activePage ? activePage.is_shared : false,
        owner_name: activePage ? activePage.owner_name : null,
        owner_id: targetUserId
      };
      if (existingIdx >= 0) {
        notebookPages[existingIdx] = pageData;
      } else {
        notebookPages.push(pageData);
        notebookPages.sort((a, b) => a.page_number - b.page_number);
      }
      
      if (notebookPages.length === 1 && existingIdx === -1) {
        await awardAchievement('first_notebook_save');
      }
    }
  } catch (err) {
    console.error("Exception saving notebook: ", err);
    showDashboardAlert('error', 'Notebook save failed.');
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = originalText;
  }
}

let notebookPages = [];
let currentNotebookPageNumber = 1;

async function loadNotebookData() {
  const overlay = document.getElementById('notebook-overlay-container');
  if (!overlay || !canvasCtx || !canvasElement) return;

  try {
    const { data: pages, error } = await supabaseClient
      .from('notebooks')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('page_number', { ascending: true });

    if (error) {
      console.error("Failed to load notebooks data: ", error);
      return;
    }

    if (!pages || pages.length === 0) {
      notebookPages = [{
        user_id: currentUser.id,
        page_number: 1,
        canvas_data: null,
        elements: []
      }];
      currentNotebookPageNumber = 1;
    } else {
      notebookPages = pages;
      if (!notebookPages.some(p => p.page_number === currentNotebookPageNumber)) {
        currentNotebookPageNumber = notebookPages[0].page_number;
      }
    }

    // Load shared pages
    if (typeof loadSharedPages === 'function') {
      await loadSharedPages();
    }

    resetNotebookHistory();
    renderCurrentPageData();
  } catch (err) {
    console.error("Exception loading saved notebook data: ", err);
  }
}

async function navigateNotebookPage(direction) {
  const currentIdx = notebookPages.findIndex(p => p.page_number === currentNotebookPageNumber);
  if (currentIdx === -1) return;
  const nextIdx = currentIdx + direction;
  if (nextIdx < 0 || nextIdx >= notebookPages.length) return;

  if (notebookHasUnsavedChanges) {
    const isTr = localStorage.getItem('acadexUILang') === 'tr';
    const confirmSave = confirm(
      isTr 
        ? "Kaydedilmemiş değişiklikleriniz var. Sayfa değiştirmeden önce kaydetmek ister misiniz?"
        : "You have unsaved changes. Would you like to save before switching pages?"
    );
    if (confirmSave) {
      await saveNotebookData();
    }
  }

  currentNotebookPageNumber = notebookPages[nextIdx].page_number;
  notebookHasUnsavedChanges = false;
  resetNotebookHistory();
  renderCurrentPageData();
}

async function createNewNotebookPage() {
  openTemplatePickerModal();
}

async function deleteCurrentNotebookPage() {
  if (notebookPages.length <= 1) {
    const isTr = localStorage.getItem('acadexUILang') === 'tr';
    showDashboardAlert('error', isTr ? 'Tek kalan sayfa silinemez!' : 'Cannot delete the only remaining page!');
    return;
  }

  const isTr = localStorage.getItem('acadexUILang') === 'tr';
  const confirmDelete = confirm(
    isTr
      ? "Bu sayfayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      : "Are you sure you want to delete this page? This action cannot be undone."
  );
  if (!confirmDelete) return;

  try {
    const { error } = await supabaseClient
      .from('notebooks')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('page_number', currentNotebookPageNumber);

    if (error) throw error;

    const currentIdx = notebookPages.findIndex(p => p.page_number === currentNotebookPageNumber);
    notebookPages.splice(currentIdx, 1);
    
    const nextIdx = Math.max(0, currentIdx - 1);
    currentNotebookPageNumber = notebookPages[nextIdx].page_number;
    
    notebookHasUnsavedChanges = false;
    renderCurrentPageData();
    showDashboardAlert('success', isTr ? 'Sayfa silindi!' : 'Page deleted successfully!');
  } catch (err) {
    console.error("Failed to delete notebook page:", err);
    showDashboardAlert('error', isTr ? 'Sayfa silinemedi.' : 'Failed to delete page.');
  }
}

function renderCurrentPageData() {
  const overlay = document.getElementById('notebook-overlay-container');
  if (!overlay || !canvasCtx || !canvasElement) return;

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  overlay.innerHTML = '';

  const activePage = notebookPages.find(p => p.page_number === currentNotebookPageNumber);
  if (!activePage) return;

  if (activePage.canvas_data) {
    const img = new Image();
    img.src = activePage.canvas_data;
    img.onload = () => {
      canvasCtx.drawImage(img, 0, 0);
    };
  }

  const elements = activePage.elements || [];
  elements.forEach(item => {
    if (item.type === 'sticky') {
      const note = document.createElement('div');
      note.className = 'draggable-element draggable-note';
      note.id = item.id;
      note.style.left = `${item.left}px`;
      note.style.top = `${item.top}px`;
      note.style.transform = `rotate(${item.rotation || 0}deg)`;
      note.setAttribute('data-type', 'sticky');
      note.setAttribute('data-card-id', item.content.cardId);
      note.setAttribute('data-rotation', item.rotation || 0);

      note.innerHTML = `
        <button class="delete-overlay-btn" title="Remove Sticky Note" onclick="removeOverlayElement('${item.id}')">×</button>
        <div class="draggable-note-title">${item.content.fileName}</div>
        <div class="draggable-note-text">${item.content.excerpt}</div>
        <div class="draggable-note-footer">Acadex Card</div>
      `;

      note.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-overlay-btn') || e.target.closest('.delete-overlay-btn')) return;
        viewStudyCard(item.content.cardId, item.content.fileName, false, item.content.cardId);
      });

      overlay.appendChild(note);
      makeElementDraggable(note);
    }
    else if (item.type === 'text') {
      const textBox = document.createElement('div');
      textBox.className = 'draggable-element draggable-text-box';
      textBox.id = item.id;
      textBox.style.left = `${item.left}px`;
      textBox.style.top = `${item.top}px`;
      textBox.style.color = item.color;
      textBox.style.fontSize = item.fontSize;
      textBox.setAttribute('data-type', 'text');
      textBox.setAttribute('data-color', item.color);
      textBox.setAttribute('data-font-size', item.fontSize);

      textBox.innerHTML = `
        <button class="delete-overlay-btn" title="Delete Text" onclick="removeOverlayElement('${item.id}')" style="top: -6px; right: -6px;">×</button>
        <div contenteditable="false" style="outline:none; min-width: 150px; white-space: pre-wrap; overflow-wrap: break-word; font-family: inherit; font-size: inherit;" onblur="handleTextBlur('${item.id}')">${item.content}</div>
      `;

      overlay.appendChild(textBox);
      makeElementDraggable(textBox);

      textBox.addEventListener('dblclick', (evt) => {
        if (evt.target.classList.contains('delete-overlay-btn')) return;
        const ed = textBox.querySelector('[contenteditable]');
        if (ed) {
          ed.contentEditable = "true";
          textBox.classList.add('editing');
          activeEditingTextBox = textBox;
          ed.focus();
        }
      });
    }
    else if (item.type === 'table') {
      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'draggable-element draggable-table-wrapper';
      tableWrapper.id = item.id;
      tableWrapper.style.left = `${item.left}px`;
      tableWrapper.style.top = `${item.top}px`;
      tableWrapper.setAttribute('data-type', 'table');
      tableWrapper.setAttribute('data-rows', item.content.rows);
      tableWrapper.setAttribute('data-cols', item.content.cols);
      if (item.width) tableWrapper.style.width = `${item.width}px`;
      if (item.height) tableWrapper.style.height = `${item.height}px`;

      let tableHtml = `
        <div class="drag-handle-bar"></div>
        <div class="table-actions-bar">
          <button class="table-btn" onclick="addTableRow(this)" title="Add Row">+ Row</button>
          <button class="table-btn" onclick="deleteTableRow(this)" title="Remove Row">− Row</button>
          <button class="table-btn" onclick="addTableCol(this)" title="Add Column">+ Col</button>
          <button class="table-btn" onclick="deleteTableCol(this)" title="Remove Column">− Col</button>
        </div>
        <button class="delete-overlay-btn" title="Delete Table" onclick="removeOverlayElement('${item.id}')" style="top: -6px; right: -6px;">×</button>
        <table>
          <tbody>
      `;
      
      let cellIdx = 0;
      const rows = parseInt(item.content.rows);
      const cols = parseInt(item.content.cols);
      
      for (let r = 0; r < rows; r++) {
        tableHtml += `<tr>`;
        for (let c = 0; c < cols; c++) {
          const cellVal = item.content.cells[cellIdx] || '';
          tableHtml += `<td contenteditable="true">${cellVal}</td>`;
          cellIdx++;
        }
        tableHtml += `</tr>`;
      }
      
      tableHtml += `
          </tbody>
        </table>
      `;
      
      tableWrapper.innerHTML = tableHtml;
      overlay.appendChild(tableWrapper);
      makeElementDraggable(tableWrapper, tableWrapper.querySelector('.drag-handle-bar'));

      const resizer = document.createElement('div');
      resizer.className = 'table-resizer';
      resizer.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 10 10" style="position: absolute; bottom: 1px; right: 1px; pointer-events: none;">
          <path d="M10 0 L0 10 M10 4 L4 10 M10 8 L8 10" stroke="#94A3B8" stroke-width="1.5"/>
        </svg>
      `;
      tableWrapper.appendChild(resizer);
      makeElementResizable(tableWrapper, resizer);

      tableWrapper.addEventListener('input', () => {
        notebookHasUnsavedChanges = true;
      });
    }
    else if (item.type === 'image') {
      insertImageElement(item.content, item.left, item.top, item.width, item.height, item.id);
    }
    else if (item.type === 'shape') {
      insertShapeElement(item.id, item.content.shapeType, item.color, item.left, item.top, item.width, item.height, item.content.flippedX === 'true', item.content.flippedY === 'true');
    }
    else if (item.type === 'ai_table') {
      insertAiTableCanvasElement(item.content, item.title, item.left, item.top, item.width, item.height, item.id);
    }
    else if (item.type === 'ai_chart') {
      insertAiChartCanvasElement(item.content, item.title, item.left, item.top, item.width, item.height, item.id);
    }
  });

  updatePageControlsUI();
}

function updatePageControlsUI() {
  const currentLang = localStorage.getItem('acadexUILang') || 'en';
  const prevBtn = document.getElementById('btn-page-prev');
  const nextBtn = document.getElementById('btn-page-next');
  const deleteBtn = document.getElementById('btn-page-delete');
  const indicator = document.getElementById('notebook-page-indicator');

  if (!notebookPages || notebookPages.length === 0) return;

  const currentIdx = notebookPages.findIndex(p => p.page_number === currentNotebookPageNumber);
  if (indicator) {
    if (currentLang === 'tr') {
      indicator.textContent = `Sayfa ${currentIdx + 1} / ${notebookPages.length}`;
    } else {
      indicator.textContent = `Page ${currentIdx + 1} of ${notebookPages.length}`;
    }
  }

  if (prevBtn) prevBtn.disabled = (currentIdx === 0);
  if (nextBtn) nextBtn.disabled = (currentIdx === notebookPages.length - 1);
  if (deleteBtn) deleteBtn.disabled = (notebookPages.length <= 1);
}

function makeElementResizable(el, resizer) {
  resizer.addEventListener('mousedown', initResize, false);

  function initResize(e) {
    e.preventDefault();
    e.stopPropagation();
    window.addEventListener('mousemove', startResize, false);
    window.addEventListener('mouseup', stopResize, false);
  }

  function startResize(e) {
    const rect = el.getBoundingClientRect();
    const overlay = document.getElementById('notebook-overlay-container');
    const overlayRect = overlay.getBoundingClientRect();
    
    let newWidth = e.clientX - rect.left;
    let newHeight = e.clientY - rect.top;

    const type = el.getAttribute('data-type');
    const minW = (type === 'shape' || type === 'image') ? 10 : 150;
    const minH = (type === 'shape' || type === 'image') ? 10 : 100;

    newWidth = Math.max(minW, newWidth);
    newHeight = Math.max(minH, newHeight);

    const maxW = overlayRect.width - el.offsetLeft;
    const maxH = overlayRect.height - el.offsetTop;
    newWidth = Math.min(newWidth, maxW);
    newHeight = Math.min(newHeight, maxH);

    el.style.width = newWidth + 'px';
    el.style.height = newHeight + 'px';
    
    const tbl = el.querySelector('table');
    if (tbl) {
      tbl.style.width = '100%';
      const dragBar = el.querySelector('.drag-handle-bar');
      const actionBar = el.querySelector('.table-actions-bar');
      const headerH = (dragBar ? dragBar.offsetHeight : 0) + (actionBar ? actionBar.offsetHeight : 0);
      tbl.style.height = `calc(100% - ${headerH}px)`;
    }
  }

  function stopResize(e) {
    window.removeEventListener('mousemove', startResize, false);
    window.removeEventListener('mouseup', stopResize, false);
    notebookHasUnsavedChanges = true;
  }
}

function addTableRow(btn) {
  const wrapper = btn.closest('.draggable-table-wrapper');
  if (!wrapper) return;
  const tbody = wrapper.querySelector('tbody');
  const cols = parseInt(wrapper.getAttribute('data-cols'), 10) || 1;
  const tr = document.createElement('tr');
  for (let i = 0; i < cols; i++) {
    const td = document.createElement('td');
    td.contentEditable = "true";
    tr.appendChild(td);
  }
  tbody.appendChild(tr);
  wrapper.setAttribute('data-rows', parseInt(wrapper.getAttribute('data-rows'), 10) + 1);
  notebookHasUnsavedChanges = true;
}

function deleteTableRow(btn) {
  const wrapper = btn.closest('.draggable-table-wrapper');
  if (!wrapper) return;
  const tbody = wrapper.querySelector('tbody');
  const rows = parseInt(wrapper.getAttribute('data-rows'), 10) || 1;
  if (rows <= 1) return;
  tbody.lastElementChild?.remove();
  wrapper.setAttribute('data-rows', rows - 1);
  notebookHasUnsavedChanges = true;
}

function addTableCol(btn) {
  const wrapper = btn.closest('.draggable-table-wrapper');
  if (!wrapper) return;
  const trs = wrapper.querySelectorAll('tbody tr');
  trs.forEach(tr => {
    const td = document.createElement('td');
    td.contentEditable = "true";
    tr.appendChild(td);
  });
  wrapper.setAttribute('data-cols', (parseInt(wrapper.getAttribute('data-cols'), 10) || 0) + 1);
  notebookHasUnsavedChanges = true;
}

function deleteTableCol(btn) {
  const wrapper = btn.closest('.draggable-table-wrapper');
  if (!wrapper) return;
  const cols = parseInt(wrapper.getAttribute('data-cols'), 10) || 1;
  if (cols <= 1) return;
  const trs = wrapper.querySelectorAll('tbody tr');
  trs.forEach(tr => {
    tr.lastElementChild?.remove();
  });
  wrapper.setAttribute('data-cols', cols - 1);
  notebookHasUnsavedChanges = true;
}

function handleTextSelectionChange() {
  const selection = window.getSelection();
  const toolbar = document.getElementById('text-format-toolbar');
  if (!toolbar) return;

  if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const editableParent = container.nodeType === 1 ? container.closest('[contenteditable="true"]') : container.parentElement?.closest('[contenteditable="true"]');
    
    if (editableParent && document.getElementById('notebook-overlay-container')?.contains(editableParent)) {
      const rect = range.getBoundingClientRect();
      toolbar.style.display = 'flex';
      
      const toolbarHeight = toolbar.offsetHeight || 32;
      const toolbarWidth = toolbar.offsetWidth || 100;
      
      let left = rect.left + window.scrollX + (rect.width - toolbarWidth) / 2;
      let top = rect.top + window.scrollY - toolbarHeight - 8;
      
      if (left < 10) left = 10;
      if (top < 10) top = rect.bottom + window.scrollY + 8;
      
      toolbar.style.left = `${left}px`;
      toolbar.style.top = `${top}px`;
      return;
    }
  }
  
  toolbar.style.display = 'none';
}

function applyTextFormat(command) {
  document.execCommand(command, false, null);
  notebookHasUnsavedChanges = true;
}

window.navigateNotebookPage = navigateNotebookPage;
window.createNewNotebookPage = createNewNotebookPage;
window.deleteCurrentNotebookPage = deleteCurrentNotebookPage;
window.addTableRow = addTableRow;
window.deleteTableRow = deleteTableRow;
window.addTableCol = addTableCol;
window.deleteTableCol = deleteTableCol;
window.applyTextFormat = applyTextFormat;



async function loadDepartmentFeed() {
  const feedSection = document.getElementById('feed-list-section');
  if (!feedSection) return;

  const deptName = currentUserProfile?.department || 'your Department';
  const translatedDept = translateDepartment(deptName);
  const currentLang = localStorage.getItem('acadexUILang') || 'en';
  const feedTitle = document.getElementById('feed-title');
  if (feedTitle) {
    if (currentLang === 'tr') {
      feedTitle.textContent = `${translatedDept} Akışı`;
    } else {
      feedTitle.textContent = `${translatedDept} Feed`;
    }
  }

  feedSection.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 2rem;">
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 32px; height: 32px; color: var(--color-teal);">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
      </svg>
    </div>
  `;

  try {
    const { data: cards, error } = await supabaseClient
      .from('study_cards')
      .select('*, documents(file_name)')
      .eq('is_shared', true)
      .eq('department', currentUserProfile?.department)
      .order('shared_at', { ascending: false })
      .limit(departmentFeedLimit);

    if (error) {
      console.error("Error fetching department feed: ", error);
      feedSection.innerHTML = `<p style="color: var(--color-text-muted);">Failed to load department feed.</p>`;
      return;
    }

    if (!cards || cards.length === 0) {
      renderDepartmentFeed([], {});
      return;
    }

    // Fetch sharers' profiles client-side
    const userIds = [...new Set(cards.map(c => c.user_id))];
    const { data: profiles, error: profError } = await supabaseClient
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    const profileMap = {};
    profiles?.forEach(p => {
      profileMap[p.id] = { full_name: p.full_name || 'A classmate', avatar_url: p.avatar_url };
    });

    // Fetch "helpful" vote counts + whether the current user already voted.
    // Table is created by supabase/migrations/20260717_add_study_card_votes.sql
    // — if that migration hasn't been run yet, this simply fails silently
    // and vote counts default to 0 everywhere.
    feedVoteCounts = {};
    feedUserVotedSet = new Set();
    try {
      const cardIds = cards.map(c => c.id);
      const { data: votes, error: votesError } = await supabaseClient
        .from('study_card_votes')
        .select('card_id, user_id')
        .in('card_id', cardIds);
      if (!votesError && votes) {
        votes.forEach(v => {
          feedVoteCounts[v.card_id] = (feedVoteCounts[v.card_id] || 0) + 1;
          if (v.user_id === currentUser?.id) feedUserVotedSet.add(v.card_id);
        });
      }
    } catch (voteErr) {
      console.warn('Could not load feed vote counts (has the study_card_votes migration been run?):', voteErr);
    }

    // Populate + wire feed course filter (Phase 17)
    const feedFilterBar = document.getElementById('feed-filter-bar');
    const feedFilterCourse = document.getElementById('feed-filter-course');
    if (feedFilterCourse) {
      const tags = [...new Set(cards.map(c => c.course_tag).filter(Boolean))].sort();
      // A pending deep-link from ders-agaci.html (?course=CODE) takes priority
      // over whatever was previously selected — see checkSessionAndLoadProfile().
      const pendingFilter = feedFilterCourse.dataset.pendingFilter;
      delete feedFilterCourse.dataset.pendingFilter;
      const prevVal = pendingFilter || feedFilterCourse.value;
      feedFilterCourse.innerHTML = '<option value="all">All Courses</option>';
      tags.forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = tag;
        feedFilterCourse.appendChild(opt);
      });
      if (tags.includes(prevVal)) feedFilterCourse.value = prevVal;

      // Show bar only if there are tagged cards
      if (feedFilterBar) {
        feedFilterBar.style.display = tags.length > 0 ? 'flex' : 'none';
      }

      // Wire change event (set once using a flag to avoid duplicates)
      if (!feedFilterCourse.dataset.wired) {
        feedFilterCourse.dataset.wired = 'true';
        feedFilterCourse.addEventListener('change', () => {
          const selectedCourse = feedFilterCourse.value;
          const filtered = cards.filter(c => selectedCourse === 'all' || c.course_tag === selectedCourse);
          renderDepartmentFeed(filtered, profileMap);
        });
      }
    }

    // Apply current course filter selection
    const selectedCourse = feedFilterCourse?.value || 'all';
    const filteredCards = selectedCourse === 'all' ? cards : cards.filter(c => c.course_tag === selectedCourse);

    renderDepartmentFeed(filteredCards, profileMap);

  } catch (err) {
    console.error("Exception loading department feed: ", err);
    feedSection.innerHTML = `<p style="color: var(--color-text-muted);">Failed to load department feed.</p>`;
  }
}

function renderDepartmentFeed(cards, profileMap) {
  const feedSection = document.getElementById('feed-list-section');
  if (!feedSection) return;

  const deptName = currentUserProfile?.department || 'your Department';

  if (cards.length === 0) {
    feedSection.innerHTML = `
      <div class="empty-state" style="margin-top: 1rem;">
        <svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <h3 class="empty-state-title">No shared study cards</h3>
        <p class="empty-state-text">No shared study cards in ${deptName} yet. Be the first to share one from your <a href="#" onclick="switchDashboardView('notebook')" style="color: var(--color-teal); text-decoration: underline;">Study Notebook</a>!</p>
      </div>
    `;
    return;
  }

  // Create grid
  feedSection.innerHTML = `<div class="docs-grid" id="feed-grid"></div>`;
  const grid = document.getElementById('feed-grid');

  cards.forEach(card => {
    const formattedDate = new Date(card.shared_at || card.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const sharerProfile = profileMap[card.user_id] || { full_name: 'A classmate', avatar_url: null };
    const sharerName = sharerProfile.full_name;
    const docName = card.documents?.file_name || 'Shared Document';
    const excerpt = card.summary && card.summary.length > 120
      ? card.summary.substring(0, 120) + '...'
      : card.summary || 'No summary text generated.';

    const badgeClass = getDepartmentColorClass(card.department);
    const shortName = getDepartmentShortName(card.department);

    const cardEl = document.createElement('div');
    cardEl.className = 'doc-card';
    cardEl.innerHTML = `
      <div class="doc-header">
        <div class="doc-file-icon text" style="background-color: var(--color-teal-light); color: var(--color-teal);">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        </div>
        <div class="doc-info" style="width: calc(100% - 40px);">
          <h4 class="doc-name" title="${docName}">${docName}</h4>
          <div class="feed-card-sharer" style="display:flex; align-items:center; gap:0.35rem;">
            ${renderUserAvatarHtml(sharerProfile, 18)}
            <span>By: ${sharerName}</span>
            <span class="dept-badge ${badgeClass}" style="margin-left: 4px; font-size: 0.65rem;">${shortName}</span>
          </div>
          <div class="doc-meta" style="margin-top: 2px;">
            <span>Shared: ${formattedDate}</span>
          </div>
        </div>
      </div>

      <p class="feed-card-excerpt" style="margin: 0.75rem 0;">${excerpt}</p>

      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <button class="btn btn-primary btn-view-summary" data-doc-id="${card.document_id}" data-doc-name="${docName.replace(/'/g, "\\'")}" data-read-only="true" style="flex: 1; border: none; font-size: 0.85rem; padding: 0.5rem 1rem;">View Summary</button>
        ${renderVoteButtonHtml(card.id)}
      </div>
    `;
    grid.appendChild(cardEl);
  });

  if (cards.length === departmentFeedLimit) {
    const loadMoreContainer = document.createElement('div');
    loadMoreContainer.style.cssText = 'text-align: center; margin-top: 2rem; margin-bottom: 2rem; grid-column: 1 / -1; width: 100%;';
    
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'btn btn-outline';
    loadMoreBtn.id = 'btn-load-more-feed';
    loadMoreBtn.textContent = 'Load More / Daha Fazla Yükle';
    loadMoreBtn.style.padding = '0.6rem 1.5rem';
    loadMoreBtn.style.fontSize = '0.85rem';
    
    loadMoreBtn.addEventListener('click', async () => {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'Loading...';
      departmentFeedLimit += 30;
      await loadDepartmentFeed();
    });
    
    loadMoreContainer.appendChild(loadMoreBtn);
    grid.appendChild(loadMoreContainer);
  }
}

// ==========================================
// Department Feed quality voting ("helpful" votes)
// Lets students upvote shared study cards so the most useful material rises
// to the top over time. Requires the study_card_votes table — see
// supabase/migrations/20260717_add_study_card_votes.sql.
// ==========================================
function renderVoteButtonHtml(cardId) {
  const count = feedVoteCounts[cardId] || 0;
  const voted = feedUserVotedSet.has(cardId);
  return `
    <button id="vote-btn-${cardId}" onclick="toggleCardVote('${cardId}')"
      class="btn ${voted ? 'btn-primary' : 'btn-outline'}"
      title="${voted ? 'Faydalı buldum işaretini kaldır' : 'Bunu faydalı buldum'}"
      style="padding: 0.5rem 0.75rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.35rem; white-space: nowrap; ${voted ? 'border: none; background: var(--color-teal); color: white;' : ''}">
      <span aria-hidden="true">👍</span>
      <span id="vote-count-${cardId}">${count}</span>
    </button>
  `;
}

async function toggleCardVote(cardId) {
  if (!currentUser) return;
  const btn = document.getElementById(`vote-btn-${cardId}`);
  const countEl = document.getElementById(`vote-count-${cardId}`);
  if (btn) btn.disabled = true;

  const alreadyVoted = feedUserVotedSet.has(cardId);

  try {
    if (alreadyVoted) {
      const { error } = await supabaseClient
        .from('study_card_votes')
        .delete()
        .eq('card_id', cardId)
        .eq('user_id', currentUser.id);
      if (error) throw error;
      feedUserVotedSet.delete(cardId);
      feedVoteCounts[cardId] = Math.max(0, (feedVoteCounts[cardId] || 1) - 1);
    } else {
      const { error } = await supabaseClient
        .from('study_card_votes')
        .insert({ card_id: cardId, user_id: currentUser.id });
      if (error) throw error;
      feedUserVotedSet.add(cardId);
      feedVoteCounts[cardId] = (feedVoteCounts[cardId] || 0) + 1;
    }

    // Update just this button in place rather than re-rendering the whole feed.
    if (btn) {
      const nowVoted = feedUserVotedSet.has(cardId);
      btn.className = `btn ${nowVoted ? 'btn-primary' : 'btn-outline'}`;
      btn.title = nowVoted ? 'Faydalı buldum işaretini kaldır' : 'Bunu faydalı buldum';
      btn.style.cssText = `padding: 0.5rem 0.75rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.35rem; white-space: nowrap; ${nowVoted ? 'border: none; background: var(--color-teal); color: white;' : ''}`;
    }
    if (countEl) countEl.textContent = feedVoteCounts[cardId] || 0;
  } catch (err) {
    console.error('Failed to toggle card vote (has the study_card_votes migration been run?):', err);
    showDashboardAlert('error', 'Oy kaydedilemedi. Bu özellik için gerekli veritabanı tablosu henüz oluşturulmamış olabilir.');
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.toggleCardVote = toggleCardVote;

function getDepartmentColorClass(dept) {
  if (!dept) return '';
  const d = dept.toLowerCase();
  if (d.includes('information') || d.includes('mis')) return 'dept-mis';
  if (d.includes('administration') || d.includes('business')) return 'dept-ba';
  if (d.includes('international') || d.includes('trade')) return 'dept-itb';
  if (d.includes('banking') || d.includes('finance')) return 'dept-bf';
  return '';
}

function getDepartmentShortName(dept) {
  if (!dept) return '';
  const d = dept.toLowerCase();
  if (d.includes('information') || d.includes('mis')) return 'MIS';
  if (d.includes('administration') || d.includes('business')) return 'BA';
  if (d.includes('international') || d.includes('trade')) return 'ITB';
  if (d.includes('banking') || d.includes('finance')) return 'B&F';
  return 'DEPT';
}

// ==========================================================================
// KAYNAKLA ÇALIŞ (SOURCE HUB) — dedicated page: original document, summary,
// and Chat with Source side by side (3 columns on wide screens, stacked on
// narrow ones). Reuses renderOriginalDocumentPreview() for the PDF column,
// a trimmed version of the study card modal's summary rendering for the
// middle column, and its own independent chat implementation (separate
// conversation state from the modal's "Kaynakla Sohbet" pane, but backed by
// the same chat-with-document edge function and the same shared helpers —
// createChatImageActionRow, renderMermaidIntoBubble, saveChatImageToSummary,
// downscaleImageForChat) so behavior stays consistent between the two.
// ==========================================================================
let sourceHubCards = [];
let sourceHubActiveCardId = null;

async function loadSourceHubView() {
  const select = document.getElementById('sourcehub-card-select');
  const emptyState = document.getElementById('sourcehub-empty-state');
  const columns = document.getElementById('sourcehub-columns');
  if (!select) return;

  try {
    const { data: cards, error } = await supabaseClient
      .from('study_cards')
      .select('*, documents(file_name)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('loadSourceHubView: failed to fetch study cards:', error);
      return;
    }

    sourceHubCards = cards || [];

    if (sourceHubCards.length === 0) {
      select.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (columns) columns.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    select.innerHTML = sourceHubCards.map(c => {
      const docName = c.documents?.file_name || 'Untitled';
      const styleName = getStyleLabel(c.summary_style);
      const formattedTime = new Date(c.created_at || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<option value="${c.id}">${escapeHtml(docName)} — ${escapeHtml(styleName)} (${formattedTime})</option>`;
    }).join('');

    select.onchange = (e) => loadSourceHubCard(e.target.value);

    // Keep whatever was already open if it still exists, otherwise default
    // to the most recently generated card.
    const stillExists = sourceHubActiveCardId && sourceHubCards.some(c => c.id === sourceHubActiveCardId);
    const targetId = stillExists ? sourceHubActiveCardId : sourceHubCards[0].id;
    select.value = targetId;
    await loadSourceHubCard(targetId);

  } catch (err) {
    console.error('Exception in loadSourceHubView:', err);
  }
}
window.loadSourceHubView = loadSourceHubView;

async function loadSourceHubCard(cardId) {
  const card = sourceHubCards.find(c => c.id === cardId);
  const columns = document.getElementById('sourcehub-columns');
  if (!card || !columns) return;

  sourceHubActiveCardId = cardId;
  columns.style.display = 'grid';

  const docName = card.documents?.file_name || 'Untitled';
  const cardLike = { ...card, documentFileName: docName };
  currentActiveStudyCard = cardLike; // shared "focus" pointer used by chat/depot/summary-save helpers

  // Column 1: original document
  const pdfPane = document.getElementById('sourcehub-pdf-pane');
  renderOriginalDocumentPreview(pdfPane, cardLike);

  // Column 2: summary
  renderSourceHubSummary(card, docName);

  // Column 3: chat — fresh conversation whenever the selected card changes
  resetSourceHubChatState();
}
window.loadSourceHubCard = loadSourceHubCard;

function renderSourceHubSummary(card, docName) {
  const badgesEl = document.getElementById('sourcehub-summary-badges');
  if (badgesEl) {
    const style = card.summary_style || 'standard';
    const langCode = card.summary_language || 'en';
    badgesEl.innerHTML = `
      <span class="style-badge style-${style}">${getStyleLabel(style)}</span>
      <span class="style-badge">${langCode === 'tr' ? 'Türkçe' : 'English'}</span>
      ${getDocumentTypeBadgeHtml(card.document_type)}
    `;
  }

  const summaryTextEl = document.getElementById('sourcehub-summary-text');
  if (summaryTextEl) {
    summaryTextEl.innerHTML = renderSectionsOutlineHtml(card.sections, card.footnotes) + (formatSummaryText(card.summary, card.footnotes) || 'No summary generated for this document.');
  }

  const pointsEl = document.getElementById('sourcehub-points-container');
  if (pointsEl) {
    pointsEl.innerHTML = '';
    const keyPoints = card.key_points || [];
    if (keyPoints.length === 0) {
      pointsEl.innerHTML = '<li class="study-card-point-item">No key points generated.</li>';
    } else {
      keyPoints.forEach(pt => {
        const li = document.createElement('li');
        li.className = 'study-card-point-item';
        li.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>${formatFootnoteMarkers(pt, card.footnotes)}</span>
        `;
        pointsEl.appendChild(li);
      });
    }
  }

  renderStudyCardImagesGallery(card.chat_attachments || [], card.id, 'sourcehub-images-section', 'sourcehub-images-container');
}

function openFullCardFromSourceHub() {
  const card = sourceHubCards.find(c => c.id === sourceHubActiveCardId);
  if (!card) return;
  const docName = card.documents?.file_name || 'Untitled';
  viewStudyCard(card.document_id, docName, false, card.id);
}
window.openFullCardFromSourceHub = openFullCardFromSourceHub;

// --------------------------------------------------------------------------
// Source Hub's own "Kaynakla Sohbet" chat — independent conversation state
// from the study card modal's chat pane (see the big comment above), reusing
// the same edge function and the same generic image-action helpers.
// --------------------------------------------------------------------------
let sourceHubChatHistory = [];
let sourceHubChatHasGreeted = false;
let sourceHubChatRequestInFlight = false;
let pendingSourceHubChatImageDataUrl = null;

function resetSourceHubChatState() {
  sourceHubChatHistory = [];
  sourceHubChatHasGreeted = false;
  removeSourceHubChatImage();
  const messages = document.getElementById('sourcehub-chat-messages');
  if (messages) messages.innerHTML = '';
  greetSourceHubChatIfNeeded();
}

function greetSourceHubChatIfNeeded() {
  if (sourceHubChatHasGreeted) return;
  sourceHubChatHasGreeted = true;
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const greeting = isTr
    ? 'Merhaba! Bu belge/belgeler hakkında bana soru sorabilirsiniz. Cevaplarımı yalnızca kaynağın içeriğine dayandırırım — belgede olmayan bir şey sorarsanız size bunu söylerim.'
    : "Hi! Ask me anything about this document — I'll answer strictly from its content, and I'll tell you honestly if something isn't covered in it.";
  renderSourceHubChatMessage('assistant', greeting, [], null, false, null, false);
}

function clearSourceHubChat() {
  sourceHubChatHistory = [];
  sourceHubChatHasGreeted = false;
  removeSourceHubChatImage();
  const messages = document.getElementById('sourcehub-chat-messages');
  if (messages) messages.innerHTML = '';
  greetSourceHubChatIfNeeded();
}
window.clearSourceHubChat = clearSourceHubChat;

function removeSourceHubChatImage() {
  pendingSourceHubChatImageDataUrl = null;
  const preview = document.getElementById('sourcehub-chat-image-preview');
  if (preview) preview.style.display = 'none';
  const thumb = document.getElementById('sourcehub-chat-image-preview-thumb');
  if (thumb) thumb.src = '';
  const imageInput = document.getElementById('sourcehub-chat-image-input');
  if (imageInput) imageInput.value = '';
  // Don't let "check my work" linger checked for the next, unrelated image.
  const checkWorkToggle = document.getElementById('sourcehub-chat-checkwork-toggle');
  if (checkWorkToggle) checkWorkToggle.checked = false;
}
window.removeSourceHubChatImage = removeSourceHubChatImage;

// Renders one chat bubble into the Source Hub's chat column. Deliberately
// mirrors renderDocChatMessage()'s structure (see that function for the
// reasoning behind each piece) rather than sharing code with it directly,
// so the modal's already-working chat is never touched by this page.
function renderSourceHubChatMessage(role, text, citations, imageDataUrl, visionUsed, mermaidCode, saveable = true) {
  const container = document.getElementById('sourcehub-chat-messages');
  if (!container) return;

  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const bubble = document.createElement('div');
  const isUser = role === 'user';
  bubble.style.cssText = `
    max-width: 88%;
    align-self: ${isUser ? 'flex-end' : 'flex-start'};
    background: ${isUser ? 'var(--color-teal)' : 'var(--color-white)'};
    color: ${isUser ? 'white' : 'var(--color-navy)'};
    padding: 0.55rem 0.8rem;
    border-radius: ${isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px'};
    font-size: 0.8rem;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  `;

  if (isUser) {
    if (imageDataUrl) {
      const img = document.createElement('img');
      img.src = imageDataUrl;
      img.alt = '';
      img.style.cssText = 'max-width: 100%; max-height: 160px; border-radius: 8px; display: block; margin-bottom: 0.4rem; object-fit: contain; cursor: zoom-in;';
      img.title = isTr ? 'Büyütmek için tıkla' : 'Click to enlarge';
      const uploadLabel = isTr ? 'Sohbetten Fotoğraf' : 'Photo from chat';
      img.addEventListener('click', () => {
        openImageLightbox(imageDataUrl, uploadLabel, {
          onSendToNotebook: (btn) => {
            if (!currentActiveStudyCard || !currentActiveStudyCard.id) return;
            sendToDepot(null, btn, currentActiveStudyCard.id, 'image', uploadLabel, imageDataUrl);
          },
          onAddToSummary: (btn) => saveChatImageToSummary(imageDataUrl, uploadLabel, btn)
        });
      });
      bubble.appendChild(img);
    }
    const textNode = document.createElement('div');
    textNode.textContent = text;
    bubble.appendChild(textNode);
    if (imageDataUrl) {
      bubble.appendChild(createChatImageActionRow(imageDataUrl, isTr ? 'Sohbetten Fotoğraf' : 'Photo from chat'));
    }
  } else {
    // renderMathInText() escapes the text AND renders any $...$ LaTeX
    // formulas the AI included (same convention as the study card's worked
    // examples) before we layer citation markers on top.
    bubble.innerHTML = formatFootnoteMarkers(renderMathInText(text), citations);
    if (visionUsed) {
      const tag = document.createElement('div');
      tag.textContent = isTr ? '📷 Görsel incelendi' : '📷 Image analyzed';
      tag.style.cssText = 'margin-top: 0.35rem; font-size: 0.65rem; opacity: 0.65; font-style: italic;';
      bubble.appendChild(tag);
    }

    // Let the student save this reply itself (formulas, a worked step-by-step
    // solution, an explanation, etc.) to the notebook — same idea as the
    // "Deftere Gönder" action already available on chat images/diagrams.
    // Not shown on the canned greeting or on error messages — there's
    // nothing there worth saving.
    if (saveable && text && text.trim()) {
      bubble.appendChild(createChatTextActionRow(text, isTr));
    }

    if (mermaidCode) {
      renderMermaidIntoBubble(bubble, mermaidCode, isTr ? 'AI Diyagramı' : 'AI diagram').then((svgDataUrl) => {
        if (!svgDataUrl) return;
        bubble.appendChild(createChatImageActionRow(svgDataUrl, isTr ? 'AI Diyagramı' : 'AI diagram'));
        container.scrollTop = container.scrollHeight;
      });
    }
  }

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

async function sendSourceHubChatMessage(text, imageDataUrl, checkWorkMode) {
  if (sourceHubChatRequestInFlight) return;
  if (!currentActiveStudyCard || !currentActiveStudyCard.id) return;

  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const cardId = currentActiveStudyCard.id;

  renderSourceHubChatMessage('user', text, [], imageDataUrl || null);
  sourceHubChatHistory.push({ role: 'user', content: text });

  const sendBtn = document.getElementById('sourcehub-chat-send-btn');
  const typingIndicator = document.getElementById('sourcehub-chat-typing-indicator');
  sourceHubChatRequestInFlight = true;
  if (sendBtn) sendBtn.disabled = true;
  if (typingIndicator) typingIndicator.style.display = 'block';

  try {
    const requestBody = { studyCardId: cardId, messages: sourceHubChatHistory };
    if (imageDataUrl) requestBody.image = imageDataUrl;
    if (checkWorkMode) requestBody.checkWorkMode = true;

    const { data, error } = await supabaseClient.functions.invoke('chat-with-document', {
      body: requestBody
    });

    if (error || !data || typeof data.answer !== 'string') {
      console.error('chat-with-document invocation failed (Source Hub):', error || data);
      const errMsg = isTr
        ? 'Şu anda cevap veremiyorum, lütfen tekrar deneyin.'
        : "I couldn't answer right now, please try again.";
      renderSourceHubChatMessage('assistant', errMsg, [], null, false, null, false);
      sourceHubChatHistory.pop();
      return;
    }

    renderSourceHubChatMessage('assistant', data.answer, data.citations || [], null, !!data.visionUsed, data.mermaid || null);
    sourceHubChatHistory.push({ role: 'assistant', content: data.answer });
  } catch (err) {
    console.error('Exception in sendSourceHubChatMessage:', err);
    const errMsg = isTr
      ? 'Şu anda cevap veremiyorum, lütfen tekrar deneyin.'
      : "I couldn't answer right now, please try again.";
    renderSourceHubChatMessage('assistant', errMsg, [], null, false, null, false);
    sourceHubChatHistory.pop();
  } finally {
    sourceHubChatRequestInFlight = false;
    if (sendBtn) sendBtn.disabled = false;
    if (typingIndicator) typingIndicator.style.display = 'none';
  }
}
window.sendSourceHubChatMessage = sendSourceHubChatMessage;

function initSourceHubChatForm() {
  const form = document.getElementById('sourcehub-chat-input-form');
  if (!form || form.dataset.wired) return;
  form.dataset.wired = 'true';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('sourcehub-chat-input');
    if (!input) return;
    const text = input.value.trim();
    const image = pendingSourceHubChatImageDataUrl;
    if (!text && !image) return;
    // Read the checkbox BEFORE removeSourceHubChatImage() resets it below.
    const checkWorkToggle = document.getElementById('sourcehub-chat-checkwork-toggle');
    const checkWorkMode = !!(image && checkWorkToggle && checkWorkToggle.checked);
    const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
    const finalText = text || (checkWorkMode
      ? (isTr ? 'Çözümümü kontrol eder misin?' : 'Can you check my solution?')
      : (isTr ? 'Ekli görseldeki bu kısmı açıklar mısın?' : 'Can you explain this part shown in the attached image?'));
    input.value = '';
    removeSourceHubChatImage();
    sendSourceHubChatMessage(finalText, image, checkWorkMode);
  });

  const imageInput = document.getElementById('sourcehub-chat-image-input');
  if (imageInput) {
    imageInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await downscaleImageForChat(file);
        pendingSourceHubChatImageDataUrl = dataUrl;
        const thumb = document.getElementById('sourcehub-chat-image-preview-thumb');
        const preview = document.getElementById('sourcehub-chat-image-preview');
        if (thumb) thumb.src = dataUrl;
        if (preview) preview.style.display = 'flex';
      } catch (err) {
        console.error('Failed to process attached image (Source Hub):', err);
        const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
        alert(isTr ? 'Görsel yüklenirken bir sorun oluştu, lütfen başka bir dosya deneyin.' : 'There was a problem loading that image, please try another file.');
      } finally {
        imageInput.value = '';
      }
    });
  }
}
window.initSourceHubChatForm = initSourceHubChatForm;

// ==========================================
// TAB 4: BILGI KARTLARI (INFO CARDS LIBRARY)
// ==========================================
let libraryCards = [];

async function loadCardsLibrary() {
  const listSection = document.getElementById('cards-list-section');
  if (!listSection) return;

  listSection.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 2rem;">
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 32px; height: 32px; color: var(--color-teal);">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
      </svg>
    </div>
  `;

  try {
    const { data: cards, error } = await supabaseClient
      .from('study_cards')
      .select('*, documents(file_name)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error loading library cards: ", error);
      listSection.innerHTML = `<p style="color: var(--color-text-muted);">Failed to load info cards.</p>`;
      return;
    }

    libraryCards = cards || [];

    // Populate Course filter dropdown (Phase 17)
    const courseSelect = document.getElementById('cards-filter-course');
    if (courseSelect) {
      const tags = [...new Set((libraryCards).map(c => c.course_tag).filter(Boolean))].sort();
      const currentVal = courseSelect.value;
      courseSelect.innerHTML = '<option value="all">All Courses</option>';
      tags.forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = tag;
        courseSelect.appendChild(opt);
      });
      if (tags.includes(currentVal)) courseSelect.value = currentVal;
    }

    filterLibraryCards();
    loadPastComparisons();

  } catch (err) {
    console.error("Exception loading library cards: ", err);
    listSection.innerHTML = `<p style="color: var(--color-text-muted);">Failed to load info cards.</p>`;
  }
}

function filterLibraryCards() {
  const searchInput = document.getElementById('cards-search');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const styleFilter = document.getElementById('cards-filter-style')?.value || 'all';
  const langFilter = document.getElementById('cards-filter-lang')?.value || 'all';
  const courseFilter = document.getElementById('cards-filter-course')?.value || 'all';

  const filtered = libraryCards.filter(card => {
    // 1. Text Query Filter
    const fileName = (card.documents?.file_name || card.source_documents?.map(s => s.file_name).join(' ') || '').toLowerCase();
    const summary = (card.summary || '').toLowerCase();
    const textMatch = !query || fileName.includes(query) || summary.includes(query);

    // 2. Style Filter
    let styleMatch = styleFilter === 'all' || card.summary_style === styleFilter;

    // 3. Language Filter
    let langMatch = langFilter === 'all' || card.summary_language === langFilter;

    // 4. Course Filter (Phase 17)
    let courseMatch = true;
    if (courseFilter !== 'all') {
      if (courseFilter === 'untagged') {
        courseMatch = !card.course_tag;
      } else {
        courseMatch = card.course_tag === courseFilter;
      }
    }

    return textMatch && styleMatch && langMatch && courseMatch;
  });

  // Toggle "Clear Filters" button visibility
  const btnClear = document.getElementById('btn-clear-filters');
  if (btnClear) {
    if (styleFilter !== 'all' || langFilter !== 'all' || courseFilter !== 'all' || query !== '') {
      btnClear.style.display = 'inline-block';
    } else {
      btnClear.style.display = 'none';
    }
  }

  window.filteredLibraryCardsList = filtered;
  renderCardsLibraryList(filtered);
}

function renderCardsLibraryList(cards) {
  const listSection = document.getElementById('cards-list-section');
  if (!listSection) return;

  const currentLang = localStorage.getItem('acadexUILang') || 'en';

  if (cards.length === 0) {
    const isFiltered = libraryCards.length > 0;
    let title = '';
    let desc = '';

    if (isFiltered) {
      title = currentLang === 'tr' ? 'Filtrelerinize uygun bilgi kartı bulunamadı' : 'No study cards match your filters';
      desc = currentLang === 'tr' 
        ? 'Seçtiğiniz filtreler veya arama terimi ile eşleşen kart bulunamadı. Lütfen filtrelerinizi temizleyin veya değiştirin.' 
        : 'No cards matched your active filters or search terms. Try clearing or modifying your filters.';
    } else {
      title = currentLang === 'tr' ? 'Henüz bilgi kartınız yok' : 'You have no study cards yet';
      desc = currentLang === 'tr'
        ? 'Henüz bilgi kartı oluşturmamışsınız. <a href="#" onclick="switchDashboardView(\'docs\')" style="color: var(--color-teal); text-decoration: underline;">Belgelerim</a> sekmesinden dosya yükleyip özetleyerek başlayabilirsiniz.'
        : 'You haven\'t created any study cards yet. Go to <a href="#" onclick="switchDashboardView(\'docs\')" style="color: var(--color-teal); text-decoration: underline;">My Documents</a> to upload and summarize files.';
    }

    listSection.innerHTML = `
      <div class="empty-state" style="margin-top: 1.5rem;">
        <svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <h3 class="empty-state-title">${title}</h3>
        <p class="empty-state-text">${desc}</p>
      </div>
    `;
    return;
  }

  listSection.innerHTML = `<div class="docs-grid" id="library-cards-grid"></div>`;
  const grid = document.getElementById('library-cards-grid');

  // Group cards by document ID to support variants grouping headings
  const grouped = {};
  cards.forEach(card => {
    const docId = card.document_id || 'unknown';
    if (!grouped[docId]) {
      grouped[docId] = [];
    }
    grouped[docId].push(card);
  });

  Object.keys(grouped).forEach(docId => {
    const groupCards = grouped[docId];
    const firstCard = groupCards[0];
    const docName = firstCard.documents?.file_name || 'İsimsiz Belge';

    // If there's more than one version, render a full-width header
    if (groupCards.length > 1) {
      const headerDiv = document.createElement('div');
      headerDiv.className = 'doc-group-header';
      headerDiv.style.gridColumn = '1 / -1';
      headerDiv.style.marginTop = '1.5rem';
      headerDiv.style.borderBottom = '2px solid var(--color-teal)';
      headerDiv.style.paddingBottom = '0.5rem';
      headerDiv.style.marginBottom = '0.5rem';
      headerDiv.innerHTML = `<h3 style="font-size: 1.1rem; color: var(--color-navy); font-weight: 800; margin:0;">${docName} <span style="font-size: 0.8rem; color: var(--color-text-muted); font-weight: 500;">(${groupCards.length} versions / versiyon)</span></h3>`;
      grid.appendChild(headerDiv);
    }

    groupCards.forEach(card => {
      const formattedDate = new Date(card.created_at).toLocaleDateString('tr-TR', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const cardDocName = card.documents?.file_name || 'İsimsiz Belge';
      const escapedSummary = (card.summary || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

      const cardEl = document.createElement('div');
      cardEl.className = 'doc-card';
      cardEl.style.display = 'flex';
      cardEl.style.flexDirection = 'column';
      cardEl.style.justifyContent = 'space-between';
      cardEl.style.gap = '0.5rem';

      // Generate terms list
      let termsHtml = '';
      const terms = card.key_terms || [];
      if (terms.length === 0) {
        termsHtml = '<p style="font-size: 0.75rem; color: var(--color-text-muted); margin:0;">Anahtar terim bulunmamaktadır.</p>';
      } else {
        termsHtml = '<ul style="padding-left: 1.25rem; font-size: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; margin:0;">';
        terms.forEach(t => {
          termsHtml += `<li><strong>${t.term}:</strong> ${t.definition}</li>`;
        });
        termsHtml += '</ul>';
      }

      // Generate key points list
      let pointsHtml = '';
      const points = card.key_points || [];
      if (points.length === 0) {
        pointsHtml = '<p style="font-size: 0.75rem; color: var(--color-text-muted); margin:0;">Önemli nokta bulunmamaktadır.</p>';
      } else {
        pointsHtml = '<ul style="padding-left: 1.25rem; font-size: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; margin:0;">';
        points.forEach(p => {
          pointsHtml += `<li>${p}</li>`;
        });
        pointsHtml += '</ul>';
      }

      // Generate quiz questions
      let quizHtml = '';
      const quiz = card.quiz_questions || [];
      if (quiz.length === 0) {
        quizHtml = '<p style="font-size: 0.75rem; color: var(--color-text-muted); margin:0;">Soru bulunmamaktadır.</p>';
      } else {
        quizHtml = '<ul style="padding-left: 1.25rem; font-size: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; margin:0;">';
        quiz.forEach((q, idx) => {
          quizHtml += `
            <li style="margin-bottom: 0.35rem;">
              <strong>S${idx+1}:</strong> ${q.question}<br>
              <span style="color: var(--color-teal);"><strong>Cevap:</strong> ${q.answer}</span>
            </li>
          `;
        });
        quizHtml += '</ul>';
      }

      // Cloze cards
      let clozeHtml = '';
      const clozes = card.cloze_cards || [];
      if (clozes.length === 0) {
        clozeHtml = '<p style="font-size: 0.75rem; color: var(--color-text-muted); margin:0;">Boşluk doldurma kartı yok.</p>';
      } else {
        clozeHtml = '<ul style="padding-left: 1.25rem; font-size: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; margin:0;">';
        clozes.forEach((c, idx) => {
          clozeHtml += `<li><strong>${idx + 1}.</strong> ${escapeHtml(c.prompt || '')} → <span style="color:var(--color-teal);">${escapeHtml(c.answer || '')}</span></li>`;
        });
        clozeHtml += '</ul>';
      }

      cardEl.innerHTML = `
        <div class="doc-header" style="margin-bottom: 0.25rem; position: relative;">
          <div class="doc-file-icon text" style="background-color: var(--color-teal-light); color: var(--color-teal); flex-shrink: 0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
          </div>
          <div class="doc-info" style="width: calc(100% - 68px);">
            <h4 class="doc-name" style="font-size: 0.9rem; padding-right: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${cardDocName}">${cardDocName}</h4>
            <div class="doc-meta" style="display: flex; align-items: center; justify-content: space-between; gap: 0.35rem; flex-wrap: wrap;">
              <span>Oluşturulma: ${formattedDate}</span>
              <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                <span class="style-badge style-${card.summary_style || 'standard'}" style="margin: 0; font-size: 0.6rem; padding: 0.1rem 0.35rem;">${getStyleLabel(card.summary_style)}</span>
                <span class="style-badge" style="margin: 0; font-size: 0.6rem; padding: 0.1rem 0.35rem; background-color: var(--color-teal-light); color: var(--color-teal); border: 1px solid rgba(22, 50, 92, 0.08); font-weight: 700;">${card.summary_language === 'tr' ? 'Türkçe' : 'English'}</span>
                ${getDocumentTypeBadgeHtml(card.document_type)}
                ${getLengthBadgeHtml(card.summary_length)}
                ${getVisualAnalysisBadgeHtml(card.visual_analysis)}
                ${getQuantitativeBadgeHtml(card.is_quantitative)}
              </div>
            </div>
          </div>
          <button onclick="deleteStudyCard(event, '${card.id}', '${card.document_id}')" style="background: none; border: none; cursor: pointer; color: #EF4444; position: absolute; right: 0; top: 0.25rem; padding: 0.25rem; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); transition: background-color 0.2s;" title="Sil (Delete this card)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>

        <div class="card-library-summary">
          <strong>Özet:</strong>
          <div style="margin-top: 0.25rem; font-size: 0.85rem; line-height: 1.5; color: var(--color-navy);">${formatSummaryText(card.summary) || 'Özet bulunmamaktadır.'}</div>
        </div>

        <div style="margin: 0.25rem 0; flex-grow: 1;">
          <div class="accordion-item" id="accordion-terms-${card.id}">
            <div class="accordion-header" onclick="toggleLibraryAccordion('${card.id}', 'terms')">
              <span>Anahtar Terimler (${terms.length})</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <button class="btn btn-outline btn-deftere-ekle" style="padding: 0.15rem 0.4rem; font-size: 0.65rem; border-color: var(--color-teal); color: var(--color-teal); min-height: 20px; line-height: 1;" onclick="event.stopPropagation(); addSectionStickyNote('${card.id}', 'terms', '${cardDocName.replace(/'/g, "\\'")}')">+ Deftere Ekle</button>
                <button class="btn btn-outline" style="padding: 0.15rem 0.4rem; font-size: 0.65rem; border-color: var(--color-navy); color: var(--color-navy); min-height: 20px; line-height: 1;" onclick="event.stopPropagation(); openFlashcardViewer('${card.id}', 'terms', '${cardDocName.replace(/'/g, "\\'")}')">🔍 Kartları İncele</button>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <div class="accordion-body">${termsHtml}</div>
          </div>

          <div class="accordion-item" id="accordion-points-${card.id}">
            <div class="accordion-header" onclick="toggleLibraryAccordion('${card.id}', 'points')">
              <span>Önemli Noktalar (${points.length})</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <button class="btn btn-outline btn-deftere-ekle" style="padding: 0.15rem 0.4rem; font-size: 0.65rem; border-color: var(--color-teal); color: var(--color-teal); min-height: 20px; line-height: 1;" onclick="event.stopPropagation(); addSectionStickyNote('${card.id}', 'points', '${cardDocName.replace(/'/g, "\\'")}')">+ Deftere Ekle</button>
                <button class="btn btn-outline" style="padding: 0.15rem 0.4rem; font-size: 0.65rem; border-color: var(--color-navy); color: var(--color-navy); min-height: 20px; line-height: 1;" onclick="event.stopPropagation(); openFlashcardViewer('${card.id}', 'points', '${cardDocName.replace(/'/g, "\\'")}')">🔍 Kartları İncele</button>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <div class="accordion-body">${pointsHtml}</div>
          </div>

          <div class="accordion-item" id="accordion-quiz-${card.id}">
            <div class="accordion-header" onclick="toggleLibraryAccordion('${card.id}', 'quiz')">
              <span>Kendi Kendine Test (${quiz.length})</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <button class="btn btn-outline btn-deftere-ekle" style="padding: 0.15rem 0.4rem; font-size: 0.65rem; border-color: var(--color-teal); color: var(--color-teal); min-height: 20px; line-height: 1;" onclick="event.stopPropagation(); addSectionStickyNote('${card.id}', 'quiz', '${cardDocName.replace(/'/g, "\\'")}')">+ Deftere Ekle</button>
                <button class="btn btn-outline" style="padding: 0.15rem 0.4rem; font-size: 0.65rem; border-color: var(--color-navy); color: var(--color-navy); min-height: 20px; line-height: 1;" onclick="event.stopPropagation(); openFlashcardViewer('${card.id}', 'quiz', '${cardDocName.replace(/'/g, "\\'")}')">🔍 Kartları İncele</button>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <div class="accordion-body">${quizHtml}</div>
          </div>

          <div class="accordion-item" id="accordion-cloze-${card.id}">
            <div class="accordion-header" onclick="toggleLibraryAccordion('${card.id}', 'cloze')">
              <span>Boşluk Doldurma (${clozes.length})</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <button class="btn btn-outline" style="padding: 0.15rem 0.4rem; font-size: 0.65rem; border-color: var(--color-navy); color: var(--color-navy); min-height: 20px; line-height: 1;" onclick="event.stopPropagation(); openFlashcardViewer('${card.id}', 'cloze', '${cardDocName.replace(/'/g, "\\'")}')">🔍 Kartları İncele</button>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <div class="accordion-body">${clozeHtml}</div>
          </div>
        </div>

        <div style="margin: 0.5rem 0;">
          <button class="btn btn-primary" style="width:100%; padding:0.45rem 0.75rem; font-size:0.8rem; border:none; border-radius:10px; font-weight:700;"
            onclick="event.stopPropagation(); openAdaptiveReview('${card.id}', '${cardDocName.replace(/'/g, "\\'")}')">
            🧠 Akıllı Tekrar (Spaced)
          </button>
        </div>

        <div class="share-toggle-container" style="margin: 0.25rem 0; padding: 0.4rem 0.6rem; font-size: 0.8rem;">
          <span>Bölümümle Paylaş</span>
          <label class="switch" style="width: 36px; height: 18px;">
            <input type="checkbox" id="share-switch-lib-${card.id}" ${card.is_shared ? 'checked' : ''} onchange="toggleShareStudyCard('${card.id}', this.checked)" style="width:0;height:0;">
            <span class="slider" style="border-radius: 18px;"></span>
          </label>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button class="btn btn-outline btn-view-summary" data-doc-id="${card.document_id}" data-doc-name="${cardDocName.replace(/'/g, "\\'")}" data-card-id="${card.id}" style="flex: 1; padding: 0.4rem; font-size: 0.75rem;">Özeti Görüntüle</button>
          <button class="btn btn-primary" onclick="addStickyNoteToNotebook('${card.id}', '${cardDocName.replace(/'/g, "\\'")}', '${escapedSummary}')" style="flex: 1; padding: 0.4rem; font-size: 0.75rem; border: none;">Panoya Ekle</button>
        </div>
      `;
      grid.appendChild(cardEl);
    });
  });
}

function toggleLibraryAccordion(cardId, section) {
  const el = document.getElementById(`accordion-${section}-${cardId}`);
  if (el) {
    el.classList.toggle('active');
  }
}
window.toggleLibraryAccordion = toggleLibraryAccordion;

// ==========================================
// PART E: DOWNLOAD NOTEBOOK AS PNG
// ==========================================
async function downloadNotebook() {
  const btnDownload = document.getElementById('btn-download-notebook');
  const viewport = document.getElementById('canvas-viewport');
  if (!btnDownload || !viewport) return;

  const originalText = btnDownload.textContent;
  btnDownload.disabled = true;
  btnDownload.textContent = 'Generating...';

  try {
    // Lazy-load html2canvas
    if (window.loadScript) {
      await window.loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }
    
    // Render container screenshot via html2canvas
    const canvas = await html2canvas(viewport, {
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    const link = document.createElement('a');
    link.download = `acadex-notebook-${getLocalDateString()}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showDashboardAlert('success', 'Notebook downloaded successfully!');
  } catch (err) {
    console.error("html2canvas generation failed: ", err);
    showDashboardAlert('error', 'Failed to generate image. Please try again.');
  } finally {
    btnDownload.disabled = false;
    btnDownload.textContent = originalText;
  }
}

function addSectionStickyNote(cardId, type, fileName) {
  // Find study card in libraryCards or notebookCards
  const card = libraryCards.find(c => c.id === cardId) || notebookCards.find(c => c.id === cardId);
  if (!card) return;

  let title = '';
  let contentHtml = '';

  if (type === 'terms') {
    title = `Anahtar Terimler — ${fileName}`;
    const terms = card.key_terms || [];
    if (terms.length === 0) {
      contentHtml = 'Anahtar terim bulunmamaktadır.';
    } else {
      contentHtml = `<ul style="padding-left: 1.20rem; margin: 0; font-size: 0.75rem; text-align: left; display: flex; flex-direction: column; gap: 0.25rem;">`;
      terms.forEach(t => {
        contentHtml += `<li><strong>${t.term}:</strong> ${t.definition}</li>`;
      });
      contentHtml += '</ul>';
    }
  } else if (type === 'points') {
    title = `Önemli Noktalar — ${fileName}`;
    const points = card.key_points || [];
    if (points.length === 0) {
      contentHtml = 'Önemli nokta bulunmamaktadır.';
    } else {
      contentHtml = `<ul style="padding-left: 1.20rem; margin: 0; font-size: 0.75rem; text-align: left; display: flex; flex-direction: column; gap: 0.25rem;">`;
      points.forEach(p => {
        contentHtml += `<li>${p}</li>`;
      });
      contentHtml += '</ul>';
    }
  } else if (type === 'quiz') {
    title = `Kendi Kendine Test — ${fileName}`;
    const quiz = card.quiz_questions || [];
    if (quiz.length === 0) {
      contentHtml = 'Soru bulunmamaktadır.';
    } else {
      contentHtml = `<div style="display: flex; flex-direction: column; gap: 0.5rem; text-align: left; font-size: 0.75rem;">`;
      quiz.forEach((q, idx) => {
        contentHtml += `
          <div style="border-bottom: 1px dashed rgba(0,0,0,0.06); padding-bottom: 0.25rem;">
            <strong>S${idx+1}:</strong> ${q.question}<br>
            <span style="color: var(--color-teal);"><strong>Cevap:</strong> ${q.answer}</span>
          </div>
        `;
      });
      contentHtml += '</div>';
    }
  }

  // Create sticky note on notebook canvas
  if (currentActiveTab !== 'notebook') {
    switchDashboardView('notebook');
  }

  setTimeout(() => {
    const overlay = document.getElementById('notebook-overlay-container');
    if (!overlay) return;

    const id = 'note-' + Date.now();
    const rotation = Math.floor(Math.random() * 7) - 3; // -3 to +3 deg
    
    // Default position: Center of visible canvas viewport with cascading offset
    const rect = overlay.getBoundingClientRect();
    const noteWidth = 240;
    const noteHeight = 260;
    const centerX = (rect.width > noteWidth) ? (rect.width - noteWidth) / 2 : 50;
    const centerY = (rect.height > noteHeight) ? (rect.height - noteHeight) / 2 : 50;
    
    const offset = (overlay.children.length * 20) % 200;
    const x = centerX + offset;
    const y = centerY + offset;

    const note = document.createElement('div');
    note.className = 'draggable-element draggable-note';
    note.id = id;
    note.style.width = '240px';
    note.style.height = '260px';
    note.style.left = `${x}px`;
    note.style.top = `${y}px`;
    note.style.transform = `rotate(${rotation}deg)`;
    note.setAttribute('data-type', 'sticky');
    note.setAttribute('data-card-id', cardId);
    note.setAttribute('data-rotation', rotation);

    // Make the content area internally scrollable as requested
    note.innerHTML = `
      <button class="delete-overlay-btn" title="Remove Sticky Note" onclick="removeOverlayElement('${id}')">×</button>
      <div class="draggable-note-title" style="font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${title}</div>
      <div class="draggable-note-text" style="max-height: 180px; overflow-y: auto; padding-right: 2px; font-size: 0.75rem;">${contentHtml}</div>
      <div class="draggable-note-footer">Acadex Section Card</div>
    `;

    note.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-overlay-btn') || e.target.closest('.delete-overlay-btn')) return;
      viewStudyCard(card.document_id, fileName, false, card.id);
    });

    overlay.appendChild(note);
    makeElementDraggable(note);
  }, 100);
}
window.addSectionStickyNote = addSectionStickyNote;

// ==========================================
// TAB: AKADEMIK SUNUM (Academic Presentation Studio)
// ==========================================
let presStudioInitialized = false;
let presCurrentId = null;
let presActiveSlide = 0;

function loadPresentationStudio() {
  initPresentationStudioOnce();
  showPresentationListMode();
}

function initPresentationStudioOnce() {
  if (presStudioInitialized) return;
  presStudioInitialized = true;

  const newBtn = document.getElementById('presentation-new-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      // Step 4 will create a real DB row; for now open empty studio UI
      openPresentationStudio({ id: null, title: 'Adsız Sunum' });
    });
  }

  const backBtn = document.getElementById('pres-back-btn');
  if (backBtn) backBtn.addEventListener('click', showPresentationListMode);

  document.querySelectorAll('.pres-layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pres-layout-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  const uploadZone = document.getElementById('pres-upload-zone');
  const uploadBtn = document.getElementById('pres-upload-btn');
  const imageInput = document.getElementById('pres-image-input');
  if (uploadZone && imageInput) uploadZone.addEventListener('click', () => imageInput.click());
  if (uploadBtn && imageInput) uploadBtn.addEventListener('click', () => imageInput.click());

  document.getElementById('pres-slides-list')?.addEventListener('click', (e) => {
    const thumb = e.target.closest('.pres-slide-thumb');
    if (!thumb) return;
    document.querySelectorAll('.pres-slide-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    presActiveSlide = parseInt(thumb.dataset.slideIndex || '0', 10);
  });
}

function showPresentationListMode() {
  const list = document.getElementById('pres-list-mode');
  const studio = document.getElementById('pres-studio-mode');
  if (list) list.style.display = '';
  if (studio) studio.style.display = 'none';
  presCurrentId = null;
}

function openPresentationStudio(presentation) {
  const list = document.getElementById('pres-list-mode');
  const studio = document.getElementById('pres-studio-mode');
  if (list) list.style.display = 'none';
  if (studio) studio.style.display = 'flex';
  presCurrentId = presentation?.id || null;
  const titleInput = document.getElementById('pres-title-input');
  if (titleInput) titleInput.value = presentation?.title || 'Adsız Sunum';
}

// ==========================================
// TAB 5: SINAV PLATFORMU (EXAM PLATFORM)
// ==========================================
let currentActiveExam = null;
let activeExamCardId = null;

async function loadExamsPlatform() {
  const cardSelect = document.getElementById('exam-card-select');
  const emptyState = document.getElementById('exam-empty-state');
  const setupContent = document.getElementById('exam-setup-content');
  const setupScreen = document.getElementById('exam-setup-screen');
  const activeScreen = document.getElementById('exam-active-screen');
  const resultsScreen = document.getElementById('exam-results-screen');

  if (!cardSelect) return;

  // Reset screens
  setupScreen.style.display = 'block';
  activeScreen.style.display = 'none';
  resultsScreen.style.display = 'none';

  cardSelect.innerHTML = '<option value="">Yükleniyor...</option>';

  try {
    const { data: cards, error } = await supabaseClient
      .from('study_cards')
      .select('*, documents(file_name)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching cards for exam: ", error);
      cardSelect.innerHTML = '<option value="">Kartlar yüklenemedi</option>';
      return;
    }

    if (!cards || cards.length === 0) {
      emptyState.style.display = 'block';
      setupContent.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    setupContent.style.display = 'flex';

    cachedExamCards = cards || [];
    cardSelect.innerHTML = '';
    cards.forEach(card => {
      const docName = card.documents?.file_name || 'İsimsiz Belge';
      const createdDate = new Date(card.created_at).toLocaleDateString('tr-TR');
      const opt = document.createElement('option');
      opt.value = card.id;
      opt.textContent = `${docName} (${createdDate})`;
      cardSelect.appendChild(opt);
    });

    // Setup first card
    const firstCardId = cardSelect.value;
    activeExamCardId = firstCardId;
    
    // Display form options & toggle calc option
    document.getElementById('exam-form-params').style.display = 'block';
    updateExamCalcOptionState(firstCardId);
    
    // Load past attempts
    await loadPastAttempts(firstCardId);

  } catch (err) {
    console.error("Exception in loadExamsPlatform: ", err);
    cardSelect.innerHTML = '<option value="">Hata oluştu</option>';
  }
}
window.loadExamsPlatform = loadExamsPlatform;

async function onExamCardChange() {
  const cardSelect = document.getElementById('exam-card-select');
  if (!cardSelect) return;

  const cardId = cardSelect.value;
  activeExamCardId = cardId;

  if (cardId) {
    updateExamCalcOptionState(cardId);
    await loadPastAttempts(cardId);
  }
}
window.onExamCardChange = onExamCardChange;

let cachedExamCards = [];

function updateExamCalcOptionState(cardId) {
  const cardObj = cachedExamCards.find(c => String(c.id) === String(cardId));
  const isQuant = cardObj ? !!cardObj.is_quantitative : false;
  
  const calcOption = document.getElementById('exam-type-option-calc');
  const calcRadio = document.querySelector('input[name="exam-type"][value="calculation"]');
  const calcHint = document.getElementById('exam-calc-hint');

  if (isQuant) {
    if (calcOption) {
      calcOption.style.opacity = '1';
      calcOption.style.pointerEvents = 'auto';
    }
    if (calcRadio) calcRadio.disabled = false;
    if (calcHint) calcHint.style.display = 'none';
  } else {
    if (calcOption) {
      calcOption.style.opacity = '0.45';
      calcOption.style.pointerEvents = 'none';
    }
    if (calcRadio) {
      calcRadio.disabled = true;
      if (calcRadio.checked) {
        const classicRadio = document.querySelector('input[name="exam-type"][value="classic"]');
        if (classicRadio) classicRadio.checked = true;
      }
    }
    if (calcHint) calcHint.style.display = 'block';
  }
}

async function loadPastAttempts(cardId) {
  const listEl = document.getElementById('past-attempts-list');
  if (!listEl) return;

  listEl.innerHTML = '<p style="font-size: 0.85rem; color: var(--color-text-muted);">Yükleniyor...</p>';

  try {
    const { data: exams, error } = await supabaseClient
      .from('exams')
      .select('*')
      .eq('study_card_id', cardId)
      .eq('user_id', currentUser.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    if (error) {
      console.error("Error loading past attempts: ", error);
      listEl.innerHTML = '<p style="font-size: 0.85rem; color: #EF4444;">Geçmiş denemeler yüklenemedi.</p>';
      return;
    }

    if (!exams || exams.length === 0) {
      listEl.innerHTML = '<p style="font-size: 0.85rem; color: var(--color-text-muted);">Bu çalışma kartı için henüz tamamlanmış sınav bulunmamaktadır.</p>';
      return;
    }

    listEl.innerHTML = '';
    exams.forEach(exam => {
      const formattedDate = new Date(exam.completed_at).toLocaleDateString('tr-TR', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const typeLabel = exam.exam_type === 'classic' ? 'Klasik' : (exam.exam_type === 'test' ? 'Çoktan Seçmeli' : 'Karışık');
      const langLabel = exam.language === 'tr' ? 'Türkçe' : 'English';

      const item = document.createElement('div');
      item.className = 'past-attempt-item';
      item.onclick = () => showExamResults(exam);

      item.innerHTML = `
        <div class="past-attempt-info">
          <strong style="font-size: 0.85rem; color: var(--color-navy);">${typeLabel} Sınav (${langLabel})</strong>
          <span class="past-attempt-meta">${formattedDate} - ${exam.question_count} Soru</span>
        </div>
        <div class="past-attempt-score">${exam.grade} / 100</div>
      `;
      listEl.appendChild(item);
    });

  } catch (err) {
    console.error("Exception loading past attempts: ", err);
    listEl.innerHTML = '<p style="font-size: 0.85rem; color: #EF4444;">Hata oluştu.</p>';
  }
}
window.loadPastAttempts = loadPastAttempts;

async function generateExam() {
  const btn = document.getElementById('btn-generate-exam');
  const cardSelect = document.getElementById('exam-card-select');
  if (!btn || !cardSelect) return;

  const studyCardId = cardSelect.value;
  if (!studyCardId) return;

  const examType = document.querySelector('input[name="exam-type"]:checked').value;
  const language = document.querySelector('input[name="exam-lang"]:checked').value;
  const questionCount = parseInt(document.getElementById('exam-question-count').value, 10);
  const difficultyInput = document.querySelector('input[name="exam-difficulty"]:checked');
  const difficulty = difficultyInput ? difficultyInput.value : 'medium';

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Sınav Hazırlanıyor...';

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      showDashboardAlert('error', 'Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-exam`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ studyCardId, examType, questionCount, language, difficulty })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Exam generation failed: ", data);
      showDashboardAlert('error', data.error || 'Sınav oluşturulamadı.');
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }

    showDashboardAlert('success', 'Sınav başarıyla oluşturuldu!');
    currentActiveExam = data;
    startActiveExam(data);

  } catch (err) {
    console.error("Exception generating exam: ", err);
    showDashboardAlert('error', 'Sınav oluşturulurken bir bağlantı hatası oluştu.');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}
window.generateExam = generateExam;

function startActiveExam(exam) {
  const setupScreen = document.getElementById('exam-setup-screen');
  const activeScreen = document.getElementById('exam-active-screen');
  const container = document.getElementById('exam-questions-container');

  if (!setupScreen || !activeScreen || !container) return;

  setupScreen.style.display = 'none';
  activeScreen.style.display = 'block';

  const typeTitleMap = {
    classic: exam.language === 'tr' ? 'Klasik' : 'Classic',
    test: exam.language === 'tr' ? 'Çoktan Seçmeli' : 'Multiple Choice',
    calculation: exam.language === 'tr' ? 'Hesaplama' : 'Calculation',
    mixed: exam.language === 'tr' ? 'Karışık' : 'Mixed'
  };
  document.getElementById('active-exam-title').textContent = `${typeTitleMap[exam.exam_type] || 'Sınav'} Sınav`;
  document.getElementById('active-exam-desc').textContent = exam.language === 'tr' ? 'Lütfen tüm soruları dikkatlice cevaplayın.' : 'Please answer all questions carefully.';

  container.innerHTML = '';

  const questions = exam.questions || [];
  questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'exam-question-card';
    card.id = `question-card-${q.id}`;

    let inputHtml = '';
    if (q.type === 'multiple_choice' || q.type === 'true_false') {
      inputHtml = `<div class="exam-choice-list">`;
      const options = q.options || [];
      options.forEach(opt => {
        const optionId = `q-${q.id}-opt-${opt.replace(/\s+/g, '-')}`;
        inputHtml += `
          <label class="exam-choice-label" id="label-${optionId}">
            <input type="radio" name="answer-q-${q.id}" value="${opt}" onchange="selectChoiceOption('${optionId}', 'q-${q.id}')">
            <span>${opt}</span>
          </label>
        `;
      });
      inputHtml += `</div>`;
    } 
    else if (q.type === 'fill_blank') {
      inputHtml = `
        <div style="margin-top: 0.5rem;">
          <input type="text" name="answer-q-${q.id}" class="search-input" style="width: 100%; max-width: 400px; padding: 0.6rem; border: 1px solid rgba(22,50,92,0.15); border-radius: var(--radius-sm); font-size: 0.85rem;" placeholder="${exam.language === 'tr' ? 'Cevabınızı girin...' : 'Enter your answer...'}">
        </div>
      `;
    } 
    else if (q.type === 'calculation') {
      const isPrefix = q.units && (q.units === '$' || q.units === '€' || q.units === '₺');
      inputHtml = `
        <div class="calculation-input-wrapper">
          ${isPrefix ? `<span class="calculation-unit">${q.units}</span>` : ''}
          <input type="number" step="any" name="answer-q-${q.id}" class="calculation-input" placeholder="${exam.language === 'tr' ? 'Sayısal cevabınız...' : 'Your numeric answer...'}">
          ${!isPrefix && q.units ? `<span class="calculation-unit">${q.units}</span>` : ''}
        </div>
      `;
    }
    else if (q.type === 'open_ended') {
      inputHtml = `
        <div style="margin-top: 0.5rem;">
          <textarea name="answer-q-${q.id}" class="search-input" rows="4" style="width: 100%; padding: 0.65rem; border: 1px solid rgba(22,50,92,0.15); border-radius: var(--radius-sm); font-size: 0.85rem; font-family: inherit; resize: vertical;" placeholder="${exam.language === 'tr' ? 'Cevabınızı buraya yazın...' : 'Write your answer here...'}"></textarea>
        </div>
      `;
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
        <span class="exam-question-text">Soru ${idx + 1}: ${q.question}</span>
        <button class="btn btn-outline" id="btn-hint-${q.id}" style="padding: 0.35rem 0.65rem; font-size: 0.7rem; border-color: #F59E0B; color: #F59E0B; min-height: unset; line-height: 1;" onclick="revealExamHint('${q.id}')">+ İpucu Al</button>
      </div>
      <div id="hint-box-${q.id}" class="exam-hint-box" style="display: none;"></div>
      ${inputHtml}
    `;

    container.appendChild(card);
  });
}

function selectChoiceOption(optionId, radioName) {
  // Clear other selections
  const labels = document.querySelectorAll(`[id^="label-${radioName}"]`);
  labels.forEach(l => l.classList.remove('selected'));

  const targetLabel = document.getElementById(`label-${optionId}`);
  if (targetLabel) targetLabel.classList.add('selected');
}
window.selectChoiceOption = selectChoiceOption;

async function revealExamHint(qId) {
  const hintBox = document.getElementById(`hint-box-${qId}`);
  const btn = document.getElementById(`btn-hint-${qId}`);
  if (!hintBox || !currentActiveExam) return;

  const isTr = currentActiveExam.language === 'tr';

  // If already loaded, do nothing (button is already disabled anyway)
  if (hintBox.dataset.loaded === 'true') {
    return;
  }

  const originalText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = isTr ? 'Yükleniyor...' : 'Loading...';
  }
  hintBox.innerHTML = `<strong>${isTr ? 'İpucu:' : 'Hint:'}</strong> <span style="color: var(--color-text-muted);">${isTr ? 'Yükleniyor...' : 'Loading...'}</span>`;
  hintBox.style.display = 'block';

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      hintBox.innerHTML = `<strong>${isTr ? 'Hata:' : 'Error:'}</strong> ${isTr ? 'Oturum bulunamadı.' : 'No active session.'}`;
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-exam-hint`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ examId: currentActiveExam.id, questionIndex: parseInt(qId, 10) })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Hint retrieval failed: ", data);
      hintBox.innerHTML = `<strong>${isTr ? 'Hata:' : 'Error:'}</strong> ${data.error || (isTr ? 'İpucu alınamadı.' : 'Could not fetch hint.')}`;
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
      return;
    }

    hintBox.innerHTML = `<strong>${isTr ? 'İpucu:' : 'Hint:'}</strong> ${data.hint}`;
    hintBox.dataset.loaded = 'true';
    if (btn) {
      btn.disabled = true;
      btn.textContent = isTr ? 'İpucu Alındı' : 'Already Revealed';
      btn.style.borderColor = '#9CA3AF';
      btn.style.color = '#9CA3AF';
    }

  } catch (err) {
    console.error("Exception fetching hint: ", err);
    hintBox.innerHTML = `<strong>${isTr ? 'Hata:' : 'Error:'}</strong> ${isTr ? 'Bağlantı hatası.' : 'Connection error.'}`;
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}
window.revealExamHint = revealExamHint;

function cancelExam() {
  const isTr = currentActiveExam?.language === 'tr';
  const title = isTr ? "Sınavdan Çık" : "Exit Exam";
  const text = isTr 
    ? "Sınavı iptal etmek istediğinize emin misiniz? Cevaplarınız silinecektir." 
    : "Are you sure you want to exit the exam? Your answers will be lost.";
  showConfirmModal(title, text, () => {
    loadExamsPlatform();
  });
}
window.cancelExam = cancelExam;

async function submitExam() {
  if (!currentActiveExam) return;

  const btn = document.getElementById('btn-submit-exam');
  if (!btn) return;

  // Collect answers
  const answers = {};
  const questions = currentActiveExam.questions || [];
  
  questions.forEach(q => {
    if (q.type === 'multiple_choice' || q.type === 'true_false') {
      const selected = document.querySelector(`input[name="answer-q-${q.id}"]:checked`);
      answers[q.id] = selected ? selected.value : "";
    } else {
      const input = document.querySelector(`[name="answer-q-${q.id}"]`);
      answers[q.id] = input ? input.value : "";
    }
  });

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = currentActiveExam.language === 'tr' ? 'Değerlendiriliyor...' : 'Grading...';

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      showDashboardAlert('error', 'Oturum bulunamadı.');
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/grade-exam`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ examId: currentActiveExam.id, answers })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Exam submission failed: ", data);
      showDashboardAlert('error', data.error || 'Sınav gönderilemedi.');
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }

    showDashboardAlert('success', 'Sınav başarıyla tamamlandı ve notlandırıldı!');
    showExamResults(data);

    // Check and award exam achievements
    await checkAndAwardFirstExam(data.grade);

    // Auto-schedule a short remediation plan in the Study Planner for any
    // concept the student scored poorly on in this attempt.
    await scheduleRemediationPlan(data);

  } catch (err) {
    console.error("Exception submitting exam: ", err);
    showDashboardAlert('error', 'Sınav gönderilirken bağlantı hatası oluştu.');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}
window.submitExam = submitExam;

function showExamResults(exam) {
  const setupScreen = document.getElementById('exam-setup-screen');
  const activeScreen = document.getElementById('exam-active-screen');
  const resultsScreen = document.getElementById('exam-results-screen');

  if (!setupScreen || !activeScreen || !resultsScreen) return;

  setupScreen.style.display = 'none';
  activeScreen.style.display = 'none';
  resultsScreen.style.display = 'block';

  // Set score
  const scoreCircle = document.getElementById('result-score-circle');
  scoreCircle.textContent = exam.grade;

  // Grade color
  if (exam.grade >= 80) {
    scoreCircle.style.background = 'var(--color-teal-light)';
    scoreCircle.style.color = 'var(--color-teal)';
  } else if (exam.grade >= 50) {
    scoreCircle.style.background = '#FEF3C7';
    scoreCircle.style.color = '#D97706';
  } else {
    scoreCircle.style.background = '#FEE2E2';
    scoreCircle.style.color = '#DC2626';
  }

  // Set qualitative feedback
  const resultTitle = document.getElementById('result-feedback-title');
  const resultDesc = document.getElementById('result-feedback-desc');
  const isTr = exam.language === 'tr';

  if (exam.grade >= 85) {
    resultTitle.textContent = isTr ? "Mükemmel Başarı!" : "Outstanding Success!";
    resultDesc.textContent = isTr ? "Harika bir çalışma çıkarmışsınız. Konuyu neredeyse tamamen kavramışsınız." : "Outstanding work. You have mastered this material.";
  } else if (exam.grade >= 70) {
    resultTitle.textContent = isTr ? "Güzel Sonuç!" : "Good Result!";
    resultDesc.textContent = isTr ? "Oldukça iyi bir performans. Ufak tefek eksiklikler dışında konuya hakimsiniz." : "Solid performance. You have a good understanding of the topics.";
  } else if (exam.grade >= 50) {
    resultTitle.textContent = isTr ? "Geçer Not!" : "Passed!";
    resultDesc.textContent = isTr ? "Sınavı geçtiniz, fakat konunun üzerinden biraz daha geçmeniz faydalı olabilir." : "You passed, but some review of key areas would be beneficial.";
  } else {
    resultTitle.textContent = isTr ? "Daha Fazla Çalışmalısınız" : "Needs Study";
    resultDesc.textContent = isTr ? "Konuyu tam anlamıyla pekiştirmek için çalışma kartlarınızı tekrar inceleyin." : "Review your study cards again to better grasp the topics.";
  }

  // Render question detail results
  const detailsContainer = document.getElementById('result-details-container');
  detailsContainer.innerHTML = '';

  const results = exam.question_results || [];
  results.forEach((res, idx) => {
    const item = document.createElement('div');
    const statusClass = res.score >= 80 ? 'correct' : (res.score >= 50 ? 'partial' : 'incorrect');
    item.className = `question-result-box ${statusClass}`;

    let correctBlock = '';
    if (res.type !== 'open_ended') {
      const unitStr = res.units ? ` ${res.units}` : '';
      const tolStr = res.tolerance_percent ? ` (±${res.tolerance_percent}% ${isTr ? 'tolerans' : 'margin'})` : '';
      correctBlock = `<div style="font-size: 0.8rem; color: var(--color-teal); font-weight: 700; margin-top: 0.25rem;">${isTr ? 'Doğru Cevap' : 'Correct Answer'}: ${res.correct_answer}${unitStr}${tolStr}</div>`;
    }

    let solutionStepsHtml = '';
    if (Array.isArray(res.solution_steps) && res.solution_steps.length > 0) {
      solutionStepsHtml = `
        <div class="solution-steps-box">
          <div class="solution-steps-title">📋 ${isTr ? 'Çözüm Adımları' : 'Solution Steps'}</div>
          <ol class="solution-steps-list">
            ${res.solution_steps.map(step => `<li>${renderMathInText(step)}</li>`).join('')}
          </ol>
        </div>
      `;
    }

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: var(--color-navy);">
        <span>Soru ${idx + 1}: ${res.question}</span>
        <span style="color: ${res.score >= 80 ? 'var(--color-teal)' : (res.score >= 50 ? '#D97706' : '#DC2626')};">${res.score} / 100 Puan</span>
      </div>
      <div style="font-size: 0.8rem; margin-top: 0.5rem;">
        <strong>${isTr ? 'Sizin Cevabınız' : 'Your Answer'}:</strong> ${res.student_answer || (isTr ? '[Boş bırakıldı]' : '[Left blank]')} ${res.units && res.student_answer ? res.units : ''}
      </div>
      ${correctBlock}
      <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 0.5rem; background-color: var(--color-bg-alt); padding: 0.5rem; border-radius: var(--radius-sm); border-left: 3px solid rgba(22,50,92,0.15);">
        <strong>${isTr ? 'Değerlendirme' : 'Evaluation'}:</strong> ${res.feedback}
      </div>
      ${solutionStepsHtml}
    `;

    detailsContainer.appendChild(item);
  });
}
window.showExamResults = showExamResults;

// ==========================================
// Post-exam remediation plan
// Looks at the concepts the student scored weakest on in the attempt that
// was just graded, and quietly adds a couple of "review this" tasks to the
// Study Planner (study_events) so the next study session has a starting
// point. Skips concepts that already have an open reminder to avoid
// cluttering the planner across repeated exam attempts.
// ==========================================
const REMEDIATION_SCORE_THRESHOLD = 60;
const REMEDIATION_MAX_ITEMS = 3;
const REMEDIATION_DUE_IN_DAYS = 2;

async function scheduleRemediationPlan(exam) {
  try {
    if (!currentUser) return;
    const results = exam.question_results || [];

    // Aggregate by concept within this single attempt only.
    const conceptScores = {};
    results.forEach(res => {
      const concept = (res.concept || '').trim();
      if (!concept) return;
      if (!conceptScores[concept]) conceptScores[concept] = { total: 0, count: 0 };
      conceptScores[concept].total += (typeof res.score === 'number' ? res.score : 0);
      conceptScores[concept].count += 1;
    });

    const weakConcepts = Object.keys(conceptScores)
      .map(concept => ({ concept, avg: conceptScores[concept].total / conceptScores[concept].count }))
      .filter(c => c.avg < REMEDIATION_SCORE_THRESHOLD)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, REMEDIATION_MAX_ITEMS);

    if (weakConcepts.length === 0) return; // Nothing to schedule — good result!

    // Avoid duplicate reminders: check which of these concepts already have
    // an open (not-done) "review" event pending.
    const { data: existingEvents } = await supabaseClient
      .from('study_events')
      .select('title')
      .eq('user_id', currentUser.id)
      .eq('is_done', false);
    const existingTitles = new Set((existingEvents || []).map(e => e.title));

    const dueDate = new Date(Date.now() + REMEDIATION_DUE_IN_DAYS * 24 * 60 * 60 * 1000);
    const dueDateStr = getLocalDateString(dueDate);

    const isTr = exam.language === 'tr';
    const newEvents = weakConcepts
      .map(c => ({
        title: (isTr ? `Tekrar Et: ${c.concept}` : `Review: ${c.concept}`),
        avg: c.avg
      }))
      .filter(e => !existingTitles.has(e.title))
      .map(e => ({
        user_id: currentUser.id,
        title: e.title,
        event_date: dueDateStr,
        event_type: 'goal',
        notes: isTr
          ? `Otomatik oluşturuldu: son sınavda bu konudan ortalama ${Math.round(e.avg)}/100 aldınız. Çalışma kartlarınızı tekrar gözden geçirin.`
          : `Auto-added: you averaged ${Math.round(e.avg)}/100 on this topic in your last exam. Worth another look at your study cards.`,
        is_done: false
      }));

    if (newEvents.length === 0) return;

    const { error } = await supabaseClient.from('study_events').insert(newEvents);
    if (error) {
      console.error('Failed to schedule remediation plan:', error);
      return;
    }

    // Refresh the planner list if it's currently visible, and let the
    // student know without being intrusive about it.
    if (document.getElementById('planner-events-this-week')) {
      await loadPlannerEvents();
    }
    const topicNames = newEvents.map(e => e.title.split(': ')[1]).join(', ');
    showDashboardAlert('success', isTr
      ? `Planlayıcınıza tekrar hatırlatmaları eklendi: ${topicNames}`
      : `Added review reminders to your planner: ${topicNames}`);
  } catch (err) {
    console.error('Exception scheduling remediation plan:', err);
    // Non-critical — fail silently beyond the console so it never blocks the exam results screen.
  }
}

function backToExamSetup() {
  loadExamsPlatform();
}
window.backToExamSetup = backToExamSetup;

// ==========================================
// TAB 6: SETTINGS VIEW (AYARLAR)
// ==========================================
async function loadSettingsView() {
  const fullnameInput = document.getElementById('settings-fullname');
  const studentNoDiv = document.getElementById('settings-student-no');
  const emailDiv = document.getElementById('settings-email');
  const deptSelect = document.getElementById('settings-dept');

  if (!fullnameInput) return;

  try {
    // 1. Fetch latest profile
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error || !profile) {
      console.error("Error loading settings profile: ", error);
      showDashboardAlert('error', 'Profil bilgileri yüklenemedi.');
      return;
    }

    // Cache updated profile info
    currentUserProfile = profile;
    window.currentUserProfile = currentUserProfile;

    // Fill form
    fullnameInput.value = profile.full_name || '';

    // Avatar preview in settings
    const settingsAvatar = document.getElementById('settings-avatar-preview');
    if (settingsAvatar) {
      settingsAvatar.innerHTML = renderUserAvatarHtml(profile, 64);
    }
    studentNoDiv.textContent = profile.student_number || 'N/A';
    emailDiv.textContent = currentUser.email || 'N/A';
    deptSelect.value = profile.department || '';

  } catch (err) {
    console.error("Exception loading settings profile: ", err);
    showDashboardAlert('error', 'Hata oluştu.');
  }
}
window.loadSettingsView = loadSettingsView;

async function saveProfileSettings(event) {
  event.preventDefault();

  const fullnameInput = document.getElementById('settings-fullname');
  const deptSelect = document.getElementById('settings-dept');
  if (!fullnameInput || !deptSelect) return;

  const fullName = fullnameInput.value.trim();
  const department = deptSelect.value;

  if (!fullName) {
    showDashboardAlert('error', 'Lütfen adınızı girin.');
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({
        full_name: fullName,
        department: department
      })
      .eq('id', currentUser.id);

    if (error) {
      console.error("Profile settings save failed: ", error);
      showDashboardAlert('error', 'Değişiklikler kaydedilemedi.');
      return;
    }

    showDashboardAlert('success', 'Profile updated!');

    // Update locally cached profile
    currentUserProfile.full_name = fullName;
    currentUserProfile.department = department;

    // Refresh UI elements
    const nameEl = document.getElementById('user-name');
    const deptEl = document.getElementById('user-dept');
    const welcomeGreeting = document.getElementById('welcome-greeting');
    const welcomeSub = document.getElementById('welcome-sub');

    if (nameEl) {
      nameEl.textContent = fullName;
    }
    if (deptEl) {
      const badgeClass = getDepartmentColorClass(department);
      const shortName = getDepartmentShortName(department);
      deptEl.innerHTML = `${translateDepartment(department)} <span class="dept-badge ${badgeClass}">${shortName}</span>`;
    }
    if (welcomeGreeting) {
      welcomeGreeting.textContent = `Welcome back, ${fullName.split(' ')[0]}!`;
    }
    if (welcomeSub) {
      const currentLang = localStorage.getItem('acadexUILang') || 'en';
      const translatedDept = translateDepartment(department);
      if (currentLang === 'tr') {
        welcomeSub.textContent = `Fakülte programında neler olup bittiğine göz at: ${translatedDept || 'Bölümün'}`;
      } else {
        welcomeSub.textContent = `Here's what's happening in ${translatedDept || 'your faculty'}.`;
      }
    }

  } catch (err) {
    console.error("Exception in saveProfileSettings: ", err);
    showDashboardAlert('error', 'Hata oluştu.');
  }
}
window.saveProfileSettings = saveProfileSettings;

async function changeUserPassword(event) {
  event.preventDefault();

  const newPassInput = document.getElementById('settings-new-pass');
  const confirmPassInput = document.getElementById('settings-confirm-pass');
  const errorEl = document.getElementById('password-error-message');

  if (!newPassInput || !confirmPassInput || !errorEl) return;

  errorEl.style.display = 'none';
  errorEl.textContent = '';

  const newPass = newPassInput.value;
  const confirmPass = confirmPassInput.value;

  if (!newPass || !confirmPass) {
    errorEl.textContent = 'Lütfen tüm alanları doldurun.';
    errorEl.style.display = 'block';
    return;
  }

  if (newPass.length < 6) {
    errorEl.textContent = 'Şifre en az 6 karakter olmalıdır.';
    errorEl.style.display = 'block';
    return;
  }

  if (newPass !== confirmPass) {
    errorEl.textContent = 'Şifreler eşleşmiyor.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const { error } = await supabaseClient.auth.updateUser({ password: newPass });

    if (error) {
      console.error("Password update failed: ", error);
      errorEl.textContent = 'Şifre güncellenemedi. Lütfen tekrar deneyin.';
      errorEl.style.display = 'block';
      return;
    }

    showDashboardAlert('success', 'Password updated successfully!');
    newPassInput.value = '';
    confirmPassInput.value = '';

  } catch (err) {
    console.error("Exception updating password: ", err);
    errorEl.textContent = 'Hata oluştu.';
    errorEl.style.display = 'block';
  }
}
window.changeUserPassword = changeUserPassword;

function openDeleteAccountModal() {
  const modal = document.getElementById('delete-account-modal');
  const confirmInput = document.getElementById('delete-account-confirm-input');
  const confirmBtn = document.getElementById('btn-delete-account-confirm');
  const errorEl = document.getElementById('delete-account-modal-error');

  if (!modal || !confirmInput || !confirmBtn) return;

  confirmInput.value = '';
  confirmBtn.disabled = true;
  confirmBtn.style.opacity = '0.5';
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }

  modal.classList.add('active');
}
window.openDeleteAccountModal = openDeleteAccountModal;

function closeDeleteAccountModal() {
  const modal = document.getElementById('delete-account-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}
window.closeDeleteAccountModal = closeDeleteAccountModal;

function onDeleteAccountConfirmInput(val) {
  const confirmBtn = document.getElementById('btn-delete-account-confirm');
  if (!confirmBtn) return;

  if (val.trim() === 'DELETE') {
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';
  } else {
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.5';
  }
}
window.onDeleteAccountConfirmInput = onDeleteAccountConfirmInput;

async function confirmDeleteAccount() {
  const confirmBtn = document.getElementById('btn-delete-account-confirm');
  const cancelBtn = document.getElementById('btn-delete-account-cancel');
  const errorEl = document.getElementById('delete-account-modal-error');

  if (!confirmBtn || !cancelBtn || !errorEl) return;

  errorEl.style.display = 'none';
  errorEl.textContent = '';

  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Siliniyor...';
  cancelBtn.disabled = true;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      errorEl.textContent = 'Oturum bulunamadı. Silme işlemi başarısız.';
      errorEl.style.display = 'block';
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Hesabımı Sil';
      cancelBtn.disabled = false;
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      }
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Account deletion failed: ", data);
      errorEl.textContent = data.error || 'Hesap silme işlemi başarısız oldu.';
      errorEl.style.display = 'block';
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Hesabımı Sil';
      cancelBtn.disabled = false;
      return;
    }

    // Success! Sign out and redirect
    await supabaseClient.auth.signOut();
    window.location.replace('index.html?accountDeleted=true');

  } catch (err) {
    console.error("Exception in confirmDeleteAccount: ", err);
    errorEl.textContent = 'Bir bağlantı hatası oluştu. Lütfen tekrar deneyin.';
    errorEl.style.display = 'block';
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Hesabımı Sil';
    cancelBtn.disabled = false;
  }
}
window.confirmDeleteAccount = confirmDeleteAccount;

// ==========================================
// GUIDED ONBOARDING TOUR IMPLEMENTATION (PHASE 8 UPDATED)
// ==========================================
function getTourSteps() {
  const steps = [
    {
      title: "Welcome to Acadex! 👋",
      desc: "Let's take a quick tour of your student portal.",
      target: null
    },
    {
      title: "Ana Sayfa",
      desc: "Your personal dashboard — see your stats, quick actions, recent activity, achievements, and study streak here. You can always replay this tour from a link on this page.",
      target: "side-home"
    },
    {
      title: "Çalışma Planlayıcı",
      desc: "Track upcoming exam dates and study goals here — with reminders so you never miss one.",
      target: "side-planner"
    },
    {
      title: "Belgelerim",
      desc: "Upload your lecture slides, articles, and syllabus files here — you can even upload several at once and summarize them together.",
      target: "side-docs"
    },
    {
      title: "Bölüm Akışı",
      desc: "See study cards your classmates have chosen to share with your department — and share your own when you're ready.",
      target: "side-feed"
    },
    {
      title: "Çalışma Defteri",
      desc: "Your personal digital notebook — draw, write, add tables, shapes, and images, start from a template like SWOT or Cornell Notes, and paste your study cards here as sticky notes. You can even share a page with a classmate to work on together.",
      target: "side-notebook"
    },
    {
      title: "Bilgi Kartları",
      desc: "Every AI-generated study card you create lives here, fully searchable and filterable. Review them with smart spaced repetition, listen to an audio overview, chat with Acadia about a specific document, or turn one into a mind map — all from here.",
      target: "side-cards"
    },
    {
      title: "Sınav Platformu",
      desc: "Turn any study card into a practice exam — classic, multiple choice, or mixed — complete with hints if you get stuck and instant AI grading.",
      target: "side-exams"
    },
    {
      title: "Geliştirici Sandbox",
      desc: "Practice with sample datasets and share your own coding or data projects with the whole Acadex community — especially handy if you're into MIS or just curious about data.",
      target: "side-sandbox"
    },
    {
      title: "Ayarlar",
      desc: "Manage your profile, password, avatar, and account settings here.",
      target: "side-settings"
    },
    {
      title: "Top Bar Features",
      desc: "Use the search icon (or Ctrl+K) to quickly find anything, check 'Yenilikler' for what's new, switch between English and Turkish, and keep an eye on the bell for updates from your department.",
      target: "top-bar-features"
    },
    {
      title: "Acadia Assistant",
      desc: "Need help understanding something? Ask Acadia, your AI study assistant, anytime.",
      target: "btn-acadia-toggle"
    },
    {
      title: "Focus Mode",
      desc: "When you need to concentrate, try Focus Mode — a Pomodoro timer with an optional dim screen and calming ambient sound.",
      target: "btn-pomodoro-toggle"
    }
  ];

  // Conditional Step 14: Yönetici Paneli (only included if current account is admin)
  if (currentUserProfile && currentUserProfile.is_admin === true) {
    steps.push({
      title: "Yönetici Paneli",
      desc: "As an administrator, you also have access to the Yönetici Paneli — platform statistics, the student roster, your inbox, and content moderation tools.",
      target: "side-admin"
    });
  }

  // Final Step 15
  steps.push({
    title: "You're all set! 🎉",
    desc: "Start by uploading your first document.",
    target: null
  });

  return steps;
}

let currentTourStep = 0;

function startOnboardingTour() {
  console.log("Starting guided onboarding tour...");

  // Close any open modals first for clean view
  const modalCloseButtons = document.querySelectorAll('.modal-close, [data-dismiss="modal"]');
  modalCloseButtons.forEach(btn => btn.click());

  // Ensure tour layout elements exist
  let overlay = document.getElementById('tour-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tour-overlay';
    overlay.className = 'tour-overlay';
    document.body.appendChild(overlay);
  }

  let spotlight = document.getElementById('tour-spotlight');
  if (!spotlight) {
    spotlight = document.createElement('div');
    spotlight.id = 'tour-spotlight';
    spotlight.className = 'tour-spotlight';
    document.body.appendChild(spotlight);
  }

  let tooltip = document.getElementById('tour-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'tour-tooltip';
    tooltip.className = 'tour-tooltip';
    document.body.appendChild(tooltip);
  }

  overlay.classList.add('active');
  currentTourStep = 0;

  // Add Escape key dismiss listener
  document.addEventListener('keydown', handleTourKeydown);

  // Initial step render
  renderTourStep(currentTourStep);
}

function handleTourKeydown(e) {
  if (e.key === 'Escape') {
    finishTour();
  }
}

function renderTourStep(stepIndex) {
  const overlay = document.getElementById('tour-overlay');
  const spotlight = document.getElementById('tour-spotlight');
  const tooltip = document.getElementById('tour-tooltip');

  if (!overlay || !spotlight || !tooltip) return;

  const tourSteps = getTourSteps();
  if (stepIndex < 0 || stepIndex >= tourSteps.length) {
    finishTour();
    return;
  }

  currentTourStep = stepIndex;
  const step = tourSteps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tourSteps.length - 1;

  // Generate tooltip content
  tooltip.innerHTML = `
    <h4 class="tour-tooltip-title">${step.title}</h4>
    <p class="tour-tooltip-desc">${step.desc}</p>
    <div class="tour-tooltip-footer">
      <span class="tour-steps-indicator">${stepIndex} / ${tourSteps.length - 1}</span>
      <div class="tour-tooltip-buttons">
        ${!isFirst && !isLast ? '<button class="tour-btn btn-back">Geri</button>' : ''}
        ${isLast 
          ? '<button class="tour-btn btn-next">Finish</button>' 
          : '<button class="tour-btn btn-next">' + (isFirst ? 'Başla' : 'İleri') + '</button>'}
        ${!isLast ? '<button class="tour-btn btn-skip">Geç</button>' : ''}
      </div>
    </div>
  `;

  // Attach button event handlers
  const nextBtn = tooltip.querySelector('.btn-next');
  const backBtn = tooltip.querySelector('.btn-back');
  const skipBtn = tooltip.querySelector('.btn-skip');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (isLast) {
        finishTour();
      } else {
        renderTourStep(stepIndex + 1);
      }
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      renderTourStep(stepIndex - 1);
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      finishTour();
    });
  }

  // Handle positioning
  if (step.target) {
    const el = document.getElementById(step.target);
    if (el) {
      if (step.target.startsWith('side-')) {
        const viewName = step.target.replace('side-', '');
        if (typeof switchDashboardView === 'function') {
          switchDashboardView(viewName);
        }
      }

      spotlight.style.display = 'block';
      
      const rect = el.getBoundingClientRect();
      spotlight.style.width = `${rect.width + 12}px`;
      spotlight.style.height = `${rect.height + 12}px`;
      spotlight.style.top = `${rect.top - 6}px`;
      spotlight.style.left = `${rect.left - 6}px`;

      if (window.innerWidth >= 768) {
        tooltip.style.transform = 'none';

        if (step.target === 'btn-pomodoro-toggle') {
          tooltip.style.left = `${Math.max(20, rect.left - 340)}px`;
          tooltip.style.top = `${Math.max(20, rect.top - 20)}px`;
        } else if (step.target === 'btn-acadia-toggle') {
          tooltip.style.left = `${rect.right + 20}px`;
          tooltip.style.top = `${Math.max(20, rect.top - 40)}px`;
        } else {
          tooltip.style.left = `${rect.right + 20}px`;
          
          tooltip.style.visibility = 'hidden';
          tooltip.style.display = 'flex';
          const tooltipHeight = tooltip.offsetHeight || 150;
          tooltip.style.visibility = 'visible';

          let topPos = rect.top + (rect.height / 2) - (tooltipHeight / 2);
          topPos = Math.max(20, Math.min(window.innerHeight - tooltipHeight - 20, topPos));
          tooltip.style.top = `${topPos}px`;
        }
      } else {
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.left = '50%';
        tooltip.style.top = 'auto';
        tooltip.style.bottom = '20px';
      }
    } else {
      centerTourTooltip();
    }
  } else {
    centerTourTooltip();
  }
}

function centerTourTooltip() {
  const spotlight = document.getElementById('tour-spotlight');
  const tooltip = document.getElementById('tour-tooltip');
  if (spotlight) spotlight.style.display = 'none';
  if (tooltip) {
    tooltip.style.left = '50%';
    tooltip.style.top = '50%';
    tooltip.style.bottom = 'auto';
    tooltip.style.transform = 'translate(-50%, -50%)';
  }
}

async function finishTour() {
  console.log("Ending guided onboarding tour...");
  
  // Cleanup UI
  const overlay = document.getElementById('tour-overlay');
  const spotlight = document.getElementById('tour-spotlight');
  const tooltip = document.getElementById('tour-tooltip');
  
  if (overlay) overlay.classList.remove('active');
  if (spotlight) spotlight.style.display = 'none';
  if (tooltip) {
    tooltip.style.left = '-9999px'; // move off-screen
    tooltip.style.top = '-9999px';
  }

  document.removeEventListener('keydown', handleTourKeydown);

  // Save completion status to Supabase profile row
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      const { error } = await supabaseClient
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);
      
      if (error) {
        console.error("Failed to update onboarding_completed database status:", error);
      } else {
        console.log("Successfully marked onboarding_completed as true in DB.");
        if (currentUserProfile) {
          currentUserProfile.onboarding_completed = true;
        }
      }
    }
  } catch (err) {
    console.error("Exception in finishTour DB save:", err);
  }
}

window.startOnboardingTour = startOnboardingTour;
window.renderTourStep = renderTourStep;
window.finishTour = finishTour;

// ==========================================
// DOCUMENT DROPDOWN VIEW CONTROLLERS (PHASE 9)
// ==========================================
function toggleDocDropdown(event, docId) {
  event.preventDefault();
  event.stopPropagation();
  
  const allMenus = document.querySelectorAll('.dropdown-menu');
  allMenus.forEach(menu => {
    if (menu.id !== `dropdown-menu-${docId}`) {
      menu.style.display = 'none';
    }
  });
  
  const menu = document.getElementById(`dropdown-menu-${docId}`);
  if (menu) {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
}

function viewStudyCardWrapper(event, docId, docName, cardId) {
  event.preventDefault();
  event.stopPropagation();
  
  const menu = document.getElementById(`dropdown-menu-${docId}`);
  if (menu) menu.style.display = 'none';
  
  viewStudyCard(docId, docName, false, cardId);
}

// Global click event to close dropdowns when clicking outside
document.addEventListener('click', () => {
  const allMenus = document.querySelectorAll('.dropdown-menu');
  allMenus.forEach(menu => {
    menu.style.display = 'none';
  });
});

window.toggleDocDropdown = toggleDocDropdown;
window.viewStudyCardWrapper = viewStudyCardWrapper;

async function deleteStudyCard(event, cardId, docId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  const isTr = localStorage.getItem('acadexUILang') === 'tr';
  const title = isTr ? "Bilgi Kartını Sil" : "Delete Study Card";
  const text = isTr 
    ? "Bu bilgi kartını silmek istediğinize emin misiniz? Bu işlem geri alınamaz." 
    : "Delete this study card? This cannot be undone.";

  showConfirmModal(title, text, async () => {
    try {
      const { error } = await supabaseClient
        .from('study_cards')
        .delete()
        .eq('id', cardId);

      if (error) {
        console.error("Error deleting study card:", error);
        showDashboardAlert('error', 'Could not delete study card. / Bilgi kartı silinemedi.');
        return;
      }

      showDashboardAlert('success', 'Study card deleted successfully. / Bilgi kartı başarıyla silindi.');

      // Check if there are any remaining study cards for this document
      const { data: remainingCards, error: checkError } = await supabaseClient
        .from('study_cards')
        .select('id')
        .eq('document_id', docId);

      if (!checkError && (!remainingCards || remainingCards.length === 0)) {
        // Revert document status back to 'uploaded'
        await supabaseClient
          .from('documents')
          .update({ status: 'uploaded' })
          .eq('id', docId);
      }

      // Refresh UI
      await loadDocuments(true);
      if (typeof loadCardsLibrary === 'function') {
        await loadCardsLibrary();
      }
      if (typeof loadStudyNotebook === 'function') {
        await loadStudyNotebook();
      }

    } catch (err) {
      console.error("Exception deleting study card:", err);
      showDashboardAlert('error', 'An unexpected error occurred. / Beklenmedik bir hata oluştu.');
    }
  });
}
window.deleteStudyCard = deleteStudyCard;

function updateWhiteboardSwatches() {
  const swatches = document.querySelectorAll('.color-swatch');
  if (swatches.length >= 2) {
    swatches[0].style.backgroundColor = '#000000';
    swatches[0].setAttribute('data-color', '#000000');
    swatches[0].title = 'Black color';
    swatches[0].setAttribute('aria-label', 'Black color');
    
    swatches[1].style.backgroundColor = '#0F172A';
    swatches[1].setAttribute('data-color', '#0F172A');
    swatches[1].title = 'Dark Navy color';
    swatches[1].setAttribute('aria-label', 'Dark Navy color');
    
    if (currentPenColor === '#FFFFFF' || currentPenColor === '#38BDF8') {
      currentPenColor = '#000000';
      swatches.forEach(s => s.classList.remove('active'));
      swatches[0].classList.add('active');
    }
  }
}
window.updateWhiteboardSwatches = updateWhiteboardSwatches;

// ==========================================
// GLOBAL SEARCH CONTROLLER & WORKERS (PHASE 9)
// ==========================================
function initGlobalSearch() {
  const overlay = document.getElementById('global-search-overlay');
  const openBtn = document.getElementById('btn-global-search');
  const closeBtn = document.getElementById('btn-close-global-search');
  const searchInput = document.getElementById('global-search-input');
  const resultsContainer = document.getElementById('global-search-results');

  if (!overlay || !openBtn || !closeBtn || !searchInput || !resultsContainer) {
    console.warn("Global Search elements not found in DOM.");
    return;
  }

  // Open modal
  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    overlay.classList.add('active');
    searchInput.value = '';
    resultsContainer.innerHTML = '<div class="search-empty-state">Start typing to search documents, cards, and exams...</div>';
    setTimeout(() => searchInput.focus(), 100);
  });

  // Open search overlay on Ctrl+K / Cmd+K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openBtn.click();
    }
  });

  // Close modal
  function closeSearch() {
    overlay.classList.remove('active');
  }

  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeSearch();
  });

  // Close on Esc key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      closeSearch();
    }
  });

  // Close on clicking overlay background
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeSearch();
    }
  });

  // Debounced input handler
  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      resultsContainer.innerHTML = '<div class="search-empty-state">Start typing to search documents, cards, and exams...</div>';
      return;
    }

    resultsContainer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; padding: 2rem;">
        <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 24px; height: 24px; color: var(--color-teal);">
          <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
        </svg>
      </div>
    `;

    searchTimeout = setTimeout(async () => {
      try {
        await executeGlobalSearch(query, resultsContainer);
      } catch (err) {
        console.error("Error executing global search:", err);
        resultsContainer.innerHTML = '<div class="search-empty-state">An error occurred while searching.</div>';
      }
    }, 300);
  });
}

async function executeGlobalSearch(query, container) {
  const actionsList = [
    { title: "Ana Sayfa (Overview)", action: "nav-home", tr: "Genel Bakış Sayfasına Git", en: "Go to Overview Page" },
    { title: "Belgelerim (My Documents)", action: "nav-docs", tr: "Belgelerim Sayfasına Git", en: "Go to My Documents Page" },
    { title: "Bölüm Akışı (Department Feed)", action: "nav-feed", tr: "Bölüm Akışı Sayfasına Git", en: "Go to Department Feed Page" },
    { title: "Çalışma Defteri (Study Canvas)", action: "nav-notebook", tr: "Çalışma Defteri Sayfasına Git", en: "Go to Study Notebook Page" },
    { title: "Bilgi Kartları (Study Cards)", action: "nav-cards", tr: "Bilgi Kartları Sayfasına Git", en: "Go to Study Cards Page" },
    { title: "Sınav Platformu (Exams Platform)", action: "nav-exams", tr: "Sınav Platformuna Git", en: "Go to Exams Platform Page" },
    { title: "Geliştirici Sandbox (Developer Sandbox)", action: "nav-sandbox", tr: "Geliştirici Sandbox Galerisine Git", en: "Go to Developer Sandbox Page" },
    { title: "Ayarlar (Settings)", action: "nav-settings", tr: "Ayarlar Sayfasına Git", en: "Go to Settings Page" }
  ];

  const matchedActions = actionsList.filter(act => 
    act.title.toLowerCase().includes(query) || 
    act.tr.toLowerCase().includes(query) || 
    act.en.toLowerCase().includes(query)
  );

  const [docsRes, cardsRes, examsRes] = await Promise.all([
    supabaseClient
      .from('documents')
      .select('*')
      .eq('user_id', currentUser.id)
      .ilike('file_name', `%${query}%`)
      .limit(10),
    supabaseClient
      .from('study_cards')
      .select('*, documents(file_name)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false }),
    supabaseClient
      .from('exams')
      .select('*')
      .eq('user_id', currentUser.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
  ]);

  const matchedDocs = docsRes.data || [];
  
  // Client-side filter study cards
  const allCards = cardsRes.data || [];
  const matchedCards = allCards.filter(card => {
    const fileName = (card.documents?.file_name || '').toLowerCase();
    const summary = (card.summary || '').toLowerCase();
    return fileName.includes(query) || summary.includes(query);
  }).slice(0, 10);

  // Client-side filter exams: match by document file name
  const allExams = examsRes.data || [];
  const matchedExams = allExams.filter(exam => {
    const card = allCards.find(c => c.id === exam.study_card_id);
    if (!card) return false;
    const fileName = (card.documents?.file_name || '').toLowerCase();
    return fileName.includes(query);
  }).slice(0, 10);

  let html = '';

  if (matchedActions.length === 0 && matchedDocs.length === 0 && matchedCards.length === 0 && matchedExams.length === 0) {
    container.innerHTML = '<div class="search-empty-state">No matching results found. / Eşleşen sonuç bulunamadı.</div>';
    return;
  }

  // 0. Quick Actions group
  if (matchedActions.length > 0) {
    html += `
      <div>
        <div class="search-results-group-title">Quick Actions & Pages (${matchedActions.length})</div>
        <ul class="search-results-list">
          ${matchedActions.map(act => `
            <li>
              <a class="search-result-item" onclick="handleQuickActionClick(event, '${act.action}')">
                <div class="search-result-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-teal);"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                </div>
                <div class="search-result-text">
                  <span>${act.title}</span>
                  <span class="search-result-subtext">Action: ${act.en} / ${act.tr}</span>
                </div>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  // 1. Documents group
  if (matchedDocs.length > 0) {
    html += `
      <div>
        <div class="search-results-group-title">Documents (${matchedDocs.length})</div>
        <ul class="search-results-list">
          ${matchedDocs.map(doc => `
            <li>
              <a class="search-result-item" onclick="handleSearchResultClick(event, 'doc', '${doc.id}')">
                <div class="search-result-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                </div>
                <div class="search-result-text">
                  <span>${doc.file_name}</span>
                  <span class="search-result-subtext">Status: ${doc.status} • Size: ${(doc.file_size / 1024).toFixed(1)} KB</span>
                </div>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  // 2. Study Cards group
  if (matchedCards.length > 0) {
    html += `
      <div>
        <div class="search-results-group-title">Study Cards (${matchedCards.length})</div>
        <ul class="search-results-list">
          ${matchedCards.map(card => {
            const docName = card.documents?.file_name || 'Unnamed Document';
            const styleLabel = getStyleLabel(card.summary_style);
            const langLabel = card.summary_language === 'tr' ? 'Turkish' : 'English';
            return `
              <li>
                <a class="search-result-item" onclick="handleSearchResultClick(event, 'card', '${card.document_id}', '${card.id}', '${docName.replace(/'/g, "\\'")}')">
                  <div class="search-result-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                  </div>
                  <div class="search-result-text">
                    <span>${docName} — <span style="color: var(--color-teal); font-weight: 700;">${styleLabel} (${langLabel})</span></span>
                    <span class="search-result-subtext" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 550px;">${card.summary}</span>
                  </div>
                </a>
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    `;
  }

  // 3. Exams group
  if (matchedExams.length > 0) {
    html += `
      <div>
        <div class="search-results-group-title">Completed Exams (${matchedExams.length})</div>
        <ul class="search-results-list">
          ${matchedExams.map(exam => {
            const card = allCards.find(c => c.id === exam.study_card_id);
            const docName = card?.documents?.file_name || 'Unnamed Document';
            const scorePercent = Math.round((exam.score || 0) * 100);
            const formattedTime = new Date(exam.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `
              <li>
                <a class="search-result-item" onclick="handleSearchResultClick(event, 'exam', '${exam.study_card_id}')">
                  <div class="search-result-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  </div>
                  <div class="search-result-text">
                    <span>Quiz for ${docName}</span>
                    <span class="search-result-subtext">Score: ${scorePercent}% • Completed: ${formattedTime}</span>
                  </div>
                </a>
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    `;
  }

  container.innerHTML = html;
}

function handleQuickActionClick(event, action) {
  if (event) event.preventDefault();
  
  const overlay = document.getElementById('global-search-overlay');
  if (overlay) overlay.classList.remove('active');
  
  if (action.startsWith('nav-')) {
    const viewName = action.substring(4);
    switchDashboardView(viewName);
  }
}

function handleSearchResultClick(event, type, targetId, cardId = null, docName = null) {
  event.preventDefault();
  event.stopPropagation();
  
  const overlay = document.getElementById('global-search-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }

  if (type === 'doc') {
    switchDashboardView('docs');
  } 
  else if (type === 'card') {
    switchDashboardView('cards');
    if (targetId && docName) {
      viewStudyCard(targetId, docName, false, cardId);
    }
  } 
  else if (type === 'exam') {
    switchDashboardView('exams');
  }
}

window.initGlobalSearch = initGlobalSearch;
window.handleQuickActionClick = handleQuickActionClick;
window.handleSearchResultClick = handleSearchResultClick;

// ==========================================
// CARD DEPOT WORKFLOW CONTROLLERS (PHASE 11)
// ==========================================

async function updateDepotCountBadge(count = null) {
  const badge = document.getElementById('depot-count-badge');
  if (!badge) return;

  if (count === null) {
    try {
      const { count: fetchedCount, error } = await supabaseClient
        .from('card_depot')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);

      if (!error) {
        if (fetchedCount > 0) {
          badge.textContent = fetchedCount;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) {
      console.error("Error fetching depot count:", e);
    }
  } else {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

function initDepotModalListeners() {
  const btnOpen = document.getElementById('btn-depot-modal');
  const modal = document.getElementById('depot-modal');
  const btnClose = document.getElementById('btn-close-depot-modal');
  if (!btnOpen || !modal || !btnClose) return;

  if (btnOpen.getAttribute('data-bound') === 'true') return;

  btnOpen.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await loadDepotItems();
    modal.style.display = 'flex';
  });

  const closeModal = () => {
    modal.style.display = 'none';
  };

  btnClose.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  btnOpen.setAttribute('data-bound', 'true');
}

async function sendToDepot(event, btn, cardId, sourceType, title, content) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  console.log(`[sendToDepot] Sending item to depot: sourceType=${sourceType}, title=${title}, cardId=${cardId}`, content);

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `
    <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 12px; height: 12px; margin-right: 0; color: currentColor; display: inline-block;">
      <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
    </svg>
    Gönderiliyor...
  `;

  try {
    const { error } = await supabaseClient
      .from('card_depot')
      .insert({
        user_id: currentUser.id,
        source_type: sourceType,
        title: title,
        content: content,
        study_card_id: cardId
      });

    if (error) {
      console.error("Error sending to depot:", error);
      showDashboardAlert('error', `Depoya gönderilemedi: ${error.message || 'Hata oluştu'}`);
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      return;
    }

    btn.innerHTML = '✓ Sent! / Gönderildi!';
    btn.style.backgroundColor = 'var(--color-teal)';
    btn.style.color = 'white';

    await updateDepotCountBadge();

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      btn.style.backgroundColor = '';
      btn.style.color = '';
    }, 1500);

  } catch (err) {
    console.error("Exception in sendToDepot:", err);
    showDashboardAlert('error', 'Depoya gönderirken hata oluştu.');
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function sendSectionToDepot(event, btn, cardId, sourceType, title, content) {
  return sendToDepot(event, btn, cardId, sourceType, title, content);
}
window.sendSectionToDepot = sendSectionToDepot;

async function loadDepotItems() {
  const depotList = document.getElementById('depot-items-list');
  if (!depotList) return;

  depotList.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 1.5rem;">
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 20px; height: 20px; color: var(--color-teal);">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
      </svg>
    </div>
  `;

  try {
    const { data: items, error } = await supabaseClient
      .from('card_depot')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error loading depot items:", error);
      depotList.innerHTML = '<p style="font-size: 0.8rem; color: var(--color-text-muted);">Failed to load staging items.</p>';
      return;
    }

    updateDepotCountBadge(items.length);

    if (!items || items.length === 0) {
      depotList.innerHTML = `
        <div class="search-empty-state" style="padding: 1.5rem 0.5rem; text-align: center;">
          <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 0.5rem;">Deponuz boş. / Staging depot is empty.</p>
          <a href="#" onclick="const modal = document.getElementById('depot-modal'); if (modal) modal.style.display = 'none'; switchDashboardView('cards');" style="color: var(--color-teal); font-weight: 700; font-size: 0.8rem; text-decoration: underline;">
            Bilgi Kartları'na git ve terimleri, noktaları buraya gönder!
          </a>
        </div>
      `;
      return;
    }

    depotList.innerHTML = '';
    items.forEach(item => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'depot-item-card';
      cardDiv.id = `depot-item-${item.id}`;
      cardDiv.setAttribute('data-study-card-id', item.study_card_id || '');
      cardDiv.setAttribute('data-source-type', item.source_type || '');

      let typeTag = '';
      let displayContentHtml = '';
      const escapedContent = (item.content || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const escapedTitle = (item.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

      if (item.source_type === 'key_term') {
        typeTag = '<span class="depot-item-tag depot-tag-term">Term</span>';
      } else if (item.source_type === 'key_point') {
        typeTag = '<span class="depot-item-tag depot-tag-point">Point</span>';
      } else if (item.source_type === 'table') {
        typeTag = '<span class="depot-item-tag" style="background:#EEF2FF; color:#4F46E5; font-weight:700;">📊 Tablo</span>';
      } else if (item.source_type === 'chart') {
        typeTag = '<span class="depot-item-tag" style="background:#ECFDF5; color:#059669; font-weight:700;">📈 Grafik</span>';
      } else if (item.source_type === 'image') {
        typeTag = '<span class="depot-item-tag" style="background:#FEF3C7; color:#B45309; font-weight:700;">🖼️ Görsel</span>';
      } else {
        typeTag = '<span class="depot-item-tag depot-tag-question">Question</span>';
      }

      if (item.source_type === 'table') {
        try {
          const tableData = JSON.parse(item.content);
          const headers = (tableData.headers || []).slice(0, 4);
          const rows = (tableData.rows || []).slice(0, 3);
          let hHtml = headers.map(h => `<th>${escapeHtml(String(h))}</th>`).join('');
          let rHtml = rows.map(r => `<tr>${(r || []).slice(0, 4).map(c => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('');
          displayContentHtml = `
            <div class="depot-preview-table-wrapper">
              <table class="depot-preview-table">
                <thead><tr>${hHtml}</tr></thead>
                <tbody>${rHtml}</tbody>
              </table>
            </div>
          `;
        } catch (e) {
          displayContentHtml = `<div class="depot-item-text">${escapeHtml(item.content)}</div>`;
        }
      } else if (item.source_type === 'chart') {
        const miniCanvasId = `depot-chart-${item.id}`;
        displayContentHtml = `
          <div class="depot-preview-chart-wrapper">
            <canvas id="${miniCanvasId}"></canvas>
          </div>
        `;
        setTimeout(() => {
          try {
            const chartData = JSON.parse(item.content);
            const canvasEl = document.getElementById(miniCanvasId);
            if (canvasEl) renderChartJs(canvasEl, chartData);
          } catch(e) {}
        }, 60);
      } else if (item.source_type === 'image') {
        displayContentHtml = `
          <div class="depot-preview-image-wrapper" style="text-align: center;">
            <img src="${item.content}" alt="" style="max-width: 100%; max-height: 120px; border-radius: 6px; object-fit: contain;">
          </div>
        `;
      } else {
        const maxTextLen = 140;
        let textVal = item.content || '';
        if (textVal.length > maxTextLen) {
          textVal = textVal.substring(0, maxTextLen) + '...';
        }
        displayContentHtml = `<div class="depot-item-text" title="${(item.content || '').replace(/"/g, '&quot;')}">${escapeHtml(textVal)}</div>`;
      }

      cardDiv.innerHTML = `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
          ${typeTag}
          <button class="depot-item-close" onclick="deleteDepotItem(event, '${item.id}')" title="Depodan Sil (Discard)">✕</button>
        </div>
        ${item.title ? `<div class="depot-item-title">${escapeHtml(item.title)}</div>` : ''}
        ${displayContentHtml}
        <div class="depot-item-actions">
          <button class="btn btn-primary" onclick="pasteDepotItem(event, '${item.id}', '${escapedTitle}', '${escapedContent}')" style="font-size: 0.7rem !important; padding: 0.25rem 0.5rem !important; min-height: auto !important; border: none; font-weight: 700;">
            📌 Deftere Yapıştır
          </button>
        </div>
      `;
      depotList.appendChild(cardDiv);
    });

  } catch (err) {
    console.error("Exception loading depot items:", err);
  }
}

async function deleteDepotItem(event, itemId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  try {
    const { error } = await supabaseClient
      .from('card_depot')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error("Error discarding depot item:", error);
      showDashboardAlert('error', 'Depodan silinemedi. / Failed to discard.');
      return;
    }

    const card = document.getElementById(`depot-item-${itemId}`);
    if (card) card.remove();

    await updateDepotCountBadge();

    const depotList = document.getElementById('depot-items-list');
    if (depotList && depotList.children.length === 0) {
      depotList.innerHTML = `
        <div class="search-empty-state" style="padding: 1.5rem 0.5rem; text-align: center;">
          <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 0.5rem;">Deponuz boş. / Staging depot is empty.</p>
          <a href="#" onclick="const modal = document.getElementById('depot-modal'); if (modal) modal.style.display = 'none'; switchDashboardView('cards');" style="color: var(--color-teal); font-weight: 700; font-size: 0.8rem; text-decoration: underline;">
            Bilgi Kartları'na git ve terimleri, noktaları buraya gönder!
          </a>
        </div>
      `;
    }

  } catch (err) {
    console.error("Exception discarding depot item:", err);
  }
}

async function pasteDepotItem(event, itemId, title, content) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const cardEl = document.getElementById(`depot-item-${itemId}`);
  let studyCardId = '';
  let sourceType = '';
  if (cardEl) {
    studyCardId = cardEl.getAttribute('data-study-card-id') || '';
    sourceType = cardEl.getAttribute('data-source-type') || '';
  }

  if (sourceType === 'table') {
    try {
      const tableData = JSON.parse(content);
      insertAiTableCanvasElement(tableData, title);
    } catch (e) {
      addDepotStickyNoteToCanvas(studyCardId, title, content);
    }
  } else if (sourceType === 'chart') {
    try {
      const chartData = JSON.parse(content);
      insertAiChartCanvasElement(chartData, title);
    } catch (e) {
      addDepotStickyNoteToCanvas(studyCardId, title, content);
    }
  } else if (sourceType === 'image') {
    insertImageElement(content, 120, 120, 260, 200);
  } else {
    addDepotStickyNoteToCanvas(studyCardId, title, content);
  }

  try {
    const { error } = await supabaseClient
      .from('card_depot')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error("Error deleting placed depot item:", error);
    }
  } catch (err) {
    console.error("Exception removing placed depot item:", err);
  }

  if (cardEl) cardEl.remove();

  await updateDepotCountBadge();

  const depotList = document.getElementById('depot-items-list');
  if (depotList && depotList.children.length === 0) {
    depotList.innerHTML = `
      <div class="search-empty-state" style="padding: 1.5rem 0.5rem; text-align: center;">
        <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 0.5rem;">Deponuz boş. / Staging depot is empty.</p>
        <a href="#" onclick="const modal = document.getElementById('depot-modal'); if (modal) modal.style.display = 'none'; switchDashboardView('cards');" style="color: var(--color-teal); font-weight: 700; font-size: 0.8rem; text-decoration: underline;">
          Bilgi Kartları'na git ve terimleri, noktaları buraya gönder!
        </a>
      </div>
    `;
  }
}

function addDepotStickyNoteToCanvas(cardId, title, content) {
  const overlay = document.getElementById('notebook-overlay-container');
  if (!overlay) return;

  const id = 'note-' + Date.now();
  const rotation = Math.floor(Math.random() * 7) - 3; // -3 to +3 deg
  
  const rect = overlay.getBoundingClientRect();
  const noteWidth = 220;
  const noteHeight = 150;
  const centerX = (rect.width > noteWidth) ? (rect.width - noteWidth) / 2 : 50;
  const centerY = (rect.height > noteHeight) ? (rect.height - noteHeight) / 2 : 50;
  
  const offset = (overlay.children.length * 20) % 200;
  const x = centerX + offset;
  const y = centerY + offset;

  const note = document.createElement('div');
  note.className = 'draggable-element draggable-note';
  note.id = id;
  note.style.left = `${x}px`;
  note.style.top = `${y}px`;
  note.style.transform = `rotate(${rotation}deg)`;
  note.setAttribute('data-type', 'sticky');
  note.setAttribute('data-card-id', cardId || '');
  note.setAttribute('data-rotation', rotation);

  const formattedContent = content.replace(/\n/g, '<br>');

  note.innerHTML = `
    <button class="delete-overlay-btn" title="Remove Sticky Note" onclick="removeOverlayElement('${id}')">×</button>
    <div class="draggable-note-title" style="font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${title}</div>
    <div class="draggable-note-text" style="max-height: 180px; overflow-y: auto; padding-right: 2px; font-size: 0.75rem;">${formattedContent}</div>
    <div class="draggable-note-footer">Acadex Depot Card</div>
  `;

  note.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-overlay-btn') || e.target.closest('.delete-overlay-btn')) return;
    if (!cardId) {
      showDashboardAlert('info', 'This sticky note was created from the depot and is not linked to a study card.');
      return;
    }
    const card = notebookCards.find(c => c.id === cardId) || libraryCards.find(c => c.id === cardId);
    if (card) {
      const fileName = card.documents?.file_name || 'Document';
      viewStudyCard(card.document_id, fileName, false, cardId);
    } else {
      showDashboardAlert('error', 'The study card for this note has been deleted.');
    }
  });

  overlay.appendChild(note);
  makeElementDraggable(note);
}

function insertAiTableCanvasElement(tableData, title, left, top, width, height, id) {
  const overlay = document.getElementById('notebook-overlay-container');
  if (!overlay) return;

  const elementId = id || 'ai-table-' + Date.now();
  const elWidth = width || 380;
  const elHeight = height || 220;

  const rect = overlay.getBoundingClientRect();
  const posX = left !== undefined ? left : ((rect.width > elWidth) ? (rect.width - elWidth) / 2 : 50);
  const posY = top !== undefined ? top : ((rect.height > elHeight) ? (rect.height - elHeight) / 2 : 50);

  const wrapper = document.createElement('div');
  wrapper.className = 'draggable-element draggable-ai-table-wrapper';
  wrapper.id = elementId;
  wrapper.style.left = `${posX}px`;
  wrapper.style.top = `${posY}px`;
  wrapper.style.width = `${elWidth}px`;
  wrapper.style.height = `${elHeight}px`;
  wrapper.setAttribute('data-type', 'ai_table');
  wrapper.setAttribute('data-table-title', title || 'Table');
  wrapper.setAttribute('data-table-json', typeof tableData === 'string' ? tableData : JSON.stringify(tableData));

  const parsed = typeof tableData === 'string' ? JSON.parse(tableData) : tableData;
  const headers = parsed.headers || [];
  const rows = parsed.rows || [];

  let headersHtml = headers.map(h => `<th>${escapeHtml(String(h))}</th>`).join('');
  let rowsHtml = rows.map(r => `<tr>${(r || []).map(c => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('');

  wrapper.innerHTML = `
    <div class="drag-handle-bar" style="background: var(--color-navy); color: #fff; padding: 0.25rem 0.5rem; font-size: 0.725rem; font-weight: 700; display: flex; justify-content: space-between; align-items: center; cursor: move;">
      <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;">${escapeHtml(title || parsed.title || 'Table')}</span>
      <button class="delete-overlay-btn" title="Delete Table" onclick="removeOverlayElement('${elementId}')" style="background: none; border: none; color: #fff; font-size: 1rem; cursor: pointer; line-height: 1;">×</button>
    </div>
    <div class="table-content-area">
      <table class="ai-extracted-table">
        <thead><tr>${headersHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;

  overlay.appendChild(wrapper);
  makeElementDraggable(wrapper, wrapper.querySelector('.drag-handle-bar'));

  const resizer = document.createElement('div');
  resizer.className = 'table-resizer';
  resizer.innerHTML = `
    <svg width="10" height="10" viewBox="0 0 10 10" style="position: absolute; bottom: 1px; right: 1px; pointer-events: none;">
      <path d="M10 0 L0 10 M10 4 L4 10 M10 8 L8 10" stroke="#94A3B8" stroke-width="1.5"/>
    </svg>
  `;
  wrapper.appendChild(resizer);
  makeElementResizable(wrapper, resizer);
  notebookHasUnsavedChanges = true;
}

function insertAiChartCanvasElement(chartData, title, left, top, width, height, id) {
  const overlay = document.getElementById('notebook-overlay-container');
  if (!overlay) return;

  const elementId = id || 'ai-chart-' + Date.now();
  const elWidth = width || 380;
  const elHeight = height || 260;

  const rect = overlay.getBoundingClientRect();
  const posX = left !== undefined ? left : ((rect.width > elWidth) ? (rect.width - elWidth) / 2 : 50);
  const posY = top !== undefined ? top : ((rect.height > elHeight) ? (rect.height - elHeight) / 2 : 50);

  const wrapper = document.createElement('div');
  wrapper.className = 'draggable-element draggable-ai-chart-wrapper';
  wrapper.id = elementId;
  wrapper.style.left = `${posX}px`;
  wrapper.style.top = `${posY}px`;
  wrapper.style.width = `${elWidth}px`;
  wrapper.style.height = `${elHeight}px`;
  wrapper.setAttribute('data-type', 'ai_chart');
  wrapper.setAttribute('data-chart-title', title || 'Chart');
  wrapper.setAttribute('data-chart-json', typeof chartData === 'string' ? chartData : JSON.stringify(chartData));

  const parsed = typeof chartData === 'string' ? JSON.parse(chartData) : chartData;
  const canvasId = `canvas-${elementId}`;

  wrapper.innerHTML = `
    <div class="drag-handle-bar" style="background: var(--color-navy); color: #fff; padding: 0.25rem 0.5rem; font-size: 0.725rem; font-weight: 700; display: flex; justify-content: space-between; align-items: center; cursor: move;">
      <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;">${escapeHtml(title || parsed.title || 'Chart')}</span>
      <button class="delete-overlay-btn" title="Delete Chart" onclick="removeOverlayElement('${elementId}')" style="background: none; border: none; color: #fff; font-size: 1rem; cursor: pointer; line-height: 1;">×</button>
    </div>
    <div class="chart-content-area" style="position: relative; width: 100%; height: calc(100% - 28px); padding: 0.25rem;">
      <canvas id="${canvasId}"></canvas>
    </div>
  `;

  overlay.appendChild(wrapper);
  makeElementDraggable(wrapper, wrapper.querySelector('.drag-handle-bar'));

  const resizer = document.createElement('div');
  resizer.className = 'table-resizer';
  resizer.innerHTML = `
    <svg width="10" height="10" viewBox="0 0 10 10" style="position: absolute; bottom: 1px; right: 1px; pointer-events: none;">
      <path d="M10 0 L0 10 M10 4 L4 10 M10 8 L8 10" stroke="#94A3B8" stroke-width="1.5"/>
    </svg>
  `;
  wrapper.appendChild(resizer);
  makeElementResizable(wrapper, resizer);

  // Render Chart.js
  setTimeout(() => {
    const canvasEl = document.getElementById(canvasId);
    if (canvasEl) renderChartJs(canvasEl, parsed);
  }, 60);

  notebookHasUnsavedChanges = true;
}
window.insertAiTableCanvasElement = insertAiTableCanvasElement;
window.insertAiChartCanvasElement = insertAiChartCanvasElement;

// ==========================================
// ANIMATED FLASHCARD MODAL CONTROLLERS (PHASE 11)
// ==========================================
let reviewItems = [];
let reviewIndex = 0;
let reviewCardId = '';
let reviewType = '';
let reviewFileName = '';

/**
 * Adaptive spaced-repetition review for one study card.
 * Prioritises: due items (next_review_at <= now) → never reviewed → low ease_factor.
 * Mixes terms, cloze, quiz into one queue.
 */
async function openAdaptiveReview(cardId, fileName) {
  const card = libraryCards.find(c => c.id === cardId) || notebookCards.find(c => c.id === cardId) || currentActiveStudyCard;
  if (!card) {
    showDashboardAlert('error', 'Study card not found.');
    return;
  }

  // Build candidate pool
  const pool = [];
  (card.key_terms || []).forEach((t, i) => pool.push({ ...t, _kind: 'term', _key: getReviewItemKey(t, 'terms', i) }));
  (card.cloze_cards || []).forEach((c, i) => pool.push({ ...c, _kind: 'cloze', _key: getReviewItemKey(c, 'cloze', i) }));
  (card.quiz_questions || []).forEach((q, i) => pool.push({ ...q, _kind: 'quiz', _key: getReviewItemKey(q, 'quiz', i) }));

  if (pool.length === 0) {
    showDashboardAlert('info', 'Bu kartta çalışılacak madde yok.');
    return;
  }

  // Load confidence rows for this card
  let confMap = {};
  try {
    if (currentUser?.id) {
      const { data } = await supabaseClient
        .from('card_item_confidence')
        .select('item_key, next_review_at, ease_factor, repetitions, interval_days')
        .eq('user_id', currentUser.id)
        .eq('study_card_id', cardId);
      (data || []).forEach(r => { confMap[r.item_key] = r; });
    }
  } catch (e) {
    console.warn('Could not load confidence rows:', e);
  }

  const now = Date.now();
  const scored = pool.map(item => {
    const conf = confMap[item._key];
    const nextAt = conf?.next_review_at ? new Date(conf.next_review_at).getTime() : 0;
    const isDue = !conf || nextAt <= now;
    const neverSeen = !conf;
    const ease = Number(conf?.ease_factor) || 2.5;
    // Lower score = higher priority
    let score = 1000;
    if (neverSeen) score = 0;
    else if (isDue) score = 10 + ease; // weaker first among due
    else score = 500 + (nextAt - now) / 86400000; // future items last
    return { item, score, isDue, neverSeen };
  });

  scored.sort((a, b) => a.score - b.score);
  // Prefer due + never-seen; cap session size
  const session = scored.filter(s => s.isDue || s.neverSeen).slice(0, 30);
  const items = (session.length > 0 ? session : scored.slice(0, 20)).map(s => s.item);

  // Stash on a temporary card-like object for openFlashcardViewer
  card._adaptiveItems = items;
  openFlashcardViewer(cardId, 'adaptive', fileName);
}
window.openAdaptiveReview = openAdaptiveReview;

function openFlashcardViewer(cardId, type, fileName) {
  const card = libraryCards.find(c => c.id === cardId) || notebookCards.find(c => c.id === cardId) || currentActiveStudyCard;
  if (!card) {
    showDashboardAlert('error', 'Study card not found.');
    return;
  }

  if (type === 'terms') {
    reviewItems = card.key_terms || [];
  } else if (type === 'points') {
    reviewItems = card.key_points || [];
  } else if (type === 'quiz') {
    reviewItems = card.quiz_questions || [];
  } else if (type === 'cloze') {
    reviewItems = card.cloze_cards || [];
  } else if (type === 'adaptive') {
    // Adaptive: mix due/weak items — built by openAdaptiveReview
    reviewItems = card._adaptiveItems || [];
  }

  const titleEl = document.getElementById('flashcard-modal-title');
  if (titleEl) {
    const labels = {
      terms: 'Anahtar Terimler',
      points: 'Önemli Noktalar',
      quiz: 'Kendi Kendine Test',
      cloze: 'Boşluk Doldurma',
      adaptive: 'Akıllı Tekrar (Spaced)'
    };
    titleEl.textContent = `${fileName} - ${labels[type] || type}`;
  }

  if (!reviewItems || reviewItems.length === 0) {
    showDashboardAlert('info', 'Bu kategoriye ait kart bulunmamaktadır. / No items in this section.');
    return;
  }

  reviewIndex = 0;
  reviewCardId = cardId;
  reviewType = type;
  reviewFileName = fileName;

  const footer = document.querySelector('.flashcard-viewer-footer');
  const progress = document.getElementById('flashcard-progress');
  if (progress) progress.style.display = 'block';
  if (footer) footer.style.display = 'flex';

  const modal = document.getElementById('flashcard-modal');
  if (modal) {
    modal.style.display = 'flex';
  }

  const btnClose = document.getElementById('btn-close-flashcard-modal');
  if (btnClose) {
    btnClose.onclick = (e) => {
      e.preventDefault();
      closeFlashcardViewer();
    };
  }

  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        closeFlashcardViewer();
      }
    };
  }

  renderCurrentFlashcard();
}

function renderCurrentFlashcard() {
  const cardEl = document.getElementById('flashcard-card');
  const progressText = document.getElementById('flashcard-progress-text');
  const progressBarFill = document.getElementById('flashcard-progress-bar-fill');
  if (!cardEl || reviewIndex >= reviewItems.length) return;

  const item = reviewItems[reviewIndex];
  const currentNum = reviewIndex + 1;
  const totalNum = reviewItems.length;
  const progressPercent = Math.round((currentNum / totalNum) * 100);

  if (progressText) progressText.textContent = `Kart ${currentNum} / ${totalNum}`;
  if (progressBarFill) progressBarFill.style.width = `${progressPercent}%`;

  let firstPillText = 'SORU';
  let firstPillBg = '#DDF4F7';
  let firstPillColor = '#1F8A93';
  let firstContentText = '';

  let secondPillText = '';
  let secondPillBg = '#DCFCE7';
  let secondPillColor = '#16A34A';
  let secondContentText = '';

  if (reviewType === 'quiz' || (reviewType === 'adaptive' && item._kind === 'quiz')) {
    firstPillText = 'SORU';
    firstContentText = item.question || '';
    secondPillText = 'CEVAP';
    secondContentText = item.answer || '';
  } else if (reviewType === 'cloze' || (reviewType === 'adaptive' && item._kind === 'cloze')) {
    firstPillText = 'BOŞLUK DOLDUR';
    firstContentText = item.prompt || '';
    secondPillText = 'CEVAP';
    secondContentText = item.answer || '';
  } else if (reviewType === 'terms' || (reviewType === 'adaptive' && item._kind === 'term')) {
    firstPillText = 'TERİM';
    firstContentText = item.term || '';
    secondPillText = 'TANIM';
    secondContentText = item.definition || '';
  } else if (reviewType === 'points' || (reviewType === 'adaptive' && item._kind === 'point')) {
    firstPillText = 'ÖNEMLİ NOKTA';
    firstContentText = typeof item === 'string' ? item : (item.point || item.text || item.prompt || '');
    secondPillText = item.answer ? 'CEVAP' : '';
    secondContentText = item.answer || '';
  }

  const hasSecondBlock = Boolean(secondPillText && secondContentText);

  cardEl.innerHTML = `
    <!-- Top edge full-width gradient bar -->
    <div style="position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #16325C, #1F8A93); border-top-left-radius: 24px; border-top-right-radius: 24px;"></div>
    
    <!-- Top right close button -->
    <button class="modal-close" id="btn-close-flashcard-modal" aria-label="Close viewer" onclick="closeFlashcardViewer()" style="position: absolute; top: 16px; right: 16px; z-index: 10; background: rgba(22, 50, 92, 0.08); border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 18px; line-height: 1; cursor: pointer; color: #16325C; transition: background 0.2s;">&times;</button>
    
    <div class="card-inner-content" style="width: 100%; display: flex; flex-direction: column; text-align: left; padding-top: 0.5rem;">
      <!-- First Block -->
      <div style="margin-bottom: ${hasSecondBlock ? '0.25rem' : '1.25rem'};">
        <span style="background: ${firstPillBg}; color: ${firstPillColor}; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; display: inline-block; margin-bottom: 12px;">${firstPillText}</span>
        <h3 style="font-size: 24px; font-weight: 800; color: #16325C; line-height: 1.35; margin: 0; font-family: 'Outfit', var(--font-primary), sans-serif;">${escapeHtml(firstContentText)}</h3>
      </div>

      ${hasSecondBlock ? `
        <!-- Thin horizontal divider -->
        <div style="border-top: 1px solid #E5EAEE; margin: 18px 0; width: 100%;"></div>

        <!-- Second Block -->
        <div style="margin-bottom: 0.75rem;">
          <span style="background: ${secondPillBg}; color: ${secondPillColor}; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; display: inline-block; margin-bottom: 10px;">${secondPillText}</span>
          <p style="font-size: 17px; font-weight: 400; color: #374151; line-height: 1.6; margin: 0;">${escapeHtml(secondContentText)}</p>
        </div>
      ` : ''}

      <!-- Source reference row -->
      <div style="border-top: 1px solid #F1F5F9; margin-top: 1.25rem; padding-top: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; width: 100%;">
        <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 13px; color: #94A3B8; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          <span style="overflow: hidden; text-overflow: ellipsis;">${escapeHtml(reviewFileName || 'Ders Notu')}</span>
        </div>
        <button onclick="sendCurrentCardToDepot(this)" title="Defter Depoma Gönder" style="background: rgba(31, 138, 147, 0.08); color: #1F8A93; border: 1px solid rgba(31, 138, 147, 0.2); border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-weight: 700; transition: all 0.2s ease; flex-shrink: 0;">
          📥 Depoya Gönder
        </button>
      </div>
    </div>
  `;

  const btnClose = document.getElementById('btn-close-flashcard-modal');
  if (btnClose) {
    btnClose.onclick = (e) => {
      e.preventDefault();
      closeFlashcardViewer();
    };
  }
}

/**
 * Simplified SM-2 spaced repetition.
 * rating: 'again' | 'hard' | 'good' | 'easy'
 */
function computeSm2(prev, rating) {
  let ef = Number(prev?.ease_factor) || 2.5;
  let interval = Number(prev?.interval_days) || 0;
  let reps = Number(prev?.repetitions) || 0;
  let lapses = Number(prev?.lapses) || 0;

  if (rating === 'again') {
    reps = 0;
    lapses += 1;
    interval = 0.01; // ~15 min
    ef = Math.max(1.3, ef - 0.2);
  } else if (rating === 'hard') {
    interval = reps === 0 ? 0.5 : Math.max(1, interval * 1.2);
    reps += 1;
    ef = Math.max(1.3, ef - 0.15);
  } else if (rating === 'good') {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 3;
    else interval = Math.round(interval * ef * 10) / 10;
    reps += 1;
  } else if (rating === 'easy') {
    if (reps === 0) interval = 2;
    else if (reps === 1) interval = 5;
    else interval = Math.round(interval * ef * 1.3 * 10) / 10;
    reps += 1;
    ef = ef + 0.15;
  }

  ef = Math.round(Math.min(3.0, Math.max(1.3, ef)) * 100) / 100;
  interval = Math.min(365, Math.max(0.01, interval));
  const next = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);
  return {
    ease_factor: ef,
    interval_days: interval,
    repetitions: reps,
    lapses,
    next_review_at: next.toISOString(),
    last_rating: rating,
    rating
  };
}

function getReviewItemKey(item, type, index) {
  if (type === 'terms') return `term:${item.term || index}`;
  if (type === 'quiz') return `quiz:${(item.question || '').slice(0, 80) || index}`;
  if (type === 'cloze') return `cloze:${item.id || item.answer || index}`;
  if (type === 'points') {
    const text = typeof item === 'string' ? item : (item.point || item.text || '');
    return `point:${text.slice(0, 80) || index}`;
  }
  return `item:${index}`;
}

async function handleConfidenceRating(rating) {
  try {
    if (reviewCardId && reviewItems[reviewIndex] && currentUser?.id) {
      const item = reviewItems[reviewIndex];
      const itemKey = getReviewItemKey(item, reviewType, reviewIndex);

      let prev = null;
      try {
        const { data } = await supabaseClient
          .from('card_item_confidence')
          .select('ease_factor, interval_days, repetitions, lapses')
          .eq('user_id', currentUser.id)
          .eq('study_card_id', reviewCardId)
          .eq('item_key', itemKey)
          .maybeSingle();
        prev = data;
      } catch (_e) { /* first review */ }

      const sm2 = computeSm2(prev, rating);

      await supabaseClient
        .from('card_item_confidence')
        .upsert({
          user_id: currentUser.id,
          study_card_id: reviewCardId,
          item_key: itemKey,
          card_type: reviewType === 'points' ? 'point' : (reviewType || 'term'),
          rating: sm2.rating,
          last_rating: sm2.last_rating,
          ease_factor: sm2.ease_factor,
          interval_days: sm2.interval_days,
          repetitions: sm2.repetitions,
          lapses: sm2.lapses,
          next_review_at: sm2.next_review_at,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,study_card_id,item_key' });
    }
  } catch (e) {
    console.warn('Confidence / SM-2 record failed:', e);
  }

  nextFlashcard();
}
window.handleConfidenceRating = handleConfidenceRating;
window.computeSm2 = computeSm2;

function nextFlashcard() {
  if (reviewIndex >= reviewItems.length - 1) {
    const cardEl = document.getElementById('flashcard-card');
    if (cardEl) {
      cardEl.classList.add('slide-out-left');
      setTimeout(() => {
        cardEl.classList.remove('slide-out-left');
        reviewIndex++;
        renderEndOfDeck();
      }, 300);
    }
    return;
  }

  animateNextCard(() => {
    reviewIndex++;
    renderCurrentFlashcard();
  });
}

function animateNextCard(nextItemCallback) {
  const cardEl = document.getElementById('flashcard-card');
  if (!cardEl) return;
  
  cardEl.classList.add('slide-out-left');
  
  setTimeout(() => {
    nextItemCallback();
    
    cardEl.style.transition = 'none';
    cardEl.classList.remove('slide-out-left');
    cardEl.classList.add('slide-in-right');
    
    cardEl.offsetHeight;
    
    cardEl.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease';
    cardEl.classList.remove('slide-in-right');
  }, 300);
}

async function sendCurrentCardToDepot(btn) {
  if (reviewIndex >= reviewItems.length) return;
  const item = reviewItems[reviewIndex];

  let title = '';
  let content = '';

  if (reviewType === 'terms') {
    title = item.term;
    content = item.definition;
  } else if (reviewType === 'points') {
    title = 'Key Point';
    content = typeof item === 'string' ? item : (item.point || item.text || '');
  } else if (reviewType === 'quiz') {
    title = 'Self-Test Q&A';
    content = `Question: ${item.question}\nAnswer: ${item.answer}`;
  }

  const originalHtml = btn ? btn.innerHTML : '📥 Depoya Gönder';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Gönderiliyor...';
  }

  try {
    const { error } = await supabaseClient
      .from('card_depot')
      .insert({
        user_id: currentUser.id,
        source_type: reviewType === 'terms' ? 'key_term' : (reviewType === 'points' ? 'key_point' : 'quiz_question'),
        title: title,
        content: content,
        study_card_id: reviewCardId
      });

    if (error) {
      console.error(error);
      showDashboardAlert('error', 'Depoya gönderilemedi. / Failed to send.');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
      return;
    }

    if (btn) {
      btn.innerHTML = '✓ Gönderildi!';
      btn.style.backgroundColor = 'var(--color-teal)';
      btn.style.color = 'white';
    }

    await updateDepotCountBadge();

    setTimeout(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        btn.style.backgroundColor = '';
        btn.style.color = '';
      }
    }, 1200);

  } catch (e) {
    console.error(e);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

function renderEndOfDeck() {
  const cardEl = document.getElementById('flashcard-card');
  const footer = document.querySelector('.flashcard-viewer-footer');
  const progressText = document.getElementById('flashcard-progress-text');
  const progressBarFill = document.getElementById('flashcard-progress-bar-fill');
  
  if (progressText) progressText.textContent = `Kart ${reviewItems.length} / ${reviewItems.length}`;
  if (progressBarFill) progressBarFill.style.width = '100%';
  if (footer) footer.style.display = 'none';

  if (cardEl) {
    cardEl.innerHTML = `
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #16325C, #1F8A93); border-top-left-radius: 24px; border-top-right-radius: 24px;"></div>
      <div class="card-inner-content" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 1rem 0;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
        <h3 style="font-size: 1.5rem; color: #16325C; font-weight: 800; margin: 0 0 0.5rem 0;">Tüm kartları incelediniz!</h3>
        <p style="font-size: 0.95rem; color: #4A5A6A; margin: 0 0 1.5rem 0;">Reviewed all ${reviewItems.length} cards!</p>
        <div style="display: flex; gap: 1rem; width: 100%; max-width: 320px;">
          <button class="btn btn-outline" onclick="restartReview()" style="flex: 1; padding: 0.55rem 1rem; border-radius: 30px; font-weight: 700;">Tekrar İncele</button>
          <button class="btn btn-primary" onclick="closeFlashcardViewer()" style="flex: 1; padding: 0.55rem 1rem; border-radius: 30px; border: none; font-weight: 700;">Kapat</button>
        </div>
      </div>
    `;
  }
}

function restartReview() {
  reviewIndex = 0;
  
  const footer = document.querySelector('.flashcard-viewer-footer');
  const footerEl = document.querySelector('.flashcard-viewer-footer');
  if (footerEl) footerEl.style.display = 'flex';

  renderCurrentFlashcard();
}

function closeFlashcardViewer() {
  const modal = document.getElementById('flashcard-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Add Escape key handler to close active modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeFlashcardViewer();
    const depotModal = document.getElementById('depot-modal');
    if (depotModal) depotModal.style.display = 'none';
  }
});

window.initDepotModalListeners = initDepotModalListeners;
window.updateDepotCountBadge = updateDepotCountBadge;
window.sendToDepot = sendToDepot;
window.loadDepotItems = loadDepotItems;
window.deleteDepotItem = deleteDepotItem;
window.pasteDepotItem = pasteDepotItem;
window.addDepotStickyNoteToCanvas = addDepotStickyNoteToCanvas;

window.openFlashcardViewer = openFlashcardViewer;
window.restartReview = restartReview;
window.closeFlashcardViewer = closeFlashcardViewer;

// ==========================================
// CROSS-DOCUMENT KNOWLEDGE GRAPH (MADDE 4)
// ==========================================
let _kgData = null; // { concepts: Map-like array, edges, cardIndex }

function normalizeConceptKey(label) {
  return String(label || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a unified concept graph across all study cards.
 * Merges concept_graph nodes/edges + key_terms by normalized label.
 */
function buildCrossDocumentKnowledgeGraph(cards) {
  const conceptMap = new Map(); // key -> { label, cards: Set, count }
  const edgeSet = new Map(); // "fromKey|toKey|rel" -> edge
  const cardMeta = {};

  (cards || []).forEach(card => {
    const cardId = card.id;
    const docName = card.documents?.file_name || card.file_name || 'Untitled';
    cardMeta[cardId] = {
      id: cardId,
      name: docName,
      course_tag: card.course_tag || card.suggested_course_tag || null,
      document_id: card.document_id
    };

    const touch = (label, source) => {
      const key = normalizeConceptKey(label);
      if (!key || key.length < 2) return null;
      if (!conceptMap.has(key)) {
        conceptMap.set(key, { key, label: String(label).trim(), cardIds: new Set(), sources: new Set(), count: 0 });
      }
      const c = conceptMap.get(key);
      c.cardIds.add(cardId);
      c.sources.add(source);
      c.count = c.cardIds.size;
      return key;
    };

    // From concept_graph
    const g = card.concept_graph || {};
    const idToKey = {};
    (g.nodes || []).forEach(n => {
      const k = touch(n.label, 'graph');
      if (k && n.id) idToKey[n.id] = k;
    });
    (g.edges || []).forEach(e => {
      const fk = idToKey[e.from] || normalizeConceptKey(e.from);
      const tk = idToKey[e.to] || normalizeConceptKey(e.to);
      if (!fk || !tk || fk === tk) return;
      const rel = e.relation || 'related_to';
      const ek = `${fk}|${tk}|${rel}`;
      if (!edgeSet.has(ek)) edgeSet.set(ek, { from: fk, to: tk, relation: rel });
    });

    // From key_terms
    (card.key_terms || []).forEach(t => touch(t.term, 'term'));
  });

  const concepts = Array.from(conceptMap.values())
    .map(c => ({
      key: c.key,
      label: c.label,
      count: c.count,
      cardIds: Array.from(c.cardIds),
      sources: Array.from(c.sources)
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const edges = Array.from(edgeSet.values());

  return { concepts, edges, cardMeta };
}

function openKnowledgeGraphModal() {
  const modal = document.getElementById('knowledge-graph-modal');
  if (!modal) return;
  if (!libraryCards || libraryCards.length === 0) {
    showDashboardAlert('info', 'Önce kütüphanede en az bir çalışma kartı olmalı.');
    return;
  }

  _kgData = buildCrossDocumentKnowledgeGraph(libraryCards);
  const stats = document.getElementById('kg-stats');
  if (stats) {
    stats.textContent = `${_kgData.concepts.length} kavram · ${_kgData.edges.length} ilişki · ${libraryCards.length} kart`;
  }

  const search = document.getElementById('kg-search-input');
  if (search) search.value = '';
  renderKnowledgeGraphUI('');
  modal.style.display = 'flex';
}

function closeKnowledgeGraphModal() {
  const modal = document.getElementById('knowledge-graph-modal');
  if (modal) modal.style.display = 'none';
}

function filterKnowledgeGraph(query) {
  renderKnowledgeGraphUI(query || '');
}

function renderKnowledgeGraphUI(query) {
  if (!_kgData) return;
  const q = normalizeConceptKey(query);
  const concepts = q
    ? _kgData.concepts.filter(c => c.key.includes(q) || c.label.toLowerCase().includes(query.toLowerCase()))
    : _kgData.concepts;

  // Concept list
  const listEl = document.getElementById('kg-concept-list');
  if (listEl) {
    if (concepts.length === 0) {
      listEl.innerHTML = '<div style="color:var(--color-text-muted);font-size:0.85rem;">Eşleşen kavram yok.</div>';
    } else {
      listEl.innerHTML = concepts.slice(0, 80).map(c => `
        <button type="button" onclick="selectKnowledgeConcept('${c.key.replace(/'/g, "\\'")}')"
          style="text-align:left; padding:0.45rem 0.65rem; border-radius:8px; border:1px solid rgba(22,50,92,0.1); background:#fff; cursor:pointer; font-size:0.85rem;">
          <strong style="color:var(--color-navy);">${escapeHtml(c.label)}</strong>
          <span style="float:right; color:var(--color-teal); font-weight:700;">${c.count} kart</span>
        </button>
      `).join('');
    }
  }

  // Mermaid: top cross-document concepts (appear in 2+ cards) + their edges
  const topKeys = new Set(
    concepts.filter(c => c.count >= 2).slice(0, 18).map(c => c.key)
  );
  // If few multi-card concepts, fill with top overall
  if (topKeys.size < 8) {
    concepts.slice(0, 12).forEach(c => topKeys.add(c.key));
  }

  const keyToId = {};
  let i = 0;
  topKeys.forEach(k => { keyToId[k] = 'C' + (i++); });

  let mmd = 'graph LR\n';
  topKeys.forEach(k => {
    const c = _kgData.concepts.find(x => x.key === k);
    if (!c) return;
    const label = c.label.replace(/"/g, "'").slice(0, 28);
    const badge = c.count > 1 ? ` (${c.count})` : '';
    mmd += `  ${keyToId[k]}["${label}${badge}"]\n`;
  });
  _kgData.edges.forEach(e => {
    if (topKeys.has(e.from) && topKeys.has(e.to)) {
      const rel = String(e.relation || '').replace(/"/g, "'").slice(0, 16);
      mmd += `  ${keyToId[e.from]} -->|"${rel}"| ${keyToId[e.to]}\n`;
    }
  });

  const box = document.getElementById('kg-mermaid-box');
  if (box) {
    box.innerHTML = '<div style="color:var(--color-text-muted);font-size:0.85rem;">Graf yükleniyor…</div>';
    setTimeout(async () => {
      if (!window.mermaid) {
        box.innerHTML = `<pre style="font-size:0.7rem;white-space:pre-wrap;">${escapeHtml(mmd)}</pre>`;
        return;
      }
      try {
        const { svg } = await window.mermaid.render('kg-mmd-' + Date.now(), mmd);
        box.innerHTML = svg;
      } catch (err) {
        console.warn('KG Mermaid failed', err);
        box.innerHTML = `<pre style="font-size:0.7rem;white-space:pre-wrap;">${escapeHtml(mmd)}</pre>`;
      }
    }, 40);
  }

  // Clear selection panel if filtering
  const rel = document.getElementById('kg-related-cards');
  if (rel && !q) rel.innerHTML = 'Bir kavram seçin.';
}

function selectKnowledgeConcept(conceptKey) {
  if (!_kgData) return;
  const concept = _kgData.concepts.find(c => c.key === conceptKey);
  const rel = document.getElementById('kg-related-cards');
  if (!rel || !concept) return;

  const cards = concept.cardIds
    .map(id => _kgData.cardMeta[id])
    .filter(Boolean);

  // Also show neighboring concepts
  const neighbors = _kgData.edges
    .filter(e => e.from === conceptKey || e.to === conceptKey)
    .map(e => {
      const otherKey = e.from === conceptKey ? e.to : e.from;
      const other = _kgData.concepts.find(c => c.key === otherKey);
      return other ? `${other.label} (${e.relation})` : null;
    })
    .filter(Boolean);

  rel.innerHTML = `
    <div style="margin-bottom:0.5rem; font-weight:700; color:var(--color-navy);">${escapeHtml(concept.label)}</div>
    ${cards.map(c => `
      <button type="button" onclick="closeKnowledgeGraphModal(); viewStudyCardFromLibrary('${c.id}')"
        style="display:block; width:100%; text-align:left; padding:0.5rem 0.65rem; margin-bottom:0.35rem; border-radius:8px; border:1px solid rgba(22,50,92,0.1); background:#fff; cursor:pointer; font-size:0.82rem;">
        📄 ${escapeHtml(c.name)}
        ${c.course_tag ? `<span style="color:var(--color-teal); font-size:0.75rem;"> · ${escapeHtml(c.course_tag)}</span>` : ''}
      </button>
    `).join('') || '<div style="color:var(--color-text-muted);">Kart bulunamadı.</div>'}
    ${neighbors.length ? `<div style="margin-top:0.75rem; font-size:0.8rem; color:var(--color-text-muted);"><strong>Bağlı kavramlar:</strong> ${neighbors.map(n => escapeHtml(n)).join(', ')}</div>` : ''}
  `;
}

/** Open a library card's study modal by id */
async function viewStudyCardFromLibrary(cardId) {
  const card = libraryCards.find(c => c.id === cardId);
  if (!card) {
    showDashboardAlert('error', 'Kart bulunamadı.');
    return;
  }
  const docName = card.documents?.file_name || 'Document';
  const docId = card.document_id;
  if (typeof viewStudyCard === 'function') {
    await viewStudyCard(docId, docName, false, cardId);
  } else if (typeof viewStudyCardWrapper === 'function') {
    // fallback
    await populateStudyCardModalDetails(card, docName, false);
    const modal = document.getElementById('study-card-modal');
    if (modal) modal.style.display = 'flex';
  }
}

/**
 * Find study cards related to the given card via shared concepts.
 * Returns [{ card, sharedLabels, score }]
 */
function findRelatedStudyCards(cardId, limit = 6) {
  const cards = libraryCards || [];
  const source = cards.find(c => c.id === cardId);
  if (!source || cards.length < 2) return [];

  const sourceKeys = new Set();
  (source.concept_graph?.nodes || []).forEach(n => {
    const k = normalizeConceptKey(n.label);
    if (k) sourceKeys.add(k);
  });
  (source.key_terms || []).forEach(t => {
    const k = normalizeConceptKey(t.term);
    if (k) sourceKeys.add(k);
  });
  if (sourceKeys.size === 0) return [];

  const results = [];
  cards.forEach(other => {
    if (other.id === cardId) return;
    const shared = [];
    (other.concept_graph?.nodes || []).forEach(n => {
      const k = normalizeConceptKey(n.label);
      if (k && sourceKeys.has(k)) shared.push(n.label);
    });
    (other.key_terms || []).forEach(t => {
      const k = normalizeConceptKey(t.term);
      if (k && sourceKeys.has(k) && !shared.some(s => normalizeConceptKey(s) === k)) {
        shared.push(t.term);
      }
    });
    if (shared.length > 0) {
      results.push({
        card: other,
        sharedLabels: shared.slice(0, 5),
        score: shared.length
      });
    }
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function populateRelatedCardsSection(cardId) {
  const section = document.getElementById('study-card-related-section');
  const container = document.getElementById('study-card-related-container');
  if (!section || !container) return;

  const related = findRelatedStudyCards(cardId, 6);
  if (related.length === 0) {
    section.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = related.map(r => {
    const name = r.card.documents?.file_name || 'Untitled';
    const tags = r.sharedLabels.map(l => escapeHtml(l)).join(', ');
    return `
      <button type="button"
        onclick="viewStudyCardFromLibrary('${r.card.id}')"
        style="text-align:left; padding:0.6rem 0.75rem; border-radius:10px; border:1px solid rgba(22,50,92,0.1); background:#fff; cursor:pointer; width:100%;">
        <div style="font-weight:700; color:var(--color-navy); font-size:0.9rem;">📄 ${escapeHtml(name)}</div>
        <div style="font-size:0.78rem; color:var(--color-text-muted); margin-top:0.2rem;">Ortak: ${tags}</div>
      </button>
    `;
  }).join('');
}

window.openKnowledgeGraphModal = openKnowledgeGraphModal;
window.closeKnowledgeGraphModal = closeKnowledgeGraphModal;
window.filterKnowledgeGraph = filterKnowledgeGraph;
window.selectKnowledgeConcept = selectKnowledgeConcept;
window.viewStudyCardFromLibrary = viewStudyCardFromLibrary;
window.findRelatedStudyCards = findRelatedStudyCards;
window.buildCrossDocumentKnowledgeGraph = buildCrossDocumentKnowledgeGraph;

// ==========================================
// GELISTIRICI SANDBOX CONTROLLERS (PHASE 10)
// ==========================================
function loadDeveloperSandbox() {
  const modal = document.getElementById('share-project-modal');
  const btnShare = document.getElementById('btn-share-project');
  const btnClose = document.getElementById('btn-close-share-project-modal');
  const btnCancel = document.getElementById('btn-cancel-share-project');
  const form = document.getElementById('share-project-form');

  if (btnShare && modal) {
    btnShare.onclick = (e) => {
      e.preventDefault();
      form.reset();
      modal.style.display = 'flex';
    };
  }

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  if (btnClose) btnClose.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;

  // Escape key close project share modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const title = document.getElementById('project-title').value.trim();
      const description = document.getElementById('project-desc').value.trim();
      const githubUrl = document.getElementById('project-github').value.trim();
      const liveUrl = document.getElementById('project-live').value.trim();

      if (!title || !description) return;

      // Clear previous error messages
      const ghErrorEl = document.getElementById('github-url-error');
      const liveErrorEl = document.getElementById('live-url-error');
      if (ghErrorEl) { ghErrorEl.style.display = 'none'; ghErrorEl.textContent = ''; }
      if (liveErrorEl) { liveErrorEl.style.display = 'none'; liveErrorEl.textContent = ''; }

      let hasError = false;

      function validateAndGetURL(str) {
        if (!str) return null;
        let formatted = str;
        if (!/^https?:\/\//i.test(str)) {
          formatted = 'https://' + str;
        }
        try {
          const url = new URL(formatted);
          if (url.hostname.includes('.')) {
            return url.href;
          }
          return null;
        } catch (_) {
          return null;
        }
      }

      let parsedGithub = null;
      if (githubUrl) {
        parsedGithub = validateAndGetURL(githubUrl);
        if (!parsedGithub) {
          if (ghErrorEl) {
            ghErrorEl.textContent = 'Invalid URL format / Geçersiz URL';
            ghErrorEl.style.display = 'block';
          }
          hasError = true;
        }
      }

      let parsedLive = null;
      if (liveUrl) {
        parsedLive = validateAndGetURL(liveUrl);
        if (!parsedLive) {
          if (liveErrorEl) {
            liveErrorEl.textContent = 'Invalid URL format / Geçersiz URL';
            liveErrorEl.style.display = 'block';
          }
          hasError = true;
        }
      }

      if (hasError) return;

      try {
        const { error } = await supabaseClient
          .from('sandbox_projects')
          .insert({
            user_id: currentUser.id,
            title: title,
            description: description,
            github_url: parsedGithub,
            live_url: parsedLive
          });

        if (error) {
          console.error("Error sharing sandbox project:", error);
          showDashboardAlert('error', 'Proje paylaşılamadı. / Failed to share project.');
          return;
        }

        showDashboardAlert('success', 'Projeniz paylaşıldı! / Project shared successfully!');
        closeModal();
        await checkAndAwardSandboxProject();
        await loadSandboxProjects();
      } catch (err) {
        console.error("Exception sharing project:", err);
      }
    };
  }

  loadSandboxProjects();
}

async function loadSandboxProjects() {
  const grid = document.getElementById('sandbox-projects-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 2rem; grid-column: 1 / -1;">
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 32px; height: 32px; color: var(--color-teal);">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
      </svg>
    </div>
  `;

  try {
    const { data: projects, error } = await supabaseClient
      .from('sandbox_projects')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(sandboxProjectsLimit);

    if (error) {
      console.error("Error fetching sandbox projects:", error);
      grid.innerHTML = `<p style="color: var(--color-text-muted); grid-column: 1 / -1;">Projeler yüklenemedi. / Failed to load projects.</p>`;
      return;
    }

    if (!projects || projects.length === 0) {
      grid.innerHTML = `
        <div class="search-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
          <p style="color: var(--color-text-muted); font-size: 0.9rem;">Henüz paylaşılan proje yok. İlk paylaşan siz olun!</p>
          <p style="font-size: 0.8rem; color: var(--color-text-muted);">No projects shared yet — be the first! Share your GitHub project or Vercel deployment with the whole Acadex community.</p>
        </div>
      `;
      return;
    }

    // Fetch submitter profiles client-side
    const userIds = [...new Set(projects.map(p => p.user_id))];
    const { data: profiles, error: profError } = await supabaseClient
      .from('profiles')
      .select('id, full_name, department, avatar_url')
      .in('id', userIds);

    const profileMap = {};
    profiles?.forEach(p => {
      profileMap[p.id] = {
        full_name: p.full_name || 'Anonymous Student',
        department: p.department || 'General Faculty',
        avatar_url: p.avatar_url || null
      };
    });

    grid.innerHTML = '';
    projects.forEach(proj => {
      const author = profileMap[proj.user_id] || { full_name: 'Anonymous Student', department: 'General Faculty' };
      const deptClass = getDepartmentColorClass(author.department);
      const deptShort = getDepartmentShortName(author.department);
      
      const createdDate = new Date(proj.created_at).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      const card = document.createElement('div');
      card.className = 'doc-card';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.justifyContent = 'space-between';
      card.style.position = 'relative';
      card.style.gap = '0.5rem';

      // Render Delete Button if current student is the owner
      let deleteBtnHtml = '';
      if (proj.user_id === currentUser.id) {
        deleteBtnHtml = `
          <button onclick="deleteSandboxProject('${proj.id}')" style="background: none; border: none; cursor: pointer; color: #EF4444; position: absolute; top: 0.75rem; right: 0.75rem; display: flex; align-items: center; justify-content: center; padding: 0.25rem; border-radius: var(--radius-sm); transition: background-color 0.2s;" title="Projeyi Sil (Delete)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        `;
      }

      card.innerHTML = `
        <div style="padding-right: 1.5rem;">
          <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--color-navy); margin-bottom: 0.25rem; word-break: break-word;">${proj.title}</h4>
          
          <div style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.7rem; color: var(--color-text-muted); margin-bottom: 0.5rem; flex-wrap: wrap;">
            ${renderUserAvatarHtml(author, 18)}
            <span>By: <strong>${author.full_name}</strong></span>
            <span class="dept-badge ${deptClass}" style="padding: 0.1rem 0.35rem; font-size: 0.55rem; font-weight: 800;">${deptShort}</span>
          </div>

          <p style="font-size: 0.8rem; color: var(--color-text); line-height: 1.4; margin-bottom: 0.5rem; word-break: break-word;">${proj.description}</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.35rem; border-top: 1px solid rgba(22, 50, 92, 0.08); padding-top: 0.5rem; margin-top: auto;">
          <div style="display: flex; gap: 0.35rem;">
            ${proj.github_url ? `
              <a href="${proj.github_url}" target="_blank" class="btn btn-outline" style="flex: 1; text-align: center; font-size: 0.7rem; padding: 0.3rem 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                GitHub
              </a>
            ` : ''}
            ${proj.live_url ? `
              <a href="${proj.live_url}" target="_blank" class="btn btn-primary" style="flex: 1; text-align: center; font-size: 0.7rem; padding: 0.3rem 0.5rem; border: none; display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                Live Demo
              </a>
            ` : ''}
          </div>
          <span style="font-size: 0.65rem; color: var(--color-text-muted); text-align: right; display: block; margin-top: 0.15rem;">Paylaşım: ${createdDate}</span>
        </div>
        ${deleteBtnHtml}
      `;
      grid.appendChild(card);
    });

    if (projects.length === sandboxProjectsLimit) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'btn btn-outline';
      loadMoreBtn.id = 'btn-load-more-sandbox';
      loadMoreBtn.textContent = 'Load More / Daha Fazla Yükle';
      loadMoreBtn.style.gridColumn = '1 / -1';
      loadMoreBtn.style.margin = '2rem auto';
      loadMoreBtn.style.padding = '0.6rem 1.5rem';
      loadMoreBtn.style.fontSize = '0.85rem';
      loadMoreBtn.style.display = 'block';
      
      loadMoreBtn.addEventListener('click', async () => {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';
        sandboxProjectsLimit += 20;
        await loadSandboxProjects();
      });
      
      grid.appendChild(loadMoreBtn);
    }

  } catch (err) {
    console.error("Exception loading sandbox projects:", err);
  }
}

async function deleteSandboxProject(projectId) {
  const isTr = localStorage.getItem('acadexUILang') === 'tr';
  const title = isTr ? "Projeyi Sil" : "Delete Project";
  const text = isTr 
    ? "Bu projeyi galeriden kaldırmak istediğinize emin misiniz?" 
    : "Are you sure you want to delete this project?";

  showConfirmModal(title, text, async () => {
    try {
      const { error } = await supabaseClient
        .from('sandbox_projects')
        .delete()
        .eq('id', projectId);

      if (error) {
        console.error("Error deleting sandbox project:", error);
        showDashboardAlert('error', 'Proje silinemedi. / Failed to delete project.');
        return;
      }

      showDashboardAlert('success', 'Proje başarıyla silindi. / Project deleted.');
      await loadSandboxProjects();

    } catch (err) {
      console.error("Exception deleting sandbox project:", err);
      showDashboardAlert('error', 'Proje silinirken hata oluştu.');
    }
  });
}

// ==========================================
// POMODORO WIDGET CONTROLLERS (PHASE 10)
// ==========================================
let ambientAudioCtx = null;
let ambientGainNode = null;
let ambientOscillators = [];
let ambientLfoNode = null;

function playPomodoroDing() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.5);

    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.6);
    }, 350);
    
  } catch (e) {
    console.error("Web Audio API error during completion ring:", e);
  }
}

function initAmbientTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    ambientAudioCtx = new AudioContext();
    ambientGainNode = ambientAudioCtx.createGain();
    
    const baseFreq = 110;
    const freqs = [baseFreq, baseFreq * 1.5, baseFreq * 2.005];
    
    const filter = ambientAudioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 350;
    
    freqs.forEach((freq, idx) => {
      const osc = ambientAudioCtx.createOscillator();
      osc.type = idx === 1 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      
      const oscGain = ambientAudioCtx.createGain();
      oscGain.gain.value = 0.15;
      
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      ambientOscillators.push(osc);
    });
    
    ambientLfoNode = ambientAudioCtx.createOscillator();
    ambientLfoNode.frequency.value = 0.15;
    
    const lfoGain = ambientAudioCtx.createGain();
    lfoGain.gain.value = 0.08;
    
    ambientLfoNode.connect(lfoGain);
    
    ambientGainNode.gain.value = 0.12; 
    lfoGain.connect(ambientGainNode.gain);
    ambientLfoNode.start();
    
    filter.connect(ambientGainNode);
    ambientGainNode.connect(ambientAudioCtx.destination);
    
    const volSlider = document.getElementById('pomodoro-sound-volume');
    if (volSlider) {
      updateAmbientVolume(volSlider.value);
    }
    
  } catch (e) {
    console.error("Web Audio API error during ambient init:", e);
  }
}

function updateAmbientVolume(val) {
  if (!ambientGainNode || !ambientAudioCtx) return;
  const scale = parseFloat(val);
  if (!isNaN(scale)) {
    ambientGainNode.gain.setValueAtTime(ambientGainNode.gain.value, ambientAudioCtx.currentTime);
    ambientGainNode.gain.linearRampToValueAtTime(0.12 * scale, ambientAudioCtx.currentTime + 0.1);
  }
}

function stopAmbientTone() {
  if (!ambientAudioCtx) return;
  
  try {
    if (ambientGainNode) {
      ambientGainNode.gain.setValueAtTime(ambientGainNode.gain.value, ambientAudioCtx.currentTime);
      ambientGainNode.gain.linearRampToValueAtTime(0, ambientAudioCtx.currentTime + 0.5);
    }
    
    setTimeout(() => {
      ambientOscillators.forEach(osc => {
        try { osc.stop(); } catch(e){}
      });
      ambientOscillators = [];
      
      if (ambientLfoNode) {
        try { ambientLfoNode.stop(); } catch(e){}
        ambientLfoNode = null;
      }
      
      if (ambientAudioCtx && ambientAudioCtx.state !== 'closed') {
        ambientAudioCtx.close();
      }
      ambientAudioCtx = null;
      ambientGainNode = null;
    }, 550);
    
  } catch (e) {
    console.error("Web Audio API error during fade out:", e);
    ambientOscillators = [];
    ambientAudioCtx = null;
  }
}

function initPomodoroWidget() {
  const btnToggle = document.getElementById('btn-pomodoro-toggle');
  const panel = document.getElementById('pomodoro-panel');
  const btnClose = document.getElementById('btn-close-pomodoro-panel');
  
  const timerDisplay = document.getElementById('pomodoro-timer-display');
  const btnStart = document.getElementById('btn-pomodoro-start');
  const btnPause = document.getElementById('btn-pomodoro-pause');
  const btnReset = document.getElementById('btn-pomodoro-reset');
  const modeSelect = document.getElementById('pomodoro-mode-select');
  
  const dimToggle = document.getElementById('pomodoro-dim-toggle');
  const dimOverlay = document.getElementById('pomodoro-dim-overlay');
  
  const soundToggle = document.getElementById('pomodoro-sound-toggle');
  const soundVolume = document.getElementById('pomodoro-sound-volume');
  const sessionCount = document.getElementById('pomodoro-session-count');

  if (!btnToggle || !panel) return;

  btnToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (panel.style.display === 'none') {
      panel.style.display = 'flex';
      btnToggle.style.transform = 'scale(0.95)';
    } else {
      panel.style.display = 'none';
      btnToggle.style.transform = 'none';
    }
  });

  if (btnClose) {
    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      panel.style.display = 'none';
      btnToggle.style.transform = 'none';
    });
  }

  let timeLeft = 25 * 60;
  let timerInterval = null;
  let currentMode = 'focus';
  let focusSessions = 0;

  const updateDisplay = () => {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    if (timerInterval) return;
    
    btnStart.disabled = true;
    btnPause.disabled = false;
    modeSelect.disabled = true;
    
    timerInterval = setInterval(() => {
      if (timeLeft > 0) {
        timeLeft--;
        updateDisplay();
      } else {
        clearInterval(timerInterval);
        timerInterval = null;
        btnStart.disabled = false;
        btnPause.disabled = true;
        modeSelect.disabled = false;
        
        playPomodoroDing();
        
        if (currentMode === 'focus') {
          focusSessions++;
          sessionCount.textContent = focusSessions;
          
          showDashboardAlert('success', 'Focus session completed! Nice work! Take a break. 🎉');
          
          currentMode = 'break';
          modeSelect.value = 'break';
          timeLeft = 5 * 60;
        } else {
          showDashboardAlert('info', 'Break over! Back to focus! 🎯');
          
          currentMode = 'focus';
          modeSelect.value = 'focus';
          timeLeft = 25 * 60;
        }
        updateDisplay();
      }
    }, 1000);
  };

  const pauseTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      btnStart.disabled = false;
      btnPause.disabled = true;
    }
  };

  const resetTimer = () => {
    pauseTimer();
    modeSelect.disabled = false;
    currentMode = modeSelect.value;
    timeLeft = currentMode === 'focus' ? 25 * 60 : 5 * 60;
    updateDisplay();
  };

  btnStart.addEventListener('click', startTimer);
  btnPause.addEventListener('click', pauseTimer);
  btnReset.addEventListener('click', resetTimer);

  modeSelect.addEventListener('change', () => {
    currentMode = modeSelect.value;
    timeLeft = currentMode === 'focus' ? 25 * 60 : 5 * 60;
    updateDisplay();
  });

  dimToggle.addEventListener('change', () => {
    if (dimToggle.checked) {
      dimOverlay.style.display = 'block';
    } else {
      dimOverlay.style.display = 'none';
    }
  });

  soundToggle.addEventListener('change', () => {
    if (soundToggle.checked) {
      initAmbientTone();
    } else {
      stopAmbientTone();
    }
  });

  soundVolume.addEventListener('input', (e) => {
    updateAmbientVolume(e.target.value);
  });
}

window.loadDeveloperSandbox = loadDeveloperSandbox;
window.loadSandboxProjects = loadSandboxProjects;
window.deleteSandboxProject = deleteSandboxProject;
window.initPomodoroWidget = initPomodoroWidget;
window.playPomodoroDing = playPomodoroDing;

// ==========================================
// PORTAL OVERVIEW / ANA SAYFA (PHASE 11)
// ==========================================
async function loadDashboardHome() {
  const greetingEl = document.getElementById('home-welcome-greeting');
  if (!greetingEl) return;

  const isTr = (localStorage.getItem('acadexUILang') || 'tr') === 'tr';

  if (currentUserProfile) {
    const displayName = currentUserProfile.full_name || currentUser.email.split('@')[0];
    const firstName = displayName.split(' ')[0];
    greetingEl.textContent = isTr ? `Tekrar hoş geldin, ${firstName}!` : `Welcome back, ${firstName}!`;
  }

  // Display home avatar
  const homeAvatar = document.getElementById('home-user-avatar');
  if (homeAvatar && currentUserProfile) {
    homeAvatar.innerHTML = renderUserAvatarHtml(currentUserProfile, 48);
  }

  try {
    const { count: docsCount } = await supabaseClient
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .neq('status', 'failed');

    const { count: cardsCount } = await supabaseClient
      .from('study_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id);

    const { data: examsData } = await supabaseClient
      .from('exams')
      .select('grade, question_results, completed_at')
      .eq('user_id', currentUser.id)
      .not('completed_at', 'is', null);

    const examsCount = examsData ? examsData.length : 0;
    let avgGrade = '—';
    if (examsCount > 0) {
      const sum = examsData.reduce((acc, curr) => acc + (curr.grade || 0), 0);
      avgGrade = Math.round(sum / examsCount).toString();
    }

    document.getElementById('home-stat-docs').textContent = docsCount || 0;
    document.getElementById('home-stat-cards').textContent = cardsCount || 0;
    document.getElementById('home-stat-exams').textContent = examsCount || 0;
    document.getElementById('home-stat-avg-grade').textContent = avgGrade;

    // Load exam date reminders banners (Part E)
    await loadHomeExamBanners();

    await loadRecentActivity();
    await renderStreakAndAchievements();
    renderWeakTopicsPanel(examsData || []);
  } catch (err) {
    console.error("Error loading home stats:", err);
  }
}

// ==========================================
// Weak Topics / Focus Panel (concept-level analysis)
// ==========================================
function renderWeakTopicsPanel(examsData) {
  const card = document.getElementById('home-weak-topics-card');
  const list = document.getElementById('home-weak-topics-list');
  if (!card || !list) return;

  const isTr = (localStorage.getItem('acadexUILang') || 'tr') === 'tr';

  const conceptStats = {};
  (examsData || []).forEach(exam => {
    (exam.question_results || []).forEach(res => {
      const concept = (res.concept || '').trim();
      if (!concept) return;
      if (!conceptStats[concept]) conceptStats[concept] = { totalScore: 0, count: 0 };
      conceptStats[concept].totalScore += (typeof res.score === 'number' ? res.score : 0);
      conceptStats[concept].count += 1;
    });
  });

  const concepts = Object.keys(conceptStats).map(concept => ({
    concept,
    avgScore: Math.round(conceptStats[concept].totalScore / conceptStats[concept].count),
    count: conceptStats[concept].count
  }));

  const weakest = concepts.sort((a, b) => a.avgScore - b.avgScore).slice(0, 5);

  if (weakest.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'flex';
  list.innerHTML = '';

  weakest.forEach(item => {
    const barColor = item.avgScore >= 70 ? 'var(--color-teal)' : (item.avgScore >= 40 ? '#F59E0B' : '#EF4444');
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; flex-direction: column; gap: 0.3rem;';
    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
        <span style="font-weight: 700; color: var(--color-navy);">${item.concept}</span>
        <span style="font-weight: 800; color: ${barColor};">${item.avgScore}/100 <span style="font-weight: 500; color: var(--color-text-muted); font-size: 0.72rem;">(${item.count} ${isTr ? 'soru' : 'questions'})</span></span>
      </div>
      <div style="background: rgba(22, 50, 92, 0.08); border-radius: 10px; height: 6px; overflow: hidden;">
        <div style="width: ${Math.max(item.avgScore, 4)}%; height: 100%; background: ${barColor}; border-radius: 10px;"></div>
      </div>
    `;
    list.appendChild(row);
  });
}

async function loadRecentActivity() {
  const activityList = document.getElementById('home-recent-activity-list');
  if (!activityList) return;

  const isTr = (localStorage.getItem('acadexUILang') || 'tr') === 'tr';

  activityList.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 1rem;">
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 24px; height: 24px; color: var(--color-teal);">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
      </svg>
    </div>
  `;

  try {
    const [docsRes, cardsRes, examsRes] = await Promise.all([
      supabaseClient
        .from('documents')
        .select('file_name, uploaded_at')
        .eq('user_id', currentUser.id)
        .order('uploaded_at', { ascending: false })
        .limit(5),
      supabaseClient
        .from('study_cards')
        .select('id, created_at, summary_style, documents(file_name)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseClient
        .from('exams')
        .select('id, score, created_at, study_cards(documents(file_name))')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    const docs = docsRes.data;
    const cards = cardsRes.data;
    const exams = examsRes.data;

    const merged = [];

    docs?.forEach(d => {
      merged.push({
        type: 'document',
        title: isTr ? `Yüklendi: ${d.file_name}` : `Uploaded: ${d.file_name}`,
        timestamp: new Date(d.uploaded_at),
        icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>'
      });
    });

    cards?.forEach(c => {
      const styleName = getStyleLabel(c.summary_style);
      const docName = c.documents?.file_name || (isTr ? 'belge' : 'document');
      merged.push({
        type: 'card',
        title: isTr ? `${styleName} stilinde ${docName} için çalışma kartı oluşturuldu` : `Created a ${styleName} study card for ${docName}`,
        timestamp: new Date(c.created_at),
        icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>'
      });
    });

    exams?.forEach(e => {
      const docName = e.study_cards?.documents?.file_name || (isTr ? 'çalışma kartı' : 'study card');
      merged.push({
        type: 'exam',
        title: isTr ? `${docName} üzerine bir deneme sınavı tamamlandı (${e.score || 0}/100)` : `Completed a practice exam (${e.score || 0}/100) on ${docName}`,
        timestamp: new Date(e.created_at),
        icon: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>'
      });
    });

    merged.sort((a, b) => b.timestamp - a.timestamp);
    const top5 = merged.slice(0, 5);

    if (top5.length === 0) {
      activityList.innerHTML = `<p style="font-size: 0.8rem; color: var(--color-text-muted); text-align: center; padding: 1rem;">${isTr ? 'Henüz son aktivite yok. Bir belge yükleyerek başlayın!' : 'No recent activity yet. Start by uploading a document!'}</p>`;
      return;
    }

    activityList.innerHTML = '';
    top5.forEach(act => {
      const locale = isTr ? 'tr-TR' : 'en-US';
      const friendlyTime = act.timestamp.toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '0.75rem';
      row.style.padding = '0.5rem';
      row.style.backgroundColor = 'var(--color-bg)';
      row.style.borderRadius = 'var(--radius-sm)';
      row.style.fontSize = '0.8rem';
      row.style.border = '1px solid rgba(22, 50, 92, 0.04)';

      row.innerHTML = `
        <div style="background-color: var(--color-teal-light); color: var(--color-teal); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${act.icon}
          </svg>
        </div>
        <div style="flex-grow: 1; min-width: 0;">
          <p style="margin: 0; font-weight: 700; color: var(--color-navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${act.title}</p>
          <span style="font-size: 0.65rem; color: var(--color-text-muted);">${friendlyTime}</span>
        </div>
      `;
      activityList.appendChild(row);
    });

  } catch (err) {
    console.error("Error loading recent activity:", err);
  }
}

// ==========================================
// NOTIFICATION SYSTEM CONTROLLERS (PHASE 11)
//
// Consolidates every "something happened since you last checked" signal
// into one feed: new shared study cards from your department, announcements
// (school-wide or your department), newly unlocked achievements, and exams
// your hoca has left review feedback on. Each source is fetched
// independently and fails soft — if one table/column isn't there yet (e.g.
// a pending migration hasn't been run), that source is just skipped instead
// of breaking the whole bell.
// ==========================================
async function gatherNotificationItems(lastCheck) {
  const items = [];

  // 1. New shared study cards in your department
  try {
    const { data: cards, error } = await supabaseClient
      .from('study_cards')
      .select('*, documents(file_name)')
      .eq('department', currentUserProfile.department)
      .eq('is_shared', true)
      .neq('user_id', currentUser.id)
      .gt('shared_at', lastCheck)
      .order('shared_at', { ascending: false });
    if (!error && cards) {
      cards.forEach(c => {
        const docName = escapeHtml(c.documents?.file_name || 'study card');
        items.push({
          time: c.shared_at,
          title: 'New Study Card Shared',
          subtitle: `A classmate shared a study card for: ${docName}`,
          onClick: () => switchDashboardView('feed')
        });
      });
    }
  } catch (err) {
    console.error('gatherNotificationItems (shared cards) error:', err);
  }

  // 2. Announcements — school-wide (audience_department null) or yours
  try {
    const { data: anns, error } = await supabaseClient
      .from('announcements')
      .select('*')
      .eq('active', true)
      .gt('created_at', lastCheck)
      .order('created_at', { ascending: false });
    if (!error && anns) {
      anns
        .filter(a => !a.audience_department || a.audience_department === currentUserProfile.department)
        .forEach(a => {
          items.push({
            time: a.created_at,
            title: `📢 ${escapeHtml(a.title)}`,
            subtitle: escapeHtml(a.body),
            onClick: () => switchDashboardView('home')
          });
        });
    }
  } catch (err) {
    console.error('gatherNotificationItems (announcements) error:', err);
  }

  // 3. Newly unlocked achievements
  try {
    const { data: earned, error } = await supabaseClient
      .from('user_achievements')
      .select('achievement_id, created_at')
      .eq('user_id', currentUser.id)
      .gt('created_at', lastCheck)
      .order('created_at', { ascending: false });
    if (!error && earned) {
      earned.forEach(e => {
        const meta = (window.ACHIEVEMENTS_LOOKUP || {})[e.achievement_id];
        items.push({
          time: e.created_at,
          title: `${meta?.icon || '🏆'} Achievement Unlocked: ${meta?.title || e.achievement_id}`,
          subtitle: meta?.desc || '',
          onClick: () => switchDashboardView('home')
        });
      });
    }
  } catch (err) {
    console.error('gatherNotificationItems (achievements) error:', err);
  }

  // 4. Exams your hoca has left feedback on
  try {
    const { data: reviewed, error } = await supabaseClient
      .from('exams')
      .select('id, teacher_note, teacher_reviewed_at, study_cards(documents(file_name))')
      .eq('user_id', currentUser.id)
      .eq('teacher_reviewed', true)
      .gt('teacher_reviewed_at', lastCheck)
      .order('teacher_reviewed_at', { ascending: false });
    if (!error && reviewed) {
      reviewed.forEach(e => {
        const topic = escapeHtml(e.study_cards?.documents?.file_name || 'a recent exam');
        items.push({
          time: e.teacher_reviewed_at,
          title: '📝 Your Hoca Reviewed Your Exam',
          subtitle: e.teacher_note ? `"${escapeHtml(e.teacher_note)}" — ${topic}` : `Feedback added on: ${topic}`,
          onClick: () => switchDashboardView('exams')
        });
      });
    }
  } catch (err) {
    console.error('gatherNotificationItems (exam reviews) error:', err);
  }

  items.sort((a, b) => new Date(b.time) - new Date(a.time));
  return items;
}

async function checkNotifications() {
  if (!currentUserProfile) return;
  const lastCheck = currentUserProfile.last_notification_check || new Date(0).toISOString();

  try {
    const items = await gatherNotificationItems(lastCheck);
    const badge = document.getElementById('notification-badge');
    if (badge) badge.style.display = items.length > 0 ? 'block' : 'none';
  } catch (err) {
    console.error("Error checking notifications:", err);
  }
}

async function toggleNotificationsDropdown() {
  const dropdown = document.getElementById('notification-dropdown');
  const badge = document.getElementById('notification-badge');
  if (!dropdown) return;

  if (dropdown.style.display === 'none') {
    dropdown.style.display = 'flex';

    const list = document.getElementById('notification-list');
    if (list) {
      list.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 1rem;">
          <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 20px; height: 20px; color: var(--color-teal);">
            <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
          </svg>
        </div>
      `;

      const lastCheck = currentUserProfile.last_notification_check || new Date(0).toISOString();

      try {
        const items = await gatherNotificationItems(lastCheck);

        if (items.length === 0) {
          list.innerHTML = `<p style="font-size: 0.75rem; color: var(--color-text-muted); text-align: center; padding: 0.5rem; font-weight: 600;">You're all caught up! / Catch up! Yeni bildiriminiz yok.</p>`;
        } else {
          list.innerHTML = '';
          items.forEach(n => {
            const friendlyTime = new Date(n.time).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });

            const item = document.createElement('a');
            item.href = '#';
            item.style.display = 'block';
            item.style.padding = '0.5rem';
            item.style.backgroundColor = 'var(--color-bg)';
            item.style.borderRadius = 'var(--radius-sm)';
            item.style.fontSize = '0.75rem';
            item.style.textDecoration = 'none';
            item.style.color = 'var(--color-navy)';
            item.style.border = '1px solid rgba(22, 50, 92, 0.05)';
            item.style.transition = 'background-color 0.2s';

            item.innerHTML = `
              <div style="font-weight: 700; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.15rem;">
                <span>${n.title}</span>
                <span style="font-weight: 500; font-size: 0.65rem; color: var(--color-text-muted);">${friendlyTime}</span>
              </div>
              <p style="margin: 0; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${n.subtitle || ''}</p>
            `;

            item.onclick = (e) => {
              e.preventDefault();
              dropdown.style.display = 'none';
              if (typeof n.onClick === 'function') n.onClick();
            };

            list.appendChild(item);
          });
        }

        const nowStr = new Date().toISOString();
        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({ last_notification_check: nowStr })
          .eq('id', currentUser.id);

        if (!updateError) {
          currentUserProfile.last_notification_check = nowStr;
          if (badge) badge.style.display = 'none';
        }

      } catch (err) {
        console.error("Error displaying notifications:", err);
      }
    }
  } else {
    dropdown.style.display = 'none';
  }
}

// ==========================================
// BULK ACTIONS SYSTEM (PHASE 11)
// ==========================================
let selectedDocIds = [];

function handleDocCheckboxClick(event) {
  event.stopPropagation();
  const docId = event.target.dataset.docId;
  
  if (event.target.checked) {
    if (!selectedDocIds.includes(docId)) {
      selectedDocIds.push(docId);
    }
  } else {
    selectedDocIds = selectedDocIds.filter(id => id !== docId);
  }

  updateBulkDeleteBar();
}

function updateBulkDeleteBar() {
  const bar = document.getElementById('bulk-delete-bar');
  const countEl = document.getElementById('bulk-delete-count');
  const summarizeBtn = document.getElementById('btn-bulk-summarize');
  const mergeBtn = document.getElementById('btn-bulk-merge');
  const compareBtn = document.getElementById('btn-bulk-compare');
  
  if (!bar || !countEl) return;

  if (selectedDocIds.length > 0) {
    bar.style.display = 'flex';
    countEl.textContent = `${selectedDocIds.length} selected`;

    const unsummarizedSelected = activeDocuments.filter(d => 
      selectedDocIds.includes(d.id) && (d.status === 'uploaded' || d.status === 'failed')
    );

    if (summarizeBtn) {
      if (unsummarizedSelected.length >= 2) {
        summarizeBtn.style.display = 'inline-block';
      } else {
        summarizeBtn.style.display = 'none';
      }
    }

    // Show merge button when 2+ docs of any status are selected
    if (mergeBtn) {
      mergeBtn.style.display = selectedDocIds.length >= 2 ? 'inline-block' : 'none';
    }

    // Show compare button when 2+ docs of any status are selected
    if (compareBtn) {
      compareBtn.style.display = selectedDocIds.length >= 2 ? 'inline-block' : 'none';
    }
  } else {
    bar.style.display = 'none';
    if (summarizeBtn) summarizeBtn.style.display = 'none';
    if (mergeBtn) mergeBtn.style.display = 'none';
    if (compareBtn) compareBtn.style.display = 'none';
  }
}

async function bulkDeleteSelectedDocuments() {
  if (selectedDocIds.length === 0) return;

  const isTr = localStorage.getItem('acadexUILang') === 'tr';
  const title = isTr ? "Seçilenleri Sil" : "Delete Selected";
  const text = isTr 
    ? `Seçilen ${selectedDocIds.length} belgeyi ve bunlara ait tüm özetleri, bilgi kartlarını ve sınav geçmişlerini silmek istediğinize emin misiniz?`
    : `Are you sure you want to delete the selected ${selectedDocIds.length} documents and all their summaries, cards, and exam history?`;

  showConfirmModal(title, text, async () => {
    const deleteBtn = document.getElementById('btn-bulk-delete');
    const cancelBtn = document.getElementById('btn-bulk-cancel');
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting...';
    }
    if (cancelBtn) cancelBtn.disabled = true;

    try {
      const storagePaths = activeDocuments
        .filter(d => selectedDocIds.includes(d.id))
        .map(d => d.storage_path);

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabaseClient.storage
          .from('documents')
          .remove(storagePaths);

        if (storageError) {
          console.error("Bulk Storage delete failed: ", storageError);
          showDashboardAlert('error', 'Could not delete the files from storage. Please try again.');
          resetBulkSelection();
          return;
        }
      }

      const { error: dbError } = await supabaseClient
        .from('documents')
        .delete()
        .in('id', selectedDocIds);

      if (dbError) {
        console.error("Bulk DB row delete failed: ", dbError);
        showDashboardAlert('error', 'Could not delete document records. Please try again.');
        resetBulkSelection();
        return;
      }

      showDashboardAlert('success', 'Selected documents deleted successfully.');
      resetBulkSelection();
      await loadDocuments(); 

    } catch (err) {
      console.error("Exception during bulk deletion: ", err);
      showDashboardAlert('error', 'An error occurred during bulk deletion. Please try again.');
      resetBulkSelection();
    }
  });
}

function resetBulkSelection() {
  selectedDocIds = [];
  updateBulkDeleteBar();
  document.querySelectorAll('.doc-bulk-select-checkbox').forEach(cb => {
    cb.checked = false;
  });
  
  const deleteBtn = document.getElementById('btn-bulk-delete');
  const cancelBtn = document.getElementById('btn-bulk-cancel');
  if (deleteBtn) {
    deleteBtn.disabled = false;
    deleteBtn.textContent = 'Delete Selected';
  }
  if (cancelBtn) cancelBtn.disabled = false;
}

function initPhase11Listeners() {
  const bell = document.getElementById('btn-notification-bell');
  if (bell) {
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotificationsDropdown();
    });
  }

  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown && dropdown.style.display !== 'none' && !dropdown.contains(e.target) && !document.getElementById('btn-notification-bell').contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  const btnBulkDelete = document.getElementById('btn-bulk-delete');
  const btnBulkCancel = document.getElementById('btn-bulk-cancel');
  const btnBulkSummarize = document.getElementById('btn-bulk-summarize');
  const btnExportPdf = document.getElementById('btn-export-pdf');

  if (btnBulkDelete) {
    btnBulkDelete.addEventListener('click', bulkDeleteSelectedDocuments);
  }
  if (btnBulkCancel) {
    btnBulkCancel.addEventListener('click', resetBulkSelection);
  }
  if (btnBulkSummarize) {
    btnBulkSummarize.addEventListener('click', () => {
      const unsummarizedSelected = activeDocuments.filter(d => 
        selectedDocIds.includes(d.id) && (d.status === 'uploaded' || d.status === 'failed')
      );
      if (unsummarizedSelected.length >= 2) {
        isBulkSummarize = true;
        isMergeSummarize = false;
        activeBulkSummarizingDocIds = unsummarizedSelected.map(d => d.id);
        openSummaryStyleModal();
      }
    });
  }
  // Merge & Summarize button (Phase 17)
  const btnBulkMerge = document.getElementById('btn-bulk-merge');
  if (btnBulkMerge) {
    btnBulkMerge.addEventListener('click', () => {
      if (selectedDocIds.length >= 2) {
        pendingMergeDocIds = [...selectedDocIds];
        isMergeSummarize = true;
        isBulkSummarize = false;
        openSummaryStyleModal();
      }
    });
  }

  // Compare Documents button
  const btnBulkCompare = document.getElementById('btn-bulk-compare');
  if (btnBulkCompare) {
    btnBulkCompare.addEventListener('click', openCompareModal);
  }

  const btnStartCompare = document.getElementById('btn-start-compare');
  if (btnStartCompare) {
    btnStartCompare.addEventListener('click', startDocumentComparison);
  }
  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', async (e) => {
      e.preventDefault();
      if (currentActiveStudyCard) {
        const originalText = btnExportPdf.textContent;
        btnExportPdf.disabled = true;
        btnExportPdf.textContent = 'Exporting...';
        try {
          await exportStudyCardToPDF(currentActiveStudyCard);
          showDashboardAlert('success', 'PDF exported successfully!');
        } catch (err) {
          console.error("PDF export failed: ", err);
          showDashboardAlert('error', 'Failed to export study card to PDF. Please try again.');
        } finally {
          btnExportPdf.disabled = false;
          btnExportPdf.textContent = originalText;
        }
      } else {
        showDashboardAlert('error', 'No active study card data found to export.');
      }
    });
  }

  // Exam question count dynamic ranges initialization
  const countInput = document.getElementById('exam-question-count');
  const countHint = document.getElementById('exam-question-count-range-hint');
  const examTypeRadios = document.querySelectorAll('input[name="exam-type"]');
  if (countInput && examTypeRadios.length > 0) {
    const updateRanges = () => {
      const selectedType = document.querySelector('input[name="exam-type"]:checked')?.value || 'classic';
      let minVal = 1, maxVal = 20;
      if (selectedType === 'classic') {
        minVal = 1; maxVal = 20;
      } else if (selectedType === 'test') {
        minVal = 1; maxVal = 50;
      } else if (selectedType === 'mixed') {
        minVal = 1; maxVal = 30;
      }
      countInput.min = minVal;
      countInput.max = maxVal;
      if (countHint) {
        countHint.textContent = `(Range: ${minVal} - ${maxVal})`;
      }
      let val = parseInt(countInput.value, 10);
      if (isNaN(val)) val = 10;
      if (val < minVal) countInput.value = minVal;
      else if (val > maxVal) countInput.value = maxVal;
    };

    examTypeRadios.forEach(radio => {
      radio.addEventListener('change', updateRanges);
    });

    countInput.addEventListener('change', () => {
      let val = parseInt(countInput.value, 10);
      const minVal = parseInt(countInput.min, 10) || 1;
      const maxVal = parseInt(countInput.max, 10) || 20;
      if (isNaN(val)) val = 10;
      if (val < minVal) countInput.value = minVal;
      else if (val > maxVal) countInput.value = maxVal;
    });

    updateRanges();
  }
}

window.loadDashboardHome = loadDashboardHome;
window.loadRecentActivity = loadRecentActivity;
window.checkNotifications = checkNotifications;
window.toggleNotificationsDropdown = toggleNotificationsDropdown;
window.handleDocCheckboxClick = handleDocCheckboxClick;
window.updateBulkDeleteBar = updateBulkDeleteBar;
window.bulkDeleteSelectedDocuments = bulkDeleteSelectedDocuments;
window.resetBulkSelection = resetBulkSelection;
window.initPhase11Listeners = initPhase11Listeners;

// ==========================================================================
// ACADEX PHASE 12: BULK ACTIONS & ACHIEVEMENTS SYSTEM
// ==========================================================================

async function handleMultipleFilesUpload(files) {
  const allowedExtensions = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'txt'];
  const maxSize = 20 * 1024 * 1024;
  const validFiles = [];
  
  for (const file of files) {
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (file.size > maxSize) {
      showDashboardAlert('error', `File ${file.name} size exceeds 20MB limit.`);
      continue;
    }
    if (!allowedExtensions.includes(fileExt)) {
      showDashboardAlert('error', `Unsupported format for ${file.name}.`);
      continue;
    }
    validFiles.push(file);
  }

  if (validFiles.length === 0) return;

  const uploadZone = document.getElementById('upload-zone');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('upload-progress-text');

  if (uploadZone) uploadZone.style.pointerEvents = 'none';
  if (progressContainer) progressContainer.style.display = 'block';
  if (progressText) progressText.style.display = 'block';

  let completedCount = 0;
  const totalCount = validFiles.length;

  const updateUI = (currentFileName) => {
    const percentage = Math.round((completedCount / totalCount) * 100);
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (progressText) {
      progressText.textContent = `Uploading ${completedCount + 1} of ${totalCount}: ${currentFileName}...`;
    }
  };

  let index = 0;
  async function worker() {
    while (index < totalCount) {
      const currentIdx = index++;
      const file = validFiles[currentIdx];
      updateUI(file.name);

      try {
        await uploadSingleFileCore(file);
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        showDashboardAlert('error', `Failed to upload ${file.name}.`);
      }

      completedCount++;
      updateUI(file.name);
    }
  }

  // Run with concurrency 2
  await Promise.all([worker(), worker()]);

  if (progressBar) progressBar.style.width = '100%';
  if (progressText) progressText.textContent = 'All files uploaded successfully!';
  
  await checkAndAwardFirstUpload();

  setTimeout(async () => {
    showDashboardAlert('success', 'All documents processed successfully!');
    resetUploadUI();
    await loadDocuments();
  }, 800);
}

async function uploadSingleFileCore(file) {
  const { shouldUpload, fileHash } = await checkFileHashDuplicate(file);
  if (!shouldUpload) {
    return; // user cancelled this file
  }

  const storagePath = `${currentUser.id}/${Date.now()}_${file.name}`;
  
  const { data, error } = await supabaseClient.storage
    .from('documents')
    .upload(storagePath, file);

  if (error) throw error;

  const { data: insertedDoc, error: dbError } = await supabaseClient
    .from('documents')
    .insert({
      user_id: currentUser.id,
      file_name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type || getMimeTypeFromExtension(file.name),
      status: 'uploaded',
      file_hash: fileHash,
      department: currentUserProfile ? currentUserProfile.department : null
    })
    .select()
    .single();

  if (dbError) {
    await supabaseClient.storage.from('documents').remove([storagePath]);
    throw dbError;
  }

  if (insertedDoc) {
    activeDocuments.unshift(insertedDoc);
    renderDocumentsList();
  }
}

async function proceedWithBulkSummarization(summaryStyle, language, summaryLength, summaryDepth = 'standard') {
  const docIds = [...activeBulkSummarizingDocIds];
  const totalCount = docIds.length;
  let completedCount = 0;
  
  showBulkSummarizeProgress(`Summarizing 1 of ${totalCount}...`, 0);
  resetBulkSelection();

  let index = 0;
  async function worker() {
    while (index < totalCount) {
      const currentIdx = index++;
      const docId = docIds[currentIdx];

      const card = document.getElementById(`doc-card-${docId}`);
      if (card) {
        const badge = card.querySelector('.doc-status-badge');
        if (badge) {
          badge.textContent = 'Processing';
          badge.style.backgroundColor = '#FEF3C7';
          badge.style.color = '#D97706';
        }
      }

      try {
        // Same race fix as proceedWithSummarization(): update the local
        // cache + re-render synchronously instead of relying on a DB
        // round trip landing before the next render. Awaiting the update
        // then awaiting loadDocuments(true) could still read back the OLD
        // status if that round trip was slow, silently skipping progress
        // for the whole run until a manual reload.
        const localDoc = activeDocuments.find(d => d.id === docId);
        if (localDoc) {
          localDoc.status = 'processing';
          localDoc.processing_stage = null;
        }
        renderDocumentsList();
        if (!pollingInterval) {
          pollingInterval = setInterval(() => loadDocuments(true), 1500);
        }

        const { error: statusUpdateError } = await supabaseClient
          .from('documents')
          .update({ status: 'processing' })
          .eq('id', docId);
        if (statusUpdateError) {
          console.error('Failed to persist "processing" status (UI already shows progress locally):', statusUpdateError);
        }

        const { data, error } = await supabaseClient.functions.invoke('summarize-document', {
          body: { documentId: docId, summaryStyle: summaryStyle, language: language, summaryLength: summaryLength, depth: summaryDepth || 'standard' }
        });

        if (error || !data || !data.success) {
          throw new Error(error ? error.message : "Summarization failed");
        }
      } catch (err) {
        console.error(`Error summarizing document ${docId}:`, err);
        await supabaseClient
          .from('documents')
          .update({ status: 'failed' })
          .eq('id', docId);
      }

      completedCount++;
      await loadDocuments(true);
      if (completedCount < totalCount) {
        showBulkSummarizeProgress(`Summarizing ${completedCount + 1} of ${totalCount}...`, Math.round((completedCount / totalCount) * 100));
      }
    }
  }

  // Run with concurrency 2
  await Promise.all([worker(), worker()]);

  hideBulkSummarizeProgress();
  showDashboardAlert('success', `All ${totalCount} summaries processed!`);
  
  await checkAndAwardFirstSummary();
  await loadDocuments();
}

function showBulkSummarizeProgress(text, percent) {
  let alertEl = document.getElementById('bulk-summarize-progress-banner');
  if (!alertEl) {
    alertEl = document.createElement('div');
    alertEl.id = 'bulk-summarize-progress-banner';
    alertEl.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      background-color: var(--color-navy);
      color: white;
      border: 2px solid var(--color-teal);
      border-radius: var(--radius);
      padding: 1rem 1.5rem;
      box-shadow: var(--shadow-lg);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      font-weight: 700;
      min-width: 260px;
    `;
    alertEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 20px; height: 20px; color: var(--color-teal); margin-right: 0; flex-shrink: 0;">
          <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
        </svg>
        <span id="bulk-summarize-progress-text"></span>
      </div>
      <div class="bulk-progress-track">
        <div id="bulk-summarize-progress-fill" class="bulk-progress-fill" style="width: 0%;"></div>
      </div>
    `;
    document.body.appendChild(alertEl);
  }
  const textEl = document.getElementById('bulk-summarize-progress-text');
  if (textEl) textEl.textContent = text;
  const fillEl = document.getElementById('bulk-summarize-progress-fill');
  if (fillEl && typeof percent === 'number') {
    fillEl.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }
}

function hideBulkSummarizeProgress() {
  const alertEl = document.getElementById('bulk-summarize-progress-banner');
  if (alertEl) alertEl.remove();
}

async function checkAndAwardFirstUpload() {
  try {
    const { count, error } = await supabaseClient
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id);

    if (!error && count === 1) {
      await awardAchievement('first_upload');
    }
  } catch (err) {
    console.error("Error checking first_upload:", err);
  }
}

async function checkAndAwardFirstSummary() {
  try {
    const { count, error } = await supabaseClient
      .from('study_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id);

    if (!error && count === 1) {
      await awardAchievement('first_summary');
    }
  } catch (err) {
    console.error("Error checking first_summary:", err);
  }
}

async function checkAndAwardFirstExam(grade) {
  try {
    const { count, error } = await supabaseClient
      .from('exams')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('status', 'completed');

    if (!error && count === 1) {
      await awardAchievement('first_exam');
    }
    if (grade === 100) {
      await awardAchievement('perfect_score');
    }
  } catch (err) {
    console.error("Error checking exams achievements:", err);
  }
}

async function checkAndAwardSandboxProject() {
  try {
    const { count, error } = await supabaseClient
      .from('sandbox_projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id);

    if (!error && count === 1) {
      await awardAchievement('first_sandbox_project');
    }
  } catch (err) {
    console.error("Error checking sandbox achievements:", err);
  }
}

async function renderStreakAndAchievements() {
  const streakEl = document.getElementById('home-streak-display');
  if (streakEl) {
    const streak = currentUserProfile?.current_streak || 0;
    streakEl.textContent = `🔥 ${streak} day streak!`;
  }

  const listContainer = document.getElementById('home-achievements-list');
  if (!listContainer) return;

  listContainer.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 2rem; grid-column: 1 / -1;">
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 32px; height: 32px; color: var(--color-teal);">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
      </svg>
    </div>
  `;

  try {
    const [earnedRes, allRes] = await Promise.all([
      supabaseClient
        .from('user_achievements')
        .select('achievement_id, earned_at')
        .eq('user_id', currentUser.id),
      supabaseClient
        .from('achievements')
        .select('*')
    ]);

    if (allRes.error) {
      listContainer.innerHTML = `<p style="color: var(--color-text-muted);">Failed to load achievements.</p>`;
      return;
    }

    const earned = earnedRes.data || [];
    const allAchievements = allRes.data || [];
    
    listContainer.innerHTML = '';
    
    const earnedMap = new Map();
    earned.forEach(e => earnedMap.set(e.achievement_id, e.earned_at));

    allAchievements.forEach(ach => {
      const isEarned = earnedMap.has(ach.id);
      const card = document.createElement('div');
      card.className = `achievement-card ${isEarned ? 'earned' : 'locked'}`;
      
      const detailsHtml = `
        <div class="achievement-icon-wrapper">${ach.icon}</div>
        <div class="achievement-details">
          <h4>${ach.title}</h4>
          <p>${ach.description}</p>
          ${isEarned ? `<span style="font-size: 0.6rem; color: var(--color-teal); display: block; margin-top: 0.15rem; font-weight: 700;">Earned: ${new Date(earnedMap.get(ach.id)).toLocaleDateString()}</span>` : ''}
        </div>
        ${!isEarned ? `<div class="lock-overlay">🔒</div>` : ''}
      `;
      card.innerHTML = detailsHtml;
      listContainer.appendChild(card);
    });

  } catch (err) {
    console.error("Error displaying achievements:", err);
    listContainer.innerHTML = `<p style="color: var(--color-text-muted);">Failed to load achievements.</p>`;
  }
}

function replaceTurkishChars(str) {
  if (!str) return '';
  return str
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C');
}

function applyBrandedLayout(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Header text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(22, 50, 92); // Brand navy rgb(22, 50, 92)
    doc.text("ACADEX", margin, 15);
    
    // Thin horizontal line under header in brand teal rgb(13, 148, 136)
    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.5);
    doc.line(margin, 17, pageWidth - margin, 17);
    
    // Footer page number
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128); // Gray text
    const footerText = `Page ${i} of ${pageCount}`;
    doc.text(footerText, pageWidth - margin - doc.getTextWidth(footerText), pageHeight - 12);
  }
}

function appendStudyCardToDoc(doc, studyCard, isFirstCard) {
  const margin = 14;
  const pageWidth = doc.internal.pageSize.width;
  const maxWidth = pageWidth - (margin * 2);
  const safeText = (txt) => replaceTurkishChars(txt || '');

  if (!isFirstCard) {
    doc.addPage();
  }
  
  let y = 35; // Start y below the header

  // Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(22, 50, 92); // Navy heading
  
  let titleStr = '';
  if (studyCard.documents?.file_name) {
    titleStr = studyCard.documents.file_name;
  } else if (studyCard.source_documents && studyCard.source_documents.length > 0) {
    titleStr = studyCard.source_documents.map(s => s.file_name).join(', ');
  } else {
    titleStr = studyCard.documentFileName || 'Study Card';
  }

  const titleLines = doc.splitTextToSize(safeText(titleStr), maxWidth);
  titleLines.forEach(line => {
    if (y > 270) { doc.addPage(); y = 35; }
    doc.text(line, margin, y);
    y += 8;
  });
  y += 2;

  // Metadata block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128); // Gray text
  const styleLabel = getStyleLabel(studyCard.summary_style);
  const langLabel = studyCard.summary_language === 'tr' ? 'Turkish' : 'English';
  const createdDate = new Date(studyCard.created_at).toLocaleDateString();
  const metaText = `Style: ${styleLabel} | Language: ${langLabel} | Created: ${createdDate}`;
  doc.text(metaText, margin, y);
  y += 8;

  // Simple divider
  doc.setDrawColor(230);
  doc.setLineWidth(0.2);
  doc.line(margin, y, margin + maxWidth, y);
  y += 10;

  // 1. Summary Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(22, 50, 92); // Navy section header
  doc.text('Summary', margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(60, 66, 82); // Muted dark gray body
  const summaryLines = doc.splitTextToSize(safeText(studyCard.summary), maxWidth);
  summaryLines.forEach(line => {
    if (y > 270) { doc.addPage(); y = 35; }
    doc.text(line, margin, y);
    y += 5.5;
  });
  y += 8;

  // 2. Key Terms Section
  if (studyCard.key_terms && studyCard.key_terms.length > 0) {
    if (y > 250) { doc.addPage(); y = 35; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(22, 50, 92); // Navy section header
    doc.text('Key Terms', margin, y);
    y += 7;

    studyCard.key_terms.forEach(kt => {
      // Bold Navy Term
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(22, 50, 92);
      const termLabel = replaceTurkishChars(`• ${kt.term}`);
      
      if (y > 270) { doc.addPage(); y = 35; }
      doc.text(termLabel, margin, y);
      y += 5;

      // Regular Gray Definition
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(60, 66, 82); // Muted dark gray definition text
      const defLines = doc.splitTextToSize(safeText(kt.definition), maxWidth - 6);
      defLines.forEach(line => {
        if (y > 270) { doc.addPage(); y = 35; }
        doc.text(line, margin + 6, y);
        y += 5;
      });
      y += 3; // Spacing between terms
    });
    y += 6;
  }

  // 3. Key Points Section
  if (studyCard.key_points && studyCard.key_points.length > 0) {
    if (y > 250) { doc.addPage(); y = 35; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(22, 50, 92); // Navy section header
    doc.text('Key Points', margin, y);
    y += 7;

    studyCard.key_points.forEach(pt => {
      const ptText = replaceTurkishChars(`* ${pt}`);
      const ptLines = doc.splitTextToSize(ptText, maxWidth);
      ptLines.forEach(line => {
        if (y > 270) { doc.addPage(); y = 35; }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(60, 66, 82); // Muted dark gray body
        doc.text(line, margin, y);
        y += 5.5;
      });
    });
    y += 8;
  }

  // 4. Quiz Questions Section
  if (studyCard.quiz_questions && studyCard.quiz_questions.length > 0) {
    if (y > 250) { doc.addPage(); y = 35; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(22, 50, 92); // Navy section header
    doc.text('Self-Test (Quiz)', margin, y);
    y += 7;

    studyCard.quiz_questions.forEach((q, idx) => {
      const qText = replaceTurkishChars(`Q${idx + 1}: ${q.question}`);
      const aText = replaceTurkishChars(`A: ${q.answer}`);
      
      const qLines = doc.splitTextToSize(qText, maxWidth);
      qLines.forEach(line => {
        if (y > 270) { doc.addPage(); y = 35; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(22, 50, 92); // Navy text for question
        doc.text(line, margin, y);
        y += 5.5;
      });

      const aLines = doc.splitTextToSize(aText, maxWidth);
      aLines.forEach(line => {
        if (y > 270) { doc.addPage(); y = 35; }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(60, 66, 82); // Muted dark gray for answer
        doc.text(line, margin, y);
        y += 5.5;
      });
      y += 3.5;
    });
  }
}

async function exportStudyCardToPDF(studyCard) {
  if (window.loadScript) {
    await window.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  appendStudyCardToDoc(doc, studyCard, true);
  applyBrandedLayout(doc);

  let docFileName = 'study-card';
  if (studyCard.documents?.file_name) {
    docFileName = studyCard.documents.file_name;
  } else if (studyCard.documentFileName) {
    docFileName = studyCard.documentFileName;
  }
  doc.save(`${replaceTurkishChars(docFileName)}.pdf`);
}

// ==========================================
// MADDE 5 — Anki / Obsidian / Cheatsheet export
// ==========================================

function getStudyCardExportBaseName(card) {
  const raw = card?.documents?.file_name || card?.documentFileName || card?.file_name || 'study-card';
  return String(raw).replace(/\.[^.]+$/, '').replace(/[^\w\u00C0-\u024f\- ]+/g, '').trim().slice(0, 60) || 'study-card';
}

function downloadTextFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

function escapeTsvField(s) {
  return String(s || '').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
}

/** Anki-compatible TSV: Front \t Back (import as Basic note type) */
function exportStudyCardToAnkiTsv(card) {
  const rows = [];
  // Header comment for Anki (ignored if first line has #)
  rows.push('#separator:tab');
  rows.push('#html:true');
  rows.push('#notetype:Basic');
  rows.push('#deck:Acadex::' + getStudyCardExportBaseName(card));

  (card.key_terms || []).forEach(t => {
    if (!t?.term) return;
    rows.push(escapeTsvField(t.term) + '\t' + escapeTsvField(t.definition || ''));
  });
  (card.cloze_cards || []).forEach(c => {
    if (!c?.prompt) return;
    rows.push(escapeTsvField(c.prompt) + '\t' + escapeTsvField(c.answer || ''));
  });
  (card.quiz_questions || []).forEach(q => {
    if (!q?.question) return;
    rows.push(escapeTsvField(q.question) + '\t' + escapeTsvField(q.answer || ''));
  });

  if (rows.length <= 4) {
    showDashboardAlert('info', 'Bu kartta Anki için terim / cloze / quiz yok.');
    return;
  }

  const name = getStudyCardExportBaseName(card) + '-anki.txt';
  downloadTextFile(name, rows.join('\n'), 'text/tab-separated-values;charset=utf-8');
  showDashboardAlert('success', 'Anki TSV indirildi. Anki → File → Import ile içe aktar.');
}

/** Obsidian-friendly Markdown with YAML frontmatter */
function exportStudyCardToObsidian(card) {
  const title = getStudyCardExportBaseName(card);
  const tags = [];
  if (card.course_tag) tags.push(String(card.course_tag).replace(/\s+/g, '-'));
  if (card.document_type) tags.push(String(card.document_type).replace(/\s+/g, '-'));
  tags.push('acadex');

  const fm = [
    '---',
    `title: "${title.replace(/"/g, "'")}"`,
    `created: ${new Date().toISOString().slice(0, 10)}`,
    `source: Acadex`,
    `document_type: ${card.document_type || 'Other'}`,
    `course_tag: ${card.course_tag || ''}`,
    `tags: [${tags.map(t => t.toLowerCase()).join(', ')}]`,
    '---',
    ''
  ].join('\n');

  let body = `# ${title}\n\n`;

  if (card.summary_executive) {
    body += `> [!summary] 30 saniyelik özet\n> ${card.summary_executive.replace(/\n/g, '\n> ')}\n\n`;
  }
  if (card.summary) {
    body += `## Özet\n\n${card.summary}\n\n`;
  }
  if (Array.isArray(card.sections) && card.sections.length) {
    body += `## Bölümler\n\n`;
    card.sections.forEach(s => {
      body += `### ${s.heading || ''}\n\n${s.summary || ''}\n\n`;
    });
  }
  if (Array.isArray(card.key_terms) && card.key_terms.length) {
    body += `## Anahtar Terimler\n\n`;
    card.key_terms.forEach(t => {
      body += `- **${t.term || ''}**: ${t.definition || ''}\n`;
    });
    body += '\n';
  }
  if (Array.isArray(card.key_points) && card.key_points.length) {
    body += `## Önemli Noktalar\n\n`;
    card.key_points.forEach(p => {
      body += `- ${typeof p === 'string' ? p : (p.point || p.text || '')}\n`;
    });
    body += '\n';
  }
  if (Array.isArray(card.cloze_cards) && card.cloze_cards.length) {
    body += `## Boşluk Doldurma\n\n`;
    card.cloze_cards.forEach(c => {
      body += `- ${c.prompt || ''} → **${c.answer || ''}**\n`;
    });
    body += '\n';
  }
  if (Array.isArray(card.quiz_questions) && card.quiz_questions.length) {
    body += `## Self-Test\n\n`;
    card.quiz_questions.forEach((q, i) => {
      body += `${i + 1}. **S:** ${q.question || ''}\n   **C:** ${q.answer || ''}\n\n`;
    });
  }
  if (Array.isArray(card.formulas) && card.formulas.length) {
    body += `## Formüller\n\n`;
    card.formulas.forEach(f => {
      body += `- **${f.name || 'Formula'}**: \`$${f.latex || ''}$\`\n`;
    });
    body += '\n';
  }

  // Wiki-style concept links for Obsidian graph
  const concepts = (card.concept_graph?.nodes || []).map(n => n.label).filter(Boolean);
  if (concepts.length) {
    body += `## Kavramlar\n\n`;
    concepts.forEach(label => {
      body += `- [[${label}]]\n`;
    });
    body += '\n';
  }

  downloadTextFile(title + '.md', fm + body, 'text/markdown;charset=utf-8');
  showDashboardAlert('success', 'Obsidian markdown indirildi.');
}

/** Printable one-page cheatsheet */
function openStudyCheatsheet(card) {
  const title = getStudyCardExportBaseName(card);
  const terms = (card.key_terms || []).slice(0, 12);
  const points = (card.key_points || []).slice(0, 10).map(p => typeof p === 'string' ? p : (p.point || p.text || ''));
  const formulas = (card.formulas || []).slice(0, 8);
  const exec = card.summary_executive || '';
  const summary = card.summary || '';

  const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>Cheatsheet — ${title.replace(/</g, '')}</title>
<style>
  @page { margin: 12mm; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.35; max-width: 900px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 16px; margin: 0 0 4px; color: #16325C; }
  .meta { color: #64748b; font-size: 10px; margin-bottom: 10px; }
  .exec { background: #f0fdfa; border-left: 3px solid #14b8a6; padding: 8px 10px; margin-bottom: 10px; font-weight: 600; }
  h2 { font-size: 12px; color: #16325C; border-bottom: 1px solid #e2e8f0; margin: 10px 0 6px; padding-bottom: 2px; }
  ul { margin: 0; padding-left: 16px; }
  li { margin-bottom: 3px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .formula { font-family: 'Cambria Math', Georgia, serif; background: #f8fafc; padding: 4px 6px; border-radius: 4px; margin-bottom: 4px; }
  .footer { margin-top: 12px; font-size: 9px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 0; } .noprint { display: none; } }
</style></head><body>
  <button class="noprint" onclick="window.print()" style="padding:8px 14px;margin-bottom:12px;cursor:pointer;font-weight:700;border-radius:8px;border:1px solid #16325C;background:#16325C;color:#fff;">🖨️ Yazdır / PDF</button>
  <h1>${title.replace(/</g, '')}</h1>
  <div class="meta">Acadex cheatsheet · ${card.course_tag || card.document_type || ''} · ${new Date().toLocaleDateString()}</div>
  ${exec ? `<div class="exec">${exec.replace(/</g, '&lt;')}</div>` : ''}
  <div class="cols">
    <div>
      <h2>Özet</h2>
      <p>${(summary || '—').replace(/</g, '&lt;').slice(0, 900)}</p>
      <h2>Önemli Noktalar</h2>
      <ul>${points.map(p => `<li>${String(p).replace(/</g, '&lt;')}</li>`).join('') || '<li>—</li>'}</ul>
    </div>
    <div>
      <h2>Anahtar Terimler</h2>
      <ul>${terms.map(t => `<li><strong>${String(t.term || '').replace(/</g, '&lt;')}</strong>: ${String(t.definition || '').replace(/</g, '&lt;')}</li>`).join('') || '<li>—</li>'}</ul>
      ${formulas.length ? `<h2>Formüller</h2>${formulas.map(f => `<div class="formula"><strong>${String(f.name || '').replace(/</g, '&lt;')}</strong>: ${String(f.latex || '').replace(/</g, '&lt;')}</div>`).join('')}` : ''}
    </div>
  </div>
  <div class="footer">Acadex · Tek sayfalık çalışma özeti</div>
</body></html>`;

  const w = window.open('', '_blank', 'noopener,width=900,height=700');
  if (!w) {
    showDashboardAlert('error', 'Popup engellendi — tarayıcıda pop-up izni verin.');
    return;
  }
  w.document.write(html);
  w.document.close();
}

function toggleStudyExportMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('study-export-menu');
  if (!menu) return;
  const open = menu.style.display === 'block';
  menu.style.display = open ? 'none' : 'block';
}

function exportCurrentStudyCard(format) {
  const menu = document.getElementById('study-export-menu');
  if (menu) menu.style.display = 'none';

  const card = currentActiveStudyCard;
  if (!card) {
    showDashboardAlert('error', 'Aktif çalışma kartı yok.');
    return;
  }
  if (format === 'anki') exportStudyCardToAnkiTsv(card);
  else if (format === 'obsidian') exportStudyCardToObsidian(card);
  else if (format === 'cheatsheet') openStudyCheatsheet(card);
}

// Close export menu on outside click
document.addEventListener('click', (e) => {
  const menu = document.getElementById('study-export-menu');
  const btn = document.getElementById('btn-export-menu-toggle');
  if (!menu || menu.style.display === 'none') return;
  if (btn && (btn === e.target || btn.contains(e.target))) return;
  if (menu.contains(e.target)) return;
  menu.style.display = 'none';
});

window.exportStudyCardToAnkiTsv = exportStudyCardToAnkiTsv;
window.exportStudyCardToObsidian = exportStudyCardToObsidian;
window.openStudyCheatsheet = openStudyCheatsheet;
window.toggleStudyExportMenu = toggleStudyExportMenu;
window.exportCurrentStudyCard = exportCurrentStudyCard;

async function exportAllFilteredCardsToPDF() {
  const cards = window.filteredLibraryCardsList || [];
  if (cards.length === 0) {
    const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
    showDashboardAlert('error', isTr 
      ? 'Aktarılacak bilgi kartı bulunamadı. Lütfen filtrelerinizi kontrol edin.' 
      : 'No study cards found to export. Please check your filters.');
    return;
  }

  const btnExport = document.getElementById('btn-export-all-pdf');
  const originalText = btnExport ? btnExport.textContent : 'Export All to PDF';
  if (btnExport) {
    btnExport.disabled = true;
    btnExport.textContent = (localStorage.getItem('acadexUILang') || 'en') === 'tr' ? 'Aktarılıyor...' : 'Exporting...';
  }

  try {
    if (window.loadScript) {
      await window.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    for (let i = 0; i < cards.length; i++) {
      appendStudyCardToDoc(doc, cards[i], i === 0);
    }

    applyBrandedLayout(doc);

    doc.save('Acadex_Study_Guide.pdf');
    const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
    showDashboardAlert('success', isTr ? 'Tüm bilgi kartları başarıyla PDF olarak aktarıldı!' : 'All study cards successfully exported to PDF!');
  } catch (err) {
    console.error("Failed to export all study cards to PDF: ", err);
    showDashboardAlert('error', 'Failed to export study guide to PDF. Please try again.');
  } finally {
    if (btnExport) {
      btnExport.disabled = false;
      btnExport.textContent = originalText;
    }
  }
}

window.handleMultipleFilesUpload = handleMultipleFilesUpload;
window.uploadSingleFileCore = uploadSingleFileCore;
window.proceedWithBulkSummarization = proceedWithBulkSummarization;
window.showBulkSummarizeProgress = showBulkSummarizeProgress;
window.hideBulkSummarizeProgress = hideBulkSummarizeProgress;
window.checkAndAwardFirstUpload = checkAndAwardFirstUpload;
window.checkAndAwardFirstSummary = checkAndAwardFirstSummary;
window.checkAndAwardFirstExam = checkAndAwardFirstExam;
window.checkAndAwardSandboxProject = checkAndAwardSandboxProject;
window.renderStreakAndAchievements = renderStreakAndAchievements;
window.replaceTurkishChars = replaceTurkishChars;
window.exportStudyCardToPDF = exportStudyCardToPDF;

// ==========================================
// STUDY PLANNER (PHASE 15)
// ==========================================
let plannerEvents = [];
let plannerCurrentDate = new Date();
let plannerLayoutMode = 'list'; // 'list' or 'calendar'

async function loadPlannerEvents() {
  if (!currentUser) return;
  
  const listThisWeek = document.getElementById('planner-events-this-week');
  const listLater = document.getElementById('planner-events-later');
  const groupThisWeek = document.getElementById('planner-group-this-week');
  const groupLater = document.getElementById('planner-group-later');
  const emptyState = document.getElementById('planner-empty-state');
  
  if (!listThisWeek || !listLater) return;

  listThisWeek.innerHTML = '';
  listLater.innerHTML = '';
  
  try {
    const { data, error } = await supabaseClient
      .from('study_events')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('event_date', { ascending: true });

    if (error) throw error;

    plannerEvents = data || [];
    
    // Render calendar if in calendar view
    if (plannerLayoutMode === 'calendar') {
      renderPlannerCalendar(plannerEvents);
    }

    if (plannerEvents.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (groupThisWeek) groupThisWeek.style.display = 'none';
      if (groupLater) groupLater.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (groupThisWeek) groupThisWeek.style.display = 'block';
    if (groupLater) groupLater.style.display = 'block';

    const todayStr = getLocalDateString();
    const today = new Date(todayStr);
    const oneWeekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    let thisWeekCount = 0;
    let laterCount = 0;

    plannerEvents.forEach(event => {
      const evDate = new Date(event.event_date);
      const isThisWeek = evDate >= today && evDate <= oneWeekLater;

      // Render Item Card
      const card = document.createElement('div');
      card.className = `doc-card ${event.is_done ? 'done-event' : ''}`;
      card.id = `planner-event-card-${event.id}`;
      card.style.padding = '1rem';
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.style.gap = '1rem';
      card.style.transition = 'opacity 0.2s, background-color 0.2s';
      if (event.is_done) {
        card.style.opacity = '0.6';
        card.style.backgroundColor = 'var(--color-bg-alt)';
      }

      // Determine Badge style
      let badgeBg = '#6B7280';
      if (event.event_type === 'exam') badgeBg = '#EF4444';
      else if (event.event_type === 'goal') badgeBg = 'var(--color-teal)';
      else if (event.event_type === 'deadline') badgeBg = '#F59E0B';

      card.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
          <input type="checkbox" ${event.is_done ? 'checked' : ''} onchange="toggleEventDone('${event.id}', this.checked)" style="width: 18px; height: 18px; accent-color: var(--color-teal); cursor: pointer; margin-top: 0.2rem;">
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--color-navy); margin: 0; ${event.is_done ? 'text-decoration: line-through;' : ''}">${event.title}</h4>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; flex-wrap: wrap;">
              <span style="font-size: 0.75rem; color: var(--color-text-muted); font-weight: 600;">📅 ${event.event_date}</span>
              <span style="font-size: 0.65rem; font-weight: 800; padding: 0.1rem 0.4rem; border-radius: 10px; color: white; text-transform: uppercase; background-color: ${badgeBg};">${event.event_type}</span>
            </div>
            ${event.notes ? `<p style="font-size: 0.8rem; color: var(--color-text-muted); margin: 0.35rem 0 0 0; line-height: 1.35; white-space: pre-wrap;">${event.notes}</p>` : ''}
          </div>
        </div>
        <button onclick="deletePlannerEvent('${event.id}')" style="background: none; border: none; color: #EF4444; cursor: pointer; padding: 0.25rem; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); transition: background-color 0.2s;" title="Delete Event">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;

      if (isThisWeek) {
        listThisWeek.appendChild(card);
        thisWeekCount++;
      } else {
        listLater.appendChild(card);
        laterCount++;
      }
    });

    if (thisWeekCount === 0) {
      listThisWeek.innerHTML = '<p style="font-size: 0.85rem; color: var(--color-text-muted); font-style: italic; margin: 0.5rem 0;">No events this week.</p>';
    }
    if (laterCount === 0) {
      listLater.innerHTML = '<p style="font-size: 0.85rem; color: var(--color-text-muted); font-style: italic; margin: 0.5rem 0;">No later events.</p>';
    }

  } catch (err) {
    console.error("Failed to load planner events: ", err);
    showDashboardAlert('error', 'Could not load planner events.');
  }
}

// ==========================================
// Export Study Planner events as a standard .ics file so students can
// import their exam dates and goals into Google Calendar, Outlook, or Apple
// Calendar in one click. Generated entirely client-side from the
// already-loaded `plannerEvents` array — no new backend endpoint needed.
// ==========================================
function icalEscapeText(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function icalDateStamp(date) {
  // Returns a UTC-basis YYYYMMDDTHHMMSSZ timestamp for DTSTAMP/CREATED fields.
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function exportPlannerToICal() {
  if (!plannerEvents || plannerEvents.length === 0) {
    showDashboardAlert('error', 'Takvime aktarılacak bir etkinlik bulunamadı. / No events to export yet.');
    return;
  }

  const nowStamp = icalDateStamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Acadex//Study Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  plannerEvents.forEach(event => {
    // event_date is a plain YYYY-MM-DD string; treat it as an all-day event
    // so it doesn't depend on the student's timezone.
    const dateOnly = (event.event_date || '').replace(/-/g, '');
    if (!dateOnly) return;

    // All-day events in iCal use DTEND as the *next* day (exclusive end).
    const startDate = new Date(event.event_date + 'T00:00:00');
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    const dateOnlyEnd = getLocalDateString(endDate).replace(/-/g, '');

    const typeLabel = { exam: 'Sınav', goal: 'Hedef', deadline: 'Son Tarih' }[event.event_type] || event.event_type || '';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:acadex-${event.id}@acadex`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dateOnly}`);
    lines.push(`DTEND;VALUE=DATE:${dateOnlyEnd}`);
    lines.push(`SUMMARY:${icalEscapeText(`[Acadex${typeLabel ? ' • ' + typeLabel : ''}] ${event.title}`)}`);
    if (event.notes) {
      lines.push(`DESCRIPTION:${icalEscapeText(event.notes)}`);
    }
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  // CRLF line endings are required by the iCalendar spec (RFC 5545).
  const icsContent = lines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'acadex-calendar.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showDashboardAlert('success', 'Takvim dosyası indirildi! Google Calendar veya Outlook\'a içe aktarabilirsiniz.');
}
window.exportPlannerToICal = exportPlannerToICal;

function openAddEventModal() {
  const modal = document.getElementById('planner-event-modal');
  if (modal) {
    document.getElementById('planner-event-form').reset();
    modal.classList.add('active');
  }
}

function closeAddEventModal() {
  const modal = document.getElementById('planner-event-modal');
  if (modal) modal.classList.remove('active');
}

async function savePlannerEvent(e) {
  e.preventDefault();
  if (!currentUser) return;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.textContent : '';

  const title = document.getElementById('planner-event-title').value.trim();
  const eventDate = document.getElementById('planner-event-date').value;
  const eventType = document.getElementById('planner-event-type').value;
  const notes = document.getElementById('planner-event-notes').value.trim();

  if (!title || !eventDate) {
    showDashboardAlert('error', 'Please fill in required fields.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving / Kaydediliyor...';
  }

  try {
    const { error } = await supabaseClient
      .from('study_events')
      .insert({
        user_id: currentUser.id,
        title: title,
        event_date: eventDate,
        event_type: eventType,
        notes: notes || null,
        is_done: false
      });

    if (error) throw error;

    e.target.reset();
    closeAddEventModal();
    showDashboardAlert('success', 'Event added successfully!');
    await loadPlannerEvents();
  } catch (err) {
    console.error("Failed to save event: ", err);
    showDashboardAlert('error', 'Could not save event.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

async function toggleEventDone(id, isDone) {
  try {
    const { error } = await supabaseClient
      .from('study_events')
      .update({ is_done: isDone })
      .eq('id', id);

    if (error) throw error;

    const card = document.getElementById(`planner-event-card-${id}`);
    if (card) {
      if (isDone) {
        card.classList.add('done-event');
        card.style.opacity = '0.6';
        card.style.backgroundColor = 'var(--color-bg-alt)';
        const titleEl = card.querySelector('h4');
        if (titleEl) titleEl.style.textDecoration = 'line-through';
      } else {
        card.classList.remove('done-event');
        card.style.opacity = '1';
        card.style.backgroundColor = '';
        const titleEl = card.querySelector('h4');
        if (titleEl) titleEl.style.textDecoration = 'none';
      }
    }

    // Refresh calendar view if active to update dots
    if (plannerLayoutMode === 'calendar') {
      renderPlannerCalendar(plannerEvents);
    }
  } catch (err) {
    console.error("Failed to update event: ", err);
    showDashboardAlert('error', 'Could not update event status.');
  }
}

async function deletePlannerEvent(id) {
  const isTr = localStorage.getItem('acadexUILang') === 'tr';
  const title = isTr ? "Etkinliği Sil" : "Delete Event";
  const text = isTr 
    ? "Bu etkinliği silmek istediğinizden emin misiniz?" 
    : "Are you sure you want to delete this event?";

  showConfirmModal(title, text, async () => {
    try {
      const { error } = await supabaseClient
        .from('study_events')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showDashboardAlert('success', 'Event deleted!');
      await loadPlannerEvents();
    } catch (err) {
      console.error("Failed to delete event: ", err);
      showDashboardAlert('error', 'Could not delete event.');
    }
  });
}

function togglePlannerLayout(mode) {
  plannerLayoutMode = mode;
  const listContainer = document.getElementById('planner-list-container');
  const calendarContainer = document.getElementById('planner-calendar-container');
  const btnList = document.getElementById('btn-planner-view-list');
  const btnCal = document.getElementById('btn-planner-view-calendar');

  if (mode === 'calendar') {
    if (calendarContainer) calendarContainer.style.display = 'block';
    if (btnCal) {
      btnCal.style.backgroundColor = 'var(--color-teal)';
      btnCal.style.color = 'white';
    }
    if (btnList) {
      btnList.style.backgroundColor = 'transparent';
      btnList.style.color = 'var(--color-navy)';
    }
    renderPlannerCalendar(plannerEvents);
  } else {
    if (calendarContainer) calendarContainer.style.display = 'none';
    if (btnList) {
      btnList.style.backgroundColor = 'var(--color-teal)';
      btnList.style.color = 'white';
    }
    if (btnCal) {
      btnCal.style.backgroundColor = 'transparent';
      btnCal.style.color = 'var(--color-navy)';
    }
  }
}

function renderPlannerCalendar(events) {
  const container = document.getElementById('planner-calendar-days');
  const monthYearHeader = document.getElementById('planner-calendar-month-year');
  if (!container || !monthYearHeader) return;

  container.innerHTML = '';

  const year = plannerCurrentDate.getFullYear();
  const month = plannerCurrentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  const trMonthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];
  
  const currentLang = localStorage.getItem('acadexUILang') || 'en';
  const monthLabel = currentLang === 'tr' ? trMonthNames[month] : monthNames[month];
  monthYearHeader.textContent = `${monthLabel} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const totalDays = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < adjustedFirstDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.style.padding = '0.5rem';
    emptyCell.style.color = 'var(--color-text-muted)';
    emptyCell.style.opacity = '0.35';
    container.appendChild(emptyCell);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    dayCell.style.padding = '0.5rem';
    dayCell.style.borderRadius = 'var(--radius-sm)';
    dayCell.style.border = '1px solid rgba(22, 50, 92, 0.04)';
    dayCell.style.position = 'relative';
    dayCell.style.cursor = 'pointer';
    dayCell.style.display = 'flex';
    dayCell.style.flexDirection = 'column';
    dayCell.style.alignItems = 'center';
    dayCell.style.minHeight = '42px';
    dayCell.style.transition = 'background-color 0.2s';
    dayCell.className = 'calendar-day-cell';

    dayCell.addEventListener('mouseenter', () => {
      dayCell.style.backgroundColor = 'rgba(31, 138, 147, 0.08)';
    });
    dayCell.addEventListener('mouseleave', () => {
      dayCell.style.backgroundColor = '';
    });

    const dayNum = document.createElement('span');
    dayNum.textContent = day;
    dayNum.style.fontSize = '0.85rem';
    dayNum.style.fontWeight = '700';
    dayNum.style.color = 'var(--color-navy)';
    dayCell.appendChild(dayNum);

    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dayStr}`;

    const dayEvents = events.filter(e => e.event_date === dateKey);

    if (dayEvents.length > 0) {
      const hasActiveEvent = dayEvents.some(e => !e.is_done);
      const dot = document.createElement('span');
      dot.style.width = '6px';
      dot.style.height = '6px';
      dot.style.borderRadius = '50%';
      dot.style.backgroundColor = hasActiveEvent ? 'var(--color-teal)' : '#6B7280';
      dot.style.marginTop = '4px';
      dayCell.appendChild(dot);

      dayCell.title = dayEvents.map(e => `${e.is_done ? '✓ ' : ''}[${e.event_type.toUpperCase()}] ${e.title}`).join('\n');

      dayCell.addEventListener('click', () => {
        const firstEventId = dayEvents[0].id;
        const targetElement = document.getElementById(`planner-event-card-${firstEventId}`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetElement.style.outline = '2px solid var(--color-teal)';
          setTimeout(() => {
            targetElement.style.outline = 'none';
          }, 2000);
        }
      });
    }

    container.appendChild(dayCell);
  }
}

function navigatePlannerCalendar(direction) {
  plannerCurrentDate.setMonth(plannerCurrentDate.getMonth() + direction);
  renderPlannerCalendar(plannerEvents);
}

// Bind to window for HTML access
window.loadPlannerEvents = loadPlannerEvents;
window.openAddEventModal = openAddEventModal;
window.closeAddEventModal = closeAddEventModal;
window.savePlannerEvent = savePlannerEvent;
window.toggleEventDone = toggleEventDone;
window.deletePlannerEvent = deletePlannerEvent;
window.togglePlannerLayout = togglePlannerLayout;
window.navigatePlannerCalendar = navigatePlannerCalendar;

function closeActiveModal(modalEl) {
  const id = modalEl.id;
  if (id === 'planner-event-modal') {
    closeAddEventModal();
  } else if (id === 'delete-account-modal') {
    closeDeleteAccountModal();
  } else if (id === 'summary-style-modal') {
    closeSummaryStyleModal();
  } else if (id === 'delete-modal') {
    closeDeleteModal();
  } else if (id === 'table-picker-modal') {
    closeTablePickerModal();
  } else if (id === 'study-card-modal') {
    closeStudyCardModal();
  } else if (id === 'share-project-modal') {
    closeShareProjectModal();
  } else if (id === 'depot-modal') {
    closeDepotModal();
  } else {
    if (window.closeModalWithFocus) window.closeModalWithFocus(id);
  }
}
window.closeActiveModal = closeActiveModal;

// ==========================================
// Admin Inbox Controllers (Phase 16B - Part B)
// ==========================================
async function updateAdminInboxBadge() {
  try {
    const { count, error } = await supabaseClient
      .from('contact_messages')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    if (!error) {
      const badge = document.getElementById('admin-tab-inbox-badge');
      if (badge) {
        if (count > 0) {
          badge.textContent = count;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    }
  } catch (err) {
    console.error("Error updating admin inbox count:", err);
  }
}
window.updateAdminInboxBadge = updateAdminInboxBadge;

async function loadAdminInbox() {
  const listContainer = document.getElementById('admin-messages-list');
  if (!listContainer) return;

  listContainer.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 2rem;">
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 32px; height: 32px; color: var(--color-teal);">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
      </svg>
    </div>
  `;

  try {
    const { data: messages, error } = await supabaseClient
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error loading admin messages:", error);
      listContainer.innerHTML = `<p style="color: var(--color-text-muted);">Failed to load messages from inbox.</p>`;
      return;
    }

    if (!messages || messages.length === 0) {
      listContainer.innerHTML = `
        <div class="search-empty-state" style="text-align: center; padding: 2rem;">
          <p style="color: var(--color-text-muted); font-size: 0.9rem;">No messages yet.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';
    messages.forEach(msg => {
      const createdDate = new Date(msg.created_at).toLocaleString();
      const card = document.createElement('div');
      card.className = `doc-card ${msg.is_read ? '' : 'unread-message'}`;
      card.id = `admin-msg-${msg.id}`;
      card.style.padding = '1.25rem';
      card.style.position = 'relative';
      card.style.border = msg.is_read ? '1px solid rgba(22, 50, 92, 0.08)' : '2px solid var(--color-teal)';
      card.style.backgroundColor = msg.is_read ? 'var(--color-white)' : 'var(--color-bg-alt)';
      card.style.transition = 'background-color 0.2s, border-color 0.2s';
      card.style.cursor = 'pointer';

      // Unread dot indicator
      const unreadDot = msg.is_read ? '' : `<span style="width: 8px; height: 8px; background-color: var(--color-teal); border-radius: 50%; display: inline-block; margin-right: 0.5rem;" title="Yeni / Unread"></span>`;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center;">
            ${unreadDot}
            <strong style="color: var(--color-navy); font-size: 0.95rem;">${msg.name || 'Anonymous'}</strong>
          </div>
          <span style="font-size: 0.75rem; color: var(--color-text-muted); font-weight: 500;">${createdDate}</span>
        </div>

        <div style="margin-top: 0.35rem; font-size: 0.8rem; color: var(--color-teal); font-weight: 700;">
          <a href="mailto:${msg.email}" style="color: inherit; text-decoration: underline;" onclick="event.stopPropagation();">${msg.email}</a>
        </div>

        <div class="message-content" style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--color-text); line-height: 1.5; white-space: pre-wrap; ${msg.is_read ? 'display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;' : ''}">
          ${msg.message}
        </div>
      `;

      // Click to toggle full view & mark as read
      card.addEventListener('click', async () => {
        const contentEl = card.querySelector('.message-content');
        if (contentEl) {
          // Toggle clamp styling
          if (contentEl.style.display === 'none' || contentEl.style.webkitLineClamp === '3') {
            contentEl.style.display = 'block';
            contentEl.style.webkitLineClamp = 'unset';
            contentEl.style.overflow = 'visible';
          } else {
            contentEl.style.display = '-webkit-box';
            contentEl.style.webkitLineClamp = '3';
            contentEl.style.overflow = 'hidden';
          }
        }

        // Mark as read in DB if it was unread
        if (!msg.is_read) {
          try {
            const { error: updateError } = await supabaseClient
              .from('contact_messages')
              .update({ is_read: true })
              .eq('id', msg.id);

            if (!updateError) {
              msg.is_read = true;
              card.classList.remove('unread-message');
              card.style.border = '1px solid rgba(22, 50, 92, 0.08)';
              card.style.backgroundColor = 'var(--color-white)';
              
              // Remove the dot
              const dotEl = card.querySelector('span[title="Yeni / Unread"]');
              if (dotEl) dotEl.remove();

              await updateAdminInboxBadge();
            }
          } catch (e) {
            console.error("Error marking message as read:", e);
          }
        }
      });

      listContainer.appendChild(card);
    });

  } catch (err) {
    console.error("Exception loading admin inbox:", err);
    listContainer.innerHTML = `<p style="color: var(--color-text-muted);">Failed to load messages from inbox.</p>`;
  }
}
window.loadAdminInbox = loadAdminInbox;

// ==========================================
// PHASE 17A — COURSE TAG UI HELPERS
// ==========================================

// Cached official course catalog for the current student's own department
// (public.departments / public.courses, seeded via
// supabase/migrations/20260721_add_course_catalog.sql). Used to power a
// <datalist> autocomplete on the manual course-tag input below, so tagging
// converges on real course codes instead of drifting into free-text
// variants — while still allowing a free-text override for courses outside
// the catalog (electives, cross-department courses, STAJ, etc).
let courseTagCatalogCache = null;

async function getOwnDepartmentCourseCatalog() {
  if (courseTagCatalogCache) return courseTagCatalogCache;
  if (!currentUserProfile?.department) {
    courseTagCatalogCache = [];
    return courseTagCatalogCache;
  }
  try {
    const { data: deptRow } = await supabaseClient
      .from('departments')
      .select('code')
      .eq('name', currentUserProfile.department)
      .maybeSingle();

    if (!deptRow?.code) {
      courseTagCatalogCache = [];
      return courseTagCatalogCache;
    }

    const { data: courses } = await supabaseClient
      .from('courses')
      .select('course_code, course_name')
      .eq('department_code', deptRow.code)
      .order('course_code');

    courseTagCatalogCache = courses || [];
  } catch (err) {
    console.warn('Could not load course catalog for tag autocomplete (has the catalog migration been run?):', err);
    courseTagCatalogCache = [];
  }
  return courseTagCatalogCache;
}

function ensureCourseTagDatalist(courses) {
  let dl = document.getElementById('course-tag-datalist');
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = 'course-tag-datalist';
    document.body.appendChild(dl);
  }
  dl.innerHTML = (courses || [])
    .map(c => `<option value="${escapeHtml(c.course_code)}">${escapeHtml(c.course_code)} — ${escapeHtml(c.course_name)}</option>`)
    .join('');
  return dl;
}

/**
 * Starts inline editing of a course tag on a document card.
 * Replaces the pill/button with a text input; saves on blur/Enter.
 * The input is backed by a <datalist> of the student's own official course
 * catalog for autocomplete, but free-text entry still works for anything
 * not in that catalog.
 */
async function startEditCourseTag(docId, triggerEl) {
  const wrapper = triggerEl.closest('.doc-course-tag-wrapper');
  if (!wrapper) return;

  // Get current value from the pill text (if any)
  const currentTag = triggerEl.classList.contains('course-tag-pill')
    ? triggerEl.textContent.replace('🏷️', '').trim()
    : '';

  const catalog = await getOwnDepartmentCourseCatalog();
  ensureCourseTagDatalist(catalog);

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentTag;
  input.placeholder = 'e.g. MIS301, Marketing 101';
  input.setAttribute('list', 'course-tag-datalist');
  input.style.cssText = `
    font-size: 0.7rem; font-family: inherit;
    border: 1px solid var(--color-teal); border-radius: 20px;
    padding: 0.2rem 0.55rem; outline: none; width: 160px;
    color: var(--color-navy); background: var(--color-white);
  `;

  wrapper.innerHTML = '';
  wrapper.appendChild(input);
  input.focus();
  input.select();

  const save = async () => {
    const newTag = input.value.trim();
    await saveCourseTag(docId, newTag);
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') {
      // Restore original without saving
      loadDocuments();
    }
  });
}
window.startEditCourseTag = startEditCourseTag;

/**
 * Saves a course tag for a document to Supabase and refreshes the card.
 */
async function saveCourseTag(docId, newTag) {
  try {
    const tagValue = newTag || null;
    const { error } = await supabaseClient
      .from('documents')
      .update({ course_tag: tagValue })
      .eq('id', docId);

    if (error) {
      console.error('Failed to save course tag:', error);
      showDashboardAlert('error', 'Could not save course tag. Please try again.');
    }

    // Update the in-memory cache so filterLibraryCards() picks it up too
    const doc = activeDocuments.find(d => d.id === docId);
    if (doc) doc.course_tag = tagValue;

    // Re-render just this card's tag area without a full reload
    const wrapper = document.querySelector(`.doc-course-tag-wrapper[data-doc-id="${docId}"]`);
    if (wrapper) {
      if (tagValue) {
        wrapper.innerHTML = `<span class="course-tag-pill" onclick="startEditCourseTag('${docId}', this)" title="Click to edit course tag" style="display: inline-flex; align-items: center; gap: 0.3rem; background: var(--color-teal-light); color: var(--color-teal); font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 20px; cursor: pointer; transition: background 0.2s;">🏷️ ${tagValue}</span>`;
      } else {
        wrapper.innerHTML = `<button class="add-course-tag-btn" onclick="startEditCourseTag('${docId}', this)" style="display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.7rem; color: var(--color-text-muted); background: none; border: 1px dashed rgba(22,50,92,0.2); border-radius: 20px; padding: 0.2rem 0.55rem; cursor: pointer; transition: all 0.2s;">+ Add course tag</button>`;
      }
    }
  } catch (err) {
    console.error('Exception saving course tag:', err);
    showDashboardAlert('error', 'An error occurred saving the course tag.');
    await loadDocuments();
  }
}
window.saveCourseTag = saveCourseTag;

// ==========================================
// PHASE 17B — MERGE & SUMMARIZE TRIGGER
// ==========================================

/**
 * Calls the merge-summarize Edge Function for the given document IDs.
 * Shows loading + success/error toasts and reloads the cards library on success.
 */
async function triggerMergeSummarize(documentIds, summaryStyle, language, summaryLength, analyzeVisuals, summaryDepth = 'standard') {
  if (!documentIds || documentIds.length < 2) {
    showDashboardAlert('error', 'Select at least 2 documents to merge.');
    return;
  }

  showDashboardAlert('info', `Merging ${documentIds.length} documents… This may take a moment.`);
  resetBulkSelection();

  try {
    const session = await supabaseClient.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) {
      showDashboardAlert('error', 'Session expired. Please log in again.');
      return;
    }

    const SUPABASE_URL = supabaseClient.supabaseUrl;
    const response = await fetch(`${SUPABASE_URL}/functions/v1/merge-summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ documentIds, summaryStyle, language, summaryLength, analyzeVisuals: !!analyzeVisuals, depth: summaryDepth || 'standard' })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error('merge-summarize error:', result);
      showDashboardAlert('error', result.error || 'Merge summarization failed. Please try again.');
      return;
    }

    showDashboardAlert('success', 'Merged study card created! View it in Bilgi Kartları.');

    // Refresh the cards library if it's open
    if (currentActiveTab === 'cards') {
      await loadCardsLibrary();
    }

  } catch (err) {
    console.error('Exception in triggerMergeSummarize:', err);
    showDashboardAlert('error', 'An unexpected error occurred during merge. Please try again.');
  }
}
window.triggerMergeSummarize = triggerMergeSummarize;

// ==========================================
// PHASE 17C — ADMIN PILOT IMPACT REPORT
// ==========================================

/**
 * Loads the admin Pilot Impact Report via the get_admin_report() RPC and renders
 * a rich stat-card dashboard in #report-content.
 */
async function loadAdminReport() {
  const container = document.getElementById('report-content');
  if (!container) return;

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 3rem;">
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 36px; height: 36px; color: var(--color-teal);">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
      </svg>
    </div>
  `;

  try {
    const { data, error } = await supabaseClient.rpc('get_admin_report');

    if (error) {
      console.error('get_admin_report error:', error);
      container.innerHTML = `
        <div class="empty-state">
          <p class="empty-state-text" style="color: #DC2626;">
            Could not load the report. You may not have admin permissions, or an error occurred.
          </p>
        </div>
      `;
      return;
    }

    const r = data || {};

    let feedbackRatioStr = '—';
    try {
      const { data: fbData, error: fbError } = await supabaseClient
        .from('summary_feedback')
        .select('rating');

      if (!fbError && fbData && fbData.length > 0) {
        const positiveCount = fbData.filter(f => f.rating === 'up').length;
        const totalCount = fbData.length;
        const ratio = Math.round((positiveCount / totalCount) * 100);
        feedbackRatioStr = `${ratio}% positive`;
      } else if (!fbError && fbData && fbData.length === 0) {
        feedbackRatioStr = 'No feedback';
      }
    } catch (fbErr) {
      console.error("Error computing feedback ratio:", fbErr);
    }

    const statCard = (label, value, icon, color) => `
      <div style="background: var(--color-white); border: 1px solid rgba(22,50,92,0.1); border-radius: var(--radius-md); padding: 1.5rem; box-shadow: var(--shadow-sm); display: flex; align-items: center; gap: 1rem;">
        <div style="width: 48px; height: 48px; border-radius: var(--radius-sm); background-color: ${color}22; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0;">${icon}</div>
        <div>
          <div style="font-size: 1.75rem; font-weight: 800; color: var(--color-navy);">${value ?? '—'}</div>
          <div style="font-size: 0.8rem; color: var(--color-text-muted); font-weight: 600; margin-top: 0.15rem;">${label}</div>
        </div>
      </div>
    `;

    container.innerHTML = `
      <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 1.5rem;">
        Generated at ${new Date().toLocaleString()}
      </p>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        ${statCard('Total Students', r.total_students, '👥', '#0D9488')}
        ${statCard('Total Documents', r.total_documents, '📄', '#7C3AED')}
        ${statCard('Study Cards Created', r.total_study_cards, '🃏', '#D97706')}
        ${statCard('Merged Cards', r.total_merged_cards ?? 0, '🔀', '#4F46E5')}
        ${statCard('Exams Taken', r.total_exams_taken, '📝', '#DC2626')}
        ${statCard('Avg. Exam Score', r.avg_exam_score != null ? r.avg_exam_score.toFixed(1) + '%' : '—', '⭐', '#059669')}
        ${statCard('Shared Cards', r.total_shared_cards, '🌐', '#0EA5E9')}
        ${statCard('Overall Feedback', feedbackRatioStr, '👍', '#0D9488')}
        ${statCard('Contact Messages', r.total_contact_messages ?? 0, '✉️', '#F59E0B')}
      </div>

      ${r.top_departments && r.top_departments.length > 0 ? `
        <div style="background: var(--color-white); border: 1px solid rgba(22,50,92,0.1); border-radius: var(--radius-md); padding: 1.5rem; box-shadow: var(--shadow-sm);">
          <h3 style="font-size: 1rem; font-weight: 800; color: var(--color-navy); margin-bottom: 1rem;">📊 Top Departments by Activity</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 2px solid rgba(22,50,92,0.1);">
                <th style="text-align: left; padding: 0.5rem; color: var(--color-navy); font-weight: 700;">Department</th>
                <th style="text-align: right; padding: 0.5rem; color: var(--color-navy); font-weight: 700;">Students</th>
                <th style="text-align: right; padding: 0.5rem; color: var(--color-navy); font-weight: 700;">Documents</th>
                <th style="text-align: right; padding: 0.5rem; color: var(--color-navy); font-weight: 700;">Cards</th>
              </tr>
            </thead>
            <tbody>
              ${r.top_departments.map(d => `
                <tr style="border-bottom: 1px solid rgba(22,50,92,0.05);">
                  <td style="padding: 0.5rem; color: var(--color-navy);">${d.department || '—'}</td>
                  <td style="padding: 0.5rem; text-align: right; color: var(--color-text-muted);">${d.student_count ?? 0}</td>
                  <td style="padding: 0.5rem; text-align: right; color: var(--color-text-muted);">${d.document_count ?? 0}</td>
                  <td style="padding: 0.5rem; text-align: right; color: var(--color-text-muted);">${d.card_count ?? 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${r.recent_signups && r.recent_signups.length > 0 ? `
        <div style="background: var(--color-white); border: 1px solid rgba(22,50,92,0.1); border-radius: var(--radius-md); padding: 1.5rem; box-shadow: var(--shadow-sm); margin-top: 1rem;">
          <h3 style="font-size: 1rem; font-weight: 800; color: var(--color-navy); margin-bottom: 1rem;">🆕 Recent Sign-ups</h3>
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem;">
            ${r.recent_signups.map(u => `
              <li style="font-size: 0.85rem; color: var(--color-navy); display: flex; justify-content: space-between; border-bottom: 1px solid rgba(22,50,92,0.05); padding-bottom: 0.4rem;">
                <span>${u.full_name || 'Anonymous'} <span style="color: var(--color-text-muted); font-size: 0.75rem;">(${u.department || 'No dept'})</span></span>
                <span style="color: var(--color-text-muted); font-size: 0.75rem;">${new Date(u.created_at).toLocaleDateString()}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
    `;

  } catch (err) {
    console.error('Exception in loadAdminReport:', err);
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-text" style="color: #DC2626;">An unexpected error occurred while loading the report.</p>
      </div>
    `;
  }
}
window.loadAdminReport = loadAdminReport;

// ==========================================
// ADMIN PANEL UNIFIED VIEWS & TABS (PART A)
// ==========================================
let currentAdminTab = 'overview';
let adminStudentsList = [];
let adminStudentsSortField = 'created_at';
let adminStudentsSortAsc = false;
let adminModerationCards = [];
let adminModerationProjects = [];

function loadAdminPanel() {
  switchAdminTab(currentAdminTab);
}
window.loadAdminPanel = loadAdminPanel;

function switchAdminTab(tabId) {
  currentAdminTab = tabId;

  // Update tab buttons
  const buttons = document.querySelectorAll('.btn-admin-tab');
  buttons.forEach(btn => {
    const idSuffix = btn.id.replace('btn-admin-tab-', '');
    if (idSuffix === tabId) {
      btn.classList.add('active');
      btn.style.color = 'var(--color-navy)';
      btn.style.borderBottom = '3px solid var(--color-teal)';
    } else {
      btn.classList.remove('active');
      btn.style.color = 'var(--color-text-muted)';
      btn.style.borderBottom = '3px solid transparent';
    }
  });

  // Toggle tab contents
  const contents = document.querySelectorAll('.admin-tab-content');
  contents.forEach(content => {
    const contentIdSuffix = content.id.replace('admin-tab-content-', '');
    if (contentIdSuffix === tabId) {
      content.style.display = (contentIdSuffix === 'moderation') ? 'flex' : 'block';
    } else {
      content.style.display = 'none';
    }
  });

  // Load active tab data
  if (tabId === 'overview') {
    loadAdminReport();
  } else if (tabId === 'students') {
    loadAdminStudentList();
  } else if (tabId === 'inbox') {
    loadAdminInbox();
  } else if (tabId === 'moderation') {
    loadAdminModeration();
  }
}
window.switchAdminTab = switchAdminTab;

// ==========================================
// ADMIN PANEL - STUDENTS TAB (PART C)
// ==========================================
async function loadAdminStudentList() {
  const tableBody = document.getElementById('students-table-body');
  const countLabel = document.getElementById('students-count-label');
  const errorContainer = document.getElementById('students-error-container');

  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="9" style="text-align: center; padding: 2rem;">
        <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 32px; height: 32px; color: var(--color-teal); display: inline-block;">
          <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
        </svg>
      </td>
    </tr>
  `;
  if (countLabel) countLabel.textContent = '';
  if (errorContainer) {
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
  }

  try {
    const { data, error } = await supabaseClient.rpc('get_admin_student_list');

    if (error) {
      console.error("Error fetching admin student list:", error);
      tableBody.innerHTML = '';
      if (errorContainer) {
        errorContainer.textContent = "Erişim Reddedildi / Access Denied. You may not have administrative permissions.";
        errorContainer.style.display = 'block';
      }
      return;
    }

    adminStudentsList = data || [];
    renderAdminStudentsTable();
  } catch (err) {
    console.error("Exception fetching admin student list:", err);
    tableBody.innerHTML = '';
    if (errorContainer) {
      errorContainer.textContent = "An unexpected error occurred loading student list.";
      errorContainer.style.display = 'block';
    }
  }
}
window.loadAdminStudentList = loadAdminStudentList;

function renderAdminStudentsTable() {
  const tableBody = document.getElementById('students-table-body');
  const countLabel = document.getElementById('students-count-label');
  if (!tableBody) return;

  const searchInput = document.getElementById('students-search-input');
  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const deptFilter = document.getElementById('students-dept-filter');
  const selectedDept = deptFilter ? deptFilter.value : 'all';

  let filtered = adminStudentsList.filter(student => {
    const matchesSearch = !searchQuery || 
      (student.full_name && student.full_name.toLowerCase().includes(searchQuery)) ||
      (student.student_number && student.student_number.toLowerCase().includes(searchQuery)) ||
      (student.email && student.email.toLowerCase().includes(searchQuery));

    const matchesDept = selectedDept === 'all' || student.department === selectedDept;

    return matchesSearch && matchesDept;
  });

  // Apply sorting
  filtered.sort((a, b) => {
    let valA = a[adminStudentsSortField];
    let valB = b[adminStudentsSortField];

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (typeof valA === 'string') {
      return adminStudentsSortAsc 
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    } else {
      if (adminStudentsSortField === 'created_at') {
        const timeA = new Date(valA).getTime();
        const timeB = new Date(valB).getTime();
        return adminStudentsSortAsc ? timeA - timeB : timeB - timeA;
      }
      return adminStudentsSortAsc ? valA - valB : valB - valA;
    }
  });

  tableBody.innerHTML = '';

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
          No students found matching current filters.
        </td>
      </tr>
    `;
    if (countLabel) countLabel.textContent = `Showing 0 of ${adminStudentsList.length} students`;
    return;
  }

  filtered.forEach(student => {
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid rgba(22, 50, 92, 0.05)';
    row.style.transition = 'background-color 0.2s';
    
    const deptClass = getDepartmentColorClass(student.department);
    const shortName = getDepartmentShortName(student.department);
    const registeredDate = student.created_at ? new Date(student.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) : '—';

    row.innerHTML = `
      <td style="padding: 0.75rem 1rem; color: var(--color-navy); font-weight: 700; white-space: nowrap;">${student.full_name || '—'}</td>
      <td style="padding: 0.75rem 1rem; color: var(--color-text);">${student.student_number || '—'}</td>
      <td style="padding: 0.75rem 1rem; color: var(--color-text);"><a href="mailto:${student.email || ''}" style="color: var(--color-teal); text-decoration: underline;">${student.email || '—'}</a></td>
      <td style="padding: 0.75rem 1rem;"><span class="dept-badge ${deptClass}" style="font-size: 0.7rem; font-weight: 800;">${shortName}</span></td>
      <td style="padding: 0.75rem 1rem; color: var(--color-text-muted);">${registeredDate}</td>
      <td style="padding: 0.75rem 1rem; color: var(--color-navy); font-weight: 700;">🔥 ${student.current_streak || 0}</td>
      <td style="padding: 0.75rem 1rem; color: var(--color-text); font-weight: 600;">${student.document_count || 0}</td>
      <td style="padding: 0.75rem 1rem; color: var(--color-text); font-weight: 600;">${student.study_card_count || 0}</td>
      <td style="padding: 0.75rem 1rem; color: var(--color-text); font-weight: 600;">${student.exam_count || 0}</td>
    `;
    tableBody.appendChild(row);
  });

  if (countLabel) {
    countLabel.textContent = `Showing ${filtered.length} of ${adminStudentsList.length} students`;
  }
}
window.renderAdminStudentsTable = renderAdminStudentsTable;

function filterAdminStudentsTable() {
  renderAdminStudentsTable();
}
window.filterAdminStudentsTable = filterAdminStudentsTable;

function sortAdminStudents(field) {
  if (adminStudentsSortField === field) {
    adminStudentsSortAsc = !adminStudentsSortAsc;
  } else {
    adminStudentsSortField = field;
    adminStudentsSortAsc = true;
  }
  renderAdminStudentsTable();
}
window.sortAdminStudents = sortAdminStudents;

// ==========================================
// ADMIN PANEL - CONTENT MODERATION TAB (PART E)
// ==========================================
async function loadAdminModeration() {
  const cardsList = document.getElementById('mod-cards-list');
  const projectsList = document.getElementById('mod-projects-list');

  if (cardsList) {
    cardsList.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; padding: 2rem;">
        <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 32px; height: 32px; color: var(--color-teal);">
          <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
        </svg>
      </div>
    `;
  }
  if (projectsList) {
    projectsList.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; padding: 2rem;">
        <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 32px; height: 32px; color: var(--color-teal);">
          <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
        </svg>
      </div>
    `;
  }

  try {
    // 1. Fetch shared study cards
    const { data: cards, error: cardsErr } = await supabaseClient
      .from('study_cards')
      .select('*, documents(file_name)')
      .eq('is_shared', true)
      .order('shared_at', { ascending: false });

    if (!cardsErr && cards && cards.length > 0) {
      const userIds = [...new Set(cards.map(c => c.user_id))];
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, full_name, department, avatar_url')
        .in('id', userIds);

      const profileMap = {};
      profiles?.forEach(p => {
        profileMap[p.id] = p;
      });

      adminModerationCards = cards.map(c => ({
        ...c,
        profile: profileMap[c.user_id] || { full_name: 'A classmate', department: c.department }
      }));
    } else {
      adminModerationCards = [];
    }

    // 2. Fetch sandbox projects
    const { data: projects, error: projErr } = await supabaseClient
      .from('sandbox_projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (!projErr && projects && projects.length > 0) {
      const userIds = [...new Set(projects.map(p => p.user_id))];
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, full_name, department, avatar_url')
        .in('id', userIds);

      const profileMap = {};
      profiles?.forEach(p => {
        profileMap[p.id] = p;
      });

      adminModerationProjects = projects.map(p => ({
        ...p,
        profile: profileMap[p.user_id] || { full_name: 'Anonymous Student', department: 'General Faculty' }
      }));
    } else {
      adminModerationProjects = [];
    }

    renderModerationCards();
    renderModerationProjects();

  } catch (err) {
    console.error("Exception loading moderation data:", err);
    if (cardsList) cardsList.innerHTML = `<p style="color: var(--color-text-muted);">Failed to load moderation data.</p>`;
    if (projectsList) projectsList.innerHTML = `<p style="color: var(--color-text-muted);">Failed to load moderation data.</p>`;
  }
}
window.loadAdminModeration = loadAdminModeration;

function renderModerationCards() {
  const container = document.getElementById('mod-cards-list');
  if (!container) return;

  const searchInput = document.getElementById('mod-cards-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let filtered = adminModerationCards.filter(c => {
    return !query ||
      (c.profile.full_name && c.profile.full_name.toLowerCase().includes(query)) ||
      (c.documents?.file_name && c.documents.file_name.toLowerCase().includes(query)) ||
      (c.summary && c.summary.toLowerCase().includes(query));
  });

  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="search-empty-state" style="text-align: center; padding: 1.5rem; border: 1px dashed rgba(22, 50, 92, 0.1); border-radius: var(--radius-sm);">
        <p style="color: var(--color-text-muted); font-size: 0.85rem; margin: 0;">Paylaşılan çalışma kartı bulunamadı. / No shared cards found.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(c => {
    const row = document.createElement('div');
    row.className = 'doc-card';
    row.style.padding = '1rem';
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '0.5rem';
    row.style.border = '1px solid rgba(22, 50, 92, 0.08)';

    const deptClass = getDepartmentColorClass(c.profile.department);
    const shortName = getDepartmentShortName(c.profile.department);
    const sharedDate = c.shared_at ? new Date(c.shared_at).toLocaleDateString() : '—';
    const excerpt = c.summary && c.summary.length > 150 ? c.summary.substring(0, 150) + '...' : c.summary || 'No summary text.';

    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <strong style="color: var(--color-navy); font-size: 0.9rem;">${c.profile.full_name || 'Classmate'}</strong>
          <span class="dept-badge ${deptClass}" style="margin-left: 4px; font-size: 0.65rem;">${shortName}</span>
          <span style="font-size: 0.75rem; color: var(--color-text-muted); margin-left: 0.5rem;">Document: ${c.documents?.file_name || 'Shared Doc'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">${sharedDate}</span>
          <button class="btn" onclick="unshareStudyCard('${c.id}')" style="background-color: #EF4444; color: white; border: none; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; border-radius: var(--radius-sm); cursor: pointer; transition: background-color 0.2s;">🚫 Unshare</button>
        </div>
      </div>
      <p style="font-size: 0.8rem; color: var(--color-text); margin: 0; line-height: 1.4; word-break: break-word;">${excerpt}</p>
    `;
    container.appendChild(row);
  });
}
window.renderModerationCards = renderModerationCards;

function filterModerationCards() {
  renderModerationCards();
}
window.filterModerationCards = filterModerationCards;

function renderModerationProjects() {
  const container = document.getElementById('mod-projects-list');
  if (!container) return;

  const searchInput = document.getElementById('mod-projects-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let filtered = adminModerationProjects.filter(p => {
    return !query ||
      (p.profile.full_name && p.profile.full_name.toLowerCase().includes(query)) ||
      (p.title && p.title.toLowerCase().includes(query)) ||
      (p.description && p.description.toLowerCase().includes(query));
  });

  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="search-empty-state" style="text-align: center; padding: 1.5rem; border: 1px dashed rgba(22, 50, 92, 0.1); border-radius: var(--radius-sm);">
        <p style="color: var(--color-text-muted); font-size: 0.85rem; margin: 0;">Paylaşılan proje bulunamadı. / No projects found.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(p => {
    const row = document.createElement('div');
    row.className = 'doc-card';
    row.style.padding = '1rem';
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '0.5rem';
    row.style.border = '1px solid rgba(22, 50, 92, 0.08)';

    const deptClass = getDepartmentColorClass(p.profile.department);
    const shortName = getDepartmentShortName(p.profile.department);
    const submitDate = p.created_at ? new Date(p.created_at).toLocaleDateString() : '—';

    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <strong style="color: var(--color-navy); font-size: 0.9rem;">${p.title || 'Untitled Project'}</strong>
          <span style="font-size: 0.75rem; color: var(--color-text-muted); margin-left: 0.5rem;">By: ${p.profile.full_name || 'Student'}</span>
          <span class="dept-badge ${deptClass}" style="margin-left: 4px; font-size: 0.65rem;">${shortName}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">${submitDate}</span>
          <button class="btn" onclick="removeSandboxProject('${p.id}')" style="background-color: #DC2626; color: white; border: none; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; border-radius: var(--radius-sm); cursor: pointer; transition: background-color 0.2s;">🗑️ Remove</button>
        </div>
      </div>
      <p style="font-size: 0.8rem; color: var(--color-text-muted); margin: 0; word-break: break-word;">${p.description || 'No description.'}</p>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
        ${p.github_url ? `<a href="${p.github_url}" target="_blank" style="font-size: 0.75rem; color: var(--color-teal); text-decoration: underline;">GitHub</a>` : ''}
        ${p.live_url ? `<a href="${p.live_url}" target="_blank" style="font-size: 0.75rem; color: var(--color-teal); text-decoration: underline;">Live Demo</a>` : ''}
      </div>
    `;
    container.appendChild(row);
  });
}
window.renderModerationProjects = renderModerationProjects;

function filterModerationProjects() {
  renderModerationProjects();
}
window.filterModerationProjects = filterModerationProjects;

async function unshareStudyCard(cardId) {
  if (!confirm("Bu çalışma kartının paylaşımını kaldırmak istediğinizden emin misiniz? / Are you sure you want to unshare this study card?")) return;

  try {
    const { error } = await supabaseClient
      .from('study_cards')
      .update({ is_shared: false })
      .eq('id', cardId);

    if (error) {
      console.error("Error unsharing study card:", error);
      showDashboardAlert('error', 'Paylaşım kaldırılamadı. / Failed to unshare study card.');
      return;
    }

    showDashboardAlert('success', 'Çalışma kartı paylaşımı kaldırıldı! / Study card unshared successfully!');
    await loadAdminModeration();
  } catch (err) {
    console.error("Exception unsharing card:", err);
  }
}
window.unshareStudyCard = unshareStudyCard;

async function removeSandboxProject(projId) {
  if (!confirm("Bu projeyi kaldırmak istediğinizden emin misiniz? / Are you sure you want to remove this sandbox project?")) return;

  try {
    const { error } = await supabaseClient
      .from('sandbox_projects')
      .delete()
      .eq('id', projId);

    if (error) {
      console.error("Error deleting sandbox project:", error);
      showDashboardAlert('error', 'Proje silinemedi. / Failed to delete sandbox project.');
      return;
    }

    showDashboardAlert('success', 'Proje başarıyla kaldırıldı! / Project removed successfully!');
    await loadAdminModeration();
  } catch (err) {
    console.error("Exception deleting project:", err);
  }
}
window.removeSandboxProject = removeSandboxProject;

// ==========================================================================
// PART D — VOICE-TO-TEXT NOTES IN THE STUDY NOTEBOOK
// ==========================================================================

let speechRecognitionInstance = null;
let isSpeechListening = false;
let speechActiveTextBoxId = null;

function toggleVoiceTranscription() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  const btnMic = document.getElementById('tool-mic');
  if (isSpeechListening) {
    // Stop listening
    if (speechRecognitionInstance) {
      speechRecognitionInstance.stop();
    }
  } else {
    // Start listening
    isSpeechListening = true;
    if (btnMic) {
      btnMic.classList.add('mic-active');
    }
    
    // Create new textbox at default center position
    const overlay = document.getElementById('notebook-overlay-container');
    if (overlay) {
      const id = 'text-voice-' + Date.now();
      const fontSize = document.getElementById('text-font-size')?.value || '16px';
      
      const textBox = document.createElement('div');
      textBox.className = 'draggable-element draggable-text-box editing';
      textBox.id = id;
      textBox.style.left = '150px';
      textBox.style.top = '150px';
      textBox.style.color = currentPenColor;
      textBox.style.fontSize = fontSize;
      textBox.setAttribute('data-type', 'text');
      textBox.setAttribute('data-color', currentPenColor);
      textBox.setAttribute('data-font-size', fontSize);

      textBox.innerHTML = `
        <button class="delete-overlay-btn" title="Delete Text" onclick="removeOverlayElement('${id}')" style="top: -6px; right: -6px;">×</button>
        <div contenteditable="true" style="outline:none; min-width: 150px; white-space: pre-wrap; overflow-wrap: break-word; font-family: inherit; font-size: inherit;" onblur="handleTextBlur('${id}')"></div>
      `;

      overlay.appendChild(textBox);
      makeElementDraggable(textBox);
      activeEditingTextBox = textBox;
      speechActiveTextBoxId = id;

      const editable = textBox.querySelector('[contenteditable="true"]');
      if (editable) {
        editable.focus();
        editable.textContent = "(Listening... / Dinleniyor...)";
      }

      // Bind double-click handler to re-enter editing mode
      textBox.addEventListener('dblclick', (evt) => {
        if (evt.target.classList.contains('delete-overlay-btn')) return;
        const ed = textBox.querySelector('[contenteditable]');
        if (ed) {
          ed.contentEditable = "true";
          textBox.classList.add('editing');
          activeEditingTextBox = textBox;
          ed.focus();
        }
      });
    }

    try {
      speechRecognitionInstance = new SpeechRecognition();
      speechRecognitionInstance.continuous = true;
      speechRecognitionInstance.interimResults = true;
      
      const currentLang = localStorage.getItem('acadexUILang') || 'en';
      speechRecognitionInstance.lang = currentLang === 'tr' ? 'tr-TR' : 'en-US';

      speechRecognitionInstance.onresult = (event) => {
        let finalTrans = '';
        let interimTrans = '';
        // Fixed: Loop from 0 to display cumulative speech transcript
        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            interimTrans += event.results[i][0].transcript;
          }
        }
        
        const textBox = document.getElementById(speechActiveTextBoxId);
        if (textBox) {
          const editable = textBox.querySelector('[contenteditable="true"]');
          if (editable) {
            editable.textContent = finalTrans + interimTrans;
          }
        }
      };

      speechRecognitionInstance.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        if ((event.error === 'not-allowed' || event.error === 'service-not-allowed') && window.location.protocol === 'file:') {
          console.warn("Speech recognition may require HTTPS hosting to function — this may not work from a local file:// path.");
        }
        if (event.error === 'not-allowed') {
          showDashboardAlert('error', 'Microphone permission denied. / Mikrofon izni reddedildi.');
        } else {
          showDashboardAlert('error', 'Speech recognition error. / Ses tanıma hatası: ' + event.error);
        }
        stopSpeechProcess();
      };

      speechRecognitionInstance.onend = () => {
        stopSpeechProcess();
      };

      speechRecognitionInstance.start();
    } catch (err) {
      console.error("Speech Recognition start exception:", err);
      showDashboardAlert('error', 'Could not initialize microphone. / Mikrofon başlatılamadı.');
      stopSpeechProcess();
    }
  }
}
window.toggleVoiceTranscription = toggleVoiceTranscription;

function stopSpeechProcess() {
  isSpeechListening = false;
  const btnMic = document.getElementById('tool-mic');
  if (btnMic) {
    btnMic.classList.remove('mic-active');
  }
  
  if (speechActiveTextBoxId) {
    const textBox = document.getElementById(speechActiveTextBoxId);
    if (textBox) {
      const editable = textBox.querySelector('[contenteditable="true"]');
      if (editable) {
        const text = editable.textContent.trim();
        if (text === "" || text === "(Listening... / Dinleniyor...)") {
          textBox.remove();
        } else {
          editable.blur();
        }
      }
    }
    speechActiveTextBoxId = null;
  }
}

// ==========================================================================
// PART E — EXAM DATE REMINDERS (Çalışma Planlayıcı)
// ==========================================================================

let alreadyNotifiedEventIds = new Set();

function requestExamNotificationPermission() {
  if (!('Notification' in window)) {
    showDashboardAlert('error', 'Notifications not supported by this browser.');
    return;
  }

  Notification.requestPermission().then(permission => {
    updateRemindersStatusText();
    if (permission === 'granted') {
      showDashboardAlert('success', 'Exam reminders enabled successfully!');
      checkAndTriggerExamNotifications();
    }
  });
}
window.requestExamNotificationPermission = requestExamNotificationPermission;

function updateRemindersStatusText() {
  const statusText = document.getElementById('reminders-status-text');
  if (!statusText) return;

  if (!('Notification' in window)) {
    statusText.textContent = 'Status: Unsupported';
    statusText.style.color = '#EF4444';
    return;
  }

  if (Notification.permission === 'granted') {
    statusText.textContent = 'Status: Enabled 🔔';
    statusText.style.color = '#10B981';
  } else if (Notification.permission === 'denied') {
    statusText.textContent = 'Status: Blocked 🚫';
    statusText.style.color = '#EF4444';
  } else {
    statusText.textContent = 'Status: Not Enabled ⚠️';
    statusText.style.color = '#F59E0B';
  }
}
window.updateRemindersStatusText = updateRemindersStatusText;

async function checkAndTriggerExamNotifications() {
  if (!currentUser) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    const { data: events, error } = await supabaseClient
      .from('study_events')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('event_type', 'exam')
      .eq('is_done', false);

    if (error) throw error;

    const todayStr = getLocalDateString();
    const tomorrowStr = getLocalDateString(new Date(Date.now() + 86400000));

    (events || []).forEach(ev => {
      if (alreadyNotifiedEventIds.has(ev.id)) return;

      if (ev.event_date === todayStr) {
        new Notification("Upcoming Exam Reminder", {
          body: `"${ev.title}" is today!`,
          icon: 'assets/logo.png'
        });
        alreadyNotifiedEventIds.add(ev.id);
      } else if (ev.event_date === tomorrowStr) {
        new Notification("Upcoming Exam Reminder", {
          body: `"${ev.title}" is tomorrow!`,
          icon: 'assets/logo.png'
        });
        alreadyNotifiedEventIds.add(ev.id);
      }
    });
  } catch (err) {
    console.error("Error triggering notifications:", err);
  }
}
window.checkAndTriggerExamNotifications = checkAndTriggerExamNotifications;

async function loadHomeExamBanners() {
  const container = document.getElementById('home-exam-banners-container');
  if (!container) return;

  container.innerHTML = '';
  if (!currentUser) return;

  try {
    const { data: events, error } = await supabaseClient
      .from('study_events')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('event_type', 'exam')
      .eq('is_done', false);

    if (error) throw error;

    const todayStr = getLocalDateString();
    const tomorrowStr = getLocalDateString(new Date(Date.now() + 86400000));

    const upcomingExams = (events || []).filter(ev => {
      return ev.event_date === todayStr || ev.event_date === tomorrowStr;
    });

    upcomingExams.forEach(ev => {
      const banner = document.createElement('div');
      banner.style.cssText = `
        background-color: #FEF2F2;
        border: 1px solid #FCA5A5;
        border-radius: var(--radius-sm);
        padding: 0.75rem 1rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        box-shadow: var(--shadow-sm);
      `;

      const textSpan = document.createElement('span');
      textSpan.style.cssText = `
        color: #991B1B;
        font-weight: 700;
        font-size: 0.85rem;
      `;
      const dateText = ev.event_date === todayStr ? "TODAY" : "TOMORROW";
      textSpan.textContent = `🚨 Upcoming Exam: "${ev.title}" is ${dateText}!`;

      const ackBtn = document.createElement('button');
      ackBtn.className = 'btn';
      ackBtn.style.cssText = `
        padding: 0.25rem 0.6rem;
        font-size: 0.75rem;
        background-color: #EF4444;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 700;
      `;
      ackBtn.textContent = "Acknowledge / Anladım";
      ackBtn.addEventListener('click', async () => {
        try {
          const { error: updateError } = await supabaseClient
            .from('study_events')
            .update({ is_done: true })
            .eq('id', ev.id);
          if (updateError) throw updateError;
          banner.remove();
          loadDashboardHome();
        } catch (updateErr) {
          console.error("Failed to acknowledge exam:", updateErr);
        }
      });

      banner.appendChild(textSpan);
      banner.appendChild(ackBtn);
      container.appendChild(banner);
    });
  } catch (err) {
    console.error("Error loading exam banners:", err);
  }
}
window.loadHomeExamBanners = loadHomeExamBanners;

// ==========================================
// AVATAR BUILDER (DiceBear Integration)
// ==========================================
const DICEBEAR_STYLES = ['adventurer', 'avataaars', 'bottts', 'micah', 'personas'];
const DICEBEAR_STYLE_LABELS = { adventurer: 'Adventurer', avataaars: 'Avataaars', bottts: 'Bottts', micah: 'Micah', personas: 'Personas' };
let currentAvatarStyle = 'adventurer';
let currentAvatarSeed = '';

function getDiceBearUrl(style, seed) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

function renderUserAvatarHtml(profile, sizePx) {
  sizePx = sizePx || 36;
  if (profile && profile.avatar_url) {
    return `<img src="${profile.avatar_url}" alt="Avatar" style="width:${sizePx}px;height:${sizePx}px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
      + `<span style="display:none;width:${sizePx}px;height:${sizePx}px;border-radius:50%;background:var(--color-gradient);color:#fff;font-weight:800;font-size:${Math.round(sizePx*0.4)}px;align-items:center;justify-content:center;letter-spacing:0.05em;">${getInitials(profile.full_name)}</span>`;
  }
  return `<span style="display:flex;width:${sizePx}px;height:${sizePx}px;border-radius:50%;background:var(--color-gradient);color:#fff;font-weight:800;font-size:${Math.round(sizePx*0.4)}px;align-items:center;justify-content:center;letter-spacing:0.05em;">${getInitials(profile ? profile.full_name : '')}</span>`;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

function openAvatarBuilder() {
  const modal = document.getElementById('avatar-builder-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  
  // Initialize with current avatar if user has one, or defaults
  if (currentUserProfile && currentUserProfile.avatar_url) {
    const url = currentUserProfile.avatar_url;
    // Try to parse style and seed from URL
    const match = url.match(/\/9\.x\/([\w-]+)\/svg\?seed=(.+)/);
    if (match) {
      currentAvatarStyle = match[1];
      currentAvatarSeed = decodeURIComponent(match[2]);
    } else {
      currentAvatarStyle = 'adventurer';
      currentAvatarSeed = currentUserProfile.full_name || 'acadex';
    }
  } else {
    currentAvatarStyle = 'adventurer';
    currentAvatarSeed = (currentUserProfile?.full_name) || 'acadex';
  }
  
  renderAvatarStyleOptions();
  updateAvatarPreview();
}

function closeAvatarBuilder() {
  const modal = document.getElementById('avatar-builder-modal');
  if (modal) modal.style.display = 'none';
}

function renderAvatarStyleOptions() {
  const container = document.getElementById('avatar-style-options');
  if (!container) return;
  container.innerHTML = '';
  
  DICEBEAR_STYLES.forEach(style => {
    const previewSeed = 'acadex-preview';
    const previewUrl = getDiceBearUrl(style, previewSeed);
    const isActive = style === currentAvatarStyle;
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-style-btn' + (isActive ? ' active' : '');
    btn.title = DICEBEAR_STYLE_LABELS[style] || style;
    btn.innerHTML = `
      <img src="${previewUrl}" alt="${style}" style="width:48px;height:48px;border-radius:50%;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>';">
      <span style="font-size:0.65rem;font-weight:700;margin-top:0.2rem;">${DICEBEAR_STYLE_LABELS[style] || style}</span>
    `;
    btn.addEventListener('click', () => {
      currentAvatarStyle = style;
      renderAvatarStyleOptions();
      updateAvatarPreview();
    });
    container.appendChild(btn);
  });
}

function updateAvatarPreview() {
  const preview = document.getElementById('avatar-builder-preview');
  if (!preview) return;
  const url = getDiceBearUrl(currentAvatarStyle, currentAvatarSeed);
  preview.innerHTML = `<img src="${url}" alt="Avatar Preview" style="width:120px;height:120px;border-radius:50%;border:3px solid var(--color-teal);" onerror="this.alt='Failed to load preview';">`;
}

function randomizeAvatarSeed() {
  currentAvatarSeed = 'acadex-' + Math.random().toString(36).substring(2, 10);
  updateAvatarPreview();
}

async function saveAvatar() {
  const url = getDiceBearUrl(currentAvatarStyle, currentAvatarSeed);
  
  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', currentUser.id);
    
    if (error) {
      console.error('Failed to save avatar:', error);
      showDashboardAlert('error', 'Avatar could not be saved.');
      return;
    }
    
    currentUserProfile.avatar_url = url;
    showDashboardAlert('success', 'Avatar saved!');
    closeAvatarBuilder();
    updateAllAvatarDisplays();
  } catch (err) {
    console.error('Exception saving avatar:', err);
    showDashboardAlert('error', 'Avatar save failed.');
  }
}

async function removeAvatar() {
  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', currentUser.id);
    
    if (error) {
      console.error('Failed to remove avatar:', error);
      return;
    }
    
    currentUserProfile.avatar_url = null;
    showDashboardAlert('success', 'Avatar removed.');
    closeAvatarBuilder();
    updateAllAvatarDisplays();
  } catch (err) {
    console.error('Exception removing avatar:', err);
  }
}

function updateAllAvatarDisplays() {
  // Top bar avatar
  const topBarAvatar = document.getElementById('topbar-user-avatar');
  if (topBarAvatar && currentUserProfile) {
    topBarAvatar.innerHTML = renderUserAvatarHtml(currentUserProfile, 32);
  }
  
  // Home welcome avatar
  const homeAvatar = document.getElementById('home-user-avatar');
  if (homeAvatar && currentUserProfile) {
    homeAvatar.innerHTML = renderUserAvatarHtml(currentUserProfile, 48);
  }
  
  // Settings avatar preview
  const settingsAvatar = document.getElementById('settings-avatar-preview');
  if (settingsAvatar && currentUserProfile) {
    settingsAvatar.innerHTML = renderUserAvatarHtml(currentUserProfile, 64);
  }
}

window.openAvatarBuilder = openAvatarBuilder;
window.closeAvatarBuilder = closeAvatarBuilder;
window.randomizeAvatarSeed = randomizeAvatarSeed;
window.saveAvatar = saveAvatar;
window.removeAvatar = removeAvatar;
window.renderUserAvatarHtml = renderUserAvatarHtml;
window.getInitials = getInitials;
window.getDiceBearUrl = getDiceBearUrl;
window.updateAllAvatarDisplays = updateAllAvatarDisplays;


// ==========================================================================
// ACADIA AI STUDY ASSISTANT
// A context-aware chat widget available from every dashboard tab. Calls the
// acadia-assistant edge function, which assembles a fresh snapshot of the
// student's own activity (exam averages, weak concepts, upcoming planner
// items) server-side and asks Groq/Llama for grounded, conversational study
// advice. Conversation history lives only in this tab's memory — it is
// never written to Supabase and is lost on page reload, consistent with the
// privacy notice shown in the panel and in legal.html.
// ==========================================================================
let acadiaChatHistory = []; // [{ role: 'user' | 'assistant', content: string }]
let acadiaHasGreeted = false;
let acadiaRequestInFlight = false;
let acadiaSelectedCardId = null;
let acadiaSelectedCardLabel = null;
let acadiaAvailableCards = [];

function initAcadiaWidget() {
  const form = document.getElementById('acadia-input-form');
  if (!form || form.dataset.wired) return;
  form.dataset.wired = 'true';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('acadia-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendAcadiaMessage(text);
  });
}

function toggleAcadiaPanel(forceState) {
  const panel = document.getElementById('acadia-panel');
  if (!panel) return;
  const shouldShow = typeof forceState === 'boolean' ? forceState : (panel.style.display === 'none' || !panel.style.display);

  panel.style.display = shouldShow ? 'flex' : 'none';

  if (shouldShow) {
    if (!acadiaHasGreeted) {
      acadiaHasGreeted = true;
      const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
      const greeting = isTr
        ? `Merhaba! Ben Acadia, çalışma asistanınız. Bana derslerinizle veya Acadex'i nasıl kullanacağınızla ilgili her şeyi sorabilirsiniz!`
        : `Hi! I'm Acadia, your study assistant. Ask me anything about your coursework, or how to use Acadex!`;
      renderAcadiaMessage('assistant', greeting);
      acadiaChatHistory.push({ role: 'assistant', content: greeting });
    }
    const input = document.getElementById('acadia-input');
    if (input) setTimeout(() => input.focus(), 50);
  }
}
window.toggleAcadiaPanel = toggleAcadiaPanel;

function clearAcadiaChat() {
  acadiaChatHistory = [];
  acadiaHasGreeted = false;
  const messages = document.getElementById('acadia-messages');
  if (messages) messages.innerHTML = '';
  toggleAcadiaPanel(true); // re-trigger the welcome message
}
window.clearAcadiaChat = clearAcadiaChat;

// --------------------------------------------------------------------
// Summary context picker: lets the student hand Acadia a specific study
// card so it can answer questions grounded in that exact summary, and
// (via the acadia-action mechanism in sendAcadiaMessage) push content
// from it onto the notebook board as sticky notes on request.
// --------------------------------------------------------------------
async function toggleAcadiaCardPicker(forceState) {
  const picker = document.getElementById('acadia-card-picker');
  if (!picker) return;
  const shouldShow = typeof forceState === 'boolean' ? forceState : (picker.style.display === 'none' || !picker.style.display);

  if (!shouldShow) {
    picker.style.display = 'none';
    return;
  }

  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  picker.style.display = 'block';
  picker.innerHTML = `<div style="padding: 0.6rem 0.85rem; font-size: 0.72rem; color: var(--color-text-muted);">${isTr ? 'Yükleniyor...' : 'Loading...'}</div>`;

  try {
    const { data: cards, error } = await supabaseClient
      .from('study_cards')
      .select('id, summary, created_at, documents(file_name)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error || !cards || cards.length === 0) {
      picker.innerHTML = `<div style="padding: 0.6rem 0.85rem; font-size: 0.72rem; color: var(--color-text-muted);">${isTr ? 'Henüz bir özet yok.' : 'No summaries yet.'}</div>`;
      return;
    }

    acadiaAvailableCards = cards;
    picker.innerHTML = cards.map(c => {
      const fname = (c.documents && c.documents.file_name) ? c.documents.file_name : 'Untitled';
      const safeFname = fname.replace(/</g, '&lt;');
      const excerptRaw = (c.summary || '').slice(0, 70).replace(/</g, '&lt;');
      return `
        <button type="button" class="acadia-card-picker-item" onclick="selectAcadiaCardContext('${c.id}')" style="display: block; width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid rgba(22, 50, 92, 0.06); padding: 0.5rem 0.85rem; cursor: pointer; font-size: 0.75rem; color: var(--color-navy);">
          <div style="font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeFname}</div>
          <div style="color: var(--color-text-muted); font-size: 0.68rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${excerptRaw}${(c.summary || '').length > 70 ? '…' : ''}</div>
        </button>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading study cards for Acadia picker:', err);
    picker.innerHTML = `<div style="padding: 0.6rem 0.85rem; font-size: 0.72rem; color: #EF4444;">${isTr ? 'Yüklenemedi.' : 'Failed to load.'}</div>`;
  }
}
window.toggleAcadiaCardPicker = toggleAcadiaCardPicker;

function selectAcadiaCardContext(cardId) {
  const card = acadiaAvailableCards.find(c => c.id === cardId);
  if (!card) return;

  acadiaSelectedCardId = cardId;
  const fname = (card.documents && card.documents.file_name) ? card.documents.file_name : 'Untitled';
  acadiaSelectedCardLabel = fname;

  const labelEl = document.getElementById('acadia-context-label');
  if (labelEl) labelEl.textContent = `📄 ${fname}`;
  const clearBtn = document.getElementById('btn-acadia-clear-context');
  if (clearBtn) clearBtn.style.display = 'inline-block';

  toggleAcadiaCardPicker(false);

  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  showDashboardAlert('success', isTr ? `Acadia artık "${fname}" özetini görebiliyor.` : `Acadia can now see the "${fname}" summary.`);
}
window.selectAcadiaCardContext = selectAcadiaCardContext;

function clearAcadiaCardContext() {
  acadiaSelectedCardId = null;
  acadiaSelectedCardLabel = null;
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';

  const labelEl = document.getElementById('acadia-context-label');
  if (labelEl) labelEl.textContent = isTr ? 'Bir özet seç (bağlam ekle)' : 'Pick a summary (add context)';
  const clearBtn = document.getElementById('btn-acadia-clear-context');
  if (clearBtn) clearBtn.style.display = 'none';
}
window.clearAcadiaCardContext = clearAcadiaCardContext;

// Executes any "acadia-action" block the assistant appended to its reply
// (e.g. transferring quiz questions onto the notebook board as sticky
// notes) and returns the reply text with the action block stripped out,
// so the chat bubble only shows the conversational part.
// Tabs Acadia is allowed to navigate to via switch_tab, and the planner
// event types the Study Planner's own "Add Event" form accepts (see
// savePlannerEvent) — kept in sync with #planner-event-type's options.
const ACADIA_VALID_TABS = ['home', 'planner', 'docs', 'feed', 'notebook', 'cards', 'sourcehub', 'glossary', 'exams', 'settings', 'sandbox'];
const ACADIA_VALID_EVENT_TYPES = ['exam', 'goal', 'deadline', 'other'];
const ACADIA_TAB_LABELS = {
  home: { tr: 'Ana Sayfa', en: 'Home' },
  planner: { tr: 'Çalışma Planlayıcı', en: 'Study Planner' },
  docs: { tr: 'Belgeler', en: 'Documents' },
  feed: { tr: 'Bölüm Akışı', en: 'Department Feed' },
  notebook: { tr: 'Çalışma Defteri', en: 'Notebook' },
  cards: { tr: 'Bilgi Kartları', en: 'Study Cards' },
  sourcehub: { tr: 'Kaynakla Çalış', en: 'Source Hub' },
  glossary: { tr: 'Ders Sözlüğü', en: 'Course Glossary' },
  exams: { tr: 'Sınav Platformu', en: 'Exam Platform' },
  settings: { tr: 'Ayarlar', en: 'Settings' },
  sandbox: { tr: 'Geliştirici Sandbox', en: 'Developer Sandbox' }
};

// Executes any "acadia-action" block the assistant appended to its reply
// (transferring content to the notebook, navigating to a tab, or adding a
// Study Planner event) and returns the reply text with the action block
// stripped out, so the chat bubble only shows the conversational part.
// Accepts the current {"actions":[...]} shape as well as the older single
// {"action":"add_sticky_notes","items":[...]} shape for backward compatibility.
async function processAcadiaActionBlock(rawReply) {
  const match = /```acadia-action\s*([\s\S]*?)```/.exec(rawReply || '');
  if (!match) return { displayText: rawReply, actionTaken: false };

  const displayText = rawReply.slice(0, match.index).trim() + rawReply.slice(match.index + match[0].length).trim();
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';

  let parsed;
  try {
    parsed = JSON.parse(match[1].trim());
  } catch (err) {
    console.error('Failed to parse Acadia action block:', err, match[1]);
    return { displayText: displayText || rawReply, actionTaken: false };
  }

  let actions = [];
  if (Array.isArray(parsed?.actions)) {
    actions = parsed.actions;
  } else if (parsed?.action === 'add_sticky_notes') {
    actions = [{ type: 'add_sticky_notes', items: parsed.items }];
  }
  if (actions.length === 0) return { displayText: displayText || rawReply, actionTaken: false };

  const summaryParts = [];

  for (const action of actions.slice(0, 5)) {
    if (!action || typeof action.type !== 'string') continue;

    try {
      if (action.type === 'add_sticky_notes' && Array.isArray(action.items) && action.items.length > 0) {
        let added = 0;
        action.items.slice(0, 20).forEach((item, idx) => {
          const title = (item && item.title) ? String(item.title).slice(0, 80) : 'Acadia';
          const text = (item && item.text) ? String(item.text).slice(0, 500) : '';
          if (!text) return;
          addStickyNoteToNotebook(`acadia-${Date.now()}-${idx}`, title.replace(/</g, '&lt;'), text.replace(/</g, '&lt;'));
          added++;
        });
        if (added > 0) {
          summaryParts.push(isTr ? `🗒️ ${added} not deftere eklendi` : `🗒️ ${added} note(s) added to your notebook`);
        }
      } else if (action.type === 'switch_tab' && ACADIA_VALID_TABS.includes(action.tab)) {
        switchDashboardView(action.tab);
        const tabLabel = ACADIA_TAB_LABELS[action.tab]?.[isTr ? 'tr' : 'en'] || action.tab;
        summaryParts.push(isTr ? `📂 ${tabLabel} sekmesine geçildi` : `📂 switched to ${tabLabel}`);
      } else if (action.type === 'add_planner_event' && action.title && /^\d{4}-\d{2}-\d{2}$/.test(String(action.date || ''))) {
        const eventType = ACADIA_VALID_EVENT_TYPES.includes(action.event_type) ? action.event_type : 'other';
        const eventTitle = String(action.title).slice(0, 150);
        const { error } = await supabaseClient.from('study_events').insert({
          user_id: currentUser.id,
          title: eventTitle,
          event_date: action.date,
          event_type: eventType,
          notes: isTr ? 'Acadia tarafından eklendi' : 'Added by Acadia',
          is_done: false
        });
        if (!error) {
          summaryParts.push(isTr ? `📅 "${eventTitle}" planlayıcıya eklendi (${action.date})` : `📅 "${eventTitle}" added to your planner (${action.date})`);
          if (currentActiveTab === 'planner' && typeof loadPlannerEvents === 'function') loadPlannerEvents();
        } else {
          console.error('Acadia add_planner_event failed:', error);
        }
      }
    } catch (err) {
      console.error('Error executing Acadia action:', action, err);
    }
  }

  if (summaryParts.length > 0) {
    showDashboardAlert('success', summaryParts.join(' · '));
  }

  return {
    displayText: displayText || (isTr ? 'Tamamdır, hallettim!' : "Done, I've taken care of that!"),
    actionTaken: summaryParts.length > 0
  };
}

function renderAcadiaMessage(role, text) {
  const messages = document.getElementById('acadia-messages');
  if (!messages) return;

  const bubble = document.createElement('div');
  const isUser = role === 'user';
  bubble.style.cssText = `
    max-width: 85%;
    align-self: ${isUser ? 'flex-end' : 'flex-start'};
    background: ${isUser ? 'var(--color-teal)' : 'var(--color-bg-alt)'};
    color: ${isUser ? 'white' : 'var(--color-navy)'};
    padding: 0.6rem 0.85rem;
    border-radius: ${isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px'};
    font-size: 0.83rem;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  `;
  bubble.textContent = text;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
}

async function sendAcadiaMessage(text) {
  if (acadiaRequestInFlight) return;
  if (!currentUser) {
    showDashboardAlert('error', 'Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    return;
  }

  renderAcadiaMessage('user', text);
  acadiaChatHistory.push({ role: 'user', content: text });

  const sendBtn = document.getElementById('btn-acadia-send');
  const typingIndicator = document.getElementById('acadia-typing-indicator');
  acadiaRequestInFlight = true;
  if (sendBtn) sendBtn.disabled = true;
  if (typingIndicator) typingIndicator.style.display = 'block';

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      showDashboardAlert('error', 'Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }

    const uiLang = localStorage.getItem('acadexUILang') || 'en';

    // Prior turns only — the latest user message is sent separately as
    // `message` (acadia-assistant's expected shape), capped so the request
    // stays small and cheap.
    const priorHistory = acadiaChatHistory.slice(0, -1).slice(-6);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/acadia-assistant`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        message: text,
        history: priorHistory,
        language: uiLang,
        studyCardId: acadiaSelectedCardId || null
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Acadia request failed:', data);
      const isTr = uiLang === 'tr';
      const errMsg = isTr
        ? 'Acadia şu anda yanıt vermekte zorlanıyor, lütfen tekrar deneyin.'
        : 'Acadia is having trouble responding right now, please try again.';
      renderAcadiaMessage('assistant', errMsg);
      // Remove failed user message from history so they can retry without building up bad history
      acadiaChatHistory.pop();
      return;
    }

    const { displayText } = await processAcadiaActionBlock(data.reply);
    renderAcadiaMessage('assistant', displayText);
    // Keep the displayed (action-block-stripped) text in history so future
    // turns aren't confused by re-seeing raw action JSON.
    acadiaChatHistory.push({ role: 'assistant', content: displayText });
  } catch (err) {
    console.error('Exception messaging Acadia:', err);
    const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
    const errMsg = isTr
      ? 'Acadia şu anda yanıt vermekte zorlanıyor, lütfen tekrar deneyin.'
      : 'Acadia is having trouble responding right now, please try again.';
    renderAcadiaMessage('assistant', errMsg);
    acadiaChatHistory.pop();
  } finally {
    acadiaRequestInFlight = false;
    if (sendBtn) sendBtn.disabled = false;
    if (typingIndicator) typingIndicator.style.display = 'none';
  }
}
window.sendAcadiaMessage = sendAcadiaMessage;

// ==========================================
// STUDY NOTEBOOK SHAPES AND IMAGE CREATOR
// ==========================================
let notebookActiveShapeTool = null; // 'rectangle', 'circle', 'line', 'arrow'
let isDrawingShape = false;
let shapeStartX = 0;
let shapeStartY = 0;
let activeShapeElement = null;
let shapeFlippedX = false;
let shapeFlippedY = false;

function toggleShapeDropdown(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const menu = document.getElementById('shape-menu');
  if (menu) {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
}

function selectShapeMode(shapeType, e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  notebookActiveShapeTool = shapeType;
  setNotebookMode('shape');
  
  const menu = document.getElementById('shape-menu');
  if (menu) menu.style.display = 'none';
  
  const btnShape = document.getElementById('tool-shape');
  if (btnShape) {
    btnShape.classList.add('active');
    btnShape.innerHTML = getShapeEmoji(shapeType);
  }
}

function getShapeEmoji(type) {
  if (type === 'rectangle') return '⬜';
  if (type === 'circle') return '⚪';
  if (type === 'line') return '➖';
  if (type === 'arrow') return '➡️';
  return '🔺';
}

function startDrawingShape(e) {
  const overlay = document.getElementById('notebook-overlay-container');
  if (!overlay || !notebookActiveShapeTool) return;

  isDrawingShape = true;
  const rect = canvasElement.getBoundingClientRect();
  shapeStartX = e.clientX - rect.left;
  shapeStartY = e.clientY - rect.top;

  const id = 'shape-' + Date.now();
  activeShapeElement = document.createElement('div');
  activeShapeElement.className = 'draggable-element draggable-shape-wrapper';
  activeShapeElement.id = id;
  activeShapeElement.style.left = `${shapeStartX}px`;
  activeShapeElement.style.top = `${shapeStartY}px`;
  activeShapeElement.style.width = '0px';
  activeShapeElement.style.height = '0px';
  
  activeShapeElement.setAttribute('data-type', 'shape');
  activeShapeElement.setAttribute('data-shape-type', notebookActiveShapeTool);
  activeShapeElement.setAttribute('data-color', currentPenColor);
  activeShapeElement.setAttribute('data-flipped-x', 'false');
  activeShapeElement.setAttribute('data-flipped-y', 'false');

  overlay.appendChild(activeShapeElement);
}

function updateDrawingShape(e) {
  if (!activeShapeElement) return;
  const rect = canvasElement.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  const dx = currentX - shapeStartX;
  const dy = currentY - shapeStartY;
  const w = Math.max(0, Math.abs(dx));
  const h = Math.max(0, Math.abs(dy));
  
  const left = dx >= 0 ? shapeStartX : currentX;
  const top = dy >= 0 ? shapeStartY : currentY;
  
  shapeFlippedX = dx < 0;
  shapeFlippedY = dy < 0;

  activeShapeElement.style.left = `${left}px`;
  activeShapeElement.style.top = `${top}px`;
  activeShapeElement.style.width = `${w}px`;
  activeShapeElement.style.height = `${h}px`;
  
  activeShapeElement.setAttribute('data-flipped-x', shapeFlippedX ? 'true' : 'false');
  activeShapeElement.setAttribute('data-flipped-y', shapeFlippedY ? 'true' : 'false');

  const shapeType = activeShapeElement.getAttribute('data-shape-type');
  const color = activeShapeElement.getAttribute('data-color');
  
  activeShapeElement.innerHTML = getShapeInnerHtml(activeShapeElement.id, shapeType, color, shapeFlippedX, shapeFlippedY);
}

function getShapeInnerHtml(id, type, color, flippedX, flippedY) {
  const deleteBtn = `<button class="delete-overlay-btn" title="Delete Shape" onclick="removeOverlayElement('${id}')" style="top: -6px; right: -6px;">×</button>`;
  
  let contentHtml = '';
  if (type === 'rectangle') {
    contentHtml = `<div style="width: 100%; height: 100%; border: 3px solid ${color}; box-sizing: border-box; background: transparent;"></div>`;
  }
  else if (type === 'circle') {
    contentHtml = `<div style="width: 100%; height: 100%; border: 3px solid ${color}; border-radius: 50%; box-sizing: border-box; background: transparent;"></div>`;
  }
  else if (type === 'line') {
    contentHtml = `
      <svg style="width: 100%; height: 100%; overflow: visible; pointer-events: none; display: block;">
        <line x1="${flippedX ? '100%' : '0%'}" y1="${flippedY ? '100%' : '0%'}" x2="${flippedX ? '0%' : '100%'}" y2="${flippedY ? '0%' : '100%'}" stroke="${color}" stroke-width="3" />
      </svg>
    `;
  }
  else if (type === 'arrow') {
    contentHtml = `
      <svg style="width: 100%; height: 100%; overflow: visible; pointer-events: none; display: block;">
        <defs>
          <marker id="arrowhead-${id}" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="${color}" />
          </marker>
        </defs>
        <line x1="${flippedX ? '100%' : '0%'}" y1="${flippedY ? '100%' : '0%'}" x2="${flippedX ? '0%' : '100%'}" y2="${flippedY ? '0%' : '100%'}" stroke="${color}" stroke-width="3" marker-end="url(#arrowhead-${id})" />
      </svg>
    `;
  }
  
  const dragHandle = `<div class="drag-handle-bar shape-drag-handle" style="position: absolute; inset: 0; cursor: move; background: transparent; z-index: 1;"></div>`;
  
  return dragHandle + deleteBtn + contentHtml;
}

function insertShapeElement(id, shapeType, color, left, top, width, height, flippedX, flippedY) {
  const overlay = document.getElementById('notebook-overlay-container');
  if (!overlay) return;

  const shapeWrapper = document.createElement('div');
  shapeWrapper.className = 'draggable-element draggable-shape-wrapper';
  shapeWrapper.id = id;
  shapeWrapper.style.left = `${left}px`;
  shapeWrapper.style.top = `${top}px`;
  shapeWrapper.style.width = `${width}px`;
  shapeWrapper.style.height = `${height}px`;
  
  shapeWrapper.setAttribute('data-type', 'shape');
  shapeWrapper.setAttribute('data-shape-type', shapeType);
  shapeWrapper.setAttribute('data-color', color);
  shapeWrapper.setAttribute('data-flipped-x', flippedX ? 'true' : 'false');
  shapeWrapper.setAttribute('data-flipped-y', flippedY ? 'true' : 'false');

  shapeWrapper.innerHTML = getShapeInnerHtml(id, shapeType, color, flippedX, flippedY);
  
  overlay.appendChild(shapeWrapper);

  const resizer = document.createElement('div');
  resizer.className = 'table-resizer';
  resizer.innerHTML = `
    <svg width="10" height="10" viewBox="0 0 10 10" style="position: absolute; bottom: 1px; right: 1px; pointer-events: none;">
      <path d="M10 0 L0 10 M10 4 L4 10 M10 8 L8 10" stroke="#94A3B8" stroke-width="1.5"/>
    </svg>
  `;
  shapeWrapper.appendChild(resizer);

  makeElementDraggable(shapeWrapper, shapeWrapper.querySelector('.drag-handle-bar'));
  makeElementResizable(shapeWrapper, resizer);
}

function triggerNotebookImageUpload(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const fileInput = document.getElementById('notebook-image-uploader');
  if (fileInput) fileInput.click();
}

function handleNotebookImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    const isTr = localStorage.getItem('acadexUILang') === 'tr';
    showDashboardAlert('error', isTr 
      ? 'Resim boyutu 2MB\'tan küçük olmalıdır.' 
      : 'Image must be under 2MB. Please resize or compress it.');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const base64Url = evt.target.result;
    insertImageElement(base64Url, 100, 150, 200, 150);
    e.target.value = '';
  };
  reader.readAsDataURL(file);
}

function insertImageElement(src, x, y, width, height, id) {
  const overlay = document.getElementById('notebook-overlay-container');
  if (!overlay) return;

  const elementId = id || 'img-' + Date.now();
  
  const imgWrapper = document.createElement('div');
  imgWrapper.className = 'draggable-element draggable-image-wrapper';
  imgWrapper.id = elementId;
  imgWrapper.style.left = `${x}px`;
  imgWrapper.style.top = `${y}px`;
  imgWrapper.style.width = `${width}px`;
  imgWrapper.style.height = `${height}px`;
  imgWrapper.setAttribute('data-type', 'image');
  imgWrapper.setAttribute('data-src', src);

  imgWrapper.innerHTML = `
    <div class="drag-handle-bar" style="height: 12px; background: rgba(148, 163, 184, 0.2); cursor: move;"></div>
    <button class="delete-overlay-btn" title="Delete Image" onclick="removeOverlayElement('${elementId}')" style="top: -6px; right: -6px;">×</button>
    <img src="${src}" style="width: 100%; height: calc(100% - 12px); object-fit: contain; pointer-events: none; display: block;">
  `;

  overlay.appendChild(imgWrapper);
  makeElementDraggable(imgWrapper, imgWrapper.querySelector('.drag-handle-bar'));

  const resizer = document.createElement('div');
  resizer.className = 'table-resizer';
  resizer.innerHTML = `
    <svg width="10" height="10" viewBox="0 0 10 10" style="position: absolute; bottom: 1px; right: 1px; pointer-events: none;">
      <path d="M10 0 L0 10 M10 4 L4 10 M10 8 L8 10" stroke="#94A3B8" stroke-width="1.5"/>
    </svg>
  `;
  imgWrapper.appendChild(resizer);
  makeElementResizable(imgWrapper, resizer);

  notebookHasUnsavedChanges = true;
}

// Close shape menu when clicking outside
document.addEventListener('click', (e) => {
  const menu = document.getElementById('shape-menu');
  if (menu && !e.target.closest('.shape-dropdown')) {
    menu.style.display = 'none';
  }
});

// Bind window level handlers
window.toggleShapeDropdown = toggleShapeDropdown;
window.selectShapeMode = selectShapeMode;
window.triggerNotebookImageUpload = triggerNotebookImageUpload;
window.handleNotebookImageUpload = handleNotebookImageUpload;
window.insertShapeElement = insertShapeElement;
window.insertImageElement = insertImageElement;

// ==========================================
// PART A & B BADGE HELPERS & PART D FEEDBACK
// ==========================================
function getDocumentTypeBadgeHtml(type) {
  if (!type || type === 'null' || type === 'undefined' || (typeof type === 'string' && !type.trim())) return '';
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  let label = type;
  let emoji = '📄';
  const typeStr = String(type);
  if (typeStr.includes('Lecture') || typeStr.includes('Slide')) {
    emoji = '📖';
    label = isTr ? 'Ders Notları' : 'Lecture Notes';
  } else if (typeStr.includes('Article')) {
    emoji = '🔬';
    label = isTr ? 'Akademik Makale' : 'Academic Article';
  } else if (typeStr.includes('Syllabus')) {
    emoji = '📋';
    label = isTr ? 'Müfredat' : 'Syllabus';
  } else if (typeStr.includes('Case')) {
    emoji = '💼';
    label = isTr ? 'Vaka Çalışması' : 'Case Study';
  } else if (typeStr.includes('Textbook')) {
    emoji = '📚';
    label = isTr ? 'Ders Kitabı' : 'Textbook Chapter';
  } else if (typeStr === 'Other') {
    emoji = '📄';
    label = isTr ? 'Diğer' : 'Other';
  } else {
    emoji = '📄';
    label = typeStr;
  }
  return `<span class="style-badge" style="margin: 0; font-size: 0.6rem; padding: 0.1rem 0.35rem; background-color: #F1F5F9; color: #475569; border: 1px solid rgba(22, 50, 92, 0.08); font-weight: 700;">${emoji} ${label}</span>`;
}

function getLengthBadgeHtml(len) {
  if (!len || len === 'null' || len === 'undefined' || (typeof len === 'string' && !len.trim())) return '';
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  let label = len;
  if (len === 'short') label = isTr ? 'Kısa' : 'Short';
  else if (len === 'medium') label = isTr ? 'Orta' : 'Medium';
  else if (len === 'detailed') label = isTr ? 'Detaylı' : 'Detailed';
  return `<span class="style-badge" style="margin: 0; font-size: 0.6rem; padding: 0.1rem 0.35rem; background-color: #EEF2FF; color: #4F46E5; border: 1px solid rgba(22, 50, 92, 0.08); font-weight: 700;">${label}</span>`;
}

function getVisualAnalysisBadgeHtml(used) {
  if (!used) return '';
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const label = isTr ? 'Görsel Analiz' : 'Visual Analysis';
  return `<span class="style-badge" style="margin: 0; font-size: 0.6rem; padding: 0.1rem 0.35rem; background-color: #FDF2F8; color: #DB2777; border: 1px solid rgba(22, 50, 92, 0.08); font-weight: 700;">🖼️ ${label}</span>`;
}
window.getVisualAnalysisBadgeHtml = getVisualAnalysisBadgeHtml;

function getQuantitativeBadgeHtml(isQuant) {
  if (!isQuant) return '';
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const label = isTr ? 'Sayısal Ders' : 'Quantitative Course';
  return `<span class="style-badge" style="margin: 0; font-size: 0.6rem; padding: 0.1rem 0.35rem; background-color: rgba(99, 102, 241, 0.12); color: #4F46E5; border: 1px solid rgba(99, 102, 241, 0.2); font-weight: 700;">🔢 ${label}</span>`;
}
window.getQuantitativeBadgeHtml = getQuantitativeBadgeHtml;

function highlightFeedbackButtons(rating) {
  const btnUp = document.getElementById('btn-vote-up');
  const btnDown = document.getElementById('btn-vote-down');
  if (!btnUp || !btnDown) return;
  
  // Reset styles to default premium border-less light look
  btnUp.style.backgroundColor = 'var(--color-white)';
  btnUp.style.borderColor = 'rgba(22, 50, 92, 0.1)';
  btnUp.style.color = '';
  btnDown.style.backgroundColor = 'var(--color-white)';
  btnDown.style.borderColor = 'rgba(22, 50, 92, 0.1)';
  btnDown.style.color = '';
  
  if (rating === 'up') {
    btnUp.style.backgroundColor = 'var(--color-teal-light)';
    btnUp.style.borderColor = 'var(--color-teal)';
  } else if (rating === 'down') {
    btnDown.style.backgroundColor = '#FEE2E2';
    btnDown.style.borderColor = '#EF4444';
  }
}

async function submitSummaryFeedback(rating) {
  if (!currentActiveStudyCard || !currentActiveStudyCard.id) return;
  const studyCardId = currentActiveStudyCard.id;
  const user = currentUser;
  if (!user) return;
  
  try {
    const { error } = await supabaseClient
      .from('summary_feedback')
      .upsert({ 
        study_card_id: studyCardId, 
        user_id: user.id, 
        rating: rating 
      }, { onConflict: 'study_card_id,user_id' });
      
    if (error) {
      console.error("Feedback submit failed: ", error);
      showDashboardAlert('error', 'Feedback submission failed.');
      return;
    }
    
    // Update local UI state
    highlightFeedbackButtons(rating);
    currentActiveStudyCard.user_rating = rating;
    
    const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
    showDashboardAlert('success', isTr ? 'Geri bildiriminiz için teşekkürler!' : 'Thank you for your feedback!');
  } catch (err) {
    console.error("Feedback submit exception: ", err);
  }
}

window.getDocumentTypeBadgeHtml = getDocumentTypeBadgeHtml;
window.getLengthBadgeHtml = getLengthBadgeHtml;
window.highlightFeedbackButtons = highlightFeedbackButtons;
window.submitSummaryFeedback = submitSummaryFeedback;

async function checkFileHashDuplicate(file) {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const fileHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const { data: existing, error } = await supabaseClient
      .from('documents')
      .select('id, file_name')
      .eq('user_id', currentUser.id)
      .eq('file_hash', fileHash)
      .maybeSingle();

    if (!error && existing) {
      const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
      const confirmMsg = isTr
        ? `Bu dosya içeriğiyle daha önce '${existing.file_name}' adında bir dosya yüklemiştiniz. Yine de tekrar yüklemek istiyor musunuz?`
        : `You've already uploaded a file with this exact content, named '${existing.file_name}'. Upload it again anyway?`;
      if (!window.confirm(confirmMsg)) {
        return { shouldUpload: false, fileHash };
      }
    }
    return { shouldUpload: true, fileHash };
  } catch (err) {
    console.error("Error checking file hash duplicate:", err);
    return { shouldUpload: true, fileHash: null };
  }
}
window.checkFileHashDuplicate = checkFileHashDuplicate;

async function triggerSectionRegeneration(section) {
  if (!activeModalCardId) return;
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  
  // Find the button
  const sectionTitleEl = document.querySelector(`.btn-regenerate-section[onclick="triggerSectionRegeneration('${section}')"]`);
  if (!sectionTitleEl) return;
  
  const originalHtml = sectionTitleEl.innerHTML;
  sectionTitleEl.disabled = true;
  sectionTitleEl.innerHTML = `
    <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 12px; height: 12px; margin-right: 4px; display: inline-block;">
      <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
    </svg>
    <span class="btn-regen-text">${isTr ? 'Yenileniyor...' : 'Refreshing...'}</span>
  `;
  
  try {
    const { data, error } = await supabaseClient.functions.invoke('regenerate-section', {
      body: { studyCardId: activeModalCardId, section: section }
    });
    
    if (error || !data || !data.success) {
      console.error("Regenerate section failed: ", error || data);
      showDashboardAlert('error', isTr 
        ? 'Bölüm yenilenemedi. Lütfen tekrar deneyin.' 
        : 'Failed to regenerate section. Please try again.');
      return;
    }
    
    const newContent = data.content;
    
    if (section === 'summary') {
      const summaryText = document.getElementById('study-card-summary-text');
      if (summaryText) {
        summaryText.innerHTML = formatSummaryText(newContent) || "";
      }
      if (currentActiveStudyCard) currentActiveStudyCard.summary = newContent;
    } else if (section === 'key_points') {
      const pointsContainer = document.getElementById('study-card-points-container');
      if (pointsContainer) {
        pointsContainer.innerHTML = '';
        const keyPoints = newContent || [];
        if (keyPoints.length === 0) {
          pointsContainer.innerHTML = '<li class="study-card-point-item">No key points generated.</li>';
        } else {
          keyPoints.forEach(pt => {
            const li = document.createElement('li');
            li.className = 'study-card-point-item';
            li.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>${pt}</span>
            `;
            pointsContainer.appendChild(li);
          });
        }
      }
      if (currentActiveStudyCard) currentActiveStudyCard.key_points = newContent;
    } else if (section === 'key_terms') {
      const termsContainer = document.getElementById('study-card-terms-container');
      if (termsContainer) {
        termsContainer.innerHTML = '';
        const keyTerms = newContent || [];
        if (keyTerms.length === 0) {
          termsContainer.innerHTML = '<div style="color: var(--color-text-muted); font-size: 0.9rem;">No key terms generated.</div>';
        } else {
          keyTerms.forEach(t => {
            const div = document.createElement('div');
            div.className = 'key-term-card';
            div.innerHTML = `
              <div class="key-term-word">${t.term}</div>
              <div class="key-term-def">${t.definition}</div>
            `;
            termsContainer.appendChild(div);
          });
        }
      }
      if (currentActiveStudyCard) currentActiveStudyCard.key_terms = newContent;
    } else if (section === 'quiz_questions') {
      const quizContainer = document.getElementById('study-card-quiz-container');
      if (quizContainer) {
        quizContainer.innerHTML = '';
        const quizQuestions = newContent || [];
        if (quizQuestions.length === 0) {
          quizContainer.innerHTML = '<div style="color: var(--color-text-muted); font-size: 0.9rem;">No quiz questions generated.</div>';
        } else {
          quizQuestions.forEach((q, idx) => {
            const div = document.createElement('div');
            div.className = 'quiz-item';
            div.id = `quiz-item-${idx}`;
            div.innerHTML = `
              <div class="quiz-question-header" onclick="toggleQuizAnswer(${idx})">
                <span>Q${idx + 1}: ${q.question}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              <div class="quiz-answer-body" id="quiz-answer-${idx}">
                <strong style="color: var(--color-teal);">Answer:</strong> ${q.answer}
              </div>
            `;
            quizContainer.appendChild(div);
          });
        }
      }
      if (currentActiveStudyCard) currentActiveStudyCard.quiz_questions = newContent;
    }
    
    // Update local card grid data too so it doesn't revert if opened again without reloading
    const cachedCard = activeStudyCards.find(c => c.id === activeModalCardId);
    if (cachedCard) {
      cachedCard[section] = newContent;
    }
    const cachedLibCard = libraryCards.find(c => c.id === activeModalCardId);
    if (cachedLibCard) {
      cachedLibCard[section] = newContent;
    }
    const cachedNotebookCard = notebookCards.find(c => c.id === activeModalCardId);
    if (cachedNotebookCard) {
      cachedNotebookCard[section] = newContent;
    }

    // Refresh lists in background so grid cards look up-to-date
    renderDocumentsList();
    if (window.renderCardsLibraryList) {
      window.renderCardsLibraryList();
    }
    if (window.loadNotebookCards) {
      window.loadNotebookCards();
    }
    
    showDashboardAlert('success', isTr ? 'Bölüm başarıyla güncellendi!' : 'Section refreshed!');
    
  } catch (err) {
    console.error("Exception in triggerSectionRegeneration: ", err);
    showDashboardAlert('error', isTr 
      ? 'Yenileme sırasında beklenmeyen bir hata oluştu.' 
      : 'An unexpected error occurred during regeneration.');
  } finally {
    sectionTitleEl.disabled = false;
    sectionTitleEl.innerHTML = originalHtml;
  }
}
window.triggerSectionRegeneration = triggerSectionRegeneration;

// ==========================================
// SUGGESTED COURSE TAG CHIPS (PART C)
// ==========================================
function renderSuggestedTagChipHtml(docId, cardId, suggestedTag) {
  if (!suggestedTag) return '';
  const escapedTag = escapeHtml(suggestedTag).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  return `
    <div class="suggested-tag-chip" id="suggested-chip-${cardId || docId}">
      <span>Suggested: <strong>${escapeHtml(suggestedTag)}</strong></span>
      <button type="button" class="btn-accept-tag" onclick="acceptSuggestedTag(event, '${docId || ''}', '${cardId || ''}', '${escapedTag}')" title="Accept Tag">✓ Accept</button>
      <button type="button" class="btn-dismiss-tag" onclick="dismissSuggestedTag(event, '${cardId || docId}')" title="Dismiss Tag">✕ Dismiss</button>
    </div>
  `;
}

async function acceptSuggestedTag(event, docId, cardId, suggestedTag) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  try {
    if (docId) {
      await supabaseClient
        .from('documents')
        .update({ course_tag: suggestedTag })
        .eq('id', docId);
    }
    
    if (cardId) {
      await supabaseClient
        .from('study_cards')
        .update({ course_tag: suggestedTag })
        .eq('id', cardId);
    } else if (docId) {
      await supabaseClient
        .from('study_cards')
        .update({ course_tag: suggestedTag })
        .eq('document_id', docId);
    }

    showDashboardAlert('success', `Course tag set to '${suggestedTag}'!`);
    dismissSuggestedTag(null, cardId || docId);
    
    if (typeof loadDocuments === 'function') loadDocuments();
    if (typeof loadCardsLibrary === 'function') loadCardsLibrary();

  } catch (err) {
    console.error("Exception accepting suggested tag:", err);
    showDashboardAlert('error', 'Could not save suggested course tag.');
  }
}

function dismissSuggestedTag(event, chipId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const chip = document.getElementById(`suggested-chip-${chipId}`);
  if (chip) chip.remove();
}

window.renderSuggestedTagChipHtml = renderSuggestedTagChipHtml;
window.acceptSuggestedTag = acceptSuggestedTag;
window.dismissSuggestedTag = dismissSuggestedTag;

// ==========================================
// DOCUMENT COMPARISON MODE CONTROLLERS (PART D)
// ==========================================
let pendingCompareDocIds = [];

function openCompareModal() {
  if (selectedDocIds.length < 2) {
    showDashboardAlert('error', 'Select at least 2 documents to compare.');
    return;
  }
  pendingCompareDocIds = [...selectedDocIds];
  const modal = document.getElementById('compare-modal');
  if (modal) modal.style.display = 'flex';
}

function closeCompareModal() {
  const modal = document.getElementById('compare-modal');
  if (modal) modal.style.display = 'none';
}

async function startDocumentComparison() {
  if (pendingCompareDocIds.length < 2) {
    showDashboardAlert('error', 'Select at least 2 documents to compare.');
    return;
  }

  const langRadio = document.querySelector('input[name="compare-language-choice"]:checked');
  const language = langRadio ? langRadio.value : 'en';

  const btnStart = document.getElementById('btn-start-compare');
  const originalText = btnStart ? btnStart.textContent : 'Compare';
  if (btnStart) {
    btnStart.disabled = true;
    btnStart.textContent = 'Comparing...';
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      showDashboardAlert('error', 'You must be logged in.');
      return;
    }

    const { data, error } = await supabaseClient.functions.invoke('compare-documents', {
      body: { documentIds: pendingCompareDocIds, language }
    });

    if (error || !data) {
      console.error("Compare documents invocation error:", error);
      showDashboardAlert('error', 'Document comparison failed. Please try again.');
      return;
    }

    closeCompareModal();
    resetBulkSelection();
    openComparisonResultModal(data);
    await loadPastComparisons();

  } catch (err) {
    console.error("Exception in startDocumentComparison:", err);
    showDashboardAlert('error', 'An error occurred during document comparison.');
  } finally {
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.textContent = originalText;
    }
  }
}

function openComparisonResultModal(comparisonData) {
  if (!comparisonData) return;

  const modal = document.getElementById('comparison-result-modal');
  const docNamesEl = document.getElementById('comparison-doc-names');
  const summaryEl = document.getElementById('comparison-summary-text');
  const similaritiesList = document.getElementById('comparison-similarities-list');
  const differencesContainer = document.getElementById('comparison-differences-container');

  if (docNamesEl) {
    const names = comparisonData.document_names || [];
    docNamesEl.textContent = `Comparing (${names.length}): ${names.join('  vs.  ')}`;
  }

  if (summaryEl) {
    summaryEl.textContent = comparisonData.comparison_summary || 'No comparison summary generated.';
  }

  if (similaritiesList) {
    similaritiesList.innerHTML = '';
    const similarities = comparisonData.similarities || [];
    if (similarities.length === 0) {
      similaritiesList.innerHTML = '<li style="color: var(--color-text-muted);">No major similarities identified.</li>';
    } else {
      similarities.forEach(sim => {
        const li = document.createElement('li');
        li.textContent = sim;
        similaritiesList.appendChild(li);
      });
    }
  }

  if (differencesContainer) {
    differencesContainer.innerHTML = '';
    const differences = comparisonData.differences || [];
    if (differences.length === 0) {
      differencesContainer.innerHTML = '<div style="color: var(--color-text-muted); font-size: 0.85rem;">No major differences identified.</div>';
    } else {
      differences.forEach(diff => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'difference-card';
        cardDiv.innerHTML = `
          <div class="difference-aspect-title">${escapeHtml(diff.aspect || 'Dimension')}</div>
          <div style="font-size: 0.85rem; color: var(--color-navy); line-height: 1.45;">${escapeHtml(diff.comparison || '')}</div>
        `;
        differencesContainer.appendChild(cardDiv);
      });
    }
  }

  if (modal) modal.style.display = 'flex';
}

function closeComparisonResultModal() {
  const modal = document.getElementById('comparison-result-modal');
  if (modal) modal.style.display = 'none';
}

async function loadPastComparisons() {
  const listEl = document.getElementById('past-comparisons-list');
  if (!listEl) return;

  try {
    const { data: comparisons, error } = await supabaseClient
      .from('document_comparisons')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error || !comparisons || comparisons.length === 0) {
      listEl.innerHTML = '<p style="font-size: 0.8rem; color: var(--color-text-muted); font-style: italic;">No past comparisons yet. Select 2+ documents in My Documents and click "Compare Documents"!</p>';
      return;
    }

    listEl.innerHTML = '';
    comparisons.forEach(comp => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'past-comparison-card';
      const namesText = (comp.document_names || []).join(' vs ');
      const dateText = new Date(comp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const langBadge = comp.language === 'tr' ? 'Türkçe' : 'English';

      cardDiv.innerHTML = `
        <div>
          <div style="font-weight: 700; font-size: 0.875rem; color: var(--color-navy); margin-bottom: 0.2rem;">⚖️ ${escapeHtml(namesText)}</div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">${dateText} &bull; <span style="color: var(--color-teal); font-weight: 600;">${langBadge}</span></div>
        </div>
        <button class="btn btn-outline" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;" onclick="event.stopPropagation(); viewPastComparison('${comp.id}')">View</button>
      `;

      cardDiv.addEventListener('click', () => {
        openComparisonResultModal(comp);
      });

      listEl.appendChild(cardDiv);
    });

  } catch (err) {
    console.error("Exception loading past comparisons:", err);
  }
}

async function viewPastComparison(compObjId) {
  try {
    const { data: comp } = await supabaseClient
      .from('document_comparisons')
      .select('*')
      .eq('id', compObjId)
      .single();
    if (comp) openComparisonResultModal(comp);
  } catch(e) {}
}

window.openCompareModal = openCompareModal;
window.closeCompareModal = closeCompareModal;
window.startDocumentComparison = startDocumentComparison;
window.openComparisonResultModal = openComparisonResultModal;
window.closeComparisonResultModal = closeComparisonResultModal;
window.loadPastComparisons = loadPastComparisons;
window.viewPastComparison = viewPastComparison;

// ==========================================
// PART A — PAGE TEMPLATES
// ==========================================
function openTemplatePickerModal() {
  const modal = document.getElementById('template-picker-modal');
  if (modal) modal.style.display = 'flex';
}

function closeTemplatePickerModal() {
  const modal = document.getElementById('template-picker-modal');
  if (modal) modal.style.display = 'none';
}

async function selectNotebookTemplate(templateType) {
  closeTemplatePickerModal();

  if (notebookHasUnsavedChanges) {
    const isTr = localStorage.getItem('acadexUILang') === 'tr';
    const confirmSave = confirm(
      isTr 
        ? "Kaydedilmemiş değişiklikleriniz var. Yeni sayfa oluşturmadan önce kaydetmek ister misiniz?"
        : "You have unsaved changes. Would you like to save before creating a new page?"
    );
    if (confirmSave) {
      await saveNotebookData();
    }
  }

  const maxPageNum = notebookPages.reduce((max, p) => Math.max(max, p.page_number), 0);
  const newPageNum = maxPageNum + 1;

  let starterElements = [];

  if (templateType === 'swot') {
    const w = 340, h = 270;
    // Strengths (Top-Left)
    starterElements.push({
      type: 'shape', id: `shape-${Date.now()}-1`, left: 20, top: 20, width: w, height: h, color: '#6366F1',
      content: { shapeType: 'rectangle', flippedX: 'false', flippedY: 'false' }
    });
    starterElements.push({
      type: 'text', id: `text-${Date.now()}-1`, left: 35, top: 30, width: w - 30, height: 40, color: '#4338CA', fontSize: '18px',
      content: '<strong>💪 STRENGTHS</strong>'
    });

    // Weaknesses (Top-Right)
    starterElements.push({
      type: 'shape', id: `shape-${Date.now()}-2`, left: 380, top: 20, width: w, height: h, color: '#EF4444',
      content: { shapeType: 'rectangle', flippedX: 'false', flippedY: 'false' }
    });
    starterElements.push({
      type: 'text', id: `text-${Date.now()}-2`, left: 395, top: 30, width: w - 30, height: 40, color: '#B91C1C', fontSize: '18px',
      content: '<strong>⚠️ WEAKNESSES</strong>'
    });

    // Opportunities (Bottom-Left)
    starterElements.push({
      type: 'shape', id: `shape-${Date.now()}-3`, left: 20, top: 310, width: w, height: h, color: '#10B981',
      content: { shapeType: 'rectangle', flippedX: 'false', flippedY: 'false' }
    });
    starterElements.push({
      type: 'text', id: `text-${Date.now()}-3`, left: 35, top: 320, width: w - 30, height: 40, color: '#047857', fontSize: '18px',
      content: '<strong>🚀 OPPORTUNITIES</strong>'
    });

    // Threats (Bottom-Right)
    starterElements.push({
      type: 'shape', id: `shape-${Date.now()}-4`, left: 380, top: 310, width: w, height: h, color: '#F59E0B',
      content: { shapeType: 'rectangle', flippedX: 'false', flippedY: 'false' }
    });
    starterElements.push({
      type: 'text', id: `text-${Date.now()}-4`, left: 395, top: 320, width: w - 30, height: 40, color: '#B45309', fontSize: '18px',
      content: '<strong>🛡️ THREATS</strong>'
    });
  } else if (templateType === 'cornell') {
    starterElements.push({
      type: 'shape', id: `shape-${Date.now()}-v`, left: 230, top: 20, width: 4, height: 470, color: '#94A3B8',
      content: { shapeType: 'rectangle', flippedX: 'false', flippedY: 'false' }
    });
    starterElements.push({
      type: 'shape', id: `shape-${Date.now()}-h`, left: 20, top: 500, width: 700, height: 4, color: '#94A3B8',
      content: { shapeType: 'rectangle', flippedX: 'false', flippedY: 'false' }
    });

    starterElements.push({
      type: 'text', id: `text-${Date.now()}-cues`, left: 25, top: 25, width: 195, height: 40, color: '#1E293B', fontSize: '16px',
      content: '<strong>💡 CUES &amp; QUESTIONS</strong><br><span style="font-size:12px;color:#64748B;">Key terms, prompts...</span>'
    });

    starterElements.push({
      type: 'text', id: `text-${Date.now()}-notes`, left: 245, top: 25, width: 460, height: 40, color: '#1E293B', fontSize: '16px',
      content: '<strong>📝 CLASS NOTES</strong><br><span style="font-size:12px;color:#64748B;">Main notes and diagrams...</span>'
    });

    starterElements.push({
      type: 'text', id: `text-${Date.now()}-summary`, left: 25, top: 510, width: 680, height: 40, color: '#1E293B', fontSize: '16px',
      content: '<strong>📌 SUMMARY</strong><br><span style="font-size:12px;color:#64748B;">Brief summary of takeaways...</span>'
    });
  } else if (templateType === 'mindmap') {
    starterElements.push({
      type: 'shape', id: `shape-${Date.now()}-center`, left: 270, top: 240, width: 200, height: 110, color: '#14B8A6',
      content: { shapeType: 'ellipse', flippedX: 'false', flippedY: 'false' }
    });
    starterElements.push({
      type: 'text', id: `text-${Date.now()}-center`, left: 285, top: 275, width: 170, height: 40, color: '#0F766E', fontSize: '20px',
      content: '<div style="text-align:center;"><strong>CENTRAL TOPIC</strong></div>'
    });

    starterElements.push({
      type: 'shape', id: `shape-${Date.now()}-sub1`, left: 50, top: 50, width: 140, height: 75, color: '#6366F1',
      content: { shapeType: 'ellipse', flippedX: 'false', flippedY: 'false' }
    });
    starterElements.push({
      type: 'text', id: `text-${Date.now()}-sub1`, left: 60, top: 70, width: 120, height: 30, color: '#4338CA', fontSize: '14px',
      content: '<div style="text-align:center;">Sub-topic 1</div>'
    });
    starterElements.push({
      type: 'shape', id: `line-${Date.now()}-1`, left: 170, top: 115, width: 110, height: 130, color: '#CBD5E1',
      content: { shapeType: 'line', flippedX: 'false', flippedY: 'false' }
    });

    starterElements.push({
      type: 'shape', id: `shape-${Date.now()}-sub2`, left: 550, top: 50, width: 140, height: 75, color: '#10B981',
      content: { shapeType: 'ellipse', flippedX: 'false', flippedY: 'false' }
    });
    starterElements.push({
      type: 'text', id: `text-${Date.now()}-sub2`, left: 560, top: 70, width: 120, height: 30, color: '#047857', fontSize: '14px',
      content: '<div style="text-align:center;">Sub-topic 2</div>'
    });
    starterElements.push({
      type: 'shape', id: `line-${Date.now()}-2`, left: 460, top: 115, width: 110, height: 130, color: '#CBD5E1',
      content: { shapeType: 'line', flippedX: 'true', flippedY: 'false' }
    });

    starterElements.push({
      type: 'shape', id: `shape-${Date.now()}-sub3`, left: 50, top: 450, width: 140, height: 75, color: '#F59E0B',
      content: { shapeType: 'ellipse', flippedX: 'false', flippedY: 'false' }
    });
    starterElements.push({
      type: 'text', id: `text-${Date.now()}-sub3`, left: 60, top: 470, width: 120, height: 30, color: '#B45309', fontSize: '14px',
      content: '<div style="text-align:center;">Sub-topic 3</div>'
    });
    starterElements.push({
      type: 'shape', id: `line-${Date.now()}-3`, left: 170, top: 345, width: 110, height: 115, color: '#CBD5E1',
      content: { shapeType: 'line', flippedX: 'false', flippedY: 'true' }
    });

    starterElements.push({
      type: 'shape', id: `shape-${Date.now()}-sub4`, left: 550, top: 450, width: 140, height: 75, color: '#EC4899',
      content: { shapeType: 'ellipse', flippedX: 'false', flippedY: 'false' }
    });
    starterElements.push({
      type: 'text', id: `text-${Date.now()}-sub4`, left: 560, top: 470, width: 120, height: 30, color: '#BE185D', fontSize: '14px',
      content: '<div style="text-align:center;">Sub-topic 4</div>'
    });
    starterElements.push({
      type: 'shape', id: `line-${Date.now()}-4`, left: 460, top: 345, width: 110, height: 115, color: '#CBD5E1',
      content: { shapeType: 'line', flippedX: 'true', flippedY: 'true' }
    });
  }

  const newPage = {
    user_id: currentUser.id,
    page_number: newPageNum,
    canvas_data: null,
    elements: starterElements
  };

  notebookPages.push(newPage);
  notebookPages.sort((a, b) => a.page_number - b.page_number);
  currentNotebookPageNumber = newPageNum;
  notebookHasUnsavedChanges = true;
  
  resetNotebookHistory();
  renderCurrentPageData();
}

window.openTemplatePickerModal = openTemplatePickerModal;
window.closeTemplatePickerModal = closeTemplatePickerModal;
window.selectNotebookTemplate = selectNotebookTemplate;

// ==========================================
// PART B — UNDO / REDO HISTORY STACK
// ==========================================
let notebookUndoStack = [];
let notebookRedoStack = [];
const MAX_NOTEBOOK_STACK_SIZE = 50;

function updateUndoRedoButtons() {
  const btnUndo = document.getElementById('btn-undo-notebook');
  const btnRedo = document.getElementById('btn-redo-notebook');
  if (btnUndo) btnUndo.disabled = (notebookUndoStack.length <= 1);
  if (btnRedo) btnRedo.disabled = (notebookRedoStack.length === 0);
}

function recordNotebookState() {
  if (!canvasElement) return;
  const canvasDataURL = canvasElement.toDataURL('image/png');
  const elements = (typeof captureCurrentOverlayElements === 'function') ? captureCurrentOverlayElements() : [];
  
  const snapshot = {
    canvasDataURL: canvasDataURL,
    elements: elements
  };

  notebookUndoStack.push(snapshot);
  if (notebookUndoStack.length > MAX_NOTEBOOK_STACK_SIZE) {
    notebookUndoStack.shift();
  }
  notebookRedoStack = [];
  updateUndoRedoButtons();
}

function resetNotebookHistory() {
  notebookUndoStack = [];
  notebookRedoStack = [];
  if (canvasElement) {
    const canvasDataURL = canvasElement.toDataURL('image/png');
    const elements = (typeof captureCurrentOverlayElements === 'function') ? captureCurrentOverlayElements() : [];
    notebookUndoStack.push({ canvasDataURL, elements });
  }
  updateUndoRedoButtons();
}

function undoNotebookAction() {
  if (notebookUndoStack.length <= 1) return;
  
  const currentSnapshot = notebookUndoStack.pop();
  notebookRedoStack.push(currentSnapshot);
  
  const previousSnapshot = notebookUndoStack[notebookUndoStack.length - 1];
  applyNotebookStateSnapshot(previousSnapshot);
  updateUndoRedoButtons();
}

function redoNotebookAction() {
  if (notebookRedoStack.length === 0) return;
  
  const snapshotToRestore = notebookRedoStack.pop();
  notebookUndoStack.push(snapshotToRestore);
  applyNotebookStateSnapshot(snapshotToRestore);
  updateUndoRedoButtons();
}

function applyNotebookStateSnapshot(snapshot) {
  if (!snapshot || !canvasCtx || !canvasElement) return;
  
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (snapshot.canvasDataURL) {
    const img = new Image();
    img.src = snapshot.canvasDataURL;
    img.onload = () => {
      canvasCtx.drawImage(img, 0, 0);
    };
  }

  const activePage = notebookPages.find(p => p.page_number === currentNotebookPageNumber);
  if (activePage) {
    activePage.canvas_data = snapshot.canvasDataURL;
    activePage.elements = snapshot.elements || [];
  }

  notebookHasUnsavedChanges = true;
  renderCurrentPageData();
}

document.addEventListener('keydown', (e) => {
  if (currentActiveTab !== 'notebook') return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;

  const isCmdOrCtrl = e.metaKey || e.ctrlKey;
  if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
    if (e.shiftKey) {
      e.preventDefault();
      redoNotebookAction();
    } else {
      e.preventDefault();
      undoNotebookAction();
    }
  } else if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redoNotebookAction();
  }
});

window.recordNotebookState = recordNotebookState;
window.resetNotebookHistory = resetNotebookHistory;
window.undoNotebookAction = undoNotebookAction;
window.redoNotebookAction = redoNotebookAction;

// ==========================================
// PART C — PAGE THUMBNAIL OVERVIEW
// ==========================================
function openNotebookPagesOverview() {
  const modal = document.getElementById('notebook-pages-modal');
  const grid = document.getElementById('notebook-pages-grid');
  if (!modal || !grid) return;

  grid.innerHTML = '';

  notebookPages.forEach(page => {
    const isCurrent = (page.page_number === currentNotebookPageNumber);
    const elemCount = (page.elements || []).length;

    const tile = document.createElement('div');
    tile.className = 'page-thumbnail-tile' + (isCurrent ? ' active-page' : '');
    
    let previewContentHtml = `<div style="color: var(--color-text-muted); font-size: 0.75rem; font-style: italic;">Blank Canvas</div>`;
    if (page.canvas_data) {
      previewContentHtml = `<img src="${page.canvas_data}" alt="Page ${page.page_number}">`;
    }

    let sharedBadgeHtml = '';
    if (page.is_shared) {
      sharedBadgeHtml = `<span style="font-size: 0.65rem; background: #EEF2FF; color: #4F46E5; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 6px; display: block; margin-top: 0.15rem;">👥 Shared by ${escapeHtml(page.owner_name || 'Classmate')}</span>`;
    }

    tile.innerHTML = `
      <div class="page-thumbnail-preview">
        ${previewContentHtml}
      </div>
      <div class="page-thumbnail-meta">
        <div>
          <div class="page-thumbnail-title">Page ${page.page_number}</div>
          ${sharedBadgeHtml}
        </div>
        <span class="page-thumbnail-badge">${elemCount} items</span>
      </div>
    `;

    tile.addEventListener('click', () => {
      selectPageFromOverview(page.page_number);
    });

    grid.appendChild(tile);
  });

  const addTile = document.createElement('div');
  addTile.className = 'page-thumbnail-add';
  addTile.innerHTML = `
    <span style="font-size: 1.8rem; line-height: 1;">+</span>
    <span>New Page</span>
  `;
  addTile.addEventListener('click', () => {
    closeNotebookPagesOverview();
    openTemplatePickerModal();
  });
  grid.appendChild(addTile);

  modal.style.display = 'flex';
}

function closeNotebookPagesOverview() {
  const modal = document.getElementById('notebook-pages-modal');
  if (modal) modal.style.display = 'none';
}

async function selectPageFromOverview(pageNum) {
  closeNotebookPagesOverview();
  if (pageNum === currentNotebookPageNumber) return;

  if (notebookHasUnsavedChanges) {
    const isTr = localStorage.getItem('acadexUILang') === 'tr';
    const confirmSave = confirm(
      isTr 
        ? "Kaydedilmemiş değişiklikleriniz var. Sayfa değiştirmeden önce kaydetmek ister misiniz?"
        : "You have unsaved changes. Would you like to save before switching pages?"
    );
    if (confirmSave) {
      await saveNotebookData();
    }
  }

  currentNotebookPageNumber = pageNum;
  notebookHasUnsavedChanges = false;
  resetNotebookHistory();
  renderCurrentPageData();
}

window.openNotebookPagesOverview = openNotebookPagesOverview;
window.closeNotebookPagesOverview = closeNotebookPagesOverview;
window.selectPageFromOverview = selectPageFromOverview;

// ==========================================
// PART D — SHARED / COLLABORATIVE PAGES
// ==========================================
let searchDebounceTimer = null;

function openPageShareModal() {
  const modal = document.getElementById('page-share-modal');
  if (!modal) return;

  const searchInput = document.getElementById('share-student-search');
  if (searchInput) searchInput.value = '';
  
  const resultsContainer = document.getElementById('share-search-results');
  if (resultsContainer) resultsContainer.innerHTML = '';

  loadCurrentlySharedList();
  modal.style.display = 'flex';
}

function closePageShareModal() {
  const modal = document.getElementById('page-share-modal');
  if (modal) modal.style.display = 'none';
}

async function loadCurrentlySharedList() {
  const listEl = document.getElementById('currently-shared-list');
  if (!listEl) return;

  try {
    const { data: shares, error } = await supabaseClient
      .from('notebook_page_shares')
      .select('id, shared_with_id, profiles:shared_with_id(full_name, student_number)')
      .eq('page_owner_id', currentUser.id)
      .eq('page_number', currentNotebookPageNumber);

    if (error || !shares || shares.length === 0) {
      listEl.innerHTML = '<p style="font-size: 0.78rem; color: var(--color-text-muted); font-style: italic;">Not shared with anyone yet.</p>';
      return;
    }

    listEl.innerHTML = '';
    shares.forEach(sh => {
      const studentName = sh.profiles?.full_name || 'Classmate';
      const studentNum = sh.profiles?.student_number || '';

      const row = document.createElement('div');
      row.className = 'share-user-row';
      row.innerHTML = `
        <div>
          <div class="share-user-name">${escapeHtml(studentName)}</div>
          <div class="share-user-meta">No: ${escapeHtml(studentNum)}</div>
        </div>
        <button class="btn btn-destructive" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;" onclick="removePageShare('${sh.id}')">Remove</button>
      `;
      listEl.appendChild(row);
    });

  } catch (err) {
    console.error("Exception loading shares:", err);
  }
}

function debounceSearchClassmates() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(searchClassmatesForShare, 300);
}

async function searchClassmatesForShare() {
  const query = document.getElementById('share-student-search')?.value.trim();
  const resultsEl = document.getElementById('share-search-results');
  if (!resultsEl) return;

  if (!query || query.length < 2) {
    resultsEl.innerHTML = '';
    return;
  }

  try {
    const userDept = currentUserProfile?.department || '';
    
    let queryBuilder = supabaseClient
      .from('profiles')
      .select('id, full_name, student_number, department')
      .neq('id', currentUser.id)
      .or(`full_name.ilike.%${query}%,student_number.ilike.%${query}%`)
      .limit(6);

    if (userDept) {
      queryBuilder = queryBuilder.eq('department', userDept);
    }

    const { data: students, error } = await queryBuilder;

    if (error || !students || students.length === 0) {
      resultsEl.innerHTML = '<p style="font-size: 0.78rem; color: var(--color-text-muted); font-style: italic;">No classmates found matching query.</p>';
      return;
    }

    resultsEl.innerHTML = '';
    students.forEach(st => {
      const row = document.createElement('div');
      row.className = 'share-user-row';
      row.innerHTML = `
        <div>
          <div class="share-user-name">${escapeHtml(st.full_name || 'Student')}</div>
          <div class="share-user-meta">No: ${escapeHtml(st.student_number || '')} &bull; ${escapeHtml(st.department || '')}</div>
        </div>
        <button class="btn btn-primary" style="font-size: 0.7rem; padding: 0.2rem 0.55rem;" onclick="addPageShare('${st.id}')">+ Share</button>
      `;
      resultsEl.appendChild(row);
    });

  } catch (err) {
    console.error("Exception searching classmates:", err);
  }
}

async function addPageShare(studentId) {
  try {
    const { error } = await supabaseClient
      .from('notebook_page_shares')
      .insert({
        page_owner_id: currentUser.id,
        page_number: currentNotebookPageNumber,
        shared_with_id: studentId
      });

    if (error) {
      console.error("Insert share failed:", error);
      showDashboardAlert('error', 'Already shared or failed to share.');
      return;
    }

    showDashboardAlert('success', 'Page access granted!');
    document.getElementById('share-student-search').value = '';
    document.getElementById('share-search-results').innerHTML = '';
    await loadCurrentlySharedList();

  } catch (err) {
    console.error("Exception adding share:", err);
    showDashboardAlert('error', 'Failed to share page.');
  }
}

async function removePageShare(shareId) {
  try {
    const { error } = await supabaseClient
      .from('notebook_page_shares')
      .delete()
      .eq('id', shareId);

    if (error) {
      console.error("Delete share failed:", error);
      showDashboardAlert('error', 'Could not remove share.');
      return;
    }

    showDashboardAlert('success', 'Share revoked.');
    await loadCurrentlySharedList();

  } catch (err) {
    console.error("Exception removing share:", err);
  }
}

async function loadSharedPages() {
  try {
    const { data: sharedRows, error } = await supabaseClient
      .from('notebook_page_shares')
      .select('page_owner_id, page_number')
      .eq('shared_with_id', currentUser.id);

    if (error || !sharedRows || sharedRows.length === 0) return;

    for (let sh of sharedRows) {
      const { data: nbook } = await supabaseClient
        .from('notebooks')
        .select('*, profiles:user_id(full_name)')
        .eq('user_id', sh.page_owner_id)
        .eq('page_number', sh.page_number)
        .maybeSingle();

      if (nbook) {
        const ownerName = nbook.profiles?.full_name || 'Classmate';
        const pageObj = {
          user_id: nbook.user_id,
          page_number: nbook.page_number,
          canvas_data: nbook.canvas_data,
          elements: nbook.elements || [],
          is_shared: true,
          owner_name: ownerName,
          owner_id: nbook.user_id
        };

        const existingIdx = notebookPages.findIndex(p => p.user_id === pageObj.user_id && p.page_number === pageObj.page_number);
        if (existingIdx === -1) {
          notebookPages.push(pageObj);
        } else {
          notebookPages[existingIdx] = pageObj;
        }
      }
    }
  } catch (err) {
    console.error("Exception loading shared pages:", err);
  }
}

window.openPageShareModal = openPageShareModal;
window.closePageShareModal = closePageShareModal;
window.debounceSearchClassmates = debounceSearchClassmates;
window.searchClassmatesForShare = searchClassmatesForShare;
window.addPageShare = addPageShare;
window.removePageShare = removePageShare;
window.loadSharedPages = loadSharedPages;

// ==========================================
// SIDE-BY-SIDE ORIGINAL DOCUMENT VIEWER
// ==========================================
let isOriginalDocSplitActive = false;

// Fills `container` with an iframe (PDF) or a download box (Word/PowerPoint)
// for the original source document behind `cardLike` — a study_cards row (or
// study_cards-shaped object) carrying storage_path/documentFileName/mime_type
// and/or a document_id to resolve them from. Shared by the study card
// modal's split-view "Orijinali Görüntüle" pane and the "Kaynakla Çalış"
// page's PDF column, so there's exactly one place that knows how to fetch
// and render a source document.
async function renderOriginalDocumentPreview(container, cardLike) {
  if (!container) return;
  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.9rem;color:var(--color-text-muted);">Yükleniyor / Loading...</div>`;

  try {
    let storagePath = cardLike.storage_path;
    let fileName = cardLike.documentFileName || cardLike.file_name || '';
    let mimeType = cardLike.mime_type || '';

    if (!storagePath && cardLike.document_id) {
      const { data: docData } = await supabaseClient
        .from('documents')
        .select('storage_path, file_name, mime_type')
        .eq('id', cardLike.document_id)
        .single();

      if (docData) {
        storagePath = docData.storage_path;
        fileName = docData.file_name || fileName;
        mimeType = docData.mime_type || mimeType;
      }
    }

    if (!storagePath) {
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.9rem;color:#EF4444;">Dosya yolu bulunamadı / Document file path not found.</div>`;
      return;
    }

    // Generate signed URL (300 seconds = 5 min expiry)
    const { data: signedData, error: signedErr } = await supabaseClient
      .storage
      .from('documents')
      .createSignedUrl(storagePath, 300);

    if (signedErr || !signedData?.signedUrl) {
      console.error("Failed to create signed URL:", signedErr);
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.9rem;color:#EF4444;">Belge yüklenemedi / Could not load document.</div>`;
      return;
    }

    const lowerName = (fileName || '').toLowerCase();
    const isPdf = lowerName.endsWith('.pdf') || mimeType === 'application/pdf';

    if (isPdf) {
      container.innerHTML = `<iframe src="${signedData.signedUrl}" style="width:100%;height:100%;border:none;border-radius:var(--radius-sm);"></iframe>`;
    } else {
      // Non-PDF (Word / PowerPoint) download panel
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:2rem;gap:1rem;background:var(--color-white);border-radius:var(--radius-sm);">
          <div style="font-size:3.5rem;">📄</div>
          <h4 style="margin:0;color:var(--color-navy);font-size:1.05rem;">${escapeHtml(fileName || 'Belge')}</h4>
          <p style="margin:0;color:var(--color-text-muted);font-size:0.85rem;max-width:340px;">${getTranslation('dash.cards.cannotPreviewInline') || 'Bu dosya türü (Word/PowerPoint) tarayıcıda doğrudan önizlenemiyor.'}</p>
          <a href="${signedData.signedUrl}" download target="_blank" class="btn btn-primary" style="font-size:0.85rem;padding:0.6rem 1.25rem;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:0.5rem;border-radius:var(--radius-sm);">
            <span>${getTranslation('dash.cards.downloadOriginal') || '⬇️ Orijinal Dosyayı İndir'}</span>
          </a>
        </div>
      `;
    }
  } catch (err) {
    console.error("Exception loading original document preview:", err);
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.9rem;color:#EF4444;">Hata oluştu / Error loading document.</div>`;
  }
}
window.renderOriginalDocumentPreview = renderOriginalDocumentPreview;

async function toggleOriginalDocumentViewer() {
  const modalCard = document.querySelector('.study-card-modal-card');
  const rightPane = document.getElementById('original-doc-viewer-pane');
  const toggleBtnLabel = document.getElementById('btn-toggle-original-label');
  if (!modalCard || !rightPane || !currentActiveStudyCard) return;

  if (isOriginalDocSplitActive) {
    // Return to single view
    isOriginalDocSplitActive = false;
    modalCard.classList.remove('split-active');
    rightPane.style.display = 'none';
    rightPane.innerHTML = '';
    if (toggleBtnLabel) toggleBtnLabel.textContent = getTranslation('dash.cards.viewOriginal') || '📄 Orijinali Görüntüle';
    return;
  }

  // Mutual exclusion: close the chat pane first if it's open (only one right pane at a time)
  if (isDocChatPaneActive) {
    toggleDocChatPane(true);
  }

  // Open side-by-side view
  isOriginalDocSplitActive = true;
  modalCard.classList.add('split-active');
  rightPane.style.display = 'flex';
  if (toggleBtnLabel) toggleBtnLabel.textContent = getTranslation('dash.cards.singleView') || '✕ Tekli Görünüm';

  await renderOriginalDocumentPreview(rightPane, currentActiveStudyCard);
}
window.toggleOriginalDocumentViewer = toggleOriginalDocumentViewer;

// ==========================================================================
// CHAT WITH SOURCE (NotebookLM-style grounded document Q&A)
// Calls the chat-with-document edge function, which re-extracts the exact
// text of the study card's source document(s) and answers strictly from
// that text, with inline [1][2] citation markers rendered via the same
// formatFootnoteMarkers()/showFootnoteToast() helpers already used for
// study card summaries. Conversation history lives only in this tab's
// memory (same privacy model as the Acadia widget) and resets whenever a
// study card modal is freshly opened.
// ==========================================================================

function initDocChatForm() {
  const form = document.getElementById('doc-chat-input-form');
  if (!form || form.dataset.wired) return;
  form.dataset.wired = 'true';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('doc-chat-input');
    if (!input) return;
    const text = input.value.trim();
    const image = pendingDocChatImageDataUrl;
    if (!text && !image) return;
    // Read the checkbox BEFORE removeDocChatImage() resets it below.
    const checkWorkToggle = document.getElementById('doc-chat-checkwork-toggle');
    const checkWorkMode = !!(image && checkWorkToggle && checkWorkToggle.checked);
    const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
    // Allow sending just an image with no typed question — use a sensible default.
    const finalText = text || (checkWorkMode
      ? (isTr ? 'Çözümümü kontrol eder misin?' : 'Can you check my solution?')
      : (isTr ? 'Ekli görseldeki bu kısmı açıklar mısın?' : 'Can you explain this part shown in the attached image?'));
    input.value = '';
    removeDocChatImage();
    sendDocChatMessage(finalText, image, checkWorkMode);
  });

  const imageInput = document.getElementById('doc-chat-image-input');
  if (imageInput) {
    imageInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await downscaleImageForChat(file);
        pendingDocChatImageDataUrl = dataUrl;
        const thumb = document.getElementById('doc-chat-image-preview-thumb');
        const preview = document.getElementById('doc-chat-image-preview');
        if (thumb) thumb.src = dataUrl;
        if (preview) preview.style.display = 'flex';
      } catch (err) {
        console.error('Failed to process attached image:', err);
        const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
        alert(isTr ? 'Görsel yüklenirken bir sorun oluştu, lütfen başka bir dosya deneyin.' : 'There was a problem loading that image, please try another file.');
      } finally {
        imageInput.value = '';
      }
    });
  }
}
window.initDocChatForm = initDocChatForm;

// Downscales an attached photo/screenshot before sending — keeps the request
// payload and per-message vision cost small while still being plenty legible
// for a page/diagram screenshot. Caps the longest side at 1280px and encodes
// as JPEG (quality 0.75): a smaller payload means less time spent uploading
// and less time for the vision model to chew on, which matters because the
// edge function has a real time budget and needs room left over for a
// text-only fallback attempt if the vision call fails.
function downscaleImageForChat(file) {
  return new Promise((resolve, reject) => {
    const MAX_DIMENSION = 1280;
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image decode failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
window.downscaleImageForChat = downscaleImageForChat;

function removeDocChatImage() {
  pendingDocChatImageDataUrl = null;
  const preview = document.getElementById('doc-chat-image-preview');
  if (preview) preview.style.display = 'none';
  const thumb = document.getElementById('doc-chat-image-preview-thumb');
  if (thumb) thumb.src = '';
  const imageInput = document.getElementById('doc-chat-image-input');
  if (imageInput) imageInput.value = '';
  // Don't let "check my work" linger checked for the next, unrelated image.
  const checkWorkToggle = document.getElementById('doc-chat-checkwork-toggle');
  if (checkWorkToggle) checkWorkToggle.checked = false;
}
window.removeDocChatImage = removeDocChatImage;

function resetDocChatState() {
  docChatHistory = [];
  docChatHasGreeted = false;
  isDocChatPaneActive = false;
  removeDocChatImage();
  const pane = document.getElementById('study-card-chat-pane');
  if (pane) pane.style.display = 'none';
  const messages = document.getElementById('doc-chat-messages');
  if (messages) messages.innerHTML = '';
  const toggleBtnLabel = document.getElementById('btn-toggle-chat-label');
  if (toggleBtnLabel) toggleBtnLabel.textContent = getTranslation('dash.cards.chatWithSource') || '💬 Kaynakla Sohbet Et';

  // Also fully close the original document viewer pane so a fresh modal
  // open never inherits a stale split-screen layout from a previous card.
  isOriginalDocSplitActive = false;
  const originalPane = document.getElementById('original-doc-viewer-pane');
  if (originalPane) { originalPane.style.display = 'none'; originalPane.innerHTML = ''; }
  const originalToggleLabel = document.getElementById('btn-toggle-original-label');
  if (originalToggleLabel) originalToggleLabel.textContent = getTranslation('dash.cards.viewOriginal') || '📄 Orijinali Görüntüle';
  const modalCard = document.querySelector('.study-card-modal-card');
  if (modalCard) modalCard.classList.remove('split-active');
}
window.resetDocChatState = resetDocChatState;

// Generic click-to-enlarge lightbox for any AI-generated diagram or
// chat-attached photo — shows the image at full size (the chat column and
// the "Eklenen Görseller" gallery thumbnails are both too small to read a
// detailed Mermaid diagram comfortably) and, when the caller supplies
// onSendToNotebook/onAddToSummary callbacks, offers those same actions from
// inside the enlarged view so the student doesn't have to close it first.
function openImageLightbox(dataUrl, caption, actions) {
  const overlay = document.getElementById('image-lightbox-overlay');
  const img = document.getElementById('image-lightbox-img');
  const capEl = document.getElementById('image-lightbox-caption');
  const actionsEl = document.getElementById('image-lightbox-actions');
  if (!overlay || !img || !actionsEl) return;

  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  img.src = dataUrl;
  if (capEl) capEl.textContent = caption || '';
  actionsEl.innerHTML = '';

  if (actions && typeof actions.onSendToNotebook === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline';
    btn.style.cssText = 'font-size: 0.75rem; padding: 0.35rem 0.75rem; font-weight: 700;';
    btn.textContent = isTr ? '🖼️ Deftere Gönder' : '🖼️ Send to Notebook';
    btn.addEventListener('click', () => actions.onSendToNotebook(btn));
    actionsEl.appendChild(btn);
  }
  if (actions && typeof actions.onAddToSummary === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline';
    btn.style.cssText = 'font-size: 0.75rem; padding: 0.35rem 0.75rem; font-weight: 700;';
    btn.textContent = isTr ? '📌 Özete Ekle' : '📌 Add to Summary';
    btn.addEventListener('click', () => actions.onAddToSummary(btn));
    actionsEl.appendChild(btn);
  }

  overlay.style.display = 'flex';
}
window.openImageLightbox = openImageLightbox;

function closeImageLightbox() {
  const overlay = document.getElementById('image-lightbox-overlay');
  if (overlay) overlay.style.display = 'none';
}
window.closeImageLightbox = closeImageLightbox;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeImageLightbox();
});

// Builds the small "📌 Deftere Ekle" action button shown under an assistant
// chat TEXT reply (e.g. a list of formulas, a step-by-step solution) so it
// can be saved to the notebook (card_depot) same as images/diagrams already
// can be. Stores the raw text (not the rendered LaTeX/HTML) — the depot's
// default text renderer displays/truncates it same as any other plain-text
// item (key terms, key points, etc).
function createChatTextActionRow(rawText, isTr) {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; gap: 0.4rem; margin-top: 0.45rem; flex-wrap: wrap;';

  const notebookBtn = document.createElement('button');
  notebookBtn.type = 'button';
  notebookBtn.textContent = isTr ? '📌 Deftere Ekle' : '📌 Add to Notebook';
  notebookBtn.style.cssText = 'background: var(--color-bg-alt); border: 1px solid rgba(22, 50, 92, 0.15); color: var(--color-teal); border-radius: 20px; padding: 0.2rem 0.6rem; font-size: 0.65rem; font-weight: 700; cursor: pointer;';
  notebookBtn.addEventListener('click', (e) => {
    if (!currentActiveStudyCard || !currentActiveStudyCard.id) return;
    const title = rawText.length > 60 ? rawText.slice(0, 60) + '…' : rawText;
    sendToDepot(e, notebookBtn, currentActiveStudyCard.id, 'key_point', title, rawText);
  });
  row.appendChild(notebookBtn);

  return row;
}

// Builds the small "🖼️ Deftere Gönder" / "📌 Özete Ekle" action row shown
// under any image in the chat (a student's uploaded photo, a rendered
// Mermaid diagram, or a paid AI-generated illustration). Uses real DOM
// elements + closures (not inline onclick strings) since dataUrl can be a
// sizeable base64 payload that shouldn't be serialized into an HTML attribute.
function createChatImageActionRow(dataUrl, caption) {
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; gap: 0.4rem; margin-top: 0.4rem; flex-wrap: wrap;';

  const notebookBtn = document.createElement('button');
  notebookBtn.type = 'button';
  notebookBtn.textContent = isTr ? '🖼️ Deftere Gönder' : '🖼️ Send to Notebook';
  notebookBtn.style.cssText = 'background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: inherit; border-radius: 20px; padding: 0.2rem 0.55rem; font-size: 0.65rem; font-weight: 700; cursor: pointer;';
  notebookBtn.addEventListener('click', (e) => {
    if (!currentActiveStudyCard || !currentActiveStudyCard.id) return;
    sendToDepot(e, notebookBtn, currentActiveStudyCard.id, 'image', caption, dataUrl);
  });
  row.appendChild(notebookBtn);

  const summaryBtn = document.createElement('button');
  summaryBtn.type = 'button';
  summaryBtn.textContent = isTr ? '📌 Özete Ekle' : '📌 Add to Summary';
  summaryBtn.style.cssText = 'background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: inherit; border-radius: 20px; padding: 0.2rem 0.55rem; font-size: 0.65rem; font-weight: 700; cursor: pointer;';
  summaryBtn.addEventListener('click', () => saveChatImageToSummary(dataUrl, caption, summaryBtn));
  row.appendChild(summaryBtn);

  return row;
}

// Renders a Mermaid diagram definition string into a chat bubble as a real
// SVG picture (free — no image-generation API involved). Returns the SVG
// serialized as a "data:image/svg+xml;base64,..." data URL on success (so
// callers can offer the same Deftere Gönder/Özete Ekle actions on it as any
// other image), or null if rendering failed (invalid Mermaid syntax, etc).
async function renderMermaidIntoBubble(bubble, mermaidCode, caption) {
  if (!window.mermaid || !mermaidCode) return null;
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const label = caption || (isTr ? 'AI Diyagramı' : 'AI diagram');
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'margin-top: 0.5rem; background: white; border-radius: 8px; padding: 0.5rem; overflow-x: auto; cursor: zoom-in;';
  wrapper.title = isTr ? 'Büyütmek için tıkla' : 'Click to enlarge';
  bubble.appendChild(wrapper);

  try {
    const renderId = 'mermaid-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
    const { svg } = await window.mermaid.render(renderId, mermaidCode);
    wrapper.innerHTML = svg;
    const svgEl = wrapper.querySelector('svg');
    if (svgEl) {
      svgEl.style.maxWidth = '100%';
      svgEl.style.height = 'auto';
    }
    const svgString = new XMLSerializer().serializeToString(svgEl || wrapper);
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

    // Click the small in-bubble diagram to view it full-size, with the same
    // Deftere Gönder/Özete Ekle actions available right there in the enlarged
    // view — the chat column is too narrow to read a detailed diagram in place.
    wrapper.addEventListener('click', () => {
      openImageLightbox(dataUrl, label, {
        onSendToNotebook: (btn) => {
          if (!currentActiveStudyCard || !currentActiveStudyCard.id) return;
          sendToDepot(null, btn, currentActiveStudyCard.id, 'image', label, dataUrl);
        },
        onAddToSummary: (btn) => saveChatImageToSummary(dataUrl, label, btn)
      });
    });

    return dataUrl;
  } catch (err) {
    console.warn('Mermaid render failed, dropping diagram silently:', err);
    wrapper.remove();
    return null;
  }
}

function renderDocChatMessage(role, text, citations, imageDataUrl, visionUsed, mermaidCode) {
  const container = document.getElementById('doc-chat-messages');
  if (!container) return;

  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const bubble = document.createElement('div');
  const isUser = role === 'user';
  bubble.style.cssText = `
    max-width: 88%;
    align-self: ${isUser ? 'flex-end' : 'flex-start'};
    background: ${isUser ? 'var(--color-teal)' : 'var(--color-bg-alt)'};
    color: ${isUser ? 'white' : 'var(--color-navy)'};
    padding: 0.55rem 0.8rem;
    border-radius: ${isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px'};
    font-size: 0.8rem;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  `;

  if (isUser) {
    if (imageDataUrl) {
      const img = document.createElement('img');
      img.src = imageDataUrl;
      img.alt = '';
      img.style.cssText = 'max-width: 100%; max-height: 160px; border-radius: 8px; display: block; margin-bottom: 0.4rem; object-fit: contain; cursor: zoom-in;';
      img.title = isTr ? 'Büyütmek için tıkla' : 'Click to enlarge';
      const uploadLabel = isTr ? 'Sohbetten Fotoğraf' : 'Photo from chat';
      img.addEventListener('click', () => {
        openImageLightbox(imageDataUrl, uploadLabel, {
          onSendToNotebook: (btn) => {
            if (!currentActiveStudyCard || !currentActiveStudyCard.id) return;
            sendToDepot(null, btn, currentActiveStudyCard.id, 'image', uploadLabel, imageDataUrl);
          },
          onAddToSummary: (btn) => saveChatImageToSummary(imageDataUrl, uploadLabel, btn)
        });
      });
      bubble.appendChild(img);
    }
    const textNode = document.createElement('div');
    textNode.textContent = text;
    bubble.appendChild(textNode);
    if (imageDataUrl) {
      bubble.appendChild(createChatImageActionRow(imageDataUrl, isTr ? 'Sohbetten Fotoğraf' : 'Photo from chat'));
    }
  } else {
    // Escape first, then apply citation markers — formatFootnoteMarkers only
    // touches literal "[n]" substrings so this is safe and closes off any
    // stored-XSS risk from AI-generated answer text.
    // renderMathInText() escapes the text AND renders any $...$ LaTeX
    // formulas the AI included (same convention as the study card's worked
    // examples) before we layer citation markers on top.
    bubble.innerHTML = formatFootnoteMarkers(renderMathInText(text), citations);
    if (visionUsed) {
      const tag = document.createElement('div');
      tag.textContent = isTr ? '📷 Görsel incelendi' : '📷 Image analyzed';
      tag.style.cssText = 'margin-top: 0.35rem; font-size: 0.65rem; opacity: 0.65; font-style: italic;';
      bubble.appendChild(tag);
    }

    if (mermaidCode) {
      renderMermaidIntoBubble(bubble, mermaidCode, isTr ? 'AI Diyagramı' : 'AI diagram').then((svgDataUrl) => {
        if (!svgDataUrl) return;
        // Free path only — the paid "generate a real image" button was
        // deliberately removed from the UI so there's no way to trigger any
        // billed API call from this app. The Mermaid diagram above is the
        // entire diagram-generation feature; generateRealImageForChat() and
        // the generate-study-image function remain in the codebase, unused,
        // in case this is ever wanted later.
        const actionRow = createChatImageActionRow(svgDataUrl, isTr ? 'AI Diyagramı' : 'AI diagram');
        bubble.appendChild(actionRow);
        container.scrollTop = container.scrollHeight;
      });
    }
  }

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}
window.renderDocChatMessage = renderDocChatMessage;

function toggleDocChatPane(forceClose) {
  const modalCard = document.querySelector('.study-card-modal-card');
  const chatPane = document.getElementById('study-card-chat-pane');
  const toggleBtnLabel = document.getElementById('btn-toggle-chat-label');
  if (!modalCard || !chatPane || !currentActiveStudyCard) return;

  if (forceClose === true || isDocChatPaneActive) {
    isDocChatPaneActive = false;
    chatPane.style.display = 'none';
    if (!isOriginalDocSplitActive) {
      modalCard.classList.remove('split-active');
    }
    if (toggleBtnLabel) toggleBtnLabel.textContent = getTranslation('dash.cards.chatWithSource') || '💬 Kaynakla Sohbet Et';
    return;
  }

  // Mutual exclusion: close the original document viewer first if it's open
  if (isOriginalDocSplitActive) {
    toggleOriginalDocumentViewer();
  }

  isDocChatPaneActive = true;
  modalCard.classList.add('split-active');
  chatPane.style.display = 'flex';
  if (toggleBtnLabel) toggleBtnLabel.textContent = getTranslation('dash.cards.closeChatView') || '✕ Sohbeti Kapat';

  if (!docChatHasGreeted) {
    docChatHasGreeted = true;
    const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
    const greeting = isTr
      ? 'Merhaba! Bu belge/belgeler hakkında bana soru sorabilirsiniz. Cevaplarımı yalnızca kaynağın içeriğine dayandırırım — belgede olmayan bir şey sorarsanız size bunu söylerim.'
      : "Hi! Ask me anything about this document — I'll answer strictly from its content, and I'll tell you honestly if something isn't covered in it.";
    renderDocChatMessage('assistant', greeting, []);
  }

  const input = document.getElementById('doc-chat-input');
  if (input) setTimeout(() => input.focus(), 50);
}
window.toggleDocChatPane = toggleDocChatPane;

function clearDocChat() {
  docChatHistory = [];
  docChatHasGreeted = false;
  removeDocChatImage();
  const messages = document.getElementById('doc-chat-messages');
  if (messages) messages.innerHTML = '';

  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const greeting = isTr
    ? 'Merhaba! Bu belge/belgeler hakkında bana soru sorabilirsiniz. Cevaplarımı yalnızca kaynağın içeriğine dayandırırım — belgede olmayan bir şey sorarsanız size bunu söylerim.'
    : "Hi! Ask me anything about this document — I'll answer strictly from its content, and I'll tell you honestly if something isn't covered in it.";
  renderDocChatMessage('assistant', greeting, []);
  docChatHasGreeted = true;
}
window.clearDocChat = clearDocChat;

async function sendDocChatMessage(text, imageDataUrl, checkWorkMode) {
  if (docChatRequestInFlight) return;
  if (!currentActiveStudyCard || !currentActiveStudyCard.id) return;

  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const cardId = currentActiveStudyCard.id;

  renderDocChatMessage('user', text, [], imageDataUrl || null);
  // Only the text goes into persisted history — the image is sent once for
  // this turn only, so a long conversation doesn't keep re-sending base64 data.
  docChatHistory.push({ role: 'user', content: text });

  const sendBtn = document.getElementById('btn-doc-chat-send');
  const typingIndicator = document.getElementById('doc-chat-typing-indicator');
  docChatRequestInFlight = true;
  if (sendBtn) sendBtn.disabled = true;
  if (typingIndicator) typingIndicator.style.display = 'block';

  try {
    const requestBody = { studyCardId: cardId, messages: docChatHistory };
    if (imageDataUrl) requestBody.image = imageDataUrl;
    if (checkWorkMode) requestBody.checkWorkMode = true;

    const { data, error } = await supabaseClient.functions.invoke('chat-with-document', {
      body: requestBody
    });

    if (error || !data || typeof data.answer !== 'string') {
      console.error('chat-with-document invocation failed:', error || data);
      const errMsg = isTr
        ? 'Şu anda cevap veremiyorum, lütfen tekrar deneyin.'
        : "I couldn't answer right now, please try again.";
      renderDocChatMessage('assistant', errMsg, []);
      docChatHistory.pop(); // drop the failed user turn so a retry doesn't build bad history
      return;
    }

    renderDocChatMessage('assistant', data.answer, data.citations || [], null, !!data.visionUsed, data.mermaid || null);
    docChatHistory.push({ role: 'assistant', content: data.answer });
  } catch (err) {
    console.error('Exception in sendDocChatMessage:', err);
    const errMsg = isTr
      ? 'Şu anda cevap veremiyorum, lütfen tekrar deneyin.'
      : "I couldn't answer right now, please try again.";
    renderDocChatMessage('assistant', errMsg, []);
    docChatHistory.pop();
  } finally {
    docChatRequestInFlight = false;
    if (sendBtn) sendBtn.disabled = false;
    if (typingIndicator) typingIndicator.style.display = 'none';
  }
}
window.sendDocChatMessage = sendDocChatMessage;

const MAX_CHAT_ATTACHMENTS_PER_CARD = 12;
const MAX_CHAT_ATTACHMENT_CHARS = 900000; // ~900KB of base64 text — a generous safety cap, not a normal ceiling

// Persists an image from "Kaynakla Sohbet" (student photo, free Mermaid
// diagram, or paid AI illustration) onto the study card itself, so it
// survives after the chat window/conversation is gone. Stored directly as a
// base64 data URL in study_cards.chat_attachments (jsonb) — see the
// 20260726_chat_attachments.sql migration for why no Storage bucket is used.
async function saveChatImageToSummary(dataUrl, caption, btn) {
  if (!currentActiveStudyCard || !currentActiveStudyCard.id) return;
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const cardId = currentActiveStudyCard.id;

  if (dataUrl.length > MAX_CHAT_ATTACHMENT_CHARS) {
    showDashboardAlert('error', isTr ? 'Bu görsel özete eklenemeyecek kadar büyük.' : 'This image is too large to add to the summary.');
    return;
  }

  const originalHtml = btn ? btn.innerHTML : null;
  if (btn) { btn.disabled = true; btn.textContent = isTr ? 'Ekleniyor...' : 'Adding...'; }

  try {
    // Re-fetch the current attachments rather than trusting local state, so
    // two saves in quick succession (or a stale modal) don't clobber each other.
    const { data: freshCard, error: fetchErr } = await supabaseClient
      .from('study_cards')
      .select('chat_attachments')
      .eq('id', cardId)
      .single();

    if (fetchErr) {
      console.error('saveChatImageToSummary: fetch failed:', fetchErr);
      showDashboardAlert('error', isTr ? 'Özete eklenemedi, lütfen tekrar deneyin.' : 'Could not add to summary, please try again.');
      return;
    }

    const existing = Array.isArray(freshCard?.chat_attachments) ? freshCard.chat_attachments : [];
    const newAttachment = {
      id: 'att-' + Date.now(),
      dataUrl,
      caption: caption || (isTr ? 'Görsel' : 'Image'),
      createdAt: new Date().toISOString()
    };
    let updatedList = [...existing, newAttachment];
    if (updatedList.length > MAX_CHAT_ATTACHMENTS_PER_CARD) {
      updatedList = updatedList.slice(updatedList.length - MAX_CHAT_ATTACHMENTS_PER_CARD);
    }

    const { error: updateErr } = await supabaseClient
      .from('study_cards')
      .update({ chat_attachments: updatedList })
      .eq('id', cardId);

    if (updateErr) {
      console.error('saveChatImageToSummary: update failed:', updateErr);
      showDashboardAlert('error', isTr ? 'Özete eklenemedi, lütfen tekrar deneyin.' : 'Could not add to summary, please try again.');
      return;
    }

    currentActiveStudyCard.chat_attachments = updatedList;
    refreshAllImageGalleriesFor(updatedList, cardId);
    showDashboardAlert('success', isTr ? 'Görsel özete eklendi!' : 'Image added to the summary!');

    if (btn) {
      btn.textContent = isTr ? '✓ Eklendi' : '✓ Added';
      setTimeout(() => { btn.disabled = false; btn.innerHTML = originalHtml; }, 1500);
    }
  } catch (err) {
    console.error('Exception in saveChatImageToSummary:', err);
    showDashboardAlert('error', isTr ? 'Özete eklenemedi, lütfen tekrar deneyin.' : 'Could not add to summary, please try again.');
    if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
  }
}
window.saveChatImageToSummary = saveChatImageToSummary;

async function deleteChatAttachment(cardId, attachmentId) {
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  try {
    const { data: freshCard, error: fetchErr } = await supabaseClient
      .from('study_cards')
      .select('chat_attachments')
      .eq('id', cardId)
      .single();
    if (fetchErr) throw fetchErr;

    const existing = Array.isArray(freshCard?.chat_attachments) ? freshCard.chat_attachments : [];
    const updatedList = existing.filter(a => a.id !== attachmentId);

    const { error: updateErr } = await supabaseClient
      .from('study_cards')
      .update({ chat_attachments: updatedList })
      .eq('id', cardId);
    if (updateErr) throw updateErr;

    if (currentActiveStudyCard && currentActiveStudyCard.id === cardId) {
      currentActiveStudyCard.chat_attachments = updatedList;
    }
    refreshAllImageGalleriesFor(updatedList, cardId);
  } catch (err) {
    console.error('Exception in deleteChatAttachment:', err);
    showDashboardAlert('error', isTr ? 'Görsel silinemedi.' : 'Could not remove the image.');
  }
}
window.deleteChatAttachment = deleteChatAttachment;

// Both the study card modal and the "Kaynakla Çalış" (Source Hub) page have
// their own "Eklenen Görseller" gallery for the same underlying
// chat_attachments data. Only one is visible at a time, but refreshing both
// keeps whichever one the student looks at next already in sync instead of
// showing stale data until its own re-render happens to fire.
function refreshAllImageGalleriesFor(updatedList, cardId) {
  renderStudyCardImagesGallery(updatedList, cardId); // modal (default ids)
  renderStudyCardImagesGallery(updatedList, cardId, 'sourcehub-images-section', 'sourcehub-images-container');
}

// Renders the "🖼️ Eklenen Görseller" gallery in the study card modal —
// mirrors the existing Tables/Charts sections' show/hide + container pattern.
function renderStudyCardImagesGallery(images, cardId, sectionId, containerId) {
  const section = document.getElementById(sectionId || 'study-card-images-section');
  const container = document.getElementById(containerId || 'study-card-images-container');
  if (!section || !container) return;

  container.innerHTML = '';
  const list = Array.isArray(images) ? images : [];
  if (list.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  list.forEach((att) => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width: 150px; border: 1px solid rgba(22,50,92,0.1); border-radius: var(--radius-sm); overflow: hidden; background: white;';

    const img = document.createElement('img');
    img.src = att.dataUrl;
    img.alt = att.caption || '';
    img.style.cssText = 'width: 100%; height: 110px; object-fit: contain; background: var(--color-bg-alt); cursor: zoom-in;';
    img.title = 'Büyütmek için tıkla';
    img.addEventListener('click', () => {
      openImageLightbox(att.dataUrl, att.caption || '', {
        onSendToNotebook: (btn) => sendToDepot(null, btn, cardId, 'image', att.caption || 'Image', att.dataUrl)
      });
    });
    wrapper.appendChild(img);

    const footer = document.createElement('div');
    footer.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 0.3rem 0.4rem; gap: 0.3rem;';

    const label = document.createElement('span');
    label.textContent = att.caption || '';
    label.title = att.caption || '';
    label.style.cssText = 'font-size: 0.65rem; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;';
    footer.appendChild(label);

    const notebookBtn = document.createElement('button');
    notebookBtn.type = 'button';
    notebookBtn.title = 'Deftere Gönder';
    notebookBtn.textContent = '🖼️';
    notebookBtn.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 0.85rem; padding: 0.1rem;';
    notebookBtn.addEventListener('click', (e) => sendToDepot(e, notebookBtn, cardId, 'image', att.caption || 'Image', att.dataUrl));
    footer.appendChild(notebookBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.title = 'Sil';
    delBtn.textContent = '✕';
    delBtn.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 0.75rem; color: var(--color-text-muted); padding: 0.1rem;';
    delBtn.addEventListener('click', () => deleteChatAttachment(cardId, att.id));
    footer.appendChild(delBtn);

    wrapper.appendChild(footer);
    container.appendChild(wrapper);
  });
}
window.renderStudyCardImagesGallery = renderStudyCardImagesGallery;

let docChatImageGenInFlight = false;

// Paid, explicitly-triggered real-image generation — calls the
// generate-study-image edge function (OpenAI). Never invoked automatically;
// only from the "🎨 Generate Real Image (paid)" button the student clicks.
async function generateRealImageForChat(contextText, btn) {
  if (docChatImageGenInFlight) return;
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const container = document.getElementById('doc-chat-messages');

  docChatImageGenInFlight = true;
  const originalHtml = btn ? btn.innerHTML : null;
  if (btn) { btn.disabled = true; btn.textContent = isTr ? '🎨 Oluşturuluyor...' : '🎨 Generating...'; }

  try {
    const prompt = (contextText || '').slice(0, 600);
    const { data, error } = await supabaseClient.functions.invoke('generate-study-image', {
      body: { prompt }
    });

    if (error || !data || typeof data.image !== 'string') {
      const serverMsg = (data && data.error) || (error && error.message);
      console.error('generate-study-image invocation failed:', error || data);
      renderDocChatMessage('assistant', serverMsg || (isTr ? 'Görsel oluşturulamadı, lütfen tekrar deneyin.' : 'Could not generate the image, please try again.'), []);
      return;
    }

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      max-width: 88%;
      align-self: flex-start;
      background: var(--color-bg-alt);
      color: var(--color-navy);
      padding: 0.55rem 0.8rem;
      border-radius: 14px 14px 14px 2px;
      font-size: 0.8rem;
    `;
    const img = document.createElement('img');
    img.src = data.image;
    img.alt = '';
    img.style.cssText = 'max-width: 100%; border-radius: 8px; display: block;';
    bubble.appendChild(img);
    bubble.appendChild(createChatImageActionRow(data.image, isTr ? 'AI Görseli (ücretli)' : 'AI image (paid)'));
    if (container) {
      container.appendChild(bubble);
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) {
    console.error('Exception in generateRealImageForChat:', err);
    renderDocChatMessage('assistant', isTr ? 'Görsel oluşturulamadı, lütfen tekrar deneyin.' : 'Could not generate the image, please try again.', []);
  } finally {
    docChatImageGenInFlight = false;
    if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
  }
}
window.generateRealImageForChat = generateRealImageForChat;

// ==========================================
// COURSE-WIDE AUTO-GLOSSARY
// ==========================================
let currentGlossaryData = [];

async function loadGlossaryView() {
  if (!currentUser) return;

  const selectEl = document.getElementById('glossary-course-select');
  if (!selectEl) return;

  try {
    const { data: cards, error } = await supabaseClient
      .from('study_cards')
      .select('course_tag')
      .eq('user_id', currentUser.id)
      .not('course_tag', 'is', null);

    if (!error && cards) {
      const distinctTags = Array.from(new Set(cards.map(c => c.course_tag).filter(Boolean))).sort();
      selectEl.innerHTML = `<option value="ALL">${getTranslation('dash.glossary.allCourses') || 'Tüm Dersler (All Courses)'}</option>`;
      distinctTags.forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = tag;
        selectEl.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Exception fetching glossary course tags:", err);
  }

  await loadCourseGlossary();
}
window.loadGlossaryView = loadGlossaryView;

async function loadCourseGlossary() {
  const container = document.getElementById('glossary-list-container');
  const selectEl = document.getElementById('glossary-course-select');
  if (!container || !selectEl || !currentUser) return;

  container.innerHTML = `<p style="font-size:0.85rem;color:var(--color-text-muted);">Yükleniyor...</p>`;

  const selectedCourse = selectEl.value;

  try {
    let query = supabaseClient
      .from('study_cards')
      .select('id, course_tag, key_terms, documents(file_name)')
      .eq('user_id', currentUser.id);

    if (selectedCourse !== 'ALL') {
      query = query.eq('course_tag', selectedCourse);
    }

    const { data: cards, error } = await query;

    if (error) {
      console.error("Error loading study cards for glossary:", error);
      container.innerHTML = `<p style="font-size:0.85rem;color:#EF4444;">Ders sözlüğü yüklenemedi.</p>`;
      return;
    }

    if (!cards || cards.length === 0) {
      renderGlossaryEmptyState(container);
      currentGlossaryData = [];
      return;
    }

    const rawTerms = [];
    cards.forEach(card => {
      const docName = card.documents?.file_name || 'Belge';
      const terms = card.key_terms || [];
      if (Array.isArray(terms)) {
        terms.forEach(t => {
          if (t && t.term && t.definition) {
            rawTerms.push({
              term: t.term.trim(),
              definition: t.definition.trim(),
              source: docName,
              courseTag: card.course_tag
            });
          }
        });
      }
    });

    if (rawTerms.length === 0) {
      renderGlossaryEmptyState(container);
      currentGlossaryData = [];
      return;
    }

    const grouped = {};
    rawTerms.forEach(item => {
      const key = item.term.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = {
          displayTerm: item.term,
          entries: []
        };
      }
      grouped[key].entries.push(item);
    });

    const consolidatedList = [];

    Object.keys(grouped).sort().forEach(key => {
      const group = grouped[key];
      const termName = group.displayTerm;

      const defClusters = [];

      group.entries.forEach(entry => {
        let matchedCluster = null;
        for (const cluster of defClusters) {
          if (isSimilarDefinition(cluster.definition, entry.definition)) {
            matchedCluster = cluster;
            break;
          }
        }

        if (matchedCluster) {
          if (!matchedCluster.sources.includes(entry.source)) {
            matchedCluster.sources.push(entry.source);
          }
        } else {
          defClusters.push({
            definition: entry.definition,
            sources: [entry.source]
          });
        }
      });

      consolidatedList.push({
        term: termName,
        clusters: defClusters
      });
    });

    currentGlossaryData = consolidatedList;
    renderGlossaryList(consolidatedList);

  } catch (err) {
    console.error("Exception in loadCourseGlossary:", err);
    container.innerHTML = `<p style="font-size:0.85rem;color:#EF4444;">Hata oluştu.</p>`;
  }
}
window.loadCourseGlossary = loadCourseGlossary;

function isSimilarDefinition(def1, def2) {
  const words1 = new Set((def1 || '').toLowerCase().match(/\b\w+\b/g) || []);
  const words2 = new Set((def2 || '').toLowerCase().match(/\b\w+\b/g) || []);
  if (words1.size === 0 || words2.size === 0) return true;
  let overlap = 0;
  words1.forEach(w => { if (words2.has(w)) overlap++; });
  const similarity = overlap / Math.min(words1.size, words2.size);
  return similarity >= 0.4;
}

function renderGlossaryList(list) {
  const container = document.getElementById('glossary-list-container');
  if (!container) return;

  if (!list || list.length === 0) {
    renderGlossaryEmptyState(container);
    return;
  }

  container.innerHTML = '';
  list.forEach(item => {
    const cardEl = document.createElement('div');
    cardEl.className = 'glossary-card';

    let defsHtml = '';
    item.clusters.forEach(cluster => {
      const sourcesText = cluster.sources.join(', ');
      defsHtml += `
        <div class="glossary-definition-block">
          <div>${escapeHtml(cluster.definition)}</div>
          <div class="glossary-source-badge">
            <span>📄 ${escapeHtml(sourcesText)}</span>
          </div>
        </div>
      `;
    });

    cardEl.innerHTML = `
      <div class="glossary-term-name">📌 ${escapeHtml(item.term)}</div>
      ${defsHtml}
    `;

    container.appendChild(cardEl);
  });
}

function renderGlossaryEmptyState(container) {
  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  container.innerHTML = `
    <div class="empty-state" style="padding: 3rem 1.5rem; background: var(--color-white); border-radius: var(--radius-md); border: 1px solid rgba(22,50,92,0.08);">
      <svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
      <h3 class="empty-state-title">${isTr ? 'Henüz ders kodlu çalışma kartı bulunmuyor' : 'No course-tagged study cards yet'}</h3>
      <p class="empty-state-text">${isTr ? 'Ders sözlüğü oluşturmak için Belgelerim veya Bilgi Kartları sayfasında kartlarınıza ders kodu ekleyin.' : 'Add a course tag to your study cards on Belgelerim or Bilgi Kartları to build a glossary.'}</p>
    </div>
  `;
}

function filterGlossaryList() {
  const query = (document.getElementById('glossary-search-input')?.value || '').toLowerCase().trim();
  if (!query) {
    renderGlossaryList(currentGlossaryData);
    return;
  }

  const filtered = currentGlossaryData.filter(item => {
    const termMatch = item.term.toLowerCase().includes(query);
    const defMatch = item.clusters.some(c => c.definition.toLowerCase().includes(query) || c.sources.some(s => s.toLowerCase().includes(query)));
    return termMatch || defMatch;
  });

  renderGlossaryList(filtered);
}
window.filterGlossaryList = filterGlossaryList;

async function exportGlossaryToPdf() {
  if (!currentGlossaryData || currentGlossaryData.length === 0) {
    showDashboardAlert('error', 'Aktarılacak terim bulunamadı.');
    return;
  }

  try {
    if (!window.jspdf) {
      await window.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const selectEl = document.getElementById('glossary-course-select');
    const courseName = selectEl ? selectEl.value : 'ALL';

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`Acadex Course Glossary — ${courseName}`, 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 27);

    let y = 35;
    const pageHeight = doc.internal.pageSize.height;

    currentGlossaryData.forEach((item, idx) => {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(22, 50, 92);
      doc.text(`${idx + 1}. ${item.term}`, 14, y);
      y += 6;

      item.clusters.forEach(cluster => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(40);
        
        const splitText = doc.splitTextToSize(cluster.definition, 175);
        doc.text(splitText, 18, y);
        y += splitText.length * 4.5;

        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(120);
        doc.text(`Source: ${cluster.sources.join(', ')}`, 18, y);
        y += 7;
      });

      y += 3;
    });

    doc.save(`Acadex_Glossary_${courseName.replace(/\s+/g, '_')}.pdf`);
    showDashboardAlert('success', 'Sözlük PDF olarak aktarıldı!');

  } catch (err) {
    console.error("PDF export failed:", err);
    showDashboardAlert('error', 'PDF aktarımı başarısız oldu.');
  }
}
window.exportGlossaryToPdf = exportGlossaryToPdf;




