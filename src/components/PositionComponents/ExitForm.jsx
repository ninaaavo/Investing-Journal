import { useState, useMemo } from "react";
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
  increment,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

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

export default function ExitForm({
  onSubmit,
  onClose,
  stock,
  pastChecklist = {},
}) {
  console.log("i got stock", stock)
  const [sellPrice, setSellPrice] = useState("");
  const [sharesSold, setSharesSold] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [exitNotes, setExitNotes] = useState("");
  const [reflection, setReflection] = useState("");
  const [chartLink, setChartLink] = useState("");
  const [tags, setTags] = useState("");
  const [followedPlan, setFollowedPlan] = useState("");
  const [exitDate, setExitDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [showReviewPrompt, setShowReviewPrompt] = useState(true);
  const [checklistReview, setChecklistReview] = useState({});

  const pAndL = useMemo(() => {
    if (!sellPrice || !sharesSold || !stock.averagePriceFromFIFO) return null;
    const profit = (sellPrice - stock.averagePriceFromFIFO) * sharesSold;
    const percent =
      ((sellPrice - stock.averagePriceFromFIFO) / stock.averagePriceFromFIFO) * 100;
    return { profit: profit.toFixed(2), percent: percent.toFixed(2) };
  }, [sellPrice, sharesSold, stock.averagePriceFromFIFO]);

  const tradeDuration = useMemo(() => {
    if (!stock.entryDate || !exitDate) return null;
    const entry = new Date(stock.entryDate);
    const exit = new Date(exitDate);
    const diff = Math.round((exit - entry) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : null;
  }, [stock.entryDate, exitDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sellPrice || !sharesSold || !exitReason) return;

    const user = auth.currentUser;
    if (!user) {
      alert("User not logged in.");
      return;
    }

    const entryData = {
      ticker:stock.ticker,
      sellPrice: parseFloat(sellPrice),
      sharesSold: parseInt(sharesSold),
      exitReason,
      exitNotes,
      reflection,
      chartLink,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      followedPlan,
      pAndL,
      exitDate,
      tradeDuration,
      checklistReview,
      createdAt: serverTimestamp(),
      journalType: "Sell",
    };

    try {
      const journalRef = await addDoc(
        collection(db, "users", user.uid, "journalEntries"),
        entryData
      );

      await addDoc(collection(db, "users", user.uid, "pastPositions"), {
        ...entryData,
        journalEntryId: stock.id,
      });

      // Optionally reduce shares or remove currentPosition (up to your logic)
      console.log("id is", stock.id);
      const currentPosRef = doc(
        db,
        "users",
        user.uid,
        "currentPositions",
        stock.id
      );
      const currentDoc = await getDoc(currentPosRef);
      console.log("your current doc", currentDoc);

      if (currentDoc.exists()) {
        const currentData = currentDoc.data();
        const remainingShares = currentData.shares - parseInt(sharesSold);
        if (remainingShares > 0) {
          await updateDoc(currentPosRef, { shares: remainingShares });
        } else {
          await deleteDoc(currentPosRef);
        }
      }

      if (onSubmit) onSubmit(entryData); // optional callback
    } catch (err) {
      console.error("Error saving exit:", err);
      alert("Failed to save exit to the database.");
    }
  };

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
            Would you like to review your past sell trades for {stock.ticker} before
            completing this exit?
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
              <span className="block mb-1 font-medium">Sell Price</span>
              <input
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(parseFloat(e.target.value))}
                className="w-full p-2 border rounded"
                placeholder="e.g., 115.50"
                required
              />
            </label>

            <label className="block">
              <span className="block mb-1 font-medium">Shares Sold</span>
              <input
                type="number"
                value={sharesSold}
                onChange={(e) => setSharesSold(parseInt(e.target.value))}
                className="w-full p-2 border rounded"
                placeholder="e.g., 5"
                max={stock.availableShares}
                required
              />
            </label>

            <label className="block">
              <span className="block mb-1 font-medium">Exit Date</span>
              <input
                type="date"
                value={new Date().toLocaleDateString("en-CA")}
                onChange={(e) => setExitDate(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </label>
          </div>

          {pAndL && (
            <div
              className={`text-sm font-medium ${
                parseFloat(pAndL.profit) >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              P&L: ${pAndL.profit} ({pAndL.percent}%)
            </div>
          )}

          {tradeDuration !== null && (
            <div className="text-sm text-gray-600">
              Holding Period:{" "}
              <span className="font-medium">{tradeDuration} days</span>
            </div>
          )}

          <label className="block">
            <span className="block mb-1 font-medium">Reason for Exit</span>
            <select
              value={exitReason}
              onChange={(e) => setExitReason(e.target.value)}
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

          {exitReason === "Other" && (
            <label className="block">
              <span className="block mb-1 font-medium">Custom Reason</span>
              <input
                type="text"
                value={exitNotes}
                onChange={(e) => setExitNotes(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Describe your reason"
              />
            </label>
          )}

          {stock.expectations && (
            <label className="block">
              <span className="block mb-1 font-medium">
                Original Expectations
              </span>
              <div className="text-sm text-gray-700 italic mb-2">
                “{stock.expectations}”
              </div>
              <span className="block mb-1 font-medium">
                Did this trade go according to plan?
              </span>
              <select
                value={followedPlan}
                onChange={(e) => setFollowedPlan(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="partial">Partially</option>
                <option value="no">No</option>
              </select>
            </label>
          )}

          {pastChecklist && Object.keys(pastChecklist).length > 0 && (
            <div>
              <h3 className="font-semibold text-base">Trade Reason Review</h3>
              <p className="text-sm text-gray-600 mb-2">
                Now that you’ve exited the trade, were these original reasons
                valid?
              </p>
              <div className="space-y-2">
                {Object.entries(pastChecklist).map(([key, val]) => (
                  <div key={key} className="text-sm">
                    <div className="font-medium">{key}</div>
                    <div className="text-gray-500 italic mb-1">
                      {val.comment}
                    </div>
                    <select
                      value={checklistReview[key] || ""}
                      onChange={(e) =>
                        setChecklistReview((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="w-full p-1.5 border border-gray-300 rounded"
                    >
                      <option value="">Review your judgment</option>
                      <option value="positive">Still Positive</option>
                      <option value="neutral">Didn’t Matter</option>
                      <option value="negative">Shouldn’t have relied</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="block mb-1 font-medium">Reflection</span>
            <textarea
              rows={3}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
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
              value={chartLink}
              onChange={(e) => setChartLink(e.target.value)}
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
              value={tags}
              onChange={(e) => setTags(e.target.value)}
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
