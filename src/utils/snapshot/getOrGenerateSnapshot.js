import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import { isSameDay } from "../dateUtils";
import generateSnapshotRange from "./generateSnapshotRange";
import generateSnapshotFromCurrentPosition from "./generateSnapshotFromCurrentPosition";

export default async function getOrGenerateSnapshot(dateStr) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  const uid = user.uid;

  // Use ONE collection consistently
  const colName = "dailySnapshots";

  const snapshotRef = doc(db, "users", uid, colName, dateStr);
  const snapshotDoc = await getDoc(snapshotRef);
  if (snapshotDoc.exists()) return snapshotDoc.data();

  const stripTime = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const [Y, M, D] = dateStr.split("-").map(Number);
  const dateObj = new Date(Y, M - 1, D);
  const yesterday = stripTime(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const isYesterday = dateObj.getTime() === yesterday.getTime();

  // Find latest snapshot before dateStr (same collection)
  const snapshotsRef = collection(db, "users", uid, colName);
  const q = query(
    snapshotsRef,
    where("createdAt", "<", dateObj),
    orderBy("createdAt", "desc")
  );
  const prevSnapDocs = await getDocs(q);

  let baseSnapshot = { totalAssets: 0, invested: 0, netContribution: 0, positions: {} };
  let startDateStr = dateStr;

  if (!prevSnapDocs.empty) {
    const prevSnap = prevSnapDocs.docs[0];
    baseSnapshot = prevSnap.data();
    const prevDate = new Date(prevSnap.id);
    prevDate.setDate(prevDate.getDate() + 1);
    startDateStr = prevDate.toISOString().split("T")[0]; // e.g. 2025-08-07
  }

  if (isYesterday) {
    // If there’s a gap (e.g., startDateStr = 8/07, dateStr = 8/08), fill through 8/07 first
    if (startDateStr < dateStr) {
      const endMinusOne = new Date(dateObj);
      endMinusOne.setDate(endMinusOne.getDate() - 1); // 8/07
      const endMinusOneStr = endMinusOne.toISOString().split("T")[0];

      await generateSnapshotRange({
        start: startDateStr,
        end: endMinusOneStr,
        baseSnapshot,
        userId: uid,
      });
    }

    // Then generate yesterday from current positions (8/08)
    const snapshot = await generateSnapshotFromCurrentPosition({ date: dateStr, userId: uid });
    await setDoc(snapshotRef, snapshot);
    return snapshot;
  }

  // Not yesterday: backfill inclusive range (will create any missing days incl. end)
  const snapshot = await generateSnapshotRange({
    start: startDateStr,
    end: dateStr,
    baseSnapshot,
    userId: uid,
  });

  return snapshot;
}
