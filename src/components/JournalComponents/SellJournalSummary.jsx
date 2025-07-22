import React, { useEffect, useRef, useState } from "react";
import MiniHoverCard from "./MiniHoverCard";

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

export default function SellJournalSummary({ selected }) {
  const shares = parseFloat(selected.shares);
  const sellPrice = parseFloat(selected.exitPrice);
  const avgBuyPrice = parseFloat(selected.averageBuyPrice);
  const timestamp = selected.entryTimestamp || selected.exitTimestamp;

  const hoverRef = useRef();
  const hoverTimeoutRef = useRef(null);
  const [hoverAnchor, setHoverAnchor] = useState(null);
  const [showHoverCard, setShowHoverCard] = useState(false);

  const handleMouseEnter = () => {
    clearTimeout(hoverTimeoutRef.current);
    const rect = hoverRef.current?.getBoundingClientRect();
    setHoverAnchor(rect);
    setShowHoverCard(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowHoverCard(false);
    }, 150);
  };
  const realizedGain = (sellPrice-avgBuyPrice)*shares

  return (
    <div className="relative bg-[var(--color-background)] p-8 mt-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] w-[calc(66%)]">
      <span className="absolute top-10 right-8 px-3 py-1 text-sm rounded-full font-semibold bg-red-100 text-red-800">
        Sell
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
          <p className="font-medium">Share Bought:</p>
          <p>{shares}</p>
        </div>
        <div>
          <p className="font-medium">Average Buy Price:</p>
          <p>${avgBuyPrice.toFixed(2)}</p>
        </div>
        <div>
          
        </div>
        <div
          className="relative inline-block"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div ref={hoverRef} className="cursor-pointer pt-0.2">
            <p className="font-medium">Shares Sold:</p>
            <span className="underline">{shares}</span>
          </div>

          {showHoverCard && (
            <MiniHoverCard
              show={showHoverCard}
              entries={selected.entryEvents}
              anchorRect={hoverAnchor}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            />
          )}
        </div>
        <div>
          <p className="font-medium">Sold Price:</p>
          <p>${sellPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">
            Realized {realizedGain >= 0 ? "Gain" : "Loss"}:
          </p>
          <p className={realizedGain >= 0 ? "text-green-600" : "text-red-500"}>
            ${realizedGain.toFixed(2)} (
            {((realizedGain / (sellPrice * shares || 1)) * 100).toFixed(1)}%)
          </p>
        </div>
      </div>

      <div className="bg-gray-100 h-48 rounded-md flex items-center justify-center text-gray-400 text-sm">
        📉 [Stock Chart Placeholder]
      </div>
    </div>
  );
}
