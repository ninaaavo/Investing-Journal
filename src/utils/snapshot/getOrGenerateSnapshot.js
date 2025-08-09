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
  console.log("im checking", dateStr);
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  const uid = user.uid;

  const snapshotRef = doc(db, "users", uid, "dailySnapshots", dateStr);
  const snapshotDoc = await getDoc(snapshotRef);
  // console.log("your snapshot doc exist is", snapshotDoc.exists())
  // console.log("the data get returned is")
  if (snapshotDoc.exists()) return snapshotDoc.data();

  function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  const today = new Date();
  console.log("today is", today);

  const [year, month, day] = dateStr.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day); // Local time at midnight
  const yesterday = stripTime(new Date());
  yesterday.setDate(yesterday.getDate() - 1);

  console.log(
    "dateobj is",
    dateObj.getTime(),
    "yesterday is",
    yesterday.getTime()
  );

  const isYesterday = dateObj.getTime() === yesterday.getTime();
  console.log("Is yesterday is", isYesterday);

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
    console.log("Im checking yesterday");
    const snapshot = await generateSnapshotFromCurrentPosition({
      date: dateStr,
      userId: uid,
    });

    await setDoc(snapshotRef, snapshot);
    return snapshot;
  }

  // Else, backfill from last known snapshot
  console.log("im generate range from", startDateStr, "end", dateStr);
  const snapshot = await generateSnapshotRange({
    start: startDateStr,
    end: dateStr,
    baseSnapshot,
    userId: uid,
  });

  return snapshot;
}
