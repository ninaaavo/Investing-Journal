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
const N = (v) => Number.parseFloat(v || 0);
// Put this helper near the top of the file (above backfillSnapshotsFrom)
function consumeFromFifo(fifoStack, sharesToSell) {
  // fifoStack: [{ shares:number, price:number }, ...] oldest first
  // returns { newStack, removedShares, removedCost }
  if (
    !Array.isArray(fifoStack) ||
    fifoStack.length === 0 ||
    sharesToSell <= 0
  ) {
    return { newStack: fifoStack || [], removedShares: 0, removedCost: 0 };
  }
  let remaining = sharesToSell;
  const newStack = [];
  let removedCost = 0;
  let removedShares = 0;

  for (let i = 0; i < fifoStack.length; i++) {
    const layer = fifoStack[i];
    const layerShares = Number(layer?.shares || 0);
    const layerPrice = Number(layer?.price || 0);
    if (remaining <= 0) {
      // keep the rest untouched
      newStack.push(layer);
      continue;
    }
    const take = Math.min(layerShares, remaining);
    if (take < layerShares) {
      // partially consume this layer
      newStack.push({ shares: layerShares - take, price: layerPrice });
    }
    // if take === layerShares → layer fully consumed, omit
    removedShares += take;
    removedCost += take * layerPrice;
    remaining -= take;
  }

  // If we still have remaining (oversell vs snapshot), nothing else to consume.
  // We consider removedShares as whatever we actually took from the stack.
  // The caller should min() sharesToSell with position.shares, so this should match.
  return { newStack, removedShares, removedCost };
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

  // ---------------- EXIT PATH ----------------
  if (isExit) {
    if (fromISO === todayISO) {
      console.log("✅ Exit is today; no forward-day changes.");
      return;
    }

    const start = new Date(from);
    if (toIsoDate(start) > yesterdayISO) {
      console.log("ℹ️ Exit was yesterday; no forward days to update.");
      return;
    }

    const reduceShares = Math.abs(newTrade.shares);
    const isShortExit = (newTrade.direction || "").toLowerCase() === "short";

    let cursor = new Date(start);
    while (toIsoDate(cursor) <= yesterdayISO) {
      const dateStr = toIsoDate(cursor);
      const snapRef = doc(db, "users", userId, "dailySnapshots", dateStr);
      const snapDoc = await getDoc(snapRef);
      if (!snapDoc.exists()) {
        if (!isShortExit)
          await removeDividendFromUserDay(
            userId,
            dateStr,
            ticker,
            reduceShares
          );
        cursor = addDays(cursor, 1);
        continue;
      }

      const data = snapDoc.data() || {};

      // Normalize to v2 structure
      const longPositions = { ...(data.longPositions || {}) };
      const shortPositions = { ...(data.shortPositions || {}) };
      const totals = { ...(data.totals || {}) };

      if (!longPositions[ticker] && !shortPositions[ticker]) {
        if (!isShortExit)
          await removeDividendFromUserDay(
            userId,
            dateStr,
            ticker,
            reduceShares
          );
        cursor = addDays(cursor, 1);
        continue;
      }

      if (!isShortExit) {
        // ---- Reduce LONG shares with FIFO consumption ----
        const pos = longPositions[ticker];
        const origShares = N(pos.shares || 0);
        const take = Math.min(reduceShares, origShares);
        if (origShares <= 0 || take <= 0) {
          cursor = addDays(cursor, 1);
          continue;
        }

        const remainShares = origShares - take;

        const oldMV = N(pos.marketValue || 0);
        const oldCB = N(pos.costBasis || 0);
        const oldUPL = N(pos.unrealizedPL ?? oldMV - oldCB);

        // Prefer exact CB change via FIFO if we have a stack; otherwise fallback to proportional
        const hasStack =
          Array.isArray(pos.fifoStack) && pos.fifoStack.length > 0;

        let newFifoStack = hasStack
          ? pos.fifoStack.map((l) => ({
              shares: N(l.shares),
              price: N(l.price),
            }))
          : [];
        let removedCost = 0;

        if (hasStack) {
          const {
            newStack,
            removedShares,
            removedCost: rc,
          } = consumeFromFifo(newFifoStack, take);
          // In normal conditions, removedShares === take
          removedCost = rc;
          newFifoStack = newStack;
        }

        // Scale MV linearly by shares ratio (no need to fetch price)
        const ratio = remainShares > 0 ? remainShares / origShares : 0;
        const newMV = oldMV * ratio;

        // Exact CB from FIFO if available; else proportional CB scaling
        const newCB = hasStack
          ? Math.max(0, oldCB - removedCost)
          : oldCB * ratio;

        // Recompute UPL as MV - CB for accuracy
        const newUPL = newMV - newCB;

        // Update totals (long side & net)
        const dMV = newMV - oldMV;
        const dCB = newCB - oldCB;
        const dUPLLong = newUPL - oldUPL;

        totals.totalLongMarketValue = N(totals.totalLongMarketValue || 0) + dMV;
        totals.unrealizedPLLong = N(totals.unrealizedPLLong || 0) + dUPLLong;
        totals.unrealizedPLNet = N(totals.unrealizedPLNet || 0) + dUPLLong;
        totals.equityNoCash =
          N(totals.totalLongMarketValue || 0) -
          N(totals.totalShortLiability || 0);
        totals.grossExposure =
          N(totals.totalLongMarketValue || 0) +
          N(totals.totalShortLiability || 0);

        if (remainShares === 0) {
          delete longPositions[ticker];
        } else {
          longPositions[ticker] = {
            ...pos,
            shares: remainShares,
            // keep the last known per-day priceAtSnapshot (we didn't fetch)
            marketValue: newMV,
            costBasis: newCB,
            unrealizedPL: newUPL,
            // Write the updated FIFO stack if we had one; otherwise leave as-is or omit
            ...(hasStack ? { fifoStack: newFifoStack } : {}),
          };
        }

        // Legacy compatibility fields
        const newTotalMV = N(data.totalMarketValue || 0) + dMV;
        const newTotalCB = N(data.totalCostBasis || 0) + dCB;
        const newUPLTotal = N(data.unrealizedPL || 0) + dUPLLong; // long delta only
        const totalPLPercent = newTotalCB > 0 ? newUPLTotal / newTotalCB : 0;

        await updateDoc(snapRef, {
          longPositions,
          shortPositions,
          totals,
          // legacy
          totalMarketValue: newTotalMV,
          totalCostBasis: newTotalCB,
          unrealizedPL: newUPLTotal,
          totalPLPercent,
        });

        await removeDividendFromUserDay(userId, dateStr, ticker, take);
      } else {
        // ---- Reduce SHORT shares (COVER) ----
        const pos = shortPositions[ticker];
        const origShares = N(pos.shares || 0);
        const take = Math.min(reduceShares, origShares);
        if (origShares <= 0 || take <= 0) {
          cursor = addDays(cursor, 1);
          continue;
        }

        const remain = origShares - take;

        const oldLiab = N(pos.liabilityAtSnapshot || 0);
        const oldUPL = N(pos.unrealizedPL || 0);

        const ratio = remain > 0 ? remain / origShares : 0;

        const newLiab = oldLiab * ratio;
        const newUPLShort = oldUPL * ratio;

        const dLiab = newLiab - oldLiab;
        const dUPLShort = newUPLShort - oldUPL;

        totals.totalShortLiability = N(totals.totalShortLiability || 0) + dLiab;
        totals.unrealizedPLShort = N(totals.unrealizedPLShort || 0) + dUPLShort;
        totals.unrealizedPLNet = N(totals.unrealizedPLNet || 0) + dUPLShort;
        totals.equityNoCash =
          N(totals.totalLongMarketValue || 0) -
          N(totals.totalShortLiability || 0);
        totals.grossExposure =
          N(totals.totalLongMarketValue || 0) +
          N(totals.totalShortLiability || 0);

        if (remain === 0) {
          delete shortPositions[ticker];
        } else {
          shortPositions[ticker] = {
            ...pos,
            shares: remain,
            liabilityAtSnapshot: newLiab,
            unrealizedPL: newUPLShort,
          };
        }

        // Legacy: treat unrealizedPL net as long+short; long side unchanged here
        const newUnrealizedNet = N(data.unrealizedPL || 0) + dUPLShort;
        await updateDoc(snapRef, {
          longPositions,
          shortPositions,
          totals,
          // legacy
          unrealizedPL: newUnrealizedNet,
        });
      }

      cursor = addDays(cursor, 1);
    }

    console.log(
      "✅ Exit backfill complete (v2 long/short with FIFO for longs)."
    );
    return;
  }

  // ---------------- NON-EXIT PATH (add trade forward) ----------------
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

    const snapDoc = await getDoc(snapRef);

    // Base from previous or existing snapshot (normalize to v2)
    let baseLong = {};
    let baseShort = {};
    let cumulativeTrades = 0;
    let cumulativeInvested = 0;
    let cumulativeRealizedPL = 0;

    if (snapDoc.exists()) {
      const data = snapDoc.data();
      baseLong = structuredClone(data.longPositions ?? {});
      baseShort = structuredClone(data.shortPositions ?? {});
      cumulativeTrades = data.cumulativeTrades ?? 0;
      cumulativeInvested = data.cumulativeInvested ?? 0;
      cumulativeRealizedPL = data.cumulativeRealizedPL ?? 0;
    } else {
      // try previous day
      const prevDate = addDays(dateCursor, -1);
      const prevSnapRef = doc(
        db,
        "users",
        userId,
        "dailySnapshots",
        toIsoDate(prevDate)
      );
      const prevSnapDoc = await getDoc(prevSnapRef);
      if (prevSnapDoc.exists()) {
        const prev = prevSnapDoc.data();
        baseLong = structuredClone(prev.longPositions ?? {});
        baseShort = structuredClone(prev.shortPositions ?? {});
        cumulativeTrades = prev.cumulativeTrades ?? 0;
        cumulativeInvested = prev.cumulativeInvested ?? 0;
        cumulativeRealizedPL = prev.cumulativeRealizedPL ?? 0;
      }
    }

    // Apply this trade
    if ((newTrade.direction || "").toLowerCase() === "short") {
      const prev = baseShort[ticker] || { shares: 0, avgShortPrice: 0 };
      const newShares = N(prev.shares) + Math.abs(N(newTrade.shares));
      const totalVal =
        N(prev.shares) * N(prev.avgShortPrice) +
        Math.abs(N(newTrade.shares)) * N(newTrade.averagePrice);
      const avgShortPrice = newShares > 0 ? totalVal / newShares : 0;

      baseShort[ticker] = {
        ...prev,
        shares: newShares,
        avgShortPrice,
      };
    } else {
      const prev = baseLong[ticker] || { shares: 0, fifoStack: [] };
      const addShares = N(newTrade.shares);
      const fifoStack = Array.isArray(prev.fifoStack)
        ? [...prev.fifoStack]
        : [];
      fifoStack.push({ shares: addShares, price: N(newTrade.averagePrice) });
      baseLong[ticker] = {
        ...prev,
        shares: N(prev.shares || 0) + addShares,
        fifoStack,
      };
    }

    cumulativeInvested += N(newTrade.averagePrice) * N(newTrade.shares);
    cumulativeTrades += 1;

    // Price and compute P/L
    const price = N(historicalPrices?.[ticker]?.priceMap?.[dateStr] ?? 0);

    let totalLongMarketValue = 0;
    let totalShortLiability = 0;
    let totalCostBasisLong = 0;
    let unrealizedPLLong = 0;
    let unrealizedPLShort = 0;

    // valuate all longs
    const longPositions = {};
    for (const [sym, pos] of Object.entries(baseLong)) {
      const p =
        sym === ticker
          ? price
          : N(historicalPrices?.[sym]?.priceMap?.[dateStr] ?? 0);
      const shares = N(pos.shares || 0);
      const fifoStack = (pos.fifoStack || []).map((l) => ({
        shares: N(l.shares),
        price: N(l.price),
      }));
      const costBasis = fifoStack.reduce((s, l) => s + l.shares * l.price, 0);
      const mv = shares * p;
      const upl = mv - costBasis;

      totalLongMarketValue += mv;
      totalCostBasisLong += costBasis;
      unrealizedPLLong += upl;

      longPositions[sym] = {
        shares,
        fifoStack,
        priceAtSnapshot: p,
        marketValue: mv,
        costBasis,
        unrealizedPL: upl,
      };

      if (p === 0) {
        (refetchMap[sym] ||= []).push(dateStr);
      }
    }

    // valuate all shorts
    const shortPositions = {};
    for (const [sym, pos] of Object.entries(baseShort)) {
      const p =
        sym === ticker
          ? price
          : N(historicalPrices?.[sym]?.priceMap?.[dateStr] ?? 0);
      const shares = N(pos.shares || 0);
      const avgShortPrice = N(pos.avgShortPrice || 0);
      const liab = shares * p;
      const upl = (avgShortPrice - p) * shares;

      totalShortLiability += liab;
      unrealizedPLShort += upl;

      shortPositions[sym] = {
        shares,
        avgShortPrice,
        priceAtSnapshot: p,
        liabilityAtSnapshot: liab,
        unrealizedPL: upl,
      };

      if (p === 0) {
        (refetchMap[sym] ||= []).push(dateStr);
      }
    }

    const unrealizedPLNet = unrealizedPLLong + unrealizedPLShort;
    const equityNoCash = totalLongMarketValue - totalShortLiability;
    const grossExposure = totalLongMarketValue + totalShortLiability;

    const totalMarketValue = totalLongMarketValue;
    const totalCostBasis = totalCostBasisLong;
    const totalPLPercent =
      totalCostBasis > 0 ? unrealizedPLNet / totalCostBasis : 0;

    await setDoc(snapRef, {
      version: 2,
      date: dateStr,
      invested: totalMarketValue,
      totalAssets: totalMarketValue,
      netContribution: 0,

      longPositions,
      shortPositions,
      totals: {
        totalLongMarketValue,
        totalShortLiability,
        grossExposure,
        equityNoCash,
        unrealizedPLLong,
        unrealizedPLShort,
        unrealizedPLNet,
      },

      // legacy
      totalCostBasis,
      totalMarketValue,
      unrealizedPL: unrealizedPLNet,
      totalPLPercent,

      cumulativeTrades,
      cumulativeInvested,
      cumulativeRealizedPL,
      createdAt: Timestamp.fromDate(new Date(dateStr)),
    });

    dateCursor.setDate(dateCursor.getDate() + 1);
  }

  // (dividend writer for range remains in generateSnapshotRange)
  // refetchQueue bookkeeping
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
