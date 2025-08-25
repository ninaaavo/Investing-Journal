import { motion } from "framer-motion";
import { useRef, useState, useEffect, useMemo } from "react";
import JournalHoverCard from "./JournalHoverCard";
import { useUser } from "../../context/UserContext"; // <-- adjust path if needed

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
  const { todaySnapshot, lastUpdated } = useUser(); // <-- live snapshot + timestamp
  const isLong = direction === "long";
  const actionLabel = isLong ? "Sell This" : "Buy This";
  // console.log("today snap is", todaySnapshot)
  const cardRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  // Helper: try multiple shapes your snapshot might use
  const getLivePriceFromSnapshot = (snap, tkr) => {
    if (!snap || !tkr) return null;

    const pos = direction == "long"? snap.longPositions?.[tkr] : snap.shortPositions?.[tkr];

    const direct =
      pos?.priceAtSnapshot ??
      null;

    if (direct != null) return Number(direct);

    if (pos?.marketValue != null && pos?.shares) {
      const mv = Number(pos.marketValue);
      const sh = Number(pos.shares);
      if (sh > 0) return mv / sh;
    }

    return null;
  };

  const currentPrice = useMemo(
    () => getLivePriceFromSnapshot(todaySnapshot, ticker),
    [todaySnapshot, ticker, lastUpdated]
  );

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
            <div className="text-base mb-2">
              {companyName
                ? companyName.length > 17
                  ? companyName.slice(0, 17) + "..."
                  : companyName
                : "—"}
            </div>
            <div>Shares: {shares}</div>
            <div>Average Price: ${Number(averagePrice).toFixed(2)}</div>
            <div>
              Current Price:{" "}
              {currentPrice != null ? `$${currentPrice.toFixed(2)}` : "Loading..."}
            </div>

            {currentPrice != null && Number(averagePrice) > 0 && (
              <div className="mt-1">
                {(() => {
                  const diff = isLong
                    ? currentPrice - Number(averagePrice)
                    : Number(averagePrice) - currentPrice;
                  const pl = diff * Number(shares || 0);
                  const percent = (diff / Number(averagePrice)) * 100;
                  const plClass =
                    pl > 0
                      ? "text-green-600"
                      : pl < 0
                      ? "text-red-600"
                      : "text-gray-600";

                  return (
                    <div className={plClass}>
                      P/L: {pl >= 0 ? "+" : ""}${pl.toFixed(2)} (
                      {percent >= 0 ? "+" : ""}
                      {percent.toFixed(2)}%)
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="flex flex-col h-full items-end justify-between h-[120px]">
            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${
                isLong ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
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
