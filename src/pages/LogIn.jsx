import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { auth, provider } from "../firebase";

export default function Login() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const hasRedirected = useRef(false); // 👈 to prevent multiple redirects

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        navigate("/profile"); // redirect to profile
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const toSignUp = () => navigate("/signup");

  return (
    <div className="flex flex-col justify-center items-center flex h-[calc(100vh-150px)] space-y-6 ">
      <div className=" flex flex-col justify-center items-center w-lg bg-[var(--color-background)] rounded-xl p-6 shadow-lg">
        {/* Heading */}
        <div className="text-center mb-6 pt-4">
          <h1 className="text-4xl font-bold">Log in to your account</h1>
          <p className="mt-1 text-sm opacity-80 p-4">
            Welcome back! Please enter your details.
          </p>
        </div>

        {/* Form */}
        <form className="w-full max-w-sm space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:bg-[var(--color-nav-background)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              placeholder="Password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:bg-[var(--color-nav-background)]"
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
            className="w-full border border-gray-300  py-2 rounded-md flex items-center justify-center gap-2 hover:bg-[var(--color-nav-background)] transition"
            onClick={handleLogin}
          >
            <span className="text-lg">G</span> Sign in with Google
          </button>
        </form>

        <p className="mt-6 text-sm">
          Don’t have an account?{" "}
          <span onClick={toSignUp} className=" font-medium hover:underline">
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}
