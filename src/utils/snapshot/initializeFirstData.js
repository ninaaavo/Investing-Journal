import { doc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export async function initializeFirstData(userId) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yyyyMMdd = yesterday.toISOString().split("T")[0];

  // v2 snapshot skeleton (no cash, long/short split)
  const snapshotRef = doc(db, "users", userId, "dailySnapshots", yyyyMMdd);
  await setDoc(snapshotRef, {
    version: 2,
    date: yyyyMMdd,
    invested: 0,
    totalAssets: 0,
    netContribution: 0,

    longPositions: {},
    shortPositions: {},
    totals: {
      totalLongMarketValue: 0,
      totalShortLiability: 0,
      grossExposure: 0,
      equityNoCash: 0,
      unrealizedPLLong: 0,
      unrealizedPLShort: 0,
      unrealizedPLNet: 0,
    },

    // legacy (for existing UI)
    totalCostBasis: 0,
    totalMarketValue: 0,
    unrealizedPL: 0,
    totalPLPercent: 0,

    totalDividendReceived: 0,
    createdAt: Timestamp.fromDate(yesterday),
  });

  // Realized P/L day-0
  const realizedPLRef = doc(db, "users", userId, "realizedPLByDate", yyyyMMdd);
  await setDoc(realizedPLRef, {
    realizedPL: 0,
    date: yyyyMMdd,
    createdAt: Timestamp.fromDate(yesterday),
  });

  // Profile flags
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    firstSnapshotDate: yyyyMMdd,
    winCount: 0,
    lossCount: 0,
  });

  // Holding-duration stats
  const statsRef = doc(db, "users", userId, "stats", "holdingDuration");
  await setDoc(statsRef, {
    totalHoldingDays: 0,
    totalCapital: 0,
    lastUpdatedDate: yyyyMMdd,
  });

  // Behavioral metrics
  const behaviorRef = doc(db, "users", userId, "stats", "behaviorMetrics");
  await setDoc(behaviorRef, {
    journalEntryCount: 0,
    totalConfidenceScore: 0,
    mostCommonExitReason: "",
    exitReasonCounts: {},
    mostUsedChecklistItem: "",
    checklistItemCounts: {},
    checklistReliabilityScores: {},
    mostReliableChecklistItem: "",
    leastReliableChecklistItem: "",
    exitEvalSum: 0,
    exitEvalCount: 0,
    avgExitEvaluation: 0,
  });
}
