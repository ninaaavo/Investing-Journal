import { motion } from "framer-motion";
import { useState } from "react";

export default function InputForm() {
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
    confidence: "",
    influencedByFomo: "",
    stressFactors: "",
    tags: "",
    journalType: "buy",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Journal Entry Submitted:", form);
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
        className="p-6 mt-4 mb-8 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] h-[calc(70vh)]  rounded-xl w-full space-y-4 overflow-y-auto"
      >
        <div className="grid grid-cols-3 grid-rows-2 gap-6">
          {[
            { label: "Ticker Symbol", name: "ticker", type: "text" },
            { label: "Number of Shares", name: "shares", type: "text" },
            { label: "Entry Price", name: "entryPrice", type: "text" },
            { label: "Entry Date", name: "entryDate", type: "date" },
            { label: "Stop Loss (optional)", name: "stopLoss", type: "text" },
            {
              label: "Target Price (optional)",
              name: "targetPrice",
              type: "text",
            },
          ].map((field) => (
            <label key={field.name} className="">
              <span className="block mb-1 font-medium">{field.label}</span>
              <input
                type={field.type}
                name={field.name}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.label}
                className="w-full p-2 border rounded"
              />
            </label>
          ))}
        </div>

        {[
          { label: "Why are you entering this trade?", name: "reason" },
          { label: "What do you expect to happen?", name: "expectations" },
          { label: "What signals or patterns?", name: "signals" },
          { label: "How does it fit your strategy?", name: "strategyFit" },
        ].map((field) => (
          <label key={field.name} className="block">
            <span className="block mb-1 font-medium">{field.label}</span>
            <textarea
              name={field.name}
              value={form[field.name]}
              onChange={handleChange}
              placeholder={field.label}
              className="w-full p-2 border rounded"
            />
          </label>
        ))}

        <label className="block">
          <span className="block mb-1 font-medium">Mood at time of entry</span>
          <select
            name="mood"
            value={form.mood}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          >
            <option value="">Select mood</option>
            {[
              "calm",
              "anxious",
              "excited",
              "fearful",
              "bored",
              "impulsive",
            ].map((mood) => (
              <option key={mood} value={mood}>
                {mood.charAt(0).toUpperCase() + mood.slice(1)}
              </option>
            ))}
          </select>
        </label>

        {[
          { label: "Confidence Level (1–10)", name: "confidence" },
          { label: "Influenced by FOMO?", name: "influencedByFomo" },
          { label: "Stress Factors (optional)", name: "stressFactors" },
          { label: "Tags (comma separated)", name: "tags" },
        ].map((field) => (
          <label key={field.name} className="block">
            <span className="block mb-1 font-medium">{field.label}</span>
            <input
              name={field.name}
              value={form[field.name]}
              onChange={handleChange}
              placeholder={field.label}
              className="w-full p-2 border rounded"
            />
          </label>
        ))}

        <label className="block">
          <span className="block mb-1 font-medium">Journal Type</span>
          <select
            name="journalType"
            value={form.journalType}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="watch">Watchlist Update</option>
          </select>
        </label>

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
        >
          Submit Entry
        </button>
      </form>
    </motion.div>
  );
}
