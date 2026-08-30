/* ==========================================================================
   ACADEX AUTHENTICATION FLOWS (js/auth.js)
   Handles form validation, Supabase Auth transactions, error feedback,
   and page routing based on active session state.
   ========================================================================== */

function getMsg(key, defaultVal) {
  const lang = localStorage.getItem('acadexUILang') || 'tr';
  if (window.TRANSLATIONS && window.TRANSLATIONS[lang] && window.TRANSLATIONS[lang][key]) {
    return window.TRANSLATIONS[lang][key];
  }
  return defaultVal;
}

// ==========================================
// Role-based landing page (Admin Paneli / Hoca Paneli / Dashboard)
//
// Acadex uses boolean flags on profiles (is_admin, is_teacher) rather than
// a single role column. This looks up those flags for the given user and
// returns which page they should land on after login / when they already
// have a session. Fails open to the normal student dashboard on any error,
// so a profile lookup hiccup never locks a student out of their portal.
// ==========================================
async function getPostLoginDestination(userId) {
  try {
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('is_admin, is_teacher')
      .eq('id', userId)
      .single();

    if (error || !profile) return 'dashboard.html';
    if (profile.is_admin) return 'admin.html';
    if (profile.is_teacher) return 'teacher.html';
    return 'dashboard.html';
  } catch (e) {
    console.error('getPostLoginDestination error:', e);
    return 'dashboard.html';
  }
}

// ==========================================
// Academic sign-in note
//
// login.html no longer has a Student/Academic mode toggle or a hoca
// self-registration form (register-academic.html) — hoca accounts now
// arrive exclusively via Campuso SSO (see supabase/functions/campuso-sso
// and sso-callback.html), which sets profiles.is_teacher = true on first
// arrival and drops the visitor straight into teacher.html. Routing for
// whoever DOES sign in here with a password (students, and any
// already-approved teacher/admin account from before this change) is still
// 100% decided server-side by getPostLoginDestination() via
// profiles.is_admin / is_teacher — nothing about that changed.
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  const path = window.location.pathname;
  const isLoginPage = path.includes('login.html');
  const isRegisterPage = path.includes('register.html') && !path.includes('register-academic.html');

  // ==========================================
  // 1. Session Redirect Guard on Load
  // ==========================================
  if (isLoginPage || isRegisterPage) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        // If user already logged in, send them straight to their portal
        // (admin/hoca panel or the regular student dashboard).
        window.location.href = await getPostLoginDestination(session.user.id);
        return;
      }
    } catch (e) {
      console.error("Session check failed", e);
    }
  }

  // ==========================================
  // 2. Initialize Forms based on current page
  // ==========================================
  if (isLoginPage) {
    initLoginForm();
    initForgotForm();
  } else if (isRegisterPage) {
    initRegisterForm();
  }
});

// ==========================================
// 3. User-Friendly Error Message Translator
// ==========================================
function getFriendlyError(message) {
  if (!message) return "An unexpected error occurred. Please try again.";
  
  const msg = message.toLowerCase();
  
  if (msg.includes("already registered") || msg.includes("user_already_exists")) {
    return "This email is already registered. Please log in instead.";
  }
  if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
    return "Invalid email or password. Please verify and try again.";
  }
  if (msg.includes("password should be")) {
    return "Password must be at least 6 characters long.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Network error. Please check your internet connection and try again.";
  }
  if (msg.includes("database error") || msg.includes("unexpected_failure")) {
    return "A server error occurred while creating the account. Please try again in a moment, or contact support if this keeps happening.";
  }
  if (msg.includes("rate limit")) {
    return "Too many signup attempts right now. Please wait a few minutes and try again.";
  }

  return message; // fallback to supabase error message if we can't map it
}

// ==========================================
// 4. Registration Form Controller
// ==========================================

// EDIT: Fill in your institution's real student email domain(s) here to
// restrict signups to verified students, e.g. ["ogr.acadex.edu.tr"].
// Leave the array empty to allow any email address (current pilot default).
const ALLOWED_STUDENT_EMAIL_DOMAINS = [];

function isAllowedStudentEmail(email) {
  if (!ALLOWED_STUDENT_EMAIL_DOMAINS.length) return true;
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return ALLOWED_STUDENT_EMAIL_DOMAINS.some(allowed => domain === allowed.toLowerCase());
}

function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  // Anti-bot: timestamp the moment the form became interactive. Genuine
  // students take at least a couple of seconds to fill the form; a submit
  // that arrives almost instantly is a strong bot signal.
  const formRenderedAt = Date.now();
  const MIN_HUMAN_FILL_TIME_MS = 2500;

  const checkbox = document.getElementById('legal-agree');
  const signupBtn = document.getElementById('btn-signup');
  if (checkbox && signupBtn) {
    checkbox.addEventListener('change', (e) => {
      signupBtn.disabled = !e.target.checked;
    });
  }

  // Password Strength Indicator
  const passwordInput = document.getElementById('password');
  const strengthBar = document.getElementById('password-strength-bar');
  const strengthLabel = document.getElementById('password-strength-label');

  if (passwordInput && strengthBar && strengthLabel) {
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      if (!val) {
        strengthBar.style.width = '0%';
        strengthBar.className = '';
        strengthLabel.textContent = '—';
        strengthLabel.style.color = 'var(--color-text-muted)';
        return;
      }

      let criteriaMet = 0;
      if (val.length >= 8) criteriaMet++;
      if (/[A-Z]/.test(val)) criteriaMet++;
      if (/[0-9]/.test(val)) criteriaMet++;
      if (/[^A-Za-z0-9]/.test(val)) criteriaMet++;

      const currentLang = localStorage.getItem('acadexUILang') || 'tr';
      const weakText = currentLang === 'tr' ? 'Zayıf' : 'Weak';
      const mediumText = currentLang === 'tr' ? 'Orta' : 'Medium';
      const strongText = currentLang === 'tr' ? 'Güçlü' : 'Strong';

      if (criteriaMet <= 1) {
        strengthBar.style.width = '33%';
        strengthBar.className = 'strength-weak';
        strengthLabel.textContent = weakText;
        strengthLabel.style.color = '#EF4444';
      } else if (criteriaMet <= 3) {
        strengthBar.style.width = '66%';
        strengthBar.className = 'strength-medium';
        strengthLabel.textContent = mediumText;
        strengthLabel.style.color = '#F59E0B';
      } else {
        strengthBar.style.width = '100%';
        strengthBar.className = 'strength-strong';
        strengthLabel.textContent = strongText;
        strengthLabel.style.color = '#10B981';
      }
    });
  }

  // Debounced Student Number Check
  const studentNumInput = document.getElementById('student-number');
  const warningDiv = document.getElementById('student-number-warning');
  let debounceTimeout = null;

  if (studentNumInput && warningDiv) {
    const checkStudentNumber = async () => {
      const value = studentNumInput.value.trim();
      if (!value || value.length < 6) {
        warningDiv.style.display = 'none';
        return;
      }

      try {
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('student_number', value)
          .maybeSingle();

        const currentLang = localStorage.getItem('acadexUILang') || 'tr';
        const warningMessage = currentLang === 'tr' 
          ? 'Bu öğrenci numarası zaten kayıtlı. Bunun yerine <a href="login.html" style="color: var(--color-teal); text-decoration: underline;">giriş yapmak</a> ister misiniz?' 
          : 'This student number is already registered. Did you mean to <a href="login.html" style="color: var(--color-teal); text-decoration: underline;">log in</a> instead?';

        if (data) {
          warningDiv.innerHTML = warningMessage;
          warningDiv.style.display = 'block';
        } else {
          warningDiv.style.display = 'none';
        }
      } catch (err) {
        console.error("Error checking student number: ", err);
      }
    };

    studentNumInput.addEventListener('input', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(checkStudentNumber, 500);
    });

    studentNumInput.addEventListener('blur', () => {
      clearTimeout(debounceTimeout);
      checkStudentNumber();
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    clearFormErrors(form);

    // Anti-bot check #1: honeypot field. It's hidden from real users via CSS,
    // so only an automated script filling every field would populate it.
    const honeypot = document.getElementById('website');
    if (honeypot && honeypot.value.trim() !== '') {
      console.warn('Registration blocked: honeypot field was filled.');
      // Fail silently with a generic message so bots don't learn why.
      showFormAlert(form, 'error', getMsg('validation.unexpectedError', 'An unexpected error occurred. Please try again.'));
      return;
    }

    // Anti-bot check #2: minimum fill time. Reject submissions that arrive
    // faster than a human could plausibly complete the form.
    if (Date.now() - formRenderedAt < MIN_HUMAN_FILL_TIME_MS) {
      console.warn('Registration blocked: form submitted too quickly.');
      showFormAlert(form, 'error', getMsg('validation.unexpectedError', 'An unexpected error occurred. Please try again.'));
      return;
    }

    // Grab input values
    const fullName = document.getElementById('full-name').value.trim();
    const studentNumber = document.getElementById('student-number').value.trim();
    const department = document.getElementById('department').value;
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const submitBtn = form.querySelector('button[type="submit"]');

    // Client-side validations
    let isValid = true;

    if (!fullName) {
      showFieldError('full-name', getMsg('validation.fullNameRequired', 'Full Name is required.'));
      isValid = false;
    }

    if (!studentNumber) {
      showFieldError('student-number', getMsg('validation.studentNumberRange', 'Student Number is required.'));
      isValid = false;
    } else if (!/^\d+$/.test(studentNumber)) {
      showFieldError('student-number', getMsg('validation.studentNumberRange', 'Student Number must contain digits only.'));
      isValid = false;
    } else if (studentNumber.length < 6 || studentNumber.length > 12) {
      showFieldError('student-number', getMsg('validation.studentNumberRange', 'Student Number must be between 6 and 12 digits.'));
      isValid = false;
    }

    if (!department) {
      showFieldError('department', getMsg('validation.selectDepartment', 'Please select your department.'));
      isValid = false;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      showFieldError('email', getMsg('validation.emailRequired', 'Email address is required.'));
      isValid = false;
    } else if (!emailPattern.test(email)) {
      showFieldError('email', getMsg('validation.emailInvalid', 'Please enter a valid email address.'));
      isValid = false;
    } else if (!isAllowedStudentEmail(email)) {
      showFieldError('email', getMsg('validation.emailNotInstitutional', `Please use your institutional student email (${ALLOWED_STUDENT_EMAIL_DOMAINS.join(', ')}).`));
      isValid = false;
    }

    if (!password) {
      showFieldError('password', getMsg('validation.passwordRequired', 'Password is required.'));
      isValid = false;
    } else if (password.length < 6) {
      showFieldError('password', getMsg('validation.passwordLength', 'Password must be at least 6 characters.'));
      isValid = false;
    }

    if (!confirmPassword) {
      showFieldError('confirm-password', getMsg('validation.confirmPasswordRequired', 'Confirm password is required.'));
      isValid = false;
    } else if (password !== confirmPassword) {
      showFieldError('confirm-password', getMsg('validation.passwordsMatch', 'Passwords do not match.'));
      isValid = false;
    }

    if (checkbox && !checkbox.checked) {
      showFieldError('legal-agree', getMsg('validation.legalAgree', 'You must agree to the Privacy Policy and Terms of Use.'));
      isValid = false;
    }

    // Stop if validation fails
    if (!isValid) return;

    // Set Loading state
    setButtonLoading(submitBtn, true, 'Creating Account...');

    try {
      // 1. Supabase Auth Signup passing metadata in options.data
      const avatarUrl = window.__registrationAvatarUrl || null;
      const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            student_number: studentNumber,
            department: department,
            full_name: fullName,
            avatar_url: avatarUrl
          }
        }
      });

      if (error) {
        showFormAlert(form, 'error', getFriendlyError(error.message));
        setButtonLoading(submitBtn, false);
        return;
      }

      if (!error) {
        window.location.href = "dashboard.html";
      }
    } catch (err) {
      console.error("Signup exception: ", err);
      showFormAlert(form, 'error', getMsg('validation.unexpectedError', 'An unexpected error occurred during signup. Please try again.'));
      setButtonLoading(submitBtn, false);
    }
  });
}

// ==========================================
// 5. Login Form Controller
//
// (Academic/teacher self-registration used to live here as
// initAcademicRegisterForm() + register-academic.html's form — removed now
// that hoca accounts arrive exclusively via Campuso SSO. See
// supabase/functions/campuso-sso and sso-callback.html.)
// ==========================================
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    clearFormErrors(form);

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = form.querySelector('button[type="submit"]');

    let isValid = true;

    if (!email) {
      showFieldError('email', getMsg('validation.emailRequired', 'Email address is required.'));
      isValid = false;
    }

    if (!password) {
      showFieldError('password', getMsg('validation.passwordRequired', 'Password is required.'));
      isValid = false;
    }

    if (!isValid) return;

    setButtonLoading(submitBtn, true, 'Logging In...');

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        showFormAlert(form, 'error', getFriendlyError(error.message));
        setButtonLoading(submitBtn, false);
        return;
      }

      if (data && data.session) {
        const destination = await getPostLoginDestination(data.session.user.id);

        // Maintenance mode: only admins are allowed through while it's on.
        // (site-status.js, loaded before this script, exposes the check.)
        if (destination !== 'admin.html' && typeof window.acadexGetSiteSettings === 'function') {
          try {
            const settings = await window.acadexGetSiteSettings();
            if (settings.maintenance && settings.maintenance.enabled) {
              await supabaseClient.auth.signOut();
              showFormAlert(form, 'error', settings.maintenance.message || getMsg('validation.maintenanceMode', 'Acadex is currently undergoing maintenance. Please check back soon.'));
              setButtonLoading(submitBtn, false);
              return;
            }
          } catch (maintErr) {
            console.error('Maintenance mode check failed, allowing login:', maintErr);
          }
        }

        const successMsg = getMsg('validation.loginSuccess', 'Login successful! Accessing portal...');
        showFormAlert(form, 'success', successMsg);
        setTimeout(() => {
          window.location.href = destination;
        }, 1200);
      }
    } catch (err) {
      console.error("Login exception: ", err);
      showFormAlert(form, 'error', getMsg('validation.unexpectedError', 'An unexpected error occurred during login. Please try again.'));
      setButtonLoading(submitBtn, false);
    }
  });
}

// ==========================================
// 5b. Forgot Password Controller
// ==========================================
function initForgotForm() {
  const loginView = document.getElementById('login-view');
  const forgotView = document.getElementById('forgot-view');
  const forgotLink = document.getElementById('forgot-password-link');
  const backToLogin = document.getElementById('back-to-login');
  const form = document.getElementById('forgot-form');

  if (forgotLink && loginView && forgotView) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginView.style.display = 'none';
      forgotView.style.display = 'block';
      clearFormErrors(form);
    });
  }

  if (backToLogin && loginView && forgotView) {
    backToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      forgotView.style.display = 'none';
      loginView.style.display = 'block';
      const loginForm = document.getElementById('login-form');
      if (loginForm) clearFormErrors(loginForm);
    });
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    clearFormErrors(form);

    const emailInput = document.getElementById('forgot-email');
    const email = emailInput ? emailInput.value.trim() : '';
    const submitBtn = form.querySelector('button[type="submit"]');

    let isValid = true;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      showFieldError('forgot-email', getMsg('validation.emailRequired', 'Email address is required.'));
      isValid = false;
    } else if (!emailPattern.test(email)) {
      showFieldError('forgot-email', getMsg('validation.emailInvalid', 'Please enter a valid email address.'));
      isValid = false;
    }

    if (!isValid) return;

    setButtonLoading(submitBtn, true, 'Sending Reset Link...');

    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password.html'
      });

      if (error) {
        showFormAlert(form, 'error', getFriendlyError(error.message));
        setButtonLoading(submitBtn, false);
        return;
      }

      showFormAlert(form, 'success', getMsg('validation.resetSent', 'If an account exists with that email, a password reset link has been sent. Check your inbox.'));
      setButtonLoading(submitBtn, false);
      if (emailInput) emailInput.value = '';
    } catch (err) {
      console.error("Forgot password exception: ", err);
      showFormAlert(form, 'error', getMsg('validation.unexpectedError', 'An unexpected error occurred. Please try again.'));
      setButtonLoading(submitBtn, false);
    }
  });
}

// ==========================================
// 6. Form helper utilities for UI responses
// ==========================================
function showFieldError(fieldId, errorMessage) {
  const input = document.getElementById(fieldId);
  if (!input) return;

  input.classList.add('error');
  input.setAttribute('aria-invalid', 'true');

  const formGroup = input.closest('.form-group');
  if (formGroup) {
    const errorEl = document.createElement('span');
    errorEl.className = 'form-error';
    errorEl.id = `${fieldId}-error`;
    errorEl.textContent = errorMessage;
    formGroup.appendChild(errorEl);
    input.setAttribute('aria-describedby', errorEl.id);
  }
}

function clearFormErrors(form) {
  // Clear any existing alert messages
  const existingAlert = form.querySelector('.alert');
  if (existingAlert) {
    existingAlert.remove();
  }

  // Clear individual field errors
  const errorInputs = form.querySelectorAll('.form-control.error');
  errorInputs.forEach(input => {
    input.classList.remove('error');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  });

  const errorMessages = form.querySelectorAll('.form-error');
  errorMessages.forEach(msg => msg.remove());
}

function showFormAlert(form, type, message) {
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.setAttribute('role', type === 'error' ? 'alert' : 'status');
    alertEl.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;">
        ${type === 'error' 
          ? '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>' 
          : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'}
      </svg>
      <span>${message}</span>
    `;
    form.insertBefore(alertEl, form.firstChild);
  }
}

function setButtonLoading(button, isLoading, text = '') {
  if (!button) return;

  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 18px; height: 18px; margin-right: 8px;">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" style="stroke-dasharray: 1, 150; stroke-dashoffset: 0; stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle>
      </svg>
      <span>${text}</span>
    `;
    button.style.cursor = 'not-allowed';
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
    }
    button.style.cursor = '';
  }
}

// Add CSS keyframes dynamically for the loading spinner
const style = document.createElement('style');
style.innerHTML = `
@keyframes rotate {
  100% { transform: rotate(360deg); }
}
@keyframes dash {
  0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
}
.spinner {
  display: inline-block;
  vertical-align: middle;
}
`;
document.head.appendChild(style);

// ==========================================
// REGISTRATION AVATAR BUILDER (Optional)
// ==========================================
(function initRegistrationAvatarBuilder() {
  const container = document.getElementById('reg-avatar-builder');
  if (!container) return;
  
  const STYLES = ['adventurer', 'avataaars', 'bottts', 'micah', 'personas'];
  const LABELS = { adventurer: 'Adventurer', avataaars: 'Avataaars', bottts: 'Bottts', micah: 'Micah', personas: 'Personas' };
  let regAvatarStyle = 'adventurer';
  let regAvatarSeed = 'new-student-' + Math.random().toString(36).substring(2, 8);
  let avatarSelected = false;
  
  function getDiceBearUrl(style, seed) {
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
  }
  
  const toggleBtn = document.getElementById('btn-toggle-reg-avatar');
  const builderPanel = document.getElementById('reg-avatar-panel');
  const previewEl = document.getElementById('reg-avatar-preview');
  const stylesContainer = document.getElementById('reg-avatar-styles');
  const skipBtn = document.getElementById('btn-skip-avatar');
  
  if (toggleBtn && builderPanel) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = builderPanel.style.display !== 'none';
      builderPanel.style.display = isOpen ? 'none' : 'block';
      toggleBtn.textContent = isOpen ? '\uD83C\uDFA8 Customize Avatar (Optional)' : '\u2715 Close Avatar Builder';
      if (!isOpen) {
        renderRegStyles();
        updateRegPreview();
      }
    });
  }
  
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      avatarSelected = false;
      window.__registrationAvatarUrl = null;
      if (builderPanel) builderPanel.style.display = 'none';
      if (toggleBtn) toggleBtn.textContent = '\uD83C\uDFA8 Customize Avatar (Optional)';
    });
  }
  
  const randomBtn = document.getElementById('btn-reg-avatar-random');
  if (randomBtn) {
    randomBtn.addEventListener('click', () => {
      regAvatarSeed = 'reg-' + Math.random().toString(36).substring(2, 10);
      updateRegPreview();
    });
  }
  
  const selectBtn = document.getElementById('btn-reg-avatar-select');
  if (selectBtn) {
    selectBtn.addEventListener('click', () => {
      avatarSelected = true;
      window.__registrationAvatarUrl = getDiceBearUrl(regAvatarStyle, regAvatarSeed);
      if (builderPanel) builderPanel.style.display = 'none';
      if (toggleBtn) {
        toggleBtn.innerHTML = '\u2705 Avatar Selected \u2014 <span style="text-decoration:underline;">Change</span>';
      }
    });
  }
  
  function renderRegStyles() {
    if (!stylesContainer) return;
    stylesContainer.innerHTML = '';
    STYLES.forEach(style => {
      const url = getDiceBearUrl(style, 'acadex-preview');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'avatar-style-btn' + (style === regAvatarStyle ? ' active' : '');
      btn.innerHTML = `<img src="${url}" alt="${style}" style="width:40px;height:40px;border-radius:50%;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>';">\n        <span style="font-size:0.6rem;font-weight:700;">${LABELS[style]}</span>`;
      btn.addEventListener('click', () => {
        regAvatarStyle = style;
        renderRegStyles();
        updateRegPreview();
      });
      stylesContainer.appendChild(btn);
    });
  }
  
  function updateRegPreview() {
    if (!previewEl) return;
    const url = getDiceBearUrl(regAvatarStyle, regAvatarSeed);
    previewEl.innerHTML = `<img src="${url}" alt="Preview" style="width:80px;height:80px;border-radius:50%;border:2px solid var(--color-teal);">`;
    // Auto-set the URL when preview changes
    window.__registrationAvatarUrl = getDiceBearUrl(regAvatarStyle, regAvatarSeed);
  }
})();
