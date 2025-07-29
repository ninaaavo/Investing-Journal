import { doc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export async function initializeFirstSnapshot(userId) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yyyyMMdd = yesterday.toISOString().split("T")[0];

  const snapshotRef = doc(db, "users", userId, "dailySnapshots", yyyyMMdd);
  await setDoc(snapshotRef, {
    cash: 0,
    invested: 0,
    totalAssets: 0,
    netContribution: 0,
    positions: [],
    createdAt: Timestamp.fromDate(yesterday),
  });

  await updateDoc(doc(db, "users", userId), {
    firstSnapshotDate: yyyyMMdd,
  });
}
