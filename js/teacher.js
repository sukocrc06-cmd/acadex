/* ==========================================================================
   ACADEX ACADEMIC (HOCA) PANEL (js/teacher.js)
   Standalone teacher page. Waits for the route guard in teacher.html to
   confirm the current user is a teacher (or admin previewing), then wires
   up the three tabs, all scoped to the teacher's own department via RLS.
   ========================================================================== */

let teacherProfile = null;
let deptStudents = [];

document.addEventListener('acadex-teacher-ready', () => {
  teacherProfile = window.__acadexTeacherProfile;

  const nameEl = document.getElementById('teacher-topbar-name');
  const deptEl = document.getElementById('teacher-topbar-dept');
  if (nameEl) nameEl.textContent = teacherProfile.full_name || 'Hoca';
  if (deptEl) deptEl.textContent = teacherProfile.department || '';

  wireLogout();
  loadStudentPerformance();
});

function wireLogout() {
  const btn = document.getElementById('btn-teacher-logout');
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
}

function showTeacherAlert(type, message) {
  const container = document.getElementById('teacher-alert-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.style.marginBottom = '1rem';
  el.textContent = message;
  container.innerHTML = '';
  container.appendChild(el);
  setTimeout(() => { el.remove(); }, 5000);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================
// TAB SWITCHING
// ==========================================
function switchTeacherTab(tabId) {
  document.querySelectorAll('.teacher-tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`teacher-${tabId}-panel`);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('[data-teacher-tab]').forEach(li => {
    li.classList.toggle('active', li.getAttribute('data-teacher-tab') === tabId);
  });

  if (tabId === 'students') loadStudentPerformance();
  if (tabId === 'exams') loadExamReview();
  if (tabId === 'materials') { loadTeacherAnnouncements(); loadTeacherMaterials(); }
}
window.switchTeacherTab = switchTeacherTab;

// ==========================================
// STUDENT PERFORMANCE (read-only)
// ==========================================
async function loadStudentPerformance() {
  const tbody = document.getElementById('teacher-students-tbody');
  const summary = document.getElementById('teacher-students-summary');

  try {
    const { data: students, error: studentsError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('department', teacherProfile.department)
      .eq('is_admin', false)
      .eq('is_teacher', false)
      .order('full_name', { ascending: true });

    if (studentsError) throw studentsError;
    deptStudents = students || [];

    if (deptStudents.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Bölümünüzde kayıtlı öğrenci bulunamadı.</td></tr>`;
      if (summary) summary.innerHTML = '';
      return;
    }

    const studentIds = deptStudents.map(s => s.id);
    const { data: exams, error: examsError } = await supabaseClient
      .from('exams')
      .select('user_id, grade, completed_at')
      .in('user_id', studentIds)
      .not('completed_at', 'is', null);

    if (examsError) throw examsError;

    const examsByStudent = {};
    (exams || []).forEach(e => {
      if (!examsByStudent[e.user_id]) examsByStudent[e.user_id] = [];
      examsByStudent[e.user_id].push(e);
    });

    // Summary stat cards
    const totalExams = (exams || []).length;
    const gradesOnly = (exams || []).map(e => e.grade).filter(g => typeof g === 'number');
    const avgGrade = gradesOnly.length > 0 ? (gradesOnly.reduce((a, b) => a + b, 0) / gradesOnly.length).toFixed(1) : '—';

    if (summary) {
      summary.innerHTML = `
        <div class="teacher-stat-card"><div style="font-size:1.5rem; font-weight:800; color: var(--color-navy);">${deptStudents.length}</div><div style="font-size:0.8rem; color: var(--color-text-muted); font-weight:600;">Öğrenci</div></div>
        <div class="teacher-stat-card"><div style="font-size:1.5rem; font-weight:800; color: var(--color-navy);">${totalExams}</div><div style="font-size:0.8rem; color: var(--color-text-muted); font-weight:600;">Tamamlanan Sınav</div></div>
        <div class="teacher-stat-card"><div style="font-size:1.5rem; font-weight:800; color: var(--color-navy);">${avgGrade}${avgGrade !== '—' ? '%' : ''}</div><div style="font-size:0.8rem; color: var(--color-text-muted); font-weight:600;">Bölüm Ortalaması</div></div>
      `;
    }

    if (tbody) {
      tbody.innerHTML = deptStudents.map(s => {
        const studentExams = examsByStudent[s.id] || [];
        const grades = studentExams.map(e => e.grade).filter(g => typeof g === 'number');
        const avg = grades.length > 0 ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1) + '%' : '—';
        return `
          <tr>
            <td>${escapeHtml(s.full_name || '—')}</td>
            <td>${escapeHtml(s.student_number || '—')}</td>
            <td style="text-align:right;">${studentExams.length}</td>
            <td style="text-align:right;">${avg}</td>
            <td style="text-align:right;">${s.current_streak ?? 0}</td>
            <td>${s.last_active_date || '—'}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('loadStudentPerformance error:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #DC2626;">Öğrenci verileri yüklenemedi.</td></tr>`;
  }
}

// ==========================================
// EXAM & GRADE REVIEW
// ==========================================
async function loadExamReview() {
  const tbody = document.getElementById('teacher-exams-tbody');
  if (!tbody) return;

  try {
    if (deptStudents.length === 0) {
      await loadStudentPerformance();
    }
    if (deptStudents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Bölümünüzde öğrenci yok.</td></tr>`;
      return;
    }

    const studentIds = deptStudents.map(s => s.id);
    const { data: exams, error } = await supabaseClient
      .from('exams')
      .select('*, study_cards(documents(file_name))')
      .in('user_id', studentIds)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    if (!exams || exams.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Henüz tamamlanmış sınav yok.</td></tr>`;
      return;
    }

    const studentsById = {};
    deptStudents.forEach(s => { studentsById[s.id] = s; });

    tbody.innerHTML = exams.map(e => {
      const student = studentsById[e.user_id];
      const topic = e.study_cards?.documents?.file_name || 'Genel';
      const gradeDisplay = typeof e.grade === 'number' ? e.grade + '%' : '—';
      return `
        <tr id="teacher-exam-row-${e.id}">
          <td>${escapeHtml(student?.full_name || 'Bilinmiyor')}</td>
          <td>${escapeHtml(topic)}</td>
          <td style="text-align:right;">${gradeDisplay}</td>
          <td>${e.completed_at ? new Date(e.completed_at).toLocaleDateString() : '—'}</td>
          <td>
            <input type="text" id="note-${e.id}" value="${escapeHtml(e.teacher_note || '')}" placeholder="Not ekle..." style="width: 100%; padding: 0.4rem 0.55rem; border: 1px solid rgba(22,50,92,0.15); border-radius: var(--radius-sm); font-size: 0.8rem;">
          </td>
          <td style="text-align:right; white-space: nowrap;">
            <button class="teacher-mini-btn primary" onclick="saveExamNote('${e.id}')">Kaydet</button>
            <button class="teacher-mini-btn" onclick="toggleExamReviewed('${e.id}', ${!e.teacher_reviewed})">${e.teacher_reviewed ? '✓ İncelendi' : 'İncele'}</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('loadExamReview error:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #DC2626;">Sınavlar yüklenemedi.</td></tr>`;
  }
}

async function saveExamNote(examId) {
  const input = document.getElementById(`note-${examId}`);
  if (!input) return;
  try {
    // Only the review columns are ever sent from the teacher panel — the
    // AI-generated grade/answers on this row are never touched here.
    const { error } = await supabaseClient
      .from('exams')
      .update({
        teacher_note: input.value.trim(),
        teacher_reviewed_by: teacherProfile.id,
        teacher_reviewed_at: new Date().toISOString()
      })
      .eq('id', examId);
    if (error) throw error;
    showTeacherAlert('success', 'Not kaydedildi.');
  } catch (err) {
    console.error('saveExamNote error:', err);
    showTeacherAlert('error', 'Kaydedilemedi: ' + (err.message || ''));
  }
}
window.saveExamNote = saveExamNote;

async function toggleExamReviewed(examId, reviewed) {
  try {
    const { error } = await supabaseClient
      .from('exams')
      .update({
        teacher_reviewed: reviewed,
        teacher_reviewed_by: teacherProfile.id,
        teacher_reviewed_at: new Date().toISOString()
      })
      .eq('id', examId);
    if (error) throw error;
    loadExamReview();
  } catch (err) {
    console.error('toggleExamReviewed error:', err);
    showTeacherAlert('error', 'Güncellenemedi: ' + (err.message || ''));
  }
}
window.toggleExamReviewed = toggleExamReviewed;

// ==========================================
// ANNOUNCEMENTS (scoped to own department only)
// ==========================================
function openTeacherAnnouncementForm() {
  document.getElementById('teacher-announcement-form').style.display = 'block';
}
window.openTeacherAnnouncementForm = openTeacherAnnouncementForm;

function closeTeacherAnnouncementForm() {
  document.getElementById('teacher-announcement-form').style.display = 'none';
  document.getElementById('tann-title').value = '';
  document.getElementById('tann-body').value = '';
}
window.closeTeacherAnnouncementForm = closeTeacherAnnouncementForm;

async function submitTeacherAnnouncement() {
  const title = document.getElementById('tann-title').value.trim();
  const body = document.getElementById('tann-body').value.trim();
  if (!title || !body) {
    showTeacherAlert('error', 'Başlık ve metin zorunludur.');
    return;
  }
  try {
    const { error } = await supabaseClient.from('announcements').insert({
      title, body,
      audience_department: teacherProfile.department,
      created_by: teacherProfile.id,
      created_by_role: 'teacher'
    });
    if (error) throw error;
    closeTeacherAnnouncementForm();
    loadTeacherAnnouncements();
    showTeacherAlert('success', 'Duyuru yayınlandı.');
  } catch (err) {
    console.error('submitTeacherAnnouncement error:', err);
    showTeacherAlert('error', 'Duyuru oluşturulamadı: ' + (err.message || ''));
  }
}
window.submitTeacherAnnouncement = submitTeacherAnnouncement;

async function loadTeacherAnnouncements() {
  const list = document.getElementById('teacher-announcements-list');
  if (!list) return;
  try {
    const { data, error } = await supabaseClient
      .from('announcements')
      .select('*')
      .eq('created_by', teacherProfile.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding: 1.5rem; color: var(--color-text-muted);">Henüz duyuru paylaşmadınız.</div>`;
      return;
    }

    list.innerHTML = data.map(a => `
      <div style="border: 1px solid rgba(22,50,92,0.08); border-radius: var(--radius-sm); padding: 0.85rem 1rem; ${a.active ? '' : 'opacity: 0.5;'}">
        <div style="display:flex; justify-content: space-between; align-items:flex-start; gap: 0.5rem; flex-wrap: wrap;">
          <strong style="color: var(--color-navy); font-size: 0.9rem;">${escapeHtml(a.title)}</strong>
          <span style="font-size: 0.7rem; color: var(--color-text-muted);">${new Date(a.created_at).toLocaleDateString()}</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--color-text); margin-top: 0.35rem;">${escapeHtml(a.body)}</p>
        <div style="margin-top: 0.5rem; display:flex; gap: 0.5rem;">
          <button class="teacher-mini-btn" onclick="toggleTeacherAnnouncementActive('${a.id}', ${!a.active})">${a.active ? 'Pasifleştir' : 'Aktifleştir'}</button>
          <button class="teacher-mini-btn danger" onclick="deleteTeacherAnnouncement('${a.id}')">Sil</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadTeacherAnnouncements error:', err);
    list.innerHTML = `<p style="color:#DC2626;">Duyurular yüklenemedi.</p>`;
  }
}

async function toggleTeacherAnnouncementActive(id, active) {
  try {
    await supabaseClient.from('announcements').update({ active }).eq('id', id);
    loadTeacherAnnouncements();
  } catch (err) {
    console.error('toggleTeacherAnnouncementActive error:', err);
  }
}
window.toggleTeacherAnnouncementActive = toggleTeacherAnnouncementActive;

async function deleteTeacherAnnouncement(id) {
  if (!window.confirm('Bu duyuruyu silmek istiyor musunuz?')) return;
  try {
    await supabaseClient.from('announcements').delete().eq('id', id);
    loadTeacherAnnouncements();
  } catch (err) {
    console.error('deleteTeacherAnnouncement error:', err);
  }
}
window.deleteTeacherAnnouncement = deleteTeacherAnnouncement;

// ==========================================
// MATERIALS (link-based resource list, scoped to own department)
// ==========================================
function openTeacherMaterialForm() {
  document.getElementById('teacher-material-form').style.display = 'block';
}
window.openTeacherMaterialForm = openTeacherMaterialForm;

function closeTeacherMaterialForm() {
  document.getElementById('teacher-material-form').style.display = 'none';
  document.getElementById('tmat-title').value = '';
  document.getElementById('tmat-desc').value = '';
  document.getElementById('tmat-url').value = '';
}
window.closeTeacherMaterialForm = closeTeacherMaterialForm;

async function submitTeacherMaterial() {
  const title = document.getElementById('tmat-title').value.trim();
  const description = document.getElementById('tmat-desc').value.trim();
  const url = document.getElementById('tmat-url').value.trim();

  if (!title || !url) {
    showTeacherAlert('error', 'Başlık ve bağlantı zorunludur.');
    return;
  }
  try {
    const { error } = await supabaseClient.from('teacher_materials').insert({
      teacher_id: teacherProfile.id,
      department: teacherProfile.department,
      title, description: description || null, url
    });
    if (error) throw error;
    closeTeacherMaterialForm();
    loadTeacherMaterials();
    showTeacherAlert('success', 'Materyal paylaşıldı.');
  } catch (err) {
    console.error('submitTeacherMaterial error:', err);
    showTeacherAlert('error', 'Paylaşılamadı: ' + (err.message || ''));
  }
}
window.submitTeacherMaterial = submitTeacherMaterial;

async function loadTeacherMaterials() {
  const list = document.getElementById('teacher-materials-list');
  if (!list) return;
  try {
    const { data, error } = await supabaseClient
      .from('teacher_materials')
      .select('*')
      .eq('teacher_id', teacherProfile.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding: 1.5rem; color: var(--color-text-muted);">Henüz materyal paylaşmadınız.</div>`;
      return;
    }

    list.innerHTML = data.map(m => `
      <div style="border: 1px solid rgba(22,50,92,0.08); border-radius: var(--radius-sm); padding: 0.85rem 1rem; display:flex; justify-content: space-between; align-items:flex-start; gap: 0.75rem; flex-wrap: wrap;">
        <div>
          <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener" style="color: var(--color-teal); font-weight: 700; font-size: 0.9rem; text-decoration: underline;">${escapeHtml(m.title)}</a>
          ${m.description ? `<p style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 0.25rem;">${escapeHtml(m.description)}</p>` : ''}
          <span style="font-size: 0.7rem; color: var(--color-text-muted);">${new Date(m.created_at).toLocaleDateString()}</span>
        </div>
        <button class="teacher-mini-btn danger" onclick="deleteTeacherMaterial('${m.id}')">Sil</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadTeacherMaterials error:', err);
    list.innerHTML = `<p style="color:#DC2626;">Materyaller yüklenemedi.</p>`;
  }
}

async function deleteTeacherMaterial(id) {
  if (!window.confirm('Bu materyali silmek istiyor musunuz?')) return;
  try {
    await supabaseClient.from('teacher_materials').delete().eq('id', id);
    loadTeacherMaterials();
  } catch (err) {
    console.error('deleteTeacherMaterial error:', err);
  }
}
window.deleteTeacherMaterial = deleteTeacherMaterial;
