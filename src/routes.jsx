import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Login from "./pages/Login";
import Positions from "./pages/Positions";
import Journal from "./pages/Journal";
import SignUp from "./pages/Signup";
import Profile from "./pages/Profile";
import RedirectHandler from "./components/RedirectHandler";
import Playground from "./pages/Playground";

export default function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/positions"
          element={
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Positions />
            </motion.div>
          }
        />
        <Route
          path="/journal"
          element={
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Journal />
            </motion.div>
          }
        />
        <Route path="/" element={<RedirectHandler />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/profile" element={ <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Profile />
            </motion.div>} />
        <Route path="/playground" element={<Playground />} />
      </Routes>
    </AnimatePresence>
  );
}
