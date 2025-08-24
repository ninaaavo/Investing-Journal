import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";
import { removeDividendFromUserDay } from "../dividends/removeDividendFromUserDay";

function removeFromFifoStack(stack = [], sharesToRemove = 0, mode = "fifo") {
  let remaining = Math.max(0, Number(sharesToRemove) || 0);
  const next = Array.isArray(stack) ? stack.map((l) => ({ ...l })) : [];
  let removedCost = 0;

  // FIFO => oldest first (index 0); LIFO => newest first (last index)
  const step = mode === "lifo" ? -1 : 1;
  let i = mode === "lifo" ? next.length - 1 : 0;

  while (remaining > 0 && next.length > 0 && i >= 0 && i < next.length) {
    const lot = next[i] || {};
    const lotShares = Math.max(0, Number(lot.shares) || 0);
    const lotPrice = Number(lot.price) || 0;

    if (lotShares <= remaining) {
      removedCost += lotShares * lotPrice;
      remaining -= lotShares;
      next.splice(i, 1);
      if (mode === "lifo") i -= 1; // list shrank
      // fifo: i stays the same because current index now points to next item
    } else {
      // partial consume this lot
      removedCost += remaining * lotPrice;
      next[i] = { ...lot, shares: lotShares - remaining };
      remaining = 0;
    }
  }

  return { stack: next, removedCost };
}

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
  fromDate,
  newTrade,
  pAndL = 0,
  isExit = false,
}) {
  console.log("⏪ Backfilling from:", fromDate);
  console.log("📘 Trade:", newTrade, "💰 P&L:", pAndL, "🚪 isExit:", isExit);

  const ticker = newTrade.ticker;
  const today = new Date();
  const todayISO = toIsoDate(today);
  const from = new Date(fromDate);
  const fromISO = toIsoDate(from);
  const yesterday = addDays(today, -1);
  const yesterdayISO = toIsoDate(yesterday);

  // --- EXIT PATH ---
  if (isExit) {
    // If exit is today, just stop — we don't backfill today in historical snapshots
    if (fromISO === todayISO) {
      console.log("✅ Exit is today; no forward-day changes.");
      return;
    }

    // Now we start on the actual exit date, not the day after
    const start = new Date(from);

    // If the exit date is after yesterday, nothing to forward update
    if (toIsoDate(start) > yesterdayISO) {
      console.log("ℹ️ Exit was yesterday; no forward days to update.");
      return;
    }

    const sharesSold = Math.abs(newTrade.shares);

    let cursor = new Date(start);
    while (toIsoDate(cursor) <= yesterdayISO) {
      const dateStr = toIsoDate(cursor);
      const snapRef = doc(db, "users", userId, "dailySnapshots", dateStr);
      const snapDoc = await getDoc(snapRef);

      if (!snapDoc.exists()) {
        await removeDividendFromUserDay(userId, dateStr, ticker, sharesSold);
        cursor = addDays(cursor, 1);
        continue;
      }

      const data = snapDoc.data() || {};
      const positions = { ...(data.positions || {}) };
      const pos = positions[ticker];

      if (!pos) {
        await removeDividendFromUserDay(userId, dateStr, ticker, sharesSold);
        cursor = addDays(cursor, 1);
        continue;
      }

      const originalShares = Number(pos.shares || 0);
      const sharesForRemoval = Math.min(sharesSold, Math.abs(originalShares));

      // --- NEW: update fifo stack and use its removed cost
      let newFifoStack = Array.isArray(pos.fifoStack) ? pos.fifoStack : [];
      let removedCostFromLots = 0;

      // only adjust fifoStack for long positions that actually use it
      if (newTrade.direction !== "short" && newFifoStack.length > 0) {
        const { stack, removedCost } = removeFromFifoStack(
          newFifoStack,
          sharesForRemoval,
          "fifo"
        );
        newFifoStack = stack;
        removedCostFromLots = removedCost;
      }

      let newShares;
      if (newTrade.direction === "short") {
        newShares = originalShares + sharesForRemoval;
      } else {
        newShares = originalShares - sharesForRemoval;
      }

      // Scale MV without fetching prices
      const oldMV = Number(pos.marketValue || 0);
      const oldCB = Number(pos.costBasis || 0);

      // prefer cost implied by lots; fall back to avg cost if lots missing
      const avgCostPerShare =
        originalShares !== 0 ? oldCB / Math.abs(originalShares) : 0;
      const usedSoldCost =
        removedCostFromLots > 0
          ? removedCostFromLots
          : typeof newTrade.cost === "number" && !Number.isNaN(newTrade.cost)
          ? newTrade.cost
          : avgCostPerShare * sharesForRemoval;

      const shareRatio = originalShares !== 0 ? newShares / originalShares : 0;
      const newMV = oldMV * shareRatio;

      // If we consumed lots, recompute CB from the new fifo; else use oldCB - usedSoldCost
      const recomputedCBFromStack = newFifoStack.reduce(
        (sum, lot) =>
          sum + (Number(lot.shares) || 0) * (Number(lot.price) || 0),
        0
      );
      const newCB =
        newTrade.direction !== "short" &&
        pos.fifoStack &&
        pos.fifoStack.length > 0
          ? recomputedCBFromStack
          : Math.max(0, oldCB - usedSoldCost);

      const newUPL = newMV - newCB;

      const deltaMV = newMV - oldMV;
      const deltaCB = newCB - oldCB;
      const deltaUPL = newUPL - Number(pos.unrealizedPL || 0);

      if (
        newShares === 0 ||
        (newTrade.direction === "long" && newShares < 0) ||
        (newTrade.direction === "short" && newShares > 0)
      ) {
        delete positions[ticker];
      } else {
        positions[ticker] = {
          ...pos,
          shares: newShares,
          marketValue: newMV,
          costBasis: newCB,
          unrealizedPL: newUPL,
          // --- NEW: persist the updated fifo stack when applicable
          fifoStack:
            newTrade.direction !== "short" ? newFifoStack : pos.fifoStack,
        };
      }

      const newTotalMV = Number(data.totalMarketValue || 0) + deltaMV;
      const newTotalCB = Number(data.totalCostBasis || 0) + deltaCB;
      const newUPLTotal = Number(data.unrealizedPL || 0) + deltaUPL;
      const totalPLPercent = newTotalCB > 0 ? newUPLTotal / newTotalCB : 0;

      await updateDoc(snapRef, {
        positions,
        totalMarketValue: newTotalMV,
        totalCostBasis: newTotalCB,
        unrealizedPL: newUPLTotal,
        totalPLPercent,
      });

      await removeDividendFromUserDay(
        userId,
        dateStr,
        ticker,
        sharesForRemoval
      );

      cursor = addDays(cursor, 1);
    }

    console.log(
      "✅ Exit backfill complete without price fetching (including exit day)."
    );
    return;
  }

  // --- NON-EXIT PATH (existing behavior) ---
  const allDates = [];
  let cur = new Date(from);
  while (toIsoDate(cur) <= yesterdayISO) {
    allDates.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const historicalPrices =
    allDates.length > 0
      ? await fetchHistoricalPrices(
          [ticker],
          allDates[0],
          allDates[allDates.length - 1]
        )
      : {};

  const refetchMap = {};
  let dateCursor = new Date(from);

  while (toIsoDate(dateCursor) <= yesterdayISO) {
    const dateStr = toIsoDate(dateCursor);
    const snapRef = doc(db, "users", userId, "dailySnapshots", dateStr);

    const prevDate = addDays(dateCursor, -1);
    const prevSnapRef = doc(
      db,
      "users",
      userId,
      "dailySnapshots",
      toIsoDate(prevDate)
    );

    const snapDoc = await getDoc(snapRef);
    let basePositions = {};
    let cumulativeTrades = 0;
    let cumulativeInvested = 0;
    let cumulativeRealizedPL = 0;

    if (snapDoc.exists()) {
      const data = snapDoc.data();
      basePositions = structuredClone(data.positions ?? {});
      cumulativeTrades = data.cumulativeTrades ?? 0;
      cumulativeInvested = data.cumulativeInvested ?? 0;
      cumulativeRealizedPL = data.cumulativeRealizedPL ?? 0;
    } else {
      const prevSnapDoc = await getDoc(prevSnapRef);
      if (prevSnapDoc.exists()) {
        const prevData = prevSnapDoc.data();
        basePositions = structuredClone(prevData.positions ?? {});
        cumulativeTrades = prevData.cumulativeTrades ?? 0;
        cumulativeInvested = prevData.cumulativeInvested ?? 0;
        cumulativeRealizedPL = prevData.cumulativeRealizedPL ?? 0;
      }
    }

    const positions = structuredClone(basePositions);

    if (!positions[ticker]) {
      positions[ticker] = {
        shares:
          newTrade.direction === "short" ? -newTrade.shares : newTrade.shares,
        fifoStack: [{ shares: newTrade.shares, price: newTrade.averagePrice }],
      };
    } else {
      positions[ticker].shares +=
        newTrade.direction === "short" ? -newTrade.shares : newTrade.shares;
      positions[ticker].fifoStack.push({
        shares: newTrade.shares,
        price: newTrade.averagePrice,
      });
    }

    
    cumulativeInvested += newTrade.averagePrice * newTrade.shares;
    cumulativeTrades += 1;

    let totalMarketValue = 0;
    let totalCostBasis = 0;
    let unrealizedPL = 0;

    for (const sym in positions) {
      const price = historicalPrices?.[sym]?.priceMap?.[dateStr] ?? 0;
      const pos = positions[sym];
      const shares = pos.shares;
      const fifoStack = pos.fifoStack || [];

      const costBasis = fifoStack.reduce(
        (sum, lot) => sum + lot.shares * lot.price,
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

    const totalAssets = totalMarketValue ;
    const totalPLPercent =
      totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

    await setDoc(snapRef, {
      date: dateStr,
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

    dateCursor.setDate(dateCursor.getDate() + 1);
  }

  const dividendMap = {
    [ticker]: historicalPrices?.[ticker]?.dividendMap ?? {},
  };

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

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data() || {};
  const existingQueue = userData.refetchQueue || {};
  const newQueue = { ...existingQueue };

  for (const [sym, dates] of Object.entries(refetchMap)) {
    const prevDates = newQueue[sym] ?? [];
    newQueue[sym] = Array.from(new Set([...prevDates, ...dates]));
  }

  await updateDoc(userRef, {
    refetchQueue: newQueue,
  });
}
