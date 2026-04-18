/**
 * Parse API date filter values for SQL DATETIME comparisons.
 * - Plain "YYYY-MM-DD" is interpreted as start/end of that calendar day in the **server** local timezone (legacy).
 * - Full ISO timestamps (e.g. from the browser) are used as exact instants.
 *
 * @param {string|number|Date} raw
 * @param {'start'|'end'} bound
 * @returns {Date|null}
 */
export function parseQueryableDateBound(raw, bound) {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim();
  const plainYmd = /^\d{4}-\d{2}-\d{2}$/;
  if (plainYmd.test(s)) {
    const [y, mo, d] = s.split('-').map(Number);
    if (bound === 'start') {
      return new Date(y, mo - 1, d, 0, 0, 0, 0);
    }
    return new Date(y, mo - 1, d, 23, 59, 59, 999);
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
