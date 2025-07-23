import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import JournalSidebar from "../components/JournalComponents/JournalSidebar";
import JournalDetail from "../components/JournalComponents/JournalDetail";
import { useSearchParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

export default function Journal() {
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialTicker = searchParams.get("ticker") || "";
  const initialType = searchParams.get("type") || "";
  const initialStatus = searchParams.get("status") || "";
  const initialDirection = searchParams.get("direction") || "";
  const selectedId = searchParams.get("id") || "";

  const handleSellEvaluationChange = async (field, newValue) => {
    const user = auth.currentUser;
    if (!user || !selected?.id) return;

    const currentValue = selected?.sellEvaluation?.[field];
    if (currentValue === newValue) return;

    try {
      const docRef = doc(db, "users", user.uid, "journalEntries", selected.id);

      setSelected((prev) => ({
        ...prev,
        sellEvaluation: {
          ...(prev.sellEvaluation || {}),
          [field]: newValue,
        },
      }));

      await updateDoc(docRef, {
        [`sellEvaluation.${field}`]: newValue,
      });
    } catch (err) {
      console.error(`Failed to update sellEvaluation.${field}:`, err);
      alert("Failed to update data.");
    }
  };

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
        date: entry.entryDate || entry.exitDate,
        ...entry,
      }));

      setEntries(formatted);
      const selectedEntry = formatted.find((entry) => entry.id === selectedId);
      setSelected(selectedEntry || formatted[0]);
    };

    fetchEntries();
  }, []);

  useEffect(() => {
    const updateSelectedFromURL = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const id = searchParams.get("id");
      if (!id) return;

      try {
        const docRef = doc(db, "users", user.uid, "journalEntries", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSelected({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Failed to fetch entry from URL:", error);
      }
    };

    updateSelectedFromURL();
  }, [searchParams]);

  const handleAddEntry = async (entry, field) => {
    const user = auth.currentUser;
    if (!user || !selected?.id) return;

    try {
      const docRef = doc(db, "users", user.uid, "journalEntries", selected.id);

      setSelected((prev) => ({
        ...prev,
        [field]: [...(prev?.[field] || []), entry],
      }));

      await updateDoc(docRef, {
        [field]: arrayUnion(entry),
      });
    } catch (err) {
      console.error(`Failed to add ${field} entry:`, err);
      alert("Failed to save entry.");
    }
  };

  return (
    <motion.div
      key="journal"
      className="grid grid-cols-[1.5fr_5fr] gap-4 h-[calc(100vh-150px)] bg-[var(--color-background)] rounded-xl overflow-hidden shadow-lg"
    >
      {/* Left side: Journal List */}
      <JournalSidebar
        entries={entries}
        selected={selected}
        onSelect={async (entry) => {
          const user = auth.currentUser;
          if (!user || !entry?.id) return;

          try {
            const docRef = doc(
              db,
              "users",
              user.uid,
              "journalEntries",
              entry.id
            );
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setSelected({ id: docSnap.id, ...docSnap.data() });
              const queryParams = new URLSearchParams({
                ...(initialTicker && { ticker: initialTicker }),
                ...(initialType && { type: initialType }),
                ...(initialStatus && { status: initialStatus }),
                ...(initialDirection && { direction: initialDirection }),
                id: entry.id,
              });

              navigate(`/journal?${queryParams.toString()}`);
            }
          } catch (error) {
            console.error("Failed to fetch selected entry:", error);
          }
        }}
        initialTicker={initialTicker}
        initialType={initialType}
        initialStatus={initialStatus}
        initialDirection={initialDirection}
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
          {selected && (
            <JournalDetail
              key={selected.id}
              selected={selected}
              onAddEntry={handleAddEntry}
              handleSellEvaluationChange={handleSellEvaluationChange}
            />
          )}
        </AnimatePresence>

        {/* {initialType === "sell" && (
          <div className="absolute top-4 right-4 bg-white border border-gray-300 p-3 rounded-lg shadow-md text-sm z-50">
            <p className="mb-2">Done reviewing past trades?</p>
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-1 bg-[var(--color-primary)] text-white rounded hover:opacity-90"
            >
              Return to Exit Form
            </button>
          </div>
        )} */}
      </motion.div>
    </motion.div>
  );
}
