// Firestore Timestamp or JS Date -> "YYYY-MM-DD" in Eastern Time
export function toETDateOnly(input) {
  const d = input?.toDate ? input.toDate() : new Date(input);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
}
