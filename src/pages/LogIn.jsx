import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, provider, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleEmailLogin = async (e) => {
    e.preventDefault(); // prevent form reload
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;
      console.log("Email login success:", user.uid);
      navigate("/profile");
    } catch (error) {
      console.error("Email login error:", error.message);
    }
  };

 const handleGoogleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const initialChecklistLabels = [
        "Graph pattern",
        "Candle pattern",
        "Key level",
        "EMA50",
        "RSI",
      ];

      const preferredChecklist = initialChecklistLabels.reduce((acc, label) => {
        acc[label] = { weight: 1 };
        return acc;
      }, {});

      await setDoc(userRef, {
        name: user.displayName || "",
        email: user.email,
        profilePicture: user.photoURL || "",
        createdAt: new Date(),
        preferredChecklist,
      });
    }

    navigate("/profile");
  } catch (error) {
    console.error("Google login error:", error.message);
  }
};


  return (
    <div className="flex flex-col justify-center items-center flex h-[calc(100vh-150px)] space-y-6 ">
      <div className="flex flex-col justify-center items-center w-lg bg-[var(--color-background)] rounded-xl p-6 shadow-lg">
        <div className="text-center mb-6 pt-4">
          <h1 className="text-4xl font-bold">Log in to your account</h1>
          <p className="mt-1 text-sm opacity-80 p-4">
            Welcome back! Please enter your details.
          </p>
        </div>

        <form className="w-full max-w-sm space-y-4" onSubmit={handleEmailLogin}>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:bg-[var(--color-nav-background)]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:bg-[var(--color-nav-background)]"
              required
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--color-text)]" />
              Remember me
            </label>
            <a href="#" className="hover:underline">
              Forgot password
            </a>
          </div>

          <button
            type="submit"
            className="w-full bg-[var(--color-text)] text-white py-2 rounded-md hover:opacity-80 transition"
          >
            Sign in
          </button>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full border border-gray-300 py-2 rounded-md flex items-center justify-center gap-2 hover:bg-[var(--color-nav-background)] transition"
          >
            <span className="text-lg">G</span> Sign in with Google
          </button>
        </form>

        <p className="mt-6 text-sm">
          Don’t have an account?{" "}
          <span
            onClick={() => navigate("/signup")}
            className="font-medium hover:underline cursor-pointer"
          >
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}
