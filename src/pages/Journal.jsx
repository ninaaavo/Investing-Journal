import { useState } from "react";
import { motion } from "framer-motion";
import { AnimatePresence } from "framer-motion";
import JournalSidebar from "../components/JournalSideBar";
import JournalDetail from "../components/JournalDetail";

const mockEntries = [
  {
    id: 16,
    stock: "Apple Inc.",
    ticker: "AAPL",
    type: "Buy",
    date: "Apr 20, 2024",
  },
  {
    id: 15,
    stock: "Google",
    ticker: "GOOGL",
    type: "Buy",
    date: "Feb 15, 2024",
  },
  {
    id: 14,
    stock: "Microsoft",
    ticker: "MSFT",
    type: "Sell",
    date: "Apr 10, 2024",
  },
  { id: 13, stock: "Tesla", ticker: "TSLA", type: "Buy", date: "Jan 30, 2024" },
  { id: 12, stock: "Amazon", ticker: "AMZN", type: "Buy", date: "Jan 5, 2024" },
  {
    id: 11,
    stock: "Google",
    ticker: "GOOGL",
    type: "Buy",
    date: "Feb 15, 2024",
  },
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
        className="overflow-y-auto"
      >
        <AnimatePresence mode="wait" initial={false}>
          <JournalDetail key={selected.id} selected={selected} />
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
