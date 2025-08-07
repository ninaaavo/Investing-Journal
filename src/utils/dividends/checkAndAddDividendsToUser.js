import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";

/**
 * Adds eligible dividend payouts to user records on ex-dividend day.
 * 
 * @param {Object} params
 * @param {string} params.uid - User ID
 * @param {string} params.dateStr - Snapshot date ("YYYY-MM-DD")
 * @param {Object} params.positions - Current positions at snapshot time
 * @param {Object} params.dividendMap - { [ticker]: { [dateStr]: number } }
 * @param {boolean} [params.writeToSnapshot=true] - Whether to write dividend info into the snapshot doc
 */
export async function checkAndAddDividendsToUser({
  uid,
  dateStr,
  positions,
  dividendMap,
  writeToSnapshot = true,
}) {
  const tickers = Object.keys(positions);
  const snapshotDividends = {};
  let totalToday = 0;

  for (const ticker of tickers) {
    const dividendAmount = dividendMap?.[ticker]?.[dateStr];
    if (!dividendAmount) continue;

    const shares = positions[ticker]?.shares ?? 0;
    const totalAmount = shares * dividendAmount;
    totalToday += totalAmount;

    const entry = {
      ticker,
      shares,
      perShare: dividendAmount,
      totalAmount,
      exDate: dateStr,
      recordedOn: dateStr,
      createdAt: new Date(),
    };

    // ✅ Add to user-level dividend log
    await addDoc(collection(db, "users", uid, "dividends"), entry);

    // ✅ Update monthly dividendHistory summary
    const monthId = dateStr.slice(0, 7); // "YYYY-MM"
    const historyRef = doc(db, "users", uid, "dividendHistory", monthId);
    const historySnap = await getDoc(historyRef);
    const fieldPath = `tickers.${ticker}`;

    if (historySnap.exists()) {
      const histData = historySnap.data();
      const prevTicker = histData.tickers?.[ticker] ?? { total: 0, count: 0 };
      await updateDoc(historyRef, {
        total: (histData.total ?? 0) + totalAmount,
        [`${fieldPath}.total`]: prevTicker.total + totalAmount,
        [`${fieldPath}.count`]: prevTicker.count + 1,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(historyRef, {
        period: monthId,
        total: totalAmount,
        tickers: {
          [ticker]: {
            total: totalAmount,
            count: 1,
          },
        },
        updatedAt: serverTimestamp(),
      });
    }

    // ✅ Optionally store in that day's snapshot
    if (writeToSnapshot) {
      snapshotDividends[ticker] = {
        shares,
        perShare: dividendAmount,
        totalAmount,
        exDate: dateStr,
        recordedOn: dateStr,
      };
    }
  }

  // ✅ Save dividends field in snapshot if any
  if (writeToSnapshot && Object.keys(snapshotDividends).length > 0) {
    const snapshotRef = doc(db, "users", uid, "dailySnapshots", dateStr);
    await updateDoc(snapshotRef, {
      dividends: snapshotDividends,
    });
  }

  // ✅ Update user totalDividendsEarned
  if (totalToday > 0) {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    const prevTotal = userSnap.data()?.totalDividendsEarned ?? 0;

    await updateDoc(userRef, {
      totalDividendsEarned: prevTotal + totalToday,
    });
  }
}
