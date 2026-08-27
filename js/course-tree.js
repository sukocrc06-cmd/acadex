// ==========================================================================
// Acadex — "Ders Ağacı" (Course Tree) browsing page
//
// Reads the official course catalog (public.departments / public.courses,
// seeded via supabase/migrations/20260721_add_course_catalog.sql) and lets
// students browse it department → class year → course, showing how many
// shared study cards already exist for each course (study_cards.is_shared +
// study_cards.department + course_tag matched against the course's official
// code). Courses with zero cards get a visible "no summary yet" state so
// gaps in the shared library are obvious at a glance.
//
// This page is read-only and additive: it does not modify course_tag,
// documents, or study_cards in any way.
// ==========================================================================

let ctDepartments = [];
let ctActiveDeptCode = null;

function ctShowAlert(type, message) {
  const container = document.getElementById('ct-alert-container');
  if (!container) return;
  const colors = {
    error: { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.25)', text: '#DC2626' },
    info: { bg: 'rgba(31,138,147,0.08)', border: 'rgba(31,138,147,0.25)', text: 'var(--color-teal)' }
  };
  const c = colors[type] || colors.info;
  container.innerHTML = `<div style="background:${c.bg}; border:1px solid ${c.border}; color:${c.text}; padding:0.75rem 1rem; border-radius: var(--radius-sm); font-size:0.85rem; margin-bottom:1rem;">${message}</div>`;
}

async function ctInit() {
  const profile = window.__acadexProfile;

  try {
    const { data: departments, error: deptErr } = await supabaseClient
      .from('departments')
      .select('code, name, name_tr')
      .order('name');

    if (deptErr || !departments || departments.length === 0) {
      document.getElementById('ct-dept-picker').innerHTML =
        `<div style="padding: 1rem; color: rgba(255,255,255,0.6); font-size: 0.8rem;">Ders kataloğu henüz yüklenmemiş.</div>`;
      document.getElementById('ct-tree-container').innerHTML =
        `<div class="ct-panel-card">Ders kataloğu tabloları (departments / courses) henüz bu Supabase projesinde oluşturulmamış görünüyor. supabase/migrations/20260721_add_course_catalog.sql dosyasını çalıştırdıktan sonra bu sayfa otomatik doldurulacaktır.</div>`;
      return;
    }

    ctDepartments = departments;

    // Default to the viewing student's own department if it matches a known one
    let defaultCode = departments[0].code;
    if (profile && profile.department) {
      const own = departments.find(d => d.name === profile.department);
      if (own) defaultCode = own.code;
    }

    renderDeptPicker(defaultCode);
    await ctLoadDepartment(defaultCode);
  } catch (err) {
    console.error('Ders Ağacı init error:', err);
    ctShowAlert('error', 'Ders ağacı yüklenirken bir hata oluştu.');
  }
}

function renderDeptPicker(activeCode) {
  const picker = document.getElementById('ct-dept-picker');
  if (!picker) return;
  picker.innerHTML = ctDepartments.map(d => `
    <button type="button" class="ct-dept-btn ${d.code === activeCode ? 'active' : ''}" onclick="ctSwitchDept('${d.code}')">
      ${d.name_tr || d.name} <span style="opacity:0.6; font-weight:700;">(${d.code})</span>
    </button>
  `).join('');
}

async function ctSwitchDept(code) {
  if (code === ctActiveDeptCode) return;
  renderDeptPicker(code);
  await ctLoadDepartment(code);
}
window.ctSwitchDept = ctSwitchDept;

async function ctLoadDepartment(code) {
  ctActiveDeptCode = code;
  const dept = ctDepartments.find(d => d.code === code);
  if (!dept) return;

  document.getElementById('ct-dept-title').textContent = `Ders Ağacı — ${dept.name_tr || dept.name}`;
  document.getElementById('ct-dept-subtitle').textContent = `${dept.name} bölümünün resmi müfredatı, sınıf sınıf.`;

  const treeContainer = document.getElementById('ct-tree-container');
  treeContainer.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Yükleniyor...</div>`;

  try {
    const { data: courses, error: coursesErr } = await supabaseClient
      .from('courses')
      .select('id, course_code, course_name, year_level')
      .eq('department_code', code)
      .order('year_level', { ascending: true })
      .order('course_code', { ascending: true });

    if (coursesErr) throw coursesErr;

    // Fetch shared study cards for this department once, then count matches
    // client-side by course_tag (case-insensitive) — avoids one query per course.
    const { data: sharedCards, error: cardsErr } = await supabaseClient
      .from('study_cards')
      .select('course_tag')
      .eq('is_shared', true)
      .eq('department', dept.name)
      .not('course_tag', 'is', null);

    if (cardsErr) console.warn('Could not load shared card counts:', cardsErr);

    const countByCode = {};
    (sharedCards || []).forEach(c => {
      const key = (c.course_tag || '').trim().toUpperCase();
      if (!key) return;
      countByCode[key] = (countByCode[key] || 0) + 1;
    });

    // A course's shared-summary count can only be usefully deep-linked into
    // the Department Feed when browsing your OWN department — dashboard.html
    // always shows the logged-in student's own department feed, so a link
    // for another department's course would land on the wrong feed.
    const isOwnDept = !!(window.__acadexProfile && window.__acadexProfile.department === dept.name);

    renderStats(courses || [], countByCode);
    renderTree(courses || [], countByCode, isOwnDept);
  } catch (err) {
    console.error('Failed to load department courses:', err);
    treeContainer.innerHTML = `<div class="ct-panel-card">Bu bölümün dersleri yüklenirken bir hata oluştu.</div>`;
  }
}

function renderStats(courses, countByCode) {
  const total = courses.length;
  const withCards = courses.filter(c => (countByCode[c.course_code.toUpperCase()] || 0) > 0).length;
  const totalCards = courses.reduce((sum, c) => sum + (countByCode[c.course_code.toUpperCase()] || 0), 0);

  document.getElementById('ct-stat-grid').innerHTML = `
    <div class="ct-stat-card"><div class="ct-stat-value">${total}</div><div class="ct-stat-label">Toplam Ders</div></div>
    <div class="ct-stat-card"><div class="ct-stat-value">${withCards}</div><div class="ct-stat-label">Özeti Olan Ders</div></div>
    <div class="ct-stat-card"><div class="ct-stat-value">${total - withCards}</div><div class="ct-stat-label">Henüz Özeti Olmayan</div></div>
    <div class="ct-stat-card"><div class="ct-stat-value">${totalCards}</div><div class="ct-stat-label">Paylaşılan Özet</div></div>
  `;
}

function renderTree(courses, countByCode, isOwnDept) {
  const container = document.getElementById('ct-tree-container');
  if (courses.length === 0) {
    container.innerHTML = `<div class="ct-panel-card">Bu bölüm için henüz ders kataloğu girilmemiş.</div>`;
    return;
  }

  const byYear = {};
  courses.forEach(c => {
    const y = c.year_level || 0;
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(c);
  });

  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);

  container.innerHTML = years.map(year => {
    const label = year > 0 ? `${year}. Sınıf Dersleri` : 'Sınıfı Belirtilmemiş Dersler';
    const rows = byYear[year].map(c => {
      const count = countByCode[c.course_code.toUpperCase()] || 0;
      let badge;
      if (count > 0 && isOwnDept) {
        badge = `<span class="ct-count-badge has-cards" style="cursor:pointer;" onclick="ctGoToFeed('${c.course_code}')" title="Bölüm akışında bu dersin özetlerini gör">📚 ${count} özet →</span>`;
      } else if (count > 0) {
        badge = `<span class="ct-count-badge has-cards">📚 ${count} özet</span>`;
      } else {
        badge = `<span class="ct-count-badge empty">İlk sen özetle!</span>`;
      }
      // Always available regardless of shared-card count or department
      // ownership — Sınav Platformu pools shared cards for this course when
      // they exist, and otherwise falls back to AI general-knowledge
      // generation, so there's no state where this can't produce an exam.
      const examBtn = `<span class="ct-count-badge has-cards" style="cursor:pointer; background:rgba(31,138,147,0.12); color:var(--color-teal);" onclick="ctGenerateExam('${c.course_code}', '${ctActiveDeptCode}')" title="Bu dersten doğrudan sınav oluştur">📝 Sınav Oluştur</span>`;
      return `
        <div class="ct-course-row">
          <span class="ct-course-code">${c.course_code}</span>
          <span class="ct-course-name">${c.course_name}</span>
          <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
            ${badge}
            ${examBtn}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="ct-panel-card" style="margin-bottom: 1rem; padding: 1rem;">
        <div class="ct-year-header" onclick="ctToggleYear(this)">
          <span>${label} <span style="font-weight:600; color: var(--color-text-muted);">(${byYear[year].length})</span></span>
          <svg class="ct-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
        <div class="ct-year-body">${rows}</div>
      </div>
    `;
  }).join('');
}

function ctToggleYear(headerEl) {
  headerEl.classList.toggle('collapsed');
  const body = headerEl.nextElementSibling;
  if (body) body.classList.toggle('collapsed');
}
window.ctToggleYear = ctToggleYear;

function ctGoToFeed(courseCode) {
  window.location.href = `dashboard.html?course=${encodeURIComponent(courseCode)}`;
}
window.ctGoToFeed = ctGoToFeed;

function ctGenerateExam(courseCode, deptCode) {
  window.location.href = `dashboard.html?examCourse=${encodeURIComponent(courseCode)}&examDeptCode=${encodeURIComponent(deptCode || '')}`;
}
window.ctGenerateExam = ctGenerateExam;

document.addEventListener('acadex-course-tree-ready', ctInit);
