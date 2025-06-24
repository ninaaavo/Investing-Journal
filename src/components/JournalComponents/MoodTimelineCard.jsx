import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EmojiSelector from "./EmojiSelector";
import { Plus, X } from "lucide-react";

export default function MoodTimelineCard({
  title = "Mood Log",
  moodLogs = [],
  onAddMood,
}) {
  const [newMood, setNewMood] = useState("");
    const [emoji, setEmoji] = useState("😊");

  const [newReason, setNewReason] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleSubmit = () => {
    if (newMood && newReason) {
      onAddMood({
        mood: `${emoji} ${newMood}`,
        reason: newReason,
        timestamp: new Date().toISOString(),
      });
      setNewMood("");
      setNewReason("");
      setShowInput(false);
    }
  };

  return (
    <div className="p-8 mt-4 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl w-[calc(32%)] h-[300px] scroll-stable overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-primary">{title}</h2>
        <button
          className="text-blue-600 text-sm hover:underline flex items-center gap-1"
          onClick={() => setShowInput((prev) => !prev)}
        >
          {showInput ? (
            <>
              <X className="w-4 h-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Add
            </>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showInput ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            <div className="relative w-full">
                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                <EmojiSelector
                  onSelect={(emoji) => setEmoji(emoji)}
                  defaultEmoji={newMood || "😊"}
                />
              </div>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 pl-9 pt-1.5 pb-1 pr-10 text-md font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Mood (e.g., Calm)"
                value={newMood}
                onChange={(e) => setNewMood(e.target.value)}
              />

              
            </div>

            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-1 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              rows={2}
              placeholder="Why do you feel this way?"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="text-sm bg-primary px-3 py-1 rounded hover:opacity-90"
                onClick={handleSubmit}
              >
                Submit
              </button>
              <button
                className="text-sm text-gray-500 hover:underline"
                onClick={() => setShowInput(false)}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="log"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            {moodLogs.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 text-lg font-medium text-primary">
                  {moodLogs[0].mood}{" "}
                  <span className="text-sm text-gray-400">
                    • {new Date(moodLogs[0].timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text)] leading-snug mt-1">
                  {moodLogs[0].reason}
                </p>
              </div>
            )}

            <ul className="space-y-3 border-t border-gray-200 pt-3">
              {moodLogs.slice(1).map((entry, index) => (
                <li key={index} className="text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    {entry.mood}{" "}
                    <span className="text-xs text-gray-400">
                      • {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mt-0.5">
                    {entry.reason}
                  </p>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
