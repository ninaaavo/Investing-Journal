import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  arrayUnion,
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

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const cursor = new Date(fromDate);
  const tickers = [newTrade.ticker];

  const refetchMap = {};

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

    const ticker = newTrade.ticker;
    const shares = newTrade.shares;
    const isShort = newTrade.direction === "short";

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
        if (isShort) {
          positions[ticker].shares += shares;
          if (positions[ticker].shares >= 0) delete positions[ticker];
          updatedCash -= newTrade.proceeds;
        } else {
          positions[ticker].shares -= shares;
          if (positions[ticker].shares <= 0) delete positions[ticker];
          updatedCash += newTrade.proceeds;
        }
      }
      cumulativeRealizedPL += pAndL;
    } else {
      if (!positions[ticker]) {
        positions[ticker] = {
          shares: isShort ? -shares : shares,
          fifoStack: [
            {
              shares: shares,
              price: newTrade.averagePrice,
            },
          ],
        };
      } else {
        positions[ticker].shares += isShort ? -shares : shares;
        positions[ticker].fifoStack.push({
          shares: shares,
          price: newTrade.averagePrice,
        });
      }
      updatedCash += isShort ? newTrade.proceeds : -newTrade.cost;
      cumulativeInvested += newTrade.averagePrice * shares;
    }

    cumulativeTrades += 1;

    const priceResult = await fetchHistoricalPrices(tickers, yyyyMMdd, yyyyMMdd);
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

  // Update user doc with refetchMap
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data() || {};
  const existingQueue = userData.refetchQueue || {};

  const newQueue = { ...existingQueue };

  for (const [ticker, dates] of Object.entries(refetchMap)) {
    const prevDates = newQueue[ticker] ?? [];
    const mergedDates = Array.from(new Set([...prevDates, ...dates]));
    newQueue[ticker] = mergedDates;
  }

  await updateDoc(userRef, {
    refetchQueue: newQueue,
  });
}
