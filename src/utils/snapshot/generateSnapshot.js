import { auth, db } from "../../firebase";
import getStockPrices from "../prices/getStockPrices"; // uses live prices
import getHistoricPrices from "../prices/getHistoricPrices"; // uses historical prices
import { Timestamp, collection, getDocs, doc } from "firebase/firestore";

// Utility: format price safely
const safeParse = (val) => parseFloat(val || 0);

export default async function generateSnapshot({
  date = null,
  baseSnapshot = null,
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  // === Get position data ===
  const positionsRef = collection(db, "users", user.uid, "currentPositions");
  const positionsSnap = await getDocs(positionsRef);

  const positions = [];
  const tickers = [];

  positionsSnap.forEach((doc) => {
    const data = doc.data();
    if (!data.ticker || !data.shares) return;

    positions.push({ id: doc.id, ...data });
    tickers.push(data.ticker);
  });

  // === Decide data source ===
  let priceMap = {};
  if (date === null) {
    priceMap = await getStockPrices(tickers);
  } else {
    priceMap = await getHistoricPrices(tickers, date);
  }

  // === Use fallback baseSnapshot or default values ===
  const cash = safeParse(baseSnapshot?.cash);
  const netContribution = safeParse(baseSnapshot?.netContribution);
  const heldPositions = baseSnapshot?.positions || positions;

  // === Calculate invested & enrich positions ===
  let invested = 0;

  const enrichedPositions = heldPositions.map((pos) => {
    const currentPrice = safeParse(priceMap[pos.ticker]);
    const shares = safeParse(pos.shares);
    const avgPrice = safeParse(pos.averagePriceFromFIFO);

    const currentValue = shares * currentPrice;
    const unrealizedPL = currentValue - shares * avgPrice;

    invested += currentValue;

    return {
      ...pos,
      priceAtSnapshot: currentPrice,
      currentValue,
      unrealizedPL,
    };
  });

  const totalAssets = cash + invested;

  return {
    totalAssets,
    invested,
    cash,
    netContribution,
    positions: enrichedPositions,
    createdAt: Timestamp.now(),
  };
}
