import { motion } from "framer-motion";
import BuyJournalSummary from "./BuyJournalSummary";
import CheckCard from "./CheckCard";
import ReasonJournalCard from "./ReasonJournalCard";

export default function JournalDetail({ selected }) {
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
      className="flex-1 bg-white p-8 pt-4 rounded-l-xl"
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
        <CheckCard
          title="Company Quality"
          criteria={[
            {
              type: "check",
              text: "Make these optional :D, do i really need this for just short-term trade?",
              checked: true,
            },
            {
              type: "check",
              text: "well then how about different sets of question for trade and invest :D",
              checked: true,
            },
            {
              type: "check",
              text: "How about for technical traders, who cares mostly about graphs",
              checked: false,
            },
            {
              type: "check",
              text: "Blue chip or well-established?",
              checked: true,
            },
            {
              type: "check",
              text: "Consistently profitable & growing revenue?",
              checked: true,
            },
            {
              type: "check",
              text: "Have strong brand, product, or competitive edge?",
              checked: false,
            },
            {
              type: "check",
              text: "No major negative news recently?",
              checked: true,
            },
          ]}
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
