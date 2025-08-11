import { auth, db } from "../../firebase";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import {
  Timestamp,
  collection,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";

const safeParse = (val) => parseFloat(val || 0);

/**
 * Generate snapshot for a given past date using current positions
 *
 * @param {Object} options
 * @param {string} options.date - ISO date string (e.g. "2025-08-06")
 * @param {string} options.userId - Firebase UID
 * @returns {Promise<Object>} - The snapshot object
 */
export default async function generateSnapshotFromCurrentPosition({
  date,
  userId,
}) {
  console.log("Im gen for yesterday, date is", date);
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
  const simplifiedPositions = {}; // Only ticker: shares for dividend fn

  for (const pos of rawPositions) {
    const ticker = pos.ticker;
    const price = safeParse(priceMap[ticker]);
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
    const posUnrealizedPL = marketValue - costBasis;

    totalMarketValue += marketValue;
    totalCostBasis += costBasis;
    unrealizedPL += posUnrealizedPL;

    enrichedPositions[ticker] = {
      costBasis,
      fifoStack,
      marketValue,
      priceAtSnapshot: price,
      shares,
      unrealizedPL: posUnrealizedPL,
    };

    simplifiedPositions[ticker] = shares;
  }

  const totalAssets = totalMarketValue + cash;
  const totalPLPercent = totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

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

  let yesterdayDividend = 0;
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  try {
    const prevSnapDoc = await getDoc(
      doc(db, "users", userId, "dailySnapshots", yesterdayStr)
    );
    yesterdayDividend = prevSnapDoc.exists()
      ? prevSnapDoc.data()?.totalDividendReceived ?? 0
      : 0;
  } catch (err) {
    console.warn("Could not get yesterday's snapshot:", err.message);
  }

  const totalDividendReceived = yesterdayDividend + todayDividend;

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
    totalDividendReceived,
    dividends: dailyDividendMap[dateStr] ?? [],
    createdAt: Timestamp.fromDate(new Date(dateStr)),
  };
}
