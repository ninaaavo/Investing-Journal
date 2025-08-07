import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";

/**
 * @param {string} userId - Firestore UID
 * @param {Date} fromDate - Start date for backfill
 * @param {Object} newTrade - { ticker, shares, averagePrice, direction, entryTimestamp, proceeds, cost }
 * @param {number} pAndL - Realized profit or loss for this trade
 * @param {boolean} isExit - If this is an exit trade
 */
export async function backfillSnapshotsFrom({
  userId,
  fromDate,
  newTrade,
  pAndL,
  isExit = false,
}) {
  console.log("backfill is being called");
  console.log("received trade:", newTrade, "with P&L:", pAndL);

  const ticker = newTrade.ticker;
  const tickers = [ticker];
  const from = new Date(fromDate);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Get list of all dates to backfill
  const allDates = [];
  const cursorForDates = new Date(from);
  while (cursorForDates <= yesterday) {
    allDates.push(cursorForDates.toISOString().split("T")[0]);
    cursorForDates.setDate(cursorForDates.getDate() + 1);
  }

  // Fetch all historical prices at once
  const historicalPrices = await fetchHistoricalPrices(
    tickers,
    allDates[0],
    allDates[allDates.length - 1]
  );

  const refetchMap = {};
  const cursor = new Date(from);

  while (cursor <= yesterday) {
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
    let basePositions = {};
    let cumulativeTrades = 0;
    let cumulativeInvested = 0;
    let cumulativeRealizedPL = 0;

    if (snapDoc.exists()) {
      const data = snapDoc.data();
      baseCash = data.cash ?? 0;
      basePositions = structuredClone(data.positions ?? {});
      cumulativeTrades = data.cumulativeTrades ?? 0;
      cumulativeInvested = data.cumulativeInvested ?? 0;
      cumulativeRealizedPL = data.cumulativeRealizedPL ?? 0;
    } else {
      const prevSnapDoc = await getDoc(prevSnapRef);
      if (prevSnapDoc.exists()) {
        const prevData = prevSnapDoc.data();
        baseCash = prevData.cash ?? 0;
        basePositions = structuredClone(prevData.positions ?? {});
        cumulativeTrades = prevData.cumulativeTrades ?? 0;
        cumulativeInvested = prevData.cumulativeInvested ?? 0;
        cumulativeRealizedPL = prevData.cumulativeRealizedPL ?? 0;
      }
    }

    const positions = structuredClone(basePositions);
    let updatedCash = baseCash;

    if (isExit) {
      if (positions[ticker]) {
        if (newTrade.direction === "short") {
          positions[ticker].shares += newTrade.shares;
          if (positions[ticker].shares >= 0) delete positions[ticker];
          updatedCash -= newTrade.proceeds;
        } else {
          positions[ticker].shares -= newTrade.shares;
          if (positions[ticker].shares <= 0) delete positions[ticker];
          updatedCash += newTrade.proceeds;
        }
      }
      cumulativeRealizedPL += pAndL;
    } else {
      if (!positions[ticker]) {
        positions[ticker] = {
          shares: newTrade.direction === "short" ? -newTrade.shares : newTrade.shares,
          fifoStack: [
            {
              shares: newTrade.shares,
              price: newTrade.averagePrice,
            },
          ],
        };
      } else {
        positions[ticker].shares += newTrade.direction === "short" ? -newTrade.shares : newTrade.shares;
        positions[ticker].fifoStack.push({
          shares: newTrade.shares,
          price: newTrade.averagePrice,
        });
      }
      updatedCash += newTrade.direction === "short"
        ? newTrade.proceeds
        : -newTrade.cost;

      cumulativeInvested += newTrade.averagePrice * newTrade.shares;
    }

    cumulativeTrades += 1;

    const priceResult = historicalPrices;
    let totalMarketValue = 0;
    let totalCostBasis = 0;
    let unrealizedPL = 0;

    for (const ticker in positions) {
      const price = priceResult?.[ticker]?.priceMap?.[yyyyMMdd] ?? 0;
      const pos = positions[ticker];
      const shares = pos.shares;
      const fifoStack = pos.fifoStack || [];

      const costBasis = fifoStack.reduce(
        (sum, lot) => sum + lot.shares * lot.price,
        0
      );
      const marketValue = shares * price;
      const pl = marketValue - costBasis;

      positions[ticker].priceAtSnapshot = price;
      positions[ticker].marketValue = marketValue;
      positions[ticker].costBasis = costBasis;
      positions[ticker].unrealizedPL = pl;

      totalMarketValue += marketValue;
      totalCostBasis += costBasis;
      unrealizedPL += pl;

      if (price === 0) {
        if (!refetchMap[ticker]) refetchMap[ticker] = [];
        refetchMap[ticker].push(yyyyMMdd);
      }
    }

    const totalAssets = totalMarketValue + updatedCash;
    const totalPLPercent =
      totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

    await setDoc(snapRef, {
      date: yyyyMMdd,
      cash: updatedCash,
      totalAssets,
      totalCostBasis,
      totalMarketValue,
      unrealizedPL,
      totalPLPercent,
      positions,
      netContribution: 0,
      cumulativeTrades,
      cumulativeInvested,
      cumulativeRealizedPL,
      createdAt: Timestamp.fromDate(new Date(yyyyMMdd)),
    });

    await checkAndAddDividendsToUser({
      uid: userId,
      dateStr: yyyyMMdd,
      positions,
      writeToSnapshot: true,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  // Update refetchQueue on user document
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data() || {};
  const existingQueue = userData.refetchQueue || {};
  const newQueue = { ...existingQueue };

  for (const [ticker, dates] of Object.entries(refetchMap)) {
    const prevDates = newQueue[ticker] ?? [];
    newQueue[ticker] = Array.from(new Set([...prevDates, ...dates]));
  }

  await updateDoc(userRef, {
    refetchQueue: newQueue,
  });
}
