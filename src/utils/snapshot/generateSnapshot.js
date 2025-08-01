import { auth, db } from "../../firebase";
import getStockPrices from "../prices/getStockPrices";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import { Timestamp, collection, getDocs, doc } from "firebase/firestore";

const safeParse = (val) => parseFloat(val || 0);

export default async function generateSnapshot({
  date = null,
  baseSnapshot = null,
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const positionsRef = collection(db, "users", user.uid, "currentPositions");
  const positionsSnap = await getDocs(positionsRef);

  const rawPositions = [];
  const tickers = [];

  positionsSnap.forEach((doc) => {
    const data = doc.data();
    if (!data.ticker || !data.shares) return;

    rawPositions.push({ id: doc.id, ...data });
    tickers.push(data.ticker);
  });

  // === Price lookup ===
  const priceMap =
    date === null
      ? await getStockPrices(tickers)
      : await fetchHistoricalPrices(tickers, date);

  console.log("Your price map is", priceMap);

  const cash = safeParse(baseSnapshot?.cash);
  const netContribution = safeParse(baseSnapshot?.netContribution);
  const prevPositions = baseSnapshot?.positions || {};

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

  const totalAssets = totalMarketValue + cash;
  const totalPLPercent =
    totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

  return {
    cash,
    invested: totalMarketValue,
    totalAssets,
    netContribution,
    positions: enrichedPositions, // ✅ converted to object format
    unrealizedPL,
    totalCostBasis,
    totalMarketValue,
    totalPLPercent,
    createdAt: Timestamp.now(),
  };
}
