import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import getOrGenerateSnapshot from "./snapshot/getOrGenerateSnapshot";
import calculateLiveUnrealizedPL from "./calculateLiveUnrealizedPL"; 

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
  const firstDateStr = userDoc.exists() ? userDoc.data().firstSnapshotDate : null;
  if (!firstDateStr) return {};

  const firstDate = new Date(firstDateStr);
  const firstSnapDoc = await getDoc(doc(db, "users", user.uid, "dailySnapshots", firstDateStr));
  const firstSnapshot = firstSnapDoc.exists() ? firstSnapDoc.data() : null;

  const todayUnrealizedPL = todaySnapshot.unrealizedPL ?? 0; // ✅ use actual snapshot

  for (const [label, daysAgo] of Object.entries(timeFrames)) {
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - daysAgo);
    const yyyyMMdd = pastDate.toISOString().split("T")[0];

    let past = null;
    try {
      if (pastDate < firstDate) {
        past = firstSnapshot;
      } else {
        const snapDoc = await getDoc(doc(db, "users", user.uid, "dailySnapshots", yyyyMMdd));
        past = snapDoc.exists() ? snapDoc.data() : await getOrGenerateSnapshot(yyyyMMdd);
      }
    } catch (err) {
      console.error(`Error getting snapshot for ${label} (${yyyyMMdd}):`, err);
    }

    if (past?.unrealizedPL !== undefined) {
      const delta = todayUnrealizedPL - past.unrealizedPL;
      const percent = (delta / (Math.abs(past.unrealizedPL) || 1)) * 100;
      const sign = delta >= 0 ? "+" : "-";
      plValues[label] = `${sign}$${Math.abs(delta).toFixed(0)} (${sign}${Math.abs(percent).toFixed(1)}%)`;
    } else {
      plValues[label] = "N/A";
    }
  }

  plValues["All"] = await calculateAllTimePL(user.uid, todayUnrealizedPL);
  return plValues;
}

async function calculateAllTimePL(uid, todayUnrealizedPL) {
  const userDoc = await getDoc(doc(db, "users", uid));
  const firstDateStr = userDoc.exists() ? userDoc.data().firstSnapshotDate : null;
  if (!firstDateStr) return "N/A";

  const firstSnapDoc = await getDoc(doc(db, "users", uid, "dailySnapshots", firstDateStr));
  if (!firstSnapDoc.exists()) return "N/A";

  const first = firstSnapDoc.data();
  const basePL = first.unrealizedPL ?? 0;
  const delta = todayUnrealizedPL - basePL;
  const percent = (delta / (Math.abs(basePL) || 1)) * 100;

  const sign = delta >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(delta).toFixed(0)} (${sign}${Math.abs(percent).toFixed(1)}%)`;
}
