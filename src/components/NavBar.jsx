import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

export default function NavBar() {
  const { pathname } = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  const navLinkClass = (path) =>
    `px-4 py-2 rounded-md hover:bg-muted transition ${
      pathname === path ? "bg-muted font-semibold" : "text-gray-600"
    }`;

  console.log("im nav bar, user is", user)
  return (
    <div>
      {user && (
        <nav className="bg-[var(--color-nav-background)] px-12 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">📈 InvestLog</h1>

            <div className="flex space-x-4">
              <Link to="/profile" className={navLinkClass("/profile")}>
                Profile
              </Link>
              <Link to="/positions" className={navLinkClass("/positions")}>
                My Positions
              </Link>
              <Link to="/journal" className={navLinkClass("/journal")}>
                Journal
              </Link>
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
