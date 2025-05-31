import React, { useState, useEffect } from "react";
import { Pencil } from "lucide-react";

const MetricsCard = ({ title, fields }) => {
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

  useEffect(() => {
    setVisibleFields(fields);
    setTempFields(fields);
  }, [fields]);

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

  return (
    <div className="w-[300px] mx-auto">
      <div className="bg-white shadow-lg rounded-2xl p-6 w-full flex flex-col space-y-4 transition-opacity duration-500">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <button
            className="text-sm text-blue-600 hover:underline"
            onClick={toggleEditingMetrics}
          >
            {isEditingMetrics ? "Save Metrics" : "Edit Metrics"}
          </button>
        </div>

        {!isEditingMetrics
          ? displayFields.map((field, index) => (
              <div
                key={index}
                className="flex justify-between items-center border-b pb-2 relative"
              >
                <div className="text-gray-600 text-sm flex items-center gap-1">
                  {field.label}
                  {field.info && (
                    <div className="relative group">
                      <div className="w-4 h-4 flex items-center justify-center border border-gray-400 rounded-full text-xs text-gray-500 cursor-help">
                        i
                      </div>
                      <div className="absolute bg-black text-white text-xs rounded px-2 py-1 left-1/2 transform -translate-x-1/2 mt-2 w-48 z-10 hidden group-hover:block">
                        {field.info}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
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
                      <span className="font-medium text-green-600 text-sm">
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
                        <span className="font-medium text-gray-900 text-sm">
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
                    <span className="font-medium text-gray-900 text-sm">
                      {field.value}
                    </span>
                  )}
                </div>
              </div>
            ))
          : fields.map((field, index) => (
              <div
                key={index}
                className="flex justify-between items-center border-b pb-2"
              >
                <span className="text-gray-600 text-sm">{field.label}</span>
                <input
                  type="checkbox"
                  checked={tempFields.some((f) => f.label === field.label)}
                  onChange={() => toggleMetric(field.label)}
                  className="form-checkbox text-blue-600 h-4 w-4"
                />
              </div>
            ))}
      </div>
    </div>
  );
};

export default MetricsCard;
