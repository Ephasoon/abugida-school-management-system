// assets/js/api.js
// ============================================================
// Central API service — all fetch calls go through here.
// Automatically attaches the JWT token to every request.
// Handles token expiry and redirects to login if needed.
// ============================================================

const API_BASE = 'http://localhost:3000/api';

// ── Get stored token ─────────────────────────────────────────
function getToken() {
  return localStorage.getItem('asms_token');
}

// ── Get stored user ──────────────────────────────────────────
function getUser() {
  try {
    return JSON.parse(localStorage.getItem('asms_user'));
  } catch {
    return null;
  }
}

// ── Check if logged in ───────────────────────────────────────
function isLoggedIn() {
  return !!getToken();
}

// ── Redirect to login if not authenticated ───────────────────
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// ── Logout ───────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('asms_token');
  localStorage.removeItem('asms_user');
  window.location.href = 'login.html';
}

// ── Core fetch wrapper ───────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await res.json();

    // If token expired, redirect to login
    if (res.status === 401) {
      logout();
      return null;
    }

    return data;

  } catch (err) {
    console.error('API Error:', err);
    return { success: false, message: 'Cannot connect to server.' };
  }
}

// ── Convenience methods ──────────────────────────────────────
const api = {
  get:    (url)         => apiFetch(url),
  post:   (url, body)   => apiFetch(url, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (url, body)   => apiFetch(url, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (url)         => apiFetch(url, { method: 'DELETE' }),
};

// ── Format currency (ETB) ─────────────────────────────────────
function formatETB(amount) {
  return `ETB ${parseFloat(amount || 0).toLocaleString('en-ET', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Format date ───────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-ET', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

// ── Status badge HTML ─────────────────────────────────────────
function statusBadge(status) {
  const map = {
    paid:     'badge-green',
    unpaid:   'badge-red',
    partial:  'badge-gold',
    active:   'badge-green',
    present:  'badge-green',
    absent:   'badge-red',
    late:     'badge-gold',
    PAID:     'badge-green',
    PARTIAL:  'badge-gold',
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${status}</span>`;
}

// ── Show toast notification ───────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
