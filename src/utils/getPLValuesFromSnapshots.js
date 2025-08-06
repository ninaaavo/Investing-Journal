import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import getOrGenerateSnapshot from "./snapshot/getOrGenerateSnapshot";
import { calculateLiveSnapshot } from "./snapshot/calculateLiveSnapshot";
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

  const today = new Date();
  const plValues = {};

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const firstDateStr = userDoc.exists()
    ? userDoc.data().firstSnapshotDate
    : null;
  if (!firstDateStr) return {};

  const firstDate = toEasternDateOnly(firstDateStr);

  const todayUnrealizedPL = todaySnapshot.unrealizedPL ?? 0;

  // 🔍 Get today's tickers (open positions only)
  const todayTickers = Object.keys(todaySnapshot.positions || {});

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
        const snapDoc = await getDoc(
          doc(db, "users", user.uid, "dailySnapshots", yyyyMMdd)
        );
        past = snapDoc.exists()
          ? snapDoc.data()
          : await getOrGenerateSnapshot(yyyyMMdd);

        // 🧠 Lazy fix missing prices
        if (past?.positions) {
          const tickersWithZeroPrice = Object.entries(past.positions)
            .filter(([_, pos]) => pos?.priceAtSnapshot === 0)
            .map(([ticker]) => ticker);

          if (tickersWithZeroPrice.length > 0) {
            for (const ticker of tickersWithZeroPrice) {
              await lazyFixSnapshotPrice({
                userId: user.uid,
                ticker,
                date: yyyyMMdd,
              });
            }

            const fixedSnapDoc = await getDoc(
              doc(db, "users", user.uid, "dailySnapshots", yyyyMMdd)
            );
            if (fixedSnapDoc.exists()) past = fixedSnapDoc.data();
          }
        }
      }
    } catch (err) {
      console.error(`Error getting snapshot for ${label} (${yyyyMMdd}):`, err);
    }

    // 🧮 Filter by today's tickers only
    let pastUnrealizedPL = 0;
    if (past?.positions) {
      for (const ticker of todayTickers) {
        console.log("🔍 Checking", ticker);
        const todayPos = todaySnapshot.positions[ticker];
        const pastPos = past.positions[ticker];

        if (!todayPos || !pastPos) continue;

        const todayShares = todayPos.shares ?? 0;
        const pastAveragePrice = pastPos.costBasis / pastPos.shares;
        const pastMarketValue = pastPos.marketValue ?? 0;
        const pastShares = pastPos.shares ?? 0;

        // Cost: what it cost to buy today's shares at past avg price
        const cost = todayShares * pastAveragePrice;

        // Market value: value of today's shares at past per-share price
        const pastPricePerShare =
          pastShares > 0 ? pastMarketValue / pastShares : 0;
        const marketValue = todayShares * pastPricePerShare;

        const unrealized = marketValue - cost;
        pastUnrealizedPL += unrealized;

        console.log("Today's shares:", todayShares);
        console.log("Past price/share:", pastPricePerShare);
        console.log("Market value then:", marketValue);
        console.log("Cost then:", cost);
        console.log("Accumulated unrealized P/L:", pastUnrealizedPL);
      }

      const delta = todayUnrealizedPL - pastUnrealizedPL;
      const percent = (delta / todaySnapshot.totalCostBasis) * 100;
      const sign = delta >= 0 ? "+" : "-";

      plValues[label] = `${sign}$${Math.abs(delta).toFixed(
        2
      )} (${sign}${Math.abs(percent).toFixed(1)}%)`;
    } else {
      plValues[label] = "N/A";
    }
  }

  // 🎯 All-time still uses full snapshot comparison
  plValues["All"] = await calculateAllTimePL(user.uid, todayUnrealizedPL);
  return plValues;
}

async function calculateAllTimePL(uid, todayUnrealizedPL) {
  const userDoc = await getDoc(doc(db, "users", uid));
  const firstDateStr = userDoc.exists()
    ? userDoc.data().firstSnapshotDate
    : null;
  if (!firstDateStr) return "N/A";

  const firstSnapDoc = await getDoc(
    doc(db, "users", uid, "dailySnapshots", firstDateStr)
  );
  if (!firstSnapDoc.exists()) return "N/A";

  const first = firstSnapDoc.data();
  const basePL = first.unrealizedPL ?? 0;
  const delta = todayUnrealizedPL - basePL;
  const percent = (delta / (Math.abs(basePL) || 1)) * 100;

  const sign = delta >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(delta).toFixed(0)} (${sign}${Math.abs(
    percent
  ).toFixed(1)}%)`;
}
