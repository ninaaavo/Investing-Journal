import { motion, AnimatePresence } from "framer-motion";

export default function ExitDecisionCard({
  title = "Exit Plan",
  entry = null,
}) {
  return (
    <div className="p-8 mt-4 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl w-[calc(32%)] h-[300px] overflow-y-auto scroll-stable">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-primary">{title}</h2>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key="log"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
        >
          {entry && (
            <div className="mb-4 pb-2 ">
              <div className="flex justify-between text-md font-medium text-primary">
                <span>Stop Loss: {entry.stopLoss} ({entry.lossPercent})</span>
              </div>
              <p className="text-sm border-b mb-3 pb-3"><span className="font-semibold">Reason:</span> {entry.reason}</p>
              <div className="flex justify-between text-md font-medium text-primary">
                <span>Target: {entry.targetPrice} ({entry.targetPercent})</span>
              </div>
              <p className="text-sm ">R/R Ratio: {entry.rrRatio}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
