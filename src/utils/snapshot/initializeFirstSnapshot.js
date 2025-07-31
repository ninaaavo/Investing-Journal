import { doc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export async function initializeFirstSnapshot(userId) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yyyyMMdd = yesterday.toISOString().split("T")[0];

  // 🔹 1. Create empty snapshot
  const snapshotRef = doc(db, "users", userId, "dailySnapshots", yyyyMMdd);
  await setDoc(snapshotRef, {
    cash: 0,
    invested: 0,
    totalAssets: 0,
    netContribution: 0,
    positions: [],
    createdAt: Timestamp.fromDate(yesterday),
  });

  // 🔹 2. Create realized P/L record
  const realizedPLRef = doc(db, "users", userId, "realizedPLByDate", yyyyMMdd);
  await setDoc(realizedPLRef, {
    realizedPL: 0,
    date: yyyyMMdd,
    createdAt: Timestamp.fromDate(yesterday),
  });

  // 🔹 3. Track first snapshot date in user profile
  await updateDoc(doc(db, "users", userId), {
    firstSnapshotDate: yyyyMMdd,
  });
}
