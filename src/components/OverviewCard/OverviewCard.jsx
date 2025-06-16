import { useRef, useState, useEffect } from "react";
import FinancialMetricsCard from "./FinancialMetricCard.jsx";
import PerformanceInsightsCard from "./PerformanceInsightCard.jsx";
import BehavioralMetricsCard from "./BehavioralMetricCard.jsx";
import TimeSummaryCard from "./TimeSummaryCard.jsx";
import SectorBreakdownChart from "./SectorBreakdownChart.jsx";
import NotesCard from "./NotesCard.jsx";
import { motion } from "framer-motion";
import { FinancialRefProvider } from "../../sharedRefs.jsx";

export default function OverviewCard() {
  const scrollRef = useRef(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowTopFade(scrollTop > 0);
      setShowBottomFade(scrollTop + clientHeight < scrollHeight - 1);
    };

    handleScroll(); // run once on mount
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative h-[calc(100%-40px)] p-0 my-4 overflow-hidden">
      {/* Top fade overlay */}
      <div
        className={`pointer-events-none absolute top-0 left-0 w-full h-6 bg-gradient-to-b from-[var(--color-background)] to-transparent z-10 transition-opacity duration-300 ${
          showTopFade ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Bottom fade overlay */}
      <div
        className={`pointer-events-none absolute bottom-0 left-0 w-full h-6 bg-gradient-to-t from-[var(--color-background)] to-transparent z-10 transition-opacity duration-300 ${
          showBottomFade ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Scrollable content */}
      <div ref={scrollRef} className="overflow-y-auto h-full px-6">
        <div className="flex gap-4 w-full">
          <div className="flex flex-col gap-10 w-1/2">
            <FinancialRefProvider>
              <FinancialMetricsCard />
              <BehavioralMetricsCard />
              <SectorBreakdownChart />
            </FinancialRefProvider>
          </div>
          <div className="flex flex-col gap-10 w-1/2">
            <FinancialRefProvider>
              <PerformanceInsightsCard />
              <TimeSummaryCard />
              <NotesCard />
            </FinancialRefProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
