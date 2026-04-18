/**
 * Store-facing wall clock in an IANA timezone (default Asia/Kolkata).
 * Keeps MySQL DATETIME `b.date` aligned with `DATE(b.date)` filters and HTML date pickers.
 */

export function getAppTimeZone() {
  const raw = process.env.APP_TIMEZONE;
  const t = typeof raw === 'string' ? raw.trim() : '';
  return t || 'Asia/Kolkata';
}

/**
 * @param {Date|string|number} input
 * @param {string} [timeZone]
 * @returns {string} `YYYY-MM-DD HH:mm:ss` (naive wall time in that zone)
 */
export function formatInstantAsMysqlNaiveInTimeZone(input, timeZone = getAppTimeZone()) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError('Invalid date');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(d);
  const map = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  );
  const y = map.year;
  const mo = map.month;
  const da = map.day;
  const h = map.hour;
  const mi = map.minute;
  const se = map.second;
  return `${y}-${mo}-${da} ${h}:${mi}:${se}`;
}

/**
 * Resolve MySQL DATETIME string for `bills.date` (and matching created_at on insert).
 * - No body date: "now" in APP_TIMEZONE.
 * - Plain YYYY-MM-DD: that calendar day + current clock in APP_TIMEZONE (POS business day).
 * - Otherwise: parse as instant, convert to wall in APP_TIMEZONE.
 */
export function resolveBillMysqlDatetime(rawDate, timeZone = getAppTimeZone()) {
  if (rawDate === undefined || rawDate === null || rawDate === '') {
    return formatInstantAsMysqlNaiveInTimeZone(new Date(), timeZone);
  }
  const s = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const wallNow = formatInstantAsMysqlNaiveInTimeZone(new Date(), timeZone);
    return `${s} ${wallNow.slice(11)}`;
  }
  const instant = new Date(s);
  if (Number.isNaN(instant.getTime())) {
    return formatInstantAsMysqlNaiveInTimeZone(new Date(), timeZone);
  }
  return formatInstantAsMysqlNaiveInTimeZone(instant, timeZone);
}
