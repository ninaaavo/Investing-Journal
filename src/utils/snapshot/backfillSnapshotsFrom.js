import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";
import { removeDividendFromUserDay } from "../dividends/removeDividendFromUserDay";

export async function backfillSnapshotsFrom({
  userId,
  fromDate,
  newTrade,
  pAndL = 0,
  isExit = false,
}) {
  console.log("⏪ Backfilling from:", fromDate);
  console.log("📘 Trade:", newTrade, "💰 P&L:", pAndL);

  const ticker = newTrade.ticker;
  const from = new Date(fromDate);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const allDates = [];
  const cursor = new Date(from);
  while (cursor <= yesterday) {
    allDates.push(cursor.toISOString().split("T")[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  const historicalPrices = await fetchHistoricalPrices(
    [ticker],
    allDates[0],
    allDates[allDates.length - 1]
  );

  const refetchMap = {};
  const dateCursor = new Date(from);

  while (dateCursor <= yesterday) {
    const dateStr = dateCursor.toISOString().split("T")[0];
    const snapRef = doc(db, "users", userId, "dailySnapshots", dateStr);

    const prevDate = new Date(dateCursor);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevSnapRef = doc(
      db,
      "users",
      userId,
      "dailySnapshots",
      prevDate.toISOString().split("T")[0]
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

    // Trade logic
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
          shares:
            newTrade.direction === "short" ? -newTrade.shares : newTrade.shares,
          fifoStack: [
            { shares: newTrade.shares, price: newTrade.averagePrice },
          ],
        };
      } else {
        positions[ticker].shares +=
          newTrade.direction === "short" ? -newTrade.shares : newTrade.shares;

        positions[ticker].fifoStack.push({
          shares: newTrade.shares,
          price: newTrade.averagePrice,
        });
      }

      updatedCash +=
        newTrade.direction === "short" ? newTrade.proceeds : -newTrade.cost;

      cumulativeInvested += newTrade.averagePrice * newTrade.shares;
    }

    cumulativeTrades += 1;

    let totalMarketValue = 0;
    let totalCostBasis = 0;
    let unrealizedPL = 0;

    for (const ticker in positions) {
      const price = historicalPrices?.[ticker]?.priceMap?.[dateStr] ?? 0;
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
        refetchMap[ticker].push(dateStr);
      }
    }

    const totalAssets = totalMarketValue + updatedCash;
    const totalPLPercent =
      totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

    await setDoc(snapRef, {
      date: dateStr,
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
      createdAt: Timestamp.fromDate(new Date(dateStr)),
    });
    const existingTotalDiv = snapDoc.exists()
      ? snapDoc.data()?.totalDividendReceived ?? 0
      : 0;

    const injectedDividend =
      historicalPrices?.[ticker]?.dividendMap?.[dateStr] ?? 0;
    const sharesHeld = positions?.[ticker]?.shares ?? 0;
    const addedDividendAmount = injectedDividend * sharesHeld;

    if (addedDividendAmount > 0) {
      await updateDoc(snapRef, {
        totalDividendReceived: existingTotalDiv + addedDividendAmount,
      });
    }

    // Only remove dividends for the affected ticker
    if (isExit && !positions[ticker]) {
      await removeDividendFromUserDay(userId, dateStr, ticker);
    }

    dateCursor.setDate(dateCursor.getDate() + 1);
  }

  // ✅ Batch add dividends only for this ticker
  const dividendMap = {
    [ticker]: historicalPrices?.[ticker]?.dividendMap ?? {},
  };

  await checkAndAddDividendsToUser({
    uid: userId,
    from: from.toISOString().split("T")[0],
    to: yesterday.toISOString().split("T")[0],
    positions: { [ticker]: newTrade.shares },
    dividendMap,
    writeToSnapshot: true,
  });

  // ✅ Update refetch queue
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
