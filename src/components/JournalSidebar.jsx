import JournalFilter from "./JournalFilter";

export default function JournalSidebar({ entries, selected, onSelect, filters, onFilterChange }) {
  return (
    <div className="w-1/3 max-w-xs bg-[var(--color-nav-background)] overflow-y-auto p-4">
      <h2 className="text-xl font-semibold text-text mb-4">Journal</h2>

      <JournalFilter filters={filters} onChange={onFilterChange} />

      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entries.id}
            className={`bg-white px-4 py-2 rounded-lg cursor-pointer flex justify-between items-center shadow-sm transition hover:bg-gray-100 ${
              selected.id === entry.id ? "bg-[var(--color-dark-background)]!" : ""
            }`}
            onClick={() => onSelect(entry)}
          >
            <div>
              <div className="font-medium text-text">{entry.stock}</div>
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
