const TRANSLATIONS = {
  en: {
    // Brand & Commons
    "brand.name": "ACADEX",
    "common.logout": "Log Out",
    "common.login": "Log In",
    "common.signup": "Sign Up",
    "common.home": "Home",
    "common.about": "About",
    "common.departments": "Departments",
    "common.howItWorks": "How It Works",
    "common.dashboard": "Student Dashboard",
    "common.privacy": "Privacy Policy",
    "common.terms": "Terms of Use",
    "common.changelog": "What's New",
    "common.send": "Send",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.error": "Error",
    "common.success": "Success",
    "common.loading": "Loading...",

    "landing.coordinator.name": "Şükrü Çerçi",
    "landing.coordinator.role": "Business Faculty Program Coordinator",

    // Landing Page (index.html)
    "landing.hero.title": "Elevate Your Academic Potential",
    "landing.hero.subtitle": "Business Faculty Pilot Program: Empowering students with AI study notebooks, automated summaries, flashcards, and practice exams.",
    "landing.hero.btnExplore": "Explore Portal",
    "landing.hero.btnRegister": "Register Now",
    "landing.trust.dataPrivate": "Your data stays private",
    "landing.trust.facultyProgram": "Official Faculty of Business Program",
    "landing.trust.departments": "4 Departments, One Platform",
    "landing.trust.deleteAnytime": "Delete your data anytime",
    "landing.contact.title": "Have a question?",
    "landing.contact.subtitle": "We'd love to help you. Reach out to our program coordinators directly.",
    "landing.contact.name": "Full Name",
    "landing.contact.email": "Email Address",
    "landing.contact.message": "Your Message",
    "landing.contact.success": "Thanks! We'll get back to you soon.",
    "landing.contact.validation": "All fields are required. Please check your inputs.",
    "landing.contact.validEmail": "Please enter a valid email address.",

    // Onboarding / Splash
    "splash.skip": "Skip Intro",
    "splash.slogan": "Study Smart, Exceed Limits. Reach Academic Heights with Acadex.",

    // Login Page (login.html)
    "login.title": "Welcome Back to Acadex",
    "login.subtitle": "Log in to access your study portal, documents, and flashcards.",
    "login.label.email": "Institutional Email",
    "login.label.password": "Password",
    "login.btn": "Log In",
    "login.forgotPassword": "Forgot your password?",
    "login.noAccount": "Don't have an account yet?",
    "login.registerLink": "Create an account",

    // Register Page (register.html)
    "register.title": "Join Acadex Portal",
    "register.subtitle": "Create your account to unlock advanced AI-driven study tools.",
    "register.label.fullName": "Full Name",
    "register.label.studentNumber": "Student Number",
    "register.label.department": "Department / Faculty Program",
    "register.label.selectDept": "Select your department",
    "register.label.password": "Password (Min. 6 characters)",
    "register.strength.label": "Password Strength",
    "register.strength.weak": "Weak",
    "register.strength.medium": "Medium",
    "register.strength.strong": "Strong",
    "register.alreadyRegistered": "This student number is already registered.",
    "register.loginPrompt": "Did you mean to log in instead?",
    "register.btn": "Create Account",
    "register.hasAccount": "Already have an account?",
    "register.loginLink": "Log in here",

    // Validation messages (Phase 16A)
    "validation.fullNameRequired": "Full Name is required.",
    "validation.studentNumberRange": "Student Number must be between 6 and 12 digits.",
    "validation.selectDepartment": "Please select your department.",
    "validation.emailRequired": "Email address is required.",
    "validation.emailInvalid": "Please enter a valid email address.",
    "validation.passwordRequired": "Password is required.",
    "validation.passwordLength": "Password must be at least 6 characters.",
    "validation.confirmPasswordRequired": "Confirm password is required.",
    "validation.passwordsMatch": "Passwords do not match.",
    "validation.legalAgree": "You must agree to the Privacy Policy and Terms of Use.",
    "validation.unexpectedError": "An unexpected error occurred. Please try again.",
    "validation.loginSuccess": "Login successful! Accessing portal...",
    "validation.resetSent": "If an account exists with that email, a password reset link has been sent. Check your inbox.",
    "validation.resetSuccess": "Password reset successful! Redirecting to login page...",

    // Reset Password Page (reset-password.html)
    "reset.title": "Reset Password",
    "reset.subtitle": "Enter your email to receive a password reset link.",
    "reset.label.email": "Your Email",
    "reset.btn": "Send Reset Link",
    "reset.backToLogin": "Back to Log In",

    // Legal / Privacy Page (legal.html)
    "legal.title": "Acadex Legal Information",
    "legal.subtitle": "Terms of Use and Privacy Policy guidelines.",

    // Dashboard Layout (dashboard.html)
    "dash.nav.home": "Overview",
    "dash.nav.planner": "Study Planner",
    "dash.nav.docs": "My Documents",
    "dash.nav.feed": "Department Feed",
    "dash.nav.notebook": "Study Notebook",
    "dash.nav.cards": "Study Cards",
    "dash.nav.exams": "Exams Platform",
    "dash.nav.sandbox": "Developer Sandbox",
    "dash.nav.settings": "Settings",
    "dash.search.placeholder": "Search actions, pages, cards...",

    // Dashboard Overview Tab
    "dash.overview.title": "Welcome back,",
    "dash.overview.subtitle": "Here's what is happening in your faculty program.",
    "dash.overview.stat.docs": "Uploaded Documents",
    "dash.overview.stat.cards": "AI Study Cards",
    "dash.overview.stat.exams": "Exams Taken",
    "dash.overview.stat.grade": "Average Grade",
    "dash.overview.recentActivity": "Recent Activity",
    "dash.overview.streak": "day streak!",
    "dash.overview.achievements.title": "My Achievements",

    // Study Planner Tab
    "dash.planner.title": "Study Planner",
    "dash.planner.desc": "Manage your academic calendar, track exam dates and study goals.",
    "dash.planner.addBtn": "+ Add Event",
    "dash.planner.thisWeek": "This Week",
    "dash.planner.later": "Later",

    // My Documents Tab
    "dash.docs.title": "My Study Documents",
    "dash.docs.upload.title": "Upload Study Material",
    "dash.docs.upload.dragText": "Drag and drop files here, or click to browse",
    "dash.docs.upload.subtext": "Supports PDF, Word, PowerPoint, TXT up to 20MB",
    "dash.docs.bulk.delete": "Delete Selected",
    "dash.docs.bulk.summarize": "Bulk Summarize",
    "dash.docs.bulk.cancel": "Cancel",
    "dash.docs.list.title": "My Library",

    // Department Feed Tab
    "dash.feed.title": "Department Study Feed",
    "dash.feed.subtitle": "Shared learning resources from fellow students in your program.",

    // Study Notebook Tab
    "dash.notebook.title": "Interactive Study Canvas",
    "dash.notebook.btn.save": "Save Notebook",
    "dash.notebook.btn.addText": "Add Text",
    "dash.notebook.btn.addTable": "Add Table",
    "dash.notebook.btn.clear": "Clear Canvas",
    "dash.notebook.sidebar.title": "Available Study Cards",
    "dash.notebook.sidebar.empty": "Generate study cards from documents to view them here.",

    // Study Cards Tab
    "dash.cards.title": "Generated Study Cards",
    "dash.cards.filter.style": "Filter Style",
    "dash.cards.filter.lang": "Filter Language",
    "dash.cards.btn.clear": "Clear Filters",

    // Exams Platform Tab
    "dash.exams.title": "Smart Exam Platform",
    "dash.exams.setup.title": "New Practice Exam Setup",
    "dash.exams.setup.cardSelect": "Select Study Card / Context",
    "dash.exams.setup.type": "Exam Style",
    "dash.exams.setup.count": "Number of Questions",
    "dash.exams.setup.btn": "Generate Exam",
    "dash.exams.pastAttempts": "Past Exam Attempts",

    // Developer Sandbox Tab
    "dash.sandbox.title": "Developer Sandbox Showcase",
    "dash.sandbox.subtitle": "Practice data analysis and share student-built projects here.",
    "dash.sandbox.btn.share": "Share a Project",

    // Settings Tab
    "dash.settings.title": "Account Settings",
    "dash.settings.profile.title": "Student Profile",
    "dash.settings.password.title": "Change Password",
    "dash.settings.delete.title": "Danger Zone",

    // Departments Details
    "dept.mis": "Management Information Systems",
    "dept.ba": "Business Administration",
    "dept.itb": "International Trade and Business",
    "dept.bf": "Banking and Finance",

    // Landing Blurbs
    "landing.dept.mis.blurb": "Perfect for future analysts and developers — sharpen your skills with the Developer Sandbox's sample datasets and share your own coding projects with the community.",
    "landing.dept.ba.blurb": "Turn dense business theory into clear, exam-ready summaries and test your understanding with AI-generated practice exams.",
    "landing.dept.itb.blurb": "Navigate complex global business concepts with structured outlines and simplified explanations tailored to how you like to study.",
    "landing.dept.bf.blurb": "Transform lecture slides and financial readings into concise study cards, and self-test with instantly graded practice exams.",
    "sandbox.guide.title": "Sandbox Developer Guide",
    "sandbox.guide.who": "Who is this for?",
    "sandbox.guide.whoText": "Designed for MIS students and programming enthusiasts across all 4 departments to practice coding, analytics, and software design.",
    "sandbox.guide.step1": "Sample Datasets:",
    "sandbox.guide.step1Text": "Download raw CSV structures below to run analyses in Jupyter, Python, Excel, or SQL.",
    "sandbox.guide.step2": "Share Your Projects:",
    "sandbox.guide.step2Text": "Publish links to your GitHub repositories or live apps so peers can check them out, view your source code, and run tests.",
    "sandbox.guide.step3": "Cross-Department Showcase:",
    "sandbox.guide.step3Text": "All shared projects are visible public-wide to inspire other students and promote learning collaboration!"
  },
  tr: {
    // Brand & Commons
    "brand.name": "ACADEX",
    "common.logout": "Çıkış Yap",
    "common.login": "Giriş Yap",
    "common.signup": "Kayıt Ol",
    "common.home": "Ana Sayfa",
    "common.about": "Hakkımızda",
    "common.departments": "Bölümler",
    "common.howItWorks": "Nasıl Çalışır?",
    "common.dashboard": "Öğrenci Paneli",
    "common.privacy": "Gizlilik Politikası",
    "common.terms": "Kullanım Şartları",
    "common.changelog": "Yenilikler",
    "common.send": "Gönder",
    "common.cancel": "İptal",
    "common.save": "Kaydet",
    "common.delete": "Sil",
    "common.error": "Hata",
    "common.success": "Başarılı",
    "common.loading": "Yükleniyor...",

    "landing.coordinator.name": "Şükrü Çerçi",
    "landing.coordinator.role": "İşletme Fakültesi Program Koordinatörü",

    // Landing Page (index.html)
    "landing.hero.title": "Akademik Potansiyelinizi Zirveye Taşıyın",
    "landing.hero.subtitle": "İşletme Fakültesi Pilot Programı: Öğrencileri yapay zeka destekli çalışma defterleri, otomatik özetler, bilgi kartları ve pratik sınavlarla güçlendirir.",
    "landing.hero.btnExplore": "Portalı Keşfet",
    "landing.hero.btnRegister": "Hemen Kaydol",
    "landing.trust.dataPrivate": "Verileriniz gizli kalır",
    "landing.trust.facultyProgram": "Resmi İşletme Fakültesi Pilot Programı",
    "landing.trust.departments": "4 Bölüm, Tek Platform",
    "landing.trust.deleteAnytime": "Verilerinizi dilediğiniz zaman silin",
    "landing.contact.title": "Bir sorunuz mu var?",
    "landing.contact.subtitle": "Size yardımcı olmaktan memnuniyet duyarız. Program koordinatörlerimize doğrudan ulaşın.",
    "landing.contact.name": "Adınız Soyadınız",
    "landing.contact.email": "E-posta Adresiniz",
    "landing.contact.message": "Mesajınız",
    "landing.contact.success": "Teşekkürler! En kısa sürede dönüş yapacağız.",
    "landing.contact.validation": "Tüm alanların doldurulması zorunludur. Lütfen bilgilerinizi kontrol edin.",
    "landing.contact.validEmail": "Lütfen geçerli bir e-posta adresi girin.",

    // Onboarding / Splash
    "splash.skip": "Girişi Geç",
    "splash.slogan": "Zekice Çalış, Sınırları Aş. Acadex ile Akademik Zirveye Ulaş.",

    // Login Page (login.html)
    "login.title": "Acadex'e Tekrar Hoş Geldiniz",
    "login.subtitle": "Çalışma portalınıza, belgelerinize ve bilgi kartlarınıza erişmek için giriş yapın.",
    "login.label.email": "Kurumsal E-posta",
    "login.label.password": "Şifre",
    "login.btn": "Giriş Yap",
    "login.forgotPassword": "Şifrenizi mi unuttunuz?",
    "login.noAccount": "Henüz bir hesabınız yok mu?",
    "login.registerLink": "Hesap oluşturun",

    // Register Page (register.html)
    "register.title": "Acadex Portalına Katılın",
    "register.subtitle": "Yapay zeka destekli çalışma araçlarını kullanmak için hesabınızı oluşturun.",
    "register.label.fullName": "Adınız Soyadınız",
    "register.label.studentNumber": "Öğrenci Numarası",
    "register.label.department": "Bölüm / Fakülte Programı",
    "register.label.selectDept": "Bölümünüzü seçin",
    "register.label.password": "Şifre (En az 6 karakter)",
    "register.strength.label": "Şifre Gücü",
    "register.strength.weak": "Zayıf",
    "register.strength.medium": "Orta",
    "register.strength.strong": "Güçlü",
    "register.alreadyRegistered": "Bu öğrenci numarası zaten kayıtlı.",
    "register.loginPrompt": "Bunun yerine giriş yapmak ister misiniz?",
    "register.btn": "Hesap Oluştur",
    "register.hasAccount": "Zaten bir hesabınız var mı?",
    "register.loginLink": "Buradan giriş yapın",

    // Validation messages (Phase 16A)
    "validation.fullNameRequired": "Ad Soyad alanı zorunludur.",
    "validation.studentNumberRange": "Öğrenci numarası 6 ile 12 basamak arasında olmalıdır.",
    "validation.selectDepartment": "Lütfen bölümünüzü seçin.",
    "validation.emailRequired": "E-posta adresi zorunludur.",
    "validation.emailInvalid": "Lütfen geçerli bir e-posta adresi girin.",
    "validation.passwordRequired": "Şifre zorunludur.",
    "validation.passwordLength": "Şifre en az 6 karakter olmalıdır.",
    "validation.confirmPasswordRequired": "Şifre onayı zorunludur.",
    "validation.passwordsMatch": "Şifreler uyuşmuyor.",
    "validation.legalAgree": "Gizlilik Politikası ve Kullanım Şartlarını kabul etmelisiniz.",
    "validation.unexpectedError": "Beklenmedik bir hata oluştu. Lütfen tekrar deneyin.",
    "validation.loginSuccess": "Giriş başarılı! Portala yönlendiriliyorsunuz...",
    "validation.resetSent": "Bu e-posta adresiyle kayıtlı bir hesap varsa, şifre sıfırlama bağlantısı gönderilmiştir. Gelen kutunuzu kontrol edin.",
    "validation.resetSuccess": "Şifre sıfırlama başarılı! Giriş sayfasına yönlendiriliyorsunuz...",

    // Reset Password Page (reset-password.html)
    "reset.title": "Şifreyi Sıfırla",
    "reset.subtitle": "Şifre sıfırlama bağlantısı almak için e-postanızı girin.",
    "reset.label.email": "E-posta Adresiniz",
    "reset.btn": "Sıfırlama Bağlantısı Gönder",
    "reset.backToLogin": "Giriş Sayfasına Dön",

    // Legal / Privacy Page (legal.html)
    "legal.title": "Acadex Yasal Bilgilendirme",
    "legal.subtitle": "Kullanım Şartları ve Gizlilik Politikası kuralları.",

    // Dashboard Layout (dashboard.html)
    "dash.nav.home": "Genel Bakış",
    "dash.nav.planner": "Çalışma Planlayıcı",
    "dash.nav.docs": "Belgelerim",
    "dash.nav.feed": "Bölüm Akışı",
    "dash.nav.notebook": "Çalışma Defteri",
    "dash.nav.cards": "Bilgi Kartları",
    "dash.nav.exams": "Sınav Platformu",
    "dash.nav.sandbox": "Geliştirici Sandbox",
    "dash.nav.settings": "Ayarlar",
    "dash.search.placeholder": "Eylemleri, sayfaları, kartları arayın...",

    // Dashboard Overview Tab
    "dash.overview.title": "Tekrar hoş geldin,",
    "dash.overview.subtitle": "Fakülte programında neler olup bittiğine göz at.",
    "dash.overview.stat.docs": "Yüklenen Belgeler",
    "dash.overview.stat.cards": "Yapay Zeka Kartları",
    "dash.overview.stat.exams": "Çözülen Sınavlar",
    "dash.overview.stat.grade": "Not Ortalaması",
    "dash.overview.recentActivity": "Son Etkinlikler",
    "dash.overview.streak": "günlük seri!",
    "dash.overview.achievements.title": "Rozetlerim",

    // Study Planner Tab
    "dash.planner.title": "Çalışma Planlayıcı",
    "dash.planner.desc": "Akademik takviminizi yönetin, sınav tarihlerinizi ve çalışma hedeflerinizi takip edin.",
    "dash.planner.addBtn": "+ Etkinlik Ekle",
    "dash.planner.thisWeek": "Bu Hafta",
    "dash.planner.later": "Daha Sonra",

    // My Documents Tab
    "dash.docs.title": "Çalışma Belgelerim",
    "dash.docs.upload.title": "Çalışma Materyali Yükle",
    "dash.docs.upload.dragText": "Dosyaları buraya sürükleyip bırakın veya göz atmak için tıklayın",
    "dash.docs.upload.subtext": "Maksimum 20MB boyutunda PDF, Word, PowerPoint, TXT destekler",
    "dash.docs.bulk.delete": "Seçilenleri Sil",
    "dash.docs.bulk.summarize": "Toplu Özetle",
    "dash.docs.bulk.cancel": "İptal Et",
    "dash.docs.list.title": "Kütüphanem",

    // Department Feed Tab
    "dash.feed.title": "Bölüm Çalışma Akışı",
    "dash.feed.subtitle": "Programınızdaki diğer öğrencilerden paylaşılan çalışma kaynakları.",

    // Study Notebook Tab
    "dash.notebook.title": "İnteraktif Çalışma Tahtası",
    "dash.notebook.btn.save": "Defteri Kaydet",
    "dash.notebook.btn.addText": "Metin Ekle",
    "dash.notebook.btn.addTable": "Tablo Ekle",
    "dash.notebook.btn.clear": "Tuvali Temizle",
    "dash.notebook.sidebar.title": "Mevcut Bilgi Kartları",
    "dash.notebook.sidebar.empty": "Bunları burada görmek için belgelerden bilgi kartları oluşturun.",

    // Study Cards Tab
    "dash.cards.title": "Oluşturulan Bilgi Kartları",
    "dash.cards.filter.style": "Stil Filtrele",
    "dash.cards.filter.lang": "Dil Filtrele",
    "dash.cards.btn.clear": "Filtreleri Temizle",

    // Exams Platform Tab
    "dash.exams.title": "Akıllı Sınav Platformu",
    "dash.exams.setup.title": "Yeni Deneme Sınavı Kurulumu",
    "dash.exams.setup.cardSelect": "Bilgi Kartı / Bağlam Seçin",
    "dash.exams.setup.type": "Sınav Tarzı",
    "dash.exams.setup.count": "Soru Sayısı",
    "dash.exams.setup.btn": "Sınav Oluştur",
    "dash.exams.pastAttempts": "Geçmiş Sınav Denemeleri",

    // Developer Sandbox Tab
    "dash.sandbox.title": "Geliştirici Sandbox Galerisi",
    "dash.sandbox.subtitle": "Veri analizi yapın ve öğrenci yapımı projeleri burada paylaşın.",
    "dash.sandbox.btn.share": "Proje Paylaş",

    // Settings Tab
    "dash.settings.title": "Hesap Ayarları",
    "dash.settings.profile.title": "Öğrenci Profili",
    "dash.settings.password.title": "Şifre Değiştir",
    "dash.settings.delete.title": "Tehlikeli Bölge",

    // Departments Details
    "dept.mis": "Yönetim Bilişim Sistemleri",
    "dept.ba": "İşletme",
    "dept.itb": "Uluslararası Ticaret ve İşletmecilik",
    "dept.bf": "Bankacılık ve Finans",

    // Landing Blurbs
    "landing.dept.mis.blurb": "Geleceğin analistleri ve geliştiricileri için mükemmel — Geliştirici Sandbox'ın örnek veri setleriyle becerilerinizi bileyin ve kendi kodlama projelerinizi toplulukla paylaşın.",
    "landing.dept.ba.blurb": "Yoğun işletme teorisini net, sınava hazır özetlere dönüştürün ve yapay zeka tarafından oluşturulan pratik sınavlarla anlayışınızı test edin.",
    "landing.dept.itb.blurb": "Nasıl çalışmayı seviyorsanız ona göre uyarlanmış yapılandırılmış ana hatlar ve basitleştirilmiş açıklamalarla karmaşık küresel iş kavramlarında gezinin.",
    "landing.dept.bf.blurb": "Ders slaytlarını ve finansal okumaları kısa çalışma kartlarına dönüştürün ve anında notlandırılan pratik sınavlarla kendinizi test edin.",
    "sandbox.guide.title": "Sandbox Kullanım Kılavuzu",
    "sandbox.guide.who": "Bu alan kimler için?",
    "sandbox.guide.whoText": "Tüm 4 bölümdeki Yönetim Bilişim Sistemleri (MIS) öğrencileri ve programlama meraklılarının kodlama, veri analizi ve yazılım tasarımı pratiği yapmaları için tasarlanmıştır.",
    "sandbox.guide.step1": "Örnek Veri Setleri:",
    "sandbox.guide.step1Text": "Jupyter, Python, Excel veya SQL'de analizler çalıştırmak için aşağıdaki ham CSV yapılarını indirin.",
    "sandbox.guide.step2": "Projelerinizi Paylaşın:",
    "sandbox.guide.step2Text": "Akranlarınızın incelemesi, kaynak kodlarınızı görmesi ve testler yapması için GitHub depolarınıza veya canlı uygulamalarınıza bağlantılar yayınlayın.",
    "sandbox.guide.step3": "Bölümler Arası Vitrin:",
    "sandbox.guide.step3Text": "Paylaşılan tüm projeler, diğer öğrencilere ilham vermek ve işbirliğini teşvik etmek için platform genelinde herkes tarafından görülebilir!"
  },
};

function translateDepartment(dept) {
  if (!dept) return '';
  const currentLang = localStorage.getItem('acadexUILang') || 'en';
  if (currentLang === 'tr') {
    if (dept === 'Management Information Systems') return 'Yönetim Bilişim Sistemleri';
    if (dept === 'Business Administration') return 'İşletme';
    if (dept === 'International Trade and Business') return 'Uluslararası Ticaret ve İşletmecilik';
    if (dept === 'Banking and Finance') return 'Bankacılık ve Finans';
  }
  return dept;
}

function applyLanguage(lang) {
  if (lang !== 'en' && lang !== 'tr') lang = 'en';
  localStorage.setItem('acadexUILang', lang);
  document.documentElement.setAttribute('lang', lang);
  
  const dict = TRANSLATIONS[lang];
  if (!dict) return;

  // Update text content for elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) {
      if (el.children.length === 0) {
        el.textContent = dict[key];
      } else {
        const textNode = Array.from(el.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        if (textNode) {
          textNode.textContent = dict[key];
        } else {
          el.textContent = dict[key];
        }
      }
    }
  });

  // Update input placeholder attribute
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key] !== undefined) {
      el.setAttribute('placeholder', dict[key]);
    }
  });

  // Update title/tooltips
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (dict[key] !== undefined) {
      el.setAttribute('title', dict[key]);
    }
  });

  // Keep switcher selection aligned visually
  const switchers = document.querySelectorAll('.lang-switcher-select');
  switchers.forEach(sw => {
    sw.value = lang;
  });

  // Dynamic user profile department updater hook
  const deptEl = document.getElementById('user-dept');
  if (deptEl && window.currentUserProfile) {
    const dept = window.currentUserProfile.department;
    const badgeClass = window.getDepartmentColorClass ? window.getDepartmentColorClass(dept) : '';
    const shortName = window.getDepartmentShortName ? window.getDepartmentShortName(dept) : '';
    const translatedDept = translateDepartment(dept);
    deptEl.innerHTML = `${translatedDept} <span class="dept-badge ${badgeClass}">${shortName}</span>`;
  }

  // Dynamic welcome subtitle updater hook
  const welcomeSub = document.getElementById('home-welcome-sub') || document.getElementById('welcome-sub');
  if (welcomeSub && window.currentUserProfile) {
    const dept = window.currentUserProfile.department;
    const translatedDept = translateDepartment(dept);
    if (lang === 'tr') {
      welcomeSub.textContent = `Acadex'e tekrar hoş geldiniz! ${translatedDept || 'bölümünüz'} için hazırlanan çalışma özeti burada.`;
    } else {
      welcomeSub.textContent = `Welcome back to Acadex! Here's your study summary for ${translatedDept || 'your department'}.`;
    }
  }

  // Trigger CSS transition fade-in for i18n targets
  document.documentElement.classList.add('i18n-loaded');
}

// Auto-run on DOMContentLoaded if loaded inside script tags
document.addEventListener('DOMContentLoaded', () => {
  const storedLang = localStorage.getItem('acadexUILang') || 'en';
  applyLanguage(storedLang);
});

// Bind to window for direct HTML page script tag accesses
window.applyLanguage = applyLanguage;
window.TRANSLATIONS = TRANSLATIONS;
window.translateDepartment = translateDepartment;
