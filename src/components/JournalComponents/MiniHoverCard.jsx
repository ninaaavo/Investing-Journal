import React from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function MiniHoverCard({
  show,
  entries,
  anchorRect,
  onMouseEnter,
  onMouseLeave,
}) {
  console.log("your anchor rect", anchorRect)
  const navigate = useNavigate();
  if (!show || !anchorRect) return null;
  console.log()
  const placementStyle = {
    position: "absolute",
    top: anchorRect.top+35,
    left: anchorRect.left + anchorRect.width / 2 - 85,
    transform: "translateX(-50%)",
  };

  const formatDate = (timestamp) => {
    const date = timestamp?.toDate?.();
    if (!date) return "—";
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const yy = String(date.getFullYear()).toString().slice(-2);
    return `${mm}/${dd}/${yy}`;
  };

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
        style={{
          zIndex: 9999,
          ...placementStyle,
        }}
        className="p-3 rounded-lg shadow-lg bg-white border border-gray-300 text-sm text-gray-700 space-y-1"
      >
        {entries.map((entry, index) => {
          const isExit = !!entry.exitJournalId || !!entry.exitTimestamp;
          const journalId = entry.exitJournalId || entry.entryId || entry.id;
          const shares = entry.sharesSold || entry.sharesUsed || entry.shares;
          const price = entry.soldPrice || entry.entryPrice;
          const timestamp = entry.exitTimestamp || entry.entryTimestamp;
          const label = isExit ? "Sell" : "Buy";

          return (
            <div
              key={journalId + "-" + index}
              onClick={(e) => {
                e.stopPropagation();
                if (journalId) {
                  navigate(`/journal?entryId=${journalId}`);
                }
              }}
              className="hover:text-blue-600 cursor-pointer"
            >
              {formatDate(timestamp)}: {label} {shares} shares @ ${price}
            </div>
          );
        })}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
