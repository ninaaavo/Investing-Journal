import React, { useEffect, useRef, useState, useMemo } from "react";
import MiniHoverCard from "./MiniHoverCard";
import { useNavigate } from "react-router-dom";
import StockPriceChart from "./StockPriceChart"; // <-- adjust path if needed

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

/** Firestore Timestamp or Date -> "YYYY-MM-DD" in Eastern Time */
function toETDateOnly(input) {
  const d = input?.toDate ? input.toDate() : new Date(input);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
}

export default function EntryJournalSummary({ selected }) {
  const shares = parseFloat(selected.shares);
  const sharesSold = parseFloat(selected.totalSharesSold) || 0;
  const entryPrice = parseFloat(selected.entryPrice);
  const avgSoldPrice = parseFloat(selected.averageSoldPrice || 0);
  const timestamp = selected.entryTimestamp || selected.exitTimestamp;
  const direction = selected.direction?.toLowerCase() || "long";

  const hoverTimeoutRef = useRef(null);
  const hoverRef = useRef();
  const [hoverAnchor, setHoverAnchor] = useState(null);
  const [showHoverCard, setShowHoverCard] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(
    selected.initialPrice ? parseFloat(selected.initialPrice) : null
  );
  const navigate = useNavigate();

  // --- live price (Finnhub) ---
  useEffect(() => {
    if (!selected.ticker) return;
    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${selected.ticker}&token=${API_KEY}`
        );
        const data = await res.json();
        if (data.c) setCurrentPrice(Number(data.c));
      } catch (err) {
        console.error("Failed to fetch real-time price", err);
      }
    };
    fetchPrice();
  }, [selected.ticker]);

  // --- hover card anchors ---
  const handleMouseEnter = () => {
    clearTimeout(hoverTimeoutRef.current);
    const rect = hoverRef.current?.getBoundingClientRect();
    setHoverAnchor(rect);
    setShowHoverCard(true);
  };
  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => setShowHoverCard(false), 150);
  };

  // --- basic P/L calcs (unchanged) ---
  const sharesHeld = shares - sharesSold;
  const unrealizedGain = currentPrice
    ? (currentPrice - entryPrice) * sharesHeld * (direction === "short" ? -1 : 1)
    : 0;
  const unrealizedPercent =
    sharesHeld === 0
      ? 0
      : currentPrice
      ? ((currentPrice - entryPrice) / entryPrice) * 100 * (direction === "short" ? -1 : 1)
      : 0;

  const realizedGain =
    (avgSoldPrice - entryPrice) * sharesSold * (direction === "short" ? -1 : 1);
  const isGain = unrealizedGain >= 0;

  // --- chart props: entry / exit dates + events ---
  const entryDateISO = useMemo(() => {
    if (!selected.entryTimestamp) return undefined;
    return toETDateOnly(selected.entryTimestamp);
  }, [selected.entryTimestamp]);

  const finalExitEvent = useMemo(() => {
    const arr = Array.isArray(selected.exitEvents) ? selected.exitEvents : [];
    if (!arr.length) return null;
    return arr[arr.length - 1];
  }, [selected.exitEvents]);

  // If the trade is fully closed, cap the chart at the last exit date; otherwise leave undefined
  const exitDateISO = useMemo(() => {
    const fullyClosed = sharesSold >= shares && shares > 0;
    if (!fullyClosed || !finalExitEvent?.exitTimestamp) return undefined;
    return toETDateOnly(finalExitEvent.exitTimestamp);
  }, [sharesSold, shares, finalExitEvent]);

  return (
    <div className="relative bg-[var(--color-background)] p-8 mt-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] w-[calc(66%)]">
      <div className="absolute top-10 right-8 flex gap-2">
        <button
          onClick={() => navigate(`/journal?direction=${direction}&id=${selected.id}`)}
          className={`px-3 py-1 text-sm rounded-full font-semibold hover:underline focus:outline-none ${
            direction === "long"
              ? "bg-blue-100 text-blue-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {direction.charAt(0).toUpperCase() + direction.slice(1)}
        </button>
        <button
          onClick={() => navigate(`/journal?type=entry&id=${selected.id}`)}
          className="px-3 py-1 text-sm rounded-full font-semibold bg-green-100 text-green-800 hover:underline focus:outline-none"
        >
          Entry
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
          <p className="font-medium">Total {direction === "short" ? "Sold to Open" : "Bought"}:</p>
          <p>{shares}</p>
        </div>
        <div>
          <p className="font-medium">Entry Price:</p>
          <p>${entryPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">
            Total {realizedGain + unrealizedGain >= 0 ? "Gain" : "Loss"}:
          </p>
          <p className={realizedGain + unrealizedGain >= 0 ? "text-green-600" : "text-red-500"}>
            ${(realizedGain + unrealizedGain).toFixed(2)} (
            {((realizedGain + unrealizedGain) / (entryPrice * shares) * 100).toFixed(1)}%)
          </p>
        </div>

        <div
          className="relative inline-block"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div ref={hoverRef} className="cursor-pointer pt-0.2">
            <p className="font-medium">Shares Closed:</p>
            <span className="underline ">{sharesSold}</span>
          </div>
          {showHoverCard && selected.exitEvents && (
            <MiniHoverCard
              show={showHoverCard}
              entries={selected.exitEvents || []}
              anchorRect={hoverAnchor}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            />
          )}
        </div>

        <div>
          <p className="font-medium">Average Close Price:</p>
          <p>${avgSoldPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium">
            Realized {realizedGain >= 0 ? "Gain" : "Loss"}:
          </p>
          <p className={realizedGain >= 0 ? "text-green-600" : "text-red-500"}>
            ${realizedGain.toFixed(2)} (
            {((realizedGain / (entryPrice * (sharesSold || 1))) * 100).toFixed(1)}%)
          </p>
        </div>
        <div>
          <p className="font-medium">Current Shares Held:</p>
          <p>{sharesHeld}</p>
        </div>
        <div>
          <p className="font-medium">Current Price:</p>
          <p>{currentPrice !== null ? `$${currentPrice.toFixed(2)}` : "Loading..."}</p>
        </div>
        <div>
          <p className="font-medium">Unrealized {isGain ? "Gain" : "Loss"}:</p>
          <p className={isGain ? "text-green-600" : "text-red-500"}>
            ${unrealizedGain.toFixed(2)} ({unrealizedPercent.toFixed(1)}%)
          </p>
        </div>
      </div>

      {/* === REAL CHART === */}
      <div className="rounded-md overflow-hidden">
        <StockPriceChart
          ticker={selected.ticker}
          entryDateISO={entryDateISO}
          exitDateISO={exitDateISO}          // omit if still open
          exitEvents={selected.exitEvents || []}
          showEntryDot
          height={260}
        />
      </div>
    </div>
  );
}
