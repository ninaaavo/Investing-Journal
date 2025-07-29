import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes";
import NavBar from "./components/NavBar";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import getOrGenerateSnapshot from "./utils/snapshot/getOrGenerateSnapshot";
import { getDateStr } from "./utils/getDateStr";
import { UserProvider } from "./context/UserContext";

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [todaySnapshot, setTodaySnapshot] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);

      if (currentUser) {
        const today = getDateStr();
        const snap = await getOrGenerateSnapshot(today);
        setTodaySnapshot(snap);
      }
    });
    return () => unsub();
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#b2dfdb] via-[#a5d6a7] to-[#dcedc8] text-[var(--color-text)] overflow-y-hidden">
        <p className="text-xl font-semibold">Loading...</p>
      </div>
    );
  }

  return (
    <UserProvider value={{ user, todaySnapshot }}>
      <BrowserRouter className="overflow-hidden">
        <ToastContainer position="top-center" autoClose={2000} />

        <div className="min-h-screen bg-gradient-to-r from-[#b2dfdb] via-[#a5d6a7] to-[#dcedc8] bg-[length:200%_200%] animate-gradient-x px-[60px] py-[30px] text-[var(--color-text)]">
          <div className="flex flex-col gap-4">
            <NavBar user={user} />
            <AppRoutes />
          </div>
        </div>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;
