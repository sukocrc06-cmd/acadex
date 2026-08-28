/* ==========================================================================
   ACADEX ADMIN PANEL (js/admin.js)
   Standalone admin page. Waits for the route guard in admin.html to confirm
   the current user is an admin (profiles.is_admin = true), then wires up
   the four tabs: Kullanıcılar, Analitik, İçerik & Destek, Ayarlar.
   ========================================================================== */

let adminProfile = null;
let allDepartments = [];
let cachedUsers = [];

document.addEventListener('acadex-admin-ready', () => {
  adminProfile = window.__acadexAdminProfile;
  const nameEl = document.getElementById('admin-topbar-name');
  if (nameEl) nameEl.textContent = adminProfile.full_name || 'Admin';

  wireLogout();
  loadUsers();
  loadDepartmentsForFilters();

  const searchInput = document.getElementById('admin-user-search');
  if (searchInput) searchInput.addEventListener('input', renderUsersTable);
  const roleFilter = document.getElementById('admin-user-filter-role');
  if (roleFilter) roleFilter.addEventListener('change', renderUsersTable);
});

function wireLogout() {
  const btn = document.getElementById('btn-admin-logout');
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
}

function showAdminAlert(type, message) {
  const container = document.getElementById('admin-alert-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.style.marginBottom = '1rem';
  el.textContent = message;
  container.innerHTML = '';
  container.appendChild(el);
  setTimeout(() => { el.remove(); }, 5000);
}

// ==========================================
// TAB SWITCHING
// ==========================================
function switchAdminTab(tabId) {
  document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`admin-${tabId}-panel`);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('[data-admin-tab]').forEach(li => {
    li.classList.toggle('active', li.getAttribute('data-admin-tab') === tabId);
  });

  if (tabId === 'analytics') loadAnalytics();
  if (tabId === 'content') { loadContactMessages(); loadSharedCardsModeration(); }
  if (tabId === 'settings') { loadSiteSettings(); loadAnnouncements(); loadAuditLog(); }
  if (tabId === 'catalog') loadCourseCatalog();
  if (tabId === 'knowledge') loadKnowledgeBase();
}
window.switchAdminTab = switchAdminTab;

function switchAdminContentSubtab(which) {
  const msgBtn = document.getElementById('admin-content-tab-messages');
  const cardsBtn = document.getElementById('admin-content-tab-cards');
  const msgView = document.getElementById('admin-content-messages-view');
  const cardsView = document.getElementById('admin-content-cards-view');
  if (which === 'messages') {
    msgView.style.display = 'block';
    cardsView.style.display = 'none';
    msgBtn.classList.add('primary');
    cardsBtn.classList.remove('primary');
  } else {
    msgView.style.display = 'none';
    cardsView.style.display = 'block';
    cardsBtn.classList.add('primary');
    msgBtn.classList.remove('primary');
  }
}
window.switchAdminContentSubtab = switchAdminContentSubtab;

// ==========================================
// USERS & ROLES
// ==========================================
async function loadUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    cachedUsers = data || [];
    renderUsersTable();
    renderTeacherApplications();
  } catch (err) {
    console.error('loadUsers error:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #DC2626;">Kullanıcılar yüklenemedi.</td></tr>`;
  }
}

// ==========================================
// TEACHER (ACADEMIC) APPLICATIONS
//
// Academics register via register-academic.html, which sets
// teacher_request_pending = true on their profile but does NOT grant
// is_teacher itself — that only happens here, once an admin reviews and
// approves the request. This keeps self-service signup from being able to
// grant teacher/admin access to anyone who merely picks that option.
// ==========================================
function renderTeacherApplications() {
  const card = document.getElementById('admin-teacher-apps-card');
  const tbody = document.getElementById('admin-teacher-apps-tbody');
  const badge = document.getElementById('admin-users-badge');
  if (!card || !tbody) return;

  const pending = cachedUsers.filter(u => u.teacher_request_pending);

  if (badge) {
    if (pending.length > 0) {
      badge.textContent = String(pending.length);
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (pending.length === 0) {
    card.style.display = 'none';
    tbody.innerHTML = '';
    return;
  }

  card.style.display = 'block';
  tbody.innerHTML = pending.map(u => `
    <tr>
      <td>${escapeHtml(u.full_name || '—')}</td>
      <td>${escapeHtml(u.email || '—')}</td>
      <td>${escapeHtml(u.department || '—')}</td>
      <td>${escapeHtml(u.teacher_title || '—')}</td>
      <td style="text-align:right; white-space: nowrap;">
        <button class="admin-mini-btn primary" onclick="approveTeacherApplication('${u.id}')">✅ Onayla</button>
        <button class="admin-mini-btn danger" onclick="rejectTeacherApplication('${u.id}')">✖ Reddet</button>
      </td>
    </tr>
  `).join('');
}

async function approveTeacherApplication(userId) {
  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ is_teacher: true, teacher_request_pending: false })
      .eq('id', userId);
    if (error) throw error;

    const user = cachedUsers.find(u => u.id === userId);
    if (user) {
      user.is_teacher = true;
      user.teacher_request_pending = false;
    }
    renderUsersTable();
    renderTeacherApplications();
    showAdminAlert('success', 'Hoca başvurusu onaylandı.');

    writeAdminAuditLog('approve_teacher_application', userId, user ? (user.full_name || user.email) : userId, null);
    notifyRoleChange(userId, 'teacher').catch(err => console.error('notifyRoleChange error:', err));
  } catch (err) {
    console.error('approveTeacherApplication error:', err);
    showAdminAlert('error', 'Onaylama başarısız: ' + (err.message || 'bilinmeyen hata'));
  }
}
window.approveTeacherApplication = approveTeacherApplication;

async function rejectTeacherApplication(userId) {
  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ teacher_request_pending: false })
      .eq('id', userId);
    if (error) throw error;

    const user = cachedUsers.find(u => u.id === userId);
    if (user) user.teacher_request_pending = false;
    renderUsersTable();
    renderTeacherApplications();
    showAdminAlert('success', 'Hoca başvurusu reddedildi.');

    writeAdminAuditLog('reject_teacher_application', userId, user ? (user.full_name || user.email) : userId, null);
  } catch (err) {
    console.error('rejectTeacherApplication error:', err);
    showAdminAlert('error', 'Reddetme başarısız: ' + (err.message || 'bilinmeyen hata'));
  }
}
window.rejectTeacherApplication = rejectTeacherApplication;

function renderUsersTable() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  const search = (document.getElementById('admin-user-search')?.value || '').trim().toLowerCase();
  const roleFilter = document.getElementById('admin-user-filter-role')?.value || '';

  let rows = cachedUsers.filter(u => {
    const role = u.is_admin ? 'admin' : (u.is_teacher ? 'teacher' : 'student');
    if (roleFilter && role !== roleFilter) return false;
    if (!search) return true;
    const haystack = `${u.full_name || ''} ${u.email || ''} ${u.student_number || ''} ${u.department || ''}`.toLowerCase();
    return haystack.includes(search);
  });

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Kullanıcı bulunamadı.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(u => {
    const role = u.is_admin ? 'admin' : (u.is_teacher ? 'teacher' : 'student');
    const roleLabel = role === 'admin' ? 'Admin' : (role === 'teacher' ? 'Hoca' : 'Öğrenci');
    const suspendedBadge = u.is_suspended ? `<span class="admin-badge suspended">Askıda</span>` : '';
    const pendingBadge = u.teacher_request_pending ? `<span class="admin-badge pending">Hoca Onayı Bekliyor</span>` : '';
    return `
      <tr>
        <td>${escapeHtml(u.full_name || '—')}</td>
        <td>${escapeHtml(u.email || '—')}</td>
        <td>${escapeHtml(u.department || '—')}</td>
        <td>${escapeHtml(u.student_number || '—')}</td>
        <td>
          <span class="admin-badge role-${role}">${roleLabel}</span>
        </td>
        <td>${suspendedBadge}${suspendedBadge && pendingBadge ? ' ' : ''}${pendingBadge || (suspendedBadge ? '' : '<span style="color: var(--color-text-muted); font-size:0.75rem;">Aktif</span>')}</td>
        <td style="text-align:right; white-space: nowrap;">
          <button class="admin-mini-btn" onclick="toggleUserFlag('${u.id}', 'is_teacher', ${!u.is_teacher})">${u.is_teacher ? 'Hoca Yetkisini Al' : 'Hoca Yap'}</button>
          <button class="admin-mini-btn" onclick="toggleUserFlag('${u.id}', 'is_admin', ${!u.is_admin})">${u.is_admin ? 'Admin Yetkisini Al' : 'Admin Yap'}</button>
          ${u.is_suspended
            ? `<button class="admin-mini-btn" onclick="suspendUser('${u.id}', false)">Askıyı Kaldır</button>`
            : `<button class="admin-mini-btn danger" onclick="suspendUser('${u.id}', true)">Askıya Al</button>`}
          <button class="admin-mini-btn danger" onclick="deleteUser('${u.id}', '${escapeHtml(u.full_name || u.email || 'bu kullanıcı')}')">Sil</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleUserFlag(userId, field, value) {
  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ [field]: value })
      .eq('id', userId);
    if (error) throw error;
    const user = cachedUsers.find(u => u.id === userId);
    if (user) user[field] = value;
    renderUsersTable();
    showAdminAlert('success', 'Kullanıcı güncellendi.');

    // Audit trail (best-effort — never blocks the UI on failure).
    writeAdminAuditLog(`set_${field}`, userId, user ? (user.full_name || user.email) : userId, { value });

    // Only email on a genuine promotion (false -> true), not on demotion.
    if (value === true && (field === 'is_admin' || field === 'is_teacher')) {
      const newRole = field === 'is_admin' ? 'admin' : 'teacher';
      notifyRoleChange(userId, newRole).catch(err => console.error('notifyRoleChange error:', err));
    }
  } catch (err) {
    console.error('toggleUserFlag error:', err);
    showAdminAlert('error', 'Güncelleme başarısız: ' + (err.message || 'bilinmeyen hata'));
  }
}
window.toggleUserFlag = toggleUserFlag;

async function callAdminManageUser(action, targetUserId) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Oturum bulunamadı.');

  const SUPABASE_URL_LOCAL = supabaseClient.supabaseUrl;
  const response = await fetch(`${SUPABASE_URL_LOCAL}/functions/v1/admin-manage-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ action, targetUserId })
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'İşlem başarısız.');
  }
  return result;
}

// Fire-and-forget audit trail for actions admin.html performs directly via
// RLS (role/flag toggles). Suspend/unsuspend/delete are logged server-side
// by the admin-manage-user Edge Function instead, since those already run
// under the service role.
async function writeAdminAuditLog(action, targetUserId, targetLabel, details) {
  try {
    await supabaseClient.from('admin_audit_log').insert({
      actor_id: adminProfile.id,
      actor_name: adminProfile.full_name || adminProfile.email,
      action,
      target_user_id: targetUserId,
      target_label: targetLabel,
      details: details || null
    });
  } catch (err) {
    // Never block the actual admin action on a logging failure.
    console.error('writeAdminAuditLog error:', err);
  }
}

async function loadAuditLog() {
  const tbody = document.getElementById('admin-audit-log-tbody');
  if (!tbody) return;
  try {
    const { data, error } = await supabaseClient
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 1.5rem; color: var(--color-text-muted);">Henüz kayıt yok.</td></tr>`;
      return;
    }

    const actionLabels = {
      set_is_admin: 'Admin yetkisi değiştirildi',
      set_is_teacher: 'Hoca yetkisi değiştirildi',
      approve_teacher_application: 'Hoca başvurusu onaylandı',
      reject_teacher_application: 'Hoca başvurusu reddedildi',
      suspend: 'Askıya alındı',
      unsuspend: 'Askı kaldırıldı',
      delete: 'Hesap silindi'
    };

    tbody.innerHTML = data.map(row => `
      <tr>
        <td>${new Date(row.created_at).toLocaleString()}</td>
        <td>${escapeHtml(row.actor_name || row.actor_id || '—')}</td>
        <td>${escapeHtml(actionLabels[row.action] || row.action)}${row.details ? ` <span style="color:var(--color-text-muted); font-size:0.75rem;">(${escapeHtml(JSON.stringify(row.details))})</span>` : ''}</td>
        <td>${escapeHtml(row.target_label || row.target_user_id || '—')}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('loadAuditLog error:', err);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 1.5rem; color: #DC2626;">Günlük yüklenemedi. admin_audit_log tablosunun migration ile oluşturulduğundan emin olun.</td></tr>`;
  }
}

async function notifyRoleChange(targetUserId, newRole) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const token = session?.access_token;
  if (!token) return;

  const SUPABASE_URL_LOCAL = supabaseClient.supabaseUrl;
  await fetch(`${SUPABASE_URL_LOCAL}/functions/v1/notify-role-change`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ targetUserId, newRole })
  });
}

function exportUsersCsv() {
  if (!cachedUsers || cachedUsers.length === 0) {
    showAdminAlert('error', 'Dışa aktarılacak kullanıcı yok.');
    return;
  }

  const headers = ['Ad Soyad', 'E-posta', 'Bölüm', 'Öğrenci No', 'Rol', 'Durum', 'Kayıt Tarihi'];
  const csvEscape = (val) => {
    const str = (val === null || val === undefined) ? '' : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = cachedUsers.map(u => {
    const role = u.is_admin ? 'Admin' : (u.is_teacher ? 'Hoca' : 'Öğrenci');
    const status = u.is_suspended ? 'Askıda' : 'Aktif';
    return [u.full_name, u.email, u.department, u.student_number, role, status, u.created_at]
      .map(csvEscape).join(',');
  });

  const csvContent = [headers.map(csvEscape).join(','), ...rows].join('\n');
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `acadex-kullanicilar-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
window.exportUsersCsv = exportUsersCsv;

async function suspendUser(userId, suspend) {
  const confirmMsg = suspend
    ? 'Bu kullanıcının hesabını askıya almak istediğinize emin misiniz? Giriş yapamayacaklar.'
    : 'Bu kullanıcının askısını kaldırmak istiyor musunuz?';
  if (!window.confirm(confirmMsg)) return;

  try {
    await callAdminManageUser(suspend ? 'suspend' : 'unsuspend', userId);
    const user = cachedUsers.find(u => u.id === userId);
    if (user) user.is_suspended = suspend;
    renderUsersTable();
    showAdminAlert('success', suspend ? 'Kullanıcı askıya alındı.' : 'Askı kaldırıldı.');
  } catch (err) {
    console.error('suspendUser error:', err);
    showAdminAlert('error', err.message);
  }
}
window.suspendUser = suspendUser;

async function deleteUser(userId, label) {
  const typed = window.prompt(`"${label}" hesabını KALICI olarak silmek için DELETE yazın:`);
  if (typed !== 'DELETE') return;

  try {
    await callAdminManageUser('delete', userId);
    cachedUsers = cachedUsers.filter(u => u.id !== userId);
    renderUsersTable();
    showAdminAlert('success', 'Kullanıcı silindi.');
  } catch (err) {
    console.error('deleteUser error:', err);
    showAdminAlert('error', err.message);
  }
}
window.deleteUser = deleteUser;

async function loadDepartmentsForFilters() {
  try {
    const { data, error } = await supabaseClient.from('profiles').select('department');
    if (error) throw error;
    const depts = Array.from(new Set((data || []).map(d => d.department).filter(Boolean))).sort();
    allDepartments = depts;
    const select = document.getElementById('ann-department');
    if (select) {
      depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('loadDepartmentsForFilters error:', err);
  }
}

// ==========================================
// ANALYTICS (reuses the existing get_admin_report() RPC)
// ==========================================
async function loadAnalytics() {
  const container = document.getElementById('admin-analytics-content');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Yükleniyor...</div>`;

  try {
    const { data, error } = await supabaseClient.rpc('get_admin_report');
    if (error) throw error;
    const r = data || {};

    const statCard = (label, value, icon, color) => `
      <div class="admin-stat-card">
        <div style="width: 48px; height: 48px; border-radius: var(--radius-sm); background-color: ${color}22; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0;">${icon}</div>
        <div>
          <div style="font-size: 1.75rem; font-weight: 800; color: var(--color-navy);">${value ?? '—'}</div>
          <div style="font-size: 0.8rem; color: var(--color-text-muted); font-weight: 600; margin-top: 0.15rem;">${label}</div>
        </div>
      </div>
    `;

    const teacherCount = cachedUsers.filter(u => u.is_teacher).length;
    const adminCount = cachedUsers.filter(u => u.is_admin).length;

    container.innerHTML = `
      <div class="admin-stat-grid">
        ${statCard('Öğrenci', r.total_students, '👥', '#0D9488')}
        ${statCard('Hoca', teacherCount, '🎓', '#4F46E5')}
        ${statCard('Admin', adminCount, '🛡️', '#DC2626')}
        ${statCard('Belge', r.total_documents, '📄', '#7C3AED')}
        ${statCard('Bilgi Kartı', r.total_study_cards, '🃏', '#D97706')}
        ${statCard('Birleştirilmiş Kart', r.total_merged_cards ?? 0, '🔀', '#4F46E5')}
        ${statCard('Girilen Sınav', r.total_exams_taken, '📝', '#DC2626')}
        ${statCard('Ort. Sınav Skoru', r.avg_exam_score != null ? r.avg_exam_score.toFixed(1) + '%' : '—', '⭐', '#059669')}
        ${statCard('Paylaşılan Kart', r.total_shared_cards, '🌐', '#0EA5E9')}
        ${statCard('Destek Mesajı', r.total_contact_messages ?? 0, '✉️', '#F59E0B')}
      </div>

      ${r.top_departments && r.top_departments.length > 0 ? `
        <div class="admin-panel-card" style="margin-bottom: 1rem;">
          <h3 style="font-size: 1rem; font-weight: 800; color: var(--color-navy); margin-bottom: 1rem;">📊 En Aktif Bölümler</h3>
          <table class="admin-table">
            <thead><tr><th>Bölüm</th><th style="text-align:right;">Öğrenci</th><th style="text-align:right;">Belge</th><th style="text-align:right;">Kart</th></tr></thead>
            <tbody>
              ${r.top_departments.map(d => `
                <tr>
                  <td>${escapeHtml(d.department || '—')}</td>
                  <td style="text-align:right;">${d.student_count ?? 0}</td>
                  <td style="text-align:right;">${d.document_count ?? 0}</td>
                  <td style="text-align:right;">${d.card_count ?? 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${r.recent_signups && r.recent_signups.length > 0 ? `
        <div class="admin-panel-card">
          <h3 style="font-size: 1rem; font-weight: 800; color: var(--color-navy); margin-bottom: 1rem;">🆕 Son Kayıtlar</h3>
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem;">
            ${r.recent_signups.map(u => `
              <li style="font-size: 0.85rem; color: var(--color-navy); display: flex; justify-content: space-between; border-bottom: 1px solid rgba(22,50,92,0.05); padding-bottom: 0.4rem;">
                <span>${escapeHtml(u.full_name || 'Anonim')} <span style="color: var(--color-text-muted); font-size: 0.75rem;">(${escapeHtml(u.department || 'Bölümsüz')})</span></span>
                <span style="color: var(--color-text-muted); font-size: 0.75rem;">${new Date(u.created_at).toLocaleDateString()}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  } catch (err) {
    console.error('loadAnalytics error:', err);
    container.innerHTML = `<p style="color: #DC2626;">Rapor yüklenemedi. get_admin_report() fonksiyonunun projenizde tanımlı olduğundan emin olun.</p>`;
  }
}

// ==========================================
// CONTENT & SUPPORT — contact_messages inbox
// ==========================================
async function loadContactMessages() {
  const list = document.getElementById('admin-messages-list');
  if (!list) return;
  try {
    const { data: messages, error } = await supabaseClient
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const unreadCount = (messages || []).filter(m => !m.is_read).length;
    const badge = document.getElementById('admin-content-badge');
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    if (!messages || messages.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Henüz mesaj yok.</div>`;
      return;
    }

    list.innerHTML = messages.map(msg => `
      <div class="admin-panel-card" style="cursor:pointer;" onclick="toggleMessageRead('${msg.id}', ${msg.is_read})">
        <div style="display:flex; justify-content: space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
          <strong style="color: var(--color-navy); font-size:0.95rem;">${msg.is_read ? '' : '🟢 '}${escapeHtml(msg.name || 'Anonim')}</strong>
          <span style="font-size:0.75rem; color: var(--color-text-muted);">${new Date(msg.created_at).toLocaleString()}</span>
        </div>
        <div style="font-size:0.8rem; color: var(--color-teal); font-weight:700; margin-top:0.25rem;">
          <a href="mailto:${msg.email}" onclick="event.stopPropagation();" style="color:inherit;">${escapeHtml(msg.email || '')}</a>
        </div>
        <div style="font-size:0.85rem; color: var(--color-text); margin-top:0.5rem; white-space: pre-wrap;">${escapeHtml(msg.message || '')}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadContactMessages error:', err);
    list.innerHTML = `<p style="color:#DC2626;">Mesajlar yüklenemedi.</p>`;
  }
}

async function toggleMessageRead(id, currentlyRead) {
  if (currentlyRead) return;
  try {
    await supabaseClient.from('contact_messages').update({ is_read: true }).eq('id', id);
    loadContactMessages();
  } catch (err) {
    console.error('toggleMessageRead error:', err);
  }
}
window.toggleMessageRead = toggleMessageRead;

// ==========================================
// CONTENT & SUPPORT — shared study card moderation
// ==========================================
async function loadSharedCardsModeration() {
  const tbody = document.getElementById('admin-shared-cards-tbody');
  if (!tbody) return;
  try {
    const { data, error } = await supabaseClient
      .from('study_cards')
      .select('id, department, shared_at, documents(file_name)')
      .eq('is_shared', true)
      .order('shared_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Paylaşılan kart yok.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(c => `
      <tr id="admin-card-row-${c.id}">
        <td>${escapeHtml(c.documents?.file_name || 'İsimsiz belge')}</td>
        <td>${escapeHtml(c.department || '—')}</td>
        <td>${c.shared_at ? new Date(c.shared_at).toLocaleDateString() : '—'}</td>
        <td style="text-align:right;"><button class="admin-mini-btn danger" onclick="removeSharedCard('${c.id}')">Kaldır</button></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('loadSharedCardsModeration error:', err);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: #DC2626;">Yüklenemedi.</td></tr>`;
  }
}

async function removeSharedCard(cardId) {
  if (!window.confirm('Bu kartı bölüm akışından/paylaşımdan kaldırmak istiyor musunuz?')) return;
  try {
    const { error } = await supabaseClient.from('study_cards').update({ is_shared: false, shared_at: null }).eq('id', cardId);
    if (error) throw error;
    const row = document.getElementById(`admin-card-row-${cardId}`);
    if (row) row.remove();
    showAdminAlert('success', 'Kart paylaşımdan kaldırıldı.');
  } catch (err) {
    console.error('removeSharedCard error:', err);
    showAdminAlert('error', 'İşlem başarısız: ' + (err.message || ''));
  }
}
window.removeSharedCard = removeSharedCard;

// ==========================================
// SETTINGS — maintenance mode + site banner
// ==========================================
async function loadSiteSettings() {
  try {
    const { data, error } = await supabaseClient.from('site_settings').select('*');
    if (error) throw error;

    const maintenance = (data || []).find(s => s.key === 'maintenance_mode')?.value || {};
    const banner = (data || []).find(s => s.key === 'site_banner')?.value || {};

    const mToggle = document.getElementById('admin-maintenance-toggle');
    const mMsg = document.getElementById('admin-maintenance-msg');
    const bToggle = document.getElementById('admin-banner-toggle');
    const bMsg = document.getElementById('admin-banner-msg');

    if (mToggle) mToggle.checked = !!maintenance.enabled;
    if (mMsg) mMsg.value = maintenance.message || '';
    if (bToggle) bToggle.checked = !!banner.enabled;
    if (bMsg) bMsg.value = banner.message || '';
  } catch (err) {
    console.error('loadSiteSettings error:', err);
    showAdminAlert('error', 'Ayarlar yüklenemedi. site_settings tablosunun migration ile oluşturulduğundan emin olun.');
  }
}

async function saveSiteSettings() {
  try {
    const maintenanceValue = {
      enabled: document.getElementById('admin-maintenance-toggle').checked,
      message: document.getElementById('admin-maintenance-msg').value.trim()
    };
    const bannerValue = {
      enabled: document.getElementById('admin-banner-toggle').checked,
      message: document.getElementById('admin-banner-msg').value.trim()
    };

    const { error } = await supabaseClient.from('site_settings').upsert([
      { key: 'maintenance_mode', value: maintenanceValue, updated_at: new Date().toISOString(), updated_by: adminProfile.id },
      { key: 'site_banner', value: bannerValue, updated_at: new Date().toISOString(), updated_by: adminProfile.id }
    ]);
    if (error) throw error;
    showAdminAlert('success', 'Ayarlar kaydedildi.');
  } catch (err) {
    console.error('saveSiteSettings error:', err);
    showAdminAlert('error', 'Kaydedilemedi: ' + (err.message || ''));
  }
}
window.saveSiteSettings = saveSiteSettings;

// ==========================================
// SETTINGS — announcements CRUD
// ==========================================
function openAnnouncementForm() {
  const form = document.getElementById('admin-announcement-form');
  if (form) form.style.display = 'block';
}
window.openAnnouncementForm = openAnnouncementForm;

function closeAnnouncementForm() {
  const form = document.getElementById('admin-announcement-form');
  if (form) form.style.display = 'none';
  document.getElementById('ann-title').value = '';
  document.getElementById('ann-body').value = '';
  document.getElementById('ann-department').value = '';
  document.getElementById('ann-starts-at').value = '';
  document.getElementById('ann-ends-at').value = '';
}
window.closeAnnouncementForm = closeAnnouncementForm;

async function submitAnnouncement() {
  const title = document.getElementById('ann-title').value.trim();
  const body = document.getElementById('ann-body').value.trim();
  const dept = document.getElementById('ann-department').value || null;
  const startsAtRaw = document.getElementById('ann-starts-at').value;
  const endsAtRaw = document.getElementById('ann-ends-at').value;

  if (!title || !body) {
    showAdminAlert('error', 'Başlık ve metin zorunludur.');
    return;
  }
  if (startsAtRaw && endsAtRaw && new Date(endsAtRaw) <= new Date(startsAtRaw)) {
    showAdminAlert('error', 'Bitiş tarihi başlangıçtan sonra olmalı.');
    return;
  }

  try {
    const { error } = await supabaseClient.from('announcements').insert({
      title, body,
      audience_department: dept,
      created_by: adminProfile.id,
      created_by_role: 'admin',
      starts_at: startsAtRaw ? new Date(startsAtRaw).toISOString() : null,
      ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null
    });
    if (error) throw error;
    closeAnnouncementForm();
    loadAnnouncements();
    showAdminAlert('success', 'Duyuru yayınlandı.');
  } catch (err) {
    console.error('submitAnnouncement error:', err);
    showAdminAlert('error', 'Duyuru oluşturulamadı: ' + (err.message || ''));
  }
}
window.submitAnnouncement = submitAnnouncement;

async function loadAnnouncements() {
  const list = document.getElementById('admin-announcements-list');
  if (!list) return;
  try {
    const { data, error } = await supabaseClient
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding: 1.5rem; color: var(--color-text-muted);">Henüz duyuru yok.</div>`;
      return;
    }

    list.innerHTML = data.map(a => `
      <div style="border: 1px solid rgba(22,50,92,0.08); border-radius: var(--radius-sm); padding: 0.85rem 1rem; ${a.active ? '' : 'opacity: 0.5;'}">
        <div style="display:flex; justify-content: space-between; align-items:flex-start; gap: 0.5rem; flex-wrap: wrap;">
          <strong style="color: var(--color-navy); font-size: 0.9rem;">${escapeHtml(a.title)}</strong>
          <span style="font-size: 0.7rem; color: var(--color-text-muted);">${a.audience_department ? escapeHtml(a.audience_department) : 'Tüm bölümler'} · ${a.created_by_role === 'teacher' ? 'Hoca' : 'Admin'}</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--color-text); margin-top: 0.35rem;">${escapeHtml(a.body)}</p>
        ${(a.starts_at || a.ends_at) ? `<p style="font-size: 0.7rem; color: var(--color-text-muted); margin-top: 0.3rem;">🕓 ${a.starts_at ? new Date(a.starts_at).toLocaleString() : 'şimdi'} → ${a.ends_at ? new Date(a.ends_at).toLocaleString() : 'süresiz'}</p>` : ''}
        <div style="margin-top: 0.5rem; display:flex; gap: 0.5rem;">
          <button class="admin-mini-btn" onclick="toggleAnnouncementActive('${a.id}', ${!a.active})">${a.active ? 'Pasifleştir' : 'Aktifleştir'}</button>
          <button class="admin-mini-btn danger" onclick="deleteAnnouncement('${a.id}')">Sil</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadAnnouncements error:', err);
    list.innerHTML = `<p style="color:#DC2626;">Duyurular yüklenemedi.</p>`;
  }
}

async function toggleAnnouncementActive(id, active) {
  try {
    await supabaseClient.from('announcements').update({ active }).eq('id', id);
    loadAnnouncements();
  } catch (err) {
    console.error('toggleAnnouncementActive error:', err);
  }
}
window.toggleAnnouncementActive = toggleAnnouncementActive;

async function deleteAnnouncement(id) {
  if (!window.confirm('Bu duyuruyu silmek istiyor musunuz?')) return;
  try {
    await supabaseClient.from('announcements').delete().eq('id', id);
    loadAnnouncements();
  } catch (err) {
    console.error('deleteAnnouncement error:', err);
  }
}
window.deleteAnnouncement = deleteAnnouncement;

// ==========================================================================
// DERS KATALOĞU (COURSE CATALOG) — CRUD + content-gap report over
// public.departments / public.courses (seeded by
// supabase/migrations/20260721_add_course_catalog.sql). These are the same
// tables the AI course-detection (summarize-document / merge-summarize edge
// functions) and the student-facing ders-agaci.html page read from, so
// changes here take effect everywhere immediately — no redeploy needed.
// ==========================================================================
let catalogDepartments = [];
let catalogCourses = [];
let catalogCardCounts = {};

function catalogDeptColorClass(code) {
  const map = { MIS: 'dept-mis', BUS: 'dept-ba', ITB: 'dept-itb', BF: 'dept-bf' };
  return map[code] || '';
}

async function loadCourseCatalog() {
  const tbody = document.getElementById('admin-catalog-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Yükleniyor...</td></tr>`;

  try {
    const { data: departments, error: deptErr } = await supabaseClient
      .from('departments')
      .select('code, name, name_tr')
      .order('name');
    if (deptErr) throw deptErr;

    const { data: courses, error: coursesErr } = await supabaseClient
      .from('courses')
      .select('id, department_code, course_code, course_name, year_level')
      .order('department_code')
      .order('course_code');
    if (coursesErr) throw coursesErr;

    catalogDepartments = departments || [];
    catalogCourses = courses || [];

    // Count shared study cards per course_code (case-insensitive), across all
    // departments at once — same approach as js/course-tree.js.
    const { data: sharedCards, error: cardsErr } = await supabaseClient
      .from('study_cards')
      .select('course_tag')
      .eq('is_shared', true)
      .not('course_tag', 'is', null);
    if (cardsErr) console.warn('Could not load shared card counts for catalog:', cardsErr);

    catalogCardCounts = {};
    (sharedCards || []).forEach(c => {
      const key = (c.course_tag || '').trim().toUpperCase();
      if (!key) return;
      catalogCardCounts[key] = (catalogCardCounts[key] || 0) + 1;
    });

    populateCatalogDeptSelects();
    renderCatalogStats();
    renderCatalogTable();
    renderCatalogGapReport();
  } catch (err) {
    console.error('loadCourseCatalog error:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #DC2626;">Ders kataloğu yüklenemedi. Migration (supabase/migrations/20260721_add_course_catalog.sql) çalıştırılmış mı?</td></tr>`;
  }
}
window.loadCourseCatalog = loadCourseCatalog;

function populateCatalogDeptSelects() {
  const newDeptSelect = document.getElementById('cat-new-dept');
  const filterDeptSelect = document.getElementById('cat-filter-dept');

  if (newDeptSelect) {
    newDeptSelect.innerHTML = catalogDepartments
      .map(d => `<option value="${d.code}">${escapeHtml(d.name_tr || d.name)} (${d.code})</option>`)
      .join('');
  }
  if (filterDeptSelect) {
    const currentVal = filterDeptSelect.value || 'all';
    filterDeptSelect.innerHTML = '<option value="all">Tüm Bölümler</option>' +
      catalogDepartments.map(d => `<option value="${d.code}">${escapeHtml(d.name_tr || d.name)} (${d.code})</option>`).join('');
    if ([...filterDeptSelect.options].some(o => o.value === currentVal)) filterDeptSelect.value = currentVal;
  }
}

function renderCatalogStats() {
  const grid = document.getElementById('admin-catalog-stat-grid');
  if (!grid) return;

  const total = catalogCourses.length;
  const withCards = catalogCourses.filter(c => (catalogCardCounts[c.course_code.toUpperCase()] || 0) > 0).length;
  const totalCards = catalogCourses.reduce((sum, c) => sum + (catalogCardCounts[c.course_code.toUpperCase()] || 0), 0);

  const stat = (value, label, color) => `
    <div class="admin-stat-card">
      <div>
        <div style="font-size:1.5rem; font-weight:800; color:${color || 'var(--color-navy)'};">${value}</div>
        <div style="font-size:0.75rem; color:var(--color-text-muted); font-weight:600;">${label}</div>
      </div>
    </div>`;

  grid.innerHTML =
    stat(catalogDepartments.length, 'Bölüm') +
    stat(total, 'Toplam Ders') +
    stat(withCards, 'Özeti Olan Ders') +
    stat(total - withCards, 'Boşluk (Özetsiz Ders)', '#DC2626') +
    stat(totalCards, 'Paylaşılan Özet');
}

function renderCatalogTable() {
  const tbody = document.getElementById('admin-catalog-tbody');
  if (!tbody) return;

  const deptFilter = document.getElementById('cat-filter-dept')?.value || 'all';
  const rows = catalogCourses.filter(c => deptFilter === 'all' || c.department_code === deptFilter);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Bu filtrede ders yok.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(c => {
    const count = catalogCardCounts[c.course_code.toUpperCase()] || 0;
    return `
    <tr data-course-id="${c.id}">
      <td><span class="dept-badge ${catalogDeptColorClass(c.department_code)}">${escapeHtml(c.department_code)}</span></td>
      <td><strong>${escapeHtml(c.course_code)}</strong></td>
      <td class="cat-name-cell">${escapeHtml(c.course_name)}</td>
      <td class="cat-year-cell" data-year="${c.year_level || ''}">${c.year_level ? c.year_level + '. Sınıf' : '—'}</td>
      <td style="text-align:right;">${count > 0 ? `📚 ${count}` : '<span style="color: var(--color-text-muted);">0</span>'}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="admin-mini-btn" onclick="startEditCatalogCourse('${c.id}')">Düzenle</button>
        <button class="admin-mini-btn danger" onclick="deleteCatalogCourse('${c.id}', '${c.course_code}')">Sil</button>
      </td>
    </tr>
  `;
  }).join('');
}
window.renderCatalogTable = renderCatalogTable;

function renderCatalogGapReport() {
  const list = document.getElementById('admin-catalog-gap-list');
  if (!list) return;

  const gapCourses = catalogCourses.filter(c => (catalogCardCounts[c.course_code.toUpperCase()] || 0) === 0);

  if (gapCourses.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding: 1.5rem; color: var(--color-text-muted);">Harika! Kataloğdaki tüm derslerde en az bir paylaşılan özet var.</div>`;
    return;
  }

  const byDept = {};
  gapCourses.forEach(c => {
    if (!byDept[c.department_code]) byDept[c.department_code] = [];
    byDept[c.department_code].push(c);
  });

  list.innerHTML = Object.keys(byDept).sort().map(deptCode => `
    <div style="border: 1px solid rgba(22,50,92,0.08); border-radius: var(--radius-sm); padding: 0.65rem 0.9rem;">
      <span class="dept-badge ${catalogDeptColorClass(deptCode)}">${escapeHtml(deptCode)}</span>
      <span style="font-size: 0.8rem; color: var(--color-text-muted); margin-left: 0.5rem;">${byDept[deptCode].map(c => escapeHtml(c.course_code)).join(', ')}</span>
    </div>
  `).join('');
}

async function addCatalogCourse() {
  const dept = document.getElementById('cat-new-dept')?.value;
  const code = document.getElementById('cat-new-code')?.value.trim().toUpperCase();
  const name = document.getElementById('cat-new-name')?.value.trim().toUpperCase();
  const year = parseInt(document.getElementById('cat-new-year')?.value, 10);

  if (!dept || !code || !name) {
    showAdminAlert('error', 'Bölüm, ders kodu ve ders adı zorunludur.');
    return;
  }

  try {
    const { error } = await supabaseClient.from('courses').insert({
      department_code: dept,
      course_code: code,
      course_name: name,
      year_level: year || null
    });
    if (error) throw error;

    document.getElementById('cat-new-code').value = '';
    document.getElementById('cat-new-name').value = '';
    showAdminAlert('success', `${code} kataloğa eklendi.`);
    loadCourseCatalog();
  } catch (err) {
    console.error('addCatalogCourse error:', err);
    const msg = (err && err.code === '23505') ? 'Bu ders kodu zaten kayıtlı.' : 'Ders eklenirken bir hata oluştu.';
    showAdminAlert('error', msg);
  }
}
window.addCatalogCourse = addCatalogCourse;

function startEditCatalogCourse(id) {
  const row = document.querySelector(`tr[data-course-id="${id}"]`);
  if (!row) return;
  const course = catalogCourses.find(c => c.id === id);
  if (!course) return;

  const nameCell = row.querySelector('.cat-name-cell');
  const yearCell = row.querySelector('.cat-year-cell');
  const actionsCell = row.querySelector('td:last-child');

  nameCell.innerHTML = `<input type="text" class="cat-edit-name" value="${escapeHtml(course.course_name)}" style="width:100%; padding:0.3rem 0.5rem; border:1px solid rgba(22,50,92,0.15); border-radius:4px; font-size:0.8rem;">`;
  yearCell.innerHTML = `
    <select class="cat-edit-year" style="padding:0.3rem 0.4rem; border:1px solid rgba(22,50,92,0.15); border-radius:4px; font-size:0.8rem;">
      ${[1, 2, 3, 4].map(y => `<option value="${y}" ${y === course.year_level ? 'selected' : ''}>${y}. Sınıf</option>`).join('')}
    </select>
  `;
  actionsCell.innerHTML = `
    <button class="admin-mini-btn primary" onclick="saveCatalogCourse('${id}')">Kaydet</button>
    <button class="admin-mini-btn" onclick="renderCatalogTable()">Vazgeç</button>
  `;
}
window.startEditCatalogCourse = startEditCatalogCourse;

async function saveCatalogCourse(id) {
  const row = document.querySelector(`tr[data-course-id="${id}"]`);
  if (!row) return;
  const newName = row.querySelector('.cat-edit-name')?.value.trim().toUpperCase();
  const newYear = parseInt(row.querySelector('.cat-edit-year')?.value, 10);

  if (!newName) {
    showAdminAlert('error', 'Ders adı boş olamaz.');
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('courses')
      .update({ course_name: newName, year_level: newYear || null })
      .eq('id', id);
    if (error) throw error;
    showAdminAlert('success', 'Ders güncellendi.');
    loadCourseCatalog();
  } catch (err) {
    console.error('saveCatalogCourse error:', err);
    showAdminAlert('error', 'Ders güncellenirken bir hata oluştu.');
  }
}
window.saveCatalogCourse = saveCatalogCourse;

async function deleteCatalogCourse(id, code) {
  if (!window.confirm(`${code} dersini kataloğdan silmek istediğinize emin misiniz? Bu, mevcut özetlerdeki course_tag değerlerini etkilemez, sadece kataloğdan (Ders Ağacı / AI önerileri) kaldırır.`)) return;
  try {
    const { error } = await supabaseClient.from('courses').delete().eq('id', id);
    if (error) throw error;
    showAdminAlert('success', `${code} kataloğdan silindi.`);
    loadCourseCatalog();
  } catch (err) {
    console.error('deleteCatalogCourse error:', err);
    showAdminAlert('error', 'Ders silinirken bir hata oluştu.');
  }
}
window.deleteCatalogCourse = deleteCatalogCourse;

// ==========================================
// KİTAP TARAMA — admin-only full-book knowledge ingestion.
// Upload a real textbook/lecture-notes PDF for a catalog course; it's split
// into page-range chunks and processed a few at a time (progress bar polled
// in a loop), then merged into course_knowledge_index — the most
// trustworthy grounding source generate-exam can use for that course. See
// supabase/migrations/20260829_add_course_knowledge_base.sql and the
// admin-ingest-course-pdf / admin-process-course-knowledge edge functions.
// ==========================================
let akDepartments = [];
let akCourses = [];
let akDocuments = [];
let akKnowledgeIndex = {}; // course_code -> { chunk_count, ai_summary, ai_summary_generated_at }
let akPollingDocumentId = null; // guards against overlapping polling loops

// "Failed to fetch" (a bare browser TypeError, not an HTTP error status)
// almost always means one of two things here: a transient network blip, or
// — far more commonly in practice — the target Edge Function was never
// deployed, so Supabase's own routing returns a 404 with none of OUR CORS
// headers attached (our code always sends corsHeaders, even on error
// responses, so a truly deployed function of ours never triggers this).
// Rather than let that cryptic message reach the admin (as it did during
// Kitap Tarama's Global Business textbook scan), retry a couple of times in
// case it was transient, then fail with a message that names the exact
// fonksiyon and the exact command to fix it.
async function callAdminEdgeFunction(functionName, body, retries = 2) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Oturum bulunamadı.');

  const SUPABASE_URL_LOCAL = supabaseClient.supabaseUrl;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let response;
    try {
      response = await fetch(`${SUPABASE_URL_LOCAL}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
    } catch (networkErr) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw new Error(`"${functionName}" fonksiyonuna ulaşılamadı (ağ hatası). Bu genellikle fonksiyonun henüz deploy edilmediği anlamına gelir. Terminalde şunu çalıştırıp tekrar deneyin: supabase functions deploy ${functionName}`);
    }

    let result;
    try {
      result = await response.json();
    } catch (parseErr) {
      // A response with no valid JSON body (Supabase's own 404/500 routing
      // page, not our function's code) — same root cause as above.
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw new Error(`"${functionName}" fonksiyonundan geçerli bir yanıt alınamadı (HTTP ${response.status}). Fonksiyon deploy edilmemiş olabilir. Terminalde şunu çalıştırıp tekrar deneyin: supabase functions deploy ${functionName}`);
    }

    if (!response.ok) {
      // A 5xx here is usually Supabase's own infrastructure hiccuping
      // (cold start, transient DB blip) rather than a real application
      // error — retry it the same as a network failure instead of
      // aborting a long-running batch scan over one transient blip.
      if (response.status >= 500 && attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw new Error(result.error || 'İşlem başarısız.');
    }
    return result;
  }
}

async function loadKnowledgeBase() {
  const tbody = document.getElementById('admin-knowledge-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Yükleniyor...</td></tr>`;

  try {
    const { data: departments, error: deptErr } = await supabaseClient
      .from('departments')
      .select('code, name, name_tr')
      .order('name');
    if (deptErr) throw deptErr;

    const { data: courses, error: coursesErr } = await supabaseClient
      .from('courses')
      .select('course_code, course_name, department_code')
      .order('department_code')
      .order('course_code');
    if (coursesErr) throw coursesErr;

    akDepartments = departments || [];
    akCourses = courses || [];

    const deptSelect = document.getElementById('ak-upload-dept');
    const filterSelect = document.getElementById('ak-filter-dept');
    if (deptSelect) {
      deptSelect.innerHTML = akDepartments.map(d => `<option value="${d.code}">${escapeHtml(d.name_tr || d.name)} (${d.code})</option>`).join('');
    }
    if (filterSelect) {
      const currentVal = filterSelect.value || 'all';
      filterSelect.innerHTML = '<option value="all">Tüm Bölümler</option>' +
        akDepartments.map(d => `<option value="${d.code}">${escapeHtml(d.name_tr || d.name)} (${d.code})</option>`).join('');
      if ([...filterSelect.options].some(o => o.value === currentVal)) filterSelect.value = currentVal;
    }
    akOnDeptChange();

    const { data: docs, error: docsErr } = await supabaseClient
      .from('course_knowledge_documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (docsErr) throw docsErr;

    akDocuments = docs || [];

    // Loaded separately (not joined) so a missing/not-yet-migrated
    // ai_summary column or an empty course_knowledge_index table degrades
    // gracefully to "no summary yet" everywhere instead of breaking the
    // whole Kitap Tarama table.
    akKnowledgeIndex = {};
    try {
      const { data: indexRows, error: indexErr } = await supabaseClient
        .from('course_knowledge_index')
        .select('course_code, chunk_count, ai_summary, ai_summary_generated_at');
      if (indexErr) throw indexErr;
      (indexRows || []).forEach(row => { akKnowledgeIndex[row.course_code] = row; });
    } catch (indexLoadErr) {
      console.error('course_knowledge_index load error (Resmi Özet düğmeleri gizlenecek):', indexLoadErr);
    }

    renderKnowledgeDocsTable();
  } catch (err) {
    console.error('loadKnowledgeBase error:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: #DC2626;">Yüklenemedi. Migration (supabase/migrations/20260829_add_course_knowledge_base.sql) çalıştırılmış mı?</td></tr>`;
  }
}
window.loadKnowledgeBase = loadKnowledgeBase;

function akOnDeptChange() {
  const deptSelect = document.getElementById('ak-upload-dept');
  const courseSelect = document.getElementById('ak-upload-course');
  if (!deptSelect || !courseSelect) return;
  const deptCode = deptSelect.value;
  const filtered = akCourses.filter(c => c.department_code === deptCode);
  courseSelect.innerHTML = filtered.map(c => `<option value="${c.course_code}">${escapeHtml(c.course_code)} — ${escapeHtml(c.course_name)}</option>`).join('');
}
window.akOnDeptChange = akOnDeptChange;

function renderKnowledgeDocsTable() {
  const tbody = document.getElementById('admin-knowledge-tbody');
  if (!tbody) return;

  const filterDept = document.getElementById('ak-filter-dept')?.value || 'all';
  const courseByCode = {};
  akCourses.forEach(c => { courseByCode[c.course_code] = c; });

  const visible = akDocuments.filter(d => {
    if (filterDept === 'all') return true;
    const course = courseByCode[d.course_code];
    return course && course.department_code === filterDept;
  });

  if (visible.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Henüz hiç kaynak yüklenmemiş.</td></tr>`;
    return;
  }

  const statusLabels = {
    pending: '⏳ Bekliyor',
    extracting: '📖 Metin çıkarılıyor...',
    processing: '⚙️ İşleniyor',
    completed: '✅ Tamamlandı',
    failed: '❌ Başarısız'
  };

  // Track which courses have already had their "Resmi Özet" controls
  // rendered — a course can have more than one uploaded document, but the
  // summary itself lives once per course (course_knowledge_index), so only
  // show it on that course's first row to avoid repeating it per document.
  const summaryControlsShownFor = new Set();

  tbody.innerHTML = visible.map(d => {
    const course = courseByCode[d.course_code];
    const courseLabel = course ? `${course.course_code} — ${escapeHtml(course.course_name)}` : escapeHtml(d.course_code);
    const canResume = d.status === 'processing' || d.status === 'pending' || d.status === 'extracting';
    // A document can finish (no 'pending' chunks left) while some chunks
    // permanently failed (e.g. exhausted their Groq rate-limit retries) —
    // it still shows as 'completed' but processed_chunks < total_chunks.
    // Surface that plainly and offer a one-click way to requeue just the
    // failed ones, rather than silently under-reporting the book as "done".
    const failedCount = d.status === 'completed' ? Math.max(0, (d.total_chunks || 0) - (d.processed_chunks || 0)) : 0;
    const progressLabel = d.total_chunks > 0
      ? `${d.processed_chunks} / ${d.total_chunks} parça${failedCount > 0 ? ` (${failedCount} başarısız)` : ''}`
      : '—';

    // "Resmi Özet Oluştur/Yenile" — only offered once the course actually
    // has a scanned knowledge base (chunk_count > 0), same gate
    // admin-generate-course-summary itself enforces server-side.
    let summaryButtonsHtml = '';
    const indexRow = akKnowledgeIndex[d.course_code];
    if (indexRow && indexRow.chunk_count > 0 && !summaryControlsShownFor.has(d.course_code)) {
      summaryControlsShownFor.add(d.course_code);
      const hasSummary = !!indexRow.ai_summary_generated_at;
      summaryButtonsHtml = `
        ${hasSummary ? `<button class="admin-mini-btn" onclick="akViewCourseSummary('${d.course_code}')" title="Öğrencilerin göreceği mevcut özeti görüntüle">👁 Özeti Gör</button>` : ''}
        <button class="admin-mini-btn primary" id="ak-summary-btn-${d.course_code}" onclick="akGenerateCourseSummary('${d.course_code}')" title="${hasSummary ? 'Özeti yeniden oluştur (mevcut özetin üzerine yazar)' : 'Bu ders için öğrencilere gösterilecek resmi bir özet oluştur'}">📄 ${hasSummary ? 'Özeti Yenile' : 'Resmi Özet Oluştur'}</button>
      `;
    }

    return `
      <tr>
        <td>${courseLabel}</td>
        <td title="${escapeHtml(d.file_name)}" style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(d.file_name)}</td>
        <td>${statusLabels[d.status] || d.status}${d.status === 'failed' && d.error_message ? ` <span style="color:#DC2626; font-size:0.7rem;" title="${escapeHtml(d.error_message)}">ⓘ</span>` : ''}</td>
        <td>${progressLabel}</td>
        <td style="text-align:right; white-space:nowrap;">
          ${canResume ? `<button class="admin-mini-btn primary" onclick="akResumeProcessing('${d.id}')">Devam Et</button>` : ''}
          ${failedCount > 0 ? `<button class="admin-mini-btn primary" onclick="akRetryFailedChunks('${d.id}')" title="${failedCount} başarısız parçayı yeniden dene">🔁 Tekrar Dene</button>` : ''}
          ${summaryButtonsHtml}
          <button class="admin-mini-btn" onclick="akResyncCourse('${d.course_code}')" title="Bu dersin bilgi tabanını yeniden hesapla">🔄</button>
          <button class="admin-mini-btn danger" onclick="akDeleteDocument('${d.id}', '${d.course_code}')">Sil</button>
        </td>
      </tr>
    `;
  }).join('');
}
window.renderKnowledgeDocsTable = renderKnowledgeDocsTable;

async function akUploadPdf() {
  const courseSelect = document.getElementById('ak-upload-course');
  const fileInput = document.getElementById('ak-upload-file');
  const statusEl = document.getElementById('ak-upload-status');
  const btn = document.getElementById('ak-upload-btn');

  const courseCode = courseSelect?.value;
  const file = fileInput?.files?.[0];

  if (!courseCode) {
    showAdminAlert('error', 'Lütfen bir ders seçin.');
    return;
  }
  if (!file) {
    showAdminAlert('error', 'Lütfen bir PDF dosyası seçin.');
    return;
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showAdminAlert('error', 'Sadece PDF dosyaları desteklenir.');
    return;
  }

  const originalText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Yükleniyor...'; }
  if (statusEl) { statusEl.textContent = 'PDF depoya yükleniyor...'; statusEl.style.color = 'var(--color-text-muted)'; }

  try {
    const storagePath = `${courseCode}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabaseClient.storage
      .from('course-knowledge-pdfs')
      .upload(storagePath, file);
    if (uploadErr) throw uploadErr;

    if (statusEl) statusEl.textContent = 'PDF içindeki metin çıkarılıyor (büyük kitaplarda birkaç parça halinde yapılır)...';

    // This first call creates the document row AND does the first
    // extraction batch (a bounded page window, not the whole book at once
    // — see admin-ingest-course-pdf's comments for why that used to crash
    // on real large textbooks). akUploadAndScan below keeps calling it with
    // { documentId } to continue exactly where this call left off.
    const ingestResult = await callAdminEdgeFunction('admin-ingest-course-pdf', {
      courseCode, storagePath, fileName: file.name
    });

    if (statusEl) statusEl.textContent = '';
    if (fileInput) fileInput.value = '';
    showAdminAlert('success', `PDF yüklendi (${ingestResult.totalPages || '?'} sayfa tespit edildi). Taranmaya başlanıyor...`);

    await loadKnowledgeBase();
    akUploadAndScan(ingestResult.documentId, file.name);
  } catch (err) {
    console.error('akUploadPdf error:', err);
    if (statusEl) { statusEl.textContent = err.message || 'Yükleme başarısız oldu.'; statusEl.style.color = '#DC2626'; }
    showAdminAlert('error', err.message || 'PDF yüklenirken bir hata oluştu.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}
window.akUploadPdf = akUploadPdf;

async function akResumeProcessing(documentId) {
  const doc = akDocuments.find(d => d.id === documentId);
  const fileName = doc ? doc.file_name : 'Belge';
  // A document interrupted mid-extraction (status still 'extracting') needs
  // to resume the page-extraction loop first; one that already finished
  // extraction (status 'processing'/'pending') only needs the AI step.
  if (doc && doc.status === 'extracting') {
    akUploadAndScan(documentId, fileName);
  } else {
    akStartPolling(documentId, fileName, doc ? doc.total_chunks : 0);
  }
}
window.akResumeProcessing = akResumeProcessing;

// Phase 1: keeps calling admin-ingest-course-pdf with { documentId } until
// every page of the PDF has been extracted into chunks. Does NOT manage
// the akPollingDocumentId busy-guard itself — the caller (akUploadAndScan /
// akStartPolling) owns that, since this loop is also called back-to-back
// with the processing loop for one continuous upload.
async function akRunExtractionLoop(documentId, fileName) {
  const progressCard = document.getElementById('ak-progress-card');
  const progressFilename = document.getElementById('ak-progress-filename');
  const progressBar = document.getElementById('ak-progress-bar');
  const progressText = document.getElementById('ak-progress-text');

  if (progressCard) progressCard.style.display = 'block';
  if (progressFilename) progressFilename.textContent = fileName;

  let done = false;
  while (!done) {
    const result = await callAdminEdgeFunction('admin-ingest-course-pdf', { documentId });
    done = !!result.done;
    const pct = result.totalPages > 0 ? Math.round((result.extractedPages / result.totalPages) * 100) : 0;
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `📖 Metin çıkarılıyor: ${result.extractedPages} / ${result.totalPages} sayfa (%${pct})`;

    const docInList = akDocuments.find(d => d.id === documentId);
    if (docInList) {
      docInList.total_pages = result.totalPages;
      docInList.total_chunks = result.totalChunks;
      docInList.status = 'extracting';
      renderKnowledgeDocsTable();
    }
  }
}

// Phase 2: keeps calling admin-process-course-knowledge with { documentId }
// until every extracted chunk has been through the AI step. Same
// guard-free design as akRunExtractionLoop above.
// Groq's free-tier quota for the model we use (gpt-oss-120b) is only 8,000
// tokens/minute and 30 requests/minute, shared across the WHOLE app —
// every student's exam generation and grading draws from this same pool.
// The edge function processes exactly ONE chunk per call now (see
// CHUNK_BATCH_SIZE in admin-process-course-knowledge), so THIS wait,
// between successive calls, is what actually paces the whole book scan to
// stay under that shared budget — without it, this loop would fire calls
// back-to-back as fast as the network allows and blow through the
// per-minute limit within seconds, exactly what caused most of a real
// 169-chunk book to get silently rate-limited and marked 'failed' before
// this fix.
const AK_PROCESSING_PACE_MS = 20000;

async function akRunProcessingLoop(documentId, fileName) {
  const progressBar = document.getElementById('ak-progress-bar');
  const progressText = document.getElementById('ak-progress-text');

  let done = false;
  let isFirstCall = true;
  while (!done) {
    if (!isFirstCall) await new Promise(r => setTimeout(r, AK_PROCESSING_PACE_MS));
    isFirstCall = false;

    const result = await callAdminEdgeFunction('admin-process-course-knowledge', { documentId });
    done = !!result.done;
    const pct = result.totalChunks > 0 ? Math.round((result.processedTotal / result.totalChunks) * 100) : 0;
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `⚙️ ${result.processedTotal} / ${result.totalChunks} parça işlendi (%${pct}) — Groq'un ücretsiz kotasını aşmamak için yavaş ilerliyor, sekmeyi açık bırakabilirsiniz.`;

    const docInList = akDocuments.find(d => d.id === documentId);
    if (docInList) {
      docInList.processed_chunks = result.processedTotal;
      docInList.status = result.documentStatus;
      renderKnowledgeDocsTable();
    }
  }
}

// Full pipeline for a freshly uploaded (or resumed, still-'extracting')
// document: extraction loop, then the AI-processing loop, back to back
// under a single busy-guard so no other upload can start concurrently.
async function akUploadAndScan(documentId, fileName) {
  if (akPollingDocumentId) {
    showAdminAlert('error', 'Şu anda başka bir belge taranıyor. Lütfen bitmesini bekleyin.');
    return;
  }
  akPollingDocumentId = documentId;

  const progressCard = document.getElementById('ak-progress-card');
  const progressText = document.getElementById('ak-progress-text');

  try {
    await akRunExtractionLoop(documentId, fileName);
    await akRunProcessingLoop(documentId, fileName);

    if (progressText) progressText.textContent = 'Tamamlandı ✅ — bilgi tabanı güncellendi.';
    showAdminAlert('success', `"${fileName}" başarıyla tarandı ve derse eklendi.`);
    setTimeout(() => { if (progressCard) progressCard.style.display = 'none'; }, 4000);
  } catch (err) {
    console.error('akUploadAndScan error:', err);
    if (progressText) progressText.textContent = `Hata: ${err.message || 'İşlem sırasında bir sorun oluştu.'}`;
    showAdminAlert('error', 'Tarama sırasında bir hata oluştu. "Devam Et" ile tekrar deneyebilirsiniz.');
  } finally {
    akPollingDocumentId = null;
    await loadKnowledgeBase();
  }
}

// Used when a document has ALREADY finished extraction (status
// 'processing'/'pending') and only the AI-processing step needs to
// (re)run — e.g. resuming after an interruption during that later phase.
async function akStartPolling(documentId, fileName, totalChunks) {
  if (akPollingDocumentId) {
    showAdminAlert('error', 'Şu anda başka bir belge taranıyor. Lütfen bitmesini bekleyin.');
    return;
  }
  akPollingDocumentId = documentId;

  const progressCard = document.getElementById('ak-progress-card');
  const progressFilename = document.getElementById('ak-progress-filename');
  const progressText = document.getElementById('ak-progress-text');

  if (progressCard) progressCard.style.display = 'block';
  if (progressFilename) progressFilename.textContent = fileName;

  try {
    await akRunProcessingLoop(documentId, fileName);

    if (progressText) progressText.textContent = 'Tamamlandı ✅ — bilgi tabanı güncellendi.';
    showAdminAlert('success', `"${fileName}" başarıyla tarandı ve derse eklendi.`);
    setTimeout(() => { if (progressCard) progressCard.style.display = 'none'; }, 4000);
  } catch (err) {
    console.error('akStartPolling error:', err);
    if (progressText) progressText.textContent = `Hata: ${err.message || 'İşlem sırasında bir sorun oluştu.'}`;
    showAdminAlert('error', 'Tarama sırasında bir hata oluştu. "Devam Et" ile tekrar deneyebilirsiniz.');
  } finally {
    akPollingDocumentId = null;
    await loadKnowledgeBase();
  }
}

async function akRetryFailedChunks(documentId) {
  const doc = akDocuments.find(d => d.id === documentId);
  const fileName = doc ? doc.file_name : 'Belge';
  try {
    await callAdminEdgeFunction('admin-process-course-knowledge', { documentId, retryFailed: true });
    showAdminAlert('success', 'Başarısız parçalar yeniden sıraya alındı, işleniyor...');
    akStartPolling(documentId, fileName, doc ? doc.total_chunks : 0);
  } catch (err) {
    console.error('akRetryFailedChunks error:', err);
    showAdminAlert('error', err.message || 'Başarısız parçalar sıfırlanırken bir hata oluştu.');
  }
}
window.akRetryFailedChunks = akRetryFailedChunks;

async function akResyncCourse(courseCode) {
  try {
    const result = await callAdminEdgeFunction('admin-process-course-knowledge', { courseCode, resyncOnly: true });
    showAdminAlert('success', `${courseCode} için bilgi tabanı yeniden hesaplandı (${result.chunkCount} parça).`);
  } catch (err) {
    console.error('akResyncCourse error:', err);
    showAdminAlert('error', err.message || 'Yeniden hesaplama başarısız oldu.');
  }
}
window.akResyncCourse = akResyncCourse;

// "Resmi Özet" (official AI-written course summary) — see
// supabase/functions/admin-generate-course-summary and
// 20260829c_add_ai_course_summary.sql. One shared summary per course,
// generated on-demand by the admin, then read by every student in Sınav
// Platformu's course-selection screen (js/dashboard.js).
async function akGenerateCourseSummary(courseCode) {
  const btn = document.getElementById(`ak-summary-btn-${courseCode}`);
  const originalText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Oluşturuluyor...'; }

  try {
    const result = await callAdminEdgeFunction('admin-generate-course-summary', { courseCode });
    if (!akKnowledgeIndex[courseCode]) akKnowledgeIndex[courseCode] = { course_code: courseCode, chunk_count: 1 };
    akKnowledgeIndex[courseCode].ai_summary = result.summary;
    akKnowledgeIndex[courseCode].ai_summary_generated_at = result.generatedAt;
    showAdminAlert('success', `${courseCode} için resmi özet oluşturuldu. Öğrenciler artık Sınav Platformu'nda görebilir.`);
    renderKnowledgeDocsTable();
    akOpenSummaryModal(courseCode, result.summary, result.generatedAt);
  } catch (err) {
    console.error('akGenerateCourseSummary error:', err);
    showAdminAlert('error', err.message || 'Özet oluşturulurken bir hata oluştu.');
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}
window.akGenerateCourseSummary = akGenerateCourseSummary;

function akViewCourseSummary(courseCode) {
  const indexRow = akKnowledgeIndex[courseCode];
  if (!indexRow || !indexRow.ai_summary) {
    showAdminAlert('error', 'Bu ders için henüz bir özet oluşturulmamış.');
    return;
  }
  akOpenSummaryModal(courseCode, indexRow.ai_summary, indexRow.ai_summary_generated_at);
}
window.akViewCourseSummary = akViewCourseSummary;

function akOpenSummaryModal(courseCode, summaryText, generatedAt) {
  const modal = document.getElementById('ak-summary-modal');
  const titleEl = document.getElementById('ak-summary-modal-title');
  const metaEl = document.getElementById('ak-summary-modal-meta');
  const bodyEl = document.getElementById('ak-summary-modal-body');
  if (!modal) return;
  const course = akCourses.find(c => c.course_code === courseCode);
  if (titleEl) titleEl.textContent = `📄 Resmi Özet — ${courseCode}${course ? ` (${course.course_name})` : ''}`;
  if (metaEl) metaEl.textContent = generatedAt ? `Oluşturulma: ${new Date(generatedAt).toLocaleString('tr-TR')}` : '';
  if (bodyEl) bodyEl.textContent = summaryText || '';
  modal.classList.add('active');
}
window.akOpenSummaryModal = akOpenSummaryModal;

function akCloseSummaryModal() {
  const modal = document.getElementById('ak-summary-modal');
  if (modal) modal.classList.remove('active');
}
window.akCloseSummaryModal = akCloseSummaryModal;

async function akDeleteDocument(documentId, courseCode) {
  if (!window.confirm('Bu kaynağı ve taranan tüm içeriğini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;

  try {
    const { error } = await supabaseClient.from('course_knowledge_documents').delete().eq('id', documentId);
    if (error) throw error;
    showAdminAlert('success', 'Kaynak silindi. Ders bilgi tabanı yeniden hesaplanıyor...');
    await callAdminEdgeFunction('admin-process-course-knowledge', { courseCode, resyncOnly: true });
    await loadKnowledgeBase();
  } catch (err) {
    console.error('akDeleteDocument error:', err);
    showAdminAlert('error', err.message || 'Kaynak silinirken bir hata oluştu.');
  }
}
window.akDeleteDocument = akDeleteDocument;

// ==========================================
// UTIL
// ==========================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
