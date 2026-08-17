/**
 * FSARAP AUTHENTICATION CONTROLLER
 * Handles login, registration, role selection, dynamic metadata loading, and logout
 */

document.addEventListener('DOMContentLoaded', () => {
  renderNavUserSession();
  initAuthFormHandlers();
  loadAcademicMetadata();
});

// Render Logged-in User Info or Login/Register buttons in Navbar
const renderNavUserSession = () => {
  const navAuthContainer = document.getElementById('nav-auth-container');
  if (!navAuthContainer) return;

  const session = getUserSession();

  if (session && session.user) {
    const { first_name, last_name, role } = session.user;
    
    let dashboardPage = 'dashboard-student.html';
    if (role === 'lecturer') dashboardPage = 'dashboard-lecturer.html';
    if (role === 'faculty_admin') dashboardPage = 'dashboard-faculty.html';
    if (role === 'super_admin') dashboardPage = 'dashboard-admin.html';

    navAuthContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem;">
        <a href="${dashboardPage}" class="btn btn-primary btn-sm">
          <span>📊</span> Dashboard (${role.replace('_', ' ').toUpperCase()})
        </a>
        <span style="font-weight: 600; font-size: 0.9rem;">Hello, ${first_name}</span>
        <button onclick="handleLogout()" class="btn btn-outline btn-sm" title="Log out of FSARAP">
          🚪 Logout
        </button>
      </div>
    `;
  } else {
    navAuthContainer.innerHTML = `
      <a href="auth.html?mode=login" class="btn btn-outline btn-sm">Login</a>
      <a href="auth.html?mode=register" class="btn btn-primary btn-sm">Register</a>
    `;
  }
};

// Fetch Department & Level dropdown data for Registration
const loadAcademicMetadata = async () => {
  const deptSelect = document.getElementById('reg-department');
  const levelSelect = document.getElementById('reg-level');

  if (!deptSelect || !levelSelect) return;

  try {
    const res = await apiCall('/auth/metadata');
    if (res.success && res.data) {
      const { departments, levels } = res.data;

      deptSelect.innerHTML = '<option value="">-- Select Department --</option>';
      departments.forEach(dept => {
        deptSelect.innerHTML += `<option value="${dept.id}">${dept.name} (${dept.code})</option>`;
      });

      levelSelect.innerHTML = '<option value="">-- Select Academic Level --</option>';
      levels.forEach(lvl => {
        levelSelect.innerHTML += `<option value="${lvl.id}">${lvl.level_name}</option>`;
      });
    }
  } catch (err) {
    console.error('Failed to load academic metadata:', err.message);
  }
};

// Handle Form Submissions & Tab Switches
const initAuthFormHandlers = () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  // Handle Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      if (!email || !password) {
        showToast('Please enter both email and password.', 'warning');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Authenticating...';

        const response = await apiCall('/auth/login', 'POST', { email, password });

        if (response.success) {
          setUserSession(response.token, response.user);
          showToast('Login successful! Redirecting...', 'success');

          let redirectPage = 'index.html';
          if (response.user.role === 'student') redirectPage = 'dashboard-student.html';
          if (response.user.role === 'lecturer') redirectPage = 'dashboard-lecturer.html';
          if (response.user.role === 'faculty_admin') redirectPage = 'dashboard-faculty.html';
          if (response.user.role === 'super_admin') redirectPage = 'dashboard-admin.html';

          setTimeout(() => {
            window.location.href = redirectPage;
          }, 1000);
        }
      } catch (error) {
        showToast(error.message || 'Login failed.', 'danger');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Login to FSARAP';
      }
    });
  }

  // Handle Registration
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const role = document.querySelector('input[name="reg-role"]:checked').value;
      const first_name = document.getElementById('reg-firstname').value.trim();
      const last_name = document.getElementById('reg-lastname').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const department_id = document.getElementById('reg-department').value;
      const level_id = document.getElementById('reg-level').value;
      const matric_number = document.getElementById('reg-matric')?.value.trim();
      const staff_id = document.getElementById('reg-staffid')?.value.trim();

      const submitBtn = registerForm.querySelector('button[type="submit"]');

      try {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Creating Account...';

        const payload = {
          first_name,
          last_name,
          email,
          password,
          role,
          department_id,
          level_id,
          matric_number,
          staff_id
        };

        const response = await apiCall('/auth/register', 'POST', payload);

        if (response.success) {
          if (role === 'lecturer') {
            showToast(response.message, 'info', 6000);
            setTimeout(() => {
              window.location.href = 'auth.html?mode=login';
            }, 2500);
          } else {
            setUserSession(response.token, response.user);
            showToast('Registration successful! Redirecting to Dashboard...', 'success');
            setTimeout(() => {
              window.location.href = 'dashboard-student.html';
            }, 1500);
          }
        }
      } catch (error) {
        showToast(error.message || 'Registration failed.', 'danger');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Create Account';
      }
    });
  }
};

// Role Toggle Switcher Handler
const handleRoleChange = (role) => {
  const studentFields = document.getElementById('student-extra-fields');
  const lecturerFields = document.getElementById('lecturer-extra-fields');

  if (role === 'student') {
    if (studentFields) studentFields.style.display = 'block';
    if (lecturerFields) lecturerFields.style.display = 'none';
  } else {
    if (studentFields) studentFields.style.display = 'none';
    if (lecturerFields) lecturerFields.style.display = 'block';
  }
};

// Logout Handler
const handleLogout = async () => {
  try {
    await apiCall('/auth/logout', 'POST');
  } catch (e) {
    // Ignore error
  }
  clearUserSession();
  showToast('Logged out successfully.', 'info');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1000);
};
