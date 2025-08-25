import { db } from "../../firebase";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import {
  Timestamp,
  collection,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";
import { addDividendToUserDay } from "../dividends/addDividendToUserDay";

const N = (v) => Number.parseFloat(v || 0);

/**
 * Generate snapshot for a given past date using current positions (used for “yesterday”).
 * Dividends are computed for LONGS only (short div in lieu ignored for now).
 */
export default async function generateSnapshotFromCurrentPosition({
  date,
  userId,
}) {
  const positionsRef = collection(db, "users", userId, "currentPositions");
  const positionsSnap = await getDocs(positionsRef);

  const rawPositions = [];
  const tickers = [];

  positionsSnap.forEach((d) => {
    const data = d.data();
    if (!data.ticker || !data.shares) return;
    rawPositions.push({ id: d.id, ...data });
    tickers.push(data.ticker);
  });

  const dateStr = new Date(date).toISOString().split("T")[0];
  const hist = await fetchHistoricalPrices(tickers, dateStr, dateStr);

  const priceAt = (tk) => N(hist?.[tk]?.priceMap?.[dateStr] ?? 0);
  const dividendMap = Object.fromEntries(
    tickers.map((tk) => [tk, hist?.[tk]?.dividendMap ?? {}])
  );

  // ---------- (1) Reconcile T-2 dividends for LONGS only ----------
  try {
    const d2 = new Date(date);
    d2.setDate(d2.getDate() - 2);
    const d2Str = d2.toISOString().split("T")[0];

    const d2SnapRef = doc(db, "users", userId, "dailySnapshots", d2Str);
    const d2SnapDoc = await getDoc(d2SnapRef);

    if (d2SnapDoc.exists()) {
      const d2Snap = d2SnapDoc.data() || {};
      // Accept v1 or v2 shape; extract long shares only
      const v2Long = d2Snap.longPositions || {};
      const v1Pos = d2Snap.positions || {};
      const d2LongShares = {};

      for (const [tk, p] of Object.entries(v2Long)) {
        const sh = N(p?.shares || 0);
        if (sh > 0) d2LongShares[tk] = sh;
      }
      if (!Object.keys(d2LongShares).length) {
        for (const [tk, p] of Object.entries(v1Pos)) {
          const sh = N(p?.shares || 0);
          if (sh > 0) d2LongShares[tk] = sh;
        }
      }

      if (Object.keys(d2LongShares).length > 0) {
        const d2DivMap = {};
        for (const tk of Object.keys(d2LongShares)) {
          d2DivMap[tk] = dividendMap[tk] || {};
        }

        await checkAndAddDividendsToUser({
          uid: userId,
          from: d2Str,
          to: d2Str,
          positions: d2LongShares,
          dividendMap: d2DivMap,
          writeToSnapshot: true,
        });
      }
    }
  } catch (e) {
    console.warn("T-2 dividend reconcile skipped/failed:", e?.message);
  }

  // ---------- Build positions & P/L for dateStr (longs + shorts) ----------
  const longPositions = {};
  const shortPositions = {};

  let totalLongMarketValue = 0;
  let totalShortLiability = 0;
  let totalCostBasisLong = 0;
  let unrealizedPLLong = 0;
  let unrealizedPLShort = 0;

  for (const pos of rawPositions) {
    const tk = pos.ticker;
    const price = priceAt(tk);
    const sharesNum = N(pos.shares);
    const sharesAbs = Math.abs(sharesNum);
    const dir = (pos.direction || "").toLowerCase();
    const isShort = dir === "short" || sharesNum < 0;

    if (!isShort) {
      const fifoStack = (pos.fifoStack || []).map((e) => ({
        price: N(e.entryPrice ?? e.price ?? 0),
        shares: N(e.sharesRemaining ?? e.shares ?? 0),
      }));

      const costBasis =
        fifoStack.length > 0
          ? fifoStack.reduce((s, l) => s + l.shares * l.price, 0)
          : sharesAbs * N(pos.averagePrice ?? 0);

      const mv = sharesAbs * price;
      const upl = mv - costBasis;

      totalLongMarketValue += mv;
      totalCostBasisLong += costBasis;
      unrealizedPLLong += upl;

      longPositions[tk] = {
        shares: sharesAbs,
        priceAtSnapshot: price,
        marketValue: mv,
        costBasis,
        unrealizedPL: upl,
        fifoStack,
      };
    } else {
      const avgShortPrice = N(pos.avgShortPrice ?? pos.averagePrice ?? pos.avgPrice ?? 0);
      const liab = sharesAbs * price;
      const upl = (avgShortPrice - price) * sharesAbs;

      totalShortLiability += liab;
      unrealizedPLShort += upl;

      shortPositions[tk] = {
        shares: sharesAbs,
        avgShortPrice,
        priceAtSnapshot: price,
        liabilityAtSnapshot: liab,
        unrealizedPL: upl,
      };
    }
  }

  const unrealizedPLNet = unrealizedPLLong + unrealizedPLShort;
  const equityNoCash = totalLongMarketValue - totalShortLiability;
  const grossExposure = totalLongMarketValue + totalShortLiability;

  // ---------- (2) Compute T-1 dividends for LONGS only ----------
  const longSharesForDivs = Object.fromEntries(
    Object.entries(longPositions).map(([tk, p]) => [tk, p.shares])
  );

  const { totalDividendByDate, dailyDividendMap } =
    await checkAndAddDividendsToUser({
      uid: userId,
      from: dateStr,
      to: dateStr,
      positions: longSharesForDivs,
      dividendMap,
      writeToSnapshot: false,
    });

  const todayDividend = totalDividendByDate[dateStr] ?? 0;

  // Get T-2 cumulative dividend total to carry forward
  let prevTotalDividend = 0;
  try {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevStr = prevDate.toISOString().split("T")[0];
    const prevSnapDoc = await getDoc(doc(db, "users", userId, "dailySnapshots", prevStr));
    prevTotalDividend = prevSnapDoc.exists()
      ? N(prevSnapDoc.data()?.totalDividendReceived || 0)
      : 0;
  } catch (err) {
    console.warn("Failed to read previous snapshot for dividend carry:", err?.message);
  }

  const totalDividendReceived = prevTotalDividend + todayDividend;

  // ---------- Build snapshot object ----------
  const snapshot = {
    version: 2,
    date: dateStr,
    invested: totalLongMarketValue,
    totalAssets: totalLongMarketValue,
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

    // Legacy fields
    unrealizedPL: unrealizedPLNet,
    totalCostBasis: totalCostBasisLong,
    totalMarketValue: totalLongMarketValue,
    totalPLPercent:
      totalCostBasisLong > 0 ? unrealizedPLNet / totalCostBasisLong : 0,

    totalDividendReceived,
    dividends: dailyDividendMap[dateStr] ?? [],
    createdAt: Timestamp.fromDate(new Date(dateStr)),
  };

  // ---------- (3) Write dividendHistory for T-1 without double-adding totals ----------
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
    console.warn("Recording dividendHistory for T-1 failed:", e?.message);
  }

  return snapshot;
}
