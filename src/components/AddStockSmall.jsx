import { useState } from "react";

export default function AddStockSmall() {
  const [form, setForm] = useState({
    name: "",
    shares: "",
    price: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Stock Added:", form);
    // reset
    setForm({ name: "", shares: "", price: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 mt-4 mb-8 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl w-fit ">
      <div className="flex gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            Stock Name
          </label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. AAPL"
            className="w-[150px] border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Shares</label>
          <input
            type="number"
            name="shares"
            value={form.shares}
            onChange={handleChange}
            placeholder="e.g. 10"
            className="w-[150px] border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Price</label>
          <input
            type="number"
            name="price"
            value={form.price}
            onChange={handleChange}
            placeholder="e.g. 175"
            className="w-[150px] border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-transparent font-medium text-gray-700 select-none">/</label>
          <button
            type="submit"
            className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Add Stock
          </button>
        </div>
      </div>
    </form>
  );
}
