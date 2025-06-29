import React from "react";

export default function SellReasonReviewCard({
  checklistReview = {},
  checklist = {},
}) {
  const grouped = {
    positive: [],
    neutral: [],
    negative: [],
  };

  for (const [key, value] of Object.entries(checklistReview)) {
    const original = checklist[key]?.comment || "";
    if (value === "positive") {
      grouped.positive.push({ key, comment: original });
    } else if (value === "neutral") {
      grouped.neutral.push({ key, comment: original });
    } else if (value === "negative") {
      grouped.negative.push({ key, comment: original });
    }
  }

  return (
    <div className="p-8 mt-4 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl w-[calc(32%)]">
      <h2 className="text-xl font-semibold text-primary mb-4">
        Trade Reason Reflection
      </h2>

      {[
        { label: "Still Positive", key: "positive", color: "text-green-600" },
        { label: "Didn’t Matter", key: "neutral", color: "text-yellow-600" },
        { label: "Shouldn’t Have Relied", key: "negative", color: "text-red-500" },
      ].map(({ label, key, color }) =>
        grouped[key].length > 0 ? (
          <div key={key} className={`mb-4 ${color}`}>
            <h3 className="text-lg font-semibold mb-2">{label}</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {grouped[key].map(({ key: field, comment }, i) => (
                <li key={i}>
                  <span className="font-medium">{field}:</span>{" "}
                  <span className="text-[var(--color-text)] italic">
                    {comment || "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null
      )}
    </div>
  );
}
