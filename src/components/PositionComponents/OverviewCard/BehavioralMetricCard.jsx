import React, { useMemo, useRef, useEffect } from "react";
import MetricsCard from "./MetricsCard.jsx";
import { useTrackYShift } from "../../../hooks/useTrackYShift.jsx";
import { useFinancialRef, useBehavioralRef } from "../../../sharedRefs.jsx";

const BehavioralMetricsCard = () => {


  // Placeholder metrics
  const journalEntryCount = 27;
  const avgConfidenceRating = "3.8 / 5";
  const mostCommonMistake = "Selling too early";
  const mostUsedChecklistItem = "Strong earnings history";

  const behavioralFields = useMemo(
    () => [
      {
        label: "Journal Entry Count",
        value: journalEntryCount.toString(),
        info: "Reflects how often you've logged entries — more entries means more reflection.",
      },
      {
        label: "Avg Confidence Rating",
        value: avgConfidenceRating,
        info: "Average confidence you had when entering positions. Can be used to track intuition vs outcomes.",
      },
      {
        label: "Most Common Mistake",
        value: mostCommonMistake,
        info: "Based on tags or notes — helps with recognizing and correcting habits.",
      },
      {
        label: "Most Used Checklist Item",
        value: mostUsedChecklistItem,
        info: "Helps show what factors you prioritize most often when deciding to invest.",
      },
    ],
    []
  );

  return (
    <div>
      <MetricsCard
        title="Behavioral & Reflection Metrics"
        fields={behavioralFields}
      />
    </div>
  );
};

export default BehavioralMetricsCard;
