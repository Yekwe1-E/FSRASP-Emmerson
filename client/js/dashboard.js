/**
 * FSARAP DASHBOARD CONTROLLER
 * Manages role-based dashboard metrics, tables, approval actions, and analytics
 */

document.addEventListener('DOMContentLoaded', () => {
  const pagePath = window.location.pathname;

  if (pagePath.includes('dashboard-admin.html')) loadAdminDashboard();
  if (pagePath.includes('dashboard-faculty.html')) loadFacultyDashboard();
  if (pagePath.includes('dashboard-lecturer.html')) loadLecturerDashboard();
  if (pagePath.includes('dashboard-student.html')) loadStudentDashboard();
});

// SUPER ADMIN DASHBOARD
const loadAdminDashboard = async () => {
  try {
    const res = await apiCall('/dashboard/admin');
    if (!res.success) return;

    const { users, repository, quizzes, pending_lecturers, users_list, audit_logs } = res.data;

    // Stat Cards
    document.getElementById('stat-total-students').innerText = users.student_count || 0;
    document.getElementById('stat-total-lecturers').innerText = users.lecturer_count || 0;
    document.getElementById('stat-total-materials').innerText = repository.total_materials || 0;
    document.getElementById('stat-total-downloads').innerText = repository.total_downloads || 0;
    document.getElementById('stat-total-quizzes').innerText = quizzes.total_quizzes || 0;

    // Render Pending Lecturers Table
    const pendingTable = document.getElementById('pending-lecturers-table');
    if (pendingTable) {
      if (pending_lecturers.length === 0) {
        pendingTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No pending lecturer approval requests.</td></tr>`;
      } else {
        pendingTable.innerHTML = pending_lecturers.map(lec => `
          <tr>
            <td><strong>${escapeHtml(lec.first_name)} ${escapeHtml(lec.last_name)}</strong></td>
            <td>${lec.email}</td>
            <td>${lec.department_name || 'N/A'}</td>
            <td><span class="badge badge-warning">${lec.staff_id || 'N/A'}</span></td>
            <td>
              <button onclick="handleUserApproval('${lec.id}', true)" class="btn btn-accent btn-sm">Approve</button>
              <button onclick="handleUserApproval('${lec.id}', false)" class="btn btn-danger btn-sm">Reject</button>
            </td>
          </tr>
        `).join('');
      }
    }

    // Render System Users List
    const usersTable = document.getElementById('users-list-table');
    if (usersTable) {
      usersTable.innerHTML = users_list.map(u => `
        <tr>
          <td><strong>${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</strong></td>
          <td>${u.email}</td>
          <td><span class="badge badge-primary">${u.role.toUpperCase()}</span></td>
          <td>
            <button onclick="toggleUserActiveStatus('${u.id}', ${!u.is_active})" class="btn ${u.is_active ? 'btn-outline' : 'btn-accent'} btn-sm">
              ${u.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </td>
        </tr>
      `).join('');
    }

    // Render Audit Logs
    const auditContainer = document.getElementById('audit-logs-container');
    if (auditContainer) {
      auditContainer.innerHTML = audit_logs.map(log => `
        <div style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;" class="flex justify-between items-center">
          <div>
            <strong>${log.action}</strong>
            <span class="text-muted" style="display: block;">By: ${log.first_name || 'System'} (${log.role || 'N/A'})</span>
          </div>
          <span class="text-muted" style="font-size: 0.75rem;">${formatDate(log.created_at)}</span>
        </div>
      `).join('');
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

// FACULTY ADMIN DASHBOARD
const loadFacultyDashboard = async () => {
  try {
    const res = await apiCall('/dashboard/faculty');
    if (!res.success) return;

    const { departments, pending_lecturers } = res.data;

    const deptGrid = document.getElementById('faculty-depts-grid');
    if (deptGrid) {
      deptGrid.innerHTML = departments.map(d => `
        <div class="card card-hoverable text-center">
          <h3>${d.name} (${d.code})</h3>
          <div class="flex justify-center gap-3 mt-2">
            <div><strong>${d.lecturer_count}</strong> <span class="text-muted">Lecturers</span></div>
            <div><strong>${d.material_count}</strong> <span class="text-muted">Materials</span></div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
};

// LECTURER DASHBOARD
const loadLecturerDashboard = async () => {
  try {
    const res = await apiCall('/dashboard/lecturer');
    if (!res.success) return;

    const { stats, materials, quizzes } = res.data;

    document.getElementById('stat-my-uploads').innerText = stats.total_uploaded || 0;
    document.getElementById('stat-my-downloads').innerText = stats.total_downloads || 0;
    document.getElementById('stat-approved-uploads').innerText = stats.approved_count || 0;

    const materialsTable = document.getElementById('lecturer-materials-table');
    if (materialsTable) {
      if (materials.length === 0) {
        materialsTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No materials uploaded yet. <a href="upload-material.html">Upload now</a></td></tr>`;
      } else {
        materialsTable.innerHTML = materials.map(m => `
          <tr>
            <td><strong>${escapeHtml(m.title)}</strong></td>
            <td><span class="badge badge-secondary">${m.course_code}</span></td>
            <td>${m.download_count}</td>
            <td><span class="badge ${m.approval_status === 'approved' ? 'badge-accent' : 'badge-warning'}">${m.approval_status}</span></td>
            <td>
              <button onclick="handleDeleteMaterial('${m.id}')" class="btn btn-danger btn-sm">Delete</button>
            </td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

// STUDENT DASHBOARD
const loadStudentDashboard = async () => {
  try {
    const res = await apiCall('/dashboard/student');
    if (!res.success) return;

    const { quiz_stats, bookmarked_count, recent_downloads, recommended_materials } = res.data;

    document.getElementById('stat-student-bookmarks').innerText = bookmarked_count || 0;
    document.getElementById('stat-student-quiz-count').innerText = quiz_stats.total_attempts || 0;
    document.getElementById('stat-student-avg-score').innerText = `${quiz_stats.average_score}%`;

    const recGrid = document.getElementById('recommended-materials-grid');
    if (recGrid) {
      recGrid.innerHTML = recommended_materials.map(m => renderMaterialCard(m)).join('');
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

// Action Handlers
const handleUserApproval = async (userId, isApproved) => {
  try {
    const res = await apiCall(`/dashboard/users/${userId}/approval`, 'PUT', { is_approved: isApproved });
    if (res.success) {
      showToast(res.message, 'success');
      loadAdminDashboard();
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

const toggleUserActiveStatus = async (userId, isActive) => {
  try {
    const res = await apiCall(`/dashboard/users/${userId}/active`, 'PUT', { is_active: isActive });
    if (res.success) {
      showToast(res.message, 'info');
      loadAdminDashboard();
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

const handleDeleteMaterial = async (materialId) => {
  if (confirm('Are you sure you want to delete this material?')) {
    try {
      const res = await apiCall(`/materials/${materialId}`, 'DELETE');
      if (res.success) {
        showToast(res.message, 'info');
        loadLecturerDashboard();
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }
};
