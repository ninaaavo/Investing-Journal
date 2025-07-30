import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import getOrGenerateSnapshot from "./snapshot/getOrGenerateSnapshot";


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

  // Fetch user's first snapshot date and snapshot
  const userDoc = await getDoc(doc(db, "users", user.uid));
  const firstDateStr = userDoc.exists() ? userDoc.data().firstSnapshotDate : null;
  if (!firstDateStr) return {}; // Bail out if undefined

  const firstDate = new Date(firstDateStr);
  const firstSnapDoc = await getDoc(doc(db, "users", user.uid, "dailySnapshots", firstDateStr));
  const firstSnapshot = firstSnapDoc.exists() ? firstSnapDoc.data() : null;
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
        if (snapDoc.exists()) {
          past = snapDoc.data();
        } else {
          past = await getOrGenerateSnapshot(yyyyMMdd); // new helper
        }
      }
    } catch (err) {
      console.error(`Error getting snapshot for ${label} (${yyyyMMdd}):`, err);
    }


    if (past) {
      const delta = todaySnapshot.totalAssets - past.totalAssets;
      const percent = (delta / (past.totalAssets || 1)) * 100;
      const sign = delta >= 0 ? "+" : "-";
      plValues[label] = `${sign}$${Math.abs(delta).toFixed(0)} (${sign}${Math.abs(percent).toFixed(1)}%)`;
    } else {
      plValues[label] = "N/A";
    }
  }

  plValues["All"] = await calculateAllTimePL(user.uid, todaySnapshot);
  return plValues;
}

async function calculateAllTimePL(uid, todaySnapshot) {
  const firstSnapshotRef = doc(db, "users", uid); // assuming this is stored as a field
  const userDoc = await getDoc(firstSnapshotRef);
  const firstDateStr = userDoc.exists()
    ? userDoc.data().firstSnapshotDate
    : null;

  if (!firstDateStr) return "N/A";

  const firstSnapDoc = await getDoc(
    doc(db, "users", uid, "snapshots", firstDateStr)
  );
  if (!firstSnapDoc.exists()) return "N/A";

  const first = firstSnapDoc.data();
  const delta = todaySnapshot.totalAssets - first.totalAssets;
  const percent = (delta / first.totalAssets) * 100;

  const sign = delta >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(delta).toFixed(0)} (${sign}${Math.abs(
    percent
  ).toFixed(1)}%)`;
}
