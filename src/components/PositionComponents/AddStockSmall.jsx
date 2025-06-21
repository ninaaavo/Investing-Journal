import { useState } from "react";
import { motion } from "framer-motion";

export default function AddStockSmall({ setShowForm, setPrefillData }) {
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
    setPrefillData({
      ticker: form.name,
      shares: form.shares,
      entryPrice: form.price,
    });
    setShowForm(true);
    setForm({ name: "", shares: "", price: "" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.1,
        duration: 0.5,
        ease: "easeOut",
        layout: { duration: 0.4, ease: [0.25, 0.8, 0.25, 1] },
      }}
      layout
    >
      <form
        onSubmit={handleSubmit}
        className="p-6 mt-4 mb-8 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl w-[100%] "
      >
        <div className="flex gap-4">
          <div className="flex flex-col gap-2 w-1/4">
            <label className="text-sm font-medium text-gray-700">
              Stock Name
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. AAPL"
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
              required
            />
          </div>
          <div className="flex flex-col gap-2 w-1/4">
            <label className="text-sm font-medium text-gray-700">Shares</label>
            <input
              type="number"
              name="shares"
              value={form.shares}
              onChange={handleChange}
              placeholder="e.g. 10"
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
              required
            />
          </div>

          <div className="flex flex-col gap-2 w-1/4">
            <label className="text-sm font-medium text-gray-700">Price</label>
            <input
              type="number"
              name="price"
              value={form.price}
              onChange={handleChange}
              placeholder="e.g. 175"
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:shadow-[0_0_6px_4px_rgba(0,0,0,0.1)]"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-transparent font-medium text-gray-700 select-none">
              /
            </label>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="rounded-md px-4 py-2 text-sm font-bold text-white bg-[var(--color-primary)] hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary active:border active:border-gray-300 active:bg-transparent active:text-[var(--color-primary)]"
            >
              Add Stock
            </motion.button>
          </div>
        </div>
      </form>
    </motion.div>
  );
}
