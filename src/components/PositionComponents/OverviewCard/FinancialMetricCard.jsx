import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import MetricsCard from "./MetricsCard.jsx";
import { useUser } from "../../../context/UserContext";
import { calculateLiveSnapshot } from "../../../utils/snapshot/calculateLiveSnapshot";
import { getPLValuesFromSnapshots } from "../../../utils/getPLValuesFromSnapshots.js";
const FinancialMetricCard = () => {
  const { refreshTrigger } = useUser();

useEffect(() => {
  async function fetchSnapshot() {
    setIsLoading(true); // Optional: show loading again
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
}, [refreshTrigger]); // ✅ Re-run when trigger updates

  const [timeRange, setTimeRange] = useState("1D");
  const [dividendRange, setDividendRange] = useState("YTD");
  const [todaySnapshot, setTodaySnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    async function fetchSnapshot() {
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
  }, []);

  const [plValues, setPlValues] = useState({});

  useEffect(() => {
  if (todaySnapshot) {
    getPLValuesFromSnapshots(todaySnapshot).then(setPlValues);
  }
}, [todaySnapshot]);
  console.log("your today snapshot is", todaySnapshot);
  console.log("pl is", plValues)
  const cash = todaySnapshot?.cash ?? 0;
  const invested = todaySnapshot?.invested ?? 0;
  const totalAssets = todaySnapshot?.totalAssets ?? 0;
  const dividendValues = {
    YTD: "$432.75",
    "All Time": "$1,123.88",
  };

  const setTimeRangeCheck = (v) => {
    console.log("hi, changing to", v);
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
      baseValue: plValues[timeRange],
      info: "Profit or loss based on selected time range. Helps assess short-term portfolio changes.",
    },
    {
      label: "Cash on Hand",
      editable: true,
      defaultValue: cash,
      onValueChange: (value) => {
        console.log("User updated cash to:", value);
      },
    },
    {
      label: "Money Investing",
      value: `$${invested.toLocaleString()}`,
    },
    {
      label: "Total Assets",
      value: `$${totalAssets.toLocaleString()}`,
    },
    {
      label: "Dividend",
      type: "dropdown",
      options: ["YTD", "All Time"],
      selected: dividendRange,
      onChange: (value) => setDividendRange(value),
      baseValue: dividendValues[dividendRange],
      info: "Track how much income your investments generate over time.",
    },
    {
      label: "Avg Holding Duration",
      value: "104 days",
      info: "Helps assess how long you typically hold investments before selling.",
    },
    {
      label: "Expense Ratio",
      value: "0.11%",
      info: "Average annual cost of owning ETFs in your portfolio. Lower is usually better.",
    },
  ],
  [timeRange, dividendRange, cash, invested, totalAssets, plValues] // ✅ Add plValues here
);

  if (isLoading) {
    return <div>Loading financial snapshot...</div>;
  }

  return <MetricsCard title="Financial Metrics" fields={financialFields} />;
};

export default FinancialMetricCard;
