import React from "react";

export default function ReasonJournalCard({
  checklist = {},
  useWeightedScoring = false,
  score = null,
}) {
  const grouped = {
    Positive: [],
    Neutral: [],
    Negative: [],
  };

  let calculatedScore = 0;

  for (const [key, { value, comment = "", weight = 1 }] of Object.entries(checklist)) {
    const item = { key, comment, weight };

    if (value === "positive") {
      grouped.Positive.push(item);
      calculatedScore += useWeightedScoring ? weight : 1;
    } else if (value === "negative") {
      grouped.Negative.push(item);
      calculatedScore -= useWeightedScoring ? weight : 1;
    } else if (value === "neutral") {
      grouped.Neutral.push(item);
    }
  }

  const finalScore = score !== null ? score : calculatedScore;

  return (
    <div className="p-8 mt-4 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-xl w-[calc(32%)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-primary">Trade Reasons</h2>
        <span className="text-sm text-gray-600">
          Score: {finalScore} {useWeightedScoring && "(weighted)"}
        </span>
      </div>

      {["Positive", "Neutral", "Negative"].map((group) => (
        grouped[group].length > 0 && (
          <div
            key={group}
            className={`mb-4 ${
              group === "Positive"
                ? "text-green-600"
                : group === "Negative"
                ? "text-red-500"
                : "text-yellow-600"
            }`}
          >
            <h3 className="text-lg font-semibold mb-2">{group}</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {grouped[group].map(({ key, comment, weight }, index) => (
                <li key={index}>
                  <span className="font-medium">{key}:</span>{" "}
                  <span className="text-[var(--color-text)]">
                    {comment?.trim() ? comment : "—"}
                  </span>
                  {useWeightedScoring && group !== "Neutral" && (
                    <span className="ml-2 text-xs text-gray-500 italic">
                      (Weight: {weight})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      ))}
    </div>
  );
}
