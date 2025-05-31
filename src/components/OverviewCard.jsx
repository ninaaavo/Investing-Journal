import FinancialMetricsCard from "./FinancialMetricCard";
export default function OverviewCard() {
  return (
    <div className="h-[calc(100vh-250px)] overflow-y-auto p-6">
      <div className="flex gap-10 ">
        <div className="flex flex-col gap-10">
          <FinancialMetricsCard />
          <FinancialMetricsCard />
          <FinancialMetricsCard />
          <FinancialMetricsCard />
        </div>
        <div className="flex flex-col gap-10">
          <FinancialMetricsCard />
          <FinancialMetricsCard />
          <FinancialMetricsCard />
          <FinancialMetricsCard />
        </div>
      </div>
    </div>
  );
}
