import React, { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { motion } from "framer-motion";

const MetricsCard = ({ title, fields, titleDropdown, headerExtra }) => {
  const [editableValues, setEditableValues] = useState(() => {
    const initial = {};
    fields.forEach((field) => {
      if (field.editable && field.defaultValue !== undefined) {
        initial[field.label] = field.defaultValue;
      }
    });
    return initial;
  });

  const [editingField, setEditingField] = useState(null);
  const [isEditingMetrics, setIsEditingMetrics] = useState(false);
  const [visibleFields, setVisibleFields] = useState(fields);
  const [tempFields, setTempFields] = useState(fields);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setTempFields(fields);
  }, [fields]);

  useEffect(() => {
    const t = setTimeout(() => setHasMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleEditSubmit = (e, label) => {
    e.preventDefault();
    const value = parseFloat(e.target.elements["editInput"].value);
    if (!isNaN(value)) {
      setEditableValues((prev) => ({ ...prev, [label]: value }));
      const fieldConfig = fields.find((f) => f.label === label);
      if (fieldConfig?.onValueChange) {
        fieldConfig.onValueChange(value);
      }
    }
    setEditingField(null);
  };

  const toggleMetric = (label) => {
    setTempFields((prev) =>
      prev.some((f) => f.label === label)
        ? prev.filter((f) => f.label !== label)
        : [...prev, fields.find((f) => f.label === label)]
    );
  };

  const toggleEditingMetrics = () => {
    if (isEditingMetrics) {
      const ordered = fields.filter((f) =>
        tempFields.some((t) => t.label === f.label)
      );
      setVisibleFields(ordered);
    } else {
      setTempFields(visibleFields);
    }
    setIsEditingMetrics(!isEditingMetrics);
  };

  const displayFields = fields.filter((f) =>
    visibleFields.some((v) => v.label === f.label)
  );

  const getValueColorClass = (value) => {
    if (typeof value !== "string") return "text-gray-900";
    const match = value.match(/\(\s*([-+]?\d*\.?\d+)%?\s*\)/);
    if (!match) return "text-gray-900";
    const number = parseFloat(match[1]);
    return number < 0 ? "text-red-600" : "text-green-600";
  };

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
      className="w-[300px] h-fit bg-white shadow-lg rounded-2xl p-6 flex flex-col space-y-4 transition-opacity duration-500"
    >
      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <button
            className="text-sm text-blue-600 hover:underline w-max shrink-0 self-start mt-[7px]"
            onClick={toggleEditingMetrics}
          >
            {isEditingMetrics ? "Save Metrics" : "Edit Metrics"}
          </button>
        </div>
        {headerExtra && (
          <div className="flex justify-end mt-0">{headerExtra}</div>
        )}
      </div>

      <motion.div
        key={isEditingMetrics ? "edit-mode" : "view-mode"}
        layout
        className="flex flex-col gap-2"
      >
        {!isEditingMetrics
          ? displayFields.map((field, index) => (
              <motion.div
                key={index}
                layout
                {...(hasMounted && {
                  initial: { opacity: 0, y: 10 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.3 },
                })}
                className="flex justify-between items-center border-b pb-2 relative"
              >
                <div className="text-gray-600 text-sm flex items-center gap-1">
                  <div className="text-gray-600 text-sm flex items-start gap-1 w-fit leading-tight">
                    {field.label.includes("(") ? (
                      <div className="flex flex-col">
                        {field.label.split("(")[0].trim()}{" "}
                        <span className="text-xs italic">
                          ({field.label.split("(")[1]}
                        </span>
                      </div>
                    ) : (
                      field.label
                    )}
                  </div>
                  {field.info && (
                    <div className="relative group self-start ">
                      <div className="w-3 h-3 flex items-center justify-center border border-gray-400 rounded-full text-[7px] text-gray-500 cursor-help">
                        i
                      </div>
                      <div className="absolute bg-black text-white text-xs rounded px-2 py-1 left-1/2 transform -translate-x-1/2 mt-2 w-48 z-10 hidden group-hover:block">
                        {field.info}
                      </div>
                    </div>
                  )}
                </div>
                <motion.div
                  key={field.label + field.value}
                  layout
                  className="flex items-center gap-2"
                >
                  {field.type === "dropdown" &&
                  field.selected !== undefined &&
                  field.onChange ? (
                    <>
                      <select
                        className="text-sm bg-gray-100 px-1 py-0.5 rounded"
                        value={field.selected}
                        onChange={(e) => field.onChange?.(e.target.value)}
                      >
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <span
                        className={`font-medium text-sm text-right ${getValueColorClass(
                          field.baseValue
                        )}`}
                      >
                        {field.baseValue}
                      </span>
                    </>
                  ) : field.editable ? (
                    editingField === field.label ? (
                      <form
                        onSubmit={(e) => handleEditSubmit(e, field.label)}
                        className="flex items-center gap-2"
                      >
                        <input
                          name="editInput"
                          type="number"
                          defaultValue={editableValues[field.label]}
                          className="w-20 px-1 py-0.5 border border-gray-300 rounded text-sm"
                        />
                        <button className="text-blue-600 text-sm">Save</button>
                      </form>
                    ) : (
                      <>
                        <span
                          className={`font-medium text-sm ${getValueColorClass(
                            `$${editableValues[field.label]?.toLocaleString()}`
                          )}`}
                        >
                          ${editableValues[field.label]?.toLocaleString()}
                        </span>
                        <Pencil
                          size={16}
                          className="text-gray-500 cursor-pointer"
                          onClick={() => setEditingField(field.label)}
                        />
                      </>
                    )
                  ) : (
                    <span
                      className={`font-medium text-sm text-right ${getValueColorClass(
                        field.value
                      )}`}
                    >
                      {field.value}
                    </span>
                  )}
                </motion.div>
              </motion.div>
            ))
          : fields.map((field, index) => (
              <motion.div
                key={index}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex justify-between items-center border-b pb-2"
              >
                <span className="text-gray-600 text-sm">{field.label}</span>
                <input
                  type="checkbox"
                  checked={tempFields.some((f) => f.label === field.label)}
                  onChange={() => toggleMetric(field.label)}
                  className="form-checkbox text-blue-600 h-4 w-4"
                />
              </motion.div>
            ))}
      </motion.div>
    </motion.div>
  );
};

export default MetricsCard;
