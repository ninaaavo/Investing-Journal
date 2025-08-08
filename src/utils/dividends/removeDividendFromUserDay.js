import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";

/**
 * Remove dividend for a given ticker on a given day.
 *
 * @param {string} uid - User ID
 * @param {string} dateStr - Format: "YYYY-MM-DD"
 * @param {string} ticker - Ticker symbol to remove
 */
export async function removeDividendFromUserDay(uid, dateStr, ticker) {
  const histRef = doc(db, "users", uid, "dividendHistory", dateStr);
  const snapRef = doc(db, "users", uid, "dailySnapshots", dateStr);
  const userRef = doc(db, "users", uid);

  const histSnap = await getDoc(histRef);
  const snapSnap = await getDoc(snapRef);
  const userSnap = await getDoc(userRef);

  if (!histSnap.exists()) return;

  const histData = histSnap.data();
  const dividends = histData.dividends || [];
  const remainingDividends = dividends.filter((d) => d.ticker !== ticker);
  const removedEntry = dividends.find((d) => d.ticker === ticker);

  if (!removedEntry) return;

  const newTotal = (histData.totalDividendReceived || 0) - removedEntry.totalReceived;

  // 🧾 Update or delete dividendHistory
  if (remainingDividends.length > 0) {
    await updateDoc(histRef, {
      dividends: remainingDividends,
      totalDividendReceived: newTotal,
    });
  } else {
    await deleteDoc(histRef);
  }

  // 📊 Update snapshot
  if (snapSnap.exists()) {
    const snapData = snapSnap.data();
    const dividendsField = snapData.dividends || {};
    delete dividendsField[ticker];

    await updateDoc(snapRef, {
      dividends: dividendsField,
    });
  }

  // 🧮 Adjust totalDividendsEarned on user
  const prevTotal = userSnap.data()?.totalDividendsEarned || 0;
  await updateDoc(userRef, {
    totalDividendsEarned: Math.max(0, prevTotal - removedEntry.totalReceived),
  });
}
