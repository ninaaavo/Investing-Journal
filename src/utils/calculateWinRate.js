import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase"; // adjust path as needed

export async function calculateWinRate() {
  const user = auth.currentUser;
  if (!user) return "N/A";

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return "N/A";

    const data = userSnap.data();
    const winCount = data.winCount ?? 0;
    const lossCount = data.lossCount ?? 0;
    const total = winCount + lossCount;
    if (total === 0) return "N/A";

    const winRate = (winCount / total) * 100;
    return `${winRate.toFixed(1)}%`;
  } catch (error) {
    console.error("Error calculating win rate:", error);
    return "N/A";
  }
}
