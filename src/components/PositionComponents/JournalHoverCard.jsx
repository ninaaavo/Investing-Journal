import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from "react-dom";
import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function JournalHoverCard({ show, entries, anchorRect }) {
  const navigate = useNavigate();

  const [expandedIndex, setExpandedIndex] = useState(-1); // default to first entry expanded
  if (!show || !anchorRect) return null;
  if (!entries) return <div>Gimme ur entries</div>;
  const placementStyle = {
    position: "absolute",
    bottom: window.innerHeight - anchorRect.top - 60, // 8px for spacing (optional)
    left: anchorRect.left + anchorRect.width / 2,
    transform: "translateX(-50%)",
  };
  const formatDateOnly = (timestamp) => {
    const date = timestamp instanceof Date ? timestamp : timestamp?.toDate?.();
    if (!date) return "";

    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);

    return `${mm}/${dd}/${yy}`;
  };

  console.log("This is hover card my entries are", entries);

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
        className="w-[300px] p-4 bg-[var(--color-nav-background)] rounded-lg shadow-xl border border-gray-200 text-sm text-[var(--color-text)]"
      >
        <div className="flex justify-between items-center mb-2">
          <div className="font-semibold text-base">Journal Summary</div>
          <button
            onClick={(e) => {
              e.stopPropagation(); // prevent hover card closing or card click
              navigate(
                `/journal?ticker=${encodeURIComponent(
                  entries[0]?.ticker || ""
                )}`
              );
            }}
            className="text-sm text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            View Journal
          </button>
        </div>

        <div className="space-y-2">
          {entries.map((entry, index) => {
            const isExpanded = index === expandedIndex;
            var isEntry = entry.isEntry;
            return (
              <div key={entry.entryDate}>
                <div
                  onClick={() => setExpandedIndex(index)}
                  className={`cursor-pointer font-medium text-sm flex justify-between ${
                    entry.journalType === "buy"
                      ? "text-green-600"
                      : "text-red-500"
                  }`}
                >
                  {isExpanded ? "▾" : "▸"}{" "}
                  <span className=" hover:underline pr-2">
                    {formatDateOnly(
                      isEntry ? entry.entryTimestamp : entry.exitTimestamp
                    )}
                    :{" "}
                    {entry.journalType.charAt(0).toUpperCase() +
                      entry.journalType.slice(1)}{" "}
                    {entry.shares} shares at $
                    {isEntry ? entry.entryPrice : entry.exitPrice}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // prevent hover card closing or card click
                      navigate(
                        `/journal?id=${encodeURIComponent(
                          entry?.id || ""
                        )}`
                      );
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  >
                    View
                  </button>
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
                      {entry.exitPlan && (
                        <div>
                          <span className="font-medium">Exit Plan:</span>{" "}
                          {entry.exitPlan.reason}
                        </div>
                      )}
                      {entry.pAndL && (
                        <div>
                          <span className="font-medium">P/L:</span>{" "}
                          <span
                            className={
                              entry.pAndL.profit < 0
                                ? "text-red-500"
                                : "text-green-500"
                            }
                          >
                            {entry.pAndL.profit} ({entry.pAndL.percent}%)
                          </span>
                        </div>
                      )}

                      {entry.expectations && (
                        <div>
                          <span className="font-medium">Expectations:</span>{" "}
                          {
                            entry.expectations[entry.expectations.length - 1]
                              .content
                          }
                        </div>
                      )}
                      {entry.strategyFit && (
                        <div>
                          <span className="font-medium">Strategy Fit:</span>{" "}
                          {entry.strategyFit}
                        </div>
                      )}
                      {entry.moodLog && (
                        <div>
                          <span className="font-medium">Mood:</span>{" "}
                          {entry.moodLog[entry.moodLog.length - 1].label}
                        </div>
                      )}
                      {entry.reflection && (
                        <div>
                          <span className="font-medium">Reflection:</span>{" "}
                          {entry.reflection}
                        </div>
                      )}
                      {entry.confidence && (
                        <div>
                          <span className="font-medium">Confidence:</span>{" "}
                          {entry.confidence}/10
                        </div>
                      )}
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
