import { auth } from "../../firebase";
import fetchHistoricalPrices from "../prices/fetchHistoricalPrices";
import { Timestamp, collection, getDocs } from "firebase/firestore";
import { checkAndAddDividendsToUser } from "../dividends/checkAndAddDividendsToUser";

const N = (v) => Number.parseFloat(v || 0);

export default async function generateSnapshot({ date = null, baseSnapshot = null }) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const uid = user.uid;

  const positionsRef = collection(globalThis.db || (await import("../../firebase")).db, "users", uid, "currentPositions");
  const positionsSnap = await getDocs(positionsRef);

  const rawPositions = [];
  const tickers = [];

  positionsSnap.forEach((doc) => {
    const data = doc.data();
    if (!data.ticker || !data.shares) return;
    rawPositions.push({ id: doc.id, ...data });
    tickers.push(data.ticker);
  });

  const targetDate = date ? new Date(date) : new Date();
  const dateStr = targetDate.toISOString().split("T")[0];

  const result = await fetchHistoricalPrices(tickers, dateStr, dateStr);
  const priceAt = (tk) => N(result?.[tk]?.priceMap?.[dateStr] ?? 0);
  const dividendMap = Object.fromEntries(
    tickers.map((tk) => [tk, result?.[tk]?.dividendMap ?? {}])
  );

  // ---- Build long/short maps ----
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
      const fifoStack = Array.isArray(pos.fifoStack)
        ? pos.fifoStack.map((lot) => ({
            shares: N(lot.sharesRemaining ?? lot.shares ?? 0),
            price: N(lot.entryPrice ?? lot.price ?? 0),
          }))
        : [];

      const costBasis =
        fifoStack.length > 0
          ? fifoStack.reduce((s, l) => s + l.shares * l.price, 0)
          : sharesAbs * N(pos.averagePrice ?? 0);

      const marketValue = sharesAbs * price;
      const upl = marketValue - costBasis;

      totalLongMarketValue += marketValue;
      totalCostBasisLong += costBasis;
      unrealizedPLLong += upl;

      longPositions[tk] = {
        shares: sharesAbs,
        priceAtSnapshot: price,
        marketValue,
        costBasis,
        unrealizedPL: upl,
        fifoStack,
      };
    } else {
      const avgShortPrice = N(pos.avgShortPrice ?? pos.averagePrice ?? pos.avgPrice ?? 0);
      const liabilityAtSnapshot = sharesAbs * price;
      const upl = (avgShortPrice - price) * sharesAbs;

      totalShortLiability += liabilityAtSnapshot;
      unrealizedPLShort += upl;

      shortPositions[tk] = {
        shares: sharesAbs,
        avgShortPrice,
        priceAtSnapshot: price,
        liabilityAtSnapshot,
        unrealizedPL: upl,
      };
    }
  }

  const unrealizedPLNet = unrealizedPLLong + unrealizedPLShort;
  const equityNoCash = totalLongMarketValue - totalShortLiability;
  const grossExposure = totalLongMarketValue + totalShortLiability;

  // Back-compat
  const totalMarketValue = totalLongMarketValue;
  const totalCostBasis = totalCostBasisLong;
  const totalPLPercent = totalCostBasis > 0 ? unrealizedPLNet / totalCostBasis : 0;

  // Dividends for LONGS only
  await checkAndAddDividendsToUser({
    uid,
    dateStr,
    positions: Object.fromEntries(Object.entries(longPositions).map(([tk, p]) => [tk, p.shares])),
    dividendMap,
    writeToSnapshot: true,
  });

  return {
    version: 2,
    date: dateStr,
    invested: totalMarketValue,
    totalAssets: totalMarketValue,
    netContribution: N(baseSnapshot?.netContribution),

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
    createdAt: Timestamp.now(),
  };
}
