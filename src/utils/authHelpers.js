// src/utils/authHelpers.js
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

// Email/password sign up
export const signUpWithEmail = async (name, email, password) => {
  const res = await createUserWithEmailAndPassword(auth, email, password);
  const user = res.user;

  await setDoc(doc(db, "users", user.uid), {
    name,
    email,
    createdAt: new Date(),
  });

  return user;
};

// Google sign in
export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  const userDocRef = doc(db, "users", user.uid);
  const existing = await getDoc(userDocRef);

  if (!existing.exists()) {
    await setDoc(userDocRef, {
      name: user.displayName,
      email: user.email,
      profilePicture: user.photoURL || "",
      createdAt: new Date(),
    });
  }

  return user;
};
