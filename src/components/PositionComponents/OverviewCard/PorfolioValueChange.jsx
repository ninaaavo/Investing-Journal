import { useState } from "react";

const dummyPortfolioData = {
  current: 10500,
  history: {
    "1D": 10300,
    "1W": 9800,
    "1M": 9400,
    "3M": 9000,
    "1Y": 8000,
    "All": 7000,
  },
};

const getValueChange = (data, range) => {
  const current = data.current;
  const previous = data.history[range];

  const amount = current - previous;
  const percent = ((amount / previous) * 100).toFixed(2);

  return { amount, percent };
};

const PortfolioValueChange = () => {
  const [range, setRange] = useState("1D");

  const valueChange = getValueChange(dummyPortfolioData, range);
  const isPositive = valueChange.amount >= 0;

  return (
    <div >
        <span className="font-semibold">Value Change:</span>
        
      <span
        className={`font-bold ${
          isPositive ? "text-green-600" : "text-red-500"
        }`}
      >
        {isPositive ? "+" : "-"}${Math.abs(valueChange.amount).toFixed(2)}{" "}
        <span className="text-sm text-gray-600">
          ({valueChange.percent}%)
        </span>
        
      </span>
      <select
          className="text-sm bg-gray-100 px-2 py-1 rounded-md"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          {["1D", "1W", "1M", "3M", "1Y", "All"].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
    </div>
  );
};

export default PortfolioValueChange;
