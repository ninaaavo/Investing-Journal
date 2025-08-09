import { auth } from "../firebase";
import { getCachedLiveSnapshot } from "./snapshot/getCachedLiveSnapshot"; // Adjust path as needed

/**
 * Fetches best/worst performer from today's cached live snapshot.
 * @param {boolean} usePercentage - Whether to use % P/L or $ P/L
 * @returns {Promise<{ best: string, worst: string }>}
 */
export async function getBestWorstPerformers(usePercentage = true) {
  const user = auth.currentUser;
  if (!user) return { best: "N/A", worst: "N/A" };

  let snapshot;
  try {
    snapshot = await getCachedLiveSnapshot(user.uid); // ⬅️ now uses cached snapshot
  } catch (error) {
    console.error("Failed to get live snapshot:", error);
    return { best: "N/A", worst: "N/A" };
  }

  const positions = snapshot?.positions || {};

  let bestSymbol = null;
  let worstSymbol = null;
  let bestValue = -Infinity;
  let worstValue = Infinity;

  for (const [ticker, pos] of Object.entries(positions)) {
    const { unrealizedPL, costBasis } = pos;
    if (unrealizedPL === undefined || costBasis === undefined) continue;

    const percentPL = costBasis !== 0 ? unrealizedPL / costBasis : 0;
    const value = usePercentage ? percentPL : unrealizedPL;

    if (value > bestValue) {
      bestValue = value;
      bestSymbol = ticker;
    }
    if (value < worstValue) {
      worstValue = value;
      worstSymbol = ticker;
    }
  }

  const format = (symbol, value) => {
    if (!symbol || !isFinite(value)) return "N/A";
    return usePercentage
      ? `${symbol} (${(value * 100).toFixed(1)}%)`
      : `${symbol} (${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString()})`;
  };

  console.log("Live Best:", format(bestSymbol, bestValue), "Live Worst:", format(worstSymbol, worstValue));

  return {
    best: format(bestSymbol, bestValue),
    worst: format(worstSymbol, worstValue),
  };
}
