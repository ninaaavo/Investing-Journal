import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import getOrGenerateSnapshot from "./snapshot/getOrGenerateSnapshot";
import { lazyFixSnapshotPrice } from "./lazyFetchSnapshot";

/** Format like "+$994.00 (+12.3%)" */
function formatPLAndPct(totalPL, denom) {
  const money =
    `${totalPL >= 0 ? "+" : "-"}$` +
    Math.abs(totalPL).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const pctNum = denom > 0 ? (totalPL / denom) * 100 : 0;
  const pct = `${pctNum >= 0 ? "+" : ""}${pctNum.toFixed(1)}%`;
  return `${money} (${pct})`;
}

/** Safe unit price from a position snapshot */
function unitPriceFromPos(pos, fallbackShares) {
  const p = pos?.priceAtSnapshot;
  if (p != null) return Number(p);
  const shares = Number(
    pos?.shares ?? (fallbackShares != null ? fallbackShares : 0)
  );
  const mv = Number(pos?.marketValue ?? 0);
  return shares > 0 ? mv / shares : 0;
}

/** YYYY-MM-DD in America/New_York */
function formatETDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("/", "-");
}

/** YYYY-MM-DD (ET) string for "today" */
function todayStrET() {
  return formatETDate(new Date());
}

/** Yesterday in ET as YYYY-MM-DD */
function yesterdayStrET() {
  const todayET = new Date(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York" }).format(
      new Date()
    )
  );
  todayET.setDate(todayET.getDate() - 1);
  return formatETDate(todayET);
}
/** Format a Date as YYYY-MM-DD using UTC fields (no tz shifts) */
function formatYMDUTC(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Add days to an ET date string (YYYY-MM-DD) using pure calendar math */
function addDaysET(yyyyMmDd, delta) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d)); // anchor at UTC midnight for that calendar day
  dt.setUTCDate(dt.getUTCDate() + delta); // add days in UTC (no DST surprises)
  return formatYMDUTC(dt); // format in UTC (no ET re-interpretation)
}

/** Load a snapshot for dateStr; if missing, generate; lazily fix zero prices */
async function loadSnapshotFixed(uid, dateStr) {
  const ref = doc(db, "users", uid, "dailySnapshots", dateStr);
  let snapDoc = await getDoc(ref);
  let data = snapDoc.exists()
    ? snapDoc.data()
    : await getOrGenerateSnapshot(dateStr);

  if (data?.positions) {
    const tickersWithZero = Object.entries(data.positions)
      .filter(([_, p]) => Number(p?.priceAtSnapshot ?? 0) === 0)
      .map(([ticker]) => ticker);

    for (const ticker of tickersWithZero) {
      await lazyFixSnapshotPrice({ userId: uid, ticker, date: dateStr });
    }
    const fixed = await getDoc(ref);
    if (fixed.exists()) data = fixed.data();
  }
  return data;
}

/** OPEN P/L = sum((currentValue - costBasis)) and % = / totalCostBasis */
export async function getOpenPLFromSnapshot(todaySnapshot) {
  if (!todaySnapshot) return "N/A";

  let totalPL = 0;
  let totalCost = 0;

  const positions = todaySnapshot.positions || {};
  for (const ticker of Object.keys(positions)) {
    const pos = positions[ticker] || {};
    const currentValue = Number(pos.currentValue ?? 0);
    const costBasis = Number(pos.costBasis ?? 0);
    totalPL += currentValue - costBasis;
    totalCost += costBasis;
  }

  return formatPLAndPct(totalPL, totalCost);
}

/**
 * DAY P/L
 * - If position opened today: (todayPrice - buyPriceToday) * todayShares
 * - Else: (todayPrice - yesterdayClose) * todayShares
 * Denominator for % is today's total cost basis.
 */
export async function getDayPLFromSnapshots(todaySnapshot) {
  const user = auth.currentUser;
  if (!user || !todaySnapshot) return "N/A";

  const yStr = yesterdayStrET();
  const tStr = todayStrET();

  // --- Load / fix yesterday snapshot (unchanged) ---
  let ySnap = null;
  try {
    const yRef = doc(db, "users", user.uid, "dailySnapshots", yStr);
    const yDoc = await getDoc(yRef);
    ySnap = yDoc.exists() ? yDoc.data() : await getOrGenerateSnapshot(yStr);

    if (ySnap?.positions) {
      const tickersWithZero = Object.entries(ySnap.positions)
        .filter(([_, p]) => Number(p?.priceAtSnapshot ?? 0) === 0)
        .map(([ticker]) => ticker);

      for (const ticker of tickersWithZero) {
        await lazyFixSnapshotPrice({ userId: user.uid, ticker, date: yStr });
      }
      const fixed = await getDoc(yRef);
      if (fixed.exists()) ySnap = fixed.data();
    }
  } catch (e) {
    console.warn("Could not load/fix yesterday snapshot:", e);
  }

  // --- Pull today's realized P/L from realizedPLByDate/{YYYY-MM-DD} ---
  let realizedToday = 0;
  try {
    const rRef = doc(db, "users", user.uid, "realizedPLByDate", tStr);
    const rDoc = await getDoc(rRef);
    if (rDoc.exists()) {
      const v = Number(rDoc.data()?.realizedPL ?? 0);
      if (isFinite(v)) realizedToday = v;
    }
  } catch (e) {
    console.warn("Could not load realizedPLByDate:", e);
  }

  // --- Unrealized intraday P/L on open positions (your logic) ---
  const todayPositions = todaySnapshot.positions || {};
  const yPositions = ySnap?.positions || {};

  let totalUnrealized = 0;
  let totalCostToday = 0;

  for (const ticker of Object.keys(todayPositions)) {
    const tPos = todayPositions[ticker] || {};
    const sharesToday = Number(tPos.shares ?? 0);
    if (sharesToday <= 0) continue;

    const todayUnitPrice = unitPriceFromPos(tPos, sharesToday);

    const openedToday =
      (tPos.entryDate && String(tPos.entryDate) === tStr) || false;

    let baselinePrice = 0;

    if (openedToday) {
      const avg = tPos.averagePrice != null ? Number(tPos.averagePrice) : null;
      if (avg != null && isFinite(avg)) {
        baselinePrice = avg;
      } else {
        const cost = Number(tPos.costBasis ?? 0);
        baselinePrice = sharesToday > 0 ? cost / sharesToday : 0;
      }
    } else {
      const yPos = yPositions[ticker];
      if (yPos) {
        baselinePrice = unitPriceFromPos(yPos, Number(yPos?.shares ?? 0));
      } else {
        baselinePrice = todayUnitPrice; // no yesterday → 0 impact
      }
    }

    const plForTicker = (todayUnitPrice - baselinePrice) * sharesToday;
    totalUnrealized += plForTicker;

    totalCostToday += Number(tPos.costBasis ?? 0);
  }

  // --- Combine unrealized + realized for Day P/L ---
  const totalPL = totalUnrealized + realizedToday;

  return formatPLAndPct(totalPL, totalCostToday);
}

/**
 * TOTAL P/L BREAKDOWN (Realized + Unrealized) by timeframe
 * totalPL = (today.unrealizedPL - past.unrealizedPL) + sum(realizedPL, (past, today])
 * Percent denominator = past.totalCostBasis (stable, period-accurate)
 */
export async function getTotalPLBreakdown(todaySnapshot) {
  const user = auth.currentUser;
  if (!user || !todaySnapshot) return {};

  const uid = user.uid;
  const todayStr = todayStrET();
  console.log("yoru today snapshot is", todaySnapshot);
  const timeFrames = {
    "1D": 1,
    "1W": 7,
    "1M": 30,
    "3M": 90,
    "1Y": 365,
    All: null,
  };

  // Need firstSnapshotDate for All
  let firstDateStr = null;
  try {
    const uDoc = await getDoc(doc(db, "users", uid));
    firstDateStr = uDoc.exists() ? uDoc.data().firstSnapshotDate : null;
  } catch {}

  const results = {};
  const todayUnrealized = Number(todaySnapshot.unrealizedPL ?? 0);

  for (const [label, days] of Object.entries(timeFrames)) {
    let pastStr;
    if (label === "All") {
      if (!firstDateStr) {
        results[label] = "N/A";
        continue;
      }
      pastStr = firstDateStr;
    } else {
      pastStr = addDaysET(todayStr, -days);
    }

    // past snapshot (for unrealized baseline AND percent denominator)
    let pastSnap = null;
    try {
      pastSnap = await loadSnapshotFixed(uid, pastStr);
    } catch (e) {
      console.warn(`Failed loading past snapshot ${pastStr}:`, e);
    }
    // console.log("im in day", days);
    const pastUnrealized = Number(pastSnap?.unrealizedPL ?? 0);
    const denomPastCostBasis = Number(pastSnap?.totalCostBasis ?? 0);
    // console.log("past snap is", pastSnap);

    // realized sum within (pastStr, todayStr]
    let realizedSum = 0;
    try {
      const realizedRef = collection(db, "users", uid, "realizedPLByDate");

      // Get today's realized PL
      const todayDoc = await getDoc(doc(realizedRef, todayStr));
      const todayVal = Number(todayDoc.data()?.realizedPL ?? 0);

      // Get past day's realized PL
      const pastDoc = await getDoc(doc(realizedRef, pastStr));
      const pastVal = Number(pastDoc.data()?.realizedPL ?? 0);

      if (Number.isFinite(todayVal) && Number.isFinite(pastVal)) {
        realizedSum = todayVal - pastVal;
      }
    } catch (e) {
      console.warn(
        `Failed calculating realized P/L diff from ${pastStr} -> ${todayStr}:`,
        e
      );
    }

    // console.log(
    //   "today unrealized is",
    //   todayUnrealized,
    //   "past unrealized is",
    //   pastUnrealized
    // );

    const totalPL = todayUnrealized - pastUnrealized + realizedSum;
    results[label] = formatPLAndPct(totalPL, denomPastCostBasis);
  }

  return results;
}
