// utils/snapshot/generateSnapshotRange.js
import { doc, setDoc, Timestamp } from "firebase/firestore";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";
import { addDividendToUserDay } from "../dividends/addDividendToUserDay";
import { db } from "../../firebase";

const safeParse = (val) => parseFloat(val || 0);

/**
 * Generate and store snapshots from start to end date (inclusive).
 * Assumes baseSnapshot is the snapshot for the day BEFORE `start`.
 * This version also writes dividendHistory for each day WITHOUT double-counting totals.
 *
 * @param {Object} options
 * @param {string} options.start - ISO date string (e.g. "2025-08-02")
 * @param {string} options.end - ISO date string (e.g. "2025-08-05")
 * @param {Object} options.baseSnapshot - Snapshot representing the day before start
 * @param {string} options.userId - Firebase UID
 * @param {Object} [options.dividendMap] - Optional { [ticker]: { [dateStr]: number } }, else fetched from prices
 * @returns {Promise<Object>} - Final snapshot for the end date
 */
export default async function generateSnapshotRange({
  start,
  end,
  baseSnapshot,
  userId,
  dividendMap = {},
}) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const dates = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }

  const tickers = Object.keys(baseSnapshot.positions || {});
  if (tickers.length === 0) return baseSnapshot;

  // Get prices for whole span
  const historical = await fetchHistoricalPrices(tickers, start, end);

  let currentSnapshot = baseSnapshot;

  for (const dateStr of dates) {
    let totalMarketValue = 0;
    let totalCostBasis = 0;
    let unrealizedPL = 0;

    const enrichedPositions = {};
    const simplifiedPositions = {};

    for (const tk of tickers) {
      const pos = currentSnapshot.positions[tk];
      if (!pos) continue;

      const price = safeParse(historical?.[tk]?.priceMap?.[dateStr]);
      const shares = safeParse(pos.shares);
      const fifoStack = pos.fifoStack || [];

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

    // Build or take dividend map for this day
    const dayDividendMap = {};
    for (const tk of tickers) {
      // prefer provided dividendMap override, else from fetched data
      dayDividendMap[tk] = (dividendMap[tk] ?? historical?.[tk]?.dividendMap) || {};
    }

    // Compute dividends for the day WITHOUT writing to Firestore yet
    const { totalDividendByDate, dailyDividendMap } =
      await checkAndAddDividendsToUser({
        uid: userId,
        from: dateStr,
        to: dateStr,
        positions: simplifiedPositions,
        dividendMap: dayDividendMap,
        writeToSnapshot: false,
      });

    const todayDividend = totalDividendByDate[dateStr] ?? 0;
    const prevTotalDiv = Number(currentSnapshot.totalDividendReceived || 0);

    const snapshot = {
      date: dateStr,
      invested: totalMarketValue,
      totalAssets,
      netContribution: safeParse(currentSnapshot.netContribution),
      positions: enrichedPositions,
      unrealizedPL,
      totalCostBasis,
      totalMarketValue,
      totalPLPercent,
      totalDividendReceived: prevTotalDiv + todayDividend,
      // Keep details for UI
      dividends: dailyDividendMap[dateStr] ?? [],
      createdAt: Timestamp.fromDate(new Date(dateStr)),
    };

    // Write the snapshot for the day
    await setDoc(doc(db, "users", userId, "dailySnapshots", dateStr), snapshot);

    // Write dividendHistory for that day WITHOUT bumping snapshot totals
    try {
      const details = dailyDividendMap[dateStr] || [];
      for (const entry of details) {
        await addDividendToUserDay({
          uid: userId,
          dateStr,
          ticker: entry.ticker,
          amountPerShare: Number(entry.amountPerShare) || 0,
          sharesApplied: Number(entry.sharesHeld ?? entry.shares ?? 0) || 0,
          updateSnapshot: false, // we already set totalDividendReceived in `snapshot`
        });
      }
    } catch (e) {
      console.warn(`Dividend history write failed for ${dateStr}:`, e?.message);
    }

    currentSnapshot = snapshot;
  }

  return currentSnapshot;
}
