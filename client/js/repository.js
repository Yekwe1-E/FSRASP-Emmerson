/**
 * FSARAP REPOSITORY CONTROLLER
 * Handles material filtering, search, pagination, bookmarks, downloads, and uploads
 */

let currentFilters = {
  search: '',
  department_id: '',
  level_code: '',
  semester_id: '',
  category: '',
  file_type: '',
  page: 1,
  limit: 12
};

document.addEventListener('DOMContentLoaded', () => {
  // Parse URL Parameters (e.g. repository.html?dept=CSC&level=100)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('dept')) currentFilters.department_code = urlParams.get('dept');
  if (urlParams.get('level')) currentFilters.level_code = urlParams.get('level');
  if (urlParams.get('search')) currentFilters.search = urlParams.get('search');

  initRepositoryFilters();
  loadRepositoryMaterials();
  loadUploadPageMetadata();
});

// Load Dropdown Options for Filters
const initRepositoryFilters = async () => {
  const deptSelect = document.getElementById('filter-department');
  const levelSelect = document.getElementById('filter-level');
  const semesterSelect = document.getElementById('filter-semester');
  const searchInput = document.getElementById('search-input');

  try {
    const res = await apiCall('/auth/metadata');
    if (res.success && res.data) {
      const { departments, levels, semesters } = res.data;

      if (deptSelect) {
        deptSelect.innerHTML = '<option value="">All Departments</option>';
        departments.forEach(dept => {
          const selected = currentFilters.department_code === dept.code ? 'selected' : '';
          deptSelect.innerHTML += `<option value="${dept.id}" ${selected}>${dept.name} (${dept.code})</option>`;
        });
      }

      if (levelSelect) {
        levelSelect.innerHTML = '<option value="">All Academic Levels</option>';
        levels.forEach(lvl => {
          const selected = currentFilters.level_code === lvl.level_code ? 'selected' : '';
          levelSelect.innerHTML += `<option value="${lvl.id}" ${selected}>${lvl.level_name}</option>`;
        });
      }

      if (semesterSelect) {
        semesterSelect.innerHTML = '<option value="">All Semesters</option>';
        semesters.forEach(sem => {
          semesterSelect.innerHTML += `<option value="${sem.id}">${sem.name}</option>`;
        });
      }
    }
  } catch (err) {
    console.error('Failed to load filter metadata:', err);
  }

  if (searchInput && currentFilters.search) {
    searchInput.value = currentFilters.search;
  }
};

// Fetch and Render Repository Materials Grid
const loadRepositoryMaterials = async () => {
  const gridContainer = document.getElementById('materials-grid');
  const countContainer = document.getElementById('results-count');
  const paginationContainer = document.getElementById('pagination-container');

  if (!gridContainer) return;

  gridContainer.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 0;">
      <div style="font-size: 2.5rem; animation: spin 1s linear infinite;">⏳</div>
      <p class="text-muted mt-2">Loading materials from repository...</p>
    </div>
  `;

  // Build query string
  const queryParams = new URLSearchParams();
  Object.keys(currentFilters).forEach(key => {
    if (currentFilters[key]) queryParams.append(key, currentFilters[key]);
  });

  try {
    const res = await apiCall(`/materials?${queryParams.toString()}`);

    if (res.success) {
      if (countContainer) {
        countContainer.innerText = `Showing ${res.data.length} of ${res.total} Materials`;
      }

      if (res.data.length === 0) {
        gridContainer.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;" class="card">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
            <h3>No Lecture Materials Found</h3>
            <p class="text-muted mt-1">Try resetting search filters or selecting another department/level.</p>
            <button onclick="resetFilters()" class="btn btn-outline btn-sm mt-3">Reset Filters</button>
          </div>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
      }

      gridContainer.innerHTML = res.data.map(item => renderMaterialCard(item)).join('');
      renderPagination(res.page, res.totalPages);
    }
  } catch (error) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;" class="card">
        <p style="color: var(--danger); font-weight: 600;">Failed to load materials: ${error.message}</p>
      </div>
    `;
  }
};

// Render Individual Material Card Component
const renderMaterialCard = (item) => {
  const fileIcon = getFileIcon(item.file_type);
  const fileBadgeClass = getFileBadgeClass(item.file_type);

  return `
    <div class="card card-hoverable flex flex-col justify-between" style="position: relative;">
      <div>
        <div class="flex justify-between items-center mb-2">
          <span class="badge ${fileBadgeClass}">${item.file_type.toUpperCase()} • ${formatFileSize(item.file_size)}</span>
          <button onclick="handleBookmarkToggle('${item.id}', this)" class="btn-icon" style="width: 32px; height: 32px;" title="${item.is_bookmarked ? 'Remove Bookmark' : 'Bookmark Material'}">
            ${item.is_bookmarked ? '⭐' : '☆'}
          </button>
        </div>

        <div style="display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 0.75rem;">
          <div style="font-size: 2rem;">${fileIcon}</div>
          <div>
            <span class="badge badge-secondary mb-1" style="font-size: 0.7rem;">${item.course_code}</span>
            <h3 style="font-size: 1.05rem; line-height: 1.3;"><a href="material-details.html?id=${item.id}">${escapeHtml(item.title)}</a></h3>
          </div>
        </div>

        <p class="text-muted" style="font-size: 0.85rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 1rem;">
          ${escapeHtml(item.description || 'No description provided.')}
        </p>
      </div>

      <div style="border-top: 1px solid var(--border-color); pt-2; margin-top: 1rem; padding-top: 0.75rem;">
        <div class="flex justify-between items-center" style="font-size: 0.8rem; color: var(--text-muted);">
          <span>🏛️ ${item.department_code} • ${item.level_code}L</span>
          <span>📥 ${item.download_count || 0} downloads</span>
        </div>
        <div class="flex justify-between items-center mt-2">
          <span style="font-size: 0.75rem; color: var(--text-muted);">By ${item.uploader_first_name} ${item.uploader_last_name}</span>
          <a href="material-details.html?id=${item.id}" class="btn btn-primary btn-sm">Details &rarr;</a>
        </div>
      </div>
    </div>
  `;
};

// Icon Helper
const getFileIcon = (fileType) => {
  switch (fileType.toLowerCase()) {
    case 'pdf': return '📄';
    case 'docx': case 'doc': return '📝';
    case 'pptx': case 'ppt': return '📊';
    case 'zip': return '📦';
    case 'png': case 'jpg': case 'jpeg': return '🖼️';
    default: return '📁';
  }
};

const getFileBadgeClass = (fileType) => {
  switch (fileType.toLowerCase()) {
    case 'pdf': return 'badge-danger';
    case 'docx': case 'doc': return 'badge-primary';
    case 'pptx': case 'ppt': return 'badge-warning';
    case 'zip': return 'badge-secondary';
    default: return 'badge-accent';
  }
};

// Filter Change Handlers
const applyFilters = () => {
  currentFilters.search = document.getElementById('search-input')?.value.trim() || '';
  currentFilters.department_id = document.getElementById('filter-department')?.value || '';
  currentFilters.level_id = document.getElementById('filter-level')?.value || '';
  currentFilters.semester_id = document.getElementById('filter-semester')?.value || '';
  currentFilters.category = document.getElementById('filter-category')?.value || '';
  currentFilters.file_type = document.getElementById('filter-filetype')?.value || '';
  currentFilters.page = 1;

  loadRepositoryMaterials();
};

const resetFilters = () => {
  currentFilters = { search: '', department_id: '', level_id: '', semester_id: '', category: '', file_type: '', page: 1, limit: 12 };
  
  if (document.getElementById('search-input')) document.getElementById('search-input').value = '';
  if (document.getElementById('filter-department')) document.getElementById('filter-department').value = '';
  if (document.getElementById('filter-level')) document.getElementById('filter-level').value = '';
  if (document.getElementById('filter-semester')) document.getElementById('filter-semester').value = '';
  if (document.getElementById('filter-category')) document.getElementById('filter-category').value = '';
  if (document.getElementById('filter-filetype')) document.getElementById('filter-filetype').value = '';

  loadRepositoryMaterials();
};

const setLevelFilter = (levelCode) => {
  currentFilters.level_code = levelCode;
  currentFilters.page = 1;

  const levelTabs = document.querySelectorAll('.level-tab');
  levelTabs.forEach(tab => {
    if (tab.getAttribute('data-level') === levelCode) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  loadRepositoryMaterials();
};

// Toggle Bookmark Action
const handleBookmarkToggle = async (materialId, btnElement) => {
  const session = getUserSession();
  if (!session) {
    showToast('Please login to save bookmarks.', 'warning');
    setTimeout(() => window.location.href = 'auth.html', 1500);
    return;
  }

  try {
    const res = await apiCall(`/materials/${materialId}/bookmark`, 'POST');
    if (res.success) {
      showToast(res.message, res.is_bookmarked ? 'success' : 'info');
      btnElement.innerHTML = res.is_bookmarked ? '⭐' : '☆';
      btnElement.title = res.is_bookmarked ? 'Remove Bookmark' : 'Bookmark Material';
    }
  } catch (error) {
    showToast(error.message, 'danger');
  }
};

// Trigger File Download Action
const handleMaterialDownload = async (materialId) => {
  const session = getUserSession();
  if (!session) {
    showToast('Please login to download lecture materials.', 'warning');
    setTimeout(() => window.location.href = 'auth.html', 1500);
    return;
  }

  try {
    showToast('Initiating file download...', 'info');
    const res = await apiCall(`/materials/${materialId}/download`, 'POST');
    if (res.success && res.file_url) {
      const link = document.createElement('a');
      link.href = res.file_url;
      link.target = '_blank';
      link.download = '';
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('Download started successfully!', 'success');
    }
  } catch (error) {
    showToast(error.message || 'Failed to download file.', 'danger');
  }
};

// Pagination Controls
const renderPagination = (currentPage, totalPages) => {
  const container = document.getElementById('pagination-container');
  if (!container || totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  let html = `<div class="flex gap-1 justify-center items-center mt-4">`;

  if (currentPage > 1) {
    html += `<button onclick="changePage(${currentPage - 1})" class="btn btn-outline btn-sm">&laquo; Prev</button>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    const activeClass = i === currentPage ? 'btn-primary' : 'btn-outline';
    html += `<button onclick="changePage(${i})" class="btn ${activeClass} btn-sm">${i}</button>`;
  }

  if (currentPage < totalPages) {
    html += `<button onclick="changePage(${currentPage + 1})" class="btn btn-outline btn-sm">Next &raquo;</button>`;
  }

  html += `</div>`;
  container.innerHTML = html;
};

const changePage = (page) => {
  currentFilters.page = page;
  loadRepositoryMaterials();
  window.scrollTo({ top: 300, behavior: 'smooth' });
};

// Load Metadata for Lecturer Upload Form
const loadUploadPageMetadata = async () => {
  const courseSelect = document.getElementById('upload-course');
  const deptSelect = document.getElementById('upload-department');
  const levelSelect = document.getElementById('upload-level');
  const semesterSelect = document.getElementById('upload-semester');
  const sessionSelect = document.getElementById('upload-session');
  const uploadForm = document.getElementById('material-upload-form');

  if (!uploadForm) return;

  // Check login & role
  const session = getUserSession();
  if (!session || (session.user.role !== 'lecturer' && session.user.role !== 'faculty_admin' && session.user.role !== 'super_admin')) {
    showToast('Only Lecturers and Admins can access the upload portal.', 'danger');
    setTimeout(() => window.location.href = 'index.html', 2000);
    return;
  }

  try {
    const res = await apiCall('/auth/metadata');
    const coursesRes = await apiCall('/courses');

    if (res.success && res.data) {
      const { departments, levels, semesters, sessions } = res.data;

      deptSelect.innerHTML = '<option value="">-- Select Department --</option>';
      departments.forEach(d => deptSelect.innerHTML += `<option value="${d.id}">${d.name} (${d.code})</option>`);

      levelSelect.innerHTML = '<option value="">-- Select Level --</option>';
      levels.forEach(l => levelSelect.innerHTML += `<option value="${l.id}">${l.level_name}</option>`);

      semesterSelect.innerHTML = '<option value="">-- Select Semester --</option>';
      semesters.forEach(s => semesterSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`);

      sessionSelect.innerHTML = '<option value="">-- Select Session --</option>';
      sessions.forEach(ss => sessionSelect.innerHTML += `<option value="${ss.id}" ${ss.is_current ? 'selected' : ''}>${ss.session_name}</option>`);
    }

    if (coursesRes.success && coursesRes.data) {
      courseSelect.innerHTML = '<option value="">-- Select Course Code --</option>';
      coursesRes.data.forEach(c => {
        courseSelect.innerHTML += `<option value="${c.id}">${c.course_code} - ${c.course_title}</option>`;
      });
    }
  } catch (err) {
    console.error('Upload metadata load error:', err);
  }

  // Upload Form Submit Event Listener
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(uploadForm);
    const submitBtn = uploadForm.querySelector('button[type="submit"]');

    try {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Uploading to Supabase Storage...';

      const res = await apiCall('/materials/upload', 'POST', formData, true);

      if (res.success) {
        showToast('Lecture material uploaded successfully!', 'success');
        setTimeout(() => {
          window.location.href = 'repository.html';
        }, 1500);
      }
    } catch (error) {
      showToast(error.message || 'Upload failed.', 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Upload Material';
    }
  });
};
