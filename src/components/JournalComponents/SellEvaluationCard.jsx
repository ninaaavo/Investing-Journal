import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SellEvaluationCard({
  title = "Sell Evaluation",
  initialData = {},
  onChange = () => {},
}) {
  const [rating, setRating] = useState(initialData.rating || "⭐⭐⭐");
  const [outcome, setOutcome] = useState(initialData.outcome || "");
  const [repeatDecision, setRepeatDecision] = useState(initialData.repeatDecision || "");
  const [reflection, setReflection] = useState(initialData.reflection || "");

  const handleUpdate = () => {
    onChange({
      rating,
      outcome,
      repeatDecision,
      reflection,
    });
  };

  return (
    <div className="p-8 mt-4 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl w-[calc(32%)] h-[auto] max-h-[320px] overflow-y-auto scroll-stable space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-primary">{title}</h2>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key="editable"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {/* Rating */}
          <div>
            <label className="text-md font-medium text-primary block mb-1">
              Was it a good sell?
            </label>
            <select
              className="w-full border rounded-md p-2 text-sm"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              <option>⭐️</option>
              <option>⭐️⭐️</option>
              <option>⭐️⭐️⭐️</option>
              <option>⭐️⭐️⭐️⭐️</option>
              <option>⭐️⭐️⭐️⭐️⭐️</option>
            </select>
          </div>

          {/* What happened after */}
          <div>
            <label className="text-md font-medium text-primary block mb-1">
              What happened after?
            </label>
            <select
              className="w-full border rounded-md p-2 text-sm"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="">-- Select --</option>
              <option>Price dropped further</option>
              <option>Price rebounded and kept going</option>
              <option>Stayed flat</option>
              <option>Re-entered later</option>
            </select>
          </div>

          {/* Would repeat decision */}
          <div>
            <label className="text-md font-medium text-primary block mb-1">
              Would you make the same decision?
            </label>
            <select
              className="w-full border rounded-md p-2 text-sm"
              value={repeatDecision}
              onChange={(e) => setRepeatDecision(e.target.value)}
            >
              <option value="">-- Select --</option>
              <option>Yes</option>
              <option>No</option>
              <option>Maybe</option>
            </select>
          </div>

          {/* Reflection */}
          <div>
            <label className="text-md font-medium text-primary block mb-1">
              Reflection
            </label>
            <textarea
              rows={3}
              className="w-full border rounded-md p-2 text-sm resize-none"
              placeholder="Write a brief reflection..."
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
            />
          </div>

          {/* Optional: Save button if needed */}
          {/* <button onClick={handleUpdate} className="mt-2 text-sm text-blue-500 underline">
            Save Evaluation
          </button> */}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
