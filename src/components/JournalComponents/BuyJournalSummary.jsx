import React, { useEffect, useRef, useState } from "react";
import MiniHoverCard from "./MiniHoverCard";

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

export default function BuyJournalSummary({ selected }) {
  const shares = parseFloat(selected.shares);
  const sharesSold = parseFloat(selected.totalSharesSold) || 0;
  const buyPrice = parseFloat(selected.entryPrice);
  const avgSoldPrice = parseFloat(selected.averageSoldPrice);
  const timestamp = selected.entryTimestamp || selected.exitTimestamp;

  const hoverTimeoutRef = useRef(null);

  const handleMouseEnter = () => {
    clearTimeout(hoverTimeoutRef.current);
    const rect = hoverRef.current?.getBoundingClientRect();
    setHoverAnchor(rect);
    setShowHoverCard(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowHoverCard(false);
    }, 150); // small delay for smoother UX
  };

  // Get all exitEvents from relatedEntries
  const [currentPrice, setCurrentPrice] = useState(
    selected.initialPrice ? parseFloat(selected.initialPrice) : null
  );

  const hoverRef = useRef();
  const [hoverAnchor, setHoverAnchor] = useState(null);
  const [showHoverCard, setShowHoverCard] = useState(false);

  useEffect(() => {
    if (!selected.ticker) return;

    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${selected.ticker}&token=${API_KEY}`
        );
        const data = await res.json();
        if (data.c) setCurrentPrice(data.c);
      } catch (err) {
        console.error("Failed to fetch real-time price", err);
      }
    };

    fetchPrice();
  }, [selected.ticker]);

  const sharesHeld = shares - sharesSold;
  const unrealizedGain = currentPrice
    ? (currentPrice - buyPrice) * sharesHeld
    : 0;
  const unrealizedPercent = sharesHeld == 0 ? 0 : currentPrice
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
          {selected.ticker}{" "}
          <span className="font-normal pb-1">({selected.companyName})</span>
        </h2>
        <p className="text-sm text-[var(--color-text)]">
          {(() => {
            const dateObj = timestamp.toDate();
            const month = String(dateObj.getMonth() + 1).padStart(2, "0");
            const day = String(dateObj.getDate()).padStart(2, "0");
            const year = String(dateObj.getFullYear()).slice(-2);

            if (!selected.timeProvided) {
              return `${month}/${day}/${year}`;
            } else {
              let hours = dateObj.getHours();
              const minutes = String(dateObj.getMinutes()).padStart(2, "0");
              const ampm = hours >= 12 ? "PM" : "AM";
              hours = hours % 12 || 12;
              const formattedHours = String(hours).padStart(2, "0");

              return `${formattedHours}:${minutes} ${ampm}, ${month}/${day}/${year}`;
            }
          })()}
        </p>
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
          <p className="font-medium">
            Total {realizedGain + unrealizedGain >= 0 ? "Gain" : "Loss"}:
          </p>
          <p
            className={
              realizedGain + unrealizedGain >= 0
                ? "text-green-600"
                : "text-red-500"
            }
          >
            ${(realizedGain + unrealizedGain).toFixed(2)} (
            {(
              ((realizedGain + unrealizedGain) / (buyPrice * shares)) *
              100
            ).toFixed(1)}
            %)
          </p>
        </div>
        <div
          className="relative inline-block"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div ref={hoverRef} className="cursor-pointer pt-0.2">
            <p className="font-medium">Shares Sold:</p>

            <span className="underline ">{sharesSold}</span>
          </div>

          {showHoverCard && selected.exitEvents && (
            <MiniHoverCard
              show={showHoverCard}
              entries={selected.exitEvents || []}
              anchorRect={hoverAnchor}
              onMouseEnter={handleMouseEnter} // 👈 we'll add these in next step
              onMouseLeave={handleMouseLeave}
            />
          )}
        </div>

        <div>
          <p className="font-medium">Average Sold Price:</p>
          <p>${avgSoldPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">
            Realized {realizedGain >= 0 ? "Gain" : "Loss"}:
          </p>
          <p className={realizedGain >= 0 ? "text-green-600" : "text-red-500"}>
            ${realizedGain.toFixed(2)} (
            {((realizedGain / (buyPrice * sharesSold || 1)) * 100).toFixed(1)}%)
          </p>
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
