import JournalFilter from "./JournalFilter";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function JournalSidebar({
  entries,
  selected,
  onSelect,
  initialTicker = "",
  formSell,
}) {
  const [filteredStocks, setFilteredStocks] = useState(entries);
  const [filters, setFilters] = useState({
    ticker: initialTicker,
    type: "",
    fromDate: "",
    toDate: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    let filtered = entries;

    if (initialTicker) {
      filtered = filtered.filter((entry) =>
        entry.ticker.toLowerCase().includes(initialTicker.toLowerCase())
      );
    }

    if (formSell) {
      filtered = filtered.filter(
        (entry) => entry.type.toLowerCase() === "sell"
      );
    }

    setFilteredStocks(filtered);
  }, [initialTicker, formSell, entries]);

  const clearFilter = () => {
    setFilteredStocks(entries);
  };

  const onFilterSubmit = () => {
    const filtered = entries.filter((entry) => {
      const matchesTicker =
        !filters.ticker ||
        entry.ticker.toLowerCase().includes(filters.ticker.toLowerCase());

      const matchesType =
        !filters.type ||
        entry.type.toLowerCase() === filters.type.toLowerCase();

      const entryDate = new Date(entry.date);
      const matchesFromDate =
        !filters.fromDate || entryDate >= new Date(filters.fromDate);

      const matchesToDate =
        !filters.toDate || entryDate <= new Date(filters.toDate);

      return matchesTicker && matchesType && matchesFromDate && matchesToDate;
    });

    setFilteredStocks(filtered);

    setFilters({
      ticker: "",
      type: "",
      fromDate: "",
      toDate: "",
    });
  };

  return (
    <div className="w-full bg-[var(--color-nav-background)] overflow-y-auto p-4 ">
      <h2 className="text-xl font-semibold text-text mb-4">Journal</h2>

      <JournalFilter
        filters={filters}
        onChange={(field, value) => {
          setFilters((prev) => ({ ...prev, [field]: value }));
        }}
        onSubmit={onFilterSubmit}
        onClearFilter={clearFilter}
      />

      <ul className="space-y-2 w-full">
        {filteredStocks.map((entry) => {
          const isBuy = entry.type.toLowerCase() === "buy";
          const isShort = entry.direction?.toLowerCase() === "short";
          const baseLabel = entry.type[0].toUpperCase() + entry.type.slice(1);
          const label = isShort ? `${baseLabel} – Short` : baseLabel;

          let tagClasses = "px-2 py-0.5 text-xs rounded-full font-medium ";
          if (isBuy && !isShort)
            tagClasses += "bg-green-100 text-green-800"; // Buy
          else if (isBuy && isShort)
            tagClasses += "bg-cyan-100 text-cyan-800"; // Buy – Short
          else if (!isBuy && !isShort)
            tagClasses += "bg-red-100 text-red-800"; // Sell
          else tagClasses += "bg-orange-100 text-orange-800"; // Sell – Short

          const statusTag =
            entry.isEntry &&
            (entry.isClosed ? (
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full font-medium">
                Closed
              </span>
            ) : (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                Open
              </span>
            ));

          return (
            <li
              key={entry.id}
              className={`bg-white px-4 py-2 rounded-lg cursor-pointer flex justify-between items-center shadow-sm transform transition-transform duration-200 hover:scale-[103%] active:scale-[97%] hover:bg-gray-100 ${
                selected.id === entry.id
                  ? "!bg-[var(--color-dark-background)]"
                  : ""
              }`}
              onClick={() => onSelect(entry)}
            >
              <div>
                <div className="font-medium text-text">{entry.ticker}</div>
                <div className="text-sm text-gray-500">
                  {(() => {
                    const rawDate = entry.isEntry
                      ? entry.entryTimestamp
                      : entry.exitTimestamp;

                    const timeProvided = entry.isEntry
                      ? entry.timeProvided
                      : entry.exitTimeProvided;

                    const d =
                      rawDate instanceof Date ? rawDate : rawDate?.toDate?.();

                    if (!d) return "";

                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const dd = String(d.getDate()).padStart(2, "0");
                    const yyyy = d.getFullYear();

                    if (timeProvided) {
                      let hour = d.getHours();
                      const minute = String(d.getMinutes()).padStart(2, "0");
                      const ampm = hour >= 12 ? "PM" : "AM";
                      hour = hour % 12 || 12;
                      return `${mm}/${dd}/${yyyy} at ${hour}:${minute} ${ampm}`;
                    } else {
                      return `${mm}/${dd}/${yyyy}`;
                    }
                  })()}
                </div>
              </div>
              <div className="flex items-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (entry.isEntry) {
                      const status = entry.isClosed ? "closed" : "open";
                      navigate(`/journal?status=${status}`);
                    }
                  }}
                  className="pr-2 hover:underline focus:outline-none"
                >
                  {statusTag}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation(); // prevent selecting the whole row
                    navigate(
                      `/journal?ticker=${entry.ticker}&type=${entry.type}`
                    );
                  }}
                  className={`${tagClasses} hover:underline focus:outline-none`}
                >
                  {label}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
