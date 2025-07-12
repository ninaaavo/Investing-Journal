import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import ReasonCheckList from "./ReasonCheckList";
import ConfidenceSlider from "./ConfidenceSlider";
import RiskRewardInput from "./RiskRewardInput";
import { db } from "../../firebase";
import { auth } from "../../firebase";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import TickerSearchInput from "../TickerSearchInput";
import { toast } from "react-toastify";
import DateTimeInput from "./DateTimeInput";
export default function InputForm() {
  const [editCheckListMode, setEditCheckListMode] = useState(false);
  const [showExpandedForm, setShowExpandedForm] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (tickerDropdownOpen) {
        // Let TickerSearchInput handle this
        return;
      }
      e.preventDefault();
      setShowExpandedForm(true);
    }
  };

  useEffect(() => {
    setEditCheckListMode?.(editCheckListMode); // or whatever your edit mode boolean is
  }, [editCheckListMode]);

  useEffect(() => {
    setFadeKey((prev) => prev + 1);
  }, [showExpandedForm]);

  const getPlaceholderForMood = (mood) => {
    switch (mood) {
      case "calm":
        return "This trade feels steady — my plan is clear, and the risk is managed.";
      case "anxious":
        return "I feel uneasy about this trade — maybe I’m overthinking or unsure about my setup.";
      case "excited":
        return "This looks like a big opportunity — strong signals, good momentum, or a news catalyst.";
      case "fearful":
        return "I'm afraid this might go against me — maybe it's too volatile or I'm still recovering from a loss.";
      case "bored":
        return "Nothing really stands out — maybe I'm trading out of habit instead of conviction.";
      case "impulsive":
        return "I acted quickly without much confirmation — not sure if I followed my plan fully.";
      default:
        return "What made you feel this way about the trade?";
    }
  };

  const [form, setForm] = useState({
    ticker: "",
    companyName: "",
    shares: "",
    entryPrice: "",
    entryDate: new Date().toLocaleDateString("en-CA"),
    stopLoss: "",
    targetPrice: "",
    reason: "",
    expectations: "",
    signals: "",
    strategyFit: "",
    confidence: 5,
    tags: "",
    journalType: "buy",
    direction: "long",
    timeframe: "",
    exitPlan: "",
    riskReward: "",
    rrMode: "targetPrice", // or "riskReward"
  });

  // fetch checklist upon page load
  useEffect(() => {
    const fetchPreferredChecklist = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.preferredChecklist) {
          setForm((prev) => ({
            ...prev,
            checklist: Object.fromEntries(
              Object.entries(data.preferredChecklist).map(([label, item]) => [
                label,
                { value: "neutral", comment: "", weight: item.weight ?? 1 },
              ])
            ),
          }));
        }
      }
    };

    fetchPreferredChecklist();
  }, [showExpandedForm]);

  const [moodEmoji, setMoodEmoji] = useState("");
  const [moodLabel, setMoodLabel] = useState("");
  const [moodReason, setMoodReason] = useState("");

  const setChecklist = (updatedChecklist) => {
    setForm((prev) => ({ ...prev, checklist: updatedChecklist }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const [tickerDropdownOpen, setTickerDropdownOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      console.error("User not authenticated");
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.error("User doc not found");
      return;
    }

    try {
      // 🆕 Set journalType based on direction
      const adjustedJournalType = form.direction === "short" ? "sell" : "buy";

      const updatedMoodLog = [];
      console.log("emo", moodEmoji, "label", moodLabel, "reason", moodReason);
      if (moodEmoji && moodLabel) {
        updatedMoodLog.push({
          emoji: moodEmoji,
          label: moodLabel,
          time: new Date().toLocaleTimeString("en-US"),
          reason: moodReason,
        });
      }
      const journalData = {
        ...form,
        moodLog: updatedMoodLog,
        journalType: adjustedJournalType,
        isEntry:true,
        createdAt: serverTimestamp(),
      };

      // Add journal entry
      const journalRef = await addDoc(
        collection(db, "users", user.uid, "journalEntries"),
        journalData
      );

      // Add to current position
      const positionQuery = collection(
        db,
        "users",
        user.uid,
        "currentPositions"
      );
      const snapshot = await getDocs(positionQuery);
      const existing = snapshot.docs.find(
        (doc) =>
          doc.data().ticker.toUpperCase() === form.ticker.toUpperCase() &&
          doc.data().direction === form.direction
      );

      if (existing) {
        const data = existing.data();
        const totalShares = Number(data.shares) + Number(form.shares);
        const totalCost =
          Number(data.averagePrice) * Number(data.shares) +
          Number(form.entryPrice) * Number(form.shares);
        const newAvgPrice = totalCost / totalShares;

        await updateDoc(
          doc(db, "users", user.uid, "currentPositions", existing.id),
          {
            shares: totalShares,
            averagePrice: newAvgPrice,
            lastUpdated: serverTimestamp(),
          }
        );
      } else {
        await setDoc(
          doc(db, "users", user.uid, "currentPositions", journalRef.id),
          {
            ticker: form.ticker.toUpperCase(),
            companyName: form.companyName,
            shares: Number(form.shares),
            averagePrice: Number(form.entryPrice),
            entryDate: form.entryDate,
            direction: form.direction,
            journalEntryId: journalRef.id,
            createdAt: serverTimestamp(),
          }
        );
      }

      const updatedPreferredChecklist = Object.fromEntries(
        Object.entries(form.checklist).map(([key, val]) => [
          key,
          { weight: val.weight ?? 1 },
        ])
      );

      await updateDoc(userRef, {
        preferredChecklist: updatedPreferredChecklist,
      });

      setShowExpandedForm(false);
      setForm({
        ticker: "",
        companyName: "",
        shares: "",
        entryPrice: "",
        entryDate: new Date().toLocaleDateString("en-CA"),
        stopLoss: "",
        targetPrice: "",
        reason: "",
        expectations: "",
        signals: "",
        strategyFit: "",
        confidence: 5,
        tags: "",
        journalType: "buy", // fallback value
        direction: "long",
        timeframe: "",
        exitPlan: "",
        riskReward: "",
        rrMode: "targetPrice",
      });

      setMoodEmoji("");
      setMoodLabel("");
      setMoodReason("");

      toast.success("📒 Journal entry submitted!", {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
    } catch (error) {
      console.error("Error submitting journal:", error);
      toast.error("❌ Failed to submit entry. Please try again.");
    }
  };

  return (
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
    >
      <motion.form
        key={fadeKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
            if (!editCheckListMode) {
              // allow submit
              return;
            } else {
              e.preventDefault(); // block enter when editing checklist
            }
          }
        }}
        className={`relative p-6 mt-4 mb-8 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl w-full space-y-4 overflow-y-auto ${
          showExpandedForm ? "h-[70vh]" : ""
        }`}
      >
        {/* ❌ Close button */}
        {showExpandedForm && (
          <motion.button
            type="button"
            onClick={() => setShowExpandedForm(false)}
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
        )}

        {/* collapsed version  */}
        {!showExpandedForm && (
          <div className="grid grid-cols-4 auto-rows-auto gap-x-6 gap-y-2">
            {/* Shared handler */}
            {/* Put this at the top of your component file or function body */}
            {/* Row 1: Labels */}
            <div>
              <label className="block mb-1 font-medium">Ticker Name</label>
            </div>
            <div>
              <label className="block mb-1 font-medium">Number of Shares</label>
            </div>
            <div>
              <label className="block mb-1 font-medium">Entry Price</label>
            </div>
            <div /> {/* Empty cell to align above button */}
            {/* Row 2: Inputs and Button */}
            <div>
              <TickerSearchInput
                styling="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
                form={form}
                onDropdownState={setTickerDropdownOpen}
                onSelect={(ticker, name) => {
                  const titleCaseName = name
                    .toLowerCase()
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ");

                  setForm((prev) => ({
                    ...prev,
                    ticker,
                    companyName: titleCaseName,
                  }));
                }}
              />
            </div>
            <div>
              <input
                type="number"
                name="shares"
                value={form.shares}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 10"
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
                required
              />
            </div>
            <div>
              <input
                type="number"
                name="entryPrice"
                value={form.entryPrice}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 175"
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
                required
              />
            </div>
            <div className="">
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowExpandedForm(true)}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="rounded-md w-full px-4 py-2 text-sm font-bold text-white bg-[var(--color-primary)] hover:opacity-80"
              >
                Expand Form
              </motion.button>
            </div>
          </div>
        )}

        {/* expanded version */}
        {showExpandedForm && (
          <>
            {/* Basic Info */}
            <div className="grid grid-cols-3 gap-6 auto-rows-auto">
              <div>
                <span className="block font-medium">{"Ticker Name"}</span>
                <TickerSearchInput
                  styling={"w-full p-2 border rounded"}
                  form={form}
                  onSelect={(ticker, name) =>
                    setForm((prev) => ({
                      ...prev,
                      ticker,
                      companyName: name,
                    }))
                  }
                />
              </div>

              {[
                { label: "Number of Shares", name: "shares", type: "number" },
                { label: "Entry Price", name: "entryPrice", type: "number" },
                {
                  label: "Trade Direction",
                  name: "direction",
                  type: "select",
                  options: ["Long", "Short"],
                },
                {
                  label: "Timeframe",
                  name: "timeframe",
                  type: "select",
                  options: [
                    "Intraday",
                    "Swing (1-10 days)",
                    "Position (weeks-months)",
                    "Long Term",
                  ],
                },
              ].map((field) => (
                <label key={field.name}>
                  <span className="block font-medium">{field.label}</span>
                  {field.type === "select" ? (
                    <select
                      name={field.name}
                      value={form[field.name]}
                      onChange={handleChange}
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Select</option>
                      {field.options.map((option) => (
                        <option key={option} value={option.toLowerCase()}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      name={field.name}
                      value={form[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      className="w-full p-2 border rounded"
                    />
                  )}
                </label>
              ))}

              {/* Separate Mood Field */}
              <label>
                <span className="block font-medium">Mood at time of entry</span>
                <select
                  value={`${moodEmoji} ${moodLabel}`.trim()}
                  onChange={(e) => {
                    const [emoji, ...labelParts] = e.target.value.split(" ");
                    setMoodEmoji(emoji);
                    setMoodLabel(labelParts.join(" "));
                  }}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select</option>
                  {[
                    "😌 calm",
                    "😟 anxious",
                    "🤩 excited",
                    "😨 fearful",
                    "😐 bored",
                    "⚡ impulsive",
                  ].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="block mb-1 font-medium">Stop Loss</span>
                <input
                  type="number"
                  name="stopLoss"
                  value={form.stopLoss}
                  onChange={handleChange}
                  placeholder="e.g. 120"
                  className="w-full p-2 border rounded"
                />
                {form.entryPrice && form.stopLoss && (
                  <p className="text-xs text-gray-500 mt-1 pl-1">
                    {(
                      ((Number(form.entryPrice) - Number(form.stopLoss)) /
                        Number(form.entryPrice)) *
                      100
                    ).toFixed(2) * (form.direction === "long" ? 1 : -1)}
                    % downside risk
                  </p>
                )}
              </label>

              <RiskRewardInput form={form} setForm={setForm} />

              <DateTimeInput form={form} setForm={setForm} type="entry" />
            </div>

            <ReasonCheckList
              checklist={form.checklist}
              setChecklist={setChecklist}
              editMode={editCheckListMode}
              setEditMode={setEditCheckListMode}
            />

            {[
              {
                label: "What do you expect to happen?",
                name: "expectations",
                placeholder:
                  "e.g. Price will retest previous high within 2–3 days",
              },
              {
                label: "Optional Notes",
                name: "note",
                placeholder: "e.g. These are some other reasons",
              },
              {
                label: "Exit Plan or Conditions to Exit",
                name: "exitPlan",
                placeholder:
                  "e.g. I will exit if price drops below trendline or loses volume",
              },
              {
                label: `What makes you feel ${moodLabel}?`,
                name: "moodReason",
                placeholder: getPlaceholderForMood(moodLabel),
              },
            ].map((field) => (
              <label key={field.name} className="block">
                <span className="block mb-1 font-medium">{field.label}</span>
                <textarea
                  name={field.name}
                  value={
                    field.name === "moodReason" ? moodReason : form[field.name]
                  }
                  onChange={
                    field.name === "moodReason"
                      ? (e) => setMoodReason(e.target.value)
                      : handleChange
                  }
                  placeholder={field.placeholder}
                  className="w-full p-2 border rounded"
                />
              </label>
            ))}

            <ConfidenceSlider
              value={form.confidence}
              onChange={(e) =>
                setForm({ ...form, confidence: parseInt(e.target.value) })
              }
            />

            <div className="mt-4">
              <label className="block">
                <span className="block mb-1 font-medium">
                  Tags (comma separated)
                </span>
                <input
                  name="tags"
                  value={form.tags}
                  onChange={handleChange}
                  placeholder="Tags (comma separated)"
                  className="w-full p-2 border rounded"
                />
              </label>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-full rounded-md px-4 py-2 font-bold bg-gray-200  hover:opacity-80"
              type="button"
              onClick={() => setShowExpandedForm(false)}
            >
              Collapse Form
            </motion.button>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-full rounded-md px-4 py-2 font-bold text-white bg-[var(--color-primary)] hover:opacity-80"
            >
              Submit Entry
            </motion.button>
          </>
        )}
      </motion.form>
    </motion.div>
  );
}
