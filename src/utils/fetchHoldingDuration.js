import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { auth } from "../firebase";

/**
 * Fetch the average holding duration from Firestore.
 * @returns {Promise<number | null>} The average duration in days, or null if not found.
 */
export async function fetchHoldingDuration() {
  const user = auth.currentUser;
  if (!user) return null;

  const statsRef = doc(db, "users", user.uid, "stats", "holdingDuration");
  const snap = await getDoc(statsRef);

  if (!snap.exists()) return null;

  const { totalHoldingDays = 0, totalCapital = 0 } = snap.data();
  if (totalCapital === 0) return 0;

  return totalHoldingDays / totalCapital;
}
