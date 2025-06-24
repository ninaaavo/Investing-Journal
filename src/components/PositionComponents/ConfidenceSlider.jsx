import React from "react";

const confidenceDescriptions = {
  1: "😬 Nervous",
  2: "😟 Not sure",
  3: "🤔 Meh",
  4: "😐 Watching",
  5: "😌 Decent setup",
  6: "🙂 Looking good",
  7: "😎 Solid",
  8: "🚀 Strong move",
  9: "🔥 Locked in",
  10: "💪 I got this",
};

const getConfidenceColor = (value) => {
  // Hue 0 (red) → 120 (green)
  const hue = Math.round(((value - 1) / 9) * 120);
  return `hsl(${hue}, 100%, 50%)`;
};

export default function ConfidenceSlider({ value, onChange }) {
  const color = getConfidenceColor(value);

  return (
    <label className="block w-full col-span-3">
      <span className="block mb-1 font-medium">
        Confidence Level: {value} – {confidenceDescriptions[value]}
      </span>
      <input
        type="range"
        min="1"
        max="10"
        step="1"
        value={value}
        onChange={onChange}
        className="w-full appearance-none h-2 rounded-full bg-gray-300 focus:outline-none"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${
            (value - 1) * 11.11
          }%, #e5e7eb ${(value - 1) * 11.11}%, #e5e7eb 100%)`,
          color: color,
        }}
      />
    </label>
  );
}
