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

const fmtMoney = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtSignedMoney = (n) =>
  `${n >= 0 ? "+" : "-"}$${Math.abs(Number(n || 0)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtSignedPct = (pctNum) => {
  const v = Number(pctNum || 0);
  const sign = v > 0 ? "+" : v < 0 ? "" : "";
  return `${sign}${v.toFixed(1)}%`;
};

const FinancialMetricCard = () => {
  const { todaySnapshot, refreshTrigger } = useUser();

  const [dividendRange, setDividendRange] = useState("1D");
  const [dividendMap, setDividendMap] = useState(null);

  const [openPL, setOpenPL] = useState(null);
  const [dayPL, setDayPL] = useState(null);
  const [totalPLMap, setTotalPLMap] = useState(null);
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

  // ---- v2-snapshot derived metrics (long/short) ----
  const {
    longAssets,
    shortLiability,
    equityNoCash,
    grossExposure,
    leverageDisplay,
    longUPLDisplay,
    shortUPLDisplay,
    lsMixDisplay,
    shortCount,
    topShortConcDisplay,
  } = useMemo(() => {
    const t = todaySnapshot?.totals || {};
    const longMV = Number(t.totalLongMarketValue || 0);
    const shortLiab = Number(t.totalShortLiability || 0);
    const equity = Number(
      t.equityNoCash != null ? t.equityNoCash : longMV - shortLiab
    );
    const gross = Number(
      t.grossExposure != null ? t.grossExposure : longMV + shortLiab
    );

    const longUPL = Number(t.unrealizedPLLong || 0);
    const shortUPL = Number(t.unrealizedPLShort || 0);

    const costBasisLong = Number(todaySnapshot?.totalCostBasis || 0);

    // Short notional at avg short price
    const shortPositions = todaySnapshot?.shortPositions || {};
    let shortNotional = 0;
    let maxShortLiabilityByTicker = 0;
    for (const [tk, p] of Object.entries(shortPositions)) {
      const shares = Number(p?.shares || 0);
      const avgShortPrice = Number(p?.avgShortPrice || 0);
      shortNotional += shares * avgShortPrice;
      const liab = Number(p?.liabilityAtSnapshot || 0);
      if (liab > maxShortLiabilityByTicker) maxShortLiabilityByTicker = liab;
    }

    const longUPLPct = costBasisLong > 0 ? (longUPL / costBasisLong) * 100 : 0;
    const shortUPLPct =
      shortNotional > 0 ? (shortUPL / shortNotional) * 100 : 0;

    const longPct = gross > 0 ? (longMV / gross) * 100 : 0;
    const shortPct = gross > 0 ? (shortLiab / gross) * 100 : 0;

    const lev =
      equity > 0 ? `${(gross / equity).toFixed(2)}×` : "—"; // undefined if equity ≤ 0
    const mix = gross > 0 ? `L ${longPct.toFixed(0)}% / S ${shortPct.toFixed(0)}%` : "—";
    const topConc =
      shortLiab > 0
        ? `${((maxShortLiabilityByTicker / shortLiab) * 100).toFixed(0)}%`
        : "—";

    return {
      longAssets: longMV,
      shortLiability: shortLiab,
      equityNoCash: equity,
      grossExposure: gross,
      leverageDisplay: lev,
      longUPLDisplay: `${fmtSignedMoney(longUPL)} (${fmtSignedPct(longUPLPct)})`,
      shortUPLDisplay: `${fmtSignedMoney(shortUPL)} (${fmtSignedPct(shortUPLPct)})`,
      lsMixDisplay: mix,
      shortCount: Object.keys(shortPositions).length,
      topShortConcDisplay: topConc,
    };
  }, [todaySnapshot]);

  const costBasis = todaySnapshot?.totalCostBasis ?? 0;

  const financialFields = useMemo(
    () => [
      {
        label: "Open P/L",
        value: isLoading || openPL === null ? "Loading..." : openPL,
        info:
          "Unrealized profit/loss on all open positions = current value minus cost basis (long + short).",
      },
      {
        label: "Day P/L",
        value: isLoading || dayPL === null ? "Loading..." : dayPL,
        info:
          "Today’s movement. For buys today: current price − buy price. Otherwise: current price − yesterday’s close. Shorts use (baseline − current).",
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

      // ---- Core long/short exposure block ----
      {
        label: "Long Assets",
        value: isLoading ? "Loading..." : fmtMoney(longAssets),
        info: "Total market value of long positions.",
      },
      {
        label: "Short Liability",
        value: isLoading ? "Loading..." : fmtMoney(shortLiability),
        info:
          "Mark-to-market value you owe on shorts (shares × today’s price).",
      },
      {
        label: "Equity",
        value: isLoading ? "Loading..." : fmtMoney(equityNoCash),
        info:
          "Long Assets − Short Liability. This is the net value of your book ignoring cash.",
      },
      {
        label: "Gross Exposure",
        value: isLoading ? "Loading..." : fmtMoney(grossExposure),
        info: "Total market you’re exposed to: Long Assets + Short Liability.",
      },
      {
        label: "Leverage",
        value: isLoading ? "Loading..." : leverageDisplay,
        info:
          "Gross Exposure ÷ Equity (no cash). If equity ≤ 0, leverage is undefined.",
      },

      // ---- Performance split ----
      {
        label: "Long UPL",
        value: isLoading ? "Loading..." : longUPLDisplay,
        info:
          "Unrealized P/L from longs. % uses long cost basis as denominator.",
      },
      {
        label: "Short UPL",
        value: isLoading ? "Loading..." : shortUPLDisplay,
        info:
          "Unrealized P/L from shorts. % uses short notional at average short price.",
      },
      {
        label: "L/S Mix",
        value: isLoading ? "Loading..." : lsMixDisplay,
        info:
          "Share of exposure by side. Long % = Long Assets / Gross; Short % = Short Liability / Gross.",
      },

      // ---- Legacy / existing ----
      {
        label: "Cost Basis",
        value: isLoading ? "Loading..." : fmtMoney(costBasis),
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
      longAssets,
      shortLiability,
      equityNoCash,
      grossExposure,
      leverageDisplay,
      longUPLDisplay,
      shortUPLDisplay,
      lsMixDisplay,
      shortCount,
      topShortConcDisplay,
      avgHoldingDuration,
    ]
  );

  return <MetricsCard title="Financial Metrics" fields={financialFields} />;
};

export default FinancialMetricCard;
