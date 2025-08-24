import { auth, db } from "../../firebase";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import { Timestamp, collection, getDocs } from "firebase/firestore";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";

const safeParse = (val) => parseFloat(val || 0);

export default async function generateSnapshot({
  date = null,
  baseSnapshot = null,
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const uid = user.uid;

  const positionsRef = collection(db, "users", uid, "currentPositions");
  const positionsSnap = await getDocs(positionsRef);

  const rawPositions = [];
  const tickers = [];

  positionsSnap.forEach((doc) => {
    const data = doc.data();
    if (!data.ticker || !data.shares) return;

    rawPositions.push({ id: doc.id, ...data });
    tickers.push(data.ticker);
  });

  const targetDate = date ? new Date(date) : new Date();
  const dateStr = targetDate.toISOString().split("T")[0];

  // ✅ Pass dateStr as string to avoid timezone drift
  const result = await fetchHistoricalPrices(tickers, dateStr, dateStr);

  const priceMap = {};
  const dividendMap = {};

  for (const ticker of tickers) {
    priceMap[ticker] = result[ticker]?.priceMap?.[dateStr] ?? 0;
    dividendMap[ticker] = result[ticker]?.dividendMap ?? {};
  }

  console.log("Your price map is", priceMap);

  const netContribution = safeParse(baseSnapshot?.netContribution);
  // const prevPositions = baseSnapshot?.positions || {};

  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let unrealizedPL = 0;

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

  const totalAssets = totalMarketValue;
  const totalPLPercent = totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

  // ✅ Inject dividendMap directly to avoid double-fetching
  await checkAndAddDividendsToUser({
    uid,
    dateStr,
    positions: enrichedPositions,
    dividendMap,
    writeToSnapshot: true,
  });

  return {
    invested: totalMarketValue,
    totalAssets,
    netContribution,
    positions: enrichedPositions,
    unrealizedPL,
    totalCostBasis,
    totalMarketValue,
    totalPLPercent,
    createdAt: Timestamp.now(),
  };
}
