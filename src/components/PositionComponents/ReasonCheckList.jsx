import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ReasonCheckList({ checklist, setChecklist, editMode, setEditMode}) {
  const [useWeights, setUseWeights] = useState(false);
  const [newItem, setNewItem] = useState("");
  const checklistItems = Object.keys(checklist);
  const [editingWeights, setEditingWeights] = useState({});
  const hasMounted = useRef(true);
  useEffect(() => {
    const timeout = setTimeout(() => {
      hasMounted.current = true;
    }, 50);
    return () => clearTimeout(timeout);
  }, []);

  const handleChecklistChange = (item, field, value) => {
    const newList = { ...checklist };
    if (field === "weight") {
      newList[item][field] = value === "" ? "" : parseInt(value);
    } else {
      newList[item][field] = value;
    }
    setChecklist(newList);
  };

  const handleAddItem = () => {
    const trimmed = newItem.trim();
    if (trimmed && !checklistItems.includes(trimmed)) {
      const newList = { ...checklist };
      newList[trimmed] = { value: "neutral", comment: "", weight: 1 };
      setChecklist(newList);
      setNewItem("");
    }
  };

  const handleRemoveItem = (item) => {
    const updated = { ...checklist };
    delete updated[item];
    setChecklist(updated);
  };

  const calculateScore = () => {
    let score = 0;
    for (const item of Object.values(checklist)) {
      const weight = useWeights ? parseInt(item.weight) || 1 : 1;
      if (item.value === "positive") score += weight;
      if (item.value === "negative") score -= weight;
    }
    return score;
  };

  const animationProps = hasMounted.current
    ? {
        initial: { opacity: 0, y: -20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { duration: 0.3 },
      }
    : {};

  return (
    <motion.div className="space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Checklist: Trade Reasons</h2>
        <button
          type="button"
          onClick={() => setEditMode(!editMode)}
          className="text-sm text-blue-600 hover:underline"
        >
          {editMode ? "Done" : "Edit"}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Use Weighted Scoring</label>
        <input
          type="checkbox"
          checked={useWeights}
          onChange={() => {
            if (!useWeights) {
              const updated = { ...checklist };
              for (const key in updated) {
                if (updated[key].weight === undefined) {
                  updated[key].weight = 1;
                }
              }
              setChecklist(updated);
            }
            setUseWeights(!useWeights);
          }}
          className="accent-blue-500"
        />
        <span className="text-sm text-gray-600">
          Score: {calculateScore()} ({useWeights ? "weighted" : "flat"})
        </span>
      </div>

      <AnimatePresence mode="wait">
        {editMode ? (
          <motion.div key="edit-mode" {...animationProps} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newItem.trim() !== "") {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
                placeholder="Add new checklist item"
                className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
              />
              <button
                type="button"
                onClick={handleAddItem}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Add
              </button>
            </div>

            <ul className="space-y-1">
              <AnimatePresence>
                {checklistItems.map((item) => (
                  <motion.li
                    key={item}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between border p-2 rounded gap-4"
                  >
                    <span className="flex-1">{item}</span>
                    {useWeights && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">Weight</span>
                        <input
                          type="number"
                          value={checklist[item].weight ?? ""}
                          onChange={(e) =>
                            handleChecklistChange(
                              item,
                              "weight",
                              e.target.value
                            )
                          }
                          className="w-16 p-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item)}
                      className="text-red-500 hover:underline text-sm"
                    >
                      Remove
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        ) : (
          <motion.div
            key="view-mode"
            {...animationProps}
            layout
            className="grid grid-cols-1 gap-4 w-full"
          >
            {checklistItems.map((item) => (
              <motion.div
                layout
                key={item}
                className={`grid ${
                  useWeights
                    ? "grid-cols-[0.5fr_0.3fr_0.2fr_auto]"
                    : "grid-cols-[0.5fr_0.2fr_auto]"
                } gap-4 items-center ${
                  checklist[item].value === "positive"
                    ? "text-green-600"
                    : checklist[item].value === "neutral"
                    ? "text-yellow-600"
                    : "text-red-500"
                }`}
              >
                <label className="font-medium col-span-1">{item}</label>
                {useWeights &&
                  (editingWeights[item] ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={checklist[item].weight ?? ""}
                        onChange={(e) =>
                          handleChecklistChange(item, "weight", e.target.value)
                        }
                        className="w-16 p-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEditingWeights((prev) => ({
                            ...prev,
                            [item]: false,
                          }))
                        }
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <span>Weight: {checklist[item].weight}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingWeights((prev) => ({
                            ...prev,
                            [item]: true,
                          }))
                        }
                        className="hover:text-blue-500"
                      >
                        ✏️
                      </button>
                    </div>
                  ))}
                <select
                  value={checklist[item].value}
                  onChange={(e) =>
                    handleChecklistChange(item, "value", e.target.value)
                  }
                  className="p-2 border rounded col-span-1 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
                >
                  <option value="positive" className="text-green-600">😎 Positive</option>
                  <option value="neutral" className="text-yellow-600">🤔 Neutral</option>
                  <option value="negative" className="text-red-500">😨 Negative</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Note"
                    value={checklist[item].comment}
                    onChange={(e) =>
                      handleChecklistChange(item, "comment", e.target.value)
                    }
                    className="p-2 border rounded text-[var(--color-text)] w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
