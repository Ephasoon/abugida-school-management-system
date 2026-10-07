// assets/js/config.js
// ============================================================
// The ONLY place the API location is configured. Load this before
// api.js (and before any page script that talks to the backend).
//
// Default: same hostname as the page, port 3000. Keeping the page and
// the API on the same hostname matters: the refresh-token cookie is
// SameSite=Strict, and the browser only sends it when both are on the
// same site (localhost ≠ 127.0.0.1). Ports do not affect this.
//
// To point at another server, change API_BASE below, e.g.
//   API_BASE: 'https://api.myschool.et/api'
// ============================================================

window.ASMS_CONFIG = {
  API_BASE: `${window.location.protocol}//${window.location.hostname || 'localhost'}:3000/api`,
};
