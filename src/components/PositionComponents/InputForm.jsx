import { motion } from "framer-motion";
import { useState } from "react";
import ReasonCheckList from "./ReasonCheckList";
export default function InputForm({ setShowForm, prefillData }) {
  const initialChecklistItems = [
    "Graph pattern",
    "Candle pattern",
    "Key level",
  ];
  //  const initialChecklistItems = [
  //   "Graph pattern",
  //   "Candle pattern",
  //   "Key level",
  //   "Trendline",
  //   "Moving average cross",
  //   "Volume spike",
  //   "Oversold/Overbought",
  //   "MACD crossover",
  //   "News/Catalyst",
  //   "Sector strength",
  // ];

  const setChecklist = (updatedChecklist) => {
    setForm((prev) => ({ ...prev, checklist: updatedChecklist }));
  };

  const [form, setForm] = useState({
    ticker: prefillData?.ticker || "",
    shares: prefillData?.shares || "",
    entryPrice: prefillData?.entryPrice || "",
    entryDate: "",
    stopLoss: "",
    targetPrice: "",
    reason: "",
    expectations: "",
    signals: "",
    strategyFit: "",
    mood: "",
    confidence: "",
    influencedByFomo: "",
    stressFactors: "",
    tags: "",
    journalType: "buy",
    checklist: initialChecklistItems.reduce((acc, item) => {
      acc[item] = { value: "neutral", comment: "" };
      return acc;
    }, {}),
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Journal Entry Submitted:", form);
    setShowForm(false);
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
      confidence: "",
      influencedByFomo: "",
      stressFactors: "",
      tags: "",
      journalType: "buy",
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
      className=""
    >
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
            e.preventDefault();
          }
        }}
        className="p-6 mt-4 mb-8 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] h-[calc(70vh)]  rounded-xl w-full space-y-4 overflow-y-auto"
      >
        <div className="grid grid-cols-3 grid-rows-2 gap-6">
          {[
            {
              label: "Ticker Symbol",
              name: "ticker",
              type: "text",
              placeholder: "e.g. AAPL",
            },
            {
              label: "Number of Shares",
              name: "shares",
              type: "text",
              placeholder: "e.g. 10",
            },
            {
              label: "Entry Price",
              name: "entryPrice",
              type: "text",
              placeholder: "e.g. 130",
            },
            { label: "Entry Date", name: "entryDate", type: "date" },
            {
              label: "Stop Loss (optional)",
              name: "stopLoss",
              type: "text",
              placeholder: "e.g. 120",
            },
            {
              label: "Target Price (optional)",
              name: "targetPrice",
              type: "text",
              placeholder: "e.g. 150",
            },
          ].map((field) => (
            <label key={field.name} className="">
              <span className="block mb-1 font-medium">{field.label}</span>
              <input
                type={field.type}
                name={field.name}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
              />
            </label>
          ))}
        </div>
        <ReasonCheckList
          checklist={form.checklist}
          setChecklist={setChecklist}
        />

        {[
          {
            label: "Why are you entering this trade?",
            name: "reason",
            placeholder: "e.g. Breakout above resistance on high volume",
          },
          {
            label: "What do you expect to happen?",
            name: "expectations",
            placeholder: "e.g. Price will retest previous high within 2–3 days",
          },
          {
            label: "What signals or patterns?",
            name: "signals",
            placeholder: "e.g. 3 white soldiers + price above EMA 50",
          },
          {
            label: "How does it fit your strategy?",
            name: "strategyFit",
            placeholder: "e.g. Matches my momentum breakout strategy",
          },
          {
            label: "Optional Notes",
            name: "note",
            placeholder: "e.g. These are some other reasons",
          },
        ].map((field) => (
          <label key={field.name} className="block">
            <span className="block mb-1 font-medium">{field.label}</span>
            <textarea
              name={field.name}
              value={form[field.name]}
              onChange={handleChange}
              placeholder={field.placeholder}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
            />
          </label>
        ))}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mood */}
          <label className="block">
            <span className="block mb-1 font-medium">
              Mood at time of entry
            </span>
            <select
              name="mood"
              value={form.mood}
              onChange={handleChange}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
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

          {/* Confidence */}
          <label className="block">
            <span className="block mb-1 font-medium">
              Confidence Level (1–10)
            </span>
            <input
              type="number"
              name="confidence"
              value={form.confidence}
              onChange={handleChange}
              placeholder="Confidence Level (1–10)"
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
            />
          </label>

          {/* Journal Type */}
          <label className="block">
            <span className="block mb-1 font-medium">Journal Type</span>
            <select
              name="journalType"
              value={form.journalType}
              onChange={handleChange}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="watch">Watchlist Update</option>
            </select>
          </label>
        </div>

        {/* Tags - Full Width */}
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
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
            />
          </label>
        </div>

        <motion.button
          type="submit"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-full rounded-md px-4 py-2 font-bold text-white bg-[var(--color-primary)] hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary active:border active:border-gray-300 active:bg-transparent active:text-[var(--color-primary)]"
        >
          Submit Entry
        </motion.button>
      </form>
    </motion.div>
  );
}
