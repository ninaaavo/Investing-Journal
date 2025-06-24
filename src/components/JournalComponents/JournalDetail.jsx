import { motion } from "framer-motion";
import { useState } from "react";
import BuyJournalSummary from "./BuyJournalSummary";
import CheckCard from "./CheckCard";
import ReasonJournalCard from "./ReasonJournalCard";
import MoodTimelineCard from "./MoodTimelineCard";

export default function JournalDetail({ selected }) {
  const [moodLogs, setMoodLogs] = useState([
  {
    mood: "😊 Calm",
    reason: "This trade feels steady — my plan is clear, and the risk is managed.",
    timestamp: "2025-06-24T14:20:00Z",
  },
  {
    mood: "😰 Anxious",
    reason: "I wasn’t sure about the market open — it felt volatile.",
    timestamp: "2025-06-24T13:00:00Z",
  },
]);

const handleAddMood = (newEntry) => {
  setMoodLogs((prev) => [newEntry, ...prev]);
};
  const checklist = {
    "Graph pattern": {
      value: "positive",
      comment: "Double bottoms near support zone",
      weight: 4,
    },
    "Candle pattern": {
      value: "positive",
      comment: "3 white soldiers after consolidation",
      weight: 2,
    },
    "Key level": {
      value: "negative",
      comment: "Resistance zone around 125",
      weight: 1,
    },
    EMA50: {
      value: "neutral",
      comment: "Price hovering slightly above",
      weight: 1,
    },
    RSI: {
      value: "neutral",
      comment: "Near 50 — no clear signal",
      weight: 1,
    },
    "Volume spike": {
      value: "positive",
      comment: "Unusual high volume on green candle",
      weight: 3,
    },
    "News sentiment": {
      value: "negative",
      comment: "Market uncertainty due to earnings report",
      weight: 2,
    },
  };

  return (
    <motion.div
      initial={{ x: 10, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -10, opacity: 0 }}
      transition={{
        duration: 0.2,
        ease: "easeOut",
        layout: { duration: 0.4, ease: [0.25, 0.8, 0.25, 1] },
      }}
      layout
      className="flex-1 bg-white p-8 pt-4 rounded-l-xl w-full"
    >
      <div className="flex flex-wrap gap-[2%] justify-between w-full">
        <BuyJournalSummary
          name={selected.stock}
          ticker={selected.ticker}
          shares={10}
          buyPrice={150}
          currentPrice={175}
          date={"12:05 pm - May 23, 2025"}
        />
        <ReasonJournalCard checklist={checklist}   useWeightedScoring={true}
 />
<MoodTimelineCard
  title="Mood Log"
  moodLogs={moodLogs}
  onAddMood={handleAddMood}
/>
        
        

        <CheckCard
          title="Technical Signals"
          criteria={[
            {
              type: "check",
              text: "Within 10% of 52-wk high?",
              checked: true,
            },
            {
              type: "check",
              text: "Above 200 day moving average?",
              checked: true,
            },
            {
              type: "check",
              text: "Trend upward last 3-6 months?",
              checked: false,
            },
            {
              type: "check",
              text: "Has momentum, not stalling?",
              checked: true,
            },
            {
              type: "check",
              text: "Can you make these editable pweease?",
              checked: false,
            },
          ]}
        />

        <CheckCard
          title="Personal Consideration"
          criteria={[
            {
              type: "check",
              text: "I am calm. (No i fuckin am not)",
              checked: true,
            },
            {
              type: "check",
              text: "I am not driven by greed or fear",
              checked: true,
            },
            {
              type: "check",
              text: "This is not retaliation to last lost.",
              checked: false,
            },
            {
              type: "check",
              text: "I believe in the company, not hype.",
              checked: true,
            },
          ]}
        />

        <CheckCard
          title="Profit & Risk"
          criteria={[
            { type: "field", text: "I will sell at ___% profit.", value: 20 },
            { type: "field", text: "I will sell at ___% risk.", value: 2 },
            {
              type: "field",
              text: "(Setting R/R ratio at 10:1 for trading is kinda meh btw)",
              value: "",
            },
          ]}
        />
      </div>
    </motion.div>
  );
}
