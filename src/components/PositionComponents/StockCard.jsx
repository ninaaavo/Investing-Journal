import { motion } from "framer-motion";

export default function StockCard() {
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
      className="flex p-8 mb-6 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] w-[calc(50%-12px)] rounded-xl text-sm  justify-between"
    >
      <div className="">
        <div className="text-2xl font-medium">AAPL</div>
        <div className="text-base mb-2">Apple Inc.</div>
        <div>Shares: 10</div>
        <div>Bought Price: $100</div>
        <div>Current Price: $120</div>
      </div>
      <motion.button
        type="submit"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="h-fit px-4 py-1 text-sm rounded-md font-semibold bg-[var(--color-dark-background)] hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary active:border active:border-gray-300 active:bg-transparent active:text-[var(--color-primary)]"
      >
        Long
      </motion.button>
    </motion.div>
  );
}
