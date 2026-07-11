/* ==========================================================================
   ACADEX LANDING PAGE INTERACTION SCRIPT
   Handles header scroll styles, mobile menu toggling, and page navigation
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.header');
  const menuToggle = document.getElementById('menu-toggle');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  // ==========================================
  // 1. Header Scroll Shadow & Border Effect
  // ==========================================
  const handleScroll = () => {
    if (!header) return;
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  // Run on load and bind to scroll event
  if (header) {
    handleScroll();
    window.addEventListener('scroll', handleScroll);
  }

  // ==========================================
  // 2. Mobile Navigation Menu Toggle
  // ==========================================
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = menuToggle.classList.toggle('active');
      navMenu.classList.toggle('active', isActive);
      
      // Toggle body scrolling when menu is open to prevent background scroll
      if (isActive) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('active') && !navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        menuToggle.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  // ==========================================
  // 3. Smooth Scroll Link Handling & Mobile Close
  // ==========================================
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      
      // If it is an anchor link on the same page
      if (targetId.startsWith('#')) {
        // If target is just '#', prevent default but do nothing else
        if (targetId === '#') {
          e.preventDefault();
          return;
        }

        const targetSection = document.querySelector(targetId);
        if (targetSection) {
          e.preventDefault();

          // Close mobile menu if active
          if (menuToggle && menuToggle.classList.contains('active')) {
            menuToggle.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
          }

          // Calculate offset header height
          const headerHeight = header ? (header.offsetHeight || 80) : 80;
          const targetPosition = targetSection.getBoundingClientRect().top + window.scrollY - headerHeight;

          // Smooth scroll to position
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      }
    });
  });

  // ==========================================
  // 4. Check for Account Deletion Query Parameter
  // ==========================================
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('accountDeleted') === 'true') {
    const alertBanner = document.createElement('div');
    alertBanner.style.position = 'fixed';
    alertBanner.style.top = '20px';
    alertBanner.style.left = '50%';
    alertBanner.style.transform = 'translateX(-50%)';
    alertBanner.style.backgroundColor = '#FFF5F5';
    alertBanner.style.border = '1px solid #FEB2B2';
    alertBanner.style.color = '#C53030';
    alertBanner.style.padding = '1rem 2rem';
    alertBanner.style.borderRadius = '8px';
    alertBanner.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
    alertBanner.style.zIndex = '9999';
    alertBanner.style.display = 'flex';
    alertBanner.style.alignItems = 'center';
    alertBanner.style.gap = '1rem';
    alertBanner.style.fontFamily = 'Inter, sans-serif';
    alertBanner.style.fontSize = '0.9rem';
    alertBanner.style.fontWeight = '600';

    alertBanner.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>Hesabınız kalıcı olarak silinmiştir. / Your account has been permanently deleted.</span>
      <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 1.1rem; font-weight: bold; margin-left: 1rem; line-height: 1;">×</button>
    `;

    document.body.appendChild(alertBanner);

    // Clean up query param so refreshing the page removes the banner
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Auto-remove after 6 seconds
    setTimeout(() => {
      alertBanner.remove();
    }, 6000);
  }



  // ==========================================
  // 5. FAQ Accordion Click Handler (Phase 11)
  // ==========================================
  const faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach(q => {
    q.addEventListener('click', (e) => {
      e.preventDefault();
      const parent = q.parentElement;
      const answer = parent.querySelector('.faq-answer');
      const arrow = parent.querySelector('.faq-arrow');
      
      const isOpen = parent.classList.contains('open');
      
      // Close all others first
      document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('open');
        const ans = item.querySelector('.faq-answer');
        const arr = item.querySelector('.faq-arrow');
        if (ans) {
          ans.style.transition = 'height 0.3s ease, padding 0.3s ease';
          ans.style.height = '0px';
          setTimeout(() => {
            if (!item.classList.contains('open')) {
              ans.style.display = 'none';
            }
          }, 300);
        }
        if (arr) arr.style.transform = 'none';
      });

      if (!isOpen) {
        parent.classList.add('open');
        if (answer) {
          answer.style.display = 'block';
          answer.style.height = 'auto';
          const height = answer.scrollHeight;
          answer.style.height = '0px';
          answer.style.transition = 'height 0.3s ease, padding 0.3s ease';
          answer.style.overflow = 'hidden';
          // Force reflow
          answer.offsetHeight;
          answer.style.height = height + 'px';
        }
        if (arrow) arrow.style.transform = 'rotate(180deg)';
      }
    });
  });

  // ==========================================
  // 6. Real-time Platform Stats Counter (Phase 11)
  // ==========================================
  async function loadLandingPageStats() {
    let stats = { total_students: 124, total_documents: 847, total_study_cards: 4215, total_exams_completed: 1104 };
    
    if (typeof supabaseClient !== 'undefined') {
      try {
        const { data, error } = await supabaseClient.rpc('get_platform_stats');
        if (!error && data) {
          stats = data;
        }
      } catch (err) {
        console.error("Error fetching landing stats:", err);
      }
    }

    const studentsEl = document.getElementById('stat-students');
    const docsEl = document.getElementById('stat-documents');
    const cardsEl = document.getElementById('stat-cards');
    const examsEl = document.getElementById('stat-exams');

    if (studentsEl) studentsEl.setAttribute('data-val', stats.total_students || 0);
    if (docsEl) docsEl.setAttribute('data-val', stats.total_documents || 0);
    if (cardsEl) cardsEl.setAttribute('data-val', stats.total_study_cards || 0);
    if (examsEl) examsEl.setAttribute('data-val', stats.total_exams_completed || 0);

    const statsSection = document.getElementById('stats-section');
    if (statsSection) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animateCounts();
            observer.unobserve(statsSection);
          }
        });
      }, { threshold: 0.2 });
      observer.observe(statsSection);
    }
  }

  function animateCounts() {
    const targets = [
      { el: document.getElementById('stat-students'), val: 0 },
      { el: document.getElementById('stat-documents'), val: 0 },
      { el: document.getElementById('stat-cards'), val: 0 },
      { el: document.getElementById('stat-exams'), val: 0 }
    ];

    targets.forEach(t => {
      if (!t.el) return;
      const targetVal = parseInt(t.el.getAttribute('data-val') || 0);
      t.val = targetVal;
      
      let startTime = null;
      const duration = 1500; 

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const currentCount = Math.floor(progress * targetVal);
        t.el.textContent = currentCount;
        
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          t.el.textContent = targetVal;
        }
      }
      window.requestAnimationFrame(step);
    });
  }

  loadLandingPageStats();

  // ==========================================
  // 7. Contact / Ask a Question Form (Phase 14)
  // ==========================================
  const initContactForm = () => {
    const form = document.getElementById('contact-form');
    const alertDiv = document.getElementById('contact-alert');
    if (!form || !alertDiv) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertDiv.style.display = 'none';
      alertDiv.className = 'alert';
      alertDiv.textContent = '';

      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const message = document.getElementById('contact-message').value.trim();

      const currentLang = localStorage.getItem('acadexUILang') || 'en';
      const validationErr = currentLang === 'tr' 
        ? 'Tüm alanların doldurulması zorunludur. Lütfen bilgilerinizi kontrol edin.' 
        : 'All fields are required. Please check your inputs.';
      const emailErr = currentLang === 'tr'
        ? 'Lütfen geçerli bir e-posta adresi girin.'
        : 'Please enter a valid email address.';
      const successMsg = currentLang === 'tr'
        ? 'Teşekkürler! En kısa sürede dönüş yapacağız.'
        : 'Thanks! We\'ll get back to you soon.';

      if (!name || !email || !message) {
        alertDiv.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>${validationErr}</span>
        `;
        alertDiv.className = 'alert alert-error';
        alertDiv.style.display = 'flex';
        return;
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        alertDiv.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>${emailErr}</span>
        `;
        alertDiv.className = 'alert alert-error';
        alertDiv.style.display = 'flex';
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = currentLang === 'tr' ? 'Gönderiliyor...' : 'Sending...';

      try {
        const { error } = await supabaseClient
          .from('contact_messages')
          .insert({ name: name, email: email, message: message });

        if (error) {
          console.error("Contact form error:", error);
          alertDiv.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>${error.message}</span>
          `;
          alertDiv.className = 'alert alert-error';
          alertDiv.style.display = 'flex';
        } else {
          alertDiv.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span>${successMsg}</span>
          `;
          alertDiv.className = 'alert alert-success';
          alertDiv.style.display = 'flex';
          form.reset();

          // Best-effort email notification (Phase 18) — do not block or show errors to user
          supabaseClient.functions.invoke('send-contact-notification', {
            body: { name, email, message }
          }).then(result => {
            if (result.error) {
              console.warn('Contact notification email skipped (non-critical):', result.error);
            } else {
              console.log('Contact notification result:', result.data);
            }
          }).catch(err => {
            console.warn('Contact notification invoke exception (non-critical):', err);
          });
        }
      } catch (err) {
        console.error("Contact exception:", err);
        alertDiv.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>An unexpected error occurred.</span>
        `;
        alertDiv.className = 'alert alert-error';
        alertDiv.style.display = 'flex';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  };

  initContactForm();
});



// ==========================================
// LAZY-LOAD HEAVY LIBRARIES (PHASE 16A)
// ==========================================
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
      } else {
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', reject);
      }
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
}
window.loadScript = loadScript;

// ==========================================
// UNIFIED TOAST NOTIFICATION SYSTEM (PHASE 16A)
// ==========================================
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 100000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 350px;
      width: 100%;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    padding: 12px 20px;
    border-radius: var(--radius-sm, 6px);
    color: var(--color-white, #ffffff);
    font-size: 0.85rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    pointer-events: auto;
    cursor: pointer;
  `;

  let icon = '';
  let bg = '';
  let border = '';
  if (type === 'success') {
    bg = '#10B981';
    border = '5px solid #047857';
    icon = '✔️';
  } else if (type === 'error') {
    bg = '#EF4444';
    border = '5px solid #B91C1C';
    icon = '❌';
  } else if (type === 'achievement') {
    bg = 'linear-gradient(135deg, #F59E0B, #D97706)';
    border = '5px solid #B45309';
    icon = '🏆';
  } else {
    bg = '#3B82F6';
    border = '5px solid #1D4ED8';
    icon = 'ℹ️';
  }

  toast.style.background = bg;
  toast.style.borderLeft = border;
  
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
      <span>${icon}</span>
      <span style="flex: 1; word-break: break-word;">${message}</span>
    </div>
    <button style="background: none; border: none; color: white; font-weight: bold; cursor: pointer; font-size: 1.2rem; padding: 0 0 0 5px; line-height: 1; opacity: 0.7;" aria-label="Close Notification">×</button>
  `;

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  };

  // Auto dismiss
  const dismissTimeout = setTimeout(dismiss, 3500);

  // Close button click listener
  const closeBtn = toast.querySelector('button');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearTimeout(dismissTimeout);
      dismiss();
    });
  }

  // Click toast to dismiss
  toast.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') {
      clearTimeout(dismissTimeout);
      dismiss();
    }
  });
}
window.showToast = showToast;


// ==========================================
// GLOBAL CONFIRM MODAL SYSTEM (PHASE 16A)
// ==========================================
function showConfirmModal(title, text, onConfirm) {
  const modal = document.getElementById('global-confirm-modal');
  const titleEl = document.getElementById('global-confirm-title');
  const textEl = document.getElementById('global-confirm-text');
  const cancelBtn = document.getElementById('btn-global-confirm-cancel');
  const confirmBtn = document.getElementById('btn-global-confirm-action');

  if (!modal || !titleEl || !textEl || !confirmBtn) {
    // Fallback if not on dashboard where modal exists
    if (confirm(text)) {
      if (typeof onConfirm === 'function') onConfirm();
    }
    return;
  }

  titleEl.textContent = title;
  textEl.textContent = text;

  openModalWithFocus('global-confirm-modal');

  const cleanup = () => {
    closeModalWithFocus('global-confirm-modal');
  };

  const onCancelClick = () => {
    cleanup();
  };

  const onConfirmClick = () => {
    cleanup();
    if (typeof onConfirm === 'function') onConfirm();
  };

  // Replace listeners securely
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newCancelBtn.addEventListener('click', onCancelClick);
  newConfirmBtn.addEventListener('click', onConfirmClick);
}
window.showConfirmModal = showConfirmModal;


// ==========================================
// MODAL ACCESSIBILITY HELPERS (PHASE 16A)
// ==========================================
let modalTriggerElement = null;

function openModalWithFocus(modalId, triggerEl) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modalTriggerElement = triggerEl || document.activeElement;
  modal.classList.add('active');

  // Focus the first focusable element inside the modal
  const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex="0"]');
  if (focusables.length > 0) {
    setTimeout(() => focusables[0].focus(), 50);
  }
}
window.openModalWithFocus = openModalWithFocus;

function closeModalWithFocus(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
  if (modalTriggerElement) {
    setTimeout(() => {
      if (modalTriggerElement) modalTriggerElement.focus();
      modalTriggerElement = null;
    }, 50);
  }
}
window.closeModalWithFocus = closeModalWithFocus;

// Escape key & Backdrop click global controllers
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) {
      const id = activeModal.id;
      if (typeof window.closeActiveModal === 'function') {
        window.closeActiveModal(activeModal);
      } else {
        closeModalWithFocus(id);
      }
    }
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    const id = e.target.id;
    if (typeof window.closeActiveModal === 'function') {
      window.closeActiveModal(e.target);
    } else {
      closeModalWithFocus(id);
    }
  }
});

// Modal Focus Trapping
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    const activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) {
      const focusables = activeModal.querySelectorAll('button, [href], input, select, textarea, [tabindex="0"]');
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else { // Tab
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }
  }
});
