import { motion } from "framer-motion";
import StockCard from "../components/StockCard";
import AddStockSmall from "../components/AddStockSmall";
import OverviewCard from "../components/OverviewCard/OverviewCard";
import InputForm from "../components/InputForm";

export default function Positions() {
  return (
    <motion.div
      key="positions"
      className="flex gap-6 h-[calc(100vh-150px)] bg-[var(--color-background)] rounded-xl overflow-hidden shadow-lg p-6 justify-between"
    >
      <div className="flex flex-col w-[calc((100%-40px)/2)]">
        <div>
          <div className="text-lg font-medium ">Add stock</div>
          <AddStockSmall />
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
      {/* <div className="w-[calc((100%-40px)/2)]">
        <div className="text-lg font-medium">Overview</div>
        <OverviewCard />
      </div> */}
      <div className="w-[calc((100%-40px)/2)]">
        <div className="text-lg font-medium">Form</div>
        <InputForm />
      </div>
    </motion.div>
  );
}
