import { doc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export async function initializeFirstData(userId) {
  const today = new Date();

  // ⏪ Set to "yesterday" to match first day snapshot logic
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const yyyyMMdd = yesterday.toISOString().split("T")[0];

  // 🔹 1. Create daily snapshot with object-based `positions`
  const snapshotRef = doc(db, "users", userId, "dailySnapshots", yyyyMMdd);
  await setDoc(snapshotRef, {
    date: yyyyMMdd,
    totalCostBasis: 0,
    totalMarketValue: 0,
    unrealizedPL: 0,
    totalPLPercent: 0,
    cash: 0,
    totalAssets: 0,
    netContribution: 0,
    positions: {},
    cumulativeTrades: 0,
    cumulativeInvested: 0,
    cumulativeRealizedPL: 0,
    createdAt: Timestamp.fromDate(yesterday),
  });

  // 🔹 2. Create initial realized profit/loss entry
  const realizedPLRef = doc(db, "users", userId, "realizedPLByDate", yyyyMMdd);
  await setDoc(realizedPLRef, {
    realizedPL: 0,
    date: yyyyMMdd,
    createdAt: Timestamp.fromDate(yesterday),
  });

  // 🔹 3. Save first snapshot date to user profile
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    firstSnapshotDate: yyyyMMdd,
    winCount: 0,
    lossCount: 0,
  });

  // 🔹 4. Initialize capital-weighted holding stats
  const statsRef = doc(db, "users", userId, "stats", "holdingDuration");
  await setDoc(statsRef, {
    totalHoldingDays: 0,
    totalCapital: 0,
    lastUpdatedDate: yyyyMMdd, // Start at yesterday
  });

  // 🔹 5. Initialize behavioral metrics
  const behaviorRef = doc(db, "users", userId, "stats", "behaviorMetrics");
  await setDoc(behaviorRef, {
    journalEntryCount: 0,
    totalConfidenceScore: 0,
    mostCommonExitReason: "",
    exitReasonCounts: {},
    mostUsedChecklistItem: "",
    checklistItemCounts: {},
    checklistReliabilityScores: {}, // 🆕 Per-item reliability scores
    mostReliableChecklistItem: "", // 🆕 Top scorer
    leastReliableChecklistItem: "", // 🆕 Bottom scorer
    exitEvalSum: 0, // 🆕 Total stars
    exitEvalCount: 0, // 🆕 Number of ratings
    avgExitEvaluation: 0, // 🆕 Computed
  });
}
