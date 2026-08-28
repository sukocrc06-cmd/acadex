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
let ctCourseNamesByCode = {};

// "Ders Kaynakları" (course resources) modal state — a crowdsourced record
// of which textbook/topics a course's real professor actually uses, entered
// by students themselves (see supabase/migrations/20260828e_add_course_resources.sql).
// Acadia never invents this information; it only surfaces what students report.
let ctResourceModalCourseCode = null;
let ctResourceVoteCounts = {};
let ctResourceUserVotedSet = new Set();

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

    // Bulk-load "Ders Kaynağı" (student-reported textbook/topics) counts for
    // every course in this department in one query, same batching approach
    // as the shared-card counts above.
    ctCourseNamesByCode = {};
    (courses || []).forEach(c => { ctCourseNamesByCode[c.course_code] = c.course_name; });
    const resourceCountByCode = {};
    try {
      const courseCodes = (courses || []).map(c => c.course_code);
      if (courseCodes.length > 0) {
        const { data: resources, error: resErr } = await supabaseClient
          .from('course_resources')
          .select('course_code')
          .in('course_code', courseCodes);
        if (resErr) {
          console.warn('Could not load course resource counts (has 20260828e_add_course_resources.sql been run?):', resErr);
        } else {
          (resources || []).forEach(r => {
            resourceCountByCode[r.course_code] = (resourceCountByCode[r.course_code] || 0) + 1;
          });
        }
      }
    } catch (resEx) {
      console.warn('Exception loading course resource counts:', resEx);
    }

    // A course's shared-summary count can only be usefully deep-linked into
    // the Department Feed when browsing your OWN department — dashboard.html
    // always shows the logged-in student's own department feed, so a link
    // for another department's course would land on the wrong feed.
    const isOwnDept = !!(window.__acadexProfile && window.__acadexProfile.department === dept.name);

    renderStats(courses || [], countByCode);
    renderTree(courses || [], countByCode, isOwnDept, resourceCountByCode);
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

function renderTree(courses, countByCode, isOwnDept, resourceCountByCode) {
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

      // "Ders Kaynağı" — student-reported textbook/topics for this course.
      // Always clickable (to view existing entries or add one), regardless
      // of whether any exist yet.
      const resourceCount = (resourceCountByCode && resourceCountByCode[c.course_code]) || 0;
      const resourceBtn = resourceCount > 0
        ? `<span class="ct-count-badge has-cards" style="cursor:pointer; background:rgba(99,102,241,0.12); color:#4F46E5;" onclick="ctOpenResourceModal('${c.course_code}')" title="Öğrencilerin bildirdiği kaynakları gör">📖 ${resourceCount} Kaynak</span>`
        : `<span class="ct-count-badge empty" style="cursor:pointer;" onclick="ctOpenResourceModal('${c.course_code}')" title="Bu ders için kitap/konu bilgisi paylaş">📖 Kaynak Ekle</span>`;

      return `
        <div class="ct-course-row">
          <span class="ct-course-code">${c.course_code}</span>
          <span class="ct-course-name">${c.course_name}</span>
          <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
            ${badge}
            ${examBtn}
            ${resourceBtn}
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

// ==========================================================================
// "Ders Kaynakları" modal — students report a course's real textbook and/or
// which topics it actually covers, so Acadex can eventually ground exam and
// summary generation in real course material instead of a generic AI guess.
// This is a crowdsourced record, never something Acadia invents on its own —
// see the disclaimer rendered in the modal itself.
// ==========================================================================

function ctOpenResourceModal(courseCode) {
  ctResourceModalCourseCode = courseCode;
  const modal = document.getElementById('ct-resource-modal');
  if (!modal) return;

  const titleEl = document.getElementById('ct-resource-modal-title');
  if (titleEl) titleEl.textContent = `📖 ${courseCode} — Ders Kaynakları`;

  const nameEl = document.getElementById('ct-resource-modal-course-name');
  if (nameEl) nameEl.textContent = ctCourseNamesByCode[courseCode] || '';

  ['ct-resource-book-title', 'ct-resource-book-author', 'ct-resource-topics-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  modal.classList.add('active');
  ctLoadCourseResources(courseCode);
}
window.ctOpenResourceModal = ctOpenResourceModal;

function ctCloseResourceModal() {
  const modal = document.getElementById('ct-resource-modal');
  if (modal) modal.classList.remove('active');
  ctResourceModalCourseCode = null;
}
window.ctCloseResourceModal = ctCloseResourceModal;

async function ctLoadCourseResources(courseCode) {
  const listEl = document.getElementById('ct-resource-list');
  if (!listEl) return;
  listEl.innerHTML = `<p style="font-size:0.85rem; color: var(--color-text-muted);">Yükleniyor...</p>`;

  try {
    const { data: resources, error } = await supabaseClient
      .from('course_resources')
      .select('id, book_title, book_author, topics_note, submitted_by, created_at')
      .eq('course_code', courseCode)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not load course resources (has 20260828e_add_course_resources.sql been run?):', error);
      listEl.innerHTML = `<p style="font-size:0.85rem; color:#DC2626;">Kaynaklar yüklenemedi. Bu özellik için gerekli veritabanı tablosu henüz oluşturulmamış olabilir.</p>`;
      return;
    }

    ctResourceVoteCounts = {};
    ctResourceUserVotedSet = new Set();
    const currentUserId = window.__acadexProfile?.id || null;
    if (resources && resources.length > 0) {
      const resourceIds = resources.map(r => r.id);
      const { data: votes, error: voteErr } = await supabaseClient
        .from('course_resource_votes')
        .select('resource_id, user_id')
        .in('resource_id', resourceIds);
      if (!voteErr && votes) {
        votes.forEach(v => {
          ctResourceVoteCounts[v.resource_id] = (ctResourceVoteCounts[v.resource_id] || 0) + 1;
          if (v.user_id === currentUserId) ctResourceUserVotedSet.add(v.resource_id);
        });
      }
    }

    // Fetch submitter display names (best-effort — resource still renders
    // fine with a generic label if this fails).
    let nameById = {};
    if (resources && resources.length > 0) {
      const userIds = [...new Set(resources.map(r => r.submitted_by))];
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      (profiles || []).forEach(p => { nameById[p.id] = p.full_name || 'Bir öğrenci'; });
    }

    ctRenderResourceList(resources || [], nameById);
  } catch (err) {
    console.error('Exception loading course resources:', err);
    listEl.innerHTML = `<p style="font-size:0.85rem; color:#DC2626;">Kaynaklar yüklenirken bir hata oluştu.</p>`;
  }
}

function ctRenderResourceList(resources, nameById) {
  const listEl = document.getElementById('ct-resource-list');
  if (!listEl) return;

  if (resources.length === 0) {
    listEl.innerHTML = `<p style="font-size:0.85rem; color: var(--color-text-muted);">Bu ders için henüz kaynak paylaşılmamış. İlk paylaşan sen ol!</p>`;
    return;
  }

  // Most-voted first, so confirmed/trusted entries surface above unverified
  // single submissions.
  const sorted = [...resources].sort((a, b) => (ctResourceVoteCounts[b.id] || 0) - (ctResourceVoteCounts[a.id] || 0));

  listEl.innerHTML = sorted.map(r => {
    const formattedDate = new Date(r.created_at).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric', year: 'numeric' });
    const submitterName = nameById[r.submitted_by] || 'Bir öğrenci';
    const count = ctResourceVoteCounts[r.id] || 0;
    const voted = ctResourceUserVotedSet.has(r.id);
    return `
      <div style="border: 1px solid rgba(22,50,92,0.08); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 0.6rem;">
        ${r.book_title ? `<div style="font-weight:700; color: var(--color-navy); font-size:0.9rem;">📘 ${r.book_title}${r.book_author ? ` <span style="font-weight:500; color: var(--color-text-muted);">— ${r.book_author}</span>` : ''}</div>` : ''}
        ${r.topics_note ? `<div style="font-size:0.83rem; color: var(--color-text); margin-top:${r.book_title ? '0.4rem' : '0'};">${r.topics_note}</div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem;">
          <span style="font-size:0.72rem; color: var(--color-text-muted);">${submitterName} · ${formattedDate}</span>
          <button id="ct-resource-vote-btn-${r.id}" onclick="ctToggleResourceVote('${r.id}')"
            class="btn ${voted ? 'btn-primary' : 'btn-outline'}"
            title="${voted ? 'Doğruluyorum işaretini kaldır' : 'Bu bilgiyi doğruluyorum'}"
            style="padding: 0.3rem 0.6rem; font-size: 0.72rem; display:flex; align-items:center; gap:0.3rem; ${voted ? 'border:none; background: var(--color-teal); color:#fff;' : ''}">
            <span aria-hidden="true">👍</span><span id="ct-resource-vote-count-${r.id}">${count}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function ctToggleResourceVote(resourceId) {
  const currentUserId = window.__acadexProfile?.id;
  if (!currentUserId) return;
  const btn = document.getElementById(`ct-resource-vote-btn-${resourceId}`);
  const countEl = document.getElementById(`ct-resource-vote-count-${resourceId}`);
  if (btn) btn.disabled = true;

  const alreadyVoted = ctResourceUserVotedSet.has(resourceId);

  try {
    if (alreadyVoted) {
      const { error } = await supabaseClient
        .from('course_resource_votes')
        .delete()
        .eq('resource_id', resourceId)
        .eq('user_id', currentUserId);
      if (error) throw error;
      ctResourceUserVotedSet.delete(resourceId);
      ctResourceVoteCounts[resourceId] = Math.max(0, (ctResourceVoteCounts[resourceId] || 1) - 1);
    } else {
      const { error } = await supabaseClient
        .from('course_resource_votes')
        .insert({ resource_id: resourceId, user_id: currentUserId });
      if (error) throw error;
      ctResourceUserVotedSet.add(resourceId);
      ctResourceVoteCounts[resourceId] = (ctResourceVoteCounts[resourceId] || 0) + 1;
    }

    const nowVoted = ctResourceUserVotedSet.has(resourceId);
    if (btn) {
      btn.className = `btn ${nowVoted ? 'btn-primary' : 'btn-outline'}`;
      btn.title = nowVoted ? 'Doğruluyorum işaretini kaldır' : 'Bu bilgiyi doğruluyorum';
      btn.style.cssText = `padding: 0.3rem 0.6rem; font-size: 0.72rem; display:flex; align-items:center; gap:0.3rem; ${nowVoted ? 'border:none; background: var(--color-teal); color:#fff;' : ''}`;
    }
    if (countEl) countEl.textContent = ctResourceVoteCounts[resourceId] || 0;
  } catch (err) {
    console.error('Failed to toggle resource vote (has 20260828e_add_course_resources.sql been run?):', err);
    ctShowAlert('error', 'Oy kaydedilemedi. Bu özellik için gerekli veritabanı tablosu henüz oluşturulmamış olabilir.');
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.ctToggleResourceVote = ctToggleResourceVote;

async function ctSubmitCourseResource() {
  const courseCode = ctResourceModalCourseCode;
  const currentUserId = window.__acadexProfile?.id;
  if (!courseCode || !currentUserId) return;

  const bookTitle = (document.getElementById('ct-resource-book-title')?.value || '').trim();
  const bookAuthor = (document.getElementById('ct-resource-book-author')?.value || '').trim();
  const topicsNote = (document.getElementById('ct-resource-topics-note')?.value || '').trim();

  if (!bookTitle && !topicsNote) {
    ctShowAlert('error', 'Lütfen en az kitap adı veya konu/not alanlarından birini doldurun.');
    return;
  }

  const btn = document.getElementById('ct-resource-submit-btn');
  const originalText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Paylaşılıyor...'; }

  try {
    const { error } = await supabaseClient
      .from('course_resources')
      .insert({
        course_code: courseCode,
        book_title: bookTitle || null,
        book_author: bookAuthor || null,
        topics_note: topicsNote || null,
        submitted_by: currentUserId
      });

    if (error) throw error;

    ['ct-resource-book-title', 'ct-resource-book-author', 'ct-resource-topics-note'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    await ctLoadCourseResources(courseCode);
    // Refresh the badge count on the tree row behind the modal too.
    if (ctActiveDeptCode) await ctLoadDepartment(ctActiveDeptCode);
  } catch (err) {
    console.error('Failed to submit course resource (has 20260828e_add_course_resources.sql been run?):', err);
    ctShowAlert('error', 'Kaynak paylaşılamadı. Bu özellik için gerekli veritabanı tablosu henüz oluşturulmamış olabilir.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}
window.ctSubmitCourseResource = ctSubmitCourseResource;

document.addEventListener('acadex-course-tree-ready', ctInit);
