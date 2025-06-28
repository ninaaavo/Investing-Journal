import { useState } from "react";
import { motion } from "framer-motion";
import StockCard from "../components/PositionComponents/StockCard";
import OverviewCard from "../components/PositionComponents/OverviewCard/OverviewCard";
import InputForm from "../components/PositionComponents/InputForm";
import ExitForm from "../components/PositionComponents/ExitForm";

export default function Positions() {
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [showExitForm, setShowExitForm] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);

  const sampleChecklist = {
  "Graph pattern": {
    value: "positive",
    comment: "Double bottoms near support zone",
    weight: 4,
  },
  "Volume": {
    value: "positive",
    comment: "Volume surge at breakout",
    weight: 2,
  },
  "RSI": {
    value: "neutral",
    comment: "RSI was mid-level, not too overbought",
    weight: 1,
  },
  "EMA alignment": {
    value: "positive",
    comment: "Price was above 50 EMA",
    weight: 3,
  },
  "News sentiment": {
    value: "negative",
    comment: "Mixed news around earnings report",
    weight: 2,
  },
};


  const sampleEntries = [
    {
      date: "6/26/25",
      type: "Buy",
      shares: 2,
      price: 220,
      reason: "Breakout confirmation after flag pattern.",
      expectations: "Reach $230 within 3 days.",
      strategyFit: "Matches EMA breakout strategy.",
      mood: "Excited",
      exitPlan: "Sell at 228 or after 2 red candles.",
      confidence: 8,
    },
    {
      date: "6/25/25",
      type: "Buy",
      shares: 4,
      price: 198,
      reason: "Double bottom formed on support.",
      expectations: "Push up to $210",
      strategyFit: "Mean reversion fit.",
      mood: "Cautious",
      exitPlan: "Stop loss at 192",
      confidence: 6,
    },
    {
      date: "6/24/25",
      type: "Sell",
      shares: 3,
      price: 200,
      reason: "Overbought RSI + bearish engulfing candle.",
      expectations: "Downtrend continuation",
      strategyFit: "Quick scalp exit",
      mood: "Neutral",
      exitPlan: "Done.",
      confidence: 7,
    },
  ];

  const handleExitClick = (stock) => {
    const matchingBuys = sampleEntries.filter((entry) => entry.type === "Buy");
    const mostRecentBuy = matchingBuys.at(-1); // or use .[0] for FIFO
    const expectationText = mostRecentBuy?.expectations || "";
    const totalShares = matchingBuys.reduce((acc, entry) => acc + entry.shares, 0);
    const totalCost = matchingBuys.reduce((acc, entry) => acc + entry.shares * entry.price, 0);
    const averagePrice = totalShares > 0 ? totalCost / totalShares : 0;
    const entryDate = mostRecentBuy?.date || "";

    setSelectedStock({
      ...stock,
      expectations: expectationText,
      availableShares: totalShares,
      averagePriceFromFIFO: averagePrice,
      entryDate,
    });
    setShowExitForm(true);
  };

  return (
    <motion.div
      key="positions"
      className="flex gap-6 h-[calc(100vh-150px)] bg-[var(--color-background)] rounded-xl overflow-hidden shadow-lg p-6 justify-between"
    >
      {/* Left Side */}
      <div className="flex flex-col w-[calc((100%-40px)/2)]">
        {showExitForm ? (
          <ExitForm
            onSubmit={() => setShowExitForm(false)}
            onClose={() => setShowExitForm(false)}
            availableShares={selectedStock?.availableShares || 0}
            averagePriceFromFIFO={selectedStock?.averagePriceFromFIFO || 0}
            ticker={selectedStock?.ticker || "TSLA"}
            expectations={selectedStock?.expectations || ""}
            entryDate={selectedStock?.entryDate || ""}
              pastChecklist={sampleChecklist}

          />
        ) : (
          <>
            <div>
              <div className="text-lg font-medium">Add stock</div>
              <InputForm />
            </div>
            <div className="text-lg font-medium mt-6">Current Stocks</div>

            <div className="relative w-full mt-4 h-full overflow-hidden">
              {/* Fades */}
              <div className="pointer-events-none absolute top-0 left-0 w-full h-6 bg-gradient-to-b from-[var(--color-background)] to-transparent z-10" />
              <div className="pointer-events-none absolute bottom-0 left-0 w-full h-6 bg-gradient-to-t from-[var(--color-background)] to-transparent z-10" />

              {/* Scrollable content */}
              <div className="overflow-y-auto h-full pr-2">
                <div className="flex flex-wrap justify-between pt-4 pb-6 px-6 w-full">
                  {[
                    { direction: "long", ticker: "TSLA" },
                    { direction: "short", ticker: "NVDA" },
                    { direction: "long", ticker: "AAPL" },
                    { direction: "short", ticker: "AMZN" },
                  ].map((stock, i) => (
                    <StockCard
                      key={i}
                      direction={stock.direction}
                      onActionClick={() => handleExitClick(stock)}
                      entries={sampleEntries}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="w-[calc((100%-40px)/2)]">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-medium"> Overview</div>
          <button
            onClick={() => {
              setIsEditingLayout((prev) => !prev);
              console.log("your editing layout now is", isEditingLayout);
            }}
            className="text-sm font-semibold px-3 py-1 rounded-md bg-[var(--color-primary)] text-white shadow hover:opacity-80"
          >
            {isEditingLayout ? "Done" : "Edit Layout"}
          </button>
        </div>
        <OverviewCard isEditingLayout={isEditingLayout} />
      </div>
    </motion.div>
  );
}
