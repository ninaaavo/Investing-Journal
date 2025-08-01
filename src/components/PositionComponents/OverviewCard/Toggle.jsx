import React from "react";

const Toggle = ({ checked, onChange, labelLeft, labelRight }) => {
  return (
    <label className="flex items-center gap-1 cursor-pointer">
      {labelLeft && <span className="text-sm">{labelLeft}</span>}
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={onChange}
      />
      <div className="w-10 h-5 bg-gray-300 rounded-full relative">
        <div
          className={`w-5 h-5 bg-blue-500 rounded-full absolute top-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
      {labelRight && <span className="text-sm">{labelRight}</span>}
    </label>
  );
};

export default Toggle;
