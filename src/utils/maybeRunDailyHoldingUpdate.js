import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase"; 

export async function maybeRunDailyHoldingUpdate(userId, todayStr) {
  const statsRef = doc(db, "users", userId, "stats", "holdingDuration");
  const statsSnap = await getDoc(statsRef);
  if (!statsSnap.exists()) return;

  const stats = statsSnap.data();
  const lastUpdated = new Date(stats.lastUpdatedDate);
  const today = new Date(todayStr);

  if (lastUpdated.toDateString() === today.toDateString()) return;

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const currentStocks = userSnap.data()?.currentStocks || [];

  let addedDays = 0;
  currentStocks.forEach((pos) => {
    const entryDate = pos.entryTimestamp.toDate?.() ?? new Date(pos.entryTimestamp);
    const remainingShares = pos.availableShares ?? 0;
    const entryPrice = pos.entryPrice ?? 0;

    const capital = remainingShares * entryPrice;
    const daysHeldSinceLastUpdate = (today - lastUpdated) / (1000 * 60 * 60 * 24);

    addedDays += daysHeldSinceLastUpdate * capital;
  });

  await updateDoc(statsRef, {
    totalHoldingDays: stats.totalHoldingDays + addedDays,
    lastUpdatedDate: todayStr,
  });
}
