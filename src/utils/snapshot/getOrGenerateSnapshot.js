import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import generateSnapshotRange from "./generateSnapshotRange";
import generateSnapshotFromCurrentPosition from "./generateSnapshotFromCurrentPosition";

export default async function getOrGenerateSnapshot(dateStr) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  const uid = user.uid;

  const colName = "dailySnapshots";
  const snapshotRef = doc(db, "users", uid, colName, dateStr);
  const snapshotDoc = await getDoc(snapshotRef);
  if (snapshotDoc.exists()) return snapshotDoc.data();

  // Build comparison dates in local midnight (to avoid TZ drift)
  const asLocal = (s) => {
    const [Y, M, D] = s.split("-").map(Number);
    return new Date(Y, M - 1, D);
  };
  const dateObj = asLocal(dateStr);

  // Find latest snapshot before dateStr (same collection)
  const snapshotsRef = collection(db, "users", uid, colName);
  const q1 = query(
    snapshotsRef,
    where("createdAt", "<", dateObj),
    orderBy("createdAt", "desc")
  );
  const prevSnapDocs = await getDocs(q1);

  // Base snapshot defaults to v2 shape
  let baseSnapshot = {
    version: 2,
    date: dateStr,
    invested: 0,
    totalAssets: 0,
    netContribution: 0,
    longPositions: {},
    shortPositions: {},
    totals: {
      totalLongMarketValue: 0,
      totalShortLiability: 0,
      grossExposure: 0,
      equityNoCash: 0,
      unrealizedPLLong: 0,
      unrealizedPLShort: 0,
      unrealizedPLNet: 0,
    },
    // legacy
    unrealizedPL: 0,
    totalCostBasis: 0,
    totalMarketValue: 0,
    totalPLPercent: 0,
  };
  let startDateStr = dateStr;

  if (!prevSnapDocs.empty) {
    const prevSnap = prevSnapDocs.docs[0];
    const prevData = prevSnap.data();

    // Normalize v1 -> v2 if needed
    baseSnapshot = {
      version: 2,
      date: prevSnap.id,
      invested: prevData.totalMarketValue || 0,
      totalAssets: prevData.totalMarketValue || 0,
      netContribution: prevData.netContribution || 0,
      longPositions: prevData.longPositions || prevData.positions || {},
      shortPositions: prevData.shortPositions || {},
      totals: prevData.totals || {
        totalLongMarketValue: prevData.totalMarketValue || 0,
        totalShortLiability: 0,
        grossExposure: prevData.totalMarketValue || 0,
        equityNoCash: prevData.totalMarketValue || 0,
        unrealizedPLLong: prevData.unrealizedPL || 0,
        unrealizedPLShort: 0,
        unrealizedPLNet: prevData.unrealizedPL || 0,
      },
      unrealizedPL: prevData.unrealizedPL || 0,
      totalCostBasis: prevData.totalCostBasis || 0,
      totalMarketValue: prevData.totalMarketValue || 0,
      totalPLPercent: prevData.totalPLPercent || 0,
      totalDividendReceived: prevData.totalDividendReceived || 0,
    };

    const prevDate = asLocal(prevSnap.id);
    prevDate.setDate(prevDate.getDate() + 1);
    startDateStr = prevDate.toISOString().split("T")[0];
  }

  // If target is yesterday, let generateSnapshotFromCurrentPosition write that day
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const isYesterday =
    dateObj.getFullYear() === yesterday.getFullYear() &&
    dateObj.getMonth() === yesterday.getMonth() &&
    dateObj.getDate() === yesterday.getDate();

  if (isYesterday) {
    if (startDateStr < dateStr) {
      const endMinusOne = new Date(dateObj);
      endMinusOne.setDate(endMinusOne.getDate() - 1);
      const endMinusOneStr = endMinusOne.toISOString().split("T")[0];

      await generateSnapshotRange({
        start: startDateStr,
        end: endMinusOneStr,
        baseSnapshot,
        userId: uid,
      });
    }

    const snapshot = await generateSnapshotFromCurrentPosition({
      date: dateStr,
      userId: uid,
    });
    await setDoc(snapshotRef, snapshot);
    return snapshot;
  }

  // Not yesterday: backfill inclusive range
  const snapshot = await generateSnapshotRange({
    start: startDateStr,
    end: dateStr,
    baseSnapshot,
    userId: uid,
  });

  return snapshot;
}
