import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from "react-dom";
import React from "react";
import { useState } from "react";

export default function JournalHoverCard({ show, entries, anchorRect }) {
  const [expandedIndex, setExpandedIndex] = useState(-1); // default to first entry expanded

  if (!show || !anchorRect) return null;
  if (!entries) return <div>Gimme ur entries</div>;
  const placementStyle = {
  position: "absolute",
  bottom: window.innerHeight - anchorRect.top - 100, // 8px for spacing (optional)
  left: anchorRect.left + anchorRect.width / 2,
  transform: "translateX(-50%)",
};


  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{
          position: "absolute",
          zIndex: 9999,
          ...placementStyle,
        }}
        className="w-[280px] p-4 bg-[var(--color-nav-background)] rounded-lg shadow-xl border border-gray-200 text-sm text-[var(--color-text)]"
      >
        <div className="font-semibold text-base mb-2">Journal Summary</div>

        <div className="space-y-2">
          {entries.map((entry, index) => {
            const isExpanded = index === expandedIndex;
            return (
              <div key={entry.date}>
                <div
                  onClick={() => setExpandedIndex(index)}
                  className={`cursor-pointer font-medium text-sm ${
                    entry.type === "Buy" ? "" : "text-red-500"
                  }`}
                >
                  {isExpanded ? "▾" : "▸"}{" "}
                  <span className=" hover:underline">
                    {entry.date}: {entry.type} {entry.shares} shares at $
                    {entry.price}
                  </span>
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="pl-4 mt-1 space-y-1 overflow-hidden text-gray-600"
                    >
                      {entry.reason && (
                        <div>
                          <span className="font-medium">Reason:</span>{" "}
                          {entry.reason}
                        </div>
                      )}
                      {entry.expectations && (
                        <div>
                          <span className="font-medium">Expectations:</span>{" "}
                          {entry.expectations}
                        </div>
                      )}
                      {entry.strategyFit && (
                        <div>
                          <span className="font-medium">Strategy Fit:</span>{" "}
                          {entry.strategyFit}
                        </div>
                      )}
                      {entry.mood && (
                        <div>
                          <span className="font-medium">Mood:</span>{" "}
                          {entry.mood}
                        </div>
                      )}
                      {entry.exitPlan && (
                        <div>
                          <span className="font-medium">Exit Plan:</span>{" "}
                          {entry.exitPlan}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Confidence:</span>{" "}
                        {entry.confidence}/10
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
