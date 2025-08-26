import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import fetchHistoricalPrices from "./prices/fetchHistoricalPrices";

/**
 * Ensures priceAtSnapshot is valid for a given ticker on a given date (v2 only).
 * - direction: "long" | "short"  (required)
 * Returns the updated price, or null if still unavailable / nothing to fix.
 */
export async function lazyFixSnapshotPrice({
  userId,
  ticker,
  date,
  direction,
}) {
  if (!userId || !ticker || !date || (direction !== "long" && direction !== "short")) {
    console.warn("lazyFixSnapshotPrice: missing/invalid args", {
      userId, ticker, date, direction
    });
    return null;
  }

  const snapRef = doc(db, "users", userId, "dailySnapshots", date);
  const snapSnap = await getDoc(snapRef);
  if (!snapSnap.exists()) return null;

  const data = snapSnap.data() || {};
  const key = direction === "long" ? "longPositions" : "shortPositions";
  const otherKey = direction === "long" ? "shortPositions" : "longPositions";

  const book = { ...(data[key] || {}) };
  const otherBook = data[otherKey] || {};

  const pos = book[ticker];
  if (!pos) return null;                       // nothing to fix on this side
  if (Number(pos.priceAtSnapshot ?? 0) > 0) {  // already has a valid price
    return Number(pos.priceAtSnapshot);
  }

  // Use the provided YYYY-MM-DD string as-is (no tz shifts)
  const dateStr = date;
  const hist = await fetchHistoricalPrices([ticker], dateStr, dateStr);
  const price = Number(hist?.[ticker]?.priceMap?.[dateStr] ?? 0);
  if (!(price > 0)) return null; // still no fix

  // Recompute derived fields for THIS position
  const shares = Number(pos.shares ?? 0);
  const fifoStack = Array.isArray(pos.fifoStack) ? pos.fifoStack : [];

  const costBasis =
    Number(pos.costBasis ?? 0) ||
    fifoStack.reduce(
      (sum, lot) =>
        sum + Number(lot?.shares ?? 0) * Number(lot?.price ?? 0),
      0
    );

  const marketValue = shares * price;
  const unrealizedPL = marketValue - costBasis;

  // Update the side map with the fixed position
  const updatedBook = {
    ...book,
    [ticker]: {
      ...pos,
      costBasis,
      priceAtSnapshot: price,
      marketValue,
      unrealizedPL,
    },
  };

  // --- Re-aggregate totals across BOTH sides (using existing other side as-is) ---

  const sumSide = (sideMap = {}) => {
    let mv = 0, cb = 0, pl = 0;
    for (const p of Object.values(sideMap)) {
      mv += Number(p?.marketValue ?? 0);
      cb += Number(p?.costBasis ?? 0);
      pl += Number(p?.unrealizedPL ?? 0);
    }
    return { mv, cb, pl };
  };

  const longsAgg  = direction === "long"  ? sumSide(updatedBook) : sumSide(data.longPositions);
  const shortsAgg = direction === "short" ? sumSide(updatedBook) : sumSide(data.shortPositions);

  const totals = {
    marketValueLong: longsAgg.mv,
    marketValueShort: shortsAgg.mv,
    costBasisLong: longsAgg.cb,
    costBasisShort: shortsAgg.cb,
    unrealizedPLLong: longsAgg.pl,
    unrealizedPLShort: shortsAgg.pl,
    marketValueNet: longsAgg.mv + shortsAgg.mv,
    costBasisNet: longsAgg.cb + shortsAgg.cb,
    unrealizedPLNet: longsAgg.pl + shortsAgg.pl,
    // Keep a simple percent; downstream readers should pick the denominator they want.
    totalPLPercent: (longsAgg.cb > 0 ? longsAgg.pl / longsAgg.cb : 0),
  };

  // Build the update payload
  const updatePayload = {
    totals,
    [key]: updatedBook,
  };

  await updateDoc(snapRef, updatePayload);
  return price;
}
