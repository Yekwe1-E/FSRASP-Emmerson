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

// ─────────────────────────────────────────────────────────────────────────────
// PWA & HYBRID ONLINE/OFFLINE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

// Register Service Worker for PWA Offline Caching
const initServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] ServiceWorker registration failed:', err);
        });
    });
  }
};

// Render Dynamic Online / Offline Network Status Badge in Navbar
const renderNetworkStatusBadge = () => {
  const navbarBrand = document.querySelector('.nav-brand');
  if (!navbarBrand) return;

  let badge = document.getElementById('fsarap-network-status-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'fsarap-network-status-badge';
    badge.style.marginLeft = '0.75rem';
    badge.style.padding = '0.2rem 0.6rem';
    badge.style.borderRadius = '20px';
    badge.style.fontSize = '0.75rem';
    badge.style.fontWeight = '600';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.gap = '0.3rem';
    badge.style.transition = 'all 0.3s ease';
    
    // Insert after NDU badge
    navbarBrand.appendChild(badge);
  }

  const isOnline = navigator.onLine;
  if (isOnline) {
    badge.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
    badge.style.color = '#10b981';
    badge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    badge.innerHTML = '🟢 Cloud Online';
    badge.title = 'Connected to FSARAP Cloud Server (Render / Supabase)';
  } else {
    badge.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
    badge.style.color = '#f59e0b';
    badge.style.border = '1px solid rgba(245, 158, 11, 0.3)';
    badge.innerHTML = '🟠 Offline Mode (PWA)';
    badge.title = 'Running on Local Service Worker PWA Cache & IndexedDB';
  }
};

// Sync Offline Saved Quiz Attempts when Network Re-connects
const syncOfflineQuizAttempts = async () => {
  const offlineQueue = JSON.parse(localStorage.getItem('fsarap_offline_attempts') || '[]');
  if (offlineQueue.length === 0) return;

  showToast(`Syncing ${offlineQueue.length} offline quiz attempt(s) with cloud server...`, 'info');
  const remaining = [];

  for (const item of offlineQueue) {
    try {
      if (typeof apiCall === 'function') {
        await apiCall(`/quizzes/${item.quizId}/submit`, 'POST', {
          attemptId: item.attemptId,
          answers: item.answers
        });
        showToast(`Synced attempt for quiz: ${item.quizTitle || 'Quiz'}`, 'success');
      }
    } catch (err) {
      console.error('Failed to sync offline attempt:', err);
      remaining.push(item);
    }
  }

  localStorage.setItem('fsarap_offline_attempts', JSON.stringify(remaining));
};

// Setup Online / Offline Network Event Listeners
const setupNetworkListeners = () => {
  window.addEventListener('online', () => {
    renderNetworkStatusBadge();
    showToast('🌐 Internet connection restored. FSARAP is Cloud Online!', 'success');
    syncOfflineQuizAttempts();
  });

  window.addEventListener('offline', () => {
    renderNetworkStatusBadge();
    showToast('📶 You are offline. FSARAP PWA Engine is actively serving cached resources.', 'warning');
  });
};

// Initialize Features on Script Load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initServiceWorker();
  renderNetworkStatusBadge();
  setupNetworkListeners();
});
