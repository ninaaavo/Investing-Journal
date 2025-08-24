// utils/snapshot/generateSnapshotFromCurrentPosition.js
import { db } from "../../firebase";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import {
  Timestamp,
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";
import { addDividendToUserDay } from "../dividends/addDividendToUserDay";

const safeParse = (val) => parseFloat(val || 0);

/**
 * Generate snapshot for a given past date using current positions (used for “yesterday”).
 * On each run (Day T building T-1):
 *   1) Reconcile T-2 dividends (writes history + bumps that day’s totals if needed)
 *   2) Compute T-1 dividends (no writes yet), include in T-1 snapshot totals
 *   3) Write dividendHistory for T-1 WITHOUT bumping snapshot totals again
 *
 * @param {Object} options
 * @param {string} options.date - ISO date string (e.g. "2025-08-06")  // the day we are generating for
 * @param {string} options.userId - Firebase UID
 * @returns {Promise<Object>} - Snapshot object for `date`
 */
export default async function generateSnapshotFromCurrentPosition({
  date,
  userId,
}) {
  const positionsRef = collection(db, "users", userId, "currentPositions");
  const positionsSnap = await getDocs(positionsRef);

  const rawPositions = [];
  const tickers = [];

  positionsSnap.forEach((d) => {
    const data = d.data();
    if (!data.ticker || !data.shares) return;
    rawPositions.push({ id: d.id, ...data });
    tickers.push(data.ticker);
  });

  const dateStr = new Date(date).toISOString().split("T")[0];
  const hist = await fetchHistoricalPrices(tickers, dateStr, dateStr);

  const priceMap = {};
  const dividendMap = {};
  for (const tk of tickers) {
    priceMap[tk] = hist[tk]?.priceMap?.[dateStr] ?? 0;
    dividendMap[tk] = hist[tk]?.dividendMap ?? {};
  }

  // ---------- (1) Reconcile T-2 ----------
  try {
    const d2 = new Date(date);
    d2.setDate(d2.getDate() - 2);
    const d2Str = d2.toISOString().split("T")[0];

    const d2SnapRef = doc(db, "users", userId, "dailySnapshots", d2Str);
    const d2SnapDoc = await getDoc(d2SnapRef);

    if (d2SnapDoc.exists()) {
      const d2Snap = d2SnapDoc.data() || {};
      const d2Positions = {};
      for (const [tk, pos] of Object.entries(d2Snap.positions || {})) {
        const sh = Number(pos?.shares || 0);
        if (sh !== 0) d2Positions[tk] = sh;
      }

      if (Object.keys(d2Positions).length > 0) {
        // Build a filtered dividendMap only for tickers present on T-2
        const d2DivMap = {};
        for (const tk of Object.keys(d2Positions)) {
          d2DivMap[tk] = dividendMap[tk] || {};
        }

        // This will create/merge dividendHistory for T-2 and bump snapshot totals if needed
        await checkAndAddDividendsToUser({
          uid: userId,
          from: d2Str,
          to: d2Str,
          positions: d2Positions,
          dividendMap: d2DivMap,
          writeToSnapshot: true,
        });
      }
    }
  } catch (e) {
    console.warn("T-2 dividend reconcile skipped/failed:", e?.message);
  }

  // ---------- Build positions & P/L for dateStr ----------
  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let unrealizedPL = 0;

  const enrichedPositions = {};
  const simplifiedPositions = {}; // {ticker: shares} for dividend calc

  for (const pos of rawPositions) {
    const tk = pos.ticker;
    const price = safeParse(priceMap[tk]);
    const shares = safeParse(pos.shares);
    const fifoStack = (pos.fifoStack || []).map((e) => ({
      price: e.entryPrice,
      shares: e.sharesRemaining,
    }));

    const costBasis = fifoStack.reduce(
      (sum, lot) => sum + safeParse(lot.shares) * safeParse(lot.price),
      0
    );
    const marketValue = shares * price;
    const posUPL = marketValue - costBasis;

    totalMarketValue += marketValue;
    totalCostBasis += costBasis;
    unrealizedPL += posUPL;

    enrichedPositions[tk] = {
      costBasis,
      fifoStack,
      marketValue,
      priceAtSnapshot: price,
      shares,
      unrealizedPL: posUPL,
    };
    simplifiedPositions[tk] = shares;
  }

  const totalAssets = totalMarketValue;
  const totalPLPercent = totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

  // ---------- (2) Compute T-1 dividends (no writes to DB yet) ----------
  const { totalDividendByDate, dailyDividendMap } =
    await checkAndAddDividendsToUser({
      uid: userId,
      from: dateStr,
      to: dateStr,
      positions: simplifiedPositions,
      dividendMap,
      writeToSnapshot: false,
    });

  const todayDividend = totalDividendByDate[dateStr] ?? 0;

  // Get T-2 cumulative dividend total to carry forward
  let prevTotalDividend = 0;
  try {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevStr = prevDate.toISOString().split("T")[0];
    const prevSnapDoc = await getDoc(doc(db, "users", userId, "dailySnapshots", prevStr));
    prevTotalDividend = prevSnapDoc.exists()
      ? Number(prevSnapDoc.data()?.totalDividendReceived || 0)
      : 0;
  } catch (err) {
    console.warn("Failed to read previous snapshot for dividend carry:", err?.message);
  }

  const totalDividendReceived = prevTotalDividend + todayDividend;

  // ---------- Build snapshot object ----------
  const snapshot = {
    date: dateStr,
    invested: totalMarketValue,
    totalAssets,
    netContribution: 0,
    positions: enrichedPositions,
    unrealizedPL,
    totalCostBasis,
    totalMarketValue,
    totalPLPercent,
    totalDividendReceived,
    // Keep per-day dividend details for UI
    dividends: dailyDividendMap[dateStr] ?? [],
    createdAt: Timestamp.fromDate(new Date(dateStr)),
  };

  // ---------- (3) Write dividendHistory for T-1 without double-adding totals ----------
  try {
    const details = dailyDividendMap[dateStr] || [];
    for (const entry of details) {
      await addDividendToUserDay({
        uid: userId,
        dateStr,
        ticker: entry.ticker,
        amountPerShare: Number(entry.amountPerShare) || 0,
        // map your structure -> sharesApplied expected by writer
        sharesApplied: Number(entry.sharesHeld ?? entry.shares ?? 0) || 0,
        updateSnapshot: false, // don't bump snapshot totals; we already set them above
      });
    }

  } catch (e) {
    console.warn("Recording dividendHistory for T-1 failed:", e?.message);
  }

  return snapshot;
}
