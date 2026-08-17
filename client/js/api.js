/**
 * FSARAP API CLIENT WRAPPER
 * Centralized Fetch client handling HTTP requests, JWT token header injection, and global error handling
 */

const API_BASE_URL = window.location.origin.includes('5000') || window.location.origin.includes('localhost') 
  ? 'http://localhost:5000/api' 
  : '/api';

/**
 * Send Asynchronous HTTP Request
 * @param {string} endpoint - API path (e.g., '/auth/login')
 * @param {string} method - GET, POST, PUT, DELETE
 * @param {Object} body - Payload data
 * @param {boolean} isFormData - Set true for Multer file upload FormData payloads
 */
const apiCall = async (endpoint, method = 'GET', body = null, isFormData = false) => {
  const token = localStorage.getItem('fsarap_token');

  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
    credentials: 'include'
  };

  if (body) {
    config.body = isFormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        // Token expired or invalid
        clearUserSession();
        showToast('Your session has expired. Please log in again.', 'warning');
        setTimeout(() => {
          window.location.href = 'auth.html';
        }, 1500);
      }
      throw new Error(result.message || 'An unexpected server error occurred.');
    }

    return result;
  } catch (error) {
    console.error(`API Error [${method} ${endpoint}]:`, error.message);
    throw error;
  }
};
