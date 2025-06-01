import { useState } from "react";
import { motion } from "framer-motion";
import CheckCard from "../components/CheckCard";
import BuyJournalSummary from "../components/BuyJournalSummary";
import JournalSidebar from "../components/JournalSideBar";

const mockEntries = [
  {
    id: 10,
    stock: "Apple Inc.",
    ticker: "AAPL",
    type: "Buy",
    date: "Apr 20, 2024",
  },
  {
    id: 9,
    stock: "Google",
    ticker: "GOOGL",
    type: "Buy",
    date: "Feb 15, 2024",
  },
  {
    id: 8,
    stock: "Microsoft",
    ticker: "MSFT",
    type: "Sell",
    date: "Apr 10, 2024",
  },
  { id: 7, stock: "Tesla", ticker: "TSLA", type: "Buy", date: "Jan 30, 2024" },
  { id: 6, stock: "Amazon", ticker: "AMZN", type: "Buy", date: "Jan 5, 2024" },
  {
    id: 5,
    stock: "Google",
    ticker: "GOOGL",
    type: "Buy",
    date: "Feb 15, 2024",
  },
  { id: 4, stock: "Tesla", ticker: "TSLA", type: "Buy", date: "Jan 30, 2024" },
  { id: 3, stock: "Amazon", ticker: "AMZN", type: "Buy", date: "Jan 5, 2024" },
  {
    id: 2,
    stock: "Google",
    ticker: "GOOGL",
    type: "Buy",
    date: "Feb 15, 2024",
  },
  { id: 1, stock: "Tesla", ticker: "TSLA", type: "Buy", date: "Jan 30, 2024" },
  { id: 0, stock: "Amazon", ticker: "AMZN", type: "Buy", date: "Jan 5, 2024" },
];

export default function Journal() {
  const [selected, setSelected] = useState(mockEntries[0]);
  const [filters, setFilters] = useState({
    stock: "",
    type: "",
    fromDate: "",
    toDate: "",
  });

  return (
    <motion.div
      key="journal"
      className="flex h-[calc(100vh-150px)] bg-[var(--color-background)] rounded-xl overflow-hidden shadow-lg"
    >
      {/* Left side: Journal List */}
      <JournalSidebar
        entries={mockEntries}
        selected={selected}
        onSelect={setSelected}
        filters={filters}
        onFilterChange={setFilters}
      />

      {/* Right side: Journal Detail */}
      <div className="flex-1 bg-white p-8 rounded-l-xl overflow-y-auto">
        <div className="flex flex-wrap gap-4">
          <BuyJournalSummary
            name={selected.stock}
            ticker={selected.ticker}
            shares={10}
            buyPrice={150}
            currentPrice={175}
            date={"12:05 pm - May 23, 2025"}
          />
          <CheckCard
            title={"Company Quality"}
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
            title={"Technical Signals"}
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
      </div>
    </motion.div>
  );
}
