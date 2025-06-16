import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

const AnimatedDropdown = ({ options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-fit" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.05, boxShadow: "0px 0px 8px rgba(0, 0, 0, 0.15)" }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex items-center justify-between gap-1 text-sm bg-gray-100 px-2 py-1 rounded"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>{selected?.toString() || "Select..."}</span>
        <ChevronDown className="w-4 h-4" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg border border-gray-200 overflow-hidden"
          >
            {options.map((option) => (
              <motion.li
                whileHover={{ backgroundColor: "#f3f4f6" }}
                key={option}
                className="px-3 py-2 text-sm cursor-pointer"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
              >
                {option}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnimatedDropdown;
