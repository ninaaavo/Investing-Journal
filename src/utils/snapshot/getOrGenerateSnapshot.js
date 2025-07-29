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
import generateSnapshot from "./generateSnapshot";

export default async function getOrGenerateSnapshot(dateStr) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const snapshotRef = doc(db, "users", user.uid, "snapshots", dateStr);
  const snapshotDoc = await getDoc(snapshotRef);

  // ✅ Already exists → return it
  if (snapshotDoc.exists()) return snapshotDoc.data();

  const isToday = isSameDay(new Date(dateStr), new Date());
  const dateObj = new Date(dateStr);

  // 🔍 Find the most recent snapshot before this date
  const snapshotsRef = collection(db, "users", user.uid, "snapshots");
  const q = query(
    snapshotsRef,
    where("createdAt", "<", dateObj),
    orderBy("createdAt", "desc")
  );

  const prevSnapDocs = await getDocs(q);
  const baseSnapshot = prevSnapDocs.empty
    ? {
        totalAssets: 0,
        cash: 0,
        invested: 0,
        netContribution: 0,
        positions: [],
      }
    : prevSnapDocs.docs[0].data();

  // 📦 Generate snapshot based on the closest one before
  const snapshot = await generateSnapshot({ date: dateStr, baseSnapshot });

  // 💾 Save if not today
  if (!isToday) {
    await setDoc(snapshotRef, {
      ...snapshot,
      createdAt: Timestamp.fromDate(dateObj),
    });
  }

  return snapshot;
}
