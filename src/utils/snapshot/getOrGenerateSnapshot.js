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

  const snapshotRef = doc(db, "users", uid, "snapshots", dateStr);
  const snapshotDoc = await getDoc(snapshotRef);
  if (snapshotDoc.exists()) return snapshotDoc.data();

  const today = new Date();
  const dateObj = new Date(dateStr);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = isSameDay(dateObj, yesterday);

  // Step 1: Find latest snapshot before dateStr
  const snapshotsRef = collection(db, "users", uid, "snapshots");
  const q = query(
    snapshotsRef,
    where("createdAt", "<", dateObj),
    orderBy("createdAt", "desc")
  );
  const prevSnapDocs = await getDocs(q);

  let baseSnapshot = {
    totalAssets: 0,
    cash: 0,
    invested: 0,
    netContribution: 0,
    positions: {},
  };
  let startDateStr = dateStr;

  if (!prevSnapDocs.empty) {
    const prevSnap = prevSnapDocs.docs[0];
    baseSnapshot = prevSnap.data();
    const prevDateStr = prevSnap.id;

    // move forward from the day after prevDateStr
    const prevDate = new Date(prevDateStr);
    prevDate.setDate(prevDate.getDate() + 1);
    startDateStr = prevDate.toISOString().split("T")[0];
  }

  // If the date requested is yesterday, use current positions
  if (isYesterday) {
    const snapshot = await generateSnapshotFromCurrentPosition({
      date: dateStr,
      userId: uid,
    });

    await setDoc(snapshotRef, snapshot);
    return snapshot;
  }

  // Else, backfill from last known snapshot
  const snapshot = await generateSnapshotRange({
    start: startDateStr,
    end: dateStr,
    baseSnapshot,
    userId: uid,
  });

  return snapshot;
}
