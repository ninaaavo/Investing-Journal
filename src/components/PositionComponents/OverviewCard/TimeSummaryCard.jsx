import React, { useMemo, useState, useEffect } from "react";
import MetricsCard from "./MetricsCard";
import { db } from "../../../firebase";
import { useUser } from "../../../context/UserContext";
import { doc, getDoc } from "firebase/firestore";
import { formatCurrency } from "../../../utils/formatCurrency";

const TIME_OPTIONS = ["Today", "30D", "60D", "120D", "1Y", "All time"];

const daysMap = {
  Today: 0,
  "30D": 30,
  "60D": 60,
  "120D": 120,
  "1Y": 365,
  "All time": null,
};

const TimeSummaryCard = () => {
  const { user, refreshTrigger } = useUser();
  const [selectedTimeframe, setSelectedTimeframe] = useState("30D");
  const [summary, setSummary] = useState({ trades: null, invested: null, gains: null });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setSummary({ trades: null, invested: null, gains: null }); // Trigger loading state

      const today = new Date();
      const offset = daysMap[selectedTimeframe];

      const todayKey = today.toISOString().split("T")[0];
      const todayRef = doc(db, "users", user.uid, "dailySnapshots", todayKey);
      const todaySnap = await getDoc(todayRef);
      const todayData = todaySnap.exists() ? todaySnap.data() : {};
      
      if (selectedTimeframe === "All time") {
        setSummary({
          trades: todayData.cumulativeTrades ?? 0,
          invested: todayData.cumulativeInvested ?? 0,
          gains: todayData.cumulativeRealizedPL ?? 0,
        });
        return;
      }

      const prior = new Date(today);
      prior.setDate(prior.getDate() - offset);
      const priorKey = prior.toISOString().split("T")[0];
      const priorRef = doc(db, "users", user.uid, "dailySnapshots", priorKey);
      const priorSnap = await getDoc(priorRef);
      const priorData = priorSnap.exists() ? priorSnap.data() : {};

      const trades = (todayData.cumulativeTrades ?? 0) - (priorData.cumulativeTrades ?? 0);
      const invested = (todayData.cumulativeInvested ?? 0) - (priorData.cumulativeInvested ?? 0);
      const gains = (todayData.cumulativeRealizedPL ?? 0) - (priorData.cumulativeRealizedPL ?? 0);

      setSummary({ trades, invested, gains });
    };

    fetchData();
  }, [selectedTimeframe, user, refreshTrigger]);

  const timeFields = useMemo(() => {
    const { trades, invested, gains } = summary;

    const color = (value) => {
      if (value > 0) return "text-green-600";
      if (value < 0) return "text-red-600";
      return "";
    };

    return [
      {
        label: "Number of Trades",
        value: trades === null ? "Loading..." : trades.toString(),
        info: `Total number of trades made in the past ${selectedTimeframe}`,
      },
      {
        label: "Total Money Invested",
        value: invested === null ? "Loading..." : (
          <span className={color(invested)}>{formatCurrency(invested)}</span>
        ),
        info: `Cumulative investments made in the past ${selectedTimeframe}`,
      },
      {
        label: "Realized Gain/Loss",
        value: gains === null ? "Loading..." : (
          <span className={color(gains)}>{formatCurrency(gains)}</span>
        ),
        info: `Locked-in profit or loss during the past ${selectedTimeframe}`,
      }
    ];
  }, [summary, selectedTimeframe]);

  return (
    <MetricsCard
      title="Time-Based Summaries"
      fields={timeFields}
      headerExtra={
        <select
          className="text-sm bg-gray-100 px-1 py-0.5 rounded"
          value={selectedTimeframe}
          onChange={(e) => setSelectedTimeframe(e.target.value)}
        >
          {TIME_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      }
    />
  );
};

export default TimeSummaryCard;
