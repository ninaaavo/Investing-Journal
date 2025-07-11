import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import JournalSidebar from "../components/JournalComponents/JournalSidebar";
import JournalDetail from "../components/JournalComponents/JournalDetail";
import { useSearchParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase"; // adjust path as needed
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export default function Journal() {
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTicker = searchParams.get("ticker") || "";
  const formSell = searchParams.get("type") === "sell";

  useEffect(() => {
    const fetchEntries = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const journalRef = collection(db, "users", user.uid, "journalEntries");
      const q = query(journalRef, orderBy("createdAt", "desc"));

      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const formatted = fetched.map((entry, i) => ({
        id: entry.id || i,
        stock: entry.companyName || entry.ticker || "Unknown",
        ticker: entry.ticker,
        type: entry.journalType,
        date: entry.entryDate || entry.exitDate ,
        ...entry,
      }));

      setEntries(formatted);
      if (formatted.length > 0) setSelected(formatted[0]);
    };

    fetchEntries();
  }, []);

  return (
    <motion.div
      key="journal"
      className="grid grid-cols-[1.5fr_5fr] gap-4 h-[calc(100vh-150px)] bg-[var(--color-background)] rounded-xl overflow-hidden shadow-lg"
    >
      {/* Left side: Journal List */}
      <JournalSidebar
        entries={entries}
        selected={selected}
        onSelect={setSelected}
        initialTicker={initialTicker}
        formSell={formSell}
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
        className="overflow-y-auto overflow-x-hidden relative"
      >
        <AnimatePresence mode="wait" initial={false}>
          {selected && <JournalDetail key={selected.id} selected={selected} isEntry={(selected.direction==="long" && selected.journalType==="buy") || (selected.direction==="short" && selected.journalType==="sell")}/>}
        </AnimatePresence>

        {formSell && (
          <div className="absolute top-4 right-4 bg-white border border-gray-300 p-3 rounded-lg shadow-md text-sm z-50">
            <p className="mb-2">Done reviewing past trades?</p>
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-1 bg-[var(--color-primary)] text-white rounded hover:opacity-90"
            >
              Return to Exit Form
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
