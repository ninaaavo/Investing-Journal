import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { getCachedLiveSnapshot } from "./getCachedLiveSnapshot";

/** Delete users/{uid}/liveSnapshot/current then force a fresh rebuild. */
export async function invalidateLiveSnapshot(uid) {
  if (!uid) return;
  try {
    await deleteDoc(doc(db, "users", uid, "liveSnapshot", "current"));
    // Force bypass the in-memory cache
    await getCachedLiveSnapshot(uid, true);
    console.log("Live snapshot invalidated and rebuilt.");
  } catch (err) {
    console.warn("invalidateLiveSnapshot:", err?.message || err);
  }
}
