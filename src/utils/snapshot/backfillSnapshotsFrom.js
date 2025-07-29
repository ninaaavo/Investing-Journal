import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
  getDocs,
  collection,
} from "firebase/firestore";
import { db } from "../../firebase";
import { fetchHistoricalPrices } from "../fetchHistoricalPrices";

/**
 * @param {string} userId - Firestore UID
 * @param {Date} fromDate - Start date for backfill
 * @param {Object} newTrade - { ticker, shares, averagePrice, direction, entryTimestamp }
 * @param {number} tradeCost - Proceeds (positive for sell, negative for buy)
 * @param {boolean} isExit - If this is an exit trade
 */
export async function backfillSnapshotsFrom({
  userId,
  fromDate,
  newTrade,
  tradeCost,
  isExit = false,
}) {
  const today = new Date();
  const cursor = new Date(fromDate);
  const tickers = [newTrade.ticker];

  while (cursor <= today) {
    const yyyyMMdd = cursor.toISOString().split("T")[0];
    const snapRef = doc(db, "users", userId, "dailySnapshots", yyyyMMdd);

    const prevDay = new Date(cursor);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevSnapRef = doc(
      db,
      "users",
      userId,
      "dailySnapshots",
      prevDay.toISOString().split("T")[0]
    );

    const snapDoc = await getDoc(snapRef);

    let baseCash = 0;
    let basePositions = [];

    if (snapDoc.exists()) {
      const data = snapDoc.data();
      baseCash = data.cash ?? 0;
      basePositions = data.positions ?? [];
    } else {
      const prevSnapDoc = await getDoc(prevSnapRef);
      if (prevSnapDoc.exists()) {
        const prevData = prevSnapDoc.data();
        baseCash = prevData.cash ?? 0;
        basePositions = prevData.positions ?? [];
      }
    }

    const isFirstDay =
      yyyyMMdd === newTrade.entryTimestamp.toDate().toISOString().split("T")[0];

    const updatedPositions = basePositions.map((p) => ({ ...p }));
    const existing = updatedPositions.find(
      (p) => p.ticker === newTrade.ticker
    );

    let updatedCash = baseCash;

    if (isFirstDay) {
      const isShort = newTrade.direction === "short";
      const shares = newTrade.shares;

      if (isExit) {
        // 🟥 Exit (long sell or short cover)
        if (existing) {
          if (isShort) {
            // Covering short: increase (closer to zero)
            existing.shares += shares;

            if (existing.shares >= 0) {
              // fully covered
              const idx = updatedPositions.findIndex(
                (p) => p.ticker === newTrade.ticker
              );
              if (idx !== -1) updatedPositions.splice(idx, 1);
            }
            updatedCash -= tradeCost;
          } else {
            // Selling long
            existing.shares -= shares;

            if (existing.shares <= 0) {
              const idx = updatedPositions.findIndex(
                (p) => p.ticker === newTrade.ticker
              );
              if (idx !== -1) updatedPositions.splice(idx, 1);
            }
            updatedCash += tradeCost;
          }
        }
      } else {
        // 🟩 Entry (buy or short sell)
        if (!existing) {
          updatedPositions.push({
            ticker: newTrade.ticker,
            shares: isShort ? -shares : shares,
            averagePriceFromFIFO: newTrade.averagePrice,
            currentPrice: 0,
            priceAtSnapshot: 0,
            currentValue: 0,
            unrealizedPL: 0,
          });
        } else {
          existing.shares += isShort ? -shares : shares;
          // Optionally recalculate averagePriceFromFIFO (omitted here)
        }

        updatedCash += isShort ? tradeCost : -tradeCost;
      }
    }

    // === Update prices and value ===
    const prices = await fetchHistoricalPrices(tickers, cursor);
    updatedPositions.forEach((p) => {
      const price = prices[p.ticker] ?? 0;
      p.currentPrice = price;
      p.priceAtSnapshot = price;
      p.currentValue = price * p.shares;
      p.unrealizedPL =
        (price - p.averagePriceFromFIFO) * p.shares;
    });

    const invested = updatedPositions.reduce(
      (sum, p) => sum + p.currentValue,
      0
    );
    const totalAssets = updatedCash + invested;

    await setDoc(snapRef, {
      cash: updatedCash,
      invested,
      totalAssets,
      netContribution: 0,
      positions: updatedPositions,
      createdAt: Timestamp.fromDate(new Date(yyyyMMdd)),
    });

    cursor.setDate(cursor.getDate() + 1);
  }
}
