import FinancialMetricsCard from "./FinancialMetricCard";
import PerformanceInsightsCard from "./PerformanceInsightCard";
import BehavioralMetricsCard from "./BehavioralMetricCard";
import TimeSummaryCard from "./TimeSummaryCard";
import SectorBreakdownChart from "./SectorBreakdownChart";
export default function OverviewCard() {
  return (
    <div className="h-[calc(100vh-250px)] overflow-y-auto px-6 pt-4 pb-6">
      <div className="flex gap-10 ">
        <div className="flex flex-col gap-10">
          <FinancialMetricsCard />
          <BehavioralMetricsCard />
          <SectorBreakdownChart/>

        </div>
        <div className="flex flex-col gap-10">
          <PerformanceInsightsCard />
          <TimeSummaryCard />

        </div>
      </div>
    </div>
  );
}
