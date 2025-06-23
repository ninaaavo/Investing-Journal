import React, { useState, useRef } from "react";
import { motion } from "framer-motion";

const NotesCard = () => {
  const [note, setNote] = useState("");
  const [height, setHeight] = useState(200); // Initial height in px
  const isResizing = useRef(false);

  const handleMouseDown = () => {
    isResizing.current = true;
    document.body.style.cursor = "row-resize";
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.body.style.cursor = "default";
  };

  const handleMouseMove = (e) => {
    if (isResizing.current) {
      setHeight((prev) => Math.max(100, prev + e.movementY));
    }
  };

  // Add and remove listeners
  React.useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

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
      <h2 className="text-xl font-semibold text-gray-800">Notes</h2>
      <textarea
        className="w-full flex-grow border border-gray-300 rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ height: "100%" }}
      />
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="w-full h-3 cursor-row-resize bg-gray-200 rounded-b-md"
      ></div>
    </motion.div>
  );
};

export default NotesCard;
