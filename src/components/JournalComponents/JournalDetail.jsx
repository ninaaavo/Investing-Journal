import { motion } from "framer-motion";
import { useState } from "react";
import BuyJournalSummary from "./BuyJournalSummary";
import CheckCard from "./CheckCard";
import ReasonJournalCard from "./ReasonJournalCard";
import MoodTimelineCard from "./MoodTimelineCard";
import GenericTimelineCard from "./GenericTimelineCard";
import { Check } from "lucide-react";
import ExitDecisionCard from "./ExitDecisionCard";

export default function JournalDetail({ selected }) {

  const [moodLogs, setMoodLogs] = useState([
    {
      label: "😊 Calm",
      content:
        "This trade feels steady — my plan is clear, and the risk is managed.",
      timestamp: "2025-06-24T14:20:00Z",
    },
    {
      label: "😰 Anxious",
      content: "I wasn’t sure about the market open — it felt volatile.",
      timestamp: "2025-06-24T13:00:00Z",
    },
  ]);
  const [expectLogs, setExpectLogs] = useState(

  [
  {
    content: "I expect the stock to bounce off the support level and trend upward within a week.",
    timestamp: "2025-06-20T09:30:00Z"
  },
  {
    content: "Possibly a short-term breakout after earnings next Tuesday.",
    timestamp: "2025-06-22T13:15:00Z"
  },
  {
    content: "Market sentiment is recovering, could see a 5% climb over the next 10 days.",
    timestamp: "2025-06-23T10:05:00Z"
  },
  {
    content: "Momentum is slowing down; I think it will consolidate for a while.",
    timestamp: "2025-06-24T16:45:00Z"
  },
  {
    content: "If it holds above the moving average, I’ll expect an uptrend by end of the week.",
    timestamp: "2025-06-25T08:55:00Z"
  }
]);
const sampleExitEntry = {
  stopLoss: "182",
  lossPercent: "-2.5%",
  reason: "Placed just under the rising trendline to avoid fakeouts and preserve capital.",
  targetPrice: "195",
  rrRatio: "2.6",
  timestamp: "2025-06-25T10:45:00Z"
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
        <ReasonJournalCard checklist={checklist} useWeightedScoring={true} />
        <GenericTimelineCard
          title="Mood Log"
          entries={moodLogs}
          onAddEntry={(entry) => setMoodLogs([entry, ...moodLogs])}
          showEmojiPicker={true}
          hasLabel = {true}
          renderHeader={(entry) => entry.label}
          renderSubLabel={(entry) => entry.subLabel}
          renderContent={(entry) => entry.content}
        />

        <GenericTimelineCard
          title="Future Expectation"
          entries={expectLogs}
          onAddEntry={(entry) => setExpectLogs([entry, ...expectLogs])}
          showEmojiPicker={false}
          hasLabel={false}
          renderHeader={(entry) => entry.label}
          renderSubLabel={(entry) => entry.subLabel}
          renderContent={(entry) => entry.content}
        />

      <ExitDecisionCard title="Exit Plan" entry={sampleExitEntry} />

      </div>
    </motion.div>
  );
}
