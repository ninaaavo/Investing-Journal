import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import MetricsCard from "./MetricsCard.jsx";
import { useUser } from "../../../context/UserContext";
import { calculateLiveSnapshot } from "../../../utils/snapshot/calculateLiveSnapshot";
import { getPLValuesFromSnapshots } from "../../../utils/getPLValuesFromSnapshots.js";
import { db } from "../../../firebase";
import { doc, getDoc } from "firebase/firestore";
import { fetchHoldingDuration } from "../../../utils/fetchHoldingDuration.js";

const FinancialMetricCard = () => {
  const { refreshTrigger } = useUser();
  
  const [timeRange, setTimeRange] = useState("1D");
  const [dividendRange, setDividendRange] = useState("YTD");
  const [todaySnapshot, setTodaySnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [plValues, setPlValues] = useState({});
  const [avgHoldingDuration, setAvgHoldingDuration] = useState(null);
  console.log("your today snapshot is", todaySnapshot)
  useEffect(() => {
  const loadHoldingDuration = async () => {
    const avg = await fetchHoldingDuration();
    setAvgHoldingDuration(avg);
  };
  loadHoldingDuration();
}, [refreshTrigger]);

useEffect(() => {
  if (todaySnapshot) {
    fetchHoldingDuration().then(setAvgHoldingDuration); // Re-fetch after snapshot
  }
}, [todaySnapshot]);

  useEffect(() => {
    async function fetchSnapshot() {
      setIsLoading(true);
      try {
        const snapshot = await calculateLiveSnapshot();
        setTodaySnapshot(snapshot);
      } catch (error) {
        console.error("Error fetching live snapshot:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSnapshot();
  }, [refreshTrigger]);

  useEffect(() => {
    if (todaySnapshot) {
      getPLValuesFromSnapshots(todaySnapshot).then(setPlValues);
    }
  }, [todaySnapshot]);

  const invested = todaySnapshot?.invested ?? 0;
  const totalAssets = todaySnapshot?.totalAssets ?? 0;
  const dividendValues = {
    YTD: "$432.75",
    "All Time": "$1,123.88",
  };

  const setTimeRangeCheck = (v) => {
    setTimeRange(v);
  };

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
        label: "Cash on Hand",
        editable: true,
        defaultValue:
          isLoading || todaySnapshot?.cash === undefined || todaySnapshot?.cash === null
            ? "Loading..."
            : todaySnapshot.cash,
        onValueChange: (value) => {
          console.log("User updated cash to:", value);
        },
      },
      {
        label: "Money Investing",
        value: isLoading ? "Loading..." : `$${invested.toLocaleString()}`,
      },
      {
        label: "Total Assets",
        value: isLoading ? "Loading..." : `$${totalAssets.toLocaleString()}`,
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
      invested,
      totalAssets,
      plValues,
      avgHoldingDuration,
      isLoading,
    ]
  );

  return <MetricsCard title="Financial Metrics" fields={financialFields} />;
};

export default FinancialMetricCard;
