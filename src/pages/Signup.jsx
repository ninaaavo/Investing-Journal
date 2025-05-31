import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, provider } from "../firebase";
import { useNavigate } from "react-router-dom";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await updateProfile(userCred.user, { displayName: name });
      console.log("Signed up:", userCred.user);
    } catch (error) {
      console.error("Sign up error:", error.message);
    }
  };

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

  return (
    <div className="flex flex-col justify-center items-center flex h-[calc(100vh-150px)] space-y-6 ">
      <div className=" flex flex-col justify-center items-center w-lg bg-[var(--color-background)] rounded-xl p-6 shadow-lg">
        {" "}
        {/* Heading */}
        <div className="text-center mb-6 pt-4">
          <h1 className="text-4xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm opacity-80 p-4">Let's get you started.</p>
        </div>
        {/* Form */}
        <form className="w-full max-w-sm space-y-4" onSubmit={handleSignUp}>
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:bg-[var(--color-nav-background)]"
              required
            />
          </div>

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
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:bg-[var(--color-nav-background)]"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[var(--color-text)] text-white py-2 rounded-md hover:opacity-80 transition"
          >
            Sign up
          </button>
          <button
            type="button"
            className="w-full border border-gray-300  py-2 rounded-md flex items-center justify-center gap-2 hover:bg-[var(--color-nav-background)] transition"
            onClick={handleLogin}
          >
            <span className="text-lg">G</span> Sign up with Google
          </button>
        </form>
        <p className="mt-6 text-sm">
          Already have an account?{" "}
          <a href="/login" className="font-medium hover:underline">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
