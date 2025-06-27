import React from "react";

export default function ExitForm({ onSubmit }) {
  return (
    <div className="p-6 bg-white rounded-xl shadow-md space-y-4 w-full">
      <h2 className="text-xl font-semibold">Exit Trade</h2>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Sell Price</label>
        <input
          type="number"
          className="w-full border border-gray-300 rounded-md p-2 text-sm"
          placeholder="e.g., 115.50"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Number of Shares Sold</label>
        <input
          type="number"
          className="w-full border border-gray-300 rounded-md p-2 text-sm"
          placeholder="e.g., 10"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Reason for Exit</label>
        <textarea
          rows={3}
          className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none"
          placeholder="Briefly explain why you're exiting this trade"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">What did you learn?</label>
        <textarea
          rows={3}
          className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none"
          placeholder="Optional reflection"
        />
      </div>

      <button
        onClick={onSubmit}
        className="mt-4 px-4 py-2 bg-[var(--color-dark-background)] text-white rounded-md font-semibold text-sm hover:opacity-80"
      >
        Submit Exit
      </button>
    </div>
  );
}
