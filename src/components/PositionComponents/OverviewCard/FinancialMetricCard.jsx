import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import MetricsCard from "./MetricsCard.jsx";
import { useUser } from "../../../context/UserContext";
import { getPLValuesFromSnapshots } from "../../../utils/getPLValuesFromSnapshots.js";
import { fetchHoldingDuration } from "../../../utils/fetchHoldingDuration.js";

const FinancialMetricCard = () => {
  const { todaySnapshot, refreshTrigger } = useUser();

  const [timeRange, setTimeRange] = useState("1D");
  const [dividendRange, setDividendRange] = useState("YTD");
  const [plValues, setPlValues] = useState({});
  const [avgHoldingDuration, setAvgHoldingDuration] = useState(null);

  const isLoading = !todaySnapshot;

  useEffect(() => {
    const loadHoldingDuration = async () => {
      const avg = await fetchHoldingDuration();
      setAvgHoldingDuration(avg);
    };
    loadHoldingDuration();
  }, [refreshTrigger]);

  useEffect(() => {
    if (todaySnapshot) {
      getPLValuesFromSnapshots(todaySnapshot).then(setPlValues);
      fetchHoldingDuration().then(setAvgHoldingDuration); // Optional: re-fetch after snapshot changes
    }
  }, [todaySnapshot]);

  const costBasis = todaySnapshot?.totalCostBasis ?? 0;
  const totalAssets = todaySnapshot?.totalAssets ?? 0;

  const dividendValues = {
    YTD: "$432.75",
    "All Time": "$1,123.88",
  };

  const setTimeRangeCheck = (v) => setTimeRange(v);

  const financialFields = useMemo(
    () => [
      {
        label: "Unrealized P/L",
        type: "dropdown",
        options: ["1D", "1W", "1M", "3M", "1Y", "All"],
        selected: timeRange,
        onChange: setTimeRangeCheck,
        baseValue: isLoading ? "Loading..." : plValues[timeRange],
        info: "Profit or loss based on selected time range. Helps assess short-term portfolio changes.",
      },
      {
        label: "Cost Basis",
        value: isLoading ? "Loading..." : `$${costBasis.toFixed(2)}`,
      },
      {
        label: "Total Assets",
        value: isLoading ? "Loading..." : `$${totalAssets.toFixed(2)}`,
      },
      {
        label: "Dividend",
        type: "dropdown",
        options: ["YTD", "All Time"],
        selected: dividendRange,
        onChange: (value) => setDividendRange(value),
        baseValue: isLoading ? "Loading..." : dividendValues[dividendRange],
        info: "Track how much income your investments generate over time.",
      },
      {
        label: "Avg Holding Duration",
        value:
          avgHoldingDuration === null || isLoading
            ? "Loading..."
            : `${avgHoldingDuration.toFixed(1)} days`,
        info: "Helps assess how long you typically hold investments before selling.",
      },
      {
        label: "Expense Ratio",
        value: isLoading ? "Loading..." : "0.11%",
        info: "Average annual cost of owning ETFs in your portfolio. Lower is usually better.",
      },
    ],
    [
      timeRange,
      dividendRange,
      todaySnapshot?.cash,
      costBasis,
      totalAssets,
      plValues,
      avgHoldingDuration,
      isLoading,
    ]
  );

  return <MetricsCard title="Financial Metrics" fields={financialFields} />;
};

export default FinancialMetricCard;
