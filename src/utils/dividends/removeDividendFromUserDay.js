import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";

/**
 * Remove (proportionally) the dividend for a given ticker on a given day.
 *
 * @param {string} uid - User ID
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {string} ticker - Ticker symbol
 * @param {number} sharesToRemove - Number of shares whose dividend should be removed (>= 0)
 */
export async function removeDividendFromUserDay(uid, dateStr, ticker, sharesToRemove = 0) {
  if (!uid || !dateStr || !ticker) return;
  if (!(sharesToRemove > 0)) return;

  const histRef = doc(db, "users", uid, "dividendHistory", dateStr);
  const snapRef = doc(db, "users", uid, "dailySnapshots", dateStr);
  const userRef = doc(db, "users", uid);

  const [histSnap, snapSnap, userSnap] = await Promise.all([
    getDoc(histRef),
    getDoc(snapRef),
    getDoc(userRef),
  ]);

  if (!histSnap.exists()) return;

  const histData = histSnap.data() || {};
  const dividendsArr = Array.isArray(histData.dividends) ? histData.dividends : [];

  // Find the entry for this ticker
  const idx = dividendsArr.findIndex((d) => d?.ticker === ticker);
  if (idx === -1) return;

  const entry = dividendsArr[idx] || {};
  // Common fields we might have saved:
  // - entry.totalReceived (number): total $ for that ticker on that day
  // - entry.perShare or entry.rate (number): $ per share (if stored)
  // - entry.shares (number): shares counted when crediting this dividend (if stored)
  const totalReceived = Number(entry.totalReceived || 0);
  const storedPerShare = Number(
    entry.perShare != null ? entry.perShare : entry.rate != null ? entry.rate : NaN
  );
  const storedShares = Number(entry.shares || 0);

  // Pull snapshot context to infer per-share if needed
  const snapData = snapSnap.exists() ? (snapSnap.data() || {}) : {};
  const snapDivs = snapData.dividends || {}; // { [ticker]: amountForThatTickerThatDay }
  const snapTickerAmount = Number(snapDivs?.[ticker] || totalReceived || 0);

  const positions = snapData.positions || {};
  const pos = positions?.[ticker];
  const snapshotShares = Math.abs(Number(pos?.shares || 0)); // use absolute for safety

  // Determine per-share dividend and shares applied
  let perShare = NaN;
  let sharesAppliedBase = NaN;

  if (!Number.isNaN(storedPerShare) && storedPerShare > 0) {
    perShare = storedPerShare;
    sharesAppliedBase = storedShares > 0 ? storedShares : (snapshotShares > 0 ? snapshotShares : NaN);
  } else if (storedShares > 0 && totalReceived > 0) {
    perShare = totalReceived / storedShares;
    sharesAppliedBase = storedShares;
  } else if (snapshotShares > 0 && snapTickerAmount > 0) {
    perShare = snapTickerAmount / snapshotShares;
    sharesAppliedBase = snapshotShares;
  }

  // If we still can't infer per-share, last-resort proportional fallback:
  // remove min(totalReceived, snapTickerAmount) * (sharesToRemove / (snapshotShares || storedShares || sharesToRemove))
  let removalAmount = 0;
  let sharesUsedForRemoval = 0;

  if (!Number.isNaN(perShare) && perShare > 0) {
    sharesUsedForRemoval = Math.min(sharesToRemove, sharesAppliedBase > 0 ? sharesAppliedBase : sharesToRemove);
    removalAmount = perShare * sharesUsedForRemoval;
  } else {
    // Fallback: proportional against what we know on the snapshot or history
    const baseAmount = snapTickerAmount > 0 ? snapTickerAmount : totalReceived;
    const denomShares = snapshotShares > 0 ? snapshotShares : (storedShares > 0 ? storedShares : sharesToRemove);
    const fraction = denomShares > 0 ? Math.min(1, sharesToRemove / denomShares) : 1;
    removalAmount = baseAmount * fraction;
    sharesUsedForRemoval = sharesToRemove * fraction; // for bookkeeping if you track entry.shares
  }

  // Cap to available amounts; avoid tiny negatives due to float math
  removalAmount = Math.max(0, Math.min(removalAmount, totalReceived, snapTickerAmount || Infinity));

  // If nothing to remove, bail early
  if (!(removalAmount > 0)) return;

  // --- Update dividendHistory/{dateStr} ---
  const newEntryTotal = Math.max(0, totalReceived - removalAmount);

  // Optionally reduce stored shares if present
  const newEntryShares = storedShares > 0
    ? Math.max(0, storedShares - sharesUsedForRemoval)
    : storedShares;

  if (newEntryTotal === 0) {
    // Remove this ticker entry entirely
    const remaining = dividendsArr.filter((d) => d?.ticker !== ticker);
    if (remaining.length > 0) {
      await updateDoc(histRef, {
        dividends: remaining,
        totalDividendReceived: Math.max(
          0,
          Number(histData.totalDividendReceived || 0) - removalAmount
        ),
      });
    } else {
      // No more dividends on this day — delete the doc
      await deleteDoc(histRef);
    }
  } else {
    // Partial reduction
    const nextArr = [...dividendsArr];
    nextArr[idx] = {
      ...entry,
      totalReceived: newEntryTotal,
      ...(storedShares > 0 ? { shares: newEntryShares } : {}),
      ...(Number.isFinite(perShare) && perShare > 0 ? { perShare } : {}),
    };

    await updateDoc(histRef, {
      dividends: nextArr,
      totalDividendReceived: Math.max(
        0,
        Number(histData.totalDividendReceived || 0) - removalAmount
      ),
    });
  }

  // --- Update dailySnapshots/{dateStr} ---
  if (snapSnap.exists()) {
    const nextDivs = { ...(snapDivs || {}) };
    const currentTickerAmt = Number(nextDivs?.[ticker] || 0);
    const nextTickerAmt = Math.max(0, currentTickerAmt - removalAmount);

    if (nextTickerAmt === 0) {
      delete nextDivs[ticker];
    } else {
      nextDivs[ticker] = nextTickerAmt;
    }

    const nextTotalDivOnSnap = Math.max(
      0,
      Number(snapData.totalDividendReceived || 0) - removalAmount
    );

    await updateDoc(snapRef, {
      dividends: nextDivs,
      totalDividendReceived: nextTotalDivOnSnap,
    });
  }

  // --- Update users/{uid}.totalDividendsEarned ---
  const prevTotal = Number(userSnap.data()?.totalDividendsEarned || 0);
  await updateDoc(userRef, {
    totalDividendsEarned: Math.max(0, prevTotal - removalAmount),
  });
}
