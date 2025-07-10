import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

export default function TickerSearchInput({
  onSelect,
  styling,
  form,
  onDropdownState, // notify parent if dropdown is open
}) {
  const [query, setQuery] = useState(form.ticker || "");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedDescription, setSelectedDescription] = useState(
    form.companyName || ""
  );
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const inputRef = useRef();
  const dropdownRef = useRef();
  const [inputRect, setInputRect] = useState(null);

  const fetchSuggestions = async (input) => {
    const res = await fetch(
      `https://finnhub.io/api/v1/search?q=${input}&token=${API_KEY}`
    );
    const data = await res.json();
    setSuggestions(data.result.slice(0, 5));
    setHighlightedIndex(-1); // reset highlight initially
    setIsDropdownOpen(true);
  };

  const handleChange = (e) => {
    const input = e.target.value;
    setQuery(input);
    setSelectedDescription("");
    if (input.length > 1) {
      fetchSuggestions(input);
    } else {
      setSuggestions([]);
      setIsDropdownOpen(false);
    }
  };

  const handleSelect = (symbol, description) => {
    setQuery(symbol);
    setSelectedDescription(description);
    setSuggestions([]);
    setHighlightedIndex(-1);
    setIsDropdownOpen(false);
    onSelect(symbol, description);
  };

  // Notify parent about dropdown open state
  useEffect(() => {
    onDropdownState?.(isDropdownOpen);
  }, [isDropdownOpen]);

  useEffect(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setInputRect(rect);
    }
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedOutside =
        inputRef.current &&
        !inputRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target);

      if (clickedOutside) {
        if (suggestions.length > 0) {
          const fallback = suggestions[0];
          handleSelect(fallback.symbol, fallback.description);
        }
        setSuggestions([]);
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [suggestions]);

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className={styling}
          value={query}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (!suggestions.length) {
              onKeyDown?.(e); // no dropdown — let parent handle enter (form expansion)
              return;
            }

            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlightedIndex((prev) =>
                prev <= 0 ? suggestions.length - 1 : prev - 1
              );
            } else if (e.key === "Enter") {
              e.preventDefault();
              const selected =
                highlightedIndex >= 0
                  ? suggestions[highlightedIndex]
                  : suggestions[0];

              if (selected) {
                handleSelect(selected.symbol, selected.description);
              }
            } else {
              onKeyDown?.(e); // fallback to parent for non-nav keys
            }
          }}
          placeholder="e.g. AAPL"
        />
        {selectedDescription && (
          <p className="text-xs text-gray-500 mt-1 ml-2">
            {selectedDescription}
          </p>
        )}
      </div>

      {suggestions.length > 0 &&
        inputRect &&
        ReactDOM.createPortal(
          <ul
            ref={dropdownRef}
            className="z-50 bg-white shadow-md border rounded-md max-h-60 overflow-auto"
            style={{
              position: "absolute",
              top: inputRect.bottom + window.scrollY,
              left: inputRect.left + window.scrollX,
              width: inputRect.width,
            }}
          >
            {suggestions.map((s, index) => (
              <li
                key={s.symbol}
                className={`p-2 cursor-pointer ${
                  index === highlightedIndex
                    ? "bg-blue-100"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => handleSelect(s.symbol, s.description)}
              >
                <strong>{s.symbol}</strong> —{" "}
                <span className="text-sm">
                  {s.description
                    .toLowerCase()
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")}
                </span>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  );
}
