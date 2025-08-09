import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { getCachedLiveSnapshot } from "../utils/snapshot/getCachedLiveSnapshot";

const UserContext = createContext();
export const useUser = () => useContext(UserContext);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [todaySnapshot, setTodaySnapshot] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(0);

  // 🆕 Refresh trigger state
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const incrementRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // 🆕 Fetch the snapshot
  const fetchSnapshot = async () => {
    if (!user?.uid) return;
    const snap = await getCachedLiveSnapshot(user.uid);
    setTodaySnapshot(snap);
    setLastUpdated(Date.now());
  };

  // Fetch snapshot on login and every 15 mins if market is open
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    fetchSnapshot(); // initial fetch

    const interval = setInterval(() => {
      const now = new Date();
      const hours = now.getUTCHours();
      const day = now.getUTCDay();

      const isMarketOpen = day >= 1 && day <= 5 && hours >= 13 && hours <= 20;

      if (isMarketOpen) fetchSnapshot(); // refresh every 15 mins
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
  }, [user?.uid]);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        refreshTrigger,
        incrementRefresh,
        todaySnapshot,
        refreshSnapshot: fetchSnapshot,
        lastUpdated,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
