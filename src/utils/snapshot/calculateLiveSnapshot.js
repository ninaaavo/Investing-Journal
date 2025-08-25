import {
  collection,
  doc,
  Timestamp,
  getDocsFromServer,
  getDocFromServer,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import getStockPrices from "../prices/getStockPrices";

const safeParse = (val) => Number.parseFloat(val || 0);

function isShortPosition(pos, sharesNum) {
  const dir = (pos?.direction || "").toLowerCase();
  return dir === "short" || sharesNum < 0;
}

export async function calculateLiveSnapshot() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  // Force server reads to avoid stale cache
  const positionsRef = collection(db, "users", user.uid, "currentPositions");
  const positionsSnap = await getDocsFromServer(positionsRef);

  const rawPositions = [];
  const tickers = [];

  positionsSnap.forEach((snap) => {
    const data = snap.data();
    if (!data.ticker || !data.shares) return;
    rawPositions.push({ id: snap.id, ...data });
    tickers.push(data.ticker);
  });

  const priceData = await getStockPrices(tickers); // { [ticker]: number | { price } }

  // Get yesterday's total dividends to carry
  let totalDividendReceived = 0;
  try {
    const dtET = new Date(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York" }).format(
        new Date()
      )
    );
    dtET.setDate(dtET.getDate() - 1);
    const y = dtET.getFullYear();
    const m = String(dtET.getMonth() + 1).padStart(2, "0");
    const d = String(dtET.getDate()).padStart(2, "0");
    const yesterdayStr = `${y}-${m}-${d}`;

    const prevSnapRef = doc(db, "users", user.uid, "dailySnapshots", yesterdayStr);
    const prevSnap = await getDocFromServer(prevSnapRef);
    totalDividendReceived = prevSnap.exists()
      ? safeParse(prevSnap.data()?.totalDividendReceived)
      : 0;
  } catch (_) {}

  // ---- Build long & short maps + totals ----
  const longPositions = {};
  const shortPositions = {};

  let totalLongMarketValue = 0;
  let totalShortLiability = 0;

  let totalCostBasisLong = 0;
  let unrealizedPLLong = 0;
  let unrealizedPLShort = 0;

  for (const pos of rawPositions) {
    const ticker = pos.ticker;
    const raw = priceData?.[ticker];
    const price = safeParse(typeof raw === "object" ? raw?.price : raw);

    const sharesNum = safeParse(pos.shares);
    const sharesAbs = Math.abs(sharesNum);

    if (!isShortPosition(pos, sharesNum)) {
      // ----- LONG -----
      const fifoStack = Array.isArray(pos.fifoStack)
        ? pos.fifoStack.map((lot) => ({
            shares: safeParse(lot.sharesRemaining ?? lot.shares ?? 0),
            price: safeParse(lot.entryPrice ?? lot.price ?? 0),
          }))
        : [];

      // Fallback to averagePrice if stack not present
      const costBasis =
        fifoStack.length > 0
          ? fifoStack.reduce((s, l) => s + l.shares * l.price, 0)
          : sharesAbs * safeParse(pos.averagePrice ?? 0);

      const marketValue = sharesAbs * price;
      const upl = marketValue - costBasis;

      totalLongMarketValue += marketValue;
      totalCostBasisLong += costBasis;
      unrealizedPLLong += upl;

      longPositions[ticker] = {
        shares: sharesAbs,
        priceAtSnapshot: price,
        marketValue,
        costBasis,
        unrealizedPL: upl,
        fifoStack, // keep for UI/tools
      };
    } else {
      // ----- SHORT -----
      const avgShortPrice = safeParse(
        pos.avgShortPrice ?? pos.averagePrice ?? pos.avgPrice ?? 0
      );
      const liabilityAtSnapshot = sharesAbs * price;
      const upl = (avgShortPrice - price) * sharesAbs;

      totalShortLiability += liabilityAtSnapshot;
      unrealizedPLShort += upl;

      shortPositions[ticker] = {
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

  // Back-compat top-level fields (for existing UI)
  const totalMarketValue = totalLongMarketValue;
  const totalCostBasis = totalCostBasisLong;
  const totalPLPercent =
    totalCostBasis > 0 ? unrealizedPLNet / totalCostBasis : 0;
console.log('im calculate live snap w long and short')
  return {
    version: 2,
    invested: totalMarketValue,
    totalAssets: totalMarketValue, // legacy: "assets" = long MV only in no-cash world
    netContribution: safeParse(0),

    // NEW structure
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

    // Legacy fields expected by older components
    unrealizedPL: unrealizedPLNet,
    totalCostBasis,
    totalMarketValue,
    totalPLPercent,
    totalDividendReceived,
    createdAt: Timestamp.now(),
  };
}
