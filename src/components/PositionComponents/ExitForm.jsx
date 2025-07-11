import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { db, auth } from "../../firebase";
import {
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  collection,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import DateTimeInput from "./DateTimeInput";

const EXIT_REASONS = [
  { label: "🎯 Hit target", value: "Hit target" },
  { label: "🛑 Hit stop loss", value: "Hit stop loss" },
  { label: "📉 Trend reversal", value: "Trend reversal" },
  { label: "🔁 Rebalancing", value: "Rebalancing" },
  { label: "😕 Lost confidence", value: "Lost confidence" },
  { label: "💸 Need cash", value: "Need cash" },
  { label: "😬 Emotional exit", value: "Emotional exit" },
  { label: "✨ Other", value: "Other" },
];

export default function ExitForm({ onSubmit, onClose, stock }) {
  const [error, setError] = useState("");
  const [showReviewPrompt, setShowReviewPrompt] = useState(true);
  const [showAllExpectations, setShowAllExpectations] = useState(false);
  const [expandedReasons, setExpandedReasons] = useState({});
  const [form, setForm] = useState({
    entryChecklistMap: {},
    checklistReview: {},
    exitPrice: "",
    shares: "",
    exitReason: "",
    exitNotes: "",
    reflection: "",
    chartLink: "",
    tags: "",
    followedPlan: "",
    exitDate: new Date().toLocaleDateString("en-CA"),
    expectations: [],
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleReasonExpand = (key) => {
    setExpandedReasons((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const pAndL = useMemo(() => {
    if (!form.exitPrice || !form.shares || !stock.averagePriceFromFIFO)
      return null;
    const isShort = stock.direction === "short";
    const entry = stock.averagePriceFromFIFO;
    const profit = isShort
      ? (entry - form.exitPrice) * form.shares
      : (form.exitPrice - entry) * form.shares;
    const percent = isShort
      ? ((entry - form.exitPrice) / entry) * 100
      : ((form.exitPrice - entry) / entry) * 100;
    return {
      profit: profit.toFixed(2),
      percent: percent.toFixed(2),
    };
  }, [
    form.exitPrice,
    form.shares,
    stock.averagePriceFromFIFO,
    stock.direction,
  ]);

  const tradeDuration = useMemo(() => {
    if (!stock.entryDate || !form.exitDate) return null;
    const entry = new Date(stock.entryDate);
    const exit = new Date(form.exitDate);
    const diff = Math.round((exit - entry) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : null;
  }, [stock.entryDate, form.exitDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.exitPrice || !form.shares || !form.exitReason) return;

    const user = auth.currentUser;
    if (!user) {
      alert("User not logged in.");
      return;
    }

    const entryData = {
      ...form,
      ticker: stock.ticker,
      exitPrice: parseFloat(form.exitPrice),
      shares: parseInt(form.shares),
      pAndL,
      tradeDuration,
      createdAt: serverTimestamp(),
      journalType: stock.direction === "long" ? "sell" : "buy",
      direction: stock.direction,
    };

    try {
      await addDoc(
        collection(db, "users", user.uid, "journalEntries"),
        entryData
      );

      const currentPosRef = doc(
        db,
        "users",
        user.uid,
        "currentPositions",
        stock.id
      );
      const currentDoc = await getDoc(currentPosRef);

      if (currentDoc.exists()) {
        const currentData = currentDoc.data();
        const remainingShares = currentData.shares - parseInt(form.shares);
        if (remainingShares > 0) {
          await updateDoc(currentPosRef, { shares: remainingShares });
        } else {
          await deleteDoc(currentPosRef);
        }
      }

      if (onSubmit) onSubmit(entryData);
    } catch (err) {
      console.error("Error saving exit:", err);
      alert("Failed to save exit to the database.");
    }
  };

  useEffect(() => {
    const fetchChecklist = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const journalRef = collection(db, "users", user.uid, "journalEntries");
      const q = query(
        journalRef,
        where("ticker", "==", stock.ticker),
        where("journalType", "==", stock.direction === "long" ? "buy" : "sell"),
        orderBy("createdAt", "asc")
      );
      const snapshot = await getDocs(q);
      const entries = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((entry) => entry.checklist);

      let totalNeeded = parseInt(form.shares || stock.availableShares);
      const activeEntries = [];
      for (const entry of entries) {
        if (totalNeeded <= 0) break;
        const sharesUsed = Math.min(entry.shares || 0, totalNeeded);
        if (sharesUsed > 0) {
          activeEntries.push({ ...entry, usedShares: sharesUsed });
          totalNeeded -= sharesUsed;
        }
      }

      const merged = {};
      const expectationArr = [];
      for (const entry of activeEntries) {
        for (const [key, value] of Object.entries(entry.checklist)) {
          if (!merged[key]) merged[key] = [];
          merged[key].push({
            date: entry.entryDate || "Unknown",
            shares: entry.usedShares,
            price: entry.entryPrice,
            value: value.value,
            comment: value.comment,
          });
        }
        if (entry.expectations) {
          expectationArr.push({
            id: entry.id,
            date: entry.entryDate || "Unknown",
            shares: entry.usedShares,
            price: entry.entryPrice,
            expectation: entry.expectations,
          });
        }
      }

      setField("entryChecklistMap", merged);
      setField("expectations", expectationArr);
    };

    if (stock && stock.ticker && stock.direction) {
      fetchChecklist();
    }
  }, [stock, form.shares]);

  const handleReviewClick = (choice) => {
    setShowReviewPrompt(false);
    if (choice === "yes") {
      window.location.href = `/journal?ticker=${stock.ticker}&type=Sell`;
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.1,
        duration: 0.5,
        ease: "easeOut",
        layout: { duration: 0.4, ease: [0.25, 0.8, 0.25, 1] },
      }}
      layout
      onSubmit={handleSubmit}
      className="relative p-6 mt-4 mb-8 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl w-full space-y-4 h-[70vh] overflow-y-auto"
    >
      {showReviewPrompt && (
        <div className="bg-yellow-50 border border-yellow-300 p-4 rounded-md text-sm text-gray-800">
          <p className="mb-2 font-medium">
            Would you like to review your past sell trades for {stock.ticker}{" "}
            before completing this exit?
          </p>
          <div className="flex gap-4">
            <button
              type="button"
              className="px-3 py-1 rounded bg-[var(--color-primary)] text-white hover:opacity-90"
              onClick={() => handleReviewClick("yes")}
            >
              Yes, show me
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
              onClick={() => handleReviewClick("no")}
            >
              No, continue
            </button>
          </div>
        </div>
      )}

      {!showReviewPrompt && (
        <>
          <motion.button
            type="button"
            onClick={onClose}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ rotate: 90, scale: 1.2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute top-2 right-4 z-50 text-gray-500 hover:text-gray-800 text-2xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </motion.button>

          <h2 className="text-xl font-semibold">Exit Trade — {stock.ticker}</h2>
          <div className="text-sm text-gray-500">
            Avg Cost (FIFO):{" "}
            <span className="font-medium">
              ${stock.averagePriceFromFIFO?.toFixed(2)}
            </span>
            {" · "}
            Shares Available:{" "}
            <span className="font-medium">{stock.availableShares}</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="block mb-1 font-medium">
                {stock.direction === "short"
                  ? "Buy to Cover Price"
                  : "Sell Price"}
              </span>
              <input
                type="number"
                value={form.exitPrice}
                name="exitPrice"
                onChange={handleChange}
                className="w-full p-2 border rounded"
                placeholder="e.g., 115.50"
                required
              />
            </label>

            <label className="block">
              <span className="block mb-1 font-medium">
                {stock.direction === "short" ? "Shares Covered" : "Shares Sold"}
              </span>
              <input
                type="number"
                value={form.shares}
                name="shares"
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value < 1) {
                    setError("Shares must be at least 1");
                    setField("shares", 1);
                  } else if (value > parseFloat(stock.availableShares)) {
                    setError(
                      `You only have ${stock.availableShares} shares available`
                    );
                    setField("shares", stock.availableShares);
                  } else {
                    setError("");
                    setField("shares", value);
                  }
                }}
                className="w-full p-2 border rounded"
                placeholder="e.g., 5"
                min={1}
                max={stock.availableShares}
                required
              />
              {error && (
                <p className="text-xs text-red-500 mt-1 pl-1">⚠️ {error}</p>
              )}
            </label>

            <DateTimeInput form={form} setForm={setForm} type="exit" />
          </div>

          {pAndL && (
            <div
              className={`text-sm font-medium ${
                (stock.direction === "short" &&
                  parseFloat(pAndL.profit) >= 0) ||
                (stock.direction !== "short" && parseFloat(pAndL.profit) >= 0)
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {stock.direction === "short" ? "P&L (Cover):" : "P&L:"} $
              {pAndL.profit} ({pAndL.percent}%)
            </div>
          )}

          {tradeDuration !== null && (
            <div className="text-sm text-gray-600">
              Holding Period:{" "}
              <span className="font-medium">{tradeDuration} days</span>
            </div>
          )}

          <label className="block pb-10 border-b border-gray-300">
            <span className="block mb-1 font-medium text-lg">
              Reason for Exit
            </span>
            <select
              value={form.exitReason}
              name="exitReason"
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            >
              <option value="">Select a reason</option>
              {EXIT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </label>

          {form.exitReason === "Other" && (
            <label className="block">
              <span className="block mb-1 font-medium">Custom Reason</span>
              <input
                type="text"
                value={form.exitNotes}
                name="exitNotes"
                onChange={handleChange}
                className="w-full p-2 border rounded"
                placeholder="Describe your reason"
              />
            </label>
          )}

          {Array.isArray(form.expectations) && form.expectations.length > 0 && (
            <label className="block pt-4 pb-10 border-b border-gray-300">
              <span className="block mb-1 font-medium text-lg">
                Original Expectations
              </span>

              <div className="space-y-2 mb-4 pl-4">
                {(showAllExpectations
                  ? form.expectations
                  : [form.expectations[0]]
                ).map((exp, idx) => (
                  <div
                    key={exp.id || idx}
                    className="text-gray-700 italic border-l-4 border-gray-400 pl-3 py-1"
                  >
                    <p className="mb-1">“{exp.expectation}”</p>
                    <p className="text-xs text-gray-500">
                      {exp.date ? `Date: ${exp.date}` : ""}{" "}
                      {exp.shares ? `| Shares: ${exp.shares}` : ""}{" "}
                      {exp.price ? `| Price: $${exp.price}` : ""}
                    </p>
                  </div>
                ))}

                {form.expectations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowAllExpectations((prev) => !prev)}
                    className="text-sm text-blue-600 underline mt-1"
                  >
                    {showAllExpectations ? "Show Less" : "See More"}
                  </button>
                )}
              </div>

              <span className="block mb-1 font-medium">
                Did this trade go according to plan?
              </span>
              <select
                value={form.followedPlan}
                name="followedPlan"
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="partial">Partially</option>
                <option value="no">No</option>
              </select>
            </label>
          )}

          {Object.keys(form.entryChecklistMap).length > 0 && (
            <div className="pt-4 pb-10 border-b border-gray-300">
              <h3 className="font-semibold text-lg">Trade Reason Review</h3>
              <p className="text-sm text-gray-600 mb-2">
                Now that you’ve exited the trade, were these original reasons
                valid?
              </p>
              <div className="space-y-4">
                {Object.entries(form.entryChecklistMap).map(
                  ([key, entries]) => {
                    const isExpanded = expandedReasons[key];
                    const visibleEntries = isExpanded
                      ? entries
                      : entries.slice(0, 1);
                    const hasMore = entries.length > 1;

                    return (
                      <div key={key}>
                        <div className="font-medium mb-1">{key}</div>

                        {visibleEntries.map((item, i) => (
                          <div
                            key={i}
                            className="text-gray-700 border-l-2 pl-3 mb-1 border-gray-300 ml-4"
                          >
                            <div className="text-sm text-gray-500">
                              {item.date} – {item.shares} shares @ ${item.price}{" "}
                              ➝ {item.value}
                            </div>
                            <div className="italic">{item.comment}</div>
                          </div>
                        ))}

                        {hasMore && (
                          <button
                            type="button"
                            onClick={() => toggleReasonExpand(key)}
                            className="text-sm text-blue-600 underline mt-1 ml-4"
                          >
                            {isExpanded ? "Show Less" : "See More"}
                          </button>
                        )}

                        <select
                          value={form.checklistReview[key] || ""}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              checklistReview: {
                                ...prev.checklistReview,
                                [key]: e.target.value,
                              },
                            }))
                          }
                          className="w-full p-1.5 mt-2 border border-gray-300 rounded"
                        >
                          <option value="">Review your judgment</option>
                          <option value="positive">Helped the Trade</option>
                          <option value="neutral">Didn’t Matter</option>
                          <option value="negative">
                            Shouldn’t have relied
                          </option>
                        </select>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          <label className="block">
            <span className="block mb-1 font-medium text-lg pt-4">
              Reflection
            </span>
            <textarea
              rows={3}
              value={form.reflection}
              name="reflection"
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="What did you learn from this trade?"
            />
          </label>

          <label className="block">
            <span className="block mb-1 font-medium">
              Chart Link (optional)
            </span>
            <input
              type="url"
              value={form.chartLink}
              name="chartLink"
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="e.g. TradingView link"
            />
          </label>

          <label className="block">
            <span className="block mb-1 font-medium">
              Tags (comma-separated)
            </span>
            <input
              type="text"
              value={form.tags}
              name="tags"
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="e.g. breakout, emotional, earnings"
            />
          </label>

          <motion.button
            type="submit"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-full rounded-md px-4 py-2 font-bold text-white bg-[var(--color-primary)] hover:opacity-80"
          >
            Submit Exit
          </motion.button>
        </>
      )}
    </motion.form>
  );
}
