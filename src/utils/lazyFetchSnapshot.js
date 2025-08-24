import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import fetchHistoricalPrices from "./prices/fetchHistoricalPrices";

/**
 * Ensures priceAtSnapshot is valid for a given ticker on a given date.
 * Returns the updated price, or null if still unavailable.
 */
export async function lazyFixSnapshotPrice({ userId, ticker, date }) {
  console.log("🔧 fixing", ticker, "at snapshot date", date);

  const snapRef = doc(db, "users", userId, "dailySnapshots", date);
  const snapSnap = await getDoc(snapRef);
  if (!snapSnap.exists()) return null;

  const data = snapSnap.data();
  const pos = data.positions?.[ticker];
  if (!pos || pos.priceAtSnapshot > 0) return pos?.priceAtSnapshot ?? null;

  // ✅ Treat date string as UTC to avoid time zone drift
  // console.log("input date", date);
  const dateStr = date; // trust the original date string
  const result = await fetchHistoricalPrices([ticker], dateStr, dateStr);
  const price = result?.[ticker]?.priceMap?.[dateStr] ?? 0;

  // 🧠 price is 0 — refetch it

  console.log("target date is", dateStr);
  console.log("✅ fetched priceMap:", result);
  console.log("📅 resolved dateStr:", dateStr);
  console.log("📈 fetched price:", price);

  if (price <= 0) return null; // still no fix

  // ✅ Patch the position
  const shares = pos.shares ?? 0;

  const fifoStack = pos.fifoStack ?? [];
  const costBasis =
    pos.costBasis ??
    fifoStack.reduce(
      (sum, lot) => sum + (lot.shares ?? 0) * (lot.price ?? 0),
      0
    );

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

  for (const p of Object.values(updatedPositions)) {
    totalMarketValue += p.marketValue ?? 0;
    totalCostBasis += p.costBasis ?? 0;
    totalPL += p.unrealizedPL ?? 0;
  }

  const totalAssets = totalMarketValue ;
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
