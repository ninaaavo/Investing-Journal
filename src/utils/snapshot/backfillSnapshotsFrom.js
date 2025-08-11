import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";
import { removeDividendFromUserDay } from "../dividends/removeDividendFromUserDay";

function toIsoDate(d) {
  const z = new Date(d);
  z.setHours(0, 0, 0, 0);
  return z.toISOString().split("T")[0];
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export async function backfillSnapshotsFrom({
  userId,
  fromDate,        // exit date or entry date depending on isExit
  newTrade,
  pAndL = 0,
  isExit = false,
}) {
  console.log("⏪ Backfilling from:", fromDate);
  console.log("📘 Trade:", newTrade, "💰 P&L:", pAndL, "🚪 isExit:", isExit);

  const ticker = newTrade.ticker;

  // Establish absolute dates (using local time; change if you need ET-specific)
  const today = new Date();
  const todayISO = toIsoDate(today);
  const from = new Date(fromDate);
  const fromISO = toIsoDate(from);
  const yesterday = addDays(today, -1);
  const yesterdayISO = toIsoDate(yesterday);

  // --- EXIT PATH (no price fetching) ----------------------------------------
  if (isExit) {
    // If the exit happened today, do nothing.
    if (fromISO === todayISO) {
      console.log("✅ Exit is today; no snapshot changes needed.");
      return;
    }

    // If the exit happened before today:
    // We must remove the position from the day AFTER exit through yesterday.
    const start = addDays(from, 1);
    let cursor = new Date(start);

    // If start > yesterday, nothing to do.
    if (toIsoDate(cursor) > yesterdayISO) {
      console.log("ℹ️ Exit is yesterday; nothing to roll forward.");
      return;
    }

    while (toIsoDate(cursor) <= yesterdayISO) {
      const dateStr = toIsoDate(cursor);
      const snapRef = doc(db, "users", userId, "dailySnapshots", dateStr);
      const snapDoc = await getDoc(snapRef);

      if (!snapDoc.exists()) {
        // No snapshot for that day; nothing to remove.
        cursor = addDays(cursor, 1);
        continue;
      }

      const data = snapDoc.data() || {};
      const positions = { ...(data.positions || {}) };

      if (!positions[ticker]) {
        // Position already absent on this day; still ensure dividend cleanup
        await removeDividendFromUserDay(userId, dateStr, ticker);
        cursor = addDays(cursor, 1);
        continue;
      }

      // We will adjust totals by subtracting the saved per-position fields.
      // This avoids fetching prices.
      const pos = positions[ticker];

      const posMarketValue = Number(pos.marketValue || 0);
      const posCostBasis = Number(pos.costBasis || 0);
      const posUnrealizedPL = Number(pos.unrealizedPL || 0);

      const newTotalMarketValue = Number(data.totalMarketValue || 0) - posMarketValue;
      const newTotalCostBasis = Number(data.totalCostBasis || 0) - posCostBasis;
      const newUnrealizedPL = Number(data.unrealizedPL || 0) - posUnrealizedPL;
      const totalPLPercent =
        newTotalCostBasis > 0 ? newUnrealizedPL / newTotalCostBasis : 0;

      // Remove the position
      delete positions[ticker];

      await updateDoc(snapRef, {
        positions,
        totalMarketValue: newTotalMarketValue,
        totalCostBasis: newTotalCostBasis,
        unrealizedPL: newUnrealizedPL,
        totalPLPercent,
        // cash stays the same for those days — proceeds are accounted on the exit date itself
        // cumulative metrics remain unchanged for these carry-forward days
        // Keep createdAt as-is
      });

      // Remove any dividend entries for that ticker on this day.
      await removeDividendFromUserDay(userId, dateStr, ticker);

      cursor = addDays(cursor, 1);
    }

    // No refetch queue updates and no dividend additions for exit cleanups.
    console.log("✅ Exit backfill complete without price fetching.");
    return;
  }

  // --- NON-EXIT PATH (existing behavior) ------------------------------------
  // Build date list (inclusive of from..yesterday)
  const allDates = [];
  {
    const start = new Date(from);
    while (toIsoDate(start) <= yesterdayISO) {
      allDates.push(toIsoDate(start));
      start.setDate(start.getDate() + 1);
    }
  }

  // Prices ONLY for non-exit flows
  const historicalPrices =
    allDates.length > 0
      ? await fetchHistoricalPrices([ticker], allDates[0], allDates[allDates.length - 1])
      : {};

  const refetchMap = {};
  let dateCursor = new Date(from);

  while (toIsoDate(dateCursor) <= yesterdayISO) {
    const dateStr = toIsoDate(dateCursor);
    const snapRef = doc(db, "users", userId, "dailySnapshots", dateStr);

    const prevDate = addDays(dateCursor, -1);
    const prevSnapRef = doc(db, "users", userId, "dailySnapshots", toIsoDate(prevDate));

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

    // Non-exit: apply trade forward
    if (!positions[ticker]) {
      positions[ticker] = {
        shares: newTrade.direction === "short" ? -newTrade.shares : newTrade.shares,
        fifoStack: [{ shares: newTrade.shares, price: newTrade.averagePrice }],
      };
    } else {
      positions[ticker].shares +=
        newTrade.direction === "short" ? -newTrade.shares : newTrade.shares;
      positions[ticker].fifoStack = positions[ticker].fifoStack || [];
      positions[ticker].fifoStack.push({
        shares: newTrade.shares,
        price: newTrade.averagePrice,
      });
    }

    updatedCash += newTrade.direction === "short" ? newTrade.proceeds : -newTrade.cost;
    cumulativeInvested += newTrade.averagePrice * newTrade.shares;
    cumulativeTrades += 1;

    // Recompute totals using fetched prices
    let totalMarketValue = 0;
    let totalCostBasis = 0;
    let unrealizedPL = 0;

    for (const sym in positions) {
      const price = historicalPrices?.[sym]?.priceMap?.[dateStr] ?? 0;
      const pos = positions[sym];
      const shares = Number(pos.shares || 0);
      const fifoStack = pos.fifoStack || [];

      const costBasis = fifoStack.reduce(
        (sum, lot) => sum + Number(lot.shares || 0) * Number(lot.price || 0),
        0
      );
      const marketValue = shares * price;
      const pl = marketValue - costBasis;

      positions[sym].priceAtSnapshot = price;
      positions[sym].marketValue = marketValue;
      positions[sym].costBasis = costBasis;
      positions[sym].unrealizedPL = pl;

      totalMarketValue += marketValue;
      totalCostBasis += costBasis;
      unrealizedPL += pl;

      if (price === 0) {
        if (!refetchMap[sym]) refetchMap[sym] = [];
        refetchMap[sym].push(dateStr);
      }
    }

    const totalAssets = totalMarketValue + updatedCash;
    const totalPLPercent = totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

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

    // Dividend injection & updates (non-exit path)
    const existingTotalDiv = snapDoc.exists()
      ? snapDoc.data()?.totalDividendReceived ?? 0
      : 0;
    const injectedDividend = historicalPrices?.[ticker]?.dividendMap?.[dateStr] ?? 0;
    const sharesHeld = positions?.[ticker]?.shares ?? 0;
    const addedDividendAmount = injectedDividend * sharesHeld;

    if (addedDividendAmount > 0) {
      await updateDoc(snapRef, {
        totalDividendReceived: existingTotalDiv + addedDividendAmount,
      });
    }

    dateCursor = addDays(dateCursor, 1);
  }

  // ✅ Batch add dividends only for this ticker (non-exit)
  const dividendMap = { [ticker]: historicalPrices?.[ticker]?.dividendMap ?? {} };

  if (allDates.length > 0) {
    await checkAndAddDividendsToUser({
      uid: userId,
      from: allDates[0],
      to: allDates[allDates.length - 1],
      positions: { [ticker]: newTrade.shares },
      dividendMap,
      writeToSnapshot: true,
    });
  }

  // ✅ Update refetch queue (non-exit)
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data() || {};
  const existingQueue = userData.refetchQueue || {};
  const newQueue = { ...existingQueue };

  for (const [sym, dates] of Object.entries(refetchMap)) {
    const prevDates = newQueue[sym] ?? [];
    newQueue[sym] = Array.from(new Set([...prevDates, ...dates]));
  }

  await updateDoc(userRef, { refetchQueue: newQueue });
}
