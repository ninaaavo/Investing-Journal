// NavBar.jsx
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

export default function NavBar({ user }) {
  const { pathname } = useLocation();

  const links = [
    { to: "/profile", label: "Profile" },
    { to: "/positions", label: "My Positions" },
    { to: "/journal", label: "Journal" },
  ];

  if (!user) return null;

  return (
    <motion.nav
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="bg-white px-6 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl w-[400px]">
          ⊹ ࣪ ˖ Hello there,{" "}
          <span className="font-medium">
            {user.displayName?.split(" ")[0]}
          </span>
        </h1>
        <h1 className="text-3xl font-light tracking-widest">I N V E S T L O G</h1>

        <div className="flex space-x-6 relative justify-end w-[400px]">
          {links.map(({ to, label }) => (
            <div key={to} className="relative">
              <Link
                to={to}
                className={`px-4 py-2 transition text-gray-600 ${
                  pathname === to ? "text-black" : "hover:text-black"
                }`}
              >
                {label}
              </Link>
              {pathname === to && (
                <motion.div
                  layoutId="nav-underline"
                  className="absolute left-0 right-0 -bottom-1 h-[1px] bg-[var(--color-text)] rounded"
                  transition={{ type: "spring", stiffness: 200, damping: 23 }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.nav>
  );
}
