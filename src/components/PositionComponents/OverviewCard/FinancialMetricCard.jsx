import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import MetricsCard from "./MetricsCard.jsx";
import { useUser } from "../../../context/UserContext";
import { fetchHoldingDuration } from "../../../utils/fetchHoldingDuration.js";
import {
  getOpenPLFromSnapshot,
  getDayPLFromSnapshots,
  getTotalPLBreakdown,
} from "../../../utils/getPLValuesFromSnapshots.js";
import { getDividendBreakdown } from "../../../utils/dividends/getDividendValuesFromSnapshots.js";

const FinancialMetricCard = () => {
  const { todaySnapshot, refreshTrigger } = useUser();

  const [dividendRange, setDividendRange] = useState("1D"); // <- options below match this
  const [dividendMap, setDividendMap] = useState(null);     // { "1D": "$…", … }

  const [openPL, setOpenPL] = useState(null);
  const [dayPL, setDayPL] = useState(null);
  const [totalPLMap, setTotalPLMap] = useState(null); // { "1D": "...", ... }
  const [totalPLRange, setTotalPLRange] = useState("1D");
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
    if (!todaySnapshot) return;

    (async () => {
      try {
        const [openStr, dayStr, totalMap, divMap] = await Promise.all([
          getOpenPLFromSnapshot(todaySnapshot),
          getDayPLFromSnapshots(todaySnapshot),
          getTotalPLBreakdown(todaySnapshot),
          getDividendBreakdown(todaySnapshot),
        ]);
        setOpenPL(openStr);
        setDayPL(dayStr);
        setTotalPLMap(totalMap || {});
        setDividendMap(divMap || {});
      } catch (e) {
        console.error("Failed to compute metrics:", e);
        setOpenPL("N/A");
        setDayPL("N/A");
        setTotalPLMap({});
        setDividendMap({});
      }
    })();

    fetchHoldingDuration().then(setAvgHoldingDuration).catch(() => {});
  }, [todaySnapshot]);

  const costBasis = todaySnapshot?.totalCostBasis ?? 0;
  const totalAssets = todaySnapshot?.totalAssets ?? 0;

  const financialFields = useMemo(
    () => [
      {
        label: "Open P/L",
        value: isLoading || openPL === null ? "Loading..." : openPL,
        info:
          "Unrealized profit/loss on all open positions = current value minus cost basis.",
      },
      {
        label: "Day P/L",
        value: isLoading || dayPL === null ? "Loading..." : dayPL,
        info:
          "Today’s movement. For buys today: current price − buy price. Otherwise: current price − yesterday’s close.",
      },
      {
        label: "Total P/L",
        type: "dropdown",
        options: ["1D", "1W", "1M", "3M", "1Y", "All"],
        selected: totalPLRange,
        onChange: (v) => setTotalPLRange(v),
        baseValue:
          isLoading || !totalPLMap
            ? "Loading..."
            : totalPLMap[totalPLRange] ?? "N/A",
        info:
          "Realized + Unrealized over the selected window: ΔUnrealized + Realized in (start, today]. % uses the start date cost basis.",
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
        options: ["1D", "1W", "1M", "3M", "1Y", "All"],
        selected: dividendRange,
        onChange: (value) => setDividendRange(value),
        baseValue:
          isLoading || !dividendMap
            ? "Loading..."
            : dividendMap[dividendRange] ?? "N/A",
        info:
          "Cumulative dividends earned over the selected window, derived from snapshot totals (no double-counting).",
      },
      {
        label: "Avg Holding Duration",
        value:
          avgHoldingDuration === null || isLoading
            ? "Loading..."
            : `${avgHoldingDuration.toFixed(1)} days`,
        info:
          "Helps assess how long you typically hold investments before selling.",
      },
      {
        label: "Expense Ratio",
        value: isLoading ? "Loading..." : "0.11%",
        info:
          "Average annual cost of owning ETFs in your portfolio. Lower is usually better.",
      },
    ],
    [
      isLoading,
      openPL,
      dayPL,
      totalPLMap,
      totalPLRange,
      dividendMap,
      dividendRange,
      costBasis,
      totalAssets,
      avgHoldingDuration,
    ]
  );

  return <MetricsCard title="Financial Metrics" fields={financialFields} />;
};

export default FinancialMetricCard;
