import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";

/** Delete users/{uid}/liveSnapshot/current if it exists. */
export async function invalidateLiveSnapshot(uid) {
  if (!uid) return;
  try {
    await deleteDoc(doc(db, "users", uid, "liveSnapshot", "current"));
  } catch (err) {
    // If doc doesn't exist or perms block, we just ignore.
    console.warn("invalidateLiveSnapshot:", err?.message || err);
  }
}
