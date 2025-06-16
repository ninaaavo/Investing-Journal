import React, { useMemo, useState } from "react";
import MetricsCard from "./MetricsCard";

const TIME_OPTIONS = ["Today", "30D", "60D", "120D", "1Y", "All time"];

const TimeSummaryCard = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState("30D");

  // Placeholder logic based on selectedTimeframe — swap with real logic later
  const summaryByTime = {
    Today: { trades: 1, invested: "$500", gains: "$50" },
    "30D": { trades: 12, invested: "$3,200", gains: "$530" },
    "60D": { trades: 20, invested: "$5,700", gains: "$1,070" },
    "120D": { trades: 32, invested: "$7,900", gains: "$1,650" },
    "1Y": { trades: 47, invested: "$8,500", gains: "$2,134" },
    "All time": { trades: 61, invested: "$12,200", gains: "$3,420" },
  };

  const selectedSummary = summaryByTime[selectedTimeframe];

  const timeFields = useMemo(() => [
    {
      label: "Number of Trades",
      value: selectedSummary.trades.toString(),
      info: `Total number of trades made in the past ${selectedTimeframe}`
    },
    {
      label: "Total Money Invested",
      value: selectedSummary.invested,
      info: `Cumulative investments made in the past ${selectedTimeframe}`
    },
    {
      label: "Realized Gain/Loss",
      value: selectedSummary.gains,
      info: `Locked-in profit or loss during the past ${selectedTimeframe}`
    }
  ], [selectedTimeframe]);

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
