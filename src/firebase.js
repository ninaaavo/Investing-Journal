import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAoKGNVWEXLp1pzJlt2C2vFg3ZLunLlSYE",
  authDomain: "beginner-stock-journal.firebaseapp.com",
  projectId: "beginner-stock-journal",
  storageBucket: "beginner-stock-journal.firebasestorage.app",
  messagingSenderId: "834782233891",
  appId: "1:834782233891:web:8ccdcfdb0537d02253b896",
  measurementId: "G-7KQ7TZVDYW"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider, signInWithPopup, signOut };