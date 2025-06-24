import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import ReasonCheckList from "./ReasonCheckList";
import ConfidenceSlider from "./ConfidenceSlider";
import RiskRewardInput from "./RiskRewardInput";

export default function InputForm() {
  const initialChecklistItems = [
    "Graph pattern",
    "Candle pattern",
    "Key level",
    "EMA50",
    "RSI",
  ];

  const [showExpandedForm, setShowExpandedForm] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    setFadeKey((prev) => prev + 1);
  }, [showExpandedForm]);

  const getPlaceholderForMood = (mood) => {
    console.log("i got", mood)
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
    shares: "",
    entryPrice: "",
    entryDate: "",
    stopLoss: "",
    targetPrice: "",
    reason: "",
    expectations: "",
    signals: "",
    strategyFit: "",
    mood: "",
    confidence: 5,
    tags: "",
    journalType: "buy",
    direction: "long",
    timeframe: "",
    exitPlan: "",
    riskReward: "",
    rrMode: "targetPrice", // or "riskReward"
    checklist: initialChecklistItems.reduce((acc, item) => {
      acc[item] = { value: "neutral", comment: "" };
      return acc;
    }, {}),
  });

  const setChecklist = (updatedChecklist) => {
    setForm((prev) => ({ ...prev, checklist: updatedChecklist }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Journal Entry Submitted:", form);
    setShowExpandedForm(false);
    setForm({
      ticker: "",
      shares: "",
      entryPrice: "",
      entryDate: "",
      stopLoss: "",
      targetPrice: "",
      reason: "",
      expectations: "",
      signals: "",
      strategyFit: "",
      mood: "",
      confidence: 5,
      tags: "",
      journalType: "buy",
      direction: "long",
      timeframe: "",
      exitPlan: "",
      riskReward: "",
      rrMode: "targetPrice", // or "riskReward"
      checklist: initialChecklistItems.reduce((acc, item) => {
        acc[item] = { value: "neutral", comment: "" };
        return acc;
      }, {}),
    });
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
            e.preventDefault();
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

        {!showExpandedForm && (
          <div className="flex gap-4">
            {[
              {
                label: "Ticker Name",
                name: "ticker",
                type: "text",
                placeholder: "e.g. AAPL",
              },
              {
                label: "Number of Shares",
                name: "shares",
                type: "number",
                placeholder: "e.g. 10",
              },
              {
                label: "Entry Price",
                name: "entryPrice",
                type: "number",
                placeholder: "e.g. 175",
              },
            ].map((field) => (
              <div key={field.name} className="flex flex-col gap-2 w-1/4">
                <label>
                  <span className="block mb-1 font-medium">{field.label}</span>
                  <input
                    type={field.type}
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
                    required
                  />
                </label>
              </div>
            ))}

            <div className="flex flex-col gap-2 justify-end">
              <motion.button
                type="submit"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowExpandedForm(true)}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="rounded-md px-4 py-2 text-sm font-bold text-white bg-[var(--color-primary)] hover:opacity-80"
              >
                Submit Entry
              </motion.button>
            </div>
          </div>
        )}

        {showExpandedForm && (
          <>
            {/* Basic Info */}
            <div className="grid grid-cols-3 gap-6 auto-rows-auto">
              {[
                { label: "Ticker Name", name: "ticker", type: "text" },
                { label: "Number of Shares", name: "shares", type: "number" },
                { label: "Entry Price", name: "entryPrice", type: "number" },
                { label: "Entry Date", name: "entryDate", type: "date" },
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

              <label className="block">
                <span className="block mb-1 font-medium">
                  Mood at time of entry
                </span>
                <select
                  name="mood"
                  value={form.mood}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select mood</option>
                  {[
                    "😌 calm",
                    "😟 anxious",
                    "🤩 excited",
                    "😨 fearful",
                    "😐 bored",
                    "⚡ impulsive",
                  ].map((mood) => (
                    <option key={mood} value={mood}>
                      {mood}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {/* Stop Loss and R/R */}

            <div className="grid grid-cols-3 gap-6"></div>

            <ReasonCheckList
              checklist={form.checklist}
              setChecklist={setChecklist}
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
                label: `What makes you feel ${form.mood.slice(2)}?`,
                name: "moodReason",
                placeholder: getPlaceholderForMood(form.mood.slice(3)),
              },
            ].map((field) => (
              <label key={field.name} className="block">
                <span className="block mb-1 font-medium">{field.label}</span>
                <textarea
                  name={field.name}
                  value={form[field.name]}
                  onChange={handleChange}
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
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-full rounded-md px-4 py-2 font-bold bg-gray-200  hover:opacity-80"
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
