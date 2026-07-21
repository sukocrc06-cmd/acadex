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
        pollingInterval = setInterval(() => loadDocuments(true), 2000);
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
      if (doc.processing_stage === 'extracting') {
        progressMsg = isTr ? 'Metin çıkarılıyor...' : 'Extracting text...';
      } else if (doc.processing_stage === 'analyzing') {
        progressMsg = isTr ? 'Özet oluşturuluyor...' : 'Analyzing content...';
      } else if (doc.processing_stage === 'reviewing') {
        progressMsg = isTr ? 'Doğruluk kontrol ediliyor...' : 'Reviewing for accuracy...';
      }

      const badgeText = isTr ? 'İşleniyor' : 'Processing';
      statusBadgeHtml = `<span class="doc-status-badge" style="background-color: #FEF3C7; color: #D97706; font-weight: 700;">${badgeText}</span>`;
      actionBtnHtml = `
        <button class="btn btn-outline" disabled style="width: 100%; padding: 0.5rem 1rem; font-size: 0.85rem; margin-top: 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;" title="${progressMsg}">
          <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 14px; height: 14px; margin-right: 0;">
            <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
          </svg>
          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${progressMsg}</span>
        </button>
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

async function proceedWithSummarization() {
  const styleSelect = document.querySelector('input[name="summary-style-choice"]:checked');
  const summaryStyle = styleSelect ? styleSelect.value : 'standard';
  const langSelect = document.querySelector('input[name="summary-language-choice"]:checked');
  const language = langSelect ? langSelect.value : 'en';
  const lengthSelect = document.querySelector('input[name="summary-length-choice"]:checked');
  const summaryLength = lengthSelect ? lengthSelect.value : 'medium';

  if (isMergeSummarize) {
    closeSummaryStyleModal();
    await triggerMergeSummarize(pendingMergeDocIds, summaryStyle, language, summaryLength);
    isMergeSummarize = false;
    pendingMergeDocIds = [];
    return;
  }

  if (isBulkSummarize) {
    closeSummaryStyleModal();
    await proceedWithBulkSummarization(summaryStyle, language, summaryLength);
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
    // Set document status to processing first in database so that page reload / polling reflects it
    await supabaseClient
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', docId);


    const { data, error } = await supabaseClient.functions.invoke('summarize-document', {
      body: { documentId: docId, summaryStyle: summaryStyle, language: language, summaryLength: summaryLength, analyzeVisuals: analyzeVisuals }
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
      showDashboardAlert('success', 'Document processing started successfully.');
      await loadDocuments();
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
        footnotesMap[fn.id] = fn.reference || `Reference ${fn.id}`;
      }
    });
  }

  return text.replace(/\[(\d+)\]/g, (match, fnId) => {
    const refText = footnotesMap[fnId] || `Reference ${fnId}`;
    const escapedRef = escapeHtml(refText).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `<sup class="footnote-marker" title="${escapedRef}" onclick="event.stopPropagation(); showFootnoteToast('${escapedRef}')">[${fnId}]</sup>`;
  });
}
window.formatFootnoteMarkers = formatFootnoteMarkers;

function renderFootnotesSectionHtml(footnotesArray) {
  if (!Array.isArray(footnotesArray) || footnotesArray.length === 0) return "";
  
  let itemsHtml = footnotesArray.map(fn => `
    <li id="fn-ref-${fn.id}">
      <strong>[${fn.id}]</strong> ${escapeHtml(fn.reference || '')}
    </li>
  `).join('');

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

function showFootnoteToast(refText) {
  showDashboardAlert('info', `📎 ${refText}`);
}
window.showFootnoteToast = showFootnoteToast;

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

async function populateStudyCardModalDetails(card, docName, readOnly) {
  currentActiveStudyCard = { ...card, documentFileName: docName };
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

  // Populate Summary
  const summaryText = document.getElementById('study-card-summary-text');
  if (summaryText) summaryText.innerHTML = formatSummaryText(card.summary, card.footnotes) || "No summary generated for this document.";

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
  const tablesSection = document.getElementById('study-card-tables-section');
  const tablesContainer = document.getElementById('study-card-tables-container');
  if (tablesSection && tablesContainer) {
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

  // Populate Charts
  const chartsSection = document.getElementById('study-card-charts-section');
  const chartsContainer = document.getElementById('study-card-charts-container');
  if (chartsSection && chartsContainer) {
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
  const tabs = ['home', 'planner', 'docs', 'feed', 'notebook', 'cards', 'glossary', 'exams', 'settings', 'sandbox', 'admin'];
  tabs.forEach(tab => {
    const el = document.getElementById(`side-${tab}`);
    if (el) {
      if (tab === viewId) el.classList.add('active');
      else el.classList.remove('active');
    }
  });

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
  } else if (viewId === 'glossary') {
    loadGlossaryView();
  } else if (viewId === 'exams') {
    loadExamsPlatform();
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

function openFlashcardViewer(cardId, type, fileName) {
  const card = libraryCards.find(c => c.id === cardId) || notebookCards.find(c => c.id === cardId);
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
  }

  const titleEl = document.getElementById('flashcard-modal-title');
  if (titleEl) {
    const label = type === 'terms' ? 'Anahtar Terimler' : (type === 'points' ? 'Önemli Noktalar' : 'Kendi Kendine Test');
    titleEl.textContent = `${fileName} - ${label}`;
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

  if (reviewType === 'quiz') {
    firstPillText = 'SORU';
    firstContentText = item.question || '';
    secondPillText = 'CEVAP';
    secondContentText = item.answer || '';
  } else if (reviewType === 'terms') {
    firstPillText = 'TERİM';
    firstContentText = item.term || '';
    secondPillText = 'TANIM';
    secondContentText = item.definition || '';
  } else if (reviewType === 'points') {
    firstPillText = 'ÖNEMLİ NOKTA';
    firstContentText = typeof item === 'string' ? item : (item.point || item.text || '');
    secondPillText = '';
    secondContentText = '';
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

async function handleConfidenceRating(rating) {
  try {
    if (reviewCardId && reviewItems[reviewIndex]) {
      const item = reviewItems[reviewIndex];
      const itemKey = item.term || item.question || (typeof item === 'string' ? item : item.point) || `item-${reviewIndex}`;
      
      const now = new Date();
      let intervalDays = (rating === 'good') ? 3 : 0.5;
      const nextReviewDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

      await supabaseClient
        .from('card_item_confidence')
        .upsert({
          user_id: currentUser.id,
          study_card_id: reviewCardId,
          item_key: itemKey,
          rating: rating,
          next_review_at: nextReviewDate,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,study_card_id,item_key' });
    }
  } catch (e) {
    console.warn("Confidence record:", e);
  }
  
  nextFlashcard();
}
window.handleConfidenceRating = handleConfidenceRating;

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

async function proceedWithBulkSummarization(summaryStyle, language, summaryLength) {
  const docIds = [...activeBulkSummarizingDocIds];
  const totalCount = docIds.length;
  let completedCount = 0;
  
  showBulkSummarizeProgress(`Summarizing 1 of ${totalCount}...`);
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
        await supabaseClient
          .from('documents')
          .update({ status: 'processing' })
          .eq('id', docId);

        const { data, error } = await supabaseClient.functions.invoke('summarize-document', {
          body: { documentId: docId, summaryStyle: summaryStyle, language: language, summaryLength: summaryLength }
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
        showBulkSummarizeProgress(`Summarizing ${completedCount + 1} of ${totalCount}...`);
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

function showBulkSummarizeProgress(text) {
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
      align-items: center;
      gap: 1rem;
      font-weight: 700;
    `;
    alertEl.innerHTML = `
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 20px; height: 20px; color: var(--color-teal); margin-right: 0;">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
      </svg>
      <span id="bulk-summarize-progress-text"></span>
    `;
    document.body.appendChild(alertEl);
  }
  const textEl = document.getElementById('bulk-summarize-progress-text');
  if (textEl) textEl.textContent = text;
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
async function triggerMergeSummarize(documentIds, summaryStyle, language, summaryLength, analyzeVisuals) {
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
      body: JSON.stringify({ documentIds, summaryStyle, language, summaryLength, analyzeVisuals: !!analyzeVisuals })
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

    const response = await fetch(`${SUPABASE_URL}/functions/v1/acadia-chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        messages: acadiaChatHistory
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

    renderAcadiaMessage('assistant', data.reply);
    acadiaChatHistory.push({ role: 'assistant', content: data.reply });
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

  rightPane.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.9rem;color:var(--color-text-muted);">Yükleniyor / Loading...</div>`;

  try {
    let storagePath = currentActiveStudyCard.storage_path;
    let fileName = currentActiveStudyCard.documentFileName || '';
    let mimeType = currentActiveStudyCard.mime_type || '';

    if (!storagePath && currentActiveStudyCard.document_id) {
      const { data: docData } = await supabaseClient
        .from('documents')
        .select('storage_path, file_name, mime_type')
        .eq('id', currentActiveStudyCard.document_id)
        .single();
      
      if (docData) {
        storagePath = docData.storage_path;
        fileName = docData.file_name || fileName;
        mimeType = docData.mime_type || mimeType;
      }
    }

    if (!storagePath) {
      rightPane.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.9rem;color:#EF4444;">Dosya yolu bulunamadı / Document file path not found.</div>`;
      return;
    }

    // Generate signed URL (300 seconds = 5 min expiry)
    const { data: signedData, error: signedErr } = await supabaseClient
      .storage
      .from('documents')
      .createSignedUrl(storagePath, 300);

    if (signedErr || !signedData?.signedUrl) {
      console.error("Failed to create signed URL:", signedErr);
      rightPane.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.9rem;color:#EF4444;">Belge yüklenemedi / Could not load document.</div>`;
      return;
    }

    const lowerName = fileName.toLowerCase();
    const isPdf = lowerName.endsWith('.pdf') || mimeType === 'application/pdf';

    if (isPdf) {
      rightPane.innerHTML = `<iframe src="${signedData.signedUrl}" style="width:100%;height:100%;border:none;border-radius:var(--radius-sm);"></iframe>`;
    } else {
      // Non-PDF (Word / PowerPoint) download panel
      rightPane.innerHTML = `
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
    console.error("Exception loading original doc viewer:", err);
    rightPane.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.9rem;color:#EF4444;">Hata oluştu / Error loading document.</div>`;
  }
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
    if (!text) return;
    input.value = '';
    sendDocChatMessage(text);
  });
}
window.initDocChatForm = initDocChatForm;

function resetDocChatState() {
  docChatHistory = [];
  docChatHasGreeted = false;
  isDocChatPaneActive = false;
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

function renderDocChatMessage(role, text, citations) {
  const container = document.getElementById('doc-chat-messages');
  if (!container) return;

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
    bubble.textContent = text;
  } else {
    // Escape first, then apply citation markers — formatFootnoteMarkers only
    // touches literal "[n]" substrings so this is safe and closes off any
    // stored-XSS risk from AI-generated answer text.
    bubble.innerHTML = formatFootnoteMarkers(escapeHtml(text), citations);
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

async function sendDocChatMessage(text) {
  if (docChatRequestInFlight) return;
  if (!currentActiveStudyCard || !currentActiveStudyCard.id) return;

  const isTr = (localStorage.getItem('acadexUILang') || 'en') === 'tr';
  const cardId = currentActiveStudyCard.id;

  renderDocChatMessage('user', text, []);
  docChatHistory.push({ role: 'user', content: text });

  const sendBtn = document.getElementById('btn-doc-chat-send');
  const typingIndicator = document.getElementById('doc-chat-typing-indicator');
  docChatRequestInFlight = true;
  if (sendBtn) sendBtn.disabled = true;
  if (typingIndicator) typingIndicator.style.display = 'block';

  try {
    const { data, error } = await supabaseClient.functions.invoke('chat-with-document', {
      body: { studyCardId: cardId, messages: docChatHistory }
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

    renderDocChatMessage('assistant', data.answer, data.citations || []);
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




