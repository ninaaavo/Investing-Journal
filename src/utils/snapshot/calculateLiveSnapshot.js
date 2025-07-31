import { getDocs, collection, doc, getDoc, Timestamp } from "firebase/firestore";
import { db, auth } from "../../firebase";
import getStockPrices from "../prices/getStockPrices";

const safeParse = (val) => parseFloat(val || 0);

export async function calculateLiveSnapshot() {
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

  const priceMap = await getStockPrices(tickers);

  // Get financial metrics
  const financialRef = doc(db, "users", user.uid, "metrics", "financial");
  const financialSnap = await getDoc(financialRef);
  const financialData = financialSnap.exists() ? financialSnap.data() : {};

  const cash = safeParse(financialData.cash);
  const netContribution = safeParse(financialData.netContribution);

  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let unrealizedPL = 0;
  const enrichedPositions = {};

  for (const pos of rawPositions) {
    const price = safeParse(priceMap[pos.ticker]);
    const shares = safeParse(pos.shares);

    const fifoStack = Array.isArray(pos.fifoStack) ? pos.fifoStack : [];

    // Cost basis from FIFO
    let costBasis = fifoStack.reduce(
      (sum, lot) => sum + safeParse(lot.shares) * safeParse(lot.price),
      0
    );

    // Fallback to averagePrice if FIFO is empty or invalid
    if (costBasis === 0 && pos.averagePrice && shares > 0) {
      costBasis = shares * safeParse(pos.averagePrice);
    }

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

  return {
    cash,
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
