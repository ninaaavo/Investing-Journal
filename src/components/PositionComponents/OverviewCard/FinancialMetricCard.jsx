import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import MetricsCard from "./MetricsCard.jsx";
import { useUser } from "../../../context/UserContext";

const FinancialMetricCard = () => {
  const [timeRange, setTimeRange] = useState("1D");
  const [dividendRange, setDividendRange] = useState("YTD");

  const { todaySnapshot } = useUser();
  const isLoading = !todaySnapshot;

  const cash = todaySnapshot?.cash ?? 0;
  const invested = todaySnapshot?.invested ?? 0;
  const totalAssets = todaySnapshot?.totalAssets ?? 0;

  const plValues = {
    "1D": "+$320 (3.2%)",
    "1W": "+$780 (7.1%)",
    "1M": "+$1,400 (12.5%)",
    "3M": "+$2,340 (21.8%)",
    "1Y": "+$5,600 (52.1%)",
    All: "+$7,800 (81.2%)",
  };

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
        label: "P/L Change",
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
          // TODO: implement Firestore cash update + snapshot recalculation
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
    [timeRange, dividendRange, cash, invested, totalAssets]
  );

  if (isLoading) {
    return <div>Loading financial snapshot...</div>;
  }

  return <MetricsCard title="Financial Metrics" fields={financialFields} />;
};

export default FinancialMetricCard;
