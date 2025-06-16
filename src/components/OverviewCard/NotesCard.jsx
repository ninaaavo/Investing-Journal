import React, { useState } from "react";
import { motion } from "framer-motion";

const NotesCard = () => {
  const [note, setNote] = useState("");

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
      className="h-full bg-white shadow-lg rounded-2xl p-6 flex flex-col space-y-4"
    >
      <h2 className="text-xl font-semibold text-gray-800">Notes</h2>
      <textarea
        className="w-full h-full border border-gray-300 rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        rows={5}
        placeholder="Write your notes here..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </motion.div>
  );
};

export default NotesCard;