import { DateTime } from "luxon";
import { Timestamp } from "firebase/firestore";

export function buildTimestamp(dateStr, timeStr) {
  if (!dateStr) return { timestamp: null, timeProvided: false };

  const dt = timeStr
    ? DateTime.fromFormat(`${dateStr} ${timeStr}`, "yyyy-MM-dd HH:mm", {
        zone: "America/New_York",
      })
    : DateTime.fromFormat(dateStr, "yyyy-MM-dd", {
        zone: "America/New_York",
      });

  if (!dt.isValid) {
    console.warn("Invalid timestamp date:", dt.invalidExplanation);
    return { timestamp: null, timeProvided: false };
  }

  return {
    timestamp: Timestamp.fromDate(dt.toJSDate()),
    timeProvided: !!timeStr,
  };
}
