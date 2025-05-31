import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function JournalFilter({ filters, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full space-y-3 bg-[var(--color-dark-background)] mb-4 rounded-lg ">
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 mb-0 font-medium bg-red"
      >
        Filter
        {open ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Filter Form (Collapsible) */}
      <div
        className={`transition-all duration-600 overflow-hidden ${
          open ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 space-y-4">
          {/* Stock Name */}
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text)]">
              Stock Name
            </label>
            <input
              type="text"
              value={filters.stock}
              onChange={(e) => onChange({ ...filters, stock: e.target.value })}
              placeholder="e.g. AAPL"
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-[var(--color-nav-background)]"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text)]">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => onChange({ ...filters, type: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-[var(--color-nav-background)]"
            >
              <option value="">All Types</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text)]">
              Date Range
            </label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) =>
                  onChange({ ...filters, fromDate: e.target.value })
                }
                className="w-1/2 px-3 py-2 text-sm rounded-md border border-gray-300 bg-[var(--color-nav-background)]"
              />
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) =>
                  onChange({ ...filters, toDate: e.target.value })
                }
                className="w-1/2 px-3 py-2 text-sm rounded-md border border-gray-300 bg-[var(--color-nav-background)]"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)} // or trigger filter logic
            className="mt-2 w-full bg-[var(--color-text)] text-white py-2 rounded-md text-sm font-medium hover:opacity-80 transition"
          >
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  );
}
