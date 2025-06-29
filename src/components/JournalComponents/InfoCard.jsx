import { motion, AnimatePresence } from "framer-motion";

export default function InfoCard({
  title = "Information",
  entry = [],
}) {
  const isSingleEntry = entry.length === 1;

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
          {entry && entry.length > 0 && entry.map((section, index) => {
            const [firstLine, ...restLines] = section.content.split("\n");
            const isShort = firstLine.length < 20;
            const showBorder = !isSingleEntry && index !== entry.length - 1;

            return (
              <div
                key={index}
                className={`mb-4 pb-2 ${showBorder ? "border-b" : ""}`}
              >
                {isShort ? (
                  <div className="text-md text-primary">
                    <span className="font-medium">{section.label}:</span>{" "}
                    <span className="font-normal">{firstLine}</span>
                    {restLines.length > 0 && (
                      <div className="text-sm whitespace-pre-line mt-1">
                        {restLines.join("\n")}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="text-md font-medium text-primary mb-1">
                      {section.label}
                    </div>
                    <div className="text-sm whitespace-pre-line">
                      {section.content}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
