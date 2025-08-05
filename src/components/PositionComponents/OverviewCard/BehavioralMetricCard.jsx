import React, { useMemo, useEffect, useState } from "react";
import MetricsCard from "./MetricsCard.jsx";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { useUser } from "../../../context/UserContext";

const BehavioralMetricsCard = () => {
  const { refreshTrigger } = useUser(); // ✅ added
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const ref = doc(db, "users", user.uid, "stats", "behaviorMetrics");
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setData(snap.data());
      }
    };

    fetchMetrics();
  }, [refreshTrigger]); // ✅ refetch when triggered

  const behavioralFields = useMemo(() => {
    if (!data) {
      return [
        { label: "Journal Entry Count", value: "Loading...", info: "" },
        { label: "Avg Confidence Rating", value: "Loading...", info: "" },
        { label: "Most Common Exit Reason", value: "Loading...", info: "" },
        { label: "Most Used Checklist Item", value: "Loading...", info: "" },
        { label: "Most Reliable Checklist Item", value: "Loading...", info: "" },
        { label: "Least Reliable Checklist Item", value: "Loading...", info: "" },
        { label: "Average Exit Evaluation", value: "Loading...", info: "" },
      ];
    }

    const {
      journalEntryCount = 0,
      totalConfidenceScore = 0,
      mostCommonExitReason = "",
      mostUsedChecklistItem = "",
      mostReliableChecklistItem = "",
      leastReliableChecklistItem = "",
      avgExitEvaluation = 0,
    } = data;

    const avgConfidence = journalEntryCount > 0
      ? (totalConfidenceScore / journalEntryCount).toFixed(1)
      : "10";

    return [
      {
        label: "Journal Entry Count",
        value: journalEntryCount.toString(),
        info: "Tracks the total number of journaled trades. A higher count indicates strong consistency in reflection and self-review.",
      },
      {
        label: "Avg Confidence Rating",
        value: `${avgConfidence} / 10`,
        info: "Average self-rated confidence when entering trades. Useful for comparing your conviction level with actual outcomes over time.",
      },
      {
        label: "Most Common Exit Reason",
        value: mostCommonExitReason || "—",
        info: "The most frequently cited reason for closing trades. Reveals patterns in your exit strategy and helps identify automation or over-reliance trends.",
      },
      {
        label: "Most Used Checklist Item",
        value: mostUsedChecklistItem || "—",
        info: "The checklist item you rely on most before entering trades. Reflects your primary decision-making anchors.",
      },
      {
        label: "Most Reliable Checklist Item",
        value: mostReliableChecklistItem || "—",
        info: "The checklist item most often associated with successful trades. Shows which signals align best with positive outcomes.",
      },
      {
        label: "Least Reliable Checklist Item",
        value: leastReliableChecklistItem || "—",
        info: "The checklist item most often associated with poor outcomes. Consider refining or re-evaluating how you interpret this signal.",
      },
      {
        label: "Average Exit Evaluation",
        value: `${avgExitEvaluation.toFixed(1)} / 5`,
        info: "Your average post-trade rating of how well you managed the exit. Helps gauge emotional control, timing, and execution consistency.",
      },
    ];
  }, [data]);

  return (
    <div>
      <MetricsCard title="Behavioral & Reflection Metrics" fields={behavioralFields} />
    </div>
  );
};

export default BehavioralMetricsCard;
