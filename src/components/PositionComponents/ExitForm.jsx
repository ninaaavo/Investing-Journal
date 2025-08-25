// ExitFormUpdated.jsx
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
  Timestamp,
  limit,
  increment,
} from "firebase/firestore";
import { getDateStr } from "../../utils/getDateStr"; // format: YYYY-MM-DD
import DateTimeInput from "./DateTimeInput";
import { backfillSnapshotsFrom } from "../../utils/snapshot/backfillSnapshotsFrom";
import { useUser } from "../../context/UserContext";
import { invalidateLiveSnapshot } from "../../utils/snapshot/invalidateLiveSnapshot";
function getAveragePriceFromFIFO(fifoStack = []) {
  let totalShares = 0;
  let totalCost = 0;

  for (const lot of fifoStack) {
    const shares = parseFloat(lot.sharesRemaining ?? 0);
    const price = parseFloat(lot.entryPrice ?? 0);

    if (!isNaN(shares) && shares > 0 && !isNaN(price)) {
      totalShares += shares;
      totalCost += shares * price;
    }
  }

  return totalShares > 0 ? totalCost / totalShares : 0;
}

function buildTimestamp(dateStr, timeStr) {
  if (!dateStr) return { timestamp: null, timeIncluded: false };

  const fullDateTime = `${dateStr}T${timeStr || "00:00"}`;
  const timestamp = Timestamp.fromDate(new Date(fullDateTime));

  return {
    timestamp,
    timeProvided: !!timeStr,
  };
}

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
  const { incrementRefresh } = useUser();
  const [showReviewPrompt, setShowReviewPrompt] = useState(true);
  const [showAllExpectations, setShowAllExpectations] = useState(false);
  const [expandedReasons, setExpandedReasons] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invalidFields, setInvalidFields] = useState({});
  const validateFields = () => {
    const newInvalids = {};

    if (!form.exitPrice) newInvalids.exitPrice = true;
    if (!form.shares) newInvalids.shares = true;
    if (!form.exitReason) newInvalids.exitReason = true;
    if (form.exitReason === "Other" && !form.exitNotes.trim()) {
      newInvalids.exitNotes = true;
    }

    setInvalidFields(newInvalids);
    return Object.keys(newInvalids).length === 0;
  };

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
    exitTime: "",
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

  const handleReviewClick = (choice) => {
    setShowReviewPrompt(false);
    if (choice === "yes") {
      window.location.href = `/journal?ticker=${stock.ticker}&type=Sell`;
    }
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
    if (!stock.entryTimestamp || !form.exitDate) return null;

    // Create exit datetime from form.exitDate + form.exitTime (or 12:00 PM)
    const exitDate = new Date(form.exitDate);
    if (isNaN(exitDate)) return null;
    var exit;
    if (form.exitTime) {
      exit = buildTimestamp(form.exitDate, form.exitTime).timestamp;
    } else {
      exit = buildTimestamp(form.exitDate, "12:00").timestamp;
    }

    const diffSeconds = exit.seconds - stock.entryTimestamp.seconds;
    return diffSeconds >= 0 ? diffSeconds : null;
  }, [stock.entryTimestamp, stock.timeProvided, form.exitDate, form.exitTime]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateFields()) return;
    if (!form.exitPrice || !form.shares || !form.exitReason) return;

    setIsSubmitting(true);
    const user = auth.currentUser;
    if (!user) {
      alert("User not logged in.");
      return;
    }

    const { timestamp, timeProvided } = buildTimestamp(
      form.exitDate,
      form.exitTime
    );
    form.exitTimestamp = timestamp;
    form.timeProvided = timeProvided;

    const exitShares = parseFloat(form.shares);
    const exitPrice = parseFloat(form.exitPrice);

    try {
      // === Load position ===
      const currentPosRef = doc(
        db,
        "users",
        user.uid,
        "currentPositions",
        stock.id
      );
      const currentDoc = await getDoc(currentPosRef);
      if (!currentDoc.exists()) {
        alert("Current position not found.");
        return;
      }

      const currentData = currentDoc.data();
      const isShort =
        (currentData.direction || stock.direction || "").toLowerCase() ===
        "short";
      const currentShares = Number(currentData.shares || 0);
      if (currentShares < exitShares) {
        alert("You don't have enough shares to exit.");
        return;
      }

      // === Shared locals ===
      const exitDateObj = timestamp.toDate();
      const today = new Date();

      // ────────────────────────────────────────────────────────────────
      // LONG PATH (Sell)
      // ────────────────────────────────────────────────────────────────
      if (!isShort) {
        const fifoStack = Array.isArray(currentData.fifoStack)
          ? currentData.fifoStack
          : [];
        const currentAvgPrice = Number(currentData.averagePrice || 0);

        // FIFO reduce (your original)
        let remainingToSell = exitShares;
        const newFifoStack = [];
        const entryEvents = [];

        for (const lot of fifoStack) {
          if (remainingToSell <= 0) {
            newFifoStack.push(lot);
            continue;
          }
          const sellAmount = Math.min(
            Number(lot.sharesRemaining || 0),
            remainingToSell
          );
          if (sellAmount > 0) {
            entryEvents.push({
              entryId: lot.entryId,
              entryPrice: Number(lot.entryPrice || 0),
              entryTimestamp: lot.entryTimestamp,
              sharesUsed: sellAmount,
            });
            const leftover = Number(lot.sharesRemaining || 0) - sellAmount;
            if (leftover > 0) {
              newFifoStack.push({ ...lot, sharesRemaining: leftover });
            }
            remainingToSell -= sellAmount;
          }
        }
        if (remainingToSell > 0) {
          alert("FIFO stack exhausted. Not enough shares to sell.");
          return;
        }

        // (Backdated) subtract holding days for sold LONG shares
        if (exitDateObj < today) {
          const statsRef = doc(
            db,
            "users",
            user.uid,
            "stats",
            "holdingDuration"
          );
          const statsSnap = await getDoc(statsRef);
          if (statsSnap.exists()) {
            const stats = statsSnap.data();
            let totalDaysToSubtract = 0;
            entryEvents.forEach((entry) => {
              const entryDate =
                entry.entryTimestamp.toDate?.() ??
                new Date(entry.entryTimestamp);
              const daysHeld =
                (exitDateObj - entryDate) / (1000 * 60 * 60 * 24);
              const capital = entry.sharesUsed * Number(entry.entryPrice || 0);
              totalDaysToSubtract += daysHeld * capital;
            });
            await updateDoc(statsRef, {
              totalHoldingDays:
                (stats.totalHoldingDays || 0) - totalDaysToSubtract,
            });
          }
        }

        // Exit journal (LONG)
        const totalCostBasis = entryEvents.reduce(
          (s, e) => s + e.entryPrice * e.sharesUsed,
          0
        );
        const totalSharesUsed = entryEvents.reduce(
          (s, e) => s + e.sharesUsed,
          0
        );
        const averageBuyPrice = totalSharesUsed
          ? totalCostBasis / totalSharesUsed
          : 0;
        const pAndL = (exitPrice - averageBuyPrice) * totalSharesUsed;

        const entriesRef = collection(db, "users", user.uid, "journalEntries");
        const exitJournal = {
          ...form,
          companyName: stock.companyName,
          ticker: stock.ticker,
          exitPrice,
          shares: exitShares,
          pAndL,
          tradeDuration: null,
          createdAt: serverTimestamp(),
          journalType: "sell",
          direction: "long",
          isEntry: false,
          entryEvents,
          linkedEntryIds: entryEvents.map((f) => f.entryId),
          averageBuyPrice,
        };
        delete exitJournal.exitDate;
        delete exitJournal.exitTime;
        delete exitJournal.expectations;

        const exitDocRef = await addDoc(entriesRef, exitJournal);

        // Update linked entry journals (LONG)
        for (const fifo of entryEvents) {
          const entryRef = doc(
            db,
            "users",
            user.uid,
            "journalEntries",
            fifo.entryId
          );
          const entrySnap = await getDoc(entryRef);
          const entryData = entrySnap.data();
          const prevEvents = entryData.exitEvents || [];

          const newExitEvent = {
            sharesSold: fifo.sharesUsed,
            soldPrice: exitPrice,
            exitTimestamp: timestamp,
            exitJournalId: exitDocRef.id,
          };
          const updatedExitEvents = [...prevEvents, newExitEvent];
          const totalSharesSold = updatedExitEvents.reduce(
            (sum, e) => sum + e.sharesSold,
            0
          );
          const totalProceeds = updatedExitEvents.reduce(
            (sum, e) => sum + e.sharesSold * e.soldPrice,
            0
          );
          const averageSoldPrice = totalSharesSold
            ? totalProceeds / totalSharesSold
            : 0;
          const entryTotalShares = Number(entryData.shares || 0);
          const isClosed = totalSharesSold >= entryTotalShares;

          await updateDoc(entryRef, {
            exitEvents: updatedExitEvents,
            totalSharesSold,
            averageSoldPrice,
            isClosed,
            status: isClosed ? "closed" : "open",
          });
        }

        // Update current position (LONG)
        const remainingShares = currentShares - exitShares;
        if (remainingShares > 0) {
          await updateDoc(currentPosRef, {
            shares: remainingShares,
            fifoStack: newFifoStack,
            lastUpdated: serverTimestamp(),
            averagePrice: getAveragePriceFromFIFO(newFifoStack),
          });
        } else {
          await deleteDoc(currentPosRef);
        }

        // Backfill (if backdated)
        if (exitDateObj < today) {
          await backfillSnapshotsFrom({
            userId: user.uid,
            fromDate: timestamp.toDate(),
            newTrade: {
              ticker: stock.ticker.toUpperCase(),
              shares: exitShares, // positive
              averagePrice: exitPrice,
              direction: "long",
              entryTimestamp: timestamp,
            },
            tradeCost: exitShares * exitPrice,
            isExit: true,
            pAndL,
          });
        }

        // realizedPLByDate update
        const dateStr = getDateStr(timestamp.toDate());
        const plRef = doc(db, "users", user.uid, "realizedPLByDate", dateStr);
        const plSnap = await getDoc(plRef);
        const prevPL = plSnap.exists()
          ? Number(plSnap.data().realizedPL || 0)
          : 0;
        const updatedPL = prevPL + pAndL;
        if (plSnap.exists()) {
          await updateDoc(plRef, {
            realizedPL: updatedPL,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(plRef, {
            realizedPL: updatedPL,
            date: dateStr,
            createdAt: serverTimestamp(),
          });
        }

        // Best/Worst closed updates (LONG)
        await updateClosedBestWorst(
          user.uid,
          stock.ticker,
          pAndL,
          totalCostBasis,
          timestamp
        );

        // ────────────────────────────────────────────────────────────────
        // SHORT PATH (Buy to Cover)
        // ────────────────────────────────────────────────────────────────
      } else {
        const avgShortPrice = Number(
          currentData.avgShortPrice ?? currentData.averagePrice ?? 0
        );

        // OPTION A (recommended now): no short lots — use avgShortPrice
        let entryEvents = []; // none to link precisely without lots
        let totalCostBasis = avgShortPrice * exitShares; // for % calc & closed ranking
        const pAndL = (avgShortPrice - exitPrice) * exitShares; // short formula

        // OPTION B (enable later): if you add currentData.shortLots, do FIFO here
        // const shortLots = Array.isArray(currentData.shortLots) ? currentData.shortLots : [];
        // ... compute entryEvents + pAndL = Σ (lot.entryPrice - exitPrice) * used

        // Exit journal (SHORT)
        const entriesRef = collection(db, "users", user.uid, "journalEntries");
        const exitJournal = {
          ...form,
          companyName: stock.companyName,
          ticker: stock.ticker,
          exitPrice,
          shares: exitShares,
          pAndL,
          tradeDuration: null,
          createdAt: serverTimestamp(),
          journalType: "buy",
          direction: "short",
          isEntry: false,
          entryEvents, // empty when no shortLots
          linkedEntryIds: entryEvents
            .map((e) => e.entryId || "")
            .filter(Boolean),
          averageShortPrice: avgShortPrice,
        };
        delete exitJournal.exitDate;
        delete exitJournal.exitTime;
        delete exitJournal.expectations;

        await addDoc(entriesRef, exitJournal);

        // (Backdated) holding-duration subtraction for SHORTS:
        // skip unless you implement shortLots—no precise timestamps to base it on.

        // Update current position (SHORT)
        const remainingShares = currentShares - exitShares;
        if (remainingShares > 0) {
          await updateDoc(currentPosRef, {
            shares: remainingShares,
            // keep avgShortPrice unchanged for remaining lots
            lastUpdated: serverTimestamp(),
          });
        } else {
          await deleteDoc(currentPosRef);
        }

        // Backfill (if backdated)
        if (exitDateObj < today) {
          await backfillSnapshotsFrom({
            userId: user.uid,
            fromDate: timestamp.toDate(),
            newTrade: {
              ticker: stock.ticker.toUpperCase(),
              shares: exitShares, // positive
              averagePrice: exitPrice, // cover price
              direction: "short",
              entryTimestamp: timestamp,
            },
            tradeCost: 0, // no-cash model
            isExit: true,
            pAndL,
          });
        }

        // realizedPLByDate update
        const dateStr = getDateStr(timestamp.toDate());
        const plRef = doc(db, "users", user.uid, "realizedPLByDate", dateStr);
        const plSnap = await getDoc(plRef);
        const prevPL = plSnap.exists()
          ? Number(plSnap.data().realizedPL || 0)
          : 0;
        const updatedPL = prevPL + pAndL;
        if (plSnap.exists()) {
          await updateDoc(plRef, {
            realizedPL: updatedPL,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(plRef, {
            realizedPL: updatedPL,
            date: dateStr,
            createdAt: serverTimestamp(),
          });
        }

        // Best/Worst closed updates (SHORT)
        await updateClosedBestWorst(
          user.uid,
          stock.ticker,
          pAndL,
          totalCostBasis,
          timestamp,
          "short"
        );
      }

      // Exit reason stats (unchanged)
      await updateExitReasonStats(user.uid, form.exitReason);

      invalidateLiveSnapshot(user.uid);
      incrementRefresh();
      setIsSubmitting(false);
    } catch (err) {
      setIsSubmitting(false);
      console.error("Error saving exit:", err);
      alert("Failed to save exit to the database.");
    }
  };

  //fetch checklist
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
            timestamp: entry.entryTimestamp,
            timeProvided: entry.timeProvided,
            shares: entry.usedShares,
            price: entry.entryPrice,
            value: value.value,
            comment: value.comment,
          });
        }
        if (entry.expectations) {
          expectationArr.push({
            id: entry.id,
            timestamp: entry.entryTimestamp,
            timeProvided: entry.timeProvided,
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
                onChange={(e) => {
                  handleChange(e);
                  if (e.target.value.trim() !== "") {
                    setInvalidFields((prev) => ({ ...prev, exitPrice: false }));
                  }
                }}
                className={`w-full p-2 border rounded transition-all duration-300 ${
                  invalidFields?.exitPrice
                    ? "border-red-500 bg-red-50"
                    : "border-gray-300"
                }`}
                placeholder="e.g., 115.50"
              />
              {invalidFields?.exitPrice && (
                <p className="text-xs text-red-500 mt-1 pl-1">
                  This field is required
                </p>
              )}
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
                    setInvalidFields((prev) => ({ ...prev, shares: false }));
                  }
                }}
                className={`w-full p-2 border rounded transition-all duration-300 ${
                  invalidFields?.shares
                    ? "border-red-500 bg-red-50"
                    : "border-gray-300"
                }`}
                placeholder="e.g., 5"
                min={1}
                max={stock.availableShares}
              />
              {(error || invalidFields?.shares) && (
                <p className="text-xs text-red-500 mt-1 pl-1">
                  {error || "This field is required"}
                </p>
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
              <span className="font-medium">
                {tradeDuration < 86400
                  ? (() => {
                      const hours = Math.round(tradeDuration / 3600);

                      return `${hours} hours`;
                    })()
                  : `${Math.floor(tradeDuration / 86400)} day${
                      Math.floor(tradeDuration / 86400) !== 1 ? "s" : ""
                    }`}
              </span>
            </div>
          )}

          <label className="block pb-10 border-b border-gray-300">
            <span className="block mb-1 font-medium text-lg">
              Reason for Exit
            </span>
            <select
              value={form.exitReason}
              name="exitReason"
              onChange={(e) => {
                handleChange(e);
                if (e.target.value.trim() !== "") {
                  setInvalidFields((prev) => ({ ...prev, exitReason: false }));
                }
              }}
              className={`w-full p-2 border rounded transition-all duration-300 ${
                invalidFields?.exitReason
                  ? "border-red-500 bg-red-50"
                  : "border-gray-300"
              }`}
            >
              <option value="">Select a reason</option>
              {EXIT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
            {invalidFields?.exitReason && (
              <p className="text-xs text-red-500 mt-1 pl-1">
                This field is required
              </p>
            )}
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

          {Array.isArray(stock.expectations) &&
            stock.expectations.length > 0 && (
              <label className="block pt-4 pb-10 border-b border-gray-300">
                <span className="block mb-1 font-medium text-lg">
                  Original Expectations
                </span>

                <div className="space-y-2 mb-4">
                  {(showAllExpectations
                    ? stock.expectations
                    : [stock.expectations[0]]
                  ).map((exp, idx) => {
                    return (
                      <div
                        key={idx}
                        className="text-gray-700 border-l-2 pl-3 mb-1 border-gray-300 ml-4"
                      >
                        <p className="mb-1">“{exp.content}”</p>
                        <p className="text-xs text-gray-500">
                          {exp.timestamp
                            ? exp.timestamp.toDate().toLocaleString("en-US", {
                                month: "2-digit",
                                day: "2-digit",
                                year: "2-digit",
                                ...(exp.timeProvided && {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                }),
                              })
                            : ""}
                        </p>
                      </div>
                    );
                  })}

                  {stock.expectations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowAllExpectations((prev) => !prev)}
                      className="text-sm text-blue-600 underline mt-1 ml-4"
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
                            <div className="italic">{item.comment}</div>

                            <div className="text-xs text-gray-500">
                              {item.timestamp
                                ? item.timestamp
                                    .toDate()
                                    .toLocaleString("en-US", {
                                      month: "2-digit",
                                      day: "2-digit",
                                      year: "2-digit",
                                      ...(item.timeProvided && {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: true,
                                      }),
                                    })
                                : ""}{" "}
                              – {item.shares} shares @ ${item.price} ➝{" "}
                              {item.value}
                            </div>
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
            disabled={isSubmitting}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`w-full rounded-md px-4 py-2 font-bold text-white ${
              isSubmitting
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[var(--color-primary)] hover:opacity-80"
            }`}
          >
            {isSubmitting ? "Submitting..." : "Submit Exit"}
          </motion.button>
        </>
      )}
    </motion.form>
  );
}
