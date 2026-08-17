/**
 * FSARAP UTILITY FUNCTIONS & UI HELPERS
 * Niger Delta University - Faculty of Science
 */

// Theme Controller (Light/Dark Mode)
const initTheme = () => {
  const savedTheme = localStorage.getItem('fsarap_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeToggleIcons(savedTheme);
};

const toggleTheme = () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('fsarap_theme', newTheme);
  updateThemeToggleIcons(newTheme);
};

const updateThemeToggleIcons = (theme) => {
  const themeBtns = document.querySelectorAll('.theme-toggle');
  themeBtns.forEach(btn => {
    btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
  });
};

// Mobile Navigation Toggle Controller
const toggleMobileMenu = () => {
  const navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    navLinks.classList.toggle('mobile-open');
  }
};

// Toast Notification Manager
const showToast = (message, type = 'info', duration = 4000) => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✅' : type === 'danger' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  
  toast.innerHTML = `
    <span style="font-size: 1.2rem;">${icon}</span>
    <div style="flex: 1; font-size: 0.9rem; font-weight: 500;">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// Modal Helper
const openModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
  }
};

const closeModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
};

// Session Management Helpers
const getUserSession = () => {
  const userJson = localStorage.getItem('fsarap_user');
  const token = localStorage.getItem('fsarap_token');
  if (!userJson || !token) return null;
  try {
    return {
      token,
      user: JSON.parse(userJson)
    };
  } catch (e) {
    return null;
  }
};

const setUserSession = (token, user) => {
  localStorage.setItem('fsarap_token', token);
  localStorage.setItem('fsarap_user', JSON.stringify(user));
};

const clearUserSession = () => {
  localStorage.removeItem('fsarap_token');
  localStorage.removeItem('fsarap_user');
};

// Formatting Utilities
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// HTML Escape Utility — prevents XSS in template literals
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
};

// Initialize Theme on Script Load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
});
