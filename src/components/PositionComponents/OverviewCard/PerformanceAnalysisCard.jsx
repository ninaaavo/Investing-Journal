// PerformanceAnalysisCard.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { getAuth } from "firebase/auth";

// ----- Timeframe options you support/render -----
const TIMEFRAME_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "YTD", label: "YTD" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "1Y", label: "1Y" },
];

/**
 * Resolve API base URL smartly
 */
const RESOLVE_API_BASE = () => {
  const fromEnv = import.meta?.env?.VITE_API_BASE;
  const fromWindow = typeof window !== "undefined" ? window.__API_BASE__ : "";

  const cleaned =
    (fromEnv && String(fromEnv).replace(/\/+$/, "")) ||
    (fromWindow && String(fromWindow).replace(/\/+$/, ""));

  if (cleaned) return cleaned;

  const isLocal =
    typeof window !== "undefined" &&
    (/^localhost$|^127\.0\.0\.1$/.test(window.location.hostname) ||
      window.location.hostname.startsWith("192.168.") ||
      window.location.hostname.startsWith("10."));

  return isLocal ? "http://localhost:3001" : "/api";
};

const API_BASE = RESOLVE_API_BASE();

/* ------------------------- Small render helpers ------------------------- */
const Section = ({ title, children, className = "" }) => (
  <div className={`rounded-xl border border-gray-200 p-4 ${className}`}>
    <h3 className="font-semibold mb-1">{title}</h3>
    {children}
  </div>
);

const MaybePara = ({ text }) =>
  text ? <p className="italic text-sm text-gray-800">{text}</p> : null;

const Bullets = ({ items }) =>
  Array.isArray(items) && items.length > 0 ? (
    <ul className="list-disc list-inside text-sm">
      {items.map((it, i) => (
        <li key={i}>{typeof it === "string" ? it : it?.text ?? it?.description ?? it?.howTo}</li>
      ))}
    </ul>
  ) : null;

const StatRow = ({ label, value }) =>
  value === null || value === undefined ? null : (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium">{String(value)}</span>
    </div>
  );

// Currency formatter (no color decisions here; keep it simple & neutral)
const fmtUSD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const formatUSD = (n) =>
  typeof n === "number" && Number.isFinite(n) ? fmtUSD.format(n) : null;

export default function PerformanceAnalysisCard({ defaultTimeframe = "ALL" }) {
  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [bundle, setBundle] = useState(null); // { analyzedAt, durationMs, analysis: { ALL, YTD, ... , _cross? }, behavior?, portfolio? }
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState(null);
  const abortRef = useRef(null);

  // Cache key is a single MULTI blob per user
  const getCacheKey = useCallback(() => {
    const uid = getAuth().currentUser?.uid || "anon";
    return `analysis:${uid}:MULTI`;
  }, []);

  const formatWhen = (iso) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  // Load cached bundle when user changes (uid) or on mount
  useEffect(() => {
    setErr(null);
    try {
      const cached = localStorage.getItem(getCacheKey());
      setBundle(cached ? JSON.parse(cached) : null);
    } catch {
      setErr("Failed to read cached analysis.");
    }
  }, [getCacheKey]);

  // Normalize server response shape (expects { analyzedAt, durationMs, analysis: {...} })
  const unwrap = (data) => {
    if (!data) return null;
    console.log("ur unwrap data is", data);

    return {
      analyzedAt: data.analyzedAt ?? data.analysis?.analyzedAt,
      durationMs: data.durationMs,
      analysis: data.analysis ?? data, // tolerate old flat payloads
      behavior: data.behavior ?? data.analysis?.behavior ?? null,
      portfolio: data.portfolio ?? data.analysis?.portfolio ?? null,
    };
  };

  // Generate (single call returns ALL slices)
  const generateNow = useCallback(async () => {
    try {
      setErr(null);
      setGenerating(true);

      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("You must be signed in to run analysis.");

      const token = await user.getIdToken();

      // Server computes ALL/YTD/1M/3M/6M/1Y in one go; timeframe param is not needed
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ source: "ui-card" }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Request failed (${res.status}): ${text || "Server error"}`);
      }

      const raw = await res.json();
      const normalized = unwrap(raw);
      if (!normalized?.analysis) throw new Error("Analysis returned no data.");

      setBundle(normalized);
      localStorage.setItem(getCacheKey(), JSON.stringify(normalized));
    } catch (e) {
      if (e.name !== "AbortError") setErr(e.message || "Unknown error");
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }, [getCacheKey]);

  console.log("ur bundle is", bundle);

  // Current slice for the selected timeframe
  const slice = bundle?.analysis?.[timeframe] ?? null;
  const cross = bundle?.analysis?._cross ?? null;

  // NEW: convenient refs for extra blocks
  const behavior = bundle?.behavior ?? bundle?.analysis?.behavior ?? null;
  const portfolio = bundle?.portfolio ?? bundle?.analysis?.portfolio ?? null;

  console.log("ur slice is ", slice);

  // Cash KPI accessors
  const totalPL = slice?.kpis?.totalPL;
  const maxDrawdownAbs = slice?.kpis?.maxDrawdownAbs;

  console.log("ur total pl", totalPL  )
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.05,
        duration: 0.35,
        ease: "easeOut",
        layout: { duration: 0.25, ease: [0.25, 0.8, 0.25, 1] },
      }}
      layout
      className="bg-white shadow-lg rounded-2xl p-6 flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">AI Performance Analysis ({timeframe})</h2>
          {bundle?.analyzedAt && (
            <p className="text-xs text-gray-500 mt-1">
              Analyzed on {formatWhen(bundle.analyzedAt)}
              {typeof bundle?.durationMs === "number" ? (
                <> · {Math.round(bundle.durationMs)} ms</>
              ) : null}
            </p>
          )}
          <p className="text-[11px] text-gray-400">
            API: <code>{API_BASE}</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Timeframe selector switches local slice only */}
          <select
            className="h-10 rounded-xl border border-gray-300 px-3 text-sm bg-white"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            disabled={generating}
            aria-label="Select timeframe"
          >
            {TIMEFRAME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {generating ? (
            <button
              disabled
              className="h-10 px-3 rounded-xl text-sm font-medium bg-gray-300 text-gray-600 cursor-not-allowed"
            >
              Generating…
            </button>
          ) : (
            <button
              onClick={generateNow}
              className="h-10 px-3 rounded-xl text-sm font-medium bg-black text-white hover:bg-gray-900"
            >
              {bundle ? "Regenerate" : "Generate Analysis"}
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="text-red-600 text-sm border border-red-200 rounded-lg p-3 bg-red-50">
          Error: {err}
        </div>
      )}

      {!bundle && !err && (
        <div className="text-gray-600 text-sm">
          Not generated yet. Choose a timeframe (or keep <b>All</b>) and click{" "}
          <b>Generate Analysis</b>.
        </div>
      )}

      {/* Slice view */}
      {bundle && !slice && (
        <div className="text-gray-600 text-sm">
          No data for <b>{timeframe}</b>. Try another timeframe.
        </div>
      )}

      {slice && (
        <Section title="Timeframe Insights">
          <MaybePara text={slice.summary} />

          {(slice.kpis || slice.kpi) && (
            <div className="mt-2 space-y-1">
              {/* CASH metrics only */}
              <StatRow label="Total P/L" value={formatUSD(totalPL)} />
              <StatRow label="Max Drawdown (cash)" value={formatUSD(maxDrawdownAbs)} />

              {/* Keep optional extras if your backend adds them later (non-% only) */}
              {slice.kpis?.bestTicker && (
                <StatRow label="Best Ticker" value={slice.kpis.bestTicker} />
              )}
              {slice.kpis?.worstTicker && (
                <StatRow label="Worst Ticker" value={slice.kpis.worstTicker} />
              )}
            </div>
          )}

          {Array.isArray(slice.actions) && slice.actions.length > 0 && (
            <div className="mt-3">
              <h4 className="font-medium text-sm mb-1">Recommended Actions</h4>
              <Bullets items={slice.actions} />
            </div>
          )}
        </Section>
      )}

      {/* Optional cross-timeframe blurb if backend provides it */}
      {cross && (
        <Section title="Cross-Timeframe Notes">
          <MaybePara text={cross.summary} />
          {Array.isArray(cross.comparisons) && cross.comparisons.length > 0 && (
            <Bullets items={cross.comparisons} />
          )}
        </Section>
      )}

      {/* ----------------------- Behavior block ----------------------- */}
      {behavior && (behavior.summary || behavior.stats || behavior.insights || behavior.actions) && (
        <Section title="Behavior Analysis" className="bg-gray-50">
          <MaybePara text={behavior.summary} />

          {behavior.stats && (
            <div className="mt-2 space-y-1">
              <StatRow label="Journal Entries" value={behavior.stats.journalEntryCount} />
              <StatRow
                label="Avg Confidence Score"
                value={
                  typeof behavior.stats.avgConfidenceScore === "number"
                    ? Number(
                        behavior.stats.avgConfidenceScore.toFixed?.(2) ??
                          behavior.stats.avgConfidenceScore
                      )
                    : behavior.stats.avgConfidenceScore
                }
              />
              {"streakDays" in (behavior.stats || {}) && (
                <StatRow label="Streak (days)" value={behavior.stats.streakDays} />
              )}
            </div>
          )}

          {Array.isArray(behavior.insights) && behavior.insights.length > 0 && (
            <div className="mt-3">
              <h4 className="font-medium text-sm mb-1">Insights</h4>
              <Bullets items={behavior.insights} />
            </div>
          )}

          {Array.isArray(behavior.actions) && behavior.actions.length > 0 && (
            <div className="mt-3">
              <h4 className="font-medium text-sm mb-1">Suggested Habits</h4>
              <Bullets items={behavior.actions} />
            </div>
          )}
        </Section>
      )}

      {/* ----------------------- Portfolio block ---------------------- */}
      {portfolio && (portfolio.summary || portfolio.stats || portfolio.insights || portfolio.actions) && (
        <Section title="Portfolio Analysis" className="bg-gray-50">
          <MaybePara text={portfolio.summary} />

          {portfolio.stats && (
            <div className="mt-2 space-y-1">
              {"avgHoldingDays" in portfolio.stats && (
                <StatRow
                  label="Avg Holding Days"
                  value={
                    typeof portfolio.stats.avgHoldingDays === "number"
                      ? Number(
                          portfolio.stats.avgHoldingDays.toFixed?.(2) ??
                            portfolio.stats.avgHoldingDays
                        )
                      : portfolio.stats.avgHoldingDays
                  }
                />
              )}
              {"concentrationTop" in portfolio.stats && (
                <StatRow label="Top Holding Concentration" value={portfolio.stats.concentrationTop} />
              )}
            </div>
          )}

          {Array.isArray(portfolio.insights) && portfolio.insights.length > 0 && (
            <div className="mt-3">
              <h4 className="font-medium text-sm mb-1">Insights</h4>
              <Bullets items={portfolio.insights} />
            </div>
          )}

          {Array.isArray(portfolio.actions) && portfolio.actions.length > 0 && (
            <div className="mt-3">
              <h4 className="font-medium text-sm mb-1">Recommended Actions</h4>
              <Bullets items={portfolio.actions} />
            </div>
          )}
        </Section>
      )}
    </motion.div>
  );
}
