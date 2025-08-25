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

  // store BOTH text and numeric value so we can color correctly
  const [currentPerformance, setCurrentPerformance] = useState({
    best: { text: "Loading...", val: 0 },
    worst: { text: "Loading...", val: 0 },
  });
  const [allTimePerformance, setAllTimePerformance] = useState({
    best: { text: "Loading...", val: 0 },
    worst: { text: "Loading...", val: 0 },
  });

  const [winRate, setWinRate] = useState("Loading...");
  const [sharpeRatio, setSharpeRatio] = useState("Loading...");

  const fmtMoneySigned = (v) =>
    `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString()}`;

  const longMap = todaySnapshot?.longPositions || todaySnapshot?.positions || {};
  const shortMap = todaySnapshot?.shortPositions || {};

  const valForLong = (pos) => {
    const upl = Number(pos?.unrealizedPL ?? 0);
    if (!usePLPercentage) return upl;
    const cb = Number(pos?.costBasis ?? 0);
    return cb !== 0 ? upl / cb : 0;
  };
  const valForShort = (pos) => {
    const upl = Number(pos?.unrealizedPL ?? 0);
    if (!usePLPercentage) return upl;
    const shares = Number(pos?.shares ?? 0);
    const avgShort = Number(pos?.avgShortPrice ?? 0);
    const shortNotional = shares * avgShort;
    return shortNotional !== 0 ? upl / shortNotional : 0;
  };

  const formatLine = (side, symbol, value) =>
    usePLPercentage
      ? `${side} - ${symbol} (${(value * 100).toFixed(1)}%)`
      : `${side} - ${symbol} (${fmtMoneySigned(value)})`;

  // Best/Worst from current holdings (long + short)
  useEffect(() => {
    if (!todaySnapshot) return;

    let best = { side: null, tk: null, v: -Infinity };
    let worst = { side: null, tk: null, v: Infinity };

    for (const [tk, pos] of Object.entries(longMap)) {
      const v = valForLong(pos);
      if (v > best.v) best = { side: "Long", tk, v };
      if (v < worst.v) worst = { side: "Long", tk, v };
    }
    for (const [tk, pos] of Object.entries(shortMap)) {
      const v = valForShort(pos);
      if (v > best.v) best = { side: "Short", tk, v };
      if (v < worst.v) worst = { side: "Short", tk, v };
    }

    setCurrentPerformance({
      best:
        best.tk == null || !isFinite(best.v)
          ? { text: "N/A", val: 0 }
          : { text: formatLine(best.side, best.tk, best.v), val: best.v },
      worst:
        worst.tk == null || !isFinite(worst.v)
          ? { text: "N/A", val: 0 }
          : { text: formatLine(worst.side, worst.tk, worst.v), val: worst.v },
    });
  }, [todaySnapshot, usePLPercentage]);

  // All-time performance & win rate (prefix Long/Short and keep numeric)
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

        const toLine = (pos) => {
          if (!pos || !isFinite(pos.realizedPL) || !isFinite(pos.costBasis)) {
            return { text: "N/A", val: 0 };
          }
          const side =
            (pos.direction || "").toLowerCase() === "short" ? "Short" : "Long";
          if (usePLPercentage) {
            const pct = pos.costBasis !== 0 ? pos.realizedPL / pos.costBasis : 0;
            return { text: formatLine(side, pos.ticker, pct), val: pct };
          } else {
            return { text: formatLine(side, pos.ticker, pos.realizedPL), val: pos.realizedPL };
          }
        };

        setAllTimePerformance({
          best: toLine(best),
          worst: toLine(worst),
        });
      }
    };

    fetchPerformance();
  }, [usePLPercentage, refreshTrigger]);

  const getColorClass = (item) => {
    if (!item) return "";
    const v = Number(item.val);
    if (!isFinite(v)) return "";
    if (v > 0) return "text-green-600";
    if (v < 0) return "text-red-500";
    return "text-gray-600";
  };

  const insightsFields = useMemo(
    () => [
      {
        label: `Best Performer (Current)`,
        value: currentPerformance.best.text,
        valueClass: getColorClass(currentPerformance.best),
        info:
          "Best return among your open positions. Long uses UPL/Cost Basis. Short uses UPL/Short Notional.",
      },
      {
        label: `Best Performer (All Time)`,
        value: allTimePerformance.best.text,
        valueClass: getColorClass(allTimePerformance.best),
        info: `Best closed trade (${usePLPercentage ? "% return" : "dollar gain"}).`,
      },
      {
        label: `Worst Performer (Current)`,
        value: currentPerformance.worst.text,
        valueClass: getColorClass(currentPerformance.worst),
        info:
          "Worst current return. Long uses UPL/Cost Basis. Short uses UPL/Short Notional.",
      },
      {
        label: `Worst Performer (All Time)`,
        value: allTimePerformance.worst.text,
        valueClass: getColorClass(allTimePerformance.worst),
        info: `Worst closed trade (${usePLPercentage ? "% loss" : "dollar loss"}).`,
      },
      {
        label: "Win Rate",
        value: winRate,
        info: "Percentage of closed positions that were profitable.",
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
