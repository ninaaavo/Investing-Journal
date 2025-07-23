import JournalFilter from "./JournalFilter";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function JournalSidebar({
  entries,
  selected,
  onSelect,
  initialTicker = "",
  initialType = "",
  initialStatus = "",
  initialDirection = "",
}) {
  const [filteredStocks, setFilteredStocks] = useState(entries);
  const [filters, setFilters] = useState({
    ticker: initialTicker,
    type: initialType,
    direction: initialDirection,
    status: initialStatus,
    fromDate: "",
    toDate: "",
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const searchTicker = searchParams.get("ticker") || "";
    const searchType = searchParams.get("type") || "";
    const searchStatus = searchParams.get("status") || "";
    const searchDirection = searchParams.get("direction") || "";
    const searchFromDate = searchParams.get("fromDate") || "";
    const searchToDate = searchParams.get("toDate") || "";

    const updatedFilters = {
      ticker: searchTicker,
      type: searchType,
      direction: searchDirection,
      status: searchStatus,
      fromDate: searchFromDate,
      toDate: searchToDate,
    };
    setFilters(updatedFilters);

    let filtered = entries;

    if (searchTicker)
      filtered = filtered.filter((entry) =>
        entry.ticker.toLowerCase().includes(searchTicker.toLowerCase())
      );
    if (searchType)
      filtered = filtered.filter(
        (entry) => entry.type.toLowerCase() === searchType.toLowerCase()
      );
    if (searchDirection)
      filtered = filtered.filter(
        (entry) =>
          entry.direction?.toLowerCase() === searchDirection.toLowerCase()
      );
    if (searchStatus)
      filtered = filtered.filter((entry) => {
        if (!entry.isEntry) return false;
        return searchStatus === "closed" ? entry.isClosed : !entry.isClosed;
      });
    if (searchFromDate)
      filtered = filtered.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= new Date(searchFromDate);
      });
    if (searchToDate)
      filtered = filtered.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate <= new Date(searchToDate);
      });

    setFilteredStocks(filtered);

    if (filtered.length > 0) {
      const selectedId = searchParams.get("id");
      const selectedEntry =
        filtered.find((e) => e.id === selectedId) || filtered[0];
      onSelect(selectedEntry);

      const queryParams = new URLSearchParams({
        ...(searchTicker && { ticker: searchTicker }),
        ...(searchType && { type: searchType }),
        ...(searchStatus && { status: searchStatus }),
        ...(searchDirection && { direction: searchDirection }),
        ...(searchFromDate && { fromDate: searchFromDate }),
        ...(searchToDate && { toDate: searchToDate }),
        id: selectedEntry.id,
      });

      navigate(`/journal?${queryParams.toString()}`);
    }
  }, [entries, searchParams]);

  const clearFilter = () => {
    setFilters({
      ticker: "",
      type: "",
      direction: "",
      status: "",
      fromDate: "",
      toDate: "",
    });
    setFilteredStocks(entries);
    navigate("/journal");
  };

  const onFilterSubmit = () => {
    const queryParams = new URLSearchParams({
      ...(filters.ticker && { ticker: filters.ticker }),
      ...(filters.type && { type: filters.type }),
      ...(filters.status && { status: filters.status }),
      ...(filters.direction && { direction: filters.direction }),
      ...(filters.fromDate && { fromDate: filters.fromDate }),
      ...(filters.toDate && { toDate: filters.toDate }),
    });
    navigate(`/journal?${queryParams.toString()}`);
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
          if (isBuy && !isShort) tagClasses += "bg-green-100 text-green-800";
          else if (isBuy && isShort) tagClasses += "bg-cyan-100 text-cyan-800";
          else if (!isBuy && !isShort) tagClasses += "bg-red-100 text-red-800";
          else tagClasses += "bg-orange-100 text-orange-800";

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
                    e.stopPropagation();
                    navigate(
                      `/journal?type=${entry.type}`
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
