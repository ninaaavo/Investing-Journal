import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase"; // adjust path if needed
import { useUser } from "../../../context/UserContext"; // assuming you have this

const NotesCard = () => {
  const { user } = useUser(); // get current user
  const [note, setNote] = useState("");
  const [height, setHeight] = useState(200); // Initial height in px
  const isResizing = useRef(false);

  // Load saved note and height from Firestore
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      const noteRef = doc(db, "users", user.uid, "notes", "general");
      const noteSnap = await getDoc(noteRef);
      if (noteSnap.exists()) {
        const data = noteSnap.data();
        setNote(data.note || "");
        setHeight(data.height || 200);
      }
    };

    loadData();
  }, [user]);

  // Save note to Firestore on blur
  const handleNoteBlur = async () => {
    if (!user) return;
    const noteRef = doc(db, "users", user.uid, "notes", "general");
    await setDoc(noteRef, { note, height }, { merge: true });
  };

  // Save height to Firestore on mouse up
  const handleMouseUp = async () => {
    isResizing.current = false;
    document.body.style.cursor = "default";

    if (!user) return;
    const noteRef = doc(db, "users", user.uid, "notes", "general");
    await setDoc(noteRef, { note, height }, { merge: true });
  };

  const handleMouseDown = () => {
    isResizing.current = true;
    document.body.style.cursor = "row-resize";
  };

  const handleMouseMove = (e) => {
    if (isResizing.current) {
      setHeight((prev) => Math.max(100, prev + e.movementY));
    }
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [note, height, user]); // ensure access to latest values

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.1,
        duration: 0.5,
        ease: "easeOut",
        layout: { duration: 0.4, ease: [0.25, 0.8, 0.25, 1] },
      }}
      layout
      className="bg-white shadow-lg rounded-2xl p-6 flex flex-col space-y-4"
      style={{ height }}
    >
      <h2 className="text-xl font-semibold">Notes</h2>
      <textarea
        className="w-full flex-grow border border-gray-300 rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={handleNoteBlur}
        style={{ height: "100%" }}
      />
      <div
        onMouseDown={handleMouseDown}
        className="w-full h-3 cursor-row-resize bg-gray-200 rounded-b-md"
      ></div>
    </motion.div>
  );
};

export default NotesCard;
