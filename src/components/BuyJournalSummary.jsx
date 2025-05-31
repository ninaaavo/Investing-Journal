import React from "react";

export default function BuyJournalSummary({
  name,
  ticker,
  shares,
  sharesSold,
  buyPrice,
  avgSoldPrice,
  currentPrice,
  date,
}) {
  const change = (currentPrice - buyPrice) * shares;
  const percentChange = ((currentPrice - buyPrice) / buyPrice) * 100;
  const isGain = change >= 0;

  return (
    <div className="relative bg-[var(--color-background)] p-8 mt-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] w-[660px]">
      <span className=" absolute top-10 right-8 px-3 py-1 text-sm rounded-full font-semibold bg-green-100 text-green-800">
        Buy{" "}
      </span>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-primary">
          {name} ({ticker})
        </h2>
        <p className="text-sm text-[var(--color-text)]">{date}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 text-sm text-[var(--color-text)]">
        <div>
          <p className="font-medium">Total Bought:</p>
          <p>{shares}</p>
        </div>
        <div>
          <p className="font-medium">Price Bought At:</p>
          <p>${buyPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">Total gain:</p>
          <p>${buyPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">Share sold:</p>
          <p>{sharesSold}</p>
        </div>
        <div>
          <p className="font-medium">Average Sold Price:</p>
          <p>{avgSoldPrice}</p>
        </div>
        <div>
          <p className="font-medium">Realized gain:</p>
          <p>${buyPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">Current share:</p>
          <p>${currentPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">Current Price:</p>
          <p>${currentPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">Unrealized {isGain ? "Gain" : "Loss"}:</p>
          <p className={isGain ? "text-green-600" : "text-red-500"}>
            ${change.toFixed(2)} ({percentChange.toFixed(1)}%)
          </p>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="bg-gray-100 h-48 rounded-md flex items-center justify-center text-gray-400 text-sm">
        📈 [Stock Chart Placeholder]
      </div>
    </div>
  );
}
