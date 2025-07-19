import { motion, AnimatePresence } from "framer-motion";

export default function InfoCard({ title = "Information", entry = [] }) {
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
          {entry &&
            entry.map((value, index) => {
              const content = String(value.content);
              const [firstLine, ...restLines] = content.split("\n");
              const isShort = firstLine.length < 20;
              const showBorder =
                index !==
                Object.keys(entry).length - 1 - (entry.timestamp ? 1 : 0); // handle border logic

              return (
                <div
                  key={index}
                  className={`mb-4 pb-2 ${showBorder ? "border-b" : ""}`}
                >
                  {isShort ? (
                    <div className="text-md text-primary">
                      {value.label && (
                        <span className="font-medium">
                          {value.label}
                          {value.label ? ":" : ""}
                        </span>
                      )}
                      {value.label && " "}
                      <span className="font-normal">{firstLine}</span>
                      {restLines.length > 0 && (
                        <div className="text-sm whitespace-pre-line mt-1">
                          {restLines.join("\n")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {value.label && (
                        <div className="text-md font-medium text-primary mb-1">
                          {value.label}
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-line">
                        {content}
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
