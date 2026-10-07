// assets/js/api.js
// ============================================================
// Central API service — all fetch calls go through here.
// Automatically attaches the JWT token to every request.
// On a 401 it refreshes the access token once (using the HTTP-only
// refresh cookie) and retries; it logs out only if the refresh fails.
// Requires assets/js/config.js and assets/js/escape.js to be loaded first.
// ============================================================

const API_BASE = window.ASMS_CONFIG.API_BASE;

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

// ── Clear local session and go to the login page ─────────────
function clearSessionAndRedirect() {
  localStorage.removeItem('asms_token');
  localStorage.removeItem('asms_user');
  window.location.href = 'login.html';
}

// ── Logout ───────────────────────────────────────────────────
// Revokes the refresh token on the server, then clears local state.
async function logout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch { /* offline: still clear the local session */ }
  clearSessionAndRedirect();
}

// ── Refresh the access token (single shared request) ─────────
// Several requests can fail with 401 at the same moment; they all
// await the same promise, so only ONE /auth/refresh call is made.
let refreshPromise = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',   // sends the HTTP-only refreshToken cookie
    })
      .then(async res => {
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success && data.data?.accessToken) {
          localStorage.setItem('asms_token', data.data.accessToken);
          return true;
        }
        return false;
      })
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

// ── Password change required → dedicated page ────────────────
async function redirectIfPasswordChangeRequired(res) {
  if (res.status !== 403) return false;
  const body = await res.clone().json().catch(() => null);
  if (body?.errors?.code !== 'PASSWORD_CHANGE_REQUIRED') return false;
  if (!window.location.pathname.endsWith('change-password.html')) {
    window.location.href = 'change-password.html';
  }
  return true;
}

// ── Authenticated fetch returning the raw Response ───────────
// Use directly for non-JSON responses (e.g. PDF downloads).
// Returns null when the session is gone (the user is being logged out).
async function authFetch(endpoint, options = {}) {
  const send = () => {
    const token = getToken();
    return {
      token,
      request: fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
        credentials: 'include',
      }),
    };
  };

  let { token: usedToken, request } = send();
  let res = await request;

  if (res.status === 401) {
    // Another request may already have refreshed while this one was in flight
    const refreshed = getToken() !== usedToken || await refreshAccessToken();
    if (!refreshed) {
      clearSessionAndRedirect();
      return null;
    }
    res = await send().request;   // retry once with the new token
  }

  await redirectIfPasswordChangeRequired(res);
  return res;
}

// ── Core fetch wrapper (JSON) ────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  try {
    const res = await authFetch(endpoint, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    if (!res) return null;   // logged out
    return await res.json();
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
  return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHtml(status)}</span>`;
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
