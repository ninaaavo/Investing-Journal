import { doc, setDoc, Timestamp } from "firebase/firestore";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";
import { db } from "../../firebase";

const safeParse = (val) => parseFloat(val || 0);

/**
 * Generate and store snapshots from start to end date (inclusive).
 * Assumes baseSnapshot represents the day BEFORE start.
 *
 * @param {Object} options
 * @param {string} options.start - ISO date string (e.g. "2025-08-02")
 * @param {string} options.end - ISO date string (e.g. "2025-08-05")
 * @param {Object} options.baseSnapshot - Snapshot representing the day before start
 * @param {string} options.userId - Firebase UID
 * @param {Object} options.dividendMap - { [ticker]: { [dateStr]: number } }
 * @returns {Promise<Object>} - The final snapshot for the end date
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
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(cursor.toISOString().split("T")[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  const tickers = Object.keys(baseSnapshot.positions || {});
  if (tickers.length === 0) return baseSnapshot;

  const historical = await fetchHistoricalPrices(tickers, start, end);

  let currentSnapshot = baseSnapshot;

  for (const dateStr of dates) {
    let totalMarketValue = 0;
    let totalCostBasis = 0;
    let unrealizedPL = 0;

    const positions = {}; // ticker: shares

    for (const ticker of tickers) {
      const pos = currentSnapshot.positions[ticker];
      if (!pos) continue;

      const price = safeParse(historical?.[ticker]?.priceMap?.[dateStr]);
      const shares = safeParse(pos.shares);
      const fifoStack = pos.fifoStack || [];

      const costBasis = fifoStack.reduce(
        (sum, lot) => sum + safeParse(lot.shares) * safeParse(lot.price),
        0
      );
      const marketValue = shares * price;
      const posUnrealizedPL = marketValue - costBasis;

      totalMarketValue += marketValue;
      totalCostBasis += costBasis;
      unrealizedPL += posUnrealizedPL;

      positions[ticker] = shares; // ✅ simplified
    }

    const totalAssets = totalMarketValue + safeParse(currentSnapshot.cash);
    const totalPLPercent =
      totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

    const snapshot = {
      date: dateStr,
      cash: safeParse(currentSnapshot.cash),
      invested: totalMarketValue,
      totalAssets,
      netContribution: safeParse(currentSnapshot.netContribution),
      positions, // ✅ simplified
      unrealizedPL,
      totalCostBasis,
      totalMarketValue,
      totalPLPercent,
      createdAt: Timestamp.fromDate(new Date(dateStr)),
    };

    await setDoc(doc(db, "users", userId, "snapshots", dateStr), snapshot);

    // ✅ Inject dividends for this date
    await checkAndAddDividendsToUser({
      uid: userId,
      dateStr,
      positions,
      dividendMap,
      writeToSnapshot: true,
    });

    // ✅ Calculate today's dividend (from 1 ticker only per day)
    let todayDividend = 0;
    for (const [ticker, divMap] of Object.entries(dividendMap)) {
      const perShare = divMap?.[dateStr] ?? 0;
      const shares = positions[ticker] ?? 0;
      todayDividend += perShare * shares;
    }

    const prevTotalDiv = currentSnapshot.totalDividendReceived ?? 0;
    snapshot.totalDividendReceived = prevTotalDiv + todayDividend;

    // ✅ Save snapshot again with the dividend field
    await setDoc(doc(db, "users", userId, "snapshots", dateStr), snapshot);

    currentSnapshot = snapshot;
  }

  return currentSnapshot;
}
