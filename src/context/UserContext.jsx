// src/context/UserContext.js
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

const UserContext = createContext();
export const useUser = () => useContext(UserContext);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🆕 Refresh trigger state
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 🆕 Function to manually trigger refresh
  const incrementRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        refreshTrigger,      // 🆕 expose this
        incrementRefresh,     // 🆕 expose this
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
