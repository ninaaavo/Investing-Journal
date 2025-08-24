// utils/getDividendValuesFromSnapshots.js
import { auth, db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import getOrGenerateSnapshot from "../snapshot/getOrGenerateSnapshot";

/** ET helpers (consistent with your other date utils) */
function formatETDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Build a Date in ET from YYYY-MM-DD (at 00:00 ET), then shift by `delta` days (UTC math) */
function addDaysET(yyyyMmDd, delta) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return formatETDate(dt);
}

/** Currency formatter */
function fmtUSD(n) {
  const val = Number(n || 0);
  return val.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Read cumulative dividend at date (or generate if missing) */
async function getCumulativeDividendAt(uid, dateStr) {
  const ref = doc(db, "users", uid, "dailySnapshots", dateStr);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return Number(snap.data()?.totalDividendReceived || 0);
  }
  // Generate on the fly if not present (re-uses your existing pipeline)
  const gen = await getOrGenerateSnapshot(dateStr);
  return Number(gen?.totalDividendReceived || 0);
}

/**
 * Returns a map like { "1D": "$12.34", "1W": "$56.78", ... }
 * Range math:
 *   sum(range) = cumulative(TODAY) - cumulative(start - 1 day)
 */
export async function getDividendBreakdown(todaySnapshot) {
  const user = auth.currentUser;
  if (!user || !todaySnapshot?.date) return {
    "1D": "N/A", "1W": "N/A", "1M": "N/A", "3M": "N/A", "1Y": "N/A", "All": "N/A"
  };

  const uid = user.uid;
  const todayStr = todaySnapshot.date; // e.g., "2025-08-24"

  // Define range starts (inclusive)
  const starts = {
    "1D": addDaysET(todayStr, -1),
    "1W": addDaysET(todayStr, -7),
    "1M": addDaysET(todayStr, -30),
    "3M": addDaysET(todayStr, -90),
    "1Y": addDaysET(todayStr, -365),
  };

  // cumulative at today
  const cumToday = await getCumulativeDividendAt(uid, todayStr);

  const out = {};
  // All-time is just today's cumulative
  out["All"] = fmtUSD(cumToday);

  // For each rolling window, subtract cumulative at (start - 1)
  for (const [label, startStr] of Object.entries(starts)) {
    const beforeStart = addDaysET(startStr, -1);
    const cumBefore = await getCumulativeDividendAt(uid, beforeStart).catch(() => 0) ?? 0;
    const sum = Math.max(0, cumToday - cumBefore);
    out[label] = fmtUSD(sum);
  }

  return out;
}
