import StockCard from "../components/StockCard";
import AddStockSmall from "../components/AddStockSmall";
import OverviewCard from "../components/OverviewCard";
export default function Positions() {
  return (
    <div className="flex gap-10 h-[calc(100vh-150px)] bg-[var(--color-background)] rounded-xl overflow-hidden shadow-lg p-6">
      <div className="flex flex-col">
        <div>
          <div className="text-lg font-medium">Add stock</div>
          <AddStockSmall />
        </div>
                  <div className="text-lg font-medium">Current Stocks</div>

        <div className="overflow-y-auto w-[640px]">
          <div className="flex flex-wrap gap-6">
            <StockCard />
            <StockCard />
            <StockCard />
            <StockCard />
          </div>
        </div>
      </div>
      <div>
        <div className="text-lg font-medium">Overview</div>
        <OverviewCard />
      </div>
    </div>
  );
}
