import {
  collection,
  getDocs,
  doc,
  getDoc
} from "firebase/firestore";
import { db, auth } from "../firebase";

/**
 * Calculate current unrealized P/L based on open positions.
 * @param {string} uid - Firestore user ID
 * @returns {Promise<number>} - total unrealized P/L
 */
export default async function calculateLiveUnrealizedPL(uid) {
  const positionsRef = collection(db, "users", uid, "currentPositions");
  const snapshot = await getDocs(positionsRef);

  let totalPL = 0;

  for (const docSnap of snapshot.docs) {
    const position = docSnap.data();
    const { fifoStack } = position;

    if (!Array.isArray(fifoStack)) continue;

    for (const lot of fifoStack) {
      const { price, shares, marketValue } = lot;

      // Skip if any field is missing
      if (
        price === undefined ||
        shares === undefined ||
        marketValue === undefined
      )
        continue;

      const cost = price * shares;
      const unrealized = marketValue - cost;
      totalPL += unrealized;
    }
  }
  console.log("your pl today is", totalPL)
  return totalPL;
}
