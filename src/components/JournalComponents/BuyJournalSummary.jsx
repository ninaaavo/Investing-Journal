import React, { useEffect, useState } from "react";

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

export default function BuyJournalSummary({
  name,
  ticker,
  shares,
  sharesSold=0,
  buyPrice,
  avgSoldPrice = 0,
  currentPrice: initialPrice = null,
  date,
}) {
  // Parse props
  shares = parseFloat(shares);
  sharesSold = parseFloat(sharesSold);
  buyPrice = parseFloat(buyPrice);
  avgSoldPrice = parseFloat(avgSoldPrice);

  // Local state to fetch current price
  const [currentPrice, setCurrentPrice] = useState(
    initialPrice ? parseFloat(initialPrice) : null
  );

  useEffect(() => {
    if (!ticker) return;

    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`
        );
        const data = await res.json();
        if (data.c) setCurrentPrice(data.c);
      } catch (err) {
        console.error("Failed to fetch real-time price", err);
      }
    };

    fetchPrice();
  }, [ticker]);

  const sharesHeld = shares - sharesSold;
  const unrealizedGain = currentPrice ? (currentPrice - buyPrice) * sharesHeld : 0;
  const unrealizedPercent = currentPrice
    ? ((currentPrice - buyPrice) / buyPrice) * 100
    : 0;

  const realizedGain = (avgSoldPrice - buyPrice) * sharesSold;
  const isGain = unrealizedGain >= 0;

  return (
    <div className="relative bg-[var(--color-background)] p-8 mt-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] w-[calc(66%)]">
      <span className="absolute top-10 right-8 px-3 py-1 text-sm rounded-full font-semibold bg-green-100 text-green-800">
        Buy
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
          <p className="font-medium">Total Gain:</p>
          <p>${(realizedGain + unrealizedGain).toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">Shares Sold:</p>
          <p>{sharesSold}</p>
        </div>
        <div>
          <p className="font-medium">Average Sold Price:</p>
          <p>${avgSoldPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">Realized Gain:</p>
          <p>${realizedGain.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">Current Shares Held:</p>
          <p>{sharesHeld}</p>
        </div>
        <div>
          <p className="font-medium">Current Price:</p>
          <p>
            {currentPrice !== null
              ? `$${currentPrice.toFixed(2)}`
              : "Loading..."}
          </p>
        </div>
        <div>
          <p className="font-medium">Unrealized {isGain ? "Gain" : "Loss"}:</p>
          <p className={isGain ? "text-green-600" : "text-red-500"}>
            ${unrealizedGain.toFixed(2)} ({unrealizedPercent.toFixed(1)}%)
          </p>
        </div>
      </div>

      <div className="bg-gray-100 h-48 rounded-md flex items-center justify-center text-gray-400 text-sm">
        📈 [Stock Chart Placeholder]
      </div>
    </div>
  );
}
