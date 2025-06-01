import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import "react-toastify/dist/ReactToastify.css";

export default function Profile() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully!", {
        position: "top-center",
        autoClose: 1500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      navigate("/#");
    } catch (error) {
      toast.error("Failed to log out.");
    }
  };

  return (
    <motion.div
      key="profile"
      
      className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] bg-[var(--color-background)] p-6 rounded-xl shadow-xl text-[var(--color-text)]"
    >
      <h1 className="text-3xl font-bold mb-4">
        Hello, {user?.displayName || "Investor"} 👋
      </h1>

      <p className="mb-6 text-center text-sm opacity-80">
        Welcome to your profile dashboard. You can manage your account or continue investing.
      </p>

      <button
        onClick={handleLogout}
        className="bg-white text-red-500 px-6 py-2 rounded-md border border-red-400 hover:opacity-80 transition"
      >
        Log Out
      </button>
    </motion.div>
  );
}
  