import {
  collection,
  doc,
  Timestamp,
  getDocsFromServer,
  getDocFromServer,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import getStockPrices from "../prices/getStockPrices";

const safeParse = (val) => parseFloat(val || 0);

/** Yesterday in ET as YYYY-MM-DD */
function yesterdayStrET() {
  const todayET = new Date(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York" }).format(
      new Date()
    )
  );
  todayET.setDate(todayET.getDate() - 1);
  const y = todayET.getFullYear();
  const m = String(todayET.getMonth() + 1).padStart(2, "0");
  const d = String(todayET.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function calculateLiveSnapshot() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  // 🔒 Force server reads to avoid stale cache after writes
  const positionsRef = collection(db, "users", user.uid, "currentPositions");
  const positionsSnap = await getDocsFromServer(positionsRef);

  const rawPositions = [];
  const tickers = [];

  positionsSnap.forEach((snap) => {
    const data = snap.data();
    if (!data.ticker || !data.shares) return;
    rawPositions.push({ id: snap.id, ...data });
    tickers.push(data.ticker);
  });

  const priceData = await getStockPrices(tickers); // { [ticker]: { price } } or { [ticker]: number }
  console.log("your price data is", priceData);

  // 🔒 Force server read for financial metrics too
  const financialRef = doc(db, "users", user.uid, "metrics", "financial");
  const financialSnap = await getDocFromServer(financialRef);
  const financialData = financialSnap.exists() ? financialSnap.data() : {};

  const cash = safeParse(financialData.cash);
  const netContribution = safeParse(financialData.netContribution);

  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let unrealizedPL = 0;

  const enrichedPositions = {};

  for (const pos of rawPositions) {
    const ticker = pos.ticker;

    // accept either {ticker: {price}} or {ticker: number}
    const raw = priceData?.[ticker];
    const price = safeParse(
      raw && typeof raw === "object" ? raw.price : raw
    );

    const shares = safeParse(pos.shares);
    const fifoStack = Array.isArray(pos.fifoStack) ? pos.fifoStack : [];

    // ✅ Use your stack’s shape first (sharesRemaining, entryPrice), then fallback
    let costBasis = fifoStack.reduce((sum, lot) => {
      const lotShares =
        safeParse(lot.sharesRemaining ?? lot.shares ?? 0);
      const lotPrice =
        safeParse(lot.entryPrice ?? lot.price ?? 0);
      return sum + lotShares * lotPrice;
    }, 0);

    if (costBasis === 0 && pos.averagePrice && shares > 0) {
      costBasis = shares * safeParse(pos.averagePrice);
    }

    const marketValue = shares * price;
    const posUnrealizedPL = marketValue - costBasis;

    totalMarketValue += marketValue;
    totalCostBasis += costBasis;
    unrealizedPL += posUnrealizedPL;

    enrichedPositions[ticker] = {
      ...pos,
      priceAtSnapshot: price,
      currentValue: marketValue,
      costBasis,
      unrealizedPL: posUnrealizedPL,
    };
  }

  const totalAssets = totalMarketValue + cash;
  const totalPLPercent = totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

  // ✅ Get totalDividendReceived from yesterday’s snapshot (ET‑correct)
  let totalDividendReceived = 0;
  const yesterdayStr = yesterdayStrET();
  try {
    const prevSnapRef = doc(db, "users", user.uid, "snapshots", yesterdayStr);
    const prevSnap = await getDocFromServer(prevSnapRef);
    totalDividendReceived = prevSnap.exists()
      ? safeParse(prevSnap.data()?.totalDividendReceived)
      : 0;
  } catch (err) {
    console.warn("Could not fetch yesterday's snapshot dividend:", err?.message || err);
  }

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
    totalDividendReceived,
    createdAt: Timestamp.now(),
  };
}
