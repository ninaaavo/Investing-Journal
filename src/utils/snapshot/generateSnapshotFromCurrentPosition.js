import { auth, db } from "../../firebase";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import { Timestamp, collection, getDocs } from "firebase/firestore";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";

const safeParse = (val) => parseFloat(val || 0);

/**
 * Generate snapshot for a given past date using current positions
 * (e.g. generating yesterday's snapshot when user opens app today).
 *
 * @param {Object} options
 * @param {string} options.date - ISO date string (e.g. "2025-08-06")
 * @param {string} options.userId - Firebase UID
 * @returns {Promise<Object>} - The snapshot object
 */
export default async function generateSnapshotFromCurrentPosition({ date, userId }) {
  const positionsRef = collection(db, "users", userId, "currentPositions");
  const positionsSnap = await getDocs(positionsRef);

  const rawPositions = [];
  const tickers = [];

  positionsSnap.forEach((doc) => {
    const data = doc.data();
    if (!data.ticker || !data.shares) return;
    rawPositions.push({ id: doc.id, ...data });
    tickers.push(data.ticker);
  });

  const dateStr = new Date(date).toISOString().split("T")[0];
  const result = await fetchHistoricalPrices(tickers, dateStr, dateStr);

  const priceMap = {};
  const dividendMap = {};

  for (const ticker of tickers) {
    priceMap[ticker] = result[ticker]?.priceMap?.[dateStr] ?? 0;
    dividendMap[ticker] = result[ticker]?.dividendMap ?? {};
  }

  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let unrealizedPL = 0;
  let cash = 0;
  let netContribution = 0;

  const enrichedPositions = {};

  for (const pos of rawPositions) {
    const price = safeParse(priceMap[pos.ticker]);
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

    enrichedPositions[pos.ticker] = {
      ...pos,
      priceAtSnapshot: price,
      currentValue: marketValue,
      costBasis,
      unrealizedPL: posUnrealizedPL,
    };
  }

  const totalAssets = totalMarketValue + cash;
  const totalPLPercent = totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

  await checkAndAddDividendsToUser({
    uid: userId,
    dateStr,
    positions: enrichedPositions,
    dividendMap,
    writeToSnapshot: true,
  });

  return {
    date: dateStr,
    cash,
    invested: totalMarketValue,
    totalAssets,
    netContribution,
    positions: enrichedPositions,
    unrealizedPL,
    totalCostBasis,
    totalMarketValue,
    totalPLPercent,
    createdAt: Timestamp.fromDate(new Date(dateStr))
  };
}
