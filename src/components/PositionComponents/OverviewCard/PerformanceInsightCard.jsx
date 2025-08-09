import React, { useMemo, useState, useEffect } from "react";
import MetricsCard from "./MetricsCard";
import Toggle from "./Toggle";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { useUser } from "../../../context/UserContext";
import { calculateWinRate } from "../../../utils/calculateWinRate";

const PerformanceInsightsCard = () => {
  const { todaySnapshot, refreshTrigger } = useUser();
  const [usePLPercentage, setUsePLPercentage] = useState(true);
  const [currentPerformance, setCurrentPerformance] = useState({
    best: "Loading...",
    worst: "Loading...",
  });
  const [allTimePerformance, setAllTimePerformance] = useState({
    best: "Loading...",
    worst: "Loading...",
  });
  const [winRate, setWinRate] = useState("Loading...");
  const [sharpeRatio, setSharpeRatio] = useState("Loading...");

  // 🧠 Calculate best/worst from snapshot
  useEffect(() => {
    if (!todaySnapshot) return;

    const positions = todaySnapshot.positions || {};
    let bestSymbol = null;
    let worstSymbol = null;
    let bestValue = -Infinity;
    let worstValue = Infinity;

    for (const [ticker, pos] of Object.entries(positions)) {
      const { unrealizedPL, costBasis } = pos;
      if (unrealizedPL === undefined || costBasis === undefined) continue;

      const percentPL = costBasis !== 0 ? unrealizedPL / costBasis : 0;
      const value = usePLPercentage ? percentPL : unrealizedPL;

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
      return usePLPercentage
        ? `${symbol} (${(value * 100).toFixed(1)}%)`
        : `${symbol} (${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString()})`;
    };

    setCurrentPerformance({
      best: format(bestSymbol, bestValue),
      worst: format(worstSymbol, worstValue),
    });
  }, [todaySnapshot, usePLPercentage]);

  // 🧠 Fetch all-time performance and win rate
  useEffect(() => {
    const fetchPerformance = async () => {
      const rate = await calculateWinRate();
      setWinRate(rate);

      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        if (userData.sharpeRatio !== undefined) {
          setSharpeRatio(userData.sharpeRatio.toFixed(2));
        }

        const best = userData.bestClosedPosition;
        const worst = userData.worstClosedPosition;

        const format = (pos) => {
          if (!pos || !isFinite(pos.realizedPL) || !isFinite(pos.costBasis))
            return "N/A";
          return usePLPercentage
            ? `${pos.ticker} (${((pos.realizedPL / pos.costBasis) * 100).toFixed(1)}%)`
            : `${pos.ticker} (${pos.realizedPL >= 0 ? "+" : "-"}$${Math.abs(pos.realizedPL).toLocaleString()})`;
        };

        setAllTimePerformance({
          best: format(best),
          worst: format(worst),
        });
      }
    };

    fetchPerformance();
  }, [usePLPercentage, refreshTrigger]);

  const getColorClass = (value) => {
    if (typeof value !== "string") return "";
    return value.includes("-") ? "text-red-500" : "text-green-600";
  };

  const insightsFields = useMemo(
    () => [
      {
        label: `Best Performer (Current)`,
        value: currentPerformance.best,
        valueClass: getColorClass(currentPerformance.best),
        info: `Stock with the highest return in your current holdings (${usePLPercentage ? "% return" : "dollar gain"}).`,
      },
      {
        label: `Best Performer (All Time)`,
        value: allTimePerformance.best,
        valueClass: getColorClass(allTimePerformance.best),
        info: `Highest performer you've ever held (${usePLPercentage ? "% return" : "dollar gain"}).`,
      },
      {
        label: `Worst Performer (Current)`,
        value: currentPerformance.worst,
        valueClass: getColorClass(currentPerformance.worst),
        info: `Biggest current loss (${usePLPercentage ? "% loss" : "dollar loss"}).`,
      },
      {
        label: `Worst Performer (All Time)`,
        value: allTimePerformance.worst,
        valueClass: getColorClass(allTimePerformance.worst),
        info: `Worst performer ever (${usePLPercentage ? "% loss" : "dollar loss"}).`,
      },
      {
        label: "Win Rate",
        value: winRate,
        info: "The percentage of closed positions where you made a profit.",
      },
      // {
      //   label: "Sharpe Ratio",
      //   value: sharpeRatio,
      //   info: "Measures risk-adjusted return. Higher is better (above 1 is good)."
      // },
    ],
    [usePLPercentage, currentPerformance, allTimePerformance, winRate, sharpeRatio]
  );

  const toggleComponent = (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-700">Best/Worst based on:</span>
      <Toggle
        checked={usePLPercentage}
        onChange={() => setUsePLPercentage((prev) => !prev)}
        labelLeft="$"
        labelRight="%"
      />
    </div>
  );

  return (
    <MetricsCard
      title="Performance Insights"
      fields={insightsFields}
      headerExtra={toggleComponent}
    />
  );
};

export default PerformanceInsightsCard;
