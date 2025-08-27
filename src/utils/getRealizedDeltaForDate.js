// utils/getRealizedDeltaForDate.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase"; // <-- change to "../../firebase" if that's your structure

/**
 * Read the realized P&L delta stored for a given date (YYYY-MM-DD).
 * Returns 0 if the doc/field is missing or non-numeric.
 *
 * @param {string} userId
 * @param {string} dateISO - YYYY-MM-DD
 * @returns {Promise<number>}
 */
export async function getRealizedDeltaForDate(userId, dateISO) {
  try {
    const ref = doc(db, "users", userId, "realizedPLByDate", dateISO);
    const snap = await getDoc(ref);
    if (!snap.exists()) return 0;

    const val = Number(snap.data()?.realizedPL ?? 0);
    return Number.isFinite(val) ? val : 0;
  } catch (e) {
    console.warn("[getRealizedDeltaForDate] read failed:", e);
    return 0;
  }
}
