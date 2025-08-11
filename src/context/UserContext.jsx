import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { getCachedLiveSnapshot } from "../utils/snapshot/getCachedLiveSnapshot";
import { calculateLiveSnapshot } from "../utils/snapshot/calculateLiveSnapshot"; // live, uncached (server reads)

const UserContext = createContext(undefined);
export const useUser = () => useContext(UserContext);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [todaySnapshot, setTodaySnapshot] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(0);

  // Optional manual trigger (kept for backwards compat)
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const incrementRefresh = () => setRefreshTrigger((prev) => prev + 1);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Helper: market hours (approx)
  const isMarketOpenNow = () => {
    const now = new Date();
    const day = now.getUTCDay();      // Mon=1..Fri=5
    const hours = now.getUTCHours();  // 13–20 UTC ~ 9:00–16:59 ET
    return day >= 1 && day <= 5 && hours >= 13 && hours <= 20;
  };

  // Core fetch (cached vs live)
  const fetchSnapshot = useCallback(
    async (forceLive = false) => {
      if (!user?.uid) return null;
      try {
        const snap = forceLive
          ? await calculateLiveSnapshot()              // force fresh compute (server reads)
          : await getCachedLiveSnapshot(user.uid);     // cached (and compute if stale)
        if (!mountedRef.current) return null;
        setTodaySnapshot(snap);
        setLastUpdated(Date.now());
        return snap;
      } catch (err) {
        console.error("fetchSnapshot failed:", err);
        return null;
      }
    },
    [user?.uid]
  );

  // 🔒 Absolute force-refresh for forms after writes (bypass everything)
  const forceLiveSnapshotNow = useCallback(async () => {
    if (!user?.uid) return null;
    try {
      const snap = await calculateLiveSnapshot(); // always server reads
      if (!mountedRef.current) return null;
      setTodaySnapshot(snap);
      setLastUpdated(Date.now());
      return snap;
    } catch (err) {
      console.error("forceLiveSnapshotNow failed:", err);
      return null;
    }
  }, [user?.uid]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Initial + 15-min polling during market hours (cached)
  useEffect(() => {
    if (!user?.uid) return;

    // initial fetch once user is ready
    fetchSnapshot();

    const id = setInterval(() => {
      if (isMarketOpenNow()) fetchSnapshot();
    }, 15 * 60 * 1000);

    return () => clearInterval(id);
  }, [user?.uid, fetchSnapshot]);

  // Refresh when tab becomes visible during market hours (cached)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && isMarketOpenNow()) {
        fetchSnapshot();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchSnapshot]);

  // Manual refresh trigger → force live
  useEffect(() => {
    if (!user?.uid) return;
    fetchSnapshot(true); // force live on manual refresh
  }, [refreshTrigger, user?.uid, fetchSnapshot]);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        todaySnapshot,
        lastUpdated,

        // legacy/manual trigger
        refreshTrigger,
        incrementRefresh,

        // expose refreshers
        refreshSnapshot: () => fetchSnapshot(true), // force live (with context update)
        forceLiveSnapshotNow,                       // strongest: direct live recompute for forms
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
