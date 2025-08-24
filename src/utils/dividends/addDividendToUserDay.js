// utils/dividends/addDividendToUserDay.js
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

/**
 * Add a dividend record for a ticker/day and optionally bump the snapshot total.
 * Creates/updates:
 * - users/{uid}/dividendHistory/{dateStr}.dividends[]
 * - users/{uid}/dailySnapshots/{dateStr}.totalDividendReceived (+ amount)  <-- only if updateSnapshot=true
 * - users/{uid}/dailySnapshots/{dateStr}.dividends[]                       <-- only if updateSnapshot=true
 *
 * @param {Object} params
 * @param {string} params.uid
 * @param {string} params.dateStr         YYYY-MM-DD
 * @param {string} params.ticker
 * @param {number} params.amountPerShare
 * @param {number} params.sharesApplied
 * @param {boolean} [params.updateSnapshot=true]  When false, writes history only (no totals bump).
 */
export async function addDividendToUserDay({
  uid,
  dateStr,
  ticker,
  amountPerShare = 0,
  sharesApplied = 0,
  updateSnapshot = true,
}) {
  const per = Number(amountPerShare) || 0;
  const sh = Math.max(0, Number(sharesApplied) || 0);
  if (per <= 0 || sh <= 0) return;

  const addAmount = per * sh;

  // 1) Upsert dividendHistory/{dateStr}
  const histRef = doc(db, "users", uid, "dividendHistory", dateStr);
  const histSnap = await getDoc(histRef);

  if (!histSnap.exists()) {
    await setDoc(histRef, {
      date: dateStr,
      dividends: [{ ticker, amountPerShare: per, sharesApplied: sh, totalAmount: addAmount }],
      totalDividendReceived: addAmount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    const data = histSnap.data() || {};
    const arr = Array.isArray(data.dividends) ? [...data.dividends] : [];
    const idx = arr.findIndex(
      (e) => e && e.ticker === ticker && Number(e.amountPerShare) === per
    );

    if (idx >= 0) {
      const prev = arr[idx];
      const newShares = (Number(prev.sharesApplied) || 0) + sh;
      arr[idx] = {
        ...prev,
        sharesApplied: newShares,
        totalAmount: per * newShares,
      };
    } else {
      arr.push({ ticker, amountPerShare: per, sharesApplied: sh, totalAmount: addAmount });
    }

    const prevHistTotal = Number(data.totalDividendReceived || 0);
    await updateDoc(histRef, {
      dividends: arr,
      totalDividendReceived: prevHistTotal + addAmount,
      updatedAt: serverTimestamp(),
    });
  }

  if (!updateSnapshot) return; // history-only write

  // 2) Update dailySnapshots/{dateStr}
  const snapRef = doc(db, "users", uid, "dailySnapshots", dateStr);
  const snapSnap = await getDoc(snapRef);
  const prevTotal = snapSnap.exists() ? Number(snapSnap.data()?.totalDividendReceived || 0) : 0;
  const newTotal = prevTotal + addAmount;

  if (!snapSnap.exists()) {
    await setDoc(
      snapRef,
      {
        date: dateStr,
        totalDividendReceived: newTotal,
        dividends: [{ ticker, amountPerShare: per, sharesApplied: sh, totalAmount: addAmount }],
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    const prevDivs = Array.isArray(snapSnap.data()?.dividends) ? snapSnap.data().dividends : [];
    await updateDoc(snapRef, {
      totalDividendReceived: newTotal,
      dividends: [...prevDivs, { ticker, amountPerShare: per, sharesApplied: sh, totalAmount: addAmount }],
      updatedAt: serverTimestamp(),
    });
  }
}
