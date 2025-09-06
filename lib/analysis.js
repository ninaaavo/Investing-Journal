// lib/analysis.js
/* -------- Prompts (exported) -------- */
export const promptSystem =
  "You are an investing performance analyst. " +
  "Return STRICT JSON keyed by timeframes (ALL, YTD, 1M, 3M, 6M, 1Y). " +
  "For each timeframe include: { summary, kpis, actions[] }. " +
  "In kpis, ONLY use dollar-value metrics with these exact keys: { totalPL, maxDrawdownAbs }. " +
  "- totalPL: lastEquity - baselineEquity (cash profit/loss, may be negative). " +
  "- maxDrawdownAbs: the most negative peak-to-trough change in equity (negative number). " +
  "Use numeric values from kpis verbatim; do not invent numbers. " +
  "You may use the optional series (array of [date, equity]) only to infer timing phrases " +
  "(e.g., 'performance improved in May'). " +
  "Never state new numeric metrics from series. " +
  "Do NOT use percentages or the '%' symbol anywhere. " +
  "Additionally, include a section called `behavior` summarizing the user's behaviorMetrics " +
  "(e.g., avgConfidenceScore, mostReliableChecklistItem, leastReliableChecklistItem, " +
  "mostUsedChecklistItem, mostCommonExitReason, journalEntryCount) and a section called `portfolio` " +
  "summarizing holdingDuration (avgHoldingDays) and sectorBreakdown. " +
  "Each section should include: { summary, insights[], actions[] }. " +
  "Optionally include _cross with { summary, comparisons[] }.";

export const promptUser =
  "Given per-timeframe KPIs and optional series, write concise insights per timeframe " +
  "(1–3 sentence summary, 2–5 concrete actions). " +
  "Use kpis for all numbers; use series only to detect trend shifts and months. " +
  "IMPORTANT: Speak only in dollar terms with the provided keys { totalPL, maxDrawdownAbs }. " +
  "Never use percentages or ratio language (no '%', 'pct', 'rate', etc.). " +
  "Also analyze the provided behaviorMetrics and portfolio stats. " +
  "In `behavior`, highlight habits (confidence, checklist reliability, exit reasons). " +
  "In `portfolio`, highlight concentration, sector exposure, and average holding duration. " +
  "Make recommendations that connect behavior and portfolio structure to performance.";

/* -------- Auth helper (exported) -------- */
export function getBearerToken(req) {
  const raw = req?.headers?.authorization || "";
  return raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw.trim();
}

// utils/initFirebaseAdmin.js
export function initFirebaseAdmin(admin) {
  // Avoid re-init if hot-reloaded / multiple lambdas
  if (admin.apps?.length) return admin;

  try {
    // 1) Preferred on Vercel: JSON pasted in an env var
    const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY; // <- set this on Vercel
    if (jsonEnv) {
      const parsed = JSON.parse(jsonEnv);

      // Normalize private_key newlines (important when stored in env)
      if (typeof parsed.private_key === "string") {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }

      assertServiceAccountShape(parsed);

      admin.initializeApp({
        credential: admin.credential.cert(parsed),
        projectId: parsed.project_id, // optional but explicit
      });

      if (process.env.NODE_ENV !== "production") {
        console.log("[firebase-admin] Initialized from FIREBASE_SERVICE_ACCOUNT_KEY.");
      }
      return admin;
    }

    // 2) Local file path style (works great on your machine)
    //    If you set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp(); // firebase-admin will read the path env automatically
      if (process.env.NODE_ENV !== "production") {
        console.log("[firebase-admin] Initialized from GOOGLE_APPLICATION_CREDENTIALS path.");
      }
      return admin;
    }

    // 3) Fallback: ADC (gcloud / workload identity, etc.)
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    if (process.env.NODE_ENV !== "production") {
      console.log("[firebase-admin] Initialized from applicationDefault credentials.");
    }
    return admin;
  } catch (err) {
    console.error("[firebase-admin] Initialization failed:", err);
    throw err; // surface it to your API route
  }
}

function assertServiceAccountShape(sa) {
  const required = ["project_id", "client_email", "private_key"];
  for (const k of required) {
    if (!sa?.[k]) throw new Error(`Service account JSON missing "${k}"`);
  }
}

/* -------- Snapshot/date helpers (exported) -------- */
export function parseSnapshotDate(s) {
  const d =
    s?.date ?? s?.timestamp ?? s?.day ?? s?.createdAt ?? s?.lastUpdated ?? null;
  if (!d) return null;
  if (typeof d === "string") return new Date(d);
  if (typeof d === "object" && typeof d.toDate === "function") return d.toDate();
  if (typeof d === "object" && "seconds" in d) return new Date(d.seconds * 1000);
  if (typeof d === "number") return new Date(d);
  try { return new Date(d); } catch { return null; }
}

export function sortSnapshotsAsc(snaps = []) {
  return [...snaps].sort((a, b) => {
    const da = parseSnapshotDate(a)?.getTime() ?? 0;
    const db = parseSnapshotDate(b)?.getTime() ?? 0;
    return da - db;
  });
}

export function getBoundaries(now = new Date()) {
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const minus = (days) => new Date(now.getTime() - days * 24 * 3600 * 1000);
  return {
    ALL: null,
    YTD: { from: startOfYear },
    "1M": { from: minus(30) },
    "3M": { from: minus(90) },
    "6M": { from: minus(182) },
    "1Y": { from: minus(365) },
  };
}

export function isoDateYYYYMMDD(snap) {
  const d = parseSnapshotDate(snap);
  return d ? d.toISOString().slice(0, 10) : null; // YYYY-MM-DD
}

/* -------- Equity + series builders (exported) -------- */
export function getEquity(s) {
  const candidates = [
    ["totalEquity", s?.totalEquity],
    ["equity", s?.equity],
    ["portfolioValue", s?.portfolioValue],
    ["netLiq", s?.netLiq],
    ["netLiquidity", s?.netLiquidity],
    ["accountValue", s?.accountValue],
    ["totalMarketValue", s?.totalMarketValue],
    ["totalAssets", s?.totalAssets],
    ["equityNoCash", s?.equityNoCash],
    ["totals.equity", s?.totals?.equity],
    ["totals.portfolioValue", s?.totals?.portfolioValue],
    ["totals.totalMarketValue", s?.totals?.totalMarketValue],
    ["totals.totalLongMarketValue", s?.totals?.totalLongMarketValue],
    ["totals.equityNoCash", s?.totals?.equityNoCash],
    ["summary.equity", s?.summary?.equity],
    ["summary.portfolioValue", s?.summary?.portfolioValue],
  ];
  for (const [, val] of candidates) {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function buildDailySeries(sortedSnaps) {
  const out = [];
  for (const s of sortedSnaps) {
    const d = isoDateYYYYMMDD(s);
    if (!d) continue;
    const eq = getEquity(s);
    if (!Number.isFinite(eq)) continue;
    out.push([d, Math.round(eq * 100) / 100]);
  }
  return out;
}

export function endOfMonthKey(dateObj) {
  return (
    dateObj.getUTCFullYear() +
    "-" +
    String(dateObj.getUTCMonth() + 1).padStart(2, "0")
  );
}

export function buildMonthlySeries(sortedSnaps) {
  const map = new Map();
  for (const s of sortedSnaps) {
    const dObj = parseSnapshotDate(s);
    if (!dObj) continue;
    const key = endOfMonthKey(dObj);
    map.set(key, s); // keep latest in that month (array is ascending)
  }
  const out = [];
  for (const [, snap] of map.entries()) {
    const d = isoDateYYYYMMDD(snap);
    if (!d) continue;
    const eq = getEquity(snap);
    if (!Number.isFinite(eq)) continue;
    out.push([d, Math.round(eq * 100) / 100]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}

export function splitOlderThan1Y(sortedSnaps, now = new Date()) {
  const cutoff = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
  const older = [];
  const recent = [];
  for (const s of sortedSnaps) {
    const d = parseSnapshotDate(s);
    if (!d) continue;
    if (d < cutoff) older.push(s);
    else recent.push(s);
  }
  return { older, recent };
}

/* -------- Cash P/L KPI builder (exported) -------- */
export function buildTimeframeKPIs(dailySnapshots = []) {
  const sorted = sortSnapshotsAsc(dailySnapshots);
  if (!sorted.length) {
    return {
      ALL: { kpis: {}, series: [] },
      YTD: { kpis: {}, series: [] },
      "1M": { kpis: {}, series: [] },
      "3M": { kpis: {}, series: [] },
      "6M": { kpis: {}, series: [] },
      "1Y": { kpis: {}, series: [] },
    };
  }

  const getPL = (snap) => {
    if (!snap || typeof snap !== "object") return 0;
    const t = snap.totals || {};
    const numOr0 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const sum = (a, b) => numOr0(a) + numOr0(b);

    let preferred = sum(t.unrealizedPLNet, t.realizedPL);
    if (preferred !== 0) return preferred;

    const derivedUnrealNet = sum(t.unrealizedPLLong, t.unrealizedPLShort);
    preferred = sum(derivedUnrealNet, t.realizedPL);
    if (preferred !== 0) return preferred;

    const otherCombos = [sum(snap.unrealizedPL, t.realizedPL), sum(t.unrealizedPL, t.realizedPL)];
    for (const v of otherCombos) if (v !== 0) return v;

    const fallbacks = [
      snap.pl,
      snap.totalPL,
      snap.totalPLAbs,
      snap?.stats?.pl,
      snap?.kpis?.totalPLAbs,
      snap?.cumulativePL,
    ];
    for (const v of fallbacks) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  };

  const first = (arr) => (arr.length ? arr[0] : null);
  const last = (arr) => (arr.length ? arr[arr.length - 1] : null);

  const { older, recent } = splitOlderThan1Y(sorted);
  const monthlyOlder = buildMonthlySeries(older);
  const dailyRecent = buildDailySeries(recent);
  const hybridAll = [...monthlyOlder, ...dailyRecent]; // ascending

  const bounds = getBoundaries();

  const getDate = (snap) => {
    const d = snap.date ?? snap.createdAt ?? snap.snapshotDate ?? snap.day ?? snap.ts;
    const dt = d instanceof Date ? d : new Date(d);
    return Number.isFinite(dt.getTime()) ? dt : null;
  };

  const filterByRange = (arr, range) => {
    if (!range?.from) return arr;
    const fromMs = range.from.getTime();
    return arr.filter((s) => {
      const dt = getDate(s);
      return dt && dt.getTime() >= fromMs;
    });
  };

  const computePLKPIs = (slice, tf) => {
    const furthest = first(slice);
    const nearest  = last(slice);
    if (!furthest && !nearest) {
      return { plAbs: null, plChangeAbs: null, maxDrawdownAbs: null };
    }

    const furthestPL = furthest ? getPL(furthest) : null;
    const nearestPL  = nearest  ? getPL(nearest)  : null;
    const plsInSlice = slice.map(getPL).filter((v) => Number.isFinite(v));

    let plAbs = null, plChangeAbs = null;

    if (tf === "ALL") {
      plAbs = Number.isFinite(nearestPL) ? nearestPL : null;
    } else {
      plChangeAbs =
        Number.isFinite(nearestPL) && Number.isFinite(furthestPL)
          ? nearestPL - furthestPL
          : null;
    }

    let maxDrawdownAbs = null;
    if (Number.isFinite(furthestPL) && plsInSlice.length > 0) {
      const minPL = Math.min(...plsInSlice);
      maxDrawdownAbs = minPL - furthestPL; // negative number
    }
    return { plAbs, plChangeAbs, maxDrawdownAbs };
  };

  const out = {};
  for (const tf of Object.keys(bounds)) {
    const slice = filterByRange(sorted, bounds[tf]);

    const fromTs = bounds[tf]?.from?.getTime();
    const seriesSource =
      tf === "1M" || tf === "3M" || tf === "6M" || tf === "1Y" ? dailyRecent : hybridAll;
    const series =
      fromTs != null ? seriesSource.filter(([d]) => new Date(d).getTime() >= fromTs) : seriesSource;

    const { plAbs, plChangeAbs, maxDrawdownAbs } = computePLKPIs(slice, tf);
    const kpis = tf === "ALL"
      ? { plAbs, maxDrawdownAbs }
      : { plChangeAbs, maxDrawdownAbs };

    out[tf] = { kpis, series };
  }
  return out;
}

/* -------- Firestore fetch (db passed in) (exported) -------- */
export async function fetchUserBundle(db, uid) {
  const userRef = db.collection("users").doc(uid);

  const [userSnap, dailySnapSnap, statsSnap] = await Promise.all([
    userRef.get(),
    userRef.collection("dailySnapshots").limit(2000).get(),
    userRef.collection("stats").get(),
  ]);

  const dailySnapshots = [];
  dailySnapSnap.forEach((d) => dailySnapshots.push({ id: d.id, ...d.data() }));

  const stats = {};
  statsSnap.forEach((doc) => { stats[doc.id] = doc.data(); });

  const behavior = stats.behaviorMetrics || {};
  const holding  = stats.holdingDuration || {};
  const sector   = stats.sectorBreakdown || {};

  const journalEntryCount   = behavior.journalEntryCount || 0;
  const totalConfidenceScore = behavior.totalConfidenceScore || 0;
  const avgConfidenceScore  = journalEntryCount > 0 ? totalConfidenceScore / journalEntryCount : 0;

  const totalCapital    = holding.totalCapital || 0;
  const totalHoldingDays = holding.totalHoldingDays || 0;
  const avgHoldingDays  = totalCapital > 0 ? totalHoldingDays / totalCapital : 0;

  return {
    uid,
    userDoc: userSnap.exists ? userSnap.data() : null,
    dailySnapshots,
    stats: {
      behaviorMetrics: {
        ...behavior,
        avgConfidenceScore,
      },
      holdingDuration: {
        ...holding,
        avgHoldingDays,
      },
      sectorBreakdown: sector,
    },
  };
}

/* -------- Behavior & Portfolio sections (exported) -------- */
export function buildBehaviorAndPortfolio(stats = {}) {
  const behavior = stats.behaviorMetrics || {};
  const holding  = stats.holdingDuration || {};
  const sector   = stats.sectorBreakdown || {};

  const journalEntryCount    = Number(behavior.journalEntryCount || 0);
  const totalConfidenceScore = Number(behavior.totalConfidenceScore || 0);
  const avgConfidenceScore   =
    journalEntryCount > 0 ? totalConfidenceScore / journalEntryCount : 0;

  const totalCapital     = Number(holding.totalCapital || 0);
  const totalHoldingDays = Number(holding.totalHoldingDays || 0);
  const avgHoldingDays   = totalCapital > 0 ? totalHoldingDays / totalCapital : 0;

  const breakdown = Array.isArray(sector.breakdown) ? sector.breakdown : [];
  const totalValue =
    Number(sector.totalValue || breakdown.reduce((s, x) => s + Number(x?.value || 0), 0)) || 0;
  const sectorShare =
    totalValue > 0
      ? breakdown.map((x) => ({
          name: String(x?.name ?? "Unknown"),
          weightPct: (Number(x?.value || 0) / totalValue) * 100,
        }))
      : [];

  return {
    behavior: {
      journalEntryCount,
      totalConfidenceScore,
      avgConfidenceScore,
      mostUsedChecklistItem: behavior.mostUsedChecklistItem ?? null,
      mostReliableChecklistItem: behavior.mostReliableChecklistItem ?? null,
      leastReliableChecklistItem: behavior.leastReliableChecklistItem ?? null,
      mostCommonExitReason: behavior.mostCommonExitReason ?? null,
      exitReasonCounts: behavior.exitReasonCounts ?? {},
      summary: "",
      insights: [],
      actions: [],
    },
    portfolio: {
      avgHoldingDays,
      totalHoldingDays,
      totalCapital,
      sectorShare,
      summary: "",
      insights: [],
      actions: [],
    },
  };
}

/* -------- LLM JSON extraction (exported) -------- */
export function safeParseLLMJson(resp) {
  const looksLikeAnalysis = (obj) => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
    const keys = Object.keys(obj);
    const markers = ["ALL", "YTD", "1M", "3M", "6M", "1Y", "behavior", "portfolio"];
    return keys.some((k) => markers.includes(k));
  };
  if (looksLikeAnalysis(resp)) return resp;

  const parsed = resp?.output?.[0]?.content?.[0]?.parsed_json ?? resp?.output_parsed;
  if (looksLikeAnalysis(parsed)) return parsed;

  const text =
    (typeof resp?.output_text === "string" && resp.output_text) ||
    (Array.isArray(resp?.output?.[0]?.content) &&
      resp.output[0].content
        .map((p) =>
          typeof p?.text === "string"
            ? p.text
            : typeof p?.content === "string"
            ? p.content
            : ""
        )
        .filter(Boolean)
        .join("\n")
        .trim()) ||
    (typeof resp?.output === "string" && resp.output) ||
    "";

  if (!text) return {};

  const fence = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const stripped = text.match(fence) ? text.match(fence)[1] : text;

  let cleaned = stripped.trim();
  const fb = cleaned.indexOf("{"), lb = cleaned.lastIndexOf("}");
  if (fb !== -1 && lb !== -1 && lb > fb) cleaned = cleaned.slice(fb, lb + 1);
  cleaned = cleaned
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u0000-\u001F\u007F]/g, (c) => (c === "\n" || c === "\r" || c === "\t" ? c : ""));

  try {
    const obj = JSON.parse(cleaned);
    return looksLikeAnalysis(obj) ? obj : {};
  } catch {
    return {};
  }
}

/* -------- Utility to merge LLM + server KPIs per timeframe (exported) -------- */
export function mergeAnalysis(perTF, analysisFromLLM) {
  const tfs = ["ALL", "YTD", "1M", "3M", "6M", "1Y"];
  const merged = {};
  for (const tf of tfs) {
    const llm = (analysisFromLLM && analysisFromLLM[tf]) || {};
    const llmSummary = typeof llm.summary === "string" ? llm.summary : "";
    const llmActions = Array.isArray(llm.actions) ? llm.actions : [];
    const llmKpis =
      llm && typeof llm.kpis === "object" && !Array.isArray(llm.kpis)
        ? llm.kpis
        : Array.isArray(llm.kpis)
        ? Object.fromEntries(
            llm.kpis
              .filter(
                (kv) => kv && typeof kv.key === "string" && typeof kv.value === "number"
              )
              .map(({ key, value }) => [key, value])
          )
        : {};

    const kpis =
      perTF?.[tf]?.kpis && typeof perTF[tf].kpis === "object" ? perTF[tf].kpis : {};
    const series = Array.isArray(perTF?.[tf]?.series) ? perTF[tf].series : [];

    merged[tf] = {
      summary: llmSummary,
      actions: llmActions,
      kpis: { ...kpis, ...llmKpis },
      series,
    };
  }
  return merged;
}

export function normalizeSection(sec) {
  const summary = typeof sec?.summary === "string" ? sec.summary : "";
  const insights = Array.isArray(sec?.insights)
    ? sec.insights.filter((s) => typeof s === "string")
    : [];
  const actions = Array.isArray(sec?.actions)
    ? sec.actions.filter((s) => typeof s === "string")
    : [];
  return { summary, insights, actions };
}
