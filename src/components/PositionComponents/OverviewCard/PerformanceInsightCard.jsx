import React, { useMemo, useState, useEffect } from "react";
import MetricsCard from "./MetricsCard";
import Toggle from "./Toggle";
import { getBestWorstPerformers } from "../../../utils/getBestWorstPerformers";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { useUser } from "../../../context/UserContext";
import { calculateWinRate } from "../../../utils/calculateWinRate"; // ✅ NEW import

const PerformanceInsightsCard = () => {
  const { refreshTrigger } = useUser();
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

  useEffect(() => {
    const fetchPerformance = async () => {
      const current = await getBestWorstPerformers(usePLPercentage);
      setCurrentPerformance(current);

      console.log("im waiting to calculate winrate");
      // ✅ Get Win Rate
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
            ? `${pos.ticker} (${(
                (pos.realizedPL / pos.costBasis) *
                100
              ).toFixed(1)}%)`
            : `${pos.ticker} (${pos.realizedPL >= 0 ? "+" : "-"}$${Math.abs(
                pos.realizedPL
              ).toLocaleString()})`;
        };

        setAllTimePerformance({
          best: format(best),
          worst: format(worst),
        });
      }
    };

    fetchPerformance();
  }, [usePLPercentage, refreshTrigger]);
  console.log("your currentperf", currentPerformance)

  const getColorClass = (value) => {
    if (typeof value !== "string") return "";
    console.log("i got here w value", value)
    const isNegative = value.includes("-");
console.log('is negative is', isNegative)
    if (isNegative) return "text-red-500";
    else return "text-green-600";
  };

  const insightsFields = useMemo(
    () => [
      {
        label: `Best Performer (Current)`,
        value: currentPerformance.best,
        valueClass: getColorClass(currentPerformance.best),
        info: `Stock with the highest return in your current holdings (${
          usePLPercentage ? "% return" : "dollar gain"
        }).`,
      },
      {
        label: `Best Performer (All Time)`,
        value: allTimePerformance.best,
        valueClass: getColorClass(allTimePerformance.best),
        info: `Highest performer you've ever held (${
          usePLPercentage ? "% return" : "dollar gain"
        }).`,
      },
      {
        label: `Worst Performer (Current)`,
        value: currentPerformance.worst,
        valueClass: getColorClass(currentPerformance.worst),
        info: `Biggest current loss (${
          usePLPercentage ? "% loss" : "dollar loss"
        }).`,
      },
      {
        label: `Worst Performer (All Time)`,
        value: allTimePerformance.worst,
        valueClass: getColorClass(allTimePerformance.worst),
        info: `Worst performer ever (${
          usePLPercentage ? "% loss" : "dollar loss"
        }).`,
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
    [
      usePLPercentage,
      currentPerformance,
      allTimePerformance,
      winRate,
      sharpeRatio,
    ]
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
