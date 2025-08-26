import React, { useEffect, useRef, useState } from "react";
import MiniHoverCard from "./MiniHoverCard";
import { useNavigate } from "react-router-dom";
import { toETDateOnly } from "../../utils/toETDateOnly";
import StockPriceChart from "./StockPriceChart";

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

export default function ExitJournalSummary({ selected }) {
  const shares = parseFloat(selected.shares);
  const sellPrice = parseFloat(selected.exitPrice);
  const avgBuyPrice = parseFloat(selected.averageBuyPrice);
  const direction = selected.direction?.toLowerCase() || "long";

  // Prefer showing the entry timestamp if provided, else fall back to exit
  const timestamp = selected.entryTimestamp || selected.exitTimestamp;

  // --- Build ET YYYY-MM-DD strings for the chart window ---
  // Get entry date from the *last* entryEvent
  const lastEntryEvent =
    Array.isArray(selected.entryEvents) && selected.entryEvents.length > 0
      ? selected.entryEvents[selected.entryEvents.length - 1]
      : null;

  const entryDateISO = lastEntryEvent
    ? toETDateOnly(
        typeof lastEntryEvent.entryTimestamp.toMillis === "function"
          ? lastEntryEvent.entryTimestamp.toMillis()
          : lastEntryEvent.entryTimestamp
      )
    : null;

  const exitDateISO = selected.exitTimestamp
    ? toETDateOnly(
        typeof selected.exitTimestamp.toMillis === "function"
          ? selected.exitTimestamp.toMillis()
          : selected.exitTimestamp
      )
    : null;

  console.log("ur entry date", entryDateISO, "ur exit date", exitDateISO);
  const hoverRef = useRef();
  const hoverTimeoutRef = useRef(null);
  const [hoverAnchor, setHoverAnchor] = useState(null);
  const [showHoverCard, setShowHoverCard] = useState(false);
  const navigate = useNavigate();

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

  const realizedGain =
    (sellPrice - avgBuyPrice) * shares * (direction === "short" ? -1 : 1);

  return (
    <div className="relative bg-[var(--color-background)] p-8 mt-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] w-[calc(66%)]">
      <div className="absolute top-10 right-8 flex gap-2">
        <button
          onClick={() =>
            navigate(`/journal?direction=${direction}&id=${selected.id}`)
          }
          className={`px-3 py-1 text-sm rounded-full font-semibold hover:underline focus:outline-none ${
            direction === "long"
              ? "bg-blue-100 text-blue-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {direction.charAt(0).toUpperCase() + direction.slice(1)}
        </button>
        <button
          onClick={() => navigate(`/journal?type=exit&id=${selected.id}`)}
          className="px-3 py-1 text-sm rounded-full font-semibold bg-red-100 text-red-800 hover:underline focus:outline-none"
        >
          Exit
        </button>
      </div>

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
          <p className="font-medium">
            {direction === "short" ? "Shares Bought to Cover" : "Shares Bought"}
            :
          </p>
          <p>{shares}</p>
        </div>
        <div>
          <p className="font-medium">
            {direction === "short"
              ? "Average Cover Price"
              : "Average Buy Price"}
            :
          </p>
          <p>${avgBuyPrice.toFixed(2)}</p>
        </div>
        <div></div>

        <div
          className="relative inline-block"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div ref={hoverRef} className="cursor-pointer pt-0.2">
            <p className="font-medium">
              {direction === "short" ? "Shares Sold to Open" : "Shares Sold"}:
            </p>
            <span className="underline">{shares}</span>
          </div>

          {showHoverCard && selected.entryEvents && (
            <MiniHoverCard
              show={showHoverCard}
              entries={selected.entryEvents || []}
              anchorRect={hoverAnchor}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            />
          )}
        </div>

        <div>
          <p className="font-medium">
            {direction === "short" ? "Cover Price" : "Sold Price"}:
          </p>
          <p>${sellPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">
            Realized {realizedGain >= 0 ? "Gain" : "Loss"}:
          </p>
          <p className={realizedGain >= 0 ? "text-green-600" : "text-red-500"}>
            ${realizedGain.toFixed(2)} (
            {((realizedGain / (sellPrice * shares || 1)) * 100).toFixed(1)}
            %)
          </p>
        </div>
      </div>

      {/* ===== Exit Chart (Entry→Exit with BUY dots & "Buy ..." tooltip) ===== */}
      <div className="rounded-md overflow-hidden border">
        {entryDateISO && exitDateISO ? (
          <StockPriceChart
            variant="exit"
            ticker={selected.ticker}
            entryDateISO={entryDateISO} // first buy date
            exitDateISO={exitDateISO} // sell date
            entryEvents={selected.entryEvents || []} // dots + tooltip show "Buy ..."
            showEntryDot={true}
          />
        ) : (
          <div className="bg-gray-100 h-48 rounded-md flex items-center justify-center text-gray-400 text-sm">
            📉 [Stock Chart Placeholder]
          </div>
        )}
      </div>
    </div>
  );
}
