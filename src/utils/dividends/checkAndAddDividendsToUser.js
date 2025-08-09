import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function addOneDay(date) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/**
 * Batch check dividend payouts over a date range.
 *
 * @param {Object} params
 * @param {string} params.uid - User ID
 * @param {string} params.from - Start date ("YYYY-MM-DD")
 * @param {string} params.to - End date ("YYYY-MM-DD")
 * @param {Object} params.positions - { [ticker]: number }
 * @param {Object} params.dividendMap - { [ticker]: { [dateStr]: number } }
 * @param {boolean} [params.writeToSnapshot=true]
 */
export async function checkAndAddDividendsToUser({
  uid,
  from,
  to,
  positions,
  dividendMap,
  writeToSnapshot = true,
}) {
  console.log("🟡 Efficient dividend check from", from, "to", to);

  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  const dailyDividendMap = {}; // dateStr => array of dividend entries
  const dailySnapshotMap = {}; // dateStr => snapshot dividends
  const totalDividendByDate = {}; // dateStr => total for that day

  for (const [ticker, dateMap] of Object.entries(dividendMap)) {
    const shares = positions[ticker] ?? 0;
    if (shares <= 0) continue;

    for (const [dateStr, perShare] of Object.entries(dateMap)) {
      const date = parseDate(dateStr);
      if (date < fromDate || date > toDate) continue;

      const totalAmount = shares * perShare;

      const entry = {
        ticker,
        amountPerShare: perShare,
        sharesHeld: shares,
        totalReceived: totalAmount,
        source: "auto",
      };

      if (!dailyDividendMap[dateStr]) dailyDividendMap[dateStr] = [];
      dailyDividendMap[dateStr].push(entry);

      if (writeToSnapshot) {
        if (!dailySnapshotMap[dateStr]) dailySnapshotMap[dateStr] = {};
        dailySnapshotMap[dateStr][ticker] = {
          shares,
          perShare,
          totalAmount,
          exDate: dateStr,
          recordedOn: dateStr,
        };
      }

      totalDividendByDate[dateStr] =
        (totalDividendByDate[dateStr] ?? 0) + totalAmount;
    }
  }
  console.log("Your daily div map is", dailyDividendMap)

  // Save all results
  for (const [dateStr, dividends] of Object.entries(dailyDividendMap)) {
    const totalToday = totalDividendByDate[dateStr];

    const historyRef = doc(db, "users", uid, "dividendHistory", dateStr);
    await setDoc(
      historyRef,
      {
        dividends,
        totalDividendReceived: totalToday,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (writeToSnapshot) {
      const snapshotRef = doc(db, "users", uid, "dailySnapshots", dateStr);
      await updateDoc(snapshotRef, {
        dividends: dailySnapshotMap[dateStr],
      });
    }

    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    const prevTotal = userSnap.data()?.totalDividendsEarned ?? 0;

    await updateDoc(userRef, {
      totalDividendsEarned: prevTotal + totalToday,
    });

  }
  console.log("im returning totaldiv by date", totalDividendByDate, "from", from, "to", to)
  return {
  dailyDividendMap,
  totalDividendByDate,
};

}
