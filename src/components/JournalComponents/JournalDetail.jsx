import { motion } from "framer-motion";
import BuyJournalSummary from "./BuyJournalSummary";
import ReasonJournalCard from "./ReasonJournalCard";
import GenericTimelineCard from "./GenericTimelineCard";
import InfoCard from "./InfoCard";
import SellReasonReviewCard from "./SellReasonReviewCard";
import SellEvaluationCard from "./SellEvaluationCard";
import { useState, useEffect } from "react";

export default function JournalDetail({ selected, onAddEntry }) {
  const [sellEvaluation, setSellEvaluation] = useState(selected?.sellEvaluation || {});

  useEffect(() => {
    setSellEvaluation(selected?.sellEvaluation || {});
  }, [selected]);

  const handleSellEvaluationChange = (newEvaluation) => {
    setSellEvaluation(newEvaluation);
  };

  if (!selected) return null;

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
      {selected.isEntry ? (
        <div className="flex flex-wrap gap-[2%] w-full">
          <BuyJournalSummary
            name={selected.stock}
            ticker={selected.ticker}
            shares={selected.shares}
            buyPrice={selected.entryPrice}
            currentPrice={selected.currentPrice}
            date={selected.entryDate}
          />

          <ReasonJournalCard
            checklist={selected.checklist || {}}
            useWeightedScoring
          />

          <GenericTimelineCard
            title="Mood Log"
            field="moodLog"
            entries={ [...selected.moodLog].reverse()|| []}
            onAddEntry={onAddEntry}
            showEmojiPicker={true}
            hasLabel={true}
            renderHeader={(entry) => entry.label}
            renderSubLabel={(entry) => entry.subLabel}
            renderContent={(entry) => entry.content}
          />

          <GenericTimelineCard
            title="Future Expectation"
            field="expectations"
            entries={[...selected.expectations].reverse()|| []}
            onAddEntry={onAddEntry}
            showEmojiPicker={false}
            hasLabel={false}
            renderHeader={(entry) => entry.label}
            renderSubLabel={(entry) => entry.subLabel}
            renderContent={(entry) => entry.content}
          />

          <InfoCard title="Exit Plan" entry={selected.exitPlan || []} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-[2%] w-full">
          <BuyJournalSummary
            name={selected.stock}
            ticker={selected.ticker}
            shares={selected.shares}
            buyPrice={selected.entryPrice || selected.exitPrice}
            currentPrice={selected.currentPrice}
            date={selected.entryDate || selected.exitDate}
          />

          <SellReasonReviewCard
            checklistReview={selected.checklistReview || {}}
            checklist={selected.checklist || {}}
          />

          <InfoCard title="Exit Summary" entry={selected.exitSummary || []} />

          <InfoCard
            title="Trade Reflection"
            entry={
              selected.tradeReflection
                ? [{ content: selected.tradeReflection }]
                : []
            }
          />

          <SellEvaluationCard
            initialData={sellEvaluation}
            onChange={handleSellEvaluationChange}
          />
        </div>
      )}
    </motion.div>
  );
}
