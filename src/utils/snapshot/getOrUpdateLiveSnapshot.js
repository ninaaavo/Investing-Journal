import { doc, getDocFromServer, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { calculateLiveSnapshot } from "./calculateLiveSnapshot";

function todayKeyET() {
  const dt = new Date(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York" }).format(new Date())
  );
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Fetch or regenerate the live snapshot for today and save to Firestore.
 * @param {string} uid - Firebase UID
 * @returns {Promise<Object>} - The live snapshot
 */
export async function getOrUpdateLiveSnapshot(uid) {
  const todayKey = todayKeyET(); // use ET so we don't accidentally roll to next day at night
  const snapshotRef = doc(db, "users", uid, "liveSnapshot", "current");

  try {
    // Force server read to avoid stale cached reads after deletes/updates
    const docSnap = await getDocFromServer(snapshotRef);
    const existing = docSnap.exists() ? docSnap.data() : null;

    if (existing?.date === todayKey) {
      return existing;
    }

    const snapshot = await calculateLiveSnapshot();

    const fullSnapshot = {
      ...snapshot,
      date: todayKey,
      lastUpdated: Date.now(),
    };

    await setDoc(snapshotRef, fullSnapshot);
    console.log("the full snap is",fullSnapshot)
    return fullSnapshot;
  } catch (err) {
    console.error("Failed to get or update live snapshot:", err.message);
    throw err;
  }
}
