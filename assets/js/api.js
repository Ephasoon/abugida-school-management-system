// assets/js/api.js
// ============================================================
// Central API service — all fetch calls go through here.
// Automatically attaches the JWT token to every request.
// On a 401 it refreshes the access token once (using the HTTP-only
// refresh cookie) and retries; it logs out only if the refresh fails.
// Requires assets/js/config.js and assets/js/escape.js to be loaded first.
// ============================================================

const API_BASE = window.ASMS_CONFIG.API_BASE;

// ── Which session this page uses ─────────────────────────────
// Staff pages use asms_token. The parent portal sets
//   <script>window.ASMS_SESSION = 'parent';</script>
// before loading this file, and keeps its own keys and login page.
const SESSION = window.ASMS_SESSION === 'parent'
  ? { tokenKey: 'parent_token', userKey: 'parent_user', loginPage: 'parent-login.html' }
  : { tokenKey: 'asms_token',   userKey: 'asms_user',   loginPage: 'login.html' };

// ── Get stored token ─────────────────────────────────────────
function getToken() {
  return localStorage.getItem(SESSION.tokenKey);
}

// ── Get stored user ──────────────────────────────────────────
function getUser() {
  try {
    return JSON.parse(localStorage.getItem(SESSION.userKey));
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
    window.location.href = SESSION.loginPage;
    return false;
  }
  return true;
}

// ── Clear local session and go to the login page ─────────────
function clearSessionAndRedirect() {
  localStorage.removeItem(SESSION.tokenKey);
  localStorage.removeItem(SESSION.userKey);
  window.location.href = SESSION.loginPage;
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
          localStorage.setItem(SESSION.tokenKey, data.data.accessToken);
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
    window.location.href = 'change-password.html' + (window.ASMS_SESSION === 'parent' ? '?session=parent' : '');
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

// ── Download a protected file ────────────────────────────────
// Plain <a href> links send no token, so files are fetched with
// authFetch and saved from a blob. The filename comes from the
// server's Content-Disposition (RFC 5987 filename* first, so
// Amharic names survive), falling back to `fallbackName`.
function filenameFromDisposition(header) {
  if (!header) return null;
  const star = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (star) { try { return decodeURIComponent(star[1].trim()); } catch { /* malformed */ } }
  const plain = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
}

async function downloadFile(endpoint, fallbackName = 'download') {
  try {
    const res = await authFetch(endpoint);
    if (!res) return;   // session ended
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      showToast(body?.message || 'Download failed.', 'error');
      return;
    }
    const name = filenameFromDisposition(res.headers.get('Content-Disposition')) || fallbackName;
    const url  = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    showToast('Download failed.', 'error');
  }
}

// ── Finance is admin-only (enforced by the API) ──────────────
// For anyone else, finance links and elements marked data-finance
// are removed so teachers don't see panels that would only fail.
function canSeeFinance() {
  return getUser()?.role === 'admin';
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getUser() || canSeeFinance()) return;
  document.querySelectorAll('a[href="finance.html"], [data-finance]').forEach(el => el.remove());
});

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
