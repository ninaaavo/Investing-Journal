import { motion } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import JournalHoverCard from "./JournalHoverCard";

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

export default function StockCard({
  ticker,
  companyName = "",
  direction = "long",
  shares,
  averagePrice,
  onActionClick,
  entries = [],
  onClick,
}) {
  const isLong = direction === "long";
  const actionLabel = isLong ? "Sell This" : "Buy This";

  const cardRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);

  // Fetch real-time price
  useEffect(() => {
    if (!ticker) return;

    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`
        );
        const data = await res.json();
        if (data.c) setCurrentPrice(data.c); // 'c' is current price
      } catch (err) {
        console.error(`Error fetching price for ${ticker}:`, err);
      }
    };

    fetchPrice(); // Fetch on mount
    const interval = setInterval(fetchPrice, 15000); // Refresh every 15s

    return () => clearInterval(interval);
  }, [ticker]);

  useEffect(() => {
    if (isHovering && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setAnchorRect(rect);
    }
  }, [isHovering]);

  return (
    <div
      ref={cardRef}
      className="w-[calc(50%-12px)] relative"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={onClick}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.1,
          duration: 0.5,
          ease: "easeOut",
          layout: { duration: 0.4, ease: [0.25, 0.8, 0.25, 1] },
        }}
        layout
        className={`flex flex-col justify-between p-8 mb-6 bg-white ${
          isHovering ? "border-2 border-green-800 " : ""
        } shadow-[0_8px_30px_rgba(0,0,0,0.1)] w-full rounded-xl text-sm space-y-4 h-fit`}
      >
        <div className="flex justify-between items-start h-fit">
          <div>
            <div className="text-2xl font-medium">{ticker}</div>
            <div className="text-base mb-2">{companyName || "—"}</div>
            <div>Shares: {shares}</div>
            <div>Average Price: ${averagePrice.toFixed(2)}</div>
            <div>
              Current Price:{" "}
              {currentPrice !== null ? `$${currentPrice.toFixed(2)}` : "Loading..."}
            </div>
          </div>
          <div className="flex flex-col h-full items-end justify-between h-[120px]">
            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${
                isLong
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {direction.charAt(0).toUpperCase() + direction.slice(1)}
            </div>
            <motion.button
              type="button"
              onClick={onActionClick}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="self-start mt-2 px-4 py-2 mt-16 text-sm rounded-md font-semibold bg-[var(--color-primary)] text-white"
            >
              {actionLabel}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {isHovering && (
        <div className="absolute -top-[220px] left-1/2 -translate-x-1/2 z-[999]">
          <JournalHoverCard
            show={true}
            entries={entries.toReversed().slice(0, 4)}
            anchorRect={anchorRect}
          />
        </div>
      )}
    </div>
  );
}
