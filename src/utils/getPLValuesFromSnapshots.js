import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import getOrGenerateSnapshot from "./snapshot/getOrGenerateSnapshot";
import { toEasternDateOnly, isBeforeDateOnly } from "./dateUtils";
import { lazyFixSnapshotPrice } from "./lazyFetchSnapshot";

const timeFrames = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "1Y": 365,
};

export async function getPLValuesFromSnapshots(todaySnapshot) {
  const user = auth.currentUser;
  if (!user || !todaySnapshot) return {};

  const plValues = {};

  // First snapshot date (start of history)
  const userDoc = await getDoc(doc(db, "users", user.uid));
  const firstDateStr = userDoc.exists() ? userDoc.data().firstSnapshotDate : null;
  if (!firstDateStr) return {};

  const firstDate = toEasternDateOnly(firstDateStr);

  const todayUnrealizedPL = Number(todaySnapshot.unrealizedPL ?? 0);
  const todayTotalCostBasis = Number(todaySnapshot.totalCostBasis ?? 0);

  // 🔍 Only compare against tickers that are OPEN today
  const todayTickers = Object.keys(todaySnapshot.positions || {});

  const today = new Date();

  for (const [label, daysAgo] of Object.entries(timeFrames)) {
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - daysAgo);

    const yyyyMMdd = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(pastDate)
      .replaceAll("/", "-");

    let past = null;

    try {
      if (isBeforeDateOnly(pastDate, firstDate)) {
        const firstSnapDoc = await getDoc(
          doc(db, "users", user.uid, "dailySnapshots", firstDateStr)
        );
        past = firstSnapDoc.exists() ? firstSnapDoc.data() : null;
      } else {
        const snapRef = doc(db, "users", user.uid, "dailySnapshots", yyyyMMdd);
        const snapDoc = await getDoc(snapRef);

        past = snapDoc.exists() ? snapDoc.data() : await getOrGenerateSnapshot(yyyyMMdd);

        // 🧠 Lazy-fix missing prices (priceAtSnapshot === 0)
        if (past?.positions) {
          const tickersWithZeroPrice = Object.entries(past.positions)
            .filter(([_, pos]) => (pos?.priceAtSnapshot ?? 0) === 0)
            .map(([ticker]) => ticker);

          if (tickersWithZeroPrice.length > 0) {
            for (const ticker of tickersWithZeroPrice) {
              await lazyFixSnapshotPrice({
                userId: user.uid,
                ticker,
                date: yyyyMMdd,
              });
            }

            const fixedSnapDoc = await getDoc(snapRef);
            if (fixedSnapDoc.exists()) past = fixedSnapDoc.data();
          }
        }
      }
    } catch (err) {
      console.error(`Error getting snapshot for ${label} (${yyyyMMdd}):`, err);
    }

    // 🧮 Compute past unrealized P/L but ONLY for tickers that are open today
    let pastUnrealizedPL = 0;

    if (past?.positions) {
      for (const ticker of todayTickers) {
        const todayPos = todaySnapshot.positions[ticker];
        const pastPos = past.positions[ticker];
        if (!todayPos || !pastPos) continue;

        const todayShares = Number(todayPos.shares ?? 0);
        const pastShares = Number(pastPos.shares ?? 0);
        const pastMarketValue = Number(pastPos.marketValue ?? 0);
        const pastCostBasis = Number(pastPos.costBasis ?? 0);

        // Guard against zero division
        const pastAvgPrice =
          pastShares > 0 ? pastCostBasis / pastShares : 0;
        const pastPricePerShare =
          pastShares > 0 ? pastMarketValue / pastShares : 0;

        // Cost: buy today's shares at past average price
        const cost = todayShares * pastAvgPrice;

        // Market value then: today's shares at past per-share price
        const marketValue = todayShares * pastPricePerShare;

        pastUnrealizedPL += marketValue - cost;
      }

      const delta = todayUnrealizedPL - pastUnrealizedPL;

      // Percent on *today's* cost basis; guard zero
      const denom = todayTotalCostBasis > 0 ? todayTotalCostBasis : 0;
      const percent = denom > 0 ? (delta / denom) * 100 : 0;

      const sign = delta >= 0 ? "+" : "-";
      plValues[label] = `${sign}$${Math.abs(delta).toFixed(2)} (${sign}${Math.abs(
        percent
      ).toFixed(1)}%)`;
    } else {
      plValues[label] = "N/A";
    }
  }

  // 🎯 All-time still uses full snapshot baseline
  plValues["All"] = await calculateAllTimePL(user.uid, todayUnrealizedPL);
  return plValues;
}

async function calculateAllTimePL(uid, todayUnrealizedPL) {
  const userDoc = await getDoc(doc(db, "users", uid));
  const firstDateStr = userDoc.exists() ? userDoc.data().firstSnapshotDate : null;
  if (!firstDateStr) return "N/A";

  const firstSnapDoc = await getDoc(
    doc(db, "users", uid, "dailySnapshots", firstDateStr)
  );
  if (!firstSnapDoc.exists()) return "N/A";

  const first = firstSnapDoc.data();
  const basePL = Number(first.unrealizedPL ?? 0);
  const delta = todayUnrealizedPL - basePL;

  // Use |basePL| to avoid divide-by-zero explosions; if 0, show 0%
  const denom = Math.abs(basePL);
  const percent = denom > 0 ? (delta / denom) * 100 : 0;

  const sign = delta >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(delta).toFixed(0)} (${sign}${Math.abs(percent).toFixed(1)}%)`;
}
