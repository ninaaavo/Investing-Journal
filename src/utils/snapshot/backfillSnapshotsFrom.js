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

    // ⭐ identify this exit once (idempotency key) + realized delta
    const tradeId =
      newTrade.tradeId ||
      newTrade.id ||
      `${ticker}:${N(newTrade.shares)}@${N(newTrade.averagePrice)}:${fromISO}`;
    const realizedDelta = N(pAndL || 0); // <-- the realized P&L for THIS exit

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

      const longPositions = { ...(data.longPositions || {}) };
      const shortPositions = { ...(data.shortPositions || {}) };
      const totals = { ...(data.totals || {}) };

      // ⭐⭐⭐ REALIZED (cumulative) — apply this exit’s delta idempotently
      const realizedAdjustments = { ...(data.realizedAdjustments || {}) };
      const prevApplied = N(realizedAdjustments[tradeId] || 0);
      const diff = realizedDelta - prevApplied;
      if (diff !== 0) {
        totals.realizedPL = N(totals.realizedPL || 0) + diff;
        realizedAdjustments[tradeId] = realizedDelta;

        // (optional) record the day’s delta only on the exit date for audits/graphs
        if (dateStr === fromISO) {
          const prevToday = N(data.realizedPLToday || 0);
          // ensure idempotent on the exit day as well
          const todayAdjKey = `__exit_${tradeId}`;
          const perDayAdj = { ...(data.realizedPerDayAdjustments || {}) };
          const prevPerDay = N(perDayAdj[todayAdjKey] || 0);
          const dayDiff = realizedDelta - prevPerDay;
          if (dayDiff !== 0) {
            perDayAdj[todayAdjKey] = realizedDelta;
            await updateDoc(snapRef, {
              totals,
              realizedAdjustments,
              realizedPerDayAdjustments: perDayAdj, // optional helper map
              realizedPLToday: prevToday + dayDiff,
            });
          } else {
            await updateDoc(snapRef, { totals, realizedAdjustments });
          }
        } else {
          await updateDoc(snapRef, { totals, realizedAdjustments });
        }
      }
      // ⭐⭐⭐ end realized cumulative

      // ---- then your existing long/short share reductions for visuals/UPL ----
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

    console.log("✅ Exit backfill complete with cumulative realized carry.");
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

  // 🔑 simple idempotency key (no other changes)
  const tradeKey =
    newTrade.tradeId ||
    newTrade.id ||
    `${ticker}:${N(newTrade.shares)}@${N(newTrade.averagePrice)}:${fromISO}`;

  while (toIsoDate(dateCursor) <= yesterdayISO) {
    const dateStr = toIsoDate(dateCursor);
    const snapRef = doc(db, "users", userId, "dailySnapshots", dateStr);
    const snapDoc = await getDoc(snapRef);

    // ---- Base = existing snapshot for THIS date (keep others as-is) or empty
    const emptyTotals = {
      totalLongMarketValue: 0,
      totalShortLiability: 0,
      grossExposure: 0,
      equityNoCash: 0,
      unrealizedPLLong: 0,
      unrealizedPLShort: 0,
      unrealizedPLNet: 0,
      realizedPL:0
    };

    const base = snapDoc.exists()
      ? snapDoc.data()
      : {
          version: 2,
          date: dateStr,
          invested: 0,
          totalAssets: 0,
          netContribution: 0,
          longPositions: {},
          shortPositions: {},
          totals: emptyTotals,
          // legacy mirrors
          totalCostBasis: 0,
          totalMarketValue: 0,
          unrealizedPL: 0,
          totalPLPercent: 0,
          cumulativeTrades: 0,
          cumulativeInvested: 0,
          cumulativeRealizedPL: 0,
          createdAt: Timestamp.fromDate(new Date(dateStr)),
          appliedTradeKeys: {},
        };

    const next = structuredClone(base);

    // ---- Apply this trade to THIS date only once (idempotent per-doc)
    const already = !!next.appliedTradeKeys?.[tradeKey];
    if (!already) {
      if ((newTrade.direction || "").toLowerCase() === "short") {
        const prev = next.shortPositions?.[ticker] || {
          shares: 0,
          avgShortPrice: 0,
        };
        const addShares = Math.abs(N(newTrade.shares));
        const newShares = N(prev.shares) + addShares;
        const totalVal =
          N(prev.shares) * N(prev.avgShortPrice) +
          addShares * N(newTrade.averagePrice);
        const avgShortPrice = newShares > 0 ? totalVal / newShares : 0;

        next.shortPositions = { ...(next.shortPositions || {}) };
        next.shortPositions[ticker] = {
          ...prev,
          shares: newShares,
          avgShortPrice,
        };
      } else {
        const prev = next.longPositions?.[ticker] || {
          shares: 0,
          fifoStack: [],
        };
        const addShares = N(newTrade.shares);
        const fifoStack = Array.isArray(prev.fifoStack)
          ? [...prev.fifoStack]
          : [];
        fifoStack.push({ shares: addShares, price: N(newTrade.averagePrice) });

        next.longPositions = { ...(next.longPositions || {}) };
        next.longPositions[ticker] = {
          ...prev,
          shares: N(prev.shares || 0) + addShares,
          fifoStack,
        };
      }

      next.cumulativeTrades = N(next.cumulativeTrades) + 1;
      next.cumulativeInvested =
        N(next.cumulativeInvested) +
        N(newTrade.averagePrice) * N(newTrade.shares);

      next.appliedTradeKeys = {
        ...(next.appliedTradeKeys || {}),
        [tradeKey]: true,
      };
    }

    // ---- Reprice ONLY this ticker for THIS date and update totals by delta
    const price = N(historicalPrices?.[ticker]?.priceMap?.[dateStr] ?? 0);

    // Before-state for this ticker (from the same-day base)
    const beforeLong = base.longPositions?.[ticker];
    const beforeShort = base.shortPositions?.[ticker];

    let d_totalLongMV = 0;
    let d_totalShortLiab = 0;
    let d_uplLong = 0;
    let d_uplShort = 0;
    let d_totalCostBasis = 0;
    let d_totalMarketValue = 0; // legacy mirror (long MV)

    // Long side
    const curLong = next.longPositions?.[ticker];
    if (curLong) {
      const fifo = (curLong.fifoStack || []).map((l) => ({
        shares: N(l.shares),
        price: N(l.price),
      }));
      const shares = N(curLong.shares || 0);
      const cost = fifo.reduce((s, l) => s + l.shares * l.price, 0);
      const mv = shares * price;
      const upl = mv - cost;

      const bFifo = (beforeLong?.fifoStack || []).map((l) => ({
        shares: N(l.shares),
        price: N(l.price),
      }));
      const bShares = N(beforeLong?.shares || 0);
      const bCost = bFifo.reduce((s, l) => s + l.shares * l.price, 0);
      const bPrice = N(beforeLong?.priceAtSnapshot || 0);
      const bMV = bShares * bPrice;
      const bUPL = bMV - bCost;

      d_totalLongMV += mv - bMV;
      d_uplLong += upl - bUPL;
      d_totalCostBasis += cost - bCost;
      d_totalMarketValue += mv - bMV;

      next.longPositions[ticker] = {
        ...curLong,
        fifoStack: fifo,
        priceAtSnapshot: price,
        marketValue: mv,
        costBasis: cost,
        unrealizedPL: upl,
      };

      if (price === 0) (refetchMap[ticker] ||= []).push(dateStr);
    }

    // Short side
    const curShort = next.shortPositions?.[ticker];
    if (curShort) {
      const shares = N(curShort.shares || 0);
      const avg = N(curShort.avgShortPrice || 0);
      const liab = shares * price;
      const upl = (avg - price) * shares;

      const bShares = N(beforeShort?.shares || 0);
      const bAvg = N(beforeShort?.avgShortPrice || 0);
      const bPrice = N(beforeShort?.priceAtSnapshot || 0);
      const bLiab = bShares * bPrice;
      const bUPL = (bAvg - bPrice) * bShares;

      d_totalShortLiab += liab - bLiab;
      d_uplShort += upl - bUPL;

      next.shortPositions[ticker] = {
        ...curShort,
        priceAtSnapshot: price,
        liabilityAtSnapshot: liab,
        unrealizedPL: upl,
      };

      if (price === 0) (refetchMap[ticker] ||= []).push(dateStr);
    }

    // ---- Totals = same-day base totals + deltas from THIS ticker only
    const totals = { ...(base.totals || emptyTotals) };
    totals.totalLongMarketValue =
      N(totals.totalLongMarketValue) + d_totalLongMV;
    totals.totalShortLiability =
      N(totals.totalShortLiability) + d_totalShortLiab;
    totals.grossExposure =
      N(totals.totalLongMarketValue) + N(totals.totalShortLiability);
    totals.equityNoCash =
      N(totals.totalLongMarketValue) - N(totals.totalShortLiability);
    totals.unrealizedPLLong = N(totals.unrealizedPLLong) + d_uplLong;
    totals.unrealizedPLShort = N(totals.unrealizedPLShort) + d_uplShort;
    totals.unrealizedPLNet =
      N(totals.unrealizedPLLong) + N(totals.unrealizedPLShort);
    next.totals = totals;

    // legacy mirrors
    next.totalCostBasis = N(base.totalCostBasis) + d_totalCostBasis;
    next.totalMarketValue = N(base.totalMarketValue) + d_totalMarketValue; // long MV delta
    next.unrealizedPL = totals.unrealizedPLNet;
    next.totalPLPercent =
      next.totalCostBasis > 0 ? next.unrealizedPL / next.totalCostBasis : 0;

    // bookkeeping
    next.version = 2;
    next.date = dateStr;
    next.invested = next.totalMarketValue;
    next.totalAssets = next.totalMarketValue;
    next.netContribution = 0;
    next.createdAt = Timestamp.fromDate(new Date(dateStr));

    await setDoc(snapRef, next);
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
