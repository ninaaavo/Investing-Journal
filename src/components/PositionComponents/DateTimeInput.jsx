import { useState } from "react";

export default function DateTimeInput({ form, setForm, type = "entry" }) {
  const [showTimeInput, setShowTimeInput] = useState(false);

  const isEntry = type === "entry";
  const dateKey = isEntry ? "entryDate" : "exitDate";
  const timeKey = isEntry ? "entryTime" : "exitTime";

  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleInputType = () => {
    setShowTimeInput((prev) => !prev);
  };

  const date = form[dateKey];
  const time = form[timeKey];

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [yyyy, mm, dd] = dateStr.split("-");
    return `${mm.padStart(2, "0")}/${dd.padStart(2, "0")}/${yyyy}`;
  };

  return (
    <div className="w-full">
      {/* Label + Toggle Button */}
      <div className="flex justify-between items-center mb-1">
        <span className="font-medium">
          {showTimeInput ? `${type[0].toUpperCase() + type.slice(1)} Time` : `${type[0].toUpperCase() + type.slice(1)} Date`}
        </span>
        <button
          type="button"
          onClick={toggleInputType}
          className="text-sm hover:opacity-70 active:opacity-100"
          title="Swap input mode"
        >
          {showTimeInput ? "Edit Date" : "Add Time"}
        </button>
      </div>

      {/* Editable input */}
      <input
        type={showTimeInput ? "time" : "date"}
        name={showTimeInput ? timeKey : dateKey}
        value={showTimeInput ? time : date}
        onChange={handleChange}
        className="w-full p-2 border rounded"
      />

      {/* Show inactive value only if present */}
      {!showTimeInput && time && (
        <p className="text-xs text-gray-500 mt-1 pl-1">Time: {time}</p>
      )}
      {showTimeInput && date && (
        <p className="text-xs text-gray-500 mt-1 pl-1">Date: {formatDate(date)}</p>
      )}
    </div>
  );
}
