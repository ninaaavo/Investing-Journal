import React, { useMemo } from "react";
import MetricsCard from "./MetricsCard";

const PerformanceInsightsCard = () => {
  const bestPerformer = {
    current: "AAPL (+34.2%)",
    allTime: "NVDA (+112.5%)",
  };

  const worstPerformer = {
    current: "DIS (-12.7%)",
    allTime: "BABA (-48.9%)",
  };

  const winRate = "67.8%";
  const sharpeRatio = "1.42";

  const getColorClass = (value) => {
    if (typeof value !== "string") return "";
    return value.includes("-") ? "text-red-500" : value.match(/\+[\d.]+%/) ? "text-green-600" : "";
  };

  const insightsFields = useMemo(() => [
    {
      label: "Best Performer (Current)",
      value: bestPerformer.current,
      valueClass: getColorClass(bestPerformer.current),
      info: "Stock with the highest return in your current holdings."
    },
    {
      label: "Best Performer (All Time)",
      value: bestPerformer.allTime,
      valueClass: getColorClass(bestPerformer.allTime),
      info: "All-time highest performing stock you've ever held."
    },
    {
      label: "Worst Performer (Current)",
      value: worstPerformer.current,
      valueClass: getColorClass(worstPerformer.current),
      info: "Current holding with the biggest loss. Might need attention."
    },
    {
      label: "Worst Performer (All Time)",
      value: worstPerformer.allTime,
      valueClass: getColorClass(worstPerformer.allTime),
      info: "The biggest loss you've experienced. Useful for reflection."
    },
    {
      label: "Win Rate",
      value: winRate,
      info: "The percentage of closed positions where you made a profit."
    },
    {
      label: "Sharpe Ratio",
      value: sharpeRatio,
      info: "Measures risk-adjusted return. Higher is better (above 1 is good)."
    },
  ], []);

  return <MetricsCard title="Performance Insights" fields={insightsFields} singleLine />;
};

export default PerformanceInsightsCard;
