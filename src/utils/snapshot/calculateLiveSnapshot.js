import { getDocs, collection } from "firebase/firestore";
import { db, auth } from "../../firebase"; // Adjust as needed
import getStockPrices from "../prices/getStockPrices"; // Make sure this returns a price map

// Assumes: currentPositions is stored in Firestore under users/{uid}/currentPositions
export async function calculateLiveSnapshot() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const positionsRef = collection(db, "users", user.uid, "currentPositions");
  const positionsSnap = await getDocs(positionsRef);

  let totalInvested = 0;
  let positions = [];
  let tickers = [];

  positionsSnap.forEach((doc) => {
    const data = doc.data();
    if (!data.ticker || !data.shares) return;

    positions.push({ id: doc.id, ...data });
    tickers.push(data.ticker);
    totalInvested += parseFloat(data.averagePriceFromFIFO || 0) * parseFloat(data.shares);
  });

  // Get live prices
  const priceMap = await getStockPrices(tickers);

  let marketValue = 0;
  const enrichedPositions = positions.map((pos) => {
    const currentPrice = priceMap[pos.ticker] || 0;
    const shares = parseFloat(pos.shares);
    const avgBuy = parseFloat(pos.averagePriceFromFIFO || 0);
    const currentVal = shares * currentPrice;

    marketValue += currentVal;

    return {
      ...pos,
      currentPrice,
      currentValue: currentVal,
      unrealizedPL: currentVal - avgBuy * shares,
    };
  });

  // Get user cash (safe to assume it's stored in `users/{uid}/metrics/financial`)
  const cashSnap = await getDocs(collection(db, "users", user.uid, "metrics"));
  let cash = 0;
  cashSnap.forEach((doc) => {
    if (doc.id === "financial") {
      const data = doc.data();
      cash = parseFloat(data.cash || 0);
    }
  });

  const totalAssets = marketValue + cash;

  return {
    totalAssets,
    invested: marketValue,
    cash,
    positions: enrichedPositions,
  };
}
