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

/** Safe unit price from a LONG position snapshot */
function unitPriceFromLongPos(pos) {
  const p = Number(pos?.priceAtSnapshot ?? 0);
  if (p) return p;
  const shares = Number(pos?.shares ?? 0);
  const mv = Number(pos?.marketValue ?? 0);
  return shares > 0 ? mv / shares : 0;
}

/** Helpers to read v2 (fallback to legacy) */
const getLongMap = (snap) => snap?.longPositions || snap?.positions || {};
const getShortMap = (snap) => snap?.shortPositions || {};
const getUnrealizedNet = (snap) =>
  Number(
    snap?.totals?.unrealizedPLNet ??
      snap?.unrealizedPL /* legacy, may be long-only */
  ) || 0;
const getTotalCostBasisLong = (snap) =>
  Number(
    snap?.totalCostBasis ??
      Object.values(getLongMap(snap)).reduce(
        (s, p) => s + Number(p?.costBasis ?? 0),
        0
      )
  ) || 0;

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

  // v2: fix zeros across long & short maps
  const tickersWithZeroV2 = [
    ...Object.entries(getLongMap(data))
      .filter(([_, p]) => Number(p?.priceAtSnapshot ?? 0) === 0)
      .map(([tk]) => tk),
    ...Object.entries(getShortMap(data))
      .filter(([_, p]) => Number(p?.priceAtSnapshot ?? 0) === 0)
      .map(([tk]) => tk),
  ];

  if (tickersWithZeroV2.length) {
    for (const ticker of tickersWithZeroV2) {
      await lazyFixSnapshotPrice({ userId: uid, ticker, date: dateStr });
    }
    const fixed = await getDoc(ref);
    if (fixed.exists()) data = fixed.data();
  } else if (data?.positions) {
    // legacy fallback
    const tickersWithZero = Object.entries(data.positions)
      .filter(([_, p]) => Number(p?.priceAtSnapshot ?? 0) === 0)
      .map(([ticker]) => ticker);
    if (tickersWithZero.length) {
      for (const ticker of tickersWithZero) {
        await lazyFixSnapshotPrice({ userId: uid, ticker, date: dateStr });
      }
      const fixed = await getDoc(ref);
      if (fixed.exists()) data = fixed.data();
    }
  }

  return data;
}

/** OPEN P/L = net unrealized (long + short); % uses total long cost basis */
export async function getOpenPLFromSnapshot(todaySnapshot) {
  if (!todaySnapshot) return "N/A";
  const totalPL = getUnrealizedNet(todaySnapshot);
  const denom = getTotalCostBasisLong(todaySnapshot);
  return formatPLAndPct(totalPL, denom);
}

/**
 * DAY P/L (no cash model)
 * Intraday unrealized on OPEN positions + today's realized P/L.
 * - Longs:
 *     baseline = yesterday close if existed yesterday; else today's avg cost/share
 *     intraday = (todayPrice - baseline) * todayShares
 * - Shorts:
 *     baseline = yesterday close if existed yesterday; else today's avgShortPrice
 *     intraday = (baseline - todayPrice) * todayShares
 * Denominator for % is today's total long cost basis.
 */
export async function getDayPLFromSnapshots(todaySnapshot) {
  const user = auth.currentUser;
  if (!user || !todaySnapshot) return "N/A";

  const uid = user.uid;
  const yStr = yesterdayStrET();
  const tStr = todayStrET();

  // Load/fix yesterday snapshot (v2-aware)
  let ySnap = null;
  try {
    ySnap = await loadSnapshotFixed(uid, yStr);
  } catch (e) {
    console.warn("Could not load/fix yesterday snapshot:", e);
  }

  // Today's realized P/L
  let realizedToday = 0;
  try {
    const rRef = doc(db, "users", uid, "realizedPLByDate", tStr);
    const rDoc = await getDoc(rRef);
    if (rDoc.exists()) {
      const v = Number(rDoc.data()?.realizedPL ?? 0);
      if (isFinite(v)) realizedToday = v;
    }
  } catch (e) {
    console.warn("Could not load realizedPLByDate:", e);
  }

  const tLongs = getLongMap(todaySnapshot);
  const tShorts = getShortMap(todaySnapshot);
  const yLongs = getLongMap(ySnap || {});
  const yShorts = getShortMap(ySnap || {});

  let totalUnrealized = 0;

  // ---- Longs intraday ----
  for (const [tk, tPos] of Object.entries(tLongs)) {
    const sharesToday = Number(tPos?.shares ?? 0);
    if (sharesToday <= 0) continue;

    const todayPrice = Number(tPos?.priceAtSnapshot ?? 0);
    const existedYesterday = !!yLongs[tk];

    let baseline = 0;
    if (existedYesterday) {
      // yesterday close
      baseline = Number(yLongs[tk]?.priceAtSnapshot ?? unitPriceFromLongPos(yLongs[tk]));
    } else {
      // today's avg cost/share
      const cb = Number(tPos?.costBasis ?? 0);
      baseline = sharesToday > 0 ? cb / sharesToday : 0;
    }

    totalUnrealized += (todayPrice - baseline) * sharesToday;
  }

  // ---- Shorts intraday ----
  for (const [tk, tPos] of Object.entries(tShorts)) {
    const sharesToday = Number(tPos?.shares ?? 0);
    if (sharesToday <= 0) continue;

    const todayPrice = Number(tPos?.priceAtSnapshot ?? 0);
    const existedYesterday = !!yShorts[tk];

    let baseline = 0;
    if (existedYesterday) {
      // yesterday close for shorts
      baseline = Number(yShorts[tk]?.priceAtSnapshot ?? 0);
    } else {
      // today's avg short entry
      baseline = Number(tPos?.avgShortPrice ?? 0);
    }

    totalUnrealized += (baseline - todayPrice) * sharesToday;
  }

  // Combine unrealized + realized for Day P/L
  const totalPL = totalUnrealized + realizedToday;

  // Denominator: today's total long cost basis (stable across intraday)
  const totalCostToday = getTotalCostBasisLong(todaySnapshot);

  return formatPLAndPct(totalPL, totalCostToday);
}

/**
 * TOTAL P/L BREAKDOWN (Realized + Unrealized) by timeframe
 * totalPL = (today.unrealizedNet - past.unrealizedNet) + (realized today - realized past)
 * Percent denominator = past.totalCostBasis (longs only; stable, period-accurate)
 */
export async function getTotalPLBreakdown(todaySnapshot) {
  const user = auth.currentUser;
  if (!user || !todaySnapshot) return {};

  const uid = user.uid;
  const todayStr = todayStrET();
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
  const todayUnrealized = getUnrealizedNet(todaySnapshot);

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

    const pastUnrealized = getUnrealizedNet(pastSnap || {});
    const denomPastCostBasis = getTotalCostBasisLong(pastSnap || {});

    // realized diff (same approach you had)
    let realizedSum = 0;
    try {
      const realizedRef = collection(db, "users", uid, "realizedPLByDate");

      const todayDoc = await getDoc(doc(realizedRef, todayStr));
      const todayVal = Number(todayDoc.data()?.realizedPL ?? 0);

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

    const totalPL = todayUnrealized - pastUnrealized + realizedSum;
    results[label] = formatPLAndPct(totalPL, denomPastCostBasis);
  }

  return results;
}
