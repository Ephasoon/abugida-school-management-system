// assets/js/escape.js
// ============================================================
// The single HTML-escaping helper for the whole frontend.
// Load before api.js and before any page script that builds HTML.
// ============================================================

// ── Escape text before putting it into innerHTML ─────────────
// Use for every value that comes from the API:
//   `<td>${escapeHtml(s.first_name)}</td>`
// Inside an inline handler, escape the JSON-encoded value instead:
//   onclick="del(${escapeHtml(JSON.stringify(d.title))})"
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;',
  }[c]));
}
