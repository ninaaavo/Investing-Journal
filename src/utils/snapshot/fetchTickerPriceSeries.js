import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

/** YYYY-MM-DD in Eastern Time (accepts Date or Timestamp or string) */
function toETDateOnly(input) {
  const d = input?.toDate ? input.toDate() : input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
}

/** Add days to an ET date string safely (use UTC noon to avoid TZ rollback) */
function addDaysET(yyyyMmDd, delta) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  // Construct at 12:00 UTC so ET formatting stays on the same calendar day
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return toETDateOnly(dt);
}

/**
 * Build a price series from dailySnapshots.
 * Returns [{ date: "YYYY-MM-DD", close: number }]
 */
export async function fetchTickerPriceSeries({
  uid,
  ticker,
  startDateISO,      // entry date (YYYY-MM-DD, ET)
  endDateISO = null, // sell date if closed (YYYY-MM-DD, ET); optional
  capDays = 2000,
  isLong,            // boolean | undefined. If undefined, auto-detect side per day.
}) {
  if (!uid || !ticker || !startDateISO) return [];

  const series = [];
  let cursor = startDateISO;
  let stopAuto = false;

  // compute "today ET" once
  const todayET = toETDateOnly(new Date());

  for (let i = 0; i < capDays; i++) {
    // stop on explicit end date or after today
    if (endDateISO && cursor > endDateISO) break;
    if (!endDateISO && cursor > todayET) break;
    if (stopAuto) break;

    const snapRef = doc(db, "users", uid, "dailySnapshots", cursor);
    const snapDoc = await getDoc(snapRef);

    if (snapDoc.exists()) {
      const data = snapDoc.data() || {};

      // Choose which book to read from:
      // - If isLong is provided, use it
      // - Otherwise, auto-detect by looking for the ticker in longPositions first, then shortPositions
      const longBook = data.longPositions || {};
      const shortBook = data.shortPositions || {};

      let book;
      if (typeof isLong === "boolean") {
        book = isLong ? longBook : shortBook;
      } else {
        book = (longBook && longBook[ticker]) ? longBook : shortBook;
      }

      const pos = (book || {})[ticker];

      // Normalize shares; handle different schemas and sign conventions
      const rawShares =
        (pos && (pos.shares ?? pos.absoluteShares ?? pos.qty ?? pos.quantity ?? pos.netShares)) ?? 0;

      // If it’s a short book and shares might be negative, compare using absolute value.
      const sharesAbs = Math.abs(Number(rawShares) || 0);

      if (!pos || sharesAbs <= 0) {
        // position disappeared → stop at the previous day if there’s no explicit endDate
        if (!endDateISO) stopAuto = true;
      } else {
        // Prefer priceAtSnapshot; fall back to a few common fields if needed
        const px = Number(
          pos.priceAtSnapshot ?? pos.mark ?? pos.close ?? pos.last ?? 0
        );

        if (px > 0) {
          // guard against accidental duplicates
          if (!series.length || series[series.length - 1].date !== cursor) {
            series.push({ date: cursor, close: px });
          }
        }
      }
    }

    cursor = addDaysET(cursor, 1); // move to next ET day
  }

  return series;
}
