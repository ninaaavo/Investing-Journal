import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export async function getSectorBreakdownData(userId) {
  const apiKey = import.meta.env.VITE_FINNHUB_API_KEY;

  if (!apiKey) {
    console.error("Missing VITE_FINNHUB_API_KEY in environment.");
    return [];
  }

  const positionsRef = collection(db, "users", userId, "currentPositions");
  const positionsSnap = await getDocs(positionsRef);

  const sectorMap = {};
  let totalValue = 0;

  for (const docSnap of positionsSnap.docs) {
    const pos = docSnap.data();
    const ticker = pos.ticker;
    const value = (pos.averagePrice ?? 0) * (pos.shares ?? 0);
    totalValue += value;

    let sector = "Other";
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${apiKey}`
      );
      const result = await res.json();
      sector = result.finnhubIndustry || "Other";
    } catch (err) {
      console.error("Error fetching sector for", ticker, err);
    }

    sectorMap[sector] = (sectorMap[sector] ?? 0) + value;
  }

  const breakdown = Object.entries(sectorMap)
    .map(([sector, value]) => ({
      name: sector,
      value: totalValue > 0 ? +(value / totalValue * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  console.log("i got breakdown being", breakdown);
  return breakdown;
}
