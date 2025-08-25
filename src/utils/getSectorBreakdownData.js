// utils/getSectorBreakdownData.js
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function getCachedSectorBreakdown(userId) {
  const ref = doc(db, "users", userId, "stats", "sectorBreakdown");
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  return Array.isArray(data.breakdown) ? data.breakdown : [];
}

export async function recalcSectorBreakdownAndSave(userId) {
  const apiKey = import.meta.env.VITE_FINNHUB_API_KEY;
  const positionsRef = collection(db, "users", userId, "currentPositions");
  const positionsSnap = await getDocs(positionsRef);

  const sectorMap = {};
  let totalValue = 0;

  for (const posDoc of positionsSnap.docs) {
    const pos = posDoc.data();
    const ticker = pos.ticker;
    const shares = Number(pos.shares ?? 0);
    const avg = Number(pos.averagePrice ?? 0);
    const value = shares * avg;
    if (!ticker || value <= 0) continue;

    let sector = pos.sector || "Other";
    if (!pos.sector && apiKey) {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${apiKey}`
        );
        const result = await res.json();
        sector = result?.finnhubIndustry || "Other";
        // store back onto the position
        const posRef = doc(db, "users", userId, "currentPositions", posDoc.id);
        await updateDoc(posRef, { sector });
      } catch (e) {
        console.error("sector fetch fail", ticker, e);
      }
    }

    totalValue += value;
    sectorMap[sector] = (sectorMap[sector] ?? 0) + value;
  }

  const breakdown = Object.entries(sectorMap)
    .map(([sector, val]) => ({
      name: sector,
      value: totalValue > 0 ? +((val / totalValue) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const ref = doc(db, "users", userId, "stats", "sectorBreakdown");
  await setDoc(ref, {
    breakdown,
    totalValue,
    updatedAt: serverTimestamp(),
  });

  return breakdown;
}
