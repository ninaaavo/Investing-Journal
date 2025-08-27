// utils/computeCumulativeRealizedForDate.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase"; // adjust path if needed

// If you already created this elsewhere, just import it instead.
export async function getRealizedDeltaForDate(userId, dateISO) {
  try {
    const ref = doc(db, "users", userId, "realizedPLByDate", dateISO);
    const snap = await getDoc(ref);
    if (!snap.exists()) return 0;
    const val = Number(snap.data()?.realizedPL ?? 0);
    return Number.isFinite(val) ? val : 0;
  } catch (e) {
    console.warn("[getRealizedDeltaForDate] failed:", e?.message);
    return 0;
  }
}

function isoMinusDays(dateISO, days) {
  const [Y, M, D] = dateISO.split("-").map(Number);
  const d = new Date(Y, M - 1, D);
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

/**
 * Compute cumulative realized P&L for a given date by:
 *   realizedCum(date) = realizedCum(date-1) + realizedLedger(date)
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {string} args.dateISO   // YYYY-MM-DD snapshot date to compute
 * @param {number} [args.prevCum] // optional: if provided, we won't read yesterday's snapshot
 * @returns {Promise<number>}
 */
export async function computeCumulativeRealizedForDate({ userId, dateISO, prevCum }) {
  let realizedCumPrev = Number(prevCum ?? 0);

  // If prevCum not supplied, read yesterday's snapshot once
  if (prevCum === undefined) {
    try {
      const prevISO = isoMinusDays(dateISO, 1);
      const prevRef = doc(db, "users", userId, "dailySnapshots", prevISO);
      const prevSnap = await getDoc(prevRef);
      realizedCumPrev = prevSnap.exists()
        ? Number(prevSnap.data()?.totals?.realizedPL || 0) || 0
        : 0;
    } catch (e) {
      console.warn("[computeCumulativeRealizedForDate] prev read failed:", e?.message);
      realizedCumPrev = 0;
    }
  }

  const realizedToday = await getRealizedDeltaForDate(userId, dateISO);
  return realizedCumPrev + realizedToday;
}
