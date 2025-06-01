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
      layout className="flex p-8 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl w-fit text-sm w-[calc(50%-15px)] justify-between">
      <div className="">
        <div className="text-2xl font-medium">AAPL</div>
        <div>Apple Inc.</div>
        <div>Shares: 10</div>
        <div>Bought Price: $100</div>
        <div>Current Price: $120</div>
      </div>
      <button className="px-6 py-1 text-sm rounded-xl font-semibold bg-green-100 text-green-800 h-fit hover:bg-green-400 mt-1">Sell</button>
      
    </motion.div>
  );
}
