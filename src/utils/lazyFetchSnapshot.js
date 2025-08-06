import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import fetchHistoricalPrices from "./prices/fetchHistoricalPrices";

/**
 * Ensures priceAtSnapshot is valid for a given ticker on a given date.
 * Returns the updated price, or null if still unavailable.
 */
export async function lazyFixSnapshotPrice({ userId, ticker, date }) {
  const snapRef = doc(db, "users", userId, "dailySnapshots", date);
  const snapSnap = await getDoc(snapRef);
  if (!snapSnap.exists()) return null;

  const data = snapSnap.data();
  const pos = data.positions?.[ticker];
  if (!pos || pos.priceAtSnapshot > 0) return pos?.priceAtSnapshot ?? null;

  // 🧠 price is 0 — refetch it
  const prices = await fetchHistoricalPrices([ticker], new Date(date));
  const price = prices?.[ticker] ?? 0;
  if (price <= 0) return null; // still no fix

  // ✅ Patch the position
  const shares = pos.shares ?? 0;

  // Recalculate costBasis if needed
  const fifoStack = pos.fifoStack ?? [];
  const costBasis =
    pos.costBasis ??
    fifoStack.reduce((sum, lot) => sum + (lot.shares ?? 0) * (lot.price ?? 0), 0);

  const marketValue = price * shares;
  const unrealizedPL = marketValue - costBasis;

  const updatedPositions = { ...data.positions };
  updatedPositions[ticker] = {
    ...pos,
    costBasis,
    priceAtSnapshot: price,
    marketValue,
    unrealizedPL,
  };

  // Recalculate snapshot totals
  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let totalPL = 0;

  for (const [_, p] of Object.entries(updatedPositions)) {
    totalMarketValue += p.marketValue ?? 0;
    totalCostBasis += p.costBasis ?? 0;
    totalPL += p.unrealizedPL ?? 0;
  }

  const totalAssets = totalMarketValue + (data.cash ?? 0);
  const totalPLPercent = totalCostBasis > 0 ? totalPL / totalCostBasis : 0;

  await updateDoc(snapRef, {
    positions: updatedPositions,
    totalMarketValue,
    totalCostBasis,
    unrealizedPL: totalPL,
    totalAssets,
    totalPLPercent,
  });

  return price;
}
