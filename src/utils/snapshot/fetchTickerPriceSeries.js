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
  // FIX: construct at 12:00 UTC so ET formatting stays on the same calendar day
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
}) {
  if (!uid || !ticker || !startDateISO) return [];

  const series = [];
  let cursor = startDateISO;
  let stopAuto = false;

  // FIX: compute "today ET" once
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
      const pos = (data.positions || {})[ticker];

      if (!pos || Number(pos.shares ?? 0) <= 0) {
        // position disappeared → stop at the previous day
        if (!endDateISO) stopAuto = true;
      } else {
        const px = Number(pos.priceAtSnapshot ?? 0);
        if (px > 0) {
          // FIX: guard against accidental duplicates
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
