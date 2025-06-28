import JournalFilter from "./JournalFilter";
import { useState, useEffect } from "react";

export default function JournalSidebar({ entries, selected, onSelect, initialTicker = "" , formSell}) {
  const [filteredStocks, setFilteredStocks] = useState(entries);
  const [filters, setFilters] = useState({
    ticker: initialTicker,
    type: "",
    fromDate: "",
    toDate: "",
  });
  console.log("your formsell", formSell)


  useEffect(() => {
    let filtered = entries;

    if (initialTicker) {
      filtered = filtered.filter((entry) =>
        entry.ticker.toLowerCase().includes(initialTicker.toLowerCase())
      );
    }

    if (formSell) {
      console.log("formsell in effect")
      filtered = filtered.filter((entry) => entry.type.toLowerCase() === "sell");
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
        {filteredStocks.map((entry) => (
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
              <div className="text-sm text-gray-500">{entry.date}</div>
            </div>
            <span
              className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                entry.type === "Buy"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {entry.type}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
