import { motion } from "framer-motion";
import { useState } from "react";
import StockCard from "../components/PositionComponents/StockCard";
import AddStockSmall from "../components/PositionComponents/AddStockSmall";
import OverviewCard from "../components/PositionComponents/OverviewCard/OverviewCard";
import InputForm from "../components/PositionComponents/InputForm";

export default function Positions() {
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  return (
    <motion.div
      key="positions"
      className="flex gap-6 h-[calc(100vh-150px)] bg-[var(--color-background)] rounded-xl overflow-hidden shadow-lg p-6 justify-between"
    >
      <div className="flex flex-col w-[calc((100%-40px)/2)]">
        <div>
          <div className="text-lg font-medium ">Add stock</div>
          <InputForm />
        </div>
        <div className="text-lg font-medium">Current Stocks</div>

        <div className="relative w-full  mt-4 h-full overflow-hidden">
          {/* Top fade */}
          <div className="pointer-events-none absolute top-0 left-0 w-full h-6 bg-gradient-to-b from-[var(--color-background)] to-transparent z-10" />

          {/* Bottom fade */}
          <div className="pointer-events-none absolute bottom-0 left-0 w-full h-6 bg-gradient-to-t from-[var(--color-background)] to-transparent z-10" />

          {/* Scrollable content */}
          <div className="overflow-y-auto h-full pr-2">
            <div className="flex flex-wrap justify-between pt-4 pb-6 px-6 w-full">
              <StockCard />
              <StockCard />
              <StockCard />
              <StockCard />
            </div>
          </div>
        </div>
      </div>
      <div className="w-[calc((100%-40px)/2)]">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-medium"> Overview</div>
          <button
          onClick={() =>{setIsEditingLayout((prev) => !prev);console.log("your editing layout now is", isEditingLayout);} }
          className="text-sm font-semibold px-3 py-1 rounded-md bg-[var(--color-primary)] text-white shadow hover:opacity-80"
        >
          {isEditingLayout ? "Done" : "Edit Layout"}
        </button>
        </div>
        <OverviewCard isEditingLayout ={isEditingLayout}/>
      </div>
    </motion.div>
  );
}
