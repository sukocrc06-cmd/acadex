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
  if (tabId === 'settings') { loadSiteSettings(); loadAnnouncements(); }
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
  } catch (err) {
    console.error('loadUsers error:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #DC2626;">Kullanıcılar yüklenemedi.</td></tr>`;
  }
}

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
    return `
      <tr>
        <td>${escapeHtml(u.full_name || '—')}</td>
        <td>${escapeHtml(u.email || '—')}</td>
        <td>${escapeHtml(u.department || '—')}</td>
        <td>${escapeHtml(u.student_number || '—')}</td>
        <td>
          <span class="admin-badge role-${role}">${roleLabel}</span>
        </td>
        <td>${suspendedBadge || '<span style="color: var(--color-text-muted); font-size:0.75rem;">Aktif</span>'}</td>
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
}
window.closeAnnouncementForm = closeAnnouncementForm;

async function submitAnnouncement() {
  const title = document.getElementById('ann-title').value.trim();
  const body = document.getElementById('ann-body').value.trim();
  const dept = document.getElementById('ann-department').value || null;

  if (!title || !body) {
    showAdminAlert('error', 'Başlık ve metin zorunludur.');
    return;
  }

  try {
    const { error } = await supabaseClient.from('announcements').insert({
      title, body,
      audience_department: dept,
      created_by: adminProfile.id,
      created_by_role: 'admin'
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
