import { doc, setDoc, Timestamp } from "firebase/firestore";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";
import { addDividendToUserDay } from "../dividends/addDividendToUserDay";
import { db } from "../../firebase";

const N = (v) => Number.parseFloat(v || 0);

/**
 * Generate and store snapshots from start to end date (inclusive).
 * Accepts v1 (positions) or v2 (longPositions/shortPositions) base snapshots.
 * Dividends computed for LONGS only.
 */
export default async function generateSnapshotRange({
  start,
  end,
  baseSnapshot,
  userId,
  dividendMap = {},
}) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const dates = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }

  // Extract tickers from v2 or v1 shapes
  const baseLong = baseSnapshot.longPositions || baseSnapshot.positions || {};
  const baseShort = baseSnapshot.shortPositions || {};
  const longTickers = Object.keys(baseLong);
  const shortTickers = Object.keys(baseShort);
  const tickers = Array.from(new Set([...longTickers, ...shortTickers]));
  if (tickers.length === 0) return baseSnapshot;

  // Get prices for whole span
  const historical = await fetchHistoricalPrices(tickers, start, end);

  let currentSnapshot = {
    ...baseSnapshot,
    longPositions: baseSnapshot.longPositions || baseSnapshot.positions || {},
    shortPositions: baseSnapshot.shortPositions || {},
  };

  for (const dateStr of dates) {
    let totalLongMarketValue = 0;
    let totalShortLiability = 0;
    let totalCostBasisLong = 0;
    let unrealizedPLLong = 0;
    let unrealizedPLShort = 0;

    const longPositions = {};
    const shortPositions = {};

    // ---- LONGS ----
    for (const tk of Object.keys(currentSnapshot.longPositions || {})) {
      const pos = currentSnapshot.longPositions[tk];
      const price = N(historical?.[tk]?.priceMap?.[dateStr]);
      const shares = N(pos.shares || 0);
      const fifoStack = (pos.fifoStack || []).map((l) => ({
        shares: N(l.shares),
        price: N(l.price),
      }));

      const costBasis =
        fifoStack.length > 0
          ? fifoStack.reduce((s, l) => s + l.shares * l.price, 0)
          : N(pos.costBasis || 0);

      const mv = shares * price;
      const upl = mv - costBasis;

      totalLongMarketValue += mv;
      totalCostBasisLong += costBasis;
      unrealizedPLLong += upl;

      longPositions[tk] = {
        shares,
        fifoStack,
        priceAtSnapshot: price,
        marketValue: mv,
        costBasis,
        unrealizedPL: upl,
      };
    }

    // ---- SHORTS ----
    for (const tk of Object.keys(currentSnapshot.shortPositions || {})) {
      const pos = currentSnapshot.shortPositions[tk];
      const price = N(historical?.[tk]?.priceMap?.[dateStr]);
      const shares = N(pos.shares || 0);
      const avgShortPrice = N(pos.avgShortPrice || 0);

      const liab = shares * price;
      const upl = (avgShortPrice - price) * shares;

      totalShortLiability += liab;
      unrealizedPLShort += upl;

      shortPositions[tk] = {
        shares,
        avgShortPrice,
        priceAtSnapshot: price,
        liabilityAtSnapshot: liab,
        unrealizedPL: upl,
      };
    }

    const unrealizedPLNet = unrealizedPLLong + unrealizedPLShort;
    const equityNoCash = totalLongMarketValue - totalShortLiability;
    const grossExposure = totalLongMarketValue + totalShortLiability;

    const totalMarketValue = totalLongMarketValue;
    const totalCostBasis = totalCostBasisLong;
    const totalPLPercent =
      totalCostBasis > 0 ? unrealizedPLNet / totalCostBasis : 0;

    // Build per-day dividend map (LONGS only)
    const dayDividendMap = {};
    for (const tk of Object.keys(longPositions)) {
      dayDividendMap[tk] =
        (dividendMap[tk] ?? historical?.[tk]?.dividendMap) || {};
    }

    const { totalDividendByDate, dailyDividendMap } =
      await checkAndAddDividendsToUser({
        uid: userId,
        from: dateStr,
        to: dateStr,
        positions: Object.fromEntries(
          Object.entries(longPositions).map(([tk, p]) => [tk, p.shares])
        ),
        dividendMap: dayDividendMap,
        writeToSnapshot: false,
      });

    const todayDividend = totalDividendByDate[dateStr] ?? 0;
    const prevTotalDiv = Number(currentSnapshot.totalDividendReceived || 0);

    const snapshot = {
      version: 2,
      date: dateStr,
      invested: totalMarketValue,
      totalAssets: totalMarketValue,
      netContribution: Number(currentSnapshot.netContribution || 0),

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
      unrealizedPL: unrealizedPLNet,
      totalCostBasis,
      totalMarketValue,
      totalPLPercent,

      totalDividendReceived: prevTotalDiv + todayDividend,
      dividends: dailyDividendMap[dateStr] ?? [],
      createdAt: Timestamp.fromDate(new Date(dateStr)),
    };

    await setDoc(doc(db, "users", userId, "dailySnapshots", dateStr), snapshot);

    // Write dividendHistory for that day WITHOUT bumping snapshot totals
    try {
      const details = dailyDividendMap[dateStr] || [];
      for (const entry of details) {
        await addDividendToUserDay({
          uid: userId,
          dateStr,
          ticker: entry.ticker,
          amountPerShare: Number(entry.amountPerShare) || 0,
          sharesApplied: Number(entry.sharesHeld ?? entry.shares ?? 0) || 0,
          updateSnapshot: false,
        });
      }
    } catch (e) {
      console.warn(`Dividend history write failed for ${dateStr}:`, e?.message);
    }

    currentSnapshot = snapshot;
  }

  return currentSnapshot;
}
