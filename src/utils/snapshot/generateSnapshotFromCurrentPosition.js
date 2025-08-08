import { auth, db } from "../../firebase";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import { Timestamp, collection, getDocs, getDoc, doc } from "firebase/firestore";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";

const safeParse = (val) => parseFloat(val || 0);

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

  const positions = {}; // just ticker: shares

  for (const pos of rawPositions) {
    const ticker = pos.ticker;
    const price = safeParse(priceMap[ticker]);
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

    positions[ticker] = shares; // ✅ simplified structure
  }

  const totalAssets = totalMarketValue + cash;
  const totalPLPercent = totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

  await checkAndAddDividendsToUser({
    uid: userId,
    dateStr,
    positions,
    dividendMap,
    writeToSnapshot: true,
  });

  // Calculate today's dividend from this ticker set
  let todayDividend = 0;
  let yesterdayDividend = 0;

  for (const ticker of tickers) {
    const perShare = dividendMap[ticker]?.[dateStr] ?? 0;
    const shares = positions[ticker] ?? 0;
    todayDividend += perShare * shares;
  }

  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  try {
    const prevSnapDoc = await getDoc(doc(db, "users", userId, "snapshots", yesterdayStr));
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
    positions, // ✅ now just { ticker: shares }
    unrealizedPL,
    totalCostBasis,
    totalMarketValue,
    totalPLPercent,
    totalDividendReceived,
    createdAt: Timestamp.fromDate(new Date(dateStr)),
  };
}
