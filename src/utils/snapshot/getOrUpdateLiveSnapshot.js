import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { calculateLiveSnapshot } from "./calculateLiveSnapshot";

/**
 * Fetch or regenerate the live snapshot for today and save to Firestore.
 * @param {string} uid - Firebase UID
 * @returns {Promise<Object>} - The live snapshot
 */
export async function getOrUpdateLiveSnapshot(uid) {
  const todayKey = new Date().toISOString().split("T")[0];
  const snapshotRef = doc(db, "users", uid, "liveSnapshot", "current");

  try {
    const docSnap = await getDoc(snapshotRef);
    const existing = docSnap.exists() ? docSnap.data() : null;

    // ✅ Return if today's snapshot already exists
    if (existing?.date === todayKey) {
      return existing;
    }

    // ⏱ Generate new live snapshot
    const snapshot = await calculateLiveSnapshot();

    const fullSnapshot = {
      ...snapshot,
      date: todayKey,
      lastUpdated: Date.now(),
    };

    await setDoc(snapshotRef, fullSnapshot);
    return fullSnapshot;
  } catch (err) {
    console.error("Failed to get or update live snapshot:", err.message);
    throw err;
  }
}
