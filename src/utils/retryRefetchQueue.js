// utils/refetchQueue.js
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import fetchHistoricalPrices from "./prices/fetchHistoricalPrices";

export async function retryRefetchQueue(userId) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const refetchQueue = userSnap.data()?.refetchQueue || {};

  const updatedQueue = { ...refetchQueue };

  for (const [ticker, dates] of Object.entries(refetchQueue)) {
    const successfulDates = [];

    for (const date of dates) {
      const targetDate = new Date(date);
      const dateStr = targetDate.toISOString().split("T")[0];

      const result = await fetchHistoricalPrices([ticker], targetDate, targetDate);
      const price = result?.[ticker]?.priceMap?.[dateStr] ?? 0;

      if (price > 0) {
        // ✅ Patch the snapshot for that date
        const snapRef = doc(db, "users", userId, "dailySnapshots", date);
        const snapSnap = await getDoc(snapRef);
        if (snapSnap.exists()) {
          const snapData = snapSnap.data();
          const pos = snapData.positions?.[ticker];
          if (pos) {
            const marketValue = price * pos.shares;
            const pl = marketValue - (pos.costBasis ?? 0);

            snapData.positions[ticker].priceAtSnapshot = price;
            snapData.positions[ticker].marketValue = marketValue;
            snapData.positions[ticker].unrealizedPL = pl;

            // Recalculate total values
            let totalMarketValue = 0;
            let totalCostBasis = 0;
            let totalPL = 0;

            for (const p of Object.values(snapData.positions)) {
              totalMarketValue += p.marketValue ?? 0;
              totalCostBasis += p.costBasis ?? 0;
              totalPL += p.unrealizedPL ?? 0;
            }

            snapData.totalMarketValue = totalMarketValue;
            snapData.totalCostBasis = totalCostBasis;
            snapData.unrealizedPL = totalPL;
            snapData.totalAssets = totalMarketValue;
            snapData.totalPLPercent =
              totalCostBasis > 0 ? totalPL / totalCostBasis : 0;

            await updateDoc(snapRef, snapData);
            successfulDates.push(date);
          }
        }
      }
    }

    // 🧹 Clean up successfully patched dates
    const remaining = dates.filter((d) => !successfulDates.includes(d));
    if (remaining.length > 0) {
      updatedQueue[ticker] = remaining;
    } else {
      delete updatedQueue[ticker];
    }
  }

  // 🧼 Update the cleaned queue
  await updateDoc(userRef, { refetchQueue: updatedQueue });
}
