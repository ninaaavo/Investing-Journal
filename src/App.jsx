import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes";
import NavBar from "./components/NavBar";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect } from "react";
import { getDateStr } from "./utils/getDateStr";
import { UserProvider, useUser } from "./context/UserContext";
import { maybeRunDailyHoldingUpdate } from "./utils/maybeRunDailyHoldingUpdate";
import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
  collection,
  query,
  orderBy,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import { retryRefetchQueue } from "./utils/retryRefetchQueue";

function AppContent() {
  const { user, loading, refreshSnapshot } = useUser();

  // Kick off any queued refetch work once we have a user
  useEffect(() => {
    if (user?.uid) retryRefetchQueue(user.uid);
  }, [user?.uid]);

  // Init today's realized P/L doc (if missing) and run daily holding update
  useEffect(() => {
    if (!user?.uid) return;

    (async () => {
      const today = getDateStr();

      // Ensure today's realized P/L doc exists (carry forward previous value)
      const realizedPLRef = doc(db, "users", user.uid, "realizedPLByDate", today);
      const plDoc = await getDoc(realizedPLRef);

      if (!plDoc.exists()) {
        const previousPL = await getMostRecentRealizedPL(user.uid, today);
        await setDoc(realizedPLRef, {
          realizedPL: previousPL,
          date: today,
          createdAt: Timestamp.now(),
        });
      }

      // Daily holding duration update
      await maybeRunDailyHoldingUpdate(user.uid, today);
    })();

    async function getMostRecentRealizedPL(userId, todayStr) {
      const colRef = collection(db, "users", userId, "realizedPLByDate");
      const q = query(colRef, where("date", "<", todayStr), orderBy("date", "desc"));
      const snap = await getDocs(q);
      return snap.empty ? 0 : snap.docs[0].data().realizedPL;
    }
  }, [user?.uid]);

  // Schedule midnight rollover: re-run holding update + refresh LIVE snapshot from context
  useEffect(() => {
    if (!user?.uid) return;

    const scheduleMidnightUpdate = (uid) => {
      const now = new Date();
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 5, 0); // 12:00:05 AM buffer
      const msUntilMidnight = nextMidnight - now;

      const timer = setTimeout(async () => {
        const today = getDateStr();

        await maybeRunDailyHoldingUpdate(uid, today);

        // Re-fetch LIVE snapshot via context (no DB generation for "today")
        try {
          await refreshSnapshot();
        } catch (e) {
          console.error("Midnight refresh failed:", e);
        }

        toast.success("✅ Portfolio updated for the new day", { position: "bottom-right" });

        // Schedule the next day
        scheduleMidnightUpdate(uid);
      }, msUntilMidnight);

      return () => clearTimeout(timer);
    };

    const cleanup = scheduleMidnightUpdate(user.uid);
    return cleanup;
  }, [user?.uid, refreshSnapshot]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#b2dfdb] via-[#a5d6a7] to-[#dcedc8] text-[var(--color-text)] overflow-y-hidden">
        <p className="text-xl font-semibold">Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter className="overflow-hidden">
      <ToastContainer position="top-center" autoClose={2000} />
      <div className="min-h-screen bg-gradient-to-r from-[#b2dfdb] via-[#a5d6a7] to-[#dcedc8] bg-[length:200%_200%] animate-gradient-x px-[60px] py-[30px] text-[var(--color-text)]">
        <div className="flex flex-col gap-4">
          {/* NavBar can keep accepting user as prop if it expects it */}
          <NavBar user={user} />
          <AppRoutes />
        </div>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}

export default App;
