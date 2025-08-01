// dateUtils.js

/**
 * Format a Date object to 'YYYY-MM-DD' in America/New_York timezone.
 */
export function formatToEasternDateString(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.warn("⚠️ formatToEasternDateString received invalid date:", date);
    return null;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("/", "-");
}

/**
 * Convert a 'YYYY-MM-DD' string into a Date object aligned with midnight in America/New_York time.
 */
export function toEasternDateOnly(yyyyMMddStr) {
  const [year, month, day] = yyyyMMddStr.split("-").map(Number);
  return new Date(year, month - 1, day); // Local time, not UTC
}

/**
 * Convert a Firestore Timestamp or Date object to a 'YYYY-MM-DD' string in America/New_York time.
 */
export function firestoreDateToEasternString(timestamp) {
  if (!timestamp) return null;
  const date =
    typeof timestamp.toDate === "function" ? timestamp.toDate() : timestamp;
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  return formatToEasternDateString(date);
}

/**
 * Convert a Firestore Timestamp or Date object to a Date-only object aligned with America/New_York calendar date.
 */
export function firestoreDateToEasternDateOnly(timestamp) {
  if (!timestamp) return null;
  const date =
    typeof timestamp.toDate === "function" ? timestamp.toDate() : timestamp;
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  const yyyyMMdd = formatToEasternDateString(date);
  return yyyyMMdd ? toEasternDateOnly(yyyyMMdd) : null;
}

/**
 * Compare two dates by calendar day only (ignoring time).
 */
export function isBeforeDateOnly(dateA, dateB) {
  const a = formatToEasternDateString(dateA);
  const b = formatToEasternDateString(dateB);
  if (!a || !b) return false;
  return a < b;
}

/**
 * Check if two dates fall on the same calendar day in any timezone.
 */
export function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
