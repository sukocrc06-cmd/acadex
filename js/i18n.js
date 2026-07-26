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
    "login.mode.student": "Student Login",
    "login.mode.academic": "Academic Login",
    "login.mode.academicTitle": "Faculty & Staff Login",
    "login.mode.academicSubtitle": "Access your teaching materials and admin tools.",
    "login.mode.redirectToStudent": "This account is a student account — redirecting you to your student dashboard...",
    "login.mode.redirectToAcademic": "This account has faculty access — redirecting you to your panel...",

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

    // Academic (Teacher) Registration Page (register-academic.html)
    "registerAcademic.title": "Academic / Faculty Sign Up",
    "registerAcademic.subtitle": "Apply for a faculty account. An admin reviews every request before teacher access is granted.",
    "registerAcademic.reviewNotice": "ℹ️ Your account will start as a regular account. An admin approves academic (teacher) access after reviewing your application.",
    "registerAcademic.label.title": "Academic Title / Role",
    "registerAcademic.label.titleHelper": "Optional — helps the admin reviewing your application.",
    "registerAcademic.btn": "Submit Application",
    "registerAcademic.pendingSuccess": "Application received! An admin will review it, and you'll be able to log in to the academic panel once approved.",
    "registerAcademic.navSignup": "Academic Sign Up",
    "registerAcademic.notAcademic": "Are you a student?",
    "registerAcademic.notAcademicShort": "New faculty member?",
    "registerAcademic.studentSignupLink": "Sign up here",
    "registerAcademic.notStudent": "Are you faculty?",
    "registerAcademic.academicSignupLink": "Apply for an academic account",

    // Validation messages
    "validation.fullNameRequired": "Full Name is required.",
    "validation.studentNumberRange": "Student Number must be between 6 and 12 digits.",
    "validation.selectDepartment": "Please select your department.",
    "validation.emailRequired": "Email address is required.",
    "validation.emailInvalid": "Please enter a valid email address.",
    "validation.emailNotInstitutional": "Please use your institutional student email address.",
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
    "dash.nav.home": "Ana Sayfa",
    "dash.nav.planner": "Study Planner",
    "dash.nav.docs": "My Documents",
    "dash.nav.feed": "Department Feed",
    "dash.nav.notebook": "Study Notebook",
    "dash.nav.cards": "Study Cards",
    "dash.nav.sourcehub": "Work with Source",
    "dash.nav.glossary": "Course Glossary",
    "dash.nav.courseTree": "Course Tree",
    "dash.nav.exams": "Exams Platform",
    "dash.nav.sandbox": "Developer Sandbox",
    "dash.nav.settings": "Settings",
    "dash.search.placeholder": "Search actions, pages, cards...",

    // Dashboard Overview Tab (Ana Sayfa)
    "dash.overview.title": "Welcome back,",
    "dash.overview.greeting": "Welcome back,",
    "dash.overview.welcomeSub": "Welcome back to Acadex! Here's your study summary.",
    "dash.overview.retakeTour": "Need a refresher? Retake the Tour",
    "dash.overview.streakSuffix": "day streak!",
    "dash.overview.stat.docs": "DOCUMENTS UPLOADED",
    "dash.overview.stat.cards": "STUDY CARDS CREATED",
    "dash.overview.stat.exams": "EXAMS TAKEN",
    "dash.overview.stat.grade": "AVERAGE GRADE",
    "dash.overview.quickActions": "Quick Actions",
    "dash.overview.recentActivity": "Recent Activity",
    "dash.overview.focusAreas": "Focus Areas",
    "dash.overview.focusAreasSub": "Concepts you should review next based on exam history.",
    "dash.overview.achievements.title": "My Achievements",
    "dash.overview.qa.upload": "Upload Document",
    "dash.overview.qa.exam": "Practice Exam",
    "dash.overview.noActivity": "No recent activity yet. Start by uploading a document!",

    // Study Planner Tab
    "dash.planner.title": "Study Planner",
    "dash.planner.desc": "Manage your academic calendar, track exam dates and study goals.",
    "dash.planner.enableReminders": "🔔 Enable Exam Reminders",
    "dash.planner.statusChecking": "Status: Checking...",
    "dash.planner.remindersHint": "* Reminders work while Acadex is open in your browser.",
    "dash.planner.addBtn": "+ Add Event",
    "dash.planner.exportIcal": "Export to Calendar",
    "dash.planner.listView": "List View",
    "dash.planner.calendarView": "Calendar View",
    "dash.planner.mon": "Mon",
    "dash.planner.tue": "Tue",
    "dash.planner.wed": "Wed",
    "dash.planner.thu": "Thu",
    "dash.planner.fri": "Fri",
    "dash.planner.sat": "Sat",
    "dash.planner.sun": "Sun",
    "dash.planner.thisWeek": "This Week",
    "dash.planner.later": "Later",
    "dash.planner.empty": "No events yet. Add your first exam date or study goal to get started!",

    // My Documents Tab
    "dash.docs.title": "My Documents",
    "dash.docs.desc": "Upload and manage academic files, slides, and syllabus documents.",
    "dash.docs.upload.title": "Upload Study Material",
    "dash.docs.upload.dragText": "Drag and drop your file here, or click to browse",
    "dash.docs.upload.subtext": "Supported formats: PDF, Word, PowerPoint, TXT — max 20MB",
    "dash.docs.bulk.selected": "selected",
    "dash.docs.bulk.merge": "🔀 Merge & Summarize",
    "dash.docs.bulk.compare": "⚖️ Compare Documents",
    "dash.docs.bulk.delete": "Delete Selected",
    "dash.docs.bulk.summarize": "Bulk Summarize",
    "dash.docs.bulk.cancel": "Cancel",
    "dash.docs.list.title": "My Library",
    "dash.summarize.modal.length": "Summary Length",
    "dash.summarize.modal.length.short": "Short (Quick Overview)",
    "dash.summarize.modal.length.medium": "Medium (Balanced)",
    "dash.summarize.modal.length.detailed": "Detailed (In-depth)",
    "dash.summarize.modal.length.hint": "Select how detailed your summary card should be.",

    // Department Feed Tab
    "dash.feed.title": "Department Feed",
    "dash.feed.subtitle": "Study cards shared by your classmates in your program.",
    "dash.feed.courseLabel": "Course:",
    "dash.feed.allCourses": "All Courses",

    // Study Notebook Tab
    "dash.notebook.title": "Digital Study Notebook",
    "dash.notebook.desc": "Create freehand drawings, drag cards as sticky notes, type texts, and construct tables.",
    "dash.notebook.screenNotice": "For the best experience, use a larger screen to access your drawing notebook.",
    "dash.notebook.sidebar.title": "Your Study Cards",
    "dash.notebook.searchPlaceholder": "Search cards...",
    "dash.notebook.btn.save": "Save Notebook",
    "dash.notebook.btn.addText": "Add Text",
    "dash.notebook.btn.addTable": "Add Table",
    "dash.notebook.btn.clear": "Clear Canvas",
    "dash.notebook.btn.clearDrawings": "Clear Drawings",
    "dash.notebook.btn.download": "Download Notebook",
    "dash.notebook.btn.depot": "📦 Info Depot",
    "dash.notebook.saveHint": "Remember to save your notebook before leaving this page.",
    "dash.notebook.allPages": "📑 All Pages",
    "dash.notebook.share": "👥 Share",
    "dash.notebook.sidebar.empty": "Generate study cards from documents to view them here.",

    // Study Cards Tab
    "dash.cards.title": "Study Cards Library",
    "dash.cards.desc": "Browse all your study cards, review details, share with classmates, or add to your notebook.",
    "dash.cards.searchPlaceholder": "Search study cards (filename or summary)...",
    "dash.cards.filter.style": "Filter Style",
    "dash.cards.filter.lang": "Filter Language",
    "dash.cards.btn.clear": "Clear Filters",
    "dash.cards.btn.exportAll": "Export All to PDF",
    "dash.cards.pastComparisons": "Past Document Comparisons",
    "dash.cards.quantitative": "🔢 Quantitative Course",
    "dash.cards.formulas": "Formulas",
    "dash.cards.examples": "Worked Examples",
    "dash.cards.viewOriginal": "📄 View Original",
    "dash.cards.singleView": "✕ Single View",
    "dash.cards.downloadOriginal": "⬇️ Download Original File",
    "dash.cards.cannotPreviewInline": "This file type (Word/PowerPoint) cannot be previewed directly in the browser.",
    "dash.cards.chatWithSource": "💬 Chat with Source",
    "dash.cards.closeChatView": "✕ Close Chat",
    "dash.cards.chatPanelTitle": "Chat with Source",
    "dash.cards.chatDisclosure": "Answers are grounded strictly in this document's content. If you ask something not covered in it, Acadex will tell you.",
    "dash.cards.chatImageAttached": "Image attached — type your question and send",
    "dash.cards.attachedImages": "Attached Images",

    // Kaynakla Çalış (Source Hub) — dedicated page: PDF + Summary + Chat side by side
    "dash.sourcehub.title": "🔎 Work with Source",
    "dash.sourcehub.desc": "Use the original document, the summary, and Chat with Source together on one screen.",
    "dash.sourcehub.selectLabel": "Study Card:",
    "dash.sourcehub.empty": "You don't have any study cards yet. Upload and summarize a document first.",
    "dash.sourcehub.originalHeader": "Original Document",
    "dash.sourcehub.summaryHeader": "Summary",
    "dash.sourcehub.openFullCard": "🔎 Open Full Card (Quiz, Tables, Charts...)",

    // Course Glossary Tab
    "dash.glossary.title": "📖 Course Glossary",
    "dash.glossary.desc": "Consolidated glossary of terms and definitions across your study cards grouped by course tag.",
    "dash.glossary.selectCourse": "Select Course Tag",
    "dash.glossary.allCourses": "All Courses",
    "dash.glossary.searchLabel": "Search Terms",
    "dash.glossary.searchPlaceholder": "Filter terms or definitions...",
    "dash.glossary.exportPdf": "📥 Export as PDF",
    "dash.glossary.emptyTitle": "No course-tagged study cards yet",
    "dash.glossary.emptyDesc": "Add a course tag to your study cards on Belgelerim or Bilgi Kartları to build a glossary.",
    "dash.glossary.alsoCoveredIn": "also covered in:",

    // Exams Platform Tab
    "dash.exams.title": "Exams Platform",
    "dash.exams.desc": "Create AI-powered exams from your study cards and test yourself.",
    "dash.exams.emptyTitle": "You must summarize a document first",
    "dash.exams.emptyText": "You need at least one summarized document to generate an exam.",
    "dash.exams.cardSelect": "Select Study Card",
    "dash.exams.typeTitle": "Exam Style",
    "dash.exams.typeClassic": "Classic Exam",
    "dash.exams.typeClassicSub": "All open-ended questions evaluated by AI.",
    "dash.exams.typeTest": "Multiple Choice (Test)",
    "dash.exams.typeTestSub": "4 options per question with one correct answer.",
    "dash.exams.typeMixed": "Mixed Exam",
    "dash.exams.typeMixedSub": "True/False and fill-in-the-blank questions.",
    "dash.exams.typeCalc": "Calculation Exam",
    "dash.exams.typeCalcSub": "Formula applications and numerical calculation problems.",
    "dash.exams.calcOnlyQuant": "* Calculation exam option is only available for Quantitative Courses.",
    "dash.exams.solutionSteps": "📋 Solution Steps",
    "dash.exams.difficultyTitle": "Difficulty Level",
    "dash.exams.diffEasy": "Easy",
    "dash.exams.diffEasySub": "Basic recall and definitions.",
    "dash.exams.diffMedium": "Medium",
    "dash.exams.diffMediumSub": "Balanced comprehension and application.",
    "dash.exams.diffHard": "Hard",
    "dash.exams.diffHardSub": "Analysis and scenario-based questions.",
    "dash.exams.langTitle": "Exam Language",
    "dash.exams.langHint": "* English is recommended since courses are taught in English.",
    "dash.exams.generateBtn": "Generate Exam",
    "dash.exams.pastAttempts": "Past Exam Attempts",
    "dash.exams.cancel": "Exit Exam",
    "dash.exams.submit": "Submit Exam",
    "dash.exams.resultsTitle": "Exam Result",
    "dash.exams.resultsDesc": "Exam results evaluated by AI.",
    "dash.exams.totalScore": "Total Score",
    "dash.exams.completed": "Exam Completed",
    "dash.exams.completedDesc": "Review detailed question analyses below.",
    "dash.exams.backToSetup": "Back to Exam Setup",

    // Developer Sandbox Tab
    "dash.sandbox.title": "Developer Sandbox",
    "dash.sandbox.subtitle": "Practice data analysis with sample datasets, or share your programming projects with the Acadex community.",
    "sandbox.guide.title": "Sandbox Developer Guide",
    "sandbox.guide.who": "Who is this for?",
    "sandbox.guide.whoText": "Designed for MIS students and programming enthusiasts across all 4 departments to practice coding, analytics, and software design.",
    "sandbox.guide.step1": "Sample Datasets:",
    "sandbox.guide.step1Text": "Download raw CSV structures below to run analyses in Jupyter, Python, Excel, or SQL.",
    "sandbox.guide.step2": "Share Your Projects:",
    "sandbox.guide.step2Text": "Publish links to your GitHub repositories or live apps so peers can check them out, view your source code, and run tests.",
    "sandbox.guide.step3": "Cross-Department Showcase:",
    "sandbox.guide.step3Text": "All shared projects are visible public-wide to inspire other students and promote learning collaboration!",
    "sandbox.datasetsTitle": "Sample Datasets",
    "sandbox.datasetsSub": "Practice your data analysis skills with these sample datasets.",
    "sandbox.galleryTitle": "Project Gallery",
    "sandbox.shareBtn": "Share New Project",

    // Settings Tab
    "dash.settings.title": "Settings",
    "dash.settings.desc": "Manage your profile, password, avatar, and account preferences.",
    "dash.settings.profileInfo": "Profile Information",
    "dash.settings.fullName": "Full Name",
    "dash.settings.studentNo": "Student Number",
    "dash.settings.email": "Email",
    "dash.settings.department": "Department",
    "dash.settings.deptHint": "* Changing your department affects which classmates can see your future shared study cards.",
    "dash.settings.save": "Save",
    "dash.settings.passwordTitle": "Change Password",
    "dash.settings.newPass": "New Password",
    "dash.settings.confirmPass": "New Password (Confirm)",
    "dash.settings.updatePass": "Update Password",
    "dash.settings.dangerTitle": "Danger Zone",
    "dash.settings.dangerDesc": "Deleting your account permanently removes your profile, documents, and cards.",
    "dash.settings.deleteBtn": "Delete Account",

    // Focus & Acadia
    "dash.focus.title": "Focus Mode",
    "dash.focus.start": "Start",
    "dash.focus.pause": "Pause",
    "dash.focus.reset": "Reset",
    "dash.focus.dim": "Dim Screen",
    "dash.focus.sound": "Sound",
    "dash.acadia.btn": "Ask Acadia",
    "dash.acadia.clear": "Clear",
    "dash.acadia.disclosure": "Acadia only views your account data and is AI-generated — not official advisor advice.",
    "dash.acadia.typing": "Acadia is typing...",
    "dash.acadia.placeholder": "Ask a question...",

    // Departments Details
    "dept.mis": "Management Information Systems",
    "dept.ba": "Business Administration",
    "dept.itb": "International Trade and Business",
    "dept.bf": "Banking and Finance"
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
    "login.mode.student": "Öğrenci Girişi",
    "login.mode.academic": "Akademisyen Girişi",
    "login.mode.academicTitle": "Akademisyen & Personel Girişi",
    "login.mode.academicSubtitle": "Ders materyallerinize ve yönetim panelinize erişin.",
    "login.mode.redirectToStudent": "Bu bir öğrenci hesabı — öğrenci panelinize yönlendiriliyorsunuz...",
    "login.mode.redirectToAcademic": "Bu hesabın akademisyen erişimi var — panelinize yönlendiriliyorsunuz...",

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

    // Akademisyen (Hoca) Kayıt Sayfası (register-academic.html)
    "registerAcademic.title": "Akademisyen / Hoca Kaydı",
    "registerAcademic.subtitle": "Akademisyen hesabı için başvurun. Hoca yetkisi verilmeden önce her başvuru admin tarafından incelenir.",
    "registerAcademic.reviewNotice": "ℹ️ Hesabınız önce normal bir hesap olarak başlar. Başvurunuz incelendikten sonra admin, akademisyen (hoca) erişimini onaylar.",
    "registerAcademic.label.title": "Akademik Unvan / Görev",
    "registerAcademic.label.titleHelper": "İsteğe bağlı — başvurunuzu inceleyen admine yardımcı olur.",
    "registerAcademic.btn": "Başvuruyu Gönder",
    "registerAcademic.pendingSuccess": "Başvurunuz alındı! Admin inceledikten sonra onaylanırsa akademisyen paneline giriş yapabileceksiniz.",
    "registerAcademic.navSignup": "Akademisyen Kaydı",
    "registerAcademic.notAcademic": "Öğrenci misiniz?",
    "registerAcademic.notAcademicShort": "Yeni bir akademisyen misiniz?",
    "registerAcademic.studentSignupLink": "Buradan kayıt olun",
    "registerAcademic.notStudent": "Akademisyen misiniz?",
    "registerAcademic.academicSignupLink": "Akademisyen hesabı için başvurun",

    // Validation messages
    "validation.fullNameRequired": "Ad Soyad alanı zorunludur.",
    "validation.studentNumberRange": "Öğrenci numarası 6 ile 12 basamak arasında olmalıdır.",
    "validation.selectDepartment": "Lütfen bölümünüzü seçin.",
    "validation.emailRequired": "E-posta adresi zorunludur.",
    "validation.emailInvalid": "Lütfen geçerli bir e-posta adresi girin.",
    "validation.emailNotInstitutional": "Lütfen kurumsal öğrenci e-posta adresinizi kullanın.",
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
    "dash.nav.home": "Ana Sayfa",
    "dash.nav.planner": "Çalışma Planlayıcı",
    "dash.nav.docs": "Belgelerim",
    "dash.nav.feed": "Bölüm Akışı",
    "dash.nav.notebook": "Çalışma Defteri",
    "dash.nav.cards": "Bilgi Kartları",
    "dash.nav.sourcehub": "Kaynakla Çalış",
    "dash.nav.glossary": "Ders Sözlüğü",
    "dash.nav.courseTree": "Ders Ağacı",
    "dash.nav.exams": "Sınav Platformu",
    "dash.nav.sandbox": "Geliştirici Sandbox",
    "dash.nav.settings": "Ayarlar",
    "dash.search.placeholder": "Eylemleri, sayfaları, kartları arayın...",

    // Dashboard Overview Tab (Ana Sayfa)
    "dash.overview.title": "Tekrar hoş geldin,",
    "dash.overview.greeting": "Tekrar hoş geldin,",
    "dash.overview.welcomeSub": "Acadex'e tekrar hoş geldin! İşte çalışma özetin.",
    "dash.overview.retakeTour": "Bilgi tazelemeye mi ihtiyacın var? Turu Tekrar Başlat",
    "dash.overview.streakSuffix": "günlük seri!",
    "dash.overview.stat.docs": "YÜKLENEN BELGELER",
    "dash.overview.stat.cards": "OLUŞTURULAN ÇALIŞMA KARTLARI",
    "dash.overview.stat.exams": "GİRİLEN SINAVLAR",
    "dash.overview.stat.grade": "ORTALAMA NOT",
    "dash.overview.quickActions": "Hızlı İşlemler",
    "dash.overview.recentActivity": "Son Aktiviteler",
    "dash.overview.focusAreas": "Zayıf Olduğunuz Konular",
    "dash.overview.focusAreasSub": "Geçmiş sınavlarınızdaki performansa göre en çok tekrar etmeniz gereken konular.",
    "dash.overview.achievements.title": "Rozetlerim",
    "dash.overview.qa.upload": "Belge Yükle",
    "dash.overview.qa.exam": "Deneme Sınavı",
    "dash.overview.noActivity": "Henüz son aktivite yok. Bir belge yükleyerek başlayın!",

    // Study Planner Tab
    "dash.planner.title": "Çalışma Planlayıcı",
    "dash.planner.desc": "Akademik takviminizi yönetin, sınav tarihlerinizi ve çalışma hedeflerinizi takip edin.",
    "dash.planner.enableReminders": "🔔 Sınav Hatırlatıcılarını Aç",
    "dash.planner.statusChecking": "Durum: Kontrol ediliyor...",
    "dash.planner.remindersHint": "* Hatırlatıcılar Acadex tarayıcınızda açıkken çalışır.",
    "dash.planner.addBtn": "+ Etkinlik Ekle",
    "dash.planner.exportIcal": "Takvime Aktar",
    "dash.planner.listView": "Liste Görünümü",
    "dash.planner.calendarView": "Takvim Görünümü",
    "dash.planner.mon": "Pzt",
    "dash.planner.tue": "Sal",
    "dash.planner.wed": "Çar",
    "dash.planner.thu": "Per",
    "dash.planner.fri": "Cum",
    "dash.planner.sat": "Cmt",
    "dash.planner.sun": "Paz",
    "dash.planner.thisWeek": "Bu Hafta",
    "dash.planner.later": "Daha Sonra",
    "dash.planner.empty": "Henüz etkinlik yok. Başlamak için ilk sınav tarihinizi veya çalışma hedefinizi ekleyin!",

    // My Documents Tab
    "dash.docs.title": "Belgelerim",
    "dash.docs.desc": "Akademik dosyaları, slaytları ve müfredat belgelerini yükleyin ve yönetin.",
    "dash.docs.upload.title": "Çalışma Materyali Yükle",
    "dash.docs.upload.dragText": "Dosyaları buraya sürükleyip bırakın veya göz atmak için tıklayın",
    "dash.docs.upload.subtext": "Maksimum 20MB boyutunda PDF, Word, PowerPoint, TXT destekler",
    "dash.docs.bulk.selected": "seçildi",
    "dash.docs.bulk.merge": "🔀 Birleştir ve Özetle",
    "dash.docs.bulk.compare": "⚖️ Belgeleri Karşılaştır",
    "dash.docs.bulk.delete": "Seçilenleri Sil",
    "dash.docs.bulk.summarize": "Toplu Özetle",
    "dash.docs.bulk.cancel": "İptal Et",
    "dash.docs.list.title": "Kütüphanem",
    "dash.summarize.modal.length": "Özet Uzunluğu",
    "dash.summarize.modal.length.short": "Kısa (Hızlı Genel Bakış)",
    "dash.summarize.modal.length.medium": "Orta (Dengeli)",
    "dash.summarize.modal.length.detailed": "Detaylı (Kapsamlı)",
    "dash.summarize.modal.length.hint": "Özet kartınızın ne kadar detaylı olacağını seçin.",

    // Department Feed Tab
    "dash.feed.title": "Bölüm Akışı",
    "dash.feed.subtitle": "Programınızdaki diğer öğrencilerden paylaşılan çalışma kaynakları.",
    "dash.feed.courseLabel": "Ders:",
    "dash.feed.allCourses": "Tüm Dersler",

    // Study Notebook Tab
    "dash.notebook.title": "Çalışma Defteri",
    "dash.notebook.desc": "Çizimler yapın, kartları yapışkan not olarak sürükleyin, metinler yazın ve tablolar oluşturun.",
    "dash.notebook.screenNotice": "En iyi deneyim için çizim defterinize daha büyük bir ekrandan erişin.",
    "dash.notebook.sidebar.title": "Mevcut Bilgi Kartları",
    "dash.notebook.searchPlaceholder": "Kartlarda ara...",
    "dash.notebook.btn.save": "Defteri Kaydet",
    "dash.notebook.btn.addText": "Metin Ekle",
    "dash.notebook.btn.addTable": "Tablo Ekle",
    "dash.notebook.btn.clear": "Tuvali Temizle",
    "dash.notebook.btn.clearDrawings": "Çizimleri Temizle",
    "dash.notebook.btn.download": "Defteri İndir",
    "dash.notebook.btn.depot": "📦 Bilgi Deposu",
    "dash.notebook.saveHint": "Bu sayfadan ayrılmadan önce defterinizi kaydetmeyi unutmayın.",
    "dash.notebook.allPages": "📑 Tüm Sayfalar",
    "dash.notebook.share": "👥 Paylaş",
    "dash.notebook.sidebar.empty": "Bunları burada görmek için belgelerden bilgi kartları oluşturun.",

    // Study Cards Tab
    "dash.cards.title": "Bilgi Kartları Kütüphanesi",
    "dash.cards.desc": "Tüm bilgi kartlarınızı inceleyin, arkadaşlarınızla paylaşın veya çalışma defterinize ekleyin.",
    "dash.cards.searchPlaceholder": "Kartlarda ara (dosya adı veya özet)...",
    "dash.cards.filter.style": "Stil Filtrele",
    "dash.cards.filter.lang": "Dil Filtrele",
    "dash.cards.btn.clear": "Filtreleri Temizle",
    "dash.cards.btn.exportAll": "Hepsini PDF Yap",
    "dash.cards.pastComparisons": "Geçmiş Belge Karşılaştırmaları",
    "dash.cards.quantitative": "🔢 Sayısal Ders",
    "dash.cards.formulas": "Formüller",
    "dash.cards.examples": "Çözümlü Örnekler",
    "dash.cards.viewOriginal": "📄 Orijinali Görüntüle",
    "dash.cards.singleView": "✕ Tekli Görünüm",
    "dash.cards.downloadOriginal": "⬇️ Orijinal Dosyayı İndir",
    "dash.cards.cannotPreviewInline": "Bu dosya türü (Word/PowerPoint) tarayıcıda doğrudan önizlenemiyor.",
    "dash.cards.chatWithSource": "💬 Kaynakla Sohbet Et",
    "dash.cards.closeChatView": "✕ Sohbeti Kapat",
    "dash.cards.chatPanelTitle": "Kaynakla Sohbet",
    "dash.cards.chatDisclosure": "Cevaplar yalnızca bu belgenin içeriğine dayanır. Belgede olmayan bir şey sorarsanız Acadex bunu size söyler.",
    "dash.cards.chatImageAttached": "Görsel eklendi — sorunuzu yazıp gönderin",
    "dash.cards.attachedImages": "Eklenen Görseller",

    // Kaynakla Çalış (Source Hub) — PDF + Özet + Sohbet tek sayfada yan yana
    "dash.sourcehub.title": "🔎 Kaynakla Çalış",
    "dash.sourcehub.desc": "Orijinal belgeyi, özeti ve kaynakla sohbeti aynı ekranda birlikte kullanın.",
    "dash.sourcehub.selectLabel": "Bilgi Kartı:",
    "dash.sourcehub.empty": "Henüz bir bilgi kartınız yok. Önce bir belge yükleyip özetleyin.",
    "dash.sourcehub.originalHeader": "Orijinal Belge",
    "dash.sourcehub.summaryHeader": "Özet",
    "dash.sourcehub.openFullCard": "🔎 Tam Kartı Aç (Quiz, Tablolar, Grafikler...)",

    // Course Glossary Tab
    "dash.glossary.title": "📖 Ders Sözlüğü",
    "dash.glossary.desc": "Çalışma kartlarınızdaki ders kodlarına göre derlenmiş terimler ve tanımları sözlüğü.",
    "dash.glossary.selectCourse": "Ders Kodu Seçin",
    "dash.glossary.allCourses": "Tüm Dersler",
    "dash.glossary.searchLabel": "Terimlerde Ara",
    "dash.glossary.searchPlaceholder": "Terim veya tanım filtrele...",
    "dash.glossary.exportPdf": "📥 PDF Olarak Aktar",
    "dash.glossary.emptyTitle": "Henüz ders kodlu çalışma kartı bulunmuyor",
    "dash.glossary.emptyDesc": "Ders sözlüğü oluşturmak için Belgelerim veya Bilgi Kartları sayfasında kartlarınıza ders kodu ekleyin.",
    "dash.glossary.alsoCoveredIn": "ayrıca şurada da geçiyor:",

    // Exams Platform Tab
    "dash.exams.title": "Sınav Platformu",
    "dash.exams.desc": "Çalışma kartlarınızdan yapay zeka destekli sınavlar oluşturun, kendinizi test edin.",
    "dash.exams.emptyTitle": "Öncelikle bir belge özetlemelisiniz",
    "dash.exams.emptyText": "Sınav oluşturmak için en az bir adet özetlenmiş belgenizin olması gerekir.",
    "dash.exams.cardSelect": "Çalışma Kartı Seçin",
    "dash.exams.typeTitle": "Sınav Türü",
    "dash.exams.typeClassic": "Klasik Sınav",
    "dash.exams.typeClassicSub": "Tüm sorular açık uçludur. Yapay zeka tarafından değerlendirilir.",
    "dash.exams.typeTest": "Çoktan Seçmeli (Test)",
    "dash.exams.typeTestSub": "Tüm sorular 4 şıklı test formatındadır. Tek bir doğru cevap vardır.",
    "dash.exams.typeMixed": "Karışık Sınav",
    "dash.exams.typeMixedSub": "Doğru/Yanlış ve Boşluk Doldurma sorularından oluşan karışık test.",
    "dash.exams.typeCalc": "Hesaplama Sınavı",
    "dash.exams.typeCalcSub": "Formül uygulaması ve sayısal işlem bazlı hesaplama soruları.",
    "dash.exams.calcOnlyQuant": "* Hesaplama sınavı seçeneği sadece Sayısal Dersler için kullanılabilir.",
    "dash.exams.solutionSteps": "📋 Çözüm Adımları",
    "dash.exams.difficultyTitle": "Zorluk Seviyesi",
    "dash.exams.diffEasy": "Kolay",
    "dash.exams.diffEasySub": "Temel hatırlama ve tanımlar. Konuya yeni başlarken idealdir.",
    "dash.exams.diffMedium": "Orta",
    "dash.exams.diffMediumSub": "Kavrama ve uygulama düzeyinde, sınava hazırlık için dengeli.",
    "dash.exams.diffHard": "Zor",
    "dash.exams.diffHardSub": "Analiz ve senaryo bazlı sorular. İleri düzey tekrar için.",
    "dash.exams.langTitle": "Sınav Dili",
    "dash.exams.langHint": "* Dersler İngilizce işlendiği için İngilizce önerilir.",
    "dash.exams.generateBtn": "Sınavı Oluştur",
    "dash.exams.pastAttempts": "Geçmiş Sınav Denemeleri",
    "dash.exams.cancel": "Sınavdan Çık",
    "dash.exams.submit": "Sınavı Tamamla ve Gönder",
    "dash.exams.resultsTitle": "Sınav Sonucu",
    "dash.exams.resultsDesc": "Yapay zeka tarafından değerlendirilen sınav sonuçlarınız.",
    "dash.exams.totalScore": "Toplam Puan",
    "dash.exams.completed": "Sınav Tamamlandı",
    "dash.exams.completedDesc": "Aşağıdan detaylı soru analizlerini inceleyebilirsiniz.",
    "dash.exams.backToSetup": "Sınav Kütüphanesine Dön",

    // Developer Sandbox Tab
    "dash.sandbox.title": "Geliştirici Sandbox",
    "dash.sandbox.subtitle": "Örnek veri setleriyle veri analizi yapın veya programlama projelerinizi Acadex topluluğuyla paylaşın.",
    "sandbox.guide.title": "Sandbox Developer Kılavuzu",
    "sandbox.guide.who": "Bu alan kimler için?",
    "sandbox.guide.whoText": "Tüm 4 bölümdeki Yönetim Bilişim Sistemleri (MIS) öğrencileri ve programlama meraklılarının kodlama, veri analizi ve yazılım tasarımı pratiği yapmaları için tasarlanmıştır.",
    "sandbox.guide.step1": "Örnek Veri Setleri:",
    "sandbox.guide.step1Text": "Jupyter, Python, Excel veya SQL'de analizler çalıştırmak için aşağıdaki ham CSV yapılarını indirin.",
    "sandbox.guide.step2": "Projelerinizi Paylaşın:",
    "sandbox.guide.step2Text": "Akranlarınızın incelemesi, kaynak kodlarınızı görmesi ve testler yapması için GitHub depolarınıza veya canlı uygulamalarınıza bağlantılar yayınlayın.",
    "sandbox.guide.step3": "Bölümler Arası Vitrin:",
    "sandbox.guide.step3Text": "Paylaşılan tüm projeler, diğer öğrencilere ilham vermek ve işbirliğini teşvik etmek için platform genelinde herkes tarafından görülebilir!",
    "sandbox.datasetsTitle": "Örnek Veri Setleri",
    "sandbox.datasetsSub": "Bu örnek veri setleriyle veri analizi becerilerinizi geliştirin.",
    "sandbox.galleryTitle": "Proje Galerisi",
    "sandbox.shareBtn": "Yeni Proje Paylaş",

    // Settings Tab
    "dash.settings.title": "Ayarlar",
    "dash.settings.desc": "Hesap ayarlarınızı, şifrenizi ve kişisel tercihlerinizi yönetin.",
    "dash.settings.profileInfo": "Profil Bilgileri",
    "dash.settings.fullName": "Ad Soyad",
    "dash.settings.studentNo": "Öğrenci Numarası",
    "dash.settings.email": "E-posta",
    "dash.settings.department": "Bölüm",
    "dash.settings.deptHint": "* Bölümünüzü değiştirmek gelecekteki kart paylaşımlarınızı etkiler.",
    "dash.settings.save": "Kaydet",
    "dash.settings.passwordTitle": "Şifre Değiştir",
    "dash.settings.newPass": "Yeni Şifre",
    "dash.settings.confirmPass": "Yeni Şifre (Tekrar)",
    "dash.settings.updatePass": "Şifreyi Güncelle",
    "dash.settings.dangerTitle": "Danger Zone (Tehlikeli Bölge)",
    "dash.settings.dangerDesc": "Hesabınızı sildiğinizde profiliniz, belgeleriniz ve kartlarınız kalıcı olarak kaldırılacaktır.",
    "dash.settings.deleteBtn": "Hesabımı Sil",

    // Focus & Acadia
    "dash.focus.title": "Odaklanma Modu",
    "dash.focus.start": "Başlat",
    "dash.focus.pause": "Duraklat",
    "dash.focus.reset": "Sıfırla",
    "dash.focus.dim": "Ekranı Karart",
    "dash.focus.sound": "Ses",
    "dash.acadia.btn": "Acadia'ya Sorun",
    "dash.acadia.clear": "Temizle",
    "dash.acadia.disclosure": "Acadia yalnızca hesap verilerinizi görür ve AI tarafından üretilir — resmi danışman görüşü yerine geçmez.",
    "dash.acadia.typing": "Acadia yazıyor...",
    "dash.acadia.placeholder": "Bir soru sorun...",

    // Departments Details
    "dept.mis": "Yönetim Bilişim Sistemleri",
    "dept.ba": "İşletme",
    "dept.itb": "Uluslararası Ticaret ve İşletmecilik",
    "dept.bf": "Bankacılık ve Finans"
  }
};

function translateDepartment(dept) {
  if (!dept) return '';
  const currentLang = localStorage.getItem('acadexUILang') || 'tr';
  if (currentLang === 'tr') {
    if (dept === 'Management Information Systems') return 'Yönetim Bilişim Sistemleri';
    if (dept === 'Business Administration') return 'İşletme';
    if (dept === 'International Trade and Business') return 'Uluslararası Ticaret ve İşletmecilik';
    if (dept === 'Banking and Finance') return 'Bankacılık ve Finans';
  }
  return dept;
}

/**
 * Looks up a single translation key for the currently active UI language.
 * Several dashboard.js call sites (course tag / original-document-viewer /
 * glossary UI) call this expecting it to exist, but it was never actually
 * defined here — every call threw "getTranslation is not defined" and
 * aborted whatever click handler invoked it (e.g. the original-document
 * viewer button, which crashed before it ever rendered its loading state,
 * leaving a blank pane). All call sites already guard with `|| 'fallback text'`,
 * so a missing/undefined key degrades gracefully to that fallback.
 */
function getTranslation(key) {
  const lang = localStorage.getItem('acadexUILang') || 'tr';
  const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  return dict ? dict[key] : undefined;
}
window.getTranslation = getTranslation;

function applyLanguage(lang) {
  lang = lang || localStorage.getItem('acadexUILang') || 'tr';
  localStorage.setItem('acadexUILang', lang);

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

  // Dynamic welcome title & subtitle updater hooks
  const isTr = lang === 'tr';
  const greetingEl = document.getElementById('home-welcome-greeting');
  if (greetingEl && window.currentUserProfile) {
    const displayName = window.currentUserProfile.full_name || (window.currentUser?.email ? window.currentUser.email.split('@')[0] : '');
    const firstName = displayName.split(' ')[0] || '';
    greetingEl.textContent = isTr ? `Tekrar hoş geldin, ${firstName}!` : `Welcome back, ${firstName}!`;
  }

  const welcomeSub = document.getElementById('home-welcome-sub') || document.getElementById('welcome-sub');
  if (welcomeSub) {
    welcomeSub.textContent = isTr ? "Acadex'e tekrar hoş geldin! İşte çalışma özetin." : "Welcome back to Acadex! Here's your study summary.";
  }

  const streakEl = document.getElementById('home-streak-display');
  if (streakEl && window.currentUserProfile) {
    const streak = window.currentUserProfile.current_streak || 0;
    streakEl.textContent = isTr ? `🔥 ${streak} günlük seri!` : `🔥 ${streak} day streak!`;
  }

  // Trigger recent activity re-render if loaded. Guarded on window.currentUser
  // because applyLanguage() also runs immediately on this script's own
  // DOMContentLoaded listener — which, on dashboard.html, fires BEFORE
  // dashboard.js's checkSessionAndLoadProfile() has set currentUser. Without
  // this guard, that very first call reached `.eq('user_id', currentUser.id)`
  // on a null currentUser and threw ("Cannot read properties of null
  // (reading 'id')"), logged from loadRecentActivity's catch block on every
  // page load. Later calls (actual language switches) already have
  // window.currentUser set by then, so this only skips the harmless/invalid
  // very-first call.
  if (typeof window.loadRecentActivity === 'function' && window.currentUser) {
    window.loadRecentActivity();
  }

  // Trigger CSS transition fade-in for i18n targets
  document.documentElement.classList.add('i18n-loaded');
}

// Auto-run on DOMContentLoaded if loaded inside script tags
document.addEventListener('DOMContentLoaded', () => {
  const storedLang = localStorage.getItem('acadexUILang') || 'tr';
  applyLanguage(storedLang);
});

// Bind to window for direct HTML page script tag accesses
window.applyLanguage = applyLanguage;
window.TRANSLATIONS = TRANSLATIONS;
window.translateDepartment = translateDepartment;
