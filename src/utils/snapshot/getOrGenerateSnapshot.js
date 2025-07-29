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

  // ✅ If snapshot exists
  if (snapshotDoc.exists()) {
    return snapshotDoc.data();
  }

  // 🕛 If it's today → just return live, don’t save
  const isToday = isSameDay(new Date(dateStr), new Date());
  const userDoc = await getDoc(doc(db, "users", user.uid));
  const accountCreatedAt = userDoc.exists()
    ? userDoc.data().accountCreatedAt?.toDate?.()
    : null;

  if (!accountCreatedAt) throw new Error("Missing accountCreatedAt");

  const dateObj = new Date(dateStr);
  if (dateObj < accountCreatedAt) {
    throw new Error("Cannot create snapshot before account creation date");
  }

  // 📦 Find most recent snapshot before this date
  const snapshotsRef = collection(db, "users", user.uid, "snapshots");
  const q = query(
    snapshotsRef,
    where("createdAt", "<", dateObj),
    orderBy("createdAt", "desc")
  );

  const prevSnapDocs = await getDocs(q);
  const baseSnapshot = prevSnapDocs.empty ? {
    totalAssets: 0,
    cash: 0,
    invested: 0,
    netContribution: 0,
    positions: []
  } : prevSnapDocs.docs[0].data();

  const snapshot = await generateSnapshot({ date: dateStr, baseSnapshot });

  if (!isToday) {
    await setDoc(snapshotRef, {
      ...snapshot,
      createdAt: Timestamp.fromDate(new Date(dateStr)),
    });
  }

  return snapshot;
}
