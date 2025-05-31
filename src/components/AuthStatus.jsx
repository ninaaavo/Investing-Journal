import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function AuthStatus() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub(); // clean up on unmount
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-[var(--color-nav-background)] rounded-xl mb-4">
      {user ? (
        <>
          <p className="text-[var(--color-text)] text-sm font-medium">
            Hello, {user.displayName || "User"} 👋
          </p>
          <button
            onClick={handleLogout}
            className="text-sm text-white bg-red-500 px-3 py-1 rounded hover:opacity-80 transition"
          >
            Log Out
          </button>
        </>
      ) : (
        <p className="text-[var(--color-text)] text-sm">Not signed in</p>
      )}
    </div>
  );
}
